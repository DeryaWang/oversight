from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import re
from typing import Any

import requests


BRANCH_IDS = ("branch_a", "branch_b", "branch_c")
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts" / "query_decomposition"
ROUND1_PROMPT_PATH = PROMPTS_DIR / "round1.md"
ROUND2_BRANCH_PROMPT_PATHS = {
    "branch_a": PROMPTS_DIR / "round2_branch_a.md",
    "branch_b": PROMPTS_DIR / "round2_branch_b.md",
    "branch_c": PROMPTS_DIR / "round2_branch_c.md",
}


def _bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _string_env(name: str, default: str = "") -> str:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip()


def _coerce_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    items: list[str] = []
    for item in value:
        if isinstance(item, str):
            stripped = item.strip()
            if stripped:
                items.append(stripped)
        elif item is not None:
            rendered = str(item).strip()
            if rendered:
                items.append(rendered)
    return items


def _extract_json_object(text: str) -> dict[str, Any]:
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = re.sub(r"^```(?:json)?\s*", "", candidate)
        candidate = re.sub(r"\s*```$", "", candidate)

    try:
        parsed = json.loads(candidate)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", candidate, re.DOTALL)
    if not match:
        raise ValueError("Model output does not contain a JSON object")

    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Model output JSON must be an object")
    return parsed


@dataclass
class QueryBranchResult:
    branch_id: str
    status: str
    search_query: str | None = None
    error: str | None = None
    results: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "branch_id": self.branch_id,
            "status": self.status,
            "search_query": self.search_query,
            "error": self.error,
            "results": self.results,
        }


@dataclass
class QueryDecompositionRun:
    enabled: bool
    round1_status: str
    model: str
    base_url: str | None
    branches: list[QueryBranchResult]
    partial_success: bool = False
    error: str | None = None
    round1_output: dict[str, Any] | None = None

    def has_successful_branch(self) -> bool:
        return any(
            b.status == "success" and bool((b.search_query or "").strip())
            for b in self.branches
        )

    def agent_meta(self, include_debug: bool) -> dict[str, Any]:
        meta: dict[str, Any] = {
            "enabled": self.enabled,
            "round1_status": self.round1_status,
            "partial_success": self.partial_success,
            "model": self.model,
        }
        if self.base_url:
            meta["base_url"] = self.base_url
        if self.error:
            meta["error"] = self.error
        if include_debug and self.round1_output is not None:
            meta["debug"] = {"round1_output": self.round1_output}
        return meta


class QueryDecompositionAgent:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
        timeout_seconds: float | None = None,
        enabled: bool | None = None,
        debug: bool | None = None,
    ):
        self.mode = _string_env("QUERY_DECOMPOSITION_AGENT_MODE", "local").lower()
        if self.mode not in {"local", "remote"}:
            self.mode = "local"

        if self.mode == "remote":
            self.base_url = (base_url or _string_env("API_URL") or _string_env("REMOTE_AGENT_LLM_BASE_URL")).strip()
            self.model = (model or _string_env("REMOTE_AGENT_LLM_MODEL") or _string_env("LOCAL_AGENT_LLM_MODEL")).strip()
            self.api_key = api_key if api_key is not None else (_string_env("API_KEY") or _string_env("REMOTE_AGENT_LLM_API_KEY"))
            timeout_raw = (
                str(timeout_seconds)
                if timeout_seconds is not None
                else (_string_env("REMOTE_AGENT_LLM_TIMEOUT_SECONDS") or _string_env("LOCAL_AGENT_LLM_TIMEOUT_SECONDS") or "20")
            )
        else:
            self.base_url = (base_url or _string_env("LOCAL_AGENT_LLM_BASE_URL")).strip()
            self.model = (model or _string_env("LOCAL_AGENT_LLM_MODEL")).strip()
            self.api_key = api_key if api_key is not None else _string_env("LOCAL_AGENT_LLM_API_KEY")
            timeout_raw = (
                str(timeout_seconds)
                if timeout_seconds is not None
                else _string_env("LOCAL_AGENT_LLM_TIMEOUT_SECONDS", "20")
            )

        try:
            self.timeout_seconds = float(timeout_raw)
        except ValueError:
            self.timeout_seconds = 20.0
        self.enabled = _bool_env("LOCAL_AGENT_ENABLED", True) if enabled is None else enabled
        self.debug = _bool_env("LOCAL_AGENT_DEBUG", False) if debug is None else debug
        self.round1_prompt_template = self._load_prompt_file(ROUND1_PROMPT_PATH)
        self.round2_branch_prompts = {
            branch_id: self._load_prompt_file(path)
            for branch_id, path in ROUND2_BRANCH_PROMPT_PATHS.items()
        }

    @classmethod
    def from_env(cls) -> "QueryDecompositionAgent":
        return cls()

    def decompose(self, query_text: str) -> QueryDecompositionRun:
        empty_branches = [QueryBranchResult(branch_id=b, status="failed") for b in BRANCH_IDS]

        if not self.enabled:
            return QueryDecompositionRun(
                enabled=False,
                round1_status="skipped",
                model=self.model,
                base_url=self.base_url or None,
                branches=[],
                error="Local agent disabled via LOCAL_AGENT_ENABLED",
            )

        if not self.base_url or not self.model:
            return QueryDecompositionRun(
                enabled=False,
                round1_status="skipped",
                model=self.model,
                base_url=self.base_url or None,
                branches=[],
                error="Agent not configured (base_url/model missing for selected mode)",
            )

        if not self._prompts_configured():
            return QueryDecompositionRun(
                enabled=False,
                round1_status="skipped",
                model=self.model,
                base_url=self.base_url or None,
                branches=[],
                error="Query decomposition prompts are placeholders (TODO)",
            )

        try:
            round1_output = self._run_round1(query_text)
        except Exception as exc:
            return QueryDecompositionRun(
                enabled=True,
                round1_status="failed",
                model=self.model,
                base_url=self.base_url,
                branches=empty_branches,
                error=f"Round 1 failed: {exc}",
            )

        branches = self._run_round2_parallel(query_text, round1_output)
        success_count = sum(1 for b in branches if b.status == "success")
        partial_success = 0 < success_count < len(branches)

        return QueryDecompositionRun(
            enabled=True,
            round1_status="success",
            model=self.model,
            base_url=self.base_url,
            branches=branches,
            partial_success=partial_success,
            round1_output=round1_output,
            error=None if success_count > 0 else "All round-2 branches failed",
        )

    def _prompts_configured(self) -> bool:
        if not self.round1_prompt_template or self.round1_prompt_template.strip() == "TODO":
            return False
        return all(prompt and prompt.strip() != "TODO" for prompt in self.round2_branch_prompts.values())

    def _load_prompt_file(self, path: Path) -> str:
        try:
            return path.read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            return ""

    def _chat_completion(self, messages: list[dict[str, str]]) -> str:
        url = self.base_url.rstrip("/") + "/chat/completions"
        response = requests.post(
            url,
            headers={
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}),
            },
            json={
                "model": self.model,
                "messages": messages,
                "temperature": 0,
            },
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        choices = payload.get("choices") or []
        if not choices:
            raise ValueError("No choices returned from model")
        message = choices[0].get("message") or {}
        content = message.get("content")

        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    parts.append(str(item.get("text", "")))
                else:
                    parts.append(str(item))
            return "".join(parts)
        raise ValueError("Unsupported message content format from model")

    def _run_round1(self, query_text: str) -> dict[str, Any]:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a query decomposition assistant. "
                    "Return JSON only. No markdown code fences."
                ),
            },
            {
                "role": "user",
                "content": self._render_round1_prompt(query_text),
            },
        ]
        raw = self._chat_completion(messages)
        parsed = _extract_json_object(raw)
        return self._normalize_round1_output(parsed)

    def _run_round2_parallel(
        self,
        query_text: str,
        round1_output: dict[str, Any],
    ) -> list[QueryBranchResult]:
        by_branch: dict[str, QueryBranchResult] = {
            branch_id: QueryBranchResult(branch_id=branch_id, status="failed")
            for branch_id in BRANCH_IDS
        }
        with ThreadPoolExecutor(max_workers=len(BRANCH_IDS)) as executor:
            future_to_branch = {
                executor.submit(self._run_round2_branch, branch_id, query_text, round1_output): branch_id
                for branch_id in BRANCH_IDS
            }
            for future in as_completed(future_to_branch):
                branch_id = future_to_branch[future]
                try:
                    by_branch[branch_id] = future.result()
                except requests.Timeout:
                    by_branch[branch_id] = QueryBranchResult(
                        branch_id=branch_id,
                        status="timeout",
                        error="Round 2 branch timed out",
                    )
                except Exception as exc:
                    by_branch[branch_id] = QueryBranchResult(
                        branch_id=branch_id,
                        status="failed",
                        error=f"Round 2 branch failed: {exc}",
                    )

        return [by_branch[branch_id] for branch_id in BRANCH_IDS]

    def _run_round2_branch(
        self,
        branch_id: str,
        query_text: str,
        round1_output: dict[str, Any],
    ) -> QueryBranchResult:
        prompt_template = self.round2_branch_prompts[branch_id]
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a retrieval query generator. "
                    "Return JSON only with a single key `search_query`."
                ),
            },
            {
                "role": "user",
                "content": self._render_round2_prompt(
                    branch_id=branch_id,
                    prompt_template=prompt_template,
                    query_text=query_text,
                    round1_output=round1_output,
                ),
            },
        ]

        try:
            raw = self._chat_completion(messages)
        except requests.Timeout:
            return QueryBranchResult(
                branch_id=branch_id,
                status="timeout",
                error="Round 2 branch timed out",
            )
        except Exception as exc:
            return QueryBranchResult(
                branch_id=branch_id,
                status="failed",
                error=f"Round 2 branch failed: {exc}",
            )

        try:
            parsed = _extract_json_object(raw)
        except Exception as exc:
            return QueryBranchResult(
                branch_id=branch_id,
                status="invalid_output",
                error=f"Round 2 output is not valid JSON: {exc}",
            )

        search_query = parsed.get("search_query")
        if not isinstance(search_query, str) or not search_query.strip():
            return QueryBranchResult(
                branch_id=branch_id,
                status="invalid_output",
                error="Round 2 JSON must contain non-empty `search_query`",
            )

        return QueryBranchResult(
            branch_id=branch_id,
            status="success",
            search_query=search_query.strip(),
            error=None,
        )

    def _render_round1_prompt(self, query_text: str) -> str:
        return (
            f"{self.round1_prompt_template}\n\n"
            "User query:\n"
            f"{query_text}\n\n"
            "Return a JSON object with this schema:\n"
            "{"
            '"intent": string, '
            '"keywords": string[], '
            '"constraints": string[], '
            '"facets": string[], '
            '"notes": string[]'
            "}"
        )

    def _render_round2_prompt(
        self,
        *,
        branch_id: str,
        prompt_template: str,
        query_text: str,
        round1_output: dict[str, Any],
    ) -> str:
        return (
            f"{prompt_template}\n\n"
            f"Branch: {branch_id}\n\n"
            "Original user query:\n"
            f"{query_text}\n\n"
            "Round 1 analysis (JSON):\n"
            f"{json.dumps(round1_output, ensure_ascii=True)}\n\n"
            "Return JSON only with schema: {\"search_query\": string}"
        )

    def _normalize_round1_output(self, raw: dict[str, Any]) -> dict[str, Any]:
        # Keep a stable schema for downstream prompts even if the model returns extras.
        return {
            "intent": str(raw.get("intent", "")).strip(),
            "keywords": _coerce_string_list(raw.get("keywords")),
            "constraints": _coerce_string_list(raw.get("constraints")),
            "facets": _coerce_string_list(raw.get("facets")),
            "notes": _coerce_string_list(raw.get("notes")),
            "raw": raw,
        }

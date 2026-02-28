import argparse
import json
from datetime import timedelta
from pathlib import Path
import sys
import time

# Ensure repo root is on sys.path when running as a script.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from PaperRepository import PaperRepository


def load_queries(path: str) -> list[dict]:
    """Load queries from either query_flat.json format or multi_output.json format."""
    with open(path, "r") as f:
        data = json.load(f)
    
    # Check if it's multi_output.json format (dict with groundtruth->query mapping)
    if isinstance(data, dict):
        # Extract queries from values (ignore groundtruth keys)
        queries = []
        for query_text in data.values():
            queries.append({"question": query_text})
        return queries
    
    # Otherwise, assume it's query_flat.json format (list of dicts with "question" key)
    return data


def build_results(queries: list[dict], limit: int, embedding_model: str) -> dict:
    results = {"queries": []}
    all_time = timedelta(days=365 * 50)

    with PaperRepository(embedding_model_name=embedding_model) as repo:
        for query_id, query_item in enumerate(queries):
            query_text = query_item.get("question")
            if not query_text:
                continue

            papers = repo.get_newest_related_papers(
                text=query_text,
                timedelta=all_time,
                filter_list=[],
                limit=limit,
            )

            results["queries"].append(
                {
                    "query_id": query_id,
                    "query": query_text,
                    "abstract_ids": [paper.paper_id for paper in papers],
                    "paper_names": [paper.title for paper in papers],
                }
            )

    return results


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run retrieval for queries and save top-k abstracts. Supports both query_flat.json and multi_output.json formats."
    )
    parser.add_argument(
        "--input",
        default="/Users/lexi/workplace/ic/oversight/final_query_2602/sampled_multi_paper_entities_n2_output.json",
        help="Path to input file (query_flat.json or multi_output.json)",
    )
    parser.add_argument(
        "--output",
        default="/Users/lexi/workplace/ic/oversight/final_query_2602/n2_output.json",
        help="Path to output JSON",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Number of nearest papers to return per query",
    )
    parser.add_argument(
        "--embedding-model",
        default="models/gemini-embedding-001",
        help="Embedding model name used for query embeddings",
    )
    args = parser.parse_args()

    queries = load_queries(args.input)
    start_time = time.time()
    results = build_results(queries, args.limit, args.embedding_model)
    elapsed_seconds = time.time() - start_time

    results["run_metadata"] = {
        "started_at_epoch": int(start_time),
        "elapsed_seconds": elapsed_seconds,
        "query_count": len(results["queries"]),
        "top_k": args.limit,
        "embedding_model": args.embedding_model,
    }

    with open(args.output, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=True)

    print(
        f"Completed {results['run_metadata']['query_count']} queries in "
        f"{results['run_metadata']['elapsed_seconds']:.2f}s. "
        f"Output: {args.output}"
    )


if __name__ == "__main__":
    main()


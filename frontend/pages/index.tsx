import { useMemo, useRef, useState } from "react";

type Paper = {
  paper_id: string;
  title: string;
  abstract: string;
  source?: string | null;
  link?: string | null;
  paper_date?: string | null;
};

type QueryGroupStatus = "success" | "failed" | "timeout" | "invalid_output";

type QueryGroupResult = {
  branch_id: "branch_a" | "branch_b" | "branch_c" | string;
  status: QueryGroupStatus | string;
  search_query: string | null;
  error: string | null;
  results: Paper[];
};

type AgentMeta = {
  enabled: boolean;
  round1_status?: "success" | "failed" | "skipped" | string;
  partial_success?: boolean;
  model?: string;
  base_url?: string;
  error?: string;
  debug?: {
    round1_output?: Record<string, unknown>;
  };
};

function branchLabel(branchId: string): string {
  if (branchId === "branch_a") return "A";
  if (branchId === "branch_b") return "B";
  if (branchId === "branch_c") return "C";
  return branchId;
}

export default function HomePage() {
  const [text, setText] = useState("");
  const [timeDays, setTimeDays] = useState<number>(365 * 5);
  const [limit, setLimit] = useState<number>(10);
  const [sources, setSources] = useState({
    arxiv: true,
    ICML: true,
    NeurIPS: true,
    ICLR: true,
    OSDI: true,
    SOSP: true,
    ASPLOS: true,
    ATC: true,
    NSDI: true,
    MLSys: true,
    EuroSys: true,
    VLDB: true,
  });
  const [loading, setLoading] = useState(false);
  const lastRequestIdRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Paper[]>([]);
  const [queryGroups, setQueryGroups] = useState<QueryGroupResult[] | null>(null);
  const [agentMeta, setAgentMeta] = useState<AgentMeta | null>(null);

  const timeLabel = useMemo(() => {
    if (timeDays >= 365) {
      const years = Math.round(timeDays / 365);
      return `${years} year${years === 1 ? "" : "s"}`;
    }
    if (timeDays >= 30) {
      const months = Math.round(timeDays / 30);
      return `${months} month${months === 1 ? "" : "s"}`;
    }
    return `${timeDays} day${timeDays === 1 ? "" : "s"}`;
  }, [timeDays]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResults([]);
    setQueryGroups(null);
    setAgentMeta(null);

    const reqId = Date.now();
    lastRequestIdRef.current = reqId;

    try {
      const resp = await fetch(`/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({
          text,
          time_window_days: timeDays,
          limit,
          sources,
        }),
      });

      const data: any = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Request failed: ${resp.status}`);
      if (lastRequestIdRef.current !== reqId) return;

      setResults(Array.isArray(data.results) ? data.results : []);
      setQueryGroups(Array.isArray(data.query_groups) ? data.query_groups : null);
      setAgentMeta(data?.agent || null);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  const aiConferences = ["ICML", "NeurIPS", "ICLR"];
  const systemsConferences = ["OSDI", "SOSP", "ASPLOS", "ATC", "NSDI", "MLSys", "EuroSys", "VLDB"];

  const isAllAISelected = aiConferences.every((conf) => sources[conf as keyof typeof sources]);
  const isAllSystemsSelected = systemsConferences.every((conf) => sources[conf as keyof typeof sources]);

  function toggleSource(key: keyof typeof sources) {
    setSources((s) => ({ ...s, [key]: !s[key] }));
  }

  function toggleAllAI() {
    const newValue = !isAllAISelected;
    setSources((s) => {
      const updated = { ...s };
      aiConferences.forEach((conf) => {
        updated[conf as keyof typeof sources] = newValue;
      });
      return updated;
    });
  }

  function toggleAllSystems() {
    const newValue = !isAllSystemsSelected;
    setSources((s) => {
      const updated = { ...s };
      systemsConferences.forEach((conf) => {
        updated[conf as keyof typeof sources] = newValue;
      });
      return updated;
    });
  }

  function navigateToAbstract(abstract: string) {
    setText(abstract);
    setTimeout(() => {
      onSubmit(new Event("submit") as any);
    }, 100);
  }

  function renderPaperCard(p: Paper) {
    return (
      <div key={p.paper_id} className="chat chat-start">
        <div className="w-full max-w-3xl rounded-2xl bg-gray-700 p-4 text-gray-100">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">{p.title}</h3>
            <small className="opacity-70">
              {p.source || ""}
              {p.paper_date ? ` • ${new Date(p.paper_date).toLocaleDateString()}` : ""}
            </small>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{p.abstract}</p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => navigateToAbstract(p.abstract)} className="btn btn-sm btn-outline btn-primary">
              Navigate to abstract
            </button>
            {p.link && (
              <a className="btn btn-sm btn-outline btn-primary" href={p.link} target="_blank" rel="noreferrer">
                View paper
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  const hasQueryGroups = Boolean(queryGroups && queryGroups.length > 0);

  return (
    <main className="grid h-screen grid-rows-[auto,1fr]">
      <header className="border-b border-base-300/60 bg-base-100/60 backdrop-blur supports-[backdrop-filter]:bg-base-100/40">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="avatar placeholder">
            <div className="w-8 rounded bg-primary text-primary-content">
              <span className="text-sm font-bold">O</span>
            </div>
          </div>
          <h1 className="text-lg font-semibold">Oversight</h1>
          <span className="ml-auto text-xs text-base-content/60">Embeddings-backed search</span>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[320px,1fr]">
        <aside className="card bg-base-200 shadow-sm">
          <div className="card-body gap-4">
            <h2 className="card-title text-base">Filters</h2>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Lookback window</span>
                <span className="label-text-alt font-medium text-primary">{timeLabel}</span>
              </label>
              <input
                type="range"
                min={7}
                max={3650}
                step={1}
                value={timeDays}
                onChange={(e) => setTimeDays(parseInt((e.target as HTMLInputElement).value, 10))}
                className="range range-primary"
              />
              <div className="flex justify-between px-2 text-xs opacity-60">
                <span>1w</span>
                <span>1m</span>
                <span>1y</span>
                <span>10y</span>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Max results per group</span>
                <span className="label-text-alt font-medium text-primary">{limit}</span>
              </label>
              <input
                type="range"
                min={1}
                max={100}
                step={1}
                value={limit}
                onChange={(e) => setLimit(parseInt((e.target as HTMLInputElement).value, 10))}
                className="range range-primary"
              />
              <div className="flex justify-between px-2 text-xs opacity-60">
                <span>1</span>
                <span>25</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Sources</span>
              </label>

              <label className="label cursor-pointer justify-start gap-3">
                <input type="checkbox" className="checkbox checkbox-sm" checked={sources.arxiv} onChange={() => toggleSource("arxiv")} />
                <span className="label-text">arXiv</span>
              </label>

              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={isAllAISelected}
                  onChange={toggleAllAI}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = aiConferences.some((conf) => sources[conf as keyof typeof sources]) && !isAllAISelected;
                    }
                  }}
                />
                <span className="label-text font-medium">AI conferences</span>
              </label>
              {aiConferences.map((conf) => (
                <label key={conf} className="label ml-6 cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={sources[conf as keyof typeof sources]}
                    onChange={() => toggleSource(conf as keyof typeof sources)}
                  />
                  <span className="label-text text-sm">{conf}</span>
                </label>
              ))}

              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={isAllSystemsSelected}
                  onChange={toggleAllSystems}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = systemsConferences.some((conf) => sources[conf as keyof typeof sources]) && !isAllSystemsSelected;
                    }
                  }}
                />
                <span className="label-text font-medium">Systems conferences</span>
              </label>
              {systemsConferences.map((conf) => (
                <label key={conf} className="label ml-6 cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={sources[conf as keyof typeof sources]}
                    onChange={() => toggleSource(conf as keyof typeof sources)}
                  />
                  <span className="label-text text-sm">{conf}</span>
                </label>
              ))}
            </div>

            <button onClick={onSubmit as any} className={`btn btn-primary ${loading ? "btn-disabled loading" : ""}`} disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </button>
            {error && <div className="alert alert-error py-2 text-sm">{error}</div>}
          </div>
        </aside>

        <section className="card overflow-hidden bg-base-200 shadow-sm">
          <div className="card-body p-0">
            <div className="flex h-[calc(100vh-200px)] flex-col gap-4 overflow-y-auto p-4">
              <div className="chat chat-end">
                <div className="chat-bubble chat-bubble-primary w-full max-w-3xl">
                  <form onSubmit={onSubmit} className="flex flex-col gap-2">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={6}
                      placeholder="Paste related abstract(s) here..."
                      className="textarea textarea-bordered textarea-primary w-full text-base-content placeholder:text-base-content/60"
                      required
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs opacity-70">The backend now supports local-agent query decomposition before retrieval.</span>
                      <button type="submit" className={`btn btn-sm btn-primary ${loading ? "btn-disabled loading" : ""}`} disabled={loading}>
                        {loading ? "Searching…" : "Search"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {agentMeta && (
                <div className="chat chat-start">
                  <div className="w-full max-w-3xl rounded-2xl bg-base-100 p-4 text-base-content">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                      <span className={`badge ${agentMeta.enabled ? "badge-primary" : "badge-ghost"}`}>
                        Agent {agentMeta.enabled ? "on" : "off"}
                      </span>
                      {agentMeta.round1_status && <span className="badge badge-outline">R1: {agentMeta.round1_status}</span>}
                      {agentMeta.partial_success && <span className="badge badge-warning">partial success</span>}
                      {agentMeta.model && <span className="badge badge-neutral">{agentMeta.model}</span>}
                    </div>
                    {agentMeta.error && <p className="text-sm opacity-80">{agentMeta.error}</p>}
                    {agentMeta.debug?.round1_output && (
                      <pre className="mt-3 max-h-52 overflow-auto rounded bg-base-200 p-3 text-xs">
                        {JSON.stringify(agentMeta.debug.round1_output, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {hasQueryGroups && queryGroups!.map((group) => (
                <div key={group.branch_id} className="chat chat-start">
                  <div className="w-full max-w-3xl rounded-2xl bg-base-100 p-4 text-base-content">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="badge badge-primary">Branch {branchLabel(group.branch_id)}</span>
                      <span className={`badge ${group.status === "success" ? "badge-success" : group.status === "timeout" ? "badge-warning" : "badge-error"}`}>
                        {group.status}
                      </span>
                      <span className="text-xs opacity-70">limit={limit} per group</span>
                    </div>

                    <div className="mb-3 rounded bg-base-200 p-3">
                      <div className="mb-1 text-xs font-medium uppercase tracking-wide opacity-70">Search query</div>
                      <div className="text-sm break-words">{group.search_query || <span className="opacity-60">(none)</span>}</div>
                    </div>

                    {group.error && <div className="alert alert-error mb-3 py-2 text-sm">{group.error}</div>}

                    {group.results?.length ? (
                      <div className="flex flex-col gap-3">
                        {group.results.map((p) => (
                          <div key={`${group.branch_id}:${p.paper_id}`} className="rounded-xl bg-gray-700 p-4 text-gray-100">
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                              <h3 className="font-semibold">{p.title}</h3>
                              <small className="opacity-70">
                                {p.source || ""}
                                {p.paper_date ? ` • ${new Date(p.paper_date).toLocaleDateString()}` : ""}
                              </small>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{p.abstract}</p>
                            <div className="mt-2 flex gap-3">
                              <button onClick={() => navigateToAbstract(p.abstract)} className="btn btn-sm btn-outline btn-primary">
                                Navigate to abstract
                              </button>
                              {p.link && (
                                <a className="btn btn-sm btn-outline btn-primary" href={p.link} target="_blank" rel="noreferrer">
                                  View paper
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded bg-base-200 p-3 text-sm opacity-70">No results for this branch.</div>
                    )}
                  </div>
                </div>
              ))}

              {!hasQueryGroups && results.map((p) => renderPaperCard(p))}

              {!hasQueryGroups && results.length === 0 && !loading && (
                <div className="chat chat-start">
                  <div className="chat-bubble w-full max-w-3xl bg-base-100 text-base-content opacity-70">
                    No results yet. Submit a query above.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

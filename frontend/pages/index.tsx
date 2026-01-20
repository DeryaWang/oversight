import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";

type Paper = {
  paper_id: string;
  title: string;
  abstract: string;
  source?: string | null;
  link?: string | null;
  paper_date?: string | null;
  citation_count?: number;
};

function PaperCard({ p, navigateToAbstract }: { p: Paper; navigateToAbstract: (abstract: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const abstractRef = useRef<HTMLParagraphElement | null>(null);
  const [canToggle, setCanToggle] = useState(false);

  useEffect(() => {
    if (expanded) return;

    const el = abstractRef.current;
    if (!el) return;

    const checkOverflow = () => {
      setCanToggle(el.scrollHeight > el.clientHeight + 1);
    };

    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [p.abstract, expanded]);

  return (
    <div className="card bg-base-200/50 border border-base-300/50 hover:bg-base-200 transition-all duration-200">
      <div className="card-body p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="card-title text-lg font-bold text-primary mb-1">
               <a href={p.link || '#'} target="_blank" rel="noreferrer" className="hover:underline">{p.title}</a>
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-base-content/70 mb-3">
               <span className="badge badge-sm badge-outline font-medium">{p.source || 'Unknown'}</span>
               {p.paper_date && <span>{new Date(p.paper_date).toLocaleDateString()}</span>}
               {p.citation_count !== undefined && (
                 <span className="citation-tooltip-wrapper">
                   <span className="flex items-center gap-1">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                       <path d="M3.288 4.819A1.5 1.5 0 001 6.095v5.855c0 .518.315.963.769 1.216l7.462 3.865a1 1 0 00.94 0l7.462-3.865a1.375 1.375 0 00.769-1.216V6.095a1.5 1.5 0 00-2.288-1.276l-6.416 3.325-6.416-3.325z" />
                       <path d="M3.288 1.5A1.5 1.5 0 001 2.776v1.168l8.308 4.306 8.308-4.306V2.776a1.5 1.5 0 00-2.288-1.276l-6.416 3.325L3.288 1.5z" />
                     </svg>
                     {p.citation_count}
                   </span>
                   <span className="citation-tooltip-bubble">
                     citation
                   </span>
                 </span>
               )}
            </div>
          </div>
          {p.link && (
            <a href={p.link} target="_blank" rel="noreferrer" className="btn btn-square btn-sm btn-ghost opacity-50 hover:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
        </div>

        <div className="relative">
          <p
            ref={abstractRef}
            className={`text-sm leading-relaxed opacity-80 ${expanded ? "" : "abstract-clamp-4 pr-28"}`}
          >
            {p.abstract}
          </p>
          {!expanded && canToggle && (
            <button type="button" onClick={() => setExpanded(true)} className="abstract-toggle-btn">
              Show more
            </button>
          )}
        </div>

        {expanded && canToggle && (
          <div className="flex justify-end">
            <button type="button" onClick={() => setExpanded(false)} className="abstract-toggle-btn-expanded">
              Show less
            </button>
          </div>
        )}

        <div className="card-actions mt-4 justify-end">
          <button 
            className="btn btn-xs btn-outline"
            onClick={() => navigateToAbstract(p.abstract)}
          >
            Find Similar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [text, setText] = useState("");
  // Time Window: default to 5 years (approx 1825 days)
  const [timeDays, setTimeDays] = useState<number>(365 * 5);

  const [limit, setLimit] = useState<number>(10);
  const [sources, setSources] = useState({
    arxiv: true,
    // AI conferences
    ICML: true,
    NeurIPS: true,
    ICLR: true,
    // Systems conferences
    OSDI: true,
    SOSP: true,
    ASPLOS: true,
    ATC: true,
    NSDI: true,
    MLSys: true,
    EuroSys: true,
    VLDB: true
  });
  const [loading, setLoading] = useState(false);
  const lastRequestIdRef = useRef<number>(0);
  const [results, setResults] = useState<Paper[]>([]);
  
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "citation">("relevance");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  // Conference categories
  const aiConferences = ['ICML', 'NeurIPS', 'ICLR'];
  const systemsConferences = ['OSDI', 'SOSP', 'ASPLOS', 'ATC', 'NSDI', 'MLSys', 'EuroSys', 'VLDB'];

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

  const sortedResults = useMemo(() => {
    let res = [...results];
    
    if (sortBy === "relevance") {
        return res;
    }

    return res.sort((a, b) => {
      if (sortBy === "date") {
        const dateA = a.paper_date ? new Date(a.paper_date).getTime() : 0;
        const dateB = b.paper_date ? new Date(b.paper_date).getTime() : 0;
        return sortDirection === "desc" ? dateB - dateA : dateA - dateB;
      }
      if (sortBy === "citation") {
        const countA = a.citation_count || 0;
        const countB = b.citation_count || 0;
        return sortDirection === "desc" ? countB - countA : countA - countB;
      }
      return 0;
    });
  }, [results, sortBy, sortDirection]);

  const isAllAISelected = aiConferences.every(conf => sources[conf as keyof typeof sources]);
  const isAllSystemsSelected = systemsConferences.every(conf => sources[conf as keyof typeof sources]);

  function toggleSource(key: keyof typeof sources) {
    setSources((s) => ({ ...s, [key]: !s[key] }));
  }

  function toggleAllAI() {
    const newValue = !isAllAISelected;
    setSources((s) => {
      const updated = { ...s };
      aiConferences.forEach(conf => { updated[conf as keyof typeof sources] = newValue; });
      return updated;
    });
  }

  function toggleAllSystems() {
    const newValue = !isAllSystemsSelected;
    setSources((s) => {
      const updated = { ...s };
      systemsConferences.forEach(conf => { updated[conf as keyof typeof sources] = newValue; });
      return updated;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    
    setLoading(true);
    setResults([]);

    const reqId = Date.now();
    lastRequestIdRef.current = reqId;

    setTimeout(() => {
      if (lastRequestIdRef.current !== reqId) return;
      
      setResults([
        {
          paper_id: "1",
          title: "Optimizing LLM Inference with Speculative Decoding",
          abstract: "This paper presents a novel approach to speed up LLM inference by leveraging a smaller draft model to generate candidate tokens, which are then verified by the larger target model in parallel. We show that this method can achieve 2-3x speedups on standard benchmarks without compromising generation quality.",
          source: "ICML",
          paper_date: "2023-07-01",
          link: "https://arxiv.org/abs/2301.00001",
          citation_count: 145
        },
        {
          paper_id: "2",
          title: "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness",
          abstract: "We introduce FlashAttention, an IO-aware exact attention algorithm that uses tiling to reduce the number of memory accesses between GPU HBM and on-chip SRAM. FlashAttention trains Transformers faster than existing baselines: 15% end-to-end wall-clock speedup on BERT-large (seqlen 512), 3x speedup on GPT-2 (seqlen 1K), and 2.4x speedup on long-range arena (seqlen 1K-4K).",
          source: "NeurIPS",
          paper_date: "2022-12-01",
          link: "https://arxiv.org/abs/2205.14135",
          citation_count: 890
        },
        {
          paper_id: "3",
          title: "Older Paper Example for Sorting Test",
          abstract: "An older paper to test if date sorting works correctly. This paper discusses fundamental concepts in distributed systems consensus algorithms.",
          source: "OSDI",
          paper_date: "2020-10-15",
          link: "#",
          citation_count: 3200
        },
        {
          paper_id: "4",
          title: "Recent Advances in Graph Neural Networks",
          abstract: "A comprehensive survey of Graph Neural Networks (GNNs) covering various architectures including Graph Convolutional Networks (GCNs), Graph Attention Networks (GATs), and their applications in social network analysis, drug discovery, and recommendation systems.",
          source: "ICLR",
          paper_date: "2024-01-10",
          link: "#",
          citation_count: 12
        },
        {
          paper_id: "5",
          title: "Large Language Models in Healthcare: A Comprehensive Review",
          abstract: "The integration of Large Language Models (LLMs) into healthcare systems presents both transformative opportunities and significant challenges. This review explores the current state of LLM applications in medical diagnosis, patient record analysis, and drug discovery. We analyze the performance of various models including GPT-4, Med-PaLM, and others across a range of medical benchmarks. Furthermore, we discuss critical ethical considerations such as data privacy, bias in model outputs, and the necessity for human-in-the-loop verification systems. The paper also proposes a new framework for evaluating the clinical safety of LLMs before deployment. Our findings suggest that while LLMs demonstrate remarkable potential in assisting healthcare professionals, substantial work remains in ensuring their reliability and explainability in critical medical contexts. We conclude with a roadmap for future research directions in medical AI.",
          source: "Nature Medicine",
          paper_date: "2024-02-15",
          link: "#",
          citation_count: 45
        },
      ]);
      setLoading(false);
    }, 600);
  }

  function navigateToAbstract(abstract: string) {
    setText(abstract);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      onSubmit({ preventDefault: () => {} } as React.FormEvent);
    }, 100);
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-base-100 font-sans text-base-content">
      <Head>
        <title>Oversight - Academic Search</title>
        <meta name="description" content="Embeddings-backed academic paper search" />
      </Head>

      <div className="grid h-screen grid-rows-[auto,1fr]">
        {/* Header */}
        <header className="border-b border-base-300 bg-base-200/50 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-content font-bold">
                O
              </div>
              <h1 className="text-xl font-bold">Oversight</h1>
            </div>
            
            <button 
              className="btn btn-sm btn-ghost btn-circle"
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? "切换到浅色模式" : "切换到深色模式"}
            >
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Main Layout */}
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 px-6 py-6 md:grid-cols-[300px,1fr]">
          
          {/* Sidebar */}
          <aside className="flex flex-col gap-6 overflow-y-auto pr-2">
            
            {/* Filters */}
            <div className="rounded-xl bg-base-200 p-4 shadow-sm">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider opacity-70">Filters</h3>
              
              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text">Lookback window</span>
                  <span className="label-text-alt text-primary font-medium">{timeLabel}</span>
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
                <div className="flex justify-between px-2 text-xs opacity-60 mt-1 font-mono">
                  <span>1w</span>
                  <span>1m</span>
                  <span>1y</span>
                  <span>10y</span>
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Max results</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={limit}
                    onChange={(e) => {
                       const val = parseInt(e.target.value);
                       if (!isNaN(val)) setLimit(val);
                    }}
                    className="input input-bordered input-xs w-16 text-center"
                  />
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
                <div className="flex justify-between px-2 text-xs opacity-60 mt-1 font-mono">
                  <span>1</span>
                  <span>25</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-base-200 p-4 shadow-sm flex-1">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider opacity-70">Sources</h3>
              
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-3 rounded hover:bg-base-300/50 p-1">
                  <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={sources.arxiv} onChange={() => toggleSource("arxiv")} />
                  <span className="text-sm">arXiv</span>
                </label>

                <div className="divider my-1"></div>
                
                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-3 py-1 hover:bg-base-300/50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-secondary" 
                      checked={isAllAISelected}
                      onChange={toggleAllAI}
                    />
                    <span className="text-sm font-semibold">AI / ML</span>
                  </label>
                  <div className="pl-6 space-y-1">
                    {aiConferences.map(conf => (
                      <label key={conf} className="flex cursor-pointer items-center gap-3 hover:bg-base-300/50 p-1 rounded">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={sources[conf as keyof typeof sources]}
                          onChange={() => toggleSource(conf as keyof typeof sources)}
                        />
                        <span className="text-sm opacity-80">{conf}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="divider my-1"></div>

                <div className="space-y-1">
                  <label className="flex cursor-pointer items-center gap-3 py-1 hover:bg-base-300/50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-xs checkbox-secondary" 
                      checked={isAllSystemsSelected}
                      onChange={toggleAllSystems}
                    />
                    <span className="text-sm font-semibold">Systems</span>
                  </label>
                  <div className="pl-6 space-y-1">
                    {systemsConferences.map(conf => (
                      <label key={conf} className="flex cursor-pointer items-center gap-3 hover:bg-base-300/50 p-1 rounded">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs checkbox-primary"
                          checked={sources[conf as keyof typeof sources]}
                          onChange={() => toggleSource(conf as keyof typeof sources)}
                        />
                        <span className="text-sm opacity-80">{conf}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex flex-col gap-4 overflow-hidden h-[calc(100vh-100px)]">
            
            {/* Search Box Area */}
            <div className="flex-none">
              <div className="relative">
                <form onSubmit={onSubmit}>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        onSubmit(e);
                      }
                    }}
                    placeholder="Describe what you are looking for..."
                    className="textarea textarea-bordered w-full bg-base-200 text-base shadow-sm placeholder:opacity-50 focus:border-primary focus:outline-none min-h-[100px] resize-none py-3 px-4 rounded-xl"
                  />
                  <button 
                    type="submit"
                    className="absolute bottom-3 right-3 btn btn-primary btn-sm rounded-lg"
                    disabled={loading}
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>
                </form>
              </div>
            </div>

            {/* Toolbar */}
            {results.length > 0 && (
              <div className="flex flex-none items-center justify-between px-1">
                <span className="text-sm opacity-60">{results.length} results found</span>
                
                {/* Custom Sort Pill Button */}
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-sm btn-outline gap-2 rounded-full border-base-300 bg-base-100 hover:bg-base-200 hover:border-base-content/20 normal-case font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="21" x2="3" y1="6" y2="6"></line>
                      <line x1="15" x2="3" y1="12" y2="12"></line>
                      <line x1="9" x2="3" y1="18" y2="18"></line>
                    </svg>
                    Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu menu-sm p-2 shadow bg-base-200 rounded-box w-40 z-10 mt-1">
                    <li><a className={sortBy === 'relevance' ? 'active' : ''} onClick={() => { setSortBy('relevance'); (document.activeElement as HTMLElement)?.blur(); }}>Relevance</a></li>
                    <li><a className={sortBy === 'date' ? 'active' : ''} onClick={() => { setSortBy('date'); setSortDirection('desc'); (document.activeElement as HTMLElement)?.blur(); }}>Date</a></li>
                    <li><a className={sortBy === 'citation' ? 'active' : ''} onClick={() => { setSortBy('citation'); setSortDirection('desc'); (document.activeElement as HTMLElement)?.blur(); }}>Citations</a></li>
                  </ul>
                </div>
              </div>
            )}

            {/* Results List */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-10 custom-scrollbar">
              {sortedResults.map((p) => (
                <PaperCard key={p.paper_id} p={p} navigateToAbstract={navigateToAbstract} />
              ))}

              {results.length === 0 && !loading && (
                <div className="flex h-full flex-col items-center justify-center text-center opacity-30 mt-20">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                   </svg>
                   <p className="text-lg font-medium">No papers selected</p>
                </div>
              )}

              {loading && (
                <div className="flex h-full flex-col items-center justify-center text-center mt-20">
                   <div className="loader"></div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

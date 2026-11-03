import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Lightbulb,
  Clock,
  Layers,
  Filter,
  Check,
  RotateCcw,
  BookMarked
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { loadFromStorage, saveToStorage } from '../utils/helpers';

export function DeeperConceptsSection({ subject }) {
  const [concepts, setConcepts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedArticles, setExpandedArticles] = useState({});

  const storageKey = `flashlearn_deep_progress_${subject.id}`;
  const [masteredProgress, setMasteredProgress] = useState(() => {
    return loadFromStorage(storageKey, {});
  });

  // Load Deeper Concepts JSON
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const targetFile = subject.deepFile || `${subject.id}.deep.json`;

    async function loadData() {
      try {
        const res = await fetch(`/data/${targetFile}`);
        if (!res.ok) {
          throw new Error(`Could not load Deeper Concepts data: ${targetFile}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          const list = Array.isArray(data) ? data : [];
          setConcepts(list);
          setIsLoading(false);
          // Expand first concept by default
          if (list.length > 0) {
            setExpandedArticles({ [list[0].id]: true });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error loading deeper concepts:', err);
          setError(`Unable to load deeper concepts for ${subject.name}. File might not exist yet.`);
          setConcepts([]);
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [subject.id, subject.deepFile, subject.name]);

  // Categories
  const availableCategories = useMemo(() => {
    const cats = new Set();
    concepts.forEach((c) => {
      if (c.category) cats.add(c.category);
    });
    return ['All', ...Array.from(cats)];
  }, [concepts]);

  // Filtered concepts
  const filteredConcepts = useMemo(() => {
    return concepts.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title?.toLowerCase().includes(q);
        const inOverview = item.overview?.toLowerCase().includes(q);
        const inCategory = item.category?.toLowerCase().includes(q);
        const inDeep = item.deepDive?.some(
          (d) =>
            d.subheading?.toLowerCase().includes(q) ||
            d.explanation?.toLowerCase().includes(q) ||
            d.codeExample?.toLowerCase().includes(q)
        );
        const inPitfalls = item.edgeCasesAndPitfalls?.some((p) =>
          p.toLowerCase().includes(q)
        );
        if (!inTitle && !inOverview && !inCategory && !inDeep && !inPitfalls) {
          return false;
        }
      }
      return true;
    });
  }, [concepts, selectedCategory, searchQuery]);

  // Toggle master status
  const toggleMastered = (e, id) => {
    e.stopPropagation();
    setMasteredProgress((prev) => {
      const current = prev[id]?.mastered;
      const next = {
        ...prev,
        [id]: {
          mastered: !current,
          lastUpdated: new Date().toISOString(),
        },
      };
      saveToStorage(storageKey, next);
      return next;
    });
  };

  const toggleExpand = (id) => {
    setExpandedArticles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const next = {};
    filteredConcepts.forEach((c) => {
      next[c.id] = true;
    });
    setExpandedArticles(next);
  };

  const collapseAll = () => {
    setExpandedArticles({});
  };

  // Progress stats
  const progressStats = useMemo(() => {
    let count = 0;
    filteredConcepts.forEach((c) => {
      if (masteredProgress[c.id]?.mastered) count++;
    });
    const total = filteredConcepts.length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { count, total, pct };
  }, [filteredConcepts, masteredProgress]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
          Loading Deeper Concepts for {subject.name}...
        </p>
      </div>
    );
  }

  if (error || concepts.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center space-y-3">
        <Sparkles className="w-8 h-8 text-primary mx-auto" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Deeper Concepts Section
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
          {error || `No deeper concept articles configured yet for ${subject.name}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner / Progress Hub */}
      <div className="bg-gradient-to-r from-primary-subtle/50 via-white to-slate-50 dark:from-zinc-900/90 dark:via-zinc-900 dark:to-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Deeper Concepts & Architectural Walkthroughs
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border">
                {filteredConcepts.length} In-depth Guides
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Long-form architectural deep dives with under-the-hood diagrams, progressive code walkthroughs, runtime traps, and engine mechanics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium">Mastered: </span>
              <span className="font-bold text-slate-900 dark:text-white text-xs">
                {progressStats.count} / {progressStats.total}
              </span>
              <span className="text-slate-400 dark:text-zinc-500 text-[11px] ml-1">
                ({progressStats.pct}%)
              </span>
            </div>
            <div className="w-20 sm:w-28 h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressStats.pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {availableCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deep dive concepts..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100/90 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-zinc-800 pl-2">
              <button
                onClick={expandAll}
                className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Expand All"
              >
                Expand
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Collapse All"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-4">
        {filteredConcepts.map((item, idx) => {
          const isExpanded = !!expandedArticles[item.id];
          const isMastered = !!masteredProgress[item.id]?.mastered;

          return (
            <article
              key={item.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isMastered
                  ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/5'
                  : 'border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => toggleExpand(item.id)}
                className="flex items-start justify-between gap-3 p-4 sm:p-5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-zinc-850/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => toggleMastered(e, item.id)}
                    className="mt-0.5 text-slate-300 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    title={isMastered ? 'Mark as studying' : 'Mark as mastered'}
                  >
                    {isMastered ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                        {item.category || 'Architecture'}
                      </span>
                      {item.readTimeMinutes && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-zinc-400">
                          <Clock className="w-3 h-3" />
                          <span>{item.readTimeMinutes} min read</span>
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                        #{item.id}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 line-clamp-2">
                      {item.overview}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <div className="p-1 rounded-lg text-slate-400 dark:text-zinc-500">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded In-Depth Article Content */}
              {isExpanded && (
                <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-6">
                  {/* Overview Full Callout */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-850/80 border border-slate-200/80 dark:border-zinc-750 text-xs sm:text-sm text-slate-700 dark:text-zinc-200 leading-relaxed">
                    <p className="font-semibold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Executive Summary & Context
                    </p>
                    {item.overview}
                  </div>

                  {/* Architecture Diagram if available */}
                  {item.diagram && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        Architectural Flow & Lifecycle Diagram
                      </h4>
                      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                        {item.diagram}
                      </div>
                    </div>
                  )}

                  {/* Deep Dive Subsections & Progressive Code */}
                  {item.deepDive && item.deepDive.length > 0 && (
                    <div className="space-y-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        In-Depth Technical Breakdown
                      </h4>

                      {item.deepDive.map((sub, sIdx) => (
                        <div
                          key={sIdx}
                          className="space-y-3 p-4 rounded-xl bg-slate-50/60 dark:bg-zinc-850/40 border border-slate-200/60 dark:border-zinc-800"
                        >
                          <h5 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text text-[11px] flex items-center justify-center font-bold">
                              {sIdx + 1}
                            </span>
                            {sub.subheading}
                          </h5>

                          <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                            {sub.explanation}
                          </p>

                          {sub.codeExample && (
                            <div className="pt-1">
                              <CodeViewer code={sub.codeExample} language="javascript" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pitfalls & Edge Cases Callout */}
                  {item.edgeCasesAndPitfalls && item.edgeCasesAndPitfalls.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span>Common Runtime Traps & Hidden Pitfalls</span>
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {item.edgeCasesAndPitfalls.map((pitfall, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{pitfall}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Key Takeaways */}
                  {item.keyTakeaways && item.keyTakeaways.length > 0 && (
                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span>Key Architectural Takeaways</span>
                      </div>
                      <ul className="space-y-1.5 text-xs">
                        {item.keyTakeaways.map((takeaway, tIdx) => (
                          <li key={tIdx} className="flex items-start gap-2">
                            <span className="text-emerald-500 font-bold">✓</span>
                            <span>{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Footer Mastered Button */}
                  <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      onClick={(e) => toggleMastered(e, item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        isMastered
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {isMastered ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Concept Mastered</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4" />
                          <span>Mark as Mastered</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

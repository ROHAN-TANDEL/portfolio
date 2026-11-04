import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Code2,
  CheckCircle2,
  Circle,
  Sparkles,
  Tag,
  Layers,
  Terminal,
  Check,
  AlertCircle,
  Copy,
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { loadFromStorage, saveToStorage } from '../utils/helpers';

export function ExamplesSection({ subject }) {
  const [examples, setExamples] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedConceptTag, setSelectedConceptTag] = useState('All');
  const [expandedExamples, setExpandedExamples] = useState({});

  const storageKey = `flashlearn_examples_progress_${subject.id}`;
  const [practicedProgress, setPracticedProgress] = useState(() => {
    return loadFromStorage(storageKey, {});
  });

  // Load Examples JSON
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const targetFile = subject.examplesFile || `${subject.id}.examples.json`;

    async function loadData() {
      try {
        const res = await fetch(`/data/${targetFile}`);
        if (!res.ok) {
          throw new Error(`Could not load Examples data file: ${targetFile}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          const list = Array.isArray(data) ? data : [];
          setExamples(list);
          setIsLoading(false);
          // Expand first example by default
          if (list.length > 0) {
            setExpandedExamples({ [list[0].id]: true });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error loading examples data:', err);
          setError(`Unable to load examples for ${subject.name}. File might not exist yet.`);
          setExamples([]);
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [subject.id, subject.examplesFile, subject.name]);

  // Categories
  const availableCategories = useMemo(() => {
    const cats = new Set();
    examples.forEach((ex) => {
      if (ex.category) cats.add(ex.category);
    });
    return ['All', ...Array.from(cats)];
  }, [examples]);

  // All Concept Tags
  const allConceptTags = useMemo(() => {
    const tags = new Set();
    examples.forEach((ex) => {
      if (Array.isArray(ex.conceptsCovered)) {
        ex.conceptsCovered.forEach((t) => tags.add(t));
      }
    });
    return ['All', ...Array.from(tags)];
  }, [examples]);

  // Filtered Examples
  const filteredExamples = useMemo(() => {
    return examples.filter((ex) => {
      if (selectedCategory !== 'All' && ex.category !== selectedCategory) {
        return false;
      }
      if (selectedDifficulty !== 'All' && ex.difficulty !== selectedDifficulty) {
        return false;
      }
      if (
        selectedConceptTag !== 'All' &&
        (!Array.isArray(ex.conceptsCovered) || !ex.conceptsCovered.includes(selectedConceptTag))
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = ex.title?.toLowerCase().includes(q);
        const inCover = ex.whatThisCodeCovers?.toLowerCase().includes(q);
        const inCategory = ex.category?.toLowerCase().includes(q);
        const inCode = ex.code?.toLowerCase().includes(q);
        const inTags = ex.conceptsCovered?.some((t) => t.toLowerCase().includes(q));
        const inBreakdown = ex.breakdown?.some(
          (b) => b.note?.toLowerCase().includes(q) || b.lineRange?.toLowerCase().includes(q)
        );
        if (!inTitle && !inCover && !inCategory && !inCode && !inTags && !inBreakdown) {
          return false;
        }
      }

      return true;
    });
  }, [examples, selectedCategory, selectedDifficulty, selectedConceptTag, searchQuery]);

  // Toggle practiced
  const togglePracticed = (e, id) => {
    e.stopPropagation();
    setPracticedProgress((prev) => {
      const current = prev[id]?.practiced;
      const next = {
        ...prev,
        [id]: {
          practiced: !current,
          lastUpdated: new Date().toISOString(),
        },
      };
      saveToStorage(storageKey, next);
      return next;
    });
  };

  const toggleExpand = (id) => {
    setExpandedExamples((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const next = {};
    filteredExamples.forEach((ex) => {
      next[ex.id] = true;
    });
    setExpandedExamples(next);
  };

  const collapseAll = () => {
    setExpandedExamples({});
  };

  // Progress stats
  const progressStats = useMemo(() => {
    let count = 0;
    filteredExamples.forEach((ex) => {
      if (practicedProgress[ex.id]?.practiced) count++;
    });
    const total = filteredExamples.length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { count, total, pct };
  }, [filteredExamples, practicedProgress]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
          Loading Applied Examples for {subject.name}...
        </p>
      </div>
    );
  }

  if (error || examples.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center space-y-3">
        <Code2 className="w-8 h-8 text-primary mx-auto" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Examples Hub Section
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
          {error || `No applied code examples configured yet for ${subject.name}.`}
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
              <Code2 className="w-5 h-5 text-primary" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Applied Code Examples & Combinations
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border">
                {filteredExamples.length} Examples
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Real-world code examples synthesizing multiple concepts. Every item highlights what the code covers and lists exact architectural concepts exercised.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium">Practiced: </span>
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
        <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-zinc-800 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">Difficulty:</span>
              {['All', 'Beginner', 'Intermediate', 'Advanced'].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    selectedDifficulty === diff
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Search Box */}
            <div className="relative flex-1 sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search examples by concept, topic, or code..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100/90 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary"
              />
            </div>

            {/* Expand / Collapse */}
            <div className="flex items-center gap-1">
              <button
                onClick={expandAll}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Examples List */}
      <div className="space-y-4">
        {filteredExamples.map((item) => {
          const isExpanded = !!expandedExamples[item.id];
          const isPracticed = !!practicedProgress[item.id]?.practiced;

          const diffColor =
            item.difficulty === 'Advanced'
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              : item.difficulty === 'Intermediate'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';

          return (
            <article
              key={item.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isPracticed
                  ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/5'
                  : 'border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => toggleExpand(item.id)}
                className="flex items-start justify-between gap-3 p-4 sm:p-5 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => togglePracticed(e, item.id)}
                    className="mt-0.5 text-slate-300 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    title={isPracticed ? 'Mark as studying' : 'Mark as practiced'}
                  >
                    {isPracticed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 uppercase tracking-wider">
                        {item.category || 'Example'}
                      </span>
                      {item.difficulty && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${diffColor}`}>
                          {item.difficulty}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                        #{item.id}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {item.title}
                    </h3>

                    {/* What this code covers preview */}
                    {item.whatThisCodeCovers && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 line-clamp-2">
                        <strong className="text-slate-800 dark:text-zinc-200">Covers: </strong>
                        {item.whatThisCodeCovers}
                      </p>
                    )}

                    {/* Concepts Covered Badges */}
                    {item.conceptsCovered && item.conceptsCovered.length > 0 && (
                      <div className="flex items-center flex-wrap gap-1.5 pt-1">
                        {item.conceptsCovered.map((concept, cIdx) => (
                          <span
                            key={cIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {concept}
                          </span>
                        ))}
                      </div>
                    )}
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

              {/* Expanded Example Body */}
              {isExpanded && (
                <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-5">
                  {/* What This Code Covers Detailed Box */}
                  <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-950 dark:text-blue-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-blue-800 dark:text-blue-300">
                      <Bookmark className="w-4 h-4 text-blue-500" />
                      <span>What This Code Covers & Solves</span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-blue-900 dark:text-blue-100">
                      {item.whatThisCodeCovers}
                    </p>
                  </div>

                  {/* Code Viewer */}
                  {item.code && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-primary" />
                          Complete Implementation
                        </span>
                      </div>
                      <CodeViewer code={item.code} language="javascript" />
                    </div>
                  )}

                  {/* Step-by-Step Architectural Breakdown */}
                  {item.breakdown && item.breakdown.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        Key Code & Architectural Breakdown
                      </h4>
                      <div className="space-y-2">
                        {item.breakdown.map((b, bIdx) => (
                          <div
                            key={bIdx}
                            className="p-3 rounded-xl bg-slate-50/90 dark:bg-zinc-950/60 border border-slate-200/70 dark:border-zinc-800 flex items-start gap-3 text-xs"
                          >
                            {b.lineRange && (
                              <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                L{b.lineRange}
                              </span>
                            )}
                            <p className="text-slate-700 dark:text-zinc-300 leading-relaxed flex-1">
                              {b.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expected Output / Runtime Behavior */}
                  {item.expectedOutput && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-primary" />
                        Expected Output / Runtime Telemetry
                      </h4>
                      <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                        {item.expectedOutput}
                      </div>
                    </div>
                  )}

                  {/* Footer Practiced Button */}
                  <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      onClick={(e) => togglePracticed(e, item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        isPracticed
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {isPracticed ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Code Example Practiced</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4" />
                          <span>Mark as Practiced</span>
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

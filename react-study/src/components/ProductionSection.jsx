import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Server,
  ShieldAlert,
  Activity,
  CheckSquare,
  Square,
  AlertOctagon,
  CheckCircle2,
  Circle,
  Cpu,
  Layers,
  Terminal,
  FileCheck
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { loadFromStorage, saveToStorage } from '../utils/helpers';

export function ProductionSection({ subject }) {
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedTopics, setExpandedTopics] = useState({});

  // Checklist item checks: storageKey -> { [itemId]: boolean }
  const checklistStorageKey = `flashlearn_prod_checklist_${subject.id}`;
  const [checkedChecklist, setCheckedChecklist] = useState(() => {
    return loadFromStorage(checklistStorageKey, {});
  });

  // Topic mastery: storageKey -> { [topicId]: { mastered: boolean, lastUpdated: string } }
  const progressStorageKey = `flashlearn_prod_progress_${subject.id}`;
  const [topicProgress, setTopicProgress] = useState(() => {
    return loadFromStorage(progressStorageKey, {});
  });

  // Load Production JSON
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const targetFile = subject.productionFile || `${subject.id}.production.json`;

    async function loadData() {
      try {
        const res = await fetch(`/data/${targetFile}`);
        if (!res.ok) {
          throw new Error(`Could not load Production data: ${targetFile}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          const list = Array.isArray(data) ? data : [];
          setTopics(list);
          setIsLoading(false);
          // Expand first topic by default
          if (list.length > 0) {
            setExpandedTopics({ [list[0].id]: true });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error loading production data:', err);
          setError(`Unable to load production concepts for ${subject.name}. File might not exist yet.`);
          setTopics([]);
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [subject.id, subject.productionFile, subject.name]);

  // Categories
  const availableCategories = useMemo(() => {
    const cats = new Set();
    topics.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return ['All', ...Array.from(cats)];
  }, [topics]);

  // Filtered Topics
  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      if (selectedCategory !== 'All' && t.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTopic = t.topic?.toLowerCase().includes(q);
        const inCategory = t.category?.toLowerCase().includes(q);
        const inProblem = t.theProblem?.toLowerCase().includes(q);
        const inInternal = t.howItWorksInternally?.toLowerCase().includes(q);
        const inCode = t.productionCode?.toLowerCase().includes(q);
        const inCheck = t.productionChecklist?.some((c) => c.toLowerCase().includes(q));
        if (!inTopic && !inCategory && !inProblem && !inInternal && !inCode && !inCheck) {
          return false;
        }
      }
      return true;
    });
  }, [topics, selectedCategory, searchQuery]);

  // Toggle checklist item
  const toggleChecklistItem = (topicId, idx) => {
    const key = `${topicId}_${idx}`;
    setCheckedChecklist((prev) => {
      const next = {
        ...prev,
        [key]: !prev[key],
      };
      saveToStorage(checklistStorageKey, next);
      return next;
    });
  };

  // Toggle topic master status
  const toggleTopicMastered = (e, topicId) => {
    e.stopPropagation();
    setTopicProgress((prev) => {
      const current = prev[topicId]?.mastered;
      const next = {
        ...prev,
        [topicId]: {
          mastered: !current,
          lastUpdated: new Date().toISOString(),
        },
      };
      saveToStorage(progressStorageKey, next);
      return next;
    });
  };

  const toggleExpand = (id) => {
    setExpandedTopics((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const next = {};
    filteredTopics.forEach((t) => {
      next[t.id] = true;
    });
    setExpandedTopics(next);
  };

  const collapseAll = () => {
    setExpandedTopics({});
  };

  // Progress stats
  const progressStats = useMemo(() => {
    let count = 0;
    filteredTopics.forEach((t) => {
      if (topicProgress[t.id]?.mastered) count++;
    });
    const total = filteredTopics.length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { count, total, pct };
  }, [filteredTopics, topicProgress]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
          Loading Production Engineering Guide for {subject.name}...
        </p>
      </div>
    );
  }

  if (error || topics.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-center space-y-3">
        <Server className="w-8 h-8 text-primary mx-auto" />
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Production Mastery Section
        </h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
          {error || `No production-level guides configured yet for ${subject.name}.`}
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
              <Server className="w-5 h-5 text-primary" />
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Production Engineering & Battle-Tested Reliability
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border">
                {filteredTopics.length} Production Systems
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Crucial production mechanics: failure modes, high availability, telemetry metrics, zero-downtime orchestration, and hardened checklists.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium">Readiness: </span>
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
                placeholder="Search production patterns..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100/90 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-1 border-l border-slate-200 dark:border-zinc-800 pl-2">
              <button
                onClick={expandAll}
                className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Expand
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Collapse
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Production Topics List */}
      <div className="space-y-4">
        {filteredTopics.map((item) => {
          const isExpanded = !!expandedTopics[item.id];
          const isMastered = !!topicProgress[item.id]?.mastered;

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
                    onClick={(e) => toggleTopicMastered(e, item.id)}
                    className="mt-0.5 text-slate-300 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                    title={isMastered ? 'Mark as reviewing' : 'Mark as production-ready'}
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
                        {item.category || 'Production'}
                      </span>
                      {item.severity && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          {item.severity}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">
                        #{item.id}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {item.topic}
                    </h3>

                    {/* Challenge summary preview */}
                    {item.theProblem && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 line-clamp-2">
                        {item.theProblem}
                      </p>
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

              {/* Expanded Production Topic Body */}
              {isExpanded && (
                <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-6">
                  {/* The Production Challenge / Failure Mode */}
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-950 dark:text-rose-200 space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-rose-700 dark:text-rose-300">
                      <AlertOctagon className="w-4 h-4 text-rose-500" />
                      <span>The Production Challenge & Silent Failure Mode</span>
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-rose-900 dark:text-rose-100">
                      {item.theProblem}
                    </p>
                  </div>

                  {/* How it Works Internally */}
                  {item.howItWorksInternally && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-primary" />
                        How It Works Internally (Engine / OS Mechanics)
                      </h4>
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-850/70 border border-slate-200/80 dark:border-zinc-800 text-xs sm:text-sm text-slate-700 dark:text-zinc-200 leading-relaxed whitespace-pre-line">
                        {item.howItWorksInternally}
                      </div>
                    </div>
                  )}

                  {/* Hardened Production Code */}
                  {item.productionCode && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-primary" />
                        Hardened Production Implementation
                      </h4>
                      <CodeViewer code={item.productionCode} language="javascript" />
                    </div>
                  )}

                  {/* Observability & Health Metrics */}
                  {item.monitoringMetrics && item.monitoringMetrics.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                        Observability, Telemetry & Critical Alert Thresholds
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {item.monitoringMetrics.map((metric, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-3 rounded-xl bg-slate-50/80 dark:bg-zinc-850/60 border border-slate-200/60 dark:border-zinc-800 text-xs flex items-center gap-2.5 font-mono text-slate-800 dark:text-zinc-200"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{metric}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Production Checklist */}
                  {item.productionChecklist && item.productionChecklist.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-primary" />
                        Production Readiness Checklist & Deployment Rules
                      </h4>
                      <div className="space-y-2">
                        {item.productionChecklist.map((rule, rIdx) => {
                          const isChecked = !!checkedChecklist[`${item.id}_${rIdx}`];
                          return (
                            <div
                              key={rIdx}
                              onClick={() => toggleChecklistItem(item.id, rIdx)}
                              className={`p-3 rounded-xl border flex items-start gap-3 text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                                  : 'bg-slate-50 dark:bg-zinc-850/60 border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <div className="mt-0.5 text-slate-400 dark:text-zinc-500">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </div>
                              <span className="leading-relaxed flex-1">{rule}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Footer Mastered Button */}
                  <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      onClick={(e) => toggleTopicMastered(e, item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                        isMastered
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {isMastered ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Production Pattern Verified</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4" />
                          <span>Mark as Production-Ready</span>
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

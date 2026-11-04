import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  HelpCircle,
  Sparkles,
  Lightbulb,
  Code2,
  Filter,
  Layers,
  SlidersHorizontal,
  RefreshCw,
  AlertCircle,
  Check,
  Award,
  List,
  LayoutGrid
} from 'lucide-react';
import { CodeViewer } from './CodeViewer';
import { loadFromStorage, saveToStorage } from '../utils/helpers';

export function QuestionAnswerSection({
  subject,
  viewMode = 'list',
  onToggleViewMode
}) {
  const [qaList, setQaList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sub-sections: 'all' | 'interview' | 'faq'
  const [activeSection, setActiveSection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [expandedCards, setExpandedCards] = useState({});

  // Decoupled QA Progress: subjectId -> { [id]: { practiced: boolean, date: string } }
  const storageKey = `flashlearn_qa_progress_${subject.id}`;
  const [qaProgress, setQaProgress] = useState(() => {
    return loadFromStorage(storageKey, {});
  });

  // Load QA file
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    const targetFile = subject.qaFile || `${subject.id}.qa.json`;

    async function loadQA() {
      try {
        const res = await fetch(`/data/${targetFile}`);
        if (!res.ok) {
          throw new Error(`Could not load Q&A data file: ${targetFile}`);
        }
        const data = await res.json();
        if (!isCancelled) {
          const list = Array.isArray(data) ? data : [];
          setQaList(list);
          setIsLoading(false);
          // Expand first card by default if available in list mode
          if (list.length > 0 && Object.keys(expandedCards).length === 0) {
            setExpandedCards({ [list[0].id]: true });
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error loading QA data:', err);
          setError(`Unable to load questions for ${subject.name}. File might not exist yet.`);
          setQaList([]);
          setIsLoading(false);
        }
      }
    }

    loadQA();
    return () => {
      isCancelled = true;
    };
  }, [subject.id, subject.qaFile, subject.name]);

  // Section Counts
  const counts = useMemo(() => {
    let all = qaList.length;
    let interview = 0;
    let faq = 0;

    qaList.forEach((item) => {
      if (item.isInterview || item.section === 'interview' || item.tags?.includes('interview')) {
        interview += 1;
      }
      if (item.isFaq || item.section === 'faq' || item.tags?.includes('faq')) {
        faq += 1;
      }
    });

    return { all, interview, faq };
  }, [qaList]);

  // Categories for currently selected section
  const availableCategories = useMemo(() => {
    const set = new Set();
    qaList.forEach((item) => {
      const matchesSection =
        activeSection === 'all' ||
        (activeSection === 'interview' && (item.isInterview || item.section === 'interview' || item.tags?.includes('interview'))) ||
        (activeSection === 'faq' && (item.isFaq || item.section === 'faq' || item.tags?.includes('faq')));

      if (matchesSection && item.category) {
        set.add(item.category);
      }
    });
    return ['All', ...Array.from(set).sort()];
  }, [qaList, activeSection]);

  // Reset category if not available when section changes
  useEffect(() => {
    if (selectedCategory !== 'All' && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [availableCategories, selectedCategory]);

  // Filtered Cards
  const displayedCards = useMemo(() => {
    return qaList.filter((item) => {
      // Section filter
      if (activeSection === 'interview') {
        const isInterview = item.isInterview || item.section === 'interview' || item.tags?.includes('interview');
        if (!isInterview) return false;
      } else if (activeSection === 'faq') {
        const isFaq = item.isFaq || item.section === 'faq' || item.tags?.includes('faq');
        if (!isFaq) return false;
      }

      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Difficulty filter
      if (selectedDifficulty !== 'All' && item.difficulty !== selectedDifficulty) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inConcept = item.concept?.toLowerCase().includes(q);
        const inQuestion = item.question?.toLowerCase().includes(q);
        const inQuick = item.quickAnswer?.toLowerCase().includes(q);
        const inDetail = item.detailedAnswer?.toLowerCase().includes(q);
        const inCategory = item.category?.toLowerCase().includes(q);
        const inCode = item.code?.toLowerCase().includes(q);
        const inTags = item.tags?.some((t) => t.toLowerCase().includes(q));
        if (!inConcept && !inQuestion && !inQuick && !inDetail && !inCategory && !inCode && !inTags) {
          return false;
        }
      }

      return true;
    });
  }, [qaList, activeSection, selectedCategory, selectedDifficulty, searchQuery]);

  // Mastery & Practice toggling
  const togglePracticed = (e, cardId) => {
    e.stopPropagation();
    setQaProgress((prev) => {
      const current = prev[cardId]?.practiced;
      const next = {
        ...prev,
        [cardId]: {
          practiced: !current,
          lastUpdated: new Date().toISOString(),
        },
      };
      saveToStorage(storageKey, next);
      return next;
    });
  };

  // Section level practiced stats
  const practicedStats = useMemo(() => {
    let practicedCount = 0;
    displayedCards.forEach((c) => {
      if (qaProgress[c.id]?.practiced) {
        practicedCount += 1;
      }
    });
    const total = displayedCards.length;
    const pct = total > 0 ? Math.round((practicedCount / total) * 100) : 0;
    return { practicedCount, total, pct };
  }, [displayedCards, qaProgress]);

  const toggleExpand = (cardId) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  const expandAll = () => {
    const next = {};
    displayedCards.forEach((c) => {
      next[c.id] = true;
    });
    setExpandedCards(next);
  };

  const collapseAll = () => {
    setExpandedCards({});
  };

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-zinc-400">
        <RefreshCw className="w-7 h-7 animate-spin text-primary" />
        <p className="text-xs font-semibold">Loading questions and answers repository...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="text-sm font-bold text-rose-800 dark:text-rose-200">Unable to load Q&A</h3>
        <p className="text-xs text-rose-600 dark:text-rose-300/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 3 Sub-Section Tabs: All Questions | Interview Questions | Frequently Asked */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-slate-100/90 dark:bg-zinc-900/90 rounded-2xl border border-slate-200/90 dark:border-zinc-800">
        
        <div className="flex items-center gap-1.5 flex-wrap">
          
          {/* 1. All Questions */}
          <button
            onClick={() => setActiveSection('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeSection === 'all'
                ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs ring-1 ring-slate-200 dark:ring-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All Questions</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeSection === 'all'
                ? 'bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text'
                : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
            }`}>
              {counts.all}
            </span>
          </button>

          {/* 2. Interview Questions */}
          <button
            onClick={() => setActiveSection('interview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeSection === 'interview'
                ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs ring-1 ring-slate-200 dark:ring-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Interview Questions</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeSection === 'interview'
                ? 'bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text'
                : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
            }`}>
              {counts.interview}
            </span>
          </button>

          {/* 3. Frequently Asked Questions */}
          <button
            onClick={() => setActiveSection('faq')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeSection === 'faq'
                ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs ring-1 ring-slate-200 dark:ring-zinc-700'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Frequently Asked</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
              activeSection === 'faq'
                ? 'bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text'
                : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
            }`}>
              {counts.faq}
            </span>
          </button>

        </div>

        {/* Section Progress indicator */}
        <div className="flex items-center gap-3 px-3 py-1 text-xs">
          <div className="text-right">
            <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium">Practiced: </span>
            <span className="font-bold text-slate-900 dark:text-white">
              {practicedStats.practicedCount} / {practicedStats.total}
            </span>
            <span className="text-slate-400 dark:text-zinc-500 text-[11px] ml-1">
              ({practicedStats.pct}%)
            </span>
          </div>
          <div className="w-20 sm:w-24 h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${practicedStats.pct}%` }}
            />
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl shadow-xs">
        
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions, concepts, keywords, code..."
            className="w-full pl-9 pr-4 py-2 bg-slate-100/70 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100/80 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 rounded-lg text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-primary cursor-pointer max-w-[170px] truncate"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Difficulty Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100/80 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 rounded-lg text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="All">All Levels</option>
              <option value="Foundational">Foundational</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>

          {/* List vs Tile View Switcher directly inside Q&A Toolbar */}
          {onToggleViewMode && (
            <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-700">
              <button
                onClick={() => onToggleViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-700 text-primary shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => onToggleViewMode('tile')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'tile'
                    ? 'bg-white dark:bg-zinc-700 text-primary shadow-xs'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
                }`}
                title="Tile / Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-1 ml-auto sm:ml-0">
            <button
              onClick={expandAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Collapse
            </button>
          </div>

        </div>

      </div>

      {/* No results message */}
      {displayedCards.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">No questions match your filter</h4>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Try adjusting your search query, difficulty, or category filter.
          </p>
        </div>
      ) : viewMode === 'tile' ? (
        
        /* ========================================================= */
        /* VIEW MODE 1: TILE / GRID VIEW                             */
        /* ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedCards.map((item, index) => {
            const isExpanded = !!expandedCards[item.id];
            const isPracticed = !!qaProgress[item.id]?.practiced;

            const diffColor =
              item.difficulty === 'Advanced'
                ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60'
                : item.difficulty === 'Intermediate'
                ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60'
                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/60';

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-zinc-900 border transition-all rounded-2xl p-5 shadow-xs hover:shadow-md flex flex-col justify-between group ${
                  isExpanded
                    ? 'border-primary ring-1 ring-primary/40 col-span-1 md:col-span-2 lg:col-span-3'
                    : 'border-slate-200/90 dark:border-zinc-800/90 hover:border-primary/50'
                }`}
              >
                <div>
                  {/* Top: Index + Difficulty + Category + Practiced Check */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-zinc-500">
                        #{String(index + 1).padStart(2, '0')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${diffColor}`}>
                        {item.difficulty}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 truncate max-w-[140px]">
                        {item.category}
                      </span>
                    </div>

                    <button
                      onClick={(e) => togglePracticed(e, item.id)}
                      className="cursor-pointer transition-transform hover:scale-110 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
                      title={isPracticed ? 'Mark as Not Practiced' : 'Mark as Practiced'}
                    >
                      {isPracticed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 dark:text-zinc-600 hover:text-emerald-500" />
                      )}
                    </button>
                  </div>

                  {/* Concept name */}
                  <p className="text-[11px] font-semibold text-primary dark:text-primary-dark-text mt-3 truncate">
                    {item.concept}
                  </p>

                  {/* Question Title */}
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mt-1 leading-snug">
                    {item.question}
                  </h3>

                  {/* Quick Answer Snippet */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-50/90 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800/80">
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <p className={`text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-medium ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {item.quickAnswer}
                      </p>
                    </div>
                  </div>

                  {/* Expanded Full Breakdown (in grid expanded mode) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
                      
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                          <Sparkles className="w-3.5 h-3.5 text-primary" />
                          <span>Technical Breakdown & Nuance</span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line bg-slate-50/70 dark:bg-zinc-950/40 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                          {item.detailedAnswer}
                        </div>
                      </div>

                      {item.code && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                            <Code2 className="w-3.5 h-3.5 text-primary" />
                            <span>Code Demonstration</span>
                          </div>
                          <CodeViewer code={item.code} />
                        </div>
                      )}

                      {item.interviewTip && (
                        <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Interviewer Focus & Pitfalls</span>
                          </div>
                          <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed pl-5">
                            {item.interviewTip}
                          </p>
                        </div>
                      )}

                    </div>
                  )}
                </div>

                {/* Footer Tile Bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    {item.code ? (
                      <span className="flex items-center gap-1">
                        <Code2 className="w-3 h-3 text-primary" /> Code Sample
                      </span>
                    ) : (
                      <span>Theory Core</span>
                    )}
                  </div>

                  <button
                    onClick={() => toggleExpand(item.id)}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isExpanded ? 'Hide Details' : 'View Details & Code'}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (

        /* ========================================================= */
        /* VIEW MODE 2: LINEAR LIST VIEW                             */
        /* ========================================================= */
        <div className="space-y-3.5">
          {displayedCards.map((item, index) => {
            const isExpanded = !!expandedCards[item.id];
            const isPracticed = !!qaProgress[item.id]?.practiced;

            const diffColor =
              item.difficulty === 'Advanced'
                ? 'text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60'
                : item.difficulty === 'Intermediate'
                ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60'
                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/60';

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-zinc-900 border transition-all rounded-2xl overflow-hidden ${
                  isExpanded
                    ? 'border-primary/50 shadow-sm'
                    : 'border-slate-200/90 dark:border-zinc-800/90 hover:border-slate-300 dark:hover:border-zinc-700'
                }`}
              >
                {/* Card Header Row */}
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      className="mt-0.5 text-slate-400 shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-primary" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-zinc-500">
                          #{String(index + 1).padStart(2, '0')}
                        </span>

                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${diffColor}`}>
                          {item.difficulty}
                        </span>

                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                          {item.category}
                        </span>

                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                          • {item.concept}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                        {item.question}
                      </h3>
                    </div>
                  </div>

                  {/* Practiced checkmark */}
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <button
                      onClick={(e) => togglePracticed(e, item.id)}
                      className="cursor-pointer transition-transform hover:scale-110 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                      title={isPracticed ? 'Mark as Not Practiced' : 'Mark as Practiced'}
                    >
                      {isPracticed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 dark:text-zinc-600 hover:text-emerald-500" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Answer Banner */}
                <div className="px-4 pb-4 sm:px-5 sm:pb-4 pt-0">
                  <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800/80">
                    <div className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-200 leading-relaxed font-medium">
                        {item.quickAnswer}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Deep Explanation, Code Snippet, Interviewer Tip */}
                {isExpanded && (
                  <div className="px-4 pb-5 pt-3 sm:px-6 sm:pb-6 border-t border-slate-100 dark:border-zinc-800/80 space-y-4">
                    
                    {/* Detailed Answer */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        <span>Technical Breakdown & Nuance</span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line bg-slate-50/70 dark:bg-zinc-950/40 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                        {item.detailedAnswer}
                      </div>
                    </div>

                    {/* Code Snippet if present */}
                    {item.code && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                          <Code2 className="w-3.5 h-3.5 text-primary" />
                          <span>Code Demonstration</span>
                        </div>
                        <CodeViewer code={item.code} />
                      </div>
                    )}

                    {/* Interviewer Tip / Trap */}
                    {item.interviewTip && (
                      <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Interviewer Focus & Pitfalls</span>
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed pl-5">
                          {item.interviewTip}
                        </p>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

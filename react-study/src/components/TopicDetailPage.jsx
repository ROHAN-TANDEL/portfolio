import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  List, 
  LayoutGrid, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Circle, 
  Info, 
  ListChecks, 
  Code, 
  Sparkles,
  ChevronsUpDown,
  BookOpen,
  ArrowUpDown,
  Check,
  Archive,
  PackageCheck,
  RotateCcw,
  RefreshCw,
  Layers,
  Hash,
  FileText,
  Bookmark,
  HelpCircle,
  Lightbulb,
  Code2,
  Server,
  X
} from 'lucide-react';
import { SubjectBadge } from './SubjectBadge';
import { CodeViewer } from './CodeViewer';
import { FlashCard } from './FlashCard';
import { QuestionAnswerSection } from './QuestionAnswerSection';
import { DeeperConceptsSection } from './DeeperConceptsSection';
import { ExamplesSection } from './ExamplesSection';
import { ProductionSection } from './ProductionSection';
import { getAvailableArchives, loadArchiveCards } from '../utils/archiveRegistry';
import { loadFromStorage, saveToStorage } from '../utils/helpers';

export function TopicDetailPage({
  subject,
  cards = [],
  progress = {},
  onUpdateProgress,
  onBack,
}) {
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'tile'
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'priority' | 'alpha'
  const [expandedCards, setExpandedCards] = useState({});
  const [activeFlashcardItem, setActiveFlashcardItem] = useState(null); // for 3-step test modal

  // Study Mode: 'theory' | 'qa' | 'deep' | 'examples' | 'production'
  const [studyMode, setStudyMode] = useState('theory');
  const hasQA = !!subject?.qaFile || subject?.id === 'typescript' || subject?.id === 'nodejs';
  const hasDeep = !!subject?.deepFile || subject?.id === 'nodejs';
  const hasExamples = !!subject?.examplesFile || subject?.id === 'nodejs';
  const hasProduction = !!subject?.productionFile || subject?.id === 'nodejs';

  // Reset to theory if active mode is not available for subject
  useEffect(() => {
    if (!hasQA && studyMode === 'qa') setStudyMode('theory');
    if (!hasDeep && studyMode === 'deep') setStudyMode('theory');
    if (!hasExamples && studyMode === 'examples') setStudyMode('theory');
    if (!hasProduction && studyMode === 'production') setStudyMode('theory');
  }, [hasQA, hasDeep, hasExamples, hasProduction, studyMode]);

  // Archive state
  const availableArchives = useMemo(() => {
    return getAvailableArchives(subject?.id);
  }, [subject?.id]);

  const [isArchiveMode, setIsArchiveMode] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState(null);
  const [archiveCards, setArchiveCards] = useState([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState(null);
  const [archiveProgress, setArchiveProgress] = useState({});

  // Auto-select first archive when entering archive mode if none selected
  useEffect(() => {
    if (isArchiveMode && !selectedArchive && availableArchives.length > 0) {
      setSelectedArchive(availableArchives[0]);
    }
  }, [isArchiveMode, availableArchives, selectedArchive]);

  // Load cards for selected archive
  useEffect(() => {
    if (!isArchiveMode || !selectedArchive) return;

    let isCancelled = false;
    setIsLoadingArchive(true);
    setArchiveError(null);

    const progressKey = `flashlearn_progress_${subject.id}_${selectedArchive.version}`;
    setArchiveProgress(loadFromStorage(progressKey, {}));

    loadArchiveCards(selectedArchive)
      .then((loaded) => {
        if (!isCancelled) {
          setArchiveCards(loaded);
          setIsLoadingArchive(false);
          setActiveCategory('All');
          if (loaded.length > 0) {
            setExpandedCards({ [loaded[0].id]: true });
          }
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load archive cards:', err);
          setArchiveError(`Could not load archive file ${selectedArchive.filename}`);
          setArchiveCards([]);
          setIsLoadingArchive(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isArchiveMode, selectedArchive, subject?.id]);

  // Update progress for archive cards
  const updateArchiveProgress = (cardId, updates) => {
    if (!selectedArchive) return;
    const progressKey = `flashlearn_progress_${subject.id}_${selectedArchive.version}`;
    setArchiveProgress((prev) => {
      const next = {
        ...prev,
        [cardId]: {
          ...prev[cardId],
          ...updates,
          lastStudied: new Date().toISOString(),
        },
      };
      saveToStorage(progressKey, next);
      return next;
    });
  };

  // Determine effective cards & progress depending on current vs archive mode
  const effectiveCards = isArchiveMode ? archiveCards : cards;
  const effectiveProgress = isArchiveMode ? archiveProgress : progress;
  const effectiveUpdateProgress = isArchiveMode ? updateArchiveProgress : onUpdateProgress;

  // Extract categories with counts
  const categoryStats = useMemo(() => {
    const map = {};
    effectiveCards.forEach((c) => {
      const cat = c.category || 'General';
      map[cat] = (map[cat] || 0) + 1;
    });

    const list = [{ name: 'All', count: effectiveCards.length }];
    Object.entries(map).forEach(([name, count]) => {
      list.push({ name, count });
    });
    return list;
  }, [effectiveCards]);

  // Expand the first card by default in list mode
  useEffect(() => {
    if (effectiveCards.length > 0 && Object.keys(expandedCards).length === 0) {
      setExpandedCards({ [effectiveCards[0].id]: true });
    }
  }, [effectiveCards]);

  // Filter and sort cards
  const displayedCards = useMemo(() => {
    let result = effectiveCards.filter((c) => {
      // Category filter
      if (activeCategory !== 'All' && (c.category || 'General') !== activeCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inConcept = c.concept?.toLowerCase().includes(q);
        const inQuestion = c.question?.toLowerCase().includes(q);
        const inAnswer = c.answer?.toLowerCase().includes(q);
        const inCategory = c.category?.toLowerCase().includes(q);
        if (!inConcept && !inQuestion && !inAnswer && !inCategory) return false;
      }
      return true;
    });

    // Sorting
    if (sortBy === 'priority') {
      result.sort((a, b) => {
        if (a.priority === 'must-know' && b.priority !== 'must-know') return -1;
        if (b.priority === 'must-know' && a.priority !== 'must-know') return 1;
        return 0;
      });
    } else if (sortBy === 'alpha') {
      result.sort((a, b) => (a.concept || '').localeCompare(b.concept || ''));
    }

    return result;
  }, [effectiveCards, activeCategory, searchQuery, sortBy]);

  // Subject level stats
  const masteredCount = useMemo(() => {
    return effectiveCards.filter((c) => effectiveProgress[c.id]?.status === 'mastered').length;
  }, [effectiveCards, effectiveProgress]);

  const pctMastered = effectiveCards.length > 0 ? Math.round((masteredCount / effectiveCards.length) * 100) : 0;

  // Toggle card expansion in list view
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

  // Quick toggle mastery
  const toggleMastery = (e, cardId) => {
    e.stopPropagation();
    const current = effectiveProgress[cardId]?.status === 'mastered';
    effectiveUpdateProgress(cardId, {
      status: current ? 'unseen' : 'mastered',
      revealed: true,
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-in fade-in duration-200">
      
      {/* Subject Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
        
        {/* Left: Back button + Subject Icon + Title */}
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer"
            title="Back to All Subjects"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <SubjectBadge subject={subject} size="md" />

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {subject.name}
              </h1>
              {isArchiveMode && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-subtle dark:bg-primary-dark-subtle text-primary dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border">
                  Archived Edition
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {studyMode === 'qa' && 'Question & Answer Practice Hub • All, Interview, and FAQ sections'}
              {studyMode === 'deep' && 'Deeper Concepts & Architectural Walkthroughs • In-depth page analysis & diagrams'}
              {studyMode === 'examples' && 'Applied Examples Hub • Real-world scenarios, combinations & concept breakdown'}
              {studyMode === 'production' && 'Production Mastery • Reliability, monitoring & battle-tested patterns'}
              {studyMode === 'theory' && `${effectiveCards.length} topics • ${masteredCount} mastered (${pctMastered}%)`}
            </p>
          </div>
        </div>

        {/* Right: Search + Archive Button + View Switcher */}
        <div className="flex items-center flex-wrap gap-2.5">
          {studyMode === 'theory' && (
            <>
              {/* Search box with ⌘K badge */}
              <div className="relative flex-1 sm:w-60 min-w-[160px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search topics..."
                  className="w-full pl-9 pr-10 py-1.5 bg-slate-100/80 dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-primary transition-colors"
                />
                <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] bg-slate-200/80 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-mono">
                  ⌘K
                </kbd>
              </div>

              {/* Archive Switcher Button */}
              <button
                onClick={() => {
                  if (isArchiveMode) {
                    setIsArchiveMode(false);
                    setActiveCategory('All');
                  } else {
                    setIsArchiveMode(true);
                    if (availableArchives.length > 0 && !selectedArchive) {
                      setSelectedArchive(availableArchives[0]);
                    }
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isArchiveMode
                    ? 'bg-primary text-white border-primary shadow-xs ring-2 ring-primary/40'
                    : availableArchives.length > 0
                    ? 'bg-primary-subtle dark:bg-primary-dark-subtle text-primary dark:text-primary-dark-text border-primary-border dark:border-primary-dark-border hover:bg-primary/10'
                    : 'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-800 hover:text-slate-800'
                }`}
                title="View Archived Question Banks"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>{isArchiveMode ? 'Exit Archive' : 'Archives'}</span>
                {availableArchives.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isArchiveMode
                      ? 'bg-white/20 text-white'
                      : 'bg-primary text-white'
                  }`}>
                    {availableArchives.length}
                  </span>
                )}
              </button>
            </>
          )}

          {/* List vs Tile Toggle (Active for both Theory & Revision and Q&A) */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('tile')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'tile'
                  ? 'bg-white dark:bg-zinc-800 text-primary shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
              title="Tile / Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Primary 5-Pillar Section Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-3 overflow-x-auto no-scrollbar">
        {/* 1. Theory & Revision */}
        <button
          onClick={() => setStudyMode('theory')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            studyMode === 'theory'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Theory & Revision</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            studyMode === 'theory'
              ? 'bg-white/20 text-white'
              : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
          }`}>
            {effectiveCards.length}
          </span>
        </button>

        {/* 2. Questions & Answers */}
        {hasQA && (
          <button
            onClick={() => setStudyMode('qa')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              studyMode === 'qa'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Questions & Answers</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              studyMode === 'qa'
                ? 'bg-white/20 text-white'
                : 'bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border'
            }`}>
              Q&A
            </span>
          </button>
        )}

        {/* 3. Deeper Concepts */}
        {hasDeep && (
          <button
            onClick={() => setStudyMode('deep')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              studyMode === 'deep'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Deeper Concepts</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              studyMode === 'deep'
                ? 'bg-white/20 text-white'
                : 'bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border'
            }`}>
              Deep
            </span>
          </button>
        )}

        {/* 4. Examples Hub */}
        {hasExamples && (
          <button
            onClick={() => setStudyMode('examples')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              studyMode === 'examples'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Examples Hub</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              studyMode === 'examples'
                ? 'bg-white/20 text-white'
                : 'bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border'
            }`}>
              Examples
            </span>
          </button>
        )}

        {/* 5. Production Section */}
        {hasProduction && (
          <button
            onClick={() => setStudyMode('production')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
              studyMode === 'production'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Production</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              studyMode === 'production'
                ? 'bg-white/20 text-white'
                : 'bg-primary-subtle text-primary dark:bg-primary-dark-subtle dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border'
            }`}>
              Prod
            </span>
          </button>
        )}
      </div>

      {studyMode === 'qa' && (
        <QuestionAnswerSection
          subject={subject}
          viewMode={viewMode}
          onToggleViewMode={setViewMode}
        />
      )}

      {studyMode === 'deep' && (
        <DeeperConceptsSection subject={subject} />
      )}

      {studyMode === 'examples' && (
        <ExamplesSection subject={subject} />
      )}

      {studyMode === 'production' && (
        <ProductionSection subject={subject} />
      )}

      {studyMode === 'theory' && (
        <>

      {/* ARCHIVE MODE DEDICATED SECTION */}
      {isArchiveMode && (
        <div className="bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5 animate-in fade-in shadow-xs">
          
          {/* Top Bar with Exit Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-zinc-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-primary" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {subject.name} — Archived Edition ({selectedArchive?.versionLabel || 'Historical'})
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-subtle dark:bg-primary-dark-subtle text-primary dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border">
                  Handbook & TS 6.0 Snapshot
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Preserved historical card collection extracted from official TypeScript Handbook documentation and evolution guides.
              </p>
            </div>

            <button
              onClick={() => {
                setIsArchiveMode(false);
                setActiveCategory('All');
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-zinc-850 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:border-primary/50 transition-colors cursor-pointer self-start sm:self-auto shadow-xs group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Current Edition ({cards.length} cards)</span>
            </button>
          </div>

          {/* Versions Selector */}
          {availableArchives.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Available Archive Snapshot:
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                  File: {selectedArchive?.filename}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {availableArchives.map((arch) => {
                  const isSelected = selectedArchive?.filename === arch.filename;
                  return (
                    <button
                      key={arch.filename}
                      onClick={() => setSelectedArchive(arch)}
                      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white shadow-xs ring-2 ring-primary/40'
                          : 'bg-white dark:bg-zinc-850 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-800 hover:border-primary/50'
                      }`}
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>{arch.versionLabel}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isSelected 
                          ? 'bg-white/20 text-white' 
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                      }`}>
                        {arch.cardCount} topics
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-zinc-200">
                No archived files found for {subject.name} yet.
              </p>
              <p className="text-[11px] text-slate-500">
                To archive questions for this subject, place a JSON file named <code className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-primary">{subject.id}.archive.v1.json</code> in the <code className="font-mono">data/</code> directory.
              </p>
            </div>
          )}

          {/* 4 Metrics Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-primary mb-1">
                <FileText className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Total Questions</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {effectiveCards.length}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Handbook foundations
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-primary mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Categories</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {categoryStats.filter(c => c.name !== 'All').length}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Official doc domains
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-primary mb-1">
                <Hash className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">ID Range</span>
              </div>
              <div className="text-base sm:text-lg font-extrabold font-mono text-slate-900 dark:text-white truncate">
                {effectiveCards[0]?.id || 'ts-001'} → {effectiveCards[effectiveCards.length - 1]?.id || 'ts-096'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Sequential cards
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-3 shadow-2xs">
              <div className="flex items-center gap-1.5 text-primary mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Mastery Status</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {pctMastered}%
              </div>
              <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                {masteredCount} of {effectiveCards.length} mastered
              </div>
            </div>
          </div>

          {/* Category Breakdown Badges Grid with Counts */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Archived Category Breakdown ({categoryStats.filter(c => c.name !== 'All').length} domains)
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 hidden sm:inline">
                Click any category badge to filter below
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categoryStats.map((cat) => {
                const isActive = activeCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-white shadow-xs font-bold ring-2 ring-primary/40'
                        : 'bg-slate-100/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 hover:border-primary/50 hover:bg-slate-200/60'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                      isActive 
                        ? 'bg-white/20 text-white' 
                        : 'bg-primary-subtle dark:bg-primary-dark-subtle text-primary dark:text-primary-dark-text'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Archive Highlights Explainer Box */}
          <div className="bg-primary-subtle/40 dark:bg-primary-dark-subtle/30 border border-primary-border/60 dark:border-primary-dark-border/40 rounded-xl p-3.5 text-xs text-slate-700 dark:text-zinc-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  Archive Content Coverage:
                </p>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                  Includes official Handbook chapters, Narrowing, Generics, Utility Types, Decorators, Enums, Namespaces, TS 4→6 Evolution, TS 6.0 Features, and TS 5→6 Migration Guide. Each card includes code snippets, in-depth explanation, recall hints, and practice drills.
                </p>
              </div>
            </div>
            <div className="shrink-0 text-[11px] font-mono bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
              Active: 334 cards | Archive: 96 cards
            </div>
          </div>

        </div>
      )}

      {/* Loading state for archive */}
      {isArchiveMode && isLoadingArchive && (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading archived edition...</p>
        </div>
      )}

      {/* Error state for archive */}
      {isArchiveMode && !isLoadingArchive && archiveError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
          {archiveError}
        </div>
      )}

      {/* Category Chips Bar (Works for both active and archive mode!) */}
      {(!isArchiveMode || (!isLoadingArchive && !archiveError)) && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {categoryStats.map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800'
                }`}
              >
                {cat.name} <span className={isActive ? 'text-white/80 text-[11px]' : 'text-slate-400 text-[11px]'}>{cat.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 1: LIST / ACCORDION VIEW */}
      {(!isArchiveMode || (!isLoadingArchive && !archiveError)) && viewMode === 'list' && (
        <div className="space-y-4">
          
          {/* Controls: Expand/Collapse All + Sort */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-1">
            <div className="flex items-center gap-3">
              <button
                onClick={expandAll}
                className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>ˇ Expand All</span>
              </button>
              <span>•</span>
              <button
                onClick={collapseAll}
                className="hover:text-slate-900 dark:hover:text-white flex items-center gap-1 font-medium cursor-pointer"
              >
                <span>^ Collapse All</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent font-semibold text-slate-700 dark:text-zinc-200 cursor-pointer focus:outline-none"
              >
                <option value="default" className="bg-white dark:bg-zinc-900">Default</option>
                <option value="priority" className="bg-white dark:bg-zinc-900">Priority</option>
                <option value="alpha" className="bg-white dark:bg-zinc-900">Alphabetical</option>
              </select>
            </div>
          </div>

          {/* Empty search results */}
          {displayedCards.length === 0 && (
            <div className="p-8 text-center text-slate-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl">
              No matching topics found. Try adjusting your search query or category filter.
            </div>
          )}

          {/* Accordion Cards List */}
          <div className="space-y-3">
            {displayedCards.map((card) => {
              const isExpanded = !!expandedCards[card.id];
              const isMastered = effectiveProgress[card.id]?.status === 'mastered';

              return (
                <div
                  key={card.id}
                  className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-all"
                >
                  {/* Accordion Header */}
                  <div
                    onClick={() => toggleExpand(card.id)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {card.concept}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {isArchiveMode && (
                        <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-primary-subtle dark:bg-primary-dark-subtle text-primary dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border">
                          {selectedArchive?.versionLabel || 'Archive'} • {card.id}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700">
                        {card.category}
                      </span>

                      <button
                        onClick={(e) => toggleMastery(e, card.id)}
                        className="cursor-pointer transition-transform hover:scale-110"
                        title={isMastered ? 'Mark as Unmastered' : 'Mark as Mastered'}
                      >
                        {isMastered ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300 dark:text-zinc-600 hover:text-emerald-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Body: 2-column (Definition & Key Points) + Full-width Example */}
                  {isExpanded && (
                    <div className="px-4 pb-5 pt-1 sm:px-6 sm:pb-6 border-t border-slate-100 dark:border-zinc-800/80 space-y-4">
                      
                      {/* Top Row: Definition & Key Points */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                        
                        {/* 1. Definition */}
                        <div className="bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                              <Info className="w-3.5 h-3.5 text-primary" />
                              <span>Definition & Question</span>
                            </div>
                            <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-2">
                              {card.question}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                              {card.answer || card.explanation || 'Review and master the core principles of this concept.'}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 font-medium">Recall check:</span>
                            <button
                              onClick={() => setActiveFlashcardItem(card)}
                              className="text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer text-primary"
                            >
                              <span>Practice Flashcard</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 2. Key Points */}
                        <div className="bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                              <ListChecks className="w-3.5 h-3.5 text-primary" />
                              <span>Key Points & Notes</span>
                            </div>
                            <ul className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 space-y-2 list-disc pl-4 leading-relaxed">
                              {card.explanation ? (
                                card.explanation.split('. ').map((pt, idx) => (
                                  pt.trim() ? <li key={idx}>{pt.trim().replace(/\.$/, '')}.</li> : null
                                ))
                              ) : (
                                <>
                                  <li>Crucial component of language runtime.</li>
                                  <li>Frequently tested in technical interview rounds.</li>
                                </>
                              )}
                              {card.recallHint && (
                                <li className="text-primary font-semibold list-none -ml-4 pt-1.5 flex items-start gap-1.5">
                                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                  <span>{card.recallHint}</span>
                                </li>
                              )}
                            </ul>
                          </div>
                        </div>

                      </div>

                      {/* Bottom Row: Full-width Example Code */}
                      {card.code && (
                        <div className="bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 sm:p-5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                            <Code className="w-3.5 h-3.5 text-primary" />
                            <span>Code Example</span>
                          </div>
                          <CodeViewer code={card.code} />
                        </div>
                      )}

                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* VIEW MODE 2: TILE / GRID VIEW */}
      {(!isArchiveMode || (!isLoadingArchive && !archiveError)) && viewMode === 'tile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedCards.map((card) => {
            const isMastered = effectiveProgress[card.id]?.status === 'mastered';

            return (
              <div
                key={card.id}
                onClick={() => setActiveFlashcardItem(card)}
                className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-primary/50 dark:hover:border-primary/50 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Top: Icon + Concept + Category + Checkmark */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-primary-subtle dark:bg-primary-dark-subtle text-primary">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white transition-colors group-hover:text-primary">
                          {card.concept}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium border bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700">
                            {card.category}
                          </span>
                          {isArchiveMode && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-primary-subtle dark:bg-primary-dark-subtle text-primary dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border">
                              {card.id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => toggleMastery(e, card.id)}
                      className="cursor-pointer transition-transform hover:scale-110 shrink-0"
                      title={isMastered ? 'Mark as Unmastered' : 'Mark as Mastered'}
                    >
                      {isMastered ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300 dark:text-zinc-600 hover:text-emerald-500" />
                      )}
                    </button>
                  </div>

                  {/* Bullet points summary */}
                  <ul className="mt-4 space-y-1.5 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed list-disc pl-4">
                    {card.answer ? (
                      card.answer.split('. ').slice(0, 3).map((item, idx) => (
                        item.trim() ? <li key={idx}>{item.trim().replace(/\.$/, '')}.</li> : null
                      ))
                    ) : (
                      <li>Core concept for this subject.</li>
                    )}
                  </ul>
                </div>

                {/* Footer Practice link */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Practice Card</span>
                  <span className="font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 text-primary">
                    Start <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Interactive 3-Step Active Recall Flashcard Modal */}
      {activeFlashcardItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div 
            className="fixed inset-0"
            onClick={() => setActiveFlashcardItem(null)}
          />
          <div className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-end pb-2">
              <button
                onClick={() => setActiveFlashcardItem(null)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Flashcard</span>
              </button>
            </div>
            <FlashCard
              card={activeFlashcardItem}
              index={effectiveCards.findIndex((c) => c.id === activeFlashcardItem.id)}
              totalCards={effectiveCards.length}
              cardProgress={effectiveProgress[activeFlashcardItem.id] || {}}
              onUpdateProgress={effectiveUpdateProgress}
              onNextCard={() => {
                const currentIdx = effectiveCards.findIndex((c) => c.id === activeFlashcardItem.id);
                if (currentIdx < effectiveCards.length - 1) {
                  setActiveFlashcardItem(effectiveCards[currentIdx + 1]);
                } else {
                  setActiveFlashcardItem(null);
                }
              }}
            />
          </div>
        </div>
      )}
      </>
      )}

    </div>
  );
}

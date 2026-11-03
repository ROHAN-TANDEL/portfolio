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
  Check
} from 'lucide-react';
import { SubjectBadge } from './SubjectBadge';
import { CodeViewer } from './CodeViewer';
import { FlashCard } from './FlashCard';

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

  // Extract categories with counts
  const categoryStats = useMemo(() => {
    const map = {};
    cards.forEach((c) => {
      const cat = c.category || 'General';
      map[cat] = (map[cat] || 0) + 1;
    });

    const list = [{ name: 'All', count: cards.length }];
    Object.entries(map).forEach(([name, count]) => {
      list.push({ name, count });
    });
    return list;
  }, [cards]);

  // Expand the first card by default in list mode
  useEffect(() => {
    if (cards.length > 0 && Object.keys(expandedCards).length === 0) {
      setExpandedCards({ [cards[0].id]: true });
    }
  }, [cards]);

  // Filter and sort cards
  const displayedCards = useMemo(() => {
    let result = cards.filter((c) => {
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
      result.sort((a, b) => a.concept.localeCompare(b.concept));
    }

    return result;
  }, [cards, activeCategory, searchQuery, sortBy]);

  // Subject level stats
  const masteredCount = useMemo(() => {
    return cards.filter((c) => progress[c.id]?.status === 'mastered').length;
  }, [cards, progress]);

  const pctMastered = cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : 0;

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
    const current = progress[cardId]?.status === 'mastered';
    onUpdateProgress(cardId, {
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
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {subject.name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {cards.length} topics • {masteredCount} mastered ({pctMastered}%)
            </p>
          </div>
        </div>

        {/* Right: Search + View Toggle Switcher */}
        <div className="flex items-center gap-3">
          
          {/* Search box with ⌘K badge */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics..."
              className="w-full pl-9 pr-10 py-1.5 bg-slate-100/80 dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[10px] bg-slate-200/80 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-mono">
              ⌘K
            </kbd>
          </div>

          {/* List vs Tile Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
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
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900'
              }`}
              title="Tile / Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Category Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        {categoryStats.map((cat) => {
          const isActive = activeCategory === cat.name;
          return (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(cat.name)}
              className={`px-3.5 py-1.5 rounded-full font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800'
              }`}
            >
              {cat.name} <span className={isActive ? 'text-indigo-200 text-[11px]' : 'text-slate-400 text-[11px]'}>{cat.count}</span>
            </button>
          );
        })}
      </div>

      {/* VIEW MODE 1: LIST / ACCORDION VIEW */}
      {viewMode === 'list' && (
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

          {/* Accordion Cards List */}
          <div className="space-y-3">
            {displayedCards.map((card) => {
              const isExpanded = !!expandedCards[card.id];
              const isMastered = progress[card.id]?.status === 'mastered';

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
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50">
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
                              <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Definition</span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                              {card.answer || card.explanation || 'Review and master the core principles of this concept.'}
                            </p>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-zinc-800 flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 font-medium">Recall check:</span>
                            <button
                              onClick={() => setActiveFlashcardItem(card)}
                              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
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
                              <ListChecks className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Key Points</span>
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
                                <li className="text-amber-500 dark:text-amber-400 font-semibold list-none -ml-4 pt-1.5 flex items-start gap-1.5">
                                  <span>💡</span>
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
                            <Code className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>Example</span>
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

      {/* VIEW MODE 2: TILE / GRID VIEW (Right Bottom of Screenshot) */}
      {viewMode === 'tile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedCards.map((card) => {
            const isMastered = progress[card.id]?.status === 'mastered';

            return (
              <div
                key={card.id}
                onClick={() => setActiveFlashcardItem(card)}
                className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-500/60 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  {/* Top: Icon + Concept + Category + Checkmark */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {card.concept}
                        </h3>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                          {card.category}
                        </span>
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
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
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
                className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold"
              >
                ✕ Close Flashcard
              </button>
            </div>
            <FlashCard
              card={activeFlashcardItem}
              index={cards.findIndex((c) => c.id === activeFlashcardItem.id)}
              totalCards={cards.length}
              cardProgress={progress[activeFlashcardItem.id] || {}}
              onUpdateProgress={onUpdateProgress}
              onNextCard={() => {
                const currentIdx = cards.findIndex((c) => c.id === activeFlashcardItem.id);
                if (currentIdx < cards.length - 1) {
                  setActiveFlashcardItem(cards[currentIdx + 1]);
                } else {
                  setActiveFlashcardItem(null);
                }
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}

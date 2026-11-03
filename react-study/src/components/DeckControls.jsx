import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Layers,
  Sparkles,
  Search
} from 'lucide-react';

export function DeckControls({
  currentIndex,
  totalCards,
  onPrev,
  onNext,
  sections,
  activeSection,
  onSelectSection,
  statusFilter,
  onSelectStatusFilter,
  searchQuery,
  onSearchChange,
  statusCounts
}) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs overflow-x-auto">
          <button
            onClick={() => onSelectStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({statusCounts.all})
          </button>
          <button
            onClick={() => onSelectStatusFilter('review')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'review'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-zinc-400 hover:text-rose-400'
            }`}
          >
            Needs Review ({statusCounts.review})
          </button>
          <button
            onClick={() => onSelectStatusFilter('mastered')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer shrink-0 ${
              statusFilter === 'mastered'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-emerald-400'
            }`}
          >
            Mastered ({statusCounts.mastered})
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search concepts, questions..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

      </div>

      {/* Sections / Categories Pill Scroller */}
      {sections.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 shrink-0 mr-1 flex items-center gap-1">
            <Layers className="w-3 h-3" /> Section:
          </span>
          {sections.map((sec) => {
            const isSelected = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                }`}
              >
                {sec.label} <span className="opacity-70 text-[10px]">({sec.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Prev / Next Scrubber Bar */}
      <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800/80 px-4 py-2 rounded-xl text-xs">
        <button
          onClick={onPrev}
          disabled={currentIndex <= 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Prev</span>
          <kbd className="hidden md:inline text-[10px] text-zinc-400 font-mono">←</kbd>
        </button>

        <div className="text-center font-medium text-zinc-300">
          Card <span className="font-bold text-white">{totalCards > 0 ? currentIndex + 1 : 0}</span> of <span className="font-bold text-white">{totalCards}</span>
        </div>

        <button
          onClick={onNext}
          disabled={currentIndex >= totalCards - 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
        >
          <span className="hidden sm:inline">Next</span>
          <kbd className="hidden md:inline text-[10px] text-zinc-400 font-mono">→</kbd>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}

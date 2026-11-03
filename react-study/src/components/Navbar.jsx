import React, { useState } from 'react';
import { 
  BookOpen, 
  ChevronDown, 
  RotateCcw, 
  Keyboard, 
  Sparkles,
  Layers,
  CheckCircle,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export function Navbar({
  subjects,
  activeSubject,
  onSelectSubject,
  stats,
  onResetProgress,
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const total = stats.total || 0;
  const mastered = stats.mastered || 0;
  const review = stats.review || 0;
  const learning = stats.learning || 0;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <>
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Subject Picker */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 text-base">
                ⚡
              </div>
              <span className="font-extrabold tracking-tight text-white hidden sm:inline text-lg">
                Flash<span className="text-indigo-400">Learn</span>
              </span>
            </div>

            <div className="h-4 w-px bg-zinc-800 mx-1 hidden sm:block" />

            {/* Subject Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700/80 hover:border-zinc-600 text-sm font-semibold text-zinc-100 hover:bg-zinc-800/80 transition-all cursor-pointer"
              >
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold uppercase">
                  {activeSubject?.icon?.slice(0, 2) || 'S'}
                </span>
                <span className="max-w-[150px] sm:max-w-[220px] truncate">
                  {activeSubject?.name || 'Select Subject'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsDropdownOpen(false)} 
                  />
                  <div className="absolute left-0 mt-2 w-80 max-h-[75vh] overflow-y-auto bg-zinc-900 border border-zinc-700/90 rounded-2xl shadow-2xl p-2 z-50 divide-y divide-zinc-800/60">
                    <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                      Choose Topic ({subjects.length} subjects)
                    </div>
                    <div className="space-y-1 py-1">
                      {subjects.map((sub) => {
                        const isSelected = sub.id === activeSubject?.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => {
                              onSelectSubject(sub.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl flex items-start gap-3 transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600/15 border border-indigo-500/40 text-white'
                                : 'hover:bg-zinc-800/80 text-zinc-300'
                            }`}
                          >
                            <span className="w-7 h-7 shrink-0 rounded-lg bg-zinc-800 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono">
                              {sub.icon || '✦'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-zinc-100 truncate">
                                {sub.name}
                              </div>
                              <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {sub.description || sub.dataFile}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Stats Bar & Quick Controls */}
          <div className="flex items-center gap-3">
            
            {/* Minimal Progress pill */}
            <div className="hidden md:flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl text-xs">
              <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                <span className="text-indigo-400 font-bold">{pct}%</span>
                <span>Mastery</span>
              </div>
              <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-800 text-[11px]">
                <span className="text-emerald-400 flex items-center gap-0.5" title="Mastered">
                  <CheckCircle className="w-3 h-3" /> {mastered}
                </span>
                <span className="text-rose-400 flex items-center gap-0.5" title="Needs Review">
                  <AlertCircle className="w-3 h-3" /> {review}
                </span>
              </div>
            </div>

            {/* Shortcuts help button */}
            <button
              onClick={() => setShowKeyboardHelp(true)}
              title="Keyboard Shortcuts"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              <Keyboard className="w-4 h-4" />
            </button>

            {/* Reset subject progress */}
            <button
              onClick={onResetProgress}
              title="Reset notes & ratings for this subject"
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

          </div>
        </div>
      </header>

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div 
            className="fixed inset-0"
            onClick={() => setShowKeyboardHelp(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl z-10 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-indigo-400" />
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs px-2 py-1 rounded hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Reveal / Flip Card</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono">⌘ + Enter</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Next Card</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono">→ or J</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Previous Card</span>
                <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-200 font-mono">← or K</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Mark "Needs Work"</span>
                <kbd className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 font-mono">1</kbd>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-zinc-800/40">
                <span className="text-zinc-400">Mark "Almost / Learning"</span>
                <kbd className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-amber-300 font-mono">2</kbd>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-zinc-400">Mark "Mastered"</span>
                <kbd className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-mono">3</kbd>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="w-full py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

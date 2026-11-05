import React from 'react';
import { 
  Layers, 
  BookOpen, 
  BookmarkCheck, 
  TrendingUp, 
  Moon, 
  Sun 
} from 'lucide-react';
import { ThemeSelector } from './ThemeSelector';

export function TopNav({ 
  activeTab = 'learn', 
  onSelectTab,
  isDarkMode = false, 
  onToggleDarkMode,
  onNavigateHome
}) {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div 
          onClick={onNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="relative flex items-center justify-center text-slate-800 dark:text-zinc-100">
            <Layers className="w-6 h-6 stroke-[2.2] text-primary group-hover:scale-105 transition-transform" />
          </div>
          <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
            Study<span className="text-primary">Deck</span>
          </span>
        </div>

        {/* Center Nav Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          
          {/* Learn Tab */}
          <button
            onClick={() => onSelectTab && onSelectTab('learn')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'learn'
                ? 'bg-primary-subtle dark:bg-primary-dark-subtle text-primary-text dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border shadow-xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Learn</span>
          </button>

          {/* Review Tab */}
          <button
            onClick={() => onSelectTab && onSelectTab('review')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'review'
                ? 'bg-primary-subtle dark:bg-primary-dark-subtle text-primary-text dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border shadow-xs font-semibold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/50'
            }`}
          >
            <BookmarkCheck className="w-4 h-4" />
            <span>Review</span>
          </button>

          {/* Progress Tab */}
          <button
            onClick={() => onSelectTab && onSelectTab('progress')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'progress'
                ? 'bg-primary-subtle dark:bg-primary-dark-subtle text-primary-text dark:text-primary-dark-text border border-primary-border dark:border-primary-dark-border shadow-xs font-semibold'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/50'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Progress</span>
          </button>

        </nav>

        {/* Right Actions: Theme Selector + Dark Mode Toggle & User Avatar */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Theme Palette Selector Dropdown */}
          <ThemeSelector />

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-xl text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Avatar IndieMaster */}
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 flex items-center justify-center font-bold text-xs select-none shadow-xs border border-slate-300/60 dark:border-zinc-700">
            BB
          </div>
        </div>

      </div>
    </header>
  );
}

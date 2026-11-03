import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Palette, Check, ChevronDown, Search } from 'lucide-react';
import { 
  DEFAULT_THEMES, 
  fetchThemes, 
  applyThemeToDom, 
  getStoredThemeId, 
  STORAGE_KEY 
} from '../utils/themeManager';
import { saveToStorage } from '../utils/helpers';

export function ThemeSelector() {
  const [themes, setThemes] = useState(DEFAULT_THEMES);
  const [activeThemeId, setActiveThemeId] = useState(getStoredThemeId);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  // Load themes dynamically from data/themes.json
  useEffect(() => {
    let isCancelled = false;
    fetchThemes().then((list) => {
      if (!isCancelled && Array.isArray(list) && list.length > 0) {
        setThemes(list);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Determine active theme object
  const activeTheme = useMemo(() => {
    return themes.find((t) => t.id === activeThemeId) || themes[0] || DEFAULT_THEMES[0];
  }, [themes, activeThemeId]);

  // Apply theme to DOM on mount and when activeThemeId changes
  useEffect(() => {
    if (activeTheme) {
      applyThemeToDom(activeTheme);
      saveToStorage(STORAGE_KEY, activeTheme.id);
    }
  }, [activeTheme]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectTheme = (theme) => {
    setActiveThemeId(theme.id);
    applyThemeToDom(theme);
    setIsOpen(false);
  };

  // Filter themes by search
  const filteredThemes = useMemo(() => {
    if (!searchQuery.trim()) return themes;
    const q = searchQuery.toLowerCase();
    return themes.filter((t) => 
      t.id?.toLowerCase().includes(q) ||
      t.name?.toLowerCase().includes(q) ||
      t.display_name?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }, [themes, searchQuery]);

  const primaryColor = activeTheme?.colors?.primary || activeTheme?.primary || '#7C3AED';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Theme Trigger Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery('');
        }}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100/90 dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition-all cursor-pointer shadow-2xs"
        title="Change Nexora Theme"
      >
        <span 
          className="w-3.5 h-3.5 rounded-full shadow-2xs shrink-0 ring-2 ring-white dark:ring-zinc-950 transition-colors"
          style={{ backgroundColor: primaryColor }}
        />
        <span className="hidden sm:inline font-medium">
          {activeTheme?.display_name || activeTheme?.name || 'Theme'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2.5 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-zinc-100">
              <Palette className="w-3.5 h-3.5" style={{ color: primaryColor }} />
              <span>Nexora Color Themes</span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {themes.length} themes
            </span>
          </div>

          {/* Quick Search */}
          <div className="p-1 pt-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search themes..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 rounded-lg text-slate-800 dark:text-zinc-200 placeholder-slate-400 focus:outline-none focus:border-primary"
                autoFocus
              />
            </div>
          </div>

          {/* Themes List with Color Preview Strip */}
          <div className="py-1 max-h-72 overflow-y-auto space-y-1 mt-1 pr-0.5">
            {filteredThemes.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No matching theme
              </div>
            ) : (
              filteredThemes.map((theme) => {
                const isSelected = theme.id === activeThemeId;
                const c = theme.colors || theme;
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer group ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-zinc-800 font-bold text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* 3-dot tonal swatch preview */}
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span 
                          className="w-3.5 h-3.5 rounded-full ring-1 ring-white dark:ring-zinc-900 z-30 shadow-2xs"
                          style={{ backgroundColor: c.primary }}
                        />
                        <span 
                          className="w-3.5 h-3.5 rounded-full ring-1 ring-white dark:ring-zinc-900 z-20 shadow-2xs"
                          style={{ backgroundColor: c.third || c.fourth || c.primary }}
                        />
                        <span 
                          className="w-3.5 h-3.5 rounded-full ring-1 ring-white dark:ring-zinc-900 z-10 shadow-2xs"
                          style={{ backgroundColor: c.sixth || c.fifth || c.primary }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate flex items-center gap-1.5">
                          <span>{theme.display_name || theme.name}</span>
                          {theme.id === 'blue' && (
                            <span className="text-[9px] font-normal px-1 py-0.2 rounded bg-slate-200/70 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                              Default
                            </span>
                          )}
                        </div>
                        {theme.description && (
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate font-normal">
                            {theme.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 shrink-0 ml-2" style={{ color: c.primary }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

        </div>
      )}
    </div>
  );
}

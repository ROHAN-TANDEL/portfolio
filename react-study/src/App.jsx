import React, { useState, useEffect, useMemo } from 'react';
import { TopNav } from './components/TopNav';
import { SubjectSelectionPage } from './components/SubjectSelectionPage';
import { TopicDetailPage } from './components/TopicDetailPage';
import { useSubjectData } from './hooks/useSubjectData';
import { useStudyProgress } from './hooks/useStudyProgress';
import { loadFromStorage, saveToStorage } from './utils/helpers';
import { getStoredThemeId, DEFAULT_THEMES, applyThemeToDom } from './utils/themeManager';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState('selection'); // 'selection' (Page 1) | 'detail' (Page 2)
  const [activeTab, setActiveTab] = useState('learn');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return loadFromStorage('flashlearn_dark_mode', false);
  });

  // Initialize theme on mount
  useEffect(() => {
    const savedThemeId = getStoredThemeId();
    const preset = DEFAULT_THEMES.find((t) => t.id === savedThemeId) || DEFAULT_THEMES[0];
    applyThemeToDom(preset);
  }, []);

  // Load subject master & active subject
  const {
    subjects,
    activeSubject,
    activeSubjectId,
    setActiveSubjectId,
    cards,
    isLoading,
    error,
  } = useSubjectData();

  // Progress for active subject
  const {
    progress,
    updateCardProgress,
  } = useStudyProgress(activeSubjectId);

  // Subject Stats map: subjectId -> { total, mastered, pct }
  const [subjectStatsMap, setSubjectStatsMap] = useState({});

  // Pre-load/calculate stats for each subject from data files + localStorage
  useEffect(() => {
    if (!subjects || subjects.length === 0) return;

    let isMounted = true;
    async function fetchAllStats() {
      const stats = {};
      let totalAll = 0;
      let masteredAll = 0;

      for (const sub of subjects) {
        try {
          const res = await fetch(`/data/${sub.dataFile}`);
          if (res.ok) {
            const list = await res.json();
            const total = Array.isArray(list) ? list.length : 0;
            const subProgress = loadFromStorage(`flashlearn_progress_${sub.id}`, {});
            const mastered = Object.values(subProgress).filter((p) => p?.status === 'mastered').length;
            const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

            stats[sub.id] = { total, mastered, pct };
            totalAll += total;
            masteredAll += mastered;
          }
        } catch (err) {
          stats[sub.id] = { total: 0, mastered: 0, pct: 0 };
        }
      }

      if (isMounted) {
        setSubjectStatsMap(stats);
      }
    }

    fetchAllStats();
    return () => {
      isMounted = false;
    };
  }, [subjects, progress]);

  // Overall Stats
  const overallStats = useMemo(() => {
    let total = 0;
    let mastered = 0;
    Object.values(subjectStatsMap).forEach((st) => {
      total += st.total || 0;
      mastered += st.mastered || 0;
    });
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, pct };
  }, [subjectStatsMap]);

  // Handle dark mode class on document
  useEffect(() => {
    saveToStorage('flashlearn_dark_mode', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // User clicked a subject on Page 1 -> transition to Page 2
  const handleSelectSubject = (subjectId) => {
    setActiveSubjectId(subjectId);
    setCurrentPage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // User clicked back button or brand logo -> return to Page 1
  const handleBackToSelection = () => {
    setCurrentPage('selection');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 transition-colors selection:bg-indigo-500/20 selection:text-indigo-600 font-sans">
      
      {/* Universal TopNav */}
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onNavigateHome={handleBackToSelection}
      />

      <main className="w-full">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-zinc-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-medium">Loading topics & subjects...</p>
          </div>
        )}

        {/* Error Alert */}
        {!isLoading && error && (
          <div className="max-w-md mx-auto my-12 p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">Failed to load content</h3>
            <p className="text-xs text-rose-600 dark:text-rose-300/80">{error}</p>
          </div>
        )}

        {/* PAGE 1: Subject Selection (Left side of design) */}
        {!isLoading && !error && currentPage === 'selection' && (
          <SubjectSelectionPage
            subjects={subjects}
            subjectStats={subjectStatsMap}
            overallStats={overallStats}
            onSelectSubject={handleSelectSubject}
          />
        )}

        {/* PAGE 2: Subject Topic Details (Right side of design with List & Tile views) */}
        {!isLoading && !error && currentPage === 'detail' && activeSubject && (
          <TopicDetailPage
            subject={activeSubject}
            cards={cards}
            progress={progress}
            onUpdateProgress={updateCardProgress}
            onBack={handleBackToSelection}
          />
        )}
      </main>

    </div>
  );
}

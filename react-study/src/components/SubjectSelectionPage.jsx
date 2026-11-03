import React from 'react';
import { ChevronRight, BarChart3, Sparkles } from 'lucide-react';
import { SubjectBadge } from './SubjectBadge';

export function SubjectSelectionPage({ 
  subjects = [], 
  subjectStats = {}, 
  overallStats = { total: 0, mastered: 0, pct: 0 }, 
  onSelectSubject 
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 md:py-14 space-y-10 animate-in fade-in duration-200">
      
      {/* Title & Subtitle */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Choose a Subject
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-zinc-400 font-normal">
          Quickly revise, practice and master key concepts.
        </p>
      </div>

      {/* Grid of Subjects (3 columns on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {subjects.map((subject) => {
          const stats = subjectStats[subject.id] || { total: 0, mastered: 0, pct: 0 };
          const topicCount = stats.total || 0;
          const pctMastered = stats.pct || 0;

          return (
            <div
              key={subject.id}
              onClick={() => onSelectSubject(subject.id)}
              className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-500/60 rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between"
            >
              <div>
                {/* Top Row: Icon badge + Chevron */}
                <div className="flex items-center justify-between">
                  <SubjectBadge subject={subject} size="md" />
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Subject Name & Topic count */}
                <div className="mt-4">
                  <h3 className="font-bold text-base md:text-lg text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {subject.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {topicCount} topics
                  </p>
                </div>
              </div>

              {/* Progress & Progress Bar */}
              <div className="mt-5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  <span>{pctMastered}% Mastered</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${pctMastered}%` }}
                  />
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Overall Progress Banner Card */}
      <div 
        onClick={() => {
          if (subjects.length > 0) {
            onSelectSubject(subjects[0].id);
          }
        }}
        className="bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-500/60 rounded-2xl p-5 md:p-6 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          {/* Chart icon */}
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm md:text-base text-slate-900 dark:text-white">
                Overall Progress
              </span>
              <span className="font-extrabold text-sm md:text-base text-slate-900 dark:text-white">
                {overallStats.pct}%
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {overallStats.total} topics • {overallStats.mastered} mastered
            </p>

            <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${overallStats.pct}%` }}
              />
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all shrink-0 ml-2" />
        </div>
      </div>

    </div>
  );
}

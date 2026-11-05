import React from 'react';
import { Cpu, Layers, Server, Cloud, Sparkles, CheckCircle } from 'lucide-react';

export default function SkillsGrid({ skills }) {
  const categoryIcons = {
    'Languages & Core': Cpu,
    'Frontend & UI': Layers,
    'Backend & Distributed': Server,
    'Cloud & Infrastructure': Cloud,
  };

  const philosophies = [
    {
      title: 'Performance as a Feature',
      desc: 'Sub-second initial paint, optimistic cache invalidation, and tight memory budgets.'
    },
    {
      title: 'Minimalist Architecture',
      desc: 'Fewer dependencies, decoupled boundary services, and clear data ownership.'
    },
    {
      title: 'Resilience by Design',
      desc: 'Graceful degradation, automated circuit breakers, and telemetry-first deployments.'
    }
  ];

  return (
    <section id="skills" className="py-20 px-4 max-w-5xl mx-auto">
      {/* Section Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-1.5 text-xs font-mono text-indigo-400 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>CAPABILITIES & ARSENAL</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Modern Stack & Architecture
        </h2>
        <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-2xl">
          Deep proficiency across distributed cloud backends, reactive browser runtimes, and pragmatic engineering practices.
        </p>
      </div>

      {/* Grid of Skill Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
        {Object.entries(skills).map(([category, items]) => {
          const Icon = categoryIcons[category] || Cpu;
          return (
            <div
              key={category}
              className="glass-panel rounded-2xl p-6 border border-slate-800/80 hover:border-slate-700/80 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {category}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span
                      key={item}
                      className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-900/80 text-slate-300 border border-slate-800 hover:border-indigo-500/40 hover:text-white transition-all"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Architectural Principles Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800/90 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold mb-4">
          Core Engineering Tenets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {philosophies.map((p, idx) => (
            <div key={idx} className="space-y-1.5">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{p.title}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed pl-6">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

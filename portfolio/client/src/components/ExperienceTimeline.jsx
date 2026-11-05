import React from 'react';
import { Briefcase, Calendar, MapPin, Sparkles } from 'lucide-react';

export default function ExperienceTimeline({ experience }) {
  return (
    <section id="experience" className="py-20 px-4 max-w-5xl mx-auto">
      {/* Section Header */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-1.5 text-xs font-mono text-indigo-400 mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>PROVEN TRACK RECORD</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Leadership & Impact
        </h2>
        <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-2xl">
          Highlights from past architectural roles leading technical initiatives and delivering high-value software.
        </p>
      </div>

      {/* Timeline List */}
      <div className="relative border-l border-slate-800 ml-3 sm:ml-4 pl-6 sm:pl-8 space-y-10">
        {experience.map((item, idx) => (
          <div key={idx} className="relative group">
            {/* Glowing Timeline Marker */}
            <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-slate-900 border-2 border-indigo-500 group-hover:scale-125 group-hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/30"></div>

            <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-slate-800/80 hover:border-slate-700/80 transition-all">
              {/* Role & Company Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {item.role}
                  </h3>
                  <span className="text-sm font-semibold text-indigo-400 font-mono">
                    {item.company}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    {item.period}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {item.location}
                  </span>
                </div>
              </div>

              {/* Highlights */}
              <ul className="space-y-2 mt-4 text-xs sm:text-sm text-slate-300">
                {item.highlights.map((bullet, bIdx) => (
                  <li key={bIdx} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-2"></span>
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

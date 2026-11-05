import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function WorksList({ works, onSelectWork }) {
  return (
    <section id="work" className="py-24 border-t border-line">
      <div className="site-container">
        {/* Section Lead */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-8 mb-12 border-b border-line gap-4">
          <div>
            <div className="text-[11px] text-accent font-bold tracking-kicker uppercase mb-2">
              Selected Work
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-main">
              The work.
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-text-muted max-w-md sm:text-right leading-relaxed">
            A small selection of systems built from scratch. Click any project to inspect the end-to-end breakdown.
          </p>
        </div>

        {/* Uncongested Project Rows */}
        <div className="space-y-6">
          {works.map((work) => (
            <div
              key={work.id}
              onClick={() => onSelectWork(work)}
              className="group cursor-pointer bg-panel border border-line rounded-2xl p-6 sm:p-8 hover:border-[#444955] hover:-translate-y-1 transition-all duration-200"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-dim mb-3 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-accent font-bold">{work.number}</span>
                  <span className="w-1 h-1 rounded-full bg-line-light" />
                  <span className="text-text-muted">{work.tag}</span>
                </div>
                <div className="text-[11px] px-2.5 py-0.5 rounded-full border border-line bg-panel2 text-text-muted">
                  {work.metric}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-3">
                <h3 className="text-xl sm:text-2xl font-bold text-text-main group-hover:text-accent transition-colors tracking-tight flex items-center gap-2">
                  <span>{work.title}</span>
                  <ArrowUpRight className="w-4 h-4 text-text-dim group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-2xl mb-4">
                {work.hook}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-line/60 text-xs">
                <span className="text-accent font-semibold flex items-center gap-1 group-hover:underline">
                  Inspect End-to-End Build ↗
                </span>
                <span className="text-[11px] font-mono text-text-dim">
                  Click to read deep dive
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

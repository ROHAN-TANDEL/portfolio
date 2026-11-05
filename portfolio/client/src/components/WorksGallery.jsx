import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';

export default function WorksGallery({ works }) {
  const [expandedId, setExpandedId] = useState(works[0]?.id);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section id="works" className="py-20 px-6 max-w-4xl mx-auto border-t border-white/[0.08]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/[0.08] pb-6 mb-12 gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-[0.22em] text-muted uppercase">
            Index 01 / Works
          </span>
          <h2 className="text-2xl sm:text-4xl font-normal text-white mt-2 font-serif tracking-tight">
            Selected Architectures
          </h2>
        </div>
        <p className="text-xs text-muted font-mono max-w-sm sm:text-right leading-relaxed">
          Distributed consensus, real-time spatial computing, and high-throughput streaming systems.
        </p>
      </div>

      {/* Projects List */}
      <div className="space-y-10">
        {works.map((work, index) => {
          const isExpanded = expandedId === work.id;

          return (
            <article
              key={work.id}
              className="border border-white/[0.08] rounded-2xl p-6 sm:p-8 bg-[#111317]/50 hover:border-white/20 transition-all duration-300"
            >
              {/* Meta Top Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-muted mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-white/40 font-mono">0{index + 1}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-ivory/80">{work.year}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className="text-muted">{work.classification}</span>
                </div>
                <div className="px-2.5 py-0.5 rounded-full border border-white/10 text-[10px] font-mono text-ivory/90 bg-white/[0.02]">
                  {work.highlight}
                </div>
              </div>

              {/* Title & Tagline */}
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-4">
                <h3 className="text-xl sm:text-2xl font-normal text-white tracking-tight">
                  {work.title}
                </h3>
                <span className="text-xs sm:text-sm font-serif italic text-muted">
                  "{work.tagline}"
                </span>
              </div>

              {/* Summary */}
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed mb-6">
                {work.summary}
              </p>

              {/* Swiss Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 border-y border-white/[0.06] py-4 mb-4">
                {work.metrics.map((m, mIdx) => (
                  <div key={mIdx}>
                    <div className="text-lg sm:text-xl font-light text-white font-mono tracking-tight">
                      {m.val}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-muted font-mono mt-0.5">
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expandable Case Study Drawer */}
              {isExpanded && (
                <div className="pt-4 pb-2 border-b border-white/[0.06] mb-4 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs font-mono animate-fade-slow">
                  <div>
                    <span className="text-muted/70 uppercase tracking-wider block mb-2 text-[10px]">
                      Engineering Deliverables
                    </span>
                    <ul className="space-y-1.5">
                      {work.deliverables.map((item, dIdx) => (
                        <li key={dIdx} className="flex items-center gap-2 text-white/90">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-muted/70 uppercase tracking-wider block mb-2 text-[10px]">
                      Stack Employed
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {work.stack.map((t) => (
                        <span
                          key={t}
                          className="px-2.5 py-0.5 rounded-md border border-white/10 bg-white/[0.02] text-white/80 text-[11px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Toggle Blueprint Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => toggleExpand(work.id)}
                  className="text-xs font-mono text-muted hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <span>{isExpanded ? 'Collapse Blueprint' : 'Examine Architectural Blueprint'}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                <span className="text-[10px] font-mono text-muted/50">
                  {isExpanded ? 'Full Spec Open' : 'Click to inspect'}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

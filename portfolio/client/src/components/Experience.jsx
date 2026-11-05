import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function Experience({ experience }) {
  const [expandedIndices, setExpandedIndices] = useState([0]); // Default first (Fintua) open

  const toggleExpand = (idx) => {
    setExpandedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <section id="experience" className="py-[85px] sm:py-[105px] border-t border-[var(--border)]">
      <div className="flex justify-between items-baseline mb-[50px] sm:mb-[65px]">
        <span className="text-[13px] text-[var(--muted)] uppercase tracking-[2px] font-semibold">
          03 / Career
        </span>
        <h2 className="font-manrope text-[28px] sm:text-[34px] font-semibold tracking-[-1.2px] text-[var(--text)]">
          Experience
        </h2>
      </div>

      <div className="flex flex-col">
        {experience.map((item, idx) => {
          const isExpanded = expandedIndices.includes(idx);

          return (
            <article
              key={idx}
              className={`grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 sm:gap-[50px] py-[40px] border-t border-[var(--border)] ${
                idx === experience.length - 1 ? 'border-b border-[var(--border)]' : ''
              }`}
            >
              <div className="text-[var(--muted)] text-[13px] font-mono pt-1">
                {item.period}
              </div>

              <div>
                <h3 className="font-manrope text-[20px] sm:text-[23px] font-semibold text-[var(--text)] mb-1.5">
                  {item.role}
                </h3>

                <div className="text-[var(--muted)] text-[14px] sm:text-[15px] mb-4">
                  {item.company}
                </div>

                <p className="text-[var(--muted)] text-[15px] sm:text-[16px] max-w-[700px] leading-[1.85] mb-5">
                  {item.summary}
                </p>

                {/* Detailed Engineering Contributions */}
                {item.contributions && item.contributions.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => toggleExpand(idx)}
                      className="text-[13px] sm:text-[14px] text-[var(--text)] hover:text-[var(--accent)] font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <span>
                        {isExpanded
                          ? 'Hide Key Engineering Contributions'
                          : `View Key Engineering Contributions (${item.contributions.length})`}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 pl-4 border-l-2 border-[var(--accent)] space-y-5 max-w-[700px] animate-fade-slow">
                        {item.contributions.map((c, cIdx) => (
                          <div key={cIdx} className="space-y-1.5">
                            <h4 className="text-[14px] sm:text-[15px] font-semibold text-[var(--text)]">
                              {c.title}
                            </h4>
                            <p className="text-[14px] sm:text-[15px] text-[var(--muted)] leading-[1.8]">
                              {c.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Technologies */}
                {item.technologies && (
                  <div className="flex flex-wrap gap-2 mt-[24px]">
                    {item.technologies.map((tech) => (
                      <span
                        key={tech}
                        className="text-[11px] sm:text-[12px] text-[var(--tag-text)] bg-[var(--tag)] px-3 py-1 rounded-[3px] font-medium"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

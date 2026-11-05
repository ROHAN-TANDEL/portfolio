import React, { useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react';

export default function Projects({ projects }) {
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section id="work" className="py-[85px] sm:py-[105px] border-t border-[var(--border)]">
      <div className="flex justify-between items-baseline mb-[50px] sm:mb-[65px]">
        <span className="text-[13px] text-[var(--muted)] uppercase tracking-[2px] font-semibold">
          02 / Personal Work
        </span>
        <h2 className="font-manrope text-[28px] sm:text-[34px] font-semibold tracking-[-1.2px] text-[var(--text)]">
          Independent Platforms
        </h2>
      </div>

      <div className="flex flex-col">
        {projects.map((project, idx) => {
          const isExpanded = expandedId === project.number;

          return (
            <article
              key={project.number}
              className={`grid grid-cols-[38px_1fr] sm:grid-cols-[60px_1fr_150px] gap-4 sm:gap-[30px] py-[42px] border-t border-[var(--border)] items-start transition-all duration-200 hover:pl-2 ${
                idx === projects.length - 1 ? 'border-b border-[var(--border)]' : ''
              }`}
            >
              {/* Number */}
              <div className="text-[var(--muted)] opacity-70 text-[13px] pt-[6px] font-mono">
                {project.number}
              </div>

              {/* Content */}
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-[10px]">
                  <h3 className="font-manrope text-[22px] sm:text-[26px] font-semibold tracking-[-0.8px] text-[var(--text)]">
                    {project.name}
                  </h3>

                  {project.formerName && (
                    <span className="text-[13px] sm:text-[14px] text-[var(--muted)] italic">
                      ({project.formerName})
                    </span>
                  )}

                  {project.state && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] uppercase font-mono tracking-wider bg-[var(--accent-subtle)] text-[var(--accent)] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                      {project.state}
                    </span>
                  )}

                  {project.link && (
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors inline-flex items-center ml-auto sm:ml-0"
                      title={`Visit ${project.name}`}
                    >
                      <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </a>
                  )}
                </div>

                {project.subtitle && (
                  <div className="text-[14px] sm:text-[15px] font-medium text-[var(--text)] opacity-90 mb-2.5">
                    {project.subtitle}
                  </div>
                )}

                <p className="text-[var(--muted)] text-[15px] sm:text-[16px] max-w-[700px] leading-[1.85]">
                  {project.description}
                </p>

                {/* Technical Decisions & Architecture Accordion */}
                {project.highlights && (
                  <div className="mt-5">
                    <button
                      onClick={() => toggleExpand(project.number)}
                      className="text-[13px] sm:text-[14px] text-[var(--text)] hover:text-[var(--accent)] font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <span>
                        {isExpanded ? 'Hide Architecture Details' : 'View Architecture & Technical Decisions'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <ul className="mt-3.5 pl-4 border-l-2 border-[var(--accent)] space-y-2.5 text-[14px] sm:text-[15px] text-[var(--muted)] leading-[1.8] animate-fade-slow max-w-[700px]">
                        {project.highlights.map((h, hIdx) => (
                          <li key={hIdx} className="relative pl-3">
                            <span className="absolute left-0 top-2.5 w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Tech Tags */}
                <div className="flex flex-wrap gap-2 mt-[22px]">
                  {project.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="text-[11px] sm:text-[12px] text-[var(--tag-text)] bg-[var(--tag)] px-3 py-1 rounded-[3px] font-medium"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div className="text-right text-[12px] text-[var(--muted)] pt-[8px] hidden sm:block">
                {project.category}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

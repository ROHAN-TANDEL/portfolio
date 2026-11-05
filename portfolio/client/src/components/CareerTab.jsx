import React, { useState } from 'react';

export default function CareerTab({ career }) {
  const [selectedId, setSelectedId] = useState(career[0]?.id);
  const activeCompany = career.find((c) => c.id === selectedId) || career[0];

  return (
    <div className="bg-panel border border-line rounded-[26px] p-6 sm:p-8 md:p-9 mb-5 animate-viewFade shadow-xl">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Company Selector */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          <div className="text-xs uppercase tracking-wider font-bold text-accent mb-1">
            Career Timeline
          </div>
          {career.map((c) => {
            const isSelected = selectedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`text-left p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-accent bg-accent-dim shadow-sm'
                    : 'bg-panel-subtle border-line hover:border-line-light hover:bg-panel-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-bold text-sm ${
                      isSelected ? 'text-accent' : 'text-text-main'
                    }`}
                  >
                    {c.company}
                  </span>
                  <span className="text-[11px] font-mono text-text-dim">
                    {c.period.split('—')[0]}
                  </span>
                </div>
                <div className="text-xs text-text-muted font-medium mb-1 truncate">
                  {c.role}
                </div>
                <div className="text-[11px] text-text-dim">
                  {c.type}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Active Role Details */}
        <div className="lg:col-span-8 bg-panel-subtle border border-line rounded-2xl p-6 sm:p-7 flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
              <h3 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
                {activeCompany.role}
              </h3>
              <span className="text-xs font-semibold text-accent bg-accent/10 border border-accent/25 px-3 py-1 rounded-full">
                {activeCompany.period}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-text-muted mb-4">
              {activeCompany.company} · {activeCompany.type} — {activeCompany.desc}
            </p>

            {/* Stack Row */}
            <div className="flex flex-wrap gap-2 mb-6 pb-5 border-b border-line">
              {activeCompany.stack.map((t, idx) => (
                <span
                  key={t}
                  className={`text-xs px-3 py-1 rounded-full border ${
                    idx < 3
                      ? 'bg-accent-dim border-accent/30 text-accent font-semibold'
                      : 'bg-white/[0.03] border-line text-text-muted'
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>

            {/* Accomplishments Bullets with Arrow */}
            <ul className="space-y-3.5 text-xs sm:text-[13.5px] text-text-main/90 leading-relaxed">
              {activeCompany.accomplishments.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-accent font-extrabold text-sm shrink-0 leading-tight">
                    →
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

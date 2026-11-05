import React from 'react';

export default function CareerArchive({ archive }) {
  return (
    <section id="archive" className="py-20 px-6 max-w-4xl mx-auto border-t border-white/[0.08]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/[0.08] pb-6 mb-10 gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-[0.22em] text-muted uppercase">
            Index 03 / Track Record
          </span>
          <h2 className="text-2xl sm:text-4xl font-normal text-white mt-2 font-serif tracking-tight">
            Career Chronology
          </h2>
        </div>
        <p className="text-xs text-muted font-mono max-w-sm sm:text-right leading-relaxed">
          Guiding engineering organizations through critical architectural scale and inflection points.
        </p>
      </div>

      {/* Chronology Rows */}
      <div className="divide-y divide-white/[0.08]">
        {archive.map((item, idx) => (
          <div
            key={idx}
            className="py-7 grid grid-cols-1 md:grid-cols-12 gap-4 group hover:bg-white/[0.015] transition-colors rounded-xl px-3"
          >
            <div className="md:col-span-3 text-xs font-mono text-muted/70">
              {item.period}
            </div>

            <div className="md:col-span-4">
              <h3 className="text-base font-normal text-white group-hover:text-parchment transition-colors">
                {item.role}
              </h3>
              <p className="text-xs font-mono text-muted mt-0.5">
                {item.organization} · {item.context}
              </p>
            </div>

            <div className="md:col-span-5 text-xs text-muted/90 leading-relaxed">
              {item.impact}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

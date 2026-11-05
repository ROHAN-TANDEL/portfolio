import React from 'react';

export default function Principles({ principles }) {
  return (
    <section id="principles" className="py-20 px-6 max-w-4xl mx-auto border-t border-white/[0.08]">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-white/[0.08] pb-6 mb-12 gap-4">
        <div>
          <span className="text-[11px] font-mono tracking-[0.22em] text-muted uppercase">
            Index 02 / Philosophy
          </span>
          <h2 className="text-2xl sm:text-4xl font-normal text-white mt-2 font-serif tracking-tight">
            Notes on the Craft
          </h2>
        </div>
        <p className="text-xs text-muted font-mono max-w-sm sm:text-right leading-relaxed">
          Guiding architectural convictions refined through a decade of building high-concurrency systems.
        </p>
      </div>

      {/* Principles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {principles.map((p) => (
          <div
            key={p.number}
            className="border border-white/[0.08] rounded-2xl p-6 sm:p-7 bg-[#111317]/40 hover:border-white/20 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <span className="text-xs font-mono text-muted/50 block mb-4">
                /{p.number}
              </span>
              <h3 className="text-lg font-normal text-white mb-2.5 font-serif">
                {p.title}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {p.essay}
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-white/[0.06] text-[10px] font-mono text-muted/40 uppercase tracking-widest">
              Core Tenet
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

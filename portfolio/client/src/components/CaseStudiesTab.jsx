import React from 'react';
import { ArrowUpRight, Zap } from 'lucide-react';

export default function CaseStudiesTab({ caseStudies }) {
  return (
    <div className="bg-panel border border-line rounded-[26px] p-6 sm:p-8 md:p-9 mb-5 animate-viewFade shadow-xl">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-accent mb-1">
          Deep Architectural Inquiries
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
          Selected High-Impact Deployments
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
        {caseStudies.map((item, idx) => (
          <div
            key={idx}
            className="bg-panel-subtle border border-line rounded-2xl p-5.5 hover:border-line-light transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-accent mb-2">
                {item.badge}
              </div>

              <h4 className="text-base font-bold text-text-main group-hover:text-accent transition-colors leading-snug mb-3">
                {item.title}
              </h4>

              <p className="text-xs sm:text-[13px] text-text-muted leading-relaxed mb-5">
                {item.body}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-dim border border-emerald-400/20 px-3 py-1.5 rounded-xl mb-4">
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.impact}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-3 border-t border-line">
                {item.stack.map((t) => (
                  <span
                    key={t}
                    className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-line text-text-dim"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

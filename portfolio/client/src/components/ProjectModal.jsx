import React, { useEffect } from 'react';
import { X, Layers, AlertCircle, Wrench, ArrowRight } from 'lucide-react';

export default function ProjectModal({ work, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!work) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-viewFade"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-panel border border-[#3b414f] rounded-2xl p-6 sm:p-8 shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full border border-line hover:border-line-light text-text-muted hover:text-text-main transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-accent mb-2">
            <span>{work.number}</span>
            <span>·</span>
            <span>{work.tag}</span>
            <span>·</span>
            <span className="text-text-muted">{work.metric}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-main tracking-tight">
            {work.title}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-1.5 font-mono">
            {work.deepDive.subtitle}
          </p>
        </div>

        {/* The Context / Problem */}
        <div className="mb-6 p-4 rounded-xl bg-panel2 border border-line">
          <div className="text-xs uppercase tracking-wider font-bold text-accent mb-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>The Context & Friction</span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            {work.deepDive.context}
          </p>
        </div>

        {/* The Solution */}
        <div className="mb-6 p-4 rounded-xl bg-panel2 border border-line">
          <div className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5" />
            <span>What & How It Was Built</span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            {work.deepDive.solution}
          </p>
        </div>

        {/* The Trade-offs */}
        <div className="mb-6">
          <h4 className="text-xs uppercase tracking-wider font-bold text-text-main mb-2">
            Key Architectural Trade-offs
          </h4>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
            {work.deepDive.tradeoffs}
          </p>
        </div>

        {/* Stack */}
        <div className="pt-4 border-t border-line">
          <div className="text-xs font-mono uppercase text-text-dim mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Core Technologies</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {work.deepDive.stack.map((t) => (
              <span
                key={t}
                className="text-xs font-mono px-2.5 py-1 rounded-md bg-white/[0.03] border border-line text-text-muted"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

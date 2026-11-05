import React from 'react';

export default function MetricsBar({ metrics }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
      {metrics.map((metric, idx) => (
        <div
          key={idx}
          className="bg-panel border border-line rounded-[20px] p-5.5 hover:border-line-light hover:-translate-y-0.5 transition-all group"
        >
          <div
            className={`text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-1.5 ${
              metric.isAccent ? 'text-accent' : 'text-text-main'
            }`}
          >
            {metric.num}
          </div>
          <div className="text-xs text-text-muted font-medium">
            {metric.label}
          </div>
        </div>
      ))}
    </div>
  );
}

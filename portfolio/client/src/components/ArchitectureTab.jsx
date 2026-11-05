import React, { useState } from 'react';
import { Activity, Zap, Server, Database, ArrowRight } from 'lucide-react';

export default function ArchitectureTab({ pipeline }) {
  const [selectedStep, setSelectedStep] = useState(0);
  const activeStage = pipeline[selectedStep] || pipeline[0];

  return (
    <div className="bg-panel border border-line rounded-[26px] p-6 sm:p-8 md:p-9 mb-5 animate-viewFade shadow-xl">
      {/* Intro */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-accent mb-1">
          Interactive Architecture Spec
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
          High-Throughput Distributed Telemetry & Ingestion Pipeline
        </h3>
        <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-2xl">
          Click any stage in the pipeline to inspect connection load, protocol contracts, and real-time P99 benchmarks.
        </p>
      </div>

      {/* 5-Step Pipeline Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-6">
        {pipeline.map((p, idx) => {
          const isActive = selectedStep === idx;

          return (
            <button
              key={p.step}
              onClick={() => setSelectedStep(idx)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'border-accent bg-panel-hover shadow-[0_0_20px_rgba(216,255,97,0.12)]'
                  : 'bg-panel-subtle border-line hover:border-line-light'
              }`}
            >
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-accent mb-1">
                STEP {p.step}
              </div>
              <div className="font-bold text-xs sm:text-sm text-text-main mb-1 truncate">
                {p.name}
              </div>
              <div className="text-[11px] font-mono text-text-dim truncate">
                {p.tech}
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Stage Inspection Box */}
      <div className="bg-[#0b0d12] border border-line rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-5 border-b border-line">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulseGlow" />
              <span className="text-xs font-bold text-text-main uppercase tracking-wider">
                Active Component: {activeStage.name} ({activeStage.tech})
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-text-muted">
              {activeStage.detail}
            </p>
          </div>

          <div className="px-3 py-1 rounded-full bg-accent-dim border border-accent/25 text-accent text-xs font-mono font-semibold self-start md:self-auto">
            Zero Data Loss Guaranteed
          </div>
        </div>

        {/* Live Telemetry Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-accent font-mono tracking-tight">
              {activeStage.metrics.rps}
            </div>
            <div className="text-[11px] text-text-dim mt-0.5">Throughput / Load</div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-emerald-400 font-mono tracking-tight">
              {activeStage.metrics.latency}
            </div>
            <div className="text-[11px] text-text-dim mt-0.5">P99 Latency</div>
          </div>
          <div>
            <div className="text-lg sm:text-2xl font-extrabold text-text-main font-mono tracking-tight">
              {activeStage.metrics.dropRate}
            </div>
            <div className="text-[11px] text-text-dim mt-0.5">Packet Drop</div>
          </div>
        </div>
      </div>
    </div>
  );
}

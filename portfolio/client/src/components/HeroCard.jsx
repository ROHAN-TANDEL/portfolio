import React from 'react';
import { ArrowDown, Copy, Check, ArrowUpRight, Sparkles } from 'lucide-react';

export default function HeroCard({ profile, pillars, onOpenContact, onCopyEmail, copiedEmail }) {
  return (
    <section className="bg-panel border border-line rounded-[26px] p-6 sm:p-9 md:p-11 mb-5 relative overflow-hidden shadow-2xl">
      {/* Kicker Tag */}
      <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent mb-3.5">
        <Sparkles className="w-3.5 h-3.5" />
        <span>{profile.role.toUpperCase()} · {profile.specialty.toUpperCase()}</span>
      </div>

      {/* Main Heading */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-main leading-[1.1] mb-3.5 max-w-4xl">
        Designing resilient computing systems &{' '}
        <span className="text-accent underline decoration-accent/30 underline-offset-4">
          high-throughput architectures.
        </span>
      </h1>

      {/* Subheading */}
      <p className="text-sm sm:text-base md:text-[17px] text-text-muted leading-relaxed max-w-3xl mb-6">
        {profile.heroSubheading}
      </p>

      {/* Hero Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 mb-8">
        <a
          href="#views"
          className="inline-flex items-center gap-2 bg-accent text-[#090a0c] border border-accent hover:bg-[#e4ff85] hover:shadow-[0_0_20px_rgba(216,255,97,0.25)] px-4 py-2 rounded-full text-xs font-bold transition-all"
        >
          <span>Explore Architecture & Works</span>
          <ArrowDown className="w-3.5 h-3.5" />
        </a>

        <button
          onClick={onCopyEmail}
          className="inline-flex items-center gap-2 bg-panel-subtle border border-line hover:border-line-light text-text-main px-4 py-2 rounded-full text-xs font-semibold transition-all"
        >
          {copiedEmail ? (
            <>
              <Check className="w-3.5 h-3.5 text-accent" />
              <span className="text-accent">Email Copied to Clipboard</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-text-muted" />
              <span>Copy Direct Email</span>
            </>
          )}
        </button>

        <a
          href={profile.linkedin}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 bg-transparent border border-line hover:border-line-light text-text-muted hover:text-text-main px-3.5 py-2 rounded-full text-xs font-medium transition-all"
        >
          <span>LinkedIn</span>
          <ArrowUpRight className="w-3 h-3 text-text-dim" />
        </a>

        <a
          href={profile.github}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 bg-transparent border border-line hover:border-line-light text-text-muted hover:text-text-main px-3.5 py-2 rounded-full text-xs font-medium transition-all"
        >
          <span>GitHub</span>
          <ArrowUpRight className="w-3 h-3 text-text-dim" />
        </a>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-6 border-t border-line">
        {pillars.map((pillar, idx) => (
          <div
            key={idx}
            className="bg-panel-subtle border border-line rounded-2xl p-4.5 hover:border-line-light transition-colors"
          >
            <div className="text-sm font-bold text-text-main flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>{pillar.title}</span>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              {pillar.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

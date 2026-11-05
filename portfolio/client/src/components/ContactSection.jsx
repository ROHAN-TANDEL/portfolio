import React, { useState } from 'react';
import { Mail, Calendar, Copy, Check, ArrowUpRight } from 'lucide-react';
import { LinkedinIcon, GithubIcon } from './Icons';

export default function ContactSection({ profile, onCopyEmail, copiedEmail }) {
  const [copiedPhone, setCopiedPhone] = useState(false);

  const handleCopyPhone = () => {
    navigator.clipboard?.writeText('+1 (415) 890-4211');
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <section id="contact" className="bg-panel border border-line rounded-[26px] p-6 sm:p-8 md:p-9 mb-5 shadow-xl">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-wider text-accent mb-1">
          Direct Inquiries
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-text-main tracking-tight">
          Initiate a Technical or Advisory Dialogue
        </h3>
        <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-xl">
          Available for principal architecture roles, high-concurrency systems design, and AI infrastructure advisory.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Email Card */}
        <div className="bg-panel-subtle border border-line rounded-2xl p-4.5 flex flex-col justify-between gap-3 hover:border-line-light transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim">
              Email Channel
            </span>
            <button
              onClick={onCopyEmail}
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                copiedEmail
                  ? 'border-accent text-accent'
                  : 'border-line text-text-muted hover:border-line-light hover:text-text-main'
              }`}
            >
              {copiedEmail ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-text-main truncate">
            {profile.email}
          </div>
          <a
            href={`mailto:${profile.email}`}
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full border border-line hover:border-line-light bg-white/[0.02] text-xs font-medium text-text-main transition-all"
          >
            <span>Draft Email</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* LinkedIn Card */}
        <div className="bg-panel-subtle border border-line rounded-2xl p-4.5 flex flex-col justify-between gap-3 hover:border-line-light transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim">
              Professional Network
            </span>
            <LinkedinIcon className="w-3.5 h-3.5 text-text-dim" />
          </div>
          <div className="text-xs sm:text-sm font-semibold text-text-main">
            LinkedIn Profile
          </div>
          <a
            href={profile.linkedin}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full border border-line hover:border-line-light bg-white/[0.02] text-xs font-medium text-text-main transition-all"
          >
            <span>Connect on LinkedIn</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* GitHub Card */}
        <div className="bg-panel-subtle border border-line rounded-2xl p-4.5 flex flex-col justify-between gap-3 hover:border-line-light transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim">
              Open Source
            </span>
            <GithubIcon className="w-3.5 h-3.5 text-text-dim" />
          </div>
          <div className="text-xs sm:text-sm font-semibold text-text-main">
            github.com/rohan-tandel
          </div>
          <a
            href={profile.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full border border-line hover:border-line-light bg-white/[0.02] text-xs font-medium text-text-main transition-all"
          >
            <span>Inspect Repositories</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Direct Schedule Card */}
        <div className="bg-panel-subtle border border-line rounded-2xl p-4.5 flex flex-col justify-between gap-3 hover:border-line-light transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-dim">
              Advisory & Coffee
            </span>
            <Calendar className="w-3.5 h-3.5 text-text-dim" />
          </div>
          <div className="text-xs sm:text-sm font-semibold text-text-main">
            Architecture Call
          </div>
          <a
            href={profile.calendar}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full bg-accent text-[#090a0c] border border-accent hover:bg-[#e4ff85] text-xs font-bold transition-all"
          >
            <span>Schedule 30m Sync</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

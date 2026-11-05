import React, { useState } from 'react';
import { Copy, Check, Send, CheckCircle2 } from 'lucide-react';

export default function ContactDialogue({ profile, onCopyEmail, copiedEmail }) {
  const [formSent, setFormSent] = useState(false);
  const [inquiry, setInquiry] = useState({ name: '', email: '', message: '' });

  const handleSend = (e) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => {
      setFormSent(false);
      setInquiry({ name: '', email: '', message: '' });
    }, 2800);
  };

  return (
    <section id="contact" className="py-20 px-6 max-w-4xl mx-auto border-t border-white/[0.08]">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* Left Column */}
        <div className="md:col-span-5 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-mono tracking-[0.22em] text-muted uppercase">
              Index 04 / Channel
            </span>
            <h2 className="text-2xl sm:text-4xl font-normal text-white mt-2 font-serif tracking-tight">
              Initiate Dialogue
            </h2>
            <p className="text-xs text-muted mt-4 leading-relaxed">
              Available for principal architecture consulting, system design advisory, and leadership roles.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <div className="text-[10px] font-mono text-muted/50 uppercase tracking-widest">
              Direct Channel
            </div>
            <button
              onClick={onCopyEmail}
              className="group flex items-center justify-between w-full p-3.5 rounded-xl border border-white/10 hover:border-white/25 bg-[#111317]/50 text-xs font-mono text-ivory transition-all text-left"
            >
              <span className="truncate">{profile.email}</span>
              {copiedEmail ? (
                <span className="text-emerald-400 flex items-center gap-1.5 shrink-0 ml-2 text-[11px]">
                  <Check className="w-3.5 h-3.5" /> Copied
                </span>
              ) : (
                <span className="text-muted group-hover:text-white flex items-center gap-1.5 shrink-0 ml-2 text-[11px]">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Right Column / Form */}
        <div className="md:col-span-7 border border-white/[0.08] rounded-2xl p-6 sm:p-7 bg-[#111317]/40">
          {formSent ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-serif text-white mb-1">Message Transmitted</h3>
              <p className="text-xs font-mono text-muted">
                Your note has been dispatched. Alexandre will respond within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">
                  Identity / Organization
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor / Apex Systems"
                  value={inquiry.name}
                  onChange={(e) => setInquiry({ ...inquiry, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 transition-all placeholder:text-muted/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">
                  Electronic Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={inquiry.email}
                  onChange={(e) => setInquiry({ ...inquiry, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 transition-all placeholder:text-muted/30"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">
                  Context or Inquiries
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe your technical scope or timeline..."
                  value={inquiry.message}
                  onChange={(e) => setInquiry({ ...inquiry, message: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 transition-all placeholder:text-muted/30 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-white text-black text-xs font-mono uppercase tracking-wider hover:bg-parchment transition-all flex items-center justify-center gap-2"
              >
                <span>Transmit Note</span>
                <Send className="w-3 h-3" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer Strip */}
      <div className="mt-16 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-muted/70">
        <div>
          © 2026 {profile.name} · All systems nominal.
        </div>
        <div className="flex items-center gap-5">
          <a href={profile.github} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            GitHub
          </a>
          <a href={profile.linkedin} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            LinkedIn
          </a>
          <a href={profile.twitter} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
            X
          </a>
        </div>
      </div>
    </section>
  );
}

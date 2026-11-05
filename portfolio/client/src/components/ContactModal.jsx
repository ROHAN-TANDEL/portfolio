import React, { useState } from 'react';
import { X, Send, Mail, CheckCircle2, Copy } from 'lucide-react';

export default function ContactModal({ isOpen, onClose, email, onCopyEmail, copiedEmail }) {
  if (!isOpen) return null;

  const [formSent, setFormSent] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => {
      setFormSent(false);
      onClose();
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg glass-panel bg-[#0d101a] border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full glass-panel border border-slate-700 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-indigo-400 mb-1">
            <Mail className="w-3.5 h-3.5" />
            <span>LET'S CONNECT</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Initiate a Conversation
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Looking for architectural leadership, full-stack builds, or strategic advisory?
          </p>
        </div>

        {/* Direct Email Pill */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800 mb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300 truncate">
            <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">{email}</span>
          </div>
          <button
            onClick={onCopyEmail}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 shrink-0 transition-all"
          >
            {copiedEmail ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {formSent ? (
          <div className="p-8 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-white mb-1">Message Dispatched!</h3>
            <p className="text-xs text-slate-400">
              This prototype simulates sending the payload. Expect a reply within 24 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Your Name
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Sarah Connor"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Your Email
              </label>
              <input
                required
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                Project Scope or Note
              </label>
              <textarea
                required
                rows={3}
                placeholder="Briefly describe the challenge or scope..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Transmit Inquiry
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

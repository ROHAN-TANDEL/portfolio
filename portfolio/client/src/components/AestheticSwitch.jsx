import React, { useState } from 'react';
import { Sliders, Check } from 'lucide-react';

export default function AestheticSwitch({ mood, setMood }) {
  const [open, setOpen] = useState(false);

  const moods = [
    { id: 'obsidian', label: 'Obsidian Warmth', desc: 'Warm graphite with ivory highlights' },
    { id: 'champagne', label: 'Champagne Atelier', desc: 'Muted bronze with warm titanium glow' },
    { id: 'monochrome', label: 'Swiss Monochrome', desc: 'High-contrast pure black & white' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="absolute bottom-12 right-0 w-72 p-4 rounded-2xl bg-[#121418]/90 backdrop-blur-2xl border border-white/10 shadow-2xl animate-fade-slow mb-2 text-xs font-mono">
          <div className="text-[11px] uppercase tracking-wider text-muted mb-3 font-semibold">
            Tonal Palette & Mood
          </div>
          <div className="space-y-1.5">
            {moods.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMood(m.id);
                  setOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                  mood === m.id
                    ? 'border-white/30 bg-white/10 text-white'
                    : 'border-white/5 bg-transparent text-muted hover:text-white hover:border-white/15'
                }`}
              >
                <div>
                  <div className="font-medium text-white">{m.label}</div>
                  <div className="text-[10px] text-muted">{m.desc}</div>
                </div>
                {mood === m.id && <Check className="w-3.5 h-3.5 text-white shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2.5 rounded-full bg-[#121418]/80 hover:bg-[#181b22] border border-white/10 hover:border-white/20 text-xs font-mono text-muted hover:text-white backdrop-blur-xl shadow-xl transition-all flex items-center gap-2"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/40"></span>
        <span>Aesthetic Tone: <strong className="text-white font-normal">{moods.find(m => m.id === mood)?.label}</strong></span>
      </button>
    </div>
  );
}

import React, { useState } from 'react';
import { Palette, Sparkles, Sliders, Check, Eye } from 'lucide-react';

export default function ThemeControlBar({ theme, setTheme, glowEnabled, setGlowEnabled, density, setDensity }) {
  const [isOpen, setIsOpen] = useState(false);

  const themeOptions = [
    { id: 'indigo', name: 'Obsidian Indigo', accent: '#6366f1', glow: 'from-indigo-500/20 via-purple-500/10 to-transparent' },
    { id: 'emerald', name: 'Cyber Emerald', accent: '#10b981', glow: 'from-emerald-500/20 via-teal-500/10 to-transparent' },
    { id: 'violet', name: 'Electric Violet', accent: '#8b5cf6', glow: 'from-violet-500/20 via-fuchsia-500/10 to-transparent' },
    { id: 'amber', name: 'Warm Titanium', accent: '#f59e0b', glow: 'from-amber-500/20 via-orange-500/10 to-transparent' }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        {/* Expanded Controls Card */}
        {isOpen && (
          <div className="absolute bottom-14 right-0 w-80 glass-panel border border-slate-700/60 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl animate-fade-in text-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 font-medium text-slate-200">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <span>Look & Feel Preview Studio</span>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full font-mono">
                Interactive
              </span>
            </div>

            {/* Theme / Palette Selection */}
            <div className="space-y-2 mb-4">
              <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Color Palette & Mood
              </label>
              <div className="grid grid-cols-2 gap-2">
                {themeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      theme === opt.id
                        ? 'border-indigo-500/80 bg-indigo-500/10 text-white shadow-sm'
                        : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: opt.accent }}
                    />
                    <span className="truncate">{opt.name}</span>
                    {theme === opt.id && <Check className="w-3 h-3 ml-auto text-indigo-400" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Ambient Atmosphere */}
            <div className="space-y-2 mb-3">
              <label className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Atmospheric Glow
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGlowEnabled(true)}
                  className={`flex-1 py-1.5 px-3 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    glowEnabled
                      ? 'border-indigo-500/80 bg-indigo-500/10 text-indigo-300 font-medium'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  Rich Ambient
                </button>
                <button
                  onClick={() => setGlowEnabled(false)}
                  className={`flex-1 py-1.5 px-3 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    !glowEnabled
                      ? 'border-indigo-500/80 bg-indigo-500/10 text-indigo-300 font-medium'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  Clean Matte
                </button>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
              * Test these interactive vibes to decide the look and feel for the final portfolio!
            </div>
          </div>
        )}

        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="group flex items-center gap-2.5 px-4 py-2.5 rounded-full glass-panel border border-slate-700/80 shadow-xl hover:border-indigo-500/60 hover:shadow-indigo-500/20 text-slate-200 hover:text-white transition-all transform active:scale-95"
          title="Click to customize visual style"
        >
          <Palette className="w-4 h-4 text-indigo-400 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-medium">Switch Look & Feel</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
        </button>
      </div>
    </div>
  );
}

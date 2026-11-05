import React, { useState } from 'react';

export default function SkillsTab({ skills }) {
  const [activeFilter, setActiveFilter] = useState('All');

  const categories = ['All', ...Object.keys(skills)];

  const filteredCategories =
    activeFilter === 'All'
      ? Object.entries(skills)
      : Object.entries(skills).filter(([cat]) => cat === activeFilter);

  return (
    <div className="bg-panel border border-line rounded-[26px] p-6 sm:p-8 md:p-9 mb-5 animate-viewFade shadow-xl">
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeFilter === cat
                ? 'bg-white text-[#090a0c] font-bold shadow-sm'
                : 'bg-panel-subtle border border-line text-text-muted hover:text-text-main hover:border-line-light'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCategories.map(([category, items]) => (
          <div
            key={category}
            className="bg-panel-subtle border border-line rounded-2xl p-5 hover:border-line-light transition-colors"
          >
            <div className="text-sm font-bold text-text-main mb-3.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>{category}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {items.map((item) => (
                <span
                  key={item}
                  className="text-xs text-text-muted bg-white/[0.04] border border-line px-3 py-1 rounded-full hover:border-accent hover:text-text-main transition-colors"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

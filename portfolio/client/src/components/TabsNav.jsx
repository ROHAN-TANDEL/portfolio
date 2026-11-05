import React from 'react';
import { Briefcase, Cpu, GitBranch, Layers } from 'lucide-react';

export default function TabsNav({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'career', label: 'Career & Impact', icon: Briefcase },
    { id: 'skills', label: 'Technical Arsenal', icon: Cpu },
    { id: 'architecture', label: 'Pipeline Architecture', icon: GitBranch },
    { id: 'cases', label: 'Flagship Case Studies', icon: Layers },
  ];

  return (
    <div id="views" className="flex items-center gap-2 bg-panel border border-line rounded-full p-1.5 mb-5 overflow-x-auto shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[150px] py-2.5 px-4 rounded-full text-xs font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${
              isActive
                ? 'bg-accent text-[#090a0c] font-bold shadow-[0_4px_16px_rgba(216,255,97,0.25)]'
                : 'text-text-muted hover:text-text-main hover:bg-white/[0.04]'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#090a0c]' : 'text-text-dim'}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

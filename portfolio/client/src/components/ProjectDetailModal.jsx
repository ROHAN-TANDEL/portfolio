import React from 'react';
import { X, ExternalLink, CheckCircle2, Cpu, Zap, Layers } from 'lucide-react';
import { GithubIcon } from './Icons';

export default function ProjectDetailModal({ project, onClose }) {
  if (!project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl glass-panel bg-[#0d101a] border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full glass-panel border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {project.category}
            </span>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {project.metric}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {project.title}
          </h2>
          <p className="text-slate-400 text-sm mt-1">{project.subtitle}</p>
        </div>

        {/* Project Summary */}
        <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
            System Overview
          </h3>
          <p className="text-slate-300 text-sm leading-relaxed">{project.summary}</p>
        </div>

        {/* Architecture Highlights */}
        <div className="mb-6">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-indigo-400" />
            Engineering & Architecture Decisions
          </h3>
          <ul className="space-y-2.5">
            {project.architecture.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80"
              >
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Tech Stack Pills */}
        <div className="mb-8">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-400" />
            Stack Utilized
          </h3>
          <div className="flex flex-wrap gap-2">
            {project.techStack.map((tech) => (
              <span
                key={tech}
                className="text-xs font-mono px-3 py-1 rounded-lg bg-slate-800 text-slate-200 border border-slate-700"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>

        {/* Modal Footer CTAs */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
          <a
            href={project.links.demo}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Live Application
          </a>
          <a
            href={project.links.github}
            target="_blank"
            rel="noreferrer"
            className="flex-1 min-w-[140px] py-2.5 px-4 rounded-xl glass-panel border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-medium text-xs flex items-center justify-center gap-2 transition-all"
          >
            <GithubIcon className="w-4 h-4" />
            Repository Specs
          </a>
        </div>
      </div>
    </div>
  );
}

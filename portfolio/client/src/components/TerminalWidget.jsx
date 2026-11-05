import React, { useState, useRef, useEffect } from 'react';
import { Terminal, X, Minimize2, Maximize2, CornerDownLeft, Sparkles } from 'lucide-react';

export default function TerminalWidget({ isOpen, onClose, profile, projects }) {
  if (!isOpen) return null;

  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    { type: 'system', text: 'Alex Vance Interactive Dev Console v2.6.4' },
    { type: 'system', text: 'Type "help" or click quick chips below to explore.' }
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleCommand = (cmdText) => {
    const raw = cmdText.trim();
    const cmd = raw.toLowerCase();
    const newHistory = [...history, { type: 'user', text: `$ ${raw}` }];

    switch (cmd) {
      case 'help':
        newHistory.push({
          type: 'response',
          text: 'Available commands: whoami, stack, projects, stats, contact, clear, exit'
        });
        break;
      case 'whoami':
        newHistory.push({
          type: 'response',
          text: `${profile.name} — ${profile.role}. Located in ${profile.location}. Status: ${profile.status}`
        });
        break;
      case 'stack':
        newHistory.push({
          type: 'response',
          text: 'Core Stack: TypeScript, Go, React, Python, Kafka, ClickHouse, Docker, K8s, AWS.'
        });
        break;
      case 'projects':
        newHistory.push({
          type: 'response',
          text: projects.map((p) => `• [${p.title}] — ${p.subtitle} (${p.metric})`).join('\n')
        });
        break;
      case 'stats':
        newHistory.push({
          type: 'response',
          text: profile.stats.map((s) => `${s.label}: ${s.value}`).join(' | ')
        });
        break;
      case 'contact':
        newHistory.push({
          type: 'response',
          text: `Email: ${profile.social.email}\nGitHub: ${profile.social.github}\nLinkedIn: ${profile.social.linkedin}`
        });
        break;
      case 'clear':
        setHistory([]);
        setInput('');
        return;
      case 'exit':
        onClose();
        return;
      default:
        newHistory.push({
          type: 'error',
          text: `Command not recognized: "${raw}". Type "help" for a list of commands.`
        });
        break;
    }

    setHistory(newHistory);
    setInput('');
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleCommand(input);
  };

  const quickCommands = ['whoami', 'stack', 'projects', 'stats', 'contact'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-2xl bg-[#090b11] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[480px]">
        {/* Terminal Title Bar */}
        <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            </div>
            <div className="flex items-center gap-1.5 ml-3 text-xs font-mono text-slate-300">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>alex-vance@shell ~ %</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="bg-slate-900/40 px-4 py-2 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs font-mono">
          <span className="text-[11px] text-slate-400 shrink-0">Quick run:</span>
          {quickCommands.map((c) => (
            <button
              key={c}
              onClick={() => handleCommand(c)}
              className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-slate-700 transition-all shrink-0 text-[11px]"
            >
              {c}
            </button>
          ))}
        </div>

        {/* Output Area */}
        <div className="flex-1 p-4 font-mono text-xs sm:text-sm overflow-y-auto space-y-2 text-slate-300">
          {history.map((h, i) => (
            <div key={i} className="whitespace-pre-wrap leading-relaxed">
              {h.type === 'system' && (
                <span className="text-slate-400 italic">{h.text}</span>
              )}
              {h.type === 'user' && (
                <span className="text-indigo-400 font-semibold">{h.text}</span>
              )}
              {h.type === 'response' && (
                <span className="text-emerald-300">{h.text}</span>
              )}
              {h.type === 'error' && (
                <span className="text-rose-400">{h.text}</span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Command Input Form */}
        <form
          onSubmit={onSubmit}
          className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center gap-2"
        >
          <span className="font-mono text-indigo-400 text-xs">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type 'help' or any command..."
            className="flex-1 bg-transparent text-white font-mono text-xs focus:outline-none placeholder:text-slate-500"
            autoFocus
          />
          <button
            type="submit"
            className="text-xs font-mono px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center gap-1"
          >
            Run
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
}

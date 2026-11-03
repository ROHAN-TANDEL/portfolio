import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cleanCodeSnippet } from '../utils/helpers';

export function CodeViewer({ code }) {
  const [copied, setCopied] = useState(false);
  const cleaned = cleanCodeSnippet(code);

  if (!cleaned) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleaned);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950/90 font-mono text-xs md:text-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800 text-zinc-400">
        <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400">Code Snippet</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors py-0.5 px-2 rounded hover:bg-zinc-800"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-sans text-xs">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-sans text-xs">Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-zinc-200 leading-relaxed font-mono whitespace-pre">
        <code>{cleaned}</code>
      </div>
    </div>
  );
}

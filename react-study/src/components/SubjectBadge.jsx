import React from 'react';
import { 
  Database, 
  Cloud, 
  Server, 
  Layers, 
  Cpu, 
  Radio, 
  ShieldCheck, 
  Boxes,
  Code2
} from 'lucide-react';

export function SubjectBadge({ subject, size = 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-11 h-11 text-sm';
  const iconId = subject.id?.toLowerCase() || '';

  // JavaScript
  if (iconId.includes('javascript') || iconId === 'js') {
    return (
      <div className={`${sizeClasses} rounded-xl bg-[#F7DF1E] text-black font-extrabold flex items-center justify-center shadow-xs select-none tracking-tight`}>
        JS
      </div>
    );
  }

  // Node.js
  if (iconId.includes('node')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shadow-xs select-none tracking-tight`}>
        <span className="font-mono text-xs">Node</span>
      </div>
    );
  }

  // TypeScript
  if (iconId.includes('typescript') || iconId === 'ts') {
    return (
      <div className={`${sizeClasses} rounded-xl bg-[#3178C6] text-white font-extrabold flex items-center justify-center shadow-xs select-none tracking-tight`}>
        TS
      </div>
    );
  }

  // React
  if (iconId.includes('react')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-700/60 text-cyan-500 font-bold flex items-center justify-center shadow-xs select-none text-xl`}>
        ⚛
      </div>
    );
  }

  // SQL / Postgres
  if (iconId.includes('sql') || iconId.includes('pgsql')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs`}>
        <Database className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </div>
    );
  }

  // AWS IAM / AWS general
  if (iconId.includes('awsiam') || iconId.includes('aws') || iconId.includes('iam')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shadow-xs tracking-tight select-none`}>
        <span className="text-[11px] font-black">aws</span>
      </div>
    );
  }

  // Python
  if (iconId.includes('python') || iconId.includes('py')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-amber-100/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 font-bold flex items-center justify-center shadow-xs`}>
        🐍
      </div>
    );
  }

  // Golang
  if (iconId.includes('go') || iconId.includes('golang')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-700 text-cyan-600 dark:text-cyan-400 font-black flex items-center justify-center shadow-xs tracking-tight text-xs`}>
        GO
      </div>
    );
  }

  // Angular
  if (iconId.includes('angular')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-700/60 text-rose-600 dark:text-rose-400 font-black flex items-center justify-center shadow-xs tracking-tight text-xs`}>
        NG
      </div>
    );
  }

  // Express
  if (iconId.includes('express')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold flex items-center justify-center shadow-xs text-xs font-mono`}>
        ex
      </div>
    );
  }

  // S3 / SQS / EC2 / Lambda / VPC
  if (iconId.includes('s3') || iconId.includes('sqs') || iconId.includes('ec2') || iconId.includes('vpc')) {
    return (
      <div className={`${sizeClasses} rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs`}>
        {iconId.includes('s3') ? <Cloud className="w-5 h-5" /> :
         iconId.includes('sqs') ? <Boxes className="w-5 h-5" /> :
         iconId.includes('ec2') ? <Cpu className="w-5 h-5" /> :
         <ShieldCheck className="w-5 h-5" />}
      </div>
    );
  }

  // Default fallback
  return (
    <div className={`${sizeClasses} rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 font-bold flex items-center justify-center shadow-xs`}>
      <Layers className="w-5 h-5" />
    </div>
  );
}

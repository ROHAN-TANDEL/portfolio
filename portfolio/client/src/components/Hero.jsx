import React from 'react';
import { Download } from 'lucide-react';

export default function Hero({ hero, resumes = [] }) {
  return (
    <div className="py-[100px] sm:py-[130px] max-w-[920px] hero-arrive relative overflow-x-clip">
      {/* Very light faded origami boat floating continuously from left to right */}
      <div
        className="absolute top-6 sm:top-2 pointer-events-none select-none -z-10 boat-sail-track"
        aria-hidden="true"
      >
        <div
          className="boat-water-bob w-[290px] sm:w-[460px] lg:w-[560px]"
          style={{
            maskImage:
              'radial-gradient(ellipse at 58% 52%, black 40%, rgba(0,0,0,0.5) 60%, transparent 75%)',
            WebkitMaskImage:
              'radial-gradient(ellipse at 58% 52%, black 40%, rgba(0,0,0,0.5) 60%, transparent 75%)'
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}boat.png`}
            alt="Paper boat illustration"
            className="w-full h-auto object-contain dark:mix-blend-screen mix-blend-multiply filter dark:invert-0 invert contrast-125 dark:contrast-110"
          />
        </div>
      </div>

      {/* Eyebrow */}
      <div className="uppercase tracking-[2.2px] text-[12px] font-semibold text-[var(--accent)] mb-7 transition-colors duration-200">
        {hero.eyebrow}
      </div>

      {/* Main Title */}
      <h1 className="font-manrope text-[clamp(50px,7.5vw,92px)] leading-[1.05] tracking-[-3px] sm:tracking-[-4.5px] font-semibold mb-[32px] text-[var(--text)]">
        Building systems <br className="hidden sm:inline" />
        that <span className="text-[var(--muted)] opacity-90">scale with purpose.</span>
      </h1>

      {/* Description */}
      <p className="max-w-[720px] text-[var(--muted)] text-[18px] sm:text-[20px] leading-[1.8]">
        {hero.description}
      </p>

      {/* Meta Chips */}
      <div className="flex flex-wrap gap-7 mt-10 text-[13px] sm:text-[14px] text-[var(--muted)]">
        {hero.meta.map((item, idx) => (
          <span key={idx} className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] inline-block shrink-0 opacity-80" />
            <span>{item}</span>
          </span>
        ))}
      </div>

      {/* Tailored Résumé Downloads */}
      {resumes.length > 0 && (
        <div className="mt-10 pt-6 border-t border-[var(--border)]/70 max-w-[760px]">
          <div className="text-[12px] uppercase tracking-[1.5px] font-semibold text-[var(--muted)] mb-3">
            Download Tailored Résumé (PDF)
          </div>
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            {resumes.map((resume) => (
              <a
                key={resume.id}
                href={`${import.meta.env.BASE_URL}${resume.filename}`}
                download={resume.filename}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--accent)] transition-all group text-[13px] font-medium text-[var(--text)]"
                title={`Download ${resume.title} (${resume.role})`}
              >
                <span>{resume.label || resume.title}</span>
                <Download className="w-3.5 h-3.5 text-[var(--accent)] transition-transform group-hover:translate-y-0.5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

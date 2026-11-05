import React from 'react';

export default function About({ about }) {
  return (
    <section id="about" className="py-[85px] sm:py-[105px] border-t border-[var(--border)]">
      <div className="flex justify-between items-baseline mb-[50px] sm:mb-[65px]">
        <span className="text-[13px] text-[var(--muted)] uppercase tracking-[2px] font-semibold">
          01 / Introduction
        </span>
        <h2 className="font-manrope text-[28px] sm:text-[34px] font-semibold tracking-[-1.2px] text-[var(--text)]">
          About
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-20">
        <div className="font-manrope text-[22px] sm:text-[28px] leading-[1.5] tracking-[-0.8px] text-[var(--text)]">
          {about.main}
        </div>
        <div className="text-[15px] sm:text-[16px] leading-[1.9] text-[var(--muted)] space-y-[20px]">
          {about.paragraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

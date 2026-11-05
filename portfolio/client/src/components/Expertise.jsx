import React from 'react';

export default function Expertise({ expertise }) {
  return (
    <section id="expertise" className="py-[85px] sm:py-[105px] border-t border-[var(--border)]">
      <div className="flex justify-between items-baseline mb-[50px] sm:mb-[65px]">
        <span className="text-[13px] text-[var(--muted)] uppercase tracking-[2px] font-semibold">
          04 / Capabilities
        </span>
        <h2 className="font-manrope text-[28px] sm:text-[34px] font-semibold tracking-[-1.2px] text-[var(--text)]">
          Expertise
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-x-12 sm:gap-y-12">
        {expertise.map((group, idx) => (
          <div key={idx} className="reveal-item">
            <h3 className="font-manrope text-[17px] sm:text-[18px] font-semibold text-[var(--text)] mb-[18px]">
              {group.title}
            </h3>

            <ul className="list-none">
              {group.skills.map((skill, sIdx) => (
                <li
                  key={sIdx}
                  className="text-[var(--muted)] text-[14px] sm:text-[15px] py-[8px] border-b border-[var(--border)]"
                >
                  {skill}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

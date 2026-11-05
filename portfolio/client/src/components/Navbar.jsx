import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Palette, Download, ChevronDown, FileText } from 'lucide-react';

const ACCENT_OPTIONS = [
  { id: 'rust', label: 'Rust Oxide', lightHex: '#c25e38', darkHex: '#e07a52' },
  { id: 'sage', label: 'Forest Pine', lightHex: '#2d5a3f', darkHex: '#5ea378' },
  { id: 'slate', label: 'Prussian Slate', lightHex: '#2a4e6c', darkHex: '#689cc5' },
  { id: 'olive', label: 'Slate Olive', lightHex: '#444a43', darkHex: '#9ba59a' }
];

export default function Navbar({
  identity,
  darkMode,
  onToggleTheme,
  currentAccent,
  onSelectAccent,
  resumes = []
}) {
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);
  const [showResumeMenu, setShowResumeMenu] = useState(false);
  const resumeMenuRef = useRef(null);

  const handleCycleAccent = () => {
    const currentIndex = ACCENT_OPTIONS.findIndex((opt) => opt.id === currentAccent);
    const nextIndex = (currentIndex + 1) % ACCENT_OPTIONS.length;
    onSelectAccent(ACCENT_OPTIONS[nextIndex].id);
  };

  const currentOption =
    ACCENT_OPTIONS.find((opt) => opt.id === currentAccent) || ACCENT_OPTIONS[0];

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (resumeMenuRef.current && !resumeMenuRef.current.contains(event.target)) {
        setShowResumeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-[76px] border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
      <nav className="container-custom h-full flex justify-between items-center">
        <a
          href="#"
          className="font-manrope text-[18px] font-extrabold tracking-[-0.7px] text-[var(--text)] hover:text-[var(--accent)] transition-colors"
        >
          {identity.name}
        </a>

        <div className="flex items-center gap-4 sm:gap-7 text-[14px] text-[var(--muted)]">
          <a
            href="#about"
            className="hover:text-[var(--text)] transition-colors hidden sm:inline"
          >
            About
          </a>
          <a
            href="#work"
            className="hover:text-[var(--text)] transition-colors"
          >
            Personal Work
          </a>
          <a
            href="#experience"
            className="hover:text-[var(--text)] transition-colors hidden md:inline"
          >
            Career
          </a>
          <a
            href="#expertise"
            className="hover:text-[var(--text)] transition-colors hidden md:inline"
          >
            Capabilities
          </a>
          <a
            href="#contact"
            className="hover:text-[var(--text)] transition-colors"
          >
            Contact
          </a>

          {/* Tailored Résumé Dropdown */}
          <div
            ref={resumeMenuRef}
            className="relative"
            onMouseEnter={() => setShowResumeMenu(true)}
            onMouseLeave={() => setShowResumeMenu(false)}
          >
            <button
              onClick={() => setShowResumeMenu((prev) => !prev)}
              className="text-[var(--text)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-1.5 font-medium py-1 focus:outline-none"
              aria-haspopup="true"
              aria-expanded={showResumeMenu}
              title="Select tailored PDF résumé"
            >
              <span>Résumé</span>
              <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
              <ChevronDown
                className={`w-3 h-3 text-[var(--muted)] transition-transform duration-200 ${
                  showResumeMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {showResumeMenu && (
              <div className="absolute right-0 top-full mt-2 w-[280px] sm:w-[320px] bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl p-2 z-50 animate-fade-slow">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--muted)] border-b border-[var(--border)] mb-1">
                  Tailored Résumés (PDF)
                </div>
                <div className="flex flex-col gap-1">
                  {resumes.map((resume) => (
                    <a
                      key={resume.id}
                      href={`/${resume.filename}`}
                      download={resume.filename}
                      className="group flex flex-col px-3 py-2 rounded-md hover:bg-[var(--surface-hover)] transition-colors text-left"
                      title={`Download ${resume.title}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-manrope font-semibold text-[13px] text-[var(--text)] group-hover:text-[var(--accent)] transition-colors">
                          {resume.label || resume.title}
                        </span>
                        <Download className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors shrink-0" />
                      </div>
                      <span className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-1">
                        {resume.highlight}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Clean borderless icon controls */}
          <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-[var(--border)]">
            {/* Palette Switcher Icon */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowPaletteMenu(true)}
              onMouseLeave={() => setShowPaletteMenu(false)}
            >
              <button
                onClick={handleCycleAccent}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] transition-transform hover:scale-110 focus:outline-none"
                title={`Accent: ${currentOption.label} (Click to cycle)`}
                aria-label={`Cycle accent color (currently ${currentOption.label})`}
              >
                <Palette
                  className="w-4 h-4 transition-colors duration-200"
                  style={{ color: 'var(--accent)' }}
                />
              </button>

              {/* Discreet hover popover with dots */}
              {showPaletteMenu && (
                <div className="absolute top-full right-0 mt-2 p-2 bg-[var(--surface)] border border-[var(--border)] rounded-full shadow-lg flex items-center gap-2 z-50 animate-fade-slow">
                  {ACCENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAccent(opt.id);
                      }}
                      className={`w-3.5 h-3.5 rounded-full transition-transform ${
                        currentAccent === opt.id
                          ? 'scale-125 ring-2 ring-offset-1 ring-[var(--text)] ring-offset-[var(--surface)]'
                          : 'opacity-50 hover:opacity-100 hover:scale-110'
                      }`}
                      style={{
                        backgroundColor: darkMode ? opt.darkHex : opt.lightHex
                      }}
                      title={opt.label}
                      aria-label={`Select ${opt.label}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Dark / Light Theme Toggle Icon */}
            <button
              onClick={onToggleTheme}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--text)] transition-transform hover:scale-110 focus:outline-none"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle dark/light theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}

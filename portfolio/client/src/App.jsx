import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Projects from './components/Projects';
import Experience from './components/Experience';
import Expertise from './components/Expertise';
import Contact from './components/Contact';
import Footer from './components/Footer';
import { portfolio } from './data/portfolioData';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved !== null) return saved === 'dark';
    return true; // Default to dark theme
  });

  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem('accent') || 'rust';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
    localStorage.setItem('accent', accentColor);
  }, [accentColor]);

  // On-scroll reveal motion using IntersectionObserver
  useEffect(() => {
    // Select granular targets without double-nesting:
    // - Editorial sections (#about, #contact)
    // - Individual list articles (#work article, #experience article)
    // - Individual capability cards (.reveal-item)
    const targets = document.querySelectorAll(
      '#about, #work article, #experience article, .reveal-item, #contact'
    );

    targets.forEach((element, index) => {
      element.classList.add('reveal');
      element.classList.add(`reveal-delay-${(index % 3) + 1}`);
    });

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.05,
          rootMargin: '0px 0px -20px 0px'
        }
      );

      targets.forEach((el) => observer.observe(el));

      return () => {
        observer.disconnect();
      };
    } else {
      targets.forEach((el) => el.classList.add('is-visible'));
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors duration-200 relative">
      {/* Ultra-fine hairline golden strip */}
      <div
        className="fixed top-0 left-0 right-0 h-[1px] z-50 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(197, 160, 89, 0.3) 12%, rgba(242, 211, 136, 0.95) 50%, rgba(197, 160, 89, 0.3) 88%, transparent 100%)',
          boxShadow: '0 0 6px rgba(242, 211, 136, 0.35)'
        }}
        aria-hidden="true"
      />

      {/* Header */}
      <Navbar
        identity={portfolio.identity}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
        currentAccent={accentColor}
        onSelectAccent={setAccentColor}
      />

      {/* Main Content */}
      <main className="container-custom">
        <Hero hero={portfolio.hero} />
        <About about={portfolio.about} />
        <Projects projects={portfolio.personalProjects} />
        <Experience experience={portfolio.experience} />
        <Expertise expertise={portfolio.expertise} />
        <Contact contact={portfolio.contact} identity={portfolio.identity} />
      </main>

      {/* Footer */}
      <Footer identity={portfolio.identity} />
    </div>
  );
}

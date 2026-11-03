import { useState, useEffect, useMemo } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/helpers';

export function useSubjectData() {
  const [subjects, setSubjects] = useState([]);
  const [activeSubjectId, setActiveSubjectId] = useState(() => {
    return loadFromStorage('flashlearn_active_subject', 'javascript');
  });
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load master list of subjects
  useEffect(() => {
    async function loadSubjects() {
      try {
        const res = await fetch('/data/subjects.json');
        if (!res.ok) throw new Error('Failed to load subjects configuration');
        const list = await res.json();
        setSubjects(list);
        // Default to first if stored activeSubjectId not found
        if (list.length > 0 && !list.find((s) => s.id === activeSubjectId)) {
          setActiveSubjectId(list[0].id);
        }
      } catch (err) {
        console.error('Error loading subjects:', err);
        setError('Could not load subjects. Please check data/subjects.json');
      }
    }
    loadSubjects();
  }, []);

  const activeSubject = useMemo(() => {
    return subjects.find((s) => s.id === activeSubjectId) || null;
  }, [subjects, activeSubjectId]);

  // Load cards for active subject
  useEffect(() => {
    if (!activeSubject) return;

    saveToStorage('flashlearn_active_subject', activeSubject.id);
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    async function loadSubjectCards() {
      try {
        const res = await fetch(`/data/${activeSubject.dataFile}`);
        if (!res.ok) {
          throw new Error(`Failed to load ${activeSubject.dataFile} (status: ${res.status})`);
        }
        const data = await res.json();
        if (!isCancelled) {
          // Normalize items to ensure unique IDs and valid fields
          const normalized = (Array.isArray(data) ? data : []).map((item, idx) => ({
            ...item,
            id: item.id || `${activeSubject.id}-${idx + 1}`,
            category: item.category || 'General',
            concept: item.concept || item.topic || `Topic ${idx + 1}`,
            question: item.question || 'Review the details for this concept.',
            answer: item.answer || '',
            explanation: item.explanation || '',
            code: item.code || '',
            recallHint: item.recallHint || '',
            practice: Array.isArray(item.practice) ? item.practice : item.practice ? [item.practice] : [],
          }));
          setCards(normalized);
          setIsLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error(`Error loading cards for ${activeSubject.name}:`, err);
          setError(`Unable to load questions for ${activeSubject.name}.`);
          setCards([]);
          setIsLoading(false);
        }
      }
    }

    loadSubjectCards();

    return () => {
      isCancelled = true;
    };
  }, [activeSubject]);

  // Categories present in current subject
  const categories = useMemo(() => {
    const set = new Set();
    cards.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [cards]);

  return {
    subjects,
    activeSubject,
    activeSubjectId,
    setActiveSubjectId,
    cards,
    categories,
    isLoading,
    error,
  };
}

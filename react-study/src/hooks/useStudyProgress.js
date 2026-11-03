import { useState, useEffect, useCallback } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/helpers';

export function useStudyProgress(subjectId) {
  const storageKey = `flashlearn_progress_${subjectId}`;

  // cardId -> { topicNotes, userAnswer, revealed, status: 'unseen'|'review'|'learning'|'mastered', lastUpdated }
  const [progress, setProgress] = useState(() => {
    if (!subjectId) return {};
    return loadFromStorage(storageKey, {});
  });

  // Reload when subjectId changes
  useEffect(() => {
    if (subjectId) {
      setProgress(loadFromStorage(storageKey, {}));
    }
  }, [subjectId, storageKey]);

  // Update a single card field
  const updateCardProgress = useCallback((cardId, updates) => {
    setProgress((prev) => {
      const current = prev[cardId] || {
        topicNotes: '',
        userAnswer: '',
        revealed: false,
        status: 'unseen',
      };
      const updated = {
        ...current,
        ...updates,
        lastUpdated: Date.now(),
      };
      const next = { ...prev, [cardId]: updated };
      saveToStorage(storageKey, next);
      return next;
    });
  }, [storageKey]);

  // Clear progress for this subject
  const resetSubjectProgress = useCallback(() => {
    if (window.confirm('Are you sure you want to reset your notes and progress for this subject?')) {
      setProgress({});
      saveToStorage(storageKey, {});
    }
  }, [storageKey]);

  return {
    progress,
    updateCardProgress,
    resetSubjectProgress,
  };
}

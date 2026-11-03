// Archive registry: dynamically discovers and loads archive files from data/
// Matches files like:
// - typescript.archive.v1.json
// - javascript-archive-v1.json
// - react.archive.v2.json
// - <subject>_archive_<version>.json

export const archiveModules = import.meta.glob('../../data/*archive*.json', { eager: true });

function normalizeArchiveCards(subjectId, version, list = []) {
  if (!Array.isArray(list)) return [];
  return list.map((item, idx) => ({
    ...item,
    id: item.id || `${subjectId}-arch-${version}-${idx + 1}`,
    category: item.category || 'General',
    concept: item.concept || item.topic || `Topic ${idx + 1}`,
    question: item.question || 'Review details for this concept.',
    answer: item.answer || '',
    explanation: item.explanation || '',
    code: item.code || '',
    recallHint: item.recallHint || '',
    practice: Array.isArray(item.practice)
      ? item.practice
      : item.practice
      ? [item.practice]
      : [],
    priority: item.priority || 'must-know',
  }));
}

/**
 * Returns available archives for a subject or all subjects with full metadata precomputed.
 * Sorted by version descending (e.g. v2 before v1).
 */
export function getAvailableArchives(subjectId) {
  const archives = [];
  const targetId = subjectId ? subjectId.toLowerCase() : null;

  for (const path in archiveModules) {
    const filename = path.split('/').pop() || '';
    
    // Pattern 1: <subject>.archive.<version>.json or <subject>-archive-<version>.json
    // Pattern 2: <subject>.<version>.archive.json
    let match = filename.match(/^([a-zA-Z0-9_-]+)[._-]archive[._-]?([\w\d.-]+)?\.json$/i);
    let fileSubject = '';
    let rawVersion = 'v1';

    if (match) {
      fileSubject = match[1].toLowerCase();
      rawVersion = match[2] || 'v1';
    } else {
      const match2 = filename.match(/^([a-zA-Z0-9_-]+)[._-](v[\w\d.-]+)[._-]archive\.json$/i);
      if (match2) {
        fileSubject = match2[1].toLowerCase();
        rawVersion = match2[2];
      }
    }

    if (fileSubject) {
      if (!targetId || fileSubject === targetId) {
        const cleanVersion = rawVersion.replace(/^[vV]/, '');
        const versionLabel = `Version ${cleanVersion || '1'}`;
        
        const mod = archiveModules[path];
        const rawList = mod?.default || mod || [];
        const normalized = normalizeArchiveCards(fileSubject, rawVersion, rawList);

        // Compute category breakdown
        const categoryMap = {};
        normalized.forEach((c) => {
          const cat = c.category || 'General';
          categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });

        const categories = Object.entries(categoryMap).map(([name, count]) => ({
          name,
          count,
        })).sort((a, b) => b.count - a.count);

        archives.push({
          subjectId: fileSubject,
          version: rawVersion,
          versionLabel,
          filename,
          path,
          cardCount: normalized.length,
          categories,
          firstId: normalized[0]?.id || null,
          lastId: normalized[normalized.length - 1]?.id || null,
          cards: normalized,
        });
      }
    }
  }

  // Sort descending: e.g. v3, v2, v1
  return archives.sort((a, b) => {
    return b.version.localeCompare(a.version, undefined, { numeric: true });
  });
}

/**
 * Loads and normalizes cards from an archive file.
 */
export async function loadArchiveCards(archive) {
  if (!archive) return [];
  if (archive.cards && archive.cards.length > 0) {
    return archive.cards;
  }

  // Fallback to fetch from /data/ if ever needed
  try {
    const res = await fetch(`/data/${archive.filename}`);
    if (res.ok) {
      const rawData = await res.json();
      return normalizeArchiveCards(archive.subjectId, archive.version, rawData);
    }
  } catch (err) {
    console.warn(`Fallback fetch failed for ${archive.filename}:`, err);
  }

  return [];
}

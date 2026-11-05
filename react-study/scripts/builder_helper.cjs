const fs = require('fs');
const path = require('path');

// Helper to construct both cards
function makeItem({
  idNum,
  category,
  concept,
  priority = 'must-know',
  question,
  quickAnswer,
  answer,
  explanation,
  code,
  recallHint,
  interviewTip,
  practice,
  difficulty = 'Intermediate',
  isInterview = true,
  isFaq = true,
  section = 'both',
  tags = []
}) {
  const idStr = String(idNum).padStart(3, '0');
  const theoryId = `node-${idStr}`;
  const qaId = `node-qa-${idStr}`;

  const defaultTags = [
    difficulty.toLowerCase(),
    isInterview ? 'interview' : null,
    isFaq ? 'faq' : null,
    concept.toLowerCase()
  ].filter(Boolean);

  const mergedTags = [...new Set([...defaultTags, ...tags])];

  const theoryCard = {
    id: theoryId,
    category,
    concept,
    priority,
    question,
    answer,
    code: code || '',
    explanation: explanation || answer,
    recallHint: recallHint || quickAnswer,
    practice: practice || [
      `Explain ${concept} in your own words without looking at the answer.`,
      `Describe a high-throughput production scenario where ${concept} affects reliability.`
    ]
  };

  const qaCard = {
    id: qaId,
    conceptId: theoryId,
    concept,
    category,
    priority,
    question,
    quickAnswer,
    detailedAnswer: `${answer}\n\n${explanation || ''}`.trim(),
    code: code || '',
    interviewTip: interviewTip || `In senior interviews, explain the under-the-hood engine mechanism first, then connect it to failure modes and operational trade-offs.`,
    practice: practice || [
      `Explain ${concept} in your own words without looking at the answer.`,
      `Describe a high-throughput production scenario where ${concept} affects reliability.`
    ],
    difficulty,
    isInterview,
    isFaq,
    section,
    tags: mergedTags
  };

  return { theoryCard, qaCard };
}

module.exports = { makeItem };

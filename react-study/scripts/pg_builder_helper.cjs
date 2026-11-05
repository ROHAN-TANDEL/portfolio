/**
 * Helper to construct paired Theory and Q&A items for PostgreSQL (pgsql)
 */
function createCard(options) {
  const {
    idNum,
    category,
    concept,
    priority = "must-know",
    difficulty = "intermediate",
    question,
    answer,
    explanation,
    code,
    recallHint,
    practice = [],
    quickAnswer,
    detailedAnswer,
    interviewTip,
    tags = [],
    isInterview = true,
    isFaq = true,
    section = "interview"
  } = options;

  const padded = String(idNum).padStart(3, "0");
  const theoryId = `pgsql-${padded}`;
  const qaId = `pgsql-qa-${padded}`;

  const theoryCard = {
    id: theoryId,
    category,
    concept,
    priority,
    question,
    answer: answer || quickAnswer,
    code,
    explanation: explanation || detailedAnswer,
    recallHint,
    practice
  };

  const qaCard = {
    id: qaId,
    conceptId: theoryId,
    concept,
    category,
    priority,
    question,
    quickAnswer: quickAnswer || answer,
    detailedAnswer: detailedAnswer || explanation,
    code,
    interviewTip,
    practice,
    difficulty,
    isInterview,
    isFaq,
    section,
    tags
  };

  return { theoryCard, qaCard };
}

module.exports = { createCard };

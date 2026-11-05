/**
 * Helper to construct paired Theory and Q&A items for Microservices Architecture (microservices)
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
  const theoryId = `ms-${padded}`;
  const qaId = `ms-qa-${padded}`;

  const theoryCard = {
    id: theoryId,
    category,
    concept,
    priority: priority === "Mastery" || priority === "must-know" ? "must-know" : "advanced",
    question,
    answer: answer || quickAnswer,
    code,
    explanation: explanation || detailedAnswer,
    recallHint: recallHint || interviewTip || "",
    practice
  };

  const qaCard = {
    id: qaId,
    conceptId: theoryId,
    concept,
    category,
    priority: priority === "Mastery" || priority === "must-know" ? "must-know" : "advanced",
    question,
    quickAnswer: quickAnswer || answer,
    detailedAnswer: detailedAnswer || explanation,
    code,
    interviewTip: interviewTip || recallHint || "",
    practice,
    difficulty: difficulty || "intermediate",
    isInterview,
    isFaq,
    section,
    tags
  };

  return {
    theoryCard,
    qaCard
  };
}

function card(
  idNum,
  concept,
  category,
  priority,
  explanation,
  code,
  tags = [],
  practice = [],
  question,
  quickAnswer,
  interviewTip,
  detailedFollowup,
  difficulty = "intermediate"
) {
  const padded = String(idNum).padStart(3, "0");
  const theoryId = `ms-${padded}`;
  const qaId = `ms-qa-${padded}`;

  const finalPriority = (priority === "Mastery" || priority === "must-know" || priority === "Core") ? "must-know" : "advanced";
  const finalQuestion = question || `What are the core architectural mechanisms and operational best practices of ${concept}?`;
  const finalAnswer = quickAnswer || explanation.slice(0, 300);

  const fullExplanation = detailedFollowup 
    ? `${explanation}\n\nDeep Dive Analysis:\n${detailedFollowup}` 
    : explanation;

  const theoryCard = {
    id: theoryId,
    category,
    concept,
    priority: finalPriority,
    question: finalQuestion,
    answer: finalAnswer,
    code,
    explanation: fullExplanation,
    recallHint: interviewTip || "",
    practice
  };

  const qaCard = {
    id: qaId,
    conceptId: theoryId,
    concept,
    category,
    priority: finalPriority,
    question: finalQuestion,
    quickAnswer: finalAnswer,
    detailedAnswer: fullExplanation,
    code,
    interviewTip: interviewTip || "",
    practice,
    difficulty: difficulty || "intermediate",
    isInterview: true,
    isFaq: true,
    section: "interview",
    tags
  };

  return {
    theoryCard,
    qaCard
  };
}

module.exports = {
  createCard,
  card
};

/**
 * Helper to construct paired Theory and Q&A items for Kubernetes & Cloud-Native (kubernetes)
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
  const theoryId = `k8s-${padded}`;
  const qaId = `k8s-qa-${padded}`;

  const theoryCard = {
    id: theoryId,
    category,
    concept,
    priority: priority === "Mastery" || priority === "must-know" || priority === "Core" ? "must-know" : "advanced",
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
    priority: priority === "Mastery" || priority === "must-know" || priority === "Core" ? "must-know" : "advanced",
    question,
    quickAnswer: quickAnswer || answer,
    detailedAnswer: detailedAnswer || explanation,
    code,
    interviewTip: interviewTip || recallHint || "",
    tags: tags.length > 0 ? tags : [category.toLowerCase().replace(/[^a-z0-9]+/g, "-"), "kubernetes", "cloud-native"],
    isInterview,
    isFaq,
    section,
    difficulty: difficulty || (priority === "must-know" ? "intermediate" : "advanced")
  };

  return { theoryCard, qaCard };
}

function card(
  idNum,
  category,
  concept,
  priority,
  difficulty,
  question,
  quickAnswer,
  detailedAnswer,
  code,
  interviewTip,
  tags = []
) {
  return createCard({
    idNum,
    category,
    concept,
    priority,
    difficulty,
    question,
    quickAnswer,
    detailedAnswer,
    code,
    interviewTip,
    tags
  });
}

module.exports = { createCard, card };

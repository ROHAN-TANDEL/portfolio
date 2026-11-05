const fs = require("fs");
const path = require("path");

const cat01 = require("./data_js/cat01_execution.cjs");
const cat02 = require("./data_js/cat02_closures.cjs");
const cat03 = require("./data_js/cat03_this.cjs");
const cat04 = require("./data_js/cat04_prototypes.cjs");
const cat05 = require("./data_js/cat05_types.cjs");
const cat06 = require("./data_js/cat06_async.cjs");
const cat07 = require("./data_js/cat07_functional.cjs");
const cat08 = require("./data_js/cat08_iterators.cjs");
const cat09 = require("./data_js/cat09_metaprogramming.cjs");
const cat10 = require("./data_js/cat10_memory.cjs");
const cat11 = require("./data_js/cat11_webapis.cjs");
const cat12 = require("./data_js/cat12_modern.cjs");

const allPairs = [
  ...cat01,
  ...cat02,
  ...cat03,
  ...cat04,
  ...cat05,
  ...cat06,
  ...cat07,
  ...cat08,
  ...cat09,
  ...cat10,
  ...cat11,
  ...cat12
];

console.log(`Total paired items loaded: ${allPairs.length}`);

const theoryCards = allPairs.map(p => p.theoryCard);
const qaCards = allPairs.map(p => p.qaCard);

// Validate theory cards
const theoryRequired = ["id", "category", "concept", "priority", "question", "answer", "code", "explanation", "recallHint", "practice"];
for (const card of theoryCards) {
  for (const field of theoryRequired) {
    if (card[field] === undefined || card[field] === null || card[field] === "") {
      console.error(`Theory card ${card.id} missing field: ${field}`);
    }
  }
}

// Validate QA cards
const qaRequired = ["id", "conceptId", "concept", "category", "priority", "question", "quickAnswer", "detailedAnswer", "code", "interviewTip", "practice", "difficulty", "isInterview", "isFaq", "section", "tags"];
for (const card of qaCards) {
  for (const field of qaRequired) {
    if (card[field] === undefined || card[field] === null || card[field] === "") {
      console.error(`QA card ${card.id} missing field: ${field}`);
    }
  }
}

const dataDir = path.join(__dirname, "../data");
const theoryPath = path.join(dataDir, "javascript.json");
const qaPath = path.join(dataDir, "javascript.qa.json");

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), "utf-8");
fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), "utf-8");

console.log(`Successfully generated:`);
console.log(`- ${theoryCards.length} Theory cards -> ${theoryPath}`);
console.log(`- ${qaCards.length} Q&A cards -> ${qaPath}`);

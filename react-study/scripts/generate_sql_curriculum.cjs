const fs = require("fs");
const path = require("path");

const cat01 = require("./data_sql/cat01_relational_foundations.cjs");
const cat02 = require("./data_sql/cat02_normalization_ddl.cjs");
const cat03 = require("./data_sql/cat03_joins_set_ops.cjs");
const cat04 = require("./data_sql/cat04_aggregates_grouping.cjs");
const cat05 = require("./data_sql/cat05_subqueries_exists.cjs");
const cat06 = require("./data_sql/cat06_window_functions.cjs");
const cat07 = require("./data_sql/cat07_ctes_recursive.cjs");
const cat08 = require("./data_sql/cat08_transactions_acid.cjs");
const cat09 = require("./data_sql/cat09_indexing_sargability.cjs");
const cat10 = require("./data_sql/cat10_views_security_patterns.cjs");

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
  ...cat10
];

console.log(`Total paired items loaded: ${allPairs.length}`);

const theoryCards = allPairs.map(p => p.theoryCard);
const qaCards = allPairs.map(p => p.qaCard);

// Validate theory cards
const theoryRequired = ["id", "category", "concept", "priority", "question", "answer", "code", "explanation", "recallHint", "practice"];
let theoryErrors = 0;
for (const card of theoryCards) {
  for (const field of theoryRequired) {
    if (card[field] === undefined || card[field] === null || card[field] === "") {
      console.error(`Theory card ${card.id} missing field: ${field}`);
      theoryErrors++;
    }
  }
}

// Validate QA cards
const qaRequired = ["id", "conceptId", "concept", "category", "priority", "question", "quickAnswer", "detailedAnswer", "code", "interviewTip", "practice", "difficulty", "isInterview", "isFaq", "section", "tags"];
let qaErrors = 0;
for (const card of qaCards) {
  for (const field of qaRequired) {
    if (card[field] === undefined || card[field] === null || card[field] === "") {
      console.error(`QA card ${card.id} missing field: ${field}`);
      qaErrors++;
    }
  }
}

if (theoryErrors > 0 || qaErrors > 0) {
  console.error(`Validation failed with ${theoryErrors} theory errors and ${qaErrors} QA errors.`);
  process.exit(1);
}

const dataDir = path.join(__dirname, "../data");
const theoryPath = path.join(dataDir, "sql.json");
const qaPath = path.join(dataDir, "sql.qa.json");

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), "utf-8");
fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), "utf-8");

console.log(`Successfully generated ANSI SQL curriculum:`);
console.log(`- Theory cards: ${theoryCards.length} -> ${theoryPath}`);
console.log(`- Q&A cards: ${qaCards.length} -> ${qaPath}`);

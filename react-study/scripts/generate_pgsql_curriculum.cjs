const fs = require("fs");
const path = require("path");

const cat01 = require("./data_pg/cat01_arch.cjs");
const cat02 = require("./data_pg/cat02_mvcc.cjs");
const cat03 = require("./data_pg/cat03_indexes.cjs");
const cat04 = require("./data_pg/cat04_jsonb.cjs");
const cat05 = require("./data_pg/cat05_queries.cjs");
const cat06 = require("./data_pg/cat06_types.cjs");
const cat07 = require("./data_pg/cat07_locking.cjs");
const cat08 = require("./data_pg/cat08_partitioning.cjs");
const cat09 = require("./data_pg/cat09_security_rls.cjs");
const cat10 = require("./data_pg/cat10_perf_tuning.cjs");

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
const theoryPath = path.join(dataDir, "pgsql.json");
const qaPath = path.join(dataDir, "pgsql.qa.json");

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), "utf-8");
fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), "utf-8");

console.log(`Successfully generated PostgreSQL (pgsql) curriculum:`);
console.log(`- Theory cards: ${theoryCards.length} -> ${theoryPath}`);
console.log(`- Q&A cards: ${qaCards.length} -> ${qaPath}`);

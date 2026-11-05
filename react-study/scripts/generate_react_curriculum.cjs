const fs = require('fs');
const path = require('path');

const cat01 = require('./data_react/cat01_jsx_vdom_pure.cjs');
const cat02 = require('./data_react/cat02_lifecycle_props_state.cjs');
const cat03 = require('./data_react/cat03_core_hooks.cjs');
const cat04 = require('./data_react/cat04_advanced_hooks.cjs');
const cat05 = require('./data_react/cat05_concurrent_react18.cjs');
const cat06 = require('./data_react/cat06_react19_innovations.cjs');
const cat07 = require('./data_react/cat07_rsc_streaming_ssr.cjs');
const cat08 = require('./data_react/cat08_state_context_external.cjs');
const cat09 = require('./data_react/cat09_patterns_error_boundaries.cjs');
const cat10 = require('./data_react/cat10_performance_virtualization.cjs');

const allCategories = [
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

console.log(`Total paired items loaded: ${allCategories.length}`);

const theoryCards = [];
const qaCards = [];

const theoryIds = new Set();
const qaIds = new Set();

allCategories.forEach((item, index) => {
  const { theoryCard, qaCard } = item;

  // Validation
  if (!theoryCard || !qaCard) {
    throw new Error(`Item at index ${index} is missing theoryCard or qaCard`);
  }

  if (theoryIds.has(theoryCard.id)) {
    throw new Error(`Duplicate theory card id: ${theoryCard.id}`);
  }
  theoryIds.add(theoryCard.id);

  if (qaIds.has(qaCard.id)) {
    throw new Error(`Duplicate QA card id: ${qaCard.id}`);
  }
  qaIds.add(qaCard.id);

  if (!theoryCard.question || !theoryCard.answer || !theoryCard.explanation) {
    throw new Error(`Incomplete theory card: ${theoryCard.id}`);
  }

  if (!qaCard.quickAnswer || !qaCard.detailedAnswer || !qaCard.interviewTip) {
    throw new Error(`Incomplete QA card: ${qaCard.id}`);
  }

  theoryCards.push(theoryCard);
  qaCards.push(qaCard);
});

const dataDir = path.join(__dirname, '../data');
const theoryPath = path.join(dataDir, 'react.json');
const qaPath = path.join(dataDir, 'react.qa.json');

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), 'utf8');
fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), 'utf8');

console.log(`Successfully generated React Curriculum:`);
console.log(`- ${theoryCards.length} Theory cards written to ${theoryPath}`);
console.log(`- ${qaCards.length} QA cards written to ${qaPath}`);

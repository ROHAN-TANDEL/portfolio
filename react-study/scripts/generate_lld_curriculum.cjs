const fs = require('fs');
const path = require('path');

const cat01 = require('./data_lld/cat01_oop_solid_grasp.cjs');
const cat02 = require('./data_lld/cat02_creational_patterns.cjs');
const cat03 = require('./data_lld/cat03_structural_patterns.cjs');
const cat04 = require('./data_lld/cat04_behavioral_patterns.cjs');
const cat05 = require('./data_lld/cat05_concurrency_threads.cjs');
const cat06 = require('./data_lld/cat06_caching_storage.cjs');
const cat07 = require('./data_lld/cat07_rate_limiters_resilience.cjs');
const cat08 = require('./data_lld/cat08_games_state_machines.cjs');
const cat09 = require('./data_lld/cat09_booking_transactions.cjs');
const cat10 = require('./data_lld/cat10_infra_messaging_clean_arch.cjs');

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

console.log(`Loaded ${allCategories.length} card pairs across 10 categories.`);

const theoryCards = allCategories.map(item => item.theoryCard);
const qaCards = allCategories.map(item => item.qaCard);

const theoryPath = path.join(__dirname, '../data/lld.json');
const qaPath = path.join(__dirname, '../data/lld.qa.json');

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), 'utf-8');
console.log(`Wrote ${theoryCards.length} Theory cards to ${theoryPath}`);

fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), 'utf-8');
console.log(`Wrote ${qaCards.length} Q&A cards to ${qaPath}`);

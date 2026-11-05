const fs = require('fs');
const path = require('path');

const cat01 = require('./data/cat01_internals.cjs');
const cat02 = require('./data/cat02_async.cjs');
const cat03 = require('./data/cat03_streams.cjs');
const cat04 = require('./data/cat04_fs.cjs');
const cat05 = require('./data/cat05_networking.cjs');
const cat06 = require('./data/cat06_concurrency.cjs');
const cat07 = require('./data/cat07_memory.cjs');
const cat08 = require('./data/cat08_process.cjs');
const cat09 = require('./data/cat09_modules.cjs');
const cat10 = require('./data/cat10_security.cjs');
const cat11 = require('./data/cat11_performance.cjs');
const cat12 = require('./data/cat12_modern.cjs');

const allPacks = [
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

console.log(`Total assembled items: ${allPacks.length}`);

const theoryCards = allPacks.map(p => p.theoryCard);
const qaCards = allPacks.map(p => p.qaCard);

const dataDir = path.resolve(__dirname, '../data');
const theoryPath = path.join(dataDir, 'nodejs.json');
const qaPath = path.join(dataDir, 'nodejs.qa.json');

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), 'utf-8');
console.log(`Successfully wrote ${theoryCards.length} cards to ${theoryPath}`);

fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), 'utf-8');
console.log(`Successfully wrote ${qaCards.length} cards to ${qaPath}`);

// Verification checks
const categories = [...new Set(theoryCards.map(c => c.category))];
console.log(`\nVerified across ${categories.length} structured categories:`);
categories.forEach((cat, idx) => {
  const count = theoryCards.filter(c => c.category === cat).length;
  console.log(`  ${idx + 1}. ${cat} (${count} cards)`);
});

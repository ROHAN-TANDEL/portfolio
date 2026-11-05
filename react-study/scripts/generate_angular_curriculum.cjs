const fs = require('fs');
const path = require('path');

const catFiles = [
  'cat01_architecture_standalone.cjs',
  'cat02_dependency_injection.cjs',
  'cat03_reactive_rxjs.cjs',
  'cat04_signals_reactivity.cjs',
  'cat05_change_detection_zoneless.cjs',
  'cat06_template_control_flow_defer.cjs',
  'cat07_router_navigation_guards.cjs',
  'cat08_forms_reactive_typed.cjs',
  'cat09_http_interceptors_ssr.cjs',
  'cat10_state_performance_security.cjs'
];

const dataDir = path.resolve(__dirname, 'data_angular');
const outputTheoryPath = path.resolve(__dirname, '../data/angular.json');
const outputQaPath = path.resolve(__dirname, '../data/angular.qa.json');

const allTheory = [];
const allQa = [];

catFiles.forEach((file, index) => {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing category file: ${filePath}`);
  }
  const categoryCards = require(filePath);
  console.log(`Loaded ${file}: ${categoryCards.length} cards`);
  categoryCards.forEach(card => {
    allTheory.push(card.theoryCard);
    allQa.push(card.qaCard);
  });
});

console.log(`Total Theory cards: ${allTheory.length}`);
console.log(`Total QA cards: ${allQa.length}`);

if (allTheory.length !== 120 || allQa.length !== 120) {
  throw new Error(`Expected exactly 120 cards, got Theory: ${allTheory.length}, QA: ${allQa.length}`);
}

// Check uniqueness of IDs
const theoryIds = new Set(allTheory.map(c => c.id));
const qaIds = new Set(allQa.map(c => c.id));
if (theoryIds.size !== 120) throw new Error(`Duplicate theory IDs detected! Unique: ${theoryIds.size}`);
if (qaIds.size !== 120) throw new Error(`Duplicate QA IDs detected! Unique: ${qaIds.size}`);

// Write files
fs.writeFileSync(outputTheoryPath, JSON.stringify(allTheory, null, 2), 'utf-8');
console.log(`Successfully wrote ${allTheory.length} items to ${outputTheoryPath}`);

fs.writeFileSync(outputQaPath, JSON.stringify(allQa, null, 2), 'utf-8');
console.log(`Successfully wrote ${allQa.length} items to ${outputQaPath}`);

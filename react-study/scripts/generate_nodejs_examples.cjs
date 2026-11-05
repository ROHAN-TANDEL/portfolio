const fs = require('fs');
const path = require('path');

const part1 = require('./examples_part1.cjs');
const part2 = require('./examples_part2.cjs');
const part3 = require('./examples_part3.cjs');
const part4 = require('./examples_part4.cjs');
const part5 = require('./examples_part5.cjs');
const part6 = require('./examples_part6.cjs');

const allExamples = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5,
  ...part6
];

console.log(`Total assembled examples: ${allExamples.length}`);

// Validation check
let errorCount = 0;
allExamples.forEach((ex, idx) => {
  if (!ex.id || !ex.title || !ex.category || !ex.difficulty || !ex.whatThisCodeCovers || !ex.conceptsCovered || !ex.code || !ex.breakdown || !ex.expectedOutput) {
    console.error(`Validation Error at index ${idx}: Missing required fields in ${ex.id}`);
    errorCount++;
  }
  if (!Array.isArray(ex.conceptsCovered) || ex.conceptsCovered.length === 0) {
    console.error(`Validation Error at index ${idx}: Empty conceptsCovered in ${ex.id}`);
    errorCount++;
  }
  if (!Array.isArray(ex.breakdown) || ex.breakdown.length === 0) {
    console.error(`Validation Error at index ${idx}: Empty breakdown in ${ex.id}`);
    errorCount++;
  }
});

if (errorCount > 0) {
  console.error(`Failed with ${errorCount} validation errors!`);
  process.exit(1);
}

const outputPath = path.resolve(__dirname, '../data/nodejs.examples.json');
fs.writeFileSync(outputPath, JSON.stringify(allExamples, null, 2), 'utf-8');
console.log(`Successfully wrote ${allExamples.length} validated examples to ${outputPath}`);

// Category breakdown
const cats = {};
allExamples.forEach((e) => {
  cats[e.category] = (cats[e.category] || 0) + 1;
});

console.log('\nCategory Breakdown:');
Object.entries(cats).forEach(([cat, count], i) => {
  console.log(`  ${i + 1}. ${cat} (${count} examples)`);
});

const fs = require('fs');
const path = require('path');

const part1 = require('./examples_sql/part1_core_joins_sets.cjs');
const part2 = require('./examples_sql/part2_aggregates_grouping.cjs');
const part3 = require('./examples_sql/part3_window_ranking.cjs');
const part4 = require('./examples_sql/part4_ctes_hierarchies.cjs');
const part5 = require('./examples_sql/part5_production_patterns.cjs');

const allExamples = [...part1, ...part2, ...part3, ...part4, ...part5];

console.log(`Aggregated ${allExamples.length} SQL code examples.`);

// Validation
const ids = new Set();
allExamples.forEach((ex, idx) => {
  if (!ex.id) throw new Error(`Example at index ${idx} missing id`);
  if (ids.has(ex.id)) throw new Error(`Duplicate example id: ${ex.id}`);
  ids.add(ex.id);
  if (!ex.title) throw new Error(`Example ${ex.id} missing title`);
  if (!ex.category) throw new Error(`Example ${ex.id} missing category`);
  if (!ex.difficulty) throw new Error(`Example ${ex.id} missing difficulty`);
  if (!ex.whatThisCodeCovers) throw new Error(`Example ${ex.id} missing whatThisCodeCovers`);
  if (!Array.isArray(ex.conceptsCovered) || ex.conceptsCovered.length === 0) throw new Error(`Example ${ex.id} missing conceptsCovered`);
  if (!ex.code) throw new Error(`Example ${ex.id} missing code`);
  if (!Array.isArray(ex.breakdown) || ex.breakdown.length === 0) throw new Error(`Example ${ex.id} missing breakdown`);
  if (!ex.expectedOutput) throw new Error(`Example ${ex.id} missing expectedOutput`);
});

const outputPath = path.join(__dirname, '../data/sql.examples.json');
fs.writeFileSync(outputPath, JSON.stringify(allExamples, null, 2), 'utf8');
console.log(`Successfully compiled 52 SQL examples to ${outputPath}`);

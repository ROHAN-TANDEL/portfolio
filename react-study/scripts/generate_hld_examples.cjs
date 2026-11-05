const fs = require('fs');
const path = require('path');

const part1 = require('./examples_hld/part1_partitioning_ids_resilience.cjs');
const part2 = require('./examples_hld/part2_caching_bloom_storage.cjs');
const part3 = require('./examples_hld/part3_messaging_resilience_mesh.cjs');
const part4 = require('./examples_hld/part4_coordination_consensus_networking.cjs');
const part5 = require('./examples_hld/part5_system_archetypes_blueprints.cjs');

const allExamples = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Loaded ${allExamples.length} Applied Recipes.`);

const outputPath = path.join(__dirname, '../data/hld.examples.json');
fs.writeFileSync(outputPath, JSON.stringify(allExamples, null, 2), 'utf-8');

console.log(`Successfully wrote ${allExamples.length} Applied Recipes to ${outputPath}`);

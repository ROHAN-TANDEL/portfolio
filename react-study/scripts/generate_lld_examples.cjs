const fs = require('fs');
const path = require('path');

const part1 = require('./examples_lld/part1_patterns_foundations.cjs');
const part2 = require('./examples_lld/part2_caching_storage.cjs');
const part3 = require('./examples_lld/part3_rate_limiters_resilience.cjs');
const part4 = require('./examples_lld/part4_real_world_systems.cjs');
const part5 = require('./examples_lld/part5_infrastructure_games_clean_arch.cjs');

const allRecipes = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Loaded ${allRecipes.length} LLD recipes across 5 modules.`);

if (allRecipes.length !== 52) {
  console.warn(`Warning: Expected 52 recipes, but found ${allRecipes.length}`);
}

const outputPath = path.join(__dirname, '../data/lld.examples.json');
fs.writeFileSync(outputPath, JSON.stringify(allRecipes, null, 2), 'utf-8');
console.log(`Successfully wrote ${allRecipes.length} recipes to ${outputPath}`);

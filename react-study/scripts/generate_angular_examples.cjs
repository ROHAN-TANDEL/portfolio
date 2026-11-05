const fs = require('fs');
const path = require('path');

const parts = [
  'part1_components_directives_dom.cjs',
  'part2_rxjs_reactive_patterns.cjs',
  'part3_signals_state_management.cjs',
  'part4_routing_guards_forms.cjs',
  'part5_production_ssr_performance.cjs'
];

const dir = path.resolve(__dirname, 'examples_angular');
const outputPath = path.resolve(__dirname, '../data/angular.examples.json');

const allRecipes = [];

parts.forEach(file => {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing examples part: ${filePath}`);
  }
  const recipes = require(filePath);
  console.log(`Loaded ${file}: ${recipes.length} recipes`);
  recipes.forEach(r => allRecipes.push(r));
});

console.log(`Total recipes loaded: ${allRecipes.length}`);

if (allRecipes.length !== 52) {
  throw new Error(`Expected exactly 52 recipes, got: ${allRecipes.length}`);
}

const ids = new Set(allRecipes.map(r => r.id));
if (ids.size !== 52) {
  throw new Error(`Duplicate recipe IDs detected! Unique: ${ids.size}`);
}

fs.writeFileSync(outputPath, JSON.stringify(allRecipes, null, 2), 'utf-8');
console.log(`Successfully wrote ${allRecipes.length} recipes to ${outputPath}`);

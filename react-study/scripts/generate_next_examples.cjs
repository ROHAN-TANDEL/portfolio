// scripts/generate_next_examples.cjs
const fs = require('fs');
const path = require('path');

const p1 = require('./examples_nextjs/part1_recipes_01_to_10.cjs');
const p2 = require('./examples_nextjs/part2_recipes_11_to_20.cjs');
const p3 = require('./examples_nextjs/part3_recipes_21_to_30.cjs');
const p4 = require('./examples_nextjs/part4_recipes_31_to_42.cjs');
const p5 = require('./examples_nextjs/part5_recipes_43_to_52.cjs');

const unwrap = (mod) => (mod && mod.recipes ? mod.recipes : mod);

const allRecipes = [
  ...unwrap(p1),
  ...unwrap(p2),
  ...unwrap(p3),
  ...unwrap(p4),
  ...unwrap(p5),
];

console.log(`Aggregating Next.js Applied Recipes... Total items: ${allRecipes.length}`);

// Validate IDs and sequential numbering
allRecipes.forEach((recipe, index) => {
  const expectedId = `next-ex-${String(index + 1).padStart(2, '0')}`;
  if (recipe.id !== expectedId) {
    console.warn(`Mismatch in recipe id at index ${index}: got ${recipe.id}, expected ${expectedId}`);
  }
});

const outputPath = path.join(__dirname, '../data/nextjs.examples.json');
fs.writeFileSync(outputPath, JSON.stringify(allRecipes, null, 2), 'utf-8');
console.log(`Successfully generated ${outputPath} with ${allRecipes.length} recipes.`);

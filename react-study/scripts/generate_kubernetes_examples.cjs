// scripts/generate_kubernetes_examples.cjs
const fs = require('fs');
const path = require('path');

const part1 = require('./examples_kubernetes/part1_recipes_01_to_10.cjs');
const part2 = require('./examples_kubernetes/part2_recipes_11_to_20.cjs');
const part3 = require('./examples_kubernetes/part3_recipes_21_to_30.cjs');
const part4 = require('./examples_kubernetes/part4_recipes_31_to_40.cjs');
const part5 = require('./examples_kubernetes/part5_recipes_41_to_52.cjs');

const allRecipes = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Processing Kubernetes Applied Recipes... Total recipes: ${allRecipes.length}`);

allRecipes.forEach((rec, idx) => {
  const expectedId = `k8s-ex-${String(idx + 1).padStart(2, '0')}`;
  if (rec.id !== expectedId) {
    console.warn(`Mismatch in recipe id at ${idx}: got ${rec.id}, expected ${expectedId}`);
  }
});

const outputPath = path.join(__dirname, '../data/kubernetes.examples.json');
fs.writeFileSync(outputPath, JSON.stringify(allRecipes, null, 2), 'utf-8');
console.log(`Successfully generated ${outputPath} with ${allRecipes.length} recipes.`);

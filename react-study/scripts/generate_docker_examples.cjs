const fs = require('fs');
const path = require('path');

const part1 = require('./examples_docker/part1_dockerfile_buildkit.cjs');
const part2 = require('./examples_docker/part2_networking_dns.cjs');
const part3 = require('./examples_docker/part3_storage_volumes.cjs');
const part4 = require('./examples_docker/part4_compose_orchestration.cjs');
const part5 = require('./examples_docker/part5_security_limits_ops.cjs');

const allRecipes = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Loaded ${allRecipes.length} Docker recipes across 5 modules.`);

if (allRecipes.length !== 52) {
  console.warn(`Warning: Expected 52 recipes, but found ${allRecipes.length}`);
}

const outputPath = path.join(__dirname, '../data/docker.examples.json');
fs.writeFileSync(outputPath, JSON.stringify(allRecipes, null, 2), 'utf-8');
console.log(`Successfully wrote ${allRecipes.length} recipes to ${outputPath}`);

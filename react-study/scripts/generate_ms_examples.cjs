const fs = require("fs");
const path = require("path");

const part1 = require("./examples_ms/part1_recipes_01_to_10.cjs");
const part2 = require("./examples_ms/part2_recipes_11_to_20.cjs");
const part3 = require("./examples_ms/part3_recipes_21_to_30.cjs");
const part4 = require("./examples_ms/part4_recipes_31_to_42.cjs");
const part5 = require("./examples_ms/part5_recipes_43_to_52.cjs");

const allRecipes = [
  ...part1.recipes,
  ...part2.recipes,
  ...part3.recipes,
  ...part4.recipes,
  ...part5.recipes
];

console.log(`Loaded ${allRecipes.length} recipes.`);

if (allRecipes.length !== 52) {
  console.error(`Expected exactly 52 recipes, got ${allRecipes.length}`);
  process.exit(1);
}

// Verify ids
allRecipes.forEach((item, index) => {
  const expectedId = `ms-ex-${String(index + 1).padStart(2, "0")}`;
  if (item.id !== expectedId) {
    console.warn(`Fixing ID: ${item.id} -> ${expectedId}`);
    item.id = expectedId;
  }
});

const outFile = path.join(__dirname, "../data/microservices.examples.json");
fs.writeFileSync(outFile, JSON.stringify(allRecipes, null, 2), "utf8");
console.log(`Successfully wrote 52 recipes to ${outFile}`);

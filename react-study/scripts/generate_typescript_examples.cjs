const fs = require("fs");
const path = require("path");

const part1 = require("./examples_ts/part1_mapped_utility.cjs");
const part2 = require("./examples_ts/part2_string_template.cjs");
const part3 = require("./examples_ts/part3_tuple_array.cjs");
const part4 = require("./examples_ts/part4_functional_generics.cjs");
const part5 = require("./examples_ts/part5_enterprise_bridges.cjs");

const allExamples = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Loaded ${allExamples.length} TypeScript examples.`);

// Validate schema
const requiredFields = [
  "id",
  "title",
  "category",
  "difficulty",
  "whatThisCodeCovers",
  "conceptsCovered",
  "code",
  "breakdown",
  "expectedOutput"
];

for (const ex of allExamples) {
  for (const field of requiredFields) {
    if (ex[field] === undefined || ex[field] === null || ex[field] === "") {
      console.error(`Example ${ex.id} missing field: ${field}`);
    }
  }
}

const outputPath = path.join(__dirname, "../data/typescript.examples.json");
fs.writeFileSync(outputPath, JSON.stringify(allExamples, null, 2), "utf-8");

console.log(`Successfully generated TypeScript Examples Hub:`);
console.log(`- ${allExamples.length} Examples -> ${outputPath}`);

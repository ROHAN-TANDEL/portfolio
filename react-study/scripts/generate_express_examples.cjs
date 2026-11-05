const fs = require("fs");
const path = require("path");

const part1 = require("./examples_exp/part1_bootstrap_routing.cjs");
const part2 = require("./examples_exp/part2_middleware_reqres.cjs");
const part3 = require("./examples_exp/part3_error_auth.cjs");
const part4 = require("./examples_exp/part4_security_validation.cjs");
const part5 = require("./examples_exp/part5_database_modern.cjs");

const allExamples = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Loaded ${allExamples.length} Express examples.`);

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

const outputPath = path.join(__dirname, "../data/express.examples.json");
fs.writeFileSync(outputPath, JSON.stringify(allExamples, null, 2), "utf-8");

console.log(`Successfully generated Express Examples Hub:`);
console.log(`- ${allExamples.length} Examples -> ${outputPath}`);

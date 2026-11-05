const fs = require("fs");
const path = require("path");

const part1 = require("./examples_pg/part1_upsert_queries.cjs");
const part2 = require("./examples_pg/part2_jsonb_indexing.cjs");
const part3 = require("./examples_pg/part3_types_constraints.cjs");
const part4 = require("./examples_pg/part4_concurrency_locking.cjs");
const part5 = require("./examples_pg/part5_partition_rls_admin.cjs");

const allExamples = [
  ...part1,
  ...part2,
  ...part3,
  ...part4,
  ...part5
];

console.log(`Loaded ${allExamples.length} PostgreSQL examples.`);

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

let errors = 0;
for (const ex of allExamples) {
  for (const field of requiredFields) {
    if (ex[field] === undefined || ex[field] === null || ex[field] === "") {
      console.error(`Example ${ex.id} missing field: ${field}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`Validation failed with ${errors} errors.`);
  process.exit(1);
}

const outputPath = path.join(__dirname, "../data/pgsql.examples.json");
fs.writeFileSync(outputPath, JSON.stringify(allExamples, null, 2), "utf-8");

console.log(`Successfully generated PostgreSQL Examples Hub:`);
console.log(`- ${allExamples.length} Examples -> ${outputPath}`);

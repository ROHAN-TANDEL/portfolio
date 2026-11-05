const fs = require('fs');
const path = require('path');

const part1 = require('./deep_hld/part1_chapters_1_to_6.cjs');
const part2 = require('./deep_hld/part2_chapters_7_to_12.cjs');

const allDeepDives = [...part1, ...part2];

console.log(`Loaded ${allDeepDives.length} Deep Dive chapters.`);

const outputPath = path.join(__dirname, '../data/hld.deep.json');
fs.writeFileSync(outputPath, JSON.stringify(allDeepDives, null, 2), 'utf-8');

console.log(`Successfully wrote ${allDeepDives.length} chapters to ${outputPath}`);

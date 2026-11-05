const fs = require('fs');
const path = require('path');

const cat01 = require('./data_hld/cat01_scalability_fundamentals.cjs');
const cat02 = require('./data_hld/cat02_networking_edge_load_balancing.cjs');
const cat03 = require('./data_hld/cat03_databases_storage_partitioning.cjs');
const cat04 = require('./data_hld/cat04_caching_in_memory_systems.cjs');
const cat05 = require('./data_hld/cat05_messaging_streaming_events.cjs');
const cat06 = require('./data_hld/cat06_consensus_coordination_clocks.cjs');
const cat07 = require('./data_hld/cat07_microservices_resilience_observability.cjs');
const cat08 = require('./data_hld/cat08_security_identity_distributed_access.cjs');
const cat09 = require('./data_hld/cat09_large_scale_archetypes_part1.cjs');
const cat10 = require('./data_hld/cat10_large_scale_archetypes_part2.cjs');

const allCategories = [
  ...cat01,
  ...cat02,
  ...cat03,
  ...cat04,
  ...cat05,
  ...cat06,
  ...cat07,
  ...cat08,
  ...cat09,
  ...cat10
];

console.log(`Loaded ${allCategories.length} card pairs across 10 categories.`);

const theoryCards = allCategories.map(item => item.theoryCard);
const qaCards = allCategories.map(item => item.qaCard);

const theoryPath = path.join(__dirname, '../data/hld.json');
const qaPath = path.join(__dirname, '../data/hld.qa.json');

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), 'utf-8');
console.log(`Wrote ${theoryCards.length} Theory cards to ${theoryPath}`);

fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), 'utf-8');
console.log(`Wrote ${qaCards.length} Q&A cards to ${qaPath}`);

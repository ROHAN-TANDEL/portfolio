// scripts/generate_security_curriculum.cjs
const fs = require('fs');
const path = require('path');

const cat01 = require('./data_security/cat01_threat_modeling.cjs');
const cat02 = require('./data_security/cat02_auth_identity.cjs');
const cat03 = require('./data_security/cat03_authorization_access.cjs');
const cat04 = require('./data_security/cat04_applied_crypto.cjs');
const cat05 = require('./data_security/cat05_owasp_defense.cjs');
const cat06 = require('./data_security/cat06_api_microservices.cjs');
const cat07 = require('./data_security/cat07_network_hardening.cjs');
const cat08 = require('./data_security/cat08_container_cloud.cjs');
const cat09 = require('./data_security/cat09_devsecops_supplychain.cjs');
const cat10 = require('./data_security/cat10_incident_forensics.cjs');

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
  ...cat10,
];

console.log(`Processing Security & Cryptography curriculum... Total cards: ${allCategories.length}`);

const theoryCards = [];
const qaCards = [];

allCategories.forEach((item, index) => {
  const expectedNum = index + 1;
  const padded = String(expectedNum).padStart(3, '0');
  const expectedTheoryId = `sec-${padded}`;
  const expectedQaId = `sec-qa-${padded}`;

  if (item.theoryCard.id !== expectedTheoryId) {
    console.warn(`Mismatch in theory id at ${index}: got ${item.theoryCard.id}, expected ${expectedTheoryId}`);
  }
  if (item.qaCard.id !== expectedQaId) {
    console.warn(`Mismatch in qa id at ${index}: got ${item.qaCard.id}, expected ${expectedQaId}`);
  }

  theoryCards.push(item.theoryCard);
  qaCards.push(item.qaCard);
});

const dataDir = path.join(__dirname, '../data');

fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(theoryCards, null, 2), 'utf-8');
console.log(`Successfully generated data/security.json (${theoryCards.length} items)`);

fs.writeFileSync(path.join(dataDir, 'security.qa.json'), JSON.stringify(qaCards, null, 2), 'utf-8');
console.log(`Successfully generated data/security.qa.json (${qaCards.length} items)`);

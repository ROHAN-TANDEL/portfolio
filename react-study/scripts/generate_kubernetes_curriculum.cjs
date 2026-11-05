// scripts/generate_kubernetes_curriculum.cjs
const fs = require('fs');
const path = require('path');

const cat01 = require('./data_kubernetes/cat01_architecture_controlplane.cjs');
const cat02 = require('./data_kubernetes/cat02_workload_primitives.cjs');
const cat03 = require('./data_kubernetes/cat03_config_storage.cjs');
const cat04 = require('./data_kubernetes/cat04_networking_services.cjs');
const cat05 = require('./data_kubernetes/cat05_scheduling_allocation.cjs');
const cat06 = require('./data_kubernetes/cat06_autoscaling_capacity.cjs');
const cat07 = require('./data_kubernetes/cat07_security_rbac_policy.cjs');
const cat08 = require('./data_kubernetes/cat08_crds_operators.cjs');
const cat09 = require('./data_kubernetes/cat09_packaging_gitops.cjs');
const cat10 = require('./data_kubernetes/cat10_observability_operations.cjs');

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

console.log(`Processing Kubernetes curriculum... Total cards: ${allCategories.length}`);

const theoryCards = [];
const qaCards = [];

allCategories.forEach((item, index) => {
  const expectedNum = index + 1;
  const padded = String(expectedNum).padStart(3, '0');
  const expectedTheoryId = `k8s-${padded}`;
  const expectedQaId = `k8s-qa-${padded}`;

  if (item.theoryCard.id !== expectedTheoryId) {
    console.warn(`Mismatch in theory id at ${index}: got ${item.theoryCard.id}, expected ${expectedTheoryId}`);
  }
  if (item.qaCard.id !== expectedQaId) {
    console.warn(`Mismatch in qa id at ${index}: got ${item.qaCard.id}, expected ${expectedQaId}`);
  }

  theoryCards.push(item.theoryCard);
  qaCards.push(item.qaCard);
});

const outDataDir = path.resolve(__dirname, '../data');
const theoryPath = path.join(outDataDir, 'kubernetes.json');
const qaPath = path.join(outDataDir, 'kubernetes.qa.json');

fs.writeFileSync(theoryPath, JSON.stringify(theoryCards, null, 2), 'utf-8');
fs.writeFileSync(qaPath, JSON.stringify(qaCards, null, 2), 'utf-8');

console.log(`Successfully generated:`);
console.log(` - ${theoryPath} (${theoryCards.length} cards)`);
console.log(` - ${qaPath} (${qaCards.length} QA pairs)`);

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load decision tree JSON
const treePath = path.resolve(__dirname, 'ml_tree.json');
let treeModel = null;

try {
  const raw = fs.readFileSync(treePath, 'utf8');
  treeModel = JSON.parse(raw);
} catch {
  console.warn('[ML Engine] ml_tree.json not found or unreadable – using fallback heuristic scoring.');
}

/**
 * Traverse a single decision tree node and return leaf value.
 */
function traverseTree(node, features) {
  if (!node) return 0.5;
  if (node.leaf !== undefined) return node.leaf;

  const featureValue = features[node.feature] ?? 0;
  if (featureValue <= node.threshold) {
    return traverseTree(node.left, features);
  }
  return traverseTree(node.right, features);
}

/**
 * Score a transaction using the ML Random Forest model.
 * Falls back to a heuristic if model is unavailable.
 */
export function scoreTransactionUnderML(txn) {
  const amount = parseFloat(txn.amount) || 0;
  const isHighRisk = ['KP','IR','MM','SY','CU','KY','PA','VG'].includes(txn.counterparty_country || '') ? 1 : 0;
  const isCash = (txn.type?.toLowerCase().includes('cash') ? 1 : 0);
  const amountNormalized = Math.min(amount / 5000000, 1.0);

  const features = {
    amount: amount,
    amount_normalized: amountNormalized,
    is_high_risk_country: isHighRisk,
    is_cash: isCash,
    is_round_amount: (amount % 100000 === 0) ? 1 : 0,
  };

  if (!treeModel || !Array.isArray(treeModel.trees)) {
    // Heuristic fallback
    let score = 0;
    if (amount >= 4500000) score += 0.45;
    else if (amount >= 1000000) score += 0.25;
    else if (amount >= 500000) score += 0.10;
    if (isHighRisk) score += 0.30;
    if (isCash) score += 0.15;
    return Math.min(score, 0.99);
  }

  // Random Forest average of all trees
  const total = treeModel.trees.reduce((sum, tree) => sum + traverseTree(tree, features), 0);
  return total / treeModel.trees.length;
}

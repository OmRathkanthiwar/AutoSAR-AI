import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const treePath = path.resolve(__dirname, 'ml_tree.json');
let model = null;

try {
  model = JSON.parse(fs.readFileSync(treePath, 'utf8'));
} catch (error) {
  console.warn(`[ML Engine] Unable to load trained model: ${error.message}`);
}

function traverseTree(node, features) {
  if (!node) return 0.5;
  if (node.probability !== undefined) return node.probability;
  const value = features[node.feature] ?? 0;
  return value <= node.threshold
    ? traverseTree(node.left, features)
    : traverseTree(node.right, features);
}

function getPaymentFormat(transaction) {
  const type = (transaction.type || transaction.payment_format || '').toUpperCase();
  if (type.includes('CASH')) return 'Cash';
  if (type.includes('WIRE')) return 'Wire';
  if (type.includes('ACH')) return 'ACH';
  return 'Other';
}

function buildCaseFeatures(caseData) {
  const transactions = caseData.transactions || [];
  const amounts = transactions.map(transaction => (parseFloat(transaction.amount) || 0) / 83);
  const count = transactions.length || 1;
  const formats = transactions.map(getPaymentFormat);
  const hours = transactions.map(transaction => {
    const date = new Date(transaction.date);
    return Number.isNaN(date.getTime()) ? 12 : date.getUTCHours();
  });
  const fromBanks = transactions.map(transaction => transaction.from_bank || 'unknown');
  const toBanks = transactions.map(transaction => transaction.to_bank || 'unknown');
  const unique = values => new Set(values).size;
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const average = total / count;
  const variance = amounts.reduce((sum, amount) => sum + ((amount - average) ** 2), 0) / count;

  return {
    transaction_count: transactions.length,
    total_amount_usd: total,
    average_amount_usd: average,
    maximum_amount_usd: Math.max(...amounts, 0),
    amount_std_usd: Math.sqrt(variance),
    unique_receivers: unique(transactions.map(transaction => transaction.counterparty || 'unknown')),
    unique_receiver_banks: unique(toBanks),
    cross_bank_ratio: fromBanks.reduce((sum, bank, index) => sum + Number(bank !== toBanks[index]), 0) / count,
    cash_ratio: formats.filter(format => format === 'Cash').length / count,
    wire_ratio: formats.filter(format => format === 'Wire').length / count,
    ach_ratio: formats.filter(format => format === 'ACH').length / count,
    night_ratio: hours.filter(hour => hour < 6 || hour >= 22).length / count,
  };
}

export function scoreCaseUnderML(caseData) {
  if (!model?.trees?.length) throw new Error('Trained AML model is unavailable');
  const features = buildCaseFeatures(caseData);
  const probability = model.trees.reduce((sum, tree) => sum + traverseTree(tree, features), 0) / model.trees.length;
  return { probability: Math.max(0, Math.min(1, probability)), features };
}

export function classifyModelProbability(probability) {
  const bands = model?.classification_bands || { LOW: 0.25, MEDIUM: 0.50, HIGH: 0.75 };
  if (probability < bands.LOW) return 'No Action Required - Low Risk';
  if (probability < bands.MEDIUM) return 'Enhanced Monitoring Required';
  if (probability < bands.HIGH) return 'SAR Required - High Risk';
  return 'SAR Required - Critical Risk';
}

export function getModelFeatureImportances() {
  return model?.feature_importances || {};
}

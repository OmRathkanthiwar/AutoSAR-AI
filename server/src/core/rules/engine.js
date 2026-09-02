import {
  RULE_ENGINE_VERSION,
  HIGH_RISK_COUNTRIES,
  MEDIUM_RISK_COUNTRIES,
  INR_CRITICAL_THRESHOLD,
  INR_STRUCTURING_UPPER,
  INR_STRUCTURING_LOWER,
  INR_PAN_THRESHOLD,
  INR_CASH_THRESHOLD,
  STRUCTURING_COUNT_THRESHOLD,
  RISK_WEIGHTS,
  RISK_LEVELS,
  TYPOLOGIES,
  ROUND_AMOUNTS_INR,
} from './rules.config.js';

import { scoreTransactionUnderML } from './ml_engine.js';

export function evaluateCase(caseData) {
  const triggeredRules = [];
  const metrics = {};
  const typologyTags = [];
  let riskScore = 0;

  // Normalize all amounts to INR
  const transactions = caseData.transactions.map(txn => ({
    ...txn,
    amount: txn.currency === 'INR' ? parseFloat(txn.amount) : parseFloat(txn.amount) * 83,
    currency: 'INR',
  }));

  const totalAmount = transactions.reduce((sum, txn) => sum + txn.amount, 0);
  metrics.total_transaction_value_inr = Math.round(totalAmount);
  metrics.transaction_count = transactions.length;
  metrics.average_transaction_value =
    transactions.length > 0 ? Math.round(totalAmount / transactions.length) : 0;

  // Rule 1: Critical / Large transaction amount
  transactions.forEach((txn, idx) => {
    if (txn.amount >= INR_CRITICAL_THRESHOLD) {
      riskScore += RISK_WEIGHTS.CRITICAL_AMOUNT;
      triggeredRules.push(
        `Critical Amount: ₹${(txn.amount / 100000).toFixed(2)}L exceeds ₹45L CTR threshold (TXN-${idx + 1})`
      );
      typologyTags.push(TYPOLOGIES.STRUCTURING);
    } else if (txn.amount >= 1000000) {
      riskScore += RISK_WEIGHTS.LARGE_AMOUNT;
      triggeredRules.push(`Large Transaction: ₹${(txn.amount / 100000).toFixed(2)}L (TXN-${idx + 1})`);
    } else if (txn.amount >= 500000) {
      riskScore += RISK_WEIGHTS.SIGNIFICANT_AMOUNT;
      triggeredRules.push(`Significant Amount: ₹${(txn.amount / 100000).toFixed(2)}L (TXN-${idx + 1})`);
    }
  });

  // Rule 2: Structuring Detection (₹8.5L – ₹9.9L range)
  const structuringResult = detectStructuring(transactions);
  if (structuringResult.detected) {
    riskScore += RISK_WEIGHTS.STRUCTURING_PATTERN;
    triggeredRules.push(
      `Structuring Pattern: ${structuringResult.count} transactions totaling ₹${(structuringResult.total / 100000).toFixed(2)}L near ₹10L limit`
    );
    typologyTags.push(TYPOLOGIES.STRUCTURING);
    metrics.structuring_pattern = structuringResult;
  }

  // Rule 3: Smurfing Detection (Many sub-₹50K transactions)
  const smurfingResult = detectSmurfing(transactions);
  if (smurfingResult.detected) {
    riskScore += RISK_WEIGHTS.SMURFING_PATTERN;
    triggeredRules.push(
      `Smurfing Pattern: ${smurfingResult.count} transactions below PAN threshold (₹50K each)`
    );
    typologyTags.push(TYPOLOGIES.SMURFING);
    metrics.smurfing_pattern = smurfingResult;
  }

  // Rule 4: High-Risk / Medium-Risk Jurisdictions
  const highRiskTxns = transactions.filter(txn => HIGH_RISK_COUNTRIES.has(txn.counterparty_country));
  const mediumRiskTxns = transactions.filter(txn => MEDIUM_RISK_COUNTRIES.has(txn.counterparty_country));

  if (highRiskTxns.length > 0) {
    riskScore += RISK_WEIGHTS.HIGH_RISK_JURISDICTION;
    const countries = [...new Set(highRiskTxns.map(t => t.counterparty_country))].join(', ');
    triggeredRules.push(`High-Risk Jurisdiction: ${highRiskTxns.length} transactions to ${countries}`);
    typologyTags.push(TYPOLOGIES.HAWALA);
  }

  if (mediumRiskTxns.length > 0) {
    riskScore += RISK_WEIGHTS.MEDIUM_RISK_JURISDICTION;
    triggeredRules.push(`Medium-Risk Jurisdiction: ${mediumRiskTxns.length} transactions`);
  }

  // Rule 5: Profile Inconsistency (Unexplained Wealth)
  const annualIncome = parseFloat(caseData.customer.annual_income || 1200000);
  const incomeMultiplier = totalAmount / annualIncome;
  metrics.income_multiplier = incomeMultiplier.toFixed(2);

  if (incomeMultiplier > 4) {
    riskScore += RISK_WEIGHTS.UNEXPLAINED_WEALTH;
    triggeredRules.push(
      `Unexplained Wealth: Transaction volume ${incomeMultiplier.toFixed(1)}x annual income`
    );
    typologyTags.push(TYPOLOGIES.BLACK_MONEY);
  } else if (incomeMultiplier > 2) {
    riskScore += RISK_WEIGHTS.PROFILE_INCONSISTENCY_HIGH;
    triggeredRules.push(`Profile Inconsistency: Transactions ${incomeMultiplier.toFixed(1)}x expected income`);
  }

  // Rule 6: Cash Transactions
  const cashTxns = transactions.filter(txn =>
    txn.type?.toLowerCase().includes('cash') ||
    txn.description?.toLowerCase().includes('cash')
  );

  if (cashTxns.length > 0) {
    const cashTotal = cashTxns.reduce((sum, txn) => sum + txn.amount, 0);
    if (cashTotal >= INR_CASH_THRESHOLD) {
      riskScore += RISK_WEIGHTS.CASH_TRANSACTION;
      triggeredRules.push(`Large Cash Transactions: ₹${(cashTotal / 100000).toFixed(2)}L in cash`);
      typologyTags.push(TYPOLOGIES.BLACK_MONEY);
    }
  }

  // Rule 7: Round Amount Detection
  const roundAmountCount = transactions.filter(txn =>
    ROUND_AMOUNTS_INR.includes(txn.amount) || txn.amount % 100000 === 0
  ).length;

  if (roundAmountCount >= 3) {
    riskScore += RISK_WEIGHTS.ROUND_AMOUNT;
    triggeredRules.push(`Suspicious Round Amounts: ${roundAmountCount} transactions`);
  }

  // Rule 8: Transaction Velocity
  if (transactions.length >= 2) {
    const dates = transactions.map(t => new Date(t.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    metrics.transaction_window_days = Math.round(daysDiff);

    if (daysDiff <= 3 && transactions.length >= 5) {
      riskScore += RISK_WEIGHTS.VELOCITY_EXTREME;
      triggeredRules.push(
        `Extreme Velocity: ${transactions.length} transactions in ${Math.round(daysDiff)} days`
      );
    } else if (daysDiff <= 7 && transactions.length >= 10) {
      riskScore += RISK_WEIGHTS.VELOCITY_HIGH;
      triggeredRules.push(
        `High Velocity: ${transactions.length} transactions in ${Math.round(daysDiff)} days`
      );
    }
  }

  // ML Predictive Scoring
  let maxMLRiskScore = 0;
  transactions.forEach((txn, idx) => {
    const probability = scoreTransactionUnderML(txn);
    metrics[`ml_likelihood_txn_${idx + 1}`] = parseFloat(probability.toFixed(4));
    if (probability > maxMLRiskScore) maxMLRiskScore = probability;

    if (probability >= 0.65) {
      riskScore += RISK_WEIGHTS.MEDIUM_RISK_JURISDICTION;
      triggeredRules.push(
        `ML Model Alert: High anomaly probability (${(probability * 100).toFixed(1)}%) for TXN-${idx + 1}`
      );
      typologyTags.push('AI_DETECTED_ANOMALY');
    }
  });

  metrics.max_ai_anomaly_score = parseFloat(maxMLRiskScore.toFixed(4));

  // Blend heuristic + ML scores
  let continuousScore = riskScore;
  continuousScore += Math.min(15, totalAmount / 500000);
  continuousScore += transactions.length * 1.35;

  const mlImpact = maxMLRiskScore * 100;
  let finalRiskScore = Math.max(continuousScore, mlImpact);

  if (continuousScore > 20 && mlImpact > 20) {
    finalRiskScore =
      Math.max(continuousScore, mlImpact) * 0.7 +
      Math.min(continuousScore, mlImpact) * 0.4;
  }

  // Asymptotic smoothing near max
  if (finalRiskScore > 85) {
    finalRiskScore = 85 + 14.9 * (1 - Math.exp(-(finalRiskScore - 85) / 15));
  }

  const roundedRiskScore = Math.round(Math.min(finalRiskScore, 99));
  const finalClassification = determineClassification(roundedRiskScore);

  const suspicionSummary = {
    customer_name: caseData.customer.name || caseData.customer.full_name,
    customer_id: caseData.customer.id || caseData.customer.customer_id,
    occupation: caseData.customer.occupation,
    total_amount_inr: Math.round(totalAmount),
    total_amount_lakhs: (totalAmount / 100000).toFixed(2),
    transaction_count: transactions.length,
    high_risk_countries: [...new Set(highRiskTxns.map(t => t.counterparty_country))],
    primary_concerns: triggeredRules.slice(0, 5),
    recommended_action: finalClassification,
  };

  return {
    case_id: caseData.case_id,
    execution_timestamp: new Date().toISOString(),
    rule_engine_version: RULE_ENGINE_VERSION,
    triggered_rules: triggeredRules,
    calculated_metrics: metrics,
    typology_tags: [...new Set(typologyTags)],
    aggregated_risk_score: roundedRiskScore,
    suspicion_summary_json: suspicionSummary,
    final_classification: finalClassification,
  };
}

function detectStructuring(transactions) {
  const structuringTxns = transactions.filter(
    txn => txn.amount >= INR_STRUCTURING_LOWER && txn.amount <= INR_STRUCTURING_UPPER
  );
  if (structuringTxns.length >= 3) {
    const total = structuringTxns.reduce((sum, txn) => sum + txn.amount, 0);
    return { detected: true, count: structuringTxns.length, total };
  }
  return { detected: false, count: 0, total: 0 };
}

function detectSmurfing(transactions) {
  const smurfingTxns = transactions.filter(txn => txn.amount < INR_PAN_THRESHOLD);
  if (smurfingTxns.length >= STRUCTURING_COUNT_THRESHOLD) {
    const total = smurfingTxns.reduce((sum, txn) => sum + txn.amount, 0);
    return { detected: true, count: smurfingTxns.length, total };
  }
  return { detected: false, count: 0, total: 0 };
}

function determineClassification(score) {
  if (score >= RISK_LEVELS.CRITICAL) return 'SAR Required - Critical Risk';
  if (score >= RISK_LEVELS.HIGH) return 'SAR Required - High Risk';
  if (score >= RISK_LEVELS.MEDIUM) return 'Enhanced Monitoring Required';
  return 'No Action Required - Low Risk';
}

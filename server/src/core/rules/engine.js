import { scoreCaseUnderML, classifyModelProbability, getModelFeatureImportances } from './ml_engine.js';

export const MODEL_ENGINE_VERSION = 'ml-rf-case-v1.0.0';

export function evaluateCase(caseData) {
    const transactions = (caseData.transactions || []).map(transaction => ({
        ...transaction,
        amount: transaction.currency === 'INR'
            ? parseFloat(transaction.amount)
            : (parseFloat(transaction.amount) || 0) * 83,
        currency: 'INR',
    }));
    const prediction = scoreCaseUnderML({ ...caseData, transactions });
    const score = Math.round(prediction.probability * 100);
    const classification = classifyModelProbability(prediction.probability);
    const metrics = {
        ...prediction.features,
        total_transaction_value_inr: Math.round(transactions.reduce((sum, transaction) => sum + transaction.amount, 0)),
        transaction_count: transactions.length,
        average_transaction_value: transactions.length
            ? Math.round(transactions.reduce((sum, transaction) => sum + transaction.amount, 0) / transactions.length)
            : 0,
        model_probability: Number(prediction.probability.toFixed(6)),
        model_type: 'random_forest_case_classifier',
    };
    const importantFeatures = Object.entries(getModelFeatureImportances())
        .sort(([, left], [, right]) => right - left)
        .slice(0, 3)
        .map(([feature]) => feature);

    return {
        case_id: caseData.case_id,
        execution_timestamp: new Date().toISOString(),
        rule_engine_version: MODEL_ENGINE_VERSION,
        triggered_rules: [
            score === 0
                ? 'The model found no strong suspicious pattern in these transactions.'
                : `The model estimates a ${score}/100 chance of suspicious activity.`,
            `Model assessment: ${classification}`,
            `Main factors considered: ${importantFeatures.map(getFriendlyFeatureName).join(', ')}`,
        ],
        calculated_metrics: metrics,
        typology_tags: ['AI_MODEL_PREDICTION'],
        aggregated_risk_score: score,
        suspicion_summary_json: {
            customer_name: caseData.customer.name || caseData.customer.full_name,
            customer_id: caseData.customer.id || caseData.customer.customer_id,
            occupation: caseData.customer.occupation,
            total_amount_inr: metrics.total_transaction_value_inr,
            transaction_count: transactions.length,
            recommended_action: classification,
            model_probability: prediction.probability,
        },
        final_classification: classification,
    };
}

function getFriendlyFeatureName(feature) {
    const names = {
        transaction_count: 'number of transactions',
        total_amount_usd: 'total amount moved',
        average_amount_usd: 'average transaction amount',
        maximum_amount_usd: 'largest transaction amount',
        amount_std_usd: 'variation in transaction amounts',
        unique_receivers: 'number of different recipients',
        unique_receiver_banks: 'number of recipient banks',
        cross_bank_ratio: 'transfers between different banks',
        cash_ratio: 'cash transaction share',
        wire_ratio: 'wire transfer share',
        ach_ratio: 'ACH transfer share',
        night_ratio: 'transactions made at night',
    };
    return names[feature] || feature;
}

/**
 * Gemini AI Service - Indian Banking SAR Generation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const SAR_PROMPT_TEMPLATE_INR = `You are an expert AML compliance analyst for an Indian bank, tasked with generating a Suspicious Activity Report (SAR) for submission to FIU-IND under the Prevention of Money Laundering Act (PMLA) 2002.

Generate a comprehensive SAR narrative strictly answering: WHO, WHAT, WHERE, WHEN, WHY, HOW.

Use Indian Rupees (₹) and Lakhs notation throughout. Be specific, factual, and compliance-focused.

Customer Information:
{customer_info}

Transaction Summary:
{transaction_summary}

Risk Analysis:
{risk_analysis}

Generate the SAR narrative following this exact structure:

SUBJECT IDENTIFICATION:
[Who is the customer? Include name, PAN, occupation, address]

WHO: [Who is involved? Customer name, role, occupation]

WHAT: [What activity occurred? Total amount in ₹ Lakhs, number of transactions]

WHERE: [Where did transactions occur? Geographic locations, jurisdictions]

WHEN: [When did activity occur? Dates, time window, velocity]

WHY: [Why is this suspicious? List all red flags and risk indicators]

HOW: [How was the activity conducted? Methods, patterns, structuring techniques]

TRANSACTION DETAILS:
[List each transaction with date, amount in ₹, counterparty, country, type]

RATIONALE FOR FILING:
[Why does this warrant a SAR? Reference PMLA, FIU-IND guidelines, specific thresholds (₹45L CTR, ₹10L cash reporting)]

Be detailed, professional, and ensure compliance with FIU-IND reporting standards.`;

interface RuleEngineOutput {
  triggered_rules: string[];
  calculated_metrics: Record<string, any>;
  typology_tags: string[];
  aggregated_risk_score: number;
  suspicion_summary_json: Record<string, any>;
  final_classification: string;
}

export async function generateSARNarrative(
  customerData: any,
  transactions: any[],
  ruleEngineOutput: RuleEngineOutput
): Promise<{ narrative: string; llm_log?: any }> {

  const apiKey = process.env.GEMINI_API_KEY;

  // If no API key, return template-based narrative
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set. Using template-based generation.');
    return { narrative: generateFallbackSAR(customerData, transactions, ruleEngineOutput) };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Build prompt
    const customerInfo = buildCustomerInfo(customerData);
    const transactionSummary = buildTransactionSummary(transactions, ruleEngineOutput);
    const riskAnalysis = buildRiskAnalysis(ruleEngineOutput);

    const prompt = SAR_PROMPT_TEMPLATE_INR
      .replace('{customer_info}', customerInfo)
      .replace('{transaction_summary}', transactionSummary)
      .replace('{risk_analysis}', riskAnalysis);

    // Call Gemini API
    const result = await model.generateContent(prompt);
    const narrative = result.response.text();

    // Log LLM interaction
    const llmLog = {
      model_version: 'gemini-2.0-flash-exp',
      prompt_template_version: 'INR-v2.0',
      timestamp: new Date().toISOString(),
      prompt_length: prompt.length,
      response_length: narrative.length,
    };

    return { narrative, llm_log: llmLog };

  } catch (error) {
    console.error('Gemini API error:', error);
    return { narrative: generateFallbackSAR(customerData, transactions, ruleEngineOutput) };
  }
}

function buildCustomerInfo(customer: any): string {
  return `Name: ${customer.name || customer.full_name}
Customer ID: ${customer.id || customer.customer_id}
PAN: ${customer.pan || 'Not Available'}
Occupation: ${customer.occupation || 'Unknown'}
Annual Income: ₹${((customer.annual_income || 1200000) / 100000).toFixed(2)} Lakhs
Address: ${customer.address || 'Not Available'}`;
}

function buildTransactionSummary(transactions: any[], ruleOutput: RuleEngineOutput): string {
  const total = ruleOutput.calculated_metrics.total_transaction_value_inr || 0;
  const count = ruleOutput.calculated_metrics.transaction_count || transactions.length;

  return `Total Transactions: ${count}
Total Value: ₹${(total / 100000).toFixed(2)} Lakhs (₹${total.toLocaleString()})
Risk Score: ${ruleOutput.aggregated_risk_score}/100
Classification: ${ruleOutput.final_classification}

Transactions:
${transactions.map((txn, idx) =>
    `${idx + 1}. ${txn.date} - ₹${parseFloat(txn.amount).toLocaleString()} to ${txn.counterparty} (${txn.counterparty_country || txn.country || 'Unknown'}) via ${txn.type}`
  ).join('\n')}`;
}

function buildRiskAnalysis(ruleOutput: RuleEngineOutput): string {
  return `Triggered Rules:
${ruleOutput.triggered_rules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n')}

Typologies Identified:
${ruleOutput.typology_tags.join(', ')}

Key Metrics:
${Object.entries(ruleOutput.calculated_metrics)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n')}`;
}

function generateFallbackSAR(
  customer: any,
  transactions: any[],
  ruleOutput: RuleEngineOutput
): string {
  const total = ruleOutput.calculated_metrics.total_transaction_value_inr || 0;
  const totalLakhs = (total / 100000).toFixed(2);

  return `SUSPICIOUS ACTIVITY REPORT (SAR)
Financial Intelligence Unit - India (FIU-IND)

SUBJECT IDENTIFICATION:
Name: ${customer.full_name}
Customer ID: ${customer.customer_id}
PAN: ${customer.pan || 'Not Available'}
Date of Birth: ${customer.date_of_birth || 'Not Available'}
Address: ${customer.address || 'Not Available'}
Occupation: ${customer.occupation || 'Unknown'}

SUMMARY OF SUSPICIOUS ACTIVITY:
Risk Score: ${ruleOutput.aggregated_risk_score}/100
Classification: ${ruleOutput.final_classification}

WHO: ${customer.full_name} (${customer.customer_id}), ${customer.occupation || 'occupation unknown'}

WHAT: ${transactions.length} transaction(s) totaling ₹${totalLakhs} Lakhs (₹${total.toLocaleString()})

WHEN: Transactions occurred during the monitoring period

WHERE: ${ruleOutput.typology_tags.join(', ')}

WHY: The following suspicious indicators were identified:
${ruleOutput.triggered_rules.map((rule: string, idx: number) => `${idx + 1}. ${rule}`).join('\n')}

HOW: Transaction analysis reveals the following pattern:

TRANSACTION DETAILS:
${transactions.map((txn: any, idx: number) =>
    `${idx + 1}. ${txn.date} - ₹${parseFloat(txn.amount).toLocaleString()} to ${txn.counterparty} (${txn.country}) via ${txn.type}`
  ).join('\n')}

RISK ANALYSIS:
Typologies: ${ruleOutput.typology_tags.join(', ')}
Annual Income: ₹${((customer.annual_income || 1200000) / 100000).toFixed(2)} Lakhs
Transaction Volume: ₹${totalLakhs} Lakhs

RATIONALE FOR FILING:
Based on analysis under the Prevention of Money Laundering Act (PMLA) 2002 and FIU-IND guidelines, this activity demonstrates characteristics consistent with potential money laundering. The transaction pattern exceeds normal expectations for the customer profile.

RECOMMENDATION:
Immediate review by compliance officers required. Consider reporting to FIU-IND under PMLA guidelines.

Report Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
Generated by: AutoSAR AI System v2.0`;
}

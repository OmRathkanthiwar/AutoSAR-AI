import { NextRequest, NextResponse } from 'next/server';
import { evaluateCase } from '@/core/rules/engine';
import { CaseService } from '@/core/services/caseService';
import { CaseData, CustomerProfile, Transaction, RuleEngineOutput } from '@/core/types';
import { generateSARNarrative } from '@/core/llm/geminiService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.customers || !Array.isArray(body.customers)) {
      return NextResponse.json(
        { error: 'Invalid format: "customers" array required' },
        { status: 400 }
      );
    }

    const customers = body.customers;
    const processedCases: string[] = [];
    let sarsGenerated = 0;

    for (const customerData of customers) {
      // Validate minimum required fields
      if (!customerData.customer_id || !customerData.transactions || !Array.isArray(customerData.transactions)) {
        console.warn(`Skipping invalid customer: ${customerData.customer_id || 'unknown'}`);
        continue;
      }

      // 1. Generate Unique ID
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const caseId = `SAR-${new Date().getFullYear()}-${String(timestamp).slice(-6)}-${randomSuffix}`;

      // 2. Map to Domain Types
      const customer: CustomerProfile = {
        id: customerData.customer_id,
        name: customerData.full_name,
        occupation: customerData.occupation || 'Unknown',
        annual_income: customerData.annual_income || 1200000,
        expected_monthly_volume: customerData.expected_monthly_volume || 100000,
        // Optional fields
        date_of_birth: customerData.date_of_birth,
        pan: customerData.pan,
        address: customerData.address
      };

      const transactions: Transaction[] = customerData.transactions.map((txn: any) => ({
        transaction_id: txn.transaction_id, // Fixed: Map to transaction_id for consistency
        amount: parseFloat(txn.amount),
        currency: txn.currency || 'INR',
        date: txn.date,
        counterparty: txn.counterparty,
        counterparty_country: txn.counterparty_country || 'IN',
        type: txn.type,
        description: txn.description || ''
      }));

      const caseData: CaseData = {
        case_id: caseId,
        customer,
        transactions,
        alert_date: new Date().toISOString()
      };

      // 3. Evaluate Rules
      const ruleOutput = evaluateCase(caseData);

      // 4. Persistence (if Risk >= 50)
      if (ruleOutput.aggregated_risk_score >= 50) {
        await CaseService.createCase(caseData, ruleOutput);

        // 5. Generate & Save Draft
        const { narrative } = await generateSARNarrative(caseData.customer, caseData.transactions, ruleOutput);
        await CaseService.saveSARDraft(caseId, narrative);

        processedCases.push(caseId);
        sarsGenerated++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: customers.length,
        sars_generated: sarsGenerated,
        case_ids: processedCases,
      },
      message: `Processed ${customers.length} customers. Generated ${sarsGenerated} SARs.`,
    });

  } catch (error: any) {
    console.error('Processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process file', details: error.message },
      { status: 500 }
    );
  }
}



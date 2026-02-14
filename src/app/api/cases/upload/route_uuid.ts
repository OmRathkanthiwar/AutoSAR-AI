import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';
import { evaluateCase } from '@/core/rules/engine';
import { randomUUID } from 'crypto';
import { generateSARNarrative as generateGeminiSAR } from '@/core/llm/geminiService';

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
    let firstCaseId: string | null = null;

    for (const customer of customers) {
      if (!customer.customer_id || !customer.transactions || !Array.isArray(customer.transactions)) {
        console.warn(`Skipping invalid customer: ${customer.customer_id || 'unknown'}`);
        continue;
      }

      // Generate UUID for database, but keep readable ID for display
      const uuid = randomUUID();
      const timestamp = Date.now();
      const displayCaseId = `SAR-${new Date().getFullYear()}-${String(timestamp).slice(-6)}`;

      if (!firstCaseId) {
        firstCaseId = displayCaseId;
      }

      // Prepare case data for rule engine
      const caseData = {
        case_id: displayCaseId,
        customer: {
          name: customer.full_name,
          id: customer.customer_id,
          occupation: customer.occupation || 'Unknown',
          annual_income: customer.annual_income || 1200000,
          expected_monthly_volume: customer.expected_monthly_volume || 100000,
        },
        transactions: customer.transactions.map((txn: any) => ({
          transaction_id: txn.transaction_id, // Fixed: Map to transaction_id for consistency
          amount: parseFloat(txn.amount),
          currency: txn.currency || 'INR',
          date: txn.date,
          counterparty: txn.counterparty,
          counterparty_country: txn.counterparty_country || 'IN',
          type: txn.type,
          description: txn.description || '',
        })),
        alert_date: new Date().toISOString(),
      };

      // Run risk evaluation
      const riskAssessment = evaluateCase(caseData);

      // Only create SAR if risk score >= 50
      const requiresSAR = riskAssessment.aggregated_risk_score >= 50;

      if (requiresSAR) {
        // INSERT INTO cases table with UUID
        const { data: caseRecord, error: caseError } = await supabase
          .from('cases')
          .insert({
            case_id: uuid,  // Use UUID for database
            status: 'DRAFT_READY',
            created_at: new Date().toISOString(),
            last_updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (caseError) {
          console.error('Error inserting case:', caseError);
          continue;
        }

        // INSERT INTO case_data_normalized
        const { error: dataError } = await supabase
          .from('case_data_normalized')
          .insert({
            case_id: uuid,
            alert_metadata: {
              alert_id: `ALT-${timestamp}`,
              alert_date: new Date().toISOString(),
              alert_type: 'Transaction Monitoring',
              severity: riskAssessment.aggregated_risk_score >= 80 ? 'CRITICAL' : 'HIGH',
              display_case_id: displayCaseId,  // Store readable ID here
            },
            customer_profile: {
              customer_id: customer.customer_id,
              full_name: customer.full_name,
              date_of_birth: customer.date_of_birth,
              pan: customer.pan,
              address: customer.address,
              occupation: customer.occupation,
              annual_income: customer.annual_income,
              expected_monthly_volume: customer.expected_monthly_volume,
              risk_rating: riskAssessment.aggregated_risk_score >= 80 ? 'Critical' :
                riskAssessment.aggregated_risk_score >= 60 ? 'High' : 'Medium',
            },
            transaction_summary: {
              total_amount: riskAssessment.calculated_metrics.total_transaction_value_inr,
              transaction_count: riskAssessment.calculated_metrics.transaction_count,
              date_range: {
                start: customer.transactions[0].date,
                end: customer.transactions[customer.transactions.length - 1].date,
              },
            },
            transaction_list: customer.transactions,
            risk_indicators: riskAssessment.triggered_rules.map((rule: string) => ({
              indicator_type: rule,
              severity: riskAssessment.aggregated_risk_score >= 80 ? 'CRITICAL' : 'HIGH',
              description: rule,
            })),
          });

        if (dataError) {
          console.error('Error inserting case data:', dataError);
        }

        // INSERT INTO rule_engine_outputs
        const { error: ruleError } = await supabase
          .from('rule_engine_outputs')
          .insert({
            case_id: uuid,
            execution_timestamp: riskAssessment.execution_timestamp,
            rule_engine_config_id: riskAssessment.rule_engine_version,
            triggered_rules: riskAssessment.triggered_rules,
            calculated_metrics: riskAssessment.calculated_metrics,
            typology_tags: riskAssessment.typology_tags,
            aggregated_risk_score: riskAssessment.aggregated_risk_score,
            suspicion_summary_json: riskAssessment.suspicion_summary_json,
            final_classification: riskAssessment.final_classification,
          });

        if (ruleError) {
          console.error('Error inserting rule output:', ruleError);
        }

        // Generate SAR narrative
        const { narrative: sarNarrative } = await generateGeminiSAR(customer, customer.transactions, riskAssessment);

        // INSERT INTO sar_drafts
        const { error: draftError } = await supabase
          .from('sar_drafts')
          .insert({
            case_id: uuid,
            version_number: 1,
            narrative_text: sarNarrative,
            source_event: 'AUTO_GENERATED',
            is_final_submission: false,
          });

        if (draftError) {
          console.error('Error inserting SAR draft:', draftError);
        }

        // INSERT audit log
        const { error: auditError } = await supabase
          .from('audit_trail_logs')
          .insert({
            case_id: uuid,
            event_type: 'CASE_CREATED',
            description: 'Case created from file upload',
            detail_payload: {
              source: 'file_upload',
              customer_id: customer.customer_id,
              risk_score: riskAssessment.aggregated_risk_score,
              display_case_id: displayCaseId,
            },
            user_id: 'system',
          });

        processedCases.push(uuid);  // Store UUID for reference
        sarsGenerated++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: customers.length,
        sars_generated: sarsGenerated,
        first_case_id: processedCases[0],  // Return UUID for navigation
        case_ids: processedCases,
      },
      message: `Processed ${customers.length} customers. Generated ${sarsGenerated} SARs.`,
    });

  } catch (error: any) {
    console.error('File upload processing error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process file',
        details: error.message
      },
      { status: 500 }
    );
  }
}



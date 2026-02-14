import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/cases - List cases from Supabase
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from('cases')
      .select(`
        case_id,
        created_at,
        status,
        rule_engine_outputs (
          aggregated_risk_score
        ),
        case_data_normalized (
          customer_profile
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Map to the shape expected by the dashboard UI
    const mapped = (data || []).map((row: any) => {
      // Handle potential single object return from 1:1 join
      const normalizedData = Array.isArray(row.case_data_normalized)
        ? row.case_data_normalized[0]
        : row.case_data_normalized;

      const ruleOutput = Array.isArray(row.rule_engine_outputs)
        ? row.rule_engine_outputs[0]
        : row.rule_engine_outputs;

      const profile = normalizedData?.customer_profile || {};
      const risk = ruleOutput?.aggregated_risk_score || 0;

      return {
        case_id: row.case_id,
        customer_name: row.customer_name || profile.name || profile.full_name || 'Unknown',
        customer_id: profile.id || profile.customer_id || '',
        status: row.status,
        risk_score: risk,
        created_at: row.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: mapped,
      count: mapped.length,
    });
  } catch (error: any) {
    console.error('Cases API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cases', details: error.message },
      { status: 500 },
    );
  }
}

// POST /api/cases - Create new case in Supabase with normalized data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_id,
      alert_date,
      alert_metadata = {},
      customer_profile = {},
      transaction_summary = {},
      transaction_list = [],
      case_context = {},
      risk_indicators = [],
    } = body;

    if (!customer_name) {
      return NextResponse.json(
        { error: 'Missing required field: customer_name' },
        { status: 400 },
      );
    }

    const supabase = getServiceSupabase();

    // 1) Insert into cases
    const { data: caseRows, error: caseError } = await supabase
      .from('cases')
      .insert({
        customer_name,
        status: 'Alert Received',
        alert_date: alert_date ?? null,
        // risk_level can be filled after running rule engine
      })
      .select('*')
      .single();

    if (caseError || !caseRows) {
      throw caseError;
    }

    const caseId = caseRows.case_id;

    // 2) Insert normalized data
    const { error: dataError } = await supabase.from('case_data_normalized').insert({
      case_id: caseId,
      alert_metadata,
      customer_profile: {
        customer_id,
        ...customer_profile,
      },
      transaction_summary,
      transaction_list,
      case_context,
      risk_indicators,
    });

    if (dataError) {
      throw dataError;
    }

    return NextResponse.json(
      {
        success: true,
        data: { case_id: caseId },
        message: 'Case created in Supabase successfully',
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error('Case Creation Error:', error);
    return NextResponse.json(
      { error: 'Failed to create case in Supabase', details: error.message },
      { status: 500 },
    );
  }
}

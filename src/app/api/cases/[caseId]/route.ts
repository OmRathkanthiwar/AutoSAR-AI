import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db';
import { evaluateCase } from '@/core/rules/engine';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    // Use service role client to bypass RLS
    let supabase;
    try {
      supabase = getServiceSupabase();
    } catch (err: any) {
      console.error('Service Supabase Check Failed:', err.message);
      return NextResponse.json(
        { error: 'Server Configuration Error', details: 'Missing SUPABASE_SERVICE_ROLE_KEY environment variable' },
        { status: 500 }
      );
    }

    // 1. Fetch main case record
    const { data: caseRow, error: caseError } = await supabase
      .from('cases')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (caseError || !caseRow) {
      // Return 404 explicitly for frontend to handle
      if (caseError?.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Case not found' },
          { status: 404 }
        );
      }
      throw caseError;
    }

    // 2. Fetch normalized data
    const { data: normalizedRow, error: normError } = await supabase
      .from('case_data_normalized')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (normError && normError.code !== 'PGRST116') {
      console.error('Error fetching normalized data:', normError);
    }

    // 3. Fetch rule output
    const { data: ruleOutput, error: ruleError } = await supabase
      .from('rule_engine_outputs')
      .select('*')
      .eq('case_id', caseId)
      .single();

    if (ruleError && ruleError.code !== 'PGRST116') {
      console.error('Error fetching rule output:', ruleError);
    }

    // 4. Fetch latest SAR draft
    const { data: sarDraft, error: draftError } = await supabase
      .from('sar_drafts')
      .select('*')
      .eq('case_id', caseId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (draftError && draftError.code !== 'PGRST116') {
      console.error('Error fetching draft:', draftError);
    }

    // 5. Fetch audit logs
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_trail_logs')
      .select('*')
      .eq('case_id', caseId)
      .order('timestamp', { ascending: false });

    if (auditError) {
      console.error('Error fetching audit logs:', auditError);
    }

    // Construct response object matching frontend expectations
    const customerProfile = (normalizedRow?.customer_profile || {}) as any;
    const transactionList = (normalizedRow?.transaction_list || []) as any[];

    // Combined data object
    const caseData = {
      case: caseRow,
      data: {
        ...normalizedRow, // Include all normalized properties
        customer_profile: {
          full_name: customerProfile.full_name || caseRow.customer_name || 'Unknown',
          customer_id: customerProfile.customer_id || 'Unknown',
          risk_rating: customerProfile.risk_rating || 'Medium',
          occupation: customerProfile.occupation || 'Unknown',
          expected_monthly_volume: customerProfile.expected_monthly_volume,
          ...customerProfile
        },
        transaction_list: transactionList, // Keep original list
        risk_indicators: normalizedRow?.risk_indicators || [],
        transaction_summary: normalizedRow?.transaction_summary || null
      },
      ruleOutput: ruleOutput || { aggregated_risk_score: 0 },
      draft: sarDraft || null,
      auditLogs: auditLogs || []
    };

    return NextResponse.json({
      success: true,
      data: caseData,
    });
  } catch (error: any) {
    console.error('Get case by id error:', error);
    return NextResponse.json(
      { error: 'Failed to load case', details: error.message },
      { status: 500 },
    );
  }
}

// PATCH /api/cases/[caseId] - Update case
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();
    const { status, sar_draft, action } = body;

    console.log(`Updating case ${caseId}:`, { status, action });

    // Use service role to bypass RLS
    const supabase = getServiceSupabase();

    if (status === 'COMPLETED' && action === 'complete_case') {
      // 1. Update Case Status
      const { error: statusError } = await supabase
        .from('cases')
        .update({
          status: 'COMPLETED',
          last_updated_at: new Date().toISOString()
        })
        .eq('case_id', caseId);

      if (statusError) throw statusError;

      // 2. Mark latest draft as final (optional, best effort)
      await supabase
        .from('sar_drafts')
        .update({ is_final_submission: true })
        .eq('case_id', caseId)
        .order('version_number', { ascending: false })
        .limit(1);

      // 3. Log Audit Trail
      await supabase.from('audit_trail_logs').insert({
        case_id: caseId,
        event_type: 'STATUS_CHANGE',
        description: 'Case marked as COMPLETED',
        user_id: 'analyst', // In real app, get from session
        detail_payload: { new_status: 'COMPLETED' }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Case updated successfully'
    });

  } catch (error: any) {
    console.error('Update Case Error:', error);
    return NextResponse.json(
      { error: 'Failed to update case', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/cases/[caseId] - Delete case (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    // In production: Soft delete in Supabase
    console.log(`Deleting case ${caseId}`);

    return NextResponse.json({
      success: true,
      message: 'Case deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete Case Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete case', details: error.message },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/db';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ caseId: string }> }
) {
    try {
        const { caseId } = await params;
        const body = await request.json();
        const { narrative_text, version_number } = body;

        if (!narrative_text) {
            return NextResponse.json(
                { error: 'Narrative text is required' },
                { status: 400 }
            );
        }

        const supabase = getServiceSupabase();

        // Insert new draft version
        const { data, error } = await supabase
            .from('sar_drafts')
            .insert({
                case_id: caseId,
                version_number: version_number,
                narrative_text: narrative_text,
                source_event: 'MANUAL_EDIT',
                is_final_submission: false,
                created_by_user_id: 'analyst', // In real app, get from session
            })
            .select()
            .single();

        if (error) throw error;

        // Log to audit trail
        await supabase.from('audit_trail_logs').insert({
            case_id: caseId,
            event_type: 'DRAFT_SAVED',
            description: `Draft saved (Version ${version_number.toFixed(1)})`,
            user_id: 'analyst',
            detail_payload: { version_number },
        });

        return NextResponse.json({ success: true, data });

    } catch (error: any) {
        console.error('Save draft error:', error);
        return NextResponse.json(
            { error: 'Failed to save draft', details: error.message },
            { status: 500 }
        );
    }
}

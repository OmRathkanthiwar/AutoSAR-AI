
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getServiceSupabase } from './src/lib/db';

async function clearDatabase() {
    const supabase = getServiceSupabase();
    console.log('Starting database cleanup...');

    try {
        // 1. Delete dependent tables first (if no cascade) to be safe
        console.log('Deleting audit logs...');
        await supabase.from('audit_trail_logs').delete().neq('case_id', '00000000-0000-0000-0000-000000000000');

        console.log('Deleting drafts...');
        await supabase.from('sar_drafts').delete().neq('case_id', '00000000-0000-0000-0000-000000000000');

        console.log('Deleting rule outputs...');
        await supabase.from('rule_engine_outputs').delete().neq('case_id', '00000000-0000-0000-0000-000000000000');

        console.log('Deleting normalized data...');
        await supabase.from('case_data_normalized').delete().neq('case_id', '00000000-0000-0000-0000-000000000000');

        // 2. Delete main cases table
        console.log('Deleting cases...');
        const { error, data } = await supabase
            .from('cases')
            .delete()
            .neq('case_id', '00000000-0000-0000-0000-000000000000') // select all
            .select('*');

        if (error) {
            throw error;
        }

        console.log(`✅ Successfully deleted ${data?.length ?? 0} cases and related data.`);

    } catch (error: any) {
        console.error('❌ Cleanup failed:', error.message);
    }
}

clearDatabase();

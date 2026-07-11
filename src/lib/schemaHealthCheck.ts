import { supabase } from '@/lib/supabaseClient';

interface HealthResult {
  table: string;
  status: 'ok' | 'error';
  detail: string;
}

export async function runSchemaHealthCheck(): Promise<HealthResult[]> {
  const tables = ['couples', 'date_courses', 'partner_moods'];
  const results: HealthResult[] = [];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        results.push({ table, status: 'error', detail: error.message });
      } else {
        results.push({ table, status: 'ok', detail: '연결 정상' });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ table, status: 'error', detail: message });
    }
  }

  return results;
}

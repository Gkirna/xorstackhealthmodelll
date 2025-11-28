/**
 * Audit logging for sensitive operations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

export interface AuditLogEntry {
  user_id: string;
  operation_type: string;
  session_id?: string;
  model?: string;
  status: 'success' | 'error';
  duration_ms?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export async function logAuditEntry(
  entry: AuditLogEntry,
  authHeader: string
): Promise<void> {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    await supabaseClient.from('ai_logs').insert({
      user_id: entry.user_id,
      operation_type: entry.operation_type,
      session_id: entry.session_id,
      model: entry.model,
      status: entry.status,
      duration_ms: entry.duration_ms,
      error: entry.error,
      function_name: entry.metadata?.function_name,
      input_hash: entry.metadata?.input_hash,
      output_preview: entry.metadata?.output_preview,
    });

    console.log('📝 Audit log created:', {
      operation: entry.operation_type,
      status: entry.status,
      user: entry.user_id,
    });
  } catch (error) {
    console.error('❌ Audit logging failed:', error);
    // Don't throw - audit failures shouldn't break main functionality
  }
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { type, payload, create_notification = false } = await req.json();

    if (!type) {
      throw new Error('Missing required field: type');
    }

    // Insert audit log
    const { data: auditLog, error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: type,
        resource_type: payload?.resource_type || null,
        resource_id: payload?.resource_id || null,
        metadata: payload || {},
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      })
      .select()
      .single();

    if (auditError) {
      console.error('Error creating audit log:', auditError);
      throw auditError;
    }

    // Optionally create notification
    if (create_notification && payload?.title) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type,
        title: payload.title,
        message: payload.message || null,
        metadata: payload,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        log_id: auditLog.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in log-event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'LOGGING_ERROR', message: errorMessage },
      }),
      {
        status: errorMessage.includes('Unauthorized') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

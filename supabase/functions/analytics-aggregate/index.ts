import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { user_id, time_range = '30d' } = await req.json();

    console.log('📊 Aggregating analytics:', { user_id, time_range });

    // Calculate date range
    const now = new Date();
    const daysBack = parseInt(time_range.replace('d', ''));
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Fetch sessions
    const { data: sessions, error: sessionsError } = await supabaseClient
      .from('sessions')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', startDate.toISOString());

    if (sessionsError) throw sessionsError;

    // Fetch AI logs
    const { data: aiLogs, error: aiLogsError } = await supabaseClient
      .from('ai_logs')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', startDate.toISOString());

    if (aiLogsError) throw aiLogsError;

    // Fetch tasks
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', startDate.toISOString());

    if (tasksError) throw tasksError;

    // Calculate aggregations
    const analytics = {
      overview: {
        total_sessions: sessions?.length || 0,
        completed_sessions: sessions?.filter(s => s.status === 'completed').length || 0,
        total_transcription_time: sessions?.reduce((sum, s) => sum + (s.transcription_duration_seconds || 0), 0) || 0,
        total_words_transcribed: sessions?.reduce((sum, s) => sum + (s.total_words || 0), 0) || 0,
      },
      ai_usage: {
        total_operations: aiLogs?.length || 0,
        total_tokens: aiLogs?.reduce((sum, log) => sum + (log.tokens_used || 0), 0) || 0,
        average_latency: aiLogs && aiLogs.length > 0
          ? aiLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / aiLogs.length
          : 0,
        operations_by_type: aiLogs?.reduce((acc: any, log) => {
          acc[log.operation_type] = (acc[log.operation_type] || 0) + 1;
          return acc;
        }, {}),
      },
      tasks: {
        total_tasks: tasks?.length || 0,
        completed_tasks: tasks?.filter(t => t.status === 'completed').length || 0,
        pending_tasks: tasks?.filter(t => t.status === 'pending').length || 0,
        tasks_by_priority: {
          high: tasks?.filter(t => t.priority === 'high').length || 0,
          medium: tasks?.filter(t => t.priority === 'medium').length || 0,
          low: tasks?.filter(t => t.priority === 'low').length || 0,
        },
      },
      quality_metrics: {
        average_confidence: sessions && sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (s.transcript_quality_avg || 0), 0) / sessions.length
          : 0,
      },
      time_range: {
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
        days: daysBack,
      },
    };

    // Store aggregated metrics
    const metricsToStore = [
      {
        metric_type: 'total_sessions',
        metric_value: analytics.overview.total_sessions,
        metadata: { user_id, time_range },
      },
      {
        metric_type: 'ai_tokens_used',
        metric_value: analytics.ai_usage.total_tokens,
        metadata: { user_id, time_range },
      },
      {
        metric_type: 'average_confidence',
        metric_value: analytics.quality_metrics.average_confidence,
        metadata: { user_id, time_range },
      },
    ];

    await supabaseClient
      .from('system_metrics')
      .insert(metricsToStore);

    console.log('✅ Analytics aggregated:', {
      sessions: analytics.overview.total_sessions,
      ai_operations: analytics.ai_usage.total_operations,
      tasks: analytics.tasks.total_tasks,
    });

    return new Response(
      JSON.stringify({ analytics, success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Analytics aggregation error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Analytics aggregation failed',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

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

    const { 
      user_id, 
      title, 
      message, 
      type = 'info',
      category,
      action_url,
      metadata 
    } = await req.json();

    if (!user_id || !title || !message) {
      throw new Error('user_id, title, and message are required');
    }

    console.log('📬 Sending notification:', { user_id, title, type });

    // Create notification in database
    const { data: notification, error: notificationError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id,
        title,
        message,
        type,
        category,
        action_url,
        metadata,
        is_read: false,
      })
      .select()
      .single();

    if (notificationError) throw notificationError;

    // Check user preferences for email notifications
    const { data: preferences } = await supabaseClient
      .from('user_preferences')
      .select('email_notifications')
      .eq('user_id', user_id)
      .single();

    let emailSent = false;

    // Send email if enabled (would integrate with email service)
    if (preferences?.email_notifications) {
      // TODO: Integrate with email service (SendGrid, Resend, etc.)
      console.log('📧 Email notification would be sent here');
      emailSent = true;
    }

    console.log('✅ Notification created:', {
      notification_id: notification.id,
      email_sent: emailSent,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        notification_id: notification.id,
        email_sent: emailSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Notification error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Notification failed',
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

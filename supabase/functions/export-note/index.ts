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

    const { session_id, format = 'txt', recipient_email } = await req.json();

    if (!session_id) {
      throw new Error('Missing required field: session_id');
    }

    if (!['pdf', 'docx', 'txt'].includes(format)) {
      throw new Error('Invalid format. Must be pdf, docx, or txt');
    }

    // Get session data
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('generated_note, patient_name, patient_id, scheduled_date')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found');
    }

    if (!session.generated_note) {
      throw new Error('No note to export');
    }

    // Create export record
    const { data: exportRecord, error: exportError } = await supabase
      .from('exports')
      .insert({
        user_id: user.id,
        session_id,
        format,
        status: 'pending',
      })
      .select()
      .single();

    if (exportError || !exportRecord) {
      throw new Error('Failed to create export record');
    }

    // Generate export content based on format
    let fileContent: Blob;
    let contentType: string;
    let fileName: string;

    const noteContent = `
Clinical Note Export
===================
Patient: ${session.patient_name}
MRN: ${session.patient_id}
Date: ${new Date(session.scheduled_date).toLocaleDateString()}

${session.generated_note}
    `.trim();

    switch (format) {
      case 'txt':
        fileContent = new Blob([noteContent], { type: 'text/plain' });
        contentType = 'text/plain';
        fileName = `note_${session.patient_id}_${Date.now()}.txt`;
        break;
      
      case 'pdf':
        // For PDF, we'd typically use a library like jsPDF
        // For now, return as text with PDF mime type (placeholder)
        fileContent = new Blob([noteContent], { type: 'application/pdf' });
        contentType = 'application/pdf';
        fileName = `note_${session.patient_id}_${Date.now()}.pdf`;
        break;
      
      case 'docx':
        // For DOCX, we'd typically use a library
        // Placeholder implementation
        fileContent = new Blob([noteContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileName = `note_${session.patient_id}_${Date.now()}.docx`;
        break;
      
      default:
        throw new Error('Unsupported format');
    }

    // Upload to storage
    const filePath = `${user.id}/${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('exported-documents')
      .upload(filePath, fileContent, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error('Failed to upload export file');
    }

    // Update export record with file path
    await supabase
      .from('exports')
      .update({
        file_path: filePath,
        status: 'completed',
      })
      .eq('id', exportRecord.id);

    // Generate signed URL (valid for 1 hour)
    const { data: urlData } = await supabase.storage
      .from('exported-documents')
      .createSignedUrl(filePath, 3600);

    const file_url = urlData?.signedUrl || '';

    // Send email if recipient provided (mock in dev)
    if (recipient_email) {
      console.log(`[DEV MODE] Would send email to: ${recipient_email} with file: ${file_url}`);
      // TODO: Integrate with email service (Resend) in production
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_url,
        format,
        export_id: exportRecord.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in export-note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'EXPORT_ERROR', message: errorMessage },
      }),
      {
        status: errorMessage.includes('Unauthorized') ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

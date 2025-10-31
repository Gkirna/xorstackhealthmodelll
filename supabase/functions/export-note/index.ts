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
    console.log('Fetching session:', session_id);
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('generated_note, patient_name, patient_id, scheduled_at, created_at, template_id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError) {
      console.error('Session fetch error:', sessionError);
      throw new Error('Failed to fetch session');
    }

    if (!session) {
      throw new Error('Session not found or access denied');
    }

    if (!session.generated_note) {
      throw new Error('No note available to export. Please generate a note first.');
    }
    
    console.log('Session retrieved successfully');

    // Skip creating export record if table doesn't exist
    let exportRecordId: string | null = null;
    
    try {
      const { data: exportRecord, error: exportError } = await supabase
        .from('exports')
        .insert({
          user_id: user.id,
          session_id,
          format,
          status: 'pending',
        })
        .select()
        .maybeSingle();

      if (!exportError && exportRecord) {
        exportRecordId = exportRecord.id;
        console.log('Export record created:', exportRecordId);
      }
    } catch (err) {
      console.log('Exports table not available, continuing without tracking');
    }

    // Generate export content based on format
    let fileContent: Blob;
    let contentType: string;
    let fileName: string;

    const sessionDate = session.scheduled_at || session.created_at;
    
    // Parse the generated note if it's JSON
    let noteObject: any = null;
    try {
      noteObject = JSON.parse(session.generated_note);
    } catch {
      // If parsing fails, use as plain text
      noteObject = null;
    }
    
    console.log('Note content prepared, is JSON:', !!noteObject);

    switch (format) {
      case 'txt':
        const txtContent = `
Clinical Note Export
===================
Patient: ${session.patient_name || 'N/A'}
MRN: ${session.patient_id || 'N/A'}
Date: ${new Date(sessionDate).toLocaleDateString()}

${session.generated_note}
        `.trim();
        fileContent = new Blob([txtContent], { type: 'text/plain' });
        contentType = 'text/plain';
        fileName = `clinical-note-${session_id}.txt`;
        break;
      
      case 'pdf':
        // Create HTML for better formatting with SOAP structure
        const formatSectionKey = (key: string): string => {
          return key
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        };

        const renderValue = (value: any, depth: number = 0): string => {
          if (Array.isArray(value)) {
            return '<ul style="margin: 10px 0; padding-left: 30px;">' +
              value.map(item => `<li style="margin: 5px 0; line-height: 1.6;">${typeof item === 'string' ? item : renderValue(item, depth + 1)}</li>`).join('') +
              '</ul>';
          }
          
          if (typeof value === 'object' && value !== null) {
            return '<div style="margin-left: ' + (depth > 0 ? '20px' : '0') + '; margin-top: 10px;">' +
              Object.entries(value).map(([subKey, subValue]) => {
                const label = formatSectionKey(subKey);
                return `<div style="margin: 8px 0;"><strong>${label}:</strong> ${typeof subValue === 'string' ? subValue : '<div>' + renderValue(subValue, depth + 1) + '</div>'}</div>`;
              }).join('') +
              '</div>';
          }
          
          const stringValue = String(value);
          if (stringValue.includes('\n')) {
            return stringValue.split('\n').map(line => `<p style="margin: 5px 0; line-height: 1.6;">${line}</p>`).join('');
          }
          
          return stringValue;
        };

        let contentHtml = '';
        
        if (noteObject && typeof noteObject === 'object') {
          const sections = noteObject.sections || noteObject;
          contentHtml = Object.entries(sections)
            .filter(([key, value]) => value && key !== 'template_id' && key !== 'plaintext')
            .map(([key, value]) => {
              const label = formatSectionKey(key);
              return `
                <div style="margin: 30px 0;">
                  <h2 style="
                    font-size: 18px;
                    font-weight: bold;
                    text-transform: uppercase;
                    border-bottom: 2px solid #2563eb;
                    padding-bottom: 8px;
                    margin-bottom: 15px;
                    color: #1e40af;
                  ">${label}</h2>
                  <div style="padding-left: 0;">
                    ${renderValue(value)}
                  </div>
                </div>
              `;
            }).join('');
        } else {
          contentHtml = `<div style="white-space: pre-wrap; line-height: 1.6;">${session.generated_note}</div>`;
        }

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Clinical Note - ${session.patient_name || 'Patient'}</title>
  <style>
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      line-height: 1.6;
      color: #1f2937;
      background: #ffffff;
    }
    h1 { 
      color: #1e40af; 
      border-bottom: 3px solid #2563eb;
      padding-bottom: 15px;
      margin-bottom: 30px;
      font-size: 28px;
      font-weight: 700;
    }
    .meta {
      background: #f9fafb;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
      border: 1px solid #e5e7eb;
    }
    .meta-row {
      display: flex;
      margin: 8px 0;
    }
    .meta-label {
      font-weight: 700;
      min-width: 120px;
      color: #374151;
    }
    .meta-value {
      color: #1f2937;
    }
    .content { 
      background: #ffffff;
      padding: 20px;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
      text-align: center;
    }
    strong {
      color: #374151;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>Clinical Note</h1>
  <div class="meta">
    <div class="meta-row">
      <span class="meta-label">Patient Name:</span>
      <span class="meta-value">${session.patient_name || 'N/A'}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Medical Record #:</span>
      <span class="meta-value">${session.patient_id || 'N/A'}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Visit Date:</span>
      <span class="meta-value">${new Date(sessionDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</span>
    </div>
    <div class="meta-row">
      <span class="meta-label">Document Type:</span>
      <span class="meta-value">Clinical Documentation</span>
    </div>
  </div>
  <div class="content">
    ${contentHtml}
  </div>
  <div class="footer">
    <strong>Generated by Xorstack Health Model</strong><br>
    AI-assisted clinical documentation - Verify all information for accuracy before clinical use<br>
    This document contains confidential patient information - Handle in accordance with HIPAA regulations
  </div>
</body>
</html>
        `;
        fileContent = new Blob([htmlContent], { type: 'text/html' });
        contentType = 'text/html';
        fileName = `clinical-note-${session.patient_name?.replace(/\s+/g, '-') || session_id}-${new Date().toISOString().split('T')[0]}.html`;
        break;
      
      case 'docx':
        // DOCX - use simple text for now
        const docxContent = `Clinical Note Export\n\nPatient: ${session.patient_name || 'N/A'}\nMRN: ${session.patient_id || 'N/A'}\nDate: ${new Date(sessionDate).toLocaleDateString()}\n\n${session.generated_note}`;
        fileContent = new Blob([docxContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileName = `clinical-note-${session_id}.docx`;
        break;
      
      default:
        throw new Error('Unsupported format');
    }
    
    console.log('File created:', fileName, fileContent.size, 'bytes');

    // Upload to storage
    const filePath = `${user.id}/${fileName}`;
    console.log('Uploading to storage bucket:', filePath);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('exported-documents')
      .upload(filePath, fileContent, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log('File uploaded successfully:', uploadData.path);

    // Update export record if it exists
    if (exportRecordId) {
      await supabase
        .from('exports')
        .update({
          file_path: filePath,
          status: 'completed',
        })
        .eq('id', exportRecordId);
      
      console.log('Export record updated');
    }

    // Generate signed URL (valid for 24 hours)
    const { data: urlData, error: urlError } = await supabase.storage
      .from('exported-documents')
      .createSignedUrl(filePath, 86400);

    if (urlError) {
      console.error('Signed URL error:', urlError);
      throw new Error(`Failed to generate download URL: ${urlError.message}`);
    }

    const file_url = urlData.signedUrl;
    console.log('Signed URL generated successfully');

    // Send email if recipient provided (mock for now)
    if (recipient_email) {
      console.log(`Email would be sent to: ${recipient_email}`);
      console.log('Note: Email service integration required for production');
      // TODO: Integrate with Resend email service
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: file_url,
          export_id: exportRecordId,
          file_path: filePath,
        },
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Export-note function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: { 
          code: 'EXPORT_ERROR', 
          message: errorMessage 
        },
      }),
      {
        status: errorMessage.includes('Unauthorized') ? 401 : 
                errorMessage.includes('not found') ? 404 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

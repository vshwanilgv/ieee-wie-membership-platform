import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string
  subject: string
  html: string
  text?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, text } = await req.json() as EmailRequest

    const emailServiceKey = Deno.env.get('EMAIL_SERVICE_API_KEY')
    const emailFrom = Deno.env.get('EMAIL_FROM') || 'noreply@ieee-wie.example.com'

    if (!emailServiceKey) {
      throw new Error('EMAIL_SERVICE_API_KEY not configured')
    }

    // Using Resend as example (you can swap for SendGrid or Brevo)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${emailServiceKey}`,
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [to],
        subject: subject,
        html: html,
        text: text || '',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Email service error: ${error}`)
    }

    const result = await response.json()

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})

/*
 * To deploy this function:
 * 
 * 1. Install Supabase CLI: npm install -g supabase
 * 2. Link your project: supabase link --project-ref your-project-ref
 * 3. Deploy: supabase functions deploy send-email-notification
 * 4. Set secrets:
 *    supabase secrets set EMAIL_SERVICE_API_KEY=your_key
 *    supabase secrets set EMAIL_FROM=noreply@ieee-wie.example.com
 * 
 * Usage:
 * Call this function from your database triggers or application code
 * to send email notifications.
 * 
 * Example trigger:
 * 
 * CREATE OR REPLACE FUNCTION send_contribution_approved_email()
 * RETURNS TRIGGER AS $$
 * DECLARE
 *   member_email TEXT;
 *   member_name TEXT;
 * BEGIN
 *   IF OLD.status = 'pending' AND NEW.status = 'approved' THEN
 *     SELECT email, full_name INTO member_email, member_name
 *     FROM profiles WHERE id = NEW.member_id;
 *     
 *     PERFORM net.http_post(
 *       url := 'https://your-project.supabase.co/functions/v1/send-email-notification',
 *       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
 *       body := json_build_object(
 *         'to', member_email,
 *         'subject', 'Your Contribution Has Been Approved!',
 *         'html', '<h1>Congratulations!</h1><p>Your contribution "' || NEW.title || '" has been approved with a score of ' || NEW.assigned_score || '.</p>',
 *         'text', 'Congratulations! Your contribution "' || NEW.title || '" has been approved with a score of ' || NEW.assigned_score || '.'
 *       )::jsonb
 *     );
 *   END IF;
 *   
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 * 
 * CREATE TRIGGER send_email_on_contribution_approval
 *   AFTER UPDATE ON contributions
 *   FOR EACH ROW
 *   EXECUTE FUNCTION send_contribution_approved_email();
 */

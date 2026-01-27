import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ServiceLetterRequest {
  memberId: string
  termStartDate: string
  termEndDate: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { memberId, termStartDate, termEndDate } = await req.json() as ServiceLetterRequest

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch member profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single()

    if (!profile) {
      throw new Error('Member not found')
    }

    // Fetch approved roles during the term
    const { data: roles } = await supabase
      .from('member_roles')
      .select(`
        *,
        committees (name),
        projects (name)
      `)
      .eq('member_id', memberId)
      .eq('status', 'approved')
      .gte('start_date', termStartDate)
      .lte('start_date', termEndDate)
      .order('start_date', { ascending: true })

    // Fetch approved contributions during the term
    const { data: contributions } = await supabase
      .from('contributions')
      .select(`
        *,
        contribution_types (name)
      `)
      .eq('member_id', memberId)
      .eq('status', 'approved')
      .gte('activity_date', termStartDate)
      .lte('activity_date', termEndDate)
      .order('activity_date', { ascending: true })

    // Calculate total score
    const totalScore = contributions?.reduce((sum, c) => sum + (c.assigned_score || 0), 0) || 0

    // Generate HTML content for the service letter
    const letterHtml = generateServiceLetterHTML({
      profile,
      roles: roles || [],
      contributions: contributions || [],
      totalScore,
      termStartDate,
      termEndDate,
    })

    // For production, integrate with a PDF generation service like:
    // - PDFShift
    // - API2PDF
    // - Puppeteer (if running in Docker)
    // 
    // For now, return the HTML that can be printed/saved as PDF
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          html: letterHtml,
          member: profile,
          roles: roles || [],
          contributions: contributions || [],
          totalScore,
        },
      }),
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

function generateServiceLetterHTML(data: any): string {
  const {
    profile,
    roles,
    contributions,
    totalScore,
    termStartDate,
    termEndDate,
  } = data

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const termStart = new Date(termStartDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })

  const termEnd = new Date(termEndDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Service Letter - ${profile.full_name}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 40px auto;
      padding: 40px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 24px;
      margin: 10px 0;
      color: #1a1a1a;
    }
    .header p {
      margin: 5px 0;
      font-size: 14px;
    }
    .date {
      text-align: right;
      margin-bottom: 30px;
    }
    .content {
      text-align: justify;
      margin-bottom: 30px;
    }
    .section {
      margin: 20px 0;
    }
    .section-title {
      font-weight: bold;
      text-decoration: underline;
      margin: 15px 0 10px 0;
    }
    .role-item, .contribution-item {
      margin: 8px 0 8px 20px;
    }
    .signature {
      margin-top: 60px;
    }
    .signature-line {
      border-top: 1px solid #333;
      width: 250px;
      margin-top: 40px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
    }
    @media print {
      body {
        margin: 0;
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>IEEE Women in Engineering (WIE)</h1>
    <p>Affinity Group of IEEE Student Branch</p>
    <p>University of Moratuwa, Sri Lanka</p>
    <hr style="width: 50%; margin: 20px auto;">
    <h2>SERVICE LETTER</h2>
  </div>

  <div class="date">
    <p>${currentDate}</p>
  </div>

  <div class="content">
    <p>To Whom It May Concern,</p>

    <p style="margin-top: 20px;">
      This is to certify that <strong>${profile.full_name}</strong> 
      ${profile.ieee_id ? `(IEEE ID: ${profile.ieee_id})` : ''} 
      has been an active member of the IEEE Women in Engineering (WIE) Affinity Group 
      at the University of Moratuwa from <strong>${termStart}</strong> to <strong>${termEnd}</strong>.
    </p>

    <div class="section">
      <p class="section-title">Positions Held:</p>
      ${roles.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Organization</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${roles.map((role: any) => `
              <tr>
                <td>${role.title}</td>
                <td>${role.committees?.name || role.projects?.name || 'IEEE WIE UoM'}</td>
                <td>${new Date(role.start_date).toLocaleDateString()} - ${role.end_date ? new Date(role.end_date).toLocaleDateString() : 'Present'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p style="margin-left: 20px;">No formal positions held during this period.</p>'}
    </div>

    <div class="section">
      <p class="section-title">Notable Contributions:</p>
      <p style="margin-left: 20px;">
        During this tenure, ${profile.full_name} actively participated in and contributed to 
        <strong>${contributions.length}</strong> activities and events, demonstrating exceptional 
        dedication and commitment to the objectives of IEEE WIE.
      </p>
      
      ${contributions.length > 0 ? `
        <p style="margin-left: 20px; margin-top: 15px;">Key contributions include:</p>
        <ul>
          ${contributions.slice(0, 10).map((contrib: any) => `
            <li style="margin-bottom: 5px;">
              ${contrib.title} - ${contrib.contribution_types?.name} 
              (${new Date(contrib.activity_date).toLocaleDateString()})
            </li>
          `).join('')}
          ${contributions.length > 10 ? `<li><em>...and ${contributions.length - 10} more activities</em></li>` : ''}
        </ul>
      ` : ''}
    </div>

    <div class="section">
      <p class="section-title">Performance Summary:</p>
      <p style="margin-left: 20px;">
        ${profile.full_name} achieved a total contribution score of <strong>${totalScore} points</strong>, 
        demonstrating consistent engagement and valuable contributions to the organization's activities 
        and objectives.
      </p>
    </div>

    <p style="margin-top: 30px;">
      ${profile.full_name} has proven to be a dedicated and reliable member, consistently exhibiting 
      professionalism, leadership, and a strong commitment to advancing the goals of IEEE WIE. 
      We highly commend ${profile.full_name.split(' ')[0]}'s contributions and wish them continued 
      success in all future endeavors.
    </p>

    <p style="margin-top: 20px;">
      Should you require any further information, please do not hesitate to contact us.
    </p>
  </div>

  <div class="signature">
    <p>Sincerely,</p>
    <div class="signature-line"></div>
    <p><strong>Chairwoman</strong></p>
    <p>IEEE Women in Engineering</p>
    <p>University of Moratuwa</p>
  </div>

  <div style="margin-top: 60px; text-align: center; font-size: 12px; color: #666;">
    <p>This is an electronically generated document from the IEEE WIE UoM Member Portal.</p>
    <p>For verification, please contact: ieee.wie@uom.lk</p>
  </div>
</body>
</html>
  `
}

/*
 * To deploy this function:
 * 
 * 1. supabase functions deploy generate-service-letter
 * 2. Set secrets:
 *    supabase secrets set SUPABASE_URL=your_url
 *    supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
 * 
 * Usage:
 * POST to https://your-project.supabase.co/functions/v1/generate-service-letter
 * Body: {
 *   "memberId": "uuid",
 *   "termStartDate": "2024-01-01",
 *   "termEndDate": "2024-12-31"
 * }
 * 
 * For PDF generation in production:
 * 1. Integrate with PDFShift, API2PDF, or similar service
 * 2. Or use Puppeteer in a Docker container
 * 3. Store PDFs in Supabase Storage
 * 4. Return download URL
 */

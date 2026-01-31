# Setup Guide - IEEE WIE UoM Membership Portal

## Detailed Setup Instructions

### Step 1: Prerequisites

Ensure you have installed:
- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git** (for version control)

### Step 2: Supabase Project Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose organization and region
   - Set database password (save this securely)
   - Wait for project to be ready (~2 minutes)

2. **Run Database Migrations**
   
   Navigate to **SQL Editor** in your Supabase dashboard and execute these files in order:

   **Migration 1: Initial Schema**
   - Copy content from `supabase/migrations/20260127000001_initial_schema.sql`
   - Paste in SQL Editor
   - Click "Run"
   - Verify: Check Tables section for 9 new tables

   **Migration 2: RLS Policies**
   - Copy content from `supabase/migrations/20260127000002_rls_policies.sql`
   - Paste in SQL Editor
   - Click "Run"
   - Verify: Check Policies section for ~30 policies

   **Migration 3: Storage Setup**
   - Copy content from `supabase/migrations/20260127000003_storage_policies.sql`
   - Paste in SQL Editor
   - Click "Run"
   - Verify: Check Storage section for 2 buckets

3. **Get API Credentials**
   - Go to **Settings** → **API**
   - Copy **Project URL**
   - Copy **anon/public** key
   - Save these for `.env.local`

### Step 3: Email Service Setup

Choose one of these services:

#### Option A: Resend (Recommended)
1. Sign up at [resend.com](https://resend.com)
2. Verify your domain or use their test domain
3. Create API key
4. Copy key for `.env.local`

#### Option B: SendGrid
1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Complete sender verification
3. Create API key
4. Copy key for `.env.local`

#### Option C: Brevo (formerly Sendinblue)
1. Sign up at [brevo.com](https://brevo.com)
2. Verify sender email
3. Generate API key
4. Copy key for `.env.local`

### Step 4: Project Configuration

1. **Clone Repository** (if not already done)
   \`\`\`bash
   cd ieee-wie-membership-platform
   \`\`\`

2. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Create Environment File**
   \`\`\`bash
   cp .env.local.example .env.local
   \`\`\`

4. **Edit `.env.local`** with your credentials:
   \`\`\`env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   EMAIL_SERVICE_API_KEY=re_xxxxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   \`\`\`

### Step 5: Deploy Edge Functions (Optional for Development)

1. **Install Supabase CLI**
   \`\`\`bash
   npm install -g supabase
   \`\`\`

2. **Login to Supabase**
   \`\`\`bash
   supabase login
   \`\`\`

3. **Link Your Project**
   \`\`\`bash
   supabase link --project-ref your-project-ref
   \`\`\`
   
   Find project-ref in: **Settings** → **General** → **Reference ID**

4. **Deploy Functions**
   \`\`\`bash
   supabase functions deploy send-email-notification
   supabase functions deploy generate-service-letter
   \`\`\`

5. **Set Function Secrets**
   \`\`\`bash
   supabase secrets set EMAIL_SERVICE_API_KEY=your_key
   supabase secrets set EMAIL_FROM=noreply@yourdomain.com
   \`\`\`

### Step 6: Initial Data Setup

1. **Add Default Committees** (via SQL Editor):
   \`\`\`sql
   INSERT INTO committees (name, description) VALUES
   ('Technical Committee', 'Handles technical events and workshops'),
   ('Membership Development', 'Manages member recruitment and engagement'),
   ('Events & Programs', 'Organizes events and programs'),
   ('Public Relations', 'Handles communications and social media');
   \`\`\`

2. **Verify Contribution Types** (should already exist from migration):
   \`\`\`sql
   SELECT * FROM contribution_types;
   \`\`\`

### Step 7: Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000)

### Step 8: Create First User

1. Go to [http://localhost:3000/auth/signup](http://localhost:3000/auth/signup)
2. Fill in details and create account
3. You'll be redirected to dashboard

### Step 9: Set Up Chairwoman (via SQL)

After creating your first user, make them Chairwoman:

\`\`\`sql
-- Get user ID from profiles table
SELECT id, full_name FROM profiles;

-- Insert Chairwoman role (replace 'user-id' with actual ID)
INSERT INTO member_roles (
  member_id, 
  role_type, 
  title, 
  committee_id,
  start_date, 
  status,
  approved_by,
  approved_at
) VALUES (
  'user-id-from-above',
  'chairwoman',
  'Chairwoman 2025-2026',
  NULL,
  '2025-01-01',
  'approved',
  'user-id-from-above',
  NOW()
);
\`\`\`

## Production Deployment

### Deploy to Vercel

1. **Push to GitHub**
   \`\`\`bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   \`\`\`

2. **Import in Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your repository
   - Configure environment variables
   - Deploy

3. **Environment Variables in Vercel**
   Add all variables from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `EMAIL_SERVICE_API_KEY`
   - `EMAIL_FROM`
   - `NEXT_PUBLIC_APP_URL` (use your Vercel URL)

### Update Edge Functions for Production

\`\`\`bash
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
\`\`\`

Get service role key from: **Settings** → **API** → **service_role** (secret)

## Testing Checklist

- [ ] User signup works
- [ ] User login works
- [ ] Profile displays correctly
- [ ] Can create contribution
- [ ] File upload works
- [ ] Notifications appear
- [ ] Approver can approve/reject
- [ ] Leaderboard displays
- [ ] Scoring is calculated correctly
- [ ] Email notifications sent (if Edge Functions deployed)

## Troubleshooting

### Database Connection Issues
- Verify Supabase URL and anon key
- Check if migrations ran successfully
- Ensure RLS policies are enabled

### File Upload Fails
- Check storage bucket exists
- Verify storage policies are set
- Confirm file size < 5MB
- Ensure file type is image

### Authentication Issues
- Clear browser cache and cookies
- Check middleware.ts is working
- Verify environment variables

### Email Not Sending
- Confirm Edge Function is deployed
- Check email service API key
- Verify sender email is verified
- Check Edge Function logs in Supabase

## Support

For issues:
1. Check Supabase logs: **Logs** → **Functions** or **Database**
2. Check browser console for errors
3. Review RLS policies if permission errors
4. Verify environment variables

## Next Steps

After setup:
1. Create committee members
2. Assign roles to members
3. Start logging contributions
4. Monitor monthly leaderboards
5. Generate service letters at term end

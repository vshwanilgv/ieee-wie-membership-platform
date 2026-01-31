# IEEE WIE UoM Membership Portal

A comprehensive membership management portal for the IEEE WIE Affinity Group of the University of Moratuwa, built with Next.js 14 and Supabase.

## Features

✨ **Member Management**
- User profiles with roles and hierarchy
- Multi-role support with temporal tracking
- IEEE ID and contact information

🎯 **Contributions & Activities**
- Upload and track activities with evidence (photos)
- Contribution types with score ranges
- Status tracking (pending, approved, rejected)

✅ **Approval Workflow**
- Hierarchical approval system
- Committee members → Director of Membership Development
- Executive/Board → Chairwoman
- Audit trail for all approvals

📊 **Fair Scoring System**
- Predefined score ranges per activity type
- Approvers assign scores within allowed ranges
- Evidence requirements for high-score activities

🔔 **Notifications**
- In-app notification center
- Email notifications via Edge Functions
- Real-time updates on approvals/rejections

🏆 **Monthly Leaderboard**
- Top 3 contributors per month
- Transparent scoring system
- Public visibility for approved data

📄 **Service Letter Generation**
- End-of-term service letters
- PDF/DOCX generation via Edge Functions
- Based on approved roles and contributions

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Security**: Row Level Security (RLS) policies
- **File Storage**: Supabase Storage (images only)
- **Notifications**: React Hot Toast + Email service integration

## Quick Start

### 1. Install Dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migration files in SQL Editor (in order):
   - `supabase/migrations/20260127000001_initial_schema.sql`
   - `supabase/migrations/20260127000002_rls_policies.sql`
   - `supabase/migrations/20260127000003_storage_policies.sql`

### 3. Environment Variables

Create `.env.local`:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EMAIL_SERVICE_API_KEY=your_email_service_api_key
EMAIL_FROM=noreply@ieee-wie.example.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

### 4. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000)

## Database Schema

### Core Tables
- **profiles**: User profiles
- **member_roles**: Roles with approval workflow
- **contributions**: Activities with scoring
- **contribution_types**: Activity types with score ranges
- **contribution_evidence**: Photo evidence
- **notifications**: In-app notifications
- **committees & projects**: Organizational structures

### Views
- **monthly_top_contributors**: Leaderboard rankings
- **member_total_scores**: Aggregate scores
- **pending_approvals_count**: Pending items per approver

## User Roles

1. **Chairwoman** - Auto-approved, approves Exec/Board
2. **Executive Committee** - Approved by Chairwoman
3. **Board of Directors** - Approved by Chairwoman
4. **Committee Leads** - Approved by Director of Membership Development
5. **Committee Members** - Approved by Director of Membership Development

## Contribution Scoring

| Type | Score Range | Evidence Required |
|------|-------------|-------------------|
| Attending Event | 5-10 | No |
| Volunteering | 10-20 | Yes |
| Organizing Event | 20-40 | Yes |
| Leading Project | 30-50 | Yes |
| Workshop Conducting | 25-45 | Yes |
| Content Creation | 10-25 | Yes |
| Sponsorship Acquisition | 20-40 | Yes |

## Project Structure

\`\`\`
├── app/
│   ├── auth/                    # Authentication pages
│   ├── dashboard/               # Main application
│   │   ├── profile/            # User profile
│   │   ├── contributions/      # Contribution management
│   │   ├── approvals/          # Approval dashboard
│   │   ├── leaderboard/        # Monthly rankings
│   │   └── notifications/      # Notification center
│   └── layout.tsx
├── components/                  # Reusable components
├── lib/
│   ├── supabase/               # Supabase clients
│   └── types/                  # TypeScript types
├── supabase/
│   ├── functions/              # Edge Functions
│   └── migrations/             # Database migrations
└── middleware.ts               # Auth middleware
\`\`\`

## Deployment

### Vercel
1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Edge Functions
\`\`\`bash
npm install -g supabase
supabase link --project-ref your-project-ref
supabase functions deploy
\`\`\`

## Security Features

- Row Level Security (RLS) on all tables
- Users edit only their own data
- Hierarchical approval permissions
- Comprehensive audit logging
- File upload restrictions (type & size)
- Public visibility for approved data only

## Free Tier Compatible

Designed for Supabase free tier:
- ✅ 500MB database
- ✅ 1GB file storage  
- ✅ 50K monthly users
- ✅ 2M Edge Function invocations

## License

MIT License

---

Built for IEEE WIE Affinity Group, University of Moratuwa

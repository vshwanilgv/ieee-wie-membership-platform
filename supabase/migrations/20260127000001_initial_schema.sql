-- IEEE WIE Membership Platform Database Schema
-- ===============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================
-- 1. MEMBER PROFILES
-- ===============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  ieee_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 2. ROLE TYPES AND HIERARCHY
-- ===============================================

CREATE TYPE role_type AS ENUM (
  'chairwoman',
  'executive_committee',
  'board_of_directors',
  'committee_lead',
  'committee_member'
);

CREATE TABLE committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 3. MEMBER ROLES & POSITIONS
-- ===============================================

CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE member_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_type role_type NOT NULL,
  title TEXT NOT NULL,
  committee_id UUID REFERENCES committees(id),
  project_id UUID REFERENCES projects(id),
  start_date DATE NOT NULL,
  end_date DATE,
  reporting_to UUID REFERENCES profiles(id),
  status approval_status DEFAULT 'pending',
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT has_committee_or_project CHECK (committee_id IS NOT NULL OR project_id IS NOT NULL)
);

-- ===============================================
-- 4. CONTRIBUTION TYPES & SCORING
-- ===============================================

CREATE TABLE contribution_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  min_score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  requires_evidence BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_score_range CHECK (min_score >= 0 AND max_score > min_score)
);

-- Insert default contribution types
INSERT INTO contribution_types (name, description, min_score, max_score, requires_evidence) VALUES
  ('Attending Event', 'Participation in IEEE WIE events', 5, 10, false),
  ('Volunteering', 'Volunteering at events or activities', 10, 20, true),
  ('Organizing Event', 'Organizing or coordinating an event', 20, 40, true),
  ('Leading Project', 'Leading a project or initiative', 30, 50, true),
  ('Workshop Conducting', 'Conducting workshops or training sessions', 25, 45, true),
  ('Content Creation', 'Creating content for social media or website', 10, 25, true),
  ('Sponsorship Acquisition', 'Securing sponsorships for events', 20, 40, true);

-- ===============================================
-- 5. CONTRIBUTIONS / ACTIVITIES
-- ===============================================

CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  contribution_type_id UUID NOT NULL REFERENCES contribution_types(id),
  activity_date DATE NOT NULL,
  role_id UUID REFERENCES member_roles(id),
  project_id UUID REFERENCES projects(id),
  status approval_status DEFAULT 'pending',
  assigned_score INTEGER,
  approver_id UUID REFERENCES profiles(id),
  approval_comment TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add score validation constraint (will be checked via trigger)
CREATE OR REPLACE FUNCTION validate_contribution_score()
RETURNS TRIGGER AS $$
DECLARE
  min_score INTEGER;
  max_score INTEGER;
BEGIN
  IF NEW.assigned_score IS NOT NULL THEN
    SELECT ct.min_score, ct.max_score 
    INTO min_score, max_score
    FROM contribution_types ct
    WHERE ct.id = NEW.contribution_type_id;
    
    IF NEW.assigned_score < min_score OR NEW.assigned_score > max_score THEN
      RAISE EXCEPTION 'Score % is outside allowed range [%, %]', 
        NEW.assigned_score, min_score, max_score;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_contribution_score
  BEFORE INSERT OR UPDATE ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION validate_contribution_score();

-- ===============================================
-- 6. CONTRIBUTION EVIDENCE (Photos)
-- ===============================================

CREATE TABLE contribution_evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_image CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/jpg', 'image/webp'))
);

-- ===============================================
-- 7. NOTIFICATIONS
-- ===============================================

CREATE TYPE notification_type AS ENUM (
  'contribution_submitted',
  'contribution_approved',
  'contribution_rejected',
  'role_approved',
  'role_rejected'
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- ===============================================
-- 8. AUDIT LOG
-- ===============================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  performed_by UUID REFERENCES profiles(id),
  performed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===============================================
-- 9. VIEWS FOR RANKINGS AND STATS
-- ===============================================

-- Monthly top contributors
CREATE OR REPLACE VIEW monthly_top_contributors AS
SELECT 
  date_trunc('month', c.activity_date) as month,
  p.id as member_id,
  p.full_name,
  p.photo_url,
  SUM(c.assigned_score) as total_score,
  COUNT(c.id) as contribution_count,
  RANK() OVER (
    PARTITION BY date_trunc('month', c.activity_date) 
    ORDER BY SUM(c.assigned_score) DESC
  ) as rank
FROM contributions c
JOIN profiles p ON c.member_id = p.id
WHERE c.status = 'approved' AND c.assigned_score IS NOT NULL
GROUP BY date_trunc('month', c.activity_date), p.id, p.full_name, p.photo_url
ORDER BY month DESC, rank ASC;

-- Member total scores
CREATE OR REPLACE VIEW member_total_scores AS
SELECT 
  p.id as member_id,
  p.full_name,
  p.photo_url,
  COALESCE(SUM(c.assigned_score), 0) as total_score,
  COUNT(c.id) as total_contributions
FROM profiles p
LEFT JOIN contributions c ON c.member_id = p.id AND c.status = 'approved'
GROUP BY p.id, p.full_name, p.photo_url;

-- Pending approvals count per approver
CREATE OR REPLACE VIEW pending_approvals_count AS
SELECT 
  approver_id,
  COUNT(*) as pending_count
FROM (
  -- Contributions
  SELECT DISTINCT
    CASE 
      WHEN mr.role_type IN ('committee_member', 'committee_lead') THEN 
        (SELECT id FROM profiles WHERE id IN (
          SELECT member_id FROM member_roles 
          WHERE role_type = 'board_of_directors' 
          AND title LIKE '%Membership Development%'
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          LIMIT 1
        ))
      ELSE 
        (SELECT id FROM profiles WHERE id IN (
          SELECT member_id FROM member_roles 
          WHERE role_type = 'chairwoman'
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          LIMIT 1
        ))
    END as approver_id
  FROM contributions c
  JOIN member_roles mr ON c.member_id = mr.member_id
  WHERE c.status = 'pending'
  
  UNION ALL
  
  -- Roles
  SELECT DISTINCT
    CASE 
      WHEN mr.role_type IN ('committee_member', 'committee_lead') THEN 
        (SELECT id FROM profiles WHERE id IN (
          SELECT member_id FROM member_roles 
          WHERE role_type = 'board_of_directors' 
          AND title LIKE '%Membership Development%'
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          LIMIT 1
        ))
      ELSE 
        (SELECT id FROM profiles WHERE id IN (
          SELECT member_id FROM member_roles 
          WHERE role_type = 'chairwoman'
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          LIMIT 1
        ))
    END as approver_id
  FROM member_roles mr
  WHERE mr.status = 'pending'
) pending
WHERE approver_id IS NOT NULL
GROUP BY approver_id;

-- ===============================================
-- 10. FUNCTIONS
-- ===============================================

-- Get approver for a member based on their role
CREATE OR REPLACE FUNCTION get_member_approver(member_uuid UUID)
RETURNS UUID AS $$
DECLARE
  member_role role_type;
  approver_uuid UUID;
BEGIN
  -- Get the highest role of the member
  SELECT role_type INTO member_role
  FROM member_roles
  WHERE member_id = member_uuid
    AND status = 'approved'
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  ORDER BY 
    CASE role_type
      WHEN 'chairwoman' THEN 1
      WHEN 'executive_committee' THEN 2
      WHEN 'board_of_directors' THEN 3
      WHEN 'committee_lead' THEN 4
      WHEN 'committee_member' THEN 5
    END
  LIMIT 1;
  
  -- Determine approver based on role
  IF member_role = 'chairwoman' THEN
    -- Chairwoman is auto-approved
    RETURN member_uuid;
  ELSIF member_role IN ('executive_committee', 'board_of_directors') THEN
    -- Approved by Chairwoman
    SELECT member_id INTO approver_uuid
    FROM member_roles
    WHERE role_type = 'chairwoman'
      AND status = 'approved'
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    LIMIT 1;
  ELSE
    -- Committee leads and members approved by Director of Membership Development
    SELECT member_id INTO approver_uuid
    FROM member_roles
    WHERE role_type = 'board_of_directors'
      AND title ILIKE '%membership%development%'
      AND status = 'approved'
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    LIMIT 1;
  END IF;
  
  RETURN approver_uuid;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- 11. TRIGGERS FOR NOTIFICATIONS
-- ===============================================

-- Trigger for contribution submission
CREATE OR REPLACE FUNCTION notify_contribution_submitted()
RETURNS TRIGGER AS $$
DECLARE
  approver_uuid UUID;
  member_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    approver_uuid := get_member_approver(NEW.member_id);
    
    SELECT full_name INTO member_name FROM profiles WHERE id = NEW.member_id;
    
    IF approver_uuid IS NOT NULL AND approver_uuid != NEW.member_id THEN
      INSERT INTO notifications (user_id, type, title, message, related_entity_id)
      VALUES (
        approver_uuid,
        'contribution_submitted',
        'New Contribution Pending Review',
        member_name || ' has submitted a new contribution: ' || NEW.title,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contribution_submitted_notification
  AFTER INSERT ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION notify_contribution_submitted();

-- Trigger for contribution approval/rejection
CREATE OR REPLACE FUNCTION notify_contribution_status_change()
RETURNS TRIGGER AS $$
DECLARE
  status_text TEXT;
  notif_type notification_type;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    IF NEW.status = 'approved' THEN
      status_text := 'approved';
      notif_type := 'contribution_approved';
    ELSE
      status_text := 'rejected';
      notif_type := 'contribution_rejected';
    END IF;
    
    INSERT INTO notifications (user_id, type, title, message, related_entity_id)
    VALUES (
      NEW.member_id,
      notif_type,
      'Contribution ' || status_text,
      'Your contribution "' || NEW.title || '" has been ' || status_text || 
      CASE WHEN NEW.status = 'approved' 
        THEN ' with a score of ' || NEW.assigned_score 
        ELSE '. Reason: ' || COALESCE(NEW.rejection_reason, 'Not specified')
      END,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contribution_status_notification
  AFTER UPDATE ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION notify_contribution_status_change();

-- ===============================================
-- 12. INDEXES FOR PERFORMANCE
-- ===============================================

CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_ieee_id ON profiles(ieee_id);

CREATE INDEX idx_member_roles_member ON member_roles(member_id, status);
CREATE INDEX idx_member_roles_status ON member_roles(status);
CREATE INDEX idx_member_roles_dates ON member_roles(start_date, end_date);

CREATE INDEX idx_contributions_member ON contributions(member_id, status);
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_contributions_date ON contributions(activity_date);
CREATE INDEX idx_contributions_approver ON contributions(approver_id, status);

CREATE INDEX idx_evidence_contribution ON contribution_evidence(contribution_id);

CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(performed_by, performed_at);

-- ===============================================
-- 13. UPDATED_AT TRIGGERS
-- ===============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_roles_updated_at
  BEFORE UPDATE ON member_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contributions_updated_at
  BEFORE UPDATE ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- COMMENTS FOR DOCUMENTATION
-- ===============================================

COMMENT ON TABLE profiles IS 'User profiles linked to Supabase Auth';
COMMENT ON TABLE member_roles IS 'Member roles and positions over time with approval workflow';
COMMENT ON TABLE contributions IS 'Member contributions/activities with scoring and approval';
COMMENT ON TABLE contribution_types IS 'Types of contributions with score ranges';
COMMENT ON TABLE contribution_evidence IS 'Photo evidence for contributions';
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON TABLE audit_log IS 'Audit trail for all important actions';

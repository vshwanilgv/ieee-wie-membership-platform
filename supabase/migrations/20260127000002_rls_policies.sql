-- IEEE WIE Membership Platform - Row Level Security Policies
-- ===========================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- PROFILES POLICIES
-- ===============================================

-- Anyone authenticated can view all approved profiles
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ===============================================
-- COMMITTEES POLICIES
-- ===============================================

-- Everyone can view committees
CREATE POLICY "Anyone can view committees"
  ON committees FOR SELECT
  TO authenticated
  USING (true);

-- Only exec committee can manage committees
CREATE POLICY "Exec committee can manage committees"
  ON committees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_roles
      WHERE member_id = auth.uid()
        AND role_type IN ('chairwoman', 'executive_committee', 'board_of_directors')
        AND status = 'approved'
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    )
  );

-- ===============================================
-- PROJECTS POLICIES
-- ===============================================

-- Everyone can view projects
CREATE POLICY "Anyone can view projects"
  ON projects FOR SELECT
  TO authenticated
  USING (true);

-- Anyone can create projects
CREATE POLICY "Anyone can create projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Creator and exec committee can update projects
CREATE POLICY "Creator and exec can update projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM member_roles
      WHERE member_id = auth.uid()
        AND role_type IN ('chairwoman', 'executive_committee', 'board_of_directors')
        AND status = 'approved'
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    )
  );

-- ===============================================
-- MEMBER ROLES POLICIES
-- ===============================================

-- All authenticated users can view APPROVED roles
CREATE POLICY "Anyone can view approved roles"
  ON member_roles FOR SELECT
  TO authenticated
  USING (
    status = 'approved' OR
    member_id = auth.uid() OR
    -- Approvers can see pending items assigned to them
    auth.uid() IN (
      SELECT DISTINCT
        CASE 
          WHEN role_type IN ('committee_member', 'committee_lead') THEN 
            (SELECT member_id FROM member_roles 
             WHERE role_type = 'board_of_directors' 
             AND title ILIKE '%membership%development%'
             AND status = 'approved'
             AND (end_date IS NULL OR end_date >= CURRENT_DATE)
             LIMIT 1)
          ELSE 
            (SELECT member_id FROM member_roles 
             WHERE role_type = 'chairwoman'
             AND status = 'approved'
             AND (end_date IS NULL OR end_date >= CURRENT_DATE)
             LIMIT 1)
        END
      FROM member_roles mr2
      WHERE mr2.id = member_roles.id
    )
  );

-- Users can insert their own roles (requires approval)
CREATE POLICY "Users can insert own roles"
  ON member_roles FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Users can update their own PENDING roles
CREATE POLICY "Users can update own pending roles"
  ON member_roles FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid() AND status = 'pending')
  WITH CHECK (member_id = auth.uid() AND status = 'pending');

-- Approvers can approve/reject roles
CREATE POLICY "Approvers can update role status"
  ON member_roles FOR UPDATE
  TO authenticated
  USING (
    -- Director of Membership Development can approve committee members/leads
    (
      role_type IN ('committee_member', 'committee_lead') AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'board_of_directors'
          AND mr.title ILIKE '%membership%development%'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      )
    ) OR
    -- Chairwoman can approve exec and board members
    (
      role_type IN ('executive_committee', 'board_of_directors') AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'chairwoman'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      )
    )
  );

-- ===============================================
-- CONTRIBUTION TYPES POLICIES
-- ===============================================

-- Everyone can view contribution types
CREATE POLICY "Anyone can view contribution types"
  ON contribution_types FOR SELECT
  TO authenticated
  USING (true);

-- Only exec committee can manage contribution types
CREATE POLICY "Exec can manage contribution types"
  ON contribution_types FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_roles
      WHERE member_id = auth.uid()
        AND role_type IN ('chairwoman', 'executive_committee', 'board_of_directors')
        AND status = 'approved'
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    )
  );

-- ===============================================
-- CONTRIBUTIONS POLICIES
-- ===============================================

-- Users can view:
-- - All APPROVED contributions
-- - Their own contributions (any status)
-- - Contributions pending their approval
CREATE POLICY "View contributions policy"
  ON contributions FOR SELECT
  TO authenticated
  USING (
    status = 'approved' OR
    member_id = auth.uid() OR
    -- Check if user is the approver
    auth.uid() = (
      SELECT DISTINCT
        CASE 
          WHEN mr.role_type IN ('committee_member', 'committee_lead') THEN 
            (SELECT member_id FROM member_roles 
             WHERE role_type = 'board_of_directors' 
             AND title ILIKE '%membership%development%'
             AND status = 'approved'
             AND (end_date IS NULL OR end_date >= CURRENT_DATE)
             LIMIT 1)
          ELSE 
            (SELECT member_id FROM member_roles 
             WHERE role_type = 'chairwoman'
             AND status = 'approved'
             AND (end_date IS NULL OR end_date >= CURRENT_DATE)
             LIMIT 1)
        END
      FROM member_roles mr
      WHERE mr.member_id = contributions.member_id
        AND mr.status = 'approved'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      LIMIT 1
    )
  );

-- Users can insert their own contributions
CREATE POLICY "Users can insert own contributions"
  ON contributions FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

-- Users can update their own PENDING contributions
CREATE POLICY "Users can update own pending contributions"
  ON contributions FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid() AND status = 'pending')
  WITH CHECK (member_id = auth.uid() AND status = 'pending');

-- Approvers can approve/reject contributions
CREATE POLICY "Approvers can update contribution status"
  ON contributions FOR UPDATE
  TO authenticated
  USING (
    -- Director of Membership Development can approve committee members/leads
    EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = contributions.member_id
        AND mr.role_type IN ('committee_member', 'committee_lead')
        AND mr.status = 'approved'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
        AND EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'board_of_directors'
            AND approver.title ILIKE '%membership%development%'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        )
    ) OR
    -- Chairwoman can approve exec and board members
    EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = contributions.member_id
        AND mr.role_type IN ('executive_committee', 'board_of_directors', 'chairwoman')
        AND mr.status = 'approved'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
        AND EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'chairwoman'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        )
    )
  );

-- Chairwoman's contributions are auto-approved (handled in application logic)

-- ===============================================
-- CONTRIBUTION EVIDENCE POLICIES
-- ===============================================

-- Evidence visible with same rules as contributions
CREATE POLICY "View evidence with contribution"
  ON contribution_evidence FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contributions c
      WHERE c.id = contribution_evidence.contribution_id
        AND (
          c.status = 'approved' OR
          c.member_id = auth.uid() OR
          auth.uid() = (
            SELECT DISTINCT
              CASE 
                WHEN mr.role_type IN ('committee_member', 'committee_lead') THEN 
                  (SELECT member_id FROM member_roles 
                   WHERE role_type = 'board_of_directors' 
                   AND title ILIKE '%membership%development%'
                   AND status = 'approved'
                   AND (end_date IS NULL OR end_date >= CURRENT_DATE)
                   LIMIT 1)
                ELSE 
                  (SELECT member_id FROM member_roles 
                   WHERE role_type = 'chairwoman'
                   AND status = 'approved'
                   AND (end_date IS NULL OR end_date >= CURRENT_DATE)
                   LIMIT 1)
              END
            FROM member_roles mr
            WHERE mr.member_id = c.member_id
              AND mr.status = 'approved'
              AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
            LIMIT 1
          )
        )
    )
  );

-- Users can insert evidence for their own contributions
CREATE POLICY "Users can insert own evidence"
  ON contribution_evidence FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contributions
      WHERE contributions.id = contribution_evidence.contribution_id
        AND contributions.member_id = auth.uid()
    )
  );

-- Users can delete evidence from their pending contributions
CREATE POLICY "Users can delete own evidence"
  ON contribution_evidence FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contributions
      WHERE contributions.id = contribution_evidence.contribution_id
        AND contributions.member_id = auth.uid()
        AND contributions.status = 'pending'
    )
  );

-- ===============================================
-- NOTIFICATIONS POLICIES
-- ===============================================

-- Users can only view their own notifications
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- System can insert notifications (handled via triggers)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===============================================
-- AUDIT LOG POLICIES
-- ===============================================

-- Only exec committee can view audit logs
CREATE POLICY "Exec can view audit logs"
  ON audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_roles
      WHERE member_id = auth.uid()
        AND role_type IN ('chairwoman', 'executive_committee', 'board_of_directors')
        AND status = 'approved'
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ===============================================
-- HELPER FUNCTIONS FOR RLS
-- ===============================================

-- Function to check if user is approver
CREATE OR REPLACE FUNCTION is_user_approver(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM member_roles
    WHERE member_id = user_uuid
      AND role_type IN ('chairwoman', 'board_of_directors')
      AND status = 'approved'
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is chairwoman
CREATE OR REPLACE FUNCTION is_user_chairwoman(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM member_roles
    WHERE member_id = user_uuid
      AND role_type = 'chairwoman'
      AND status = 'approved'
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add approval tracking columns to contributions table (if not exist)
-- Note: approver_id already exists in schema, just ensuring approved_at is there
ALTER TABLE contributions 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add rejection_reason if it doesn't exist (it should already be there)
-- ALTER TABLE contributions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add RLS policy for approvers to update contributions
CREATE POLICY "Approvers can update contributions based on hierarchy"
  ON contributions FOR UPDATE
  TO authenticated
  USING (
    -- Chairwoman can approve executive committee contributions
    (
      status = 'pending' AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'chairwoman'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      ) AND
      EXISTS (
        SELECT 1 FROM member_roles mr2
        WHERE mr2.member_id = contributions.contributor_id
          AND mr2.role_type = 'executive_committee'
          AND mr2.status = 'approved'
          AND (mr2.end_date IS NULL OR mr2.end_date >= CURRENT_DATE)
      )
    ) OR
    -- Executive committee can approve board of directors contributions
    (
      status = 'pending' AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'executive_committee'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      ) AND
      EXISTS (
        SELECT 1 FROM member_roles mr2
        WHERE mr2.member_id = contributions.contributor_id
          AND mr2.role_type = 'board_of_directors'
          AND mr2.status = 'approved'
          AND (mr2.end_date IS NULL OR mr2.end_date >= CURRENT_DATE)
      )
    ) OR
    -- Board of directors can approve committee_lead and committee_member contributions
    (
      status = 'pending' AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'board_of_directors'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      ) AND
      EXISTS (
        SELECT 1 FROM member_roles mr2
        WHERE mr2.member_id = contributions.contributor_id
          AND mr2.role_type IN ('committee_lead', 'committee_member')
          AND mr2.status = 'approved'
          AND (mr2.end_date IS NULL OR mr2.end_date >= CURRENT_DATE)
      )
    )
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    (
      status IN ('approved', 'rejected') AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'chairwoman'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      ) AND
      EXISTS (
        SELECT 1 FROM member_roles mr2
        WHERE mr2.member_id = contributions.contributor_id
          AND mr2.role_type = 'executive_committee'
          AND mr2.status = 'approved'
          AND (mr2.end_date IS NULL OR mr2.end_date >= CURRENT_DATE)
      )
    ) OR
    (
      status IN ('approved', 'rejected') AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'executive_committee'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      ) AND
      EXISTS (
        SELECT 1 FROM member_roles mr2
        WHERE mr2.member_id = contributions.contributor_id
          AND mr2.role_type = 'board_of_directors'
          AND mr2.status = 'approved'
          AND (mr2.end_date IS NULL OR mr2.end_date >= CURRENT_DATE)
      )
    ) OR
    (
      status IN ('approved', 'rejected') AND
      EXISTS (
        SELECT 1 FROM member_roles mr
        WHERE mr.member_id = auth.uid()
          AND mr.role_type = 'board_of_directors'
          AND mr.status = 'approved'
          AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
      ) AND
      EXISTS (
        SELECT 1 FROM member_roles mr2
        WHERE mr2.member_id = contributions.contributor_id
          AND mr2.role_type IN ('committee_lead', 'committee_member')
          AND mr2.status = 'approved'
          AND (mr2.end_date IS NULL OR mr2.end_date >= CURRENT_DATE)
      )
    )
  );

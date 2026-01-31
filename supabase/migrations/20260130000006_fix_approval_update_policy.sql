-- Fix RLS policy to allow approvers to update contributions and remove notification triggers

-- Drop old approver update policy
DROP POLICY IF EXISTS "Approvers can update contribution status" ON contributions;

-- Create comprehensive approver update policy
CREATE POLICY "Approvers can approve or reject contributions"
  ON contributions FOR UPDATE
  TO authenticated
  USING (
    status = 'pending' AND (
      -- Chairwoman can approve executive committee contributions
      (
        EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'chairwoman'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        ) AND
        EXISTS (
          SELECT 1 FROM member_roles contributor
          WHERE contributor.member_id = contributions.member_id
            AND contributor.role_type = 'executive_committee'
            AND contributor.status = 'approved'
            AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
        )
      ) OR
      -- Executive committee can approve board of directors contributions
      (
        EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'executive_committee'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        ) AND
        EXISTS (
          SELECT 1 FROM member_roles contributor
          WHERE contributor.member_id = contributions.member_id
            AND contributor.role_type = 'board_of_directors'
            AND contributor.status = 'approved'
            AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
        )
      ) OR
      -- Board of directors can approve committee contributions
      (
        EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'board_of_directors'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        ) AND
        EXISTS (
          SELECT 1 FROM member_roles contributor
          WHERE contributor.member_id = contributions.member_id
            AND contributor.role_type IN ('committee_lead', 'committee_member')
            AND contributor.status = 'approved'
            AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
        )
      )
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected') AND (
      -- Same conditions as USING clause
      (
        EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'chairwoman'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        ) AND
        EXISTS (
          SELECT 1 FROM member_roles contributor
          WHERE contributor.member_id = contributions.member_id
            AND contributor.role_type = 'executive_committee'
            AND contributor.status = 'approved'
            AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
        )
      ) OR
      (
        EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'executive_committee'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        ) AND
        EXISTS (
          SELECT 1 FROM member_roles contributor
          WHERE contributor.member_id = contributions.member_id
            AND contributor.role_type = 'board_of_directors'
            AND contributor.status = 'approved'
            AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
        )
      ) OR
      (
        EXISTS (
          SELECT 1 FROM member_roles approver
          WHERE approver.member_id = auth.uid()
            AND approver.role_type = 'board_of_directors'
            AND approver.status = 'approved'
            AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
        ) AND
        EXISTS (
          SELECT 1 FROM member_roles contributor
          WHERE contributor.member_id = contributions.member_id
            AND contributor.role_type IN ('committee_lead', 'committee_member')
            AND contributor.status = 'approved'
            AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
        )
      )
    )
  );

-- Drop notification triggers if they exist (causing constraint violations)
DROP TRIGGER IF EXISTS notify_contribution_approved ON contributions;
DROP TRIGGER IF EXISTS notify_contribution_rejected ON contributions;
DROP FUNCTION IF EXISTS notify_contribution_status_change();

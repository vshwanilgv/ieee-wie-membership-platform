-- Simplify the WITH CHECK clause for approvals/rejections

DROP POLICY IF EXISTS "Approvers can approve or reject contributions" ON contributions;

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
    -- Just verify the status is being changed to approved or rejected
    -- The USING clause already verified permissions
    status IN ('approved', 'rejected')
  );

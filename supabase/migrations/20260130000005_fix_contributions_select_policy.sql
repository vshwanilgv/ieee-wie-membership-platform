-- Fix contributions SELECT policy to allow approvers to see pending contributions

DROP POLICY IF EXISTS "View contributions policy" ON contributions;

CREATE POLICY "View contributions policy"
  ON contributions FOR SELECT
  TO authenticated
  USING (
    -- Everyone can see approved contributions
    status = 'approved' OR
    -- Users can see their own contributions
    member_id = auth.uid() OR
    -- Chairwoman can see executive committee pending contributions
    (
      status = 'pending' AND
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
    -- Executive committee can see board of directors pending contributions
    (
      status = 'pending' AND
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
    -- Board of directors can see committee_lead and committee_member pending contributions
    (
      status = 'pending' AND
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
  );

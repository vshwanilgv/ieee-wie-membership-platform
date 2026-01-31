-- Drop the existing policy
DROP POLICY IF EXISTS "Comprehensive contribution update policy" ON contributions;
DROP POLICY IF EXISTS "Allow contribution updates" ON contributions;

-- Create new policy with explicit WITH CHECK
CREATE POLICY "Allow contribution updates"
ON contributions
FOR UPDATE
TO authenticated
USING (
  -- Users can update their own pending contributions
  (member_id = auth.uid() AND status = 'pending')
  OR
  -- Chairwoman can approve/reject executive committee contributions (no status check in USING)
  (EXISTS (
    SELECT 1 FROM member_roles approver
    WHERE approver.member_id = auth.uid()
      AND approver.role_type = 'chairwoman'
      AND approver.status = 'approved'
      AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
  ) AND EXISTS (
    SELECT 1 FROM member_roles contributor
    WHERE contributor.member_id = contributions.member_id
      AND contributor.role_type = 'executive_committee'
      AND contributor.status = 'approved'
      AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
  ))
  OR
  -- Executive committee can approve/reject board of directors contributions
  (EXISTS (
    SELECT 1 FROM member_roles approver
    WHERE approver.member_id = auth.uid()
      AND approver.role_type = 'executive_committee'
      AND approver.status = 'approved'
      AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
  ) AND EXISTS (
    SELECT 1 FROM member_roles contributor
    WHERE contributor.member_id = contributions.member_id
      AND contributor.role_type = 'board_of_directors'
      AND contributor.status = 'approved'
      AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
  ))
  OR
  -- Board of directors can approve/reject committee contributions
  (EXISTS (
    SELECT 1 FROM member_roles approver
    WHERE approver.member_id = auth.uid()
      AND approver.role_type = 'board_of_directors'
      AND approver.status = 'approved'
      AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
  ) AND EXISTS (
    SELECT 1 FROM member_roles contributor
    WHERE contributor.member_id = contributions.member_id
      AND contributor.role_type IN ('committee_lead', 'committee_member')
      AND contributor.status = 'approved'
      AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
  ))
)
WITH CHECK (
  -- For users: must still own the contribution
  -- For approvers: must still have authority over the contributor (no status check!)
  (member_id = auth.uid())
  OR
  (EXISTS (
    SELECT 1 FROM member_roles approver
    WHERE approver.member_id = auth.uid()
      AND approver.role_type = 'chairwoman'
      AND approver.status = 'approved'
      AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
  ) AND EXISTS (
    SELECT 1 FROM member_roles contributor
    WHERE contributor.member_id = contributions.member_id
      AND contributor.role_type = 'executive_committee'
      AND contributor.status = 'approved'
      AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
  ))
  OR
  (EXISTS (
    SELECT 1 FROM member_roles approver
    WHERE approver.member_id = auth.uid()
      AND approver.role_type = 'executive_committee'
      AND approver.status = 'approved'
      AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
  ) AND EXISTS (
    SELECT 1 FROM member_roles contributor
    WHERE contributor.member_id = contributions.member_id
      AND contributor.role_type = 'board_of_directors'
      AND contributor.status = 'approved'
      AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
  ))
  OR
  (EXISTS (
    SELECT 1 FROM member_roles approver
    WHERE approver.member_id = auth.uid()
      AND approver.role_type = 'board_of_directors'
      AND approver.status = 'approved'
      AND (approver.end_date IS NULL OR approver.end_date >= CURRENT_DATE)
  ) AND EXISTS (
    SELECT 1 FROM member_roles contributor
    WHERE contributor.member_id = contributions.member_id
      AND contributor.role_type IN ('committee_lead', 'committee_member')
      AND contributor.status = 'approved'
      AND (contributor.end_date IS NULL OR contributor.end_date >= CURRENT_DATE)
  ))
);

-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Approvers can update role status" ON member_roles;
DROP POLICY IF EXISTS "Users can update own pending roles" ON member_roles;

-- Add comprehensive update policy for chairwoman and exec committee
CREATE POLICY "Chairwoman and exec can update all roles"
  ON member_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = auth.uid()
        AND mr.role_type IN ('chairwoman', 'executive_committee')
        AND mr.status = 'approved'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = auth.uid()
        AND mr.role_type IN ('chairwoman', 'executive_committee')
        AND mr.status = 'approved'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
    )
  );

-- Allow users to update their own pending roles
CREATE POLICY "Users can update own pending roles"
  ON member_roles FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid() AND status = 'pending')
  WITH CHECK (member_id = auth.uid() AND status = 'pending');

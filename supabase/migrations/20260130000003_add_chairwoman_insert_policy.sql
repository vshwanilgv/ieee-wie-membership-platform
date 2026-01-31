-- Add INSERT policy for chairwoman and exec committee to assign roles to anyone
CREATE POLICY "Chairwoman and exec can assign roles to anyone"
  ON member_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = auth.uid()
        AND mr.role_type IN ('chairwoman', 'executive_committee')
        AND mr.status = 'approved'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
    )
  );

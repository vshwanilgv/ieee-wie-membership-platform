-- Add DELETE policy for member_roles table
-- Allow chairwoman and executive committee to delete roles

CREATE POLICY "Exec committee can delete roles"
  ON member_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_roles mr
      WHERE mr.member_id = auth.uid()
        AND mr.role_type IN ('chairwoman', 'executive_committee')
        AND mr.status = 'approved'
        AND (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE)
    )
  );

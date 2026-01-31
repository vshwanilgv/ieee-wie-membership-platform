-- Create functions to handle approval/rejection with proper permissions
CREATE OR REPLACE FUNCTION approve_contribution(
  contribution_id UUID,
  approver_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE contributions
  SET 
    status = 'approved',
    approver_id = approver_user_id,
    approved_at = NOW()
  WHERE id = contribution_id;
  
  SELECT jsonb_build_object('success', true, 'message', 'Contribution approved')
  INTO result;
  
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION reject_contribution(
  contribution_id UUID,
  approver_user_id UUID,
  reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE contributions
  SET 
    status = 'rejected',
    approver_id = approver_user_id,
    approved_at = NOW(),
    rejection_reason = reason
  WHERE id = contribution_id;
  
  SELECT jsonb_build_object('success', true, 'message', 'Contribution rejected')
  INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION approve_contribution(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_contribution(UUID, UUID, TEXT) TO authenticated;

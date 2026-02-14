-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS contribution_status_notification ON contributions;
DROP FUNCTION IF EXISTS create_contribution_notification();

-- Drop table if exists to start fresh
DROP TABLE IF EXISTS notifications CASCADE;

-- Create notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  related_contribution_id UUID REFERENCES contributions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Function to create notification for contribution status change
CREATE FUNCTION create_contribution_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create notification if status changed to approved or rejected
  IF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected')) THEN
    INSERT INTO notifications (user_id, title, message, type, related_contribution_id)
    VALUES (
      NEW.member_id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Contribution Approved'
        WHEN NEW.status = 'rejected' THEN 'Contribution Rejected'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 
          'Your contribution has been approved and ' || COALESCE(NEW.assigned_score::TEXT, '0') || ' points have been awarded.'
        WHEN NEW.status = 'rejected' THEN 
          'Your contribution has been rejected. ' || COALESCE('Reason: ' || NEW.rejection_reason, 'No reason provided.')
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'success'
        WHEN NEW.status = 'rejected' THEN 'error'
      END,
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for contribution notifications
CREATE TRIGGER contribution_status_notification
AFTER UPDATE ON contributions
FOR EACH ROW
EXECUTE FUNCTION create_contribution_notification();

-- Grant permissions
GRANT SELECT, UPDATE, DELETE ON notifications TO authenticated;

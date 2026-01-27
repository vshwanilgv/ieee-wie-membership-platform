-- IEEE WIE Membership Platform - Storage Policies
-- ================================================

-- Create storage bucket for activity evidence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'activity-evidence',
  'activity-evidence',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Storage Policies for activity-evidence bucket

-- Users can upload evidence for their own contributions
CREATE POLICY "Users can upload own evidence"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'activity-evidence' AND
    -- Extract contribution ID from path: contributions/{contribution_id}/{filename}
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM contributions WHERE member_id = auth.uid()
    )
  );

-- Users can view evidence based on contribution visibility
CREATE POLICY "View evidence based on contribution access"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'activity-evidence' AND
    (
      -- If contribution is approved, anyone can see
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM contributions WHERE status = 'approved'
      ) OR
      -- Owner can see their own
      (storage.foldername(name))[1] IN (
        SELECT id::text FROM contributions WHERE member_id = auth.uid()
      ) OR
      -- Approver can see pending items
      (storage.foldername(name))[1] IN (
        SELECT c.id::text FROM contributions c
        JOIN member_roles mr ON mr.member_id = c.member_id
        WHERE 
          c.status = 'pending' AND
          mr.status = 'approved' AND
          (mr.end_date IS NULL OR mr.end_date >= CURRENT_DATE) AND
          (
            (mr.role_type IN ('committee_member', 'committee_lead') AND
             auth.uid() IN (
               SELECT member_id FROM member_roles
               WHERE role_type = 'board_of_directors'
                 AND title ILIKE '%membership%development%'
                 AND status = 'approved'
                 AND (end_date IS NULL OR end_date >= CURRENT_DATE)
             )
            ) OR
            (mr.role_type IN ('executive_committee', 'board_of_directors', 'chairwoman') AND
             auth.uid() IN (
               SELECT member_id FROM member_roles
               WHERE role_type = 'chairwoman'
                 AND status = 'approved'
                 AND (end_date IS NULL OR end_date >= CURRENT_DATE)
             )
            )
          )
      )
    )
  );

-- Users can delete evidence from their own pending contributions
CREATE POLICY "Users can delete own pending evidence"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'activity-evidence' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM contributions 
      WHERE member_id = auth.uid() AND status = 'pending'
    )
  );

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true, -- Public bucket
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
);

-- Storage Policies for profile-photos bucket

-- Users can upload their own profile photo
CREATE POLICY "Users can upload own profile photo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos' AND
    -- Path format: {user_id}/{filename}
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can view profile photos (public bucket)
CREATE POLICY "Anyone can view profile photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'profile-photos');

-- Users can update their own profile photo
CREATE POLICY "Users can update own profile photo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own profile photo
CREATE POLICY "Users can delete own profile photo"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

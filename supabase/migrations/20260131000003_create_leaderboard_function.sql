-- Create function to get leaderboard data with time period filtering
CREATE OR REPLACE FUNCTION get_leaderboard(period_filter TEXT DEFAULT 'all-time')
RETURNS TABLE (
  member_id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  total_score BIGINT,
  contribution_count BIGINT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH member_scores AS (
    SELECT 
      p.id AS member_id,
      p.full_name,
      p.email,
      NULL::TEXT AS avatar_url,
      COALESCE(SUM(COALESCE(c.assigned_score, 0)), 0) AS total_score,
      COUNT(c.id) AS contribution_count
    FROM profiles p
    LEFT JOIN contributions c ON c.member_id = p.id 
      AND c.status = 'approved'
      AND (
        CASE 
          WHEN period_filter = 'monthly' THEN 
            c.approved_at >= DATE_TRUNC('month', CURRENT_DATE)
          WHEN period_filter = 'yearly' THEN 
            c.approved_at >= DATE_TRUNC('year', CURRENT_DATE)
          ELSE TRUE
        END
      )
    GROUP BY p.id, p.full_name, p.email
    HAVING COUNT(c.id) > 0
  )
  SELECT 
    ms.member_id,
    ms.full_name,
    ms.email,
    ms.avatar_url,
    ms.total_score,
    ms.contribution_count,
    ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.contribution_count DESC, ms.full_name ASC) AS rank
  FROM member_scores ms
  ORDER BY rank;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_leaderboard(TEXT) TO authenticated;

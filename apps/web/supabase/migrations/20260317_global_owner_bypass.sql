-- Global owner bypass for attendance tables
-- Allows any user who owns at least one project to manage attendance data across projects.
-- This helps when the owner record isn't present in project_members.

-- Helper: is the current user an owner of any project?
CREATE OR REPLACE FUNCTION public.is_global_club_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_global_club_owner() TO anon, authenticated, service_role;

-- Attendance sessions policy: allow project members OR any global owner
DROP POLICY IF EXISTS "Members manage sessions" ON public.attendance_sessions;
CREATE POLICY "Members manage sessions"
  ON public.attendance_sessions
  FOR ALL
  USING (
    public.is_project_member(project_id, auth.uid())
    OR public.is_global_club_owner()
  )
  WITH CHECK (
    public.is_project_member(project_id, auth.uid())
    OR public.is_global_club_owner()
  );

-- Attendance entries policy: allow project members OR any global owner
DROP POLICY IF EXISTS "Members manage entries" ON public.attendance_entries;
CREATE POLICY "Members manage entries"
  ON public.attendance_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.attendance_sessions s
      WHERE s.id = attendance_entries.session_id
        AND (
          public.is_project_member(s.project_id, auth.uid())
          OR public.is_global_club_owner()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.attendance_sessions s
      WHERE s.id = attendance_entries.session_id
        AND (
          public.is_project_member(s.project_id, auth.uid())
          OR public.is_global_club_owner()
        )
    )
  );

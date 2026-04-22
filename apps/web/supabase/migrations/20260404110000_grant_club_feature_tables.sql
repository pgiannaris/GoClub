-- Grant table privileges for club feature tables.
-- RLS policies remain the source of truth for row-level access.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_profiles TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcements TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attendance_entries TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.polls TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.poll_options TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.poll_votes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO authenticated, service_role;

GRANT SELECT ON TABLE public.member_profiles TO anon;
GRANT SELECT ON TABLE public.announcements TO anon;
GRANT SELECT ON TABLE public.events TO anon;
GRANT SELECT ON TABLE public.attendance_sessions TO anon;
GRANT SELECT ON TABLE public.polls TO anon;
GRANT SELECT ON TABLE public.poll_options TO anon;
GRANT INSERT ON TABLE public.poll_votes TO anon;

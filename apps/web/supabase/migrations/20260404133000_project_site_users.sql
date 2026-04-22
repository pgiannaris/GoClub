CREATE TABLE IF NOT EXISTS public.project_site_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  intent TEXT NOT NULL DEFAULT 'just-visiting'
    CHECK (intent IN ('student-member', 'student-member-requested', 'administrator', 'just-visiting')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, account_id)
);

ALTER TABLE public.project_site_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own project site user record" ON public.project_site_users;
CREATE POLICY "Users manage own project site user record"
  ON public.project_site_users
  FOR ALL
  USING (account_id = auth.uid())
  WITH CHECK (account_id = auth.uid());

DROP POLICY IF EXISTS "Project managers view project site users" ON public.project_site_users;
CREATE POLICY "Project managers view project site users"
  ON public.project_site_users
  FOR SELECT
  USING (
    public.has_project_role(project_site_users.project_id, auth.uid(), ARRAY['owner', 'admin'])
    OR EXISTS (
      SELECT 1
      FROM public.projects
      WHERE projects.id = project_site_users.project_id
        AND projects.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_site_users TO authenticated, service_role;

DROP TRIGGER IF EXISTS set_project_site_users_updated_at ON public.project_site_users;
CREATE TRIGGER set_project_site_users_updated_at
  BEFORE UPDATE ON public.project_site_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

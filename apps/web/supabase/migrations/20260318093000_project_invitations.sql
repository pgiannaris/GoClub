CREATE TABLE IF NOT EXISTS public.project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invited_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  invited_by UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invitations_project
  ON public.project_invitations(project_id);

CREATE INDEX IF NOT EXISTS idx_project_invitations_invited_account
  ON public.project_invitations(invited_account_id);

CREATE INDEX IF NOT EXISTS idx_project_invitations_status
  ON public.project_invitations(status);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_invitation_account
  ON public.project_invitations(project_id, invited_account_id);

DROP POLICY IF EXISTS "View relevant project invitations" ON public.project_invitations;
CREATE POLICY "View relevant project invitations"
  ON public.project_invitations
  FOR SELECT
  USING (
    invited_account_id = auth.uid()
    OR public.has_project_role(project_invitations.project_id, auth.uid(), ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "Manage project invitations" ON public.project_invitations;
CREATE POLICY "Manage project invitations"
  ON public.project_invitations
  FOR INSERT
  WITH CHECK (
    public.has_project_role(project_invitations.project_id, auth.uid(), ARRAY['owner', 'admin'])
    AND invited_by = auth.uid()
  );

DROP POLICY IF EXISTS "Invitees can respond to project invitations" ON public.project_invitations;
CREATE POLICY "Invitees can respond to project invitations"
  ON public.project_invitations
  FOR UPDATE
  USING (
    invited_account_id = auth.uid()
    OR public.has_project_role(project_invitations.project_id, auth.uid(), ARRAY['owner', 'admin'])
  )
  WITH CHECK (
    invited_account_id = auth.uid()
    OR public.has_project_role(project_invitations.project_id, auth.uid(), ARRAY['owner', 'admin'])
  );

GRANT SELECT, INSERT, UPDATE ON TABLE public.project_invitations TO authenticated, service_role;

DROP TRIGGER IF EXISTS set_project_invitations_updated_at ON public.project_invitations;
CREATE TRIGGER set_project_invitations_updated_at
  BEFORE UPDATE ON public.project_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

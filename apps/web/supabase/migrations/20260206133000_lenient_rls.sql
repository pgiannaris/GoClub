-- Lenient RLS adjustments + function grants

-- Ensure trigger function bypasses RLS
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, account_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, account_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Helper functions (bypass RLS for membership checks)
CREATE OR REPLACE FUNCTION public.is_project_member(
  p_project_id UUID,
  p_account_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.account_id = p_account_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_project_role(
  p_project_id UUID,
  p_account_id UUID,
  p_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.account_id = p_account_id
      AND pm.role = ANY (p_roles)
  );
$$;

-- Function grants
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_project_role(UUID, UUID, TEXT[]) TO anon, authenticated, service_role;

-- Projects policies
DROP POLICY IF EXISTS "Members can view project" ON public.projects;
CREATE POLICY "Members can view project"
  ON public.projects FOR SELECT
  USING (public.is_project_member(projects.id, auth.uid()));

DROP POLICY IF EXISTS "Owners can update project" ON public.projects;
CREATE POLICY "Owners can update project"
  ON public.projects FOR UPDATE
  USING (owner_id = auth.uid() OR public.is_project_member(projects.id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_project_member(projects.id, auth.uid()));

DROP POLICY IF EXISTS "Owners can delete project" ON public.projects;
CREATE POLICY "Owners can delete project"
  ON public.projects FOR DELETE
  USING (owner_id = auth.uid() OR public.has_project_role(projects.id, auth.uid(), ARRAY['owner', 'admin']));

-- Project members policies
DROP POLICY IF EXISTS "View project members" ON public.project_members;
CREATE POLICY "View project members"
  ON public.project_members FOR SELECT
  USING (public.is_project_member(project_members.project_id, auth.uid()));

DROP POLICY IF EXISTS "Manage members" ON public.project_members;
CREATE POLICY "Manage members"
  ON public.project_members FOR ALL
  USING (public.has_project_role(project_members.project_id, auth.uid(), ARRAY['owner', 'admin']))
  WITH CHECK (public.has_project_role(project_members.project_id, auth.uid(), ARRAY['owner', 'admin']));

-- Events policies (lenient: any project member can manage)
DROP POLICY IF EXISTS "Members can manage events" ON public.events;
CREATE POLICY "Members can manage events"
  ON public.events FOR ALL
  USING (public.is_project_member(events.project_id, auth.uid()))
  WITH CHECK (public.is_project_member(events.project_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view events internal" ON public.events;
CREATE POLICY "Members can view events internal"
  ON public.events FOR SELECT
  USING (public.is_project_member(events.project_id, auth.uid()));
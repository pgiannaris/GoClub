
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  region TEXT,
  provider TEXT,
  plan_type TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  content JSONB DEFAULT '{}', -- Added for website content
  webhook_url TEXT,
  api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Project members table
CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES accounts(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, account_id)
);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pm_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_account ON project_members(account_id);

-- Auto-add owner as member function
CREATE OR REPLACE FUNCTION add_owner_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO project_members (project_id, account_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (project_id, account_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to auto-add owner
DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_as_member();

-- Helper functions (avoid RLS recursion in policies)
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
    FROM project_members pm
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
    FROM project_members pm
    WHERE pm.project_id = p_project_id
      AND pm.account_id = p_account_id
      AND pm.role = ANY (p_roles)
  );
$$;

-- RLS Policies

-- Projects
DROP POLICY IF EXISTS "Members can view project" ON projects;
CREATE POLICY "Members can view project"
  ON projects FOR SELECT
  USING (public.is_project_member(projects.id, auth.uid()));

DROP POLICY IF EXISTS "Owners can update project" ON projects;
CREATE POLICY "Owners can update project"
  ON projects FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR public.is_project_member(projects.id, auth.uid())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR public.is_project_member(projects.id, auth.uid())
  );

DROP POLICY IF EXISTS "Owners can delete project" ON projects;
CREATE POLICY "Owners can delete project"
  ON projects FOR DELETE
  USING (
    owner_id = auth.uid()
    OR public.has_project_role(projects.id, auth.uid(), ARRAY['owner', 'admin'])
  );

DROP POLICY IF EXISTS "Users can create projects" ON projects;
CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Project Members
DROP POLICY IF EXISTS "View project members" ON project_members;
CREATE POLICY "View project members"
  ON project_members FOR SELECT
  USING (public.is_project_member(project_members.project_id, auth.uid()));

DROP POLICY IF EXISTS "Manage members" ON project_members;
CREATE POLICY "Manage members"
  ON project_members FOR ALL
  USING (
    public.has_project_role(
      project_members.project_id,
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  )
  WITH CHECK (
    public.has_project_role(
      project_members.project_id,
      auth.uid(),
      ARRAY['owner', 'admin']
    )
  );

DROP POLICY IF EXISTS "Public can view projects" ON projects;
CREATE POLICY "Public can view projects"
  ON projects FOR SELECT
  USING (true);

-- Grants
GRANT SELECT ON TABLE public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_members TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(UUID, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_project_role(UUID, UUID, TEXT[]) TO anon, authenticated, service_role;

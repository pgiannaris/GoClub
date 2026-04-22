
-- Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES accounts(id)
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date);

-- RLS Policies

-- Public can view events (if we want public site to show events)
DROP POLICY IF EXISTS "Public can view events" ON events;
CREATE POLICY "Public can view events"
  ON events FOR SELECT
  USING (true);

-- Members can manage events
DROP POLICY IF EXISTS "Members can manage events" ON events;
CREATE POLICY "Members can manage events"
  ON events FOR ALL
  USING (public.is_project_member(events.project_id, auth.uid()))
  WITH CHECK (public.is_project_member(events.project_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view events internal" ON events;
CREATE POLICY "Members can view events internal"
  ON events FOR SELECT
  USING (public.is_project_member(events.project_id, auth.uid()));

-- Grants
GRANT SELECT ON TABLE public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO authenticated, service_role;

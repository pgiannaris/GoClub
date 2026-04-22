-- Club feature tables: members, announcements, events, attendance, polls, tasks
-- Created on 2026-02-06

-- Member profiles (public-facing roster)
CREATE TABLE IF NOT EXISTS member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  role TEXT,
  avatar_url TEXT,
  bio TEXT,
  tags TEXT[],
  is_public BOOLEAN DEFAULT TRUE,
  joined_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_profiles_project ON member_profiles(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_profiles_email_project ON member_profiles(project_id, email);

-- Announcements / news
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published', -- draft | published | archived
  is_pinned BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  author_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_project ON announcements(project_id);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);

-- Events / calendar
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE,
  location TEXT,
  rsvp_url TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | cancelled | completed
  visibility TEXT NOT NULL DEFAULT 'public', -- public | members
  created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Attendance tracking
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_public BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_project ON attendance_sessions(project_id);

CREATE TABLE IF NOT EXISTS attendance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES member_profiles(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'excused', 'absent')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_session ON attendance_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_status ON attendance_entries(status);

-- Polls & voting
CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | closed
  allow_public_votes BOOLEAN DEFAULT FALSE,
  closes_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_polls_project ON polls(project_id);

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  position INT DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);

CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  member_id UUID REFERENCES member_profiles(id) ON DELETE SET NULL,
  voter_name TEXT,
  voter_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_poll_votes_member
  ON poll_votes(poll_id, member_id)
  WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);

-- Tasks / action items
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo', -- todo | in_progress | done
  priority TEXT NOT NULL DEFAULT 'medium', -- low | medium | high
  due_date DATE,
  assignee_id UUID REFERENCES member_profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ---------- RLS Policies ----------

ALTER TABLE member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Member profiles: public roster & member management
DROP POLICY IF EXISTS "Public roster view" ON member_profiles;
CREATE POLICY "Public roster view"
  ON member_profiles FOR SELECT
  USING (is_public);

DROP POLICY IF EXISTS "Members manage roster" ON member_profiles;
CREATE POLICY "Members manage roster"
  ON member_profiles FOR ALL
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']));

-- Announcements
DROP POLICY IF EXISTS "Public announcements view" ON announcements;
CREATE POLICY "Public announcements view"
  ON announcements FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Members manage announcements" ON announcements;
CREATE POLICY "Members manage announcements"
  ON announcements FOR ALL
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']));

-- Events
DROP POLICY IF EXISTS "Public events view" ON events;
CREATE POLICY "Public events view"
  ON events FOR SELECT
  USING (visibility = 'public' OR public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage events" ON events;
CREATE POLICY "Members manage events"
  ON events FOR ALL
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']));

-- Attendance sessions and entries (default private; optionally public summaries)
DROP POLICY IF EXISTS "Members view sessions" ON attendance_sessions;
CREATE POLICY "Members view sessions"
  ON attendance_sessions FOR SELECT
  USING (is_public OR public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage sessions" ON attendance_sessions;
CREATE POLICY "Members manage sessions"
  ON attendance_sessions FOR ALL
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']));

DROP POLICY IF EXISTS "Members view entries" ON attendance_entries;
CREATE POLICY "Members view entries"
  ON attendance_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.id = attendance_entries.session_id
        AND (s.is_public OR public.is_project_member(s.project_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Members manage entries" ON attendance_entries;
CREATE POLICY "Members manage entries"
  ON attendance_entries FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.id = attendance_entries.session_id
        AND public.has_project_role(s.project_id, auth.uid(), ARRAY['owner','admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM attendance_sessions s
      WHERE s.id = attendance_entries.session_id
        AND public.has_project_role(s.project_id, auth.uid(), ARRAY['owner','admin'])
    )
  );

-- Polls
DROP POLICY IF EXISTS "Public polls view" ON polls;
CREATE POLICY "Public polls view"
  ON polls FOR SELECT
  USING (status = 'published');

DROP POLICY IF EXISTS "Members manage polls" ON polls;
CREATE POLICY "Members manage polls"
  ON polls FOR ALL
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']));

-- Poll options mirror poll permissions
DROP POLICY IF EXISTS "Public poll options view" ON poll_options;
CREATE POLICY "Public poll options view"
  ON poll_options FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_options.poll_id
        AND p.status = 'published'
    )
  );

DROP POLICY IF EXISTS "Members manage poll options" ON poll_options;
CREATE POLICY "Members manage poll options"
  ON poll_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_options.poll_id
        AND public.has_project_role(p.project_id, auth.uid(), ARRAY['owner','admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_options.poll_id
        AND public.has_project_role(p.project_id, auth.uid(), ARRAY['owner','admin'])
    )
  );

-- Poll votes: allow public votes only when poll allows it, otherwise members
DROP POLICY IF EXISTS "Submit votes" ON poll_votes;
CREATE POLICY "Submit votes"
  ON poll_votes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_votes.poll_id
        AND (
          p.allow_public_votes
          OR public.is_project_member(p.project_id, auth.uid())
        )
        AND p.status = 'published'
    )
  );

DROP POLICY IF EXISTS "View votes (admins only)" ON poll_votes;
CREATE POLICY "View votes (admins only)"
  ON poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_votes.poll_id
        AND public.has_project_role(p.project_id, auth.uid(), ARRAY['owner','admin'])
    )
  );

-- Tasks
DROP POLICY IF EXISTS "Members view tasks" ON tasks;
CREATE POLICY "Members view tasks"
  ON tasks FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS "Members manage tasks" ON tasks;
CREATE POLICY "Members manage tasks"
  ON tasks FOR ALL
  USING (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_project_role(project_id, auth.uid(), ARRAY['owner','admin']));


# GoClub Database Schema

This file is a design reference, not the migration source of truth.

Canonical schema source:
- `apps/web/supabase/migrations`

Current normalization rules:
- `events.start_at` / `events.end_at` are the canonical event date columns. Treat `start_date` / `end_date` as legacy compatibility fields only.
- `attendance_entries` is the canonical attendance detail table. Older references to `attendance_records` are obsolete.
- Schema changes should go through Supabase migrations, not ad hoc scripts.

> Informal schema design for your GoClub project management platform

## 📋 Overview

This schema supports a project management platform where users can create and manage projects, collaborate in teams, and track activities.

---

## 🗂️ Core Tables

### 1️⃣ **accounts** (Already exists)

_User account information_

```
accounts
├─ id (uuid, primary key)
├─ name (text) - Display name
├─ email (text) - User email
├─ avatar_url (text, nullable) - Profile picture URL
├─ created_at (timestamp)
├─ updated_at (timestamp)
├─ created_by (uuid, nullable)
├─ updated_by (uuid, nullable)
└─ public_data (jsonb) - Any extra user info
```

**Why:** Stores user profiles and account details

---

### 2️⃣ **projects**

_Main project entities_

```
projects
├─ id (uuid, primary key)
├─ name (text) - Project name (e.g., "dtechmathWebsite")
├─ description (text, nullable) - What the project is about
├─ owner_id (uuid) → accounts.id - Who created it
├─ status (text) - "active", "paused", "archived", "coming_up", "restoring"
├─ region (text, nullable) - AWS region like "us-east-2"
├─ provider (text, nullable) - "AWS", "Azure", "GCP", etc.
├─ plan_type (text, nullable) - "NANO", "MICRO", "SMALL", "LARGE"
├─ avatar_url (text, nullable) - Project logo/icon
├─ settings (jsonb, nullable) - Project-specific settings
├─ created_at (timestamp)
├─ updated_at (timestamp)
└─ deleted_at (timestamp, nullable) - Soft delete
```

**Why:** Core entity for managing projects

**Example row:**

```json
{
  "id": "abc-123",
  "name": "GoClub",
  "description": "Main club management platform",
  "owner_id": "user-456",
  "status": "active",
  "region": "us-west-2",
  "provider": "AWS",
  "plan_type": "NANO"
}
```

---

### 3️⃣ **project_members**

_Who can access each project_

```
project_members
├─ id (uuid, primary key)
├─ project_id (uuid) → projects.id
├─ account_id (uuid) → accounts.id
├─ role (text) - "owner", "admin", "member", "viewer"
├─ invited_by (uuid, nullable) → accounts.id
├─ joined_at (timestamp)
└─ created_at (timestamp)

UNIQUE(project_id, account_id)
```

**Why:** Manage team access and permissions

**Roles:**

- `owner` - Full control, can delete project
- `admin` - Can manage members and settings
- `member` - Can edit project content
- `viewer` - Read-only access

---

### 4️⃣ **teams** (Optional but recommended)

_Groups of users working together_

```
teams
├─ id (uuid, primary key)
├─ name (text) - Team name
├─ description (text, nullable)
├─ avatar_url (text, nullable)
├─ owner_id (uuid) → accounts.id
├─ created_at (timestamp)
└─ updated_at (timestamp)
```

**Why:** Allow users to organize into teams/clubs before creating projects

---

### 5️⃣ **team_members**

_Team membership_

```
team_members
├─ id (uuid, primary key)
├─ team_id (uuid) → teams.id
├─ account_id (uuid) → accounts.id
├─ role (text) - "owner", "admin", "member"
├─ joined_at (timestamp)
└─ created_at (timestamp)

UNIQUE(team_id, account_id)
```

---

### 6️⃣ **project_invitations**

_Pending invites to projects_

```
project_invitations
├─ id (uuid, primary key)
├─ project_id (uuid) → projects.id
├─ email (text) - Who to invite
├─ role (text) - What role they'll have
├─ invited_by (uuid) → accounts.id
├─ token (text, unique) - Verification token
├─ status (text) - "pending", "accepted", "declined", "expired"
├─ expires_at (timestamp)
├─ created_at (timestamp)
└─ responded_at (timestamp, nullable)
```

**Why:** Manage pending project invitations

---

### 7️⃣ **activity_log**

_Track what happens in projects_

```
activity_log
├─ id (uuid, primary key)
├─ project_id (uuid, nullable) → projects.id
├─ account_id (uuid) → accounts.id
├─ action (text) - "created_project", "updated_settings", "invited_member", etc.
├─ description (text) - Human readable description
├─ metadata (jsonb, nullable) - Extra data about the action
├─ created_at (timestamp)
└─ ip_address (text, nullable)
```

**Why:** Audit trail and activity feed

**Example actions:**

- `created_project`
- `deleted_project`
- `updated_project`
- `invited_member`
- `removed_member`
- `changed_plan`
- `deployed`

---

### 8️⃣ **project_tags** (Optional)

_Categorize projects_

```
project_tags
├─ id (uuid, primary key)
├─ project_id (uuid) → projects.id
├─ tag (text) - "frontend", "backend", "mobile", "production", etc.
└─ created_at (timestamp)

UNIQUE(project_id, tag)
```

**Why:** Filter and organize projects by category

---

### 9️⃣ **project_favorites** (Optional)

_User's favorite/starred projects_

```
project_favorites
├─ id (uuid, primary key)
├─ project_id (uuid) → projects.id
├─ account_id (uuid) → accounts.id
└─ created_at (timestamp)

UNIQUE(project_id, account_id)
```

**Why:** Quick access to important projects

---

### 🔟 **deployments** (Optional but cool)

_Track project deployments_

```
deployments
├─ id (uuid, primary key)
├─ project_id (uuid) → projects.id
├─ deployed_by (uuid) → accounts.id
├─ version (text) - "v1.2.3"
├─ status (text) - "pending", "in_progress", "success", "failed"
├─ environment (text) - "production", "staging", "development"
├─ commit_sha (text, nullable)
├─ logs (text, nullable)
├─ started_at (timestamp)
├─ completed_at (timestamp, nullable)
└─ created_at (timestamp)
```

**Why:** Track deployment history and status

---

## 🔐 Row Level Security (RLS) Policies

### **accounts**

```sql
-- Users can read their own account
CREATE POLICY "Users can view own account"
  ON accounts FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own account
CREATE POLICY "Users can update own account"
  ON accounts FOR UPDATE
  USING (auth.uid() = id);
```

### **projects**

```sql
-- Users can view projects they're members of
CREATE POLICY "Members can view project"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.account_id = auth.uid()
    )
  );

-- Owners/admins can update projects
CREATE POLICY "Owners can update project"
  ON projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
      AND project_members.account_id = auth.uid()
      AND project_members.role IN ('owner', 'admin')
    )
  );

-- Any authenticated user can create a project
CREATE POLICY "Users can create projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
```

### **project_members**

```sql
-- Members can see other members of their projects
CREATE POLICY "View project members"
  ON project_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.account_id = auth.uid()
    )
  );

-- Owners/admins can add/remove members
CREATE POLICY "Manage members"
  ON project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = project_members.project_id
      AND pm.account_id = auth.uid()
      AND pm.role IN ('owner', 'admin')
    )
  );
```

---

## 📊 Common Queries You'll Need

### Get all projects for current user

```sql
SELECT p.*,
       pm.role as my_role,
       COUNT(DISTINCT pm2.id) as member_count
FROM projects p
JOIN project_members pm ON pm.project_id = p.id
LEFT JOIN project_members pm2 ON pm2.project_id = p.id
WHERE pm.account_id = auth.uid()
  AND p.deleted_at IS NULL
GROUP BY p.id, pm.role
ORDER BY p.updated_at DESC;
```

### Get project with members

```sql
SELECT p.*,
       json_agg(
         json_build_object(
           'id', a.id,
           'name', a.name,
           'email', a.email,
           'avatar_url', a.avatar_url,
           'role', pm.role
         )
       ) as members
FROM projects p
JOIN project_members pm ON pm.project_id = p.id
JOIN accounts a ON a.id = pm.account_id
WHERE p.id = 'project-id-here'
GROUP BY p.id;
```

### Recent activity for a project

```sql
SELECT al.*,
       a.name as user_name,
       a.avatar_url as user_avatar
FROM activity_log al
JOIN accounts a ON a.id = al.account_id
WHERE al.project_id = 'project-id-here'
ORDER BY al.created_at DESC
LIMIT 20;
```

---

## 🚀 Quick Start - Create Your First Tables

### 1. Create projects table

```sql
CREATE TABLE projects (
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_status ON projects(status);
```

### 2. Create project_members table

```sql
CREATE TABLE project_members (
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
CREATE INDEX idx_pm_project ON project_members(project_id);
CREATE INDEX idx_pm_account ON project_members(account_id);
```

### 3. Auto-add owner as member (Database Trigger)

```sql
CREATE OR REPLACE FUNCTION add_owner_as_member()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (project_id, account_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION add_owner_as_member();
```

---

## 💡 Pro Tips

1. **Use UUIDs** - Better for distributed systems and security
2. **Soft deletes** - Use `deleted_at` instead of actually deleting
3. **Timestamps** - Always add `created_at` and `updated_at`
4. **JSONB for flexibility** - Store extra data without schema changes
5. **Indexes** - Add them on foreign keys and frequently queried columns
6. **RLS policies** - Protect your data at the database level

---

## 🎨 Next Steps

1. **Create tables in Supabase Dashboard**
   - Go to Table Editor
   - Create each table one by one
   - Set up RLS policies

2. **Generate TypeScript types**

   ```bash
   npx supabase gen types typescript --project-id your-project-id > apps/web/lib/database.types.ts
   ```

3. **Start building features**
   - Project creation form
   - Project list/grid
   - Member management
   - Activity feed

---

## 🔗 Relationships Diagram

```
accounts (users)
    │
    ├── owns ──→ projects
    │              │
    │              ├── has many ──→ project_members
    │              ├── has many ──→ project_tags
    │              ├── has many ──→ deployments
    │              └── has many ──→ activity_log
    │
    ├── member of ──→ project_members
    ├── member of ──→ team_members
    └── starred ──→ project_favorites

teams
    └── has many ──→ team_members
```

---

**Ready to build! 🚀** Start with `projects` and `project_members` tables, then expand as needed.

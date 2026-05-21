-- Normalize duplicate member_profiles that differ only by email casing, then
-- enforce case-insensitive uniqueness per project.

WITH ranked AS (
  SELECT
    id,
    project_id,
    account_id,
    email,
    lower(trim(email)) AS normalized_email,
    row_number() OVER (
      PARTITION BY project_id, lower(trim(email))
      ORDER BY
        CASE WHEN account_id IS NOT NULL THEN 0 ELSE 1 END,
        joined_at NULLS LAST,
        created_at NULLS LAST,
        id
    ) AS rn,
    first_value(id) OVER (
      PARTITION BY project_id, lower(trim(email))
      ORDER BY
        CASE WHEN account_id IS NOT NULL THEN 0 ELSE 1 END,
        joined_at NULLS LAST,
        created_at NULLS LAST,
        id
    ) AS keep_id
  FROM public.member_profiles
  WHERE email IS NOT NULL AND trim(email) <> ''
),
dupes AS (
  SELECT * FROM ranked WHERE rn > 1
),
keepers AS (
  SELECT r.*
  FROM ranked r
  WHERE r.rn = 1
)
UPDATE public.member_profiles target
SET
  account_id = COALESCE(target.account_id, keepers.account_id),
  email = keepers.normalized_email
FROM ranked
JOIN keepers ON keepers.id = ranked.keep_id
WHERE target.id = ranked.id
  AND ranked.rn = 1;

DELETE FROM public.member_profiles m
USING dupes d
WHERE m.id = d.id;

UPDATE public.member_profiles
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email <> lower(trim(email));

DROP INDEX IF EXISTS public.uniq_member_profiles_email_project;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_member_profiles_email_project_lower
  ON public.member_profiles(project_id, lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

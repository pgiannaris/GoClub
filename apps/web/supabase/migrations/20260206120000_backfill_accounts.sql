-- Backfill missing accounts rows for existing auth users
INSERT INTO public.accounts (id, name, email, created_at, updated_at)
SELECT
  u.id,
  COALESCE(
    u.raw_user_meta_data ->> 'name',
    NULLIF(split_part(u.email, '@', 1), ''),
    ''
  ) AS name,
  u.email,
  u.created_at,
  u.updated_at
FROM auth.users u
LEFT JOIN public.accounts a ON a.id = u.id
WHERE a.id IS NULL;

-- Remove public.accounts rows that no longer have a matching auth.users row.
-- These orphaned rows block re-signup because public.accounts.email is unique
-- and the signup trigger inserts into public.accounts for every new auth user.

DELETE FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users u
  WHERE u.id = a.id
);

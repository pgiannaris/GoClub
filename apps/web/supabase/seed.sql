-- Create a demo user account
-- Email: demo@goclub.com
-- Password: demo123456

-- First, create the auth user with Supabase's built-in password hashing
-- Note: This uses crypt() which is available in Supabase
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role,
  aud,
  confirmation_token,
  recovery_token
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'demo@goclub.com',
  crypt('demo123456', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"name":"Demo User"}',
  false,
  'authenticated',
  'authenticated',
  '',
  ''
) 
ON CONFLICT (email) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = NOW()
RETURNING id;

-- Insert into public.accounts using the same ID
INSERT INTO public.accounts (
  id,
  email,
  created_at,
  updated_at
)
SELECT 
  id,
  email,
  created_at,
  updated_at
FROM auth.users
WHERE email = 'demo@goclub.com'
ON CONFLICT (id) DO NOTHING;

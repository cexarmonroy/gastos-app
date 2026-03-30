-- Script to enable Row Level Security (RLS) on public tables
-- This resolves the "rls_disabled_in_public" critical security issue.

-- 1. Enable RLS for User table
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS for Record table
ALTER TABLE "Record" ENABLE ROW LEVEL SECURITY;

-- Default Policies (Restrictive by default)

-- User table: Users should only see/manage their own data if using Supabase Auth.
-- Since this app uses NextAuth with Prisma, the prisma client usually bypasses RLS.
-- However, we must ensure PostgREST doesn't expose data.

-- Create a policy that allows the 'postgres' and 'service_role' (Prisma) to do everything
-- (Usually they already bypass RLS, but it's good practice to be explicit if needed)

-- For PostgREST ('anon' and 'authenticated' roles):
-- We block everything by default by just enabling RLS without policies.
-- If you want to allow authenticated users to read records:
/*
CREATE POLICY "Allow authenticated select on Record" 
ON "Record" 
FOR SELECT 
TO authenticated 
USING (true);
*/

-- IMPORTANT: Run these commands in the Supabase SQL Editor.

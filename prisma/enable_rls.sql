-- Script to enable Row Level Security (RLS) on public tables.
-- Run in the Supabase SQL Editor after applying Prisma migrations.
-- Note: Prisma uses a direct connection and bypasses RLS; this protects PostgREST exposure.

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Fund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Movement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FundraisingEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReconciliationLog" ENABLE ROW LEVEL SECURITY;

-- Default: no policies = deny all for anon/authenticated via PostgREST.

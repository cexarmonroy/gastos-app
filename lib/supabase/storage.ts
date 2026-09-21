import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "movement-attachments";

let adminClient: SupabaseClient | null = null;

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").replace(/\/rest\/v1$/i, "");
}

function getSupabaseUrl(): string {
  const raw = process.env.SUPABASE_URL?.trim();
  if (!raw) {
    throw new Error("SUPABASE_URL no está definida.");
  }
  return normalizeSupabaseUrl(raw);
}

function getBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  return bucket || DEFAULT_BUCKET;
}

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function getStorageAdmin(): SupabaseClient {
  if (!isStorageConfigured()) {
    throw new Error(
      "Supabase Storage no configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env"
    );
  }

  if (!adminClient) {
    adminClient = createClient(
      getSupabaseUrl(),
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }

  return adminClient;
}

export function getStorageBucket(): string {
  return getBucketName();
}

export async function createSignedDownloadUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const supabase = getStorageAdmin();
  const { data, error } = await supabase.storage.from(getBucketName()).createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "No se pudo generar el enlace de descarga.");
  }

  return data.signedUrl;
}

export function buildStoragePath(orgSlug: string, movementId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgSlug}/${movementId}/${crypto.randomUUID()}-${safeName}`;
}

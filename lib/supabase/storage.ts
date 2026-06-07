import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "movement-attachments";

let adminClient: SupabaseClient | null = null;

export function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getStorageAdmin(): SupabaseClient {
  if (!isStorageConfigured()) {
    throw new Error(
      "Supabase Storage no configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env"
    );
  }

  if (!adminClient) {
    adminClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }

  return adminClient;
}

export function getStorageBucket(): string {
  return BUCKET;
}

export async function createSignedDownloadUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const supabase = getStorageAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "No se pudo generar el enlace de descarga.");
  }

  return data.signedUrl;
}

export function buildStoragePath(orgSlug: string, movementId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgSlug}/${movementId}/${crypto.randomUUID()}-${safeName}`;
}

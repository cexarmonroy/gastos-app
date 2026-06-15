"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Paperclip, RefreshCw, Upload } from "lucide-react";
import {
  getAttachmentDownloadUrl,
  getAttachmentTypeOptions,
  getMovementAttachments,
  getStorageStatus,
  uploadMovementAttachment,
} from "@/app/actions/attachments";

interface AttachmentPanelProps {
  movementId: string;
}

type AttachmentItem = Awaited<ReturnType<typeof getMovementAttachments>>[number];
type TypeOption = Awaited<ReturnType<typeof getAttachmentTypeOptions>>[number];

export function AttachmentPanel({ movementId }: AttachmentPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [typeOptions, setTypeOptions] = useState<TypeOption[]>([]);
  const [attachmentType, setAttachmentType] = useState("RECEIPT");
  const [supersedesId, setSupersedesId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [storageConfigured, setStorageConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAttachments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [items, status] = await Promise.all([
        getMovementAttachments(movementId),
        getStorageStatus(),
      ]);
      setAttachments(items);
      setStorageConfigured(status.configured);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar adjuntos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAttachments();
    getAttachmentTypeOptions().then(setTypeOptions);
  }, [movementId]);

  const startUpload = (replaceId?: string) => {
    setSupersedesId(replaceId ?? null);
    fileInputRef.current?.click();
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("movementId", movementId);
    formData.append("attachmentType", attachmentType);
    formData.append("file", file);
    if (supersedesId) {
      formData.append("supersedesId", supersedesId);
    }

    const result = await uploadMovementAttachment(formData);

    if (!result.success) {
      setError(result.error);
    } else {
      await loadAttachments();
    }

    setSupersedesId(null);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (attachmentId: string) => {
    const result = await getAttachmentDownloadUrl(attachmentId);
    if (!result.success) {
      setError(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="border-t border-white/10 pt-4 mt-2 space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-white/90">Evidencias / adjuntos</h3>
      </div>

      <p className="text-[11px] text-white/40">
        Las evidencias son inmutables. Para corregir un archivo, sube una nueva versión.
      </p>

      {!storageConfigured && (
        <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          Supabase Storage no está configurado. Agrega SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY al .env.
        </p>
      )}

      {error && (
        <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-3">{error}</p>
      )}

      {storageConfigured && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={attachmentType}
            onChange={(e) => setAttachmentType(e.target.value)}
            className="select-premium py-2 text-sm flex-1"
            disabled={isUploading}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => startUpload()}
            disabled={isUploading}
            className="btn-secondary flex items-center justify-center gap-2 text-sm py-2"
          >
            {isUploading && !supersedesId ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            Subir archivo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-white/40">Cargando adjuntos...</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-white/40">Sin evidencias adjuntas (boleta, factura, comprobante, etc.)</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((item) => {
            const isSuperseded = attachments.some((a) => a.supersedesId === item.id);
            const isLatest = !isSuperseded;
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  isLatest
                    ? "bg-white/5 border-white/10"
                    : "bg-black/20 border-white/5 opacity-70"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-white/90 truncate" title={item.fileName}>
                      {item.fileName}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {item.attachmentTypeLabel} · v{item.version} · {formatSize(item.fileSize)}
                      {isLatest && item.version > 1 && (
                        <span className="text-success ml-1">· actual</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isLatest && (
                    <button
                      type="button"
                      onClick={() => startUpload(item.id)}
                      disabled={isUploading}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-accent"
                      title="Subir nueva versión"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownload(item.id)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

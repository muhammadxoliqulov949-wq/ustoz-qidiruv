"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { UploadField } from "@/components/media/upload-field";
import { formatUzDate } from "@/lib/uz-date";
import {
  MAX_VERIFICATION_DOCUMENTS,
  MEDIA_REMOVED_NOTE,
  MEDIA_SCAN_BOUNDARY_NOTE,
  MEDIA_VIEW_URL_NOTE,
  REQUIRED_VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_DOCUMENT_TYPE_HINT,
  VERIFICATION_DOCUMENT_TYPE_LABEL,
  formatBytes,
  uploadRulesText,
  type VerificationDocumentType,
} from "@/lib/media";
import {
  removeVerificationDocumentAction,
  uploadVerificationDocumentAction,
} from "@/server/actions/media";

/* -------------------------------------------------------------------------- */
/* Verification documents — Phase 18.                                          */
/*                                                                              */
/* The teacher attaches evidence HERE; submission freezes it. A frozen set is    */
/* read-only: the reviewer is reading exactly these bytes, so adding or removing  */
/* one mid-review would change the thing being decided.                          */
/*                                                                              */
/* `previewUrl` is a short-lived signed capability minted on the server for the  */
/* owner of the row. It is never a permanent address, and it is dropped the      */
/* moment the document is replaced.                                             */
/* -------------------------------------------------------------------------- */

export interface VerificationDocumentItem {
  id: string;
  documentType: VerificationDocumentType;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  createdAt: Date;
  /** Short-lived read capability for THIS viewer, or null when unavailable. */
  previewUrl: string | null;
}

export interface VerificationDocumentsProps {
  documents: VerificationDocumentItem[];
  /** True while an application is under review: evidence is frozen. */
  frozen: boolean;
  /** Honest explanation when uploads are not configured in this deployment. */
  storageNote: string | null;
  /** Extra context shown when submission is refused for a missing document. */
  blockedNote: string | null;
}

export function VerificationDocuments({
  documents,
  frozen,
  storageNote,
  blockedNote,
}: VerificationDocumentsProps) {
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const presentTypes = new Set(documents.map((document) => document.documentType));
  const missingRequired = REQUIRED_VERIFICATION_DOCUMENT_TYPES.filter(
    (type) => !presentTypes.has(type),
  );
  const atLimit = documents.length >= MAX_VERIFICATION_DOCUMENTS;

  function remove(assetId: string): void {
    startTransition(async () => {
      const form = new FormData();
      form.set("assetId", assetId);
      const result = await removeVerificationDocumentAction(form);
      setConfirmingId(null);
      if (result.ok) {
        setStatus({ tone: "ok", text: MEDIA_REMOVED_NOTE });
        router.refresh();
        return;
      }
      setStatus({ tone: "error", text: result.message });
    });
  }

  return (
    <section
      aria-labelledby="hujjatlar-sarlavha"
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-xs"
    >
      <div className="flex flex-col gap-2">
        <h2 id="hujjatlar-sarlavha" className="text-xl font-semibold text-ink-900">
          Tasdiqlash hujjatlari
        </h2>
        <p className="max-w-prose text-base leading-relaxed text-ink-700">
          Administrator arizani ko‘rib chiqishda shu hujjatlarga tayanadi. Hujjatlar
          ommaviy profilga chiqarilmaydi va faqat tekshiruv uchun vakolatli
          administratorlarga ko‘rsatiladi.
        </p>
        <p className="max-w-prose text-sm leading-relaxed text-ink-500">
          {MEDIA_SCAN_BOUNDARY_NOTE} {MEDIA_VIEW_URL_NOTE}
        </p>
      </div>

      {missingRequired.length > 0 && !frozen ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Yuborish uchun hujjat kerak. </span>
          {blockedNote ??
            "Majburiy hujjat yuklanmaguncha arizani yuborib bo‘lmaydi."}
        </p>
      ) : null}

      {frozen ? (
        <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-700">
          <span className="font-medium text-ink-900">Hujjatlar muzlatilgan. </span>
          Ariza ko‘rib chiqilmoqda — shu vaqt ichida hujjatlarni o‘zgartirib
          bo‘lmaydi. Qaror bildirishnomalar bo‘limida ko‘rinadi.
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {VERIFICATION_DOCUMENT_TYPES.map((type) => {
          const own = documents.filter((document) => document.documentType === type);
          const required = REQUIRED_VERIFICATION_DOCUMENT_TYPES.includes(type);
          return (
            <li
              key={type}
              className="flex flex-col gap-3 rounded-lg border border-line bg-surface-muted p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-ink-900">
                  {VERIFICATION_DOCUMENT_TYPE_LABEL[type]}
                </h3>
                {own.length > 0 ? (
                  <Badge variant="success">Yuklangan</Badge>
                ) : (
                  <Badge variant={required ? "accent" : "neutral"}>
                    {required ? "Majburiy" : "Ixtiyoriy"}
                  </Badge>
                )}
              </div>
              <p className="max-w-prose text-sm leading-relaxed text-ink-700">
                {VERIFICATION_DOCUMENT_TYPE_HINT[type]}
              </p>

              {own.length === 0 ? (
                <p className="text-sm text-ink-500">Bu turdagi hujjat hali yuklanmagan.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {own.map((document) => (
                    <li
                      key={document.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 break-all text-sm font-medium text-ink-900">
                        {document.originalFileName}
                      </span>
                      <span className="text-xs text-ink-500">
                        {formatBytes(document.byteSize)} ·{" "}
                        <time dateTime={document.createdAt.toISOString()}>
                          {formatUzDate(document.createdAt)}
                        </time>
                      </span>
                      {document.previewUrl ? (
                        <a
                          href={document.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-accent-700 underline underline-offset-2"
                        >
                          Ko‘rish
                        </a>
                      ) : null}
                      {!frozen && !storageNote ? (
                        confirmingId === document.id ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-ink-700">O‘chirasizmi?</span>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              loading={pending}
                              onClick={() => remove(document.id)}
                            >
                              Ha, o‘chirish
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmingId(null)}
                            >
                              Bekor qilish
                            </Button>
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmingId(document.id)}
                          >
                            O‘chirish
                          </Button>
                        )
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              {!frozen && !storageNote && !atLimit ? (
                <UploadField
                  purpose="teacher_verification_document"
                  action={uploadVerificationDocumentAction}
                  extraFields={{ documentType: type }}
                  label={own.length > 0 ? "Boshqa fayl yuklash" : "Hujjat yuklash"}
                  helpText={uploadRulesText("teacher_verification_document")}
                />
              ) : null}
              {!frozen && !storageNote && atLimit ? (
                <p className="text-sm text-ink-500">
                  Hujjatlar soni chegarasiga yetdingiz ({MAX_VERIFICATION_DOCUMENTS} ta).
                  Yangisini yuklash uchun avval bittasini o‘chiring.
                </p>
              ) : null}
              {storageNote ? <p className="text-sm text-ink-500">{storageNote}</p> : null}
            </li>
          );
        })}
      </ul>

      <p
        role={status?.tone === "error" ? "alert" : "status"}
        aria-live={status?.tone === "error" ? undefined : "polite"}
        tabIndex={status?.tone === "error" ? -1 : undefined}
        className={
          status === null
            ? "sr-only"
            : status.tone === "ok"
              ? "text-sm font-medium text-ink-900"
              : "text-sm font-medium text-red-700"
        }
      >
        {status?.text ?? ""}
      </p>
    </section>
  );
}

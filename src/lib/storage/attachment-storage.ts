import "server-only";

import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type AttachmentStorageBackend = "database" | "s3";

type AttachmentStorageConfig =
  | { backend: "database" }
  | {
      backend: "s3";
      bucket: string;
      prefix: string;
      downloadUrlTtlSeconds: number;
      client: S3ClientConfig;
    };

type AttachmentRecord = {
  filename: string;
  mimeType: string;
  size: number;
  storageBackend: string;
  storageKey: string | null;
  data: Uint8Array | null;
};

export type AttachmentDownload =
  | { kind: "data"; data: Uint8Array<ArrayBuffer> }
  | { kind: "redirect"; url: string };

let cachedS3Client: S3Client | undefined;

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) {
    throw new Error(`${name} is required when ATTACHMENT_STORAGE=s3.`);
  }
  return value.trim();
}

function parseTtl(value: string | undefined): number {
  const parsed = Number(value ?? "300");
  if (!Number.isInteger(parsed) || parsed < 60 || parsed > 604_800) {
    throw new Error(
      "ATTACHMENT_S3_DOWNLOAD_TTL_SECONDS must be an integer from 60 to 604800.",
    );
  }
  return parsed;
}

export function getAttachmentStorageConfig(
  environment: Record<string, string | undefined> = process.env,
): AttachmentStorageConfig {
  const backend = environment.ATTACHMENT_STORAGE?.trim().toLowerCase() ||
    "database";
  if (backend === "database") return { backend };
  if (backend !== "s3") {
    throw new Error("ATTACHMENT_STORAGE must be either database or s3.");
  }

  const accessKeyId = environment.ATTACHMENT_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = environment.ATTACHMENT_S3_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      "ATTACHMENT_S3_ACCESS_KEY_ID and ATTACHMENT_S3_SECRET_ACCESS_KEY must be set together.",
    );
  }

  const prefix = (environment.ATTACHMENT_S3_PREFIX ?? "attachments")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const endpoint = environment.ATTACHMENT_S3_ENDPOINT?.trim();

  return {
    backend,
    bucket: required(environment.ATTACHMENT_S3_BUCKET, "ATTACHMENT_S3_BUCKET"),
    prefix,
    downloadUrlTtlSeconds: parseTtl(
      environment.ATTACHMENT_S3_DOWNLOAD_TTL_SECONDS,
    ),
    client: {
      region: environment.ATTACHMENT_S3_REGION?.trim() || "us-east-1",
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle:
        environment.ATTACHMENT_S3_FORCE_PATH_STYLE?.toLowerCase() === "true",
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    },
  };
}

export function buildAttachmentStorageKey(
  messageId: string,
  prefix: string,
  objectId: string = randomUUID(),
): string {
  return [prefix, "tickets", encodeURIComponent(messageId), objectId]
    .filter(Boolean)
    .join("/");
}

export function attachmentContentDisposition(filename: string): string {
  const safeAscii = filename
    .replace(/[\r\n"\\]/g, "_")
    .replace(/[^\x20-\x7E]/g, "_") || "attachment";
  const encoded = encodeURIComponent(filename.replace(/[\r\n]/g, ""));
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}

function s3Client(config: Extract<AttachmentStorageConfig, { backend: "s3" }>) {
  cachedS3Client ??= new S3Client(config.client);
  return cachedS3Client;
}

export async function storeAttachmentObject(input: {
  messageId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}): Promise<{
  storageBackend: AttachmentStorageBackend;
  storageKey: string | null;
  data: Uint8Array<ArrayBuffer> | null;
}> {
  const config = getAttachmentStorageConfig();
  if (config.backend === "database") {
    return {
      storageBackend: "database",
      storageKey: null,
      data: Uint8Array.from(input.data),
    };
  }

  const storageKey = buildAttachmentStorageKey(input.messageId, config.prefix);
  await s3Client(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: input.data,
      ContentType: input.mimeType,
      ContentLength: input.data.length,
    }),
  );
  return { storageBackend: "s3", storageKey, data: null };
}

export async function deleteAttachmentObject(storageKey: string): Promise<void> {
  const config = getAttachmentStorageConfig();
  if (config.backend !== "s3") return;
  await s3Client(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }),
  );
}

export async function getAttachmentDownload(
  attachment: AttachmentRecord,
): Promise<AttachmentDownload> {
  if (attachment.storageBackend === "database") {
    if (!attachment.data) throw new Error("Database attachment data is missing.");
    return { kind: "data", data: Uint8Array.from(attachment.data) };
  }
  if (attachment.storageBackend !== "s3" || !attachment.storageKey) {
    throw new Error("Attachment storage metadata is invalid.");
  }

  const config = getAttachmentStorageConfig();
  if (config.backend !== "s3") {
    throw new Error("S3 attachment storage is not configured.");
  }
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: attachment.storageKey,
    ResponseContentType: attachment.mimeType,
    ResponseContentDisposition: attachmentContentDisposition(
      attachment.filename,
    ),
  });
  return {
    kind: "redirect",
    url: await getSignedUrl(s3Client(config), command, {
      expiresIn: config.downloadUrlTtlSeconds,
    }),
  };
}

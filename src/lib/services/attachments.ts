import "server-only";
import { db } from "@/lib/db";

const MAX_FILES = 3;
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/json",
];

export async function saveTicketAttachments(
  messageId: string,
  files: File[],
): Promise<string | null> {
  const usable = files.filter((f) => f.size > 0).slice(0, MAX_FILES);
  for (const file of usable) {
    if (file.size > MAX_SIZE) {
      return `"${file.name}" is larger than 5 MB.`;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `"${file.name}" has an unsupported file type.`;
    }
  }
  for (const file of usable) {
    await db.ticketAttachment.create({
      data: {
        messageId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        data: Buffer.from(await file.arrayBuffer()),
      },
    });
  }
  return null;
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUser } from "@/lib/auth";
import {
  attachmentContentDisposition,
  getAttachmentDownload,
} from "@/lib/storage/attachment-storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await db.ticketAttachment.findUnique({
    where: { id },
    include: { message: { include: { ticket: true } } },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isStaff = Boolean(user.roleId);
  if (!isStaff && attachment.message.ticket.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const download = await getAttachmentDownload(attachment);
  if (download.kind === "redirect") {
    return NextResponse.redirect(download.url, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return new NextResponse(download.data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(attachment.size),
      "Content-Disposition": attachmentContentDisposition(attachment.filename),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

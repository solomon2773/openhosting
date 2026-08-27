import { afterAll, beforeEach, expect, test } from "vitest";
import { db } from "@/lib/db";
import { saveTicketAttachments } from "@/lib/services/attachments";
import { getAttachmentDownload } from "@/lib/storage/attachment-storage";

beforeEach(async () => {
  process.env.ATTACHMENT_STORAGE = "database";
  await db.user.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

test("keeps database attachments backward compatible through storage abstraction", async () => {
  const user = await db.user.create({
    data: {
      email: "attachment-test@example.test",
      password: "not-used-in-tests",
      firstName: "Attachment",
      lastName: "Test",
    },
  });
  const ticket = await db.ticket.create({
    data: {
      userId: user.id,
      subject: "Attachment test",
      messages: {
        create: { userId: user.id, message: "Testing a text attachment." },
      },
    },
    include: { messages: true },
  });
  const file = new File(["diagnostic output"], "diagnostic.txt", {
    type: "text/plain",
  });

  expect(await saveTicketAttachments(ticket.messages[0].id, [file])).toBeNull();

  const attachment = await db.ticketAttachment.findFirstOrThrow();
  expect(attachment).toEqual(
    expect.objectContaining({
      filename: "diagnostic.txt",
      mimeType: "text/plain",
      size: 17,
      storageBackend: "database",
      storageKey: null,
    }),
  );
  const download = await getAttachmentDownload(attachment);
  expect(download.kind).toBe("data");
  if (download.kind === "data") {
    expect(Buffer.from(download.data).toString("utf8")).toBe(
      "diagnostic output",
    );
  }
});

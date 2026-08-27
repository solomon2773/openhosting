import { describe, expect, test } from "vitest";
import {
  attachmentContentDisposition,
  buildAttachmentStorageKey,
  getAttachmentStorageConfig,
} from "@/lib/storage/attachment-storage";

describe("attachment storage configuration", () => {
  test("uses database storage by default", () => {
    expect(getAttachmentStorageConfig({})).toEqual({ backend: "database" });
  });

  test("builds an S3-compatible client configuration", () => {
    expect(
      getAttachmentStorageConfig({
        ATTACHMENT_STORAGE: "s3",
        ATTACHMENT_S3_BUCKET: "private-files",
        ATTACHMENT_S3_REGION: "auto",
        ATTACHMENT_S3_ENDPOINT: "https://objects.example.test",
        ATTACHMENT_S3_ACCESS_KEY_ID: "key",
        ATTACHMENT_S3_SECRET_ACCESS_KEY: "secret",
        ATTACHMENT_S3_FORCE_PATH_STYLE: "true",
        ATTACHMENT_S3_PREFIX: "/tenant-a/",
        ATTACHMENT_S3_DOWNLOAD_TTL_SECONDS: "120",
      }),
    ).toEqual({
      backend: "s3",
      bucket: "private-files",
      prefix: "tenant-a",
      downloadUrlTtlSeconds: 120,
      client: {
        region: "auto",
        endpoint: "https://objects.example.test",
        forcePathStyle: true,
        credentials: { accessKeyId: "key", secretAccessKey: "secret" },
      },
    });
  });

  test("rejects incomplete or unsafe S3 configuration", () => {
    expect(() =>
      getAttachmentStorageConfig({ ATTACHMENT_STORAGE: "filesystem" }),
    ).toThrow("database or s3");
    expect(() =>
      getAttachmentStorageConfig({
        ATTACHMENT_STORAGE: "s3",
        ATTACHMENT_S3_BUCKET: "files",
        ATTACHMENT_S3_ACCESS_KEY_ID: "key-only",
      }),
    ).toThrow("must be set together");
    expect(() =>
      getAttachmentStorageConfig({
        ATTACHMENT_STORAGE: "s3",
        ATTACHMENT_S3_BUCKET: "files",
        ATTACHMENT_S3_DOWNLOAD_TTL_SECONDS: "10",
      }),
    ).toThrow("60 to 604800");
  });
});

describe("attachment object metadata", () => {
  test("builds tenant-safe object keys without using the original filename", () => {
    expect(buildAttachmentStorageKey("message/id", "attachments", "object-id")).toBe(
      "attachments/tickets/message%2Fid/object-id",
    );
  });

  test("sanitizes content-disposition headers and preserves UTF-8 names", () => {
    expect(attachmentContentDisposition('invoice\r\n"é.pdf')).toBe(
      "attachment; filename=\"invoice____.pdf\"; filename*=UTF-8''invoice%22%C3%A9.pdf",
    );
  });
});

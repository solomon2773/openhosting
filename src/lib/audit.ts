import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function audit(
  action: string,
  opts: {
    userId?: string | null;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  const hdrs = await headers().catch(() => null);
  await db.auditLog
    .create({
      data: {
        action,
        userId: opts.userId ?? null,
        targetType: opts.targetType,
        targetId: opts.targetId,
        ip: hdrs?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        metadata: opts.metadata as never,
      },
    })
    .catch(() => undefined);
}

import { NextRequest, NextResponse } from "next/server";
import {
  cancelEndOfTermServices,
  cancelStaleSuspendedServices,
  generateRenewalInvoices,
  suspendOverdueServices,
} from "@/lib/billing";

// Recurring billing tick. Call this every hour (Kubernetes CronJob, Vercel
// cron, or plain crontab) with `Authorization: Bearer $CRON_SECRET`.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invoicesCreated = await generateRenewalInvoices();
  const endOfTermCancelled = await cancelEndOfTermServices();
  const suspended = await suspendOverdueServices();
  const cancelled = await cancelStaleSuspendedServices();
  return NextResponse.json({
    invoicesCreated,
    endOfTermCancelled,
    suspended,
    cancelled,
  });
}

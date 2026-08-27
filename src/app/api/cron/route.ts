import { NextRequest, NextResponse } from "next/server";
import {
  cancelEndOfTermServices,
  cancelStaleSuspendedServices,
  generateRenewalInvoices,
  suspendOverdueServices,
} from "@/lib/billing";
import { autoChargeDueInvoices } from "@/lib/services/payments";
import { pruneLoginAttempts } from "@/lib/services/login-guard";
import { authenticateOauthToken } from "@/lib/oauth";
import { canonicalMcpResource, mcpToolScope } from "@/lib/oauth-policy";
import { publicUrl } from "@/lib/settings";

// Recurring billing tick. Call this every hour (Kubernetes CronJob, Vercel
// cron, or plain crontab) with `Authorization: Bearer $CRON_SECRET`.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const secretMatches = Boolean(secret && auth === `Bearer ${secret}`);
  const oauth = secretMatches
    ? null
    : await authenticateOauthToken(
        request,
        canonicalMcpResource(await publicUrl()),
      );
  if (
    !secretMatches &&
    (!oauth || !oauth.scopes.includes(mcpToolScope("run_billing_cron")))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const invoicesCreated = await generateRenewalInvoices();
  const autoCharged = await autoChargeDueInvoices();
  const endOfTermCancelled = await cancelEndOfTermServices();
  const suspended = await suspendOverdueServices();
  const cancelled = await cancelStaleSuspendedServices();
  const loginAttemptsPruned = await pruneLoginAttempts();
  return NextResponse.json({
    invoicesCreated,
    autoCharged,
    endOfTermCancelled,
    suspended,
    cancelled,
    loginAttemptsPruned,
  });
}

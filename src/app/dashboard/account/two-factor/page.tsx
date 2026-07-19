import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { totpUri } from "@/lib/totp";
import { getSetting } from "@/lib/settings";
import { confirmTwoFactor } from "@/lib/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Set up two-factor authentication" };

export default async function TwoFactorSetupPage() {
  const user = await requireUser();
  if (user.totpEnabledAt) redirect("/dashboard/account");
  if (!user.totpSecret) redirect("/dashboard/account");

  const companyName = await getSetting("company_name");
  const uri = totpUri(user.totpSecret, user.email, companyName);
  const qrDataUrl = await QRCode.toDataURL(uri, { width: 220, margin: 1 });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Set up two-factor authentication</h1>
      <div className="card mt-6 p-6">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-600">
          <li>Open your authenticator app and scan the QR code below.</li>
          <li>Enter the 6-digit code the app shows to confirm.</li>
        </ol>
        <div className="my-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="TOTP QR code" className="rounded-lg border border-slate-200" />
        </div>
        <p className="mb-4 text-center text-xs text-slate-400">
          Can&apos;t scan? Enter this secret manually:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5">{user.totpSecret}</code>
        </p>
        <ActionForm action={confirmTwoFactor}>
          <input
            name="code"
            inputMode="numeric"
            maxLength={6}
            required
            className="input text-center text-2xl tracking-[0.5em]"
            placeholder="000000"
          />
          <SubmitButton className="btn-primary w-full">
            Confirm and enable
          </SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}

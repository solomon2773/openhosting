import Link from "next/link";
import { getSetting } from "@/lib/settings";
import { LogoMark } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const companyName = await getSetting("company_name");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2">
<LogoMark size={40} />
        <span className="text-xl font-semibold text-slate-900">
          {companyName}
        </span>
      </Link>
      <div className="card w-full max-w-md p-8">{children}</div>
    </div>
  );
}

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Audit log" };

export default async function AdminAuditLogPage() {
  await requireAdmin("settings");
  const entries = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap">
                  {formatDateTime(entry.createdAt)}
                </td>
                <td>
                  {entry.user
                    ? `${entry.user.firstName} ${entry.user.lastName}`
                    : "System"}
                </td>
                <td>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {entry.action}
                  </code>
                </td>
                <td className="text-slate-500">
                  {entry.targetType
                    ? `${entry.targetType}:${entry.targetId?.slice(-8)}`
                    : "—"}
                </td>
                <td className="text-slate-500">{entry.ip ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Nothing logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin("users");
  const { q } = await searchParams;
  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      role: true,
      _count: { select: { services: true, invoices: true } },
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="flex items-center gap-3">
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search users…"
              className="input w-56"
            />
            <button type="submit" className="btn-secondary">
              Search
            </button>
          </form>
          <Link href="/admin/users/new" className="btn-primary">
            New user
          </Link>
        </div>
      </div>
      <div className="card mt-6">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Services</th>
              <th>Invoices</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {user.firstName} {user.lastName}
                  </Link>
                </td>
                <td>{user.email}</td>
                <td>
                  {user.role ? (
                    <span className="badge bg-brand-100 text-brand-700">
                      {user.role.name}
                    </span>
                  ) : (
                    <span className="text-slate-400">Client</span>
                  )}
                </td>
                <td>{user._count.services}</td>
                <td>{user._count.invoices}</td>
                <td>{formatDate(user.createdAt)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

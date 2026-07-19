import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  // visiting the page marks everything read
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <div className="card mt-6 divide-y divide-slate-100">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 ${notification.readAt ? "" : "bg-brand-50/50"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {notification.link ? (
                    <Link
                      href={notification.link}
                      className="hover:text-brand-600"
                    >
                      {notification.title}
                    </Link>
                  ) : (
                    notification.title
                  )}
                </p>
                {notification.body && (
                  <p className="mt-0.5 text-sm text-slate-500">
                    {notification.body}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-xs text-slate-400">
                {formatDateTime(notification.createdAt)}
              </p>
            </div>
          </div>
        ))}
        {notifications.length === 0 && (
          <p className="p-10 text-center text-sm text-slate-400">
            Nothing here yet — invoices, service events and ticket replies
            will show up in this feed.
          </p>
        )}
      </div>
      <p className="mt-4 text-sm text-slate-500">
        Choose which events notify you in{" "}
        <Link
          href="/dashboard/account"
          className="text-brand-600 hover:underline"
        >
          account settings
        </Link>
        .
      </p>
    </div>
  );
}

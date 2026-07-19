import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { deleteAnnouncement, saveAnnouncement } from "@/lib/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";

export const metadata = { title: "Announcements" };

export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin("announcements");
  const { edit } = await searchParams;
  const [announcements, editing] = await Promise.all([
    db.announcement.findMany({ orderBy: { createdAt: "desc" } }),
    edit ? db.announcement.findUnique({ where: { id: edit } }) : null,
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Announcements</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="card">
          <table className="table-base">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Published</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((announcement) => (
                <tr key={announcement.id}>
                  <td>
                    <a
                      href={`/admin/announcements?edit=${announcement.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {announcement.title}
                    </a>
                  </td>
                  <td>
                    <span
                      className={`badge ${announcement.publishedAt ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {announcement.publishedAt ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>{formatDate(announcement.publishedAt)}</td>
                  <td className="text-right">
                    <form action={deleteAnnouncement}>
                      <input type="hidden" name="id" value={announcement.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {announcements.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No announcements yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 font-semibold">
            {editing ? `Edit: ${editing.title}` : "New announcement"}
          </h2>
          <ActionForm action={saveAnnouncement}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div>
              <label className="label">Title</label>
              <input
                name="title"
                required
                defaultValue={editing?.title}
                className="input"
              />
            </div>
            <div>
              <label className="label">Excerpt (shown in the list)</label>
              <input
                name="excerpt"
                defaultValue={editing?.excerpt ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">Body (plain text / basic HTML)</label>
              <textarea
                name="body"
                rows={8}
                required
                defaultValue={editing?.body}
                className="input"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="published"
                name="published"
                type="checkbox"
                defaultChecked={Boolean(editing?.publishedAt)}
              />
              <label htmlFor="published" className="text-sm">
                Published
              </label>
            </div>
            <SubmitButton className="btn-primary">
              {editing ? "Save changes" : "Create announcement"}
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}

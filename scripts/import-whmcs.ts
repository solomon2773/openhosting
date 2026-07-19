/**
 * Imports data from an existing WHMCS MySQL database.
 *
 * Usage:
 *   WHMCS_DB_URL="mysql://user:pass@host:3306/whmcs" npm run import:whmcs
 *
 * Imports clients (bcrypt password hashes keep working), product groups,
 * products with their billing-cycle pricing, and open tickets with replies.
 * Matched rows (by email/slug) are skipped, so the script is re-runnable.
 */
import mysql from "mysql2/promise";
import { PrismaClient, type BillingCycle } from "@prisma/client";

const db = new PrismaClient();

type Row = Record<string, unknown>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// WHMCS tblpricing columns → our billing cycles
const CYCLE_COLUMNS: Array<{ column: string; cycle: BillingCycle }> = [
  { column: "monthly", cycle: "MONTHLY" },
  { column: "quarterly", cycle: "QUARTERLY" },
  { column: "semiannually", cycle: "SEMI_ANNUALLY" },
  { column: "annually", cycle: "ANNUALLY" },
  { column: "biennially", cycle: "BIENNIALLY" },
];

async function main() {
  const url = process.env.WHMCS_DB_URL;
  if (!url) {
    console.error("Set WHMCS_DB_URL (mysql://user:pass@host/db)");
    process.exit(1);
  }
  const source = await mysql.createConnection(url);
  const counts = { users: 0, categories: 0, products: 0, tickets: 0 };

  // ── Clients ──────────────────────────────────────────────────────────────
  const [clients] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM tblclients",
  );
  const userIdMap = new Map<number, string>();
  for (const row of clients as Row[]) {
    const email = String(row.email).toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      userIdMap.set(Number(row.id), existing.id);
      continue;
    }
    const created = await db.user.create({
      data: {
        email,
        // WHMCS 8+ stores bcrypt hashes; bcryptjs verifies them unchanged.
        password: String(row.password ?? ""),
        firstName: String(row.firstname ?? "Imported"),
        lastName: String(row.lastname ?? ""),
        companyName: row.companyname ? String(row.companyname) : null,
        address: row.address1 ? String(row.address1) : null,
        city: row.city ? String(row.city) : null,
        state: row.state ? String(row.state) : null,
        zip: row.postcode ? String(row.postcode) : null,
        country: row.country ? String(row.country) : null,
        phone: row.phonenumber ? String(row.phonenumber) : null,
        credits: Number(row.credit ?? 0),
        emailVerifiedAt: new Date(),
      },
    });
    userIdMap.set(Number(row.id), created.id);
    counts.users++;
  }

  // ── Product groups → categories ──────────────────────────────────────────
  const [groups] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM tblproductgroups",
  );
  const categoryIdMap = new Map<number, string>();
  for (const row of groups as Row[]) {
    const slug = slugify(String(row.name));
    const category = await db.category.upsert({
      where: { slug },
      update: {},
      create: {
        name: String(row.name),
        slug,
        description: row.headline ? String(row.headline) : null,
        sortOrder: Number(row.order ?? 0),
      },
    });
    categoryIdMap.set(Number(row.id), category.id);
    counts.categories++;
  }

  // ── Products with cycle pricing ──────────────────────────────────────────
  const [products] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM tblproducts",
  );
  for (const row of products as Row[]) {
    const categoryId = categoryIdMap.get(Number(row.gid));
    if (!categoryId) continue;
    const slug = slugify(String(row.name));
    if (await db.product.findUnique({ where: { slug } })) continue;

    // currency 1 = the WHMCS default currency
    const [pricing] = await source.query<mysql.RowDataPacket[]>(
      "SELECT * FROM tblpricing WHERE type='product' AND relid=? AND currency=1 LIMIT 1",
      [row.id],
    );
    const priceRow = (pricing as Row[])[0];
    const prices = priceRow
      ? CYCLE_COLUMNS.filter(
          ({ column }) => Number(priceRow[column]) >= 0,
        ).map(({ column, cycle }) => ({
          cycle,
          price: Number(priceRow[column]),
        }))
      : [];

    await db.product.create({
      data: {
        name: String(row.name),
        slug,
        description: row.description ? String(row.description) : null,
        categoryId,
        hidden: String(row.hidden ?? "") === "on",
        stock: Number(row.stockcontrol ?? 0) ? Number(row.qty ?? 0) : null,
        prices: { create: prices },
      },
    });
    counts.products++;
  }

  // ── Open tickets ─────────────────────────────────────────────────────────
  const [tickets] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM tbltickets WHERE status NOT IN ('Closed')",
  );
  for (const row of tickets as Row[]) {
    const userId = userIdMap.get(Number(row.userid));
    if (!userId) continue;
    const priority = String(row.urgency ?? "Medium").toUpperCase();
    const ticket = await db.ticket.create({
      data: {
        userId,
        subject: String(row.title ?? "Imported ticket"),
        priority:
          priority === "HIGH" ? "HIGH" : priority === "LOW" ? "LOW" : "MEDIUM",
        status: "OPEN",
        messages: {
          create: {
            userId,
            message: String(row.message ?? ""),
            createdAt: row.date ? new Date(String(row.date)) : undefined,
          },
        },
      },
    });
    const [replies] = await source.query<mysql.RowDataPacket[]>(
      "SELECT * FROM tblticketreplies WHERE tid = ?",
      [row.id],
    );
    for (const reply of replies as Row[]) {
      const authorId = userIdMap.get(Number(reply.userid)) ?? userId;
      await db.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          userId: authorId,
          message: String(reply.message ?? ""),
          createdAt: reply.date ? new Date(String(reply.date)) : undefined,
        },
      });
    }
    counts.tickets++;
  }

  await source.end();
  console.log("WHMCS import finished:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

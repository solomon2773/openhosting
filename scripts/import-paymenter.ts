/**
 * Imports data from an existing Paymenter (v1) MySQL database.
 *
 * Usage:
 *   PAYMENTER_DB_URL="mysql://user:pass@host:3306/paymenter" npm run import:paymenter
 *
 * Imports users (passwords are bcrypt in both systems, so logins keep
 * working), categories, products with monthly prices, and open tickets.
 * Already-imported rows (matched by email/slug) are skipped, so the script
 * is safe to re-run.
 */
import mysql from "mysql2/promise";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

type Row = Record<string, unknown>;

async function main() {
  const url = process.env.PAYMENTER_DB_URL;
  if (!url) {
    console.error("Set PAYMENTER_DB_URL (mysql://user:pass@host/db)");
    process.exit(1);
  }
  const source = await mysql.createConnection(url);
  const counts = { users: 0, categories: 0, products: 0, tickets: 0 };

  // ── Users ────────────────────────────────────────────────────────────────
  const [users] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM users",
  );
  const userIdMap = new Map<number, string>();
  for (const row of users as Row[]) {
    const email = String(row.email).toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      userIdMap.set(Number(row.id), existing.id);
      continue;
    }
    const created = await db.user.create({
      data: {
        email,
        // Paymenter stores bcrypt hashes; bcryptjs verifies them as-is.
        password: String(row.password ?? ""),
        firstName: String(row.first_name ?? row.name ?? "Imported"),
        lastName: String(row.last_name ?? ""),
        companyName: row.companyname ? String(row.companyname) : null,
        address: row.address ? String(row.address) : null,
        city: row.city ? String(row.city) : null,
        state: row.state ? String(row.state) : null,
        zip: row.zip ? String(row.zip) : null,
        country: row.country ? String(row.country) : null,
        phone: row.phone ? String(row.phone) : null,
        emailVerifiedAt: row.email_verified_at
          ? new Date(String(row.email_verified_at))
          : null,
      },
    });
    userIdMap.set(Number(row.id), created.id);
    counts.users++;
  }

  // ── Categories ───────────────────────────────────────────────────────────
  const [categories] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM categories",
  );
  const categoryIdMap = new Map<number, string>();
  for (const row of categories as Row[]) {
    const slug = String(row.slug ?? row.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    const category = await db.category.upsert({
      where: { slug },
      update: {},
      create: {
        name: String(row.name),
        slug,
        description: row.description ? String(row.description) : null,
      },
    });
    categoryIdMap.set(Number(row.id), category.id);
    counts.categories++;
  }

  // ── Products (with monthly price if present) ─────────────────────────────
  const [products] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM products",
  );
  for (const row of products as Row[]) {
    const categoryId = categoryIdMap.get(Number(row.category_id));
    if (!categoryId) continue;
    const slug = String(row.slug ?? row.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    if (await db.product.findUnique({ where: { slug } })) continue;
    await db.product.create({
      data: {
        name: String(row.name),
        slug,
        description: row.description ? String(row.description) : null,
        categoryId,
        stock: row.stock === null ? null : Number(row.stock),
        hidden: Boolean(row.hidden),
        prices:
          row.price != null
            ? { create: { cycle: "MONTHLY", price: Number(row.price) } }
            : undefined,
      },
    });
    counts.products++;
  }

  // ── Open tickets ─────────────────────────────────────────────────────────
  const [tickets] = await source.query<mysql.RowDataPacket[]>(
    "SELECT * FROM tickets WHERE status != 'closed'",
  );
  for (const row of tickets as Row[]) {
    const userId = userIdMap.get(Number(row.user_id));
    if (!userId) continue;
    const ticket = await db.ticket.create({
      data: {
        userId,
        subject: String(row.title ?? row.subject ?? "Imported ticket"),
        priority:
          String(row.priority ?? "medium").toUpperCase() === "HIGH"
            ? "HIGH"
            : String(row.priority ?? "medium").toUpperCase() === "LOW"
              ? "LOW"
              : "MEDIUM",
        status: "OPEN",
      },
    });
    const [messages] = await source.query<mysql.RowDataPacket[]>(
      "SELECT * FROM ticket_messages WHERE ticket_id = ?",
      [row.id],
    );
    for (const message of messages as Row[]) {
      const authorId = userIdMap.get(Number(message.user_id)) ?? userId;
      await db.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          userId: authorId,
          message: String(message.message ?? ""),
          createdAt: message.created_at
            ? new Date(String(message.created_at))
            : undefined,
        },
      });
    }
    counts.tickets++;
  }

  await source.end();
  console.log("Import finished:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

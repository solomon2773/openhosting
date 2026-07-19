/**
 * Captures the screenshots used in the README/docs from a running dev/prod
 * server with seeded data (`npm run db:seed`).
 *
 * Usage: BASE_URL=http://localhost:3000 npx tsx scripts/screenshots.ts
 */
import { chromium, type Page } from "playwright";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function shot(page: Page, path: string, name: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${name}`);
}

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(/dashboard|admin/, { timeout: 15000 });
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const [minecraft, pendingInvoice, ticket] = await Promise.all([
    db.product.findUnique({ where: { slug: "minecraft-server" } }),
    db.invoice.findFirst({ where: { status: "PENDING" } }),
    db.ticket.findFirst({ orderBy: { createdAt: "asc" } }),
  ]);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  // ── Public storefront ─────────────────────────────────────────────────────
  await shot(page, "/", "storefront-home");
  await shot(page, "/store/game-servers", "storefront-category");
  await shot(
    page,
    "/store/game-servers/minecraft-server",
    "storefront-product",
  );

  // put something in the cart for the cart screenshot
  await page.goto(`${BASE}/store/game-servers/minecraft-server`, {
    waitUntil: "networkidle",
  });
  await page.click("text=Add to cart");
  await page.waitForURL(/cart/);
  await page.screenshot({ path: `${OUT}/storefront-cart.png` });
  console.log("✓ storefront-cart");

  await shot(page, "/login", "auth-login");

  // ── Client area (demo customer) ───────────────────────────────────────────
  await login(page, "demo@example.com", "demo12345");
  await shot(page, "/dashboard", "client-dashboard");
  await shot(page, "/dashboard/services", "client-services");
  if (pendingInvoice) {
    await shot(
      page,
      `/dashboard/invoices/${pendingInvoice.id}`,
      "client-invoice-pay",
    );
  }
  if (ticket) {
    await shot(page, `/dashboard/tickets/${ticket.id}`, "client-ticket");
  }
  await shot(page, "/dashboard/account", "client-account");

  // ── Admin panel ───────────────────────────────────────────────────────────
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const adminPage = await adminContext.newPage();
  await login(adminPage, "admin@example.com", "admin12345");
  await shot(adminPage, "/admin", "admin-dashboard");
  await shot(adminPage, "/admin/products", "admin-products");
  if (minecraft) {
    await shot(adminPage, `/admin/products/${minecraft.id}`, "admin-product-edit");
  }
  await shot(adminPage, "/admin/extensions", "admin-extensions");
  if (ticket) {
    await shot(adminPage, `/admin/tickets/${ticket.id}`, "admin-ticket");
  }
  await shot(adminPage, "/admin/settings", "admin-settings");
  await shot(adminPage, "/admin/invoices", "admin-invoices");

  await browser.close();
  await db.$disconnect();
  console.log(`\nSaved to ${OUT}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

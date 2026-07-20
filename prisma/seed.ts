import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 no longer auto-loads .env for standalone scripts.
try {
  process.loadEnvFile(".env");
} catch {
  // env vars provided by the environment
}
import bcrypt from "bcryptjs";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const EMAIL_TEMPLATES = [
  {
    key: "welcome",
    subject: "Welcome to {{company}}",
    body: "<p>Hi {{name}},</p><p>Your account at {{company}} has been created. You can sign in at {{url}}.</p>",
  },
  {
    key: "verify_email",
    subject: "Verify your email address",
    body: '<p>Hi {{name}},</p><p>Please confirm your email address by clicking <a href="{{link}}">this link</a>. The link expires in 60 minutes.</p>',
  },
  {
    key: "password_reset",
    subject: "Reset your password",
    body: '<p>Hi {{name}},</p><p>Click <a href="{{link}}">here</a> to reset your password. The link expires in 60 minutes.</p>',
  },
  {
    key: "invoice_created",
    subject: "Invoice #{{invoice}} from {{company}}",
    body: '<p>Hi {{name}},</p><p>A new invoice <strong>#{{invoice}}</strong> for {{total}} is due on {{due}}. Pay it at <a href="{{link}}">{{link}}</a>.</p>',
  },
  {
    key: "invoice_paid",
    subject: "Payment received for invoice #{{invoice}}",
    body: "<p>Hi {{name}},</p><p>We received your payment of {{total}} for invoice <strong>#{{invoice}}</strong>. Thank you!</p>",
  },
  {
    key: "service_activated",
    subject: "Your service {{product}} is active",
    body: "<p>Hi {{name}},</p><p>Your service <strong>{{product}}</strong> is now active. Manage it at {{url}}.</p>",
  },
  {
    key: "service_suspended",
    subject: "Your service {{product}} was suspended",
    body: "<p>Hi {{name}},</p><p>Your service <strong>{{product}}</strong> was suspended due to an unpaid invoice.</p>",
  },
  {
    key: "ticket_reply",
    subject: "New reply on ticket #{{ticket}}: {{subject}}",
    body: '<p>Hi {{name}},</p><p>There is a new reply on your ticket <strong>#{{ticket}}</strong>. View it at <a href="{{link}}">{{link}}</a>.</p>',
  },
];

async function main() {
  // ── Roles & users ─────────────────────────────────────────────────────────
  const adminRole = await db.role.upsert({
    where: { name: "Administrator" },
    update: {},
    create: { name: "Administrator", permissions: ["*"] },
  });
  await db.role.upsert({
    where: { name: "Support" },
    update: {},
    create: { name: "Support", permissions: ["tickets", "users"] },
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  const admin = await db.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: await bcrypt.hash(adminPassword, 10),
      firstName: "Ada",
      lastName: "Admin",
      roleId: adminRole.id,
      emailVerifiedAt: new Date(),
      country: "US",
    },
  });

  const demo = await db.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      password: await bcrypt.hash("demo12345", 10),
      firstName: "Devon",
      lastName: "Demo",
      emailVerifiedAt: new Date(),
      country: "US",
      credits: 25,
    },
  });

  // ── Catalog ───────────────────────────────────────────────────────────────
  const game = await db.category.upsert({
    where: { slug: "game-servers" },
    update: {},
    create: {
      name: "Game Servers",
      slug: "game-servers",
      description: "High-performance game hosting with instant setup.",
      sortOrder: 1,
    },
  });
  const vps = await db.category.upsert({
    where: { slug: "vps" },
    update: {},
    create: {
      name: "VPS",
      slug: "vps",
      description: "KVM virtual servers with dedicated resources.",
      sortOrder: 2,
    },
  });
  const web = await db.category.upsert({
    where: { slug: "web-hosting" },
    update: {},
    create: {
      name: "Web Hosting",
      slug: "web-hosting",
      description: "Fast and reliable web hosting for any site.",
      sortOrder: 3,
    },
  });

  const minecraft = await db.product.upsert({
    where: { slug: "minecraft-server" },
    update: {},
    create: {
      name: "Minecraft Server",
      slug: "minecraft-server",
      description:
        "Lag-free Minecraft hosting on NVMe hardware.\n• Instant setup\n• DDoS protection\n• Full mod support\n• Automatic backups",
      categoryId: game.id,
      sortOrder: 1,
      prices: {
        create: [
          { cycle: "MONTHLY", price: 5.99 },
          { cycle: "QUARTERLY", price: 16.99 },
          { cycle: "ANNUALLY", price: 59.99 },
        ],
      },
      configOptions: {
        create: [
          {
            name: "Memory",
            envKey: "SERVER_MEMORY",
            sortOrder: 1,
            values: {
              create: [
                { label: "2 GB", value: "2048", price: 0, sortOrder: 1 },
                { label: "4 GB", value: "4096", price: 3, sortOrder: 2 },
                { label: "8 GB", value: "8192", price: 8, sortOrder: 3 },
              ],
            },
          },
        ],
      },
    },
  });

  await db.product.upsert({
    where: { slug: "rust-server" },
    update: {},
    create: {
      name: "Rust Server",
      slug: "rust-server",
      description:
        "Rust hosting built for big populations.\n• Up to 300 players\n• Oxide/uMod support\n• Weekly map wipes automated",
      categoryId: game.id,
      sortOrder: 2,
      prices: {
        create: [
          { cycle: "MONTHLY", price: 12.99 },
          { cycle: "QUARTERLY", price: 34.99 },
        ],
      },
    },
  });

  await db.product.upsert({
    where: { slug: "vps-starter" },
    update: {},
    create: {
      name: "VPS Starter",
      slug: "vps-starter",
      description:
        "2 vCPU · 4 GB RAM · 50 GB NVMe · 1 Gbps\nPerfect for small apps and dev environments.",
      categoryId: vps.id,
      sortOrder: 1,
      prices: {
        create: [
          { cycle: "MONTHLY", price: 9.99, setupFee: 0 },
          { cycle: "ANNUALLY", price: 99.99 },
        ],
      },
    },
  });

  await db.product.upsert({
    where: { slug: "vps-pro" },
    update: {},
    create: {
      name: "VPS Pro",
      slug: "vps-pro",
      description:
        "4 vCPU · 16 GB RAM · 200 GB NVMe · 1 Gbps\nFor production workloads that need headroom.",
      categoryId: vps.id,
      sortOrder: 2,
      prices: {
        create: [
          { cycle: "MONTHLY", price: 29.99 },
          { cycle: "ANNUALLY", price: 299.99 },
        ],
      },
    },
  });

  await db.product.upsert({
    where: { slug: "web-basic" },
    update: {},
    create: {
      name: "Web Basic",
      slug: "web-basic",
      description:
        "10 GB SSD · unlimited bandwidth · free SSL\nHost one website with email included.",
      categoryId: web.id,
      sortOrder: 1,
      prices: {
        create: [
          { cycle: "MONTHLY", price: 2.99 },
          { cycle: "ANNUALLY", price: 29.99 },
        ],
      },
    },
  });

  // ── Promotions & taxes ────────────────────────────────────────────────────
  await db.coupon.upsert({
    where: { code: "WELCOME10" },
    update: {},
    create: { code: "WELCOME10", type: "PERCENT", value: 10, maxUses: 100 },
  });
  if ((await db.taxRate.count()) === 0) {
    await db.taxRate.create({
      data: { name: "Sales tax", rate: 8.5, country: "US" },
    });
  }
  await db.currency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { code: "EUR", symbol: "€", rate: 0.92, enabled: true },
  });

  // ── Settings & email templates ────────────────────────────────────────────
  const settings: Record<string, string> = {
    company_name: "OpenHosting",
    company_url: process.env.APP_URL ?? "http://localhost:3000",
    currency: "USD",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  for (const template of EMAIL_TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { key: template.key },
      update: {},
      create: template,
    });
  }

  // ── Extensions ────────────────────────────────────────────────────────────
  const drivers = [
    { slug: "stripe", name: "Stripe", type: "GATEWAY" as const },
    { slug: "paypal", name: "PayPal", type: "GATEWAY" as const },
    { slug: "mollie", name: "Mollie", type: "GATEWAY" as const },
    { slug: "bank-transfer", name: "Bank transfer", type: "GATEWAY" as const },
    { slug: "coinbase-commerce", name: "Coinbase Commerce (crypto)", type: "GATEWAY" as const },
    { slug: "nowpayments", name: "NOWPayments (crypto)", type: "GATEWAY" as const },
    { slug: "btcpay", name: "BTCPay Server (crypto)", type: "GATEWAY" as const },
    { slug: "coingate", name: "CoinGate (crypto)", type: "GATEWAY" as const },
    { slug: "gocardless", name: "GoCardless (SEPA / direct debit)", type: "GATEWAY" as const },
    { slug: "square", name: "Square", type: "GATEWAY" as const },
    { slug: "authorizenet", name: "Authorize.net", type: "GATEWAY" as const },
    { slug: "braintree", name: "Braintree", type: "GATEWAY" as const },
    { slug: "lemonsqueezy", name: "Lemon Squeezy (merchant of record)", type: "GATEWAY" as const },
    { slug: "razorpay", name: "Razorpay", type: "GATEWAY" as const },
    { slug: "mercadopago", name: "Mercado Pago (PIX / LatAm)", type: "GATEWAY" as const },
    { slug: "paystack", name: "Paystack", type: "GATEWAY" as const },
    { slug: "flutterwave", name: "Flutterwave", type: "GATEWAY" as const },
    { slug: "midtrans", name: "Midtrans (Indonesia)", type: "GATEWAY" as const },
    { slug: "xendit", name: "Xendit (SE Asia)", type: "GATEWAY" as const },
    { slug: "pterodactyl", name: "Pterodactyl", type: "SERVER" as const },
    { slug: "proxmox", name: "Proxmox VE", type: "SERVER" as const },
    { slug: "webmin", name: "Webmin (Virtualmin)", type: "SERVER" as const },
    { slug: "pelican", name: "Pelican Panel", type: "SERVER" as const },
    { slug: "wisp", name: "WISP", type: "SERVER" as const },
    { slug: "solusvm", name: "SolusVM", type: "SERVER" as const },
    { slug: "tcadmin", name: "TCAdmin 2", type: "SERVER" as const },
    { slug: "hestiacp", name: "HestiaCP", type: "SERVER" as const },
    { slug: "cyberpanel", name: "CyberPanel", type: "SERVER" as const },
    { slug: "cwp", name: "CentOS Web Panel", type: "SERVER" as const },
    { slug: "interworx", name: "InterWorx", type: "SERVER" as const },
    { slug: "ispconfig", name: "ISPConfig", type: "SERVER" as const },
    { slug: "hetzner", name: "Hetzner Cloud", type: "SERVER" as const },
    { slug: "digitalocean", name: "DigitalOcean", type: "SERVER" as const },
    { slug: "vultr", name: "Vultr", type: "SERVER" as const },
    { slug: "linode", name: "Linode", type: "SERVER" as const },
    { slug: "openstack", name: "OpenStack", type: "SERVER" as const },
    { slug: "onapp", name: "OnApp", type: "SERVER" as const },
    { slug: "virtuozzo", name: "Virtuozzo", type: "SERVER" as const },
    { slug: "vmware-vcloud", name: "VMware vCloud Director", type: "SERVER" as const },
    { slug: "enom", name: "Enom (domains)", type: "RESALE" as const },
    { slug: "resellerclub", name: "ResellerClub (domains)", type: "RESALE" as const },
    { slug: "namecheap", name: "Namecheap (domains)", type: "RESALE" as const },
    { slug: "opensrs", name: "OpenSRS (domains)", type: "RESALE" as const },
    { slug: "openprovider", name: "Openprovider (domains)", type: "RESALE" as const },
    { slug: "gogetssl", name: "GoGetSSL (SSL certificates)", type: "RESALE" as const },
    { slug: "software-license", name: "Software license (cPanel / LiteSpeed / Softaculous)", type: "RESALE" as const },
    { slug: "microsoft365", name: "Microsoft 365 (seats)", type: "RESALE" as const },
    { slug: "google-workspace", name: "Google Workspace (seats)", type: "RESALE" as const },
  ];
  for (const driver of drivers) {
    await db.extension.upsert({
      where: { slug: driver.slug },
      update: {},
      create: driver,
    });
  }
  await db.extension.update({
    where: { slug: "bank-transfer" },
    data: {
      enabled: true,
      config: {
        instructions:
          "Wire the amount to IBAN DE00 0000 0000 0000 0000 00 (OpenHosting GmbH).",
      },
    },
  });

  // ── Demo activity (order → invoice → service, ticket) ─────────────────────
  if ((await db.order.count()) === 0) {
    const price = 8.99; // Minecraft monthly + 4 GB option
    const order = await db.order.create({
      data: {
        userId: demo.id,
        status: "PAID",
        subtotal: price,
        total: price,
        items: {
          create: {
            productId: minecraft.id,
            cycle: "MONTHLY",
            quantity: 1,
            unitPrice: price,
          },
        },
      },
    });
    const service = await db.service.create({
      data: {
        userId: demo.id,
        productId: minecraft.id,
        orderId: order.id,
        status: "ACTIVE",
        cycle: "MONTHLY",
        price,
        expiresAt: new Date(Date.now() + 27 * 86_400_000),
        config: [
          {
            option: "Memory",
            envKey: "SERVER_MEMORY",
            label: "4 GB",
            value: "4096",
            price: 3,
          },
        ],
      },
    });
    const invoice = await db.invoice.create({
      data: {
        userId: demo.id,
        orderId: order.id,
        status: "PAID",
        subtotal: price,
        total: price,
        dueAt: new Date(),
        paidAt: new Date(),
        items: {
          create: {
            description: "Minecraft Server (monthly)",
            quantity: 1,
            unitPrice: price,
            serviceId: service.id,
          },
        },
      },
    });
    await db.payment.create({
      data: {
        invoiceId: invoice.id,
        gateway: "bank-transfer",
        amount: price,
        status: "COMPLETED",
        transactionId: "seed-demo",
      },
    });
    // an open renewal invoice so the "pay invoice" flow is demonstrable
    await db.invoice.create({
      data: {
        userId: demo.id,
        status: "PENDING",
        subtotal: price,
        total: price,
        dueAt: new Date(Date.now() + 27 * 86_400_000),
        items: {
          create: {
            description: "Minecraft Server — renewal",
            quantity: 1,
            unitPrice: price,
            serviceId: service.id,
          },
        },
      },
    });

    const ticket = await db.ticket.create({
      data: {
        userId: demo.id,
        subject: "How do I upload a custom modpack?",
        department: "technical",
        priority: "MEDIUM",
        status: "ANSWERED",
        assignedToId: admin.id,
        messages: {
          create: [
            {
              userId: demo.id,
              message:
                "Hi! I'd like to run a Fabric modpack on my Minecraft server. What's the best way to upload it?",
            },
          ],
        },
      },
    });
    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        userId: admin.id,
        message:
          "Hey Devon! Upload the modpack zip via the file manager, then set the startup jar to fabric-server-launch.jar and restart. Happy to help if anything breaks.",
      },
    });
  }

  // ── Knowledgebase ─────────────────────────────────────────────────────────
  const kbCat = await db.kbCategory.upsert({
    where: { slug: "getting-started" },
    update: {},
    create: { name: "Getting started", slug: "getting-started", sortOrder: 1 },
  });
  await db.kbArticle.upsert({
    where: { slug: "how-to-order" },
    update: {},
    create: {
      categoryId: kbCat.id,
      title: "How to place your first order",
      slug: "how-to-order",
      body: "Browse the store, pick a plan and billing cycle, add it to your cart, and check out. Your service activates as soon as the invoice is paid.",
      published: true,
    },
  });
  await db.kbArticle.upsert({
    where: { slug: "reset-password" },
    update: {},
    create: {
      categoryId: kbCat.id,
      title: "Resetting your password",
      slug: "reset-password",
      body: "Use the 'Forgot password?' link on the sign-in page. We'll email you a reset link that is valid for 60 minutes.",
      published: true,
    },
  });

  console.log("Seed complete.");
  console.log("  Admin: admin@example.com / " + adminPassword);
  console.log("  Demo customer: demo@example.com / demo12345");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

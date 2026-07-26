/**
 * Admin recovery — reset a staff password without the web UI.
 *
 *   node prisma/reset-admin.mjs --list
 *   printf '%s' 'new-password' | node prisma/reset-admin.mjs \
 *     --email admin@example.com --password-stdin
 *
 * The installer's "Reset the admin password" action runs this inside the app
 * container (`docker compose exec -T app node prisma/reset-admin.mjs …`); it is
 * equally safe to run by hand. Prefer --password-stdin: a password passed as an
 * argument is visible in `ps` output and shell history.
 *
 * Resetting also signs the account out everywhere and voids pending reset
 * links, so a leaked session or emailed link cannot be used afterwards.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 no longer auto-loads .env for standalone scripts.
try {
  process.loadEnvFile(".env");
} catch {
  // env vars provided by the environment
}
import bcrypt from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MIN_PASSWORD = 8;

const USAGE = `Reset an OpenHosting staff password.

Usage (from a source checkout: npm run db:reset-admin -- <options>):
  node prisma/reset-admin.mjs --list
  node prisma/reset-admin.mjs [--email <address>] (--password-stdin | --password <pw>)

Options:
  --email <address>   Account to reset. Defaults to the only staff account
                      when there is exactly one.
  --password-stdin    Read the new password from stdin (recommended).
  --password <pw>     New password as an argument (visible in ps — dev only).
  --disable-2fa       Also clear two-factor authentication on the account.
  --make-admin        Give the account the Administrator role.
  --list              List staff accounts and exit.
  -h, --help          Show this help.
`;

type Options = {
  email: string | null;
  password: string | null;
  passwordStdin: boolean;
  disable2fa: boolean;
  makeAdmin: boolean;
  list: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    email: null,
    password: null,
    passwordStdin: false,
    disable2fa: false,
    makeAdmin: false,
    list: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const [flag, inlineValue] = splitFlag(argv[i]);
    const value = () => {
      const v = inlineValue ?? argv[++i];
      if (v === undefined) fail(`${flag} needs a value.`);
      return v;
    };
    switch (flag) {
      case "--email":
        opts.email = value().trim().toLowerCase();
        break;
      case "--password":
        opts.password = value();
        break;
      case "--password-stdin":
        opts.passwordStdin = true;
        break;
      case "--disable-2fa":
        opts.disable2fa = true;
        break;
      case "--make-admin":
        opts.makeAdmin = true;
        break;
      case "--list":
        opts.list = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        fail(`Unknown option: ${argv[i]}`);
    }
  }
  return opts;
}

function splitFlag(arg: string): [string, string | undefined] {
  const eq = arg.indexOf("=");
  return eq === -1 ? [arg, undefined] : [arg.slice(0, eq), arg.slice(eq + 1)];
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  // Strip the single trailing newline a shell adds — passwords may contain
  // spaces, so nothing else is trimmed.
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

/** Staff = anyone with a role; those are the accounts that can sign in to /admin. */
function staffAccounts() {
  return db.user.findMany({
    where: { roleId: { not: null } },
    include: { role: true },
    orderBy: { createdAt: "asc" },
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(USAGE);
    return;
  }

  const staff = await staffAccounts();

  if (opts.list) {
    if (staff.length === 0) {
      console.log("No staff accounts yet — run the seed to create one.");
      return;
    }
    const width = Math.max(...staff.map((u) => u.email.length));
    console.log("Staff accounts:");
    for (const u of staff) {
      const name = `${u.firstName} ${u.lastName}`.trim();
      const twoFa = u.totpEnabledAt ? "2FA on" : "2FA off";
      console.log(`  ${u.email.padEnd(width)}  ${u.role?.name ?? "no role"}  ${name}  ${twoFa}`);
    }
    return;
  }

  // ── Which account ─────────────────────────────────────────────────────────
  let email = opts.email;
  if (!email) {
    if (staff.length === 1) {
      email = staff[0].email;
    } else if (staff.length === 0) {
      fail("No staff accounts exist. Run the seed first (node prisma/seed.mjs).");
    } else {
      fail(`--email is required (${staff.length} staff accounts — use --list to see them).`);
    }
  }

  const user = await db.user.findUnique({ where: { email }, include: { role: true } });
  if (!user) {
    console.error(`Error: no account with email ${email}.`);
    if (staff.length > 0) {
      console.error(`Staff accounts: ${staff.map((u) => u.email).join(", ")}`);
    }
    process.exit(1);
  }

  // ── New password ──────────────────────────────────────────────────────────
  let password = opts.password;
  if (opts.passwordStdin) password = await readStdin();
  if (password === null) fail("Provide the new password with --password-stdin or --password.");
  if (password.length < MIN_PASSWORD) {
    fail(`Password must be at least ${MIN_PASSWORD} characters.`);
  }

  let roleId = user.roleId;
  const perms = (user.role?.permissions ?? []) as string[];
  if (opts.makeAdmin && !perms.includes("*")) {
    const adminRole = await db.role.upsert({
      where: { name: "Administrator" },
      update: {},
      create: { name: "Administrator", permissions: ["*"] },
    });
    roleId = adminRole.id;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(password, 10),
      roleId,
      ...(opts.disable2fa ? { totpSecret: null, totpEnabledAt: null } : {}),
    },
  });

  // Sign the account out everywhere and void any pending reset links.
  const { count: sessions } = await db.session.deleteMany({ where: { userId: user.id } });
  await db.verificationToken.deleteMany({
    where: { userId: user.id, type: { in: ["PASSWORD_RESET", "TWO_FACTOR"] } },
  });

  await db.auditLog.create({
    data: {
      action: "auth.password_reset",
      userId: user.id,
      targetType: "user",
      targetId: user.id,
      metadata: {
        via: "cli",
        disabled2fa: opts.disable2fa,
        grantedAdmin: roleId !== user.roleId,
      },
    },
  });

  console.log(`Password updated for ${user.email}.`);
  if (roleId !== user.roleId) console.log("  Granted the Administrator role.");
  if (opts.disable2fa && user.totpEnabledAt) console.log("  Two-factor authentication disabled.");
  if (sessions > 0) console.log(`  Signed out of ${sessions} active session(s).`);
  if (!roleId) console.log("  Note: this account has no staff role — it signs in to the client area.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

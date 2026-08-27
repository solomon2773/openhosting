import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Service, User } from "@/generated/prisma/client";
import { getServerDriver } from "@/lib/extensions/registry";
import type { ConfigField, ServerDriver } from "@/lib/extensions/types";

type CertificationFixture = {
  config: Record<string, string>;
  productConfig: Record<string, string>;
  user?: Partial<Pick<User, "id" | "email" | "firstName" | "lastName">>;
  service?: {
    config?: Array<{ option?: string; envKey?: string; value: string }>;
    cycle?: Service["cycle"];
    price?: number;
    currency?: string;
    quantity?: number;
  };
};

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function requiredFields(
  fields: ConfigField[],
  values: Record<string, string>,
): string[] {
  return fields
    .filter((field) => field.required && !values[field.key]?.trim())
    .map((field) => field.key);
}

function assertFixture(value: unknown): asserts value is CertificationFixture {
  if (!value || typeof value !== "object") {
    throw new Error("The fixture must be a JSON object.");
  }
  const fixture = value as Partial<CertificationFixture>;
  if (!fixture.config || typeof fixture.config !== "object") {
    throw new Error("The fixture must contain a config object.");
  }
  if (!fixture.productConfig || typeof fixture.productConfig !== "object") {
    throw new Error("The fixture must contain a productConfig object.");
  }
}

function certificationService(
  fixture: CertificationFixture,
): Service & { user: User } {
  const createdAt = new Date();
  const userId = fixture.user?.id ?? `cert-user-${createdAt.getTime()}`;
  return {
    id: `cert-service-${createdAt.getTime()}`,
    userId,
    productId: "certification-product",
    orderId: null,
    status: "ACTIVE",
    cycle: fixture.service?.cycle ?? "MONTHLY",
    price: fixture.service?.price ?? 1,
    currency: fixture.service?.currency ?? "USD",
    quantity: fixture.service?.quantity ?? 1,
    config: fixture.service?.config ?? [],
    externalId: null,
    expiresAt: null,
    suspendedAt: null,
    cancelledAt: null,
    cancelAtPeriodEnd: false,
    resaleData: null,
    createdAt,
    updatedAt: createdAt,
    user: {
      id: userId,
      email: fixture.user?.email ?? "driver-certification@example.test",
      password: "not-used",
      firstName: fixture.user?.firstName ?? "Driver",
      lastName: fixture.user?.lastName ?? "Certification",
      companyName: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      country: null,
      phone: null,
      credits: 0,
      currency: null,
      vatId: null,
      vatValidatedAt: null,
      referredByAffiliateId: null,
      emailVerifiedAt: createdAt,
      totpSecret: null,
      totpEnabledAt: null,
      roleId: null,
      createdAt,
      updatedAt: createdAt,
    },
  } as unknown as Service & { user: User };
}

async function stage(name: string, operation: () => Promise<unknown>) {
  const startedAt = Date.now();
  await operation();
  return { name, durationMs: Date.now() - startedAt, status: "passed" };
}

async function certify(
  driver: ServerDriver,
  fixture: CertificationFixture,
): Promise<void> {
  const missingConfig = requiredFields(driver.configFields, fixture.config);
  const missingProductConfig = requiredFields(
    driver.productConfigFields,
    fixture.productConfig,
  );
  if (missingConfig.length || missingProductConfig.length) {
    throw new Error(
      [
        missingConfig.length
          ? `Missing config fields: ${missingConfig.join(", ")}`
          : "",
        missingProductConfig.length
          ? `Missing productConfig fields: ${missingProductConfig.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const service = certificationService(fixture);
  const results: Array<{ name: string; durationMs: number; status: string }> = [];
  let created = false;
  let terminated = false;
  try {
    let externalId: string | null = null;
    results.push(
      await stage("create", async () => {
        externalId = await driver.create(
          service,
          fixture.config,
          fixture.productConfig,
        );
        if (!externalId) throw new Error("create returned no external id");
        service.externalId = externalId;
        created = true;
      }),
    );
    results.push(
      await stage("suspend", () => driver.suspend(service, fixture.config)),
    );
    results.push(
      await stage("unsuspend", () => driver.unsuspend(service, fixture.config)),
    );
    results.push(
      await stage("terminate", () => driver.terminate(service, fixture.config)),
    );
    terminated = true;
  } finally {
    if (created && !terminated) {
      await driver.terminate(service, fixture.config).catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Cleanup failed: ${detail}\n`);
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify({ driver: driver.slug, status: "passed", results }, null, 2)}\n`,
  );
}

async function main(): Promise<void> {
  const slug = argument("--driver");
  const fixturePath = argument("--fixture");
  if (!slug || !fixturePath || !process.argv.includes("--confirm-live-lifecycle")) {
    throw new Error(
      "Usage: npm run certify:server -- --driver <slug> --fixture <path> --confirm-live-lifecycle",
    );
  }
  const driver = getServerDriver(slug);
  if (!driver) throw new Error(`Unknown server driver: ${slug}`);

  const fixture = JSON.parse(
    await readFile(resolve(fixturePath), "utf8"),
  ) as unknown;
  assertFixture(fixture);
  await certify(driver, fixture);
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Certification failed: ${detail}\n`);
  process.exitCode = 1;
});

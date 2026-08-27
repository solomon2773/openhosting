import { describe, expect, test } from "vitest";
import {
  decodeX402Header,
  encodeX402Header,
  paymentPayloadMatches,
  x402Requirements,
} from "@/lib/x402";

const config = {
  facilitator_url: "https://facilitator.example",
  network: "eip155:8453",
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  pay_to: "0x1111111111111111111111111111111111111111",
};

test("builds exact USDC requirements in atomic units", () => {
  expect(
    x402Requirements({ total: { toString: () => "1.010000" }, currency: "USDC" }, config),
  ).toMatchObject({
    scheme: "exact",
    network: "eip155:8453",
    amount: "1010000",
  });
});

describe("x402 header validation", () => {
  test("round trips base64 JSON and binds it to the exact resource and terms", () => {
    const requirements = x402Requirements(
      { total: { toString: () => "2.5" }, currency: "USDC" },
      config,
    );
    const payload = {
      x402Version: 2,
      resource: { url: "https://merchant.example/api/x402/invoices/one" },
      accepted: requirements,
      payload: { signature: "0xabc" },
    };
    const decoded = decodeX402Header(encodeX402Header(payload));
    expect(
      paymentPayloadMatches(
        decoded,
        "https://merchant.example/api/x402/invoices/one",
        requirements,
      ),
    ).toBe(true);
  });

  test("rejects payloads rebound to another invoice or amount", () => {
    const requirements = x402Requirements(
      { total: { toString: () => "2.5" }, currency: "USDC" },
      config,
    );
    expect(
      paymentPayloadMatches(
        {
          x402Version: 2,
          resource: { url: "https://merchant.example/api/x402/invoices/two" },
          accepted: { ...requirements, amount: "1" },
        },
        "https://merchant.example/api/x402/invoices/one",
        requirements,
      ),
    ).toBe(false);
  });
});

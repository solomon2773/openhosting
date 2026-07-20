import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notFoundJson, withApiKey } from "@/lib/api-auth";
import { markInvoicePaid } from "@/lib/billing";

export const GET = withApiKey("invoices:read", async (_request, { params }) => {
  const invoice = await db.invoice.findUnique({
    where: { id: params.id },
    include: { user: true, items: true, payments: true },
  });
  if (!invoice) return notFoundJson();
  return NextResponse.json({
    data: {
      id: invoice.id,
      number: invoice.number,
      user_id: invoice.userId,
      user_email: invoice.user.email,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      due_at: invoice.dueAt,
      paid_at: invoice.paidAt,
      items: invoice.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: Number(i.unitPrice),
      })),
      payments: invoice.payments.map((p) => ({
        gateway: p.gateway,
        amount: Number(p.amount),
        status: p.status,
        transaction_id: p.transactionId,
      })),
    },
  });
});

// Mark an invoice paid (manual/off-platform payment).
export const POST = withApiKey("invoices:write", async (_request, { params }) => {
  const invoice = await db.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return notFoundJson();
  if (invoice.status !== "PENDING") {
    return NextResponse.json(
      { error: "Invoice is not payable" },
      { status: 400 },
    );
  }
  await markInvoicePaid(params.id, "api");
  return NextResponse.json({ data: { paid: true } });
});

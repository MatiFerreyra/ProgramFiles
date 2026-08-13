import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(request: Request) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ ok: false }, { status: 503 });
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const paymentId = String(body?.data?.id || body?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
  if (!paymentId) return NextResponse.json({ ok: true });

  const mp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!mp.ok) return NextResponse.json({ ok: false }, { status: 400 });
  const payment = await mp.json();
  if (payment.status !== "approved" || !payment.external_reference) return NextResponse.json({ ok: true });
  const external = String(payment.external_reference);
  if (!external.startsWith("programfiles-sub-")) return NextResponse.json({ ok: true });
  const subscriptionId = external.slice("programfiles-sub-".length);
  const admin = getSupabaseAdmin();
  const { data: sub } = await admin.from("subscriptions").select("*").eq("id", subscriptionId).maybeSingle();
  if (!sub) return NextResponse.json({ ok: true });
  const base = sub.due_date && new Date(sub.due_date) > new Date() ? new Date(sub.due_date) : new Date();
  base.setMonth(base.getMonth() + 1);
  const nextDue = base.toISOString().slice(0, 10);
  await admin.from("subscriptions").update({ status: "active", last_paid_at: new Date().toISOString(), due_date: nextDue, updated_at: new Date().toISOString() }).eq("id", sub.id);
  await admin.from("tenant_settings").update({ status: "active", updated_at: new Date().toISOString() }).eq("tenant_id", sub.tenant_id).neq("status", "archived");
  await admin.from("invoices").insert({ tenant_id: sub.tenant_id, subscription_id: sub.id, period: new Date().toISOString().slice(0,7), amount: Number(payment.transaction_amount || sub.monthly_price || sub.mrr || 0), currency: payment.currency_id || sub.currency || "ARS", status: "paid", payment_url: sub.payment_url, paid_at: new Date().toISOString() });
  await admin.from("audit_logs").insert({ tenant_id: sub.tenant_id, action: "payment_approved", table_name: "subscriptions", record_id: sub.id, new_data: { payment_id: paymentId, amount: payment.transaction_amount, next_due_date: nextDue } });
  return NextResponse.json({ ok: true });
}

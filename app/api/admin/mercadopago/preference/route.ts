import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../../lib/api-auth";

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ error: "Configurá MERCADOPAGO_ACCESS_TOKEN en Vercel/.env.local" }, { status: 501 });
  const { subscription_id } = await request.json().catch(() => ({}));
  if (!subscription_id) return NextResponse.json({ error: "subscription_id requerido" }, { status: 400 });

  const { data: subscription, error } = await auth.admin.from("subscriptions").select("*").eq("id", subscription_id).single();
  if (error || !subscription) return NextResponse.json({ error: error?.message || "Suscripción no encontrada" }, { status: 404 });
  const [{ data: tenant }, { data: settings }] = await Promise.all([
    auth.admin.from("tenants").select("name,slug").eq("id", subscription.tenant_id).single(),
    auth.admin.from("tenant_settings").select("owner_email,owner_name").eq("tenant_id", subscription.tenant_id).maybeSingle(),
  ]);
  const price = Number(subscription.monthly_price || subscription.mrr || 0);
  if (!(price > 0)) return NextResponse.json({ error: "Configurá un precio mensual mayor a cero" }, { status: 400 });
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const externalReference = `programfiles-sub-${subscription.id}`;
  const payload: Record<string, unknown> = {
    items: [{ id: subscription.id, title: `ProgramFiles - ${tenant?.name || "Suscripción"}`, quantity: 1, currency_id: subscription.currency || "ARS", unit_price: price }],
    external_reference: externalReference,
    payer: settings?.owner_email ? { email: settings.owner_email, name: settings.owner_name || undefined } : undefined,
  };
  if (appUrl) {
    payload.back_urls = { success: `${appUrl}/?payment=success`, pending: `${appUrl}/?payment=pending`, failure: `${appUrl}/?payment=failure` };
    payload.notification_url = `${appUrl}/api/webhooks/mercadopago`;
    payload.auto_return = "approved";
  }
  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) return NextResponse.json({ error: data?.message || "Mercado Pago rechazó la preferencia", details: data }, { status: response.status });
  const url = data.init_point || data.sandbox_init_point;
  await auth.admin.from("subscriptions").update({ payment_url: url, external_reference: externalReference, updated_at: new Date().toISOString() }).eq("id", subscription.id);
  await auth.admin.from("audit_logs").insert({ tenant_id: subscription.tenant_id, actor_user_id: auth.user.id, action: "create_payment_link", table_name: "subscriptions", record_id: subscription.id, new_data: { payment_url: url, external_reference: externalReference } });
  return NextResponse.json({ ok: true, payment_url: url, preference_id: data.id });
}

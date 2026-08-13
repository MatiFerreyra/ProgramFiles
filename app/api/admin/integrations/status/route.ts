import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../../lib/api-auth";

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({
    mercadopago: Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN),
    whatsapp: Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_ACCESS_TOKEN),
    arca: Boolean(process.env.ARCA_CUIT && process.env.ARCA_CERT_BASE64 && process.env.ARCA_PRIVATE_KEY_BASE64 && process.env.ARCA_POINT_OF_SALE),
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN || null,
  });
}

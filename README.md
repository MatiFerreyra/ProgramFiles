# ProgramFiles — versión final multiempresa

Plataforma SaaS con Next.js 16 + Supabase + Vercel para administrar múltiples empresas desde una consola CEO y entregar un panel aislado a cada cliente.

## Qué queda implementado

### ProgramFiles / CEO
- Login con Supabase Auth.
- Primer usuario autenticado puede reclamar el rol de Super Admin una sola vez.
- Dashboard de empresas, MRR, vencimientos y soporte.
- Alta, edición, suspensión, archivo y eliminación de empresas.
- Logo en Supabase Storage, colores, rubro, datos del dueño y dominio personalizado.
- Catálogo de módulos por empresa.
- Plan, precio mensual, vencimiento, días de gracia y suspensión automática.
- Presupuestos comerciales de ProgramFiles.
- Auditoría de cambios sensibles.
- Links de pago Mercado Pago cuando se configura el Access Token.
- Avisos manuales por WhatsApp con mensaje y link de pago.
- Estado de integraciones y checklist de producción.

### Panel de cada empresa
- Login individual.
- Aislamiento real por empresa mediante RLS.
- Roles: Dueño, Administrador, Encargado, Ventas, Caja, Depósito, Recepción y Solo lectura.
- Usuarios/empleados creados desde el propio panel.
- Dashboard con estadísticas reales.
- Clientes.
- Inventario.
- Ventas.
- Presupuestos.
- Caja.
- Agenda / turnos.
- Proveedores.
- Usuarios y roles.
- Reportes.
- Los módulos deshabilitados no aparecen.
- Los permisos de escritura se validan también en la base de datos, no solo en el frontend.

### SaaS / infraestructura
- RLS multi-tenant con `tenant_id`.
- Auditoría en PostgreSQL.
- Storage para logos.
- Cron diario para facturas pendientes, mora y suspensión automática.
- Webhook de Mercado Pago que reactiva la cuenta al acreditar el pago.
- Wildcard subdomains: `cliente.programfiles.com.ar`.
- Soporte para dominio personalizado cuando el dominio ya apunta al mismo proyecto de Vercel.
- Security headers y CSP.
- Pantallas de error, loading y 404.

## 1. Copiar variables de entorno

Copiá tu `.env.local` anterior y agregá las variables nuevas usando `.env.example` como referencia.

Obligatorias para la versión completa:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://programfiles.com.ar
NEXT_PUBLIC_ROOT_DOMAIN=programfiles.com.ar
```

`SUPABASE_SERVICE_ROLE_KEY` es estrictamente server-side. Nunca la nombres con `NEXT_PUBLIC_` ni la muestres en el navegador.

Opcional para cobros automáticos:

```env
MERCADOPAGO_ACCESS_TOKEN=
```

Variables preparadas para futuras automatizaciones externas:

```env
WHATSAPP_API_URL=
WHATSAPP_ACCESS_TOKEN=
ARCA_CUIT=
ARCA_POINT_OF_SALE=
ARCA_CERT_BASE64=
ARCA_PRIVATE_KEY_BASE64=
```

## 2. Ejecutar la migración de Supabase

Abrí **Supabase → SQL Editor**, pegá y ejecutá:

`supabase/programfiles_schema.sql`

La migración no borra las tablas existentes. Agrega el modelo de permisos, RLS, auditoría, Storage, facturación y automatización.

Después iniciá sesión con tu cuenta CEO. Si todavía no existe ningún Super Admin, esa primera cuenta autenticada se registra como administrador global.

## 3. Probar localmente

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`.

También podés validar TypeScript:

```bash
npx tsc --noEmit
```

## 4. Configurar Vercel

En **Project → Settings → Environment Variables**, cargá las mismas variables del `.env.local`.

Para subdominios de clientes, agregá un wildcard domain como:

`*.programfiles.com.ar`

Una sola deployment sirve a todos los clientes. `proxy.ts` detecta el hostname y sirve la empresa correspondiente.

Los dominios personalizados deben agregarse también al proyecto de Vercel y cargarse en la ficha de la empresa dentro de ProgramFiles.

## 5. Mercado Pago

Con `MERCADOPAGO_ACCESS_TOKEN` configurado, desde **Suscripciones y cobros** podés generar una preferencia de Checkout Pro. El webhook incluido actualiza el pago, mueve el vencimiento al mes siguiente y reactiva una empresa suspendida.

Probalo primero con las herramientas/cuentas de prueba de Mercado Pago antes de cobrar en producción.

## 6. WhatsApp

El panel ya genera un enlace `wa.me` con un recordatorio, vencimiento, importe y link de pago. Esto funciona sin API.

La automatización por WhatsApp Business/Cloud API queda preparada mediante variables de entorno, pero debe configurarse con las credenciales y reglas de plantillas de tu proveedor antes de enviar mensajes automáticos.

## 7. ARCA

La base de datos ya contempla facturas, CAE y número de comprobante, y el panel detecta si existen las credenciales fiscales. La emisión real con WSFEv1 requiere certificado, clave privada, CUIT, punto de venta y pruebas de homologación específicas del contribuyente. No se debe habilitar producción fiscal sin completar esa configuración y validarla en ARCA.

## Flujo recomendado de deployment

```bash
git add .
git commit -m "ProgramFiles SaaS secure multi-tenant"
git push
```

Antes de promover cambios grandes a Production, usá una rama o Pull Request para obtener un Preview Deployment de Vercel.

## Importante

No subas al repositorio:
- `.env.local`
- claves service role
- tokens de Mercado Pago
- certificados o claves privadas de ARCA
- tokens de WhatsApp

El archivo `.gitignore` debe mantener estas credenciales fuera de Git.

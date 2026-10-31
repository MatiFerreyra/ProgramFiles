# Activación segura del administrador inicial

Esta versión elimina el alta abierta del primer usuario autenticado. La consola CEO solo se habilita para el correo definido en la variable de servidor `PLATFORM_ADMIN_EMAIL`.

## Pasos únicos

1. En Supabase Authentication, creá o invitá tu usuario administrador con el correo que vas a usar.
2. En Vercel → Project → Settings → Environment Variables, cargá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (solo servidor)
   - `PLATFORM_ADMIN_EMAIL` (tu correo de administrador)
   - las variables de dominio que ya indica el README.
3. Ejecutá `supabase/programfiles_schema.sql` en Supabase SQL Editor si todavía no se ejecutó.
4. Desplegá esta rama. Iniciá sesión en `/login` con el correo configurado; al ingresar por primera vez, el servidor registra esa cuenta en `platform_admins`.
5. Abrí `/` para la consola CEO y usá **Nueva empresa**.

No subas estas variables a Git ni las pongas en el navegador. La variable `PLATFORM_ADMIN_EMAIL` no se expone al cliente.

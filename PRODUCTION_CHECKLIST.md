# Checklist de salida a producción

- [ ] Ejecutar `supabase/programfiles_schema.sql`.
- [ ] Confirmar que la cuenta CEO aparece en `platform_admins`.
- [ ] Crear una empresa de prueba y un usuario Dueño.
- [ ] Verificar que el dueño NO puede consultar otra empresa.
- [ ] Verificar roles de Ventas, Caja, Depósito y Recepción.
- [ ] Subir un logo y confirmar que aparece desde otra computadora.
- [ ] Configurar `SUPABASE_SERVICE_ROLE_KEY` únicamente en Vercel Server Environment.
- [ ] Probar suspensión manual y reactivación.
- [ ] Probar vencimiento automático con una empresa de prueba.
- [ ] Probar Checkout Pro con cuenta de prueba de Mercado Pago.
- [ ] Confirmar recepción del webhook de Mercado Pago.
- [ ] Configurar wildcard `*.programfiles.com.ar` en Vercel/DNS.
- [ ] Probar un subdominio real de cliente.
- [ ] Verificar CSP y que Supabase siga conectando en Production.
- [ ] Revisar Audit Logs después de crear/editar/eliminar datos.
- [ ] Habilitar backups de Supabase según el plan contratado.
- [ ] Probar restauración de backup antes de depender comercialmente del sistema.
- [ ] Validar ARCA en homologación antes de emitir comprobantes reales.

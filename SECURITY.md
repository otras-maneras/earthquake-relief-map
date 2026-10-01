# Seguridad / Security

El proyecto está **archivado y sin mantenimiento activo**. Si lo despliegas:

- Genera tu propio `JWT_SECRET` y no reutilices ninguna clave de este repo o de su historia.
- Crea tu superadmin con `npm run db:seed` / `npm run db:reset-admin` y una contraseña propia.
- Mantén las salvaguardas de PII (enmascarado de cédulas, sin ubicación de menores) y
  ejecuta `npm run check:pii` antes de cada despliegue.
- Reporta vulnerabilidades abriendo un *private security advisory* en GitHub.

# Guía de colaboración

Cómo trabajar en este repositorio de forma segura y ordenada. Aplica a humanos y a
agentes de IA por igual.

## Contexto que hay que tener presente

- **Esto es una aplicación de emergencia en producción.** Hay usuarios reales buscando
  personas y ayuda. Un despliegue roto tiene costo humano, no solo técnico.
- **Maneja datos sensibles (PII).** Personas desaparecidas, cédulas, contactos. Las
  salvaguardas existentes (enmascarado de cédulas, sin GPS exacto de personas, menores
  sin ubicación, cifras de personas fuera del contenido SEO) no se relajan sin decisión
  explícita del responsable del proyecto.
- **La rama `main` es la base de los despliegues.** Nunca se trabaja directo sobre ella.

## Flujo de trabajo

1. **Rama por tarea**, partiendo de `main` actualizado:
   `feature/<tema>`, `fix/<tema>` o `docs/<tema>`.
2. **Commits**: convención `tipo(alcance): resumen` en minúsculas
   (ej. `feat(busquedas): unifica /busqueda-avanzada dentro de /busquedas`).
   Un commit por cambio coherente; el cuerpo explica el porqué, no el cómo.
3. **Antes de dar por terminado cualquier cambio**:

   ```bash
   npm run build        # desde la raíz: compila apps/web (necesita Postgres)
   npm run typecheck    # debe salir limpio
   ```

   Si el cambio toca UI, verificarla de verdad (navegador o captura), no solo el build.
4. **Pull request hacia `main`** con descripción de qué cambia y cómo se verificó.
   No se hace merge del propio PR sin revisión de otra persona, salvo acuerdo explícito.
5. **El deploy a producción lo ejecuta quien opera el servidor**, no forma parte del PR.
   Mergear a `main` no despliega nada por sí solo.

## Reglas duras

- **Secretos**: jamás commitear `.env`, credenciales, tokens ni dumps de datos. Los
  patrones ya están en `.gitignore` (`.env*`, `*.local.md`, `backups/`, `docs/internal/`,
  `/data-privado/`). Si un secreto llega a un commit, avisar de inmediato: hay que
  rotarlo, no basta con borrarlo.
- **Historia de git**: no hacer `push --force` ni resets sobre `main`. Las ramas
  propias se pueden reescribir mientras no estén en revisión.
- **Base de datos de producción**: ningún script escribe contra ella desde una rama de
  trabajo. Las cargas de datos (seeds en `apps/web/src/db/`) se coordinan con el
  responsable y se ejecutan aparte del ciclo de PR.
- **Datos de personas**: no agregar campos nuevos de salida en `/api/personas`,
  `/api/busqueda-avanzada` ni `/v1/personas` sin revisar las salvaguardas de PII
  (`docs/SEGURIDAD.md`). En la duda, exponer menos.
- **Comunicaciones** (campañas de correo/WhatsApp, bots): los destinatarios nunca se versionan;
  usa listas propias fuera del repositorio. Un envío mal hecho gasta cupos reales y llega a gente real.
- **Documentación**: sin emojis. En español neutro. Si un cambio altera arquitectura,
  rutas o modelo de datos, actualizar `docs/ARQUITECTURA.md` en el mismo PR.

## Qué verificar según lo que toques

| Si tocás... | Verificá... |
|---|---|
| `/busquedas` o `/api/busqueda-avanzada` | Que el mapa carga pines, los chips cuentan bien y la búsqueda por nombre y por cédula responde |
| `/api/personas` o fuentes externas | Que una fuente caída no tumba el endpoint (son tolerantes a fallos) |
| API pública `/v1` | Que no rompés el contrato (`/v1/openapi.json`); es consumida por terceros |
| Bots (wa-bot, telegram-bot) | El flujo completo con un mensaje de prueba; los webhooks verifican firma |
| `schema.ts` | Que `npm run db:push` sobre una DB local aplica limpio; nunca contra producción |
| SEO/JSON-LD | Que el HTML inicial (curl, sin JS) contiene el contenido; sin cifras agregadas de personas |
| Rendimiento del mapa | Lighthouse móvil antes/después; el mapa es el componente más pesado del sitio |

## Estructura de la documentación

- `README.md` — visión general y setup.
- `docs/ARQUITECTURA.md` — referencia técnica del sistema (mantener al día).
- `docs/SEGURIDAD.md` — modelo de seguridad y PII.
- `docs/FUENTES.md` — fuentes de datos e importaciones.
- `docs/MAPA-3D.md` — referencia del módulo `/mapa-3d`.
- `docs/auditorias/` — metodología (PLAYBOOK) y último reporte de auditoría.
- Datos con PII, `.env`, backups y contactos reales **nunca** se commitean (ver `.gitignore`).

## Convenciones de código

- TypeScript estricto; `tsc --noEmit` limpio es el mínimo aceptable.
- Seguir el estilo del archivo que se edita (nombres, densidad de comentarios, idioma:
  comentarios en español).
- Componentes de mapa client-only; el contenido SEO vive en el server component.
- Texto de búsqueda siempre por `normalizeSearchText` (`apps/web/src/lib/text.ts`).
- Inputs de escritura siempre validados con Zod (`apps/web/src/lib/validation.ts`).
- Endpoints públicos nuevos llevan rate-limit (`apps/web/src/lib/ratelimit.ts`) desde el día uno.

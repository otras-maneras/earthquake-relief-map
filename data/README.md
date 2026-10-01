# Datos abiertos / Open data — snapshot 2026-10-01

Regenerable con `scripts/generate-snapshots.sh` desde una instancia propia.

Instantánea final de los datos que servía `api.acopiove.org/v1`.

| Archivo | Contenido |
|---|---|
| `centros.json` / `.csv` / `.geojson` | 716 centros de acopio (664) y refugios (52), 22 países |
| `telefonos.json` / `.csv` | 78 líneas y brigadas de emergencia |

- **Licencia de los datos: CC-BY-4.0.** Atribución: "Datos: AcopioVE (acopiove.org)".
- Última actualización de los registros: 2026-07-30. **Pueden estar desactualizados**:
  el proyecto se cerró y nadie los verifica. Confirma por otra vía antes de depender de ellos.
- Se omitió el campo `responsable` (nombres de personas) y un correo personal en un contacto, respecto a lo que servía la API.
- Los datos de personas desaparecidas **nunca se almacenaron**: se consultaban en vivo a
  las organizaciones de origen. No hay snapshot de ellos.

## Calidad de los datos

El campo `pais` no está normalizado: hay `USA` junto a `Estados Unidos`, `venezuela` junto a `Venezuela`,
y un registro sin país. Contando valores únicos salen 25, pero los países reales son 22.
Normaliza antes de agrupar o filtrar por país.

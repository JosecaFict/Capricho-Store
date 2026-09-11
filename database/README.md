# Base de datos de Capricho Store

## Instalación nueva

Para una base PostgreSQL vacía se ejecuta **únicamente**:

```text
capricho_store_postgresql_completo_v2.sql
```

Este archivo es la fuente canónica: crea el esquema `capricho`, sus tablas,
restricciones, funciones, triggers, vistas, datos iniciales y todas las
correcciones v2. La ejecución está contenida en una sola transacción.

Ejemplo con PostgreSQL 17 en PowerShell:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  "CADENA_DE_CONEXION" `
  -v ON_ERROR_STOP=1 `
  -f ".\database\capricho_store_postgresql_completo_v2.sql"
```

No escribas una contraseña real dentro de scripts, Markdown o Git.

## Archivo histórico

`archive/capricho_store_correcciones_v2.sql` se conserva solamente para una
base antigua que hubiera sido creada con el SQL completo anterior a v2.

No debe ejecutarse después del archivo completo v2 actual, porque sus cambios
ya están integrados. Ejecutar ambos en una instalación nueva puede producir
errores por objetos que ya existen.

## Cambios sobre una base existente

Los scripts de `changes/` se aplican únicamente cuando la base ya fue creada
con el SQL completo. Antes de ejecutarlos en producción debe existir un respaldo
verificable. Usa `psql` con `ON_ERROR_STOP=1` y ejecuta cada archivo una sola vez;
los scripts están preparados para tolerar una repetición accidental.

El orden actual es:

1. `changes/20260909_ajustar_permisos_roles.sql`
2. `changes/20260909_cargar_marcas.sql`
3. `changes/20260909_cargar_colores.sql`
4. `changes/20260909_cargar_temporadas_colecciones.sql`
5. `changes/20260909_normalizar_codigos_barras_vacios.sql`
6. `changes/20260909_administrar_sucursales.sql`
7. `changes/20260911_asociar_sucursal_carrito.sql`

## Política

- FastAPI no crea las tablas.
- No se usa `Base.metadata.create_all()`.
- Alembic todavía no tiene una revisión baseline aprobada.
- Los cambios futuros deben documentarse y revisarse antes de generar una
  migración.
- Antes de modificar producción debe existir un respaldo verificable.

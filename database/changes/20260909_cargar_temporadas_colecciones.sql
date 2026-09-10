-- Temporadas y colecciones iniciales de Capricho Store.
-- Las inserciones comprueban nombre y año porque estas tablas no poseen una
-- restricción UNIQUE equivalente en el esquema actual.

BEGIN;
SET LOCAL search_path TO capricho, public;

INSERT INTO temporada(nombre, anio, fecha_inicio, fecha_fin)
SELECT 'Permanente', NULL, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM temporada WHERE nombre = 'Permanente' AND anio IS NULL
);

INSERT INTO temporada(nombre, anio, fecha_inicio, fecha_fin)
SELECT 'Otoño-Invierno 2026', 2026, DATE '2026-03-21', DATE '2026-09-20'
WHERE NOT EXISTS (
  SELECT 1 FROM temporada
  WHERE nombre = 'Otoño-Invierno 2026' AND anio = 2026
);

INSERT INTO temporada(nombre, anio, fecha_inicio, fecha_fin)
SELECT 'Primavera-Verano 2026-2027', 2026, DATE '2026-09-21', DATE '2027-03-20'
WHERE NOT EXISTS (
  SELECT 1 FROM temporada
  WHERE nombre = 'Primavera-Verano 2026-2027' AND anio = 2026
);

INSERT INTO coleccion(id_temporada, nombre, descripcion)
SELECT
  t.id_temporada,
  'Clásicos Esenciales',
  'Prendas clásicas y versátiles disponibles durante todo el año.'
FROM temporada t
WHERE t.nombre = 'Permanente'
  AND t.anio IS NULL
  AND NOT EXISTS (SELECT 1 FROM coleccion WHERE nombre = 'Clásicos Esenciales')
ORDER BY t.id_temporada
LIMIT 1;

INSERT INTO coleccion(id_temporada, nombre, descripcion)
SELECT
  t.id_temporada,
  'Deportiva Urbana',
  'Prendas deportivas y casuales para el uso cotidiano.'
FROM temporada t
WHERE t.nombre = 'Permanente'
  AND t.anio IS NULL
  AND NOT EXISTS (SELECT 1 FROM coleccion WHERE nombre = 'Deportiva Urbana')
ORDER BY t.id_temporada
LIMIT 1;

INSERT INTO coleccion(id_temporada, nombre, descripcion)
SELECT
  t.id_temporada,
  'Otoño-Invierno 2026',
  'Selección para la temporada de clima fresco de 2026.'
FROM temporada t
WHERE t.nombre = 'Otoño-Invierno 2026'
  AND t.anio = 2026
  AND NOT EXISTS (SELECT 1 FROM coleccion WHERE nombre = 'Otoño-Invierno 2026')
ORDER BY t.id_temporada
LIMIT 1;

INSERT INTO coleccion(id_temporada, nombre, descripcion)
SELECT
  t.id_temporada,
  'Primavera-Verano 2026-2027',
  'Selección para la temporada cálida 2026-2027.'
FROM temporada t
WHERE t.nombre = 'Primavera-Verano 2026-2027'
  AND t.anio = 2026
  AND NOT EXISTS (SELECT 1 FROM coleccion WHERE nombre = 'Primavera-Verano 2026-2027')
ORDER BY t.id_temporada
LIMIT 1;

COMMIT;

-- Verificación de temporadas.
SELECT id_temporada, nombre, anio, fecha_inicio, fecha_fin, activo
FROM capricho.temporada
WHERE nombre IN (
  'Permanente', 'Otoño-Invierno 2026', 'Primavera-Verano 2026-2027'
)
ORDER BY fecha_inicio NULLS FIRST, nombre;

-- Verificación de colecciones y su temporada.
SELECT c.id_coleccion, c.nombre AS coleccion, t.nombre AS temporada, c.activo
FROM capricho.coleccion c
LEFT JOIN capricho.temporada t ON t.id_temporada = c.id_temporada
WHERE c.nombre IN (
  'Clásicos Esenciales', 'Deportiva Urbana',
  'Otoño-Invierno 2026', 'Primavera-Verano 2026-2027'
)
ORDER BY c.nombre;

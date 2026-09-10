-- Normaliza variantes creadas sin código de barras antes de la corrección de API.
-- PostgreSQL permite varios NULL en una columna UNIQUE, pero no varias cadenas vacías.

BEGIN;

UPDATE capricho.variante_producto
SET codigo_barras = NULL,
    updated_at = NOW()
WHERE codigo_barras IS NOT NULL
  AND BTRIM(codigo_barras) = '';

COMMIT;

-- Verificación: debe devolver cero.
SELECT COUNT(*) AS codigos_barras_vacios
FROM capricho.variante_producto
WHERE codigo_barras IS NOT NULL
  AND BTRIM(codigo_barras) = '';

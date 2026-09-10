-- Permite una galería independiente por color sin eliminar imágenes existentes.
SET search_path TO capricho, public;

ALTER TABLE imagen_producto
  ADD COLUMN IF NOT EXISTS id_color BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_imagen_producto_color'
      AND conrelid = 'capricho.imagen_producto'::regclass
  ) THEN
    ALTER TABLE imagen_producto
      ADD CONSTRAINT fk_imagen_producto_color
      FOREIGN KEY (id_color) REFERENCES color(id_color) ON DELETE RESTRICT;
  END IF;
END $$;

-- Conserva las imágenes ya cargadas y las asocia automáticamente cuando el
-- producto solo tiene un color inequívoco.
WITH producto_color_unico AS (
  SELECT id_producto, MIN(id_color) AS id_color
  FROM variante_producto
  GROUP BY id_producto
  HAVING COUNT(DISTINCT id_color) = 1
)
UPDATE imagen_producto i
SET id_color = pcu.id_color
FROM producto_color_unico pcu
WHERE i.id_producto = pcu.id_producto
  AND i.id_color IS NULL;

DROP INDEX IF EXISTS uq_imagen_principal_producto;

CREATE UNIQUE INDEX IF NOT EXISTS uq_imagen_principal_producto_color
  ON imagen_producto(id_producto, id_color)
  WHERE es_principal = TRUE AND id_color IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_imagen_principal_producto_generica
  ON imagen_producto(id_producto)
  WHERE es_principal = TRUE AND id_color IS NULL;

CREATE INDEX IF NOT EXISTS idx_imagen_producto_color
  ON imagen_producto(id_producto, id_color, orden);

-- Ajuste puntual del producto de prueba para que el color viva en sus variantes.
UPDATE producto p
SET nombre = 'Polo Ralph Lauren Classic Fit',
    updated_at = NOW()
FROM marca m
WHERE p.id_marca = m.id_marca
  AND LOWER(m.nombre) = LOWER('Ralph Lauren')
  AND LOWER(p.nombre) = LOWER('Polo Ralph Lauren Classic Fit azul marino');

-- Paleta inicial de colores para las variantes de Capricho Store.
-- Solo crea los colores ausentes; no sobrescribe registros ya administrados.

BEGIN;
SET LOCAL search_path TO capricho, public;

INSERT INTO color(nombre, codigo_hex) VALUES
('Negro','#000000'),
('Blanco','#FFFFFF'),
('Gris','#808080'),
('Azul marino','#1F2A44'),
('Azul','#0057B8'),
('Celeste','#87CEEB'),
('Rojo','#C62828'),
('Verde','#2E7D32'),
('Beige','#D6C6A5'),
('Marrón','#795548'),
('Rosado','#E78DA7'),
('Morado','#6A1B9A'),
('Amarillo','#FBC02D'),
('Naranja','#EF6C00')
ON CONFLICT(nombre) DO NOTHING;

COMMIT;

-- Verificación: debe listar los catorce colores activos o ya existentes.
SELECT id_color, nombre, codigo_hex, activo
FROM capricho.color
WHERE nombre IN (
  'Negro', 'Blanco', 'Gris', 'Azul marino', 'Azul', 'Celeste', 'Rojo',
  'Verde', 'Beige', 'Marrón', 'Rosado', 'Morado', 'Amarillo', 'Naranja'
)
ORDER BY nombre;

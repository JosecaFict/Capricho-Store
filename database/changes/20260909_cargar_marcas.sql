-- Catálogo inicial de marcas reales consideradas para Capricho Store.
-- Solo crea las marcas ausentes; no sobrescribe registros ya administrados.

BEGIN;
SET LOCAL search_path TO capricho, public;

INSERT INTO marca(nombre, descripcion, pais_origen) VALUES
('Nike','Ropa deportiva y urbana de alto rendimiento.','Estados Unidos'),
('Adidas','Ropa deportiva y urbana reconocida por sus tres franjas.','Alemania'),
('H&M','Prendas básicas y de tendencia para el uso diario.','Suecia'),
('Uniqlo','Prendas minimalistas centradas en calidad y funcionalidad.','Japón'),
('Tommy Hilfiger','Moda casual y formal de inspiración clásica.','Estados Unidos'),
('Zara','Moda contemporánea con propuestas de temporada.','España'),
('Ralph Lauren','Moda clásica y elegante de inspiración deportiva.','Estados Unidos'),
('Pull&Bear','Moda casual y juvenil de estilo relajado.','España'),
('Mango','Moda urbana de línea contemporánea y sofisticada.','España'),
('Bershka','Moda juvenil con propuestas actuales y atrevidas.','España'),
('Lacoste','Moda deportiva y casual reconocida por el polo de piqué.','Francia')
ON CONFLICT(nombre) DO NOTHING;

COMMIT;

-- Verificación: debe listar las once marcas activas o ya existentes.
SELECT nombre, pais_origen, activo
FROM capricho.marca
WHERE nombre IN (
  'Nike', 'Adidas', 'H&M', 'Uniqlo', 'Tommy Hilfiger', 'Zara',
  'Ralph Lauren', 'Pull&Bear', 'Mango', 'Bershka', 'Lacoste'
)
ORDER BY nombre;

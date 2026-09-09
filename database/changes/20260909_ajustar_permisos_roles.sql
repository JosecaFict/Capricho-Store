-- Ajusta el alcance heredado del rol AUXILIAR_INVENTARIO.
-- Conserva inventario, movimientos y recepciones; catálogo público sigue
-- disponible sin conceder acceso administrativo a productos o proveedores.

BEGIN;
SET LOCAL search_path TO capricho, public;

DELETE FROM rol_permiso rp
USING rol r, permiso p
WHERE rp.id_rol = r.id_rol
  AND rp.id_permiso = p.id_permiso
  AND r.nombre = 'AUXILIAR_INVENTARIO'
  AND p.codigo IN ('productos.ver', 'proveedores.ver');

INSERT INTO rol_permiso(id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p
  ON p.codigo IN ('inventario.ver', 'inventario.movimiento', 'recepcion.registrar')
WHERE r.nombre = 'AUXILIAR_INVENTARIO'
ON CONFLICT(id_rol, id_permiso) DO NOTHING;

COMMIT;

-- Verificación: debe devolver exactamente los tres permisos heredados esperados.
SELECT r.nombre AS rol, p.codigo AS permiso
FROM capricho.rol r
JOIN capricho.rol_permiso rp ON rp.id_rol = r.id_rol
JOIN capricho.permiso p ON p.id_permiso = rp.id_permiso
WHERE r.nombre = 'AUXILIAR_INVENTARIO'
ORDER BY p.codigo;

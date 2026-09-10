-- Habilita la administración de sucursales en una base existente.
-- ADMIN puede ver, crear y editar. ENCARGADO_SUCURSAL puede consultar.

BEGIN;
SET LOCAL search_path TO capricho, public;

INSERT INTO permiso(codigo, nombre, modulo) VALUES
('sucursales.ver', 'Ver sucursales', 'ORGANIZACION'),
('sucursales.crear', 'Crear sucursales', 'ORGANIZACION'),
('sucursales.editar', 'Editar sucursales', 'ORGANIZACION')
ON CONFLICT(codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    modulo = EXCLUDED.modulo,
    activo = TRUE,
    updated_at = NOW();

INSERT INTO rol_permiso(id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
CROSS JOIN permiso p
WHERE r.nombre = 'ADMIN'
  AND p.codigo IN ('sucursales.ver', 'sucursales.crear', 'sucursales.editar')
ON CONFLICT(id_rol, id_permiso) DO NOTHING;

INSERT INTO rol_permiso(id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM rol r
JOIN permiso p ON p.codigo = 'sucursales.ver'
WHERE r.nombre = 'ENCARGADO_SUCURSAL'
ON CONFLICT(id_rol, id_permiso) DO NOTHING;

DROP TRIGGER IF EXISTS audit_sucursal ON sucursal;
CREATE TRIGGER audit_sucursal
AFTER INSERT OR UPDATE OR DELETE ON sucursal
FOR EACH ROW
EXECUTE FUNCTION fn_bitacora_generica('ORGANIZACION', 'id_sucursal');

COMMIT;

-- Verificación: ADMIN debe tener 3 permisos y ENCARGADO_SUCURSAL solo sucursales.ver.
SELECT r.nombre AS rol, p.codigo AS permiso
FROM capricho.rol r
JOIN capricho.rol_permiso rp ON rp.id_rol = r.id_rol
JOIN capricho.permiso p ON p.id_permiso = rp.id_permiso
WHERE p.codigo LIKE 'sucursales.%'
ORDER BY r.nombre, p.codigo;

-- ============================================================================
-- CAPRICHO STORE - CORRECCIONES INCREMENTALES V2
-- PostgreSQL 16+
--
-- Aplicar DESPUES de capricho_store_postgresql_completo.sql.
-- No elimina tablas ni datos. Toda la migracion es atomica: si alguna
-- validacion falla, PostgreSQL revierte todos los cambios de este archivo.
-- ============================================================================

BEGIN;
SET LOCAL search_path TO capricho, public;

-- ---------------------------------------------------------------------------
-- 1. CORREO UNICO SIN DISTINGUIR MAYUSCULAS/MINUSCULAS
-- ---------------------------------------------------------------------------
-- La migracion se detiene con un mensaje claro si ya existen duplicados.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM capricho.usuario
    GROUP BY LOWER(BTRIM(correo))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Existen correos duplicados ignorando mayusculas/minusculas. Corrijalos antes de aplicar la migracion.';
  END IF;
END;
$$;

DROP INDEX IF EXISTS capricho.idx_usuario_correo_lower;
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_correo_lower
  ON capricho.usuario (LOWER(BTRIM(correo)));

-- Normaliza automaticamente los nuevos correos y sus actualizaciones.
CREATE OR REPLACE FUNCTION capricho.fn_normalizar_correo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
BEGIN
  NEW.correo := LOWER(BTRIM(NEW.correo));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalizar_correo_usuario ON capricho.usuario;
CREATE TRIGGER trg_normalizar_correo_usuario
BEFORE INSERT OR UPDATE OF correo ON capricho.usuario
FOR EACH ROW EXECUTE FUNCTION capricho.fn_normalizar_correo_usuario();

-- ---------------------------------------------------------------------------
-- 2. UPDATED_AT FALTANTE EN PERMISO
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_permiso_updated_at ON capricho.permiso;
CREATE TRIGGER trg_permiso_updated_at
BEFORE UPDATE ON capricho.permiso
FOR EACH ROW EXECUTE FUNCTION capricho.fn_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. BITACORA: NO COPIAR PASSWORD_HASH
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION capricho.fn_bitacora_generica()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
DECLARE
  v_usuario BIGINT;
  v_ip INET;
  v_origen VARCHAR(10);
  v_id TEXT;
  v_old JSONB;
  v_new JSONB;
BEGIN
  BEGIN
    v_usuario := NULLIF(current_setting('app.usuario_id', TRUE), '')::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    v_usuario := NULL;
  END;

  BEGIN
    v_ip := NULLIF(current_setting('app.ip', TRUE), '')::INET;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  v_origen := NULLIF(current_setting('app.origen', TRUE), '');

  IF TG_OP <> 'INSERT' THEN
    v_old := to_jsonb(OLD);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new := to_jsonb(NEW);
  END IF;

  -- Nunca duplicar credenciales en la bitacora.
  IF TG_TABLE_NAME = 'usuario' THEN
    v_old := v_old - 'password_hash';
    v_new := v_new - 'password_hash';
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_id := COALESCE(v_new ->> TG_ARGV[1], '');
    INSERT INTO capricho.bitacora(
      id_usuario, id_sesion, accion, modulo, entidad, id_registro,
      datos_nuevos, direccion_ip, user_agent, origen, request_id
    ) VALUES (
      v_usuario, NULLIF(current_setting('app.sesion_id', TRUE), ''),
      TG_OP, TG_ARGV[0], TG_TABLE_NAME, v_id, v_new, v_ip,
      NULLIF(current_setting('app.user_agent', TRUE), ''),
      COALESCE(v_origen, 'SISTEMA'),
      NULLIF(current_setting('app.request_id', TRUE), '')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := COALESCE(v_new ->> TG_ARGV[1], '');
    INSERT INTO capricho.bitacora(
      id_usuario, id_sesion, accion, modulo, entidad, id_registro,
      datos_anteriores, datos_nuevos, direccion_ip, user_agent, origen, request_id
    ) VALUES (
      v_usuario, NULLIF(current_setting('app.sesion_id', TRUE), ''),
      TG_OP, TG_ARGV[0], TG_TABLE_NAME, v_id, v_old, v_new, v_ip,
      NULLIF(current_setting('app.user_agent', TRUE), ''),
      COALESCE(v_origen, 'SISTEMA'),
      NULLIF(current_setting('app.request_id', TRUE), '')
    );
    RETURN NEW;
  ELSE
    v_id := COALESCE(v_old ->> TG_ARGV[1], '');
    INSERT INTO capricho.bitacora(
      id_usuario, id_sesion, accion, modulo, entidad, id_registro,
      datos_anteriores, direccion_ip, user_agent, origen, request_id
    ) VALUES (
      v_usuario, NULLIF(current_setting('app.sesion_id', TRUE), ''),
      TG_OP, TG_ARGV[0], TG_TABLE_NAME, v_id, v_old, v_ip,
      NULLIF(current_setting('app.user_agent', TRUE), ''),
      COALESCE(v_origen, 'SISTEMA'),
      NULLIF(current_setting('app.request_id', TRUE), '')
    );
    RETURN OLD;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. INVENTARIO: MOVIMIENTOS INMUTABLES
-- ---------------------------------------------------------------------------
-- Las correcciones se realizan con un nuevo movimiento compensatorio.
CREATE OR REPLACE FUNCTION capricho.fn_bloquear_cambio_movimiento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION
    'Los movimientos de inventario son inmutables. Registre un movimiento compensatorio.';
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_cambio_movimiento ON capricho.movimiento_inventario;
CREATE TRIGGER trg_bloquear_cambio_movimiento
BEFORE UPDATE OR DELETE ON capricho.movimiento_inventario
FOR EACH ROW EXECUTE FUNCTION capricho.fn_bloquear_cambio_movimiento();

-- ---------------------------------------------------------------------------
-- 5. INVENTARIO: VALIDAR Y APLICAR EL DESGLOSE POR LOTES
-- ---------------------------------------------------------------------------
-- Contrato para operaciones fisicas:
--   1) Crear movimiento_inventario.
--   2) Crear uno o mas movimiento_lote en LA MISMA TRANSACCION.
-- Para ENTRADA_PROVEEDOR, crear previamente el lote con cantidad_disponible=0
-- y cantidad_inicial igual a lo recibido.

CREATE OR REPLACE FUNCTION capricho.fn_aplicar_movimiento_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
DECLARE
  v_tipo VARCHAR(30);
  v_id_sucursal BIGINT;
  v_id_variante BIGINT;
  v_lote_sucursal BIGINT;
  v_lote_variante BIGINT;
  v_disponible INTEGER;
  v_inicial INTEGER;
BEGIN
  SELECT m.tipo_movimiento, i.id_sucursal, i.id_variante
    INTO v_tipo, v_id_sucursal, v_id_variante
  FROM capricho.movimiento_inventario m
  JOIN capricho.inventario_sucursal i ON i.id_inventario = m.id_inventario
  WHERE m.id_movimiento = NEW.id_movimiento;

  SELECT id_sucursal, id_variante, cantidad_disponible, cantidad_inicial
    INTO v_lote_sucursal, v_lote_variante, v_disponible, v_inicial
  FROM capricho.lote_inventario
  WHERE id_lote = NEW.id_lote
  FOR UPDATE;

  IF v_lote_sucursal <> v_id_sucursal OR v_lote_variante <> v_id_variante THEN
    RAISE EXCEPTION 'El lote no corresponde a la sucursal y variante del movimiento';
  END IF;

  CASE v_tipo
    WHEN 'ENTRADA_PROVEEDOR', 'DEVOLUCION', 'AJUSTE_POSITIVO', 'TRANSFERENCIA_ENTRADA' THEN
      IF v_disponible + NEW.cantidad > v_inicial THEN
        RAISE EXCEPTION 'El movimiento supera la cantidad inicial del lote';
      END IF;
      UPDATE capricho.lote_inventario
      SET cantidad_disponible = cantidad_disponible + NEW.cantidad
      WHERE id_lote = NEW.id_lote;

    WHEN 'VENTA', 'VENTA_RESERVA', 'AJUSTE_NEGATIVO', 'TRANSFERENCIA_SALIDA' THEN
      IF v_disponible < NEW.cantidad THEN
        RAISE EXCEPTION 'Cantidad insuficiente en el lote %', NEW.id_lote;
      END IF;
      UPDATE capricho.lote_inventario
      SET cantidad_disponible = cantidad_disponible - NEW.cantidad
      WHERE id_lote = NEW.id_lote;

    ELSE
      RAISE EXCEPTION 'El movimiento % no utiliza desglose por lotes', v_tipo;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aplicar_movimiento_lote ON capricho.movimiento_lote;
CREATE TRIGGER trg_aplicar_movimiento_lote
BEFORE INSERT ON capricho.movimiento_lote
FOR EACH ROW EXECUTE FUNCTION capricho.fn_aplicar_movimiento_lote();

-- El desglose de un movimiento tampoco puede editarse o borrarse.
DROP TRIGGER IF EXISTS trg_bloquear_cambio_movimiento_lote ON capricho.movimiento_lote;
CREATE TRIGGER trg_bloquear_cambio_movimiento_lote
BEFORE UPDATE OR DELETE ON capricho.movimiento_lote
FOR EACH ROW EXECUTE FUNCTION capricho.fn_bloquear_cambio_movimiento();

-- Al confirmar la transaccion, la suma de lotes debe coincidir con el movimiento.
CREATE OR REPLACE FUNCTION capricho.fn_validar_desglose_lotes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
DECLARE
  v_id_movimiento BIGINT;
  v_tipo VARCHAR(30);
  v_cantidad INTEGER;
  v_desglosado BIGINT;
BEGIN
  v_id_movimiento := CASE
    WHEN TG_TABLE_NAME = 'movimiento_inventario' THEN NEW.id_movimiento
    ELSE NEW.id_movimiento
  END;

  SELECT tipo_movimiento, cantidad
    INTO v_tipo, v_cantidad
  FROM capricho.movimiento_inventario
  WHERE id_movimiento = v_id_movimiento;

  IF v_tipo IN (
    'ENTRADA_PROVEEDOR', 'VENTA', 'VENTA_RESERVA', 'DEVOLUCION',
    'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO',
    'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA'
  ) THEN
    SELECT COALESCE(SUM(cantidad), 0)
      INTO v_desglosado
    FROM capricho.movimiento_lote
    WHERE id_movimiento = v_id_movimiento;

    IF v_desglosado <> v_cantidad THEN
      RAISE EXCEPTION
        'Movimiento %: cantidad (%) diferente al desglose por lotes (%)',
        v_id_movimiento, v_cantidad, v_desglosado;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_lotes_movimiento ON capricho.movimiento_inventario;
CREATE CONSTRAINT TRIGGER trg_validar_lotes_movimiento
AFTER INSERT ON capricho.movimiento_inventario
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION capricho.fn_validar_desglose_lotes();

DROP TRIGGER IF EXISTS trg_validar_lotes_detalle ON capricho.movimiento_lote;
CREATE CONSTRAINT TRIGGER trg_validar_lotes_detalle
AFTER INSERT ON capricho.movimiento_lote
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION capricho.fn_validar_desglose_lotes();

-- ---------------------------------------------------------------------------
-- 6. DEVOLUCIONES: VENTA CORRECTA Y CANTIDAD NO EXCEDIDA
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION capricho.fn_validar_detalle_devolucion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
DECLARE
  v_venta_devolucion BIGINT;
  v_venta_detalle BIGINT;
  v_cantidad_vendida INTEGER;
  v_ya_solicitada BIGINT;
BEGIN
  SELECT d.id_venta
    INTO v_venta_devolucion
  FROM capricho.devolucion d
  WHERE d.id_devolucion = NEW.id_devolucion;

  SELECT dv.id_venta, dv.cantidad
    INTO v_venta_detalle, v_cantidad_vendida
  FROM capricho.detalle_venta dv
  WHERE dv.id_detalle_venta = NEW.id_detalle_venta
  FOR UPDATE;

  IF v_venta_devolucion <> v_venta_detalle THEN
    RAISE EXCEPTION 'El detalle devuelto no pertenece a la venta indicada';
  END IF;

  SELECT COALESCE(SUM(dd.cantidad), 0)
    INTO v_ya_solicitada
  FROM capricho.detalle_devolucion dd
  JOIN capricho.devolucion d ON d.id_devolucion = dd.id_devolucion
  WHERE dd.id_detalle_venta = NEW.id_detalle_venta
    AND d.estado <> 'RECHAZADA'
    AND dd.id_detalle_devolucion <> COALESCE(NEW.id_detalle_devolucion, -1);

  IF v_ya_solicitada + NEW.cantidad > v_cantidad_vendida THEN
    RAISE EXCEPTION
      'La cantidad total a devolver (%) supera la cantidad vendida (%)',
      v_ya_solicitada + NEW.cantidad, v_cantidad_vendida;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_detalle_devolucion ON capricho.detalle_devolucion;
CREATE TRIGGER trg_validar_detalle_devolucion
BEFORE INSERT OR UPDATE ON capricho.detalle_devolucion
FOR EACH ROW EXECUTE FUNCTION capricho.fn_validar_detalle_devolucion();

-- ---------------------------------------------------------------------------
-- 7. COTIZACION: LA DIRECCION DEBE PERTENECER AL CLIENTE
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION capricho.fn_validar_direccion_cliente()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
DECLARE
  v_cliente_direccion BIGINT;
BEGIN
  SELECT id_cliente INTO v_cliente_direccion
  FROM capricho.direccion_cliente
  WHERE id_direccion = NEW.id_direccion;

  IF v_cliente_direccion IS DISTINCT FROM NEW.id_cliente THEN
    RAISE EXCEPTION 'La direccion no pertenece al cliente indicado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_direccion_cotizacion ON capricho.cotizacion_envio;
CREATE TRIGGER trg_validar_direccion_cotizacion
BEFORE INSERT OR UPDATE OF id_cliente, id_direccion ON capricho.cotizacion_envio
FOR EACH ROW EXECUTE FUNCTION capricho.fn_validar_direccion_cliente();

-- ---------------------------------------------------------------------------
-- 8. PEDIDOS Y ENVIOS: COHERENCIA CON LA MODALIDAD DE ENTREGA
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION capricho.fn_validar_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
DECLARE
  v_modalidad VARCHAR(20);
  v_cliente_venta BIGINT;
  v_cliente_direccion BIGINT;
BEGIN
  SELECT modalidad_entrega, id_cliente
    INTO v_modalidad, v_cliente_venta
  FROM capricho.venta
  WHERE id_venta = NEW.id_venta;

  IF v_modalidad = 'DELIVERY' AND NEW.id_direccion IS NULL THEN
    RAISE EXCEPTION 'Un pedido DELIVERY requiere direccion';
  END IF;

  IF NEW.id_direccion IS NOT NULL THEN
    SELECT id_cliente INTO v_cliente_direccion
    FROM capricho.direccion_cliente
    WHERE id_direccion = NEW.id_direccion;

    IF v_cliente_venta IS NOT NULL
       AND v_cliente_direccion IS DISTINCT FROM v_cliente_venta THEN
      RAISE EXCEPTION 'La direccion del pedido no pertenece al cliente de la venta';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_pedido ON capricho.pedido;
CREATE TRIGGER trg_validar_pedido
BEFORE INSERT OR UPDATE OF id_venta, id_direccion ON capricho.pedido
FOR EACH ROW EXECUTE FUNCTION capricho.fn_validar_pedido();

CREATE OR REPLACE FUNCTION capricho.fn_validar_envio_delivery()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
DECLARE
  v_modalidad VARCHAR(20);
BEGIN
  SELECT v.modalidad_entrega
    INTO v_modalidad
  FROM capricho.pedido p
  JOIN capricho.venta v ON v.id_venta = p.id_venta
  WHERE p.id_pedido = NEW.id_pedido;

  IF v_modalidad <> 'DELIVERY' THEN
    RAISE EXCEPTION 'Solo los pedidos DELIVERY pueden tener un envio';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_envio_delivery ON capricho.envio;
CREATE TRIGGER trg_validar_envio_delivery
BEFORE INSERT OR UPDATE OF id_pedido ON capricho.envio
FOR EACH ROW EXECUTE FUNCTION capricho.fn_validar_envio_delivery();

-- ---------------------------------------------------------------------------
-- 9. CONSISTENCIA MATEMATICA DE DETALLE DE VENTA Y RECOMENDADOR
-- ---------------------------------------------------------------------------
-- NOT VALID conserva compatibilidad con datos historicos. PostgreSQL si aplica
-- la regla a las filas nuevas y modificadas.
ALTER TABLE capricho.detalle_venta
  DROP CONSTRAINT IF EXISTS ck_detalle_venta_calculo;
ALTER TABLE capricho.detalle_venta
  ADD CONSTRAINT ck_detalle_venta_calculo CHECK (
    descuento <= (cantidad * precio_unitario)
    AND subtotal = ROUND((cantidad * precio_unitario) - descuento, 2)
  ) NOT VALID;

ALTER TABLE capricho.configuracion_recomendador
  DROP CONSTRAINT IF EXISTS ck_pesos_recomendador_100;
ALTER TABLE capricho.configuracion_recomendador
  ADD CONSTRAINT ck_pesos_recomendador_100 CHECK (
    peso_categoria + peso_marca + peso_color +
    peso_talla + peso_temporada + peso_promocion = 100
  ) NOT VALID;

-- ---------------------------------------------------------------------------
-- 10. EVITAR PERIODOS DE PRECIO SOLAPADOS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION capricho.fn_validar_periodo_precio()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = capricho, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM capricho.historial_precio hp
    WHERE hp.id_producto = NEW.id_producto
      AND hp.id_historial_precio <> COALESCE(NEW.id_historial_precio, -1)
      AND tstzrange(hp.fecha_inicio, hp.fecha_fin, '[)')
          && tstzrange(NEW.fecha_inicio, NEW.fecha_fin, '[)')
  ) THEN
    RAISE EXCEPTION 'El periodo de precio se solapa con otro periodo del producto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_periodo_precio ON capricho.historial_precio;
CREATE TRIGGER trg_validar_periodo_precio
BEFORE INSERT OR UPDATE ON capricho.historial_precio
FOR EACH ROW EXECUTE FUNCTION capricho.fn_validar_periodo_precio();

-- ---------------------------------------------------------------------------
-- 11. INDICES DE CLAVES FORANEAS Y CONSULTAS FRECUENTES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_detalle_orden_variante
  ON capricho.detalle_orden_compra(id_variante);
CREATE INDEX IF NOT EXISTS idx_detalle_recepcion_variante
  ON capricho.detalle_recepcion(id_variante);
CREATE INDEX IF NOT EXISTS idx_movimiento_lote_lote
  ON capricho.movimiento_lote(id_lote);
CREATE INDEX IF NOT EXISTS idx_detalle_carrito_variante
  ON capricho.detalle_carrito(id_variante);
CREATE INDEX IF NOT EXISTS idx_detalle_reserva_variante
  ON capricho.detalle_reserva(id_variante);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_variante
  ON capricho.detalle_venta(id_variante);
CREATE INDEX IF NOT EXISTS idx_detalle_devolucion_detalle_venta
  ON capricho.detalle_devolucion(id_detalle_venta);
CREATE INDEX IF NOT EXISTS idx_pago_venta_estado
  ON capricho.pago(id_venta, estado);
CREATE INDEX IF NOT EXISTS idx_promocion_producto_producto
  ON capricho.promocion_producto(id_producto);
CREATE INDEX IF NOT EXISTS idx_promocion_categoria_categoria
  ON capricho.promocion_categoria(id_categoria);
CREATE INDEX IF NOT EXISTS idx_promocion_temporada_temporada
  ON capricho.promocion_temporada(id_temporada);

COMMIT;

-- ============================================================================
-- CONSULTAS DE DIAGNOSTICO (NO MODIFICAN DATOS)
-- Ejecutarlas despues de la migracion. Lo ideal es que todas retornen 0 filas.
-- ============================================================================

-- Correos duplicados ignorando mayusculas y espacios:
SELECT LOWER(BTRIM(correo)) AS correo_normalizado, COUNT(*)
FROM capricho.usuario
GROUP BY LOWER(BTRIM(correo))
HAVING COUNT(*) > 1;

-- Cotizaciones cuya direccion no pertenece al cliente:
SELECT c.id_cotizacion, c.id_cliente, d.id_cliente AS propietario_direccion
FROM capricho.cotizacion_envio c
JOIN capricho.direccion_cliente d ON d.id_direccion = c.id_direccion
WHERE d.id_cliente <> c.id_cliente;

-- Devoluciones asociadas a detalles de otra venta:
SELECT dd.id_detalle_devolucion, d.id_venta AS venta_devolucion,
       dv.id_venta AS venta_del_detalle
FROM capricho.detalle_devolucion dd
JOIN capricho.devolucion d ON d.id_devolucion = dd.id_devolucion
JOIN capricho.detalle_venta dv ON dv.id_detalle_venta = dd.id_detalle_venta
WHERE d.id_venta <> dv.id_venta;

-- Diferencias entre el inventario fisico y la suma disponible de lotes.
-- Una diferencia puede revelar movimientos historicos sin desglose por lote.
SELECT i.id_inventario, i.id_sucursal, i.id_variante, i.stock_fisico,
       COALESCE(SUM(l.cantidad_disponible), 0) AS disponible_en_lotes
FROM capricho.inventario_sucursal i
LEFT JOIN capricho.lote_inventario l
  ON l.id_sucursal = i.id_sucursal
 AND l.id_variante = i.id_variante
 AND l.activo = TRUE
GROUP BY i.id_inventario, i.id_sucursal, i.id_variante, i.stock_fisico
HAVING i.stock_fisico <> COALESCE(SUM(l.cantidad_disponible), 0);


-- ============================================================
-- CAPRICHO STORE - PostgreSQL 16+
-- Modelo normalizado preparado para FastAPI, Angular y Flutter
-- ============================================================

BEGIN;
CREATE SCHEMA IF NOT EXISTS capricho;
SET search_path TO capricho, public;

-- 1) SEGURIDAD
CREATE TABLE rol (
  id_rol BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  descripcion VARCHAR(200),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permiso (
  id_permiso BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(250),
  modulo VARCHAR(60) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuario (
  id_usuario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  ci VARCHAR(30) UNIQUE,
  correo VARCHAR(150) NOT NULL UNIQUE,
  telefono VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO','BLOQUEADO')),
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE usuario_rol (
  id_usuario_rol BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_rol BIGINT NOT NULL REFERENCES rol(id_rol) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_usuario,id_rol)
);

CREATE TABLE rol_permiso (
  id_rol_permiso BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_rol BIGINT NOT NULL REFERENCES rol(id_rol) ON DELETE CASCADE,
  id_permiso BIGINT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_rol,id_permiso)
);

CREATE TABLE usuario_permiso (
  id_usuario_permiso BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_permiso BIGINT NOT NULL REFERENCES permiso(id_permiso) ON DELETE CASCADE,
  otorgado BOOLEAN NOT NULL,
  id_asignado_por BIGINT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  fecha_asignacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_usuario,id_permiso)
);

-- 2) ORGANIZACIÓN / PERSONAS
CREATE TABLE ciudad (
  id_ciudad BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  departamento VARCHAR(100) NOT NULL,
  pais VARCHAR(100) NOT NULL DEFAULT 'Bolivia',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(nombre,departamento,pais)
);

CREATE TABLE sucursal (
  id_sucursal BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_ciudad BIGINT NOT NULL REFERENCES ciudad(id_ciudad) ON DELETE RESTRICT,
  nombre VARCHAR(120) NOT NULL,
  direccion VARCHAR(255) NOT NULL,
  telefono VARCHAR(30),
  latitud NUMERIC(9,6),
  longitud NUMERIC(9,6),
  place_id VARCHAR(255),
  hora_apertura TIME,
  hora_cierre TIME,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_ciudad,nombre),
  CHECK(latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CHECK(longitud IS NULL OR longitud BETWEEN -180 AND 180)
);

CREATE TABLE cliente (
  id_cliente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT NOT NULL UNIQUE REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  fecha_nacimiento DATE,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE empleado (
  id_empleado BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT NOT NULL UNIQUE REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  cargo_descriptivo VARCHAR(100),
  fecha_contratacion DATE NOT NULL DEFAULT CURRENT_DATE,
  estado_laboral VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (estado_laboral IN ('ACTIVO','INACTIVO','SUSPENDIDO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE direccion_cliente (
  id_direccion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
  id_ciudad BIGINT NOT NULL REFERENCES ciudad(id_ciudad) ON DELETE RESTRICT,
  alias VARCHAR(60),
  zona VARCHAR(120),
  direccion VARCHAR(255) NOT NULL,
  referencia VARCHAR(255),
  latitud NUMERIC(9,6),
  longitud NUMERIC(9,6),
  place_id VARCHAR(255),
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CHECK(longitud IS NULL OR longitud BETWEEN -180 AND 180)
);
CREATE UNIQUE INDEX uq_direccion_principal_cliente ON direccion_cliente(id_cliente) WHERE es_principal=TRUE AND activo=TRUE;

-- 3) CATÁLOGO
CREATE TABLE categoria (
  id_categoria BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion VARCHAR(250),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE marca (
  id_marca BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion VARCHAR(250),
  pais_origen VARCHAR(100),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE talla (
  id_talla BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE CHECK (codigo IN ('S','M','L','XL')),
  orden SMALLINT NOT NULL UNIQUE CHECK (orden>0),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE color (
  id_color BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  codigo_hex CHAR(7),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK(codigo_hex IS NULL OR codigo_hex ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE temporada (
  id_temporada BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  anio SMALLINT,
  fecha_inicio DATE,
  fecha_fin DATE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin>=fecha_inicio)
);

CREATE TABLE coleccion (
  id_coleccion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_temporada BIGINT REFERENCES temporada(id_temporada) ON DELETE SET NULL,
  nombre VARCHAR(120) NOT NULL,
  descripcion VARCHAR(250),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE producto (
  id_producto BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_categoria BIGINT NOT NULL REFERENCES categoria(id_categoria) ON DELETE RESTRICT,
  id_marca BIGINT NOT NULL REFERENCES marca(id_marca) ON DELETE RESTRICT,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT,
  publico_objetivo VARCHAR(10) NOT NULL CHECK(publico_objetivo IN ('HOMBRE','MUJER')),
  permite_vestidor BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE producto_temporada (
  id_producto_temporada BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  id_temporada BIGINT NOT NULL REFERENCES temporada(id_temporada) ON DELETE CASCADE,
  UNIQUE(id_producto,id_temporada)
);

CREATE TABLE producto_coleccion (
  id_producto_coleccion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  id_coleccion BIGINT NOT NULL REFERENCES coleccion(id_coleccion) ON DELETE CASCADE,
  UNIQUE(id_producto,id_coleccion)
);

CREATE TABLE variante_producto (
  id_variante BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
  id_talla BIGINT NOT NULL REFERENCES talla(id_talla) ON DELETE RESTRICT,
  id_color BIGINT NOT NULL REFERENCES color(id_color) ON DELETE RESTRICT,
  sku VARCHAR(80) NOT NULL UNIQUE,
  codigo_barras VARCHAR(80) UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_producto,id_talla,id_color)
);

CREATE TABLE medida_talla_producto (
  id_medida BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  id_talla BIGINT NOT NULL REFERENCES talla(id_talla) ON DELETE RESTRICT,
  ancho_hombros_cm NUMERIC(6,2),
  ancho_pecho_cm NUMERIC(6,2),
  largo_prenda_cm NUMERIC(6,2),
  largo_manga_cm NUMERIC(6,2),
  UNIQUE(id_producto,id_talla),
  CHECK(ancho_hombros_cm IS NULL OR ancho_hombros_cm>0),
  CHECK(ancho_pecho_cm IS NULL OR ancho_pecho_cm>0),
  CHECK(largo_prenda_cm IS NULL OR largo_prenda_cm>0),
  CHECK(largo_manga_cm IS NULL OR largo_manga_cm>0)
);

CREATE TABLE imagen_producto (
  id_imagen BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  id_color BIGINT REFERENCES color(id_color) ON DELETE RESTRICT,
  proveedor_storage VARCHAR(30) NOT NULL DEFAULT 'CLOUDINARY',
  public_id VARCHAR(255) NOT NULL,
  secure_url TEXT NOT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'CATALOGO' CHECK(tipo IN ('CATALOGO','MINIATURA','PROMOCIONAL')),
  orden SMALLINT NOT NULL DEFAULT 1 CHECK(orden>0),
  es_principal BOOLEAN NOT NULL DEFAULT FALSE,
  formato VARCHAR(20), ancho_px INTEGER, alto_px INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proveedor_storage,public_id)
);
CREATE UNIQUE INDEX uq_imagen_principal_producto_color ON imagen_producto(id_producto,id_color) WHERE es_principal=TRUE AND id_color IS NOT NULL;
CREATE UNIQUE INDEX uq_imagen_principal_producto_generica ON imagen_producto(id_producto) WHERE es_principal=TRUE AND id_color IS NULL;
CREATE INDEX idx_imagen_producto_color ON imagen_producto(id_producto,id_color,orden);

CREATE TABLE historial_precio (
  id_historial_precio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
  precio NUMERIC(12,2) NOT NULL CHECK(precio>=0),
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ,
  creado_por BIGINT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  CHECK(fecha_fin IS NULL OR fecha_fin>fecha_inicio)
);
CREATE UNIQUE INDEX uq_precio_actual_producto ON historial_precio(id_producto) WHERE fecha_fin IS NULL;

-- 4) PROVEEDORES / COMPRAS / LOTES
CREATE TABLE proveedor (
  id_proveedor BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_ciudad BIGINT REFERENCES ciudad(id_ciudad) ON DELETE SET NULL,
  razon_social VARCHAR(150) NOT NULL,
  nombre_comercial VARCHAR(150),
  nit VARCHAR(40) UNIQUE,
  telefono VARCHAR(30), correo VARCHAR(150), direccion VARCHAR(255),
  nombre_contacto VARCHAR(120), telefono_contacto VARCHAR(30), correo_contacto VARCHAR(150),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE producto_proveedor (
  id_producto_proveedor BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE RESTRICT,
  id_proveedor BIGINT NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
  codigo_proveedor VARCHAR(100),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_producto,id_proveedor)
);

CREATE TABLE orden_compra (
  id_orden_compra BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_proveedor BIGINT NOT NULL REFERENCES proveedor(id_proveedor) ON DELETE RESTRICT,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_empleado BIGINT REFERENCES empleado(id_empleado) ON DELETE SET NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'SOLICITADA' CHECK(estado IN ('SOLICITADA','CONFIRMADA','EN_TRANSITO','PARCIAL','RECIBIDA','CANCELADA')),
  fecha_orden TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_estimada DATE,
  observacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE detalle_orden_compra (
  id_detalle_orden BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_orden_compra BIGINT NOT NULL REFERENCES orden_compra(id_orden_compra) ON DELETE CASCADE,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  costo_unitario_estimado NUMERIC(12,2) CHECK(costo_unitario_estimado>=0),
  UNIQUE(id_orden_compra,id_variante)
);

CREATE TABLE recepcion_mercaderia (
  id_recepcion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_orden_compra BIGINT REFERENCES orden_compra(id_orden_compra) ON DELETE SET NULL,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_empleado BIGINT REFERENCES empleado(id_empleado) ON DELETE SET NULL,
  fecha_recepcion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA' CHECK(estado IN ('BORRADOR','CONFIRMADA','ANULADA')),
  observacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE detalle_recepcion (
  id_detalle_recepcion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_recepcion BIGINT NOT NULL REFERENCES recepcion_mercaderia(id_recepcion) ON DELETE CASCADE,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  cantidad_recibida INTEGER NOT NULL CHECK(cantidad_recibida>0),
  costo_unitario NUMERIC(12,2) NOT NULL CHECK(costo_unitario>=0)
);

CREATE TABLE lote_inventario (
  id_lote BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_detalle_recepcion BIGINT NOT NULL REFERENCES detalle_recepcion(id_detalle_recepcion) ON DELETE RESTRICT,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  numero_lote VARCHAR(100),
  cantidad_inicial INTEGER NOT NULL CHECK(cantidad_inicial>0),
  cantidad_disponible INTEGER NOT NULL CHECK(cantidad_disponible>=0),
  costo_unitario NUMERIC(12,2) NOT NULL CHECK(costo_unitario>=0),
  fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK(cantidad_disponible<=cantidad_inicial)
);

-- 5) INVENTARIO
CREATE TABLE inventario_sucursal (
  id_inventario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  stock_fisico INTEGER NOT NULL DEFAULT 0 CHECK(stock_fisico>=0),
  stock_reservado INTEGER NOT NULL DEFAULT 0 CHECK(stock_reservado>=0),
  stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK(stock_minimo>=0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_sucursal,id_variante),
  CHECK(stock_reservado<=stock_fisico)
);

CREATE TABLE movimiento_inventario (
  id_movimiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_inventario BIGINT NOT NULL REFERENCES inventario_sucursal(id_inventario) ON DELETE RESTRICT,
  id_empleado BIGINT REFERENCES empleado(id_empleado) ON DELETE SET NULL,
  tipo_movimiento VARCHAR(30) NOT NULL CHECK(tipo_movimiento IN ('ENTRADA_PROVEEDOR','VENTA','RESERVA','LIBERACION_RESERVA','VENTA_RESERVA','DEVOLUCION','AJUSTE_POSITIVO','AJUSTE_NEGATIVO','TRANSFERENCIA_SALIDA','TRANSFERENCIA_ENTRADA')),
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  referencia_tipo VARCHAR(40),
  referencia_id BIGINT,
  motivo VARCHAR(255),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE movimiento_lote (
  id_movimiento_lote BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_movimiento BIGINT NOT NULL REFERENCES movimiento_inventario(id_movimiento) ON DELETE CASCADE,
  id_lote BIGINT NOT NULL REFERENCES lote_inventario(id_lote) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  costo_unitario NUMERIC(12,2) NOT NULL CHECK(costo_unitario>=0),
  UNIQUE(id_movimiento,id_lote)
);

CREATE TABLE transferencia_inventario (
  id_transferencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_sucursal_origen BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_sucursal_destino BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_empleado BIGINT REFERENCES empleado(id_empleado) ON DELETE SET NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'SOLICITADA' CHECK(estado IN ('SOLICITADA','APROBADA','EN_TRANSITO','RECIBIDA','CANCELADA')),
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_recepcion TIMESTAMPTZ,
  CHECK(id_sucursal_origen<>id_sucursal_destino)
);

CREATE TABLE detalle_transferencia (
  id_detalle_transferencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_transferencia BIGINT NOT NULL REFERENCES transferencia_inventario(id_transferencia) ON DELETE CASCADE,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  UNIQUE(id_transferencia,id_variante)
);

-- 6) CARRITO / RESERVAS
CREATE TABLE carrito (
  id_carrito BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
  id_sucursal BIGINT REFERENCES sucursal(id_sucursal) ON DELETE SET NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK(estado IN ('ACTIVO','CONVERTIDO','EXPIRADO','ABANDONADO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_carrito_activo_cliente ON carrito(id_cliente) WHERE estado='ACTIVO';
CREATE INDEX IF NOT EXISTS idx_carrito_sucursal ON carrito(id_sucursal);

CREATE TABLE detalle_carrito (
  id_detalle_carrito BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_carrito BIGINT NOT NULL REFERENCES carrito(id_carrito) ON DELETE CASCADE,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id_carrito,id_variante)
);

CREATE TABLE reserva (
  id_reserva BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  fecha_reserva TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cita TIMESTAMPTZ,
  fecha_expiracion TIMESTAMPTZ,
  estado VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','CONFIRMADA','PREPARANDO','LISTA','CLIENTE_PRESENTE','CONVERTIDA','CANCELADA','EXPIRADA')),
  observacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE detalle_reserva (
  id_detalle_reserva BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_reserva BIGINT NOT NULL REFERENCES reserva(id_reserva) ON DELETE CASCADE,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  UNIQUE(id_reserva,id_variante)
);

-- 7) VENTAS / DEVOLUCIONES
CREATE TABLE venta (
  id_venta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT REFERENCES cliente(id_cliente) ON DELETE SET NULL,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_empleado BIGINT REFERENCES empleado(id_empleado) ON DELETE SET NULL,
  id_reserva BIGINT REFERENCES reserva(id_reserva) ON DELETE SET NULL,
  canal_venta VARCHAR(15) NOT NULL CHECK(canal_venta IN ('PRESENCIAL','WEB','MOVIL')),
  modalidad_entrega VARCHAR(20) NOT NULL CHECK(modalidad_entrega IN ('ENTREGA_DIRECTA','RETIRO_SUCURSAL','DELIVERY')),
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','CONFIRMADA','PAGADA','ANULADA','REEMBOLSADA')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0),
  descuento_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(descuento_total>=0),
  costo_envio NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(costo_envio>=0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(total>=0),
  fecha_venta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE detalle_venta (
  id_detalle_venta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES venta(id_venta) ON DELETE CASCADE,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  precio_unitario NUMERIC(12,2) NOT NULL CHECK(precio_unitario>=0),
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(descuento>=0),
  subtotal NUMERIC(12,2) NOT NULL CHECK(subtotal>=0)
);

CREATE TABLE devolucion (
  id_devolucion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES venta(id_venta) ON DELETE RESTRICT,
  id_cliente BIGINT REFERENCES cliente(id_cliente) ON DELETE SET NULL,
  id_empleado BIGINT REFERENCES empleado(id_empleado) ON DELETE SET NULL,
  motivo VARCHAR(255) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','APROBADA','RECHAZADA','COMPLETADA')),
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion TIMESTAMPTZ
);

CREATE TABLE detalle_devolucion (
  id_detalle_devolucion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_devolucion BIGINT NOT NULL REFERENCES devolucion(id_devolucion) ON DELETE CASCADE,
  id_detalle_venta BIGINT NOT NULL REFERENCES detalle_venta(id_detalle_venta) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL CHECK(cantidad>0),
  estado_prenda VARCHAR(25) NOT NULL DEFAULT 'APTA_REINGRESO' CHECK(estado_prenda IN ('APTA_REINGRESO','NO_APTA')),
  UNIQUE(id_devolucion,id_detalle_venta)
);

-- 8) PAGOS
CREATE TABLE metodo_pago (
  id_metodo_pago BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(80) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK(tipo IN ('EFECTIVO','QR','PASARELA')),
  activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE pago (
  id_pago BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta BIGINT NOT NULL REFERENCES venta(id_venta) ON DELETE RESTRICT,
  id_metodo_pago BIGINT NOT NULL REFERENCES metodo_pago(id_metodo_pago) ON DELETE RESTRICT,
  monto NUMERIC(12,2) NOT NULL CHECK(monto>0),
  moneda CHAR(3) NOT NULL DEFAULT 'BOB',
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','PROCESANDO','PAGADO','RECHAZADO','REEMBOLSADO','CANCELADO')),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_confirmacion TIMESTAMPTZ
);

CREATE TABLE transaccion_pasarela (
  id_transaccion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pago BIGINT NOT NULL REFERENCES pago(id_pago) ON DELETE CASCADE,
  proveedor VARCHAR(30) NOT NULL,
  external_payment_id VARCHAR(255),
  external_session_id VARCHAR(255),
  external_customer_id VARCHAR(255),
  estado VARCHAR(50),
  monto NUMERIC(12,2) CHECK(monto>=0),
  moneda CHAR(3) DEFAULT 'BOB',
  respuesta_resumen JSONB,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_confirmacion TIMESTAMPTZ,
  UNIQUE(proveedor,external_payment_id)
);

-- 9) DELIVERY / COTIZACIÓN / PEDIDOS
CREATE TABLE tarifa_envio (
  id_tarifa BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tarifa_base NUMERIC(12,2) NOT NULL DEFAULT 5.00 CHECK(tarifa_base>=0),
  distancia_base_km NUMERIC(8,2) NOT NULL DEFAULT 1.00 CHECK(distancia_base_km>0),
  costo_km_adicional NUMERIC(12,2) NOT NULL DEFAULT 2.50 CHECK(costo_km_adicional>=0),
  vigente_desde TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  vigente_hasta TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK(vigente_hasta IS NULL OR vigente_hasta>vigente_desde)
);
CREATE UNIQUE INDEX uq_tarifa_envio_activa ON tarifa_envio((activo)) WHERE activo=TRUE;

CREATE TABLE cotizacion_envio (
  id_cotizacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
  id_sucursal BIGINT NOT NULL REFERENCES sucursal(id_sucursal) ON DELETE RESTRICT,
  id_direccion BIGINT NOT NULL REFERENCES direccion_cliente(id_direccion) ON DELETE RESTRICT,
  id_tarifa BIGINT NOT NULL REFERENCES tarifa_envio(id_tarifa) ON DELETE RESTRICT,
  distancia_km NUMERIC(8,2) NOT NULL CHECK(distancia_km>=0),
  duracion_estimada_min INTEGER CHECK(duracion_estimada_min>=0),
  costo_estimado NUMERIC(12,2) NOT NULL CHECK(costo_estimado>=0),
  proveedor_rutas VARCHAR(30) NOT NULL DEFAULT 'GOOGLE_MAPS',
  fecha_cotizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expira_en TIMESTAMPTZ
);

CREATE TABLE pedido (
  id_pedido BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta BIGINT NOT NULL UNIQUE REFERENCES venta(id_venta) ON DELETE RESTRICT,
  id_direccion BIGINT REFERENCES direccion_cliente(id_direccion) ON DELETE RESTRICT,
  id_cotizacion BIGINT REFERENCES cotizacion_envio(id_cotizacion) ON DELETE SET NULL,
  estado VARCHAR(25) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','PREPARANDO','LISTO_PARA_RETIRO','LISTO_PARA_ENVIO','RECOGIDO','EN_CAMINO','ENTREGADO','RETIRADO','CANCELADO')),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_preparacion TIMESTAMPTZ,
  fecha_finalizacion TIMESTAMPTZ
);

CREATE TABLE envio (
  id_envio BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pedido BIGINT NOT NULL UNIQUE REFERENCES pedido(id_pedido) ON DELETE RESTRICT,
  proveedor_delivery VARCHAR(120),
  distancia_km NUMERIC(8,2) CHECK(distancia_km>=0),
  duracion_estimada_min INTEGER CHECK(duracion_estimada_min>=0),
  costo_envio NUMERIC(12,2) NOT NULL CHECK(costo_envio>=0),
  codigo_seguimiento VARCHAR(150),
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','ASIGNADO','RECOGIDO','EN_CAMINO','ENTREGADO','CANCELADO')),
  fecha_salida TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,
  observacion TEXT
);

-- 10) PROMOCIONES / COMUNICACIONES
CREATE TABLE promocion (
  id_promocion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion VARCHAR(250),
  porcentaje_descuento NUMERIC(5,2) NOT NULL CHECK(porcentaje_descuento>0 AND porcentaje_descuento<=100),
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(fecha_fin>fecha_inicio)
);

CREATE TABLE promocion_producto (
  id_promocion_producto BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_promocion BIGINT NOT NULL REFERENCES promocion(id_promocion) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  UNIQUE(id_promocion,id_producto)
);
CREATE TABLE promocion_categoria (
  id_promocion_categoria BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_promocion BIGINT NOT NULL REFERENCES promocion(id_promocion) ON DELETE CASCADE,
  id_categoria BIGINT NOT NULL REFERENCES categoria(id_categoria) ON DELETE CASCADE,
  UNIQUE(id_promocion,id_categoria)
);
CREATE TABLE promocion_temporada (
  id_promocion_temporada BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_promocion BIGINT NOT NULL REFERENCES promocion(id_promocion) ON DELETE CASCADE,
  id_temporada BIGINT NOT NULL REFERENCES temporada(id_temporada) ON DELETE CASCADE,
  UNIQUE(id_promocion,id_temporada)
);

CREATE TABLE campania (
  id_campania BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion VARCHAR(250),
  asunto_email VARCHAR(180),
  segmento_objetivo VARCHAR(150),
  fecha_inicio TIMESTAMPTZ,
  fecha_fin TIMESTAMPTZ,
  estado VARCHAR(20) NOT NULL DEFAULT 'BORRADOR' CHECK(estado IN ('BORRADOR','PROGRAMADA','ENVIANDO','FINALIZADA','CANCELADA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notificacion (
  id_notificacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  id_campania BIGINT REFERENCES campania(id_campania) ON DELETE SET NULL,
  tipo VARCHAR(50) NOT NULL,
  canal VARCHAR(10) NOT NULL CHECK(canal IN ('EMAIL','PUSH')),
  proveedor VARCHAR(30) NOT NULL,
  destinatario VARCHAR(255),
  titulo VARCHAR(180),
  contenido TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE','ENVIANDO','ENVIADO','ENTREGADO','ERROR')),
  external_message_id VARCHAR(255),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_envio TIMESTAMPTZ,
  fecha_entrega TIMESTAMPTZ,
  error_mensaje TEXT
);

CREATE TABLE dispositivo_usuario (
  id_dispositivo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  identificador_app VARCHAR(255) NOT NULL,
  token_push TEXT,
  plataforma VARCHAR(10) NOT NULL CHECK(plataforma IN ('ANDROID','IOS')),
  modelo_dispositivo VARCHAR(120),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_uso TIMESTAMPTZ,
  UNIQUE(id_usuario,identificador_app)
);

-- 11) VESTIDOR VIRTUAL - MEDIAPIPE POSE LANDMARKER
CREATE TABLE recurso_vestidor (
  id_recurso BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_variante BIGINT NOT NULL REFERENCES variante_producto(id_variante) ON DELETE CASCADE,
  proveedor_storage VARCHAR(30) NOT NULL DEFAULT 'CLOUDINARY',
  public_id VARCHAR(255) NOT NULL,
  secure_url TEXT NOT NULL,
  tipo_recurso VARCHAR(20) NOT NULL DEFAULT 'PNG_2D' CHECK(tipo_recurso='PNG_2D'),
  ancho_referencia NUMERIC(8,2), alto_referencia NUMERIC(8,2),
  factor_hombros NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  factor_torso NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  factor_vertical NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  offset_x NUMERIC(8,4) NOT NULL DEFAULT 0,
  offset_y NUMERIC(8,4) NOT NULL DEFAULT 0,
  rotacion_base NUMERIC(8,4) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proveedor_storage,public_id)
);

CREATE TABLE sesion_vestidor (
  id_sesion_vestidor BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT REFERENCES cliente(id_cliente) ON DELETE SET NULL,
  id_variante BIGINT REFERENCES variante_producto(id_variante) ON DELETE SET NULL,
  perfil_rendimiento VARCHAR(10) NOT NULL CHECK(perfil_rendimiento IN ('LOW','MEDIUM','HIGH','ULTRA')),
  plataforma VARCHAR(10) NOT NULL CHECK(plataforma IN ('ANDROID','IOS')),
  modelo_dispositivo VARCHAR(120),
  modelo_vision VARCHAR(60) NOT NULL DEFAULT 'MEDIAPIPE_POSE_LANDMARKER',
  fps_promedio NUMERIC(6,2),
  resolucion_inferencia VARCHAR(30),
  segmentacion_activa BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_fin TIMESTAMPTZ
);

-- 12) IA2 - RECOMENDADOR HÍBRIDO
CREATE TABLE interaccion_producto (
  id_interaccion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  id_variante BIGINT REFERENCES variante_producto(id_variante) ON DELETE SET NULL,
  tipo_interaccion VARCHAR(30) NOT NULL CHECK(tipo_interaccion IN ('VER_PRODUCTO','AGREGAR_CARRITO','QUITAR_CARRITO','USAR_VESTIDOR','COMPRAR')),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE configuracion_recomendador (
  id_configuracion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  peso_categoria NUMERIC(5,2) NOT NULL DEFAULT 40,
  peso_marca NUMERIC(5,2) NOT NULL DEFAULT 20,
  peso_color NUMERIC(5,2) NOT NULL DEFAULT 15,
  peso_talla NUMERIC(5,2) NOT NULL DEFAULT 10,
  peso_temporada NUMERIC(5,2) NOT NULL DEFAULT 10,
  peso_promocion NUMERIC(5,2) NOT NULL DEFAULT 5,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(peso_categoria>=0 AND peso_marca>=0 AND peso_color>=0 AND peso_talla>=0 AND peso_temporada>=0 AND peso_promocion>=0)
);
CREATE UNIQUE INDEX uq_config_recomendador_activa ON configuracion_recomendador((activo)) WHERE activo=TRUE;

CREATE TABLE recomendacion (
  id_recomendacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  puntuacion NUMERIC(8,2) NOT NULL CHECK(puntuacion>=0),
  motivo VARCHAR(255),
  fecha_generacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13) BITÁCORA
CREATE TABLE bitacora (
  id_bitacora BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario BIGINT REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  id_sesion VARCHAR(120),
  accion VARCHAR(20) NOT NULL,
  modulo VARCHAR(60) NOT NULL,
  entidad VARCHAR(80) NOT NULL,
  id_registro VARCHAR(120),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  direccion_ip INET,
  user_agent TEXT,
  origen VARCHAR(10) CHECK(origen IN ('WEB','MOVIL','API','SISTEMA')),
  request_id VARCHAR(120),
  fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14) FUNCIONES Y TRIGGERS
CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION fn_aplicar_movimiento_inventario() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_fisico INTEGER; v_reservado INTEGER; v_disponible INTEGER;
BEGIN
  SELECT stock_fisico,stock_reservado INTO v_fisico,v_reservado
  FROM inventario_sucursal WHERE id_inventario=NEW.id_inventario FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventario % no existe',NEW.id_inventario; END IF;
  v_disponible:=v_fisico-v_reservado;
  CASE NEW.tipo_movimiento
    WHEN 'ENTRADA_PROVEEDOR','DEVOLUCION','AJUSTE_POSITIVO','TRANSFERENCIA_ENTRADA' THEN v_fisico:=v_fisico+NEW.cantidad;
    WHEN 'VENTA','AJUSTE_NEGATIVO','TRANSFERENCIA_SALIDA' THEN
      IF v_disponible<NEW.cantidad THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;
      v_fisico:=v_fisico-NEW.cantidad;
    WHEN 'RESERVA' THEN
      IF v_disponible<NEW.cantidad THEN RAISE EXCEPTION 'Stock insuficiente para reservar'; END IF;
      v_reservado:=v_reservado+NEW.cantidad;
    WHEN 'LIBERACION_RESERVA' THEN
      IF v_reservado<NEW.cantidad THEN RAISE EXCEPTION 'Stock reservado insuficiente'; END IF;
      v_reservado:=v_reservado-NEW.cantidad;
    WHEN 'VENTA_RESERVA' THEN
      IF v_reservado<NEW.cantidad THEN RAISE EXCEPTION 'Stock reservado insuficiente'; END IF;
      v_fisico:=v_fisico-NEW.cantidad; v_reservado:=v_reservado-NEW.cantidad;
  END CASE;
  IF v_fisico<0 OR v_reservado<0 OR v_reservado>v_fisico THEN RAISE EXCEPTION 'Movimiento dejaría inventario inconsistente'; END IF;
  UPDATE inventario_sucursal SET stock_fisico=v_fisico,stock_reservado=v_reservado,updated_at=NOW() WHERE id_inventario=NEW.id_inventario;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_movimiento_inventario AFTER INSERT ON movimiento_inventario FOR EACH ROW EXECUTE FUNCTION fn_aplicar_movimiento_inventario();

CREATE OR REPLACE FUNCTION fn_proteger_lote_historico() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id_detalle_recepcion<>OLD.id_detalle_recepcion OR NEW.id_sucursal<>OLD.id_sucursal OR NEW.id_variante<>OLD.id_variante OR NEW.cantidad_inicial<>OLD.cantidad_inicial OR NEW.costo_unitario<>OLD.costo_unitario OR NEW.fecha_ingreso<>OLD.fecha_ingreso THEN
    RAISE EXCEPTION 'No se pueden modificar datos históricos consolidados del lote';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_proteger_lote_historico BEFORE UPDATE ON lote_inventario FOR EACH ROW EXECUTE FUNCTION fn_proteger_lote_historico();

CREATE OR REPLACE FUNCTION fn_calcular_costo_envio(p_distancia_km NUMERIC,p_id_tarifa BIGINT DEFAULT NULL)
RETURNS NUMERIC(12,2) LANGUAGE plpgsql STABLE AS $$
DECLARE v_base NUMERIC(12,2); v_dist NUMERIC(8,2); v_extra NUMERIC(12,2);
BEGIN
  IF p_distancia_km<0 THEN RAISE EXCEPTION 'La distancia no puede ser negativa'; END IF;
  SELECT tarifa_base,distancia_base_km,costo_km_adicional INTO v_base,v_dist,v_extra
  FROM tarifa_envio WHERE activo=TRUE AND (p_id_tarifa IS NULL OR id_tarifa=p_id_tarifa)
  ORDER BY vigente_desde DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe tarifa activa'; END IF;
  IF p_distancia_km<=v_dist THEN RETURN ROUND(v_base,2); END IF;
  RETURN ROUND(v_base+((p_distancia_km-v_dist)*v_extra),2);
END; $$;

CREATE OR REPLACE FUNCTION fn_bitacora_generica() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_usuario BIGINT; v_ip INET; v_origen VARCHAR(10); v_id TEXT;
BEGIN
  BEGIN v_usuario:=NULLIF(current_setting('app.usuario_id',true),'')::BIGINT; EXCEPTION WHEN OTHERS THEN v_usuario:=NULL; END;
  BEGIN v_ip:=NULLIF(current_setting('app.ip',true),'')::INET; EXCEPTION WHEN OTHERS THEN v_ip:=NULL; END;
  v_origen:=NULLIF(current_setting('app.origen',true),'');
  IF TG_OP='INSERT' THEN
    v_id:=COALESCE(to_jsonb(NEW)->>TG_ARGV[1],'');
    INSERT INTO bitacora(id_usuario,id_sesion,accion,modulo,entidad,id_registro,datos_nuevos,direccion_ip,user_agent,origen,request_id)
    VALUES(v_usuario,NULLIF(current_setting('app.sesion_id',true),''),TG_OP,TG_ARGV[0],TG_TABLE_NAME,v_id,to_jsonb(NEW),v_ip,NULLIF(current_setting('app.user_agent',true),''),COALESCE(v_origen,'SISTEMA'),NULLIF(current_setting('app.request_id',true),''));
    RETURN NEW;
  ELSIF TG_OP='UPDATE' THEN
    v_id:=COALESCE(to_jsonb(NEW)->>TG_ARGV[1],'');
    INSERT INTO bitacora(id_usuario,id_sesion,accion,modulo,entidad,id_registro,datos_anteriores,datos_nuevos,direccion_ip,user_agent,origen,request_id)
    VALUES(v_usuario,NULLIF(current_setting('app.sesion_id',true),''),TG_OP,TG_ARGV[0],TG_TABLE_NAME,v_id,to_jsonb(OLD),to_jsonb(NEW),v_ip,NULLIF(current_setting('app.user_agent',true),''),COALESCE(v_origen,'SISTEMA'),NULLIF(current_setting('app.request_id',true),''));
    RETURN NEW;
  ELSE
    v_id:=COALESCE(to_jsonb(OLD)->>TG_ARGV[1],'');
    INSERT INTO bitacora(id_usuario,id_sesion,accion,modulo,entidad,id_registro,datos_anteriores,direccion_ip,user_agent,origen,request_id)
    VALUES(v_usuario,NULLIF(current_setting('app.sesion_id',true),''),TG_OP,TG_ARGV[0],TG_TABLE_NAME,v_id,to_jsonb(OLD),v_ip,NULLIF(current_setting('app.user_agent',true),''),COALESCE(v_origen,'SISTEMA'),NULLIF(current_setting('app.request_id',true),''));
    RETURN OLD;
  END IF;
END; $$;

DO $$ DECLARE t TEXT; BEGIN
FOREACH t IN ARRAY ARRAY['rol','permiso','usuario','ciudad','sucursal','cliente','empleado','direccion_cliente','categoria','marca','temporada','coleccion','producto','variante_producto','proveedor','orden_compra','carrito','reserva','venta','promocion','campania','recurso_vestidor'] LOOP
  EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',t,t);
END LOOP; END $$;

CREATE TRIGGER audit_usuario AFTER INSERT OR UPDATE OR DELETE ON usuario FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('SEGURIDAD','id_usuario');
CREATE TRIGGER audit_usuario_rol AFTER INSERT OR UPDATE OR DELETE ON usuario_rol FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('SEGURIDAD','id_usuario_rol');
CREATE TRIGGER audit_usuario_permiso AFTER INSERT OR UPDATE OR DELETE ON usuario_permiso FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('SEGURIDAD','id_usuario_permiso');
CREATE TRIGGER audit_sucursal AFTER INSERT OR UPDATE OR DELETE ON sucursal FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('ORGANIZACION','id_sucursal');
CREATE TRIGGER audit_producto AFTER INSERT OR UPDATE OR DELETE ON producto FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('CATALOGO','id_producto');
CREATE TRIGGER audit_historial_precio AFTER INSERT OR UPDATE OR DELETE ON historial_precio FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('CATALOGO','id_historial_precio');
CREATE TRIGGER audit_proveedor AFTER INSERT OR UPDATE OR DELETE ON proveedor FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('PROVEEDORES','id_proveedor');
CREATE TRIGGER audit_recepcion AFTER INSERT OR UPDATE OR DELETE ON recepcion_mercaderia FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('INVENTARIO','id_recepcion');
CREATE TRIGGER audit_movimiento AFTER INSERT OR UPDATE OR DELETE ON movimiento_inventario FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('INVENTARIO','id_movimiento');
CREATE TRIGGER audit_reserva AFTER INSERT OR UPDATE OR DELETE ON reserva FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('RESERVAS','id_reserva');
CREATE TRIGGER audit_venta AFTER INSERT OR UPDATE OR DELETE ON venta FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('VENTAS','id_venta');
CREATE TRIGGER audit_pago AFTER INSERT OR UPDATE OR DELETE ON pago FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('PAGOS','id_pago');
CREATE TRIGGER audit_devolucion AFTER INSERT OR UPDATE OR DELETE ON devolucion FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('DEVOLUCIONES','id_devolucion');
CREATE TRIGGER audit_promocion AFTER INSERT OR UPDATE OR DELETE ON promocion FOR EACH ROW EXECUTE FUNCTION fn_bitacora_generica('MARKETING','id_promocion');

-- 15) ÍNDICES
CREATE INDEX idx_usuario_correo_lower ON usuario(LOWER(correo));
CREATE INDEX idx_empleado_sucursal ON empleado(id_sucursal);
CREATE INDEX idx_producto_categoria ON producto(id_categoria) WHERE activo=TRUE;
CREATE INDEX idx_producto_marca ON producto(id_marca) WHERE activo=TRUE;
CREATE INDEX idx_producto_publico ON producto(publico_objetivo) WHERE activo=TRUE;
CREATE INDEX idx_variante_producto ON variante_producto(id_producto) WHERE activo=TRUE;
CREATE INDEX idx_variante_talla_color ON variante_producto(id_talla,id_color) WHERE activo=TRUE;
CREATE INDEX idx_precio_producto_fecha ON historial_precio(id_producto,fecha_inicio DESC);
CREATE INDEX idx_lote_fifo ON lote_inventario(id_sucursal,id_variante,fecha_ingreso,id_lote) WHERE activo=TRUE AND cantidad_disponible>0;
CREATE INDEX idx_movimiento_inventario_fecha ON movimiento_inventario(id_inventario,fecha_hora DESC);
CREATE INDEX idx_reserva_cliente_estado ON reserva(id_cliente,estado,fecha_reserva DESC);
CREATE INDEX idx_reserva_sucursal_estado ON reserva(id_sucursal,estado,fecha_reserva DESC);
CREATE INDEX idx_venta_cliente_fecha ON venta(id_cliente,fecha_venta DESC);
CREATE INDEX idx_venta_sucursal_fecha ON venta(id_sucursal,fecha_venta DESC);
CREATE INDEX idx_pago_estado ON pago(estado);
CREATE INDEX idx_pedido_estado ON pedido(estado);
CREATE INDEX idx_envio_estado ON envio(estado);
CREATE INDEX idx_promocion_vigencia ON promocion(activo,fecha_inicio,fecha_fin);
CREATE INDEX idx_notificacion_usuario_fecha ON notificacion(id_usuario,fecha_creacion DESC);
CREATE INDEX idx_dispositivo_usuario_activo ON dispositivo_usuario(id_usuario) WHERE activo=TRUE;
CREATE INDEX idx_interaccion_cliente_fecha ON interaccion_producto(id_cliente,fecha_hora DESC);
CREATE INDEX idx_recomendacion_cliente_score ON recomendacion(id_cliente,puntuacion DESC,fecha_generacion DESC);
CREATE INDEX idx_bitacora_usuario_fecha ON bitacora(id_usuario,fecha_hora DESC);
CREATE INDEX idx_bitacora_modulo_fecha ON bitacora(modulo,fecha_hora DESC);
CREATE INDEX idx_bitacora_request_id ON bitacora(request_id);

-- 16) VISTAS
CREATE VIEW vw_inventario_disponible AS
SELECT i.id_inventario,i.id_sucursal,i.id_variante,i.stock_fisico,i.stock_reservado,
       (i.stock_fisico-i.stock_reservado) AS stock_disponible,i.stock_minimo,
       CASE WHEN (i.stock_fisico-i.stock_reservado)=0 THEN 'AGOTADO'
            WHEN (i.stock_fisico-i.stock_reservado)<=i.stock_minimo THEN 'STOCK_BAJO'
            ELSE 'DISPONIBLE' END AS estado_stock
FROM inventario_sucursal i;

CREATE VIEW vw_producto_precio_actual AS
SELECT DISTINCT ON (id_producto) id_producto,precio,fecha_inicio
FROM historial_precio WHERE fecha_fin IS NULL ORDER BY id_producto,fecha_inicio DESC;

-- 17) DATOS INICIALES
INSERT INTO rol(nombre,descripcion) VALUES
('ADMIN','Dueño/Administrador'),('CLIENTE','Cliente'),('ENCARGADO_SUCURSAL','Encargado operativo'),('CAJERO','Empleado de ventas y pagos'),('AUXILIAR_INVENTARIO','Empleado de inventario y recepciones')
ON CONFLICT(nombre) DO NOTHING;

INSERT INTO talla(codigo,orden) VALUES ('S',1),('M',2),('L',3),('XL',4) ON CONFLICT(codigo) DO NOTHING;
INSERT INTO categoria(nombre,descripcion) VALUES ('POLERA','Prenda superior tipo polera'),('POLO','Prenda superior tipo polo'),('CAMISA','Prenda superior tipo camisa'),('BLUSA','Prenda superior para mujer') ON CONFLICT(nombre) DO NOTHING;
INSERT INTO marca(nombre,descripcion,pais_origen) VALUES
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
INSERT INTO color(nombre,codigo_hex) VALUES
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
INSERT INTO temporada(nombre,anio,fecha_inicio,fecha_fin) VALUES
('Permanente',NULL,NULL,NULL),
('Otoño-Invierno 2026',2026,'2026-03-21','2026-09-20'),
('Primavera-Verano 2026-2027',2026,'2026-09-21','2027-03-20');

INSERT INTO coleccion(id_temporada,nombre,descripcion)
SELECT t.id_temporada,'Clásicos Esenciales','Prendas clásicas y versátiles disponibles durante todo el año.'
FROM temporada t WHERE t.nombre='Permanente' AND t.anio IS NULL
ORDER BY t.id_temporada LIMIT 1;
INSERT INTO coleccion(id_temporada,nombre,descripcion)
SELECT t.id_temporada,'Deportiva Urbana','Prendas deportivas y casuales para el uso cotidiano.'
FROM temporada t WHERE t.nombre='Permanente' AND t.anio IS NULL
ORDER BY t.id_temporada LIMIT 1;
INSERT INTO coleccion(id_temporada,nombre,descripcion)
SELECT t.id_temporada,'Otoño-Invierno 2026','Selección para la temporada de clima fresco de 2026.'
FROM temporada t WHERE t.nombre='Otoño-Invierno 2026' AND t.anio=2026
ORDER BY t.id_temporada LIMIT 1;
INSERT INTO coleccion(id_temporada,nombre,descripcion)
SELECT t.id_temporada,'Primavera-Verano 2026-2027','Selección para la temporada cálida 2026-2027.'
FROM temporada t WHERE t.nombre='Primavera-Verano 2026-2027' AND t.anio=2026
ORDER BY t.id_temporada LIMIT 1;
INSERT INTO metodo_pago(codigo,nombre,tipo) VALUES ('EFECTIVO','Efectivo','EFECTIVO'),('QR','Pago QR','QR'),('STRIPE','Stripe','PASARELA') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO tarifa_envio(tarifa_base,distancia_base_km,costo_km_adicional,activo)
SELECT 5,1,2.5,TRUE WHERE NOT EXISTS(SELECT 1 FROM tarifa_envio WHERE activo=TRUE);
INSERT INTO configuracion_recomendador(peso_categoria,peso_marca,peso_color,peso_talla,peso_temporada,peso_promocion,activo)
SELECT 40,20,15,10,10,5,TRUE WHERE NOT EXISTS(SELECT 1 FROM configuracion_recomendador WHERE activo=TRUE);

INSERT INTO permiso(codigo,nombre,modulo) VALUES
('empleados.ver','Ver empleados','SEGURIDAD'),('empleados.crear','Crear empleados','SEGURIDAD'),('empleados.editar','Editar empleados','SEGURIDAD'),('permisos.asignar','Asignar permisos','SEGURIDAD'),
('sucursales.ver','Ver sucursales','ORGANIZACION'),('sucursales.crear','Crear sucursales','ORGANIZACION'),('sucursales.editar','Editar sucursales','ORGANIZACION'),
('productos.ver','Ver productos','CATALOGO'),('productos.crear','Crear productos','CATALOGO'),('productos.editar','Editar productos','CATALOGO'),
('inventario.ver','Ver inventario','INVENTARIO'),('inventario.movimiento','Registrar movimientos','INVENTARIO'),('recepcion.registrar','Registrar recepción','INVENTARIO'),
('proveedores.ver','Ver proveedores','PROVEEDORES'),('proveedores.gestionar','Gestionar proveedores','PROVEEDORES'),
('reservas.ver','Ver reservas','RESERVAS'),('reservas.gestionar','Gestionar reservas','RESERVAS'),
('ventas.ver','Ver ventas','VENTAS'),('ventas.crear','Registrar ventas','VENTAS'),('pagos.registrar','Registrar pagos','PAGOS'),('promociones.gestionar','Gestionar promociones','MARKETING')
ON CONFLICT(codigo) DO NOTHING;

INSERT INTO rol_permiso(id_rol,id_permiso)
SELECT r.id_rol,p.id_permiso FROM rol r CROSS JOIN permiso p WHERE r.nombre='ADMIN'
ON CONFLICT(id_rol,id_permiso) DO NOTHING;

INSERT INTO rol_permiso(id_rol,id_permiso)
SELECT r.id_rol,p.id_permiso FROM rol r JOIN permiso p ON p.codigo IN ('ventas.ver','ventas.crear','pagos.registrar','productos.ver') WHERE r.nombre='CAJERO'
ON CONFLICT(id_rol,id_permiso) DO NOTHING;

INSERT INTO rol_permiso(id_rol,id_permiso)
SELECT r.id_rol,p.id_permiso FROM rol r JOIN permiso p ON p.codigo IN ('inventario.ver','reservas.ver','reservas.gestionar','ventas.ver','productos.ver','proveedores.ver','sucursales.ver') WHERE r.nombre='ENCARGADO_SUCURSAL'
ON CONFLICT(id_rol,id_permiso) DO NOTHING;

INSERT INTO rol_permiso(id_rol,id_permiso)
SELECT r.id_rol,p.id_permiso FROM rol r JOIN permiso p ON p.codigo IN ('inventario.ver','inventario.movimiento','recepcion.registrar') WHERE r.nombre='AUXILIAR_INVENTARIO'
ON CONFLICT(id_rol,id_permiso) DO NOTHING;

-- COMMIT trasladado al final de las correcciones V2 para conservar atomicidad.

-- Pruebas de tarifa:
-- SELECT capricho.fn_calcular_costo_envio(0.5); -- 5.00
-- SELECT capricho.fn_calcular_costo_envio(1.0); -- 5.00
-- SELECT capricho.fn_calcular_costo_envio(2.0); -- 7.50
-- SELECT capricho.fn_calcular_costo_envio(3.0); -- 10.00

-- Contexto sugerido desde FastAPI antes de operaciones auditables:
-- SET LOCAL app.usuario_id = '1';
-- SET LOCAL app.sesion_id = 'session-uuid';
-- SET LOCAL app.ip = '181.115.10.20';
-- SET LOCAL app.user_agent = 'CaprichoStore/1.0';
-- SET LOCAL app.origen = 'WEB';
-- SET LOCAL app.request_id = 'request-uuid';


-- INICIO DE CORRECCIONES V2 INTEGRADAS
-- ============================================================================
-- CAPRICHO STORE - CORRECCIONES INCREMENTALES V2
-- PostgreSQL 16+
--
-- Integradas en este archivo canonico. No ejecutar adicionalmente el archivo
-- historico archive/capricho_store_correcciones_v2.sql en instalaciones nuevas.
-- No elimina tablas ni datos. Toda la migracion es atomica: si alguna
-- validacion falla, PostgreSQL revierte todos los cambios de este archivo.
-- ============================================================================

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

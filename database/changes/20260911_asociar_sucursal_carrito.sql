-- Asocia el carrito activo a una sucursal física de retiro o despacho.
-- Permite implementar la regla monotienda (1 Carrito = 1 Sucursal) para evitar conflictos de stock.

BEGIN;
SET LOCAL search_path TO capricho, public;

ALTER TABLE carrito
  ADD COLUMN IF NOT EXISTS id_sucursal BIGINT REFERENCES sucursal(id_sucursal) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_carrito_sucursal
  ON carrito(id_sucursal);

COMMIT;

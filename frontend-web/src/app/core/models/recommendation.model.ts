export type InteractionType =
  | 'VER_PRODUCTO'
  | 'AGREGAR_CARRITO'
  | 'QUITAR_CARRITO'
  | 'USAR_VESTIDOR'
  | 'COMPRAR';

export interface RecommendationConfig {
  id_configuracion: number;
  peso_categoria: number;
  peso_marca: number;
  peso_color: number;
  peso_talla: number;
  peso_temporada: number;
  peso_promocion: number;
  activo: boolean;
  created_at: string;
  suma_pesos: number;
}

export interface RecommendationConfigUpdate {
  peso_categoria: number;
  peso_marca: number;
  peso_color: number;
  peso_talla: number;
  peso_temporada: number;
  peso_promocion: number;
}

export interface RecommendedProduct {
  id_producto: number;
  nombre: string;
  categoria: string;
  marca: string;
  precio_actual: string | number | null;
  descuento_porcentaje?: number | null;
  precio_promocional?: string | number | null;
  imagen_url?: string | null;
  puntuacion: number;
  motivo?: string | null;
  desglose?: Record<string, number> | null;
}

export interface RecommendationStats {
  total_interacciones: number;
  interacciones_por_tipo: Record<string, number>;
  clientes_con_interacciones: number;
  pesos_activos: Record<string, number>;
}

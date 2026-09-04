export type TargetAudience = 'HOMBRE' | 'MUJER';
export type StockStatus = 'DISPONIBLE' | 'STOCK_BAJO' | 'AGOTADO';
export type ProductSort =
  'nombre' | '-nombre' | 'precio' | '-precio' | 'created_at' | '-created_at';

export interface Category {
  id_categoria: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}
export interface Brand {
  id_marca: number;
  nombre: string;
  descripcion: string | null;
  pais_origen: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}
export interface Size {
  id_talla: number;
  codigo: 'S' | 'M' | 'L' | 'XL';
  orden: number;
  activo: boolean;
}
export interface Color {
  id_color: number;
  nombre: string;
  codigo_hex: string | null;
  activo: boolean;
}
export interface Season {
  id_temporada: number;
  nombre: string;
  anio: number | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id_imagen: number;
  id_producto: number;
  proveedor_storage: string;
  public_id: string;
  secure_url: string;
  tipo: 'CATALOGO' | 'MINIATURA' | 'PROMOCIONAL';
  orden: number;
  es_principal: boolean;
  formato: string | null;
  ancho_px: number | null;
  alto_px: number | null;
  created_at: string;
}

export interface ProductVariant {
  id_variante: number;
  id_producto: number;
  id_talla: number;
  talla: string;
  id_color: number;
  color: string;
  codigo_hex: string | null;
  sku: string;
  codigo_barras: string | null;
  activo: boolean;
  stock_disponible?: number | null;
  estado_stock?: StockStatus | null;
}

export interface Product {
  id_producto: number;
  id_categoria: number;
  categoria: string;
  id_marca: number;
  marca: string;
  nombre: string;
  descripcion: string | null;
  publico_objetivo: TargetAudience;
  permite_vestidor: boolean;
  activo: boolean;
  precio_actual: string | null;
  imagen_principal: ProductImage | null;
  variantes: ProductVariant[];
  tallas_disponibles: string[];
  colores_disponibles: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductPage {
  items: Product[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface ProductMeasurement {
  id_medida: number;
  id_producto: number;
  id_talla: number;
  talla: string;
  ancho_hombros_cm: string | null;
  ancho_pecho_cm: string | null;
  largo_prenda_cm: string | null;
  largo_manga_cm: string | null;
}

export interface CatalogFilters {
  categoria?: string;
  publico_objetivo?: TargetAudience;
  marca?: string;
  talla?: string;
  color?: string;
  temporada?: string;
  sucursal?: number;
  permite_vestidor?: boolean;
  activo?: boolean;
  page?: number;
  page_size?: number;
  sort?: ProductSort;
}

export interface CatalogOptions {
  categories: Category[];
  brands: Brand[];
  sizes: Size[];
  colors: Color[];
  seasons: Season[];
}

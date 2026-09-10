# Product

<!-- impeccable:product-schema 1 -->

## Platform

web, Android e iOS

## Stack

Angular moderno para la Web y Flutter/Dart para Android e iOS. Ambas interfaces
consumen exclusivamente la API FastAPI existente; ninguna accede directamente
a PostgreSQL.

## Users

Personas que navegan una tienda de ropa desde escritorio, laptop, tablet o
teléfono y necesitan descubrir prendas por público, categoría, marca, talla,
color, temporada y sucursal. Los clientes registrados pueden gestionar su
identidad. El personal autorizado opera empleados, catálogo, compras,
recepciones e inventario desde un único panel adaptado a permisos efectivos.

## Product Purpose

Capricho Store ofrece descubrimiento de ropa, autenticación segura, compra y
reserva para clientes, además de un panel administrativo/operativo para los
Ciclos I y II. Angular consume únicamente FastAPI y adapta rutas, navegación y
acciones a los permisos efectivos del usuario.

## Positioning

El catálogo y los flujos comerciales reflejan la estructura, precios,
disponibilidad y operaciones expuestas por la API de Capricho Store, sin
inventar promociones ni capacidades externas que el backend no ofrece.

## Operating Context

La aplicación Angular consume FastAPI mediante una única URL base configurable.
FastAPI es la única vía de acceso a PostgreSQL. La experiencia pública incluye
inicio, catálogo, detalle, identidad, carrito, checkout, reservas, pedidos,
historial, direcciones, devoluciones y notificaciones operativas.

## Capabilities and Constraints

- Endpoints confirmados de autenticación: registro, login y usuario actual.
- Endpoints públicos confirmados para productos, categorías, marcas, tallas,
  colores y temporadas.
- El catálogo oficial se limita a las categorías `POLERA`, `CAMISA`, `POLO` y
  `BLUSA`.
- `POLERA`, `CAMISA` y `POLO` admiten público objetivo `HOMBRE` o `MUJER`.
- `BLUSA` admite únicamente público objetivo `MUJER`.
- Categoría y público objetivo son dimensiones separadas; no existen categorías
  compuestas como `POLERA_HOMBRE` o `POLERA_MUJER`.
- No existen dentro del alcance actual calzado, pantalones, vestidos, enterizos,
  chaquetas, accesorios, faldas, shorts, bolsos ni otras categorías.
- El access token se envía como Bearer y no existe refresh token.
- Ciclo II reutiliza las tablas PostgreSQL existentes sin modificar el esquema.
- El panel del Ciclo I cubre empleados, catálogo, proveedores, órdenes de
  compra, recepciones, inventario, lotes, movimientos, ajustes y transferencias.
- El Ciclo II Web incorpora carrito, reservas por sucursal, venta presencial,
  pedidos con retiro o delivery, devolución, historial de compra y consulta de
  compras a proveedores.
- Las reservas y ventas validan disponibilidad y actualizan existencias y lotes
  mediante transacciones; las salidas consumen capas FIFO.
- La cotización local de delivery usa coordenadas y distancia geográfica. La
  integración con un proveedor de rutas queda preparada, pero no forma parte del
  alcance implementado.
- Las notificaciones se registran como pendientes; el envío por correo o push
  requiere un proveedor externo y queda fuera del alcance actual.
- Quedan fuera promociones, campañas, pagos externos y recomendador. En Flutter,
  cámara, MediaPipe y vestidor virtual permanecen para una etapa posterior.

## Brand Commitments

El nombre del producto es Capricho Store. La experiencia debe sentirse como una
tienda de ropa moderna, limpia y cuidada, con lenguaje en español y sin aspecto
de plantilla genérica o dashboard artificial.

## Evidence on Hand

El contrato OpenAPI del backend local y los datos reales que este devuelva son
la única fuente para funcionalidades, filtros, productos y disponibilidad. No
hay todavía fotografías de marca, campañas, promociones, testimonios ni
afirmaciones comerciales verificadas; cualquier imagen de desarrollo debe
identificarse como contenido de muestra y representar únicamente poleras,
camisas, polos o blusas compatibles con su público objetivo.

## Product Principles

1. La API existente define la verdad funcional.
2. Descubrir productos debe ser claro antes que ornamental.
3. Cada estado de carga, vacío, error y autenticación debe estar resuelto.
4. El lenguaje visual debe escalar a futuros módulos sin parecer administrativo.
5. Ninguna acción visible debe prometer una capacidad aún no implementada.

## Accessibility & Inclusion

La Web debe ofrecer navegación por teclado y foco visible. Web y Mobile deben
mantener contraste suficiente, etiquetas persistentes, mensajes de error
comprensibles, semántica adecuada, áreas táctiles nativas y respeto por las
preferencias de accesibilidad del sistema.

## Mobile Scope

Flutter conserva el alcance completado del Ciclo I. Los nuevos flujos de carrito,
reservas, compra, pedidos y devoluciones se implementan únicamente en Angular
durante el Ciclo II; no se amplía Android ni iOS en esta entrega.

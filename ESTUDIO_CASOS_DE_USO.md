# 📚 GUÍA MAESTRA DE CASOS DE USO - CAPRICHO STORE
> **Documento local de estudio y preparación de examen.**
> Contiene el mapeo integral de los 20 Casos de Uso del sistema: Arquitectura, Rutas Frontend (Móvil Flutter y Web Angular), Rutas Backend (FastAPI, Servicios, Repositorios), Tablas de Base de Datos PostgreSQL y Explicación Detallada de la Lógica de Negocio.

---

## 📑 TABLA RESUMEN DE CASOS DE USO

| Código | Nombre del Caso de Uso | Actor(es) Principal(es) | Prioridad | Módulo Backend Principal |
| :--- | :--- | :--- | :--- | :--- |
| **CU-01** | Gestionar acceso y perfil de usuario | Visitante / Cliente / Admin / Encargado / Cajero / Auxiliar | **Alta** | `app/modules/auth/` |
| **CU-02** | Administrar personal, roles y seguridad | Administrador | **Alta** | `app/modules/employees/` y `auth/` |
| **CU-03** | Administrar ciudades y sucursales | Administrador | **Media** | `app/modules/catalog/` y `inventory/` |
| **CU-04** | Consultar catálogo de prendas | Visitante / Cliente | **Alta** | `app/modules/catalog/` |
| **CU-05** | Administrar catálogo de productos | Administrador | **Alta** | `app/modules/catalog/` |
| **CU-06** | Gestionar proveedores y abastecimiento | Admin / Encargado / Auxiliar de Inventario | **Alta** | `app/modules/inventory/` |
| **CU-07** | Gestionar inventario entre sucursales | Encargado de Sucursal / Auxiliar de Inventario | **Alta** | `app/modules/inventory/` |
| **CU-08** | Recuperar acceso a la cuenta | Cliente | **Alta** | `app/modules/auth/` |
| **CU-09** | Gestionar carrito y entrega | Cliente | **Alta** | `app/modules/commerce/` |
| **CU-10** | Gestionar reservas de prendas | Cliente / Encargado de Sucursal / Cajero | **Alta** | `app/modules/commerce/` |
| **CU-11** | Registrar venta en punto de venta (POS) | Cajero | **Alta** | `app/modules/commerce/` |
| **CU-12** | Procesar compra, pago y facturación | Cliente | **Alta** | `app/modules/commerce/` |
| **CU-13** | Gestionar pedidos y seguimiento | Cliente / Encargado de Sucursal | **Alta** | `app/modules/commerce/` |
| **CU-14** | Gestionar devoluciones | Cliente / Cajero / Encargado de Sucursal | **Media** | `app/modules/commerce/` |
| **CU-15** | Controlar existencias | Encargado de Sucursal / Auxiliar de Inventario | **Alta** | `app/modules/inventory/` |
| **CU-16** | Consultar y exportar reportes | Administrador | **Media** | `app/modules/commerce/` y `audit/` |
| **CU-17** | Gestionar recomendaciones inteligentes | Cliente / Administrador | **Media** | `app/modules/recommendations/` |
| **CU-18** | Utilizar probador virtual | Cliente | **Media** | `mobile/lib/features/fitting/` |
| **CU-19** | Gestionar promociones y campañas | Administrador | **Media** | `app/modules/catalog/` |
| **CU-20** | Gestionar notificaciones push | Cliente | **Media** | `app/modules/commerce/` |

---

## 🔍 DETALLE COMPLETO DE CASOS DE USO (ARQUITECTURA Y LÓGICA)

---

### CU-01: Gestionar acceso y perfil de usuario
- **Actor Principal:** Visitante / Cliente / Administrador / Encargado de Sucursal / Cajero / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Pantallas: `mobile/lib/features/auth/presentation/login_screen.dart`, `register_screen.dart`, `profile_screen.dart`
    - Estado & Repositorio: `mobile/lib/features/auth/presentation/auth_controller.dart`, `mobile/lib/features/auth/data/auth_repository.dart`
  - **Web (Angular):**
    - Componentes: `frontend-web/src/app/features/auth/login.ts`, `register.ts`
    - Servicio: `frontend-web/src/app/core/auth/auth.service.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/auth/router.py` (`POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `GET /api/v1/auth/me`, `PATCH /api/v1/auth/profile`, `POST /api/v1/auth/avatar`)
  - Servicio: `backend/app/modules/auth/service.py` (`AuthService`)
  - Seguridad & Throttler: `backend/app/modules/auth/throttler.py` (`RedisLoginThrottler`)
  - Repositorio: `backend/app/modules/auth/repository.py` (`AuthRepository`)
  - Modelos DB: `Usuario`, `Rol`, `UsuarioRol` en `backend/app/modules/auth/models.py`.
- **Lógica de Negocio Explicada:**
  1. **Registro:** Valida unicidad de correo y CI en PostgreSQL; aplica hashing de contraseña con **Argon2id** y asigna el rol base `CLIENTE`.
  2. **Login & Seguridad Progresiva:** Verifica credenciales contra el hash. Si falla:
     - 3er fallo: Activa pausa de seguridad de **1 minuto** (HTTP 429).
     - 6to fallo: Activa pausa de seguridad de **5 minutos** (HTTP 429).
     - 9no fallo: Bloquea permanentemente la cuenta en PostgreSQL (`Usuario.estado = 'BLOQUEADO'`) y responde HTTP 403.
  3. **Sesión:** Emite token **JWT (HS256)** con expiración y registra IP, User-Agent y timestamp en `AuditContext`.

---

### CU-02: Administrar personal, roles y seguridad
- **Actor Principal:** Administrador
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/employees-admin.ts`, `frontend-web/src/app/core/permissions/permission.service.ts`
  - **Móvil (Flutter):** `mobile/lib/features/admin/presentation/admin_profile_screen.dart`
- **Ruta Backend:**
  - Router: `backend/app/modules/employees/router.py` (`GET /api/v1/empleados`, `POST /api/v1/empleados`, `PATCH /api/v1/empleados/{id}`, `PATCH /api/v1/empleados/{id}/estado`, `GET /api/v1/roles`)
  - Servicio: `backend/app/modules/employees/service.py` (`EmployeeService`)
  - Repositorio: `backend/app/modules/employees/repository.py` (`EmployeeRepository`)
  - Modelos DB: `Empleado`, `Rol`, `Permiso`, `RolPermiso`, `UsuarioPermiso`, `Sucursal` en `backend/app/modules/auth/models.py`.
- **Lógica de Negocio Explicada:**
  1. Permite crear empleados vinculados a una sucursal específica con un cargo y rol operativo (`ENCARGADO_SUCURSAL`, `CAJERO`, `AUXILIAR_INVENTARIO`).
  2. **RBAC Dinámico:** La función `resolve_effective_permissions` une los permisos otorgados por el rol (`RolPermiso`) y aplica sobreescrituras individuales (`UsuarioPermiso.otorgado = True/False`).
  3. Control de concurrencia y auditoría: solo un administrador activo con permiso `empleados.gestionar` puede dar de alta o cambiar el estado del personal.

---

### CU-03: Administrar ciudades y sucursales
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/branches-admin.ts` (con integración de mapas Leaflet y geocodificación GPS).
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (`GET /api/v1/branches`, `GET /api/v1/branches/admin`, `POST /api/v1/branches`, `PATCH /api/v1/branches/{id}`, `GET /api/v1/cities`, `POST /api/v1/cities`)
  - Servicio: `backend/app/modules/catalog/service.py` (`list_branches_admin`, `create_branch`, `update_branch`)
  - Repositorio: `backend/app/modules/catalog/repository.py`
  - Modelos DB: `Ciudad`, `Sucursal` en `backend/app/modules/auth/models.py`.
- **Lógica de Negocio Explicada:**
  1. Modela las sedes físicas de la cadena Capricho Store.
  2. Cada sucursal tiene ciudad, dirección, teléfono, coordenadas geográficas (`latitud`, `longitud`), horarios de atención (`hora_apertura`, `hora_cierre`) y estado activo.
  3. Las coordenadas son fundamentales para el cálculo de distancias y costo de envío a domicilio en el módulo de comercio.

---

### CU-04: Consultar catálogo de prendas
- **Actor Principal:** Visitante / Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - `mobile/lib/features/catalog/presentation/catalog_screen.dart`
    - `mobile/lib/features/catalog/presentation/product_detail_screen.dart`
    - `mobile/lib/features/catalog/data/catalog_repository.dart`
  - **Web (Angular):** `frontend-web/src/app/features/catalog/`
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (`GET /api/v1/products`, `GET /api/v1/products/{id}`, `GET /api/v1/categories`, `GET /api/v1/brands`, `GET /api/v1/collections`)
  - Servicio: `backend/app/modules/catalog/service.py` (`CatalogService`)
  - Repositorio: `backend/app/modules/catalog/repository.py` (`CatalogRepository`)
  - Modelos DB: `Producto`, `Categoria`, `Marca`, `Coleccion`, `Variante`, `ImagenProducto`, `GuiaTallas`.
- **Lógica de Negocio Explicada:**
  1. Filtra prendas por categoría, género, rango de precios, talla, color y disponibilidad en tiempo real.
  2. Retorna las variantes de cada prenda con sus imágenes en Cloudinary, stock agregado y precios promocionales si existe una campaña activa.
  3. Entrega la tabla de medidas corporales (`GuiaTallas`) para orientar la compra y alimentar el probador virtual.

---

### CU-05: Administrar catálogo de productos
- **Actor Principal:** Administrador
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/catalog-admin.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (`POST /api/v1/products`, `PATCH /api/v1/products/{id}`, `POST /api/v1/products/{id}/variants`, `POST /api/v1/products/{id}/images`)
  - Servicio: `backend/app/modules/catalog/service.py`
  - Integración Cloudinary: `backend/app/integrations/cloudinary.py`
  - Repositorio: `backend/app/modules/catalog/repository.py`
- **Lógica de Negocio Explicada:**
  1. CRUD maestro de prendas de vestir: creación de productos con código SKU, nombre, descripción, marca y categoría.
  2. Generación de matriz de variantes combinando tallas (XS, S, M, L, XL) y colores con su respectivo código de barras.
  3. Subida directa de fotografías a **Cloudinary** con optimización automática de formato (`WebP`) y resolución.

---

### CU-06: Gestionar proveedores y abastecimiento
- **Actor Principal:** Administrador / Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/operations-admin.ts` (sección Proveedores y Órdenes de Compra).
- **Ruta Backend:**
  - Router: `backend/app/modules/inventory/router.py` (`/api/v1/suppliers`, `/api/v1/purchase-orders`, `/api/v1/receipts`)
  - Servicio: `backend/app/modules/inventory/service.py` (`InventoryService`)
  - Repositorio: `backend/app/modules/inventory/repository.py` (`InventoryRepository`)
  - Modelos DB: `Proveedor`, `OrdenCompra`, `DetalleOrdenCompra`, `RecepcionCompra`, `Lote` en `backend/app/modules/inventory/models.py`.
- **Lógica de Negocio Explicada:**
  1. **Orden de Compra:** Se genera un pedido de abastecimiento a un proveedor con fecha estimada y costo unitario pactado.
  2. **Recepción de Mercadería:** Al llegar el camión a la sucursal, el auxiliar registra la recepción física contrastando cantidades pedidas vs. recibidas.
  3. **Ingreso a Stock y Lote:** Cada recepción genera un `Lote` y un `MovimientoInventario` de tipo `ENTRADA_COMPRA`, actualizando el costo promedio ponderado de la prenda.

---

### CU-07: Gestionar inventario entre sucursales
- **Actor Principal:** Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/operations-admin.ts` (pestaña Transferencias).
- **Ruta Backend:**
  - Router: `backend/app/modules/inventory/router.py` (`POST /api/v1/transfers`, `GET /api/v1/transfers`, `PATCH /api/v1/transfers/{id}/status`)
  - Servicio: `backend/app/modules/inventory/service.py` (`create_transfer`, `update_transfer_status`)
  - Repositorio: `backend/app/modules/inventory/repository.py`
  - Modelos DB: `Transferencia`, `DetalleTransferencia`, `InventarioSucursal`, `MovimientoInventario`.
- **Lógica de Negocio Explicada:**
  1. Permite equilibrar stock entre tiendas (ej. enviar 10 pantalones de Sucursal Central a Sucursal Equipetrol).
  2. Flujo de estados con doble verificación:
     - `SOLICITADA` -> Se genera el pedido.
     - `EN_TRANSITO` -> Se descuenta inmediatamente de la sucursal origen y queda en custodia logística.
     - `RECIBIDA` -> La sucursal destino confirma la recepción física y se incrementa su stock local.
     - `CANCELADA` -> Revierte la reserva de stock si la transferencia no se concreta.

---

### CU-08: Recuperar acceso a la cuenta
- **Actor Principal:** Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):** `mobile/lib/features/auth/presentation/password_recovery_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/auth/forgot-password.ts`, `reset-password.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/auth/router.py` (`POST /api/v1/auth/password-recovery/request`, `POST /api/v1/auth/password-recovery/verify`, `POST /api/v1/auth/password-recovery/reset`)
  - Servicio: `backend/app/modules/auth/password_recovery_service.py` (`PasswordRecoveryService`)
  - Almacén temporal: `backend/app/modules/auth/password_recovery.py` (`RedisPasswordResetStore`)
  - Correo Transaccional: `BrevoEmailClient` (API Brevo / Sendinblue).
- **Lógica de Negocio Explicada:**
  1. **Solicitud de Código:** El usuario ingresa su correo. Se genera un código OTP numérico criptográfico de 6 dígitos con vigencia de 10 minutos en Redis.
  2. **Envío:** Se despacha plantilla HTML por Brevo con el código.
  3. **Validación:** Se verifica el OTP limitando a 5 intentos máximos contra fuerza bruta.
  4. **Restablecimiento & Desbloqueo:** Se genera un token de un solo uso (`reset_token`). Al ingresar la nueva contraseña, si la cuenta estaba en estado `BLOQUEADO` (por 9 fallos de login), se restablece automáticamente a `ACTIVO` y se limpian las llaves de castigo en Redis.

---

### CU-09: Gestionar carrito y entrega
- **Actor Principal:** Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/cart_screen.dart`, `addresses_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/commerce/cart/`
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`GET /api/v1/cart`, `POST /api/v1/cart/items`, `DELETE /api/v1/cart/items/{id}`, `GET /api/v1/customers/me/addresses`, `POST /api/v1/customers/me/addresses`, `POST /api/v1/checkout/quote-delivery`)
  - Servicio: `backend/app/modules/commerce/service.py` (`CommerceService`)
  - Georutas & Flete: `backend/app/modules/commerce/openrouteservice.py`
  - Modelos DB: `Carrito`, `ItemCarrito`, `DireccionCliente`.
- **Lógica de Negocio Explicada:**
  1. Carrito sincronizado en base de datos: permite que el cliente agregue prendas desde la app móvil o web y se mantengan persistentes.
  2. Valida stock en tiempo real antes de agregar prendas.
  3. **Cotización de Entrega:** Si el cliente elige envío a domicilio, el sistema calcula la distancia exacta en kilómetros desde la sucursal más cercana hasta las coordenadas de la dirección del cliente usando la API de **OpenRouteService** (con respaldo de fórmula de Haversine) para tarifar el envío.

---

### CU-10: Gestionar reservas de prendas
- **Actor Principal:** Cliente / Encargado de Sucursal / Cajero
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/reservation_bottom_sheet.dart`, `reservations_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/admin/commerce-admin.ts` (pestaña Reservas).
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/reservations`, `GET /api/v1/reservations`, `PATCH /api/v1/reservations/{id}/cancel`, `PATCH /api/v1/reservations/{id}/confirm`)
  - Servicio: `backend/app/modules/commerce/service.py`
  - Regla Días Hábiles: `backend/app/modules/commerce/business_days.py`
  - Modelos DB: `Reserva`, `DetalleReserva`, `InventarioSucursal`.
- **Lógica de Negocio Explicada:**
  1. El cliente reserva una prenda para probarse o retirar en una tienda física sin pagar por adelantado.
  2. **Regla de 48 Horas Hábiles:** El sistema calcula la fecha de vencimiento saltando fines de semana y feriados oficiales gracias a `business_days.py`.
  3. Durante la vigencia, la prenda queda retenida (`stock_reservado`), impidiendo que otro cliente la compre.
  4. Si el cliente acude a tienda, el cajero puede convertir la reserva directamente en venta POS (CU-11). Si expira, un cron job libera el stock automáticamente.

---

### CU-11: Registrar venta en punto de venta (POS)
- **Actor Principal:** Cajero
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/commerce-admin.ts` (módulo de terminal de ventas POS).
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/sales/pos`, `GET /api/v1/sales/daily`)
  - Servicio: `backend/app/modules/commerce/service.py` (`create_pos_sale`)
  - Facturación: `backend/app/modules/commerce/invoice_service.py`
  - Modelos DB: `Venta`, `DetalleVenta`, `Factura`, `MovimientoInventario`.
- **Lógica de Negocio Explicada:**
  1. Diseñado para la atención en mostrador físico: el cajero escanea códigos de barra o selecciona variantes.
  2. Soporta modalidades de pago: Efectivo (calcula cambio), QR o Tarjeta de débito/crédito.
  3. Si proviene de una reserva previa, valida su vigencia y consume la reserva.
  4. En una sola transacción ACID: descuenta existencias físicas en `InventarioSucursal`, registra `MovimientoInventario` (`SALIDA_VENTA`), emite la factura electrónica con código CUF/hash y genera el comprobante de venta.

---

### CU-12: Procesar compra, pago y facturación
- **Actor Principal:** Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/checkout_screen.dart`, `checkout_complete_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/commerce/checkout/`
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/checkout/create-intent`, `POST /api/v1/checkout/webhook`, `GET /api/v1/invoices/{id}/pdf`)
  - Pasarela de Pago: `backend/app/modules/commerce/stripe_checkout_service.py` (Stripe PaymentIntent / Webhooks)
  - Facturación Electrónica: `backend/app/modules/commerce/invoice_service.py`
  - Despacho de Correo: `backend/app/modules/commerce/invoice_mailer.py`
- **Lógica de Negocio Explicada:**
  1. El cliente confirma su pedido en línea (con opción de retiro en tienda o envío a domicilio).
  2. Se crea una sesión segura en **Stripe**; al completar el pago, el Webhook oficial de Stripe notifica al backend en segundo plano con firma criptográfica (`stripe_webhook_secret`).
  3. El backend confirma el pedido, descuenta stock de la sucursal asignada, genera la factura con datos de NIT/Razón Social y despacha el PDF de la factura al correo del cliente mediante `InvoiceMailer`.

---

### CU-13: Gestionar pedidos y seguimiento
- **Actor Principal:** Cliente / Encargado de Sucursal
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/orders_screen.dart`, `order_detail_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/admin/commerce-admin.ts` (gestión de envíos y paquetería).
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`GET /api/v1/orders`, `GET /api/v1/orders/{id}`, `PATCH /api/v1/orders/{id}/status`)
  - Servicio: `backend/app/modules/commerce/service.py` (`update_order_status`)
  - Modelos DB: `Pedido`, `DetallePedido`, `SeguimientoPedido`, `Notificacion`.
- **Lógica de Negocio Explicada:**
  1. Máquina de estados de pedido con trazabilidad:
     `PAGADO` ➔ `PREPARANDO` ➔ `EN_CAMINO` ➔ `ENTREGADO` (o `LISTO_PARA_RETIRO`).
  2. Cada transición registra fecha, hora, responsable y coordenadas de despacho.
  3. Cada cambio de estado dispara automáticamente una **notificación push FCM** y correo al cliente para que siga el trayecto de su ropa en tiempo real.

---

### CU-14: Gestionar devoluciones
- **Actor Principal:** Cliente / Cajero / Encargado de Sucursal
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/commerce-admin.ts` (pestaña Devoluciones).
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/returns`, `GET /api/v1/returns`, `PATCH /api/v1/returns/{id}/approve`)
  - Servicio: `backend/app/modules/commerce/service.py` (`process_return`)
  - Modelos DB: `Devolucion`, `DetalleDevolucion`, `NotaCredito`, `MovimientoInventario`.
- **Lógica de Negocio Explicada:**
  1. Regla de negocio comercial: el cliente tiene un plazo máximo de **7 días hábiles** desde la entrega para solicitar cambio de talla o devolución.
  2. Validación de estado de la prenda: si la prenda está intacta, se reingresa a existencias (`ENTRADA_DEVOLUCION`). Si viene dañada de fábrica, se destina a merma/baja técnica.
  3. Emisión contable: genera una Nota de Crédito vinculada a la factura original para cuadre fiscal.

---

### CU-15: Controlar existencias
- **Actor Principal:** Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/operations-admin.ts` (módulo de Inventario y Existencias).
- **Ruta Backend:**
  - Router: `backend/app/modules/inventory/router.py` (`GET /api/v1/inventory`, `POST /api/v1/adjustments`, `PATCH /api/v1/minimum-stock`, `GET /api/v1/movements`, `GET /api/v1/lots`)
  - Servicio: `backend/app/modules/inventory/service.py`
  - Repositorio: `backend/app/modules/inventory/repository.py`
  - Modelos DB: `InventarioSucursal`, `MovimientoInventario`, `AjusteInventario`, `Lote`.
- **Lógica de Negocio Explicada:**
  1. **Kardex Físico Valorado:** Cada unidad que entra o sale de la tienda queda documentada con su tipo de movimiento (`ENTRADA_COMPRA`, `SALIDA_VENTA`, `TRANSFERENCIA_ORIGEN`, `AJUSTE_MERMA`, etc.).
  2. **Alertas de Stock Mínimo:** Dispara alertas visuales cuando el stock desciende por debajo del umbral de seguridad fijado para la prenda.
  3. **Ajustes de Inventario:** Permite registrar recuentos físicos periódicos (cuadres de caja/estantería), asentando pérdidas, robos o diferencias de conteo con justificación obligatoria.

---

### CU-16: Consultar y exportar reportes
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/dashboard.ts`, `audit-admin.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`GET /api/v1/dashboard/metrics`), `backend/app/modules/audit/router.py` (`GET /api/v1/audit/logs`)
  - Servicio: `backend/app/modules/commerce/service.py` (`get_dashboard_metrics`), `backend/app/modules/audit/service.py`
- **Lógica de Negocio Explicada:**
  1. Genera indicadores clave de rendimiento (KPIs): Total de ingresos diarios/mensuales, ticket promedio, prendas más vendidas, rotación de inventario por sucursal y comparativa entre tiendas.
  2. Registro inmutable de auditoría (`AuditLog`): monitorea qué usuario hizo qué acción, en qué momento, desde qué IP y sobre qué entidad.
  3. Exportación de listados a formatos tabulares (Excel/CSV) para contabilidad y gerencia.

---

### CU-17: Gestionar recomendaciones inteligentes
- **Actor Principal:** Cliente / Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter):** Carrusel interactivo en `mobile/lib/features/catalog/presentation/product_detail_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/admin/recommendations-admin.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/recommendations/router.py` (`GET /api/v1/recommendations/product/{id}`, `GET /api/v1/recommendations/user`)
  - Servicio: `backend/app/modules/recommendations/service.py` (`RecommendationService`)
  - Repositorio: `backend/app/modules/recommendations/repository.py`
  - Modelos DB: `PreferenciaCliente`, `HistorialVistas`, `ReglaAsociacion`.
- **Lógica de Negocio Explicada:**
  1. Motor híbrido de recomendación:
     - **Filtrado Basado en Contenido:** Analiza afinidad de categoría, corte, material y paleta de colores de las prendas que el cliente visualiza.
     - **Filtrado Colaborativo / Co-ocurrencia:** Recomienda prendas que otros clientes compraron frecuentemente juntas (cross-selling, ej. polo + bermuda o jeans + cinturón).
  2. Ajusta los pesos de afinidad según el historial de compras previas del cliente registrado.

---

### CU-18: Utilizar probador virtual
- **Actor Principal:** Cliente
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter & Native):**
    - Pantalla Principal: `mobile/lib/features/fitting/presentation/virtual_fitting_screen.dart`
    - Superposición y Pintor: `mobile/lib/features/fitting/presentation/fitting_overlay_painter.dart`, `garment_ar_overlay.dart`
    - Motor de Visión iOS: `mobile/ios/Runner/AppDelegate.swift` (Apple Vision Framework / VNDetectHumanBodyPoseRequest)
    - Motor de Visión Android: Google ML Kit Pose Detection.
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (proporciona variantes, medidas de la prenda y asset PNG sin fondo de la prenda almacenado en Cloudinary).
- **Lógica de Negocio Explicada:**
  1. **Detección de Pose en Tiempo Real:** Reconoce puntos clave anatómicos (hombros, cuello, pecho y caderas) a 30 FPS.
  2. **Calibración Antropométrica:**
     - Aplica escala FOV calibrada (168.0 para hombres con base de 47cm en hombros = Talla L; 148.0 para mujeres con base de 36cm = Talla S).
     - Razón de distancia y silueta estarcido (0.32) para indicar al usuario si debe acercarse o alejarse.
  3. **Recomendación Inteligente de Talla:** Estima el ancho biacromial en centímetros reales y sugiere la talla idónea (S, M, L, XL).
  4. **Superposición AR:** Ancla la prenda a la orientación y ángulo del torso del usuario en el espejo con corrección de rotación EXIF de cámara.

---

### CU-19: Gestionar promociones y campañas
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/promotions-admin.ts`, `campaigns-admin.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (`/api/v1/promotions`, `/api/v1/campaigns`)
  - Servicio: `backend/app/modules/catalog/service.py` (`create_promotion`, `apply_campaign_discounts`)
  - Repositorio: `backend/app/modules/catalog/repository.py`
  - Modelos DB: `Promocion`, `Campana`, `PromocionProducto`.
- **Lógica de Negocio Explicada:**
  1. Configuración de reglas comerciales temporales: Descuento porcentual directo (ej. 20% OFF en temporada de invierno), monto fijo o promociones compuestas tipo 2x1 o liquidación.
  2. Control de vigencia: rango estricto de fechas (`fecha_inicio`, `fecha_fin`) y límite de presupuesto o cupos.
  3. Aplicación automática: al consultar el catálogo o añadir al carrito, el motor evalúa si la prenda aplica a la campaña activa y descuenta el precio en tiempo real.

---

### CU-20: Gestionar notificaciones push
- **Actor Principal:** Cliente
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Pantalla: `mobile/lib/features/commerce/presentation/notifications_screen.dart`
    - Receptor Push: `mobile/lib/core/services/notification_service.dart` (Firebase Messaging & Local Notifications)
  - **Web (Angular):** `frontend-web/src/app/features/admin/notifications-admin.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/fcm/token`, `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/send`)
  - Emisor Firebase: `backend/app/modules/commerce/fcm_sender.py` (`send_fcm_notification`)
  - Servicio: `backend/app/modules/commerce/service.py`
  - Modelos DB: `Notificacion`, `DispositivoFCM`, `Usuario`.
- **Lógica de Negocio Explicada:**
  1. **Registro del Dispositivo:** Al iniciar sesión en el teléfono, la app envía su token FCM al backend (`POST /fcm/token`).
  2. **Disparadores Automatizados:** Eventos de negocio (pedido despachado, reserva por vencer, nueva campaña de temporada) generan un registro en la tabla `Notificacion`.
  3. **Despacho Multicanal:** El servicio invoca `fcm_sender.py` con credenciales de cuenta de servicio de Firebase para enviar la alerta push directamente a la barra de estado de Android / iOS, guardando el estado (`ENVIADO`, `ENTREGADO`, `LEIDO`).

---

## 🏛️ RESUMEN ARQUITECTÓNICO DEL SISTEMA

```
┌──────────────────────────────────────────────────────────────┐
│                      CAPRICHO STORE                          │
├──────────────────────────────┬───────────────────────────────┤
│        APP MÓVIL (Flutter)   │       PANEL WEB (Angular)     │
│  - Android APK / iOS Runner  │  - Backoffice Administrativo  │
│  - Probador Virtual AR       │  - Terminal Punto de Venta    │
│  - Catálogo, Carrito y Pagos │  - Gestión Inventario & Stock │
└──────────────┬───────────────┴───────────────┬───────────────┘
               │                               │
               └───────────────┬───────────────┘
                               │ HTTPS (REST API + JWT Bearer)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI - Python)                │
│                                                              │
│  ├── /api/v1/auth/          -> Autenticación, JWT, Bloqueo   │
│  ├── /api/v1/catalog/       -> Productos, Sucursales, Promos │
│  ├── /api/v1/inventory/     -> Proveedores, Compras, Kardex  │
│  ├── /api/v1/commerce/      -> Carrito, POS, Stripe, Factura │
│  ├── /api/v1/employees/     -> Personal, Roles y Permisos    │
│  ├── /api/v1/recommendations-> Motor IA de Recomendación     │
│  └── /api/v1/audit/         -> Trazabilidad y Logs           │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
       ┌───────┴───────┐               ┌───────┴───────┐
       ▼               ▼               ▼               ▼
┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐
│  PostgreSQL  ││    Redis     ││  Cloudinary  ││ Firebase FCM │
│  (Base Datos ││ (OTP, Coold- ││  (Imágenes   ││(Notificacio- │
│  Relacional) ││ own, Bloqueo)││  Prendas AR) ││  nes Push)   │
└──────────────┘└──────────────┘└──────────────┘└──────────────┘
```

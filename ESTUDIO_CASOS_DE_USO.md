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
    - Servicio & Guards: `frontend-web/src/app/core/auth/auth.service.ts`, `auth.guard.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/auth/router.py` (`POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `GET /api/v1/auth/me`, `PATCH /api/v1/auth/profile`, `POST /api/v1/auth/avatar`)
  - Servicio: `backend/app/modules/auth/service.py` (`AuthService`)
  - Seguridad & Throttler: `backend/app/modules/auth/throttler.py` (`RedisLoginThrottler`)
  - Repositorio: `backend/app/modules/auth/repository.py` (`AuthRepository`)
  - Modelos DB: `Usuario`, `Rol`, `UsuarioRol` en `backend/app/modules/auth/models.py`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / Redis):**
  1. **Registro:** Valida unicidad de correo y cédula (CI) en PostgreSQL; aplica hashing criptográfico con **Argon2id** (resistente a GPUs) y asigna automáticamente el rol base `CLIENTE`.
  2. **Login & Seguridad Progresiva:** Verifica credenciales contra el hash Argon2id. Si la contraseña no coincide, invoca `RedisLoginThrottler`:
     - Al 3er fallo consecutivo: Activa pausa de seguridad de **1 minuto** (responde HTTP 429 con cabecera `Retry-After: 60`).
     - Al 6to fallo consecutivo: Activa pausa de seguridad de **5 minutos** (responde HTTP 429 con `Retry-After: 300`).
     - Al 9no fallo consecutivo: Bloquea la cuenta en PostgreSQL (`Usuario.estado = 'BLOQUEADO'`) y responde HTTP 403 Forbidden.
  3. **Sesión & Auditoría:** Al autenticar con éxito, emite un token **JWT (HS256)** con expiración y registra en `AuditContext` la IP cliente, User-Agent y timestamp.
  4. **Perfil y Avatar:** `PATCH /profile` actualiza datos personales; `POST /avatar` sube la foto a Cloudinary y guarda la URL optimizada en la BD.
- **💻 Lógica Frontend Web (Angular):**
  1. **Formularios Reactivos:** Validación síncrona y asíncrona de email corporativo/personal, formato de CI y fortaleza de contraseña en tiempo real.
  2. **Interceptor HTTP:** `auth.interceptor.ts` inyecta automáticamente el encabezado `Authorization: Bearer <token>` en todas las peticiones al backend.
  3. **Control de Navegación & RBAC:** `AuthService` almacena el token en `localStorage` y decodifica roles/permisos. Los Guards (`adminGuard`, `roleGuard`) redirigen según el perfil: Administrador y Encargado van a `/admin/dashboard`, mientras que Cajero va directo al punto de venta `/admin/pos`.
  4. **Manejo de Errores Visuales:** Si el backend responde HTTP 429, activa un contador regresivo visible en el botón; si responde HTTP 403 (bloqueo), muestra un modal de advertencia indicando acudir a restablecimiento de contraseña.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Gestión de Estado & Almacenamiento Seguro:** Usa Riverpod (`AuthController`) y guarda el JWT en `FlutterSecureStorage` (iOS Keychain / Android EncryptedSharedPreferences).
  2. **Experiencia de Autenticación Fluida:** Teclados contextuales (email/numeric), visibilidad de contraseña con icono animado y feedback háptico en botones.
  3. **Manejo Reactivo de Bloqueos:** Captura los códigos HTTP 429 y muestra un diálogo flotante con cuenta regresiva en segundos (cooldown); si la cuenta es bloqueada (HTTP 403), despliega botón directo hacia recuperación por código OTP.
  4. **Edición de Perfil & Foto:** Permite capturar selfie o elegir foto de galería mediante `image_picker`, recorta la imagen y la envía como multipart/form-data al backend.

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
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Autorización Granular:** Endpoints custodiados por el decorador `require_permission("empleados.gestionar")`.
  2. **Alta de Empleado:** Vincula un usuario a una `Sucursal` física específica, define su cargo y le asigna un rol operativo (`ENCARGADO_SUCURSAL`, `CAJERO`, `AUXILIAR_INVENTARIO`).
  3. **Motor RBAC Dinámico:** La función `resolve_effective_permissions` une los permisos base otorgados por el rol (`RolPermiso`) y aplica sobreescrituras individuales (`UsuarioPermiso.otorgado = True/False`), permitiendo conceder o revocar permisos específicos a un usuario sin crear un nuevo rol.
  4. **Ciclo de Vida:** Modifica el estado del empleado (`ACTIVO`, `SUSPENDIDO`, `INACTIVO`) en una sola transacción atómica invalidando sesiones previas si es dado de baja.
- **💻 Lógica Frontend Web (Angular):**
  1. **Panel Maestro de Empleados:** Tabla paginada con filtros en tiempo real por sucursal, rol y estado de actividad.
  2. **Modal Reactivo de Alta/Edición:** Formulario con selector dinámico de sucursales físicas cargadas desde la BD.
  3. **Matriz Visual de Permisos:** Árbol interactivo con casillas de verificación que muestra qué permisos hereda del rol y cuáles han sido personalizados para ese empleado.
  4. **Acciones Rápidas:** Botones contextuales para suspender o reactivar personal con modal de confirmación y feedback tipo toast.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Visualización Ejecutiva:** La administración pesada de personal se delega a la Web; en la app móvil, el administrador tiene una vista informativa de su propio rol y privilegios en `admin_profile_screen.dart`.
  2. **Restricción de Acceso:** La app evalúa los claims del JWT al iniciar; si el usuario no tiene rol administrativo, oculta los accesos a configuraciones de personal.

---

### CU-03: Administrar ciudades y sucursales
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/branches-admin.ts` (con integración de mapas Leaflet y geocodificación GPS).
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/branch_selector_modal.dart`
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (`GET /api/v1/branches`, `GET /api/v1/branches/admin`, `POST /api/v1/branches`, `PATCH /api/v1/branches/{id}`, `GET /api/v1/cities`, `POST /api/v1/cities`)
  - Servicio: `backend/app/modules/catalog/service.py` (`list_branches_admin`, `create_branch`, `update_branch`)
  - Repositorio: `backend/app/modules/catalog/repository.py`
  - Modelos DB: `Ciudad`, `Sucursal` en `backend/app/modules/auth/models.py`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Modelado Geográfico:** Almacena ciudades y sedes físicas con dirección textual, teléfono, horarios (`hora_apertura`, `hora_cierre`) y coordenadas GPS precisas (`latitud`, `longitud`).
  2. **Pivote Logístico:** Las coordenadas de la sucursal actúan como origen obligatorio para el cálculo de flete a domicilio y despacho de pedidos.
  3. **Filtro de Estado:** Expone endpoint público filtrando solo sucursales activas para clientes, y endpoint administrativo con todas las sedes para el Administrador.
- **💻 Lógica Frontend Web (Angular):**
  1. **Geolocalización con Leaflet:** Mapa interactivo sobre OpenStreetMap que permite al administrador buscar una dirección o arrastrar un marcador (*pin*) para capturar automáticamente latitud y longitud.
  2. **Configuración de Operación:** Selectores de horarios de apertura y cierre, y conmutador visual para habilitar o cerrar temporalmente una sucursal.
  3. **Listado en Tarjetas:** Visualización en cuadrícula con métricas rápidas de empleados e inventario asignado a cada tienda.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Selector de Sucursal para Retiro y Reservas:** Modal con lista de tiendas activas ordenadas por cercanía geográfica con respecto al GPS del celular del cliente.
  2. **Ficha de Tienda:** Muestra horarios, número de teléfono con enlace para llamada directa y botón para abrir la ruta en Google Maps o Apple Maps.

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
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Búsqueda Facetada:** Filtra prendas combinando múltiples criterios (categoría, género, rango de precios, talla, color, marca y disponibilidad de existencias).
  2. **Paginación & Optimización:** Paginación por cursor/offset con carga diferida (*lazy loading*) de variantes e imágenes de Cloudinary.
  3. **Precios Dinámicos Promocionales:** Cruza en tiempo real el precio base con promociones y campañas activas, devolviendo el precio de oferta si aplica.
  4. **Metadatos Antropométricos:** `GET /products/{id}` entrega la tabla de patronaje (`GuiaTallas`) con medidas en cm requeridas por el probador virtual AR.
- **💻 Lógica Frontend Web (Angular):**
  1. **Catálogo E-commerce:** Cuadrícula responsiva con filtros laterales, barra de búsqueda con operador *debounce* (espera 300ms antes de emitir la consulta) y selector de ordenamiento (precio ascendente/descendente, novedades).
  2. **Detalle de Prenda:** Galería de fotos con zoom al pasar el ratón, selector de color y talla, y visualización de stock restante.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Navegación Táctil a 60 FPS:** `catalog_screen.dart` con scroll infinito, chips horizontales para filtrar por categoría y barra de búsqueda retráctil con animación.
  2. **Ficha de Producto de Alto Impacto:** Carrusel interactivo de fotografías en WebP usando `CachedNetworkImage`, selector de tallas que deshabilita las que no tienen stock y muestra etiquetas tipo *"¡Solo quedan 2!"*.
  3. **Integración con Espejo AR:** Botón destacado *"Probar en Espejo AR"* que transfiere los metadatos de la prenda a la cámara frontal.

---

### CU-05: Administrar catálogo de productos
- **Actor Principal:** Administrador
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/catalog-admin.ts`
  - **Móvil (Flutter):** `mobile/lib/features/catalog/presentation/barcode_scanner_modal.dart`
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (`POST /api/v1/products`, `PATCH /api/v1/products/{id}`, `POST /api/v1/products/{id}/variants`, `POST /api/v1/products/{id}/images`)
  - Servicio: `backend/app/modules/catalog/service.py`
  - Integración Cloudinary: `backend/app/integrations/cloudinary.py`
  - Repositorio: `backend/app/modules/catalog/repository.py`
  - Modelos DB: `Producto`, `Variante`, `ImagenProducto`, `GuiaTallas`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / Cloudinary):**
  1. **CRUD Maestro de Prendas:** Crea productos con nombre, descripción, SKU base, género, categoría y marca.
  2. **Generador de Matriz de Variantes:** Genera automáticamente registros de `Variante` cruzando tallas (XS a XL) con colores, asignando códigos de barra EAN-13 únicos.
  3. **Pipeline Multimedia Cloudinary:** Sube imágenes al almacenamiento CDN de Cloudinary, optimizando el formato a WebP y almacenando la URL pública para el catálogo y la versión procesable para el probador AR.
  4. **Patronaje Textil:** Asocia medidas anatómicas en centímetros (ancho de hombros, pecho, cintura) en `GuiaTallas`.
- **💻 Lógica Frontend Web (Angular):**
  1. **Administrador de Catálogo:** Tabla con paginación, filtros de búsqueda y previsualización de imágenes miniaturas.
  2. **Carga Drag & Drop:** Zona para arrastrar múltiples fotografías simultáneas con barra de progreso de subida hacia Cloudinary.
  3. **Constructor Visual de Variantes:** Interfaz matricial con checkboxes para seleccionar combinaciones de tallas y colores, asignando precios y SKU en lote.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Consulta Rápida por Código de Barras:** Permite a los auxiliares escanear con la cámara del teléfono el código de barras físico de una prenda para abrir su ficha técnica y ver existencias en todas las sucursales.

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
  - Modelos DB: `Proveedor`, `OrdenCompra`, `DetalleOrdenCompra`, `RecepcionCompra`, `Lote`, `MovimientoInventario`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Ciclo de Abastecimiento:** Gestiona estados de la orden de compra: `BORRADOR` $\rightarrow$ `ENVIADA` $\rightarrow$ `RECEPCION_PARCIAL` $\rightarrow$ `RECEPCIONADA` $\rightarrow$ `CANCELADA`.
  2. **Recepción Física y Lotes:** Al llegar mercadería a bodega, contrasta unidades solicitadas vs. recibidas, registra un nuevo `Lote` con código de trazabilidad y genera un `MovimientoInventario` de tipo `ENTRADA_COMPRA`.
  3. **Cálculo de Costo Promedio Ponderado (CPP):** Actualiza el costo de adquisición de la prenda en base a las unidades ingresadas y el costo unitario pactado con el proveedor.
- **💻 Lógica Frontend Web (Angular):**
  1. **Gestor de Proveedores:** Formulario con razón social, NIT, teléfono, correo y contacto comercial.
  2. **Generador de Órdenes de Compra:** Formulario maestro-detalle interactivo que permite añadir prendas del catálogo, seleccionar tallas, especificar cantidades y costo de compra.
  3. **Módulo de Recepción de Mercadería:** Lista de verificación (*checklist*) para que el encargado de bodega marque las prendas recibidas en buen estado o reporte faltantes/daños con notas de observación.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. No aplica para clientes; el personal de almacén utiliza la web para compras formales, pudiendo utilizar el móvil únicamente como escáner de códigos de barras para verificar bultos recibidos.

---

### CU-07: Gestionar inventario entre sucursales
- **Actor Principal:** Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/operations-admin.ts` (pestaña Transferencias).
  - **Móvil (Flutter):** Notificaciones y consulta de existencias inter-tienda.
- **Ruta Backend:**
  - Router: `backend/app/modules/inventory/router.py` (`POST /api/v1/transfers`, `GET /api/v1/transfers`, `PATCH /api/v1/transfers/{id}/status`)
  - Servicio: `backend/app/modules/inventory/service.py` (`create_transfer`, `update_transfer_status`)
  - Repositorio: `backend/app/modules/inventory/repository.py`
  - Modelos DB: `Transferencia`, `DetalleTransferencia`, `InventarioSucursal`, `MovimientoInventario`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Equilibrio de Stock:** Permite mover existencias entre tiendas (ej. trasladar 15 poleras de Sucursal Central a Sucursal Equipetrol).
  2. **Transacciones Seguras en 3 Fases:**
     - `SOLICITADA`: Se crea la solicitud de traspaso entre dos sucursales.
     - `EN_TRANSITO`: Se descuenta atómicamente el stock físico de la sucursal de origen (`SALIDA_TRANSFERENCIA`) para que no pueda venderse localmente.
     - `RECIBIDA`: La sucursal de destino confirma la llegada física, incrementando su stock (`ENTRADA_TRANSFERENCIA`).
     - `CANCELADA`: Si se anula antes de enviarse, se reincorpora el stock al origen.
- **💻 Lógica Frontend Web (Angular):**
  1. **Tablero de Transferencias:** Muestra transferencias entrantes y salientes con badges de estado y filtros de fecha.
  2. **Formulario de Despacho:** Valida que la sucursal de origen cuente con stock físico disponible antes de autorizar la salida.
  3. **Botones de Flujo:** Botón *"Despachar Mercadería"* para el encargado emisor y *"Confirmar Recepción"* para el encargado receptor.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. Notificaciones push al encargado de la sucursal receptora avisándole que un cargamento está en camino.
  2. Consulta rápida de inventario de otras tiendas en caso de que un cliente presencial pregunte por una prenda agotada en esa sucursal.

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
- **⚙️ Lógica Backend (FastAPI / Redis / Brevo):**
  1. **Generación de OTP:** Crea un código numérico aleatorio criptoseguro de 6 dígitos con vigencia estricta de 10 minutos en Redis (`SETEX otp:<email> 600 <codigo>`).
  2. **Envío de Correo:** Despacha mediante la API de Brevo un correo con plantilla corporativa HTML conteniendo el código de 6 dígitos.
  3. **Validación Antifraude:** Verifica el código ingresado; limita a 5 intentos máximos en Redis para frenar ataques de fuerza bruta. Al validar con éxito, destruye el OTP y emite un `reset_token` firmado de un solo uso.
  4. **Restablecimiento & Desbloqueo Automático:** Al recibir la nueva contraseña, la cifra con Argon2id. Si el usuario estaba en estado `BLOQUEADO` (por haber fallado 9 logins previos), el sistema cambia su estado a `ACTIVO` y borra todas las restricciones de Redis.
- **💻 Lógica Frontend Web (Angular):**
  1. **Flujo en 2 Pasos:** Vista para ingresar correo y posterior vista para introducir el código y la nueva clave.
  2. **Medidor de Seguridad:** Barra visual que evalúa la complejidad de la nueva contraseña (mayúsculas, números, caracteres especiales).
  3. **Temporizador:** Muestra cuenta regresiva de 10 minutos y habilita el botón de reenvío al expirar.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Casillas Numéricas OTP:** 6 casillas individuales con autoenfoque progresivo y soporte para autocompletar desde el portapapeles.
  2. **Temporizador Animado:** Cuenta regresiva con vibración háptica suave al recibir el código.
  3. **Finalización Directa:** Al restablecer, muestra diálogo de confirmación y redirige automáticamente al login con el correo prellenado.

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
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / OpenRouteService):**
  1. **Persistencia Multiplataforma:** El carrito se sincroniza en PostgreSQL por `usuario_id`, de modo que prendas añadidas desde el celular aparecen en la web y viceversa.
  2. **Validación de Existencias en Vivo:** Verifica disponibilidad real de cada variante al momento de añadir o cambiar cantidades.
  3. **Cotización de Entrega Inteligente:** Endpoint `POST /quote-delivery` calcula la distancia exacta en km entre las coordenadas GPS de la dirección del cliente y la sucursal más cercana usando la API de **OpenRouteService** (con fallback geodésico Haversine), calculando la tarifa de envío según la distancia.
- **💻 Lógica Frontend Web (Angular):**
  1. **Mini-Cart y Vista Principal:** Drawer lateral deslizable al añadir productos y vista completa `/cart`.
  2. **Gestión de Cantidades:** Controles reactivos con recálculo instantáneo de subtotales, descuentos promocionales e impuestos.
  3. **Selector de Modalidad:** Opciones claras entre *"Retiro en Tienda"* (flete 0 Bs) y *"Envío a Domicilio"* con cotización inmediata de transporte.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **UI Táctil Optimizada:** Lista con gestos swipe-to-delete, botones de incremento y feedback háptico.
  2. **Gestión de Direcciones con GPS:** Pantalla `addresses_screen.dart` que aprovecha la ubicación del celular para fijar la dirección de entrega en el mapa.
  3. **Barra Fija Inferior:** Muestra total consolidado y botón de checkout con bloqueo si algún producto se quedó sin stock.

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
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / Celery-Scheduler):**
  1. **Reserva sin Pago Anticipado:** Permite al cliente reservar prendas para probárselas en la tienda física elegida.
  2. **Algoritmo de 48 Horas Hábiles (`business_days.py`):** Calcula la fecha exacta de expiración considerando únicamente días laborables oficiales (excluyendo sábados, domingos y feriados nacionales).
  3. **Bloqueo Temporal de Existencias:** Incrementa `stock_reservado` en `InventarioSucursal`, impidiendo que otros clientes compren esa unidad física.
  4. **Liberación Automática:** Proceso en segundo plano que revisa periódicamente las reservas caducadas y devuelve el stock al inventario general.
- **💻 Lógica Frontend Web (Angular):**
  1. **Bandeja de Reservas de Tienda:** Panel para cajeros y encargados que lista las reservas asignadas a su sucursal con indicadores de vigencia (Verde: vigente, Amarillo: por vencer, Rojo: vencida).
  2. **Conversión Rápida a Venta:** Botón *"Cobrar Reserva"* que carga instantáneamente los productos reservados en la terminal POS para su pago y facturación.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Reserva desde Ficha de Producto:** Modal inferior (`reservation_bottom_sheet.dart`) que permite seleccionar tienda de retiro con 1 toque.
  2. **Mis Reservas:** Pantalla con temporizador regresivo de horas restantes y código de reserva visual (código de barras / QR) para mostrar al cajero en la tienda.
  3. **Alerta Preventiva Push:** Notificación 12 horas antes del vencimiento recordando al usuario retirar su prenda.

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
  - Modelos DB: `Venta`, `DetalleVenta`, `Factura`, `MovimientoInventario`, `InventarioSucursal`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Transacción ACID Crítica:** Ejecuta en una sola transacción atómica:
     - Verificación y descuento de stock físico en la sucursal activa del cajero.
     - Liberación de reserva previa si el cliente acudió con un código de reserva.
     - Registro de auditoría de inventario con tipo `SALIDA_VENTA`.
     - Creación de registro de `Venta` con método de pago (efectivo, QR, tarjeta).
     - Emisión de `Factura` electrónica con código CUF/hash y datos fiscales (NIT y Razón Social).
  2. **Cuadre de Caja Diario:** `GET /sales/daily` genera el arqueo de caja con totales discriminados por tipo de pago para cierre de turno.
- **💻 Lógica Frontend Web (Angular):**
  1. **Terminal Táctil Rápida:** Diseñada para uso intensivo en mostrador con soporte para lectores de código de barras USB/Bluetooth.
  2. **Múltiples Métodos de Cobro:**
     - Efectivo: teclado numérico en pantalla con cálculo automático del cambio.
     - QR: genera en pantalla el código QR interoperable para escaneo bancario.
     - Tarjeta: ingreso de referencia del voucher de la terminal POS bancaria.
  3. **Impresión de Ticket Térmico:** Formateo e impresión directa en impresoras de recibos térmicas de 80mm con código QR de la factura tributaria.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. No aplica para operar la caja; sin embargo, si el cliente registrado asocia su correo en caja, recibe una notificación push instantánea de su compra y comprobante digital en su app.

---

### CU-12: Procesar compra, pago y facturación
- **Actor Principal:** Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/checkout_screen.dart`, `checkout_complete_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/commerce/checkout/`
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/checkout/create-intent`, `POST /api/v1/checkout/webhook`, `GET /api/v1/invoices/{id}/pdf`)
  - Pasarela de Pago: `backend/app/modules/commerce/stripe_checkout_service.py` (Stripe PaymentIntent)
  - Facturación: `backend/app/modules/commerce/invoice_service.py`
  - Despacho de Correo: `backend/app/modules/commerce/invoice_mailer.py`
- **⚙️ Lógica Backend (FastAPI / Stripe / PostgreSQL / Brevo):**
  1. **Creación de PaymentIntent:** Endpoint `/create-intent` calcula en el servidor el monto total exacto (prendas + flete - promociones) y solicita a **Stripe** un intent de pago seguro con clave efímera.
  2. **Procesamiento Asíncrono de Webhook:** El endpoint `/webhook` valida la firma criptográfica (`stripe_webhook_secret`). Al recibir el evento `payment_intent.succeeded`:
     - Confirma el pedido y descuenta existencias en `InventarioSucursal`.
     - Genera la factura electrónica mediante `invoice_service.py`.
     - Ensambla el documento PDF y lo despacha al correo del cliente mediante `invoice_mailer.py`.
- **💻 Lógica Frontend Web (Angular):**
  1. **Checkout Paso a Paso:** Formulario con tabs: Dirección de Entrega $\rightarrow$ Datos de Facturación (NIT/Razón Social) $\rightarrow$ Pasarela de Pago.
  2. **Stripe Elements:** Componente seguro incrustado de Stripe que procesa tarjetas de crédito/débito directamente con los servidores de Stripe sin que datos confidenciales toquen el servidor web (cumplimiento PCI-DSS).
  3. **Página de Éxito:** Muestra resumen del pedido con botón para descargar la factura fiscal en PDF.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Stripe Mobile SDK:** `checkout_screen.dart` utiliza el SDK oficial para desplegar la hoja de pago nativa (Payment Sheet) con soporte para Apple Pay, Google Pay y tarjetas guardadas.
  2. **Animación de Éxito:** `checkout_complete_screen.dart` con animación Lottie de confirmación, vibración háptica de satisfacción y botón directo para rastrear el pedido.

---

### CU-13: Gestionar pedidos y seguimiento
- **Actor Principal:** Cliente / Encargado de Sucursal
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/orders_screen.dart`, `order_detail_screen.dart`
  - **Web (Angular):** `frontend-web/src/app/features/admin/commerce-admin.ts` (gestión logística).
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`GET /api/v1/orders`, `GET /api/v1/orders/{id}`, `PATCH /api/v1/orders/{id}/status`)
  - Servicio: `backend/app/modules/commerce/service.py` (`update_order_status`)
  - Modelos DB: `Pedido`, `DetallePedido`, `SeguimientoPedido`, `Notificacion`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / FCM):**
  1. **Máquina de Estados Logística:** Controla el ciclo de vida del pedido:
     `PAGADO` $\rightarrow$ `PREPARANDO` $\rightarrow$ `EN_CAMINO` $\rightarrow$ `ENTREGADO` (o `LISTO_PARA_RETIRO`).
  2. **Historial Inmutable:** Cada cambio de estado crea un registro en `SeguimientoPedido` guardando timestamp, usuario que efectuó el cambio y observaciones.
  3. **Disparador de Alertas:** Al cambiar de estado, el backend invoca automáticamente `fcm_sender.py` para notificar al cliente vía Push en su celular.
- **💻 Lógica Frontend Web (Angular):**
  1. **Panel de Despacho Logístico:** Visualización de pedidos entrantes con filtros por fecha, sucursal y estado.
  2. **Cambio de Estado con Validación:** Modal para actualizar el estado del paquete, ingresar el número de guía del transportista o marcar como listo para retiro en tienda.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Seguimiento Gráfico en Tiempo Real:** `order_detail_screen.dart` presenta un *Stepper* vertical animado que ilustra las etapas del pedido con fecha y hora de cada avance.
  2. **Acciones Contextuales:** Si es para retiro en tienda, muestra el mapa de la sucursal y el código QR de retiro; si es envío a domicilio, muestra los datos del transportista.

---

### CU-14: Gestionar devoluciones
- **Actor Principal:** Cliente / Cajero / Encargado de Sucursal
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/commerce-admin.ts` (pestaña Devoluciones).
  - **Móvil (Flutter):** `mobile/lib/features/commerce/presentation/order_detail_screen.dart` (botón de devolución).
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/returns`, `GET /api/v1/returns`, `PATCH /api/v1/returns/{id}/approve`)
  - Servicio: `backend/app/modules/commerce/service.py` (`process_return`)
  - Modelos DB: `Devolucion`, `DetalleDevolucion`, `NotaCredito`, `MovimientoInventario`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Plazo Límite de Garantía:** Valida que la solicitud de devolución se realice dentro de los **7 días hábiles** posteriores a la entrega del pedido.
  2. **Inspección Física y Destino de Stock:**
     - Prenda en perfecto estado: reingresa al inventario vendible de la sucursal (`ENTRADA_DEVOLUCION`).
     - Prenda con falla o mancha: se envía a merma/baja técnica con motivo justificado.
  3. **Nota de Crédito:** Genera una Nota de Crédito tributaria enlazada a la factura original para revertir el saldo contable.
- **💻 Lógica Frontend Web (Angular):**
  1. **Módulo de Devoluciones:** Búsqueda rápida por número de pedido, cédula del cliente o factura.
  2. **Evaluación de Solicitudes:** Formulario con checklist para marcar el estado de las prendas devueltas, adjuntar observaciones y autorizar la emisión de la Nota de Crédito con 1 clic.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. En pedidos entregados dentro del margen de 7 días, habilita el botón *"Solicitar Devolución / Cambio"*.
  2. El cliente selecciona los ítems, el motivo (ej. talla incorrecta, no me gustó el calce) y recibe instrucciones claras con código para presentar en tienda.

---

### CU-15: Controlar existencias
- **Actor Principal:** Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/operations-admin.ts` (módulo de Inventario y Existencias).
  - **Móvil (Flutter):** `mobile/lib/features/catalog/presentation/barcode_scanner_modal.dart`
- **Ruta Backend:**
  - Router: `backend/app/modules/inventory/router.py` (`GET /api/v1/inventory`, `POST /api/v1/adjustments`, `PATCH /api/v1/minimum-stock`, `GET /api/v1/movements`, `GET /api/v1/lots`)
  - Servicio: `backend/app/modules/inventory/service.py`
  - Repositorio: `backend/app/modules/inventory/repository.py`
  - Modelos DB: `InventarioSucursal`, `MovimientoInventario`, `AjusteInventario`, `Lote`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Kardex Físico Valorado:** Registra cada variación de existencias con fecha, responsable, cantidad anterior, cantidad nueva y tipo de movimiento (`ENTRADA_COMPRA`, `SALIDA_VENTA`, `TRANSFERENCIA`, `AJUSTE_MERMA`).
  2. **Umbrales y Alertas de Stock Mínimo:** Evalúa si `stock_actual <= stock_minimo` y expone listado de ítems críticos para compra inmediata.
  3. **Ajustes de Inventario:** Permite asentar descuadres de inventario físico (roturas, pérdidas, diferencias de conteo) exigiendo un motivo documentado.
- **💻 Lógica Frontend Web (Angular):**
  1. **Tabla de Existencias con Semáforo Visual:** Colores dinámicos (verde: óptimo, amarillo: bajo stock mínimo, rojo: agotado).
  2. **Historial de Kardex:** Vista cronológica de todos los movimientos de una prenda con filtros por sucursal y rango de fechas.
  3. **Formulario de Ajuste Rápido:** Modal para corregir cantidades físicas tras un recuento de estantería.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Escáner de Stock en Sala de Ventas:** Los auxiliares apuntan con la cámara del celular al código de barras de cualquier prenda colgada y visualizan en segundos el stock disponible en tienda y en el depósito trasero sin usar una PC.

---

### CU-16: Consultar y exportar reportes
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/dashboard.ts`, `audit-admin.ts`
  - **Móvil (Flutter):** `mobile/lib/features/admin/presentation/admin_profile_screen.dart`
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`GET /api/v1/dashboard/metrics`), `backend/app/modules/audit/router.py` (`GET /api/v1/audit/logs`)
  - Servicio: `backend/app/modules/commerce/service.py` (`get_dashboard_metrics`), `backend/app/modules/audit/service.py`
  - Modelos DB: `AuditLog`, `Venta`, `Pedido`, `InventarioSucursal`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Agregaciones Analíticas de Alto Rendimiento:** Consultas SQL optimizadas para calcular ingresos diarios/mensuales, ticket promedio, prendas más vendidas y rotación de stock por sucursal.
  2. **Pista de Auditoría Inmutable (`AuditLog`):** Registra cada acción relevante en el sistema (quién, qué tabla/registro, valores previos, valores nuevos, dirección IP y fecha).
  3. **Exportación de Datos:** Generación de flujos de datos formateados para exportación a CSV/Excel.
- **💻 Lógica Frontend Web (Angular):**
  1. **Dashboard Gerencial con Gráficos:** Visualización interactiva con Chart.js (gráficos de barras de ventas, gráfico circular de categorías populares y tarjetas de resumen financiero).
  2. **Buscador de Auditoría:** Filtros por usuario, fecha, tipo de operación (CREATE, UPDATE, DELETE) y entidad.
  3. **Botón de Exportación:** Descarga directa de reportes contables en archivos CSV o Excel.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. Tarjetas de métricas rápidas (KPIs) en el perfil del administrador: total de ventas de la jornada, pedidos pendientes de despacho y alertas de inventario crítico.

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
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Motor de Afinidad Híbrido:**
     - **Filtrado Basado en Contenido:** Compara similitud de atributos (categoría, corte, color, género) entre la prenda actual y el catálogo.
     - **Filtrado Colaborativo / Co-ocurrencia:** Minería de tickets de compra para detectar productos frecuentemente comprados juntos (*Cross-Selling*, ej. camisa + pantalón de vestir).
  2. **Registro de Comportamiento:** Guarda prendas vistas por usuarios autenticados para afinar las recomendaciones en futuras sesiones.
- **💻 Lógica Frontend Web (Angular):**
  1. **Panel de Gestión de Recomendaciones:** Permite a los administradores fijar reglas manuales de asociación (ej. promocionar un accesorio específico con una chaqueta nueva).
  2. **Métricas de Conversión:** Visualiza qué porcentaje de clics en prendas recomendadas terminaron en compra efectiva.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Carrusel *"Completa tu Look"*:** Ubicado al pie de la ficha técnica de la prenda; permite deslizar horizontalmente outfits sugeridos.
  2. **Interacción Rápida:** Tocar una prenda sugerida permite verla o agregarla directamente al carrito con la talla recomendada por el usuario.

---

### CU-18: Utilizar probador virtual (Vestimenta Aumentada AR)
- **Actor Principal:** Cliente
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter & Nativo iOS/Android):**
    - Pantalla Principal: `mobile/lib/features/fitting/presentation/virtual_fitting_screen.dart`
    - Pintor de Silueta: `mobile/lib/features/fitting/presentation/fitting_overlay_painter.dart`
    - Superposición AR: `mobile/lib/features/fitting/presentation/garment_ar_overlay.dart`
    - Filtro de Movimiento: `mobile/lib/features/fitting/domain/pose_smoother.dart`
    - Nativo iOS (Swift): `AppDelegate.swift` con Apple Vision (`VNDetectHumanBodyPoseRequest`)
    - Nativo Android (Kotlin): Google ML Kit Pose Detection.
  - **Web (Angular):** `frontend-web/src/app/features/catalog/` (tabla de tallas y medidas).
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (entrega `GuiaTallas` con medidas de hombros/pecho y fotos de catálogo).
  - Cloudinary: Transformación dinámica `e_make_transparent:22,f_png` para devolver la prenda con transparencia alfa sin fondo blanco.
- **⚙️ Lógica Backend (FastAPI / Cloudinary):**
  1. **Suministro de Metadatos de Patronaje:** Entrega la tabla de medidas anatómicas en centímetros para cada talla de la prenda.
  2. **Transformación Transparente al Vuelo:** Cloudinary procesa la foto de estudio y remueve el fondo blanco `#FFFFFF` al vuelo convirtiéndola en PNG transparente para su superposición en la cámara del móvil.
- **💻 Lógica Frontend Web (Angular):**
  1. **Guía Interactiva de Tallas:** Tabla comparativa donde el usuario puede ingresar sus medidas en centímetros para consultar su talla equivalente.
  2. **Carga de Prendas Compatibles:** El administrador carga las fotos frontales en alta resolución preparadas para el recorte del probador.
- **📱 Lógica Frontend Móvil (Flutter & Swift/Kotlin):**
  1. **Modo Espejo con Cámara Frontal:** Activa la cámara en modo espejo fluido a 60 FPS con silueta estarcido de guía.
  2. **Validación de Orientación Física:** Sensores de acelerómetro y giroscopio calculan los ángulos de cabeceo (*pitch*) y balanceo (*roll*), exigiendo que el celular esté colocado verticalmente ($80^\circ \le \text{pitch} \le 95^\circ$).
  3. **Visión Artificial por Hardware:** Apple Vision en iOS y ML Kit en Android detectan en tiempo real los 19 puntos anatómicos (hombros, cuello, torso) y los envían a Flutter vía `MethodChannel`.
  4. **Filtro de Suavizado EMA (`PoseSmoother`):** Aplica media móvil exponencial ($\alpha = 0.35$) para eliminar vibraciones o saltos en pantalla.
  5. **Cálculo de Talla Antropométrica:** Estima el ancho biacromial en cm aplicando escala FOV calibrada (168.0 hombres / 148.0 mujeres), calcula la talla ideal (XS a XL) y el porcentaje de calce.
  6. **Superposición AR Realista (`garment_ar_overlay.dart`):** Descarga la foto transparente de Cloudinary, ancla el cuello exactamente sobre la línea de hombros, escala el ancho al $1.36\times$ del torso y rota según la inclinación corporal.

---

### CU-19: Gestionar promociones y campañas
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):** `frontend-web/src/app/features/admin/promotions-admin.ts`, `campaigns-admin.ts`
  - **Móvil (Flutter):** Banners de inicio y etiquetas de descuento en catálogo.
- **Ruta Backend:**
  - Router: `backend/app/modules/catalog/router.py` (`/api/v1/promotions`, `/api/v1/campaigns`)
  - Servicio: `backend/app/modules/catalog/service.py` (`create_promotion`, `apply_campaign_discounts`)
  - Repositorio: `backend/app/modules/catalog/repository.py`
  - Modelos DB: `Promocion`, `Campana`, `PromocionProducto`.
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Reglas Comerciales Temporales:** Define promociones con tipo de descuento (porcentaje, monto fijo, 2x1) asociadas a una campaña con rango estricto de fechas (`fecha_inicio`, `fecha_fin`).
  2. **Motor de Precios Dinámico:** Al listar productos o añadir al carrito, el backend evalúa si la prenda aplica a la campaña activa y descuenta el precio en tiempo real sin alterar el precio de lista original en la base de datos.
- **💻 Lógica Frontend Web (Angular):**
  1. **Creador Visual de Campañas:** Formulario con selector de fechas de vigencia, carga de banners publicitarios y selección de prendas o categorías enteras en oferta.
  2. **Conmutador de Estado:** Permite pausar, activar o dar por concluida una campaña anticipadamente.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Carrusel Promocional:** Despliegue de banners de campañas activas en la pantalla de inicio con navegación directa a la categoría en promoción.
  2. **Badges de Oferta:** Muestra etiquetas rojas de descuento (ej. `-25%`) con el precio original tachado en las tarjetas del catálogo.

---

### CU-20: Gestionar notificaciones push
- **Actor Principal:** Cliente
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Pantalla: `mobile/lib/features/commerce/presentation/notifications_screen.dart`
    - Servicio: `mobile/lib/core/services/notification_service.dart` (Firebase Cloud Messaging)
  - **Web (Angular):** `frontend-web/src/app/features/admin/notifications-admin.ts`
- **Ruta Backend:**
  - Router: `backend/app/modules/commerce/router.py` (`POST /api/v1/fcm/token`, `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/send`)
  - Emisor Firebase: `backend/app/modules/commerce/fcm_sender.py` (`send_fcm_notification`)
  - Servicio: `backend/app/modules/commerce/service.py`
  - Modelos DB: `Notificacion`, `DispositivoFCM`, `Usuario`.
- **⚙️ Lógica Backend (FastAPI / Firebase FCM / PostgreSQL):**
  1. **Registro de Dispositivos:** `POST /fcm/token` guarda el token único del dispositivo móvil asociado al usuario autenticado.
  2. **Despacho Automático Multicanal:** `fcm_sender.py` utiliza las credenciales de servicio de Google Firebase para enviar notificaciones push a la barra de estado de Android e iOS ante eventos del negocio (pedido despachado, reserva por expirar, oferta relámpago).
  3. **Persistencia y Lectura:** Cada alerta se guarda en la tabla `Notificacion` con estado (`PENDIENTE`, `ENVIADO`, `LEIDO`).
- **💻 Lógica Frontend Web (Angular):**
  1. **Campana de Notificaciones:** Indicador con contador de avisos pendientes para el personal administrativo.
  2. **Centro de Envíos Masivos (`notifications-admin.ts`):** Formulario para que el administrador redacte y despache notificaciones push a todos los clientes o por segmentos.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Recepción en 3 Estados:** `notification_service.dart` gestiona notificaciones en primer plano (banner flotante), en segundo plano y cuando la aplicación está totalmente cerrada.
  2. **Deep Linking:** Al tocar la notificación en el celular, la app se abre y navega directamente a la pantalla relevante (al detalle del pedido en camino o a la ficha de la prenda en descuento).
  3. **Bandeja de Notificaciones:** Pantalla `notifications_screen.dart` con listado de mensajes recibidos, fecha relativa y opción de marcar como leídos.

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

---

## 👗 ANEXO TÉCNICO ESPECIAL: ¿CÓMO FUNCIONA LA VESTIMENTA AUMENTADA (PROBADOR VIRTUAL AR) Y QUÉ SE UTILIZÓ?

El módulo de **Vestimenta Aumentada (Probador Virtual AR)** corresponde al **CU-18** del sistema y representa una de las mayores innovaciones técnicas de Capricho Store. Permite a los clientes usar la cámara frontal de su teléfono móvil como si fuera un **espejo interactivo**, detectando su cuerpo, estimando sus medidas reales, recomendando su talla exacta y superponiendo la ropa en tiempo real con calce realista.

---

### 1. 🛠️ Tecnologías y Frameworks Utilizados

El sistema está construido mediante una arquitectura híbrida de alto rendimiento que combina visión artificial nativa con renderizado fluido en Flutter:

| Componente / Tecnología | Rol en el Sistema | Función Técnica |
| :--- | :--- | :--- |
| **Flutter (Dart 3.x)** | Núcleo de la Aplicación | Renderizado a 60 FPS, control de cámara, sensor de orientación del dispositivo, `CustomPainter` y widgets de superposición AR reactiva. |
| **Apple Vision Framework (iOS - Swift)** | Visión Artificial en iOS | Utiliza `VNDetectHumanBodyPoseRequest` para ejecutar detección de puntos anatómicos clave (19 articulaciones corporales) directamente sobre el **Neural Engine** del procesador Apple A-Series / Bionic con aceleración por hardware. |
| **Google ML Kit Pose Detection (Android - Kotlin)** | Visión Artificial en Android | Modelo de Deep Learning optimizado para móviles que reconoce la postura corporal (hombros, cuello, torso, cadera) en tiempo real a baja latencia. |
| **Platform Channels (`MethodChannel`)** | Puente Nativo-Flutter | Canal `com.capricho.store/body_pose` que transfiere las coordenadas normalizadas y métricas estimadas desde Swift/Kotlin hacia Dart sin bloquear el hilo de la UI. |
| **Sensors Plus (`accelerometerEventStream`)** | Nivel de Inclinación | Monitorea el acelerómetro y giroscopio del teléfono en los ejes X, Y, Z para calcular los ángulos de cabeceo (*pitch*) y balanceo (*roll*). |
| **Cloudinary Media CDN** | Pipeline de Procesamiento de Imagen | Almacenamiento de catálogo con transformaciones automáticas al vuelo (`e_make_transparent:22,f_png`) que eliminan el fondo blanco de estudio de las fotos de catálogo para convertirlas en PNGs transparentes. |

---

### 2. 🧮 Algoritmos y Fórmulas Matemáticas Implementadas

Para lograr que una cámara 2D estime medidas corporales del mundo real en 3D y calce la ropa sin sensores LiDAR dedicados, se implementaron 6 principios matemáticos:

#### A. Calibración de Orientación e Inclinación del Teléfono
Para evitar distorsiones de perspectiva en la cámara, el usuario debe colocar el teléfono erguido como un espejo vertical. Se calculan los ángulos de cabeceo (*pitch*) y balanceo (*roll*) mediante trigonometría vectorial:

$$\text{pitch} = \arctan\left(\frac{a_y}{\sqrt{a_x^2 + a_z^2}}\right) \times \frac{180}{\pi}$$

$$\text{roll} = \arctan\left(\frac{-a_x}{a_z}\right) \times \frac{180}{\pi}$$

- **Rango óptimo:** El sistema valida que el teléfono esté en posición vertical ($80^\circ \le \text{pitch} \le 95^\circ$) y nivelado ($|\text{roll}| \le 6^\circ$). Si se inclina demasiado hacia adelante o hacia atrás, el estarcido cambia de color verde a ámbar y alerta al usuario.

#### B. Estimación de Distancia Métrica (Modelo Pinhole Camera)
La distancia del usuario a la cámara se calcula en tiempo real relacionando el ancho angular de los hombros en pantalla con la distancia focal óptica equivalente:

$$\text{Distancia (metros)} = \frac{K}{\text{shoulderRatio}}$$

Donde:
- $\text{shoulderRatio} = \frac{\text{distancia en píxeles entre hombro izquierdo y derecho}}{\text{ancho total de pantalla en píxeles}}$
- $K = 0.48$ (constante óptica empírica calibrada).
- **Rango óptimo para prueba:** Entre $1.40\text{ m}$ y $2.00\text{ m}$. Si el usuario está muy cerca o muy lejos, el sistema le indica por voz y texto que retroceda o se acerque al estarcido guía.

#### C. Cálculo del Ancho Biacromial (Hombro a Hombro en cm)
El ancho real de los hombros del cliente (ancho biacromial) se determina mediante la escala FOV antropométrica calibrada según el género:

$$\text{Ancho Hombros (cm)} = \text{shoulderRatio} \times \text{FOV\_Scale} \times \text{Factor de Distancia}$$

- **Calibración de Escalas de Género:**
  - **Hombres:** $\text{FOV\_Scale} = 168.0$ (Calibrado para base biacromial de $47.0\text{ cm} \rightarrow \text{Talla L}$).
  - **Mujeres:** $\text{FOV\_Scale} = 148.0$ (Calibrado para base biacromial de $36.0\text{ cm} \rightarrow \text{Talla S}$).

#### D. Motor de Recomendación de Tallas y Porcentaje de Calce
Una vez calculado el ancho biacromial en centímetros, el sistema contrasta la medida contra la tabla estándar de patronaje textil de Capricho Store:

| Talla | Hombres (Ancho Hombros) | Mujeres (Ancho Hombros) |
| :---: | :---: | :---: |
| **XS** | $< 40.0\text{ cm}$ | $< 35.5\text{ cm}$ |
| **S** | $40.0\text{ cm} - 42.5\text{ cm}$ | $35.5\text{ cm} - 37.5\text{ cm}$ |
| **M** | $42.5\text{ cm} - 45.5\text{ cm}$ | $37.5\text{ cm} - 40.5\text{ cm}$ |
| **L** | $45.5\text{ cm} - 49.0\text{ cm}$ | $40.5\text{ cm} - 44.0\text{ cm}$ |
| **XL** | $> 49.0\text{ cm}$ | $> 44.0\text{ cm}$ |

El porcentaje de calce (ej. `96%`) se calcula evaluando la cercanía de la medida del usuario al punto óptimo de la talla mediante una función normalizada de desviación cuadrática.

#### E. Suavizado de Movimiento Anatómico (`PoseSmoother`)
Para evitar temblores o saltos bruscos en pantalla por pequeñas variaciones de luz o ruido del sensor, las coordenadas del cuello, hombros y ángulo pasan por un filtro de media móvil exponencial (**EMA - Exponential Moving Average**):

$$P_t = \alpha \cdot P_{\text{nuevo}} + (1 - \alpha) \cdot P_{t-1}$$

Con factor de amortiguamiento $\alpha = 0.35$, logrando una respuesta suave y orgánica al moverse.

#### F. Renderizado y Superposición de la Prenda Aumentada
1. **Eliminación del fondo blanco:** Las fotos de catálogo de ropa suelen tener fondo blanco `#FFFFFF`. Mediante la directiva `e_make_transparent:22,f_png` inyectada en Cloudinary, el servidor detecta el tono de fondo de estudio y lo convierte en transparencia alfa pura sin cortar la prenda.
2. **Alineación anatómica:**
   - El punto de anclaje superior de la prenda (el cuello) se fija exactamente en la línea horizontal de los hombros (`defaultShoulderY`).
   - El ancho total de la imagen (que incluye mangas) se calibra a $1.36 \times \text{ancho de hombros}$, haciendo que las costuras del polo caigan exactamente sobre `HOMBRO IZQ` y `HOMBRO DER`, y el cuerpo cubra el marco `TORSO (PECHO Y CINTURA)`.
   - La prenda se rota dinámicamente con el ángulo de los hombros: $\theta = \arctan\left(\frac{y_{\text{der}} - y_{\text{izq}}}{x_{\text{der}} - x_{\text{izq}}}\right)$, limitado a $\pm 25^\circ$ para estabilidad visual.

---

### 3. 📱 Flujo de Experiencia de Usuario en la App

```mermaid
flowchart LR
    A[1. Guía de Espejo] --> B[2. Escaneo 3s]
    B --> C[3. Diagnóstico Antropométrico]
    C --> D[4. Vestimenta Aumentada AR]
    D --> E[5. Compra Directa]
```

1. **Guía de Espejo:** El usuario activa la cámara frontal. El estarcido visual le guía para colocar el teléfono vertical y alinearse dentro de la silueta verde.
2. **Escaneo de 3 Segundos:** Una vez alineado correctamente, una cuenta regresiva con retroalimentación háptica (vibración) captura el fotograma y ejecuta el modelo de visión artificial.
3. **Diagnóstico Antropométrico:** Muestra el ancho estimado de hombros en cm, la talla recomendada (ej. `Talla L`) y el porcentaje de precisión de calce.
4. **Modo Espejo con Vestimenta Aumentada:** El cliente se mira en la pantalla con la prenda puesta, pudiendo alternar colores, probar tallas contiguas (ej. ver cómo le quedaría una M más ajustada o una XL más holgada).
5. **Compra Directa:** Un botón fijo en la parte inferior permite pulsar *"Agregar Talla Recomendada al Carrito"* y proceder de inmediato al checkout.


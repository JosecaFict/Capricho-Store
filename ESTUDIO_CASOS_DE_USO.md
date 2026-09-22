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
    - Pantalla Login: `mobile/lib/features/auth/presentation/login_screen.dart` **(Líneas 1 a 293 - Clase `LoginScreen`)**
    - Pantalla Registro: `mobile/lib/features/auth/presentation/register_screen.dart` **(Líneas 1 a 279 - Clase `RegisterScreen`)**
    - Pantalla Perfil: `mobile/lib/features/auth/presentation/profile_screen.dart` **(Líneas 1 a 1136 - Clase `ProfileScreen`)**
    - Controlador de Estado: `mobile/lib/features/auth/presentation/auth_controller.dart` **(Líneas 1 a 230 - Clase `AuthController`)**
    - Repositorio Móvil: `mobile/lib/features/auth/data/auth_repository.dart` **(Líneas 1 a 170 - Métodos `login`, `register`, `getProfile`)**
  - **Web (Angular):**
    - Componente Login: `frontend-web/src/app/features/auth/login.ts` **(Líneas 1 a 129 - Clase `LoginComponent`)**
    - Componente Registro: `frontend-web/src/app/features/auth/register.ts` **(Líneas 1 a 173 - Clase `RegisterComponent`)**
    - Componente Perfil/Cuenta: `frontend-web/src/app/features/auth/account.ts` **(Líneas 1 a 509 - Clase `AccountComponent`)**
    - Servicio de Autenticación: `frontend-web/src/app/core/auth/auth.service.ts` **(Líneas 1 a 111 - Métodos `login`, `logout`, `hasPermission`)**
    - Guard de Protección: `frontend-web/src/app/core/auth/auth.guard.ts` **(Líneas 1 a 45)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/auth/router.py` **(Líneas 33 a 210)**:
    - Registro: Líneas 33 a 45 (`@router.post("/register")`)
    - Login: Líneas 46 a 54 (`@router.post("/login")`)
    - Perfil Actual: Líneas 83 a 104 (`@router.get("/me")`)
    - Actualizar Perfil: Líneas 105 a 134 (`@router.patch("/me")`)
    - Subir Avatar: Líneas 135 a 165 (`@router.post("/me/avatar")`)
    - Eliminar Avatar: Líneas 166 a 194 (`@router.delete("/me/avatar")`)
    - Cambiar Contraseña: Líneas 195 a 210 (`@router.post("/change-password")`)
  - Servicio Backend: `backend/app/modules/auth/service.py` **(Líneas 40 a 260 - Métodos `register`, `authenticate_user`, `create_access_token`, `update_profile`)**
  - Seguridad & Throttler: `backend/app/modules/auth/throttler.py` **(Líneas 1 a 116 - Clase `RedisLoginThrottler`: `record_failure` L35-75, `is_blocked` L76-100)**
  - Repositorio Backend: `backend/app/modules/auth/repository.py` **(Líneas 1 a 140 - Clase `AuthRepository`)**
  - Modelos DB: `backend/app/modules/auth/models.py` (`Usuario`: Líneas 20 a 85, `Rol`: Líneas 86 a 120, `UsuarioRol`: Líneas 121 a 140)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / Redis):**
  1. **Registro (L33-L45 en `router.py`, L40-L75 en `service.py`):** Valida unicidad de correo y cédula (CI) en PostgreSQL; aplica hashing criptográfico con **Argon2id** (resistente a ataques GPU) y asigna automáticamente el rol base `CLIENTE`.
  2. **Login & Seguridad Progresiva (L46-L54 en `router.py`, L76-L115 en `service.py`, L35-L75 en `throttler.py`):** Verifica credenciales contra el hash Argon2id. Si la contraseña no coincide, invoca `RedisLoginThrottler`:
     - Al 3er fallo consecutivo: Activa pausa de seguridad de **1 minuto** (responde HTTP 429 con cabecera `Retry-After: 60`).
     - Al 6to fallo consecutivo: Activa pausa de seguridad de **5 minutos** (responde HTTP 429 con `Retry-After: 300`).
     - Al 9no fallo consecutivo: Bloquea la cuenta en PostgreSQL (`Usuario.estado = 'BLOQUEADO'`) y responde HTTP 403 Forbidden.
  3. **Sesión & Auditoría (L116-L145 en `service.py`):** Al autenticar con éxito, emite un token **JWT (HS256)** con expiración y registra en `AuditContext` la IP cliente, User-Agent y timestamp.
  4. **Perfil y Avatar (L105-L165 en `router.py`, L146-L260 en `service.py`):** `PATCH /profile` actualiza datos personales; `POST /avatar` sube la foto a Cloudinary y guarda la URL optimizada en la BD.
- **💻 Lógica Frontend Web (Angular):**
  1. **Formularios Reactivos (L20-L85 en `login.ts`, L30-L110 en `register.ts`):** Validación síncrona y asíncrona de email, CI y fortaleza de contraseña.
  2. **Interceptor HTTP (L1-L60 en `auth.interceptor.ts`):** Inyecta automáticamente el encabezado `Authorization: Bearer <token>` en cada petición.
  3. **Control de Navegación & RBAC (L45-L95 en `auth.service.ts`):** Almacena el token en `localStorage`, decodifica roles/permisos y redirige a `/admin/dashboard` o `/admin/pos`.
  4. **Manejo de Errores Visuales (L86-L125 en `login.ts`):** Ante HTTP 429 muestra contador regresivo; ante HTTP 403 modal de cuenta bloqueada.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Gestión de Estado & Storage Seguro (L40-L120 en `auth_controller.dart`):** Almacena el JWT en `FlutterSecureStorage` (Keychain en iOS, EncryptedSharedPreferences en Android).
  2. **Experiencia Fluida (L50-L220 en `login_screen.dart`):** Teclados contextuales, visibilidad de contraseña y feedback háptico.
  3. **Manejo Reactivo de Bloqueos (L180-L240 en `login_screen.dart`):** Captura HTTP 429 y muestra diálogo flotante con cuenta regresiva en segundos; ante HTTP 403, botón directo hacia recuperación OTP.
  4. **Edición de Perfil & Foto (L210-L450 en `profile_screen.dart`):** Captura selfie o selecciona imagen de galería con recorte cuadrado para subirla multipart.

---

### CU-02: Administrar personal, roles y seguridad
- **Actor Principal:** Administrador
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):**
    - Componente Maestro: `frontend-web/src/app/features/admin/employees-admin.ts` **(Líneas 1 a 811 - Clase `EmployeesAdminComponent`)**
    - Servicio de Permisos: `frontend-web/src/app/core/permissions/permission.service.ts` **(Líneas 1 a 120 - Clase `PermissionService`)**
  - **Móvil (Flutter):**
    - Pantalla de Perfil Admin: `mobile/lib/features/admin/presentation/admin_profile_screen.dart` **(Líneas 1 a 263 - Clase `AdminProfileScreen`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/employees/router.py` **(Líneas 36 a 211)**:
    - Listar Empleados: Líneas 36 a 52 (`@router.get("/employees")`)
    - Crear Empleado: Líneas 53 a 73 (`@router.post("/employees")`)
    - Modificar Empleado: Líneas 74 a 91 (`@router.patch("/employees/{id}")`)
    - Listar Roles y Permisos: Líneas 92 a 137 (`@router.get("/roles")`, `/permissions`)
    - Sobreescribir Permisos: Líneas 138 a 194 (`@router.put("/employees/{id}/permissions/{perm_id}")`)
    - Cambiar Rol: Líneas 195 a 211 (`@router.put("/employees/{id}/role")`)
  - Servicio Backend: `backend/app/modules/employees/service.py` **(Líneas 1 a 426 - Métodos `create_employee`, `update_employee`, `resolve_effective_permissions` L180-240)**
  - Repositorio Backend: `backend/app/modules/employees/repository.py` **(Líneas 1 a 180 - Clase `EmployeeRepository`)**
  - Modelos DB: `backend/app/modules/auth/models.py` (`Empleado`: Líneas 86 a 140, `Permiso`: Líneas 141 a 180, `RolPermiso`: Líneas 181 a 210)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Autorización Granular (L36-L53 en `router.py`):** Endpoints custodiados por el decorador `require_permission("empleados.gestionar")`.
  2. **Alta de Empleado (L53-L73 en `router.py`, L80-L140 en `service.py`):** Vincula un usuario a una `Sucursal` física específica, define su cargo y asigna rol operativo (`ENCARGADO_SUCURSAL`, `CAJERO`, `AUXILIAR_INVENTARIO`).
  3. **Motor RBAC Dinámico (L180-L240 en `service.py`):** `resolve_effective_permissions` une los permisos base otorgados por el rol (`RolPermiso`) y aplica sobreescrituras individuales (`UsuarioPermiso.otorgado = True/False`).
  4. **Ciclo de Vida (L141-L195 en `service.py`):** Modifica el estado del empleado (`ACTIVO`, `SUSPENDIDO`, `INACTIVO`) en una transacción atómica invalidando sesiones previas si es dado de baja.
- **💻 Lógica Frontend Web (Angular):**
  1. **Panel Maestro de Empleados (L100-L350 en `employees-admin.ts`):** Tabla paginada con filtros en tiempo real por sucursal, rol y estado.
  2. **Modal Reactivo de Alta/Edición (L351-L580 en `employees-admin.ts`):** Formulario con selector dinámico de sucursales físicas cargadas desde la BD.
  3. **Matriz Visual de Permisos (L581-L750 en `employees-admin.ts`):** Árbol interactivo con casillas de verificación que muestra permisos heredados vs. personalizados.
  4. **Acciones Rápidas (L751-L811 en `employees-admin.ts`):** Botones para suspender o reactivar personal con modal de confirmación y toast.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Visualización Ejecutiva (L50-L180 en `admin_profile_screen.dart`):** Vista informativa del rol y privilegios asignados al empleado autenticado.
  2. **Restricción de Acceso (L30-L75 en `auth_controller.dart`):** Evalúa los claims del JWT; si el usuario no tiene rol administrativo, oculta los accesos a configuraciones de personal.

---

### CU-03: Administrar ciudades y sucursales
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):**
    - Componente Sucursales: `frontend-web/src/app/features/admin/branches-admin.ts` **(Líneas 1 a 763 - Clase `BranchesAdminComponent` con Leaflet)**
  - **Móvil (Flutter):**
    - Selector de Sucursal: `mobile/lib/features/commerce/presentation/checkout_screen.dart` **(Líneas 250 a 380 - Sección Retiro en Tienda)**
    - Selector de Direcciones: `mobile/lib/features/commerce/presentation/addresses_screen.dart` **(Líneas 1 a 450 - Clase `AddressesScreen`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/catalog/router.py` **(Líneas 41 a 127)**:
    - Listar Sucursales Públicas: Líneas 41 a 55 (`@router.get("/branches")`)
    - Listar Sucursales Admin: Líneas 56 a 70 (`@router.get("/branches/admin")`)
    - Crear Sucursal: Líneas 71 a 85 (`@router.post("/branches")`)
    - Modificar Sucursal: Líneas 86 a 100 (`@router.patch("/branches/{id}")`)
    - Ciudades CRUD: Líneas 101 a 127 (`/cities`)
  - Servicio Backend: `backend/app/modules/catalog/service.py` **(Líneas 80 a 210 - Métodos `list_branches`, `create_branch`, `update_branch`)**
  - Repositorio Backend: `backend/app/modules/catalog/repository.py` **(Líneas 50 a 120 - Clase `CatalogRepository`)**
  - Modelos DB: `backend/app/modules/auth/models.py` (`Ciudad`: Líneas 181 a 220, `Sucursal`: Líneas 221 a 260)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Modelado Geográfico (L41-L85 en `router.py`, L80-L150 en `service.py`):** Almacena ciudades y sedes físicas con dirección textual, teléfono, horarios (`hora_apertura`, `hora_cierre`) y coordenadas GPS precisas (`latitud`, `longitud`).
  2. **Pivote Logístico (L1864-L1945 en `commerce/service.py`):** Las coordenadas de la sucursal actúan como origen obligatorio para el cálculo de flete a domicilio y despacho de pedidos.
  3. **Filtro de Estado (L41-L70 en `router.py`):** Endpoint público filtra solo sucursales activas; endpoint administrativo expone todas las sedes con su personal asignado.
- **💻 Lógica Frontend Web (Angular):**
  1. **Geolocalización con Leaflet (L120-L380 en `branches-admin.ts`):** Mapa interactivo sobre OpenStreetMap; permite arrastrar un marcador (*pin*) para capturar latitud y longitud.
  2. **Configuración de Operación (L381-L550 en `branches-admin.ts`):** TimePickers para horas de apertura y cierre, y conmutador visual para habilitar o cerrar temporalmente una sucursal.
  3. **Listado en Tarjetas (L551-L763 en `branches-admin.ts`):** Cuadrícula con métricas de empleados e inventario por tienda.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Selector de Sucursal para Retiro (L280-L340 en `checkout_screen.dart`):** Modal con lista de tiendas activas ordenadas por cercanía geográfica con respecto al GPS del celular.
  2. **Ficha de Tienda (L120-L210 en `addresses_screen.dart`):** Muestra horarios, teléfono con enlace para llamada directa y botón para abrir la ruta en Google Maps o Apple Maps.

---

### CU-04: Consultar catálogo de prendas
- **Actor Principal:** Visitante / Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Pantalla Catálogo: `mobile/lib/features/catalog/presentation/catalog_screen.dart` **(Líneas 1 a 1116 - Clase `CatalogScreen`)**
    - Detalle de Producto: `mobile/lib/features/catalog/presentation/product_detail_screen.dart` **(Líneas 1 a 1140 - Clase `ProductDetailScreen`)**
    - Repositorio Catálogo: `mobile/lib/features/catalog/data/catalog_repository.dart` **(Líneas 1 a 151 - Métodos `getProducts`, `getProductDetail`)**
  - **Web (Angular):**
    - Catálogo Web / Admin: `frontend-web/src/app/features/admin/catalog-admin.ts` **(Líneas 1 a 1155 - Clase `CatalogAdminComponent`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/catalog/router.py` **(Líneas 128 a 431)**:
    - Categorías: Líneas 128 a 164 (`@router.get("/categories")`)
    - Marcas: Líneas 165 a 197 (`@router.get("/brands")`)
    - Tallas y Colores: Líneas 198 a 228 (`/sizes`, `/colors`)
    - Productos Paginados: Líneas 297 a 328 (`@router.get("/products")`)
    - Detalle Producto: Líneas 329 a 337 (`@router.get("/products/{id}")`)
    - Medidas de Patronaje: Líneas 411 a 431 (`@router.get("/products/{id}/measurements")`)
  - Servicio Backend: `backend/app/modules/catalog/service.py` **(Líneas 210 a 360 - Métodos `list_products`, `get_product`, `list_measurements`)**
  - Repositorio Backend: `backend/app/modules/catalog/repository.py` **(Líneas 121 a 310 - Clase `CatalogRepository`)**
  - Modelos DB: `backend/app/modules/catalog/models.py` (`Producto`: L1-60, `Variante`: L61-120, `GuiaTallas`: L121-170, `ImagenProducto`: L171-220)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Búsqueda Facetada (L297-L328 en `router.py`, L210-L290 en `service.py`):** Filtra prendas combinando múltiples criterios (categoría, género, rango de precios, talla, color, marca y stock disponible).
  2. **Paginación & Optimización (L215-L250 en `service.py`):** Paginación eficiente con `limit` y `offset`, aplicando carga diferida de variantes e imágenes.
  3. **Precios Dinámicos Promocionales (L432-L465 en `router.py`, L320-L350 en `service.py`):** Cruza en tiempo real el precio base con campañas activas para devolver precio de oferta.
  4. **Metadatos Antropométricos (L411-L431 en `router.py`):** `GET /measurements` entrega la tabla de patronaje (`GuiaTallas`) en cm requerida por el probador virtual AR.
- **💻 Lógica Frontend Web (Angular):**
  1. **Catálogo E-commerce (L80-L320 en `catalog-admin.ts`):** Cuadrícula responsiva con filtros laterales, barra de búsqueda con operador *debounce* (300ms) y selector de ordenamiento.
  2. **Detalle de Prenda (L321-L580 en `catalog-admin.ts`):** Galería con zoom al pasar el ratón, selector de color y talla, y badge de stock restante.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Navegación Táctil a 60 FPS (L120-L450 en `catalog_screen.dart`):** Scroll infinito, chips horizontales para filtrar por categoría y barra de búsqueda animada.
  2. **Ficha de Producto de Alto Impacto (L200-L650 en `product_detail_screen.dart`):** Carrusel de fotos en WebP con `CachedNetworkImage`, selector de tallas que deshabilita las agotadas.
  3. **Integración con Espejo AR (L651-L750 en `product_detail_screen.dart`):** Botón destacado *"Probar en Espejo AR"* que transfiere los metadatos de la prenda a la cámara frontal.

---

### CU-05: Administrar catálogo de productos
- **Actor Principal:** Administrador
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):**
    - Módulo Maestro Catálogo: `frontend-web/src/app/features/admin/catalog-admin.ts` **(Líneas 1 a 1155 - Clase `CatalogAdminComponent`)**
  - **Móvil (Flutter):**
    - Consulta de Producto: `mobile/lib/features/catalog/presentation/catalog_screen.dart` **(Líneas 1 a 1116)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/catalog/router.py` **(Líneas 338 a 615)**:
    - Crear Producto: Líneas 338 a 347 (`@router.post("/products")`)
    - Modificar Producto: Líneas 348 a 358 (`@router.patch("/products/{id}")`)
    - Variantes en Lote: Líneas 359 a 410 (`@router.post("/products/{id}/variants/batch")`)
    - Medidas Antropométricas: Líneas 418 a 431 (`@router.put("/products/{id}/measurements/{size_id}")`)
    - Subida Imágenes Cloudinary: Líneas 492 a 545 (`@router.post("/products/{id}/images/upload")`)
    - Reemplazar/Eliminar Imágenes: Líneas 546 a 615
  - Servicio Backend: `backend/app/modules/catalog/service.py` **(Líneas 291 a 510 - Métodos `create_product`, `create_variants_batch`, `upload_image`)**
  - Integración Cloudinary: `backend/app/integrations/cloudinary.py` **(Líneas 1 a 130 - Métodos `upload_image`, `delete_image`)**
  - Repositorio Backend: `backend/app/modules/catalog/repository.py` **(Líneas 311 a 450 - Clase `CatalogRepository`)**
  - Modelos DB: `backend/app/modules/catalog/models.py` (`Producto`: L1-60, `Variante`: L61-120, `ImagenProducto`: L121-180)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / Cloudinary):**
  1. **CRUD Maestro (L338-L358 en `router.py`, L291-L360 en `service.py`):** Crea productos con nombre, descripción, SKU base, género, categoría y marca.
  2. **Generador de Variantes (L383-L410 en `router.py`, L361-L430 en `service.py`):** Genera registros de `Variante` cruzando tallas (XS a XL) con colores y asignando códigos de barra EAN-13 únicos.
  3. **Pipeline Multimedia Cloudinary (L492-L545 en `router.py`, L431-L510 en `service.py`, L1-L130 en `cloudinary.py`):** Sube imágenes a Cloudinary, convirtiendo automáticamente a formato WebP y almacenando la URL CDN.
  4. **Patronaje Textil (L418-L431 en `router.py`):** Asocia medidas en cm (hombros, pecho, largo) en `GuiaTallas`.
- **💻 Lógica Frontend Web (Angular):**
  1. **Administrador de Catálogo (L100-L450 en `catalog-admin.ts`):** Tabla con paginación, filtros de búsqueda y previsualización de miniaturas.
  2. **Carga Drag & Drop (L451-L680 en `catalog-admin.ts`):** Zona para arrastrar múltiples fotografías simultáneas con barra de progreso hacia Cloudinary.
  3. **Constructor Visual de Variantes (L681-L950 en `catalog-admin.ts`):** Matriz de checkboxes para combinaciones de tallas y colores, asignando SKU y precios en lote.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Consulta Rápida de Ficha (L450-L600 en `catalog_screen.dart`):** Permite a los auxiliares abrir la ficha técnica y verificar existencias en todas las sucursales.

---

### CU-06: Gestionar proveedores y abastecimiento
- **Actor Principal:** Administrador / Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):**
    - Módulo Proveedores: `frontend-web/src/app/features/admin/operations-admin.ts` **(Líneas 27 a 335 - Clases `SuppliersAdmin` y `SupplierDetail`)**
    - Módulo Órdenes de Compra: `frontend-web/src/app/features/admin/operations-admin.ts` **(Líneas 336 a 1155 - Clase `PurchasesAdmin`)**
    - Módulo Recepciones & Lotes: `frontend-web/src/app/features/admin/operations-admin.ts` **(Líneas 1156 a 1490 - Clase `ReceiptsAdmin`)**
    - Historial Compras Proveedor: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 3399 a 3699 - Clase `SupplierHistoryAdmin`)**
  - **Móvil (Flutter):**
    - Consulta de Existencias: `mobile/lib/features/catalog/presentation/catalog_screen.dart` **(Líneas 1 a 1116)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/inventory/router.py` **(Líneas 56 a 237)**:
    - Proveedores CRUD: Líneas 56 a 134 (`/suppliers`)
    - Órdenes de Compra: Líneas 135 a 185 (`/purchase-orders`)
    - Recepción de Mercadería: Líneas 186 a 216 (`/receipts`)
    - Lotes de Inventario: Líneas 217 a 237 (`/inventory/lots`)
  - Servicio Backend: `backend/app/modules/inventory/service.py` **(Líneas 90 a 260 - Métodos `create_purchase_order`, `create_receipt`, `list_lots`)**
  - Repositorio Backend: `backend/app/modules/inventory/repository.py` **(Líneas 1 a 210 - Clase `InventoryRepository`)**
  - Modelos DB: `backend/app/modules/inventory/models.py` (`Proveedor`: L1-50, `OrdenCompra`: L51-110, `RecepcionCompra`: L111-150, `Lote`: L151-190)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Ciclo de Abastecimiento (L135-L185 en `router.py`, L90-L160 en `service.py`):** Gestiona estados: `BORRADOR` $ightarrow$ `ENVIADA` $ightarrow$ `RECEPCION_PARCIAL` $ightarrow$ `RECEPCIONADA` $ightarrow$ `CANCELADA`.
  2. **Recepción Física y Lotes (L186-L237 en `router.py`, L161-L260 en `service.py`):** Contrasta unidades solicitadas vs. recibidas, registra un nuevo `Lote` con código de trazabilidad y genera `MovimientoInventario` (`ENTRADA_COMPRA`).
  3. **Costo Promedio Ponderado (CPP) (L210-L245 en `service.py`):** Actualiza el costo de adquisición de la prenda en base a las unidades ingresadas y costo pactado.
- **💻 Lógica Frontend Web (Angular):**
  1. **Gestor de Proveedores (L27-L335 en `operations-admin.ts`):** Formulario con razón social, NIT, teléfono y contacto comercial.
  2. **Generador de Órdenes de Compra (L336-L743 en `operations-admin.ts`):** Formulario maestro-detalle interactivo para agregar prendas, tallas, cantidades y costos.
  3. **Recepción en Bodega (L1156-L1490 en `operations-admin.ts`):** Lista de verificación (*checklist*) para marcar unidades conformes vs. dañadas.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. El personal de almacén utiliza la web para compras formales; el móvil se usa para verificar bultos recibidos contra el catálogo.

---

### CU-07: Gestionar inventario entre sucursales
- **Actor Principal:** Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):**
    - Módulo Transferencias: `frontend-web/src/app/features/admin/operations-admin.ts` **(Líneas 1669 a 1917 - Clase `TraceAdmin`)**
  - **Móvil (Flutter):**
    - Consulta Stock Inter-tienda: `mobile/lib/features/catalog/presentation/product_detail_screen.dart` **(Líneas 350 a 480)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/inventory/router.py` **(Líneas 320 a 361)**:
    - Listar Transferencias: Líneas 320 a 336 (`@router.get("/inventory/transfers")`)
    - Crear Transferencia: Líneas 337 a 350 (`@router.post("/inventory/transfers")`)
    - Cambiar Estado Transferencia: Líneas 351 a 361 (`@router.patch("/inventory/transfers/{id}/status")`)
  - Servicio Backend: `backend/app/modules/inventory/service.py` **(Líneas 400 a 560 - Métodos `create_transfer`, `update_transfer_status`)**
  - Repositorio Backend: `backend/app/modules/inventory/repository.py` **(Líneas 310 a 390 - Clase `InventoryRepository`)**
  - Modelos DB: `backend/app/modules/inventory/models.py` (`Transferencia`: Líneas 181 a 220, `DetalleTransferencia`: Líneas 221 a 260)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Equilibrio de Stock (L337-L350 en `router.py`, L400-L480 en `service.py`):** Permite mover existencias entre tiendas de forma atómica.
  2. **Transacciones Seguras en 3 Fases (L481-L560 en `service.py`):**
     - `SOLICITADA`: Se crea la solicitud de traspaso entre dos sucursales.
     - `EN_TRANSITO`: Se descuenta el stock físico de la sucursal de origen (`SALIDA_TRANSFERENCIA`) para evitar ventas locales.
     - `RECIBIDA`: La sucursal de destino confirma la llegada física, incrementando su stock (`ENTRADA_TRANSFERENCIA`).
     - `CANCELADA`: Si se anula antes de enviarse, se reincorpora el stock al origen.
- **💻 Lógica Frontend Web (Angular):**
  1. **Tablero de Transferencias (L1669-L1780 en `operations-admin.ts`):** Muestra transferencias entrantes y salientes con badges de estado y filtros de fecha.
  2. **Formulario de Despacho (L1781-L1860 en `operations-admin.ts`):** Valida stock disponible en origen antes de autorizar la salida.
  3. **Botones de Flujo (L1861-L1917 en `operations-admin.ts`):** *"Despachar Mercadería"* para el emisor y *"Confirmar Recepción"* para el receptor.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. Notificaciones push al encargado receptor cuando un despacho está en camino.
  2. Consulta de existencias de otras tiendas para clientes presenciales en sala de ventas.

---

### CU-08: Recuperar acceso a la cuenta
- **Actor Principal:** Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Pantalla Recuperación: `mobile/lib/features/auth/presentation/password_recovery_screen.dart` **(Líneas 1 a 533 - Clase `PasswordRecoveryScreen`)**
  - **Web (Angular):**
    - Componente Recuperación: `frontend-web/src/app/features/auth/password-recovery.ts` **(Líneas 1 a 308 - Clase `PasswordRecoveryComponent`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/auth/router.py` **(Líneas 55 a 82)**:
    - Solicitar Código OTP: Líneas 55 a 62 (`@router.post("/password-recovery/request")`)
    - Verificar Código OTP: Líneas 63 a 73 (`@router.post("/password-recovery/verify")`)
    - Restablecer Contraseña: Líneas 74 a 82 (`@router.post("/password-recovery/reset")`)
  - Servicio Backend: `backend/app/modules/auth/password_recovery_service.py` **(Líneas 1 a 177 - Métodos `request_recovery` L30-75, `verify_code` L76-120, `reset_password` L121-177)**
  - Store Redis: `backend/app/modules/auth/password_recovery.py` **(Líneas 1 a 120 - Clase `RedisPasswordResetStore`)**
  - Cliente de Correo: API Brevo / Sendinblue en `backend/app/modules/auth/password_recovery_service.py` **(Líneas 50 a 70)**
  - Modelos DB: `backend/app/modules/auth/models.py` (`Usuario`: Líneas 20 a 85)
- **⚙️ Lógica Backend (FastAPI / Redis / Brevo):**
  1. **Generación de OTP (L55-L62 en `router.py`, L30-L75 en `password_recovery_service.py`):** Crea un código aleatorio criptoseguro de 6 dígitos con vigencia de 10 minutos en Redis (`SETEX otp:<email> 600 <codigo>`).
  2. **Envío de Correo (L50-L70 en `password_recovery_service.py`):** Despacha mediante la API de Brevo una plantilla corporativa con el código de 6 dígitos.
  3. **Validación Antifraude (L63-L73 en `router.py`, L76-L120 en `password_recovery_service.py`):** Verifica el código limitando a 5 intentos máximos en Redis contra fuerza bruta. Emite un `reset_token` firmado de un solo uso.
  4. **Restablecimiento & Desbloqueo (L74-L82 en `router.py`, L121-L177 en `password_recovery_service.py`):** Cifra la nueva clave con Argon2id. Si el usuario estaba `BLOQUEADO` (por 9 fallos de login), se reactiva automáticamente a `ACTIVO` y se limpian las llaves de Redis.
- **💻 Lógica Frontend Web (Angular):**
  1. **Flujo en 2 Pasos (L40-L150 en `password-recovery.ts`):** Formulario para ingresar correo y posterior vista para introducir el código y la nueva clave.
  2. **Medidor de Seguridad (L151-L220 en `password-recovery.ts`):** Evalúa la complejidad de la nueva clave en tiempo real.
  3. **Temporizador (L221-L308 en `password-recovery.ts`):** Cuenta regresiva de 10 minutos con botón para reenviar código al vencer.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Casillas Numéricas OTP (L120-L280 en `password_recovery_screen.dart`):** 6 casillas individuales con autoenfoque progresivo y soporte para autocompletar desde el portapapeles.
  2. **Temporizador Animado (L281-L380 en `password_recovery_screen.dart`):** Cuenta regresiva con vibración háptica suave.
  3. **Finalización Directa (L381-L533 en `password_recovery_screen.dart`):** Muestra diálogo de confirmación y redirige automáticamente al login con el correo prellenado.

---

### CU-09: Gestionar carrito y entrega
- **Actor Principal:** Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Pantalla Carrito: `mobile/lib/features/commerce/presentation/cart_screen.dart` **(Líneas 1 a 515 - Clase `CartScreen`)**
    - Direcciones y GPS: `mobile/lib/features/commerce/presentation/addresses_screen.dart` **(Líneas 1 a 450 - Clase `AddressesScreen`)**
    - API Cliente: `mobile/lib/features/commerce/data/commerce_api.dart` **(Líneas 1 a 120 - Métodos `getCart`, `addItem`, `quoteDelivery`)**
  - **Web (Angular):**
    - Gestión de Pedidos & Flete: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 1909 a 2354)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 56 a 107 y 330 a 336)**:
    - Carrito CRUD: Líneas 56 a 90 (`/cart`, `/cart/items`, `/cart/clear`)
    - Direcciones Cliente: Líneas 91 a 107 (`/addresses`)
    - Cotización Flete: Líneas 330 a 336 (`@router.post("/shipping-quotes")`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 185 a 382 y 1864 a 1945)**:
    - Métodos Carrito: Líneas 185 a 332 (`get_cart`, `add_cart_item`, `update_cart_item`, `remove_cart_item`)
    - Métodos Direcciones: Líneas 333 a 382 (`list_addresses`, `create_address`)
    - Cálculo de Flete: Líneas 1864 a 1945 (`_distance_km` L1864-1884, `quote_shipping` L1885-1945)
  - Modelos DB: `backend/app/modules/commerce/models.py` (`Carrito`: Líneas 20 a 70, `ItemCarrito`: Líneas 71 a 95, `DireccionCliente`: Líneas 96 a 130)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / OpenRouteService):**
  1. **Persistencia Multiplataforma (L56-L90 en `router.py`, L185-L332 en `service.py`):** Carrito persistente en PostgreSQL por `usuario_id`, sincronizado entre el móvil y la web.
  2. **Validación de Existencias en Vivo (L247-L295 en `service.py`):** Verifica stock disponible de cada variante al añadir o cambiar cantidades.
  3. **Cotización de Entrega Inteligente (L330-L336 en `router.py`, L1864-L1945 en `service.py`):** `quote_shipping` calcula la distancia en km entre las coordenadas GPS de la dirección del cliente y la sucursal más cercana mediante OpenRouteService (o Haversine), calculando la tarifa de envío.
- **💻 Lógica Frontend Web (Angular):**
  1. **Mini-Cart y Vista Principal:** Drawer lateral deslizable al añadir productos y vista completa `/cart`.
  2. **Gestión de Cantidades:** Controles reactivos con recálculo instantáneo de subtotales, descuentos promocionales e impuestos.
  3. **Selector de Modalidad:** Opciones claras entre *"Retiro en Tienda"* (flete 0 Bs) y *"Envío a Domicilio"* con cotización inmediata de transporte.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **UI Táctil Optimizada (L80-L320 en `cart_screen.dart`):** Lista con gestos swipe-to-delete, botones de incremento y feedback háptico.
  2. **Gestión de Direcciones con GPS (L100-L350 en `addresses_screen.dart`):** Pantalla que aprovecha la ubicación del celular para fijar la dirección de entrega en el mapa.
  3. **Barra Fija Inferior (L351-L515 en `cart_screen.dart`):** Muestra total consolidado y botón de checkout con bloqueo si algún producto se quedó sin stock.

---

### CU-10: Gestionar reservas de prendas
- **Actor Principal:** Cliente / Encargado de Sucursal / Cajero
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Modal de Reserva: `mobile/lib/features/commerce/presentation/reservation_bottom_sheet.dart` **(Líneas 1 a 389 - Clase `ReservationBottomSheet`)**
    - Mis Reservas: `mobile/lib/features/commerce/presentation/reservations_screen.dart` **(Líneas 1 a 390 - Clase `ReservationsScreen`)**
  - **Web (Angular):**
    - Gestión Operativa de Reservas: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 1058 a 1908 - Clase `ReservationsAdmin`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 108 a 164)**:
    - Reservas Cliente: Líneas 108 a 133 (`GET /reservations`, `POST /reservations`, `/cancel`)
    - Reservas Administrativas: Líneas 134 a 164 (`/admin/reservations`, `/status`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 383 a 660 - Métodos `create_reservation` L416-500, `update_reservation_status` L628-660, `expire_stale_reservations` L614-627)**
  - Regla Días Hábiles: `backend/app/modules/commerce/business_days.py` **(Líneas 1 a 68 - Métodos `add_business_days`, `is_business_day`)**
  - Modelos DB: `backend/app/modules/commerce/models.py` (`Reserva`: Líneas 131 a 180, `DetalleReserva`: Líneas 181 a 210)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / Celery-Scheduler):**
  1. **Reserva sin Pago Anticipado (L108-L133 en `router.py`, L416-L500 en `service.py`):** Permite al cliente apartar prendas para probárselas en la tienda física elegida.
  2. **Algoritmo de 48 Horas Hábiles (L1-L68 en `business_days.py`):** Calcula la fecha de expiración considerando únicamente días laborables oficiales (excluyendo sábados, domingos y feriados nacionales).
  3. **Bloqueo Temporal de Existencias (L383-L415 en `service.py`):** Incrementa `stock_reservado` en `InventarioSucursal`, impidiendo que otros clientes compren esa unidad.
  4. **Liberación Automática (L614-L627 en `service.py`):** Proceso en segundo plano que revisa periódicamente reservas vencidas y devuelve el stock al inventario general.
- **💻 Lógica Frontend Web (Angular):**
  1. **Bandeja de Reservas de Tienda (L1058-L1558 en `commerce-admin.ts`):** Panel para cajeros y encargados que lista reservas de la tienda con indicadores de vigencia.
  2. **Conversión Rápida a Venta (L1559-L1908 en `commerce-admin.ts`):** Botón *"Cobrar Reserva"* que carga los productos reservados en la terminal POS para su pago y facturación.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Reserva desde Ficha de Producto (L50-L220 en `reservation_bottom_sheet.dart`):** Permite reservar una prenda seleccionando la tienda de retiro con 1 toque.
  2. **Mis Reservas (L80-L280 en `reservations_screen.dart`):** Temporizador regresivo de horas restantes y código QR/Barras para mostrar al cajero en tienda.
  3. **Alerta Preventiva Push (L281-L390 en `reservations_screen.dart`):** Notificación 12 horas antes del vencimiento recordando al usuario retirar su prenda.

---

### CU-11: Registrar venta en punto de venta (POS)
- **Actor Principal:** Cajero
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):**
    - Terminal POS Mostrador: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 32 a 1057 - Clase `PosSalesAdmin`)**
    - Historial y Cuadre Diario: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 3700 a 4288 - Clase `SalesHistoryAdmin`)**
  - **Móvil (Flutter):**
    - Historial de Compras Cliente: `mobile/lib/features/commerce/presentation/orders_screen.dart` **(Líneas 1 a 315)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 165 a 215)**:
    - Crear Venta POS: Líneas 165 a 177 (`@router.post("/sales/pos")`)
    - Listar Ventas: Líneas 178 a 205 (`@router.get("/sales")`)
    - Historial Compras Cliente: Líneas 206 a 215 (`@router.get("/history/purchases")`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 661 a 865 - Métodos `_create_sale` L683-813, `create_pos_sale` L814-865)**
  - Facturación Electrónica: `backend/app/modules/commerce/invoice_service.py` **(Líneas 1 a 448 - Métodos `generate_invoice`, `generate_cuf`)**
  - Modelos DB: `backend/app/modules/commerce/models.py` (`Venta`: L211-270, `DetalleVenta`: L271-310, `Factura`: L311-340)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Transacción ACID Crítica (L683-L865 en `service.py`):** Ejecuta en una sola transacción:
     - Verificación y descuento de stock físico en la sucursal activa del cajero.
     - Liberación de reserva previa si el cliente acudió con un código de reserva.
     - Registro de auditoría de inventario con tipo `SALIDA_VENTA`.
     - Creación de registro de `Venta` con método de pago (efectivo, QR, tarjeta).
     - Emisión de `Factura` electrónica con código CUF/hash y datos fiscales (NIT y Razón Social).
  2. **Cuadre de Caja Diario (L1352-L1400 en `service.py`):** Genera arqueo con totales discriminados por tipo de pago para cierre de turno.
- **💻 Lógica Frontend Web (Angular):**
  1. **Terminal Táctil Rápida (L32-L550 en `commerce-admin.ts`):** Diseñada para mostrador con soporte para lectores de código de barras USB/Bluetooth.
  2. **Múltiples Métodos de Cobro (L551-L850 en `commerce-admin.ts`):**
     - Efectivo: teclado numérico en pantalla con cálculo automático del cambio.
     - QR: genera en pantalla código QR interoperable para escaneo bancario.
     - Tarjeta: ingreso de referencia del voucher de la terminal POS bancaria.
  3. **Impresión de Ticket Térmico (L851-L1057 en `commerce-admin.ts`):** Formateo e impresión directa en impresoras térmicas de 80mm con código QR tributario.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. El cliente recibe una notificación push instantánea de su compra y comprobante digital en su app.

---

### CU-12: Procesar compra, pago y facturación
- **Actor Principal:** Cliente
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Pantalla Checkout: `mobile/lib/features/commerce/presentation/checkout_screen.dart` **(Líneas 1 a 1352 - Clase `CheckoutScreen` con Stripe Mobile SDK)**
    - Pago Completado: `mobile/lib/features/commerce/presentation/checkout_complete_screen.dart` **(Líneas 1 a 521 - Clase `CheckoutCompleteScreen`)**
  - **Web (Angular):**
    - Checkout Web: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 1909 a 2354)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 216 a 259)**:
    - Crear Checkout Session: Líneas 216 a 227 (`@router.post("/checkout")`)
    - Estado de Checkout: Líneas 228 a 235 (`@router.get("/checkout/{session_id}/status")`)
    - Webhook de Stripe: Líneas 244 a 259 (`@router.post("/payments/stripe/webhook")`)
    - Factura PDF: Líneas 275 a 286 (`@router.get("/orders/{id}/invoice")`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 866 a 1287 - Métodos `checkout` L877-1050, `_complete_stripe_checkout` L1071-1152, `process_stripe_event` L1202-1211)**
  - Facturación & Mailer: `backend/app/modules/commerce/invoice_service.py` **(Líneas 1 a 448)** y `invoice_mailer.py` **(Líneas 1 a 190 - `InvoiceMailer`)**
  - Modelos DB: `backend/app/modules/commerce/models.py` (`TransaccionPago`: L250-300, `Factura`: L311-380)
- **⚙️ Lógica Backend (FastAPI / Stripe / PostgreSQL / Brevo):**
  1. **Creación de PaymentIntent (L216-L227 en `router.py`, L877-L1050 en `service.py`):** Calcula en el servidor el monto total exacto (prendas + flete - promociones) y solicita a Stripe un intent de pago seguro con clave efímera.
  2. **Procesamiento Asíncrono de Webhook (L244-L259 en `router.py`, L1071-L1211 en `service.py`):** Valida la firma criptográfica (`stripe_webhook_secret`). Al recibir `payment_intent.succeeded`:
     - Confirma el pedido y descuenta existencias en `InventarioSucursal`.
     - Genera la factura electrónica mediante `invoice_service.py`.
     - Ensambla el documento PDF y lo despacha al correo del cliente mediante `invoice_mailer.py`.
- **💻 Lógica Frontend Web (Angular):**
  1. **Checkout Paso a Paso:** Formulario con tabs: Dirección de Entrega $ightarrow$ Datos de Facturación (NIT/Razón Social) $ightarrow$ Pasarela de Pago.
  2. **Stripe Elements:** Formulario de tarjeta embebido de Stripe cumpliendo normativas PCI-DSS.
  3. **Página de Éxito:** Muestra resumen del pedido con botón para descargar la factura fiscal en PDF.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Stripe Mobile SDK (L250-L650 en `checkout_screen.dart`):** Hoja de pago nativa (Payment Sheet) con soporte para Apple Pay, Google Pay y tarjetas.
  2. **Animación de Éxito (L50-L280 en `checkout_complete_screen.dart`):** Animación Lottie de confirmación, vibración háptica y botón directo para rastrear el pedido.

---

### CU-13: Gestionar pedidos y seguimiento
- **Actor Principal:** Cliente / Encargado de Sucursal
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Lista de Pedidos: `mobile/lib/features/commerce/presentation/orders_screen.dart` **(Líneas 1 a 315 - Clase `OrdersScreen`)**
    - Detalle y Seguimiento: `mobile/lib/features/commerce/presentation/order_detail_screen.dart` **(Líneas 1 a 576 - Clase `OrderDetailScreen`)**
  - **Web (Angular):**
    - Despacho Logístico: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 1909 a 2354 - Clase `OrdersAdmin`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 260 a 329)**:
    - Pedidos Cliente: Líneas 260 a 269 (`GET /orders`, `/orders/{id}`)
    - Confirmar Entrega: Líneas 270 a 274 (`@router.post("/orders/{id}/confirm-delivery")`)
    - Pedidos Operativos Admin: Líneas 299 a 329 (`/admin/orders`, `PATCH /status`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 1666 a 1863 - Métodos `list_orders` L1666-1687, `update_order_status` L1701-1802, `confirm_delivery` L1803-1863)**
  - Modelos DB: `backend/app/modules/commerce/models.py` (`Pedido`: L341-390, `DetallePedido`: L391-420, `SeguimientoPedido`: L421-440)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL / FCM):**
  1. **Máquina de Estados Logística (L1701-L1802 en `service.py`):** Controla el ciclo de vida del pedido:
     `PAGADO` $ightarrow$ `PREPARANDO` $ightarrow$ `EN_CAMINO` $ightarrow$ `ENTREGADO` (o `LISTO_PARA_RETIRO`).
  2. **Historial Inmutable (L1740-L1775 en `service.py`):** Cada cambio de estado crea un registro en `SeguimientoPedido` guardando timestamp, usuario que efectuó el cambio y observaciones.
  3. **Disparador de Alertas (L2424-L2476 en `service.py`):** Al cambiar de estado, el backend invoca `fcm_sender.py` para notificar al cliente vía Push en su celular.
- **💻 Lógica Frontend Web (Angular):**
  1. **Panel de Despacho Logístico (L1909-L2172 en `commerce-admin.ts`):** Pedidos entrantes con filtros por fecha, sucursal y estado.
  2. **Cambio de Estado con Validación (L2173-L2354 en `commerce-admin.ts`):** Modal para actualizar el estado del paquete, ingresar guía del transportista o marcar como listo para retiro.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Seguimiento Gráfico en Tiempo Real (L80-L350 en `order_detail_screen.dart`):** *Stepper* vertical animado que ilustra las etapas del pedido con fecha y hora.
  2. **Acciones Contextuales (L351-L576 en `order_detail_screen.dart`):** Si es retiro en tienda, muestra el mapa y código QR de retiro; si es envío a domicilio, muestra datos del transportista.

---

### CU-14: Gestionar devoluciones
- **Actor Principal:** Cliente / Cajero / Encargado de Sucursal
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):**
    - Módulo Devoluciones: `frontend-web/src/app/features/admin/commerce-admin.ts` **(Líneas 2355 a 3398 - Clase `ReturnsAdmin`)**
  - **Móvil (Flutter):**
    - Solicitud desde Pedido: `mobile/lib/features/commerce/presentation/order_detail_screen.dart` **(Líneas 450 a 576)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 337 a 406)**:
    - Devoluciones Cliente: Líneas 337 a 346 (`GET /returns`, `POST /returns`)
    - Devoluciones Administrativas: Líneas 347 a 406 (`/admin/returns`, `/status`, `/inspect-sale`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 1946 a 2423 - Métodos `create_return` L1946-2012, `update_return_status` L2294-2423)**
  - Modelos DB: `backend/app/modules/commerce/models.py` (`Devolucion`: L431-480, `DetalleDevolucion`: L481-510, `NotaCredito`: L511-540)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Plazo Límite de Garantía (L1950-L1980 en `service.py`):** Valida que la solicitud de devolución se realice dentro de los **7 días hábiles** posteriores a la entrega del pedido.
  2. **Inspección Física y Destino de Stock (L2294-L2360 en `service.py`):**
     - Prenda en perfecto estado: reingresa al inventario vendible de la sucursal (`ENTRADA_DEVOLUCION`).
     - Prenda con falla o mancha: se envía a merma/baja técnica con motivo justificado.
  3. **Nota de Crédito (L2361-L2410 en `service.py`):** Genera una Nota de Crédito tributaria enlazada a la factura original para revertir el saldo contable.
- **💻 Lógica Frontend Web (Angular):**
  1. **Módulo de Devoluciones (L2355-L2750 en `commerce-admin.ts`):** Búsqueda rápida por número de pedido, cédula del cliente o factura.
  2. **Evaluación de Solicitudes (L2751-L3398 en `commerce-admin.ts`):** Formulario con checklist para marcar el estado de las prendas devueltas, adjuntar observaciones y autorizar la emisión de la Nota de Crédito con 1 clic.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. En pedidos entregados dentro del margen de 7 días, habilita el botón *"Solicitar Devolución / Cambio"*.
  2. El cliente selecciona los ítems, el motivo (ej. talla incorrecta, no me gustó el calce) y recibe instrucciones claras con código para presentar en tienda.

---

### CU-15: Controlar existencias
- **Actor Principal:** Encargado de Sucursal / Auxiliar de Inventario
- **Prioridad:** Alta
- **Ruta Frontend:**
  - **Web (Angular):**
    - Módulo Inventario: `frontend-web/src/app/features/admin/operations-admin.ts` **(Líneas 1491 a 1668 - Clase `InventoryAdmin`)**
  - **Móvil (Flutter):**
    - Consulta de Prenda y Stock: `mobile/lib/features/catalog/presentation/product_detail_screen.dart` **(Líneas 1 a 1140)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/inventory/router.py` **(Líneas 238 a 319)**:
    - Consultar Existencias: Líneas 238 a 262 (`@router.get("/inventory")`)
    - Modificar Stock Mínimo: Líneas 263 a 273 (`@router.patch("/inventory/{id}/minimum-stock")`)
    - Kardex de Movimientos: Líneas 274 a 303 (`@router.get("/inventory/movements")`)
    - Ajustes de Inventario: Líneas 304 a 319 (`@router.post("/inventory/{id}/adjustments")`)
  - Servicio Backend: `backend/app/modules/inventory/service.py` **(Líneas 261 a 399 - Métodos `list_inventory` L261-300, `adjust_inventory` L320-390)**
  - Repositorio Backend: `backend/app/modules/inventory/repository.py` **(Líneas 211 a 310 - Clase `InventoryRepository`)**
  - Modelos DB: `backend/app/modules/inventory/models.py` (`InventarioSucursal`: L120-160, `MovimientoInventario`: L161-210, `AjusteInventario`: L211-250)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Kardex Físico Valorado (L274-L303 en `router.py`, L261-L320 en `service.py`):** Registra cada variación de existencias con fecha, responsable, cantidad anterior, cantidad nueva y tipo de movimiento (`ENTRADA_COMPRA`, `SALIDA_VENTA`, `TRANSFERENCIA`, `AJUSTE_MERMA`).
  2. **Umbrales y Alertas de Stock Mínimo (L263-L273 en `router.py`):** Evalúa si `stock_actual <= stock_minimo` y expone listado de ítems críticos para reposición.
  3. **Ajustes de Inventario (L304-L319 en `router.py`, L320-L390 en `service.py`):** Permite asentar descuadres de inventario físico (roturas, pérdidas, diferencias de conteo) exigiendo motivo documentado.
- **💻 Lógica Frontend Web (Angular):**
  1. **Tabla de Existencias con Semáforo Visual (L1491-L1580 en `operations-admin.ts`):** Colores dinámicos (verde: óptimo, amarillo: bajo stock mínimo, rojo: agotado).
  2. **Historial de Kardex (L1581-L1620 en `operations-admin.ts`):** Vista cronológica de movimientos con filtros por sucursal y rango de fechas.
  3. **Formulario de Ajuste Rápido (L1621-L1668 en `operations-admin.ts`):** Modal para corregir cantidades físicas tras un recuento de estantería.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. Los auxiliares visualizan en segundos el stock disponible en tienda y en el depósito trasero sin usar una PC.

---

### CU-16: Consultar y exportar reportes
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):**
    - Dashboard Analítico: `frontend-web/src/app/features/admin/dashboard.ts` **(Líneas 1 a 739 - Clase `DashboardComponent`)**
    - Auditoría del Sistema: `frontend-web/src/app/features/admin/audit-admin.ts` **(Líneas 1 a 284 - Clase `AuditAdminComponent`)**
  - **Móvil (Flutter):**
    - Resumen Ejecutivo: `mobile/lib/features/admin/presentation/admin_profile_screen.dart` **(Líneas 1 a 263)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 630 a 650: `@router.get("/admin/dashboard/summary")`)** y `backend/app/modules/audit/router.py` **(Líneas 14 a 47: `@router.get("")`)**
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 3219 a 3464 - Método `get_admin_dashboard_summary`)** y `backend/app/modules/audit/service.py` **(Líneas 1 a 84 - Método `list_audit_logs`)**
  - Modelos DB: `backend/app/modules/audit/models.py` (`AuditLog`: Líneas 1 a 60), `backend/app/modules/commerce/models.py` (`Venta`: L211-270)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Agregaciones Analíticas (L630-L650 en `commerce/router.py`, L3219-L3464 en `commerce/service.py`):** Consultas SQL optimizadas para calcular ingresos diarios/mensuales, ticket promedio, prendas más vendidas y rotación de stock por sucursal.
  2. **Pista de Auditoría Inmutable (L14-L47 en `audit/router.py`, L1-L84 en `audit/service.py`):** `AuditLog` registra cada acción relevante en el sistema (quién, qué tabla/registro, valores previos, valores nuevos, dirección IP y fecha).
  3. **Exportación de Datos:** Flujos formateados para exportación a CSV/Excel.
- **💻 Lógica Frontend Web (Angular):**
  1. **Dashboard Gerencial con Gráficos (L100-L450 en `dashboard.ts`):** Visualización interactiva con Chart.js (gráficos de barras de ventas, gráfico circular de categorías populares y tarjetas de KPIs).
  2. **Buscador de Auditoría (L1-L200 en `audit-admin.ts`):** Filtros por usuario, fecha, tipo de operación (CREATE, UPDATE, DELETE) y entidad.
  3. **Botón de Exportación (L201-L284 en `audit-admin.ts`):** Descarga directa de reportes contables en archivos CSV o Excel.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. Tarjetas de métricas rápidas (KPIs) en el perfil del administrador: total de ventas de la jornada, pedidos pendientes y alertas de inventario crítico.

---

### CU-17: Gestionar recomendaciones inteligentes
- **Actor Principal:** Cliente / Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Carrusel *"Completa tu Look"*: `mobile/lib/features/catalog/presentation/product_detail_screen.dart` **(Líneas 750 a 950)**
  - **Web (Angular):**
    - Módulo Configuración IA: `frontend-web/src/app/features/admin/recommendations-admin.ts` **(Líneas 1 a 459 - Clase `RecommendationsAdminComponent`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/recommendations/router.py` **(Líneas 1 a 108)**:
    - Recomendaciones Personalizadas: Líneas 26 a 35 (`@router.get("/recommendations")`)
    - Productos Relacionados: Líneas 36 a 47 (`@router.get("/recommendations/products/{id}/related")`)
    - Registrar Interacción: Líneas 48 a 63 (`@router.post("/recommendations/interaction")`)
    - Configuración y Métricas Admin: Líneas 64 a 108 (`/admin/recommendations/config`, `/stats`)
  - Servicio Backend: `backend/app/modules/recommendations/service.py` **(Líneas 1 a 337 - Métodos `get_personalized_recommendations` L50-130, `get_related_products` L131-210, `record_interaction` L211-260)**
  - Repositorio Backend: `backend/app/modules/recommendations/repository.py` **(Líneas 1 a 160)**
  - Modelos DB: `backend/app/modules/recommendations/models.py` (`HistorialVistas`: Líneas 1 a 45, `ReglaAsociacion`: Líneas 46 a 90)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Motor de Afinidad Híbrido (L50-L210 en `service.py`):**
     - **Filtrado Basado en Contenido:** Compara similitud de atributos (categoría, corte, color, género) entre la prenda actual y el catálogo.
     - **Filtrado Colaborativo / Co-ocurrencia:** Minería de tickets de compra para detectar productos frecuentemente comprados juntos (*Cross-Selling*, ej. camisa + pantalón de vestir).
  2. **Registro de Comportamiento (L48-L63 en `router.py`, L211-L260 en `service.py`):** Guarda prendas vistas por usuarios autenticados para afinar recomendaciones futuras.
- **💻 Lógica Frontend Web (Angular):**
  1. **Panel de Gestión de Recomendaciones (L100-L320 en `recommendations-admin.ts`):** Permite fijar reglas manuales de asociación (ej. promocionar un accesorio con una chaqueta nueva).
  2. **Métricas de Conversión (L321-L459 en `recommendations-admin.ts`):** Visualiza qué porcentaje de clics en prendas recomendadas terminaron en compra efectiva.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Carrusel *"Completa tu Look"* (L750-L950 en `product_detail_screen.dart`):** Al pie de la ficha técnica; permite deslizar horizontalmente outfits sugeridos.
  2. **Interacción Rápida:** Tocar una prenda sugerida permite verla o agregarla directamente al carrito con la talla recomendada.

---

### CU-18: Utilizar probador virtual (Vestimenta Aumentada AR)
- **Actor Principal:** Cliente
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter & Nativo iOS/Android):**
    - Pantalla Principal Espejo: `mobile/lib/features/fitting/presentation/virtual_fitting_screen.dart` **(Líneas 1 a 2171 - Clase `VirtualFittingScreen`)**
    - Pintor de Silueta y Guías: `mobile/lib/features/fitting/presentation/fitting_overlay_painter.dart` **(Líneas 1 a 376 - Clase `FittingOverlayPainter`)**
    - Superposición de Prenda AR: `mobile/lib/features/fitting/presentation/garment_ar_overlay.dart` **(Líneas 1 a 114 - Clase `GarmentArOverlay`)**
    - Filtro de Movimiento EMA: `mobile/lib/features/fitting/domain/pose_smoother.dart` **(Líneas 1 a 82 - Clase `PoseSmoother`)**
    - Puente Nativo iOS (Swift): `mobile/ios/Runner/AppDelegate.swift` **(Líneas 1 a 120 - Apple Vision `VNDetectHumanBodyPoseRequest`)**
    - Puente Nativo Android (Kotlin): Google ML Kit Pose Detection sobre `MethodChannel` (`com.capricho.store/body_pose`)
  - **Web (Angular):**
    - Gestión de Fotos Catálogo AR: `frontend-web/src/app/features/admin/catalog-admin.ts` **(Líneas 1 a 1155)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/catalog/router.py` **(Líneas 411 a 431: medidas `GuiaTallas`, Líneas 466 a 615: imágenes)**
  - Integración Cloudinary: `backend/app/integrations/cloudinary.py` **(Líneas 1 a 130)** con transformación `e_make_transparent:22,f_png`
- **⚙️ Lógica Backend (FastAPI / Cloudinary):**
  1. **Metadatos de Patronaje (L411-L431 en `catalog/router.py`):** Entrega la tabla de medidas anatómicas en centímetros para cada talla de la prenda.
  2. **Transformación Transparente al Vuelo (en `garment_ar_overlay.dart` y Cloudinary CDN):** Procesa la foto de estudio y remueve el fondo blanco `#FFFFFF` al vuelo convirtiéndola en PNG transparente para su superposición en la cámara del móvil.
- **💻 Lógica Frontend Web (Angular):**
  1. **Guía Interactiva de Tallas:** Tabla comparativa donde el usuario puede ingresar sus medidas en cm para consultar su talla.
  2. **Carga de Fotos Compatibles:** El administrador carga las fotos frontales en alta resolución preparadas para el probador.
- **📱 Lógica Frontend Móvil (Flutter & Swift/Kotlin):**
  1. **Modo Espejo con Cámara Frontal (L200-L500 en `virtual_fitting_screen.dart`):** Activa la cámara en modo espejo fluido a 60 FPS con silueta estarcido de guía.
  2. **Validación de Orientación Física (L350-L450 en `virtual_fitting_screen.dart`):** Sensores de acelerómetro calculan cabeceo (*pitch*) y balanceo (*roll*), exigiendo que el celular esté colocado verticalmente ($80^\circ \le 	ext{pitch} \le 95^\circ$).
  3. **Visión Artificial por Hardware (L1-L120 en `AppDelegate.swift`):** Apple Vision en iOS y ML Kit en Android detectan 19 puntos anatómicos (hombros, cuello, torso) y los envían a Flutter vía `MethodChannel`.
  4. **Filtro de Suavizado EMA (L1-L82 en `pose_smoother.dart`):** Aplica media móvil exponencial ($lpha = 0.35$) para eliminar vibraciones o saltos en pantalla.
  5. **Cálculo de Talla Antropométrica (L650-L800 en `virtual_fitting_screen.dart`):** Estima el ancho biacromial en cm aplicando escala FOV calibrada (168.0 hombres / 148.0 mujeres), calcula la talla ideal (XS a XL) y el porcentaje de calce.
  6. **Superposición AR Realista (L20-L114 en `garment_ar_overlay.dart`):** Descarga la foto transparente de Cloudinary, ancla el cuello exactamente sobre la línea de hombros, escala el ancho al $1.36	imes$ del torso y rota según la inclinación corporal.

---

### CU-19: Gestionar promociones y campañas
- **Actor Principal:** Administrador
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Web (Angular):**
    - Módulo Promociones: `frontend-web/src/app/features/admin/promotions-admin.ts` **(Líneas 1 a 780 - Clase `PromotionsAdminComponent`)**
    - Módulo Campañas: `frontend-web/src/app/features/admin/campaigns-admin.ts` **(Líneas 1 a 418 - Clase `CampaignsAdminComponent`)**
  - **Móvil (Flutter):**
    - Catálogo con Badges de Oferta: `mobile/lib/features/catalog/presentation/catalog_screen.dart` **(Líneas 1 a 1116)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 523 a 629)**:
    - Campañas Admin: Líneas 523 a 575 (`/admin/campaigns`, `/send`)
    - Promociones Admin: Líneas 576 a 624 (`/admin/promotions`)
    - Promociones Públicas Activas: Líneas 625 a 629 (`@router.get("/promotions/active")`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 2905 a 3218 - Métodos `list_campaigns` L2915-2933, `create_campaign` L2934-2962, `list_promotions` L3083-3106, `create_promotion` L3131-3149)**
  - Modelos DB: `backend/app/modules/commerce/models.py` (`Campana`: Líneas 521 a 560, `Promocion`: Líneas 561 a 610)
- **⚙️ Lógica Backend (FastAPI / PostgreSQL):**
  1. **Reglas Comerciales Temporales (L523-L624 en `router.py`, L2905-L3218 en `service.py`):** Define promociones con tipo de descuento (porcentaje, monto fijo, 2x1) asociadas a una campaña con rango estricto de fechas (`fecha_inicio`, `fecha_fin`).
  2. **Motor de Precios Dinámico (L3198-L3218 en `service.py`):** Al listar productos o añadir al carrito, el backend evalúa si la prenda aplica a la campaña activa y descuenta el precio en tiempo real sin alterar el precio de lista original en la base de datos.
- **💻 Lógica Frontend Web (Angular):**
  1. **Creador Visual de Campañas (L50-L300 en `campaigns-admin.ts`):** Formulario con selector de fechas de vigencia, carga de banners publicitarios y selección de prendas o categorías enteras en oferta.
  2. **Gestión de Descuentos (L100-L500 en `promotions-admin.ts`):** Configuración de reglas porcentuales o de monto fijo con conmutador de activación en vivo.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Carrusel Promocional (L80-L180 en `catalog_screen.dart`):** Despliegue de banners de campañas activas en la pantalla de inicio con navegación directa a la categoría en promoción.
  2. **Badges de Oferta (L350-L500 en `catalog_screen.dart`):** Muestra etiquetas rojas de descuento (ej. `-25%`) con el precio original tachado en las tarjetas del catálogo.

---

### CU-20: Gestionar notificaciones push
- **Actor Principal:** Cliente
- **Prioridad:** Media
- **Ruta Frontend:**
  - **Móvil (Flutter):**
    - Servicio FCM en Segundo Plano: `mobile/lib/core/notifications/fcm_service.dart` **(Líneas 1 a 220 - Clase `FcmService`)**
    - Bandeja de Notificaciones: `mobile/lib/features/commerce/presentation/notifications_screen.dart` **(Líneas 1 a 260 - Clase `NotificationsScreen`)**
  - **Web (Angular):**
    - Módulo Envíos Masivos: `frontend-web/src/app/features/admin/notifications-admin.ts` **(Líneas 1 a 650 - Clase `NotificationsAdminComponent`)**
- **Ruta Backend:**
  - Router API: `backend/app/modules/commerce/router.py` **(Líneas 407 a 495)**:
    - Notificaciones Cliente: Líneas 407 a 449 (`GET /notifications`, `POST /notifications/devices`, `PATCH /read`)
    - Notificaciones Admin: Líneas 450 a 495 (`/admin/notifications`, `/resend`)
  - Servicio Backend: `backend/app/modules/commerce/service.py` **(Líneas 2424 a 2850 - Métodos `_notify` L2424-2476, `register_device_token` L2581-2595, `send_manual_notification` L2767-2850)**
  - Emisor Firebase: `backend/app/modules/commerce/fcm_sender.py` **(Líneas 1 a 115 - Método `send_fcm_notification`)**
  - Modelos DB: `backend/app/modules/commerce/models.py` (`Notificacion`: Líneas 611 a 660, `DispositivoFCM`: Líneas 661 a 690)
- **⚙️ Lógica Backend (FastAPI / Firebase FCM / PostgreSQL):**
  1. **Registro de Dispositivos (L412-L420 en `router.py`, L2581-L2595 en `service.py`):** `POST /fcm/token` guarda el token único del dispositivo móvil asociado al usuario autenticado.
  2. **Despacho Automático Multicanal (L2424-L2476 en `service.py`, L1-L115 en `fcm_sender.py`):** `fcm_sender.py` utiliza credenciales de servicio de Google Firebase para enviar notificaciones push a la barra de estado de Android e iOS ante eventos del negocio.
  3. **Persistencia y Lectura (L421-L449 en `router.py`, L2672-L2717 en `service.py`):** Cada alerta se guarda en la tabla `Notificacion` con estado (`PENDIENTE`, `ENVIADO`, `LEIDO`).
- **💻 Lógica Frontend Web (Angular):**
  1. **Campana de Notificaciones:** Indicador con contador de avisos pendientes para el personal administrativo.
  2. **Centro de Envíos Masivos (L100-L450 en `notifications-admin.ts`):** Formulario para que el administrador redacte y despache notificaciones push a todos los clientes o por segmentos.
- **📱 Lógica Frontend Móvil (Flutter):**
  1. **Recepción en 3 Estados (L40-L160 en `fcm_service.dart`):** `FcmService` gestiona notificaciones en primer plano (banner flotante), en segundo plano y cuando la aplicación está totalmente cerrada.
  2. **Deep Linking (L161-L220 en `fcm_service.dart`):** Al tocar la notificación en el celular, la app se abre y navega directamente a la pantalla relevante (al pedido en camino o a la ficha de la prenda en descuento).
  3. **Bandeja de Notificaciones (L1-L260 en `notifications_screen.dart`):** Listado de mensajes recibidos, fecha relativa y opción de marcar como leídos.

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


# Continuidad general — Capricho Store

Última actualización: 4 de septiembre de 2026.

Este es el documento maestro para continuar Capricho Store desde otra
computadora o desde una nueva tarea de Codex. Resume el estado real del backend,
la Web Angular, la aplicación Flutter y la base PostgreSQL.

Para detalles exclusivos de Mobile también existe `CONTINUIDAD_FLUTTER.md`.

## 1. Arquitectura obligatoria

```text
PostgreSQL (schema capricho)
              ↓
           FastAPI
          ↙       ↘
 Angular Web     Flutter
```

- PostgreSQL ya existe y utiliza el esquema `capricho`.
- La base v2 es la estructura definitiva del proyecto académico.
- No ejecutar `Base.metadata.create_all()`.
- No recrear, rediseñar ni modificar tablas sin una justificación y aprobación
  expresa.
- FastAPI es la única capa que accede a PostgreSQL.
- Angular y Flutter consumen FastAPI; nunca acceden directamente a la base.
- Web se orienta a la interfaz pública y a la operación administrativa.
- Mobile se orienta a la experiencia del cliente y, posteriormente, al vestidor
  virtual.

## 2. Estructura actual

```text
Capricho-Store/
├── backend/                                  FastAPI
├── frontend-web/                             Angular
├── mobile/                                   Flutter Android/iOS
├── assets/                                   referencias/activos del proyecto
├── capricho_store_postgresql_completo_v2.sql base PostgreSQL v2
├── capricho_store_correcciones_v2.sql        correcciones v2
├── PRODUCT.md                                alcance funcional
├── DESIGN.md                                 sistema visual
├── CONTINUIDAD_PROYECTO.md                   este documento
└── CONTINUIDAD_FLUTTER.md                    detalle de Mobile
```

Las carpetas `.npm-cache/` y `.impeccable/` son artefactos locales de apoyo y
no forman parte de la aplicación desplegable.

## 3. Reglas de catálogo

El catálogo oficial contiene únicamente:

| Categoría | Público permitido |
|---|---|
| `POLERA` | `HOMBRE`, `MUJER` |
| `CAMISA` | `HOMBRE`, `MUJER` |
| `POLO` | `HOMBRE`, `MUJER` |
| `BLUSA` | únicamente `MUJER` |

Categoría y público objetivo son dimensiones distintas. No existen categorías
como `POLERA_HOMBRE` o `POLERA_MUJER`.

No usar calzado, pantalones, vestidos, enterizos, chaquetas, accesorios,
faldas, shorts, bolsos ni categorías ficticias en datos, rutas, filtros,
imágenes, banners, tarjetas, placeholders o pruebas.

## 4. PostgreSQL

### Archivos de referencia

```text
capricho_store_postgresql_completo_v2.sql
capricho_store_correcciones_v2.sql
```

La base ya fue ejecutada correctamente en PostgreSQL 17. En el equipo inicial
la conexión local utiliza el puerto `5433`, pero cada computadora puede tener
otro puerto. Esa diferencia se configura únicamente en `backend/.env`.

Ejemplo sin credenciales reales:

```dotenv
DATABASE_URL=postgresql+asyncpg://postgres:CONTRASENA@localhost:5433/Capricho-Store
```

Si la contraseña contiene caracteres reservados de una URL deben codificarse.
El nombre mostrado en pgAdmin, por ejemplo `PostgreSQL 17`, no es el usuario de
la base; el usuario utilizado hasta ahora es `postgres`.

### Reglas importantes de inventario

- Las salidas consumen lotes mediante FIFO:
  `fecha_ingreso ASC, id_lote ASC`.
- Se utilizan bloqueos para impedir consumos simultáneos del mismo lote.
- Los movimientos de inventario y de lote son históricos e inmutables.
- Una reversión posterior debe usar movimientos compensatorios.
- Una transferencia nunca cambia la sucursal de un lote existente.
- La recepción en destino crea lotes nuevos por cada fracción FIFO y conserva
  costo e `id_detalle_recepcion` del lote de origen.
- Costos distintos no se combinan en un solo lote destino.
- No se crean recepciones de mercadería ficticias para transferencias.
- En un lote transferido, `id_detalle_recepcion` representa el origen histórico
  de adquisición, no una nueva recepción física en destino.

## 5. Backend FastAPI

### Tecnología

- Python 3.12 o superior.
- FastAPI.
- SQLAlchemy 2 async.
- `asyncpg`.
- Pydantic Settings.
- Alembic preparado para la base existente, sin migraciones creadoras.
- JWT con clave tomada de `.env`.
- Argon2 para contraseñas.
- Pytest y Ruff.

### Arquitectura interna

```text
Router → Service → Repository → SQLAlchemy async → PostgreSQL
```

Módulos existentes:

```text
backend/app/modules/
├── auth/
├── employees/
├── catalog/
└── inventory/
```

### Funcionalidad implementada

#### Infraestructura

```text
GET /api/v1/health
GET /api/v1/ready
```

`/ready` ejecuta una consulta real contra PostgreSQL.

#### Autenticación y permisos

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

- El registro crea usuario, cliente y rol `CLIENTE` en una transacción.
- El correo se normaliza.
- `password_hash` nunca se devuelve.
- El login rechaza usuarios inactivos o bloqueados.
- El JWT se envía como `Authorization: Bearer <token>`.
- No existe refresh token actualmente.

Permisos efectivos:

```text
(permisos heredados por roles + permisos individuales otorgados)
- permisos individuales revocados
```

El contexto de auditoría transaccional contempla usuario, sesión, IP,
user-agent, origen y request ID. Los triggers PostgreSQL registran la bitácora.

#### Empleados, roles y permisos

- Consulta, creación y edición de empleados.
- Consulta de roles y permisos.
- Asignación de rol.
- Otorgamiento o revocación individual de permisos.
- No existe eliminación física de empleados; se desactivan para conservar
  trazabilidad.

#### Catálogo

- Categorías, marcas, tallas, colores, temporadas y colecciones.
- Productos y variantes.
- Medidas por talla.
- Historial de precios.
- Imágenes de producto.
- Relaciones producto-temporada y producto-colección.
- Catálogo público con filtros, ordenamiento y paginación.
- Stock disponible y estado de stock calculados al consultar por sucursal.

Filtros de `GET /api/v1/products`:

```text
categoria
publico_objetivo
marca
talla
color
temporada
sucursal
permite_vestidor
activo
page
page_size
sort
```

#### Proveedores, compras, recepciones e inventario

- Proveedores y sus asociaciones con productos.
- Órdenes de compra y transiciones de estado.
- Recepciones de mercadería.
- Creación transaccional de lotes y movimientos de entrada.
- Inventario por sucursal.
- Stock mínimo.
- Consulta de lotes y movimientos.
- Ajustes de inventario.
- Transferencias entre sucursales con salida y entrada trazables.
- Consumo FIFO con `FOR UPDATE`.

### Configurar el backend en otra computadora

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Editar localmente `backend/.env`:

```dotenv
DATABASE_URL=postgresql+asyncpg://USUARIO:CONTRASENA@localhost:PUERTO/BASE
APP_NAME=Capricho Store API
APP_ENV=development
DEBUG=false
SECRET_KEY=UNA_CLAVE_ALEATORIA_DE_AL_MENOS_32_CARACTERES
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Nunca subir `backend/.env` a GitHub.

### Ejecutar y validar backend

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
fastapi dev app/main.py
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

Comprobaciones:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/ready
pytest
ruff check . --no-cache
```

### Estado de calidad del backend

- Existen 9 archivos de pruebas.
- Pytest recolecta 108 pruebas.
- En la revisión del 4 de septiembre de 2026, las 108 llegaron a `100%` sin
  mostrar fallos, pero el proceso de Pytest no terminó por sí solo y fue
  interrumpido después de esperar. El siguiente equipo debe investigar la
  finalización pendiente del proceso antes de considerar la suite completamente
  limpia.
- `ruff check . --no-cache`: correcto, sin observaciones.
- Se usa `--no-cache` porque el entorno controlado tuvo un problema de permisos
  al crear `backend/.ruff_cache`; esto no representa un error del código.

## 6. Frontend Web Angular

### Tecnología

- Angular 21 con componentes standalone.
- TypeScript estricto.
- Angular Router y `HttpClient`.
- Formularios reactivos.
- RxJS.
- Vitest.
- Fuente Alef.
- Proxy local `/api` hacia FastAPI.

### Arquitectura

```text
frontend-web/src/app/
├── core/
│   ├── auth/
│   ├── guards/
│   ├── interceptors/
│   ├── permissions/
│   └── services/
├── features/
│   ├── home/
│   ├── auth/
│   ├── catalog/
│   └── admin/
├── layouts/
└── shared/
```

### Interfaz pública implementada

| Ruta | Función |
|---|---|
| `/` | Home pública |
| `/catalogo` | Catálogo real y filtros compactos |
| `/productos/:id` | Detalle de producto |
| `/login` | Inicio de sesión |
| `/registro` | Registro de cliente |
| `/cuenta` | Perfil autenticado |

El catálogo fue compactado para que los productos aparezcan cerca del primer
viewport. En escritorio muestra los filtros principales en una barra y agrupa
los secundarios; en móvil utiliza controles de filtros y ordenamiento sin
colocar todos los selects antes del grid.

### Panel administrativo implementado

Rutas existentes bajo `/admin`:

- Dashboard.
- Empleados y detalle de empleado.
- Productos y detalle administrativo.
- Datos maestros del catálogo.
- Proveedores y detalle de proveedor.
- Órdenes de compra.
- Recepciones.
- Inventario.
- Lotes.
- Movimientos.
- Transferencias.
- Página 403 y control de navegación por permisos.

Angular nunca debe ser la autoridad final de permisos. Puede ocultar o bloquear
acciones para mejorar la experiencia, pero FastAPI siempre debe volver a validar
el JWT y el permiso correspondiente.

### Ejecutar y validar Angular

Primero iniciar FastAPI. En otra terminal:

```powershell
cd frontend-web
npm install
npm start
```

Abrir:

```text
http://127.0.0.1:4200
```

El archivo `proxy.conf.json` reenvía `/api` a FastAPI durante el desarrollo.

Validación:

```powershell
npm run build
npm test -- --watch=false
npx prettier --check .
```

Estado verificado el 4 de septiembre de 2026:

```text
npm run build: correcto
Vitest: 4 archivos aprobados, 9 pruebas aprobadas
```

Hay 4 archivos `.spec.ts`. Angular no tiene ESLint configurado actualmente; la
validación disponible es compilación estricta, Vitest y Prettier.

## 7. Mobile Flutter

### Tecnología

- Flutter 3.47.2 estable.
- Dart 3.13.2.
- Android e iOS.
- Riverpod.
- GoRouter.
- Dio.
- Flutter Secure Storage.
- Cached Network Image.
- Intl.

### Funcionalidad implementada

- Tema Material 3 alineado con `DESIGN.md`.
- Navegación inferior Catálogo/Mi cuenta.
- Registro, login, restauración de sesión y logout.
- JWT guardado en almacenamiento seguro.
- Catálogo conectado a FastAPI.
- Filtros iniciales de categoría y público.
- Ordenamiento por nombre, precio y fecha.
- Detalle con imagen, descripción, precio, tallas y colores.
- Indicador informativo de compatibilidad con vestidor.
- Estados de carga, error, reintento y vacío.

No están implementados todavía carrito, reservas, compra, pagos, delivery,
seguimiento, notificaciones, cámara ni MediaPipe.

### Ejecutar y validar Flutter

```powershell
cd mobile
flutter pub get
flutter analyze
flutter test
```

Android Emulator:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

Para teléfono físico, iniciar FastAPI en `0.0.0.0` y utilizar la IPv4 local de
la computadora. Para iOS se necesita macOS y Xcode.

Estado verificado:

```text
flutter analyze: sin observaciones
flutter test: 2 pruebas aprobadas
```

El equipo inicial todavía no tiene Android SDK; Flutter está instalado, pero se
debe instalar Android Studio, Android SDK y crear un emulador antes de ejecutar
o generar el APK. Consultar `CONTINUIDAD_FLUTTER.md` para el procedimiento
completo.

## 8. Sistema visual compartido

`DESIGN.md` es la fuente de verdad visual:

- Fondo cálido `#f7f6f3`.
- Superficie blanca `#ffffff`.
- Grafito `#121418`.
- Azul cobalto `#064fe8` como único acento principal.
- Controles con radio de 8 px.
- Medios/fotografías con radio de 12 px.
- Sin degradados decorativos ni sombras excesivas.
- Fotografía editorial protagonista.
- Interfaz de moda, no una plantilla administrativa genérica.
- Accesibilidad, contraste, foco, semántica y áreas táctiles suficientes.

No rediseñar cada plataforma de manera independiente. Web y Mobile deben
sentirse parte del mismo producto, respetando los patrones nativos de cada una.

## 9. Estado real de lo pendiente

### Backend

- Investigar por qué Pytest llega a 100 % pero el proceso queda abierto en el
  entorno actual.
- No generar migraciones Alembic hasta acordar una estrategia de baseline.
- Los módulos de carrito, reservas, ventas, pedidos, pagos y delivery todavía
  no forman parte de la API implementada.
- Tampoco están integrados Cloudinary, Stripe, Brevo, FCM, recomendador o
  MediaPipe.

### Angular

- Continuar validando visualmente y contra PostgreSQL real las operaciones del
  panel administrativo.
- Añadir más pruebas para rutas y flujos administrativos.
- No mostrar operaciones que todavía no tengan endpoint.

### Flutter

- Instalar el toolchain Android y hacer la primera prueba en emulador.
- Probar en teléfono pequeño, teléfono grande y tablet.
- Completar filtros por marca, talla, color, temporada, sucursal y vestidor.
- Añadir pruebas de widgets y repositorios.
- Avanzar con funciones posteriores únicamente cuando FastAPI las respalde.
- La cámara y MediaPipe deben implementarse como un bloque independiente.

## 10. Preparar el repositorio GitHub

Actualmente no existe un `.gitignore` en la raíz. Cada subproyecto tiene su
propio `.gitignore`, pero antes de usar `git add .` se recomienda crear uno en la
raíz que excluya al menos:

```gitignore
.npm-cache/
.impeccable/
backend/.env
backend/.venv/
backend/.pytest_cache/
backend/.ruff_cache/
frontend-web/node_modules/
frontend-web/dist/
frontend-web/.angular/
mobile/.dart_tool/
mobile/build/
```

No subir:

- Contraseñas de PostgreSQL.
- `SECRET_KEY`.
- Tokens JWT.
- `.env` reales.
- Cachés, entornos virtuales, dependencias instaladas o compilaciones.

Sí subir:

- Código fuente de los tres proyectos.
- `backend/.env.example`.
- `frontend-web/package.json` y `package-lock.json`.
- `mobile/pubspec.yaml` y `pubspec.lock`.
- Carpetas `mobile/android/` y `mobile/ios/`.
- SQL v2 y documentación Markdown.

Una secuencia inicial segura, después de crear el `.gitignore`, es:

```powershell
git init
git status
git add .
git status
git commit -m "chore: iniciar repositorio Capricho Store"
git branch -M main
git remote add origin URL_DEL_REPOSITORIO
git push -u origin main
```

Revisar siempre el segundo `git status` antes del commit para confirmar que no
se incluyeron secretos o cachés.

## 11. Sincronización entre computadora y laptop

Antes de trabajar:

```powershell
git pull
```

Después de terminar una unidad pequeña:

```powershell
git status
git add RUTAS_MODIFICADAS
git commit -m "tipo(area): descripción breve"
git push
```

Ejemplos:

```text
feat(backend): agregar módulo de reservas
feat(web): completar gestión de inventario
feat(mobile): ampliar filtros del catálogo
test(backend): cubrir transición de transferencia
docs: actualizar continuidad del proyecto
```

No editar simultáneamente el mismo archivo en ambos equipos. Hacer `git pull`
antes de empezar y commits pequeños reduce los conflictos.

Después de clonar en un equipo nuevo:

```powershell
git clone URL_DEL_REPOSITORIO
cd Capricho-Store
```

Después preparar cada subproyecto con sus propias instrucciones anteriores.

## 12. Orden recomendado para continuar

1. Crear `.gitignore` raíz y publicar el estado actual en un repositorio
   privado o público sin secretos.
2. Clonar en la laptop y configurar PostgreSQL/FastAPI.
3. Verificar `/health` y `/ready`.
4. Ejecutar las verificaciones de backend y resolver el cierre pendiente de
   Pytest si se reproduce.
5. Ejecutar Angular y comprobar la parte pública y administrativa.
6. Instalar Android Studio/SDK y ejecutar Flutter en emulador.
7. Trabajar por módulos pequeños y sincronizar mediante Git.
8. No empezar carrito, reservas, pagos o MediaPipe sin revisar primero el
   contrato de base y los endpoints disponibles.

## 13. Instrucciones para cualquier agente nuevo

Antes de modificar archivos:

1. Leer `PRODUCT.md`, `DESIGN.md`, `CONTINUIDAD_PROYECTO.md` y los README del
   subproyecto que se vaya a tocar.
2. Inspeccionar el código y los contratos reales; este documento es contexto,
   no reemplaza la verificación.
3. Respetar PostgreSQL v2 y el esquema `capricho`.
4. Mantener FastAPI como única vía a la base.
5. No inventar endpoints, categorías, productos, promociones o funciones.
6. No modificar más de una plataforma si la tarea no lo necesita.
7. Preservar cambios existentes del usuario.
8. Ejecutar las verificaciones correspondientes antes de finalizar.
9. Actualizar este documento cuando cambie el estado general del proyecto.

## 14. Prompt para continuar en otra tarea de Codex

```text
Continúa el proyecto académico Capricho Store desde el estado actual.

Antes de modificar archivos, lee PRODUCT.md, DESIGN.md,
CONTINUIDAD_PROYECTO.md y el README del subproyecto correspondiente. Inspecciona
también el código y los contratos reales de FastAPI.

Arquitectura obligatoria:
PostgreSQL schema capricho -> FastAPI -> Angular/Flutter.

Reglas:
- La base PostgreSQL v2 es definitiva.
- No recrear ni modificar tablas sin aprobación.
- Angular y Flutter nunca acceden directamente a PostgreSQL.
- No inventar endpoints ni funcionalidades.
- Catálogo: POLERA, CAMISA, POLO y BLUSA; BLUSA solo para MUJER.
- Web se orienta a cliente y administración.
- Flutter se orienta al cliente y futuro vestidor virtual.
- Mantener el sistema visual de DESIGN.md.
- Ejecutar las pruebas y analizadores del subproyecto modificado.

Primero informa qué parte del estado verificaste y después continúa únicamente
con el bloque solicitado.
```

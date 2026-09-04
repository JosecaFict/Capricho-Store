# Continuidad del desarrollo Flutter — Capricho Store

> Documento específico de Mobile. Para el estado completo de PostgreSQL,
> FastAPI, Angular y Flutter, leer primero `CONTINUIDAD_PROYECTO.md`.

Última actualización: 4 de septiembre de 2026.

Este documento permite continuar el desarrollo móvil desde otro equipo o desde
otra tarea de Codex sin perder las decisiones y el avance actual.

## 1. Estado general del proyecto

Capricho Store utiliza esta arquitectura:

```text
PostgreSQL
    ↓
FastAPI
  ↙   ↘
Angular  Flutter
```

- PostgreSQL utiliza el esquema `capricho`.
- La base de datos v2 existente es definitiva.
- FastAPI es la única vía de acceso a PostgreSQL.
- Angular y Flutter nunca deben conectarse directamente a PostgreSQL.
- No se deben recrear ni rediseñar las tablas existentes.
- El frontend Web continúa dentro de `frontend-web/`.
- La aplicación móvil continúa exclusivamente dentro de `mobile/`.

## 2. Función de cada interfaz

### Angular Web

- Interfaz pública básica para el cliente.
- Administración y operación interna.
- Empleados, roles, permisos, catálogo, proveedores, compras, recepciones,
  inventario, transferencias y demás módulos administrativos.

### Flutter Mobile

- Experiencia principal del cliente.
- Registro, inicio de sesión y perfil.
- Catálogo y detalle de producto.
- Más adelante: carrito, reservas, compras, delivery, pagos, seguimiento y
  notificaciones, únicamente cuando los endpoints correspondientes existan.
- El vestidor virtual con cámara y MediaPipe pertenece principalmente a Mobile,
  pero todavía no está implementado.

## 3. Catálogo oficial

Las únicas categorías permitidas actualmente son:

- `POLERA`: HOMBRE y MUJER.
- `CAMISA`: HOMBRE y MUJER.
- `POLO`: HOMBRE y MUJER.
- `BLUSA`: únicamente MUJER.

Categoría y público objetivo son campos separados. No deben crearse categorías
como `POLERA_HOMBRE` o `POLERA_MUJER`.

No se deben usar categorías ficticias como calzado, chaquetas, vestidos,
enterizos, accesorios, faldas, shorts, bolsos u otras prendas fuera del alcance.

## 4. Avance actual de Flutter

El proyecto Flutter ya fue creado para Android e iOS:

```text
mobile/
├── android/
├── ios/
├── lib/
│   ├── app/
│   │   ├── app.dart
│   │   └── router.dart
│   ├── core/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── network/
│   │   └── theme/
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   └── catalog/
│   │       ├── data/
│   │       ├── domain/
│   │       └── presentation/
│   ├── shared/widgets/
│   └── main.dart
├── test/
├── pubspec.yaml
└── README.md
```

### Funcionalidades implementadas

- Proyecto Flutter con soporte Android e iOS.
- Tema Material 3 adaptado al lenguaje visual de Capricho Store.
- Fondo cálido, texto negro y azul como acento.
- Navegación inferior entre Catálogo y Mi cuenta.
- Registro de clientes contra FastAPI.
- Inicio de sesión mediante correo y contraseña.
- JWT almacenado con `flutter_secure_storage`.
- Restauración de sesión mediante `/auth/me`.
- Cierre de sesión eliminando el token local.
- Catálogo conectado a datos reales de FastAPI.
- Filtro por categoría y público objetivo.
- Ordenamiento por nombre, precio y fecha de creación.
- Detalle de producto.
- Visualización de precio, imagen, descripción, tallas y colores.
- Indicador de compatibilidad con el vestidor virtual según
  `permite_vestidor`, sin activar todavía la cámara.
- Estados de carga, error, reintento y resultados vacíos.
- Configuración de URL de API mediante `--dart-define`.

### Dependencias instaladas

- `flutter_riverpod`
- `go_router`
- `dio`
- `flutter_secure_storage`
- `cached_network_image`
- `intl`

Las versiones exactas están bloqueadas en `mobile/pubspec.lock` y deben
conservarse en Git.

## 5. Endpoints consumidos actualmente

### Autenticación

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

El login devuelve un `access_token`. El cliente lo envía como:

```http
Authorization: Bearer <access_token>
```

### Catálogo

```text
GET /api/v1/products
GET /api/v1/products/{id_producto}
```

Los parámetros utilizados mantienen exactamente los nombres de FastAPI:

```text
categoria
publico_objetivo
sort
page
page_size
```

No se deben inventar respuestas locales, productos simulados ni endpoints que
el backend todavía no exponga.

## 6. URL de FastAPI según el dispositivo

La aplicación lee esta variable de compilación:

```text
API_BASE_URL
```

### Emulador Android

El emulador utiliza `10.0.2.2` para acceder al `localhost` del equipo anfitrión:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

### Dispositivo Android físico

FastAPI debe escuchar en la red local:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Después se utiliza la IPv4 de la laptop, por ejemplo:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.50:8000/api/v1
```

El teléfono y la laptop deben estar conectados a la misma red. No debe dejarse
una dirección IP de desarrollo escrita directamente en el código.

### iOS Simulator

En un Mac que también ejecuta FastAPI:

```bash
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Para iPhone físico se utiliza la dirección IP local del equipo que ejecuta
FastAPI. La compilación iOS requiere macOS y Xcode.

## 7. Preparar una laptop nueva

### Requisitos compartidos

1. Git.
2. Flutter estable.
3. Un editor como VS Code o Android Studio.
4. Clonar el repositorio.
5. No copiar `.env` con contraseñas al repositorio.

Comprobar Flutter:

```powershell
flutter --version
flutter doctor -v
```

Si Flutter no está en `PATH`, agregar la carpeta `flutter/bin` al `PATH` del
sistema y volver a abrir la terminal.

### Android

1. Instalar Android Studio.
2. Instalar Android SDK, Platform Tools y Command-line Tools.
3. Crear un dispositivo virtual desde Device Manager o conectar un teléfono con
   depuración USB.
4. Aceptar las licencias:

```powershell
flutter doctor --android-licenses
```

5. Confirmar el dispositivo:

```powershell
flutter devices
```

### iPhone

Para generar y probar la aplicación iOS se necesita un Mac:

1. Instalar Xcode.
2. Instalar las herramientas de línea de comandos de Xcode.
3. Instalar CocoaPods si Flutter lo solicita.
4. Abrir `mobile/ios/Runner.xcworkspace` cuando sea necesario configurar firma.
5. Ejecutar `flutter doctor -v` y resolver la sección de Xcode.

Windows puede desarrollar el código Flutter compartido, pero no puede compilar
ni firmar la aplicación iOS.

## 8. Obtener y ejecutar el proyecto

Después de clonar el repositorio:

```powershell
cd mobile
flutter pub get
flutter analyze
flutter test
```

Para Android Emulator:

```powershell
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

También debe estar ejecutándose FastAPI en otra terminal.

## 9. Validación realizada

En el equipo donde se inició Mobile:

```text
Flutter: 3.47.2 estable
Dart: 3.13.2
flutter analyze: sin observaciones
flutter test: 2 pruebas aprobadas
```

Pruebas existentes:

- Mapeo del contrato de producto de FastAPI.
- Conservación de nombres de parámetros al consultar el catálogo.

El APK todavía no fue generado porque en el equipo inicial no estaba instalado
Android SDK. El código sí fue validado mediante el analizador y las pruebas.

## 10. Archivos que no deben subirse

Respetar los `.gitignore` existentes. En particular, no versionar:

```text
backend/.env
backend/.venv/
mobile/.dart_tool/
mobile/build/
frontend-web/node_modules/
.npm-cache/
```

Sí deben versionarse:

```text
mobile/pubspec.yaml
mobile/pubspec.lock
mobile/android/
mobile/ios/
mobile/lib/
mobile/test/
```

Nunca subir contraseñas de PostgreSQL, `SECRET_KEY`, tokens JWT ni secretos de
servicios externos.

## 11. Flujo recomendado para sincronizar equipos

Antes de empezar a trabajar:

```powershell
git pull
```

Después de una unidad pequeña y validada de trabajo:

```powershell
git status
git add mobile CONTINUIDAD_FLUTTER.md PRODUCT.md
git commit -m "feat(mobile): describe brevemente el avance"
git push
```

En el segundo equipo se vuelve a ejecutar:

```powershell
git pull
cd mobile
flutter pub get
```

No trabajar simultáneamente en los mismos archivos desde dos equipos sin hacer
`git pull` previamente. Hacer commits pequeños facilita resolver conflictos.

## 12. Próximo bloque recomendado

1. Instalar Android SDK y crear el primer emulador.
2. Ejecutar Mobile contra FastAPI real.
3. Revisar visualmente teléfono pequeño, teléfono grande y tablet.
4. Añadir pruebas de widgets para login, registro, catálogo y detalle.
5. Completar los filtros móviles con marca, talla, color, temporada, sucursal y
   vestidor, manteniendo exactamente los parámetros actuales de FastAPI.
6. Implementar selección de sucursal y disponibilidad real.
7. Solo después, avanzar con carrito o reservas si sus endpoints ya existen.
8. Implementar cámara y MediaPipe en un bloque independiente y posterior.

## 13. Instrucciones para el siguiente agente

Antes de modificar el proyecto:

1. Leer `PRODUCT.md`, `DESIGN.md`, este documento y `mobile/README.md`.
2. Inspeccionar los contratos reales de FastAPI antes de crear una función.
3. Ejecutar `flutter pub get`, `flutter analyze` y `flutter test`.
4. Trabajar únicamente dentro de `mobile/`, salvo que exista autorización
   expresa para modificar otra parte.
5. No modificar PostgreSQL, la base v2 ni FastAPI para adaptar Mobile.
6. No desarrollar funciones administrativas en Flutter.
7. No presentar acciones de compra, reserva, pago o vestidor como operativas si
   todavía no existe soporte real.
8. Mantener Android e iOS desde el mismo código Flutter y probar diferencias de
   navegación, áreas seguras, teclado y botón Atrás.
9. Al finalizar cada bloque, ejecutar `flutter analyze` y `flutter test`.
10. Actualizar este documento si cambia una decisión, dependencia, endpoint o
    estado de implementación.

## 14. Texto para iniciar una nueva tarea de Codex

Se puede copiar el siguiente mensaje:

```text
Continúa el desarrollo Flutter de Capricho Store.

Antes de modificar archivos, lee PRODUCT.md, DESIGN.md,
CONTINUIDAD_FLUTTER.md y mobile/README.md. Después inspecciona el código actual
de mobile/ y los contratos existentes de FastAPI.

Respeta estas reglas:
- Flutter es para Android e iOS y está orientado al cliente.
- Toda operación pasa por FastAPI.
- No modificar PostgreSQL, la base v2, FastAPI ni Angular.
- No inventar endpoints, productos o funcionalidades.
- Catálogo oficial: POLERA, CAMISA, POLO y BLUSA; BLUSA solo para MUJER.
- Mantener el diseño y la arquitectura existentes.
- Ejecutar flutter analyze y flutter test al finalizar.

Empieza verificando el entorno con flutter doctor -v y continúa desde el
próximo bloque recomendado en CONTINUIDAD_FLUTTER.md.
```

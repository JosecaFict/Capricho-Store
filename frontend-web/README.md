# Capricho Store - Frontend web

Interfaz pública y panel operativo de Capricho Store construidos con Angular 21 y componentes standalone. Consume exclusivamente la API FastAPI y respeta el catálogo oficial: **POLERA**, **CAMISA**, **POLO** y **BLUSA**. La separación HOMBRE/MUJER se maneja como público objetivo, no como categorías nuevas; BLUSA se ofrece únicamente para MUJER.

## Requisitos

- Node.js 22.19 o superior compatible con Angular 21.
- npm 10 o superior.
- Backend FastAPI disponible en `http://127.0.0.1:8000`.

## Ejecución local

Primero inicia FastAPI desde otra terminal. Después:

```powershell
cd frontend-web
npm install
npm start
```

Abre `http://127.0.0.1:4200`.

`npm start` utiliza `proxy.conf.json` para reenviar `/api` al backend local. Así, el desarrollo funciona sin modificar FastAPI. Para un despliegue real, configura la URL de producción en `src/environments/environment.production.ts` y permite el origen del frontend en la configuración CORS del backend.

## Rutas disponibles

| Ruta             | Función                                 |
| ---------------- | --------------------------------------- |
| `/`              | Home pública                            |
| `/catalogo`      | Catálogo y filtros reales               |
| `/productos/:id` | Detalle, imágenes, variantes y medidas  |
| `/login`         | Inicio de sesión                        |
| `/registro`      | Registro de cliente                     |
| `/cuenta`        | Perfil autenticado, protegido por guard |
| `/admin`         | Panel operativo según permisos efectivos |

El panel incluye empleados, roles y permisos, catálogo, proveedores, órdenes de compra, recepciones, inventario, lotes, movimientos, transferencias y bitácora.

## Arquitectura

- `core/auth`: sesión JWT y almacenamiento local.
- `core/interceptors`: agrega `Authorization: Bearer <token>` a las peticiones.
- `core/guards`: protege rutas que requieren autenticación.
- `core/services`: integración tipada con FastAPI y mensajes de error.
- `features`: tienda pública, autenticación y administración operativa.
- `layouts`: cabecera, pie y estructura pública responsive.
- `shared`: tarjetas, estados reutilizables y formato de precios.
- `public/images`: fotografías Web optimizadas y limitadas al catálogo oficial.

La disponibilidad por sucursal se consulta en el detalle. Los formularios administrativos utilizan nombres de sucursales, proveedores, productos y variantes; los identificadores internos no se solicitan al usuario.

## Comandos de verificación

```powershell
npm run build
npm test -- --watch=false
npx prettier --check .
```

Angular CLI no generó una configuración ESLint para este proyecto. La compilación estricta de Angular/TypeScript, Vitest y Prettier constituyen las verificaciones configuradas actualmente.

## Alcance actual

No incluye carrito, reservas, ventas, pagos ni delivery. Los CTA públicos se limitan a navegación y consulta de información respaldada por FastAPI.

# Capricho Store - Frontend web

Interfaz pública de Capricho Store construida con Angular 21 y componentes standalone. Consume exclusivamente la API FastAPI existente y respeta el catálogo oficial: **POLERA**, **CAMISA**, **POLO** y **BLUSA**. La separación HOMBRE/MUJER se maneja como público objetivo, no como categorías nuevas; BLUSA se ofrece únicamente para MUJER.

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

## Arquitectura

- `core/auth`: sesión JWT y almacenamiento local.
- `core/interceptors`: agrega `Authorization: Bearer <token>` a las peticiones.
- `core/guards`: protege rutas que requieren autenticación.
- `core/services`: integración tipada con FastAPI y mensajes de error.
- `features`: Home, catálogo, detalle de producto y autenticación.
- `layouts`: cabecera, pie y estructura pública responsive.
- `shared`: tarjetas, estados reutilizables y formato de precios.
- `public/images`: fotografías Web optimizadas y limitadas al catálogo oficial.

La disponibilidad por sucursal se consulta en detalle cuando existe un identificador de sucursal. La interfaz pública no muestra un selector numérico inventado porque actualmente no existe un endpoint público que entregue nombres de sucursales.

## Comandos de verificación

```powershell
npm run build
npm test -- --watch=false
npx prettier --check .
```

Angular CLI no generó una configuración ESLint para este proyecto. La compilación estricta de Angular/TypeScript, Vitest y Prettier constituyen las verificaciones configuradas actualmente.

## Alcance actual

No incluye administración, carrito, reservas, pagos ni compra. Los CTA se limitan a navegación y consulta de información realmente disponible en FastAPI.

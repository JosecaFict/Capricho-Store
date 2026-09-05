# Despliegue de Capricho Store en Railway

Esta guía despliega inicialmente PostgreSQL y FastAPI. Angular y Flutter se
conectarán después, cuando sus entornos de producción estén definidos.

## 1. Antes de comenzar

Confirma localmente:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q -p no:cacheprovider
ruff check . --no-cache
```

Comprueba con `git status` que no se incluyan `.env`, `.venv`, `node_modules`,
cachés ni compilaciones. Después publica los cambios en GitHub.

## 2. Crear el proyecto Railway

1. Crea un proyecto vacío llamado `Capricho Store`.
2. Agrega `Database → PostgreSQL`.
3. Mantén PostgreSQL y FastAPI dentro del mismo proyecto y ambiente para que
   utilicen la red privada de Railway.

No generes acceso público para PostgreSQL salvo que sea imprescindible. Railway
CLI puede abrir un túnel sin exponer permanentemente la base.

## 3. Inicializar PostgreSQL una sola vez

Instala Railway CLI y PostgreSQL Client (`psql`). Desde la raíz del repositorio:

```powershell
railway login
railway link
railway connect Postgres
```

El último comando abre `psql`. Dentro de esa consola ejecuta:

```sql
\set ON_ERROR_STOP on
\i 'F:/Repositorios 2-2026/Capricho-Store/database/capricho_store_postgresql_completo_v2.sql'
\dn
\dt capricho.*
\q
```

Cambia la ruta si el repositorio está en otra computadora. Usa barras `/`
dentro de `psql` en Windows.

Para una base nueva se ejecuta solamente
`database/capricho_store_postgresql_completo_v2.sql`. No ejecutes el archivo de
`database/archive/`, porque sus correcciones ya están integradas.

## 4. Crear el servicio FastAPI

1. Agrega un servicio desde el repositorio GitHub de Capricho Store.
2. Nombra el servicio `Backend`.
3. En Settings configura:

```text
Root Directory: /backend
Config File Path: /backend/railway.json
```

El archivo `backend/railway.json` declara:

- Builder Railpack.
- Inicio con Uvicorn en `0.0.0.0:$PORT`.
- Healthcheck `/api/v1/ready`.
- Reinicio en caso de fallo.

## 5. Variables del Backend

En `Backend → Variables` agrega:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_NAME=Capricho Store API
APP_ENV=production
DEBUG=false
SECRET_KEY=REEMPLAZAR_POR_UNA_CLAVE_ALEATORIA
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
CORS_ORIGINS=
REDIS_URL=${{Redis.REDIS_URL}}
BREVO_API_KEY=REEMPLAZAR_POR_API_KEY_DE_BREVO
BREVO_SENDER_EMAIL=no-reply@tu-dominio.com
BREVO_SENDER_NAME=Capricho Store
PASSWORD_RESET_OTP_EXPIRE_MINUTES=10
PASSWORD_RESET_OTP_MAX_ATTEMPTS=5
PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS=60
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES=10
```

Si el servicio PostgreSQL tiene otro nombre, reemplaza `Postgres` por ese nombre
en la referencia. Railway ofrece autocompletado para seleccionar variables de
otro servicio.

El backend acepta las URLs `postgres://` y `postgresql://` entregadas por
Railway y las convierte internamente a `postgresql+asyncpg://`.

Genera una clave desde Python local y copia solamente el resultado en Railway:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

No guardes el resultado en GitHub ni en esta guía. Puedes sellar `SECRET_KEY`
desde el menú de variables de Railway.

`CORS_ORIGINS` puede quedar vacío mientras solo pruebes Swagger o Mobile. Cuando
Angular tenga dominio público, configúralo exactamente, sin ruta final:

```dotenv
CORS_ORIGINS=https://web-capricho.example.com
```

Para varios orígenes, sepáralos con comas.

### Recuperación de contraseña con Brevo

1. Agrega un servicio Redis al mismo proyecto y ambiente de Railway.
2. Usa la referencia privada `REDIS_URL=${{Redis.REDIS_URL}}`; no expongas Redis
   públicamente.
3. En Brevo crea una API key y verifica la dirección que usarás como remitente.
4. Guarda la API key únicamente en las variables del backend.

El código OTP dura 10 minutos, admite hasta 5 intentos y no se almacena en
texto plano. El endpoint de solicitud devuelve el mismo mensaje exista o no el
correo, para no revelar cuentas registradas. No se agrega ninguna tabla al
esquema PostgreSQL: Redis conserva solo el estado temporal del proceso.

## 6. Desplegar y generar dominio

1. Aplica los cambios pendientes en Railway.
2. Revisa Build Logs y Deploy Logs.
3. En `Backend → Settings → Networking`, selecciona `Generate Domain`.
4. No configures manualmente `PORT`; Railway lo inyecta.

Comprueba sustituyendo el dominio:

```powershell
Invoke-RestMethod https://TU_DOMINIO/api/v1/health
Invoke-RestMethod https://TU_DOMINIO/api/v1/ready
```

También abre:

```text
https://TU_DOMINIO/docs
```

Resultados esperados:

```json
{"status":"healthy","service":"Capricho Store API","environment":"production"}
```

```json
{"status":"ready","database":"available"}
```

## 7. Crear el dueño en Railway

Después de confirmar `/ready`, instala y vincula Railway CLI si aún no lo
hiciste. Abre una terminal dentro del contenedor Backend:

```powershell
railway ssh --service Backend
```

Dentro del servicio ejecuta:

```bash
python -m app.scripts.bootstrap_owner
```

El asistente crea la ciudad y sucursal inicial si todavía no existen y después
crea el primer usuario, empleado y rol `ADMIN` en una transacción. La contraseña
se solicita de forma oculta.

El comando se niega a crear otro `ADMIN` si el dueño ya existe. Los empleados
posteriores deben crearse desde Angular o los endpoints protegidos.

## 8. Verificación funcional

En Swagger:

1. Ejecuta `POST /api/v1/auth/login` con el dueño.
2. Copia `access_token`.
3. Pulsa `Authorize` y pega solamente el token.
4. Ejecuta `GET /api/v1/auth/me`.
5. Confirma que `roles` contenga `ADMIN`.
6. Consulta `/api/v1/roles`, `/api/v1/employees` y `/api/v1/products`.

El registro público `/api/v1/auth/register` debe continuar creando únicamente
clientes.

## 9. Diagnóstico rápido

### Railway no encuentra el backend

Confirma:

```text
Root Directory: /backend
Config File Path: /backend/railway.json
```

### El servidor no responde

Confirma en los logs que Uvicorn inició con:

```text
--host 0.0.0.0 --port $PORT
```

### DATABASE_URL inválida

Usa una referencia al servicio, no copies manualmente credenciales:

```dotenv
DATABASE_URL=${{Postgres.DATABASE_URL}}
```

### `/ready` devuelve 503

- Confirma que Backend y Postgres están en el mismo ambiente Railway.
- Confirma que la referencia apunta al nombre correcto del servicio.
- Revisa los Deploy Logs para errores de conexión.

### Las tablas no existen

Vuelve a conectar con `railway connect Postgres` y verifica:

```sql
\dt capricho.*
```

No vuelvas a ejecutar el SQL completo sobre una base ya inicializada. Si una
primera ejecución falló, su transacción debería haberse revertido; confirma el
estado antes de reintentarlo.

## 10. Copias de seguridad

Antes de cambios importantes, genera un respaldo lógico. Railway permite usar
un túnel local con:

```powershell
railway connect Postgres --tunnel-only
```

Con los datos de conexión mostrados, ejecuta `pg_dump` desde otra terminal. No
guardes respaldos con datos personales o contraseñas dentro del repositorio.

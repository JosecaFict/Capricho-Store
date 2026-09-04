# Capricho Store Mobile

Aplicación Flutter para clientes de Capricho Store. Esta primera etapa incluye autenticación, catálogo y detalle de producto consumiendo exclusivamente FastAPI.

## Ejecutar

Con FastAPI disponible en el puerto 8000:

```powershell
cd mobile
C:\Users\Josep\development\flutter\bin\flutter.bat pub get
C:\Users\Josep\development\flutter\bin\flutter.bat run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api/v1
```

`10.0.2.2` apunta al equipo anfitrión desde el emulador Android. En un dispositivo físico, inicia FastAPI para la red local y reemplaza esa dirección por la IPv4 del equipo:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

En iOS Simulator (requiere macOS y Xcode), usa `http://127.0.0.1:8000/api/v1` cuando el backend se ejecute en el mismo Mac.

## Alcance actual

- Registro, inicio y cierre de sesión con JWT almacenado de forma segura.
- Catálogo real: POLERA, CAMISA, POLO y BLUSA.
- Filtro por categoría y público, y ordenamiento.
- Detalle, talla, color y señal de compatibilidad con vestidor.
- Sin carrito, reservas, pagos, cámara ni MediaPipe hasta que sus módulos de backend o ciclo correspondiente estén habilitados.

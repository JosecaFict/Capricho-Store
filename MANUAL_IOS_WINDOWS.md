# Guía Maestra: Desarrollo y Ejecución de Capricho Store en iPhone desde Windows 11

Este manual documenta de forma 100% local y permanente toda la configuración, arquitectura, solución a problemas y comandos diarios para compilar, probar y desarrollar la aplicación móvil **Capricho Store** en un **iPhone 15 Pro Max físico** usando una laptop **Windows 11** sin costos de suscripción a Apple Developer.

---

## 1. Hardware y Especificaciones

* **Equipo Host:** Laptop MSI Cyborg 15 A13V
  * **Procesador:** Intel Core i7-13620H (10 núcleos, arquitectura híbrida P-Cores y E-Cores).
  * **Gráfica:** NVIDIA GeForce RTX 4050 Laptop GPU.
  * **RAM:** 16 GB DDR5.
  * **Sistema Operativo Host:** Windows 11 Home.
* **Dispositivo Físico:** iPhone 15 Pro Max
  * **Sistema Operativo Móvil:** iOS 17 / 18 (identificador de dispositivo: `00008130-00060911349A001C`).
  * **Conexión:** Cable USB-C a USB-C directo a la laptop.
* **Máquina Virtual Invitada (Guest):**
  * **Hipervisor:** VMware Workstation Pro 26H1u1 con Auto-Unlocker v2.0.2.
  * **Sistema Operativo:** macOS Sonoma 14.1.1 (arquitectura virtualizada Intel `x86_64`).
  * **Asignación de Recursos:** 8 GB RAM, 4 núcleos virtuales (vCPUs), 80 GB SSD dinámico, controlador USB 3.2.

---

## 2. Parches Esenciales de la Máquina Virtual

### Parche para procesadores Intel de 13va Generación (P-Cores / E-Cores)
En procesadores híbridos Intel de 12va, 13va o 14va generación, macOS entra en kernel panic si no se enmascara la topología de la CPU.  
En el archivo de configuración `MacOs Dev.vmx` de la máquina virtual (ubicado en `C:\Users\huasi\Documents\Virtual Machines\MacOs Dev\MacOs Dev.vmx`), se agregaron al final las siguientes líneas:

```ini
smc.version = "0"
cpuid.1.eax = "00000000000000110000011010100101"
```

### Optimización de Rendimiento en macOS
* **VMware Tools (`darwin.iso`):** Instalado en macOS y habilitado en *Configuración del Sistema > Privacidad y seguridad > Accesibilidad > vmware-tools-daemon*.
* **Fluidez visual:** En *Configuración del Sistema > Accesibilidad > Pantalla*:
  * Activar **Reducir movimiento**.
  * Activar **Reducir transparencia**.

---

## 3. Entorno de Desarrollo en macOS (Rutas y Herramientas)

Todas las herramientas instaladas dentro de macOS son de arquitectura **Intel (x86_64)**:

1. **Xcode:**
   * Versión: **Xcode 15.2** instalada en `/Applications/Xcode.app`.
   * Comando de enlace:
     ```bash
     sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
     sudo xcodebuild -runFirstLaunch
     sudo xcodebuild -license accept
     ```
2. **Flutter SDK:**
   * Ubicación: `~/development/flutter` (versión 3.47.2).
   * Configurado en `~/.zshrc`:
     ```bash
     export PATH="$HOME/development/flutter/bin:$PATH"
     ```
   * **Regla crítica para Xcode 15:** Se deshabilitó Swift Package Manager para que Flutter utilice CocoaPods de forma nativa:
     ```bash
     flutter config --no-enable-swift-package-manager
     ```
3. **CocoaPods y Certificados SSL de Ruby:**
   * Instalado en `/usr/local/bin/pod` (v1.15.2).
   * Los certificados raíz del sistema macOS se vincularon en `~/.zshrc` para evitar errores `SSL_connect certificate verify failed`:
     ```bash
     export SSL_CERT_FILE=/etc/ssl/cert.pem
     ```

---

## 4. Configuración del iPhone 15 Pro Max

### A. Reconocimiento por USB en la Máquina Virtual
Cada vez que se conecte el cable USB del iPhone a la laptop:
1. En el menú superior de VMware en Windows, ir a:  
   **VM > Removable Devices > Apple iPhone > Connect (Disconnect from Host)**.
2. En la pantalla del iPhone, si pregunta *"¿Confiar en esta computadora?"*, presionar **Confiar** e ingresar el código de bloqueo.

### B. Modo Desarrollador en iOS (Solo una vez)
1. En el iPhone: **Ajustes > Privacidad y seguridad > Modo Desarrollador**.
2. Activar el interruptor.
3. El iPhone se reiniciará automáticamente. Al encender, presionar **Activar** e ingresar el código.

### C. Confianza en el Certificado de Desarrollo (Solo una vez)
Cuando la aplicación se instale por primera vez en el iPhone:
1. Ir a: **Ajustes > General > VPN y gestión de dispositivos** (debajo de *App de desarrollador*).
2. Tocar en tu Apple ID: **`josephuagrm@icloud.com`**.
3. Presionar **Confiar en "josephuagrm@icloud.com"** y confirmar en **Confiar**.

---

## 5. Firmado en Xcode (Signing & Capabilities)

* **Apple ID Vinculado:** `josephuagrm@icloud.com` (gratuito, sin pago de $99/año).
* **Team:** `Jose carlos Villarroel (Personal Team)`.
* **Identificador de Bundle:** `com.caprichostore.caprichoStore`.
* La firma digital está configurada como automática (*Automatically manage signing*), generando el certificado `Apple Development: josephuagrm@icloud.com` y el perfil de aprovisionamiento `Xcode Managed Profile` gestionado por Apple.

---

## 6. Compatibilidad de Firebase con Xcode 15 (Problema y Solución)

### El Problema Detectado
Las versiones bleeding-edge de Firebase iOS SDK (versión 12 o 11.15+) fueron escritas con **Swift 6** (palabra clave `sending`, ownership de concurrencia y flags de Xcode 16). Como macOS Sonoma utiliza **Xcode 15.2 (Swift 5.9)**, el compilador de Xcode falla si se descargan esas versiones.

### La Solución Implementada en el Repositorio
1. **`mobile/pubspec.yaml`**:
   Se fijaron las versiones estables compatibles con Swift 5.9:
   ```yaml
   firebase_core: ^3.8.1
   firebase_messaging: ^15.1.6
   ```
2. **`mobile/ios/Podfile`**:
   Se bloqueó el SDK nativo de Firebase en la versión **`10.29.0`** (la versión definitiva escrita exclusivamente para Swift 5):
   ```ruby
   $FirebaseSDKVersion = '10.29.0'
   platform :ios, '15.0'

   target 'Runner' do
     use_frameworks!

     pod 'FirebaseCoreInternal', '10.29.0'
     pod 'FirebaseCore', '10.29.0'
     pod 'FirebaseInstallations', '10.29.0'
     pod 'FirebaseMessaging', '10.29.0'

     flutter_install_all_ios_pods File.dirname(File.realpath(__FILE__))
   end
   ```

---

## 7. Flujo Diario de Desarrollo

### A. Para programar con recarga instantánea (Hot Reload en 1 segundo):
1. Iniciar la máquina virtual `MacOs Dev` en VMware.
2. Conectar el iPhone 15 Pro Max por USB y pasarlo a la VM (*VM > Removable Devices > Apple iPhone > Connect*).
3. Abrir la Terminal en macOS y ejecutar:
   ```bash
   cd ~/Documents/Capricho-Store/mobile
   flutter run
   ```
4. Mantener el iPhone desbloqueado. Flutter abrirá la aplicación automáticamente.
5. **Teclas en la Terminal mientras programas:**
   * Presionar **`r`**: **Hot Reload** (aplica cambios de interfaz y lógica en ~1 segundo en la pantalla del iPhone).
   * Presionar **`R`**: **Hot Restart** (reinicia el estado completo de la app en ~3 segundos).
   * Presionar **`q`**: Cierra la sesión de depuración.

### B. Para instalar la app independiente (abrirla tocando la pantalla sin cables):
Si deseas llevarte el iPhone, desconectar el cable y usar Capricho Store libremente:
```bash
cd ~/Documents/Capricho-Store/mobile
flutter run --release
```
La versión Release compila en código binario AOT de 120 Hz ProMotion y se puede abrir en cualquier momento desde la pantalla de inicio del iPhone como cualquier app instalada.

---

## 8. Solución Rápida a Problemas Comunes

| Síntoma | Causa | Solución Rápida |
| :--- | :--- | :--- |
| `No connected devices found` | El cable se desconectó o Windows tiene el control del USB | En VMware: *VM > Removable Devices > Apple iPhone > Connect (Disconnect from Host)* |
| `Desarrollador no confiable` en iPhone | Primera instalación de un nuevo certificado | En iPhone: *Ajustes > General > VPN y gestión de dispositivos > josephuagrm@icloud.com > Confiar* |
| `In iOS 14+, debug mode apps can only be launched from tooling` | Se tocó el icono en la pantalla de inicio mientras no había debugger conectado | Cerrar la app desde el multitarea y correr `flutter run` en terminal, o instalar con `flutter run --release` |
| `Signing requires a development team` | Se perdió la configuración en Xcode | Ejecutar `open ios/Runner.xcworkspace`, ir a `Signing & Capabilities` y seleccionar `Jose carlos Villarroel (Personal Team)` |

---

## 9. Hoja de Ruta de Diseño: La Experiencia que Enamora (iOS vs Android)

Esta sección documenta cómo lograr que la aplicación no se sienta como una app genérica, sino que enamore al usuario adaptando su personalidad física y visual según el dispositivo:

### A. Los 6 Pilares de la Experiencia iOS (Apple Human Interface Guidelines)
1. **Física del Tacto y Gestos (120 Hz ProMotion):**
   - Scroll con rebote elástico natural (`BouncingScrollPhysics`).
   - Gesto interactivo de arrastrar desde el borde izquierdo para volver atrás (`CupertinoPageRoute` / swipe-to-back interactivo).
   - Micro-compresión elástica en tarjetas al tocarlas (escala al 96% con curva de resorte, en lugar de manchas de tinta).
2. **El Motor Háptico (*Taptic Engine* del iPhone 15 Pro Max):**
   - Clics mecánicos sutiles al cambiar de pestaña (`HapticFeedback.selectionClick()`).
   - Pulsos de confirmación al añadir al carrito (`HapticFeedback.mediumImpact()`).
   - Pop táctil al hacer pull-to-refresh.
3. **Efecto Vidrio Esmerilado (*Frosted Glass / Glassmorphism*):**
   - Barras de navegación superior e inferior con translucidez difuminada (`BackdropFilter` con `ImageFilter.blur(sigmaX: 20, sigmaY: 20)`).
   - El catálogo de prendas pasa por detrás de las barras desenfocándose con luminosidad.
4. **Títulos Gigantes Dinámicos (*iOS Large Titles*):**
   - Títulos en `34px, w800` (tipografía estilo **SF Pro**) que al hacer scroll se comprimen suavemente y se centran en miniatura en la barra superior.
5. **Curvaturas Continuas (*Apple Squircles*):**
   - Superelipses de 16 a 24 px en fotos de prendas y botones, eliminando bordes rectos y redondeos simples.
6. **Hojas Modales Arrastrables (*Draggable Action Sheets*):**
   - Para filtros, tallas o compras, se despliegan tarjetas flotantes desde abajo con barrita *grabber*, cerrables arrastrando con el dedo.

### B. Matriz de Diseño Adaptativo: El Toque iPhone vs El Toque Android
Ambas plataformas comparten el 100% de la lógica de negocio, catálogo y FastAPI, pero la experiencia sensorial se adapta automáticamente:

| Elemento | En iPhone (Toque Apple / Cupertino) | En Android (Toque Google / Material You) |
| :--- | :--- | :--- |
| **Física de scroll** | Rebote de goma elástica (*Bouncing Scroll* a 120 Hz) | Estiramiento elástico suave (*Overscroll Stretch*) |
| **Al tocar una prenda** | Compresión elástica de la tarjeta hacia adentro | Onda de agua luminosa interactiva (*Ink Ripple*) |
| **Gesto de volver** | Arrastrar el borde izquierdo con el pulgar | Gesto de retroceso predictivo con encogimiento 3D |
| **Barra de navegación** | Vidrio translúcido esmerilado con desenfoque de fondo | Barra de color tonal dinámico con píldora indicadora |
| **Ruedita de carga** | Rayitas grises giratorias de iOS (`CupertinoActivityIndicator`) | Arco circular giratorio continuo (`CircularProgressIndicator`) |
| **Icono de compartir** | Caja con flecha hacia arriba (icono estándar iOS) | Tres puntos unidos por líneas (icono estándar Android) |
| **Hojas de opciones** | Hoja modal curva flotante con botón Cancelar separado | Menú emergente de opciones flotante con bordes limpios |

### C. Estrategia de Implementación en Flutter (Un solo código)
1. **Constructores adaptativos:** Usar `Switch.adaptive()`, `Slider.adaptive()`, `CircularProgressIndicator.adaptive()`, `Icons.adaptive.share`, etc.
2. **Detección de plataforma:** Mediante `Theme.of(context).platform == TargetPlatform.iOS`, activar micro-escalas y háptica de Apple en iOS, y ondas *InkWell* en Android.
3. **Mantenimiento centralizado:** Un solo proyecto Flutter, un solo backend en Railway y una sola base de datos PostgreSQL.


---
name: Capricho Store
description: Escaparate editorial de ropa con precisión cromada y un único acento cobalto.
colors:
  canvas: "#f7f6f3"
  surface: "#ffffff"
  surface-muted: "#eceef1"
  ink: "#121418"
  ink-soft: "#565d67"
  line: "#cbd0d6"
  accent: "#064fe8"
  accent-dark: "#0039b8"
  danger: "#b42318"
  warning: "#7a4b00"
typography:
  display:
    fontFamily: "Alef, Segoe UI, sans-serif"
    fontSize: "clamp(3rem, 6vw, 4.625rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Alef, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Alef, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Alef, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Alef, Segoe UI, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 700
rounded:
  control: "8px"
  media: "12px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-dark}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.75rem 1.25rem"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.7rem 0.85rem"
  product-card-media:
    backgroundColor: "{colors.surface-muted}"
    rounded: "{rounded.media}"
  status-chip:
    backgroundColor: "transparent"
    textColor: "{colors.accent-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.35rem 0.65rem"
---

# Design System: Capricho Store

## Overview

**Creative North Star: "Plata fría, grafito, blanco y un único azul cobalto; fotografía editorial y reglas cromadas precisas"**

Capricho Store se comporta como un escaparate editorial modular: la fotografía ocupa superficies amplias, mientras una estructura de líneas finas, bloques nítidos y tipografía directa mantiene la navegación y el catálogo precisos. La atmósfera es moderna, limpia y cuidada; nunca administrativa ni parecida a una plantilla genérica.

El sistema es espacioso en las entradas de sección y compacto dentro de controles y fichas. El cobalto concentra la acción y el estado activo; el grafito sostiene el texto y las superficies oscuras. Las imágenes de implementación son referencias visuales, no contenido autorizado ni una ampliación del catálogo oficial.

**Key Characteristics:**

- Composición editorial asimétrica con fotografía dominante.
- Base fría de blanco, plata y grafito con un único acento cobalto.
- Líneas cromadas finas y profundidad casi plana.
- Alef firme, legible y de alta presencia en titulares.
- Ritmo amplio entre secciones y densidad controlada dentro de componentes.

## Colors

La paleta combina papel frío, metal claro y grafito; el cobalto es la única voz cromática de marca.

### Primary

- **Cobalto singular:** señala acciones primarias, foco, selección y estados activos.
- **Cobalto profundo:** confirma hover y sostiene enlaces de énfasis y precios destacados.

### Neutral

- **Papel frío:** forma el lienzo general y evita el blanco clínico.
- **Blanco óptico:** separa héroes, formularios y superficies de contenido.
- **Plata mate:** resuelve fondos de apoyo, esqueletos y contenedores discretos.
- **Grafito:** gobierna texto, bordes de máximo contraste y fondos oscuros.
- **Grafito suave:** reserva la jerarquía secundaria para metadatos y ayudas.
- **Línea cromada:** divide estructura sin introducir volumen decorativo.

### Named Rules

**The One Cobalt Rule.** El acento se reserva para acción, foco y selección; no se introducen otros colores de marca para decorar.

**The Functional Signal Rule.** Peligro y advertencia aparecen únicamente en estados semánticos, nunca como acentos editoriales.

## Typography

**Display Font:** Alef (con Segoe UI y sans-serif como respaldo)  
**Body Font:** Alef (con Segoe UI y sans-serif como respaldo)

**Character:** Una sola familia produce continuidad entre marca, títulos, navegación y lectura. Los titulares compactos y ligeramente cerrados aportan carácter editorial; el cuerpo conserva una cadencia abierta y funcional.

### Hierarchy

- **Display:** peso fuerte, escala fluida y línea compacta; se reserva para el titular principal y títulos de producto.
- **Headline:** escala fluida y compacta para aperturas de sección.
- **Title:** título breve y firme para tarjetas y bloques de estado.
- **Body:** lectura regular y aireada; los textos explicativos se limitan habitualmente a medidas de 28, 42 o 60 caracteres.
- **Label:** pequeña y fuerte para metadatos, controles, ayudas y chips; las notas de procedencia usan mayúsculas con espaciado amplio.

### Named Rules

**The One-Family Rule.** La jerarquía nace de escala, peso y espaciado; no de mezclar familias tipográficas.

## Layout

El contenedor general alcanza 1400px y deja 24px de margen lateral en escritorio; por debajo de 768px, el margen baja a 16px. La portada abre con una división editorial 32/68 entre texto y fotografía, pasa a 40/60 en pantallas medianas y se apila en móvil con la fotografía primero. El catálogo usa cuatro columnas, luego tres, dos y finalmente una en los cortes observados de 1050px, 767px y 480px.

Las secciones principales separan su contenido con 7rem en escritorio y 5rem en móvil. Dentro de grids, la cadencia es más tensa: 20px entre accesos de público y 18–28px entre fichas. Los filtros colapsan de tres a dos y una columna; el detalle cambia de dos columnas a una y desactiva la ficha informativa fija en móvil.

**The Editorial Split Rule.** Una superficie dominante conduce la mirada y la columna secundaria explica o habilita la acción; no se reparte el primer plano en cajas equivalentes.

## Elevation & Depth

El sistema es plano por defecto. La profundidad se comunica con contraste tonal, fotografía recortada, líneas de 1px y el desenfoque translúcido del encabezado fijo. No hay sombras ambientales en tarjetas o botones; el único halo observado es el anillo cobalto semitransparente de los campos enfocados.

### Shadow Vocabulary

- **Foco de campo:** halo de 3px alrededor de inputs y selects enfocados; comunica interacción, no elevación.

### Named Rules

**The Flat-by-Default Rule.** Las superficies descansan sin sombra; bordes, recorte y tono construyen la jerarquía.

## Shapes

Los controles usan esquinas suavemente redondeadas de 8px. Los marcos fotográficos y medios de tarjeta suben a 12px para sentirse como placas editoriales. Los chips de estado son la única forma de cápsula completa. Las líneas rectas y los bordes superior e inferior conservan la precisión cromada del sistema.

**The Two-Radius Rule.** Usa 8px en controles y contenedores compactos, 12px en medios dominantes; la cápsula queda reservada a estados breves.

## Components

### Buttons

Los botones son firmes y contenidos, con una altura táctil mínima de 48px.

- **Shape:** control suavemente redondeado, borde de 1px y texto fuerte.
- **Primary:** cobalto sobre blanco, con relleno horizontal generoso.
- **Hover / Focus:** el primario profundiza el cobalto; el foco global usa un contorno cobalto de 3px desplazado 3px; al presionar, reduce su escala a 0.97.
- **Secondary / Quiet:** el secundario invierte a grafito sobre hover; el quiet usa grafito suave y recibe plata mate al pasar el puntero.

### Chips

- **Style:** cápsula transparente con borde cobalto, texto cobalto profundo y peso fuerte.
- **State:** se usa para estado breve, no como ornamento o navegación principal.

### Cards / Containers

Las fichas de producto dejan que la imagen lidere y mantienen el contenido sobre el lienzo, sin panel blanco ni sombra añadida.

- **Corner Style:** solo el medio se recorta como placa de 12px.
- **Background:** plata mate detrás de imágenes y esqueletos; contenido sobre el lienzo.
- **Shadow Strategy:** ninguna sombra en reposo.
- **Border:** sin contorno exterior; los paneles de estado usan líneas superior e inferior.
- **Internal Padding:** el contenido comienza 1rem debajo del medio.

### Inputs / Fields

- **Style:** blanco, borde gris medio, esquina de 8px y altura táctil mínima de 48px; la etiqueta siempre permanece visible.
- **Focus:** borde cobalto y halo semitransparente de 3px.
- **Error / Disabled:** el error cambia el borde a rojo semántico y muestra texto persistente; los botones deshabilitados conservan estructura con opacidad reducida.

### Navigation

El encabezado es fijo, translúcido y separado por una línea cromada. Marca y enlaces usan peso fuerte; el activo se expresa con una línea cobalto animada. En móvil, un botón de menú abre una lista vertical de ancho completo bajo una barra de 64px.

### Status Panels

Los estados vacíos y de error se centran entre dos reglas horizontales, sin caja elevada. El error cambia esas reglas al color semántico y ofrece una acción secundaria para reintentar.

## Do's and Don'ts

### Do:

- **Do** usa cobalto para acción, foco, selección y estado activo.
- **Do** permite que una fotografía editorial compatible con POLERA, CAMISA, POLO o BLUSA domine la composición cuando exista una fuente válida.
- **Do** conserva BLUSA únicamente para MUJER y trata categoría y público como dimensiones separadas.
- **Do** resuelve jerarquía mediante escala, espacio, líneas y contraste tonal.
- **Do** mantiene etiquetas persistentes, foco visible y movimiento reducido.

### Don't:

- **Don't** introduzcas colores de acento adicionales, degradados decorativos o sombras de tarjeta.
- **Don't** conviertas la interfaz en un dashboard de paneles equivalentes.
- **Don't** uses contenido o fotografía ficticia como autoridad de catálogo; toda referencia temporal debe identificarse.
- **Don't** inventes categorías, públicos, promociones ni acciones de compra o reserva.
- **Don't** uses radios de cápsula salvo en chips de estado breves.

# MAPPI · Rappi (prototipo v3)

Prototipo académico (UDD, Equipo McFlurry) de **MAPPI**, una sección dentro de Rappi con recomendaciones de personas con gustos parecidos, y de **Radar**, el panel interno que convierte esas señales en decisiones para el equipo de Rappi. Todos los datos son ficticios.

## Cómo está organizado

```
index.html            ESTRUCTURA: barra superior, carcasa del iPhone, paneles
css/styles.css        APARIENCIA: colores de Rappi, carcasa, pantallas, responsivo
js/                   COMPORTAMIENTO
  config.js           ajustes: clave de Google Maps y ubicación simulada
  data.js             base de datos simulada (restaurantes, personas, opiniones…)
  icons.js            íconos SVG
  util.js             utilidades pequeñas
  db.js               guarda y lee la base (localStorage del navegador)
  engine.js           motor de señales y puntajes de Radar
  domain.js           reglas del negocio: pedidos, opiniones, monedas, canjes
  map.js              mapa real (Google Maps u OpenStreetMap)
  mappi.js            pantallas de Rappi y MAPPI
  radar.js            pantallas de Radar
  app.js              estado, acciones, animaciones y arranque
img/                  fotos de los platos e íconos de la app
manifest.webmanifest  permite "Agregar a inicio" en el celular
```

Regla práctica: si quieres cambiar **qué hay** en la página, revisa `index.html` o la pantalla en `js/mappi.js`. Si quieres cambiar **cómo se ve**, ve a `css/styles.css`. Si quieres cambiar **qué hace** un botón, busca su `data-a="..."` en `js/app.js` (objeto `A`).

## Probarlo en el computador

Abre una terminal en esta carpeta y ejecuta:

```
python3 -m http.server 8000
```

Luego entra a http://localhost:8000. Abrir `index.html` con doble clic también funciona, pero un servidor local se parece más a GitHub Pages.

## Subirlo a GitHub Pages (gratis) y verlo en el celular

1. Crea una cuenta en https://github.com si no tienes.
2. Arriba a la derecha: **+ > New repository**. Nombre sugerido: `mappi-rappi`. Déjalo **Public** y crea el repositorio.
3. En la página del repositorio vacío, haz clic en **uploading an existing file**. Arrastra **todo el contenido** de esta carpeta (index.html, css, js, img, manifest.webmanifest, README.md). Escribe un mensaje como "v3: feedback Rappi" y presiona **Commit changes**.
4. Ve a **Settings > Pages**. En "Branch" elige `main` y la carpeta `/ (root)`. Guarda.
5. Espera 1 o 2 minutos. Tu prototipo queda en `https://TU-USUARIO.github.io/mappi-rappi/`.
6. Abre ese enlace en el celular. La carcasa desaparece y MAPPI ocupa toda la pantalla. En iPhone: **Compartir > Agregar a inicio** para abrirlo como app.

Cada vez que subas una versión nueva, GitHub guarda la anterior (pestaña **Commits**). Si algo se rompe, puedes volver atrás.

Truco: en `index.html` los archivos CSS y JS terminan en `?v=5`. Cuando cambies algo, sube ese número (por ejemplo `?v=6`) para que el celular no muestre la versión vieja guardada en caché.

Con Git instalado, los pasos 3 en adelante también se hacen desde la terminal:

```
git init
git add .
git commit -m "v3: feedback Rappi"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mappi-rappi.git
git push -u origin main
```

## Conectar Google Maps

Por defecto el mapa usa OpenStreetMap (gratis, sin clave). Para usar Google Maps, sigue las instrucciones al inicio de `js/config.js` y pega tu clave en `GOOGLE_MAPS_KEY`. Si la clave falla, el prototipo vuelve solo a OpenStreetMap. El botón **Cómo llegar** ya abre Google Maps sin necesitar clave.

## Qué cambió en la v3 (feedback de la revisión y de la entrevista con Rappi)

| Feedback | Cambio |
|---|---|
| Usar colores de Rappi / falta identidad Rappi | Naranjo Rappi `#FF441F` para marca y pestaña activa, verde `#2BBF55` para botones de acción, fondo blanco y botones en píldora. Inicio y Cuenta de Rappi recreados a partir de la app actual (dirección, buscador, categorías, menú Inicio · Ofertas · MAPPI · Cuenta). Las Monedas MAPPI aparecen en Cuenta junto a Créditos y Cupones. |
| No se explica cómo se ganan los puntos | Hoja "Así ganas Monedas MAPPI" que aparece la primera vez que entras, botón **?** junto al saldo, franja "+20 monedas por cada opinión" en Inicio y Perfil, y enlace "¿Cómo funciona?" al opinar y en la billetera. |
| Carcasa de smartphone | Carcasa de iPhone con isla dinámica, barra de estado e indicador de inicio. En un celular real se quita sola. |
| Crear web app y mostrarla desde el celular | Archivo `manifest.webmanifest`, íconos y ajustes para "Agregar a inicio". Respeta las zonas seguras del iPhone. |
| Conectar a Google Maps | Mapa real con calles (OpenStreetMap, o Google Maps con clave) y botón **Cómo llegar** que abre Google Maps. |
| Respetar siempre márgenes | Un único margen lateral de 16 px (`--gutter`) en todas las pantallas; carruseles y filtros se alinean con él. |
| Cerca de ti → acercar el mapa | Al elegir "Cerca de ti" el mapa se acerca a lo que está a pocas cuadras; botón para volver a tu ubicación. |
| Falta usuario/cuenta/perfil | Pestaña **Perfil**: datos, estadísticas, perfil público o privado, gustos editables, opiniones, "Quiero probar" y pedidos. |
| Entrevista: a las marcas no les gustan los comentarios abiertos | El comentario ahora es opcional; lo principal es Sí / Depende / No y las etiquetas. |
| Dividir el código en HTML, CSS y JS | Ver "Cómo está organizado". |

## Wireframes con Stitch

Para explorar variantes rápidas en https://stitch.withgoogle.com/ puedes partir de este texto:

> Diseña una pantalla móvil de "MAPPI", una sección nueva dentro de la app de Rappi (delivery, Chile). Estilo de Rappi: fondo blanco, naranjo #FF441F para la marca, verde #2BBF55 para botones de acción, botones en píldora, tipografía sans geométrica. La pantalla muestra: historias circulares de personas con gustos parecidos, una franja "Opina tus pedidos y gana +20 monedas", un mapa con pines que indican opiniones verificadas y tarjetas de restaurantes con foto. Menú inferior: Inicio, Mapa, Personas, Monedas, Perfil.

## Créditos

Íconos: Phosphor Icons (MIT). Mapa: © OpenStreetMap. Gráficos de Radar: Chart.js. Prototipo sin relación oficial con Rappi; datos ficticios.

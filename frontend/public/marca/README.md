# Archivos de marca

Todo lo que está en `frontend/public/` se sirve tal cual desde la raíz del
sitio: un archivo en `public/marca/isotipo.svg` se pide como
`/marca/isotipo.svg`. **No hay que importarlo en el código ni recompilar**:
basta con dejar el archivo aquí con el nombre exacto de la tabla.

Mientras un archivo no exista, la aplicación dibuja una versión
provisional (ver `src/components/Logo.tsx`). Nada se rompe.

## Logotipos

| Archivo | Dónde se usa | Formato recomendado |
|---|---|---|
| `inlotrans-blanco.svg` | Barra lateral (fondo azul marino) | SVG, logo en blanco, alto libre |
| `inlotrans-color.svg` | Login y documentos (fondo blanco) | SVG a color |
| `isotipo.svg` | Barra lateral colapsada y pestaña del navegador | SVG cuadrado (1:1) |

Si solo hay PNG, sirve igual: cambia la extensión en `Logo.tsx`. Se
prefiere SVG porque no se pixela al imprimir el PDF de la remisión.

## Pendiente de autorización

| Archivo | Estado |
|---|---|
| `pepsico.svg` | **No usar todavía.** Es marca de un tercero; falta que el área confirme si puede aparecer dentro del aplicativo. |

## Imágenes de apoyo

| Carpeta | Contenido |
|---|---|
| `ilustraciones/` | Íconos e ilustraciones de las etapas del proceso |
| `fotos/` | Fotografías (camión, planta) para los bloques destacados |

Recomendación para las fotos: JPG o WebP de máximo 1600 px de ancho y
menos de 300 kB. Los equipos de planta cargan por red interna y una foto
de 4 MB se nota.

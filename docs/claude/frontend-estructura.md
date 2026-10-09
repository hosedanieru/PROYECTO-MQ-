# Estructura del frontend

> Leer cuando se crean pantallas, hooks o componentes. Índice en `CLAUDE.md`.
> Árbol tomado del código el 2026-10-07.

## Reglas

- Nada llama a axios fuera de `services/http.ts`.
- Los permisos solo **ocultan** acciones; la autorización real es del backend.
- Filtros, periodo y vista elegida viven en la **URL** (`?fecha=`, `?periodo=`, `?vista=`).
- Las mutaciones invalidan exactamente las claves de caché que tocan (TanStack Query).
- Colores solo como **tokens** de `index.css` (nada de hex en los componentes). Texto ≥ 12 px; blanco sobre
  fondo oscuro al 80 % como mínimo. **Nunca `text-base`** para el tamaño: en este proyecto genera SOLO
  `color: var(--base)` (existe el token de color `base`); usar `text-[1rem]`.
- Los **formularios** no se rediseñan sin consultar antes al usuario (bocetos).
- Una librería, un solo archivo de entrada: axios → `services/http.ts`; anime.js → `shared/animacion/animaciones.ts`;
  Motion → `shared/animacion/movimiento.ts`; three/fiber/drei → `shared/visual3d/` (cargado con `lazy`).

## Árbol

```text
frontend/src/
├── main.tsx, index.css            entrada; tokens de color y tema claro/oscuro en index.css
├── app/
│   ├── providers.tsx              MotionConfig → Idioma → Tema → QueryClient → Sesión → Router
│   ├── router.tsx                 todas las rutas; las viejas redirigen (RedirigirConConsulta conserva ?…)
│   ├── layout/                    AppLayout, BarraSuperior (navegación arriba), MenuPrincipal, MenuDesplegable,
│   │                              MenuMovil (< 1024 px), MenuCuenta, ChipDiaOperativo, navegacion.ts (menú)
│   └── pages/                     InicioPage + inicio/ (avisos y accesos rápidos; sin cifras ni gráficas)
├── components/                    piezas visuales sin negocio:
│   │                              EncabezadoPagina (banda con figura 3D), CifraEstado, PestanasVista,
│   │                              ListaRegistros/FilaRegistro/MetaDato, Seccion, Ficha, LineaTiempo, Tabla,
│   │                              PanelFiltros, Paginacion, BarraProporcion, SelectorSegmentado, Dialogo, Boton, …
│   └── graficas/                  Medidor, Anillo, Dona, Barras, BarraProgreso (SVG propio, sin librería)
├── services/                      http.ts (axios), almacen-token.ts, archivos.ts (descargas)
├── shared/
│   ├── animacion/                 animaciones.ts + useAnimacion.ts (anime.js), movimiento.ts (Motion)
│   ├── visual3d/                  HeroVisual3D (puerta, lazy), Escena3D, EntornoPlanta (reflejos), giro.ts
│   │                              (arrastre con inercia), escenas.tsx (una por módulo), piezas/
│   ├── idioma/                    español / inglés (textos/es.ts, textos/en.ts)
│   ├── tema/                      claro / oscuro
│   ├── types/                     tipos de la API por módulo
│   ├── utils/                     fechas (día operativo en UTC, instantes en Bogotá), numeros, horas, agrupar
│   └── refresco.ts                intervalos de refresco por pantalla
└── modules/                       un módulo por área: api/ (llamadas), hooks/ (TanStack Query), pages/, components/
    ├── auth/                      login, sesión, RutaProtegida
    ├── remisiones/                listado, detalle (recorrido, firmas, historial), crear, editar
    ├── mfr/                       ProgramacionPage (solo lo editable), TableroMfrPage, TableroTvPage (modo TV),
    │   │                          semaforo.ts, ritmo.ts, resumen-vistas.ts
    │   └── components/indicadores/   vistas de FR, OTIF, ritmo, ranking, productividad, averías vs fabricado
    ├── tableros/                  un tablero por indicador (/tableros/*), usePeriodoTablero (día / 7 días / mes)
    ├── averias/                   listado (línea de tiempo), nuevo reporte (cámara), detalle
    ├── inventario/                existencias, kardex, entradas, PT/PI/insumos, unidades, cierre del día
    ├── correo/                    listas y envíos
    ├── catalogo/                  catálogos compartidos
    └── admin/                     usuarios, grupos, líneas, pesos, causales
```

## Rutas de los tableros (2026-10-06)

`/tableros/mfr`, `/fr`, `/otif`, `/ritmo`, `/pt`, `/productividad`, `/averias-fabricado`, `/averias-limite`,
`/alertas-inventario`, `/metas-personal`. Redirigen: `/mfr` y `/mfr/indicadores` → `/tableros/mfr`;
`/inventario/alertas` → `/tableros/alertas-inventario`; `/tableros` → `/tableros/mfr`. Modo TV: `/mfr/tv`.

## Verificación

`npm run build` (= `tsc -b` + `vite build`) y `npm run lint` (**oxlint**, no ESLint). Para revisar pantallas
con Chrome sin pantalla, usar la GPU real (`--use-angle=d3d11`): con swiftshader las escenas 3D salen vacías.
Nunca correr `prettier --write` sin `--no-semi --single-quote --print-width 110` (no hay `.prettierrc`).

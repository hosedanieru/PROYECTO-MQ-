/** Medidas de las piezas de empaque, en unidades de la escena. Las comparten las piezas y las escenas que apilan cajas. */
export const MEDIDAS = {
  caja: { ancho: 1.3, alto: 0.9, fondo: 0.9 },
  estiba: { ancho: 2.4, fondo: 1.8 },
  /** Altura de la cara superior de la estiba: ahí se apoyan las cajas. */
  alturaEstiba: 0.2,
} as const

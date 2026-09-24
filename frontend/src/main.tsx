import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/*
 * La tipografía va empaquetada con la aplicación, no cargada de
 * internet: la planta puede quedarse sin conexión y una fuente que no
 * llega desmaqueta todas las pantallas. Es la versión variable (un solo
 * archivo para todos los grosores).
 */
import '@fontsource-variable/inter'

import { Providers } from './app/providers'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers />
  </StrictMode>,
)

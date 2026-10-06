import { Badge, COLOR_TONO } from '../../../components/Badge'
import { Dato } from '../../../components/Dato'
import { Desplegable } from '../../../components/Desplegable'
import { BarraProgreso } from '../../../components/graficas/BarraProgreso'
import type { Producto } from '../../../shared/types/catalogo'
import type { ResumenTurno } from '../../../shared/types/mfr'
import { miles, porcentaje, proporcion } from '../../../shared/utils/numeros'
import { textoSemaforo, tonoSemaforo } from '../semaforo'

interface Props {
  turno: ResumenTurno
  meta: number
  /** Para poner el nombre del producto donde antes iba solo el código. */
  productos: Producto[] | undefined
  /** Para poner el nombre de la línea donde antes iba su id. */
  lineas: Array<{ lineaId: string; codigo: string; nombre: string }>
}

/**
 * UN TURNO, COMO COLUMNA ABIERTA
 * ==============================
 *
 * Antes era una tarjeta; desde el 2026-10-05 el usuario pidió dejar las
 * tarjetas ("muy repetitivo y genérico"). Ahora es una columna sin caja:
 * una barra del color del semáforo arriba anuncia el estado, y los tres
 * turnos se separan con líneas finas (las pone la vista que los agrupa).
 *
 * Responde en tres niveles:
 *   1. ¿Vamos bien?      → la cifra grande y la barra contra la meta
 *   2. ¿Con qué?         → producción, kilos y personal
 *   3. ¿Con qué detalle? → plegado: eficiencia, personal por grupo y programación
 *
 * Las siglas del DPP (T, Mx, E) se conservan junto al nombre en español.
 */
export function ColumnaTurno({ turno, meta, productos, lineas }: Props) {
  const nombreProducto = (id: string) => productos?.find((p) => p.id === id)
  const nombreLinea = (id: string) =>
    lineas.find((l) => l.lineaId === id)?.nombre ?? lineas.find((l) => l.lineaId === id)?.codigo ?? id

  const sinOperar = turno.horasTurno === null
  const avance = proporcion(turno.producidoCajas, turno.targetCajas)
  const tono = tonoSemaforo(turno.semaforo)

  return (
    <article className="relative px-1 pt-5 md:px-6">
      {/* Barra del semáforo: el estado del turno se reconoce desde lejos. */}
      <span
        className="absolute inset-x-1 top-0 h-1.5 rounded-full md:inset-x-6"
        style={{ backgroundColor: COLOR_TONO[tono], boxShadow: `0 0 16px ${COLOR_TONO[tono]}` }}
        aria-hidden="true"
      />

      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black tracking-tight text-tinta">{turno.nombre}</h3>
          <p className="text-sm text-tinta-suave">
            {sinOperar ? 'Este turno no opera hoy' : `${turno.codigo} · ${turno.horasTurno} horas productivas`}
          </p>
        </div>
        {turno.cerrado ? (
          <Badge tono="neutro">Cerrado</Badge>
        ) : (
          <Badge tono="marca" punto>
            Abierto
          </Badge>
        )}
      </header>

      {/* ---------- 1. ¿Vamos bien? ---------- */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="cifra text-6xl font-black leading-none tracking-tight text-tinta">
          {porcentaje(turno.cumplimiento)}
        </span>
        <Badge tono={tono}>{textoSemaforo(turno.semaforo)}</Badge>
      </div>

      <div className="mt-3">
        <BarraProgreso
          valor={avance ?? 0}
          tono={tono}
          titulo={`${turno.nombre}: ${miles(turno.producidoCajas)} de ${miles(turno.targetCajas)} cajas`}
        />
        <p className="mt-1.5 text-xs text-tinta-suave">Lo producido frente a la meta del turno. La meta del área es {meta} %.</p>
      </div>

      {/* ---------- 2. ¿Con qué? ---------- */}
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
        <Dato etiqueta="Producido" valor={miles(turno.producidoCajas)} unidad="cajas" destacado nota="Solo las aprobadas por el OPA" />
        <Dato
          etiqueta="Meta del turno"
          sigla="T"
          valor={miles(turno.targetCajas)}
          unidad="cajas"
          destacado
          nota={`Máximo teórico (Mx): ${miles(turno.maxCajas)}`}
        />

        {turno.targetKg > 0 && (
          <Dato etiqueta="Peso producido" valor={miles(turno.producidoKg)} unidad={`de ${miles(turno.targetKg)} kg`} />
        )}

        {/* Contra lo que pide el DPP (2026-09-30); la nota dice si además un grupo quedó corto. */}
        <Dato
          etiqueta="Personal del turno"
          valor={`${turno.personal.llegaron} de ${turno.personal.requeridasDpp || turno.personal.esperadas}`}
          unidad={turno.personal.requeridasDpp > 0 ? 'que pide el DPP' : 'personas'}
          nota={
            [
              turno.personal.coberturaDpp !== null ? `Cobertura ${porcentaje(turno.personal.coberturaDpp)}` : null,
              turno.personal.faltanteDpp > 0 ? `faltan ${turno.personal.faltanteDpp} contra el DPP` : null,
              turno.personal.faltante > 0 ? `faltaron ${turno.personal.faltante} de los grupos` : null,
            ]
              .filter(Boolean)
              .join(' · ') || (turno.personal.estado === 'SIN_DATO' ? 'Falta registrar la asistencia' : 'Personal completo')
          }
        />
      </dl>

      {/* ---------- 3. El detalle, plegado ---------- */}
      <div className="mt-5">
        <Desplegable titulo="Eficiencia del turno" resumen={`real ${porcentaje(turno.eficienciaReal)}`}>
          <dl className="grid grid-cols-2 gap-4">
            <Dato
              etiqueta="Planeada"
              sigla="T ÷ Mx"
              valor={porcentaje(turno.eficienciaPlaneada)}
              nota="Qué parte del máximo teórico pidió PepsiCo"
            />
            <Dato etiqueta="Real" valor={porcentaje(turno.eficienciaReal)} nota="Qué parte del máximo teórico se alcanzó" />
          </dl>
          {turno.personasAsignadas > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-tinta-suave">
              La programación pide <strong>{turno.personasAsignadas} personas</strong> sumando la línea ideal de cada
              bloque. Es lo que el DPP considera necesario, no lo que hay.
            </p>
          )}
        </Desplegable>

        <Desplegable titulo="Personal por grupo" resumen={`${turno.personal.grupos.length} grupos`}>
          <ul className="space-y-1.5">
            {turno.personal.grupos.map((grupo) => {
              const completo = grupo.esperadas !== null && grupo.llegaron >= grupo.esperadas
              return (
                <li key={grupo.grupoId} className="flex items-center gap-2 text-sm">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${completo ? 'bg-exito' : 'bg-alerta'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-tinta">{grupo.nombre}</span>
                  <span className="cifra shrink-0 text-tinta-suave">
                    {grupo.llegaron}
                    {grupo.esperadas !== null && ` de ${grupo.esperadas}`}
                  </span>
                </li>
              )
            })}
          </ul>

          {turno.personal.lineas.some((l) => l.grupos.length > 0) && (
            <>
              <p className="mb-1.5 mt-3 text-xs font-semibold text-tinta-suave">Reparto por línea</p>
              <ul className="space-y-1">
                {turno.personal.lineas
                  .filter((l) => l.grupos.length > 0)
                  .map((linea) => (
                    <li key={linea.lineaId} className="text-sm text-tinta-suave">
                      <span className="font-medium text-tinta">{linea.nombre}</span>:{' '}
                      {linea.grupos.map((g) => `${g.nombre} (${g.personas} personas)`).join(' + ')}
                      {linea.estado === 'INCOMPLETA' && <span className="text-alerta"> — faltan {linea.faltante}</span>}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Desplegable>

        <Desplegable
          titulo="Programación del turno"
          resumen={`${turno.bloques.length} ${turno.bloques.length === 1 ? 'bloque' : 'bloques'}`}
        >
          {turno.bloques.length === 0 ? (
            <p className="text-sm text-tinta-suave">Este turno no tiene bloques programados.</p>
          ) : (
            // Lista con líneas divisorias, no cajas: sigue la regla de no usar tarjetas.
            <ul className="divide-y divide-borde">
              {turno.bloques.map((bloque) => {
                const producto = nombreProducto(bloque.productoId)
                return (
                  <li key={bloque.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-tinta">{nombreLinea(bloque.lineaId)}</span>
                      <span className="cifra text-xs text-tinta-suave">
                        {bloque.horaInicio}–{bloque.horaFin}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-tinta">{producto?.descripcion ?? 'PT fuera del catálogo'}</p>
                    <p className="codigo text-xs text-tinta-suave">{producto?.codigo ?? bloque.productoId}</p>
                    <p className="mt-1.5 text-xs text-tinta-suave">
                      <span className="cifra font-semibold text-tinta">{bloque.cajasPorHora}</span> cajas por hora al{' '}
                      {bloque.eficienciaPorcentaje} % de eficiencia ={' '}
                      <span className="cifra font-semibold text-tinta">{miles(bloque.targetCajas)}</span> cajas de meta
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Desplegable>
      </div>
    </article>
  )
}

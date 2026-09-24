import { Badge } from '../../../components/Badge'
import { Dato } from '../../../components/Dato'
import { Desplegable } from '../../../components/Desplegable'
import { BarraProgreso } from '../../../components/graficas/BarraProgreso'
import { Tarjeta } from '../../../components/Tarjeta'
import type { Producto } from '../../../shared/types/catalogo'
import type { ResumenTurno, Semaforo } from '../../../shared/types/mfr'
import { miles, porcentaje, proporcion } from '../../../shared/utils/numeros'

const TONO_SEMAFORO = { VERDE: 'exito', AMARILLO: 'alerta', ROJO: 'critico' } as const

function tonoDe(semaforo: Semaforo | null) {
  return semaforo ? TONO_SEMAFORO[semaforo] : 'neutro'
}

interface Props {
  turno: ResumenTurno
  meta: number
  /** Para poner el nombre del producto donde antes iba solo el código. */
  productos: Producto[] | undefined
  /** Para poner el nombre de la línea donde antes iba su id. */
  lineas: Array<{ lineaId: string; codigo: string; nombre: string }>
}

/**
 * TARJETA DE UN TURNO
 * ===================
 *
 * Antes esta tarjeta apilaba siete capas de información con el mismo
 * peso visual: cumplimiento, cajas, kilos, eficiencia, asistencia por
 * grupo, reparto por línea y los bloques del DPP. Veinte líneas de texto
 * en las que todo parecía igual de importante.
 *
 * Ahora responde en tres niveles:
 *
 *   1. ¿Vamos bien?   → la cifra grande y la barra contra la meta
 *   2. ¿Con qué?      → producción, kilos y personal, en una rejilla
 *   3. ¿Con qué detalle? → plegado: personal por grupo y programación
 *
 * Las siglas del DPP (T, Mx, E) se conservan junto al nombre en
 * español: quien no las conoce lee la palabra, y quien coteja con el
 * documento de PepsiCo encuentra su sigla.
 */
export function TarjetaTurno({ turno, meta, productos, lineas }: Props) {
  const nombreProducto = (id: string) => productos?.find((p) => p.id === id)
  const nombreLinea = (id: string) =>
    lineas.find((l) => l.lineaId === id)?.nombre ?? lineas.find((l) => l.lineaId === id)?.codigo ?? id

  const sinOperar = turno.horasTurno === null
  const avance = proporcion(turno.producidoCajas, turno.targetCajas)

  return (
    <Tarjeta
      titulo={turno.nombre}
      descripcion={
        sinOperar
          ? 'Este turno no opera hoy'
          : `${turno.codigo} · ${turno.horasTurno} horas productivas`
      }
      accion={
        turno.cerrado ? (
          <Badge tono="neutro">Cerrado</Badge>
        ) : (
          <Badge tono="marca" punto>
            Abierto
          </Badge>
        )
      }
    >
      {/* ---------- 1. ¿Vamos bien? ---------- */}
      <div className="flex items-end justify-between gap-3">
        <span className="cifra text-4xl font-bold tracking-tight text-tinta">
          {porcentaje(turno.cumplimiento)}
        </span>
        <Badge tono={tonoDe(turno.semaforo)}>
          {turno.semaforo === null
            ? 'Sin dato'
            : turno.cumplimiento !== null && turno.cumplimiento >= meta
              ? 'Cumple la meta'
              : 'Bajo la meta'}
        </Badge>
      </div>

      <div className="mt-2">
        <BarraProgreso
          valor={avance ?? 0}
          tono={tonoDe(turno.semaforo)}
          titulo={`${turno.nombre}: ${miles(turno.producidoCajas)} de ${miles(turno.targetCajas)} cajas`}
        />
        <p className="mt-1.5 text-xs text-tinta-suave">
          Lo producido frente a la meta del turno. La meta del área es {meta} %.
        </p>
      </div>

      {/* ---------- 2. ¿Con qué? ---------- */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Dato
          etiqueta="Producido"
          valor={miles(turno.producidoCajas)}
          unidad="cajas"
          destacado
          nota="Solo las aprobadas por el OPA"
        />
        <Dato
          etiqueta="Meta del turno"
          sigla="T"
          valor={miles(turno.targetCajas)}
          unidad="cajas"
          destacado
          nota={`Máximo teórico (Mx): ${miles(turno.maxCajas)}`}
        />

        {turno.targetKg > 0 && (
          <Dato
            etiqueta="Peso producido"
            valor={miles(turno.producidoKg)}
            unidad={`de ${miles(turno.targetKg)} kg`}
          />
        )}

        <Dato
          etiqueta="Personal del turno"
          valor={`${turno.personal.llegaron} de ${turno.personal.esperadas}`}
          unidad="personas"
          nota={
            turno.personal.faltante > 0
              ? `Faltaron ${turno.personal.faltante}`
              : 'Llegó todo el personal esperado'
          }
        />
      </dl>

      {/* ---------- 3. El detalle, plegado ---------- */}
      <div className="mt-4">
        <Desplegable
          titulo="Eficiencia del turno"
          resumen={`real ${porcentaje(turno.eficienciaReal)}`}
        >
          <dl className="grid grid-cols-2 gap-4">
            <Dato
              etiqueta="Planeada"
              sigla="T ÷ Mx"
              valor={porcentaje(turno.eficienciaPlaneada)}
              nota="Qué parte del máximo teórico pidió PepsiCo"
            />
            <Dato
              etiqueta="Real"
              valor={porcentaje(turno.eficienciaReal)}
              nota="Qué parte del máximo teórico se alcanzó"
            />
          </dl>
          {turno.personasAsignadas > 0 && (
            <p className="mt-3 text-xs leading-relaxed text-tinta-suave">
              La programación pide <strong>{turno.personasAsignadas} personas</strong> sumando la
              línea ideal de cada bloque. Es lo que el DPP considera necesario, no lo que hay.
            </p>
          )}
        </Desplegable>

        <Desplegable
          titulo="Personal por grupo"
          resumen={`${turno.personal.grupos.length} grupos`}
        >
          <ul className="space-y-1.5">
            {turno.personal.grupos.map((grupo) => {
              const completo = grupo.esperadas !== null && grupo.llegaron >= grupo.esperadas
              return (
                <li key={grupo.grupoId} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${completo ? 'bg-exito' : 'bg-alerta'}`}
                    aria-hidden="true"
                  />
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
              <p className="mt-3 mb-1.5 text-xs font-semibold text-tinta-suave">
                Reparto por línea
              </p>
              <ul className="space-y-1">
                {turno.personal.lineas
                  .filter((l) => l.grupos.length > 0)
                  .map((linea) => (
                    <li key={linea.lineaId} className="text-sm text-tinta-suave">
                      <span className="font-medium text-tinta">{linea.nombre}</span>:{' '}
                      {linea.grupos
                        .map((g) => `${g.nombre} (${g.personas} personas)`)
                        .join(' + ')}
                      {linea.estado === 'INCOMPLETA' && (
                        <span className="text-alerta"> — faltan {linea.faltante}</span>
                      )}
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
            <ul className="space-y-2.5">
              {turno.bloques.map((bloque) => {
                const producto = nombreProducto(bloque.productoId)
                return (
                  <li key={bloque.id} className="rounded-lg border border-borde p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-tinta">
                        {nombreLinea(bloque.lineaId)}
                      </span>
                      <span className="cifra text-xs text-tinta-suave">
                        {bloque.horaInicio}–{bloque.horaFin}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-tinta">
                      {producto?.descripcion ?? 'Producto fuera del catálogo'}
                    </p>
                    <p className="codigo text-xs text-tinta-suave">{producto?.codigo ?? bloque.productoId}</p>
                    <p className="mt-1.5 text-xs text-tinta-suave">
                      <span className="cifra font-semibold text-tinta">{bloque.cajasPorHora}</span>{' '}
                      cajas por hora al {bloque.eficienciaPorcentaje} % de eficiencia ={' '}
                      <span className="cifra font-semibold text-tinta">
                        {miles(bloque.targetCajas)}
                      </span>{' '}
                      cajas de meta
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </Desplegable>
      </div>
    </Tarjeta>
  )
}

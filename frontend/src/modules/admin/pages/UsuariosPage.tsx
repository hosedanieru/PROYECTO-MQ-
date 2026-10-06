/**
 * ADMINISTRACIÓN DE USUARIOS
 * ==========================
 *
 * Lista de personas (filas con iniciales y rol; sin tabla ni tarjeta,
 * usuario 2026-10-05) + diálogo único para crear o editar. Al editar, la contraseña
 * es opcional (solo si se quiere restablecer). No hay "eliminar": se
 * desactiva.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alerta } from '../../../components/Alerta'
import { Badge } from '../../../components/Badge'
import { Boton } from '../../../components/Boton'
import { Iniciales } from '../../../components/Iniciales'
import { FilaRegistro, ListaRegistros, MetaDato } from '../../../components/ListaRegistros'
import { Seccion } from '../../../components/Seccion'
import { EncabezadoPagina } from '../../../components/EncabezadoPagina'
import { IconoUsuario } from '../../../components/Iconos'
import { Campo } from '../../../components/Campo'
import { Dialogo } from '../../../components/Dialogo'
import { Select } from '../../../components/Select'
import { comoErrorApi } from '../../../services/http'
import type { PerfilUsuario } from '../../../shared/types/api'
import { useSesion } from '../../auth/useSesion'
import { useRoles } from '../../catalogo/hooks/useCatalogos'
import { usuariosApi } from '../api/usuarios.api'

const esquema = z.object({
  documento: z.string().regex(/^[A-Za-z0-9-]{4,20}$/, 'Entre 4 y 20 caracteres alfanuméricos.'),
  nombre: z.string().trim().min(3, 'Mínimo 3 caracteres.').max(120),
  email: z.string().trim().email('Correo no válido.').or(z.literal('')),
  rolId: z.string().min(1, 'Seleccione el rol.'),
  contrasena: z.string().min(8, 'Mínimo 8 caracteres.').max(72).or(z.literal('')),
})
type Formulario = z.infer<typeof esquema>

export function UsuariosPage() {
  const qc = useQueryClient()
  const { usuario: actual } = useSesion()
  const usuarios = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosApi.listar,
  })
  const roles = useRoles()
  const [editando, setEditando] = useState<PerfilUsuario | 'nuevo' | null>(null)
  const inactivos = (usuarios.data ?? []).filter((u) => !u.activo).length

  const form = useForm<Formulario>({ resolver: zodResolver(esquema) })
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    if (editando === 'nuevo') {
      reset({
        documento: '',
        nombre: '',
        email: '',
        rolId: '',
        contrasena: '',
      })
    } else if (editando) {
      reset({
        documento: editando.documento,
        nombre: editando.nombre,
        email: editando.email ?? '',
        rolId: editando.rolId,
        contrasena: '',
      })
    }
  }, [editando, reset])

  const guardar = useMutation({
    mutationFn: (datos: Formulario) => {
      if (editando === 'nuevo') {
        if (!datos.contrasena)
          throw {
            estado: 400,
            codigo: 'FORM',
            mensaje: 'La contraseña es obligatoria al crear.',
          }
        return usuariosApi.crear({
          documento: datos.documento,
          nombre: datos.nombre,
          email: datos.email || undefined,
          contrasena: datos.contrasena,
          rolId: datos.rolId,
        })
      }
      return usuariosApi.actualizar(editando!.id, {
        nombre: datos.nombre,
        email: datos.email || null,
        rolId: datos.rolId,
        contrasena: datos.contrasena || undefined,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['usuarios'] })
      setEditando(null)
    },
  })

  const cambiarActivo = useMutation({
    mutationFn: (u: PerfilUsuario) => usuariosApi.actualizar(u.id, { activo: !u.activo }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  return (
    <section className="space-y-4">
      <EncabezadoPagina
        Icono={IconoUsuario}
        escena="personas"
        titulo="Usuarios"
        descripcion="Quién entra al aplicativo y con qué rol. Un usuario no se borra: se desactiva."
        acciones={
          <Boton variante="claro" onClick={() => setEditando('nuevo')}>
            + Nuevo usuario
          </Boton>
        }
      />

      {usuarios.isError && <Alerta tipo="error">{comoErrorApi(usuarios.error).mensaje}</Alerta>}
      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      <Seccion
        titulo="Personas con acceso"
        contador={usuarios.data?.length}
        accion={inactivos > 0 && <Badge tono="neutro">{inactivos} inactivos</Badge>}
      >
        <ListaRegistros cargando={usuarios.isLoading}>
          {usuarios.data?.map((u) => (
            <FilaRegistro
              key={u.id}
              tono={u.activo ? 'marca' : undefined}
              apagada={!u.activo}
              etiqueta={
                <>
                  <Iniciales nombre={u.nombre} activo={u.activo} />
                  <Badge tono="acento">{u.rolCodigo}</Badge>
                  {!u.activo && <Badge tono="neutro">Inactivo</Badge>}
                  {u.id === actual?.id && <Badge tono="exito">Usted</Badge>}
                </>
              }
              titulo={u.nombre}
              meta={
                <>
                  <MetaDato etiqueta="Documento">{u.documento}</MetaDato>
                  <MetaDato etiqueta="Correo">{u.email ?? '—'}</MetaDato>
                </>
              }
              acciones={
                <>
                  <Boton variante="secundario" tamano="sm" onClick={() => setEditando(u)}>
                    Editar
                  </Boton>
                  {u.id !== actual?.id && (
                    <Boton variante="sutil" tamano="sm" onClick={() => cambiarActivo.mutate(u)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </Boton>
                  )}
                </>
              }
            />
          ))}
        </ListaRegistros>
      </Seccion>

      <Dialogo
        abierto={editando !== null}
        titulo={editando === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}
        onCerrar={() => setEditando(null)}
      >
        <form
          onSubmit={(e) => void handleSubmit((d) => guardar.mutate(d))(e)}
          noValidate
          className="space-y-4"
        >
          <Campo
            etiqueta="Documento"
            error={errors.documento?.message}
            disabled={editando !== 'nuevo'}
            {...register('documento')}
          />
          <Campo etiqueta="Nombre" error={errors.nombre?.message} {...register('nombre')} />
          <Campo
            etiqueta="Correo (opcional)"
            type="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <Select etiqueta="Rol" error={errors.rolId?.message} {...register('rolId')}>
            <option value="">Seleccione…</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </Select>
          <Campo
            etiqueta={editando === 'nuevo' ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)'}
            type="password"
            autoComplete="new-password"
            error={errors.contrasena?.message}
            {...register('contrasena')}
          />
          {guardar.isError && <Alerta tipo="error">{comoErrorApi(guardar.error).mensaje}</Alerta>}
          <div className="flex justify-end gap-2">
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardar.isPending}>
              Guardar
            </Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}

/**
 * ADMINISTRACIÓN DE USUARIOS
 * ==========================
 *
 * Tabla + diálogo único para crear o editar. Al editar, la contraseña
 * es opcional (solo si se quiere restablecer). No hay "eliminar": se
 * desactiva.
 */

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Alerta } from '../../../components/Alerta'
import { Boton } from '../../../components/Boton'
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
  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: usuariosApi.listar })
  const roles = useRoles()
  const [editando, setEditando] = useState<PerfilUsuario | 'nuevo' | null>(null)

  const form = useForm<Formulario>({ resolver: zodResolver(esquema) })
  const { register, handleSubmit, reset, formState: { errors } } = form

  useEffect(() => {
    if (editando === 'nuevo') {
      reset({ documento: '', nombre: '', email: '', rolId: '', contrasena: '' })
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
        if (!datos.contrasena) throw { estado: 400, codigo: 'FORM', mensaje: 'La contraseña es obligatoria al crear.' }
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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-tinta">Usuarios</h1>
        <Boton onClick={() => setEditando('nuevo')}>Nuevo usuario</Boton>
      </header>

      {usuarios.isError && <Alerta tipo="error">{comoErrorApi(usuarios.error).mensaje}</Alerta>}
      {cambiarActivo.isError && <Alerta tipo="error">{comoErrorApi(cambiarActivo.error).mensaje}</Alerta>}

      <div className="overflow-x-auto rounded-lg bg-base shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-velo text-left text-xs uppercase text-tinta-suave">
            <tr>
              <th className="px-4 py-2">Documento</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Correo</th>
              <th className="px-4 py-2">Rol</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {usuarios.data?.map((u) => (
              <tr key={u.id} className={u.activo ? '' : 'text-tinta-suave'}>
                <td className="px-4 py-2 cifra">{u.documento}</td>
                <td className="px-4 py-2">{u.nombre}</td>
                <td className="px-4 py-2">{u.email ?? '—'}</td>
                <td className="px-4 py-2">{u.rolCodigo}</td>
                <td className="px-4 py-2">{u.activo ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button className="text-marca hover:underline" onClick={() => setEditando(u)}>
                    Editar
                  </button>
                  {u.id !== actual?.id && (
                    <button
                      className="ml-3 text-tinta-suave hover:underline"
                      onClick={() => cambiarActivo.mutate(u)}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialogo
        abierto={editando !== null}
        titulo={editando === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'}
        onCerrar={() => setEditando(null)}
      >
        <form onSubmit={(e) => void handleSubmit((d) => guardar.mutate(d))(e)} noValidate className="space-y-4">
          <Campo
            etiqueta="Documento"
            error={errors.documento?.message}
            disabled={editando !== 'nuevo'}
            {...register('documento')}
          />
          <Campo etiqueta="Nombre" error={errors.nombre?.message} {...register('nombre')} />
          <Campo etiqueta="Correo (opcional)" type="email" error={errors.email?.message} {...register('email')} />
          <Select etiqueta="Rol" error={errors.rolId?.message} {...register('rolId')}>
            <option value="">Seleccione…</option>
            {roles.data?.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
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
            <Boton type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
            <Boton type="submit" cargando={guardar.isPending}>Guardar</Boton>
          </div>
        </form>
      </Dialogo>
    </section>
  )
}

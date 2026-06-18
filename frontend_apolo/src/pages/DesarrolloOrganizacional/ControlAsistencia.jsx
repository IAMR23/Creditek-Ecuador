import { Fragment, useEffect, useMemo, useState } from "react"
import Swal from "sweetalert2"
import { api } from "../../api/client"

const ESTADOS = {
  asistencia: {
    label: "",
    nombre: "Asistencia",
    className: "bg-green-400 text-black",
  },
  falta_justificada: {
    label: "FJ",
    nombre: "Falta justificada",
    className: "bg-blue-500 text-white",
  },
  falta_injustificada: {
    label: "FI",
    nombre: "Falta injustificada",
    className: "bg-red-500 text-white",
  },
  atraso: {
    label: "AT",
    nombre: "Atraso",
    className: "bg-yellow-400 text-black",
  },
  salida: {
    label: "S",
    nombre: "Salida",
    className: "bg-purple-500 text-white",
  },
  pago: {
    label: "P",
    nombre: "Pago",
    className: "bg-cyan-500 text-black",
  },
  capacitacion: {
    label: "C",
    nombre: "Capacitacion",
    className: "bg-sky-300 text-black",
  },
  libre: {
    label: "",
    nombre: "Libre",
    className: "bg-white text-black",
  },
}

const DIAS = ["D", "L", "M", "M", "J", "V", "S"]

const getTodayMonth = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
}

const getTodayDateISO = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`
}

const getFechasDelMes = (mes) => {
  const [year, month] = mes.split("-").map(Number)
  const totalDias = new Date(year, month, 0).getDate()

  return Array.from({ length: totalDias }, (_, index) => {
    const dia = index + 1
    const fecha = new Date(year, month - 1, dia)
    const fechaISO = `${year}-${String(month).padStart(2, "0")}-${String(dia).padStart(2, "0")}`

    return {
      fecha: fechaISO,
      dia,
      label: `${DIAS[fecha.getDay()]}${dia}`,
    }
  })
}

const normalizarRegistro = (registro) => {
  if (!registro) {
    return { estado: "libre", observacion: "" }
  }

  if (typeof registro === "string") {
    return { estado: registro, observacion: "" }
  }

  return {
    estado: registro.estado || "libre",
    observacion: registro.observacion || "",
  }
}

const formatearFecha = (fecha) => {
  const [year, month, day] = fecha.split("-").map(Number)
  return new Date(year, month - 1, day).toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

const escapeHtml = (value = "") =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")

const ESTADO_OPTIONS_HTML = `
  <option value="asistencia">Asistencia</option>
  <option value="falta_justificada">Falta justificada</option>
  <option value="falta_injustificada">Falta injustificada</option>
  <option value="atraso">Atraso</option>
  <option value="salida">Salida</option>
  <option value="pago">Pago</option>
  <option value="capacitacion">Capacitacion</option>
  <option value="libre">Libre / Sin registro</option>
`

export default function ControlAsistencia() {
  const [mes, setMes] = useState(getTodayMonth())
  const [agenciaId, setAgenciaId] = useState("")
  const [loading, setLoading] = useState(false)
  const [agencias, setAgencias] = useState([])
  const [search, setSearch] = useState("")

  const fechas = useMemo(() => getFechasDelMes(mes), [mes])
  const todayDate = getTodayDateISO()

  const cargarAsistencia = async () => {
    setLoading(true)

    try {
      const res = await api.get("/asistencias/agencias", {
        params: {
          mes,
          agenciaId: agenciaId || undefined,
        },
      })

      setAgencias(res.data || [])
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo cargar la asistencia",
        "error"
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargarAsistencia()
  }, [mes, agenciaId])

  const guardarAsistencia = async ({
    agenciaId: agenciaActualId,
    usuarioAgenciaId,
    fecha,
    estado,
    observacion,
  }) => {
    try {
      setAgencias((current) =>
        current.map((agencia) => {
          if (agencia.id !== agenciaActualId) return agencia

          return {
            ...agencia,
            usuarios: (agencia.usuarios || []).map((usuario) => {
              if (usuario.usuarioAgenciaId !== usuarioAgenciaId) return usuario

              const asistencias = { ...(usuario.asistencias || {}) }
              const observacionNormalizada = observacion?.trim() || ""

              if ((!estado || estado === "libre") && !observacionNormalizada) {
                delete asistencias[fecha]
              } else {
                asistencias[fecha] = {
                  estado: estado || "libre",
                  observacion: observacionNormalizada,
                }
              }

              return { ...usuario, asistencias }
            }),
          }
        })
      )

      await api.post("/asistencias", {
        agenciaId: agenciaActualId,
        usuarioAgenciaId,
        fecha,
        estado,
        observacion,
      })
    } catch (err) {
      await cargarAsistencia()
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo guardar la asistencia",
        "error"
      )
    }
  }

  const guardarAsistenciaMasiva = async ({
    agenciaActual,
    usuarios,
  }) => {
    const fechaMin = fechas[0]?.fecha
    const fechaMax = fechas[fechas.length - 1]?.fecha

    if (!fechaMin || !fechaMax || !usuarios.length) return

    const modalId = `observacion-masiva-${agenciaActual.id}`

    const { isConfirmed, value } = await Swal.fire({
      title: "Registrar asistencia masiva",
      html: `
        <div class="space-y-3 text-left">
          <div class="text-sm text-slate-600">
            <strong>${escapeHtml(agenciaActual.nombre)}</strong><br />
            Se aplicará a ${usuarios.length} usuario(s) visibles.
          </div>
          <div>
            <label for="swal-estado-masivo" class="mb-1 block text-sm font-medium text-slate-700">
              Estado
            </label>
            <select id="swal-estado-masivo" class="swal2-select !grid !w-full !m-0">
              ${ESTADO_OPTIONS_HTML}
            </select>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label for="swal-fecha-inicio" class="mb-1 block text-sm font-medium text-slate-700">
                Desde
              </label>
              <input id="swal-fecha-inicio" type="date" class="swal2-input !grid !w-full !m-0" min="${fechaMin}" max="${fechaMax}" value="${fechaMin}" />
            </div>
            <div>
              <label for="swal-fecha-fin" class="mb-1 block text-sm font-medium text-slate-700">
                Hasta
              </label>
              <input id="swal-fecha-fin" type="date" class="swal2-input !grid !w-full !m-0" min="${fechaMin}" max="${fechaMax}" value="${fechaMax}" />
            </div>
          </div>
          <div>
            <label for="${modalId}" class="mb-1 block text-sm font-medium text-slate-700">
              Observacion
            </label>
            <textarea
              id="${modalId}"
              class="swal2-textarea !grid !w-full !m-0 !h-28"
              placeholder="Opcional. Se guardará la misma observacion para todos"
            ></textarea>
          </div>
        </div>
      `,
      didOpen: () => {
        const estadoInput = document.getElementById("swal-estado-masivo")
        if (estadoInput) estadoInput.value = "asistencia"
      },
      preConfirm: () => {
        const estadoInput = document.getElementById("swal-estado-masivo")
        const fechaInicioInput = document.getElementById("swal-fecha-inicio")
        const fechaFinInput = document.getElementById("swal-fecha-fin")
        const observacionInput = document.getElementById(modalId)

        const fechaInicio = fechaInicioInput?.value || ""
        const fechaFin = fechaFinInput?.value || ""

        if (!fechaInicio || !fechaFin) {
          Swal.showValidationMessage("Debes seleccionar el rango de fechas.")
          return false
        }

        if (fechaInicio > fechaFin) {
          Swal.showValidationMessage("La fecha inicial no puede ser mayor que la final.")
          return false
        }

        return {
          estado: estadoInput?.value || "asistencia",
          fechaInicio,
          fechaFin,
          observacion: observacionInput?.value || "",
        }
      },
      showCancelButton: true,
      confirmButtonText: "Aplicar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      width: 620,
    })

    if (!isConfirmed) return

    try {
      setLoading(true)
      await api.post("/asistencias/masivo", {
        agenciaId: agenciaActual.id,
        usuarioAgenciaIds: usuarios.map((usuario) => usuario.usuarioAgenciaId),
        fechaInicio: value.fechaInicio,
        fechaFin: value.fechaFin,
        estado: value.estado,
        observacion: value.observacion,
      })

      await cargarAsistencia()

      Swal.fire({
        icon: "success",
        title: "Asistencia masiva registrada",
        text: `Se actualizó ${usuarios.length} usuario(s) en ${agenciaActual.nombre}.`,
        timer: 1800,
        showConfirmButton: false,
      })
    } catch (err) {
      Swal.fire(
        "Error",
        err.response?.data?.message || "No se pudo guardar la asistencia masiva",
        "error"
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCambiarEstado = async ({
    agenciaId: agenciaActualId,
    usuarioAgenciaId,
    fecha,
    estadoActual,
    observacionActual,
    usuarioNombre,
  }) => {
    const modalId = `observacion-${usuarioAgenciaId}-${fecha}`

    const { isConfirmed, value } = await Swal.fire({
      title: "Registrar asistencia",
      html: `
        <div class="text-left space-y-3">
          <div class="text-sm text-slate-600">
            <strong>${escapeHtml(usuarioNombre)}</strong><br />
            ${escapeHtml(formatearFecha(fecha))}
          </div>
          <div>
            <label for="swal-estado" class="block text-sm font-medium text-slate-700 mb-1">
              Estado
            </label>
            <select id="swal-estado" class="swal2-select !grid !w-full !m-0">
              <option value="asistencia">Asistencia</option>
              <option value="falta_justificada">Falta justificada</option>
              <option value="falta_injustificada">Falta injustificada</option>
              <option value="atraso">Atraso</option>
              <option value="salida">Salida</option>
              <option value="pago">Pago</option>
              <option value="capacitacion">Capacitacion</option>
              <option value="libre">Libre / Sin registro</option>
            </select>
          </div>
          <div>
            <label for="${modalId}" class="block text-sm font-medium text-slate-700 mb-1">
              Observacion
            </label>
            <textarea
              id="${modalId}"
              class="swal2-textarea !grid !w-full !m-0 !h-28"
              placeholder="Escribe una observacion para este dia"
            >${escapeHtml(observacionActual || "")}</textarea>
          </div>
        </div>
      `,
      didOpen: () => {
        const estadoInput = document.getElementById("swal-estado")
        const observacionInput = document.getElementById(modalId)

        if (estadoInput) estadoInput.value = estadoActual || "asistencia"
        if (observacionInput) observacionInput.focus()
      },
      preConfirm: () => {
        const estadoInput = document.getElementById("swal-estado")
        const observacionInput = document.getElementById(modalId)

        return {
          estado: estadoInput?.value || "libre",
          observacion: observacionInput?.value || "",
        }
      },
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      width: 560,
    })

    if (!isConfirmed) return

    await guardarAsistencia({
      agenciaId: agenciaActualId,
      usuarioAgenciaId,
      fecha,
      estado: value?.estado || "libre",
      observacion: value?.observacion || "",
    })
  }

  const agenciasFiltradas = useMemo(() => {
    return agencias
      .map((agencia) => ({
        ...agencia,
        usuarios: (agencia.usuarios || []).filter((usuario) =>
          `${usuario.nombre || ""} ${usuario.apellido || ""}`
            .toLowerCase()
            .includes(search.toLowerCase())
        ),
      }))
      .filter((agencia) => agencia.usuarios.length > 0)
  }, [agencias, search])

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-black px-4 py-3 text-white">
          <h2 className="text-xl font-extrabold uppercase tracking-wide">
            Registro de terminales, planificacion semanal de agencias
          </h2>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <select
              value={agenciaId}
              onChange={(e) => setAgenciaId(e.target.value)}
              className="rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Todas las agencias</option>
              {agencias.map((agencia) => (
                <option key={agencia.id} value={agencia.id}>
                  {agencia.nombre}
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar usuario..."
              className="rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            onClick={cargarAsistencia}
            className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 font-semibold text-white shadow"
          >
            Actualizar
          </button>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-max w-full border-collapse text-xs leading-tight">
            <thead className="sticky top-0 z-20">
              <tr className="bg-yellow-300 text-black">
                <th className="sticky left-0 z-30 min-w-[180px] border border-black bg-yellow-300 px-2 py-1 text-left">
                  Usuario
                </th>

                {fechas.map((item) => (
                  <th
                    key={item.fecha}
                    className={`min-w-[34px] border border-black px-1 py-1 text-center ${
                      item.fecha === todayDate ? "bg-orange-300 text-black" : ""
                    }`}
                  >
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={fechas.length + 1}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Cargando asistencia...
                  </td>
                </tr>
              ) : agenciasFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={fechas.length + 1}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No hay datos de asistencia
                  </td>
                </tr>
              ) : (
                agenciasFiltradas.map((agencia) => (
                  <Fragment key={`agencia-${agencia.id}`}>
                    <tr className="bg-yellow-400">
                      <td
                        colSpan={fechas.length + 1}
                        className="border border-black px-2 py-1 font-bold uppercase"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span>{agencia.nombre}</span>
                          <button
                            type="button"
                            onClick={() =>
                              guardarAsistenciaMasiva({
                                agenciaActual: agencia,
                                usuarios: agencia.usuarios || [],
                              })
                            }
                            className="rounded bg-black px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
                          >
                            Carga masiva
                          </button>
                        </div>
                      </td>
                    </tr>

                    {agencia.usuarios.map((usuario) => {
                      const nombreCompleto = `${usuario.nombre || ""} ${
                        usuario.apellido || ""
                      }`.trim()

                      return (
                        <tr
                          key={usuario.usuarioAgenciaId}
                          className="hover:bg-gray-50"
                        >
                          <td className="sticky left-0 z-10 max-w-[180px] min-w-[180px] truncate border border-black bg-white px-2 py-1 font-medium uppercase">
                            {nombreCompleto}
                          </td>

                          {fechas.map((item) => {
                            const registro = normalizarRegistro(
                              usuario.asistencias?.[item.fecha]
                            )
                            const estado = registro.estado || "libre"
                            const tieneObservacion = Boolean(
                              registro.observacion?.trim()
                            )
                            const titulo = tieneObservacion
                              ? `${ESTADOS[estado]?.nombre || "Libre"}\nObservacion: ${
                                  registro.observacion
                                }`
                              : ESTADOS[estado]?.nombre

                            return (
                              <td
                                key={`${usuario.usuarioAgenciaId}-${item.fecha}`}
                                onClick={() =>
                                  handleCambiarEstado({
                                    agenciaId: agencia.id,
                                    usuarioAgenciaId:
                                      usuario.usuarioAgenciaId,
                                    fecha: item.fecha,
                                    estadoActual: estado,
                                    observacionActual: registro.observacion,
                                    usuarioNombre: nombreCompleto,
                                  })
                                }
                                title={titulo}
                                className={`relative h-6 min-w-[34px] cursor-pointer border border-black text-center font-bold ${
                                  ESTADOS[estado]?.className ||
                                  "bg-green-400 text-black"
                                } ${item.fecha === todayDate ? "ring-2 ring-inset ring-orange-500" : ""}`}
                              >
                                {tieneObservacion ? (
                                  <span className="absolute right-0 top-0 h-0 w-0 border-l-[10px] border-l-transparent border-t-[10px] border-t-red-600" />
                                ) : null}
                                {ESTADOS[estado]?.label || ""}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 border-t bg-gray-50 p-3 text-xs">
          {Object.entries(ESTADOS).map(([key, item]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`inline-flex h-5 w-7 items-center justify-center border font-bold ${item.className}`}
              >
                {item.label || "-"}
              </span>
              <span>{item.nombre}</span>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-5 w-7 items-center justify-center border bg-white font-bold">
              -
              <span className="absolute right-0 top-0 h-0 w-0 border-l-[10px] border-l-transparent border-t-[10px] border-t-red-600" />
            </span>
            <span>Observacion registrada</span>
          </div>
        </div>
      </div>
    </div>
  )
}

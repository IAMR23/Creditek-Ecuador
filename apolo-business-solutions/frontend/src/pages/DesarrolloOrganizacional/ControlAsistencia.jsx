import { useEffect, useMemo, useState } from "react"
import Swal from "sweetalert2"
import { api } from "../../api/client"

export const asistenciasMock = [
  {
    id: 1,
    nombre: "NUEVA AURORA",
    usuarios: [
      {
        usuarioAgenciaId: 101,
        usuarioId: 1,
        nombre: "FERNANDO",
        apellido: "SOTO",
        cargo: "Vendedor",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "asistencia",
          "2026-05-05": "asistencia",
          "2026-05-06": "atraso",
          "2026-05-07": "asistencia",
          "2026-05-08": "asistencia",
          "2026-05-09": "libre",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "falta_justificada",
          "2026-05-14": "asistencia",
          "2026-05-15": "asistencia",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "asistencia",
          "2026-05-19": "atraso",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "libre",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "salida",
          "2026-05-28": "asistencia",
          "2026-05-29": "asistencia",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
      {
        usuarioAgenciaId: 102,
        usuarioId: 2,
        nombre: "WENDY",
        apellido: "MITE",
        cargo: "Vendedora",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "libre",
          "2026-05-03": "libre",
          "2026-05-04": "asistencia",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "atraso",
          "2026-05-08": "asistencia",
          "2026-05-09": "asistencia",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "falta_injustificada",
          "2026-05-13": "asistencia",
          "2026-05-14": "asistencia",
          "2026-05-15": "asistencia",
          "2026-05-16": "libre",
          "2026-05-17": "libre",
          "2026-05-18": "asistencia",
          "2026-05-19": "asistencia",
          "2026-05-20": "salida",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "libre",
          "2026-05-26": "asistencia",
          "2026-05-27": "asistencia",
          "2026-05-28": "falta_justificada",
          "2026-05-29": "asistencia",
          "2026-05-30": "asistencia",
          "2026-05-31": "libre",
        },
      },
      {
        usuarioAgenciaId: 103,
        usuarioId: 3,
        nombre: "RAUL",
        apellido: "HERNANDEZ",
        cargo: "Vendedor",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "libre",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "asistencia",
          "2026-05-08": "atraso",
          "2026-05-09": "asistencia",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "asistencia",
          "2026-05-14": "falta_justificada",
          "2026-05-15": "asistencia",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "libre",
          "2026-05-19": "asistencia",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "salida",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "asistencia",
          "2026-05-28": "asistencia",
          "2026-05-29": "falta_injustificada",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
    ],
  },
  {
    id: 2,
    nombre: "CAUPICHO",
    usuarios: [
      {
        usuarioAgenciaId: 201,
        usuarioId: 4,
        nombre: "DAMARIS",
        apellido: "MUÑOZ",
        cargo: "Vendedora",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "asistencia",
          "2026-05-05": "falta_justificada",
          "2026-05-06": "asistencia",
          "2026-05-07": "asistencia",
          "2026-05-08": "asistencia",
          "2026-05-09": "libre",
          "2026-05-10": "libre",
          "2026-05-11": "atraso",
          "2026-05-12": "asistencia",
          "2026-05-13": "asistencia",
          "2026-05-14": "asistencia",
          "2026-05-15": "asistencia",
          "2026-05-16": "salida",
          "2026-05-17": "libre",
          "2026-05-18": "asistencia",
          "2026-05-19": "asistencia",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "falta_injustificada",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "libre",
          "2026-05-26": "asistencia",
          "2026-05-27": "asistencia",
          "2026-05-28": "asistencia",
          "2026-05-29": "atraso",
          "2026-05-30": "asistencia",
          "2026-05-31": "libre",
        },
      },
      {
        usuarioAgenciaId: 202,
        usuarioId: 5,
        nombre: "ELY",
        apellido: "ORTEGA",
        cargo: "Vendedora",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "falta_justificada",
          "2026-05-03": "libre",
          "2026-05-04": "libre",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "asistencia",
          "2026-05-08": "asistencia",
          "2026-05-09": "asistencia",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "salida",
          "2026-05-14": "asistencia",
          "2026-05-15": "asistencia",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "libre",
          "2026-05-19": "atraso",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "falta_injustificada",
          "2026-05-28": "asistencia",
          "2026-05-29": "asistencia",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
      {
        usuarioAgenciaId: 203,
        usuarioId: 6,
        nombre: "JAVIER",
        apellido: "COACANGO",
        cargo: "Vendedor",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "asistencia",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "falta_justificada",
          "2026-05-08": "asistencia",
          "2026-05-09": "libre",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "asistencia",
          "2026-05-14": "atraso",
          "2026-05-15": "asistencia",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "salida",
          "2026-05-19": "asistencia",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "libre",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "falta_injustificada",
          "2026-05-27": "asistencia",
          "2026-05-28": "asistencia",
          "2026-05-29": "asistencia",
          "2026-05-30": "asistencia",
          "2026-05-31": "libre",
        },
      },
    ],
  },
  {
    id: 3,
    nombre: "SANGOLQUÍ PISO",
    usuarios: [
      {
        usuarioAgenciaId: 301,
        usuarioId: 7,
        nombre: "MATEO",
        apellido: "HOYOS",
        cargo: "Vendedor",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "libre",
          "2026-05-05": "asistencia",
          "2026-05-06": "atraso",
          "2026-05-07": "asistencia",
          "2026-05-08": "asistencia",
          "2026-05-09": "asistencia",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "falta_justificada",
          "2026-05-14": "asistencia",
          "2026-05-15": "asistencia",
          "2026-05-16": "libre",
          "2026-05-17": "libre",
          "2026-05-18": "asistencia",
          "2026-05-19": "asistencia",
          "2026-05-20": "asistencia",
          "2026-05-21": "salida",
          "2026-05-22": "asistencia",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "asistencia",
          "2026-05-28": "falta_injustificada",
          "2026-05-29": "asistencia",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
      {
        usuarioAgenciaId: 302,
        usuarioId: 8,
        nombre: "JORDY",
        apellido: "",
        cargo: "Vendedor",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "libre",
          "2026-05-03": "libre",
          "2026-05-04": "asistencia",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "asistencia",
          "2026-05-08": "asistencia",
          "2026-05-09": "atraso",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "falta_injustificada",
          "2026-05-13": "asistencia",
          "2026-05-14": "asistencia",
          "2026-05-15": "salida",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "libre",
          "2026-05-19": "asistencia",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "falta_justificada",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "asistencia",
          "2026-05-28": "asistencia",
          "2026-05-29": "atraso",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
    ],
  },
  {
    id: 4,
    nombre: "LOGÍSTICA",
    usuarios: [
      {
        usuarioAgenciaId: 401,
        usuarioId: 9,
        nombre: "ALEXIS",
        apellido: "VITERI",
        cargo: "Logística",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "asistencia",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "asistencia",
          "2026-05-08": "falta_justificada",
          "2026-05-09": "asistencia",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "asistencia",
          "2026-05-14": "salida",
          "2026-05-15": "asistencia",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "libre",
          "2026-05-19": "asistencia",
          "2026-05-20": "atraso",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "falta_injustificada",
          "2026-05-28": "asistencia",
          "2026-05-29": "asistencia",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
      {
        usuarioAgenciaId: 402,
        usuarioId: 10,
        nombre: "BRYAN",
        apellido: "CUMBICOS",
        cargo: "Logística",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "libre",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "atraso",
          "2026-05-08": "asistencia",
          "2026-05-09": "asistencia",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "asistencia",
          "2026-05-14": "asistencia",
          "2026-05-15": "falta_justificada",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "salida",
          "2026-05-19": "asistencia",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "libre",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "asistencia",
          "2026-05-28": "atraso",
          "2026-05-29": "asistencia",
          "2026-05-30": "falta_injustificada",
          "2026-05-31": "libre",
        },
      },
      {
        usuarioAgenciaId: 403,
        usuarioId: 11,
        nombre: "PAUL",
        apellido: "VERA",
        cargo: "Logística",
        asistencias: {
          "2026-05-01": "libre",
          "2026-05-02": "asistencia",
          "2026-05-03": "asistencia",
          "2026-05-04": "asistencia",
          "2026-05-05": "asistencia",
          "2026-05-06": "falta_justificada",
          "2026-05-07": "asistencia",
          "2026-05-08": "asistencia",
          "2026-05-09": "libre",
          "2026-05-10": "libre",
          "2026-05-11": "asistencia",
          "2026-05-12": "asistencia",
          "2026-05-13": "salida",
          "2026-05-14": "asistencia",
          "2026-05-15": "asistencia",
          "2026-05-16": "asistencia",
          "2026-05-17": "libre",
          "2026-05-18": "libre",
          "2026-05-19": "falta_injustificada",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "asistencia",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "atraso",
          "2026-05-27": "asistencia",
          "2026-05-28": "asistencia",
          "2026-05-29": "asistencia",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
    ],
  },
  {
    id: 5,
    nombre: "MARKETING",
    usuarios: [
      {
        usuarioAgenciaId: 501,
        usuarioId: 12,
        nombre: "ANDRES",
        apellido: "SALAS",
        cargo: "Marketing",
        asistencias: {
          "2026-05-01": "asistencia",
          "2026-05-02": "asistencia",
          "2026-05-03": "libre",
          "2026-05-04": "asistencia",
          "2026-05-05": "asistencia",
          "2026-05-06": "asistencia",
          "2026-05-07": "asistencia",
          "2026-05-08": "atraso",
          "2026-05-09": "libre",
          "2026-05-10": "libre",
          "2026-05-11": "salida",
          "2026-05-12": "asistencia",
          "2026-05-13": "asistencia",
          "2026-05-14": "asistencia",
          "2026-05-15": "asistencia",
          "2026-05-16": "falta_justificada",
          "2026-05-17": "libre",
          "2026-05-18": "libre",
          "2026-05-19": "asistencia",
          "2026-05-20": "asistencia",
          "2026-05-21": "asistencia",
          "2026-05-22": "asistencia",
          "2026-05-23": "falta_injustificada",
          "2026-05-24": "libre",
          "2026-05-25": "asistencia",
          "2026-05-26": "asistencia",
          "2026-05-27": "asistencia",
          "2026-05-28": "asistencia",
          "2026-05-29": "asistencia",
          "2026-05-30": "libre",
          "2026-05-31": "libre",
        },
      },
    ],
  },
]
 

const ESTADOS = {
  asistencia: {
    label: "A",
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

const calcularResumen = (asistencias = {}) => {
  const resumen = {
    asistencias: 0,
    faltasJustificadas: 0,
    faltasInjustificadas: 0,
    atrasos: 0,
    salidas: 0,
  }

  Object.values(asistencias).forEach((estado) => {
    if (estado === "asistencia") resumen.asistencias += 1
    if (estado === "falta_justificada") resumen.faltasJustificadas += 1
    if (estado === "falta_injustificada") resumen.faltasInjustificadas += 1
    if (estado === "atraso") resumen.atrasos += 1
    if (estado === "salida") resumen.salidas += 1
  })

  return resumen
}

export default function ControlAsistencia() {
  const [mes, setMes] = useState(getTodayMonth())
  const [agenciaId, setAgenciaId] = useState("")
  const [loading, setLoading] = useState(false)
  const [agencias, setAgencias] = useState([])
  const [search, setSearch] = useState("")

  const fechas = useMemo(() => getFechasDelMes(mes), [mes])

const cargarAsistencia = async () => {
  setLoading(true)

  try {
    // MOCK TEMPORAL
    // Cuando ya esté el backend, eliminas esta parte y dejas el axios.
    let data = asistenciasMock

    if (agenciaId) {
      data = data.filter((agencia) => String(agencia.id) === String(agenciaId))
    }

    setAgencias(data)

    /*
    // BACKEND REAL DESPUÉS
    const res = await axios.get(`${API_URL}/asistencias/agencias`, {
      params: {
        mes,
        agenciaId: agenciaId || undefined,
      },
    })

    setAgencias(res.data || [])
    */
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
  agenciaId,
  usuarioAgenciaId,
  fecha,
  estado,
}) => {
  try {
    // MOCK TEMPORAL
    setAgencias((prev) =>
      prev.map((agencia) => {
        if (agencia.id !== agenciaId) return agencia

        return {
          ...agencia,
          usuarios: agencia.usuarios.map((usuario) => {
            if (usuario.usuarioAgenciaId !== usuarioAgenciaId) return usuario

            return {
              ...usuario,
              asistencias: {
                ...(usuario.asistencias || {}),
                [fecha]: estado,
              },
            }
          }),
        }
      })
    )

    /*
    // BACKEND REAL DESPUÉS
    await axios.post(`${API_URL}/asistencias`, {
      agenciaId,
      usuarioAgenciaId,
      fecha,
      estado,
    })
    */
  } catch (err) {
    Swal.fire(
      "Error",
      err.response?.data?.message || "No se pudo guardar la asistencia",
      "error"
    )
  }
}

  const handleCambiarEstado = async ({
    agenciaId,
    usuarioAgenciaId,
    fecha,
    estadoActual,
  }) => {
    const { value: estado } = await Swal.fire({
      title: "Registrar asistencia",
      input: "select",
      inputValue: estadoActual || "asistencia",
      inputOptions: {
        asistencia: "Asistencia",
        falta_justificada: "Falta justificada",
        falta_injustificada: "Falta injustificada",
        atraso: "Atraso",
        salida: "Salida",
        libre: "Libre / Sin registro",
      },
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    })

    if (!estado) return

    await guardarAsistencia({
      agenciaId,
      usuarioAgenciaId,
      fecha,
      estado,
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
      <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-black text-white px-4 py-3">
          <h2 className="text-xl font-extrabold tracking-wide uppercase">
            Registro de asistencia, planificación semanal de agencias
          </h2>
        </div>

        <div className="p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between border-b">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <select
              value={agenciaId}
              onChange={(e) => setAgenciaId(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <button
            onClick={cargarAsistencia}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold shadow"
          >
            Actualizar
          </button>
        </div>

        <div className="overflow-auto max-h-[75vh]">
          <table className="min-w-max w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="bg-yellow-300 text-black">
                <th className="sticky left-0 z-30 bg-yellow-300 border border-black px-3 py-2 text-left min-w-[230px]">
                  Usuario
                </th>

                {fechas.map((item) => (
                  <th
                    key={item.fecha}
                    className="border border-black px-2 py-2 text-center min-w-[45px]"
                  >
                    {item.label}
                  </th>
                ))}

                <th className="border border-black px-3 py-2 text-center bg-gray-100 min-w-[90px]">
                  Asist.
                </th>
                <th className="border border-black px-3 py-2 text-center bg-gray-100 min-w-[90px]">
                  F. Just.
                </th>
                <th className="border border-black px-3 py-2 text-center bg-gray-100 min-w-[90px]">
                  F. Injust.
                </th>
                <th className="border border-black px-3 py-2 text-center bg-gray-100 min-w-[90px]">
                  Atrasos
                </th>
                <th className="border border-black px-3 py-2 text-center bg-gray-100 min-w-[90px]">
                  Salidas
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={fechas.length + 6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Cargando asistencia...
                  </td>
                </tr>
              ) : agenciasFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={fechas.length + 6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No hay datos de asistencia
                  </td>
                </tr>
              ) : (
                agenciasFiltradas.map((agencia) => (
                  <>
                    <tr key={`agencia-${agencia.id}`} className="bg-yellow-400">
                      <td
                        colSpan={fechas.length + 6}
                        className="border border-black px-3 py-2 font-bold uppercase"
                      >
                        {agencia.nombre}
                      </td>
                    </tr>

                    {agencia.usuarios.map((usuario) => {
                      const resumen = calcularResumen(usuario.asistencias)

                      return (
                        <tr
                          key={usuario.usuarioAgenciaId}
                          className="hover:bg-gray-50"
                        >
                          <td className="sticky left-0 z-10 bg-white border border-black px-3 py-2 font-medium uppercase min-w-[230px]">
                            {`${usuario.nombre || ""} ${
                              usuario.apellido || ""
                            }`.trim()}
                          </td>

                          {fechas.map((item) => {
                            const estado =
                              usuario.asistencias?.[item.fecha] || "libre"

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
                                  })
                                }
                                title={ESTADOS[estado]?.nombre}
                                className={`border border-black text-center cursor-pointer h-8 min-w-[45px] font-bold ${
                                  ESTADOS[estado]?.className ||
                                  "bg-green-400 text-black"
                                }`}
                              >
                                {ESTADOS[estado]?.label || ""}
                              </td>
                            )
                          })}

                          <td className="border border-black text-center font-bold bg-gray-100">
                            {resumen.asistencias}
                          </td>
                          <td className="border border-black text-center font-bold bg-gray-100">
                            {resumen.faltasJustificadas}
                          </td>
                          <td className="border border-black text-center font-bold bg-gray-100">
                            {resumen.faltasInjustificadas}
                          </td>
                          <td className="border border-black text-center font-bold bg-gray-100">
                            {resumen.atrasos}
                          </td>
                          <td className="border border-black text-center font-bold bg-gray-100">
                            {resumen.salidas}
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t bg-gray-50 flex flex-wrap gap-3 text-xs">
          {Object.entries(ESTADOS).map(([key, item]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`inline-flex w-8 h-6 items-center justify-center border font-bold ${item.className}`}
              >
                {item.label || "-"}
              </span>
              <span>{item.nombre}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

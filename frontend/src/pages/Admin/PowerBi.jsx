import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { jwtDecode } from "jwt-decode";
import Swal from "sweetalert2";
import DashboardGraficas2 from "./DashboardGraficas2";

const STORAGE_KEY = "powerbi_filtros";
const SEMANAS_POWERBI = 13;
const DIAS_RANGO_POWERBI = SEMANAS_POWERBI * 7 - 1;

const crearFechaLocal = (fecha) => {
  if (fecha instanceof Date) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  }

  const [year, month, day] = String(fecha || "").split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const formatearFechaLocal = (fecha) => {
  const date = crearFechaLocal(fecha);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const sumarDias = (fecha, dias) => {
  const date = crearFechaLocal(fecha);
  if (!date) return null;

  date.setDate(date.getDate() + dias);
  return date;
};

const getInicioSemanaJueves = (fecha) => {
  const inicio = crearFechaLocal(fecha);
  if (!inicio) return null;

  while (inicio.getDay() !== 4) {
    inicio.setDate(inicio.getDate() - 1);
  }

  return inicio;
};

const getFinSemanaMiercoles = (fecha) => {
  const inicio = getInicioSemanaJueves(fecha);
  if (!inicio) return null;

  return sumarDias(inicio, 6);
};

const construirRango13SemanasDesdeFin = (fechaReferencia = new Date()) => {
  const fechaFin = getFinSemanaMiercoles(fechaReferencia);
  const fechaInicio = sumarDias(fechaFin, -DIAS_RANGO_POWERBI);

  return {
    fechaInicio: formatearFechaLocal(fechaInicio),
    fechaFin: formatearFechaLocal(fechaFin),
  };
};

const esRango13SemanasOperativas = (fechaInicio, fechaFin) => {
  const inicio = crearFechaLocal(fechaInicio);
  const fin = crearFechaLocal(fechaFin);

  if (!inicio || !fin || inicio > fin) return false;
  if (inicio.getDay() !== 4 || fin.getDay() !== 3) return false;

  const msPorDia = 24 * 60 * 60 * 1000;
  const diferenciaDias = Math.round((fin - inicio) / msPorDia);

  return diferenciaDias === DIAS_RANGO_POWERBI;
};

const getRangoInicialPowerBi = (filtrosGuardados = {}) => {
  if (
    esRango13SemanasOperativas(
      filtrosGuardados.fechaInicio,
      filtrosGuardados.fechaFin,
    )
  ) {
    return {
      fechaInicio: filtrosGuardados.fechaInicio,
      fechaFin: filtrosGuardados.fechaFin,
    };
  }

  return construirRango13SemanasDesdeFin();
};

export default function Powerbi() {
  const filtrosGuardados = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  const rangoInicial = getRangoInicialPowerBi(filtrosGuardados);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [user, setUser] = useState(null);

  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);

  const [openAgencias, setOpenAgencias] = useState(false);

  const [fechaInicio, setFechaInicio] = useState(
    rangoInicial.fechaInicio
  );

  const [fechaFin, setFechaFin] = useState(
    rangoInicial.fechaFin
  );

  const [agenciaId, setAgenciaId] = useState(
    Array.isArray(filtrosGuardados.agenciaId)
      ? filtrosGuardados.agenciaId
      : filtrosGuardados.agenciaId
      ? String(filtrosGuardados.agenciaId).split(",")
      : []
  );

  const [vendedorId, setVendedorId] = useState(
    filtrosGuardados.vendedorId || ""
  );

  const [cierreCajaTipo, setCierreCajaTipo] = useState(
    filtrosGuardados.cierreCajaTipo || ""
  );

  const [observacion, setObservacion] = useState(
    filtrosGuardados.observacion || ""
  );

  const observaciones = useMemo(() => {
    const items = new Set(Object.keys(estadisticas?.porObservacion || {}));

    if (observacion) {
      items.add(observacion);
    }

    return Array.from(items).sort((a, b) => a.localeCompare(b, "es"));
  }, [estadisticas?.porObservacion, observacion]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
        setUsuarioInfo(decoded.usuario);
      } catch (error) {
        console.error("Error al decodificar token", error);
        localStorage.removeItem("token");
        Swal.fire("Sesion invalida", "Vuelve a iniciar sesion", "warning");
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
        cierreCajaTipo,
        observacion,
      })
    );
  }, [fechaInicio, fechaFin, agenciaId, vendedorId, cierreCajaTipo, observacion]);

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`);
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
      Swal.fire("Error", "No se pudieron cargar los usuarios", "error");
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
      setAgencias(res.data || []);
    } catch (error) {
      console.error("Error cargando agencias:", error);
      setAgencias([]);
      Swal.fire("Error", "No se pudieron cargar las agencias", "error");
    }
  };

  useEffect(() => {
    cargarAgencias();
    cargarUsuarios();
  }, []);

  const toggleAgencia = (id) => {
    setAgenciaId((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  };

  const limpiarAgencias = () => {
    setAgenciaId([]);
  };

  const actualizarFechaInicio = (value) => {
    const inicio = getInicioSemanaJueves(value);

    if (!inicio) {
      setFechaInicio(value);
      return;
    }

    setFechaInicio(formatearFechaLocal(inicio));
    setFechaFin(formatearFechaLocal(sumarDias(inicio, DIAS_RANGO_POWERBI)));
  };

  const actualizarFechaFin = (value) => {
    const fin = getFinSemanaMiercoles(value);

    if (!fin) {
      setFechaFin(value);
      return;
    }

    setFechaInicio(formatearFechaLocal(sumarDias(fin, -DIAS_RANGO_POWERBI)));
    setFechaFin(formatearFechaLocal(fin));
  };

  const fetchData = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      Swal.fire(
        "Fechas invalidas",
        "La fecha de inicio no puede ser mayor que la fecha de fin",
        "warning",
      );
      return;
    }

    if (
      fechaInicio &&
      fechaFin &&
      !esRango13SemanasOperativas(fechaInicio, fechaFin)
    ) {
      setError("El rango debe cubrir exactamente 13 semanas operativas");
      Swal.fire(
        "Rango invalido",
        "Selecciona un rango exacto de 13 semanas, de jueves a miercoles",
        "warning",
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (fechaInicio) params.append("fechaInicio", fechaInicio);
      if (fechaFin) params.append("fechaFin", fechaFin);

      if (agenciaId.length > 0) {
        params.append("agenciaId", agenciaId.join(","));
      }

      if (vendedorId) params.append("vendedorId", vendedorId);
      if (cierreCajaTipo) params.append("cierreCaja", cierreCajaTipo);
      if (observacion.trim()) params.append("observacion", observacion.trim());

      const url = `${API_URL}/auditoria/ventas2?${params.toString()}`;
      const { data } = await axios.get(url);

      if (!data.ok) {
        Swal.fire("Atencion", "No se pudo cargar la informacion solicitada", "warning");
        return;
      }

      setEstadisticas(data.estadisticas);
    } catch (error) {
      console.error(error);
      setError("Error al cargar la información");
      Swal.fire("Error", "Error al cargar la informacion", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    cierreCajaTipo,
    observacion,
    usuarioInfo,
  ]);

  return (
    <div className="p-4">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenido {user?.usuario?.nombre || "Admin"}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="flex flex-col">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Fecha Inicio
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              value={fechaInicio}
              onChange={(e) => actualizarFechaInicio(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Fecha Fin
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              value={fechaFin}
              onChange={(e) => actualizarFechaFin(e.target.value)}
            />
          </div>

          {/* Agencia multiselect SaaS */}
          <div className="flex flex-col relative">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Agencia
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenAgencias((prev) => !prev)}
                className="w-full min-h-[46px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm outline-none transition hover:border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                {agenciaId.length === 0 ? (
                  <span className="text-gray-400">Todas las agencias</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {agenciaId.slice(0, 2).map((id) => {
                      const agencia = agencias.find(
                        (a) => String(a.id) === String(id)
                      );

                      return (
                        <span
                          key={id}
                          className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200"
                        >
                          {agencia?.nombre || id}
                        </span>
                      );
                    })}

                    {agenciaId.length > 2 && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200">
                        +{agenciaId.length - 2} más
                      </span>
                    )}
                  </div>
                )}
              </button>

              {openAgencias && (
                <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      Seleccionar agencias
                    </span>

                    {agenciaId.length > 0 && (
                      <button
                        type="button"
                        onClick={limpiarAgencias}
                        className="text-xs font-medium text-red-500 hover:text-red-600"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto p-2">
                    {agencias.map((a) => {
                      const seleccionado = agenciaId.includes(String(a.id));

                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleAgencia(String(a.id))}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                            seleccionado
                              ? "bg-green-50 text-green-700"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span>{a.nombre}</span>

                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                              seleccionado
                                ? "border-green-500 bg-green-500 text-white"
                                : "border-gray-300 bg-white text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Vendedor
            </label>
            <select
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
            >
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Cierre de caja
            </label>
            <select
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              value={cierreCajaTipo}
              onChange={(e) => setCierreCajaTipo(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="CONTADO">Contado</option>
              <option value="CREDITV">CrediTV</option>
              <option value="UPHONE">Uphone</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Observaciones
            </label>
            <select
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
            >
              <option value="">Todos</option>
              {observaciones.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
<DashboardGraficas2
  estadisticas={estadisticas}
  fechaInicio={fechaInicio}
  fechaFin={fechaFin}
/>
      )}
    </div>
  );
}

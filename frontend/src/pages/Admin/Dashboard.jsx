import { useCallback, useEffect, useMemo, useState } from "react";
import { nombreCortoUsuario } from "../../utils/nombres";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import DashboardGraficas from "./DashboardGraficas";
import MetasDiarias from "./MetasDiaras";
import * as XLSX from "xlsx";
import { FaFileExcel } from "react-icons/fa";
import api from "../../api/client";
import FiltroPeriodoRapido from "../../components/common/FiltroPeriodoRapido";

const STORAGE_KEY = "dashboard_filtros";
const TIPOS_VENDEDOR = [
  { value: "", label: "Todos" },
  { value: "CALL_CENTER", label: "Call Center" },
  { value: "PISO", label: "Piso" },
];
const PERIODOS_DASHBOARD = [
  { id: "HOY", label: "Hoy" },
  { id: "SEMANA", label: "Esta semana" },
  { id: "SIETE_DIAS", label: "7 días" },
  { id: "MES_ATRAS", label: "Hace un mes" },
];

const normalizarOportunidadesPorEtapa = (matriz = {}) =>
  (Array.isArray(matriz.columns) ? matriz.columns : [])
    .map((column) => {
      const id =
        typeof column === "string"
          ? column
          : column.id || column.pipelineStageId || column.name;
      const name =
        typeof column === "string"
          ? column
          : column.name || column.label || column.id || "Sin etapa";

      return {
        name,
        value: Number(
          matriz.totals?.values?.[id] ?? matriz.totals?.stages?.[id] ?? 0,
        ),
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

const normalizarCargo = (cargo) =>
  String(cargo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const obtenerCargosUsuario = (usuario) => {
  const cargos = (usuario?.rolesPago || [])
    .map((rolPago) => rolPago?.cargo)
    .filter(Boolean);

  if (usuario?.rolPago?.cargo) cargos.push(usuario.rolPago.cargo);

  return [...new Set(cargos.map(normalizarCargo))];
};

const perteneceATipoVendedor = (usuario, tipoVendedor) => {
  if (!tipoVendedor) return true;

  const cargos = obtenerCargosUsuario(usuario);

  if (tipoVendedor === "CALL_CENTER") {
    return cargos.some((cargo) => cargo.includes("CALL CENTER"));
  }

  if (tipoVendedor === "PISO") {
    return cargos.some((cargo) => cargo.includes("PISO"));
  }

  return true;
};

const participoEnPeriodo = (usuario, fechaInicio, fechaFin) => {
  const ingreso = usuario?.fechaIngreso
    ? String(usuario.fechaIngreso).slice(0, 10)
    : null;
  const salida = usuario?.fechaSalida
    ? String(usuario.fechaSalida).slice(0, 10)
    : null;

  if (ingreso && fechaFin && ingreso > fechaFin) return false;
  if (salida && fechaInicio && salida < fechaInicio) return false;

  // Un usuario inactivo sin fecha de salida no tiene un periodo historico
  // verificable. Los activos permanecen disponibles mientras no exista una
  // fecha de salida anterior al rango seleccionado.
  return usuario?.activo !== false || Boolean(salida);
};

export default function Dashboard() {
  // 🔥 Cargar filtros desde localStorage UNA SOLA VEZ
  const filtrosGuardados = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

  const [, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosCargados, setUsuariosCargados] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);
  const [oportunidadesPorEtapa, setOportunidadesPorEtapa] = useState([]);
  const [loadingOportunidadesGhl, setLoadingOportunidadesGhl] = useState(false);
  const [errorOportunidadesGhl, setErrorOportunidadesGhl] = useState("");

  // ✅ Estados persistentes
  const [fechaInicio, setFechaInicio] = useState(
    filtrosGuardados.fechaInicio || "2026-01-01",
  );

  const [fechaFin, setFechaFin] = useState(
    filtrosGuardados.fechaFin || new Date().toLocaleDateString("en-CA"),
  );

  const [agenciaId, setAgenciaId] = useState(
    Array.isArray(filtrosGuardados.agenciaId)
      ? filtrosGuardados.agenciaId
      : filtrosGuardados.agenciaId
        ? String(filtrosGuardados.agenciaId).split(",")
        : [],
  );
  const [openAgencias, setOpenAgencias] = useState(false);

  const [vendedorId, setVendedorId] = useState(
    filtrosGuardados.vendedorId || "",
  );

  const [tipoVendedor, setTipoVendedor] = useState(
    ["CALL_CENTER", "PISO"].includes(filtrosGuardados.tipoVendedor)
      ? filtrosGuardados.tipoVendedor
      : "",
  );

  const [cierreCajaTipo, setCierreCajaTipo] = useState(
    filtrosGuardados.cierreCajaTipo || "",
  );

  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        setUser(jwtDecode(token));
      } catch (error) {
        console.error("Error al decodificar token", error);
        localStorage.removeItem("token");
      }
    } else {
      navigate("/login");
    }
  }, [navigate]);

  // 🔥 Guardar en localStorage AUTOMÁTICO
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
        tipoVendedor,
        cierreCajaTipo,
      }),
    );
  }, [
    fechaInicio,
    fechaFin,
    agenciaId,
    vendedorId,
    tipoVendedor,
    cierreCajaTipo,
  ]);

  // -----------------------------
  // CARGAS INICIALES
  // -----------------------------
  const cargarUsuarios = async () => {
    try {
      const res = await api.get("/usuarios", {
        params: { rol: "Vendedor", incluirInactivos: true },
      });
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    } finally {
      setUsuariosCargados(true);
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await api.get("/agencias");
      setAgencias(res.data || []);
    } catch (error) {
      console.error("Error cargando agencias:", error);
      setAgencias([]);
    }
  };

  useEffect(() => {
    cargarAgencias();
    cargarUsuarios();
  }, []);

  const usuariosDelPeriodo = useMemo(
    () =>
      usuarios.filter((usuario) =>
        participoEnPeriodo(usuario, fechaInicio, fechaFin),
      ),
    [fechaFin, fechaInicio, usuarios],
  );

  const usuariosFiltrados = useMemo(
    () =>
      usuariosDelPeriodo.filter((usuario) =>
        perteneceATipoVendedor(usuario, tipoVendedor),
      ),
    [tipoVendedor, usuariosDelPeriodo],
  );

  const vendedoresIdsTipoParam = useMemo(
    () =>
      tipoVendedor
        ? usuariosFiltrados.map((usuario) => String(usuario.id)).join(",")
        : "",
    [tipoVendedor, usuariosFiltrados],
  );

  const vendedorCompatibleConTipo = useMemo(
    () =>
      !tipoVendedor ||
      !vendedorId ||
      usuariosFiltrados.some(
        (usuario) => String(usuario.id) === String(vendedorId),
      ),
    [tipoVendedor, usuariosFiltrados, vendedorId],
  );

  const cantidadesPorTipo = useMemo(
    () => ({
      "": usuariosDelPeriodo.length,
      CALL_CENTER: usuariosDelPeriodo.filter((usuario) =>
        perteneceATipoVendedor(usuario, "CALL_CENTER"),
      ).length,
      PISO: usuariosDelPeriodo.filter((usuario) =>
        perteneceATipoVendedor(usuario, "PISO"),
      ).length,
    }),
    [usuariosDelPeriodo],
  );

  const seleccionarTipoVendedor = (nuevoTipo) => {
    setTipoVendedor(nuevoTipo);
    setVendedorId((vendedorActual) => {
      if (!nuevoTipo || !vendedorActual) return vendedorActual;

      const vendedorSeleccionado = usuariosDelPeriodo.find(
        (usuario) => String(usuario.id) === String(vendedorActual),
      );

      return perteneceATipoVendedor(vendedorSeleccionado, nuevoTipo)
        ? vendedorActual
        : "";
    });
  };

  useEffect(() => {
    if (!usuariosCargados || !tipoVendedor || !vendedorId) return;

    if (!vendedorCompatibleConTipo) setVendedorId("");
  }, [
    tipoVendedor,
    usuariosCargados,
    vendedorCompatibleConTipo,
    vendedorId,
  ]);

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

  const cambiarPeriodoRapido = ({ fechaInicio: inicio, fechaFin: fin }) => {
    setFechaInicio(inicio);
    setFechaFin(fin);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUsuarioInfo(decoded.usuario);
      } catch (error) {
        console.error("Error decodificando token:", error);
      }
    }
  }, []);

  // -----------------------------
  // FETCH DATA
  // -----------------------------
  const fetchData = useCallback(async () => {
    if (tipoVendedor && !usuariosCargados) return;
    if (tipoVendedor && vendedorId && !vendedorCompatibleConTipo) return;

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
      return;
    }

    if (tipoVendedor && !vendedorId && !vendedoresIdsTipoParam) {
      setFilas([]);
      setEstadisticas(null);
      setError(
        `No hay vendedores de ${
          tipoVendedor === "CALL_CENTER" ? "Call Center" : "Piso"
        } en el periodo seleccionado.`,
      );
      return;
    }

    setError("");
    setLoading(true);

    try {
      const params = new URLSearchParams({
        fechaInicio,
        fechaFin,
      });

      if (agenciaId.length > 0) params.append("agenciaId", agenciaId.join(","));
      if (vendedorId) {
        params.append("vendedorId", vendedorId);
      } else if (tipoVendedor) {
        params.append("vendedorId", vendedoresIdsTipoParam);
      }
      if (cierreCajaTipo) params.append("cierreCaja", cierreCajaTipo);

      const { data } = await api.get(`/auditoria/ventas2?${params.toString()}`);

      if (!data.ok) return;

      setEstadisticas(data.estadisticas);

      const ventas = data.ventas || [];

      const resultado = ventas.map((venta) => ({
        id: venta.id,
        Fecha: venta.fecha ?? "",
        Día: venta.dia ?? "",
        Cliente: venta.nombre ?? "",
        Agencia: venta.local ?? "",
        Vendedor: venta.vendedor ?? "",
        Origen: venta.origen ?? "",
        "Observaciones de Origen": venta.observaciones ?? "",
        Dispositivo: venta.tipo ?? "",
        Marca: venta.marca ?? "",
        Modelo: venta.modelo ?? "",
        "Precio Sistema": venta.precioSistema ?? "",
        "Precio Vendedor": venta.precioVendedor ?? "",
        "Forma Pago": venta.formaPago ?? "",
        Contrato: venta.contrato ?? "",
        Entrada: venta.entrada ?? "",
        Alcance: venta.alcance ?? "",
        Estado: venta.validada ? "Validada" : "No validada",
      }));

      setFilas(resultado);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [
    agenciaId,
    cierreCajaTipo,
    fechaFin,
    fechaInicio,
    tipoVendedor,
    usuariosCargados,
    vendedorCompatibleConTipo,
    vendedorId,
    vendedoresIdsTipoParam,
  ]);

  const fetchOportunidadesGhl = useCallback(async () => {
    if (!fechaInicio || !fechaFin || fechaInicio > fechaFin) {
      setOportunidadesPorEtapa([]);
      return;
    }

    setLoadingOportunidadesGhl(true);
    setErrorOportunidadesGhl("");

    try {
      const { data } = await api.get(
        "/api/ghl/dashboard/oportunidades/matriz",
        {
          params: { fechaInicio, fechaFin },
        },
      );

      setOportunidadesPorEtapa(normalizarOportunidadesPorEtapa(data));
    } catch (error) {
      setOportunidadesPorEtapa([]);
      setErrorOportunidadesGhl(
        error.response?.data?.message ||
          "No se pudieron cargar las oportunidades de GHL",
      );
    } finally {
      setLoadingOportunidadesGhl(false);
    }
  }, [fechaFin, fechaInicio]);

  // 🔥 Se ejecuta cuando cambian filtros
  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchData();
    }
  }, [fetchData, fechaFin, fechaInicio, usuarioInfo?.id]);

  useEffect(() => {
    if (fechaInicio && fechaFin && usuarioInfo?.id) {
      fetchOportunidadesGhl();
    }
  }, [fetchOportunidadesGhl, fechaFin, fechaInicio, usuarioInfo?.id]);

  const generarDataExcel = (porTipoModelo, costosHistoricos = {}) => {
    return Object.entries(porTipoModelo)
      .map(([key, venta]) => {
        const [tipo, modelo] = key.split("||");
        const costoHistorico = costosHistoricos[key];
        const costo = Number.parseFloat(costoHistorico?.costo);
        const margenPorcentual = Number.parseFloat(
          costoHistorico?.margenPorcentual,
        );
        const rentabilidad = Number.parseFloat(
          costoHistorico?.rentabilidad ??
            costoHistorico?.utilidadSobreCosto,
        );

        return {
          tipo: tipo.toLowerCase(),
          modelo: modelo.trim(),
          venta: venta,
          stock: "",
          proyeccion: "",
          pedido: "",
          costo: Number.isFinite(costo) ? costo : "",
          margenPorcentual: Number.isFinite(margenPorcentual)
            ? margenPorcentual
            : "",
          rentabilidad: Number.isFinite(rentabilidad) ? rentabilidad : "",
          total: "",
          forma_pago: "contado",
        };
      })
      .sort((a, b) => b.venta - a.venta); // 🔥 ORDEN DESC
  };

  const exportarExcel = (porTipoModelo, costosHistoricos) => {
    const data = generarDataExcel(porTipoModelo, costosHistoricos);

    const wsData = [
      [
        "Tipo",
        "Modelo",
        "Venta",
        "Stock",
        "Proyeccion",
        "Pedido",
        "Costo del Producto",
        "Margen sobre la venta (%)",
        "Rentabilidad (utilidad sobre el costo) (%)",
        "Total",
        "Forma De Pago",
      ],
    ];

    data.forEach((row, index) => {
      const excelRow = index + 2;

      wsData.push([
        row.tipo,
        row.modelo,
        row.venta,
        row.stock,
        row.proyeccion,
        row.pedido,
        row.costo,
        row.margenPorcentual,
        row.rentabilidad,
        { f: `F${excelRow}*G${excelRow}` },
        row.forma_pago,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Reporte");

    // 🔥 AQUÍ EL CAMBIO
    const nombreArchivo = `Comite de compras_${fechaInicio}_a_${fechaFin}.xlsx`;

    XLSX.writeFile(wb, nombreArchivo);
  };

  return (
    <div className="p-4">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900">
          Bienvenido {user?.usuario?.nombre || "Admin"}
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 md:p-5 mb-5">
        <div className="mb-5 rounded-2xl border border-gray-200 bg-gray-50 p-3 md:p-4">
          <div className="mb-3">
            <p className="text-sm font-semibold text-gray-800">
              Equipo de vendedores
            </p>
            <p className="text-xs text-gray-500">
              Filtra los indicadores comerciales por el canal.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {TIPOS_VENDEDOR.map((tipo) => {
              const seleccionado = tipoVendedor === tipo.value;

              return (
                <button
                  key={tipo.value || "TODOS"}
                  type="button"
                  aria-pressed={seleccionado}
                  onClick={() => seleccionarTipoVendedor(tipo.value)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                    seleccionado
                      ? "border-green-500 bg-green-600 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50"
                  }`}
                >
                  <span className="text-sm font-semibold">{tipo.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      seleccionado
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {usuariosCargados ? cantidadesPorTipo[tipo.value] : "..."}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Período rápido</p>
            <p className="text-xs text-gray-500">
              Selecciona un rango para actualizar todos los indicadores.
            </p>
          </div>
          <FiltroPeriodoRapido
            fechaInicio={fechaInicio}
            fechaFin={fechaFin}
            onChange={cambiarPeriodoRapido}
            periodos={PERIODOS_DASHBOARD}
            activeClassName="bg-green-600 text-white shadow-sm"
            inactiveClassName="text-gray-600 hover:bg-white hover:text-gray-900"
            ariaLabel="Períodos rápidos del dashboard"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <div className="flex flex-col">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Fecha Inicio
            </label>
            <input
              type="date"
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
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
              onChange={(e) => setFechaFin(e.target.value)}
            />
          </div>

          <div className="flex flex-col relative">
            <label className="mb-1.5 text-sm font-medium text-gray-700">
              Agencia
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenAgencias((prev) => !prev)}
                className="w-full min-h-[46px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-800 shadow-sm outline-none transition hover:border-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-100"
              >
                {agenciaId.length === 0 ? (
                  <span className="text-gray-400">Todas las agencias</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {agenciaId.slice(0, 2).map((id) => {
                      const agencia = agencias.find(
                        (a) => String(a.id) === String(id),
                      );

                      return (
                        <span
                          key={id}
                          className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
                        >
                          {agencia?.nombre || id}
                        </span>
                      );
                    })}

                    {agenciaId.length > 2 && (
                      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        +{agenciaId.length - 2} mas
                      </span>
                    )}
                  </div>
                )}
              </button>

              {openAgencias && (
                <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                    <span className="text-xs font-semibold uppercase text-gray-500">
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
                            OK
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
              <option value="">
                {tipoVendedor === "CALL_CENTER"
                  ? "Todos los de Call Center"
                  : tipoVendedor === "PISO"
                    ? "Todos los de Piso"
                    : "Todos"}
              </option>
              {usuariosFiltrados.map((u) => (
                <option key={u.id} value={u.id}>
                  {nombreCortoUsuario(u)}
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

          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() =>
                exportarExcel(
                  estadisticas?.porTipoModelo || {},
                  estadisticas?.costosHistoricosPorTipoModelo || {},
                )
              }
              disabled={!estadisticas}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl shadow-sm transition"
            >
              <FaFileExcel size={18} />
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 font-semibold mb-3">{error}</p>}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          <DashboardGraficas
            estadisticas={estadisticas}
            oportunidadesPorEtapa={oportunidadesPorEtapa}
            loadingOportunidadesGhl={loadingOportunidadesGhl}
            errorOportunidadesGhl={errorOportunidadesGhl}
          />
          <MetasDiarias data={estadisticas} />
        </>
      )}
    </div>
  );
}

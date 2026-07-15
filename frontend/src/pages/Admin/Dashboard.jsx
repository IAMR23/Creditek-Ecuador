import { useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../../../config";
import { nombreCortoUsuario } from "../../utils/nombres";
import { Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import DashboardGraficas from "./DashboardGraficas";
import MetasDiarias from "./MetasDiaras";
import * as XLSX from "xlsx";
import { FaFileExcel } from "react-icons/fa";

const STORAGE_KEY = "dashboard_filtros";

export default function Dashboard() {
  // 🔥 Cargar filtros desde localStorage UNA SOLA VEZ
  const filtrosGuardados = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

  const [filas, setFilas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usuarioInfo, setUsuarioInfo] = useState(null);
  const [agencias, setAgencias] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);

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

  const [cierreCajaTipo, setCierreCajaTipo] = useState(
    filtrosGuardados.cierreCajaTipo || "",
  );

  const [user, setUser] = useState(null);

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
  }, []);

  // 🔥 Guardar en localStorage AUTOMÁTICO
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fechaInicio,
        fechaFin,
        agenciaId,
        vendedorId,
        cierreCajaTipo,
      }),
    );
  }, [fechaInicio, fechaFin, agenciaId, vendedorId, cierreCajaTipo]);

  // -----------------------------
  // CARGAS INICIALES
  // -----------------------------
  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/usuarios`, {
        params: { rol: "Vendedor" },
      });
      setUsuarios(res.data || []);
    } catch (error) {
      console.error("Error cargando usuarios:", error);
      setUsuarios([]);
    }
  };

  const cargarAgencias = async () => {
    try {
      const res = await axios.get(`${API_URL}/agencias`);
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
  const fetchData = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha de fin");
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
      if (vendedorId) params.append("vendedorId", vendedorId);
      if (cierreCajaTipo) params.append("cierreCaja", cierreCajaTipo);

      const url = `${API_URL}/auditoria/ventas2?${params.toString()}`;
      const { data } = await axios.get(url);

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
  };

  // 🔥 Se ejecuta cuando cambian filtros
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
    usuarioInfo,
  ]);

  const generarDataExcel = (porTipoModelo, costosHistoricos = {}) => {
    return Object.entries(porTipoModelo)
      .map(([key, venta]) => {
        const [tipo, modelo] = key.split("||");
        const costoHistorico = costosHistoricos[key];
        const costo = Number.parseFloat(costoHistorico?.costo);
        const margenPorcentual = Number.parseFloat(
          costoHistorico?.margenPorcentual,
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
        "Margen Porcentual (%)",
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
              <option value="">Todos</option>
              {usuarios.map((u) => (
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
          <DashboardGraficas estadisticas={estadisticas} />
          <MetasDiarias data={estadisticas} />
        </>
      )}
    </div>
  );
}

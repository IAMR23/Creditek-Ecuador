/* eslint-disable react/prop-types */
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  CalendarCog,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  RefreshCw,
  Save,
  Truck,
  X,
} from "lucide-react";
import { api } from "../../api/client";

const ENDPOINT = "/api/contabilidad/pagos-comisiones";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const blockColors = [
  "bg-orange-200",
  "bg-amber-100",
  "bg-orange-200",
  "bg-yellow-300",
  "bg-rose-500 text-white",
];

const moneyFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const commissionFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const currentDate = new Date();

const initialFilters = {
  year: currentDate.getFullYear(),
  month: currentDate.getMonth() + 1,
};

const emptyWeekValues = {
  venden: 0,
  valorVendido: 0,
  totalComisiones: 0,
  noCumpleMetas: 0,
  valorDescontar: 0,
};

const emptyMonthlyValues = {
  ventasTvCelulaMensual: 0,
  valorComisionSemanal: 0,
  valorComisionMensual: 0,
  totalComisionesSemanaMensual: 0,
  totalNoCumpleMetas: 0,
  totalValorDescontar: 0,
  totalPagar: 0,
};

const getWeekValues = (row, week) => row?.semanas?.[week.startDate] || emptyWeekValues;
const getMonthlyValues = (row) => row?.resumenMensual || emptyMonthlyValues;
const isPersonalNuevoEnReporte = (row, weeks) =>
  weeks.some((week) => getWeekValues(row, week).personalNuevo);
const getFechaIngresoVisible = (row) =>
  row?.fechaIngreso || row?.fechaCreacionUsuario || null;
const getCargosPagoLabel = (row) =>
  (row?.cargosPago || [])
    .map((position) => position.cargo)
    .filter(Boolean)
    .join(" / ");

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));
const formatCommission = (value) => commissionFormatter.format(Number(value || 0));
const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const VALOR_DESCUENTO_INPUT_REGEX = /^\d+(?:\.\d{0,2})?$/;
const esFormatoValorDescuentoInputValido = (value) => {
  const texto = String(value ?? "");
  return texto === "" || VALOR_DESCUENTO_INPUT_REGEX.test(texto);
};
const parseValorDescuentoInput = (value) => {
  const texto = String(value ?? "").trim();
  if (!texto || !VALOR_DESCUENTO_INPUT_REGEX.test(texto)) return null;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0 && numero <= 9999999999.99
    ? numero
    : null;
};
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString("es-EC", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
const addDays = (date, days) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
};
const toDateOnly = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const getFirstThursdayOfYear = (year) => {
  const firstDay = new Date(Number(year), 0, 1);
  const daysSinceThursday = (firstDay.getDay() - 4 + 7) % 7;
  return addDays(firstDay, -daysSinceThursday);
};
const buildCalendarPreview = (year, meses) => {
  let startDate = getFirstThursdayOfYear(year);
  return meses.map((mes) => {
    const cantidadSemanas = Number(mes.cantidadSemanas || 0);
    const fechaInicio = toDateOnly(startDate);
    const endDate = addDays(startDate, cantidadSemanas * 7 - 1);
    startDate = addDays(endDate, 1);
    return {
      ...mes,
      fechaInicio,
      fechaFin: toDateOnly(endDate),
    };
  });
};
const isPastCommercialMonth = (year, month) =>
  Number(year) < currentDate.getFullYear() ||
  (Number(year) === currentDate.getFullYear() &&
    Number(month) < currentDate.getMonth() + 1);
const getCargosComerciales = (vendedor) => {
  const cargos = (vendedor.cargosPago || [])
    .map((position) => position.cargo)
    .filter(Boolean);
  if (vendedor.cargoComision) cargos.push(vendedor.cargoComision);
  if (vendedor.cargo) cargos.push(vendedor.cargo);
  return [...new Set(cargos.map((cargo) => String(cargo).toUpperCase()))];
};
const cumpleFiltroCargo = (vendedor, cargoFiltro) => {
  const cargos = getCargosComerciales(vendedor);
  if (cargoFiltro === "CALL_CENTER") {
    return cargos.some((cargo) => cargo.includes("CALL CENTER"));
  }
  if (cargoFiltro === "PISO") {
    return cargos.some((cargo) => cargo.includes("PISO"));
  }
  return true;
};

const getSeccionPorCargo = (cargoValue) => {
  const cargo = String(cargoValue || "").toUpperCase();
  if (cargo.includes("JEFE COMERCIAL")) return "JEFES";
  if (cargo.includes("SUPERVISOR")) return "SUPERVISORES";
  if (cargo.includes("VENDEDOR")) return "VENDEDORES";
  return null;
};

const getSeccionCargo = (vendedor) =>
  getSeccionPorCargo(vendedor.cargoComision || vendedor.cargo);

const perteneceASeccion = (vendedor, seccion) => {
  if (
    (seccion === "JEFES" || seccion === "SUPERVISORES") &&
    vendedor.activo === false
  ) {
    return false;
  }

  return getCargosComerciales(vendedor).some(
    (cargo) => getSeccionPorCargo(cargo) === seccion,
  );
};

const getVendedorParaSeccion = (vendedor, seccion) => {
  if (seccion !== "VENDEDORES" || !vendedor.ventasPersonalesVendedor) {
    return vendedor;
  }

  const vistaPersonal = vendedor.ventasPersonalesVendedor;
  const semanas = Object.fromEntries(
    Object.entries(vistaPersonal.semanas || {}).map(([semanaInicio, values]) => {
      const valuesPagoPrincipal = vendedor.semanas?.[semanaInicio] || {};
      return [
        semanaInicio,
        {
          ...values,
          noCumpleMetas:
            valuesPagoPrincipal.noCumpleMetas ?? values.noCumpleMetas,
          valorMultaCalculado:
            valuesPagoPrincipal.valorMultaCalculado ??
            values.valorMultaCalculado,
          valorDescontar:
            valuesPagoPrincipal.valorDescontar ?? values.valorDescontar,
          multaOmitida:
            valuesPagoPrincipal.multaOmitida ?? values.multaOmitida,
          descuentoModificado:
            valuesPagoPrincipal.descuentoModificado ??
            values.descuentoModificado,
          valorDescontarPersistido:
            valuesPagoPrincipal.valorDescontarPersistido,
          vistaPreviaDescuento:
            valuesPagoPrincipal.vistaPreviaDescuento,
        },
      ];
    }),
  );
  const totalValorDescontar = Number(
    vendedor.resumenMensual?.totalValorDescontar ??
      vistaPersonal.resumenMensual?.totalValorDescontar ??
      0,
  );

  return {
    ...vendedor,
    ...vistaPersonal,
    semanas,
    total: {
      ...(vistaPersonal.total || {}),
      noCumpleMetas:
        vendedor.total?.noCumpleMetas ??
        vistaPersonal.total?.noCumpleMetas ??
        0,
      valorDescontar: totalValorDescontar,
    },
    resumenMensual: {
      ...(vistaPersonal.resumenMensual || {}),
      totalNoCumpleMetas:
        vendedor.resumenMensual?.totalNoCumpleMetas ??
        vistaPersonal.resumenMensual?.totalNoCumpleMetas ??
        0,
      totalValorDescontar,
      totalPagar: roundMoney(-totalValorDescontar),
    },
    esJefeComercial: false,
    esSupervisorComercial: false,
    vendedoresJunior: [],
    vistaVentasPersonales: true,
  };
};

const SECCIONES = [
  { id: "VENDEDORES", label: "Vendedores" },
  { id: "JEFES", label: "Jefes comerciales" },
  { id: "SUPERVISORES", label: "Supervisores" },
  { id: "LOGISTICA", label: "Logistica" },
];

const EXPORT_OPTIONS = [
  { value: "TODAS", label: "Las 4 secciones" },
  { value: "VENDEDORES", label: "Vendedores" },
  { value: "JEFES", label: "Jefes comerciales" },
  { value: "SUPERVISORES", label: "Supervisores" },
  { value: "LOGISTICA", label: "Logistica" },
];

const getRowsForSection = (vendedores, seccion) =>
  vendedores
    .filter((vendedor) => perteneceASeccion(vendedor, seccion))
    .map((vendedor) => getVendedorParaSeccion(vendedor, seccion));

const buildExcelRows = ({ rows, weeks, sectionLabel }) =>
  rows.map((row, index) => {
    const mensual = getMonthlyValues(row);
    const base = {
      "#": index + 1,
      Seccion: sectionLabel,
      Colaborador: row.nombre || "",
      Cargo: row.cargoComision || row.cargo || "",
      "Cargos pago": getCargosPagoLabel(row),
      Agencias: (row.agencias || []).join(", "),
      "Doble cargo": row.tieneMultiplesCargos ? "SI" : "NO",
      "Fecha ingreso": getFechaIngresoVisible(row) || "",
      "Fecha salida": row.fechaSalida || "",
    };

    weeks.forEach((week, weekIndex) => {
      const values = getWeekValues(row, week);
      const prefix = `S${weekIndex + 1} ${week.label}`;
      base[`${prefix} ventas`] = values.venden || 0;
      base[`${prefix} valor vendido`] = Number(values.valorVendido || 0);
      base[`${prefix} comision`] = Number(values.totalComisiones || 0);
      base[`${prefix} no cumple metas`] = values.noCumpleMetas || 0;
      base[`${prefix} descuento`] = Number(values.valorDescontar || 0);
    });

    return {
      ...base,
      "Ventas mensuales": mensual.ventasTvCelulaMensual || 0,
      "Valor comision semanal": Number(mensual.valorComisionSemanal || 0),
      "Valor comision mensual": Number(mensual.valorComisionMensual || 0),
      "Total comisiones": Number(mensual.totalComisionesSemanaMensual || 0),
      "Total no cumple metas": mensual.totalNoCumpleMetas || 0,
      "Total valor a descontar": Number(mensual.totalValorDescontar || 0),
      "Total a pagar": Number(mensual.totalPagar || 0),
    };
  });

const buildLogisticsExcelRows = ({ rows, weeks }) =>
  rows.map((row, index) => {
    const base = {
      "#": index + 1,
      Seccion: "Logistica",
      Colaborador: row.nombre || "",
      Jerarquia: row.esEncargadoLogistica ? "Encargado" : "Junior",
      "Cargo o rol": row.cargo || "",
      Agencias: (row.agencias || []).join(", "),
      "Tarifa por entrega": Number(row.tarifaPorEntrega || 0),
    };

    weeks.forEach((week, weekIndex) => {
      const values = row.semanas?.[week.startDate] || {};
      const prefix = `S${weekIndex + 1} ${week.label}`;
      base[`${prefix} entregas`] = Number(values.entregas || 0);
      base[`${prefix} valor`] = Number(values.totalComisiones || 0);
    });

    return {
      ...base,
      "Total entregas": Number(row.resumenMensual?.totalEntregas || 0),
      "Total a pagar": Number(row.resumenMensual?.totalPagar || 0),
    };
  });

export default function PagosComisiones() {
  const [filters, setFilters] = useState(initialFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vendedorFiltro, setVendedorFiltro] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("");
  const [juniorId, setJuniorId] = useState("");
  const [jefeComercialId, setJefeComercialId] = useState("");
  const [guardandoJefe, setGuardandoJefe] = useState(false);
  const [guardandoEquipoSemanal, setGuardandoEquipoSemanal] = useState("");
  const [juniorSupervisorId, setJuniorSupervisorId] = useState("");
  const [supervisorComercialId, setSupervisorComercialId] = useState("");
  const [guardandoSupervisor, setGuardandoSupervisor] = useState(false);
  const [descuentosEditados, setDescuentosEditados] = useState({});
  const [guardandoDescuentos, setGuardandoDescuentos] = useState(false);
  const [seccionActiva, setSeccionActiva] = useState("VENDEDORES");
  const [configOpen, setConfigOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMeses, setConfigMeses] = useState([]);
  const [configOriginalMeses, setConfigOriginalMeses] = useState([]);
  const [configResumen, setConfigResumen] = useState(null);
  const [exportScope, setExportScope] = useState("TODAS");
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [pagandoPeriodo, setPagandoPeriodo] = useState(false);

  const years = useMemo(() => {
    const currentYear = currentDate.getFullYear();
    return Array.from({ length: 7 }, (_, index) => currentYear - 3 + index);
  }, []);

  const weeks = useMemo(() => report?.weeks || [], [report]);
  const configuracionMes = report?.configuracionMes || null;
  const estadoPago = report?.estadoPago || null;
  const periodoPagado = Boolean(estadoPago?.pagado);
  const cantidadDescuentosEditados = Object.keys(descuentosEditados).length;
  const selectedMonthLabel =
    MONTHS.find((month) => Number(month.value) === Number(filters.month))?.label ||
    "";
  const vendedoresBase = useMemo(() => report?.vendedores || [], [report]);
  const logistica = useMemo(() => report?.logistica || [], [report]);
  const vendedores = useMemo(() => {
    if (!Object.keys(descuentosEditados).length) return vendedoresBase;

    return vendedoresBase.map((vendedor) => {
      let semanasConVistaPrevia = null;
      let diferenciaDescuentos = 0;

      weeks.forEach((week) => {
        const key = `${vendedor.usuarioId}-${week.startDate}`;
        const ajuste = descuentosEditados[key];
        if (!ajuste) return;

        const values = getWeekValues(vendedor, week);
        const valorVistaPrevia = ajuste.restaurarValorCalculado
          ? Number(values.valorMultaCalculado || 0)
          : parseValorDescuentoInput(ajuste.valorDescontar);
        if (valorVistaPrevia === null) return;

        const valorPersistido = Number(values.valorDescontar || 0);
        if (!semanasConVistaPrevia) semanasConVistaPrevia = { ...vendedor.semanas };
        semanasConVistaPrevia[week.startDate] = {
          ...values,
          valorDescontar: roundMoney(valorVistaPrevia),
          valorDescontarPersistido: valorPersistido,
          vistaPreviaDescuento: true,
        };
        diferenciaDescuentos += valorVistaPrevia - valorPersistido;
      });

      if (!semanasConVistaPrevia) return vendedor;

      const mensual = getMonthlyValues(vendedor);
      const totalValorDescontar = roundMoney(
        Number(mensual.totalValorDescontar || 0) + diferenciaDescuentos,
      );
      return {
        ...vendedor,
        semanas: semanasConVistaPrevia,
        total: vendedor.total
          ? {
              ...vendedor.total,
              valorDescontar: roundMoney(
                Number(vendedor.total.valorDescontar || 0) + diferenciaDescuentos,
              ),
            }
          : vendedor.total,
        resumenMensual: {
          ...mensual,
          totalValorDescontar,
          totalPagar: roundMoney(
            Number(mensual.totalComisionesSemanaMensual || 0) - totalValorDescontar,
          ),
        },
      };
    });
  }, [descuentosEditados, vendedoresBase, weeks]);
  const configMesesPreview = useMemo(
    () => buildCalendarPreview(filters.year, configMeses),
    [configMeses, filters.year],
  );
  const semanasConfiguradas = useMemo(
    () =>
      configMeses.reduce(
        (total, item) => total + Number(item.cantidadSemanas || 0),
        0,
      ),
    [configMeses],
  );
  const semanasRequeridas = configResumen?.semanasRequeridas || 0;
  const configuracionValida =
    configMeses.length === 12 && semanasConfiguradas === semanasRequeridas;
  const configPastChanged = useMemo(
    () =>
      configMeses.some((item) => {
        const original = configOriginalMeses.find(
          (row) => Number(row.mes) === Number(item.mes),
        );
        return (
          original &&
          Number(original.cantidadSemanas) !== Number(item.cantidadSemanas) &&
          isPastCommercialMonth(filters.year, item.mes)
        );
      }),
    [configMeses, configOriginalMeses, filters.year],
  );
  const vendedoresSeccion = useMemo(
    () =>
      vendedores
        .filter((vendedor) =>
          perteneceASeccion(vendedor, seccionActiva),
        )
        .map((vendedor) =>
          getVendedorParaSeccion(vendedor, seccionActiva),
        ),
    [seccionActiva, vendedores],
  );

  const vendedoresFiltrados = useMemo(() => vendedoresSeccion.filter((vendedor) => {
    if (vendedorFiltro && String(vendedor.usuarioId) !== vendedorFiltro) return false;
    return cumpleFiltroCargo(vendedor, cargoFiltro);
  }), [vendedoresSeccion, vendedorFiltro, cargoFiltro]);

  const vendedoresPorCargo = useMemo(
    () => vendedoresSeccion.filter((vendedor) => cumpleFiltroCargo(vendedor, cargoFiltro)),
    [vendedoresSeccion, cargoFiltro],
  );

  const jefesComerciales = useMemo(
    () => vendedores.filter(
      (vendedor) =>
        vendedor.activo !== false &&
        String(vendedor.cargo || "").toUpperCase().includes("JEFE COMERCIAL"),
    ),
    [vendedores],
  );

  const vendedoresElegiblesEquipo = useMemo(() => {
    const disponibles = report?.vendedoresDisponiblesEquipo;
    const candidatos = Array.isArray(disponibles)
      ? disponibles
      : vendedores.filter(
          (vendedor) =>
            String(vendedor.rol || "").toUpperCase().includes("VENDEDOR") ||
            getCargosComerciales(vendedor).some(
              (cargo) =>
                cargo.includes("VENDEDOR") &&
                !cargo.includes("JEFE") &&
                !cargo.includes("SUPERVISOR"),
            ),
        );
    return [...candidatos].sort((a, b) =>
      String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"),
    );
  }, [report, vendedores]);

  const supervisoresComerciales = useMemo(
    () => vendedores.filter(
      (vendedor) =>
        vendedor.activo !== false &&
        getSeccionCargo(vendedor) === "SUPERVISORES",
    ),
    [vendedores],
  );

  const totalVisible = useMemo(() => {
    const resumen = {
      semanas: Object.fromEntries(weeks.map((week) => [week.startDate, {
        ...emptyWeekValues,
        semanaFutura: vendedoresFiltrados[0]?.semanas?.[week.startDate]?.semanaFutura || false,
      }])),
      general: { ...emptyWeekValues },
      resumenMensual: { ...emptyMonthlyValues },
    };
    vendedoresFiltrados.forEach((vendedor) => {
      weeks.forEach((week) => {
        const values = getWeekValues(vendedor, week);
        Object.keys(emptyWeekValues).forEach((key) => {
          resumen.semanas[week.startDate][key] += Number(values[key] || 0);
          resumen.general[key] += Number(values[key] || 0);
        });
      });
      const mensual = getMonthlyValues(vendedor);
      Object.keys(emptyMonthlyValues).forEach((key) => {
        resumen.resumenMensual[key] += Number(mensual[key] || 0);
      });
    });
    return resumen;
  }, [vendedoresFiltrados, weeks]);

  const totalLogistica = useMemo(
    () =>
      logistica.reduce(
        (total, persona) => ({
          entregas:
            total.entregas +
            Number(persona.resumenMensual?.totalEntregas || 0),
          totalPagar:
            total.totalPagar +
            Number(persona.resumenMensual?.totalPagar || 0),
        }),
        { entregas: 0, totalPagar: 0 },
      ),
    [logistica],
  );

  const cambiarSeccion = (seccion) => {
    setSeccionActiva(seccion);
    setCargoFiltro("");
    setVendedorFiltro("");
  };

  const fetchReport = async (reportFilters = filters) => {
    setLoading(true);
    try {
      const { data } = await api.get(ENDPOINT, { params: reportFilters });
      setReport(data);
      setDescuentosEditados({});
    } catch (error) {
      console.error("Error cargando pagos de comisiones", error);
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo cargar el reporte de pagos",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const cargarConfiguracionMeses = async () => {
    setConfigLoading(true);
    try {
      const { data } = await api.get(`${ENDPOINT}/configuracion-meses`, {
        params: { year: filters.year },
      });
      const meses = (data.meses || []).map((item) => ({
        mes: Number(item.mes),
        cantidadSemanas: Number(item.cantidadSemanas),
        observacion: item.observacion || "",
        estado: item.estado,
        configuradaManualmente: Boolean(item.configuradaManualmente),
        fechaInicio: item.fechaInicio,
        fechaFin: item.fechaFin,
      }));
      setConfigMeses(meses);
      setConfigOriginalMeses(meses);
      setConfigResumen(data.resumen || null);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message ||
          "No se pudo cargar la configuracion de meses",
        "error",
      );
    } finally {
      setConfigLoading(false);
    }
  };

  const abrirConfiguracionMes = async () => {
    setConfigOpen(true);
    await cargarConfiguracionMeses();
  };

  const cambiarCantidadSemanas = (mes, cantidadSemanas) => {
    setConfigMeses((current) =>
      current.map((item) =>
        Number(item.mes) === Number(mes)
          ? { ...item, cantidadSemanas: Number(cantidadSemanas) }
          : item,
      ),
    );
  };

  const guardarConfiguracionAnual = async () => {
    if (!configuracionValida) return;

    if (configPastChanged) {
      const confirmacion = await Swal.fire({
        title: "Recalcular periodo",
        text: "Cambiar esta configuracion recalculara las semanas y valores del reporte de comisiones de este periodo.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Guardar cambios",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#059669",
      });
      if (!confirmacion.isConfirmed) return;
    }

    setConfigSaving(true);
    try {
      const { data } = await api.put(
        `${ENDPOINT}/configuracion-anual/${filters.year}`,
        {
          meses: configMeses.map(({ mes, cantidadSemanas, observacion }) => ({
            mes,
            cantidadSemanas,
            observacion,
          })),
        },
      );
      const meses = (data.meses || []).map((item) => ({
        mes: Number(item.mes),
        cantidadSemanas: Number(item.cantidadSemanas),
        observacion: item.observacion || "",
        estado: item.estado,
        configuradaManualmente: Boolean(item.configuradaManualmente),
        fechaInicio: item.fechaInicio,
        fechaFin: item.fechaFin,
      }));
      setConfigMeses(meses);
      setConfigOriginalMeses(meses);
      setConfigResumen(data.resumen || null);
      await fetchReport();
      Swal.fire("Listo", "Configuracion anual guardada", "success");
      setConfigOpen(false);
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message ||
          "No se pudo guardar la configuracion anual",
        "error",
      );
    } finally {
      setConfigSaving(false);
    }
  };

  const exportarExcel = () => {
    if (!report || !weeks.length) {
      Swal.fire("Sin datos", "Genere el reporte antes de exportar", "info");
      return;
    }

    setExportandoExcel(true);
    try {
      const workbook = XLSX.utils.book_new();
      const scopes =
        exportScope === "TODAS"
          ? SECCIONES.map((seccion) => seccion.id)
          : [exportScope];

      scopes.forEach((scope) => {
        const section = SECCIONES.find((item) => item.id === scope);
        const excelRows =
          scope === "LOGISTICA"
            ? buildLogisticsExcelRows({ rows: logistica, weeks })
            : buildExcelRows({
                rows: getRowsForSection(vendedores, scope),
                weeks,
                sectionLabel: section?.label || scope,
              });
        const worksheet = XLSX.utils.json_to_sheet(excelRows);
        worksheet["!cols"] = Object.keys(excelRows[0] || { Colaborador: "" }).map(
          (key) => ({ wch: Math.min(Math.max(String(key).length + 2, 12), 34) }),
        );
        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          (section?.label || scope).slice(0, 31),
        );
      });

      const estado = periodoPagado ? "PAGADO" : "ABIERTO";
      const mes = selectedMonthLabel || filters.month;
      XLSX.writeFile(
        workbook,
        `Pagos_Comisiones_${mes}_${filters.year}_${estado}.xlsx`,
      );
    } catch (error) {
      console.error("Error exportando pagos comisiones", error);
      Swal.fire("Error", "No se pudo generar el archivo Excel", "error");
    } finally {
      setExportandoExcel(false);
    }
  };

  const marcarPeriodoPagado = async () => {
    if (!report || periodoPagado) return;

    const confirmacion = await Swal.fire({
      title: "Marcar como pagado",
      text: "Al marcar este periodo como pagado, el reporte quedara guardado y ya no se recalculara.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Marcar pagado",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#059669",
    });
    if (!confirmacion.isConfirmed) return;

    setPagandoPeriodo(true);
    try {
      const { data } = await api.put(
        `${ENDPOINT}/periodos/${filters.year}/${filters.month}/pagado`,
      );
      setReport(data);
      Swal.fire("Listo", "Periodo marcado como pagado", "success");
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo marcar el periodo pagado",
        "error",
      );
    } finally {
      setPagandoPeriodo(false);
    }
  };

  const seleccionarJunior = (value) => {
    setJuniorId(value);
    const junior = vendedores.find((item) => String(item.usuarioId) === value);
    setJefeComercialId(junior?.jefeComercialId ? String(junior.jefeComercialId) : "");
  };

  const guardarJefeComercial = async () => {
    if (!juniorId) {
      return Swal.fire("Atencion", "Seleccione un vendedor junior", "warning");
    }

    setGuardandoJefe(true);
    try {
      await api.put(`${ENDPOINT}/vendedores/${juniorId}/jefe-comercial`, {
        jefeComercialId: jefeComercialId || null,
      });
      await fetchReport();
      Swal.fire(
        "Listo",
        jefeComercialId ? "Jefe comercial asignado correctamente" : "Asignacion eliminada",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la asignacion",
        "error",
      );
    } finally {
      setGuardandoJefe(false);
    }
  };

  const seleccionarJuniorSupervisor = (value) => {
    setJuniorSupervisorId(value);
    const junior = vendedores.find((item) => String(item.usuarioId) === value);
    setSupervisorComercialId(
      junior?.supervisorComercialId ? String(junior.supervisorComercialId) : "",
    );
  };

  const guardarSupervisorComercial = async () => {
    if (!juniorSupervisorId) {
      return Swal.fire("Atencion", "Seleccione un vendedor junior", "warning");
    }

    setGuardandoSupervisor(true);
    try {
      await api.put(
        `${ENDPOINT}/vendedores/${juniorSupervisorId}/supervisor-comercial`,
        { supervisorComercialId: supervisorComercialId || null },
      );
      await fetchReport();
      Swal.fire(
        "Listo",
        supervisorComercialId ? "Supervisor asignado correctamente" : "Asignacion eliminada",
        "success",
      );
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar la asignacion",
        "error",
      );
    } finally {
      setGuardandoSupervisor(false);
    }
  };

  const cambiarValorDescuento = ({ vendedor, week, values, value }) => {
    const key = `${vendedor.usuarioId}-${week.startDate}`;
    const valorIngresado = parseValorDescuentoInput(value);
    const valorActual = Number(
      values.valorDescontarPersistido ?? values.valorDescontar ?? 0,
    );

    setDescuentosEditados((actuales) => {
      const siguientes = { ...actuales };
      if (
        valorIngresado !== null &&
        Math.round(valorIngresado * 100) === Math.round(valorActual * 100)
      ) {
        delete siguientes[key];
      } else {
        siguientes[key] = {
          usuarioId: vendedor.usuarioId,
          vendedor: vendedor.nombre,
          semanaInicio: week.startDate,
          semana: week.label,
          valorDescontar: value,
          restaurarValorCalculado: false,
        };
      }
      return siguientes;
    });
  };

  const guardarEquipoSemanal = async ({ jefe, week, vendedorIds }) => {
    const key = `${jefe.usuarioId}-${week.startDate}`;
    const tipoLider = jefe.esSupervisorComercial ? "supervisores" : "jefes";
    setGuardandoEquipoSemanal(key);
    try {
      await api.put(
        `${ENDPOINT}/${tipoLider}/${jefe.usuarioId}/equipos-semanales/${week.startDate}`,
        { vendedorIds },
      );
      await fetchReport();
      Swal.fire({
        icon: "success",
        title: "Equipo semanal guardado",
        showConfirmButton: false,
        timer: 1400,
      });
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudo guardar el equipo semanal",
        "error",
      );
    } finally {
      setGuardandoEquipoSemanal("");
    }
  };

  const restaurarValorDescuento = ({ vendedor, week, values }) => {
    const key = `${vendedor.usuarioId}-${week.startDate}`;
    setDescuentosEditados((actuales) => {
      const siguientes = { ...actuales };
      if (!values.descuentoModificado) {
        delete siguientes[key];
        return siguientes;
      }
      siguientes[key] = {
        usuarioId: vendedor.usuarioId,
        vendedor: vendedor.nombre,
        semanaInicio: week.startDate,
        semana: week.label,
        valorDescontar: Number(values.valorMultaCalculado || 0).toFixed(2),
        restaurarValorCalculado: true,
      };
      return siguientes;
    });
  };

  const guardarValoresDescuento = async () => {
    if (!cantidadDescuentosEditados || !report || periodoPagado) return;

    const ajustes = [];
    for (const ajuste of Object.values(descuentosEditados)) {
      if (ajuste.restaurarValorCalculado) {
        ajustes.push({
          usuarioId: ajuste.usuarioId,
          semanaInicio: ajuste.semanaInicio,
          restaurarValorCalculado: true,
        });
        continue;
      }
      const valorDescontar = parseValorDescuentoInput(ajuste.valorDescontar);
      if (valorDescontar === null) {
        Swal.fire(
          "Valor invalido",
          `Revise el descuento de ${ajuste.vendedor} en ${ajuste.semana}.`,
          "warning",
        );
        return;
      }
      ajustes.push({
        usuarioId: ajuste.usuarioId,
        semanaInicio: ajuste.semanaInicio,
        valorDescontar,
      });
    }

    const confirmacion = await Swal.fire({
      title: "Guardar todos los descuentos",
      text: `Se guardaran ${ajustes.length} valor(es) modificado(s) del reporte.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Guardar todo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#059669",
    });
    if (!confirmacion.isConfirmed) return;

    setGuardandoDescuentos(true);
    try {
      const periodoReporte = { year: report.year, month: report.month };
      const { data } = await api.put(`${ENDPOINT}/multas`, {
        ...periodoReporte,
        ajustes,
      });
      setDescuentosEditados({});
      setFilters(periodoReporte);
      await fetchReport(periodoReporte);
      Swal.fire("Listo", data.message, "success");
    } catch (error) {
      Swal.fire(
        "Error",
        error.response?.data?.message || "No se pudieron guardar los descuentos",
        "error",
      );
    } finally {
      setGuardandoDescuentos(false);
    }
  };

  const generarReporte = async () => {
    if (cantidadDescuentosEditados) {
      const confirmacion = await Swal.fire({
        title: "Cambios sin guardar",
        text: "Al generar otro reporte se descartaran los descuentos modificados.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Descartar y generar",
        cancelButtonText: "Cancelar",
      });
      if (!confirmacion.isConfirmed) return;
    }
    await fetchReport(filters);
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700">
                <BadgeDollarSign size={18} />
                Contabilidad
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Pagos comisiones
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Reporte semanal comercial de jueves a miercoles, agrupado por el jueves inicial.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-[150px_160px_auto_auto]">
              <select
                value={filters.month}
                onChange={(event) =>
                  setFilters({ ...filters, month: Number(event.target.value) })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.year}
                onChange={(event) =>
                  setFilters({ ...filters, year: Number(event.target.value) })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={generarReporte}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Generar
              </button>
              <button
                type="button"
                onClick={abrirConfiguracionMes}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              >
                <CalendarCog size={16} />
                Configuracion de mes
              </button>
            </div>
          </div>
          {configuracionMes ? (
            <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">
                {selectedMonthLabel} {filters.year}
              </span>
              <span>
                {configuracionMes.cantidadSemanasConfigurada} semanas comerciales
              </span>
              <span>
                Periodo: {formatDate(configuracionMes.fechaInicio)} al{" "}
                {formatDate(configuracionMes.fechaFin)}
              </span>
              <span>
                Bono mensual aplicado:{" "}
                {configuracionMes.cantidadSemanasConfigurada} semanas
              </span>
              {!configuracionMes.configuradaManualmente ? (
                <span className="text-amber-700">
                  Fallback historico sin configuracion anual manual
                </span>
              ) : null}
            </div>
          ) : null}
        </section>

        <nav className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          {SECCIONES.map((seccion) => {
            const cantidad =
              seccion.id === "LOGISTICA"
                ? logistica.length
                : vendedores.filter((vendedor) =>
                    perteneceASeccion(vendedor, seccion.id),
                  ).length;
            return (
              <button
                type="button"
                key={seccion.id}
                onClick={() => cambiarSeccion(seccion.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  seccionActiva === seccion.id
                    ? "bg-emerald-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {seccion.label} ({cantidad})
              </button>
            );
          })}
        </nav>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<CalendarDays size={18} />}
            label="Semanas comerciales"
            value={weeks.length}
          />
          <Metric
            icon={
              seccionActiva === "LOGISTICA" ? (
                <Truck size={18} />
              ) : (
                <FileSpreadsheet size={18} />
              )
            }
            label={SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label}
            value={
              seccionActiva === "LOGISTICA"
                ? logistica.length
                : vendedoresFiltrados.length
            }
          />
          <Metric
            label={
              seccionActiva === "LOGISTICA"
                ? "Entregas realizadas"
                : "Unidades vendidas"
            }
            value={
              seccionActiva === "LOGISTICA"
                ? totalLogistica.entregas
                : totalVisible.general.venden || 0
            }
          />
          <Metric
            label={
              cantidadDescuentosEditados
                ? "Total a pagar (vista previa)"
                : "Total a pagar"
            }
            value={
              seccionActiva === "LOGISTICA"
                ? formatCurrency(totalLogistica.totalPagar)
                : formatMoney(totalVisible.resumenMensual.totalPagar)
            }
          />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${
                  periodoPagado
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {periodoPagado ? <Lock size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">
                  Estado del periodo
                </h2>
                <p className="text-sm text-slate-600">
                  {periodoPagado
                    ? `Pagado${estadoPago?.pagadoAt ? ` el ${formatDate(estadoPago.pagadoAt)}` : ""}. El reporte esta congelado.`
                    : "Abierto. El reporte se recalcula con ventas, entregas, semanas y configuraciones actuales."}
                </p>
                {cantidadDescuentosEditados ? (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    {cantidadDescuentosEditados} descuento(s) pendiente(s) de guardar.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-[190px_auto_auto_auto]">
              <select
                value={exportScope}
                onChange={(event) => setExportScope(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {EXPORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={guardarValoresDescuento}
                disabled={
                  !cantidadDescuentosEditados ||
                  guardandoDescuentos ||
                  periodoPagado ||
                  loading
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Save size={16} />
                {guardandoDescuentos
                  ? "Guardando todo..."
                  : `Guardar todo (${cantidadDescuentosEditados})`}
              </button>
              <button
                type="button"
                onClick={exportarExcel}
                disabled={!report || exportandoExcel || cantidadDescuentosEditados > 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Download size={16} />
                {exportandoExcel ? "Exportando..." : "Exportar Excel"}
              </button>
              <button
                type="button"
                onClick={marcarPeriodoPagado}
                disabled={
                  !report ||
                  periodoPagado ||
                  pagandoPeriodo ||
                  loading ||
                  cantidadDescuentosEditados > 0
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Lock size={16} />
                {periodoPagado
                  ? "Pagado"
                  : pagandoPeriodo
                    ? "Guardando..."
                    : "Marcar pagado"}
              </button>
            </div>
          </div>
        </section>

        {seccionActiva === "VENDEDORES" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Tipo de cargo
              <select value={cargoFiltro} onChange={(event) => { setCargoFiltro(event.target.value); setVendedorFiltro(""); }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Todos los cargos</option>
                <option value="CALL_CENTER">Vendedor Call Center</option>
                <option value="PISO">Vendedor de Piso</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Colaborador
              <select value={vendedorFiltro} onChange={(event) => setVendedorFiltro(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">Todos los colaboradores del cargo</option>
                {vendedoresPorCargo.map((vendedor) => <option key={vendedor.usuarioId} value={vendedor.usuarioId}>{vendedor.nombre}</option>)}
              </select>
            </label>
          </div>
        </section>
        ) : null}

        {seccionActiva === "JEFES" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <h2 className="font-semibold text-slate-900">Asignacion general de respaldo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Esta asignacion se usa solamente cuando el equipo de una semana aun no ha sido configurado.
            </p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="text-sm font-medium text-slate-700">
              Vendedor junior
              <select
                value={juniorId}
                onChange={(event) => seleccionarJunior(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Seleccione un vendedor</option>
                {vendedoresElegiblesEquipo.map((vendedor) => (
                  <option key={vendedor.usuarioId} value={vendedor.usuarioId}>
                    {vendedor.nombre} - {vendedor.cargoComision || vendedor.cargo || vendedor.rol || "Vendedor"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Jefe comercial
              <select
                value={jefeComercialId}
                onChange={(event) => setJefeComercialId(event.target.value)}
                disabled={!juniorId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">Sin jefe asignado</option>
                {jefesComerciales.map((jefe) => (
                  <option key={jefe.usuarioId} value={jefe.usuarioId}>
                    {jefe.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={guardarJefeComercial}
              disabled={!juniorId || guardandoJefe}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {guardandoJefe ? "Guardando..." : "Guardar asignacion"}
            </button>
          </div>
        </section>
        ) : null}

        {seccionActiva === "SUPERVISORES" ? (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-900">Asignacion general de respaldo</h2>
              <p className="mt-1 text-sm text-slate-500">
                Esta asignacion se usa solamente cuando el equipo de una semana aun no ha sido configurado.
              </p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="text-sm font-medium text-slate-700">
                Vendedor junior
                <select
                  value={juniorSupervisorId}
                  onChange={(event) => seleccionarJuniorSupervisor(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Seleccione un vendedor</option>
                  {vendedoresElegiblesEquipo.map((vendedor) => (
                    <option key={vendedor.usuarioId} value={vendedor.usuarioId}>
                      {vendedor.nombre} - {vendedor.cargoComision || vendedor.cargo || vendedor.rol || "Vendedor"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                Supervisor
                <select
                  value={supervisorComercialId}
                  onChange={(event) => setSupervisorComercialId(event.target.value)}
                  disabled={!juniorSupervisorId}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                >
                  <option value="">Sin supervisor asignado</option>
                  {supervisoresComerciales.map((supervisor) => (
                    <option key={supervisor.usuarioId} value={supervisor.usuarioId}>
                      {supervisor.nombre} - {supervisor.cargo}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={guardarSupervisorComercial}
                disabled={!juniorSupervisorId || guardandoSupervisor}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {guardandoSupervisor ? "Guardando..." : "Guardar asignacion"}
              </button>
            </div>
          </section>
        ) : null}

        {seccionActiva === "VENDEDORES" ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-center text-sm text-slate-950">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 min-w-[240px] border border-slate-950 bg-white px-3 py-4 text-xl font-black"
                  >
                    {SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label.toUpperCase()}
                  </th>
                  {weeks.map((week, index) => (
                    <th
                      key={week.startDate}
                      colSpan={5}
                      className={`border border-slate-950 px-3 py-2 text-lg font-black ${blockColors[index % blockColors.length]}`}
                    >
                      {week.label}
                    </th>
                  ))}
                  <MonthlyHeader />
                </tr>
                <tr>
                  {weeks.map((week, index) => (
                    <WeekHeader key={week.startDate} color={blockColors[index % blockColors.length]} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={1 + weeks.length * 5 + 7}
                      className="border border-slate-300 px-4 py-10 text-center text-slate-500"
                    >
                      Cargando reporte...
                    </td>
                  </tr>
                ) : vendedoresFiltrados.length ? (
                  vendedoresFiltrados.map((vendedor, index) => {
                    const cargosPagoLabel = getCargosPagoLabel(vendedor);
                    return (
                      <tr
                      key={vendedor.usuarioId}
                      className={
                        vendedor.fechaSalida
                          ? "bg-blue-50"
                          : index % 2 === 0
                            ? "bg-white"
                            : "bg-orange-100"
                      }
                    >
                      <td className="sticky left-0 z-10 border border-slate-950 bg-inherit px-3 py-1.5 text-left font-medium">
                        <div className="leading-tight">
                          <span>{vendedor.nombre}</span>
                          {vendedor.cargo ? (
                            <span className="block text-[11px] font-normal text-slate-500">
                              {vendedor.cargo}
                            </span>
                          ) : null}
                          {vendedor.tieneMultiplesCargos ? (
                            <>
                              {cargosPagoLabel ? (
                                <span className="block text-[10px] font-normal text-blue-700">
                                  {cargosPagoLabel}
                                </span>
                              ) : null}
                              <span className="block text-[10px] font-semibold text-emerald-700">
                                {vendedor.vistaVentasPersonales
                                  ? "Solo ventas personales; la comisión se liquida en Jefes comerciales"
                                  : `Comisión calculada como: ${
                                      vendedor.cargoComision || vendedor.cargo
                                    }`}
                              </span>
                            </>
                          ) : null}
                          {vendedor.fechaSalida ? (
                            <span className="mt-1 inline-block rounded bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                              Salida: {String(vendedor.fechaSalida).slice(0, 10)}
                            </span>
                          ) : null}
                          {vendedor.esJefeComercial ? (
                            <span className="block text-[11px] font-normal text-emerald-700">
                              {vendedor.vendedoresJunior?.length || 0} junior(s)
                              {vendedor.resumenMensual?.promedioVentasPorJunior !== null
                                ? ` · Promedio ${formatCommission(vendedor.resumenMensual?.promedioVentasPorJunior)}`
                                : ""}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {weeks.map((week) => (
                        <WeekValues
                          key={`${vendedor.usuarioId}-${week.startDate}`}
                          values={getWeekValues(vendedor, week)}
                          vendedor={vendedor}
                          week={week}
                          descuentoEditado={
                            descuentosEditados[`${vendedor.usuarioId}-${week.startDate}`]
                          }
                          onCambiarDescuento={cambiarValorDescuento}
                          onRestaurarDescuento={restaurarValorDescuento}
                          periodoPagado={periodoPagado}
                          guardando={guardandoDescuentos}
                        />
                      ))}
                      <MonthlyValues values={getMonthlyValues(vendedor)} />
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={1 + weeks.length * 5 + 7}
                      className="border border-slate-300 px-4 py-10 text-center text-slate-500"
                    >
                      No hay registros en esta seccion para el mes seleccionado.
                    </td>
                  </tr>
                )}

                {weeks.length ? (
                  <tr className="bg-fuchsia-500 font-black text-white">
                    <td className="sticky left-0 z-10 border border-slate-950 bg-fuchsia-500 px-3 py-1.5 text-left">
                      TOTAL
                    </td>
                    {weeks.map((week) => (
                      <WeekValues
                        key={`total-${week.startDate}`}
                        values={totalVisible.semanas?.[week.startDate] || emptyWeekValues}
                        total
                      />
                    ))}
                    <MonthlyValues values={getMonthlyValues(totalVisible)} total />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
        ) : seccionActiva === "LOGISTICA" ? (
          <LogisticsCommissionTable
            rows={logistica}
            weeks={weeks}
            loading={loading}
          />
        ) : (
          <LeadershipCommissionTables
            rows={vendedoresFiltrados}
            weeks={weeks}
            loading={loading}
            vendedoresDisponibles={vendedoresElegiblesEquipo}
            onGuardarEquipoSemanal={guardarEquipoSemanal}
            guardandoEquipoSemanal={guardandoEquipoSemanal}
            periodoPagado={periodoPagado}
            sectionLabel={
              SECCIONES.find((seccion) => seccion.id === seccionActiva)?.label || ""
            }
          />
        )}
        {configOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
            <section className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Configuracion de mes
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-600">
                    <span>Año: {filters.year}</span>
                    <span>Semanas configuradas: {semanasConfiguradas}</span>
                    <span>Semanas requeridas: {semanasRequeridas || "-"}</span>
                    <span
                      className={
                        configuracionValida
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-red-700"
                      }
                    >
                      {configuracionValida
                        ? "Configuracion valida"
                        : "Configuracion invalida"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  title="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>

              {!configuracionValida ? (
                <div className="mx-5 mt-4 flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Ajuste los meses para que la suma sea igual a las semanas
                    requeridas del calendario comercial anual.
                  </span>
                </div>
              ) : null}

              {configPastChanged ? (
                <div className="mx-5 mt-4 flex gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                  <span>
                    Cambiar esta configuracion recalculara las semanas y valores
                    del reporte de comisiones de este periodo.
                  </span>
                </div>
              ) : null}

              <div className="max-h-[58vh] overflow-auto p-5">
                {configLoading ? (
                  <div className="py-12 text-center text-sm text-slate-500">
                    Cargando configuracion...
                  </div>
                ) : (
                  <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700">
                        <th className="border border-slate-200 px-3 py-2">Mes</th>
                        <th className="border border-slate-200 px-3 py-2">
                          Cantidad de semanas
                        </th>
                        <th className="border border-slate-200 px-3 py-2">
                          Fecha inicial
                        </th>
                        <th className="border border-slate-200 px-3 py-2">
                          Fecha final
                        </th>
                        <th className="border border-slate-200 px-3 py-2">Estado</th>
                        <th className="border border-slate-200 px-3 py-2">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configMesesPreview.map((item) => {
                        const monthLabel =
                          MONTHS.find((month) => month.value === item.mes)?.label ||
                          item.mes;
                        const original = configOriginalMeses.find(
                          (row) => Number(row.mes) === Number(item.mes),
                        );
                        const changed =
                          original &&
                          Number(original.cantidadSemanas) !==
                            Number(item.cantidadSemanas);
                        return (
                          <tr key={item.mes} className="odd:bg-white even:bg-slate-50">
                            <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-900">
                              {monthLabel}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <select
                                value={item.cantidadSemanas}
                                onChange={(event) =>
                                  cambiarCantidadSemanas(
                                    item.mes,
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                              >
                                <option value={4}>4 semanas</option>
                                <option value={5}>5 semanas</option>
                              </select>
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              {formatDate(item.fechaInicio)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              {formatDate(item.fechaFin)}
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              <span
                                className={`rounded px-2 py-1 text-xs font-semibold ${
                                  item.configuradaManualmente
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {item.configuradaManualmente
                                  ? "Configurado"
                                  : "Fallback"}
                              </span>
                            </td>
                            <td className="border border-slate-200 px-3 py-2">
                              {changed ? (
                                <span className="text-xs font-semibold text-blue-700">
                                  Pendiente
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">
                                  Sin cambios
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setConfigOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardarConfiguracionAnual}
                  disabled={!configuracionValida || configSaving || configLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  {configSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WeeklyLeaderTeamConfiguration({
  leader,
  weeks,
  sellers,
  onSave,
  savingKey,
  disabled,
}) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Vendedores a cargo por semana
          </h3>
          <p className="text-xs text-slate-600">
            La seleccion guardada se usa para dispositivos por vendedor y para el
            calculo del promedio de esa semana.
          </p>
          {leader.tieneMultiplesCargos ? (
            <p className="mt-1 text-xs font-medium text-blue-700">
              Las ventas propias del jefe se incluyen automaticamente.
            </p>
          ) : null}
        </div>
        {disabled ? (
          <span className="inline-flex w-fit items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
            <Lock size={13} /> Periodo pagado
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {weeks.map((week) => (
          <WeeklyTeamCard
            key={`${leader.usuarioId}-${week.startDate}`}
            leader={leader}
            week={week}
            sellers={sellers}
            onSave={onSave}
            savingKey={savingKey}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function WeeklyTeamCard({
  leader,
  week,
  sellers,
  onSave,
  savingKey,
  disabled,
}) {
  const values = getWeekValues(leader, week);
  const configured = Boolean(values.equipoSemanalConfigurado);
  const savedIds = [...new Set(
    (values.vendedorIdsSeleccionados || []).map((id) => String(id)),
  )].sort((a, b) => Number(a) - Number(b));
  const savedSignature = savedIds.join(",");
  const [selectedIds, setSelectedIds] = useState(savedIds);

  useEffect(() => {
    setSelectedIds(savedSignature ? savedSignature.split(",") : []);
  }, [savedSignature]);

  const selectedSignature = [...selectedIds]
    .sort((a, b) => Number(a) - Number(b))
    .join(",");
  const key = `${leader.usuarioId}-${week.startDate}`;
  const isSaving = savingKey === key;
  const isBusy = Boolean(savingKey);
  const hasChanges = !configured || selectedSignature !== savedSignature;

  const toggleSeller = (sellerId) => {
    const id = String(sellerId);
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-slate-800">{week.label}</h4>
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
            configured
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {configured ? "Configurado" : "Asignacion general"}
        </span>
      </div>

      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
        {sellers.length ? (
          sellers.map((seller) => {
            const id = String(seller.usuarioId);
            const detalleCargo =
              seller.cargoComision || seller.cargo || seller.rol || "Vendedor";
            return (
              <label
                key={seller.usuarioId}
                className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(id)}
                  onChange={() => toggleSeller(id)}
                  disabled={disabled || isBusy}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">
                    {seller.nombre}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {detalleCargo}
                  </span>
                </span>
              </label>
            );
          })
        ) : (
          <p className="py-2 text-center text-xs text-slate-500">
            No hay vendedores de piso disponibles.
          </p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() =>
            onSave({
              jefe: leader,
              week,
              vendedorIds: selectedIds.map(Number),
            })
          }
          disabled={disabled || isBusy || !hasChanges}
          className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={13} />
          {isSaving ? "Guardando..." : "Guardar semana"}
        </button>
      </div>
    </article>
  );
}

function LogisticsCommissionTable({ rows, weeks, loading }) {
  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Cargando reporte...
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        No hay personal activo de logistica para el mes seleccionado.
      </section>
    );
  }

  const weekTotals = Object.fromEntries(
    weeks.map((week) => [
      week.startDate,
      rows.reduce(
        (total, row) => ({
          entregas:
            total.entregas +
            Number(row.semanas?.[week.startDate]?.entregas || 0),
          totalComisiones:
            total.totalComisiones +
            Number(row.semanas?.[week.startDate]?.totalComisiones || 0),
        }),
        { entregas: 0, totalComisiones: 0 },
      ),
    ]),
  );
  const totalEntregas = rows.reduce(
    (total, row) => total + Number(row.resumenMensual?.totalEntregas || 0),
    0,
  );
  const totalPagar = rows.reduce(
    (total, row) => total + Number(row.resumenMensual?.totalPagar || 0),
    0,
  );

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-center text-sm text-slate-950">
          <thead>
            <tr className="bg-slate-100">
              <th className="sticky left-0 z-20 min-w-[240px] border border-slate-300 bg-slate-100 px-3 py-3 text-left font-black">
                COLABORADOR
              </th>
              <th className="min-w-[150px] border border-slate-300 px-3 py-3 font-black">
                CARGO / ROL
              </th>
              <th className="min-w-[120px] border border-slate-300 px-3 py-3 font-black">
                TARIFA
              </th>
              {weeks.map((week, index) => (
                <th
                  key={week.startDate}
                  className={`min-w-[145px] border border-slate-300 px-3 py-3 font-black ${blockColors[index % blockColors.length]}`}
                >
                  {week.label}
                </th>
              ))}
              <th className="min-w-[120px] border border-slate-300 bg-amber-100 px-3 py-3 font-black">
                ENTREGAS
              </th>
              <th className="min-w-[130px] border border-slate-300 bg-emerald-700 px-3 py-3 font-black text-white">
                A RECIBIR
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.usuarioId}
                className={
                  row.esEncargadoLogistica
                    ? "bg-emerald-50"
                    : index % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50"
                }
              >
                <td className="sticky left-0 z-10 border border-slate-300 bg-inherit px-3 py-3 text-left">
                  <span className="block font-bold text-slate-900">
                    {row.nombre}
                  </span>
                  <span className="block text-xs font-medium text-slate-500">
                    {row.esEncargadoLogistica ? "Encargado" : "Junior"}
                    {row.agencias?.length
                      ? ` · ${row.agencias.join(", ")}`
                      : ""}
                  </span>
                </td>
                <td className="border border-slate-300 px-3 py-3 font-semibold">
                  {row.cargo}
                </td>
                <td className="border border-slate-300 px-3 py-3 font-black text-emerald-700">
                  {formatCurrency(row.tarifaPorEntrega)}
                </td>
                {weeks.map((week) => {
                  const values = row.semanas?.[week.startDate] || {};
                  return (
                    <td
                      key={`${row.usuarioId}-${week.startDate}`}
                      className="border border-slate-300 px-3 py-2"
                    >
                      {values.semanaFutura ? (
                        "-"
                      ) : (
                        <>
                          <span className="block text-lg font-black">
                            {values.entregas || 0}
                          </span>
                          <span className="block text-xs font-semibold text-emerald-700">
                            {formatCurrency(values.totalComisiones)}
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
                <td className="border border-slate-300 bg-amber-50 px-3 py-3 text-lg font-black">
                  {row.resumenMensual?.totalEntregas || 0}
                </td>
                <td className="border border-slate-300 bg-emerald-700 px-3 py-3 text-lg font-black text-white">
                  {formatCurrency(row.resumenMensual?.totalPagar)}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-900 font-black text-white">
              <td className="sticky left-0 z-10 border border-slate-700 bg-slate-900 px-3 py-3 text-left">
                TOTAL
              </td>
              <td className="border border-slate-700 px-3 py-3" />
              <td className="border border-slate-700 px-3 py-3" />
              {weeks.map((week) => (
                <td
                  key={`logistica-total-${week.startDate}`}
                  className="border border-slate-700 px-3 py-2"
                >
                  <span className="block text-lg">
                    {weekTotals[week.startDate]?.entregas || 0}
                  </span>
                  <span className="block text-xs text-emerald-300">
                    {formatCurrency(
                      weekTotals[week.startDate]?.totalComisiones,
                    )}
                  </span>
                </td>
              ))}
              <td className="border border-slate-700 px-3 py-3 text-lg">
                {totalEntregas}
              </td>
              <td className="border border-slate-700 bg-emerald-700 px-3 py-3 text-lg">
                {formatCurrency(totalPagar)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LeadershipCommissionTables({
  rows,
  weeks,
  loading,
  sectionLabel,
  vendedoresDisponibles,
  onGuardarEquipoSemanal,
  guardandoEquipoSemanal,
  periodoPagado,
}) {
  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        Cargando reporte...
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
        No hay registros en {sectionLabel.toLowerCase()} para el mes seleccionado.
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map((row) => {
        const mensual = getMonthlyValues(row);
        const personalNuevo = isPersonalNuevoEnReporte(row, weeks);
        const fechaIngreso = getFechaIngresoVisible(row);
        const cargosPagoLabel = getCargosPagoLabel(row);
        return (
          <section
            key={row.usuarioId}
            className={`overflow-hidden rounded-lg border bg-white shadow-sm ${
              row.fechaSalida || personalNuevo || row.tieneMultiplesCargos
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-slate-200"
            }`}
          >
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-center text-lg font-black uppercase text-slate-900">
                Comisiones {row.nombre}
              </h2>
              {row.tieneMultiplesCargos ? (
                <div className="mt-1 text-center">
                  {cargosPagoLabel ? (
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      {cargosPagoLabel}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {personalNuevo ? (
                <p className="mt-1 text-center">
                  <span className="inline-block rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">
                    Personal nuevo · aplica multa
                    {fechaIngreso
                      ? ` · Fecha de ingreso: ${String(fechaIngreso).slice(0, 10)}`
                      : ""}
                  </span>
                </p>
              ) : null}
              {row.fechaSalida ? (
                <p className="mt-1 text-center">
                  <span className="inline-block rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white">
                    Fecha de salida: {String(row.fechaSalida).slice(0, 10)}
                  </span>
                </p>
              ) : null}
              {row.vendedoresJunior?.length ? (
                <p className="mt-1 text-center text-xs text-slate-500">
                  Vendedores considerados:{" "}
                  {row.vendedoresJunior
                    .map((vendedor) =>
                      vendedor.esLiderVendedor
                        ? `${vendedor.nombre} (doble cargo)`
                        : vendedor.nombre,
                    )
                    .join(", ")}
                  {mensual.promedioVentasPorJunior !== null
                    ? ` · Promedio por vendedor: ${formatCommission(mensual.promedioVentasPorJunior)}`
                    : ""}
                </p>
              ) : null}
              {row.esJefeComercial ? (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs">
                  <p className="font-semibold text-emerald-800">
                    Bono:{" "}
                    {mensual.vendedoresConsideradosBono?.length
                      ? mensual.vendedoresConsideradosBono
                          .map((vendedor) => vendedor.nombre)
                          .join(", ")
                      : "Sin vendedores elegibles"}
                    {" · "}
                    {mensual.ventasConsideradasBono || 0} dispositivos considerados
                  </p>
                  {mensual.vendedoresExcluidosBono?.length ? (
                    <p className="mt-1 text-amber-800">
                      No considerados para el bono:{" "}
                      {mensual.vendedoresExcluidosBono
                        .map(
                          (vendedor) =>
                            `${vendedor.nombre} (${vendedor.razones.join(", ")})`,
                        )
                        .join("; ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {row.esJefeComercial || row.esSupervisorComercial ? (
              <WeeklyLeaderTeamConfiguration
                leader={row}
                weeks={weeks}
                sellers={vendedoresDisponibles.filter(
                  (vendedor) => Number(vendedor.usuarioId) !== Number(row.usuarioId),
                )}
                onSave={onGuardarEquipoSemanal}
                savingKey={guardandoEquipoSemanal}
                disabled={periodoPagado}
              />
            ) : null}
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[760px] border-collapse text-center text-sm text-slate-950">
                <thead>
                  <tr>
                    <th className="border border-slate-950 px-3 py-2" />
                    {weeks.map((week, index) => (
                      <th key={week.startDate} className={`border border-slate-950 px-3 py-2 font-black ${blockColors[index % blockColors.length]}`}>
                        {week.label}
                      </th>
                    ))}
                    <th className="border border-slate-950 bg-amber-100 px-3 py-2 font-black">COMISION</th>
                    <th className="border border-slate-950 px-3 py-2 font-black">BONO</th>
                    <th className="border border-slate-950 bg-red-600 px-3 py-2 font-black text-white">A RECIBIR</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-950 px-3 py-2 font-bold uppercase">{row.nombre}</td>
                    {weeks.map((week) => {
                      const values = getWeekValues(row, week);
                      return <td key={week.startDate} className="border border-slate-950 px-3 py-2 text-xl">{values.semanaFutura ? "-" : values.venden || 0}</td>;
                    })}
                    <td className="border border-slate-950 bg-amber-100 px-3 py-2" />
                    <td className="border border-slate-950 px-3 py-2" />
                    <td className="border border-slate-950 bg-red-600 px-3 py-2 text-white" />
                  </tr>
                  {row.esJefeComercial ? (
                    <tr className="font-bold">
                      <td className="border border-slate-950 bg-emerald-700 px-3 py-2 text-white">
                        DISPOSITIVOS POR VENDEDOR
                      </td>
                      {weeks.map((week) => {
                        const values = getWeekValues(row, week);
                        const vendedores = values.vendedoresActivos || [];
                        return (
                          <td
                            key={`ventas-vendedor-${week.startDate}`}
                            className="border border-slate-950 bg-emerald-50 px-2 py-2 text-emerald-900"
                          >
                            {values.semanaFutura
                              ? "-"
                              : vendedores.length
                                ? (
                                  <div className="flex flex-col gap-1">
                                    {vendedores.map((vendedor) => (
                                      <span
                                        key={vendedor.usuarioId}
                                        className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold"
                                      >
                                        {vendedor.nombre}: {vendedor.venden || 0}
                                        {vendedor.esLiderVendedor
                                          ? " (doble cargo)"
                                          : ""}
                                      </span>
                                    ))}
                                  </div>
                                )
                                : "Sin vendedores"}
                          </td>
                        );
                      })}
                      <td
                        colSpan={3}
                        className="border border-slate-950 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                      >
                        Ventas individuales incluidas en el total del jefe
                      </td>
                    </tr>
                  ) : null}
                  {row.esSupervisorComercial ? (
                    <tr className="font-bold">
                      <td className="border border-slate-950 bg-blue-600 px-3 py-2 text-white">
                        DISPOSITIVOS POR VENDEDOR
                      </td>
                      {weeks.map((week) => {
                        const values = getWeekValues(row, week);
                        const vendedoresActivos = values.vendedoresActivos || [];
                        return (
                          <td
                            key={`equipo-${week.startDate}`}
                            className="border border-slate-950 bg-blue-50 px-2 py-2 text-blue-800"
                          >
                            {values.semanaFutura
                              ? "-"
                              : vendedoresActivos.length
                                ? (
                                  <div className="flex flex-col gap-1">
                                    {vendedoresActivos.map((vendedor) => (
                                      <span
                                        key={vendedor.usuarioId}
                                        className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold"
                                      >
                                        {vendedor.nombre}: {vendedor.venden || 0}
                                        {vendedor.esLiderVendedor
                                          ? " (doble cargo)"
                                          : ""}
                                      </span>
                                    ))}
                                  </div>
                                )
                                : "Sin vendedores"}
                          </td>
                        );
                      })}
                      <td
                        colSpan={3}
                        className="border border-slate-950 bg-blue-50 px-3 py-2 text-xs text-blue-800"
                      >
                        Ventas individuales incluidas en el total del supervisor
                      </td>
                    </tr>
                  ) : null}
                  <tr className="font-black">
                    <td className="border border-slate-950 bg-pink-400 px-3 py-2">TOTAL COMISIONES</td>
                    {weeks.map((week) => {
                      const values = getWeekValues(row, week);
                      return <td key={week.startDate} className="border border-slate-950 px-3 py-2 text-lg">{values.semanaFutura ? "-" : formatCommission(values.totalComisiones)}</td>;
                    })}
                    <td className="border border-slate-950 bg-amber-100 px-3 py-2 text-lg">{formatCommission(mensual.valorComisionSemanal)}</td>
                    <td className="border border-slate-950 px-3 py-2 text-lg">{formatCommission(mensual.valorComisionMensual)}</td>
                    <td className="border border-slate-950 bg-red-600 px-3 py-2 text-lg text-white">{formatCommission(mensual.totalPagar)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Metric({ icon = null, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function WeekHeader({ color }) {
  return (
    <>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        VENDEN
      </th>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        VALOR / VENDIDO
      </th>
      <th className={`border border-slate-950 px-2 py-2 text-xs font-black ${color}`}>
        TOTAL COMISIONES
      </th>
      <th className="border border-slate-950 bg-blue-800 px-2 py-2 text-xs font-black text-white">
        NO CUMPLE METAS
      </th>
      <th className="border border-slate-950 bg-red-700 px-2 py-2 text-xs font-black text-white">
        VALOR A DESCONTAR
      </th>
    </>
  );
}

function WeekValues({
  values,
  total = false,
  vendedor = null,
  week = null,
  descuentoEditado = null,
  onCambiarDescuento = null,
  onRestaurarDescuento = null,
  guardando = false,
  periodoPagado = false,
}) {
  const noCumpleClass = total
    ? "border border-slate-950 px-2 py-1.5"
    : "border border-slate-950 bg-indigo-100 px-2 py-1.5";
  const puedeGestionarMulta =
    !total &&
    vendedor &&
    week &&
    onCambiarDescuento &&
    !periodoPagado &&
    Number(values.valorMultaCalculado || 0) > 0;
  const valorInput = descuentoEditado
    ? descuentoEditado.valorDescontar
    : Number(values.valorDescontar || 0).toFixed(2);
  const valorInputValido = parseValorDescuentoInput(valorInput) !== null;

  return (
    <>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "Pendiente" : values.venden || ""}
      </td>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "-" : values.valorVendido ? formatMoney(values.valorVendido) : ""}
      </td>
      <td className="border border-slate-950 px-2 py-1.5">
        {values.semanaFutura ? "-" : values.totalComisiones ? formatCommission(values.totalComisiones) : 0}
      </td>
      <td className={noCumpleClass}>
        {values.semanaFutura ||
        (!total &&
          (values.semanaLaborada === false ||
            values.semanaCompletaParaDescuento === false))
          ? "-"
          : values.noCumpleMetas || 0}
      </td>
      <td className="border border-slate-950 bg-red-100 px-2 py-1.5 text-red-700">
        {values.semanaFutura
          ? "Pendiente"
          : !total && values.semanaLaborada === false
            ? "No laborada"
            : !total && values.semanaCompletaParaDescuento === false
              ? "Semana parcial"
              : puedeGestionarMulta
                ? (
                  <div className="flex min-w-[128px] flex-col items-center gap-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valorInput}
                      disabled={guardando}
                      maxLength={13}
                      pattern="\d+(\.\d{0,2})?"
                      placeholder="0.00"
                      onChange={(event) => {
                        const value = event.target.value;
                        if (!esFormatoValorDescuentoInputValido(value)) return;
                        onCambiarDescuento({
                          vendedor,
                          week,
                          values,
                          value,
                        });
                      }}
                      aria-label={`Valor a descontar de ${vendedor.nombre} en ${week.label}`}
                      className={`w-24 rounded border bg-white px-2 py-1 text-center text-xs font-semibold outline-none focus:ring-2 disabled:opacity-60 ${
                        !valorInputValido
                          ? "border-red-600 text-red-700 focus:ring-red-200"
                          : descuentoEditado
                            ? "border-amber-500 text-amber-800 focus:ring-amber-200"
                            : "border-slate-300 text-red-700 focus:ring-red-200"
                      }`}
                    />
                    <span className="text-[10px] text-slate-500">
                      Sancion: {formatMoney(values.valorMultaCalculado)}
                    </span>
                    {descuentoEditado ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                        Pendiente de guardar
                      </span>
                    ) : null}
                    {(values.descuentoModificado || descuentoEditado) && onRestaurarDescuento ? (
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() =>
                          onRestaurarDescuento({
                            vendedor,
                            week,
                            values,
                          })
                        }
                        className="text-[10px] font-semibold text-emerald-700 underline hover:text-emerald-800 disabled:opacity-60"
                      >
                        Usar sancion
                      </button>
                    ) : null}
                  </div>
                )
                : formatMoney(values.valorDescontar || 0)}
      </td>
    </>
  );
}

function MonthlyHeader() {
  return (
    <>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Ventas Mensuales
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Valor Comision Semanal
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Valor Comision Mensual
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-600 px-2 py-2 text-xs font-black text-white"
      >
        Total Comisiones Semana + Mensual
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-700 px-2 py-2 text-xs font-black text-white"
      >
        Total No Cumple Metas
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-red-800 px-2 py-2 text-xs font-black text-white"
      >
        Total Valor a Descontar
      </th>
      <th
        rowSpan={2}
        className="border border-slate-950 bg-emerald-800 px-2 py-2 text-xs font-black text-white"
      >
        Total a Pagar
      </th>
    </>
  );
}

function MonthlyValues({ values, total = false }) {
  const totalClass = total
    ? "border border-slate-950 bg-red-600 px-2 py-1.5 text-white"
    : "border border-slate-950 px-2 py-1.5 text-red-600";

  return (
    <>
      <td className={totalClass}>{values.ventasTvCelulaMensual || 0}</td>
      <td className={totalClass}>
        {values.valorComisionSemanal
          ? formatCommission(values.valorComisionSemanal)
          : 0}
      </td>
      <td className={totalClass}>
        {values.valorComisionMensual
          ? formatCommission(values.valorComisionMensual)
          : ""}
      </td>
      <td className={totalClass}>
        {values.totalComisionesSemanaMensual
          ? formatCommission(values.totalComisionesSemanaMensual)
          : "0.00"}
      </td>
      <td className="border border-slate-950 bg-blue-700 px-2 py-1.5 text-white">
        {values.totalNoCumpleMetas || 0}
      </td>
      <td className="border border-slate-950 bg-red-800 px-2 py-1.5 font-semibold text-white">
        {formatMoney(values.totalValorDescontar || 0)}
      </td>
      <td className="border border-slate-950 bg-emerald-800 px-2 py-1.5 font-bold text-white">
        {formatMoney(values.totalPagar || 0)}
      </td>
    </>
  );
}

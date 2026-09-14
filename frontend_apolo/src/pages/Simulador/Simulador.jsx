import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Maximize,
  Minimize,
  MonitorPlay,
  Search,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import SolicitudWorkflow from "./SolicitudWorkflow.jsx";

const SALES_OPTIONS = ["Crear solicitud", "Mis solicitudes", "Mis contratos"];
const MOTIVOS_DENEGACION = [
  "El cliente tiene un crédito activo.",
  "El cliente no aplica para esta modalidad de crédito.",
  "El cliente es moroso de UPHONE.",
  "El cliente no aplica por su historial de pagos en UPHONE y CREDITV.",
];
const DEVICE_CATALOG = {
  Infinix: [
    { nombre: "Smart 20 4+4/256GB", precio: "262.00" },
    { nombre: "Hot 70 4+4/256GB", precio: "295.00" },
    { nombre: "Note 60 PRO 8+256", precio: "540.00" },
  ],
  Redmi: [
    { nombre: "Redmi 15C 4GB + 256", precio: "234.00" },
  ],
  Honor: [
    { nombre: "Magic 8 LITE 5G 8GB 256GB", precio: "530.00" },
    { nombre: "X5C PLUS 256GB", precio: "250.00" },
    { nombre: "X6E 8GB/256GB", precio: "320.00" },
    { nombre: "X8D 8GB/256GB", precio: "400.00" },
    { nombre: "X7E 12GB/256GB", precio: "370.00" },
    { nombre: "Honor 600E 24 (8+16) 256", precio: "530.00" },
  ],
  Samsung: [],
};
const PHONE_BRANDS = Object.keys(DEVICE_CATALOG);
const CLIENTES_SIMULADOR = {
  "0999999999": {
    nombres: "CLIENTE",
    apellidos: "DEMO",
    direccion: "Av. Principal 123",
    telefono: "0999999999",
    correo: "cliente.demo@correo.com",
  },
};
const SOLICITUD_PENDIENTE_KEY = "abs:simulador-solicitud-pendiente";
const CLIENTES_GUARDADOS_KEY = "abs:simulador-clientes";
const SOLICITUDES_GUARDADAS_KEY = "abs:simulador-solicitudes";
const CONTRATOS_GUARDADOS_KEY = "abs:simulador-contratos";
const INITIAL_FORM = {
  cedula: "",
  nombres: "",
  apellidos: "",
  direccion: "",
  telefono: "",
  correo: "",
  marca: "",
  modelo: "",
  precio: "",
};
const normalizeCatalogText = (value) => String(value || "").trim().toLocaleUpperCase();
const readStoredObject = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};
const readStoredArray = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};
const guardarClienteSimulador = (cedula, cliente) => {
  const clientes = readStoredObject(CLIENTES_GUARDADOS_KEY);
  clientes[cedula] = cliente;
  localStorage.setItem(CLIENTES_GUARDADOS_KEY, JSON.stringify(clientes));
};
const guardarSolicitudSimulador = (solicitud) => {
  const solicitudes = readStoredArray(SOLICITUDES_GUARDADAS_KEY);
  localStorage.setItem(
    SOLICITUDES_GUARDADAS_KEY,
    JSON.stringify([solicitud, ...solicitudes].slice(0, 250))
  );
};
const resolverResultadoSolicitud = (solicitud, ahora = Date.now()) => {
  const fechaDecision = solicitud.decisionAt || solicitud.expiresAt;
  if (
    solicitud.estado === "SOLICITUD_PENDIENTE_AGENTE" &&
    fechaDecision &&
    fechaDecision <= ahora
  ) {
    return {
      ...solicitud,
      estado: solicitud.resultadoSimulado || "SOLICITUD_APROBADA",
    };
  }
  return solicitud;
};
const getCatalogForBrand = (brand) => {
  const brandKey = PHONE_BRANDS.find(
    (catalogBrand) => normalizeCatalogText(catalogBrand) === normalizeCatalogText(brand)
  );
  return DEVICE_CATALOG[brandKey] || [];
};

function UphoneLogo({ muted = false }) {
  return (
    <div
      className={`select-none text-4xl font-black tracking-[-0.08em] sm:text-5xl ${
        muted ? "opacity-45" : ""
      }`}
      aria-label="UPHONE"
    >
      <span className="text-green-600">U</span>
      <span className="text-black">PH</span>
      <span className="relative inline-block text-black">
        O<span className="absolute left-2 top-0 text-3xl text-green-600 sm:left-3 sm:text-4xl">✓</span>
      </span>
      <span className="text-black">NE</span>
    </div>
  );
}

function LoginSimulador({ onIngresar }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const submit = (event) => {
    event.preventDefault();
    onIngresar({ usuario, perfil: "Vendedor" });
  };

  return (
    <div className="relative min-h-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-4 bg-[#3d3549]" />
      <div className="pointer-events-none absolute -left-20 top-24 h-64 w-64 rotate-12 rounded-[3rem] border-4 border-green-100 opacity-50" />
      <div className="pointer-events-none absolute -right-24 bottom-8 h-72 w-72 rotate-45 rounded-[4rem] border-4 border-green-100 opacity-50" />

      <div className="relative flex min-h-[664px] items-center justify-center p-5 sm:p-10">
        <form
          onSubmit={submit}
          className="w-full max-w-xl rounded-2xl bg-white px-7 py-10 shadow-[0_8px_28px_rgba(15,23,42,0.28)] sm:px-16"
        >
          <div className="mb-8 flex justify-center">
            <UphoneLogo />
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-500">Usuario</span>
            <input
              type="text"
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
              required
              autoComplete="username"
              className="h-12 w-full border-0 border-b-2 border-green-600 bg-blue-50 px-2 text-lg text-slate-950 outline-none focus:bg-blue-100"
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-500">Contraseña</span>
            <span className="relative block">
              <input
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                className="h-12 w-full border-0 border-b-2 border-green-600 bg-blue-50 px-2 pr-12 text-lg text-slate-950 outline-none focus:bg-blue-100"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700"
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-slate-500">Perfil</span>
            <select className="h-12 w-full border-0 border-b-2 border-green-600 bg-white px-2 text-lg font-semibold text-green-950 outline-none">
              <option>Vendedor</option>
            </select>
          </label>

          <button
            type="submit"
            className="mt-10 flex h-14 w-full items-center justify-between rounded-lg border border-green-600 bg-green-100 px-5 text-lg font-extrabold text-green-600 transition hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-300"
          >
            <span className="inline-flex items-center gap-2"><LogIn size={20} /> Ingresar</span>
            <ChevronRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}

function FieldRow({ label, name, value, onChange, placeholder, type = "text", required = false }) {
  return (
    <label className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded border border-slate-300 bg-white px-3">
      <span className="font-semibold text-green-600">{label}:</span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="min-w-0 border-0 bg-transparent text-right text-slate-700 outline-none placeholder:text-slate-500"
      />
    </label>
  );
}

function ComboRow({ label, name, value, onChange, options, listId, placeholder, required = false }) {
  const [abierto, setAbierto] = useState(false);
  const opcionesFiltradas = options.filter((option) =>
    normalizeCatalogText(option).includes(normalizeCatalogText(value))
  );

  const seleccionar = (option) => {
    onChange({ target: { name, value: option } });
    setAbierto(false);
  };

  return (
    <label className="relative grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded border border-slate-300 bg-white px-3">
      <span className="font-semibold text-green-600">{label}:</span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onFocus={() => setAbierto(true)}
        onClick={() => setAbierto(true)}
        className="min-w-0 border-0 bg-transparent text-left text-slate-700 outline-none placeholder:text-slate-500"
      />
      <button
        type="button"
        onClick={() => setAbierto((current) => !current)}
        className="flex h-10 w-8 items-center justify-center text-slate-400 hover:text-green-700"
        aria-label={`Mostrar opciones de ${label.toLowerCase()}`}
        aria-expanded={abierto}
        aria-controls={listId}
      >
        <ChevronDown size={20} className={`transition ${abierto ? "rotate-180" : ""}`} />
      </button>

      {abierto && (
        <div
          id={listId}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-md border border-slate-300 bg-white py-1 shadow-xl"
          role="listbox"
        >
          {opcionesFiltradas.length > 0 ? (
            opcionesFiltradas.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => seleccionar(option)}
                className={`block w-full px-4 py-2.5 text-left text-sm transition hover:bg-blue-500 hover:text-white ${
                  normalizeCatalogText(option) === normalizeCatalogText(value)
                    ? "bg-blue-500 font-bold text-white"
                    : "text-slate-900"
                }`}
                role="option"
                aria-selected={normalizeCatalogText(option) === normalizeCatalogText(value)}
              >
                {option}
              </button>
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-slate-500">
              Sin coincidencias. Puedes conservar el texto escrito.
            </p>
          )}
        </div>
      )}
    </label>
  );
}

function ModalClienteNuevo({ cedula, onAceptar, onCerrar }) {
  return (
    <div
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cliente-nuevo-titulo"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-lg bg-white text-center shadow-2xl">
        <div className="px-6 pb-7 pt-8 sm:px-10">
          <TriangleAlert
            size={112}
            strokeWidth={1.5}
            className="mx-auto text-red-400"
            aria-hidden="true"
          />
          <h3
            id="modal-cliente-nuevo-titulo"
            className="mt-4 text-3xl font-extrabold text-red-400"
          >
            Crear Solicitud
          </h3>
          <p className="mt-5 text-lg leading-relaxed text-slate-700">
            La cédula <strong>{cedula}</strong> no se encuentra registrada.
            <br />
            ¿Desea registrar un nuevo cliente?
          </p>
          <div className="mt-7 flex justify-center gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-md border border-slate-300 px-5 py-3 font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Corregir cédula
            </button>
            <button
              type="button"
              onClick={onAceptar}
              className="rounded-md border border-green-600 bg-green-100 px-5 py-3 font-semibold text-green-600 transition hover:bg-green-200"
            >
              Aceptar
            </button>
          </div>
        </div>
        <p className="border-t border-slate-200 px-6 py-5 text-base leading-relaxed text-slate-700 sm:px-10">
          Si no desea registrar un nuevo cliente, ingrese nuevamente la cédula.
          <br />
          Si desea registrarlo, complete sus datos en el formulario.
        </p>
      </div>
    </div>
  );
}

function SolicitudPendiente({ solicitud, segundosRestantes }) {
  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = segundosRestantes % 60;
  const contador = `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}`;

  return (
    <section className="relative flex min-h-[640px] w-full flex-col items-center overflow-hidden bg-white px-5 py-8">
      <div className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rotate-45 rounded-[4rem] border-4 border-green-100 opacity-50" />
      <div className="pointer-events-none absolute -right-20 bottom-5 h-72 w-72 rotate-12 rounded-[4rem] border-4 border-green-100 opacity-50" />

      <UphoneLogo />
      <div className="mt-7 h-px w-full bg-slate-300" />

      <div className="relative mt-7 w-full max-w-5xl">
        <h2 className="text-4xl font-black tracking-tight text-green-950 sm:text-5xl">
          SOLICITUD
        </h2>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-6 text-center shadow-lg sm:px-10">
          <p className="text-base leading-relaxed text-slate-800">
            La <strong className="text-green-600">solicitud Nro. {solicitud.numero}</strong> con
            fecha {solicitud.fecha} del cliente
            <br />
            <strong className="text-green-600">{solicitud.cliente}</strong> se encuentra en estado{" "}
            <strong className="text-green-600">SOLICITUD_PENDIENTE_AGENTE</strong>.
          </p>
          <p className="mt-4 text-base text-slate-800">
            Por favor espera a que un Oficial de Crédito revise la solicitud para poder ingresar una nueva.
          </p>

          <div className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-5 py-3">
            <Clock3 size={24} className="text-green-700" aria-hidden="true" />
            <div className="text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-green-700">
                Tiempo para una nueva solicitud
              </p>
              <p className="font-mono text-3xl font-black text-green-950" aria-live="polite">
                {contador}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MisSolicitudesSimulador({ onIrAContratos }) {
  const [solicitudes, setSolicitudes] = useState(() =>
    readStoredArray(SOLICITUDES_GUARDADAS_KEY).map((solicitud) =>
      resolverResultadoSolicitud(solicitud)
    )
  );
  const [busqueda, setBusqueda] = useState("");
  const [porPagina, setPorPagina] = useState(5);
  const [pagina, setPagina] = useState(1);
  const [seleccionada, setSeleccionada] = useState("");
  const [solicitudAbierta, setSolicitudAbierta] = useState(null);

  useEffect(() => {
    const actualizarResultados = () => {
      setSolicitudes((actuales) => {
        let huboCambios = false;
        const actualizadas = actuales.map((solicitud) => {
          const resuelta = resolverResultadoSolicitud(solicitud);
          if (resuelta !== solicitud) huboCambios = true;
          return resuelta;
        });
        if (huboCambios) {
          localStorage.setItem(SOLICITUDES_GUARDADAS_KEY, JSON.stringify(actualizadas));
        }
        return huboCambios ? actualizadas : actuales;
      });
    };
    actualizarResultados();
    const intervalId = window.setInterval(actualizarResultados, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!solicitudAbierta) return;
    const actualizada = solicitudes.find(
      (solicitud) => String(solicitud.numero) === String(solicitudAbierta.numero)
    );
    if (actualizada && actualizada.estado !== solicitudAbierta.estado) {
      setSolicitudAbierta(actualizada);
    }
  }, [solicitudAbierta, solicitudes]);

  const solicitudesFiltradas = useMemo(() => {
    const termino = normalizeCatalogText(busqueda);
    if (!termino) return solicitudes;
    return solicitudes.filter((solicitud) =>
      [solicitud.numero, solicitud.cliente, solicitud.fechaListado, solicitud.estado]
        .some((value) => normalizeCatalogText(value).includes(termino))
    );
  }, [busqueda, solicitudes]);

  const totalPaginas = Math.max(1, Math.ceil(solicitudesFiltradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const solicitudesPagina = solicitudesFiltradas.slice(
    (paginaActual - 1) * porPagina,
    paginaActual * porPagina
  );

  const cambiarBusqueda = (event) => {
    setBusqueda(event.target.value);
    setPagina(1);
  };

  const cambiarCantidad = (event) => {
    setPorPagina(Number(event.target.value));
    setPagina(1);
  };

  const abrirSolicitud = (solicitud) => {
    const resuelta = resolverResultadoSolicitud(solicitud);
    setSeleccionada(String(resuelta.numero));
    setSolicitudAbierta(resuelta);
  };

  const actualizarSolicitud = (actualizada) => {
    const nuevasSolicitudes = solicitudes.map((solicitud) =>
      String(solicitud.numero) === String(actualizada.numero)
        ? { ...solicitud, ...actualizada }
        : solicitud
    );
    setSolicitudes(nuevasSolicitudes);
    setSolicitudAbierta((actual) => ({ ...actual, ...actualizada }));
    localStorage.setItem(SOLICITUDES_GUARDADAS_KEY, JSON.stringify(nuevasSolicitudes));
    if (actualizada.cedula) {
      guardarClienteSimulador(actualizada.cedula, {
        nombres: actualizada.nombres || "",
        apellidos: actualizada.apellidos || "",
        direccion: actualizada.direccion || "",
        telefono: actualizada.telefono || "",
        correo: actualizada.correo || "",
      });
    }
  };

  const finalizarSolicitud = (finalizada) => {
    const restantes = solicitudes.filter(
      (solicitud) => String(solicitud.numero) !== String(finalizada.numero)
    );
    const contratos = readStoredArray(CONTRATOS_GUARDADOS_KEY);
    localStorage.setItem(SOLICITUDES_GUARDADAS_KEY, JSON.stringify(restantes));
    localStorage.setItem(
      CONTRATOS_GUARDADOS_KEY,
      JSON.stringify([finalizada, ...contratos].slice(0, 250))
    );
    localStorage.removeItem(SOLICITUD_PENDIENTE_KEY);
    setSolicitudes(restantes);
    setSolicitudAbierta(null);
    onIrAContratos();
  };

  if (solicitudAbierta) {
    return (
      <SolicitudWorkflow
        solicitud={solicitudAbierta}
        onAtras={() => setSolicitudAbierta(null)}
        onActualizar={actualizarSolicitud}
        onFinalizar={finalizarSolicitud}
      />
    );
  }

  return (
    <section className="relative min-h-[640px] w-full overflow-hidden bg-white px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rotate-45 rounded-[4rem] border-4 border-green-100 opacity-50" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rotate-12 rounded-[4rem] border-4 border-green-100 opacity-50" />

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="flex justify-center"><UphoneLogo /></div>
        <div className="mt-7 h-px bg-slate-300" />
        <h2 className="mt-10 text-4xl font-black tracking-tight text-green-950 sm:text-5xl">
          MIS SOLICITUDES
        </h2>

        <div className="mt-8 rounded-2xl border border-green-600 bg-white/95 p-5 sm:p-8">
          <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-end">
            <label className="flex items-center gap-3 text-base font-medium text-slate-900">
              Mostrar:
              <select
                value={porPagina}
                onChange={cambiarCantidad}
                className="h-12 rounded border border-slate-300 bg-white px-3 font-bold outline-none focus:border-green-600"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </label>

            <label className="flex h-12 overflow-hidden rounded border border-slate-300 bg-white">
              <span className="flex w-14 items-center justify-center border-r border-slate-300 text-slate-700">
                <Search size={25} aria-hidden="true" />
              </span>
              <input
                type="search"
                value={busqueda}
                onChange={cambiarBusqueda}
                placeholder="Ingrese un término a buscar..."
                className="min-w-0 flex-1 px-3 text-base outline-none"
                aria-label="Buscar solicitudes"
              />
            </label>
          </div>

          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="text-blue-800">
                  <th className="px-3 py-3 text-base font-extrabold">Solicitud No</th>
                  <th className="px-3 py-3 text-base font-extrabold">Cliente</th>
                  <th className="px-3 py-3 text-base font-extrabold">Fecha de solicitud</th>
                  <th className="px-3 py-3 text-base font-extrabold">Estado</th>
                  <th className="w-14 px-3 py-3"><span className="sr-only">Seleccionar</span></th>
                </tr>
              </thead>
              <tbody>
                {solicitudesPagina.length > 0 ? (
                  solicitudesPagina.map((solicitud) => (
                    <tr
                      key={solicitud.numero}
                      role="button"
                      tabIndex={0}
                      onClick={() => abrirSolicitud(solicitud)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") abrirSolicitud(solicitud);
                      }}
                      className="cursor-pointer border-b border-slate-200 text-slate-950 transition hover:bg-green-50"
                    >
                      <td className="px-3 py-3 text-base">{solicitud.numero}</td>
                      <td className="px-3 py-3 text-base">{solicitud.cliente}</td>
                      <td className="px-3 py-3 text-base">{solicitud.fechaListado}</td>
                      <td className={`px-3 py-3 text-base font-semibold ${
                        solicitud.estado === "SOLICITUD_APROBADA"
                          ? "text-green-700"
                          : solicitud.estado === "SOLICITUD_DENEGADA"
                            ? "text-red-600"
                            : "text-amber-700"
                      }`}>{solicitud.estado}</td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="radio"
                          name="solicitud-seleccionada"
                          value={solicitud.numero}
                          checked={seleccionada === String(solicitud.numero)}
                          onChange={() => abrirSolicitud(solicitud)}
                          className="h-5 w-5 accent-green-700"
                          aria-label={`Seleccionar solicitud ${solicitud.numero}`}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-3 py-10 text-center text-slate-500">
                      {solicitudes.length === 0
                        ? "Todavía no has creado solicitudes en el simulador."
                        : "No se encontraron solicitudes con ese término."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-4 text-blue-800 sm:flex-row sm:items-center sm:justify-between">
            <p>Página {paginaActual} de {totalPaginas}</p>
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                disabled={paginaActual === 1}
                className="h-9 min-w-9 rounded px-2 disabled:opacity-40"
              >
                ‹
              </button>
              {Array.from({ length: totalPaginas }, (_, index) => index + 1)
                .slice(Math.max(0, paginaActual - 3), Math.max(5, paginaActual + 2))
                .map((numeroPagina) => (
                  <button
                    key={numeroPagina}
                    type="button"
                    onClick={() => setPagina(numeroPagina)}
                    className={`h-9 min-w-9 rounded-full px-2 ${
                      paginaActual === numeroPagina ? "bg-slate-400 text-white" : "text-blue-800"
                    }`}
                  >
                    {numeroPagina}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
                disabled={paginaActual === totalPaginas}
                className="h-9 min-w-9 rounded px-2 disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MisContratosSimulador() {
  const [busqueda, setBusqueda] = useState("");
  const contratos = useMemo(() => readStoredArray(CONTRATOS_GUARDADOS_KEY), []);
  const filtrados = useMemo(() => {
    const termino = normalizeCatalogText(busqueda);
    if (!termino) return contratos;
    return contratos.filter((contrato) =>
      [contrato.numero, contrato.cliente, contrato.cedula, contrato.dispositivo, contrato.estado]
        .some((value) => normalizeCatalogText(value).includes(termino))
    );
  }, [busqueda, contratos]);

  return (
    <section className="relative min-h-[640px] w-full overflow-hidden bg-white px-4 py-8 sm:px-8">
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="flex justify-center"><UphoneLogo /></div>
        <div className="mt-7 h-px bg-slate-300" />
        <h2 className="mt-10 text-4xl font-black tracking-tight text-green-950 sm:text-5xl">
          MIS CONTRATOS
        </h2>
        <div className="mt-8 rounded-2xl border border-green-600 bg-white p-5 sm:p-8">
          <label className="flex h-12 overflow-hidden rounded border border-slate-300 bg-white">
            <span className="flex w-14 items-center justify-center border-r border-slate-300"><Search size={24} /></span>
            <input type="search" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar contrato aprobado..." className="min-w-0 flex-1 px-3 outline-none" />
          </label>
          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="text-blue-800"><tr><th className="px-3 py-3">Contrato No</th><th className="px-3 py-3">Cliente</th><th className="px-3 py-3">Cédula</th><th className="px-3 py-3">Dispositivo</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Estado</th></tr></thead>
              <tbody>
                {filtrados.length > 0 ? filtrados.map((contrato) => (
                  <tr key={contrato.numero} className="border-b border-slate-200">
                    <td className="px-3 py-4">{contrato.numero}</td>
                    <td className="px-3 py-4">{contrato.cliente}</td>
                    <td className="px-3 py-4">{contrato.cedula}</td>
                    <td className="px-3 py-4">{contrato.dispositivo}</td>
                    <td className="px-3 py-4">{contrato.descripcionPlan || contrato.plan || ""}</td>
                    <td className="px-3 py-4 font-bold text-green-700">CONTRATO_APROBADO</td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" className="px-3 py-12 text-center text-slate-500">No existen contratos aprobados en el simulador.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function SolicitudSimulador() {
  const [cedulaBusqueda, setCedulaBusqueda] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [mensajeError, setMensajeError] = useState(false);
  const [clienteNoEncontrado, setClienteNoEncontrado] = useState(false);
  const [duracionEspera, setDuracionEspera] = useState(60);
  const [resultadoSimulado, setResultadoSimulado] = useState("SOLICITUD_APROBADA");
  const [motivoDenegacion, setMotivoDenegacion] = useState(MOTIVOS_DENEGACION[0]);
  const [form, setForm] = useState({ ...INITIAL_FORM });
  const [solicitudPendiente, setSolicitudPendiente] = useState(() => {
    try {
      const guardada = JSON.parse(localStorage.getItem(SOLICITUD_PENDIENTE_KEY));
      return guardada?.expiresAt > Date.now() ? guardada : null;
    } catch {
      return null;
    }
  });
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  useEffect(() => {
    if (!solicitudPendiente) return undefined;

    const actualizarContador = () => {
      const restantes = Math.max(
        0,
        Math.ceil((solicitudPendiente.expiresAt - Date.now()) / 1000)
      );
      setSegundosRestantes(restantes);

      if (restantes === 0) {
        const solicitudes = readStoredArray(SOLICITUDES_GUARDADAS_KEY).map((solicitud) =>
          String(solicitud.numero) === String(solicitudPendiente.numero)
            ? resolverResultadoSolicitud(solicitud)
            : solicitud
        );
        localStorage.setItem(SOLICITUDES_GUARDADAS_KEY, JSON.stringify(solicitudes));
        localStorage.removeItem(SOLICITUD_PENDIENTE_KEY);
        setSolicitudPendiente(null);
        setForm({ ...INITIAL_FORM });
        setCedulaBusqueda("");
        setMensaje("");
      }
    };

    actualizarContador();
    const intervalId = window.setInterval(actualizarContador, 1000);
    return () => window.clearInterval(intervalId);
  }, [solicitudPendiente]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setMensaje("");
    setMensajeError(false);
    setForm((current) => {
      if (name === "marca") {
        return { ...current, marca: value, modelo: "", precio: "" };
      }

      if (name === "modelo") {
        return { ...current, modelo: value };
      }

      return { ...current, [name]: value };
    });
  };

  const buscarCliente = () => {
    const cedula = cedulaBusqueda.trim();
    if (!cedula) {
      setMensaje("Ingresa una cédula para iniciar la búsqueda.");
      setMensajeError(true);
      return;
    }

    const clientesGuardados = readStoredObject(CLIENTES_GUARDADOS_KEY);
    const cliente = clientesGuardados[cedula] || CLIENTES_SIMULADOR[cedula];
    if (cliente) {
      setForm((current) => ({ ...current, cedula, ...cliente }));
      setMensaje("Cliente encontrado. Sus datos fueron completados automáticamente.");
      setMensajeError(false);
      setClienteNoEncontrado(false);
      return;
    }

    setForm({ ...INITIAL_FORM, cedula });
    setMensaje("");
    setMensajeError(false);
    setClienteNoEncontrado(true);
  };

  const buscarClienteConEnter = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    buscarCliente();
  };

  const actualizarCliente = () => {
    if (!form.cedula) {
      setMensaje("Primero busca o registra una cédula.");
      setMensajeError(true);
      return;
    }
    guardarClienteSimulador(form.cedula, {
      nombres: form.nombres,
      apellidos: form.apellidos,
      direccion: form.direccion,
      telefono: form.telefono,
      correo: form.correo,
    });
    setMensaje("Los datos del cliente fueron actualizados en el simulador.");
    setMensajeError(false);
  };

  const crearSolicitud = (event) => {
    event.preventDefault();
    const camposObligatorios = [
      form.cedula,
      form.direccion,
      form.telefono,
      form.correo,
      form.marca,
      form.modelo,
      form.precio,
    ];

    if (camposObligatorios.some((value) => !String(value).trim())) {
      setMensaje("Completa dirección, teléfono, correo y los datos del producto para crear la solicitud.");
      setMensajeError(true);
      return;
    }

    const ahora = new Date();
    const esperaSegundos = Math.min(3600, Math.max(5, Number(duracionEspera) || 60));
    const pendiente = {
      numero: Math.floor(1000000 + Math.random() * 9000000),
      cliente: `${form.nombres} ${form.apellidos}`.trim().toLocaleUpperCase(),
      nombres: form.nombres,
      apellidos: form.apellidos,
      cedula: form.cedula,
      direccion: form.direccion,
      telefono: form.telefono,
      correo: form.correo,
      marca: form.marca,
      modelo: form.modelo,
      dispositivo: `${form.marca} ${form.modelo}`.trim().toLocaleUpperCase(),
      precio: form.precio,
      fecha: new Intl.DateTimeFormat("es-EC", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "America/Guayaquil",
      }).format(ahora),
      fechaListado: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "America/Guayaquil",
      }).format(ahora),
      estado: "SOLICITUD_PENDIENTE_AGENTE",
      resultadoSimulado,
      motivoDenegacion:
        resultadoSimulado === "SOLICITUD_DENEGADA" ? motivoDenegacion : "",
      decisionAt: ahora.getTime() + esperaSegundos * 1000,
      expiresAt: ahora.getTime() + esperaSegundos * 1000,
    };

    guardarClienteSimulador(form.cedula, {
      nombres: form.nombres,
      apellidos: form.apellidos,
      direccion: form.direccion,
      telefono: form.telefono,
      correo: form.correo,
    });
    guardarSolicitudSimulador(pendiente);
    localStorage.setItem(SOLICITUD_PENDIENTE_KEY, JSON.stringify(pendiente));
    setSegundosRestantes(esperaSegundos);
    setSolicitudPendiente(pendiente);
  };

  if (solicitudPendiente) {
    return (
      <SolicitudPendiente
        solicitud={solicitudPendiente}
        segundosRestantes={segundosRestantes}
      />
    );
  }

  return (
    <form onSubmit={crearSolicitud} className="relative w-full max-w-6xl py-6">
      <div className="mb-7 flex justify-center">
        <UphoneLogo />
      </div>
      <div className="mb-8 h-px bg-slate-300" />

      <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_520px] lg:items-end">
        <h2 className="text-4xl font-black tracking-tight text-green-950 sm:text-5xl">
          SOLICITUD
        </h2>
        <label className="grid gap-2 sm:grid-cols-[110px_1fr] sm:items-center">
          <span className="text-lg font-bold leading-tight text-green-950">
            Cédula de identidad:
          </span>
          <span className="flex h-12 overflow-hidden rounded border border-slate-300 bg-white">
            <input
              type="text"
              inputMode="numeric"
              value={cedulaBusqueda}
              onChange={(event) => setCedulaBusqueda(event.target.value)}
              onKeyDown={buscarClienteConEnter}
              maxLength={13}
              className="min-w-0 flex-1 px-3 outline-none"
              aria-label="Cédula de identidad"
            />
            <button
              type="button"
              onClick={buscarCliente}
              className="flex w-14 items-center justify-center text-slate-500 transition hover:bg-green-50 hover:text-green-700"
              aria-label="Buscar cliente"
            >
              <Search size={26} />
            </button>
          </span>
        </label>
      </div>

      <section className="rounded-2xl border border-green-600 bg-white/95 p-5 sm:p-7">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <div className="flex flex-col gap-4 border-b-[6px] border-green-600 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-3xl font-medium text-slate-900">Cliente</h3>
              <button
                type="button"
                onClick={actualizarCliente}
                className="rounded border border-blue-500 px-5 py-2.5 font-medium text-blue-500 transition hover:bg-blue-50"
              >
                Actualizar Cliente
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <p className="px-4 text-base font-medium text-slate-800">
                Cédula: <span className="font-bold text-green-700">{form.cedula}</span>
              </p>
              <FieldRow label="Nombres" name="nombres" value={form.nombres} onChange={updateField} placeholder="Nombres (opcional)" />
              <FieldRow label="Apellidos" name="apellidos" value={form.apellidos} onChange={updateField} placeholder="Apellidos (opcional)" />
              <FieldRow label="Dirección" name="direccion" value={form.direccion} onChange={updateField} placeholder="Dirección" required />
              <FieldRow label="Teléfono" name="telefono" value={form.telefono} onChange={updateField} placeholder="Teléfono" type="tel" required />
              <FieldRow label="Correo" name="correo" value={form.correo} onChange={updateField} placeholder="Correo" type="email" required />
            </div>
          </div>

          <div>
            <div className="border-b-[6px] border-green-600 pb-5">
              <h3 className="text-3xl font-medium text-slate-900">Smart Phone</h3>
            </div>

            <div className="mt-16 space-y-3">
              <ComboRow
                label="Marca"
                name="marca"
                value={form.marca}
                onChange={updateField}
                options={PHONE_BRANDS}
                listId="simulador-marcas"
                placeholder="Escribe o selecciona"
                required
              />
              <ComboRow
                label="Modelo"
                name="modelo"
                value={form.modelo}
                onChange={updateField}
                options={getCatalogForBrand(form.marca).map(({ nombre }) => nombre)}
                listId="simulador-modelos"
                placeholder="Escribe o selecciona"
                required
              />
              <FieldRow label="Precio" name="precio" value={form.precio} onChange={updateField} placeholder="Precio" type="number" required />
            </div>
          </div>
        </div>

        {mensaje && (
          <p
            className={`mt-5 text-center text-sm font-bold ${
              mensajeError ? "text-red-600" : "text-green-700"
            }`}
            role="status"
          >
            {mensaje}
          </p>
        )}

        <div className="mx-auto mt-5 grid w-full max-w-5xl gap-3 sm:grid-cols-[190px_240px_1fr]">
          <label className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <span className="block text-xs font-bold text-slate-500">Tiempo de espera (segundos)</span>
            <input
              type="number"
              min="5"
              max="3600"
              value={duracionEspera}
              onChange={(event) => setDuracionEspera(event.target.value)}
              className="mt-1 w-full border-0 bg-transparent font-bold text-green-700 outline-none"
            />
          </label>
          <label className="rounded-md border border-slate-300 bg-white px-3 py-2">
            <span className="block text-xs font-bold text-slate-500">Resultado de la simulación</span>
            <select
              value={resultadoSimulado}
              onChange={(event) => setResultadoSimulado(event.target.value)}
              className="mt-1 w-full border-0 bg-transparent font-bold text-green-700 outline-none"
            >
              <option value="SOLICITUD_APROBADA">Aprobada</option>
              <option value="SOLICITUD_DENEGADA">Denegada</option>
            </select>
          </label>
          {resultadoSimulado === "SOLICITUD_DENEGADA" && (
            <label className="rounded-md border border-red-200 bg-red-50 px-3 py-2 sm:col-span-3">
              <span className="block text-xs font-bold text-red-600">Motivo de denegación</span>
              <select
                value={motivoDenegacion}
                onChange={(event) => setMotivoDenegacion(event.target.value)}
                className="mt-1 w-full border-0 bg-transparent font-semibold text-red-700 outline-none"
              >
                {MOTIVOS_DENEGACION.map((motivo, index) => (
                  <option key={motivo} value={motivo}>{index + 1}. {motivo}</option>
                ))}
              </select>
            </label>
          )}
          <button
            type="submit"
            className="flex min-h-14 w-full items-center justify-between rounded-md border border-green-600 bg-green-100 px-5 text-lg font-medium text-green-600 transition hover:bg-green-200"
          >
            Crear Solicitud <ChevronRight size={22} />
          </button>
        </div>
      </section>

      {clienteNoEncontrado && (
        <ModalClienteNuevo
          cedula={form.cedula}
          onCerrar={() => {
            setClienteNoEncontrado(false);
            setCedulaBusqueda("");
            setForm({ ...INITIAL_FORM });
          }}
          onAceptar={() => {
            setClienteNoEncontrado(false);
            setMensaje("Completa los datos para registrar al nuevo cliente.");
            setMensajeError(false);
          }}
        />
      )}
    </form>
  );
}

function EscritorioSimulador({ usuario, onSalir }) {
  const [ventasAbierto, setVentasAbierto] = useState(true);
  const [opcionActiva, setOpcionActiva] = useState("");
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const simuladorRef = useRef(null);

  useEffect(() => {
    const actualizarPantallaCompleta = () => {
      setPantallaCompleta(document.fullscreenElement === simuladorRef.current);
    };

    document.addEventListener("fullscreenchange", actualizarPantallaCompleta);
    return () => document.removeEventListener("fullscreenchange", actualizarPantallaCompleta);
  }, []);

  const alternarPantallaCompleta = async () => {
    try {
      if (document.fullscreenElement === simuladorRef.current) {
        await document.exitFullscreen();
      } else {
        await simuladorRef.current?.requestFullscreen();
      }
    } catch {
      setPantallaCompleta(false);
    }
  };

  const salirSimulador = async () => {
    if (document.fullscreenElement === simuladorRef.current) {
      await document.exitFullscreen();
    }
    onSalir();
  };

  return (
    <div
      ref={simuladorRef}
      className={`overflow-hidden border border-slate-300 border-t-8 border-t-[#2d2639] bg-white shadow-sm ${
        pantallaCompleta ? "h-screen min-h-screen rounded-none" : "min-h-[680px] rounded-2xl"
      }`}
    >
      <div
        className={`simulador-escritorio-layout flex ${
          pantallaCompleta ? "h-full min-h-screen" : "min-h-[680px]"
        }`}
      >
        <aside
          className="simulador-escritorio-sidebar flex shrink-0 flex-col text-white"
          style={{ backgroundColor: "#858c8b" }}
        >
          <div className="px-7 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-slate-900 text-3xl font-black text-green-500">
              ✓
            </div>
          </div>

          <nav className="px-4 pb-5">
            <button
              type="button"
              onClick={() => setVentasAbierto((current) => !current)}
              className="flex w-full items-center gap-3 rounded bg-[#343a3a] px-4 py-3 text-left font-bold"
              aria-expanded={ventasAbierto}
            >
              <ShoppingCart size={20} />
              <span className="flex-1">Ventas</span>
              <ChevronDown size={17} className={`transition ${ventasAbierto ? "rotate-180" : ""}`} />
            </button>

            {ventasAbierto && (
              <div
                className="ml-5 border-l border-slate-300 py-1 pl-4"
                style={{ backgroundColor: "#747b7a" }}
              >
                {SALES_OPTIONS.map((opcion) => (
                  <button
                    key={opcion}
                    type="button"
                    onClick={() => setOpcionActiva(opcion)}
                    className={`flex w-full items-center rounded px-3 py-2 text-left text-sm transition ${
                      opcionActiva === opcion
                        ? "bg-white font-medium text-slate-950"
                        : "bg-[#747b7a] font-medium text-white hover:bg-[#666d6c]"
                    }`}
                  >
                    <span className="flex-1">{opcion}</span>
                    {opcionActiva === opcion && <span className="font-bold text-green-600">−</span>}
                  </button>
                ))}
              </div>
            )}
          </nav>

          <div className="mx-4 border-t border-slate-700" />
          <button
            type="button"
            onClick={alternarPantallaCompleta}
            className="mx-4 mt-3 flex items-center gap-3 rounded bg-[#343a3a] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#292e2e]"
          >
            {pantallaCompleta ? <Minimize size={19} /> : <Maximize size={19} />}
            {pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
          </button>
          <button
            type="button"
            onClick={salirSimulador}
            className="mt-auto flex items-center gap-3 px-7 py-5 text-sm font-bold hover:bg-slate-700/20"
          >
            <LogOut size={20} /> Salir
          </button>
        </aside>

        <main className="relative flex min-h-[520px] min-w-0 flex-1 items-center justify-center overflow-x-hidden overflow-y-auto bg-white p-5 sm:p-8">
          <div className="pointer-events-none absolute -right-16 top-20 h-56 w-56 rotate-45 rounded-[3rem] border-4 border-green-100 opacity-50" />
          <div className="pointer-events-none absolute -left-20 bottom-2 h-64 w-64 rotate-12 rounded-[4rem] border-4 border-green-100 opacity-50" />

          {opcionActiva === "Crear solicitud" ? (
            <SolicitudSimulador />
          ) : opcionActiva === "Mis solicitudes" ? (
            <MisSolicitudesSimulador onIrAContratos={() => setOpcionActiva("Mis contratos")} />
          ) : opcionActiva === "Mis contratos" ? (
            <MisContratosSimulador />
          ) : opcionActiva ? (
            <section className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <MonitorPlay size={42} className="mx-auto text-green-600" />
              <p className="mt-4 text-xs font-bold uppercase tracking-widest text-slate-400">Simulador</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">{opcionActiva}</h2>
              <p className="mt-2 text-sm text-slate-500">
                Has seleccionado esta opción desde el menú de Ventas.
              </p>
            </section>
          ) : (
            <div className="relative text-center">
              <UphoneLogo muted />
              <p className="mt-5 text-sm font-semibold text-slate-400">
                Bienvenido{usuario ? `, ${usuario}` : ""}. Selecciona una opción del menú lateral.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function Simulador() {
  const [sesion, setSesion] = useState(null);

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
          Simulador
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">
          Ingreso al sistema
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Practica el ingreso y la navegación sin salir de ABS.
        </p>
      </header>

      {sesion ? (
        <EscritorioSimulador usuario={sesion.usuario} onSalir={() => setSesion(null)} />
      ) : (
        <LoginSimulador onIngresar={setSesion} />
      )}
    </div>
  );
}

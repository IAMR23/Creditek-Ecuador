import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  FileText,
  PhoneCall,
  QrCode,
  Smartphone,
  Upload,
  X,
} from "lucide-react";

const PASOS = [
  "Información del cliente",
  "Elige un plan",
  "Identificación biométrica",
  "Llamada",
  "Activación",
  "Validación",
];

const SEGMENTOS_CLIENTE = {
  DPR: 400,
  "CPR ESPECIAL": 530,
  E1: 320,
  E2: 320,
  "ANT+1": 600,
  "B+5": 600,
  "B-2": 600,
  ANT: 550,
  ANTB5: 600,
};

const PERIODOS_PAGO = {
  Semanal: [
    { cantidad: 13, meses: 3 },
    { cantidad: 26, meses: 6 },
    { cantidad: 39, meses: 9 },
    { cantidad: 52, meses: 12 },
  ],
  Quincenal: [
    { cantidad: 7, meses: 3 },
    { cantidad: 13, meses: 6 },
    { cantidad: 20, meses: 9 },
    { cantidad: 26, meses: 12 },
  ],
  Mensual: [
    { cantidad: 3, meses: 3 },
    { cantidad: 6, meses: 6 },
    { cantidad: 9, meses: 9 },
    { cantidad: 12, meses: 12 },
  ],
};

const formatMoney = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

const calcularEntradaMinima = (precio, cupo, tipoCliente) => {
  const entradaPorCupo = Math.max(0, precio - cupo);
  const entradaObligatoria = ["E1", "E2"].includes(tipoCliente) ? precio * 0.1 : 0;
  return Math.round(Math.max(entradaPorCupo, entradaObligatoria) * 100) / 100;
};

const pdfText = (value) => String(value || "").replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "");

function descargarContratoModelo(solicitud) {
  const lineas = [
    "CONTRATO MODELO - SIMULADOR ABS",
    `Solicitud No: ${solicitud.numero}`,
    `Cliente: ${solicitud.cliente || "Sin nombre registrado"}`,
    `Cedula: ${solicitud.cedula || ""}`,
    `Dispositivo: ${solicitud.dispositivo || ""}`,
    `Precio referencial: ${formatMoney(Number(solicitud.precio) || 0)}`,
    "Documento generado exclusivamente para fines de simulacion.",
  ];
  const comandos = ["BT", "/F1 18 Tf", "50 740 Td"];
  lineas.forEach((linea, index) => {
    if (index > 0) comandos.push("0 -34 Td");
    comandos.push(`(${pdfText(linea)}) Tj`);
  });
  comandos.push("ET");
  const stream = `${comandos.join("\n")}\n`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}endstream`,
  ];
  let contenido = "%PDF-1.4\n";
  const offsets = [0];
  objetos.forEach((objeto, index) => {
    offsets.push(new TextEncoder().encode(contenido).length);
    contenido += `${index + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(contenido).length;
  contenido += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  contenido += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  contenido += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const url = URL.createObjectURL(new Blob([contenido], { type: "application/pdf" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `contrato-modelo-${solicitud.numero}.pdf`;
  enlace.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Stepper({ paso, estadoInicial, puedeAvanzar, onSelect }) {
  return (
    <div className="workflow-stepper pb-2">
      {PASOS.map((nombre, index) => {
        const numero = index + 1;
        const denegado =
          numero === 1 && paso === 1 && estadoInicial === "SOLICITUD_DENEGADA";
        const pasoUnoAprobado =
          numero === 1 && paso === 1 && estadoInicial === "SOLICITUD_APROBADA";
        const completado = numero < paso || pasoUnoAprobado;
        const activo = numero === paso;
        const disponible = numero <= paso || (numero === paso + 1 && puedeAvanzar);
        return (
          <div key={nombre} className="workflow-step min-w-0 text-center">
            {index < PASOS.length - 1 && (
              <span
                className={`workflow-step-line ${numero < paso ? "bg-green-600" : "bg-blue-700"}`}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              onClick={() => disponible && onSelect(numero)}
              disabled={!disponible}
              className="relative z-10 w-full transition hover:-translate-y-0.5 disabled:cursor-default disabled:opacity-50 disabled:hover:translate-y-0"
              aria-label={`Paso ${numero}: ${nombre}`}
              aria-current={activo ? "step" : undefined}
            >
                <div
                  className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl font-black text-white ${
                    denegado
                      ? "bg-red-500 ring-2 ring-red-400 ring-offset-4"
                      : completado
                        ? `bg-green-600 ${activo ? "ring-2 ring-orange-500 ring-offset-4" : ""}`
                        : activo
                          ? "bg-orange-500 ring-2 ring-orange-500 ring-offset-4"
                          : "bg-blue-700"
                  }`}
                >
                  {denegado ? <X size={26} strokeWidth={4} /> : completado ? <Check size={26} strokeWidth={4} /> : numero}
                </div>
              <p className="mt-3 break-words px-1 text-[11px] leading-tight text-slate-500 sm:text-xs">{nombre}</p>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PseudoQr() {
  const cells = Array.from({ length: 225 }, (_, index) => {
    const row = Math.floor(index / 15);
    const col = index % 15;
    const finder =
      ((row < 5 && col < 5) || (row < 5 && col > 9) || (row > 9 && col < 5)) &&
      (row === 0 || row === 4 || col === 0 || col === 4 || (row >= 2 && row <= 3 && col >= 2 && col <= 3));
    return finder || ((row * 7 + col * 11 + row * col) % 5 < 2);
  });

  return (
    <div className="grid h-48 w-48 grid-cols-[repeat(15,1fr)] gap-px border-8 border-white bg-white shadow-md" aria-label="Código QR de simulación">
      {cells.map((active, index) => (
        <span key={index} className={active ? "bg-slate-950" : "bg-white"} />
      ))}
    </div>
  );
}

function Campo({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="font-bold text-green-600">{label}:</span>
      <input
        type={type}
        value={value || ""}
        onChange={onChange}
        required={required}
        className="mt-2 h-12 w-full rounded border border-slate-300 bg-white px-3 text-slate-950 outline-none focus:border-green-600"
      />
    </label>
  );
}

export default function SolicitudWorkflow({ solicitud, onAtras, onActualizar, onFinalizar }) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState({ ...solicitud });
  const [tipoCliente, setTipoCliente] = useState(solicitud.tipoCliente || "DPR");
  const [planSeleccionado, setPlanSeleccionado] = useState("");
  const [entrada, setEntrada] = useState(() =>
    calcularEntradaMinima(
      Number(solicitud.precio) || 0,
      SEGMENTOS_CLIENTE[solicitud.tipoCliente || "DPR"],
      solicitud.tipoCliente || "DPR"
    )
  );
  const [llamadaSolicitada, setLlamadaSolicitada] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [instalando, setInstalando] = useState(false);
  const [contratoGenerado, setContratoGenerado] = useState(false);
  const [foto, setFoto] = useState(null);
  const [fotoUrl, setFotoUrl] = useState("");

  const precio = Number(datos.precio) || 0;
  const cupo = SEGMENTOS_CLIENTE[tipoCliente];
  const entradaMinimaActual = calcularEntradaMinima(precio, cupo, tipoCliente);
  const solicitudAprobada = datos.estado === "SOLICITUD_APROBADA";
  const solicitudDenegada = datos.estado === "SOLICITUD_DENEGADA";
  const puedeAvanzar =
    (paso === 1 && solicitudAprobada) ||
    (paso === 2 && Boolean(planSeleccionado) && Number(entrada) >= entradaMinimaActual) ||
    paso === 3 ||
    (paso === 4 && llamadaSolicitada) ||
    (paso === 5 && progreso >= 100);
  const planes = useMemo(() => {
    const entradaIngresada = Math.max(0, Number(entrada) || 0);
    const entradaMinima = calcularEntradaMinima(precio, cupo, tipoCliente);
    const valorFinanciado = Math.max(0, precio - Math.max(entradaIngresada, entradaMinima));
    const frecuencias = cupo === 600
      ? ["Semanal", "Quincenal", "Mensual"]
      : ["Semanal", "Quincenal"];

    return frecuencias.flatMap((frecuencia) =>
      PERIODOS_PAGO[frecuencia].map(({ cantidad, meses }) => {
        const totalFinanciado = valorFinanciado * (1 + 0.035 * meses);
        return {
          id: `${frecuencia}-${cantidad}`,
          frecuencia,
          cantidad,
          meses,
          entradaMinima,
          cuota: cantidad > 0 ? totalFinanciado / cantidad : 0,
          total: totalFinanciado + Math.max(entradaIngresada, entradaMinima),
        };
      })
    );
  }, [cupo, entrada, precio, tipoCliente]);
  const planActivo = planes.find((plan) => plan.id === planSeleccionado);

  useEffect(() => {
    if (!instalando || progreso >= 100) return undefined;
    const intervalId = window.setInterval(
      () => setProgreso((actual) => Math.min(100, actual + 5)),
      180
    );
    return () => window.clearInterval(intervalId);
  }, [instalando, progreso]);

  useEffect(() => () => {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
  }, [fotoUrl]);

  const actualizarDato = (campo, value) => {
    setDatos((actual) => ({ ...actual, [campo]: value }));
  };

  const seleccionarFoto = (event) => {
    const archivo = event.target.files?.[0] || null;
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    setFoto(archivo);
    setFotoUrl(archivo ? URL.createObjectURL(archivo) : "");
  };

  const finalizar = () => {
    onFinalizar({
      ...datos,
      estado: "CONTRATO_APROBADO",
      plan: planSeleccionado,
      descripcionPlan: planSeleccionado.replace("-", " - "),
      tipoCliente,
      cupo,
      entrada: Number(entrada) || 0,
      finalizadaEn: new Date().toISOString(),
    });
  };

  return (
    <section className="relative min-h-[680px] w-full overflow-hidden bg-white px-4 py-8 sm:px-8">
      <div className="relative mx-auto w-full max-w-6xl">
        <div className="flex justify-center"><span className="text-4xl font-black"><span className="text-green-600">U</span>PHONE</span></div>
        <div className="mt-7 h-px bg-slate-300" />
        <h2 className="mt-8 text-4xl font-black tracking-tight text-green-950 sm:text-5xl">MIS SOLICITUDES</h2>

        <div className="mt-8 rounded-2xl border border-green-600 bg-white p-5 sm:p-8">
          <Stepper
            paso={paso}
            estadoInicial={datos.estado}
            puedeAvanzar={puedeAvanzar}
            onSelect={setPaso}
          />

          {paso === 1 && (
            <div className="mt-6 rounded-2xl border border-slate-300 p-6 sm:p-10">
              <div className="grid gap-8 lg:grid-cols-3">
                <div>
                  <h3 className={`text-2xl font-black ${solicitudDenegada ? "text-red-500" : "text-green-950"}`}>
                    {datos.estado || "SOLICITUD_PENDIENTE_AGENTE"}
                  </h3>
                  <p className="mt-10 text-lg">Solicitud No: {datos.numero}</p>
                  {!solicitudAprobada && (
                    <p className={`mt-6 rounded-lg border p-4 text-sm font-semibold ${
                      solicitudDenegada
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}>
                      {solicitudDenegada
                        ? `Motivo: ${datos.motivoDenegacion || "El cliente no aplica para esta modalidad de crédito."}`
                        : "La solicitud continúa pendiente de revisión. Espera a que termine el contador."}
                    </p>
                  )}
                  {solicitudDenegada && (
                    <p className="mt-3 text-sm font-semibold text-red-600">
                      La solicitud no puede continuar al paso de selección del plan.
                    </p>
                  )}
                </div>
                <div className="space-y-7">
                  <p><strong className="text-green-600">Cliente:</strong><br />{datos.cliente || ""}</p>
                  <p><strong className="text-green-600">Cédula:</strong><br />{datos.cedula}</p>
                  <p><strong className="text-green-600">Fecha de solicitud:</strong><br />{datos.fechaListado}</p>
                  <p><strong className="text-green-600">Dispositivo:</strong><br />{datos.dispositivo}</p>
                  <p><strong className="text-green-600">IMEI:</strong></p>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="font-bold text-green-600">Tipo de cliente:</span>
                    <select
                      value={tipoCliente}
                      onChange={(event) => {
                        setTipoCliente(event.target.value);
                        setPlanSeleccionado("");
                        setEntrada(
                          calcularEntradaMinima(
                            precio,
                            SEGMENTOS_CLIENTE[event.target.value],
                            event.target.value
                          )
                        );
                      }}
                      className="mt-2 h-12 w-full rounded border border-slate-300 bg-white px-3 font-bold text-green-950"
                    >
                      {Object.entries(SEGMENTOS_CLIENTE).map(([segmento, valorCupo]) => (
                        <option key={segmento} value={segmento}>{segmento} - Cupo {formatMoney(valorCupo)}</option>
                      ))}
                    </select>
                  </label>
                  <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-lg font-bold text-green-800">
                    Cupo asignado: {formatMoney(cupo)}
                  </p>
                  <Campo label="Dirección" value={datos.direccion} onChange={(event) => actualizarDato("direccion", event.target.value)} />
                  <Campo label="Teléfono" value={datos.telefono} onChange={(event) => actualizarDato("telefono", event.target.value)} type="tel" />
                  <Campo label="Correo" value={datos.correo} onChange={(event) => actualizarDato("correo", event.target.value)} type="email" />
                </div>
              </div>
              <div className="mt-8 flex flex-wrap justify-between gap-3">
                <button type="button" onClick={onAtras} className="rounded border border-red-400 bg-red-50 px-6 py-3 text-red-500">No aceptar (cliente)</button>
                {solicitudAprobada && (
                  <button type="button" onClick={() => { onActualizar({ ...datos, tipoCliente, cupo }); setPaso(2); }} className="rounded border border-blue-500 px-6 py-3 text-blue-500">Actualizar información y continuar</button>
                )}
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="mt-6 grid gap-7 lg:grid-cols-2">
              <div className="rounded-2xl border border-green-600 p-6">
                <h3 className="text-center text-2xl font-semibold text-green-950">Planes disponibles para {tipoCliente}</h3>
                <p className="mt-2 text-center font-bold text-green-700">Cupo: {formatMoney(cupo)}</p>
                <table className="mt-6 w-full table-fixed text-left">
                  <thead className="text-blue-800">
                    <tr>
                      <th className="w-[26%] text-xs sm:text-sm">Plan / plazo</th>
                      <th className="w-[23%] text-xs sm:text-sm">Entrada mínima</th>
                      <th className="w-[20%] text-xs sm:text-sm">Cuota</th>
                      <th className="w-[23%] text-xs sm:text-sm">Total</th>
                      <th className="w-[8%]" />
                    </tr>
                  </thead>
                  <tbody>
                    {planes.map((plan) => (
                      <tr
                        key={plan.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPlanSeleccionado(plan.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPlanSeleccionado(plan.id);
                          }
                        }}
                        className={`cursor-pointer border-b border-slate-200 transition hover:bg-green-50 ${
                          planSeleccionado === plan.id ? "bg-green-50" : ""
                        }`}
                      >
                        <td className="break-words py-3 pr-2 text-sm">
                          <strong className="uppercase">{plan.frecuencia}</strong><br />
                          {plan.cantidad} {plan.frecuencia === "Semanal" ? "semanas" : plan.frecuencia === "Quincenal" ? "quincenas" : "meses"}<br />
                          <span className="text-xs text-slate-500">Aprox. {plan.meses} meses</span>
                        </td>
                        <td className="break-words pr-2 text-sm">{formatMoney(plan.entradaMinima)}</td>
                        <td className="break-words pr-2 text-sm">{formatMoney(plan.cuota)}</td>
                        <td className="break-words pr-2 text-sm">{formatMoney(plan.total)}</td>
                        <td><input type="radio" name="plan" value={plan.id} checked={planSeleccionado === plan.id} onChange={() => setPlanSeleccionado(plan.id)} className="h-5 w-5 accent-green-700" aria-label={`Seleccionar plan ${plan.frecuencia} de ${plan.cantidad}`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3 className="text-3xl font-extrabold text-red-400">Cupo aprobado: {formatMoney(cupo)}</h3>
                <div className="mt-3 rounded-2xl border border-green-600 p-7 text-center">
                  <p className="text-lg">Valor de entrada mínima: <strong>{formatMoney(entradaMinimaActual)}</strong></p>
                  {["E1", "E2"].includes(tipoCliente) && (
                    <p className="mt-2 text-sm font-bold text-orange-600">Este segmento siempre requiere entrada.</p>
                  )}
                  <label className="mt-5 block text-lg">Valor de entrada:
                    <input type="number" min={entradaMinimaActual} step="0.01" value={entrada} onChange={(event) => setEntrada(event.target.value)} className="mx-auto mt-3 block h-12 w-52 rounded border border-slate-300 px-3 text-center" />
                  </label>
                  <div className="mt-6 space-y-3 border-y border-dashed border-slate-300 py-5 text-left">
                    <p className="flex justify-between gap-3 text-slate-600"><span>Cuota:</span><strong className="text-slate-950">{formatMoney(planActivo?.cuota)}</strong></p>
                    <p className="flex justify-between gap-3 text-slate-600"><span>Número de cuotas:</span><strong className="text-slate-950">{planActivo?.cantidad || "-"}</strong></p>
                    <p className="flex justify-between gap-3 text-slate-600"><span>Valor total a pagar:</span><strong className="text-slate-950">{formatMoney(planActivo?.total)}</strong></p>
                  </div>
                  <button type="button" disabled={!planSeleccionado || Number(entrada) < entradaMinimaActual} onClick={() => setPaso(3)} className="mt-7 rounded border border-green-600 bg-green-100 px-8 py-3 text-green-700 disabled:opacity-40">Seleccionar plan</button>
                </div>
              </div>
            </div>
          )}

          {paso === 3 && (
            <div className="mt-7">
              <h3 className="text-3xl font-semibold text-green-600">Información del cliente</h3>
              <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_220px] lg:items-center">
                <div className="grid gap-6 md:grid-cols-3">
                  <Campo label="Teléfono" value={datos.telefono} onChange={(event) => actualizarDato("telefono", event.target.value)} />
                  <Campo label="Correo" value={datos.correo} onChange={(event) => actualizarDato("correo", event.target.value)} />
                  <Campo label="Dirección" value={datos.direccion} onChange={(event) => actualizarDato("direccion", event.target.value)} />
                </div>
                <div className="flex flex-col items-center"><PseudoQr /><p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><QrCode size={18} /> QR de simulación</p></div>
              </div>
              <div className="mt-10 flex justify-between"><button type="button" onClick={() => setPaso(2)} className="rounded border border-green-600 bg-green-100 px-5 py-3 text-green-700"><ArrowLeft className="inline" size={18} /> Atrás</button><button type="button" onClick={() => { onActualizar({ ...datos, tipoCliente, cupo }); setPaso(4); }} className="rounded border border-green-600 bg-green-100 px-6 py-3 text-green-700">Seguir <ChevronRight className="inline" size={18} /></button></div>
            </div>
          )}

          {paso === 4 && (
            <div className="mx-auto mt-10 max-w-3xl text-center">
              {!llamadaSolicitada ? (
                <button
                  type="button"
                  onClick={() => setLlamadaSolicitada(true)}
                  className="mx-auto flex min-h-16 items-center gap-3 rounded-lg border border-blue-500 px-10 py-4 text-xl font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  <PhoneCall size={26} /> Solicitar llamada
                </button>
              ) : (
                <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-left">
                  <h3 className="text-xl font-bold text-green-800">Solicitud de llamada aprobada</h3>
                  <p className="mt-4 font-semibold text-slate-800">Durante la llamada, el cliente debe indicar:</p>
                  <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
                    <li>Que el crédito es para él.</li>
                    <li>Si se le cobra valor de entrada: <strong>{Number(entrada) > 0 ? "Sí" : "No"}</strong>.</li>
                    <li>El número de una referencia y su parentesco.</li>
                    <li className="font-bold text-red-600">No se hablan valores de alcance.</li>
                  </ul>
                </div>
              )}
              <div className="mt-8 flex justify-between">
                <button type="button" onClick={() => setPaso(3)} className="rounded border border-green-600 bg-green-100 px-5 py-3 text-green-700">Atrás</button>
                {llamadaSolicitada && (
                  <button type="button" onClick={() => setPaso(5)} className="rounded border border-green-600 bg-green-100 px-6 py-3 text-green-700">Continuar</button>
                )}
              </div>
            </div>
          )}

          {paso === 5 && (
            <div className="mx-auto mt-7 max-w-4xl">
              <h3 className="flex items-center gap-3 text-3xl font-semibold text-green-600"><Smartphone /> Activación del dispositivo</h3>
              <ol className="mt-7 space-y-3">
                {["Activar el dispositivo.", "Activar el modo desarrollador.", "Habilitar la depuración USB.", "Conectar el dispositivo al equipo.", "Instalar la aplicación de validación."].map((texto, index) => (
                  <li key={texto} className="flex items-center gap-4 rounded border border-slate-200 p-4"><span className={`flex h-8 w-8 items-center justify-center rounded-full font-bold ${progreso >= (index + 1) * 20 ? "bg-green-600 text-white" : "bg-slate-100 text-slate-500"}`}>{progreso >= (index + 1) * 20 ? <Check size={18} /> : index + 1}</span>{texto}</li>
                ))}
              </ol>
              <div className="mt-7 h-5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-green-600 transition-all" style={{ width: `${progreso}%` }} /></div>
              <p className="mt-2 text-center font-bold text-green-700">{progreso}%</p>
              <button type="button" onClick={() => { setProgreso(0); setInstalando(true); }} className="mx-auto mt-4 block rounded border border-blue-500 px-6 py-3 text-blue-600">Simular conexión e instalación</button>
              <div className="mt-7 flex justify-between"><button type="button" onClick={() => setPaso(4)} className="rounded border border-green-600 bg-green-100 px-5 py-3 text-green-700">Atrás</button><button type="button" disabled={progreso < 100} onClick={() => setPaso(6)} className="rounded border border-green-600 bg-green-100 px-6 py-3 text-green-700 disabled:opacity-40">Continuar</button></div>
            </div>
          )}

          {paso === 6 && (
            <div className="mx-auto mt-7 max-w-4xl">
              <h3 className="text-3xl font-semibold text-green-600">Validación y contrato</h3>
              <div className="mt-7 grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-slate-300 p-6">
                  <FileText size={40} className="text-green-600" />
                  <h4 className="mt-3 text-xl font-bold">Contrato modelo</h4>
                  <button type="button" onClick={() => { descargarContratoModelo(datos); setContratoGenerado(true); }} className="mt-5 inline-flex items-center gap-2 rounded border border-blue-500 px-5 py-3 text-blue-600"><Download size={19} /> Generar contrato</button>
                </div>
                <div className="rounded-xl border border-slate-300 p-6">
                  <Upload size={40} className="text-green-600" />
                  <h4 className="mt-3 text-xl font-bold">Foto de validación</h4>
                  <p className="mt-2 text-sm text-slate-500">La foto solo se muestra temporalmente. No se guarda ni se envía.</p>
                  <input type="file" accept="image/*" onChange={seleccionarFoto} className="mt-4 block w-full text-sm" />
                  {fotoUrl && <img src={fotoUrl} alt="Vista previa temporal" className="mt-4 h-32 w-full rounded object-cover" />}
                </div>
              </div>
              <div className="mt-7 flex justify-between"><button type="button" onClick={() => setPaso(5)} className="rounded border border-green-600 bg-green-100 px-5 py-3 text-green-700">Atrás</button><button type="button" disabled={!contratoGenerado || !foto} onClick={finalizar} className="rounded border border-green-600 bg-green-100 px-6 py-3 text-green-700 disabled:opacity-40">Finalizar solicitud</button></div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

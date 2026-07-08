import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import api from "../../api/client";
import { FaPlus, FaSave, FaTimes } from "react-icons/fa";
import { getHoyLocal } from "../../utils/dateUtils";
import { useAuthUser } from "../../utils/useAuthUser";

const filaVacia = {
  responsable: "",
  detalle: "",
  valor: "",
  formaPago: "",
  recibo: "",
  entidad: "",
  observacion: "",
  guardado: false,
};

const formatearFechaLocal = (fecha) => {
  if (!fecha) return "";
  const partes = String(fecha).slice(0, 10).split("-");
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const normalizarNumeroPositivoTexto = (value) => {
  const texto = String(value ?? "");
  if (texto.includes("-")) return "";

  const normalizado = texto.replace(/,/g, ".");
  const limpio = normalizado.replace(/[^\d.]/g, "");
  const [entero, ...decimales] = limpio.split(".");

  if (!decimales.length) return entero;

  return `${entero}.${decimales.join("").slice(0, 2)}`;
};

const normalizarEnteroPositivoTexto = (value) =>
  String(value || "").replace(/\D/g, "");

const tieneValorNoNegativo = (value) => {
  const texto = String(value ?? "").trim();
  if (texto === "") return false;

  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0;
};

const convertirNumeroDosDecimales = (value) =>
  Number((Number(normalizarNumeroPositivoTexto(value)) || 0).toFixed(2));

export default function MovimientoCaja() {
  const [rows, setRows] = useState([{ ...filaVacia }]);
  const [loading, setLoading] = useState(false);
  const [estadoLoading, setEstadoLoading] = useState(true);
  const [cierreActual, setCierreActual] = useState(null);
  const [fechaCaja, setFechaCaja] = useState(getHoyLocal());
  const denominacionesBase = [
    { denominacion: 100, cantidad: "", total: 0 },
    { denominacion: 50, cantidad: "", total: 0 },
    { denominacion: 20, cantidad: "", total: 0 },
    { denominacion: 10, cantidad: "", total: 0 },
    { denominacion: 5, cantidad: "", total: 0 },
    { denominacion: 1, cantidad: "", total: 0 },
    { denominacion: 0.5, cantidad: "", total: 0 },
    { denominacion: 0.25, cantidad: "", total: 0 },
    { denominacion: 0.1, cantidad: "", total: 0 },
        { denominacion: 0.05, cantidad: "", total: 0 },
    { denominacion: 0.01, cantidad: "", total: 0 },
  ];

  const [detalles, setDetalles] = useState(denominacionesBase);

  let guardado = false;

  const handleCantidadChange = (index, cantidad) => {
    const newDetalles = [...detalles];

    const cantidadNormalizada = normalizarEnteroPositivoTexto(cantidad);
    const cant = Number(cantidadNormalizada) || 0;
    const denom = newDetalles[index].denominacion;

    newDetalles[index].cantidad = cantidadNormalizada;
    newDetalles[index].total = cant * denom;

    setDetalles(newDetalles);
  };

  const filaEsMovimientoValido = (fila) => {
    return (
      fila.detalle?.trim() &&
      tieneValorNoNegativo(fila.valor) &&
      fila.formaPago?.trim()
    );
  };

  const cargarEstadoCierre = async (fecha = fechaCaja) => {
    try {
      setEstadoLoading(true);
      const res = await api.get("/api/contabilidad/cierre-caja/estado", {
        params: { fecha },
      });
      setCierreActual(res.data?.cierre || null);
    } catch (error) {
      console.error(error?.response?.data || error);
    } finally {
      setEstadoLoading(false);
    }
  };

  const cerrarCaja = async () => {
    try {
      if (cierreActual) {
        alert(`La caja del ${formatearFechaLocal(fechaCaja)} ya fue cerrada para este usuario.`);
        return;
      }

      const { isConfirmed } = await Swal.fire({
        title: "Advertencia",
        text: "Esta opcion no puede ser removida. Desea continuar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Continuar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#2563eb",
        cancelButtonColor: "#6b7280",
      });

      if (!isConfirmed) return;

      setLoading(true);

      await Promise.all(
        rows
          .filter((row) => row.id)
          .filter(filaEsMovimientoValido)
          .map((row) =>
            api.put(
              `/api/movimientos/${row.id}`,
              construirPayloadMovimiento(row),
            ),
          ),
      );

      const retirosLimpios = retiros
        .filter(
          (r) =>
            Number(r.monto) > 0 || r.motivo?.trim() || r.autorizadoPor?.trim(),
        )
        .map((r) => ({
          monto: convertirNumeroDosDecimales(r.monto),
          motivo: r.motivo || "",
          autorizadoPor: r.autorizadoPor || "",
        }));

      const denominaciones = detalles
        .filter((d) => d.cantidad > 0)
        .map((d) => ({
          denominacion: d.denominacion,
          cantidad: convertirNumeroDosDecimales(d.cantidad),
          total: convertirNumeroDosDecimales(d.total),
        }));

      const movimientosPendientes = rows
        .filter((row) => !row.id)
        .filter(filaEsMovimientoValido)
        .map((row) => ({
          responsable: row.responsable || "",
          detalle: row.detalle || "",
          entidad: row.entidad || "",
          valor: convertirNumeroDosDecimales(row.valor),
          formaPago: row.formaPago || null,
          recibo: row.recibo ? Number(row.recibo) : null,
          observacion: row.observacion || "",
        }));

      const payload = {
        cierre: {
          fecha: fechaCaja,
          observacion: "Cierre desde sistema",
        },
        denominaciones,
        retiros: retirosLimpios,
        movimientosPendientes,
      };

      const response = await api.post("/api/contabilidad/cierre-caja", payload);

      await Swal.fire("Cierre de caja completado", "", "success");
      setCierreActual(response.data?.cierre || null);

      setRows([{ ...filaVacia }]);
      setRetiros([{ monto: "", motivo: "", autorizadoPor: "" }]);
      setDetalles(denominacionesBase);
    } catch (error) {
      console.error(error?.response?.data || error);
      if (error?.response?.status === 409) {
        setCierreActual(error.response.data?.cierre || { fecha: fechaCaja });
      }
      alert(error?.response?.data?.message || "Error al cerrar caja");
    } finally {
      setLoading(false);
    }
  };

  const mapearMovimientos = (data = []) => {
    if (!data || data.length === 0) {
      return [{ ...filaVacia, guardado: false }];
    }

    const mapped = data.map((item) => ({
      ...item,
      entidad: item.entidad || item.observacion || "",
      observacion: item.entidad ? item.observacion || "" : "",
      recibo: item.recibo || "",
      guardado: true,
    }));

    const ultimaFila = mapped[mapped.length - 1];

    mapped.push({
      ...filaVacia,
      responsable: ultimaFila?.responsable || "",
      recibo: ultimaFila?.recibo ? Number(ultimaFila.recibo) + 1 : "",
      guardado: false,
    });

    return mapped;
  };

  const cargarMovimientos = useCallback(async () => {
    try {
      const res = await api.get("/api/movimientos");

      setRows(mapearMovimientos(res.data.data));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const handleChange = (index, field, value) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[index][field] = value;
      return newRows;
    });
  };

  useEffect(() => {
    cargarMovimientos();
  }, [cargarMovimientos]);

  useEffect(() => {
    cargarEstadoCierre(fechaCaja);
  }, [fechaCaja]);

  const handleFilaKeyDown = (event, index, row) => {
    if (event.key !== "Enter") return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (loading || cierreActual) return;

    event.preventDefault();
    if (row.id) {
      guardarFila(index);
    } else if (index === rows.length - 1) {
      agregarFila();
    }
  };

  const construirPayloadMovimiento = (fila) => ({
    ...fila,
    fecha: fechaCaja,
    valor: convertirNumeroDosDecimales(fila.valor),
    recibo: fila.recibo ? Number(fila.recibo) : null,
    formaPago: fila.formaPago || null,
  });

  const validarFilaMovimiento = (fila) => {
    if (
      !fila.detalle?.trim() ||
      !tieneValorNoNegativo(fila.valor) ||
      !fila.formaPago?.trim()
    ) {
      alert("Debe completar detalle, valor y forma de pago");
      return false;
    }

    return true;
  };

  const guardarFila = async (index) => {
    try {
      const fila = rows[index];

      if (!fila?.id) return;
      if (!validarFilaMovimiento(fila)) return;

      if (cierreActual) {
        alert(`La caja del ${formatearFechaLocal(fechaCaja)} ya fue cerrada para este usuario.`);
        return;
      }

      setLoading(true);

      await api.put(
        `/api/movimientos/${fila.id}`,
        construirPayloadMovimiento(fila),
      );

      await cargarMovimientos();
      Swal.fire({
        icon: "success",
        title: "Movimiento actualizado",
        timer: 900,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error?.response?.data || error);
      if (error?.response?.status === 409) {
        setCierreActual({ fecha: fechaCaja });
      }
      alert(error?.response?.data?.message || "Error al actualizar movimiento");
    } finally {
      setLoading(false);
    }
  };

  const agregarFila = async () => {
    try {
      const ultimaFila = rows[rows.length - 1];

      if (!validarFilaMovimiento(ultimaFila)) return;

      if (cierreActual) {
        alert(`La caja del ${formatearFechaLocal(fechaCaja)} ya fue cerrada para este usuario.`);
        return;
      }

      setLoading(true);

      await api.post(
        "/api/movimientos",
        construirPayloadMovimiento(ultimaFila),
      );

      await cargarMovimientos();
    } catch (error) {
      console.error(error?.response?.data || error);
      if (error?.response?.status === 409) { 
        setCierreActual({ fecha: fechaCaja });
      }
      alert(error?.response?.data?.message || error?.response?.data?.msg || "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const eliminarFila = async (index) => {
    const fila = rows[index];

    try {
      if (fila.id) {
        await api.delete(`/api/movimientos/${fila.id}`);
      }

      await cargarMovimientos();
    } catch (error) {
      console.error("Error al eliminar fila:", error);
      alert("No se pudo eliminar la fila");
    }
  };

  const totales = rows.reduce(
    (acc, row) => {
      const valor = Number(row.valor) || 0;

      const forma = row.formaPago || "NINGUNO";

      if (forma === "EFECTIVO") {
        acc.efectivo += valor;
      } else if (forma === "TRANSFERENCIA") {
        acc.transferencia += valor;
      } else if (forma === "PENDIENTE") {
        acc.pendiente += valor;
      }

      return acc;
    },
    {
      efectivo: 0,
      transferencia: 0,
      pendiente: 0,
    },
  );

  const totalDenominaciones = detalles.reduce((acc, d) => acc + d.total, 0);

  // Totales combinados
  const totalET = totales.efectivo + totales.transferencia;
  const totalGeneral = totalET + totales.pendiente;

  const resumenDetalle = rows.reduce((acc, row) => {
    const valor = Number(row.valor) || 0;

    if (!row.detalle || !row.formaPago) return acc;

    const key = `${row.detalle.toLowerCase()}_${row.formaPago.toLowerCase()}`;

    acc[key] = (acc[key] || 0) + valor;

    return acc;
  }, {});

  const resumenArray = [
    {
      key: "cuota_efectivo",
      label: "Cuota Efectivo",
      value: resumenDetalle.cuota_efectivo,
    },
    {
      key: "cuota_transferencia",
      label: "Cuota Transferencia",
      value: resumenDetalle.cuota_transferencia,
    },
    {
      key: "contado_efectivo",
      label: "Contado Efectivo",
      value: resumenDetalle.contado_efectivo,
    },
    {
      key: "contado_transferencia",
      label: "Contado Transferencia",
      value: resumenDetalle.contado_transferencia,
    },
    {
      key: "entrada_efectivo",
      label: "Entrada Efectivo",
      value: resumenDetalle.entrada_efectivo,
    },
    {
      key: "entrada_transferencia",
      label: "Entrada Transferencia",
      value: resumenDetalle.entrada_transferencia,
    },
    {
      key: "entrada_pendiente",
      label: "Entrada Pendiente",
      value: resumenDetalle.entrada_pendiente,
    },
    {
      key: "alcance_efectivo",
      label: "Alcance Efectivo",
      value: resumenDetalle.alcance_efectivo,
    },
    {
      key: "alcance_transferencia",
      label: "Alcance Transferencia",
      value: resumenDetalle.alcance_transferencia,
    },
  ];

  const [retiros, setRetiros] = useState([
    { monto: "", motivo: "", autorizadoPor: "" },
  ]);

  const totalRetiros = retiros.reduce(
    (acc, r) => acc + (Number(r.monto) || 0),
    0,
  );

  const user = useAuthUser();
  const agencia = user?.agenciaPrincipal?.nombre || "Agencia Desconocida";

  return (
    <div className=" flex justify-between flex-row gap-2 items-start p-4">
      <div className="flex flex-col border">
        <div>
          <h2 className="text-xl font-bold mb-2 uppercase ">
            CUADRE DE CAJA AGENCIA {agencia}{" "}
          </h2>
        </div>

        <h3 className="font-bold ">
          Conteo de Efectivo (${totalDenominaciones.toFixed(2)})
        </h3>

        <div className="border rounded-lg shadow-lg overflow-hidden m-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Denominación</th>
                <th className="p-2 text-left">Cantidad</th>
                <th className="p-2 text-left">Total</th>
              </tr>
            </thead>

            <tbody>
              {detalles.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">${d.denominacion}</td>

                  <td className="p-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="border p-1 w-full"
                      value={d.cantidad}
                      onChange={(e) => handleCantidadChange(i, e.target.value)}
                    />
                  </td>

                  <td className="p-2 font-semibold">${d.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-center  flex-col gap-2 ">
        <div className="flex justify-between p-2">
          <h2 className="text-xl font-bold ">Movimiento de Caja</h2>
          <input
            type="date"
            value={fechaCaja}
            onChange={(e) => setFechaCaja(e.target.value || getHoyLocal())}
            className="border"
          />
        </div>
        {estadoLoading && (
          <div className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Validando estado de cierre...
          </div>
        )}
        {!estadoLoading && cierreActual && (
          <div className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            La caja del {formatearFechaLocal(cierreActual.fecha || fechaCaja)} ya fue cerrada.
            No se pueden agregar movimientos ni generar otro cierre.
          </div>
        )}
        <div className="border p-3 w-fit ">
          <h3 className="font-bold mb-2">Resumen</h3>

          <div className="flex flex-wrap gap-4 text-sm items-center">
            <div>
              Efectivo: <strong>${totales.efectivo.toFixed(2)}</strong>
            </div>
            <div>
              Transferencia:{" "}
              <strong>${totales.transferencia.toFixed(2)}</strong>
            </div>
            <div>
              Pendiente: <strong>${totales.pendiente.toFixed(2)}</strong>
            </div>
            <div className="font-semibold">
              Efectivo + Transferencia: ${totalET.toFixed(2)}
            </div>
            <div className="font-bold">
              Total General: ${totalGeneral.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="border p-3 w-fit ">
          <h3 className="font-bold mb-2">Resumen por Tipo</h3>

          <div className="flex flex-wrap gap-6 text-sm">
            {resumenArray.map((item) => (
              <div key={item.key} className="flex flex-col">
                <span className="text-gray-500">{item.label}</span>
                <span className="font-semibold">
                  ${(item.value || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* TABLA */}
        <div className="overflow-auto border p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold">Registros de movimiento</h3>
              <p className="text-xs text-gray-500">
                Puedes editar los registros abiertos; al cerrar caja se enviara todo lo visible.
              </p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th>Item</th>
                <th>Responsable</th>
                <th>Detalle</th>
                <th>Valor</th>
                <th>Forma Pago</th>
                <th>Recibo</th>
                <th>Cliente</th>
                <th>Observación</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody className="">
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  <td className="p-1">{i + 1}</td>
                  <td>
                    <input
                      disabled={estadoLoading || !!cierreActual}
                      value={row.responsable}
                      onChange={(e) =>
                        handleChange(i, "responsable", e.target.value)
                      }
                      onKeyDown={(e) => handleFilaKeyDown(e, i, row)}
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <select
                      disabled={estadoLoading || !!cierreActual}
                      value={row.detalle}
                      onChange={(e) =>
                        handleChange(i, "detalle", e.target.value)
                      }
                      onKeyDown={(e) => handleFilaKeyDown(e, i, row)}
                      className="w-full p-1"
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="CUOTA">CUOTA</option>
                      <option value="ENTRADA">ENTRADA</option>
                      <option value="ALCANCE">ALCANCE</option>
                      <option value="CREDITO">CREDITO</option>
                      <option value="CONTADO">CONTADO</option>
                      <option value="CANCELA_ENTRADA_PEND">
                        CANCELA ENTRADA PEND.
                      </option>
                      <option value="CANCELA_ALCANCE_PEND">
                        CANCELA ALCANCE PEND.
                      </option>
                      <option value="EGRESO">EGRESO</option>
                      <option value="TARJETA DE CREDITO">
                        TARJETA DE CREDITO
                      </option>
                    </select>
                  </td>

                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.valor}
                      onChange={(e) =>
                        handleChange(
                          i,
                          "valor",
                          normalizarNumeroPositivoTexto(e.target.value),
                        )
                      }
                      onKeyDown={(e) => handleFilaKeyDown(e, i, row)}
                      className="w-full p-1"
                      disabled={estadoLoading || !!cierreActual}
                    />
                  </td>

                  <td>
                    <select
                      value={row.formaPago}
                      onChange={(e) =>
                        handleChange(i, "formaPago", e.target.value)
                      }
                      onKeyDown={(e) => handleFilaKeyDown(e, i, row)}
                      className="w-full p-1"
                      disabled={estadoLoading || !!cierreActual}
                    >
                      <option value="">-- Seleccionar --</option>
                      <option value="EFECTIVO">EFECTIVO</option>
                      <option value="TRANSFERENCIA">TRANSFERENCIA</option>
                      <option value="PENDIENTE">PENDIENTE</option>
                    </select>
                  </td>

                  <td>
                    <input
                      disabled={estadoLoading || !!cierreActual}
                      type="number"
                      value={row.recibo}
                      onChange={(e) =>
                        handleChange(i, "recibo", e.target.value)
                      }
                      onKeyDown={(e) => handleFilaKeyDown(e, i, row)}
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <input
                      disabled={estadoLoading || !!cierreActual}
                      value={row.entidad}
                      onChange={(e) =>
                        handleChange(i, "entidad", e.target.value)
                      }
                      onKeyDown={(e) => handleFilaKeyDown(e, i, row)}
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <input
                      disabled={estadoLoading || !!cierreActual}
                      value={row.observacion}
                      onChange={(e) =>
                        handleChange(i, "observacion", e.target.value)
                      }
                      onKeyDown={(e) => handleFilaKeyDown(e, i, row)}
                      className="w-full p-1"
                    />
                  </td>

                  <td className="flex justify-center items-center p-2 gap-2">
                    <button
                      onClick={() => (row.id ? guardarFila(i) : agregarFila())}
                      disabled={
                        loading ||
                        estadoLoading ||
                        !!cierreActual ||
                        (!row.id && i !== rows.length - 1)
                      }
                      className={`text-white p-2 disabled:bg-gray-400 ${
                        row.id ? "bg-blue-600" : "bg-green-500"
                      }`}
                      title={row.id ? "Actualizar fila" : "Agregar movimiento"}
                    >
                      {loading ? "Guardando..." : row.id ? <FaSave /> : <FaPlus />}
                    </button>
                    <button
                      onClick={() => eliminarFila(i)}
                      disabled={loading || estadoLoading || !!cierreActual}
                      className="text-white bg-red-600 p-2 disabled:bg-gray-400"
                      title="Eliminar movimiento"
                    >
                      <FaTimes />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border p-3 bg-red-50">
          <h3 className="font-bold mb-2">
            Retiros de Caja - Total: ${totalRetiros.toFixed(2)}
          </h3>

          <table className="w-full text-sm">
            <thead className="bg-red-200">
              <tr>
                <th>#</th>
                <th>Monto</th>
                <th>Motivo</th>
                <th>Autorizado por</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {retiros.map((r, i) => (
                <tr key={i} className="border-t">
                  <td>{i + 1}</td>

                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={r.monto}
                      onChange={(e) => {
                        const newData = [...retiros];
                        newData[i].monto = normalizarNumeroPositivoTexto(e.target.value);
                        setRetiros(newData);
                      }}
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <input
                      value={r.motivo}
                      onChange={(e) => {
                        const newData = [...retiros];
                        newData[i].motivo = e.target.value;
                        setRetiros(newData);
                      }}
                      className="w-full p-1"
                    />
                  </td>

                  <td>
                    <input
                      value={r.autorizadoPor}
                      onChange={(e) => {
                        const newData = [...retiros];
                        newData[i].autorizadoPor = e.target.value;
                        setRetiros(newData);
                      }}
                      className="w-full p-1"
                    />
                  </td>

                  <td className="flex justify-center items-center p-2 gap-2">
                    <button
                      onClick={() =>
                        setRetiros([
                          ...retiros,
                          { monto: "", motivo: "", autorizadoPor: "" },
                        ])
                      }
                      className="bg-green-500 text-white p-2"
                    >
                      <FaPlus />
                    </button>

                    <button
                      onClick={() =>
                        setRetiros(retiros.filter((_, index) => index !== i))
                      }
                      className="text-white bg-red-600 p-2"
                    >
                      <FaTimes />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col justify-end h-full">
          <button
            onClick={cerrarCaja}
            disabled={loading || estadoLoading || !!cierreActual}
            className="bg-blue-600 text-white px-6 py-2 self-end disabled:bg-gray-400"
          >
            {loading ? "Cerrando..." : "Cerrar Caja"}
          </button>
        </div>
      </div>
    </div>
  );
}

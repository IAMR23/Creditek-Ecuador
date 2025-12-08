import { useState, useEffect } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { API_URL } from "../../../../config";
import Swal from "sweetalert2";

export default function VentaEditor() {
  const { id } = useParams();
  const [form, setForm] = useState(null);

  // Traer la venta
  useEffect(() => {
    const fetchVenta = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/vendedor/venta/${id}`);
        if (data.ok) setForm(data.venta);
      } catch (error) {
        console.error(error);
      }
    };
    fetchVenta();
  }, [id]);

  if (!form)
    return <p className="text-green-600 font-semibold">Cargando venta...</p>;

  const handleNestedChange = (path, value) => {
    setForm((prev) => {
      const copy = { ...prev };
      let obj = copy;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
      return copy;
    });
  };

  const handleDetalleChange = (index, field, value) => {
    const nuevosDetalles = [...form.detalleVenta];
    nuevosDetalles[index][field] = value;
    setForm((prev) => ({ ...prev, detalleVenta: nuevosDetalles }));
  };

  const handleObsequioChange = (index, field, value) => {
    const nuevosObsequios = [...form.obsequiosVenta];
    nuevosObsequios[index][field] = value;
    setForm((prev) => ({ ...prev, obsequiosVenta: nuevosObsequios }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await axios.put(`${API_URL}/vendedor/venta/${form.id}`, form);

      await Swal.fire({
        icon: "success",
        title: "Venta actualizada",
        text: "Venta actualizada correctamente",
      });
    } catch (error) {
      console.error(error);

      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Error al actualizar la venta",
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-green-50 rounded-xl shadow-lg mt-6">
      <div className="grid md:grid-cols-2 gap-4 ">
        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <label className="block font-semibold text-green-700">Vendedor</label>
          <input
            type="text"
            className="w-full p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-100"
            value={form.usuarioAgencia.usuario.nombre}
            readOnly
          />
        </div>
        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <label className="block font-semibold text-green-700">Agencia</label>
          <input
            type="text"
            className="w-full p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-100"
            value={form.usuarioAgencia.agencia.nombre}
            readOnly
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-3xl font-bold text-green-600 border-b-2 border-green-500 pb-2">
          Editar Venta
        </h2>

        {/* Cliente */}
        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <h3 className="text-xl font-semibold text-green-700">Cliente</h3>
          <div className="flex flex-col md:flex-row md:space-x-4 space-y-2 md:space-y-0">
            <input
              type="text"
              placeholder="Nombre"
              className="flex-1 p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.cliente.nombre}
              onChange={(e) =>
                handleNestedChange(["cliente", "nombre"], e.target.value)
              }
            />
            <input
              type="text"
              placeholder="Cédula"
              className="flex-1 p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.cliente.cedula}
              onChange={(e) =>
                handleNestedChange(["cliente", "cedula"], e.target.value)
              }
            />
            <input
              type="text"
              placeholder="Teléfono"
              className="flex-1 p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.cliente.telefono}
              onChange={(e) =>
                handleNestedChange(["cliente", "telefono"], e.target.value)
              }
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
            <label className="block font-semibold text-green-700">
              Vendedor
            </label>
            <input
              type="text"
              className="w-full p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.usuarioAgencia.usuario.nombre}
              onChange={(e) =>
                handleNestedChange(
                  ["usuarioAgencia", "usuario", "nombre"],
                  e.target.value
                )
              }
            />
          </div>
          <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
            <label className="block font-semibold text-green-700">
              Agencia
            </label>
            <input
              type="text"
              className="w-full p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.usuarioAgencia.agencia.nombre}
              onChange={(e) =>
                handleNestedChange(
                  ["usuarioAgencia", "agencia", "nombre"],
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* Origen */}
        <div className="bg-green-100 p-4 rounded-lg shadow-inner space-y-2">
          <label className="block font-semibold text-green-700">Origen</label>
          <input
            type="text"
            className="w-full p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            value={form.origen.nombre}
            onChange={(e) =>
              handleNestedChange(["origen", "nombre"], e.target.value)
            }
          />
        </div>

        {/* Detalle de Venta */}
        <div>
          <h3 className="text-2xl font-semibold text-green-600 mb-2">
            Detalle de Venta
          </h3>
          {form.detalleVenta.map((detalle, idx) => (
            <div
              key={detalle.id}
              className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 space-y-2"
            >
              <div className="grid md:grid-cols-3 gap-4">
                <input
                  type="text"
                  className="p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Dispositivo"
                  value={detalle.dispositivoMarca.dispositivo.nombre}
                  onChange={(e) =>
                    handleDetalleChange(
                      idx,
                      "dispositivoNombre",
                      e.target.value
                    )
                  }
                />
                <input
                  type="text"
                  className="p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Marca"
                  value={detalle.dispositivoMarca.marca.nombre}
                  onChange={(e) =>
                    handleDetalleChange(idx, "marcaNombre", e.target.value)
                  }
                />
                <input
                  type="text"
                  className="p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Modelo"
                  value={detalle.modelo.nombre}
                  onChange={(e) =>
                    handleDetalleChange(idx, "modeloNombre", e.target.value)
                  }
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4 mt-2">
                <input
                  type="number"
                  className="p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Precio Unitario"
                  value={detalle.precioUnitario}
                  onChange={(e) =>
                    handleDetalleChange(idx, "precioUnitario", e.target.value)
                  }
                />
                <input
                  type="text"
                  className="p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Forma de Pago"
                  value={detalle.formaPago.nombre}
                  onChange={(e) =>
                    handleDetalleChange(idx, "formaPago", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {/* Obsequios */}
        <div>
          <h3 className="text-2xl font-semibold text-green-600 mb-2">
            Obsequios
          </h3>
          {form.obsequiosVenta.map((ob, idx) => (
            <div
              key={ob.id}
              className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4 grid md:grid-cols-2 gap-4"
            >
              <input
                type="text"
                className="p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Nombre Obsequio"
                value={ob.obsequio.nombre}
                onChange={(e) =>
                  handleObsequioChange(idx, "nombre", e.target.value)
                }
              />
              <input
                type="number"
                className="p-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Cantidad"
                value={ob.cantidad}
                onChange={(e) =>
                  handleObsequioChange(idx, "cantidad", e.target.value)
                }
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition-all"
        >
          Guardar Cambios
        </button>
      </form>
    </div>
  );
}

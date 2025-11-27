export default function VentasTable({ ventas }) {
  return (
    <div className="overflow-x-auto shadow-lg rounded-xl bg-white p-4 transition-all duration-300">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-green-600 text-white">
            <th className="p-3">Agente</th>
            <th className="p-3">Agencia</th>
            <th className="p-3">Producto</th>
            <th className="p-3">Entrada</th>
            <th className="p-3">Alcance</th>
            <th className="p-3">Origen</th>
            <th className="p-3">Fecha</th>
          </tr>
        </thead>

        <tbody>
          {ventas.length === 0 ? (
            <tr>
              <td colSpan="8" className="text-center p-6 text-gray-500">
                No hay ventas registradas.
              </td>
            </tr>
          ) : (
            ventas.map((v) => (
              <tr
                key={v.id}
                className="border-b hover:bg-green-50 transition duration-200"
              >
                <td className="p-3">
                  {v.usuarioAgencia?.usuario?.nombre ?? "N/A"}
                </td>
                <td className="p-3">
                  {v.usuarioAgencia?.agencia?.nombre ?? "N/A"}
                </td>
                <td className="p-3">{v.producto?.nombre ?? "N/A"}</td>
                <td className="p-3">{v.entrada}</td>
                <td className="p-3">{v.alcance}</td>
                <td className="p-3">{v.origen}</td>
                <td className="p-3">
                  {new Date(v.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

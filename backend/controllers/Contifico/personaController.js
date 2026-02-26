const { contificoAPI } = require("../../config/contifico");
const { validarCedula, validarTelefono } = require("../../utils/validaciones");

const buscarClienteContifico = async (cedula) => {
  try {
    const res = await contificoAPI.get("/persona/", {
      params: {
        cedula: cedula,
      },
    });

    return res.data.length ? res.data[0] : null;
  } catch (error) {
    console.error("Error buscando cliente en Contifico:", error.message);
    return null;
  }
};

const crearClienteContifico = async (cliente) => {
  if (!validarCedula(cliente.cedula)) {
    throw new Error("Cédula inválida");
  }

  if (cliente.telefono && !validarTelefono(cliente.telefono)) {
    throw new Error("Teléfono inválido");
  }

  const response = await contificoAPI.post(
    `/persona/?pos=${process.env.API_TOKEN}`,
    {
      tipo: "N",
      razon_social: cliente.cliente,
      nombre_comercial: cliente.cliente,
      cedula: cliente.cedula,
      email: cliente.correo,
      telefonos: cliente.telefono,
      direccion: cliente.direccion,
      es_cliente: true,
      es_proveedor: false,
      es_empleado: false,
      es_vendedor: false,
    },
  );
  return response.data;
};

const actualizarClienteContifico = async (cliente) => {
  try {
    const res = await contificoAPI.put("/persona/", {
      id: cliente.contificoId,
      tipo: "N",
      razon_social: cliente.cliente,
      nombre_comercial: cliente.cliente,
      cedula: cliente.cedula,
      email: cliente.correo,
      telefonos: cliente.telefono,
      direccion: cliente.direccion,
      es_cliente: true,
    });

    return res.data;
  } catch (error) {
    console.error(
      "Error actualizando cliente:",
      error.response?.data || error.message,
    );
    throw error;
  }
};

module.exports = {
  buscarClienteContifico,
  crearClienteContifico,
  actualizarClienteContifico,
};

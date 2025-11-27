import axios from "./axiosConfig";

export const createDepartamento = async (departamentoData) => {
  try {
    const response = await axios.post("/departamento", departamentoData, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "multipart/form-data", // Asegurar que se envíe como formulario con archivos
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error al crear el departamento:", error);
    throw error;
  }
};

export async function obtenerDepartamentosPorArrendador(userId) {
  try {
    console.log("CP1", userId);
    const response = await axios.get(`/departamentos/arrendador/${userId}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error al decodificar el token o al hacer la solicitud:",
      error
    );
    throw new Error("Error al obtener los departamentos");
  }
}

export async function obtenerDepartamento(id) {
  try {
    const response = await axios.get(`/departamentos/${id}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    console.log(response);

    return response;
  } catch (error) {
    console.error(
      "Error al decodificar el token o al hacer la solicitud:",
      error
    );
    throw new Error("Error al obtener los departamentos");
  }
}

export const updateDepartament = async (id, departamentoData) => {
  try {
    console.log("Actualizando departamento con ID:", id);
    
    const response = await axios.patch(`/departamento/${id}`, departamentoData, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "multipart/form-data", // Asegurar envío de archivos
      },
    });
    
    return response.data;
  } catch (error) {
    console.error("Error al actualizar el departamento:", error);
    throw error;
  }
};


/* Admin */

export async function obtenerDepartamentosPorVerificar() {
  try {
    const response = await axios.get(`/departamentos-verificacion`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error al decodificar el token o al hacer la solicitud:",
      error
    );
    console.log(error);
    throw new Error("Error al obtener los departamentos");
  }
}

export async function obtenerDepartamentos() {
  try {
    const response = await axios.get(`/departamentos-disponibles`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(
      "Error al decodificar el token o al hacer la solicitud:",
      error
    );
    console.log(error);
    throw new Error("Error al obtener los departamentos");
  }
}

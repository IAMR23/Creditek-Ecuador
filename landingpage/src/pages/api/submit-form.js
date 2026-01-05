export async function POST({ request }) {
const BACKEND_API_URL = import.meta.env.BACKEND_API_URL;

  try {
    const data = await request.json();

    // 🔹 Función para eliminar campos vacíos
    const clean = (obj) =>
      Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== "" && v !== null)
      );

    // =========================
    // 📌 DATOS PERSONALES
    // =========================
    const datos_personales = clean({
      nombre: data.nombre,
      cedula: data.cedula,
      genero: data.genero,
      edad: data.edad,
      telefono: data.telefono,
      direccion: data.direccion,
      estadoCivil: data.estadoCivil,
      vivienda: data.vivienda,
      estudios: data.estudios,
      hijos: data.hijos,
    });

    // =========================
    // 📌 EXPERIENCIA LABORAL
    // =========================
    const experiencia_laboral = clean({
      trabajo1: clean({
        lugar: data.trabajo1_lugar,
        cargo: data.trabajo1_cargo,
        inicio: data.trabajo1_inicio,
        salida: data.trabajo1_salida,
        razon: data.trabajo1_razon,
        jefe: data.trabajo1_jefe,
        telefono: data.trabajo1_telefono,
      }),
      trabajo2: clean({
        lugar: data.trabajo2_lugar,
        cargo: data.trabajo2_cargo,
        inicio: data.trabajo2_inicio,
        salida: data.trabajo2_salida,
        razon: data.trabajo2_razon,
        jefe: data.trabajo2_jefe,
        telefono: data.trabajo2_telefono,
      }),
      trabajo3: clean({
        lugar: data.trabajo3_lugar,
        cargo: data.trabajo3_cargo,
        inicio: data.trabajo3_inicio,
        salida: data.trabajo3_salida,
        razon: data.trabajo3_razon,
        jefe: data.trabajo3_jefe,
        telefono: data.trabajo3_telefono,
      }),
    });

    // =========================
    // 📌 EVALUACIÓN / PERFIL
    // =========================
    const evaluacion = clean({
      planificacion_semanal: data.planificacion_semanal,
      mejora_rendimiento: data.mejora_rendimiento,
      seguimiento_clientes: data.seguimiento_clientes,
      estrategia_mas_ventas: data.estrategia_mas_ventas,
      indicadores_productividad: data.indicadores_productividad,
      producto_final_valioso: data.producto_final_valioso,
      vision_1_ano: data.vision_1_ano,
      vision_5_anos: data.vision_5_anos,
      jefe_favorito: data.jefe_favorito,
      jefe_menos_favorito: data.jefe_menos_favorito,
    });

    // =========================
    // 📌 PAYLOAD FINAL
    // =========================
    const payload = {
      datos_personales,
      experiencia_laboral,
      evaluacion,
      metadata: {
        fecha_envio: new Date().toLocaleString("sv-SE"),
        origen: "web",
        version_formulario: "v1",
      },
    };

   console.log("PAYLOAD FINAL:", payload);

    await fetch(`${BACKEND_API_URL}/api/postulaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return new Response(JSON.stringify({ success: true, payload }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Error procesando formulario" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

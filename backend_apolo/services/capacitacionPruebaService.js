const TRAINING_TEST_TYPES = {
  piso: {
    label: "Vendedor de piso",
    scopes: ["comun", "piso"],
  },
  call_center: {
    label: "Call Center",
    scopes: ["comun", "call_center"],
  },
};

const QUESTION_BANK = [
  {
    id: "q01",
    scope: "comun",
    question: "Aproximadamente a cuantos meses equivalen 13 semanas?",
    options: [
      { value: "A", text: "3 meses" },
      { value: "B", text: "6 meses" },
      { value: "C", text: "9 meses" },
      { value: "D", text: "12 meses" },
    ],
    answer: "A",
  },
  {
    id: "q02",
    scope: "comun",
    question: "Aproximadamente a cuantos meses equivalen 52 semanas?",
    options: [
      { value: "A", text: "3 meses" },
      { value: "B", text: "6 meses" },
      { value: "C", text: "9 meses" },
      { value: "D", text: "12 meses" },
    ],
    answer: "D",
  },
  {
    id: "q03",
    scope: "comun",
    question: "Aproximadamente a cuantos meses equivalen 20 quincenas?",
    options: [
      { value: "A", text: "3 meses" },
      { value: "B", text: "6 meses" },
      { value: "C", text: "9 meses" },
      { value: "D", text: "12 meses" },
    ],
    answer: "C",
  },
  {
    id: "q04",
    scope: "comun",
    question: "Si el cliente selecciona un plazo de 26 quincenas, que tiempo aproximado tendra el credito?",
    options: [
      { value: "A", text: "6 meses" },
      { value: "B", text: "9 meses" },
      { value: "C", text: "12 meses" },
      { value: "D", text: "18 meses" },
    ],
    answer: "C",
  },
  {
    id: "q05",
    scope: "comun",
    question: "Cual es el cupo asignado al segmento DPR?",
    options: [
      { value: "A", text: "$320" },
      { value: "B", text: "$400" },
      { value: "C", text: "$450" },
      { value: "D", text: "$600" },
    ],
    answer: "B",
  },
  {
    id: "q06",
    scope: "comun",
    question: "Cual es el cupo del segmento CPR Especial para Chillogallo, Sangolqui y Caupicho?",
    options: [
      { value: "A", text: "$400" },
      { value: "B", text: "$450" },
      { value: "C", text: "$530" },
      { value: "D", text: "$600" },
    ],
    answer: "C",
  },
  {
    id: "q07",
    scope: "comun",
    question: "Cual es el cupo del segmento CPR en la tabla general?",
    options: [
      { value: "A", text: "$320" },
      { value: "B", text: "$400" },
      { value: "C", text: "$450" },
      { value: "D", text: "$530" },
    ],
    answer: "C",
  },
  {
    id: "q08",
    scope: "comun",
    question: "Que cupo tienen los segmentos E1 y E2?",
    options: [
      { value: "A", text: "$320" },
      { value: "B", text: "$400" },
      { value: "C", text: "$550" },
      { value: "D", text: "$600" },
    ],
    answer: "A",
  },
  {
    id: "q09",
    scope: "comun",
    question: "Cual es el cupo correspondiente a los clientes del segmento AN1?",
    options: [
      { value: "A", text: "$400" },
      { value: "B", text: "$450" },
      { value: "C", text: "$550" },
      { value: "D", text: "$600" },
    ],
    answer: "C",
  },
  {
    id: "q10",
    scope: "comun",
    question: "Que grupo de segmentos tiene un cupo de $600?",
    options: [
      { value: "A", text: "DPR, CPR y E1" },
      { value: "B", text: "E1, E2 y AN1" },
      { value: "C", text: "AN1+1, B+5, B-2 y AN1B5" },
      { value: "D", text: "DPR, AN1 y CPR" },
    ],
    answer: "C",
  },
  {
    id: "q11",
    scope: "call_center",
    question: "Al iniciar una conversacion por redes sociales, que informacion se debe solicitar?",
    options: [
      { value: "A", text: "Nombre y direccion domiciliaria" },
      { value: "B", text: "Numero de cedula y ciudad" },
      { value: "C", text: "Correo electronico y trabajo" },
      { value: "D", text: "Numero de cuenta bancaria y ciudad" },
    ],
    answer: "B",
  },
  {
    id: "q12",
    scope: "call_center",
    question: "Que datos se ingresan en el sistema para realizar la verificacion?",
    options: [
      { value: "A", text: "Cedula y telefono" },
      { value: "B", text: "Nombre y ciudad" },
      { value: "C", text: "Direccion y correo electronico" },
      { value: "D", text: "Cedula y cuenta bancaria" },
    ],
    answer: "A",
  },
  {
    id: "q13",
    scope: "call_center",
    question: "Si el resultado es denegado, como debe responder el vendedor?",
    options: [
      { value: "A", text: "Insistir en que compre con otra forma de pago" },
      { value: "B", text: "Informarle que vuelva obligatoriamente al dia siguiente" },
      { value: "C", text: "Responder de manera respetuosa y disculparse" },
      { value: "D", text: "Finalizar la conversacion sin explicar nada" },
    ],
    answer: "C",
  },
  {
    id: "q14",
    scope: "call_center",
    question: "Durante la etapa de convencimiento en una venta por redes, que debe hacer el vendedor?",
    options: [
      { value: "A", text: "Enviar todos los modelos disponibles" },
      { value: "B", text: "Enviar el video del producto, llamar al cliente y darle maximo dos opciones" },
      { value: "C", text: "Esperar que el cliente decida sin acompanamiento" },
      { value: "D", text: "Enviar unicamente el precio del producto" },
    ],
    answer: "B",
  },
  {
    id: "q15",
    scope: "call_center",
    question: "Durante el proceso biometrico, que accion es correcta?",
    options: [
      { value: "A", text: "Dejar al cliente solo para que termine el proceso" },
      { value: "B", text: "Enviar unicamente instrucciones escritas" },
      { value: "C", text: "Acompanarlo mediante videollamada y generar confianza" },
      { value: "D", text: "Pedirle que regrese otro dia" },
    ],
    answer: "C",
  },
  {
    id: "q16",
    scope: "piso",
    question: "Que datos se deben solicitar inmediatamente al cliente en una venta de piso?",
    options: [
      { value: "A", text: "Cedula y numero de telefono" },
      { value: "B", text: "Direccion y correo electronico" },
      { value: "C", text: "Referencias personales y laborales" },
      { value: "D", text: "Cuenta bancaria y estado civil" },
    ],
    answer: "A",
  },
  {
    id: "q17",
    scope: "piso",
    question: "Mientras el sistema responde, que debe hacer el vendedor?",
    options: [
      { value: "A", text: "Permanecer en silencio" },
      { value: "B", text: "Atender a otro cliente" },
      { value: "C", text: "Conversar sobre temas cotidianos para generar confianza" },
      { value: "D", text: "Dejar que el cliente espere solo" },
    ],
    answer: "C",
  },
  {
    id: "q18",
    scope: "piso",
    question: "Si el cliente no aplica con su cedula, que respuesta debe utilizarse?",
    options: [
      { value: "A", text: "No puede comprar ningun producto" },
      { value: "B", text: "Regrese cuando tenga una mejor calificacion" },
      { value: "C", text: "Probemos con la cedula de alguien de su confianza" },
      { value: "D", text: "Debe pagar obligatoriamente todo en efectivo" },
    ],
    answer: "C",
  },
  {
    id: "q19",
    scope: "piso",
    question: "Cuando el cliente aplica, como debe mostrarse el celular?",
    options: [
      { value: "A", text: "Mostrar todos los modelos disponibles" },
      { value: "B", text: "Mostrar un solo celular con seguridad y explicar sus caracteristicas reales" },
      { value: "C", text: "Permitir que el cliente lo revise sin explicacion" },
      { value: "D", text: "Ofrecer primero el equipo mas costoso" },
    ],
    answer: "B",
  },
  {
    id: "q20",
    scope: "piso",
    question: "Al confirmar la forma de pago, cuantas opciones como maximo se deben proporcionar?",
    options: [
      { value: "A", text: "Una opcion" },
      { value: "B", text: "Dos opciones" },
      { value: "C", text: "Tres opciones" },
      { value: "D", text: "Todas las opciones disponibles" },
    ],
    answer: "B",
  },
  {
    id: "q21",
    scope: "comun",
    question: "Que es el RVE?",
    options: [
      { value: "A", text: "Un sistema para registrar y controlar ventas, entregas, inventario y desempeno" },
      { value: "B", text: "Una aplicacion utilizada unicamente para emitir facturas" },
      { value: "C", text: "Una plataforma para publicar productos en redes sociales" },
      { value: "D", text: "Un sistema utilizado solamente por contabilidad" },
    ],
    answer: "A",
  },
  {
    id: "q22",
    scope: "comun",
    question: "Cual es una caracteristica del servicio Uphone?",
    options: [
      { value: "A", text: "Requiere obligatoriamente un garante" },
      { value: "B", text: "Permite adquirir un celular a cuotas usando la cedula, sin revisar el buro de credito" },
      { value: "C", text: "Solo permite comprar celulares al contado" },
      { value: "D", text: "Esta disponible unicamente para clientes con tarjeta de credito" },
    ],
    answer: "B",
  },
  {
    id: "q23",
    scope: "comun",
    question: "Que puede suceder si un cliente de Uphone no paga una cuota?",
    options: [
      { value: "A", text: "El celular se elimina del sistema" },
      { value: "B", text: "El vendedor debe pagar la cuota" },
      { value: "C", text: "El celular puede bloquearse temporalmente hasta que el cliente se ponga al dia" },
      { value: "D", text: "El credito se convierte automaticamente en una compra al contado" },
    ],
    answer: "C",
  },
  {
    id: "q24",
    scope: "comun",
    question: "Que permite adquirir CrediTV?",
    options: [
      { value: "A", text: "Computadoras a cuotas" },
      { value: "B", text: "Celulares a cuotas" },
      { value: "C", text: "Televisores a cuotas" },
      { value: "D", text: "Electrodomesticos sin credito" },
    ],
    answer: "C",
  },
  {
    id: "q25",
    scope: "comun",
    question: "Que es una meta de ventas?",
    options: [
      { value: "A", text: "El objetivo que una persona o equipo debe cumplir en un tiempo determinado" },
      { value: "B", text: "La cantidad de productos existentes en inventario" },
      { value: "C", text: "El valor maximo de credito de un cliente" },
      { value: "D", text: "La entrada minima que debe pagar un cliente" },
    ],
    answer: "A",
  },
  {
    id: "q26",
    scope: "comun",
    question: "Que es el proceso de venta?",
    options: [
      { value: "A", text: "El registro contable de una factura" },
      { value: "B", text: "El conjunto de pasos desde la atencion al cliente hasta finalizar la compra" },
      { value: "C", text: "La entrega de volantes fuera del local" },
      { value: "D", text: "El calculo de las comisiones del vendedor" },
    ],
    answer: "B",
  },
  {
    id: "q27",
    scope: "comun",
    question: "Que son los indicadores de gestion?",
    options: [
      { value: "A", text: "Los precios de los productos" },
      { value: "B", text: "Las promociones publicadas en redes sociales" },
      { value: "C", text: "Datos que permiten medir el desempeno y el cumplimiento de las metas" },
      { value: "D", text: "Los valores de entrada solicitados al cliente" },
    ],
    answer: "C",
  },
  {
    id: "q28",
    scope: "comun",
    question: "Que significa enganchar a un cliente?",
    options: [
      { value: "A", text: "Entregar volantes y esperar en la puerta" },
      { value: "B", text: "Esperar que el cliente ingrese por su cuenta" },
      { value: "C", text: "Mostrar los productos sin conversar con el cliente" },
      { value: "D", text: "Acercarse, saludar, comunicar promociones y despertar su interes" },
    ],
    answer: "D",
  },
  {
    id: "q29",
    scope: "comun",
    question: "Cual es el objetivo principal de enganchar?",
    options: [
      { value: "A", text: "Lograr que las personas ingresen al local y se conviertan en posibles clientes" },
      { value: "B", text: "Entregar la mayor cantidad posible de volantes" },
      { value: "C", text: "Obtener inmediatamente los datos personales del cliente" },
      { value: "D", text: "Conseguir que el cliente pague una entrada" },
    ],
    answer: "A",
  },
  {
    id: "q30",
    scope: "comun",
    question: "Que es la entrada en una compra a credito?",
    options: [
      { value: "A", text: "El primer pago que puede realizar el cliente al comprar el producto" },
      { value: "B", text: "Una multa cobrada por solicitar el credito" },
      { value: "C", text: "El valor adicional por superar el cupo aprobado" },
      { value: "D", text: "La primera cuota que se paga despues de un mes" },
    ],
    answer: "A",
  },
  {
    id: "q31",
    scope: "comun",
    question: "La entrada es obligatoria en todos los creditos?",
    options: [
      { value: "A", text: "Si, siempre es obligatoria" },
      { value: "B", text: "Si, pero unicamente para celulares" },
      { value: "C", text: "No, depende del resultado de la evaluacion del credito" },
      { value: "D", text: "No, porque Creditek nunca solicita entradas" },
    ],
    answer: "C",
  },
  {
    id: "q32",
    scope: "comun",
    question: "Que es el alcance?",
    options: [
      { value: "A", text: "El descuento aplicado al precio del producto" },
      { value: "B", text: "La primera cuota del credito" },
      { value: "C", text: "El valor adicional pagado cuando el cupo aprobado no cubre el precio del producto" },
      { value: "D", text: "La comision recibida por el vendedor" },
    ],
    answer: "C",
  },
  {
    id: "q33",
    scope: "comun",
    question: "Cual es la diferencia entre alcance y entrada?",
    options: [
      { value: "A", text: "No existe ninguna diferencia" },
      { value: "B", text: "El alcance cubre la diferencia cuando el cupo es insuficiente y no se considera entrada" },
      { value: "C", text: "La entrada se paga unicamente despues de terminar el credito" },
      { value: "D", text: "El alcance es una cuota atrasada" },
    ],
    answer: "B",
  },
  {
    id: "q34",
    scope: "comun",
    question: "Que es un lead?",
    options: [
      { value: "A", text: "Una persona que ya termino de pagar su credito" },
      { value: "B", text: "Una persona que mostro interes al escribir, comentar, llenar un formulario o dejar sus datos" },
      { value: "C", text: "Un vendedor que supero su meta" },
      { value: "D", text: "Un cliente cuyo credito fue rechazado" },
    ],
    answer: "B",
  },
  {
    id: "q35",
    scope: "comun",
    question: "Para que sirve un CRM?",
    options: [
      { value: "A", text: "Para bloquear los celulares por falta de pago" },
      { value: "B", text: "Para revisar el buro de credito" },
      { value: "C", text: "Para emitir exclusivamente facturas electronicas" },
      { value: "D", text: "Para guardar informacion de clientes, organizar el trabajo y dar seguimiento a las ventas" },
    ],
    answer: "D",
  },
  {
    id: "q36",
    scope: "comun",
    question: "Que se entiende por venta?",
    options: [
      { value: "A", text: "Ofrecer un producto o servicio y lograr que el cliente lo compre a cambio de un pago" },
      { value: "B", text: "Registrar un producto en el inventario" },
      { value: "C", text: "Entregar informacion sin buscar concretar la compra" },
      { value: "D", text: "Realizar unicamente el proceso biometrico" },
    ],
    answer: "A",
  },
  {
    id: "q37",
    scope: "comun",
    question: "Que es el IMEI?",
    options: [
      { value: "A", text: "La contrasena utilizada para ingresar al RVE" },
      { value: "B", text: "El codigo de aprobacion del credito" },
      { value: "C", text: "Un codigo unico de 15 digitos que identifica a un telefono celular" },
      { value: "D", text: "El numero de factura del producto" },
    ],
    answer: "C",
  },
  {
    id: "q38",
    scope: "comun",
    question: "Cuando debe ingresarse el IMEI?",
    options: [
      { value: "A", text: "Cuando el cliente consulta el precio" },
      { value: "B", text: "Al momento de facturar el dispositivo" },
      { value: "C", text: "Despues de pagar todas las cuotas" },
      { value: "D", text: "Antes de verificar la cedula" },
    ],
    answer: "B",
  },
  {
    id: "q39",
    scope: "comun",
    question: "Que es Siggo Contifico?",
    options: [
      { value: "A", text: "Un sistema de publicidad y captacion de clientes" },
      { value: "B", text: "Un sistema administrativo y contable en la nube disenado en Ecuador" },
      { value: "C", text: "Una aplicacion para realizar el biometrico" },
      { value: "D", text: "Un servicio para bloquear celulares" },
    ],
    answer: "B",
  },
  {
    id: "q40",
    scope: "comun",
    question: "Que permite realizar Siggo Contifico?",
    options: [
      { value: "A", text: "Gestionar inventarios, registrar cobros y pagos, y emitir facturas electronicas" },
      { value: "B", text: "Verificar unicamente el numero de cedula" },
      { value: "C", text: "Crear campanas publicitarias" },
      { value: "D", text: "Aprobar automaticamente todos los creditos" },
    ],
    answer: "A",
  },
  {
    id: "q41",
    scope: "comun",
    question: "Cual es la funcion principal del vendedor?",
    options: [
      { value: "A", text: "Entregar el producto sin explicar sus caracteristicas" },
      { value: "B", text: "Limitarse a registrar los datos del cliente" },
      { value: "C", text: "Autorizar los creditos de todos los clientes" },
      { value: "D", text: "Atender, orientar, explicar beneficios, resolver dudas y concretar la venta" },
    ],
    answer: "D",
  },
];

const normalizeTestType = (value) => String(value || "").trim().toLowerCase();
const normalizeLimitedText = (value, maxLength) =>
  String(value || "").trim().slice(0, maxLength);

const sanitizeQuestion = ({ answer: _answer, ...question }) => ({
  ...question,
  options: question.options.map((option) => ({ ...option })),
});

const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const getTrainingTestTypes = () =>
  Object.entries(TRAINING_TEST_TYPES).map(([value, config]) => ({
    value,
    label: config.label,
  }));

const getQuestionsForType = (type) => {
  const normalizedType = normalizeTestType(type);
  const config = TRAINING_TEST_TYPES[normalizedType];

  if (!config) {
    const error = new Error("Debe seleccionar vendedor de piso o call center.");
    error.statusCode = 400;
    throw error;
  }

  return QUESTION_BANK.filter((question) => config.scopes.includes(question.scope));
};

const buildTrainingTest = (type) => {
  const questions = getQuestionsForType(type);
  return {
    tipo: normalizeTestType(type),
    tipoLabel: TRAINING_TEST_TYPES[normalizeTestType(type)].label,
    totalPreguntas: questions.length,
    preguntas: shuffle(questions).map(sanitizeQuestion),
  };
};

const gradeTrainingTest = (payload = {}, user = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("La prueba enviada no es valida.");
    error.statusCode = 400;
    throw error;
  }

  const tipo = normalizeTestType(payload.tipo);
  const questions = getQuestionsForType(tipo);
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const rawQuestionIds = Array.isArray(payload.questionIds)
    ? payload.questionIds
    : questions.map((question) => question.id);
  const questionIds = rawQuestionIds.map((id) => String(id || "").trim());
  const answers = payload.respuestas || {};

  if (!questionIds.length) {
    const error = new Error("La prueba no contiene preguntas para calificar.");
    error.statusCode = 400;
    throw error;
  }

  if (typeof answers !== "object" || Array.isArray(answers)) {
    const error = new Error("Las respuestas enviadas no son validas.");
    error.statusCode = 400;
    throw error;
  }

  const invalidQuestion = questionIds.find((questionId) => !questionsById.has(questionId));
  if (invalidQuestion) {
    const error = new Error("La prueba contiene una pregunta que no corresponde al tipo seleccionado.");
    error.statusCode = 400;
    throw error;
  }

  const detalles = questionIds.map((questionId) => {
    const question = questionsById.get(questionId);
    const respuestaSeleccionada = String(answers[questionId] || "").toUpperCase();

    if (!["A", "B", "C", "D"].includes(respuestaSeleccionada)) {
      const error = new Error("Debe responder todas las preguntas antes de finalizar la prueba.");
      error.statusCode = 400;
      throw error;
    }

    return {
      ...sanitizeQuestion(question),
      respuestaSeleccionada,
      respuestaCorrecta: question.answer,
      correcta: respuestaSeleccionada === question.answer,
    };
  });
  const correctas = detalles.filter((detail) => detail.correcta).length;
  const totalPreguntas = detalles.length;
  const porcentaje = Number(((correctas / totalPreguntas) * 100).toFixed(2));
  const now = new Date().toISOString();

  return {
    version: "prueba-capacitacion-v1",
    tipo,
    tipoLabel: TRAINING_TEST_TYPES[tipo].label,
    totalPreguntas,
    correctas,
    incorrectas: totalPreguntas - correctas,
    porcentaje,
    notaSobre10: Number((porcentaje / 10).toFixed(2)),
    aprobado: porcentaje >= 70,
    evaluador: normalizeLimitedText(payload.evaluador, 120),
    detalles,
    creadoAt: now,
    actualizadoAt: now,
    actualizadoPor: {
      id: user.id || null,
      nombre: user.nombre || user.email || "Usuario ABS",
    },
  };
};

module.exports = {
  buildTrainingTest,
  getTrainingTestTypes,
  gradeTrainingTest,
};

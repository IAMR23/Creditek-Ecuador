const TEST_TYPES = {
  piso: "Vendedor de piso",
  call_center: "Call Center",
};

const options = (a, b, c, d) => [
  { value: "A", text: a },
  { value: "B", text: b },
  { value: "C", text: c },
  { value: "D", text: d },
];

const COMMON_QUESTIONS = [
  {
    id: "COMUN_01",
    question: "¿A cuántos meses equivalen aproximadamente 13 semanas?",
    options: options("3 meses", "6 meses", "9 meses", "12 meses"),
    answer: "A",
  },
  {
    id: "COMUN_02",
    question: "¿A cuántos meses equivalen aproximadamente 52 semanas?",
    options: options("3 meses", "6 meses", "9 meses", "12 meses"),
    answer: "D",
  },
  {
    id: "COMUN_03",
    question: "¿A cuántos meses equivalen aproximadamente 20 quincenas?",
    options: options("3 meses", "6 meses", "9 meses", "12 meses"),
    answer: "C",
  },
  {
    id: "COMUN_04",
    question: "¿A cuántos meses equivalen aproximadamente 26 quincenas?",
    options: options("3 meses", "6 meses", "12 meses", "18 meses"),
    answer: "C",
  },
  {
    id: "COMUN_05",
    question: "¿Cuál es el cupo disponible para el segmento DPR?",
    options: options("$320", "$400", "$450", "$600"),
    answer: "B",
  },
  {
    id: "COMUN_06",
    question:
      "En las agencias de Chillogallo, Sangolquí y Caupicho, ¿cuál es el cupo del segmento CPR Especial?",
    options: options("$400", "$450", "$530", "$600"),
    answer: "C",
  },
  {
    id: "COMUN_07",
    question: "¿Cuál es el cupo correcto para los segmentos E1 y E2?",
    options: options("$320", "$400", "$550", "$600"),
    answer: "A",
  },
  {
    id: "COMUN_08",
    question: "¿Cuál es el cupo disponible para el segmento AN1?",
    options: options("$400", "$450", "$550", "$600"),
    answer: "C",
  },
  {
    id: "COMUN_09",
    question: "¿Qué segmentos tienen un cupo de $600?",
    options: options(
      "DPR, CPR y E1",
      "E1, E2 y AN1",
      "AN1+1, B+5, B-2 y AN1B5",
      "CPR Especial, DPR y AN1",
    ),
    answer: "C",
  },
  {
    id: "COMUN_10",
    question: "¿Qué es el RVE dentro del proceso comercial?",
    options: options(
      "Una herramienta para controlar ventas, entregas, inventario y desempeño comercial.",
      "Un sistema utilizado únicamente para registrar asistencia.",
      "Un método para calcular las cuotas del cliente.",
      "Una plataforma utilizada exclusivamente para publicidad.",
    ),
    answer: "A",
  },
  {
    id: "COMUN_11",
    question: "¿Cuál es una característica principal de Uphone?",
    options: options(
      "Solo permite comprar teléfonos pagando al contado.",
      "Permite adquirir un teléfono a cuotas directamente con la cédula, según las condiciones y aprobación disponibles.",
      "Únicamente está disponible para clientes empresariales.",
      "Permite cambiar cualquier aprobación a pagos mensuales.",
    ),
    answer: "B",
  },
  {
    id: "COMUN_12",
    question: "¿Qué permite financiar CrediTV?",
    options: options(
      "Únicamente accesorios para celulares.",
      "Servicios de internet.",
      "Televisores mediante pagos en cuotas, según las condiciones autorizadas.",
      "Vehículos y motocicletas.",
    ),
    answer: "C",
  },
  {
    id: "COMUN_13",
    question: "¿Cuál es el orden correcto de un proceso básico de venta?",
    options: options(
      "Cobrar, verificar al cliente y después presentar el producto.",
      "Saludar, solicitar datos, verificar, conocer la necesidad, presentar opciones, confirmar la forma de pago y cerrar el proceso.",
      "Realizar el biométrico antes de conversar con el cliente.",
      "Entregar el producto antes de verificar la aprobación.",
    ),
    answer: "B",
  },
  {
    id: "COMUN_14",
    question: "¿Qué significa la entrada en una venta a crédito?",
    options: options(
      "Es el pago inicial que puede solicitarse al momento de realizar la compra.",
      "Es el valor total del producto.",
      "Es una cuota adicional que se cobra después de finalizar el crédito.",
      "Es un descuento automático para todos los clientes.",
    ),
    answer: "A",
  },
  {
    id: "COMUN_15",
    question: "¿Qué significa el alcance?",
    options: options(
      "Es lo mismo que la entrada.",
      "Es una multa aplicada por atraso.",
      "Es el valor adicional que debe cubrirse cuando el cupo aprobado no alcanza para pagar el producto seleccionado.",
      "Es un descuento otorgado por el asesor.",
    ),
    answer: "C",
  },
  {
    id: "COMUN_16",
    question: "¿Qué es un lead?",
    options: options(
      "Una venta que ya fue pagada completamente.",
      "Un cliente potencial que ha mostrado interés y cuyos datos pueden utilizarse para darle seguimiento.",
      "Un producto que no se encuentra disponible.",
      "Una cuota vencida.",
    ),
    answer: "B",
  },
  {
    id: "COMUN_17",
    question: "¿Para qué sirve un CRM?",
    options: options(
      "Para registrar únicamente la asistencia de los empleados.",
      "Para bloquear los celulares vendidos.",
      "Para calcular automáticamente el cupo del cliente.",
      "Para organizar la información de los clientes, registrar interacciones y dar seguimiento a oportunidades de venta.",
    ),
    answer: "D",
  },
  {
    id: "COMUN_18",
    question: "¿Qué es el IMEI de un celular?",
    options: options(
      "La contraseña de la cuenta del cliente.",
      "El número de teléfono asignado al equipo.",
      "Un código único, normalmente de 15 dígitos, que identifica al dispositivo.",
      "El nombre comercial del modelo.",
    ),
    answer: "C",
  },
];

const FLOOR_QUESTIONS = [
  {
    id: "PISO_01",
    question:
      "Al recibir a un cliente en el local, ¿qué datos se deben solicitar de inmediato para iniciar la verificación?",
    options: options(
      "Número de cédula y número de teléfono.",
      "Dirección domiciliaria y correo electrónico.",
      "Estado civil y nombre del cónyuge.",
      "Contraseña del correo y redes sociales.",
    ),
    answer: "A",
  },
  {
    id: "PISO_02",
    question: "Mientras el sistema procesa la consulta, ¿qué debe hacer el vendedor de piso?",
    options: options(
      "Dejar solo al cliente hasta que llegue el resultado.",
      "Atender a otro cliente y evitar conversar.",
      "Conversar sobre temas cotidianos para conocerlo mejor, generar confianza e identificar sus necesidades.",
      "Prometerle que será aprobado.",
    ),
    answer: "C",
  },
  {
    id: "PISO_03",
    question: "Si el sistema indica que el cliente no aplica, ¿cómo debe comunicarlo el vendedor?",
    options: options(
      "Informarle que nunca podrá comprar a crédito.",
      "Culpar al cliente por su historial.",
      "Explicarlo con respeto y, si las políticas lo permiten, mencionar alternativas válidas sin garantizar una aprobación.",
      "Modificar el resultado para completar la venta.",
    ),
    answer: "C",
  },
  {
    id: "PISO_04",
    question: "Si el cliente fue aprobado, ¿cómo se debe presentar el celular?",
    options: options(
      "Mostrar todos los teléfonos disponibles al mismo tiempo.",
      "Mostrar una opción adecuada, explicar características reales y mantener el equipo bajo control y seguridad.",
      "Entregar el teléfono para que el cliente salga del local a probarlo.",
      "Presentar únicamente el equipo más costoso.",
    ),
    answer: "B",
  },
  {
    id: "PISO_05",
    question: "Al confirmar la forma de pago, ¿cuántas opciones se recomienda presentar como máximo?",
    options: options(
      "Una opción obligatoria.",
      "Dos opciones claras.",
      "Cinco opciones.",
      "Todas las opciones existentes, aunque no apliquen al cliente.",
    ),
    answer: "B",
  },
];

const CALL_CENTER_QUESTIONS = [
  {
    id: "CALL_CENTER_01",
    question:
      "Al iniciar una conversación por redes o Call Center, ¿qué información debe solicitarse para comenzar la verificación?",
    options: options(
      "Solo el nombre del cliente.",
      "Número de cédula y ciudad desde donde escribe.",
      "Contraseña de sus redes sociales.",
      "Nombre de la empresa donde trabaja.",
    ),
    answer: "B",
  },
  {
    id: "CALL_CENTER_02",
    question: "¿Qué información debe ingresarse en el sistema para verificar al cliente?",
    options: options(
      "Cédula y teléfono.",
      "Únicamente el nombre.",
      "Dirección y estado civil.",
      "Correo electrónico y profesión.",
    ),
    answer: "A",
  },
  {
    id: "CALL_CENTER_03",
    question: "Si el resultado de la verificación es denegado, ¿cómo se debe responder?",
    options: options(
      "Ignorar al cliente y cerrar el chat.",
      "Indicarle que vuelva a escribir utilizando otra identidad.",
      "Comunicar el resultado de forma respetuosa, disculparse y evitar prometer una aprobación inexistente.",
      "Decirle que el sistema no funciona.",
    ),
    answer: "C",
  },
  {
    id: "CALL_CENTER_04",
    question: "Durante el convencimiento por redes o Call Center, ¿qué acción es correcta?",
    options: options(
      "Enviar todas las opciones disponibles y esperar.",
      "Enviar el video del producto, llamar al cliente para definir plazo y valor, y presentar máximo dos opciones adecuadas.",
      "Evitar las llamadas y comunicarse únicamente con audios.",
      "Prometer descuentos o condiciones que no están autorizadas.",
    ),
    answer: "B",
  },
  {
    id: "CALL_CENTER_05",
    question:
      "¿Cómo debe acompañarse el proceso biométrico cuando la venta se realiza por redes o Call Center?",
    options: options(
      "Enviar el enlace y dejar que el cliente complete todo sin acompañamiento.",
      "Solicitar la contraseña personal del cliente.",
      "Realizar una videollamada para acompañar el proceso, generar confianza y verificar que se completen correctamente los pasos.",
      "Pedir a otra persona que realice el biométrico por el cliente.",
    ),
    answer: "C",
  },
];

const OPEN_QUESTIONS = [
  {
    id: "ABIERTA_01",
    question:
      "Un cliente fue aprobado para cuotas semanales o quincenales, pero solicita pagar mensualmente. ¿Cómo le explicarías las condiciones y qué solución le propondrías sin cambiar lo autorizado?",
    rubric:
      "No prometer cambios no autorizados; explicar con claridad la frecuencia aprobada; indicar que cuatro cuotas semanales o dos cuotas quincenales representan aproximadamente un pago mensual; confirmar valores y condiciones reales; proponer una solución válida sin alterar unilateralmente el crédito.",
  },
  {
    id: "ABIERTA_02",
    question: "¿Cómo responderías si el cliente indica que el producto está muy caro?",
    rubric:
      "Escuchar sin discutir; consultar el presupuesto y la necesidad; explicar el valor y los beneficios reales; presentar una alternativa adecuada; no inventar descuentos ni condiciones.",
  },
  {
    id: "ABIERTA_03",
    question: "¿Cómo responderías si el cliente manifiesta que no tiene dinero para la entrada?",
    rubric:
      "Revisar las condiciones reales de la aprobación; no prometer una venta sin entrada si no corresponde; explicar claramente el valor requerido; ofrecer otro modelo, cupo o alternativa válida; evitar presionar al cliente.",
  },
  {
    id: "ABIERTA_04",
    question:
      "¿Qué harías si el cliente dice que primero va a consultar la compra con su esposa o pareja?",
    rubric:
      "Respetar la decisión; identificar y resolver dudas pendientes; ofrecer información clara para que pueda consultarla; acordar un seguimiento concreto; evitar presionar o desacreditar a la pareja.",
  },
  {
    id: "ABIERTA_05",
    question: "¿Cómo actuarías si un cliente llega molesto al local?",
    rubric:
      "Mantener la calma; escuchar sin interrumpir; conocer los hechos antes de responder; buscar una solución dentro de las políticas; escalar el caso al supervisor cuando corresponda.",
  },
  {
    id: "ABIERTA_06",
    question: "¿Qué harías si el cliente solicita específicamente una marca de celular?",
    rubric:
      "Preguntar por su necesidad, preferencia y presupuesto; revisar la disponibilidad real; presentar la marca solicitada cuando esté disponible y aplique; si no está disponible, ofrecer alternativas justificadas; no obligar al cliente a aceptar otra marca.",
  },
  {
    id: "ABIERTA_07",
    question: "¿Qué harías si el cliente dice que regresará más tarde?",
    rubric:
      "Identificar la duda u objeción pendiente; resolver las preguntas que sea posible; solicitar autorización para realizar seguimiento; acordar un día y una hora concretos; registrar correctamente el contacto en el CRM.",
  },
];

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeTestType = (value) => String(value || "").trim().toLowerCase();
const roundTwo = (value) => Number(Number(value || 0).toFixed(2));

const shuffle = (items, random = Math.random) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const cloneChoiceQuestion = (question, scope) => ({
  id: question.id,
  tipo: "opcion_multiple",
  scope,
  question: question.question,
  options: question.options.map((option) => ({ ...option })),
  answer: question.answer,
});

const buildAttemptQuestions = (type, random = Math.random) => {
  const normalizedType = normalizeTestType(type);
  if (!TEST_TYPES[normalizedType]) {
    const error = new Error("Debe seleccionar vendedor de piso o call center.");
    error.statusCode = 400;
    throw error;
  }

  const specificBank =
    normalizedType === "piso" ? FLOOR_QUESTIONS : CALL_CENTER_QUESTIONS;
  const choiceQuestions = shuffle(
    [
      ...COMMON_QUESTIONS.map((question) => cloneChoiceQuestion(question, "comun")),
      ...specificBank.map((question) =>
        cloneChoiceQuestion(question, normalizedType),
      ),
    ],
    random,
  );
  const openQuestions = OPEN_QUESTIONS.map((question) => ({
    id: question.id,
    tipo: "abierta",
    scope: "objeciones",
    question: question.question,
    options: [],
    answer: null,
    rubric: question.rubric,
  }));
  const questions = [...choiceQuestions, ...openQuestions];
  validateAttemptComposition(questions, normalizedType);
  return questions;
};

const validateAttemptComposition = (questions, type) => {
  const normalizedType = normalizeTestType(type);
  const choice = questions.filter((question) => question.tipo === "opcion_multiple");
  const open = questions.filter((question) => question.tipo === "abierta");
  const common = choice.filter((question) => question.scope === "comun");
  const specific = choice.filter((question) => question.scope === normalizedType);

  if (
    questions.length !== 30 ||
    choice.length !== 23 ||
    open.length !== 7 ||
    common.length !== 18 ||
    specific.length !== 5 ||
    questions.slice(-7).some((question) => question.tipo !== "abierta")
  ) {
    const error = new Error(
      "El intento no contiene la composición obligatoria de 30 preguntas.",
    );
    error.statusCode = 409;
    throw error;
  }
  return true;
};

const calculateAutomaticScore = (correctAnswers) =>
  roundTwo((Number(correctAnswers) / 23) * 70);
const calculateSupervisorScore = (openPoints) =>
  roundTwo((Number(openPoints) / 35) * 30);
const calculateFinalScore = (automaticScore, supervisorScore) =>
  roundTwo(Number(automaticScore) + Number(supervisorScore));

const sanitizeSnapshotForParticipant = (questions) =>
  questions.map((question) => ({
    id: question.id,
    tipo: question.tipo,
    question: question.question,
    options: Array.isArray(question.options)
      ? question.options.map((option) => ({ ...option }))
      : [],
  }));

module.exports = {
  CALL_CENTER_QUESTIONS,
  COMMON_QUESTIONS,
  FLOOR_QUESTIONS,
  OPEN_QUESTIONS,
  TEST_TYPES,
  buildAttemptQuestions,
  calculateAutomaticScore,
  calculateFinalScore,
  calculateSupervisorScore,
  normalizeRoleName,
  normalizeTestType,
  sanitizeSnapshotForParticipant,
  validateAttemptComposition,
};

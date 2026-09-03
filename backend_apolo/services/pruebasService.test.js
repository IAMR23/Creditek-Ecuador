const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  CALL_CENTER_QUESTIONS,
  COMMON_QUESTIONS,
  FLOOR_QUESTIONS,
  OPEN_QUESTIONS,
  buildAttemptQuestions,
  calculateAutomaticScore,
  calculateFinalScore,
  calculateSupervisorScore,
  sanitizeSnapshotForParticipant,
  validateAttemptComposition,
} = require("./pruebasService");

test("compone exactamente 18 comunes, 5 específicas y 7 abiertas al final", () => {
  for (const type of ["piso", "call_center"]) {
    const questions = buildAttemptQuestions(type, () => 0.5);
    assert.equal(questions.length, 30);
    assert.equal(questions.filter((question) => question.scope === "comun").length, 18);
    assert.equal(questions.filter((question) => question.scope === type).length, 5);
    assert.equal(questions.filter((question) => question.tipo === "opcion_multiple").length, 23);
    assert.equal(questions.filter((question) => question.tipo === "abierta").length, 7);
    assert.ok(questions.slice(-7).every((question) => question.tipo === "abierta"));
    assert.equal(validateAttemptComposition(questions, type), true);
    assert.deepEqual(
      questions.slice(23).map((question) => question.id),
      OPEN_QUESTIONS.map((question) => question.id),
    );
  }
});

test("usa bancos completos y estables sin seleccionar subconjuntos", () => {
  const floorIds = new Set(
    buildAttemptQuestions("piso", () => 0.5)
      .filter((question) => question.scope === "piso")
      .map((question) => question.id),
  );
  const callCenterIds = new Set(
    buildAttemptQuestions("call_center", () => 0.5)
      .filter((question) => question.scope === "call_center")
      .map((question) => question.id),
  );
  assert.equal(floorIds.size, 5);
  assert.equal(callCenterIds.size, 5);
  assert.equal([...floorIds].some((id) => callCenterIds.has(id)), false);
  assert.deepEqual(
    [...floorIds].sort(),
    FLOOR_QUESTIONS.map((question) => question.id).sort(),
  );
  assert.deepEqual(
    [...callCenterIds].sort(),
    CALL_CENTER_QUESTIONS.map((question) => question.id).sort(),
  );

  const commonIds = buildAttemptQuestions("piso", () => 0.25)
    .filter((question) => question.scope === "comun")
    .map((question) => question.id)
    .sort();
  assert.deepEqual(
    commonIds,
    COMMON_QUESTIONS.map((question) => question.id).sort(),
  );
  assert.equal(new Set(commonIds).size, 18);
});

test("conserva identificadores públicos y respuestas del banco solicitado", () => {
  assert.deepEqual(
    COMMON_QUESTIONS.map((question) => question.id),
    Array.from({ length: 18 }, (_, index) => `COMUN_${String(index + 1).padStart(2, "0")}`),
  );
  assert.equal(
    COMMON_QUESTIONS.find((question) => question.id === "COMUN_07").answer,
    "A",
  );
  assert.match(
    COMMON_QUESTIONS.find((question) => question.id === "COMUN_08").question,
    /AN1/,
  );
  assert.match(
    COMMON_QUESTIONS.find((question) => question.id === "COMUN_09").options[2].text,
    /AN1\+1.*AN1B5/,
  );
});

test("calcula los 70 puntos automáticos, los 30 del supervisor y la nota final", () => {
  assert.equal(calculateAutomaticScore(23), 70);
  assert.equal(calculateAutomaticScore(18), 54.78);
  assert.equal(calculateSupervisorScore(35), 30);
  assert.equal(calculateSupervisorScore(28), 24);
  assert.equal(calculateFinalScore(54.78, 24), 78.78);
});

test("el contrato público nunca filtra respuestas, rúbricas ni clasificación interna", () => {
  const snapshot = buildAttemptQuestions("piso", () => 0.5);
  const publicQuestions = sanitizeSnapshotForParticipant(snapshot);
  assert.ok(publicQuestions.every((question) => question.answer === undefined));
  assert.ok(publicQuestions.every((question) => question.rubric === undefined));
  assert.ok(publicQuestions.every((question) => question.scope === undefined));
  assert.ok(publicQuestions.every((question) => question.respuestaCorrecta === undefined));
  assert.deepEqual(Object.keys(publicQuestions[0]).sort(), ["id", "options", "question", "tipo"]);
});

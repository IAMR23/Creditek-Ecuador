import test from "node:test";
import assert from "node:assert/strict";
import { isWorkflowProgramacionValid, toggleSelection } from "./workflowProgramacion.js";

const valid = {
  nombre: "Seguimiento",
  pipelineId: "pipeline-1",
  stageIds: ["stage-1", "stage-2"],
  workflowId: "workflow-1",
  hora: "10:00",
  diasSemana: [1, 2, 3, 4, 5, 6],
};

test("seleccion multiple agrega y elimina etapas sin alterar las demas", () => {
  assert.deepEqual(toggleSelection(["stage-1"], "stage-2"), ["stage-1", "stage-2"]);
  assert.deepEqual(toggleSelection(["stage-1", "stage-2"], "stage-1"), ["stage-2"]);
});

test("valida nombre, pipeline, etapas, workflow, hora y dias", () => {
  assert.equal(isWorkflowProgramacionValid(valid), true);
  assert.equal(isWorkflowProgramacionValid({ ...valid, stageIds: [] }), false);
  assert.equal(isWorkflowProgramacionValid({ ...valid, hora: "25:00" }), false);
  assert.equal(isWorkflowProgramacionValid({ ...valid, diasSemana: [] }), false);
  assert.equal(isWorkflowProgramacionValid({ ...valid, diasSemana: [7] }), false);
});

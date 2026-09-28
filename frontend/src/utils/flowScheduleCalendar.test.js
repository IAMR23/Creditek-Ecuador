import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScheduleRange,
  layoutScheduleBlocks,
  timeToMinutes,
} from "./flowScheduleCalendar.js";

test("convierte horas validas a minutos", () => {
  assert.equal(timeToMinutes("09:30"), 570);
  assert.equal(timeToMinutes("24:00"), null);
  assert.equal(timeToMinutes("hora"), null);
});

test("calcula el rango visible usando los turnos", () => {
  assert.deepEqual(
    buildScheduleRange([
      { horaInicio: "09:30", horaFin: "11:15" },
      { horaInicio: "14:00", horaFin: "18:30" },
    ]),
    {
      startMinute: 540,
      endMinute: 1140,
      hours: [540, 600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140],
    },
  );
});

test("separa en carriles los turnos que se superponen", () => {
  const layout = layoutScheduleBlocks([
    { id: "a", horaInicio: "09:00", horaFin: "11:00" },
    { id: "b", horaInicio: "10:00", horaFin: "12:00" },
    { id: "c", horaInicio: "12:00", horaFin: "13:00" },
  ]);
  assert.equal(layout[0].lane, 0);
  assert.equal(layout[1].lane, 1);
  assert.equal(layout[2].lane, 0);
  assert.equal(layout[0].laneCount, 2);
});

export const timeToMinutes = (value) => {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return (hour * 60) + minute;
};

export const buildScheduleRange = (blocks = []) => {
  const starts = blocks.map((block) => timeToMinutes(block.horaInicio)).filter(Number.isFinite);
  const ends = blocks.map((block) => timeToMinutes(block.horaFin)).filter(Number.isFinite);
  const startMinute = starts.length
    ? Math.max(0, Math.floor(Math.min(...starts) / 60) * 60)
    : 8 * 60;
  const endMinute = ends.length
    ? Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60)
    : 18 * 60;
  const safeEnd = Math.max(startMinute + 60, endMinute);
  const hours = [];
  for (let minute = startMinute; minute <= safeEnd; minute += 60) {
    hours.push(minute);
  }
  return { startMinute, endMinute: safeEnd, hours };
};

export const layoutScheduleBlocks = (blocks = []) => {
  const sorted = blocks
    .map((block) => ({
      block,
      startMinute: timeToMinutes(block.horaInicio),
      endMinute: timeToMinutes(block.horaFin),
    }))
    .filter((item) => Number.isFinite(item.startMinute) && Number.isFinite(item.endMinute))
    .sort((left, right) => left.startMinute - right.startMinute
      || left.endMinute - right.endMinute
      || String(left.block.id || "").localeCompare(String(right.block.id || "")));

  const laneEnds = [];
  const positioned = sorted.map((item) => {
    let lane = laneEnds.findIndex((endMinute) => endMinute <= item.startMinute);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = item.endMinute;
    return { ...item, lane };
  });

  const laneCount = Math.max(1, laneEnds.length);
  return positioned.map((item) => ({ ...item, laneCount }));
};

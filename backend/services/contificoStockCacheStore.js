const LogisticaContificoCache = require("../models/LogisticaContificoCache");

const read = async (cacheKey) => {
  const row = await LogisticaContificoCache.findByPk(cacheKey, { raw: true });
  if (!row) return null;
  const fetchedAtMs = new Date(row.consultedAt).getTime();
  if (!Number.isFinite(fetchedAtMs) || !row.contenido) return null;
  return {
    cacheKey: row.cacheKey,
    type: row.tipo,
    value: row.contenido,
    fetchedAtMs,
    consultedAt: new Date(fetchedAtMs).toISOString(),
  };
};

const write = async ({ cacheKey, type, value, fetchedAtMs }) => {
  const consultedAt = new Date(fetchedAtMs);
  if (!cacheKey || !type || !value || Number.isNaN(consultedAt.getTime())) {
    throw new Error("Entrada de caché Contífico inválida.");
  }
  await LogisticaContificoCache.upsert({
    cacheKey,
    tipo: type,
    contenido: value,
    consultedAt,
  });
};

module.exports = { read, write };

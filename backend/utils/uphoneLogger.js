const LOG_PREFIX = "[UPHONE]";
const MAX_MESSAGE_LENGTH = 600;

const cleanText = (value) => {
  const text = String(value || "").trim();
  return text ? text.slice(0, MAX_MESSAGE_LENGTH) : undefined;
};

const compact = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""),
  );

const summarizeError = (error) => {
  const databaseError = error?.original || error?.parent;
  return compact({
    errorName: cleanText(error?.name) || "Error",
    errorMessage: cleanText(error?.message) || "Error inesperado",
    errorCode: cleanText(error?.code),
    sqlState: cleanText(databaseError?.code),
    table: cleanText(databaseError?.table),
    column: cleanText(databaseError?.column),
    constraint: cleanText(databaseError?.constraint),
    stack:
      process.env.NODE_ENV === "production"
        ? undefined
        : cleanText(error?.stack),
  });
};

const write = (level, event, details = {}) => {
  console[level](`${LOG_PREFIX} ${event}`, compact({
    timestamp: new Date().toISOString(),
    ...details,
  }));
};

const info = (event, details) => write("info", event, details);
const warn = (event, details) => write("warn", event, details);
const error = (event, caughtError, details) =>
  write("error", event, {
    ...details,
    ...summarizeError(caughtError),
  });

module.exports = { error, info, summarizeError, warn };

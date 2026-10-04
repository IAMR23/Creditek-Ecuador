export const normalizeEcuadorMobilePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^09\d{8}$/.test(digits)) return `+593${digits.slice(1)}`;
  if (/^5939\d{8}$/.test(digits)) return `+${digits}`;
  // Algunas exportaciones anteponen un 9 adicional al formato internacional.
  if (/^59399\d{8}$/.test(digits)) return `+593${digits.slice(4)}`;
  if (/^9\d{8}$/.test(digits)) return `+593${digits}`;
  return "";
};

export const parseExternalPhoneValues = (values) => {
  const source = Array.isArray(values) ? values : [values];
  const candidates = source.flatMap((value) => String(value || "")
    .split(/[,;\r\n\t]+/)
    .flatMap((part) => part.trim().split(/\s+(?=(?:\+?593|09))/)));
  return [...new Set(candidates.map(normalizeEcuadorMobilePhone).filter(Boolean))];
};

export const nationalPhone = (phone) => `0${String(phone || "").replace(/^\+593/, "")}`;

const crypto = require("crypto");
const WebhookEvento = require("../models/GhlRepartoWebhookEvento");
const distribution = require("./ghlOpportunityDistributionService");

const MAX_FIELD_LENGTH = 120;

const normalizedKey = (value) => String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();

function findValueDeep(input, fieldNames, depth = 0, seen = new Set()) {
  if (!input || typeof input !== "object" || depth > 8 || seen.has(input)) return null;
  seen.add(input);
  const wanted = new Set(fieldNames.map(normalizedKey));
  for (const [key, value] of Object.entries(input)) {
    if (wanted.has(normalizedKey(key)) && value !== null && value !== undefined && String(value).trim()) return value;
  }
  for (const value of Object.values(input)) {
    const found = findValueDeep(value, fieldNames, depth + 1, seen);
    if (found !== null) return found;
  }
  return null;
}

function findObjectDeep(input, fieldNames, depth = 0, seen = new Set()) {
  if (!input || typeof input !== "object" || depth > 8 || seen.has(input)) return null;
  seen.add(input);
  const wanted = new Set(fieldNames.map(normalizedKey));
  for (const [key, value] of Object.entries(input)) {
    if (wanted.has(normalizedKey(key)) && value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  for (const value of Object.values(input)) {
    const found = findObjectDeep(value, fieldNames, depth + 1, seen);
    if (found) return found;
  }
  return null;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

const safeField = (value, max = MAX_FIELD_LENGTH) => value === null || value === undefined
  ? null
  : String(value).trim().slice(0, max) || null;

function normalizeWebhookPayload(payload = {}, headers = {}) {
  const opportunity = findObjectDeep(payload, ["opportunity"]);
  const contact = findObjectDeep(payload, ["contact"]);
  const location = findObjectDeep(payload, ["location"]);
  const workflow = findObjectDeep(payload, ["workflow"]);
  return {
    eventId: safeField(headers["x-ghl-event-id"] || headers["x-webhook-id"] || findValueDeep(payload, ["eventId", "event_id", "webhookId", "webhook_id"])),
    opportunityId: safeField(findValueDeep(payload, ["opportunityId", "opportunity_id"]) || opportunity?.id || opportunity?._id, 100),
    contactId: safeField(findValueDeep(payload, ["contactId", "contact_id"]) || contact?.id || contact?._id, 100),
    locationId: safeField(findValueDeep(payload, ["locationId", "location_id"]) || location?.id || location?._id, 100),
    workflowId: safeField(findValueDeep(payload, ["workflowId", "workflow_id"]) || workflow?.id || workflow?._id, 100),
    source: safeField(findValueDeep(payload, ["source", "eventType", "event_type"])),
    phone: safeField(findValueDeep(payload, ["phone", "phoneNumber", "phone_number"]) || contact?.phone),
  };
}

function isValidWebhookSecret(providedSecret, expectedSecret = process.env.GHL_REPARTO_WEBHOOK_SECRET) {
  if (!providedSecret || !expectedSecret) return false;
  const providedDigest = crypto.createHash("sha256").update(String(providedSecret), "utf8").digest();
  const expectedDigest = crypto.createHash("sha256").update(String(expectedSecret), "utf8").digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

function idempotencyKey(payload, normalized) {
  const source = normalized.eventId
    ? `event:${normalized.locationId || ""}:${normalized.eventId}`
    : JSON.stringify(canonicalize(payload || {}));
  return crypto.createHash("sha256").update(source, "utf8").digest("hex");
}

async function processWebhookEvent(eventId, normalized) {
  const [claimed] = await WebhookEvento.update({
    estado: "processing",
    lockedAt: new Date(),
    attemptCount: 1,
  }, { where: { id: eventId, estado: "received" } });
  if (!claimed) return { code: "DUPLICATE_OR_PROCESSING", assigned: false };
  try {
    const result = await distribution.executeWebhookOpportunity(normalized);
    await WebhookEvento.update({
      estado: result.assigned ? "completed" : "ignored",
      resultCode: result.code,
      configuracionId: result.configuracionId || null,
      opportunityId: result.opportunityId || normalized.opportunityId || null,
      processedAt: new Date(),
      lastError: null,
    }, { where: { id: eventId } });
    return result;
  } catch (error) {
    await WebhookEvento.update({
      estado: "failed",
      resultCode: error.code || "GHL_WEBHOOK_PROCESSING_ERROR",
      processedAt: new Date(),
      lastError: String(error.code || "GHL_WEBHOOK_PROCESSING_ERROR").slice(0, 80),
    }, { where: { id: eventId } });
    return { code: error.code || "GHL_WEBHOOK_PROCESSING_ERROR", assigned: false, failed: true };
  }
}

const defaultSchedule = (eventId, normalized) => setImmediate(() => {
  processWebhookEvent(eventId, normalized).catch((error) => {
    console.error("Fallo interno procesando webhook de reparto GHL", {
      eventoId: eventId,
      code: error.code || "GHL_WEBHOOK_PROCESSING_ERROR",
    });
  });
});

async function enqueueWebhookEvent(payload, headers = {}, schedule = defaultSchedule) {
  const normalized = normalizeWebhookPayload(payload, headers);
  const key = idempotencyKey(payload, normalized);
  let event;
  try {
    event = await WebhookEvento.create({
      idempotencyKey: key,
      estado: "received",
      opportunityId: normalized.opportunityId,
      contactId: normalized.contactId,
      locationId: normalized.locationId,
      workflowId: normalized.workflowId,
      source: normalized.source,
    });
  } catch (error) {
    if (error.name !== "SequelizeUniqueConstraintError") throw error;
    event = await WebhookEvento.findOne({ where: { idempotencyKey: key } });
    return { accepted: true, duplicate: true, eventId: event?.id || null };
  }
  schedule(event.id, normalized);
  return { accepted: true, duplicate: false, eventId: event.id };
}

module.exports = {
  findValueDeep,
  findObjectDeep,
  canonicalize,
  normalizeWebhookPayload,
  isValidWebhookSecret,
  idempotencyKey,
  enqueueWebhookEvent,
  processWebhookEvent,
};

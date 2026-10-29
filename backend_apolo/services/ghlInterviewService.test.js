const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  INTERVIEW_LINK,
  normalizeEcuadorMobilePhone,
  sendInterviewLink,
} = require("./ghlInterviewService");

const jsonResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => "application/json" },
  json: async () => payload,
});

test("normaliza celulares ecuatorianos aceptados por GHL", () => {
  assert.equal(normalizeEcuadorMobilePhone("099 123 4567"), "+593991234567");
  assert.equal(normalizeEcuadorMobilePhone("+593 99 123 4567"), "+593991234567");
  assert.equal(normalizeEcuadorMobilePhone("022345678"), "");
});

test("envia el enlace mediante el proveedor e instancia de Message Hub", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("conversationChannels/SMS")) {
      return jsonResponse({
        conversationChannel: {
          SMS: [{ conversationProvider: { _id: "provider-abs", name: "Whatsapp" } }],
        },
      });
    }
    if (url.endsWith("/contacts/upsert")) {
      return jsonResponse({ contact: { id: "contact-1" } });
    }
    return jsonResponse({ messageId: "message-1" });
  };

  const result = await sendInterviewLink(
    { phone: "0991234567", instanceIndex: 3 },
    {
      getConfig: () => ({
        token: "secret",
        locationId: "location-abs",
        baseUrl: "https://services.example.test",
      }),
      fetch: fakeFetch,
    },
  );

  assert.equal(result.instanceIndex, 3);
  assert.equal(result.messageId, "message-1");
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.headers.Version, "v3");
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    locationId: "location-abs",
    phone: "+593991234567",
    country: "EC",
    createNewIfDuplicateAllowed: false,
  });
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    type: "SMS",
    contactId: "contact-1",
    conversationProviderId: "provider-abs",
    message: `${INTERVIEW_LINK}\n\n{ WA#3 }`,
  });
});

test("rechaza instancias fuera de los cinco canales disponibles", async () => {
  await assert.rejects(
    () => sendInterviewLink({ phone: "0991234567", instanceIndex: 6 }),
    { code: "GHL_ABS_INSTANCE_INVALID" },
  );
});

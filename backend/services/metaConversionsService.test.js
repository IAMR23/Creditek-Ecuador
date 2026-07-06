const crypto = require("crypto");
const {
  buildMetaEventsUrl,
  buildWhatsappPurchasePayload,
  hashSha256,
  normalizePhone,
  parseSaleValue,
} = require("./metaConversionsService");

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

describe("metaConversionsService", () => {
  test("arma payload Purchase para WhatsApp Business Messaging", () => {
    const payload = buildWhatsappPurchasePayload(
      {
        opportunityId: "opp_001",
        contactId: "contact_001",
        ctwaClid: "ctwa-123",
        phone: "+593 98 406 5314",
        email: " CLIENTE@Example.COM ",
        firstName: " Juan ",
        lastName: " Perez ",
        value: "123,45",
        currency: "",
        productName: "HONOR X5c Plus",
        productCategory: "Celulares",
      },
      {
        pageId: "page_123",
      },
      {
        eventTime: 1770000000,
      }
    );

    expect(payload).toEqual({
      data: [
        {
          event_name: "Purchase",
          event_time: 1770000000,
          action_source: "business_messaging",
          messaging_channel: "whatsapp",
          event_id: "ghl_purchase_opp_001",
          user_data: {
            page_id: "page_123",
            ctwa_clid: "ctwa-123",
            ph: sha256("593984065314"),
            em: sha256("cliente@example.com"),
            fn: sha256("juan"),
            ln: sha256("perez"),
          },
          custom_data: {
            currency: "USD",
            value: 123.45,
            content_name: "HONOR X5c Plus",
            content_category: "Celulares",
          },
        },
      ],
    });
  });

  test("usa contactId para event_id si no llega opportunityId", () => {
    const payload = buildWhatsappPurchasePayload(
      {
        contactId: "contact_001",
        ctwaClid: "ctwa-123",
        value: "no valido",
      },
      {
        pageId: "page_123",
      },
      {
        eventTime: 1770000000,
      }
    );

    expect(payload.data[0].event_id).toBe("ghl_purchase_contact_001");
    expect(payload.data[0].custom_data.value).toBe(0);
  });

  test("normaliza telefono, valor y URL de Meta", () => {
    expect(normalizePhone("+593 (98) 406-5314")).toBe("593984065314");
    expect(parseSaleValue("$1,234.56")).toBe(1234.56);
    expect(hashSha256("cliente@example.com")).toBe(sha256("cliente@example.com"));
    expect(
      buildMetaEventsUrl({
        apiVersion: "/v20.0/",
        datasetId: "123",
        accessToken: "token secreto",
      })
    ).toBe("https://graph.facebook.com/v20.0/123/events?access_token=token%20secreto");
  });
});

const {
  extraerTelefonoStevo,
  limpiarTelefono,
} = require("./stevoUtils");

describe("normalizacion segura de telefonos Stevo", () => {
  test.each([
    ["098 798 1946", "+593987981946"],
    ["593987981946@s.whatsapp.net", "+593987981946"],
    ["593987981946:4@s.whatsapp.net", "+593987981946"],
    ["+593 98 798 1946", "+593987981946"],
    ["022345678", "+59322345678"],
  ])("normaliza %s", (input, expected) => {
    expect(limpiarTelefono(input)).toBe(expected);
  });

  test.each([
    "137009859449042",
    "137009859449042@lid",
    "120363123456789@g.us",
    "status@broadcast",
    "12345",
    {},
  ])("rechaza identificadores que no son telefonos: %s", (input) => {
    expect(limpiarTelefono(input)).toBeNull();
  });

  test("prioriza SenderAlt sobre el identificador LID entrante", () => {
    expect(extraerTelefonoStevo({
      data: {
        Info: {
          IsFromMe: false,
          Sender: "137009859449042@lid",
          SenderAlt: "593987981946@s.whatsapp.net",
        },
      },
    })).toBe("+593987981946");
  });

  test("busca otro candidato cuando el primer campo numerico es invalido", () => {
    expect(extraerTelefonoStevo({
      data: {
        from: "137009859449042",
        phone: "0991234567",
      },
    })).toBe("+593991234567");
  });

  test("usa RecipientAlt para mensajes salientes", () => {
    expect(extraerTelefonoStevo({
      data: {
        Info: {
          IsFromMe: true,
          Chat: "137009859449042@lid",
          RecipientAlt: "593991234567@s.whatsapp.net",
        },
      },
    }, { isFromMe: true })).toBe("+593991234567");
  });
});

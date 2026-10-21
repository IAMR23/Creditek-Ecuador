const {
  extraerMensajeStevo,
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

  test("prioriza el numero del contacto sobre el numero del dispositivo nuevo", () => {
    expect(extraerTelefonoStevo({
      device: { number: "0991111111", name: "Recepcion" },
      contact: { id: "contact-1", number: "0987981946" },
      message: { text: "Hola" },
    })).toBe("+593987981946");
  });

  test("extrae texto y transcripcion del nuevo payload sin duplicarlos", () => {
    expect(extraerMensajeStevo({
      message: { text: "Adjunto nota de voz" },
      transcribedAudio: "Mi cedula es 1710034065",
    })).toBe("Adjunto nota de voz\nMi cedula es 1710034065");
  });

  test("mantiene compatibilidad con el mensaje anterior", () => {
    expect(extraerMensajeStevo({
      data: { conversation: "Mi cedula es 1710034065" },
    })).toBe("Mi cedula es 1710034065");
  });
});

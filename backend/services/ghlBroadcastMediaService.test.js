const service = require("./ghlBroadcastMediaService");

describe("ghlBroadcastMediaService", () => {
  test("convierte una imagen almacenada usando el origen HTTPS de la peticion", () => {
    expect(service.publicImageUrl(
      "/uploads/ghl-difusiones/123e4567-e89b-12d3-a456-426614174000.png",
      "https://rve.example.test/",
    )).toBe(
      "https://rve.example.test/uploads/ghl-difusiones/123e4567-e89b-12d3-a456-426614174000.png",
    );
  });

  test("conserva una URL HTTPS publica ya almacenada", () => {
    const url = "https://rve.example.test/uploads/ghl-difusiones/123e4567-e89b-12d3-a456-426614174000.webp";
    expect(service.publicImageUrl(url)).toBe(url);
  });

  test("rechaza rutas externas o manipuladas", () => {
    expect(() => service.normalizeStoredImageUrl("/uploads/otra/imagen.png"))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_IMAGE_URL_INVALID" }));
  });
});

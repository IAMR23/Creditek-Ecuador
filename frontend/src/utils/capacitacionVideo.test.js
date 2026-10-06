import test from "node:test";
import assert from "node:assert/strict";
import {
  construirEnlaceReproductor,
  obtenerProveedorVideo,
} from "./capacitacionVideo.js";

test("convierte un enlace compartido de Google Drive al reproductor preview", () => {
  assert.equal(
    construirEnlaceReproductor(
      "https://drive.google.com/file/d/1AbC_def-123/view?usp=sharing",
    ),
    "https://drive.google.com/file/d/1AbC_def-123/preview",
  );
  assert.equal(
    construirEnlaceReproductor("https://drive.google.com/open?id=1AbC_def-123"),
    "https://drive.google.com/file/d/1AbC_def-123/preview",
  );
});

test("conserva la preparación de enlaces de OneDrive y SharePoint", () => {
  assert.match(
    construirEnlaceReproductor(
      "https://onedrive.live.com/?resid=ABC!123&authkey=clave",
    ),
    /^https:\/\/onedrive\.live\.com\/embed\?/,
  );
  assert.match(
    construirEnlaceReproductor(
      "https://empresa.sharepoint.com/:v:/s/capacitacion/ejemplo",
    ),
    /action=embedview/,
  );
});

test("identifica el proveedor y rechaza enlaces no HTTPS", () => {
  assert.equal(
    obtenerProveedorVideo("https://drive.google.com/file/d/ABC/view"),
    "Google Drive",
  );
  assert.equal(construirEnlaceReproductor("http://drive.google.com/open?id=ABC"), "");
  assert.equal(construirEnlaceReproductor("enlace-invalido"), "");
});

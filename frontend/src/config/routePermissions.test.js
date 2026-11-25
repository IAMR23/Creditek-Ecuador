import test from "node:test";
import assert from "node:assert/strict";
import {
  hasRouteAccess,
  ROUTE_PERMISSIONS,
  VENDEDOR_PERMISSION,
} from "./routePermissions.js";
import { getDefaultRoute } from "../utils/getDefaultRoute.js";

test("combustible propio es exclusivo de repartidores", () => {
  assert.equal(hasRouteAccess({ rol: "REPARTIDOR", permisos: [], path: "/logistica-panel/combustible" }), false);
  assert.equal(hasRouteAccess({ rol: "REPARTIDOR", permisos: ["Logistica"], path: "/logistica-panel/combustible" }), true);
  for (const rol of ["admin", "administrador", "vendedor", "logistica"]) {
    assert.equal(hasRouteAccess({ rol, permisos: ["Logistica", "Administracion"], path: "/logistica-panel/combustible" }), false);
  }
});

test("dashboard de combustible exige administrador y permiso explícito", () => {
  const path = "/logistica/gasto-combustible";
  for (const rol of ["admin", "administrador"]) {
    assert.equal(hasRouteAccess({ rol, permisos: ["Logistica"], path }), true);
    assert.equal(hasRouteAccess({ rol, permisos: ["Administracion"], path }), false);
    assert.equal(hasRouteAccess({ rol, permisos: [], path }), false);
  }
  assert.equal(hasRouteAccess({ rol: "repartidor", permisos: ["Administracion"], path }), false);
  assert.equal(hasRouteAccess({ rol: "vendedor", permisos: ["Logistica"], path }), false);
});

test("administrador sin Administracion no accede a rutas administrativas", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Contabilidad"],
      path: "/usuarios",
    }),
    false,
  );
});

test("administrador con Administracion accede a rutas administrativas", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Administracion"],
      path: "/usuarios",
    }),
    true,
  );
});

test("administrador sin Gerencia no accede a rutas solo Gerencia", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Administracion"],
      path: "/dashboard",
    }),
    false,
  );
});

test("administrador con Gerencia accede a rutas de Gerencia", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Gerencia"],
      path: "/dashboard",
    }),
    true,
  );
});

test("Administracion no habilita rutas exclusivas de Gerencia", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Administracion"],
      path: "/metas-comerciales",
    }),
    false,
  );
});

test("Gerencia no habilita rutas exclusivas de Administracion", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Gerencia"],
      path: "/permisos",
    }),
    false,
  );
});

test("ruta configurada con Gerencia o Administracion acepta cualquiera de los dos", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Gerencia"],
      path: "/consejo-ejecutivo",
    }),
    true,
  );
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Administracion"],
      path: "/consejo-ejecutivo",
    }),
    false,
  );
});

test("facturas exige Gerencia", () => {
  assert.equal(
    hasRouteAccess({ rol: "administrador", permisos: ["Gerencia"], path: "/gerencia/facturas" }),
    true,
  );
  assert.equal(
    hasRouteAccess({ rol: "administrador", permisos: ["Administracion"], path: "/gerencia/facturas" }),
    false,
  );
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Contabilidad"],
      path: "/gerencia/facturas",
    }),
    false,
  );
});

test("usuario sin permisos no obtiene permisos administrativos implicitos", () => {
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: [],
      path: "/usuarios",
    }),
    false,
  );
  assert.equal(
    getDefaultRoute({
      rol: "administrador",
      permisos: [],
    }),
    "/recuperar-permisos",
  );
});

test("vendedor conserva acceso implicito a rutas de vendedor", () => {
  assert.equal(
    hasRouteAccess({
      rol: "vendedor",
      permisos: [],
      permission: VENDEDOR_PERMISSION,
    }),
    true,
  );
});

test("repartidor requiere permiso explicito de Logistica", () => {
  assert.equal(
    hasRouteAccess({
      rol: "repartidor",
      permisos: [],
      path: "/logistica-panel",
    }),
    false,
  );
  assert.equal(
    hasRouteAccess({
      rol: "repartidor",
      permisos: ["Logistica"],
      path: "/logistica/stock-contifico",
    }),
    true,
  );
});

test("ruta inicial respeta permisos explicitos de administrador", () => {
  assert.equal(
    getDefaultRoute({
      rol: "administrador",
      permisos: ["Contabilidad"],
    }),
    "/revisar-cajas",
  );
  assert.equal(
    getDefaultRoute({
      rol: "administrador",
      permisos: ["Gerencia"],
    }),
    "/dashboard",
  );
  assert.equal(
    getDefaultRoute({
      rol: "administrador",
      permisos: ["Administracion"],
    }),
    "/usuarios",
  );
});

test("configuracion de Supervisores no depende de Administracion", () => {
  assert.equal(ROUTE_PERMISSIONS["/supervisores"], "Supervisores");
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Administracion"],
      path: "/supervisores",
    }),
    false,
  );
});

test("workflows programados exige Sistemas", () => {
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Sistemas"], path: "/ghl/workflows-programados" }), true);
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Administracion"], path: "/ghl/workflows-programados" }), false);
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Contabilidad"], path: "/ghl/workflows-programados" }), false);
});

test("horarios de flujo exige Sistemas", () => {
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Sistemas"], path: "/ghl/horarios-flujo" }), true);
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Gerencia"], path: "/ghl/horarios-flujo" }), false);
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Marketing"], path: "/ghl/horarios-flujo" }), false);
});

test("difusiones GHL exige Sistemas", () => {
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Sistemas"], path: "/ghl/difusiones" }), true);
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Administracion"], path: "/ghl/difusiones" }), false);
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Gerencia"], path: "/ghl/difusiones" }), false);
});

test("solicitudes Uphone exige Jefes Comerciales", () => {
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Jefes Comerciales"], path: "/uphone/solicitudes" }), true);
  assert.equal(hasRouteAccess({ rol: "administrador", permisos: ["Gerencia"], path: "/uphone/solicitudes" }), false);
  assert.equal(
    hasRouteAccess({
      rol: "administrador",
      permisos: ["Marketing"],
      path: "/uphone/solicitudes",
    }),
    false,
  );
});

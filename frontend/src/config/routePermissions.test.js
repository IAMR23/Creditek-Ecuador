import test from "node:test";
import assert from "node:assert/strict";
import {
  hasRouteAccess,
  ROUTE_PERMISSIONS,
  VENDEDOR_PERMISSION,
} from "./routePermissions.js";
import { getDefaultRoute } from "../utils/getDefaultRoute.js";

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
    true,
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

test("repartidor conserva acceso implicito a Logistica", () => {
  assert.equal(
    hasRouteAccess({
      rol: "repartidor",
      permisos: [],
      path: "/logistica-panel",
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

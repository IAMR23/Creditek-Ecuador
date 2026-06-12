export const SIDEBAR_SECTION_PERMISSIONS = [
  {
    permission: "Gerencia",
    descripcion: "Acceso a la seccion Gerencia del sidebar",
  },
  {
    permission: "Marketing",
    descripcion: "Acceso a la seccion Marketing del sidebar",
  },
  {
    permission: "Logistica",
    descripcion: "Acceso a la seccion Logistica del sidebar",
  },
  {
    permission: "Contabilidad",
    descripcion: "Acceso a la seccion Contabilidad del sidebar",
  },
  {
    permission: "Auditoria",
    descripcion: "Acceso a la seccion Auditoria del sidebar",
  },
  {
    permission: "Desarrollo Organizacional",
    descripcion: "Acceso a la seccion Desarrollo Organizacional del sidebar",
  },
  {
    permission: "Administracion",
    descripcion: "Acceso a la seccion Administracion del sidebar",
  },
  {
    permission: "Catalogos",
    descripcion: "Acceso a la seccion Catalogos del sidebar",
  },
];

export const VENDEDOR_PERMISSION = "Vendedor";

export const ROUTE_PERMISSIONS = {
  "/dashboard": "Gerencia",
  "/powerbi": "Gerencia",
  "/metas-comerciales": "Gerencia",
  "/reporte-entregas": "Gerencia",
  "/revision-gestiones": "Gerencia",
  "/revision-gestiones-comercial": "Gerencia",
  "/bdd-ventas": "Gerencia",
  "/bonos": "Gerencia",
  "/tasks": "Gerencia",
  "/ventas-completas": "Gerencia",

  "/copa-creditek": "Marketing",
  "/goleadores": "Marketing",

  "/logistica-panel": "Logistica",
  "/entregas": "Logistica",
  "/entrega-logistica": "Logistica",
  "/entregas-pendientes": "Logistica",
  "/entregas-repartidores-tabla": "Logistica",
  "/mis-entregas-pendientes": "Logistica",
  "/mis-entregas-realizadas": "Logistica",

  "/revisar-cajas": ["Contabilidad", "Administracion"],
  "/revisar-cajas2": ["Contabilidad", "Administracion"],

  "/entregas-auditoria": "Auditoria",
  "/ventas-auditoria": "Auditoria",

  "/postulaciones": "Desarrollo Organizacional",

  "/usuarios": "Administracion",
  "/rol": "Administracion",
  "/agencias": "Administracion",
  "/usuarios-agencias": "Administracion",
  "/permisos": "Administracion",
  "/asignar-permisos": "Administracion",
  "/asignar-permisos-usuario-agencia": "Administracion",
  "/usuarios-permisos": "Administracion",
  "/recuperar-permisos": "Administracion",
  "/recuperar-permisos/catalogo": "Administracion",
  "/seleccionar-modo": "Administracion",

  "/marcas": "Catalogos",
  "/modelos": "Catalogos",
  "/dispositivos": "Catalogos",
  "/dispositivosMarcas": "Catalogos",
  "/costoHistorico": "Catalogos",
  "/formas-pago": "Catalogos",
  "/origen": "Catalogos",
  "/obsequios": "Catalogos",
  "/estado-entrega": "Catalogos",

  "/vendedor-panel": VENDEDOR_PERMISSION,
  "/mis-ventas": VENDEDOR_PERMISSION,
  "/registrar-clientes-venta": VENDEDOR_PERMISSION,
  "/crear-venta": VENDEDOR_PERMISSION,
  "/ventacompleta": VENDEDOR_PERMISSION,
  "/crear-gestion-comercial": VENDEDOR_PERMISSION,
  "/mis-gestiones-comerciales": VENDEDOR_PERMISSION,
  "/registrar-clientes-entrega": VENDEDOR_PERMISSION,
  "/crear-entrega": VENDEDOR_PERMISSION,
  "/crear-entrega-completa": VENDEDOR_PERMISSION,
  "/mis-entregas": VENDEDOR_PERMISSION,
  "/crear-traslado": VENDEDOR_PERMISSION,
  "/mis-traslados": VENDEDOR_PERMISSION,
  "/gestion": VENDEDOR_PERMISSION,
  "/mis-gestiones": VENDEDOR_PERMISSION,
  "/caja": VENDEDOR_PERMISSION,
};

export const SYSTEM_ROUTES = SIDEBAR_SECTION_PERMISSIONS;

export const ROUTE_REDIRECT_ORDER = [
  "/dashboard",
  "/vendedor-panel",
  "/logistica-panel",
  "/metas-comerciales",
  "/entregas-pendientes",
  "/ventas-auditoria",
  "/revisar-cajas",
  "/postulaciones",
  "/usuarios",
  "/marcas",
];

export const normalizeRole = (rol) => String(rol || "").trim().toLowerCase();

const normalizePermissionName = (permiso) =>
  String(permiso || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const normalizePermissions = (permisos = []) =>
  Array.isArray(permisos)
    ? permisos.map((permiso) => String(permiso).trim()).filter(Boolean)
    : [];

export const hasRouteAccess = ({ rol, permisos = [], path, permission }) => {
  const rolNormalizado = normalizeRole(rol);
  const permisoRequerido = permission || ROUTE_PERMISSIONS[path];
  const permisosRequeridos = Array.isArray(permisoRequerido)
    ? permisoRequerido
    : permisoRequerido
      ? [permisoRequerido]
      : [];
  const permisosRequeridosNormalizados = permisosRequeridos.map(normalizePermissionName);

  if (
    ["admin", "administrador"].includes(rolNormalizado) &&
    permisosRequeridosNormalizados.includes("administracion")
  ) {
    return true;
  }

  if (rolNormalizado === "vendedor" && permisosRequeridos.includes(VENDEDOR_PERMISSION)) {
    return true;
  }

  if (
    rolNormalizado === "repartidor" &&
    permisosRequeridosNormalizados.includes("logistica")
  ) {
    return true;
  }

  if (!permisosRequeridos.length) return true;

  const permisosNormalizados = normalizePermissions(permisos).map(normalizePermissionName);
  return permisosRequeridosNormalizados.some((permiso) =>
    permisosNormalizados.includes(permiso),
  );
};

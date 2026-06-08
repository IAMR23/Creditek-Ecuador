export const ROUTE_PERMISSIONS = {
  "/powerbi": "Power BI",
  "/usuarios": "Usuarios",
  "/agencias": "Agencias",
  "/usuarios-agencias": "Usuarios Agencias",
  "/revision-gestiones": "Revision Gestiones",
  "/revision-gestiones-comercial": "Revision Gestiones Comercial",
  "/bdd-ventas": "Base de Datos Ventas",
  "/bonos": "Bonos",
  "/tasks": "Tareas",
  "/metas-comerciales": "Metas Comerciales",
  "/reporte-entregas": "Reporte Entregas",
  "/entregas-pendientes": "Entregas Pendientes",
  "/entregas-repartidores-tabla": "Informe Entregas",
  "/revisar-cajas": "Cierres de Caja",
  "/entregas-auditoria": "Entregas Auditoria",
  "/ventas-auditoria": "Ventas Auditoria",
  "/copa-creditek": "Copa Creditek",
  "/goleadores": "Goleadores",
  "/postulaciones": "Postulaciones",
  "/rol": "Roles",
  "/dispositivos": "Dispositivos",
  "/marcas": "Marcas",
  "/modelos": "Modelos",
  "/dispositivosMarcas": "Dispositivos Marcas",
  "/costoHistorico": "Costo Historico",
  "/formas-pago": "Formas de Pago",
  "/origen": "Origen",
  "/obsequios": "Obsequios",
  "/estado-entrega": "Estado Entrega",
  "/permisos": "Permisos",
  "/asignar-permisos": "Asignar Permisos",
  "/asignar-permisos-usuario-agencia": "Asignar Permisos Usuario Agencia",
  "/usuarios-permisos": "Usuarios con Permisos",
};

export const SYSTEM_ROUTES = Object.entries(ROUTE_PERMISSIONS).map(
  ([path, permission]) => ({
    path,
    permission,
    descripcion: `Acceso a ${path}`,
  }),
);

export const ADMIN_PERMISSION_PATHS = [
  "/recuperar-permisos",
];

export const ROUTE_REDIRECT_ORDER = [
  "/dashboard",
  "/powerbi",
  "/metas-comerciales",
  "/reporte-entregas",
  "/entregas-pendientes",
  "/ventas-auditoria",
  "/mis-ventas",
  "/vendedor-panel",
  "/logistica-panel",
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
  if (rolNormalizado === "admin") {
    return true;
  }

  if (ADMIN_PERMISSION_PATHS.includes(path)) {
    return true;
  }

  const permisoRequerido = permission || ROUTE_PERMISSIONS[path];
  if (!permisoRequerido) return true;

  const permisosNormalizados = normalizePermissions(permisos).map(normalizePermissionName);
  return permisosNormalizados.includes(normalizePermissionName(permisoRequerido));
};

// associations.js
const Usuario = require('./Usuario');
const Rol = require('./Rol');
const Agencia = require('./Agencia');
const UsuarioAgencia = require('./UsuarioAgencia');

const Venta = require('./Venta');
const DetalleVenta = require('./DetalleVenta');
const VentaObsequio = require('./VentaObsequio');
const Cliente = require('./Cliente');
const Origen = require('./Origen');

const Entrega = require('./Entrega');
const EntregaObsequio = require('./EntregaObsequio');
const Obsequio = require('./Obsequio');

const Dispositivo = require('./Dispositivo');
const CostoHistorico = require('./CostoHistorico');
const Marca = require('./Marca');
const Modelo = require('./Modelo');
const DispositivoMarca = require('./DispositivoMarca');
const formaPago = require('./FormaPago');
const DetalleEntrega = require('./DetalleEntrega');
const UsuarioAgenciaEntrega = require('./UsuarioAgenciaEntrega');
const Traslado = require('./Traslado');
const DetalleTraslado = require('./DetalleTraslado');
const Gestion = require('./Gestion');
const CierreCaja = require('./CierreCaja/CierreCaja');
const MovimientoCaja = require('./CierreCaja/MovimientoCaja');
const Denominacion = require('./CierreCaja/Denominacion');
const DenominacionCajaTemp = require('./CierreCaja/DenominacionCajaTemp');
const DenominacionCajaHistorial = require('./CierreCaja/DenominacionCajaHistorial');
const RetiroCaja = require('./CierreCaja/RetiroCaja');
const ReaperturaCierreCaja = require('./CierreCaja/ReaperturaCierreCaja');
const Task = require('./Task');
const SistemaTarea = require('./SistemaTarea');
const PlanBatalla = require('./PlanBatalla');
const SecretarioEjecutivoPlan = require('./SecretarioEjecutivoPlan');
const ConsejoEjecutivoPlan = require('./ConsejoEjecutivoPlan');
const ConsejoEjecutivoSala = require('./ConsejoEjecutivoSala');
const ConsejoEjecutivoSalaParticipante = require('./ConsejoEjecutivoSalaParticipante');
const NominaEmpleado = require('./NominaEmpleado');
const { NominaBeneficio } = require('./NominaBeneficio');
const RolPago = require('./RolPago');
require('./UsuarioRolPago');
require('./UsuarioRol');
const GestionComercial = require('./GestionComercial');
const PrecioVenta = require('./PrecioVenta');
const PresupuestoMarketing = require('./Marketing/PresupuestoMarketing');
const GastoMarketing = require('./Marketing/GastoMarketing');
require('./Marketing/PautaMarketing');
const ConciliacionLote = require('./ConciliacionLote');
const ConciliacionPdfImportacion = require('./ConciliacionPdfImportacion');
const ConciliacionModeloTv = require('./ConciliacionModeloTv');
const ConciliacionModeloCelular = require('./ConciliacionModeloCelular');
const MapaComercialZona = require('./MapaComercialZona');
const MapaUbicacionNormalizada = require('./MapaUbicacionNormalizada');
const ComisionConfiguracion = require('./ComisionConfiguracion');
const SancionConfiguracion = require('./SancionConfiguracion');
const PagoComisionMultaAjuste = require('./PagoComisionMultaAjuste');
const PagoComisionEquipoSemanal = require('./PagoComisionEquipoSemanal');
const ConfiguracionMesComision = require('./ConfiguracionMesComision');
const PagoComisionPeriodo = require('./PagoComisionPeriodo');
const MetaMinimaMultaConfiguracion = require('./MetaMinimaMultaConfiguracion');
const InventarioSistema = require('./InventarioSistema');
const ReporteCajaUsuarioAgencia = require('./ReporteCajaUsuarioAgencia');
const ControlFinancieroCarga = require('./ControlFinancieroCarga');
const ControlFinancieroRegistro = require('./ControlFinancieroRegistro');
const ControlFinancieroConciliacionEntrada = require('./ControlFinancieroConciliacionEntrada');
const ControlFinancieroConciliacionCaja = require('./ControlFinancieroConciliacionCaja');
const ControlFinancieroConciliacionManualCaja = require('./ControlFinancieroConciliacionManualCaja');
const ControlFinancieroConciliacionManualCajaDetalle = require('./ControlFinancieroConciliacionManualCajaDetalle');
const NotificacionPersonal = require('./NotificacionPersonal');
const NotificacionPersonalLectura = require('./NotificacionPersonalLectura');
const AuditoriaVentaPdf = require('./AuditoriaVentaPdf');
const DescuentoDecimo = require('./DescuentoDecimo');
const EgresoCreditekEntrada = require('./EgresoCreditekEntrada');
const RolCreditekAjuste = require('./RolCreditekAjuste');
const FacturaFisica = require('./FacturaFisica');
const FacturaFisicaProductoOcr = require('./FacturaFisicaProductoOcr');
const FacturaIaResultado = require('./FacturaIaResultado');

// -------------------- Usuario, Rol, Agencia --------------------
Usuario.belongsTo(Rol, { foreignKey: 'rolId', as: 'rol' });
Rol.hasMany(Usuario, { foreignKey: 'rolId', as: 'usuarios' });
Cliente.belongsTo(Rol, { foreignKey: 'rolId', as: 'rol' });
Rol.hasMany(Cliente, { foreignKey: 'rolId', as: 'personas' });
Usuario.belongsTo(RolPago, { foreignKey: "rolPagoId", as: "rolPago" });
RolPago.hasMany(Usuario, { foreignKey: "rolPagoId", as: "usuariosCargoPago" });
Usuario.belongsTo(Usuario, { foreignKey: "jefeComercialId", as: "jefeComercial" });
Usuario.hasMany(Usuario, { foreignKey: "jefeComercialId", as: "vendedoresJunior" });
Usuario.belongsTo(Usuario, { foreignKey: "supervisorComercialId", as: "supervisorComercial" });
Usuario.hasMany(Usuario, { foreignKey: "supervisorComercialId", as: "juniorsSupervisados" });
Usuario.hasMany(DescuentoDecimo, {
  foreignKey: "usuarioId",
  as: "descuentosDecimos",
});
DescuentoDecimo.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
DescuentoDecimo.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(EgresoCreditekEntrada, {
  foreignKey: "usuarioId",
  as: "entradasEgresosCreditek",
});
EgresoCreditekEntrada.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});
Usuario.hasMany(EgresoCreditekEntrada, {
  foreignKey: "registradoPorId",
  as: "entradasEgresosCreditekRegistradas",
});
EgresoCreditekEntrada.belongsTo(Usuario, {
  foreignKey: "registradoPorId",
  as: "registradoPor",
});
Usuario.hasMany(EgresoCreditekEntrada, {
  foreignKey: "actualizadoPorId",
  as: "entradasEgresosCreditekActualizadas",
});
EgresoCreditekEntrada.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(RolCreditekAjuste, {
  foreignKey: "usuarioId",
  as: "ajustesRolesCreditek",
});
RolCreditekAjuste.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});
RolCreditekAjuste.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(FacturaFisica, {
  foreignKey: "usuarioCargaId",
  as: "facturasFisicasCargadas",
});
FacturaFisica.belongsTo(Usuario, {
  foreignKey: "usuarioCargaId",
  as: "usuarioCarga",
});
Usuario.hasMany(FacturaFisica, {
  foreignKey: "creadoPorId",
  as: "facturasFisicasCreadas",
});
FacturaFisica.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
Usuario.hasMany(FacturaFisica, {
  foreignKey: "actualizadoPorId",
  as: "facturasFisicasActualizadas",
});
FacturaFisica.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(FacturaFisica, {
  foreignKey: "anuladoPorId",
  as: "facturasFisicasAnuladas",
});
FacturaFisica.belongsTo(Usuario, {
  foreignKey: "anuladoPorId",
  as: "anuladoPor",
});
Usuario.hasMany(FacturaFisica, {
  foreignKey: "ocrProcesadoPorId",
  as: "facturasFisicasOcrProcesadas",
});
FacturaFisica.belongsTo(Usuario, {
  foreignKey: "ocrProcesadoPorId",
  as: "ocrProcesadoPor",
});
FacturaFisica.hasMany(FacturaFisicaProductoOcr, {
  foreignKey: "facturaFisicaId",
  as: "productosOcr",
});
FacturaFisicaProductoOcr.belongsTo(FacturaFisica, {
  foreignKey: "facturaFisicaId",
  as: "facturaFisica",
});
Usuario.hasMany(FacturaFisicaProductoOcr, {
  foreignKey: "detectadoPorId",
  as: "productosFacturaOcrDetectados",
});
FacturaFisicaProductoOcr.belongsTo(Usuario, {
  foreignKey: "detectadoPorId",
  as: "detectadoPor",
});
Usuario.hasMany(FacturaFisicaProductoOcr, {
  foreignKey: "actualizadoPorId",
  as: "productosFacturaOcrActualizados",
});
FacturaFisicaProductoOcr.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(FacturaFisicaProductoOcr, {
  foreignKey: "confirmadoPorId",
  as: "productosFacturaOcrConfirmados",
});
FacturaFisicaProductoOcr.belongsTo(Usuario, {
  foreignKey: "confirmadoPorId",
  as: "confirmadoPor",
});
Usuario.hasMany(FacturaFisicaProductoOcr, {
  foreignKey: "descartadoPorId",
  as: "productosFacturaOcrDescartados",
});
FacturaFisicaProductoOcr.belongsTo(Usuario, {
  foreignKey: "descartadoPorId",
  as: "descartadoPor",
});
Usuario.hasMany(FacturaIaResultado, {
  foreignKey: "creadoPorId",
  as: "facturasIaCreadas",
});
FacturaIaResultado.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
Usuario.hasMany(FacturaIaResultado, {
  foreignKey: "seleccionadoPorId",
  as: "facturasIaSeleccionadas",
});
FacturaIaResultado.belongsTo(Usuario, {
  foreignKey: "seleccionadoPorId",
  as: "seleccionadoPor",
});

// Agencia ↔ Usuario (muchos a muchos)
Usuario.belongsToMany(Agencia, {
  through: UsuarioAgencia, 
  foreignKey: "usuarioId",
  as: "agencias",
});

Agencia.belongsToMany(Usuario, {
  through: UsuarioAgencia,
  foreignKey: "agenciaId",
  as: "usuarios",
});

// Relaciones directas para include desde UsuarioAgencia
UsuarioAgencia.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
UsuarioAgencia.belongsTo(Agencia, { foreignKey: "agenciaId", as: "agencia" });

// El evento permanece aunque el usuario de referencia deje de estar activo.
NotificacionPersonal.hasMany(NotificacionPersonalLectura, {
  foreignKey: "notificacionId",
  as: "lecturas",
});
NotificacionPersonalLectura.belongsTo(NotificacionPersonal, {
  foreignKey: "notificacionId",
  as: "notificacion",
});
Usuario.hasMany(NotificacionPersonalLectura, {
  foreignKey: "usuarioId",
  as: "lecturasNotificacionesPersonal",
});
NotificacionPersonalLectura.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "lector",
});

// -------------------- Dispositivos, Marcas, Modelos --------------------

// Dispositivo ↔ Marca (muchos a muchos)
Dispositivo.belongsToMany(Marca, {
  through: DispositivoMarca,
  foreignKey: "dispositivoId",
  as: "marcasDispositivo",
});

Marca.belongsToMany(Dispositivo, {
  through: DispositivoMarca,
  foreignKey: "marcaId",
  as: "dispositivosMarca",
});

// Marca ↔ Modelo (uno a muchos)
Marca.hasMany(Modelo, { foreignKey: "marcaId", as: "modelos" });
Modelo.belongsTo(Marca, { foreignKey: "marcaId", as: "marca" });

DispositivoMarca.belongsTo(Dispositivo, { foreignKey: "dispositivoId", as: "dispositivo" });
Dispositivo.hasMany(DispositivoMarca, { foreignKey: "dispositivoId", as: "dispositivosMarcas" });
DispositivoMarca.belongsTo(Marca, { foreignKey: "marcaId", as: "marca" });
Marca.hasMany(DispositivoMarca, { foreignKey: "marcaId", as: "marcasDispositivos" });

CostoHistorico.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(CostoHistorico, { foreignKey: "modeloId", as: "costosHistoricos" });

PrecioVenta.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(PrecioVenta, { foreignKey: "modeloId", as: "preciosVenta" });

// -------------------- Venta --------------------
Venta.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
Cliente.hasMany(Venta, { foreignKey: 'clienteId', as: 'ventas' });

Venta.belongsTo(Origen, { foreignKey: 'origenId', as: 'origen' });
Origen.hasMany(Venta, { foreignKey: 'origenId', as: 'ventas' });

Venta.hasMany(DetalleVenta, { foreignKey: 'ventaId', as: 'detalleVenta' });
DetalleVenta.belongsTo(Venta, { foreignKey: 'ventaId', as: 'venta' });

DetalleVenta.belongsTo(DispositivoMarca, { 
  foreignKey: "dispositivoMarcaId", 
  as: "dispositivoMarca" 
});

DispositivoMarca.hasMany(DetalleVenta, { 
  foreignKey: "dispositivoMarcaId", 
  as: "detallesVenta" 
});

// Relación DetalleVenta ↔ Modelo
DetalleVenta.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(DetalleVenta, { foreignKey: "modeloId", as: "detalleVentas" });

Modelo.belongsTo(DispositivoMarca, {
  foreignKey: "dispositivoMarcaId",
  as: "dispositivoMarca"
});
DispositivoMarca.hasMany(Modelo, {
  foreignKey: "dispositivoMarcaId",
  as: "modelos"
});


VentaObsequio.belongsTo(Venta, { foreignKey: "ventaId", as: "venta" });
Venta.hasMany(VentaObsequio, { foreignKey: "ventaId" , as: "obsequiosVenta" });


VentaObsequio.belongsTo(Obsequio, { foreignKey: "obsequioId", as: "obsequio" });
Obsequio.hasMany(VentaObsequio, { foreignKey: "obsequioId", as: "ventasObsequio" });

 
// DetalleVenta ↔ FormaPago
DetalleVenta.belongsTo(formaPago, {
  foreignKey: "formaPagoId",
  as: "formaPago"
});

formaPago.hasMany(DetalleVenta, {
  foreignKey: "formaPagoId",
  as: "detalleVentas"
});


// -------------------- Entrega --------------------
Entrega.belongsTo(Venta, { foreignKey: 'ventaId', as: 'venta' });
Venta.hasMany(Entrega, { foreignKey: 'ventaId', as: 'entregas' });


 

Entrega.hasMany(EntregaObsequio, { foreignKey: 'entregaId', as: 'obsequiosEntrega' });
EntregaObsequio.belongsTo(Entrega, { foreignKey: 'entregaId', as: 'entrega' });

// -------------------- Obsequio --------------------

EntregaObsequio.belongsTo(Obsequio, { foreignKey: 'obsequioId', as: 'obsequio' });
Obsequio.hasMany(EntregaObsequio, { foreignKey: 'obsequioId', as: 'entregas' });

Entrega.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
Cliente.hasMany(Entrega, { foreignKey: 'clienteId', as: 'entregas' });

Entrega.belongsTo(Origen, { foreignKey: 'origenId', as: 'origen' });
Origen.hasMany(Entrega, { foreignKey: 'origenId', as: 'entregas' });

// DetalleEntrega ↔ Entrega
DetalleEntrega.belongsTo(Entrega, { foreignKey: 'entregaId', as: 'entregaDetalle' });
Entrega.hasMany(DetalleEntrega, { foreignKey: 'entregaId', as: 'detalleEntregas' });


DetalleEntrega.belongsTo(DispositivoMarca, { 
  foreignKey: "dispositivoMarcaId", 
  as: "dispositivoMarca" 
});
DispositivoMarca.hasMany(DetalleEntrega, { 
  foreignKey: "dispositivoMarcaId", 
  as: "detalleEntregas" 
});


/* ESTADO ENTREGAS */

DetalleEntrega.belongsTo(Modelo, { foreignKey: "modeloId", as: "modelo" });
Modelo.hasMany(DetalleEntrega, { foreignKey: "modeloId", as: "detalleEntregas" });

DetalleEntrega.belongsTo(formaPago, {
  foreignKey: "formaPagoId",
  as: "formaPago"
});

formaPago.hasMany(DetalleEntrega, {
  foreignKey: "formaPagoId",
  as: "detalleEntregas"
});

/* USUARIO AGNCIAS ENTREGAS ENTREGAS */

UsuarioAgencia.belongsToMany(Entrega, {
  through: UsuarioAgenciaEntrega,
  foreignKey: "usuario_agencia_id",
  otherKey: "entrega_id",
  as: "entregas",
});

Entrega.belongsToMany(UsuarioAgencia, {
  through: UsuarioAgenciaEntrega,
  foreignKey: "entrega_id",
  otherKey: "usuario_agencia_id",
  as: "repartidores",
});


// UsuarioAgenciaEntrega → UsuarioAgencia
UsuarioAgenciaEntrega.belongsTo(UsuarioAgencia, {
  foreignKey: "usuario_agencia_id",
  as: "usuarioAgencia",
});

// UsuarioAgenciaEntrega → Entrega
UsuarioAgenciaEntrega.belongsTo(Entrega, {
  foreignKey: "entrega_id",
  as: "entrega",
});


//traslados 
// Traslado - Detalle
Traslado.hasMany(DetalleTraslado, {
  foreignKey: "trasladoId",
  as: "detalles",
});

DetalleTraslado.belongsTo(Traslado, {
  foreignKey: "trasladoId",
});

// Traslado - Agencia
Traslado.belongsTo(Agencia, {
  foreignKey: "agencia_origen_id",
  as: "agenciaOrigen",
});

Traslado.belongsTo(Agencia, {
  foreignKey: "agencia_destino_id",
  as: "agenciaDestino",
});



// DetalleTraslado relaciones faltantes (IMPORTANTE)
DetalleTraslado.belongsTo(DispositivoMarca, {
  foreignKey: "dispositivoMarcaId",
  as: "dispositivoMarca",
});

DetalleTraslado.belongsTo(Modelo, {
  foreignKey: "modeloId",
  as: "modelo",
});


/* GESTIONES */

Gestion.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

Gestion.belongsTo(Dispositivo, {
  foreignKey: "dispositivoId",
  as: "dispositivo",
});

UsuarioAgencia.hasMany(Gestion, {
  foreignKey: "usuarioAgenciaId",
  as: "gestiones",
});

Dispositivo.hasMany(Gestion, {
  foreignKey: "dispositivoId",
  as: "gestiones",
});

/* CIERRE DE CAJA */

CierreCaja.hasMany(Denominacion, {
  foreignKey: "cierreId",
  as: "denominaciones",
});

Denominacion.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});

UsuarioAgencia.hasMany(DenominacionCajaTemp, {
  foreignKey: "usuarioAgenciaId",
  as: "denominacionesCajaTemp",
});

DenominacionCajaTemp.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

UsuarioAgencia.hasMany(DenominacionCajaHistorial, {
  foreignKey: "usuarioAgenciaId",
  as: "denominacionesCajaHistorial",
});

DenominacionCajaHistorial.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

CierreCaja.hasMany(DenominacionCajaHistorial, {
  foreignKey: "cierreId",
  as: "historialDenominaciones",
});

DenominacionCajaHistorial.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});


CierreCaja.hasMany(MovimientoCaja, {
  foreignKey: "cierreId",
  as: "movimientos",
});

MovimientoCaja.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});

MovimientoCaja.belongsTo(Cliente, {
  foreignKey: "clienteId",
  as: "cliente",
});

Cliente.hasMany(MovimientoCaja, {
  foreignKey: "clienteId",
  as: "movimientosCaja",
});


CierreCaja.hasMany(RetiroCaja, {
  foreignKey: "cierreId",
  as: "retiros",
});

RetiroCaja.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});


CierreCaja.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

UsuarioAgencia.hasMany(CierreCaja, {
  foreignKey: "usuarioAgenciaId",
  as: "cierresCaja",
});

CierreCaja.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

Usuario.hasMany(CierreCaja, {
  foreignKey: "usuarioId",
  as: "cierresCajaUsuario",
});

CierreCaja.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

Agencia.hasMany(CierreCaja, {
  foreignKey: "agenciaId",
  as: "cierresCajaAgencia",
});

CierreCaja.hasMany(ReaperturaCierreCaja, {
  foreignKey: "cierreId",
  as: "reaperturas",
});

ReaperturaCierreCaja.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});

ReaperturaCierreCaja.belongsTo(Usuario, {
  foreignKey: "reabiertoPorUsuarioId",
  as: "reabiertoPor",
});

ReaperturaCierreCaja.belongsTo(Usuario, {
  foreignKey: "recerradoPorUsuarioId",
  as: "recerradoPor",
});


/* GESTOR DE TAREAS */
Usuario.hasMany(Task, { foreignKey: "createdBy", as: "createdTasks" });
Usuario.hasMany(Task, { foreignKey: "assignedTo", as: "assignedTasks" });

Task.belongsTo(Usuario, { foreignKey: "createdBy", as: "creator" });
Task.belongsTo(Usuario, { foreignKey: "assignedTo", as: "assignee" });

Usuario.hasMany(SistemaTarea, {
  foreignKey: "creadoPorId",
  as: "sistemaTareasCreadas",
});
SistemaTarea.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});

UsuarioAgencia.hasMany(PlanBatalla, {
  foreignKey: "usuarioAgenciaId",
  as: "planesBatalla",
});

PlanBatalla.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

Usuario.hasMany(SecretarioEjecutivoPlan, {
  foreignKey: "usuarioId",
  as: "planesSecretarioEjecutivo",
});

SecretarioEjecutivoPlan.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

Agencia.hasMany(SecretarioEjecutivoPlan, {
  foreignKey: "agenciaId",
  as: "planesSecretarioEjecutivo",
});

SecretarioEjecutivoPlan.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

Usuario.hasMany(ConsejoEjecutivoPlan, {
  foreignKey: "creadoPorId",
  as: "planesConsejoEjecutivoCreados",
});

ConsejoEjecutivoPlan.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});

Usuario.hasMany(ConsejoEjecutivoPlan, {
  foreignKey: "actualizadoPorId",
  as: "planesConsejoEjecutivoActualizados",
});

ConsejoEjecutivoPlan.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});

Usuario.hasMany(ConsejoEjecutivoSala, {
  foreignKey: "creadoPorId",
  as: "salasConsejoEjecutivoCreadas",
});

ConsejoEjecutivoSala.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});

ConsejoEjecutivoSala.belongsToMany(Usuario, {
  through: ConsejoEjecutivoSalaParticipante,
  foreignKey: "salaId",
  otherKey: "usuarioId",
  as: "participantes",
});

Usuario.belongsToMany(ConsejoEjecutivoSala, {
  through: ConsejoEjecutivoSalaParticipante,
  foreignKey: "usuarioId",
  otherKey: "salaId",
  as: "salasConsejoEjecutivo",
});

ConsejoEjecutivoSala.hasMany(ConsejoEjecutivoSalaParticipante, {
  foreignKey: "salaId",
  as: "invitaciones",
});

ConsejoEjecutivoSalaParticipante.belongsTo(ConsejoEjecutivoSala, {
  foreignKey: "salaId",
  as: "sala",
});

ConsejoEjecutivoSalaParticipante.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "participante",
});

ConsejoEjecutivoSalaParticipante.belongsTo(Usuario, {
  foreignKey: "invitadoPorId",
  as: "invitadoPor",
});

ConsejoEjecutivoSala.hasMany(ConsejoEjecutivoPlan, {
  foreignKey: "salaId",
  as: "planes",
});

ConsejoEjecutivoPlan.belongsTo(ConsejoEjecutivoSala, {
  foreignKey: "salaId",
  as: "sala",
});

/* NOMINA */
Usuario.hasMany(NominaEmpleado, {
  foreignKey: "usuarioId",
  as: "nominaEmpleados",
});

NominaEmpleado.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

UsuarioAgencia.hasOne(NominaEmpleado, {
  foreignKey: "usuarioAgenciaId",
  as: "nominaEmpleado",
});

NominaEmpleado.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

NominaEmpleado.hasMany(NominaBeneficio, {
  foreignKey: "nominaEmpleadoId",
  as: "beneficios",
});

NominaBeneficio.belongsTo(NominaEmpleado, {
  foreignKey: "nominaEmpleadoId",
  as: "nominaEmpleado",
});

RolPago.hasMany(NominaEmpleado, {
  foreignKey: "rolPagoId",
  as: "nominaEmpleados",
});

NominaEmpleado.belongsTo(RolPago, {
  foreignKey: "rolPagoId",
  as: "rolPago",
});

RolPago.hasMany(SancionConfiguracion, { foreignKey: "rolPagoId", as: "sancionesConfiguracion" });
SancionConfiguracion.belongsTo(RolPago, { foreignKey: "rolPagoId", as: "rolPago" });
RolPago.hasMany(ComisionConfiguracion, { foreignKey: "rolPagoId", as: "comisionesConfiguracion" });
ComisionConfiguracion.belongsTo(RolPago, { foreignKey: "rolPagoId", as: "rolPago" });
RolPago.hasOne(MetaMinimaMultaConfiguracion, {
  foreignKey: "rolPagoId",
  as: "metaMinimaMultaConfiguracion",
});
MetaMinimaMultaConfiguracion.belongsTo(RolPago, {
  foreignKey: "rolPagoId",
  as: "rolPago",
});
Usuario.hasMany(PagoComisionMultaAjuste, {
  foreignKey: "usuarioId",
  as: "ajustesMultasComisiones",
});
PagoComisionMultaAjuste.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "vendedor",
});
Usuario.hasMany(PagoComisionMultaAjuste, {
  foreignKey: "actualizadoPorId",
  as: "ajustesMultasComisionesRealizados",
});
PagoComisionMultaAjuste.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(PagoComisionEquipoSemanal, {
  foreignKey: "jefeComercialId",
  as: "equiposComisionesSemanales",
});
PagoComisionEquipoSemanal.belongsTo(Usuario, {
  foreignKey: "jefeComercialId",
  as: "jefeComercial",
});
Usuario.hasMany(PagoComisionEquipoSemanal, {
  foreignKey: "actualizadoPorId",
  as: "equiposComisionesSemanalesActualizados",
});
PagoComisionEquipoSemanal.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(ConfiguracionMesComision, {
  foreignKey: "creadoPorId",
  as: "configuracionesMesesComisionesCreadas",
});
ConfiguracionMesComision.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
Usuario.hasMany(ConfiguracionMesComision, {
  foreignKey: "actualizadoPorId",
  as: "configuracionesMesesComisionesActualizadas",
});
ConfiguracionMesComision.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});
Usuario.hasMany(PagoComisionPeriodo, {
  foreignKey: "pagadoPorId",
  as: "periodosComisionesPagados",
});
PagoComisionPeriodo.belongsTo(Usuario, {
  foreignKey: "pagadoPorId",
  as: "pagadoPor",
});
Usuario.hasMany(MetaMinimaMultaConfiguracion, {
  foreignKey: "creadoPorId",
  as: "metasMinimasMultasCreadas",
});
MetaMinimaMultaConfiguracion.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});
Usuario.hasMany(MetaMinimaMultaConfiguracion, {
  foreignKey: "actualizadoPorId",
  as: "metasMinimasMultasActualizadas",
});
MetaMinimaMultaConfiguracion.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});

/* GESTIONES COMERCIALES */

// UsuarioAgencia -> GestionComercial
UsuarioAgencia.hasMany(GestionComercial, {
  foreignKey: "usuarioAgenciaId",
  as: "gestionesComerciales",
});

GestionComercial.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

// Dispositivo -> GestionComercial
Dispositivo.hasMany(GestionComercial, {
  foreignKey: "dispositivoId",
  as: "gestionesComerciales",
});

GestionComercial.belongsTo(Dispositivo, {
  foreignKey: "dispositivoId",
  as: "dispositivo",
});

Cliente.hasMany(GestionComercial, {
  foreignKey: "clienteId",
  as: "gestionesComerciales",
});

GestionComercial.belongsTo(Cliente, {
  foreignKey: "clienteId",
  as: "persona",
});

/* MARKETING */

PresupuestoMarketing.belongsTo(Agencia, {
  foreignKey: "departamentoId",
  as: "departamento",
});

Agencia.hasMany(PresupuestoMarketing, {
  foreignKey: "departamentoId",
  as: "presupuestosMarketing",
});

GastoMarketing.belongsTo(Agencia, {
  foreignKey: "departamentoId",
  as: "departamento",
});

Agencia.hasMany(GastoMarketing, {
  foreignKey: "departamentoId",
  as: "gastosMarketing",
});

/* CONCILIACION PDF */

ConciliacionLote.hasMany(ConciliacionPdfImportacion, {
  foreignKey: "loteImportacionId",
  as: "importaciones",
});

ConciliacionPdfImportacion.belongsTo(ConciliacionLote, {
  foreignKey: "loteImportacionId",
  as: "lote",
});

Usuario.hasMany(ConciliacionLote, {
  foreignKey: "usuarioId",
  as: "conciliacionLotes",
});

ConciliacionLote.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

ConciliacionModeloTv.belongsTo(Modelo, {
  foreignKey: "modeloRveId",
  as: "modeloRve",
});

Modelo.hasMany(ConciliacionModeloTv, {
  foreignKey: "modeloRveId",
  as: "mapeosConciliacionTv",
});

ConciliacionModeloCelular.belongsTo(Modelo, {
  foreignKey: "modeloRveId",
  as: "modeloRve",
});

Modelo.hasMany(ConciliacionModeloCelular, {
  foreignKey: "modeloRveId",
  as: "mapeosConciliacionCelular",
});

/* MAPA COMERCIAL */

MapaComercialZona.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

Agencia.hasMany(MapaComercialZona, {
  foreignKey: "agenciaId",
  as: "mapaComercialZonas",
});

/* INVENTARIO SISTEMAS */

InventarioSistema.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

Agencia.hasMany(InventarioSistema, {
  foreignKey: "agenciaId",
  as: "inventariosSistemas",
});

InventarioSistema.belongsTo(Usuario, {
  foreignKey: "responsableId",
  as: "responsable",
});

InventarioSistema.belongsTo(Usuario, {
  foreignKey: "creadoPorId",
  as: "creadoPor",
});

InventarioSistema.belongsTo(Usuario, {
  foreignKey: "actualizadoPorId",
  as: "actualizadoPor",
});

/* CONFIGURACION AGENCIAS DE REPORTES DE CAJA */

ReporteCajaUsuarioAgencia.belongsTo(Agencia, {
  foreignKey: "agenciaId",
  as: "agencia",
});

Agencia.hasMany(ReporteCajaUsuarioAgencia, {
  foreignKey: "agenciaId",
  as: "usuariosReportesCaja",
});

/* CONTROL FINANCIERO */

ControlFinancieroCarga.hasMany(ControlFinancieroRegistro, {
  foreignKey: "cargaId",
  as: "registros",
  onDelete: "CASCADE",
});

ControlFinancieroRegistro.belongsTo(ControlFinancieroCarga, {
  foreignKey: "cargaId",
  as: "carga",
});

Usuario.hasMany(ControlFinancieroRegistro, {
  foreignKey: "responsablePagoEntradaId",
  as: "registrosControlFinancieroResponsables",
});

ControlFinancieroRegistro.belongsTo(Usuario, {
  foreignKey: "responsablePagoEntradaId",
  as: "responsablePagoEntrada",
});

Usuario.hasMany(ControlFinancieroCarga, {
  foreignKey: "usuarioId",
  as: "cargasControlFinanciero",
});

ControlFinancieroCarga.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

Usuario.hasMany(ControlFinancieroCarga, {
  foreignKey: "anuladoPor",
  as: "cargasAnuladasControlFinanciero",
});

ControlFinancieroCarga.belongsTo(Usuario, {
  foreignKey: "anuladoPor",
  as: "usuarioAnulador",
});

ControlFinancieroCarga.hasMany(ControlFinancieroConciliacionEntrada, {
  foreignKey: "cargaId",
  as: "conciliacionesEntradas",
  onDelete: "RESTRICT",
});

ControlFinancieroConciliacionEntrada.belongsTo(ControlFinancieroCarga, {
  foreignKey: "cargaId",
  as: "carga",
});

CierreCaja.hasMany(ControlFinancieroConciliacionEntrada, {
  foreignKey: "cierreId",
  as: "conciliacionesEntradas",
});

ControlFinancieroConciliacionEntrada.belongsTo(CierreCaja, {
  foreignKey: "cierreId",
  as: "cierre",
});

Usuario.hasMany(ControlFinancieroConciliacionEntrada, {
  foreignKey: "ejecutadoPor",
  as: "conciliacionesEntradasEjecutadas",
});

ControlFinancieroConciliacionEntrada.belongsTo(Usuario, {
  foreignKey: "ejecutadoPor",
  as: "ejecutor",
});

ControlFinancieroCarga.hasMany(ControlFinancieroConciliacionCaja, {
  foreignKey: "cargaId",
  as: "conciliacionesCaja",
  onDelete: "RESTRICT",
});

ControlFinancieroConciliacionCaja.belongsTo(ControlFinancieroCarga, {
  foreignKey: "cargaId",
  as: "carga",
});

Usuario.hasMany(ControlFinancieroConciliacionCaja, {
  foreignKey: "ejecutadoPor",
  as: "conciliacionesCajaEjecutadas",
});

ControlFinancieroConciliacionCaja.belongsTo(Usuario, {
  foreignKey: "ejecutadoPor",
  as: "ejecutor",
});

ControlFinancieroCarga.hasMany(ControlFinancieroConciliacionManualCaja, {
  foreignKey: "cargaId",
  as: "conciliacionesCajaManual",
  onDelete: "RESTRICT",
});

ControlFinancieroConciliacionManualCaja.belongsTo(ControlFinancieroCarga, {
  foreignKey: "cargaId",
  as: "carga",
});

ControlFinancieroConciliacionManualCaja.hasMany(
  ControlFinancieroConciliacionManualCajaDetalle,
  {
    foreignKey: "conciliacionManualId",
    as: "detalles",
    onDelete: "RESTRICT",
  },
);

ControlFinancieroConciliacionManualCajaDetalle.belongsTo(
  ControlFinancieroConciliacionManualCaja,
  {
    foreignKey: "conciliacionManualId",
    as: "conciliacionManual",
  },
);

ControlFinancieroRegistro.hasMany(ControlFinancieroConciliacionManualCajaDetalle, {
  foreignKey: "registroReporteId",
  as: "conciliacionesCajaManualDetalleReporte",
  onDelete: "RESTRICT",
});

ControlFinancieroConciliacionManualCajaDetalle.belongsTo(ControlFinancieroRegistro, {
  foreignKey: "registroReporteId",
  as: "registroReporte",
});

MovimientoCaja.hasMany(ControlFinancieroConciliacionManualCajaDetalle, {
  foreignKey: "movimientoCajaId",
  as: "conciliacionesCajaManualDetalle",
  onDelete: "RESTRICT",
});

ControlFinancieroConciliacionManualCajaDetalle.belongsTo(MovimientoCaja, {
  foreignKey: "movimientoCajaId",
  as: "movimientoCaja",
});

Usuario.hasMany(ControlFinancieroConciliacionManualCaja, {
  foreignKey: "relacionadoPor",
  as: "conciliacionesCajaManualCreadas",
});

ControlFinancieroConciliacionManualCaja.belongsTo(Usuario, {
  foreignKey: "relacionadoPor",
  as: "usuarioRelaciono",
});

Usuario.hasMany(ControlFinancieroConciliacionManualCaja, {
  foreignKey: "deshechoPor",
  as: "conciliacionesCajaManualDeshechas",
});

ControlFinancieroConciliacionManualCaja.belongsTo(Usuario, {
  foreignKey: "deshechoPor",
  as: "usuarioDeshizo",
});

Usuario.hasMany(AuditoriaVentaPdf, {
  foreignKey: "usuarioId",
  as: "auditoriasVentasPdf",
});

AuditoriaVentaPdf.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

ControlFinancieroCarga.hasMany(AuditoriaVentaPdf, {
  foreignKey: "controlFinancieroCargaId",
  as: "auditoriasVentasPdf",
});

AuditoriaVentaPdf.belongsTo(ControlFinancieroCarga, {
  foreignKey: "controlFinancieroCargaId",
  as: "cargaControlFinanciero",
});

MapaUbicacionNormalizada.belongsTo(MapaComercialZona, {
  foreignKey: "zonaId",
  as: "zona",
});

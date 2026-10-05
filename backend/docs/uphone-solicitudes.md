# Solicitudes Uphone

## Importar un reporte

`POST https://api.creditek-ecuador.com/api/uphone/solicitudes/importar`

La integracion debe apuntar directamente al dominio del backend
(`api.creditek-ecuador.com`), no al dominio del frontend
(`rve.creditek-ecuador.com`). La ruta y el contrato HTTP se mantienen sin
cambios.

- Autenticacion: encabezado `X-API-Key`.
- No requiere ni acepta el token JWT como reemplazo de la API key.
- Formato: `multipart/form-data`.
- Campo del archivo: `archivo`.
- Extension: `.xlsx`.
- Limites: 10 MB y 25.000 filas por archivo.

Ejemplo:

```bash
curl -X POST "https://api.creditek-ecuador.com/api/uphone/solicitudes/importar" \
  -H "X-API-Key: API_KEY_UPHONE" \
  -F "archivo=@Solicitudes-Uphone.xlsx"
```

Desde una computadora Windows con PowerShell:

```powershell
curl.exe -X POST "https://api.creditek-ecuador.com/api/uphone/solicitudes/importar" `
  -H "X-API-Key: API_KEY_UPHONE" `
  -F "archivo=@C:\Reportes\Solicitudes-Uphone.xlsx"
```

La clave se configura en el servidor como `API_KEY_RVE` y debe tener
al menos 32 caracteres. Debe guardarse solo en el servidor RVE y en la
computadora integradora; nunca debe incluirse en el frontend ni en Git.
`docker-compose.yml` entrega esta variable exclusivamente al contenedor
`backend`; antes de recrearlo, se debe definir `API_KEY_RVE` en el archivo
`.env` privado del despliegue.

Para generar una clave aleatoria:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

La respuesta informa `insertadas`, `actualizadas`, `omitidasDuplicadas`,
`omitidasInvalidas` y `omitidasVacias`. `CONTRATO_APROBADO` tiene prioridad sobre
`SOLICITUD_APROBADA`, `SOLICITUD_APROBADA_AUTOMATICO`, `SOLICITUD_DENEGADA`,
`SOLICITUD_LLAMADA`, `SOLICITUD_LLAMADA_APROBADA` y
`SOLICITUD_LLAMADA_DENEGADA`. Aprobar una solicitud no equivale a aprobar un
contrato.

Si primero se importa una solicitud y despues llega su contrato aprobado, se
actualiza la fila existente, identificada por numero de solicitud o por cedula
normalizada y dia de solicitud en Ecuador. Si cambia el numero dentro del mismo
dia, se conserva el numero y los datos del contrato aprobado. La fila mantiene
su `id` y fecha de creacion. Esa actualizacion se informa en `actualizadas` y no
se cuenta como duplicada. Un contrato aprobado ya guardado no se reemplaza por
estados anteriores ni por volver a importar el mismo archivo.

Dentro de un archivo, el contrato aprobado se elige antes de descartar filas
repetidas, independientemente de su orden. Los indices unicos existentes por
numero de solicitud y por cedula/dia se mantienen. Las cargas automaticas y
manuales comparten una transaccion y un bloqueo de importacion para evitar
regresiones durante cargas simultaneas. Si falla una escritura, se revierte toda
la carga. No se requiere una migracion adicional para esta prioridad.

Se acepta el encabezado original `NUMERO DE SOLICTUD` y tambien la escritura
corregida `NUMERO DE SOLICITUD` (con o sin tildes).

## Consultar

`GET /api/uphone/solicitudes`

Parametros opcionales: `page`, `pageSize` (maximo 100), `q`, `estado`,
`fechaDesde`, `fechaHasta`, `agencia` y `usuariosUphone`. Este ultimo acepta
varios codigos separados por coma. El parametro anterior `usuarioUphone` sigue
siendo compatible para consultas de un solo usuario. Las fechas utilizan el
formato `YYYY-MM-DD` y la zona horaria de Ecuador. Esta consulta sigue usando el
token normal de RVE y requiere permiso `Gerencia`, `Administracion` o
`Sistemas`.

La respuesta incluye `dashboard`, un resumen independiente de la pagina y de
los filtros de la tabla, con cantidad total, distribucion por estado,
agencia con mas solicitudes y cantidades aprobadas, denegadas y restantes por
agencia. Para clasificar aprobaciones y denegaciones se toma primero
`estadoContrato` y, si no contiene un resultado reconocible, se usa `estado`.
La agencia corresponde a `distribuidor`, con `matriz` como respaldo cuando el
primero esta vacio.

El periodo del resumen se controla con `dashboardFechaDesde` y
`dashboardFechaHasta` en formato `YYYY-MM-DD`. Los filtros adicionales son
`dashboardAgencia` y `dashboardUsuariosUphone` (varios codigos separados por
coma). Si no se envian fechas, ambas toman la fecha actual de Ecuador, por lo
que el dashboard es diario por defecto. La respuesta devuelve los filtros
aplicados en `dashboard.periodo` y los catalogos independientes en
`dashboard.agenciasDisponibles` y `dashboard.usuarios`.

`dashboard.vendedores` resume clientes unicos por usuario Uphone e incluye los
campos `clientes`, `aprobadas`, `concretadas`, `denegadas` y `otros`. La
clasificacion toma primero `estadoContrato` y usa `estado` cuando el contrato
no contiene un resultado reconocible. `concretadas` es una metrica adicional:
una solicitud sigue contando como aprobada y tambien se considera concretada
cuando tiene una fecha de contrato util, distinta de valores como `NO APLICA`,
`N/A`, `S/N`, `SIN FECHA` o `PENDIENTE`. El mismo conteo se incluye en cada
elemento de `dashboard.agencias`.

La tabla, los totales, el dashboard (incluidos vendedores y telefonos) y la
exportacion aplican la misma prioridad por cedula normalizada. Si un cliente
tiene un contrato aprobado, solo se muestra y contabiliza ese contrato; las
otras solicitudes quedan fuera incluso si tienen otra fecha, agencia o usuario
Uphone. La prioridad se resuelve sobre todo el historico antes de aplicar los
filtros, de modo que filtrar por una agencia anterior no recupera solicitudes
que ya fueron reemplazadas por una venta. Si hay varios contratos aprobados de
la misma cedula, se elige el de fecha de solicitud mas reciente; a igual fecha,
el de mayor `id`.

Las filas historicas de otras fechas o duplicados antiguos se conservan en la
base de datos. Sin contrato aprobado, se mantiene el comportamiento de
solicitudes por dia; para vendedores se cuenta un cliente por cedula y dia.
Las solicitudes sin una cedula utilizable se consideran clientes independientes
para evitar unir personas por error. Si una carga anterior omitio el contrato
como duplicado, debe volver a enviarse el reporte que contiene el contrato
aprobado para actualizar el registro guardado.

## Migracion

Ejecutar, en orden, las migraciones
`202609280004-create-uphone-solicitudes.sql`,
`202609280005-allow-uphone-api-key-imports.sql`,
`202609290002-add-uphone-cedula-unique.sql` y
`202609300001-uphone-cedula-unique-por-dia.sql` en PostgreSQL. No eliminan
solicitudes. La ultima migracion permite repetir una cedula en fechas distintas
y mantiene la proteccion contra duplicados dentro del mismo dia.
La segunda permite registrar una carga de integración sin asociarla
artificialmente con un usuario RVE.

Verificacion recomendada antes y despues:

```sql
SELECT
  COUNT(*) AS total,
  COUNT(DISTINCT "numeroSolicitud") AS solicitudes_unicas
FROM uphone_solicitudes;
```

Ambos conteos deben coincidir.

## Carga manual de contingencia

La pantalla `Jefes comerciales > Uphone` permite seleccionar el mismo archivo
`.xlsx` y enviarlo manualmente. Internamente utiliza:

`POST /api/uphone/solicitudes/importar-manual`

Este endpoint no usa la API key: requiere la sesion JWT normal de RVE y uno de
los permisos `Gerencia`, `Administracion` o `Sistemas`. La persona que realiza
la carga queda registrada en `importadoPorId`. Las restricciones unicas y la
prioridad de `CONTRATO_APROBADO` se aplican tanto en cargas automaticas como
manuales. La interfaz informa por separado las solicitudes nuevas y las
actualizadas con contrato aprobado.

## Verificar la prioridad

Prueba manual: cargar una cedula con `SOLICITUD_APROBADA_AUTOMATICO`; enviar
despues el mismo cliente con `CONTRATO_APROBADO` (tambien con otro numero del
mismo dia); comprobar que aparece el contrato en la tabla, exportacion e
indicadores. Reenviar el archivo anterior no debe rebajar el contrato. Repetir
con otra fecha, agencia y usuario para verificar que solo cuenta la venta.

Pruebas unitarias desde `backend/`:

```bash
npm test -- --runInBand --silent services/uphoneSolicitudesService.test.js controllers/Gerencia/uphoneSolicitudesController.test.js routes/Gerencia/uphoneSolicitudesRoutes.test.js
```

Las pruebas PostgreSQL de `services/uphoneSolicitudesService.integration.test.js`
requieren `UPHONE_TEST_DATABASE_URL` apuntando a una base temporal en
`127.0.0.1`, llamada `rve_uphone_test`, con usuario `uphone_test`. Se ejecutan
con `npm test -- --runInBand --silent services/uphoneSolicitudesService.integration.test.js`.
La suite omite estas pruebas si la variable no esta definida.

# Solicitudes Uphone

## Importar un reporte

`POST /api/uphone/solicitudes/importar`

- Autenticacion: encabezado `X-API-Key`.
- No requiere ni acepta el token JWT como reemplazo de la API key.
- Formato: `multipart/form-data`.
- Campo del archivo: `archivo`.
- Extension: `.xlsx`.
- Limites: 10 MB y 25.000 filas por archivo.

Ejemplo:

```bash
curl -X POST "https://rve.creditek-ecuador.com/api/uphone/solicitudes/importar" \
  -H "X-API-Key: API_KEY_UPHONE" \
  -F "archivo=@Solicitudes-Uphone.xlsx"
```

Desde una computadora Windows con PowerShell:

```powershell
curl.exe -X POST "https://rve.creditek-ecuador.com/api/uphone/solicitudes/importar" `
  -H "X-API-Key: API_KEY_UPHONE" `
  -F "archivo=@C:\Reportes\Solicitudes-Uphone.xlsx"
```

La clave se configura en el servidor como `API_KEY_RVE` y debe tener
al menos 32 caracteres. Debe guardarse solo en el servidor RVE y en la
computadora integradora; nunca debe incluirse en el frontend ni en Git.

Para generar una clave aleatoria:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

La respuesta informa `insertadas`, `omitidasDuplicadas`, `omitidasInvalidas` y
`omitidasVacias`. El campo `numeroSolicitud` tiene un indice unico en PostgreSQL;
por ello una solicitud existente se omite incluso si dos cargas coinciden en el
tiempo. La cedula normalizada tambien evita duplicados, pero solo dentro del
mismo dia de solicitud en Ecuador: una aparicion en una fecha posterior se
conserva. No se actualiza ni reemplaza la fila anterior.

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

Para los indicadores se identifica al cliente por su cedula normalizada y por
el dia de la solicitud en Ecuador. Si un cliente tiene uno o mas contratos
aprobados dentro del mismo dia, se conserva como valida solamente la aprobacion
mas reciente de ese dia; sus otras solicitudes de la misma fecha se reportan
como `INVALIDADA_POR_CONTRATO_APROBADO`. Si vuelve a aparecer en una fecha
distinta, la nueva solicitud se conserva y contabiliza. Los registros
originales no se borran ni se actualizan. Las solicitudes sin una cedula
utilizable se consideran clientes independientes para evitar unir personas por
error.

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
la carga queda registrada en `importadoPorId`. La misma restriccion unica por
numero de solicitud protege tanto las cargas automaticas como las manuales.

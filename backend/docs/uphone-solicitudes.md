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
tiempo. No se actualiza ni reemplaza la fila anterior.

Se acepta el encabezado original `NUMERO DE SOLICTUD` y tambien la escritura
corregida `NUMERO DE SOLICITUD` (con o sin tildes).

## Consultar

`GET /api/uphone/solicitudes`

Parametros opcionales: `page`, `pageSize` (maximo 100), `q`, `estado`,
`fechaDesde` y `fechaHasta`. Las fechas utilizan el formato `YYYY-MM-DD` y la
zona horaria de Ecuador. Esta consulta sigue usando el token normal de RVE y
requiere permiso `Gerencia`, `Administracion` o `Sistemas`.

## Migracion

Ejecutar, en orden, las migraciones
`202609280004-create-uphone-solicitudes.sql` y
`202609280005-allow-uphone-api-key-imports.sql` en PostgreSQL. No eliminan datos
y la segunda permite registrar una carga de integración sin asociarla
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

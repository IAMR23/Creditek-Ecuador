# API diaria de ventas para reportes de caja

Estas integraciones cargan los mismos PDFs de **Ventas celular** y **Ventas TV**
que se procesan en `Contabilidad > Extraccion de reportes caja`. Cada tipo tiene
una URL independiente y ambos usan la misma API key de RVE. No requieren JWT.

## Configuracion del servidor

Definir una clave de al menos 32 caracteres y reiniciar el backend:

```env
API_KEY_RVE=GENERAR_UNA_CLAVE_SEGURA
```

Esta es la misma clave utilizada por la importacion de Uphone. No enviarla en
el cuerpo o en la URL; se transmite unicamente en el encabezado `X-API-Key`
sobre HTTPS.

## Celulares

`POST https://api.creditek-ecuador.com/api/contabilidad/reportes-caja-ventas/celulares/importar`

```bash
curl -X POST "https://api.creditek-ecuador.com/api/contabilidad/reportes-caja-ventas/celulares/importar" \
  -H "X-API-Key: API_KEY_RVE" \
  -F "archivos=@Ventas-Celulares-1.pdf" \
  -F "archivos=@Ventas-Celulares-2.pdf"
```

## Televisiones

`POST https://api.creditek-ecuador.com/api/contabilidad/reportes-caja-ventas/televisiones/importar`

```bash
curl -X POST "https://api.creditek-ecuador.com/api/contabilidad/reportes-caja-ventas/televisiones/importar" \
  -H "X-API-Key: API_KEY_RVE" \
  -F "archivos=@Ventas-TV-1.pdf" \
  -F "archivos=@Ventas-TV-2.pdf"
```

En Windows PowerShell se debe usar `curl.exe` si se desea conservar esta misma
sintaxis:

```powershell
curl.exe -X POST "https://api.creditek-ecuador.com/api/contabilidad/reportes-caja-ventas/celulares/importar" `
  -H "X-API-Key: API_KEY_RVE" `
  -F "archivos=@C:\Reportes\Ventas-Celulares.pdf"
```

## Contrato de carga

- Content-Type: `multipart/form-data`.
- Campo recomendado: `archivos`, repetido una vez por PDF.
- Tambien se acepta `archivo` para una o varias partes.
- Maximo 50 PDFs por solicitud y 25 MB por PDF.
- Enviar solamente PDFs del tipo correspondiente al endpoint.
- Para el proceso diario, agrupar en una solicitud los documentos de una misma
  fecha de reporte.

Una importacion nueva responde `201`. Una repeticion valida cuyos registros ya
existen responde `200`; el proceso es idempotente y no duplica los archivos ni
los registros ya consolidados.

Ejemplo de respuesta:

```json
{
  "ok": true,
  "message": "Los PDFs de celulares se importaron correctamente",
  "requestId": "2db5e94a-7d63-4eb7-a284-94afd27ef1d3",
  "tipo": "CELULAR",
  "resultado": {
    "fechaReporte": "2026-10-14",
    "cargaId": 44,
    "cargaNueva": true,
    "archivosRecibidos": 2,
    "archivosAgregados": 2,
    "archivosOmitidos": 0,
    "registrosProcesados": 18,
    "registrosAgregados": 18,
    "registrosOmitidos": 0,
    "conciliacionEntradasId": 55,
    "auditoria": {
      "estado": "COMPLETADA",
      "inconsistencias": 0,
      "tv": { "aplica": false, "registros": 0, "inconsistencias": 0 },
      "celular": { "aplica": true, "registros": 18, "inconsistencias": 0 },
      "errores": []
    }
  }
}
```

## Respuestas de error

- `400 ARCHIVO_INVALIDO`: extension, campo o limites de carga no validos.
- `400 ARCHIVOS_REQUERIDOS`: no se adjunto ningun PDF.
- `401 ..._API_KEY_MISSING`: no se envio `X-API-Key`.
- `401 ..._API_KEY_INVALID`: la clave no corresponde a `API_KEY_RVE`.
- `503 ..._API_KEY_NOT_CONFIGURED`: falta configurar una clave segura en el
  servidor.
- `500 REPORTES_CAJA_IMPORT_ERROR`: fallo de extraccion o persistencia.

Todas las respuestas incluyen `X-Request-Id`; usar ese valor para rastrear una
ejecucion fallida sin compartir la API key.

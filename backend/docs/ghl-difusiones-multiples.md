# Difusiones GHL simultáneas y programadas

El módulo permite conservar varias difusiones en estado `pending` o `running`.
Cada una mantiene su propia fecha de inicio, siguiente lote, intervalo y progreso.

Esto permite, por ejemplo:

- Programar una difusión para las 15:00 y otra para las 17:00.
- Crear una difusión inmediata aunque ya existan campañas futuras programadas.
- Cancelar únicamente los contactos pendientes de una difusión sin afectar las demás.
- Continuar procesando otras campañas si una ejecución presenta un error aislado.

## Migración

Desde `backend/`:

```bash
npm run migrate:ghl-broadcasts
```

La migración `202610060005-allow-multiple-ghl-broadcasts.sql` elimina solamente
el índice único que imponía una campaña global. No elimina ejecuciones, detalles
ni historial. El arranque del backend también corrige el índice en instalaciones
existentes.

## API

`GET /api/ghl/difusiones/ejecuciones/activa` conserva el campo `execution` por
compatibilidad y agrega `executions` con todas las campañas activas o programadas.

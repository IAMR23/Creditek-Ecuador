# Caché persistente de stock Contífico

El módulo de stock de Logística guarda en PostgreSQL el catálogo de productos y
bodegas, además del desglose de stock de cada producto. La tabla utilizada es
`logistica_contifico_cache`.

## Comportamiento

- Una consulta normal usa primero la memoria del proceso y luego PostgreSQL.
- Si el dato persistido sigue vigente, la respuesta no llama a Contífico.
- Si está vencido, el backend responde inmediatamente con el último dato
  guardado y actualiza Contífico en segundo plano.
- La opción **Actualizar datos** envía `actualizar=true`, espera la respuesta de
  Contífico y reemplaza la copia persistida.
- Si Contífico no está disponible, se conserva la última respuesta válida y la
  API marca la respuesta como desactualizada mediante `meta.stale` y
  `meta.warning`.

Los tiempos de vigencia existentes se mantienen configurables:

- `CONTIFICO_CATALOG_CACHE_TTL_MS` (por defecto 300000 ms).
- `CONTIFICO_STOCK_CACHE_TTL_MS` (por defecto 120000 ms).

## Migración

Desde `backend/`:

```bash
npm run migrate:contifico-stock-cache
```

El arranque del backend también aplica la migración idempotente cuando detecta
que la tabla todavía no existe.

## Prueba manual

1. Abrir **Logística > Stock Contífico** y ejecutar **Actualizar datos** una vez.
2. Reiniciar el backend.
3. Volver a abrir la vista. El catálogo y los desgloses ya consultados deben
   mostrarse desde la base persistente sin esperar a Contífico.
4. Presionar **Actualizar datos** para forzar una sincronización remota.

Las respuestas incluyen `meta.source` con `contifico`, `cache` o `persistencia`
para identificar el origen del dato.

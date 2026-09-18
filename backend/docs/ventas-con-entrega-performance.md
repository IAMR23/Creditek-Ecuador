# Diagnostico de rendimiento: Reporte de Entregas 2

Fecha de medicion: 2026-09-18  
Base usada: PostgreSQL local de pruebas `BDD` (no produccion)  
Periodo representativo: 2026-09-01 a 2026-09-18

## Volumen observado

| Tabla | Filas |
| --- | ---: |
| `ventas` | 4.573 |
| `detalle_ventas` | 4.574 |
| `control_financiero_registros` | 5.040 |
| `control_financiero_cargas` | 76 |
| `entregas` | 1.966 |
| `clientes` | 4.095 |

## Evidencia anterior (`EXPLAIN (ANALYZE, BUFFERS)`)

| Consulta | Tiempo | Resultado/filas relevantes |
| --- | ---: | --- |
| Informe principal | 6.368,966 ms | 148 filas SQL; 102 ventas consolidadas |
| Dashboard | 6.340,847 ms | 2 filas agregadas |
| `control_candidatos` | 6.301,162 ms | 1.073 candidatos |
| Relacion directa por `ventaId` | 0,714 ms | 0 filas en el periodo de prueba |
| Relacion alternativa por cedula | 4,325 ms | 179 filas |

El cuello de botella fue la union de `detalle_ventas` con
`control_financiero_registros`. El plan materializo 1.031 registros
financieros 4.574 veces: 4.715.794 combinaciones intermedias. El filtro de
union elimino 4.714.721 filas despues de ejecutar `TRIM`, `LOWER`,
`REGEXP_REPLACE` y la conversion de fecha.

Los `Seq Scan` relevantes antes del cambio fueron:

- `detalle_ventas`: 4.574 filas.
- `control_financiero_registros`: 1.031 filas utiles y 4.009 descartadas.
- `ventas`: 4.352 activas y 221 descartadas.
- `clientes`: 4.024 cedulas validas y 71 descartadas.
- `entregas`: 1.872 activas y 94 descartadas.

El indice primario de `control_financiero_cargas` si se usaba. Los indices
existentes sobre el contrato original no podian resolver la expresion
normalizada. La base local tampoco tenia aplicado `entregas_venta_id_idx`,
aunque ya estaba declarado en la migracion historica de Venta-Entrega.

## Cambio aplicado

- Se persistieron contrato, IMEI y fecha normalizados en Control Financiero.
- Se persistieron contrato/referencia normalizados en `detalle_ventas` y cedula
  normalizada en `clientes`.
- Triggers idempotentes mantienen esos valores en inserciones y actualizaciones.
- El backfill no modifica los campos historicos originales.
- La union costosa con `OR` se cambio por dos busquedas indexadas: IMEI con
  prioridad 0 y contrato con prioridad 1.
- La fecha se filtra por un intervalo semiabierto, sin convertir la columna en
  cada fila.
- La agregacion de detalles se ejecuta solo para las ventas de la pagina.
- El listado pagina en PostgreSQL y el dashboard se solicita por separado.
- La exportacion usa `exportar=true` y conserva la consulta completa.

## Evidencia posterior (`EXPLAIN (ANALYZE, BUFFERS)`)

Medianas de tres ejecuciones con cache caliente:

| Consulta | Antes | Despues | Mejora |
| --- | ---: | ---: | ---: |
| Informe principal (pagina 1, 25 ventas) | 6.368,966 ms | 72,949 ms | 87,3x |
| Dashboard | 6.340,847 ms | 55,131 ms | 115,0x |
| `control_candidatos` | 6.301,162 ms | 43,014 ms | 146,5x |
| Relacion directa por `ventaId` | 0,714 ms | 0,627 ms | 1,1x |
| Relacion alternativa por cedula | 4,325 ms | 2,500 ms | 1,7x |
| Exportacion completa | 6.368,966 ms | 97,106 ms | 65,6x |

El informe paginado devuelve 35 filas SQL para consolidar 25 ventas. Ya no
existe la multiplicacion de 4.715.794 filas entre detalles y registros. El
plan usa:

- `control_financiero_registros_imei_normalizado_idx`
- `control_financiero_registros_contrato_normalizado_idx`
- `detalle_ventas_venta_id_idx`
- `clientes_cedula_normalizada_reporte_idx`
- `entregas_venta_id_idx` dentro del informe (la prueba directa aislada elige
  `Seq Scan` por el tamano pequeno de la tabla).

Los catalogos pequenos, `detalle_ventas` para construir candidatos y
`entregas` para la rama historica aun usan `Seq Scan`; sus costos no dominan el
plan. `control_financiero_cargas` tambien se recorre por ser una tabla de solo
76 filas.

## Compatibilidad y respuesta HTTP

- Comparacion fila a fila contra la consulta anterior: 102 de 102 ventas sin
  diferencias de campos.
- Dashboard anterior y posterior: 97 entregas y 102 ventas para 2026-09.
- Respuesta anterior del endpoint: 75.703 bytes para 102 ventas.
- Respuesta paginada: 18.613 bytes para 25 ventas (75,4 % menos).
- Exportacion completa posterior: aproximadamente 75.627 bytes.
- Una llamada sin `seccion` conserva el contrato historico (listado completo y
  dashboard). El frontend usa `seccion=listado` y `seccion=dashboard`.

## Migracion y bloqueos

La migracion es `202609180001-optimize-ventas-con-entrega.sql` y puede
ejecutarse varias veces. `ALTER TABLE ... ADD COLUMN` toma un bloqueo corto de
esquema. Los `UPDATE` del backfill toman bloqueos por fila y generan WAL, por lo
que deben ejecutarse en una ventana de baja actividad si produccion tiene mucho
mas volumen. Los indices se crean con `CREATE INDEX CONCURRENTLY`, fuera de la
transaccion del backfill; permiten escrituras concurrentes, aunque consumen I/O
y requieren dos recorridos de tabla.

La migracion se aplico tres veces sobre la base local para verificar
idempotencia. Quedaron activos los tres triggers esperados. De 5.040 registros,
4.386 fechas pertenecen a los cuatro formatos historicos admitidos; las otras
654 permanecen nulas, igual que en la consulta anterior.

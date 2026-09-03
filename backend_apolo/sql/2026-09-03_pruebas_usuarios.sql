-- 1. Verificación previa: esta consulta debe devolver cero filas antes de crear las tablas.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('prueba_intentos', 'prueba_respuestas');

-- 2. Creación incremental. No elimina ni transforma datos existentes.
CREATE TABLE IF NOT EXISTS public.prueba_intentos (
  id SERIAL PRIMARY KEY,
  "usuarioId" INTEGER NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  tipo VARCHAR(20) NOT NULL,
  estado VARCHAR(24) NOT NULL DEFAULT 'EN_PROGRESO',
  "notaAutomatica" NUMERIC(5,2),
  "notaSupervisor" NUMERIC(5,2),
  "notaFinal" NUMERIC(5,2),
  aprobado BOOLEAN,
  "supervisorId" INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  "fechaInicio" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "fechaEnvio" TIMESTAMPTZ,
  "fechaCalificacion" TIMESTAMPTZ,
  "observacionGeneral" TEXT,
  "preguntasSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prueba_intentos_tipo_chk CHECK (tipo IN ('piso', 'call_center')),
  CONSTRAINT prueba_intentos_estado_chk
    CHECK (estado IN ('EN_PROGRESO', 'PENDIENTE_REVISION', 'CALIFICADA')),
  CONSTRAINT prueba_intentos_notas_chk CHECK (
    ("notaAutomatica" IS NULL OR "notaAutomatica" BETWEEN 0 AND 70)
    AND ("notaSupervisor" IS NULL OR "notaSupervisor" BETWEEN 0 AND 30)
    AND ("notaFinal" IS NULL OR "notaFinal" BETWEEN 0 AND 100)
  )
);

CREATE TABLE IF NOT EXISTS public.prueba_respuestas (
  id SERIAL PRIMARY KEY,
  "intentoId" INTEGER NOT NULL REFERENCES public.prueba_intentos(id) ON DELETE CASCADE,
  "preguntaId" VARCHAR(20) NOT NULL,
  tipo VARCHAR(24) NOT NULL,
  pregunta TEXT NOT NULL,
  opciones JSONB NOT NULL DEFAULT '[]'::jsonb,
  "opcionSeleccionada" VARCHAR(5),
  "textoRespuesta" TEXT,
  "respuestaCorrecta" VARCHAR(5),
  correcta BOOLEAN,
  "puntajeAutomatico" NUMERIC(8,4),
  "puntajeSupervisor" NUMERIC(3,1),
  "observacionSupervisor" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prueba_respuestas_tipo_chk CHECK (tipo IN ('opcion_multiple', 'abierta')),
  CONSTRAINT prueba_respuestas_puntaje_supervisor_chk
    CHECK ("puntajeSupervisor" IS NULL OR "puntajeSupervisor" BETWEEN 0 AND 5),
  CONSTRAINT prueba_respuestas_intento_pregunta_uidx UNIQUE ("intentoId", "preguntaId")
);

CREATE INDEX IF NOT EXISTS prueba_intentos_usuario_fecha_idx
  ON public.prueba_intentos ("usuarioId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS prueba_intentos_estado_envio_idx
  ON public.prueba_intentos (estado, "fechaEnvio");
CREATE UNIQUE INDEX IF NOT EXISTS prueba_intentos_un_progreso_usuario_uidx
  ON public.prueba_intentos ("usuarioId")
  WHERE estado = 'EN_PROGRESO';

-- 3. Validación final.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('prueba_intentos', 'prueba_respuestas')
ORDER BY table_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('prueba_intentos', 'prueba_respuestas')
ORDER BY tablename, indexname;

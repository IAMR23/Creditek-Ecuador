CREATE TABLE IF NOT EXISTS facebook_comentarios (
  id SERIAL PRIMARY KEY,
  "pageId" VARCHAR(255) NOT NULL,
  "postId" VARCHAR(255),
  "commentId" VARCHAR(255) NOT NULL UNIQUE,
  "parentId" VARCHAR(255),
  "autorId" VARCHAR(255),
  "autorNombre" VARCHAR(255),
  mensaje TEXT,
  "rawPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'RESPONDIDO', 'ERROR', 'IGNORADO')),
  "respuestaGenerada" TEXT,
  "respuestaEnviada" TEXT,
  "errorMensaje" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS facebook_comentarios_comment_id_unique
  ON facebook_comentarios ("commentId");

CREATE INDEX IF NOT EXISTS facebook_comentarios_page_id_idx
  ON facebook_comentarios ("pageId");

CREATE INDEX IF NOT EXISTS facebook_comentarios_post_id_idx
  ON facebook_comentarios ("postId");

CREATE INDEX IF NOT EXISTS facebook_comentarios_estado_idx
  ON facebook_comentarios (estado);

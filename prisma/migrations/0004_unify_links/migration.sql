-- Unifica `ResourceLink` (links rápidos del proyecto) en `KnowledgeResource`
-- (biblioteca de recursos, "Cómo conectarse"). Eran dos tablas para la misma
-- idea -- una URL con nombre y tipo -- y vivían en tres pantallas distintas.
--
-- Igual que en 0003_cover_framing: columnas nuevas con ADD COLUMN, la tabla no
-- se reconstruye. `KnowledgeResource` y `Attachment` no son auto-referenciales
-- así que no hace falta el baile de crear/copiar/DROP/renombrar.
ALTER TABLE "KnowledgeResource" ADD COLUMN "position" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Attachment" ADD COLUMN "resourceId" TEXT REFERENCES "KnowledgeResource" ("id") ON DELETE CASCADE;

CREATE INDEX "Attachment_resourceId_idx" ON "Attachment" ("resourceId");

-- Cada ResourceLink pasa a ser un KnowledgeResource de proyecto: mismo id (no
-- hay colisión posible, son cuids de dos tablas distintas), `label` -> `name`,
-- `kind` se remapea al vocabulario de recursos (RESOURCE_KINDS en
-- src/lib/domain.ts). Los tipos que no tenían un equivalente directo
-- (board/chat) quedan como "link" en vez de inventar una categoría nueva.
INSERT INTO "KnowledgeResource"
  ("id", "projectId", "addedById", "name", "url", "kind", "position", "createdAt", "updatedAt")
SELECT
  "id",
  "projectId",
  "addedById",
  "label",
  "url",
  CASE "kind"
    WHEN 'github' THEN 'repository'
    WHEN 'figma' THEN 'design'
    WHEN 'design' THEN 'design'
    WHEN 'drive' THEN 'document'
    WHEN 'docs' THEN 'document'
    WHEN 'site' THEN 'site'
    ELSE 'link'
  END,
  "position",
  "createdAt",
  "createdAt"
FROM "ResourceLink";

DROP TABLE "ResourceLink";

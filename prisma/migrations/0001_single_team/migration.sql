PRAGMA foreign_keys = OFF;
-- 0001_single_team
--
-- Una instancia = un equipo. `Team` reutiliza el id del workspace histórico
-- para que las claves de storage (`<teamId>/<hash>`) y los ApiToken no cambien
-- de valor y no haya que reemitir nada.
--
--  1. Se crea `Team` copiando la fila de `Workspace` (mismo id).
--  2. Se reconstruyen las 10 tablas que tenían `workspaceId` sin esa columna
--     (patrón Prisma para SQLite: create → copy → drop → rename).
--  3. `Project.visibility` y `KnowledgeResource.visibility` se eliminan:
--     todo el contenido es público en la instancia.
--  4. `Membership` pasa a ser global: `@@unique([userId])` en vez de
--     `@@unique([userId, workspaceId])`.
--  5. Se elimina `Workspace`.
--
-- Nunca se usa --force-reset: la migración solo copia y reconstruye tablas.
--
-- La primer línea desactiva el chequeo de claves foráneas: el engine de
-- migraciones de SQLite lo corre con `foreign_keys = ON`, y como `Project` y
-- `Item` se referencian a sí mismas (parentId), el DROP de la tabla original
-- haría cascade y borraría las filas recién copiadas (los subproyectos, las
-- subtareas, y de ahí todo lo que cuelga). Verificado en una copia de la base
-- de producción: cero pérdida de filas.

PRAGMA foreign_keys = OFF;

-- 1. Team: copia la fila del workspace conservando el id.
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "mission" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Team" ("id", "name", "slug", "mission", "createdAt", "updatedAt")
SELECT "id", "name", "slug", "mission", "createdAt", "updatedAt" FROM "Workspace";

CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- 2a. ApiToken: sin workspaceId.
CREATE TABLE "new_ApiToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApiToken" ("id", "userId", "expiresAt", "revoked", "createdAt")
SELECT "id", "userId", "expiresAt", "revoked", "createdAt" FROM "ApiToken";
DROP TABLE "ApiToken";
ALTER TABLE "new_ApiToken" RENAME TO "ApiToken";
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken"("userId");

-- 2b. Membership: global, una fila por usuario.
CREATE TABLE "new_Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'community',
    "title" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Membership" ("id", "userId", "role", "title", "joinedAt", "lastSeenAt")
SELECT "id", "userId", "role", "title", "joinedAt", "lastSeenAt" FROM "Membership";
DROP TABLE "Membership";
ALTER TABLE "new_Membership" RENAME TO "Membership";
CREATE UNIQUE INDEX "Membership_userId_key" ON "Membership"("userId");
CREATE INDEX "Membership_role_idx" ON "Membership"("role");

-- 2c. Project: sin workspaceId ni visibility.
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "path" TEXT NOT NULL DEFAULT '/',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "accent" TEXT NOT NULL DEFAULT 'clay',
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "startDate" DATETIME,
    "targetDate" DATETIME,
    "completedAt" DATETIME,
    "archivedAt" DATETIME,
    "progressMode" TEXT NOT NULL DEFAULT 'auto',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "position" REAL NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("id", "parentId", "path", "depth", "name", "description", "coverUrl", "accent", "status", "priority", "startDate", "targetDate", "completedAt", "archivedAt", "progressMode", "progress", "position", "createdById", "createdAt", "updatedAt")
SELECT "id", "parentId", "path", "depth", "name", "description", "coverUrl", "accent", "status", "priority", "startDate", "targetDate", "completedAt", "archivedAt", "progressMode", "progress", "position", "createdById", "createdAt", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_status_archivedAt_idx" ON "Project"("status", "archivedAt");
CREATE INDEX "Project_parentId_idx" ON "Project"("parentId");
CREATE INDEX "Project_path_idx" ON "Project"("path");

-- 2d. Item: sin workspaceId.
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "dueDate" DATETIME,
    "assigneeScope" TEXT NOT NULL DEFAULT 'individual',
    "progressMode" TEXT NOT NULL DEFAULT 'auto',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "position" REAL NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "convertedFromId" TEXT,
    CONSTRAINT "Item_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("id", "projectId", "parentId", "type", "title", "body", "status", "priority", "dueDate", "assigneeScope", "progressMode", "progress", "position", "createdById", "createdAt", "updatedAt", "completedAt", "convertedFromId")
SELECT "id", "projectId", "parentId", "type", "title", "body", "status", "priority", "dueDate", "assigneeScope", "progressMode", "progress", "position", "createdById", "createdAt", "updatedAt", "completedAt", "convertedFromId" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_projectId_type_status_idx" ON "Item"("projectId", "type", "status");
CREATE INDEX "Item_type_status_idx" ON "Item"("type", "status");
CREATE INDEX "Item_parentId_idx" ON "Item"("parentId");
CREATE INDEX "Item_dueDate_idx" ON "Item"("dueDate");

-- 2e. Comment: sin workspaceId.
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "itemId" TEXT,
    "projectId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Comment" ("id", "authorId", "itemId", "projectId", "body", "createdAt", "updatedAt", "editedAt")
SELECT "id", "authorId", "itemId", "projectId", "body", "createdAt", "updatedAt", "editedAt" FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE INDEX "Comment_itemId_createdAt_idx" ON "Comment"("itemId", "createdAt");
CREATE INDEX "Comment_projectId_createdAt_idx" ON "Comment"("projectId", "createdAt");

-- 2f. Attachment: sin workspaceId.
CREATE TABLE "new_Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploaderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'file',
    "width" INTEGER,
    "height" INTEGER,
    "projectId" TEXT,
    "itemId" TEXT,
    "commentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attachment" ("id", "uploaderId", "filename", "mimeType", "sizeBytes", "storageKey", "kind", "width", "height", "projectId", "itemId", "commentId", "createdAt")
SELECT "id", "uploaderId", "filename", "mimeType", "sizeBytes", "storageKey", "kind", "width", "height", "projectId", "itemId", "commentId", "createdAt" FROM "Attachment";
DROP TABLE "Attachment";
ALTER TABLE "new_Attachment" RENAME TO "Attachment";
CREATE INDEX "Attachment_projectId_createdAt_idx" ON "Attachment"("projectId", "createdAt");
CREATE INDEX "Attachment_itemId_idx" ON "Attachment"("itemId");
CREATE INDEX "Attachment_kind_idx" ON "Attachment"("kind");

-- 2g. Proposal: sin workspaceId.
CREATE TABLE "new_Proposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'project',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "targetProjectId" TEXT,
    "promotedProjectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Proposal_targetProjectId_fkey" FOREIGN KEY ("targetProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Proposal_promotedProjectId_fkey" FOREIGN KEY ("promotedProjectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Proposal" ("id", "authorId", "title", "body", "category", "status", "targetProjectId", "promotedProjectId", "createdAt", "updatedAt")
SELECT "id", "authorId", "title", "body", "category", "status", "targetProjectId", "promotedProjectId", "createdAt", "updatedAt" FROM "Proposal";
DROP TABLE "Proposal";
ALTER TABLE "new_Proposal" RENAME TO "Proposal";
CREATE INDEX "Proposal_status_createdAt_idx" ON "Proposal"("status", "createdAt");
CREATE INDEX "Proposal_targetProjectId_idx" ON "Proposal"("targetProjectId");

-- 2h. KnowledgeResource: sin workspaceId ni visibility.
CREATE TABLE "new_KnowledgeResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "addedById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'link',
    "url" TEXT,
    "accessGuide" TEXT,
    "markdown" TEXT,
    "markdownUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KnowledgeResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KnowledgeResource_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_KnowledgeResource" ("id", "projectId", "addedById", "name", "summary", "kind", "url", "accessGuide", "markdown", "markdownUrl", "createdAt", "updatedAt")
SELECT "id", "projectId", "addedById", "name", "summary", "kind", "url", "accessGuide", "markdown", "markdownUrl", "createdAt", "updatedAt" FROM "KnowledgeResource";
DROP TABLE "KnowledgeResource";
ALTER TABLE "new_KnowledgeResource" RENAME TO "KnowledgeResource";
CREATE INDEX "KnowledgeResource_kind_idx" ON "KnowledgeResource"("kind");
CREATE INDEX "KnowledgeResource_projectId_kind_idx" ON "KnowledgeResource"("projectId", "kind");

-- 2i. Activity: sin workspaceId.
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "verb" TEXT NOT NULL,
    "projectId" TEXT,
    "itemId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("id", "actorId", "verb", "projectId", "itemId", "targetType", "targetId", "targetLabel", "meta", "createdAt")
SELECT "id", "actorId", "verb", "projectId", "itemId", "targetType", "targetId", "targetLabel", "meta", "createdAt" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");
CREATE INDEX "Activity_projectId_createdAt_idx" ON "Activity"("projectId", "createdAt");
CREATE INDEX "Activity_itemId_createdAt_idx" ON "Activity"("itemId", "createdAt");

-- 2j. FeedEntry: sin workspaceId.
CREATE TABLE "new_FeedEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "direct" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FeedEntry" ("id", "userId", "activityId", "reason", "direct", "readAt", "createdAt")
SELECT "id", "userId", "activityId", "reason", "direct", "readAt", "createdAt" FROM "FeedEntry";
DROP TABLE "FeedEntry";
ALTER TABLE "new_FeedEntry" RENAME TO "FeedEntry";
CREATE UNIQUE INDEX "FeedEntry_userId_activityId_key" ON "FeedEntry"("userId", "activityId");
CREATE INDEX "FeedEntry_userId_createdAt_idx" ON "FeedEntry"("userId", "createdAt");
CREATE INDEX "FeedEntry_userId_readAt_idx" ON "FeedEntry"("userId", "readAt");

-- 5. Workspace ya no existe: nadie lo referencia (todas las tablas hijas se
--    reconstruyeron arriba sin la columna workspaceId).
DROP TABLE "Workspace";

PRAGMA foreign_keys = ON;
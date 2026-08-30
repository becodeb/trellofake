-- Encuadre de la portada: qué punto de la imagen se ve y cuánto se acerca.
--
-- Tres columnas nuevas con valor por defecto, nada más. Prisma propone
-- reconstruir la tabla entera (crear, copiar, DROP, renombrar); acá no hace
-- falta, y sobre `Project` esa operación es peligrosa: es auto-referencial y
-- media base le apunta con ON DELETE CASCADE. Es exactamente lo que en
-- `0001_single_team` se llevó puestos los subproyectos. Con ADD COLUMN la
-- tabla no se toca y los datos no se mueven.
--
-- Los valores por defecto (50, 50, 100) son el `object-cover` centrado de
-- siempre: las portadas que ya existen se siguen viendo igual.
ALTER TABLE "Project" ADD COLUMN "coverX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Project" ADD COLUMN "coverY" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Project" ADD COLUMN "coverZoom" INTEGER NOT NULL DEFAULT 100;

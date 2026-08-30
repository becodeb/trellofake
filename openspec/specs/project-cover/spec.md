# Project Cover Framing Specification

## Purpose

A project cover is shown in two places with different aspect ratios: a wide band at the top of the project, and a shorter thumbnail on the listing card. Centring the image blindly cuts off whatever matters. This capability lets a member drag the image inside the crop — the way a profile picture is positioned — and zoom in, storing the decision rather than a cropped file.

## Requirements

### Requirement: Framing is stored, the file is never cropped

The system MUST store the framing as three integer columns on `Project`: `coverX` and `coverY` (0–100, the point of the image to keep in view) and `coverZoom` (100–300, percent). The uploaded image MUST NOT be re-encoded or cropped. Values MUST be clamped and rounded before persisting.

The defaults `(50, 50, 100)` MUST render identically to a centred `object-fit: cover`, so covers that predate this capability are unchanged.

#### Scenario: Existing covers are untouched by the migration

- GIVEN a database with projects that have covers
- WHEN the framing migration is applied
- THEN no rows are added or removed
- AND every existing project reads `coverX = 50`, `coverY = 50`, `coverZoom = 100`
- AND its cover renders exactly as before

#### Scenario: Out-of-range values never reach the database

- GIVEN a save request carrying `coverX: -20` and `coverZoom: 9000`
- WHEN the action runs
- THEN the stored values are clamped into range

### Requirement: The migration must not rebuild the Project table

The framing migration MUST add its columns with `ALTER TABLE ... ADD COLUMN`. It MUST NOT use the create-copy-drop-rename rebuild that Prisma generates by default for SQLite: `Project` is self-referential and is the target of cascading foreign keys, and that rebuild is the failure mode that destroyed subprojects in `0001_single_team`.

#### Scenario: Subprojects survive the migration

- GIVEN a database with nested projects and their items
- WHEN the migration is applied
- THEN the subproject and subtask counts are unchanged

### Requirement: One framing serves every crop

The system MUST derive the rendered style from the stored framing through a single shared helper used by every surface that draws a cover, so the project band and the listing card cannot drift apart. The helper MUST work without knowing the image's natural dimensions, so it can run during server rendering.

#### Scenario: Band and card agree

- GIVEN a project whose cover has been repositioned
- WHEN the project page and the projects listing are rendered
- THEN both apply the same framing values

### Requirement: Direct manipulation

The system MUST let an actor holding `content.write` open an adjuster showing the image at the real aspect ratio of the project band, drag it with a pointer, and zoom with the mouse wheel, a slider and step buttons. Dragging MUST move the image with the cursor, at a rate matching the pixels of image actually available to pan, and MUST stop at the edges of the image. The adjuster MUST also be operable from the keyboard, MUST offer a reset to centred, and MUST show a preview at the listing card's aspect ratio.

When the image is exactly covered by the crop with no slack on either axis, the adjuster MUST say so rather than accepting a drag that cannot move anything.

#### Scenario: Dragging shows the other side of the image

- GIVEN an image taller than the crop
- WHEN it is dragged upward
- THEN a lower part of the image comes into view
- AND the framing never leaves the 0–100 range

#### Scenario: Repeated zoom steps accumulate

- GIVEN the adjuster at 100%
- WHEN the zoom-in step is triggered six times in quick succession
- THEN the zoom reads 160%

#### Scenario: A reader cannot reposition

- GIVEN an actor without `content.write`
- WHEN the save action is invoked
- THEN it returns `{ ok: false }` and nothing is written

### Requirement: A new image starts centred

Uploading a new cover MUST reset the framing to the defaults, so the new image is not cut by a position chosen for the previous one. Repositioning MUST NOT record activity: moving a photo is not news for the project feed.

#### Scenario: Replacing the cover resets the framing

- GIVEN a project whose cover is framed at `(80, 20, 220)`
- WHEN a new cover image is uploaded
- THEN the framing reads `(50, 50, 100)`

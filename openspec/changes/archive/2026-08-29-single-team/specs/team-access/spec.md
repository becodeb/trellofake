# Team Access Specification

## Purpose

Hilo is a single-team instance: one `Team` row reuses the legacy workspace identity, membership is global, content is public, and writes are gated by capabilities from `src/lib/domain.ts` (roles admin|developer|community).

## Requirements

### Requirement: Singleton team identity

The system MUST persist exactly one `Team` row (`id`, `name`, `slug`, `mission`) whose `id` equals the pre-existing workspace id, and MUST NOT expose a workspace-creation path. The `Workspace` model and all `workspaceId` columns MUST be removed.

#### Scenario: Fresh instance deploys one team

- GIVEN a fresh database
- WHEN migration and seed run
- THEN exactly one `Team` row exists

#### Scenario: Legacy identity is preserved

- GIVEN an existing database
- WHEN migration `0001_single_team` applies
- THEN the `Team` row keeps that id, so storage keys and API tokens retain their values

### Requirement: Global membership

The system MUST persist at most one `Membership` per user (`@@unique([userId])`), without `workspaceId`. Roles MUST follow `roleCan(role, capability)` from `src/lib/domain.ts`.

#### Scenario: One membership per user

- GIVEN a user with one membership
- WHEN a page or action resolves their role
- THEN the same role applies everywhere

#### Scenario: Promotion is an admin action

- GIVEN an `admin`
- WHEN they change another member's role
- THEN the new role applies globally
- AND non-admins invoking it are rejected

### Requirement: Guest public read

The system MUST serve `/`, `/proyectos`, `/p/[id]`, `/ideas`, `/recursos`, `/gente/[userId]`, `/buscar` to unauthenticated users with a guest role whose `can()` returns `false` for every write capability. Guests MUST see Login/Registrate CTAs instead of write controls.

#### Scenario: Guest browses read-only

- GIVEN no session
- WHEN a guest loads `/proyectos` and `/p/[id]`
- THEN content renders without login redirect

#### Scenario: All writes denied to guest

- GIVEN no session
- WHEN a guest invokes a mutating action
- THEN the action returns `{ ok: false }` with UNAUTHENTICATED

### Requirement: Public files

The system MUST serve `/api/files/*` without authentication. Storage keys MUST keep the `<teamId>/<hash>` prefix so existing attachments keep resolving.

#### Scenario: Guest downloads an attachment

- GIVEN an existing attachment
- WHEN requesting its `/api/files/...` URL
- THEN the bytes are returned with HTTP 200

#### Scenario: Missing file

- GIVEN a storage key with no file behind it
- WHEN the route resolves it
- THEN the response is HTTP 404

### Requirement: Write-action capability guards

Every mutating server action MUST call `requireTeamAction(capability)` before executing, using capabilities from `src/lib/domain.ts`. Denied actors MUST receive a failure result.

#### Scenario: Community role is write-limited

- GIVEN a `community` member
- WHEN they invoke `project.create` or `api-tokens.create`
- THEN the action is rejected
- AND `comment.write` still works

#### Scenario: Admin passes the guard

- GIVEN an `admin`
- WHEN they invoke a guarded action
- THEN the action executes

### Requirement: Auto-join on signup

The system MUST create a global membership with role `community` at signup (`admin` for the very first user), drop `workspaceName`, and redirect to `/`. The `nuevo-equipo` route MUST be removed.

#### Scenario: New signup joins the team

- GIVEN an unregistered visitor
- WHEN they complete signup
- THEN a user and a `community` membership are created

#### Scenario: First user bootstraps as admin

- GIVEN an empty instance
- WHEN the first signup completes
- THEN that user is assigned role `admin`

### Requirement: Flattened routes with legacy redirect

Content routes MUST live at clean paths. Requests to `/w/{slug}/...` MUST receive HTTP 301 to the clean path when the slug is the team slug; other slugs MUST NOT render content.

#### Scenario: Legacy URL redirects

- GIVEN a request to `/w/hilo/proyectos`
- WHEN it is handled by `middleware.ts`
- THEN the response is HTTP 301 with `Location: /proyectos`
- AND `/w/hilo/p/1` maps to `/p/1`

#### Scenario: Foreign slug yields no content

- GIVEN a request to `/w/otro/proyectos`
- WHEN handled
- THEN the response is HTTP 404
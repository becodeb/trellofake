# Delta for API Tokens

## MODIFIED Requirements

### Requirement: ApiToken persistence model

The system MUST add an `ApiToken` model to the Prisma schema storing: `id` (sha256 hash of the raw token, following the `Session` pattern), `userId`, `expiresAt`, `revoked` (Boolean, default false), and `createdAt`. The model MUST NOT store `workspaceId` or `teamId`: every token resolves to the singleton team by construction. The raw token MUST NOT be persisted anywhere. Tokens MUST be looked up by their sha256 hash.
(Previously: the model stored `workspaceId` referencing the token's workspace.)

#### Scenario: Only the hash is stored

- GIVEN a created token
- WHEN the ApiToken table is inspected
- THEN the raw value is absent and only its sha256 hash is stored

#### Scenario: Expired token fails authentication

- GIVEN a token whose `expiresAt` is in the past
- WHEN a request authenticates with it at `/api/mcp`
- THEN the request is rejected with HTTP 401

#### Scenario: Existing token stays valid through the migration

- GIVEN a token created before the single-team migration
- WHEN migration `0001_single_team` applies and a request authenticates with it
- THEN the token still authenticates without reissue

### Requirement: Token management UI

The settings page at the clean route `/ajustes` MUST include an "Acceso por API" section that lists existing tokens (masked hash, expiry, revoked state) with a revoke control per row, offers token creation with an expiry choice, and after creation shows the raw token exactly once — in a copyable box together with the MCP endpoint URL. Subsequent renders MUST show only the masked hash.
(Previously: the section lived at `src/app/w/[slug]/ajustes/page.tsx`.)

#### Scenario: Raw token shown exactly once

- GIVEN a successful creation
- WHEN the section renders the result
- THEN the raw token and the MCP endpoint URL are displayed in a copyable box
- AND a later reload shows only the masked hash

#### Scenario: Revoked token row

- GIVEN a revoked token
- WHEN the section renders
- THEN the row shows the revoked state
- AND its revoke control is disabled
# API Tokens Specification

## Purpose

Workspace API tokens let AI clients (MCP) authenticate as a member of one workspace. Tokens are stored hashed, expire, and can be created and revoked from workspace settings.

## Requirements

### Requirement: ApiToken persistence model

The system MUST add an `ApiToken` model to the Prisma schema storing: `id` (sha256 hash of the raw token, following the `Session` pattern), `workspaceId`, `userId`, `expiresAt`, `revoked` (Boolean, default false), and `createdAt`. The raw token MUST NOT be persisted anywhere. Tokens MUST be looked up by their sha256 hash.

#### Scenario: Only the hash is stored

- GIVEN a created token
- WHEN the ApiToken table is inspected
- THEN the raw value is absent and only its sha256 hash is stored

#### Scenario: Expired token fails authentication

- GIVEN a token whose `expiresAt` is in the past
- WHEN a request authenticates with it at `/api/mcp`
- THEN the request is rejected with HTTP 401

### Requirement: Capability-gated token management

The system MUST register the capabilities `api-tokens.create` and `api-tokens.revoke` in the capability vocabulary of `src/lib/domain.ts` (`CAPABILITIES` and `ROLE_CAPABILITIES`, granting at least the `admin` role). Token actions MUST NOT execute unless the actor holds the matching capability via `can("api-tokens.create")` / `can("api-tokens.revoke")`.

#### Scenario: Role without capability is rejected

- GIVEN a member whose role lacks `api-tokens.create`
- WHEN they invoke the create action
- THEN the action returns `{ ok: false }`
- AND no token is created

### Requirement: Token creation

The system MUST provide a create-token Server Action validated with Zod and returning `ActionResult`. On success it MUST return the raw token exactly once, inside the result payload, with `expiresAt` always set. After the result is delivered, the raw token MUST NOT be recoverable — only its hash remains stored.

#### Scenario: Create token

- GIVEN an `admin` member of a workspace
- WHEN they create a token with a chosen expiry
- THEN the action returns `{ ok: true }` with the raw token in the payload
- AND only the sha256 hash of the raw token is persisted

#### Scenario: Invalid expiry rejected

- GIVEN a create attempt with a missing or past `expiresAt`
- WHEN the action validates the input
- THEN it returns `{ ok: false }`
- AND no token is created

### Requirement: Token revocation

The system MUST provide a revoke-token Server Action gated by `api-tokens.revoke` that immediately invalidates the token: subsequent bearer use at `/api/mcp` MUST fail with HTTP 401. Revoking an unknown token MUST return an error result.

#### Scenario: Revoke token

- GIVEN an existing token
- WHEN an authorized member revokes it
- THEN the action returns `{ ok: true }`
- AND a subsequent MCP request with that token receives HTTP 401

#### Scenario: Revoke unknown token

- GIVEN a token id that does not exist
- WHEN an authorized member revokes it
- THEN the action returns `{ ok: false }`

### Requirement: Token management UI

The workspace settings page `src/app/w/[slug]/ajustes/page.tsx` MUST include an "Acceso por API" section that lists existing tokens (masked hash, expiry, revoked state) with a revoke control per row, offers token creation with an expiry choice, and after creation shows the raw token exactly once — in a copyable box together with the MCP endpoint URL. Subsequent renders MUST show only the masked hash.

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
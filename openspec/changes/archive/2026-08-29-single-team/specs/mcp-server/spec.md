# Delta for MCP Server

## RENAMED Requirements

### Requirement: Token-derived workspace scoping → Token-derived team scoping

(Reason: the single-team change removes the workspace concept; the token now resolves the singleton team.)
(Migration: tests, docs, and MCP client documentation must reference team scoping instead of workspace scoping.)

## MODIFIED Requirements

### Requirement: Bearer token authentication

The system MUST require an `Authorization: Bearer <token>` header on every request and MUST look up the token by the sha256 hash of the presented value. The server MUST respond HTTP 401 when the header is missing or unknown, when the token is expired, or when the token is revoked. The server MUST respond HTTP 403 when the token is valid but its user no longer holds a global membership.
(Previously: HTTP 403 when the user was no longer a member of the token's workspace.)

#### Scenario: Valid token

- GIVEN a non-expired, non-revoked token whose user holds a global membership
- WHEN a request carries `Authorization: Bearer <token>`
- THEN the request is authenticated and served

#### Scenario: Expired or revoked token

- GIVEN a token past `expiresAt`, an already revoked token, or an unknown token
- WHEN a request presents it as bearer credential
- THEN the server responds HTTP 401
- AND the request is not served

#### Scenario: Token user removed from the team

- GIVEN a valid, non-expired token whose user's membership was removed
- WHEN a request presents it
- THEN the server responds HTTP 403

### Requirement: Token-derived team scoping

The system MUST derive the team context (team identity and role) exclusively from the `ApiToken` row matched by the bearer token. Client-supplied team or workspace identifiers in tool arguments MUST NOT override this scope — they MUST be rejected or ignored. Tool queries MUST target the singleton team; no `workspaceId` filter applies.
(Previously: context derived from the token's `workspaceId` and every query hard-scoped to it.)

#### Scenario: Token resolves the singleton team

- GIVEN a valid token
- WHEN any tool call executes
- THEN results reference the singleton team's data
- AND no workspace-scoped filter is applied
# MCP Server Specification

## Purpose

Exposes Hilo workspace data to AI clients over the Model Context Protocol (Streamable HTTP) at `/api/mcp`. The endpoint authenticates requests with workspace API tokens and serves read-only tool calls scoped to the token's workspace.

## Requirements

### Requirement: Streamable HTTP endpoint

The system MUST expose an MCP server at `/api/mcp` using the Streamable HTTP transport from `@modelcontextprotocol/sdk`, running on the `nodejs` runtime. It MUST implement the JSON-RPC 2.0 lifecycle: `initialize`, the `notifications/initialized` notification, `tools/list`, and `tools/call`. The `initialize` response MUST advertise the `tools` capability with the negotiated protocol version.

#### Scenario: Client connects via Streamable HTTP

- GIVEN a client with a valid bearer token
- WHEN it POSTs an `initialize` request to `/api/mcp`
- THEN the server responds with a protocol version and the `tools` capability
- AND subsequent `tools/list` and `tools/call` requests are served

#### Scenario: Tool call before initialization

- GIVEN a client that skips `initialize`
- WHEN it sends a `tools/call` request
- THEN the server responds with a JSON-RPC error indicating initialization is required

### Requirement: Bearer token authentication

The system MUST require an `Authorization: Bearer <token>` header on every request and MUST look up the token by the sha256 hash of the presented value. The server MUST respond HTTP 401 when the header is missing or unknown, when the token is expired, or when the token is revoked. The server MUST respond HTTP 403 when the token is valid but its user is no longer a member of the token's workspace.

#### Scenario: Valid token

- GIVEN a non-expired, non-revoked token whose user is an active member
- WHEN a request carries `Authorization: Bearer <token>`
- THEN the request is authenticated and served

#### Scenario: Expired or revoked token

- GIVEN a token past `expiresAt`, an already revoked token, or an unknown token
- WHEN a request presents it as bearer credential
- THEN the server responds HTTP 401
- AND the request is not served

#### Scenario: Token user left the workspace

- GIVEN a valid, non-expired token whose user was removed from the workspace
- WHEN a request presents it
- THEN the server responds HTTP 403

### Requirement: Token-derived workspace scoping

The system MUST derive the workspace context (workspaceId and role) exclusively from the `ApiToken` row matched by the bearer token. Client-supplied workspace identifiers in tool arguments MUST NOT override this scope — they MUST be rejected or ignored. Every query issued by the tools MUST be hard-scoped to the token's workspaceId.

#### Scenario: Token scopes all reads

- GIVEN a token for workspace W1
- WHEN a tool call passes arguments nominating workspace W2
- THEN results only ever reference W1 data

### Requirement: Read-only tool dispatch

The system MUST register every `hilo_*` read tool (see mcp-read-tools) and dispatch `tools/call` to the matching tool. Unknown tool names MUST produce a JSON-RPC method-not-found error; invalid arguments MUST produce a JSON-RPC invalid-params error. Tool execution MUST NOT create, update, or delete data.

#### Scenario: Unknown tool name

- GIVEN an authenticated session
- WHEN `tools/call` names a tool that is not registered
- THEN the server returns a JSON-RPC error

#### Scenario: Tool call is read-only

- GIVEN an authenticated session
- WHEN any tool executes
- THEN no rows are written and no activity events are recorded
# MCP Read Tools Specification

## Purpose

Read-only MCP tools (`hilo_*`) exposing workspace content to AI clients. Every tool honors project visibility through the token role and is hard-scoped to the token's workspace.

## Requirements

### Requirement: Tool coverage

The system MUST expose `hilo_*` read tools covering: projects with their subproject tree; items of all six `ItemType` (`task`, `idea`, `note`, `problem`, `decision`, `update`) with filters; proposals with their replies; knowledge resources with their access/integration guides; people; workspace feed/activity; and search.

#### Scenario: tools/list enumerates the read tools

- GIVEN an authenticated MCP session
- WHEN the client calls `tools/list`
- THEN the response lists the `hilo_*` tools with their input schemas

#### Scenario: Tree includes subprojects

- GIVEN a workspace with nested projects
- WHEN the projects tool runs
- THEN each project returned includes its subproject tree

#### Scenario: Item filters cover all six types

- GIVEN a workspace containing items of all six types
- WHEN the items tool runs with a `type` filter
- THEN results are limited to that `ItemType` and valid filters are applied

### Requirement: Visibility enforcement

Every tool MUST honor project visibility by passing the token role and user into the existing viewer parameters (e.g. `projectAccess`, `listKnowledgeResources`), so the rules from `src/lib/domain.ts` (`PROJECT_VISIBILITIES`, `isTeamRole`) apply unchanged. A token whose role is `community` MUST only see `community`-visible projects and resources plus their dependent content; `admin` and `developer` tokens MUST see team content as well.

#### Scenario: Community role sees only community content

- GIVEN a token whose role is `community`
- WHEN any read tool runs
- THEN results exclude team-only projects and resources
- AND derived content (items, proposals, feed, search) is filtered to visible projects

#### Scenario: Team role sees team content

- GIVEN a token whose role is `developer` or `admin`
- WHEN any read tool runs
- THEN team and community content are both included

### Requirement: Workspace scoping

Each tool MUST scope all queries to the token's `workspaceId` (derived by mcp-server). Identifiers pointing outside the token's workspace MUST yield no data for that identifier.

#### Scenario: Foreign identifiers yield no data

- GIVEN a token for workspace W1
- WHEN a tool receives an item or project identifier belonging to W2
- THEN the result contains no data for that identifier

### Requirement: Input validation

Each tool MUST validate its arguments with Zod against the vocabulary in `src/lib/domain.ts` (`isItemType`, `isValidStatus`, `PROPOSAL_STATUSES`, `RESOURCE_KINDS`, `PRIORITIES`, `PROJECT_VISIBILITIES`, search kinds). Invalid or unknown filter values MUST produce a JSON-RPC invalid-params error rather than empty results.

#### Scenario: Invalid item type filter

- GIVEN an authenticated session
- WHEN the items tool receives `type: "milestone"`
- THEN the call fails with invalid-params
- AND no query is executed

### Requirement: Read-only execution

Tools MUST be implemented exclusively over existing read paths (`src/server/domain/*`) and MUST NOT invoke Server Actions or write paths. No tool call MAY create, update, or delete data or emit activity events.

#### Scenario: Read path only

- GIVEN an authenticated session
- WHEN any tool executes
- THEN only read functions are used
- AND no rows change
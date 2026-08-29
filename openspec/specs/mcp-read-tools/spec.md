# MCP Read Tools Specification

## Purpose

Read-only MCP tools (`hilo_*`) exposing team content to AI clients. Every tool is hard-scoped to the singleton team and is not subject to per-role visibility filtering.

## Requirements

### Requirement: Tool coverage

The system MUST expose `hilo_*` read tools covering: projects with their subproject tree; items of all six `ItemType` (`task`, `idea`, `note`, `problem`, `decision`, `update`) with filters; proposals with their replies; knowledge resources with their access/integration guides; people; team feed/activity; and search.

#### Scenario: tools/list enumerates the read tools

- GIVEN an authenticated MCP session
- WHEN the client calls `tools/list`
- THEN the response lists the `hilo_*` tools with their input schemas

#### Scenario: Tree includes subprojects

- GIVEN a team with nested projects
- WHEN the projects tool runs
- THEN each project returned includes its subproject tree

#### Scenario: Item filters cover all six types

- GIVEN a team containing items of all six types
- WHEN the items tool runs with a `type` filter
- THEN results are limited to that `ItemType` and valid filters are applied

### Requirement: Team scoping

Each tool MUST resolve all queries against the singleton team without `workspaceId` scoping. Tools MUST NOT filter by workspace, and identifiers always reference the single team's data.

#### Scenario: Identifiers resolve within the team

- GIVEN an authenticated MCP session
- WHEN a tool receives an item or project identifier
- THEN the result contains that identifier's data
- AND no workspace filter is applied

### Requirement: Input validation

Each tool MUST validate its arguments with Zod against the vocabulary in `src/lib/domain.ts` (`isItemType`, `isValidStatus`, `PROPOSAL_STATUSES`, `RESOURCE_KINDS`, `PRIORITIES`, search kinds). Invalid or unknown filter values MUST produce a JSON-RPC invalid-params error rather than empty results.

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

# Project Doc ("léeme") Specification

## Purpose

Every project carries one context document — the equivalent of a repository README: what the project is, how to work on it, and the data a teammate needs before touching it (environments, test accounts, who to ask). The document is authored in Markdown from inside Hilo, can be imported from and exported to a `.md` file, and renders like GitHub does.

Because all project content in Hilo is readable without a session, the document supports blocks reserved for the team. Those blocks are removed on the server before rendering, so the public never receives them.

## Requirements

### Requirement: ProjectDoc persistence model

The system MUST store the document in its own `ProjectDoc` model with `projectId` unique (one document per project), `markdown`, `updatedById`, `createdAt` and `updatedAt`, cascading on project deletion. The document MUST NOT be a column on `Project`, so it cannot ride along in `projectCardSelect` or in any list query. Markdown MUST be the stored form: no derived HTML is persisted.

#### Scenario: The document does not leak through project listings

- GIVEN a project whose document contains a team-only block
- WHEN any project list or card query runs
- THEN the returned rows contain no document text

#### Scenario: Deleting a project removes its document

- GIVEN a project with a document
- WHEN the project is deleted
- THEN the `ProjectDoc` row is deleted with it

### Requirement: Team-only blocks are cut on the server

The system MUST recognise a block opened by a line reading `:::equipo` and closed by a line reading `:::`, and MUST treat its content as visible only to actors holding `content.write`. The cut MUST happen before Markdown is converted to HTML, so that the excluded text never reaches the client — not in the HTML, not in the React payload, and not through MCP. Hiding by CSS or by client-side filtering MUST NOT be used.

An unterminated `:::equipo` MUST leave the rest of the document team-only: the failure mode is hiding too much, never showing too much. A `:::equipo` line inside a fenced code block MUST NOT open a block, so the syntax can document itself.

#### Scenario: Guest never receives the reserved text

- GIVEN a document with a `:::equipo` block containing credentials
- WHEN a visitor without a session requests the project page or the document page
- THEN the response body contains no substring of that block

#### Scenario: Community role does not see team blocks

- GIVEN a signed-in member whose role lacks `content.write`
- WHEN they read the document
- THEN only the public segments are rendered
- AND a note states that part of the document is reserved for the team

#### Scenario: Unterminated block hides the remainder

- GIVEN a document that opens `:::equipo` and never closes it
- WHEN a guest reads it
- THEN every segment after the opener is omitted

#### Scenario: The syntax can be documented

- GIVEN a fenced code block containing a `:::equipo` line
- WHEN the document is rendered
- THEN the line is shown literally and no team block is opened

### Requirement: Sanitised server-side rendering

The system MUST convert Markdown to HTML on the server through a single pipeline (`remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-raw` → `rehype-sanitize` → `rehype-stringify`), and sanitisation MUST be the last step before stringifying. GFM tables, task lists and autolinks MUST be supported. Embedded HTML MUST be parsed and then filtered by an allow-list rather than dropped or trusted.

#### Scenario: Scripts and handlers do not survive

- GIVEN a document containing `<script>`, an `onerror` attribute, a `style` attribute and an `href="javascript:…"`
- WHEN it is rendered
- THEN the script element is absent, the event handler and style attributes are stripped, and the link carries no `href`

#### Scenario: Useful HTML survives

- GIVEN a document containing `<kbd>`, `<details>`, `<summary>` and `<br>`
- WHEN it is rendered
- THEN those elements are preserved

### Requirement: Placement in the project

The system MUST show the document folded at the top of the project overview, above the day-to-day work, with a control to keep reading when it overflows, and MUST expose the full document at `/p/[projectId]/leeme`. The `Léeme` tab MUST be offered when a document exists or when the actor can write one.

#### Scenario: Context precedes activity

- GIVEN a project with a document
- WHEN the project overview is rendered
- THEN the document appears before the tasks, problems and activity sections

#### Scenario: No document, no empty section

- GIVEN a project without a document
- WHEN a reader without `content.write` opens the overview
- THEN no document section is rendered

### Requirement: Authoring

The system MUST let an actor holding `content.write` edit the document with a toolbar that inserts Markdown for headings, bold, italics, lists, task lists, quotes, links, code blocks, tables, horizontal rules, images and team-only blocks, and MUST restore the text selection after each insertion. The editor MUST offer a preview rendered by the same server pipeline as the published page, MUST import a `.md` file and MUST export the document as `.md` without loss.

Images MUST be uploaded through the existing storage adapter and inserted as Markdown image links. Saving MUST validate through Zod and return `ActionResult`. Saving an empty document MUST delete the row. Saving an unchanged document MUST NOT record activity.

#### Scenario: Round-trip through a file is lossless

- GIVEN a `.md` file
- WHEN it is imported, saved and exported again
- THEN the exported text equals the imported text, apart from surrounding blank lines trimmed on save

#### Scenario: Preview matches the published page

- GIVEN any document source
- WHEN the preview is requested
- THEN it is produced by the same renderer as the published page

#### Scenario: A reader cannot write

- GIVEN an actor without `content.write`
- WHEN the save action is invoked
- THEN it returns `{ ok: false }` and nothing is written

### Requirement: Activity

The system MUST record a `doc.updated` activity with `targetType: "doc"` on every real change, fanned out to the project participants like any other project event, and the history MUST describe it in Spanish prose distinguishing the first write from a later edit.

#### Scenario: Editing the document reaches the participants' feed

- GIVEN a project with participants
- WHEN a member saves a changed document
- THEN a `doc.updated` activity exists and `FeedEntry` rows were created for the participants

### Requirement: MCP exposure

`hilo_get_project` MUST return the document as a `doc` field carrying Markdown, filtered by the token's role: a token whose role lacks `content.write` MUST receive only the public segments. An AI MUST NOT see more than the person who connected it.

#### Scenario: A community token gets the trimmed document

- GIVEN a token belonging to a community member
- WHEN `hilo_get_project` is called for a project with a team-only block
- THEN the returned `doc` omits that block

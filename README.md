# libraries

Shared UI packages extracted from my projects, so a new app starts from working
code instead of a blank file.

| Package | What it is |
| --- | --- |
| [`@rindra/desktop`](packages/desktop) | React + antd desktop chrome: a full-featured data grid, accent/theme system, command bus, design tokens |

## Why

Across 118 projects the same desktop shell had been written three times —
`DataTable` (2152 lines), `Ribbon`, `NavPane`, `TitleBar`, `StatusBar`,
`PrintPreview` — in three copies that had since drifted apart. A bug fixed in
one stayed live in the other two. That, rather than any licence fee, is what
this repo is for.

## Use

```bash
pnpm install
pnpm build
```

Consume from a project with a workspace link, or a git dependency pinned to a
tag:

```json
"@rindra/desktop": "github:rindra/libraries#desktop-v0.1.0"
```

## The rule

Extract on the third repetition, never up front. See [CLAUDE.md](CLAUDE.md).

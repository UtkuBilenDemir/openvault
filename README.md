# openvault

`openvault` turns frontmatter-marked notes into a searchable project directory for [OpenCode V2](https://opencode.ai/v2/docs/).

It is useful when a Markdown or Obsidian vault is the source of truth for projects and each project note points to—or lives inside—its own repository.

> Community project: `openvault` is not affiliated with or maintained by the OpenCode team or Obsidian.

## Features

- Discover projects from configurable YAML frontmatter.
- Use the note's directory or an explicit relative/absolute project path.
- Search projects by title, aliases, status, or directory.
- Group projects by status.
- Pin projects in frontmatter.
- Change statuses from the OpenCode TUI.
- Register discovered Git repositories in OpenCode's native project list.
- Exclude templates, plugin data, archives, or any other paths with glob patterns.

## Requirements

- OpenCode V2.2.1 or later.
- A local vault containing Markdown files with YAML frontmatter.
- Git repositories by default. Set `gitOnly` to `false` to include ordinary directories.

## Install from GitHub

```sh
opencode plugin add github:UtkuBilenDemir/openvault
```

Configure the plugin globally in `~/.config/opencode/opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:UtkuBilenDemir/openvault",
      "options": {
        "vault": "~/Documents/MyVault"
      }
    }
  ]
}
```

If `plugin add` already inserted the string form, replace that entry with the object above. Configuration reloads automatically.

## Frontmatter

The default minimal project note is:

```yaml
---
title: Example project
kind: project
status:
  - active
---
```

The note's parent directory becomes the project directory. Point elsewhere with `project_directory`; relative paths resolve from the note:

```yaml
---
title: Example project
kind: project
project_directory: ../code/example
status:
  - active
openvault_pinned: true
---
```

Pin and status actions write `openvault_pinned` and `status` back to this frontmatter. The YAML library preserves comments and values but may normalize YAML formatting in the frontmatter block.

## Commands

| Command | Purpose |
| --- | --- |
| `/openvault` | Search and open projects. Alias: `/ov`. |
| `/openvault-sync` | Register every discovered directory in OpenCode's native project list. |

Inside `/openvault`:

- **Enter** opens a new OpenCode session rooted in the selected project.
- **Ctrl+P** pins or unpins the selected project.
- **Ctrl+S** changes its status.

Pins and custom statuses are visible in `/openvault`. OpenCode's built-in `/open` picker does not expose plugin extension points for these fields.

## Configuration

```jsonc
{
  "plugins": [
    {
      "package": "github:UtkuBilenDemir/openvault",
      "options": {
        "vault": "~/Documents/MyVault",
        "markerProperty": "kind",
        "markerValue": "project",
        "directoryProperty": "project_directory",
        "statusProperty": "status",
        "pinProperty": "openvault_pinned",
        "statuses": ["open", "active", "detached", "done"],
        "exclude": [
          ".git/**",
          ".obsidian/**",
          ".trash/**",
          "node_modules/**",
          "08_templates/**"
        ],
        "gitOnly": true,
        "statusAsArray": true
      }
    }
  ]
}
```

| Option | Default | Description |
| --- | --- | --- |
| `vault` | Current project root | Vault to scan. `OPENVAULT_VAULT` is also supported. |
| `markerProperty` | `kind` | Property identifying project notes. |
| `markerValue` | `project` | Required marker value; scalar and list values work. |
| `directoryProperty` | `project_directory` | Optional property overriding the note directory. |
| `statusProperty` | `status` | Property containing one or more statuses. |
| `pinProperty` | `openvault_pinned` | Boolean pin property. |
| `statuses` | `open`, `active`, `detached`, `done` | Available statuses and their order. |
| `exclude` | See example | Vault-relative glob patterns ignored during scanning. |
| `gitOnly` | `true` | Require a `.git` file or directory at the resolved path. |
| `statusAsArray` | `true` | Write newly created status properties as YAML lists. |

## Development

```sh
npm install
npm run check
```

For local testing, configure the repository path directly:

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/openvault",
      "options": { "vault": "/absolute/path/to/vault" }
    }
  ]
}
```

## Privacy and safety

Scanning is local. `openvault` does not send note contents to an external service. It writes frontmatter only after an explicit pin or status action, validates that the note is inside the configured vault, and writes through a temporary file before replacing the note.

## License

[MIT](LICENSE)

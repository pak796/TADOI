# TADOI CLI Completions

Optional shell completion scripts for `tadoi` are in:

- `docs/completions/tadoi.bash`
- `docs/completions/_tadoi` (zsh)
- `docs/completions/tadoi.fish`

Covered surface:
- top-level commands (`add`, `done`, `due`, `recur`, `help`, `export`, `import`, `calendar:export`, `calendar:import`)
- global runtime flags (`--interactive`, `--json`, `--quiet`, `--data-file`, plus existing help/version flags)
- command-specific flags for portability and calendar commands

Automatic install paths:
- Source install (`bun install`): runs `postinstall` and installs user-level completions.
- Linux DEB packaging: installs system-level completions under `/usr/share/...`.
- macOS PKG packaging: installs system-level completions under `/usr/local/share/...`.

## Install

Bash (`~/.bashrc` or `~/.bash_profile`):

```bash
source "/absolute/path/to/docs/completions/tadoi.bash"
```

Zsh (`~/.zshrc`):

```bash
fpath+=("/absolute/path/to/docs/completions")
autoload -Uz compinit
compinit
```

Fish (`~/.config/fish/completions/tadoi.fish`):

```bash
cp "/absolute/path/to/docs/completions/tadoi.fish" ~/.config/fish/completions/tadoi.fish
```

Scripted install (recommended):

```bash
bun run completions:install:user
```

Skip auto-install on dependency install:

```bash
TADOI_SKIP_COMPLETION_INSTALL=1 bun install
```

## Verify

```bash
tadoi <TAB>
tadoi export --<TAB>
tadoi calendar:import --<TAB>
```

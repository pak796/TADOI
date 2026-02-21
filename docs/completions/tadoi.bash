_tadoi_completions() {
  local cur prev command
  COMPREPLY=()

  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  if [[ "$prev" == "--data-file" || "$prev" == "--out" || "$prev" == "--in" || "$prev" == "--view" || "$prev" == "--report" ]]; then
    COMPREPLY=( $(compgen -f -- "$cur") )
    return 0
  fi

  command="${COMP_WORDS[1]}"
  if [[ -z "$command" || "$command" == -* ]]; then
    local roots="add done due recur help export import calendar:export calendar:import --help -h --version --smoke-tui --interactive --json --quiet --data-file --no-logo"
    COMPREPLY=( $(compgen -W "$roots" -- "$cur") )
    return 0
  fi

  case "$command" in
    add|done|due|recur|help)
      COMPREPLY=( $(compgen -W "--help -h --" -- "$cur") )
      ;;
    export)
      COMPREPLY=( $(compgen -W "--help -h --out --format --pretty --redact --redact-mode --json --quiet --data-file" -- "$cur") )
      ;;
    import)
      COMPREPLY=( $(compgen -W "--help -h --in --mode --backup --no-backup --dry-run --yes --pretty --json --quiet --data-file" -- "$cur") )
      ;;
    calendar:export)
      COMPREPLY=( $(compgen -W "--help -h --out --view --range --privacy --include-details --json --quiet --data-file" -- "$cur") )
      ;;
    calendar:import)
      COMPREPLY=( $(compgen -W "--help -h --in --view --range --mode --horizon-days --dry-run --tag --report --json --quiet --data-file" -- "$cur") )
      ;;
    *)
      COMPREPLY=( $(compgen -W "--help -h --version --interactive --json --quiet --data-file --no-logo" -- "$cur") )
      ;;
  esac
}

complete -F _tadoi_completions tadoi

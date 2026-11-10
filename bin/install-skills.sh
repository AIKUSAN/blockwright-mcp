#!/usr/bin/env bash
# Installs the Agent Skills bundled with Blockwright MCP into Claude's skills folder.
#
#   bin/install-skills.sh                 copy every skills/<name> to ~/.claude/skills/<name>
#   bin/install-skills.sh --update        replace skills that are already installed
#   bin/install-skills.sh --dry-run       say what would happen and change nothing
#   bin/install-skills.sh --dest DIR      install into DIR instead of ~/.claude/skills
#
# A skill folder that already exists is skipped and named. With --update the old copy is moved
# to <dest>/_old/<name>_<date>/ first (-2, -3 ... when that folder exists). Nothing is deleted.
# Only folders that hold a SKILL.md are installed, so skills/README.md and notes are left out.
#
# Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
set -euo pipefail

update=0
dry=0
dest="${HOME}/.claude/skills"
while [ $# -gt 0 ]; do
  case "$1" in
    --update) update=1 ;;
    --dry-run) dry=1 ;;
    --dest)
      shift
      [ $# -gt 0 ] || { echo "install-skills: --dest needs a folder" >&2; exit 2; }
      dest="$1" ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "install-skills: unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="${here}/../skills"
[ -d "$src" ] || { echo "install-skills: no skills folder at ${src}" >&2; exit 1; }
day="$(date +%Y-%m-%d)"

installed=()
updated=()
skipped=()

run() { if [ "$dry" -eq 1 ]; then echo "  would: $*"; else "$@"; fi; }

[ "$dry" -eq 1 ] || mkdir -p "$dest"

for dir in "$src"/*/; do
  [ -f "${dir}SKILL.md" ] || continue
  name="$(basename "$dir")"
  target="${dest}/${name}"
  if [ -e "$target" ]; then
    if [ "$update" -ne 1 ]; then
      skipped+=("$name")
      continue
    fi
    old="${dest}/_old/${name}_${day}"
    n=1
    while [ -e "$old" ]; do n=$((n + 1)); old="${dest}/_old/${name}_${day}-${n}"; done
    run mkdir -p "${dest}/_old"
    run mv "$target" "$old"
    echo "moved the old ${name} to ${old}"
    run cp -R "${dir%/}" "$target"
    updated+=("$name")
  else
    run cp -R "${dir%/}" "$target"
    installed+=("$name")
  fi
done

echo "installed (${#installed[@]}): ${installed[*]:-none}"
echo "updated (${#updated[@]}): ${updated[*]:-none}"
echo "skipped, already there (${#skipped[@]}): ${skipped[*]:-none}"
if [ "${#skipped[@]}" -gt 0 ]; then
  echo "Run again with --update to replace the skipped ones; the old copies move to ${dest}/_old/."
fi

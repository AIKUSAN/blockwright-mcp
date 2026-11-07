"""
Writes THIRD_PARTY_NOTICES.md: the licence text of every runtime dependency
that can end up in the bundled plugin (the dependency closure of package.json
"dependencies", minus the bun runtime). Run after `bun install`.

Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only.
"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
nm = root / "node_modules"
deps = [d for d in json.load(open(root / "package.json")).get("dependencies", {}) if d != "bun"]
seen, stack = {}, list(deps)
while stack:
    name = stack.pop()
    if name in seen: continue
    pj = nm / name / "package.json"
    if not pj.exists(): raise SystemExit(f"missing {name}: run bun install")
    data = json.load(open(pj)); seen[name] = data
    stack += list((data.get("dependencies") or {}).keys())
out = ["# Third-party notices", "",
       "The built plugin (`plugin/blockwright_mcp.js`) bundles code from these packages. Each is used under the licence reproduced below.", ""]
for name in sorted(seen):
    data = seen[name]
    files = sorted(p for p in (nm / name).iterdir() if p.is_file() and p.name.upper().startswith(("LICENSE", "LICENCE", "COPYING", "NOTICE")))
    out += [f"## {name} {data.get('version')} ({data.get('license')})", ""]
    if files:
        for f in files: out += ["```", f.read_text(errors="replace").strip(), "```", ""]
    elif (override := root / "build" / "licenses" / (name.replace("/", "__") + ".txt")).exists():
        # The package ships no licence file; this text is copied from its source repository.
        out += [f"The package ships no licence file. This text is from its source repository ({data.get('repository', {}).get('url', 'see package.json') if isinstance(data.get('repository'), dict) else data.get('repository')}):", "",
                "```", override.read_text().strip(), "```", ""]
    else:
        raise SystemExit(f"{name} ships no licence file; add its text to build/licenses/")
(root / "THIRD_PARTY_NOTICES.md").write_text("\n".join(out))
print(f"THIRD_PARTY_NOTICES.md: {len(seen)} packages")

<!-- Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only. Our own notes; the skills in the folders beside this file are unchanged upstream text. -->
# Notes on the bundled skills

The skills here come from two projects and are installed unchanged (see each folder's `UPSTREAM.md` for the source and commit):

- 15 from [blockbench-mcp-project](https://github.com/jasonjgardner/blockbench-mcp-project) (Apache-2.0), written for the jasonjgardner plugin's tool names;
- `blockbench-mcp-modeling` from [sosadly/blockbench-mcp](https://github.com/sosadly/blockbench-mcp) (MIT), written for sosadly's tool names.

Blockwright registers both tool sets, so a skill's calls find their tools. Where the two overlap under different names (`add_cube` and `place_cube`, `delete_element` and `remove_element`), both exist.
Tool names carry a client prefix: a server added as `blockbench` shows as `mcp__blockbench__<tool>` in Claude Code.

What differs from the upstream setup:

- `find_references` (sosadly's web image search) does not exist in Blockwright. When `blockbench-mcp-modeling` says to call it, ask the user for reference images and load them with `load_reference` (`path` or `data_url`).
- `execute_script` is on or off with `risky_eval` (Settings > General).
- `install_plugin` and `uninstall_plugin` stay off until the matching setting is turned on.
- `blockbench-gpt-image-textures` needs a fal.ai key, `blockbench-new-model` needs Blender, FFmpeg and the headless server (`bin/blockbench-mcp-headless.mjs`), and `blockbench-substance` needs Substance 3D. Blockwright adds no tool for them.

`blockbench-flipbook-textures/scripts/sheet_to_flipbook.test.mjs` needs Python and Pillow. It is not part of `bun test`; run it from that folder.

Install with `bin/install-skills.sh` (see the README).

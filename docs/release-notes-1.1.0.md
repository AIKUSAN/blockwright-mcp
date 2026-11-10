<!-- Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only. Draft for the GitHub release of 1.1.0. -->
Blockwright MCP 1.1.0 for Blockbench.

This release brings Blockwright up to date with both projects it is built from. When it was forked, only the plugin code came across. The skills, the agent and the tools added since did not.

## What's new

- **24 more tools from sosadly/blockbench-mcp 0.4.0.** 14 are new in that release: `add_cylinder`, `add_flare`, `add_gear`, `add_hair`, `add_meshes`, `add_pipe`, `animate_mechanism`, `create_textures`, `fix_z_fighting`, `get_palette`, `inspect_model`, `make_palette`, `paint_face`, `zoom_reference`. The other 10 were left out of 1.0.x because a base tool does a similar job, and they are back under sosadly's names: `add_cube`, `add_cubes`, `add_keyframe`, `add_keyframes`, `add_mesh`, `delete_element`, `execute_script`, `list_outliner`, `new_project`, `screenshot`. The catalogue now has 228 tools. A client lists only the ones that work in the current editor state, 93 with no project open.
- **16 skills and 1 agent, bundled unchanged.** 15 skills from [blockbench-mcp-project](https://github.com/jasonjgardner/blockbench-mcp-project) (Apache-2.0), the `blockbench-mcp-modeling` skill from sosadly (MIT), and the `blockbench-physical-accuracy-reviewer` agent. They teach an assistant how to model, texture, rig and animate with these tools. Each folder says where it came from (`UPSTREAM.md`) and carries its licence (`LICENSE.upstream`).
- **`bin/install-skills.sh`** copies the skills into `~/.claude/skills`. It skips and names any skill that is already there. With `--update` it moves the old copy to `~/.claude/skills/_old/<name>_<date>/` first. It never deletes anything.
- **A comparison with both upstream projects** in `docs/upstream-sync-2026-11-10.md`, and rebuilt API docs for 228 tools.
- **104 new sosadly tests**, wiring tests for every added tool, and tests for the install script.

## Not included, and why

- **`find_references`**, sosadly's web image search, and the `url` and `result` options of `load_reference`. They need an online service, and Blockwright does not add tools like that. Load reference images with `load_reference` and a file `path` or a `data_url`. The guides and error messages no longer send the model to a tool that is not there.
- **Skills that need other software** still need it. `blockbench-gpt-image-textures` needs a fal.ai key (a paid online service), `blockbench-new-model` needs Blender and FFmpeg, and `blockbench-substance` needs Substance 3D. The skills describe those steps. Blockwright adds no tool for them.
- **Six coding-aid skills** from the plugin repository (`zod`, `typescript-expert`, `vue-best-practices`, `bun-development`, `skill-creator`, `mcp-builder`). They are for people who work on the plugin itself, and their licences are mixed.

## Things to know

- `execute_script` is switched on and off together with `risky_eval` (Settings > General), so it is on by default. In sosadly it had its own switch, which was off by default.
- `install_plugin` and `uninstall_plugin` stay off until you turn on **Settings > General > Blockwright MCP: allow install_plugin / uninstall_plugin**. `install_plugin` can install from a URL or the store, so leave it off unless you need it.
- The bundled agent file sets `model: opus` and allows web search and fetch. It is unchanged upstream text, so edit your copy if you want otherwise.

## Install

1. Download `blockwright_mcp.js` from the assets below.
2. In Blockbench, choose **File > Plugins > Load Plugin from File** and pick the file. If you have 1.0.x, load the new file in its place.
3. Point your MCP client at `http://localhost:3001/blockwright`. The README has the setup for Claude Code and Claude Desktop.
4. For the skills, get the source (`git clone` or the source zip of this release), then run `bin/install-skills.sh` from it. To use the agent in Claude Code, copy it: `mkdir -p ~/.claude/agents && cp agents/*.md ~/.claude/agents/`.

## Credits

- Base plugin: [blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) by Jason J. Gardner and contributors, GPL-3.0-only.
- Ported tools, their tests and one skill: [blockbench-mcp](https://github.com/sosadly/blockbench-mcp) by sosadly, MIT.
- Skills and the agent: [blockbench-mcp-project](https://github.com/jasonjgardner/blockbench-mcp-project) by Jason J. Gardner, Apache-2.0.
- GeckoLib validation: portions from [minecraft-blockbench-mcp](https://github.com/adhi-jp/minecraft-blockbench-mcp) by adhi-jp, MIT.

Created by AIKUSAN (Minecraft IGN: AIKUSAN). Licensed under GPL-3.0-only; see LICENSE and NOTICE.
NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

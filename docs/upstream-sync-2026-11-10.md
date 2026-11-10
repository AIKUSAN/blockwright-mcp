<!-- Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only. -->
# Upstream sync, 2026-11-10 (Blockwright 1.1.0)

What the two upstream projects ship, what Blockwright 1.0.2 had, and what 1.1.0 does about the difference.
Names were read from the source text of fresh clones. Nothing from the clones was run.

## Sources

| Project | Commit read | Licence | Blockwright had |
|---|---|---|---|
| jasonjgardner/blockbench-mcp-plugin (`main`) | `97a8a80`, v1.10.1, 2026-10-25 | GPL-3.0-only | the same commit: nothing new on `main` since the fork |
| jasonjgardner/blockbench-mcp-project | `e9c29a93e54bdd9aaa8a308196dfd4147e47d88c`, 2026-09-25 | Apache-2.0 | none of its skills or its agent |
| sosadly/blockbench-mcp (`main`) | `b024728`, v0.4.0, 2026-11-07 | MIT | `028cdd7`, v0.3.1 |

The plugin repository has three branches that are not on `main`: `feat/webmcp` (a browser WebMCP adapter, 3,805 lines, not merged),
`copilot/improve-agent-undo-system` and `79-claude-code`. They are not ported: only `main` counts as shipped.

## List 1: tools registered by the jasonjgardner plugin

147 tools, read from every `*ToolDocs` entry under `server/tools/`. All 147 are registered in Blockwright 1.0.2. Nothing to port.

## List 2: tools registered by sosadly

86 tools in 0.4.0, up from 71 in 0.3.1, so 15 are new. The 1.0.2 column says what Blockwright did with each.

| Tool | In 0.3.1 | Blockwright 1.0.2 | Blockwright 1.1.0 |
|---|---|---|---|
| `add_cube` | yes | merged | registered (was merged into base twin) |
| `add_cubes` | yes | merged | registered (was merged into base twin) |
| `add_cylinder` | new | - | registered (new) |
| `add_flare` | new | - | registered (new) |
| `add_gear` | new | - | registered (new) |
| `add_group` | yes | merged | merged (same name as a base tool) |
| `add_groups` | yes | registered | registered |
| `add_hair` | new | - | registered (new) |
| `add_hollow_volume` | yes | registered | registered |
| `add_keyframe` | yes | merged | registered (was merged into base twin) |
| `add_keyframes` | yes | merged | registered (was merged into base twin) |
| `add_mesh` | yes | merged | registered (was merged into base twin) |
| `add_meshes` | new | - | registered (new) |
| `add_pipe` | new | - | registered (new) |
| `add_plane` | yes | registered | registered |
| `add_wing` | yes | registered | registered |
| `analyze_animation` | yes | registered | registered |
| `animate_mechanism` | new | - | registered (new) |
| `apply_texture` | yes | merged | merged (same name as a base tool) |
| `ask_user` | yes | registered | registered |
| `audit_complexity` | yes | registered | registered |
| `check_model` | yes | registered | registered |
| `check_rig` | yes | registered | registered |
| `check_sides` | yes | registered | registered |
| `clear_references` | yes | registered | registered |
| `close_project` | yes | registered | registered |
| `compare_reference` | yes | registered | registered |
| `create_animation` | yes | merged | merged (same name as a base tool) |
| `create_rig` | yes | registered | registered |
| `create_texture` | yes | merged | merged (same name as a base tool) |
| `create_textures` | new | - | registered (new) |
| `create_vfx_texture` | yes | registered | registered |
| `delete_element` | yes | merged | registered (was merged into base twin) |
| `detail_cubes` | yes | registered | registered |
| `edit_element` | yes | registered | registered |
| `execute_script` | yes | merged | registered (was merged into base twin) |
| `export_model` | yes | merged | merged (same name as a base tool) |
| `export_project` | yes | registered | registered |
| `extrude_chain` | yes | registered | registered |
| `find_references` | new | - | not ported (web search) |
| `fix_z_fighting` | new | - | registered (new) |
| `generate_animation` | yes | registered | registered |
| `generate_array` | yes | registered | registered |
| `get_element` | yes | registered | registered |
| `get_guide` | yes | registered | registered |
| `get_orientation` | yes | registered | registered |
| `get_palette` | new | - | registered (new) |
| `get_reference` | yes | registered | registered |
| `get_rig` | yes | registered | registered |
| `get_status` | yes | registered | registered |
| `get_texture` | yes | merged | merged (same name as a base tool) |
| `import_texture` | yes | registered | registered |
| `inspect_model` | new | - | registered (new) |
| `install_plugin` | yes | registered | registered |
| `list_animations` | yes | registered | registered |
| `list_formats` | yes | registered | registered |
| `list_outliner` | yes | merged | registered (was merged into base twin) |
| `list_plugins` | yes | registered | registered |
| `list_references` | yes | registered | registered |
| `list_textures` | yes | merged | merged (same name as a base tool) |
| `load_project` | yes | registered | registered |
| `load_reference` | yes | registered | registered |
| `make_palette` | new | - | registered (new) |
| `measure_model` | yes | registered | registered |
| `mirror_element` | yes | registered | registered |
| `new_project` | yes | merged | registered (was merged into base twin) |
| `pack_uv` | yes | registered | registered |
| `paint_face` | new | - | registered (new) |
| `paint_faces` | yes | registered | registered |
| `paint_texture` | yes | registered | registered |
| `preview_animation` | yes | registered | registered |
| `remove_animation` | yes | registered | registered |
| `request_review` | yes | registered | registered |
| `resize_texture` | yes | registered | registered |
| `save_project` | yes | registered | registered |
| `screenshot` | yes | merged | registered (was merged into base twin) |
| `screenshot_views` | yes | registered | registered |
| `set_camera_angle` | yes | merged | merged (same name as a base tool) |
| `set_cube_uv` | yes | merged | merged (same name as a base tool) |
| `set_project_meta` | yes | registered | registered |
| `set_texture_render_mode` | yes | registered | registered |
| `uninstall_plugin` | yes | registered | registered |
| `voxelize_matrix` | yes | registered | registered |
| `wait_review` | yes | registered | registered |
| `which_side` | yes | registered | registered |
| `zoom_reference` | new | - | registered (new) |

Counts: 76 registered (52 before), 9 not registered because a base tool has the same name, 1 not ported.

- **New in 0.4.0, now registered (14):** `add_cylinder`, `add_flare`, `add_gear`, `add_hair`, `add_meshes`, `add_pipe`, `animate_mechanism`,
  `create_textures`, `fix_z_fighting`, `get_palette`, `inspect_model`, `make_palette`, `paint_face`, `zoom_reference`.
- **Registered under sosadly's own name (10):** `add_cube`, `add_cubes`, `add_keyframe`, `add_keyframes`, `add_mesh`, `delete_element`,
  `execute_script`, `list_outliner`, `new_project`, `screenshot`. 1.0.2 left these out because a base tool does the same job under another
  name (`place_cube`, `remove_element`, `create_project`, ...). sosadly's skill (`blockbench-mcp-modeling`) calls them by these names,
  so a model that follows the skill failed on its first call. Their names do not clash with a base tool, so all ten are registered now.
  sosadly's skill calls seven of them (`add_cube`, `add_cubes`, `add_keyframes`, `add_mesh`, `delete_element`, `execute_script`, `list_outliner`) and
  no skill calls `add_keyframe`, `new_project` or `screenshot`. In sosadly, `execute_script` had its own switch that defaulted to off. Here it follows the same setting as
  `risky_eval` (Settings > General), which defaults to on, and is listed only while that setting is on.
- **Still merged (9):** `add_group`, `apply_texture`, `create_animation`, `create_texture`, `export_model`, `get_texture`, `list_textures`,
  `set_camera_angle`, `set_cube_uv`. The base tool has the same name, and two tools cannot share one.
- **Changed in 0.4.0, picked up by the update:** `edit_element` takes `offset` and refuses `from`, `to` and `inflate` where they do nothing,
  `get_element` reports a mesh's origin, rotation and bounds, and the re-registered `add_mesh` no longer leaves a default cube behind.
  (`set_camera_angle` also learned to return to perspective, but the base tool of that name is still the registered one.)

### Not ported, with the reason

| Tool or option | Reason |
|---|---|
| `find_references` | Searches the web (Bing, DuckDuckGo, Wikimedia) from sosadly's Node process. Blockwright does not port tools that need an online service. `get_status` no longer tells the model to call it. |
| `load_reference` options `result` and `url` | They download an image from the web through the same Node code. `path` and `data_url` still work. |
| sosadly's bridge, stdio server and `coerceArgs` Node side | The MCP server runs inside Blockbench, so there is nothing to bridge. |

## List 3: tool names the skills and the agent call

65 files scanned (the 16 skills' Markdown and the physical-accuracy reviewer): 562 distinct `snake_case` names in backticks.

- **143 are Blockwright tools** and are registered.
- **24 are sosadly tools that 1.0.2 did not register.** 23 are registered in 1.1.0: the 14 new tools and nine of the ten re-registered names
  (no skill calls `screenshot`). The 24th is `find_references` (web search, not ported). `add_keyframe` and `new_project` appear in the skills only as
  Blockbench event names, while `add_cube` and `add_mesh` appear both as events (`blockbench-development`) and as tools (`blockbench-mcp-modeling`).
- **395 are not tool names.** Reviewed by hand:
  - Blockbench events listed in `blockbench-development/references/events.md` (`select_texture`, `canvas_click`, `load_plugin`, ...)
  - parameters, dialog fields and check ids (`rearrange_uv`, `double_use`, `texel_density_mismatch`, ...)
  - texture and block names (`oak_planks`, `grass_block_top`, ...)
  - Python and CLI names (`load_material_from_folder`, `substance3d_baker`, ...)
  - the headless server's tools (`bbmodel_create`, `bbmodel_edit`, `bbmodel_render`, `bbmodel_validate`, `blockbench_launch`, ...), which Blockwright already ships in `headless/` (`bin/blockbench-mcp-headless.mjs`)
  - tools of a separate plugin: `havok_set_body_physics` and `havok_simulate_physics` belong to the Havok Blockbench plugin that the `blockbench-new-model` skill asks for.

## The 19 names from the first look

`group_elements`, `update_elements`, `select_texture`, `select_animation`, `select_keyframe`, `timeline_update`, `display_animation_frame`,
`bind_to_actor`, `canvas_click`, `canvas_drag`, `press_key`, `resize_window`, `show_panel`, `hide_panel`, `update_view`, `update_settings`,
`update_toolbar`, `load_plugin`, `unload_plugin`.

**Correction: none of the 19 is an MCP tool.** 18 are Blockbench event names, listed in the "Events Reference" of the plugin-development skill
(`skills/blockbench-development/references/events.md`, and `select_animation` is also in that skill's `SKILL.md`). A plugin author subscribes to them with
`Blockbench.on(...)`. `bind_to_actor` is a Bedrock particle keyframe option, used in `blockbench-particles`. No upstream project registers
any of the 19 as a tool, so there is nothing to port, and `load_plugin` / `unload_plugin` do not need a "local files only" rule.
The tools that load plugins are sosadly's `install_plugin` and `uninstall_plugin`, which Blockwright already ships and keeps off until
Settings > General > "allow install_plugin / uninstall_plugin" is turned on.

## Skills and agents

| Item | Source | Bundled in 1.1.0 |
|---|---|---|
| 15 skills (`blockbench-use`, `-new-model`, `-mcp-overview`, `-modeling`, `-texturing`, `-pbr-materials`, `-animation`, `-particles`, `-hytale`, `-vanilla-textures`, `-gpt-image-textures`, `-flipbook-textures`, `-albedo-to-pbr`, `-substance`, `-development`) | blockbench-mcp-project `e9c29a93`, Apache-2.0 | yes, unchanged, in `skills/` |
| `blockbench-mcp-modeling` | sosadly `b024728`, MIT | yes, unchanged |
| `blockbench-physical-accuracy-reviewer` (agent) | blockbench-mcp-project `e9c29a93`, Apache-2.0 | yes, unchanged, in `agents/` |
| `blockbench-plugins` (`.github/skills/` and `.agents/skills/` in the plugin repository) | plugin repository `97a8a80` | no: an older copy of `blockbench-development`, which is the same skill in a newer version |
| `zod`, `typescript-expert`, `vue-best-practices`, `bun-development`, `skill-creator`, `mcp-builder` (`.agents/skills/` in the plugin repository) | plugin repository `97a8a80`, where `skill-creator` and `mcp-builder` carry their own `LICENSE.txt` | no: coding aids for the plugin's own contributors that are not about Blockbench modelling, with mixed or unstated licences |

Some skills need something outside Blockbench. `blockbench-gpt-image-textures` needs a `FAL_KEY` for an online paid service, `blockbench-new-model` needs Blender and FFmpeg,
and `blockbench-substance` needs a licensed Substance 3D install. The skills ship, and Blockwright adds no tool for any of those services.

## Counts

| | 1.0.2 | 1.1.0 |
|---|---|---|
| Tools in the catalogue (`docs/tools.md`) | 204 | 228 |
| Listed with no project open (desktop app, default settings, no dialog open) | 69 | 93 |

A client never sees the whole catalogue at once. See the top of `docs/tools.md`.

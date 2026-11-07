<!-- Modified by AIKUSAN, 2026-11-06: rewritten for Blockwright MCP; the upstream README is kept in docs/upstream-README.md. -->
# Blockwright MCP for Blockbench

**Blockwright MCP for Blockbench** is an unofficial MCP server. It runs inside Blockbench and lets AI assistants such as Claude Desktop and Claude Code work on your models.

> Blockwright MCP is not an official Blockbench product and is not endorsed by the Blockbench project, by Jason J. Gardner, or by sosadly.

It combines [blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) by Jason J. Gardner (the base) with the tools of [blockbench-mcp](https://github.com/sosadly/blockbench-mcp) by sosadly, plus additions for day-to-day modelling work.

## What is different from the upstream projects

- **One plugin, 204 tools.** The base plugin's tools plus 52 tools ported from sosadly/blockbench-mcp, with no separate bridge process.
- **Review sheets.** `render_review_sheet` renders front, back, sides, top and a three-quarter view into one PNG. Each cell marks where the model's own right and left are, because a front view is mirrored.
- **Left/right checks.** `which_side` and `check_sides` compare names such as `arm_left` with the geometry. A Minecraft-style model faces −Z, so its own right is +X in Blockbench. Note that the Bedrock export mirrors X: the model's right is −X in a `.geo.json`.
- **WebGL recovery.** Screenshots refuse frames from a lost WebGL context instead of returning blank images. `render_health` and `recover_renderer` rebuild what can be rebuilt and say when Blockbench must be restarted.
- **The user's camera stays put.** All review and screenshot tools render offscreen.
- **Side guard.** `place_cube` and `add_group` compare left/right names with where the part sits, and warn (or, with `side_check: "refuse"`, create nothing) when they disagree.
- **Overlap and z-fighting finder.** `find_overlaps` uses each cube's real world transform, so rotated cubes and rotated groups count. It lists coplanar faces that flicker and cubes that intersect, with a suggested outward offset for each z-fighting pair.
- **Silhouette compare.** `compare_silhouette` renders one view offscreen and compares its outline with a reference image. You get one image (reference, model, difference) plus an overlap score overall and per region.
- **WebGL budget guard.** New offscreen views are refused before Blockbench gets close to Chromium's limit on live WebGL contexts. A lost offscreen view is rebuilt automatically on its next render, and every loss shows a notice inside Blockbench.
- **Runs beside the original.** Its own plugin id, port, settings and panels.

The full list is in [CHANGELOG.md](CHANGELOG.md).

## Install in Blockbench (desktop)

1. Download `plugin/blockwright_mcp.js` from this repository (or from a release).
2. In Blockbench: **File > Plugins > Load Plugin from File**, then choose the file.
3. Blockbench asks for permission to use network and system modules; the MCP server needs them. Allow them. File access is asked for the first time a tool reads a file (for example a reference image for `compare_silhouette`).
4. The server listens on `http://localhost:3001/blockwright`. Port and path can be changed under **Settings > General**.

Blockwright MCP needs Blockbench 5.0 or newer (tested on 5.2.2).

The text of the MCP prompts is built into the plugin. Only a build without it fetches the text from this repository through the jsDelivr CDN (`cdn.jsdelivr.net/gh/AIKUSAN/blockwright-mcp`); **Settings > General** can turn that off. Nothing about your models is sent.

## Connect an MCP client

### Claude Desktop

Add this to `claude_desktop_config.json` and restart the app:

```json
{
  "mcpServers": {
    "blockwright": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3001/blockwright"]
    }
  }
}
```

### Claude Code

```
claude mcp add --transport http blockwright http://localhost:3001/blockwright
```

## Tools

Tools that need an open project only appear while one is open. `install_plugin` and `uninstall_plugin` stay off until **Settings > General > Blockwright MCP: allow install_plugin / uninstall_plugin** is turned on. `risky_eval` runs JavaScript inside Blockbench and can be turned off in settings.

- **Cubes** (5): `place_cube`, `modify_cube`, `knife_cut_cube`, `slice_cubes_to_block_grid`, `inspect_block_bounds`
- **Camera & Screenshots** (7): `capture_screenshot`, `capture_app_screenshot`, `set_camera_angle`, `create_offscreen_view`, `list_views`, `resize_offscreen_view`, `delete_offscreen_view`
- **Review & Renderer Health** (3): `render_review_sheet`, `render_health`, `recover_renderer`
- **Ported from sosadly/blockbench-mcp (MIT)** (52): `get_status`, `get_guide`, `get_orientation`, `which_side`, `check_sides`, `request_review`, `wait_review`, `ask_user`, `list_formats`, `get_reference`, `load_reference`, `list_references`, `clear_references`, `compare_reference`, `measure_model`, `set_project_meta`, `close_project`, `save_project`, `export_project`, `load_project`, `add_groups`, `voxelize_matrix`, `add_hollow_volume`, `generate_array`, `extrude_chain`, `add_wing`, `check_model`, `audit_complexity`, `pack_uv`, `add_plane`, `mirror_element`, `edit_element`, `get_element`, `create_vfx_texture`, `set_texture_render_mode`, `import_texture`, `paint_texture`, `detail_cubes`, `paint_faces`, `resize_texture`, `list_animations`, `remove_animation`, `create_rig`, `check_rig`, `get_rig`, `generate_animation`, `analyze_animation`, `preview_animation`, `screenshot_views`, `list_plugins`, `install_plugin`, `uninstall_plugin`
- **Quality checks** (2): `find_overlaps`, `compare_silhouette`
- **Capabilities** (1): `get_capabilities`
- **Animation** (9): `create_animation`, `manage_keyframes`, `animation_graph_editor`, `bone_rigging`, `animation_timeline`, `batch_keyframe_operations`, `animation_copy_paste`, `variable_placeholders`, `list_molang_variables`
- **Armature** (17): `list_armatures`, `get_armature`, `add_armature`, `remove_armature`, `update_armature`, `list_armature_bones`, `get_armature_bone`, `add_armature_bone`, `remove_armature_bone`, `update_armature_bone`, `update_armature_bones_batch`, `select_armature_bones`, `get_vertex_weights`, `set_vertex_weight`, `set_vertex_weights_batch`, `clear_vertex_weights`, `set_ik_controller`
- **Display Settings** (3): `get_display_transform`, `set_display_transform`, `enter_display_mode`
- **Elements** (9): `remove_element`, `add_group`, `list_outline`, `duplicate_element`, `rename_element`, `find_elements_by_criteria`, `select_all_of_type`, `filter_by_material`, `get_selection`
- **Export** (2): `list_export_formats`, `export_model`
- **History** (4): `undo`, `redo`, `get_undo_stack`, `save_checkpoint`
- **Import/Export** (1): `from_geo_json`
- **Material Instances** (5): `get_face_material_instances`, `set_face_material_instance`, `list_material_instances`, `bulk_set_material_instances`, `clear_material_instances`
- **Mesh Editing** (15): `place_mesh`, `extrude_mesh`, `subdivide_mesh`, `create_sphere`, `select_mesh_elements`, `move_mesh_vertices`, `delete_mesh_elements`, `merge_mesh_vertices`, `create_mesh_face`, `create_cylinder`, `knife_tool`, `create_polyhedron`, `loop_cut_mesh`, `flip_in_place`, `get_mesh_info`
- **Paint Tools** (12): `paint_fill_tool`, `draw_shape_tool`, `gradient_tool`, `color_picker_tool`, `copy_brush_tool`, `eraser_tool`, `paint_settings`, `paint_with_brush`, `create_brush_preset`, `load_brush_preset`, `texture_selection`, `texture_layer_management`
- **Particles** (7): `list_particle_presets`, `create_particle_effect`, `update_particle_effect`, `list_particle_effects`, `manage_particle_keyframes`, `add_locator`, `export_particle_pack`
- **Performance** (1): `get_average_fps`
- **Project** (2): `create_project`, `get_project_info`
- **Textures** (14): `create_texture`, `apply_texture`, `add_texture_group`, `list_textures`, `get_texture`, `create_pbr_material`, `configure_material`, `list_materials`, `get_material_info`, `import_texture_set`, `assign_texture_channel`, `save_material_config`, `activate_texture`, `delete_texture`
- **UI Interaction** (6): `trigger_action`, `risky_eval`, `emulate_clicks`, `fill_dialog`, `list_modes`, `set_mode`
- **UV Mapping** (5): `set_mesh_uv`, `auto_uv_mesh`, `rotate_mesh_uv`, `get_cube_uv`, `set_cube_uv`
- **GeckoLib Integration** (10): `geckolib_get_format_info`, `geckolib_set_project_settings`, `geckolib_list_easings`, `geckolib_get_keyframe_easing`, `geckolib_set_keyframe_easing`, `geckolib_reverse_keyframe_easing`, `geckolib_validate_model`, `geckolib_export_model`, `geckolib_export_animations`, `geckolib_export_display`
- **Hytale Integration** (12): `hytale_get_format_info`, `hytale_validate_model`, `hytale_set_cube_properties`, `hytale_get_cube_properties`, `hytale_create_quad`, `hytale_list_attachments`, `hytale_set_attachment_piece`, `hytale_list_attachment_pieces`, `hytale_create_visibility_keyframe`, `hytale_set_animation_loop`, `hytale_set_cube_stretch`, `hytale_get_cube_stretch`

## Build from source

```
bun install
bun run build        # writes dist/blockwright_mcp.js
bun test             # upstream and Blockwright tests
node --test tests-node/
```

`build/port-sosadly.py <checkout of sosadly/blockbench-mcp>` regenerates the ported sosadly files.

## Report a problem

Please report problems with Blockwright MCP in this repository's issue tracker, not to the upstream projects.

## Credits and licence

- Base: [blockbench-mcp-plugin](https://github.com/jasonjgardner/blockbench-mcp-plugin) by Jason J. Gardner and contributors, GPL-3.0-only.
- Ported tools and the Copilot panel: [blockbench-mcp](https://github.com/sosadly/blockbench-mcp) by sosadly, MIT. The MIT notice is kept in the ported files and in `LICENSES/`.
- Changes and additions: Copyright (c) 2026 AIKUSAN (Minecraft IGN: AIKUSAN).

Blockwright MCP as a whole is licensed under the GNU General Public License v3.0 only. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

The upstream README is kept in [docs/upstream-README.md](docs/upstream-README.md).

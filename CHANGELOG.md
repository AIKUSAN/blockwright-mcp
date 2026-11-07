# Changelog

## 1.0.0 (prepared 2026-11-06, not yet published)

First release of Blockwright MCP, based on blockbench-mcp-plugin 1.10.1 (commit 97a8a80) by Jason J. Gardner and contributors, with tools from blockbench-mcp 0.3.1 (commit 028cdd7) by sosadly.

### Added
- Side guard: `place_cube` and `add_group` take `side_check` (`warn` by default, `refuse`, `off`) and compare left/right names with the geometry. The model faces -Z, so its right is +X.
- `find_overlaps`: z-fighting (coplanar same-facing faces of different cubes that overlap by an area) and intersecting volumes, from each cube's world transform, so rotations and rotated groups count. Each z-fighting pair gets a suggested outward offset.
- `compare_silhouette`: the model's outline from one view against a reference image, with an image (reference, model, difference) and IoU overall and per 3x3 region.
- WebGL budget guard: `create_offscreen_view` refuses new views at 12 live WebGL contexts, a lost offscreen view is rebuilt automatically on its next render, every loss shows a notice in Blockbench, and `render_health` reports the budget.
- `render_review_sheet`: several views of the model in one labelled PNG, rendered offscreen. Each cell marks which image edge shows the model's own right and left.
- `render_health` and `recover_renderer`: detect a lost WebGL context, rebuild offscreen views, and say clearly when Blockbench must be restarted.
- 52 tools ported from sosadly/blockbench-mcp, among them `which_side`, `check_sides`, `measure_model`, `analyze_animation`, `preview_animation`, `screenshot_views`, `compare_reference`, `request_review` and the procedural generators. Their captures render through one offscreen view, so the user's camera never moves.
- The MCP Copilot panel from sosadly/blockbench-mcp.

### Changed
- Named "Blockwright MCP for Blockbench", with source and issues at https://github.com/AIKUSAN/blockwright-mcp.
- The inherited Pages workflow (`.github/workflows/deploy.yml`) runs only when started by hand.
- Removed from the release: upstream's agent and skill files (`.agents/`, `.github/skills/`, `AGENTS.md`, `CLAUDE.md`).
- Plugin id `blockwright_mcp`, default address `http://localhost:3001/blockwright`, and all Blockbench setting, panel, mode and dialog ids prefixed `blockwright_`, so Blockwright MCP can run beside the original plugin.
- Screenshots refuse frames from a lost WebGL context instead of returning a blank image.
- `analyze_animation` and `preview_animation` keep the selected animation and timeline time.
- Prompt updates load from this project's repository, not upstream's.

### Release files
- `package.json` (name, version, author, repository links) and `prompts/manifest.json` (regenerated prompt text) were changed on 2026-11-06. JSON cannot carry a change note.
- The built plugin carries the GPL and MIT notices in its header, and `THIRD_PARTY_NOTICES.md` lists the bundled packages' licences.

### Fixed
- Top and bottom views in the ported sosadly tools reported left and right the wrong way round.
- Deleting an offscreen view failed on Blockbench 5.2.2 ("onContextMenu is not defined").

### Not ported
Where both projects had the same tool, the blockbench-mcp-plugin version is kept: `add_group`, `apply_texture`, `create_animation`, `create_texture`, `export_model`, `get_texture`, `list_textures`, `set_camera_angle`, `set_cube_uv`; and `new_project`→`create_project`, `delete_element`→`remove_element`, `list_outliner`→`list_outline`, `screenshot`→`capture_screenshot`, `execute_script`→`risky_eval`, `add_cube`/`add_cubes`→`place_cube`, `add_keyframe`→`manage_keyframes`, `add_keyframes`→`batch_keyframe_operations`, `add_mesh`→`place_mesh` and the sphere, cylinder and polyhedron tools.

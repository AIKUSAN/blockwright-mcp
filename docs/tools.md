<!-- Copyright (c) 2026 AIKUSAN. Part of Blockwright MCP, distributed under GPL-3.0-only. Moved from README.md, 2026-11-07; catalogue count explained 2026-11-07; 228 tools from 1.1.0 (2026-11-10). -->
# Blockwright MCP tools

The full catalogue of 228 tools, by category. Back to the [README](../README.md).

A client never sees all 228 at once. `tools/list` shows only the tools that work in the current editor state. In the desktop app with default settings, no project and no dialog open, that is 93. With a project open it depends on the format, the mode, the textures, the selection and the undo history. `knife_tool` is never listed, and the Hytale (12), GeckoLib (9) and Bedrock block (5) tools each need their own format, so they never appear together.

Tools that need an open project only appear while one is open. `install_plugin` and `uninstall_plugin` stay off until **Settings > General > Blockwright MCP: allow install_plugin / uninstall_plugin** is turned on. `risky_eval` and `execute_script` run JavaScript inside Blockbench; one setting (Settings > General) turns both off.

Some sosadly tools overlap a base tool under another name (`add_cube` and `place_cube`, `delete_element` and `remove_element`, `new_project` and `create_project`). Both are registered: their names do not clash, and sosadly's skill calls most of the sosadly ones. `find_references`, sosadly's web image search, is not part of Blockwright. See [upstream-sync-2026-11-10.md](upstream-sync-2026-11-10.md).

- **Cubes** (5): `place_cube`, `modify_cube`, `knife_cut_cube`, `slice_cubes_to_block_grid`, `inspect_block_bounds`
- **Camera & Screenshots** (7): `capture_screenshot`, `capture_app_screenshot`, `set_camera_angle`, `create_offscreen_view`, `list_views`, `resize_offscreen_view`, `delete_offscreen_view`
- **Review & Renderer Health** (3): `render_review_sheet`, `render_health`, `recover_renderer`
- **Ported from sosadly/blockbench-mcp (MIT)** (76): `get_status`, `get_guide`, `get_orientation`, `which_side`, `check_sides`, `request_review`, `wait_review`, `ask_user`, `list_formats`, `get_reference`, `load_reference`, `zoom_reference`, `make_palette`, `get_palette`, `list_references`, `clear_references`, `compare_reference`, `measure_model`, `new_project`, `set_project_meta`, `close_project`, `save_project`, `export_project`, `load_project`, `add_cube`, `add_groups`, `add_cubes`, `voxelize_matrix`, `add_hollow_volume`, `generate_array`, `extrude_chain`, `add_wing`, `add_cylinder`, `add_gear`, `add_pipe`, `add_flare`, `add_hair`, `paint_face`, `fix_z_fighting`, `animate_mechanism`, `check_model`, `audit_complexity`, `pack_uv`, `add_plane`, `add_mesh`, `add_meshes`, `mirror_element`, `edit_element`, `delete_element`, `list_outliner`, `get_element`, `create_textures`, `create_vfx_texture`, `set_texture_render_mode`, `import_texture`, `paint_texture`, `detail_cubes`, `paint_faces`, `resize_texture`, `list_animations`, `add_keyframe`, `add_keyframes`, `remove_animation`, `create_rig`, `check_rig`, `get_rig`, `generate_animation`, `analyze_animation`, `preview_animation`, `screenshot`, `screenshot_views`, `inspect_model`, `list_plugins`, `install_plugin`, `uninstall_plugin`, `execute_script`
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

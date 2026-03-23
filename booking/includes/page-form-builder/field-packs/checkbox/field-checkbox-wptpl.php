<?php
/**
 * WPBC BFB Pack: Checkbox Field (WP-template–driven with DnD options editor)
 *
 * - Mirrors the Radio pack UX but renders a multi-choice checkbox group.
 * - Shares the same options editor (reorder, duplicate, add/remove).
 * - Allows multiple "Default" selections.
 *
 * File:  ../includes/page-form-builder/field-packs/checkbox/field-checkbox-wptpl.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop, oplugins
 * @since     11.0.0
 * @modified  2025-09-13
 * @version   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "checkbox" field pack (WP-template–driven Inspector).
 *
 * @param array $packs Accumulated packs from other modules.
 *
 * @return array
 */
function wpbc_bfb_register_field_packs__field_checkbox_wptpl( $packs ) {

	$packs['checkbox'] = array(
		'kind'      => 'field',
		'type'      => 'checkbox',
		'label'     => __( 'Checkbox', 'booking' ),
		'icon'      => 'wpbc_icn_check_box',
		'usage_key' => 'checkbox',

		// Schema drives coercion/defaults/serialization.
		'schema'    => array(
			'props' => array(
				'label'         => array( 'type' => 'string', 'default' => __( 'Checkbox', 'booking' ) ),
				'name'          => array( 'type' => 'string', 'default' => '' ),
				'html_id'       => array( 'type' => 'string', 'default' => '' ),
				'required'      => array( 'type' => 'boolean', 'default' => false ),
				'cssclass'      => array( 'type' => 'string', 'default' => '' ),
				'help'          => array( 'type' => 'string', 'default' => '' ),
				'default_value' => array( 'type' => 'string', 'default' => '' ), // CSV of defaults (e.g., "A, B")
				'value_differs' => array( 'type' => 'boolean', 'default' => true ),
				'multiple'      => array( 'type' => 'boolean', 'default' => true ),
				// Predefined choices (editable/reorderable).
				'options'       => array(
					'type'    => 'array',
					'default' => array(
						array( 'label' => 'Option 1', 'value' => 'Option 1', 'selected' => false ),
						array( 'label' => 'Option 2', 'value' => 'Option 2', 'selected' => false ),
						array( 'label' => 'Option 3', 'value' => 'Option 3', 'selected' => false ),
					),
				),

				// Appearance
				'min_width'     => array( 'type' => 'string', 'default' => '240px' ),
			),
		),

		'templates_printer' => 'wpbc_bfb_field_checkbox_wptpl_print_templates',
	);

	return $packs;
}

add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_checkbox_wptpl' );


/**
 * Enqueue the Checkbox (WP-template) pack JS for the Builder page.
 *
 * @param string $page Current admin page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__field_checkbox_wptpl_js( $page ) {

	wp_enqueue_script( 'wpbc-bfb_field_checkbox_wptpl', wpbc_plugin_url( '/includes/page-form-builder/field-packs/checkbox/_out/field-checkbox-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_checkbox_wptpl_js', 10, 1 );


/**
 * Print wp.template() blocks for the Checkbox field.
 *
 * @param string $page The current page slug.
 *
 * @return void
 */
function wpbc_bfb_field_checkbox_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-checkbox">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<# var is_req = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ); #>

			<# if ( data.label && data.label !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }} <# if ( is_req ) { #><span aria-hidden="true">*</span><# } #>
			</label>
			<# } #>

			<span class="wpbc_wrap_text wpdev-form-control-wrap {{ data.cssclass || '' }}">
				<#
				// Selected set logic (multi-choice):
				var selected_map = Object.create( null );

				var has_marked = Array.isArray( data.options ) && data.options.some( function(o){
					return !! o && ( true === o.selected || 'true' === o.selected || 1 === o.selected || '1' === o.selected );
				} );

				if ( has_marked ) {
					( data.options || [] ).forEach( function(o){
						if ( o && ( true === o.selected || 'true' === o.selected || 1 === o.selected || '1' === o.selected ) ) {
							selected_map[ String( o.value || '' ) ] = true;
						}
					} );
				} else if ( data.default_value != null && String( data.default_value ).trim() !== '' ) {
					String( data.default_value ).split( ',' ).forEach( function(item){
						var v = String( item ).trim();
						if ( v ) { selected_map[ v ] = true; }
					} );
				}

				var _opts = Array.isArray( data.options ) ? data.options : ( function(o){ var a=[],k; for ( k in (o||{}) ){ if ( Object.prototype.hasOwnProperty.call(o,k) ){ a.push( o[k] ); } } return a; } )( data.options );

				// For preview IDs:
				var _name = (data.name || data.id || 'field');
				#>

				<div class="wpbc_bfb__checkbox-group" role="checkboxgroup" aria-required="{{ is_req ? 'true' : 'false' }}">
					<# _opts.forEach( function( opt, idx ){ if ( !opt ) { return; }
						var _val = String( opt.value || '' );
						var _lbl = String( opt.label || '' );
						var _sel = !! selected_map[ _val ];
						var _id  = ( data.html_id ? ( data.html_id + '_' + idx ) : ( _name + '_' + idx ) );
					#>
						<label class="wpbc_bfb__checkbox-item">
							<input
								type="checkbox"
								class="wpbc_bfb__preview-input wpbc_bfb__preview-checkbox"
								name="{{ _name }}[]"
								value="{{ _val }}"
								tabindex="-1"
								aria-disabled="true"
								<# if ( is_req ) { #> required aria-required="true" <# } #>
								id="{{ _id }}"
								<# if ( _sel ) { #> checked="checked" aria-checked="true" <# } else { #> aria-checked="false" <# } #>
							>
							<span class="wpbc_bfb__checkbox-label">{{ _lbl }}</span>
						</label>
					<# }); #>
				</div>
			</span>

			<# if ( data.help ) { #>
				<div class="wpbc_bfb__help">{{ data.help }}</div>
			<# } #>
		</span>
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-checkbox">
		<div class="wpbc_bfb__inspector__head">
			<div class="header_container">
				<div class="header_title_content">
					<h3 class="title"><?php
						echo esc_html__( 'Checkbox', 'booking' ); ?></h3>
					<div class="desc"><?php
						echo esc_html__( 'Configure a multi-choice checkbox group. Drag to reorder options.', 'booking' ); ?></div>
				</div>
				<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
					<div class="ui_container ui_container_small">
						<div class="ui_group">
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="deselect" aria-label="<?php
								echo esc_attr__( 'Deselect', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_remove_done"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="scrollto" aria-label="<?php
								echo esc_attr__( 'Scroll to field', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
								</button>
							</div>
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="move-up" aria-label="<?php
								echo esc_attr__( 'Move up', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
										data-action="move-down" aria-label="<?php
								echo esc_attr__( 'Move down', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
								</button>
							</div>
							<div class="ui_element">
								<button data-action="duplicate" type="button"
										class="button button-secondary wpbc_ui_control wpbc_ui_button" aria-label="<?php
								echo esc_attr__( 'Duplicate', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
								</button>
								<button data-action="delete" type="button"
										class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete"
										aria-label="<?php
										echo esc_attr__( 'Delete', 'booking' ); ?>">
									<span class="in-button-text"><?php
										echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;<i
										class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
								</button>
							</div>
						</div><!-- .ui_group -->
					</div><!-- .ui_container -->
				</div><!-- .actions -->
			</div><!-- .header_container -->
		</div><!-- .wpbc_bfb__inspector__head -->

		<div class="wpbc_bfb__inspector__body">

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group is-open" data-group="basic">
				<button type="button" class="group__header">
					<h3><?php
						echo esc_html__( 'Basic', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Label', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="label"
								   value="{{ data.label || '<?php
								   echo esc_js( __( 'Checkbox', 'booking' ) ); ?>' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Name', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="name" placeholder="<?php
							esc_attr_e( 'auto — from label', 'booking' ); ?>" value="{{ data.name || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Required', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="checkbox" class="inspector__checkbox" data-inspector-key="required"
							<# if ( true === data.required || 'true' === data.required || 1 === data.required || '1' ===
							data.required ) { #> checked <# } #> >
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Help text', 'booking' ); ?></label>
						<div class="inspector__control">
							<textarea class="inspector__textarea" rows="3" data-inspector-key="help">{{ data.help || '' }}</textarea>
						</div>
					</div>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="options">
				<button type="button" class="group__header">
					<h3><?php
						echo esc_html__( 'Options', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<!-- Hidden marker so Select_Base treats this as multiple-choice from the start -->
					<div hidden style="display:none;">
						<input type="checkbox"
							class="js-opt-multiple inspector__input inspector__checkbox"
							data-inspector-key="multiple"
							<# if ( true === data.multiple || 'true' === data.multiple || 1 === data.multiple || '1' === data.multiple ) { #>
								checked="checked" aria-checked="true"
							<# } else { #>
								aria-checked="false"
							<# } #>
							hidden
							aria-hidden="true"
							tabindex="-1">
					</div>
					<div class="wpbc_bfb__options_editor">

						<div class="wpbc_bfb__options_list">
							<#
							var _opts2 = Array.isArray( data.options )
							? data.options
							: ( function(o){ var a = [], k; for ( k in (o || {}) ) { if (
							Object.prototype.hasOwnProperty.call( o, k ) ) { a.push( o[ k ] ); } } return a; } )(
							data.options );

							if ( ( !_opts2 || !_opts2.length ) && window.WPBC_BFB_Field_Checkbox && typeof
							window.WPBC_BFB_Field_Checkbox.get_defaults === 'function' ) {
							_opts2 = ( window.WPBC_BFB_Field_Checkbox.get_defaults().options || [] ).slice( 0 );
							}
							#>

							<# _opts2.forEach( function( opt, idx ){ #>
							<div class="wpbc_bfb__options_row" data-index="{{ idx }}">
								<span class="wpbc_bfb__drag-handle" title="<?php
								echo esc_attr__( 'Drag to reorder', 'booking' ); ?>"><span
										class="wpbc_icn_drag_indicator"></span></span>
								<input type="text" class="wpbc_bfb__opt-label" placeholder="<?php
								echo esc_attr__( 'Label', 'booking' ); ?>" value="{{ opt && opt.label || '' }}">
								<input type="text" class="wpbc_bfb__opt-value" placeholder="<?php
								echo esc_attr__( 'Value', 'booking' ); ?>" value="{{ opt && opt.value || '' }}">
								<#
								var __uid = 'wpbc_ins_auto_opt_' + Math.random().toString(36).slice(2,10);
								var __sel = !!( opt && ( true === opt.selected || 'true' === opt.selected || 1 ===
								opt.selected || '1' === opt.selected ) );
								#>
								<div class="wpbc_bfb__opt-selected">
									<div class="inspector__control wpbc_ui__toggle">
										<input
											type="checkbox"
											class="wpbc_bfb__opt-selected-chk inspector__input"
											id="{{ __uid }}"
											role="switch"
											aria-checked="{{ __sel ? 'true' : 'false' }}"
										<# if ( __sel ) { #> checked <# } #>
										>
										<label class="wpbc_ui__toggle_icon_checkbox" for="{{ __uid }}"></label>
										<label class="wpbc_ui__toggle_label" for="{{ __uid }}">
											<?php
											echo esc_js( __( 'Default', 'booking' ) ); ?>
										</label>
									</div>
								</div>

								<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">
									<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false"
									   class="ul_dropdown_menu_toggle">
										<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>
									</a>
									<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">
										<li>
											<a class="ul_dropdown_menu_li_action" data-action="add_after"
											   href="javascript:void(0)">
												<?php
												echo esc_html__( 'Add New', 'booking' ); ?>
												<i class="menu_icon icon-1x wpbc_icn_add_circle"></i>
											</a>
										</li>
										<li>
											<a class="ul_dropdown_menu_li_action" data-action="duplicate"
											   href="javascript:void(0)">
												<?php
												echo esc_html__( 'Duplicate', 'booking' ); ?>
												<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
											</a>
										</li>
										<li class="divider"></li>
										<li>
											<a class="ul_dropdown_menu_li_action" data-action="remove"
											   href="javascript:void(0)">
												<?php
												echo esc_html__( 'Remove', 'booking' ); ?>
												<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
											</a>
										</li>
									</ul>
								</div>

							</div>
							<# }); #>
						</div>

						<div class="wpbc_bfb__options_toolbar">
							<button type="button" class="button button-secondary js-add-option">
								<i class="wpbc_ui_el__vert_nav_icon tooltip_right_offset menu_icon icon-1x wpbc_icn_add_circle"
								   aria-hidden="true" data-original-title="<?php
								echo esc_attr__( 'Add option', 'booking' ); ?>"></i>
								<?php
								echo esc_html__( 'Add option', 'booking' ); ?>
							</button>
							<small class="desc"><?php
								echo esc_html__( 'Drag by handle to reorder. You can check multiple “Default” options.', 'booking' ); ?></small>
						</div>

						<#
						var __json = JSON.stringify(_opts2 || []);
						__json = __json.replace(/<\/textarea/gi, '<\\/textarea');
						#>
						<textarea class="wpbc_bfb__options_state inspector__input" data-inspector-key="options" hidden>{{ __json }}</textarea>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Value different from label', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="checkbox" class="inspector__checkbox js-value-differs"
								   data-inspector-key="value_differs"
							<# if ( true === data.value_differs || 'true' === data.value_differs || 1 ===
							data.value_differs || '1' === data.value_differs ) { #> checked <# } #> >
						</div>
					</div>

				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="appearance">
				<button type="button" class="group__header">
					<h3><?php
						echo esc_html__( 'Appearance', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'CSS class', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="cssclass"
								   value="{{ data.cssclass || '' }}">
							<p class="wpbc_bfb__help" style="margin-top:6px;">
								<?php
								echo esc_html__( 'The inline layout toggle adds/removes the "group_inline" class here.', 'booking' ); ?>
							</p>
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Layout', 'booking' ); ?></label>
						<div class="inspector__control wpbc_ui__toggle">
							<#
							var __iid = 'wpbc_ins_auto_inline_' + Math.random().toString(36).slice(2,10);
							#>
							<input
								type="checkbox"
								class="inspector__checkbox inspector__input"
								data-inspector-key="layout_inline"
								id="{{ __iid }}"
								role="switch"
								aria-checked="false"
							>
							<label class="wpbc_ui__toggle_icon" for="{{ __iid }}"></label>
							<label class="wpbc_ui__toggle_label" for="{{ __iid }}">
								<?php
								echo esc_html__( 'Show options inline (row)', 'booking' ); ?>
							</label>
							<p id="wpbc_bfb_help_checkbox_inline" class="wpbc_bfb__help" style="margin-top:6px;">
								<?php
								echo esc_html__( 'Enables a horizontal layout by adding the "group_inline" class.', 'booking' ); ?>
							</p>
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'HTML ID', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="html_id"
								   value="{{ data.html_id || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Min width', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="min_width"
								   placeholder="240px" value="{{ data.min_width || '240px' }}">
						</div>
					</div>

				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="advanced">
				<button type="button" class="group__header">
					<h3><?php
						echo esc_html__( 'Advanced', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php
							echo esc_html__( 'Options checked by default', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input js-default-value"
								   data-inspector-key="default_value" value="{{ data.default_value || '' }}"
								   placeholder="<?php
								   echo esc_attr__( 'Comma-separated values', 'booking' ); ?>">
							<p class="wpbc_bfb__help" style="margin-top:6px;"><?php
								echo esc_html__( 'You can select several options; all of them will be checked by default in the form.', 'booking' ); ?></p>
						</div>
					</div>
				</div>
			</section>

		</div><!-- .wpbc_bfb__inspector__body -->
	</script>

	<script type="text/html" id="tmpl-wpbc-bfb-inspector-checkbox-option-row">
		<div class="wpbc_bfb__options_row" data-index="{{ data.index || 0 }}">
			<span class="wpbc_bfb__drag-handle" title="<?php
			echo esc_attr__( 'Drag to reorder', 'booking' ); ?>">
				<span class="wpbc_icn_drag_indicator"></span>
			</span>
			<input type="text" class="wpbc_bfb__opt-label" placeholder="<?php
			echo esc_attr__( 'Label', 'booking' ); ?>" value="{{ data.label || '' }}">
			<input type="text" class="wpbc_bfb__opt-value" placeholder="<?php
			echo esc_attr__( 'Value', 'booking' ); ?>" value="{{ data.value || '' }}">

			<div class="wpbc_bfb__opt-selected">
				<div class="inspector__control wpbc_ui__toggle">
					<input
						type="checkbox"
						class="wpbc_bfb__opt-selected-chk inspector__input"
						id="{{ data.uid }}"
						role="switch"
						aria-checked="{{ ( true === data.selected || 'true' === data.selected || 1 === data.selected || '1' === data.selected ) ? 'true' : 'false' }}"
					<# if ( true === data.selected || 'true' === data.selected || 1 === data.selected || '1' ===
					data.selected ) { #> checked <# } #>
					>
					<label class="wpbc_ui__toggle_icon_checkbox" for="{{ data.uid }}"></label>
					<label class="wpbc_ui__toggle_label" for="{{ data.uid }}">{{ data.toggleLabel || '<?php
						echo esc_js( __( 'Default', 'booking' ) ); ?>' }}</label>
				</div>
			</div>

			<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">
				<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false"
				   class="ul_dropdown_menu_toggle">
					<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>
				</a>
				<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">
					<li>
						<a class="ul_dropdown_menu_li_action" data-action="add_after" href="javascript:void(0)">
							<?php
							echo esc_html__( 'Add New', 'booking' ); ?>
							<i class="menu_icon icon-1x wpbc_icn_add_circle"></i>
						</a>
					</li>
					<li>
						<a class="ul_dropdown_menu_li_action" data-action="duplicate" href="javascript:void(0)">
							<?php
							echo esc_html__( 'Duplicate', 'booking' ); ?>
							<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
						</a>
					</li>
					<li class="divider"></li>
					<li>
						<a class="ul_dropdown_menu_li_action" data-action="remove" href="javascript:void(0)">
							<?php
							echo esc_html__( 'Remove', 'booking' ); ?>
							<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
						</a>
					</li>
				</ul>
			</div>
		</div>
	</script>
	<?php
}


/**
 * (Optional) Register the "Checkbox" palette item in "general/bottom".
 *
 * @param string $group    Palette group.
 * @param string $position Position in group.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__checkbox_wptpl( $group, $position ) {

	if ( 'standard' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="checkbox"
		data-type="checkbox"
		data-usage_key="checkbox"
		data-label="<?php echo esc_attr( __( 'Checkboxes', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc_icn_check_box0 wpbc-bi-check-square"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Checkboxes', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">checkbox</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__checkbox_wptpl', 10, 2 );

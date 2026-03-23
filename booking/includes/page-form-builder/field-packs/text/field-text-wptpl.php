<?php
/**
 * WPBC BFB Pack: Text Field (WP-template–driven Reference)
 *
 * Purpose:
 * - Demonstrates a field pack whose Inspector UI and preview are rendered via wp.template().
 * - Keeps a PHP schema for coercion/validation/serialization, but omits 'inspector_ui' to prefer the template-based Inspector.
 *
 * Loading:
 * - This pack assumes you do NOT load the schema-driven "text" pack simultaneously.
 *
 * Contracts:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional)
 *
 * Notes:
 * - Keep JS get_defaults() in sync with the schema defaults below.
 *
 * File:  ../includes/page-form-builder/field-packs/text/field-text-wptpl.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop, oplugins
 * @since     11.0.0
 * @modified  2025-09-04
 * @version   1.0.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "text" field pack (WP-template–driven Inspector).
 *
 * @param array $packs Accumulated packs from other modules.
 * @return array Modified packs with "text" field included.
 */
function wpbc_bfb_register_field_packs__field_text_wptpl( $packs ) {

	$packs['text'] = array(
		'kind'      => 'field',
		'type'      => 'text',
		'label'     => __( 'Text', 'booking' ),
		'icon'      => 'wpbc_icn_text_fields',
		'usage_key' => 'text',                                                                                          // Optional: used by UsageLimitService if you set limits elsewhere.

		// Schema still drives coercion, defaults and serialization.
		'schema'    => array(
			'props' => array(
				'label'         => array( 'type' => 'string', 'default' => __( 'Text', 'booking' ) ),
				'name'          => array( 'type' => 'string', 'default' => '' ),
				'html_id'       => array( 'type' => 'string', 'default' => '' ),
				'placeholder'   => array( 'type' => 'string', 'default' => '' ),
				'required'      => array( 'type' => 'boolean', 'default' => false ),
				'minlength'     => array( 'type' => 'number', 'default' => null, 'min' => 0 ),
				'maxlength'     => array( 'type' => 'number', 'default' => null, 'min' => 0 ),
				'pattern'       => array( 'type' => 'string', 'default' => '' ),
				'cssclass'      => array( 'type' => 'string', 'default' => '' ),
				'help'          => array( 'type' => 'string', 'default' => '' ),
				'default_value' => array( 'type' => 'string', 'default' => '' ),
			),
		),

		// Ask core to print the two wp.template() blocks for this pack.
		'templates_printer' => 'wpbc_bfb_field_text_wptpl_print_templates'
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_text_wptpl' );


/**
 * Enqueue the Text (WP-template) pack JS for the Builder page.
 *
 * Hook runs on Builder; we keep it lean and attach our renderer file.
 *
 * @param string $page Current admin page slug (from core).
 * @return void
 */
function wpbc_bfb_enqueue__field_text_wptpl_js( $page ) {

	wp_enqueue_script( 'wpbc-bfb_field_text_wptpl', wpbc_plugin_url( '/includes/page-form-builder/field-packs/text/_out/field-text-wptpl.js' ), array( 'wp-util', 'wpbc-bfb' ), WP_BK_VERSION_NUM, true );
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_text_wptpl_js', 10, 1 );


/**
 * Print wp.template() blocks for the Text field:
 *  - Canvas Preview:  tmpl-wpbc-bfb-field-text
 *  - Inspector:       tmpl-wpbc-bfb-inspector-text
 *
 * Uses {{ ... }} (escaped) — do not switch to {{{ ... }}} for user-provided content.
 *
 * @param string $page The current page slug (core passes the Builder slug here).
 * @return void
 */
function wpbc_bfb_field_text_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	// ============ Canvas Preview Template ============
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-text">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<# var is_req = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ); #>

			<# if ( data.label && data.label !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }} <# if ( is_req ) { #><span aria-hidden="true">*</span><# } #>
				</label>
			<# } #>

			<span class="wpbc_wrap_text wpdev-form-control-wrap">
				<input type="text"
					class="wpbc_bfb__preview-input {{ data.cssclass || '' }}"
					placeholder="{{ data.placeholder || '' }}"
					name="{{ data.name || data.id || 'field' }}"
					autocomplete="off"
					tabindex="-1"
					aria-disabled="true"
					<# if ( data.html_id ) { #> id="{{ data.html_id }}" <# } #>
  					<# if ( data.default_value != null && data.default_value !== '' ) { #> value="{{ data.default_value }}" <# } #>
					<# if ( is_req ) { #> required aria-required="true" <# } #>
					<# if ( data.minlength != null && data.minlength !== '' && isFinite( Number( data.minlength ) ) ) { #> minlength="{{ Number( data.minlength ) }}" <# } #>
					<# if ( data.maxlength != null && data.maxlength !== '' && isFinite( Number( data.maxlength ) ) ) { #> maxlength="{{ Number( data.maxlength ) }}" <# } #>
					<# if ( data.pattern ) { #> pattern="{{ data.pattern }}" <# } #>
				/>
			</span>

			<# if ( data.help ) { #>
				<div class="wpbc_bfb__help">{{ data.help }}</div>
			<# } #>
		</span>
	</script>
	<?php

	// ============ Inspector Template ============
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-inspector-text">
		<div class="wpbc_bfb__inspector__head">
			<div class="header_container">
				<div class="header_title_content">
					<h3 class="title"><?php echo esc_html__( 'Text', 'booking' ); ?></h3><?php 	//TODO remove it. ?>
					<div class="desc"><?php echo esc_html__( 'Configure a single-line text input.', 'booking' ); ?></div>
				</div>
				<div class="actions wpbc_ajx_toolbar wpbc_no_borders">
					<div class="ui_container ui_container_small">
						<div class="ui_group">
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
									data-action="deselect" aria-label="<?php echo esc_attr__( 'Deselect', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_remove_done"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
									data-action="scrollto" aria-label="<?php echo esc_attr__( 'Scroll to field', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_ads_click filter_center_focus"></i>
								</button>
							</div>
							<div class="ui_element">
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
									data-action="move-up" aria-label="<?php echo esc_attr__( 'Move up', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_upward"></i>
								</button>
								<button type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button"
									data-action="move-down" aria-label="<?php echo esc_attr__( 'Move down', 'booking' ); ?>">
									<i class="menu_icon icon-1x wpbc_icn_arrow_downward"></i>
								</button>
							</div>
							<div class="ui_element">
								<button data-action="duplicate" aria-label="<?php echo esc_attr__( 'Duplicate', 'booking' ); ?>"
									type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button">
									<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
								</button>
								<button data-action="delete" aria-label="<?php echo esc_attr__( 'Delete', 'booking' ); ?>"
										type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button wpbc_ui_button_danger button-link-delete" >
									<span class="in-button-text"><?php echo esc_html__( 'Delete', 'booking' ); ?></span>&nbsp;&nbsp;
									<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>
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
					<h3><?php echo esc_html__( 'Basic', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Label', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="label"
								value="{{ data.label || '<?php echo esc_js( __( 'Text', 'booking' ) ); ?>' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Name', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="name" placeholder="<?php esc_attr_e( 'auto — from label', 'booking' ); ?>" value="{{ data.name || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Placeholder', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="placeholder" value="{{ data.placeholder || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Required', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="checkbox" class="inspector__checkbox" data-inspector-key="required"
								<# if ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ) { #> checked <# } #> >
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Default value', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="default_value" value="{{ data.default_value || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Help text', 'booking' ); ?></label>
						<div class="inspector__control">
							<textarea class="inspector__textarea" rows="3" data-inspector-key="help">{{ data.help || '' }}</textarea>
						</div>
					</div>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="validation">
				<button type="button" class="group__header">
					<h3><?php echo esc_html__( 'Validation', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Min length', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="number" class="inspector__input" data-inspector-key="minlength" value="{{ data.minlength || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Max length', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="number" class="inspector__input" data-inspector-key="maxlength" value="{{ data.maxlength || '' }}">
						</div>
					</div>
					<?php /*  // Temporary comment pattern, it can be enabled in future updates.  ?>
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Pattern', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="pattern" value="{{ data.pattern || '' }}">
						</div>
					</div>
					<?php */ ?>
				</div>
			</section>

			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="appearance">
				<button type="button" class="group__header">
					<h3><?php echo esc_html__( 'Appearance', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'CSS class', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="cssclass" value="{{ data.cssclass || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'HTML ID', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="html_id" value="{{ data.html_id || '' }}">
						</div>
					</div>
				</div>
			</section>

		</div><!-- .wpbc_bfb__inspector__body -->
	</script>
	<?php
}


/**
 * (Optional) Register the "Text" palette item in "general/bottom".
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 * @return void
 */
function wpbc_bfb_palette_register_items__text_wptpl( $group, $position ) {

	// Only inject into the desired palette zone.
	if ( 'standard' !== $group || 'bottom' !== $position ) {
		return;
	}

	?>
	<li class="wpbc_bfb__field"
		data-id="text"
		data-type="text"
		data-usage_key="text"
		data-label="<?php echo esc_attr( __( 'Text', 'booking' ) ); ?>">
		<i class="menu_icon icon-1x wpbc-bi-input-cursor-text"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Text', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">text - wp.tpl</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__text_wptpl', 10, 2 );

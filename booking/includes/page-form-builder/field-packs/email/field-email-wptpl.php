<?php
/**
 * WPBC BFB Pack: Email Field (WP-template–driven with Inspector)
 *
 * Purpose:
 * - Adds an "email" field pack whose Inspector UI and Preview are rendered via wp.template().
 * - Exports to Booking Calendar shortcode format like:
 *     [email email]
 *     [email email 3/10 id:someID class:someCSSclass "default@wpbookingcalendar.com"]
 *
 * Loading:
 * - This pack assumes you do NOT load another "email" pack simultaneously.
 *
 * Contracts:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 * - Filter:  wpbc_bfb_export_field_to_shortcode (optional — if present in core)
 *
 * Notes:
 * - Keep JS get_defaults() in sync with schema defaults below.
 * - Palette item may set data-usagenumber="1" through UsageLimitService if you want to limit to a single email field.
 *
 * File:  ../includes/page-form-builder/field-packs/email/field-email-wptpl.php
 *
 * @package   Booking Calendar
 * @author    wpdevelop, oplugins
 * @since     11.0.0
 * @modified  2025-10-18
 * @version   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "email" field pack (WP-template–driven Inspector).
 *
 * @param array $packs Accumulated packs from other modules.
 * @return array Modified packs with "email" field included.
 */
function wpbc_bfb_register_field_packs__field_email_wptpl( $packs ) {

	$packs['email'] = array(
		'kind'      => 'field',
		'type'      => 'email',
		'label'     => __( 'Email', 'booking' ),
		'icon'      => 'wpbc_icn_alternate_email',
		'usage_key' => 'email',                                                                                          // Optional: limit via UsageLimitService.

		// Schema drives coercion/defaults/serialization.
		'schema'    => array(
			'props' => array(
				'label'         => array( 'type' => 'string',  'default' => __( 'Email', 'booking' ) ),
				'name'          => array( 'type' => 'string',  'default' => 'email' ),
				'html_id'       => array( 'type' => 'string',  'default' => '' ),
				'placeholder'   => array( 'type' => 'string',  'default' => '' ),
				'required'      => array( 'type' => 'boolean', 'default' => true ),
				'help'          => array( 'type' => 'string',  'default' => __( 'Enter your email address.', 'booking' ) ),
				// 'minlength'     => array( 'type' => 'number',  'default' => null, 'min' => 0 ),
				// 'maxlength'     => array( 'type' => 'number',  'default' => null, 'min' => 0 ),
				'cssclass'      => array( 'type' => 'string',  'default' => '' ),
				'default_value' => array( 'type' => 'string',  'default' => '' ),
				'readonly'      => array( 'type' => 'boolean', 'default' => true ),
			),
		),

		// Ask core to print the two wp.template() blocks for this pack.
		'templates_printer' => 'wpbc_bfb_field_email_wptpl_print_templates'
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_email_wptpl' );

/**
 * Enqueue the Email (WP-template) pack JS for the Builder page.
 *
 * Hook runs on Builder; attaches the pack renderer file.
 *
 * @param string $page Current admin page slug (from core).
 * @return void
 */
function wpbc_bfb_enqueue__field_email_wptpl_js( $page ) {

	wp_enqueue_script(
		'wpbc-bfb_field_email_wptpl',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/email/_out/field-email-wptpl.js' ),
		array( 'wp-util', 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_email_wptpl_js', 10, 1 );

/**
 * Print wp.template() blocks for the Email field:
 *  - Canvas Preview:  tmpl-wpbc-bfb-field-email
 *  - Inspector:       tmpl-wpbc-bfb-inspector-email
 *
 * Uses {{ ... }} (escaped).
 *
 * @param string $page The current page slug (core passes the Builder slug here).
 * @return void
 */
function wpbc_bfb_field_email_wptpl_print_templates( $page ) {

	if ( WPBC_BFB_BUILDER_PAGE_SLUG !== $page ) {
		return;
	}

	// ============ Canvas Preview Template ============
	?>
	<script type="text/html" id="tmpl-wpbc-bfb-field-email">
		<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
			<# var is_req = ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ); #>

			<# if ( data.label && data.label !== '' ) { #>
				<label class="wpbc_bfb__field-label" <# if ( data.html_id ) { #> for="{{ data.html_id }}" <# } #>>
					{{ data.label }} <# if ( is_req ) { #>*<# } #>
				</label>
			<# } #>

			<# var name_cls = ( data.name || 'email' ); #>
			<span class="wpbc_wrap_text wpdev-form-control-wrap {{ name_cls }}">
				<input type="email"
					class="wpbc_bfb__preview-input {{ data.cssclass || '' }} wpdev-validates-as-email <# if ( is_req ) { #>wpdev-validates-as-required<# } #>"
					placeholder="{{ data.placeholder || '' }}"
					name="{{ name_cls }}"
					autocomplete="email"
					tabindex="-1"
					readonly aria-readonly="true"
					size="40"
					<# if ( data.html_id ) { #> id="{{ data.html_id }}" <# } #>
  					<# if ( data.default_value != null && data.default_value !== '' ) { #> value="{{ data.default_value }}" <# } #>
					<# if ( is_req ) { #> required aria-required="true" <# } #>
					<?php /* ?>
					<# if ( data.minlength != null && data.minlength !== '' && isFinite( Number( data.minlength ) ) ) { #> minlength="{{ Number( data.minlength ) }}" <# } #>
					<# if ( data.maxlength != null && data.maxlength !== '' && isFinite( Number( data.maxlength ) ) ) { #> maxlength="{{ Number( data.maxlength ) }}" <# } #>
 					<?php */ ?>
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
	<script type="text/html" id="tmpl-wpbc-bfb-inspector-email">
		<div class="wpbc_bfb__inspector__head">
			<div class="header_container">
				<div class="header_title_content">
					<h3 class="title"><?php echo esc_html__( 'Email', 'booking' ); ?></h3>
					<div class="desc"><?php echo esc_html__( 'Configure an email input field.', 'booking' ); ?></div>
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
								<?php /* ?>
								<button data-action="duplicate" aria-label="<?php echo esc_attr__( 'Duplicate', 'booking' ); ?>"
									type="button" class="button button-secondary wpbc_ui_control wpbc_ui_button">
									<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>
								</button>
 								<?php */ ?>
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
								value="{{ data.label || '<?php echo esc_js( __( 'Email', 'booking' ) ); ?>' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Name', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input inspector__input--readonly"
									data-inspector-key="name"
									placeholder="<?php esc_attr_e( 'auto — from label', 'booking' ); ?>"
									value="{{ data.name || '' }}"
									readonly aria-readonly="true">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Placeholder', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="text" class="inspector__input" data-inspector-key="placeholder" value="{{ data.placeholder || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Default value', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="email" class="inspector__input" data-inspector-key="default_value" value="{{ data.default_value || '' }}">
						</div>
					</div>
					<?php /* ?>
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Required', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="checkbox" class="inspector__checkbox" data-inspector-key="required"
								<# if ( true === data.required || 'true' === data.required || 1 === data.required || '1' === data.required ) { #> checked="checked" <# } #> >
						</div>
					</div>
					<?php */ ?>
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Help text', 'booking' ); ?></label>
						<div class="inspector__control">
							<textarea class="inspector__textarea" rows="3" data-inspector-key="help">{{ data.help || '<?php echo esc_js( __( 'Enter your email address.', 'booking' ) ); ?>' }}</textarea>
						</div>
					</div>
				</div>
			</section>
			<?php /* ?>
			<section class="wpbc_bfb__inspector__group wpbc_ui__collapsible_group" data-group="validation">
				<button type="button" class="group__header">
					<h3><?php echo esc_html__( 'Validation', 'booking' ); ?></h3>
					<i class="wpbc_ui_el__vert_menu_root_section_icon menu_icon icon-1x wpbc-bi-chevron-right"></i>
				</button>
				<div class="group__fields">
					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Min length', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="number" min="0" class="inspector__input" data-inspector-key="minlength" value="{{ data.minlength || '' }}">
						</div>
					</div>

					<div class="inspector__row">
						<label class="inspector__label"><?php echo esc_html__( 'Max length', 'booking' ); ?></label>
						<div class="inspector__control">
							<input type="number" min="0" class="inspector__input" data-inspector-key="maxlength" value="{{ data.maxlength || '' }}">
						</div>
					</div>
				</div>
			</section>
			<?php */ ?>
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
 * (Optional) Register the "Email" palette item in "general/bottom".
 *
 * @param string $group    Palette group: 'general' | 'advanced' | ...
 * @param string $position Position: 'top' | 'bottom'
 * @return void
 */
function wpbc_bfb_palette_register_items__email_wptpl( $group, $position ) {

	if ( 'essentials' !== $group || 'top' !== $position ) {
		return;
	}

	?>
	<li class="wpbc_bfb__field"
		data-id="email"
		data-type="email"
		data-usage_key="email"
		data-label="<?php echo esc_attr( __( 'Email', 'booking' ) ); ?>"
		data-usagenumber="1"
		>
		<i class="menu_icon icon-1x wpbc-bi-envelope"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Email', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">email</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__email_wptpl', 10, 2 );


//TODO:
/**
 * (Optional) Export "email" field to Booking Calendar shortcode.
 * If your core provides the 'wpbc_bfb_export_field_to_shortcode' filter, this handler will format:
 *   [email name 3/10 id:HTML_ID class:CSSCLASS "default@domain.com"]
 *
 * @param string $shortcode Previously generated shortcode (or empty).
 * @param array  $field     Field array with 'type' and 'props'.
 * @param array  $ctx       Export context (optional).
 * @return string Shortcode for this field type, or original string for other types.
 */
function wpbc_bfb_export_field__email_to_shortcode( $shortcode, $field, $ctx = array() ) {

	if ( empty( $field['type'] ) || 'email' !== $field['type'] ) {
		return $shortcode;
	}

	$props     = isset( $field['props'] ) && is_array( $field['props'] ) ? $field['props'] : array();
	$name      = isset( $props['name'] ) && '' !== $props['name'] ? $props['name'] : ( isset( $field['id'] ) ? $field['id'] : 'email' );
	$html_id   = isset( $props['html_id'] ) ? trim( $props['html_id'] ) : '';
	$cssclass  = isset( $props['cssclass'] ) ? trim( $props['cssclass'] ) : '';
	//	$minlength = ( isset( $props['minlength'] ) && '' !== $props['minlength'] ) ? intval( $props['minlength'] ) : null;
	//	$maxlength = ( isset( $props['maxlength'] ) && '' !== $props['maxlength'] ) ? intval( $props['maxlength'] ) : null;
	$default   = isset( $props['default_value'] ) ? $props['default_value'] : '';

	$len       = '';
	//	if ( null !== $minlength || null !== $maxlength ) {
	//		$len = sprintf( '%s/%s',
	//			( null !== $minlength ? max( 0, $minlength ) : '' ),
	//			( null !== $maxlength ? max( 0, $maxlength ) : '' )
	//		);
	//		$len = trim( $len, '/' );
	//	}

	$parts = array( 'email', $name );
	if ( '' !== $len ) {
		$parts[] = $len;
	}
	if ( '' !== $html_id ) {
		$parts[] = 'id:' . $html_id;
	}
	if ( '' !== $cssclass ) {
		$parts[] = 'class:' . $cssclass;
	}
	if ( '' !== $default ) {
		// Wrap default in quotes; keep inner quotes untouched (exporter typically prints raw).
		$parts[] = '"' . str_replace( '"', '\"', $default ) . '"';
	}

	return '[' . implode( ' ', $parts ) . ']';
}
add_filter( 'wpbc_bfb_export_field_to_shortcode', 'wpbc_bfb_export_field__email_to_shortcode', 10, 3 );

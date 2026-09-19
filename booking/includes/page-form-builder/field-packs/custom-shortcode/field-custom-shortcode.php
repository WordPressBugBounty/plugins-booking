<?php
/**
 * WPBC BFB Pack: Custom Shortcode.
 *
 * Adds one validated shortcode token to the Advanced Booking Form. The token
 * may include Booking Calendar options and quoted values, such as
 * `[coupon discount ""]`, while the field pack remains independent of the
 * runtime service that interprets the selected shortcode.
 *
 * @package Booking Calendar
 * @since   11.8.2
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize one Custom Shortcode value for persistence.
 *
 * This mirrors the browser-side syntax boundary so a direct or modified save
 * request cannot persist nested tokens, HTML delimiters, control characters,
 * unbalanced quotes, or an excessively long shortcode through this field pack.
 * Runtime shortcode support remains the responsibility of the public form
 * parser and edition-specific token producers.
 *
 * @since 11.8.4
 *
 * @param mixed $shortcode_value Candidate Custom Shortcode value.
 *
 * @return string Normalized shortcode, or an empty string when invalid.
 */
function wpbc_bfb_normalize_custom_shortcode( $shortcode_value ) {
	$shortcode = trim( (string) $shortcode_value );

	if ( strlen( $shortcode ) > 4000 ) {
		return '';
	}

	$shortcode_characters = array();
	$shortcode_length     = preg_match_all( '/./us', $shortcode, $shortcode_characters );

	if (
		false === $shortcode_length ||
		$shortcode_length < 3 ||
		$shortcode_length > 1000 ||
		'[' !== substr( $shortcode, 0, 1 ) ||
		']' !== substr( $shortcode, -1 )
	) {
		return '';
	}

	$shortcode_body = trim( substr( $shortcode, 1, -1 ) );

	if ( '' === $shortcode_body || preg_match( '/[\x00-\x1F\x7F<>\[\]]/', $shortcode_body ) ) {
		return '';
	}

	$shortcode_name_end = strpos( $shortcode_body, ' ' );
	$shortcode_name     = false === $shortcode_name_end
		? $shortcode_body
		: substr( $shortcode_body, 0, $shortcode_name_end );

	if ( ! preg_match( '/^[A-Za-z0-9_.*-]+$/D', $shortcode_name ) ) {
		return '';
	}

	$active_quote = '';
	$body_length  = strlen( $shortcode_body );

	for ( $index = strlen( $shortcode_name ); $index < $body_length; $index++ ) {
		$character = $shortcode_body[ $index ];

		if ( '' !== $active_quote ) {
			if ( $character === $active_quote ) {
				$active_quote = '';
			}
			continue;
		}

		if ( '"' === $character || "'" === $character ) {
			$active_quote = $character;
		}
	}

	return '' === $active_quote ? '[' . $shortcode_body . ']' : '';
}

/**
 * Sanitize Custom Shortcode values inside a Form Builder structure.
 *
 * The recursive traversal understands only the standard field-node envelope
 * and leaves every unrelated field, section, page, and unknown extension value
 * untouched.
 *
 * @since 11.8.4
 *
 * @param array $structure Form Builder structure about to be persisted.
 *
 * @return array Structure with Custom Shortcode values normalized.
 */
function wpbc_bfb_sanitize_structure__custom_shortcode( $structure ) {
	if (
		'field' === ( isset( $structure['type'] ) ? $structure['type'] : '' ) &&
		isset( $structure['data'] ) &&
		is_array( $structure['data'] ) &&
		'custom_shortcode' === ( isset( $structure['data']['type'] ) ? $structure['data']['type'] : '' )
	) {
		$structure['data']['shortcode'] = wpbc_bfb_normalize_custom_shortcode(
			isset( $structure['data']['shortcode'] ) ? $structure['data']['shortcode'] : ''
		);
	}

	foreach ( $structure as $structure_key => $structure_value ) {
		if ( is_array( $structure_value ) ) {
			$structure[ $structure_key ] = wpbc_bfb_sanitize_structure__custom_shortcode( $structure_value );
		}
	}

	return $structure;
}
add_filter( 'wpbc_bfb_sanitize_structure_before_save', 'wpbc_bfb_sanitize_structure__custom_shortcode', 10, 1 );

/**
 * Register the Custom Shortcode field schema and Inspector control.
 *
 * The field stores one string. The browser pack applies a bounded allow-list
 * before exporting it, and the existing save endpoint applies WordPress KSES
 * to the complete generated Advanced Booking Form.
 *
 * @param array $packs Registered Builder field packs.
 *
 * @return array Updated field packs.
 */
function wpbc_bfb_register_field_packs__custom_shortcode( $packs ) {
	$packs['custom_shortcode'] = array(
		'kind'      => 'field',
		'type'      => 'custom_shortcode',
		'label'     => __( 'Custom Shortcode', 'booking' ),
		'icon'      => 'wpbc-bi-code',
		'usage_key' => 'custom_shortcode',
		'schema'    => array(
			'props' => array(
				'shortcode' => array(
					'type'    => 'string',
					'default' => '[field_name_hint]',
				),
			),
		),
		'inspector_ui' => array(
			'title'          => __( 'Custom Shortcode', 'booking' ),
			'description'    => __( 'Add one supported Booking Calendar shortcode. Options and quoted values are allowed, for example [coupon discount ""]. For a Form Options Cost hint, use its field name followed by _hint.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Shortcode', 'booking' ),
					'open'     => true,
					'controls' => array(
						array(
							'type'        => 'text',
							'key'         => 'shortcode',
							'label'       => __( 'Shortcode', 'booking' ),
							'placeholder' => '[field_name_hint]',
						),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__custom_shortcode' );

/**
 * Enqueue the Custom Shortcode renderer and exporters in Form Builder.
 *
 * WordPress calls this hook only while loading the Builder page. The runtime
 * asset is deliberately loaded from `_out`, matching the project contract.
 *
 * @param string $page Current administration page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__custom_shortcode_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_custom_shortcode',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/custom-shortcode/_out/custom-shortcode.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		'wpbc-bfb_field_custom_shortcode',
		'WPBC_BFB_Custom_Shortcode_Boot',
		array(
			'example_shortcode' => '[field_name_hint]',
			'invalid_message'   => __( 'Enter one complete shortcode, for example [field_name_hint] or [coupon discount ""].', 'booking' ),
		)
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__custom_shortcode_js', 10, 1 );

/**
 * Add Custom Shortcode to the Cost Hints palette group.
 *
 * The palette placement reflects the primary Form Options Costs use case, but
 * the field itself remains a generic single-token exporter.
 *
 * @param string $group    Palette group.
 * @param string $position Position inside the group.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__custom_shortcode( $group, $position ) {
	if ( 'hints' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="custom_shortcode"
		data-type="custom_shortcode"
		data-usage_key="custom_shortcode"
		data-shortcode="[field_name_hint]">
		<i class="menu_icon icon-1x wpbc-bi-code"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html__( 'Custom Shortcode', 'booking' ); ?></span>
		<span class="wpbc_bfb__field-type">[field_name_hint]</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__custom_shortcode', 10, 2 );

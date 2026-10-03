<?php
/**
 * WPBC BFB Pack: Discount Coupon field.
 *
 * Adds the visual Form Builder counterpart of the Advanced Mode `[coupon]`
 * shortcode. The Builder field is visible in every edition so lower editions
 * can show the established upgrade badge, while its exporter activates only
 * when the Business Large coupon service is available.
 *
 * @package Booking Calendar
 * @since   11.8.5
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Check whether the installed edition provides coupon discounts.
 *
 * Coupon calculation, validation, and usage tracking are owned by the
 * Business Large service represented by this established edition class.
 *
 * @since 11.8.5
 *
 * @return bool True when Business Large or a higher edition is active.
 */
function wpbc_bfb_coupon_is_supported() {
	return class_exists( 'wpdev_bk_biz_l' );
}

/**
 * Convert a scalar Coupon property to a string without array/object warnings.
 *
 * @since 11.8.5
 *
 * @param mixed $property_value Candidate property value.
 *
 * @return string Scalar string, or an empty string for compound values.
 */
function wpbc_bfb_coupon_string_value( $property_value ) {
	return is_scalar( $property_value ) ? (string) $property_value : '';
}

/**
 * Sanitize a Coupon shortcode field name.
 *
 * The public shortcode parser accepts an ASCII token beginning with a letter.
 * Invalid or empty names fall back to the canonical legacy Coupon field name
 * so the generated form and Booking Data token remain usable.
 *
 * @since 11.8.5
 *
 * @param mixed $field_name Candidate field name.
 *
 * @return string Safe shortcode field name.
 */
function wpbc_bfb_coupon_sanitize_field_name( $field_name ) {
	$field_name = preg_replace( '/[^A-Za-z0-9_-]/', '', wpbc_bfb_coupon_string_value( $field_name ) );
	$field_name = substr( $field_name, 0, 80 );

	if ( '' === $field_name || ! preg_match( '/^[A-Za-z]/', $field_name ) ) {
		return 'coupon';
	}

	return $field_name;
}

/**
 * Sanitize a space-separated CSS class list for Coupon field persistence.
 *
 * @since 11.8.5
 *
 * @param mixed $class_list Candidate class list.
 *
 * @return string Safe class list containing at most ten class tokens.
 */
function wpbc_bfb_coupon_sanitize_css_classes( $class_list ) {
	$class_tokens      = preg_split( '/\s+/', trim( wpbc_bfb_coupon_string_value( $class_list ) ) );
	$safe_class_tokens = array();

	foreach ( (array) $class_tokens as $class_token ) {
		$class_token = sanitize_html_class( $class_token );
		if ( '' === $class_token || in_array( $class_token, $safe_class_tokens, true ) ) {
			continue;
		}

		$safe_class_tokens[] = $class_token;
		if ( 10 === count( $safe_class_tokens ) ) {
			break;
		}
	}

	return implode( ' ', $safe_class_tokens );
}

/**
 * Bound a sanitized Coupon field string without requiring multibyte support.
 *
 * @since 11.8.5
 *
 * @param string $field_text Sanitized field text.
 * @param int    $max_length Maximum character count.
 *
 * @return string Bounded field text.
 */
function wpbc_bfb_coupon_limit_text( $field_text, $max_length ) {
	$field_text = wpbc_bfb_coupon_string_value( $field_text );
	$max_length = max( 0, (int) $max_length );

	if ( function_exists( 'mb_substr' ) ) {
		return mb_substr( $field_text, 0, $max_length );
	}

	return substr( $field_text, 0, $max_length );
}

/**
 * Normalize a Coupon field checkbox value to a strict boolean.
 *
 * Form Builder normally sends a JSON boolean, but the save boundary also
 * handles scalar values from modified requests without treating the string
 * `false` as enabled.
 *
 * @since 11.8.5
 *
 * @param mixed $checkbox_value Candidate checkbox value.
 *
 * @return bool True only for recognized enabled values.
 */
function wpbc_bfb_coupon_sanitize_boolean( $checkbox_value ) {
	return in_array( $checkbox_value, array( true, 1, '1', 'true', 'required' ), true );
}

/**
 * Sanitize Coupon fields inside a Form Builder structure before persistence.
 *
 * This is a narrow save-boundary filter. It normalizes only Coupon field-node
 * data and leaves unrelated pages, sections, fields, and extension values
 * unchanged. Edition support is intentionally not stored in the structure;
 * the current server edition remains authoritative when the exporter runs.
 *
 * @since 11.8.5
 *
 * @param array $structure_branch Current Form Builder structure branch.
 *
 * @return array Structure branch with Coupon field properties normalized.
 */
function wpbc_bfb_sanitize_structure__coupon( $structure_branch ) {
	if (
		'field' === ( isset( $structure_branch['type'] ) ? $structure_branch['type'] : '' ) &&
		isset( $structure_branch['data'] ) &&
		is_array( $structure_branch['data'] ) &&
		'coupon' === ( isset( $structure_branch['data']['type'] ) ? $structure_branch['data']['type'] : '' )
	) {
		$coupon_data = $structure_branch['data'];

		$coupon_data['label'] = wpbc_bfb_coupon_limit_text(
			sanitize_text_field( wpbc_bfb_coupon_string_value( isset( $coupon_data['label'] ) ? $coupon_data['label'] : '' ) ),
			200
		);
		$coupon_data['name'] = wpbc_bfb_coupon_sanitize_field_name(
			isset( $coupon_data['name'] ) ? $coupon_data['name'] : 'coupon'
		);
		$coupon_data['placeholder'] = wpbc_bfb_coupon_limit_text(
			sanitize_text_field( wpbc_bfb_coupon_string_value( isset( $coupon_data['placeholder'] ) ? $coupon_data['placeholder'] : '' ) ),
			200
		);
		$coupon_data['required'] = wpbc_bfb_coupon_sanitize_boolean(
			isset( $coupon_data['required'] ) ? $coupon_data['required'] : false
		);
		$coupon_data['help']     = wpbc_bfb_coupon_limit_text(
			sanitize_textarea_field( wpbc_bfb_coupon_string_value( isset( $coupon_data['help'] ) ? $coupon_data['help'] : '' ) ),
			1000
		);
		$coupon_data['cssclass'] = wpbc_bfb_coupon_sanitize_css_classes(
			isset( $coupon_data['cssclass'] ) ? $coupon_data['cssclass'] : ''
		);
		$coupon_data['html_id']  = wpbc_bfb_coupon_limit_text(
			sanitize_html_class( wpbc_bfb_coupon_string_value( isset( $coupon_data['html_id'] ) ? $coupon_data['html_id'] : '' ) ),
			80
		);

		unset( $coupon_data['is_supported'], $coupon_data['upgrade_text'] );
		$structure_branch['data'] = $coupon_data;
	}

	foreach ( $structure_branch as $branch_key => $branch_value ) {
		if ( is_array( $branch_value ) ) {
			$structure_branch[ $branch_key ] = wpbc_bfb_sanitize_structure__coupon( $branch_value );
		}
	}

	return $structure_branch;
}
add_filter( 'wpbc_bfb_sanitize_structure_before_save', 'wpbc_bfb_sanitize_structure__coupon', 30, 1 );

/**
 * Register the Discount Coupon field schema and Inspector controls.
 *
 * @since 11.8.5
 *
 * @param array $packs Registered Form Builder field packs.
 *
 * @return array Updated field packs.
 */
function wpbc_bfb_register_field_packs__coupon( $packs ) {
	$description = wpbc_bfb_coupon_is_supported()
		? __( 'Add a coupon-code input that recalculates the booking cost after a visitor enters a code.', 'booking' )
		: __( 'This field is available only in Booking Calendar Business Large or higher versions.', 'booking' );

	$packs['coupon'] = array(
		'kind'      => 'field',
		'type'      => 'coupon',
		'label'     => __( 'Discount Coupon', 'booking' ),
		'icon'      => 'wpbc-bi-ticket-perforated',
		'usage_key' => 'coupon',
		'schema'    => array(
			'props' => array(
				'label'       => array( 'type' => 'string', 'default' => __( 'Discount Coupon', 'booking' ) ),
				'name'        => array( 'type' => 'string', 'default' => 'coupon' ),
				'placeholder' => array( 'type' => 'string', 'default' => '' ),
				'required'    => array( 'type' => 'boolean', 'default' => false ),
				'help'        => array( 'type' => 'string', 'default' => '' ),
				'cssclass'    => array( 'type' => 'string', 'default' => '' ),
				'html_id'     => array( 'type' => 'string', 'default' => '' ),
			),
		),
		'inspector_ui' => array(
			'title'          => __( 'Discount Coupon', 'booking' ),
			'description'    => $description,
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'basic',
					'label'    => __( 'Basic', 'booking' ),
					'open'     => true,
					'controls' => array(
						array( 'type' => 'text', 'key' => 'label', 'label' => __( 'Label', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'name', 'label' => __( 'Name', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'placeholder', 'label' => __( 'Placeholder', 'booking' ) ),
						array( 'type' => 'checkbox', 'key' => 'required', 'label' => __( 'Required', 'booking' ) ),
						array( 'type' => 'textarea', 'key' => 'help', 'label' => __( 'Help text', 'booking' ), 'rows' => 3 ),
					),
				),
				array(
					'key'      => 'appearance',
					'label'    => __( 'Appearance', 'booking' ),
					'controls' => array(
						array( 'type' => 'text', 'key' => 'cssclass', 'label' => __( 'CSS class', 'booking' ) ),
						array( 'type' => 'text', 'key' => 'html_id', 'label' => __( 'HTML ID', 'booking' ) ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__coupon' );

/**
 * Enqueue the Discount Coupon renderer and exporters on the Builder page.
 *
 * The runtime asset is loaded from `_out`; `_src` remains the editable source.
 * Edition support and upgrade messaging are supplied by the server instead of
 * being trusted from saved structure JSON.
 *
 * @since 11.8.5
 *
 * @param string $page Current administration page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__coupon_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_coupon',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/coupon/_out/field-coupon.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		'wpbc-bfb_field_coupon',
		'WPBC_BFB_Coupon_Boot',
		array(
			'is_supported' => wpbc_bfb_coupon_is_supported() ? 1 : 0,
			'upgrade_text' => __( 'This field is available only in Booking Calendar Business Large or higher versions.', 'booking' ),
		)
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__coupon_js', 10, 1 );

/**
 * Add Discount Coupon to the standard Fields palette.
 *
 * The one-per-form limit matches the Advanced Mode guidance and the legacy
 * coupon parser, which exposes one canonical coupon value to pricing logic.
 *
 * @since 11.8.5
 *
 * @param string $group    Palette group.
 * @param string $position Position inside the group.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__coupon( $group, $position ) {
	if ( 'standard' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="coupon"
		data-type="coupon"
		data-usage_key="coupon"
		data-usagenumber="1"
		data-label="<?php echo esc_attr( __( 'Discount Coupon', 'booking' ) ); ?>"
		data-name="coupon"
		data-required="false">
		<i class="menu_icon icon-1x wpbc-bi-ticket-perforated"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html__( 'Discount Coupon', 'booking' ); ?></span>
		<?php if ( ! wpbc_bfb_coupon_is_supported() ) : ?>
			<span class="wpbc_pro_label">Pro | BL+</span>
		<?php endif; ?>
		<span class="wpbc_bfb__field-type">coupon</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__coupon', 10, 2 );

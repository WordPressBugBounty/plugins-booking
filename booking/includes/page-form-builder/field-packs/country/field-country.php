<?php
/**
 * WPBC BFB Pack: Country List field.
 *
 * Adds the visual Form Builder counterpart of the Advanced Mode `[country]`
 * shortcode, including its optional positional default-country code.
 *
 * @package Booking Calendar
 * @since   11.8.5
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert a scalar Country property to a string without array/object warnings.
 *
 * @since 11.8.5
 *
 * @param mixed $property_value Candidate property value.
 *
 * @return string Scalar string, or an empty string for compound values.
 */
function wpbc_bfb_country_string_value( $property_value ) {
	return is_scalar( $property_value ) ? (string) $property_value : '';
}

/**
 * Bound a sanitized Country field string without requiring multibyte support.
 *
 * @since 11.8.5
 *
 * @param string $field_text Sanitized field text.
 * @param int    $max_length Maximum character count.
 *
 * @return string Bounded field text.
 */
function wpbc_bfb_country_limit_text( $field_text, $max_length ) {
	$field_text = wpbc_bfb_country_string_value( $field_text );
	$max_length = max( 0, (int) $max_length );

	if ( function_exists( 'mb_substr' ) ) {
		return mb_substr( $field_text, 0, $max_length );
	}

	return substr( $field_text, 0, $max_length );
}

/**
 * Return the authorized country choices used by the Inspector and preview.
 *
 * Country values and labels come from the same filterable dataset consumed by
 * the public shortcode renderer. Compound or empty filtered entries are
 * excluded so localized browser configuration remains JSON-safe.
 *
 * @since 11.8.5
 *
 * @return array<int,array{value:string,label:string}> Ordered country choices.
 */
function wpbc_bfb_country_get_choices() {
	$country_choices = array();
	$countries       = function_exists( 'wpbc_dataset_countries' ) ? wpbc_dataset_countries() : array();

	foreach ( (array) $countries as $country_code => $country_label ) {
		if ( ! is_string( $country_code ) || ! is_scalar( $country_label ) ) {
			continue;
		}

		$country_code  = trim( (string) $country_code );
		$country_label = wp_specialchars_decode( wp_strip_all_tags( (string) $country_label, true ), ENT_QUOTES );

		if (
			'' === $country_code ||
			'' === $country_label ||
			strlen( $country_code ) > 32 ||
			! preg_match( '/^[A-Za-z0-9_.:-]+$/', $country_code )
		) {
			continue;
		}

		$country_choices[] = array(
			'value' => $country_code,
			'label' => $country_label,
		);
	}

	return $country_choices;
}

/**
 * Build Inspector choices including the no-explicit-default option.
 *
 * An empty value exports `[country]`, whose public select naturally uses the
 * first entry in the current country dataset. Non-empty values export the
 * positional Advanced Mode syntax, for example `[country "US"]`.
 *
 * @since 11.8.5
 *
 * @return array<int,array{value:string,label:string}> Inspector select choices.
 */
function wpbc_bfb_country_get_inspector_choices() {
	return array_merge(
		array(
			array(
				'value' => '',
				'label' => __( 'Use the first country in the list', 'booking' ),
			),
		),
		wpbc_bfb_country_get_choices()
	);
}

/**
 * Validate a default country code against the public renderer's dataset.
 *
 * Exact dataset keys are preferred. A case-insensitive comparison accepts a
 * manually imported lower-case ISO code while returning the canonical key.
 * Values not present after the `wpbc_dataset_countries` filter fail closed to
 * no explicit default.
 *
 * @since 11.8.5
 *
 * @param mixed $country_code Candidate country code.
 *
 * @return string Canonical dataset key, or an empty string when invalid.
 */
function wpbc_bfb_country_sanitize_default_code( $country_code ) {
	$country_code    = trim( wpbc_bfb_country_string_value( $country_code ) );
	$country_choices = wpbc_bfb_country_get_choices();

	if ( '' === $country_code || strlen( $country_code ) > 32 ) {
		return '';
	}

	foreach ( $country_choices as $country_choice ) {
		if ( $country_code === $country_choice['value'] ) {
			return $country_choice['value'];
		}
	}

	foreach ( $country_choices as $country_choice ) {
		if ( 0 === strcasecmp( $country_code, $country_choice['value'] ) ) {
			return $country_choice['value'];
		}
	}

	return '';
}

/**
 * Sanitize Country List fields inside a Form Builder structure before use.
 *
 * The same filter runs for persisted saves and request-local previews. Only
 * Country field nodes are changed; unrelated structure and extension values
 * are preserved for backward compatibility.
 *
 * @since 11.8.5
 *
 * @param array $structure_branch Current Form Builder structure branch.
 *
 * @return array Structure branch with Country properties normalized.
 */
function wpbc_bfb_sanitize_structure__country( $structure_branch ) {
	if (
		'field' === ( isset( $structure_branch['type'] ) ? $structure_branch['type'] : '' ) &&
		isset( $structure_branch['data'] ) &&
		is_array( $structure_branch['data'] ) &&
		'country' === ( isset( $structure_branch['data']['type'] ) ? $structure_branch['data']['type'] : '' )
	) {
		$country_data = $structure_branch['data'];

		$country_data['label'] = wpbc_bfb_country_limit_text(
			sanitize_text_field( wpbc_bfb_country_string_value( isset( $country_data['label'] ) ? $country_data['label'] : '' ) ),
			200
		);
		$country_data['default_country'] = wpbc_bfb_country_sanitize_default_code(
			isset( $country_data['default_country'] ) ? $country_data['default_country'] : ''
		);
		$country_data['help'] = wpbc_bfb_country_limit_text(
			sanitize_textarea_field( wpbc_bfb_country_string_value( isset( $country_data['help'] ) ? $country_data['help'] : '' ) ),
			1000
		);

		$structure_branch['data'] = $country_data;
	}

	foreach ( $structure_branch as $branch_key => $branch_value ) {
		if ( is_array( $branch_value ) ) {
			$structure_branch[ $branch_key ] = wpbc_bfb_sanitize_structure__country( $branch_value );
		}
	}

	return $structure_branch;
}
add_filter( 'wpbc_bfb_sanitize_structure_before_save', 'wpbc_bfb_sanitize_structure__country', 30, 1 );

/**
 * Register the Country List field schema and Inspector controls.
 *
 * @since 11.8.5
 *
 * @param array $packs Registered Form Builder field packs.
 *
 * @return array Updated field packs.
 */
function wpbc_bfb_register_field_packs__country( $packs ) {
	$packs['country'] = array(
		'kind'         => 'field',
		'type'         => 'country',
		'label'        => __( 'Country List', 'booking' ),
		'icon'         => 'wpbc-bi-globe',
		'usage_key'    => 'country',
		'schema'       => array(
			'props' => array(
				'label'           => array( 'type' => 'string', 'default' => __( 'Country', 'booking' ) ),
				'default_country' => array( 'type' => 'string', 'default' => '' ),
				'help'            => array( 'type' => 'string', 'default' => '' ),
			),
		),
		'inspector_ui' => array(
			'title'          => __( 'Country List', 'booking' ),
			'description'    => __( 'Select a country from the predefined list and optionally choose the country selected by default.', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'content',
					'label'    => __( 'Content', 'booking' ),
					'open'     => true,
					'controls' => array(
						array( 'type' => 'text', 'key' => 'label', 'label' => __( 'Label', 'booking' ) ),
						array(
							'type'    => 'select',
							'key'     => 'default_country',
							'label'   => __( 'Default country', 'booking' ),
							'options' => wpbc_bfb_country_get_inspector_choices(),
						),
						array( 'type' => 'textarea', 'key' => 'help', 'label' => __( 'Help text', 'booking' ), 'rows' => 3 ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__country' );

/**
 * Enqueue the Country List renderer and exporters on the Builder page.
 *
 * The runtime asset is loaded from `_out`; `_src` remains the editable source.
 * The current server country dataset is localized for preview validation.
 *
 * @since 11.8.5
 *
 * @param string $page Current administration page slug.
 *
 * @return void
 */
function wpbc_bfb_enqueue__country_js( $page ) {
	wp_enqueue_script(
		'wpbc-bfb_field_country',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/country/_out/field-country.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		'wpbc-bfb_field_country',
		'WPBC_BFB_Country_Boot',
		array(
			'countries' => wpbc_bfb_country_get_choices(),
		)
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__country_js', 10, 1 );

/**
 * Add Country List to the standard Fields palette.
 *
 * Country has one canonical submitted value and is documented as a
 * once-per-form Advanced field, so both the palette and exporter enforce that
 * limit without changing imported legacy forms.
 *
 * @since 11.8.5
 *
 * @param string $group    Palette group.
 * @param string $position Position inside the group.
 *
 * @return void
 */
function wpbc_bfb_palette_register_items__country( $group, $position ) {
	if ( 'standard' !== $group || 'bottom' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="country"
		data-type="country"
		data-usage_key="country"
		data-usagenumber="1"
		data-label="<?php echo esc_attr( __( 'Country', 'booking' ) ); ?>"
		data-default_country="">
		<i class="menu_icon icon-1x wpbc-bi-globe"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html__( 'Country List', 'booking' ); ?></span>
		<span class="wpbc_bfb__field-type">country</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__country', 10, 2 );

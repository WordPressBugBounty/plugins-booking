<?php
/**
 * WPBC BFB Pack: Static Text (label / paragraph / heading) — Schema-driven, Factory Inspector
 *
 * Purpose:
 * - Non-interactive text block for headings, labels, paragraphs, etc.
 * - One pack type "static_text" with props: text, links, tag, align, bold, italic, html_allowed, nl2br, cssclass_extra, html_id, help.
 * - Inspector is Factory-driven (no WP templates). Preview is rendered by a pure JS renderer class.
 * - Link tokens such as {terms} are replaced with sanitized link definitions.
 * - Exporter (JS) emits escaped HTML (optionally wrapped with id/class) + optional help.
 *
 * Contracts Used:
 * - Filter:  wpbc_bfb_register_field_packs
 * - Action:  wpbc_enqueue_js_field_pack
 * - Action:  wpbc_bfb_palette_register_items (optional palette registration)
 *
 * Files:
 *   ../includes/page-form-builder/field-packs/static-text/field-static-text.php   (this file)
 *   ../includes/page-form-builder/field-packs/static-text/_out/static-text-links.js (link editor + token renderer)
 *   ../includes/page-form-builder/field-packs/static-text/_out/static-text-links.css (link editor layout)
 *   ../includes/page-form-builder/field-packs/static-text/_out/static-text.js     (renderer + exporter glue)
 *
 * @package   Booking Calendar
 * @author    wpdevelop
 * @since     11.0.0
 * @modified  2026-09-25
 * @version   1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register the "static_text" field pack (Schema-driven Inspector).
 *
 * Props stored in schema:
 * - text            : string — content to show
 * - links           : array — optional token-to-link definitions
 * - tag             : string — allowed: p,label,span,small,div,h1,h2,h3,h4,h5,h6
 * - align           : string — left|center|right
 * - bold            : int|bool — 0|1
 * - italic          : int|bool — 0|1
 * - html_allowed    : int|bool — 0|1
 * - nl2br           : int|bool — 0|1 (applies only when html_allowed=0)
 * - cssclass_extra  : string — optional extra classes for wrapper element
 * - html_id         : string — optional id
 * - help            : string — optional help text (Inspector-only, exported below content)
 * - name            : string — hidden from Inspector, stored for consistency
 *
 * @param array $packs Accumulated packs.
 * @return array Modified packs with "static_text" field included.
 */
function wpbc_bfb_register_field_packs__field_static_text_schema( $packs ) {

	$tag_options = array(
		'p'     => __( 'Paragraph', 'booking' ),
		'label' => __( 'Label', 'booking' ),
		'span'  => __( 'Span', 'booking' ),
		'small' => __( 'Small', 'booking' ),
		'div'   => __( 'Div', 'booking' ),
		'h1'    => 'H1',
		'h2'    => 'H2',
		'h3'    => 'H3',
		'h4'    => 'H4',
		'h5'    => 'H5',
		'h6'    => 'H6',
	);

	$align_options = array(
		'left'   => __( 'Left', 'booking' ),
		'center' => __( 'Center', 'booking' ),
		'right'  => __( 'Right', 'booking' ),
	);

	$packs['static_text'] = array(
		'kind'      => 'field',
		'type'      => 'static_text',
		'label'     => __( 'Static Text', 'booking' ),
		'icon'      => 'text',
		'usage_key' => 'static_text',

		// === Schema: defaults + coercion handled by Inspector/Factory ===
		'schema'    => array(
			'props' => array(
				'text'            => array( 'type' => 'string', 'default' => __( 'Add your message here…', 'booking' ) ),
				'links'           => array( 'type' => 'array', 'default' => array() ),
				'tag'             => array( 'type' => 'string', 'enum' => array_keys( $tag_options ), 'default' => 'p' ),
				'align'           => array( 'type' => 'string', 'enum' => array_keys( $align_options ), 'default' => 'left' ),
				'bold'            => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 0 ),
				'italic'          => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 0 ),
				'html_allowed'    => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 0 ),
				'nl2br'           => array( 'type' => 'int',    'min'  => 0, 'max' => 1, 'default' => 1 ),
				'cssclass_extra'  => array( 'type' => 'string', 'default' => '' ),
				'html_id'         => array( 'type' => 'string', 'default' => '' ),
				'help'            => array( 'type' => 'string', 'default' => '' ),
				// "name" is supported in storage but hidden in Inspector.
				'name'            => array( 'type' => 'string', 'default' => '' ),
			),
		),

		// === Inspector UI (Factory-driven) ===
		'inspector_ui' => array(
			'title'          => __( 'Static Text', 'booking' ),
			'description'    => __( 'Non-interactive text block (paragraph, label, or heading).', 'booking' ),
			'header_variant' => 'toolbar',
			'header_actions' => array( 'deselect', 'scrollto', 'move-up', 'move-down', 'duplicate', 'delete' ),
			'groups'         => array(
				array(
					'key'      => 'content',
					'label'    => __( 'Content', 'booking' ),
					'open'     => true,
					'controls' => array(
						array(
							'type'        => 'textarea',
							'key'         => 'text',
							'label'       => __( 'Text', 'booking' ),
							'rows'        => 3,
							'placeholder' => __( 'Enter text', 'booking' ) . '...',
						),
						array(
							'type'    => 'select',
							'key'     => 'tag',
							'label'   => __( 'HTML Tag', 'booking' ),
							'options' => $tag_options,
						),
						array(
							'type'    => 'select',
							'key'     => 'align',
							'label'   => __( 'Alignment', 'booking' ),
							'options' => $align_options,
						),
						array( 'type' => 'checkbox', 'key' => 'bold',         'label' => __( 'Bold', 'booking' ) ),
						array( 'type' => 'checkbox', 'key' => 'italic',       'label' => __( 'Italic', 'booking' ) ),
						// array( 'type' => 'checkbox', 'key' => 'html_allowed', 'label' => __( 'Allow basic HTML', 'booking' ) ),
						array( 'type' => 'checkbox', 'key' => 'nl2br',        'label' => __( 'Convert newlines to <br> tag', 'booking' ) ),
						array(
							'type'  => 'slot',
							'key'   => 'links',
							'label' => __( 'Link definitions', 'booking' ),
							'slot'  => 'static_text_links',
						),
					),
				),
				array(
					'key'      => 'advanced',
					'label'    => __( 'Advanced', 'booking' ),
					'controls' => array(
						array( 'type' => 'text',     'key' => 'cssclass_extra', 'label' => __( 'Extra CSS classes', 'booking' ) ),
						// "name" intentionally omitted from Inspector
						array( 'type' => 'text',     'key' => 'html_id',        'label' => __( 'HTML ID', 'booking' ) ),
						// array( 'type' => 'textarea', 'key' => 'help',           'label' => __( 'Help text', 'booking' ), 'rows' => 3 ),
					),
				),
			),
		),
	);

	return $packs;
}
add_filter( 'wpbc_bfb_register_field_packs', 'wpbc_bfb_register_field_packs__field_static_text_schema' );

/**
 * Enqueue the Static Text field pack assets for the Builder page.
 *
 * @param string $page Current admin page slug (unused, provided for parity with other packs).
 * @return void
 */
function wpbc_bfb_enqueue__field_static_text_assets( $page ) {

	wp_enqueue_style(
		'wpbc-bfb_field_static_text_links',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/static-text/_out/static-text-links.css' ),
		array(),
		WP_BK_VERSION_NUM
	);

	wp_enqueue_script(
		'wpbc-bfb_field_static_text_links',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/static-text/_out/static-text-links.js' ),
		array( 'wpbc-bfb' ),
		WP_BK_VERSION_NUM,
		true
	);

	wp_localize_script(
		'wpbc-bfb_field_static_text_links',
		'WPBC_BFB_Static_Text_Links_Boot',
		array(
			'add_link'            => __( 'Add link', 'booking' ),
			'anchor'              => __( 'Anchor', 'booking' ),
			'css_class'           => __( 'CSS class', 'booking' ),
			'destination'         => __( 'Destination', 'booking' ),
			'duplicate'           => __( 'Duplicate', 'booking' ),
			'link_type'           => __( 'Type', 'booking' ),
			'links_help'          => __( 'Use tokens inside braces, for example: {terms} or {privacy_policy}. Each token can link to a URL or an anchor on the same page.', 'booking' ),
			'missing_definitions' => __( 'Add a link definition for: %s', 'booking' ),
			'no_links'            => __( 'Add a link definition, then insert its token into the text.', 'booking' ),
			'remove'              => __( 'Remove', 'booking' ),
			'target'              => __( 'Target', 'booking' ),
			'token_key'           => __( 'Token Key', 'booking' ),
			'url'                 => __( 'URL', 'booking' ),
			'visible_text'        => __( 'Text', 'booking' ),
		),
	);

	wp_enqueue_script(
		'wpbc-bfb_field_static_text',
		wpbc_plugin_url( '/includes/page-form-builder/field-packs/static-text/_out/static-text.js' ),
		array( 'wpbc-bfb', 'wpbc-bfb_field_static_text_links' ),
		WP_BK_VERSION_NUM,
		true
	);
}
add_action( 'wpbc_enqueue_js_field_pack', 'wpbc_bfb_enqueue__field_static_text_assets', 10, 1 );

/**
 * Limit a scalar link-definition value without requiring mbstring.
 *
 * @param mixed $raw_value  Candidate scalar value.
 * @param int   $max_length Maximum character count.
 *
 * @return string Bounded string, or an empty string for non-scalar input.
 */
function wpbc_bfb_static_text_links_limit_string( $raw_value, $max_length ) {

	if ( ! is_scalar( $raw_value ) ) {
		return '';
	}

	$raw_value  = (string) $raw_value;
	$max_length = max( 0, (int) $max_length );

	if ( function_exists( 'mb_substr' ) ) {
		return mb_substr( $raw_value, 0, $max_length );
	}

	return substr( $raw_value, 0, $max_length );
}

/**
 * Normalize a Static Text link token key to the Builder brace-token grammar.
 *
 * @param mixed $raw_key Candidate token key.
 *
 * @return string Lowercase token key containing only letters, numbers, and underscores.
 */
function wpbc_bfb_static_text_links_sanitize_token_key( $raw_key ) {

	$token_key = strtolower( wpbc_bfb_static_text_links_limit_string( $raw_key, 64 ) );
	$token_key = preg_replace( '/[\s\-]+/', '_', $token_key );
	$token_key = preg_replace( '/[^a-z0-9_]/', '', $token_key );
	$token_key = preg_replace( '/_+/', '_', $token_key );

	return trim( (string) $token_key, '_' );
}

/**
 * Normalize a space-delimited CSS class list from one link definition.
 *
 * @param mixed $raw_classes Candidate class list.
 *
 * @return string Sanitized, de-duplicated class list.
 */
function wpbc_bfb_static_text_links_sanitize_css_classes( $raw_classes ) {

	$raw_classes      = wpbc_bfb_static_text_links_limit_string( $raw_classes, 200 );
	$raw_class_names  = preg_split( '/\s+/', trim( $raw_classes ) );
	$safe_class_names = array();

	foreach ( (array) $raw_class_names as $raw_class_name ) {
		$safe_class_name = sanitize_html_class( $raw_class_name );
		if ( '' !== $safe_class_name ) {
			$safe_class_names[ $safe_class_name ] = $safe_class_name;
		}
	}

	return implode( ' ', array_values( $safe_class_names ) );
}

/**
 * Normalize one link destination according to its allow-listed link type.
 *
 * URL values use WordPress protocol filtering. Anchor and popup identifiers
 * are restricted to characters that are safe in an HTML identifier.
 *
 * @param mixed  $raw_destination Candidate destination.
 * @param string $link_type       Normalized link type.
 *
 * @return string Sanitized destination.
 */
function wpbc_bfb_static_text_links_sanitize_destination( $raw_destination, $link_type ) {

	$destination = trim( wpbc_bfb_static_text_links_limit_string( $raw_destination, 2048 ) );

	if ( 'anchor' === $link_type || 'popup' === $link_type ) {
		$destination = ltrim( $destination, '#' );
		return (string) preg_replace( '/[^A-Za-z0-9_:\-.]/', '', $destination );
	}

	return esc_url_raw( $destination );
}

/**
 * Normalize executable-free link definitions for Static Text and Accept Terms.
 *
 * The collection is bounded to avoid allowing a crafted Builder request to
 * persist an unreasonably large set of link records. Duplicate token keys are
 * made deterministic by adding a numeric suffix.
 *
 * @param mixed $raw_links Candidate array or JSON-encoded link definitions.
 *
 * @return array Sanitized ordered link definitions.
 */
function wpbc_bfb_static_text_links_normalize_definitions( $raw_links ) {

	if ( is_string( $raw_links ) ) {
		$decoded_links = json_decode( $raw_links, true );
		$raw_links     = is_array( $decoded_links ) ? $decoded_links : array();
	}

	if ( ! is_array( $raw_links ) ) {
		return array();
	}

	$normalized_links = array();
	$used_keys        = array();
	$link_index       = 0;

	foreach ( array_slice( array_values( $raw_links ), 0, 20 ) as $raw_link ) {
		if ( ! is_array( $raw_link ) ) {
			continue;
		}

		$link_index++;
		$token_key = wpbc_bfb_static_text_links_sanitize_token_key( isset( $raw_link['key'] ) ? $raw_link['key'] : '' );

		if ( '' === $token_key ) {
			$token_key = 'link_' . $link_index;
		}

		$base_key   = $token_key;
		$key_suffix = 2;
		while ( isset( $used_keys[ $token_key ] ) ) {
			$token_key = substr( $base_key, 0, 60 ) . '_' . $key_suffix;
			$key_suffix++;
		}
		$used_keys[ $token_key ] = true;

		$link_type = isset( $raw_link['link_type'] ) ? sanitize_key( $raw_link['link_type'] ) : 'url';
		if ( ! in_array( $link_type, array( 'url', 'anchor', 'popup' ), true ) ) {
			$link_type = 'url';
		}

		$visible_text = isset( $raw_link['text'] ) ? sanitize_text_field( wpbc_bfb_static_text_links_limit_string( $raw_link['text'], 300 ) ) : '';
		if ( '' === $visible_text ) {
			$visible_text = str_replace( '_', ' ', $token_key );
		}

		$normalized_links[] = array(
			'key'         => $token_key,
			'text'        => $visible_text,
			'link_type'   => $link_type,
			'destination' => wpbc_bfb_static_text_links_sanitize_destination(
				isset( $raw_link['destination'] ) ? $raw_link['destination'] : '',
				$link_type
			),
			'target'      => isset( $raw_link['target'] ) && '_self' === $raw_link['target'] ? '_self' : '_blank',
			'cssclass'    => wpbc_bfb_static_text_links_sanitize_css_classes( isset( $raw_link['cssclass'] ) ? $raw_link['cssclass'] : '' ),
		);
	}

	return $normalized_links;
}

/**
 * Sanitize stored link definitions throughout a decoded Builder structure.
 *
 * Missing `links` properties are intentionally left missing so existing
 * Static Text fields retain their exact storage shape and Accept Terms can
 * continue applying its established defaults. Explicit empty collections
 * remain empty.
 *
 * @param array $structure_branch Decoded Builder structure or nested branch.
 *
 * @return array Structure with field-owned link definitions normalized.
 */
function wpbc_bfb_sanitize_structure__static_text_links( $structure_branch ) {

	if ( ! is_array( $structure_branch ) ) {
		return array();
	}

	if (
		isset( $structure_branch['type'], $structure_branch['data'] )
		&& 'field' === $structure_branch['type']
		&& is_array( $structure_branch['data'] )
	) {
		$field_type = isset( $structure_branch['data']['type'] ) ? sanitize_key( $structure_branch['data']['type'] ) : '';

		if (
			in_array( $field_type, array( 'static_text', 'accept_terms' ), true )
			&& array_key_exists( 'links', $structure_branch['data'] )
		) {
			$structure_branch['data']['links'] = wpbc_bfb_static_text_links_normalize_definitions( $structure_branch['data']['links'] );
		}
	}

	foreach ( $structure_branch as $branch_key => $branch_value ) {
		if ( ! is_array( $branch_value ) ) {
			continue;
		}

		$structure_branch[ $branch_key ] = wpbc_bfb_sanitize_structure__static_text_links( $branch_value );
	}

	return $structure_branch;
}
add_filter( 'wpbc_bfb_sanitize_structure_before_save', 'wpbc_bfb_sanitize_structure__static_text_links', 20, 1 );

/**
 * (Optional) Register a palette item.
 *
 * @param string $group    Palette group (e.g., 'general', 'structure').
 * @param string $position Position: 'top' | 'bottom'.
 * @return void
 */
function wpbc_bfb_palette_register_items__static_text_schema( $group, $position ) {

	if ( 'essentials' !== $group || 'top' !== $position ) {
		return;
	}
	?>
	<li class="wpbc_bfb__field"
		data-id="static_text"
		data-type="static_text"
		data-usage_key="static_text"
		data-text="<?php echo esc_attr( __( 'Add your message here…', 'booking' ) ); ?>"
		data-tag="p"
		data-align="left"
		data-bold="0"
		data-italic="0"
		data-html_allowed="0"
		data-nl2br="1">
		<i class="menu_icon icon-1x wpbc-bi-fonts"></i>
		<span class="wpbc_bfb__field-label"><?php echo esc_html( __( 'Static Text', 'booking' ) ); ?></span>
		<span class="wpbc_bfb__field-type">static_text</span>
	</li>
	<?php
}
add_action( 'wpbc_bfb_palette_register_items', 'wpbc_bfb_palette_register_items__static_text_schema', 10, 2 );

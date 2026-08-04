<?php
/**
 * Booking mode definition registry.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load, normalize, filter, and cache administration mode definitions.
 *
 * The registry is intentionally independent from menu rendering. Definitions
 * are constructed only when requested and no more than once per PHP request.
 */
final class WPBC_Booking_Mode_Registry {

	/**
	 * Shared registry instance.
	 *
	 * @var WPBC_Booking_Mode_Registry|null
	 */
	private static $instance = null;

	/**
	 * Normalized mode definitions, or null before the first build.
	 *
	 * @var array|null
	 */
	private $modes = null;

	/**
	 * Allowed mode identifiers, or null before the first resolution.
	 *
	 * @var array|null
	 */
	private $allowed_mode_ids = null;

	/**
	 * Number of registry builds during this request.
	 *
	 * @var int
	 */
	private $build_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Get the shared request instance.
	 *
	 * @return WPBC_Booking_Mode_Registry Registry instance.
	 */
	public static function get_instance() {

		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Get all normalized mode definitions.
	 *
	 * @return array Mode definitions keyed by sanitized mode identifier.
	 */
	public function get_all() {

		if ( null !== $this->modes ) {
			return $this->modes;
		}

		++$this->build_count;

		$default_modes = $this->load_default_modes();
		$modes         = $this->normalize_modes( $default_modes );

		/**
		 * Filter the registered Booking Calendar administration modes.
		 *
		 * Callbacks should edit the complete keyed collection. This filter runs
		 * once per request when the registry is first requested.
		 *
		 * @param array $modes Normalized mode definitions keyed by mode ID.
		 */
		$modes = apply_filters( 'wpbc_booking_modes_registered_modes', $modes );
		$modes = $this->normalize_modes( $modes );

		if ( ! isset( $modes['classic'] ) && isset( $default_modes['classic'] ) ) {
			$modes['classic'] = $this->normalize_mode( 'classic', $default_modes['classic'] );
		}

		$this->modes = $modes;

		return $this->modes;
	}

	/**
	 * Get one mode definition.
	 *
	 * @param string $mode_id Mode identifier.
	 *
	 * @return array|null Mode definition, or null when it is not registered.
	 */
	public function get( $mode_id ) {

		$mode_id = is_scalar( $mode_id ) ? sanitize_key( (string) $mode_id ) : '';
		$modes   = $this->get_all();

		return isset( $modes[ $mode_id ] ) ? $modes[ $mode_id ] : null;
	}

	/**
	 * Check whether a mode is registered.
	 *
	 * @param string $mode_id Mode identifier.
	 *
	 * @return bool True when the mode exists.
	 */
	public function has( $mode_id ) {

		return null !== $this->get( $mode_id );
	}

	/**
	 * Get mode identifiers allowed for the current owner context.
	 *
	 * Classic is always retained as the compatibility fallback. The result is
	 * cached because edition and ownership checks must not run inside menu loops.
	 *
	 * @return array Allowed sanitized mode identifiers.
	 */
	public function get_allowed_mode_ids() {

		if ( null !== $this->allowed_mode_ids ) {
			return $this->allowed_mode_ids;
		}

		$modes            = $this->get_all();
		$allowed_mode_ids = array_keys( $modes );
		$context          = WPBC_Booking_Mode_Context::get_instance()->get_context();

		/**
		 * Filter administration modes allowed for the current owner context.
		 *
		 * This filter runs once per request. Returning an unknown identifier drops
		 * that value; Classic remains available as the safe compatibility mode.
		 *
		 * @param array $allowed_mode_ids Registered mode identifiers.
		 * @param array $modes            Complete normalized mode definitions.
		 * @param array $context          Normalized request and owner context.
		 */
		$allowed_mode_ids = apply_filters( 'wpbc_booking_modes_allowed_mode_ids', $allowed_mode_ids, $modes, $context );
		$allowed_mode_ids = is_array( $allowed_mode_ids ) ? $allowed_mode_ids : array();
		$normalized_ids   = array();

		foreach ( $allowed_mode_ids as $allowed_mode_id ) {
			$allowed_mode_id = is_scalar( $allowed_mode_id ) ? sanitize_key( (string) $allowed_mode_id ) : '';

			if ( isset( $modes[ $allowed_mode_id ] ) && ! in_array( $allowed_mode_id, $normalized_ids, true ) ) {
				$normalized_ids[] = $allowed_mode_id;
			}
		}

		if ( isset( $modes['classic'] ) && ! in_array( 'classic', $normalized_ids, true ) ) {
			array_unshift( $normalized_ids, 'classic' );
		}

		$this->allowed_mode_ids = $normalized_ids;

		return $this->allowed_mode_ids;
	}

	/**
	 * Get the number of registry builds in the current request.
	 *
	 * This diagnostic value should remain zero until first use and one afterward.
	 *
	 * @return int Registry build count.
	 */
	public function get_build_count() {

		return $this->build_count;
	}

	/**
	 * Load bundled mode definition arrays.
	 *
	 * @return array Raw definitions keyed by filename-derived mode identifier.
	 */
	private function load_default_modes() {

		$mode_files = array(
			'classic'     => __DIR__ . '/modes/classic.php',
			'appointment' => __DIR__ . '/modes/appointment.php',
			'rental'      => __DIR__ . '/modes/rental.php',
		);
		$modes      = array();

		foreach ( $mode_files as $mode_id => $mode_file ) {
			$mode_definition = require $mode_file;

			if ( is_array( $mode_definition ) ) {
				$modes[ $mode_id ] = $mode_definition;
			}
		}

		return $modes;
	}

	/**
	 * Normalize a collection of mode definitions.
	 *
	 * @param array $modes Raw mode definitions.
	 *
	 * @return array Valid normalized mode definitions.
	 */
	private function normalize_modes( $modes ) {

		$normalized_modes = array();

		if ( ! is_array( $modes ) ) {
			return $normalized_modes;
		}

		foreach ( $modes as $mode_id => $mode_definition ) {
			$mode_id = sanitize_key( $mode_id );

			if ( '' === $mode_id || ! is_array( $mode_definition ) ) {
				continue;
			}

			$normalized_modes[ $mode_id ] = $this->normalize_mode( $mode_id, $mode_definition );
		}

		return $normalized_modes;
	}

	/**
	 * Normalize one mode definition while preserving extension metadata.
	 *
	 * @param string $mode_id         Sanitized mode identifier.
	 * @param array  $mode_definition Raw mode definition.
	 *
	 * @return array Normalized mode definition.
	 */
	private function normalize_mode( $mode_id, $mode_definition ) {

		$defaults = array(
			'id'                      => $mode_id,
			'label'                   => $mode_id,
			'description'             => '',
			'default_page'            => '',
			'preserve_unmapped_pages' => false,
			'groups'                  => array(),
			'pages'                   => array(),
			'native_menu'             => array(),
			'quickstart_id'           => '',
		);
		$mode     = wp_parse_args( $mode_definition, $defaults );

		$mode['id']                      = $mode_id;
		$mode['label']                   = is_scalar( $mode['label'] ) ? wp_strip_all_tags( (string) $mode['label'] ) : $mode_id;
		$mode['description']             = is_scalar( $mode['description'] ) ? wp_strip_all_tags( (string) $mode['description'] ) : '';
		$mode['default_page']            = is_scalar( $mode['default_page'] ) ? sanitize_key( (string) $mode['default_page'] ) : '';
		$mode['preserve_unmapped_pages'] = (bool) $mode['preserve_unmapped_pages'];
		$mode['groups']                  = is_array( $mode['groups'] ) ? $mode['groups'] : array();
		$mode['pages']                   = is_array( $mode['pages'] ) ? $mode['pages'] : array();
		$mode['native_menu']             = is_array( $mode['native_menu'] ) ? $mode['native_menu'] : array();
		$mode['quickstart_id']           = is_scalar( $mode['quickstart_id'] ) ? sanitize_key( (string) $mode['quickstart_id'] ) : '';

		return $mode;
	}
}

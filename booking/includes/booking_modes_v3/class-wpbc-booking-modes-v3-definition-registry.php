<?php
/**
 * Allow-listed Booking Modes V3 definition registry.
 *
 * @package Booking Calendar
 * @since   11.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load and cache all bundled V3 declarations after strict validation.
 */
final class WPBC_Booking_Modes_V3_Definition_Registry {

	/** @var WPBC_Booking_Modes_V3_Definition_Registry|null */
	private static $instance = null;

	/** @var array<string,array<string,mixed>> */
	private $definitions = array();

	/** @var array<string,array<string,mixed>>|null */
	private $translated_definitions = null;

	/** @var array<int,string> */
	private $errors = array();

	/** @var bool */
	private $loaded = false;

	/** @var int */
	private $build_count = 0;

	/**
	 * Prevent direct construction.
	 */
	private function __construct() {}

	/**
	 * Return the request-local registry instance.
	 *
	 * @return WPBC_Booking_Modes_V3_Definition_Registry Registry instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}

		return self::$instance;
	}

	/**
	 * Load the three server-allow-listed declaration files exactly once.
	 *
	 * @param string $base_directory Absolute V3 component directory.
	 *
	 * @return bool True only when every declaration is valid.
	 */
	public function load( $base_directory ) {
		if ( $this->loaded ) {
			return empty( $this->errors );
		}

		$this->loaded = true;
		++$this->build_count;
		$validator = new WPBC_Booking_Modes_V3_Definition_Validator();
		$manifest  = self::get_definition_manifest( $base_directory );

		foreach ( $manifest as $mode_id => $definition_file ) {
			$raw_definition = include $definition_file;
			$result         = $validator->validate( $mode_id, $raw_definition );

			if ( empty( $result['valid'] ) ) {
				foreach ( $result['errors'] as $error_message ) {
					if ( count( $this->errors ) >= WPBC_Booking_Modes_V3_Definition_Validator::MAX_DIAGNOSTICS ) {
						break;
					}
					$this->errors[] = $mode_id . ': ' . $error_message;
				}
				continue;
			}

			$this->definitions[ $mode_id ] = $result['definition'];
		}

		if ( count( $this->definitions ) !== count( $manifest ) ) {
			$this->definitions = array();
		}

		return empty( $this->errors );
	}

	/**
	 * Return the fixed declaration allow list.
	 *
	 * @param string $base_directory Absolute V3 component directory.
	 *
	 * @return array<string,string> Mode IDs mapped to absolute local files.
	 */
	public static function get_definition_manifest( $base_directory ) {
		$base_directory = rtrim( $base_directory, '/\\' );

		return array(
			'classic'     => $base_directory . '/modes/classic.php',
			'appointment' => $base_directory . '/modes/appointment.php',
			'rental'      => $base_directory . '/modes/rental.php',
		);
	}

	/**
	 * Return one validated definition.
	 *
	 * @param string $mode_id Stable mode identifier.
	 *
	 * @return array<string,mixed>|null Definition or null when unavailable.
	 */
	public function get_definition( $mode_id ) {
		$definitions = $this->get_definitions();

		return isset( $definitions[ $mode_id ] ) ? $definitions[ $mode_id ] : null;
	}

	/**
	 * Return all validated definitions in manifest order.
	 *
	 * @return array<string,array<string,mixed>> Definitions map.
	 */
	public function get_definitions() {
		if ( ! class_exists( 'WPBC_Booking_Modes_V3_Definition_Translator', false ) ) {
			return $this->definitions;
		}
		if ( ! WPBC_Booking_Modes_V3_Definition_Translator::is_translation_ready() ) {
			return $this->definitions;
		}
		if ( null === $this->translated_definitions ) {
			$translated_definitions = array();
			foreach ( $this->definitions as $mode_id => $definition ) {
				$translated_definitions[ $mode_id ] = WPBC_Booking_Modes_V3_Definition_Translator::translate( $definition );
			}
			$this->translated_definitions = $translated_definitions;
		}

		return $this->translated_definitions;
	}

	/**
	 * Return bounded preflight diagnostics.
	 *
	 * @return array<int,string> Validation errors.
	 */
	public function get_errors() {
		return $this->errors;
	}

	/**
	 * Return the number of registry builds in this request.
	 *
	 * @return int Build count.
	 */
	public function get_build_count() {
		return $this->build_count;
	}
}

<?php
/**
 * Module adapter for Setup Wizard Booking Resources.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose Booking Resource creation and editing through the common module contract.
 */
final class WPBC_Setup_Wizard_Booking_Resources_Module implements WPBC_Setup_Wizard_Step_Module {

	/** @var WPBC_Setup_Wizard_Booking_Resources */
	private $booking_resources;

	/**
	 * Build the adapter around the Resource read and validation service.
	 *
	 * @param WPBC_Setup_Wizard_Booking_Resources|null $booking_resources Optional service for tests.
	 */
	public function __construct( $booking_resources = null ) {
		$this->booking_resources = $booking_resources instanceof WPBC_Setup_Wizard_Booking_Resources ? $booking_resources : new WPBC_Setup_Wizard_Booking_Resources();
	}

	/** @return string Stable step ID. */
	public function get_step_id() {
		return 'booking_resources';
	}

	/** @return array<string,string> Step definition. */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Booking resources', 'booking' ),
			'template'    => 'step-booking-resources',
			'footer_note' => __( 'Create or update these Booking Resources when you continue. Existing Resources cannot be deleted here.', 'booking' ),
		);
	}

	/** @return string Absolute template path. */
	public function get_template_path() {
		return __DIR__ . '/template.php';
	}

	/** @return string[] Field allow-list. */
	public function get_field_names() {
		return array( 'booking_resources', 'existing_booking_resources' );
	}

	/** @return string[] Required field identifiers. */
	public function get_required_fields() {
		return array( 'booking_resources' );
	}

	/** @return array<string,mixed> Initial values. */
	public function get_initial_values() {
		return array(
			'booking_resources'          => $this->booking_resources->get_initial_resource_drafts(),
			'existing_booking_resources' => array(),
		);
	}

	/** @return string[] Context dependency IDs. */
	public function get_context_dependencies() {
		return array();
	}

	/**
	 * Build presentation context and remove proposals already created by a saved result.
	 *
	 * @param array<string,mixed> $field_values     Validated fields.
	 * @param array<string,mixed> $consumer_context Read-only step results.
	 *
	 * @return array<string,mixed> Presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$result       = isset( $consumer_context['_step_results']['booking_resources'] ) && is_array( $consumer_context['_step_results']['booking_resources'] ) ? $consumer_context['_step_results']['booking_resources'] : array();
		$created_keys = array();
		foreach ( isset( $result['created_ids'] ) ? (array) $result['created_ids'] : array() as $mapping ) {
			if ( is_scalar( $mapping ) && preg_match( '/^resource:([a-z0-9_-]{1,64}):[0-9]+$/', (string) $mapping, $matches ) ) {
				$created_keys[] = $matches[1];
			}
		}
		if ( ! empty( $created_keys ) && isset( $field_values['booking_resources'] ) && is_array( $field_values['booking_resources'] ) ) {
			$field_values['booking_resources'] = array_values(
				array_filter(
					$field_values['booking_resources'],
					static function ( $resource ) use ( $created_keys ) {
						return is_array( $resource ) && ! in_array( sanitize_key( isset( $resource['draft_id'] ) ? (string) $resource['draft_id'] : '' ), $created_keys, true );
					}
				)
			);
		}
		$field_values['existing_booking_resources'] = array();

		return $this->booking_resources->get_context( $field_values );
	}

	/**
	 * Validate the staged Resource transport.
	 *
	 * @param string $field_id    Stable field ID.
	 * @param mixed  $raw_value   Untrusted proposals.
	 * @param bool   $is_required Whether the field is required.
	 *
	 * @return array<int,array<string,mixed>>|WP_Error Normalized value or error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( 'existing_booking_resources' === $field_id ) {
			return $this->booking_resources->validate_existing_resource_updates( $raw_value );
		}
		if ( 'booking_resources' !== $field_id ) {
			return new WP_Error( 'wpbc_setup_wizard_resource_field_unknown', __( 'The Booking Resources editor received an unsupported field.', 'booking' ) );
		}

		return $this->booking_resources->validate_resource_drafts( $raw_value, $is_required );
	}

	/**
	 * Enqueue compiled Resource editor assets.
	 *
	 * @param string       $module_url           Setup Wizard module URL.
	 * @param string|false $asset_version        Plugin asset version.
	 * @param string       $shared_style_handle  Shared shell style handle.
	 * @param string       $shared_script_handle Shared shell script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module_url = trailingslashit( $module_url );
		if ( function_exists( 'wpbc_load_js__required_for_media_upload' ) ) {
			wpbc_load_js__required_for_media_upload();
		}
		wp_enqueue_style( 'wpbc-setup-wizard-booking-resources', $module_url . 'step-booking-resources/_out/step-booking-resources.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-booking-resources', $module_url . 'step-booking-resources/_out/step-booking-resources.js', array( 'jquery', $shared_script_handle ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-booking-resources',
			'wpbc_setup_wizard_booking_resources',
			array(
				'i18n' => array(
					'new_resource'           => __( 'New Booking Resource', 'booking' ),
					'resource_title_required' => __( 'Enter a name for every Booking Resource.', 'booking' ),
					'resource_price_invalid' => __( 'Enter a valid non-negative base cost.', 'booking' ),
					'resource_limit'         => __( 'The Booking Resource limit for this account has been reached.', 'booking' ),
					/* translators: %s: Booking Resource title. */
					'remove_resource'        => __( 'Remove %s', 'booking' ),
					'resource_removed'       => __( 'Unsaved Booking Resource removed from this setup.', 'booking' ),
				),
			)
		);
	}
}

<?php
/**
 * Reusable module adapter for the Services setup editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose the Services editor through the common setup-module contract.
 *
 * Canonical Service reads and proposal validation remain in the domain service.
 * This adapter contains consumer-neutral metadata, template, and asset wiring.
 */
final class WPBC_Setup_Wizard_Services_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Current_Values_Module {

	/** @var WPBC_Setup_Wizard_Services */
	private $services;

	/**
	 * Build the module around the Services read and validation service.
	 *
	 * @param WPBC_Setup_Wizard_Services|null $services Optional domain service for testing or composition.
	 */
	public function __construct( $services = null ) {
		$this->services = $services instanceof WPBC_Setup_Wizard_Services
			? $services
			: new WPBC_Setup_Wizard_Services();
	}

	/**
	 * Return the stable module and step identifier.
	 *
	 * @return string Stable identifier.
	 */
	public function get_step_id() {
		return 'services';
	}

	/**
	 * Return the rail and template metadata contributed by this module.
	 *
	 * @return array{id:string,label:string,template:string,footer_note:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Services', 'booking' ),
			'template'    => 'step-services',
			'footer_note' => __( 'Create or update these Appointment Services when you continue. Repeated saves reuse the same Service records.', 'booking' ),
		);
	}

	/**
	 * Return the absolute server-owned template path.
	 *
	 * @return string Absolute template path.
	 */
	public function get_template_path() {
		return __DIR__ . '/template.php';
	}

	/**
	 * Return the field names accepted by the Services editor.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array( 'services', 'inactive_service_ids' );
	}

	/**
	 * Return the fields required when advancing from the Services editor.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields() {
		return array( 'services' );
	}

	/**
	 * Return owner-authorized Services or safe activation suggestions.
	 *
	 * @return array<string,mixed> Initial field values.
	 */
	public function get_initial_values() {
		return array(
			'services'             => $this->services->get_initial_services(),
			'inactive_service_ids' => array(),
		);
	}

	/**
	 * Refresh authorized Services and clear consumed Draft-transition intents.
	 *
	 * The inactive ID field is a one-save mutation intent, not durable wizard
	 * state. Reopening the step must rebuild Services from the repository and
	 * start with no pending status transitions.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names() {
		return $this->get_field_names();
	}

	/**
	 * Return other step values required by the Services presentation.
	 *
	 * @return string[] No dependencies are required.
	 */
	public function get_context_dependencies() {
		return array();
	}

	/**
	 * Build the Services editor template context.
	 *
	 * @param array<string,mixed> $field_values     Validated Services field values.
	 * @param array<string,mixed> $consumer_context Read-only step results used to reconcile canonical identities.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$field_values = $this->reconcile_saved_service_state( $field_values, $consumer_context );

		return $this->services->get_context( $field_values );
	}

	/**
	 * Reconcile proposal identities and consume completed lifecycle intents.
	 *
	 * Newly created Services retain their wizard draft IDs in checkpoint values.
	 * Their canonical IDs live in the saved step result, so those mappings must be
	 * restored before the browser decides whether Trash removes an unsaved proposal
	 * or stages a canonical Service for Draft. Explicit Draft-transition IDs are
	 * one-shot intents and are removed only after the save result is confirmed.
	 *
	 * @param array<string,mixed> $field_values     Validated Services field values.
	 * @param array<string,mixed> $consumer_context Read-only route context with saved step results.
	 *
	 * @return array<string,mixed> Reconciled presentation values.
	 */
	private function reconcile_saved_service_state( array $field_values, array $consumer_context ) {
		$step_result = isset( $consumer_context['_step_results']['services'] ) && is_array( $consumer_context['_step_results']['services'] )
			? $consumer_context['_step_results']['services']
			: array();

		if ( 'saved' !== sanitize_key( isset( $step_result['status'] ) ? (string) $step_result['status'] : '' ) ) {
			return $field_values;
		}

		$service_mappings = $this->get_saved_service_mappings( $step_result );
		$services         = isset( $field_values['services'] ) && is_array( $field_values['services'] )
			? $field_values['services']
			: array();

		foreach ( $services as $service_index => $service ) {
			if ( ! is_array( $service ) || ! empty( $service['source_service_id'] ) ) {
				continue;
			}

			$draft_id = isset( $service['draft_id'] ) ? sanitize_key( (string) $service['draft_id'] ) : '';
			if ( '' !== $draft_id && ! empty( $service_mappings[ $draft_id ] ) ) {
				$services[ $service_index ]['source_service_id'] = $service_mappings[ $draft_id ];
			}
		}

		$field_values['services']             = $services;
		$field_values['inactive_service_ids'] = array();

		return $field_values;
	}

	/**
	 * Extract canonical Service IDs from one verified Services save result.
	 *
	 * @param array<string,mixed> $step_result Normalized saved step result.
	 *
	 * @return array<string,int> Canonical Service IDs keyed by wizard draft ID.
	 */
	private function get_saved_service_mappings( array $step_result ) {
		$stored_mappings = array_merge(
			isset( $step_result['created_ids'] ) ? (array) $step_result['created_ids'] : array(),
			isset( $step_result['updated_ids'] ) ? (array) $step_result['updated_ids'] : array()
		);
		$service_mappings = array();

		foreach ( $stored_mappings as $stored_mapping ) {
			if ( is_scalar( $stored_mapping ) && preg_match( '/^service:([a-z0-9_-]{1,64}):([0-9]+)$/', (string) $stored_mapping, $matches ) ) {
				$service_mappings[ $matches[1] ] = absint( $matches[2] );
			}
		}

		return $service_mappings;
	}

	/**
	 * Validate the Services proposal transport field.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted Service proposals.
	 * @param bool   $is_required Whether at least one complete Service is required.
	 *
	 * @return array<int,array<string,mixed>>|int[]|WP_Error Normalized field value or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( 'services' === $field_id ) {
			return $this->services->validate_services( $raw_value, $is_required );
		}

		if ( 'inactive_service_ids' === $field_id ) {
			return $this->services->validate_inactive_service_ids( $raw_value );
		}

		return new WP_Error( 'wpbc_setup_wizard_services_field_unknown', __( 'The Services editor received an unsupported field.', 'booking' ) );
	}

	/**
	 * Enqueue compiled Services assets and presentation translations.
	 *
	 * @param string       $module_url          Absolute URL to the Setup Wizard module root.
	 * @param string|false $asset_version       Plugin version used for cache busting.
	 * @param string       $shared_style_handle Consumer shell style handle.
	 * @param string       $shared_script_handle Consumer shell script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module_url = trailingslashit( $module_url );

		if ( function_exists( 'wpbc_load_js__required_for_media_upload' ) ) {
			wpbc_load_js__required_for_media_upload();
		}

		wp_enqueue_style( 'wpbc-setup-wizard-services', $module_url . 'step-services/_out/step-services.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-services', $module_url . 'step-services/_out/step-services.js', array( 'jquery', $shared_script_handle ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-services',
			'wpbc_setup_wizard_services',
			array(
				'i18n' => array(
					'service_title_required' => __( 'Enter a title for every Service.', 'booking' ),
					'service_number_invalid' => __( 'Enter a valid number within the available range.', 'booking' ),
					'service_limit'          => __( 'The maximum number of Service drafts has been reached.', 'booking' ),
					/* translators: %s: Service title. */
					'remove_service'         => __( 'Remove %s', 'booking' ),
					/* translators: %s: Service title. */
					'move_service_to_draft'  => __( 'Move %s to Draft', 'booking' ),
					/* translators: %s: Service title. */
					'service_draft_pending'  => __( '%s will move to Draft when you save.', 'booking' ),
					'service_removed'        => __( 'Unsaved Service removed from this setup.', 'booking' ),
					'new_service'            => __( 'New Service', 'booking' ),
					'hour_singular'           => __( 'hour', 'booking' ),
					'hour_plural'             => __( 'hours', 'booking' ),
					'minute_singular'         => __( 'minute', 'booking' ),
					'minute_plural'           => __( 'minutes', 'booking' ),
					'duration_joiner'         => _x( 'and', 'Duration parts separator', 'booking' ),
				),
			)
		);
	}
}

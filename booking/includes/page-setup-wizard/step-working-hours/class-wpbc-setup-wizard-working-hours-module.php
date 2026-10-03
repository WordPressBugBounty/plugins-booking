<?php
/**
 * Reusable module adapter for the Working Hours setup editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose the Working Hours editor through the common setup-module contract.
 */
final class WPBC_Setup_Wizard_Working_Hours_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Current_Values_Module {

	/** @var WPBC_Setup_Wizard_Working_Hours */
	private $working_hours;

	/**
	 * Build the module around the Working Hours read and validation service.
	 *
	 * @param WPBC_Setup_Wizard_Working_Hours|null $working_hours Optional domain service for testing or composition.
	 */
	public function __construct( $working_hours = null ) {
		$this->working_hours = $working_hours instanceof WPBC_Setup_Wizard_Working_Hours
			? $working_hours
			: new WPBC_Setup_Wizard_Working_Hours();
	}

	/**
	 * Return the stable module and step identifier.
	 *
	 * @return string Stable identifier.
	 */
	public function get_step_id() {
		return 'working_hours';
	}

	/**
	 * Return the rail and template metadata contributed by this module.
	 *
	 * @return array{id:string,label:string,template:string,footer_note:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Working hours', 'booking' ),
			'template'    => 'step-working-hours',
			'footer_note' => __( 'Apply working hours & continue updates the default weekly schedule immediately.', 'booking' ),
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
	 * Return the field names accepted by the Working Hours editor.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array( 'working_hours' );
	}

	/**
	 * Return the fields required when advancing from Working Hours.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields() {
		return array( 'working_hours' );
	}

	/**
	 * Return the authorized canonical schedule or a safe starter proposal.
	 *
	 * @return array<string,mixed> Initial field values.
	 */
	public function get_initial_values() {
		return array(
			'working_hours' => $this->working_hours->get_initial_working_hours(),
		);
	}

	/**
	 * Refresh the weekly schedule from canonical Working Time settings.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names() {
		return $this->get_field_names();
	}

	/**
	 * Return dependencies used for time labels and journey-owned defaults.
	 *
	 * @return string[] Stable dependency step identifiers.
	 */
	public function get_context_dependencies() {
		return array( 'date_time_formats', 'customer_journey' );
	}

	/**
	 * Build the Working Hours editor template context.
	 *
	 * @param array<string,mixed> $field_values     Validated Working Hours field values.
	 * @param array<string,mixed> $consumer_context Read-only values supplied by the consumer shell.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$time_format = isset( $consumer_context['date_time_formats']['time_format'] ) && is_scalar( $consumer_context['date_time_formats']['time_format'] )
			? (string) $consumer_context['date_time_formats']['time_format']
			: 'H:i';
		$customer_journey_id = isset( $consumer_context['customer_journey']['customer_journey'] )
			&& is_scalar( $consumer_context['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $consumer_context['customer_journey']['customer_journey'] )
			: '';
		$has_saved_values      = ! empty( $consumer_context['_step_state']['has_saved_values'] );
		$is_journey_transition = WPBC_Setup_Wizard_Customer_Journey_Policy::has_pending_transition_for_step(
			isset( $consumer_context['_step_results'] ) && is_array( $consumer_context['_step_results'] )
				? $consumer_context['_step_results']
				: array(),
			$this->get_step_id()
		);

		// A new route owns the initial Working Hours status. Ordinary revisits use
		// the current canonical status supplied through the current-values contract.
		if ( ! $has_saved_values || $is_journey_transition ) {
			$field_values['working_hours']['enabled'] = WPBC_Setup_Wizard_Customer_Journey_Policy::uses_disabled_working_hours_default( $customer_journey_id )
				? 'Off'
				: 'On';
		}

		return $this->working_hours->get_context( $field_values, $time_format );
	}

	/**
	 * Validate the Working Hours proposal transport field.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted weekly schedule.
	 * @param bool   $is_required Whether at least one interval is required.
	 *
	 * @return array<string,mixed>|WP_Error Normalized schedule or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( 'working_hours' !== $field_id ) {
			return new WP_Error( 'wpbc_setup_wizard_working_hours_field_unknown', __( 'The Working Hours editor received an unsupported field.', 'booking' ) );
		}

		return $this->working_hours->validate_working_hours( $raw_value, $is_required );
	}

	/**
	 * Enqueue compiled Working Hours assets and presentation translations.
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

		wp_enqueue_style( 'wpbc-setup-wizard-working-hours', $module_url . 'step-working-hours/_out/step-working-hours.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-working-hours', $module_url . 'step-working-hours/_out/step-working-hours.js', array( $shared_script_handle ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-working-hours',
			'wpbc_setup_wizard_working_hours',
			array(
				'i18n' => array(
					'working_hours_required'  => __( 'Enable at least one weekday and add its working hours.', 'booking' ),
					'working_hours_invalid'   => __( 'Every working interval must end after it starts.', 'booking' ),
					'working_hours_overlap'   => __( 'Working intervals on the same day cannot overlap or repeat.', 'booking' ),
					'working_hours_limit'     => __( 'No additional one-hour interval is available for this day.', 'booking' ),
					'copy_target_required'    => __( 'Select at least one target day.', 'booking' ),
					'schedule_copied'         => __( 'The working-hours schedule was copied to the selected days.', 'booking' ),
					/* translators: %s: Weekday name. */
					'remove_working_interval' => __( 'Remove %s working interval', 'booking' ),
				),
			)
		);
	}
}

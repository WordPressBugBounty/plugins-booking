<?php
/**
 * Reusable module adapter for the Fixed Time Slots setup editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose Fixed Time Slots through the common setup-module contract.
 */
final class WPBC_Setup_Wizard_Fixed_Time_Slots_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Contextual_Values_Validator {

	/** @var WPBC_Setup_Wizard_Fixed_Time_Slots */
	private $fixed_time_slots;

	/**
	 * Build the module around its reusable fixed-slot service.
	 *
	 * @param WPBC_Setup_Wizard_Fixed_Time_Slots|null $fixed_time_slots Optional service for tests or composition.
	 */
	public function __construct( $fixed_time_slots = null ) {
		$this->fixed_time_slots = $fixed_time_slots instanceof WPBC_Setup_Wizard_Fixed_Time_Slots
			? $fixed_time_slots
			: new WPBC_Setup_Wizard_Fixed_Time_Slots();
	}

	/**
	 * Return the stable step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'fixed_time_slots';
	}

	/**
	 * Return rail, template, and footer metadata.
	 *
	 * @return array{id:string,label:string,template:string,footer_note:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Fixed time slots', 'booking' ),
			'template'    => 'step-fixed-time-slots',
			'footer_note' => __( 'Save your fixed time slots and continue to the next step.', 'booking' ),
		);
	}

	/**
	 * Return the domain-owned fixed-slot template.
	 *
	 * @return string Absolute template path.
	 */
	public function get_template_path() {
		return __DIR__ . '/template.php';
	}

	/**
	 * Return the owned draft field.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array( 'fixed_time_slots' );
	}

	/**
	 * Require at least one valid fixed slot for forward navigation.
	 *
	 * @return string[] Required field list.
	 */
	public function get_required_fields() {
		return $this->get_field_names();
	}

	/**
	 * Return safe wizard-owned starter slots.
	 *
	 * @return array<string,mixed> Initial values.
	 */
	public function get_initial_values() {
		return array(
			'fixed_time_slots' => $this->fixed_time_slots->get_initial_fixed_time_slots(),
		);
	}

	/**
	 * Return dependencies used for display formatting and route validation.
	 *
	 * @return string[] Dependency step IDs.
	 */
	public function get_context_dependencies() {
		return array( 'date_time_formats', 'customer_journey' );
	}

	/**
	 * Build the fixed-slot editor context.
	 *
	 * @param array<string,mixed> $field_values     Validated module values.
	 * @param array<string,mixed> $consumer_context Read-only dependency values.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$time_format = isset( $consumer_context['date_time_formats']['time_format'] ) && is_scalar( $consumer_context['date_time_formats']['time_format'] )
			? (string) $consumer_context['date_time_formats']['time_format']
			: 'H:i';

		return $this->fixed_time_slots->get_context( $field_values, $time_format );
	}

	/**
	 * Validate the complete JSON transport field.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted JSON or array value.
	 * @param bool   $is_required Whether at least one slot is required.
	 *
	 * @return array<string,mixed>|WP_Error Normalized value or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( 'fixed_time_slots' !== $field_id ) {
			return new WP_Error( 'wpbc_setup_wizard_fixed_time_slots_field_unknown', __( 'The Fixed Time Slots editor received an unsupported field.', 'booking' ) );
		}

		return $this->fixed_time_slots->validate_fixed_time_slots( $raw_value, $is_required );
	}

	/**
	 * Restrict this editor to the Fixed Time Slots journey.
	 *
	 * @param array<string,mixed> $validated_values Validated module values.
	 * @param array<string,mixed> $consumer_context Read-only dependency values.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or a route error.
	 */
	public function validate_values_with_context( array $validated_values, array $consumer_context ) {
		$journey_id = isset( $consumer_context['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $consumer_context['customer_journey']['customer_journey'] )
			: '';

		if ( '' === $journey_id || WPBC_Setup_Wizard_Customer_Journey_Policy::uses_fixed_time_slots_configuration( $journey_id ) ) {
			return $validated_values;
		}

		$message = __( 'Fixed time slots are not available for the selected customer journey.', 'booking' );

		return new WP_Error(
			'wpbc_setup_wizard_fixed_time_slots_journey_invalid',
			$message,
			array( 'field_errors' => array( 'fixed_time_slots' => $message ) )
		);
	}

	/**
	 * Enqueue compiled domain assets and the shared Sortable library.
	 *
	 * @param string       $module_url           Setup Wizard module URL.
	 * @param string|false $asset_version        Plugin version for cache busting.
	 * @param string       $shared_style_handle  Shared shell style handle.
	 * @param string       $shared_script_handle Shared shell script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module_url = trailingslashit( $module_url );

		wp_enqueue_style( 'wpbc-setup-wizard-fixed-time-slots', $module_url . 'step-fixed-time-slots/_out/step-fixed-time-slots.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-sortable', wpbc_plugin_url( '/vendors/sortablejs/Sortable.min.js' ), array(), $asset_version, true );
		wp_enqueue_script( 'wpbc-setup-wizard-fixed-time-slots', $module_url . 'step-fixed-time-slots/_out/step-fixed-time-slots.js', array( $shared_script_handle, 'wpbc-sortable' ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-fixed-time-slots',
			'wpbc_setup_wizard_fixed_time_slots',
			array(
				'module_id'       => $this->get_step_id(),
				'field_id'        => 'fixed_time_slots',
				'max_time_slots'  => WPBC_Setup_Wizard_Fixed_Time_Slots::MAX_TIME_SLOTS,
				'time_increment'  => WPBC_Setup_Wizard_Fixed_Time_Slots::TIME_INCREMENT,
				'i18n'            => array(
					'slots_required'        => __( 'Add at least one fixed time slot.', 'booking' ),
					'slot_invalid'          => __( 'Every fixed time slot must end after it starts.', 'booking' ),
					'slot_duplicate'        => __( 'The same fixed time slot cannot appear twice.', 'booking' ),
					'generator_invalid'     => __( 'Choose a valid first start, last start, spacing, and duration.', 'booking' ),
					'generator_day_overflow' => __( 'The generated slot duration must finish by the end of the day.', 'booking' ),
					'slot_limit'            => __( 'No additional fixed time slot can be added.', 'booking' ),
					'slots_cleared'         => __( 'Fixed time slots cleared.', 'booking' ),
					/* translators: %s: Displayed fixed time slot. */
					'move_slot'             => __( 'Move fixed time slot %s', 'booking' ),
					/* translators: %s: Displayed fixed time slot. */
					'remove_slot'           => __( 'Remove fixed time slot %s', 'booking' ),
				),
			)
		);
	}
}

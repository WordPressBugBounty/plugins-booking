<?php
/**
 * Reusable module adapter for the Start Time and Duration setup editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose Start Time and Duration through the common setup-module contract.
 */
final class WPBC_Setup_Wizard_Start_Duration_Times_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Contextual_Values_Validator {

	/** @var WPBC_Setup_Wizard_Start_Duration_Times */
	private $start_duration_times;

	/**
	 * Build the module around its reusable proposal service.
	 *
	 * @param WPBC_Setup_Wizard_Start_Duration_Times|null $start_duration_times Optional service for tests or composition.
	 */
	public function __construct( $start_duration_times = null ) {
		$this->start_duration_times = $start_duration_times instanceof WPBC_Setup_Wizard_Start_Duration_Times
			? $start_duration_times
			: new WPBC_Setup_Wizard_Start_Duration_Times();
	}

	/**
	 * Return the stable step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'start_duration_times';
	}

	/**
	 * Return rail, template, and footer metadata.
	 *
	 * @return array{id:string,label:string,template:string,footer_note:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Start & duration times', 'booking' ),
			'template'    => 'step-start-duration-times',
			'footer_note' => __( 'Save your start times and duration choices and continue to the next step.', 'booking' ),
		);
	}

	/**
	 * Return the shared allow-listed choice-editor template.
	 *
	 * @return string Absolute template path.
	 */
	public function get_template_path() {
		return dirname( __DIR__ ) . '/step-start-end-times/template.php';
	}

	/**
	 * Return the owned draft field.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array( 'start_duration_times' );
	}

	/**
	 * Require both choice lists for forward navigation.
	 *
	 * @return string[] Required field list.
	 */
	public function get_required_fields() {
		return $this->get_field_names();
	}

	/**
	 * Return safe wizard-owned starter choices.
	 *
	 * @return array<string,mixed> Initial values.
	 */
	public function get_initial_values() {
		return array(
			'start_duration_times' => $this->start_duration_times->get_initial_start_duration_times(),
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
	 * Build the shared editor context.
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

		return $this->start_duration_times->get_context( $field_values, $time_format );
	}

	/**
	 * Validate the complete JSON transport field.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted JSON or array value.
	 * @param bool   $is_required Whether complete lists are required.
	 *
	 * @return array<string,mixed>|WP_Error Normalized value or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( 'start_duration_times' !== $field_id ) {
			return new WP_Error( 'wpbc_setup_wizard_start_duration_times_field_unknown', __( 'The Start Time and Duration editor received an unsupported field.', 'booking' ) );
		}

		return $this->start_duration_times->validate_start_duration_times( $raw_value, $is_required );
	}

	/**
	 * Restrict this editor to the Start Time + Duration journey.
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

		if ( '' === $journey_id || WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_duration_configuration( $journey_id ) ) {
			return $validated_values;
		}

		$message = __( 'Start Time and Duration choices are not available for the selected customer journey.', 'booking' );

		return new WP_Error(
			'wpbc_setup_wizard_start_duration_times_journey_invalid',
			$message,
			array( 'field_errors' => array( 'start_duration_times' => $message ) )
		);
	}

	/**
	 * Enqueue the compiled shared editor assets and duration translations.
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

		wp_enqueue_style( 'wpbc-setup-wizard-start-end-times', $module_url . 'step-start-end-times/_out/step-start-end-times.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-sortable', wpbc_plugin_url( '/vendors/sortablejs/Sortable.min.js' ), array(), $asset_version, true );
		wp_enqueue_script( 'wpbc-setup-wizard-start-end-times', $module_url . 'step-start-end-times/_out/step-start-end-times.js', array( $shared_script_handle, 'wpbc-sortable' ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-start-end-times',
			'wpbc_setup_wizard_start_end_times',
			array(
				'module_id'          => $this->get_step_id(),
				'field_id'           => 'start_duration_times',
				'max_times_per_list' => WPBC_Setup_Wizard_Start_Duration_Times::MAX_TIMES_PER_LIST,
				'time_increment'     => WPBC_Setup_Wizard_Start_Duration_Times::TIME_INCREMENT,
				'i18n'               => array(
					'start_times_required'    => __( 'Add at least one start time.', 'booking' ),
					'duration_times_required' => __( 'Add at least one duration.', 'booking' ),
					'time_duplicate'           => __( 'The same choice cannot appear twice in one list.', 'booking' ),
					'generator_invalid'        => __( 'The last generated choice must not be earlier than the first choice.', 'booking' ),
					'time_limit'               => __( 'No additional choice can be added to this list.', 'booking' ),
					'start_times_cleared'      => __( 'Start times cleared.', 'booking' ),
					'duration_times_cleared'   => __( 'Duration times cleared.', 'booking' ),
					/* translators: 1: Displayed choice, 2: Choice-list label. */
					'move_time_choice'         => __( 'Move %1$s in the %2$s list', 'booking' ),
					/* translators: 1: Displayed choice, 2: Choice-list label. */
					'remove_time_choice'       => __( 'Remove %1$s from the %2$s list', 'booking' ),
				),
			)
		);
	}
}

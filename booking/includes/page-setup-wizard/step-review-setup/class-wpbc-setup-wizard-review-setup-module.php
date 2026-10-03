<?php
/**
 * Setup Wizard module adapter for the reviewed setup plan.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose the read-only review plan through the common step-module contract.
 */
final class WPBC_Setup_Wizard_Review_Setup_Module implements WPBC_Setup_Wizard_Step_Module {

	/** @var WPBC_Setup_Wizard_Review_Setup */
	private $review_setup;

	/**
	 * Build the adapter around the review presentation service.
	 *
	 * @param WPBC_Setup_Wizard_Review_Setup|null $review_setup Optional service for tests.
	 */
	public function __construct( $review_setup = null ) {
		$this->review_setup = $review_setup instanceof WPBC_Setup_Wizard_Review_Setup ? $review_setup : new WPBC_Setup_Wizard_Review_Setup();
	}

	/**
	 * Return the stable step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'review_setup';
	}

	/**
	 * Return rail, template, and footer metadata.
	 *
	 * @return array<string,string> Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Your setup plan', 'booking' ),
			'template'    => 'step-review-setup',
			'footer_note' => __( 'Finish setup revalidates the active route and completes the wizard. Settings and publishing changes saved on earlier steps remain active.', 'booking' ),
		);
	}

	/**
	 * Return the allow-listed template path.
	 *
	 * @return string Absolute template path.
	 */
	public function get_template_path() {
		return __DIR__ . '/template.php';
	}

	/**
	 * Return the empty Review Setup field allow-list.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array();
	}

	/**
	 * Return the empty required-field list.
	 *
	 * @return string[] Required field IDs.
	 */
	public function get_required_fields() {
		return array();
	}

	/**
	 * Return the field-free initial state.
	 *
	 * @return array<string,mixed> Initial values.
	 */
	public function get_initial_values() {
		return array();
	}

	/**
	 * Return every earlier step that can contribute a review row.
	 *
	 * @return string[] Dependency step identifiers.
	 */
	public function get_context_dependencies() {
		return array(
			'business_details',
			'date_time_formats',
			'booking_experience',
			'customer_journey',
			'date_selection',
			'services',
			'booking_resources',
			'start_end_times',
			'start_duration_times',
			'fixed_time_slots',
			'working_hours',
			'days_off',
			'booking_form_template',
			'appearance',
			'publish_integration',
		);
	}

	/**
	 * Build the data-only review context.
	 *
	 * @param array<string,mixed> $field_values     Review-step values; currently empty.
	 * @param array<string,mixed> $consumer_context Validated earlier-step values.
	 *
	 * @return array<string,mixed> Review presentation data.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		return $this->review_setup->get_context( $field_values, $consumer_context );
	}

	/**
	 * Reject every submitted field because Review Setup has no editable fields.
	 *
	 * @param string $field_id    Stable field ID.
	 * @param mixed  $raw_value   Untrusted submitted value.
	 * @param bool   $is_required Whether acknowledgment is required.
	 *
	 * @return WP_Error Unsupported-field error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		unset( $field_id, $raw_value, $is_required );

		return new WP_Error( 'wpbc_setup_wizard_review_field_unknown', __( 'The setup review received an unsupported field.', 'booking' ) );
	}

	/**
	 * Enqueue the compiled review-page stylesheet.
	 *
	 * @param string       $module_url          Setup Wizard module URL.
	 * @param string|false $asset_version       Plugin asset version.
	 * @param string       $shared_style_handle Shared shell style handle.
	 * @param string       $shared_script_handle Shared shell script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		unset( $shared_script_handle );
		$module_url = trailingslashit( $module_url );

		wp_enqueue_style( 'wpbc-setup-wizard-review-setup', $module_url . 'step-review-setup/_out/step-review-setup.css', array( $shared_style_handle ), $asset_version );
	}
}

<?php
/**
 * Reusable module adapter for the Days Off setup editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose canonical date availability through the common setup-module contract.
 */
final class WPBC_Setup_Wizard_Days_Off_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Current_Values_Module {

	/** @var WPBC_Setup_Wizard_Days_Off */
	private $days_off;

	/**
	 * Build the adapter around the Days Off domain service.
	 *
	 * @param WPBC_Setup_Wizard_Days_Off|null $days_off Optional service for composition.
	 */
	public function __construct( $days_off = null ) {
		$this->days_off = $days_off instanceof WPBC_Setup_Wizard_Days_Off ? $days_off : new WPBC_Setup_Wizard_Days_Off();
	}

	/**
	 * Return the stable step identifier used by the route and module registries.
	 *
	 * @return string Stable module identifier.
	 */
	public function get_step_id() {
		return 'days_off';
	}

	/**
	 * Define the registered page label, allow-listed template, and footer note.
	 *
	 * @return array<string,string> Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Days off and date availability', 'booking' ),
			'template'    => 'step-days-off',
			'footer_note' => __( 'Add or remove dates here, then use Save & continue to update Days Availability.', 'booking' ),
		);
	}

	/**
	 * Return the domain-owned template accepted by the shared template loader.
	 *
	 * @return string Absolute allow-listed template path.
	 */
	public function get_template_path() {
		return __DIR__ . '/template.php';
	}

	/**
	 * Return the staged Days Off transport field.
	 *
	 * @return string[] Staged transport field list.
	 */
	public function get_field_names() {
		return array( 'days_off' );
	}

	/**
	 * Require one complete staged availability snapshot.
	 *
	 * @return string[] Required staged transport field list.
	 */
	public function get_required_fields() {
		return array( 'days_off' );
	}

	/**
	 * Return canonical Availability as the initial staged proposal.
	 *
	 * @return array<string,mixed> Initial complete Availability proposal.
	 */
	public function get_initial_values() {
		return array( 'days_off' => $this->days_off->get_initial_staged_values() );
	}

	/**
	 * Refresh unavailable dates from current canonical Availability state.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names() {
		return $this->get_field_names();
	}

	/**
	 * Return no draft dependencies; authorization and canonical state are server-owned.
	 *
	 * @return string[] Empty dependency list.
	 */
	public function get_context_dependencies() {
		return array();
	}

	/**
	 * Return current canonical state for the domain-owned template.
	 *
	 * @param array<string,mixed> $field_values     Validated staged Availability values.
	 * @param array<string,mixed> $consumer_context Unused consumer context.
	 *
	 * @return array<string,mixed> Authorized editor state.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		unset( $consumer_context );

		return $this->days_off->get_staged_state( isset( $field_values['days_off'] ) ? $field_values['days_off'] : $this->days_off->get_initial_staged_values() );
	}

	/**
	 * Validate the staged complete Availability proposal.
	 *
	 * @param string $field_id    Field identifier.
	 * @param mixed  $raw_value   Submitted staged proposal.
	 * @param bool   $is_required Whether the field was marked required.
	 *
	 * @return array<string,mixed>|WP_Error Normalized proposal or error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( 'days_off' !== $field_id ) {
			return new WP_Error( 'wpbc_setup_wizard_days_off_field_unknown', __( 'The Days Off editor received an unsupported field.', 'booking' ) );
		}

		return $this->days_off->validate_staged_values( $raw_value, $is_required );
	}

	/**
	 * Enqueue compiled module assets and the standard WPBC date picker.
	 *
	 * @param string       $module_url          Setup Wizard module URL.
	 * @param string|false $asset_version       Plugin asset version.
	 * @param string       $shared_style_handle Shared wizard style.
	 * @param string       $shared_script_handle Shared wizard script.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module_url          = trailingslashit( $module_url );
		$script_dependencies = array( $shared_script_handle, 'wpbc-datepick' );

		wp_enqueue_style( 'wpbc-calendar' );
		wp_enqueue_script( 'wpbc-datepick' );
		if ( wp_script_is( 'wpbc-datepick-localize', 'registered' ) ) {
			wp_enqueue_script( 'wpbc-datepick-localize' );
			$script_dependencies[] = 'wpbc-datepick-localize';
		}
		wp_enqueue_style( 'wpbc-setup-wizard-days-off', $module_url . 'step-days-off/_out/step-days-off.css', array( $shared_style_handle, 'wpbc-calendar' ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-days-off', $module_url . 'step-days-off/_out/step-days-off.js', $script_dependencies, $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-days-off',
			'wpbc_setup_wizard_days_off',
			array(
				'ajax_url'    => admin_url( 'admin-ajax.php' ),
				'load_action' => WPBC_Setup_Wizard_Days_Off_Ajax::ACTION_LOAD,
				'nonce'       => wp_create_nonce( WPBC_Setup_Wizard_Ajax::NONCE_ACTION ),
				'locale'      => sanitize_text_field( determine_locale() ),
				'i18n'        => array(
					'added'                      => __( 'The unavailable date range is staged. Save & continue to apply it.', 'booking' ),
					'removed'                    => __( 'The unavailable date range removal is staged. Save & continue to apply it.', 'booking' ),
					'error'                      => __( 'Date availability could not be loaded. Try again.', 'booking' ),
					'range_invalid'              => __( 'Select a valid unavailable date range.', 'booking' ),
					'calendar_unavailable'       => __( 'The date selector could not be loaded. Reload the page and try again.', 'booking' ),
					'empty'                      => __( 'No upcoming unavailable dates.', 'booking' ),
					'remove_range'               => __( 'Remove unavailable date range', 'booking' ),
					'all_booking_items'           => __( 'All booking items', 'booking' ),
					'one_unavailable_day'        => __( '1 unavailable day', 'booking' ),
					'unavailable'               => __( 'Unavailable', 'booking' ),
					'some_resources_unavailable' => __( 'Some booking items unavailable', 'booking' ),
					'resources_have_bookings'    => __( 'Bookings exist for one or more booking items', 'booking' ),
					'approved_booking'           => __( 'Approved booking', 'booking' ),
					'pending_booking'            => __( 'Pending booking', 'booking' ),
					'partially_booked'           => __( 'Partially booked', 'booking' ),
					'partially_booked_pending'   => __( 'Partially booked; pending booking', 'booking' ),
					/* translators: %s: Number of unavailable days. */
					'many_unavailable_days'      => __( '%s unavailable days', 'booking' ),
				),
			)
		);
	}
}

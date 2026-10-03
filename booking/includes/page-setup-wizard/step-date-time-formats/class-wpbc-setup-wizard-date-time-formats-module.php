<?php
/**
 * Reusable module adapter for the Dates and times setup editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose Step 3 through the common setup-module contract.
 */
final class WPBC_Setup_Wizard_Date_Time_Formats_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Current_Values_Module {

	/** @var WPBC_Setup_Wizard_Date_Time_Formats */
	private $date_time_formats;

	/**
	 * Build the adapter around the reusable domain service.
	 *
	 * @param WPBC_Setup_Wizard_Date_Time_Formats|null $date_time_formats Optional service for tests or composition.
	 */
	public function __construct( $date_time_formats = null ) {
		$this->date_time_formats = $date_time_formats instanceof WPBC_Setup_Wizard_Date_Time_Formats
			? $date_time_formats
			: new WPBC_Setup_Wizard_Date_Time_Formats();
	}

	/**
	 * Return the stable module and step identifier.
	 *
	 * @return string Stable identifier.
	 */
	public function get_step_id() {
		return 'date_time_formats';
	}

	/**
	 * Return the rail and template metadata contributed by this module.
	 *
	 * @return array{id:string,label:string,template:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'       => $this->get_step_id(),
			'label'    => __( 'Dates & times', 'booking' ),
			'template' => 'step-date-time-formats',
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
	 * Return the ordered draft fields accepted by Step 3.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return $this->date_time_formats->get_field_names();
	}

	/**
	 * Return fields required when advancing.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields() {
		return $this->date_time_formats->get_required_fields();
	}

	/**
	 * Return current settings or safe read-only suggestions.
	 *
	 * @return array<string,string> Initial field values.
	 */
	public function get_initial_values() {
		return $this->date_time_formats->get_initial_values();
	}

	/**
	 * Refresh every date and time preference from canonical plugin options.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names() {
		return $this->get_field_names();
	}

	/**
	 * Return dependencies required to render this module.
	 *
	 * @return string[] No cross-step dependencies.
	 */
	public function get_context_dependencies() {
		return array();
	}

	/**
	 * Build the data-only Step 3 context.
	 *
	 * @param array<string,mixed> $field_values     Validated module fields.
	 * @param array<string,mixed> $consumer_context Unused consumer context.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		unset( $consumer_context );

		return $this->date_time_formats->get_context( $field_values );
	}

	/**
	 * Validate one Step 3 draft field.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted submitted value.
	 * @param bool   $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Normalized value or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		return $this->date_time_formats->validate_field( $field_id, $raw_value, $is_required );
	}

	/**
	 * Enqueue compiled Step 3 assets and request metadata.
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

		wp_enqueue_style( 'wpbc-setup-wizard-date-time-formats', $module_url . 'step-date-time-formats/_out/step-date-time-formats.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-date-time-formats', $module_url . 'step-date-time-formats/_out/step-date-time-formats.js', array( $shared_script_handle, 'jquery' ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-date-time-formats',
			'wpbc_setup_wizard_date_time_formats',
			array(
				'ajax_url' => admin_url( 'admin-ajax.php' ),
				'action'   => WPBC_Setup_Wizard_Date_Time_Formats_Ajax::ACTION_INSTALL_LOCAL_TRANSLATION,
				'nonce'    => wp_create_nonce( WPBC_Setup_Wizard_Ajax::NONCE_ACTION ),
				'i18n'     => array(
					'working'           => __( 'Downloading and updating Local translations...', 'booking' ),
					'connecting'        => __( 'Connecting to the official Booking Calendar translation archive.', 'booking' ),
					'complete'          => __( 'Update complete', 'booking' ),
					'reloading'         => __( 'Reloading the page to activate the updated translation...', 'booking' ),
					'failed'            => __( 'Update failed', 'booking' ),
					'error'             => __( 'Local translations could not be updated. Try again or use the Translations settings page.', 'booking' ),
					'local_source_label' => __( 'Local', 'booking' ),
				),
			)
		);
	}
}

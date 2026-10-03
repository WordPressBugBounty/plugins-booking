<?php
/**
 * Allow-listed template loader for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve only server-defined Setup Wizard templates below the module root.
 */
final class WPBC_Setup_Wizard_Templates {

	/** @var WPBC_Setup_Wizard_Step_Module_Registry */
	private $module_registry;

	/**
	 * Build the allow-list loader around the reusable module registry.
	 *
	 * @param WPBC_Setup_Wizard_Step_Module_Registry|null $module_registry Optional shared module registry.
	 */
	public function __construct( $module_registry = null ) {
		$this->module_registry = $module_registry instanceof WPBC_Setup_Wizard_Step_Module_Registry
			? $module_registry
			: new WPBC_Setup_Wizard_Step_Module_Registry();
	}

	/**
	 * Return the complete template allow-list.
	 *
	 * @return array<string,string> Template paths keyed by stable template ID.
	 */
	public function get_allow_list() {
		$core_allow_list = array(
			'shell'                           => __DIR__ . '/templates/shell.php',
			'rail'                            => __DIR__ . '/templates/rail.php',
			'footer'                          => __DIR__ . '/templates/footer.php',
			'settings-hint'                   => __DIR__ . '/templates/settings-hint.php',
			'confirmation-dialog'             => __DIR__ . '/templates/confirmation-dialog.php',
			'step-welcome'                    => __DIR__ . '/templates/step-welcome.php',
			'step-business-details'           => __DIR__ . '/templates/step-business-details.php',
			'step-booking-experience'         => __DIR__ . '/templates/step-booking-experience.php',
			'step-booking-experience-toolbar' => __DIR__ . '/templates/step-booking-experience-toolbar.php',
			'step-customer-journey'           => __DIR__ . '/templates/step-customer-journey.php',
		);

		$error_allow_list  = array( 'error' => __DIR__ . '/templates/error.php' );
		$module_allow_list = array_diff_key( $this->module_registry->get_template_allow_list(), $core_allow_list, $error_allow_list );

		return array_merge(
			$core_allow_list,
			$module_allow_list,
			$error_allow_list
		);
	}

	/**
	 * Resolve one allow-listed template and prove it remains inside the module.
	 *
	 * @param string $template_id Server-selected template identifier.
	 *
	 * @return string|WP_Error Canonical template path or validation error.
	 */
	public function get_template_path( $template_id ) {
		$allow_list = $this->get_allow_list();

		if ( ! isset( $allow_list[ $template_id ] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_unknown_template', __( 'The requested Setup Wizard template is not registered.', 'booking' ) );
		}

		$template_path = realpath( $allow_list[ $template_id ] );
		$template_root = realpath( __DIR__ );

		if ( false === $template_path || false === $template_root || 0 !== strpos( $template_path, $template_root . DIRECTORY_SEPARATOR ) ) {
			return new WP_Error( 'wpbc_setup_wizard_invalid_template', __( 'The requested Setup Wizard template is unavailable.', 'booking' ) );
		}

		return $template_path;
	}

	/**
	 * Render one server-selected template with an explicit context record.
	 *
	 * Templates receive only `$template_context`; arbitrary variable extraction
	 * is intentionally avoided so template contracts stay visible and auditable.
	 *
	 * @param string              $template_id      Server-selected template identifier.
	 * @param array<string,mixed> $template_context Authorized presentation context.
	 *
	 * @return true|WP_Error True after rendering, or a template validation error.
	 */
	public function render( $template_id, array $template_context = array() ) {
		$template_path = $this->get_template_path( $template_id );

		if ( is_wp_error( $template_path ) ) {
			return $template_path;
		}

		include $template_path;

		return true;
	}
}

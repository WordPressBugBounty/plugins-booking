<?php
/**
 * Reusable step-module registry for the Setup Wizard module.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register reusable domain editors without teaching consumer shells their rules.
 */
final class WPBC_Setup_Wizard_Step_Module_Registry {

	/** @var array<string,WPBC_Setup_Wizard_Step_Module> */
	private $modules = array();

	/**
	 * Build the registry from explicit modules or the bundled module set.
	 *
	 * @param WPBC_Setup_Wizard_Step_Module[]|null $modules Optional ordered modules.
	 */
	public function __construct( $modules = null ) {
		if ( null === $modules ) {
			$modules = array(
				new WPBC_Setup_Wizard_Date_Time_Formats_Module(),
				new WPBC_Setup_Wizard_Date_Selection_Module(),
				new WPBC_Setup_Wizard_Days_Off_Module(),
				new WPBC_Setup_Wizard_Services_Module(),
				new WPBC_Setup_Wizard_Booking_Resources_Module(),
				new WPBC_Setup_Wizard_Start_End_Times_Module(),
				new WPBC_Setup_Wizard_Start_Duration_Times_Module(),
				new WPBC_Setup_Wizard_Fixed_Time_Slots_Module(),
				new WPBC_Setup_Wizard_Working_Hours_Module(),
				new WPBC_Setup_Wizard_Booking_Form_Template_Module(),
				new WPBC_Setup_Wizard_Appearance_Module(),
				new WPBC_Setup_Wizard_Publish_Integration_Module(),
				new WPBC_Setup_Wizard_Review_Setup_Module(),
			);
		}

		foreach ( (array) $modules as $module ) {
			if ( ! $module instanceof WPBC_Setup_Wizard_Step_Module ) {
				continue;
			}

			$step_id = sanitize_key( $module->get_step_id() );
			$definition = $this->normalize_step_definition( $step_id, $module->get_step_definition() );
			if ( '' !== $step_id && ! is_wp_error( $definition ) && ! isset( $this->modules[ $step_id ] ) ) {
				$this->modules[ $step_id ] = $module;
			}
		}
	}

	/**
	 * Return all modules in their registered order.
	 *
	 * @return array<string,WPBC_Setup_Wizard_Step_Module> Modules keyed by step ID.
	 */
	public function get_modules() {
		return $this->modules;
	}

	/**
	 * Return one registered module.
	 *
	 * @param string $step_id Proposed step identifier.
	 *
	 * @return WPBC_Setup_Wizard_Step_Module|null Registered module or null.
	 */
	public function get_module( $step_id ) {
		$step_id = sanitize_key( is_scalar( $step_id ) ? (string) $step_id : '' );

		return isset( $this->modules[ $step_id ] ) ? $this->modules[ $step_id ] : null;
	}

	/**
	 * Determine whether one registered module is available in this site context.
	 *
	 * Modules without a conditional contract are always available. Conditional
	 * modules own their restriction logic so the shared registry remains
	 * domain-neutral.
	 *
	 * @param string              $step_id          Proposed module step ID.
	 * @param array<string,mixed> $consumer_context Optional read-only route context.
	 *
	 * @return bool True when the registered module may appear in the route.
	 */
	public function is_module_available( $step_id, array $consumer_context = array() ) {
		$module = $this->get_module( $step_id );
		if ( null === $module ) {
			return false;
		}

		if ( $module instanceof WPBC_Setup_Wizard_Conditional_Step_Module ) {
			return (bool) $module->is_available( $consumer_context );
		}

		return true;
	}

	/**
	 * Return step definitions contributed by registered modules.
	 *
	 * @return array<string,array<string,string>> Definitions keyed by step ID.
	 */
	public function get_step_definitions() {
		$definitions = array();

		foreach ( $this->modules as $step_id => $module ) {
			$definition = $this->normalize_step_definition( $step_id, $module->get_step_definition() );
			if ( ! is_wp_error( $definition ) ) {
				$definitions[ $step_id ] = $definition;
			}
		}

		return $definitions;
	}

	/**
	 * Return the server-owned template allow-list contributed by modules.
	 *
	 * @return array<string,string> Template paths keyed by stable template ID.
	 */
	public function get_template_allow_list() {
		$allow_list = array();

		foreach ( $this->modules as $step_id => $module ) {
			$definition = $this->normalize_step_definition( $step_id, $module->get_step_definition() );
			if ( is_wp_error( $definition ) ) {
				continue;
			}

			$allow_list[ $definition['template'] ] = $module->get_template_path();
		}

		return $allow_list;
	}

	/**
	 * Enqueue the compiled assets owned by one registered module.
	 *
	 * @param string       $step_id              Current step identifier.
	 * @param string       $module_url           Absolute URL to the Setup Wizard module root.
	 * @param string|false $asset_version        Plugin version used for cache busting.
	 * @param string       $shared_style_handle  Consumer shell style handle.
	 * @param string       $shared_script_handle Consumer shell script handle.
	 *
	 * @return bool True when a module was found and enqueued.
	 */
	public function enqueue_assets( $step_id, $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module = $this->get_module( $step_id );

		if ( null === $module ) {
			return false;
		}

		$module->enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle );

		return true;
	}

	/**
	 * Normalize trusted module metadata before exposing it to a consumer shell.
	 *
	 * @param string $registered_step_id Registry key assigned to the module.
	 * @param mixed  $definition         Module-provided step definition.
	 *
	 * @return array<string,string>|WP_Error Normalized definition or an error.
	 */
	private function normalize_step_definition( $registered_step_id, $definition ) {
		if ( ! is_array( $definition ) ) {
			return new WP_Error( 'wpbc_setup_wizard_module_definition_invalid', __( 'A setup editor has an invalid definition.', 'booking' ) );
		}

		$definition_step_id = isset( $definition['id'] ) && is_scalar( $definition['id'] ) ? sanitize_key( (string) $definition['id'] ) : '';
		$template_id        = isset( $definition['template'] ) && is_scalar( $definition['template'] ) ? sanitize_key( (string) $definition['template'] ) : '';
		$label              = isset( $definition['label'] ) && is_scalar( $definition['label'] ) ? sanitize_text_field( (string) $definition['label'] ) : '';

		if ( $registered_step_id !== $definition_step_id || '' === $template_id || '' === $label ) {
			return new WP_Error( 'wpbc_setup_wizard_module_definition_invalid', __( 'A setup editor has an invalid definition.', 'booking' ) );
		}

		$normalized_definition = array(
			'id'       => $definition_step_id,
			'label'    => $label,
			'template' => $template_id,
		);

		if ( isset( $definition['footer_note'] ) && is_scalar( $definition['footer_note'] ) ) {
			$normalized_definition['footer_note'] = sanitize_text_field( (string) $definition['footer_note'] );
		}

		return $normalized_definition;
	}
}

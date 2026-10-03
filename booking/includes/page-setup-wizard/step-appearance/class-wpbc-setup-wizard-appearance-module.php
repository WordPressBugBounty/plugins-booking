<?php
/**
 * Reusable module adapter for the Setup Wizard Appearance editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose canonical appearance choices through the shared setup-module contract.
 */
final class WPBC_Setup_Wizard_Appearance_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Current_Values_Module {

	/** @var WPBC_Setup_Wizard_Appearance */
	private $appearance;

	/** @var WPBC_Setup_Wizard_Booking_Form_Templates */
	private $templates;

	/**
	 * Build the module around the read-only Appearance registry adapter.
	 *
	 * @param WPBC_Setup_Wizard_Appearance|null             $appearance Optional Appearance service for testing.
	 * @param WPBC_Setup_Wizard_Booking_Form_Templates|null $templates  Optional Form Builder template service for testing.
	 */
	public function __construct( $appearance = null, $templates = null ) {
		$this->appearance = $appearance instanceof WPBC_Setup_Wizard_Appearance
			? $appearance
			: new WPBC_Setup_Wizard_Appearance();
		$this->templates  = $templates instanceof WPBC_Setup_Wizard_Booking_Form_Templates
			? $templates
			: new WPBC_Setup_Wizard_Booking_Form_Templates();
	}

	/**
	 * Return the stable module and step identifier.
	 *
	 * @return string Stable identifier.
	 */
	public function get_step_id() {
		return 'appearance';
	}

	/**
	 * Return the rail and template metadata contributed by this module.
	 *
	 * @return array{id:string,label:string,template:string,footer_note:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Appearance', 'booking' ),
			'template'    => 'step-appearance',
			'footer_note' => __( 'Save & continue applies these Booking Form, calendar, and time-slot appearance settings immediately.', 'booking' ),
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
	 * Return the appearance fields accepted by this step.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array( 'booking_form_style', 'booking_form_accent_color', 'booking_skin', 'booking_timeslot_picker' );
	}

	/**
	 * Require every appearance dimension before forward navigation.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields() {
		return $this->get_field_names();
	}

	/**
	 * Return current canonical values as read-only draft suggestions.
	 *
	 * @return array<string,string> Initial appearance values.
	 */
	public function get_initial_values() {
		return $this->appearance->get_initial_values();
	}

	/**
	 * Refresh all appearance choices from their canonical plugin options.
	 *
	 * @return string[] Current-value field identifiers.
	 */
	public function get_current_value_field_names() {
		return $this->get_field_names();
	}

	/**
	 * Return the journey and saved Booking Form template used by the preview.
	 *
	 * @return string[] Dependency step identifiers.
	 */
	public function get_context_dependencies() {
		return array( 'customer_journey', 'booking_form_template' );
	}

	/**
	 * Build the authorized Appearance editor context and request-local preview.
	 *
	 * @param array<string,mixed> $field_values     Validated appearance values.
	 * @param array<string,mixed> $consumer_context Read-only dependency values.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$customer_journey = isset( $consumer_context['customer_journey']['customer_journey'] )
			&& is_scalar( $consumer_context['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $consumer_context['customer_journey']['customer_journey'] )
			: '';
		$template_values = isset( $consumer_context['booking_form_template'] ) && is_array( $consumer_context['booking_form_template'] )
			? $consumer_context['booking_form_template']
			: array();
		$template_context = $this->templates->get_context( $template_values, $customer_journey );
		$selected_template = isset( $template_context['selected_template'] ) && is_array( $template_context['selected_template'] )
			? $template_context['selected_template']
			: array();
		$template_slug    = isset( $selected_template['slug'] ) ? (string) $selected_template['slug'] : '';
		$preview_result   = $this->render_inline_preview( $template_slug, $field_values );

		return array(
			'values'             => $field_values,
			'starting_styles'    => $this->appearance->get_starting_styles(),
			'accent_colors'      => $this->appearance->get_accent_colors(),
			'calendar_skins'     => $this->appearance->get_calendar_skin_groups(),
			'template_slug'      => $template_slug,
			'booking_form_usage' => WPBC_Setup_Wizard_Appearance::PREVIEW_BOOKING_FORM_USAGE,
			'preview_html'       => $preview_result['html'],
			'preview_error'      => $preview_result['error'],
		);
	}

	/**
	 * Render the selected unsaved template directly for the Appearance step.
	 *
	 * Template definitions are resolved through the current server registry and
	 * appearance values are validated through their canonical allow-lists before
	 * the shared Form Builder preview service renders the snapshot. The operation
	 * is request-local and does not create a preview transient or save a form.
	 *
	 * @param string              $template_slug Selected server-owned template slug.
	 * @param array<string,mixed> $field_values  Validated Appearance draft values.
	 *
	 * @return array{html:string,error:string} Rendered preview result.
	 */
	private function render_inline_preview( $template_slug, array $field_values ) {
		$preview_payload = $this->templates->get_inline_preview_payload( $template_slug );
		$preview_config  = $this->appearance->get_preview_configuration( $field_values );
		$render_mode     = $this->templates->get_preview_render_mode( WPBC_Setup_Wizard_Appearance::PREVIEW_BOOKING_FORM_USAGE );

		foreach ( array( $preview_payload, $preview_config, $render_mode ) as $validated_value ) {
			if ( is_wp_error( $validated_value ) ) {
				return array(
					'html'  => '',
					'error' => $validated_value->get_error_message(),
				);
			}
		}

		if ( ! class_exists( 'WPBC_BFB_Preview_Service' ) || ! class_exists( 'WPBC_FE_Attr_Postprocessor' ) ) {
			return array(
				'html'  => '',
				'error' => __( 'The booking appearance preview is unavailable.', 'booking' ),
			);
		}

		$resource_id = absint( WPBC_FE_Attr_Postprocessor::get_default_booking_resource_id() );
		$resource_id = $resource_id > 0 ? $resource_id : 1;

		$preview_html = WPBC_BFB_Preview_Service::get_instance()->render_inline_preview(
			$resource_id,
			$preview_payload['structure'],
			$preview_payload['form_name'],
			$preview_payload['advanced_form'],
			$preview_payload['content_form'],
			$preview_config['form_style'],
			array(
				'render_mode'      => $render_mode,
				'option_overrides' => $preview_config['option_overrides'],
			)
		);

		if ( ! is_string( $preview_html ) || '' === trim( $preview_html ) ) {
			return array(
				'html'  => '',
				'error' => __( 'The selected booking form could not be rendered.', 'booking' ),
			);
		}

		return array(
			'html'  => $preview_html,
			'error' => '',
		);
	}

	/**
	 * Validate one appearance field through its canonical server allow-list.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted field value.
	 * @param bool   $is_required Whether an empty value is invalid.
	 *
	 * @return string|WP_Error Normalized value or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		switch ( $field_id ) {
			case 'booking_form_style':
				return $this->appearance->validate_style( $raw_value, $is_required );

			case 'booking_form_accent_color':
				return $this->appearance->validate_accent_color( $raw_value, $is_required );

			case 'booking_skin':
				return $this->appearance->validate_calendar_skin( $raw_value, $is_required );

			case 'booking_timeslot_picker':
				return $this->appearance->validate_timeslot_picker( $raw_value, $is_required );
		}

		return new WP_Error( 'wpbc_setup_wizard_appearance_field_unknown', __( 'The Appearance editor received an unsupported field.', 'booking' ) );
	}

	/**
	 * Enqueue compiled Appearance assets and instant preview configuration.
	 *
	 * @param string       $module_url          Absolute URL to the Setup Wizard root.
	 * @param string|false $asset_version       Plugin version used for cache busting.
	 * @param string       $shared_style_handle Consumer shell style handle.
	 * @param string       $shared_script_handle Consumer shell script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module_url = trailingslashit( $module_url );

		wp_enqueue_style( 'coloris', wpbc_plugin_url( '/vendors/coloris/dist/coloris.min.css' ), array(), $asset_version );
		wp_enqueue_script( 'coloris', wpbc_plugin_url( '/vendors/coloris/dist/coloris.min.js' ), array(), $asset_version, true );
		wp_enqueue_style( 'wpbc-setup-wizard-appearance', $module_url . 'step-appearance/_out/step-appearance.css', array( $shared_style_handle, 'coloris' ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-appearance', $module_url . 'step-appearance/_out/step-appearance.js', array( $shared_script_handle, 'coloris' ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-appearance',
			'wpbc_setup_wizard_appearance',
			array(
				'form_style_presets'       => function_exists( 'wpbc_bfb_settings__get_form_style_presets' ) ? wpbc_bfb_settings__get_form_style_presets() : array(),
				'form_style_css_var_names' => function_exists( 'wpbc_bfb_settings__get_form_style_css_var_names' ) ? wpbc_bfb_settings__get_form_style_css_var_names() : array(),
				'i18n'                     => array(
					'style_required'    => __( 'Choose a starting style.', 'booking' ),
					'accent_required'   => __( 'Choose a valid accent color.', 'booking' ),
					'skin_required'     => __( 'Choose a calendar skin.', 'booking' ),
					'time_required'     => __( 'Choose how time slots are displayed.', 'booking' ),
				),
			)
		);
	}
}

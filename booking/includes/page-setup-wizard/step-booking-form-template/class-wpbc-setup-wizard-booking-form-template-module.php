<?php
/**
 * Reusable module adapter for the Booking Form Template setup editor.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose the template selector through the common setup-module contract.
 */
final class WPBC_Setup_Wizard_Booking_Form_Template_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Contextual_Values_Validator {

	/** @var WPBC_Setup_Wizard_Booking_Form_Templates */
	private $templates;

	/** @var WPBC_Setup_Wizard_Booking_Form_Preview */
	private $preview;

	/** @var WPBC_Setup_Wizard_Booking_Form_Time_Options */
	private $time_options;

	/**
	 * Build the module around the read-only Form Builder registry adapter.
	 *
	 * @param WPBC_Setup_Wizard_Booking_Form_Templates|null    $templates    Optional registry adapter for testing or composition.
	 * @param WPBC_Setup_Wizard_Booking_Form_Preview|null      $preview      Optional preview coordinator for testing or composition.
	 * @param WPBC_Setup_Wizard_Booking_Form_Time_Options|null $time_options Optional time projector for testing or composition.
	 */
	public function __construct( $templates = null, $preview = null, $time_options = null ) {
		$this->templates = $templates instanceof WPBC_Setup_Wizard_Booking_Form_Templates
			? $templates
			: new WPBC_Setup_Wizard_Booking_Form_Templates();
		$this->time_options = $time_options instanceof WPBC_Setup_Wizard_Booking_Form_Time_Options
			? $time_options
			: new WPBC_Setup_Wizard_Booking_Form_Time_Options();
		$this->preview = $preview instanceof WPBC_Setup_Wizard_Booking_Form_Preview
			? $preview
			: new WPBC_Setup_Wizard_Booking_Form_Preview( $this->templates, $this->time_options );
	}

	/**
	 * Return the stable module and step identifier.
	 *
	 * @return string Stable identifier.
	 */
	public function get_step_id() {
		return 'booking_form_template';
	}

	/**
	 * Return the rail and template metadata contributed by this module.
	 *
	 * @return array{id:string,label:string,template:string,footer_note:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Booking form', 'booking' ),
			'template'    => 'step-booking-form-template',
			'footer_note' => __( 'Create or update the selected Booking Form when you continue. Guided Appointment also assigns it to the saved Services.', 'booking' ),
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
	 * Return the fields accepted by the selector.
	 *
	 * @return string[] Field allow-list.
	 */
	public function get_field_names() {
		return array( 'booking_form_template', 'booking_form_usage' );
	}

	/**
	 * Return the required fields when advancing.
	 *
	 * @return string[] Required field identifiers.
	 */
	public function get_required_fields() {
		return array( 'booking_form_template', 'booking_form_usage' );
	}

	/**
	 * Return the preferred Form Builder template as a read-only suggestion.
	 *
	 * @return array<string,string> Initial field value.
	 */
	public function get_initial_values() {
		return array(
			'booking_form_template' => $this->templates->get_initial_template_slug(),
			'booking_form_usage'    => $this->templates->get_initial_booking_form_usage(),
		);
	}

	/**
	 * Return dependencies used for recommendations and time projection.
	 *
	 * @return string[] Dependency step identifiers.
	 */
	public function get_context_dependencies() {
		return array( 'customer_journey', 'start_end_times', 'start_duration_times', 'fixed_time_slots', 'date_time_formats' );
	}

	/**
	 * Build the template selector context and its initial Direct preview.
	 *
	 * Appointment Flow intentionally remains client-loaded because its later
	 * Service and Provider requests require the signed preview URL returned by
	 * the authenticated preview endpoint.
	 *
	 * @param array<string,mixed> $field_values     Validated module field values.
	 * @param array<string,mixed> $consumer_context Read-only dependency values.
	 *
	 * @return array<string,mixed> Authorized presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$customer_journey = isset( $consumer_context['customer_journey']['customer_journey'] )
			&& is_scalar( $consumer_context['customer_journey']['customer_journey'] )
			? (string) $consumer_context['customer_journey']['customer_journey']
			: '';
		$has_saved_values      = ! empty( $consumer_context['_step_state']['has_saved_values'] );
		$is_journey_transition = WPBC_Setup_Wizard_Customer_Journey_Policy::has_pending_transition_for_step(
			isset( $consumer_context['_step_results'] ) && is_array( $consumer_context['_step_results'] )
				? $consumer_context['_step_results']
				: array(),
			$this->get_step_id()
		);

		// A newly saved journey owns the next Booking Form recommendation. Preserve
		// an explicitly saved template during ordinary revisits, but do not carry a
		// stale template across a deliberate restart from Customer Journey.
		if ( ! $has_saved_values || $is_journey_transition ) {
			$field_values['booking_form_template'] = $this->templates->get_recommended_template_slug( $customer_journey );
		}
		$template_context = $this->templates->get_context( $field_values, $customer_journey );
		$selected_slug    = isset( $template_context['values']['booking_form_template'] )
			? (string) $template_context['values']['booking_form_template']
			: '';
		$selected_usage   = isset( $template_context['values']['booking_form_usage'] )
			? (string) $template_context['values']['booking_form_usage']
			: '';
		$booking_form_context = $this->time_options->get_context_from_values( $consumer_context );
		$preview_result        = array();
		$preview_error         = '';

		if ( '' !== $selected_slug && 'direct_booking_form' === $selected_usage ) {
			$preview_result = $this->preview->build_preview(
				$selected_slug,
				$selected_usage,
				WPBC_Setup_Wizard_Booking_Form_Preview::TARGET_EMBEDDED,
				array(),
				$booking_form_context
			);

			if ( is_wp_error( $preview_result ) ) {
				$preview_error  = $preview_result->get_error_message();
				$preview_result = array();
			}
		}

		$step_dialogs = array(
			array(
				'dialog_id'     => 'wpbc-setup-wizard-booking-form-guidance-dialog',
				'action'        => 'booking-form-template-guidance',
				'title'         => __( 'Choose a starting template', 'booking' ),
				'description'   => __( 'This step selects a ready-made starting template for your booking form. It does not limit how you can customize the form.', 'booking' ),
				'details'       => array(
					__( 'Review the interactive preview, then choose the template that best matches your booking flow.', 'booking' ),
					__( 'After setup, open WP Booking Calendar > Settings > Forms Builder to add, remove, reorder, and configure your booking form fields.', 'booking' ),
				),
				'note'          => __( 'The selected template is applied only after you choose Update booking form & continue.', 'booking' ),
				'cancel_label'  => __( 'Close', 'booking' ),
				'confirm_label' => __( 'Got it', 'booking' ),
			),
		);

		if ( 'guided_appointment_flow' === $customer_journey ) {
			$step_dialogs[] = array(
				'dialog_id'     => 'wpbc-setup-wizard-appointment-flow-dialog',
				'action'        => 'booking-form-appointment-flow',
				'title'         => __( 'Use Appointment flow?', 'booking' ),
				'description'   => __( 'Before switching, review how Appointment flow uses the selected booking form:', 'booking' ),
				'details'       => array(
					__( 'The selected booking form must contain a Start Time field.', 'booking' ),
					__( 'Appointment flow uses the selected Service duration. Duration, End Time, and Time Range fields in the template are not shown, so customers cannot choose conflicting times.', 'booking' ),
					__( 'This preview lists only Services already saved and active on your site, together with their assigned Providers. Services prepared earlier in this setup draft are not shown until setup is applied.', 'booking' ),
				),
				'note'          => __( 'This remains a private preview. Switching the entry point does not publish Services, import the template, or replace an existing booking form.', 'booking' ),
				'cancel_label'  => __( 'Keep direct booking form', 'booking' ),
				'confirm_label' => __( 'Use Appointment flow', 'booking' ),
			);
		}

		$template_context['preview_kind']      = isset( $preview_result['preview_kind'] ) ? (string) $preview_result['preview_kind'] : '';
		$template_context['preview_html']      = isset( $preview_result['html'] ) ? (string) $preview_result['html'] : '';
		$template_context['preview_bootstrap'] = isset( $preview_result['bootstrap'] ) && is_array( $preview_result['bootstrap'] ) ? $preview_result['bootstrap'] : array();
		$template_context['preview_error']     = $preview_error;
		$template_context['dialogs']           = $step_dialogs;

		return $template_context;
	}

	/**
	 * Validate the selected stable Form Builder template slug.
	 *
	 * @param string $field_id    Stable field identifier.
	 * @param mixed  $raw_value   Untrusted template slug.
	 * @param bool   $is_required Whether an empty choice is invalid.
	 *
	 * @return string|WP_Error Normalized slug or an error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		if ( 'booking_form_template' === $field_id ) {
			return $this->templates->validate_template_slug( $raw_value, $is_required );
		}

		if ( 'booking_form_usage' === $field_id ) {
			return $this->templates->validate_booking_form_usage( $raw_value, $is_required );
		}

		return new WP_Error( 'wpbc_setup_wizard_booking_form_template_field_unknown', __( 'The Booking Form editor received an unsupported field.', 'booking' ) );
	}

	/**
	 * Revalidate the selected entry point against the active Customer Journey.
	 *
	 * Field validation owns the global usage allow-list. This contextual pass is
	 * the authoritative route boundary that prevents Appointment Flow from being
	 * submitted for time-based journeys even when a stale browser tab still
	 * contains the old radio value.
	 *
	 * @param array<string,mixed> $validated_values Validated module values.
	 * @param array<string,mixed> $consumer_context Read-only dependency values.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or a field-addressable error.
	 */
	public function validate_values_with_context( array $validated_values, array $consumer_context ) {
		$customer_journey = isset( $consumer_context['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $consumer_context['customer_journey']['customer_journey'] )
			: '';
		$booking_form_usage = isset( $validated_values['booking_form_usage'] )
			? $this->templates->validate_booking_form_usage_for_journey( $validated_values['booking_form_usage'], $customer_journey, true )
			: new WP_Error( 'wpbc_setup_wizard_booking_form_usage_required', __( 'Choose how customers will open the booking form.', 'booking' ) );

		if ( is_wp_error( $booking_form_usage ) ) {
			$message = $booking_form_usage->get_error_message();

			return new WP_Error(
				$booking_form_usage->get_error_code(),
				$message,
				array( 'field_errors' => array( 'booking_form_usage' => $message ) )
			);
		}

		$validated_values['booking_form_usage'] = $booking_form_usage;

		return $validated_values;
	}

	/**
	 * Enqueue compiled selector assets and translations.
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
		$script_dependencies = array( $shared_script_handle );

		if ( class_exists( 'WPBC_BFB_Preview_Service' ) ) {
			WPBC_BFB_Preview_Service::get_instance()->enqueue_inline_preview_assets();
			$script_dependencies[] = 'wpbc-bfb-inline-preview';
		}

		wp_enqueue_style( 'wpbc-setup-wizard-booking-form-template', $module_url . 'step-booking-form-template/_out/step-booking-form-template.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-booking-form-template', $module_url . 'step-booking-form-template/_out/step-booking-form-template.js', $script_dependencies, $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-booking-form-template',
			'wpbc_setup_wizard_booking_form_template',
			array(
				'ajax_url'       => admin_url( 'admin-ajax.php' ),
				'nonce'          => wp_create_nonce( WPBC_Setup_Wizard_Ajax::NONCE_ACTION ),
				'preview_action' => WPBC_Setup_Wizard_Booking_Form_Preview_Ajax::ACTION,
				'i18n' => array(
					'template_required'     => __( 'Choose a booking form template.', 'booking' ),
					'usage_required'        => __( 'Choose how customers will open the booking form.', 'booking' ),
					'no_matching_templates' => __( 'No templates match this search and filter.', 'booking' ),
					'preview_loading'       => __( 'Loading the interactive booking form preview.', 'booking' ),
					'preview_error'         => __( 'The interactive preview could not be loaded. Try refreshing it.', 'booking' ),
					'preview_open_error'    => __( 'The full-site preview could not be opened. Try again.', 'booking' ),
				),
			)
		);
	}
}

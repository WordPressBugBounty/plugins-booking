<?php
/**
 * Progressive save handler for the Setup Wizard Booking Form step.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Apply one allow-listed template to the Standard Booking Form.
 *
 * The owner-scoped Standard form is the idempotent Form Builder identity.
 * Repeated requests therefore replace the same published row, while retained
 * Guided Appointment additionally assigns the form to its saved Services.
	 * Other scheduled and full-day journeys intentionally keep the form independent
	 * of Appointment Services, because their routes do not contain a Services step.
 */
final class WPBC_Setup_Wizard_Booking_Form_Template_Save_Handler implements WPBC_Setup_Wizard_Step_Save_Handler {

	/** Canonical Form Builder identity updated by this Setup Wizard boundary. */
	const CANONICAL_FORM_SLUG = 'standard';

	/** @var WPBC_Setup_Wizard_Booking_Form_Templates */
	private $templates;

	/** @var WPBC_Setup_Wizard_Booking_Form_Time_Options */
	private $time_options;

	/**
	 * Build the handler around the server-owned template registry.
	 *
	 * @param WPBC_Setup_Wizard_Booking_Form_Templates|null    $templates    Optional registry adapter for tests.
	 * @param WPBC_Setup_Wizard_Booking_Form_Time_Options|null $time_options Optional time projector for tests.
	 */
	public function __construct( $templates = null, $time_options = null ) {
		$this->templates = $templates instanceof WPBC_Setup_Wizard_Booking_Form_Templates
			? $templates
			: new WPBC_Setup_Wizard_Booking_Form_Templates();
		$this->time_options = $time_options instanceof WPBC_Setup_Wizard_Booking_Form_Time_Options
			? $time_options
			: new WPBC_Setup_Wizard_Booking_Form_Time_Options();
	}

	/**
	 * Return the owned step identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'booking_form_template';
	}

	/**
	 * Describe whether the boundary creates or updates the Standard form.
	 *
	 * @param array<string,mixed> $checkpoint   Current checkpoint.
	 * @param array<string,mixed> $step_context Authorized presentation context.
	 *
	 * @return string Translated action label.
	 */
	public function get_primary_action_label( array $checkpoint, array $step_context = array() ) {
		unset( $checkpoint, $step_context );

		$owner_user_id = $this->get_owner_user_id();
		$existing_form = function_exists( 'wpbc_form_config_load' )
			? wpbc_form_config_load( self::CANONICAL_FORM_SLUG, $owner_user_id, 'published', false )
			: null;

		return is_array( $existing_form )
			? __( 'Update booking form & continue', 'booking' )
			: __( 'Create booking form & continue', 'booking' );
	}

	/**
	 * Revalidate and persist the selected form and any required Service assignments.
	 *
	 * @param array<string,mixed> $validated_fields  Validated current-step fields.
	 * @param array<string,mixed> $checkpoint        Current checkpoint.
	 * @param array<string,mixed> $operation_context Stable operation metadata.
	 *
	 * @return array<string,mixed>|WP_Error Verified result or error.
	 */
	public function save( array $validated_fields, array $checkpoint, array $operation_context ) {
		unset( $operation_context );

		$customer_journey_id = $this->get_customer_journey_id( $checkpoint );
		$is_guided_journey   = 'guided_appointment_flow' === $customer_journey_id;
		if ( ! WPBC_Setup_Wizard_Customer_Journey_Policy::uses_booking_form_and_appearance_route( $customer_journey_id ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_journey_invalid', __( 'A Booking Form cannot be created for the selected customer journey.', 'booking' ) );
		}
		$manage_capability = function_exists( 'wpbc_bfb_get_manage_cap' ) ? wpbc_bfb_get_manage_cap() : 'manage_options';
		if (
			! current_user_can( $manage_capability )
			|| ! function_exists( 'wpbc_form_config_load' )
			|| ! function_exists( 'wpbc_form_config_save' )
			|| ! class_exists( 'WPBC_BFB_Form_Storage' )
		) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_forbidden', __( 'You are not allowed to create or update this Booking Form.', 'booking' ) );
		}
		if ( $is_guided_journey && ! function_exists( 'wpbc_appointment_services_get_data_provider' ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_storage_unsupported', __( 'The configured Appointment Services storage does not support Booking Form assignment from the Setup Wizard.', 'booking' ) );
		}

		$template_slug = isset( $validated_fields['booking_form_template'] )
			? $this->templates->validate_template_slug( $validated_fields['booking_form_template'], true )
			: new WP_Error( 'wpbc_setup_wizard_booking_form_template_required', __( 'Choose a booking form template.', 'booking' ) );
		if ( is_wp_error( $template_slug ) ) {
			return $template_slug;
		}
		$booking_form_usage = isset( $validated_fields['booking_form_usage'] )
			? $this->templates->validate_booking_form_usage_for_journey( $validated_fields['booking_form_usage'], $customer_journey_id, true )
			: new WP_Error( 'wpbc_setup_wizard_booking_form_usage_required', __( 'Choose how customers will open the booking form.', 'booking' ) );
		if ( is_wp_error( $booking_form_usage ) ) {
			return $booking_form_usage;
		}

		$template_form_config = $this->templates->get_save_form_config( $template_slug );
		if ( is_wp_error( $template_form_config ) ) {
			return $template_form_config;
		}
		$wizard_values        = isset( $checkpoint['values'] ) && is_array( $checkpoint['values'] ) ? $checkpoint['values'] : array();
		$template_form_config = $this->time_options->apply_to_form_config(
			$template_form_config,
			$this->time_options->get_context_from_values( $wizard_values )
		);
		if ( is_wp_error( $template_form_config ) ) {
			return $template_form_config;
		}

		$owner_user_id         = $this->get_owner_user_id();
		$existing_form         = wpbc_form_config_load( self::CANONICAL_FORM_SLUG, $owner_user_id, 'published', false );
		$form_config           = $this->build_standard_form_config( $template_form_config, $existing_form, $owner_user_id );
		$service_ids           = array();
		$repository            = null;
		$service_before_images = array();
		if ( $is_guided_journey ) {
			$service_ids = $this->get_service_ids( $checkpoint );
			if ( empty( $service_ids ) ) {
				return new WP_Error( 'wpbc_setup_wizard_booking_form_services_missing', __( 'Save at least one Appointment Service before creating the Booking Form.', 'booking' ) );
			}

			$repository = wpbc_appointment_services_get_data_provider();
			if (
				! is_object( $repository )
				|| ! method_exists( $repository, 'get_deletion_before_image' )
				|| ! method_exists( $repository, 'update_booking_form_id' )
				|| ! method_exists( $repository, 'find' )
			) {
				return new WP_Error( 'wpbc_setup_wizard_booking_form_storage_unsupported', __( 'The configured Appointment Services storage does not support Booking Form assignment from the Setup Wizard.', 'booking' ) );
			}

			foreach ( $service_ids as $service_id ) {
				$before_image = $repository->get_deletion_before_image( $service_id );
				if ( is_wp_error( $before_image ) || ! $this->is_current_owner_service( $before_image ) ) {
					return new WP_Error( 'wpbc_setup_wizard_booking_form_service_stale', __( 'A saved Service changed or is no longer available. Return to Services and review it before continuing.', 'booking' ) );
				}
				$service_before_images[ $service_id ] = $before_image;
			}
		}

		$form_was_written = false;
		if ( is_array( $existing_form ) && $this->form_config_matches( $form_config, $existing_form ) ) {
			$booking_form_id = absint( $existing_form['id'] );
		} else {
			$booking_form_id = wpbc_form_config_save( $form_config, array( 'sync_legacy' => false ) );
			$form_was_written = true;
			if ( ! $booking_form_id ) {
				return new WP_Error( 'wpbc_setup_wizard_booking_form_not_saved', __( 'The Booking Form could not be saved.', 'booking' ) );
			}
		}

		foreach ( $service_before_images as $service_id => $before_image ) {
			if ( absint( $before_image['service']['booking_form_id'] ) === absint( $booking_form_id ) ) {
				continue;
			}
			$saved_service = $repository->update_booking_form_id( $service_id, $booking_form_id );
			if ( is_wp_error( $saved_service ) ) {
				$was_restored = $this->compensate( $repository, $existing_form, $form_config, $booking_form_id, $service_before_images, $form_was_written );
				$message      = $was_restored
					? __( 'The Booking Form could not be assigned to every Service. Previous values were restored.', 'booking' )
					: __( 'The Booking Form could not be assigned to every Service, and previous values could not be restored completely. Review Booking Forms and Services before continuing.', 'booking' );
				return new WP_Error( 'wpbc_setup_wizard_booking_form_assignment_failed', $message );
			}
		}

		$verified_form = wpbc_form_config_load( self::CANONICAL_FORM_SLUG, $owner_user_id, 'published', false );
		if (
			! is_array( $verified_form )
			|| absint( $verified_form['id'] ) !== absint( $booking_form_id )
			|| ! $this->form_config_matches( $form_config, $verified_form )
		) {
			$was_restored = $this->compensate( $repository, $existing_form, $form_config, $booking_form_id, $service_before_images, $form_was_written );
			$message      = $was_restored
				? __( 'The Booking Form could not be verified. Previous values were restored.', 'booking' )
				: __( 'The Booking Form could not be verified, and previous values could not be restored completely. Review Booking Forms and Services before continuing.', 'booking' );
			return new WP_Error( 'wpbc_setup_wizard_booking_form_not_verified', $message );
		}
		foreach ( $service_ids as $service_id ) {
			$verified_service = $repository->find( $service_id );
			if ( is_wp_error( $verified_service ) || absint( $verified_service['booking_form_id'] ) !== absint( $booking_form_id ) ) {
				$was_restored = $this->compensate( $repository, $existing_form, $form_config, $booking_form_id, $service_before_images, $form_was_written );
				$message      = $was_restored
					? __( 'The Booking Form assignment could not be verified. Previous values were restored.', 'booking' )
					: __( 'The Booking Form assignment could not be verified, and previous values could not be restored completely. Review Booking Forms and Services before continuing.', 'booking' );
				return new WP_Error( 'wpbc_setup_wizard_booking_form_assignment_not_verified', $message );
			}
		}

		if ( $is_guided_journey ) {
			$summary = is_array( $existing_form )
				? __( 'Standard Booking Form updated and assigned to Services.', 'booking' )
				: __( 'Standard Booking Form created and assigned to Services.', 'booking' );
		} else {
			$summary = is_array( $existing_form )
				? __( 'Standard Booking Form updated.', 'booking' )
				: __( 'Standard Booking Form created.', 'booking' );
		}

		return array(
			'status'                    => 'saved',
			'summary'                   => $summary,
			'canonical_fingerprint'     => hash( 'sha256', wp_json_encode( array( 'form' => $verified_form, 'source_template' => $template_slug, 'service_ids' => $service_ids, 'usage' => $booking_form_usage ) ) ),
			'created_ids'               => is_array( $existing_form ) ? array() : array( 'booking_form:' . self::CANONICAL_FORM_SLUG . ':' . absint( $booking_form_id ) ),
			'updated_ids'               => is_array( $existing_form ) ? array( 'booking_form:' . self::CANONICAL_FORM_SLUG . ':' . absint( $booking_form_id ) ) : array(),
			'warnings'                  => array(),
			'writes_canonical_settings' => true,
		);
	}

	/**
	 * Retarget a registered template payload to the canonical Standard form.
	 *
	 * Applying a template in the Form Builder replaces the current form's field
	 * structure and settings without changing that form's identity or its
	 * administrator-facing details. The Setup Wizard follows the same contract:
	 * template content is copied into `standard`, while an existing Standard
	 * title, description, and picture remain owned by the Form Details editor.
	 *
	 * @param array<string,mixed>      $template_form_config Server-owned template payload.
	 * @param array<string,mixed>|null $existing_form       Existing Standard FormConfig, if any.
	 * @param int                      $owner_user_id       Effective MultiUser owner ID.
	 *
	 * @return array<string,mixed> Canonical Standard FormConfig ready for persistence.
	 */
	private function build_standard_form_config( array $template_form_config, $existing_form, $owner_user_id ) {
		$existing_form = is_array( $existing_form ) ? $existing_form : array();

		$template_form_config['form_name']           = self::CANONICAL_FORM_SLUG;
		$template_form_config['owner_user_id']       = absint( $owner_user_id );
		$template_form_config['scope']               = $owner_user_id ? 'user' : 'global';
		$template_form_config['status']              = 'published';
		$template_form_config['is_default']          = 1;
		$template_form_config['booking_resource_id'] = null;
		$template_form_config['title']               = array_key_exists( 'title', $existing_form )
			? (string) $existing_form['title']
			: __( 'Standard', 'booking' );
		$template_form_config['description']         = array_key_exists( 'description', $existing_form )
			? (string) $existing_form['description']
			: '';
		$template_form_config['picture_url']         = array_key_exists( 'picture_url', $existing_form )
			? (string) $existing_form['picture_url']
			: '';

		return $template_form_config;
	}

	/**
	 * Restore form and Service before-images after a partial cross-domain write.
	 *
	 * @param WPBC_Appointment_Services_Repository|null $repository            Canonical Services repository when assignments exist.
	 * @param array<string,mixed>|null              $existing_form         Original FormConfig, or null for a created form.
	 * @param array<string,mixed>                   $attempted_form        Attempted FormConfig.
	 * @param int                                   $booking_form_id       Attempted canonical form ID.
	 * @param array<int,array<string,mixed>>         $service_before_images Original Service records.
	 * @param bool                                  $form_was_written      Whether this request changed FormConfig storage.
	 *
	 * @return bool True when every Service and form compensation write succeeds.
	 */
	private function compensate( $repository, $existing_form, array $attempted_form, $booking_form_id, array $service_before_images, $form_was_written ) {
		$was_restored = true;
		if ( ! empty( $service_before_images ) && ! is_object( $repository ) ) {
			return false;
		}
		foreach ( $service_before_images as $before_image ) {
			$service_id               = absint( $before_image['service']['service_id'] );
			$previous_booking_form_id = absint( $before_image['service']['booking_form_id'] );
			$restored_service         = $repository->update_booking_form_id( $service_id, $previous_booking_form_id );
			if ( is_wp_error( $restored_service ) || absint( $restored_service['booking_form_id'] ) !== $previous_booking_form_id ) {
				$was_restored = false;
			}
		}
		if ( ! $form_was_written ) {
			return $was_restored;
		}

		if ( is_array( $existing_form ) ) {
			$restored_form_id = wpbc_form_config_save( $existing_form, array( 'sync_legacy' => false ) );
			$restored_form    = wpbc_form_config_load( $existing_form['form_name'], $existing_form['owner_user_id'], $existing_form['status'], false );
			if ( ! $restored_form_id || ! is_array( $restored_form ) || ! $this->form_config_matches( $existing_form, $restored_form ) ) {
				$was_restored = false;
			}

			return $was_restored;
		}

		if ( ! WPBC_BFB_Form_Storage::delete_form_if_matches(
			$booking_form_id,
			$attempted_form['form_name'],
			$attempted_form['status'],
			$attempted_form['owner_user_id']
		) ) {
			$was_restored = false;
		} elseif ( is_array( wpbc_form_config_load( $attempted_form['form_name'], $attempted_form['owner_user_id'], $attempted_form['status'], false ) ) ) {
			$was_restored = false;
		}

		return $was_restored;
	}

	/**
	 * Compare the stable FormConfig fields owned by the selected template.
	 *
	 * Storage timestamps and the generated numeric ID are intentionally excluded.
	 * Form-style settings are global Appearance options and are stripped by the
	 * canonical Form Builder writer before the record is persisted.
	 *
	 * @param array<string,mixed> $expected Expected server-owned FormConfig.
	 * @param array<string,mixed> $actual   Canonical FormConfig readback.
	 *
	 * @return bool True when every persisted template field matches.
	 */
	private function form_config_matches( array $expected, array $actual ) {
		$expected_settings = isset( $expected['settings'] ) && is_array( $expected['settings'] ) ? $expected['settings'] : array();
		if ( function_exists( 'wpbc_bfb_settings__strip_form_style_options_from_form_settings' ) ) {
			$expected_settings = wpbc_bfb_settings__strip_form_style_options_from_form_settings( $expected_settings );
		}

		$expected_values = array(
			'form_name'           => isset( $expected['form_name'] ) ? (string) $expected['form_name'] : '',
			'owner_user_id'       => isset( $expected['owner_user_id'] ) ? absint( $expected['owner_user_id'] ) : 0,
			'engine'              => isset( $expected['engine'] ) ? (string) $expected['engine'] : 'bfb',
			'engine_version'      => isset( $expected['engine_version'] ) ? (string) $expected['engine_version'] : '1.0',
			'title'               => isset( $expected['title'] ) ? (string) $expected['title'] : '',
			'description'         => isset( $expected['description'] ) ? (string) $expected['description'] : '',
			'scope'               => isset( $expected['scope'] ) ? (string) $expected['scope'] : 'global',
			'status'              => isset( $expected['status'] ) ? (string) $expected['status'] : 'published',
			'is_default'          => ! empty( $expected['is_default'] ) ? 1 : 0,
			'booking_resource_id' => isset( $expected['booking_resource_id'] ) ? absint( $expected['booking_resource_id'] ) : null,
			'structure_json'      => isset( $expected['structure_json'] ) ? (string) $expected['structure_json'] : '',
			'settings'            => $expected_settings,
			'advanced_form'       => isset( $expected['advanced_form'] ) ? (string) $expected['advanced_form'] : '',
			'content_form'        => isset( $expected['content_form'] ) ? (string) $expected['content_form'] : '',
			'picture_url'         => isset( $expected['picture_url'] ) ? (string) $expected['picture_url'] : '',
		);
		$actual_values = array(
			'form_name'           => isset( $actual['form_name'] ) ? (string) $actual['form_name'] : '',
			'owner_user_id'       => isset( $actual['owner_user_id'] ) ? absint( $actual['owner_user_id'] ) : 0,
			'engine'              => isset( $actual['engine'] ) ? (string) $actual['engine'] : 'bfb',
			'engine_version'      => isset( $actual['engine_version'] ) ? (string) $actual['engine_version'] : '1.0',
			'title'               => isset( $actual['title'] ) ? (string) $actual['title'] : '',
			'description'         => isset( $actual['description'] ) ? (string) $actual['description'] : '',
			'scope'               => isset( $actual['scope'] ) ? (string) $actual['scope'] : 'global',
			'status'              => isset( $actual['status'] ) ? (string) $actual['status'] : 'published',
			'is_default'          => ! empty( $actual['is_default'] ) ? 1 : 0,
			'booking_resource_id' => isset( $actual['booking_resource_id'] ) ? absint( $actual['booking_resource_id'] ) : null,
			'structure_json'      => isset( $actual['structure_json'] ) ? (string) $actual['structure_json'] : '',
			'settings'            => isset( $actual['settings'] ) && is_array( $actual['settings'] ) ? $actual['settings'] : array(),
			'advanced_form'       => isset( $actual['advanced_form'] ) ? (string) $actual['advanced_form'] : '',
			'content_form'        => isset( $actual['content_form'] ) ? (string) $actual['content_form'] : '',
			'picture_url'         => isset( $actual['picture_url'] ) ? (string) $actual['picture_url'] : '',
		);

		return $expected_values === $actual_values;
	}

	/**
	 * Resolve stable Service IDs from the saved draft and retained result map.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return int[] Owner-visible Service IDs.
	 */
	private function get_service_ids( array $checkpoint ) {
		$result   = isset( $checkpoint['step_results']['services'] ) && is_array( $checkpoint['step_results']['services'] ) ? $checkpoint['step_results']['services'] : array();
		$stored   = array_merge( isset( $result['created_ids'] ) ? (array) $result['created_ids'] : array(), isset( $result['updated_ids'] ) ? (array) $result['updated_ids'] : array() );
		$mappings = array();
		foreach ( $stored as $mapping ) {
			if ( is_scalar( $mapping ) && preg_match( '/^service:([a-z0-9_-]{1,64}):([0-9]+)$/', (string) $mapping, $matches ) ) {
				$mappings[ $matches[1] ] = absint( $matches[2] );
			}
		}

		$service_ids = array();
		$services    = isset( $checkpoint['values']['services']['services'] ) && is_array( $checkpoint['values']['services']['services'] )
			? $checkpoint['values']['services']['services']
			: array();
		foreach ( $services as $service ) {
			$draft_id  = isset( $service['draft_id'] ) ? sanitize_key( (string) $service['draft_id'] ) : '';
			$service_id = isset( $service['source_service_id'] ) ? absint( $service['source_service_id'] ) : 0;
			if ( ! $service_id && isset( $mappings[ $draft_id ] ) ) {
				$service_id = absint( $mappings[ $draft_id ] );
			}
			if ( $service_id ) {
				$service_ids[] = $service_id;
			}
		}

		return array_values( array_unique( $service_ids ) );
	}

	/**
	 * Resolve the current Form Builder owner without trusting request data.
	 *
	 * @return int Current MultiUser owner ID, or zero for global scope.
	 */
	private function get_owner_user_id() {
		if ( function_exists( 'wpbc_appointment_services_get_owner_user_id' ) ) {
			return absint( wpbc_appointment_services_get_owner_user_id() );
		}

		return class_exists( 'WPBC_FE_Custom_Form_Helper' ) && method_exists( 'WPBC_FE_Custom_Form_Helper', 'wpbc_mu__get_current__owner_user_id' )
			? absint( WPBC_FE_Custom_Form_Helper::wpbc_mu__get_current__owner_user_id() )
			: 0;
	}

	/**
	 * Confirm that one assignment target belongs to the FormConfig owner.
	 *
	 * @param array<string,mixed> $before_image Canonical Service before-image.
	 *
	 * @return bool True when the Service and Booking Form share one owner scope.
	 */
	private function is_current_owner_service( array $before_image ) {
		$service = isset( $before_image['service'] ) && is_array( $before_image['service'] ) ? $before_image['service'] : array();

		return isset( $service['owner_user_id'] ) && $this->get_owner_user_id() === absint( $service['owner_user_id'] );
	}

	/**
	 * Read the saved Customer Journey.
	 *
	 * @param array<string,mixed> $checkpoint Current checkpoint.
	 *
	 * @return string Journey ID.
	 */
	private function get_customer_journey_id( array $checkpoint ) {
		return isset( $checkpoint['values']['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $checkpoint['values']['customer_journey']['customer_journey'] )
			: '';
	}

	/**
	 * Booking Form is not the terminal route step.
	 *
	 * @return bool False.
	 */
	public function is_terminal() {
		return false;
	}
}

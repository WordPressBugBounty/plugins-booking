<?php
/**
 * Setup Wizard module adapter for progressive publishing choices.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Expose publishing configuration through the common Setup Wizard module contract.
 */
final class WPBC_Setup_Wizard_Publish_Integration_Module implements WPBC_Setup_Wizard_Step_Module, WPBC_Setup_Wizard_Step_Values_Validator, WPBC_Setup_Wizard_Contextual_Values_Validator, WPBC_Setup_Wizard_Conditional_Step_Module {

	/** @var WPBC_Setup_Wizard_Publish_Integration */
	private $publish_integration;

	/**
	 * Build the module around the publishing service.
	 *
	 * @param WPBC_Setup_Wizard_Publish_Integration|null $publish_integration Optional service for testing.
	 */
	public function __construct( $publish_integration = null ) {
		$this->publish_integration = $publish_integration instanceof WPBC_Setup_Wizard_Publish_Integration
			? $publish_integration
			: new WPBC_Setup_Wizard_Publish_Integration();
	}

	/**
	 * Return the stable module identifier.
	 *
	 * @return string Stable step ID.
	 */
	public function get_step_id() {
		return 'publish_integration';
	}

	/**
	 * Return rail and template metadata.
	 *
	 * @return array{id:string,label:string,template:string,footer_note:string} Step definition.
	 */
	public function get_step_definition() {
		return array(
			'id'          => $this->get_step_id(),
			'label'       => __( 'Publish & integrate', 'booking' ),
			'template'    => 'step-publish-integration',
			'footer_note' => __( 'Your publishing choice is saved when you continue. Back only navigates and does not undo a completed page update.', 'booking' ),
		);
	}

	/**
	 * Return the server-owned template path.
	 *
	 * @return string Absolute template path.
	 */
	public function get_template_path() {
		return __DIR__ . '/template.php';
	}

	/**
	 * Return fields accepted by this step.
	 *
	 * @return string[] Ordered field allow-list.
	 */
	public function get_field_names() {
		return array(
			'publish_destination',
			'publish_page_title',
			'publish_existing_page_id',
			'publish_page_content',
		);
	}

	/**
	 * Return fields required for a complete forward navigation request.
	 *
	 * Conditional meaning is enforced after all scalar fields are normalized.
	 * The existing-page ID uses zero as the safe non-selected placeholder.
	 *
	 * @return string[] Required field IDs.
	 */
	public function get_required_fields() {
		return array( 'publish_destination' );
	}

	/**
	 * Return safe initial suggestions.
	 *
	 * @return array<string,mixed> Initial draft values.
	 */
	public function get_initial_values() {
		return array(
			'publish_destination'      => $this->publish_integration->get_initial_destination(),
			'publish_page_title'       => '',
			'publish_existing_page_id' => 0,
			'publish_page_content'     => WPBC_Setup_Wizard_Publish_Integration::CONTENT_RECOMMENDED,
		);
	}

	/**
	 * Return earlier step values needed for journey-aware shortcode generation.
	 *
	 * @return string[] Dependency step IDs.
	 */
	public function get_context_dependencies() {
		return array( 'customer_journey', 'booking_form_template' );
	}

	/**
	 * Determine whether this step belongs to the current site route.
	 *
	 * @param array<string,mixed> $consumer_context Unused route context.
	 *
	 * @return bool False for live-demo websites.
	 */
	public function is_available( array $consumer_context = array() ) {
		unset( $consumer_context );

		return $this->publish_integration->is_available();
	}

	/**
	 * Build the authorized presentation context for the page.
	 *
	 * @param array<string,mixed> $field_values     Validated module values.
	 * @param array<string,mixed> $consumer_context Read-only prior-step values.
	 *
	 * @return array<string,mixed> Presentation context.
	 */
	public function get_context( array $field_values, array $consumer_context = array() ) {
		$customer_journey = $this->get_dependency_value( $consumer_context, 'customer_journey', 'customer_journey' );
		$form_slug        = $this->get_dependency_value( $consumer_context, 'booking_form_template', 'booking_form_template' );
		$pages            = $this->publish_integration->get_publishable_pages();
		$destinations     = $this->publish_integration->get_destination_options( $pages );
		$content_options  = $this->publish_integration->get_content_options( $customer_journey, $form_slug );
		$insertion_help   = $this->publish_integration->get_shortcode_insertion_help();
		$content_ids      = wp_list_pluck( $content_options, 'id' );
		$recommended_id   = $this->publish_integration->get_recommended_content_id( $customer_journey );
		$destination_ids  = array();

		foreach ( $destinations as $destination ) {
			if ( ! empty( $destination['is_enabled'] ) ) {
				$destination_ids[] = (string) $destination['id'];
			}
		}

		$selected_destination = isset( $field_values['publish_destination'] ) ? (string) $field_values['publish_destination'] : '';
		if ( ! in_array( $selected_destination, $destination_ids, true ) ) {
			$selected_destination = $this->publish_integration->get_initial_destination();
		}

		$selected_content = isset( $field_values['publish_page_content'] ) ? (string) $field_values['publish_page_content'] : '';
		if ( WPBC_Setup_Wizard_Publish_Integration::CONTENT_RECOMMENDED === $selected_content || ! in_array( $selected_content, $content_ids, true ) ) {
			$selected_content = $recommended_id;
		}

		$page_title               = isset( $field_values['publish_page_title'] ) ? (string) $field_values['publish_page_title'] : '';
		$has_unsaved_legacy_title = ! $this->has_saved_publish_result( $consumer_context )
			&& 'guided_appointment_flow' !== $customer_journey
			&& __( 'Book an appointment', 'booking' ) === $page_title;

		if ( '' === trim( $page_title ) || $has_unsaved_legacy_title ) {
			$page_title = $this->publish_integration->get_initial_page_title( $customer_journey );
		}

		$existing_page_id        = isset( $field_values['publish_existing_page_id'] ) ? absint( $field_values['publish_existing_page_id'] ) : 0;
		$selected_page            = $this->find_page( $pages, $existing_page_id );
		$selected_content_record = $this->find_content( $content_options, $selected_content );
		$page_url                = '';

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $selected_destination ) {
			$page_url = $this->publish_integration->get_new_page_url_preview( $page_title );
		} elseif ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE === $selected_destination && ! empty( $selected_page['url'] ) ) {
			$page_url = (string) $selected_page['url'];
		}

		return array(
			'values' => array(
				'publish_destination'      => $selected_destination,
				'publish_page_title'       => $page_title,
				'publish_existing_page_id' => $existing_page_id,
				'publish_page_content'     => $selected_content,
			),
			'destinations'             => $destinations,
			'pages'                    => $pages,
			'content_options'          => $content_options,
			'selected_content'         => $selected_content_record,
			'insertion_help'           => $insertion_help,
			'page_url'                 => $page_url,
			'home_path'                => $this->publish_integration->get_home_path(),
			'customer_journey'         => $customer_journey,
			'has_created_page'          => $this->has_created_page_result( $consumer_context ),
		);
	}

	/**
	 * Validate one allow-listed field.
	 *
	 * @param string $field_id    Stable field ID.
	 * @param mixed  $raw_value   Untrusted field value.
	 * @param bool   $is_required Whether an empty value is invalid.
	 *
	 * @return mixed|WP_Error Normalized value or validation error.
	 */
	public function validate_field( $field_id, $raw_value, $is_required ) {
		switch ( $field_id ) {
			case 'publish_destination':
				return $this->publish_integration->validate_destination( $raw_value, $is_required );

			case 'publish_page_title':
				return $this->publish_integration->validate_page_title( $raw_value, $is_required );

			case 'publish_existing_page_id':
				return $this->publish_integration->validate_page_id( $raw_value );

			case 'publish_page_content':
				return $this->publish_integration->validate_content( $raw_value, $is_required );
		}

		return new WP_Error( 'wpbc_setup_wizard_publish_field_unknown', __( 'The publishing step received an unsupported field.', 'booking' ) );
	}

	/**
	 * Preserve normalized values before contextual validation.
	 *
	 * @param array<string,mixed> $validated_values Individually normalized fields.
	 *
	 * @return array<string,mixed> Unchanged normalized fields.
	 */
	public function validate_values( array $validated_values ) {
		return $validated_values;
	}

	/**
	 * Validate relationships to the selected journey and current WordPress pages.
	 *
	 * @param array<string,mixed> $validated_values Normalized current-step fields.
	 * @param array<string,mixed> $consumer_context Normalized dependency values.
	 *
	 * @return array<string,mixed>|WP_Error Validated values or field errors.
	 */
	public function validate_values_with_context( array $validated_values, array $consumer_context ) {
		$field_errors      = array();
		$destination       = isset( $validated_values['publish_destination'] ) ? (string) $validated_values['publish_destination'] : '';
		$customer_journey = $this->get_dependency_value( $consumer_context, 'customer_journey', 'customer_journey' );
		$form_slug        = $this->get_dependency_value( $consumer_context, 'booking_form_template', 'booking_form_template' );
		$content_options  = $this->publish_integration->get_content_options( $customer_journey, $form_slug );
		$content_ids      = wp_list_pluck( $content_options, 'id' );
		$content_id       = isset( $validated_values['publish_page_content'] ) ? (string) $validated_values['publish_page_content'] : '';

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_LATER !== $destination && '' === $content_id ) {
			$field_errors['publish_page_content'] = __( 'Choose the booking experience to display.', 'booking' );
		} elseif ( WPBC_Setup_Wizard_Publish_Integration::CONTENT_RECOMMENDED === $content_id ) {
			$validated_values['publish_page_content'] = $this->publish_integration->get_recommended_content_id( $customer_journey );
		} elseif ( '' !== $content_id && ! in_array( $content_id, $content_ids, true ) ) {
			$field_errors['publish_page_content'] = __( 'Choose booking page content compatible with the selected customer journey.', 'booking' );
		}

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination ) {
			$page_title = isset( $validated_values['publish_page_title'] ) ? trim( (string) $validated_values['publish_page_title'] ) : '';
			if ( '' === $page_title ) {
				$field_errors['publish_page_title'] = __( 'Enter a page title.', 'booking' );
			}
		}

		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE === $destination ) {
			$page_id = isset( $validated_values['publish_existing_page_id'] ) ? absint( $validated_values['publish_existing_page_id'] ) : 0;
			if ( ! $page_id || ! $this->publish_integration->is_authorized_page( $page_id, $this->publish_integration->get_publishable_pages() ) ) {
				$field_errors['publish_existing_page_id'] = __( 'Choose a WordPress page you are allowed to edit.', 'booking' );
			}
		}

		if ( ! empty( $field_errors ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_publish_validation_failed',
				__( 'Review the publishing choices before continuing.', 'booking' ),
				array( 'field_errors' => $field_errors )
			);
		}

		return $validated_values;
	}

	/**
	 * Enqueue compiled assets for the publishing page.
	 *
	 * @param string       $module_url           Setup Wizard module URL.
	 * @param string|false $asset_version        Plugin version.
	 * @param string       $shared_style_handle  Shared wizard stylesheet handle.
	 * @param string       $shared_script_handle Shared wizard script handle.
	 *
	 * @return void
	 */
	public function enqueue_assets( $module_url, $asset_version, $shared_style_handle, $shared_script_handle ) {
		$module_url = trailingslashit( $module_url );

		wp_enqueue_style( 'wpbc-setup-wizard-publish-integration', $module_url . 'step-publish-integration/_out/step-publish-integration.css', array( $shared_style_handle ), $asset_version );
		wp_enqueue_script( 'wpbc-setup-wizard-publish-integration', $module_url . 'step-publish-integration/_out/step-publish-integration.js', array( $shared_script_handle, 'wp-url' ), $asset_version, true );
		wp_localize_script(
			'wpbc-setup-wizard-publish-integration',
			'wpbc_setup_wizard_publish_integration',
			array(
				'i18n' => array(
					'copied'          => __( 'Copied to the clipboard.', 'booking' ),
					'copy_failed'     => __( 'Copy failed. Select the text and copy it manually.', 'booking' ),
					'action_create'   => __( 'Create page & continue', 'booking' ),
					'action_update'   => __( 'Update page & continue', 'booking' ),
					'action_save'     => __( 'Save & continue', 'booking' ),
					'title_required'  => __( 'Enter a page title.', 'booking' ),
					'page_required'   => __( 'Choose a WordPress page.', 'booking' ),
					'content_required' => __( 'Choose the booking experience to display.', 'booking' ),
					'notice_create'   => __( 'Save creates this WordPress page now. Repeating the save updates the same Setup Wizard page instead of creating a duplicate.', 'booking' ),
					'notice_existing' => __( 'Save adds or updates one managed Booking Calendar block without replacing the page\'s other content.', 'booking' ),
					'notice_manual'   => __( 'Save records this shortcode for the setup summary. No WordPress page is created or changed.', 'booking' ),
					'notice_later'    => __( 'No page will be created or changed. You can integrate the booking experience later.', 'booking' ),
				),
			)
		);
	}

	/**
	 * Determine whether this wizard checkpoint retains a created page mapping.
	 *
	 * The browser uses this read-only hint only to choose between the translated
	 * Create and Update action labels. The save handler independently revalidates
	 * the mapped page and remains authoritative for the mutation.
	 *
	 * @param array<string,mixed> $consumer_context Read-only prior-step values and save results.
	 *
	 * @return bool True when the publishing result contains a created-page identifier.
	 */
	private function has_created_page_result( array $consumer_context ) {
		$step_result = isset( $consumer_context['_step_results']['publish_integration'] ) && is_array( $consumer_context['_step_results']['publish_integration'] )
			? $consumer_context['_step_results']['publish_integration']
			: array();
		$identifiers = array_merge(
			isset( $step_result['created_ids'] ) ? (array) $step_result['created_ids'] : array(),
			isset( $step_result['updated_ids'] ) ? (array) $step_result['updated_ids'] : array()
		);

		foreach ( $identifiers as $identifier ) {
			if ( is_scalar( $identifier ) && preg_match( '/^wp_page_created:[0-9]+$/', (string) $identifier ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Determine whether publishing values already crossed the canonical save boundary.
	 *
	 * Unfinished pre-update drafts may still contain the former universal
	 * appointment title. Only an unsaved draft may receive the improved
	 * journey-aware suggestion; saved user choices remain untouched.
	 *
	 * @param array<string,mixed> $consumer_context Read-only prior-step values and save results.
	 *
	 * @return bool True after a verified Publish & integrate save.
	 */
	private function has_saved_publish_result( array $consumer_context ) {
		$step_result = isset( $consumer_context['_step_results']['publish_integration'] ) && is_array( $consumer_context['_step_results']['publish_integration'] )
			? $consumer_context['_step_results']['publish_integration']
			: array();

		return 'saved' === ( isset( $step_result['status'] ) ? $step_result['status'] : '' );
	}

	/**
	 * Read one scalar value from an allow-listed dependency step.
	 *
	 * @param array<string,mixed> $consumer_context Dependency values keyed by step.
	 * @param string              $step_id          Dependency step ID.
	 * @param string              $field_id         Dependency field ID.
	 *
	 * @return string Sanitized scalar value or an empty string.
	 */
	private function get_dependency_value( array $consumer_context, $step_id, $field_id ) {
		if ( ! isset( $consumer_context[ $step_id ][ $field_id ] ) || ! is_scalar( $consumer_context[ $step_id ][ $field_id ] ) ) {
			return '';
		}

		return sanitize_text_field( (string) $consumer_context[ $step_id ][ $field_id ] );
	}

	/**
	 * Find one page presentation record by ID.
	 *
	 * @param array<int,array<string,mixed>> $pages   Authorized page records.
	 * @param int                            $page_id Selected page ID.
	 *
	 * @return array<string,mixed> Matching record or an empty array.
	 */
	private function find_page( array $pages, $page_id ) {
		foreach ( $pages as $page ) {
			if ( isset( $page['id'] ) && absint( $page['id'] ) === absint( $page_id ) ) {
				return $page;
			}
		}

		return array();
	}

	/**
	 * Find one content presentation record by stable ID.
	 *
	 * @param array<int,array<string,string>> $content_options Content records.
	 * @param string                          $content_id      Selected content ID.
	 *
	 * @return array<string,string> Matching record or an empty array.
	 */
	private function find_content( array $content_options, $content_id ) {
		foreach ( $content_options as $content_option ) {
			if ( isset( $content_option['id'] ) && $content_id === $content_option['id'] ) {
				return $content_option;
			}
		}

		return array();
	}
}

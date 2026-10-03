<?php
/**
 * Read-only Form Builder template catalog for Setup Wizard Page 10.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adapt the bundled Form Builder registry to presentation and preview DTOs.
 *
 * Browser responses receive only catalog metadata, sanitized rendered preview
 * HTML, or a short-lived preview URL. Executable template definitions stay
 * server-side and are resolved from the current registry allow-list for every
 * preview request.
 */
final class WPBC_Setup_Wizard_Booking_Form_Templates {

	/**
	 * Normalized template DTOs cached for the current request.
	 *
	 * The established Form Builder registry loads every template definition when
	 * it is called. Step initialization, rendering, and validation can all need
	 * the same catalog, so retaining the normalized records avoids repeating that
	 * work without persisting or sharing registry state between requests.
	 *
	 * @var array<string,array<int,array<string,mixed>>>
	 */
	private $templates_cache = array();

	/**
	 * Server-owned normalized registry records cached for this request only.
	 *
	 * @var array<string,array<string,mixed>>|null
	 */
	private $registry_records_cache = null;

	/**
	 * Return the presentation context for the template selector.
	 *
	 * @param array<string,mixed> $step_values      Validated values for this module.
	 * @param string              $customer_journey Selected customer journey ID.
	 *
	 * @return array<string,mixed> Data-only selector context.
	 */
	public function get_context( array $step_values, $customer_journey ) {
		$templates       = $this->get_templates( $customer_journey );
		$selected_slug   = isset( $step_values['booking_form_template'] ) && is_scalar( $step_values['booking_form_template'] )
			? sanitize_title( (string) $step_values['booking_form_template'] )
			: '';
		$booking_form_usage = isset( $step_values['booking_form_usage'] )
			? $this->validate_booking_form_usage_for_journey( $step_values['booking_form_usage'], $customer_journey, false )
			: $this->get_initial_booking_form_usage();
		$available_slugs = wp_list_pluck( $templates, 'slug' );

		if ( ! in_array( $selected_slug, $available_slugs, true ) ) {
			$selected_slug = $this->get_recommended_template_slug( $customer_journey );
		}
		if ( is_wp_error( $booking_form_usage ) || '' === $booking_form_usage ) {
			$booking_form_usage = $this->get_initial_booking_form_usage();
		}

		return array(
			'values'            => array(
				'booking_form_template' => $selected_slug,
				'booking_form_usage'    => $booking_form_usage,
			),
			'templates'         => $templates,
			'filters'           => $this->get_filter_records( $templates ),
			'usage_options'     => $this->get_booking_form_usage_options( $customer_journey ),
			'selected_template' => $this->find_template( $templates, $selected_slug ),
			'customer_journey'  => is_scalar( $customer_journey ) ? sanitize_key( (string) $customer_journey ) : '',
			'preview_is_static' => false,
		);
	}

	/**
	 * Build a normalized, non-persistent preview payload for one allow-listed template.
	 *
	 * The returned form definitions are passed directly to the shared Form Builder
	 * preview service, which applies the canonical source sanitizers before either
	 * request-local rendering or transient preview storage. They are never returned
	 * to the browser as raw source and are never saved as a Form Builder form record.
	 *
	 * @param mixed $raw_template_slug Untrusted or stored template slug.
	 *
	 * @return array<string,mixed>|WP_Error Preview payload or validation error.
	 */
	public function get_preview_payload( $raw_template_slug ) {
		$template_slug = $this->validate_template_slug( $raw_template_slug, true );
		if ( is_wp_error( $template_slug ) ) {
			return $template_slug;
		}

		$registry_records = $this->get_registry_records();
		if ( ! isset( $registry_records[ $template_slug ]['record'] ) || ! is_array( $registry_records[ $template_slug ]['record'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_preview_missing', __( 'The selected booking form template is no longer available.', 'booking' ) );
		}

		$record         = $registry_records[ $template_slug ]['record'];
		$structure_json = isset( $record['structure_json'] ) && is_scalar( $record['structure_json'] ) ? (string) $record['structure_json'] : '';
		$structure      = json_decode( $structure_json, true );
		$structure      = is_array( $structure ) ? $structure : array();
		$advanced_form  = isset( $record['advanced_form'] ) && is_scalar( $record['advanced_form'] ) ? (string) $record['advanced_form'] : '';
		$content_form   = isset( $record['content_form'] ) && is_scalar( $record['content_form'] ) ? (string) $record['content_form'] : '';

		if ( empty( $structure ) && '' === trim( $advanced_form ) && '' === trim( $content_form ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_preview_empty', __( 'This booking form template does not contain previewable form data.', 'booking' ) );
		}

		return array(
			'template_slug' => $template_slug,
			'form_name'     => $template_slug,
			'structure'     => $structure,
			'advanced_form' => $advanced_form,
			'content_form'  => $content_form,
		);
	}

	/**
	 * Build the canonical Form Builder configuration for an allow-listed template.
	 *
	 * The registry remains the only source of executable form definitions. The
	 * browser supplies only the stable slug, which is revalidated before the
	 * server-owned record is converted into the canonical FormConfig contract.
	 * Ownership and publication scope are added by the progressive save handler.
	 *
	 * @param mixed $raw_template_slug Untrusted or stored template slug.
	 *
	 * @return array<string,mixed>|WP_Error Canonical save configuration or error.
	 */
	public function get_save_form_config( $raw_template_slug ) {
		$template_slug = $this->validate_template_slug( $raw_template_slug, true );
		if ( is_wp_error( $template_slug ) ) {
			return $template_slug;
		}

		$registry_records = $this->get_registry_records();
		if ( ! isset( $registry_records[ $template_slug ]['record'] ) || ! is_array( $registry_records[ $template_slug ]['record'] ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_template_missing', __( 'The selected booking form template is no longer available.', 'booking' ) );
		}

		$record         = $registry_records[ $template_slug ]['record'];
		$structure_json = isset( $record['structure_json'] ) && is_scalar( $record['structure_json'] ) ? (string) $record['structure_json'] : '';
		$structure      = json_decode( $structure_json, true );
		if ( ! is_array( $structure ) || empty( $structure ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_template_structure_invalid', __( 'The selected booking form template cannot be saved because its structure is invalid.', 'booking' ) );
		}

		$settings = array();
		if ( isset( $record['settings_json'] ) && is_scalar( $record['settings_json'] ) && '' !== (string) $record['settings_json'] ) {
			$decoded_settings = json_decode( (string) $record['settings_json'], true );
			$settings         = is_array( $decoded_settings ) ? $decoded_settings : array();
		}

		return array(
			'form_name'           => $template_slug,
			'engine'              => isset( $record['engine'] ) ? sanitize_key( (string) $record['engine'] ) : 'bfb',
			'engine_version'      => isset( $record['engine_version'] ) ? sanitize_text_field( (string) $record['engine_version'] ) : '1.0',
			'title'               => isset( $record['title'] ) ? sanitize_text_field( (string) $record['title'] ) : $template_slug,
			'description'         => isset( $record['description'] ) ? sanitize_textarea_field( (string) $record['description'] ) : '',
			'structure_json'      => wp_json_encode( $structure ),
			'settings'            => $settings,
			'advanced_form'       => isset( $record['advanced_form'] ) && is_scalar( $record['advanced_form'] ) ? (string) $record['advanced_form'] : '',
			'content_form'        => isset( $record['content_form'] ) && is_scalar( $record['content_form'] ) ? (string) $record['content_form'] : '',
			'picture_url'         => isset( $record['picture_url'] ) ? esc_url_raw( (string) $record['picture_url'] ) : '',
			'is_default'          => 0,
			'booking_resource_id' => null,
			'status'              => 'published',
		);
	}

	/**
	 * Build an inline-only preview payload for one allow-listed template.
	 *
	 * Request-local previews cannot run the complete hint-calculation lifecycle,
	 * so their dynamic hint shortcodes are replaced before rendering. Signed
	 * iframe and new-window previews continue to use {@see get_preview_payload()}
	 * and therefore retain the normal hint behavior.
	 *
	 * @param mixed $raw_template_slug Untrusted or stored template slug.
	 *
	 * @return array<string,mixed>|WP_Error Inline preview payload or validation error.
	 */
	public function get_inline_preview_payload( $raw_template_slug ) {
		$preview_payload = $this->get_preview_payload( $raw_template_slug );
		if ( is_wp_error( $preview_payload ) ) {
			return $preview_payload;
		}

		$preview_payload['advanced_form'] = $this->replace_dynamic_hints_for_preview( $preview_payload['advanced_form'] );

		return $preview_payload;
	}

	/**
	 * Replace dynamic hint shortcodes with an explicit static preview value.
	 *
	 * Request-local Setup Wizard previews intentionally do not calculate date,
	 * time, capacity, or cost hints. Replacing the server-owned template
	 * shortcodes before the canonical renderer runs prevents it from creating
	 * `.wpbc_field_hint` elements, so the existing Free and Pro clients skip
	 * their legacy hint AJAX requests. Signed iframe and published booking forms
	 * retain the original shortcodes and their complete hint lifecycle.
	 *
	 * @param string $advanced_form Sanitized later by the shared preview service.
	 *
	 * @return string Preview form source with dynamic hints replaced by static text.
	 */
	private function replace_dynamic_hints_for_preview( $advanced_form ) {
		if ( '' === trim( $advanced_form ) ) {
			return $advanced_form;
		}

		$dynamic_hint_shortcodes = array(
			'[additional_cost_hint]',
			'[balance_hint]',
			'[cancel_date_hint]',
			'[capacity_hint]',
			'[check_in_date_hint]',
			'[check_out_date_hint]',
			'[check_out_plus1day_hint]',
			'[cost_hint]',
			'[coupon_discount_hint]',
			'[days_number_hint]',
			'[deposit_hint]',
			'[end_time_hint]',
			'[estimate_day_cost_hint]',
			'[estimate_night_cost_hint]',
			'[nights_number_hint]',
			'[original_cost_hint]',
			'[pre_checkin_date_hint]',
			'[resource_title_hint]',
			'[selected_dates_hint]',
			'[selected_short_dates_hint]',
			'[selected_short_timedates_hint]',
			'[selected_timedates_hint]',
			'[service_title_hint]',
			'[start_time_hint]',
		);
		$preview_value = sprintf(
			'<span class="wpbc_setup_wizard__preview-static-hint">%s</span>',
			esc_html__( 'Preview only', 'booking' )
		);

		return str_replace(
			$dynamic_hint_shortcodes,
			array_fill( 0, count( $dynamic_hint_shortcodes ), $preview_value ),
			$advanced_form
		);
	}

	/**
	 * Return the preferred initial template slug without writing Form Builder data.
	 *
	 * @return string Stable template slug, or an empty string when unavailable.
	 */
	public function get_initial_template_slug() {
		return $this->get_default_template_slug( $this->get_templates( 'guided_appointment_flow' ) );
	}

	/**
	 * Return the first recommended template for one Customer Journey.
	 *
	 * This is a presentation default only. The consuming module preserves a
	 * saved choice during ordinary revisits and reapplies this recommendation
	 * only after Customer Journey is explicitly saved again.
	 *
	 * @param string $customer_journey Stable Customer Journey identifier.
	 *
	 * @return string Recommended template slug, or the general default.
	 */
	public function get_recommended_template_slug( $customer_journey ) {
		$templates          = $this->get_templates( $customer_journey );
		$recommended_slugs = $this->get_recommended_template_slugs( $customer_journey );

		foreach ( $recommended_slugs as $recommended_slug ) {
			foreach ( $templates as $template ) {
				if ( $recommended_slug === ( isset( $template['slug'] ) ? (string) $template['slug'] : '' ) ) {
					return $recommended_slug;
				}
			}
		}

		return $this->get_initial_template_slug();
	}

	/**
	 * Return the initial public entry point used by the selected template.
	 *
	 * Direct rendering is the safest initial preview because it shows the exact
	 * selected template without depending on already-published Services or
	 * Providers. Appointment flow remains an explicit customer choice.
	 *
	 * @return string Stable Booking Form usage identifier.
	 */
	public function get_initial_booking_form_usage() {
		return 'direct_booking_form';
	}

	/**
	 * Return the allow-listed Booking Form entry points exposed by this step.
	 *
	 * Appointment Flow is a Guided Appointment entry point, not a generic Form
	 * Builder presentation mode. Omitting the journey keeps the complete global
	 * allow-list for compatibility callers; any explicitly supplied context must
	 * name Guided appointment to receive Appointment Flow.
	 *
	 * @param string|null $customer_journey Optional Customer Journey identifier. Omit only for global compatibility validation.
	 *
	 * @return array<int,array{id:string,label:string,description:string}> Usage option DTOs.
	 */
	public function get_booking_form_usage_options( $customer_journey = null ) {
		$usage_options = array(
			array(
				'id'          => 'direct_booking_form',
				'label'       => __( 'Direct booking form', 'booking' ),
				'description' => __( 'Show the selected booking form immediately.', 'booking' ),
			),
			array(
				'id'          => 'appointment_flow',
				'label'       => __( 'Appointment flow', 'booking' ),
				'description' => __( 'Let customers choose a published Service and Provider before opening the selected booking form.', 'booking' ),
			),
		);
		$has_journey_context = null !== $customer_journey;
		$customer_journey    = sanitize_key( is_scalar( $customer_journey ) ? (string) $customer_journey : '' );

		if ( $has_journey_context && 'guided_appointment_flow' !== $customer_journey ) {
			return array( $usage_options[0] );
		}

		return $usage_options;
	}

	/**
	 * Validate the selected Booking Form entry point against the exact allow-list.
	 *
	 * @param mixed $raw_booking_form_usage Untrusted or stored usage identifier.
	 * @param bool  $is_required            Whether an empty choice must be rejected.
	 *
	 * @return string|WP_Error Normalized usage identifier or a validation error.
	 */
	public function validate_booking_form_usage( $raw_booking_form_usage, $is_required ) {
		if ( ! is_scalar( $raw_booking_form_usage ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_usage_invalid', __( 'Choose a valid booking form entry point.', 'booking' ) );
		}

		$raw_booking_form_usage = trim( (string) $raw_booking_form_usage );
		$booking_form_usage     = sanitize_key( $raw_booking_form_usage );

		if ( '' === $booking_form_usage ) {
			return $is_required
				? new WP_Error( 'wpbc_setup_wizard_booking_form_usage_required', __( 'Choose how customers will open the booking form.', 'booking' ) )
				: '';
		}

		$allowed_usage_ids = wp_list_pluck( $this->get_booking_form_usage_options(), 'id' );
		if ( $booking_form_usage !== $raw_booking_form_usage || ! in_array( $booking_form_usage, $allowed_usage_ids, true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_usage_unknown', __( 'Choose a valid booking form entry point.', 'booking' ) );
		}

		return $booking_form_usage;
	}

	/**
	 * Validate a Booking Form entry point for the active Customer Journey.
	 *
	 * This contextual boundary prevents a stale checkpoint or a tampered request
	 * from enabling Appointment Flow after the route changes to a time-based
	 * journey. The global validator remains available for compatibility callers
	 * that do not own journey context.
	 *
	 * @param mixed  $raw_booking_form_usage Untrusted or stored usage identifier.
	 * @param mixed  $customer_journey       Server-owned Customer Journey identifier.
	 * @param bool   $is_required            Whether an empty choice must be rejected.
	 *
	 * @return string|WP_Error Normalized usage identifier or a validation error.
	 */
	public function validate_booking_form_usage_for_journey( $raw_booking_form_usage, $customer_journey, $is_required ) {
		$booking_form_usage = $this->validate_booking_form_usage( $raw_booking_form_usage, $is_required );
		if ( is_wp_error( $booking_form_usage ) || '' === $booking_form_usage ) {
			return $booking_form_usage;
		}

		$customer_journey = sanitize_key( is_scalar( $customer_journey ) ? (string) $customer_journey : '' );
		$allowed_usage_ids = wp_list_pluck( $this->get_booking_form_usage_options( $customer_journey ), 'id' );
		if ( ! in_array( $booking_form_usage, $allowed_usage_ids, true ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_usage_journey_invalid',
				__( 'Appointment flow is available only for the Guided appointment customer journey.', 'booking' )
			);
		}

		return $booking_form_usage;
	}

	/**
	 * Map an allow-listed usage identifier to the shared preview renderer.
	 *
	 * @param mixed  $raw_booking_form_usage Untrusted usage identifier.
	 * @param string|null $customer_journey Optional server-owned Customer Journey identifier. Omit only for global compatibility validation.
	 *
	 * @return string|WP_Error Either booking or appointment, or a validation error.
	 */
	public function get_preview_render_mode( $raw_booking_form_usage, $customer_journey = null ) {
		$booking_form_usage = null === $customer_journey
			? $this->validate_booking_form_usage( $raw_booking_form_usage, true )
			: $this->validate_booking_form_usage_for_journey( $raw_booking_form_usage, $customer_journey, true );
		if ( is_wp_error( $booking_form_usage ) ) {
			return $booking_form_usage;
		}

		return 'appointment_flow' === $booking_form_usage ? 'appointment' : 'booking';
	}

	/**
	 * Validate a selected template against the current registry allow-list.
	 *
	 * @param mixed $raw_template_slug Untrusted or stored template slug.
	 * @param bool  $is_required      Whether an empty choice must be rejected.
	 *
	 * @return string|WP_Error Normalized slug or a validation error.
	 */
	public function validate_template_slug( $raw_template_slug, $is_required ) {
		if ( ! is_scalar( $raw_template_slug ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_template_invalid', __( 'Choose a valid booking form template.', 'booking' ) );
		}

		$raw_template_slug = trim( (string) $raw_template_slug );
		$template_slug     = sanitize_title( $raw_template_slug );

		if ( '' === $template_slug ) {
			return $is_required
				? new WP_Error( 'wpbc_setup_wizard_booking_form_template_required', __( 'Choose a booking form template.', 'booking' ) )
				: '';
		}

		if ( $template_slug !== $raw_template_slug || ! in_array( $template_slug, $this->get_template_slugs(), true ) ) {
			return new WP_Error( 'wpbc_setup_wizard_booking_form_template_unknown', __( 'The selected booking form template is no longer available.', 'booking' ) );
		}

		return $template_slug;
	}

	/**
	 * Return the exact template slugs available from the read-only registry.
	 *
	 * @return string[] Stable template slugs.
	 */
	private function get_template_slugs() {
		return wp_list_pluck( $this->get_templates( 'guided_appointment_flow' ), 'slug' );
	}

	/**
	 * Read and normalize Form Builder template registry records.
	 *
	 * Demo-only fixture records are excluded so customer setup never exposes
	 * private development examples. Registry filters remain supported because
	 * they are the established Form Builder extension point.
	 *
	 * @param string $customer_journey Selected customer journey ID.
	 *
	 * @return array<int,array<string,mixed>> Presentation-only template DTOs.
	 */
	private function get_templates( $customer_journey ) {
		$cache_key = is_scalar( $customer_journey ) ? sanitize_key( (string) $customer_journey ) : '';

		if ( isset( $this->templates_cache[ $cache_key ] ) ) {
			return $this->templates_cache[ $cache_key ];
		}

		$template_dtos                 = array();
		$registry_records              = $this->get_registry_records();
		$recommended_template_slugs = $this->get_recommended_template_slugs( $customer_journey );

		foreach ( $registry_records as $template_slug => $template_config ) {
			$record = $template_config['record'];

			$category             = $this->get_template_category( $template_slug );
			$is_recommended       = in_array( $template_slug, $recommended_template_slugs, true );
			$raw_picture_url      = isset( $record['picture_url'] ) && is_scalar( $record['picture_url'] ) ? (string) $record['picture_url'] : '';
			$picture_url          = function_exists( 'wpbc_bfb_resolve_picture_url' )
				? wpbc_bfb_resolve_picture_url( $raw_picture_url )
				: '';
			$template_title       = isset( $record['title'] ) && is_scalar( $record['title'] ) ? trim( (string) $record['title'] ) : '';
			$template_description = isset( $record['description'] ) && is_scalar( $record['description'] )
				? (string) $record['description']
				: '';

			$template_dtos[] = array(
				'slug'           => $template_slug,
				'title'          => '' !== $template_title
					? sanitize_text_field( $template_title )
					: sanitize_text_field( ucwords( str_replace( array( '-', '_' ), ' ', $template_slug ) ) ),
				'description'    => sanitize_textarea_field( $template_description ),
				'picture_url'    => esc_url_raw( (string) $picture_url ),
				'category'       => $category,
				'is_recommended' => $is_recommended,
			);
		}

		/*
		 * The Form Builder library lists template rows newest-first. Bundled
		 * registry records are intentionally appended in increasing display
		 * priority so the last seeded row becomes the first library card. Mirror
		 * that established order here instead of exposing the seed order in the
		 * Setup Wizard.
		 */
		$template_dtos = array_reverse( $template_dtos );

		$this->templates_cache[ $cache_key ] = $template_dtos;

		return $this->templates_cache[ $cache_key ];
	}

	/**
	 * Return unique, non-demo template records from the established registry.
	 *
	 * Records remain server-side. This method establishes the single allow-list
	 * used by catalog rendering, field validation, and interactive previews.
	 *
	 * @return array<string,array<string,mixed>> Records keyed by stable form slug.
	 */
	private function get_registry_records() {
		if ( null !== $this->registry_records_cache ) {
			return $this->registry_records_cache;
		}

		$this->registry_records_cache = array();
		if ( ! function_exists( 'wpbc_bfb_activation__get_templates_registry' ) ) {
			return $this->registry_records_cache;
		}

		foreach ( (array) wpbc_bfb_activation__get_templates_registry() as $template_config ) {
			if ( ! is_array( $template_config ) || empty( $template_config['record'] ) || ! is_array( $template_config['record'] ) ) {
				continue;
			}

			$template_key  = isset( $template_config['template_key'] ) && is_scalar( $template_config['template_key'] )
				? sanitize_key( (string) $template_config['template_key'] )
				: '';
			$record        = $template_config['record'];
			$template_slug = isset( $record['form_slug'] ) && is_scalar( $record['form_slug'] )
				? sanitize_title( (string) $record['form_slug'] )
				: '';

			if ( '' === $template_slug || 0 === strpos( $template_key, 'demo_' ) || isset( $this->registry_records_cache[ $template_slug ] ) ) {
				continue;
			}

			$this->registry_records_cache[ $template_slug ] = array(
				'template_key' => $template_key,
				'record'       => $record,
			);
		}

		return $this->registry_records_cache;
	}

	/**
	 * Map a stable Form Builder slug to a selector category.
	 *
	 * @param string $template_slug Stable template slug.
	 *
	 * @return string One of appointments, time_slots, full_days, or other.
	 */
	private function get_template_category( $template_slug ) {
		if ( 0 === strpos( $template_slug, 'appointments_services_' ) || 0 === strpos( $template_slug, 'time_appointments_' ) ) {
			return 'appointments';
		}

		if ( 0 === strpos( $template_slug, 'time_slots_' ) ) {
			return 'time_slots';
		}

		if ( 0 === strpos( $template_slug, 'dates_' ) ) {
			return 'full_days';
		}

		return 'other';
	}

	/**
	 * Return the template recommendations owned by each supported journey.
	 *
	 * Recommendations are deliberately narrower than selector categories. The
	 * Guided appointment flow needs templates with a compatible appointment
	 * structure, while the Appointments tab must continue to expose the complete
	 * appointment-oriented library.
	 *
	 * @param string $customer_journey Selected customer journey ID.
	 *
	 * @return string[] Ordered stable template slugs for the current journey.
	 */
	private function get_recommended_template_slugs( $customer_journey ) {
		$customer_journey         = is_scalar( $customer_journey ) ? sanitize_key( (string) $customer_journey ) : '';
		$start_end_recommendations = array(
			'time_slots_start_end_times_1_hour_selection',
		);
		$full_day_recommendations  = array(
			'dates_2_columns_hints_full_days',
			'dates_vertical_hints_full_days',
			'dates_form_with_inline_hints',
			'dates_2_columns_sidebar_hints',
			'dates_advanced_3_steps_review_with_hints',
			'dates_form_with_vertical_layout',
		);
		$recommendations = array(
			'guided_appointment_flow'      => array(
				'appointments_services_selection_summary',
				'appointments_services_flow',
				'time_appointments_2_steps_wizard',
			),
			'start_end_time'               => $start_end_recommendations,
			'repeated_time_multiple_dates' => $start_end_recommendations,
			'first_start_last_end'         => $start_end_recommendations,
			'start_time_duration'          => array(
				'time_slots_start_duration_times_selection',
			),
			'fixed_time_slots'             => array(
				'time_slots_2_columns_hints',
				'time_slots_20_min_3_steps_review_with_hints',
				'time_slots_20_min_2_steps_wizard',
				'time_slots_30_min_2_steps_wizard',
			),
			'single_full_day'              => $full_day_recommendations,
			'multiple_independent_days'    => $full_day_recommendations,
			'flexible_date_range'          => $full_day_recommendations,
			'fixed_length_date_range'      => $full_day_recommendations,
			'check_in_out_changeover'      => $full_day_recommendations,
		);

		return isset( $recommendations[ $customer_journey ] )
			? $recommendations[ $customer_journey ]
			: array();
	}

	/**
	 * Build ordered selector filters and their visible counts.
	 *
	 * @param array<int,array<string,mixed>> $templates Template DTOs.
	 *
	 * @return array<int,array{id:string,label:string,count:int}> Filter records.
	 */
	private function get_filter_records( array $templates ) {
		$counts = array(
			'recommended'  => 0,
			'all'          => count( $templates ),
			'appointments' => 0,
			'time_slots'   => 0,
			'full_days'    => 0,
		);

		foreach ( $templates as $template ) {
			if ( ! empty( $template['is_recommended'] ) ) {
				++$counts['recommended'];
			}
			if ( isset( $counts[ $template['category'] ] ) ) {
				++$counts[ $template['category'] ];
			}
		}

		return array(
			array( 'id' => 'recommended', 'label' => __( 'Recommended', 'booking' ), 'count' => $counts['recommended'] ),
			array( 'id' => 'all', 'label' => __( 'All templates', 'booking' ), 'count' => $counts['all'] ),
			array( 'id' => 'appointments', 'label' => __( 'Appointments', 'booking' ), 'count' => $counts['appointments'] ),
			array( 'id' => 'time_slots', 'label' => __( 'Time Slots', 'booking' ), 'count' => $counts['time_slots'] ),
			array( 'id' => 'full_days', 'label' => __( 'Full Days', 'booking' ), 'count' => $counts['full_days'] ),
		);
	}

	/**
	 * Return the preferred default from an already normalized catalog.
	 *
	 * @param array<int,array<string,mixed>> $templates Template DTOs.
	 *
	 * @return string Stable selected slug or an empty string.
	 */
	private function get_default_template_slug( array $templates ) {
		foreach ( $templates as $template ) {
			if ( ! empty( $template['is_recommended'] ) ) {
				return (string) $template['slug'];
			}
		}

		return ! empty( $templates[0]['slug'] ) ? (string) $templates[0]['slug'] : '';
	}

	/**
	 * Find one normalized template by slug.
	 *
	 * @param array<int,array<string,mixed>> $templates    Template DTOs.
	 * @param string                         $template_slug Stable template slug.
	 *
	 * @return array<string,mixed> Matching DTO or an empty array.
	 */
	private function find_template( array $templates, $template_slug ) {
		foreach ( $templates as $template ) {
			if ( $template_slug === $template['slug'] ) {
				return $template;
			}
		}

		return array();
	}
}

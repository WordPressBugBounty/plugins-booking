<?php
/**
 * Completed Setup Wizard overview presentation service.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build the read-only, data-only Setup overview shown after completion.
 *
 * The checkpoint remains authoritative only for wizard-owned choices such as
 * Customer Journey and the selected Booking Form template. Settings-backed
 * summaries are supplied by the existing Review presenter, whose dependencies
 * refresh canonical values before this mapper runs. Service and Provider totals
 * are loaded from the owner-aware Appointment Services repository in one
 * bounded query. This class never mutates configuration.
 */
final class WPBC_Setup_Wizard_Setup_Overview {

	/**
	 * Build the complete template context for one completed checkpoint.
	 *
	 * @param array<string,mixed> $checkpoint     Authorized completed checkpoint.
	 * @param array<string,mixed> $review_context Current Review presenter context.
	 *
	 * @return array<string,mixed> JSON-safe overview presentation data.
	 */
	public function get_context( array $checkpoint, array $review_context ) {
		$review_rows        = $this->index_review_rows( $review_context );
		$service_counts     = $this->get_service_counts();
		$published_pages    = $this->get_published_pages( $checkpoint );
		$publishing_allowed = ( new WPBC_Setup_Wizard_Publish_Integration() )->is_available();
		$publishing_url     = $publishing_allowed ? $this->get_publishing_url() : '';
		$journey            = isset( $review_context['journey'] ) && is_array( $review_context['journey'] )
			? $review_context['journey']
			: array();

		$groups = array(
			array(
				'number'      => 1,
				'title'       => __( 'What customers book', 'booking' ),
				'description' => __( 'Services, Providers, and the booking flow.', 'booking' ),
				'rows'        => array(
					$this->create_wizard_row(
						'customer_journey',
						'wpbc_icn_group',
						__( 'Customer journey', 'booking' ),
						isset( $journey['title'] ) ? (string) $journey['title'] : __( 'Not configured', 'booking' ),
						__( 'Review', 'booking' )
					),
					$this->create_link_row(
						'services',
						'wpbc_icn_format_list_bulleted',
						__( 'Services', 'booking' ),
						$this->format_service_count( $service_counts['services'] ),
						$this->get_services_url(),
						__( 'Review', 'booking' )
					),
					$this->create_link_row(
						'providers',
						'wpbc_icn_groups',
						__( 'Providers', 'booking' ),
						$this->format_provider_count( $service_counts['providers'] ),
						$this->get_providers_url(),
						__( 'Review', 'booking' )
					),
				),
			),
			array(
				'number'      => 2,
				'title'       => __( 'When they can book', 'booking' ),
				'description' => __( 'Availability, working hours, and date selection.', 'booking' ),
				'rows'        => array(
					$this->create_link_row( 'working_hours', 'wpbc_icn_schedule', __( 'Working hours', 'booking' ), $this->get_review_summary( $review_rows, 'working_hours' ), $this->get_working_hours_url(), __( 'Change', 'booking' ) ),
					$this->create_link_row( 'days_off', 'wpbc_icn_event_busy', __( 'Days off', 'booking' ), $this->get_review_summary( $review_rows, 'days_off' ), $this->get_days_off_url(), __( 'Change', 'booking' ) ),
					$this->create_link_row( 'date_selection', 'wpbc_icn_calendar_month', __( 'Date selection', 'booking' ), $this->get_review_summary( $review_rows, 'date_selection' ), $this->get_date_selection_url(), __( 'Change', 'booking' ) ),
				),
			),
			array(
				'number'      => 3,
				'title'       => __( 'What customers see', 'booking' ),
				'description' => __( 'The booking form and appearance on your site.', 'booking' ),
				'rows'        => array(
					$this->create_link_row( 'booking_form_template', 'wpbc_icn_list_alt', __( 'Booking form', 'booking' ), $this->get_booking_form_summary( $review_rows ), $this->get_booking_form_url(), __( 'Review', 'booking' ) ),
					$this->create_link_row( 'appearance', 'wpbc_icn_brush', __( 'Appearance', 'booking' ), $this->get_review_summary( $review_rows, 'appearance' ), $this->get_appearance_url(), __( 'Change', 'booking' ) ),
				),
			),
			array(
				'number'      => 4,
				'title'       => __( 'Go live', 'booking' ),
				'description' => __( 'Publish your booking form and start taking bookings.', 'booking' ),
				'rows'        => array(
					$publishing_allowed
						? $this->create_link_row(
							'publish_integration',
							'wpbc_icn_open_in_new',
							__( 'Publishing', 'booking' ),
							$this->get_publishing_summary( $published_pages ),
							$publishing_url,
							__( 'Publish', 'booking' ),
							empty( $published_pages ) ? 'danger' : 'success'
						)
						: $this->create_disabled_row( 'publish_integration', 'wpbc_icn_open_in_new', __( 'Publishing', 'booking' ), __( 'Unavailable in this environment', 'booking' ) ),
					$this->create_link_row( 'notifications', 'wpbc_icn_email', __( 'Notifications', 'booking' ), __( 'Booking email notifications', 'booking' ), $this->get_notifications_url(), __( 'Change', 'booking' ) ),
				),
			),
		);

		return array(
			'checkpoint'           => array(
				'current_step' => isset( $checkpoint['current_step'] ) ? sanitize_key( (string) $checkpoint['current_step'] ) : 'review_setup',
				'revision'     => isset( $checkpoint['revision'] ) ? absint( $checkpoint['revision'] ) : 0,
			),
			'groups'               => $groups,
			'published_pages'      => $published_pages,
			'publishing_allowed'   => $publishing_allowed,
			'publishing_url'       => $publishing_url,
			'published_page_count' => count( $published_pages ),
			'admin_post_url'       => admin_url( 'admin-post.php' ),
			'notice'              => $this->get_request_notice(),
		);
	}

	/**
	 * Flatten Review groups into a stable step-indexed lookup.
	 *
	 * @param array<string,mixed> $review_context Current Review presenter context.
	 *
	 * @return array<string,array<string,mixed>> Rows keyed by step ID.
	 */
	private function index_review_rows( array $review_context ) {
		$indexed_rows = array();
		$groups       = isset( $review_context['groups'] ) && is_array( $review_context['groups'] ) ? $review_context['groups'] : array();

		foreach ( $groups as $group ) {
			if ( ! is_array( $group ) || empty( $group['rows'] ) || ! is_array( $group['rows'] ) ) {
				continue;
			}
			foreach ( $group['rows'] as $row ) {
				if ( ! is_array( $row ) || empty( $row['step_id'] ) ) {
					continue;
				}
				$indexed_rows[ sanitize_key( (string) $row['step_id'] ) ] = $row;
			}
		}

		return $indexed_rows;
	}

	/**
	 * Return one safe Review summary with an explicit empty-state fallback.
	 *
	 * @param array<string,array<string,mixed>> $review_rows Indexed Review rows.
	 * @param string                            $step_id     Stable step identifier.
	 *
	 * @return string Sanitized summary.
	 */
	private function get_review_summary( array $review_rows, $step_id ) {
		return isset( $review_rows[ $step_id ]['summary'] ) && is_scalar( $review_rows[ $step_id ]['summary'] ) && '' !== trim( (string) $review_rows[ $step_id ]['summary'] )
			? sanitize_text_field( (string) $review_rows[ $step_id ]['summary'] )
			: __( 'Not configured', 'booking' );
	}

	/**
	 * Describe the canonical Standard form and the template applied to it.
	 *
	 * The selected template is a recipe applied to the existing Standard form;
	 * it is not a separately published form. Naming both identities prevents the
	 * overview from implying that the template title replaced the form name.
	 *
	 * @param array<string,array<string,mixed>> $review_rows Indexed Review rows.
	 *
	 * @return string Sanitized Booking Form summary.
	 */
	private function get_booking_form_summary( array $review_rows ) {
		$template_title = $this->get_review_summary( $review_rows, 'booking_form_template' );

		if ( ! isset( $review_rows['booking_form_template'] ) ) {
			return $template_title;
		}

		/* translators: 1: Booking Form name. 2: selected Setup Wizard template name. */
		return sprintf( __( '%1$s form based on %2$s', 'booking' ), __( 'Standard', 'booking' ), $template_title );
	}

	/**
	 * Load active owner-scoped Service and assigned Provider counts.
	 *
	 * The repository loads assignments for all returned Services in one query,
	 * avoiding a Provider-assignment N+1 on the overview.
	 *
	 * @return array{services:int,providers:int} Authorized current counts.
	 */
	private function get_service_counts() {
		$counts = array(
			'services'  => 0,
			'providers' => 0,
		);

		if (
			! function_exists( 'wpbc_appointment_services_get_manage_capability' )
			|| ! current_user_can( wpbc_appointment_services_get_manage_capability() )
			|| ! function_exists( 'wpbc_appointment_services_get_data_provider' )
		) {
			return $counts;
		}

		$service_provider = wpbc_appointment_services_get_data_provider();
		if ( ! is_object( $service_provider ) || ! method_exists( $service_provider, 'list_items_for_current_owner' ) ) {
			return $counts;
		}

		$services = $service_provider->list_items_for_current_owner(
			array(
				'status'     => 'active',
				'sort_by'    => 'service_id',
				'sort_order' => 'asc',
				'limit'      => 500,
			)
		);
		if ( is_wp_error( $services ) || ! is_array( $services ) ) {
			return $counts;
		}

		$provider_ids       = array();
		$counts['services'] = count( $services );
		foreach ( $services as $service ) {
			$service = is_object( $service ) ? get_object_vars( $service ) : (array) $service;
			foreach ( isset( $service['resource_ids'] ) ? (array) $service['resource_ids'] : array() as $resource_id ) {
				$resource_id = absint( $resource_id );
				if ( $resource_id ) {
					$provider_ids[ $resource_id ] = true;
				}
			}
		}
		$counts['providers'] = count( $provider_ids );

		return $counts;
	}

	/**
	 * Discover current public booking pages referenced by this checkpoint or by
	 * the established activation-page registry.
	 *
	 * @param array<string,mixed> $checkpoint Authorized completed checkpoint.
	 *
	 * @return array<int,array<string,mixed>> Public page cards without raw posts.
	 */
	private function get_published_pages( array $checkpoint ) {
		$pages        = array();
		$page_records = array();
		$page_ids     = array();
		$result       = isset( $checkpoint['step_results']['publish_integration'] ) && is_array( $checkpoint['step_results']['publish_integration'] )
			? $checkpoint['step_results']['publish_integration']
			: array();
		$publish_values = isset( $checkpoint['values']['publish_integration'] ) && is_array( $checkpoint['values']['publish_integration'] )
			? $checkpoint['values']['publish_integration']
			: array();
		$destination    = isset( $publish_values['publish_destination'] ) && is_scalar( $publish_values['publish_destination'] )
			? sanitize_key( (string) $publish_values['publish_destination'] )
			: '';
		$accepted_page_types = array( 'created', 'existing' );
		if ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination ) {
			$accepted_page_types = array( 'created' );
		} elseif ( WPBC_Setup_Wizard_Publish_Integration::DESTINATION_EXISTING_PAGE === $destination ) {
			$accepted_page_types = array( 'existing' );
		} elseif ( '' !== $destination ) {
			$accepted_page_types = array();
		}

		foreach ( array( 'created_ids', 'updated_ids' ) as $identifier_group ) {
			foreach ( isset( $result[ $identifier_group ] ) ? (array) $result[ $identifier_group ] : array() as $identifier ) {
				if (
					is_scalar( $identifier )
					&& preg_match( '/^wp_page_(created|existing):([0-9]+)$/', (string) $identifier, $matches )
					&& in_array( $matches[1], $accepted_page_types, true )
				) {
					$page_ids[ absint( $matches[2] ) ] = true;
				}
			}
		}

		if ( in_array( 'existing', $accepted_page_types, true ) && ! empty( $publish_values['publish_existing_page_id'] ) ) {
			$page_ids[ absint( $publish_values['publish_existing_page_id'] ) ] = true;
		}
		$booking_form_values = isset( $checkpoint['values']['booking_form_template'] ) && is_array( $checkpoint['values']['booking_form_template'] )
			? $checkpoint['values']['booking_form_template']
			: array();
		$template_key        = isset( $booking_form_values['booking_form_template'] ) && is_scalar( $booking_form_values['booking_form_template'] )
			? sanitize_key( (string) $booking_form_values['booking_form_template'] )
			: '';

		foreach ( array_keys( $page_ids ) as $page_id ) {
			$page = get_post( $page_id );
			if (
				! ( $page instanceof WP_Post )
				|| 'page' !== $page->post_type
				|| 'publish' !== $page->post_status
				|| false === strpos( (string) $page->post_content, WPBC_Setup_Wizard_Publish_Integration::MANAGED_BLOCK_START )
			) {
				continue;
			}
			$page_url = get_permalink( $page_id );
			if ( ! is_string( $page_url ) || '' === $page_url ) {
				continue;
			}
			$page_title = sanitize_text_field( get_the_title( $page_id ) );
			$page_records[] = array(
				'key'          => 'setup_page_' . $page_id,
				'section'      => 'setup',
				'url'          => esc_url_raw( $page_url ),
				'page_title'   => '' !== $page_title ? $page_title : __( 'Booking page', 'booking' ),
				'button_title' => __( 'Open your booking page', 'booking' ),
				'description'  => __(
					'Configured from the customer journey, Booking Form, appearance, and publishing choices saved in this Setup Wizard.',
					'booking'
				),
				'template_key' => $template_key,
			);
		}

		if ( class_exists( 'WPBC_Setup_Wizard_Booking_Pages' ) ) {
			foreach ( WPBC_Setup_Wizard_Booking_Pages::prepare_booking_page_cards( $page_records ) as $booking_page_card ) {
				$pages[ $booking_page_card['url'] ] = $booking_page_card;
			}

			$allow_discovered_setup_page = '' === $destination || WPBC_Setup_Wizard_Publish_Integration::DESTINATION_CREATE_PAGE === $destination;
			foreach ( WPBC_Setup_Wizard_Booking_Pages::get_booking_page_cards() as $booking_page_card ) {
				$is_setup_page = 'setup' === ( isset( $booking_page_card['section'] ) ? $booking_page_card['section'] : '' );
				// The completed checkpoint is authoritative; never mix in a retained page from another publishing choice.
				if ( $is_setup_page && ( ! empty( $pages ) || ! $allow_discovered_setup_page ) ) {
					continue;
				}

				if ( ! empty( $booking_page_card['url'] ) && ! isset( $pages[ $booking_page_card['url'] ] ) ) {
					$pages[ $booking_page_card['url'] ] = $booking_page_card;
				}
			}
		}

		return array_values( $pages );
	}

	/**
	 * Create a canonical-settings link row.
	 *
	 * @param string $id           Stable row ID.
	 * @param string $icon         Established icon class.
	 * @param string $label        Visible setting label.
	 * @param string $summary      Current-choice summary.
	 * @param string $url          Authorized destination URL.
	 * @param string $action_label Visible action label.
	 * @param string $summary_type Optional semantic summary style.
	 *
	 * @return array<string,mixed> Normalized row.
	 */
	private function create_link_row( $id, $icon, $label, $summary, $url, $action_label, $summary_type = 'default' ) {
		return array(
			'id'           => sanitize_key( $id ),
			'icon'         => sanitize_html_class( $icon ),
			'label'        => sanitize_text_field( $label ),
			'summary'      => sanitize_text_field( $summary ),
			'summary_type' => sanitize_key( $summary_type ),
			'action'       => array(
				'type'  => 'link',
				'label' => sanitize_text_field( $action_label ),
				'url'   => esc_url_raw( $url ),
			),
		);
	}

	/**
	 * Create a nonce-protected wizard-reopen row.
	 *
	 * @param string $step_id      Stable wizard step ID.
	 * @param string $icon         Established icon class.
	 * @param string $label        Visible setting label.
	 * @param string $summary      Current-choice summary.
	 * @param string $action_label Visible action label.
	 * @param string $summary_type Optional semantic summary style.
	 *
	 * @return array<string,mixed> Normalized row.
	 */
	private function create_wizard_row( $step_id, $icon, $label, $summary, $action_label, $summary_type = 'default' ) {
		$row           = $this->create_link_row( $step_id, $icon, $label, $summary, '', $action_label );
		$row['action'] = array(
			'type'    => 'wizard_step',
			'label'   => sanitize_text_field( $action_label ),
			'step_id' => sanitize_key( $step_id ),
		);
		$row['summary_type'] = sanitize_key( $summary_type );

		return $row;
	}

	/**
	 * Create an unavailable environment-owned row without an action.
	 *
	 * @param string $id      Stable row ID.
	 * @param string $icon    Established icon class.
	 * @param string $label   Visible setting label.
	 * @param string $summary Current-choice summary.
	 *
	 * @return array<string,mixed> Normalized row.
	 */
	private function create_disabled_row( $id, $icon, $label, $summary ) {
		$row                  = $this->create_link_row( $id, $icon, $label, $summary, '', '' );
		$row['action']['type'] = 'none';
		$row['summary_type']   = 'muted';

		return $row;
	}

	/**
	 * Format the current active Service count.
	 *
	 * @param int $count Number of active Services.
	 *
	 * @return string Translated Service count summary.
	 */
	private function format_service_count( $count ) {
		/* translators: %s: Localized number of active Services. */
		return sprintf( _x( '%s active', 'Setup overview active Service count', 'booking' ), number_format_i18n( absint( $count ) ) );
	}

	/**
	 * Format the number of Providers assigned to active Services.
	 *
	 * @param int $count Number of assigned Providers.
	 *
	 * @return string Translated Provider count summary.
	 */
	private function format_provider_count( $count ) {
		/* translators: %s: Localized number of assigned Providers. */
		return sprintf( _x( '%s assigned', 'Setup overview assigned Provider count', 'booking' ), number_format_i18n( absint( $count ) ) );
	}

	/**
	 * Summarize current public-page discovery.
	 *
	 * @param array<int,array<string,mixed>> $published_pages Current public pages.
	 *
	 * @return string Publishing summary.
	 */
	private function get_publishing_summary( array $published_pages ) {
		$page_count = count( $published_pages );
		if ( 0 === $page_count ) {
			return __( 'Not published yet', 'booking' );
		}

		/* translators: %s: Localized number of published booking pages. */
		return sprintf( _n( '%s published page', '%s published pages', $page_count, 'booking' ), number_format_i18n( $page_count ) );
	}

	/**
	 * Return a safe presentation-only notice selected by an allow-listed code.
	 *
	 * @return array<string,string> Notice type and text, or an empty array.
	 */
	private function get_request_notice() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Presentation-only status code from an admin-post redirect.
		$notice_code = isset( $_GET['wpbc_setup_overview_notice'] ) && is_scalar( $_GET['wpbc_setup_overview_notice'] ) ? sanitize_key( wp_unslash( $_GET['wpbc_setup_overview_notice'] ) ) : '';
		$notices     = array(
			'stale' => array(
				'type' => 'warning',
				'text' => __( 'The setup state changed in another request. Reload this page and try again.', 'booking' ),
			),
			'error' => array(
				'type' => 'error',
				'text' => __( 'The requested Setup Wizard action could not be completed. Reload this page and try again.', 'booking' ),
			),
		);

		return isset( $notices[ $notice_code ] ) ? $notices[ $notice_code ] : array();
	}

	/** @return string Services settings URL. */
	private function get_services_url() {
		return admin_url( 'admin.php?page=wpbc-services' );
	}

	/** @return string Provider settings URL. */
	private function get_providers_url() {
		return function_exists( 'wpbc_get_resources_url' ) ? wpbc_get_resources_url() : admin_url( 'admin.php?page=wpbc-resources' );
	}

	/** @return string Working Hours settings URL. */
	private function get_working_hours_url() {
		$availability_url = function_exists( 'wpbc_get_general_availability_url' ) ? wpbc_get_general_availability_url() : admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' );

		return add_query_arg( 'wpbc_ag_open', 'working_time', $availability_url );
	}

	/** @return string Days Off settings URL. */
	private function get_days_off_url() {
		return function_exists( 'wpbc_get_availability_url' ) ? wpbc_get_availability_url() : admin_url( 'admin.php?page=wpbc-availability' );
	}

	/** @return string Date Selection settings URL. */
	private function get_date_selection_url() {
		return function_exists( 'wpbc_settings_calendar__get_section_url' )
			? wpbc_settings_calendar__get_section_url( 'selection' )
			: admin_url( 'admin.php?page=wpbc-settings&tab=calendar_settings&wpbc_calendar_section=selection' );
	}

	/** @return string Booking Form settings URL. */
	private function get_booking_form_url() {
		return function_exists( 'wpbc_get_settings_url' ) ? wpbc_get_settings_url() . '&tab=builder_booking_form' : admin_url( 'admin.php?page=wpbc-settings&tab=builder_booking_form' );
	}

	/** @return string Appearance settings URL. */
	private function get_appearance_url() {
		return function_exists( 'wpbc_get_settings_themes_url' ) ? wpbc_get_settings_themes_url() : admin_url( 'admin.php?page=wpbc-settings&tab=themes' );
	}

	/** @return string Notification settings URL. */
	private function get_notifications_url() {
		return function_exists( 'wpbc_get_settings_url' ) ? wpbc_get_settings_url() . '&tab=email' : admin_url( 'admin.php?page=wpbc-settings&tab=email' );
	}

	/**
	 * Return the canonical per-Resource publishing destination.
	 *
	 * The Resources domain owns its request-local Publishing view and authorized
	 * inspector launch. The fallback keeps the overview navigable if that domain
	 * helper is unavailable during a partial or compatibility load.
	 *
	 * @return string Booking Resources publishing URL.
	 */
	private function get_publishing_url() {
		if ( function_exists( 'wpbc_catalog_booking_resources_get_publish_url' ) ) {
			return wpbc_catalog_booking_resources_get_publish_url();
		}

		return function_exists( 'wpbc_get_resources_url' )
			? wpbc_get_resources_url()
			: admin_url( 'admin.php?page=wpbc-resources&tab=resources' );
	}
}

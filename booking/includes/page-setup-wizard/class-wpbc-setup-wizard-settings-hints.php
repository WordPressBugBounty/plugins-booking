<?php
/**
 * Canonical administration destinations for Setup Wizard settings hints.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build data-only breadcrumb hints for settings that remain editable later.
 *
 * The Setup Wizard owns the relationship between a setup step and the normal
 * administration page that maintains the same setting. Existing URL helpers
 * remain authoritative for page, tab, section, and request-local launch
 * parameters. No request value participates in destination selection.
 */
final class WPBC_Setup_Wizard_Settings_Hints {

	/**
	 * Return the steps that intentionally omit a later-settings hint.
	 *
	 * These pages either collect wizard-only guidance, select the route, or form
	 * the final approval boundary. They do not have one equivalent settings page.
	 *
	 * @return string[] Stable omitted step identifiers.
	 */
	public function get_omitted_step_ids() {
		return array(
			'welcome',
			'business_details',
			'date_time_formats',
			'booking_experience',
			'customer_journey',
			'review_setup',
		);
	}

	/**
	 * Return a normalized hint for one allow-listed Setup Wizard step.
	 *
	 * @param string $step_id Stable Setup Wizard step identifier.
	 *
	 * @return array{message:string,links:array<int,array{label:string,url:string}>}|array{} Hint data or an empty array.
	 */
	public function get_hint( $step_id ) {
		$step_id = sanitize_key( is_scalar( $step_id ) ? (string) $step_id : '' );

		if ( in_array( $step_id, $this->get_omitted_step_ids(), true ) ) {
			return array();
		}

		$hint_links = $this->get_hint_links( $step_id );

		if ( empty( $hint_links ) ) {
			return array();
		}

		$links = array();
		foreach ( $hint_links as $link ) {
			$label = isset( $link[0] ) && is_scalar( $link[0] ) ? sanitize_text_field( (string) $link[0] ) : '';
			$url   = isset( $link[1] ) && is_scalar( $link[1] ) ? esc_url_raw( (string) $link[1] ) : '';
			if ( '' !== $label && '' !== $url ) {
				$links[] = array(
					'label' => $label,
					'url'   => $url,
				);
			}
		}

		if ( empty( $links ) ) {
			return array();
		}

		return array(
			'message' => __( 'You can always change these settings later', 'booking' ),
			'links'   => $links,
		);
	}

	/**
	 * Build the breadcrumb pairs for one supported step only.
	 *
	 * Resolving destinations lazily avoids invoking helpers owned by unrelated
	 * administration pages while another Setup Wizard step is rendering.
	 *
	 * @param string $step_id Sanitized Setup Wizard step identifier.
	 *
	 * @return array<int,array{0:string,1:string}> Ordered breadcrumb pairs.
	 */
	private function get_hint_links( $step_id ) {
		$supported_step_ids = array(
			'date_selection',
			'services',
			'booking_resources',
			'start_end_times',
			'start_duration_times',
			'fixed_time_slots',
			'working_hours',
			'days_off',
			'booking_form_template',
			'appearance',
			'publish_integration',
		);

		if ( ! in_array( $step_id, $supported_step_ids, true ) ) {
			return array();
		}

		$root_url = $this->get_bookings_url();

		switch ( $step_id ) {
			case 'date_selection':
				$settings_url = $this->get_settings_url();

				return array(
					array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
					array( __( 'Settings', 'booking' ), $settings_url ),
					array( __( 'Calendar', 'booking' ), $this->get_calendar_url() ),
					array( __( 'Days Selection', 'booking' ), $this->get_calendar_section_url( 'selection' ) ),
				);

			case 'services':
				return array(
					array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
					array( __( 'Services', 'booking' ), admin_url( 'admin.php?page=wpbc-services' ) ),
				);

			case 'booking_resources':
				$resources_url = $this->get_resources_url();

				return array(
					array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
					array( __( 'Resources', 'booking' ), $resources_url ),
					array( __( 'Booking Resources', 'booking' ), add_query_arg( 'tab', 'resources', $resources_url ) ),
				);

			case 'start_end_times':
			case 'start_duration_times':
			case 'fixed_time_slots':
			case 'booking_form_template':
				return $this->get_booking_form_path( $root_url, $this->get_settings_url() );

			case 'working_hours':
				return array(
					array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
					array( __( 'Availability', 'booking' ), $this->get_availability_url() ),
					array( __( 'Schedule & Rules', 'booking' ), $this->get_working_hours_url() ),
				);

			case 'days_off':
				$availability_url = $this->get_availability_url();

				return array(
					array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
					array( __( 'Availability', 'booking' ), $availability_url ),
					array( __( 'Block Dates', 'booking' ), $availability_url ),
				);

			case 'appearance':
				return array(
					array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
					array( __( 'Settings', 'booking' ), $this->get_settings_url() ),
					array( __( 'Appearance / Theme', 'booking' ), $this->get_appearance_url() ),
				);

			case 'publish_integration':
				$resources_url         = $this->get_resources_url();
				$booking_resources_url = add_query_arg( 'tab', 'resources', $resources_url );

				return array(
					array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
					array( __( 'Resources', 'booking' ), $resources_url ),
					array( __( 'Booking Resources', 'booking' ), $booking_resources_url ),
					array( __( 'Publishing', 'booking' ), $this->get_publishing_url() ),
				);
		}

		return array();
	}

	/**
	 * Return the repeated Booking Form Builder breadcrumb.
	 *
	 * Time-choice pages write their selections into the canonical Standard form
	 * at the later Booking Form boundary, so Form Builder is their durable editor.
	 *
	 * @param string $root_url     Canonical Booking Calendar root URL.
	 * @param string $settings_url Canonical Settings URL.
	 *
	 * @return array<int,array{0:string,1:string}> Ordered breadcrumb pairs.
	 */
	private function get_booking_form_path( $root_url, $settings_url ) {
		return array(
			array( __( 'WP Booking Calendar', 'booking' ), $root_url ),
			array( __( 'Settings', 'booking' ), $settings_url ),
			array( __( 'Booking Form Builder', 'booking' ), add_query_arg( 'tab', 'builder_booking_form', $settings_url ) ),
		);
	}

	/** @return string Canonical Booking Calendar root URL. */
	private function get_bookings_url() {
		return function_exists( 'wpbc_get_bookings_url' ) ? wpbc_get_bookings_url() : admin_url( 'admin.php?page=wpbc' );
	}

	/** @return string Canonical Settings URL. */
	private function get_settings_url() {
		return function_exists( 'wpbc_get_settings_url' ) ? wpbc_get_settings_url() : admin_url( 'admin.php?page=wpbc-settings' );
	}

	/** @return string Canonical Calendar settings URL. */
	private function get_calendar_url() {
		return function_exists( 'wpbc_get_settings_calendar_url' ) ? wpbc_get_settings_calendar_url() : admin_url( 'admin.php?page=wpbc-settings&tab=calendar_settings' );
	}

	/**
	 * Return one canonical Calendar settings section URL.
	 *
	 * @param string $section Allow-listed Calendar section key.
	 *
	 * @return string Calendar section URL.
	 */
	private function get_calendar_section_url( $section ) {
		return function_exists( 'wpbc_settings_calendar__get_section_url' )
			? wpbc_settings_calendar__get_section_url( $section )
			: add_query_arg( 'wpbc_calendar_section', sanitize_key( $section ), $this->get_calendar_url() );
	}

	/** @return string Canonical Availability URL. */
	private function get_availability_url() {
		return function_exists( 'wpbc_get_availability_url' ) ? wpbc_get_availability_url() : admin_url( 'admin.php?page=wpbc-availability' );
	}

	/** @return string Canonical Schedule and Rules URL with Working Time expanded. */
	private function get_working_hours_url() {
		$availability_url = function_exists( 'wpbc_get_general_availability_url' )
			? wpbc_get_general_availability_url()
			: admin_url( 'admin.php?page=wpbc-availability&tab=general_availability' );

		return add_query_arg( 'wpbc_ag_open', 'working_time', $availability_url );
	}

	/** @return string Canonical Booking Resources URL. */
	private function get_resources_url() {
		return function_exists( 'wpbc_get_resources_url' ) ? wpbc_get_resources_url() : admin_url( 'admin.php?page=wpbc-resources' );
	}

	/** @return string Canonical Appearance and Theme URL. */
	private function get_appearance_url() {
		return function_exists( 'wpbc_get_settings_themes_url' ) ? wpbc_get_settings_themes_url() : admin_url( 'admin.php?page=wpbc-settings&tab=themes' );
	}

	/** @return string Canonical request-local Booking Resource publishing URL. */
	private function get_publishing_url() {
		if ( function_exists( 'wpbc_catalog_booking_resources_get_publish_url' ) ) {
			return wpbc_catalog_booking_resources_get_publish_url();
		}

		return add_query_arg( 'tab', 'resources', $this->get_resources_url() );
	}
}

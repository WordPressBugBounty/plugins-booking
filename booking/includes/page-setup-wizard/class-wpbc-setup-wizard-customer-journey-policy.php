<?php
/**
 * Shared Setup Wizard Customer Journey policy.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Own the stable journey groups used by route and domain validation.
 *
 * Keeping these allow-lists in one policy prevents the rail, validation, save
 * handlers, and Review page from accepting different setup routes.
 */
final class WPBC_Setup_Wizard_Customer_Journey_Policy {

	/**
	 * Return journeys that require Business Small range-booking features.
	 *
	 * Fixed-length ranges depend on one-click range rules, while changeover
	 * journeys depend on the Business Small check-in/check-out boundary options.
	 * Keeping this list beside the route policy gives rendering and validation
	 * one edition contract instead of duplicating feature checks in templates.
	 *
	 * @return string[] Stable Customer Journey identifiers.
	 */
	public static function get_business_small_journey_ids() {
		return array( 'fixed_length_date_range', 'check_in_out_changeover' );
	}

	/**
	 * Determine whether Business Small range and changeover rules are available.
	 *
	 * The established Business Small bootstrap class is the same capability
	 * boundary used by the canonical Date Selection module. This deliberately
	 * keeps Free and Personal aligned without parsing display version strings.
	 *
	 * @return bool True for Business Small or a higher edition.
	 */
	public static function supports_advanced_range_rules() {
		return class_exists( 'wpdev_bk_biz_s' );
	}

	/**
	 * Determine whether one registered journey is available in this edition.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when the current edition owns the journey's features.
	 */
	public static function is_journey_available( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return ! in_array( $journey_id, self::get_business_small_journey_ids(), true )
			|| self::supports_advanced_range_rules();
	}

	/**
	 * Determine whether an identifier belongs to the registered journey catalog.
	 *
	 * This apply-time allow-list is intentionally assembled from the same route
	 * groups used by the wizard. Save handlers can therefore reject a stale or
	 * forged identifier without depending on presentation data.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when the identifier belongs to a registered journey.
	 */
	public static function is_registered_journey( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return in_array(
			$journey_id,
			array_merge( self::get_scheduled_booking_journey_ids(), self::get_booking_resources_journey_ids() ),
			true
		);
	}

	/**
	 * Return presentation-safe edition metadata for one registered journey.
	 *
	 * The DTO contains no capability or mutation details. Templates use it only
	 * to explain the server-owned policy that is independently enforced by the
	 * Setup Wizard field allow-list.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return array<string,mixed> Availability, badge, and disabled explanation.
	 */
	public static function get_journey_edition_requirement( $journey_id ) {
		$journey_id                 = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );
		$requires_business_small    = in_array( $journey_id, self::get_business_small_journey_ids(), true );
		$is_available               = self::is_journey_available( $journey_id );
		$show_upgrade_badge         = $requires_business_small && ! $is_available;
		$business_small_requirement = __( 'Requires Booking Calendar Business Small or higher.', 'booking' );

		return array(
			'is_available'    => $is_available,
			'minimum_edition' => $requires_business_small ? 'business_small' : 'free',
			'badge_label'     => $show_upgrade_badge ? __( 'BS+', 'booking' ) : '',
			'disabled_reason' => $requires_business_small && ! $is_available ? $business_small_requirement : '',
		);
	}

	/**
	 * Return journeys that configure bookable full-day Resources.
	 *
	 * These journeys share the same resource-first setup route even though their
	 * Date Selection policies differ. Keeping the complete allow-list here makes
	 * route construction, progressive saves, and Review use one domain rule.
	 *
	 * @return string[] Stable Customer Journey identifiers.
	 */
	public static function get_booking_resources_journey_ids() {
		return array(
			'single_full_day',
			'multiple_independent_days',
			'flexible_date_range',
			'fixed_length_date_range',
			'check_in_out_changeover',
		);
	}

	/**
	 * Determine whether a journey configures bookable full-day Resources.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True for a supported full-day or date-range journey.
	 */
	public static function uses_booking_resources_configuration( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return in_array( $journey_id, self::get_booking_resources_journey_ids(), true );
	}

	/**
	 * Return journeys that configure explicit time choices.
	 *
	 * @return string[] Stable Customer Journey identifiers.
	 */
	public static function get_time_configuration_journey_ids() {
		return array(
			'start_end_time',
			'start_time_duration',
			'fixed_time_slots',
			'repeated_time_multiple_dates',
			'first_start_last_end',
		);
	}

	/**
	 * Determine whether a journey uses the shared Start and End Times step.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when the journey configures explicit time choices.
	 */
	public static function uses_time_configuration( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return in_array( $journey_id, self::get_time_configuration_journey_ids(), true );
	}

	/**
	 * Return journeys that start Date Selection at Single day after transition.
	 *
	 * This allow-list is intentionally independent of route composition so a
	 * future scheduled journey cannot inherit the recommendation accidentally.
	 *
	 * @return string[] Stable Customer Journey identifiers.
	 */
	public static function get_single_day_transition_journey_ids() {
		return array(
			'guided_appointment_flow',
			'fixed_time_slots',
			'start_end_time',
			'start_time_duration',
		);
	}

	/**
	 * Determine whether the direct Date Selection transition starts at Single day.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True only for the four appointment and time-based journeys.
	 */
	public static function uses_single_day_transition_default( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return in_array( $journey_id, self::get_single_day_transition_journey_ids(), true );
	}

	/**
	 * Determine whether a journey configures independent start and end choices.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when the Start and End Times step belongs to the route.
	 */
	public static function uses_start_end_configuration( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return in_array(
			$journey_id,
			array( 'start_end_time', 'repeated_time_multiple_dates', 'first_start_last_end' ),
			true
		);
	}

	/**
	 * Determine whether Working Hours starts disabled for one journey.
	 *
	 * The Repeat one time on multiple dates journey must not silently restrict
	 * configured times to the site's existing weekly schedule. Its Working Hours
	 * step remains available so an administrator can explicitly enable it.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when the first Working Hours proposal must be disabled.
	 */
	public static function uses_disabled_working_hours_default( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return 'repeated_time_multiple_dates' === $journey_id;
	}

	/**
	 * Determine whether a journey configures start-time and duration choices.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True only for the Start Time + Duration journey.
	 */
	public static function uses_start_duration_configuration( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return 'start_time_duration' === $journey_id;
	}

	/**
	 * Determine whether a journey configures explicit fixed time-slot ranges.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True only for the Fixed Time Slots journey.
	 */
	public static function uses_fixed_time_slots_configuration( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return 'fixed_time_slots' === $journey_id;
	}

	/**
	 * Return journeys that require schedule, form, and appearance setup.
	 *
	 * @return string[] Stable Customer Journey identifiers.
	 */
	public static function get_scheduled_booking_journey_ids() {
		return array_merge( array( 'guided_appointment_flow' ), self::get_time_configuration_journey_ids() );
	}

	/**
	 * Determine whether a journey uses scheduled Booking Form and Appearance setup.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when scheduled Booking Form and Appearance steps apply.
	 */
	public static function uses_scheduled_booking_route( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return in_array( $journey_id, self::get_scheduled_booking_journey_ids(), true );
	}

	/**
	 * Determine whether Working Hours belongs to one journey's active route.
	 *
	 * First-date start and last-date end bookings use their explicit boundary
	 * times across a multi-day range. Saving that journey disables the global
	 * Working Hours restriction, so exposing a later page that can turn the
	 * restriction back on would contradict the selected flow.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when the route includes Working Hours.
	 */
	public static function uses_working_hours_configuration( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return self::uses_scheduled_booking_route( $journey_id ) && 'first_start_last_end' !== $journey_id;
	}

	/**
	 * Return every journey whose active route contains Booking Form.
	 *
	 * This list is the common contract for route construction, journey-specific
	 * recommendations, contextual validation, and transition tests.
	 *
	 * @return string[] Stable Customer Journey identifiers.
	 */
	public static function get_booking_form_journey_ids() {
		return array_merge(
			self::get_scheduled_booking_journey_ids(),
			self::get_booking_resources_journey_ids()
		);
	}

	/**
	 * Determine whether a journey configures a Booking Form and Appearance.
	 *
	 * Most scheduled journeys also configure Working Hours. The First-date start
	 * and last-date end journey, full-day journeys, and date-range journeys skip
	 * Working Hours while still requiring Booking Form and Appearance.
	 *
	 * @param mixed $journey_id Untrusted or stored Customer Journey identifier.
	 *
	 * @return bool True when Booking Form and Appearance belong to the route.
	 */
	public static function uses_booking_form_and_appearance_route( $journey_id ) {
		$journey_id = sanitize_key( is_scalar( $journey_id ) ? (string) $journey_id : '' );

		return in_array( $journey_id, self::get_booking_form_journey_ids(), true );
	}

	/**
	 * Determine whether Customer Journey was saved after a downstream step.
	 *
	 * Progressive saves record the server-observed checkpoint revision. Comparing
	 * those revisions gives downstream modules a durable transition signal that
	 * survives refreshes and cannot be forged through a query argument. The signal
	 * is consumed when the downstream step is saved at a newer revision.
	 *
	 * @param array<string,mixed> $step_results  Normalized progressive-save results.
	 * @param mixed               $target_step_id Downstream step whose last save is compared.
	 *
	 * @return bool True when Customer Journey has a newer verified save result.
	 */
	public static function has_pending_transition_for_step( array $step_results, $target_step_id ) {
		$target_step_id = sanitize_key( is_scalar( $target_step_id ) ? (string) $target_step_id : '' );
		if ( '' === $target_step_id ) {
			return false;
		}

		$journey_result = isset( $step_results['customer_journey'] ) && is_array( $step_results['customer_journey'] )
			? $step_results['customer_journey']
			: array();
		if ( 'saved' !== ( isset( $journey_result['status'] ) ? $journey_result['status'] : '' ) ) {
			return false;
		}

		$target_result = isset( $step_results[ $target_step_id ] ) && is_array( $step_results[ $target_step_id ] )
			? $step_results[ $target_step_id ]
			: array();
		$journey_revision = max( 0, (int) ( isset( $journey_result['source_revision'] ) ? $journey_result['source_revision'] : 0 ) );
		$target_revision  = 'saved' === ( isset( $target_result['status'] ) ? $target_result['status'] : '' )
			? max( 0, (int) ( isset( $target_result['source_revision'] ) ? $target_result['source_revision'] : 0 ) )
			: 0;

		return $journey_revision > $target_revision;
	}
}

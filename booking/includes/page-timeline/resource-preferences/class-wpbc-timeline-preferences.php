<?php
/**
 * Server-approved Timeline presentation preferences.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Read, validate, and save per-user Timeline presentation preferences.
 */
final class WPBC_Timeline_Preferences {

	/**
	 * User-option key for site-scoped Timeline presentation preferences.
	 *
	 * @var string
	 */
	const USER_OPTION_KEY = 'booking_custom_wpbc_timeline_resource_preferences';

	/** @var WPBC_Timeline_Resource_View_Preferences Versioned storage owner. */
	private $resource_view_preferences;

	/**
	 * Construct the backward-compatible Timeline preference facade.
	 *
	 * @param WPBC_Timeline_Resource_View_Preferences|null $resource_view_preferences Optional injected storage owner.
	 */
	public function __construct( $resource_view_preferences = null ) {
		$this->resource_view_preferences = $resource_view_preferences instanceof WPBC_Timeline_Resource_View_Preferences
			? $resource_view_preferences
			: new WPBC_Timeline_Resource_View_Preferences();
	}

	/**
	 * Read the complete site-scoped user-meta record.
	 *
	 * WordPress user options are stored in user meta and receive the current
	 * site's prefix on multisite. Keeping this accessor centralized preserves
	 * the existing Resource-expansion record while toolbar fields are added.
	 *
	 * @return array<string,mixed> Stored preference record.
	 */
	private function get_stored_preferences() {
		return $this->resource_view_preferences->get_record();
	}

	/**
	 * Return only preferences approved by server configuration and ownership.
	 *
	 * Resource selection, expansion, navigation, and density change presentation
	 * only. This class never updates a Resource, booking, availability rule, or
	 * rate.
	 *
	 * @param array<int,array<string,mixed>> $resources Authorized Resources.
	 *
	 * @return array<string,mixed> JSON-safe preference contract.
	 */
	public function get_preferences( $resources ) {
		$configuration  = wpbc_timeline_get_configuration();
		$stored         = $this->get_stored_preferences();
		$resource_view  = $stored['resource_view'];
		$toolbar        = $stored['toolbar'];
		$saved_window   = $this->get_initial_window_request();
		$authorized_ids = array_values( array_filter( array_map( 'absint', wp_list_pluck( $resources, 'id' ) ) ) );
		$selected_ids   = WPBC_Timeline_Resource_View_Preferences::SELECTION_MODE_EXPLICIT === $resource_view['selection_mode']
			? array_values( array_intersect( $authorized_ids, $resource_view['selected_resource_ids'] ) )
			: $authorized_ids;
		$expandable_ids = array_values(
			array_map(
				'absint',
				wp_list_pluck(
					array_filter(
						$resources,
						static function ( $resource ) {
							return ! empty( $resource['is_expandable'] );
						}
					),
					'id'
				)
			)
		);
		$view_id = isset( $toolbar['view'] ) && is_scalar( $toolbar['view'] )
			? sanitize_key( (string) $toolbar['view'] )
			: $configuration['default_view'];
		if ( ! isset( $configuration['supported_views'][ $view_id ] ) ) {
			$view_id = $configuration['default_view'];
		}

		return array(
			'view'                  => $view_id,
			'anchor_date'           => isset( $saved_window['anchor_date'] ) ? $saved_window['anchor_date'] : '',
			'anchor_ratio'          => isset( $saved_window['anchor_ratio'] ) ? $saved_window['anchor_ratio'] : 0,
			'window_days'           => isset( $saved_window['window_days'] ) ? $saved_window['window_days'] : 0,
			'window_months'         => isset( $saved_window['window_months'] ) ? $saved_window['window_months'] : 0,
			'visual_zoom_percent'   => $this->normalize_visual_zoom_percent(
				isset( $toolbar['visual_zoom_percent'] ) ? $toolbar['visual_zoom_percent'] : $configuration['visual_zoom']['default_percent']
			),
			'selected_resource_ids' => $selected_ids,
			'expanded_resource_ids' => array_values( array_intersect( $authorized_ids, $resource_view['expanded_resource_ids'] ) ),
			'expanded_parent_ids'   => $this->resource_view_preferences->has_stored_resource_view_field( 'expanded_parent_ids' )
				? array_values( array_intersect( $expandable_ids, $resource_view['expanded_parent_ids'] ) )
				: $expandable_ids,
			'allowed_views'         => array_keys( $configuration['supported_views'] ),
			'maximum_resources'     => absint( $configuration['limits']['maximum_resources'] ),
			'is_persisted'          => $this->resource_view_preferences->has_stored_record(),
		);
	}

	/**
	 * Return a validated saved window request for the initial Timeline read.
	 *
	 * Incomplete legacy records are ignored so the configured default remains
	 * authoritative until a user explicitly changes a Timeline toolbar control.
	 *
	 * @return array<string,mixed> Saved request, or an empty array.
	 */
	public function get_initial_window_request() {
		$configuration = wpbc_timeline_get_configuration();
		$stored        = $this->get_stored_preferences();
		$toolbar       = $stored['toolbar'];
		$anchor_date   = $this->normalize_date( isset( $toolbar['anchor_date'] ) ? $toolbar['anchor_date'] : '' );
		$view_id       = isset( $toolbar['view'] ) && is_scalar( $toolbar['view'] ) ? sanitize_key( (string) $toolbar['view'] ) : '';
		$window_days   = isset( $toolbar['window_days'] ) && is_scalar( $toolbar['window_days'] ) && preg_match( '/^\d+$/', (string) $toolbar['window_days'] )
			? (int) $toolbar['window_days']
			: -1;
		$window_months = isset( $toolbar['window_months'] ) && is_scalar( $toolbar['window_months'] ) && preg_match( '/^\d+$/', (string) $toolbar['window_months'] )
			? (int) $toolbar['window_months']
			: -1;

		if (
			'' === $anchor_date
			|| ! isset( $configuration['supported_views'][ $view_id ] )
			|| 0 > $window_days
			|| 0 > $window_months
			|| ( 0 === $window_days && 0 === $window_months )
			|| ( 0 < $window_days && 0 < $window_months )
			|| $window_days > absint( $configuration['limits']['maximum_window_days'] )
			|| $window_months > absint( $configuration['limits']['maximum_window_months'] )
		) {
			return array();
		}

		$request = array(
			'anchor_date'  => $anchor_date,
			'anchor_ratio' => isset( $toolbar['anchor_ratio'] ) && is_numeric( $toolbar['anchor_ratio'] )
				? max( 0, min( 1, (float) $toolbar['anchor_ratio'] ) )
				: 0,
			'view'         => $view_id,
		);
		if ( 0 < $window_months ) {
			$request['window_months'] = $window_months;
		} else {
			$request['window_days'] = max( 1, $window_days );
		}

		return $request;
	}

	/**
	 * Validate and save one complete toolbar preference snapshot.
	 *
	 * The method updates only toolbar-owned keys and preserves existing Resource
	 * selection and expansion fields in the same backward-compatible user-meta
	 * record. No booking, Resource, Availability, or Pricing data is changed.
	 *
	 * @param mixed $request_values Untrusted toolbar preference values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized saved fields or safe error.
	 */
	public function save_toolbar_preferences( $request_values ) {
		$configuration  = wpbc_timeline_get_configuration();
		$request_values = is_array( $request_values ) ? $request_values : array();
		$anchor_date    = $this->normalize_date( isset( $request_values['anchor_date'] ) ? $request_values['anchor_date'] : '' );
		$view_id        = isset( $request_values['view'] ) && is_scalar( $request_values['view'] )
			? sanitize_key( (string) $request_values['view'] )
			: '';
		$window_days    = isset( $request_values['window_days'] ) && is_scalar( $request_values['window_days'] ) && preg_match( '/^\d+$/', (string) $request_values['window_days'] )
			? (int) $request_values['window_days']
			: -1;
		$window_months  = isset( $request_values['window_months'] ) && is_scalar( $request_values['window_months'] ) && preg_match( '/^\d+$/', (string) $request_values['window_months'] )
			? (int) $request_values['window_months']
			: -1;
		$anchor_ratio   = isset( $request_values['anchor_ratio'] ) && is_scalar( $request_values['anchor_ratio'] ) && is_numeric( $request_values['anchor_ratio'] )
			? (float) $request_values['anchor_ratio']
			: -1;
		$zoom_candidate = isset( $request_values['visual_zoom_percent'] ) && is_scalar( $request_values['visual_zoom_percent'] ) && preg_match( '/^\d+$/', (string) $request_values['visual_zoom_percent'] )
			? (int) $request_values['visual_zoom_percent']
			: -1;
		$zoom_config    = $configuration['visual_zoom'];

		if (
			'' === $anchor_date
			|| ! isset( $configuration['supported_views'][ $view_id ] )
			|| 0 > $window_days
			|| 0 > $window_months
			|| ( 0 === $window_days && 0 === $window_months )
			|| ( 0 < $window_days && 0 < $window_months )
			|| $window_days > absint( $configuration['limits']['maximum_window_days'] )
			|| $window_months > absint( $configuration['limits']['maximum_window_months'] )
			|| 0 > $anchor_ratio
			|| 1 < $anchor_ratio
			|| $zoom_candidate < absint( $zoom_config['min_percent'] )
			|| $zoom_candidate > absint( $zoom_config['max_percent'] )
			|| 0 !== ( $zoom_candidate - absint( $zoom_config['min_percent'] ) ) % max( 1, absint( $zoom_config['step_percent'] ) )
		) {
			return new WP_Error(
				'wpbc_timeline_preferences_invalid',
				__( 'The Timeline display preferences are invalid. Reload the page and try again.', 'booking' ),
				array( 'status' => 400 )
			);
		}

		$normalized = array(
			'anchor_date'         => $anchor_date,
			'anchor_ratio'        => $anchor_ratio,
			'view'                => $view_id,
			'window_days'         => 0 < $window_months ? 0 : max( 1, $window_days ),
			'window_months'       => $window_months,
			'visual_zoom_percent' => $zoom_candidate,
		);
		if ( ! $this->resource_view_preferences->save_toolbar( $normalized ) ) {
			return new WP_Error(
				'wpbc_timeline_preferences_not_saved',
				__( 'The Timeline display preferences could not be saved.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		return $normalized;
	}

	/**
	 * Reset the complete Timeline display preference in one site-scoped write.
	 *
	 * The toolbar Reset control owns the complete current-user Timeline view:
	 * range, scale, density, Resource selection, Resource sort, paging, and
	 * expansion. Booking, Resource, Availability, and Pricing data are untouched.
	 * Unknown future fields remain preserved by the storage owner.
	 *
	 * @return true|WP_Error True when reset, or a safe persistence error.
	 */
	public function reset_toolbar_preferences() {
		if ( ! $this->resource_view_preferences->reset_all() ) {
			return new WP_Error(
				'wpbc_timeline_preferences_not_reset',
				__( 'The Timeline display preferences could not be reset.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		return true;
	}

	/**
	 * Normalize a strict site-local calendar date.
	 *
	 * @param mixed $candidate Untrusted date candidate.
	 *
	 * @return string Strict YYYY-MM-DD date, or an empty string.
	 */
	private function normalize_date( $candidate ) {
		if ( ! is_scalar( $candidate ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $candidate ) ) {
			return '';
		}
		$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$date     = DateTimeImmutable::createFromFormat( '!Y-m-d', (string) $candidate, $timezone );

		return $date && $date->format( 'Y-m-d' ) === (string) $candidate ? (string) $candidate : '';
	}

	/**
	 * Normalize visual density to the configured bounded step.
	 *
	 * @param mixed $candidate Untrusted density percentage.
	 *
	 * @return int Bounded density percentage.
	 */
	private function normalize_visual_zoom_percent( $candidate ) {
		$zoom       = wpbc_timeline_get_configuration()['visual_zoom'];
		$minimum    = absint( $zoom['min_percent'] );
		$maximum    = absint( $zoom['max_percent'] );
		$step       = max( 1, absint( $zoom['step_percent'] ) );
		$percentage = is_numeric( $candidate ) ? (int) round( (float) $candidate ) : absint( $zoom['default_percent'] );
		$percentage = max( $minimum, min( $maximum, $percentage ) );
		$percentage = $minimum + (int) round( ( $percentage - $minimum ) / $step ) * $step;

		return min( $maximum, $percentage );
	}
}

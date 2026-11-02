<?php
/**
 * Request normalization and window-budget validation for the Timeline.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize only allow-listed Timeline read parameters.
 *
 * This validator never reads request globals. Callers must pass an explicit
 * array, which keeps internal reads and future authenticated transports on the
 * same bounded contract.
 */
final class WPBC_Timeline_Request_Validator {

	/** @var WPBC_Timeline_Axis Shared time-axis service. */
	private $axis;

	/**
	 * Construct the validator with the shared axis authority.
	 *
	 * @param WPBC_Timeline_Axis|null $axis Optional axis service.
	 */
	public function __construct( $axis = null ) {
		$this->axis = $axis ? $axis : new WPBC_Timeline_Axis();
	}

	/**
	 * Normalize a paged Resource-list request.
	 *
	 * @param mixed $request_values Untrusted Resource-list values.
	 *
	 * @return array<string,mixed> Bounded Resource-list request.
	 */
	public function normalize_resource_request( $request_values ) {
		$configuration  = wpbc_timeline_get_configuration();
		$limits         = $configuration['limits'];
		$request_values = is_array( $request_values ) ? $request_values : array();
		$page_number    = isset( $request_values['page'] ) ? max( 1, absint( $request_values['page'] ) ) : 1;
		$page_size      = isset( $request_values['per_page'] ) ? absint( $request_values['per_page'] ) : $limits['default_resources'];
		$page_size      = max( 1, min( $limits['maximum_resources'], $page_size ) );
		$search         = isset( $request_values['search'] ) && is_scalar( $request_values['search'] )
			? sanitize_text_field( (string) $request_values['search'] )
			: '';
		$search         = function_exists( 'mb_substr' ) ? mb_substr( $search, 0, 200 ) : substr( $search, 0, 200 );

		return array(
			'page'       => $page_number,
			'per_page'   => $page_size,
			'offset'     => ( $page_number - 1 ) * $page_size,
			'search'     => $search,
			'sort_by'    => 'hierarchy',
			'sort_order' => 'asc',
		);
	}

	/**
	 * Normalize and validate one bounded Timeline window.
	 *
	 * The visible start is always derived from a trusted anchor and an allow-
	 * listed adjacent-window position. Arbitrary owner and site identifiers are
	 * not part of this contract.
	 *
	 * @param mixed $request_values Untrusted window values.
	 * @param int   $resource_count Number of authorized visible Resources.
	 *
	 * @return array<string,mixed>|WP_Error Bounded window or safe validation error.
	 */
	public function normalize_window_request( $request_values, $resource_count ) {
		$configuration  = wpbc_timeline_get_configuration();
		$limits         = $configuration['limits'];
		$request_values = is_array( $request_values ) ? $request_values : array();
		$timezone       = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$has_anchor_date = array_key_exists( 'anchor_date', $request_values );
		$has_anchor_at   = array_key_exists( 'anchor_at', $request_values );
		$anchor_at       = $has_anchor_at ? $this->parse_instant( $request_values['anchor_at'], $timezone ) : null;
		$anchor_date     = $has_anchor_date ? $this->parse_date( $request_values['anchor_date'], $timezone ) : null;

		if ( $has_anchor_at && null === $anchor_at ) {
			return new WP_Error(
				'wpbc_timeline_anchor_invalid',
				__( 'The requested Timeline anchor is invalid.', 'booking' )
			);
		}

		if ( $has_anchor_date && null === $anchor_date ) {
			return new WP_Error(
				'wpbc_timeline_anchor_date_invalid',
				__( 'The requested Timeline start date is invalid.', 'booking' )
			);
		}
		if ( null === $anchor_date ) {
			$anchor_date = $anchor_at ? $anchor_at->setTime( 0, 0, 0 ) : new DateTimeImmutable( 'today', $timezone );
		}
		if ( null === $anchor_at ) {
			$anchor_at = $anchor_date;
		}

		$window_months = 0;
		if ( array_key_exists( 'window_months', $request_values ) ) {
			$requested_window_months = $request_values['window_months'];
			if ( ! is_scalar( $requested_window_months ) || ! preg_match( '/^[1-2]$/', (string) $requested_window_months ) ) {
				return new WP_Error(
					'wpbc_timeline_window_months_invalid',
					__( 'Choose a supported Timeline month range.', 'booking' )
				);
			}
			$window_months = (int) $requested_window_months;
			if ( $window_months < 1 || $window_months > $limits['maximum_window_months'] ) {
				return new WP_Error(
					'wpbc_timeline_window_months_invalid',
					sprintf(
						/* translators: %d: maximum supported Timeline range in calendar months. */
						__( 'Choose a Timeline month range from 1 through %d calendar months.', 'booking' ),
						absint( $limits['maximum_window_months'] )
					),
					array( 'maximum_window_months' => absint( $limits['maximum_window_months'] ) )
				);
			}
		}

		$window_days = isset( $request_values['window_days'] ) ? absint( $request_values['window_days'] ) : $limits['default_window_days'];
		if ( 0 === $window_months && ( $window_days < 1 || $window_days > $limits['maximum_window_days'] ) ) {
			return new WP_Error(
				'wpbc_timeline_window_days_invalid',
				sprintf(
					/* translators: 1: requested Timeline range in days, 2: maximum supported range in days. */
					__( 'The requested Timeline range is %1$d days, but the maximum supported range is %2$d days.', 'booking' ),
					$window_days,
					absint( $limits['maximum_window_days'] )
				),
				array(
					'maximum_window_days' => absint( $limits['maximum_window_days'] ),
					'suggested_window_days' => absint( $limits['default_window_days'] ),
				)
			);
		}

		if ( isset( $request_values['window_position'] ) && ! is_numeric( $request_values['window_position'] ) ) {
			return new WP_Error(
				'wpbc_timeline_window_position_invalid',
				__( 'The requested Timeline window position is invalid.', 'booking' )
			);
		}
		$window_position = isset( $request_values['window_position'] ) ? (int) $request_values['window_position'] : 0;
		if ( ! in_array( $window_position, array( -1, 0, 1 ), true ) ) {
			return new WP_Error(
				'wpbc_timeline_window_position_invalid',
				__( 'The requested Timeline window is outside the supported adjacent range.', 'booking' )
			);
		}

		$view_id = isset( $request_values['view'] ) && is_scalar( $request_values['view'] )
			? sanitize_key( (string) $request_values['view'] )
			: $configuration['default_view'];
		if ( ! isset( $configuration['supported_views'][ $view_id ] ) ) {
			return new WP_Error(
				'wpbc_timeline_view_invalid',
				__( 'The requested Timeline scale is not supported.', 'booking' )
			);
		}
		$anchor_ratio = isset( $request_values['anchor_ratio'] ) && is_numeric( $request_values['anchor_ratio'] )
			? max( 0, min( 1, (float) $request_values['anchor_ratio'] ) )
			: 0;
		if ( 0 < $window_months ) {
			$month_origin = 0 === $window_position
				? $this->position_calendar_month_window( $anchor_date, $window_months, $anchor_ratio )
				: $anchor_date;
			$start_date  = $this->shift_calendar_months( $month_origin, $window_position * $window_months );
			$end_date    = $this->shift_calendar_months( $start_date, $window_months );
			$window_days = absint( $start_date->diff( $end_date )->format( '%a' ) );
		} else {
			$anchor_offset_days = 0 === $window_position ? (int) floor( $window_days * $anchor_ratio ) : 0;
			$start_date         = $anchor_date->modify( ( ( $window_position * $window_days ) - $anchor_offset_days ) . ' days' );
			$end_date           = $start_date->modify( '+' . $window_days . ' days' );
		}
		if ( $window_days > $limits['maximum_window_days'] ) {
			return new WP_Error(
				'wpbc_timeline_window_days_invalid',
				sprintf(
					/* translators: 1: requested Timeline range in days, 2: maximum supported range in days. */
					__( 'The requested Timeline range is %1$d days, but the maximum supported range is %2$d days.', 'booking' ),
					$window_days,
					absint( $limits['maximum_window_days'] )
				),
				array(
					'maximum_window_days'   => absint( $limits['maximum_window_days'] ),
					'suggested_window_days' => absint( $limits['default_window_days'] ),
				)
			);
		}
		$resource_count = max( 0, absint( $resource_count ) );
		$cell_minutes   = absint( $configuration['supported_views'][ $view_id ]['cell_minutes'] );
		$axis_cells     = $this->axis->count_cells( $start_date, $end_date, $cell_minutes );
		$axis_buckets   = $resource_count * $axis_cells;
		if ( $axis_buckets > $limits['maximum_axis_buckets'] ) {
			$maximum_days = $this->get_maximum_window_days( $start_date, $window_days, $cell_minutes, $resource_count, $limits['maximum_axis_buckets'] );

			return new WP_Error(
				'wpbc_timeline_axis_budget_exceeded',
				sprintf(
					/* translators: 1: required Resource/cell slots, 2: maximum supported Resource/cell slots. */
					__( 'This Timeline range requires %1$d Resource/cell slots, but the safe maximum is %2$d. Choose fewer Resources, a shorter range, or a larger time scale.', 'booking' ),
					$axis_buckets,
					absint( $limits['maximum_axis_buckets'] )
				),
				array(
					'axis_buckets'          => $axis_buckets,
					'maximum_axis_buckets'  => absint( $limits['maximum_axis_buckets'] ),
					'suggested_window_days' => min( $window_days, $maximum_days ),
					'suggested_resources'   => min( $resource_count, absint( $limits['default_resources'] ) ),
				)
			);
		}

		return array(
			'anchor_date'     => $anchor_date->format( 'Y-m-d' ),
			'anchor_at'       => $anchor_at->format( 'Y-m-d\TH:i:sP' ),
			'start_date'      => $start_date->format( 'Y-m-d' ),
			'end_date'        => $end_date->format( 'Y-m-d' ),
			'start_at'        => $start_date->format( 'Y-m-d\TH:i:sP' ),
			'end_at'          => $end_date->format( 'Y-m-d\TH:i:sP' ),
			'window_days'     => $window_days,
			'window_months'   => $window_months,
			'window_position' => $window_position,
			'anchor_ratio'    => $anchor_ratio,
			'view'            => $view_id,
			'cell_minutes'    => $cell_minutes,
			'axis_cells'      => $axis_cells,
			'axis_buckets'    => $axis_buckets,
			'timezone'        => $timezone->getName(),
			'request_generation' => isset( $request_values['request_generation'] ) ? absint( $request_values['request_generation'] ) : 0,
		);
	}

	/**
	 * Return the server-authoritative scale policy for one validated window.
	 *
	 * This exact-window policy identifies combinations whose current
	 * Resource-by-axis cost exceeds the server budget. The bootstrap metadata
	 * uses the separate maximum-Resource preset policy so the menu never offers
	 * combinations that exceed the configured worst-case envelope.
	 *
	 * @param array<string,mixed> $window         Validated Timeline window.
	 * @param int                 $resource_count Authorized visible Resource count.
	 *
	 * @return array<string,mixed> Data-only view policy.
	 */
	public function get_view_policy( $window, $resource_count ) {
		$configuration = wpbc_timeline_get_configuration();
		$limits        = $configuration['limits'];
		$timezone      = ! empty( $window['timezone'] ) ? new DateTimeZone( (string) $window['timezone'] ) : wp_timezone();
		$window_start  = new DateTimeImmutable( (string) $window['start_at'], $timezone );
		$window_end    = new DateTimeImmutable( (string) $window['end_at'], $timezone );
		$resource_count  = max( 0, absint( $resource_count ) );
		$allowed_views   = array();
		$disabled_views  = array();

		foreach ( $configuration['supported_views'] as $view_id => $view ) {
			$cell_minutes = absint( $view['cell_minutes'] );
			$axis_cells   = $this->axis->count_cells( $window_start, $window_end, $cell_minutes );
			$axis_buckets = $resource_count * $axis_cells;
			$is_allowed   = $axis_buckets <= absint( $limits['maximum_axis_buckets'] );

			if ( $is_allowed ) {
				$allowed_views[] = sanitize_key( $view_id );
			} else {
				$disabled_views[] = array(
					'id'           => sanitize_key( $view_id ),
					'axis_buckets' => $axis_buckets,
					'reason'       => 'axis_budget',
				);
			}
		}

		return array(
			'allowed_views'  => $allowed_views,
			'disabled_views' => $disabled_views,
			'is_locked'      => false,
			'required_view'  => '',
		);
	}

	/**
	 * Return configured cell scales safe at the Resource maximum for one preset.
	 *
	 * Calendar-month presets use their largest possible Gregorian day count.
	 * The explicit range-and-scale option registry determines which views belong
	 * to the visible menu for this preset. This keeps exact option titles, values,
	 * ordering, and request mappings in one domain-owned configuration while the
	 * maximum-Resource budget remains authoritative. Exact site-timezone and
	 * DST-aware validation still runs for every request before data is loaded.
	 *
	 * @param array<string,mixed> $preset    Configured Timeline preset.
	 * @param string              $preset_id Optional configured preset identifier.
	 *
	 * @return array<string,mixed> Maximum-Resource scale policy and diagnostics.
	 */
	public function get_maximum_resource_preset_view_policy( $preset, $preset_id = '' ) {
		$configuration        = wpbc_timeline_get_configuration();
		$limits               = $configuration['limits'];
		$preset               = is_array( $preset ) ? $preset : array();
		$window_months        = isset( $preset['window_months'] ) ? absint( $preset['window_months'] ) : 0;
		$window_days          = isset( $preset['window_days'] ) ? absint( $preset['window_days'] ) : 0;
		$maximum_window_days  = 0 < $window_months ? 31 * $window_months : $window_days;
		$maximum_window_days  = min( absint( $limits['maximum_window_days'] ), $maximum_window_days );
		$maximum_resources    = max( 1, absint( $limits['maximum_resources'] ) );
		$maximum_buckets      = absint( $limits['maximum_axis_buckets'] );
		$minutes_per_day      = absint( DAY_IN_SECONDS / MINUTE_IN_SECONDS );
		$menu_view_ids        = null;
		$allowed_views        = array();
		$removed_views        = array();

		$preset_id = sanitize_key( $preset_id );
		if ( '' === $preset_id ) {
			foreach ( $configuration['presets'] as $configured_preset_id => $configured_preset ) {
				if ( $configured_preset === $preset ) {
					$preset_id = sanitize_key( $configured_preset_id );
					break;
				}
			}
		}
		if ( '' !== $preset_id && isset( $configuration['range_scale_options'] ) && is_array( $configuration['range_scale_options'] ) ) {
			$menu_view_ids = array();
			foreach ( $configuration['range_scale_options'] as $range_scale_option ) {
				if ( ! is_array( $range_scale_option ) || $preset_id !== sanitize_key( isset( $range_scale_option['preset_id'] ) ? $range_scale_option['preset_id'] : '' ) ) {
					continue;
				}
				$option_view_id = sanitize_key( isset( $range_scale_option['view_id'] ) ? $range_scale_option['view_id'] : '' );
				if ( '' !== $option_view_id ) {
					$menu_view_ids[ $option_view_id ] = true;
				}
			}
		}

		foreach ( $configuration['supported_views'] as $view_id => $view ) {
			$cell_minutes = max( 5, absint( $view['cell_minutes'] ) );
			$axis_cells   = $minutes_per_day === $cell_minutes
				? $maximum_window_days
				: (int) ceil( ( $maximum_window_days * $minutes_per_day ) / $cell_minutes );
			$axis_buckets = $maximum_resources * $axis_cells;

			$removal_reason    = '';
			$sanitized_view_id = sanitize_key( $view_id );
			if ( array() === $menu_view_ids ) {
				$removal_reason = 'preset_excluded';
			} elseif ( is_array( $menu_view_ids ) && ! isset( $menu_view_ids[ $sanitized_view_id ] ) ) {
				$removal_reason = 'scale_excluded';
			} elseif ( $axis_buckets > $maximum_buckets ) {
				$removal_reason = 'maximum_resource_axis_budget';
			}

			if ( '' === $removal_reason ) {
				$allowed_views[] = $sanitized_view_id;
				continue;
			}

			$removed_views[] = array(
				'id'           => $sanitized_view_id,
				'axis_cells'   => $axis_cells,
				'axis_buckets' => $axis_buckets,
				'reason'       => $removal_reason,
			);
		}

		return array(
			'allowed_views'        => $allowed_views,
			'removed_views'        => $removed_views,
			'maximum_resources'    => $maximum_resources,
			'maximum_axis_cells'   => 0 < $maximum_resources ? (int) floor( $maximum_buckets / $maximum_resources ) : 0,
			'maximum_axis_buckets' => $maximum_buckets,
		);
	}

	/**
	 * Shift a site-local date by complete calendar months.
	 *
	 * The original day number is retained where the destination month supports
	 * it and otherwise clamps to that month's final date. This avoids PHP's
	 * overflow behavior for dates such as January 31 plus one month.
	 *
	 * @param DateTimeImmutable $source_date Source site-local date.
	 * @param int               $month_delta Signed number of months.
	 *
	 * @return DateTimeImmutable Shifted site-local date at midnight.
	 */
	private function shift_calendar_months( $source_date, $month_delta ) {
		$source_day       = absint( $source_date->format( 'j' ) );
		$source_month     = $source_date->modify( 'first day of this month' )->setTime( 0, 0, 0 );
		$month_modifier   = 0 <= $month_delta ? '+' . (int) $month_delta . ' months' : (int) $month_delta . ' months';
		$destination      = $source_month->modify( $month_modifier );
		$destination_day  = min( $source_day, absint( $destination->format( 't' ) ) );

		return $destination->setDate(
			absint( $destination->format( 'Y' ) ),
			absint( $destination->format( 'n' ) ),
			$destination_day
		);
	}

	/**
	 * Position a calendar-month window around its captured viewport anchor.
	 *
	 * Calendar-month spans vary from 28 to 62 days. Iterating against the actual
	 * shifted span keeps the requested site-local date at the same approximate
	 * viewport ratio without converting date arithmetic into fixed seconds. This
	 * preserves the visible anchor across DST transitions and semantic detail
	 * changes while a zero ratio retains the established start-date behavior.
	 *
	 * @param DateTimeImmutable $anchor_date   Captured site-local anchor date.
	 * @param int               $window_months Allow-listed calendar-month span.
	 * @param float             $anchor_ratio  Desired viewport ratio from zero to one.
	 *
	 * @return DateTimeImmutable Site-local start date for the month window.
	 */
	private function position_calendar_month_window( $anchor_date, $window_months, $anchor_ratio ) {
		$start_date   = $anchor_date;
		$anchor_ratio = max( 0, min( 1, (float) $anchor_ratio ) );

		if ( 0.0 >= $anchor_ratio ) {
			return $start_date;
		}

		for ( $iteration = 0; $iteration < 3; ++$iteration ) {
			$end_date        = $this->shift_calendar_months( $start_date, $window_months );
			$window_days     = absint( $start_date->diff( $end_date )->format( '%a' ) );
			$anchor_days     = (int) floor( $window_days * $anchor_ratio );
			$positioned_date = $anchor_date->modify( '-' . $anchor_days . ' days' );

			if ( $positioned_date->format( 'Y-m-d' ) === $start_date->format( 'Y-m-d' ) ) {
				break;
			}
			$start_date = $positioned_date;
		}

		return $start_date;
	}

	/**
	 * Find the largest calendar-day window that satisfies the shared budget.
	 *
	 * @param DateTimeImmutable $start_date      Candidate site-local start.
	 * @param int               $requested_days  Requested number of days.
	 * @param int               $cell_minutes    Allow-listed cell duration.
	 * @param int               $resource_count  Authorized Resource count.
	 * @param int               $maximum_buckets Approved total bucket budget.
	 *
	 * @return int Suggested bounded window days.
	 */
	private function get_maximum_window_days( $start_date, $requested_days, $cell_minutes, $resource_count, $maximum_buckets ) {
		for ( $window_days = max( 1, absint( $requested_days ) ); $window_days >= 1; --$window_days ) {
			$window_end = $start_date->modify( '+' . $window_days . ' days' );
			$cell_count = $this->axis->count_cells( $start_date, $window_end, $cell_minutes );
			if ( max( 1, absint( $resource_count ) ) * $cell_count <= absint( $maximum_buckets ) ) {
				return $window_days;
			}
		}

		return 1;
	}

	/**
	 * Normalize a booking-card status visibility filter.
	 *
	 * Occupancy readers receive the authorized Resource universe separately and
	 * never use this filter to remove occupied intervals.
	 *
	 * @param mixed $request_values Untrusted window values.
	 *
	 * @return array<int,string> Allow-listed card statuses.
	 */
	public function normalize_visible_statuses( $request_values ) {
		$request_values = is_array( $request_values ) ? $request_values : array();
		$statuses       = isset( $request_values['visible_statuses'] ) && is_array( $request_values['visible_statuses'] )
			? $request_values['visible_statuses']
			: array( 'approved', 'pending' );
		$statuses       = array_map( 'sanitize_key', array_filter( $statuses, 'is_scalar' ) );

		return array_values( array_intersect( array( 'approved', 'pending' ), array_unique( $statuses ) ) );
	}

	/**
	 * Parse one strict SQL date in the site timezone.
	 *
	 * @param mixed        $date_value Candidate date.
	 * @param DateTimeZone $timezone   Site timezone.
	 *
	 * @return DateTimeImmutable|null Parsed midnight or null.
	 */
	private function parse_date( $date_value, $timezone ) {
		if ( ! is_scalar( $date_value ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $date_value ) ) {
			return null;
		}

		$parsed_date = DateTimeImmutable::createFromFormat( '!Y-m-d', (string) $date_value, $timezone );
		$date_errors = DateTimeImmutable::getLastErrors();
		if ( false !== $date_errors && ( 0 < $date_errors['warning_count'] || 0 < $date_errors['error_count'] ) ) {
			return null;
		}

		return $parsed_date instanceof DateTimeImmutable && $parsed_date->format( 'Y-m-d' ) === (string) $date_value ? $parsed_date : null;
	}

	/**
	 * Parse one strict offset-explicit RFC3339 anchor.
	 *
	 * The supplied offset identifies repeated local times. The resulting instant
	 * is normalized to the site timezone without accepting an offset-less wall
	 * time that could be ambiguous across a DST transition.
	 *
	 * @param mixed        $instant_value Candidate instant.
	 * @param DateTimeZone $timezone      Site timezone.
	 *
	 * @return DateTimeImmutable|null Parsed site-local instant or null.
	 */
	private function parse_instant( $instant_value, $timezone ) {
		if ( ! is_scalar( $instant_value ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/', (string) $instant_value ) ) {
			return null;
		}

		try {
			return ( new DateTimeImmutable( (string) $instant_value ) )->setTimezone( $timezone );
		} catch ( Exception $exception ) {
			unset( $exception );
			return null;
		}
	}
}

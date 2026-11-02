<?php
/**
 * Timeline range-selection request validation.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Normalize a local selection draft against the server-owned time axis.
 */
final class WPBC_Timeline_Selection_Validator {

	/** @var WPBC_Timeline_Axis Shared time-axis authority. */
	private $axis;

	/** @var DateTimeZone Authoritative site timezone. */
	private $timezone;

	/** @var WPBC_Timeline_Time_Rows_Selection_Request_Validator Time-row validator. */
	private $time_rows_validator;

	/**
	 * Construct the selection validator.
	 *
	 * @param WPBC_Timeline_Axis|null                                $axis                Optional axis service.
	 * @param DateTimeZone|null                                       $timezone            Optional site timezone.
	 * @param WPBC_Timeline_Time_Rows_Selection_Request_Validator|null $time_rows_validator Optional time-row validator.
	 */
	public function __construct( $axis = null, $timezone = null, $time_rows_validator = null ) {
		$this->axis                = $axis ? $axis : new WPBC_Timeline_Axis();
		$this->timezone            = $timezone instanceof DateTimeZone
			? $timezone
			: ( function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' ) );
		$this->time_rows_validator = $time_rows_validator
			? $time_rows_validator
			: new WPBC_Timeline_Time_Rows_Selection_Request_Validator();
	}

	/**
	 * Validate one half-open, viewport-loaded selection.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Normalized selection or safe error.
	 */
	public function normalize( $request_values ) {
		$request_values   = is_array( $request_values ) ? $request_values : array();
		$configuration    = wpbc_timeline_get_configuration();
		$timezone         = $this->timezone;
		$resource_id      = isset( $request_values['resource_id'] ) ? absint( $request_values['resource_id'] ) : 0;
		$view             = isset( $request_values['view'] ) && is_scalar( $request_values['view'] ) ? sanitize_key( (string) $request_values['view'] ) : '';
		$selection_surface = $this->normalize_selection_surface( $request_values );

		if ( ! $resource_id ) {
			return $this->get_error( 'wpbc_timeline_selection_resource_invalid', __( 'Choose an authorized Booking Resource.', 'booking' ) );
		}
		if ( is_wp_error( $selection_surface ) ) {
			return $selection_surface;
		}
		if ( ! isset( $configuration['supported_views'][ $view ] ) ) {
			return $this->get_error( 'wpbc_timeline_selection_scale_invalid', __( 'Choose a supported Timeline cell scale.', 'booking' ) );
		}

		$cell_minutes           = absint( $configuration['supported_views'][ $view ]['cell_minutes'] );
		$selection_kind         = '';
		$selection_step_minutes = $cell_minutes;
		$is_full_day            = false;
		if ( WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_SURFACE === $selection_surface ) {
			$time_rows_selection = $this->time_rows_validator->normalize( $request_values, $timezone );
			if ( is_wp_error( $time_rows_selection ) ) {
				return $time_rows_selection;
			}
			$start                  = $time_rows_selection['start'];
			$end                    = $time_rows_selection['end'];
			$selection_kind         = $time_rows_selection['selection_kind'];
			$selection_step_minutes = absint( $time_rows_selection['selection_step_minutes'] );
			$is_full_day            = ! empty( $time_rows_selection['is_full_day'] );
		} else {
			if ( array_key_exists( 'selection_step_minutes', $request_values ) ) {
				return $this->get_error( 'wpbc_timeline_selection_step_override', __( 'The Timeline selection step is controlled by the server.', 'booking' ) );
			}
			$start = $this->parse_instant( isset( $request_values['start_at'] ) ? $request_values['start_at'] : null, $timezone );
			$end   = $this->parse_instant( isset( $request_values['end_at'] ) ? $request_values['end_at'] : null, $timezone );
		}
		if ( ! $start || ! $end || $start >= $end ) {
			return $this->get_error( 'wpbc_timeline_selection_range_invalid', __( 'Choose a valid start and end for this Timeline range.', 'booking' ) );
		}

		$duration_minutes       = (int) round( ( $end->getTimestamp() - $start->getTimestamp() ) / MINUTE_IN_SECONDS );
		$maximum_minutes        = absint( $configuration['limits']['maximum_window_days'] ) * ( DAY_IN_SECONDS / MINUTE_IN_SECONDS );
		$minimum_minutes        = WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_SURFACE === $selection_surface
			? $selection_step_minutes
			: $cell_minutes;
		$maximum_range_exceeded = $duration_minutes > $maximum_minutes;
		if ( WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_SURFACE === $selection_surface && $is_full_day ) {
			$local_day_count        = (int) $start->setTime( 0, 0, 0 )->diff( $end->setTime( 0, 0, 0 ) )->format( '%a' );
			$maximum_range_exceeded = $local_day_count > absint( $configuration['limits']['maximum_window_days'] );
		}
		if ( $duration_minutes < $minimum_minutes || $maximum_range_exceeded ) {
			return $this->get_error(
				'wpbc_timeline_selection_range_invalid',
				sprintf(
					/* translators: 1: proposed selection duration in minutes, 2: minimum duration in minutes, 3: maximum duration in minutes. */
					__( 'The selected Timeline range is %1$d minutes. The active scale requires at least %2$d minutes, and the maximum supported range is %3$d minutes.', 'booking' ),
					$duration_minutes,
					$minimum_minutes,
					$maximum_minutes
				)
			);
		}

		$selection_window = $this->build_selection_window( $start, $end, $view, $cell_minutes, $timezone );
		if ( 'native_axis' === $selection_surface ) {
			$axis = $this->axis->build_axis( $selection_window );
		}
		if (
			'native_axis' === $selection_surface
			&& ( ! $this->is_axis_boundary( $axis, $start->getTimestamp() ) || ! $this->is_axis_boundary( $axis, $end->getTimestamp() ) )
		) {
			return $this->get_error(
				'wpbc_timeline_selection_snap_invalid',
				sprintf(
					/* translators: %d: active Timeline cell size in minutes. */
					__( 'The selected range does not align with the active %d-minute Timeline cell scale.', 'booking' ),
					$cell_minutes
				)
			);
		}

		$loaded_start = $this->parse_instant( isset( $request_values['loaded_start_at'] ) ? $request_values['loaded_start_at'] : null, $timezone );
		$loaded_end   = $this->parse_instant( isset( $request_values['loaded_end_at'] ) ? $request_values['loaded_end_at'] : null, $timezone );
		if ( ! $loaded_start || ! $loaded_end || $loaded_start > $start || $loaded_end < $end ) {
			return $this->get_error( 'wpbc_timeline_selection_unloaded', __( 'This range is not fully loaded. Load the missing dates and try again.', 'booking' ) );
		}

		if ( 'native_axis' === $selection_surface ) {
			$is_full_day    = 'day' === $view
				&& '00:00:00' === $start->format( 'H:i:s' )
				&& '00:00:00' === $end->format( 'H:i:s' );
			$selection_kind = $is_full_day
				? WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_KIND_ALL_DAY
				: WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_KIND_TIMED;
		}

		return array(
			'resource_id'            => $resource_id,
			'selection_surface'       => $selection_surface,
			'selection_kind'          => $selection_kind,
			'selection_step_minutes' => $selection_step_minutes,
			'view'                   => $view,
			'cell_minutes'           => $cell_minutes,
			'start_at'               => $start->format( 'Y-m-d\TH:i:sP' ),
			'end_at'                 => $end->format( 'Y-m-d\TH:i:sP' ),
			'start_epoch'            => $start->getTimestamp(),
			'end_epoch'              => $end->getTimestamp(),
			'start_date'             => $start->format( 'Y-m-d' ),
			'end_date'               => $selection_window['end_date'],
			'duration_minutes'       => $duration_minutes,
			'is_full_day'            => $is_full_day,
			'timezone'               => $timezone->getName(),
			'return_context'         => $this->normalize_return_context( isset( $request_values['return_context'] ) ? $request_values['return_context'] : array() ),
		);
	}

	/**
	 * Normalize the allow-listed selection surface while preserving legacy
	 * native requests that predate the explicit surface field.
	 *
	 * Time-row-specific fields require an explicit surface so a malformed new
	 * request cannot silently fall back to native-axis semantics.
	 *
	 * @param array<string,mixed> $request_values Untrusted request values.
	 *
	 * @return string|WP_Error Allow-listed surface or a safe error.
	 */
	private function normalize_selection_surface( $request_values ) {
		$has_surface = isset( $request_values['selection_surface'] ) && is_scalar( $request_values['selection_surface'] );
		if ( ! $has_surface ) {
			if ( array_key_exists( 'selection_kind', $request_values ) || array_key_exists( 'selection_step_minutes', $request_values ) ) {
				return $this->get_error(
					'wpbc_timeline_selection_surface_required',
					__( 'Choose the Timeline surface for this selection.', 'booking' )
				);
			}

			return 'native_axis';
		}

		$selection_surface = sanitize_key( (string) $request_values['selection_surface'] );
		if ( ! in_array( $selection_surface, array( 'native_axis', WPBC_Timeline_Time_Rows_Selection_Config::SELECTION_SURFACE ), true ) ) {
			return $this->get_error(
				'wpbc_timeline_selection_surface_invalid',
				__( 'Choose a supported Timeline selection surface.', 'booking' )
			);
		}

		return $selection_surface;
	}

	/**
	 * Build the complete local-day envelope needed by read repositories.
	 *
	 * @param DateTimeImmutable $start        Selection start.
	 * @param DateTimeImmutable $end          Selection end.
	 * @param string            $view         Allow-listed view.
	 * @param int               $cell_minutes Cell size in minutes.
	 * @param DateTimeZone      $timezone     Site timezone.
	 *
	 * @return array<string,mixed> Internal window values.
	 */
	private function build_selection_window( $start, $end, $view, $cell_minutes, $timezone ) {
		$day_start = $start->setTimezone( $timezone )->setTime( 0, 0, 0 );
		$day_end   = $end->setTimezone( $timezone );
		if ( '00:00:00' !== $day_end->format( 'H:i:s' ) || $day_end <= $day_start ) {
			$day_end = $day_end->setTime( 0, 0, 0 )->modify( '+1 day' );
		}

		return array(
			'view'         => $view,
			'cell_minutes' => $cell_minutes,
			'timezone'     => $timezone->getName(),
			'start_date'   => $day_start->format( 'Y-m-d' ),
			'end_date'     => $day_end->format( 'Y-m-d' ),
			'start_at'     => $day_start->format( 'Y-m-d\TH:i:sP' ),
			'end_at'       => $day_end->format( 'Y-m-d\TH:i:sP' ),
			'anchor_at'    => $start->format( 'Y-m-d\TH:i:sP' ),
		);
	}

	/**
	 * Check whether an epoch is one of the shared axis boundaries.
	 *
	 * @param array<string,mixed> $axis  Axis DTO.
	 * @param int                 $epoch Candidate epoch.
	 *
	 * @return bool True for a start or end boundary.
	 */
	private function is_axis_boundary( $axis, $epoch ) {
		foreach ( isset( $axis['cells'] ) && is_array( $axis['cells'] ) ? $axis['cells'] : array() as $cell ) {
			if ( absint( $cell['start_epoch'] ) === $epoch || absint( $cell['end_epoch'] ) === $epoch ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Parse an RFC 3339 instant and convert it to the site timezone.
	 *
	 * @param mixed        $candidate Candidate value.
	 * @param DateTimeZone $timezone  Site timezone.
	 *
	 * @return DateTimeImmutable|null Parsed instant or null.
	 */
	private function parse_instant( $candidate, $timezone ) {
		if ( ! is_scalar( $candidate ) || ! preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/', (string) $candidate ) ) {
			return null;
		}

		try {
			return ( new DateTimeImmutable( (string) $candidate ) )->setTimezone( $timezone );
		} catch ( Exception $exception ) {
			return null;
		}
	}

	/**
	 * Normalize only non-authoritative presentation state used on return.
	 *
	 * @param mixed $return_context Candidate browser context.
	 *
	 * @return array<string,mixed> Bounded return context.
	 */
	private function normalize_return_context( $return_context ) {
		$return_context = is_array( $return_context ) ? $return_context : array();

		return array(
			'window_days'   => isset( $return_context['window_days'] ) ? min( 62, max( 0, absint( $return_context['window_days'] ) ) ) : 0,
			'window_months' => isset( $return_context['window_months'] ) ? min( 2, max( 0, absint( $return_context['window_months'] ) ) ) : 0,
			'view'          => isset( $return_context['view'] ) && is_scalar( $return_context['view'] ) ? sanitize_key( (string) $return_context['view'] ) : '',
			'anchor_at'     => isset( $return_context['anchor_at'] ) && is_scalar( $return_context['anchor_at'] ) ? sanitize_text_field( (string) $return_context['anchor_at'] ) : '',
			'anchor_ratio'  => isset( $return_context['anchor_ratio'] ) && is_numeric( $return_context['anchor_ratio'] ) ? max( 0, min( 1, (float) $return_context['anchor_ratio'] ) ) : 0.5,
		);
	}

	/**
	 * Build a consistent validation error.
	 *
	 * @param string $code    Error code.
	 * @param string $message Safe message.
	 *
	 * @return WP_Error Error with HTTP status metadata.
	 */
	private function get_error( $code, $message ) {
		return new WP_Error( $code, $message, array( 'status' => 400 ) );
	}
}

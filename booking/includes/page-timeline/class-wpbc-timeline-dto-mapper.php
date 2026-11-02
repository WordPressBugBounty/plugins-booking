<?php
/**
 * JSON-safe DTO mapping for Timeline Resources and bookings.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/resource-preferences/class-wpbc-timeline-resource-display-preferences.php';
require_once __DIR__ . '/resource-preferences/class-wpbc-timeline-booking-title-policy.php';
require_once __DIR__ . '/class-wpbc-timeline-row-presentation-registry.php';

/**
 * Convert authorized domain records into stable browser-facing DTOs.
 */
final class WPBC_Timeline_DTO_Mapper {

	/** Maximum harmless rounding drift between adjacent percentage boundaries. */
	const PRESENTATION_GEOMETRY_EPSILON = 0.0000001;

	/** @var WPBC_Timeline_Axis Shared time-axis service. */
	private $axis;

	/** @var WPBC_Timeline_Booking_Title_Policy Per-Resource title resolver. */
	private $booking_title_policy;

	/** @var WPBC_Booking_Overview_Tooltip_DTO_Mapper Booking overview projector. */
	private $booking_overview_tooltip_mapper;

	/** @var WPBC_Timeline_Row_Presentation_Registry Neutral Resource presentation registry. */
	private $row_presentation_registry;

	/**
	 * Construct the mapper with the shared axis authority.
	 *
	 * @param WPBC_Timeline_Axis|null                        $axis                            Optional axis service.
	 * @param string|null                                    $booking_title_template          Optional explicit title template for controlled consumers
	 *                                                                                       and tests.
	 * @param WPBC_Booking_Overview_Tooltip_DTO_Mapper|null  $booking_overview_tooltip_mapper Optional tooltip mapper.
	 * @param WPBC_Timeline_Booking_Title_Policy|null        $booking_title_policy            Optional per-Resource title policy.
	 * @param WPBC_Timeline_Row_Presentation_Registry|null   $row_presentation_registry       Optional neutral presentation registry.
	 */
	public function __construct( $axis = null, $booking_title_template = null, $booking_overview_tooltip_mapper = null, $booking_title_policy = null, $row_presentation_registry = null ) {
		$global_template_reader = null;
		if ( null !== $booking_title_template ) {
			$explicit_title_template = sanitize_text_field( (string) $booking_title_template );
			$global_template_reader  = static function () use ( $explicit_title_template ) {
				return $explicit_title_template;
			};
		}

		$this->axis                            = $axis ? $axis : new WPBC_Timeline_Axis();
		$this->booking_title_policy            = $booking_title_policy
			? $booking_title_policy
			: new WPBC_Timeline_Booking_Title_Policy( null, $global_template_reader );
		$this->booking_overview_tooltip_mapper = $booking_overview_tooltip_mapper ? $booking_overview_tooltip_mapper : new WPBC_Booking_Overview_Tooltip_DTO_Mapper();
		$this->row_presentation_registry       = $row_presentation_registry ? $row_presentation_registry : WPBC_Timeline_Row_Presentation_Registry::get_instance();
	}

	/**
	 * Map one Resource record to a lightweight list DTO.
	 *
	 * @param array<string,mixed> $resource Authorized Resource record.
	 *
	 * @return array<string,mixed> JSON-safe Resource DTO.
	 */
	public function map_resource( $resource ) {
		$base_rate = isset( $resource['base_rate'] ) && is_array( $resource['base_rate'] ) ? $resource['base_rate'] : array();
		$rate_text = isset( $base_rate['formatted'] ) ? sanitize_text_field( (string) $base_rate['formatted'] ) : '';
		$period    = isset( $base_rate['period'] ) ? sanitize_key( (string) $base_rate['period'] ) : '';
		$period_labels = array(
			'day'   => __( 'day', 'booking' ),
			'night' => __( 'night', 'booking' ),
			'hour'  => __( 'hour', 'booking' ),
			'fixed' => __( 'fixed', 'booking' ),
		);
		$subtitle = '';
		if ( '' !== $rate_text ) {
			$subtitle = isset( $period_labels[ $period ] )
				? sprintf(
					/* translators: 1: formatted price, 2: charging period. */
					__( '%1$s / %2$s', 'booking' ),
					$rate_text,
					$period_labels[ $period ]
				)
				: $rate_text;
		}

		$resource_id      = absint( $resource['id'] );
		$parent_id        = isset( $resource['parent_id'] ) ? absint( $resource['parent_id'] ) : 0;
		$node_role        = isset( $resource['node_role'] ) ? sanitize_key( $resource['node_role'] ) : 'resource';
		$capacity         = isset( $resource['capacity'] ) ? max( 1, absint( $resource['capacity'] ) ) : 1;
		$description      = isset( $resource['description'] ) ? sanitize_textarea_field( (string) $resource['description'] ) : '';
		$supports_capacity = class_exists( 'wpdev_bk_biz_l' );

		$resource_dto = array(
			'id'            => $resource_id,
			'row_key'       => 'resource-' . $resource_id,
			'title'         => sanitize_text_field( (string) $resource['title'] ),
			'subtitle'      => $subtitle,
			'image_url'     => isset( $resource['image_url'] ) ? esc_url_raw( $resource['image_url'] ) : '',
			'description'   => $description,
			'parent_id'     => $parent_id,
			'node_role'     => $node_role,
			'node_id'       => 'booking-resource:' . $resource_id,
			'parent_node_id' => $parent_id ? 'booking-resource:' . $parent_id : '',
			'is_parent'     => 'capacity_parent' === $node_role,
			'is_child'      => 'child' === $node_role,
			'is_aggregate'  => ! empty( $resource['is_aggregate'] ),
			'is_expandable' => ! empty( $resource['is_expandable'] ),
			'child_count'   => isset( $resource['child_count'] ) ? absint( $resource['child_count'] ) : 0,
			'visible_child_count' => isset( $resource['visible_child_count'] ) ? absint( $resource['visible_child_count'] ) : 0,
			'child_position' => isset( $resource['child_position'] ) ? absint( $resource['child_position'] ) : 0,
			'is_last_child' => ! empty( $resource['is_last_child'] ),
			'capacity'      => $capacity,
			'supports_capacity' => $supports_capacity,
			'has_details'   => $supports_capacity || '' !== $description,
			'capacity_label' => sprintf(
				/* translators: %d: number of booking units in a capacity Resource. */
				__( 'Capacity %d', 'booking' ),
				$capacity
			),
			'base_rate'     => array(
				'amount'          => isset( $base_rate['amount'] ) ? sanitize_text_field( (string) $base_rate['amount'] ) : '',
				'formatted'       => isset( $base_rate['formatted'] ) ? sanitize_text_field( (string) $base_rate['formatted'] ) : '',
				'currency'        => isset( $base_rate['currency'] ) ? sanitize_text_field( (string) $base_rate['currency'] ) : '',
				'currency_symbol' => isset( $base_rate['currency_symbol'] ) ? sanitize_text_field( (string) $base_rate['currency_symbol'] ) : '',
				'period'          => isset( $base_rate['period'] ) ? sanitize_key( (string) $base_rate['period'] ) : '',
			),
			'row_presentations' => $this->row_presentation_registry->get_for_resource( $resource ),
		);

		/**
		 * Filters one authorized, presentation-neutral Timeline Resource DTO.
		 *
		 * Domain modules may append JSON-safe presentation data for already
		 * authorized Resources. Filters must not add HTML, callbacks, paths, SQL,
		 * raw database rows, or mutation authority.
		 *
		 * @since 12.0.0
		 *
		 * @param array<string,mixed> $resource_dto Authorized Resource DTO.
		 * @param array<string,mixed> $resource     Authorized repository record.
		 */
		return apply_filters( 'wpbc_timeline_resource_dto', $resource_dto, $resource );
	}

	/**
	 * Project raw booking-date fragments into related, clipped Timeline spans.
	 *
	 * Full-day rows use complete site-local dates. Timed rows preserve their
	 * stored time boundaries after removing the legacy 01/02/08 marker seconds.
	 * The canonical 23:59:52 full-day checkout sentinel becomes the following
	 * site-local midnight so the half-open span remains continuous.
	 * A gap of more than one date creates a related recurrent/discontinuous span
	 * rather than incorrectly filling the intervening dates.
	 *
	 * @param array<string,mixed> $records          Internal repository records.
	 * @param array<string,mixed> $window           Validated window.
	 * @param array<int,string>   $visible_statuses Card statuses currently shown.
	 * @param array<string,mixed> $axis             Optional shared axis DTO.
	 *
	 * @return array<string,mixed> Booking cards and occupancy intervals.
	 */
	public function map_booking_window( $records, $window, $visible_statuses, $axis = array() ) {
		$timezone       = ! empty( $window['timezone'] )
			? new DateTimeZone( (string) $window['timezone'] )
			: ( function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' ) );
		$window_start   = new DateTimeImmutable( isset( $window['start_at'] ) ? $window['start_at'] : $window['start_date'] . ' 00:00:00', $timezone );
		$window_end     = new DateTimeImmutable( isset( $window['end_at'] ) ? $window['end_at'] : $window['end_date'] . ' 00:00:00', $timezone );
		$axis           = ! empty( $axis['cells'] ) ? $axis : $this->axis->build_axis( $window );
		$groups         = array();
		$bookings       = isset( $records['bookings'] ) && is_array( $records['bookings'] ) ? $records['bookings'] : array();

		foreach ( isset( $records['dates'] ) && is_array( $records['dates'] ) ? $records['dates'] : array() as $date_row ) {
			$booking_id  = isset( $date_row['booking_id'] ) ? absint( $date_row['booking_id'] ) : 0;
			$resource_id = isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
			if ( ! $booking_id || ! $resource_id || empty( $date_row['booking_date'] ) ) {
				continue;
			}

			if ( ! isset( $groups[ $booking_id ] ) ) {
				$groups[ $booking_id ] = array();
			}
			$groups[ $booking_id ][] = array(
				'date_time'  => sanitize_text_field( (string) $date_row['booking_date'] ),
				'approved'   => ! empty( $date_row['approved'] ),
				'resource_id' => $resource_id,
			);
		}

		$booking_spans          = array();
		$effective_resource_ids = array();
		foreach ( $groups as $booking_id => $date_rows ) {
			$booking_id                    = absint( $booking_id );
			$booking_spans[ $booking_id ] = $this->build_contiguous_spans( $date_rows, $timezone );
			foreach ( $booking_spans[ $booking_id ] as $span ) {
				if ( ! empty( $span['resource_id'] ) ) {
					$effective_resource_ids[ absint( $span['resource_id'] ) ] = absint( $span['resource_id'] );
				}
			}
		}
		$this->booking_title_policy->prepare_window( $bookings, array_values( $effective_resource_ids ) );

		$segments            = array();
		$occupancy           = array();
		$canonical_intervals = array();
		foreach ( $booking_spans as $booking_id => $spans ) {
			$booking_id = absint( $booking_id );

			foreach ( $spans as $span ) {
				$resource_id = isset( $span['resource_id'] ) ? absint( $span['resource_id'] ) : 0;
				if ( ! $resource_id ) {
					continue;
				}
				$title_projection = $this->booking_title_policy->resolve_span_title( $booking_id, $resource_id );
				$label            = $title_projection['label'];
				$initials_source  = $title_projection['initials_source'];
				$control_labels   = array(
					'information_aria_label' => sprintf(
						/* translators: %s: booking label shown on the Timeline card. */
						__( 'Booking information for %s', 'booking' ),
						$label
					),
					'details_aria_label'     => sprintf(
						/* translators: %s: booking label shown on the Timeline card. */
						__( 'Open booking details for %s', 'booking' ),
						$label
					),
					'accessory_aria_label'   => sprintf(
						/* translators: %s: booking label shown on the Timeline card. */
						__( 'Booking controls for %s', 'booking' ),
						$label
					),
				);
				$status = ! empty( $span['approved'] ) ? 'approved' : 'pending';
				$canonical_intervals[] = array(
					'booking_id'  => $booking_id,
					'resource_id' => $resource_id,
					'start'       => $span['start']->format( 'Y-m-d\TH:i:sP' ),
					'end'         => $span['end']->format( 'Y-m-d\TH:i:sP' ),
					'is_full_day' => ! empty( $span['is_full_day'] ),
					'status'      => $status,
				);
				if ( $span['end']->getTimestamp() <= $window_start->getTimestamp() || $span['start']->getTimestamp() >= $window_end->getTimestamp() ) {
					continue;
				}

				$clipped_start = $span['start']->getTimestamp() < $window_start->getTimestamp();
				$clipped_end   = $span['end']->getTimestamp() > $window_end->getTimestamp();
				$visible_start  = $clipped_start ? $window_start : $span['start'];
				$visible_end    = $clipped_end ? $window_end : $span['end'];
				$segment_id      = 'booking-' . $booking_id . '-resource-' . $resource_id . '-start-' . $span['start']->getTimestamp();
				$presentation    = $this->get_span_presentation( $span, $label, $initials_source, $status, $timezone );
				$visual_geometry       = $this->axis->get_segment_geometry( $axis, $visible_start->getTimestamp(), $visible_end->getTimestamp() );
				$is_day_time_slot       = $this->is_day_time_slot( $span, $axis );
				$presentation_geometry = $this->get_presentation_geometry( $visual_geometry, ! empty( $span['is_full_day'] ), $is_day_time_slot );
				$cell_width             = 100 / max( 1, absint( $axis['cell_count'] ) );
				$is_compact             = ! $is_day_time_slot && (float) $presentation_geometry['presentation_width_percent'] <= $cell_width + 0.000001;
				$common                = array(
					'segment_id'             => $segment_id,
					'series_key'             => 'booking-' . $booking_id,
					'booking_id'             => $booking_id,
					'resource_id'            => $resource_id,
					'start'                  => $span['start']->format( 'Y-m-d\TH:i:sP' ),
					'end'                    => $span['end']->format( 'Y-m-d\TH:i:sP' ),
					'visible_start'          => $visible_start->format( 'Y-m-d\TH:i:sP' ),
					'visible_end'            => $visible_end->format( 'Y-m-d\TH:i:sP' ),
					'is_full_day'            => $span['is_full_day'],
					'is_day_time_slot'       => $is_day_time_slot,
					'time_slot_date'         => $is_day_time_slot ? $span['start']->format( 'Y-m-d' ) : '',
					'is_clipped_start'       => $clipped_start,
					'is_clipped_end'         => $clipped_end,
					'offset_percent'         => $visual_geometry['offset_percent'],
					'width_percent'          => $visual_geometry['width_percent'],
					'status'                 => $status,
					'continues_before_label' => __( 'Booking continues before this window', 'booking' ),
					'continues_after_label'  => __( 'Booking continues after this window', 'booking' ),
				);
				$overview = $this->booking_overview_tooltip_mapper->map_card(
					array_merge(
						$common,
						array(
							'label'          => $label,
							'status_label'   => $presentation['status_label'],
							'start_label'    => $presentation['start_label'],
							'end_label'      => $presentation['end_label'],
							'date_label'     => $presentation['date_label'],
							'duration_label' => $presentation['duration_label'],
						)
					)
				);
				$occupancy[] = $common;
				$segments[]  = array_merge(
					$common,
					$visual_geometry,
					$presentation_geometry,
					$overview,
					$control_labels,
					array(
						'label'                      => $label,
						'selection_aria_label'       => sprintf(
							/* translators: 1: booking label, 2: complete booking schedule and duration. */
							__( 'Select booking %1$s, %2$s', 'booking' ),
							$label,
							$presentation['schedule_label']
						),
						'start_label'                => $presentation['start_label'],
						'end_label'                  => $presentation['end_label'],
						'date_label'                 => $presentation['date_label'],
						'duration_label'             => $presentation['duration_label'],
						'schedule_label'             => $presentation['schedule_label'],
						'time_slot_time_label'       => $presentation['time_slot_time_label'],
						'initials'                   => $presentation['initials'],
						'aria_label'                 => $presentation['aria_label'],
						'is_visible'                 => in_array( $status, $visible_statuses, true ),
						'is_compact'                 => $is_compact,
						'is_time_slot_overflow_item' => false,
						'time_slot_group_key'        => $is_day_time_slot ? 'resource-' . $resource_id . '-date-' . $span['start']->format( 'Y-m-d' ) : '',
						'time_slot_date_label'       => $is_day_time_slot ? wp_date( get_option( 'date_format' ), $span['start']->getTimestamp(), $timezone ) : '',
					)
				);
			}
		}

		$time_slot_overflows = $this->build_time_slot_overflows( $segments );
		$lane_counts         = $this->assign_segment_lanes( $segments, $time_slot_overflows );

		return array(
			'segments'            => array_values( $segments ),
			'occupancy'           => array_values( $occupancy ),
			'canonical_intervals' => array_values( $canonical_intervals ),
			'time_slot_overflows' => array_values( $time_slot_overflows ),
			'lane_counts'         => $lane_counts,
		);
	}

	/**
	 * Select the card geometry that represents the canonical booking shape.
	 *
	 * Full-day spans intentionally occupy complete Timeline cells. A same-date
	 * timed span also receives a complete-cell card at the one-day scale so its
	 * content remains usable; its visible selection and resize controls follow the
	 * card edges while canonical exact instants remain separate. Other timed and
	 * changeover spans retain exact fractional card positions. The axis-provided
	 * exact and cell-expanded values remain in the DTO for consumers that need
	 * either projection explicitly.
	 *
	 * @param array<string,float> $geometry    Exact and cell-expanded axis geometry.
	 * @param bool                $is_full_day      Whether the span represents full dates.
	 * @param bool                $is_day_time_slot Whether a same-day timed span uses semantic day-card presentation.
	 *
	 * @return array<string,float> Shape-aware card presentation percentages.
	 */
	private function get_presentation_geometry( $geometry, $is_full_day, $is_day_time_slot = false ) {
		$use_complete_cells = $is_full_day || $is_day_time_slot;
		$offset_key         = $use_complete_cells ? 'visual_offset_percent' : 'offset_percent';
		$width_key          = $use_complete_cells ? 'visual_width_percent' : 'width_percent';

		return array(
			'presentation_offset_percent' => isset( $geometry[ $offset_key ] ) ? (float) $geometry[ $offset_key ] : 0.0,
			'presentation_width_percent'  => isset( $geometry[ $width_key ] ) ? (float) $geometry[ $width_key ] : 0.0,
		);
	}

	/**
	 * Determine whether a timed span needs semantic presentation in a one-day cell.
	 *
	 * Exact start and end instants remain in the DTO and occupancy projection. This
	 * flag changes only the readable card width at the coarse day scale; overnight,
	 * multi-date changeover, full-day, and finer time-scale spans retain their
	 * established geometry.
	 *
	 * @param array<string,mixed> $span Projected canonical booking span.
	 * @param array<string,mixed> $axis Authorized Timeline axis DTO.
	 *
	 * @return bool True for one same-date timed interval on the one-day scale.
	 */
	private function is_day_time_slot( $span, $axis ) {
		if ( ! empty( $span['is_full_day'] ) || 1440 !== absint( isset( $axis['cell_minutes'] ) ? $axis['cell_minutes'] : 0 ) ) {
			return false;
		}

		return $span['start']->format( 'Y-m-d' ) === $span['end']->format( 'Y-m-d' );
	}

	/**
	 * Build localized, template-ready booking-card presentation strings.
	 *
	 * The mapper owns date and duration formatting so the WordPress template
	 * never interprets ISO timestamps or performs booking calculations.
	 *
	 * @param array<string,mixed> $span            Projected booking span.
	 * @param string              $label           Sanitized booking label.
	 * @param string              $initials_source Name-based source for compact initials.
	 * @param string              $status          Approved or pending status.
	 * @param DateTimeZone        $timezone        Site timezone.
	 *
	 * @return array<string,string> Compact booking-card labels.
	 */
	private function get_span_presentation( $span, $label, $initials_source, $status, $timezone ) {
		$start          = $span['start'];
		$end            = $span['end'];
		$is_full_day    = ! empty( $span['is_full_day'] );
		$display_end    = $is_full_day ? $end->modify( '-1 day' ) : $end;
		$date_label     = $this->format_span_date_label( $start, $display_end, $is_full_day, $timezone );
		$duration_label = $this->format_span_duration_label( $start, $end, $is_full_day );
		$start_label    = $this->format_span_boundary_label( $start, $is_full_day, $timezone );
		$end_label      = $this->format_span_boundary_label( $display_end, $is_full_day, $timezone );
		$range_label    = $date_label;
		if ( ! $is_full_day && $start->format( 'Y-m-d' ) !== $display_end->format( 'Y-m-d' ) ) {
			$range_label = sprintf(
				/* translators: 1: exact booking start date and time, 2: exact booking end date and time. */
				__( '%1$s – %2$s', 'booking' ),
				$start_label,
				$end_label
			);
		}
		$schedule_label = sprintf(
			/* translators: 1: booking date or exact date-and-time range, 2: booking duration. */
			__( '%1$s · %2$s', 'booking' ),
			$range_label,
			$duration_label
		);
		$status_label   = 'pending' === $status ? __( 'Pending', 'booking' ) : __( 'Approved', 'booking' );

		return array(
			'start_label'    => $start_label,
			'end_label'      => $end_label,
			'date_label'     => $date_label,
			'duration_label' => $duration_label,
			'schedule_label' => $schedule_label,
			'time_slot_time_label' => $is_full_day ? '' : sprintf(
				/* translators: 1: booking start time, 2: booking end time. */
				__( '%1$s – %2$s', 'booking' ),
				wp_date( get_option( 'time_format' ), $start->getTimestamp(), $timezone ),
				wp_date( get_option( 'time_format' ), $display_end->getTimestamp(), $timezone )
			),
			'status_label'   => $status_label,
			'initials'       => $this->get_booking_initials( $initials_source ),
			'aria_label'     => sprintf(
				/* translators: 1: booking label, 2: status, 3: complete schedule and duration. */
				__( '%1$s, %2$s, %3$s', 'booking' ),
				$label,
				$status_label,
				$schedule_label
			),
		);
	}

	/**
	 * Format one exact booking boundary already authorized for a Timeline card.
	 *
	 * These labels let the Booking Overview show its known schedule immediately
	 * without parsing ISO timestamps in the browser or waiting for lazy personal
	 * booking data. Full-day boundaries intentionally omit a time.
	 *
	 * @param DateTimeImmutable $date_time   Site-local boundary.
	 * @param bool              $is_full_day Whether the interval contains full dates.
	 * @param DateTimeZone      $timezone    Site timezone.
	 *
	 * @return string Localized date or date-and-time boundary.
	 */
	private function format_span_boundary_label( $date_time, $is_full_day, $timezone ) {
		$format = 'M j, Y';
		if ( ! $is_full_day ) {
			$time_format = function_exists( 'get_bk_option' ) ? get_bk_option( 'booking_time_format' ) : '';
			$time_format = is_scalar( $time_format ) ? trim( (string) $time_format ) : '';
			if ( '' === $time_format ) {
				$time_format = (string) get_option( 'time_format', 'H:i' );
			}
			$format .= ' - ' . ( '' !== trim( $time_format ) ? $time_format : 'H:i' );
		}

		return wp_date( $format, $date_time->getTimestamp(), $timezone );
	}

	/**
	 * Format one compact site-local booking date range.
	 *
	 * @param DateTimeImmutable $start       Inclusive start.
	 * @param DateTimeImmutable $display_end Inclusive display end.
	 * @param bool              $is_full_day Whether the span contains full dates.
	 * @param DateTimeZone      $timezone    Site timezone.
	 *
	 * @return string Localized date range.
	 */
	private function format_span_date_label( $start, $display_end, $is_full_day, $timezone ) {
		if ( ! $is_full_day && $start->format( 'Y-m-d' ) === $display_end->format( 'Y-m-d' ) ) {
			return sprintf(
				/* translators: 1: booking date, 2: start time, 3: end time. */
				__( '%1$s, %2$s – %3$s', 'booking' ),
				wp_date( 'M j, Y', $start->getTimestamp(), $timezone ),
				wp_date( get_option( 'time_format' ), $start->getTimestamp(), $timezone ),
				wp_date( get_option( 'time_format' ), $display_end->getTimestamp(), $timezone )
			);
		}

		if ( $start->format( 'Y-m-d' ) === $display_end->format( 'Y-m-d' ) ) {
			return wp_date( 'M j, Y', $start->getTimestamp(), $timezone );
		}

		if ( $start->format( 'Y-m' ) === $display_end->format( 'Y-m' ) ) {
			return sprintf(
				/* translators: 1: abbreviated month and first day, 2: last day and year. */
				__( '%1$s – %2$s', 'booking' ),
				wp_date( 'M j', $start->getTimestamp(), $timezone ),
				wp_date( 'j, Y', $display_end->getTimestamp(), $timezone )
			);
		}

		return sprintf(
			/* translators: 1: first booking date, 2: last booking date. */
			__( '%1$s – %2$s', 'booking' ),
			wp_date( 'M j, Y', $start->getTimestamp(), $timezone ),
			wp_date( 'M j, Y', $display_end->getTimestamp(), $timezone )
		);
	}

	/**
	 * Format a compact duration without implying a calculated booking total.
	 *
	 * @param DateTimeImmutable $start       Inclusive start.
	 * @param DateTimeImmutable $end         Exclusive end.
	 * @param bool              $is_full_day Whether the span contains full dates.
	 *
	 * @return string Localized duration.
	 */
	private function format_span_duration_label( $start, $end, $is_full_day ) {
		$duration_minutes = max( 1, (int) round( ( $end->getTimestamp() - $start->getTimestamp() ) / MINUTE_IN_SECONDS ) );
		if ( $is_full_day ) {
			$duration_days = max( 1, (int) $start->diff( $end )->format( '%a' ) );

			return sprintf(
				/* translators: %s: number of complete booking days. */
				_n( '%s day', '%s days', $duration_days, 'booking' ),
				number_format_i18n( $duration_days )
			);
		}

		return wpbc_format_duration_minutes( $duration_minutes );
	}

	/**
	 * Derive privacy-minimized initials from the already-authorized card label.
	 *
	 * @param string $label Booking card label.
	 *
	 * @return string One or two uppercase initials.
	 */
	private function get_booking_initials( $label ) {
		$words    = preg_split( '/\s+/u', trim( wp_strip_all_tags( $label ) ) );
		$initials = '';
		foreach ( is_array( $words ) ? array_slice( $words, 0, 2 ) : array() as $word ) {
			$initials .= function_exists( 'mb_substr' ) ? mb_substr( $word, 0, 1 ) : substr( $word, 0, 1 );
		}

		return function_exists( 'mb_strtoupper' ) ? mb_strtoupper( $initials ) : strtoupper( $initials );
	}

	/**
	 * Assign deterministic visual lanes to overlapping visible booking cards.
	 *
	 * Occupancy remains independent and unmodified. Hidden cards do not reserve
	 * a visual lane, but they continue to exist in the occupancy projection.
	 *
	 * @param array<int,array<string,mixed>> $segments            Booking card DTOs passed by reference.
	 * @param array<int,array<string,mixed>> $time_slot_overflows Day-cell overflow controls passed by reference.
	 *
	 * @return array<int,int> Maximum visible lane count keyed by Resource ID.
	 */
	private function assign_segment_lanes( &$segments, &$time_slot_overflows = array() ) {
		$entries_by_resource = array();
		foreach ( $segments as $segment_index => $segment ) {
			if ( empty( $segment['is_visible'] ) || ! empty( $segment['is_time_slot_overflow_item'] ) ) {
				$segments[ $segment_index ]['lane_index'] = 0;
				continue;
			}
			$resource_id = absint( $segment['resource_id'] );
			$entries_by_resource[ $resource_id ][] = array(
				'type'       => 'segment',
				'index'      => $segment_index,
				'start'      => (float) $segment['presentation_offset_percent'],
				'end'        => (float) $segment['presentation_offset_percent'] + (float) $segment['presentation_width_percent'],
				'sort_order' => 0,
				'id'         => (string) $segment['segment_id'],
			);
		}
		foreach ( $time_slot_overflows as $overflow_index => $time_slot_overflow ) {
			$resource_id = absint( $time_slot_overflow['resource_id'] );
			$entries_by_resource[ $resource_id ][] = array(
				'type'       => 'overflow',
				'index'      => $overflow_index,
				'start'      => (float) $time_slot_overflow['presentation_offset_percent'],
				'end'        => (float) $time_slot_overflow['presentation_offset_percent'] + (float) $time_slot_overflow['presentation_width_percent'],
				'sort_order' => 1,
				'id'         => (string) $time_slot_overflow['overflow_id'],
			);
		}

		$lane_counts = array();
		foreach ( $entries_by_resource as $resource_id => $entries ) {
			usort(
				$entries,
				static function ( $left_entry, $right_entry ) {
					$start_compare = $left_entry['start'] <=> $right_entry['start'];
					if ( 0 !== $start_compare ) {
						return $start_compare;
					}
					$order_compare = $left_entry['sort_order'] <=> $right_entry['sort_order'];

					return 0 !== $order_compare ? $order_compare : strcmp( $left_entry['id'], $right_entry['id'] );
				}
			);
			$lane_ends = array();
			foreach ( $entries as $entry ) {
				$lane_index    = 0;
				while ( isset( $lane_ends[ $lane_index ] ) && $lane_ends[ $lane_index ] - $entry['start'] > self::PRESENTATION_GEOMETRY_EPSILON ) {
					++$lane_index;
				}
				$lane_ends[ $lane_index ] = $entry['end'];
				if ( 'segment' === $entry['type'] ) {
					$segments[ $entry['index'] ]['lane_index'] = $lane_index;
				} else {
					$time_slot_overflows[ $entry['index'] ]['lane_index'] = $lane_index;
				}
			}
			$lane_counts[ $resource_id ] = max( 1, count( $lane_ends ) );
		}

		return $lane_counts;
	}

	/**
	 * Keep dense same-date time slots within three total presentation lanes.
	 *
	 * The hidden cards remain authorized DTOs and their exact occupancy remains
	 * untouched. The overflow DTO contains only the already-authorized summaries
	 * required by the domain-owned WordPress template.
	 *
	 * @param array<int,array<string,mixed>> $segments Booking segment DTOs passed by reference.
	 *
	 * @return array<int,array<string,mixed>> Template-ready day-cell overflow controls.
	 */
	private function build_time_slot_overflows( &$segments ) {
		$maximum_visible_slots = 3;
		$group_indexes         = array();
		$overflows             = array();

		foreach ( $segments as $segment_index => $segment ) {
			if ( empty( $segment['is_visible'] ) || empty( $segment['is_day_time_slot'] ) || empty( $segment['time_slot_group_key'] ) ) {
				continue;
			}
			$group_indexes[ $segment['time_slot_group_key'] ][] = $segment_index;
		}

		foreach ( $group_indexes as $group_key => $segment_indexes ) {
			$visible_slot_limit = $maximum_visible_slots;
			usort(
				$segment_indexes,
				static function ( $left_index, $right_index ) use ( $segments ) {
					$left_start_timestamp  = strtotime( (string) $segments[ $left_index ]['start'] );
					$right_start_timestamp = strtotime( (string) $segments[ $right_index ]['start'] );
					$start_compare         = ( false !== $left_start_timestamp && false !== $right_start_timestamp )
						? $left_start_timestamp <=> $right_start_timestamp
						: 0;

					return 0 !== $start_compare ? $start_compare : strcmp( (string) $segments[ $left_index ]['segment_id'], (string) $segments[ $right_index ]['segment_id'] );
				}
			);
			if ( count( $segment_indexes ) > $maximum_visible_slots ) {
				$visible_slot_limit = $maximum_visible_slots - 1;
			}
			foreach ( $segment_indexes as $group_index => $segment_index ) {
				$segments[ $segment_index ]['time_slot_group_index'] = $group_index;
				$segments[ $segment_index ]['is_time_slot_overflow_item'] = $group_index >= $visible_slot_limit;
			}
			if ( count( $segment_indexes ) <= $maximum_visible_slots ) {
				continue;
			}

			$first_segment = $segments[ $segment_indexes[0] ];
			$hidden_indexes = array_slice( $segment_indexes, $visible_slot_limit );
			$hidden_count   = count( $hidden_indexes );
			$overflow_items = array();
			foreach ( $hidden_indexes as $hidden_index ) {
				$hidden_segment   = $segments[ $hidden_index ];
				$overflow_items[] = array(
					'booking_id'     => absint( $hidden_segment['booking_id'] ),
					'segment_id'     => sanitize_text_field( (string) $hidden_segment['segment_id'] ),
					'label'          => sanitize_text_field( (string) $hidden_segment['label'] ),
					'time_label'     => sanitize_text_field( (string) $hidden_segment['time_slot_time_label'] ),
					'duration_label' => sanitize_text_field( (string) $hidden_segment['duration_label'] ),
					'aria_label'     => sanitize_text_field( (string) $hidden_segment['aria_label'] ),
				);
			}

			$date_label = sanitize_text_field( (string) $first_segment['time_slot_date_label'] );
			$overflows[] = array(
				'overflow_id'                => 'wpbc-time-slot-overflow-' . md5( $group_key ),
				'group_key'                  => sanitize_text_field( (string) $group_key ),
				'resource_id'                => absint( $first_segment['resource_id'] ),
				'date'                       => sanitize_text_field( (string) $first_segment['time_slot_date'] ),
				'date_label'                 => $date_label,
				'presentation_offset_percent' => (float) $first_segment['presentation_offset_percent'],
				'presentation_width_percent'  => (float) $first_segment['presentation_width_percent'],
				'hidden_count'               => $hidden_count,
				'more_label'                 => sprintf(
					/* translators: %s: number of additional time-slot bookings. */
					__( '+%s more', 'booking' ),
					number_format_i18n( $hidden_count )
				),
				'aria_label'                 => sprintf(
					/* translators: 1: number of additional bookings, 2: booking date. */
					_n( 'Show %1$s more booking on %2$s', 'Show %1$s more bookings on %2$s', $hidden_count, 'booking' ),
					number_format_i18n( $hidden_count ),
					$date_label
				),
				'heading'                    => sprintf(
					/* translators: %s: booking date. */
					__( 'More bookings on %s', 'booking' ),
					$date_label
				),
				'items'                      => $overflow_items,
				'lane_index'                 => 0,
			);
		}

		return $overflows;
	}

	/**
	 * Reconstruct booking intervals before splitting them by Resource allocation.
	 *
	 * Capacity bookings may move between a parent Resource and its children on
	 * different saved dates. Pairing marker rows after grouping by Resource loses
	 * the matching boundary and creates false one-minute or midnight fragments.
	 * This method pairs timed boundaries at booking level, projects each selected
	 * date through its stored Resource allocation, and merges only truly adjacent
	 * slices that belong to the same logical interval and Resource.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Booking-date fragments.
	 * @param DateTimeZone                   $timezone  Site timezone.
	 *
	 * @return array<int,array<string,mixed>> Contiguous span objects.
	 */
	private function build_contiguous_spans( $date_rows, $timezone ) {
		$normalized_rows = $this->normalize_date_rows( $date_rows, $timezone );
		$timed_intervals = $this->build_timed_intervals( $normalized_rows );
		$atomic_spans    = array();
		$paired_row_keys = array();

		foreach ( $timed_intervals as $interval_index => $timed_interval ) {
			foreach ( $timed_interval['row_keys'] as $row_key ) {
				$paired_row_keys[ $row_key ] = true;
			}
			$atomic_spans = array_merge(
				$atomic_spans,
				$this->build_timed_allocation_spans(
					$normalized_rows,
					$timed_interval,
					'timed-' . absint( $interval_index )
				)
			);
		}

		foreach ( $normalized_rows as $normalized_row ) {
			if ( 'full_day' === $normalized_row['boundary'] ) {
				if ( $this->is_full_day_row_in_timed_interval( $normalized_row, $timed_intervals ) ) {
					continue;
				}
				$atomic_spans[] = $this->build_atomic_span(
					$normalized_row['date_time'],
					$normalized_row['date_time']->modify( '+1 day' ),
					$normalized_row,
					true,
					'full-day'
				);
				continue;
			}

			if ( isset( $paired_row_keys[ $normalized_row['row_key'] ] ) ) {
				continue;
			}

			$orphan_start = 'start' === $normalized_row['boundary']
				? $normalized_row['normalized_time']
				: $normalized_row['date_time']->setTime( 0, 0, 0 );
			$orphan_end   = 'start' === $normalized_row['boundary']
				? $orphan_start->modify( '+1 minute' )
				: $normalized_row['normalized_time'];
			if ( $orphan_end <= $orphan_start ) {
				$orphan_end = $orphan_start->modify( '+1 minute' );
			}
			$atomic_spans[] = $this->build_atomic_span(
				$orphan_start,
				$orphan_end,
				$normalized_row,
				false,
				'orphan-' . $normalized_row['row_key']
			);
		}

		return $this->merge_allocation_spans( $atomic_spans );
	}

	/**
	 * Normalize saved date rows while preserving allocation and marker meaning.
	 *
	 * @param array<int,array<string,mixed>> $date_rows Raw booking-date rows.
	 * @param DateTimeZone                   $timezone  Site timezone.
	 *
	 * @return array<int,array<string,mixed>> Ordered normalized rows.
	 */
	private function normalize_date_rows( $date_rows, $timezone ) {
		$normalized_rows = array();
		foreach ( $date_rows as $date_row ) {
			$date_time = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s', $date_row['date_time'], $timezone );
			$resource_id = isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
			if ( ! $date_time instanceof DateTimeImmutable || ! $resource_id ) {
				continue;
			}

			$marker_second             = absint( $date_time->format( 's' ) );
			$is_end_of_day_checkout    = '23:59:52' === $date_time->format( 'H:i:s' );
			$boundary                  = 'full_day';
			$normalized_boundary_time  = $date_time->setTime(
				(int) $date_time->format( 'H' ),
				(int) $date_time->format( 'i' ),
				0
			);
			if ( 1 === $marker_second ) {
				$boundary = 'start';
			} elseif ( $is_end_of_day_checkout || in_array( $marker_second, array( 2, 8 ), true ) ) {
				$boundary = 'end';
			}
			if ( $is_end_of_day_checkout ) {
				$normalized_boundary_time = $date_time->modify( '+1 day' )->setTime( 0, 0, 0 );
			}

			$normalized_rows[] = array(
				'row_key'        => (string) count( $normalized_rows ),
				'date_time'      => $date_time,
				'normalized_time' => $normalized_boundary_time,
				'date_key'       => $date_time->format( 'Y-m-d' ),
				'boundary'       => $boundary,
				'resource_id'    => $resource_id,
				'approved'       => ! empty( $date_row['approved'] ),
			);
		}

		usort(
			$normalized_rows,
			static function ( $left_row, $right_row ) {
				$time_compare = $left_row['date_time']->getTimestamp() <=> $right_row['date_time']->getTimestamp();
				if ( 0 !== $time_compare ) {
					return $time_compare;
				}

				return $left_row['resource_id'] <=> $right_row['resource_id'];
			}
		);

		return $normalized_rows;
	}

	/**
	 * Pair equal-sized start and end marker batches at booking level.
	 *
	 * Equal batch sizes preserve capacity quantity without guessing how unmatched
	 * rows should be paired. Unsupported or incomplete markers remain available
	 * to the caller's bounded orphan fallback.
	 *
	 * @param array<int,array<string,mixed>> $normalized_rows Ordered normalized rows.
	 *
	 * @return array<int,array<string,mixed>> Timed interval envelopes.
	 */
	private function build_timed_intervals( $normalized_rows ) {
		$boundary_batches = array();
		foreach ( $normalized_rows as $normalized_row ) {
			if ( ! in_array( $normalized_row['boundary'], array( 'start', 'end' ), true ) ) {
				continue;
			}
			$batch_key = $normalized_row['boundary'] . ':' . $normalized_row['normalized_time']->format( 'Y-m-d H:i:s' );
			if ( ! isset( $boundary_batches[ $batch_key ] ) ) {
				$boundary_batches[ $batch_key ] = array(
					'boundary' => $normalized_row['boundary'],
					'date_time' => $normalized_row['normalized_time'],
					'rows'      => array(),
				);
			}
			$boundary_batches[ $batch_key ]['rows'][] = $normalized_row;
		}

		$ordered_batches = array_values( $boundary_batches );
		usort(
			$ordered_batches,
			static function ( $left_batch, $right_batch ) {
				return $left_batch['date_time']->getTimestamp() <=> $right_batch['date_time']->getTimestamp();
			}
		);

		$timed_intervals = array();
		$active_start    = null;
		foreach ( $ordered_batches as $boundary_batch ) {
			if ( 'start' === $boundary_batch['boundary'] ) {
				$active_start = $boundary_batch;
				continue;
			}
			if ( null === $active_start || count( $active_start['rows'] ) !== count( $boundary_batch['rows'] ) ) {
				continue;
			}
			if ( $boundary_batch['date_time'] <= $active_start['date_time'] ) {
				continue;
			}

			$row_keys = array();
			foreach ( array_merge( $active_start['rows'], $boundary_batch['rows'] ) as $boundary_row ) {
				$row_keys[] = $boundary_row['row_key'];
			}
			$timed_intervals[] = array(
				'start'      => $active_start['date_time'],
				'end'        => $boundary_batch['date_time'],
				'start_rows' => $active_start['rows'],
				'end_rows'   => $boundary_batch['rows'],
				'row_keys'   => $row_keys,
			);
			$active_start = null;
		}

		return $timed_intervals;
	}

	/**
	 * Build daily allocation slices for one complete timed interval.
	 *
	 * Boundary dates use their exact marker rows. Explicit intermediate rows
	 * replace the active allocation; a missing legacy interior row inherits the
	 * preceding allocation so one continuous boundary interval is not split.
	 * Recurrent bookings remain separate because each marker pair has its own
	 * interval key.
	 *
	 * @param array<int,array<string,mixed>> $normalized_rows All normalized booking rows.
	 * @param array<string,mixed>            $timed_interval  Complete timed interval.
	 * @param string                         $interval_key    Stable merge boundary for this interval.
	 *
	 * @return array<int,array<string,mixed>> Atomic allocation spans.
	 */
	private function build_timed_allocation_spans( $normalized_rows, $timed_interval, $interval_key ) {
		$start_date_key     = $timed_interval['start']->format( 'Y-m-d' );
		$end_date_key       = $timed_interval['end']->format( 'Y-m-d' );
		$allocation_by_date = array();

		foreach ( $timed_interval['start_rows'] as $start_row ) {
			$allocation_by_date[ $start_date_key ][ $start_row['resource_id'] ] = $start_row;
		}
		foreach ( $timed_interval['end_rows'] as $end_row ) {
			$allocation_by_date[ $end_row['date_key'] ][ $end_row['resource_id'] ] = $end_row;
		}
		foreach ( $normalized_rows as $normalized_row ) {
			if ( 'full_day' !== $normalized_row['boundary'] || $normalized_row['date_key'] <= $start_date_key || $normalized_row['date_key'] >= $end_date_key ) {
				continue;
			}
			$allocation_by_date[ $normalized_row['date_key'] ][ $normalized_row['resource_id'] ] = $normalized_row;
		}

		ksort( $allocation_by_date );
		$atomic_spans           = array();
		$active_allocation_rows = array();
		$date_cursor            = new DateTimeImmutable( $start_date_key . ' 00:00:00', $timed_interval['start']->getTimezone() );
		while ( $date_cursor->format( 'Y-m-d' ) <= $end_date_key ) {
			$date_key = $date_cursor->format( 'Y-m-d' );
			if ( isset( $allocation_by_date[ $date_key ] ) ) {
				$active_allocation_rows = $allocation_by_date[ $date_key ];
			}
			if ( empty( $active_allocation_rows ) ) {
				$date_cursor = $date_cursor->modify( '+1 day' );
				continue;
			}

			$day_start   = new DateTimeImmutable( $date_key . ' 00:00:00', $timed_interval['start']->getTimezone() );
			$slice_start = $date_key === $start_date_key ? $timed_interval['start'] : $day_start;
			$slice_end   = $date_key === $end_date_key ? $timed_interval['end'] : $day_start->modify( '+1 day' );
			if ( $slice_end <= $slice_start ) {
				$date_cursor = $date_cursor->modify( '+1 day' );
				continue;
			}
			foreach ( $active_allocation_rows as $allocation_row ) {
				$atomic_spans[] = $this->build_atomic_span(
					$slice_start,
					$slice_end,
					$allocation_row,
					false,
					$interval_key
				);
			}
			$date_cursor = $date_cursor->modify( '+1 day' );
		}

		return $atomic_spans;
	}

	/**
	 * Determine whether a full-day row belongs to a complete timed envelope.
	 *
	 * @param array<string,mixed>            $normalized_row One normalized full-day row.
	 * @param array<int,array<string,mixed>> $timed_intervals Complete timed intervals.
	 *
	 * @return bool True when the row is represented by a timed allocation span.
	 */
	private function is_full_day_row_in_timed_interval( $normalized_row, $timed_intervals ) {
		foreach ( $timed_intervals as $timed_interval ) {
			if ( $normalized_row['date_key'] > $timed_interval['start']->format( 'Y-m-d' ) && $normalized_row['date_key'] < $timed_interval['end']->format( 'Y-m-d' ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Build one internal allocation span.
	 *
	 * @param DateTimeImmutable   $start          Inclusive site-local start.
	 * @param DateTimeImmutable   $end            Exclusive site-local end.
	 * @param array<string,mixed> $allocation_row Row that owns Resource and approval state.
	 * @param bool                $is_full_day    Whether this is an all-day span.
	 * @param string              $interval_key   Internal merge boundary.
	 *
	 * @return array<string,mixed> Internal atomic span.
	 */
	private function build_atomic_span( $start, $end, $allocation_row, $is_full_day, $interval_key ) {
		return array(
			'start'        => $start,
			'end'          => $end,
			'is_full_day'  => (bool) $is_full_day,
			'resource_id'  => absint( $allocation_row['resource_id'] ),
			'approved'     => ! empty( $allocation_row['approved'] ),
			'interval_key' => sanitize_key( $interval_key ),
		);
	}

	/**
	 * Merge adjacent slices only within one Resource and logical interval.
	 *
	 * @param array<int,array<string,mixed>> $atomic_spans Atomic allocation spans.
	 *
	 * @return array<int,array<string,mixed>> Public Timeline spans.
	 */
	private function merge_allocation_spans( $atomic_spans ) {
		usort(
			$atomic_spans,
			static function ( $left_span, $right_span ) {
				$resource_compare = $left_span['resource_id'] <=> $right_span['resource_id'];
				if ( 0 !== $resource_compare ) {
					return $resource_compare;
				}
				$interval_compare = strcmp( $left_span['interval_key'], $right_span['interval_key'] );
				if ( 0 !== $interval_compare ) {
					return $interval_compare;
				}

				return $left_span['start']->getTimestamp() <=> $right_span['start']->getTimestamp();
			}
		);

		$merged_spans = array();
		foreach ( $atomic_spans as $atomic_span ) {
			$last_index = count( $merged_spans ) - 1;
			$can_merge  = 0 <= $last_index
				&& $merged_spans[ $last_index ]['resource_id'] === $atomic_span['resource_id']
				&& $merged_spans[ $last_index ]['interval_key'] === $atomic_span['interval_key']
				&& $merged_spans[ $last_index ]['is_full_day'] === $atomic_span['is_full_day']
				&& $merged_spans[ $last_index ]['end']->getTimestamp() === $atomic_span['start']->getTimestamp();
			if ( $can_merge ) {
				$merged_spans[ $last_index ]['end']      = $atomic_span['end'];
				$merged_spans[ $last_index ]['approved'] = $merged_spans[ $last_index ]['approved'] && $atomic_span['approved'];
				continue;
			}
			$merged_spans[] = $atomic_span;
		}

		usort(
			$merged_spans,
			static function ( $left_span, $right_span ) {
				$time_compare = $left_span['start']->getTimestamp() <=> $right_span['start']->getTimestamp();
				return 0 !== $time_compare ? $time_compare : $left_span['resource_id'] <=> $right_span['resource_id'];
			}
		);
		foreach ( $merged_spans as &$merged_span ) {
			unset( $merged_span['interval_key'] );
		}
		unset( $merged_span );

		return $merged_spans;
	}

}

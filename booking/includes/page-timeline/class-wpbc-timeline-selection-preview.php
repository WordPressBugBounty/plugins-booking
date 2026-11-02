<?php
/**
 * Authorized, read-only Timeline selection preview.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Reload every domain dependency before presenting selection actions.
 */
final class WPBC_Timeline_Selection_Preview {

	/** @var WPBC_Timeline_Authorization Authorization service. */
	private $authorization;

	/** @var WPBC_Timeline_Selection_Validator Selection validator. */
	private $validator;

	/** @var WPBC_Timeline_Resource_Repository Resource repository. */
	private $resource_repository;

	/** @var WPBC_Timeline_Booking_Repository Booking repository. */
	private $booking_repository;

	/** @var WPBC_Timeline_DTO_Mapper Booking DTO mapper. */
	private $dto_mapper;

	/** @var WPBC_Timeline_Availability_Provider Availability provider. */
	private $availability_provider;

	/** @var WPBC_Timeline_Rates_Provider Rates provider. */
	private $rates_provider;

	/** @var WPBC_Timeline_Axis Shared axis authority. */
	private $axis;

	/** @var WPBC_Timeline_Handoff Signed handoff service. */
	private $handoff;

	/**
	 * Construct the preview facade with optional test doubles.
	 *
	 * @param WPBC_Timeline_Authorization|null         $authorization        Authorization service.
	 * @param WPBC_Timeline_Selection_Validator|null  $validator            Selection validator.
	 * @param WPBC_Timeline_Resource_Repository|null  $resource_repository  Resource repository.
	 * @param WPBC_Timeline_Booking_Repository|null   $booking_repository   Booking repository.
	 * @param WPBC_Timeline_DTO_Mapper|null            $dto_mapper           DTO mapper.
	 * @param WPBC_Timeline_Availability_Provider|null $availability_provider Availability provider.
	 * @param WPBC_Timeline_Rates_Provider|null        $rates_provider       Rates provider.
	 * @param WPBC_Timeline_Axis|null                  $axis                 Axis service.
	 * @param WPBC_Timeline_Handoff|null               $handoff              Handoff service.
	 */
	public function __construct( $authorization = null, $validator = null, $resource_repository = null, $booking_repository = null, $dto_mapper = null, $availability_provider = null, $rates_provider = null, $axis = null, $handoff = null ) {
		$this->axis                  = $axis ? $axis : new WPBC_Timeline_Axis();
		$this->authorization         = $authorization ? $authorization : new WPBC_Timeline_Authorization();
		$this->validator             = $validator ? $validator : new WPBC_Timeline_Selection_Validator( $this->axis );
		$this->resource_repository   = $resource_repository ? $resource_repository : new WPBC_Timeline_Resource_Repository();
		$this->booking_repository    = $booking_repository ? $booking_repository : new WPBC_Timeline_Booking_Repository();
		$this->dto_mapper            = $dto_mapper ? $dto_mapper : new WPBC_Timeline_DTO_Mapper( $this->axis );
		$this->availability_provider = $availability_provider ? $availability_provider : new WPBC_Timeline_Availability_Provider();
		$this->rates_provider        = $rates_provider ? $rates_provider : new WPBC_Timeline_Rates_Provider();
		$this->handoff               = $handoff ? $handoff : new WPBC_Timeline_Handoff();
	}

	/**
	 * Return one data-only selection review and independently authorized actions.
	 *
	 * @param mixed $request_values Untrusted selection request.
	 *
	 * @return array<string,mixed>|WP_Error Preview DTO or safe error.
	 */
	public function get_preview( $request_values ) {
		if ( ! $this->authorization->current_user_can_view() ) {
			return new WP_Error( 'wpbc_timeline_selection_forbidden', __( 'You cannot preview this Timeline selection.', 'booking' ), array( 'status' => 403 ) );
		}

		$selection = $this->validator->normalize( $request_values );
		if ( is_wp_error( $selection ) ) {
			return $selection;
		}
		$loaded_context = $this->validate_loaded_context(
			$selection,
			isset( $request_values['loaded_context_tokens'] ) ? $request_values['loaded_context_tokens'] : array()
		);
		if ( is_wp_error( $loaded_context ) ) {
			return $loaded_context;
		}

		$resources = $this->resource_repository->get_authorized_resources_by_ids( array( $selection['resource_id'] ) );
		if ( is_wp_error( $resources ) ) {
			return $resources;
		}
		if ( 1 !== count( $resources ) ) {
			return new WP_Error( 'wpbc_timeline_resource_not_found', __( 'The requested Booking Resource was not found.', 'booking' ), array( 'status' => 404 ) );
		}

		$resource = reset( $resources );
		$window   = $this->build_read_window( $selection );
		$booking_query_window = $this->availability_provider->get_booking_query_window( $resources, $window );
		$records  = $this->booking_repository->get_window_records( array( $selection['resource_id'] ), $booking_query_window );
		if ( is_wp_error( $records ) ) {
			return $records;
		}
		$axis           = $this->axis->build_axis( $window );
		$booking_window = $this->dto_mapper->map_booking_window( $records, $window, array( 'approved', 'pending' ), $axis );
		$availability   = $this->availability_provider->get_availability( $resources, $window, $booking_window );
		if ( is_wp_error( $availability ) ) {
			return $availability;
		}
		$rates = $this->rates_provider->get_rates( $resources, $window );
		if ( is_wp_error( $rates ) ) {
			return $rates;
		}

		$overlaps            = $this->get_overlapping_bookings( $booking_window['occupancy'], $selection );
		$availability_result = $this->evaluate_availability( $availability, $selection );
		$booking_form        = class_exists( 'WPBC_Add_Booking_Component' )
			? WPBC_Add_Booking_Component::get_default_booking_form_for_resource( $selection['resource_id'] )
			: 'standard';
		$email_intent        = 'On' !== get_bk_option( 'booking_send_emails_off_addbooking' );
		$handoff_payload     = $this->get_handoff_payload( $selection, $booking_form, $email_intent );
		$can_create_booking  = $this->authorization->current_user_can_create_booking();
		$can_manage_blocks   = $this->authorization->current_user_can_manage_availability();
		$is_empty            = empty( $overlaps );
		$is_hard_blocked     = 'blocked' === $availability_result['state'];
		$new_booking_action  = array(
			'id'         => 'new_booking',
			'label'      => __( 'New booking', 'booking' ),
			'authorized' => $can_create_booking,
			'enabled'    => $can_create_booking && $is_empty && ! $is_hard_blocked,
			'requires_canonical_validation' => 'available' !== $availability_result['state'],
			'url'        => $can_create_booking ? $this->handoff->get_add_booking_url( $handoff_payload ) : '',
		);

		/**
		 * Filters the authorized Timeline selection action before presentation.
		 *
		 * Extensions may add executable-free presentation metadata. They must not
		 * replace the signed URL, weaken authorization, or mutate the selection.
		 *
		 * @since 12.0.0
		 * @param array<string,mixed> $new_booking_action Authorized action DTO.
		 * @param array<string,mixed> $selection         Validated selection DTO.
		 */
		$filtered_new_booking_action = apply_filters( 'wpbc_timeline_selection_new_booking_action', $new_booking_action, $selection );
		if ( is_array( $filtered_new_booking_action ) && ! empty( $filtered_new_booking_action['launch_context'] ) ) {
			$new_booking_action['launch_context'] = substr( sanitize_key( (string) $filtered_new_booking_action['launch_context'] ), 0, 64 );
			if ( ! empty( $filtered_new_booking_action['label'] ) && is_scalar( $filtered_new_booking_action['label'] ) ) {
				$new_booking_action['label'] = substr( sanitize_text_field( (string) $filtered_new_booking_action['label'] ), 0, 100 );
			}
		}
		$block_plan          = array(
			'resource_id'       => $selection['resource_id'],
			'start_at'          => $selection['start_at'],
			'end_at'            => $selection['end_at'],
			'view'              => $selection['view'],
			'selection_surface' => $selection['selection_surface'],
			'is_full_day'       => $selection['is_full_day'],
		);

		return array(
			'selection' => array(
				'resource_id'            => $selection['resource_id'],
				'resource_title'         => sanitize_text_field( (string) $resource['title'] ),
				'selection_surface'      => $selection['selection_surface'],
				'selection_kind'         => $selection['selection_kind'],
				'selection_step_minutes' => $selection['selection_step_minutes'],
				'start_at'               => $selection['start_at'],
				'end_at'                 => $selection['end_at'],
				'is_full_day'            => $selection['is_full_day'],
				'duration_minutes'       => $selection['duration_minutes'],
				'duration_label'         => $this->format_duration( $selection ),
				'range_label'            => $this->format_range( $selection ),
			),
			'availability' => $availability_result,
			'occupancy' => array(
				'is_empty'      => $is_empty,
				'overlap_count' => count( $overlaps ),
				'overlap_label' => sprintf(
					_n( '%s overlapping booking', '%s overlapping bookings', count( $overlaps ), 'booking' ),
					number_format_i18n( count( $overlaps ) )
				),
				'bookings'      => $overlaps,
				'capacity'      => isset( $resource['capacity'] ) ? max( 1, absint( $resource['capacity'] ) ) : 1,
			),
			'form_context' => array(
				'booking_form'           => sanitize_text_field( $booking_form ),
				'requires_custom_fields' => 'standard' !== $booking_form,
				'email_intent'           => $email_intent ? 'send' : 'do_not_send',
			),
			'quote'   => $this->get_resource_quote( isset( $rates['rates'][0] ) ? $rates['rates'][0] : array(), $selection ),
			'actions' => array(
				'new_booking' => $new_booking_action,
				'block' => array(
					'id'         => 'block',
					'label'      => $selection['is_full_day'] ? __( 'Block dates', 'booking' ) : __( 'Block times', 'booking' ),
					'authorized' => $can_manage_blocks,
					'enabled'    => $can_manage_blocks,
				),
				'unblock' => array(
					'id'         => 'unblock',
					'label'      => $selection['is_full_day'] ? __( 'Unblock dates', 'booking' ) : __( 'Unblock times', 'booking' ),
					'authorized' => $can_manage_blocks,
					'enabled'    => $can_manage_blocks,
				),
			),
			'block_plan'  => $can_manage_blocks ? $block_plan : array(),
			'block_token' => $can_manage_blocks ? $this->handoff->create_token( 'availability_block', $block_plan ) : '',
		);
	}

	/**
	 * Prove that signed authorized windows continuously cover the selection.
	 *
	 * Browser-supplied loaded boundaries remain useful validation hints, but are
	 * not trusted as proof that an adjacent period was actually authorized and
	 * loaded. At most the bounded three-window cache may contribute tokens.
	 *
	 * @param array<string,mixed> $selection Validated selection.
	 * @param mixed               $tokens    Candidate loaded-window tokens.
	 *
	 * @return true|WP_Error True when coverage is complete, otherwise a safe error.
	 */
	private function validate_loaded_context( $selection, $tokens ) {
		$tokens    = is_array( $tokens ) ? array_slice( array_values( $tokens ), 0, 3 ) : array();
		$intervals = array();
		foreach ( $tokens as $token ) {
			$context = $this->handoff->verify_token( $token, 'timeline_loaded_window' );
			if ( is_wp_error( $context ) ) {
				continue;
			}
			$resource_ids = isset( $context['resource_ids'] ) && is_array( $context['resource_ids'] )
				? array_map( 'absint', $context['resource_ids'] )
				: array();
			if ( ! in_array( $selection['resource_id'], $resource_ids, true ) || $selection['view'] !== sanitize_key( isset( $context['view'] ) ? (string) $context['view'] : '' ) ) {
				continue;
			}
			$start_epoch = isset( $context['start_at'] ) ? strtotime( (string) $context['start_at'] ) : false;
			$end_epoch   = isset( $context['end_at'] ) ? strtotime( (string) $context['end_at'] ) : false;
			if ( false !== $start_epoch && false !== $end_epoch && $start_epoch < $end_epoch ) {
				$intervals[] = array( $start_epoch, $end_epoch );
			}
		}

		usort( $intervals, static function ( $left, $right ) { return (int) $left[0] - (int) $right[0]; } );
		$covered_until = $selection['start_epoch'];
		foreach ( $intervals as $interval ) {
			if ( $interval[1] <= $covered_until ) {
				continue;
			}
			if ( $interval[0] > $covered_until ) {
				break;
			}
			$covered_until = max( $covered_until, $interval[1] );
			if ( $covered_until >= $selection['end_epoch'] ) {
				return true;
			}
		}

		return new WP_Error(
			'wpbc_timeline_selection_unloaded',
			__( 'This range is not fully loaded. Load the missing dates and try again.', 'booking' ),
			array( 'status' => 400 )
		);
	}

	/**
	 * Build the internal exact selection window.
	 *
	 * @param array<string,mixed> $selection Validated selection.
	 *
	 * @return array<string,mixed> Repository window.
	 */
	private function build_read_window( $selection ) {
		return array(
			'view'         => $selection['view'],
			'cell_minutes' => $selection['cell_minutes'],
			'timezone'     => $selection['timezone'],
			'start_date'   => $selection['start_date'],
			'end_date'     => $selection['end_date'],
			'start_at'     => $selection['start_at'],
			'end_at'       => $selection['end_at'],
			'anchor_at'    => $selection['start_at'],
		);
	}

	/**
	 * Return only bookings that intersect the exact half-open selection.
	 *
	 * @param array<int,array<string,mixed>> $occupancy Occupancy spans.
	 * @param array<string,mixed>            $selection Validated selection.
	 *
	 * @return array<int,array<string,mixed>> Safe overlap summaries.
	 */
	private function get_overlapping_bookings( $occupancy, $selection ) {
		$overlaps = array();
		foreach ( is_array( $occupancy ) ? $occupancy : array() as $span ) {
			$span_start = isset( $span['start'] ) ? strtotime( $span['start'] ) : false;
			$span_end   = isset( $span['end'] ) ? strtotime( $span['end'] ) : false;
			if ( false === $span_start || false === $span_end || $span_start >= $selection['end_epoch'] || $span_end <= $selection['start_epoch'] ) {
				continue;
			}
			$overlaps[] = array(
				'booking_id' => absint( $span['booking_id'] ),
				'status'     => sanitize_key( isset( $span['status'] ) ? $span['status'] : '' ),
				'start_at'   => sanitize_text_field( (string) $span['start'] ),
				'end_at'     => sanitize_text_field( (string) $span['end'] ),
			);
		}

		return $overlaps;
	}

	/**
	 * Evaluate relevant date and timed rules for the exact selection.
	 *
	 * @param array<string,mixed> $availability Availability layer.
	 * @param array<string,mixed> $selection    Validated selection.
	 *
	 * @return array<string,mixed> Conservative selection state.
	 */
	private function evaluate_availability( $availability, $selection ) {
		$blocked_labels    = array();
		$unresolved_labels = array();
		$load_state        = isset( $availability['load_state'] ) ? sanitize_key( $availability['load_state'] ) : 'failed';
		$selection_start   = ( new DateTimeImmutable( $selection['start_at'] ) )->getTimestamp();
		$selection_end     = ( new DateTimeImmutable( $selection['end_at'] ) )->getTimestamp();
		$source_labels     = array();
		foreach ( isset( $availability['sources'] ) && is_array( $availability['sources'] ) ? $availability['sources'] : array() as $source ) {
			$source_id = sanitize_key( isset( $source['id'] ) ? $source['id'] : '' );
			if ( $source_id ) {
				$source_labels[ $source_id ] = sanitize_text_field( isset( $source['label'] ) ? $source['label'] : '' );
			}
		}

		foreach ( isset( $availability['intervals'] ) && is_array( $availability['intervals'] ) ? $availability['intervals'] : array() as $interval ) {
			if ( absint( isset( $interval['resource_id'] ) ? $interval['resource_id'] : 0 ) !== $selection['resource_id'] ) {
				continue;
			}
			try {
				$interval_start = ( new DateTimeImmutable( $interval['start_at'] ) )->getTimestamp();
				$interval_end   = ( new DateTimeImmutable( $interval['end_at'] ) )->getTimestamp();
			} catch ( Exception $exception ) {
				continue;
			}
			if ( $interval_start >= $selection_end || $interval_end <= $selection_start ) {
				continue;
			}
			$source_id = sanitize_key( isset( $interval['source'] ) ? $interval['source'] : '' );
			$label     = isset( $interval['source_label'] ) ? sanitize_text_field( $interval['source_label'] ) : '';
			if ( '' === $label && isset( $source_labels[ $source_id ] ) ) {
				$label = $source_labels[ $source_id ];
			}
			$blocked_labels[] = $label;
		}

		foreach ( isset( $availability['unknown'] ) && is_array( $availability['unknown'] ) ? $availability['unknown'] : array() as $unknown_source ) {
			if ( absint( isset( $unknown_source['resource_id'] ) ? $unknown_source['resource_id'] : 0 ) !== $selection['resource_id'] ) {
				continue;
			}
			$source_id = sanitize_key( isset( $unknown_source['source'] ) ? $unknown_source['source'] : '' );
			$unresolved_labels[] = isset( $source_labels[ $source_id ] ) ? $source_labels[ $source_id ] : $source_id;
		}

		$blocked_labels    = array_values( array_unique( array_filter( $blocked_labels ) ) );
		$unresolved_labels = array_values( array_unique( array_filter( $unresolved_labels ) ) );
		if ( ! in_array( $load_state, array( 'loaded', 'partial' ), true ) ) {
			$load_state = 'failed';
		}

		return array(
			'load_state'       => $load_state,
			'state'            => ! empty( $blocked_labels ) ? 'blocked' : ( 'loaded' === $load_state && empty( $unresolved_labels ) ? 'available' : 'conditional' ),
			'blocked_by'       => $blocked_labels,
			'unresolved_by'    => $unresolved_labels,
			'requires_canonical_validation' => 'loaded' !== $load_state || ! empty( $unresolved_labels ),
		);
	}

	/**
	 * Build context signed into the canonical Add Booking workflow link.
	 *
	 * @param array<string,mixed> $selection   Validated selection.
	 * @param string              $booking_form Canonical form slug.
	 * @param bool                $email_intent Email intent.
	 *
	 * @return array<string,mixed> Handoff payload.
	 */
	private function get_handoff_payload( $selection, $booking_form, $email_intent ) {
		return array(
			'resource_id'    => $selection['resource_id'],
			'start_at'       => $selection['start_at'],
			'end_at'         => $selection['end_at'],
			'is_full_day'    => $selection['is_full_day'],
			'view'           => $selection['view'],
			'booking_form'   => sanitize_text_field( $booking_form ),
			'email_intent'   => $email_intent ? 'send' : 'do_not_send',
			'return_context' => $selection['return_context'],
		);
	}

	/**
	 * Calculate an exact Resource-only quote when the rates layer permits it.
	 *
	 * @param array<string,mixed> $rate      Rate DTO.
	 * @param array<string,mixed> $selection Validated selection.
	 *
	 * @return array<string,mixed> Explicit quote state.
	 */
	private function get_resource_quote( $rate, $selection ) {
		$result = array(
			'state'            => isset( $rate['state'] ) ? sanitize_key( $rate['state'] ) : 'unresolved',
			'amount'           => '',
			'formatted'        => '',
			'currency'         => isset( $rate['currency'] ) ? sanitize_text_field( $rate['currency'] ) : '',
			'charging_period'  => isset( $rate['charging_period'] ) ? sanitize_key( $rate['charging_period'] ) : '',
			'is_booking_total' => false,
			'label'            => __( 'Estimated Resource cost. The final booking total may differ.', 'booking' ),
		);
		if ( 'loaded' !== $result['state'] || ! isset( $rate['effective_unit_rate'] ) || ! is_numeric( $rate['effective_unit_rate'] ) ) {
			return $result;
		}

		$units = 0;
		switch ( $result['charging_period'] ) {
			case 'hour':
				$units = $selection['duration_minutes'] / 60;
				break;
			case 'day':
			case 'night':
				$units = $selection['duration_minutes'] / 1440;
				break;
			case 'fixed':
				$units = 1;
				break;
		}
		if ( 0 >= $units ) {
			$result['state'] = 'unresolved';

			return $result;
		}

		$amount              = round( (float) $rate['effective_unit_rate'] * $units, 2 );
		$result['amount']     = number_format( $amount, 2, '.', '' );


		$result['formatted'] = ( function_exists( 'wpbc_formate_cost_hint__no_html' ) && function_exists( 'wpbc_get_currency_symbol' ) )
			? wpbc_formate_cost_hint__no_html( $result['amount'],   ' ' . $result['currency'] . ' ' )
			: $result['amount'];

		return $result;
	}

	/**
	 * Format the selection duration.
	 *
	 * @param array<string,mixed> $selection Validated selection.
	 *
	 * @return string Localized duration.
	 */
	private function format_duration( $selection ) {
		if ( $selection['is_full_day'] ) {
			return sprintf( _n( '%s day', '%s days', max( 1, (int) round( $selection['duration_minutes'] / 1440 ) ), 'booking' ), number_format_i18n( max( 1, (int) round( $selection['duration_minutes'] / 1440 ) ) ) );
		}

		return wpbc_format_duration_minutes( $selection['duration_minutes'] );
	}

	/**
	 * Format a site-local selection range.
	 *
	 * @param array<string,mixed> $selection Validated selection.
	 *
	 * @return string Localized range.
	 */
	private function format_range( $selection ) {
		$timezone = new DateTimeZone( $selection['timezone'] );
		$start    = ( new DateTimeImmutable( $selection['start_at'] ) )->setTimezone( $timezone );
		$end      = ( new DateTimeImmutable( $selection['end_at'] ) )->setTimezone( $timezone );
		if ( $selection['is_full_day'] ) {
			$display_end = $end->modify( '-1 day' );

			return sprintf( __( '%1$s – %2$s', 'booking' ), wp_date( get_option( 'date_format' ), $start->getTimestamp(), $timezone ), wp_date( get_option( 'date_format' ), $display_end->getTimestamp(), $timezone ) );
		}

		return sprintf( __( '%1$s – %2$s', 'booking' ), wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $start->getTimestamp(), $timezone ), wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), $end->getTimestamp(), $timezone ) );
	}
}

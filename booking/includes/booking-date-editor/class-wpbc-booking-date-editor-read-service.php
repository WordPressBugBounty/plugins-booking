<?php
/**
 * Authorized Booking Date Editor read and native-calendar render service.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once dirname( __DIR__ ) . '/booking-domain/class-wpbc-booking-native-calendar-contract-builder.php';

/**
 * Build the initial Date Editor DTO from one authorized canonical booking.
 *
 * Saved date rows are normalized without applying the Resource's current day
 * selection policy. The native calendar remains authoritative for bookings and
 * availability through its standard follow-up AJAX request.
 *
 * @since 12.0.0
 */
final class WPBC_Booking_Date_Editor_Read_Service {

	/** Current browser-facing read contract. */
	const SCHEMA_VERSION = 1;

	/** @var WPBC_Booking_Inspector_Authorization Booking authorization boundary. */
	private $authorization;

	/** @var WPBC_Booking_Inspector_Request_Validator Inspector request validator. */
	private $request_validator;

	/** @var WPBC_Booking_Inspector_Date_Repository Canonical booking-date repository. */
	private $date_repository;

	/** @var WPBC_Booking_Native_Calendar_Contract_Builder Shared native-calendar contract builder. */
	private $native_calendar_contract_builder;

	/**
	 * Construct the service with replaceable focused dependencies.
	 *
	 * @param WPBC_Booking_Inspector_Authorization|null     $authorization    Optional authorization service.
	 * @param WPBC_Booking_Inspector_Request_Validator|null $request_validator Optional request validator.
	 * @param WPBC_Booking_Inspector_Date_Repository|null   $date_repository  Optional date repository.
	 * @param WPBC_Booking_Native_Calendar_Contract_Builder|null $native_calendar_contract_builder Optional shared calendar builder.
	 */
	public function __construct( $authorization = null, $request_validator = null, $date_repository = null, $native_calendar_contract_builder = null ) {
		$this->authorization     = $authorization ? $authorization : new WPBC_Booking_Inspector_Authorization();
		$this->request_validator = $request_validator ? $request_validator : new WPBC_Booking_Inspector_Request_Validator();
		$this->date_repository   = $date_repository ? $date_repository : new WPBC_Booking_Inspector_Date_Repository();
		$this->native_calendar_contract_builder = $native_calendar_contract_builder
			? $native_calendar_contract_builder
			: new WPBC_Booking_Native_Calendar_Contract_Builder();
	}

	/**
	 * Return the authorized Date Editor initialization DTO.
	 *
	 * Authorization is completed before date rows, booking hashes, form names,
	 * calendar markup, or native-calendar nonces are mapped for the browser.
	 *
	 * @param mixed $request_values Untrusted request values.
	 *
	 * @return array<string,mixed>|WP_Error Data-only Date Editor response or safe error.
	 */
	public function read( $request_values ) {
		$request = $this->request_validator->normalize( $request_values );
		if ( is_wp_error( $request ) ) {
			return $request;
		}

		if ( ! $this->current_user_can_edit() ) {
			return new WP_Error(
				'wpbc_booking_date_editor_unauthorized',
				__( 'Booking dates are unavailable for this account.', 'booking' ),
				array( 'status' => 403 )
			);
		}

		$authorization_context = $this->authorization->authorize_booking( $request['booking_id'], $request['source'] );
		if ( is_wp_error( $authorization_context ) ) {
			return $authorization_context;
		}

		$booking     = $authorization_context['booking'];
		$resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$date_rows   = $this->date_repository->get_booking_dates( $request['booking_id'], $resource_id );
		if ( is_wp_error( $date_rows ) ) {
			return $date_rows;
		}

		$effective_resource_ids = isset( $authorization_context['effective_resource_ids'] )
			? $authorization_context['effective_resource_ids']
			: array();
		$normalized_dates       = $this->normalize_saved_date_rows( $date_rows, $effective_resource_ids );

		if ( empty( $normalized_dates['supported'] ) ) {
			return array(
				'editor' => array(
					'schema_version' => self::SCHEMA_VERSION,
					'booking_id'     => absint( $request['booking_id'] ),
					'supported'      => false,
					'reason'         => 'unsupported_saved_shape',
					'fallback'       => $this->build_edit_handoff( $booking ),
				),
			);
		}

		if ( ! $resource_id || ! function_exists( 'wpbc_pre_get_calendar_html' ) ) {
			return new WP_Error(
				'wpbc_booking_date_editor_calendar_unavailable',
				__( 'The booking calendar could not be loaded. Reload the page and try again.', 'booking' ),
				array( 'status' => 500 )
			);
		}

		$booking_hash       = isset( $booking['hash'] ) ? sanitize_text_field( (string) $booking['hash'] ) : '';
		$custom_form        = $this->get_custom_form_key( $booking );
		$calendar_contract  = $this->build_native_calendar_contract(
			$resource_id,
			$booking_hash,
			$custom_form,
			$normalized_dates['selected_dates']
		);

		return array(
			'editor' => array(
				'schema_version' => self::SCHEMA_VERSION,
				'booking_id'     => absint( $request['booking_id'] ),
				'resource_id'    => $resource_id,
				'supported'      => true,
				'source_fingerprint' => WPBC_Booking_Date_Editor_Source_Fingerprint::build( $booking, $date_rows ),
				'initial'        => array(
					'selection_method' => 'individual',
					'time_application' => $normalized_dates['time_application'],
					'start_time'       => $normalized_dates['start_time'],
					'end_time'         => $normalized_dates['end_time'],
					'selected_dates'   => $normalized_dates['selected_dates'],
				),
				'choices'        => array(
					'selection_methods' => array( 'policy', 'individual' ),
					'time_applications' => array( 'full_day', 'boundary', 'per_date' ),
				),
				'saved_rows'     => $normalized_dates['saved_rows'],
				'calendar'       => $calendar_contract,
			),
		);
	}

	/**
	 * Normalize canonical saved date rows without applying current policy rules.
	 *
	 * The returned `saved_rows` preserve every authorized row's exact date,
	 * minute, legacy boundary marker, approval state, and effective Resource.
	 * Capacity duplicates therefore remain lossless while the editor projection
	 * uses a deduplicated logical selection.
	 *
	 * @param mixed            $date_rows               Canonical repository rows.
	 * @param array<int,mixed> $effective_resource_ids Authorized effective Resources.
	 *
	 * @return array<string,mixed> Supported normalized selection or stable unsupported result.
	 */
	public function normalize_saved_date_rows( $date_rows, $effective_resource_ids ) {
		$date_rows               = is_array( $date_rows ) ? $date_rows : array();
		$effective_resource_ids = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		$saved_rows              = array();

		if ( empty( $date_rows ) || empty( $effective_resource_ids ) ) {
			return $this->get_unsupported_normalization();
		}

		foreach ( $date_rows as $date_row ) {
			$normalized_row = $this->normalize_saved_date_row( $date_row, $effective_resource_ids );
			if ( empty( $normalized_row ) ) {
				return $this->get_unsupported_normalization();
			}
			$saved_rows[] = $normalized_row;
		}

		usort( $saved_rows, array( $this, 'compare_saved_rows' ) );

		return $this->project_saved_rows( $saved_rows );
	}

	/**
	 * Normalize one repository row into the bounded browser row contract.
	 *
	 * @param mixed            $date_row                Candidate repository row.
	 * @param array<int,mixed> $effective_resource_ids Authorized effective Resources.
	 *
	 * @return array<string,mixed> Normalized row, or an empty array when unsupported.
	 */
	private function normalize_saved_date_row( $date_row, $effective_resource_ids ) {
		if ( ! is_array( $date_row ) ) {
			return array();
		}

		$booking_date = isset( $date_row['booking_date'] ) && is_scalar( $date_row['booking_date'] )
			? trim( (string) $date_row['booking_date'] )
			: '';
		if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/', $booking_date, $date_parts ) ) {
			return array();
		}

		$year             = (int) $date_parts[1];
		$month            = (int) $date_parts[2];
		$day              = (int) $date_parts[3];
		$hour             = (int) $date_parts[4];
		$minute           = (int) $date_parts[5];
		$storage_marker   = (int) $date_parts[6];
		$resource_id      = isset( $date_row['resource_id'] ) ? absint( $date_row['resource_id'] ) : 0;
		$allowed_markers  = array( 0, 1, 2, 8 );

		if (
			! checkdate( $month, $day, $year ) ||
			$hour > 23 ||
			$minute > 59 ||
			! in_array( $storage_marker, $allowed_markers, true ) ||
			! in_array( $resource_id, $effective_resource_ids, true ) ||
			( 0 === $storage_marker && ( 0 !== $hour || 0 !== $minute ) )
		) {
			return array();
		}

		$boundary = 'full_day';
		if ( 1 === $storage_marker ) {
			$boundary = 'start';
		} elseif ( in_array( $storage_marker, array( 2, 8 ), true ) ) {
			$boundary = 'end';
		}

		return array(
			'date'           => sprintf( '%04d-%02d-%02d', $year, $month, $day ),
			'time'           => 'full_day' === $boundary ? '' : sprintf( '%02d:%02d', $hour, $minute ),
			'boundary'       => $boundary,
			'storage_marker' => $storage_marker,
			'resource_id'    => $resource_id,
			'approved'       => ! empty( $date_row['approved'] ) ? 1 : 0,
		);
	}

	/**
	 * Sort normalized rows chronologically while retaining deterministic capacity order.
	 *
	 * @param array<string,mixed> $first_row  First normalized row.
	 * @param array<string,mixed> $second_row Second normalized row.
	 *
	 * @return int Standard comparison result.
	 */
	private function compare_saved_rows( $first_row, $second_row ) {
		$first_key  = $first_row['date'] . ' ' . ( '' !== $first_row['time'] ? $first_row['time'] : '00:00' ) . ':' . sprintf( '%02d', $first_row['storage_marker'] );
		$second_key = $second_row['date'] . ' '
			. ( '' !== $second_row['time'] ? $second_row['time'] : '00:00' )
			. ':'
			. sprintf( '%02d', $second_row['storage_marker'] );

		if ( $first_key === $second_key ) {
			return $first_row['resource_id'] <=> $second_row['resource_id'];
		}

		return strcmp( $first_key, $second_key );
	}

	/**
	 * Project lossless rows into the Date Editor's representable initial controls.
	 *
	 * @param array<int,array<string,mixed>> $saved_rows Ordered normalized saved rows.
	 *
	 * @return array<string,mixed> Supported projection or stable unsupported result.
	 */
	private function project_saved_rows( $saved_rows ) {
		$logical_rows       = array();
		$logical_row_keys   = array();
		$all_selected_dates = array();

		foreach ( $saved_rows as $saved_row ) {
			$logical_key = implode(
				'|',
				array(
					$saved_row['date'],
					$saved_row['time'],
					$saved_row['boundary'],
					(string) $saved_row['storage_marker'],
				)
			);
			if ( ! isset( $logical_row_keys[ $logical_key ] ) ) {
				$logical_rows[]                    = $saved_row;
				$logical_row_keys[ $logical_key ] = true;
			}
			$all_selected_dates[ $saved_row['date'] ] = true;
		}

		$intervals      = array();
		$full_day_dates = array();
		$active_start   = null;
		foreach ( $logical_rows as $logical_row ) {
			if ( 'full_day' === $logical_row['boundary'] ) {
				$full_day_dates[ $logical_row['date'] ] = true;
				continue;
			}

			if ( 'start' === $logical_row['boundary'] ) {
				if ( null !== $active_start ) {
					return $this->get_unsupported_normalization();
				}
				$active_start = $logical_row;
				continue;
			}

			if ( null === $active_start || $this->get_row_date_time( $active_start ) >= $this->get_row_date_time( $logical_row ) ) {
				return $this->get_unsupported_normalization();
			}

			$intervals[]  = array(
				'start' => $active_start,
				'end'   => $logical_row,
			);
			$active_start = null;
		}

		if ( null !== $active_start ) {
			return $this->get_unsupported_normalization();
		}

		$all_selected_dates = array_keys( $all_selected_dates );
		sort( $all_selected_dates, SORT_STRING );

		if ( empty( $intervals ) ) {
			return array(
				'supported'        => true,
				'selection_method' => $this->dates_are_consecutive( $all_selected_dates ) ? 'policy' : 'individual',
				'time_application' => 'full_day',
				'start_time'       => '',
				'end_time'         => '',
				'selected_dates'   => $all_selected_dates,
				'saved_rows'       => $saved_rows,
			);
		}

		if ( 1 < count( $intervals ) && ! empty( $full_day_dates ) ) {
			return $this->get_unsupported_normalization();
		}

		foreach ( array_keys( $full_day_dates ) as $full_day_date ) {
			$is_inside_interval = false;
			foreach ( $intervals as $interval ) {
				if ( $full_day_date > $interval['start']['date'] && $full_day_date < $interval['end']['date'] ) {
					$is_inside_interval = true;
					break;
				}
			}
			if ( ! $is_inside_interval ) {
				return $this->get_unsupported_normalization();
			}
		}

		$first_interval = reset( $intervals );
		$start_time     = $first_interval['start']['time'];
		$end_time       = $first_interval['end']['time'];
		if ( 1 < count( $intervals ) ) {
			$day_span      = $this->get_date_day_span( $first_interval['start']['date'], $first_interval['end']['date'] );
			$selected_dates = array();
			foreach ( $intervals as $interval ) {
				if (
					$start_time !== $interval['start']['time'] ||
					$end_time !== $interval['end']['time'] ||
					$day_span !== $this->get_date_day_span( $interval['start']['date'], $interval['end']['date'] )
				) {
					return $this->get_unsupported_normalization();
				}
				$selected_dates[ $interval['start']['date'] ] = true;
			}
			$selected_dates = array_keys( $selected_dates );
			sort( $selected_dates, SORT_STRING );
			$time_application = 'per_date';
		} elseif ( $first_interval['start']['date'] === $first_interval['end']['date'] ) {
			$selected_dates   = array( $first_interval['start']['date'] );
			$time_application = 'per_date';
		} else {
			$selected_dates   = $all_selected_dates;
			$time_application = 'boundary';
		}

		return array(
			'supported'        => true,
			'selection_method' => $this->dates_are_consecutive( $selected_dates ) ? 'policy' : 'individual',
			'time_application' => $time_application,
			'start_time'       => $start_time,
			'end_time'         => $end_time,
			'selected_dates'   => $selected_dates,
			'saved_rows'       => $saved_rows,
		);
	}

	/**
	 * Build one sortable exact-minute row value.
	 *
	 * @param array<string,mixed> $saved_row Normalized saved row.
	 *
	 * @return string `YYYY-MM-DD HH:MM` value.
	 */
	private function get_row_date_time( $saved_row ) {
		return $saved_row['date'] . ' ' . $saved_row['time'];
	}

	/**
	 * Return the whole-day span between two strict ISO dates.
	 *
	 * @param string $start_date Start ISO date.
	 * @param string $end_date   End ISO date.
	 *
	 * @return int Signed day span.
	 */
	private function get_date_day_span( $start_date, $end_date ) {
		$start = DateTimeImmutable::createFromFormat( '!Y-m-d', $start_date, new DateTimeZone( 'UTC' ) );
		$end   = DateTimeImmutable::createFromFormat( '!Y-m-d', $end_date, new DateTimeZone( 'UTC' ) );

		return ( $start && $end ) ? (int) $start->diff( $end )->format( '%r%a' ) : 0;
	}

	/**
	 * Determine whether ordered selected dates form one uninterrupted sequence.
	 *
	 * @param array<int,string> $selected_dates Ordered strict ISO dates.
	 *
	 * @return bool True when every date follows the previous date by one day.
	 */
	private function dates_are_consecutive( $selected_dates ) {
		if ( count( $selected_dates ) < 2 ) {
			return true;
		}

		for ( $date_index = 1; $date_index < count( $selected_dates ); $date_index++ ) {
			if ( 1 !== $this->get_date_day_span( $selected_dates[ $date_index - 1 ], $selected_dates[ $date_index ] ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Return the stable result used for legacy shapes the simplified editor cannot represent.
	 *
	 * @return array<string,mixed> Unsupported normalization result.
	 */
	private function get_unsupported_normalization() {
		return array(
			'supported' => false,
		);
	}

	/**
	 * Determine whether the current user has the established booking-edit capability.
	 *
	 * @return bool True when booking dates may be edited.
	 */
	private function current_user_can_edit() {
		$current_user_id = function_exists( 'wpbc_get_current_user_id' )
			? wpbc_get_current_user_id()
			: ( function_exists( 'get_current_user_id' ) ? get_current_user_id() : 0 );

		return function_exists( 'wpbc_is_user_can' ) && wpbc_is_user_can( 'edit_booking', $current_user_id );
	}

	/**
	 * Resolve the exact stored custom form key for native availability checks.
	 *
	 * @param array<string,mixed> $booking Authorized canonical booking row.
	 *
	 * @return string `standard` or the bounded stored form key.
	 */
	private function get_custom_form_key( $booking ) {
		$form_key = '';
		if ( class_exists( 'WPBC_Booking_Inspector_Form_Snapshot_Builder' ) ) {
			$form_key = ( new WPBC_Booking_Inspector_Form_Snapshot_Builder() )->get_stored_form_key(
				isset( $booking['form'] ) ? (string) $booking['form'] : '',
				isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0
			);
		}
		$form_key = sanitize_text_field( (string) $form_key );

		return '' === $form_key ? 'standard' : substr( $form_key, 0, 191 );
	}

	/**
	 * Build the stable authorized Add Booking fallback.
	 *
	 * @param array<string,mixed> $booking Authorized canonical booking row.
	 *
	 * @return array<string,string> Handoff label and URL.
	 */
	private function build_edit_handoff( $booking ) {
		$resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$booking_hash = isset( $booking['hash'] ) ? sanitize_text_field( (string) $booking['hash'] ) : '';
		$custom_form = $this->get_custom_form_key( $booking );
		$edit_url = function_exists( 'wpbc_get_booking_admin_edit_url' )
			? wpbc_get_booking_admin_edit_url( $resource_id, $booking_hash, 'standard' === $custom_form ? '' : $custom_form )
			: '';

		return array(
			'label' => __( 'Edit in Add Booking', 'booking' ),
			'url'   => esc_url_raw( $edit_url ),
		);
	}

	/**
	 * Build canonical markup and bounded native calendar initialization values.
	 *
	 * This response deliberately contains no availability map. The standard
	 * `WPBC_AJX_CALENDAR_LOAD` request returned here obtains all bookings,
	 * availability, capacity, season, changeover, and Appointment restrictions.
	 * The shared builder retains `wpbc_pre_get_calendar_html`, the site-bound
	 * `wp_create_nonce( 'wpbc_calendar_load_ajx_wpbcnonce' )` call, and the
	 * fixed `'skip_general_availability' => 0` request contract.
	 * Released source-contract keys remain `'booking_hash'              => $booking_hash`,
	 * `'allow_past'                => 1`, and `'this_page_allow_past'    => 1`.
	 *
	 * @param int               $resource_id   Authorized primary Resource ID.
	 * @param string            $booking_hash  Authorized booking hash used only to exclude this booking.
	 * @param string            $custom_form   Exact stored form key or `standard`.
	 * @param array<int,string> $selected_dates Exact normalized selected dates.
	 *
	 * @return array<string,mixed> Executable-free native calendar contract.
	 */
	public function build_native_calendar_contract( $resource_id, $booking_hash, $custom_form, $selected_dates ) {
		return $this->native_calendar_contract_builder->build(
			$resource_id,
			$booking_hash,
			$custom_form,
			$selected_dates
		);
	}

}

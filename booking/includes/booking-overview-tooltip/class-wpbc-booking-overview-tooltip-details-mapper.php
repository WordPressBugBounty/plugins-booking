<?php
/**
 * Complete bounded Booking Overview DTO mapping.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Compose presentation-safe details from canonical Inspector projections.
 */
final class WPBC_Booking_Overview_Tooltip_Details_Mapper {

	/** Lazy-details DTO schema version. */
	const SCHEMA_VERSION = 1;

	/** Maximum number of form fields exposed in one overview. */
	const MAXIMUM_FIELDS = 100;

	/** Maximum number of canonical intervals exposed in one overview. */
	const MAXIMUM_INTERVALS = 200;

	/** Maximum number of individual selected dates exposed in one overview. */
	const MAXIMUM_SELECTED_DATES = 366;

	/** @var WPBC_Booking_Inspector_Form_Field_Resolver Canonical field resolver. */
	private $form_field_resolver;

	/** @var WPBC_Booking_Inspector_Date_Projection Canonical date projection. */
	private $date_projection;

	/** @var WPBC_Booking_Inspector_Resource_Projection Authorized Resource projection. */
	private $resource_projection;

	/** @var WPBC_Booking_Inspector_Cost_Projection Saved financial projection. */
	private $cost_projection;

	/**
	 * Construct the mapper with focused reusable Inspector primitives.
	 *
	 * @param WPBC_Booking_Inspector_Form_Field_Resolver|null $form_field_resolver Optional resolver.
	 * @param WPBC_Booking_Inspector_Date_Projection|null     $date_projection     Optional date projection.
	 * @param WPBC_Booking_Inspector_Resource_Projection|null $resource_projection Optional Resource projection.
	 * @param WPBC_Booking_Inspector_Cost_Projection|null     $cost_projection     Optional cost projection.
	 */
	public function __construct( $form_field_resolver = null, $date_projection = null, $resource_projection = null, $cost_projection = null ) {
		$this->form_field_resolver = $form_field_resolver ? $form_field_resolver : new WPBC_Booking_Inspector_Form_Field_Resolver();
		$this->date_projection     = $date_projection ? $date_projection : new WPBC_Booking_Inspector_Date_Projection();
		$this->resource_projection = $resource_projection ? $resource_projection : new WPBC_Booking_Inspector_Resource_Projection();
		$this->cost_projection     = $cost_projection ? $cost_projection : new WPBC_Booking_Inspector_Cost_Projection();
	}

	/**
	 * Map one already-authorized booking without actions or mutation context.
	 *
	 * @param array<string,mixed>            $booking                Canonical authorized booking record.
	 * @param array<int,array<string,mixed>> $date_rows              Canonical date rows.
	 * @param array<int,int>                 $effective_resource_ids Authorized effective Resources.
	 *
	 * @return array<string,mixed>|WP_Error Bounded DTO or safe projection error.
	 */
	public function map_details( $booking, $date_rows, $effective_resource_ids ) {
		$date_details     = $this->date_projection->project( $date_rows );
		$resource_details = $this->resource_projection->project( $booking, $effective_resource_ids );
		if ( is_wp_error( $resource_details ) ) {
			return $resource_details;
		}
		$form_projection = $this->form_field_resolver->resolve_booking_fields( $booking );
		$cost_details    = $this->cost_projection->project( $booking );
		$booking_id      = isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0;
		$source_intervals = isset( $date_details['intervals'] ) && is_array( $date_details['intervals'] ) ? $date_details['intervals'] : array();
		$source_selected_dates = isset( $date_details['selected_dates'] ) && is_array( $date_details['selected_dates'] ) ? $date_details['selected_dates'] : array();
		$source_fields = isset( $form_projection['fields'] ) && is_array( $form_projection['fields'] ) ? $form_projection['fields'] : array();

		return array(
			'schema_version'  => self::SCHEMA_VERSION,
			'booking_id'      => $booking_id,
			'heading'         => sprintf( /* translators: %d: booking ID. */ __( 'Booking #%d', 'booking' ), $booking_id ),
			'title'           => sanitize_text_field( $this->form_field_resolver->resolve_title( $booking ) ),
			'status'          => $this->map_status( isset( $date_details['status'] ) ? $date_details['status'] : array() ),
			'resource'        => $this->map_resource( $resource_details ),
			'intervals'       => $this->map_intervals( $source_intervals ),
			'selected_dates'  => $this->map_selected_dates( $source_selected_dates ),
			'duration_metrics' => $this->map_text_list(
				isset( $date_details['summary']['metrics'] ) ? $date_details['summary']['metrics'] : array(),
				10,
				200
			),
			'fields'          => $this->map_fields( $source_fields ),
			'costs'           => $this->map_costs( $cost_details ),
			'created_label'   => $this->format_database_date_time( isset( $booking['creation_date'] ) ? $booking['creation_date'] : '' ),
			'truncation'      => array(
				'intervals'      => self::MAXIMUM_INTERVALS < count( $source_intervals ),
				'selected_dates' => self::MAXIMUM_SELECTED_DATES < count( $source_selected_dates ),
				'fields'         => self::MAXIMUM_FIELDS < count( $source_fields ),
			),
		);
	}

	/**
	 * Reduce the canonical date status to the values required by the overview.
	 *
	 * @param array<string,mixed> $status Canonical status projection.
	 * @return array<string,string> Bounded status summary.
	 */
	private function map_status( $status ) {
		$status = is_array( $status ) ? $status : array();
		$key    = isset( $status['key'] ) ? sanitize_key( (string) $status['key'] ) : 'unknown';
		$key    = in_array( $key, array( 'approved', 'pending' ), true ) ? $key : 'unknown';

		return array(
			'key'   => $key,
			'label' => isset( $status['label'] ) ? sanitize_text_field( (string) $status['label'] ) : '',
		);
	}

	/**
	 * Reduce an authorized Resource projection to presentation-safe values.
	 *
	 * @param array<string,mixed> $resource Authorized Resource projection.
	 * @return array<string,mixed> Resource values needed by the template.
	 */
	private function map_resource( $resource ) {
		$resource = is_array( $resource ) ? $resource : array();
		$pricing  = isset( $resource['pricing'] ) && is_array( $resource['pricing'] ) ? $resource['pricing'] : array();

		return array(
			'resource_id'      => isset( $resource['resource_id'] ) ? absint( $resource['resource_id'] ) : 0,
			'title'            => isset( $resource['title'] ) ? sanitize_text_field( (string) $resource['title'] ) : '',
			'description'      => isset( $resource['description'] ) ? sanitize_textarea_field( (string) $resource['description'] ) : '',
			'picture_url'      => isset( $resource['picture_url'] ) ? esc_url_raw( (string) $resource['picture_url'] ) : '',
			'allocation_count' => isset( $resource['allocation_count'] ) ? absint( $resource['allocation_count'] ) : 0,
			'pricing'          => array(
				'supported'      => ! empty( $pricing['supported'] ),
				'formatted_cost' => isset( $pricing['formatted_cost'] ) ? sanitize_text_field( (string) $pricing['formatted_cost'] ) : '',
				'period_label'   => isset( $pricing['period_label'] ) ? sanitize_text_field( (string) $pricing['period_label'] ) : '',
			),
		);
	}

	/**
	 * Remove allocation internals from canonical booking intervals.
	 *
	 * @param array<int,array<string,mixed>> $intervals Canonical interval projections.
	 * @return array<int,array<string,mixed>> Bounded canonical intervals.
	 */
	private function map_intervals( $intervals ) {
		$mapped_intervals = array();
		foreach ( is_array( $intervals ) ? $intervals : array() as $interval ) {
			if ( ! is_array( $interval ) ) {
				continue;
			}
			$mapped_intervals[] = array(
				'start_at'         => isset( $interval['start_at'] ) ? sanitize_text_field( (string) $interval['start_at'] ) : '',
				'end_at'           => isset( $interval['end_at'] ) ? sanitize_text_field( (string) $interval['end_at'] ) : '',
				'start_label'      => isset( $interval['start_label'] ) ? sanitize_text_field( (string) $interval['start_label'] ) : '',
				'end_label'        => isset( $interval['end_label'] ) ? sanitize_text_field( (string) $interval['end_label'] ) : '',
				'duration_label'   => isset( $interval['duration_label'] ) ? sanitize_text_field( (string) $interval['duration_label'] ) : '',
				'is_full_day'      => ! empty( $interval['is_full_day'] ),
				'is_overnight'     => ! empty( $interval['is_overnight'] ),
			);
			if ( self::MAXIMUM_INTERVALS <= count( $mapped_intervals ) ) {
				break;
			}
		}

		return $mapped_intervals;
	}

	/**
	 * Remove Resource and storage metadata from individual selected dates.
	 *
	 * @param array<int,array<string,mixed>> $selected_dates Canonical selected-date projections.
	 * @return array<int,array<string,string>> Bounded individual dates.
	 */
	private function map_selected_dates( $selected_dates ) {
		$mapped_dates = array();
		foreach ( is_array( $selected_dates ) ? $selected_dates : array() as $selected_date ) {
			if ( ! is_array( $selected_date ) ) {
				continue;
			}
			$mapped_dates[] = array(
				'date'       => isset( $selected_date['date'] ) ? sanitize_text_field( (string) $selected_date['date'] ) : '',
				'date_label' => isset( $selected_date['date_label'] ) ? sanitize_text_field( (string) $selected_date['date_label'] ) : '',
				'time_label' => isset( $selected_date['time_label'] ) ? sanitize_text_field( (string) $selected_date['time_label'] ) : '',
				'boundary'   => isset( $selected_date['boundary'] ) ? sanitize_key( (string) $selected_date['boundary'] ) : '',
			);
			if ( self::MAXIMUM_SELECTED_DATES <= count( $mapped_dates ) ) {
				break;
			}
		}

		return $mapped_dates;
	}

	/**
	 * Reduce resolved form fields to bounded label and display-value rows.
	 *
	 * @param array<int,array<string,mixed>> $fields Authorized resolved form fields.
	 * @return array<int,array<string,string>> Label/value-only customer fields.
	 */
	private function map_fields( $fields ) {
		$mapped_fields = array();
		foreach ( is_array( $fields ) ? $fields : array() as $field ) {
			if ( ! is_array( $field ) || empty( $field['label'] ) ) {
				continue;
			}
			$mapped_fields[] = array(
				'label' => sanitize_text_field( (string) $field['label'] ),
				'value' => $this->get_field_display_value( $field ),
			);
			if ( self::MAXIMUM_FIELDS <= count( $mapped_fields ) ) {
				break;
			}
		}

		return $mapped_fields;
	}

	/**
	 * Resolve a safe field value, preferring configured choice labels.
	 *
	 * @param array<string,mixed> $field Authorized resolved form field.
	 * @return string Safe display value with choice labels where available.
	 */
	private function get_field_display_value( $field ) {
		$values        = isset( $field['values'] ) && is_array( $field['values'] ) ? $field['values'] : array();
		$option_labels = array();
		foreach ( isset( $field['options'] ) && is_array( $field['options'] ) ? $field['options'] : array() as $option ) {
			if ( is_array( $option ) && isset( $option['value'], $option['label'] ) ) {
				$option_labels[ (string) $option['value'] ] = sanitize_text_field( (string) $option['label'] );
			}
		}
		if ( ! empty( $values ) && ! empty( $option_labels ) ) {
			$display_values = array();
			foreach ( $values as $field_value ) {
				$field_value      = is_scalar( $field_value ) ? (string) $field_value : '';
				$display_values[] = isset( $option_labels[ $field_value ] ) ? $option_labels[ $field_value ] : sanitize_text_field( $field_value );
			}

			return sanitize_text_field( implode( ', ', $display_values ) );
		}

		return isset( $field['value'] ) && is_scalar( $field['value'] )
			? sanitize_textarea_field( (string) $field['value'] )
			: '';
	}

	/**
	 * Remove numeric internals and payment options from the cost projection.
	 *
	 * @param array<string,mixed> $costs Authorized Inspector cost projection.
	 * @return array<string,mixed> Saved cost and payment summary without options.
	 */
	private function map_costs( $costs ) {
		$costs   = is_array( $costs ) ? $costs : array();
		$payment = isset( $costs['payment'] ) && is_array( $costs['payment'] ) ? $costs['payment'] : array();
		$payment_value = isset( $payment['value'] ) ? trim( (string) $payment['value'] ) : '';
		$payment_state = '' === $payment_value || is_numeric( $payment_value )
			? 'unknown'
			: ( isset( $payment['state'] ) && 'paid' === sanitize_key( (string) $payment['state'] ) ? 'paid' : 'not_paid' );
		$payment_label = 'unknown' === $payment_state
			? __( 'Unknown', 'booking' )
			: ( isset( $payment['label'] ) ? sanitize_text_field( (string) $payment['label'] ) : '' );

		return array(
			'supported'            => ! empty( $costs['supported'] ),
			'has_saved_cost'       => ! empty( $costs['has_saved_cost'] ),
			'saved_cost_formatted' => isset( $costs['saved_cost_formatted'] ) ? sanitize_text_field( (string) $costs['saved_cost_formatted'] ) : '',
			'payment'              => array(
				'state' => $payment_state,
				'label' => $payment_label,
			),
		);
	}

	/**
	 * Normalize a bounded list of scalar presentation strings.
	 *
	 * @param mixed $values         Candidate list.
	 * @param int   $maximum_items  Maximum returned items.
	 * @param int   $maximum_length Maximum characters per item.
	 * @return array<int,string> Bounded plain-text list.
	 */
	private function map_text_list( $values, $maximum_items, $maximum_length ) {
		$mapped_values = array();
		foreach ( is_array( $values ) ? $values : array() as $list_value ) {
			if ( ! is_scalar( $list_value ) ) {
				continue;
			}
			$list_value = sanitize_text_field( (string) $list_value );
			$mapped_values[] = function_exists( 'mb_substr' ) ? mb_substr( $list_value, 0, $maximum_length ) : substr( $list_value, 0, $maximum_length );
			if ( $maximum_items <= count( $mapped_values ) ) {
				break;
			}
		}

		return $mapped_values;
	}

	/**
	 * Format a canonical database timestamp in the current site's timezone.
	 *
	 * @param mixed $database_date_time Candidate MySQL-format timestamp.
	 * @return string Localized site-local creation date or an empty string.
	 */
	private function format_database_date_time( $database_date_time ) {
		$database_date_time = is_scalar( $database_date_time ) ? (string) $database_date_time : '';
		if ( '' === trim( $database_date_time ) || '0000-00-00 00:00:00' === $database_date_time ) {
			return '';
		}
		$timezone = function_exists( 'wp_timezone' ) ? wp_timezone() : new DateTimeZone( 'UTC' );
		$date_time = DateTimeImmutable::createFromFormat( '!Y-m-d H:i:s', $database_date_time, $timezone );

		return $date_time instanceof DateTimeImmutable
			? wp_date( get_option( 'date_format' ) . ', ' . get_option( 'time_format' ), $date_time->getTimestamp(), $timezone )
			: '';
	}
}

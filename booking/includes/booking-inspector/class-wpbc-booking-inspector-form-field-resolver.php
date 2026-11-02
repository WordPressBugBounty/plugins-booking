<?php
/**
 * Booking Inspector form-field projection.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-booking-inspector-form-snapshot-builder.php';

/**
 * Resolve the current safe read-only field set from canonical form storage.
 */
final class WPBC_Booking_Inspector_Form_Field_Resolver {

	/** @var WPBC_Booking_Inspector_Form_Snapshot_Builder Snapshot and fallback service. */
	private $snapshot_builder;

	/**
	 * Construct the resolver with its immutable-provenance collaborator.
	 *
	 * @param WPBC_Booking_Inspector_Form_Snapshot_Builder|null $snapshot_builder Optional snapshot builder.
	 */
	public function __construct( $snapshot_builder = null ) {
		$this->snapshot_builder = $snapshot_builder ? $snapshot_builder : new WPBC_Booking_Inspector_Form_Snapshot_Builder();
	}

	/**
	 * Resolve fields and internal provenance through the three-level fallback.
	 *
	 * Resolution order is: immutable creation snapshot; exact form named by the
	 * stored booking marker; deterministic projection from stored values. The
	 * Resource's current default form is never consulted while reading.
	 *
	 * @param array<string,mixed> $booking Authorized internal booking record.
	 *
	 * @return array{fields:array<int,array<string,mixed>>,form_key:string,provenance:array<string,mixed>} Internal projection.
	 */
	public function resolve_booking_fields( $booking ) {
		$resource_id = isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0;
		$stored_form = isset( $booking['form'] ) && is_scalar( $booking['form'] ) ? (string) $booking['form'] : '';
		$snapshot    = $this->snapshot_builder->extract_snapshot(
			isset( $booking['booking_options'] ) ? $booking['booking_options'] : ''
		);
		$resolution  = 'snapshot';
		if ( ! empty( $snapshot ) ) {
			$snapshot = $this->snapshot_builder->enrich_legacy_snapshot( $snapshot, $resource_id, $stored_form );
		}

		if ( empty( $snapshot ) ) {
			$stored_form_key = $this->snapshot_builder->get_stored_form_key( $stored_form, $resource_id );
			if ( '' !== $stored_form_key ) {
				$snapshot   = $this->snapshot_builder->build_legacy_read_snapshot( $resource_id, $stored_form_key, $stored_form );
				$resolution = ! empty( $snapshot ) && 'form_definition' === $snapshot['definition_source']
					? 'stored_form_marker'
					: 'stored_values';
			}
		}

		if ( empty( $snapshot ) ) {
			$snapshot   = $this->snapshot_builder->build_stored_value_snapshot( $stored_form, $resource_id );
			$resolution = 'stored_values';
		}

		return array(
			'fields'     => $this->snapshot_builder->project_snapshot_fields( $snapshot, $stored_form, $resource_id ),
			'form_key'   => ! empty( $snapshot['form_key'] ) ? sanitize_text_field( $snapshot['form_key'] ) : '',
			'provenance' => array(
				'resolution'      => $resolution,
				'schema_version'  => ! empty( $snapshot['schema_version'] ) ? absint( $snapshot['schema_version'] ) : 0,
				'form_key'        => ! empty( $snapshot['form_key'] ) ? sanitize_text_field( $snapshot['form_key'] ) : '',
			),
		);
	}

	/**
	 * Return a deterministic stored-value projection for compatibility callers.
	 *
	 * New Inspector reads should call `resolve_booking_fields()` so immutable
	 * snapshots and stored form markers participate in resolution.
	 *
	 * @param mixed $stored_form Canonical Booking Calendar form string.
	 * @param int   $resource_id Booking Resource suffix used by stored field names.
	 *
	 * @return array<int,array<string,string>> Ordered field DTO records.
	 */
	public function resolve_fields( $stored_form, $resource_id ) {
		$snapshot = $this->snapshot_builder->build_stored_value_snapshot( $stored_form, $resource_id );

		return $this->snapshot_builder->project_snapshot_fields( $snapshot, $stored_form, $resource_id );
	}

	/**
	 * Resolve a booking title from the established backend title option.
	 *
	 * @param array<string,mixed> $booking Internal booking record.
	 *
	 * @return string Sanitized booking title with an ID fallback.
	 */
	public function resolve_title( $booking ) {
		$booking_id    = isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : 0;
		$title_pattern = function_exists( 'get_bk_option' )
			? get_bk_option( 'booking_default_title_in_day_for_calendar_view_mode', '[id]: [firstname][name] [secondname]' )
			: '[id]: [firstname][name] [secondname]';
		if ( is_scalar( $title_pattern ) && function_exists( 'wpbc_lang' ) ) {
			$title_pattern = wpbc_lang( (string) $title_pattern );
		}
		$title_pattern = is_scalar( $title_pattern ) ? sanitize_text_field( (string) $title_pattern ) : '[id]: [firstname][name] [secondname]';
		$matches       = array();
		preg_match_all( '/\[([a-zA-Z0-9_-]+)\]/', $title_pattern, $matches );
		$field_names = array();
		foreach ( isset( $matches[1] ) ? $matches[1] : array() as $field_name ) {
			$field_name = sanitize_key( $field_name );
			if ( '' !== $field_name && 'id' !== $field_name ) {
				$field_names[ $field_name ] = $field_name;
			}
		}
		$field_values = $this->resolve_values(
			isset( $booking['form'] ) ? $booking['form'] : '',
			array_values( $field_names ),
			isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
			true
		);
		if ( ! empty( $field_names ) && ! array_filter( $field_values, 'strlen' ) ) {
			return sprintf( /* translators: %d: booking ID. */ __( 'Booking #%d', 'booking' ), $booking_id );
		}
		$title = preg_replace_callback(
			'/\[([a-zA-Z0-9_-]+)\]/',
			static function ( $shortcode_match ) use ( $booking_id, $field_values ) {
				$shortcode_name = sanitize_key( $shortcode_match[1] );
				return 'id' === $shortcode_name
					? (string) $booking_id
					: ( isset( $field_values[ $shortcode_name ] ) ? $field_values[ $shortcode_name ] : '' );
			},
			$title_pattern
		);
		$title = sanitize_text_field( is_string( $title ) ? $title : '' );
		$title = preg_replace( '/\s+/', ' ', $title );
		$title = is_string( $title ) ? trim( $title ) : '';

		return '' !== $title
			? $title
			: sprintf( /* translators: %d: booking ID. */ __( 'Booking #%d', 'booking' ), $booking_id );
	}

	/**
	 * Parse only explicitly requested values from canonical form storage.
	 *
	 * @param mixed             $stored_form      Canonical stored form string.
	 * @param array<int,string> $allowed_fields   Allowed normalized field names.
	 * @param int               $resource_id      Resource suffix used in stored names.
	 * @param bool              $combine_repeated Whether repeated values are combined.
	 *
	 * @return array<string,string> Sanitized field values.
	 */
	private function resolve_values( $stored_form, $allowed_fields, $resource_id, $combine_repeated ) {
		$allowed_fields = array_values( array_unique( array_filter( array_map( 'sanitize_key', (array) $allowed_fields ) ) ) );
		$resolved_fields = array();
		if ( empty( $allowed_fields ) || ! is_scalar( $stored_form ) || '' === (string) $stored_form ) {
			return $resolved_fields;
		}

		foreach ( explode( '~', (string) $stored_form ) as $field_record ) {
			$field_parts = explode( '^', $field_record, 3 );
			if ( 3 !== count( $field_parts ) ) {
				continue;
			}
			$field_name      = str_replace( '[]', '', sanitize_key( $field_parts[1] ) );
			$resource_suffix = (string) absint( $resource_id );
			if ( '' !== $resource_suffix && $resource_suffix === substr( $field_name, -strlen( $resource_suffix ) ) ) {
				$field_name = substr( $field_name, 0, -strlen( $resource_suffix ) );
			} else {
				$field_name = preg_replace( '/\d+$/', '', $field_name );
			}
			if ( ! in_array( $field_name, $allowed_fields, true ) ) {
				continue;
			}
			$field_value = sanitize_text_field( wp_unslash( $field_parts[2] ) );
			if ( isset( $resolved_fields[ $field_name ] ) ) {
				if ( $combine_repeated && '' !== $field_value && false === strpos( ', ' . $resolved_fields[ $field_name ] . ', ', ', ' . $field_value . ', ' ) ) {
					$resolved_fields[ $field_name ] .= ', ' . $field_value;
				}
				continue;
			}
			$resolved_fields[ $field_name ] = $field_value;
		}

		return $resolved_fields;
	}
}

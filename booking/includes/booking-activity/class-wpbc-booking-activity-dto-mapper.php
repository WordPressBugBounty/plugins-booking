<?php
/**
 * Booking activity browser DTO mapper.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Map raw activity rows to authorized, localized, JSON-safe records.
 */
final class WPBC_Booking_Activity_DTO_Mapper {

	/**
	 * Map a repository page without exposing raw storage fields.
	 *
	 * @param array<string,mixed> $activity_page Raw repository page.
	 *
	 * @return array<string,mixed> JSON-safe event and pagination DTO.
	 */
	public function map_page( $activity_page ) {
		$events     = array();
		$event_rows = isset( $activity_page['events'] ) && is_array( $activity_page['events'] ) ? $activity_page['events'] : array();
		$this->prime_actor_cache( $event_rows );
		foreach ( $event_rows as $event_row ) {
			if ( ! is_array( $event_row ) ) {
				continue;
			}
			$events[] = $this->map_event( $event_row );
		}

		$pagination = isset( $activity_page['pagination'] ) && is_array( $activity_page['pagination'] ) ? $activity_page['pagination'] : array();

		return array(
			'events'     => $events,
			'pagination' => array(
				'page'        => isset( $pagination['page'] ) ? max( 1, absint( $pagination['page'] ) ) : 1,
				'per_page'    => isset( $pagination['per_page'] ) ? min( 50, max( 1, absint( $pagination['per_page'] ) ) ) : 20,
				'total_items' => isset( $pagination['total_items'] ) ? absint( $pagination['total_items'] ) : 0,
				'total_pages' => isset( $pagination['total_pages'] ) ? absint( $pagination['total_pages'] ) : 0,
			),
		);
	}

	/**
	 * Prime WordPress user caches for one page to prevent actor N+1 queries.
	 *
	 * @param array<int,array<string,mixed>> $event_rows Raw repository rows.
	 *
	 * @return void
	 */
	private function prime_actor_cache( $event_rows ) {
		$actor_user_ids = array();
		foreach ( $event_rows as $event_row ) {
			if ( is_array( $event_row ) && ! empty( $event_row['actor_user_id'] ) ) {
				$actor_user_ids[] = absint( $event_row['actor_user_id'] );
			}
		}
		$actor_user_ids = array_values( array_unique( array_filter( $actor_user_ids ) ) );
		if ( $actor_user_ids && function_exists( 'cache_users' ) ) {
			cache_users( $actor_user_ids );
		}
	}

	/**
	 * Map one raw event row.
	 *
	 * @param array<string,mixed> $event_row Raw repository row.
	 *
	 * @return array<string,mixed> Safe event DTO.
	 */
	private function map_event( $event_row ) {
		$event_type = isset( $event_row['event_type'] ) ? sanitize_key( $event_row['event_type'] ) : 'booking_updated';
		$payload    = $this->decode_payload( isset( $event_row['event_payload'] ) ? $event_row['event_payload'] : '' );
		$labels     = $this->get_event_labels( $event_type, $payload );
		$change_dto = $this->map_change_set( isset( $payload['change_set'] ) ? $payload['change_set'] : array() );

		return array(
			'id'             => isset( $event_row['activity_id'] ) ? absint( $event_row['activity_id'] ) : 0,
			'type'           => $event_type,
			'label'          => $labels['label'],
			'description'    => $labels['description'],
			'changes'        => $change_dto['changes'],
			'changes_notice' => $change_dto['notice'],
			'actor_label'    => $this->get_actor_label( isset( $event_row['actor_user_id'] ) ? absint( $event_row['actor_user_id'] ) : 0 ),
			'occurred_at'    => $this->format_utc_date_time( isset( $event_row['occurred_at'] ) ? $event_row['occurred_at'] : '' ),
		);
	}

	/**
	 * Map a stored change set to presentation-only field rows.
	 *
	 * Storage is normalized again because database content is not a trusted DTO.
	 * Field keys and raw before/after arrays are intentionally not exposed.
	 *
	 * @param mixed $candidate_change_set Stored versioned change set.
	 *
	 * @return array{changes:array<int,array<string,string>>,notice:string} Safe presentation records.
	 */
	private function map_change_set( $candidate_change_set ) {
		$change_set = WPBC_Booking_Activity_Change_Set::normalize( $candidate_change_set );
		if ( empty( $change_set ) ) {
			return array(
				'changes' => array(),
				'notice'  => '',
			);
		}

		$changes = array();
		foreach ( $change_set['changes'] as $change_record ) {
			$description = __( 'Value changed.', 'booking' );
			if ( 'bounded_choice' === $change_record['value_policy'] ) {
				$description = sprintf(
					/* translators: 1: previous choice labels, 2: new choice labels. */
					__( 'Changed from %1$s to %2$s.', 'booking' ),
					$this->format_choice_labels( $change_record['before'] ),
					$this->format_choice_labels( $change_record['after'] )
				);
				if ( ! empty( $change_record['values_truncated'] ) ) {
					$description .= ' ' . __( 'Only the first configured choices are shown.', 'booking' );
				}
			} elseif ( 'exact_value' === $change_record['value_policy'] ) {
				$description = sprintf(
					/* translators: 1: previous exact operational value, 2: new exact operational value. */
					__( 'Changed from %1$s to %2$s.', 'booking' ),
					WPBC_Booking_Activity_Change_Set::format_booking_schedule( $change_record['before'] ),
					WPBC_Booking_Activity_Change_Set::format_booking_schedule( $change_record['after'] )
				);
			}
			$changes[] = array(
				'label'       => sanitize_text_field( $change_record['label'] ),
				'description' => $description,
			);
		}

		$notice = '';
		if ( ! empty( $change_set['truncated'] ) ) {
			$notice = sprintf(
				/* translators: 1: displayed field-change count, 2: total field-change count. */
				__( 'Showing the first %1$d of %2$d field changes.', 'booking' ),
				count( $changes ),
				absint( $change_set['total_changes'] )
			);
		}

		return array(
			'changes' => $changes,
			'notice'  => $notice,
		);
	}

	/**
	 * Format bounded choice labels for an Activity sentence.
	 *
	 * @param array<int,string> $choice_labels Safe normalized labels.
	 *
	 * @return string Comma-separated labels or a localized empty-state label.
	 */
	private function format_choice_labels( $choice_labels ) {
		if ( empty( $choice_labels ) ) {
			return __( 'Not set', 'booking' );
		}

		return implode( ', ', array_map( 'sanitize_text_field', $choice_labels ) );
	}

	/**
	 * Decode a bounded JSON event payload.
	 *
	 * @param mixed $encoded_payload Stored JSON value.
	 *
	 * @return array<string,mixed> Decoded payload.
	 */
	private function decode_payload( $encoded_payload ) {
		if ( ! is_scalar( $encoded_payload ) || '' === (string) $encoded_payload ) {
			return array();
		}
		$decoded_payload = json_decode( (string) $encoded_payload, true );

		return is_array( $decoded_payload ) ? $decoded_payload : array();
	}

	/**
	 * Return localized presentation for one stable event type.
	 *
	 * @param string              $event_type Stable event type.
	 * @param array<string,mixed> $payload    Allow-listed event metadata.
	 *
	 * @return array{label:string,description:string} Presentation strings.
	 */
	private function get_event_labels( $event_type, $payload ) {
		$labels = array(
			'booking_created'        => __( 'Booking created', 'booking' ),
			'booking_updated'        => __( 'Booking updated', 'booking' ),
			'booking_approved'       => __( 'Booking approved', 'booking' ),
			'booking_set_pending'    => __( 'Booking set to pending', 'booking' ),
			'booking_trashed'        => __( 'Booking moved to trash', 'booking' ),
			'booking_restored'       => __( 'Booking restored', 'booking' ),
			'booking_marked_read'    => __( 'Booking marked as read', 'booking' ),
			'booking_marked_unread'  => __( 'Booking marked as unread', 'booking' ),
			'booking_locale_changed' => __( 'Booking locale changed', 'booking' ),
			'booking_resource_changed' => __( 'Booking Resource changed', 'booking' ),
			'booking_duplicated'     => __( 'Booking duplicated', 'booking' ),
			'booking_dates_updated'  => __( 'Booking dates updated', 'booking' ),
			'booking_details_updated' => __( 'Booking details updated', 'booking' ),
			'public_note_updated'    => __( 'Public note updated', 'booking' ),
			'private_note_updated'   => __( 'Private note updated', 'booking' ),
			'booking_cost_updated'   => __( 'Booking cost updated', 'booking' ),
			'payment_status_updated' => __( 'Payment status updated', 'booking' ),
			'payment_response_received' => __( 'Payment response received', 'booking' ),
			'payment_request_sent'   => __( 'Payment request sent', 'booking' ),
		);
		$label       = isset( $labels[ $event_type ] ) ? $labels[ $event_type ] : __( 'Booking updated', 'booking' );
		$description = '';
		$before      = isset( $payload['before'] ) ? sanitize_text_field( (string) $payload['before'] ) : '';
		$after       = isset( $payload['after'] ) ? sanitize_text_field( (string) $payload['after'] ) : '';

		$change_set = isset( $payload['change_set'] ) ? WPBC_Booking_Activity_Change_Set::normalize( $payload['change_set'] ) : array();
		if ( in_array( $event_type, array( 'booking_details_updated', 'booking_dates_updated' ), true ) && $change_set ) {
			$total_changes = absint( $change_set['total_changes'] );
			$description   = sprintf(
				/* translators: %d: number of changed booking fields. */
				_n( '%d booking field changed.', '%d booking fields changed.', $total_changes, 'booking' ),
				$total_changes
			);
		} elseif ( '' !== $before || '' !== $after ) {
			$description = sprintf(
				/* translators: 1: previous value, 2: new value. */
				__( 'Changed from %1$s to %2$s.', 'booking' ),
				'' !== $before ? $before : __( 'Not set', 'booking' ),
				'' !== $after ? $after : __( 'Not set', 'booking' )
			);
		} elseif ( ! empty( $payload['resource_id'] ) ) {
			$description = sprintf(
				/* translators: %d: Booking Resource ID. */
				__( 'Booking Resource ID: %d', 'booking' ),
				absint( $payload['resource_id'] )
			);
		} elseif ( ! empty( $payload['fields'] ) && is_array( $payload['fields'] ) ) {
			$description = sprintf(
				/* translators: %s: comma-separated booking field names. */
				__( 'Updated fields: %s', 'booking' ),
				implode( ', ', array_map( 'sanitize_key', $payload['fields'] ) )
			);
		}

		return array(
			'label'       => $label,
			'description' => $description,
		);
	}

	/**
	 * Resolve an actor label without storing user profile data in activity rows.
	 *
	 * @param int $actor_user_id WordPress user ID.
	 *
	 * @return string Current display name or a system label.
	 */
	private function get_actor_label( $actor_user_id ) {
		$actor_user_id = absint( $actor_user_id );
		if ( ! $actor_user_id ) {
			return __( 'System', 'booking' );
		}
		$user = get_userdata( $actor_user_id );

		return $user instanceof WP_User && '' !== trim( (string) $user->display_name )
			? sanitize_text_field( $user->display_name )
			: __( 'Former user', 'booking' );
	}

	/**
	 * Format a stored UTC timestamp in the site's date and time formats.
	 *
	 * @param mixed $utc_date_time Stored UTC timestamp.
	 *
	 * @return string Localized date/time label.
	 */
	private function format_utc_date_time( $utc_date_time ) {
		$timestamp = strtotime( (string) $utc_date_time . ' UTC' );
		if ( false === $timestamp ) {
			return '';
		}

		return wp_date( get_option( 'date_format' ) . ', ' . get_option( 'time_format' ), $timestamp, wp_timezone() );
	}
}

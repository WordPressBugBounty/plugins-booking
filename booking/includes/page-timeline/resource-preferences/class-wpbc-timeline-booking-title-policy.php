<?php
/**
 * Per-Resource booking-title resolution for Timeline booking spans.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Resolve private booking-form data into safe Resource-specific card labels.
 */
final class WPBC_Timeline_Booking_Title_Policy {

	/** Default title used only when the global option is unavailable. */
	const DEFAULT_BOOKING_TITLE_TEMPLATE = '[id]: [firstname][name] [secondname]';

	/** @var WPBC_Timeline_Resource_Display_Preferences Resource override reader. */
	private $display_preferences;

	/** @var callable|null Optional global-template reader for controlled consumers. */
	private $global_template_reader;

	/** @var callable|null Optional form parser used by deterministic tests. */
	private $form_parser;

	/** @var array<int,string> Effective title templates keyed by Resource ID. */
	private $templates_by_resource = array();

	/** @var string Current inherited global title template. */
	private $global_template = self::DEFAULT_BOOKING_TITLE_TEMPLATE;

	/** @var array<int,array<string,string>> Parsed allow-listed fields keyed by booking ID. */
	private $fields_by_booking = array();

	/**
	 * Construct the policy with batch preference and parser collaborators.
	 *
	 * @param WPBC_Timeline_Resource_Display_Preferences|null $display_preferences  Optional current-user preference reader.
	 * @param callable|null                                   $global_template_reader Optional reader returning the current global template.
	 * @param callable|null                                   $form_parser            Optional test parser receiving stored form, field names,
	 *                                                                                canonical Resource ID, and combine-repeated flag.
	 */
	public function __construct( $display_preferences = null, $global_template_reader = null, $form_parser = null ) {
		$this->display_preferences    = $display_preferences ? $display_preferences : new WPBC_Timeline_Resource_Display_Preferences();
		$this->global_template_reader = is_callable( $global_template_reader ) ? $global_template_reader : null;
		$this->form_parser            = is_callable( $form_parser ) ? $form_parser : null;
	}

	/**
	 * Prepare one bounded Timeline projection in batch.
	 *
	 * Templates are resolved only for effective Resource IDs produced by span
	 * projection. Their required tokens are unioned with the name fields used for
	 * initials, after which every booking's canonical stored form is parsed once.
	 * Calling this method again discards the previous window context so canonical
	 * refreshes immediately see current user and global preferences.
	 *
	 * @param array<int,array<string,mixed>> $bookings               Internal booking rows keyed by booking ID.
	 * @param array<int,int>                 $effective_resource_ids Authorized effective span Resource IDs.
	 *
	 * @return void
	 */
	public function prepare_window( $bookings, $effective_resource_ids ) {
		$effective_resource_ids       = array_values( array_unique( array_filter( array_map( 'absint', (array) $effective_resource_ids ) ) ) );
		$this->templates_by_resource  = array();
		$this->fields_by_booking      = array();
		$this->global_template        = $this->read_global_template();
		$resource_preferences         = $this->display_preferences->get_booking_title_preferences( $effective_resource_ids );
		$required_field_names         = array(
			'firstname'  => 'firstname',
			'name'       => 'name',
			'secondname' => 'secondname',
		);

		foreach ( $effective_resource_ids as $resource_id ) {
			$preference = isset( $resource_preferences[ $resource_id ] ) ? $resource_preferences[ $resource_id ] : array();
			$template   = isset( $preference['mode'] )
				&& WPBC_Timeline_Resource_Display_Preferences::BOOKING_TITLE_MODE_CUSTOM === $preference['mode']
				? ( isset( $preference['template'] ) ? (string) $preference['template'] : '' )
				: $this->global_template;
			$template   = $this->normalize_template( $template );
			$this->templates_by_resource[ $resource_id ] = $template;

			foreach ( $this->get_template_field_names( $template ) as $field_name ) {
				$required_field_names[ $field_name ] = $field_name;
			}
		}

		$required_field_names = array_values( $required_field_names );
		foreach ( (array) $bookings as $booking_key => $booking ) {
			if ( ! is_array( $booking ) ) {
				continue;
			}
			$booking_id = isset( $booking['booking_id'] ) ? absint( $booking['booking_id'] ) : absint( $booking_key );
			if ( ! $booking_id ) {
				continue;
			}
			$this->fields_by_booking[ $booking_id ] = $this->parse_form_fields(
				isset( $booking['form'] ) ? $booking['form'] : '',
				$required_field_names,
				isset( $booking['booking_type'] ) ? absint( $booking['booking_type'] ) : 0,
				true
			);
		}
	}

	/**
	 * Resolve one span label after its effective Resource is known.
	 *
	 * @param int $booking_id          Booking ID.
	 * @param int $effective_resource_id Effective Resource ID for this span.
	 *
	 * @return array<string,string> Safe label and initials source.
	 */
	public function resolve_span_title( $booking_id, $effective_resource_id ) {
		$booking_id            = absint( $booking_id );
		$effective_resource_id = absint( $effective_resource_id );
		$template              = isset( $this->templates_by_resource[ $effective_resource_id ] )
			? $this->templates_by_resource[ $effective_resource_id ]
			: $this->global_template;
		$form_fields           = isset( $this->fields_by_booking[ $booking_id ] )
			? $this->fields_by_booking[ $booking_id ]
			: array();
		$label                 = preg_replace_callback(
			'/\[([a-zA-Z0-9_-]+)\]/',
			static function ( $shortcode_match ) use ( $booking_id, $form_fields ) {
				$shortcode_name = sanitize_key( $shortcode_match[1] );
				if ( 'id' === $shortcode_name ) {
					return (string) $booking_id;
				}

				return isset( $form_fields[ $shortcode_name ] ) ? $form_fields[ $shortcode_name ] : '';
			},
			$template
		);
		$label                 = sanitize_text_field( is_string( $label ) ? $label : '' );
		$label                 = preg_replace( '/\s+/', ' ', $label );
		$label                 = is_string( $label ) ? trim( $label ) : '';
		if ( '' === $label ) {
			$label = sprintf(
				/* translators: %d: booking ID. */
				__( 'Booking #%d', 'booking' ),
				$booking_id
			);
		}

		$name_parts = array();
		$first_name = ! empty( $form_fields['firstname'] )
			? $form_fields['firstname']
			: ( ! empty( $form_fields['name'] ) ? $form_fields['name'] : '' );
		if ( '' !== $first_name ) {
			$name_parts[] = $first_name;
		}
		if ( ! empty( $form_fields['secondname'] ) ) {
			$name_parts[] = $form_fields['secondname'];
		}

		return array(
			'label'           => $label,
			'initials_source' => ! empty( $name_parts ) ? implode( ' ', $name_parts ) : $label,
		);
	}

	/**
	 * Read the current MultiUser-aware global title template.
	 *
	 * The language variant is resolved at read time. Missing/inherit Resource
	 * preferences therefore follow a later global option or language change
	 * without copying that value into user metadata.
	 *
	 * @return string Sanitized current template, including an intentional empty value.
	 */
	private function read_global_template() {
		$title_template = $this->global_template_reader
			? call_user_func( $this->global_template_reader )
			: ( function_exists( 'get_bk_option' )
				? get_bk_option( 'booking_default_title_in_day_for_calendar_view_mode', self::DEFAULT_BOOKING_TITLE_TEMPLATE )
				: self::DEFAULT_BOOKING_TITLE_TEMPLATE );
		if ( is_scalar( $title_template ) && function_exists( 'wpbc_lang' ) ) {
			$title_template = wpbc_lang( (string) $title_template );
		}

		return is_scalar( $title_template )
			? $this->normalize_template( (string) $title_template )
			: self::DEFAULT_BOOKING_TITLE_TEMPLATE;
	}

	/**
	 * Normalize one server-owned title template to plain text.
	 *
	 * @param mixed $title_template Stored or injected template.
	 *
	 * @return string Sanitized template.
	 */
	private function normalize_template( $title_template ) {
		$title_template = is_scalar( $title_template ) ? sanitize_text_field( (string) $title_template ) : '';
		$title_template = preg_replace( '/\s+/', ' ', $title_template );

		return is_string( $title_template ) ? trim( $title_template ) : '';
	}

	/**
	 * Extract unique booking-form token names from one title template.
	 *
	 * @param string $title_template Sanitized title template.
	 *
	 * @return array<int,string> Unique field names excluding the booking ID token.
	 */
	private function get_template_field_names( $title_template ) {
		$matches = array();
		if ( 1 > preg_match_all( '/\[([a-zA-Z0-9_-]+)\]/', (string) $title_template, $matches ) ) {
			return array();
		}

		$field_names = array();
		foreach ( $matches[1] as $field_name ) {
			$field_name = sanitize_key( $field_name );
			if ( 'id' !== $field_name && '' !== $field_name ) {
				$field_names[ $field_name ] = $field_name;
			}
		}

		return array_values( $field_names );
	}

	/**
	 * Parse requested form values once for one booking.
	 *
	 * Stored values remain authoritative for custom or later-changed form
	 * definitions. Parsing never consults the Resource's current form and never
	 * performs a database read.
	 *
	 * @param mixed             $stored_form      Canonical serialized Booking Calendar form string.
	 * @param array<int,string> $allowed_fields   Union of fields required by effective templates and initials.
	 * @param int               $resource_id      Canonical booking Resource suffix stored in field names.
	 * @param bool              $combine_repeated Whether repeated values are combined for shortcode output.
	 *
	 * @return array<string,string> Sanitized allow-listed values.
	 */
	private function parse_form_fields( $stored_form, $allowed_fields, $resource_id, $combine_repeated ) {
		if ( $this->form_parser ) {
			$parsed_fields = call_user_func( $this->form_parser, $stored_form, $allowed_fields, $resource_id, $combine_repeated );

			return $this->normalize_parsed_fields( $parsed_fields, $allowed_fields );
		}

		$allowed_fields = array_values( array_unique( array_filter( array_map( 'sanitize_key', (array) $allowed_fields ) ) ) );
		$parsed_fields  = array();
		if ( empty( $allowed_fields ) || ! is_scalar( $stored_form ) || '' === (string) $stored_form ) {
			return $parsed_fields;
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
			if ( isset( $parsed_fields[ $field_name ] ) ) {
				if ( $combine_repeated && '' !== $field_value && false === strpos( ', ' . $parsed_fields[ $field_name ] . ', ', ', ' . $field_value . ', ' ) ) {
					$parsed_fields[ $field_name ] .= ', ' . $field_value;
				}
				continue;
			}
			$parsed_fields[ $field_name ] = $field_value;
		}

		return $parsed_fields;
	}

	/**
	 * Normalize controlled parser output to the same private allow list.
	 *
	 * @param mixed             $parsed_fields  Candidate parser result.
	 * @param array<int,string> $allowed_fields Allowed field names.
	 *
	 * @return array<string,string> Sanitized field map.
	 */
	private function normalize_parsed_fields( $parsed_fields, $allowed_fields ) {
		$allowed_fields    = array_values( array_unique( array_filter( array_map( 'sanitize_key', (array) $allowed_fields ) ) ) );
		$normalized_fields = array();
		foreach ( is_array( $parsed_fields ) ? $parsed_fields : array() as $field_name => $field_value ) {
			$field_name = sanitize_key( $field_name );
			if ( ! in_array( $field_name, $allowed_fields, true ) || ! is_scalar( $field_value ) ) {
				continue;
			}
			$normalized_fields[ $field_name ] = sanitize_text_field( (string) $field_value );
		}

		return $normalized_fields;
	}
}

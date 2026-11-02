<?php
/**
 * Immutable Booking Inspector form-provenance snapshots.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/class-wpbc-booking-inspector-form-definition-repository.php';
require_once __DIR__ . '/class-wpbc-booking-inspector-structured-field-resolver.php';

/**
 * Build and normalize the compact form definition stored with a new booking.
 *
 * The snapshot intentionally stores only stable presentation metadata. Field
 * values remain in the canonical booking `form` column and are projected only
 * after the booking has passed the Inspector authorization service.
 */
final class WPBC_Booking_Inspector_Form_Snapshot_Builder {

	/** Booking-options key reserved for the immutable snapshot. */
	const OPTION_KEY = 'wpbc_booking_form_snapshot';

	/** Current normalized snapshot contract. */
	const SCHEMA_VERSION = 4;

	/** Maximum number of form fields retained in one snapshot. */
	const MAX_FIELDS = 100;

	/** Maximum number of immutable choices retained for one form field. */
	const MAX_FIELD_OPTIONS = 300;

	/** Maximum normalized field-key length. */
	const MAX_FIELD_KEY_LENGTH = 100;

	/** Maximum stored field-label length. */
	const MAX_FIELD_LABEL_LENGTH = 200;

	/** @var WPBC_Booking_Inspector_Form_Definition_Repository Exact form-definition repository. */
	private $form_definition_repository;

	/** @var WPBC_Booking_Inspector_Structured_Field_Resolver Structured customer-field resolver. */
	private $structured_field_resolver;

	/**
	 * Construct the snapshot builder with focused domain collaborators.
	 *
	 * @param WPBC_Booking_Inspector_Form_Definition_Repository|null $form_definition_repository Optional repository.
	 * @param WPBC_Booking_Inspector_Structured_Field_Resolver|null  $structured_field_resolver   Optional resolver.
	 */
	public function __construct( $form_definition_repository = null, $structured_field_resolver = null ) {
		$this->form_definition_repository = $form_definition_repository
			? $form_definition_repository
			: new WPBC_Booking_Inspector_Form_Definition_Repository();
		$this->structured_field_resolver = $structured_field_resolver
			? $structured_field_resolver
			: new WPBC_Booking_Inspector_Structured_Field_Resolver();
	}

	/**
	 * Build a normalized snapshot from the exact form selected at creation.
	 *
	 * The explicit form name or stored custom-form marker is preferred. Only
	 * during creation, when neither exists, may the Resource's then-current
	 * default form be resolved. Read-time fallback never consults that default.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $form_name   Explicit form name supplied by the canonical workflow.
	 * @param string $stored_form  Canonical encoded booking field values.
	 * @param array  $form_context Optional server-validated form-source context used at creation.
	 *
	 * @return array<string,mixed> Normalized snapshot, or an empty array.
	 */
	public function build_snapshot( $resource_id, $form_name, $stored_form, $form_context = array() ) {
		$resource_id = absint( $resource_id );
		$stored_form = is_scalar( $stored_form ) ? (string) $stored_form : '';
		$form_name         = $this->resolve_creation_form_key( $resource_id, $form_name, $stored_form );
		$form_definition   = $this->load_form_definition( $resource_id, $form_name, $form_context );
		$fields            = $this->structured_field_resolver->resolve_definition_fields( $form_definition, $stored_form, $resource_id );
		$resolved_form_key = ! empty( $form_definition['form_key'] )
			? $this->normalize_form_key( $form_definition['form_key'] )
			: $form_name;
		$source            = ! empty( $form_definition )
			? 'form_definition'
			: 'stored_values';

		if ( empty( $fields ) ) {
			return array();
		}

		return $this->normalize_snapshot(
			array(
				'schema_version'    => self::SCHEMA_VERSION,
				'form_key'          => $resolved_form_key,
				'definition_source' => $source,
				'fields'            => $fields,
			)
		);
	}

	/**
	 * Build a non-persisted projection for a pre-snapshot named-form booking.
	 *
	 * The exact stored form marker remains authoritative. Unlike creation, this
	 * compatibility path also retains customer fields that still exist in the
	 * booking row but no longer exist in that named form. Choice metadata cannot
	 * be reconstructed from storage, so the structured resolver exposes those
	 * orphaned values as editable free text instead of inventing a one-option
	 * select, radio, or checkbox contract.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $form_name   Exact form key stored with the booking.
	 * @param string $stored_form Canonical encoded booking field values.
	 *
	 * @return array<string,mixed> Normalized compatibility snapshot projection, or an empty array.
	 */
	public function build_legacy_read_snapshot( $resource_id, $form_name, $stored_form ) {
		$resource_id     = absint( $resource_id );
		$form_name       = $this->normalize_form_key( $form_name );
		$stored_form     = is_scalar( $stored_form ) ? (string) $stored_form : '';
		$form_definition = '' !== $form_name
			? $this->load_form_definition( $resource_id, $form_name )
			: array();
		$fields = $this->structured_field_resolver->resolve_definition_fields(
			$form_definition,
			$stored_form,
			$resource_id,
			true
		);
		if ( empty( $fields ) ) {
			return array();
		}

		return $this->normalize_snapshot(
			array(
				'schema_version'    => self::SCHEMA_VERSION,
				'form_key'          => $form_name,
				'definition_source' => ! empty( $form_definition ) ? 'form_definition' : 'stored_values',
				'fields'            => $fields,
			)
		);
	}

	/**
	 * Build the stable value-derived fallback for a legacy booking.
	 *
	 * This fallback deliberately avoids the Resource's current default form.
	 * It cannot recover labels that were never stored, so known canonical field
	 * labels and deterministic humanized keys are used instead.
	 *
	 * @param string $stored_form Canonical encoded booking field values.
	 * @param int    $resource_id Booking Resource ID.
	 *
	 * @return array<string,mixed> Normalized fallback snapshot, or an empty array.
	 */
	public function build_stored_value_snapshot( $stored_form, $resource_id ) {
		$fields = $this->structured_field_resolver->build_stored_value_definitions( $stored_form, $resource_id );

		if ( empty( $fields ) ) {
			return array();
		}

		return $this->normalize_snapshot(
			array(
				'schema_version'    => self::SCHEMA_VERSION,
				'form_key'          => $this->get_stored_form_key( $stored_form, $resource_id ),
				'definition_source' => 'stored_values',
				'fields'            => $fields,
			)
		);
	}

	/**
	 * Extract and validate the snapshot from canonical booking-options storage.
	 *
	 * @param mixed $booking_options Serialized booking options or an option array.
	 *
	 * @return array<string,mixed> Normalized snapshot, or an empty array.
	 */
	public function extract_snapshot( $booking_options ) {
		$options = is_array( $booking_options )
			? $booking_options
			: ( function_exists( 'maybe_unserialize' ) ? maybe_unserialize( $booking_options ) : array() );
		if ( ! is_array( $options ) || ! isset( $options[ self::OPTION_KEY ] ) ) {
			return array();
		}

		return $this->normalize_snapshot( $options[ self::OPTION_KEY ] );
	}

	/**
	 * Enrich incomplete snapshots from their exact named form.
	 *
	 * Early Inspector snapshots did not retain the source control subtype and
	 * some snapshots captured only currently saved choices. For those incomplete
	 * fields only, this method loads the exact `form_key` already frozen in the
	 * snapshot and fills missing type, multiplicity, and configured options. It
	 * never resolves the Resource's current default, never adds or reorders
	 * fields, never changes labels, and never persists the enriched projection.
	 *
	 * @param array<string,mixed> $snapshot    Normalized stored snapshot.
	 * @param int                 $resource_id Authorized Booking Resource ID.
	 * @param string              $stored_form Canonical encoded booking values.
	 *
	 * @return array<string,mixed> Enriched read-only snapshot projection.
	 */
	public function enrich_legacy_snapshot( $snapshot, $resource_id, $stored_form ) {
		$snapshot    = $this->normalize_snapshot( $snapshot );
		$resource_id = absint( $resource_id );
		$stored_form = is_scalar( $stored_form ) ? (string) $stored_form : '';
		if (
			empty( $snapshot['fields'] )
			|| empty( $snapshot['form_key'] )
			|| 'form_definition' !== $snapshot['definition_source']
		) {
			return $snapshot;
		}

		$stored_values       = $this->structured_field_resolver->parse_stored_values( $stored_form, $resource_id );
		$requires_enrichment = false;
		foreach ( $snapshot['fields'] as $snapshot_field ) {
			if (
				empty( $snapshot_field['source_type'] )
				|| $this->field_needs_option_enrichment( $snapshot_field, $stored_values )
			) {
				$requires_enrichment = true;
				break;
			}
		}
		if ( ! $requires_enrichment ) {
			return $snapshot;
		}

		$form_definition = $this->load_form_definition( $resource_id, $snapshot['form_key'] );
		if ( empty( $form_definition ) ) {
			return $snapshot;
		}
		$current_fields = $this->structured_field_resolver->resolve_definition_fields( $form_definition, $stored_form, $resource_id );
		$current_map    = array();
		foreach ( $current_fields as $current_field ) {
			if ( is_array( $current_field ) && ! empty( $current_field['key'] ) ) {
				$current_map[ $current_field['key'] ] = $current_field;
			}
		}

		foreach ( $snapshot['fields'] as $field_index => $snapshot_field ) {
			$field_key = isset( $snapshot_field['key'] ) ? $snapshot_field['key'] : '';
			if ( empty( $current_map[ $field_key ] ) ) {
				continue;
			}
			$current_field = $current_map[ $field_key ];
			if ( empty( $snapshot_field['source_type'] ) && ! empty( $current_field['source_type'] ) ) {
				$snapshot['fields'][ $field_index ]['type']        = isset( $current_field['type'] ) ? $current_field['type'] : $snapshot_field['type'];
				$snapshot['fields'][ $field_index ]['source_type'] = $current_field['source_type'];
				$snapshot['fields'][ $field_index ]['multiple']    = ! empty( $current_field['multiple'] );
				$snapshot['fields'][ $field_index ]['definition_origin'] = 'form_definition';
			}
			if (
				$this->field_needs_option_enrichment( $snapshot_field, $stored_values )
				&& ! empty( $current_field['options'] )
			) {
				$snapshot['fields'][ $field_index ]['options']           = $current_field['options'];
				$snapshot['fields'][ $field_index ]['definition_origin'] = 'form_definition';
			}
		}

		return $this->normalize_snapshot( $snapshot );
	}

	/**
	 * Detect choice metadata that contains no more than the saved selections.
	 *
	 * Stored-value fallback can prove a control family but can only manufacture
	 * options from the booking's selected values. Such an option list is not a
	 * complete editing contract. The exact frozen form may therefore replace it;
	 * a non-empty broader snapshot list remains immutable.
	 *
	 * @param array<string,mixed>              $snapshot_field Normalized snapshot field.
	 * @param array<string,array<string,mixed>> $stored_values  Parsed canonical booking values.
	 *
	 * @return bool True when exact-form option recovery is required.
	 */
	private function field_needs_option_enrichment( $snapshot_field, $stored_values ) {
		$field_type        = isset( $snapshot_field['type'] ) ? sanitize_key( (string) $snapshot_field['type'] ) : '';
		$source_type       = isset( $snapshot_field['source_type'] ) ? sanitize_key( (string) $snapshot_field['source_type'] ) : '';
		$definition_origin = isset( $snapshot_field['definition_origin'] ) ? sanitize_key( (string) $snapshot_field['definition_origin'] ) : '';
		if ( 'country' === $source_type || ! in_array( $field_type, array( 'acceptance', 'checkbox', 'radio', 'select', 'time' ), true ) ) {
			return false;
		}
		if ( 'form_definition' === $definition_origin ) {
			return false;
		}
		if ( 'stored_value' === $definition_origin ) {
			return true;
		}

		$field_options = isset( $snapshot_field['options'] ) && is_array( $snapshot_field['options'] )
			? $snapshot_field['options']
			: array();
		if ( empty( $field_options ) ) {
			return true;
		}

		$field_key    = isset( $snapshot_field['key'] ) ? $this->normalize_field_key( $snapshot_field['key'] ) : '';
		$saved_values = isset( $stored_values[ $field_key ]['values'] ) && is_array( $stored_values[ $field_key ]['values'] )
			? array_values( array_map( 'strval', $stored_values[ $field_key ]['values'] ) )
			: array();
		if ( empty( $saved_values ) || count( $saved_values ) < count( $field_options ) ) {
			return false;
		}

		foreach ( $field_options as $field_option ) {
			$option_value = is_array( $field_option ) && isset( $field_option['value'] )
				? (string) $field_option['value']
				: '';
			if ( ! in_array( $option_value, $saved_values, true ) ) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Normalize an untrusted snapshot candidate into the versioned contract.
	 *
	 * Unknown keys, invalid records, executable values, and unsupported versions
	 * are discarded. This also bounds the amount of metadata read into a DTO.
	 *
	 * @param mixed $snapshot_candidate Candidate snapshot value.
	 *
	 * @return array<string,mixed> Normalized snapshot, or an empty array.
	 */
	public function normalize_snapshot( $snapshot_candidate ) {
		if ( ! is_array( $snapshot_candidate ) ) {
			return array();
		}

		$schema_version = isset( $snapshot_candidate['schema_version'] ) ? absint( $snapshot_candidate['schema_version'] ) : 0;
		if ( ! in_array( $schema_version, array( 1, 2, 3, self::SCHEMA_VERSION ), true ) ) {
			return array();
		}

		$fields       = array();
		$seen_fields  = array();
		$field_source = isset( $snapshot_candidate['fields'] ) && is_array( $snapshot_candidate['fields'] )
			? $snapshot_candidate['fields']
			: array();

		foreach ( $field_source as $field_record ) {
			if ( ! is_array( $field_record ) ) {
				continue;
			}
			$field_key = $this->normalize_field_key( isset( $field_record['key'] ) ? $field_record['key'] : '' );
			if ( '' === $field_key || isset( $seen_fields[ $field_key ] ) || $this->is_internal_field( $field_key ) ) {
				continue;
			}
			$field_label = $this->normalize_label( isset( $field_record['label'] ) ? $field_record['label'] : '' );
			$definition_origin = isset( $field_record['definition_origin'] ) ? sanitize_key( (string) $field_record['definition_origin'] ) : '';
			if ( ! in_array( $definition_origin, array( 'form_definition', 'stored_value' ), true ) ) {
				$definition_origin = '';
			}
			$fields[]    = array(
				'key'               => $field_key,
				'label'             => '' !== $field_label ? $field_label : $this->get_fallback_label( $field_key ),
				'type'              => $this->normalize_field_type( isset( $field_record['type'] ) ? $field_record['type'] : 'text' ),
				'source_type'       => $this->normalize_source_type( isset( $field_record['source_type'] ) ? $field_record['source_type'] : '' ),
				'definition_origin' => $definition_origin,
				'required'          => ! empty( $field_record['required'] ),
				'multiple'          => ! empty( $field_record['multiple'] ),
				'options'           => $this->normalize_options( isset( $field_record['options'] ) ? $field_record['options'] : array() ),
			);
			$seen_fields[ $field_key ] = true;
			if ( self::MAX_FIELDS <= count( $fields ) ) {
				break;
			}
		}

		if ( empty( $fields ) ) {
			return array();
		}

		$definition_source = isset( $snapshot_candidate['definition_source'] )
			? sanitize_key( (string) $snapshot_candidate['definition_source'] )
			: 'stored_values';
		if ( ! in_array( $definition_source, array( 'form_definition', 'stored_values' ), true ) ) {
			$definition_source = 'stored_values';
		}

		return array(
			'schema_version'    => self::SCHEMA_VERSION,
			'form_key'          => $this->normalize_form_key( isset( $snapshot_candidate['form_key'] ) ? $snapshot_candidate['form_key'] : '' ),
			'definition_source' => $definition_source,
			'fields'            => $fields,
		);
	}

	/**
	 * Normalize immutable choice metadata stored with a booking form snapshot.
	 *
	 * @param mixed $options Candidate option records.
	 *
	 * @return array<int,array{value:string,label:string}> Safe ordered options.
	 */
	private function normalize_options( $options ) {
		$normalized_options = array();
		$seen_values        = array();
		foreach ( is_array( $options ) ? $options : array() as $option ) {
			if ( ! is_array( $option ) ) {
				continue;
			}
			$option_value = isset( $option['value'] ) && is_scalar( $option['value'] ) ? sanitize_text_field( (string) $option['value'] ) : '';
			$option_label = isset( $option['label'] ) && is_scalar( $option['label'] ) ? sanitize_text_field( (string) $option['label'] ) : $option_value;
			if ( ( '' === $option_value && '' === $option_label ) || isset( $seen_values[ $option_value ] ) ) {
				continue;
			}
			$normalized_options[]          = array(
				'value' => $option_value,
				'label' => '' !== $option_label ? $option_label : $option_value,
			);
			$seen_values[ $option_value ] = true;
			if ( self::MAX_FIELD_OPTIONS <= count( $normalized_options ) ) {
				break;
			}
		}

		return $normalized_options;
	}

	/**
	 * Project current canonical values through a previously normalized snapshot.
	 *
	 * @param array  $snapshot    Normalized snapshot.
	 * @param string $stored_form Canonical encoded booking field values.
	 * @param int    $resource_id Booking Resource ID.
	 *
	 * @return array<int,array<string,mixed>> Ordered read-only field DTOs.
	 */
	public function project_snapshot_fields( $snapshot, $stored_form, $resource_id ) {
		$snapshot = $this->normalize_snapshot( $snapshot );
		if ( empty( $snapshot ) ) {
			return array();
		}

		return $this->structured_field_resolver->project_fields( $snapshot['fields'], $stored_form, $resource_id );
	}

	/**
	 * Return the custom-form marker stored with a booking, when present.
	 *
	 * @param string $stored_form Canonical encoded booking field values.
	 * @param int    $resource_id Booking Resource ID.
	 *
	 * @return string Stored form key or an empty string.
	 */
	public function get_stored_form_key( $stored_form, $resource_id ) {
		$stored_values = $this->structured_field_resolver->parse_stored_values( $stored_form, $resource_id );
		if ( empty( $stored_values['wpbc_custom_booking_form']['value'] ) ) {
			return '';
		}

		return $this->normalize_form_key( $stored_values['wpbc_custom_booking_form']['value'] );
	}

	/**
	 * Resolve the exact form key at creation time.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param mixed  $form_name   Explicit form name.
	 * @param string $stored_form Canonical encoded booking field values.
	 *
	 * @return string Normalized form key.
	 */
	private function resolve_creation_form_key( $resource_id, $form_name, $stored_form ) {
		$form_name = $this->normalize_form_key( $form_name );
		if ( '' !== $form_name ) {
			return $form_name;
		}

		$form_name = $this->get_stored_form_key( $stored_form, $resource_id );
		if ( '' !== $form_name ) {
			return $form_name;
		}

		if (
			class_exists( 'WPBC_FE_Custom_Form_Helper' )
			&& method_exists( 'WPBC_FE_Custom_Form_Helper', 'get_default_custom_form__for__booking_resource' )
		) {
			$form_name = $this->normalize_form_key( WPBC_FE_Custom_Form_Helper::get_default_custom_form__for__booking_resource( $resource_id ) );
		}

		return '' !== $form_name ? $form_name : 'standard';
	}

	/**
	 * Load the exact BFB or Advanced Mode definition for one form key.
	 *
	 * @param int    $resource_id Booking Resource ID.
	 * @param string $form_name   Exact form key.
	 * @param array  $form_context Optional server-validated form-source context.
	 *
	 * @return array<string,string> Normalized form definition.
	 */
	private function load_form_definition( $resource_id, $form_name, $form_context = array() ) {
		$form_context = $this->normalize_form_context( $form_context );

		return $this->form_definition_repository->get_form_definition(
			$resource_id,
			$form_name,
			$form_context
		);
	}

	/**
	 * Normalize the bounded form-source context accepted by the shared resolver.
	 *
	 * Preview credentials originate from the canonical request-context validator.
	 * Read-time callers omit this argument and therefore resolve published forms.
	 *
	 * @param mixed $form_context Candidate form-source context.
	 *
	 * @return array<string,mixed> Bounded resolver context.
	 */
	private function normalize_form_context( $form_context ) {
		$form_context = is_array( $form_context ) ? $form_context : array();
		$form_status  = isset( $form_context['form_status'] ) ? sanitize_key( $form_context['form_status'] ) : 'published';
		$form_status  = 'preview' === $form_status ? 'preview' : 'published';

		$normalized_context = array(
			'form_status'              => $form_status,
			'user_id'                  => isset( $form_context['user_id'] ) ? absint( $form_context['user_id'] ) : 0,
			'wpbc_bfb_preview'         => isset( $form_context['wpbc_bfb_preview'] ) ? absint( $form_context['wpbc_bfb_preview'] ) : 0,
			'wpbc_bfb_preview_form_id' => isset( $form_context['wpbc_bfb_preview_form_id'] ) ? absint( $form_context['wpbc_bfb_preview_form_id'] ) : 0,
			'wpbc_bfb_preview_token'   => isset( $form_context['wpbc_bfb_preview_token'] ) ? sanitize_key( $form_context['wpbc_bfb_preview_token'] ) : '',
			'wpbc_bfb_preview_nonce'   => isset( $form_context['wpbc_bfb_preview_nonce'] ) ? sanitize_text_field( $form_context['wpbc_bfb_preview_nonce'] ) : '',
		);
		if ( isset( $form_context['owner_user_id'] ) ) {
			$normalized_context['owner_user_id'] = absint( $form_context['owner_user_id'] );
		}

		return $normalized_context;
	}

	/**
	 * Normalize a field key without collapsing supported dot/colon characters.
	 *
	 * @param mixed $field_key Candidate field key.
	 *
	 * @return string Normalized key.
	 */
	private function normalize_field_key( $field_key ) {
		$field_key = is_scalar( $field_key ) ? strtolower( trim( (string) $field_key ) ) : '';
		$field_key = preg_replace( '/[^a-z0-9:._-]/', '', $field_key );
		$field_key = is_string( $field_key ) ? $field_key : '';

		return substr( $field_key, 0, self::MAX_FIELD_KEY_LENGTH );
	}

	/**
	 * Normalize a form key for internal provenance metadata.
	 *
	 * @param mixed $form_key Candidate form key.
	 *
	 * @return string Normalized form key.
	 */
	private function normalize_form_key( $form_key ) {
		$form_key = is_scalar( $form_key ) ? sanitize_text_field( (string) $form_key ) : '';

		return substr( trim( $form_key ), 0, 191 );
	}

	/**
	 * Normalize a supported presentation field type.
	 *
	 * @param mixed $field_type Candidate type.
	 *
	 * @return string Stable field type.
	 */
	private function normalize_field_type( $field_type ) {
		$field_type = is_scalar( $field_type ) ? sanitize_key( rtrim( (string) $field_type, '*' ) ) : 'text';
		$type_map   = array(
			'captchac'           => 'captcha',
			'captchar'           => 'captcha',
			'country'            => 'select',
			'selectbox'          => 'select',
			'selectbox-multiple' => 'select',
			'selectbox-one'      => 'select',
			'select-multiple'    => 'select',
			'select-one'         => 'select',
			'starttime'          => 'time',
			'endtime'            => 'time',
		);
		$field_type = isset( $type_map[ $field_type ] ) ? $type_map[ $field_type ] : $field_type;

		return in_array( $field_type, array( 'acceptance', 'checkbox', 'email', 'file', 'radio', 'select', 'textarea', 'text', 'time' ), true )
			? $field_type
			: 'text';
	}

	/**
	 * Normalize immutable source-control provenance.
	 *
	 * This internal metadata distinguishes controls such as country and
	 * ordinary select fields after both normalize to the same presentation
	 * type. Older snapshots omit it and remain valid through the stored-value
	 * compatibility path.
	 *
	 * @param mixed $field_type Candidate source control type.
	 *
	 * @return string Safe bounded source type.
	 */
	private function normalize_source_type( $field_type ) {
		$field_type = is_scalar( $field_type ) ? sanitize_key( rtrim( (string) $field_type, '*' ) ) : '';

		return substr( $field_type, 0, 50 );
	}

	/**
	 * Normalize a configured label without retaining HTML or executable values.
	 *
	 * @param mixed $field_label Candidate field label.
	 *
	 * @return string Plain normalized label.
	 */
	private function normalize_label( $field_label ) {
		$field_label = is_scalar( $field_label ) ? html_entity_decode( (string) $field_label, ENT_QUOTES, 'UTF-8' ) : '';
		$field_label = sanitize_text_field( wp_strip_all_tags( $field_label, true ) );

		return substr( trim( $field_label ), 0, self::MAX_FIELD_LABEL_LENGTH );
	}

	/**
	 * Return a stable known or humanized label for a field key.
	 *
	 * @param string $field_key Normalized field key.
	 *
	 * @return string Plain display label.
	 */
	private function get_fallback_label( $field_key ) {
		$known_labels = array(
			'name'       => __( 'Name', 'booking' ),
			'secondname' => __( 'Last name', 'booking' ),
			'email'      => __( 'Email', 'booking' ),
			'phone'      => __( 'Phone', 'booking' ),
			'details'    => __( 'Details', 'booking' ),
			'visitors'   => __( 'Visitors', 'booking' ),
			'children'   => __( 'Children', 'booking' ),
			'rangetime'  => __( 'Time', 'booking' ),
			'starttime'  => __( 'Start time', 'booking' ),
			'endtime'    => __( 'End time', 'booking' ),
		);
		if ( isset( $known_labels[ $field_key ] ) ) {
			return $known_labels[ $field_key ];
		}

		$humanized_label = preg_replace( '/[_:.-]+/', ' ', $field_key );
		$humanized_label = is_string( $humanized_label ) ? ucwords( trim( $humanized_label ) ) : $field_key;

		return $this->normalize_label( $humanized_label );
	}

	/**
	 * Determine whether a stored record is implementation metadata, not a field.
	 *
	 * @param string $field_key Normalized field key.
	 *
	 * @return bool True for internal records.
	 */
	private function is_internal_field( $field_key ) {
		return $this->structured_field_resolver->is_system_field_key( $field_key );
	}

}

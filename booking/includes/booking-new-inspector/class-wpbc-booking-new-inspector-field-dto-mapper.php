<?php
/**
 * Exact Booking Form field DTO mapping for Add New Booking Inspector.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Converts one exact authorized form definition to executable-free field DTOs.
 */
final class WPBC_Booking_New_Inspector_Field_DTO_Mapper {

	/** @var WPBC_Booking_Structured_Field_Resolver Structured field resolver. */
	private $structured_field_resolver;

	/**
	 * Construct the mapper.
	 *
	 * @param WPBC_Booking_Structured_Field_Resolver|null $structured_field_resolver Optional shared resolver.
	 */
	public function __construct( $structured_field_resolver = null ) {
		$this->structured_field_resolver = $structured_field_resolver
			? $structured_field_resolver
			: new WPBC_Booking_Structured_Field_Resolver();
	}

	/**
	 * Map exact fields and fail closed when form behavior is not representable.
	 *
	 * @param array<string,mixed> $form_definition Exact authorized form definition.
	 * @param int                 $resource_id     Authorized Resource identifier.
	 * @param string              $form_source     Stable form source.
	 * @return array<string,mixed> Fields, support DTO, and bounded warnings.
	 */
	public function map_form( $form_definition, $resource_id, $form_source ) {
		$form_contract = $this->resolve_form_contract( $form_definition, $resource_id, $form_source );
		if ( 'supported' !== $form_contract['support']['status'] ) {
			return array(
				'fields'   => array(),
				'support'  => $form_contract['support'],
				'warnings' => $form_contract['warnings'],
			);
		}

		$choice_defaults = $this->get_choice_defaults( $form_definition );
		$field_dtos      = array();
		foreach ( $form_contract['fields'] as $field_contract ) {
			$field_dtos[] = array(
				'key'        => $field_contract['key'],
				'label'      => $field_contract['label'],
				'type'       => $field_contract['type'],
				'required'   => $field_contract['required'],
				'multiple'   => $field_contract['multiple'],
				'value'      => $this->get_initial_choice_value( $field_contract, $choice_defaults ),
				'options'    => $field_contract['options'],
				'validation' => array(
					'maxlength' => $field_contract['maxlength'],
					'min'       => null,
					'max'       => null,
					'step'      => null,
					'pattern_id' => 'email' === $field_contract['type'] ? 'email' : null,
				),
				'readonly'   => false,
				'help'       => '',
				'section'    => 'booking_details',
			);
		}

		return array(
			'fields'   => $field_dtos,
			'support'  => $form_contract['support'],
			'warnings' => $form_contract['warnings'],
		);
	}

	/**
	 * Resolve configured selections for new drafts without changing saved-value parsing.
	 *
	 * Builder metadata, including an explicitly empty selection, takes precedence
	 * over its generated shortcode. Advanced/classic forms use their own default
	 * attributes. Only exact allowed options are exposed by get_initial_choice_value().
	 *
	 * @param array<string,mixed> $form_definition Exact authorized form definition.
	 * @return array<string,array<int,string>> Initial choice values keyed by field name.
	 */
	private function get_choice_defaults( $form_definition ) {
		$structure_metadata = $this->get_structure_field_metadata( $form_definition );
		$choice_defaults    = array();
		foreach ( $structure_metadata as $field_key => $field_metadata ) {
			$choice_defaults[ $field_key ] = $field_metadata['choice_defaults'];
		}

		if ( ! function_exists( 'wpbc_parse_form' ) || empty( $form_definition['advanced_form'] ) || ! is_string( $form_definition['advanced_form'] ) ) {
			return $choice_defaults;
		}

		foreach ( (array) wpbc_parse_form( $form_definition['advanced_form'] ) as $shortcode ) {
			if ( ! is_array( $shortcode ) || empty( $shortcode['name'] ) ) {
				continue;
			}
			$field_key = $this->normalize_field_key( $shortcode['name'] );
			if ( isset( $structure_metadata[ $field_key ] ) ) {
				continue;
			}
			$source_type = isset( $shortcode['type'] ) ? rtrim( (string) $shortcode['type'], '*' ) : '';
			if ( ! in_array( $source_type, array( 'select', 'selectbox', 'checkbox', 'radio' ), true ) ) {
				continue;
			}
			$option_text = isset( $shortcode['options'] ) && is_string( $shortcode['options'] ) ? $shortcode['options'] : '';
			// Consume unrelated quoted attributes so their text cannot become a default token.
			preg_match_all( '/"[^"]*"|\'[^\']*\'|(?:^|\s)default\s*[:=]\s*("[^"]*"|\'[^\']*\'|[^\s]+)/', $option_text, $default_matches, PREG_SET_ORDER );
			$default_values = array();
			foreach ( $default_matches as $default_match ) {
				if ( ! isset( $default_match[1] ) ) {
					continue;
				}
				$default_token = $default_match[1];
				$default_values[] = sanitize_text_field( html_entity_decode( trim( $default_token, "\"'" ), ENT_QUOTES, 'UTF-8' ) );
			}
			// The canonical checkbox/radio renderer applies default:on to this group.
			if ( in_array( $source_type, array( 'checkbox', 'radio' ), true ) && in_array( 'on', $default_values, true ) ) {
				foreach ( isset( $shortcode['values_arr'] ) && is_array( $shortcode['values_arr'] ) ? $shortcode['values_arr'] : array() as $option ) {
					if ( is_array( $option ) && isset( $option['value'] ) && is_scalar( $option['value'] ) ) {
						$default_values[] = sanitize_text_field( (string) $option['value'] );
					}
				}
			}
			$choice_defaults[ $field_key ] = array_values( array_unique( array_merge(
				isset( $choice_defaults[ $field_key ] ) ? $choice_defaults[ $field_key ] : array(),
				$default_values
			) ) );
		}

		return $choice_defaults;
	}

	/**
	 * Read Builder choice defaults, preserving zero and explicit unchecked flags.
	 *
	 * @param array<string,mixed> $field_data Exact Builder field metadata.
	 * @return array<int,string> Configured option values; never inferred first choices.
	 */
	private function get_structure_choice_defaults( $field_data ) {
		$default_values = array();
		foreach ( isset( $field_data['options'] ) && is_array( $field_data['options'] ) ? $field_data['options'] : array() as $option ) {
			if ( ! is_array( $option ) || ! isset( $option['selected'] ) || ! in_array( $option['selected'], array( true, 1, '1', 'true' ), true ) ) {
				continue;
			}
			$option_value = isset( $option['value'] ) ? $option['value'] : ( isset( $option['label'] ) ? $option['label'] : '' );
			if ( is_scalar( $option_value ) ) {
				$default_values[] = sanitize_text_field( (string) $option_value );
			}
		}
		if ( empty( $default_values ) ) {
			$default_value = isset( $field_data['default_value'] ) ? $field_data['default_value'] : ( isset( $field_data['defaultValue'] ) ? $field_data['defaultValue'] : '' );
			if ( is_scalar( $default_value ) && '' !== (string) $default_value ) {
				$default_values[] = sanitize_text_field( (string) $default_value );
			}
		}

		return array_values( array_unique( $default_values ) );
	}

	/**
	 * Project initial selections through the bounded, authorized choice contract.
	 *
	 * Defaults apply only to bootstrap DTOs, never to submitted or saved values.
	 * Single-choice controls use the first configured matching option. Missing,
	 * malformed, removed, disabled, and out-of-contract choices remain unselected.
	 *
	 * @param array<string,mixed>              $field_contract  Exact customer field contract.
	 * @param array<string,array<int,string>> $choice_defaults Configured initial selections.
	 * @return string|array<int,string> Scalar or multiple-choice initial value.
	 */
	private function get_initial_choice_value( $field_contract, $choice_defaults ) {
		$initial_values = array();
		if ( in_array( $field_contract['type'], array( 'select', 'checkbox', 'radio' ), true ) ) {
			$default_values = isset( $choice_defaults[ $field_contract['key'] ] ) ? $choice_defaults[ $field_contract['key'] ] : array();
			foreach ( $field_contract['options'] as $option ) {
				if ( empty( $option['disabled'] ) && in_array( $option['value'], $default_values, true ) ) {
					$initial_values[] = $option['value'];
				}
			}
		}
		$initial_values = array_slice( array_values( array_unique( $initial_values ) ), 0, WPBC_Booking_New_Inspector_Config::MAX_VALUES_PER_FIELD );

		return $field_contract['multiple'] ? $initial_values : ( isset( $initial_values[0] ) ? $initial_values[0] : '' );
	}

	/**
	 * Resolve the exact server-side field contract used by DTO mapping and
	 * creation validation.
	 *
	 * This contract intentionally retains source and storage types for trusted
	 * PHP callers. Bootstrap responses continue to expose only the presentation
	 * DTO assembled by map_form().
	 *
	 * @param array<string,mixed> $form_definition Exact authorized form definition.
	 * @param int                 $resource_id     Authorized Resource identifier.
	 * @param string              $form_source     Stable form source.
	 * @return array<string,mixed> Internal fields, reserved keys, support, and warnings.
	 */
	public function resolve_form_contract( $form_definition, $resource_id, $form_source ) {
		$form_definition = is_array( $form_definition ) ? $form_definition : array();
		$form_source     = sanitize_key( (string) $form_source );
		if ( 'appointment' === $form_source ) {
			return $this->get_unsupported_contract( 'unsupported_form_source' );
		}
		if ( empty( $form_definition ) ) {
			return $this->get_unsupported_contract( 'form_definition_unavailable' );
		}

		$behavior_issue = $this->find_behavior_issue( $form_definition );
		if ( '' !== $behavior_issue ) {
			return $this->get_unsupported_contract( $behavior_issue );
		}

		$structure_metadata = $this->get_structure_field_metadata( $form_definition );

		$field_definitions = $this->structured_field_resolver->resolve_definition_fields(
			$form_definition,
			'',
			absint( $resource_id ),
			false
		);
		$projected_fields = $this->structured_field_resolver->project_fields( $field_definitions, '', absint( $resource_id ) );
		$field_contracts  = array();
		$schedule_fields  = array();
		$schedule_keys    = array();

		foreach ( $projected_fields as $projected_field ) {
			$field_key     = isset( $projected_field['key'] ) ? $this->normalize_field_key( $projected_field['key'] ) : '';
			$source_type   = isset( $projected_field['source_type'] ) ? sanitize_key( (string) $projected_field['source_type'] ) : '';
			$semantic_type = isset( $structure_metadata[ $field_key ]['type'] )
				? sanitize_key( (string) $structure_metadata[ $field_key ]['type'] )
				: '';
			$schedule_type = $this->get_schedule_type( $semantic_type, $source_type, $field_key );
			if ( '' !== $schedule_type ) {
				$schedule_keys[]   = $field_key;
				$schedule_fields[] = array(
					'key'           => $field_key,
					'schedule_type' => $schedule_type,
					'storage_type'  => $this->get_schedule_storage_type( $source_type, isset( $projected_field['type'] ) ? $projected_field['type'] : '' ),
					'required'      => ! empty( $projected_field['required'] ),
					'options'       => $this->map_options( isset( $projected_field['options'] ) ? $projected_field['options'] : array() ),
				);
				continue;
			}
			if ( $this->is_omitted_system_type( $source_type ) ) {
				continue;
			}

			if ( ! $this->is_supported_customer_type( $source_type ) ) {
				return $this->get_unsupported_contract(
					! empty( $projected_field['required'] ) ? 'unsupported_required_field' : 'unsupported_behavior_field'
				);
			}

			$options    = $this->map_options( isset( $projected_field['options'] ) ? $projected_field['options'] : array() );
			$field_type = $this->get_public_field_type( $source_type, isset( $projected_field['type'] ) ? $projected_field['type'] : 'text' );
			if ( in_array( $field_type, array( 'acceptance', 'checkbox', 'radio', 'select' ), true ) && empty( $options ) ) {
				return $this->get_unsupported_contract(
					! empty( $projected_field['required'] ) ? 'unsupported_required_field' : 'unsupported_behavior_field'
				);
			}

			$is_multiple = ! empty( $projected_field['multiple'] ) || 'checkbox' === $field_type;
			$field_contracts[] = array(
				'key'          => $field_key,
				'label'        => isset( $projected_field['label'] ) ? $this->plain_text( $projected_field['label'] ) : '',
				'type'         => $field_type,
				'source_type'  => $source_type,
				'storage_type' => $this->get_storage_field_type( $source_type, $field_type, $is_multiple ),
				'required'     => ! empty( $projected_field['required'] ),
				'multiple'     => $is_multiple,
				'options'      => $options,
				'maxlength'    => isset( $structure_metadata[ $field_key ]['maxlength'] ) ? $structure_metadata[ $field_key ]['maxlength'] : null,
			);
		}

		return array(
			'fields'          => array_slice( $field_contracts, 0, WPBC_Booking_New_Inspector_Config::MAX_FIELDS ),
			'schedule_fields' => array_slice( $schedule_fields, 0, WPBC_Booking_New_Inspector_Config::MAX_FIELDS ),
			'schedule_keys'   => array_values( array_unique( $schedule_keys ) ),
			'system_keys'     => $this->get_system_field_keys( $structure_metadata ),
			'support'         => array(
				'status'           => 'supported',
				'creation_allowed' => true,
				'reason_code'      => null,
				'message'          => '',
			),
			'warnings'        => array(),
		);
	}

	/**
	 * Detect unsupported Builder behavior that is intentionally omitted by the
	 * shared customer-field parser.
	 *
	 * @param array<string,mixed> $form_definition Exact form definition.
	 * @return string Stable reason code, or an empty string.
	 */
	private function find_behavior_issue( $form_definition ) {
		$structure_json = isset( $form_definition['structure_json'] ) && is_scalar( $form_definition['structure_json'] )
			? (string) $form_definition['structure_json']
			: '';
		$structure      = '' !== trim( $structure_json ) ? json_decode( $structure_json, true ) : array();
		if ( '' !== trim( $structure_json ) && ! is_array( $structure ) ) {
			return 'form_definition_unavailable';
		}

		$structure_fields = array();
		$this->collect_structure_fields( $structure, $structure_fields, 0 );
		if ( WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( $structure_fields ) ) {
			return 'unsupported_behavior_field';
		}
		foreach ( $structure_fields as $structure_field ) {
			$field_type = $structure_field['type'];
			if ( $this->is_supported_customer_type( $field_type ) || $this->is_schedule_type( $field_type ) || $this->is_omitted_system_type( $field_type ) ) {
				continue;
			}

			return ! empty( $structure_field['required'] ) ? 'unsupported_required_field' : 'unsupported_behavior_field';
		}

		$advanced_form = isset( $form_definition['advanced_form'] ) && is_scalar( $form_definition['advanced_form'] )
			? (string) $form_definition['advanced_form']
			: '';
		$advanced_field_matches = array();
		preg_match_all(
			'/\[\s*(?:accept_terms|acceptance|checkbox|country|coupon|email|file|quiz|radio|select(?:box)?(?:-multiple|-one)?|text|textarea|durationtime|endtime|rangetime|season_rangetime|starttime|time_slots|weekday_rangetime|weekday_starttime)\*?\b/i',
			$advanced_form,
			$advanced_field_matches
		);
		if ( WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( isset( $advanced_field_matches[0] ) ? $advanced_field_matches[0] : array() ) ) {
			return 'unsupported_behavior_field';
		}
		if ( preg_match( '/\[\s*(?:custom_shortcode|appointment_start_over)\b/i', $advanced_form ) ) {
			return 'unsupported_behavior_field';
		}
		if ( $this->has_unsupported_conditional_customer_fields( $advanced_form ) ) {
			return 'unsupported_behavior_field';
		}

		return '';
	}

	/**
	 * Collect bounded field semantics from nested Builder structure.
	 *
	 * @param mixed                           $nodes  Current structure branch.
	 * @param array<int,array<string,mixed>> $fields Collected fields passed by reference.
	 * @param int                             $depth  Current nesting depth.
	 * @return void
	 */
	private function collect_structure_fields( $nodes, &$fields, $depth ) {
		if ( ! is_array( $nodes ) || 20 < $depth || WPBC_Booking_New_Inspector_Config::MAX_FIELDS < count( $fields ) ) {
			return;
		}

		foreach ( $nodes as $node ) {
			if ( ! is_array( $node ) ) {
				continue;
			}
			$node_type = isset( $node['type'] ) ? sanitize_key( (string) $node['type'] ) : '';
			$node_data = isset( $node['data'] ) && is_array( $node['data'] ) ? $node['data'] : array();
			if ( 'field' === $node_type ) {
				$fields[] = array(
					'key'      => isset( $node_data['name'] ) ? $this->normalize_field_key( $node_data['name'] ) : '',
					'type'     => isset( $node_data['type'] ) ? sanitize_key( rtrim( (string) $node_data['type'], '*' ) ) : '',
					'required' => ! empty( $node_data['required'] ) || ( isset( $node_data['type'] ) && false !== strpos( (string) $node_data['type'], '*' ) ),
					'choice_defaults' => $this->get_structure_choice_defaults( $node_data ),
					'maxlength' => isset( $node_data['maxlength'] ) && is_numeric( $node_data['maxlength'] ) && 0 < (int) $node_data['maxlength']
						? min( (int) $node_data['maxlength'], WPBC_Booking_New_Inspector_Config::MAX_FIELD_VALUE_BYTES )
						: null,
				);
			}
			if ( isset( $node['content'] ) ) {
				$this->collect_structure_fields( $node['content'], $fields, $depth + 1 );
			}
			if ( isset( $node_data['columns'] ) ) {
				$this->collect_structure_fields( $node_data['columns'], $fields, $depth + 1 );
			}
			if ( isset( $node['items'] ) ) {
				$this->collect_structure_fields( $node['items'], $fields, $depth + 1 );
			}
		}
	}

	/**
	 * Determine whether one source type is a supported customer control.
	 *
	 * @param string $source_type Normalized source type.
	 * @return bool True for the initial positive allow list.
	 */
	private function is_supported_customer_type( $source_type ) {
		return in_array(
			sanitize_key( rtrim( (string) $source_type, '*' ) ),
			array( 'accept_terms', 'acceptance', 'checkbox', 'country', 'coupon', 'email', 'radio', 'select', 'select-multiple', 'select-one', 'selectbox', 'selectbox-multiple', 'selectbox-one', 'text', 'textarea' ),
			true
		);
	}

	/**
	 * Determine whether one source type belongs to the schedule DTO.
	 *
	 * @param string $source_type Normalized source type.
	 * @return bool True for schedule-owned controls.
	 */
	private function is_schedule_type( $source_type ) {
		return in_array(
			sanitize_key( rtrim( (string) $source_type, '*' ) ),
			array( 'durationtime', 'endtime', 'rangetime', 'season_rangetime', 'starttime', 'time_slots', 'weekday_rangetime', 'weekday_starttime' ),
			true
		);
	}

	/**
	 * Resolve schedule semantics without trusting the rendered control family.
	 *
	 * Form Builder emits semantic time controls as ordinary selectbox shortcodes.
	 * The Builder structure remains authoritative for those semantics; the exact
	 * canonical field name is the compatibility fallback for Advanced forms.
	 *
	 * @param string $semantic_type Builder structure type.
	 * @param string $source_type   Generated or Advanced control type.
	 * @param string $field_key     Normalized exact field key.
	 * @return string Stable schedule type or an empty string.
	 */
	private function get_schedule_type( $semantic_type, $source_type, $field_key ) {
		foreach ( array( $semantic_type, $source_type, $field_key ) as $type_candidate ) {
			$type_candidate = sanitize_key( rtrim( (string) $type_candidate, '*' ) );
			if ( $this->is_schedule_type( $type_candidate ) ) {
				return $type_candidate;
			}
		}

		return '';
	}

	/**
	 * Resolve the released storage family for one schedule-owned field.
	 *
	 * @param string $source_type    Generated or Advanced control type.
	 * @param string $projected_type Shared projected control family.
	 * @return string Allow-listed canonical storage type.
	 */
	private function get_schedule_storage_type( $source_type, $projected_type ) {
		$source_type    = sanitize_key( rtrim( (string) $source_type, '*' ) );
		$projected_type = sanitize_key( (string) $projected_type );
		if ( 0 === strpos( $source_type, 'select' ) || 'select' === $projected_type || 'time' === $projected_type ) {
			return 'selectbox-one';
		}

		return 'text';
	}

	/**
	 * Determine whether a non-customer field may be safely omitted.
	 *
	 * @param string $source_type Normalized source type.
	 * @return bool True for presentation or administrator-workflow controls.
	 */
	private function is_omitted_system_type( $source_type ) {
		return in_array(
			sanitize_key( rtrim( (string) $source_type, '*' ) ),
			array(
				'additional_cost_hint',
				'balance_hint',
				'bookingresource_info',
				'calendar',
				'cancel_date_hint',
				'capacity_hint',
				'captcha',
				'captchac',
				'captchar',
				'check_in_date_hint',
				'check_out_date_hint',
				'check_out_plus1day_hint',
				'cost_hint',
				'coupon_discount_hint',
				'days_number_hint',
				'deposit_hint',
				'divider',
				'end_time_hint',
				'nights_number_hint',
				'original_cost_hint',
				'pre_checkin_date_hint',
				'resource_title_hint',
				'section',
				'selected_dates_hint',
				'selected_short_dates_hint',
				'selected_short_timedates_hint',
				'selected_timedates_hint',
				'service_title_hint',
				'start_time_hint',
				'static_text',
				'steps_timeline',
				'submit',
				'wizard_nav',
			),
			true
		);
	}

	/**
	 * Normalize a source control to the stable browser control vocabulary.
	 *
	 * @param string $source_type Source type.
	 * @param string $projected_type Shared projected type.
	 * @return string Stable field type.
	 */
	private function get_public_field_type( $source_type, $projected_type ) {
		$source_type = sanitize_key( rtrim( (string) $source_type, '*' ) );
		if ( 'accept_terms' === $source_type ) {
			return 'acceptance';
		}
		if ( 'coupon' === $source_type ) {
			return 'text';
		}
		if ( 'country' === $source_type || 0 === strpos( $source_type, 'select' ) ) {
			return 'select';
		}

		return sanitize_key( (string) $projected_type );
	}

	/**
	 * Map ordered options without exposing storage or executable metadata.
	 *
	 * @param mixed $field_options Candidate field options.
	 * @return array<int,array<string,mixed>> Ordered safe options.
	 */
	private function map_options( $field_options ) {
		$options = array();
		foreach ( is_array( $field_options ) ? $field_options : array() as $field_option ) {
			if ( ! is_array( $field_option ) || ! array_key_exists( 'value', $field_option ) ) {
				continue;
			}
			$options[] = array(
				'value'    => substr( sanitize_text_field( (string) $field_option['value'] ), 0, WPBC_Booking_New_Inspector_Config::MAX_FIELD_VALUE_BYTES ),
				'label'    => $this->plain_text( isset( $field_option['label'] ) ? $field_option['label'] : $field_option['value'] ),
				'disabled' => false,
			);
			if ( WPBC_Booking_New_Inspector_Config::MAX_OPTIONS_PER_FIELD <= count( $options ) ) {
				break;
			}
		}

		return $options;
	}

	/**
	 * Return exact Builder metadata needed for server validation.
	 *
	 * @param array<string,mixed> $form_definition Exact form definition.
	 * @return array<string,array<string,mixed>> Metadata keyed by normalized field key.
	 */
	private function get_structure_field_metadata( $form_definition ) {
		$structure_json = isset( $form_definition['structure_json'] ) && is_scalar( $form_definition['structure_json'] )
			? (string) $form_definition['structure_json']
			: '';
		$structure = '' !== trim( $structure_json ) ? json_decode( $structure_json, true ) : array();
		$fields    = array();
		$this->collect_structure_fields( is_array( $structure ) ? $structure : array(), $fields, 0 );

		$metadata = array();
		foreach ( $fields as $field ) {
			if ( empty( $field['key'] ) ) {
				continue;
			}
			$metadata[ $field['key'] ] = array(
				'type'      => isset( $field['type'] ) ? sanitize_key( (string) $field['type'] ) : '',
				'maxlength' => isset( $field['maxlength'] ) ? $field['maxlength'] : null,
				'choice_defaults' => $field['choice_defaults'],
			);
		}

		return $metadata;
	}

	/**
	 * Return exact non-customer structure keys that must never be submitted as
	 * customer field values.
	 *
	 * @param array<string,array<string,mixed>> $structure_metadata Structure metadata.
	 * @return array<int,string> Ordered unique system field keys.
	 */
	private function get_system_field_keys( $structure_metadata ) {
		$system_keys = array();
		foreach ( $structure_metadata as $field_key => $field_metadata ) {
			$field_type = isset( $field_metadata['type'] ) ? (string) $field_metadata['type'] : '';
			if ( $this->is_omitted_system_type( $field_type ) ) {
				$system_keys[] = (string) $field_key;
			}
		}

		return array_values( array_unique( $system_keys ) );
	}

	/**
	 * Determine whether Advanced Mode contains conditional customer behavior.
	 *
	 * Conditional schedule shortcodes remain schedule-owned and are permitted.
	 * A conditional customer field changes visibility and required semantics, so
	 * this scalar-only Inspector must use the canonical Add Booking fallback.
	 *
	 * @param string $advanced_form Advanced Mode source.
	 * @return bool True when customer or unknown behavior occurs in a condition.
	 */
	private function has_unsupported_conditional_customer_fields( $advanced_form ) {
		if ( '' === trim( (string) $advanced_form ) || false === stripos( (string) $advanced_form, '[condition' ) ) {
			return false;
		}

		$condition_blocks = array();
		preg_match_all( '/\[\s*condition\b[^\]]*\](.*?)\[\s*\/condition\s*\]/is', (string) $advanced_form, $condition_blocks );
		if ( empty( $condition_blocks[0] ) ) {
			return true;
		}

		foreach ( $condition_blocks[1] as $condition_body ) {
			$field_matches = array();
			preg_match_all( '/\[\s*([a-z_][a-z0-9_-]*\*?)(?:\s+([a-z0-9:._-]+))?/i', (string) $condition_body, $field_matches, PREG_SET_ORDER );
			foreach ( $field_matches as $field_match ) {
				$field_type = isset( $field_match[1] ) ? sanitize_key( rtrim( (string) $field_match[1], '*' ) ) : '';
				$field_key  = isset( $field_match[2] ) ? $this->normalize_field_key( $field_match[2] ) : '';
				if ( $this->is_schedule_type( $field_type ) || $this->is_schedule_type( $field_key ) || $this->is_omitted_system_type( $field_type ) ) {
					continue;
				}

				return true;
			}
		}

		return false;
	}

	/**
	 * Normalize a Booking Form field key without erasing supported separators.
	 *
	 * @param mixed $field_key Candidate field key.
	 * @return string Safe bounded key.
	 */
	private function normalize_field_key( $field_key ) {
		$field_key = is_scalar( $field_key ) ? strtolower( trim( (string) $field_key ) ) : '';
		$field_key = preg_replace( '/[^a-z0-9:._-]/', '', $field_key );

		return substr( is_string( $field_key ) ? $field_key : '', 0, 100 );
	}

	/**
	 * Map one exact source control to the released serialized storage type.
	 *
	 * @param string $source_type Source control type.
	 * @param string $field_type  Public field type.
	 * @param bool   $is_multiple Whether several values may be stored.
	 * @return string Canonical storage type.
	 */
	private function get_storage_field_type( $source_type, $field_type, $is_multiple ) {
		$source_type = sanitize_key( rtrim( (string) $source_type, '*' ) );
		if ( 'country' === $source_type || 0 === strpos( $source_type, 'select' ) ) {
			return $is_multiple ? 'selectbox-multiple' : 'selectbox-one';
		}
		if ( in_array( $source_type, array( 'accept_terms', 'acceptance' ), true ) ) {
			return 'checkbox';
		}
		if ( in_array( $source_type, array( 'checkbox', 'radio', 'email', 'coupon', 'textarea', 'text' ), true ) ) {
			return $source_type;
		}

		return sanitize_key( (string) $field_type );
	}

	/**
	 * Build a fail-closed form projection.
	 *
	 * @param string $reason_code Stable reason code.
	 * @return array<string,mixed> Unsupported projection.
	 */
	private function get_unsupported_projection( $reason_code ) {
		return array(
			'fields'   => array(),
			'support'  => array(
				'status'           => 'unsupported',
				'creation_allowed' => false,
				'reason_code'      => sanitize_key( $reason_code ),
				'message'          => __( 'This Booking Form uses fields or behavior that require the full Add Booking page.', 'booking' ),
			),
			'warnings' => array(),
		);
	}

	/**
	 * Build an unsupported internal form contract.
	 *
	 * @param string $reason_code Stable fallback reason.
	 * @return array<string,mixed> Internal fail-closed contract.
	 */
	private function get_unsupported_contract( $reason_code ) {
		$projection = $this->get_unsupported_projection( $reason_code );

		return array(
			'fields'          => array(),
			'schedule_fields' => array(),
			'schedule_keys'   => array(),
			'system_keys'     => array(),
			'support'         => $projection['support'],
			'warnings'        => $projection['warnings'],
		);
	}

	/**
	 * Normalize one authorized label to plain text.
	 *
	 * @param mixed $text Candidate label.
	 * @return string Plain label.
	 */
	private function plain_text( $text ) {
		return trim( sanitize_text_field( wp_strip_all_tags( is_scalar( $text ) ? (string) $text : '' ) ) );
	}
}

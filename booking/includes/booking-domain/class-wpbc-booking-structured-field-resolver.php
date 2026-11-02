<?php
/**
 * Shared structured Booking customer-field resolver.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Convert BFB, Advanced Mode, content-form, and stored values to data-only fields.
 *
 * The resolver owns only bounded parsing and projection. Authorization, saved
 * snapshot selection, Inspector update rules, and persistence remain with their
 * calling domains. The class remains extensible only for inheritance-only
 * compatibility facades that preserve released class names.
 *
 * @since 12.0.0
 */
class WPBC_Booking_Structured_Field_Resolver {

	/** Maximum number of customer fields retained in one booking snapshot. */
	const MAX_FIELDS = 100;

	/** Maximum number of normalized choices exposed for one customer field. */
	const MAX_FIELD_OPTIONS = 300;

	/** Maximum supported nesting depth for untrusted form structure. */
	const MAX_STRUCTURE_DEPTH = 20;

	/** Maximum normalized field-key length. */
	const MAX_FIELD_KEY_LENGTH = 100;

	/** Maximum normalized label length. */
	const MAX_FIELD_LABEL_LENGTH = 200;

	/**
	 * Build ordered field definitions from one exact form and its saved values.
	 *
	 * BFB structure is authoritative for field identity, labels, order, and
	 * required state. The generated Advanced form is merged as the runtime
	 * control contract because it records the exact select/radio/checkbox shape
	 * and choices presented to the customer. `content_form` guides inclusion and
	 * display order without being allowed to invent values.
	 *
	 * @param array<string,mixed> $form_definition                Normalized form sources.
	 * @param string              $stored_form                    Canonical encoded booking values.
	 * @param int                 $resource_id                    Booking Resource ID suffix.
	 * @param bool                $include_orphaned_stored_fields Whether legacy reads should append stored customer fields absent from the current exact form.
	 *
	 * @return array<int,array<string,mixed>> Ordered normalized field definitions.
	 */
	public function resolve_definition_fields( $form_definition, $stored_form, $resource_id, $include_orphaned_stored_fields = false ) {
		$form_definition   = is_array( $form_definition ) ? $form_definition : array();
		$stored_values     = $this->parse_stored_values( $stored_form, $resource_id );
		$content_fields    = $this->parse_content_fields( isset( $form_definition['content_form'] ) ? $form_definition['content_form'] : '' );
		$structure_fields  = $this->parse_structure_fields( isset( $form_definition['structure_json'] ) ? $form_definition['structure_json'] : '' );
		$advanced_fields   = $this->parse_advanced_fields( isset( $form_definition['advanced_form'] ) ? $form_definition['advanced_form'] : '' );
		$definition_fields = ! empty( $structure_fields )
			? $this->merge_structure_and_runtime_fields( $structure_fields, $advanced_fields )
			: $advanced_fields;
		$definition_map = array();
		$content_map    = array();

		foreach ( $definition_fields as $field_definition ) {
			$field_definition['definition_origin'] = 'form_definition';
			$definition_map[ $field_definition['key'] ] = $field_definition;
		}
		foreach ( $content_fields as $content_field ) {
			$content_map[ $content_field['key'] ] = $content_field;
		}

		$fields      = array();
		$seen_fields = array();
		foreach ( $content_fields as $content_field ) {
			$field_key = $content_field['key'];
			if ( isset( $seen_fields[ $field_key ] ) || $this->is_system_field_key( $field_key ) ) {
				continue;
			}
			if ( isset( $definition_map[ $field_key ] ) ) {
				$field_definition = $definition_map[ $field_key ];
				if ( '' === $field_definition['label'] ) {
					$field_definition['label'] = $content_field['label'];
				}
				$fields[] = $field_definition;
			} elseif ( isset( $stored_values[ $field_key ] ) ) {
				$fields[] = $this->definition_from_stored_value( $field_key, $stored_values[ $field_key ], $content_field['label'] );
			} else {
				continue;
			}
			$seen_fields[ $field_key ] = true;
		}

		foreach ( $definition_fields as $field_definition ) {
			$field_definition['definition_origin'] = 'form_definition';
			$field_key = $field_definition['key'];
			if ( isset( $seen_fields[ $field_key ] ) || $this->is_system_field_key( $field_key ) ) {
				continue;
			}
			$fields[]                  = $field_definition;
			$seen_fields[ $field_key ] = true;
		}

		/*
		 * Creation snapshots accept only the exact form definition. A legacy read
		 * may also expose unmatched stored customer fields, but it keeps each old
		 * key independent and never guesses that it belongs to a renamed field.
		 */
		if ( empty( $definition_fields ) || $include_orphaned_stored_fields ) {
			foreach ( $stored_values as $field_key => $stored_field ) {
				if ( isset( $seen_fields[ $field_key ] ) || $this->is_system_field_key( $field_key ) ) {
					continue;
				}
				$field_label              = isset( $content_map[ $field_key ]['label'] ) ? $content_map[ $field_key ]['label'] : '';
				$fields[]                  = $this->definition_from_stored_value( $field_key, $stored_field, $field_label );
				$seen_fields[ $field_key ] = true;
			}
		}

		return array_slice( $fields, 0, self::MAX_FIELDS );
	}

	/**
	 * Build deterministic definitions for a booking with no form provenance.
	 *
	 * @param string $stored_form Canonical encoded booking values.
	 * @param int    $resource_id Booking Resource ID suffix.
	 *
	 * @return array<int,array<string,mixed>> Stored-value definitions.
	 */
	public function build_stored_value_definitions( $stored_form, $resource_id ) {
		$fields = array();
		foreach ( $this->parse_stored_values( $stored_form, $resource_id ) as $field_key => $stored_field ) {
			if ( $this->is_system_field_key( $field_key ) ) {
				continue;
			}
			$fields[] = $this->definition_from_stored_value( $field_key, $stored_field, '' );
			if ( self::MAX_FIELDS <= count( $fields ) ) {
				break;
			}
		}

		return $fields;
	}

	/**
	 * Project canonical saved values through immutable ordered definitions.
	 *
	 * @param array<int,array<string,mixed>> $field_definitions Normalized definitions.
	 * @param string                         $stored_form       Canonical encoded booking values.
	 * @param int                            $resource_id       Booking Resource ID suffix.
	 *
	 * @return array<int,array<string,mixed>> JSON-safe field DTOs.
	 */
	public function project_fields( $field_definitions, $stored_form, $resource_id ) {
		$stored_values = $this->parse_stored_values( $stored_form, $resource_id );
		$fields        = array();
		foreach ( is_array( $field_definitions ) ? $field_definitions : array() as $field_definition ) {
			if ( ! is_array( $field_definition ) ) {
				continue;
			}
			$field_key     = $this->normalize_field_key( isset( $field_definition['key'] ) ? $field_definition['key'] : '' );
			if ( '' === $field_key || $this->is_system_field_key( $field_key ) ) {
				continue;
			}
			$stored_field = isset( $stored_values[ $field_key ] ) ? $stored_values[ $field_key ] : array();
			$field_type   = $this->normalize_field_type( isset( $field_definition['type'] ) ? $field_definition['type'] : 'text' );
			$source_type  = $this->normalize_source_type( isset( $field_definition['source_type'] ) ? $field_definition['source_type'] : '' );
			$definition_origin = isset( $field_definition['definition_origin'] )
				? sanitize_key( (string) $field_definition['definition_origin'] )
				: '';

			/*
			 * Snapshots created before the exact-control contract did not retain a
			 * source type. In that narrow compatibility case, canonical storage can
			 * still prove that the original control was a choice control.
			 */
			if ( '' === $source_type && ! empty( $stored_field['source_type'] ) ) {
				$stored_field_type = $this->normalize_field_type( $stored_field['source_type'] );
				if ( $this->is_choice_field_type( $stored_field_type ) ) {
					$field_type = $stored_field_type;
				}
			}
			$is_unbounded_stored_choice = 'stored_value' === $definition_origin && $this->is_choice_field_type( $field_type );
			if ( $is_unbounded_stored_choice ) {
				$field_type = 'text';
			}
			$raw_values  = isset( $stored_values[ $field_key ]['values'] ) ? $stored_values[ $field_key ]['values'] : array();
			$safe_values = array();
			foreach ( $raw_values as $raw_value ) {
				$safe_values[] = $this->sanitize_field_value( $raw_value, $field_type );
			}
			$field_options = $this->normalize_field_options( isset( $field_definition['options'] ) ? $field_definition['options'] : array() );
			if ( ! $is_unbounded_stored_choice && ( 'country' === $source_type || ( '' === $source_type && 'country' === $field_key && 'select' === $field_type ) ) ) {
				$field_options = $this->get_country_field_options();
			}
			if ( $this->is_choice_field_type( $field_type ) ) {
				$field_options = $this->append_saved_value_options( $field_options, $safe_values );
			}

			$fields[] = array(
				'key'         => $field_key,
				'label'       => $this->normalize_label( isset( $field_definition['label'] ) ? $field_definition['label'] : $this->get_fallback_label( $field_key ) ),
				'type'        => $field_type,
				'source_type' => $source_type,
				'value'       => implode( ', ', $safe_values ),
				'values'      => $safe_values,
				'required'    => ! empty( $field_definition['required'] ),
				'multiple'    => ! empty( $field_definition['multiple'] ) || ! empty( $stored_field['multiple'] ) || 'checkbox' === $field_type,
				'options'     => $field_options,
			);
		}

		return $this->collapse_equivalent_value_companions( $fields );
	}

	/**
	 * Collapse proven-equivalent legacy display companions into their field.
	 *
	 * Booking form submission stores both the canonical value and a `*_val`
	 * display value. The companion is redundant while it still equals either
	 * the canonical value or that value's configured option label. A divergent
	 * pair remains visible so historical or manually changed data is never
	 * silently discarded. Internal companion metadata lets the mutation domain
	 * keep a collapsed stored value synchronized without trusting a hidden
	 * browser control.
	 *
	 * @param array<int,array<string,mixed>> $fields Ordered projected fields.
	 *
	 * @return array<int,array<string,mixed>> Projected fields with redundant companions removed.
	 */
	private function collapse_equivalent_value_companions( $fields ) {
		$field_indexes = array();
		foreach ( $fields as $field_index => $field ) {
			if ( is_array( $field ) && ! empty( $field['key'] ) ) {
				$field_indexes[ $field['key'] ] = $field_index;
			}
		}

		$collapsed_indexes = array();
		foreach ( $fields as $field_index => $companion_field ) {
			$companion_key = isset( $companion_field['key'] ) ? $this->normalize_field_key( $companion_field['key'] ) : '';
			if ( 4 >= strlen( $companion_key ) || '_val' !== substr( $companion_key, -4 ) ) {
				continue;
			}

			$canonical_key = substr( $companion_key, 0, -4 );
			if ( ! isset( $field_indexes[ $canonical_key ] ) ) {
				continue;
			}

			$canonical_index = $field_indexes[ $canonical_key ];
			if ( ! $this->are_companion_values_equivalent( $fields[ $canonical_index ], $companion_field ) ) {
				continue;
			}

			$fields[ $canonical_index ]['storage_companion'] = array(
				'key'    => $companion_key,
				'values' => isset( $companion_field['values'] ) && is_array( $companion_field['values'] )
					? array_values( array_map( 'strval', $companion_field['values'] ) )
					: array(),
			);
			$collapsed_indexes[ $field_index ] = true;
		}

		$visible_fields = array();
		foreach ( $fields as $field_index => $field ) {
			if ( ! isset( $collapsed_indexes[ $field_index ] ) ) {
				$visible_fields[] = $field;
			}
		}

		return $visible_fields;
	}

	/**
	 * Determine whether a stored display companion still represents one field.
	 *
	 * @param array<string,mixed> $canonical_field Canonical field projection.
	 * @param array<string,mixed> $companion_field Legacy `*_val` field projection.
	 *
	 * @return bool True when both stored records have equivalent values.
	 */
	private function are_companion_values_equivalent( $canonical_field, $companion_field ) {
		$canonical_values = isset( $canonical_field['values'] ) && is_array( $canonical_field['values'] )
			? array_values( $canonical_field['values'] )
			: array();
		$companion_values = isset( $companion_field['values'] ) && is_array( $companion_field['values'] )
			? array_values( $companion_field['values'] )
			: array();
		if ( count( $canonical_values ) !== count( $companion_values ) ) {
			return false;
		}

		$normalized_canonical = array_map( array( $this, 'normalize_companion_comparison_value' ), $canonical_values );
		$normalized_companion = array_map( array( $this, 'normalize_companion_comparison_value' ), $companion_values );
		if ( $normalized_canonical === $normalized_companion ) {
			return true;
		}

		$option_labels = array();
		foreach ( isset( $canonical_field['options'] ) && is_array( $canonical_field['options'] ) ? $canonical_field['options'] : array() as $field_option ) {
			if ( is_array( $field_option ) && isset( $field_option['value'], $field_option['label'] ) ) {
				$option_labels[ (string) $field_option['value'] ] = (string) $field_option['label'];
			}
		}
		$mapped_labels = array();
		foreach ( $canonical_values as $canonical_value ) {
			if ( ! array_key_exists( (string) $canonical_value, $option_labels ) ) {
				$mapped_labels = array();
				break;
			}
			$mapped_labels[] = $this->normalize_companion_comparison_value( $option_labels[ (string) $canonical_value ] );
		}
		if ( ! empty( $mapped_labels ) && $mapped_labels === $normalized_companion ) {
			return true;
		}

		foreach ( $normalized_canonical as $value_index => $canonical_value ) {
			$canonical_minutes = $this->parse_clock_value_to_minutes( $canonical_value );
			$companion_minutes = $this->parse_clock_value_to_minutes( $normalized_companion[ $value_index ] );
			if ( null === $canonical_minutes || $canonical_minutes !== $companion_minutes ) {
				return false;
			}
		}

		return ! empty( $normalized_canonical );
	}

	/**
	 * Normalize one stored value for conservative companion comparison.
	 *
	 * @param mixed $field_value Stored canonical or display value.
	 *
	 * @return string Safe comparable value.
	 */
	private function normalize_companion_comparison_value( $field_value ) {
		$field_value = is_scalar( $field_value ) ? html_entity_decode( (string) $field_value, ENT_QUOTES, 'UTF-8' ) : '';
		$field_value = sanitize_text_field( wp_strip_all_tags( $field_value, true ) );
		$field_value = preg_replace( '/\s+/', ' ', $field_value );

		return is_string( $field_value ) ? trim( $field_value ) : '';
	}

	/**
	 * Convert a plain 12-hour or 24-hour clock value to minutes after midnight.
	 *
	 * @param string $clock_value Normalized clock value.
	 *
	 * @return int|null Minute offset, or null when the value is not a clock.
	 */
	private function parse_clock_value_to_minutes( $clock_value ) {
		$clock_match = array();
		if ( 1 !== preg_match( '/^(\d{1,2}):(\d{2})(?:\s*([ap])\.?m\.?)?$/i', (string) $clock_value, $clock_match ) ) {
			return null;
		}

		$hours   = (int) $clock_match[1];
		$minutes = (int) $clock_match[2];
		$period  = isset( $clock_match[3] ) ? strtolower( $clock_match[3] ) : '';
		if ( 59 < $minutes || ( '' === $period && 23 < $hours ) || ( '' !== $period && ( 1 > $hours || 12 < $hours ) ) ) {
			return null;
		}
		if ( 'a' === $period ) {
			$hours = 12 === $hours ? 0 : $hours;
		} elseif ( 'p' === $period ) {
			$hours = 12 === $hours ? 12 : $hours + 12;
		}

		return ( $hours * 60 ) + $minutes;
	}

	/**
	 * Parse canonical booking storage without collapsing repeated values.
	 *
	 * @param mixed $stored_form Canonical encoded booking values.
	 * @param int   $resource_id Booking Resource ID suffix.
	 *
	 * @return array<string,array{type:string,source_type:string,multiple:bool,value:string,values:array<int,string>}> Parsed values.
	 */
	public function parse_stored_values( $stored_form, $resource_id ) {
		$stored_values = array();
		$resource_id   = absint( $resource_id );
		if ( ! is_scalar( $stored_form ) || '' === (string) $stored_form ) {
			return $stored_values;
		}

		foreach ( explode( '~', (string) $stored_form ) as $field_record ) {
			$field_parts = explode( '^', $field_record, 3 );
			if ( 3 !== count( $field_parts ) || in_array( sanitize_key( $field_parts[0] ), array( 'captchac', 'captchar', 'captcha' ), true ) ) {
				continue;
			}
			$field_key = rtrim( (string) $field_parts[1], '[]' );
			$suffix    = (string) $resource_id;
			if ( '' !== $suffix && $suffix === substr( $field_key, -strlen( $suffix ) ) ) {
				$field_key = substr( $field_key, 0, -strlen( $suffix ) );
			}
			$field_key = $this->normalize_field_key( $field_key );
			if ( '' === $field_key ) {
				continue;
			}
			$source_type = $this->normalize_source_type( $field_parts[0] );
			$field_value = wp_unslash( (string) $field_parts[2] );
			if ( ! isset( $stored_values[ $field_key ] ) ) {
				$stored_values[ $field_key ] = array(
					'type'        => $this->normalize_field_type( $source_type ),
					'source_type' => $source_type,
					'multiple'    => $this->is_multiple_source_type( $source_type ) || false !== strpos( (string) $field_parts[1], '[]' ),
					'value'       => '',
					'values'      => array(),
				);
			}
			if ( '' !== $field_value ) {
				$stored_values[ $field_key ]['values'][] = $field_value;
			}
			$stored_values[ $field_key ]['value'] = implode( ', ', $stored_values[ $field_key ]['values'] );
		}

		return $stored_values;
	}

	/**
	 * Flatten ordered nested BFB pages, sections, columns, and customer fields.
	 *
	 * @param mixed $structure_json Encoded BFB structure.
	 *
	 * @return array<int,array<string,mixed>> Ordered customer definitions.
	 */
	private function parse_structure_fields( $structure_json ) {
		if ( ! is_scalar( $structure_json ) || '' === trim( (string) $structure_json ) ) {
			return array();
		}
		$structure = json_decode( (string) $structure_json, true );
		if ( ! is_array( $structure ) ) {
			return array();
		}

		$fields      = array();
		$seen_fields = array();
		$this->walk_structure_nodes( $structure, $fields, $seen_fields, 0 );

		return $fields;
	}

	/**
	 * Recursively walk one bounded BFB structure branch.
	 *
	 * @param array<int|string,mixed>       $nodes       Current branch.
	 * @param array<int,array<string,mixed>> $fields      Collected definitions passed by reference.
	 * @param array<string,bool>             $seen_fields Seen normalized keys passed by reference.
	 * @param int                            $depth       Current nesting depth.
	 *
	 * @return void
	 */
	private function walk_structure_nodes( $nodes, &$fields, &$seen_fields, $depth ) {
		if ( self::MAX_STRUCTURE_DEPTH < $depth || self::MAX_FIELDS <= count( $fields ) || ! is_array( $nodes ) ) {
			return;
		}

		foreach ( $nodes as $node ) {
			if ( self::MAX_FIELDS <= count( $fields ) || ! is_array( $node ) ) {
				continue;
			}
			$node_type = isset( $node['type'] ) ? sanitize_key( (string) $node['type'] ) : '';
			$node_data = isset( $node['data'] ) && is_array( $node['data'] ) ? $node['data'] : array();

			if ( 'field' === $node_type ) {
				$field_definition = $this->normalize_structure_field( $node_data );
				if ( ! empty( $field_definition ) && ! isset( $seen_fields[ $field_definition['key'] ] ) ) {
					$fields[]                                = $field_definition;
					$seen_fields[ $field_definition['key'] ] = true;
				}
				continue;
			}

			if ( isset( $node['content'] ) && is_array( $node['content'] ) ) {
				$this->walk_structure_nodes( $node['content'], $fields, $seen_fields, $depth + 1 );
			}
			if ( isset( $node_data['columns'] ) && is_array( $node_data['columns'] ) ) {
				foreach ( $node_data['columns'] as $column ) {
					if ( is_array( $column ) && isset( $column['items'] ) && is_array( $column['items'] ) ) {
						$this->walk_structure_nodes( $column['items'], $fields, $seen_fields, $depth + 1 );
					}
				}
			}
		}
	}

	/**
	 * Normalize one BFB field node when it represents saved customer data.
	 *
	 * @param array<string,mixed> $field_data BFB field data.
	 *
	 * @return array<string,mixed> Normalized definition or an empty array.
	 */
	private function normalize_structure_field( $field_data ) {
		$field_type = isset( $field_data['type'] ) ? sanitize_key( (string) $field_data['type'] ) : '';
		$field_key  = $this->normalize_field_key( isset( $field_data['name'] ) ? $field_data['name'] : '' );
		if ( '' === $field_key || ! $this->is_customer_field_type( $field_type ) || $this->is_system_field_key( $field_key ) ) {
			return array();
		}

		$field_label = $this->normalize_label( isset( $field_data['label'] ) ? $field_data['label'] : '' );

		return array(
			'key'         => $field_key,
			'label'       => '' !== $field_label ? $field_label : $this->get_fallback_label( $field_key ),
			'type'        => $this->normalize_structure_control_type( $field_type ),
			'source_type' => $this->normalize_source_type( $field_type ),
			'required'    => ! empty( $field_data['required'] ),
			'multiple'    => ! empty( $field_data['multiple'] ) || 'checkbox' === $this->normalize_structure_control_type( $field_type ),
			'options'     => $this->get_structure_field_options( $field_data, $field_type ),
		);
	}

	/**
	 * Merge Builder identity metadata with the generated runtime control shape.
	 *
	 * Builder structure remains authoritative for order, key, label, and
	 * required state. The generated Advanced form describes the control that
	 * customers actually used, so its safe type, multiplicity, and choices
	 * correct semantic Builder types such as starttime and rangetime.
	 *
	 * @param array<int,array<string,mixed>> $structure_fields Ordered Builder definitions.
	 * @param array<int,array<string,mixed>> $runtime_fields   Generated Advanced form definitions.
	 *
	 * @return array<int,array<string,mixed>> Exact normalized field definitions.
	 */
	private function merge_structure_and_runtime_fields( $structure_fields, $runtime_fields ) {
		$runtime_map = array();
		foreach ( $runtime_fields as $runtime_field ) {
			if ( is_array( $runtime_field ) && ! empty( $runtime_field['key'] ) ) {
				$runtime_map[ $runtime_field['key'] ] = $runtime_field;
			}
		}

		foreach ( $structure_fields as $field_index => $structure_field ) {
			$field_key = isset( $structure_field['key'] ) ? $structure_field['key'] : '';
			if ( '' === $field_key || empty( $runtime_map[ $field_key ] ) ) {
				continue;
			}
			$runtime_field = $runtime_map[ $field_key ];
			$structure_fields[ $field_index ]['type'] = $runtime_field['type'];
			$structure_fields[ $field_index ]['source_type'] = $runtime_field['source_type'];
			$structure_fields[ $field_index ]['multiple'] = ! empty( $runtime_field['multiple'] );
			if ( ! empty( $runtime_field['options'] ) ) {
				$structure_fields[ $field_index ]['options'] = $runtime_field['options'];
			}
		}

		return $structure_fields;
	}

	/**
	 * Resolve the safe choices declared by one Builder field node.
	 *
	 * Standard choice fields use `options`. Extension packs may expose the same
	 * executable-free records through `choices`, `values`, or nested time-slot
	 * ranges, so the bounded recursive collector keeps those controls reusable.
	 * Country choices are loaded at projection time from the canonical dataset
	 * and are not duplicated into every immutable booking snapshot.
	 *
	 * @param array<string,mixed> $field_data Builder field data.
	 * @param string              $field_type Builder semantic field type.
	 *
	 * @return array<int,array{value:string,label:string}> Ordered normalized choices.
	 */
	private function get_structure_field_options( $field_data, $field_type ) {
		if ( 'country' === $this->normalize_source_type( $field_type ) ) {
			return array();
		}

		$option_candidates = array();
		foreach ( array( 'options', 'choices', 'values', 'slots' ) as $choice_key ) {
			if ( isset( $field_data[ $choice_key ] ) && is_array( $field_data[ $choice_key ] ) ) {
				$this->collect_structure_option_candidates( $field_data[ $choice_key ], $option_candidates, 0 );
			}
		}

		return $this->normalize_field_options( $option_candidates );
	}

	/**
	 * Collect bounded option records from extension-owned Builder structures.
	 *
	 * @param array<int|string,mixed>       $candidate_branch Current nested branch.
	 * @param array<int,array|string>       $option_candidates Collected candidates by reference.
	 * @param int                           $depth             Current nesting depth.
	 *
	 * @return void
	 */
	private function collect_structure_option_candidates( $candidate_branch, &$option_candidates, $depth ) {
		if ( 10 < $depth || self::MAX_FIELD_OPTIONS <= count( $option_candidates ) || ! is_array( $candidate_branch ) ) {
			return;
		}

		if ( array_key_exists( 'value', $candidate_branch ) ) {
			$option_candidates[] = array(
				'value' => $candidate_branch['value'],
				'label' => isset( $candidate_branch['label'] )
					? $candidate_branch['label']
					: ( isset( $candidate_branch['title'] ) ? $candidate_branch['title'] : $candidate_branch['value'] ),
			);
			return;
		}

		if ( isset( $candidate_branch['from'], $candidate_branch['to'] ) && is_scalar( $candidate_branch['from'] ) && is_scalar( $candidate_branch['to'] ) ) {
			$range_value = trim( (string) $candidate_branch['from'] ) . ' - ' . trim( (string) $candidate_branch['to'] );
			$option_candidates[] = array(
				'value' => $range_value,
				'label' => $range_value,
			);
			return;
		}

		foreach ( $candidate_branch as $candidate_value ) {
			if ( self::MAX_FIELD_OPTIONS <= count( $option_candidates ) ) {
				break;
			}
			if ( is_array( $candidate_value ) ) {
				$this->collect_structure_option_candidates( $candidate_value, $option_candidates, $depth + 1 );
			} elseif ( is_scalar( $candidate_value ) ) {
				$option_candidates[] = (string) $candidate_value;
			}
		}
	}

	/**
	 * Parse Advanced Mode shortcodes as the compatibility definition source.
	 *
	 * @param mixed $advanced_form Advanced Mode form source.
	 *
	 * @return array<int,array<string,mixed>> Ordered definitions.
	 */
	private function parse_advanced_fields( $advanced_form ) {
		$fields = array();
		if ( ! is_scalar( $advanced_form ) || '' === trim( (string) $advanced_form ) || ! function_exists( 'wpbc_parse_form' ) ) {
			return $fields;
		}
		$advanced_form    = (string) $advanced_form;
		$parsed_shortcodes = (array) wpbc_parse_form( $advanced_form );
		$special_matches   = array();
		preg_match_all(
			'%\[\s*(country[*]?|starttime[*]?|endtime[*]?)(?=\s|\])(?:[^\]"\']+|"[^"]*"|\'[^\']*\')*\]%i',
			$advanced_form,
			$special_matches,
			PREG_SET_ORDER | PREG_OFFSET_CAPTURE
		);
		foreach ( $special_matches as $special_match ) {
			$raw_type = isset( $special_match[1][0] ) ? (string) $special_match[1][0] : '';
			$parsed_shortcodes[] = array(
				'full_shortcode' => isset( $special_match[0][0] ) ? (string) $special_match[0][0] : '',
				'type'           => $raw_type,
				'name'           => rtrim( $raw_type, '*' ),
			);
		}
		$parsed_shortcodes = $this->order_advanced_shortcodes( $advanced_form, $parsed_shortcodes );

		$search_offset = 0;
		$field_indexes = array();
		foreach ( $parsed_shortcodes as $shortcode ) {
			if ( ! is_array( $shortcode ) ) {
				continue;
			}
			$field_key = $this->normalize_field_key( isset( $shortcode['name'] ) ? $shortcode['name'] : '' );
			$raw_type  = isset( $shortcode['type'] ) ? (string) $shortcode['type'] : 'text';
			if ( '' === $field_key || $this->is_system_field_key( $field_key ) ) {
				continue;
			}
			$field_label = $this->find_advanced_label( $advanced_form, isset( $shortcode['full_shortcode'] ) ? $shortcode['full_shortcode'] : '', $search_offset );
			$shortcode_options = $this->get_advanced_shortcode_options( $shortcode );
			$source_type = $this->normalize_source_type( $raw_type );
			$field_options = 'country' === $source_type
				? $this->get_country_field_options()
				: $this->normalize_field_options( $this->get_advanced_shortcode_values( $shortcode ) );
			$field_definition = array(
				'key'         => $field_key,
				'label'       => '' !== $field_label ? $field_label : $this->get_fallback_label( $field_key ),
				'type'        => $this->normalize_advanced_control_type( $source_type ),
				'source_type' => $source_type,
				'required'    => false !== strpos( $raw_type, '*' ),
				'multiple'    => false !== strpos( $raw_type, 'checkbox' ) || in_array( 'multiple', $shortcode_options, true ),
				'options'     => $field_options,
			);

			if ( isset( $field_indexes[ $field_key ] ) ) {
				$existing_index = $field_indexes[ $field_key ];
				$fields[ $existing_index ]['options'] = $this->normalize_field_options(
					array_merge( $fields[ $existing_index ]['options'], $field_definition['options'] )
				);
				$fields[ $existing_index ]['required'] = ! empty( $fields[ $existing_index ]['required'] ) || ! empty( $field_definition['required'] );
				$fields[ $existing_index ]['multiple'] = ! empty( $fields[ $existing_index ]['multiple'] ) || ! empty( $field_definition['multiple'] );
				continue;
			}

			$field_indexes[ $field_key ] = count( $fields );
			$fields[]                    = $field_definition;
		}

		return $fields;
	}

	/**
	 * Normalize Advanced Mode shortcode option tokens.
	 *
	 * The established parser returns options as a whitespace-delimited string,
	 * while compatibility callers may provide an array. Normalizing both shapes
	 * keeps multiple-select semantics stable without exposing parser internals.
	 *
	 * @param array<string,mixed> $shortcode Parsed shortcode record.
	 *
	 * @return array<int,string> Ordered option tokens.
	 */
	private function get_advanced_shortcode_options( $shortcode ) {
		$shortcode_options = isset( $shortcode['options'] ) ? $shortcode['options'] : array();
		if ( is_scalar( $shortcode_options ) ) {
			$shortcode_options = preg_split( '/\s+/', trim( (string) $shortcode_options ) );
		}

		return array_values( array_filter( array_map( 'sanitize_text_field', is_array( $shortcode_options ) ? $shortcode_options : array() ) ) );
	}

	/**
	 * Resolve Advanced Mode choice records from standard and special shortcodes.
	 *
	 * Country and start/end-time controls are intentionally outside the legacy
	 * parser's standard type expression. Their complete shortcode is therefore
	 * parsed locally through the same established option/value helpers.
	 *
	 * @param array<string,mixed> $shortcode Parsed shortcode record.
	 *
	 * @return array<int,mixed> Ordered choice records.
	 */
	private function get_advanced_shortcode_values( $shortcode ) {
		if ( isset( $shortcode['values_arr'] ) && is_array( $shortcode['values_arr'] ) ) {
			return $shortcode['values_arr'];
		}
		if ( isset( $shortcode['values'] ) && is_array( $shortcode['values'] ) ) {
			return $shortcode['values'];
		}
		if ( empty( $shortcode['full_shortcode'] ) || ! function_exists( 'wpbc_parse_form_shortcode_options_values' ) || ! function_exists( 'wpbc_parse_form_shortcode_values' ) ) {
			return array();
		}

		$shortcode_tail = '';
		if ( preg_match( '/^\[\s*[^\s\]]+(?:\s+[a-zA-Z][0-9a-zA-Z:._-]*)?(.*)\]$/s', (string) $shortcode['full_shortcode'], $shortcode_parts ) ) {
			$shortcode_tail = isset( $shortcode_parts[1] ) ? (string) $shortcode_parts[1] : '';
		}
		list( , $shortcode_values ) = wpbc_parse_form_shortcode_options_values( $shortcode_tail );

		return '' === $shortcode_values ? array() : wpbc_parse_form_shortcode_values( $shortcode_values );
	}

	/**
	 * Restore source order after merging standard and special Advanced Mode fields.
	 *
	 * The established parser exposes country, start-time, and end-time fields
	 * through a separate compatibility branch. Ordering the combined records by
	 * their source positions keeps Inspector projection aligned with the form.
	 *
	 * @param string                         $advanced_form     Complete Advanced Mode source.
	 * @param array<int,array<string,mixed>> $parsed_shortcodes Parsed shortcode records.
	 *
	 * @return array<int,array<string,mixed>> Records in stable source order.
	 */
	private function order_advanced_shortcodes( $advanced_form, $parsed_shortcodes ) {
		$ordered_shortcodes = array();
		$search_offsets      = array();
		foreach ( $parsed_shortcodes as $shortcode_index => $shortcode ) {
			if ( ! is_array( $shortcode ) || empty( $shortcode['full_shortcode'] ) ) {
				continue;
			}
			$full_shortcode = (string) $shortcode['full_shortcode'];
			$search_offset  = isset( $search_offsets[ $full_shortcode ] ) ? $search_offsets[ $full_shortcode ] : 0;
			$source_offset  = strpos( $advanced_form, $full_shortcode, $search_offset );
			if ( false === $source_offset ) {
				continue;
			}
			$search_offsets[ $full_shortcode ] = $source_offset + strlen( $full_shortcode );
			$shortcode['source_offset']         = $source_offset;
			$shortcode['source_index']          = absint( $shortcode_index );
			$ordered_shortcodes[]               = $shortcode;
		}

		usort(
			$ordered_shortcodes,
			function ( $left_shortcode, $right_shortcode ) {
				if ( $left_shortcode['source_offset'] === $right_shortcode['source_offset'] ) {
					return $left_shortcode['source_index'] - $right_shortcode['source_index'];
				}

				return $left_shortcode['source_offset'] - $right_shortcode['source_offset'];
			}
		);

		return $ordered_shortcodes;
	}

	/**
	 * Find the nearest Advanced Mode label before a parsed shortcode.
	 *
	 * @param string $advanced_form  Complete Advanced Mode source.
	 * @param string $full_shortcode Parsed shortcode text.
	 * @param int    $search_offset  Running search offset passed by reference.
	 *
	 * @return string Normalized label or an empty string.
	 */
	private function find_advanced_label( $advanced_form, $full_shortcode, &$search_offset ) {
		if ( '' === $full_shortcode ) {
			return '';
		}
		$shortcode_offset = strpos( $advanced_form, $full_shortcode, $search_offset );
		if ( false === $shortcode_offset ) {
			return '';
		}
		$search_offset = $shortcode_offset + strlen( $full_shortcode );
		$prefix        = substr( $advanced_form, max( 0, $shortcode_offset - 1000 ), min( 1000, $shortcode_offset ) );
		$label_matches = array();
		if ( ! preg_match_all( '/<l\b[^>]*>(.*?)<\/l>/is', $prefix, $label_matches ) || empty( $label_matches[1] ) ) {
			return '';
		}

		return $this->normalize_label( end( $label_matches[1] ) );
	}

	/**
	 * Parse every ordered field token and its nearby label from content_form.
	 *
	 * @param mixed $content_form Content-of-booking-fields source.
	 *
	 * @return array<int,array{key:string,label:string}> Ordered content guidance.
	 */
	private function parse_content_fields( $content_form ) {
		$content_fields = array();
		$seen_fields    = array();
		$content_form   = is_scalar( $content_form ) ? (string) $content_form : '';
		if ( '' === trim( $content_form ) ) {
			return $content_fields;
		}

		$blocks = array();
		preg_match_all( '/<f\b[^>]*>(.*?)<\/f>/is', $content_form, $blocks, PREG_OFFSET_CAPTURE );
		foreach ( isset( $blocks[1] ) ? $blocks[1] : array() as $block_index => $block_match ) {
			$block_tokens = array();
			preg_match_all( '/\[([a-zA-Z][0-9a-zA-Z:._-]*)\]/', $block_match[0], $block_tokens );
			$block_offset = isset( $blocks[0][ $block_index ][1] ) ? absint( $blocks[0][ $block_index ][1] ) : 0;
			$prefix       = substr( $content_form, max( 0, $block_offset - 1000 ), min( 1000, $block_offset ) );
			$field_label   = '';
			$label_matches = array();
			if ( preg_match_all( '/<(?:b|strong)\b[^>]*>(.*?)<\/(?:b|strong)>/is', $prefix, $label_matches ) && ! empty( $label_matches[1] ) ) {
				$field_label = $this->normalize_label( end( $label_matches[1] ) );
			}
			foreach ( isset( $block_tokens[1] ) ? $block_tokens[1] : array() as $field_token ) {
				$field_key = $this->normalize_field_key( $field_token );
				if ( '' === $field_key || isset( $seen_fields[ $field_key ] ) || $this->is_system_field_key( $field_key ) ) {
					continue;
				}
				$content_fields[] = array(
					'key'   => $field_key,
					'label' => '' !== $field_label ? $field_label : $this->get_fallback_label( $field_key ),
				);
				$seen_fields[ $field_key ] = true;
			}
		}

		return $content_fields;
	}

	/**
	 * Build a normalized definition from a stored value record.
	 *
	 * @param string              $field_key    Normalized field key.
	 * @param array<string,mixed> $stored_field Parsed stored record.
	 * @param string              $field_label Preferred label.
	 *
	 * @return array<string,mixed> Normalized field definition.
	 */
	private function definition_from_stored_value( $field_key, $stored_field, $field_label ) {
		$field_label      = $this->normalize_label( $field_label );
		$stored_type      = $this->normalize_field_type( isset( $stored_field['source_type'] ) ? $stored_field['source_type'] : ( isset( $stored_field['type'] ) ? $stored_field['type'] : 'text' ) );
		$source_type      = $this->normalize_source_type( isset( $stored_field['source_type'] ) ? $stored_field['source_type'] : '' );
		$is_choice_field = $this->is_choice_field_type( $stored_type );
		$field_type      = $is_choice_field ? 'text' : $stored_type;

		return array(
			'key'               => $field_key,
			'label'             => '' !== $field_label ? $field_label : $this->get_fallback_label( $field_key ),
			'type'              => $field_type,
			'source_type'       => $source_type,
			'definition_origin' => 'stored_value',
			'required'          => false,
			'multiple'          => ! empty( $stored_field['multiple'] ) || 'checkbox' === $stored_type,
			'options'           => array(),
		);
	}

	/**
	 * Normalize configured choices into an executable-free DTO contract.
	 *
	 * @param mixed $field_options Candidate BFB or Advanced Mode choices.
	 *
	 * @return array<int,array{value:string,label:string}> Ordered safe choices.
	 */
	private function normalize_field_options( $field_options ) {
		$normalized_options = array();
		$seen_values        = array();

		foreach ( is_array( $field_options ) ? $field_options : array() as $field_option ) {
			if ( is_array( $field_option ) ) {
				$option_value = isset( $field_option['value'] ) ? $field_option['value'] : ( isset( $field_option['label'] ) ? $field_option['label'] : '' );
				$option_label = isset( $field_option['label'] ) ? $field_option['label'] : ( isset( $field_option['title'] ) ? $field_option['title'] : $option_value );
			} else {
				$option_parts = is_scalar( $field_option ) ? explode( '@@', (string) $field_option, 2 ) : array();
				$option_label = isset( $option_parts[0] ) ? $option_parts[0] : '';
				$option_value = isset( $option_parts[1] ) ? $option_parts[1] : $option_label;
			}
			$option_value = is_scalar( $option_value ) ? sanitize_text_field( (string) $option_value ) : '';
			$option_label = is_scalar( $option_label ) ? sanitize_text_field( (string) $option_label ) : '';
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
	 * Return the canonical country select choices used by booking forms.
	 *
	 * @return array<int,array{value:string,label:string}> Ordered country choices.
	 */
	private function get_country_field_options() {
		if ( function_exists( 'wpbc_bfb_country_get_choices' ) ) {
			return $this->normalize_field_options( wpbc_bfb_country_get_choices() );
		}

		$country_options = array();
		$countries       = function_exists( 'wpbc_dataset_countries' ) ? wpbc_dataset_countries() : array();
		foreach ( (array) $countries as $country_code => $country_label ) {
			if ( is_scalar( $country_code ) && is_scalar( $country_label ) ) {
				$country_options[] = array(
					'value' => (string) $country_code,
					'label' => (string) $country_label,
				);
			}
		}

		return $this->normalize_field_options( $country_options );
	}

	/**
	 * Preserve selected values that no longer exist in a changed choice list.
	 *
	 * This avoids displaying the first configured option as though it were the
	 * saved answer and lets an unchanged historical value round-trip safely.
	 *
	 * @param array<int,array{value:string,label:string}> $field_options Normalized configured choices.
	 * @param array<int,string>                           $saved_values  Canonical saved values.
	 *
	 * @return array<int,array{value:string,label:string}> Choices containing every saved value.
	 */
	private function append_saved_value_options( $field_options, $saved_values ) {
		$seen_values = array();
		foreach ( $field_options as $field_option ) {
			if ( is_array( $field_option ) && array_key_exists( 'value', $field_option ) ) {
				$seen_values[ (string) $field_option['value'] ] = true;
			}
		}

		foreach ( $saved_values as $saved_value ) {
			$saved_value = sanitize_text_field( (string) $saved_value );
			if ( '' === $saved_value || isset( $seen_values[ $saved_value ] ) || self::MAX_FIELD_OPTIONS <= count( $field_options ) ) {
				continue;
			}
			$field_options[] = array(
				'value' => $saved_value,
				'label' => $saved_value,
			);
			$seen_values[ $saved_value ] = true;
		}

		return $field_options;
	}

	/**
	 * Determine whether a normalized field uses a bounded choice list.
	 *
	 * @param string $field_type Normalized presentation type.
	 *
	 * @return bool True for select, radio, checkbox, or acceptance controls.
	 */
	private function is_choice_field_type( $field_type ) {
		return in_array( $field_type, array( 'acceptance', 'checkbox', 'radio', 'select' ), true );
	}

	/**
	 * Determine whether a BFB type represents a value saved for the customer.
	 *
	 * @param string $field_type Normalized BFB type.
	 *
	 * @return bool True for saved customer-data controls.
	 */
	private function is_customer_field_type( $field_type ) {
		return in_array(
			sanitize_key( (string) $field_type ),
			array( 'accept_terms', 'acceptance', 'checkbox', 'country', 'coupon', 'durationtime', 'email', 'endtime', 'file', 'quiz', 'radio', 'rangetime', 'season_rangetime', 'select', 'select-multiple', 'select-one', 'selectbox', 'selectbox-multiple', 'selectbox-one', 'starttime', 'text', 'textarea', 'time', 'time_slots', 'weekday_rangetime', 'weekday_starttime' ),
			true
		);
	}

	/**
	 * Normalize a field key without collapsing supported dot/colon characters.
	 *
	 * @param mixed $field_key Candidate field key.
	 *
	 * @return string Normalized field key.
	 */
	private function normalize_field_key( $field_key ) {
		$field_key = is_scalar( $field_key ) ? strtolower( trim( (string) $field_key ) ) : '';
		$field_key = preg_replace( '/[^a-z0-9:._-]/', '', $field_key );
		$field_key = is_string( $field_key ) ? $field_key : '';

		return substr( $field_key, 0, self::MAX_FIELD_KEY_LENGTH );
	}

	/**
	 * Normalize saved and configured control types for presentation.
	 *
	 * @param mixed $field_type Candidate field type.
	 *
	 * @return string Stable field type.
	 */
	private function normalize_field_type( $field_type ) {
		$field_type = is_scalar( $field_type ) ? sanitize_key( rtrim( (string) $field_type, '*' ) ) : 'text';
		$type_map   = array(
			'accept_terms'       => 'acceptance',
			'country'            => 'select',
			'durationtime'       => 'time',
			'endtime'            => 'time',
			'rangetime'          => 'time',
			'season_rangetime'   => 'time',
			'selectbox'          => 'select',
			'selectbox-multiple' => 'select',
			'selectbox-one'      => 'select',
			'select-multiple'    => 'select',
			'select-one'         => 'select',
			'starttime'          => 'time',
			'time_slots'         => 'time',
			'weekday_rangetime'  => 'time',
			'weekday_starttime'  => 'time',
		);
		$field_type = isset( $type_map[ $field_type ] ) ? $type_map[ $field_type ] : $field_type;

		return in_array( $field_type, array( 'acceptance', 'checkbox', 'email', 'file', 'radio', 'select', 'textarea', 'text', 'time' ), true )
			? $field_type
			: 'text';
	}

	/**
	 * Normalize a source control type without erasing its original semantics.
	 *
	 * Source types are internal provenance used to distinguish controls that
	 * share one presentation type, such as country and ordinary select fields.
	 * They are never returned as executable browser behavior.
	 *
	 * @param mixed $field_type Candidate source field type.
	 *
	 * @return string Safe bounded source type.
	 */
	private function normalize_source_type( $field_type ) {
		$field_type = is_scalar( $field_type ) ? sanitize_key( rtrim( (string) $field_type, '*' ) ) : '';

		return substr( $field_type, 0, 50 );
	}

	/**
	 * Determine whether canonical storage identifies a multiple-value control.
	 *
	 * @param string $source_type Normalized source control type.
	 *
	 * @return bool True when the control permits several selected values.
	 */
	private function is_multiple_source_type( $source_type ) {
		return in_array( $this->normalize_source_type( $source_type ), array( 'select-multiple', 'selectbox-multiple' ), true );
	}

	/**
	 * Convert a Builder semantic field type to its rendered control family.
	 *
	 * Booking Form Builder time fields are emitted as bounded select controls,
	 * even though their semantic types describe scheduling behavior. This
	 * mapping prevents those fields from being rendered as unrelated HTML time
	 * inputs in the Inspector.
	 *
	 * @param mixed $field_type Candidate Builder field type.
	 *
	 * @return string Stable presentation control type.
	 */
	private function normalize_structure_control_type( $field_type ) {
		$source_type  = $this->normalize_source_type( $field_type );
		$select_types = array(
			'country',
			'durationtime',
			'endtime',
			'rangetime',
			'season_rangetime',
			'starttime',
			'time_slots',
			'weekday_rangetime',
			'weekday_starttime',
		);

		return in_array( $source_type, $select_types, true ) ? 'select' : $this->normalize_field_type( $source_type );
	}

	/**
	 * Convert an Advanced Mode shortcode type to its rendered control family.
	 *
	 * Generated Builder forms describe semantic time fields with selectbox
	 * shortcodes, while manually authored starttime/endtime shortcodes render as
	 * text-like controls. Preserving that distinction reproduces the control the
	 * customer actually used instead of guessing from the field name.
	 *
	 * @param mixed $field_type Candidate Advanced Mode source type.
	 *
	 * @return string Stable presentation control type.
	 */
	private function normalize_advanced_control_type( $field_type ) {
		$source_type = $this->normalize_source_type( $field_type );
		if ( 'country' === $source_type ) {
			return 'select';
		}
		if ( in_array( $source_type, array( 'starttime', 'endtime' ), true ) ) {
			return 'text';
		}

		return $this->normalize_field_type( $source_type );
	}

	/**
	 * Normalize a configured label to safe plain text.
	 *
	 * @param mixed $field_label Candidate field label.
	 *
	 * @return string Normalized label.
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
			'firstname'  => __( 'First name', 'booking' ),
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
	 * Identify implementation metadata rather than customer-editable fields.
	 *
	 * The canonical booking-form serializer stores a display companion with a
	 * `_val` suffix for many controls. System values may therefore exist as both
	 * the base key and its generated companion. Classification always uses the
	 * base key so legacy snapshots and stored-value fallbacks cannot expose a
	 * duplicate-booking command or computed hint as an editable customer field.
	 * The allow list is deliberately exact; customer-defined fields are not
	 * rejected merely because their names use the `wpbc_` prefix.
	 *
	 * @param string $field_key Candidate field key.
	 *
	 * @return bool True for system-owned records and generated companions.
	 */
	public function is_system_field_key( $field_key ) {
		$field_key = $this->normalize_field_key( $field_key );
		if ( '' === $field_key ) {
			return false;
		}

		$base_field_key = '_val' === substr( $field_key, -4 )
			? substr( $field_key, 0, -4 )
			: $field_key;
		$system_fields = array(
			'calendar',
			'captcha',
			'submit',
			'standard_bk_cost',
			'wpbc_bfb_form_id',
			'wpbc_custom_booking_form',
			'wpbc_other_action',
		);

		return in_array( $base_field_key, $system_fields, true ) || '_hint' === substr( $base_field_key, -5 );
	}

	/**
	 * Sanitize one authorized stored value according to its display type.
	 *
	 * @param mixed  $field_value Candidate stored value.
	 * @param string $field_type  Normalized presentation type.
	 *
	 * @return string Safe plain-text value.
	 */
	private function sanitize_field_value( $field_value, $field_type ) {
		$field_value = is_scalar( $field_value ) ? html_entity_decode( (string) $field_value, ENT_QUOTES, 'UTF-8' ) : '';
		if ( 'textarea' === $field_type ) {
			if ( function_exists( 'sanitize_textarea_field' ) ) {
				return sanitize_textarea_field( $field_value );
			}
			$field_lines = preg_split( '/\r\n|\r|\n/', $field_value );
			$field_lines = is_array( $field_lines ) ? array_map( 'sanitize_text_field', $field_lines ) : array();

			return implode( "\n", $field_lines );
		}

		return sanitize_text_field( $field_value );
	}
}

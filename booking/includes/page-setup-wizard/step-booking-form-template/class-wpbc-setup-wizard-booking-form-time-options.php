<?php
/**
 * Booking Form time-option projection for the Setup Wizard.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Apply the saved Setup Wizard time proposal to one Form Builder definition.
 *
 * The route-specific time steps deliberately store presentation-neutral
 * `HH:MM` values. This service is the single integration boundary that projects
 * those values into both representations owned by Form Builder: the structured
 * field tree used by the editor and the advanced shortcode source used by the
 * public renderer. Keeping the transformation here makes preview and save use
 * the same result without coupling the reusable time editor to Form Builder.
 */
final class WPBC_Setup_Wizard_Booking_Form_Time_Options {

	/** @var WPBC_Setup_Wizard_Start_End_Times */
	private $start_end_times;

	/** @var WPBC_Setup_Wizard_Start_Duration_Times */
	private $start_duration_times;

	/** @var WPBC_Setup_Wizard_Fixed_Time_Slots */
	private $fixed_time_slots;

	/**
	 * Build the projector around the route-specific time validators.
	 *
	 * @param WPBC_Setup_Wizard_Start_End_Times|null      $start_end_times      Optional Start/End validator.
	 * @param WPBC_Setup_Wizard_Start_Duration_Times|null $start_duration_times Optional Start/Duration validator.
	 * @param WPBC_Setup_Wizard_Fixed_Time_Slots|null     $fixed_time_slots     Optional Fixed Time Slots validator.
	 */
	public function __construct( $start_end_times = null, $start_duration_times = null, $fixed_time_slots = null ) {
		$this->start_end_times = $start_end_times instanceof WPBC_Setup_Wizard_Start_End_Times
			? $start_end_times
			: new WPBC_Setup_Wizard_Start_End_Times();
		$this->start_duration_times = $start_duration_times instanceof WPBC_Setup_Wizard_Start_Duration_Times
			? $start_duration_times
			: new WPBC_Setup_Wizard_Start_Duration_Times( $this->start_end_times );
		$this->fixed_time_slots = $fixed_time_slots instanceof WPBC_Setup_Wizard_Fixed_Time_Slots
			? $fixed_time_slots
			: new WPBC_Setup_Wizard_Fixed_Time_Slots( $this->start_end_times );
	}

	/**
	 * Build a server-owned projection context from normalized wizard values.
	 *
	 * @param array<string,mixed> $wizard_values Checkpoint values keyed by step ID.
	 *
	 * @return array{customer_journey:string,start_end_times:mixed,start_duration_times:mixed,fixed_time_slots:mixed,time_format:string} Projection context.
	 */
	public function get_context_from_values( array $wizard_values ) {
		$customer_journey = isset( $wizard_values['customer_journey']['customer_journey'] )
			? sanitize_key( (string) $wizard_values['customer_journey']['customer_journey'] )
			: '';
		$start_end_times = isset( $wizard_values['start_end_times']['start_end_times'] )
			? $wizard_values['start_end_times']['start_end_times']
			: array();
		$start_duration_times = isset( $wizard_values['start_duration_times']['start_duration_times'] )
			? $wizard_values['start_duration_times']['start_duration_times']
			: array();
		$fixed_time_slots = isset( $wizard_values['fixed_time_slots']['fixed_time_slots'] )
			? $wizard_values['fixed_time_slots']['fixed_time_slots']
			: array();
		$time_format = isset( $wizard_values['date_time_formats']['time_format'] ) && is_scalar( $wizard_values['date_time_formats']['time_format'] )
			? (string) $wizard_values['date_time_formats']['time_format']
			: '';

		if ( ! in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ) {
			$time_format = function_exists( 'get_bk_option' ) ? (string) get_bk_option( 'booking_time_format' ) : 'H:i';
		}
		if ( ! in_array( $time_format, array( 'g:i a', 'g:i A', 'H:i' ), true ) ) {
			$time_format = 'H:i';
		}

		return array(
			'customer_journey' => $customer_journey,
			'start_end_times'  => $start_end_times,
			'start_duration_times' => $start_duration_times,
			'fixed_time_slots' => $fixed_time_slots,
			'time_format'      => $time_format,
		);
	}

	/**
	 * Project saved choices into a read-only preview payload.
	 *
	 * Templates without fields owned by the active journey are returned unchanged.
	 * Non-time journeys are also unchanged, which prevents unrelated customer
	 * journeys from inheriting stale time proposals from an earlier route.
	 *
	 * @param array<string,mixed> $preview_payload     Server-owned preview payload.
	 * @param array<string,mixed> $projection_context Server-owned wizard context.
	 *
	 * @return array<string,mixed>|WP_Error Transformed payload or validation error.
	 */
	public function apply_to_preview_payload( array $preview_payload, array $projection_context ) {
		if ( ! $this->should_project( $projection_context ) ) {
			return $preview_payload;
		}

		$structure = isset( $preview_payload['structure'] ) && is_array( $preview_payload['structure'] )
			? $preview_payload['structure']
			: array();
		$advanced_form = isset( $preview_payload['advanced_form'] ) && is_scalar( $preview_payload['advanced_form'] )
			? (string) $preview_payload['advanced_form']
			: '';
		$transformed = $this->transform_definition( $structure, $advanced_form, $projection_context );
		if ( is_wp_error( $transformed ) ) {
			return $transformed;
		}

		$preview_payload['structure']     = $transformed['structure'];
		$preview_payload['advanced_form'] = $transformed['advanced_form'];

		return $preview_payload;
	}

	/**
	 * Project saved choices into a canonical Form Builder save configuration.
	 *
	 * Both Form Builder representations are changed in memory before any write.
	 * A malformed structure or failed encoding therefore aborts the operation
	 * without partially changing the Standard form.
	 *
	 * @param array<string,mixed> $form_config        Server-owned FormConfig.
	 * @param array<string,mixed> $projection_context Server-owned wizard context.
	 *
	 * @return array<string,mixed>|WP_Error Transformed FormConfig or validation error.
	 */
	public function apply_to_form_config( array $form_config, array $projection_context ) {
		if ( ! $this->should_project( $projection_context ) ) {
			return $form_config;
		}

		$structure_json = isset( $form_config['structure_json'] ) && is_scalar( $form_config['structure_json'] )
			? (string) $form_config['structure_json']
			: '';
		$structure      = json_decode( $structure_json, true );
		if ( ! is_array( $structure ) || empty( $structure ) ) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_time_structure_invalid',
				__( 'The selected booking form cannot receive the configured times because its structure is invalid.', 'booking' )
			);
		}

		$advanced_form = isset( $form_config['advanced_form'] ) && is_scalar( $form_config['advanced_form'] )
			? (string) $form_config['advanced_form']
			: '';
		$transformed = $this->transform_definition( $structure, $advanced_form, $projection_context );
		if ( is_wp_error( $transformed ) ) {
			return $transformed;
		}

		$encoded_structure = wp_json_encode( $transformed['structure'] );
		if ( false === $encoded_structure || '' === $encoded_structure ) {
			return new WP_Error(
				'wpbc_setup_wizard_booking_form_time_structure_encode_failed',
				__( 'The configured booking times could not be prepared for the Booking Form.', 'booking' )
			);
		}

		$form_config['structure_json'] = $encoded_structure;
		$form_config['advanced_form']  = $transformed['advanced_form'];

		return $form_config;
	}

	/**
	 * Determine whether the active journey owns an explicit time proposal.
	 *
	 * @param array<string,mixed> $projection_context Server-owned wizard context.
	 *
	 * @return bool True when time choices must be projected.
	 */
	private function should_project( array $projection_context ) {
		$customer_journey = isset( $projection_context['customer_journey'] )
			? sanitize_key( (string) $projection_context['customer_journey'] )
			: '';

		return WPBC_Setup_Wizard_Customer_Journey_Policy::uses_time_configuration( $customer_journey );
	}

	/**
	 * Transform structured fields and their matching advanced shortcodes.
	 *
	 * @param array<int|string,mixed> $structure          Form Builder structure.
	 * @param string                  $advanced_form      Advanced shortcode source.
	 * @param array<string,mixed>     $projection_context Server-owned wizard context.
	 *
	 * @return array{structure:array<int|string,mixed>,advanced_form:string}|WP_Error Transformed definition.
	 */
	private function transform_definition( array $structure, $advanced_form, array $projection_context ) {
		$customer_journey = isset( $projection_context['customer_journey'] ) ? sanitize_key( (string) $projection_context['customer_journey'] ) : '';
		$time_format = isset( $projection_context['time_format'] ) && in_array( $projection_context['time_format'], array( 'g:i a', 'g:i A', 'H:i' ), true )
			? (string) $projection_context['time_format']
			: 'H:i';

		if ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_fixed_time_slots_configuration( $customer_journey ) ) {
			$validated_times = $this->fixed_time_slots->validate_fixed_time_slots(
				isset( $projection_context['fixed_time_slots'] ) ? $projection_context['fixed_time_slots'] : array(),
				true
			);
			if ( is_wp_error( $validated_times ) ) {
				return $validated_times;
			}

			$options_by_type = array(
				'rangetime' => $this->build_range_field_options( $validated_times['time_slots'], $time_format ),
			);
		} elseif ( WPBC_Setup_Wizard_Customer_Journey_Policy::uses_start_duration_configuration( $customer_journey ) ) {
			$validated_times = $this->start_duration_times->validate_start_duration_times(
				isset( $projection_context['start_duration_times'] ) ? $projection_context['start_duration_times'] : array(),
				true
			);
			if ( is_wp_error( $validated_times ) ) {
				return $validated_times;
			}

			$options_by_type = array(
				'starttime'    => $this->build_field_options( $validated_times['start_times'], $time_format ),
				'durationtime' => $this->build_duration_field_options( $validated_times['duration_times'] ),
			);
		} else {
			$validated_times = $this->start_end_times->validate_start_end_times(
				isset( $projection_context['start_end_times'] ) ? $projection_context['start_end_times'] : array(),
				true
			);
			if ( is_wp_error( $validated_times ) ) {
				return $validated_times;
			}

			$options_by_type = array(
				'starttime' => $this->build_field_options( $validated_times['start_times'], $time_format ),
				'endtime'   => $this->build_field_options( $validated_times['end_times'], $time_format ),
			);
		}

		$field_names  = array();
		$field_counts = array();
		foreach ( array_keys( $options_by_type ) as $field_type ) {
			$field_names[ $field_type ]  = array( $field_type );
			$field_counts[ $field_type ] = 0;
		}

		$this->replace_structure_time_options( $structure, $options_by_type, $field_names, $field_counts );

		$advanced_result = $this->replace_advanced_time_options(
			$advanced_form,
			$options_by_type,
			$field_names,
			$field_counts
		);
		if ( is_wp_error( $advanced_result ) ) {
			return $advanced_result;
		}

		return array(
			'structure'     => $structure,
			'advanced_form' => $advanced_result,
		);
	}

	/**
	 * Build Form Builder option DTOs in the saved user order.
	 *
	 * @param string[] $time_values Validated `HH:MM` values.
	 * @param string   $time_format Validated display format.
	 *
	 * @return array<int,array{label:string,value:string,selected:bool}> Field options.
	 */
	private function build_field_options( array $time_values, $time_format ) {
		$field_options = array();
		$timezone      = new DateTimeZone( 'UTC' );

		foreach ( $time_values as $time_value ) {
			list( $hour, $minute ) = array_map( 'intval', explode( ':', $time_value ) );
			$field_options[] = array(
				'label'    => wp_date( $time_format, ( ( $hour * 60 ) + $minute ) * MINUTE_IN_SECONDS, $timezone ),
				'value'    => $time_value,
				'selected' => false,
			);
		}

		return $field_options;
	}

	/**
	 * Build Form Builder duration option DTOs in the saved user order.
	 *
	 * @param string[] $duration_values Validated `HH:MM` duration values.
	 *
	 * @return array<int,array{label:string,value:string,selected:bool}> Field options.
	 */
	private function build_duration_field_options( array $duration_values ) {
		$field_options = array();
		foreach ( $duration_values as $duration_value ) {
			list( $hour, $minute ) = array_map( 'intval', explode( ':', $duration_value ) );
			$field_options[] = array(
				'label'    => $this->start_duration_times->format_duration_label( ( $hour * 60 ) + $minute ),
				'value'    => $duration_value,
				'selected' => false,
			);
		}

		return $field_options;
	}

	/**
	 * Build Form Builder range-time options in the saved slot order.
	 *
	 * @param array<int,array{start_time:string,end_time:string}> $time_slots Validated fixed-slot ranges.
	 * @param string                                             $time_format Validated display format.
	 *
	 * @return array<int,array{label:string,value:string,selected:bool}> Field options.
	 */
	private function build_range_field_options( array $time_slots, $time_format ) {
		$field_options = array();

		foreach ( $time_slots as $time_slot ) {
			$start_time = (string) $time_slot['start_time'];
			$end_time   = (string) $time_slot['end_time'];
			$field_options[] = array(
				'label'    => $this->fixed_time_slots->format_time_label( $start_time, $time_format ) . ' - ' . $this->fixed_time_slots->format_time_label( $end_time, $time_format ),
				'value'    => $start_time . ' - ' . $end_time,
				'selected' => false,
			);
		}

		return $field_options;
	}

	/**
	 * Recursively replace only Form Builder fields owned by the active journey.
	 *
	 * @param array<int|string,mixed>                                                        $nodes           Structure subtree, modified in place.
	 * @param array<string,array<int,array{label:string,value:string,selected:bool}>>         $options_by_type Options keyed by field type.
	 * @param array<string,string[]>                                                         $field_names     Discovered field names, modified in place.
	 * @param array<string,int>                                                              $field_counts    Discovered field counts, modified in place.
	 *
	 * @return void
	 */
	private function replace_structure_time_options( array &$nodes, array $options_by_type, array &$field_names, array &$field_counts ) {
		if ( isset( $nodes['type'], $nodes['data'] ) && 'field' === $nodes['type'] && is_array( $nodes['data'] ) ) {
			$field_type = isset( $nodes['data']['type'] ) ? sanitize_key( (string) $nodes['data']['type'] ) : '';
			if ( ! isset( $options_by_type[ $field_type ] ) && isset( $nodes['data']['usage_key'] ) ) {
				$field_type = sanitize_key( (string) $nodes['data']['usage_key'] );
			}

			if ( isset( $options_by_type[ $field_type ] ) ) {
				$nodes['data']['options'] = $options_by_type[ $field_type ];
				if ( array_key_exists( 'default_value', $nodes['data'] ) ) {
					$nodes['data']['default_value'] = '';
				}
				if ( array_key_exists( 'defaultValue', $nodes['data'] ) ) {
					$nodes['data']['defaultValue'] = '';
				}
				++$field_counts[ $field_type ];
				if ( isset( $nodes['data']['name'] ) && is_scalar( $nodes['data']['name'] ) ) {
					$field_name = sanitize_key( (string) $nodes['data']['name'] );
					if ( '' !== $field_name ) {
						$field_names[ $field_type ][] = $field_name;
					}
				}
			}
		}

		foreach ( $nodes as &$node ) {
			if ( is_array( $node ) ) {
				$this->replace_structure_time_options( $node, $options_by_type, $field_names, $field_counts );
			}
		}
		unset( $node );
	}

	/**
	 * Replace matching selectbox shortcodes while preserving field modifiers.
	 *
	 * @param string                                                                          $advanced_form   Advanced shortcode source.
	 * @param array<string,array<int,array{label:string,value:string,selected:bool}>>           $options_by_type Options keyed by field type.
	 * @param array<string,string[]>                                                           $field_names     Canonical and discovered field names.
	 * @param array<string,int>                                                                $field_counts    Structured fields found by type.
	 *
	 * @return string|WP_Error Transformed source or a synchronization error.
	 */
	private function replace_advanced_time_options( $advanced_form, array $options_by_type, array $field_names, array $field_counts ) {
		$advanced_form = (string) $advanced_form;

		foreach ( $options_by_type as $field_type => $field_options ) {
			$names         = array_values( array_unique( array_filter( $field_names[ $field_type ] ) ) );
			$escaped_names = array_map( 'preg_quote', $names, array_fill( 0, count( $names ), '/' ) );
			$pattern       = '/\[(selectbox\*?)\s+(' . implode( '|', $escaped_names ) . ')(?=\s|\])([^\]]*)\]/i';
			$replacement_count = 0;
			$advanced_form = preg_replace_callback(
				$pattern,
				function ( $matches ) use ( $field_options ) {
					$tokens = array();
					if ( preg_match_all( '/"((?:\\\\.|[^"\\\\])*)"|\'((?:\\\\.|[^\'\\\\])*)\'/', $matches[3], $quoted_tokens, PREG_SET_ORDER ) ) {
						foreach ( $quoted_tokens as $quoted_token ) {
							$double_quoted_value = isset( $quoted_token[1] ) ? (string) $quoted_token[1] : '';
							$single_quoted_value = isset( $quoted_token[2] ) ? (string) $quoted_token[2] : '';
							$token_value         = '' !== $double_quoted_value ? $double_quoted_value : $single_quoted_value;
							if ( 2 <= strlen( $token_value ) && '@@' === substr( $token_value, -2 ) ) {
								$tokens[] = $quoted_token[0];
								break;
							}
						}
					}

					$modifiers = preg_replace( '/\bdefault(?::|=)(?:"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|[^\s\]]+)/i', '', $matches[3] );
					$modifiers = preg_replace( '/(?:"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')/', '', (string) $modifiers );
					$modifiers = trim( preg_replace( '/\s+/', ' ', (string) $modifiers ) );

					foreach ( $field_options as $field_option ) {
						$option_token = (string) $field_option['label'] . '@@' . (string) $field_option['value'];
						$tokens[]     = '"' . str_replace( array( '\\', '"' ), array( '\\\\', '\\"' ), $option_token ) . '"';
					}

					return '[' . $matches[1] . ' ' . $matches[2]
						. ( '' !== $modifiers ? ' ' . $modifiers : '' )
						. ' ' . implode( ' ', $tokens ) . ']';
				},
				$advanced_form,
				-1,
				$replacement_count
			);

			if ( null === $advanced_form ) {
				return new WP_Error(
					'wpbc_setup_wizard_booking_form_time_shortcode_invalid',
					__( 'The configured booking times could not be applied to the Booking Form source.', 'booking' )
				);
			}
			if ( $field_counts[ $field_type ] > 0 && 0 === $replacement_count && '' !== trim( $advanced_form ) ) {
				return new WP_Error(
					'wpbc_setup_wizard_booking_form_time_shortcode_missing',
					__( 'The selected Booking Form contains a time field that could not be synchronized safely.', 'booking' )
				);
			}
		}

		return $advanced_form;
	}
}

<?php
/**
 * Booking Form Builder - helpers for dedicated live-demo templates.
 *
 * Demo records deliberately reuse proven Builder structures, while keeping
 * stable template keys that can evolve independently from the public presets.
 *
 * @package Booking Calendar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! function_exists( 'wpbc_bfb_demo_template__walk_fields' ) ) {

	/**
	 * Apply a callback to every BFB field in a decoded structure.
	 *
	 * @param array    $node     Structure node.
	 * @param callable $callback Field callback.
	 *
	 * @return array
	 */
	function wpbc_bfb_demo_template__walk_fields( $node, $callback ) {
		if ( ! is_array( $node ) ) {
			return $node;
		}

		if ( isset( $node['type'], $node['data'] ) && 'field' === $node['type'] && is_array( $node['data'] ) ) {
			$node['data'] = call_user_func( $callback, $node['data'] );
		}

		foreach ( $node as $key => $value ) {
			if ( is_array( $value ) ) {
				$node[ $key ] = wpbc_bfb_demo_template__walk_fields( $value, $callback );
			}
		}

		return $node;
	}
}

if ( ! function_exists( 'wpbc_bfb_demo_template__remove_field_types' ) ) {

	/**
	 * Remove selected BFB field nodes from a decoded structure.
	 *
	 * @param mixed $node        Structure node.
	 * @param array $field_types Field types to remove.
	 *
	 * @return mixed|null
	 */
	function wpbc_bfb_demo_template__remove_field_types( $node, $field_types ) {
		if ( ! is_array( $node ) ) {
			return $node;
		}
		$is_list = ( empty( $node ) || array_keys( $node ) === range( 0, count( $node ) - 1 ) );

		if (
			isset( $node['type'], $node['data']['type'] ) &&
			'field' === $node['type'] &&
			in_array( (string) $node['data']['type'], $field_types, true )
		) {
			return null;
		}

		foreach ( $node as $key => $value ) {
			if ( ! is_array( $value ) ) {
				continue;
			}

			$filtered = wpbc_bfb_demo_template__remove_field_types( $value, $field_types );
			if ( null === $filtered ) {
				unset( $node[ $key ] );
			} else {
				$node[ $key ] = $filtered;
			}
		}

		if ( $is_list ) {
			$node = array_values( $node );
		}

		return $node;
	}
}

if ( ! function_exists( 'wpbc_bfb_demo_template__node_has_static_texts' ) ) {

	/**
	 * Check whether a Builder node contains every requested static-text value.
	 *
	 * @param mixed $node  Structure node.
	 * @param array $texts Static-text values.
	 *
	 * @return bool
	 */
	function wpbc_bfb_demo_template__node_has_static_texts( $node, $texts ) {
		$found = array_fill_keys( $texts, false );
		$walk  = static function ( $value ) use ( &$walk, &$found ) {
			if ( ! is_array( $value ) ) {
				return;
			}
			if (
				isset( $value['type'], $value['data']['type'], $value['data']['text'] ) &&
				'field' === $value['type'] &&
				'static_text' === $value['data']['type'] &&
				array_key_exists( (string) $value['data']['text'], $found )
			) {
				$found[ (string) $value['data']['text'] ] = true;
			}
			foreach ( $value as $child ) {
				if ( is_array( $child ) ) {
					$walk( $child );
				}
			}
		};
		$walk( $node );

		return ! in_array( false, $found, true );
	}
}

if ( ! function_exists( 'wpbc_bfb_demo_template__remove_advanced_row' ) ) {

	/**
	 * Remove the balanced outer Advanced Form row containing a marker.
	 *
	 * @param string $form   Advanced Form markup.
	 * @param string $marker Unique marker within the row.
	 *
	 * @return string
	 */
	function wpbc_bfb_demo_template__remove_advanced_row( $form, $marker ) {
		$marker_position = strpos( $form, $marker );
		if ( false === $marker_position ) {
			return $form;
		}

		$row_start = strrpos( substr( $form, 0, $marker_position ), '<r>' );
		if ( false === $row_start ) {
			return $form;
		}

		if ( ! preg_match_all( '/<\/?r>/', substr( $form, $row_start ), $matches, PREG_OFFSET_CAPTURE ) ) {
			return $form;
		}

		$depth = 0;
		foreach ( $matches[0] as $tag ) {
			$depth += ( '<r>' === $tag[0] ) ? 1 : -1;
			if ( 0 === $depth ) {
				$row_end = $row_start + $tag[1] + strlen( $tag[0] );
				return substr( $form, 0, $row_start ) . substr( $form, $row_end );
			}
		}

		return $form;
	}
}

if ( ! function_exists( 'wpbc_bfb_demo_template__medium_layout' ) ) {

	/**
	 * Arrange the Business Medium demo like its canonical two-step Builder export.
	 *
	 * @param array $record Template record.
	 *
	 * @return array
	 */
	function wpbc_bfb_demo_template__medium_layout( $record ) {
		$structure = json_decode( (string) $record['structure_json'], true );
		if ( ! isset( $structure[0]['content'], $structure[1]['content'] ) ) {
			return $record;
		}

		$calendar_section = null;
		$summary_section  = null;
		foreach ( $structure[0]['content'] as $node ) {
			if ( isset( $node['type'], $node['data']['columns'][0]['items'] ) && 'section' === $node['type'] ) {
				$encoded = wp_json_encode( $node );
				if ( false !== strpos( $encoded, '"type":"calendar"' ) ) {
					$calendar_section = $node;
				}
			}
		}
		foreach ( $structure[1]['content'] as &$node ) {
			if ( wpbc_bfb_demo_template__node_has_static_texts( $node, array( 'Booking Data', 'Booking Cost' ) ) ) {
				$node['data']['columns'][0]['width'] = '76.056%';
				$node['data']['columns'][1]['width'] = '20.944%';
				$summary_section = $node;
				break;
			}
		}
		unset( $node );

		if ( null === $calendar_section || null === $summary_section ) {
			return $record;
		}

		$resource_title = null;
		$find_resource  = static function ( $node ) use ( &$find_resource, &$resource_title ) {
			if ( ! is_array( $node ) || null !== $resource_title ) {
				return;
			}
			if ( isset( $node['type'], $node['data']['type'] ) && 'field' === $node['type'] && 'resource_title_hint' === $node['data']['type'] ) {
				$resource_title = $node;
				return;
			}
			foreach ( $node as $child ) {
				if ( is_array( $child ) ) {
					$find_resource( $child );
				}
			}
		};
		$find_resource( $calendar_section );

		$calendar_section['data']['columns'] = array( $calendar_section['data']['columns'][0] );
		$calendar_section['data']['col_styles'] = '';
		$calendar_section['data']['columns'][0]['width'] = '100%';

		$first_items = &$summary_section['data']['columns'][0]['items'];
		if ( isset( $first_items[0]['data']['text'] ) && 'Booking Data' === $first_items[0]['data']['text'] ) {
			array_shift( $first_items );
		}
		if ( null !== $resource_title ) {
			array_unshift( $first_items, $resource_title );
		}
		$suffix_step_one_ids = static function ( $node ) use ( &$suffix_step_one_ids ) {
			if ( ! is_array( $node ) ) {
				return $node;
			}
			if ( isset( $node['type'], $node['data'] ) && is_array( $node['data'] ) ) {
				if ( isset( $node['data']['id'] ) ) {
					$node['data']['id'] .= '-step1';
				}
				if ( 'field' === $node['type'] && isset( $node['data']['name'] ) ) {
					$node['data']['name'] .= '-step1';
				}
			}
			foreach ( $node as $key => $value ) {
				if ( is_array( $value ) ) {
					$node[ $key ] = $suffix_step_one_ids( $value );
				}
			}
			return $node;
		};
		$summary_section = $suffix_step_one_ids( $summary_section );

		$structure[0]['content'] = array(
			$structure[0]['content'][0],
			$calendar_section,
			$summary_section,
			$structure[0]['content'][ count( $structure[0]['content'] ) - 1 ],
		);
		$record['structure_json'] = wp_json_encode( $structure );

		$form = wpbc_bfb_demo_template__remove_advanced_row( (string) $record['advanced_form'], '[calendar]' );
		$replacement = <<<'WPBC_BFB_MEDIUM_STEP_ONE'
		<r>
			<c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><l>Select Date</l><br>[calendar]</item></c>
		</r>
		<r>
			<c style="flex-basis: 76.056%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
				<item>Booking:&nbsp;<strong>[resource_title_hint]</strong></item>
				<r>
					<c style="flex-basis: 31.3333%"><item>Check-in:&nbsp;<strong>[check_in_date_hint]</strong></item></c>
					<c style="flex-basis: 31.3333%"><item>Check-out:&nbsp;<strong>[check_out_date_hint]</strong></item></c>
					<c style="flex-basis: 31.3333%"><item>Nights:&nbsp;<strong>[nights_number_hint]</strong></item></c>
				</r>
			</c>
			<c style="flex-basis: 20.944%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
				<item><label name="static-text-blyy7-step1" class="wpbc_static_text" style="text-align:left;font-weight:bold">Booking Cost</label></item>
				<r><c style="flex-basis: 100%"><item>Total Cost:&nbsp;<strong>[cost_hint]</strong></item></c></r>
			</c>
		</r>
WPBC_BFB_MEDIUM_STEP_ONE;
		$timeline_end = strpos( $form, '</r>', strpos( $form, 'active_step="1"' ) );
		if ( false !== $timeline_end ) {
			$timeline_end += 4;
			$form = substr( $form, 0, $timeline_end ) . "\n" . $replacement . substr( $form, $timeline_end );
		}
		$form = str_replace( array( '71.7186%', '25.2814%' ), array( '76.056%', '20.944%' ), $form );
		$record['advanced_form'] = $form;

		return $record;
	}
}

if ( ! function_exists( 'wpbc_bfb_demo_template__large_layout' ) ) {

	/**
	 * Place the Business Large calendar above its compact date and cost hints.
	 *
	 * @param array $record Template record.
	 *
	 * @return array
	 */
	function wpbc_bfb_demo_template__large_layout( $record ) {
		$structure = json_decode( (string) $record['structure_json'], true );
		if ( ! isset( $structure[0]['content'] ) || ! is_array( $structure[0]['content'] ) ) {
			return $record;
		}

		$calendar_index   = null;
		$calendar_section = null;
		foreach ( $structure[0]['content'] as $index => $node ) {
			if ( false !== strpos( wp_json_encode( $node ), '"type":"calendar"' ) ) {
				$calendar_index   = $index;
				$calendar_section = $node;
				break;
			}
		}
		if ( null === $calendar_section || empty( $calendar_section['data']['columns'][0] ) ) {
			return $record;
		}

		$hint_fields = array();
		$collect     = static function ( $node ) use ( &$collect, &$hint_fields ) {
			if ( ! is_array( $node ) ) {
				return;
			}
			if ( isset( $node['type'], $node['data']['type'] ) && 'field' === $node['type'] ) {
				$hint_fields[ $node['data']['type'] ] = $node;
			}
			foreach ( $node as $child ) {
				if ( is_array( $child ) ) {
					$collect( $child );
				}
			}
		};
		$collect( $calendar_section );

		$required_types = array( 'capacity_hint', 'check_in_date_hint', 'check_out_date_hint', 'nights_number_hint', 'cost_hint' );
		foreach ( $required_types as $required_type ) {
			if ( ! isset( $hint_fields[ $required_type ] ) ) {
				return $record;
			}
		}

		$calendar_section['data']['columns'] = array( $calendar_section['data']['columns'][0] );
		$calendar_section['data']['col_styles'] = '';
		$calendar_section['data']['columns'][0]['width'] = '100%';
		$hint_fields['capacity_hint']['data']['preview_value'] = 4;

		$divider_field = static function ( $id ) {
			return array(
				'type' => 'field',
				'data' => array(
					'id'               => $id,
					'type'             => 'divider',
					'usage_key'        => 'divider',
					'orientation'      => 'horizontal',
					'line_style'       => 'solid',
					'thickness_px'      => 1,
					'length'           => '100%',
					'align'            => 'center',
					'color'            => '#e0e0e0',
					'label'            => 'Divider_horizontal',
					'name'             => $id,
					'margin_top_px'    => 2,
					'margin_bottom_px' => 2,
					'margin_left_px'   => 2,
					'margin_right_px'  => 2,
					'cssclass_extra'   => '',
					'html_id'          => '',
				),
			);
		};

		$summary_section = array(
			'type' => 'section',
			'data' => array(
				'id'         => 'demo-business-large-booking-summary',
				'label'      => 'Section',
				'html_id'    => '',
				'cssclass'   => '',
				'col_styles' => '[{"dir":"row","wrap":"wrap","ai":"flex-start","gap":"10px"},{"dir":"row","wrap":"wrap","ai":"flex-start","gap":"10px"}]',
				'columns'    => array(
					array(
						'width' => '76.056%',
						'items' => array(
							array(
								'type' => 'section',
								'data' => array(
									'id'         => 'demo-business-large-date-hints',
									'label'      => 'Section',
									'html_id'    => '',
									'cssclass'   => '',
									'col_styles' => '',
									'columns'    => array(
										array( 'width' => '31.3333%', 'items' => array( $hint_fields['check_in_date_hint'] ) ),
										array( 'width' => '31.3333%', 'items' => array( $hint_fields['check_out_date_hint'] ) ),
										array( 'width' => '31.3333%', 'items' => array( $hint_fields['nights_number_hint'] ) ),
									),
								),
							),
						),
					),
					array(
						'width' => '20.944%',
						'items' => array(
							array(
								'type' => 'section',
								'data' => array(
									'id'         => 'demo-business-large-cost-hint',
									'label'      => 'Section',
									'html_id'    => '',
									'cssclass'   => '',
									'col_styles' => '',
									'columns'    => array(
										array( 'width' => '100%', 'items' => array( $hint_fields['cost_hint'] ) ),
									),
								),
							),
						),
					),
				),
			),
		);

		array_splice(
			$structure[0]['content'],
			$calendar_index,
			1,
			array(
				$calendar_section,
				$divider_field( 'divider_horizontal-r8s' ),
				$hint_fields['capacity_hint'],
				$summary_section,
				$divider_field( 'divider_horizontal' ),
			)
		);
		$record['structure_json'] = wp_json_encode( $structure );

		$form = wpbc_bfb_demo_template__remove_advanced_row( (string) $record['advanced_form'], '[calendar]' );
		$replacement = <<<'WPBC_BFB_LARGE_HINTS'
	<r>
		<c style="flex-basis: 100%">
			<item>
				<l>Select Date</l>
				<br>[calendar]
			</item>
		</c>
	</r>
	<r>
		<c style="flex-basis: 100%"><item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-r8s" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div></item></c>
	</r>
	<r>
		<c style="flex-basis: 100%"><item>Availability:&nbsp;<strong>[capacity_hint]</strong></item></c>
	</r>
	<r>
		<c style="flex-basis: 76.056%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
			<r>
				<c style="flex-basis: 31.3333%"><item>Check-in:&nbsp;<strong>[check_in_date_hint]</strong></item></c>
				<c style="flex-basis: 31.3333%"><item>Check-out:&nbsp;<strong>[check_out_date_hint]</strong></item></c>
				<c style="flex-basis: 31.3333%"><item>Nights:&nbsp;<strong>[nights_number_hint]</strong></item></c>
			</r>
		</c>
		<c style="flex-basis: 20.944%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
			<r>
				<c style="flex-basis: 100%"><item>Total Cost:&nbsp;<strong>[cost_hint]</strong></item></c>
			</r>
		</c>
	</r>
	<r>
		<c style="flex-basis: 100%"><item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div></item></c>
	</r>
WPBC_BFB_LARGE_HINTS;
		$form_position = strpos( $form, '<div class="wpbc_bfb_form' );
		if ( false !== $form_position ) {
			$form_open_end = strpos( $form, '>', $form_position );
			if ( false !== $form_open_end ) {
				$form = substr( $form, 0, $form_open_end + 1 ) . "\n" . $replacement . substr( $form, $form_open_end + 1 );
			}
		}
		$record['advanced_form'] = $form;

		return $record;
	}
}

if ( ! function_exists( 'wpbc_bfb_demo_template__build' ) ) {

	/**
	 * Build a dedicated demo template from an existing bundled BFB record.
	 *
	 * @param string $base_file Absolute base-template path.
	 * @param array  $args      Demo template configuration.
	 *
	 * @return array
	 */
	function wpbc_bfb_demo_template__build( $base_file, $args ) {
		$args = wp_parse_args(
			$args,
			array(
				'template_key'   => '',
				'title'          => '',
				'description'    => '',
				'picture_url'    => '',
				'heading'        => '',
				'service_options' => array(),
				'remove_field_types' => array(),
				'remove_review_summary' => false,
				'use_medium_demo_layout' => false,
				'use_large_demo_layout' => false,
			)
		);

		if ( ! is_string( $base_file ) || ! file_exists( $base_file ) ) {
			return array();
		}

		$template = require $base_file;
		if ( empty( $template['record'] ) || ! is_array( $template['record'] ) ) {
			return array();
		}

		$template_key = sanitize_key( (string) $args['template_key'] );
		if ( '' === $template_key ) {
			return array();
		}

		$record                  = $template['record'];
		$record['form_slug']     = $template_key;
		$record['status']        = 'template';
		$record['scope']         = 'global';
		$record['owner_user_id'] = 0;
		$record['is_default']     = 0;
		$record['title']           = (string) $args['title'];
		$record['description']     = (string) $args['description'];
		if ( '' !== (string) $args['picture_url'] ) {
			$record['picture_url'] = (string) $args['picture_url'];
		}

		$service_options = array_values( array_filter( (array) $args['service_options'], 'is_array' ) );
		if ( ! empty( $service_options ) && ! empty( $record['structure_json'] ) ) {
			$structure = json_decode( (string) $record['structure_json'], true );
			if ( is_array( $structure ) ) {
				$structure = wpbc_bfb_demo_template__walk_fields(
					$structure,
					static function ( $field ) use ( $service_options ) {
						if ( isset( $field['type'] ) && 'durationtime' === $field['type'] ) {
							$field['options'] = $service_options;
						}
						return $field;
					}
				);
				$record['structure_json'] = wp_json_encode( $structure );
			}

			$shortcode_options = array();
			foreach ( $service_options as $option ) {
				if ( ! isset( $option['label'], $option['value'] ) ) {
					continue;
				}
				$shortcode_options[] = '"' . str_replace( '"', '&quot;', (string) $option['label'] ) . '@@' . sanitize_text_field( (string) $option['value'] ) . '"';
			}
			if ( ! empty( $shortcode_options ) ) {
				$replacement = '[selectbox* durationtime class:wpbc_service_duration ' . implode( ' ', $shortcode_options ) . ']';
				$record['advanced_form'] = preg_replace( '/\[selectbox\*\s+durationtime\b[^\]]*\]/', $replacement, (string) $record['advanced_form'] );
			}
		}

		$remove_field_types = array_values( array_filter( array_map( 'sanitize_key', (array) $args['remove_field_types'] ) ) );
		if ( ! empty( $remove_field_types ) && ! empty( $record['structure_json'] ) ) {
			$structure = json_decode( (string) $record['structure_json'], true );
			if ( is_array( $structure ) ) {
				$structure = wpbc_bfb_demo_template__remove_field_types( $structure, $remove_field_types );
				$record['structure_json'] = wp_json_encode( $structure );
			}
		}

		if ( in_array( 'capacity_hint', $remove_field_types, true ) ) {
			$record['advanced_form'] = preg_replace(
				'/\s*<r>\s*<c[^>]*>\s*<item>\s*Availability:\s*&nbsp;\s*<strong>\[capacity_hint\]<\/strong>\s*<\/item>\s*<\/c>\s*<\/r>/i',
				'',
				(string) $record['advanced_form']
			);
		}

		if ( ! empty( $args['remove_review_summary'] ) && ! empty( $record['structure_json'] ) ) {
			$structure = json_decode( (string) $record['structure_json'], true );
			if ( isset( $structure[0]['content'] ) && is_array( $structure[0]['content'] ) ) {
				$structure[0]['content'] = array_values(
					array_filter(
						$structure[0]['content'],
						static function ( $node ) {
							return ! wpbc_bfb_demo_template__node_has_static_texts( $node, array( 'Booking Data', 'Booking Cost' ) );
						}
					)
				);
				$record['structure_json'] = wp_json_encode( $structure );
			}
			$record['advanced_form'] = wpbc_bfb_demo_template__remove_advanced_row( (string) $record['advanced_form'], '>Booking Data</label>' );
		}

		if ( ! empty( $args['use_medium_demo_layout'] ) ) {
			$record = wpbc_bfb_demo_template__medium_layout( $record );
		}

		if ( ! empty( $args['use_large_demo_layout'] ) ) {
			$record = wpbc_bfb_demo_template__large_layout( $record );
		}

		$heading = trim( (string) $args['heading'] );
		if ( '' !== $heading && ! empty( $record['structure_json'] ) ) {
			$structure = json_decode( (string) $record['structure_json'], true );
			if ( isset( $structure[0]['content'] ) && is_array( $structure[0]['content'] ) ) {
				$heading_section = array(
					'type' => 'section',
					'data' => array(
						'id'         => $template_key . '-heading-section',
						'label'      => 'Section',
						'html_id'    => '',
						'cssclass'   => '',
						'col_styles' => '',
						'columns'    => array(
							array(
								'width' => '100%',
								'items' => array(
									array(
										'type' => 'field',
										'data' => array(
											'id'             => $template_key . '-heading',
											'type'           => 'static_text',
											'usage_key'      => 'static_text',
											'text'           => $heading,
											'tag'            => 'h3',
											'align'          => 'left',
											'bold'           => 0,
											'italic'         => 0,
											'html_allowed'   => 0,
											'nl2br'          => 1,
											'label'          => 'Static_text',
											'name'           => $template_key . '-heading',
											'html_id'        => '',
											'cssclass_extra' => '',
										),
									),
								),
							),
						),
					),
				);
				array_unshift( $structure[0]['content'], $heading_section );
				$record['structure_json'] = wp_json_encode( $structure );
			}

			$heading_html = '<r><c style="flex-basis: 100%"><item><h3 class="wpbc_static_text" style="text-align:left">' . esc_html( $heading ) . '</h3></item></c></r>';
			$record['advanced_form'] = preg_replace( '/(<div class="wpbc_wizard_step[^>]*>)/', '$1' . "\n\t\t" . $heading_html, (string) $record['advanced_form'], 1 );
		}

		return array(
			'template_key' => $template_key,
			'seed_version' => '11.4.4',
			'sync_mode'    => 'upsert',
			'record'       => $record,
		);
	}
}

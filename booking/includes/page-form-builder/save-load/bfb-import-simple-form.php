<?php
/**
 * Booking Calendar – Form Builder.  Export "Simple booking form" -> BFB structure.
 *
 *
 *
 * This file replaces the old "form_simple__export_to_bfb.php" logic and
 * is dedicated to exporting the legacy Simple booking form "visual structure"
 * into the new BFB structure used by the Form Builder.
 *
 * Responsibilities:
 * - Load visual Simple Form structure from DB.
 * - Group fields into rows/columns (same logic as the legacy visual editor).
 * - Build a BFB structure array:
 *      [
 *        {
 *          "page": 1,
 *          "content": [
 *            { "type": "section", "data": { "columns": [ { "width": "...", "items": [ { "type": "field", "data": {...} } ] } ] } }
 *          ]
 *        }
 *      ]
 * - Optionally store the result as JSON in an option for later import into BFB.
 *
 * @since 10.14.0
 *
 * @package Booking_Calendar
 * @file: ../includes/page-form-builder/save-load/bfb-import-simple-form.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}


/**
 * Export current Simple Form visual structure into a BFB structure array.
 *
 * @param array|false $visual_form_structure Optional preloaded Simple Form structure.
 *
 * @return array BFB structure ready to JSON-encode.
 */
function wpbc_simple_form__export_to_bfb_structure( $visual_form_structure = false ) {

	// 1) Get visual structure from DB if not passed.
	if ( empty( $visual_form_structure ) ) {
		if ( function_exists( 'wpbc_simple_form__db__get_visual_form_structure' ) ) {
			$visual_form_structure = wpbc_simple_form__db__get_visual_form_structure();
		} else {
			$visual_form_structure = array();
		}
	}
	$visual_form_structure = maybe_unserialize( $visual_form_structure );

	if ( ! is_array( $visual_form_structure ) ) {
		$visual_form_structure = array();
	}

	// 2) Layout meta.
	$layout_type = function_exists( 'get_bk_option' ) ? get_bk_option( 'booking_form_structure_type' ) : '';
	if ( empty( $layout_type ) ) {
		$layout_type = 'vertical';
	}

	$max_cols = function_exists( 'get_bk_option' ) ? get_bk_option( 'booking_form_layout_max_cols' ) : 1;
	$max_cols = max( 1, intval( $max_cols ) );

	$is_timepicker = false;
	if ( function_exists( 'get_bk_option' ) ) {
		$is_timepicker = ( 'On' === get_bk_option( 'booking_timeslot_picker' ) );
	}

	// 3) Normalize fields & filter inactive non-obligatory.
	$normalized_fields = array();
	foreach ( $visual_form_structure as $form_field ) {

		$defaults   = array(
			'type'              => 'text',
			'name'              => 'unique_name',
			'obligatory'        => 'Off',
			'if_exist_required' => 'Off',
			'active'            => 'On',
			'required'          => 'Off',
			'label'             => '',
			'value'             => '',
			'placeholder'       => '',
			'cssclass'          => '',
			'html_id'           => '',
		);
		$form_field = wp_parse_args( $form_field, $defaults );

		// Skip inactive non-obligatory fields.
		if ( ( 'Off' === $form_field['active'] ) && ( 'On' !== $form_field['obligatory'] ) ) {
			continue;
		}

		$normalized_fields[] = $form_field;
	}

	// 3.1) Ensure at least one calendar (Simple Form has a fallback).
	$has_calendar = false;
	foreach ( $normalized_fields as $f ) {
		if ( 'calendar' === $f['type'] || 'calendar' === $f['name'] ) {
			$has_calendar = true;
			break;
		}
	}
	if ( ! $has_calendar ) {
		// Prepend a default calendar field (similar to Simple Form fallback: [calendar] at top).
		$normalized_fields = array_merge(
			array(
				array(
					'type'              => 'calendar',
					'name'              => 'calendar',
					'label'             => __( 'Select Date', 'booking' ),
					'value'             => '',
					'placeholder'       => '',
					'cssclass'          => '',
					'html_id'           => '',
					'obligatory'        => 'On',
					'if_exist_required' => 'Off',
					'required'          => 'On',
					'active'            => 'On',
				),
			),
			$normalized_fields
		);
	}

	$builder_structure = array();
	$field_seq         = 0;
	$section_seq       = 0;

	// 4) Wizard layouts -> multi-page structure.
	if ( in_array( $layout_type, array( 'wizard_2columns', 'wizard_services_a' ), true ) ) {

		$builder_structure = wpbc_simple_form__export_wizard_to_bfb_structure(
			$normalized_fields,
			$layout_type,
			$max_cols,
			$is_timepicker,
			$field_seq,
			$section_seq
		);

	} else {
		// 5) Standard layouts (vertical, form_center, form_right) -> single page.
		$sections = wpbc_simple_form__build_bfb_sections_from_fields(
			$normalized_fields,
			$max_cols,
			$is_timepicker,
			$field_seq,
			$section_seq
		);

		if ( ! empty( $sections ) ) {
			$builder_structure[] = array(
				'page'        => 1,
				'layout_type' => $layout_type,   // meta only, safe to ignore.
				'max_cols'    => $max_cols,      // meta only, safe to ignore.
				'content'     => $sections,
			);
		}
	}

	return $builder_structure;
}

// ---------------------------------------------------------------------------------------------------------------------
// == Helpers ==
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Export Simple Form "wizard" layouts into a multi-page BFB structure.
 *
 * @param array  $fields        Normalized fields (active/obligatory only).
 * @param string $layout_type   'wizard_2columns' | 'wizard_services_a'.
 * @param int    $max_cols      booking_form_layout_max_cols.
 * @param bool   $is_timepicker timeslot picker On/Off.
 * @param int    $field_seq     Sequence for unique field IDs (by reference).
 * @param int    $section_seq   Sequence for unique section IDs (by reference).
 *
 * @return array
 */
function wpbc_simple_form__export_wizard_to_bfb_structure( $fields, $layout_type, $max_cols, $is_timepicker, &$field_seq, &$section_seq ) {

	$calendar_field   = null;
	$duration_field   = null;
	$time_fields_map  = array(); // name => field.
	$submit_field     = null;
	$other_fields     = array();

	// Split fields into special buckets + "other".
	foreach ( $fields as $f ) {

		$type = isset( $f['type'] ) ? $f['type'] : '';
		$name = isset( $f['name'] ) ? $f['name'] : '';

		if ( 'calendar' === $type || 'calendar' === $name ) {
			if ( null === $calendar_field ) {
				$calendar_field = $f;
				continue;
			}
		}

		if ( 'durationtime' === $name && null === $duration_field ) {
			$duration_field = $f;
			continue;
		}

		if ( in_array( $name, array( 'rangetime', 'starttime', 'endtime' ), true ) ) {
			// Keep first occurrence only, preserve order later.
			if ( ! isset( $time_fields_map[ $name ] ) ) {
				$time_fields_map[ $name ] = $f;
			}
			continue;
		}

		if ( 'submit' === $type && null === $submit_field ) {
			$submit_field = $f;
			continue;
		}

		$other_fields[] = $f;
	}

	$builder_structure    = array();
	$has_duration         = ( null !== $duration_field );
	$wizard_steps_count   = $has_duration ? 3 : 2;
	$page_index           = 1;
	$is_services_timeline = ( 'wizard_services_a' === $layout_type );

	// ---------------------------------------------------------------------
	// STEP 1: if durationtime exists -> only this field + Next.
	// ---------------------------------------------------------------------
	if ( $has_duration ) {

		$page_content = array();

		if ( $is_services_timeline ) {
			$page_content[] = wpbc_simple_form__build_steps_timeline_section(
				$wizard_steps_count,
				$page_index,
				$field_seq,
				$section_seq
			);
		}

		$sections = wpbc_simple_form__build_bfb_sections_from_fields(
			array( $duration_field ),
			$max_cols,
			$is_timepicker,
			$field_seq,
			$section_seq
		);

		$page_content = array_merge( $page_content, $sections );

		if ( ! empty( $page_content ) ) {

			$step_index    = $page_index;
			$is_last_step  = ( $step_index === $wizard_steps_count );
			$has_back      = false;               // First step: no Back button.
			$include_next  = ! $is_last_step;     // Here always true (duration -> 3 steps).
			$submit_for_nav = null;              // Submit only on last step.

			$page_content[] = wpbc_simple_form__build_wizard_nav_section(
				$step_index,
				$wizard_steps_count,
				$has_back,
				$include_next,
				$submit_for_nav,
				$field_seq,
				$section_seq
			);

			$builder_structure[] = array(
				'page'        => $step_index,
				'layout_type' => $layout_type,
				'wizard_step' => $step_index,
				'content'     => $page_content,
			);

			++$page_index;
		}
	}

	// ---------------------------------------------------------------------
	// STEP 1 (no duration) or STEP 2 (with duration): calendar + time fields.
	// ---------------------------------------------------------------------
	$has_calendar_or_time = ( null !== $calendar_field ) || ! empty( $time_fields_map );

	if ( $has_calendar_or_time ) {

		$page_content = array();

		if ( $is_services_timeline ) {
			$page_content[] = wpbc_simple_form__build_steps_timeline_section(
				$wizard_steps_count,
				$page_index,
				$field_seq,
				$section_seq
			);
		}

		$has_time_fields = ! empty( $time_fields_map );

		// Special wizard layout: calendar + vertical divider + time fields in the right column.
		if ( ( null !== $calendar_field ) && $has_time_fields ) {

			$page_content[] = wpbc_simple_form__build_wizard_calendar_times_section(
				$calendar_field,
				$time_fields_map,
				$field_seq,
				$section_seq
			);

		} else {
			// Fallback: generic grouping (e.g. calendar only or time fields only).
			if ( null !== $calendar_field ) {
				$sections = wpbc_simple_form__build_bfb_sections_from_fields(
					array( $calendar_field ),
					$max_cols,
					$is_timepicker,
					$field_seq,
					$section_seq
				);
				$page_content = array_merge( $page_content, $sections );
			}

			foreach ( array( 'rangetime', 'starttime', 'endtime' ) as $time_name ) {
				if ( isset( $time_fields_map[ $time_name ] ) ) {
					$sections = wpbc_simple_form__build_bfb_sections_from_fields(
						array( $time_fields_map[ $time_name ] ),
						$max_cols,
						$is_timepicker,
						$field_seq,
						$section_seq
					);
					$page_content = array_merge( $page_content, $sections );
				}
			}
		}

		if ( ! empty( $page_content ) ) {

			$step_index     = $page_index;
			$is_last_step   = ( $step_index === $wizard_steps_count );
			$has_back       = ( $step_index > 1 );
			$include_next   = ! $is_last_step;   // If 2-step wizard -> step 1; if 3-step wizard -> step 2.
			$submit_for_nav = null;              // Submit only on last step.

			$page_content[] = wpbc_simple_form__build_wizard_nav_section(
				$step_index,
				$wizard_steps_count,
				$has_back,
				$include_next,
				$submit_for_nav,
				$field_seq,
				$section_seq
			);

			$builder_structure[] = array(
				'page'        => $step_index,
				'layout_type' => $layout_type,
				'wizard_step' => $step_index,
				'content'     => $page_content,
			);

			++$page_index;
		}
	}

	// ---------------------------------------------------------------------
	// Last STEP: remaining fields + final submit (if exists).
	//   - If duration -> this is step 3.
	//   - If no duration -> this is step 2.
	// ---------------------------------------------------------------------
	if ( ! empty( $other_fields ) || null !== $submit_field ) {

		$page_content = array();

		if ( $is_services_timeline ) {
			$page_content[] = wpbc_simple_form__build_steps_timeline_section(
				$wizard_steps_count,
				$page_index,
				$field_seq,
				$section_seq
			);
		}

		// Other fields in the same grid logic as classic Simple Form.
		if ( ! empty( $other_fields ) ) {
			$sections = wpbc_simple_form__build_bfb_sections_from_fields(
				$other_fields,
				$max_cols,
				$is_timepicker,
				$field_seq,
				$section_seq
			);
			$page_content = array_merge( $page_content, $sections );
		}

		if ( ! empty( $page_content ) ) {

			$step_index     = $page_index;
			$is_last_step   = true;
			$has_back       = ( $step_index > 1 );
			$include_next   = false;             // Last step: no Next.
			$submit_for_nav = $submit_field;     // Submit goes together with Back + divider.

			$page_content[] = wpbc_simple_form__build_wizard_nav_section(
				$step_index,
				$wizard_steps_count,
				$has_back,
				$include_next,
				$submit_for_nav,
				$field_seq,
				$section_seq
			);

			$builder_structure[] = array(
				'page'        => $step_index,
				'layout_type' => $layout_type,
				'wizard_step' => $step_index,
				'content'     => $page_content,
			);
		}
	}

	return $builder_structure;
}

/**
 * Group fields into rows (exact same logic as Simple Form)
 *
 * @param array $fields        Normalized fields.
 * @param int   $max_cols      booking_form_layout_max_cols.
 * @param bool  $is_timepicker Whether timeslot picker is enabled for 'rangetime'.
 *
 * @return array Array of rows; each row is an array of $form_field arrays.
 */
function wpbc_simple_form__group_fields_into_rows_for_bfb( $fields, $max_cols, $is_timepicker ) {

	$rows     = array();
	$curr_row = 0;
	$rows[ $curr_row ] = array();

	foreach ( $fields as $form_field ) {

		$type = isset( $form_field['type'] ) ? $form_field['type'] : '';
		$name = isset( $form_field['name'] ) ? $form_field['name'] : '';

		$is_full_width_type = in_array( $type, array( 'textarea', 'calendar', 'submit' ), true );
		$is_full_width_time = ( ( 'rangetime' === $name ) && $is_timepicker );

		if (
			( count( $rows[ $curr_row ] ) >= $max_cols ) ||
			$is_full_width_type ||
			$is_full_width_time
		) {
			++$curr_row;
			$rows[ $curr_row ] = array();
		}

		$rows[ $curr_row ][] = $form_field;

		if ( $is_full_width_type || $is_full_width_time ) {
			++$curr_row;
			$rows[ $curr_row ] = array();
		}
	}

	return $rows;
}

/**
 * Convert rows into BFB “section” structures.
 *
 * Each row becomes one "section", with N equally sized columns.
 *
 * @param array $fields        Normalized fields.
 * @param int   $max_cols      booking_form_layout_max_cols.
 * @param bool  $is_timepicker Whether timeslot picker is enabled.
 * @param int   $field_seq     Field ID sequence (by reference).
 * @param int   $section_seq   Section ID sequence (by reference).
 *
 * @return array List of BFB sections.
 */
function wpbc_simple_form__build_bfb_sections_from_fields( $fields, $max_cols, $is_timepicker, &$field_seq, &$section_seq ) {

	$sections = array();
	$rows     = wpbc_simple_form__group_fields_into_rows_for_bfb( $fields, $max_cols, $is_timepicker );

	foreach ( $rows as $row_fields ) {

		if ( empty( $row_fields ) ) {
			continue;
		}

		$cols_count = count( $row_fields );
		$cols_count = max( 1, $cols_count );
		$col_width  = round( 100 / $cols_count, 4 );

		$columns = array();

		foreach ( $row_fields as $form_field ) {

			++$field_seq;
			$item = wpbc_simple_form__map_field_to_bfb_item( $form_field, $field_seq );

			// Skip if mapping failed.
			if ( empty( $item ) || ! is_array( $item ) ) {
				continue;
			}

			$columns[] = array(
				'width' => sprintf( '%.4f%%', $col_width ),
				'items' => array( $item ),
			);
		}

		if ( empty( $columns ) ) {
			continue;
		}

		++$section_seq;
		$section_id = 'section-simple-' . $section_seq;

		$sections[] = array(
			'type' => 'section',
			'data' => array(
				'id'        => $section_id,
				'label'     => __( 'Section', 'booking' ),
				'html_id'   => '',
				'cssclass'  => '',
				// Leave col_styles empty – BFB Column Styles will apply defaults.
				'col_styles'=> '',
				'columns'   => $columns,
			),
		);
	}

	return $sections;
}

/**
 *  Helper for Steps Timeline (only used for wizard_services_a)
 *
 * @param int $steps_count  Total number of wizard steps (2 or 3).
 * @param int $active_step  Step index for this page (1-based).
 * @param int $field_seq    Field ID sequence (by reference).
 * @param int $section_seq  Section ID sequence (by reference).
 *
 * @return array BFB section with one "steps_timeline" field.
 */
function wpbc_simple_form__build_steps_timeline_section( $steps_count, $active_step, &$field_seq, &$section_seq ) {

	++$field_seq;
	$field_id = 'steps_timeline_' . $field_seq;

	$item = array(
		'type' => 'field',
		'data' => array(
			'id'          => $field_id,
			'type'        => 'steps_timeline',
			'usage_key'   => 'steps_timeline',
			'label'       => '',
			'html_id'     => '',
			'cssclass'    => '',
			'steps_count' => intval( $steps_count ),
			'active_step' => intval( $active_step ),
		),
	);

	++$section_seq;
	$section_id = 'section-wizard-timeline-' . $section_seq;

	return array(
		'type' => 'section',
		'data' => array(
			'id'        => $section_id,
			'label'     => __( 'Step header', 'booking' ),
			'html_id'   => '',
			'cssclass'  => 'wpbc_bfb__section--timeline',
			'col_styles'=> '',
			'columns'   => array(
				array(
					'width' => '100.0000%',
					'items' => array( $item ),
				),
			),
		),
	);
}

/**
 * Wizard calendar + time fields section.
 *
 * Produces a section like:
 *   - Left column: calendar
 *   - Middle skinny column: vertical divider
 *   - Right column: rangetime / starttime / endtime stacked
 *
 * Matches the example structure used by Wizard (several steps) template.
 *
 * @param array $calendar_field   Simple Form "calendar" field.
 * @param array $time_fields_map  ['rangetime' => field, 'starttime' => field, 'endtime' => field] subset.
 * @param int   $field_seq        Field ID sequence (by reference).
 * @param int   $section_seq      Section ID sequence (by reference).
 *
 * @return array BFB section.
 */
function wpbc_simple_form__build_wizard_calendar_times_section( $calendar_field, $time_fields_map, &$field_seq, &$section_seq ) {

	$columns   = array();
	$time_items = array();
	$calendar_item = null;

	// 1) Calendar in left column.
	if ( ! empty( $calendar_field ) ) {
		++$field_seq;
		$calendar_item = wpbc_simple_form__map_field_to_bfb_item( $calendar_field, $field_seq );
	}

	// 2) Time fields stacked in the right column: rangetime -> starttime -> endtime (if exist).
	foreach ( array( 'rangetime', 'starttime', 'endtime' ) as $time_name ) {
		if ( isset( $time_fields_map[ $time_name ] ) && is_array( $time_fields_map[ $time_name ] ) ) {
			++$field_seq;
			$item = wpbc_simple_form__map_field_to_bfb_item( $time_fields_map[ $time_name ], $field_seq );
			if ( ! empty( $item ) ) {
				$time_items[] = $item;
			}
		}
	}

	// If we somehow have no calendar AND no time items, bail out.
	if ( empty( $calendar_item ) && empty( $time_items ) ) {
		return array();
	}

	// 3) Vertical divider in the middle column.
	++$field_seq;
	$divider_id = 'divider-vertical-' . $field_seq;

	$divider_item = array(
		'type' => 'field',
		'data' => array(
			'type'            => 'divider',
			'usage_key'       => 'divider_vertical',
			'orientation'     => 'vertical',
			'line_style'      => 'solid',
			'thickness_px'    => 1,
			'length'          => '90%',
			'align'           => 'middle',
			'color'           => '#ccc',
			'label'           => 'Divider_vertical',
			'margin_top_px'   => 0,
			'margin_bottom_px'=> 0,
			'margin_left_px'  => 0,
			'margin_right_px' => 0,
			'cssclass_extra'  => '',
			'id'              => $divider_id,
			'name'            => $divider_id,
			'html_id'         => '',
		),
	);

	// 4) Assemble columns:
	//    Left  column  ~ 41.1303%
	//    Middle column ~ 0.1%    (divider)
	//    Right column  ~ 52.7697%
	if ( $calendar_item ) {
		$columns[] = array(
			'width' => '41.1303%',
			'items' => array( $calendar_item ),
		);
	}

	$columns[] = array(
		'width' => '0.1%',
		'items' => array( $divider_item ),
	);

	if ( ! empty( $time_items ) ) {
		$columns[] = array(
			'width' => '52.7697%',
			'items' => $time_items,
		);
	}

	// If somehow there are less than 2 real columns, fallback to equal widths.
	if ( count( $columns ) < 2 ) {
		$cols_count = count( $columns );
		$col_width  = ( $cols_count > 0 ) ? round( 100 / $cols_count, 4 ) . '%' : '100.0000%';
		foreach ( $columns as &$c ) {
			$c['width'] = $col_width;
		}
		unset( $c );
	}

	// 5) Section wrapper.
	++$section_seq;
	$section_id = 'section-simple-wizard-' . $section_seq;

	return array(
		'type' => 'section',
		'data' => array(
			'id'        => $section_id,
			'label'     => __( 'Section', 'booking' ),
			'html_id'   => '',
			'cssclass'  => '',
			// Matches your example col_styles for calendar/time layout.
			'col_styles'=> '[{"aself":"stretch"},{"dir":"row","wrap":"wrap","jc":"center","ai":"center","aself":"stretch"},{"aself":"stretch"}]',
			'columns'   => $columns,
		),
	);
}

/**
 * Wizard navigation section: horizontal divider + Back/Next/Submit buttons.
 *
 * Layout per step:
 *   - First step (no duration OR duration step): Divider + Next
 *   - Middle step (only in 3-step wizard):       Divider + Back + Next
 *   - Last step:                                 Divider + Back + Submit
 *
 * Matches the example like:
 *   [divider-horizontal] [wizard_nav_back] [submit]
 *
 * @param int        $step_index      Current wizard step (1-based).
 * @param int        $steps_count     Total number of steps (2 or 3).
 * @param bool       $has_back        Whether to include a Back button.
 * @param bool       $include_next    Whether to include a Next button.
 * @param array|null $submit_field    Simple Form "submit" field (only for last step), or null.
 * @param int        $field_seq       Field ID sequence (by reference).
 * @param int        $section_seq     Section ID sequence (by reference).
 *
 * @return array BFB section.
 */
function wpbc_simple_form__build_wizard_nav_section( $step_index, $steps_count, $has_back, $include_next, $submit_field, &$field_seq, &$section_seq ) {

	$items = array();

	// 1) Horizontal divider (always present).
	++$field_seq;
	$divider_id = 'divider-vertical-he' . $field_seq;

	$items[] = array(
		'type' => 'field',
		'data' => array(
			'type'            => 'divider',
			'usage_key'       => 'divider_vertical',
			'orientation'     => 'horizontal',
			'line_style'      => 'solid',
			'thickness_px'    => 1,
			'length'          => '100%',
			'align'           => 'center',
			'color'           => '#ccc',
			'label'           => 'Divider_vertical',
			'margin_top_px'   => 0,
			'margin_bottom_px'=> 0,
			'margin_left_px'  => 0,
			'margin_right_px' => 0,
			'cssclass_extra'  => '',
			'id'              => $divider_id,
			'name'            => $divider_id,
			'html_id'         => '',
		),
	);

	// 2) Back button (if required).
	if ( $has_back ) {
		++$field_seq;
		$back_id = 'wizard_nav_back-' . $step_index;

		$items[] = array(
			'type' => 'field',
			'data' => array(
				'id'           => $back_id,
				'type'         => 'wizard_nav',
				'usage_key'    => 'wizard_nav_back',
				'direction'    => 'back',
				'target_step'  => max( 1, $step_index - 1 ),
				'label'        => __( 'Back', 'booking' ),
				'name'         => $back_id,
				'cssclass_extra' => '',
				'html_id'      => '',
			),
		);
	}

	// 3) Next button (for all non-final steps).
	if ( $include_next && $step_index < $steps_count ) {
		++$field_seq;
		$next_id = ( 1 === $step_index ) ? 'wizard_nav_next' : 'wizard_nav_next-' . $step_index;

		$items[] = array(
			'type' => 'field',
			'data' => array(
				'id'           => $next_id,
				'type'         => 'wizard_nav',
				'usage_key'    => 'wizard_nav_next',
				'direction'    => 'next',
				'target_step'  => $step_index + 1,
				'label'        => __( 'Next', 'booking' ),
				'name'         => $next_id,
				'cssclass_extra' => '',
				'html_id'      => '',
			),
		);
	}

	// 4) Submit button only on final step (if submit field exists).
	if ( ( $step_index === $steps_count ) && ! empty( $submit_field ) && is_array( $submit_field ) ) {
		++$field_seq;
		$submit_item = wpbc_simple_form__map_field_to_bfb_item( $submit_field, $field_seq );
		if ( ! empty( $submit_item ) ) {
			$items[] = $submit_item;
		}
	}

	// 5) Section wrapper – 1 column with all nav items, aligned to bottom-right.
	++$section_seq;
	$section_id = 'section-wizard-nav-' . $section_seq;

	return array(
		'type' => 'section',
		'data' => array(
			'id'        => $section_id,
			'label'     => __( 'Wizard navigation', 'booking' ),
			'html_id'   => '',
			'cssclass'  => '',
			// Same col_styles pattern as your example.
			'col_styles'=> '[{"dir":"row","wrap":"wrap","jc":"flex-end","ai":"flex-end","gap":"9px","aself":"flex-end"}]',
			'columns'   => array(
				array(
					'width' => '100%',
					'items' => $items,
				),
			),
		),
	);
}


// =====================================================================================================================
// == Map Fields ==
// =====================================================================================================================

/**
 * Map one Simple Form field to a BFB "field" item.
 *
 * BFB item shape:
 *   [
 *     'type' => 'field',
 *     'data' => [
 *       'id'        => 'calendar',
 *       'type'      => 'calendar',
 *       'usage_key' => 'calendar',
 *       'label'     => 'Select dates',
 *       'name'      => 'calendar',
 *       ... pack-specific keys ...
 *     ]
 *   ]
 *
 * @param array $form_field Normalized simple form field.
 * @param int   $seq        Sequence number for unique IDs.
 *
 * @return array BFB item (type=field) or empty array on skip.
 */
function wpbc_simple_form__map_field_to_bfb_item( $form_field, $seq ) {

	$defaults   = array(
		'type'              => 'text',
		'name'              => 'unique_name',
		'label'             => '',
		'value'             => '',
		'placeholder'       => '',
		'cssclass'          => '',
		'html_id'           => '',
		'obligatory'        => 'Off',
		'if_exist_required' => 'Off',
		'required'          => 'Off',
		'active'            => 'On',
	);
	$form_field = wp_parse_args( $form_field, $defaults );

	$type   = $form_field['type'];
	$name   = $form_field['name'];
	$label  = $form_field['label'];

	if ( '' === $label ) {
		$label = ucfirst( str_replace( array( '_', '-' ), ' ', $name ) );
	}

	$pack = wpbc_simple_form__guess_bfb_pack( $form_field );

	$required_flag = ( 'On' === $form_field['required'] ) ||
					 ( 'On' === $form_field['if_exist_required'] ) ||
					 ( 'On' === $form_field['obligatory'] );
	$required      = $required_flag ? 1 : 0;

	// Choose a stable field ID for the Builder.
	$field_id = $form_field['html_id'];
	if ( '' === $field_id ) {
		$field_id = $name;
	}
	if ( '' === $field_id ) {
		$field_id = $pack . '-' . $seq;
	}
	$field_id = sanitize_key( $field_id );

	$data = array(
		'id'        => $field_id,
		'type'      => $pack,
		'usage_key' => $pack,
		'label'     => $label,
		'name'      => $name,
		'html_id'   => (string) $form_field['html_id'],
		'cssclass'  => (string) $form_field['cssclass'],
	);

	switch ( $pack ) {

		case 'calendar':
			// Minimal calendar config – BFB pack will handle advanced options.
			$data['min_width']   = '250px';
			$data['resource_id'] = 1; // If you know resource here, adjust.
			$data['months']      = 1;
			break;

		case 'text':
		case 'email':
			$data['min_width']   = '8em';
			$data['placeholder'] = isset( $form_field['placeholder'] ) ? (string) $form_field['placeholder'] : '';
			$data['required']    = $required;
			break;

		case 'textarea':
			$data['min_width']   = '240px';
			$data['placeholder'] = isset( $form_field['placeholder'] ) ? (string) $form_field['placeholder'] : '';
			$data['required']    = $required;
			break;

		case 'select':
			$data['min_width']   = '100px';
			$data['placeholder'] = '--- Select ---';

			$data['options'] = array();
			$opts            = wpbc_simple_form__parse_select_options( $form_field );

			foreach ( $opts as $opt ) {
				$data['options'][] = array(
					'label'    => $opt['label'],
					'value'    => $opt['value'],
					'selected' => false,
				);
			}

			$data['required'] = $required;
			break;

		case 'checkbox':
			/**
			 * SIMPLE FORM -> BFB: single checkbox
			 *
			 * Simple booking form has only one checkbox per field (not a group).
			 * We still provide ONE option with Title/Value, so the exporter can
			 * use it if needed, but we also set use_label_element=1 so it can
			 * generate:
			 *
			 *   [checkbox name use_label_element "Label"]
			 *
			 * instead of group markup.
			 */
			$data['min_width']         = '240px';
			$data['use_label_element'] = 1;
			$data['required']          = $required;
			// Reset Label.
			$data['label'] = '';

			$data['options'] = array();

			// Try to parse a Title/Value pair from "value" (same helper as select/radio).
			$opts = wpbc_simple_form__parse_select_options( $form_field );

			if ( ! empty( $opts ) ) {
				// Use ONLY the first option, because Simple Form represents a single checkbox.
				$first = $opts[0];

				$data['options'][] = array(
					'label'    => $first['label'],
					'value'    => $first['value'],
					'selected' => false,
				);
			} else {
				// Fallback: use label as title and name as value.
				$data['options'][] = array(
					'label'    => $label,
					'value'    => $name,
					'selected' => false,
				);
			}

			// IMPORTANT: do NOT set "multiple" or "layout_inline" here – this is a single checkbox.
			// IMPORTANT: do NOT set placeholder "--- Select ---" for a single checkbox.
			break;

		case 'radio':
			$data['min_width'] = '240px';
			$data['options']   = array();

			$opts = wpbc_simple_form__parse_select_options( $form_field );
			foreach ( $opts as $opt ) {
				$data['options'][] = array(
					'label'    => $opt['label'],
					'value'    => $opt['value'],
					'selected' => false,
				);
			}

			$data['layout_inline'] = 1;
			$data['required']      = $required;
			break;

		case 'submit':
			$data['label']    = $label ? $label : __( 'Send', 'booking' );
			$data['cssclass'] = 'wpbc_bfb__btn wpbc_bfb__btn--primary';
			break;

		case 'rangetime':
		case 'starttime':
		case 'endtime':
		case 'durationtime':
			// Treat as time-based select for now; BFB time packs can enhance later.
			$data['min_width']   = '100px';
			$data['placeholder'] = '--- Select ---';
			$data['options']     = array();

			$opts = wpbc_simple_form__parse_select_options( $form_field );
			foreach ( $opts as $opt ) {
				$data['options'][] = array(
					'label'    => $opt['label'],
					'value'    => $opt['value'],
					'selected' => false,
				);
			}

			$data['required'] = $required;
			break;

		case 'captcha':
			// Minimal – BFB "captcha" pack will use its own defaults.
			break;

		default:
			// Fallback: just add required if meaningful.
			if ( $required ) {
				$data['required'] = $required;
			}
			break;
	}

	if ( ! isset( $data['html_id'] ) ) {
		$data['html_id'] = '';
	}
	if ( ! isset( $data['cssclass'] ) ) {
		$data['cssclass'] = '';
	}

	return array(
		'type' => 'field',
		'data' => $data,
	);
}

// ---------------------------------------------------------------------------------------------------------------------
// == Helpers ==
// ---------------------------------------------------------------------------------------------------------------------

	/**
	 * Guess BFB pack name based on Simple Form type/name.
	 *
	 * @param array $form_field
	 *
	 * @return string
	 */
	function wpbc_simple_form__guess_bfb_pack( $form_field ) {

		$type = isset( $form_field['type'] ) ? $form_field['type'] : '';
		$name = isset( $form_field['name'] ) ? $form_field['name'] : '';

		// Time-related packs.
		if ( in_array( $name, array( 'rangetime', 'durationtime', 'starttime', 'endtime' ), true ) ) {
			return $name; // 'rangetime', 'durationtime', 'starttime', 'endtime' packs.
		}

		// Special system fields.
		if ( 'calendar' === $type || 'calendar' === $name ) {
			return 'calendar';
		}
		if ( 'captcha' === $type || 'captcha' === $name ) {
			return 'captcha';
		}
		if ( 'submit' === $type || 'submit' === $name ) {
			return 'submit';
		}

		// Common fields.
		if ( 'text' === $type ) {
			return 'text';
		}
		if ( 'email' === $type ) {
			return 'email';
		}
		if ( 'textarea' === $type ) {
			return 'textarea';
		}
		if ( in_array( $type, array( 'select', 'selectbox' ), true ) ) {
			return 'select';
		}
		if ( 'checkbox' === $type ) {
			return 'checkbox';
		}
		if ( 'radio' === $type ) {
			return 'radio';
		}

		// Fallback.
		return $type ? $type : 'text';
	}

	/**
	 * Parse selectbox/radio/checkbox values from Simple Form into structured options.
	 *
	 * Supports simple lines:
	 *   Label
	 * …and paired format:
	 *   Label@@value
	 *
	 * @param array $form_field
	 *
	 * @return array
	 */
	function wpbc_simple_form__parse_select_options( $form_field ) {

		$options   = array();
		$raw_value = isset( $form_field['value'] ) ? (string) $form_field['value'] : '';
		$lines     = preg_split( '/\r\n|\r|\n/', $raw_value );

		if ( empty( $lines ) ) {
			return $options;
		}

		foreach ( $lines as $line ) {
			$line = trim( $line );
			if ( '' === $line ) {
				continue;
			}

			$label = $line;
			$value = $line;

			if ( false !== strpos( $line, '@@' ) ) {
				$parts = explode( '@@', $line, 2 );
				$label = trim( $parts[0] );
				$value = trim( $parts[1] );
			}

			// Strip quotes for safety.
			$label = str_replace( array( '"', "'" ), '', $label );
			$value = str_replace( array( '"', "'" ), '', $value );

			$options[] = array(
				'label' => $label,
				'value' => $value,
			);
		}

		return $options;
	}


// =====================================================================================================================
// == Ajax Handler of "Import from Simple Form" button ==
// =====================================================================================================================

/**
 * AJAX: import Simple Form -> BFB structure.
 */
function wpbc_bfb_ajax_import_simple_form() {
	check_ajax_referer( 'wpbc_bfb_import_simple_form', 'nonce' );

	$structure = wpbc_simple_form__export_to_bfb_structure();

	if ( empty( $structure ) ) {
		wp_send_json_error( array( 'message' => 'Empty structure.' ) );
	}

	wp_send_json_success(
		array(
			'structure' => $structure,
		)
	);
}
add_action( 'wp_ajax_wpbc_bfb_import_simple_form', 'wpbc_bfb_ajax_import_simple_form' );

<?php
/**
 * Bundled BFB template: 3-Step Service Appointments Review Wizard with Hints.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/assets/template-records/time_appointments_3_steps_review_with_hints.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

$wpbc_time_appointments_3_steps_review_field = function ( $id, $type, $args ) {
	return array(
		'type' => 'field',
		'data' => array_merge(
			array(
				'id'        => $id,
				'type'      => $type,
				'usage_key' => $type,
			),
			$args
		),
	);
};

$wpbc_time_appointments_3_steps_review_column = function ( $width, $items ) {
	return array(
		'width' => $width,
		'items' => $items,
	);
};

$wpbc_time_appointments_3_steps_review_section = function ( $id, $columns, $col_styles = '' ) {
	return array(
		'type' => 'section',
		'data' => array(
			'id'         => $id,
			'label'      => 'Section',
			'html_id'    => '',
			'cssclass'   => '',
			'col_styles' => $col_styles,
			'columns'    => $columns,
		),
	);
};

$wpbc_time_appointments_3_steps_review_hint = function ( $section_id, $field_id, $type, $prefix, $width = '100%' ) use (
	$wpbc_time_appointments_3_steps_review_field,
	$wpbc_time_appointments_3_steps_review_column,
	$wpbc_time_appointments_3_steps_review_section
) {
	return $wpbc_time_appointments_3_steps_review_section(
		$section_id,
		array(
			$wpbc_time_appointments_3_steps_review_column(
				$width,
				array(
					$wpbc_time_appointments_3_steps_review_field(
						$field_id,
						$type,
						array(
							'prefix_text' => $prefix,
							'help'        => '',
							'label'       => $prefix,
							'name'        => $field_id,
							'html_id'     => '',
							'cssclass'    => '',
						)
					),
				)
			),
		)
	);
};

$wpbc_time_appointments_3_steps_review_timeline = function ( $active_step, $id ) use ( $wpbc_time_appointments_3_steps_review_field ) {
	return $wpbc_time_appointments_3_steps_review_field(
		$id,
		'steps_timeline',
		array(
			'steps_count'        => 3,
			'active_step'        => $active_step,
			'color'              => '#619d40',
			'label'              => 'Steps_timeline',
			'cssclass_extra'     => '',
			'steps_scope_suffix' => 1360,
			'name'               => $id,
			'html_id'            => '',
		)
	);
};

$wpbc_time_appointments_3_steps_review_divider = function ( $id, $orientation = 'horizontal' ) use ( $wpbc_time_appointments_3_steps_review_field ) {
	$is_vertical = ( 'vertical' === $orientation );

	return $wpbc_time_appointments_3_steps_review_field(
		$id,
		'divider',
		array(
			'usage_key'        => 'divider_' . $orientation,
			'orientation'      => $orientation,
			'line_style'       => 'solid',
			'thickness_px'     => 1,
			'length'           => $is_vertical ? '99%' : '100%',
			'align'            => $is_vertical ? 'middle' : 'center',
			'color'            => $is_vertical ? '#cccccc' : '#e0e0e0',
			'label'            => 'Divider_' . $orientation,
			'name'             => $id,
			'margin_top_px'    => $is_vertical ? 5 : 2,
			'margin_bottom_px' => 2,
			'margin_left_px'   => $is_vertical ? 10 : 2,
			'margin_right_px'  => 2,
			'cssclass_extra'   => '',
			'html_id'          => '',
		)
	);
};

$wpbc_time_appointments_3_steps_review_nav = function ( $id, $direction, $target_step, $label ) use ( $wpbc_time_appointments_3_steps_review_field ) {
	return $wpbc_time_appointments_3_steps_review_field(
		$id,
		'wizard_nav',
		array(
			'usage_key'      => 'wizard_nav_next',
			'direction'      => $direction,
			'target_step'    => $target_step,
			'label'          => $label,
			'name'           => $id,
			'cssclass_extra' => '',
			'html_id'        => '',
		)
	);
};

$wpbc_time_appointments_3_steps_review_duration_options = array(
	array( 'label' => 'Service A (20 min)', 'value' => '00:20', 'selected' => false ),
	array( 'label' => 'Service B (30 min)', 'value' => '00:30', 'selected' => false ),
	array( 'label' => 'Service C (45 min)', 'value' => '00:45', 'selected' => false ),
	array( 'label' => 'Service D (1 hour)', 'value' => '01:00', 'selected' => false ),
);

$wpbc_time_appointments_3_steps_review_start_options = array(
	array( 'label' => '9:00 AM', 'value' => '09:00', 'selected' => false ),
	array( 'label' => '10:00 AM', 'value' => '10:00', 'selected' => false ),
	array( 'label' => '11:00 AM', 'value' => '11:00', 'selected' => false ),
	array( 'label' => '12:00 PM', 'value' => '12:00', 'selected' => false ),
	array( 'label' => '1:00 PM', 'value' => '13:00', 'selected' => false ),
	array( 'label' => '2:00 PM', 'value' => '14:00', 'selected' => false ),
	array( 'label' => '3:00 PM', 'value' => '15:00', 'selected' => false ),
	array( 'label' => '4:00 PM', 'value' => '16:00', 'selected' => false ),
	array( 'label' => '5:00 PM', 'value' => '17:00', 'selected' => false ),
);

$wpbc_time_appointments_3_steps_review_is_free = ! class_exists( 'wpdev_bk_biz_m' );

$wpbc_time_appointments_3_steps_review_free_hints = array(
	$wpbc_time_appointments_3_steps_review_section(
		'section-30-1776876301020',
		array(
			$wpbc_time_appointments_3_steps_review_column(
				'47%',
				array(
					$wpbc_time_appointments_3_steps_review_field(
						'selected_dates_hint',
						'selected_dates_hint',
						array(
							'prefix_text' => 'Date:',
							'help'        => '',
							'label'       => 'Date:',
							'name'        => 'selected_dates_hint',
							'html_id'     => '',
							'cssclass'    => '',
						)
					),
				)
			),
			$wpbc_time_appointments_3_steps_review_column(
				'23.5%',
				array(
					$wpbc_time_appointments_3_steps_review_field(
						'start_time_hint',
						'start_time_hint',
						array(
							'prefix_text' => 'Start Time:',
							'help'        => '',
							'label'       => 'Start Time:',
							'name'        => 'start_time_hint',
							'html_id'     => '',
							'cssclass'    => '',
						)
					),
				)
			),
			$wpbc_time_appointments_3_steps_review_column(
				'23.5%',
				array(
					$wpbc_time_appointments_3_steps_review_field(
						'end_time_hint',
						'end_time_hint',
						array(
							'prefix_text' => 'End Time:',
							'help'        => '',
							'label'       => 'End Time:',
							'name'        => 'end_time_hint',
							'html_id'     => '',
							'cssclass'    => '',
						)
					),
				)
			),
		)
	),
);

$wpbc_time_appointments_3_steps_review_pro_extra_hints = array(
	$wpbc_time_appointments_3_steps_review_hint( 'section-33-1776872751100', 'resource_title_hint', 'resource_title_hint', 'Booking:' ),
	$wpbc_time_appointments_3_steps_review_hint( 'section-20-1776867347560', 'capacity_hint', 'capacity_hint', 'Availability:' ),
	$wpbc_time_appointments_3_steps_review_hint( 'section-24-1776867726490', 'cost_hint', 'cost_hint', 'Total Cost:' ),
);

$wpbc_time_appointments_3_steps_review_top_hints = $wpbc_time_appointments_3_steps_review_is_free
	? $wpbc_time_appointments_3_steps_review_free_hints
	: array_merge(
		array( $wpbc_time_appointments_3_steps_review_pro_extra_hints[0] ),
		$wpbc_time_appointments_3_steps_review_free_hints,
		array_slice( $wpbc_time_appointments_3_steps_review_pro_extra_hints, 1 )
	);

$wpbc_time_appointments_3_steps_review_summary_hints = $wpbc_time_appointments_3_steps_review_is_free
	? array(
		$wpbc_time_appointments_3_steps_review_section(
			'section-30-1776876301021',
			array(
				$wpbc_time_appointments_3_steps_review_column(
					'47%',
					array(
						$wpbc_time_appointments_3_steps_review_field(
							'selected_dates_hint-3',
							'selected_dates_hint',
							array(
								'prefix_text' => 'Date:',
								'help'        => '',
								'label'       => 'Date:',
								'name'        => 'selected_dates_hint-3',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
				$wpbc_time_appointments_3_steps_review_column(
					'23.5%',
					array(
						$wpbc_time_appointments_3_steps_review_field(
							'start_time_hint-3',
							'start_time_hint',
							array(
								'prefix_text' => 'Start Time:',
								'help'        => '',
								'label'       => 'Start Time:',
								'name'        => 'start_time_hint-3',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
				$wpbc_time_appointments_3_steps_review_column(
					'23.5%',
					array(
						$wpbc_time_appointments_3_steps_review_field(
							'end_time_hint-3',
							'end_time_hint',
							array(
								'prefix_text' => 'End Time:',
								'help'        => '',
								'label'       => 'End Time:',
								'name'        => 'end_time_hint-3',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
			)
		),
	)
	: array(
		$wpbc_time_appointments_3_steps_review_hint( 'section-33-1776872751101', 'resource_title_hint-2', 'resource_title_hint', 'Booking:' ),
		$wpbc_time_appointments_3_steps_review_hint( 'section-30-1776876301022', 'selected_dates_hint-2', 'selected_dates_hint', 'Date:' ),
		$wpbc_time_appointments_3_steps_review_section(
			'section-31-1776876301023',
			array(
				$wpbc_time_appointments_3_steps_review_column(
					'48.5%',
					array(
						$wpbc_time_appointments_3_steps_review_field(
							'start_time_hint-2',
							'start_time_hint',
							array(
								'prefix_text' => 'Start Time:',
								'help'        => '',
								'label'       => 'Start Time:',
								'name'        => 'start_time_hint-2',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
				$wpbc_time_appointments_3_steps_review_column(
					'48.5%',
					array(
						$wpbc_time_appointments_3_steps_review_field(
							'end_time_hint-2',
							'end_time_hint',
							array(
								'prefix_text' => 'End Time:',
								'help'        => '',
								'label'       => 'End Time:',
								'name'        => 'end_time_hint-2',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
			)
		),
		$wpbc_time_appointments_3_steps_review_hint( 'section-24-1776867726491', 'cost_hint-2', 'cost_hint', 'Total Cost:' ),
	);

$wpbc_time_appointments_3_steps_review_accept_terms = $wpbc_time_appointments_3_steps_review_field(
	'accept_terms',
	'accept_terms',
	array(
		'usage_key' => 'accept_terms',
		'label'     => 'Accept Terms',
		'name'      => 'accept_terms',
		'required'  => 1,
		'links'     => array(
			array(
				'key'         => 'terms',
				'text'        => 'terms',
				'link_type'   => 'url',
				'destination' => 'https://server.com/terms/',
				'target'      => '_blank',
				'cssclass'    => '',
			),
			array(
				'key'         => 'conditions',
				'text'        => 'conditions',
				'link_type'   => 'url',
				'destination' => 'https://server.com/conditions/',
				'target'      => '_blank',
				'cssclass'    => '',
			),
		),
	)
);

$wpbc_time_appointments_3_steps_review_structure = array(
	array(
		'page'    => 1,
		'content' => array(
			$wpbc_time_appointments_3_steps_review_section(
				'section-22-1773220565981',
				array(
					$wpbc_time_appointments_3_steps_review_column( '100%', array( $wpbc_time_appointments_3_steps_review_timeline( 1, 'steps-timeline-yuslc' ) ) ),
				)
			),
			$wpbc_time_appointments_3_steps_review_section(
				'section-12-1773062225539',
				array(
					$wpbc_time_appointments_3_steps_review_column(
						'28.4136%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'durationtime',
								'durationtime',
								array(
									'usagenumber'      => 1,
									'label'            => 'Service',
									'name'             => 'durationtime',
									'placeholder'      => '--- Select service duration ---',
									'required'         => true,
									'help'             => '',
									'cssclass'         => 'wpbc_service_duration',
									'min_width'        => '240px',
									'gen_label_fmt'    => '24h',
									'gen_start_24h'    => '00:20',
									'gen_end_24h'      => '02:00',
									'gen_start_ampm_t' => '00:20',
									'gen_end_ampm_t'   => '02:00',
									'gen_step_h'       => 0,
									'gen_step_m'       => 10,
									'options'          => $wpbc_time_appointments_3_steps_review_duration_options,
								)
							),
							$wpbc_time_appointments_3_steps_review_divider( 'divider_vertical', 'vertical' ),
						)
					),
					$wpbc_time_appointments_3_steps_review_column(
						'43.0071%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'calendar',
								'calendar',
								array(
									'usagenumber'         => 1,
									'resource_id'         => 1,
									'months'              => 1,
									'label'               => 'Select Date',
									'min_width'           => '250px',
									'name'                => 'calendar',
									'wpbc-cal-init'       => 1,
									'wpbc-cal-loaded-rid' => 1,
								)
							),
						)
					),
					$wpbc_time_appointments_3_steps_review_column(
						'22.5794%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'starttime',
								'starttime',
								array(
									'usagenumber'      => 1,
									'min_width'        => '180px',
									'label'            => 'Start time',
									'name'             => 'starttime',
									'required'         => true,
									'options'          => $wpbc_time_appointments_3_steps_review_start_options,
									'gen_start_ampm_t' => '09:00',
									'gen_end_ampm_t'   => '17:00',
								)
							),
						)
					),
				),
				'[{"dir":"row","ai":"flex-start","gap":"8px","aself":"stretch"},{},{"jc":"space-between","aself":"stretch"}]'
			),
			$wpbc_time_appointments_3_steps_review_section(
				'section-58-1776951515103',
				array(
					$wpbc_time_appointments_3_steps_review_column( '100%', $wpbc_time_appointments_3_steps_review_top_hints ),
				),
				'[{"dir":"row","wrap":"wrap","ai":"flex-start","gap":"10px"}]'
			),
			$wpbc_time_appointments_3_steps_review_section(
				'section-13-1773062424786',
				array(
					$wpbc_time_appointments_3_steps_review_column(
						'100%',
						array(
							$wpbc_time_appointments_3_steps_review_divider( 'divider_horizontal-3' ),
							$wpbc_time_appointments_3_steps_review_nav( 'wizard_nav_next-3', 'next', 2, 'Next' ),
						)
					),
				),
				'[{"dir":"row","wrap":"wrap","jc":"flex-end","ai":"flex-end","gap":"10px","aself":"flex-end"}]'
			),
		),
	),
	array(
		'page'    => 2,
		'content' => array(
			$wpbc_time_appointments_3_steps_review_timeline( 2, 'steps-timeline-sl4yc' ),
			$wpbc_time_appointments_3_steps_review_section(
				'section-14-1773062762472',
				array(
					$wpbc_time_appointments_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'text-firstname',
								'text',
								array(
									'usage_key'   => 'text-firstname',
									'label'       => 'First Name',
									'name'        => 'firstname',
									'placeholder' => 'Example: "John"',
									'required'    => 1,
									'help'        => 'Enter your first name.',
									'cssclass'    => 'firstname',
									'min_width'   => '8em',
									'html_id'     => '',
								)
							),
						)
					),
					$wpbc_time_appointments_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'text-secondname',
								'text',
								array(
									'usage_key'   => 'text-secondname',
									'label'       => 'Last Name',
									'name'        => 'secondname',
									'placeholder' => 'Example: "Smith"',
									'required'    => 1,
									'help'        => 'Enter your last name.',
									'cssclass'    => 'secondname lastname',
									'min_width'   => '8em',
									'html_id'     => '',
								)
							),
						)
					),
				)
			),
			$wpbc_time_appointments_3_steps_review_section(
				'section-16-1773062802362',
				array(
					$wpbc_time_appointments_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'email',
								'email',
								array(
									'label'       => 'Email',
									'usagenumber' => 1,
									'name'        => 'email',
									'html_id'     => '',
									'cssclass'    => '',
									'required'    => true,
									'help'        => 'Enter your email address.',
								)
							),
						)
					),
					$wpbc_time_appointments_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'text',
								'text',
								array(
									'label'       => 'Phone',
									'name'        => 'phone',
									'cssclass'    => '',
									'html_id'     => '',
									'placeholder' => '(000)  999 - 10 - 20',
									'help'        => 'Enter contact phone number',
								)
							),
						)
					),
				)
			),
			$wpbc_time_appointments_3_steps_review_section(
				'section-17-1773062914950',
				array(
					$wpbc_time_appointments_3_steps_review_column(
						'100%',
						array(
							$wpbc_time_appointments_3_steps_review_field(
								'textarea',
								'textarea',
								array(
									'min_width' => '260px',
									'label'     => 'Details',
									'name'      => 'details',
									'cssclass'  => '',
									'html_id'   => '',
								)
							),
						)
					),
				)
			),
			$wpbc_time_appointments_3_steps_review_section(
				'section-13-1773062424787',
				array(
					$wpbc_time_appointments_3_steps_review_column(
						'100%',
						array(
							$wpbc_time_appointments_3_steps_review_divider( 'divider_horizontal-4' ),
							$wpbc_time_appointments_3_steps_review_nav( 'wizard_nav_back-2', 'back', 1, 'Back' ),
							$wpbc_time_appointments_3_steps_review_nav( 'wizard_nav_next-4', 'next', 3, 'Review' ),
						)
					),
				),
				'[{"dir":"row","wrap":"wrap","jc":"flex-end","ai":"flex-end","gap":"10px","aself":"flex-end"}]'
			),
		),
	),
	array(
		'page'    => 3,
		'content' => array(
			$wpbc_time_appointments_3_steps_review_timeline( 3, 'steps-timeline-rvw3' ),
			$wpbc_time_appointments_3_steps_review_is_free
				? $wpbc_time_appointments_3_steps_review_summary_hints[0]
				: $wpbc_time_appointments_3_steps_review_section(
					'section-22-1776867571951',
					array(
						$wpbc_time_appointments_3_steps_review_column( '100%', $wpbc_time_appointments_3_steps_review_summary_hints ),
					),
					'[{"dir":"row","wrap":"wrap","ai":"flex-start","gap":"10px"}]'
				),
			$wpbc_time_appointments_3_steps_review_section(
				'section-37-1776875494465',
				array(
					$wpbc_time_appointments_3_steps_review_column( '100%', array( $wpbc_time_appointments_3_steps_review_accept_terms ) ),
				),
				'[{"ai":"flex-end"}]'
			),
			$wpbc_time_appointments_3_steps_review_section(
				'section-13-1773062424785',
				array(
					$wpbc_time_appointments_3_steps_review_column(
						'100%',
						array(
							$wpbc_time_appointments_3_steps_review_divider( 'divider_horizontal-2' ),
							$wpbc_time_appointments_3_steps_review_nav( 'wizard_nav_next-2', 'back', 2, 'Back' ),
							$wpbc_time_appointments_3_steps_review_field(
								'submit',
								'submit',
								array(
									'usage_key'   => 'submit',
									'usagenumber' => 1,
									'label'       => 'Send',
									'name'        => 'submit',
									'cssclass'    => 'wpbc_bfb__btn wpbc_bfb__btn--primary',
									'html_id'     => '',
								)
							),
						)
					),
				),
				'[{"dir":"row","wrap":"wrap","jc":"flex-end","ai":"flex-end","gap":"10px","aself":"flex-end"}]'
			),
		),
	),
);

$wpbc_time_appointments_3_steps_review_with_hints_structure_json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $wpbc_time_appointments_3_steps_review_structure ) : false;
if ( ! $wpbc_time_appointments_3_steps_review_with_hints_structure_json ) {
	$wpbc_time_appointments_3_steps_review_with_hints_structure_json = json_encode( $wpbc_time_appointments_3_steps_review_structure );
}

$wpbc_time_appointments_3_steps_review_with_hints_settings_json = '{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":"single"},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}';

$wpbc_time_appointments_3_steps_review_top_hints_advanced = $wpbc_time_appointments_3_steps_review_is_free
	? <<<'WPBC_BFB_TEMPLATE_ADVANCED_HINTS'
				<r>
					<c style="flex-basis: 47%">
						<item>
							Date:&nbsp;<strong>[selected_dates_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 23.5%">
						<item>
							Start Time:&nbsp;<strong>[start_time_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 23.5%">
						<item>
							End Time:&nbsp;<strong>[end_time_hint]</strong>
						</item>
					</c>
				</r>
WPBC_BFB_TEMPLATE_ADVANCED_HINTS
	: <<<'WPBC_BFB_TEMPLATE_ADVANCED_HINTS'
				<r>
					<c style="flex-basis: 100%">
						<item>
							Booking:&nbsp;<strong>[resource_title_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Date:&nbsp;<strong>[selected_dates_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 48.5%">
						<item>
							Start Time:&nbsp;<strong>[start_time_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 48.5%">
						<item>
							End Time:&nbsp;<strong>[end_time_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Availability:&nbsp;<strong>[capacity_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Total Cost:&nbsp;<strong>[cost_hint]</strong>
						</item>
					</c>
				</r>
WPBC_BFB_TEMPLATE_ADVANCED_HINTS;

$wpbc_time_appointments_3_steps_review_summary_hints_advanced = $wpbc_time_appointments_3_steps_review_is_free
	? <<<'WPBC_BFB_TEMPLATE_ADVANCED_HINTS'
				<r>
					<c style="flex-basis: 47%">
						<item>
							Date:&nbsp;<strong>[selected_dates_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 23.5%">
						<item>
							Start Time:&nbsp;<strong>[start_time_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 23.5%">
						<item>
							End Time:&nbsp;<strong>[end_time_hint]</strong>
						</item>
					</c>
				</r>
WPBC_BFB_TEMPLATE_ADVANCED_HINTS
	: <<<'WPBC_BFB_TEMPLATE_ADVANCED_HINTS'
				<r>
					<c style="flex-basis: 100%">
						<item>
							Booking:&nbsp;<strong>[resource_title_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Date:&nbsp;<strong>[selected_dates_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 48.5%">
						<item>
							Start Time:&nbsp;<strong>[start_time_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 48.5%">
						<item>
							End Time:&nbsp;<strong>[end_time_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Total Cost:&nbsp;<strong>[cost_hint]</strong>
						</item>
					</c>
				</r>
WPBC_BFB_TEMPLATE_ADVANCED_HINTS;

$wpbc_time_appointments_3_steps_review_with_hints_advanced_form = trim(
<<<WPBC_BFB_TEMPLATE_ADVANCED_FORM
<div class="wpbc_bfb_form wpbc_wizard__border_container">
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step1">
		<r>
			<c style="flex-basis: 100%">
				<item>
					[steps_timeline steps_count="3" active_step="1" color="#619d40"]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 28.4136%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 8px;--wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
				<item>
					<l>Service*</l>
					<br>[selectbox* durationtime class:wpbc_service_duration "Service A (20 min)@@00:20" "Service B (30 min)@@00:30" "Service C (45 min)@@00:45" "Service D (1 hour)@@01:00"]
				</item>
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="vertical" style="margin:5px 2px 2px 10px; display:flex; align-self:stretch"><div name="divider_vertical" class="wpbc_bfb_divider wpbc_bfb_divider--v" role="separator" aria-orientation="vertical" style="border-left:1px solid #cccccc; height:99%; padding-left:0; position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);"></div></div>
				</item>
			</c>
			<c style="flex-basis: 43.0071%; --wpbc-col-min: 0px">
				<item>
					<l>Select Date</l>
					<br>[calendar]
				</item>
			</c>
			<c style="flex-basis: 22.5794%; --wpbc-bfb-col-jc: space-between;--wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
				<item>
					<l>Start time*</l>
					<br>[selectbox* starttime "9:00 AM@@09:00" "10:00 AM@@10:00" "11:00 AM@@11:00" "12:00 PM@@12:00" "1:00 PM@@13:00" "2:00 PM@@14:00" "3:00 PM@@15:00" "4:00 PM@@16:00" "5:00 PM@@17:00"]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
{$wpbc_time_appointments_3_steps_review_top_hints_advanced}
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-jc: flex-end;--wpbc-bfb-col-ai: flex-end;--wpbc-bfb-col-gap: 10px;--wpbc-bfb-col-aself: flex-end;--wpbc-col-min: 0px">
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-3" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
				</item>
				<item>
					<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_2">Next</a>
				</item>
			</c>
		</r>
	</div>
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step2 wpbc_wizard_step_hidden" style="display:none;clear:both;">
		<r>
			<c>
				<item>
					[steps_timeline steps_count="3" active_step="2" color="#619d40"]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 48.5%">
				<item>
					<l>First Name*</l>
					<br>[text* firstname class:firstname placeholder:"Example: 'John'"]
					<div class="wpbc_field_description">Enter your first name.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Last Name*</l>
					<br>[text* secondname class:secondname class:lastname placeholder:"Example: 'Smith'"]
					<div class="wpbc_field_description">Enter your last name.</div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Email*</l>
					<br>[email* email]
					<div class="wpbc_field_description">Enter your email address.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Phone</l>
					<br>[text phone placeholder:"(000)  999 - 10 - 20"]
					<div class="wpbc_field_description">Enter contact phone number</div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%">
				<item>
					<l>Details</l>
					<br>[textarea details]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-jc: flex-end;--wpbc-bfb-col-ai: flex-end;--wpbc-bfb-col-gap: 10px;--wpbc-bfb-col-aself: flex-end;--wpbc-col-min: 0px">
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-4" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
				</item>
				<item>
					<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_1">Back</a>
				</item>
				<item>
					<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_3">Review</a>
				</item>
			</c>
		</r>
	</div>
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step3 wpbc_wizard_step_hidden" style="display:none;clear:both;">
		<r>
			<c>
				<item>
					[steps_timeline steps_count="3" active_step="3" color="#619d40"]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
{$wpbc_time_appointments_3_steps_review_summary_hints_advanced}
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-end;--wpbc-col-min: 0px">
				<item>
					<p class="wpbc_row_inline wpdev-form-control-wrap ">
					<l class="wpbc_inline_checkbox">[checkbox* accept_terms "I accept"] the <a href="https://server.com/terms/" target="_blank" rel="noopener noreferrer">terms</a> and <a href="https://server.com/conditions/" target="_blank" rel="noopener noreferrer">conditions</a></l>
					</p>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-jc: flex-end;--wpbc-bfb-col-ai: flex-end;--wpbc-bfb-col-gap: 10px;--wpbc-bfb-col-aself: flex-end;--wpbc-col-min: 0px">
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-2" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
				</item>
				<item>
					<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_2">Back</a>
				</item>
				<item>
					<span class="wpbc_bfb__btn wpbc_bfb__btn--primary" style="flex:1;">[submit "Send"]</span>
				</item>
			</c>
		</r>
	</div>
</div>
WPBC_BFB_TEMPLATE_ADVANCED_FORM
);

$wpbc_time_appointments_3_steps_review_with_hints_content_form = $wpbc_time_appointments_3_steps_review_is_free
	? trim(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class="standard-content-form">
	<b>Date</b>: <f>[selected_dates_hint]</f><br>
	<b>Start Time</b>: <f>[start_time_hint]</f><br>
	<b>End Time</b>: <f>[end_time_hint]</f><br>
	<b>Service</b>: <f>[durationtime_val] / [durationtime]</f><br>
	<b>First Name</b>: <f>[firstname]</f><br>
	<b>Last Name</b>: <f>[secondname]</f><br>
	<b>Email</b>: <f>[email]</f><br>
	<b>Phone</b>: <f>[phone]</f><br>
	<b>Details</b>: <f>[details]</f><br>
	<b>Accept Terms</b>: <f>[accept_terms]</f><br>
</div>
WPBC_BFB_TEMPLATE_CONTENT_FORM
	)
	: trim(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class="standard-content-form">
	<b>Booking</b>: <f>[resource_title_hint]</f><br>
	<b>Date</b>: <f>[selected_dates_hint]</f><br>
	<b>Start Time</b>: <f>[start_time_hint]</f><br>
	<b>End Time</b>: <f>[end_time_hint]</f><br>
	<b>Total Cost</b>: <f>[cost_hint]</f><br>
	<b>Service</b>: <f>[durationtime_val] / [durationtime]</f><br>
	<b>First Name</b>: <f>[firstname]</f><br>
	<b>Last Name</b>: <f>[secondname]</f><br>
	<b>Email</b>: <f>[email]</f><br>
	<b>Phone</b>: <f>[phone]</f><br>
	<b>Details</b>: <f>[details]</f><br>
	<b>Accept Terms</b>: <f>[accept_terms]</f><br>
</div>
WPBC_BFB_TEMPLATE_CONTENT_FORM
	);

return array(
	'template_key' => 'time_appointments_3_steps_review_with_hints',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only', // 'insert_only' = insert once if missing, never overwrite existing row. | 'upsert' = insert if missing, update existing row when seed_version increases.
	'record'       => array(
		'form_slug'           => 'time_appointments_3_steps_review_with_hints',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_time_appointments_3_steps_review_with_hints_structure_json,
		'settings_json'       => $wpbc_time_appointments_3_steps_review_with_hints_settings_json,
		'advanced_form'       => $wpbc_time_appointments_3_steps_review_with_hints_advanced_form,
		'content_form'        => $wpbc_time_appointments_3_steps_review_with_hints_content_form,
		'is_default'          => 0,
		'title'               => 'Time Appointments / 3 Steps Review with Hints',
		'description'         => 'Three-step service appointment booking wizard with service duration, date and start time selection, live date/time hints, customer details, and a final review step before sending.',
		'picture_url'         => 'time_appointments_3_steps_review_with_hints_01.png',
	),
);

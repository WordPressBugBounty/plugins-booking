<?php
/**
 * Bundled BFB template: Full-Day Booking Review Wizard with Hints.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/assets/template-records/dates_advanced_3_steps_review_with_hints.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

// FixIn: 10.15.6.1.

$wpbc_dates_advanced_3_steps_review_field = function ( $id, $type, $args ) {
	$data = array_merge(
		array(
			'id'        => $id,
			'type'      => $type,
			'usage_key' => $type,
		),
		$args
	);

	return array(
		'type' => 'field',
		'data' => $data,
	);
};

$wpbc_dates_advanced_3_steps_review_section = function ( $id, $columns, $col_styles = '' ) {
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

$wpbc_dates_advanced_3_steps_review_column = function ( $width, $items ) {
	return array(
		'width' => $width,
		'items' => $items,
	);
};

$wpbc_dates_advanced_3_steps_review_hint = function ( $section_id, $field_id, $type, $prefix, $width = '100%' ) use (
	$wpbc_dates_advanced_3_steps_review_field,
	$wpbc_dates_advanced_3_steps_review_section,
	$wpbc_dates_advanced_3_steps_review_column
) {
	return $wpbc_dates_advanced_3_steps_review_section(
		$section_id,
		array(
			$wpbc_dates_advanced_3_steps_review_column(
				$width,
				array(
					$wpbc_dates_advanced_3_steps_review_field(
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

$wpbc_dates_advanced_3_steps_review_timeline = function ( $active_step, $id ) use ( $wpbc_dates_advanced_3_steps_review_field ) {
	return $wpbc_dates_advanced_3_steps_review_field(
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

$wpbc_dates_advanced_3_steps_review_divider = function ( $id ) use ( $wpbc_dates_advanced_3_steps_review_field ) {
	return $wpbc_dates_advanced_3_steps_review_field(
		$id,
		'divider',
		array(
			'usage_key'        => 'divider_horizontal',
			'orientation'      => 'horizontal',
			'line_style'       => 'solid',
			'thickness_px'     => 1,
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
		)
	);
};

$wpbc_dates_advanced_3_steps_review_nav = function ( $id, $direction, $target_step, $label ) use ( $wpbc_dates_advanced_3_steps_review_field ) {
	return $wpbc_dates_advanced_3_steps_review_field(
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

$wpbc_dates_advanced_3_steps_review_resource_hint = function ( $section_id, $field_id ) use ( $wpbc_dates_advanced_3_steps_review_hint ) {
	return $wpbc_dates_advanced_3_steps_review_hint( $section_id, $field_id, 'resource_title_hint', 'Booking:' );
};

$wpbc_dates_advanced_3_steps_review_is_free = ! class_exists( 'wpdev_bk_biz_m' );

$wpbc_dates_advanced_3_steps_review_date_pair_hints = function ( $section_id, $suffix = '', $width = '48.5%' ) use (
	$wpbc_dates_advanced_3_steps_review_field,
	$wpbc_dates_advanced_3_steps_review_section,
	$wpbc_dates_advanced_3_steps_review_column
) {
	return $wpbc_dates_advanced_3_steps_review_section(
		$section_id,
		array(
			$wpbc_dates_advanced_3_steps_review_column(
				$width,
				array(
					$wpbc_dates_advanced_3_steps_review_field(
						'check_in_date_hint' . $suffix,
						'check_in_date_hint',
						array(
							'prefix_text' => 'Check-in:',
							'help'        => '',
							'label'       => 'Check-in:',
							'name'        => 'check_in_date_hint' . $suffix,
							'html_id'     => '',
							'cssclass'    => '',
						)
					),
				)
			),
			$wpbc_dates_advanced_3_steps_review_column(
				$width,
				array(
					$wpbc_dates_advanced_3_steps_review_field(
						'check_out_date_hint' . $suffix,
						'check_out_date_hint',
						array(
							'prefix_text' => 'Check-out:',
							'help'        => '',
							'label'       => 'Check-out:',
							'name'        => 'check_out_date_hint' . $suffix,
							'html_id'     => '',
							'cssclass'    => '',
						)
					),
				)
			),
		)
	);
};

if ( $wpbc_dates_advanced_3_steps_review_is_free ) {
	$wpbc_dates_advanced_3_steps_review_top_hints = array(
		$wpbc_dates_advanced_3_steps_review_date_pair_hints( 'section-26-1776867848950' ),
		$wpbc_dates_advanced_3_steps_review_hint( 'section-25-1776867813607', 'days_number_hint', 'days_number_hint', 'Days:' ),
	);

	$wpbc_dates_advanced_3_steps_review_summary_hints = array(
		$wpbc_dates_advanced_3_steps_review_date_pair_hints( 'section-26-1776867848951', '-2' ),
		$wpbc_dates_advanced_3_steps_review_hint( 'section-25-1776867813608', 'days_number_hint-2', 'days_number_hint', 'Days:' ),
	);
} else {
	$wpbc_dates_advanced_3_steps_review_top_hints = array(
		$wpbc_dates_advanced_3_steps_review_resource_hint( 'section-33-1776872751090', 'resource_title_hint' ),
		$wpbc_dates_advanced_3_steps_review_date_pair_hints( 'section-26-1776867848950' ),
		$wpbc_dates_advanced_3_steps_review_hint( 'section-25-1776867813607', 'nights_number_hint', 'nights_number_hint', 'Nights:' ),
		$wpbc_dates_advanced_3_steps_review_hint( 'section-20-1776867347553', 'capacity_hint', 'capacity_hint', 'Availability:' ),
		$wpbc_dates_advanced_3_steps_review_hint( 'section-24-1776867726481', 'cost_hint', 'cost_hint', 'Total Cost:' ),
	);

	$wpbc_dates_advanced_3_steps_review_summary_hints = array(
		$wpbc_dates_advanced_3_steps_review_resource_hint( 'section-33-1776872751091', 'resource_title_hint-2' ),
		$wpbc_dates_advanced_3_steps_review_section(
			'section-26-1776867848951',
			array(
				$wpbc_dates_advanced_3_steps_review_column(
					'31.3333%',
					array(
						$wpbc_dates_advanced_3_steps_review_field(
							'check_in_date_hint-2',
							'check_in_date_hint',
							array(
								'prefix_text' => 'Check-in:',
								'help'        => '',
								'label'       => 'Check-in:',
								'name'        => 'check_in_date_hint-2',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
				$wpbc_dates_advanced_3_steps_review_column(
					'31.3333%',
					array(
						$wpbc_dates_advanced_3_steps_review_field(
							'check_out_date_hint-2',
							'check_out_date_hint',
							array(
								'prefix_text' => 'Check-out:',
								'help'        => '',
								'label'       => 'Check-out:',
								'name'        => 'check_out_date_hint-2',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
				$wpbc_dates_advanced_3_steps_review_column(
					'31.3333%',
					array(
						$wpbc_dates_advanced_3_steps_review_field(
							'nights_number_hint-2',
							'nights_number_hint',
							array(
								'prefix_text' => 'Nights:',
								'help'        => '',
								'label'       => 'Nights:',
								'name'        => 'nights_number_hint-2',
								'html_id'     => '',
								'cssclass'    => '',
							)
						),
					)
				),
			)
		),
		$wpbc_dates_advanced_3_steps_review_hint( 'section-24-1776867726482', 'cost_hint-2', 'cost_hint', 'Total Cost:' ),
	);
}

$wpbc_dates_advanced_3_steps_review_accept_terms = $wpbc_dates_advanced_3_steps_review_field(
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

$wpbc_dates_advanced_3_steps_review_structure = array(
	array(
		'page'    => 1,
		'content' => array(
			$wpbc_dates_advanced_3_steps_review_section(
				'section-22-1773220565981',
				array(
					$wpbc_dates_advanced_3_steps_review_column( '100%', array( $wpbc_dates_advanced_3_steps_review_timeline( 1, 'steps-timeline-yuslc' ) ) ),
				)
			),
			$wpbc_dates_advanced_3_steps_review_section(
				'section-11-1773137021920',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
								'calendar',
								'calendar',
								array(
									'usagenumber'          => 1,
									'resource_id'          => 1,
									'months'               => 1,
									'label'                => 'Select Date',
									'min_width'            => '250px',
									'name'                 => 'calendar',
									'wpbc-cal-init'        => 1,
									'wpbc-cal-loaded-rid'  => 1,
								)
							),
						)
					),
					$wpbc_dates_advanced_3_steps_review_column( '48.5%', $wpbc_dates_advanced_3_steps_review_top_hints ),
				),
				'[{},{"dir":"row","wrap":"wrap","ai":"flex-start","gap":"10px"}]'
			),
			$wpbc_dates_advanced_3_steps_review_section(
				'section-13-1773062424786',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'100%',
						array(
							$wpbc_dates_advanced_3_steps_review_divider( 'divider_horizontal-3' ),
							$wpbc_dates_advanced_3_steps_review_nav( 'wizard_nav_next-3', 'next', 2, 'Next' ),
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
			$wpbc_dates_advanced_3_steps_review_timeline( 2, 'steps-timeline-sl4yc' ),
			$wpbc_dates_advanced_3_steps_review_section(
				'section-14-1773062762472',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
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
					$wpbc_dates_advanced_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
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
			$wpbc_dates_advanced_3_steps_review_section(
				'section-16-1773062802362',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
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
					$wpbc_dates_advanced_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
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
			$wpbc_dates_advanced_3_steps_review_section(
				'section-12-1773486431930',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
								'select',
								'select',
								array(
									'label'       => 'Adults',
									'name'        => 'adults',
									'min_width'   => '240px',
									'html_id'     => '',
									'cssclass'    => '',
									'placeholder' => '--- Select ---',
									'options'     => array(
										array( 'label' => '1', 'value' => '1', 'selected' => false ),
										array( 'label' => '2', 'value' => '2', 'selected' => false ),
										array( 'label' => '3', 'value' => '3', 'selected' => false ),
										array( 'label' => '4', 'value' => '4', 'selected' => false ),
									),
									'required'    => 1,
									'help'        => 'Select number of adults.',
								)
							),
						)
					),
					$wpbc_dates_advanced_3_steps_review_column(
						'48.5%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
								'select-up5',
								'select',
								array(
									'label'       => 'Children',
									'name'        => 'children',
									'min_width'   => '240px',
									'html_id'     => '',
									'cssclass'    => '',
									'placeholder' => '--- Select ---',
									'options'     => array(
										array( 'label' => '0', 'value' => '0', 'selected' => false ),
										array( 'label' => '1', 'value' => '1', 'selected' => false ),
										array( 'label' => '2', 'value' => '2', 'selected' => false ),
										array( 'label' => '3', 'value' => '3', 'selected' => false ),
									),
									'help'        => 'Select number of children.',
								)
							),
						)
					),
				)
			),
			$wpbc_dates_advanced_3_steps_review_section(
				'section-17-1773062914950',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'100%',
						array(
							$wpbc_dates_advanced_3_steps_review_field(
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
			$wpbc_dates_advanced_3_steps_review_section(
				'section-13-1773062424787',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'100%',
						array(
							$wpbc_dates_advanced_3_steps_review_divider( 'divider_horizontal-4' ),
							$wpbc_dates_advanced_3_steps_review_nav( 'wizard_nav_back-2', 'back', 1, 'Back' ),
							$wpbc_dates_advanced_3_steps_review_nav( 'wizard_nav_next-4', 'next', 3, 'Review' ),
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
			$wpbc_dates_advanced_3_steps_review_timeline( 3, 'steps-timeline-rvw3' ),
			$wpbc_dates_advanced_3_steps_review_section(
				'section-22-1776867571951',
				array(
					$wpbc_dates_advanced_3_steps_review_column( '100%', $wpbc_dates_advanced_3_steps_review_summary_hints ),
				),
				'[{"dir":"row","wrap":"wrap","ai":"flex-start","gap":"10px"}]'
			),
			$wpbc_dates_advanced_3_steps_review_section(
				'section-37-1776875494465',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'100%',
						array(
							$wpbc_dates_advanced_3_steps_review_accept_terms,
						)
					),
				),
				'[{"ai":"flex-end"}]'
			),
			$wpbc_dates_advanced_3_steps_review_section(
				'section-13-1773062424785',
				array(
					$wpbc_dates_advanced_3_steps_review_column(
						'100%',
						array(
							$wpbc_dates_advanced_3_steps_review_divider( 'divider_horizontal-2' ),
							$wpbc_dates_advanced_3_steps_review_nav( 'wizard_nav_next-2', 'back', 2, 'Back' ),
							$wpbc_dates_advanced_3_steps_review_field(
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

$wpbc_dates_advanced_3_steps_review_with_hints_structure_json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $wpbc_dates_advanced_3_steps_review_structure ) : false;
if ( ! $wpbc_dates_advanced_3_steps_review_with_hints_structure_json ) {
	$wpbc_dates_advanced_3_steps_review_with_hints_structure_json = json_encode( $wpbc_dates_advanced_3_steps_review_structure );
}

$wpbc_dates_advanced_3_steps_review_with_hints_settings_json = '{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":""},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}';

$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form = trim(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_FORM'
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
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px">
				<item>
					<l>Select Date</l>
					<br>[calendar]
				</item>
			</c>
			<c style="flex-basis: 48.5%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
				<r>
					<c style="flex-basis: 100%">
						<item>
							Booking:&nbsp;<strong>[resource_title_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 48.5%">
						<item>
							Check-in:&nbsp;<strong>[check_in_date_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 48.5%">
						<item>
							Check-out:&nbsp;<strong>[check_out_date_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Nights:&nbsp;<strong>[nights_number_hint]</strong>
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
			<c style="flex-basis: 48.5%">
				<item>
					<l>Adults*</l>
					<br>[selectbox* adults "--- Select ---@@" "1" "2" "3" "4"]
					<div class="wpbc_field_description">Select number of adults.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Children</l>
					<br>[selectbox children "--- Select ---@@" "0" "1" "2" "3"]
					<div class="wpbc_field_description">Select number of children.</div>
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
				<r>
					<c style="flex-basis: 100%">
						<item>
							Booking:&nbsp;<strong>[resource_title_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 31.3333%">
						<item>
							Check-in:&nbsp;<strong>[check_in_date_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 31.3333%">
						<item>
							Check-out:&nbsp;<strong>[check_out_date_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 31.3333%">
						<item>
							Nights:&nbsp;<strong>[nights_number_hint]</strong>
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

if ( $wpbc_dates_advanced_3_steps_review_is_free ) {
	$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form = str_replace(
		'Nights:&nbsp;<strong>[nights_number_hint]</strong>',
		'Days:&nbsp;<strong>[days_number_hint]</strong>',
		$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form
	);
	$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form = preg_replace(
		'/\s*<r>\s*<c style="flex-basis: 100%">\s*<item>\s*Booking:&nbsp;<strong>\[resource_title_hint\]<\/strong>\s*<\/item>\s*<\/c>\s*<\/r>/',
		'',
		$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form
	);
	$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form = str_replace(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_ROW'
				<r>
					<c style="flex-basis: 100%">
						<item>
							Availability:&nbsp;<strong>[capacity_hint]</strong>
						</item>
					</c>
				</r>

WPBC_BFB_TEMPLATE_ADVANCED_ROW
		,
		'',
		$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form
	);
	$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form = str_replace(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_ROW'
				<r>
					<c style="flex-basis: 100%">
						<item>
							Total Cost:&nbsp;<strong>[cost_hint]</strong>
						</item>
					</c>
				</r>

WPBC_BFB_TEMPLATE_ADVANCED_ROW
		,
		'',
		$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form
	);
	$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form = preg_replace(
		'/\n\t\t\t\t<r>\n\t\t\t\t\t<c style="flex-basis: 100%">\n\t\t\t\t\t\t<item>\n\t\t\t\t\t\t\t(?:Availability:&nbsp;<strong>\[capacity_hint\]<\/strong>|Total Cost:&nbsp;<strong>\[cost_hint\]<\/strong>)\n\t\t\t\t\t\t<\/item>\n\t\t\t\t\t<\/c>\n\t\t\t\t<\/r>/',
		'',
		$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form
	);
	$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form = preg_replace(
		'/\s*<r>\s*<c style="flex-basis: 100%">\s*<item>\s*(?:Availability:&nbsp;<strong>\[capacity_hint\]<\/strong>|Total Cost:&nbsp;<strong>\[cost_hint\]<\/strong>)\s*<\/item>\s*<\/c>\s*<\/r>/',
		'',
		$wpbc_dates_advanced_3_steps_review_with_hints_advanced_form
	);
}

$wpbc_dates_advanced_3_steps_review_with_hints_content_form = trim(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class="standard-content-form">
	<b>Check-in</b>: <f>[check_in_date_hint]</f><br>
	<b>Check-out</b>: <f>[check_out_date_hint]</f><br>
	<b>Days</b>: <f>[days_number_hint]</f><br>
	<b>First Name</b>: <f>[firstname]</f><br>
	<b>Last Name</b>: <f>[secondname]</f><br>
	<b>Email</b>: <f>[email]</f><br>
	<b>Phone</b>: <f>[phone]</f><br>
	<b>Adults</b>: <f>[adults]</f><br>
	<b>Children</b>: <f>[children]</f><br>
	<b>Details</b>: <f>[details]</f><br>
	<b>Accept Terms</b>: <f>[accept_terms]</f><br>
</div>
WPBC_BFB_TEMPLATE_CONTENT_FORM
);

return array(
	'template_key' => 'dates_advanced_3_steps_review_with_hints',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only', // 'insert_only' = insert once if missing, never overwrite existing row. | 'upsert' = insert if missing, update existing row when seed_version increases.
	'record'       => array(
		'form_slug'           => 'dates_advanced_3_steps_review_with_hints',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_dates_advanced_3_steps_review_with_hints_structure_json,
		'settings_json'       => $wpbc_dates_advanced_3_steps_review_with_hints_settings_json,
		'advanced_form'       => $wpbc_dates_advanced_3_steps_review_with_hints_advanced_form,
		'content_form'        => $wpbc_dates_advanced_3_steps_review_with_hints_content_form,
		'is_default'          => 0,
		'title'               => 'Full-Days / 3 Steps Review with Hints',
		'description'         => 'Three-step full-day booking wizard with live resource, date, availability, and cost hints, a dedicated guest details step, and a final review step before sending. Useful for setups with changeover dates enabled.',
		'picture_url'         => 'dates_advanced_3_steps_review_with_hints_01.png',
	),
);

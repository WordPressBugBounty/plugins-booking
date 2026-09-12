<?php
/**
 * Bundled BFB template: Two-Column Time-Slots Form with Time Summary.
 *
 * @package Booking Calendar
 * @since   11.8.1
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Build one field record for the bundled template structure.
 *
 * @param string $field_id   Stable field instance ID.
 * @param string $field_type Registered Form Builder field type.
 * @param array  $field_args Field-specific presentation data.
 *
 * @return array Form Builder field record.
 */
$wpbc_time_slots_2_columns_hints_field = function ( $field_id, $field_type, $field_args ) {
	return array(
		'type' => 'field',
		'data' => array_merge(
			array(
				'id'        => $field_id,
				'type'      => $field_type,
				'usage_key' => $field_type,
			),
			$field_args
		),
	);
};

/**
 * Build one column record for the bundled template structure.
 *
 * @param string $column_width CSS percentage used by the Form Builder.
 * @param array  $column_items Ordered fields or nested sections.
 *
 * @return array Form Builder column record.
 */
$wpbc_time_slots_2_columns_hints_column = function ( $column_width, $column_items ) {
	return array(
		'width' => $column_width,
		'items' => $column_items,
	);
};

/**
 * Build one section record for the bundled template structure.
 *
 * @param string $section_id      Stable section instance ID.
 * @param array  $section_columns Ordered column records.
 * @param string $column_styles   Serialized Form Builder column styles.
 * @param string $css_class       Optional section class exported to the row.
 *
 * @return array Form Builder section record.
 */
$wpbc_time_slots_2_columns_hints_section = function ( $section_id, $section_columns, $column_styles = '', $css_class = '' ) {
	return array(
		'type' => 'section',
		'data' => array(
			'id'         => $section_id,
			'label'      => 'Section',
			'html_id'    => '',
			'cssclass'   => $css_class,
			'col_styles' => $column_styles,
			'columns'    => $section_columns,
		),
	);
};

$wpbc_time_slots_2_columns_hints_terms_url      = esc_url_raw( home_url( '/terms/' ) );
$wpbc_time_slots_2_columns_hints_conditions_url = esc_url_raw( home_url( '/conditions/' ) );

/**
 * Build a static text field used for headings and supporting copy.
 *
 * @param string $field_id Stable field instance ID.
 * @param string $text     Visible field text.
 * @param string $tag      Allow-listed semantic tag handled by the field pack.
 * @param bool   $bold     Whether the field pack should apply bold styling.
 *
 * @return array Form Builder field record.
 */
$wpbc_time_slots_2_columns_hints_static_text = function ( $field_id, $text, $tag = 'div', $bold = false ) use ( $wpbc_time_slots_2_columns_hints_field ) {
	return $wpbc_time_slots_2_columns_hints_field(
		$field_id,
		'static_text',
		array(
			'text'           => $text,
			'tag'            => $tag,
			'align'          => 'left',
			'bold'           => $bold ? 1 : 0,
			'italic'         => 0,
			'html_allowed'   => 0,
			'nl2br'          => 1,
			'label'          => 'Static_text',
			'name'           => $field_id,
			'html_id'        => '',
			'cssclass_extra' => '',
		)
	);
};

/**
 * Build a horizontal or vertical divider field.
 *
 * @param string $field_id   Stable field instance ID.
 * @param string $orientation Divider orientation: horizontal or vertical.
 *
 * @return array Form Builder field record.
 */
$wpbc_time_slots_2_columns_hints_divider = function ( $field_id, $orientation ) use ( $wpbc_time_slots_2_columns_hints_field ) {
	$is_vertical = 'vertical' === $orientation;

	return $wpbc_time_slots_2_columns_hints_field(
		$field_id,
		'divider',
		array(
			'usage_key'        => 'divider',
			'orientation'      => $is_vertical ? 'vertical' : 'horizontal',
			'line_style'       => 'solid',
			'thickness_px'     => 1,
			'length'           => '100%',
			'align'            => $is_vertical ? 'middle' : 'center',
			'color'            => '#e0e0e0',
			'label'            => $is_vertical ? 'Divider_vertical' : 'Divider_horizontal',
			'name'             => $field_id,
			'margin_top_px'    => 2,
			'margin_bottom_px' => 2,
			'margin_left_px'   => 2,
			'margin_right_px'  => 2,
			'cssclass_extra'   => '',
			'html_id'          => '',
		)
	);
};

/**
 * Build one two-step wizard navigation control.
 *
 * @param string $field_id   Stable field instance ID.
 * @param string $direction  Navigation direction: next or back.
 * @param int    $target_step Target wizard step number.
 * @param string $label       Visible navigation label.
 *
 * @return array Form Builder field record.
 */
$wpbc_time_slots_2_columns_hints_nav = function ( $field_id, $direction, $target_step, $label ) use ( $wpbc_time_slots_2_columns_hints_field ) {
	return $wpbc_time_slots_2_columns_hints_field(
		$field_id,
		'wizard_nav',
		array(
			'usage_key'      => 'wizard_nav',
			'direction'      => $direction,
			'target_step'    => $target_step,
			'label'          => $label,
			'name'           => $field_id,
			'cssclass_extra' => '',
			'html_id'        => '',
		)
	);
};

$wpbc_time_slots_2_columns_hints_options = array(
	array( 'label' => '10:00 AM - 10:30 AM', 'value' => '10:00 - 10:30', 'selected' => false ),
	array( 'label' => '10:30 AM - 11:00 AM', 'value' => '10:30 - 11:00', 'selected' => false ),
	array( 'label' => '11:00 AM - 11:30 AM', 'value' => '11:00 - 11:30', 'selected' => false ),
	array( 'label' => '11:30 AM - 12:00 PM', 'value' => '11:30 - 12:00', 'selected' => false ),
	array( 'label' => '12:00 PM - 12:30 PM', 'value' => '12:00 - 12:30', 'selected' => false ),
	array( 'label' => '12:30 PM - 1:00 PM', 'value' => '12:30 - 13:00', 'selected' => false ),
	array( 'label' => '1:00 PM - 1:30 PM', 'value' => '13:00 - 13:30', 'selected' => false ),
	array( 'label' => '1:30 PM - 2:00 PM', 'value' => '13:30 - 14:00', 'selected' => false ),
	array( 'label' => '2:00 PM - 2:30 PM', 'value' => '14:00 - 14:30', 'selected' => false ),
	array( 'label' => '2:30 PM - 3:00 PM', 'value' => '14:30 - 15:00', 'selected' => false ),
);

$wpbc_time_slots_2_columns_hints_left_section = $wpbc_time_slots_2_columns_hints_section(
	'section-41-1789044626610',
	array(
		$wpbc_time_slots_2_columns_hints_column(
			'100%',
			array(
				$wpbc_time_slots_2_columns_hints_static_text( 'static_text-2', 'Select a date', 'div',  true ),
				$wpbc_time_slots_2_columns_hints_static_text( 'static_text-14g-2', 'Choose a date for your booking.', 'small' ),
				$wpbc_time_slots_2_columns_hints_field(
					'calendar',
					'calendar',
					array(
						'usagenumber'         => 1,
						'resource_id'         => 1,
						'months'              => 1,
						'label'               => '',
						'min_width'           => '250px',
						'name'                => 'calendar',
						'wpbc-cal-init'       => 1,
						'wpbc-cal-loaded-rid' => 1,
					)
				),
			)
		),
	),
	'[{"ai":"flex-start","gap":"1em"}]'
);

$wpbc_time_slots_2_columns_hints_summary_section = $wpbc_time_slots_2_columns_hints_section(
	'section-43-1789044984832',
	array(
		$wpbc_time_slots_2_columns_hints_column(
			'31.3333%',
			array(
				$wpbc_time_slots_2_columns_hints_static_text( 'static-text-gvunt', 'Date:' ),
				$wpbc_time_slots_2_columns_hints_field(
					'check_in_date_hint',
					'check_in_date_hint',
					array(
						'prefix_text'   => '',
						'preview_value' => '11.11.2026',
						'help'          => '',
						'label'         => '',
						'name'          => 'check_in_date_hint',
						'html_id'       => '',
						'cssclass'      => '',
					)
				),
			)
		),
		$wpbc_time_slots_2_columns_hints_column(
			'31.3333%',
			array(
				$wpbc_time_slots_2_columns_hints_static_text( 'static_text-1cq', 'Start Time:' ),
				$wpbc_time_slots_2_columns_hints_field(
					'start_time_hint',
					'start_time_hint',
					array(
						'prefix_text'   => '',
						'preview_value' => '10:30',
						'help'          => '',
						'label'         => '',
						'name'          => 'start_time_hint',
						'html_id'       => '',
						'cssclass'      => '',
					)
				),
			)
		),
		$wpbc_time_slots_2_columns_hints_column(
			'31.3333%',
			array(
				$wpbc_time_slots_2_columns_hints_static_text( 'static-text-6hqau', 'End Time:' ),
				$wpbc_time_slots_2_columns_hints_field(
					'end_time_hint',
					'end_time_hint',
					array(
						'prefix_text'   => '',
						'preview_value' => '11:00',
						'help'          => '',
						'label'         => '',
						'name'          => 'end_time_hint',
						'html_id'       => '',
						'cssclass'      => '',
					)
				),
			)
		),
	),
	'[{}, {}, {}]'
);

$wpbc_time_slots_2_columns_hints_right_items = array(
	$wpbc_time_slots_2_columns_hints_section(
		'section-41-1789044626609',
		array(
			$wpbc_time_slots_2_columns_hints_column(
				'100%',
				array(
					$wpbc_time_slots_2_columns_hints_static_text( 'static-text-gee7w', 'Select a time', 'div', true ),
					$wpbc_time_slots_2_columns_hints_static_text( 'static-text-1d1cs', 'Choose an available time slot, then continue to enter your details.', 'small' ),
				)
			),
		),
		'[{"ai":"flex-start","gap":"1em"}]'
	),
	$wpbc_time_slots_2_columns_hints_summary_section,
	$wpbc_time_slots_2_columns_hints_section(
		'section-51-1789046793333',
		array(
			$wpbc_time_slots_2_columns_hints_column(
				'100%',
				array( $wpbc_time_slots_2_columns_hints_divider( 'divider_horizontal', 'horizontal' ) )
			),
		)
	),
	$wpbc_time_slots_2_columns_hints_section(
		'section-51-1789046793338',
		array(
			$wpbc_time_slots_2_columns_hints_column(
				'100%',
				array(
					$wpbc_time_slots_2_columns_hints_field(
						'rangetime',
						'rangetime',
						array(
							'usagenumber'     => 1,
							'min_width'       => '240px',
							'label'           => 'Time slots',
							'name'            => 'rangetime',
							'required'        => true,
							'options'         => $wpbc_time_slots_2_columns_hints_options,
							'gen_start_ampm_t' => '10:00',
							'gen_end_ampm_t'   => '15:00',
							'gen_step_m'       => 30,
						)
					),
				)
			),
		)
	),
);

$wpbc_time_slots_2_columns_hints_structure = array(
	array(
		'page'    => 1,
		'content' => array(
			$wpbc_time_slots_2_columns_hints_section(
				'section-50-1789046535765',
				array(
					$wpbc_time_slots_2_columns_hints_column( '42.456%', array( $wpbc_time_slots_2_columns_hints_left_section ) ),
					$wpbc_time_slots_2_columns_hints_column( '1.01987%', array( $wpbc_time_slots_2_columns_hints_divider( 'divider_vertical', 'vertical' ) ) ),
					$wpbc_time_slots_2_columns_hints_column( '50.5241%', $wpbc_time_slots_2_columns_hints_right_items ),
				),
				'[{}, {"aself":"stretch"}, {"gap":"10px","aself":"stretch"}]',
				'wpbc_bfb_time_slots_split_form'
			),
			$wpbc_time_slots_2_columns_hints_section(
				'section-21-1773063061362',
				array(
					$wpbc_time_slots_2_columns_hints_column(
						'100%',
						array(
							$wpbc_time_slots_2_columns_hints_section(
								'section-13-1773062424785',
								array(
									$wpbc_time_slots_2_columns_hints_column(
										'100%',
										array(
											$wpbc_time_slots_2_columns_hints_divider( 'divider_horizontal-2', 'horizontal' ),
											$wpbc_time_slots_2_columns_hints_nav( 'wizard_nav_next', 'next', 2, 'Next' ),
										)
									),
								),
								'[{"dir":"row","wrap":"wrap","jc":"flex-end","ai":"flex-end","gap":"10px","aself":"flex-end"}]'
							),
						)
					),
				)
			),
		),
	),
	array(
		'page'    => 2,
		'content' => array(
			$wpbc_time_slots_2_columns_hints_section(
				'section-45-1789045373792',
				array(
					$wpbc_time_slots_2_columns_hints_column(
						'48.5%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
								'text-firstname',
								'text',
								array(
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
					$wpbc_time_slots_2_columns_hints_column(
						'48.5%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
								'text-secondname',
								'text',
								array(
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
			$wpbc_time_slots_2_columns_hints_section(
				'section-25-1789147385669',
				array(
					$wpbc_time_slots_2_columns_hints_column(
						'48.5%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
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
					$wpbc_time_slots_2_columns_hints_column(
						'48.5%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
								'text',
								'text',
								array(
									'label'         => 'Phone',
									'name'          => 'phone',
									'cssclass'      => '',
									'html_id'       => '',
									'placeholder'   => '(000) 999 - 10 - 20',
									'default_value' => '',
									'help'          => 'Enter your contact phone number.',
								)
							),
						)
					),
				)
			),
			$wpbc_time_slots_2_columns_hints_section(
				'section-26-1789147425556',
				array(
					$wpbc_time_slots_2_columns_hints_column(
						'48.5%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
								'select',
								'select',
								array(
									'label'         => 'Adults',
									'name'          => 'adults',
									'min_width'     => '240px',
									'html_id'       => '',
									'cssclass'      => '',
									'placeholder'   => '--- Select ---',
									'options'       => array(
										array( 'label' => '1', 'value' => '1', 'selected' => false ),
										array( 'label' => '2', 'value' => '2', 'selected' => false ),
										array( 'label' => '3', 'value' => '3', 'selected' => false ),
										array( 'label' => '4', 'value' => '4', 'selected' => false ),
									),
									'value_differs' => false,
									'required'      => true,
									'help'          => 'Select the number of adults.',
								)
							),
						)
					),
					$wpbc_time_slots_2_columns_hints_column(
						'48.5%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
								'select-znu',
								'select',
								array(
									'label'         => 'Children',
									'name'          => 'children',
									'min_width'     => '240px',
									'html_id'       => '',
									'cssclass'      => '',
									'placeholder'   => '--- Select ---',
									'options'       => array(
										array( 'label' => '0', 'value' => '0', 'selected' => false ),
										array( 'label' => '1', 'value' => '1', 'selected' => false ),
										array( 'label' => '2', 'value' => '2', 'selected' => false ),
										array( 'label' => '3', 'value' => '3', 'selected' => false ),
									),
									'value_differs' => false,
								)
							),
						)
					),
				)
			),
			$wpbc_time_slots_2_columns_hints_section(
				'section-27-1789147429320',
				array(
					$wpbc_time_slots_2_columns_hints_column(
						'100%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
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
			$wpbc_time_slots_2_columns_hints_section(
				'section-29-1789147663718',
				array(
					$wpbc_time_slots_2_columns_hints_column(
						'100%',
						array(
							$wpbc_time_slots_2_columns_hints_field(
								'accept_terms',
								'accept_terms',
								array(
									'label'    => 'Accept Terms',
									'name'     => 'accept_terms',
									'required' => 1,
									'links'    => array(
										array(
											'key'         => 'terms',
											'text'        => 'terms',
											'link_type'   => 'url',
											'destination' => $wpbc_time_slots_2_columns_hints_terms_url,
											'target'      => '_blank',
											'cssclass'    => '',
										),
										array(
											'key'         => 'conditions',
											'text'        => 'conditions',
											'link_type'   => 'url',
											'destination' => $wpbc_time_slots_2_columns_hints_conditions_url,
											'target'      => '_blank',
											'cssclass'    => '',
										),
									),
								)
							),
						)
					),
				),
				'[{}]'
			),
			$wpbc_time_slots_2_columns_hints_section(
				'section-13-1773062424786',
				array(
					$wpbc_time_slots_2_columns_hints_column(
						'100%',
						array(
							$wpbc_time_slots_2_columns_hints_divider( 'divider_horizontal-3', 'horizontal' ),
							$wpbc_time_slots_2_columns_hints_nav( 'wizard_nav_back-2', 'back', 1, 'Back' ),
							$wpbc_time_slots_2_columns_hints_field(
								'submit',
								'submit',
								array(
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

$wpbc_time_slots_2_columns_hints_structure_json = function_exists( 'wp_json_encode' )
	? wp_json_encode( $wpbc_time_slots_2_columns_hints_structure )
	: json_encode( $wpbc_time_slots_2_columns_hints_structure );

$wpbc_time_slots_2_columns_hints_settings_json = '{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":""},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}';

$wpbc_time_slots_2_columns_hints_terms_url_html      = esc_url( $wpbc_time_slots_2_columns_hints_terms_url );
$wpbc_time_slots_2_columns_hints_conditions_url_html = esc_url( $wpbc_time_slots_2_columns_hints_conditions_url );

$wpbc_time_slots_2_columns_hints_advanced_form = trim(
<<<WPBC_BFB_TWO_COLUMN_TIME_SLOTS_ADVANCED_FORM
<div class="wpbc_bfb_form wpbc_wizard__border_container">
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step1">
		<r class="wpbc_bfb_time_slots_split_form" data-colstyles-active="1">
			<c style="flex-basis: 42.456%; --wpbc-col-min: 0px">
				<r data-colstyles-active="1">
					<c data-colstyles-active="1" style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-start; --wpbc-bfb-col-gap: 1em; --wpbc-col-min: 0px">
						<item><div name="static_text-2" class="wpbc_static_text" style="text-align:left;font-weight:bold">Select a date</div></item>
						<item><small name="static_text-14g-2" class="wpbc_static_text" style="text-align:left">Choose a date for your booking.</small></item>
						<item>[calendar]</item>
					</c>
				</r>
			</c>
			<c data-colstyles-active="1" style="flex-basis: 1.01987%; --wpbc-bfb-col-aself: stretch; --wpbc-col-min: 0px">
				<item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="vertical" style="margin:2px 2px 2px 2px; display:flex; align-self:stretch"><div name="divider_vertical" class="wpbc_bfb_divider wpbc_bfb_divider--v" role="separator" aria-orientation="vertical" style="border-left:1px solid #e0e0e0; height:100%; padding-left:0; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);"></div></div></item>
			</c>
			<c data-colstyles-active="1" style="flex-basis: 50.5241%; --wpbc-bfb-col-gap: 10px; --wpbc-bfb-col-aself: stretch; --wpbc-col-min: 0px">
				<r data-colstyles-active="1">
					<c data-colstyles-active="1" style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-start; --wpbc-bfb-col-gap: 1em; --wpbc-col-min: 0px">
						<item><div name="static-text-gee7w" class="wpbc_static_text" style="text-align:left;font-weight:bold">Select a time</div></item>
						<item><small name="static-text-1d1cs" class="wpbc_static_text" style="text-align:left">Choose an available time slot, then continue to enter your details.</small></item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 31.3333%; --wpbc-col-min: 0px"><item><div name="static-text-gvunt" class="wpbc_static_text" style="text-align:left">Date:</div></item><item><strong>[check_in_date_hint]</strong></item></c>
					<c style="flex-basis: 31.3333%; --wpbc-col-min: 0px"><item><div name="static_text-1cq" class="wpbc_static_text" style="text-align:left">Start Time:</div></item><item><strong>[start_time_hint]</strong></item></c>
					<c style="flex-basis: 31.3333%; --wpbc-col-min: 0px"><item><div name="static-text-6hqau" class="wpbc_static_text" style="text-align:left">End Time:</div></item><item><strong>[end_time_hint]</strong></item></c>
				</r>
				<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div></item></c></r>
				<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><l>Time slots*</l><br>[selectbox* rangetime "10:00 AM - 10:30 AM@@10:00 - 10:30" "10:30 AM - 11:00 AM@@10:30 - 11:00" "11:00 AM - 11:30 AM@@11:00 - 11:30" "11:30 AM - 12:00 PM@@11:30 - 12:00" "12:00 PM - 12:30 PM@@12:00 - 12:30" "12:30 PM - 1:00 PM@@12:30 - 13:00" "1:00 PM - 1:30 PM@@13:00 - 13:30" "1:30 PM - 2:00 PM@@13:30 - 14:00" "2:00 PM - 2:30 PM@@14:00 - 14:30" "2:30 PM - 3:00 PM@@14:30 - 15:00"]</item></c></r>
			</c>
		</r>
		<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><r data-colstyles-active="1"><c data-colstyles-active="1" style="flex-basis: 100%; --wpbc-bfb-col-dir: row; --wpbc-bfb-col-wrap: wrap; --wpbc-bfb-col-jc: flex-end; --wpbc-bfb-col-ai: flex-end; --wpbc-bfb-col-gap: 10px; --wpbc-bfb-col-aself: flex-end; --wpbc-col-min: 0px"><item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-2" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div></item><item><a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_2">Next</a></item></c></r></c></r>
	</div>
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step2 wpbc_wizard_step_hidden" style="display:none;clear:both;">
		<r>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>First Name*</l><br>[text* firstname class:firstname placeholder:"Example: 'John'"]<div class="wpbc_field_description">Enter your first name.</div></item></c>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>Last Name*</l><br>[text* secondname class:secondname class:lastname placeholder:"Example: 'Smith'"]<div class="wpbc_field_description">Enter your last name.</div></item></c>
		</r>
		<r>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>Email*</l><br>[email* email]<div class="wpbc_field_description">Enter your email address.</div></item></c>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>Phone</l><br>[text phone placeholder:"(000) 999 - 10 - 20"]<div class="wpbc_field_description">Enter your contact phone number.</div></item></c>
		</r>
		<r>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>Adults*</l><br>[selectbox* adults "--- Select ---@@" "1" "2" "3" "4"]<div class="wpbc_field_description">Select the number of adults.</div></item></c>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>Children</l><br>[selectbox children "--- Select ---@@" "0" "1" "2" "3"]</item></c>
		</r>
		<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><l>Details</l><br>[textarea details]</item></c></r>
		<r><c style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-end; --wpbc-col-min: 0px"><item><p class="wpbc_row_inline wpdev-form-control-wrap "><l class="wpbc_inline_checkbox">[checkbox* accept_terms "I accept"] the <a href="{$wpbc_time_slots_2_columns_hints_terms_url_html}" target="_blank" rel="noopener noreferrer">terms</a> and <a href="{$wpbc_time_slots_2_columns_hints_conditions_url_html}" target="_blank" rel="noopener noreferrer">conditions</a></l></p></item></c></r>
		<r data-colstyles-active="1"><c data-colstyles-active="1" style="flex-basis: 100%; --wpbc-bfb-col-dir: row; --wpbc-bfb-col-wrap: wrap; --wpbc-bfb-col-jc: flex-end; --wpbc-bfb-col-ai: flex-end; --wpbc-bfb-col-gap: 10px; --wpbc-bfb-col-aself: flex-end; --wpbc-col-min: 0px"><item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-3" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div></item><item><a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_1">Back</a></item><item><span class="wpbc_bfb__btn wpbc_bfb__btn--primary" style="flex:1;">[submit "Send"]</span></item></c></r>
	</div>
</div>
WPBC_BFB_TWO_COLUMN_TIME_SLOTS_ADVANCED_FORM
);

$wpbc_time_slots_2_columns_hints_content_form = trim(
<<<'WPBC_BFB_TWO_COLUMN_TIME_SLOTS_CONTENT_FORM'
<div class="standard-content-form">
	<b>Date</b>: <f>[check_in_date_hint]</f><br>
	<b>Start Time</b>: <f>[start_time_hint]</f><br>
	<b>End Time</b>: <f>[end_time_hint]</f><br>
	<b>Time slots</b>: <f>[rangetime]</f><br>
	<b>First Name</b>: <f>[firstname]</f><br>
	<b>Last Name</b>: <f>[secondname]</f><br>
	<b>Email</b>: <f>[email]</f><br>
	<b>Phone</b>: <f>[phone]</f><br>
	<b>Adults</b>: <f>[adults]</f><br>
	<b>Children</b>: <f>[children]</f><br>
	<b>Details</b>: <f>[details]</f><br>
	<b>Accept Terms</b>: <f>[accept_terms]</f><br>
</div>
WPBC_BFB_TWO_COLUMN_TIME_SLOTS_CONTENT_FORM
);

return array(
	'template_key' => 'time_slots_2_columns_hints',
	'seed_version' => '11.8.1',
	'sync_mode'    => 'insert_only',
	'record'       => array(
		'form_slug'           => 'time_slots_2_columns_hints',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_time_slots_2_columns_hints_structure_json,
		'settings_json'       => $wpbc_time_slots_2_columns_hints_settings_json,
		'advanced_form'       => $wpbc_time_slots_2_columns_hints_advanced_form,
		'content_form'        => $wpbc_time_slots_2_columns_hints_content_form,
		'is_default'          => 0,
		'title'               => 'Time-Slots / 2 Columns / Time Summary',
		'description'         => 'A two-step time-slot booking form with a calendar, ten editable 30-minute choices, live date and times hints, guest counts, and customer details.',
		'picture_url'         => 'wp_booking_calendar__time-slots-booking-form-2-columns.png',
	),
);

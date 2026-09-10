<?php
/**
 * Bundled BFB template: Two-Column Full-Day Form with Date Summary.
 *
 * @package Booking Calendar
 * @since   11.8.0
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
$wpbc_dates_2_columns_hints_full_days_field = function ( $field_id, $field_type, $field_args ) {
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
$wpbc_dates_2_columns_hints_full_days_column = function ( $column_width, $column_items ) {
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
$wpbc_dates_2_columns_hints_full_days_section = function ( $section_id, $section_columns, $column_styles = '', $css_class = '' ) {
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

$wpbc_dates_2_columns_hints_full_days_terms_url      = esc_url_raw( home_url( '/terms/' ) );
$wpbc_dates_2_columns_hints_full_days_conditions_url = esc_url_raw( home_url( '/conditions/' ) );

$wpbc_dates_2_columns_hints_full_days_static_text = function ( $field_id, $text, $tag = 'div', $bold = false ) use ( $wpbc_dates_2_columns_hints_full_days_field ) {
	return $wpbc_dates_2_columns_hints_full_days_field(
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

$wpbc_dates_2_columns_hints_full_days_divider = function ( $field_id, $orientation ) use ( $wpbc_dates_2_columns_hints_full_days_field ) {
	$is_vertical = 'vertical' === $orientation;

	return $wpbc_dates_2_columns_hints_full_days_field(
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

$wpbc_dates_2_columns_hints_full_days_left_section = $wpbc_dates_2_columns_hints_full_days_section(
	'section-41-1789044626610',
	array(
		$wpbc_dates_2_columns_hints_full_days_column(
			'100%',
			array(
				$wpbc_dates_2_columns_hints_full_days_static_text( 'static_text-2', 'Select dates', 'h1', true ),
				$wpbc_dates_2_columns_hints_full_days_static_text( 'static_text-14g-2', 'Choose your check-in and check-out dates.', 'small' ),
				$wpbc_dates_2_columns_hints_full_days_field(
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

$wpbc_dates_2_columns_hints_full_days_summary_section = $wpbc_dates_2_columns_hints_full_days_section(
	'section-43-1789044984832',
	array(
		$wpbc_dates_2_columns_hints_full_days_column(
			'37.7838%',
			array(
				$wpbc_dates_2_columns_hints_full_days_static_text( 'static-text-gvunt', 'Check-in:' ),
				$wpbc_dates_2_columns_hints_full_days_field(
					'check_in_date_hint',
					'check_in_date_hint',
					array(
						'prefix_text'   => '',
						'preview_value' => '17.09.2026',
						'help'          => '',
						'label'         => '',
						'name'          => 'check_in_date_hint',
						'html_id'       => '',
						'cssclass'      => '',
					)
				),
			)
		),
		$wpbc_dates_2_columns_hints_full_days_column(
			'38.7429%',
			array(
				$wpbc_dates_2_columns_hints_full_days_static_text( 'static_text-1cq', 'Check-out:' ),
				$wpbc_dates_2_columns_hints_full_days_field(
					'check_out_date_hint',
					'check_out_date_hint',
					array(
						'prefix_text'   => '',
						'preview_value' => '19.09.2026',
						'help'          => '',
						'label'         => '',
						'name'          => 'check_out_date_hint',
						'html_id'       => '',
						'cssclass'      => '',
					)
				),
			)
		),
		$wpbc_dates_2_columns_hints_full_days_column(
			'17.4733%',
			array(
				$wpbc_dates_2_columns_hints_full_days_static_text( 'static-text-6hqau', 'Days:' ),
				$wpbc_dates_2_columns_hints_full_days_field(
					'days_number_hint',
					'days_number_hint',
					array(
						'prefix_text'   => '',
						'preview_value' => 3,
						'help'          => '',
						'label'         => '',
						'name'          => 'days_number_hint',
						'html_id'       => '',
						'cssclass'      => '',
					)
				),
			)
		),
	),
	'[{}, {}, {}]'
);

$wpbc_dates_2_columns_hints_full_days_right_items = array(
	$wpbc_dates_2_columns_hints_full_days_section(
		'section-41-1789044626609',
		array(
			$wpbc_dates_2_columns_hints_full_days_column(
				'100%',
				array(
					$wpbc_dates_2_columns_hints_full_days_static_text( 'static-text-gee7w', 'Your booking', 'h1', true ),
					$wpbc_dates_2_columns_hints_full_days_static_text( 'static-text-1d1cs', 'Review your dates and enter your details.', 'small' ),
				)
			),
		),
		'[{"ai":"flex-start","gap":"1em"}]'
	),
	$wpbc_dates_2_columns_hints_full_days_summary_section,
	$wpbc_dates_2_columns_hints_full_days_section(
		'section-51-1789046793333',
		array(
			$wpbc_dates_2_columns_hints_full_days_column(
				'100%',
				array( $wpbc_dates_2_columns_hints_full_days_divider( 'divider_horizontal', 'horizontal' ) )
			),
		)
	),
	$wpbc_dates_2_columns_hints_full_days_section(
		'section-45-1789045373792',
		array(
			$wpbc_dates_2_columns_hints_full_days_column(
				'48.5%',
				array(
					$wpbc_dates_2_columns_hints_full_days_field(
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
			$wpbc_dates_2_columns_hints_full_days_column(
				'48.5%',
				array(
					$wpbc_dates_2_columns_hints_full_days_field(
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
	$wpbc_dates_2_columns_hints_full_days_section(
		'section-51-1789046793338',
		array(
			$wpbc_dates_2_columns_hints_full_days_column(
				'100%',
				array(
					$wpbc_dates_2_columns_hints_full_days_field(
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
		)
	),
	$wpbc_dates_2_columns_hints_full_days_section(
		'section-51-1789046793337',
		array(
			$wpbc_dates_2_columns_hints_full_days_column(
				'100%',
				array(
					$wpbc_dates_2_columns_hints_full_days_field(
						'text',
						'text',
						array(
							'label'         => 'Phone',
							'name'          => 'phone',
							'cssclass'      => '',
							'html_id'       => '',
							'placeholder'   => '(000)  999 - 10 - 20',
							'default_value' => '',
							'help'          => 'Enter your contact phone number.',
						)
					),
				)
			),
		)
	),
	$wpbc_dates_2_columns_hints_full_days_section(
		'section-51-1789046793336',
		array(
			$wpbc_dates_2_columns_hints_full_days_column(
				'100%',
				array(
					$wpbc_dates_2_columns_hints_full_days_field(
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
	$wpbc_dates_2_columns_hints_full_days_section(
		'section-51-1789046793335',
		array(
			$wpbc_dates_2_columns_hints_full_days_column(
				'100%',
				array(
					$wpbc_dates_2_columns_hints_full_days_field(
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
									'destination' => $wpbc_dates_2_columns_hints_full_days_terms_url,
									'target'      => '_blank',
									'cssclass'    => '',
								),
								array(
									'key'         => 'conditions',
									'text'        => 'conditions',
									'link_type'   => 'url',
									'destination' => $wpbc_dates_2_columns_hints_full_days_conditions_url,
									'target'      => '_blank',
									'cssclass'    => '',
								),
							),
						)
					),
				)
			),
		)
	),
);

$wpbc_dates_2_columns_hints_full_days_structure = array(
	array(
		'page'    => 1,
		'content' => array(
			$wpbc_dates_2_columns_hints_full_days_section(
				'section-50-1789046535765',
				array(
					$wpbc_dates_2_columns_hints_full_days_column( '47%', array( $wpbc_dates_2_columns_hints_full_days_left_section ) ),
					$wpbc_dates_2_columns_hints_full_days_column( '1.2038%', array( $wpbc_dates_2_columns_hints_full_days_divider( 'divider_vertical', 'vertical' ) ) ),
					$wpbc_dates_2_columns_hints_full_days_column( '45.7962%', $wpbc_dates_2_columns_hints_full_days_right_items ),
				),
				'[{}, {"aself":"stretch"}, {"jc":"space-between","gap":"10px","aself":"stretch"}]',
				'wpbc_bfb_full_day_split_form'
			),
			$wpbc_dates_2_columns_hints_full_days_section(
				'section-21-1773063061362',
				array(
					$wpbc_dates_2_columns_hints_full_days_column(
						'100%',
						array(
							$wpbc_dates_2_columns_hints_full_days_section(
								'section-13-1773062424785',
								array(
									$wpbc_dates_2_columns_hints_full_days_column(
										'100%',
										array(
											$wpbc_dates_2_columns_hints_full_days_divider( 'divider_horizontal-2', 'horizontal' ),
											$wpbc_dates_2_columns_hints_full_days_field(
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
						)
					),
				)
			),
		),
	),
);

$wpbc_dates_2_columns_hints_full_days_structure_json = function_exists( 'wp_json_encode' )
	? wp_json_encode( $wpbc_dates_2_columns_hints_full_days_structure )
	: json_encode( $wpbc_dates_2_columns_hints_full_days_structure );

$wpbc_dates_2_columns_hints_full_days_settings_json = '{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":""},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}';

$wpbc_dates_2_columns_hints_full_days_terms_url_html      = esc_url( $wpbc_dates_2_columns_hints_full_days_terms_url );
$wpbc_dates_2_columns_hints_full_days_conditions_url_html = esc_url( $wpbc_dates_2_columns_hints_full_days_conditions_url );

$wpbc_dates_2_columns_hints_full_days_advanced_form = trim(
<<<WPBC_BFB_TWO_COLUMN_FULL_DAY_ADVANCED_FORM
<div class="wpbc_bfb_form wpbc_wizard__border_container">
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step1">
		<r class="wpbc_bfb_full_day_split_form" data-colstyles-active="1">
			<c style="flex-basis: 47%; --wpbc-col-min: 0px">
				<r data-colstyles-active="1">
					<c data-colstyles-active="1" style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-start; --wpbc-bfb-col-gap: 1em; --wpbc-col-min: 0px">
						<item><h1 name="static_text-2" class="wpbc_static_text" style="text-align:left;font-weight:bold">Select dates</h1></item>
						<item><small name="static_text-14g-2" class="wpbc_static_text" style="text-align:left">Choose your check-in and check-out dates.</small></item>
						<item>[calendar]</item>
					</c>
				</r>
			</c>
			<c data-colstyles-active="1" style="flex-basis: 1.2038%; --wpbc-bfb-col-aself: stretch; --wpbc-col-min: 0px">
				<item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="vertical" style="margin:2px 2px 2px 2px; display:flex; align-self:stretch"><div name="divider_vertical" class="wpbc_bfb_divider wpbc_bfb_divider--v" role="separator" aria-orientation="vertical" style="border-left:1px solid #e0e0e0; height:100%; padding-left:0; position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);"></div></div></item>
			</c>
			<c data-colstyles-active="1" style="flex-basis: 45.7962%; --wpbc-bfb-col-jc: space-between; --wpbc-bfb-col-gap: 10px; --wpbc-bfb-col-aself: stretch; --wpbc-col-min: 0px">
				<r data-colstyles-active="1">
					<c data-colstyles-active="1" style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-start; --wpbc-bfb-col-gap: 1em; --wpbc-col-min: 0px">
						<item><h1 name="static-text-gee7w" class="wpbc_static_text" style="text-align:left;font-weight:bold">Your booking</h1></item>
						<item><small name="static-text-1d1cs" class="wpbc_static_text" style="text-align:left">Review your dates and enter your details.</small></item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 37.7838%; --wpbc-col-min: 0px">
						<item><div name="static-text-gvunt" class="wpbc_static_text" style="text-align:left">Check-in:</div></item>
						<item><strong>[check_in_date_hint]</strong></item>
					</c>
					<c style="flex-basis: 38.7429%; --wpbc-col-min: 0px">
						<item><div name="static_text-1cq" class="wpbc_static_text" style="text-align:left">Check-out:</div></item>
						<item><strong>[check_out_date_hint]</strong></item>
					</c>
					<c style="flex-basis: 17.4733%; --wpbc-col-min: 0px">
						<item><div name="static-text-6hqau" class="wpbc_static_text" style="text-align:left">Days:</div></item>
						<item><strong>[days_number_hint]</strong></item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div></item></c>
				</r>
				<r>
					<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>First Name*</l><br>[text* firstname class:firstname placeholder:"Example: 'John'"]<div class="wpbc_field_description">Enter your first name.</div></item></c>
					<c style="flex-basis: 48.5%; --wpbc-col-min: 0px"><item><l>Last Name*</l><br>[text* secondname class:secondname class:lastname placeholder:"Example: 'Smith'"]<div class="wpbc_field_description">Enter your last name.</div></item></c>
				</r>
				<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><l>Email*</l><br>[email* email]<div class="wpbc_field_description">Enter your email address.</div></item></c></r>
				<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><l>Phone</l><br>[text phone placeholder:"(000)  999 - 10 - 20"]<div class="wpbc_field_description">Enter your contact phone number.</div></item></c></r>
				<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><l>Details</l><br>[textarea details]</item></c></r>
				<r><c style="flex-basis: 100%; --wpbc-col-min: 0px"><item><p class="wpbc_row_inline wpdev-form-control-wrap "><l class="wpbc_inline_checkbox">[checkbox* accept_terms "I accept"] the <a href="{$wpbc_dates_2_columns_hints_full_days_terms_url_html}" target="_blank" rel="noopener noreferrer">terms</a> and <a href="{$wpbc_dates_2_columns_hints_full_days_conditions_url_html}" target="_blank" rel="noopener noreferrer">conditions</a></l></p></item></c></r>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-col-min: 0px">
				<r data-colstyles-active="1">
					<c data-colstyles-active="1" style="flex-basis: 100%; --wpbc-bfb-col-dir: row; --wpbc-bfb-col-wrap: wrap; --wpbc-bfb-col-jc: flex-end; --wpbc-bfb-col-ai: flex-end; --wpbc-bfb-col-gap: 10px; --wpbc-bfb-col-aself: flex-end; --wpbc-col-min: 0px">
						<item><div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-2" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div></item>
						<item><span class="wpbc_bfb__btn wpbc_bfb__btn--primary" style="flex:1;">[submit "Send"]</span></item>
					</c>
				</r>
			</c>
		</r>
	</div>
</div>
WPBC_BFB_TWO_COLUMN_FULL_DAY_ADVANCED_FORM
);

$wpbc_dates_2_columns_hints_full_days_content_form = trim(
<<<'WPBC_BFB_TWO_COLUMN_FULL_DAY_CONTENT_FORM'
<div class="standard-content-form">
	<b>Check-in</b>: <f>[check_in_date_hint]</f><br>
	<b>Check-out</b>: <f>[check_out_date_hint]</f><br>
	<b>Days</b>: <f>[days_number_hint]</f><br>
	<b>First Name</b>: <f>[firstname]</f><br>
	<b>Last Name</b>: <f>[secondname]</f><br>
	<b>Email</b>: <f>[email]</f><br>
	<b>Phone</b>: <f>[phone]</f><br>
	<b>Details</b>: <f>[details]</f><br>
	<b>Accept Terms</b>: <f>[accept_terms]</f><br>
</div>
WPBC_BFB_TWO_COLUMN_FULL_DAY_CONTENT_FORM
);

return array(
	'template_key' => 'dates_2_columns_hints_full_days',
	'seed_version' => '11.8.0',
	'sync_mode'    => 'insert_only',
	'record'       => array(
		'form_slug'           => 'dates_2_columns_hints_full_days',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_dates_2_columns_hints_full_days_structure_json,
		'settings_json'       => $wpbc_dates_2_columns_hints_full_days_settings_json,
		'advanced_form'       => $wpbc_dates_2_columns_hints_full_days_advanced_form,
		'content_form'        => $wpbc_dates_2_columns_hints_full_days_content_form,
		'is_default'          => 0,
		'title'               => 'Full-Day / 2 Columns / Date Summary',
		'description'         => 'A clear two-column booking form with a calendar, check-in, check-out, and day summary beside customer details. Designed for full day (full-days) and changeover bookings.',
		'picture_url'         => 'wp_booking_calendar__form_2_columns_hints_full_days.png',
	),
);

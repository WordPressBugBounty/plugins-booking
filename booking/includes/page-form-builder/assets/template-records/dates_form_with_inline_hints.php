<?php
/**
 * Bundled BFB template: Full-Day Standard Form with Inline Hints.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/assets/template-records/dates_form_with_inline_hints.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
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
$wpbc_dates_form_with_inline_hints_field = function ( $field_id, $field_type, $field_args ) {
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
$wpbc_dates_form_with_inline_hints_column = function ( $column_width, $column_items ) {
	return array(
		'width' => $column_width,
		'items' => $column_items,
	);
};

/**
 * Build one section record for the bundled template structure.
 *
 * @param string $section_id     Stable section instance ID.
 * @param array  $section_columns Ordered column records.
 * @param string $column_styles  Serialized Form Builder column styles.
 *
 * @return array Form Builder section record.
 */
$wpbc_dates_form_with_inline_hints_section = function ( $section_id, $section_columns, $column_styles = '' ) {
	return array(
		'type' => 'section',
		'data' => array(
			'id'         => $section_id,
			'label'      => 'Section',
			'html_id'    => '',
			'cssclass'   => '',
			'col_styles' => $column_styles,
			'columns'    => $section_columns,
		),
	);
};

$wpbc_dates_form_with_inline_hints_calendar = $wpbc_dates_form_with_inline_hints_field(
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
);

$wpbc_dates_form_with_inline_hints_divider = $wpbc_dates_form_with_inline_hints_field(
	'divider_horizontal',
	'divider',
	array(
		'usage_key'        => 'divider',
		'orientation'      => 'horizontal',
		'line_style'       => 'solid',
		'thickness_px'     => 1,
		'length'           => '100%',
		'align'            => 'center',
		'color'            => '#e0e0e0',
		'label'            => 'Divider_horizontal',
		'name'             => 'divider_horizontal',
		'margin_top_px'    => 2,
		'margin_bottom_px' => 2,
		'margin_left_px'   => 2,
		'margin_right_px'  => 2,
		'cssclass_extra'   => '',
		'html_id'          => '',
	)
);

$wpbc_dates_form_with_inline_hints_details_divider = $wpbc_dates_form_with_inline_hints_field(
	'divider_horizontal-jvg',
	'divider',
	array(
		'usage_key'        => 'divider',
		'orientation'      => 'horizontal',
		'line_style'       => 'solid',
		'thickness_px'     => 1,
		'length'           => '100%',
		'align'            => 'center',
		'color'            => '#e0e0e0',
		'label'            => 'Divider_horizontal',
		'name'             => 'divider_horizontal-jvg',
		'margin_top_px'    => 2,
		'margin_bottom_px' => 2,
		'margin_left_px'   => 2,
		'margin_right_px'  => 2,
		'cssclass_extra'   => '',
		'html_id'          => '',
	)
);

$wpbc_dates_form_with_inline_hints_submit_divider = $wpbc_dates_form_with_inline_hints_field(
	'divider_horizontal-2',
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
		'name'             => 'divider_horizontal-2',
		'margin_top_px'    => 2,
		'margin_bottom_px' => 2,
		'margin_left_px'   => 2,
		'margin_right_px'  => 2,
		'cssclass_extra'   => '',
		'html_id'          => '',
	)
);

$wpbc_dates_form_with_inline_hints_structure = array(
	array(
		'page'    => 1,
		'content' => array(
			$wpbc_dates_form_with_inline_hints_calendar,
			$wpbc_dates_form_with_inline_hints_divider,
			$wpbc_dates_form_with_inline_hints_section(
				'section-11-1773137021920',
				array(
					$wpbc_dates_form_with_inline_hints_column(
						'31.3333%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
								'check_in_date_hint',
								'check_in_date_hint',
								array(
									'prefix_text'   => 'Check-in:',
									'preview_value' => 'August 29, 2026',
									'help'          => '',
									'label'         => 'Check-in:',
									'name'          => 'check_in_date_hint',
									'html_id'       => '',
									'cssclass'      => '',
								)
							),
						)
					),
					$wpbc_dates_form_with_inline_hints_column(
						'37.4586%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
								'check_out_date_hint',
								'check_out_date_hint',
								array(
									'prefix_text'   => 'Check-out:',
									'preview_value' => 'August 31, 2026',
									'help'          => '',
									'label'         => 'Check-out:',
									'name'          => 'check_out_date_hint',
									'html_id'       => '',
									'cssclass'      => '',
								)
							),
						)
					),
					$wpbc_dates_form_with_inline_hints_column(
						'25.208%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
								'days_number_hint',
								'days_number_hint',
								array(
									'prefix_text'   => 'Days:',
									'preview_value' => 3,
									'help'          => '',
									'label'         => 'Days:',
									'name'          => 'days_number_hint',
									'html_id'       => '',
									'cssclass'      => '',
								)
							),
						)
					),
				),
				'[{"gap":"20px"},{"ai":"center","gap":"20px"},{"ai":"flex-end"}]'
			),
			$wpbc_dates_form_with_inline_hints_details_divider,
			$wpbc_dates_form_with_inline_hints_section(
				'section-22-1787391801182',
				array(
					$wpbc_dates_form_with_inline_hints_column(
						'48.5%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
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
					$wpbc_dates_form_with_inline_hints_column(
						'48.5%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
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
			$wpbc_dates_form_with_inline_hints_section(
				'section-16-1773062802362',
				array(
					$wpbc_dates_form_with_inline_hints_column(
						'48.5%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
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
					$wpbc_dates_form_with_inline_hints_column(
						'48.5%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
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
			$wpbc_dates_form_with_inline_hints_section(
				'section-17-1773062914950',
				array(
					$wpbc_dates_form_with_inline_hints_column(
						'100%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
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
			$wpbc_dates_form_with_inline_hints_section(
				'section-21-1773063061362',
				array(
					$wpbc_dates_form_with_inline_hints_column(
						'100%',
						array(
							$wpbc_dates_form_with_inline_hints_field(
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
							),
							$wpbc_dates_form_with_inline_hints_section(
								'section-13-1773062424785',
								array(
									$wpbc_dates_form_with_inline_hints_column(
										'100%',
										array(
											$wpbc_dates_form_with_inline_hints_submit_divider,
											$wpbc_dates_form_with_inline_hints_field(
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

$wpbc_dates_form_with_inline_hints_structure_json = function_exists( 'wp_json_encode' )
	? wp_json_encode( $wpbc_dates_form_with_inline_hints_structure )
	: false;

if ( ! $wpbc_dates_form_with_inline_hints_structure_json ) {
	$wpbc_dates_form_with_inline_hints_structure_json = json_encode( $wpbc_dates_form_with_inline_hints_structure );
}

$wpbc_dates_form_with_inline_hints_settings_json = '{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":""},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}';

$wpbc_dates_form_with_inline_hints_advanced_form = trim(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_FORM'
<div class="wpbc_bfb_form wpbc_wizard__border_container">
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step1">
		<item>
			[calendar]
		</item>
		<item>
			<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
		</item>
		<r>
			<c style="flex-basis: 31.3333%; --wpbc-bfb-col-gap: 20px; --wpbc-col-min: 0px">
				<item>Check-in:&nbsp;<strong>[check_in_date_hint]</strong></item>
			</c>
			<c style="flex-basis: 37.4586%; --wpbc-bfb-col-ai: center; --wpbc-bfb-col-gap: 20px; --wpbc-col-min: 0px">
				<item>Check-out:&nbsp;<strong>[check_out_date_hint]</strong></item>
			</c>
			<c style="flex-basis: 25.208%; --wpbc-bfb-col-ai: flex-end; --wpbc-col-min: 0px">
				<item>Days:&nbsp;<strong>[days_number_hint]</strong></item>
			</c>
		</r>
		<item>
			<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-jvg" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
		</item>
		<r>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px">
				<item>
					<l>First Name*</l>
					<br>[text* firstname class:firstname placeholder:"Example: 'John'"]
					<div class="wpbc_field_description">Enter your first name.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px">
				<item>
					<l>Last Name*</l>
					<br>[text* secondname class:secondname class:lastname placeholder:"Example: 'Smith'"]
					<div class="wpbc_field_description">Enter your last name.</div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px">
				<item>
					<l>Email*</l>
					<br>[email* email]
					<div class="wpbc_field_description">Enter your email address.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px">
				<item>
					<l>Phone</l>
					<br>[text phone placeholder:"(000)  999 - 10 - 20"]
					<div class="wpbc_field_description">Enter contact phone number</div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-col-min: 0px">
				<item>
					<l>Details</l>
					<br>[textarea details]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-col-min: 0px">
				<item>
					<p class="wpbc_row_inline wpdev-form-control-wrap ">
						<l class="wpbc_inline_checkbox">[checkbox* accept_terms "I accept"] the <a href="https://server.com/terms/" target="_blank" rel="noopener noreferrer">terms</a> and <a href="https://server.com/conditions/" target="_blank" rel="noopener noreferrer">conditions</a></l>
					</p>
				</item>
				<r>
					<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row; --wpbc-bfb-col-wrap: wrap; --wpbc-bfb-col-jc: flex-end; --wpbc-bfb-col-ai: flex-end; --wpbc-bfb-col-gap: 10px; --wpbc-bfb-col-aself: flex-end; --wpbc-col-min: 0px">
						<item>
							<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-2" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
						</item>
						<item>
							<span class="wpbc_bfb__btn wpbc_bfb__btn--primary" style="flex:1;">[submit "Send"]</span>
						</item>
					</c>
				</r>
			</c>
		</r>
	</div>
</div>
WPBC_BFB_TEMPLATE_ADVANCED_FORM
);

$wpbc_dates_form_with_inline_hints_content_form = trim(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
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
WPBC_BFB_TEMPLATE_CONTENT_FORM
);

return array(
	'template_key' => 'dates_form_with_inline_hints',
	'seed_version' => '11.6.0',
	'sync_mode'    => 'insert_only',
	'record'       => array(
		'form_slug'           => 'dates_form_with_inline_hints',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_dates_form_with_inline_hints_structure_json,
		'settings_json'       => $wpbc_dates_form_with_inline_hints_settings_json,
		'advanced_form'       => $wpbc_dates_form_with_inline_hints_advanced_form,
		'content_form'        => $wpbc_dates_form_with_inline_hints_content_form,
		'is_default'          => 0,
		'title'               => 'Full-Day / Standard Form with Inline Hints',
		'description'         => 'Single-page full-day booking form with the calendar first, live check-in, check-out, and day-count hints, compact customer details, terms acceptance, and a clear submit action.',
		'picture_url'         => 'dates_form_with_inline_hints_01.png',
	),
);

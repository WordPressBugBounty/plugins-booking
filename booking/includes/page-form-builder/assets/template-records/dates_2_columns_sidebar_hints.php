<?php
/**
 * Bundled BFB template: Two-Column Dates Form with Sidebar Hints.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/assets/template-records/dates_2_columns_sidebar_hints.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

$wpbc_dates_2_columns_sidebar_hints_field = function ( $id, $type, $args ) {
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

$wpbc_dates_2_columns_sidebar_hints_column = function ( $width, $items ) {
	return array(
		'width' => $width,
		'items' => $items,
	);
};

$wpbc_dates_2_columns_sidebar_hints_section = function ( $id, $columns, $col_styles = '' ) {
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

$wpbc_dates_2_columns_sidebar_hints_is_free = ! class_exists( 'wpdev_bk_biz_m' );

$wpbc_dates_2_columns_sidebar_hints_calendar = $wpbc_dates_2_columns_sidebar_hints_field(
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
);

$wpbc_dates_2_columns_sidebar_hints_divider = $wpbc_dates_2_columns_sidebar_hints_field(
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

$wpbc_dates_2_columns_sidebar_hints_submit_divider = $wpbc_dates_2_columns_sidebar_hints_field(
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

$wpbc_dates_2_columns_sidebar_hints_left_items = array( $wpbc_dates_2_columns_sidebar_hints_calendar );

if ( $wpbc_dates_2_columns_sidebar_hints_is_free ) {
	$wpbc_dates_2_columns_sidebar_hints_left_items[] = $wpbc_dates_2_columns_sidebar_hints_divider;
	$wpbc_dates_2_columns_sidebar_hints_left_items[] = $wpbc_dates_2_columns_sidebar_hints_field(
		'selected_dates_hint',
		'selected_dates_hint',
		array(
			'prefix_text' => 'Dates:',
			'help'        => '',
			'label'       => 'Dates:',
			'name'        => 'selected_dates_hint',
			'html_id'     => '',
			'cssclass'    => '',
		)
	);
} else {
	$wpbc_dates_2_columns_sidebar_hints_left_items[] = $wpbc_dates_2_columns_sidebar_hints_field(
		'capacity_hint',
		'capacity_hint',
		array(
			'prefix_text'   => 'Availability:',
			'preview_value' => 4,
			'help'          => '',
			'label'         => 'Availability:',
			'name'          => 'capacity_hint',
			'html_id'       => '',
			'cssclass'      => '',
		)
	);
	$wpbc_dates_2_columns_sidebar_hints_left_items[] = $wpbc_dates_2_columns_sidebar_hints_divider;
	$wpbc_dates_2_columns_sidebar_hints_left_items[] = $wpbc_dates_2_columns_sidebar_hints_field(
		'bookingresource_info_hint',
		'bookingresource_info_hint',
		array(
			'prefix_text'   => 'Resource:',
			'resource_show' => 'title',
			'help'          => '',
			'label'         => 'Resource:',
			'name'          => 'bookingresource_info_hint',
			'html_id'       => '',
			'cssclass'      => '',
		)
	);
	$wpbc_dates_2_columns_sidebar_hints_left_items[] = $wpbc_dates_2_columns_sidebar_hints_field(
		'selected_short_timedates_hint',
		'selected_short_timedates_hint',
		array(
			'prefix_text'   => 'Dates:',
			'preview_value' => '17 May 2026 14:00 - 19 May 2026 12:00',
			'help'          => '',
			'label'         => 'Dates:',
			'name'          => 'selected_short_timedates_hint',
			'html_id'       => '',
			'cssclass'      => '',
		)
	);
	$wpbc_dates_2_columns_sidebar_hints_left_items[] = $wpbc_dates_2_columns_sidebar_hints_field(
		'cost_hint',
		'cost_hint',
		array(
			'prefix_text'   => 'Total Cost:',
			'preview_value' => '$100.00',
			'help'          => '',
			'label'         => 'Total Cost:',
			'name'          => 'cost_hint',
			'html_id'       => '',
			'cssclass'      => '',
		)
	);
}

$wpbc_dates_2_columns_sidebar_hints_right_items = array(
	$wpbc_dates_2_columns_sidebar_hints_field(
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
	$wpbc_dates_2_columns_sidebar_hints_field(
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
	$wpbc_dates_2_columns_sidebar_hints_field(
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
	$wpbc_dates_2_columns_sidebar_hints_field(
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
	$wpbc_dates_2_columns_sidebar_hints_field(
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
	$wpbc_dates_2_columns_sidebar_hints_field(
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
	),
);

$wpbc_dates_2_columns_sidebar_hints_structure = array(
	array(
		'page'    => 1,
		'content' => array(
			$wpbc_dates_2_columns_sidebar_hints_section(
				'section-7-1773321976469',
				array(
					$wpbc_dates_2_columns_sidebar_hints_column( '48.5%', $wpbc_dates_2_columns_sidebar_hints_left_items ),
					$wpbc_dates_2_columns_sidebar_hints_column( '48.5%', $wpbc_dates_2_columns_sidebar_hints_right_items ),
				),
				'[{"gap":"20px"},{"gap":"33px"}]'
			),
			$wpbc_dates_2_columns_sidebar_hints_section(
				'section-13-1773062424785',
				array(
					$wpbc_dates_2_columns_sidebar_hints_column(
						'100%',
						array(
							$wpbc_dates_2_columns_sidebar_hints_submit_divider,
							$wpbc_dates_2_columns_sidebar_hints_field(
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

$wpbc_dates_2_columns_sidebar_hints_structure_json = function_exists( 'wp_json_encode' ) ? wp_json_encode( $wpbc_dates_2_columns_sidebar_hints_structure ) : false;
if ( ! $wpbc_dates_2_columns_sidebar_hints_structure_json ) {
	$wpbc_dates_2_columns_sidebar_hints_structure_json = json_encode( $wpbc_dates_2_columns_sidebar_hints_structure );
}

$wpbc_dates_2_columns_sidebar_hints_settings_json = '{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":""},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}';

$wpbc_dates_2_columns_sidebar_hints_left_advanced = $wpbc_dates_2_columns_sidebar_hints_is_free
	? <<<'WPBC_BFB_TEMPLATE_LEFT'
				<item>
					<l>Select Date</l>
					<br>[calendar]
				</item>
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
				</item>
				<item>
					Dates:&nbsp;<strong>[selected_dates_hint]</strong>
				</item>
WPBC_BFB_TEMPLATE_LEFT
	: <<<'WPBC_BFB_TEMPLATE_LEFT'
				<item>
					<l>Select Date</l>
					<br>[calendar]
				</item>
				<item>
					Availability:&nbsp;<strong>[capacity_hint]</strong>
				</item>
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
				</item>
				<item>
					Resource:&nbsp;<strong>[bookingresource_info_hint]</strong>
				</item>
				<item>
					Dates:&nbsp;<strong>[selected_short_timedates_hint]</strong>
				</item>
				<item>
					Total Cost:&nbsp;<strong>[cost_hint]</strong>
				</item>
WPBC_BFB_TEMPLATE_LEFT;

$wpbc_dates_2_columns_sidebar_hints_advanced_form = trim(
<<<WPBC_BFB_TEMPLATE_ADVANCED_FORM
<div class="wpbc_bfb_form">
	<r>
		<c style="flex-basis: 48.5%; --wpbc-bfb-col-gap: 20px; --wpbc-col-min: 0px">
{$wpbc_dates_2_columns_sidebar_hints_left_advanced}
		</c>
		<c style="flex-basis: 48.5%; --wpbc-bfb-col-gap: 33px; --wpbc-col-min: 0px">
			<item>
				<l>First Name*</l>
				<br>[text* firstname class:firstname placeholder:"Example: 'John'"]
				<div class="wpbc_field_description">Enter your first name.</div>
			</item>
			<item>
				<l>Last Name*</l>
				<br>[text* secondname class:secondname class:lastname placeholder:"Example: 'Smith'"]
				<div class="wpbc_field_description">Enter your last name.</div>
			</item>
			<item>
				<l>Email*</l>
				<br>[email* email]
				<div class="wpbc_field_description">Enter your email address.</div>
			</item>
			<item>
				<l>Phone</l>
				<br>[text phone placeholder:"(000)  999 - 10 - 20"]
				<div class="wpbc_field_description">Enter contact phone number</div>
			</item>
			<item>
				<l>Details</l>
				<br>[textarea details]
			</item>
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
				<span class="wpbc_bfb__btn wpbc_bfb__btn--primary" style="flex:1;">[submit "Send"]</span>
			</item>
		</c>
	</r>
</div>
WPBC_BFB_TEMPLATE_ADVANCED_FORM
);

$wpbc_dates_2_columns_sidebar_hints_content_form = $wpbc_dates_2_columns_sidebar_hints_is_free
	? trim(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class="standard-content-form">
	<b>Dates</b>: <f>[selected_dates_hint]</f><br>
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
	<b>Availability</b>: <f>[capacity_hint]</f><br>
	<b>Dates</b>: <f>[selected_short_timedates_hint]</f><br>
	<b>Total Cost</b>: <f>[cost_hint]</f><br>
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
	'template_key' => 'dates_2_columns_sidebar_hints',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only',
	'record'       => array(
		'form_slug'           => 'dates_2_columns_sidebar_hints',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_dates_2_columns_sidebar_hints_structure_json,
		'settings_json'       => $wpbc_dates_2_columns_sidebar_hints_settings_json,
		'advanced_form'       => $wpbc_dates_2_columns_sidebar_hints_advanced_form,
		'content_form'        => $wpbc_dates_2_columns_sidebar_hints_content_form,
		'is_default'          => 0,
		'title'               => 'Dates / 2 Columns / Sidebar Hints',
		'description'         => 'Two-column booking form with the calendar and live sidebar hints on the left, customer details on the right, and version-aware hint usage for Free and Pro editions.',
		'picture_url'         => 'dates_2_columns_sidebar_hints_01.png',
	),
);

<?php
/**
 * Bundled BFB template: Full-Days Booking Form (2 columns, 1 step).
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/save-load/template-records/template-full_days_calendar_next_to_form_1_step.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

$wpbc_full_days_booking_form_2_columns_1_step_structure_json = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_STRUCTURE'
[{\"page\":1,\"content\":[{\"type\":\"section\",\"data\":{\"id\":\"section-7-1773321976469\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"[{},{\\\"gap\\\":\\\"33px\\\"}]\",\"columns\":[{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"calendar\",\"type\":\"calendar\",\"usage_key\":\"calendar\",\"usagenumber\":1,\"resource_id\":1,\"months\":1,\"label\":\"Select Date\",\"min_width\":\"250px\",\"name\":\"calendar\",\"wpbc-cal-init\":1,\"wpbc-cal-loaded-rid\":1}}]},{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"text-firstname\",\"type\":\"text\",\"usage_key\":\"text-firstname\",\"label\":\"First Name\",\"name\":\"firstname\",\"placeholder\":\"Example: \\\"John\\\"\",\"required\":1,\"help\":\"Enter your first name.\",\"cssclass\":\"firstname\",\"min_width\":\"8em\",\"html_id\":\"\"}},{\"type\":\"field\",\"data\":{\"id\":\"text-secondname\",\"type\":\"text\",\"usage_key\":\"text-secondname\",\"label\":\"Last Name\",\"name\":\"secondname\",\"placeholder\":\"Example: \\\"Smith\\\"\",\"required\":1,\"help\":\"Enter your last name.\",\"cssclass\":\"secondname lastname\",\"min_width\":\"8em\",\"html_id\":\"\"}},{\"type\":\"field\",\"data\":{\"id\":\"email\",\"type\":\"email\",\"usage_key\":\"email\",\"label\":\"Email\",\"usagenumber\":1,\"name\":\"email\",\"html_id\":\"\",\"cssclass\":\"\",\"required\":true,\"help\":\"Enter your email address.\"}},{\"type\":\"field\",\"data\":{\"id\":\"text\",\"type\":\"text\",\"usage_key\":\"text\",\"label\":\"Phone\",\"name\":\"phone\",\"cssclass\":\"\",\"html_id\":\"\",\"placeholder\":\"(000)  999 - 10 - 20\",\"help\":\"Enter contact phone number\"}},{\"type\":\"field\",\"data\":{\"id\":\"textarea\",\"type\":\"textarea\",\"usage_key\":\"textarea\",\"min_width\":\"260px\",\"label\":\"Details\",\"name\":\"details\",\"cssclass\":\"\",\"html_id\":\"\"}},{\"type\":\"field\",\"data\":{\"id\":\"accept_terms\",\"type\":\"accept_terms\",\"usage_key\":\"accept_terms\",\"label\":\"Accept Terms\",\"name\":\"accept_terms\",\"required\":1,\"links\":[{\"key\":\"terms\",\"text\":\"terms\",\"link_type\":\"url\",\"destination\":\"https://server.com/terms/\",\"target\":\"_blank\",\"cssclass\":\"\"},{\"key\":\"conditions\",\"text\":\"conditions\",\"link_type\":\"url\",\"destination\":\"https://server.com/conditions/\",\"target\":\"_blank\",\"cssclass\":\"\"}]}}]}]}},{\"type\":\"section\",\"data\":{\"id\":\"section-13-1773062424785\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"[{\\\"dir\\\":\\\"row\\\",\\\"wrap\\\":\\\"wrap\\\",\\\"jc\\\":\\\"flex-end\\\",\\\"ai\\\":\\\"flex-end\\\",\\\"gap\\\":\\\"10px\\\",\\\"aself\\\":\\\"flex-end\\\"}]\",\"columns\":[{\"width\":\"100%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"divider_horizontal-2\",\"type\":\"divider\",\"usage_key\":\"divider_horizontal\",\"orientation\":\"horizontal\",\"line_style\":\"solid\",\"thickness_px\":1,\"length\":\"100%\",\"align\":\"center\",\"color\":\"#e0e0e0\",\"label\":\"Divider_horizontal\",\"name\":\"divider_horizontal-2\",\"margin_top_px\":2,\"margin_bottom_px\":2,\"margin_left_px\":2,\"margin_right_px\":2,\"cssclass_extra\":\"\",\"html_id\":\"\"}},{\"type\":\"field\",\"data\":{\"id\":\"submit\",\"type\":\"submit\",\"usage_key\":\"submit\",\"usagenumber\":1,\"label\":\"Send\",\"name\":\"submit\",\"cssclass\":\"wpbc_bfb__btn wpbc_bfb__btn--primary\",\"html_id\":\"\"}}]}]}}]}]
WPBC_BFB_TEMPLATE_STRUCTURE
	)
);

$wpbc_full_days_booking_form_2_columns_1_step_settings_json = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_SETTINGS'
{\"options\":{\"booking_form_theme\":\"\",\"booking_form_layout_width\":\"100%\",\"booking_type_of_day_selections\":\"\"},\"css_vars\":[],\"bfb_options\":{\"advanced_mode_source\":\"builder\"}}
WPBC_BFB_TEMPLATE_SETTINGS
	)
);

$wpbc_full_days_booking_form_2_columns_1_step_advanced_form = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_FORM'
<div class=\"wpbc_bfb_form wpbc_wizard__border_container\">\n	<div class=\"wpbc_wizard_step wpbc__form__div wpbc_wizard_step1\">\n		<r>\n			<c style=\"flex-basis: 48.5%;--wpbc-col-min: 0px\">\n				<item>\n					<l>Select Date</l>\n					<br>[calendar]\n				</item>\n			</c>\n			<c style=\"flex-basis: 48.5%;--wpbc-bfb-col-gap: 33px;--wpbc-col-min: 0px\">\n				<item>\n					<l>First Name</l>\n					<br>[text* firstname class:firstname placeholder:\"Example: \'John\'\"]\n					<div class=\"wpbc_field_description\">Enter your first name.</div>\n				</item>\n				<item>\n					<l>Last Name</l>\n					<br>[text* secondname class:secondname class:lastname placeholder:\"Example: \'Smith\'\"]\n					<div class=\"wpbc_field_description\">Enter your last name.</div>\n				</item>\n				<item>\n					<l>Email</l>\n					<br>[email* email]\n					<div class=\"wpbc_field_description\">Enter your email address.</div>\n				</item>\n				<item>\n					<l>Phone</l>\n					<br>[text phone placeholder:\"(000)  999 - 10 - 20\"]\n					<div class=\"wpbc_field_description\">Enter contact phone number</div>\n				</item>\n				<item>\n					<l>Details</l>\n					<br>[textarea details]\n				</item>\n				<item>\n					<p class=\"wpbc_row_inline wpdev-form-control-wrap \">\n\t\t\t\t\t<l class=\"wpbc_inline_checkbox\">[checkbox* accept_terms \"I accept\"] the <a href=\"https://server.com/terms/\" target=\"_blank\" rel=\"noopener noreferrer\">terms</a> and <a href=\"https://server.com/conditions/\" target=\"_blank\" rel=\"noopener noreferrer\">conditions</a></l>\n\t\t\t\t\t</p>\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 100%;--wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-jc: flex-end;--wpbc-bfb-col-ai: flex-end;--wpbc-bfb-col-gap: 10px;--wpbc-bfb-col-aself: flex-end;--wpbc-col-min: 0px\">\n				<item>\n					<div class=\"wpbc_bfb_divider_wrap\" data-bfb-type=\"divider\" data-orientation=\"horizontal\" style=\"margin:2px 2px 2px 2px\"><hr name=\"divider_horizontal-2\" class=\"wpbc_bfb_divider wpbc_bfb_divider--h\" style=\"border:none;height:0;border-top:1px solid #e0e0e0;width:100%;margin-left:auto;margin-right:auto\"></div>\n				</item>\n				<item>\n					<span class=\"wpbc_bfb__btn wpbc_bfb__btn--primary\" style=\"flex:1\">[submit \"Send\"]</span>\n				</item>\n			</c>\n		</r>\n	</div>\n</div>
WPBC_BFB_TEMPLATE_ADVANCED_FORM
	)
);

$wpbc_full_days_booking_form_2_columns_1_step_content_form = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class=\"standard-content-form\">\n	<b>First Name</b>: <f>[firstname]</f><br>\n	<b>Last Name</b>: <f>[secondname]</f><br>\n	<b>Email</b>: <f>[email]</f><br>\n	<b>Phone</b>: <f>[phone]</f><br>\n	<b>Details</b>: <f>[details]</f><br>\n	<b>Accept Terms</b>: <f>[accept_terms]</f><br>\n</div>
WPBC_BFB_TEMPLATE_CONTENT_FORM
	)
);

return array(
	'template_key' => 'dates_form_with_calendar_next_to_form',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only', // 'insert_only' = insert once if missing, never overwrite existing row. | 'upsert' = insert if missing, update existing row when seed_version increases.
	'record'       => array(
		'form_slug'           => 'dates_form_with_calendar_next_to_form',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_full_days_booking_form_2_columns_1_step_structure_json,
		'settings_json'       => $wpbc_full_days_booking_form_2_columns_1_step_settings_json,
		'advanced_form'       => $wpbc_full_days_booking_form_2_columns_1_step_advanced_form,
		'content_form'        => $wpbc_full_days_booking_form_2_columns_1_step_content_form,
		'is_default'          => 0,
		'title'               => 'Full-Day / Booking Form with Calendar next to form',
		'description'         => 'One-page booking form with calendar on the left side and fields arranged on the right side, designed for full-days bookings.',
		'picture_url'         => 'dates_form_with_calendar_next_to_form_01.png',
	),
);
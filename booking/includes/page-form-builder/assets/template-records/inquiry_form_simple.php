<?php
/**
 * Bundled BFB template: Simple Business Inquiry Form.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/save-load/template-records/template-inquiry-form-simple.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

$wpbc_inquiry_form_simple_structure_json = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_STRUCTURE'
[{\"page\":1,\"content\":[{\"type\":\"section\",\"data\":{\"id\":\"section-8-1773823672371\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"\",\"columns\":[{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"text-firstname\",\"type\":\"text\",\"usage_key\":\"text-firstname\",\"label\":\"First Name\",\"name\":\"firstname\",\"placeholder\":\"Example: \\\"John\\\"\",\"required\":1,\"help\":\"Enter your first name.\",\"cssclass\":\"firstname\",\"min_width\":\"8em\",\"html_id\":\"\"}}]},{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"text-secondname\",\"type\":\"text\",\"usage_key\":\"text-secondname\",\"label\":\"Last Name\",\"name\":\"secondname\",\"placeholder\":\"Example: \\\"Smith\\\"\",\"required\":1,\"help\":\"Enter your last name.\",\"cssclass\":\"secondname lastname\",\"min_width\":\"8em\",\"html_id\":\"\"}}]}]}},{\"type\":\"section\",\"data\":{\"id\":\"section-33-1773827505486\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"\",\"columns\":[{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"email\",\"type\":\"email\",\"usage_key\":\"email\",\"label\":\"Email\",\"usagenumber\":1,\"name\":\"email\",\"html_id\":\"\",\"cssclass\":\"\",\"required\":true,\"help\":\"Enter your email address.\"}}]},{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"text\",\"type\":\"text\",\"usage_key\":\"text\",\"label\":\"Phone Number\",\"name\":\"phone\",\"cssclass\":\"\",\"html_id\":\"\",\"help\":\"Enter your phone number.\"}}]}]}},{\"type\":\"section\",\"data\":{\"id\":\"section-34-1773827581215\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"\",\"columns\":[{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"select\",\"type\":\"select\",\"usage_key\":\"select\",\"label\":\"Business Type\",\"name\":\"business_type\",\"min_width\":\"240px\",\"html_id\":\"\",\"cssclass\":\"\",\"placeholder\":\"--- Select ---\",\"options\":[{\"label\":\"Option 1\",\"value\":\"Option 1\",\"selected\":false},{\"label\":\"Option 2\",\"value\":\"Option 2\",\"selected\":false},{\"label\":\"Option 3\",\"value\":\"Option 3\",\"selected\":false},{\"label\":\"Option 4\",\"value\":\"Option 4\",\"selected\":false}]}}]},{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"text-k25\",\"type\":\"text\",\"usage_key\":\"text\",\"label\":\"Company Name\",\"name\":\"company_name\",\"cssclass\":\"\",\"html_id\":\"\"}}]}]}},{\"type\":\"section\",\"data\":{\"id\":\"section-11-1773823706332\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"\",\"columns\":[{\"width\":\"100%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"textarea\",\"type\":\"textarea\",\"usage_key\":\"textarea\",\"min_width\":\"260px\",\"label\":\"Inquiry Details\",\"name\":\"inquiry_details\",\"cssclass\":\"\",\"html_id\":\"\"}}]}]}},{\"type\":\"field\",\"data\":{\"id\":\"divider_horizontal\",\"type\":\"divider\",\"usage_key\":\"divider_horizontal\",\"orientation\":\"horizontal\",\"line_style\":\"solid\",\"thickness_px\":1,\"length\":\"100%\",\"align\":\"center\",\"color\":\"#e0e0e0\",\"label\":\"Divider_horizontal\",\"name\":\"divider_horizontal\",\"margin_top_px\":2,\"margin_bottom_px\":2,\"margin_left_px\":2,\"margin_right_px\":2,\"cssclass_extra\":\"\",\"html_id\":\"\"}},{\"type\":\"section\",\"data\":{\"id\":\"section-12-1773823770988\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"[{\\\"ai\\\":\\\"flex-end\\\"}]\",\"columns\":[{\"width\":\"100%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"submit\",\"type\":\"submit\",\"usage_key\":\"submit\",\"usagenumber\":1,\"label\":\"Send\",\"name\":\"submit\",\"cssclass\":\"wpbc_bfb__btn wpbc_bfb__btn--primary\",\"html_id\":\"\"}}]}]}}]}]
WPBC_BFB_TEMPLATE_STRUCTURE
	)
);

$wpbc_inquiry_form_simple_settings_json = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_SETTINGS'
{\"options\":{\"booking_form_theme\":\"\",\"booking_form_layout_width\":\"100%\",\"booking_type_of_day_selections\":\"\"},\"css_vars\":[],\"bfb_options\":{\"advanced_mode_source\":\"builder\"}}
WPBC_BFB_TEMPLATE_SETTINGS
	)
);

$wpbc_inquiry_form_simple_advanced_form = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_FORM'
<div class=\"wpbc_bfb_form wpbc_wizard__border_container\">\n	<div class=\"wpbc_wizard_step wpbc__form__div wpbc_wizard_step1\">\n		<r>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>First Name</l>\n					<br>[text* firstname class:firstname placeholder:\"Example: \'John\'\"]\n					<div class=\"wpbc_field_description\">Enter your first name.</div>\n				</item>\n			</c>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>Last Name</l>\n					<br>[text* secondname class:secondname class:lastname placeholder:\"Example: \'Smith\'\"]\n					<div class=\"wpbc_field_description\">Enter your last name.</div>\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>Email</l>\n					<br>[email* email]\n					<div class=\"wpbc_field_description\">Enter your email address.</div>\n				</item>\n			</c>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>Phone Number</l>\n					<br>[text phone]\n					<div class=\"wpbc_field_description\">Enter your phone number.</div>\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>Business Type</l>\n					<br>[selectbox business_type \"--- Select ---@@\" \"Option 1\" \"Option 2\" \"Option 3\" \"Option 4\"]\n				</item>\n			</c>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>Company Name</l>\n					<br>[text company_name]\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 100%\">\n				<item>\n					<l>Inquiry Details</l>\n					<br>[textarea inquiry_details]\n				</item>\n			</c>\n		</r>\n		<r>\n			<c>\n				<item>\n					<div class=\"wpbc_bfb_divider_wrap\" data-bfb-type=\"divider\" data-orientation=\"horizontal\" style=\"margin:2px 2px 2px 2px\"><hr name=\"divider_horizontal\" class=\"wpbc_bfb_divider wpbc_bfb_divider--h\" style=\"border:none;height:0;border-top:1px solid #e0e0e0;width:100%;margin-left:auto;margin-right:auto\"></div>\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 100%;--wpbc-bfb-col-ai: flex-end;--wpbc-col-min: 0px\">\n				<item>\n					<span class=\"wpbc_bfb__btn wpbc_bfb__btn--primary\" style=\"flex:1\">[submit \"Send\"]</span>\n				</item>\n			</c>\n		</r>\n	</div>\n</div>
WPBC_BFB_TEMPLATE_ADVANCED_FORM
	)
);

$wpbc_inquiry_form_simple_content_form = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class=\"standard-content-form\">\n	<b>First Name</b>: <f>[firstname]</f><br>\n	<b>Last Name</b>: <f>[secondname]</f><br>\n	<b>Email</b>: <f>[email]</f><br>\n	<b>Phone Number</b>: <f>[phone]</f><br>\n	<b>Business Type</b>: <f>[business_type]</f><br>\n	<b>Company Name</b>: <f>[company_name]</f><br>\n	<b>Inquiry Details</b>: <f>[inquiry_details]</f><br>\n</div>
WPBC_BFB_TEMPLATE_CONTENT_FORM
	)
);

return array(
	'template_key' => 'inquiry_form_simple',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only', // 'insert_only' = insert once if missing, never overwrite existing row. | 'upsert' = insert if missing, update existing row when seed_version increases.
	'record'       => array(
		'form_slug'           => 'inquiry_form_simple',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_inquiry_form_simple_structure_json,
		'settings_json'       => $wpbc_inquiry_form_simple_settings_json,
		'advanced_form'       => $wpbc_inquiry_form_simple_advanced_form,
		'content_form'        => $wpbc_inquiry_form_simple_content_form,
		'is_default'          => 0,
		'title'               => 'Simple Business Inquiry Form',
		'description'         => 'One-page inquiry form for collecting contact details, business type, company name, and inquiry details. Suitable for sales inquiries, quote requests, contact forms and general business questions.',
		'picture_url'         => 'inquiry_form_simple.png',
	),
);
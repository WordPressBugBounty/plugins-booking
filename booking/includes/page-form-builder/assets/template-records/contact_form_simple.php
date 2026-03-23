<?php
/**
 * Bundled BFB template: Simple Contact & Inquiry Form.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/save-load/template-records/template-simple-contact-form.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

$wpbc_simple_contact_form_structure_json = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_STRUCTURE'
[{\"page\":1,\"content\":[{\"type\":\"section\",\"data\":{\"id\":\"section-8-1773823672371\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"\",\"columns\":[{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"text-firstname\",\"type\":\"text\",\"usage_key\":\"text-firstname\",\"label\":\"First Name\",\"name\":\"firstname\",\"placeholder\":\"Example: \\\"John\\\"\",\"required\":1,\"help\":\"Enter your first name.\",\"cssclass\":\"firstname\",\"min_width\":\"8em\",\"html_id\":\"\"}}]},{\"width\":\"48.5%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"text-secondname\",\"type\":\"text\",\"usage_key\":\"text-secondname\",\"label\":\"Last Name\",\"name\":\"secondname\",\"placeholder\":\"Example: \\\"Smith\\\"\",\"required\":1,\"help\":\"Enter your last name.\",\"cssclass\":\"secondname lastname\",\"min_width\":\"8em\",\"html_id\":\"\"}}]}]}},{\"type\":\"section\",\"data\":{\"id\":\"section-9-1773823688671\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"\",\"columns\":[{\"width\":\"100%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"email\",\"type\":\"email\",\"usage_key\":\"email\",\"label\":\"Email\",\"usagenumber\":1,\"name\":\"email\",\"html_id\":\"\",\"cssclass\":\"\",\"required\":true,\"help\":\"Enter your email address.\"}}]}]}},{\"type\":\"section\",\"data\":{\"id\":\"section-11-1773823706332\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"\",\"columns\":[{\"width\":\"100%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"textarea\",\"type\":\"textarea\",\"usage_key\":\"textarea\",\"min_width\":\"260px\",\"label\":\"Message\",\"name\":\"textarea\",\"cssclass\":\"\",\"html_id\":\"\"}}]}]}},{\"type\":\"section\",\"data\":{\"id\":\"section-12-1773823770988\",\"label\":\"Section\",\"html_id\":\"\",\"cssclass\":\"\",\"col_styles\":\"[{\\\"ai\\\":\\\"flex-end\\\"}]\",\"columns\":[{\"width\":\"100%\",\"items\":[{\"type\":\"field\",\"data\":{\"id\":\"submit\",\"type\":\"submit\",\"usage_key\":\"submit\",\"usagenumber\":1,\"label\":\"Send\",\"name\":\"submit\",\"cssclass\":\"wpbc_bfb__btn wpbc_bfb__btn--primary\",\"html_id\":\"\"}}]}]}}]}]
WPBC_BFB_TEMPLATE_STRUCTURE
	)
);

$wpbc_simple_contact_form_settings_json = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_SETTINGS'
{\"options\":{\"booking_form_theme\":\"\",\"booking_form_layout_width\":\"100%\",\"booking_type_of_day_selections\":\"\"},\"css_vars\":[],\"bfb_options\":{\"advanced_mode_source\":\"builder\"}}
WPBC_BFB_TEMPLATE_SETTINGS
	)
);

$wpbc_simple_contact_form_advanced_form = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_FORM'
<div class=\"wpbc_bfb_form wpbc_wizard__border_container\">\n	<div class=\"wpbc_wizard_step wpbc__form__div wpbc_wizard_step1\">\n		<r>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>First Name</l>\n					<br>[text* firstname class:firstname placeholder:\"Example: \'John\'\"]\n					<div class=\"wpbc_field_description\">Enter your first name.</div>\n				</item>\n			</c>\n			<c style=\"flex-basis: 48.5%\">\n				<item>\n					<l>Last Name</l>\n					<br>[text* secondname class:secondname class:lastname placeholder:\"Example: \'Smith\'\"]\n					<div class=\"wpbc_field_description\">Enter your last name.</div>\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 100%\">\n				<item>\n					<l>Email</l>\n					<br>[email* email]\n					<div class=\"wpbc_field_description\">Enter your email address.</div>\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 100%\">\n				<item>\n					<l>Message</l>\n					<br>[textarea textarea]\n				</item>\n			</c>\n		</r>\n		<r>\n			<c style=\"flex-basis: 100%;--wpbc-bfb-col-ai: flex-end;--wpbc-col-min: 0px\">\n				<item>\n					<span class=\"wpbc_bfb__btn wpbc_bfb__btn--primary\" style=\"flex:1\">[submit \"Send\"]</span>\n				</item>\n			</c>\n		</r>\n	</div>\n</div>
WPBC_BFB_TEMPLATE_ADVANCED_FORM
	)
);

$wpbc_simple_contact_form_content_form = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class=\"standard-content-form\">\n	<b>First Name</b>: <f>[firstname]</f><br>\n	<b>Last Name</b>: <f>[secondname]</f><br>\n	<b>Email</b>: <f>[email]</f><br>\n	<b>Message</b>: <f>[textarea]</f><br>\n</div>
WPBC_BFB_TEMPLATE_CONTENT_FORM
	)
);

return array(
	'template_key' => 'contact_form_simple',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only', // 'insert_only' = insert once if missing, never overwrite existing row. | 'upsert' = insert if missing, update existing row when seed_version increases.
	'record'       => array(
		'form_slug'           => 'contact_form_simple',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_simple_contact_form_structure_json,
		'settings_json'       => $wpbc_simple_contact_form_settings_json,
		'advanced_form'       => $wpbc_simple_contact_form_advanced_form,
		'content_form'        => $wpbc_simple_contact_form_content_form,
		'is_default'          => 0,
		'title'               => 'Simple Contact Form',
		'description'         => 'Clean one-page contact form with first name, last name, email, and message fields. Ideal for inquiries, questions, and general contact requests.',
		'picture_url'         => 'contact_form_simple.png',
	),
);
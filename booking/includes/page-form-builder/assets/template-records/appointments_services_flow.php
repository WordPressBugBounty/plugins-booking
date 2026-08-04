<?php
/**
 * Bundled Booking Form Builder template for the Appointment and Services flow.
 *
 * The template derives from the canonical three-step Appointment review form,
 * then applies only the workflow-specific layout and time defaults. Keeping the
 * derivation here prevents the customer-details and review pages from drifting
 * away from the maintained Appointment template.
 *
 * @package Booking Calendar
 * @since   11.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wpbc_appointments_services_flow_config = require __DIR__ . '/time_appointments_3_steps_review_with_hints.php';
$wpbc_appointments_services_flow_record = isset( $wpbc_appointments_services_flow_config['record'] ) && is_array( $wpbc_appointments_services_flow_config['record'] )
	? $wpbc_appointments_services_flow_config['record']
	: array();

$wpbc_appointments_services_flow_structure = ! empty( $wpbc_appointments_services_flow_record['structure_json'] )
	? json_decode( (string) $wpbc_appointments_services_flow_record['structure_json'], true )
	: array();

$wpbc_appointments_services_flow_duration_options = array(
	array( 'label' => '20 min', 'value' => '00:20', 'selected' => false ),
	array( 'label' => '30 min', 'value' => '00:30', 'selected' => false ),
	array( 'label' => '45 min', 'value' => '00:45', 'selected' => false ),
	array( 'label' => '1 hour', 'value' => '01:00', 'selected' => false ),
);

$wpbc_appointments_services_flow_start_options = array(
	array( 'label' => '10:00 AM', 'value' => '10:00', 'selected' => false ),
	array( 'label' => '10:30 AM', 'value' => '10:30', 'selected' => false ),
	array( 'label' => '11:00 AM', 'value' => '11:00', 'selected' => false ),
	array( 'label' => '11:30 AM', 'value' => '11:30', 'selected' => false ),
	array( 'label' => '12:00 PM', 'value' => '12:00', 'selected' => false ),
	array( 'label' => '12:30 PM', 'value' => '12:30', 'selected' => false ),
	array( 'label' => '1:00 PM',  'value' => '13:00', 'selected' => false ),
	array( 'label' => '1:30 PM',  'value' => '13:30', 'selected' => false ),
	array( 'label' => '2:00 PM',  'value' => '14:00', 'selected' => false ),
	array( 'label' => '2:30 PM',  'value' => '14:30', 'selected' => false ),
	array( 'label' => '3:00 PM',  'value' => '15:00', 'selected' => false ),
	array( 'label' => '3:30 PM',  'value' => '15:30', 'selected' => false ),
	array( 'label' => '4:00 PM',  'value' => '16:00', 'selected' => false ),
	array( 'label' => '4:30 PM',  'value' => '16:30', 'selected' => false ),
);

if (
	isset( $wpbc_appointments_services_flow_structure[0]['content'][1]['data']['columns'][0]['items'][0] )
	&& isset( $wpbc_appointments_services_flow_structure[0]['content'][1]['data']['columns'][1] )
	&& isset( $wpbc_appointments_services_flow_structure[0]['content'][1]['data']['columns'][2]['items'][0] )
) {
	$wpbc_appointments_services_flow_page_one        =& $wpbc_appointments_services_flow_structure[0]['content'];
	$wpbc_appointments_services_flow_service_section =& $wpbc_appointments_services_flow_page_one[1];
	$wpbc_appointments_services_flow_columns         =& $wpbc_appointments_services_flow_service_section['data']['columns'];

	$wpbc_appointments_services_flow_duration_field = $wpbc_appointments_services_flow_columns[0]['items'][0];
	$wpbc_appointments_services_flow_divider        = isset( $wpbc_appointments_services_flow_columns[0]['items'][1] )
		? $wpbc_appointments_services_flow_columns[0]['items'][1]
		: array();
	$wpbc_appointments_services_flow_calendar_column = $wpbc_appointments_services_flow_columns[1];
	$wpbc_appointments_services_flow_start_column    = $wpbc_appointments_services_flow_columns[2];

	$wpbc_appointments_services_flow_duration_field['data']['label']   = '';
	$wpbc_appointments_services_flow_duration_field['data']['options'] = $wpbc_appointments_services_flow_duration_options;
	$wpbc_appointments_services_flow_calendar_column['width']          = '52.3737%';
	$wpbc_appointments_services_flow_start_column['width']             = '44.6263%';

	if ( ! empty( $wpbc_appointments_services_flow_divider ) ) {
		$wpbc_appointments_services_flow_calendar_column['items'][] = $wpbc_appointments_services_flow_divider;
	}

	$wpbc_appointments_services_flow_start_column['items'][0]['data']['options']          = $wpbc_appointments_services_flow_start_options;
	$wpbc_appointments_services_flow_start_column['items'][0]['data']['gen_start_ampm_t'] = '10:00';
	$wpbc_appointments_services_flow_start_column['items'][0]['data']['gen_end_ampm_t']   = '16:30';
	$wpbc_appointments_services_flow_start_column['items'][0]['data']['gen_step_h']        = 0;
	$wpbc_appointments_services_flow_start_column['items'][0]['data']['gen_step_m']        = 30;

	$wpbc_appointments_services_flow_service_section['data']['columns']    = array(
		$wpbc_appointments_services_flow_calendar_column,
		$wpbc_appointments_services_flow_start_column,
	);
	$wpbc_appointments_services_flow_service_section['data']['col_styles'] = '[{"dir":"row","ai":"flex-start","gap":"8px","aself":"stretch"},{}]';

	array_splice(
		$wpbc_appointments_services_flow_page_one,
		1,
		0,
		array( $wpbc_appointments_services_flow_duration_field )
	);
}

if ( isset( $wpbc_appointments_services_flow_structure[0]['content'][0]['data']['columns'][0]['items'][0]['data']['color'] ) ) {
	$wpbc_appointments_services_flow_structure[0]['content'][0]['data']['columns'][0]['items'][0]['data']['color'] = WPBC_DEFAULT_FORM_ACCENT_COLOR;
}
if ( isset( $wpbc_appointments_services_flow_structure[1]['content'][0]['data']['color'] ) ) {
	$wpbc_appointments_services_flow_structure[1]['content'][0]['data']['color'] = WPBC_DEFAULT_FORM_ACCENT_COLOR;
}
if ( isset( $wpbc_appointments_services_flow_structure[2]['content'][0]['data']['color'] ) ) {
	$wpbc_appointments_services_flow_structure[2]['content'][0]['data']['color'] = WPBC_DEFAULT_FORM_ACCENT_COLOR;
}

$wpbc_appointments_services_flow_structure_json = function_exists( 'wp_json_encode' )
	? wp_json_encode( $wpbc_appointments_services_flow_structure )
	: json_encode( $wpbc_appointments_services_flow_structure );

$wpbc_appointments_services_flow_advanced_form = isset( $wpbc_appointments_services_flow_record['advanced_form'] )
	? (string) $wpbc_appointments_services_flow_record['advanced_form']
	: '';

$wpbc_appointments_services_flow_start_shortcode = '[selectbox* starttime "10:00 AM@@10:00" "10:30 AM@@10:30" "11:00 AM@@11:00" "11:30 AM@@11:30" "12:00 PM@@12:00" "12:30 PM@@12:30" "1:00 PM@@13:00" "1:30 PM@@13:30" "2:00 PM@@14:00" "2:30 PM@@14:30" "3:00 PM@@15:00" "3:30 PM@@15:30" "4:00 PM@@16:00" "4:30 PM@@16:30"]';
$wpbc_appointments_services_flow_duration_shortcode = '[selectbox* durationtime class:wpbc_service_duration "20 min@@00:20" "30 min@@00:30" "45 min@@00:45" "1 hour@@01:00"]';

$wpbc_appointments_services_flow_page_one_advanced = <<<WPBC_BFB_APPOINTMENTS_SERVICES_PAGE_ONE
		<r>
			<c style="flex-basis: 100%; --wpbc-col-min: 0px">
				<item>
					{$wpbc_appointments_services_flow_duration_shortcode}
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 52.3737%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 8px;--wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
				<item>
					<l>Select Date</l>
					<br>[calendar]
				</item>
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="vertical" style="margin:5px 2px 2px 10px; display:flex; align-self:stretch"><div name="divider_vertical" class="wpbc_bfb_divider wpbc_bfb_divider--v" role="separator" aria-orientation="vertical" style="border-left:1px solid #cccccc; height:99%; padding-left:0; position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);"></div></div>
				</item>
			</c>
			<c style="flex-basis: 44.6263%; --wpbc-col-min: 0px">
				<item>
					<l>Start time*</l>
					<br>{$wpbc_appointments_services_flow_start_shortcode}
				</item>
			</c>
		</r>
WPBC_BFB_APPOINTMENTS_SERVICES_PAGE_ONE;

$wpbc_appointments_services_flow_advanced_form = preg_replace(
	'/\t\t<r>\R\t\t\t<c style="flex-basis: 28\.4136%;[\s\S]*?\R\t\t<\/r>/',
	$wpbc_appointments_services_flow_page_one_advanced,
	$wpbc_appointments_services_flow_advanced_form,
	1
);

$wpbc_appointments_services_flow_advanced_form = preg_replace(
	'/\[selectbox\* starttime[^\]]*\]/',
	$wpbc_appointments_services_flow_start_shortcode,
	$wpbc_appointments_services_flow_advanced_form,
	1
);
$wpbc_appointments_services_flow_advanced_form = preg_replace(
	'/\s*<l>Service\*<\/l>\s*<br>(?=\[selectbox\* durationtime)/',
	"\n\t\t\t\t\t",
	$wpbc_appointments_services_flow_advanced_form,
	1
);
$wpbc_appointments_services_flow_advanced_form = str_replace(
	'color="#619d40"',
	'color="' . WPBC_DEFAULT_FORM_ACCENT_COLOR . '"',
	$wpbc_appointments_services_flow_advanced_form
);

$wpbc_appointments_services_flow_content_form = isset( $wpbc_appointments_services_flow_record['content_form'] )
	? (string) $wpbc_appointments_services_flow_record['content_form']
	: '';
$wpbc_appointments_services_flow_content_form = str_replace(
	'<b>Service</b>: <f>[durationtime_val] / [durationtime]</f><br>',
	'<f>[durationtime_val] / [durationtime]</f><br>',
	$wpbc_appointments_services_flow_content_form
);

$wpbc_appointments_services_flow_record['form_slug']       = 'appointments_services_flow';
$wpbc_appointments_services_flow_record['structure_json']  = $wpbc_appointments_services_flow_structure_json;
$wpbc_appointments_services_flow_record['advanced_form']   = $wpbc_appointments_services_flow_advanced_form;
$wpbc_appointments_services_flow_record['content_form']    = $wpbc_appointments_services_flow_content_form;
$wpbc_appointments_services_flow_record['title']           = 'Appointments and Services Flow';
$wpbc_appointments_services_flow_record['description']     = 'Three-step Appointment flow with a label-free Service duration selector, date and start time selection, customer details, and a final booking review.';
$wpbc_appointments_services_flow_record['picture_url']     = 'appointments_services_flow_01.png';

return array(
	'template_key' => 'appointments_services_flow',
	'seed_version' => '11.5.0',
	'sync_mode'    => 'insert_only',
	'record'       => $wpbc_appointments_services_flow_record,
);

<?php
/**
 * Bundled BFB template: Appointments and Service Selection Summary.
 *
 * This record preserves the supplied two-page Builder configuration while
 * correcting its responsive divider behavior and ineffective overflow styles.
 *
 * @package Booking Calendar
 * @since   11.8.5
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$wpbc_appointments_services_selection_summary_structure_source = <<<'WPBC_BFB_APPOINTMENTS_SERVICES_SELECTION_SUMMARY_STRUCTURE'
[{"page":1,"content":[{"type":"section","data":{"id":"section-62-1789813071567","label":"Section","html_id":"","cssclass":"wpbc_bfb_time_slots_split_form","col_styles":"[{\"padding_top\":\"0px\",\"padding_right\":\"10px\",\"padding_bottom\":\"0px\",\"padding_left\":\"0px\",\"margin_top\":\"0.7em\",\"margin_right\":\"0px\",\"margin_bottom\":\"0.7em\",\"margin_left\":\"0px\"},{},{\"aself\":\"stretch\"},{\"margin_top\":\"0em\",\"margin_right\":\"0px\",\"margin_bottom\":\"0em\",\"margin_left\":\"0px\"}]","columns":[{"width":"26.5013%","items":[{"type":"section","data":{"id":"section-24-1789834829986","label":"Section","html_id":"","cssclass":"wpbc_bfb_time_slots_split_form","col_styles":"[{\"margin_top\":\"0em\",\"margin_right\":\"0px\",\"margin_bottom\":\"0em\",\"margin_left\":\"0px\"},{\"ai\":\"flex-end\",\"aself\":\"stretch\"}]","columns":[{"width":"92.15%","items":[{"type":"section","data":{"id":"section-41-1789044626611","label":"Section","html_id":"","cssclass":"","col_styles":"[{\"gap\":\"1em\",\"margin_top\":\"0em\",\"margin_right\":\"0px\",\"margin_bottom\":\"0.7em\",\"margin_left\":\"0px\"}]","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"static-text-gee7w-2","type":"static_text","usage_key":"static_text","text":"Your Selection","tag":"div","align":"left","bold":1,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static-text-gee7w-2","html_id":"","cssclass_extra":""}},{"type":"field","data":{"id":"static-text-1d1cs-2","type":"static_text","usage_key":"static_text","text":"Review your appointment details.","tag":"small","align":"left","bold":0,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static-text-1d1cs-2","html_id":"","cssclass_extra":""}}]}]}},{"type":"section","data":{"id":"section-21-1789834588530","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"43.65%","items":[{"type":"field","data":{"id":"static-text-gvunt","type":"static_text","usage_key":"static_text","text":"Date:","tag":"div","align":"left","bold":0,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static-text-gvunt","html_id":"","cssclass_extra":""}}]},{"width":"53.35%","items":[{"type":"field","data":{"id":"check_in_date_hint","type":"check_in_date_hint","usage_key":"check_in_date_hint","prefix_text":"","preview_value":"11.11.2026","help":"","label":"","name":"check_in_date_hint","html_id":"","cssclass":""}}]}]}},{"type":"section","data":{"id":"section-21-1789834588531","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"43.65%","items":[{"type":"field","data":{"id":"static_text-1cq","type":"static_text","usage_key":"static_text","text":"Start time:","tag":"div","align":"left","bold":0,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static_text-1cq","html_id":"","cssclass_extra":""}}]},{"width":"53.35%","items":[{"type":"field","data":{"id":"start_time_hint","type":"start_time_hint","usage_key":"start_time_hint","prefix_text":"","preview_value":"10:30","help":"","label":"","name":"start_time_hint","html_id":"","cssclass":""}}]}]}},{"type":"section","data":{"id":"section-21-1789834588532","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"43.65%","items":[{"type":"field","data":{"id":"static-text-6hqau","type":"static_text","usage_key":"static_text","text":"End time:","tag":"div","align":"left","bold":0,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static-text-6hqau","html_id":"","cssclass_extra":""}}]},{"width":"53.35%","items":[{"type":"field","data":{"id":"end_time_hint","type":"end_time_hint","usage_key":"end_time_hint","prefix_text":"","preview_value":"11:00","help":"","label":"","name":"end_time_hint","html_id":"","cssclass":""}}]}]}},{"type":"section","data":{"id":"section-25-1789835003287","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"durationtime","type":"durationtime","usage_key":"durationtime","usagenumber":1,"min_width":"180px","label":"","name":"durationtime","required":true,"options":[{"label":"30 minutes","value":"00:30","selected":false},{"label":"1h","value":"01:00","selected":false},{"label":"1h 30m","value":"01:30","selected":false},{"label":"2h","value":"02:00","selected":false}],"gen_start_24h":"00:30","gen_end_24h":"02:00","gen_step_m":30}}]}]}}]},{"width":"4.85%","items":[{"type":"field","data":{"type":"divider","usage_key":"divider","orientation":"vertical","line_style":"solid","thickness_px":1,"length":"100%","align":"middle","color":"#e0e0e0","label":"Divider_vertical","margin_top_px":2,"margin_bottom_px":2,"margin_left_px":2,"margin_right_px":2,"cssclass_extra":"","id":"divider-vertical-r1jav","name":"divider-vertical-r1jav","html_id":""}}]}]}}]},{"width":"37.1434%","items":[{"type":"section","data":{"id":"section-41-1789044626610","label":"Section","html_id":"","cssclass":"","col_styles":"[{\"ai\":\"flex-start\",\"gap\":\"1em\",\"margin_top\":\"0em\",\"margin_right\":\"0px\",\"margin_bottom\":\"0.7em\",\"margin_left\":\"0px\"}]","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"static_text-2","type":"static_text","usage_key":"static_text","text":"Select a date","tag":"div","align":"left","bold":1,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static_text-2","html_id":"","cssclass_extra":""}},{"type":"field","data":{"id":"static_text-14g-2","type":"static_text","usage_key":"static_text","text":"Choose a date for your appointment.","tag":"small","align":"left","bold":0,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static_text-14g-2","html_id":"","cssclass_extra":""}}]}]}},{"type":"section","data":{"id":"section-21-1789827102504","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"calendar","type":"calendar","usage_key":"calendar","usagenumber":1,"resource_id":1,"months":1,"label":"","min_width":"250px","name":"calendar","wpbc-cal-init":1,"wpbc-cal-loaded-rid":1}}]}]}}]},{"width":"1.17634%","items":[{"type":"field","data":{"id":"divider_vertical","type":"divider","usage_key":"divider","orientation":"vertical","line_style":"solid","thickness_px":1,"length":"100%","align":"middle","color":"#e0e0e0","label":"Divider_vertical","name":"divider_vertical","margin_top_px":2,"margin_bottom_px":2,"margin_left_px":2,"margin_right_px":2,"cssclass_extra":"","html_id":""}}]},{"width":"26.179%","items":[{"type":"section","data":{"id":"section-41-1789044626609","label":"Section","html_id":"","cssclass":"","col_styles":"[{\"ai\":\"flex-start\",\"gap\":\"1em\"}]","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"static-text-gee7w","type":"static_text","usage_key":"static_text","text":"Select a time","tag":"div","align":"left","bold":1,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static-text-gee7w","html_id":"","cssclass_extra":""}},{"type":"field","data":{"id":"static-text-1d1cs","type":"static_text","usage_key":"static_text","text":"Choose an available start time, then continue to enter your details.","tag":"small","align":"left","bold":0,"italic":0,"html_allowed":0,"nl2br":1,"label":"Static_text","name":"static-text-1d1cs","html_id":"","cssclass_extra":""}}]}]}},{"type":"section","data":{"id":"section-64-1789814067369","label":"Section","html_id":"","cssclass":"","col_styles":"[{\"gap\":\"0%\",\"padding_top\":\"0px\",\"padding_right\":\"20px\",\"padding_bottom\":\"0px\",\"padding_left\":\"20px\",\"margin_right\":\"0px\",\"margin_bottom\":\"0em\",\"margin_left\":\"0px\",\"max_height\":\"410px\",\"overflow_y\":\"auto\",\"aself\":\"stretch\"}]","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"starttime","type":"starttime","usage_key":"starttime","usagenumber":1,"min_width":"180px","label":"","name":"starttime","required":true,"options":[{"label":"8:00 AM","value":"08:00","selected":false},{"label":"9:30 AM","value":"09:30","selected":false},{"label":"11:00 AM","value":"11:00","selected":false},{"label":"12:30 PM","value":"12:30","selected":false},{"label":"2:00 PM","value":"14:00","selected":false},{"label":"3:30 PM","value":"15:30","selected":false},{"label":"5:00 PM","value":"17:00","selected":false},{"label":"6:30 PM","value":"18:30","selected":false}],"gen_end_ampm_t":"19:00","gen_start_ampm_t":"08:00","gen_step_m":30,"gen_step_h":1}}]}]}}]}]}},{"type":"section","data":{"id":"section-21-1773063061362","label":"Section","html_id":"","cssclass":"","col_styles":"[{\"margin_top\":\"0em\",\"margin_right\":\"0px\",\"margin_bottom\":\"0.7em\",\"margin_left\":\"0px\"}]","columns":[{"width":"100%","items":[{"type":"section","data":{"id":"section-13-1773062424785","label":"Section","html_id":"","cssclass":"","col_styles":"[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"10px\",\"aself\":\"flex-end\"}]","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"divider_horizontal-2","type":"divider","usage_key":"divider","orientation":"horizontal","line_style":"solid","thickness_px":1,"length":"100%","align":"center","color":"#e0e0e0","label":"Divider_horizontal","name":"divider_horizontal-2","margin_top_px":2,"margin_bottom_px":2,"margin_left_px":2,"margin_right_px":2,"cssclass_extra":"","html_id":""}},{"type":"field","data":{"id":"wizard_nav_next","type":"wizard_nav","usage_key":"wizard_nav","direction":"next","target_step":2,"label":"Continue","name":"wizard_nav_next","cssclass_extra":"","html_id":""}}]}]}}]}]}}]},{"page":2,"content":[{"type":"section","data":{"id":"section-45-1789045373792","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"48.5%","items":[{"type":"field","data":{"id":"text-firstname","type":"text","usage_key":"text","label":"First Name","name":"firstname","placeholder":"John","required":1,"help":"Enter your first name.","cssclass":"firstname","min_width":"8em","html_id":""}}]},{"width":"48.5%","items":[{"type":"field","data":{"id":"text-secondname","type":"text","usage_key":"text","label":"Last Name","name":"secondname","placeholder":"Smith","required":1,"help":"Enter your last name.","cssclass":"secondname lastname","min_width":"8em","html_id":""}}]}]}},{"type":"section","data":{"id":"section-25-1789147385669","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"48.5%","items":[{"type":"field","data":{"id":"email","type":"email","usage_key":"email","label":"Email","usagenumber":1,"name":"email","html_id":"","cssclass":"","required":true,"help":"Enter your email address."}}]},{"width":"48.5%","items":[{"type":"field","data":{"id":"text","type":"text","usage_key":"text","label":"Phone","name":"phone","cssclass":"","html_id":"","placeholder":"+1 555 123 4567","default_value":"","help":"Enter the best number to reach you."}}]}]}},{"type":"section","data":{"id":"section-27-1789147429320","label":"Section","html_id":"","cssclass":"","col_styles":"","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"textarea","type":"textarea","usage_key":"textarea","min_width":"260px","label":"Notes for your appointment","name":"details","cssclass":"","html_id":"","placeholder":""}}]}]}},{"type":"section","data":{"id":"section-29-1789147663718","label":"Section","html_id":"","cssclass":"","col_styles":"[{}]","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"accept_terms","type":"accept_terms","usage_key":"accept_terms","label":"Accept Terms","name":"accept_terms","required":1,"links":[{"key":"terms","text":"terms","link_type":"url","destination":"/terms/","target":"_blank","cssclass":""},{"key":"conditions","text":"conditions","link_type":"url","destination":"/conditions/","target":"_blank","cssclass":""}]}}]}]}},{"type":"section","data":{"id":"section-13-1773062424786","label":"Section","html_id":"","cssclass":"","col_styles":"[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"10px\",\"aself\":\"flex-end\"}]","columns":[{"width":"100%","items":[{"type":"field","data":{"id":"divider_horizontal-3","type":"divider","usage_key":"divider","orientation":"horizontal","line_style":"solid","thickness_px":1,"length":"100%","align":"center","color":"#e0e0e0","label":"Divider_horizontal","name":"divider_horizontal-3","margin_top_px":2,"margin_bottom_px":2,"margin_left_px":2,"margin_right_px":2,"cssclass_extra":"","html_id":""}},{"type":"field","data":{"id":"wizard_nav_back-2","type":"wizard_nav","usage_key":"wizard_nav","direction":"back","target_step":1,"label":"Back","name":"wizard_nav_back-2","cssclass_extra":"","html_id":""}},{"type":"field","data":{"id":"submit","type":"submit","usage_key":"submit","usagenumber":1,"label":"Book appointment","name":"submit","cssclass":"wpbc_bfb__btn wpbc_bfb__btn--primary","html_id":""}}]}]}}]}]
WPBC_BFB_APPOINTMENTS_SERVICES_SELECTION_SUMMARY_STRUCTURE;

$wpbc_appointments_services_selection_summary_structure = json_decode(
	$wpbc_appointments_services_selection_summary_structure_source,
	true
);

if ( ! is_array( $wpbc_appointments_services_selection_summary_structure ) ) {
	$wpbc_appointments_services_selection_summary_structure = array();
}

$wpbc_appointments_services_selection_summary_terms_url      = esc_url_raw( home_url( '/terms/' ) );
$wpbc_appointments_services_selection_summary_conditions_url = esc_url_raw( home_url( '/conditions/' ) );

if (
	isset( $wpbc_appointments_services_selection_summary_structure[1]['content'][3]['data']['columns'][0]['items'][0]['data']['links'] )
	&& is_array( $wpbc_appointments_services_selection_summary_structure[1]['content'][3]['data']['columns'][0]['items'][0]['data']['links'] )
) {
	$wpbc_appointments_services_selection_summary_links =& $wpbc_appointments_services_selection_summary_structure[1]['content'][3]['data']['columns'][0]['items'][0]['data']['links'];

	foreach ( $wpbc_appointments_services_selection_summary_links as &$wpbc_appointments_services_selection_summary_link ) {
		if ( 'terms' === ( isset( $wpbc_appointments_services_selection_summary_link['key'] ) ? $wpbc_appointments_services_selection_summary_link['key'] : '' ) ) {
			$wpbc_appointments_services_selection_summary_link['destination'] = $wpbc_appointments_services_selection_summary_terms_url;
		} elseif ( 'conditions' === ( isset( $wpbc_appointments_services_selection_summary_link['key'] ) ? $wpbc_appointments_services_selection_summary_link['key'] : '' ) ) {
			$wpbc_appointments_services_selection_summary_link['destination'] = $wpbc_appointments_services_selection_summary_conditions_url;
		}
	}
	unset( $wpbc_appointments_services_selection_summary_link );
}

$wpbc_appointments_services_selection_summary_structure_json = function_exists( 'wp_json_encode' )
	? wp_json_encode( $wpbc_appointments_services_selection_summary_structure )
	: json_encode( $wpbc_appointments_services_selection_summary_structure );

$wpbc_appointments_services_selection_summary_settings_json = '{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":"single"},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}';

$wpbc_appointments_services_selection_summary_terms_url_html      = esc_url( $wpbc_appointments_services_selection_summary_terms_url );
$wpbc_appointments_services_selection_summary_conditions_url_html = esc_url( $wpbc_appointments_services_selection_summary_conditions_url );

$wpbc_appointments_services_selection_summary_advanced_form = trim(
<<<WPBC_BFB_APPOINTMENTS_SERVICES_SELECTION_SUMMARY_ADVANCED_FORM
<div class="wpbc_bfb_form wpbc_wizard__border_container">
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step1">
		<r class="wpbc_bfb_time_slots_split_form">
			<c style="flex-basis: 26.5013%; --wpbc-bfb-col-padding-top: 0px;--wpbc-bfb-col-padding-right: 10px;--wpbc-bfb-col-padding-bottom: 0px;--wpbc-bfb-col-padding-left: 0px;--wpbc-bfb-col-margin-top: 0.7em;--wpbc-bfb-col-margin-right: 0px;--wpbc-bfb-col-margin-bottom: 0.7em;--wpbc-bfb-col-margin-left: 0px;--wpbc-col-min: 0px">
				<r class="wpbc_bfb_time_slots_split_form">
					<c style="flex-basis: 92.15%; --wpbc-bfb-col-margin-top: 0em;--wpbc-bfb-col-margin-right: 0px;--wpbc-bfb-col-margin-bottom: 0em;--wpbc-bfb-col-margin-left: 0px;--wpbc-col-min: 0px">
						<r>
							<c style="flex-basis: 100%; --wpbc-bfb-col-gap: 1em;--wpbc-bfb-col-margin-top: 0em;--wpbc-bfb-col-margin-right: 0px;--wpbc-bfb-col-margin-bottom: 0.7em;--wpbc-bfb-col-margin-left: 0px;--wpbc-col-min: 0px">
								<item>
									<div name="static-text-gee7w-2" class="wpbc_static_text" style="text-align:left;font-weight:bold">Your Selection</div>
								</item>
								<item>
									<small name="static-text-1d1cs-2" class="wpbc_static_text" style="text-align:left">Review your appointment details.</small>
								</item>
							</c>
						</r>
						<r>
							<c style="flex-basis: 43.65%">
								<item>
									<div name="static-text-gvunt" class="wpbc_static_text" style="text-align:left">Date:</div>
								</item>
							</c>
							<c style="flex-basis: 53.35%">
								<item>
									<strong>[check_in_date_hint]</strong>
								</item>
							</c>
						</r>
						<r>
							<c style="flex-basis: 43.65%">
								<item>
									<div name="static_text-1cq" class="wpbc_static_text" style="text-align:left">Start time:</div>
								</item>
							</c>
							<c style="flex-basis: 53.35%">
								<item>
									<strong>[start_time_hint]</strong>
								</item>
							</c>
						</r>
						<r>
							<c style="flex-basis: 43.65%">
								<item>
									<div name="static-text-6hqau" class="wpbc_static_text" style="text-align:left">End time:</div>
								</item>
							</c>
							<c style="flex-basis: 53.35%">
								<item>
									<strong>[end_time_hint]</strong>
								</item>
							</c>
						</r>
						<r>
							<c style="flex-basis: 100%">
								<item>
									[selectbox* durationtime "--- Select duration ---@@" "30 minutes@@00:30" "1h@@01:00" "1h 30m@@01:30" "2h@@02:00"]
								</item>
							</c>
						</r>
					</c>
					<c style="flex-basis: 4.85%; --wpbc-bfb-col-ai: flex-end;--wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
						<item>
							<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="vertical" style="margin:2px 2px 2px 2px; display:flex; align-self:stretch"><div name="divider-vertical-r1jav" class="wpbc_bfb_divider wpbc_bfb_divider--v" role="separator" aria-orientation="vertical" style="border-left:1px solid #e0e0e0; height:100%; padding-left:0; position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);"></div></div>
						</item>
					</c>
				</r>
			</c>
			<c style="flex-basis: 37.1434%; --wpbc-col-min: 0px">
				<r>
					<c style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 1em;--wpbc-bfb-col-margin-top: 0em;--wpbc-bfb-col-margin-right: 0px;--wpbc-bfb-col-margin-bottom: 0.7em;--wpbc-bfb-col-margin-left: 0px;--wpbc-col-min: 0px">
						<item>
							<div name="static_text-2" class="wpbc_static_text" style="text-align:left;font-weight:bold">Select a date</div>
						</item>
						<item>
							<small name="static_text-14g-2" class="wpbc_static_text" style="text-align:left">Choose a date for your appointment.</small>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							[calendar]
						</item>
					</c>
				</r>
			</c>
			<c style="flex-basis: 1.17634%; --wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="vertical" style="margin:2px 2px 2px 2px; display:flex; align-self:stretch"><div name="divider_vertical" class="wpbc_bfb_divider wpbc_bfb_divider--v" role="separator" aria-orientation="vertical" style="border-left:1px solid #e0e0e0; height:100%; padding-left:0; position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);"></div></div>
				</item>
			</c>
			<c style="flex-basis: 26.179%; --wpbc-bfb-col-margin-top: 0em;--wpbc-bfb-col-margin-right: 0px;--wpbc-bfb-col-margin-bottom: 0em;--wpbc-bfb-col-margin-left: 0px;--wpbc-col-min: 0px">
				<r>
					<c style="flex-basis: 100%; --wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 1em;--wpbc-col-min: 0px">
						<item>
							<div name="static-text-gee7w" class="wpbc_static_text" style="text-align:left;font-weight:bold">Select a time</div>
						</item>
						<item>
							<small name="static-text-1d1cs" class="wpbc_static_text" style="text-align:left">Choose an available start time, then continue to enter your details.</small>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%; --wpbc-bfb-col-gap: 0%;--wpbc-bfb-col-padding-top: 0px;--wpbc-bfb-col-padding-right: 20px;--wpbc-bfb-col-padding-bottom: 0px;--wpbc-bfb-col-padding-left: 20px;--wpbc-bfb-col-margin-right: 0px;--wpbc-bfb-col-margin-bottom: 0em;--wpbc-bfb-col-margin-left: 0px;--wpbc-bfb-col-max-height: 410px;--wpbc-bfb-col-overflow-y: auto;--wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
						<item>
							[selectbox* starttime "--- Select time ---@@" "8:00 AM@@08:00" "9:30 AM@@09:30" "11:00 AM@@11:00" "12:30 PM@@12:30" "2:00 PM@@14:00" "3:30 PM@@15:30" "5:00 PM@@17:00" "6:30 PM@@18:30"]
						</item>
					</c>
				</r>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-margin-top: 0em;--wpbc-bfb-col-margin-right: 0px;--wpbc-bfb-col-margin-bottom: 0.7em;--wpbc-bfb-col-margin-left: 0px;--wpbc-col-min: 0px">
				<r>
					<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-jc: flex-end;--wpbc-bfb-col-ai: flex-end;--wpbc-bfb-col-gap: 10px;--wpbc-bfb-col-aself: flex-end;--wpbc-col-min: 0px">
						<item>
							<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-2" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
						</item>
						<item>
							<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_2">Continue</a>
						</item>
					</c>
				</r>
			</c>
		</r>
	</div>
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step2 wpbc_wizard_step_hidden" style="display:none;clear:both;">
		<r>
			<c style="flex-basis: 48.5%">
				<item>
					<l>First Name*</l>
					<br>[text* firstname class:firstname placeholder:"John"]
					<div class="wpbc_field_description">Enter your first name.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Last Name*</l>
					<br>[text* secondname class:secondname class:lastname placeholder:"Smith"]
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
					<br>[text phone placeholder:"+1 555 123 4567"]
					<div class="wpbc_field_description">Enter the best number to reach you.</div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%">
				<item>
					<l>Notes for your appointment</l>
					<br>[textarea details]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-col-min: 0px">
				<item>
					<p class="wpbc_row_inline wpdev-form-control-wrap ">
					<l class="wpbc_inline_checkbox">[checkbox* accept_terms "I accept"] the <a href="{$wpbc_appointments_services_selection_summary_terms_url_html}" target="_blank" rel="noopener noreferrer">terms</a> and <a href="{$wpbc_appointments_services_selection_summary_conditions_url_html}" target="_blank" rel="noopener noreferrer">conditions</a></l>
					</p>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-jc: flex-end;--wpbc-bfb-col-ai: flex-end;--wpbc-bfb-col-gap: 10px;--wpbc-bfb-col-aself: flex-end;--wpbc-col-min: 0px">
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal-3" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
				</item>
				<item>
					<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_1">Back</a>
				</item>
				<item>
					<span class="wpbc_bfb__btn wpbc_bfb__btn--primary" style="flex:1;">[submit "Book appointment"]</span>
				</item>
			</c>
		</r>
	</div>
</div>
WPBC_BFB_APPOINTMENTS_SERVICES_SELECTION_SUMMARY_ADVANCED_FORM
);

$wpbc_appointments_services_selection_summary_content_form = trim(
<<<'WPBC_BFB_APPOINTMENTS_SERVICES_SELECTION_SUMMARY_CONTENT_FORM'
<div class="standard-content-form">
	<b>Date</b>: <f>[check_in_date_hint]</f><br>
	<b>Service duration</b>: <f>[durationtime_val] / [durationtime]</f><br>
	<b>Start time</b>: <f>[starttime]</f><br>
	<b>First Name</b>: <f>[firstname]</f><br>
	<b>Last Name</b>: <f>[secondname]</f><br>
	<b>Email</b>: <f>[email]</f><br>
	<b>Phone</b>: <f>[phone]</f><br>
	<b>Notes for your appointment</b>: <f>[details]</f><br>
	<b>Accept Terms</b>: <f>[accept_terms]</f><br>
</div>
WPBC_BFB_APPOINTMENTS_SERVICES_SELECTION_SUMMARY_CONTENT_FORM
);

return array(
	'template_key' => 'appointments_services_selection_summary',
	'seed_version' => '11.8.5',
	'sync_mode'    => 'insert_only',
	'record'       => array(
		'form_slug'           => 'appointments_services_selection_summary',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_appointments_services_selection_summary_structure_json,
		'settings_json'       => $wpbc_appointments_services_selection_summary_settings_json,
		'advanced_form'       => $wpbc_appointments_services_selection_summary_advanced_form,
		'content_form'        => $wpbc_appointments_services_selection_summary_content_form,
		'is_default'          => 0,
		'title'               => 'Appointments and Service / Selection Summary',
		'description'         => 'A two-step Appointments and Service booking form with a label-free duration selector, live date and time summary, calendar, start-time choices, and customer details.',
		'picture_url'         => 'appointments_services_flow_02.png',
	),
);


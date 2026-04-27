<?php
/**
 * Bundled BFB template: 2 steps Appointment Wizard.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/save-load/template-records/template-service-appointments-2steps-vertical.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

$wpbc_form_2_steps_appointment_wizard_structure_json = trim(
<<<'WPBC_BFB_TEMPLATE_STRUCTURE'
[
  {
    "page": 1,
    "content": [
      {
        "type": "section",
        "data": {
          "id": "section-22-1773220565981",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "type": "steps_timeline",
                    "usage_key": "steps_timeline",
                    "steps_count": 2,
                    "active_step": 1,
                    "color": "#619d40",
                    "label": "Steps_timeline",
                    "cssclass_extra": "",
                    "steps_scope_suffix": 1360,
                    "id": "steps-timeline-yuslc",
                    "name": "steps-timeline-yuslc",
                    "html_id": ""
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-12-1773062225539",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "[{\"dir\":\"row\",\"jc\":\"center\",\"ai\":\"flex-start\",\"gap\":\"8px\",\"aself\":\"stretch\"}]",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "durationtime",
                    "type": "durationtime",
                    "usage_key": "durationtime",
                    "usagenumber": 1,
                    "label": "Service",
                    "name": "durationtime",
                    "placeholder": "--- Select service duration ---",
                    "required": true,
                    "help": "",
                    "cssclass": "wpbc_service_duration",
                    "min_width": "240px",
                    "gen_label_fmt": "24h",
                    "gen_start_24h": "00:20",
                    "gen_end_24h": "02:00",
                    "gen_start_ampm_t": "00:20",
                    "gen_end_ampm_t": "02:00",
                    "gen_step_h": 0,
                    "gen_step_m": 10,
                    "options": [
                      {
                        "label": "Service A (20 min)",
                        "value": "00:20",
                        "selected": false
                      },
                      {
                        "label": "Service B (30 min)",
                        "value": "00:30",
                        "selected": false
                      },
                      {
                        "label": "Service C (45 min)",
                        "value": "00:45",
                        "selected": false
                      },
                      {
                        "label": "Service D (1 hour)",
                        "value": "01:00",
                        "selected": false
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "type": "field",
        "data": {
          "id": "divider_horizontal",
          "type": "divider",
          "usage_key": "divider_horizontal",
          "orientation": "horizontal",
          "line_style": "solid",
          "thickness_px": 1,
          "length": "100%",
          "align": "center",
          "color": "#e0e0e0",
          "label": "Divider_horizontal",
          "name": "divider_horizontal",
          "margin_top_px": 2,
          "margin_bottom_px": 2,
          "margin_left_px": 2,
          "margin_right_px": 2,
          "cssclass_extra": "",
          "html_id": ""
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-11-1773137021920",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "[{},{\"aself\":\"stretch\"}]",
          "columns": [
            {
              "width": "50.8384%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "calendar",
                    "type": "calendar",
                    "usage_key": "calendar",
                    "usagenumber": 1,
                    "resource_id": 1,
                    "months": 1,
                    "label": "Select Date",
                    "min_width": "250px",
                    "name": "calendar",
                    "wpbc-cal-init": 1,
                    "wpbc-cal-loaded-rid": 1
                  }
                }
              ]
            },
            {
              "width": "46.1616%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "starttime",
                    "type": "starttime",
                    "usage_key": "starttime",
                    "usagenumber": 1,
                    "min_width": "180px",
                    "label": "Start time",
                    "name": "starttime",
                    "required": true,
                    "options": [
                      {
                        "label": "10:00 AM",
                        "value": "10:00",
                        "selected": false
                      },
                      {
                        "label": "10:30 AM",
                        "value": "10:30",
                        "selected": false
                      },
                      {
                        "label": "11:00 AM",
                        "value": "11:00",
                        "selected": false
                      },
                      {
                        "label": "11:30 AM",
                        "value": "11:30",
                        "selected": false
                      },
                      {
                        "label": "12:00 PM",
                        "value": "12:00",
                        "selected": false
                      },
                      {
                        "label": "12:30 PM",
                        "value": "12:30",
                        "selected": false
                      },
                      {
                        "label": "1:00 PM",
                        "value": "13:00",
                        "selected": false
                      },
                      {
                        "label": "1:30 PM",
                        "value": "13:30",
                        "selected": false
                      },
                      {
                        "label": "2:00 PM",
                        "value": "14:00",
                        "selected": false
                      },
                      {
                        "label": "2:30 PM",
                        "value": "14:30",
                        "selected": false
                      },
                      {
                        "label": "3:00 PM",
                        "value": "15:00",
                        "selected": false
                      },
                      {
                        "label": "3:30 PM",
                        "value": "15:30",
                        "selected": false
                      },
                      {
                        "label": "4:00 PM",
                        "value": "16:00",
                        "selected": false
                      },
                      {
                        "label": "4:30 PM",
                        "value": "16:30",
                        "selected": false
                      },
                      {
                        "label": "5:00 PM",
                        "value": "17:00",
                        "selected": false
                      },
                      {
                        "label": "5:30 PM",
                        "value": "17:30",
                        "selected": false
                      }
                    ],
                    "gen_start_ampm_t": "10:00",
                    "gen_end_ampm_t": "17:30",
                    "gen_step_m": 30,
                    "gen_step_h": 0
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-13-1773062424786",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"10px\",\"aself\":\"flex-end\"}]",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "divider_horizontal-3",
                    "type": "divider",
                    "usage_key": "divider_horizontal",
                    "orientation": "horizontal",
                    "line_style": "solid",
                    "thickness_px": 1,
                    "length": "100%",
                    "align": "center",
                    "color": "#e0e0e0",
                    "label": "Divider_horizontal",
                    "name": "divider_horizontal-3",
                    "margin_top_px": 2,
                    "margin_bottom_px": 2,
                    "margin_left_px": 2,
                    "margin_right_px": 2,
                    "cssclass_extra": "",
                    "html_id": ""
                  }
                },
                {
                  "type": "field",
                  "data": {
                    "id": "wizard_nav_next-3",
                    "type": "wizard_nav",
                    "usage_key": "wizard_nav_next",
                    "direction": "next",
                    "target_step": 2,
                    "label": "Next",
                    "name": "wizard_nav_next-3",
                    "cssclass_extra": "",
                    "html_id": ""
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  },
  {
    "page": 2,
    "content": [
      {
        "type": "field",
        "data": {
          "type": "steps_timeline",
          "usage_key": "steps_timeline",
          "steps_count": 2,
          "active_step": 2,
          "color": "#619d40",
          "label": "Steps_timeline",
          "cssclass_extra": "",
          "steps_scope_suffix": 1360,
          "id": "steps-timeline-sl4yc",
          "name": "steps-timeline-sl4yc",
          "html_id": ""
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-14-1773062762472",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "",
          "columns": [
            {
              "width": "48.5%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "text-firstname",
                    "type": "text",
                    "usage_key": "text-firstname",
                    "label": "First Name",
                    "name": "firstname",
                    "placeholder": "Example: \"John\"",
                    "required": 1,
                    "help": "Enter your first name.",
                    "cssclass": "firstname",
                    "min_width": "8em",
                    "html_id": ""
                  }
                }
              ]
            },
            {
              "width": "48.5%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "text-secondname",
                    "type": "text",
                    "usage_key": "text-secondname",
                    "label": "Last Name",
                    "name": "secondname",
                    "placeholder": "Example: \"Smith\"",
                    "required": 1,
                    "help": "Enter your last name.",
                    "cssclass": "secondname lastname",
                    "min_width": "8em",
                    "html_id": ""
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-16-1773062802362",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "",
          "columns": [
            {
              "width": "48.5%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "email",
                    "type": "email",
                    "usage_key": "email",
                    "label": "Email",
                    "usagenumber": 1,
                    "name": "email",
                    "html_id": "",
                    "cssclass": "",
                    "required": true,
                    "help": "Enter your email address."
                  }
                }
              ]
            },
            {
              "width": "48.5%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "text",
                    "type": "text",
                    "usage_key": "text",
                    "label": "Phone",
                    "name": "phone",
                    "cssclass": "",
                    "html_id": "",
                    "placeholder": "(000)  999 - 10 - 20",
                    "help": "Enter contact phone number"
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-17-1773062914950",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "textarea",
                    "type": "textarea",
                    "usage_key": "textarea",
                    "min_width": "260px",
                    "label": "Details",
                    "name": "details",
                    "cssclass": "",
                    "html_id": ""
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-21-1773063061362",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "accept_terms",
                    "type": "accept_terms",
                    "usage_key": "accept_terms",
                    "label": "Accept Terms",
                    "name": "accept_terms",
                    "required": 1,
                    "links": [
                      {
                        "key": "terms",
                        "text": "terms",
                        "link_type": "url",
                        "destination": "https://server.com/terms/",
                        "target": "_blank",
                        "cssclass": ""
                      },
                      {
                        "key": "conditions",
                        "text": "conditions",
                        "link_type": "url",
                        "destination": "https://server.com/conditions/",
                        "target": "_blank",
                        "cssclass": ""
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "type": "section",
        "data": {
          "id": "section-13-1773062424785",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"10px\",\"aself\":\"flex-end\"}]",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "divider_horizontal-2",
                    "type": "divider",
                    "usage_key": "divider_horizontal",
                    "orientation": "horizontal",
                    "line_style": "solid",
                    "thickness_px": 1,
                    "length": "100%",
                    "align": "center",
                    "color": "#e0e0e0",
                    "label": "Divider_horizontal",
                    "name": "divider_horizontal-2",
                    "margin_top_px": 2,
                    "margin_bottom_px": 2,
                    "margin_left_px": 2,
                    "margin_right_px": 2,
                    "cssclass_extra": "",
                    "html_id": ""
                  }
                },
                {
                  "type": "field",
                  "data": {
                    "id": "wizard_nav_next-2",
                    "type": "wizard_nav",
                    "usage_key": "wizard_nav_next",
                    "direction": "back",
                    "target_step": 1,
                    "label": "Back",
                    "name": "wizard_nav_next-2",
                    "cssclass_extra": "",
                    "html_id": ""
                  }
                },
                {
                  "type": "field",
                  "data": {
                    "id": "submit",
                    "type": "submit",
                    "usage_key": "submit",
                    "usagenumber": 1,
                    "label": "Send",
                    "name": "submit",
                    "cssclass": "wpbc_bfb__btn wpbc_bfb__btn--primary",
                    "html_id": ""
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  }
]
WPBC_BFB_TEMPLATE_STRUCTURE
);

$wpbc_form_2_steps_appointment_wizard_settings_json = trim(
<<<'WPBC_BFB_TEMPLATE_SETTINGS'
{"options":{"booking_form_theme":"","booking_form_layout_width":"100%","booking_type_of_day_selections":"single"},"css_vars":[],"bfb_options":{"advanced_mode_source":"builder"}}
WPBC_BFB_TEMPLATE_SETTINGS
);

$wpbc_form_2_steps_appointment_wizard_advanced_form = trim(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_FORM'
<div class="wpbc_bfb_form wpbc_wizard__border_container">
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step1">
		<r>
			<c style="flex-basis: 100%">
				<item>
					[steps_timeline steps_count="2" active_step="1" color="#619d40"]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-jc: center;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 8px;--wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
				<item>
					<l>Service</l>
					<br>[selectbox* durationtime class:wpbc_service_duration "Service A (20 min)@@00:20" "Service B (30 min)@@00:30" "Service C (45 min)@@00:45" "Service D (1 hour)@@01:00"]
				</item>
			</c>
		</r>
		<r>
			<c>
				<item>
					<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="horizontal" style="margin:2px 2px 2px 2px"><hr name="divider_horizontal" class="wpbc_bfb_divider wpbc_bfb_divider--h" style="border:none; height:0; border-top:1px solid #e0e0e0; width:100%; margin-left:auto; margin-right:auto"></div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 50.8384%; --wpbc-col-min: 0px">
				<item>
					<l>Select Date</l>
					<br>[calendar]
				</item>
			</c>
			<c style="flex-basis: 46.1616%; --wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
				<item>
					<l>Start time</l>
					<br>[selectbox* starttime "10:00 AM@@10:00" "10:30 AM@@10:30" "11:00 AM@@11:00" "11:30 AM@@11:30" "12:00 PM@@12:00" "12:30 PM@@12:30" "1:00 PM@@13:00" "1:30 PM@@13:30" "2:00 PM@@14:00" "2:30 PM@@14:30" "3:00 PM@@15:00" "3:30 PM@@15:30" "4:00 PM@@16:00" "4:30 PM@@16:30" "5:00 PM@@17:00" "5:30 PM@@17:30"]
				</item>
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
					[steps_timeline steps_count="2" active_step="2" color="#619d40"]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 48.5%">
				<item>
					<l>First Name</l>
					<br>[text* firstname class:firstname placeholder:"Example: 'John'"]
					<div class="wpbc_field_description">Enter your first name.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Last Name</l>
					<br>[text* secondname class:secondname class:lastname placeholder:"Example: 'Smith'"]
					<div class="wpbc_field_description">Enter your last name.</div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Email</l>
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
			<c style="flex-basis: 100%">
				<item>
					<l>Details</l>
					<br>[textarea details]
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%">
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
					<a class="wpbc_button_light wpbc_wizard_step_button wpbc_wizard_step_1">Back</a>
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

$wpbc_form_2_steps_appointment_wizard_content_form = trim(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class="standard-content-form">
	<b>Service</b>: <f>[durationtime_val] / [durationtime]</f><br>
	<b>Start time</b>: <f>[starttime]</f><br>
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
	'template_key' => 'time_appointments_2_steps_vertical_layout',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only', // 'insert_only' = insert once if missing, never overwrite existing row. | 'upsert' = insert if missing, update existing row when seed_version increases.
	'record'       => array(
		'form_slug'           => 'time_appointments_2_steps_vertical_layout',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_form_2_steps_appointment_wizard_structure_json,
		'settings_json'       => $wpbc_form_2_steps_appointment_wizard_settings_json,
		'advanced_form'       => $wpbc_form_2_steps_appointment_wizard_advanced_form,
		'content_form'        => $wpbc_form_2_steps_appointment_wizard_content_form,
		'is_default'          => 0,
		'title'               => 'Time-Slots / Appointments / 2 Steps / Vertical Layout',
		'description'         => 'Two-step appointment booking form with service selection, date and time scheduling, customer details, and a clean progress timeline.',
		'picture_url'         => 'time_appointments_2_steps_vertical_layout_01.png',
	),
);

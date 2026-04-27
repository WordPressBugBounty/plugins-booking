<?php
/**
 * Bundled BFB template: Full-Day Booking Form with Cost & Date Hints.
 *
 * @package Booking Calendar
 * @file ../includes/page-form-builder/save-load/template-records/template-cost_and_dates_hints_in_1step_advanced_form.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

$wpbc_cost_and_dates_hints_in_1step_advanced_form_01_structure_json = trim(
<<<'WPBC_BFB_TEMPLATE_STRUCTURE'
[
    {
        "page": 1,
        "content": [
            {
                "type": "section",
                "data": {
                    "id": "section-22-1776867571950",
                    "label": "Section",
                    "html_id": "",
                    "cssclass": "",
                    "col_styles": "[{},{\"dir\":\"row\",\"wrap\":\"wrap\",\"ai\":\"flex-start\",\"gap\":\"10px\"}]",
                    "columns": [
                        {
                            "width": "48.5%",
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
                            "width": "48.5%",
                            "items": [
                                {
                                    "type": "section",
                                    "data": {
                                        "id": "section-33-1776872751090",
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
                                                            "id": "resource_title_hint",
                                                            "type": "resource_title_hint",
                                                            "usage_key": "resource_title_hint",
                                                            "prefix_text": "Booking:",
                                                            "help": "",
                                                            "label": "Booking:",
                                                            "name": "resource_title_hint",
                                                            "html_id": "",
                                                            "cssclass": ""
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
                                        "id": "section-26-1776867848950",
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
                                                            "id": "check_in_date_hint",
                                                            "type": "check_in_date_hint",
                                                            "usage_key": "check_in_date_hint",
                                                            "prefix_text": "Check-in:",
                                                            "help": "",
                                                            "label": "Check-in:",
                                                            "name": "check_in_date_hint",
                                                            "html_id": "",
                                                            "cssclass": ""
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
                                                            "id": "check_out_date_hint",
                                                            "type": "check_out_date_hint",
                                                            "usage_key": "check_out_date_hint",
                                                            "prefix_text": "Check-out:",
                                                            "help": "",
                                                            "label": "Check-out:",
                                                            "name": "check_out_date_hint",
                                                            "html_id": "",
                                                            "cssclass": ""
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
                                        "id": "section-25-1776867813607",
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
                                                            "id": "nights_number_hint",
                                                            "type": "nights_number_hint",
                                                            "usage_key": "nights_number_hint",
                                                            "prefix_text": "Nights:",
                                                            "help": "",
                                                            "label": "Nights:",
                                                            "name": "nights_number_hint",
                                                            "html_id": "",
                                                            "cssclass": ""
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
                                        "id": "section-20-1776867347553",
                                        "label": "Section",
                                        "html_id": "",
                                        "cssclass": "",
                                        "col_styles": "[{\"gap\":\"10px\",\"aself\":\"stretch\"}]",
                                        "columns": [
                                            {
                                                "width": "100%",
                                                "items": [
                                                    {
                                                        "type": "field",
                                                        "data": {
                                                            "id": "capacity_hint",
                                                            "type": "capacity_hint",
                                                            "usage_key": "capacity_hint",
                                                            "prefix_text": "Availability:",
                                                            "help": "",
                                                            "label": "Availability:",
                                                            "name": "capacity_hint",
                                                            "html_id": "",
                                                            "cssclass": ""
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
                                        "id": "section-24-1776867726481",
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
                                                            "id": "cost_hint",
                                                            "type": "cost_hint",
                                                            "usage_key": "cost_hint",
                                                            "prefix_text": "Total Cost:",
                                                            "help": "",
                                                            "label": "Total Cost:",
                                                            "name": "cost_hint",
                                                            "html_id": "",
                                                            "cssclass": ""
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
                                    "type": "section",
                                    "data": {
                                        "id": "section-12-1773486431930",
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
                                                            "id": "select",
                                                            "type": "select",
                                                            "usage_key": "select",
                                                            "label": "Adults",
                                                            "name": "adults",
                                                            "min_width": "240px",
                                                            "html_id": "",
                                                            "cssclass": "",
                                                            "placeholder": "--- Select ---",
                                                            "options": [
                                                                {
                                                                    "label": "1",
                                                                    "value": "1",
                                                                    "selected": false
                                                                },
                                                                {
                                                                    "label": "2",
                                                                    "value": "2",
                                                                    "selected": false
                                                                },
                                                                {
                                                                    "label": "3",
                                                                    "value": "3",
                                                                    "selected": false
                                                                },
                                                                {
                                                                    "label": "4",
                                                                    "value": "4",
                                                                    "selected": false
                                                                }
                                                            ],
                                                            "required": 1,
                                                            "help": "Select  number of guests"
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
                                                            "id": "select-up5",
                                                            "type": "select",
                                                            "usage_key": "select",
                                                            "label": "Children",
                                                            "name": "children",
                                                            "min_width": "240px",
                                                            "html_id": "",
                                                            "cssclass": "",
                                                            "placeholder": "--- Select ---",
                                                            "options": [
                                                                {
                                                                    "label": "0",
                                                                    "value": "0",
                                                                    "selected": false
                                                                },
                                                                {
                                                                    "label": "1",
                                                                    "value": "1",
                                                                    "selected": false
                                                                },
                                                                {
                                                                    "label": "2",
                                                                    "value": "2",
                                                                    "selected": false
                                                                },
                                                                {
                                                                    "label": "3",
                                                                    "value": "3",
                                                                    "selected": false
                                                                }
                                                            ],
                                                            "help": "Select  number of children"
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
                }
            },
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
                    "id": "section-22-1776867571951",
                    "label": "Section",
                    "html_id": "",
                    "cssclass": "",
                    "col_styles": "[{\"dir\":\"row\",\"wrap\":\"wrap\",\"ai\":\"flex-start\",\"gap\":\"10px\"},{\"dir\":\"row\",\"wrap\":\"wrap\",\"ai\":\"flex-start\",\"gap\":\"10px\"}]",
                    "columns": [
                        {
                            "width": "71.7186%",
                            "items": [
                                {
                                    "type": "field",
                                    "data": {
                                        "id": "static_text-2",
                                        "type": "static_text",
                                        "usage_key": "static_text",
                                        "text": "Booking Data",
                                        "tag": "label",
                                        "align": "left",
                                        "bold": 1,
                                        "italic": 0,
                                        "html_allowed": 0,
                                        "nl2br": 1,
                                        "label": "Static_text",
                                        "name": "static_text-2",
                                        "html_id": "",
                                        "cssclass_extra": ""
                                    }
                                },
                                {
                                    "type": "section",
                                    "data": {
                                        "id": "section-26-1776867848951",
                                        "label": "Section",
                                        "html_id": "",
                                        "cssclass": "",
                                        "col_styles": "",
                                        "columns": [
                                            {
                                                "width": "31.3333%",
                                                "items": [
                                                    {
                                                        "type": "field",
                                                        "data": {
                                                            "id": "check_in_date_hint-2",
                                                            "type": "check_in_date_hint",
                                                            "usage_key": "check_in_date_hint",
                                                            "prefix_text": "Check-in:",
                                                            "help": "",
                                                            "label": "Check-in:",
                                                            "name": "check_in_date_hint-2",
                                                            "html_id": "",
                                                            "cssclass": ""
                                                        }
                                                    }
                                                ]
                                            },
                                            {
                                                "width": "31.3333%",
                                                "items": [
                                                    {
                                                        "type": "field",
                                                        "data": {
                                                            "id": "check_out_date_hint-2",
                                                            "type": "check_out_date_hint",
                                                            "usage_key": "check_out_date_hint",
                                                            "prefix_text": "Check-out:",
                                                            "help": "",
                                                            "label": "Check-out:",
                                                            "name": "check_out_date_hint-2",
                                                            "html_id": "",
                                                            "cssclass": ""
                                                        }
                                                    }
                                                ]
                                            },
                                            {
                                                "width": "31.3333%",
                                                "items": [
                                                    {
                                                        "type": "field",
                                                        "data": {
                                                            "id": "nights_number_hint-2",
                                                            "type": "nights_number_hint",
                                                            "usage_key": "nights_number_hint",
                                                            "prefix_text": "Nights:",
                                                            "help": "",
                                                            "label": "Nights:",
                                                            "name": "nights_number_hint-2",
                                                            "html_id": "",
                                                            "cssclass": ""
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
                            "width": "25.2814%",
                            "items": [
                                {
                                    "type": "field",
                                    "data": {
                                        "type": "static_text",
                                        "usage_key": "static_text",
                                        "text": "Booking Cost",
                                        "tag": "label",
                                        "align": "left",
                                        "bold": 1,
                                        "italic": 0,
                                        "html_allowed": 0,
                                        "nl2br": 1,
                                        "label": "Static_text",
                                        "cssclass_extra": "",
                                        "id": "static-text-blyy7",
                                        "name": "static-text-blyy7",
                                        "html_id": ""
                                    }
                                },
                                {
                                    "type": "section",
                                    "data": {
                                        "id": "section-24-1776867726482",
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
                                                            "id": "cost_hint-2",
                                                            "type": "cost_hint",
                                                            "usage_key": "cost_hint",
                                                            "prefix_text": "Total Cost:",
                                                            "help": "",
                                                            "label": "Total Cost:",
                                                            "name": "cost_hint-2",
                                                            "html_id": "",
                                                            "cssclass": ""
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

$wpbc_cost_and_dates_hints_in_1step_advanced_form_01_settings_json = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_SETTINGS'
{\"options\":{\"booking_form_theme\":\"\",\"booking_form_layout_width\":\"100%\",\"booking_type_of_day_selections\":\"\"},\"css_vars\":[],\"bfb_options\":{\"advanced_mode_source\":\"builder\"}}
WPBC_BFB_TEMPLATE_SETTINGS
	)
);

$wpbc_cost_and_dates_hints_in_1step_advanced_form_01_advanced_form = trim(
<<<'WPBC_BFB_TEMPLATE_ADVANCED_FORM'
<div class="wpbc_bfb_form wpbc_wizard__border_container">
	<div class="wpbc_wizard_step wpbc__form__div wpbc_wizard_step1">
		<r>
			<c style="flex-basis: 48.5%; --wpbc-col-min: 0px">
				<item>
					<l>Select Date</l>
					<br>[calendar]
				</item>
			</c>
			<c style="flex-basis: 48.5%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
				<r>
					<c style="flex-basis: 100%">
						<item>
							Booking:&nbsp;<strong>[resource_title_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 48.5%">
						<item>
							Check-in:&nbsp;<strong>[check_in_date_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 48.5%">
						<item>
							Check-out:&nbsp;<strong>[check_out_date_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Nights:&nbsp;<strong>[nights_number_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%; --wpbc-bfb-col-gap: 10px;--wpbc-bfb-col-aself: stretch;--wpbc-col-min: 0px">
						<item>
							Availability:&nbsp;<strong>[capacity_hint]</strong>
						</item>
					</c>
				</r>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Total Cost:&nbsp;<strong>[cost_hint]</strong>
						</item>
					</c>
				</r>
			</c>
		</r>
		<r>
			<c style="flex-basis: 48.5%">
				<item>
					<l>First Name*</l>
					<br>[text* firstname class:firstname placeholder:"Example: 'John'"]
					<div class="wpbc_field_description">Enter your first name.</div>
				</item>
			</c>
			<c style="flex-basis: 48.5%">
				<item>
					<l>Last Name*</l>
					<br>[text* secondname class:secondname class:lastname placeholder:"Example: 'Smith'"]
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
					<br>[text phone placeholder:"(000)  999 - 10 - 20"]
					<div class="wpbc_field_description">Enter contact phone number</div>
				</item>
			</c>
		</r>
		<r>
			<c style="flex-basis: 100%">
				<r>
					<c style="flex-basis: 48.5%">
						<item>
							<l>Adults*</l>
							<br>[selectbox* adults "--- Select ---@@" "1" "2" "3" "4"]
							<div class="wpbc_field_description">Select  number of guests</div>
						</item>
					</c>
					<c style="flex-basis: 48.5%">
						<item>
							<l>Children</l>
							<br>[selectbox children "--- Select ---@@" "0" "1" "2" "3"]
							<div class="wpbc_field_description">Select  number of children</div>
						</item>
					</c>
				</r>
			</c>
		</r>
		<r>
			<c>
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
			<c style="flex-basis: 71.7186%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
				<item>
					<label name="static_text-2" class="wpbc_static_text" style="text-align:left;font-weight:bold">Booking Data</label>
				</item>
				<r>
					<c style="flex-basis: 31.3333%">
						<item>
							Check-in:&nbsp;<strong>[check_in_date_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 31.3333%">
						<item>
							Check-out:&nbsp;<strong>[check_out_date_hint]</strong>
						</item>
					</c>
					<c style="flex-basis: 31.3333%">
						<item>
							Nights:&nbsp;<strong>[nights_number_hint]</strong>
						</item>
					</c>
				</r>
			</c>
			<c style="flex-basis: 25.2814%; --wpbc-bfb-col-dir: row;--wpbc-bfb-col-wrap: wrap;--wpbc-bfb-col-ai: flex-start;--wpbc-bfb-col-gap: 10px;--wpbc-col-min: 0px">
				<item>
					<label name="static-text-blyy7" class="wpbc_static_text" style="text-align:left;font-weight:bold">Booking Cost</label>
				</item>
				<r>
					<c style="flex-basis: 100%">
						<item>
							Total Cost:&nbsp;<strong>[cost_hint]</strong>
						</item>
					</c>
				</r>
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
</div>
WPBC_BFB_TEMPLATE_ADVANCED_FORM
);


$wpbc_cost_and_dates_hints_in_1step_advanced_form_01_content_form = trim(
	stripcslashes(
<<<'WPBC_BFB_TEMPLATE_CONTENT_FORM'
<div class=\"standard-content-form\">\n	<b>First Name</b>: <f>[firstname]</f><br>\n	<b>Last Name</b>: <f>[secondname]</f><br>\n	<b>Email</b>: <f>[email]</f><br>\n	<b>Phone</b>: <f>[phone]</f><br>\n	<b>Adults</b>: <f>[adults]</f><br>\n	<b>Children</b>: <f>[children]</f><br>\n	<b>Details</b>: <f>[details]</f><br>\n	<b>Accept Terms</b>: <f>[accept_terms]</f><br>\n</div>
WPBC_BFB_TEMPLATE_CONTENT_FORM
	)
);

return array(
	'template_key' => 'dates_advanced_form_with_hints',
	'seed_version' => '10.15',
	'sync_mode'    => 'insert_only', // 'insert_only' = insert once if missing, never overwrite existing row. | 'upsert' = insert if missing, update existing row when seed_version increases.
	'record'       => array(
		'form_slug'           => 'dates_advanced_form_with_hints',
		'status'              => 'template',
		'scope'               => 'global',
		'version'             => 1,
		'booking_resource_id' => null,
		'owner_user_id'       => 0,
		'engine'              => 'bfb',
		'engine_version'      => '1.0',
		'structure_json'      => $wpbc_cost_and_dates_hints_in_1step_advanced_form_01_structure_json,
		'settings_json'       => $wpbc_cost_and_dates_hints_in_1step_advanced_form_01_settings_json,
		'advanced_form'       => $wpbc_cost_and_dates_hints_in_1step_advanced_form_01_advanced_form,
		'content_form'        => $wpbc_cost_and_dates_hints_in_1step_advanced_form_01_content_form,
		'is_default'          => 0,
		'title'               => 'Full-Day / Advanced / Form with Hints',
		'description'         => 'One-step full-day booking form with guest details, adults and children selectors, and advanced hints for selected dates and total cost. Useful for setups with changeover dates enabled.',
		'picture_url'         => 'dates_advanced_form_with_hints_01.png',
	),
);

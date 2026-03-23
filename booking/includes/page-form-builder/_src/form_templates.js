// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/form_templates.js == Time point:  2025-08-28 19:11
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Example serialized form structure used as initial data/fallback.
 *
 * @returns {Array<Object>} Pages array compatible with `load_saved_structure()`.
 */
function wpbc_bfb__form_structure__get_example() {
	return [
  {
    "page": 1,
    "content": [
      {
        "type": "section",
        "data": {
          "id": "section-3-1758289897531",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "[{\"aself\":\"stretch\"},{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"center\",\"ai\":\"center\",\"aself\":\"stretch\"},{\"aself\":\"stretch\"}]",
          "columns": [
            {
              "width": "41.1303%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "calendar",
                    "type": "calendar",
                    "usage_key": "calendar",
                    "usagenumber": 1,
                    "resource_id": 3,
                    "months": 1,
                    "label": "Select  dates",
                    "min_width": "250px",
                    "name": "calendar",
                    "help": ""
                  }
                }
              ]
            },
            {
              "width": "0.1%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "type": "divider",
                    "usage_key": "divider_vertical",
                    "orientation": "vertical",
                    "line_style": "solid",
                    "thickness_px": 1,
                    "length": "90%",
                    "align": "middle",
                    "color": "#ccc",
                    "label": "Divider_vertical",
                    "margin_top_px": 0,
                    "margin_bottom_px": 0,
                    "margin_left_px": 0,
                    "margin_right_px": 0,
                    "cssclass_extra": "",
                    "id": "divider-vertical-64z2s",
                    "name": "divider-vertical-64z2s",
                    "html_id": ""
                  }
                }
              ]
            },
            {
              "width": "52.7697%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "input-text",
                    "type": "text",
                    "min_width": "8em",
                    "label": "First Name",
                    "usage_key": "text",
                    "name": "firstname",
                    "placeholder": "Example: \"John\"",
                    "required": 1,
                    "help": "Enter your first name.",
                    "minlength": 5,
                    "maxlength": 10,
                    "pattern": "aaa",
                    "cssclass": "firstname myname",
                    "html_id": "my-name"
                  }
                },
                {
                  "type": "field",
                  "data": {
                    "type": "text",
                    "min_width": "8em",
                    "label": "Second Name",
                    "usage_key": "text",
                    "placeholder": "Example: \"Smith\"",
                    "required": 1,
                    "help": "Enter your last name.",
                    "minlength": 7,
                    "maxlength": 12,
                    "pattern": "bb",
                    "cssclass": "secondname lastname",
                    "id": "first-name-vd18d",
                    "name": "secondname",
                    "html_id": "my-lastname"
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
                    "thickness_px": 2,
                    "length": "100%",
                    "align": "center",
                    "color": "#e0e0e0",
                    "label": "Divider_horizontal",
                    "name": "divider_horizontal",
                    "margin_top_px": 8,
                    "margin_bottom_px": 8,
                    "margin_left_px": 8,
                    "margin_right_px": 8,
                    "cssclass_extra": "",
                    "html_id": ""
                  }
                },
                {
                  "type": "field",
                  "data": {
                    "id": "select",
                    "type": "select",
                    "usage_key": "select",
                    "label": "Persons",
                    "name": "visitors",
                    "min_width": "100px",
                    "html_id": "personsandvisitorsid",
                    "cssclass": "persons_css visitors_css",
                    "placeholder": "--- Select ---",
                    "options": [
                      {
                        "label": "Person 1",
                        "value": "1",
                        "selected": false
                      },
                      {
                        "label": "Person 2",
                        "value": "2",
                        "selected": false
                      },
                      {
                        "label": "Option 3",
                        "value": "3",
                        "selected": false
                      },
                      {
                        "label": "More than 4",
                        "value": "4-10",
                        "selected": false
                      }
                    ],
                    "help": "Select  number of visitors",
                    "required": 1,
                    "size": 4,
                    "default_value": ""
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
          "id": "section-5-1758537550476",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"9px\",\"aself\":\"flex-end\"}]",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "type": "divider",
                    "usage_key": "divider_vertical",
                    "orientation": "horizontal",
                    "line_style": "solid",
                    "thickness_px": 1,
                    "length": "100%",
                    "align": "center",
                    "color": "#ccc",
                    "label": "Divider_vertical",
                    "margin_top_px": 0,
                    "margin_bottom_px": 0,
                    "margin_left_px": 0,
                    "margin_right_px": 0,
                    "cssclass_extra": "",
                    "id": "divider-vertical-he40a",
                    "name": "divider-vertical-he40a",
                    "html_id": ""
                  }
                },
                {
                  "type": "field",
                  "data": {
                    "id": "wizard_nav_next",
                    "type": "wizard_nav",
                    "usage_key": "wizard_nav_next",
                    "direction": "next",
                    "target_step": 2,
                    "label": "Next",
                    "name": "wizard_nav_next",
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
        "type": "section",
        "data": {
          "id": "section-4-1758634530779",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "",
          "columns": [
            {
              "width": "28.6112%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "radio",
                    "type": "radio",
                    "usage_key": "radio",
                    "label": "Radio buttons",
                    "name": "radio",
                    "min_width": "240px",
                    "html_id": "",
                    "cssclass": "group_inline",
                    "placeholder": "--- Select ---",
                    "options": [
                      {
                        "label": "Option 1",
                        "value": "Option 1",
                        "selected": false
                      },
                      {
                        "label": "Option 2",
                        "value": "Option 2",
                        "selected": false
                      },
                      {
                        "label": "Option 3",
                        "value": "Option 3",
                        "selected": false
                      },
                      {
                        "label": "Option 4",
                        "value": "Option 4",
                        "selected": false
                      }
                    ],
                    "layout_inline": 1
                  }
                }
              ]
            },
            {
              "width": "28.6112%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "checkbox",
                    "type": "checkbox",
                    "usage_key": "checkbox",
                    "label": "Checkboxes",
                    "name": "checkbox",
                    "min_width": "240px",
                    "html_id": "",
                    "cssclass": "group_inline",
                    "options": [
                      {
                        "label": "Option 1",
                        "value": "Option 1",
                        "selected": false
                      },
                      {
                        "label": "Option 2",
                        "value": "Option 2",
                        "selected": false
                      },
                      {
                        "label": "Option 3",
                        "value": "Option 3",
                        "selected": false
                      }
                    ],
                    "placeholder": "--- Select ---",
                    "multiple": 1,
                    "layout_inline": 1
                  }
                }
              ]
            },
            {
              "width": "36.7777%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "select-7yq",
                    "type": "select",
                    "usage_key": "select",
                    "label": "Select",
                    "name": "select-7yq",
                    "min_width": "240px",
                    "html_id": "",
                    "cssclass": "",
                    "placeholder": "--- Select ---",
                    "options": [
                      {
                        "label": "Option 1",
                        "value": "Option 1",
                        "selected": false
                      },
                      {
                        "label": "Option 2",
                        "value": "Option 2",
                        "selected": false
                      },
                      {
                        "label": "Option 3",
                        "value": "Option 3",
                        "selected": false
                      },
                      {
                        "label": "Option 4",
                        "value": "Option 4",
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
        "type": "section",
        "data": {
          "id": "section-5-1758537550477",
          "label": "Section",
          "html_id": "",
          "cssclass": "",
          "col_styles": "[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"9px\",\"aself\":\"flex-end\"}]",
          "columns": [
            {
              "width": "100%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "type": "divider",
                    "usage_key": "divider_vertical",
                    "orientation": "horizontal",
                    "line_style": "solid",
                    "thickness_px": 1,
                    "length": "100%",
                    "align": "center",
                    "color": "#ccc",
                    "label": "Divider_vertical",
                    "margin_top_px": 0,
                    "margin_bottom_px": 0,
                    "margin_left_px": 0,
                    "margin_right_px": 0,
                    "cssclass_extra": "",
                    "id": "divider-vertical-he40a-2",
                    "name": "divider-vertical-he40a-2",
                    "html_id": ""
                  }
                },
                {
                  "type": "field",
                  "data": {
                    "id": "wizard_nav_back-2",
                    "type": "wizard_nav",
                    "usage_key": "wizard_nav_back",
                    "direction": "back",
                    "target_step": 1,
                    "label": "Back",
                    "name": "wizard_nav_back-2",
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
];
}

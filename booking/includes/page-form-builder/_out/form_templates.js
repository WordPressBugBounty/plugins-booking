"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/form_templates.js == Time point:  2025-08-28 19:11
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Example serialized form structure used as initial data/fallback.
 *
 * @returns {Array<Object>} Pages array compatible with `load_saved_structure()`.
 */
function wpbc_bfb__form_structure__get_example() {
  return [{
    "page": 1,
    "content": [{
      "type": "section",
      "data": {
        "id": "section-3-1758289897531",
        "label": "Section",
        "html_id": "",
        "cssclass": "",
        "col_styles": "[{\"aself\":\"stretch\"},{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"center\",\"ai\":\"center\",\"aself\":\"stretch\"},{\"aself\":\"stretch\"}]",
        "columns": [{
          "width": "41.1303%",
          "items": [{
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
          }]
        }, {
          "width": "0.1%",
          "items": [{
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
          }]
        }, {
          "width": "52.7697%",
          "items": [{
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
          }, {
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
          }, {
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
          }, {
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
              "options": [{
                "label": "Person 1",
                "value": "1",
                "selected": false
              }, {
                "label": "Person 2",
                "value": "2",
                "selected": false
              }, {
                "label": "Option 3",
                "value": "3",
                "selected": false
              }, {
                "label": "More than 4",
                "value": "4-10",
                "selected": false
              }],
              "help": "Select  number of visitors",
              "required": 1,
              "size": 4,
              "default_value": ""
            }
          }]
        }]
      }
    }, {
      "type": "section",
      "data": {
        "id": "section-5-1758537550476",
        "label": "Section",
        "html_id": "",
        "cssclass": "",
        "col_styles": "[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"9px\",\"aself\":\"flex-end\"}]",
        "columns": [{
          "width": "100%",
          "items": [{
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
          }, {
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
          }]
        }]
      }
    }]
  }, {
    "page": 2,
    "content": [{
      "type": "section",
      "data": {
        "id": "section-4-1758634530779",
        "label": "Section",
        "html_id": "",
        "cssclass": "",
        "col_styles": "",
        "columns": [{
          "width": "28.6112%",
          "items": [{
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
              "options": [{
                "label": "Option 1",
                "value": "Option 1",
                "selected": false
              }, {
                "label": "Option 2",
                "value": "Option 2",
                "selected": false
              }, {
                "label": "Option 3",
                "value": "Option 3",
                "selected": false
              }, {
                "label": "Option 4",
                "value": "Option 4",
                "selected": false
              }],
              "layout_inline": 1
            }
          }]
        }, {
          "width": "28.6112%",
          "items": [{
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
              "options": [{
                "label": "Option 1",
                "value": "Option 1",
                "selected": false
              }, {
                "label": "Option 2",
                "value": "Option 2",
                "selected": false
              }, {
                "label": "Option 3",
                "value": "Option 3",
                "selected": false
              }],
              "placeholder": "--- Select ---",
              "multiple": 1,
              "layout_inline": 1
            }
          }]
        }, {
          "width": "36.7777%",
          "items": [{
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
              "options": [{
                "label": "Option 1",
                "value": "Option 1",
                "selected": false
              }, {
                "label": "Option 2",
                "value": "Option 2",
                "selected": false
              }, {
                "label": "Option 3",
                "value": "Option 3",
                "selected": false
              }, {
                "label": "Option 4",
                "value": "Option 4",
                "selected": false
              }]
            }
          }]
        }]
      }
    }, {
      "type": "section",
      "data": {
        "id": "section-5-1758537550477",
        "label": "Section",
        "html_id": "",
        "cssclass": "",
        "col_styles": "[{\"dir\":\"row\",\"wrap\":\"wrap\",\"jc\":\"flex-end\",\"ai\":\"flex-end\",\"gap\":\"9px\",\"aself\":\"flex-end\"}]",
        "columns": [{
          "width": "100%",
          "items": [{
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
          }, {
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
          }, {
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
          }]
        }]
      }
    }]
  }];
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9mb3JtX3RlbXBsYXRlcy5qcyIsIm5hbWVzIjpbIndwYmNfYmZiX19mb3JtX3N0cnVjdHVyZV9fZ2V0X2V4YW1wbGUiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2Zvcm1fdGVtcGxhdGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvX291dC9mb3JtX3RlbXBsYXRlcy5qcyA9PSBUaW1lIHBvaW50OiAgMjAyNS0wOC0yOCAxOToxMVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBFeGFtcGxlIHNlcmlhbGl6ZWQgZm9ybSBzdHJ1Y3R1cmUgdXNlZCBhcyBpbml0aWFsIGRhdGEvZmFsbGJhY2suXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtBcnJheTxPYmplY3Q+fSBQYWdlcyBhcnJheSBjb21wYXRpYmxlIHdpdGggYGxvYWRfc2F2ZWRfc3RydWN0dXJlKClgLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19iZmJfX2Zvcm1fc3RydWN0dXJlX19nZXRfZXhhbXBsZSgpIHtcclxuXHRyZXR1cm4gW1xyXG4gIHtcclxuICAgIFwicGFnZVwiOiAxLFxyXG4gICAgXCJjb250ZW50XCI6IFtcclxuICAgICAge1xyXG4gICAgICAgIFwidHlwZVwiOiBcInNlY3Rpb25cIixcclxuICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgXCJpZFwiOiBcInNlY3Rpb24tMy0xNzU4Mjg5ODk3NTMxXCIsXHJcbiAgICAgICAgICBcImxhYmVsXCI6IFwiU2VjdGlvblwiLFxyXG4gICAgICAgICAgXCJodG1sX2lkXCI6IFwiXCIsXHJcbiAgICAgICAgICBcImNzc2NsYXNzXCI6IFwiXCIsXHJcbiAgICAgICAgICBcImNvbF9zdHlsZXNcIjogXCJbe1xcXCJhc2VsZlxcXCI6XFxcInN0cmV0Y2hcXFwifSx7XFxcImRpclxcXCI6XFxcInJvd1xcXCIsXFxcIndyYXBcXFwiOlxcXCJ3cmFwXFxcIixcXFwiamNcXFwiOlxcXCJjZW50ZXJcXFwiLFxcXCJhaVxcXCI6XFxcImNlbnRlclxcXCIsXFxcImFzZWxmXFxcIjpcXFwic3RyZXRjaFxcXCJ9LHtcXFwiYXNlbGZcXFwiOlxcXCJzdHJldGNoXFxcIn1dXCIsXHJcbiAgICAgICAgICBcImNvbHVtbnNcIjogW1xyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgXCJ3aWR0aFwiOiBcIjQxLjEzMDMlXCIsXHJcbiAgICAgICAgICAgICAgXCJpdGVtc1wiOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImZpZWxkXCIsXHJcbiAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiBcImNhbGVuZGFyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiY2FsZW5kYXJcIixcclxuICAgICAgICAgICAgICAgICAgICBcInVzYWdlX2tleVwiOiBcImNhbGVuZGFyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZW51bWJlclwiOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgIFwicmVzb3VyY2VfaWRcIjogMyxcclxuICAgICAgICAgICAgICAgICAgICBcIm1vbnRoc1wiOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJTZWxlY3QgIGRhdGVzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJtaW5fd2lkdGhcIjogXCIyNTBweFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcImNhbGVuZGFyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJoZWxwXCI6IFwiXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIFwid2lkdGhcIjogXCIwLjElXCIsXHJcbiAgICAgICAgICAgICAgXCJpdGVtc1wiOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImZpZWxkXCIsXHJcbiAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiZGl2aWRlclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidXNhZ2Vfa2V5XCI6IFwiZGl2aWRlcl92ZXJ0aWNhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwib3JpZW50YXRpb25cIjogXCJ2ZXJ0aWNhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGluZV9zdHlsZVwiOiBcInNvbGlkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ0aGlja25lc3NfcHhcIjogMSxcclxuICAgICAgICAgICAgICAgICAgICBcImxlbmd0aFwiOiBcIjkwJVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiYWxpZ25cIjogXCJtaWRkbGVcIixcclxuICAgICAgICAgICAgICAgICAgICBcImNvbG9yXCI6IFwiI2NjY1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJEaXZpZGVyX3ZlcnRpY2FsXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJtYXJnaW5fdG9wX3B4XCI6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJtYXJnaW5fYm90dG9tX3B4XCI6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJtYXJnaW5fbGVmdF9weFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX3JpZ2h0X3B4XCI6IDAsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJjc3NjbGFzc19leHRyYVwiOiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJkaXZpZGVyLXZlcnRpY2FsLTY0ejJzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiZGl2aWRlci12ZXJ0aWNhbC02NHoyc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaHRtbF9pZFwiOiBcIlwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBcIndpZHRoXCI6IFwiNTIuNzY5NyVcIixcclxuICAgICAgICAgICAgICBcIml0ZW1zXCI6IFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiZmllbGRcIixcclxuICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgICAgICAgICAgICBcImlkXCI6IFwiaW5wdXQtdGV4dFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcInRleHRcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm1pbl93aWR0aFwiOiBcIjhlbVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJGaXJzdCBOYW1lXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZV9rZXlcIjogXCJ0ZXh0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiZmlyc3RuYW1lXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJwbGFjZWhvbGRlclwiOiBcIkV4YW1wbGU6IFxcXCJKb2huXFxcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwicmVxdWlyZWRcIjogMSxcclxuICAgICAgICAgICAgICAgICAgICBcImhlbHBcIjogXCJFbnRlciB5b3VyIGZpcnN0IG5hbWUuXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJtaW5sZW5ndGhcIjogNSxcclxuICAgICAgICAgICAgICAgICAgICBcIm1heGxlbmd0aFwiOiAxMCxcclxuICAgICAgICAgICAgICAgICAgICBcInBhdHRlcm5cIjogXCJhYWFcIixcclxuICAgICAgICAgICAgICAgICAgICBcImNzc2NsYXNzXCI6IFwiZmlyc3RuYW1lIG15bmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaHRtbF9pZFwiOiBcIm15LW5hbWVcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcInRleHRcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm1pbl93aWR0aFwiOiBcIjhlbVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJTZWNvbmQgTmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidXNhZ2Vfa2V5XCI6IFwidGV4dFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwicGxhY2Vob2xkZXJcIjogXCJFeGFtcGxlOiBcXFwiU21pdGhcXFwiXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJyZXF1aXJlZFwiOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaGVscFwiOiBcIkVudGVyIHlvdXIgbGFzdCBuYW1lLlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWlubGVuZ3RoXCI6IDcsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJtYXhsZW5ndGhcIjogMTIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJwYXR0ZXJuXCI6IFwiYmJcIixcclxuICAgICAgICAgICAgICAgICAgICBcImNzc2NsYXNzXCI6IFwic2Vjb25kbmFtZSBsYXN0bmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJmaXJzdC1uYW1lLXZkMThkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwic2Vjb25kbmFtZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaHRtbF9pZFwiOiBcIm15LWxhc3RuYW1lXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiZmllbGRcIixcclxuICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgICAgICAgICAgICBcImlkXCI6IFwiZGl2aWRlcl9ob3Jpem9udGFsXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiZGl2aWRlclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidXNhZ2Vfa2V5XCI6IFwiZGl2aWRlcl9ob3Jpem9udGFsXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJvcmllbnRhdGlvblwiOiBcImhvcml6b250YWxcIixcclxuICAgICAgICAgICAgICAgICAgICBcImxpbmVfc3R5bGVcIjogXCJzb2xpZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidGhpY2tuZXNzX3B4XCI6IDIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsZW5ndGhcIjogXCIxMDAlXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJhbGlnblwiOiBcImNlbnRlclwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sb3JcIjogXCIjZTBlMGUwXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIkRpdmlkZXJfaG9yaXpvbnRhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcImRpdmlkZXJfaG9yaXpvbnRhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX3RvcF9weFwiOiA4LFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX2JvdHRvbV9weFwiOiA4LFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX2xlZnRfcHhcIjogOCxcclxuICAgICAgICAgICAgICAgICAgICBcIm1hcmdpbl9yaWdodF9weFwiOiA4LFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY3NzY2xhc3NfZXh0cmFcIjogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICBcImh0bWxfaWRcIjogXCJcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJzZWxlY3RcIixcclxuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJzZWxlY3RcIixcclxuICAgICAgICAgICAgICAgICAgICBcInVzYWdlX2tleVwiOiBcInNlbGVjdFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJQZXJzb25zXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwidmlzaXRvcnNcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm1pbl93aWR0aFwiOiBcIjEwMHB4XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJodG1sX2lkXCI6IFwicGVyc29uc2FuZHZpc2l0b3JzaWRcIixcclxuICAgICAgICAgICAgICAgICAgICBcImNzc2NsYXNzXCI6IFwicGVyc29uc19jc3MgdmlzaXRvcnNfY3NzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJwbGFjZWhvbGRlclwiOiBcIi0tLSBTZWxlY3QgLS0tXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJvcHRpb25zXCI6IFtcclxuICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIlBlcnNvbiAxXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidmFsdWVcIjogXCIxXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwic2VsZWN0ZWRcIjogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJQZXJzb24gMlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInZhbHVlXCI6IFwiMlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInNlbGVjdGVkXCI6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiT3B0aW9uIDNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ2YWx1ZVwiOiBcIjNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJzZWxlY3RlZFwiOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIk1vcmUgdGhhbiA0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidmFsdWVcIjogXCI0LTEwXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwic2VsZWN0ZWRcIjogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaGVscFwiOiBcIlNlbGVjdCAgbnVtYmVyIG9mIHZpc2l0b3JzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJyZXF1aXJlZFwiOiAxLFxyXG4gICAgICAgICAgICAgICAgICAgIFwic2l6ZVwiOiA0LFxyXG4gICAgICAgICAgICAgICAgICAgIFwiZGVmYXVsdF92YWx1ZVwiOiBcIlwiXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBcInR5cGVcIjogXCJzZWN0aW9uXCIsXHJcbiAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgIFwiaWRcIjogXCJzZWN0aW9uLTUtMTc1ODUzNzU1MDQ3NlwiLFxyXG4gICAgICAgICAgXCJsYWJlbFwiOiBcIlNlY3Rpb25cIixcclxuICAgICAgICAgIFwiaHRtbF9pZFwiOiBcIlwiLFxyXG4gICAgICAgICAgXCJjc3NjbGFzc1wiOiBcIlwiLFxyXG4gICAgICAgICAgXCJjb2xfc3R5bGVzXCI6IFwiW3tcXFwiZGlyXFxcIjpcXFwicm93XFxcIixcXFwid3JhcFxcXCI6XFxcIndyYXBcXFwiLFxcXCJqY1xcXCI6XFxcImZsZXgtZW5kXFxcIixcXFwiYWlcXFwiOlxcXCJmbGV4LWVuZFxcXCIsXFxcImdhcFxcXCI6XFxcIjlweFxcXCIsXFxcImFzZWxmXFxcIjpcXFwiZmxleC1lbmRcXFwifV1cIixcclxuICAgICAgICAgIFwiY29sdW1uc1wiOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBcIndpZHRoXCI6IFwiMTAwJVwiLFxyXG4gICAgICAgICAgICAgIFwiaXRlbXNcIjogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImRpdmlkZXJcIixcclxuICAgICAgICAgICAgICAgICAgICBcInVzYWdlX2tleVwiOiBcImRpdmlkZXJfdmVydGljYWxcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm9yaWVudGF0aW9uXCI6IFwiaG9yaXpvbnRhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGluZV9zdHlsZVwiOiBcInNvbGlkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ0aGlja25lc3NfcHhcIjogMSxcclxuICAgICAgICAgICAgICAgICAgICBcImxlbmd0aFwiOiBcIjEwMCVcIixcclxuICAgICAgICAgICAgICAgICAgICBcImFsaWduXCI6IFwiY2VudGVyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiNjY2NcIixcclxuICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiRGl2aWRlcl92ZXJ0aWNhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX3RvcF9weFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX2JvdHRvbV9weFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX2xlZnRfcHhcIjogMCxcclxuICAgICAgICAgICAgICAgICAgICBcIm1hcmdpbl9yaWdodF9weFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY3NzY2xhc3NfZXh0cmFcIjogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICBcImlkXCI6IFwiZGl2aWRlci12ZXJ0aWNhbC1oZTQwYVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcImRpdmlkZXItdmVydGljYWwtaGU0MGFcIixcclxuICAgICAgICAgICAgICAgICAgICBcImh0bWxfaWRcIjogXCJcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJ3aXphcmRfbmF2X25leHRcIixcclxuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJ3aXphcmRfbmF2XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZV9rZXlcIjogXCJ3aXphcmRfbmF2X25leHRcIixcclxuICAgICAgICAgICAgICAgICAgICBcImRpcmVjdGlvblwiOiBcIm5leHRcIixcclxuICAgICAgICAgICAgICAgICAgICBcInRhcmdldF9zdGVwXCI6IDIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIk5leHRcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJ3aXphcmRfbmF2X25leHRcIixcclxuICAgICAgICAgICAgICAgICAgICBcImNzc2NsYXNzX2V4dHJhXCI6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJodG1sX2lkXCI6IFwiXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgXVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgXVxyXG4gIH0sXHJcbiAge1xyXG4gICAgXCJwYWdlXCI6IDIsXHJcbiAgICBcImNvbnRlbnRcIjogW1xyXG4gICAgICB7XHJcbiAgICAgICAgXCJ0eXBlXCI6IFwic2VjdGlvblwiLFxyXG4gICAgICAgIFwiZGF0YVwiOiB7XHJcbiAgICAgICAgICBcImlkXCI6IFwic2VjdGlvbi00LTE3NTg2MzQ1MzA3NzlcIixcclxuICAgICAgICAgIFwibGFiZWxcIjogXCJTZWN0aW9uXCIsXHJcbiAgICAgICAgICBcImh0bWxfaWRcIjogXCJcIixcclxuICAgICAgICAgIFwiY3NzY2xhc3NcIjogXCJcIixcclxuICAgICAgICAgIFwiY29sX3N0eWxlc1wiOiBcIlwiLFxyXG4gICAgICAgICAgXCJjb2x1bW5zXCI6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIFwid2lkdGhcIjogXCIyOC42MTEyJVwiLFxyXG4gICAgICAgICAgICAgIFwiaXRlbXNcIjogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJyYWRpb1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcInJhZGlvXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZV9rZXlcIjogXCJyYWRpb1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJSYWRpbyBidXR0b25zXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwicmFkaW9cIixcclxuICAgICAgICAgICAgICAgICAgICBcIm1pbl93aWR0aFwiOiBcIjI0MHB4XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJodG1sX2lkXCI6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJjc3NjbGFzc1wiOiBcImdyb3VwX2lubGluZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwicGxhY2Vob2xkZXJcIjogXCItLS0gU2VsZWN0IC0tLVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwib3B0aW9uc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJPcHRpb24gMVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInZhbHVlXCI6IFwiT3B0aW9uIDFcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJzZWxlY3RlZFwiOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIk9wdGlvbiAyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidmFsdWVcIjogXCJPcHRpb24gMlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInNlbGVjdGVkXCI6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiT3B0aW9uIDNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ2YWx1ZVwiOiBcIk9wdGlvbiAzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwic2VsZWN0ZWRcIjogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJPcHRpb24gNFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInZhbHVlXCI6IFwiT3B0aW9uIDRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJzZWxlY3RlZFwiOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsYXlvdXRfaW5saW5lXCI6IDFcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIF1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIFwid2lkdGhcIjogXCIyOC42MTEyJVwiLFxyXG4gICAgICAgICAgICAgIFwiaXRlbXNcIjogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJjaGVja2JveFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImNoZWNrYm94XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZV9rZXlcIjogXCJjaGVja2JveFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJDaGVja2JveGVzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiY2hlY2tib3hcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm1pbl93aWR0aFwiOiBcIjI0MHB4XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJodG1sX2lkXCI6IFwiXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJjc3NjbGFzc1wiOiBcImdyb3VwX2lubGluZVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwib3B0aW9uc1wiOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJPcHRpb24gMVwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInZhbHVlXCI6IFwiT3B0aW9uIDFcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJzZWxlY3RlZFwiOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIk9wdGlvbiAyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidmFsdWVcIjogXCJPcHRpb24gMlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInNlbGVjdGVkXCI6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiT3B0aW9uIDNcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ2YWx1ZVwiOiBcIk9wdGlvbiAzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwic2VsZWN0ZWRcIjogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICAgICAgICAgIFwicGxhY2Vob2xkZXJcIjogXCItLS0gU2VsZWN0IC0tLVwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibXVsdGlwbGVcIjogMSxcclxuICAgICAgICAgICAgICAgICAgICBcImxheW91dF9pbmxpbmVcIjogMVxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgXCJ3aWR0aFwiOiBcIjM2Ljc3NzclXCIsXHJcbiAgICAgICAgICAgICAgXCJpdGVtc1wiOiBbXHJcbiAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImZpZWxkXCIsXHJcbiAgICAgICAgICAgICAgICAgIFwiZGF0YVwiOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJpZFwiOiBcInNlbGVjdC03eXFcIixcclxuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJzZWxlY3RcIixcclxuICAgICAgICAgICAgICAgICAgICBcInVzYWdlX2tleVwiOiBcInNlbGVjdFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJTZWxlY3RcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJzZWxlY3QtN3lxXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJtaW5fd2lkdGhcIjogXCIyNDBweFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiaHRtbF9pZFwiOiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY3NzY2xhc3NcIjogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICBcInBsYWNlaG9sZGVyXCI6IFwiLS0tIFNlbGVjdCAtLS1cIixcclxuICAgICAgICAgICAgICAgICAgICBcIm9wdGlvbnNcIjogW1xyXG4gICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiT3B0aW9uIDFcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ2YWx1ZVwiOiBcIk9wdGlvbiAxXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwic2VsZWN0ZWRcIjogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwibGFiZWxcIjogXCJPcHRpb24gMlwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInZhbHVlXCI6IFwiT3B0aW9uIDJcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJzZWxlY3RlZFwiOiBmYWxzZVxyXG4gICAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIk9wdGlvbiAzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwidmFsdWVcIjogXCJPcHRpb24gM1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcInNlbGVjdGVkXCI6IGZhbHNlXHJcbiAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiT3B0aW9uIDRcIixcclxuICAgICAgICAgICAgICAgICAgICAgICAgXCJ2YWx1ZVwiOiBcIk9wdGlvbiA0XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwic2VsZWN0ZWRcIjogZmFsc2VcclxuICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICBdXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF1cclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHtcclxuICAgICAgICBcInR5cGVcIjogXCJzZWN0aW9uXCIsXHJcbiAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgIFwiaWRcIjogXCJzZWN0aW9uLTUtMTc1ODUzNzU1MDQ3N1wiLFxyXG4gICAgICAgICAgXCJsYWJlbFwiOiBcIlNlY3Rpb25cIixcclxuICAgICAgICAgIFwiaHRtbF9pZFwiOiBcIlwiLFxyXG4gICAgICAgICAgXCJjc3NjbGFzc1wiOiBcIlwiLFxyXG4gICAgICAgICAgXCJjb2xfc3R5bGVzXCI6IFwiW3tcXFwiZGlyXFxcIjpcXFwicm93XFxcIixcXFwid3JhcFxcXCI6XFxcIndyYXBcXFwiLFxcXCJqY1xcXCI6XFxcImZsZXgtZW5kXFxcIixcXFwiYWlcXFwiOlxcXCJmbGV4LWVuZFxcXCIsXFxcImdhcFxcXCI6XFxcIjlweFxcXCIsXFxcImFzZWxmXFxcIjpcXFwiZmxleC1lbmRcXFwifV1cIixcclxuICAgICAgICAgIFwiY29sdW1uc1wiOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBcIndpZHRoXCI6IFwiMTAwJVwiLFxyXG4gICAgICAgICAgICAgIFwiaXRlbXNcIjogW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwidHlwZVwiOiBcImRpdmlkZXJcIixcclxuICAgICAgICAgICAgICAgICAgICBcInVzYWdlX2tleVwiOiBcImRpdmlkZXJfdmVydGljYWxcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm9yaWVudGF0aW9uXCI6IFwiaG9yaXpvbnRhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGluZV9zdHlsZVwiOiBcInNvbGlkXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ0aGlja25lc3NfcHhcIjogMSxcclxuICAgICAgICAgICAgICAgICAgICBcImxlbmd0aFwiOiBcIjEwMCVcIixcclxuICAgICAgICAgICAgICAgICAgICBcImFsaWduXCI6IFwiY2VudGVyXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xvclwiOiBcIiNjY2NcIixcclxuICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiRGl2aWRlcl92ZXJ0aWNhbFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX3RvcF9weFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX2JvdHRvbV9weFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibWFyZ2luX2xlZnRfcHhcIjogMCxcclxuICAgICAgICAgICAgICAgICAgICBcIm1hcmdpbl9yaWdodF9weFwiOiAwLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY3NzY2xhc3NfZXh0cmFcIjogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICBcImlkXCI6IFwiZGl2aWRlci12ZXJ0aWNhbC1oZTQwYS0yXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJuYW1lXCI6IFwiZGl2aWRlci12ZXJ0aWNhbC1oZTQwYS0yXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJodG1sX2lkXCI6IFwiXCJcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgXCJ0eXBlXCI6IFwiZmllbGRcIixcclxuICAgICAgICAgICAgICAgICAgXCJkYXRhXCI6IHtcclxuICAgICAgICAgICAgICAgICAgICBcImlkXCI6IFwid2l6YXJkX25hdl9iYWNrLTJcIixcclxuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJ3aXphcmRfbmF2XCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJ1c2FnZV9rZXlcIjogXCJ3aXphcmRfbmF2X2JhY2tcIixcclxuICAgICAgICAgICAgICAgICAgICBcImRpcmVjdGlvblwiOiBcImJhY2tcIixcclxuICAgICAgICAgICAgICAgICAgICBcInRhcmdldF9zdGVwXCI6IDEsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsYWJlbFwiOiBcIkJhY2tcIixcclxuICAgICAgICAgICAgICAgICAgICBcIm5hbWVcIjogXCJ3aXphcmRfbmF2X2JhY2stMlwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY3NzY2xhc3NfZXh0cmFcIjogXCJcIixcclxuICAgICAgICAgICAgICAgICAgICBcImh0bWxfaWRcIjogXCJcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJmaWVsZFwiLFxyXG4gICAgICAgICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgICAgICAgIFwiaWRcIjogXCJzdWJtaXRcIixcclxuICAgICAgICAgICAgICAgICAgICBcInR5cGVcIjogXCJzdWJtaXRcIixcclxuICAgICAgICAgICAgICAgICAgICBcInVzYWdlX2tleVwiOiBcInN1Ym1pdFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwidXNhZ2VudW1iZXJcIjogMSxcclxuICAgICAgICAgICAgICAgICAgICBcImxhYmVsXCI6IFwiU2VuZFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibmFtZVwiOiBcInN1Ym1pdFwiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY3NzY2xhc3NcIjogXCJ3cGJjX2JmYl9fYnRuIHdwYmNfYmZiX19idG4tLXByaW1hcnlcIixcclxuICAgICAgICAgICAgICAgICAgICBcImh0bWxfaWRcIjogXCJcIlxyXG4gICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgXVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICBdXHJcbiAgfVxyXG5dO1xyXG59XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNBLHFDQUFxQ0EsQ0FBQSxFQUFHO0VBQ2hELE9BQU8sQ0FDTjtJQUNFLE1BQU0sRUFBRSxDQUFDO0lBQ1QsU0FBUyxFQUFFLENBQ1Q7TUFDRSxNQUFNLEVBQUUsU0FBUztNQUNqQixNQUFNLEVBQUU7UUFDTixJQUFJLEVBQUUseUJBQXlCO1FBQy9CLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLFNBQVMsRUFBRSxFQUFFO1FBQ2IsVUFBVSxFQUFFLEVBQUU7UUFDZCxZQUFZLEVBQUUsaUpBQWlKO1FBQy9KLFNBQVMsRUFBRSxDQUNUO1VBQ0UsT0FBTyxFQUFFLFVBQVU7VUFDbkIsT0FBTyxFQUFFLENBQ1A7WUFDRSxNQUFNLEVBQUUsT0FBTztZQUNmLE1BQU0sRUFBRTtjQUNOLElBQUksRUFBRSxVQUFVO2NB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VUFDRixDQUFDO1FBRUwsQ0FBQztNQUVMO0lBQ0YsQ0FBQyxFQUNEO01BQ0UsTUFBTSxFQUFFLFNBQVM7TUFDakIsTUFBTSxFQUFFO1FBQ04sSUFBSSxFQUFFLHlCQUF5QjtRQUMvQixPQUFPLEVBQUUsU0FBUztRQUNsQixTQUFTLEVBQUUsRUFBRTtRQUNiLFVBQVUsRUFBRSxFQUFFO1FBQ2QsWUFBWSxFQUFFLHNIQUFzSDtRQUNwSSxTQUFTLEVBQUUsQ0FDVDtVQUNFLE9BQU8sRUFBRSxNQUFNO1VBQ2YsT0FBTyxFQUFFLENBQ1A7WUFDRSxNQUFNLEVBQUUsT0FBTztZQUNmLE1BQU0sRUFBRTtjQUNOLE1BQU0sRUFBRSxTQUFTO2NBQ2pCLFdBQVcsRUFBRSxrQkFBa0I7Y0FDL0IsYUFBYSxFQUFFLFlBQVk7Y0FDM0IsWUFBWSxFQUFFLE9BQU87Y0FDckIsY0FBYyxFQUFFLENBQUM7Y0FDakIsUUFBUSxFQUFFLE1BQU07Y0FDaEIsT0FBTyxFQUFFLFFBQVE7Y0FDakIsT0FBTyxFQUFFLE1BQU07Y0FDZixPQUFPLEVBQUUsa0JBQWtCO2NBQzNCLGVBQWUsRUFBRSxDQUFDO2NBQ2xCLGtCQUFrQixFQUFFLENBQUM7Y0FDckIsZ0JBQWdCLEVBQUUsQ0FBQztjQUNuQixpQkFBaUIsRUFBRSxDQUFDO2NBQ3BCLGdCQUFnQixFQUFFLEVBQUU7Y0FDcEIsSUFBSSxFQUFFLDBCQUEwQjtjQUNoQyxNQUFNLEVBQUUsMEJBQTBCO2NBQ2xDLFNBQVMsRUFBRTtZQUNiO1VBQ0YsQ0FBQyxFQUNEO1lBQ0UsTUFBTSxFQUFFLE9BQU87WUFDZixNQUFNLEVBQUU7Y0FDTixJQUFJLEVBQUUsbUJBQW1CO2NBQ3pCLE1BQU0sRUFBRSxZQUFZO2NBQ3BCLFdBQVcsRUFBRSxpQkFBaUI7Y0FDOUIsV0FBVyxFQUFFLE1BQU07Y0FDbkIsYUFBYSxFQUFFLENBQUM7Y0FDaEIsT0FBTyxFQUFFLE1BQU07Y0FDZixNQUFNLEVBQUUsbUJBQW1CO2NBQzNCLGdCQUFnQixFQUFFLEVBQUU7Y0FDcEIsU0FBUyxFQUFFO1lBQ2I7VUFDRixDQUFDLEVBQ0Q7WUFDRSxNQUFNLEVBQUUsT0FBTztZQUNmLE1BQU0sRUFBRTtjQUNOLElBQUksRUFBRSxRQUFRO2NBQ2QsTUFBTSxFQUFFLFFBQVE7Y0FDaEIsV0FBVyxFQUFFLFFBQVE7Y0FDckIsYUFBYSxFQUFFLENBQUM7Y0FDaEIsT0FBTyxFQUFFLE1BQU07Y0FDZixNQUFNLEVBQUUsUUFBUTtjQUNoQixVQUFVLEVBQUUsc0NBQXNDO2NBQ2xELFNBQVMsRUFBRTtZQUNiO1VBQ0YsQ0FBQztRQUVMLENBQUM7TUFFTDtJQUNGLENBQUM7RUFFTCxDQUFDLENBQ0Y7QUFDRCIsImlnbm9yZUxpc3QiOltdfQ==

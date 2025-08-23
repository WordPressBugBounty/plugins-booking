// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/form_templates.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Example serialized form structure used as initial data/fallback.
 *
 * @returns {Array<Object>} Pages array compatible with `load_saved_structure()`.
 */
function wpbc_bfb__form_structure__get_example() {
	return   [
  {
    "page": 1,
    "content": [
      {
        "type": "section",
        "data": {
          "id": "section-5-1755784990430",
          "columns": [
            {
              "width": "24.25%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "usagenumber": 1,
                    "id": "calendar",
                    "type": "calendar",
                    "label": "Calendar",
                    "min_width": "250px",
                    "usage_key": "calendar",
                    "name": "calendar"
                  }
                }
              ]
            },
            {
              "width": "72.75%",
              "items": [
                {
                  "type": "field",
                  "data": {
                    "id": "input-text",
                    "type": "text",
                    "label": "Input-text",
                    "usage_key": "text",
                    "name": "input-text"
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

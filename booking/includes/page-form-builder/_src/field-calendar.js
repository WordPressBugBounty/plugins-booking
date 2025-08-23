// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/field-calendar.js ==  Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
(function () {
	"use strict";

	const Core     = window.WPBC_BFB_Core || {};
	const Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	const Sanit    = Core.WPBC_BFB_Sanitize;

	if ( ! Registry ) {
		console.error( "[WPBC] Core not ready: Registry missing. Load bfb-core.iife.js before this field." );
		return;
	}

	class WPBC_BFB_Field_Calendar {
		constructor(data, label = "", id = "") {
			this.data  = data || {};
			this.label = label || this.data.label || "Date";
			this.id    = id || this.data.id || "";
		}

		render() {
			const rId = WPBC_BFB_Field_Calendar.get_default_data().resource_id;
			return `
        <style type="text/css" rel="stylesheet">
          .hasDatepick .datepick-inline .datepick-title-row th,
          .hasDatepick .datepick-inline .datepick-days-cell { max-height: 50px; }
        </style>
        <div class="wpbc_calendar_wraper wpbc_change_over_triangle">
          <div class="wpbc_cal_container bk_calendar_frame wpbc_no_custom_width months_num_in_row_ cal_month_num_1">
            <div id="calendar_booking${rId}">Calendar is loading...</div>
          </div>
        </div>
        <textarea rows="3" cols="50"
                  id="date_booking${rId}"
                  name="date_booking${rId}"
                  autocomplete="off"
                  style="display:none;"></textarea>
      `;
		}

		static get_default_data() {
			return {
				type       : "calendar",
				label      : "Date",
				resource_id: 4
			};
		}

		static on_field_drop(data, field_el, { context }) {
			console.log( `Calendar field "${data.label}" handled during:`, context );

			if ( context === "drop" ) {
				// TODO: init datepicker if needed
			} else if ( context === "load" ) {
				// TODO: restore state
			} else if ( context === "preview" ) {
				// TODO: preview-specific behavior
			}

			// Example hook into your existing global init:.
			if ( typeof wpbc_load_calendar_example === "function" ) {
				wpbc_load_calendar_example();
			}
		}
	}

	// Register with the central registry.
	Registry.register( "calendar", WPBC_BFB_Field_Calendar );
})();

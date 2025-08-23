"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/field-calendar.js ==  Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
(function () {
  "use strict";

  const Core = window.WPBC_BFB_Core || {};
  const Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  const Sanit = Core.WPBC_BFB_Sanitize;
  if (!Registry) {
    console.error("[WPBC] Core not ready: Registry missing. Load bfb-core.iife.js before this field.");
    return;
  }
  class WPBC_BFB_Field_Calendar {
    constructor(data, label = "", id = "") {
      this.data = data || {};
      this.label = label || this.data.label || "Date";
      this.id = id || this.data.id || "";
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
        type: "calendar",
        label: "Date",
        resource_id: 4
      };
    }
    static on_field_drop(data, field_el, {
      context
    }) {
      console.log(`Calendar field "${data.label}" handled during:`, context);
      if (context === "drop") {
        // TODO: init datepicker if needed
      } else if (context === "load") {
        // TODO: restore state
      } else if (context === "preview") {
        // TODO: preview-specific behavior
      }

      // Example hook into your existing global init:.
      if (typeof wpbc_load_calendar_example === "function") {
        wpbc_load_calendar_example();
      }
    }
  }

  // Register with the central registry.
  Registry.register("calendar", WPBC_BFB_Field_Calendar);
})();
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9maWVsZC1jYWxlbmRhci5qcyIsIm5hbWVzIjpbIkNvcmUiLCJ3aW5kb3ciLCJXUEJDX0JGQl9Db3JlIiwiUmVnaXN0cnkiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsIlNhbml0IiwiV1BCQ19CRkJfU2FuaXRpemUiLCJjb25zb2xlIiwiZXJyb3IiLCJXUEJDX0JGQl9GaWVsZF9DYWxlbmRhciIsImNvbnN0cnVjdG9yIiwiZGF0YSIsImxhYmVsIiwiaWQiLCJyZW5kZXIiLCJySWQiLCJnZXRfZGVmYXVsdF9kYXRhIiwicmVzb3VyY2VfaWQiLCJ0eXBlIiwib25fZmllbGRfZHJvcCIsImZpZWxkX2VsIiwiY29udGV4dCIsImxvZyIsIndwYmNfbG9hZF9jYWxlbmRhcl9leGFtcGxlIiwicmVnaXN0ZXIiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2ZpZWxkLWNhbGVuZGFyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvX291dC9maWVsZC1jYWxlbmRhci5qcyA9PSAgVGltZSBwb2ludDogMjAyNS0wOC0yMSAxNzozOVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuKGZ1bmN0aW9uICgpIHtcclxuXHRcInVzZSBzdHJpY3RcIjtcclxuXHJcblx0Y29uc3QgQ29yZSAgICAgPSB3aW5kb3cuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHRjb25zdCBSZWdpc3RyeSA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0Y29uc3QgU2FuaXQgICAgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplO1xyXG5cclxuXHRpZiAoICEgUmVnaXN0cnkgKSB7XHJcblx0XHRjb25zb2xlLmVycm9yKCBcIltXUEJDXSBDb3JlIG5vdCByZWFkeTogUmVnaXN0cnkgbWlzc2luZy4gTG9hZCBiZmItY29yZS5paWZlLmpzIGJlZm9yZSB0aGlzIGZpZWxkLlwiICk7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRjbGFzcyBXUEJDX0JGQl9GaWVsZF9DYWxlbmRhciB7XHJcblx0XHRjb25zdHJ1Y3RvcihkYXRhLCBsYWJlbCA9IFwiXCIsIGlkID0gXCJcIikge1xyXG5cdFx0XHR0aGlzLmRhdGEgID0gZGF0YSB8fCB7fTtcclxuXHRcdFx0dGhpcy5sYWJlbCA9IGxhYmVsIHx8IHRoaXMuZGF0YS5sYWJlbCB8fCBcIkRhdGVcIjtcclxuXHRcdFx0dGhpcy5pZCAgICA9IGlkIHx8IHRoaXMuZGF0YS5pZCB8fCBcIlwiO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJlbmRlcigpIHtcclxuXHRcdFx0Y29uc3QgcklkID0gV1BCQ19CRkJfRmllbGRfQ2FsZW5kYXIuZ2V0X2RlZmF1bHRfZGF0YSgpLnJlc291cmNlX2lkO1xyXG5cdFx0XHRyZXR1cm4gYFxyXG4gICAgICAgIDxzdHlsZSB0eXBlPVwidGV4dC9jc3NcIiByZWw9XCJzdHlsZXNoZWV0XCI+XHJcbiAgICAgICAgICAuaGFzRGF0ZXBpY2sgLmRhdGVwaWNrLWlubGluZSAuZGF0ZXBpY2stdGl0bGUtcm93IHRoLFxyXG4gICAgICAgICAgLmhhc0RhdGVwaWNrIC5kYXRlcGljay1pbmxpbmUgLmRhdGVwaWNrLWRheXMtY2VsbCB7IG1heC1oZWlnaHQ6IDUwcHg7IH1cclxuICAgICAgICA8L3N0eWxlPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJ3cGJjX2NhbGVuZGFyX3dyYXBlciB3cGJjX2NoYW5nZV9vdmVyX3RyaWFuZ2xlXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzPVwid3BiY19jYWxfY29udGFpbmVyIGJrX2NhbGVuZGFyX2ZyYW1lIHdwYmNfbm9fY3VzdG9tX3dpZHRoIG1vbnRoc19udW1faW5fcm93XyBjYWxfbW9udGhfbnVtXzFcIj5cclxuICAgICAgICAgICAgPGRpdiBpZD1cImNhbGVuZGFyX2Jvb2tpbmcke3JJZH1cIj5DYWxlbmRhciBpcyBsb2FkaW5nLi4uPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8dGV4dGFyZWEgcm93cz1cIjNcIiBjb2xzPVwiNTBcIlxyXG4gICAgICAgICAgICAgICAgICBpZD1cImRhdGVfYm9va2luZyR7cklkfVwiXHJcbiAgICAgICAgICAgICAgICAgIG5hbWU9XCJkYXRlX2Jvb2tpbmcke3JJZH1cIlxyXG4gICAgICAgICAgICAgICAgICBhdXRvY29tcGxldGU9XCJvZmZcIlxyXG4gICAgICAgICAgICAgICAgICBzdHlsZT1cImRpc3BsYXk6bm9uZTtcIj48L3RleHRhcmVhPlxyXG4gICAgICBgO1xyXG5cdFx0fVxyXG5cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdF9kYXRhKCkge1xyXG5cdFx0XHRyZXR1cm4ge1xyXG5cdFx0XHRcdHR5cGUgICAgICAgOiBcImNhbGVuZGFyXCIsXHJcblx0XHRcdFx0bGFiZWwgICAgICA6IFwiRGF0ZVwiLFxyXG5cdFx0XHRcdHJlc291cmNlX2lkOiA0XHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIG9uX2ZpZWxkX2Ryb3AoZGF0YSwgZmllbGRfZWwsIHsgY29udGV4dCB9KSB7XHJcblx0XHRcdGNvbnNvbGUubG9nKCBgQ2FsZW5kYXIgZmllbGQgXCIke2RhdGEubGFiZWx9XCIgaGFuZGxlZCBkdXJpbmc6YCwgY29udGV4dCApO1xyXG5cclxuXHRcdFx0aWYgKCBjb250ZXh0ID09PSBcImRyb3BcIiApIHtcclxuXHRcdFx0XHQvLyBUT0RPOiBpbml0IGRhdGVwaWNrZXIgaWYgbmVlZGVkXHJcblx0XHRcdH0gZWxzZSBpZiAoIGNvbnRleHQgPT09IFwibG9hZFwiICkge1xyXG5cdFx0XHRcdC8vIFRPRE86IHJlc3RvcmUgc3RhdGVcclxuXHRcdFx0fSBlbHNlIGlmICggY29udGV4dCA9PT0gXCJwcmV2aWV3XCIgKSB7XHJcblx0XHRcdFx0Ly8gVE9ETzogcHJldmlldy1zcGVjaWZpYyBiZWhhdmlvclxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBFeGFtcGxlIGhvb2sgaW50byB5b3VyIGV4aXN0aW5nIGdsb2JhbCBpbml0Oi5cclxuXHRcdFx0aWYgKCB0eXBlb2Ygd3BiY19sb2FkX2NhbGVuZGFyX2V4YW1wbGUgPT09IFwiZnVuY3Rpb25cIiApIHtcclxuXHRcdFx0XHR3cGJjX2xvYWRfY2FsZW5kYXJfZXhhbXBsZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBSZWdpc3RlciB3aXRoIHRoZSBjZW50cmFsIHJlZ2lzdHJ5LlxyXG5cdFJlZ2lzdHJ5LnJlZ2lzdGVyKCBcImNhbGVuZGFyXCIsIFdQQkNfQkZCX0ZpZWxkX0NhbGVuZGFyICk7XHJcbn0pKCk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFlBQVk7RUFDWixZQUFZOztFQUVaLE1BQU1BLElBQUksR0FBT0MsTUFBTSxDQUFDQyxhQUFhLElBQUksQ0FBQyxDQUFDO0VBQzNDLE1BQU1DLFFBQVEsR0FBR0gsSUFBSSxDQUFDSSxnQ0FBZ0M7RUFDdEQsTUFBTUMsS0FBSyxHQUFNTCxJQUFJLENBQUNNLGlCQUFpQjtFQUV2QyxJQUFLLENBQUVILFFBQVEsRUFBRztJQUNqQkksT0FBTyxDQUFDQyxLQUFLLENBQUUsbUZBQW9GLENBQUM7SUFDcEc7RUFDRDtFQUVBLE1BQU1DLHVCQUF1QixDQUFDO0lBQzdCQyxXQUFXQSxDQUFDQyxJQUFJLEVBQUVDLEtBQUssR0FBRyxFQUFFLEVBQUVDLEVBQUUsR0FBRyxFQUFFLEVBQUU7TUFDdEMsSUFBSSxDQUFDRixJQUFJLEdBQUlBLElBQUksSUFBSSxDQUFDLENBQUM7TUFDdkIsSUFBSSxDQUFDQyxLQUFLLEdBQUdBLEtBQUssSUFBSSxJQUFJLENBQUNELElBQUksQ0FBQ0MsS0FBSyxJQUFJLE1BQU07TUFDL0MsSUFBSSxDQUFDQyxFQUFFLEdBQU1BLEVBQUUsSUFBSSxJQUFJLENBQUNGLElBQUksQ0FBQ0UsRUFBRSxJQUFJLEVBQUU7SUFDdEM7SUFFQUMsTUFBTUEsQ0FBQSxFQUFHO01BQ1IsTUFBTUMsR0FBRyxHQUFHTix1QkFBdUIsQ0FBQ08sZ0JBQWdCLENBQUMsQ0FBQyxDQUFDQyxXQUFXO01BQ2xFLE9BQU87QUFDVjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSx1Q0FBdUNGLEdBQUc7QUFDMUM7QUFDQTtBQUNBO0FBQ0Esb0NBQW9DQSxHQUFHO0FBQ3ZDLHNDQUFzQ0EsR0FBRztBQUN6QztBQUNBO0FBQ0EsT0FBTztJQUNMO0lBRUEsT0FBT0MsZ0JBQWdCQSxDQUFBLEVBQUc7TUFDekIsT0FBTztRQUNORSxJQUFJLEVBQVMsVUFBVTtRQUN2Qk4sS0FBSyxFQUFRLE1BQU07UUFDbkJLLFdBQVcsRUFBRTtNQUNkLENBQUM7SUFDRjtJQUVBLE9BQU9FLGFBQWFBLENBQUNSLElBQUksRUFBRVMsUUFBUSxFQUFFO01BQUVDO0lBQVEsQ0FBQyxFQUFFO01BQ2pEZCxPQUFPLENBQUNlLEdBQUcsQ0FBRSxtQkFBbUJYLElBQUksQ0FBQ0MsS0FBSyxtQkFBbUIsRUFBRVMsT0FBUSxDQUFDO01BRXhFLElBQUtBLE9BQU8sS0FBSyxNQUFNLEVBQUc7UUFDekI7TUFBQSxDQUNBLE1BQU0sSUFBS0EsT0FBTyxLQUFLLE1BQU0sRUFBRztRQUNoQztNQUFBLENBQ0EsTUFBTSxJQUFLQSxPQUFPLEtBQUssU0FBUyxFQUFHO1FBQ25DO01BQUE7O01BR0Q7TUFDQSxJQUFLLE9BQU9FLDBCQUEwQixLQUFLLFVBQVUsRUFBRztRQUN2REEsMEJBQTBCLENBQUMsQ0FBQztNQUM3QjtJQUNEO0VBQ0Q7O0VBRUE7RUFDQXBCLFFBQVEsQ0FBQ3FCLFFBQVEsQ0FBRSxVQUFVLEVBQUVmLHVCQUF3QixDQUFDO0FBQ3pELENBQUMsRUFBRSxDQUFDIiwiaWdub3JlTGlzdCI6W119

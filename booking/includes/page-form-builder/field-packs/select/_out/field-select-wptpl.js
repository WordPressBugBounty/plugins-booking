"use strict";

// File: /includes/page-form-builder/field-packs/select/_out/field-select-wptpl.js
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Select_Base = Core.WPBC_BFB_Select_Base;
  if (!Registry?.register || !Select_Base) {
    w._wpbc?.dev?.error?.('WPBC_BFB_Field_Select', 'Registry or Select_Base missing');
    return;
  }
  class WPBC_BFB_Field_Select extends Select_Base {
    static template_id = 'wpbc-bfb-field-select';
    static kind = 'select';
    static get_defaults() {
      const d = super.get_defaults();
      return {
        ...d,
        type: 'select',
        label: 'Select',
        placeholder: '--- Select ---',
        options: [{
          label: 'Option 1',
          value: 'Option 1',
          selected: false
        }, {
          label: 'Option 2',
          value: 'Option 2',
          selected: false
        }, {
          label: 'Option 3',
          value: 'Option 3',
          selected: false
        }, {
          label: 'Option 4',
          value: 'Option 4',
          selected: false
        }]
      };
    }
  }
  try {
    Registry.register('select', WPBC_BFB_Field_Select);
  } catch (e) {
    w._wpbc?.dev?.error?.('WPBC_BFB_Field_Select.register', e);
  }

  // Optional: used by templates to fetch JS defaults if server data is empty.
  w.WPBC_BFB_Field_Select = WPBC_BFB_Field_Select;

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback (Advanced Form shortcode) for "select".
   *
   * This callback is registered per field type via:
   *   WPBC_BFB_Exporter.register( 'select', callback )
   *   (and also as a legacy alias: 'selectbox')
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
   *     -> callback( field, emit, { io, cfg, once, ctx, core } );
   *
   * @callback WPBC_BFB_ExporterCallback
   * @param {Object}  field
   *   Normalized field data coming from the Builder structure.
   *   - field.type          {string}   Field type, usually "select".
   *   - field.label         {string}   Visible label in the form (may be empty).
   *   - field.name          {string}   Name as stored on the canvas (already validated).
   *   - field.html_id       {string}   Optional HTML id / user-visible id.
   *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
   *   - field.options       {Array}    Options for select (label/value/selected).
   *   - field.label_first   {boolean}  Optional flag to render label before current value.
   *   - field.use_label_element {boolean} Optional flag to force `use_label_element`.
   *   - ...                 (Any other pack-specific props are also present.)
   *
   * @param {function(string):void} emit
   *   Emits one line/fragment into the export buffer.
   *
   * @param {Object} [extras]
   *   Extra context passed by the core exporter.
   */
  function register_select_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    // If some other script already registered a "select" exporter, do nothing.
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('select')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize || {};
    var esc_html = S.escape_html || function (v) {
      return String(v);
    };

    /**
     * @type {WPBC_BFB_ExporterCallback}
     */
    var exporter_callback = function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var ctx = extras.ctx;
      var add_labels = cfg.addLabels !== false;

      // Required marker (same semantics as other text-like fields).
      var is_req = Exp.is_required(field);
      var req_mark = is_req ? '*' : '';

      // Name / id / classes come from shared helpers so they stay in sync with other packs.
      var name = Exp.compute_name('select', field);
      var id_opt = Exp.id_option(field, ctx);
      var cls_opts = Exp.class_options(field);

      // Use shared choice_tag helper:
      // - Proper order of tokens
      // - Optional use_label_element / label_first support
      // - Options + default handling identical to legacy exporter.
      var body = Exp.choice_tag('selectbox', req_mark, name, field, id_opt, cls_opts);

      // Label behavior mirrors text/checkbox/radio exporters.
      var raw_label = field && typeof field.label === 'string' ? field.label : '';
      var label = raw_label.trim();
      if (label && add_labels) {
        emit('<l>' + esc_html(label) + req_mark + '</l>');
        emit('<br>' + body);
      } else {
        emit(body);
      }
      // Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
    };

    // Main type used by the Builder.
    Exp.register('select', exporter_callback);

    // Legacy alias: some older structures may use "selectbox" as type.
    if (typeof Exp.has_exporter !== 'function' || !Exp.has_exporter('selectbox')) {
      Exp.register('selectbox', exporter_callback);
    }
  }

  // Try immediate registration; if core isn’t ready, wait for the event.
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_select_booking_form_exporter();
  } else {
    document.addEventListener('wpbc:bfb:exporter-ready', register_select_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback ("Content of booking fields data") for "select".
   *
   * Default behavior:
   *   <b>Label</b>: <f>[field_name]</f><br>
   *
   * Registered per field type via:
   *   WPBC_BFB_ContentExporter.register( 'select', callback )
   *   (and also as a legacy alias: 'selectbox')
   */
  function register_select_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('select')) {
      return;
    }
    var exporter_callback = function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }

      // Keep the exact exported name in sync with the Booking Form exporter.
      var name = Exp.compute_name('select', field);
      if (!name) {
        return;
      }
      var raw_label = typeof field.label === 'string' ? field.label : '';
      var label = raw_label.trim() || name;

      // Shared formatter keeps all packs consistent:
      // <b>Label</b>: <f>[name]</f><br>
      C.emit_line_bold_field(emit, label, name, cfg);
    };

    // Main type
    C.register('select', exporter_callback);

    // Legacy alias, if needed.
    if (typeof C.has_exporter !== 'function' || !C.has_exporter('selectbox')) {
      C.register('selectbox', exporter_callback);
    }
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_select_booking_data_exporter();
  } else {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_select_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3Mvc2VsZWN0L19vdXQvZmllbGQtc2VsZWN0LXdwdHBsLmpzIiwibmFtZXMiOlsidyIsIkNvcmUiLCJXUEJDX0JGQl9Db3JlIiwiUmVnaXN0cnkiLCJXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeSIsIlNlbGVjdF9CYXNlIiwiV1BCQ19CRkJfU2VsZWN0X0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJXUEJDX0JGQl9GaWVsZF9TZWxlY3QiLCJ0ZW1wbGF0ZV9pZCIsImtpbmQiLCJnZXRfZGVmYXVsdHMiLCJkIiwidHlwZSIsImxhYmVsIiwicGxhY2Vob2xkZXIiLCJvcHRpb25zIiwidmFsdWUiLCJzZWxlY3RlZCIsImUiLCJyZWdpc3Rlcl9zZWxlY3RfYm9va2luZ19mb3JtX2V4cG9ydGVyIiwiRXhwIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJoYXNfZXhwb3J0ZXIiLCJTIiwiV1BCQ19CRkJfU2FuaXRpemUiLCJlc2NfaHRtbCIsImVzY2FwZV9odG1sIiwidiIsIlN0cmluZyIsImV4cG9ydGVyX2NhbGxiYWNrIiwiZmllbGQiLCJlbWl0IiwiZXh0cmFzIiwiY2ZnIiwiY3R4IiwiYWRkX2xhYmVscyIsImFkZExhYmVscyIsImlzX3JlcSIsImlzX3JlcXVpcmVkIiwicmVxX21hcmsiLCJuYW1lIiwiY29tcHV0ZV9uYW1lIiwiaWRfb3B0IiwiaWRfb3B0aW9uIiwiY2xzX29wdHMiLCJjbGFzc19vcHRpb25zIiwiYm9keSIsImNob2ljZV90YWciLCJyYXdfbGFiZWwiLCJ0cmltIiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwib25jZSIsInJlZ2lzdGVyX3NlbGVjdF9ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwiZW1pdF9saW5lX2JvbGRfZmllbGQiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9zZWxlY3QvX3NyYy9maWVsZC1zZWxlY3Qtd3B0cGwuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gRmlsZTogL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL3NlbGVjdC9fb3V0L2ZpZWxkLXNlbGVjdC13cHRwbC5qc1xyXG4oZnVuY3Rpb24gKHcpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblx0dmFyIENvcmUgICAgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciBSZWdpc3RyeSAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0dmFyIFNlbGVjdF9CYXNlID0gQ29yZS5XUEJDX0JGQl9TZWxlY3RfQmFzZTtcclxuXHJcblx0aWYgKCAhIFJlZ2lzdHJ5Py5yZWdpc3RlciB8fCAhIFNlbGVjdF9CYXNlICkge1xyXG5cdFx0dy5fd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfRmllbGRfU2VsZWN0JywgJ1JlZ2lzdHJ5IG9yIFNlbGVjdF9CYXNlIG1pc3NpbmcnICk7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHRjbGFzcyBXUEJDX0JGQl9GaWVsZF9TZWxlY3QgZXh0ZW5kcyBTZWxlY3RfQmFzZSB7XHJcblxyXG5cdFx0c3RhdGljIHRlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWZpZWxkLXNlbGVjdCc7XHJcblx0XHRzdGF0aWMga2luZCAgICAgICAgPSAnc2VsZWN0JztcclxuXHJcblx0XHRzdGF0aWMgZ2V0X2RlZmF1bHRzKCkge1xyXG5cdFx0XHRjb25zdCBkID0gc3VwZXIuZ2V0X2RlZmF1bHRzKCk7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0Li4uZCxcclxuXHRcdFx0XHR0eXBlICAgICAgIDogJ3NlbGVjdCcsXHJcblx0XHRcdFx0bGFiZWwgICAgICA6ICdTZWxlY3QnLFxyXG5cdFx0XHRcdHBsYWNlaG9sZGVyOiAnLS0tIFNlbGVjdCAtLS0nLFxyXG5cdFx0XHRcdG9wdGlvbnMgICAgOiBbXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnT3B0aW9uIDEnLCB2YWx1ZTogJ09wdGlvbiAxJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnT3B0aW9uIDInLCB2YWx1ZTogJ09wdGlvbiAyJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnT3B0aW9uIDMnLCB2YWx1ZTogJ09wdGlvbiAzJywgc2VsZWN0ZWQ6IGZhbHNlIH0sXHJcblx0XHRcdFx0XHR7IGxhYmVsOiAnT3B0aW9uIDQnLCB2YWx1ZTogJ09wdGlvbiA0Jywgc2VsZWN0ZWQ6IGZhbHNlIH1cclxuXHRcdFx0XHRdXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR0cnkge1xyXG5cdFx0UmVnaXN0cnkucmVnaXN0ZXIoICdzZWxlY3QnLCBXUEJDX0JGQl9GaWVsZF9TZWxlY3QgKTtcclxuXHR9IGNhdGNoICggZSApIHtcclxuXHRcdHcuX3dwYmM/LmRldj8uZXJyb3I/LiggJ1dQQkNfQkZCX0ZpZWxkX1NlbGVjdC5yZWdpc3RlcicsIGUgKTtcclxuXHR9XHJcblxyXG5cdC8vIE9wdGlvbmFsOiB1c2VkIGJ5IHRlbXBsYXRlcyB0byBmZXRjaCBKUyBkZWZhdWx0cyBpZiBzZXJ2ZXIgZGF0YSBpcyBlbXB0eS5cclxuXHR3LldQQkNfQkZCX0ZpZWxkX1NlbGVjdCA9IFdQQkNfQkZCX0ZpZWxkX1NlbGVjdDtcclxuXHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIEZvcm1cIiAoQWR2YW5jZWQgRm9ybSBzaG9ydGNvZGUpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBCb29raW5nIEZvcm0gZXhwb3J0ZXIgY2FsbGJhY2sgKEFkdmFuY2VkIEZvcm0gc2hvcnRjb2RlKSBmb3IgXCJzZWxlY3RcIi5cclxuXHQgKlxyXG5cdCAqIFRoaXMgY2FsbGJhY2sgaXMgcmVnaXN0ZXJlZCBwZXIgZmllbGQgdHlwZSB2aWE6XHJcblx0ICogICBXUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciggJ3NlbGVjdCcsIGNhbGxiYWNrIClcclxuXHQgKiAgIChhbmQgYWxzbyBhcyBhIGxlZ2FjeSBhbGlhczogJ3NlbGVjdGJveCcpXHJcblx0ICpcclxuXHQgKiBDb3JlIGNhbGwgc2l0ZSAoYnVpbGRlci1leHBvcnRlci5qcyk6XHJcblx0ICogICBXUEJDX0JGQl9FeHBvcnRlci5ydW5fcmVnaXN0ZXJlZF9leHBvcnRlciggZmllbGQsIGlvLCBjZmcsIG9uY2UsIGN0eCApXHJcblx0ICogICAgIC0+IGNhbGxiYWNrKCBmaWVsZCwgZW1pdCwgeyBpbywgY2ZnLCBvbmNlLCBjdHgsIGNvcmUgfSApO1xyXG5cdCAqXHJcblx0ICogQGNhbGxiYWNrIFdQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2tcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gIGZpZWxkXHJcblx0ICogICBOb3JtYWxpemVkIGZpZWxkIGRhdGEgY29taW5nIGZyb20gdGhlIEJ1aWxkZXIgc3RydWN0dXJlLlxyXG5cdCAqICAgLSBmaWVsZC50eXBlICAgICAgICAgIHtzdHJpbmd9ICAgRmllbGQgdHlwZSwgdXN1YWxseSBcInNlbGVjdFwiLlxyXG5cdCAqICAgLSBmaWVsZC5sYWJlbCAgICAgICAgIHtzdHJpbmd9ICAgVmlzaWJsZSBsYWJlbCBpbiB0aGUgZm9ybSAobWF5IGJlIGVtcHR5KS5cclxuXHQgKiAgIC0gZmllbGQubmFtZSAgICAgICAgICB7c3RyaW5nfSAgIE5hbWUgYXMgc3RvcmVkIG9uIHRoZSBjYW52YXMgKGFscmVhZHkgdmFsaWRhdGVkKS5cclxuXHQgKiAgIC0gZmllbGQuaHRtbF9pZCAgICAgICB7c3RyaW5nfSAgIE9wdGlvbmFsIEhUTUwgaWQgLyB1c2VyLXZpc2libGUgaWQuXHJcblx0ICogICAtIGZpZWxkLmNzc2NsYXNzICAgICAge3N0cmluZ30gICBFeHRyYSBDU1MgY2xhc3NlcyBlbnRlcmVkIGluIEluc3BlY3Rvci5cclxuXHQgKiAgIC0gZmllbGQub3B0aW9ucyAgICAgICB7QXJyYXl9ICAgIE9wdGlvbnMgZm9yIHNlbGVjdCAobGFiZWwvdmFsdWUvc2VsZWN0ZWQpLlxyXG5cdCAqICAgLSBmaWVsZC5sYWJlbF9maXJzdCAgIHtib29sZWFufSAgT3B0aW9uYWwgZmxhZyB0byByZW5kZXIgbGFiZWwgYmVmb3JlIGN1cnJlbnQgdmFsdWUuXHJcblx0ICogICAtIGZpZWxkLnVzZV9sYWJlbF9lbGVtZW50IHtib29sZWFufSBPcHRpb25hbCBmbGFnIHRvIGZvcmNlIGB1c2VfbGFiZWxfZWxlbWVudGAuXHJcblx0ICogICAtIC4uLiAgICAgICAgICAgICAgICAgKEFueSBvdGhlciBwYWNrLXNwZWNpZmljIHByb3BzIGFyZSBhbHNvIHByZXNlbnQuKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOnZvaWR9IGVtaXRcclxuXHQgKiAgIEVtaXRzIG9uZSBsaW5lL2ZyYWdtZW50IGludG8gdGhlIGV4cG9ydCBidWZmZXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhc11cclxuXHQgKiAgIEV4dHJhIGNvbnRleHQgcGFzc2VkIGJ5IHRoZSBjb3JlIGV4cG9ydGVyLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHJlZ2lzdGVyX3NlbGVjdF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblxyXG5cdFx0dmFyIEV4cCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXI7XHJcblx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0Ly8gSWYgc29tZSBvdGhlciBzY3JpcHQgYWxyZWFkeSByZWdpc3RlcmVkIGEgXCJzZWxlY3RcIiBleHBvcnRlciwgZG8gbm90aGluZy5cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgRXhwLmhhc19leHBvcnRlciggJ3NlbGVjdCcgKSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0dmFyIFMgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCAoIHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfU2FuaXRpemUgKSB8fCB7fTtcclxuXHRcdHZhciBlc2NfaHRtbCA9IFMuZXNjYXBlX2h0bWwgfHwgZnVuY3Rpb24gKCB2ICkgeyByZXR1cm4gU3RyaW5nKCB2ICk7IH07XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBAdHlwZSB7V1BCQ19CRkJfRXhwb3J0ZXJDYWxsYmFja31cclxuXHRcdCAqL1xyXG5cdFx0dmFyIGV4cG9ydGVyX2NhbGxiYWNrID0gZnVuY3Rpb24gKCBmaWVsZCwgZW1pdCwgZXh0cmFzICkge1xyXG5cclxuXHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cclxuXHRcdFx0dmFyIGNmZyAgICAgICA9IGV4dHJhcy5jZmcgfHwge307XHJcblx0XHRcdHZhciBjdHggICAgICAgPSBleHRyYXMuY3R4O1xyXG5cdFx0XHR2YXIgYWRkX2xhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cclxuXHRcdFx0Ly8gUmVxdWlyZWQgbWFya2VyIChzYW1lIHNlbWFudGljcyBhcyBvdGhlciB0ZXh0LWxpa2UgZmllbGRzKS5cclxuXHRcdFx0dmFyIGlzX3JlcSAgID0gRXhwLmlzX3JlcXVpcmVkKCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgcmVxX21hcmsgPSBpc19yZXEgPyAnKicgOiAnJztcclxuXHJcblx0XHRcdC8vIE5hbWUgLyBpZCAvIGNsYXNzZXMgY29tZSBmcm9tIHNoYXJlZCBoZWxwZXJzIHNvIHRoZXkgc3RheSBpbiBzeW5jIHdpdGggb3RoZXIgcGFja3MuXHJcblx0XHRcdHZhciBuYW1lICAgICA9IEV4cC5jb21wdXRlX25hbWUoICdzZWxlY3QnLCBmaWVsZCApO1xyXG5cdFx0XHR2YXIgaWRfb3B0ICAgPSBFeHAuaWRfb3B0aW9uKCBmaWVsZCwgY3R4ICk7XHJcblx0XHRcdHZhciBjbHNfb3B0cyA9IEV4cC5jbGFzc19vcHRpb25zKCBmaWVsZCApO1xyXG5cclxuXHRcdFx0Ly8gVXNlIHNoYXJlZCBjaG9pY2VfdGFnIGhlbHBlcjpcclxuXHRcdFx0Ly8gLSBQcm9wZXIgb3JkZXIgb2YgdG9rZW5zXHJcblx0XHRcdC8vIC0gT3B0aW9uYWwgdXNlX2xhYmVsX2VsZW1lbnQgLyBsYWJlbF9maXJzdCBzdXBwb3J0XHJcblx0XHRcdC8vIC0gT3B0aW9ucyArIGRlZmF1bHQgaGFuZGxpbmcgaWRlbnRpY2FsIHRvIGxlZ2FjeSBleHBvcnRlci5cclxuXHRcdFx0dmFyIGJvZHkgPSBFeHAuY2hvaWNlX3RhZyggJ3NlbGVjdGJveCcsIHJlcV9tYXJrLCBuYW1lLCBmaWVsZCwgaWRfb3B0LCBjbHNfb3B0cyApO1xyXG5cclxuXHRcdFx0Ly8gTGFiZWwgYmVoYXZpb3IgbWlycm9ycyB0ZXh0L2NoZWNrYm94L3JhZGlvIGV4cG9ydGVycy5cclxuXHRcdFx0dmFyIHJhd19sYWJlbCA9ICggZmllbGQgJiYgdHlwZW9mIGZpZWxkLmxhYmVsID09PSAnc3RyaW5nJyApID8gZmllbGQubGFiZWwgOiAnJztcclxuXHRcdFx0dmFyIGxhYmVsICAgICA9IHJhd19sYWJlbC50cmltKCk7XHJcblxyXG5cdFx0XHRpZiAoIGxhYmVsICYmIGFkZF9sYWJlbHMgKSB7XHJcblx0XHRcdFx0ZW1pdCggJzxsPicgKyBlc2NfaHRtbCggbGFiZWwgKSArIHJlcV9tYXJrICsgJzwvbD4nICk7XHJcblx0XHRcdFx0ZW1pdCggJzxicj4nICsgYm9keSApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGVtaXQoIGJvZHkgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQvLyBIZWxwIHRleHQgaXMgYXBwZW5kZWQgY2VudHJhbGx5IGJ5IFdQQkNfQkZCX0V4cG9ydGVyLnJlbmRlcl9maWVsZF9ub2RlKCkuXHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIE1haW4gdHlwZSB1c2VkIGJ5IHRoZSBCdWlsZGVyLlxyXG5cdFx0RXhwLnJlZ2lzdGVyKCAnc2VsZWN0JywgZXhwb3J0ZXJfY2FsbGJhY2sgKTtcclxuXHJcblx0XHQvLyBMZWdhY3kgYWxpYXM6IHNvbWUgb2xkZXIgc3RydWN0dXJlcyBtYXkgdXNlIFwic2VsZWN0Ym94XCIgYXMgdHlwZS5cclxuXHRcdGlmICggdHlwZW9mIEV4cC5oYXNfZXhwb3J0ZXIgIT09ICdmdW5jdGlvbicgfHwgISBFeHAuaGFzX2V4cG9ydGVyKCAnc2VsZWN0Ym94JyApICkge1xyXG5cdFx0XHRFeHAucmVnaXN0ZXIoICdzZWxlY3Rib3gnLCBleHBvcnRlcl9jYWxsYmFjayApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gVHJ5IGltbWVkaWF0ZSByZWdpc3RyYXRpb247IGlmIGNvcmUgaXNu4oCZdCByZWFkeSwgd2FpdCBmb3IgdGhlIGV2ZW50LlxyXG5cdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHJlZ2lzdGVyX3NlbGVjdF9ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmV4cG9ydGVyLXJlYWR5JywgcmVnaXN0ZXJfc2VsZWN0X2Jvb2tpbmdfZm9ybV9leHBvcnRlciwgeyBvbmNlOiB0cnVlIH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4cG9ydCBmb3IgXCJCb29raW5nIERhdGFcIiAoQ29udGVudCBvZiBib29raW5nIGZpZWxkcyBkYXRhKVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyoqXHJcblx0ICogQm9va2luZyBEYXRhIGV4cG9ydGVyIGNhbGxiYWNrIChcIkNvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YVwiKSBmb3IgXCJzZWxlY3RcIi5cclxuXHQgKlxyXG5cdCAqIERlZmF1bHQgYmVoYXZpb3I6XHJcblx0ICogICA8Yj5MYWJlbDwvYj46IDxmPltmaWVsZF9uYW1lXTwvZj48YnI+XHJcblx0ICpcclxuXHQgKiBSZWdpc3RlcmVkIHBlciBmaWVsZCB0eXBlIHZpYTpcclxuXHQgKiAgIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciggJ3NlbGVjdCcsIGNhbGxiYWNrIClcclxuXHQgKiAgIChhbmQgYWxzbyBhcyBhIGxlZ2FjeSBhbGlhczogJ3NlbGVjdGJveCcpXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfc2VsZWN0X2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpIHtcclxuXHJcblx0XHR2YXIgQyA9IHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xyXG5cdFx0aWYgKCAhIEMgfHwgdHlwZW9mIEMucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgKSB7IHJldHVybjsgfVxyXG5cdFx0aWYgKCB0eXBlb2YgQy5oYXNfZXhwb3J0ZXIgPT09ICdmdW5jdGlvbicgJiYgQy5oYXNfZXhwb3J0ZXIoICdzZWxlY3QnICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdHZhciBleHBvcnRlcl9jYWxsYmFjayA9IGZ1bmN0aW9uICggZmllbGQsIGVtaXQsIGV4dHJhcyApIHtcclxuXHJcblx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHRcdFx0dmFyIGNmZyA9IGV4dHJhcy5jZmcgfHwge307XHJcblxyXG5cdFx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLmNvbXB1dGVfbmFtZSAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHQvLyBLZWVwIHRoZSBleGFjdCBleHBvcnRlZCBuYW1lIGluIHN5bmMgd2l0aCB0aGUgQm9va2luZyBGb3JtIGV4cG9ydGVyLlxyXG5cdFx0XHR2YXIgbmFtZSA9IEV4cC5jb21wdXRlX25hbWUoICdzZWxlY3QnLCBmaWVsZCApO1xyXG5cdFx0XHRpZiAoICEgbmFtZSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHR2YXIgcmF3X2xhYmVsID0gKCB0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICkgPyBmaWVsZC5sYWJlbCA6ICcnO1xyXG5cdFx0XHR2YXIgbGFiZWwgICAgID0gcmF3X2xhYmVsLnRyaW0oKSB8fCBuYW1lO1xyXG5cclxuXHRcdFx0Ly8gU2hhcmVkIGZvcm1hdHRlciBrZWVwcyBhbGwgcGFja3MgY29uc2lzdGVudDpcclxuXHRcdFx0Ly8gPGI+TGFiZWw8L2I+OiA8Zj5bbmFtZV08L2Y+PGJyPlxyXG5cdFx0XHRDLmVtaXRfbGluZV9ib2xkX2ZpZWxkKCBlbWl0LCBsYWJlbCwgbmFtZSwgY2ZnICk7XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIE1haW4gdHlwZVxyXG5cdFx0Qy5yZWdpc3RlciggJ3NlbGVjdCcsIGV4cG9ydGVyX2NhbGxiYWNrICk7XHJcblxyXG5cdFx0Ly8gTGVnYWN5IGFsaWFzLCBpZiBuZWVkZWQuXHJcblx0XHRpZiAoIHR5cGVvZiBDLmhhc19leHBvcnRlciAhPT0gJ2Z1bmN0aW9uJyB8fCAhIEMuaGFzX2V4cG9ydGVyKCAnc2VsZWN0Ym94JyApICkge1xyXG5cdFx0XHRDLnJlZ2lzdGVyKCAnc2VsZWN0Ym94JywgZXhwb3J0ZXJfY2FsbGJhY2sgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIgJiYgdHlwZW9mIHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyLnJlZ2lzdGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0cmVnaXN0ZXJfc2VsZWN0X2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Y29udGVudC1leHBvcnRlci1yZWFkeScsIHJlZ2lzdGVyX3NlbGVjdF9ib29raW5nX2RhdGFfZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0fVxyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRTtFQUNiLFlBQVk7O0VBQ1osSUFBSUMsSUFBSSxHQUFVRCxDQUFDLENBQUNFLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDdkMsSUFBSUMsUUFBUSxHQUFNRixJQUFJLENBQUNHLGdDQUFnQztFQUN2RCxJQUFJQyxXQUFXLEdBQUdKLElBQUksQ0FBQ0ssb0JBQW9CO0VBRTNDLElBQUssQ0FBRUgsUUFBUSxFQUFFSSxRQUFRLElBQUksQ0FBRUYsV0FBVyxFQUFHO0lBQzVDTCxDQUFDLENBQUNRLEtBQUssRUFBRUMsR0FBRyxFQUFFQyxLQUFLLEdBQUksdUJBQXVCLEVBQUUsaUNBQWtDLENBQUM7SUFDbkY7RUFDRDtFQUVBLE1BQU1DLHFCQUFxQixTQUFTTixXQUFXLENBQUM7SUFFL0MsT0FBT08sV0FBVyxHQUFHLHVCQUF1QjtJQUM1QyxPQUFPQyxJQUFJLEdBQVUsUUFBUTtJ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

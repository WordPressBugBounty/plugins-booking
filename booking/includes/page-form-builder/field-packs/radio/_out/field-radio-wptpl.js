"use strict";

/**
 * WPBC BFB: Field Renderer for "radio" (WP-template–driven Reference, no fallback)
 * =========================================================================
 * - Uses wp.template('...') for preview
 * - If template is unavailable or fails, shows an inline error message
 * - Inspector UI is produced by wp.template('...')
 * - Assumes wpbc-bfb_core provides WPBC_BFB_Sanitize
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register('radio', Class)
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
  * File:  ../includes/page-form-builder/field-packs/radio/_out/field-radio-wptpl.js
 *
 * @since   11.0.0
 * @modified  2025-09-12 11:39
 * @version 1.0.1
 */
(function (w) {
  'use strict';

  var Core = w.WPBC_BFB_Core || {};
  var Registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Select_Base = Core.WPBC_BFB_Select_Base;
  if (!Registry?.register || !Select_Base) {
    w._wpbc?.dev?.error?.('WPBC_BFB_Field_Radio', 'Registry or Select_Base missing');
    return;
  }
  class WPBC_BFB_Field_Radio extends Select_Base {
    static template_id = 'wpbc-bfb-field-radio';
    static option_row_template_id = 'wpbc-bfb-inspector-radio-option-row';
    static kind = 'radio';
    static ui = Object.assign({}, Select_Base.ui, {
      cssclass_input: '.inspector__input[data-inspector-key="cssclass"]',
      inline_toggle: '.inspector__checkbox.inspector__input[data-inspector-key="layout_inline"]'
    });

    // … keep get_defaults(), render(), on_field_drop() unchanged …

    // =========================
    // Inline layout (row/column)
    // =========================
    static wire_once_radio() {
      if (this.__radio_wired) {
        return;
      }
      this.__radio_wired = true;
      const on_ready_or_render = ev => {
        const panel = ev?.detail?.panel;
        if (!panel) {
          return;
        }
        this.bootstrap_panel(panel); // DnD etc. from Select_Base
        this.sync_inline_toggle_from_css(panel); // reflect cssclass -> toggle
      };
      document.addEventListener('wpbc_bfb_inspector_ready', on_ready_or_render);
      document.addEventListener('wpbc_bfb_inspector_render', on_ready_or_render);
      const root = document.getElementById('wpbc_bfb__inspector');
      if (!root) {
        return;
      }
      const get_panel = t => t?.closest?.('.wpbc_bfb__inspector__body') || root.querySelector('.wpbc_bfb__inspector__body') || null;

      // Toggle changed by user
      root.addEventListener('change', e => {
        const panel = get_panel(e.target);
        if (!panel) {
          return;
        }
        if (e.target.matches?.(this.ui.inline_toggle)) {
          e.target.setAttribute('aria-checked', e.target.checked ? 'true' : 'false');
          this.apply_inline_toggle_to_css(panel, !!e.target.checked);
        }
      }, true);

      // Manual edit of CSS class
      root.addEventListener('input', e => {
        const panel = get_panel(e.target);
        if (!panel) {
          return;
        }
        if (e.target.matches?.(this.ui.cssclass_input)) {
          this.sync_inline_toggle_from_css(panel);
        }
      }, true);
    }
    static get_cssclass_input(panel) {
      return panel ? panel.querySelector(this.ui.cssclass_input) : null;
    }
    static get_inline_toggle(panel) {
      return panel ? panel.querySelector(this.ui.inline_toggle) : null;
    }
    static has_inline_class(classes_str) {
      const s = String(classes_str || '').trim();
      if (!s) {
        return false;
      }
      return (' ' + s.replace(/\s+/g, ' ') + ' ').indexOf(' group_inline ') !== -1;
    }
    static add_inline_class(classes_str) {
      var tokens = String(classes_str || '').trim().split(/\s+/).filter(Boolean);
      if (tokens.indexOf('group_inline') === -1) {
        tokens.push('group_inline');
      }
      return tokens.join(' ').trim();
    }
    static remove_inline_class(classes_str) {
      var tokens = String(classes_str || '').trim().split(/\s+/).filter(Boolean);
      tokens = tokens.filter(function (t) {
        return t !== 'group_inline';
      });
      return tokens.join(' ').trim();
    }

    /**
     * Mirror CSS class -> toggle checked state.
     * @param {HTMLElement} panel
     */
    static sync_inline_toggle_from_css(panel) {
      const input = this.get_cssclass_input(panel);
      const toggle = this.get_inline_toggle(panel);
      if (!input || !toggle) {
        return;
      }
      const has = this.has_inline_class(input.value);
      if (has) {
        if (!toggle.checked) {
          toggle.checked = true;
        }
        toggle.setAttribute('aria-checked', 'true');
      } else {
        if (toggle.checked) {
          toggle.checked = false;
        }
        toggle.setAttribute('aria-checked', 'false');
      }
    }

    /**
     * Apply toggle -> add/remove "group_inline" in CSS class field; persist and mirror to canvas node.
     * @param {HTMLElement} panel
     * @param {boolean} on
     */
    static apply_inline_toggle_to_css(panel, on) {
      const input = this.get_cssclass_input(panel);
      const toggle = this.get_inline_toggle(panel);
      if (!input || !toggle) {
        return;
      }
      const prev = String(input.value || '');
      const next = on ? this.add_inline_class(prev) : this.remove_inline_class(prev);
      if (next !== prev) {
        input.value = next;

        // Persist to model
        try {
          input.dispatchEvent(new Event('input', {
            bubbles: true
          }));
          input.dispatchEvent(new Event('change', {
            bubbles: true
          }));
        } catch (_) {}

        // Mirror to selected field node
        const field = panel.__selectbase_field || document.querySelector('.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected');
        if (field) {
          field.dataset.cssclass = next;
          field.dispatchEvent(new CustomEvent('wpbc_bfb_field_data_changed', {
            bubbles: true,
            detail: {
              key: 'cssclass',
              value: next
            }
          }));
          Core.Structure?.update_field_prop?.(field, 'cssclass', next);
        }
      }

      // Keep ARIA in sync (also set above on change)
      toggle.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  // Register & wire
  try {
    Registry.register('radio', WPBC_BFB_Field_Radio);
  } catch (e) {
    w._wpbc?.dev?.error?.('WPBC_BFB_Field_Radio.register', e);
  }
  w.WPBC_BFB_Field_Radio = WPBC_BFB_Field_Radio;
  try {
    WPBC_BFB_Field_Radio.wire_once_radio();
  } catch (_) {}

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Form" (Advanced Form shortcode)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Form exporter callback (Advanced Form shortcode) for "radio".
   *
   * This callback is registered per field type via:
   *   WPBC_BFB_Exporter.register( 'radio', callback )
   *
   * Core call site (builder-exporter.js):
   *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
   *     -> callback( field, emit, { io, cfg, once, ctx, core } );
   *
   * @callback WPBC_BFB_ExporterCallback
   * @param {Object}  field
   *   Normalized field data coming from the Builder structure.
   *   - field.type          {string}   Field type, here "radio".
   *   - field.label         {string}   Visible label in the form (may be empty).
   *   - field.name          {string}   Name as stored on the canvas (already validated).
   *   - field.html_id       {string}   Optional HTML id / user-visible id.
   *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
   *   - field.options       {Array}    Options for radio group (label/value/selected).
   *   - field.label_first   {boolean}  Optional flag to render label before options.
   *   - field.placeholder   {string}   Optional placeholder (rarely used for radio).
   *   - ...                 (Any other pack-specific props are also present.)
   *
   * @param {function(string):void} emit
   *   Emits one line/fragment into the export buffer.
   *
   * @param {Object} [extras]
   *   Extra context passed by the core exporter:
   *   - extras.io   {Object} low-level writer (open/close/push/blank)
   *   - extras.cfg  {Object} export configuration (addLabels, newline, gapPercent, ...)
   *   - extras.once {Object} once-per-form guards
   *   - extras.ctx  {Object} shared export context (ctx.usedIds etc.)
   *   - extras.core {Object} reference to WPBC_BFB_Core
   */
  function register_radio_booking_form_exporter() {
    var Exp = w.WPBC_BFB_Exporter;
    if (!Exp || typeof Exp.register !== 'function') {
      return;
    }
    if (typeof Exp.has_exporter === 'function' && Exp.has_exporter('radio')) {
      return;
    }
    var S = Core.WPBC_BFB_Sanitize || w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize || {};
    var esc_html = S.escape_html || function (v) {
      return String(v);
    };

    /**
     * @type {WPBC_BFB_ExporterCallback}
     */
    Exp.register('radio', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var ctx = extras.ctx;
      var addLabels = cfg.addLabels !== false;

      // Required marker (same semantics as other text-like fields).
      var is_req = Exp.is_required(field);
      var req_mark = is_req ? '*' : '';

      // Name / id / classes come from shared helpers so they stay in sync with other packs.
      var name = Exp.compute_name('radio', field);
      var id_opt = Exp.id_option(field, ctx);
      var cls_opts = Exp.class_options(field);

      // Core helper builds the final radio shortcode with:
      // - ALWAYS a bare `use_label_element` token.
      // - Optional label_first:"1" when requested.
      // - Proper order: name id cls  use_label_element  default tokens label_first.
      var body = Exp.choice_tag('radio', req_mark, name, field, id_opt, cls_opts);

      // Label behavior mirrors the text/checkbox exporters.
      var raw_label = field && typeof field.label === 'string' ? field.label : '';
      var label = raw_label.trim();
      if (label && addLabels) {
        emit('<l>' + esc_html(label) + req_mark + '</l>');
        emit('<br>' + body);
      } else {
        emit(body);
      }
      // Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
    });
  }

  // Try immediate registration; if core isn’t ready, wait for the event.
  if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function') {
    register_radio_booking_form_exporter();
  } else {
    document.addEventListener('wpbc:bfb:exporter-ready', register_radio_booking_form_exporter, {
      once: true
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Export for "Booking Data" (Content of booking fields data)
  // -----------------------------------------------------------------------------------------------------------------
  /**
   * Booking Data exporter callback ("Content of booking fields data") for "radio".
   *
   * Default behavior:
   *   <b>Label</b>: <f>[field_name]</f><br>
   *
   * Registered per field type via:
   *   WPBC_BFB_ContentExporter.register( 'radio', callback )
   *
   * Packs can customize output if needed, but for radio we keep the same
   * pattern as text/checkbox:
   *   - Use the actual canvas name as token.
   *   - Use label as visible title (fallback to name if empty).
   */
  function register_radio_booking_data_exporter() {
    var C = w.WPBC_BFB_ContentExporter;
    if (!C || typeof C.register !== 'function') {
      return;
    }
    if (typeof C.has_exporter === 'function' && C.has_exporter('radio')) {
      return;
    }
    C.register('radio', function (field, emit, extras) {
      extras = extras || {};
      var cfg = extras.cfg || {};
      var Exp = w.WPBC_BFB_Exporter;
      if (!Exp || typeof Exp.compute_name !== 'function') {
        return;
      }

      // Keep the exact exported name in sync with the Booking Form exporter.
      var name = Exp.compute_name('radio', field);
      if (!name) {
        return;
      }
      var raw_label = typeof field.label === 'string' ? field.label : '';
      var label = raw_label.trim() || name;

      // Shared formatter keeps all packs consistent.
      C.emit_line_bold_field(emit, label, name, cfg);
    });
  }
  if (w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function') {
    register_radio_booking_data_exporter();
  } else {
    document.addEventListener('wpbc:bfb:content-exporter-ready', register_radio_booking_data_exporter, {
      once: true
    });
  }
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvcmFkaW8vX291dC9maWVsZC1yYWRpby13cHRwbC5qcyIsIm5hbWVzIjpbInciLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlJlZ2lzdHJ5IiwiV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnkiLCJTZWxlY3RfQmFzZSIsIldQQkNfQkZCX1NlbGVjdF9CYXNlIiwicmVnaXN0ZXIiLCJfd3BiYyIsImRldiIsImVycm9yIiwiV1BCQ19CRkJfRmllbGRfUmFkaW8iLCJ0ZW1wbGF0ZV9pZCIsIm9wdGlvbl9yb3dfdGVtcGxhdGVfaWQiLCJraW5kIiwidWkiLCJPYmplY3QiLCJhc3NpZ24iLCJjc3NjbGFzc19pbnB1dCIsImlubGluZV90b2dnbGUiLCJ3aXJlX29uY2VfcmFkaW8iLCJfX3JhZGlvX3dpcmVkIiwib25fcmVhZHlfb3JfcmVuZGVyIiwiZXYiLCJwYW5lbCIsImRldGFpbCIsImJvb3RzdHJhcF9wYW5lbCIsInN5bmNfaW5saW5lX3RvZ2dsZV9mcm9tX2NzcyIsImRvY3VtZW50IiwiYWRkRXZlbnRMaXN0ZW5lciIsInJvb3QiLCJnZXRFbGVtZW50QnlJZCIsImdldF9wYW5lbCIsInQiLCJjbG9zZXN0IiwicXVlcnlTZWxlY3RvciIsImUiLCJ0YXJnZXQiLCJtYXRjaGVzIiwic2V0QXR0cmlidXRlIiwiY2hlY2tlZCIsImFwcGx5X2lubGluZV90b2dnbGVfdG9fY3NzIiwiZ2V0X2Nzc2NsYXNzX2lucHV0IiwiZ2V0X2lubGluZV90b2dnbGUiLCJoYXNfaW5saW5lX2NsYXNzIiwiY2xhc3Nlc19zdHIiLCJzIiwiU3RyaW5nIiwidHJpbSIsInJlcGxhY2UiLCJpbmRleE9mIiwiYWRkX2lubGluZV9jbGFzcyIsInRva2VucyIsInNwbGl0IiwiZmlsdGVyIiwiQm9vbGVhbiIsInB1c2giLCJqb2luIiwicmVtb3ZlX2lubGluZV9jbGFzcyIsImlucHV0IiwidG9nZ2xlIiwiaGFzIiwidmFsdWUiLCJvbiIsInByZXYiLCJuZXh0IiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsIl8iLCJmaWVsZCIsIl9fc2VsZWN0YmFzZV9maWVsZCIsImRhdGFzZXQiLCJjc3NjbGFzcyIsIkN1c3RvbUV2ZW50Iiwia2V5IiwiU3RydWN0dXJlIiwidXBkYXRlX2ZpZWxkX3Byb3AiLCJyZWdpc3Rlcl9yYWRpb19ib29raW5nX2Zvcm1fZXhwb3J0ZXIiLCJFeHAiLCJXUEJDX0JGQl9FeHBvcnRlciIsImhhc19leHBvcnRlciIsIlMiLCJXUEJDX0JGQl9TYW5pdGl6ZSIsImVzY19odG1sIiwiZXNjYXBlX2h0bWwiLCJ2IiwiZW1pdCIsImV4dHJhcyIsImNmZyIsImN0eCIsImFkZExhYmVscyIsImlzX3JlcSIsImlzX3JlcXVpcmVkIiwicmVxX21hcmsiLCJuYW1lIiwiY29tcHV0ZV9uYW1lIiwiaWRfb3B0IiwiaWRfb3B0aW9uIiwiY2xzX29wdHMiLCJjbGFzc19vcHRpb25zIiwiYm9keSIsImNob2ljZV90YWciLCJyYXdfbGFiZWwiLCJsYWJlbCIsIm9uY2UiLCJyZWdpc3Rlcl9yYWRpb19ib29raW5nX2RhdGFfZXhwb3J0ZXIiLCJDIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwiZW1pdF9saW5lX2JvbGRfZmllbGQiLCJ3aW5kb3ciXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9yYWRpby9fc3JjL2ZpZWxkLXJhZGlvLXdwdHBsLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBXUEJDIEJGQjogRmllbGQgUmVuZGVyZXIgZm9yIFwicmFkaW9cIiAoV1AtdGVtcGxhdGXigJNkcml2ZW4gUmVmZXJlbmNlLCBubyBmYWxsYmFjaylcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiAtIFVzZXMgd3AudGVtcGxhdGUoJy4uLicpIGZvciBwcmV2aWV3XHJcbiAqIC0gSWYgdGVtcGxhdGUgaXMgdW5hdmFpbGFibGUgb3IgZmFpbHMsIHNob3dzIGFuIGlubGluZSBlcnJvciBtZXNzYWdlXHJcbiAqIC0gSW5zcGVjdG9yIFVJIGlzIHByb2R1Y2VkIGJ5IHdwLnRlbXBsYXRlKCcuLi4nKVxyXG4gKiAtIEFzc3VtZXMgd3BiYy1iZmJfY29yZSBwcm92aWRlcyBXUEJDX0JGQl9TYW5pdGl6ZVxyXG4gKlxyXG4gKiBDb250cmFjdHM6XHJcbiAqIC0gUmVnaXN0cnk6ICBXUEJDX0JGQl9GaWVsZF9SZW5kZXJlcl9SZWdpc3RyeS5yZWdpc3RlcigncmFkaW8nLCBDbGFzcylcclxuICogLSBDbGFzcyBBUEk6IHN0YXRpYyBnZXRfZGVmYXVsdHMoKSwgc3RhdGljIHJlbmRlcihlbCwgZGF0YSwgY3R4KSwgc3RhdGljIG9uX2ZpZWxkX2Ryb3AoZGF0YSwgZWwsIGN0eD8pIFtvcHRpb25hbF1cclxuICpcclxuICAqIEZpbGU6ICAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9yYWRpby9fb3V0L2ZpZWxkLXJhZGlvLXdwdHBsLmpzXHJcbiAqXHJcbiAqIEBzaW5jZSAgIDExLjAuMFxyXG4gKiBAbW9kaWZpZWQgIDIwMjUtMDktMTIgMTE6MzlcclxuICogQHZlcnNpb24gMS4wLjFcclxuICovXHJcbihmdW5jdGlvbiAodykge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0dmFyIENvcmUgICAgICAgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdHZhciBSZWdpc3RyeSAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfUmVuZGVyZXJfUmVnaXN0cnk7XHJcblx0dmFyIFNlbGVjdF9CYXNlID0gQ29yZS5XUEJDX0JGQl9TZWxlY3RfQmFzZTtcclxuXHJcblx0aWYgKCAhIFJlZ2lzdHJ5Py5yZWdpc3RlciB8fCAhIFNlbGVjdF9CYXNlICkge1xyXG5cdFx0dy5fd3BiYz8uZGV2Py5lcnJvcj8uKCAnV1BCQ19CRkJfRmllbGRfUmFkaW8nLCAnUmVnaXN0cnkgb3IgU2VsZWN0X0Jhc2UgbWlzc2luZycgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGNsYXNzIFdQQkNfQkZCX0ZpZWxkX1JhZGlvIGV4dGVuZHMgU2VsZWN0X0Jhc2Uge1xyXG5cclxuXHRcdHN0YXRpYyB0ZW1wbGF0ZV9pZCAgICAgICAgICAgID0gJ3dwYmMtYmZiLWZpZWxkLXJhZGlvJztcclxuXHRcdHN0YXRpYyBvcHRpb25fcm93X3RlbXBsYXRlX2lkID0gJ3dwYmMtYmZiLWluc3BlY3Rvci1yYWRpby1vcHRpb24tcm93JztcclxuXHRcdHN0YXRpYyBraW5kICAgICAgICAgICAgICAgICAgID0gJ3JhZGlvJztcclxuXHJcblx0XHRzdGF0aWMgdWkgPSBPYmplY3QuYXNzaWduKCB7fSwgU2VsZWN0X0Jhc2UudWksIHtcclxuXHRcdFx0Y3NzY2xhc3NfaW5wdXQ6ICcuaW5zcGVjdG9yX19pbnB1dFtkYXRhLWluc3BlY3Rvci1rZXk9XCJjc3NjbGFzc1wiXScsXHJcblx0XHRcdGlubGluZV90b2dnbGUgOiAnLmluc3BlY3Rvcl9fY2hlY2tib3guaW5zcGVjdG9yX19pbnB1dFtkYXRhLWluc3BlY3Rvci1rZXk9XCJsYXlvdXRfaW5saW5lXCJdJ1xyXG5cdFx0fSApO1xyXG5cclxuXHRcdC8vIOKApiBrZWVwIGdldF9kZWZhdWx0cygpLCByZW5kZXIoKSwgb25fZmllbGRfZHJvcCgpIHVuY2hhbmdlZCDigKZcclxuXHJcblx0XHQvLyA9PT09PT09PT09PT09PT09PT09PT09PT09XHJcblx0XHQvLyBJbmxpbmUgbGF5b3V0IChyb3cvY29sdW1uKVxyXG5cdFx0Ly8gPT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5cdFx0c3RhdGljIHdpcmVfb25jZV9yYWRpbygpIHtcclxuXHRcdFx0aWYgKCB0aGlzLl9fcmFkaW9fd2lyZWQgKSB7IHJldHVybjsgfVxyXG5cdFx0XHR0aGlzLl9fcmFkaW9fd2lyZWQgPSB0cnVlO1xyXG5cclxuXHRcdFx0Y29uc3Qgb25fcmVhZHlfb3JfcmVuZGVyID0gKCBldiApID0+IHtcclxuXHRcdFx0XHRjb25zdCBwYW5lbCA9IGV2Py5kZXRhaWw/LnBhbmVsO1xyXG5cdFx0XHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0dGhpcy5ib290c3RyYXBfcGFuZWwoIHBhbmVsICk7ICAgICAgICAgICAgICAgICAvLyBEbkQgZXRjLiBmcm9tIFNlbGVjdF9CYXNlXHJcblx0XHRcdFx0dGhpcy5zeW5jX2lubGluZV90b2dnbGVfZnJvbV9jc3MoIHBhbmVsICk7ICAgICAvLyByZWZsZWN0IGNzc2NsYXNzIC0+IHRvZ2dsZVxyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfYmZiX2luc3BlY3Rvcl9yZWFkeScsIG9uX3JlYWR5X29yX3JlbmRlciApO1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmJfaW5zcGVjdG9yX3JlbmRlcicsIG9uX3JlYWR5X29yX3JlbmRlciApO1xyXG5cclxuXHRcdFx0Y29uc3Qgcm9vdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3RvcicgKTtcclxuXHRcdFx0aWYgKCAhIHJvb3QgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Y29uc3QgZ2V0X3BhbmVsID0gKCB0ICkgPT4gdD8uY2xvc2VzdD8uKCAnLndwYmNfYmZiX19pbnNwZWN0b3JfX2JvZHknICkgfHwgcm9vdC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19pbnNwZWN0b3JfX2JvZHknICkgfHwgbnVsbDtcclxuXHJcblx0XHRcdC8vIFRvZ2dsZSBjaGFuZ2VkIGJ5IHVzZXJcclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgKCBlICkgPT4ge1xyXG5cdFx0XHRcdGNvbnN0IHBhbmVsID0gZ2V0X3BhbmVsKCBlLnRhcmdldCApO1xyXG5cdFx0XHRcdGlmICggISBwYW5lbCApIHsgcmV0dXJuOyB9XHJcblx0XHRcdFx0aWYgKCBlLnRhcmdldC5tYXRjaGVzPy4oIHRoaXMudWkuaW5saW5lX3RvZ2dsZSApICkge1xyXG5cdFx0XHRcdFx0ZS50YXJnZXQuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgZS50YXJnZXQuY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHRcdHRoaXMuYXBwbHlfaW5saW5lX3RvZ2dsZV90b19jc3MoIHBhbmVsLCAhISBlLnRhcmdldC5jaGVja2VkICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0XHQvLyBNYW51YWwgZWRpdCBvZiBDU1MgY2xhc3NcclxuXHRcdFx0cm9vdC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCAoIGUgKSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgcGFuZWwgPSBnZXRfcGFuZWwoIGUudGFyZ2V0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHBhbmVsICkgeyByZXR1cm47IH1cclxuXHRcdFx0XHRpZiAoIGUudGFyZ2V0Lm1hdGNoZXM/LiggdGhpcy51aS5jc3NjbGFzc19pbnB1dCApICkge1xyXG5cdFx0XHRcdFx0dGhpcy5zeW5jX2lubGluZV90b2dnbGVfZnJvbV9jc3MoIHBhbmVsICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9LCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0c3RhdGljIGdldF9jc3NjbGFzc19pbnB1dCggcGFuZWwgKSB7XHJcblx0XHRcdHJldHVybiBwYW5lbCA/IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoIHRoaXMudWkuY3NzY2xhc3NfaW5wdXQgKSA6IG51bGw7XHJcblx0XHR9XHJcblx0XHRzdGF0aWMgZ2V0X2lubGluZV90b2dnbGUoIHBhbmVsICkge1xyXG5cdFx0XHRyZXR1cm4gcGFuZWwgPyBwYW5lbC5xdWVyeVNlbGVjdG9yKCB0aGlzLnVpLmlubGluZV90b2dnbGUgKSA6IG51bGw7XHJcblx0XHR9XHJcblx0XHRzdGF0aWMgaGFzX2lubGluZV9jbGFzcyggY2xhc3Nlc19zdHIgKSB7XHJcblx0XHRcdGNvbnN0IHMgPSBTdHJpbmcoIGNsYXNzZXNfc3RyIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRpZiAoICEgcyApIHsgcmV0dXJuIGZhbHNlOyB9XHJcblx0XHRcdHJldHVybiAoICcgJyArIHMucmVwbGFjZSggL1xccysvZywgJyAnICkgKyAnICcgKS5pbmRleE9mKCAnIGdyb3VwX2lubGluZSAnICkgIT09IC0xO1xyXG5cdFx0fVxyXG5cdFx0c3RhdGljIGFkZF9pbmxpbmVfY2xhc3MoIGNsYXNzZXNfc3RyICkge1xyXG5cdFx0XHR2YXIgdG9rZW5zID0gU3RyaW5nKCBjbGFzc2VzX3N0ciB8fCAnJyApLnRyaW0oKS5zcGxpdCggL1xccysvICkuZmlsdGVyKCBCb29sZWFuICk7XHJcblx0XHRcdGlmICggdG9rZW5zLmluZGV4T2YoICdncm91cF9pbmxpbmUnICkgPT09IC0xICkge1xyXG5cdFx0XHRcdHRva2Vucy5wdXNoKCAnZ3JvdXBfaW5saW5lJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiB0b2tlbnMuam9pbiggJyAnICkudHJpbSgpO1xyXG5cdFx0fVxyXG5cdFx0c3RhdGljIHJlbW92ZV9pbmxpbmVfY2xhc3MoIGNsYXNzZXNfc3RyICkge1xyXG5cdFx0XHR2YXIgdG9rZW5zID0gU3RyaW5nKCBjbGFzc2VzX3N0ciB8fCAnJyApLnRyaW0oKS5zcGxpdCggL1xccysvICkuZmlsdGVyKCBCb29sZWFuICk7XHJcblx0XHRcdHRva2VucyA9IHRva2Vucy5maWx0ZXIoIGZ1bmN0aW9uICggdCApIHsgcmV0dXJuIHQgIT09ICdncm91cF9pbmxpbmUnOyB9ICk7XHJcblx0XHRcdHJldHVybiB0b2tlbnMuam9pbiggJyAnICkudHJpbSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTWlycm9yIENTUyBjbGFzcyAtPiB0b2dnbGUgY2hlY2tlZCBzdGF0ZS5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHBhbmVsXHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBzeW5jX2lubGluZV90b2dnbGVfZnJvbV9jc3MoIHBhbmVsICkge1xyXG5cdFx0XHRjb25zdCBpbnB1dCAgPSB0aGlzLmdldF9jc3NjbGFzc19pbnB1dCggcGFuZWwgKTtcclxuXHRcdFx0Y29uc3QgdG9nZ2xlID0gdGhpcy5nZXRfaW5saW5lX3RvZ2dsZSggcGFuZWwgKTtcclxuXHRcdFx0aWYgKCAhIGlucHV0IHx8ICEgdG9nZ2xlICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdGNvbnN0IGhhcyA9IHRoaXMuaGFzX2lubGluZV9jbGFzcyggaW5wdXQudmFsdWUgKTtcclxuXHRcdFx0aWYgKCBoYXMgKSB7XHJcblx0XHRcdFx0aWYgKCAhIHRvZ2dsZS5jaGVja2VkICkgeyB0b2dnbGUuY2hlY2tlZCA9IHRydWU7IH1cclxuXHRcdFx0XHR0b2dnbGUuc2V0QXR0cmlidXRlKCAnYXJpYS1jaGVja2VkJywgJ3RydWUnICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0aWYgKCB0b2dnbGUuY2hlY2tlZCApIHsgdG9nZ2xlLmNoZWNrZWQgPSBmYWxzZTsgfVxyXG5cdFx0XHRcdHRvZ2dsZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWNoZWNrZWQnLCAnZmFsc2UnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFwcGx5IHRvZ2dsZSAtPiBhZGQvcmVtb3ZlIFwiZ3JvdXBfaW5saW5lXCIgaW4gQ1NTIGNsYXNzIGZpZWxkOyBwZXJzaXN0IGFuZCBtaXJyb3IgdG8gY2FudmFzIG5vZGUuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBwYW5lbFxyXG5cdFx0ICogQHBhcmFtIHtib29sZWFufSBvblxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgYXBwbHlfaW5saW5lX3RvZ2dsZV90b19jc3MoIHBhbmVsLCBvbiApIHtcclxuXHRcdFx0Y29uc3QgaW5wdXQgID0gdGhpcy5nZXRfY3NzY2xhc3NfaW5wdXQoIHBhbmVsICk7XHJcblx0XHRcdGNvbnN0IHRvZ2dsZSA9IHRoaXMuZ2V0X2lubGluZV90b2dnbGUoIHBhbmVsICk7XHJcblx0XHRcdGlmICggISBpbnB1dCB8fCAhIHRvZ2dsZSApIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRjb25zdCBwcmV2ID0gU3RyaW5nKCBpbnB1dC52YWx1ZSB8fCAnJyApO1xyXG5cdFx0XHRjb25zdCBuZXh0ID0gb24gPyB0aGlzLmFkZF9pbmxpbmVfY2xhc3MoIHByZXYgKSA6IHRoaXMucmVtb3ZlX2lubGluZV9jbGFzcyggcHJldiApO1xyXG5cclxuXHRcdFx0aWYgKCBuZXh0ICE9PSBwcmV2ICkge1xyXG5cdFx0XHRcdGlucHV0LnZhbHVlID0gbmV4dDtcclxuXHJcblx0XHRcdFx0Ly8gUGVyc2lzdCB0byBtb2RlbFxyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRpbnB1dC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdpbnB1dCcsICB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0XHRpbnB1dC5kaXNwYXRjaEV2ZW50KCBuZXcgRXZlbnQoICdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSApICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF8gKSB7fVxyXG5cclxuXHRcdFx0XHQvLyBNaXJyb3IgdG8gc2VsZWN0ZWQgZmllbGQgbm9kZVxyXG5cdFx0XHRcdGNvbnN0IGZpZWxkID0gcGFuZWwuX19zZWxlY3RiYXNlX2ZpZWxkXHJcblx0XHRcdFx0XHR8fCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZC5pcy1zZWxlY3RlZCwgLndwYmNfYmZiX19maWVsZC0tc2VsZWN0ZWQnICk7XHJcblx0XHRcdFx0aWYgKCBmaWVsZCApIHtcclxuXHRcdFx0XHRcdGZpZWxkLmRhdGFzZXQuY3NzY2xhc3MgPSBuZXh0O1xyXG5cdFx0XHRcdFx0ZmllbGQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiY19iZmJfZmllbGRfZGF0YV9jaGFuZ2VkJywge1xyXG5cdFx0XHRcdFx0XHRidWJibGVzOiB0cnVlLCBkZXRhaWw6IHsga2V5OiAnY3NzY2xhc3MnLCB2YWx1ZTogbmV4dCB9XHJcblx0XHRcdFx0XHR9ICkgKTtcclxuXHRcdFx0XHRcdENvcmUuU3RydWN0dXJlPy51cGRhdGVfZmllbGRfcHJvcD8uKCBmaWVsZCwgJ2Nzc2NsYXNzJywgbmV4dCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gS2VlcCBBUklBIGluIHN5bmMgKGFsc28gc2V0IGFib3ZlIG9uIGNoYW5nZSlcclxuXHRcdFx0dG9nZ2xlLnNldEF0dHJpYnV0ZSggJ2FyaWEtY2hlY2tlZCcsIG9uID8gJ3RydWUnIDogJ2ZhbHNlJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gUmVnaXN0ZXIgJiB3aXJlXHJcblx0dHJ5IHsgUmVnaXN0cnkucmVnaXN0ZXIoICdyYWRpbycsIFdQQkNfQkZCX0ZpZWxkX1JhZGlvICk7IH0gY2F0Y2ggKCBlICkgeyB3Ll93cGJjPy5kZXY/LmVycm9yPy4oICdXUEJDX0JGQl9GaWVsZF9SYWRpby5yZWdpc3RlcicsIGUgKTsgfVxyXG5cdHcuV1BCQ19CRkJfRmllbGRfUmFkaW8gPSBXUEJDX0JGQl9GaWVsZF9SYWRpbztcclxuXHR0cnkgeyBXUEJDX0JGQl9GaWVsZF9SYWRpby53aXJlX29uY2VfcmFkaW8oKTsgfSBjYXRjaCAoIF8gKSB7fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBGb3JtXCIgKEFkdmFuY2VkIEZvcm0gc2hvcnRjb2RlKVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8qKlxyXG5cdFx0ICogQm9va2luZyBGb3JtIGV4cG9ydGVyIGNhbGxiYWNrIChBZHZhbmNlZCBGb3JtIHNob3J0Y29kZSkgZm9yIFwicmFkaW9cIi5cclxuXHRcdCAqXHJcblx0XHQgKiBUaGlzIGNhbGxiYWNrIGlzIHJlZ2lzdGVyZWQgcGVyIGZpZWxkIHR5cGUgdmlhOlxyXG5cdFx0ICogICBXUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciggJ3JhZGlvJywgY2FsbGJhY2sgKVxyXG5cdFx0ICpcclxuXHRcdCAqIENvcmUgY2FsbCBzaXRlIChidWlsZGVyLWV4cG9ydGVyLmpzKTpcclxuXHRcdCAqICAgV1BCQ19CRkJfRXhwb3J0ZXIucnVuX3JlZ2lzdGVyZWRfZXhwb3J0ZXIoIGZpZWxkLCBpbywgY2ZnLCBvbmNlLCBjdHggKVxyXG5cdFx0ICogICAgIC0+IGNhbGxiYWNrKCBmaWVsZCwgZW1pdCwgeyBpbywgY2ZnLCBvbmNlLCBjdHgsIGNvcmUgfSApO1xyXG5cdFx0ICpcclxuXHRcdCAqIEBjYWxsYmFjayBXUEJDX0JGQl9FeHBvcnRlckNhbGxiYWNrXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gIGZpZWxkXHJcblx0XHQgKiAgIE5vcm1hbGl6ZWQgZmllbGQgZGF0YSBjb21pbmcgZnJvbSB0aGUgQnVpbGRlciBzdHJ1Y3R1cmUuXHJcblx0XHQgKiAgIC0gZmllbGQudHlwZSAgICAgICAgICB7c3RyaW5nfSAgIEZpZWxkIHR5cGUsIGhlcmUgXCJyYWRpb1wiLlxyXG5cdFx0ICogICAtIGZpZWxkLmxhYmVsICAgICAgICAge3N0cmluZ30gICBWaXNpYmxlIGxhYmVsIGluIHRoZSBmb3JtIChtYXkgYmUgZW1wdHkpLlxyXG5cdFx0ICogICAtIGZpZWxkLm5hbWUgICAgICAgICAge3N0cmluZ30gICBOYW1lIGFzIHN0b3JlZCBvbiB0aGUgY2FudmFzIChhbHJlYWR5IHZhbGlkYXRlZCkuXHJcblx0XHQgKiAgIC0gZmllbGQuaHRtbF9pZCAgICAgICB7c3RyaW5nfSAgIE9wdGlvbmFsIEhUTUwgaWQgLyB1c2VyLXZpc2libGUgaWQuXHJcblx0XHQgKiAgIC0gZmllbGQuY3NzY2xhc3MgICAgICB7c3RyaW5nfSAgIEV4dHJhIENTUyBjbGFzc2VzIGVudGVyZWQgaW4gSW5zcGVjdG9yLlxyXG5cdFx0ICogICAtIGZpZWxkLm9wdGlvbnMgICAgICAge0FycmF5fSAgICBPcHRpb25zIGZvciByYWRpbyBncm91cCAobGFiZWwvdmFsdWUvc2VsZWN0ZWQpLlxyXG5cdFx0ICogICAtIGZpZWxkLmxhYmVsX2ZpcnN0ICAge2Jvb2xlYW59ICBPcHRpb25hbCBmbGFnIHRvIHJlbmRlciBsYWJlbCBiZWZvcmUgb3B0aW9ucy5cclxuXHRcdCAqICAgLSBmaWVsZC5wbGFjZWhvbGRlciAgIHtzdHJpbmd9ICAgT3B0aW9uYWwgcGxhY2Vob2xkZXIgKHJhcmVseSB1c2VkIGZvciByYWRpbykuXHJcblx0XHQgKiAgIC0gLi4uICAgICAgICAgICAgICAgICAoQW55IG90aGVyIHBhY2stc3BlY2lmaWMgcHJvcHMgYXJlIGFsc28gcHJlc2VudC4pXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbihzdHJpbmcpOnZvaWR9IGVtaXRcclxuXHRcdCAqICAgRW1pdHMgb25lIGxpbmUvZnJhZ21lbnQgaW50byB0aGUgZXhwb3J0IGJ1ZmZlci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge09iamVjdH0gW2V4dHJhc11cclxuXHRcdCAqICAgRXh0cmEgY29udGV4dCBwYXNzZWQgYnkgdGhlIGNvcmUgZXhwb3J0ZXI6XHJcblx0XHQgKiAgIC0gZXh0cmFzLmlvICAge09iamVjdH0gbG93LWxldmVsIHdyaXRlciAob3Blbi9jbG9zZS9wdXNoL2JsYW5rKVxyXG5cdFx0ICogICAtIGV4dHJhcy5jZmcgIHtPYmplY3R9IGV4cG9ydCBjb25maWd1cmF0aW9uIChhZGRMYWJlbHMsIG5ld2xpbmUsIGdhcFBlcmNlbnQsIC4uLilcclxuXHRcdCAqICAgLSBleHRyYXMub25jZSB7T2JqZWN0fSBvbmNlLXBlci1mb3JtIGd1YXJkc1xyXG5cdFx0ICogICAtIGV4dHJhcy5jdHggIHtPYmplY3R9IHNoYXJlZCBleHBvcnQgY29udGV4dCAoY3R4LnVzZWRJZHMgZXRjLilcclxuXHRcdCAqICAgLSBleHRyYXMuY29yZSB7T2JqZWN0fSByZWZlcmVuY2UgdG8gV1BCQ19CRkJfQ29yZVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiByZWdpc3Rlcl9yYWRpb19ib29raW5nX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblxyXG5cdFx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdFx0aWYgKCAhIEV4cCB8fCB0eXBlb2YgRXhwLnJlZ2lzdGVyICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHRcdFx0aWYgKCB0eXBlb2YgRXhwLmhhc19leHBvcnRlciA9PT0gJ2Z1bmN0aW9uJyAmJiBFeHAuaGFzX2V4cG9ydGVyKCAncmFkaW8nICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0dmFyIFMgICAgICAgID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCAoIHcuV1BCQ19CRkJfQ29yZSAmJiB3LldQQkNfQkZCX0NvcmUuV1BCQ19CRkJfU2FuaXRpemUgKSB8fCB7fTtcclxuXHRcdFx0dmFyIGVzY19odG1sID0gUy5lc2NhcGVfaHRtbCB8fCBmdW5jdGlvbiAodikgeyByZXR1cm4gU3RyaW5nKCB2ICk7IH07XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogQHR5cGUge1dQQkNfQkZCX0V4cG9ydGVyQ2FsbGJhY2t9XHJcblx0XHRcdCAqL1xyXG5cdFx0XHRFeHAucmVnaXN0ZXIoICdyYWRpbycsIGZ1bmN0aW9uIChmaWVsZCwgZW1pdCwgZXh0cmFzKSB7XHJcblxyXG5cdFx0XHRcdGV4dHJhcyA9IGV4dHJhcyB8fCB7fTtcclxuXHJcblx0XHRcdFx0dmFyIGNmZyAgICAgICA9IGV4dHJhcy5jZmcgfHwge307XHJcblx0XHRcdFx0dmFyIGN0eCAgICAgICA9IGV4dHJhcy5jdHg7XHJcblx0XHRcdFx0dmFyIGFkZExhYmVscyA9IGNmZy5hZGRMYWJlbHMgIT09IGZhbHNlO1xyXG5cclxuXHRcdFx0XHQvLyBSZXF1aXJlZCBtYXJrZXIgKHNhbWUgc2VtYW50aWNzIGFzIG90aGVyIHRleHQtbGlrZSBmaWVsZHMpLlxyXG5cdFx0XHRcdHZhciBpc19yZXEgICA9IEV4cC5pc19yZXF1aXJlZCggZmllbGQgKTtcclxuXHRcdFx0XHR2YXIgcmVxX21hcmsgPSBpc19yZXEgPyAnKicgOiAnJztcclxuXHJcblx0XHRcdFx0Ly8gTmFtZSAvIGlkIC8gY2xhc3NlcyBjb21lIGZyb20gc2hhcmVkIGhlbHBlcnMgc28gdGhleSBzdGF5IGluIHN5bmMgd2l0aCBvdGhlciBwYWNrcy5cclxuXHRcdFx0XHR2YXIgbmFtZSAgICAgPSBFeHAuY29tcHV0ZV9uYW1lKCAncmFkaW8nLCBmaWVsZCApO1xyXG5cdFx0XHRcdHZhciBpZF9vcHQgICA9IEV4cC5pZF9vcHRpb24oIGZpZWxkLCBjdHggKTtcclxuXHRcdFx0XHR2YXIgY2xzX29wdHMgPSBFeHAuY2xhc3Nfb3B0aW9ucyggZmllbGQgKTtcclxuXHJcblx0XHRcdFx0Ly8gQ29yZSBoZWxwZXIgYnVpbGRzIHRoZSBmaW5hbCByYWRpbyBzaG9ydGNvZGUgd2l0aDpcclxuXHRcdFx0XHQvLyAtIEFMV0FZUyBhIGJhcmUgYHVzZV9sYWJlbF9lbGVtZW50YCB0b2tlbi5cclxuXHRcdFx0XHQvLyAtIE9wdGlvbmFsIGxhYmVsX2ZpcnN0OlwiMVwiIHdoZW4gcmVxdWVzdGVkLlxyXG5cdFx0XHRcdC8vIC0gUHJvcGVyIG9yZGVyOiBuYW1lIGlkIGNscyAgdXNlX2xhYmVsX2VsZW1lbnQgIGRlZmF1bHQgdG9rZW5zIGxhYmVsX2ZpcnN0LlxyXG5cdFx0XHRcdHZhciBib2R5ID0gRXhwLmNob2ljZV90YWcoICdyYWRpbycsIHJlcV9tYXJrLCBuYW1lLCBmaWVsZCwgaWRfb3B0LCBjbHNfb3B0cyApO1xyXG5cclxuXHRcdFx0XHQvLyBMYWJlbCBiZWhhdmlvciBtaXJyb3JzIHRoZSB0ZXh0L2NoZWNrYm94IGV4cG9ydGVycy5cclxuXHRcdFx0XHR2YXIgcmF3X2xhYmVsID0gKCBmaWVsZCAmJiB0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICkgPyBmaWVsZC5sYWJlbCA6ICcnO1xyXG5cdFx0XHRcdHZhciBsYWJlbCAgICAgPSByYXdfbGFiZWwudHJpbSgpO1xyXG5cclxuXHRcdFx0XHRpZiAoIGxhYmVsICYmIGFkZExhYmVscyApIHtcclxuXHRcdFx0XHRcdGVtaXQoICc8bD4nICsgZXNjX2h0bWwoIGxhYmVsICkgKyByZXFfbWFyayArICc8L2w+JyApO1xyXG5cdFx0XHRcdFx0ZW1pdCggJzxicj4nICsgYm9keSApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRlbWl0KCBib2R5ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIEhlbHAgdGV4dCBpcyBhcHBlbmRlZCBjZW50cmFsbHkgYnkgV1BCQ19CRkJfRXhwb3J0ZXIucmVuZGVyX2ZpZWxkX25vZGUoKS5cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFRyeSBpbW1lZGlhdGUgcmVnaXN0cmF0aW9uOyBpZiBjb3JlIGlzbuKAmXQgcmVhZHksIHdhaXQgZm9yIHRoZSBldmVudC5cclxuXHRcdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5yZWdpc3RlciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmVnaXN0ZXJfcmFkaW9fYm9va2luZ19mb3JtX2V4cG9ydGVyKCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9yYWRpb19ib29raW5nX2Zvcm1fZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBFeHBvcnQgZm9yIFwiQm9va2luZyBEYXRhXCIgKENvbnRlbnQgb2YgYm9va2luZyBmaWVsZHMgZGF0YSlcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvKipcclxuXHRcdCAqIEJvb2tpbmcgRGF0YSBleHBvcnRlciBjYWxsYmFjayAoXCJDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGFcIikgZm9yIFwicmFkaW9cIi5cclxuXHRcdCAqXHJcblx0XHQgKiBEZWZhdWx0IGJlaGF2aW9yOlxyXG5cdFx0ICogICA8Yj5MYWJlbDwvYj46IDxmPltmaWVsZF9uYW1lXTwvZj48YnI+XHJcblx0XHQgKlxyXG5cdFx0ICogUmVnaXN0ZXJlZCBwZXIgZmllbGQgdHlwZSB2aWE6XHJcblx0XHQgKiAgIFdQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlciggJ3JhZGlvJywgY2FsbGJhY2sgKVxyXG5cdFx0ICpcclxuXHRcdCAqIFBhY2tzIGNhbiBjdXN0b21pemUgb3V0cHV0IGlmIG5lZWRlZCwgYnV0IGZvciByYWRpbyB3ZSBrZWVwIHRoZSBzYW1lXHJcblx0XHQgKiBwYXR0ZXJuIGFzIHRleHQvY2hlY2tib3g6XHJcblx0XHQgKiAgIC0gVXNlIHRoZSBhY3R1YWwgY2FudmFzIG5hbWUgYXMgdG9rZW4uXHJcblx0XHQgKiAgIC0gVXNlIGxhYmVsIGFzIHZpc2libGUgdGl0bGUgKGZhbGxiYWNrIHRvIG5hbWUgaWYgZW1wdHkpLlxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiByZWdpc3Rlcl9yYWRpb19ib29raW5nX2RhdGFfZXhwb3J0ZXIoKSB7XHJcblxyXG5cdFx0XHR2YXIgQyA9IHcuV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyO1xyXG5cdFx0XHRpZiAoICEgQyB8fCB0eXBlb2YgQy5yZWdpc3RlciAhPT0gJ2Z1bmN0aW9uJyApIHsgcmV0dXJuOyB9XHJcblx0XHRcdGlmICggdHlwZW9mIEMuaGFzX2V4cG9ydGVyID09PSAnZnVuY3Rpb24nICYmIEMuaGFzX2V4cG9ydGVyKCAncmFkaW8nICkgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0Qy5yZWdpc3RlciggJ3JhZGlvJywgZnVuY3Rpb24gKGZpZWxkLCBlbWl0LCBleHRyYXMpIHtcclxuXHJcblx0XHRcdFx0ZXh0cmFzID0gZXh0cmFzIHx8IHt9O1xyXG5cdFx0XHRcdHZhciBjZmcgPSBleHRyYXMuY2ZnIHx8IHt9O1xyXG5cclxuXHRcdFx0XHR2YXIgRXhwID0gdy5XUEJDX0JGQl9FeHBvcnRlcjtcclxuXHRcdFx0XHRpZiAoICEgRXhwIHx8IHR5cGVvZiBFeHAuY29tcHV0ZV9uYW1lICE9PSAnZnVuY3Rpb24nICkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0Ly8gS2VlcCB0aGUgZXhhY3QgZXhwb3J0ZWQgbmFtZSBpbiBzeW5jIHdpdGggdGhlIEJvb2tpbmcgRm9ybSBleHBvcnRlci5cclxuXHRcdFx0XHR2YXIgbmFtZSA9IEV4cC5jb21wdXRlX25hbWUoICdyYWRpbycsIGZpZWxkICk7XHJcblx0XHRcdFx0aWYgKCAhIG5hbWUgKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHR2YXIgcmF3X2xhYmVsID0gKCB0eXBlb2YgZmllbGQubGFiZWwgPT09ICdzdHJpbmcnICkgPyBmaWVsZC5sYWJlbCA6ICcnO1xyXG5cdFx0XHRcdHZhciBsYWJlbCAgICAgPSByYXdfbGFiZWwudHJpbSgpIHx8IG5hbWU7XHJcblxyXG5cdFx0XHRcdC8vIFNoYXJlZCBmb3JtYXR0ZXIga2VlcHMgYWxsIHBhY2tzIGNvbnNpc3RlbnQuXHJcblx0XHRcdFx0Qy5lbWl0X2xpbmVfYm9sZF9maWVsZCggZW1pdCwgbGFiZWwsIG5hbWUsIGNmZyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHJlZ2lzdGVyX3JhZGlvX2Jvb2tpbmdfZGF0YV9leHBvcnRlcigpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9yYWRpb19ib29raW5nX2RhdGFfZXhwb3J0ZXIsIHsgb25jZTogdHJ1ZSB9ICk7XHJcblx0XHR9XHJcblxyXG59KSggd2luZG93ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRTtFQUNiLFlBQVk7O0VBRVosSUFBSUMsSUFBSSxHQUFVRCxDQUFDLENBQUNFLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDdkMsSUFBSUMsUUFBUSxHQUFNRixJQUFJLENBQUNHLGdDQUFnQztFQUN2RCxJQUFJQyxXQUFXLEdBQUdKLElBQUksQ0FBQ0ssb0JBQW9CO0VBRTNDLElBQUssQ0FBRUgsUUFBUSxFQUFFSSxRQUFRLElBQUksQ0FBRUYsV0FBVyxFQUFHO0lBQzVDTCxDQUFDLENBQUNRLEtBQUssRUFBRUMsR0FBRyxFQUFFQyxLQUFLLEdBQUksc0JBQXNCLEVBQUUsaUNBQWtDLENBQUM7SUFDbEY7RUFDRDtFQUVBLE1BQU1D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

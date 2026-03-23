"use strict";

/* globals window, document */
(function (w, d) {
  'use strict';

  /**
   * BFB Form Settings UI bridge.
   *
   * Listens to:
   * - wpbc:bfb:form_settings:apply   (from AJAX load)  -> apply to controls
   * - wpbc:bfb:form_settings:collect (from AJAX save)  -> collect from controls
   *
   * Optional:
   * - re-apply after Builder STRUCTURE_LOADED (timing hook only)
   */
  const api = w.WPBC_BFB_FormSettings = w.WPBC_BFB_FormSettings || {};

  // Last received settings pack (from AJAX).
  let last_settings_pack = null;

  // Small retry, because DOM can be re-rendered after apply event.
  let raf_id = 0;
  let retry_count = 0;
  const retry_max = 20;

  // -----------------------------------------------------------------------------------------------
  // Small helpers
  // -----------------------------------------------------------------------------------------------

  function query_all(root, selector) {
    return Array.from((root || d).querySelectorAll(selector));
  }
  function css_escape(value) {
    const v = String(value == null ? '' : value);
    if (w.CSS && typeof w.CSS.escape === 'function') return w.CSS.escape(v);
    return v.replace(/[^a-zA-Z0-9_\-]/g, '\\$&');
  }
  function is_on(value) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    return v === 'on' || v === '1' || v === 'true' || v === 'yes';
  }
  function set_initial_attr(el, value) {
    if (!el) return;
    el.setAttribute('data-wpbc-bfb-fs-initial', String(value == null ? '' : value));
  }
  function trigger_change(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new Event('change', {
        bubbles: true
      }));
    } catch (_) {}
  }
  function trigger_input(el) {
    if (!el) return;
    try {
      el.dispatchEvent(new Event('input', {
        bubbles: true
      }));
    } catch (_) {}
  }
  function find_rows(scope) {
    const rows = query_all(d, '.wpbc-setting[data-key]');
    if (!scope) return rows;
    return rows.filter(function (row) {
      return String(row.getAttribute('data-scope') || '') === String(scope);
    });
  }
  function has_any_rows() {
    return query_all(d, '.wpbc-setting[data-key]').length > 0;
  }

  // -----------------------------------------------------------------------------------------------
  // Row setter
  // -----------------------------------------------------------------------------------------------

  function set_value_for_row(row, value, opts) {
    if (!row) return;
    const row_type = String(row.getAttribute('data-type') || '');
    const row_key = String(row.getAttribute('data-key') || '');
    const do_trigger_events = !!(opts && opts.trigger_change);
    if (!row_key) return;

    // Radio group
    if (row_type === 'radio') {
      const wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]');
      const control_id = wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-controlid') || '') : '';
      if (!control_id) return;
      const target_value = String(value == null ? '' : value);
      const radios = query_all(row, 'input[type="radio"][name="' + css_escape(control_id) + '"]');
      let checked_radio = null;
      radios.forEach(function (radio) {
        const should_check = String(radio.value) === target_value;
        radio.checked = should_check;
        if (should_check) checked_radio = radio;
      });
      if (wrap) set_initial_attr(wrap, target_value);
      if (do_trigger_events && checked_radio) trigger_change(checked_radio);
      return;
    }

    // Toggle
    if (row_type === 'toggle') {
      const checkbox = row.querySelector('input[type="checkbox"][data-wpbc-bfb-fs-type="toggle"]') || row.querySelector('input[type="checkbox"]');
      if (!checkbox) return;
      const checked = is_on(value);
      checkbox.checked = checked;
      checkbox.setAttribute('aria-checked', checked ? 'true' : 'false');
      set_initial_attr(checkbox, checked ? 'On' : 'Off');
      if (do_trigger_events) trigger_change(checkbox);
      return;
    }

    // Select
    if (row_type === 'select') {
      const select = row.querySelector('select[data-wpbc-bfb-fs-type="select"]') || row.querySelector('select');
      if (!select) return;
      select.value = String(value == null ? '' : value);
      set_initial_attr(select, select.value);
      if (do_trigger_events) trigger_change(select);
      return;
    }

    // Length: hidden combined + num/unit
    if (row_type === 'length') {
      // JS slider length control: - hidden writer carries FS markers and must receive input event so wpbc_slider_len_groups.js syncs UI.
      const writer = row.querySelector('input[data-wpbc_slider_len_writer][data-wpbc-bfb-fs-type="length"]') || row.querySelector('input[data-wpbc-bfb-fs-type="length"]');
      if (!writer) return;
      const combined = String(value == null ? '' : value);
      writer.value = combined;
      set_initial_attr(writer, combined);
      if (do_trigger_events) trigger_input(writer);
      return;
    }

    // Range (slider number): writer is the number input.
    if (row_type === 'range') {
      const writer = row.querySelector('input[data-wpbc_slider_range_writer]') || row.querySelector('input[data-wpbc-bfb-fs-key="' + css_escape(row_key) + '"]') || row.querySelector('input[type="number"]');
      if (!writer) return;
      writer.value = String(value == null ? '' : value);
      set_initial_attr(writer, writer.value);
      if (do_trigger_events) trigger_input(writer);
      return;
    }

    // Default: input/textarea
    const control = row.querySelector('[data-wpbc-bfb-fs-key="' + css_escape(row_key) + '"]') || row.querySelector('input,textarea');
    if (!control) return;
    control.value = String(value == null ? '' : value);
    set_initial_attr(control, control.value);
    // For normal inputs, "input" gives better reactivity than "change".
    if (do_trigger_events) trigger_input(control);
  }

  // -----------------------------------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------------------------------

  /**
   * Apply FLAT object (key=>value) to rows of some scope.
   */
  function apply_flat_settings(flat_settings, scope, opts) {
    if (!flat_settings || typeof flat_settings !== 'object') return;
    find_rows(scope).forEach(function (row) {
      const key = String(row.getAttribute('data-key') || '');
      if (!key) return;
      if (!Object.prototype.hasOwnProperty.call(flat_settings, key)) return;
      set_value_for_row(row, flat_settings[key], opts);
    });
  }

  /**
   * Apply settings.
   *
   * Supports:
   * - flat: { booking_form_layout_width: '100%', ... }
   * - pack: { options: {...}, css_vars: {...} }   (Option A)
   */
  api.apply = function (settings_pack, scope, opts) {
    if (!settings_pack || typeof settings_pack !== 'object') return;
    if (!settings_pack.options || typeof settings_pack.options !== 'object') return; // strict Option A
    apply_flat_settings(settings_pack.options, scope || 'form', opts);
  };

  /**
   * Collect current values (flat object).
   */
  api.collect = function (scope) {
    const out = {};
    find_rows(scope || 'form').forEach(function (row) {
      const key = String(row.getAttribute('data-key') || '');
      const type = String(row.getAttribute('data-type') || '');
      if (!key) return;
      if (type === 'radio') {
        const wrap = row.querySelector('.wpbc_bfb__form_setting_radio[data-wpbc-bfb-fs-controlid]');
        const control_id = wrap ? String(wrap.getAttribute('data-wpbc-bfb-fs-controlid') || '') : '';
        if (!control_id) return;
        const checked = row.querySelector('input[type="radio"][name="' + css_escape(control_id) + '"]:checked');
        out[key] = checked ? String(checked.value) : '';
        return;
      }
      if (type === 'toggle') {
        const checkbox = row.querySelector('input[type="checkbox"][data-wpbc-bfb-fs-type="toggle"]') || row.querySelector('input[type="checkbox"]');
        out[key] = checkbox && checkbox.checked ? 'On' : 'Off';
        return;
      }
      if (type === 'select') {
        const select = row.querySelector('select');
        out[key] = select ? String(select.value) : '';
        return;
      }
      if (type === 'length') {
        const hidden = row.querySelector('input[data-wpbc-bfb-fs-type="length"]');
        out[key] = hidden ? String(hidden.value || '') : '';
        return;
      }
      if (type === 'range') {
        const writer = row.querySelector('input[data-wpbc_slider_range_writer]') || row.querySelector('input[type="number"]') || row.querySelector('input[type="range"]');
        out[key] = writer ? String(writer.value || '') : '';
        return;
      }
      const control = row.querySelector('input,textarea');
      out[key] = control ? String(control.value || '') : '';
    });
    return out;
  };

  /**
   * Re-apply last received settings (useful after DOM re-render).
   */
  api.reapply_last = function () {
    if (!last_settings_pack) return;
    api.apply(last_settings_pack, 'form', {
      trigger_change: true
    });
  };
  api.init = function () {
    // If apply event fired before init, try again now.
    if (last_settings_pack) schedule_apply_retry();
  };

  // -----------------------------------------------------------------------------------------------
  // DOM Events (AJAX layer)
  // -----------------------------------------------------------------------------------------------

  // Save: let modules contribute into { options:{}, css_vars:{} }
  d.addEventListener('wpbc:bfb:form_settings:collect', function (e) {
    const detail = e && e.detail ? e.detail : {};
    const target_pack = detail.settings;
    if (!target_pack || typeof target_pack !== 'object') return;

    // Option A: write into target_pack.options
    if (!target_pack.options || typeof target_pack.options !== 'object') {
      target_pack.options = {};
    }
    const collected = api.collect('form');
    Object.keys(collected).forEach(function (k) {
      target_pack.options[k] = collected[k];
    });
  });

  // Load: receive settings from AJAX and apply.
  d.addEventListener('wpbc:bfb:form_settings:apply', function (e) {
    const detail = e && e.detail ? e.detail : {};
    last_settings_pack = detail.settings || null;
    retry_count = 0;
    schedule_apply_retry();
  });
  function schedule_apply_retry() {
    if (raf_id) return;
    raf_id = w.requestAnimationFrame(function () {
      raf_id = 0;

      // If settings UI not present yet, retry a few frames.
      if (!has_any_rows()) {
        retry_count++;
        if (retry_count < retry_max) schedule_apply_retry();
        return;
      }
      api.reapply_last();
    });
  }

  // -----------------------------------------------------------------------------------------------
  // Optional Builder timing hook (STRUCTURE_LOADED) -> reapply_last()
  // -----------------------------------------------------------------------------------------------

  function bind_builder_timing_hook(builder_instance) {
    const core = w.WPBC_BFB_Core;
    const events = core && core.WPBC_BFB_Events ? core.WPBC_BFB_Events : w.WPBC_BFB_Events || null;
    if (!builder_instance || !builder_instance.bus || !events || !events.STRUCTURE_LOADED) return;
    builder_instance.bus.on(events.STRUCTURE_LOADED, function () {
      // Builder may re-render settings panel after structure load.
      // Re-apply last settings pack (if any).
      retry_count = 0;
      schedule_apply_retry();
    });
  }
  if (w.wpbc_bfb_api && w.wpbc_bfb_api.ready && typeof w.wpbc_bfb_api.ready.then === 'function') {
    w.wpbc_bfb_api.ready.then(bind_builder_timing_hook);
  } else {
    setTimeout(function () {
      if (w.__B) {
        bind_builder_timing_hook(w.__B);
      }
    }, 0);
  }

  // DOM ready init.
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', api.init);else api.init();
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZm9ybS1zZXR0aW5ncy9fb3V0L3NldHRpbmdzLmpzIiwibmFtZXMiOlsidyIsImQiLCJhcGkiLCJXUEJDX0JGQl9Gb3JtU2V0dGluZ3MiLCJsYXN0X3NldHRpbmdzX3BhY2siLCJyYWZfaWQiLCJyZXRyeV9jb3VudCIsInJldHJ5X21heCIsInF1ZXJ5X2FsbCIsInJvb3QiLCJzZWxlY3RvciIsIkFycmF5IiwiZnJvbSIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJjc3NfZXNjYXBlIiwidmFsdWUiLCJ2IiwiU3RyaW5nIiwiQ1NTIiwiZXNjYXBlIiwicmVwbGFjZSIsImlzX29uIiwidHJpbSIsInRvTG93ZXJDYXNlIiwic2V0X2luaXRpYWxfYXR0ciIsImVsIiwic2V0QXR0cmlidXRlIiwidHJpZ2dlcl9jaGFuZ2UiLCJkaXNwYXRjaEV2ZW50IiwiRXZlbnQiLCJidWJibGVzIiwiXyIsInRyaWdnZXJfaW5wdXQiLCJmaW5kX3Jvd3MiLCJzY29wZSIsInJvd3MiLCJmaWx0ZXIiLCJyb3ciLCJnZXRBdHRyaWJ1dGUiLCJoYXNfYW55X3Jvd3MiLCJsZW5ndGgiLCJzZXRfdmFsdWVfZm9yX3JvdyIsIm9wdHMiLCJyb3dfdHlwZSIsInJvd19rZXkiLCJkb190cmlnZ2VyX2V2ZW50cyIsIndyYXAiLCJxdWVyeVNlbGVjdG9yIiwiY29udHJvbF9pZCIsInRhcmdldF92YWx1ZSIsInJhZGlvcyIsImNoZWNrZWRfcmFkaW8iLCJmb3JFYWNoIiwicmFkaW8iLCJzaG91bGRfY2hlY2siLCJjaGVja2VkIiwiY2hlY2tib3giLCJzZWxlY3QiLCJ3cml0ZXIiLCJjb21iaW5lZCIsImNvbnRyb2wiLCJhcHBseV9mbGF0X3NldHRpbmdzIiwiZmxhdF9zZXR0aW5ncyIsImtleSIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsImFwcGx5Iiwic2V0dGluZ3NfcGFjayIsIm9wdGlvbnMiLCJjb2xsZWN0Iiwib3V0IiwidHlwZSIsImhpZGRlbiIsInJlYXBwbHlfbGFzdCIsImluaXQiLCJzY2hlZHVsZV9hcHBseV9yZXRyeSIsImFkZEV2ZW50TGlzdGVuZXIiLCJlIiwiZGV0YWlsIiwidGFyZ2V0X3BhY2siLCJzZXR0aW5ncyIsImNvbGxlY3RlZCIsImtleXMiLCJrIiwicmVxdWVzdEFuaW1hdGlvbkZyYW1lIiwiYmluZF9idWlsZGVyX3RpbWluZ19ob29rIiwiYnVpbGRlcl9pbnN0YW5jZSIsImNvcmUiLCJXUEJDX0JGQl9Db3JlIiwiZXZlbnRzIiwiV1BCQ19CRkJfRXZlbnRzIiwiYnVzIiwiU1RSVUNUVVJFX0xPQURFRCIsIm9uIiwid3BiY19iZmJfYXBpIiwicmVhZHkiLCJ0aGVuIiwic2V0VGltZW91dCIsIl9fQiIsInJlYWR5U3RhdGUiLCJ3aW5kb3ciLCJkb2N1bWVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2Zvcm0tc2V0dGluZ3MvX3NyYy9zZXR0aW5ncy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiBnbG9iYWxzIHdpbmRvdywgZG9jdW1lbnQgKi9cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKipcclxuXHQgKiBCRkIgRm9ybSBTZXR0aW5ncyBVSSBicmlkZ2UuXHJcblx0ICpcclxuXHQgKiBMaXN0ZW5zIHRvOlxyXG5cdCAqIC0gd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczphcHBseSAgIChmcm9tIEFKQVggbG9hZCkgIC0+IGFwcGx5IHRvIGNvbnRyb2xzXHJcblx0ICogLSB3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNvbGxlY3QgKGZyb20gQUpBWCBzYXZlKSAgLT4gY29sbGVjdCBmcm9tIGNvbnRyb2xzXHJcblx0ICpcclxuXHQgKiBPcHRpb25hbDpcclxuXHQgKiAtIHJlLWFwcGx5IGFmdGVyIEJ1aWxkZXIgU1RSVUNUVVJFX0xPQURFRCAodGltaW5nIGhvb2sgb25seSlcclxuXHQgKi9cclxuXHRjb25zdCBhcGkgPSAody5XUEJDX0JGQl9Gb3JtU2V0dGluZ3MgPSB3LldQQkNfQkZCX0Zvcm1TZXR0aW5ncyB8fCB7fSk7XHJcblxyXG5cdC8vIExhc3QgcmVjZWl2ZWQgc2V0dGluZ3MgcGFjayAoZnJvbSBBSkFYKS5cclxuXHRsZXQgbGFzdF9zZXR0aW5nc19wYWNrID0gbnVsbDtcclxuXHJcblx0Ly8gU21hbGwgcmV0cnksIGJlY2F1c2UgRE9NIGNhbiBiZSByZS1yZW5kZXJlZCBhZnRlciBhcHBseSBldmVudC5cclxuXHRsZXQgcmFmX2lkICAgICAgPSAwO1xyXG5cdGxldCByZXRyeV9jb3VudCA9IDA7XHJcblx0Y29uc3QgcmV0cnlfbWF4ID0gMjA7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU21hbGwgaGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdGZ1bmN0aW9uIHF1ZXJ5X2FsbChyb290LCBzZWxlY3Rvcikge1xyXG5cdFx0cmV0dXJuIEFycmF5LmZyb20oKHJvb3QgfHwgZCkucXVlcnlTZWxlY3RvckFsbChzZWxlY3RvcikpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY3NzX2VzY2FwZSh2YWx1ZSkge1xyXG5cdFx0Y29uc3QgdiA9IFN0cmluZyh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XHJcblx0XHRpZiAody5DU1MgJiYgdHlwZW9mIHcuQ1NTLmVzY2FwZSA9PT0gJ2Z1bmN0aW9uJykgcmV0dXJuIHcuQ1NTLmVzY2FwZSh2KTtcclxuXHRcdHJldHVybiB2LnJlcGxhY2UoL1teYS16QS1aMC05X1xcLV0vZywgJ1xcXFwkJicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfb24odmFsdWUpIHtcclxuXHRcdGNvbnN0IHYgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0cmV0dXJuICh2ID09PSAnb24nIHx8IHYgPT09ICcxJyB8fCB2ID09PSAndHJ1ZScgfHwgdiA9PT0gJ3llcycpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X2luaXRpYWxfYXR0cihlbCwgdmFsdWUpIHtcclxuXHRcdGlmICghZWwpIHJldHVybjtcclxuXHRcdGVsLnNldEF0dHJpYnV0ZSgnZGF0YS13cGJjLWJmYi1mcy1pbml0aWFsJywgU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKSk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0cmlnZ2VyX2NoYW5nZShlbCkge1xyXG5cdFx0aWYgKCFlbCkgcmV0dXJuO1xyXG5cdFx0dHJ5IHsgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7IH0gY2F0Y2ggKF8pIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB0cmlnZ2VyX2lucHV0KGVsKSB7XHJcblx0XHRpZiAoICFlbCApIHJldHVybjtcclxuXHRcdHRyeSB7IGVsLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0gKSApOyB9IGNhdGNoICggXyApIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmaW5kX3Jvd3Moc2NvcGUpIHtcclxuXHRcdGNvbnN0IHJvd3MgPSBxdWVyeV9hbGwoZCwgJy53cGJjLXNldHRpbmdbZGF0YS1rZXldJyk7XHJcblx0XHRpZiAoIXNjb3BlKSByZXR1cm4gcm93cztcclxuXHJcblx0XHRyZXR1cm4gcm93cy5maWx0ZXIoZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEtc2NvcGUnKSB8fCAnJykgPT09IFN0cmluZyhzY29wZSk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhhc19hbnlfcm93cygpIHtcclxuXHRcdHJldHVybiBxdWVyeV9hbGwoZCwgJy53cGJjLXNldHRpbmdbZGF0YS1rZXldJykubGVuZ3RoID4gMDtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gUm93IHNldHRlclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdGZ1bmN0aW9uIHNldF92YWx1ZV9mb3Jfcm93KHJvdywgdmFsdWUsIG9wdHMpIHtcclxuXHRcdGlmICghcm93KSByZXR1cm47XHJcblxyXG5cdFx0Y29uc3Qgcm93X3R5cGUgPSBTdHJpbmcocm93LmdldEF0dHJpYnV0ZSgnZGF0YS10eXBlJykgfHwgJycpO1xyXG5cdFx0Y29uc3Qgcm93X2tleSAgPSBTdHJpbmcocm93LmdldEF0dHJpYnV0ZSgnZGF0YS1rZXknKSB8fCAnJyk7XHJcblx0XHRjb25zdCBkb190cmlnZ2VyX2V2ZW50cyA9ICEhKG9wdHMgJiYgb3B0cy50cmlnZ2VyX2NoYW5nZSk7XHJcblxyXG5cdFx0aWYgKCFyb3dfa2V5KSByZXR1cm47XHJcblxyXG5cdFx0Ly8gUmFkaW8gZ3JvdXBcclxuXHRcdGlmIChyb3dfdHlwZSA9PT0gJ3JhZGlvJykge1xyXG5cdFx0XHRjb25zdCB3cmFwID0gcm93LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9fZm9ybV9zZXR0aW5nX3JhZGlvW2RhdGEtd3BiYy1iZmItZnMtY29udHJvbGlkXScpO1xyXG5cdFx0XHRjb25zdCBjb250cm9sX2lkID0gd3JhcCA/IFN0cmluZyh3cmFwLmdldEF0dHJpYnV0ZSgnZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWQnKSB8fCAnJykgOiAnJztcclxuXHRcdFx0aWYgKCFjb250cm9sX2lkKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCB0YXJnZXRfdmFsdWUgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpO1xyXG5cdFx0XHRjb25zdCByYWRpb3MgPSBxdWVyeV9hbGwocm93LCAnaW5wdXRbdHlwZT1cInJhZGlvXCJdW25hbWU9XCInICsgY3NzX2VzY2FwZShjb250cm9sX2lkKSArICdcIl0nKTtcclxuXHJcblx0XHRcdGxldCBjaGVja2VkX3JhZGlvID0gbnVsbDtcclxuXHRcdFx0cmFkaW9zLmZvckVhY2goZnVuY3Rpb24gKHJhZGlvKSB7XHJcblx0XHRcdFx0Y29uc3Qgc2hvdWxkX2NoZWNrID0gKFN0cmluZyhyYWRpby52YWx1ZSkgPT09IHRhcmdldF92YWx1ZSk7XHJcblx0XHRcdFx0cmFkaW8uY2hlY2tlZCA9IHNob3VsZF9jaGVjaztcclxuXHRcdFx0XHRpZiAoc2hvdWxkX2NoZWNrKSBjaGVja2VkX3JhZGlvID0gcmFkaW87XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0aWYgKHdyYXApIHNldF9pbml0aWFsX2F0dHIod3JhcCwgdGFyZ2V0X3ZhbHVlKTtcclxuXHRcdFx0aWYgKGRvX3RyaWdnZXJfZXZlbnRzICYmIGNoZWNrZWRfcmFkaW8pIHRyaWdnZXJfY2hhbmdlKGNoZWNrZWRfcmFkaW8pO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVG9nZ2xlXHJcblx0XHRpZiAocm93X3R5cGUgPT09ICd0b2dnbGUnKSB7XHJcblx0XHRcdGNvbnN0IGNoZWNrYm94ID1cclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdW2RhdGEtd3BiYy1iZmItZnMtdHlwZT1cInRvZ2dsZVwiXScpIHx8XHJcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ2lucHV0W3R5cGU9XCJjaGVja2JveFwiXScpO1xyXG5cclxuXHRcdFx0aWYgKCFjaGVja2JveCkgcmV0dXJuO1xyXG5cclxuXHRcdFx0Y29uc3QgY2hlY2tlZCA9IGlzX29uKHZhbHVlKTtcclxuXHRcdFx0Y2hlY2tib3guY2hlY2tlZCA9IGNoZWNrZWQ7XHJcblx0XHRcdGNoZWNrYm94LnNldEF0dHJpYnV0ZSgnYXJpYS1jaGVja2VkJywgY2hlY2tlZCA/ICd0cnVlJyA6ICdmYWxzZScpO1xyXG5cclxuXHRcdFx0c2V0X2luaXRpYWxfYXR0cihjaGVja2JveCwgY2hlY2tlZCA/ICdPbicgOiAnT2ZmJyk7XHJcblx0XHRcdGlmIChkb190cmlnZ2VyX2V2ZW50cykgdHJpZ2dlcl9jaGFuZ2UoY2hlY2tib3gpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU2VsZWN0XHJcblx0XHRpZiAocm93X3R5cGUgPT09ICdzZWxlY3QnKSB7XHJcblx0XHRcdGNvbnN0IHNlbGVjdCA9XHJcblx0XHRcdFx0cm93LnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJzZWxlY3RcIl0nKSB8fFxyXG5cdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdzZWxlY3QnKTtcclxuXHJcblx0XHRcdGlmICghc2VsZWN0KSByZXR1cm47XHJcblxyXG5cdFx0XHRzZWxlY3QudmFsdWUgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpO1xyXG5cdFx0XHRzZXRfaW5pdGlhbF9hdHRyKHNlbGVjdCwgc2VsZWN0LnZhbHVlKTtcclxuXHRcdFx0aWYgKGRvX3RyaWdnZXJfZXZlbnRzKSB0cmlnZ2VyX2NoYW5nZShzZWxlY3QpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTGVuZ3RoOiBoaWRkZW4gY29tYmluZWQgKyBudW0vdW5pdFxyXG5cdFx0aWYgKCByb3dfdHlwZSA9PT0gJ2xlbmd0aCcgKSB7XHJcblx0XHRcdC8vIEpTIHNsaWRlciBsZW5ndGggY29udHJvbDogLSBoaWRkZW4gd3JpdGVyIGNhcnJpZXMgRlMgbWFya2VycyBhbmQgbXVzdCByZWNlaXZlIGlucHV0IGV2ZW50IHNvIHdwYmNfc2xpZGVyX2xlbl9ncm91cHMuanMgc3luY3MgVUkuXHJcblx0XHRcdGNvbnN0IHdyaXRlciA9XHJcblx0XHRcdFx0XHQgIHJvdy5xdWVyeVNlbGVjdG9yKCAnaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9sZW5fd3JpdGVyXVtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJsZW5ndGhcIl0nICkgfHxcclxuXHRcdFx0XHRcdCAgcm93LnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJsZW5ndGhcIl0nICk7XHJcblx0XHRcdGlmICggIXdyaXRlciApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGNvbWJpbmVkID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApO1xyXG5cdFx0XHR3cml0ZXIudmFsdWUgICA9IGNvbWJpbmVkO1xyXG5cdFx0XHRzZXRfaW5pdGlhbF9hdHRyKCB3cml0ZXIsIGNvbWJpbmVkICk7XHJcblx0XHRcdGlmICggZG9fdHJpZ2dlcl9ldmVudHMgKSB0cmlnZ2VyX2lucHV0KCB3cml0ZXIgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFJhbmdlIChzbGlkZXIgbnVtYmVyKTogd3JpdGVyIGlzIHRoZSBudW1iZXIgaW5wdXQuXHJcblx0XHRpZiAocm93X3R5cGUgPT09ICdyYW5nZScpIHtcclxuXHRcdFx0Y29uc3Qgd3JpdGVyID1cclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9yYW5nZV93cml0ZXJdJykgfHxcclxuXHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjLWJmYi1mcy1rZXk9XCInICsgY3NzX2VzY2FwZShyb3dfa2V5KSArICdcIl0nKSB8fFxyXG5cdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwibnVtYmVyXCJdJyk7XHJcblx0XHRcdGlmICghd3JpdGVyKSByZXR1cm47XHJcblxyXG5cdFx0XHR3cml0ZXIudmFsdWUgPSBTdHJpbmcodmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUpO1xyXG5cdFx0XHRzZXRfaW5pdGlhbF9hdHRyKHdyaXRlciwgd3JpdGVyLnZhbHVlKTtcclxuXHRcdFx0aWYgKGRvX3RyaWdnZXJfZXZlbnRzKSB0cmlnZ2VyX2lucHV0KHdyaXRlcik7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBEZWZhdWx0OiBpbnB1dC90ZXh0YXJlYVxyXG5cdFx0Y29uc3QgY29udHJvbCA9XHJcblx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdbZGF0YS13cGJjLWJmYi1mcy1rZXk9XCInICsgY3NzX2VzY2FwZShyb3dfa2V5KSArICdcIl0nKSB8fFxyXG5cdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXQsdGV4dGFyZWEnKTtcclxuXHJcblx0XHRpZiAoIWNvbnRyb2wpIHJldHVybjtcclxuXHJcblx0XHRjb250cm9sLnZhbHVlID0gU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKTtcclxuXHRcdHNldF9pbml0aWFsX2F0dHIoY29udHJvbCwgY29udHJvbC52YWx1ZSk7XHJcblx0XHQvLyBGb3Igbm9ybWFsIGlucHV0cywgXCJpbnB1dFwiIGdpdmVzIGJldHRlciByZWFjdGl2aXR5IHRoYW4gXCJjaGFuZ2VcIi5cclxuXHRcdGlmIChkb190cmlnZ2VyX2V2ZW50cykgdHJpZ2dlcl9pbnB1dChjb250cm9sKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gUHVibGljIEFQSVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IEZMQVQgb2JqZWN0IChrZXk9PnZhbHVlKSB0byByb3dzIG9mIHNvbWUgc2NvcGUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gYXBwbHlfZmxhdF9zZXR0aW5ncyhmbGF0X3NldHRpbmdzLCBzY29wZSwgb3B0cykge1xyXG5cdFx0aWYgKCFmbGF0X3NldHRpbmdzIHx8IHR5cGVvZiBmbGF0X3NldHRpbmdzICE9PSAnb2JqZWN0JykgcmV0dXJuO1xyXG5cclxuXHRcdGZpbmRfcm93cyhzY29wZSkuZm9yRWFjaChmdW5jdGlvbiAocm93KSB7XHJcblx0XHRcdGNvbnN0IGtleSA9IFN0cmluZyhyb3cuZ2V0QXR0cmlidXRlKCdkYXRhLWtleScpIHx8ICcnKTtcclxuXHRcdFx0aWYgKCFrZXkpIHJldHVybjtcclxuXHRcdFx0aWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZmxhdF9zZXR0aW5ncywga2V5KSkgcmV0dXJuO1xyXG5cdFx0XHRzZXRfdmFsdWVfZm9yX3Jvdyhyb3csIGZsYXRfc2V0dGluZ3Nba2V5XSwgb3B0cyk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IHNldHRpbmdzLlxyXG5cdCAqXHJcblx0ICogU3VwcG9ydHM6XHJcblx0ICogLSBmbGF0OiB7IGJvb2tpbmdfZm9ybV9sYXlvdXRfd2lkdGg6ICcxMDAlJywgLi4uIH1cclxuXHQgKiAtIHBhY2s6IHsgb3B0aW9uczogey4uLn0sIGNzc192YXJzOiB7Li4ufSB9ICAgKE9wdGlvbiBBKVxyXG5cdCAqL1xyXG5cdGFwaS5hcHBseSA9IGZ1bmN0aW9uIChzZXR0aW5nc19wYWNrLCBzY29wZSwgb3B0cykge1xyXG5cdFx0aWYgKCFzZXR0aW5nc19wYWNrIHx8IHR5cGVvZiBzZXR0aW5nc19wYWNrICE9PSAnb2JqZWN0JykgcmV0dXJuO1xyXG5cdFx0aWYgKCFzZXR0aW5nc19wYWNrLm9wdGlvbnMgfHwgdHlwZW9mIHNldHRpbmdzX3BhY2sub3B0aW9ucyAhPT0gJ29iamVjdCcpIHJldHVybjsgLy8gc3RyaWN0IE9wdGlvbiBBXHJcblx0XHRhcHBseV9mbGF0X3NldHRpbmdzKHNldHRpbmdzX3BhY2sub3B0aW9ucywgc2NvcGUgfHwgJ2Zvcm0nLCBvcHRzKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDb2xsZWN0IGN1cnJlbnQgdmFsdWVzIChmbGF0IG9iamVjdCkuXHJcblx0ICovXHJcblx0YXBpLmNvbGxlY3QgPSBmdW5jdGlvbiAoc2NvcGUpIHtcclxuXHRcdGNvbnN0IG91dCA9IHt9O1xyXG5cclxuXHRcdGZpbmRfcm93cyhzY29wZSB8fCAnZm9ybScpLmZvckVhY2goZnVuY3Rpb24gKHJvdykge1xyXG5cdFx0XHRjb25zdCBrZXkgID0gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEta2V5JykgfHwgJycpO1xyXG5cdFx0XHRjb25zdCB0eXBlID0gU3RyaW5nKHJvdy5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHlwZScpIHx8ICcnKTtcclxuXHRcdFx0aWYgKCFrZXkpIHJldHVybjtcclxuXHJcblx0XHRcdGlmICh0eXBlID09PSAncmFkaW8nKSB7XHJcblx0XHRcdFx0Y29uc3Qgd3JhcCA9IHJvdy5xdWVyeVNlbGVjdG9yKCcud3BiY19iZmJfX2Zvcm1fc2V0dGluZ19yYWRpb1tkYXRhLXdwYmMtYmZiLWZzLWNvbnRyb2xpZF0nKTtcclxuXHRcdFx0XHRjb25zdCBjb250cm9sX2lkID0gd3JhcCA/IFN0cmluZyh3cmFwLmdldEF0dHJpYnV0ZSgnZGF0YS13cGJjLWJmYi1mcy1jb250cm9saWQnKSB8fCAnJykgOiAnJztcclxuXHRcdFx0XHRpZiAoIWNvbnRyb2xfaWQpIHJldHVybjtcclxuXHJcblx0XHRcdFx0Y29uc3QgY2hlY2tlZCA9IHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwicmFkaW9cIl1bbmFtZT1cIicgKyBjc3NfZXNjYXBlKGNvbnRyb2xfaWQpICsgJ1wiXTpjaGVja2VkJyk7XHJcblx0XHRcdFx0b3V0W2tleV0gPSBjaGVja2VkID8gU3RyaW5nKGNoZWNrZWQudmFsdWUpIDogJyc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ3RvZ2dsZScpIHtcclxuXHRcdFx0XHRjb25zdCBjaGVja2JveCA9XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdW2RhdGEtd3BiYy1iZmItZnMtdHlwZT1cInRvZ2dsZVwiXScpIHx8XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbdHlwZT1cImNoZWNrYm94XCJdJyk7XHJcblx0XHRcdFx0b3V0W2tleV0gPSBjaGVja2JveCAmJiBjaGVja2JveC5jaGVja2VkID8gJ09uJyA6ICdPZmYnO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKHR5cGUgPT09ICdzZWxlY3QnKSB7XHJcblx0XHRcdFx0Y29uc3Qgc2VsZWN0ID0gcm93LnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdCcpO1xyXG5cdFx0XHRcdG91dFtrZXldID0gc2VsZWN0ID8gU3RyaW5nKHNlbGVjdC52YWx1ZSkgOiAnJztcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICh0eXBlID09PSAnbGVuZ3RoJykge1xyXG5cdFx0XHRcdGNvbnN0IGhpZGRlbiA9IHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFtkYXRhLXdwYmMtYmZiLWZzLXR5cGU9XCJsZW5ndGhcIl0nKTtcclxuXHRcdFx0XHRvdXRba2V5XSA9IGhpZGRlbiA/IFN0cmluZyhoaWRkZW4udmFsdWUgfHwgJycpIDogJyc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAodHlwZSA9PT0gJ3JhbmdlJykge1xyXG5cdFx0XHRcdGNvbnN0IHdyaXRlciA9XHJcblx0XHRcdFx0XHRyb3cucXVlcnlTZWxlY3RvcignaW5wdXRbZGF0YS13cGJjX3NsaWRlcl9yYW5nZV93cml0ZXJdJykgfHxcclxuXHRcdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwibnVtYmVyXCJdJykgfHxcclxuXHRcdFx0XHRcdHJvdy5xdWVyeVNlbGVjdG9yKCdpbnB1dFt0eXBlPVwicmFuZ2VcIl0nKTtcclxuXHRcdFx0XHRvdXRba2V5XSA9IHdyaXRlciA/IFN0cmluZyh3cml0ZXIudmFsdWUgfHwgJycpIDogJyc7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGNvbnRyb2wgPSByb3cucXVlcnlTZWxlY3RvcignaW5wdXQsdGV4dGFyZWEnKTtcclxuXHRcdFx0b3V0W2tleV0gPSBjb250cm9sID8gU3RyaW5nKGNvbnRyb2wudmFsdWUgfHwgJycpIDogJyc7XHJcblx0XHR9KTtcclxuXHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlLWFwcGx5IGxhc3QgcmVjZWl2ZWQgc2V0dGluZ3MgKHVzZWZ1bCBhZnRlciBET00gcmUtcmVuZGVyKS5cclxuXHQgKi9cclxuXHRhcGkucmVhcHBseV9sYXN0ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0aWYgKCFsYXN0X3NldHRpbmdzX3BhY2spIHJldHVybjtcclxuXHRcdGFwaS5hcHBseShsYXN0X3NldHRpbmdzX3BhY2ssICdmb3JtJywgeyB0cmlnZ2VyX2NoYW5nZTogdHJ1ZSB9KTtcclxuXHR9O1xyXG5cclxuXHRhcGkuaW5pdCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdC8vIElmIGFwcGx5IGV2ZW50IGZpcmVkIGJlZm9yZSBpbml0LCB0cnkgYWdhaW4gbm93LlxyXG5cdFx0aWYgKGxhc3Rfc2V0dGluZ3NfcGFjaykgc2NoZWR1bGVfYXBwbHlfcmV0cnkoKTtcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERPTSBFdmVudHMgKEFKQVggbGF5ZXIpXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0Ly8gU2F2ZTogbGV0IG1vZHVsZXMgY29udHJpYnV0ZSBpbnRvIHsgb3B0aW9uczp7fSwgY3NzX3ZhcnM6e30gfVxyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczpjb2xsZWN0JywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdGNvbnN0IGRldGFpbCA9IChlICYmIGUuZGV0YWlsKSA/IGUuZGV0YWlsIDoge307XHJcblx0XHRjb25zdCB0YXJnZXRfcGFjayA9IGRldGFpbC5zZXR0aW5ncztcclxuXHJcblx0XHRpZiAoIXRhcmdldF9wYWNrIHx8IHR5cGVvZiB0YXJnZXRfcGFjayAhPT0gJ29iamVjdCcpIHJldHVybjtcclxuXHJcblx0XHQvLyBPcHRpb24gQTogd3JpdGUgaW50byB0YXJnZXRfcGFjay5vcHRpb25zXHJcblx0XHRpZiAoIXRhcmdldF9wYWNrLm9wdGlvbnMgfHwgdHlwZW9mIHRhcmdldF9wYWNrLm9wdGlvbnMgIT09ICdvYmplY3QnKSB7XHJcblx0XHRcdHRhcmdldF9wYWNrLm9wdGlvbnMgPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBjb2xsZWN0ZWQgPSBhcGkuY29sbGVjdCgnZm9ybScpO1xyXG5cdFx0T2JqZWN0LmtleXMoY29sbGVjdGVkKS5mb3JFYWNoKGZ1bmN0aW9uIChrKSB7XHJcblx0XHRcdHRhcmdldF9wYWNrLm9wdGlvbnNba10gPSBjb2xsZWN0ZWRba107XHJcblx0XHR9KTtcclxuXHR9KTtcclxuXHJcblx0Ly8gTG9hZDogcmVjZWl2ZSBzZXR0aW5ncyBmcm9tIEFKQVggYW5kIGFwcGx5LlxyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczphcHBseScsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRjb25zdCBkZXRhaWwgPSAoZSAmJiBlLmRldGFpbCkgPyBlLmRldGFpbCA6IHt9O1xyXG5cclxuXHRcdGxhc3Rfc2V0dGluZ3NfcGFjayA9IGRldGFpbC5zZXR0aW5ncyB8fCBudWxsO1xyXG5cclxuXHRcdHJldHJ5X2NvdW50ID0gMDtcclxuXHRcdHNjaGVkdWxlX2FwcGx5X3JldHJ5KCk7XHJcblx0fSk7XHJcblxyXG5cdGZ1bmN0aW9uIHNjaGVkdWxlX2FwcGx5X3JldHJ5KCkge1xyXG5cdFx0aWYgKHJhZl9pZCkgcmV0dXJuO1xyXG5cclxuXHRcdHJhZl9pZCA9IHcucmVxdWVzdEFuaW1hdGlvbkZyYW1lKGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0cmFmX2lkID0gMDtcclxuXHJcblx0XHRcdC8vIElmIHNldHRpbmdzIFVJIG5vdCBwcmVzZW50IHlldCwgcmV0cnkgYSBmZXcgZnJhbWVzLlxyXG5cdFx0XHRpZiAoIWhhc19hbnlfcm93cygpKSB7XHJcblx0XHRcdFx0cmV0cnlfY291bnQrKztcclxuXHRcdFx0XHRpZiAocmV0cnlfY291bnQgPCByZXRyeV9tYXgpIHNjaGVkdWxlX2FwcGx5X3JldHJ5KCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRhcGkucmVhcHBseV9sYXN0KCk7XHJcblx0XHR9KTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gT3B0aW9uYWwgQnVpbGRlciB0aW1pbmcgaG9vayAoU1RSVUNUVVJFX0xPQURFRCkgLT4gcmVhcHBseV9sYXN0KClcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRmdW5jdGlvbiBiaW5kX2J1aWxkZXJfdGltaW5nX2hvb2soYnVpbGRlcl9pbnN0YW5jZSkge1xyXG5cdFx0Y29uc3QgY29yZSA9IHcuV1BCQ19CRkJfQ29yZTtcclxuXHRcdGNvbnN0IGV2ZW50cyA9IChjb3JlICYmIGNvcmUuV1BCQ19CRkJfRXZlbnRzKSA/IGNvcmUuV1BCQ19CRkJfRXZlbnRzIDogKHcuV1BCQ19CRkJfRXZlbnRzIHx8IG51bGwpO1xyXG5cclxuXHJcblx0XHRpZiAoIWJ1aWxkZXJfaW5zdGFuY2UgfHwgIWJ1aWxkZXJfaW5zdGFuY2UuYnVzIHx8ICFldmVudHMgfHwgIWV2ZW50cy5TVFJVQ1RVUkVfTE9BREVEKSByZXR1cm47XHJcblxyXG5cdFx0YnVpbGRlcl9pbnN0YW5jZS5idXMub24oZXZlbnRzLlNUUlVDVFVSRV9MT0FERUQsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gQnVpbGRlciBtYXkgcmUtcmVuZGVyIHNldHRpbmdzIHBhbmVsIGFmdGVyIHN0cnVjdHVyZSBsb2FkLlxyXG5cdFx0XHQvLyBSZS1hcHBseSBsYXN0IHNldHRpbmdzIHBhY2sgKGlmIGFueSkuXHJcblx0XHRcdHJldHJ5X2NvdW50ID0gMDtcclxuXHRcdFx0c2NoZWR1bGVfYXBwbHlfcmV0cnkoKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0aWYgKHcud3BiY19iZmJfYXBpICYmIHcud3BiY19iZmJfYXBpLnJlYWR5ICYmIHR5cGVvZiB3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKGJpbmRfYnVpbGRlcl90aW1pbmdfaG9vayk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24gKCkgeyBpZiAody5fX0IpIHsgYmluZF9idWlsZGVyX3RpbWluZ19ob29rKCB3Ll9fQiApOyB9IH0sIDApO1xyXG5cdH1cclxuXHJcblx0Ly8gRE9NIHJlYWR5IGluaXQuXHJcblx0aWYgKGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnKSBkLmFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBhcGkuaW5pdCk7XHJcblx0ZWxzZSBhcGkuaW5pdCgpO1xyXG5cclxufSkod2luZG93LCBkb2N1bWVudCk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLE1BQU1DLEdBQUcsR0FBSUYsQ0FBQyxDQUFDRyxxQkFBcUIsR0FBR0gsQ0FBQyxDQUFDRyxxQkFBcUIsSUFBSSxDQUFDLENBQUU7O0VBRXJFO0VBQ0EsSUFBSUMsa0JBQWtCLEdBQUcsSUFBSTs7RUFFN0I7RUFDQSxJQUFJQyxNQUFNLEdBQVEsQ0FBQztFQUNuQixJQUFJQyxXQUFXLEdBQUcsQ0FBQztFQUNuQixNQUFNQyxTQUFTLEdBQUcsRUFBRTs7RUFFcEI7RUFDQTtFQUNBOztFQUVBLFNBQVNDLFNBQVNBLENBQUNDLElBQUksRUFBRUMsUUFBUSxFQUFFO0lBQ2xDLE9BQU9DLEtBQUssQ0FBQ0MsSUFBSSxDQUFDLENBQUNILElBQUksSUFBSVIsQ0FBQyxFQUFFWSxnQkFBZ0IsQ0FBQ0gsUUFBUSxDQUFDLENBQUM7RUFDMUQ7RUFFQSxTQUFTSSxVQUFVQSxDQUFDQyxLQUFLLEVBQUU7SUFDMUIsTUFBTUMsQ0FBQyxHQUFHQyxNQUFNLENBQUNGLEtBQUssSUFBSSxJQUFJLEdBQUcsRUFBRSxHQUFHQSxLQUFLLENBQUM7SUFDNUMsSUFBSWYsQ0FBQyxDQUFDa0IsR0FBRyxJQUFJLE9B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

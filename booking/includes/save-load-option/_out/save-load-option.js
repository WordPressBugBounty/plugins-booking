"use strict";

/**
 * General Option Loader/Saver (client)
 *
 * - Provides:
 *     window.wpbc_save_option_from_element(el)
 *     window.wpbc_load_option_from_element(el)
 * - Busy UI (spinner + disabled)
 * - JSON path: send raw JSON string untouched.
 * - RAW scalar path: send as-is.
 * - Fields path: serialize to query-string via jQuery.param.
 *
 * IMPORTANT:
 * - jQuery .data() is cached. If some code updates data-* attributes via setAttribute(),
 *   reading via $el.data(...) can return stale values.
 * - Therefore, this module prefers reading via $el.attr('data-...') for dynamic keys
 *   (value/value-json), and falls back to $el.data(...) when attribute is missing.
 *
 * file: ../includes/save-load-option/_out/save-load-option.js
 *
 * Events:
 *   $(document).on('wpbc:option:beforeSave', (e, $el, payload) => {})
 *   $(document).on('wpbc:option:afterSave',  (e, response) => {})
 *   $(document).on('wpbc:option:beforeLoad', (e, $el, name) => {})
 *   $(document).on('wpbc:option:afterLoad',  (e, response) => {})
 */
(function (w, $) {
  'use strict';

  /**
   * Escape for safe HTML injection (small helper).
   *
   * @param {string} s
   * @returns {string}
   */
  function wpbc_uix_escape_html(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /**
   * Read a value from data-* attribute first (fresh), then fallback to jQuery .data() cache.
   *
   * @param {jQuery} $el
   * @param {string} attr_name      Example: 'data-wpbc-u-save-value'
   * @param {string} data_key       Example: 'wpbc-u-save-value'
   * @returns {*}
   */
  function wpbc_uix_read_attr_or_data($el, attr_name, data_key) {
    var v = $el.attr(attr_name);
    if (typeof v !== 'undefined') {
      return v;
    }
    return $el.data(data_key);
  }

  /**
   * Turn "On"/"Off" like values into consistent "On"/"Off".
   * (Used for checkbox/toggle serialization.)
   *
   * @param {*} v
   * @returns {string}
   */
  function wpbc_uix_to_on_off(v) {
    if (v === true) {
      return 'On';
    }
    if (v === false) {
      return 'Off';
    }
    var s = String(v || '').toLowerCase();
    if (s === 'on' || s === '1' || s === 'true' || s === 'yes') {
      return 'On';
    }
    return 'Off';
  }

  /**
   * Get a useful value from an input/select/textarea element.
   * - checkbox => 'On'/'Off'
   * - radio    => value of checked in group (if possible), else ''
   * - others   => .val()
   *
   * @param {jQuery} $control
   * @returns {string}
   */
  function wpbc_uix_get_control_value($control) {
    if (!$control || !$control.length) {
      return '';
    }

    // checkbox/toggle.
    if ($control.is(':checkbox')) {
      return $control.is(':checked') ? 'On' : 'Off';
    }

    // radio group.
    if ($control.is(':radio')) {
      var name = $control.attr('name');
      if (name) {
        var $checked = $('input[type="radio"][name="' + name + '"]:checked');
        return $checked.length ? String($checked.val()) : '';
      }
      return $control.is(':checked') ? String($control.val()) : '';
    }

    // select/text/textarea/etc.
    return String($control.val() == null ? '' : $control.val());
  }

  /**
   * Busy ON UI for a clickable element.
   *
   * @param {jQuery} $el
   * @returns {void}
   */
  function wpbc_uix_busy_on($el) {
    if (!$el || !$el.length || $el.data('wpbc-uix-busy')) {
      return;
    }
    $el.data('wpbc-uix-busy', 1);
    $el.data('wpbc-uix-original-html', $el.html());
    var busy_text = $el.data('wpbc-u-busy-text');
    var spinner = '<span class="wpbc_icn_rotate_right wpbc_spin wpbc_ajax_icon wpbc_processing wpbc_icn_autorenew" aria-hidden="true"></span>';
    if (typeof busy_text === 'string' && busy_text.length) {
      $el.html(wpbc_uix_escape_html(busy_text) + ' ' + spinner);
    } else {
      $el.append(spinner);
    }
    $el.addClass('wpbc-is-busy').attr('aria-disabled', 'true').prop('disabled', true);
  }

  /**
   * Busy OFF UI for a clickable element.
   *
   * @param {jQuery} $el
   * @returns {void}
   */
  function wpbc_uix_busy_off($el) {
    if (!$el || !$el.length || !$el.data('wpbc-uix-busy')) {
      return;
    }
    var original = $el.data('wpbc-uix-original-html');
    if (typeof original === 'string') {
      $el.html(original);
    }
    $el.removeClass('wpbc-is-busy').removeAttr('aria-disabled').prop('disabled', false);
    $el.removeData('wpbc-uix-busy').removeData('wpbc-uix-original-html');
  }
  var wpbc_uix_autosave_registry = {};
  function wpbc_uix_get_option_save_config($el) {
    return {
      data_name: $el.data('wpbc-u-save-name'),
      fields_raw: $el.data('wpbc-u-save-fields') || '',
      inline_value: wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value', 'wpbc-u-save-value'),
      json: wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value-json', 'wpbc-u-save-value-json'),
      value_from_selector: $el.data('wpbc-u-save-value-from') || $el.attr('data-wpbc-u-save-value-from')
    };
  }
  function wpbc_uix_build_option_save_payload($el, cfg) {
    cfg = cfg || wpbc_uix_get_option_save_config($el);
    if (typeof cfg.json === 'string' && cfg.json.trim() !== '') {
      return cfg.json.trim();
    }
    if (cfg.value_from_selector) {
      var $src = $(cfg.value_from_selector);
      var $control = $src.is('input,select,textarea') ? $src : $src.find('input,select,textarea').first();
      return wpbc_uix_get_control_value($control);
    }
    if (typeof cfg.inline_value !== 'undefined' && cfg.inline_value !== null) {
      return String(cfg.inline_value);
    }
    if (cfg.fields_raw) {
      var fields = String(cfg.fields_raw).split(',').map(function (s) {
        return String(s || '').trim();
      }).filter(Boolean);
      var data = {};
      fields.forEach(function (sel) {
        var $f = $(sel);
        if (!$f.length) {
          return;
        }
        var $control = $f.is('input,select,textarea') ? $f : $f.find('input,select,textarea').first();
        if (!$control.length) {
          return;
        }
        var key = $control.attr('name') || $control.attr('id');
        if (!key) {
          return;
        }
        data[key] = wpbc_uix_get_control_value($control);
      });
      return $.param(data);
    }
    return null;
  }
  function wpbc_uix_update_autosave_registry_from_element(el, is_dirty) {
    var $el = $(el);
    var cfg = wpbc_uix_get_option_save_config($el);
    if (!cfg.data_name) {
      return;
    }
    wpbc_uix_autosave_registry[cfg.data_name] = {
      data_name: cfg.data_name,
      payload: wpbc_uix_build_option_save_payload($el, cfg),
      dirty: !!is_dirty,
      el: el
    };
  }
  function wpbc_uix_save_autosave_registry_entry(entry) {
    if (!entry || !entry.dirty || !entry.data_name || entry.payload === null || !w.wpbc_option_saver_loader_config || !w.wpbc_option_saver_loader_config.save_nonce) {
      return;
    }
    $(document).trigger('wpbc:option:beforeSave', [$(), entry.payload]);
    $.ajax({
      url: w.wpbc_option_saver_loader_config.ajax_url,
      type: 'POST',
      data: {
        action: w.wpbc_option_saver_loader_config.action_save,
        nonce: w.wpbc_option_saver_loader_config.save_nonce,
        data_name: entry.data_name,
        data_value: entry.payload
      }
    }).done(function (resp) {
      if (resp && resp.success) {
        entry.dirty = false;
        if (entry.el) {
          $(entry.el).attr('data-wpbc-u-autosave-dirty', '0');
        }
        if (typeof w.wpbc_admin_show_message === 'function') {
          w.wpbc_admin_show_message(resp.data && resp.data.message ? resp.data.message : 'Saved', 'success', 1000, false);
        }
      } else if (typeof w.wpbc_admin_show_message === 'function') {
        w.wpbc_admin_show_message(resp && resp.data && resp.data.message ? resp.data.message : 'Save error', 'error', 30000);
      }
      $(document).trigger('wpbc:option:afterSave', [resp]);
    }).fail(function (xhr) {
      if (typeof w.wpbc_admin_show_message === 'function') {
        w.wpbc_admin_show_message('WPBC | AJAX ' + xhr.status + ' ' + xhr.statusText, 'error', 30000);
      }
      $(document).trigger('wpbc:option:afterSave', [{
        success: false,
        data: {
          message: xhr.statusText
        }
      }]);
    });
  }

  /**
   * Save Option - send ajax request to save data.
   *
   * Data attributes:
   *     data-wpbc-u-save-name       — option key (required)
   *     The fixed save nonce is supplied by wpbc_option_saver_loader_config.
   *     data-wpbc-u-save-value      — RAW scalar to save (optional)  (dynamic: read via attr first)
   *     data-wpbc-u-save-value-json — JSON string to save (optional) (dynamic: read via attr first)
   *     data-wpbc-u-save-fields     — CSV selectors serialized with jQuery.param (optional). Server policy owns the writable-key allowlist.
   *     data-wpbc-u-save-value-from — OPTIONAL selector to read scalar from (checkbox => On/Off)
   *     data-wpbc-u-busy-text       — custom text during AJAX (optional)
   *     data-wpbc-u-save-callback   — window function name to call on success (optional)
   *
   * @param {HTMLElement} el element with data attributes.
   * @returns {void}
   */
  w.wpbc_save_option_from_element = function (el) {
    if (!w.wpbc_option_saver_loader_config) {
      console.error('WPBC | config missing');
      return;
    }
    var $el = $(el);
    var nonce = w.wpbc_option_saver_loader_config.save_nonce;
    var data_name = $el.data('wpbc-u-save-name');

    // Dynamic values MUST prefer attribute read (fresh), fallback to .data().
    var fields_raw = $el.data('wpbc-u-save-fields') || '';
    var inline_value = wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value', 'wpbc-u-save-value');
    var json = wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value-json', 'wpbc-u-save-value-json');

    // Optional: compute scalar from another control selector at click time.
    var value_from_selector = $el.data('wpbc-u-save-value-from') || $el.attr('data-wpbc-u-save-value-from');
    var cb_id = $el.data('wpbc-u-save-callback');
    var cb_fn = cb_id && typeof w[cb_id] === 'function' ? w[cb_id] : null;
    if (!nonce || !data_name) {
      console.error('WPBC | missing nonce/name');
      return;
    }
    var payload = '';

    // 1) JSON path.
    if (typeof json === 'string' && json.trim() !== '') {
      payload = json.trim();
    }
    // 2) Scalar computed from selector (checkbox => On/Off).
    else if (value_from_selector) {
      var $src = $(value_from_selector);
      var $control = $src.is('input,select,textarea') ? $src : $src.find('input,select,textarea').first();
      payload = wpbc_uix_get_control_value($control);
    }
    // 3) RAW scalar path.
    else if (typeof inline_value !== 'undefined' && inline_value !== null) {
      payload = String(inline_value);
    }
    // 4) Fields path (query-string).
    else if (fields_raw) {
      var fields = String(fields_raw).split(',').map(function (s) {
        return String(s || '').trim();
      }).filter(Boolean);
      var data = {};
      fields.forEach(function (sel) {
        var $f = $(sel);
        if (!$f.length) {
          return;
        }

        // If selector points to a wrapper, try to locate a real control inside.
        var $control = $f.is('input,select,textarea') ? $f : $f.find('input,select,textarea').first();
        if (!$control.length) {
          return;
        }
        var key = $control.attr('name') || $control.attr('id');
        if (!key) {
          return;
        }
        data[key] = wpbc_uix_get_control_value($control);
      });
      payload = $.param(data);
    } else {
      console.error('WPBC | provide value, value-from selector, json, or fields');
      return;
    }

    // Sync jQuery cache for the scalar value (helps other code that still reads .data()).
    // If payload looks like a simple scalar (not JSON, not query-string), keep it aligned.
    if (typeof payload === 'string' && payload.indexOf('=') === -1 && payload.indexOf('&') === -1) {
      try {
        $el.data('wpbc-u-save-value', payload);
      } catch (e) {}
    }
    $(document).trigger('wpbc:option:beforeSave', [$el, payload]);
    wpbc_uix_busy_on($el);
    $.ajax({
      url: w.wpbc_option_saver_loader_config.ajax_url,
      type: 'POST',
      data: {
        action: w.wpbc_option_saver_loader_config.action_save,
        nonce: nonce,
        data_name: data_name,
        data_value: payload
      }
    }).done(function (resp) {
      // NOTE: previously the code always showed "success" even on error.
      // Fixed: show success only when resp.success is true.

      if (resp && resp.success) {
        $el.attr('data-wpbc-u-autosave-dirty', '0');
        if (data_name && wpbc_uix_autosave_registry[data_name]) {
          wpbc_uix_autosave_registry[data_name].dirty = false;
        }
        if (cb_fn) {
          try {
            cb_fn(resp);
          } catch (e) {
            console.error(e);
          }
        }
        var ok_message = resp && resp.data && resp.data.message ? resp.data.message : 'Saved';
        if (typeof w.wpbc_admin_show_message === 'function') {
          w.wpbc_admin_show_message(ok_message, 'success', 1000, false);
        }
      } else {
        var err_message = resp && resp.data && resp.data.message ? resp.data.message : 'Save error';
        console.error('WPBC | ' + err_message);
        if (typeof w.wpbc_admin_show_message === 'function') {
          w.wpbc_admin_show_message(err_message, 'error', 30000);
        }
      }
      $(document).trigger('wpbc:option:afterSave', [resp]);
    }).fail(function (xhr) {
      var feedback_message = 'WPBC | AJAX ' + xhr.status + ' ' + xhr.statusText;
      console.error(feedback_message);
      if (typeof w.wpbc_admin_show_message === 'function') {
        w.wpbc_admin_show_message(feedback_message, 'error', 30000);
      }
      $(document).trigger('wpbc:option:afterSave', [{
        success: false,
        data: {
          message: xhr.statusText
        }
      }]);
    }).always(function () {
      wpbc_uix_busy_off($el);
    });
  };

  /**
   * Wire opt-in autosave of global options after successful BFB form save.
   *
   * Add data-wpbc-u-autosave-on-form-save="1" to a save control to participate.
   * Dirty state is tracked from data-wpbc-u-save-value-from, or data-wpbc-u-autosave-watch when present.
   *
   * @returns {void}
   */
  function wpbc_uix_bind_autosave_on_form_save() {
    var autosave_selector = '[data-wpbc-u-autosave-on-form-save="1"]';
    $(document).on('change input', 'input,select,textarea', function () {
      var changed_el = this;
      $(autosave_selector).each(function () {
        var $btn = $(this);
        var watch_selector = $btn.attr('data-wpbc-u-autosave-watch') || $btn.attr('data-wpbc-u-save-value-from') || '';
        if (!watch_selector) {
          return;
        }
        var $watched = $(watch_selector);
        if ($watched.filter(changed_el).length || $watched.has(changed_el).length) {
          $btn.attr('data-wpbc-u-autosave-dirty', '1');
          wpbc_uix_update_autosave_registry_from_element(this, true);
        }
      });
    });
    document.addEventListener('wpbc:bfb:form:ajax_saved', function () {
      $(autosave_selector).each(function () {
        if (this.getAttribute('data-wpbc-u-autosave-dirty') === '1') {
          wpbc_uix_update_autosave_registry_from_element(this, true);
        }
      });
      Object.keys(wpbc_uix_autosave_registry).forEach(function (option_name) {
        var entry = wpbc_uix_autosave_registry[option_name];
        if (!entry || !entry.dirty) {
          return;
        }
        if (entry.el && document.documentElement.contains(entry.el)) {
          w.wpbc_save_option_from_element(entry.el);
        } else {
          wpbc_uix_save_autosave_registry_entry(entry);
        }
      });
    });
  }

  /**
   * Load option value via AJAX.
   *
   * @param {HTMLElement} el element with data attributes.
   * @returns {void}
   */
  w.wpbc_load_option_from_element = function (el) {
    if (!w.wpbc_option_saver_loader_config) {
      console.error('WPBC | config missing');
      return;
    }
    var $el = $(el);
    var name = $el.data('wpbc-u-load-name') || $el.data('wpbc-u-save-name');
    var cb_id = $el.data('wpbc-u-load-callback');
    var cb_fn = cb_id && typeof w[cb_id] === 'function' ? w[cb_id] : null;
    if (!name || !w.wpbc_option_saver_loader_config.load_nonce) {
      console.error('WPBC | missing load nonce/name');
      return;
    }
    $(document).trigger('wpbc:option:beforeLoad', [$el, name]);
    wpbc_uix_busy_on($el);
    $.ajax({
      url: w.wpbc_option_saver_loader_config.ajax_url,
      type: 'GET',
      data: {
        action: w.wpbc_option_saver_loader_config.action_load,
        nonce: w.wpbc_option_saver_loader_config.load_nonce,
        data_name: name
      }
    }).done(function (resp) {
      if (resp && resp.success) {
        if (cb_fn) {
          try {
            cb_fn(resp.data && resp.data.value);
          } catch (e) {
            console.error(e);
          }
        }
      } else {
        console.error('WPBC | ' + (resp && resp.data && resp.data.message ? resp.data.message : 'Load error'));
      }
      $(document).trigger('wpbc:option:afterLoad', [resp]);
    }).fail(function (xhr) {
      console.error('WPBC | AJAX ' + xhr.status + ' ' + xhr.statusText);
      $(document).trigger('wpbc:option:afterLoad', [{
        success: false,
        data: {
          message: xhr.statusText
        }
      }]);
    }).always(function () {
      wpbc_uix_busy_off($el);
    });
  };
  wpbc_uix_bind_autosave_on_form_save();
})(window, jQuery);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvc2F2ZS1sb2FkLW9wdGlvbi9fb3V0L3NhdmUtbG9hZC1vcHRpb24uanMiLCJuYW1lcyI6WyJ3IiwiJCIsIndwYmNfdWl4X2VzY2FwZV9odG1sIiwicyIsIlN0cmluZyIsInJlcGxhY2UiLCJ3cGJjX3VpeF9yZWFkX2F0dHJfb3JfZGF0YSIsIiRlbCIsImF0dHJfbmFtZSIsImRhdGFfa2V5IiwidiIsImF0dHIiLCJkYXRhIiwid3BiY191aXhfdG9fb25fb2ZmIiwidG9Mb3dlckNhc2UiLCJ3cGJjX3VpeF9nZXRfY29udHJvbF92YWx1ZSIsIiRjb250cm9sIiwibGVuZ3RoIiwiaXMiLCJuYW1lIiwiJGNoZWNrZWQiLCJ2YWwiLCJ3cGJjX3VpeF9idXN5X29uIiwiaHRtbCIsImJ1c3lfdGV4dCIsInNwaW5uZXIiLCJhcHBlbmQiLCJhZGRDbGFzcyIsInByb3AiLCJ3cGJjX3VpeF9idXN5X29mZiIsIm9yaWdpbmFsIiwicmVtb3ZlQ2xhc3MiLCJyZW1vdmVBdHRyIiwicmVtb3ZlRGF0YSIsIndwYmNfdWl4X2F1dG9zYXZlX3JlZ2lzdHJ5Iiwid3BiY191aXhfZ2V0X29wdGlvbl9zYXZlX2NvbmZpZyIsImRhdGFfbmFtZSIsImZpZWxkc19yYXciLCJpbmxpbmVfdmFsdWUiLCJqc29uIiwidmFsdWVfZnJvbV9zZWxlY3RvciIsIndwYmNfdWl4X2J1aWxkX29wdGlvbl9zYXZlX3BheWxvYWQiLCJjZmciLCJ0cmltIiwiJHNyYyIsImZpbmQiLCJmaXJzdCIsImZpZWxkcyIsInNwbGl0IiwibWFwIiwiZmlsdGVyIiwiQm9vbGVhbiIsImZvckVhY2giLCJzZWwiLCIkZiIsImtleSIsInBhcmFtIiwid3BiY191aXhfdXBkYXRlX2F1dG9zYXZlX3JlZ2lzdHJ5X2Zyb21fZWxlbWVudCIsImVsIiwiaXNfZGlydHkiLCJwYXlsb2FkIiwiZGlydHkiLCJ3cGJjX3VpeF9zYXZlX2F1dG9zYXZlX3JlZ2lzdHJ5X2VudHJ5IiwiZW50cnkiLCJ3cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnIiwic2F2ZV9ub25jZSIsImRvY3VtZW50IiwidHJpZ2dlciIsImFqYXgiLCJ1cmwiLCJhamF4X3VybCIsInR5cGUiLCJhY3Rpb24iLCJhY3Rpb25fc2F2ZSIsIm5vbmNlIiwiZGF0YV92YWx1ZSIsImRvbmUiLCJyZXNwIiwic3VjY2VzcyIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwibWVzc2FnZSIsImZhaWwiLCJ4aHIiLCJzdGF0dXMiLCJzdGF0dXNUZXh0Iiwid3BiY19zYXZlX29wdGlvbl9mcm9tX2VsZW1lbnQiLCJjb25zb2xlIiwiZXJyb3IiLCJjYl9pZCIsImNiX2ZuIiwiaW5kZXhPZiIsImUiLCJva19tZXNzYWdlIiwiZXJyX21lc3NhZ2UiLCJmZWVkYmFja19tZXNzYWdlIiwiYWx3YXlzIiwid3BiY191aXhfYmluZF9hdXRvc2F2ZV9vbl9mb3JtX3NhdmUiLCJhdXRvc2F2ZV9zZWxlY3RvciIsIm9uIiwiY2hhbmdlZF9lbCIsImVhY2giLCIkYnRuIiwid2F0Y2hfc2VsZWN0b3IiLCIkd2F0Y2hlZCIsImhhcyIsImFkZEV2ZW50TGlzdGVuZXIiLCJnZXRBdHRyaWJ1dGUiLCJPYmplY3QiLCJrZXlzIiwib3B0aW9uX25hbWUiLCJkb2N1bWVudEVsZW1lbnQiLCJjb250YWlucyIsIndwYmNfbG9hZF9vcHRpb25fZnJvbV9lbGVtZW50IiwibG9hZF9ub25jZSIsImFjdGlvbl9sb2FkIiwidmFsdWUiLCJ3aW5kb3ciLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9zYXZlLWxvYWQtb3B0aW9uL19zcmMvc2F2ZS1sb2FkLW9wdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR2VuZXJhbCBPcHRpb24gTG9hZGVyL1NhdmVyIChjbGllbnQpXHJcbiAqXHJcbiAqIC0gUHJvdmlkZXM6XHJcbiAqICAgICB3aW5kb3cud3BiY19zYXZlX29wdGlvbl9mcm9tX2VsZW1lbnQoZWwpXHJcbiAqICAgICB3aW5kb3cud3BiY19sb2FkX29wdGlvbl9mcm9tX2VsZW1lbnQoZWwpXHJcbiAqIC0gQnVzeSBVSSAoc3Bpbm5lciArIGRpc2FibGVkKVxyXG4gKiAtIEpTT04gcGF0aDogc2VuZCByYXcgSlNPTiBzdHJpbmcgdW50b3VjaGVkLlxyXG4gKiAtIFJBVyBzY2FsYXIgcGF0aDogc2VuZCBhcy1pcy5cclxuICogLSBGaWVsZHMgcGF0aDogc2VyaWFsaXplIHRvIHF1ZXJ5LXN0cmluZyB2aWEgalF1ZXJ5LnBhcmFtLlxyXG4gKlxyXG4gKiBJTVBPUlRBTlQ6XHJcbiAqIC0galF1ZXJ5IC5kYXRhKCkgaXMgY2FjaGVkLiBJZiBzb21lIGNvZGUgdXBkYXRlcyBkYXRhLSogYXR0cmlidXRlcyB2aWEgc2V0QXR0cmlidXRlKCksXHJcbiAqICAgcmVhZGluZyB2aWEgJGVsLmRhdGEoLi4uKSBjYW4gcmV0dXJuIHN0YWxlIHZhbHVlcy5cclxuICogLSBUaGVyZWZvcmUsIHRoaXMgbW9kdWxlIHByZWZlcnMgcmVhZGluZyB2aWEgJGVsLmF0dHIoJ2RhdGEtLi4uJykgZm9yIGR5bmFtaWMga2V5c1xyXG4gKiAgICh2YWx1ZS92YWx1ZS1qc29uKSwgYW5kIGZhbGxzIGJhY2sgdG8gJGVsLmRhdGEoLi4uKSB3aGVuIGF0dHJpYnV0ZSBpcyBtaXNzaW5nLlxyXG4gKlxyXG4gKiBmaWxlOiAuLi9pbmNsdWRlcy9zYXZlLWxvYWQtb3B0aW9uL19vdXQvc2F2ZS1sb2FkLW9wdGlvbi5qc1xyXG4gKlxyXG4gKiBFdmVudHM6XHJcbiAqICAgJChkb2N1bWVudCkub24oJ3dwYmM6b3B0aW9uOmJlZm9yZVNhdmUnLCAoZSwgJGVsLCBwYXlsb2FkKSA9PiB7fSlcclxuICogICAkKGRvY3VtZW50KS5vbignd3BiYzpvcHRpb246YWZ0ZXJTYXZlJywgIChlLCByZXNwb25zZSkgPT4ge30pXHJcbiAqICAgJChkb2N1bWVudCkub24oJ3dwYmM6b3B0aW9uOmJlZm9yZUxvYWQnLCAoZSwgJGVsLCBuYW1lKSA9PiB7fSlcclxuICogICAkKGRvY3VtZW50KS5vbignd3BiYzpvcHRpb246YWZ0ZXJMb2FkJywgIChlLCByZXNwb25zZSkgPT4ge30pXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsICQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVzY2FwZSBmb3Igc2FmZSBIVE1MIGluamVjdGlvbiAoc21hbGwgaGVscGVyKS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9lc2NhcGVfaHRtbChzKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKHMpXHJcblx0XHRcdC5yZXBsYWNlKC8mL2csICcmYW1wOycpXHJcblx0XHRcdC5yZXBsYWNlKC88L2csICcmbHQ7JylcclxuXHRcdFx0LnJlcGxhY2UoLz4vZywgJyZndDsnKVxyXG5cdFx0XHQucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXHJcblx0XHRcdC5yZXBsYWNlKC8nL2csICcmIzAzOTsnKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlYWQgYSB2YWx1ZSBmcm9tIGRhdGEtKiBhdHRyaWJ1dGUgZmlyc3QgKGZyZXNoKSwgdGhlbiBmYWxsYmFjayB0byBqUXVlcnkgLmRhdGEoKSBjYWNoZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYXR0cl9uYW1lICAgICAgRXhhbXBsZTogJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGRhdGFfa2V5ICAgICAgIEV4YW1wbGU6ICd3cGJjLXUtc2F2ZS12YWx1ZSdcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9yZWFkX2F0dHJfb3JfZGF0YSgkZWwsIGF0dHJfbmFtZSwgZGF0YV9rZXkpIHtcclxuXHRcdHZhciB2ID0gJGVsLmF0dHIoYXR0cl9uYW1lKTtcclxuXHRcdGlmICh0eXBlb2YgdiAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdFx0cmV0dXJuIHY7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gJGVsLmRhdGEoZGF0YV9rZXkpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVHVybiBcIk9uXCIvXCJPZmZcIiBsaWtlIHZhbHVlcyBpbnRvIGNvbnNpc3RlbnQgXCJPblwiL1wiT2ZmXCIuXHJcblx0ICogKFVzZWQgZm9yIGNoZWNrYm94L3RvZ2dsZSBzZXJpYWxpemF0aW9uLilcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7Kn0gdlxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY191aXhfdG9fb25fb2ZmKHYpIHtcclxuXHRcdGlmICh2ID09PSB0cnVlKSB7IHJldHVybiAnT24nOyB9XHJcblx0XHRpZiAodiA9PT0gZmFsc2UpIHsgcmV0dXJuICdPZmYnOyB9XHJcblx0XHR2YXIgcyA9IFN0cmluZyh2IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0aWYgKHMgPT09ICdvbicgfHwgcyA9PT0gJzEnIHx8IHMgPT09ICd0cnVlJyB8fCBzID09PSAneWVzJykgeyByZXR1cm4gJ09uJzsgfVxyXG5cdFx0cmV0dXJuICdPZmYnO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGEgdXNlZnVsIHZhbHVlIGZyb20gYW4gaW5wdXQvc2VsZWN0L3RleHRhcmVhIGVsZW1lbnQuXHJcblx0ICogLSBjaGVja2JveCA9PiAnT24nLydPZmYnXHJcblx0ICogLSByYWRpbyAgICA9PiB2YWx1ZSBvZiBjaGVja2VkIGluIGdyb3VwIChpZiBwb3NzaWJsZSksIGVsc2UgJydcclxuXHQgKiAtIG90aGVycyAgID0+IC52YWwoKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtqUXVlcnl9ICRjb250cm9sXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9nZXRfY29udHJvbF92YWx1ZSgkY29udHJvbCkge1xyXG5cclxuXHRcdGlmICghJGNvbnRyb2wgfHwgISRjb250cm9sLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm4gJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gY2hlY2tib3gvdG9nZ2xlLlxyXG5cdFx0aWYgKCRjb250cm9sLmlzKCc6Y2hlY2tib3gnKSkge1xyXG5cdFx0XHRyZXR1cm4gJGNvbnRyb2wuaXMoJzpjaGVja2VkJykgPyAnT24nIDogJ09mZic7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gcmFkaW8gZ3JvdXAuXHJcblx0XHRpZiAoJGNvbnRyb2wuaXMoJzpyYWRpbycpKSB7XHJcblx0XHRcdHZhciBuYW1lID0gJGNvbnRyb2wuYXR0cignbmFtZScpO1xyXG5cdFx0XHRpZiAobmFtZSkge1xyXG5cdFx0XHRcdHZhciAkY2hlY2tlZCA9ICQoJ2lucHV0W3R5cGU9XCJyYWRpb1wiXVtuYW1lPVwiJyArIG5hbWUgKyAnXCJdOmNoZWNrZWQnKTtcclxuXHRcdFx0XHRyZXR1cm4gJGNoZWNrZWQubGVuZ3RoID8gU3RyaW5nKCRjaGVja2VkLnZhbCgpKSA6ICcnO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiAkY29udHJvbC5pcygnOmNoZWNrZWQnKSA/IFN0cmluZygkY29udHJvbC52YWwoKSkgOiAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBzZWxlY3QvdGV4dC90ZXh0YXJlYS9ldGMuXHJcblx0XHRyZXR1cm4gU3RyaW5nKCRjb250cm9sLnZhbCgpID09IG51bGwgPyAnJyA6ICRjb250cm9sLnZhbCgpKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJ1c3kgT04gVUkgZm9yIGEgY2xpY2thYmxlIGVsZW1lbnQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJGVsXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY191aXhfYnVzeV9vbigkZWwpIHtcclxuXHRcdGlmICghJGVsIHx8ICEkZWwubGVuZ3RoIHx8ICRlbC5kYXRhKCd3cGJjLXVpeC1idXN5JykpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRlbC5kYXRhKCd3cGJjLXVpeC1idXN5JywgMSk7XHJcblx0XHQkZWwuZGF0YSgnd3BiYy11aXgtb3JpZ2luYWwtaHRtbCcsICRlbC5odG1sKCkpO1xyXG5cclxuXHRcdHZhciBidXN5X3RleHQgPSAkZWwuZGF0YSgnd3BiYy11LWJ1c3ktdGV4dCcpO1xyXG5cdFx0dmFyIHNwaW5uZXIgPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluIHdwYmNfYWpheF9pY29uIHdwYmNfcHJvY2Vzc2luZyB3cGJjX2ljbl9hdXRvcmVuZXdcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L3NwYW4+JztcclxuXHJcblx0XHRpZiAodHlwZW9mIGJ1c3lfdGV4dCA9PT0gJ3N0cmluZycgJiYgYnVzeV90ZXh0Lmxlbmd0aCkge1xyXG5cdFx0XHQkZWwuaHRtbCh3cGJjX3VpeF9lc2NhcGVfaHRtbChidXN5X3RleHQpICsgJyAnICsgc3Bpbm5lcik7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkZWwuYXBwZW5kKHNwaW5uZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRlbC5hZGRDbGFzcygnd3BiYy1pcy1idXN5JylcclxuXHRcdFx0LmF0dHIoJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScpXHJcblx0XHRcdC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQnVzeSBPRkYgVUkgZm9yIGEgY2xpY2thYmxlIGVsZW1lbnQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJGVsXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY191aXhfYnVzeV9vZmYoJGVsKSB7XHJcblx0XHRpZiAoISRlbCB8fCAhJGVsLmxlbmd0aCB8fCAhJGVsLmRhdGEoJ3dwYmMtdWl4LWJ1c3knKSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG9yaWdpbmFsID0gJGVsLmRhdGEoJ3dwYmMtdWl4LW9yaWdpbmFsLWh0bWwnKTtcclxuXHRcdGlmICh0eXBlb2Ygb3JpZ2luYWwgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdCRlbC5odG1sKG9yaWdpbmFsKTtcclxuXHRcdH1cclxuXHJcblx0XHQkZWwucmVtb3ZlQ2xhc3MoJ3dwYmMtaXMtYnVzeScpXHJcblx0XHRcdC5yZW1vdmVBdHRyKCdhcmlhLWRpc2FibGVkJylcclxuXHRcdFx0LnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xyXG5cclxuXHRcdCRlbC5yZW1vdmVEYXRhKCd3cGJjLXVpeC1idXN5JylcclxuXHRcdFx0LnJlbW92ZURhdGEoJ3dwYmMtdWl4LW9yaWdpbmFsLWh0bWwnKTtcclxuXHR9XHJcblxyXG5cdHZhciB3cGJjX3VpeF9hdXRvc2F2ZV9yZWdpc3RyeSA9IHt9O1xyXG5cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9nZXRfb3B0aW9uX3NhdmVfY29uZmlnKCRlbCkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhX25hbWUgICAgICAgICAgOiAkZWwuZGF0YSgnd3BiYy11LXNhdmUtbmFtZScpLFxuXHRcdFx0ZmllbGRzX3JhdyAgICAgICAgIDogJGVsLmRhdGEoJ3dwYmMtdS1zYXZlLWZpZWxkcycpIHx8ICcnLFxuXHRcdFx0aW5saW5lX3ZhbHVlICAgICAgIDogd3BiY191aXhfcmVhZF9hdHRyX29yX2RhdGEoJGVsLCAnZGF0YS13cGJjLXUtc2F2ZS12YWx1ZScsICd3cGJjLXUtc2F2ZS12YWx1ZScpLFxuXHRcdFx0anNvbiAgICAgICAgICAgICAgIDogd3BiY191aXhfcmVhZF9hdHRyX29yX2RhdGEoJGVsLCAnZGF0YS13cGJjLXUtc2F2ZS12YWx1ZS1qc29uJywgJ3dwYmMtdS1zYXZlLXZhbHVlLWpzb24nKSxcblx0XHRcdHZhbHVlX2Zyb21fc2VsZWN0b3I6ICRlbC5kYXRhKCd3cGJjLXUtc2F2ZS12YWx1ZS1mcm9tJykgfHwgJGVsLmF0dHIoJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUtZnJvbScpXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfdWl4X2J1aWxkX29wdGlvbl9zYXZlX3BheWxvYWQoJGVsLCBjZmcpIHtcclxuXHRcdGNmZyA9IGNmZyB8fCB3cGJjX3VpeF9nZXRfb3B0aW9uX3NhdmVfY29uZmlnKCRlbCk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBjZmcuanNvbiA9PT0gJ3N0cmluZycgJiYgY2ZnLmpzb24udHJpbSgpICE9PSAnJykge1xyXG5cdFx0XHRyZXR1cm4gY2ZnLmpzb24udHJpbSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChjZmcudmFsdWVfZnJvbV9zZWxlY3Rvcikge1xyXG5cdFx0XHR2YXIgJHNyYyA9ICQoY2ZnLnZhbHVlX2Zyb21fc2VsZWN0b3IpO1xyXG5cdFx0XHR2YXIgJGNvbnRyb2wgPSAkc3JjLmlzKCdpbnB1dCxzZWxlY3QsdGV4dGFyZWEnKSA/ICRzcmMgOiAkc3JjLmZpbmQoJ2lucHV0LHNlbGVjdCx0ZXh0YXJlYScpLmZpcnN0KCk7XHJcblx0XHRcdHJldHVybiB3cGJjX3VpeF9nZXRfY29udHJvbF92YWx1ZSgkY29udHJvbCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBjZmcuaW5saW5lX3ZhbHVlICE9PSAndW5kZWZpbmVkJyAmJiBjZmcuaW5saW5lX3ZhbHVlICE9PSBudWxsKSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoY2ZnLmlubGluZV92YWx1ZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGNmZy5maWVsZHNfcmF3KSB7XHJcblx0XHRcdHZhciBmaWVsZHMgPSBTdHJpbmcoY2ZnLmZpZWxkc19yYXcpLnNwbGl0KCcsJylcclxuXHRcdFx0XHQubWFwKGZ1bmN0aW9uIChzKSB7IHJldHVybiBTdHJpbmcocyB8fCAnJykudHJpbSgpOyB9KVxyXG5cdFx0XHRcdC5maWx0ZXIoQm9vbGVhbik7XHJcblxyXG5cdFx0XHR2YXIgZGF0YSA9IHt9O1xyXG5cclxuXHRcdFx0ZmllbGRzLmZvckVhY2goZnVuY3Rpb24gKHNlbCkge1xyXG5cdFx0XHRcdHZhciAkZiA9ICQoc2VsKTtcclxuXHRcdFx0XHRpZiAoISRmLmxlbmd0aCkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0dmFyICRjb250cm9sID0gJGYuaXMoJ2lucHV0LHNlbGVjdCx0ZXh0YXJlYScpID8gJGYgOiAkZi5maW5kKCdpbnB1dCxzZWxlY3QsdGV4dGFyZWEnKS5maXJzdCgpO1xyXG5cdFx0XHRcdGlmICghJGNvbnRyb2wubGVuZ3RoKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHR2YXIga2V5ID0gJGNvbnRyb2wuYXR0cignbmFtZScpIHx8ICRjb250cm9sLmF0dHIoJ2lkJyk7XHJcblx0XHRcdFx0aWYgKCFrZXkpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdGRhdGFba2V5XSA9IHdwYmNfdWl4X2dldF9jb250cm9sX3ZhbHVlKCRjb250cm9sKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gJC5wYXJhbShkYXRhKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfdWl4X3VwZGF0ZV9hdXRvc2F2ZV9yZWdpc3RyeV9mcm9tX2VsZW1lbnQoZWwsIGlzX2RpcnR5KSB7XHJcblx0XHR2YXIgJGVsID0gJChlbCk7XHJcblx0XHR2YXIgY2ZnID0gd3BiY191aXhfZ2V0X29wdGlvbl9zYXZlX2NvbmZpZygkZWwpO1xyXG5cclxuXHRcdGlmICghY2ZnLmRhdGFfbmFtZSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY191aXhfYXV0b3NhdmVfcmVnaXN0cnlbY2ZnLmRhdGFfbmFtZV0gPSB7XG5cdFx0XHRkYXRhX25hbWUgICA6IGNmZy5kYXRhX25hbWUsXG5cdFx0XHRwYXlsb2FkICAgICA6IHdwYmNfdWl4X2J1aWxkX29wdGlvbl9zYXZlX3BheWxvYWQoJGVsLCBjZmcpLFxuXHRcdFx0ZGlydHkgICAgICAgOiAhIWlzX2RpcnR5LFxuXHRcdFx0ZWwgICAgICAgICAgOiBlbFxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfdWl4X3NhdmVfYXV0b3NhdmVfcmVnaXN0cnlfZW50cnkoZW50cnkpIHtcblx0XHRpZiAoIWVudHJ5IHx8ICFlbnRyeS5kaXJ0eSB8fCAhZW50cnkuZGF0YV9uYW1lIHx8IGVudHJ5LnBheWxvYWQgPT09IG51bGwgfHwgIXcud3BiY19vcHRpb25fc2F2ZXJfbG9hZGVyX2NvbmZpZyB8fCAhdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLnNhdmVfbm9uY2UpIHtcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQkKGRvY3VtZW50KS50cmlnZ2VyKCd3cGJjOm9wdGlvbjpiZWZvcmVTYXZlJywgWyAkKCksIGVudHJ5LnBheWxvYWQgXSk7XHJcblxyXG5cdFx0JC5hamF4KHtcclxuXHRcdFx0dXJsOiAgdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLmFqYXhfdXJsLFxyXG5cdFx0XHR0eXBlOiAnUE9TVCcsXHJcblx0XHRcdGRhdGE6IHtcblx0XHRcdFx0YWN0aW9uOiAgICAgICB3LndwYmNfb3B0aW9uX3NhdmVyX2xvYWRlcl9jb25maWcuYWN0aW9uX3NhdmUsXG5cdFx0XHRcdG5vbmNlOiAgICAgICAgdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLnNhdmVfbm9uY2UsXG5cdFx0XHRcdGRhdGFfbmFtZTogICAgZW50cnkuZGF0YV9uYW1lLFxuXHRcdFx0XHRkYXRhX3ZhbHVlOiAgIGVudHJ5LnBheWxvYWRcblx0XHRcdH1cclxuXHRcdH0pXHJcblx0XHQuZG9uZShmdW5jdGlvbiAocmVzcCkge1xyXG5cdFx0XHRpZiAocmVzcCAmJiByZXNwLnN1Y2Nlc3MpIHtcclxuXHRcdFx0XHRlbnRyeS5kaXJ0eSA9IGZhbHNlO1xyXG5cdFx0XHRcdGlmIChlbnRyeS5lbCkge1xyXG5cdFx0XHRcdFx0JChlbnRyeS5lbCkuYXR0cignZGF0YS13cGJjLXUtYXV0b3NhdmUtZGlydHknLCAnMCcpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAodHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHRcdHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoKHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSkgPyByZXNwLmRhdGEubWVzc2FnZSA6ICdTYXZlZCcsICdzdWNjZXNzJywgMTAwMCwgZmFsc2UpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIGlmICh0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoKHJlc3AgJiYgcmVzcC5kYXRhICYmIHJlc3AuZGF0YS5tZXNzYWdlKSA/IHJlc3AuZGF0YS5tZXNzYWdlIDogJ1NhdmUgZXJyb3InLCAnZXJyb3InLCAzMDAwMCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCQoZG9jdW1lbnQpLnRyaWdnZXIoJ3dwYmM6b3B0aW9uOmFmdGVyU2F2ZScsIFsgcmVzcCBdKTtcclxuXHRcdH0pXHJcblx0XHQuZmFpbChmdW5jdGlvbiAoeGhyKSB7XHJcblx0XHRcdGlmICh0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoJ1dQQkMgfCBBSkFYICcgKyB4aHIuc3RhdHVzICsgJyAnICsgeGhyLnN0YXR1c1RleHQsICdlcnJvcicsIDMwMDAwKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQkKGRvY3VtZW50KS50cmlnZ2VyKCd3cGJjOm9wdGlvbjphZnRlclNhdmUnLCBbIHsgc3VjY2VzczogZmFsc2UsIGRhdGE6IHsgbWVzc2FnZTogeGhyLnN0YXR1c1RleHQgfSB9IF0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTYXZlIE9wdGlvbiAtIHNlbmQgYWpheCByZXF1ZXN0IHRvIHNhdmUgZGF0YS5cclxuXHQgKlxyXG5cdCAqIERhdGEgYXR0cmlidXRlczpcclxuXHQgKiAgICAgZGF0YS13cGJjLXUtc2F2ZS1uYW1lICAgICAgIOKAlCBvcHRpb24ga2V5IChyZXF1aXJlZClcclxuXHQgKiAgICAgVGhlIGZpeGVkIHNhdmUgbm9uY2UgaXMgc3VwcGxpZWQgYnkgd3BiY19vcHRpb25fc2F2ZXJfbG9hZGVyX2NvbmZpZy5cblx0ICogICAgIGRhdGEtd3BiYy11LXNhdmUtdmFsdWUgICAgICDigJQgUkFXIHNjYWxhciB0byBzYXZlIChvcHRpb25hbCkgIChkeW5hbWljOiByZWFkIHZpYSBhdHRyIGZpcnN0KVxyXG5cdCAqICAgICBkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWpzb24g4oCUIEpTT04gc3RyaW5nIHRvIHNhdmUgKG9wdGlvbmFsKSAoZHluYW1pYzogcmVhZCB2aWEgYXR0ciBmaXJzdClcclxuXHQgKiAgICAgZGF0YS13cGJjLXUtc2F2ZS1maWVsZHMgICAgIOKAlCBDU1Ygc2VsZWN0b3JzIHNlcmlhbGl6ZWQgd2l0aCBqUXVlcnkucGFyYW0gKG9wdGlvbmFsKS4gU2VydmVyIHBvbGljeSBvd25zIHRoZSB3cml0YWJsZS1rZXkgYWxsb3dsaXN0LlxuXHQgKiAgICAgZGF0YS13cGJjLXUtc2F2ZS12YWx1ZS1mcm9tIOKAlCBPUFRJT05BTCBzZWxlY3RvciB0byByZWFkIHNjYWxhciBmcm9tIChjaGVja2JveCA9PiBPbi9PZmYpXHJcblx0ICogICAgIGRhdGEtd3BiYy11LWJ1c3ktdGV4dCAgICAgICDigJQgY3VzdG9tIHRleHQgZHVyaW5nIEFKQVggKG9wdGlvbmFsKVxyXG5cdCAqICAgICBkYXRhLXdwYmMtdS1zYXZlLWNhbGxiYWNrICAg4oCUIHdpbmRvdyBmdW5jdGlvbiBuYW1lIHRvIGNhbGwgb24gc3VjY2VzcyAob3B0aW9uYWwpXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCBlbGVtZW50IHdpdGggZGF0YSBhdHRyaWJ1dGVzLlxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqL1xyXG5cdHcud3BiY19zYXZlX29wdGlvbl9mcm9tX2VsZW1lbnQgPSBmdW5jdGlvbiAoZWwpIHtcclxuXHJcblx0XHRpZiAoIXcud3BiY19vcHRpb25fc2F2ZXJfbG9hZGVyX2NvbmZpZykge1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCdXUEJDIHwgY29uZmlnIG1pc3NpbmcnKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciAkZWwgPSAkKGVsKTtcclxuXHJcblx0XHR2YXIgbm9uY2UgICAgID0gdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLnNhdmVfbm9uY2U7XG5cdFx0dmFyIGRhdGFfbmFtZSA9ICRlbC5kYXRhKCd3cGJjLXUtc2F2ZS1uYW1lJyk7XG5cclxuXHRcdC8vIER5bmFtaWMgdmFsdWVzIE1VU1QgcHJlZmVyIGF0dHJpYnV0ZSByZWFkIChmcmVzaCksIGZhbGxiYWNrIHRvIC5kYXRhKCkuXHJcblx0XHR2YXIgZmllbGRzX3JhdyAgID0gJGVsLmRhdGEoJ3dwYmMtdS1zYXZlLWZpZWxkcycpIHx8ICcnO1xyXG5cdFx0dmFyIGlubGluZV92YWx1ZSA9IHdwYmNfdWl4X3JlYWRfYXR0cl9vcl9kYXRhKCRlbCwgJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUnLCAnd3BiYy11LXNhdmUtdmFsdWUnKTtcclxuXHRcdHZhciBqc29uICAgICAgICAgPSB3cGJjX3VpeF9yZWFkX2F0dHJfb3JfZGF0YSgkZWwsICdkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWpzb24nLCAnd3BiYy11LXNhdmUtdmFsdWUtanNvbicpO1xyXG5cclxuXHRcdC8vIE9wdGlvbmFsOiBjb21wdXRlIHNjYWxhciBmcm9tIGFub3RoZXIgY29udHJvbCBzZWxlY3RvciBhdCBjbGljayB0aW1lLlxyXG5cdFx0dmFyIHZhbHVlX2Zyb21fc2VsZWN0b3IgPSAkZWwuZGF0YSgnd3BiYy11LXNhdmUtdmFsdWUtZnJvbScpIHx8ICRlbC5hdHRyKCdkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWZyb20nKTtcclxuXHJcblx0XHR2YXIgY2JfaWQgPSAkZWwuZGF0YSgnd3BiYy11LXNhdmUtY2FsbGJhY2snKTtcclxuXHRcdHZhciBjYl9mbiA9IChjYl9pZCAmJiB0eXBlb2Ygd1tjYl9pZF0gPT09ICdmdW5jdGlvbicpID8gd1tjYl9pZF0gOiBudWxsO1xyXG5cclxuXHRcdGlmICghbm9uY2UgfHwgIWRhdGFfbmFtZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignV1BCQyB8IG1pc3Npbmcgbm9uY2UvbmFtZScpO1xuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBwYXlsb2FkID0gJyc7XHJcblxyXG5cdFx0Ly8gMSkgSlNPTiBwYXRoLlxyXG5cdFx0aWYgKHR5cGVvZiBqc29uID09PSAnc3RyaW5nJyAmJiBqc29uLnRyaW0oKSAhPT0gJycpIHtcclxuXHRcdFx0cGF5bG9hZCA9IGpzb24udHJpbSgpO1xyXG5cdFx0fVxyXG5cdFx0Ly8gMikgU2NhbGFyIGNvbXB1dGVkIGZyb20gc2VsZWN0b3IgKGNoZWNrYm94ID0+IE9uL09mZikuXHJcblx0XHRlbHNlIGlmICh2YWx1ZV9mcm9tX3NlbGVjdG9yKSB7XHJcblx0XHRcdHZhciAkc3JjID0gJCh2YWx1ZV9mcm9tX3NlbGVjdG9yKTtcclxuXHRcdFx0dmFyICRjb250cm9sID0gJHNyYy5pcygnaW5wdXQsc2VsZWN0LHRleHRhcmVhJykgPyAkc3JjIDogJHNyYy5maW5kKCdpbnB1dCxzZWxlY3QsdGV4dGFyZWEnKS5maXJzdCgpO1xyXG5cdFx0XHRwYXlsb2FkID0gd3BiY191aXhfZ2V0X2NvbnRyb2xfdmFsdWUoJGNvbnRyb2wpO1xyXG5cdFx0fVxyXG5cdFx0Ly8gMykgUkFXIHNjYWxhciBwYXRoLlxyXG5cdFx0ZWxzZSBpZiAodHlwZW9mIGlubGluZV92YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgaW5saW5lX3ZhbHVlICE9PSBudWxsKSB7XHJcblx0XHRcdHBheWxvYWQgPSBTdHJpbmcoaW5saW5lX3ZhbHVlKTtcclxuXHRcdH1cclxuXHRcdC8vIDQpIEZpZWxkcyBwYXRoIChxdWVyeS1zdHJpbmcpLlxyXG5cdFx0ZWxzZSBpZiAoZmllbGRzX3Jhdykge1xyXG5cclxuXHRcdFx0dmFyIGZpZWxkcyA9IFN0cmluZyhmaWVsZHNfcmF3KS5zcGxpdCgnLCcpXHJcblx0XHRcdFx0Lm1hcChmdW5jdGlvbiAocykgeyByZXR1cm4gU3RyaW5nKHMgfHwgJycpLnRyaW0oKTsgfSlcclxuXHRcdFx0XHQuZmlsdGVyKEJvb2xlYW4pO1xyXG5cclxuXHRcdFx0dmFyIGRhdGEgPSB7fTtcclxuXHJcblx0XHRcdGZpZWxkcy5mb3JFYWNoKGZ1bmN0aW9uIChzZWwpIHtcclxuXHRcdFx0XHR2YXIgJGYgPSAkKHNlbCk7XHJcblx0XHRcdFx0aWYgKCEkZi5sZW5ndGgpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdC8vIElmIHNlbGVjdG9yIHBvaW50cyB0byBhIHdyYXBwZXIsIHRyeSB0byBsb2NhdGUgYSByZWFsIGNvbnRyb2wgaW5zaWRlLlxyXG5cdFx0XHRcdHZhciAkY29udHJvbCA9ICRmLmlzKCdpbnB1dCxzZWxlY3QsdGV4dGFyZWEnKSA/ICRmIDogJGYuZmluZCgnaW5wdXQsc2VsZWN0LHRleHRhcmVhJykuZmlyc3QoKTtcclxuXHRcdFx0XHRpZiAoISRjb250cm9sLmxlbmd0aCkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0dmFyIGtleSA9ICRjb250cm9sLmF0dHIoJ25hbWUnKSB8fCAkY29udHJvbC5hdHRyKCdpZCcpO1xyXG5cdFx0XHRcdGlmICgha2V5KSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHRkYXRhW2tleV0gPSB3cGJjX3VpeF9nZXRfY29udHJvbF92YWx1ZSgkY29udHJvbCk7XHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0cGF5bG9hZCA9ICQucGFyYW0oZGF0YSk7XHJcblx0XHR9XHJcblx0XHRlbHNlIHtcclxuXHRcdFx0Y29uc29sZS5lcnJvcignV1BCQyB8IHByb3ZpZGUgdmFsdWUsIHZhbHVlLWZyb20gc2VsZWN0b3IsIGpzb24sIG9yIGZpZWxkcycpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3luYyBqUXVlcnkgY2FjaGUgZm9yIHRoZSBzY2FsYXIgdmFsdWUgKGhlbHBzIG90aGVyIGNvZGUgdGhhdCBzdGlsbCByZWFkcyAuZGF0YSgpKS5cclxuXHRcdC8vIElmIHBheWxvYWQgbG9va3MgbGlrZSBhIHNpbXBsZSBzY2FsYXIgKG5vdCBKU09OLCBub3QgcXVlcnktc3RyaW5nKSwga2VlcCBpdCBhbGlnbmVkLlxyXG5cdFx0aWYgKHR5cGVvZiBwYXlsb2FkID09PSAnc3RyaW5nJyAmJiBwYXlsb2FkLmluZGV4T2YoJz0nKSA9PT0gLTEgJiYgcGF5bG9hZC5pbmRleE9mKCcmJykgPT09IC0xKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0JGVsLmRhdGEoJ3dwYmMtdS1zYXZlLXZhbHVlJywgcGF5bG9hZCk7XHJcblx0XHRcdH0gY2F0Y2ggKGUpIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0JChkb2N1bWVudCkudHJpZ2dlcignd3BiYzpvcHRpb246YmVmb3JlU2F2ZScsIFsgJGVsLCBwYXlsb2FkIF0pO1xyXG5cdFx0d3BiY191aXhfYnVzeV9vbigkZWwpO1xyXG5cclxuXHRcdCQuYWpheCh7XHJcblx0XHRcdHVybDogIHcud3BiY19vcHRpb25fc2F2ZXJfbG9hZGVyX2NvbmZpZy5hamF4X3VybCxcclxuXHRcdFx0dHlwZTogJ1BPU1QnLFxyXG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdGFjdGlvbjogICAgICAgdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLmFjdGlvbl9zYXZlLFxuXHRcdFx0XHRub25jZTogICAgICAgIG5vbmNlLFxuXHRcdFx0XHRkYXRhX25hbWU6ICAgIGRhdGFfbmFtZSxcblx0XHRcdFx0ZGF0YV92YWx1ZTogICBwYXlsb2FkXG5cdFx0XHR9XHJcblx0XHR9KVxyXG5cdFx0LmRvbmUoZnVuY3Rpb24gKHJlc3ApIHtcclxuXHJcblx0XHRcdC8vIE5PVEU6IHByZXZpb3VzbHkgdGhlIGNvZGUgYWx3YXlzIHNob3dlZCBcInN1Y2Nlc3NcIiBldmVuIG9uIGVycm9yLlxyXG5cdFx0XHQvLyBGaXhlZDogc2hvdyBzdWNjZXNzIG9ubHkgd2hlbiByZXNwLnN1Y2Nlc3MgaXMgdHJ1ZS5cclxuXHJcblx0XHRcdGlmIChyZXNwICYmIHJlc3Auc3VjY2Vzcykge1xyXG5cclxuXHRcdFx0XHQkZWwuYXR0cignZGF0YS13cGJjLXUtYXV0b3NhdmUtZGlydHknLCAnMCcpO1xyXG5cdFx0XHRcdGlmIChkYXRhX25hbWUgJiYgd3BiY191aXhfYXV0b3NhdmVfcmVnaXN0cnlbZGF0YV9uYW1lXSkge1xyXG5cdFx0XHRcdFx0d3BiY191aXhfYXV0b3NhdmVfcmVnaXN0cnlbZGF0YV9uYW1lXS5kaXJ0eSA9IGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGNiX2ZuKSB7XHJcblx0XHRcdFx0XHR0cnkgeyBjYl9mbihyZXNwKTsgfSBjYXRjaCAoZSkgeyBjb25zb2xlLmVycm9yKGUpOyB9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgb2tfbWVzc2FnZSA9IChyZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSkgPyByZXNwLmRhdGEubWVzc2FnZSA6ICdTYXZlZCc7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKG9rX21lc3NhZ2UsICdzdWNjZXNzJywgMTAwMCwgZmFsc2UpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdHZhciBlcnJfbWVzc2FnZSA9IChyZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSkgPyByZXNwLmRhdGEubWVzc2FnZSA6ICdTYXZlIGVycm9yJztcclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdXUEJDIHwgJyArIGVycl9tZXNzYWdlKTtcclxuXHJcblx0XHRcdFx0aWYgKHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKGVycl9tZXNzYWdlLCAnZXJyb3InLCAzMDAwMCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkKGRvY3VtZW50KS50cmlnZ2VyKCd3cGJjOm9wdGlvbjphZnRlclNhdmUnLCBbIHJlc3AgXSk7XHJcblx0XHR9KVxyXG5cdFx0LmZhaWwoZnVuY3Rpb24gKHhocikge1xyXG5cdFx0XHR2YXIgZmVlZGJhY2tfbWVzc2FnZSA9ICdXUEJDIHwgQUpBWCAnICsgeGhyLnN0YXR1cyArICcgJyArIHhoci5zdGF0dXNUZXh0O1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKGZlZWRiYWNrX21lc3NhZ2UpO1xyXG5cclxuXHRcdFx0aWYgKHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZShmZWVkYmFja19tZXNzYWdlLCAnZXJyb3InLCAzMDAwMCk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdCQoZG9jdW1lbnQpLnRyaWdnZXIoJ3dwYmM6b3B0aW9uOmFmdGVyU2F2ZScsIFsgeyBzdWNjZXNzOiBmYWxzZSwgZGF0YTogeyBtZXNzYWdlOiB4aHIuc3RhdHVzVGV4dCB9IH0gXSk7XHJcblx0XHR9KVxyXG5cdFx0LmFsd2F5cyhmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHdwYmNfdWl4X2J1c3lfb2ZmKCRlbCk7XHJcblx0XHR9KTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBXaXJlIG9wdC1pbiBhdXRvc2F2ZSBvZiBnbG9iYWwgb3B0aW9ucyBhZnRlciBzdWNjZXNzZnVsIEJGQiBmb3JtIHNhdmUuXHJcblx0ICpcclxuXHQgKiBBZGQgZGF0YS13cGJjLXUtYXV0b3NhdmUtb24tZm9ybS1zYXZlPVwiMVwiIHRvIGEgc2F2ZSBjb250cm9sIHRvIHBhcnRpY2lwYXRlLlxyXG5cdCAqIERpcnR5IHN0YXRlIGlzIHRyYWNrZWQgZnJvbSBkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWZyb20sIG9yIGRhdGEtd3BiYy11LWF1dG9zYXZlLXdhdGNoIHdoZW4gcHJlc2VudC5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfdWl4X2JpbmRfYXV0b3NhdmVfb25fZm9ybV9zYXZlKCkge1xyXG5cdFx0dmFyIGF1dG9zYXZlX3NlbGVjdG9yID0gJ1tkYXRhLXdwYmMtdS1hdXRvc2F2ZS1vbi1mb3JtLXNhdmU9XCIxXCJdJztcclxuXHJcblx0XHQkKGRvY3VtZW50KS5vbignY2hhbmdlIGlucHV0JywgJ2lucHV0LHNlbGVjdCx0ZXh0YXJlYScsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0dmFyIGNoYW5nZWRfZWwgPSB0aGlzO1xyXG5cclxuXHRcdFx0JChhdXRvc2F2ZV9zZWxlY3RvcikuZWFjaChmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0dmFyICRidG4gPSAkKHRoaXMpO1xyXG5cdFx0XHRcdHZhciB3YXRjaF9zZWxlY3RvciA9ICRidG4uYXR0cignZGF0YS13cGJjLXUtYXV0b3NhdmUtd2F0Y2gnKSB8fCAkYnRuLmF0dHIoJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUtZnJvbScpIHx8ICcnO1xyXG5cclxuXHRcdFx0XHRpZiAoIXdhdGNoX3NlbGVjdG9yKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgJHdhdGNoZWQgPSAkKHdhdGNoX3NlbGVjdG9yKTtcclxuXHRcdFx0XHRpZiAoJHdhdGNoZWQuZmlsdGVyKGNoYW5nZWRfZWwpLmxlbmd0aCB8fCAkd2F0Y2hlZC5oYXMoY2hhbmdlZF9lbCkubGVuZ3RoKSB7XHJcblx0XHRcdFx0XHQkYnRuLmF0dHIoJ2RhdGEtd3BiYy11LWF1dG9zYXZlLWRpcnR5JywgJzEnKTtcclxuXHRcdFx0XHRcdHdwYmNfdWl4X3VwZGF0ZV9hdXRvc2F2ZV9yZWdpc3RyeV9mcm9tX2VsZW1lbnQodGhpcywgdHJ1ZSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmM6YmZiOmZvcm06YWpheF9zYXZlZCcsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0JChhdXRvc2F2ZV9zZWxlY3RvcikuZWFjaChmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0aWYgKHRoaXMuZ2V0QXR0cmlidXRlKCdkYXRhLXdwYmMtdS1hdXRvc2F2ZS1kaXJ0eScpID09PSAnMScpIHtcclxuXHRcdFx0XHRcdHdwYmNfdWl4X3VwZGF0ZV9hdXRvc2F2ZV9yZWdpc3RyeV9mcm9tX2VsZW1lbnQodGhpcywgdHJ1ZSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdE9iamVjdC5rZXlzKHdwYmNfdWl4X2F1dG9zYXZlX3JlZ2lzdHJ5KS5mb3JFYWNoKGZ1bmN0aW9uIChvcHRpb25fbmFtZSkge1xyXG5cdFx0XHRcdHZhciBlbnRyeSA9IHdwYmNfdWl4X2F1dG9zYXZlX3JlZ2lzdHJ5W29wdGlvbl9uYW1lXTtcclxuXHRcdFx0XHRpZiAoIWVudHJ5IHx8ICFlbnRyeS5kaXJ0eSkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKGVudHJ5LmVsICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jb250YWlucyhlbnRyeS5lbCkpIHtcclxuXHRcdFx0XHRcdHcud3BiY19zYXZlX29wdGlvbl9mcm9tX2VsZW1lbnQoZW50cnkuZWwpO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHR3cGJjX3VpeF9zYXZlX2F1dG9zYXZlX3JlZ2lzdHJ5X2VudHJ5KGVudHJ5KTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0fSk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBMb2FkIG9wdGlvbiB2YWx1ZSB2aWEgQUpBWC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIGVsZW1lbnQgd2l0aCBkYXRhIGF0dHJpYnV0ZXMuXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0dy53cGJjX2xvYWRfb3B0aW9uX2Zyb21fZWxlbWVudCA9IGZ1bmN0aW9uIChlbCkge1xyXG5cclxuXHRcdGlmICghdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnKSB7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1dQQkMgfCBjb25maWcgbWlzc2luZycpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyICRlbCAgPSAkKGVsKTtcclxuXHRcdHZhciBuYW1lID0gJGVsLmRhdGEoJ3dwYmMtdS1sb2FkLW5hbWUnKSB8fCAkZWwuZGF0YSgnd3BiYy11LXNhdmUtbmFtZScpO1xyXG5cclxuXHRcdHZhciBjYl9pZCA9ICRlbC5kYXRhKCd3cGJjLXUtbG9hZC1jYWxsYmFjaycpO1xyXG5cdFx0dmFyIGNiX2ZuID0gKGNiX2lkICYmIHR5cGVvZiB3W2NiX2lkXSA9PT0gJ2Z1bmN0aW9uJykgPyB3W2NiX2lkXSA6IG51bGw7XHJcblxyXG5cdFx0aWYgKCFuYW1lIHx8ICF3LndwYmNfb3B0aW9uX3NhdmVyX2xvYWRlcl9jb25maWcubG9hZF9ub25jZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignV1BCQyB8IG1pc3NpbmcgbG9hZCBub25jZS9uYW1lJyk7XG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JChkb2N1bWVudCkudHJpZ2dlcignd3BiYzpvcHRpb246YmVmb3JlTG9hZCcsIFsgJGVsLCBuYW1lIF0pO1xyXG5cdFx0d3BiY191aXhfYnVzeV9vbigkZWwpO1xyXG5cclxuXHRcdCQuYWpheCh7XHJcblx0XHRcdHVybDogIHcud3BiY19vcHRpb25fc2F2ZXJfbG9hZGVyX2NvbmZpZy5hamF4X3VybCxcclxuXHRcdFx0dHlwZTogJ0dFVCcsXHJcblx0XHRcdGRhdGE6IHtcblx0XHRcdFx0YWN0aW9uOiAgICB3LndwYmNfb3B0aW9uX3NhdmVyX2xvYWRlcl9jb25maWcuYWN0aW9uX2xvYWQsXG5cdFx0XHRcdG5vbmNlOiAgICAgdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLmxvYWRfbm9uY2UsXG5cdFx0XHRcdGRhdGFfbmFtZTogbmFtZVxuXHRcdFx0fVxyXG5cdFx0fSlcclxuXHRcdC5kb25lKGZ1bmN0aW9uIChyZXNwKSB7XHJcblx0XHRcdGlmIChyZXNwICYmIHJlc3Auc3VjY2Vzcykge1xyXG5cdFx0XHRcdGlmIChjYl9mbikge1xyXG5cdFx0XHRcdFx0dHJ5IHsgY2JfZm4ocmVzcC5kYXRhICYmIHJlc3AuZGF0YS52YWx1ZSk7IH0gY2F0Y2ggKGUpIHsgY29uc29sZS5lcnJvcihlKTsgfVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdXUEJDIHwgJyArIChyZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSA/IHJlc3AuZGF0YS5tZXNzYWdlIDogJ0xvYWQgZXJyb3InKSk7XHJcblx0XHRcdH1cclxuXHRcdFx0JChkb2N1bWVudCkudHJpZ2dlcignd3BiYzpvcHRpb246YWZ0ZXJMb2FkJywgWyByZXNwIF0pO1xyXG5cdFx0fSlcclxuXHRcdC5mYWlsKGZ1bmN0aW9uICh4aHIpIHtcclxuXHRcdFx0Y29uc29sZS5lcnJvcignV1BCQyB8IEFKQVggJyArIHhoci5zdGF0dXMgKyAnICcgKyB4aHIuc3RhdHVzVGV4dCk7XHJcblx0XHRcdCQoZG9jdW1lbnQpLnRyaWdnZXIoJ3dwYmM6b3B0aW9uOmFmdGVyTG9hZCcsIFsgeyBzdWNjZXNzOiBmYWxzZSwgZGF0YTogeyBtZXNzYWdlOiB4aHIuc3RhdHVzVGV4dCB9IH0gXSk7XHJcblx0XHR9KVxyXG5cdFx0LmFsd2F5cyhmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHdwYmNfdWl4X2J1c3lfb2ZmKCRlbCk7XHJcblx0XHR9KTtcclxuXHR9O1xyXG5cclxuXHR3cGJjX3VpeF9iaW5kX2F1dG9zYXZlX29uX2Zvcm1fc2F2ZSgpO1xyXG5cclxufSh3aW5kb3csIGpRdWVyeSkpO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQyxXQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLFNBQVNDLG9CQUFvQkEsQ0FBQ0MsQ0FBQyxFQUFFO0lBQ2hDLE9BQU9DLE1BQU0sQ0FBQ0QsQ0FBQyxDQUFDLENBQ2RFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQ3RCQSxPQUFPLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUNyQkEsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FDckJBLE9BQU8sQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQ3ZCQSxPQUFPLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQztFQUMxQjs7RUFFQTtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsU0FBU0MsMEJBQTBCQSxDQUFDQyxHQUFHLEVBQUVDLFNBQVMsRUFBRUMsUUFBUSxFQUFFO0lBQzdELElBQUlDLENBQUMsR0FBR0gsR0FBRyxDQUFDSSxJQUFJ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

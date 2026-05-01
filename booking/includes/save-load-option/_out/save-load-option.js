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
      nonce: $el.data('wpbc-u-save-nonce'),
      nonce_action: $el.data('wpbc-u-save-action'),
      data_name: $el.data('wpbc-u-save-name'),
      fields_raw: $el.data('wpbc-u-save-fields') || '',
      inline_value: wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value', 'wpbc-u-save-value'),
      json: wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value-json', 'wpbc-u-save-value-json'),
      save_mode: $el.data('wpbc-u-save-mode') || $el.attr('data-wpbc-u-save-mode') || '',
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
      nonce: cfg.nonce,
      nonce_action: cfg.nonce_action,
      data_name: cfg.data_name,
      payload: wpbc_uix_build_option_save_payload($el, cfg),
      save_mode: cfg.save_mode,
      fields_raw: cfg.fields_raw,
      dirty: !!is_dirty,
      el: el
    };
  }
  function wpbc_uix_save_autosave_registry_entry(entry) {
    if (!entry || !entry.dirty || !entry.nonce || !entry.nonce_action || !entry.data_name || entry.payload === null) {
      return;
    }
    $(document).trigger('wpbc:option:beforeSave', [$(), entry.payload]);
    $.ajax({
      url: w.wpbc_option_saver_loader_config.ajax_url,
      type: 'POST',
      data: {
        action: w.wpbc_option_saver_loader_config.action_save,
        nonce: entry.nonce,
        nonce_action: entry.nonce_action,
        data_name: entry.data_name,
        data_value: entry.payload,
        data_mode: entry.save_mode,
        data_fields: entry.save_mode === 'split' ? String(entry.fields_raw || '') : ''
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
   *     data-wpbc-u-save-nonce      — nonce value (required)
   *     data-wpbc-u-save-action     — nonce action (required)
   *     data-wpbc-u-save-value      — RAW scalar to save (optional)  (dynamic: read via attr first)
   *     data-wpbc-u-save-value-json — JSON string to save (optional) (dynamic: read via attr first)
   *     data-wpbc-u-save-fields     — CSV selectors; values serialized with jQuery.param (optional). Optional allowlist of keys for split mode (CSV).
   *     data-wpbc-u-save-mode       - Optional.: 'split' | ''  --  Optional: split JSON object into separate options server-side.
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

    // Static values can be read from .data().
    var nonce = $el.data('wpbc-u-save-nonce');
    var nonce_action = $el.data('wpbc-u-save-action');
    var data_name = $el.data('wpbc-u-save-name');

    // Dynamic values MUST prefer attribute read (fresh), fallback to .data().
    var fields_raw = $el.data('wpbc-u-save-fields') || '';
    var inline_value = wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value', 'wpbc-u-save-value');
    var json = wpbc_uix_read_attr_or_data($el, 'data-wpbc-u-save-value-json', 'wpbc-u-save-value-json');
    var save_mode = $el.data('wpbc-u-save-mode') || $el.attr('data-wpbc-u-save-mode') || '';

    // Optional: compute scalar from another control selector at click time.
    var value_from_selector = $el.data('wpbc-u-save-value-from') || $el.attr('data-wpbc-u-save-value-from');
    var cb_id = $el.data('wpbc-u-save-callback');
    var cb_fn = cb_id && typeof w[cb_id] === 'function' ? w[cb_id] : null;
    if (!nonce || !nonce_action || !data_name) {
      console.error('WPBC | missing nonce/action/name');
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
        nonce_action: nonce_action,
        data_name: data_name,
        data_value: payload,
        // Optional: split JSON object into separate options server-side.
        data_mode: save_mode,
        // Optional allowlist of keys for split mode (CSV).
        data_fields: save_mode === 'split' ? String(fields_raw || '') : ''
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
    if (!name) {
      console.error('WPBC | missing data-wpbc-u-load-name');
      return;
    }
    $(document).trigger('wpbc:option:beforeLoad', [$el, name]);
    wpbc_uix_busy_on($el);
    $.ajax({
      url: w.wpbc_option_saver_loader_config.ajax_url,
      type: 'GET',
      data: {
        action: w.wpbc_option_saver_loader_config.action_load,
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvc2F2ZS1sb2FkLW9wdGlvbi9fb3V0L3NhdmUtbG9hZC1vcHRpb24uanMiLCJuYW1lcyI6WyJ3IiwiJCIsIndwYmNfdWl4X2VzY2FwZV9odG1sIiwicyIsIlN0cmluZyIsInJlcGxhY2UiLCJ3cGJjX3VpeF9yZWFkX2F0dHJfb3JfZGF0YSIsIiRlbCIsImF0dHJfbmFtZSIsImRhdGFfa2V5IiwidiIsImF0dHIiLCJkYXRhIiwid3BiY191aXhfdG9fb25fb2ZmIiwidG9Mb3dlckNhc2UiLCJ3cGJjX3VpeF9nZXRfY29udHJvbF92YWx1ZSIsIiRjb250cm9sIiwibGVuZ3RoIiwiaXMiLCJuYW1lIiwiJGNoZWNrZWQiLCJ2YWwiLCJ3cGJjX3VpeF9idXN5X29uIiwiaHRtbCIsImJ1c3lfdGV4dCIsInNwaW5uZXIiLCJhcHBlbmQiLCJhZGRDbGFzcyIsInByb3AiLCJ3cGJjX3VpeF9idXN5X29mZiIsIm9yaWdpbmFsIiwicmVtb3ZlQ2xhc3MiLCJyZW1vdmVBdHRyIiwicmVtb3ZlRGF0YSIsIndwYmNfdWl4X2F1dG9zYXZlX3JlZ2lzdHJ5Iiwid3BiY191aXhfZ2V0X29wdGlvbl9zYXZlX2NvbmZpZyIsIm5vbmNlIiwibm9uY2VfYWN0aW9uIiwiZGF0YV9uYW1lIiwiZmllbGRzX3JhdyIsImlubGluZV92YWx1ZSIsImpzb24iLCJzYXZlX21vZGUiLCJ2YWx1ZV9mcm9tX3NlbGVjdG9yIiwid3BiY191aXhfYnVpbGRfb3B0aW9uX3NhdmVfcGF5bG9hZCIsImNmZyIsInRyaW0iLCIkc3JjIiwiZmluZCIsImZpcnN0IiwiZmllbGRzIiwic3BsaXQiLCJtYXAiLCJmaWx0ZXIiLCJCb29sZWFuIiwiZm9yRWFjaCIsInNlbCIsIiRmIiwia2V5IiwicGFyYW0iLCJ3cGJjX3VpeF91cGRhdGVfYXV0b3NhdmVfcmVnaXN0cnlfZnJvbV9lbGVtZW50IiwiZWwiLCJpc19kaXJ0eSIsInBheWxvYWQiLCJkaXJ0eSIsIndwYmNfdWl4X3NhdmVfYXV0b3NhdmVfcmVnaXN0cnlfZW50cnkiLCJlbnRyeSIsImRvY3VtZW50IiwidHJpZ2dlciIsImFqYXgiLCJ1cmwiLCJ3cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnIiwiYWpheF91cmwiLCJ0eXBlIiwiYWN0aW9uIiwiYWN0aW9uX3NhdmUiLCJkYXRhX3ZhbHVlIiwiZGF0YV9tb2RlIiwiZGF0YV9maWVsZHMiLCJkb25lIiwicmVzcCIsInN1Y2Nlc3MiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsIm1lc3NhZ2UiLCJmYWlsIiwieGhyIiwic3RhdHVzIiwic3RhdHVzVGV4dCIsIndwYmNfc2F2ZV9vcHRpb25fZnJvbV9lbGVtZW50IiwiY29uc29sZSIsImVycm9yIiwiY2JfaWQiLCJjYl9mbiIsImluZGV4T2YiLCJlIiwib2tfbWVzc2FnZSIsImVycl9tZXNzYWdlIiwiZmVlZGJhY2tfbWVzc2FnZSIsImFsd2F5cyIsIndwYmNfdWl4X2JpbmRfYXV0b3NhdmVfb25fZm9ybV9zYXZlIiwiYXV0b3NhdmVfc2VsZWN0b3IiLCJvbiIsImNoYW5nZWRfZWwiLCJlYWNoIiwiJGJ0biIsIndhdGNoX3NlbGVjdG9yIiwiJHdhdGNoZWQiLCJoYXMiLCJhZGRFdmVudExpc3RlbmVyIiwiZ2V0QXR0cmlidXRlIiwiT2JqZWN0Iiwia2V5cyIsIm9wdGlvbl9uYW1lIiwiZG9jdW1lbnRFbGVtZW50IiwiY29udGFpbnMiLCJ3cGJjX2xvYWRfb3B0aW9uX2Zyb21fZWxlbWVudCIsImFjdGlvbl9sb2FkIiwidmFsdWUiLCJ3aW5kb3ciLCJqUXVlcnkiXSwic291cmNlcyI6WyJpbmNsdWRlcy9zYXZlLWxvYWQtb3B0aW9uL19zcmMvc2F2ZS1sb2FkLW9wdGlvbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR2VuZXJhbCBPcHRpb24gTG9hZGVyL1NhdmVyIChjbGllbnQpXHJcbiAqXHJcbiAqIC0gUHJvdmlkZXM6XHJcbiAqICAgICB3aW5kb3cud3BiY19zYXZlX29wdGlvbl9mcm9tX2VsZW1lbnQoZWwpXHJcbiAqICAgICB3aW5kb3cud3BiY19sb2FkX29wdGlvbl9mcm9tX2VsZW1lbnQoZWwpXHJcbiAqIC0gQnVzeSBVSSAoc3Bpbm5lciArIGRpc2FibGVkKVxyXG4gKiAtIEpTT04gcGF0aDogc2VuZCByYXcgSlNPTiBzdHJpbmcgdW50b3VjaGVkLlxyXG4gKiAtIFJBVyBzY2FsYXIgcGF0aDogc2VuZCBhcy1pcy5cclxuICogLSBGaWVsZHMgcGF0aDogc2VyaWFsaXplIHRvIHF1ZXJ5LXN0cmluZyB2aWEgalF1ZXJ5LnBhcmFtLlxyXG4gKlxyXG4gKiBJTVBPUlRBTlQ6XHJcbiAqIC0galF1ZXJ5IC5kYXRhKCkgaXMgY2FjaGVkLiBJZiBzb21lIGNvZGUgdXBkYXRlcyBkYXRhLSogYXR0cmlidXRlcyB2aWEgc2V0QXR0cmlidXRlKCksXHJcbiAqICAgcmVhZGluZyB2aWEgJGVsLmRhdGEoLi4uKSBjYW4gcmV0dXJuIHN0YWxlIHZhbHVlcy5cclxuICogLSBUaGVyZWZvcmUsIHRoaXMgbW9kdWxlIHByZWZlcnMgcmVhZGluZyB2aWEgJGVsLmF0dHIoJ2RhdGEtLi4uJykgZm9yIGR5bmFtaWMga2V5c1xyXG4gKiAgICh2YWx1ZS92YWx1ZS1qc29uKSwgYW5kIGZhbGxzIGJhY2sgdG8gJGVsLmRhdGEoLi4uKSB3aGVuIGF0dHJpYnV0ZSBpcyBtaXNzaW5nLlxyXG4gKlxyXG4gKiBmaWxlOiAuLi9pbmNsdWRlcy9zYXZlLWxvYWQtb3B0aW9uL19vdXQvc2F2ZS1sb2FkLW9wdGlvbi5qc1xyXG4gKlxyXG4gKiBFdmVudHM6XHJcbiAqICAgJChkb2N1bWVudCkub24oJ3dwYmM6b3B0aW9uOmJlZm9yZVNhdmUnLCAoZSwgJGVsLCBwYXlsb2FkKSA9PiB7fSlcclxuICogICAkKGRvY3VtZW50KS5vbignd3BiYzpvcHRpb246YWZ0ZXJTYXZlJywgIChlLCByZXNwb25zZSkgPT4ge30pXHJcbiAqICAgJChkb2N1bWVudCkub24oJ3dwYmM6b3B0aW9uOmJlZm9yZUxvYWQnLCAoZSwgJGVsLCBuYW1lKSA9PiB7fSlcclxuICogICAkKGRvY3VtZW50KS5vbignd3BiYzpvcHRpb246YWZ0ZXJMb2FkJywgIChlLCByZXNwb25zZSkgPT4ge30pXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsICQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVzY2FwZSBmb3Igc2FmZSBIVE1MIGluamVjdGlvbiAoc21hbGwgaGVscGVyKS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9lc2NhcGVfaHRtbChzKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKHMpXHJcblx0XHRcdC5yZXBsYWNlKC8mL2csICcmYW1wOycpXHJcblx0XHRcdC5yZXBsYWNlKC88L2csICcmbHQ7JylcclxuXHRcdFx0LnJlcGxhY2UoLz4vZywgJyZndDsnKVxyXG5cdFx0XHQucmVwbGFjZSgvXCIvZywgJyZxdW90OycpXHJcblx0XHRcdC5yZXBsYWNlKC8nL2csICcmIzAzOTsnKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlYWQgYSB2YWx1ZSBmcm9tIGRhdGEtKiBhdHRyaWJ1dGUgZmlyc3QgKGZyZXNoKSwgdGhlbiBmYWxsYmFjayB0byBqUXVlcnkgLmRhdGEoKSBjYWNoZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7alF1ZXJ5fSAkZWxcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYXR0cl9uYW1lICAgICAgRXhhbXBsZTogJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGRhdGFfa2V5ICAgICAgIEV4YW1wbGU6ICd3cGJjLXUtc2F2ZS12YWx1ZSdcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9yZWFkX2F0dHJfb3JfZGF0YSgkZWwsIGF0dHJfbmFtZSwgZGF0YV9rZXkpIHtcclxuXHRcdHZhciB2ID0gJGVsLmF0dHIoYXR0cl9uYW1lKTtcclxuXHRcdGlmICh0eXBlb2YgdiAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuXHRcdFx0cmV0dXJuIHY7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gJGVsLmRhdGEoZGF0YV9rZXkpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVHVybiBcIk9uXCIvXCJPZmZcIiBsaWtlIHZhbHVlcyBpbnRvIGNvbnNpc3RlbnQgXCJPblwiL1wiT2ZmXCIuXHJcblx0ICogKFVzZWQgZm9yIGNoZWNrYm94L3RvZ2dsZSBzZXJpYWxpemF0aW9uLilcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7Kn0gdlxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY191aXhfdG9fb25fb2ZmKHYpIHtcclxuXHRcdGlmICh2ID09PSB0cnVlKSB7IHJldHVybiAnT24nOyB9XHJcblx0XHRpZiAodiA9PT0gZmFsc2UpIHsgcmV0dXJuICdPZmYnOyB9XHJcblx0XHR2YXIgcyA9IFN0cmluZyh2IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0aWYgKHMgPT09ICdvbicgfHwgcyA9PT0gJzEnIHx8IHMgPT09ICd0cnVlJyB8fCBzID09PSAneWVzJykgeyByZXR1cm4gJ09uJzsgfVxyXG5cdFx0cmV0dXJuICdPZmYnO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGEgdXNlZnVsIHZhbHVlIGZyb20gYW4gaW5wdXQvc2VsZWN0L3RleHRhcmVhIGVsZW1lbnQuXHJcblx0ICogLSBjaGVja2JveCA9PiAnT24nLydPZmYnXHJcblx0ICogLSByYWRpbyAgICA9PiB2YWx1ZSBvZiBjaGVja2VkIGluIGdyb3VwIChpZiBwb3NzaWJsZSksIGVsc2UgJydcclxuXHQgKiAtIG90aGVycyAgID0+IC52YWwoKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtqUXVlcnl9ICRjb250cm9sXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9nZXRfY29udHJvbF92YWx1ZSgkY29udHJvbCkge1xyXG5cclxuXHRcdGlmICghJGNvbnRyb2wgfHwgISRjb250cm9sLmxlbmd0aCkge1xyXG5cdFx0XHRyZXR1cm4gJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gY2hlY2tib3gvdG9nZ2xlLlxyXG5cdFx0aWYgKCRjb250cm9sLmlzKCc6Y2hlY2tib3gnKSkge1xyXG5cdFx0XHRyZXR1cm4gJGNvbnRyb2wuaXMoJzpjaGVja2VkJykgPyAnT24nIDogJ09mZic7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gcmFkaW8gZ3JvdXAuXHJcblx0XHRpZiAoJGNvbnRyb2wuaXMoJzpyYWRpbycpKSB7XHJcblx0XHRcdHZhciBuYW1lID0gJGNvbnRyb2wuYXR0cignbmFtZScpO1xyXG5cdFx0XHRpZiAobmFtZSkge1xyXG5cdFx0XHRcdHZhciAkY2hlY2tlZCA9ICQoJ2lucHV0W3R5cGU9XCJyYWRpb1wiXVtuYW1lPVwiJyArIG5hbWUgKyAnXCJdOmNoZWNrZWQnKTtcclxuXHRcdFx0XHRyZXR1cm4gJGNoZWNrZWQubGVuZ3RoID8gU3RyaW5nKCRjaGVja2VkLnZhbCgpKSA6ICcnO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiAkY29udHJvbC5pcygnOmNoZWNrZWQnKSA/IFN0cmluZygkY29udHJvbC52YWwoKSkgOiAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBzZWxlY3QvdGV4dC90ZXh0YXJlYS9ldGMuXHJcblx0XHRyZXR1cm4gU3RyaW5nKCRjb250cm9sLnZhbCgpID09IG51bGwgPyAnJyA6ICRjb250cm9sLnZhbCgpKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJ1c3kgT04gVUkgZm9yIGEgY2xpY2thYmxlIGVsZW1lbnQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJGVsXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY191aXhfYnVzeV9vbigkZWwpIHtcclxuXHRcdGlmICghJGVsIHx8ICEkZWwubGVuZ3RoIHx8ICRlbC5kYXRhKCd3cGJjLXVpeC1idXN5JykpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRlbC5kYXRhKCd3cGJjLXVpeC1idXN5JywgMSk7XHJcblx0XHQkZWwuZGF0YSgnd3BiYy11aXgtb3JpZ2luYWwtaHRtbCcsICRlbC5odG1sKCkpO1xyXG5cclxuXHRcdHZhciBidXN5X3RleHQgPSAkZWwuZGF0YSgnd3BiYy11LWJ1c3ktdGV4dCcpO1xyXG5cdFx0dmFyIHNwaW5uZXIgPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluIHdwYmNfYWpheF9pY29uIHdwYmNfcHJvY2Vzc2luZyB3cGJjX2ljbl9hdXRvcmVuZXdcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L3NwYW4+JztcclxuXHJcblx0XHRpZiAodHlwZW9mIGJ1c3lfdGV4dCA9PT0gJ3N0cmluZycgJiYgYnVzeV90ZXh0Lmxlbmd0aCkge1xyXG5cdFx0XHQkZWwuaHRtbCh3cGJjX3VpeF9lc2NhcGVfaHRtbChidXN5X3RleHQpICsgJyAnICsgc3Bpbm5lcik7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHQkZWwuYXBwZW5kKHNwaW5uZXIpO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRlbC5hZGRDbGFzcygnd3BiYy1pcy1idXN5JylcclxuXHRcdFx0LmF0dHIoJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScpXHJcblx0XHRcdC5wcm9wKCdkaXNhYmxlZCcsIHRydWUpO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQnVzeSBPRkYgVUkgZm9yIGEgY2xpY2thYmxlIGVsZW1lbnQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2pRdWVyeX0gJGVsXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY191aXhfYnVzeV9vZmYoJGVsKSB7XHJcblx0XHRpZiAoISRlbCB8fCAhJGVsLmxlbmd0aCB8fCAhJGVsLmRhdGEoJ3dwYmMtdWl4LWJ1c3knKSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG9yaWdpbmFsID0gJGVsLmRhdGEoJ3dwYmMtdWl4LW9yaWdpbmFsLWh0bWwnKTtcclxuXHRcdGlmICh0eXBlb2Ygb3JpZ2luYWwgPT09ICdzdHJpbmcnKSB7XHJcblx0XHRcdCRlbC5odG1sKG9yaWdpbmFsKTtcclxuXHRcdH1cclxuXHJcblx0XHQkZWwucmVtb3ZlQ2xhc3MoJ3dwYmMtaXMtYnVzeScpXHJcblx0XHRcdC5yZW1vdmVBdHRyKCdhcmlhLWRpc2FibGVkJylcclxuXHRcdFx0LnByb3AoJ2Rpc2FibGVkJywgZmFsc2UpO1xyXG5cclxuXHRcdCRlbC5yZW1vdmVEYXRhKCd3cGJjLXVpeC1idXN5JylcclxuXHRcdFx0LnJlbW92ZURhdGEoJ3dwYmMtdWl4LW9yaWdpbmFsLWh0bWwnKTtcclxuXHR9XHJcblxyXG5cdHZhciB3cGJjX3VpeF9hdXRvc2F2ZV9yZWdpc3RyeSA9IHt9O1xyXG5cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9nZXRfb3B0aW9uX3NhdmVfY29uZmlnKCRlbCkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0bm9uY2UgICAgICAgICAgICAgIDogJGVsLmRhdGEoJ3dwYmMtdS1zYXZlLW5vbmNlJyksXHJcblx0XHRcdG5vbmNlX2FjdGlvbiAgICAgICA6ICRlbC5kYXRhKCd3cGJjLXUtc2F2ZS1hY3Rpb24nKSxcclxuXHRcdFx0ZGF0YV9uYW1lICAgICAgICAgIDogJGVsLmRhdGEoJ3dwYmMtdS1zYXZlLW5hbWUnKSxcclxuXHRcdFx0ZmllbGRzX3JhdyAgICAgICAgIDogJGVsLmRhdGEoJ3dwYmMtdS1zYXZlLWZpZWxkcycpIHx8ICcnLFxyXG5cdFx0XHRpbmxpbmVfdmFsdWUgICAgICAgOiB3cGJjX3VpeF9yZWFkX2F0dHJfb3JfZGF0YSgkZWwsICdkYXRhLXdwYmMtdS1zYXZlLXZhbHVlJywgJ3dwYmMtdS1zYXZlLXZhbHVlJyksXHJcblx0XHRcdGpzb24gICAgICAgICAgICAgICA6IHdwYmNfdWl4X3JlYWRfYXR0cl9vcl9kYXRhKCRlbCwgJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUtanNvbicsICd3cGJjLXUtc2F2ZS12YWx1ZS1qc29uJyksXHJcblx0XHRcdHNhdmVfbW9kZSAgICAgICAgICA6ICRlbC5kYXRhKCd3cGJjLXUtc2F2ZS1tb2RlJykgfHwgJGVsLmF0dHIoJ2RhdGEtd3BiYy11LXNhdmUtbW9kZScpIHx8ICcnLFxyXG5cdFx0XHR2YWx1ZV9mcm9tX3NlbGVjdG9yOiAkZWwuZGF0YSgnd3BiYy11LXNhdmUtdmFsdWUtZnJvbScpIHx8ICRlbC5hdHRyKCdkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWZyb20nKVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfdWl4X2J1aWxkX29wdGlvbl9zYXZlX3BheWxvYWQoJGVsLCBjZmcpIHtcclxuXHRcdGNmZyA9IGNmZyB8fCB3cGJjX3VpeF9nZXRfb3B0aW9uX3NhdmVfY29uZmlnKCRlbCk7XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBjZmcuanNvbiA9PT0gJ3N0cmluZycgJiYgY2ZnLmpzb24udHJpbSgpICE9PSAnJykge1xyXG5cdFx0XHRyZXR1cm4gY2ZnLmpzb24udHJpbSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChjZmcudmFsdWVfZnJvbV9zZWxlY3Rvcikge1xyXG5cdFx0XHR2YXIgJHNyYyA9ICQoY2ZnLnZhbHVlX2Zyb21fc2VsZWN0b3IpO1xyXG5cdFx0XHR2YXIgJGNvbnRyb2wgPSAkc3JjLmlzKCdpbnB1dCxzZWxlY3QsdGV4dGFyZWEnKSA/ICRzcmMgOiAkc3JjLmZpbmQoJ2lucHV0LHNlbGVjdCx0ZXh0YXJlYScpLmZpcnN0KCk7XHJcblx0XHRcdHJldHVybiB3cGJjX3VpeF9nZXRfY29udHJvbF92YWx1ZSgkY29udHJvbCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKHR5cGVvZiBjZmcuaW5saW5lX3ZhbHVlICE9PSAndW5kZWZpbmVkJyAmJiBjZmcuaW5saW5lX3ZhbHVlICE9PSBudWxsKSB7XHJcblx0XHRcdHJldHVybiBTdHJpbmcoY2ZnLmlubGluZV92YWx1ZSk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGNmZy5maWVsZHNfcmF3KSB7XHJcblx0XHRcdHZhciBmaWVsZHMgPSBTdHJpbmcoY2ZnLmZpZWxkc19yYXcpLnNwbGl0KCcsJylcclxuXHRcdFx0XHQubWFwKGZ1bmN0aW9uIChzKSB7IHJldHVybiBTdHJpbmcocyB8fCAnJykudHJpbSgpOyB9KVxyXG5cdFx0XHRcdC5maWx0ZXIoQm9vbGVhbik7XHJcblxyXG5cdFx0XHR2YXIgZGF0YSA9IHt9O1xyXG5cclxuXHRcdFx0ZmllbGRzLmZvckVhY2goZnVuY3Rpb24gKHNlbCkge1xyXG5cdFx0XHRcdHZhciAkZiA9ICQoc2VsKTtcclxuXHRcdFx0XHRpZiAoISRmLmxlbmd0aCkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0dmFyICRjb250cm9sID0gJGYuaXMoJ2lucHV0LHNlbGVjdCx0ZXh0YXJlYScpID8gJGYgOiAkZi5maW5kKCdpbnB1dCxzZWxlY3QsdGV4dGFyZWEnKS5maXJzdCgpO1xyXG5cdFx0XHRcdGlmICghJGNvbnRyb2wubGVuZ3RoKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHR2YXIga2V5ID0gJGNvbnRyb2wuYXR0cignbmFtZScpIHx8ICRjb250cm9sLmF0dHIoJ2lkJyk7XHJcblx0XHRcdFx0aWYgKCFrZXkpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdGRhdGFba2V5XSA9IHdwYmNfdWl4X2dldF9jb250cm9sX3ZhbHVlKCRjb250cm9sKTtcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gJC5wYXJhbShkYXRhKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfdWl4X3VwZGF0ZV9hdXRvc2F2ZV9yZWdpc3RyeV9mcm9tX2VsZW1lbnQoZWwsIGlzX2RpcnR5KSB7XHJcblx0XHR2YXIgJGVsID0gJChlbCk7XHJcblx0XHR2YXIgY2ZnID0gd3BiY191aXhfZ2V0X29wdGlvbl9zYXZlX2NvbmZpZygkZWwpO1xyXG5cclxuXHRcdGlmICghY2ZnLmRhdGFfbmFtZSkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY191aXhfYXV0b3NhdmVfcmVnaXN0cnlbY2ZnLmRhdGFfbmFtZV0gPSB7XHJcblx0XHRcdG5vbmNlICAgICAgIDogY2ZnLm5vbmNlLFxyXG5cdFx0XHRub25jZV9hY3Rpb246IGNmZy5ub25jZV9hY3Rpb24sXHJcblx0XHRcdGRhdGFfbmFtZSAgIDogY2ZnLmRhdGFfbmFtZSxcclxuXHRcdFx0cGF5bG9hZCAgICAgOiB3cGJjX3VpeF9idWlsZF9vcHRpb25fc2F2ZV9wYXlsb2FkKCRlbCwgY2ZnKSxcclxuXHRcdFx0c2F2ZV9tb2RlICAgOiBjZmcuc2F2ZV9tb2RlLFxyXG5cdFx0XHRmaWVsZHNfcmF3ICA6IGNmZy5maWVsZHNfcmF3LFxyXG5cdFx0XHRkaXJ0eSAgICAgICA6ICEhaXNfZGlydHksXHJcblx0XHRcdGVsICAgICAgICAgIDogZWxcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9zYXZlX2F1dG9zYXZlX3JlZ2lzdHJ5X2VudHJ5KGVudHJ5KSB7XHJcblx0XHRpZiAoIWVudHJ5IHx8ICFlbnRyeS5kaXJ0eSB8fCAhZW50cnkubm9uY2UgfHwgIWVudHJ5Lm5vbmNlX2FjdGlvbiB8fCAhZW50cnkuZGF0YV9uYW1lIHx8IGVudHJ5LnBheWxvYWQgPT09IG51bGwpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCQoZG9jdW1lbnQpLnRyaWdnZXIoJ3dwYmM6b3B0aW9uOmJlZm9yZVNhdmUnLCBbICQoKSwgZW50cnkucGF5bG9hZCBdKTtcclxuXHJcblx0XHQkLmFqYXgoe1xyXG5cdFx0XHR1cmw6ICB3LndwYmNfb3B0aW9uX3NhdmVyX2xvYWRlcl9jb25maWcuYWpheF91cmwsXHJcblx0XHRcdHR5cGU6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YToge1xyXG5cdFx0XHRcdGFjdGlvbjogICAgICAgdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLmFjdGlvbl9zYXZlLFxyXG5cdFx0XHRcdG5vbmNlOiAgICAgICAgZW50cnkubm9uY2UsXHJcblx0XHRcdFx0bm9uY2VfYWN0aW9uOiBlbnRyeS5ub25jZV9hY3Rpb24sXHJcblx0XHRcdFx0ZGF0YV9uYW1lOiAgICBlbnRyeS5kYXRhX25hbWUsXHJcblx0XHRcdFx0ZGF0YV92YWx1ZTogICBlbnRyeS5wYXlsb2FkLFxyXG5cdFx0XHRcdGRhdGFfbW9kZTogICAgZW50cnkuc2F2ZV9tb2RlLFxyXG5cdFx0XHRcdGRhdGFfZmllbGRzOiAgKGVudHJ5LnNhdmVfbW9kZSA9PT0gJ3NwbGl0JyA/IFN0cmluZyhlbnRyeS5maWVsZHNfcmF3IHx8ICcnKSA6ICcnKVxyXG5cdFx0XHR9XHJcblx0XHR9KVxyXG5cdFx0LmRvbmUoZnVuY3Rpb24gKHJlc3ApIHtcclxuXHRcdFx0aWYgKHJlc3AgJiYgcmVzcC5zdWNjZXNzKSB7XHJcblx0XHRcdFx0ZW50cnkuZGlydHkgPSBmYWxzZTtcclxuXHRcdFx0XHRpZiAoZW50cnkuZWwpIHtcclxuXHRcdFx0XHRcdCQoZW50cnkuZWwpLmF0dHIoJ2RhdGEtd3BiYy11LWF1dG9zYXZlLWRpcnR5JywgJzAnKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKChyZXNwLmRhdGEgJiYgcmVzcC5kYXRhLm1lc3NhZ2UpID8gcmVzcC5kYXRhLm1lc3NhZ2UgOiAnU2F2ZWQnLCAnc3VjY2VzcycsIDEwMDAsIGZhbHNlKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKChyZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSkgPyByZXNwLmRhdGEubWVzc2FnZSA6ICdTYXZlIGVycm9yJywgJ2Vycm9yJywgMzAwMDApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkKGRvY3VtZW50KS50cmlnZ2VyKCd3cGJjOm9wdGlvbjphZnRlclNhdmUnLCBbIHJlc3AgXSk7XHJcblx0XHR9KVxyXG5cdFx0LmZhaWwoZnVuY3Rpb24gKHhocikge1xyXG5cdFx0XHRpZiAodHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCdXUEJDIHwgQUpBWCAnICsgeGhyLnN0YXR1cyArICcgJyArIHhoci5zdGF0dXNUZXh0LCAnZXJyb3InLCAzMDAwMCk7XHJcblx0XHRcdH1cclxuXHRcdFx0JChkb2N1bWVudCkudHJpZ2dlcignd3BiYzpvcHRpb246YWZ0ZXJTYXZlJywgWyB7IHN1Y2Nlc3M6IGZhbHNlLCBkYXRhOiB7IG1lc3NhZ2U6IHhoci5zdGF0dXNUZXh0IH0gfSBdKTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2F2ZSBPcHRpb24gLSBzZW5kIGFqYXggcmVxdWVzdCB0byBzYXZlIGRhdGEuXHJcblx0ICpcclxuXHQgKiBEYXRhIGF0dHJpYnV0ZXM6XHJcblx0ICogICAgIGRhdGEtd3BiYy11LXNhdmUtbmFtZSAgICAgICDigJQgb3B0aW9uIGtleSAocmVxdWlyZWQpXHJcblx0ICogICAgIGRhdGEtd3BiYy11LXNhdmUtbm9uY2UgICAgICDigJQgbm9uY2UgdmFsdWUgKHJlcXVpcmVkKVxyXG5cdCAqICAgICBkYXRhLXdwYmMtdS1zYXZlLWFjdGlvbiAgICAg4oCUIG5vbmNlIGFjdGlvbiAocmVxdWlyZWQpXHJcblx0ICogICAgIGRhdGEtd3BiYy11LXNhdmUtdmFsdWUgICAgICDigJQgUkFXIHNjYWxhciB0byBzYXZlIChvcHRpb25hbCkgIChkeW5hbWljOiByZWFkIHZpYSBhdHRyIGZpcnN0KVxyXG5cdCAqICAgICBkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWpzb24g4oCUIEpTT04gc3RyaW5nIHRvIHNhdmUgKG9wdGlvbmFsKSAoZHluYW1pYzogcmVhZCB2aWEgYXR0ciBmaXJzdClcclxuXHQgKiAgICAgZGF0YS13cGJjLXUtc2F2ZS1maWVsZHMgICAgIOKAlCBDU1Ygc2VsZWN0b3JzOyB2YWx1ZXMgc2VyaWFsaXplZCB3aXRoIGpRdWVyeS5wYXJhbSAob3B0aW9uYWwpLiBPcHRpb25hbCBhbGxvd2xpc3Qgb2Yga2V5cyBmb3Igc3BsaXQgbW9kZSAoQ1NWKS5cclxuXHQgKiAgICAgZGF0YS13cGJjLXUtc2F2ZS1tb2RlICAgICAgIC0gT3B0aW9uYWwuOiAnc3BsaXQnIHwgJycgIC0tICBPcHRpb25hbDogc3BsaXQgSlNPTiBvYmplY3QgaW50byBzZXBhcmF0ZSBvcHRpb25zIHNlcnZlci1zaWRlLlxyXG5cdCAqICAgICBkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWZyb20g4oCUIE9QVElPTkFMIHNlbGVjdG9yIHRvIHJlYWQgc2NhbGFyIGZyb20gKGNoZWNrYm94ID0+IE9uL09mZilcclxuXHQgKiAgICAgZGF0YS13cGJjLXUtYnVzeS10ZXh0ICAgICAgIOKAlCBjdXN0b20gdGV4dCBkdXJpbmcgQUpBWCAob3B0aW9uYWwpXHJcblx0ICogICAgIGRhdGEtd3BiYy11LXNhdmUtY2FsbGJhY2sgICDigJQgd2luZG93IGZ1bmN0aW9uIG5hbWUgdG8gY2FsbCBvbiBzdWNjZXNzIChvcHRpb25hbClcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsIGVsZW1lbnQgd2l0aCBkYXRhIGF0dHJpYnV0ZXMuXHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0dy53cGJjX3NhdmVfb3B0aW9uX2Zyb21fZWxlbWVudCA9IGZ1bmN0aW9uIChlbCkge1xyXG5cclxuXHRcdGlmICghdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnKSB7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1dQQkMgfCBjb25maWcgbWlzc2luZycpO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyICRlbCA9ICQoZWwpO1xyXG5cclxuXHRcdC8vIFN0YXRpYyB2YWx1ZXMgY2FuIGJlIHJlYWQgZnJvbSAuZGF0YSgpLlxyXG5cdFx0dmFyIG5vbmNlICAgICAgICA9ICRlbC5kYXRhKCd3cGJjLXUtc2F2ZS1ub25jZScpO1xyXG5cdFx0dmFyIG5vbmNlX2FjdGlvbiA9ICRlbC5kYXRhKCd3cGJjLXUtc2F2ZS1hY3Rpb24nKTtcclxuXHRcdHZhciBkYXRhX25hbWUgICAgPSAkZWwuZGF0YSgnd3BiYy11LXNhdmUtbmFtZScpO1xyXG5cclxuXHRcdC8vIER5bmFtaWMgdmFsdWVzIE1VU1QgcHJlZmVyIGF0dHJpYnV0ZSByZWFkIChmcmVzaCksIGZhbGxiYWNrIHRvIC5kYXRhKCkuXHJcblx0XHR2YXIgZmllbGRzX3JhdyAgID0gJGVsLmRhdGEoJ3dwYmMtdS1zYXZlLWZpZWxkcycpIHx8ICcnO1xyXG5cdFx0dmFyIGlubGluZV92YWx1ZSA9IHdwYmNfdWl4X3JlYWRfYXR0cl9vcl9kYXRhKCRlbCwgJ2RhdGEtd3BiYy11LXNhdmUtdmFsdWUnLCAnd3BiYy11LXNhdmUtdmFsdWUnKTtcclxuXHRcdHZhciBqc29uICAgICAgICAgPSB3cGJjX3VpeF9yZWFkX2F0dHJfb3JfZGF0YSgkZWwsICdkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWpzb24nLCAnd3BiYy11LXNhdmUtdmFsdWUtanNvbicpO1xyXG5cdFx0dmFyIHNhdmVfbW9kZSAgICA9ICRlbC5kYXRhKCd3cGJjLXUtc2F2ZS1tb2RlJykgfHwgJGVsLmF0dHIoJ2RhdGEtd3BiYy11LXNhdmUtbW9kZScpIHx8ICcnO1xyXG5cclxuXHRcdC8vIE9wdGlvbmFsOiBjb21wdXRlIHNjYWxhciBmcm9tIGFub3RoZXIgY29udHJvbCBzZWxlY3RvciBhdCBjbGljayB0aW1lLlxyXG5cdFx0dmFyIHZhbHVlX2Zyb21fc2VsZWN0b3IgPSAkZWwuZGF0YSgnd3BiYy11LXNhdmUtdmFsdWUtZnJvbScpIHx8ICRlbC5hdHRyKCdkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWZyb20nKTtcclxuXHJcblx0XHR2YXIgY2JfaWQgPSAkZWwuZGF0YSgnd3BiYy11LXNhdmUtY2FsbGJhY2snKTtcclxuXHRcdHZhciBjYl9mbiA9IChjYl9pZCAmJiB0eXBlb2Ygd1tjYl9pZF0gPT09ICdmdW5jdGlvbicpID8gd1tjYl9pZF0gOiBudWxsO1xyXG5cclxuXHRcdGlmICghbm9uY2UgfHwgIW5vbmNlX2FjdGlvbiB8fCAhZGF0YV9uYW1lKSB7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1dQQkMgfCBtaXNzaW5nIG5vbmNlL2FjdGlvbi9uYW1lJyk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcGF5bG9hZCA9ICcnO1xyXG5cclxuXHRcdC8vIDEpIEpTT04gcGF0aC5cclxuXHRcdGlmICh0eXBlb2YganNvbiA9PT0gJ3N0cmluZycgJiYganNvbi50cmltKCkgIT09ICcnKSB7XHJcblx0XHRcdHBheWxvYWQgPSBqc29uLnRyaW0oKTtcclxuXHRcdH1cclxuXHRcdC8vIDIpIFNjYWxhciBjb21wdXRlZCBmcm9tIHNlbGVjdG9yIChjaGVja2JveCA9PiBPbi9PZmYpLlxyXG5cdFx0ZWxzZSBpZiAodmFsdWVfZnJvbV9zZWxlY3Rvcikge1xyXG5cdFx0XHR2YXIgJHNyYyA9ICQodmFsdWVfZnJvbV9zZWxlY3Rvcik7XHJcblx0XHRcdHZhciAkY29udHJvbCA9ICRzcmMuaXMoJ2lucHV0LHNlbGVjdCx0ZXh0YXJlYScpID8gJHNyYyA6ICRzcmMuZmluZCgnaW5wdXQsc2VsZWN0LHRleHRhcmVhJykuZmlyc3QoKTtcclxuXHRcdFx0cGF5bG9hZCA9IHdwYmNfdWl4X2dldF9jb250cm9sX3ZhbHVlKCRjb250cm9sKTtcclxuXHRcdH1cclxuXHRcdC8vIDMpIFJBVyBzY2FsYXIgcGF0aC5cclxuXHRcdGVsc2UgaWYgKHR5cGVvZiBpbmxpbmVfdmFsdWUgIT09ICd1bmRlZmluZWQnICYmIGlubGluZV92YWx1ZSAhPT0gbnVsbCkge1xyXG5cdFx0XHRwYXlsb2FkID0gU3RyaW5nKGlubGluZV92YWx1ZSk7XHJcblx0XHR9XHJcblx0XHQvLyA0KSBGaWVsZHMgcGF0aCAocXVlcnktc3RyaW5nKS5cclxuXHRcdGVsc2UgaWYgKGZpZWxkc19yYXcpIHtcclxuXHJcblx0XHRcdHZhciBmaWVsZHMgPSBTdHJpbmcoZmllbGRzX3Jhdykuc3BsaXQoJywnKVxyXG5cdFx0XHRcdC5tYXAoZnVuY3Rpb24gKHMpIHsgcmV0dXJuIFN0cmluZyhzIHx8ICcnKS50cmltKCk7IH0pXHJcblx0XHRcdFx0LmZpbHRlcihCb29sZWFuKTtcclxuXHJcblx0XHRcdHZhciBkYXRhID0ge307XHJcblxyXG5cdFx0XHRmaWVsZHMuZm9yRWFjaChmdW5jdGlvbiAoc2VsKSB7XHJcblx0XHRcdFx0dmFyICRmID0gJChzZWwpO1xyXG5cdFx0XHRcdGlmICghJGYubGVuZ3RoKSB7IHJldHVybjsgfVxyXG5cclxuXHRcdFx0XHQvLyBJZiBzZWxlY3RvciBwb2ludHMgdG8gYSB3cmFwcGVyLCB0cnkgdG8gbG9jYXRlIGEgcmVhbCBjb250cm9sIGluc2lkZS5cclxuXHRcdFx0XHR2YXIgJGNvbnRyb2wgPSAkZi5pcygnaW5wdXQsc2VsZWN0LHRleHRhcmVhJykgPyAkZiA6ICRmLmZpbmQoJ2lucHV0LHNlbGVjdCx0ZXh0YXJlYScpLmZpcnN0KCk7XHJcblx0XHRcdFx0aWYgKCEkY29udHJvbC5sZW5ndGgpIHsgcmV0dXJuOyB9XHJcblxyXG5cdFx0XHRcdHZhciBrZXkgPSAkY29udHJvbC5hdHRyKCduYW1lJykgfHwgJGNvbnRyb2wuYXR0cignaWQnKTtcclxuXHRcdFx0XHRpZiAoIWtleSkgeyByZXR1cm47IH1cclxuXHJcblx0XHRcdFx0ZGF0YVtrZXldID0gd3BiY191aXhfZ2V0X2NvbnRyb2xfdmFsdWUoJGNvbnRyb2wpO1xyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHBheWxvYWQgPSAkLnBhcmFtKGRhdGEpO1xyXG5cdFx0fVxyXG5cdFx0ZWxzZSB7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1dQQkMgfCBwcm92aWRlIHZhbHVlLCB2YWx1ZS1mcm9tIHNlbGVjdG9yLCBqc29uLCBvciBmaWVsZHMnKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFN5bmMgalF1ZXJ5IGNhY2hlIGZvciB0aGUgc2NhbGFyIHZhbHVlIChoZWxwcyBvdGhlciBjb2RlIHRoYXQgc3RpbGwgcmVhZHMgLmRhdGEoKSkuXHJcblx0XHQvLyBJZiBwYXlsb2FkIGxvb2tzIGxpa2UgYSBzaW1wbGUgc2NhbGFyIChub3QgSlNPTiwgbm90IHF1ZXJ5LXN0cmluZyksIGtlZXAgaXQgYWxpZ25lZC5cclxuXHRcdGlmICh0eXBlb2YgcGF5bG9hZCA9PT0gJ3N0cmluZycgJiYgcGF5bG9hZC5pbmRleE9mKCc9JykgPT09IC0xICYmIHBheWxvYWQuaW5kZXhPZignJicpID09PSAtMSkge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdCRlbC5kYXRhKCd3cGJjLXUtc2F2ZS12YWx1ZScsIHBheWxvYWQpO1xyXG5cdFx0XHR9IGNhdGNoIChlKSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdCQoZG9jdW1lbnQpLnRyaWdnZXIoJ3dwYmM6b3B0aW9uOmJlZm9yZVNhdmUnLCBbICRlbCwgcGF5bG9hZCBdKTtcclxuXHRcdHdwYmNfdWl4X2J1c3lfb24oJGVsKTtcclxuXHJcblx0XHQkLmFqYXgoe1xyXG5cdFx0XHR1cmw6ICB3LndwYmNfb3B0aW9uX3NhdmVyX2xvYWRlcl9jb25maWcuYWpheF91cmwsXHJcblx0XHRcdHR5cGU6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YToge1xyXG5cdFx0XHRcdGFjdGlvbjogICAgICAgdy53cGJjX29wdGlvbl9zYXZlcl9sb2FkZXJfY29uZmlnLmFjdGlvbl9zYXZlLFxyXG5cdFx0XHRcdG5vbmNlOiAgICAgICAgbm9uY2UsXHJcblx0XHRcdFx0bm9uY2VfYWN0aW9uOiBub25jZV9hY3Rpb24sXHJcblx0XHRcdFx0ZGF0YV9uYW1lOiAgICBkYXRhX25hbWUsXHJcblx0XHRcdFx0ZGF0YV92YWx1ZTogICBwYXlsb2FkLFxyXG5cclxuXHRcdFx0XHQvLyBPcHRpb25hbDogc3BsaXQgSlNPTiBvYmplY3QgaW50byBzZXBhcmF0ZSBvcHRpb25zIHNlcnZlci1zaWRlLlxyXG5cdFx0XHRcdGRhdGFfbW9kZTogICAgc2F2ZV9tb2RlLFxyXG5cclxuXHRcdFx0XHQvLyBPcHRpb25hbCBhbGxvd2xpc3Qgb2Yga2V5cyBmb3Igc3BsaXQgbW9kZSAoQ1NWKS5cclxuXHRcdFx0XHRkYXRhX2ZpZWxkczogIChzYXZlX21vZGUgPT09ICdzcGxpdCcgPyBTdHJpbmcoZmllbGRzX3JhdyB8fCAnJykgOiAnJylcclxuXHRcdFx0fVxyXG5cdFx0fSlcclxuXHRcdC5kb25lKGZ1bmN0aW9uIChyZXNwKSB7XHJcblxyXG5cdFx0XHQvLyBOT1RFOiBwcmV2aW91c2x5IHRoZSBjb2RlIGFsd2F5cyBzaG93ZWQgXCJzdWNjZXNzXCIgZXZlbiBvbiBlcnJvci5cclxuXHRcdFx0Ly8gRml4ZWQ6IHNob3cgc3VjY2VzcyBvbmx5IHdoZW4gcmVzcC5zdWNjZXNzIGlzIHRydWUuXHJcblxyXG5cdFx0XHRpZiAocmVzcCAmJiByZXNwLnN1Y2Nlc3MpIHtcclxuXHJcblx0XHRcdFx0JGVsLmF0dHIoJ2RhdGEtd3BiYy11LWF1dG9zYXZlLWRpcnR5JywgJzAnKTtcclxuXHRcdFx0XHRpZiAoZGF0YV9uYW1lICYmIHdwYmNfdWl4X2F1dG9zYXZlX3JlZ2lzdHJ5W2RhdGFfbmFtZV0pIHtcclxuXHRcdFx0XHRcdHdwYmNfdWl4X2F1dG9zYXZlX3JlZ2lzdHJ5W2RhdGFfbmFtZV0uZGlydHkgPSBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChjYl9mbikge1xyXG5cdFx0XHRcdFx0dHJ5IHsgY2JfZm4ocmVzcCk7IH0gY2F0Y2ggKGUpIHsgY29uc29sZS5lcnJvcihlKTsgfVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIG9rX21lc3NhZ2UgPSAocmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhLm1lc3NhZ2UpID8gcmVzcC5kYXRhLm1lc3NhZ2UgOiAnU2F2ZWQnO1xyXG5cdFx0XHRcdGlmICh0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZShva19tZXNzYWdlLCAnc3VjY2VzcycsIDEwMDAsIGZhbHNlKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHR2YXIgZXJyX21lc3NhZ2UgPSAocmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhLm1lc3NhZ2UpID8gcmVzcC5kYXRhLm1lc3NhZ2UgOiAnU2F2ZSBlcnJvcic7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvcignV1BCQyB8ICcgKyBlcnJfbWVzc2FnZSk7XHJcblxyXG5cdFx0XHRcdGlmICh0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZShlcnJfbWVzc2FnZSwgJ2Vycm9yJywgMzAwMDApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0JChkb2N1bWVudCkudHJpZ2dlcignd3BiYzpvcHRpb246YWZ0ZXJTYXZlJywgWyByZXNwIF0pO1xyXG5cdFx0fSlcclxuXHRcdC5mYWlsKGZ1bmN0aW9uICh4aHIpIHtcclxuXHRcdFx0dmFyIGZlZWRiYWNrX21lc3NhZ2UgPSAnV1BCQyB8IEFKQVggJyArIHhoci5zdGF0dXMgKyAnICcgKyB4aHIuc3RhdHVzVGV4dDtcclxuXHRcdFx0Y29uc29sZS5lcnJvcihmZWVkYmFja19tZXNzYWdlKTtcclxuXHJcblx0XHRcdGlmICh0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG5cdFx0XHRcdHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoZmVlZGJhY2tfbWVzc2FnZSwgJ2Vycm9yJywgMzAwMDApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQkKGRvY3VtZW50KS50cmlnZ2VyKCd3cGJjOm9wdGlvbjphZnRlclNhdmUnLCBbIHsgc3VjY2VzczogZmFsc2UsIGRhdGE6IHsgbWVzc2FnZTogeGhyLnN0YXR1c1RleHQgfSB9IF0pO1xyXG5cdFx0fSlcclxuXHRcdC5hbHdheXMoZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR3cGJjX3VpeF9idXN5X29mZigkZWwpO1xyXG5cdFx0fSk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogV2lyZSBvcHQtaW4gYXV0b3NhdmUgb2YgZ2xvYmFsIG9wdGlvbnMgYWZ0ZXIgc3VjY2Vzc2Z1bCBCRkIgZm9ybSBzYXZlLlxyXG5cdCAqXHJcblx0ICogQWRkIGRhdGEtd3BiYy11LWF1dG9zYXZlLW9uLWZvcm0tc2F2ZT1cIjFcIiB0byBhIHNhdmUgY29udHJvbCB0byBwYXJ0aWNpcGF0ZS5cclxuXHQgKiBEaXJ0eSBzdGF0ZSBpcyB0cmFja2VkIGZyb20gZGF0YS13cGJjLXUtc2F2ZS12YWx1ZS1mcm9tLCBvciBkYXRhLXdwYmMtdS1hdXRvc2F2ZS13YXRjaCB3aGVuIHByZXNlbnQuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3VpeF9iaW5kX2F1dG9zYXZlX29uX2Zvcm1fc2F2ZSgpIHtcclxuXHRcdHZhciBhdXRvc2F2ZV9zZWxlY3RvciA9ICdbZGF0YS13cGJjLXUtYXV0b3NhdmUtb24tZm9ybS1zYXZlPVwiMVwiXSc7XHJcblxyXG5cdFx0JChkb2N1bWVudCkub24oJ2NoYW5nZSBpbnB1dCcsICdpbnB1dCxzZWxlY3QsdGV4dGFyZWEnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHZhciBjaGFuZ2VkX2VsID0gdGhpcztcclxuXHJcblx0XHRcdCQoYXV0b3NhdmVfc2VsZWN0b3IpLmVhY2goZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHZhciAkYnRuID0gJCh0aGlzKTtcclxuXHRcdFx0XHR2YXIgd2F0Y2hfc2VsZWN0b3IgPSAkYnRuLmF0dHIoJ2RhdGEtd3BiYy11LWF1dG9zYXZlLXdhdGNoJykgfHwgJGJ0bi5hdHRyKCdkYXRhLXdwYmMtdS1zYXZlLXZhbHVlLWZyb20nKSB8fCAnJztcclxuXHJcblx0XHRcdFx0aWYgKCF3YXRjaF9zZWxlY3Rvcikge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyICR3YXRjaGVkID0gJCh3YXRjaF9zZWxlY3Rvcik7XHJcblx0XHRcdFx0aWYgKCR3YXRjaGVkLmZpbHRlcihjaGFuZ2VkX2VsKS5sZW5ndGggfHwgJHdhdGNoZWQuaGFzKGNoYW5nZWRfZWwpLmxlbmd0aCkge1xyXG5cdFx0XHRcdFx0JGJ0bi5hdHRyKCdkYXRhLXdwYmMtdS1hdXRvc2F2ZS1kaXJ0eScsICcxJyk7XHJcblx0XHRcdFx0XHR3cGJjX3VpeF91cGRhdGVfYXV0b3NhdmVfcmVnaXN0cnlfZnJvbV9lbGVtZW50KHRoaXMsIHRydWUpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHR9KTtcclxuXHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCd3cGJjOmJmYjpmb3JtOmFqYXhfc2F2ZWQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdCQoYXV0b3NhdmVfc2VsZWN0b3IpLmVhY2goZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdGlmICh0aGlzLmdldEF0dHJpYnV0ZSgnZGF0YS13cGJjLXUtYXV0b3NhdmUtZGlydHknKSA9PT0gJzEnKSB7XHJcblx0XHRcdFx0XHR3cGJjX3VpeF91cGRhdGVfYXV0b3NhdmVfcmVnaXN0cnlfZnJvbV9lbGVtZW50KHRoaXMsIHRydWUpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRPYmplY3Qua2V5cyh3cGJjX3VpeF9hdXRvc2F2ZV9yZWdpc3RyeSkuZm9yRWFjaChmdW5jdGlvbiAob3B0aW9uX25hbWUpIHtcclxuXHRcdFx0XHR2YXIgZW50cnkgPSB3cGJjX3VpeF9hdXRvc2F2ZV9yZWdpc3RyeVtvcHRpb25fbmFtZV07XHJcblx0XHRcdFx0aWYgKCFlbnRyeSB8fCAhZW50cnkuZGlydHkpIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmIChlbnRyeS5lbCAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMoZW50cnkuZWwpKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfc2F2ZV9vcHRpb25fZnJvbV9lbGVtZW50KGVudHJ5LmVsKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0d3BiY191aXhfc2F2ZV9hdXRvc2F2ZV9yZWdpc3RyeV9lbnRyeShlbnRyeSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9KTtcclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTG9hZCBvcHRpb24gdmFsdWUgdmlhIEFKQVguXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCBlbGVtZW50IHdpdGggZGF0YSBhdHRyaWJ1dGVzLlxyXG5cdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdCAqL1xyXG5cdHcud3BiY19sb2FkX29wdGlvbl9mcm9tX2VsZW1lbnQgPSBmdW5jdGlvbiAoZWwpIHtcclxuXHJcblx0XHRpZiAoIXcud3BiY19vcHRpb25fc2F2ZXJfbG9hZGVyX2NvbmZpZykge1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCdXUEJDIHwgY29uZmlnIG1pc3NpbmcnKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciAkZWwgID0gJChlbCk7XHJcblx0XHR2YXIgbmFtZSA9ICRlbC5kYXRhKCd3cGJjLXUtbG9hZC1uYW1lJykgfHwgJGVsLmRhdGEoJ3dwYmMtdS1zYXZlLW5hbWUnKTtcclxuXHJcblx0XHR2YXIgY2JfaWQgPSAkZWwuZGF0YSgnd3BiYy11LWxvYWQtY2FsbGJhY2snKTtcclxuXHRcdHZhciBjYl9mbiA9IChjYl9pZCAmJiB0eXBlb2Ygd1tjYl9pZF0gPT09ICdmdW5jdGlvbicpID8gd1tjYl9pZF0gOiBudWxsO1xyXG5cclxuXHRcdGlmICghbmFtZSkge1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCdXUEJDIHwgbWlzc2luZyBkYXRhLXdwYmMtdS1sb2FkLW5hbWUnKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCQoZG9jdW1lbnQpLnRyaWdnZXIoJ3dwYmM6b3B0aW9uOmJlZm9yZUxvYWQnLCBbICRlbCwgbmFtZSBdKTtcclxuXHRcdHdwYmNfdWl4X2J1c3lfb24oJGVsKTtcclxuXHJcblx0XHQkLmFqYXgoe1xyXG5cdFx0XHR1cmw6ICB3LndwYmNfb3B0aW9uX3NhdmVyX2xvYWRlcl9jb25maWcuYWpheF91cmwsXHJcblx0XHRcdHR5cGU6ICdHRVQnLFxyXG5cdFx0XHRkYXRhOiB7XHJcblx0XHRcdFx0YWN0aW9uOiAgICB3LndwYmNfb3B0aW9uX3NhdmVyX2xvYWRlcl9jb25maWcuYWN0aW9uX2xvYWQsXHJcblx0XHRcdFx0ZGF0YV9uYW1lOiBuYW1lXHJcblx0XHRcdH1cclxuXHRcdH0pXHJcblx0XHQuZG9uZShmdW5jdGlvbiAocmVzcCkge1xyXG5cdFx0XHRpZiAocmVzcCAmJiByZXNwLnN1Y2Nlc3MpIHtcclxuXHRcdFx0XHRpZiAoY2JfZm4pIHtcclxuXHRcdFx0XHRcdHRyeSB7IGNiX2ZuKHJlc3AuZGF0YSAmJiByZXNwLmRhdGEudmFsdWUpOyB9IGNhdGNoIChlKSB7IGNvbnNvbGUuZXJyb3IoZSk7IH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvcignV1BCQyB8ICcgKyAocmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhLm1lc3NhZ2UgPyByZXNwLmRhdGEubWVzc2FnZSA6ICdMb2FkIGVycm9yJykpO1xyXG5cdFx0XHR9XHJcblx0XHRcdCQoZG9jdW1lbnQpLnRyaWdnZXIoJ3dwYmM6b3B0aW9uOmFmdGVyTG9hZCcsIFsgcmVzcCBdKTtcclxuXHRcdH0pXHJcblx0XHQuZmFpbChmdW5jdGlvbiAoeGhyKSB7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ1dQQkMgfCBBSkFYICcgKyB4aHIuc3RhdHVzICsgJyAnICsgeGhyLnN0YXR1c1RleHQpO1xyXG5cdFx0XHQkKGRvY3VtZW50KS50cmlnZ2VyKCd3cGJjOm9wdGlvbjphZnRlckxvYWQnLCBbIHsgc3VjY2VzczogZmFsc2UsIGRhdGE6IHsgbWVzc2FnZTogeGhyLnN0YXR1c1RleHQgfSB9IF0pO1xyXG5cdFx0fSlcclxuXHRcdC5hbHdheXMoZnVuY3Rpb24gKCkge1xyXG5cdFx0XHR3cGJjX3VpeF9idXN5X29mZigkZWwpO1xyXG5cdFx0fSk7XHJcblx0fTtcclxuXHJcblx0d3BiY191aXhfYmluZF9hdXRvc2F2ZV9vbl9mb3JtX3NhdmUoKTtcclxuXHJcbn0od2luZG93LCBqUXVlcnkpKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0MsV0FBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQyxTQUFTQyxvQkFBb0JBLENBQUNDLENBQUMsRUFBRTtJQUNoQyxPQUFPQyxNQUFNLENBQUNELENBQUMsQ0FBQyxDQUNkRSxPQUFPLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxD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

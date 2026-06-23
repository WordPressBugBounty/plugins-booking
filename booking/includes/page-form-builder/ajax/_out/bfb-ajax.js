"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  ../includes/page-form-builder/ajax/_out/bfb-ajax.js  - after  refactor 2026-02-28 15:14 rolback  to  this paoint,  if something will  go  wrong.
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d, $) {
  'use strict';

  var AjaxCfg = w.WPBC_BFB_Ajax || {};
  if (!AjaxCfg.url) {
    // Not on builder page or config not injected.
    return;
  }
  if (!$ || !$.ajax) {
    // In WP admin jQuery should exist; if not, stop to avoid silent corruption.
    wpbc_admin_show_message('WPBC BFB: jQuery is not available.', 'error', 10000);
    console.error('WPBC BFB: jQuery is not available.');
    return;
  }
  function get_save_source(cfg, btn) {
    // priority: button attr -> global cfg -> default
    var v = '';
    try {
      if (btn && btn.getAttribute) {
        v = btn.getAttribute('data-wpbc-bfb-save-source') || '';
      }
    } catch (e) {}
    if (!v && cfg && cfg.save_source) {
      v = cfg.save_source;
    }
    v = String(v || 'auto').toLowerCase();
    if (['builder', 'advanced', 'auto'].indexOf(v) === -1) {
      v = 'builder';
    }
    return v;
  }
  function read_advanced_mode_payload() {
    // best: API (syncs CodeMirror -> textarea)
    if (w.wpbc_bfb_advanced_editor_api && typeof w.wpbc_bfb_advanced_editor_api.get_values === 'function') {
      try {
        return w.wpbc_bfb_advanced_editor_api.get_values();
      } catch (e) {}
    }

    // fallback: read textareas directly (may be stale if CM not saved)
    var ta_form = d.getElementById('wpbc_bfb__advanced_form_editor');
    var ta_content = d.getElementById('wpbc_bfb__content_form_editor');
    return {
      advanced_form: ta_form ? String(ta_form.value || '') : '',
      content_form: ta_content ? String(ta_content.value || '') : '',
      is_dirty: false
    };
  }
  function has_text(v) {
    return !!(v && String(v).trim());
  }

  /**
   * Serialize values so payload matches previous XMLHttpRequest behavior:
   * - null/undefined => ''
   * - objects/arrays => JSON.stringify(...)
   * - everything else => String(...)
   *
   * @param {*} value
   * @return {string}
   */
  function wpbc_bfb__serialize_post_value(value) {
    if (value === null || typeof value === 'undefined') {
      return '';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch (e) {
        return '';
      }
    }
    return String(value);
  }

  /**
   * Normalize payload to scalar strings so jQuery does not produce "[object Object]".
   *
   * @param {Object} raw_data
   * @return {Object}
   */
  function wpbc_bfb__normalize_post_data(raw_data) {
    var out = {};
    raw_data = raw_data || {};
    for (var k in raw_data) {
      if (!Object.prototype.hasOwnProperty.call(raw_data, k)) {
        continue;
      }
      out[k] = wpbc_bfb__serialize_post_value(raw_data[k]);
    }
    return out;
  }

  /**
   * POST helper (jQuery only) returning jqXHR promise.
   * IMPORTANT: dataType:'text' so callers keep manual JSON.parse exactly as before.
   *
   * @param {string} url
   * @param {Object} payload
   * @return {jqXHR}
   */
  function wpbc_bfb__ajax_post(url, payload) {
    return $.ajax({
      url: url,
      type: 'POST',
      data: wpbc_bfb__normalize_post_data(payload),
      dataType: 'text',
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8'
    });
  }

  /**
   * Safe JSON parse helper.
   *
   * @param {string} text
   * @return {Object|null}
   */
  function wpbc_bfb__safe_json_parse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  /**
   * Parse combined length string like "100%", "320px", "12.5rem".
   *
   * @param {string} value
   * @return {{num:string, unit:string}}
   */
  function parse_length_value(value) {
    var raw = String(value == null ? '' : value).trim();
    var m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i);
    if (!m) {
      return {
        num: raw,
        unit: ''
      };
    }
    return {
      num: m[1] || '',
      unit: m[2] || ''
    };
  }

  /**
   * SAVE: send current Builder structure (+ exported shortcodes) to PHP.
   *
   * Uses:
   *  - WPBC_BFB_Ajax.url / nonce_save / form_name / engine / engine_version
   *  - Optional WPBC_BFB_Exporter.export_all()
   *  - Busy helpers wpbc_bfb__button_busy_start / _end if available.
   *
   * IMPORTANT:
   * - Local (form) settings are collected ONLY here (Save form),
   *   via event "wpbc:bfb:form_settings:collect".
   */
  function wpbc_bfb__ajax_save_current_form(btn, done_cb) {
    var cfg = w.WPBC_BFB_Ajax || {};
    var builder = w.wpbc_bfb || null;
    var $btn = btn ? $(btn) : null;

    // --- Busy START ----------------------------------------------------------------------------------------------
    if ($btn && $btn.length) {
      // Will read data-wpbc-u-busy-text="Saving..." from the <a> and add spinner.
      if (typeof w.wpbc_bfb__button_busy_start === 'function') {
        // FIX: guard
        w.wpbc_bfb__button_busy_start($btn);
      } else {
        $btn.prop('disabled', true);
      }
    } else if (btn) {
      btn.disabled = true;
    }

    // --- Gather structure ----------------------------------------------------------------------------------------
    var structure = builder && typeof builder.get_structure === 'function' ? builder.get_structure() : [];

    // --- Gather current form settings (event-based; modules can contribute) -------------------------------------
    // ONLY supported settings format:
    // {
    //   options     : { key: value, ... },
    //   css_vars    : [],
    //   bfb_options : { advanced_mode_source: 'builder'|'advanced'|'auto' }
    // }
    var form_settings = {
      options: {},
      css_vars: [],
      bfb_options: {
        advanced_mode_source: 'builder'
      }
    };

    // Let Settings Options (and any other module) contribute local form settings.
    wpbc_bfb__dispatch_event_safe('wpbc:bfb:form_settings:collect', {
      settings: form_settings,
      form_name: cfg.form_name || 'standard'
    });

    // Normalize css_vars to array (schema enforcement).
    if (form_settings && form_settings.css_vars && !Array.isArray(form_settings.css_vars)) {
      var out = [];
      try {
        for (var k in form_settings.css_vars) {
          if (Object.prototype.hasOwnProperty.call(form_settings.css_vars, k)) {
            out.push({
              name: String(k),
              value: String(form_settings.css_vars[k])
            });
          }
        }
      } catch (_e0) {}
      form_settings.css_vars = out;
    }
    if (!form_settings.bfb_options || typeof form_settings.bfb_options !== 'object') {
      form_settings.bfb_options = {
        advanced_mode_source: 'builder'
      };
    }
    if (!form_settings.bfb_options.advanced_mode_source) {
      form_settings.bfb_options.advanced_mode_source = 'builder';
    }
    var payload = {
      action: 'WPBC_AJX_BFB_SAVE_FORM_CONFIG',
      nonce: cfg.nonce_save || '',
      form_name: cfg.form_name || 'standard',
      engine: cfg.engine || 'bfb',
      engine_version: cfg.engine_version || '1.0',
      structure: JSON.stringify(structure),
      settings: JSON.stringify(form_settings)
    };

    // -----------------------------------------------------------------------------
    // Choose where advanced_form + content_form are taken from.
    // -----------------------------------------------------------------------------
    var save_source = get_save_source(cfg, btn);

    // 1) Try Advanced Mode text (if selected / auto+dirty).
    var adv = null;
    if (save_source === 'advanced' || save_source === 'auto') {
      adv = read_advanced_mode_payload();
      var can_use_advanced = save_source === 'advanced' || save_source === 'auto' && adv && adv.is_dirty;
      if (can_use_advanced) {
        // If user forced "advanced" but both are empty -> fallback to exporter.
        if (!has_text(adv.advanced_form) && !has_text(adv.content_form)) {
          wpbc_admin_show_message('Advanced Mode is selected, but editors are empty. Using Builder export.', 'warning', 6000);
        } else {
          if (has_text(adv.advanced_form)) {
            payload.advanced_form = adv.advanced_form;
          }
          if (has_text(adv.content_form)) {
            payload.content_form = adv.content_form;
          }
          form_settings.bfb_options.advanced_mode_source = 'advanced';
          payload.settings = JSON.stringify(form_settings); // keep payload in sync.
        }
      }
    }

    // 2) If not taken from Advanced Mode -> export from Builder structure (current behavior).
    if (!payload.advanced_form || !payload.content_form) {
      if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function') {
        try {
          // Prefer Option A pack: settings.options.*
          var opt_pack = form_settings.options;
          var width_combined = opt_pack.booking_form_layout_width || '';
          var parsed_width = parse_length_value(width_combined);
          var export_options = {
            gapPercent: 3,
            form_slug: payload.form_name,
            form_width_value: parsed_width.num,
            form_width_unit: parsed_width.unit
          };
          var export_result = w.WPBC_BFB_Exporter.export_all(structure || [], export_options);
          if (export_result) {
            if (!payload.advanced_form && export_result.advanced_form) {
              payload.advanced_form = export_result.advanced_form;
            }
            if (!payload.content_form && export_result.fields_data) {
              payload.content_form = export_result.fields_data;
            }
          }
          form_settings.bfb_options.advanced_mode_source = 'builder';
          payload.settings = JSON.stringify(form_settings); // keep payload in sync.
        } catch (e) {
          wpbc_admin_show_message('WPBC BFB: export_all error', 'error', 10000);
          console.error('WPBC BFB: export_all error', e);
        }
      }
    }

    // Update payload before send via AJAX,  if needed.
    var hook_detail = {
      payload: payload
    };
    wpbc_bfb__dispatch_event_safe('wpbc:bfb:form:before_save_payload', hook_detail);
    payload = hook_detail.payload;
    var ajax_request = wpbc_bfb__ajax_post(cfg.url, payload);
    ajax_request.done(function (response_text, _text_status, jqxhr) {
      // Keep old behavior: only treat exact 200 as success.
      if (!jqxhr || jqxhr.status !== 200) {
        if (typeof done_cb === 'function') {
          try {
            done_cb(false, null);
          } catch (_e1) {}
        }
        wpbc_admin_show_message('WPBC BFB: save HTTP error', 'error', 10000);
        console.error('WPBC BFB: save HTTP error', jqxhr ? jqxhr.status : 0);
        return;
      }
      var resp = wpbc_bfb__safe_json_parse(response_text);
      if (!resp) {
        wpbc_admin_show_message('WPBC BFB: save JSON parse error', 'error', 10000);
        console.error('WPBC BFB: save JSON parse error', response_text);
        return;
      }
      if (!resp || !resp.success) {
        const error_message = resp.data && resp.data.message ? resp.data.message : '';
        wpbc_admin_show_message('WPBC BFB: save failed.' + ' | ' + error_message, 'error', 10000);
        console.error('WPBC BFB: save failed', resp);
        return;
      }
      if (typeof done_cb === 'function') {
        try {
          done_cb(true, resp);
        } catch (_e2) {}
      }
      wpbc_bfb__dispatch_event_safe('wpbc:bfb:form:ajax_saved', {
        loaded_data: resp.data,
        form_name: cfg.form_name || 'standard'
      });
      if (resp.data && resp.data.setup_step_saved && typeof w.wpbc_setup_wizard_set_current_step_saved === 'function') {
        try {
          w.wpbc_setup_wizard_set_current_step_saved();
        } catch (_e_setup_set) {}
      } else if (typeof w.wpbc_setup_wizard_mark_current_step_saved === 'function') {
        try {
          w.wpbc_setup_wizard_mark_current_step_saved();
        } catch (_e_setup) {}
      }

      // Optional: visual feedback.
      wpbc_admin_show_message('Form saved', 'success', 1000, false);
    }).fail(function (jqxhr) {
      // Old behavior: status != 200 triggers done_cb(false, null).
      if (typeof done_cb === 'function') {
        try {
          done_cb(false, null);
        } catch (_e3) {}
      }
      wpbc_admin_show_message('WPBC BFB: save HTTP error', 'error', 10000);
      console.error('WPBC BFB: save HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText);
    }).always(function () {
      // --- Busy END (always) ----------------------------------------------------------------------------------
      if ($btn && $btn.length && typeof w.wpbc_bfb__button_busy_end === 'function') {
        w.wpbc_bfb__button_busy_end($btn);
      } else if ($btn && $btn.length) {
        $btn.prop('disabled', false).removeClass('wpbc-is-busy');
      } else if (btn) {
        btn.disabled = false;
      }
    });
  }
  function apply_advanced_mode_texts(advanced_form, content_form, advanced_mode_source) {
    var af = advanced_form == null ? '' : String(advanced_form);
    var cf = content_form == null ? '' : String(content_form);

    // Always update underlying <textarea> so it works even if CodeMirror isn't inited yet.
    var ta_form = d.getElementById('wpbc_bfb__advanced_form_editor');
    var ta_content = d.getElementById('wpbc_bfb__content_form_editor');
    if (ta_form) {
      ta_form.value = af;
    }
    if (ta_content) {
      ta_content.value = cf;
    }

    // Notify Advanced Mode module (if loaded) to sync CodeMirror + flags.
    wpbc_bfb__dispatch_event_safe('wpbc:bfb:advanced_text:apply', {
      advanced_form: af,
      content_form: cf,
      advanced_mode_source: advanced_mode_source
    });
  }

  /**
   * LOAD: fetch FormConfig from PHP and hand structure to Builder.
   *
   * Also uses busy helpers if available.
   */
  function wpbc_bfb__ajax_load_current_form(btn, done_cb) {
    var cfg = w.WPBC_BFB_Ajax || {};
    var builder = w.wpbc_bfb || null;
    var $btn = btn ? $(btn) : null;

    // --- Busy START ----------------------------------------------------------------------------------------------
    if ($btn && $btn.length) {
      if (typeof w.wpbc_bfb__button_busy_start === 'function') {
        // FIX: guard
        w.wpbc_bfb__button_busy_start($btn);
      } else {
        $btn.prop('disabled', true);
      }
    } else if (btn) {
      btn.disabled = true;
    }
    var payload = {
      action: 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
      nonce: cfg.nonce_load || '',
      form_name: cfg.form_name || 'standard'
    };
    wpbc_admin_show_message_processing('');
    // wpbc_admin_show_message( 'Processing', 'info', 1000, false );    // Optional: visual feedback.

    var ajax_request = wpbc_bfb__ajax_post(cfg.url, payload);
    ajax_request.done(function (response_text, _text_status, jqxhr) {
      if (!jqxhr || jqxhr.status !== 200) {
        if (typeof done_cb === 'function') {
          try {
            done_cb(false, null);
          } catch (_e0) {}
        }
        wpbc_admin_show_message('WPBC BFB: load HTTP error', 'error', 10000);
        console.error('WPBC BFB: load HTTP error', jqxhr ? jqxhr.status : 0);
        return;
      }
      var resp = wpbc_bfb__safe_json_parse(response_text);
      if (!resp) {
        wpbc_admin_show_message('WPBC BFB: load JSON parse error', 'error', 10000);
        console.error('WPBC BFB: load JSON parse error', response_text);
        return;
      }
      if (!resp || !resp.success || !resp.data) {
        wpbc_admin_show_message('WPBC BFB: load failed', 'error', 10000);
        console.error('WPBC BFB: load failed', resp);
        return;
      }
      var data = resp.data;
      var structure = data.structure || [];

      // Apply Advanced Mode saved texts (if provided by PHP).
      if (data && (typeof data.advanced_form !== 'undefined' || typeof data.content_form !== 'undefined')) {
        var ams = '';
        try {
          var s1 = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
          ams = s1 && s1.bfb_options && s1.bfb_options.advanced_mode_source ? s1.bfb_options.advanced_mode_source : '';
        } catch (_e1) {}
        apply_advanced_mode_texts(data.advanced_form || '', data.content_form || '', ams);
      }

      // Apply settings to UI (local form settings) if provided.
      if (data.settings) {
        var parsed_settings = null;
        try {
          parsed_settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
        } catch (_e2) {
          parsed_settings = null;
        }
        if (parsed_settings) {
          wpbc_bfb__dispatch_event_safe('wpbc:bfb:form_settings:apply', {
            settings: parsed_settings,
            form_name: cfg.form_name || 'standard'
          });
        }
      }
      wpbc_bfb__dispatch_event_safe('wpbc:bfb:form:ajax_loaded', {
        loaded_data: data,
        form_name: cfg.form_name || 'standard'
      });
      if (typeof done_cb === 'function') {
        try {
          done_cb(true, data);
        } catch (_e3) {}
      }

      // Prefer your existing callback if it already knows how to init Builder.
      if (typeof w.wpbc_bfb__on_structure_loaded === 'function') {
        w.wpbc_bfb__on_structure_loaded(structure);
        wpbc_admin_show_message('Done', 'info', 1000, false);
      } else if (builder && typeof builder.load_structure === 'function') {
        builder.load_structure(structure);
        wpbc_admin_show_message('Done', 'info', 1000, false);
      } else {
        console.warn('WPBC BFB: no loader for structure', structure);
      }
    }).fail(function (jqxhr) {
      if (typeof done_cb === 'function') {
        try {
          done_cb(false, null);
        } catch (_e4) {}
      }
      wpbc_admin_show_message('WPBC BFB: load HTTP error', 'error', 10000);
      console.error('WPBC BFB: load HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText);
    }).always(function () {
      // --- Busy END (always) ----------------------------------------------------------------------------------
      if ($btn && $btn.length && typeof w.wpbc_bfb__button_busy_end === 'function') {
        w.wpbc_bfb__button_busy_end($btn);
      } else if ($btn && $btn.length) {
        $btn.prop('disabled', false).removeClass('wpbc-is-busy');
      } else if (btn) {
        btn.disabled = false;
      }
    });
  }
  function wpbc_bfb__ajax_create_form(btn, create_payload, template_form_key, done_cb) {
    var cfg = w.WPBC_BFB_Ajax || {};
    if (!cfg.url || !cfg.nonce_create) {
      wpbc_admin_show_message('WPBC BFB: create config is missing (url/nonce).', 'error', 10000);
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      return;
    }
    template_form_key = String(template_form_key || '').trim();
    if (template_form_key === '__blank__') {
      template_form_key = '';
    }
    var payload = {
      action: 'WPBC_AJX_BFB_CREATE_FORM_CONFIG',
      nonce: cfg.nonce_create,
      form_name: String(create_payload.form_slug || ''),
      template_form_name: template_form_key || '',
      title: String(create_payload.form_title || ''),
      description: String(create_payload.form_description || ''),
      image_url: String(create_payload.form_image_url || '')
    };
    var ajax_request = wpbc_bfb__ajax_post(cfg.url, payload);
    ajax_request.done(function (response_text, _text_status, jqxhr) {
      if (!jqxhr || jqxhr.status !== 200) {
        wpbc_admin_show_message('WPBC BFB: create HTTP error', 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      var resp = wpbc_bfb__safe_json_parse(response_text);
      if (!resp) {
        wpbc_admin_show_message('WPBC BFB: create JSON parse error', 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      if (!resp || !resp.success || !resp.data) {
        var msg = resp && resp.data && resp.data.message ? resp.data.message : 'WPBC BFB: create failed';
        wpbc_admin_show_message(msg, 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, resp);
        }
        return;
      }

      // Switch current form to the newly created key.
      cfg.form_name = resp.data.form_name || create_payload.form_slug;
      if (typeof done_cb === 'function') {
        done_cb(true, resp);
      }
    }).fail(function (jqxhr) {
      wpbc_admin_show_message('WPBC BFB: create HTTP error', 'error', 10000);
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      console.error('WPBC BFB: create HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText);
    });
  }

  // Load ALL Forms.
  function wpbc_bfb__ajax_list_user_forms(btn, args, done_cb) {
    var cfg = w.WPBC_BFB_Ajax || {};
    if (!cfg.url || !cfg.nonce_list) {
      wpbc_admin_show_message('WPBC BFB: list config is missing (url/nonce_list).', 'error', 10000);
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      return;
    }
    var page = args && args.page ? parseInt(args.page, 10) : 1;
    var limit = args && (args.limit || args.per_page) ? parseInt(args.limit || args.per_page, 10) : 20;
    if (!page || page < 1) {
      page = 1;
    }
    if (!limit || limit < 1) {
      limit = 20;
    }
    var payload = {
      action: 'WPBC_AJX_BFB_LIST_FORMS',
      nonce: cfg.nonce_list,
      include_global: args && args.include_global ? 1 : 0,
      status: args && args.status ? String(args.status) : 'published',
      search: args && args.search ? String(args.search) : '',
      page: page,
      limit: limit
    };
    var ajax_request = wpbc_bfb__ajax_post(cfg.url, payload);
    ajax_request.done(function (response_text, _text_status, jqxhr) {
      if (!jqxhr || jqxhr.status !== 200) {
        wpbc_admin_show_message('WPBC BFB: list HTTP error', 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      var resp = wpbc_bfb__safe_json_parse(response_text);
      if (!resp) {
        wpbc_admin_show_message('WPBC BFB: list JSON parse error', 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      if (!resp || !resp.success || !resp.data) {
        wpbc_admin_show_message('WPBC BFB: list failed', 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, resp);
        }
        return;
      }
      if (typeof done_cb === 'function') {
        done_cb(true, resp.data);
      }
    }).fail(function (jqxhr) {
      wpbc_admin_show_message('WPBC BFB: list HTTP error', 'error', 10000);
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      console.error('WPBC BFB: list HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText);
    });
  }
  function wpbc_bfb__ajax_load_form_by_slug(form_slug, btn, done_cb) {
    var cfg = w.WPBC_BFB_Ajax || {};
    var builder = w.wpbc_bfb || null;
    form_slug = String(form_slug || '').trim();
    if (!form_slug) {
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      return;
    }
    var $btn = btn ? $(btn) : null;

    // Busy START
    if ($btn && $btn.length) {
      if (typeof w.wpbc_bfb__button_busy_start === 'function') {
        w.wpbc_bfb__button_busy_start($btn);
      } else {
        $btn.prop('disabled', true);
      }
    } else if (btn) {
      btn.disabled = true;
    }
    var payload = {
      action: 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
      nonce: cfg.nonce_load || '',
      form_name: form_slug
    };
    wpbc_admin_show_message_processing('');
    var ajax_request = wpbc_bfb__ajax_post(cfg.url, payload);
    ajax_request.done(function (response_text, _text_status, jqxhr) {
      if (!jqxhr || jqxhr.status !== 200) {
        wpbc_admin_show_message('WPBC BFB: load HTTP error', 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      var resp = wpbc_bfb__safe_json_parse(response_text);
      if (!resp) {
        wpbc_admin_show_message('WPBC BFB: load JSON parse error', 'error', 10000);
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      if (!resp || !resp.success || !resp.data) {
        if (resp && resp.data && resp.data.message) {
          wpbc_admin_show_message('WPBC BFB: ' + resp.data.message, 'error', 10000);
        } else {
          wpbc_admin_show_message('WPBC BFB: load failed', 'error', 10000);
        }
        if (typeof done_cb === 'function') {
          done_cb(false, resp);
        }
        return;
      }
      var data = resp.data;
      var structure = data.structure || [];

      // IMPORTANT: switch "current form" after successful load
      cfg.form_name = form_slug;

      // Apply Advanced Mode texts if present.
      if (data && (typeof data.advanced_form !== 'undefined' || typeof data.content_form !== 'undefined')) {
        var ams2 = '';
        try {
          var s2 = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
          ams2 = s2 && s2.bfb_options && s2.bfb_options.advanced_mode_source ? s2.bfb_options.advanced_mode_source : '';
        } catch (_e2) {}
        apply_advanced_mode_texts(data.advanced_form || '', data.content_form || '', ams2);
      }

      // Apply settings if present.
      if (data.settings) {
        var parsed_settings = null;
        try {
          parsed_settings = typeof data.settings === 'string' ? JSON.parse(data.settings) : data.settings;
        } catch (_e3) {
          parsed_settings = null;
        }
        if (parsed_settings) {
          wpbc_bfb__dispatch_event_safe('wpbc:bfb:form_settings:apply', {
            settings: parsed_settings,
            form_name: cfg.form_name || 'standard'
          });
        }
      }
      wpbc_bfb__dispatch_event_safe('wpbc:bfb:form:ajax_loaded', {
        loaded_data: data,
        form_name: cfg.form_name || 'standard'
      });
      if (typeof done_cb === 'function') {
        try {
          done_cb(true, data);
        } catch (_e4) {}
      }
      if (typeof w.wpbc_bfb__on_structure_loaded === 'function') {
        w.wpbc_bfb__on_structure_loaded(structure);
        wpbc_admin_show_message('Done', 'info', 1000, false);
      } else if (builder && typeof builder.load_structure === 'function') {
        builder.load_structure(structure);
        wpbc_admin_show_message('Done', 'info', 1000, false);
      } else {
        console.warn('WPBC BFB: no loader for structure', structure);
      }
    }).fail(function (jqxhr) {
      wpbc_admin_show_message('WPBC BFB: load HTTP error', 'error', 10000);
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      console.error('WPBC BFB: load HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText);
    }).always(function () {
      // Busy END
      if ($btn && $btn.length && typeof w.wpbc_bfb__button_busy_end === 'function') {
        w.wpbc_bfb__button_busy_end($btn);
      } else if ($btn && $btn.length) {
        $btn.prop('disabled', false).removeClass('wpbc-is-busy');
      } else if (btn) {
        btn.disabled = false;
      }
    });
  }
  function wpbc_bfb__ajax_delete_template_by_slug(form_slug, done_cb) {
    var cfg = w.WPBC_BFB_Ajax || {};
    var delete_nonce = cfg.nonce_delete || cfg.nonce_list || '';
    form_slug = String(form_slug || '').trim();
    if (!form_slug) {
      if (typeof done_cb === 'function') {
        done_cb(false, {
          data: {
            message: 'Template key is required.'
          }
        });
      }
      return;
    }
    if (!cfg.url || !delete_nonce) {
      console.error('WPBC BFB: delete template config is missing (url/nonce).');
      if (typeof done_cb === 'function') {
        done_cb(false, {
          data: {
            message: 'WPBC BFB: delete template config is missing (url/nonce).'
          }
        });
      }
      return;
    }
    var payload = {
      action: 'WPBC_AJX_BFB_DELETE_TEMPLATE_CONFIG',
      nonce: delete_nonce,
      form_name: form_slug
    };
    var ajax_request = wpbc_bfb__ajax_post(cfg.url, payload);
    ajax_request.done(function (response_text, _text_status, jqxhr) {
      if (!jqxhr || jqxhr.status !== 200) {
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      var resp = wpbc_bfb__safe_json_parse(response_text);
      if (!resp) {
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      if (!resp.success) {
        if (typeof done_cb === 'function') {
          done_cb(false, resp);
        }
        return;
      }
      if (typeof done_cb === 'function') {
        done_cb(true, resp);
      }
    }).fail(function (jqxhr) {
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      console.error('WPBC BFB: delete template HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText);
    });
  }

  // Expose globals for buttons (onclick attributes).
  w.wpbc_bfb__ajax_delete_template_by_slug = wpbc_bfb__ajax_delete_template_by_slug;
  w.wpbc_bfb__ajax_save_current_form = wpbc_bfb__ajax_save_current_form;
  w.wpbc_bfb__ajax_load_current_form = wpbc_bfb__ajax_load_current_form;
  w.wpbc_bfb__ajax_create_form = wpbc_bfb__ajax_create_form;
  w.wpbc_bfb__ajax_list_user_forms = wpbc_bfb__ajax_list_user_forms;
  w.wpbc_bfb__ajax_load_form_by_slug = wpbc_bfb__ajax_load_form_by_slug;
})(window, document, window.jQuery);

// -- Ajax Helpers: ----------------------------------------------------------------------------------------------------
/**
 * Common callback used by loaders that return structure JSON.
 *
 * @param val
 */
function wpbc_bfb__on_structure_loaded(val) {
  try {
    if (typeof val === 'string') {
      val = JSON.parse(val);
    }
    var builder = window.wpbc_bfb || null; // FIX: use window.*
    if (builder && typeof builder.load_saved_structure === 'function') {
      builder.load_saved_structure(val || []);
    }
  } catch (e) {
    wpbc_admin_show_message('wpbc_bfb__on_structure_loaded error', 'error', 10000);
    console.error('wpbc_bfb__on_structure_loaded error', e);
  }
}
function wpbc_bfb__get_ajax_url() {
  if (typeof ajaxurl !== 'undefined' && ajaxurl) {
    return ajaxurl;
  }
  var AjaxCfg = window.WPBC_BFB_Ajax || {}; // FIX: guard via window.*
  if (AjaxCfg.url) {
    return AjaxCfg.url;
  }
  wpbc_admin_show_message('WPBC BFB: ajax URL is missing.', 'error', 10000);
  console.error('WPBC BFB: ajax URL is missing.');
  return '';
}

// -- Shared helpers: button busy state --------------------------------------------------------------------------------
function wpbc_bfb__button_busy_start($btn) {
  if (!$btn || !$btn.length) return;
  var original_html = $btn.html();
  var busy_text = $btn.data('wpbc-u-busy-text') || '';
  var spinner_html = '<span class="wpbc_icn_rotate_right wpbc_spin wpbc_ajax_icon wpbc_processing wpbc_icn_autorenew" aria-hidden="true"></span>';
  $btn.data('wpbc-original-html', original_html).prop('disabled', true).addClass('wpbc-is-busy');
  if (busy_text) {
    $btn.html(busy_text + ' ' + spinner_html);
  } else {
    $btn.append(spinner_html);
  }
}
function wpbc_bfb__button_busy_end($btn) {
  if (!$btn || !$btn.length) return;
  var original = $btn.data('wpbc-original-html');
  if (typeof original === 'string') {
    $btn.html(original);
  }
  $btn.prop('disabled', false).removeClass('wpbc-is-busy').removeData('wpbc-original-html');
}

// -- Import Helpers: --------------------------------------------------------------------------------------------------
/**
 * Import from Simple Form — with busy state
 *
 * @param btn
 */
function wpbc_bfb__import_from_simple_form(btn) {
  try {
    var $btn = jQuery(btn);
    var nonce = $btn.data('wpbc-bfb-import-nonce');
    var action = $btn.data('wpbc-bfb-import-action') || 'wpbc_bfb_import_simple_form';
    if (!nonce) {
      wpbc_admin_show_message('WPBC BFB: missing import nonce.', 'error', 10000);
      console.error('WPBC BFB: missing import nonce.');
      return;
    }
    var ajax_url = wpbc_bfb__get_ajax_url();
    if (!ajax_url) {
      return;
    }
    wpbc_bfb__button_busy_start($btn);
    wpbc_admin_show_message_processing('');
    jQuery.post(ajax_url, {
      action: action,
      nonce: nonce
    }).done(function (resp) {
      if (resp && resp.success && resp.data && resp.data.structure) {
        var builder = window.wpbc_bfb || null; // FIX: use window.*
        if (builder && typeof builder.load_saved_structure === 'function') {
          builder.load_saved_structure(resp.data.structure || []);
          wpbc_admin_show_message('Done', 'info', 1000, false);
        }
      } else {
        wpbc_admin_show_message('WPBC BFB: import error', 'error', 10000);
        console.error('WPBC BFB: import error', resp);
      }
    }).fail(function (xhr) {
      wpbc_admin_show_message('WPBC BFB: AJAX error', 'error', 10000);
      console.error('WPBC BFB: AJAX error', xhr.status, xhr.statusText);
    }).always(function () {
      wpbc_bfb__button_busy_end($btn);
    });
  } catch (e) {
    wpbc_admin_show_message('WPBC BFB: import exception', 'error', 10000);
    console.error('WPBC BFB: import exception', e);
  }
}

/**
 * Import legacy booking forms into BFB storage.
 *
 * Supported modes:
 * - current_context
 * - all_global
 * - all_users
 *
 * @param btn
 */
function wpbc_bfb__import_legacy_forms(btn) {
  try {
    var $btn = jQuery(btn);
    var nonce = $btn.data('wpbc-bfb-import-nonce');
    var action = $btn.data('wpbc-bfb-import-action') || 'WPBC_AJX_BFB_IMPORT_LEGACY_FORMS';
    var mode = $btn.data('wpbc-bfb-import-mode') || 'current_context';
    var skip_if_exists = $btn.data('wpbc-bfb-skip-if-exists') || 'skip';
    var set_bfb_form_not_defined = $btn.data('wpbc-bfb-set-form-not-defined') || 'not_defined';
    if (!nonce) {
      wpbc_admin_show_message('WPBC BFB: missing legacy import nonce.', 'error', 10000);
      console.error('WPBC BFB: missing legacy import nonce.');
      return;
    }
    var ajax_url = wpbc_bfb__get_ajax_url();
    if (!ajax_url) {
      return;
    }
    wpbc_bfb__button_busy_start($btn);
    wpbc_admin_show_message_processing('');
    jQuery.post(ajax_url, {
      action: action,
      nonce: nonce,
      mode: mode,
      skip_if_exists: skip_if_exists,
      set_bfb_form_not_defined: set_bfb_form_not_defined
    }).done(function (resp) {
      if (resp && resp.success && resp.data) {
        var msg = resp.data.message || 'Legacy forms import finished.';
        wpbc_admin_show_message(msg, 'success', 6000, false);
        if (resp.data.imported) {
          // Reload current form,  if imported some forms.
          wpbc_bfb__ajax_load_current_form(null);
        }
        try {
          jQuery(document).trigger('wpbc_bfb_legacy_forms_imported', [resp.data]);
        } catch (_e) {}
      } else {
        wpbc_admin_show_message('WPBC BFB: legacy forms import error', 'error', 10000);
        console.error('WPBC BFB: legacy forms import error', resp);
      }
    }).fail(function (xhr) {
      wpbc_admin_show_message('WPBC BFB: legacy forms AJAX error', 'error', 10000);
      console.error('WPBC BFB: legacy forms AJAX error', xhr.status, xhr.statusText);
    }).always(function () {
      wpbc_bfb__button_busy_end($btn);
    });
  } catch (e) {
    wpbc_admin_show_message('WPBC BFB: legacy forms import exception', 'error', 10000);
    console.error('WPBC BFB: legacy forms import exception', e);
  }
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWpheC9fb3V0L2JmYi1hamF4LmpzIiwibmFtZXMiOlsidyIsImQiLCIkIiwiQWpheENmZyIsIldQQkNfQkZCX0FqYXgiLCJ1cmwiLCJhamF4Iiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJjb25zb2xlIiwiZXJyb3IiLCJnZXRfc2F2ZV9zb3VyY2UiLCJjZmciLCJidG4iLCJ2IiwiZ2V0QXR0cmlidXRlIiwiZSIsInNhdmVfc291cmNlIiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJpbmRleE9mIiwicmVhZF9hZHZhbmNlZF9tb2RlX3BheWxvYWQiLCJ3cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpIiwiZ2V0X3ZhbHVlcyIsInRhX2Zvcm0iLCJnZXRFbGVtZW50QnlJZCIsInRhX2NvbnRlbnQiLCJhZHZhbmNlZF9mb3JtIiwidmFsdWUiLCJjb250ZW50X2Zvcm0iLCJpc19kaXJ0eSIsImhhc190ZXh0IiwidHJpbSIsIndwYmNfYmZiX19zZXJpYWxpemVfcG9zdF92YWx1ZSIsIkpTT04iLCJzdHJpbmdpZnkiLCJ3cGJjX2JmYl9fbm9ybWFsaXplX3Bvc3RfZGF0YSIsInJhd19kYXRhIiwib3V0IiwiayIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsIndwYmNfYmZiX19hamF4X3Bvc3QiLCJwYXlsb2FkIiwidHlwZSIsImRhdGEiLCJkYXRhVHlwZSIsImNvbnRlbnRUeXBlIiwid3BiY19iZmJfX3NhZmVfanNvbl9wYXJzZSIsInRleHQiLCJwYXJzZSIsInBhcnNlX2xlbmd0aF92YWx1ZSIsInJhdyIsIm0iLCJtYXRjaCIsIm51bSIsInVuaXQiLCJ3cGJjX2JmYl9fYWpheF9zYXZlX2N1cnJlbnRfZm9ybSIsImRvbmVfY2IiLCJidWlsZGVyIiwid3BiY19iZmIiLCIkYnRuIiwibGVuZ3RoIiwid3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0IiwicHJvcCIsImRpc2FibGVkIiwic3RydWN0dXJlIiwiZ2V0X3N0cnVjdHVyZSIsImZvcm1fc2V0dGluZ3MiLCJvcHRpb25zIiwiY3NzX3ZhcnMiLCJiZmJfb3B0aW9ucyIsImFkdmFuY2VkX21vZGVfc291cmNlIiwid3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUiLCJzZXR0aW5ncyIsImZvcm1fbmFtZSIsIkFycmF5IiwiaXNBcnJheSIsInB1c2giLCJuYW1lIiwiX2UwIiwiYWN0aW9uIiwibm9uY2UiLCJub25jZV9zYXZlIiwiZW5naW5lIiwiZW5naW5lX3ZlcnNpb24iLCJhZHYiLCJjYW5fdXNlX2FkdmFuY2VkIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJleHBvcnRfYWxsIiwib3B0X3BhY2siLCJ3aWR0aF9jb21iaW5lZCIsImJvb2tpbmdfZm9ybV9sYXlvdXRfd2lkdGgiLCJwYXJzZWRfd2lkdGgiLCJleHBvcnRfb3B0aW9ucyIsImdhcFBlcmNlbnQiLCJmb3JtX3NsdWciLCJmb3JtX3dpZHRoX3ZhbHVlIiwiZm9ybV93aWR0aF91bml0IiwiZXhwb3J0X3Jlc3VsdCIsImZpZWxkc19kYXRhIiwiaG9va19kZXRhaWwiLCJhamF4X3JlcXVlc3QiLCJkb25lIiwicmVzcG9uc2VfdGV4dCIsIl90ZXh0X3N0YXR1cyIsImpxeGhyIiwic3RhdHVzIiwiX2UxIiwicmVzcCIsInN1Y2Nlc3MiLCJlcnJvcl9tZXNzYWdlIiwibWVzc2FnZSIsIl9lMiIsImxvYWRlZF9kYXRhIiwic2V0dXBfc3RlcF9zYXZlZCIsIndwYmNfc2V0dXBfd2l6YXJkX3NldF9jdXJyZW50X3N0ZXBfc2F2ZWQiLCJfZV9zZXR1cF9zZXQiLCJ3cGJjX3NldHVwX3dpemFyZF9tYXJrX2N1cnJlbnRfc3RlcF9zYXZlZCIsIl9lX3NldHVwIiwiZmFpbCIsIl9lMyIsInN0YXR1c1RleHQiLCJhbHdheXMiLCJ3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kIiwicmVtb3ZlQ2xhc3MiLCJhcHBseV9hZHZhbmNlZF9tb2RlX3RleHRzIiwiYWYiLCJjZiIsIndwYmNfYmZiX19hamF4X2xvYWRfY3VycmVudF9mb3JtIiwibm9uY2VfbG9hZCIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlX3Byb2Nlc3NpbmciLCJhbXMiLCJzMSIsInBhcnNlZF9zZXR0aW5ncyIsIndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkIiwibG9hZF9zdHJ1Y3R1cmUiLCJ3YXJuIiwiX2U0Iiwid3BiY19iZmJfX2FqYXhfY3JlYXRlX2Zvcm0iLCJjcmVhdGVfcGF5bG9hZCIsInRlbXBsYXRlX2Zvcm1fa2V5Iiwibm9uY2VfY3JlYXRlIiwidGVtcGxhdGVfZm9ybV9uYW1lIiwidGl0bGUiLCJmb3JtX3RpdGxlIiwiZGVzY3JpcHRpb24iLCJmb3JtX2Rlc2NyaXB0aW9uIiwiaW1hZ2VfdXJsIiwiZm9ybV9pbWFnZV91cmwiLCJtc2ciLCJ3cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMiLCJhcmdzIiwibm9uY2VfbGlzdCIsInBhZ2UiLCJwYXJzZUludCIsImxpbWl0IiwicGVyX3BhZ2UiLCJpbmNsdWRlX2dsb2JhbCIsInNlYXJjaCIsIndwYmNfYmZiX19hamF4X2xvYWRfZm9ybV9ieV9zbHVnIiwiYW1zMiIsInMyIiwid3BiY19iZmJfX2FqYXhfZGVsZXRlX3RlbXBsYXRlX2J5X3NsdWciLCJkZWxldGVfbm9uY2UiLCJub25jZV9kZWxldGUiLCJ3aW5kb3ciLCJkb2N1bWVudCIsImpRdWVyeSIsInZhbCIsImxvYWRfc2F2ZWRfc3RydWN0dXJlIiwid3BiY19iZmJfX2dldF9hamF4X3VybCIsImFqYXh1cmwiLCJvcmlnaW5hbF9odG1sIiwiaHRtbCIsImJ1c3lfdGV4dCIsInNwaW5uZXJfaHRtbCIsImFkZENsYXNzIiwiYXBwZW5kIiwib3JpZ2luYWwiLCJyZW1vdmVEYXRhIiwid3BiY19iZmJfX2ltcG9ydF9mcm9tX3NpbXBsZV9mb3JtIiwiYWpheF91cmwiLCJwb3N0IiwieGhyIiwid3BiY19iZmJfX2ltcG9ydF9sZWdhY3lfZm9ybXMiLCJtb2RlIiwic2tpcF9pZl9leGlzdHMiLCJzZXRfYmZiX2Zvcm1fbm90X2RlZmluZWQiLCJpbXBvcnRlZCIsInRyaWdnZXIiLCJfZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2FqYXgvX3NyYy9iZmItYWpheC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWpheC9fb3V0L2JmYi1hamF4LmpzICAtIGFmdGVyICByZWZhY3RvciAyMDI2LTAyLTI4IDE1OjE0IHJvbGJhY2sgIHRvICB0aGlzIHBhb2ludCwgIGlmIHNvbWV0aGluZyB3aWxsICBnbyAgd3JvbmcuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oZnVuY3Rpb24gKHcsIGQsICQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBBamF4Q2ZnID0gdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdGlmICggISBBamF4Q2ZnLnVybCApIHtcclxuXHRcdC8vIE5vdCBvbiBidWlsZGVyIHBhZ2Ugb3IgY29uZmlnIG5vdCBpbmplY3RlZC5cclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmICggISAkIHx8ICEgJC5hamF4ICkge1xyXG5cdFx0Ly8gSW4gV1AgYWRtaW4galF1ZXJ5IHNob3VsZCBleGlzdDsgaWYgbm90LCBzdG9wIHRvIGF2b2lkIHNpbGVudCBjb3JydXB0aW9uLlxyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogalF1ZXJ5IGlzIG5vdCBhdmFpbGFibGUuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogalF1ZXJ5IGlzIG5vdCBhdmFpbGFibGUuJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3NhdmVfc291cmNlKCBjZmcsIGJ0biApIHtcclxuXHJcblx0XHQvLyBwcmlvcml0eTogYnV0dG9uIGF0dHIgLT4gZ2xvYmFsIGNmZyAtPiBkZWZhdWx0XHJcblx0XHR2YXIgdiA9ICcnO1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCBidG4gJiYgYnRuLmdldEF0dHJpYnV0ZSApIHtcclxuXHRcdFx0XHR2ID0gYnRuLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItc2F2ZS1zb3VyY2UnICkgfHwgJyc7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBlICkge31cclxuXHJcblx0XHRpZiAoICEgdiAmJiBjZmcgJiYgY2ZnLnNhdmVfc291cmNlICkge1xyXG5cdFx0XHR2ID0gY2ZnLnNhdmVfc291cmNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHYgPSBTdHJpbmcoIHYgfHwgJ2F1dG8nICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdGlmICggWyAnYnVpbGRlcicsICdhZHZhbmNlZCcsICdhdXRvJyBdLmluZGV4T2YoIHYgKSA9PT0gLTEgKSB7XHJcblx0XHRcdHYgPSAnYnVpbGRlcic7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlYWRfYWR2YW5jZWRfbW9kZV9wYXlsb2FkKCkge1xyXG5cclxuXHRcdC8vIGJlc3Q6IEFQSSAoc3luY3MgQ29kZU1pcnJvciAtPiB0ZXh0YXJlYSlcclxuXHRcdGlmICggdy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpICYmIHR5cGVvZiB3LndwYmNfYmZiX2FkdmFuY2VkX2VkaXRvcl9hcGkuZ2V0X3ZhbHVlcyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRyZXR1cm4gdy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpLmdldF92YWx1ZXMoKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGZhbGxiYWNrOiByZWFkIHRleHRhcmVhcyBkaXJlY3RseSAobWF5IGJlIHN0YWxlIGlmIENNIG5vdCBzYXZlZClcclxuXHRcdHZhciB0YV9mb3JtICAgID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX2VkaXRvcicgKTtcclxuXHRcdHZhciB0YV9jb250ZW50ID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fZWRpdG9yJyApO1xyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGFkdmFuY2VkX2Zvcm06IHRhX2Zvcm0gPyBTdHJpbmcoIHRhX2Zvcm0udmFsdWUgfHwgJycgKSA6ICcnLFxyXG5cdFx0XHRjb250ZW50X2Zvcm0gOiB0YV9jb250ZW50ID8gU3RyaW5nKCB0YV9jb250ZW50LnZhbHVlIHx8ICcnICkgOiAnJyxcclxuXHRcdFx0aXNfZGlydHkgICAgIDogZmFsc2VcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoYXNfdGV4dCggdiApIHtcclxuXHRcdHJldHVybiAhISAoIHYgJiYgU3RyaW5nKCB2ICkudHJpbSgpICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTZXJpYWxpemUgdmFsdWVzIHNvIHBheWxvYWQgbWF0Y2hlcyBwcmV2aW91cyBYTUxIdHRwUmVxdWVzdCBiZWhhdmlvcjpcclxuXHQgKiAtIG51bGwvdW5kZWZpbmVkID0+ICcnXHJcblx0ICogLSBvYmplY3RzL2FycmF5cyA9PiBKU09OLnN0cmluZ2lmeSguLi4pXHJcblx0ICogLSBldmVyeXRoaW5nIGVsc2UgPT4gU3RyaW5nKC4uLilcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7Kn0gdmFsdWVcclxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3NlcmlhbGl6ZV9wb3N0X3ZhbHVlKCB2YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoIHZhbHVlID09PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KCB2YWx1ZSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gJyc7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTm9ybWFsaXplIHBheWxvYWQgdG8gc2NhbGFyIHN0cmluZ3Mgc28galF1ZXJ5IGRvZXMgbm90IHByb2R1Y2UgXCJbb2JqZWN0IE9iamVjdF1cIi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByYXdfZGF0YVxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fbm9ybWFsaXplX3Bvc3RfZGF0YSggcmF3X2RhdGEgKSB7XHJcblxyXG5cdFx0dmFyIG91dCA9IHt9O1xyXG5cdFx0cmF3X2RhdGEgPSByYXdfZGF0YSB8fCB7fTtcclxuXHJcblx0XHRmb3IgKCB2YXIgayBpbiByYXdfZGF0YSApIHtcclxuXHRcdFx0aWYgKCAhIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcmF3X2RhdGEsIGsgKSApIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRvdXRbIGsgXSA9IHdwYmNfYmZiX19zZXJpYWxpemVfcG9zdF92YWx1ZSggcmF3X2RhdGFbIGsgXSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQT1NUIGhlbHBlciAoalF1ZXJ5IG9ubHkpIHJldHVybmluZyBqcVhIUiBwcm9taXNlLlxyXG5cdCAqIElNUE9SVEFOVDogZGF0YVR5cGU6J3RleHQnIHNvIGNhbGxlcnMga2VlcCBtYW51YWwgSlNPTi5wYXJzZSBleGFjdGx5IGFzIGJlZm9yZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGF5bG9hZFxyXG5cdCAqIEByZXR1cm4ge2pxWEhSfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X3Bvc3QoIHVybCwgcGF5bG9hZCApIHtcclxuXHJcblx0XHRyZXR1cm4gJC5hamF4KCB7XHJcblx0XHRcdHVybCAgICAgICAgIDogdXJsLFxyXG5cdFx0XHR0eXBlICAgICAgICA6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YSAgICAgICAgOiB3cGJjX2JmYl9fbm9ybWFsaXplX3Bvc3RfZGF0YSggcGF5bG9hZCApLFxyXG5cdFx0XHRkYXRhVHlwZSAgICA6ICd0ZXh0JyxcclxuXHRcdFx0Y29udGVudFR5cGUgOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04J1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2FmZSBKU09OIHBhcnNlIGhlbHBlci5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XHJcblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3NhZmVfanNvbl9wYXJzZSggdGV4dCApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKCB0ZXh0ICk7XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBjb21iaW5lZCBsZW5ndGggc3RyaW5nIGxpa2UgXCIxMDAlXCIsIFwiMzIwcHhcIiwgXCIxMi41cmVtXCIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWVcclxuXHQgKiBAcmV0dXJuIHt7bnVtOnN0cmluZywgdW5pdDpzdHJpbmd9fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHBhcnNlX2xlbmd0aF92YWx1ZSggdmFsdWUgKSB7XHJcblx0XHR2YXIgcmF3ID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApLnRyaW0oKTtcclxuXHRcdHZhciBtID0gcmF3Lm1hdGNoKCAvXlxccyooLT9cXGQrKD86XFwuXFxkKyk/KVxccyooW2EteiVdKilcXHMqJC9pICk7XHJcblx0XHRpZiAoICEgbSApIHtcclxuXHRcdFx0cmV0dXJuIHsgbnVtOiByYXcsIHVuaXQ6ICcnIH07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4geyBudW06ICggbVsxXSB8fCAnJyApLCB1bml0OiAoIG1bMl0gfHwgJycgKSB9O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU0FWRTogc2VuZCBjdXJyZW50IEJ1aWxkZXIgc3RydWN0dXJlICgrIGV4cG9ydGVkIHNob3J0Y29kZXMpIHRvIFBIUC5cclxuXHQgKlxyXG5cdCAqIFVzZXM6XHJcblx0ICogIC0gV1BCQ19CRkJfQWpheC51cmwgLyBub25jZV9zYXZlIC8gZm9ybV9uYW1lIC8gZW5naW5lIC8gZW5naW5lX3ZlcnNpb25cclxuXHQgKiAgLSBPcHRpb25hbCBXUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfYWxsKClcclxuXHQgKiAgLSBCdXN5IGhlbHBlcnMgd3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0IC8gX2VuZCBpZiBhdmFpbGFibGUuXHJcblx0ICpcclxuXHQgKiBJTVBPUlRBTlQ6XHJcblx0ICogLSBMb2NhbCAoZm9ybSkgc2V0dGluZ3MgYXJlIGNvbGxlY3RlZCBPTkxZIGhlcmUgKFNhdmUgZm9ybSksXHJcblx0ICogICB2aWEgZXZlbnQgXCJ3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNvbGxlY3RcIi5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fYWpheF9zYXZlX2N1cnJlbnRfZm9ybSggYnRuLCBkb25lX2NiICkge1xyXG5cclxuXHRcdHZhciBjZmcgICAgID0gdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdFx0dmFyIGJ1aWxkZXIgPSB3LndwYmNfYmZiIHx8IG51bGw7XHJcblxyXG5cdFx0dmFyICRidG4gPSBidG4gPyAkKCBidG4gKSA6IG51bGw7XHJcblxyXG5cdFx0Ly8gLS0tIEJ1c3kgU1RBUlQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0XHQvLyBXaWxsIHJlYWQgZGF0YS13cGJjLXUtYnVzeS10ZXh0PVwiU2F2aW5nLi4uXCIgZnJvbSB0aGUgPGE+IGFuZCBhZGQgc3Bpbm5lci5cclxuXHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQgPT09ICdmdW5jdGlvbicgKSB7ICAgICAgICAgIC8vIEZJWDogZ3VhcmRcclxuXHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9zdGFydCggJGJ0biApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCRidG4ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKCBidG4gKSB7XHJcblx0XHRcdGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tIEdhdGhlciBzdHJ1Y3R1cmUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIHN0cnVjdHVyZSA9ICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5nZXRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkgPyBidWlsZGVyLmdldF9zdHJ1Y3R1cmUoKSA6IFtdO1xyXG5cclxuXHRcdC8vIC0tLSBHYXRoZXIgY3VycmVudCBmb3JtIHNldHRpbmdzIChldmVudC1iYXNlZDsgbW9kdWxlcyBjYW4gY29udHJpYnV0ZSkgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gT05MWSBzdXBwb3J0ZWQgc2V0dGluZ3MgZm9ybWF0OlxyXG5cdFx0Ly8ge1xyXG5cdFx0Ly8gICBvcHRpb25zICAgICA6IHsga2V5OiB2YWx1ZSwgLi4uIH0sXHJcblx0XHQvLyAgIGNzc192YXJzICAgIDogW10sXHJcblx0XHQvLyAgIGJmYl9vcHRpb25zIDogeyBhZHZhbmNlZF9tb2RlX3NvdXJjZTogJ2J1aWxkZXInfCdhZHZhbmNlZCd8J2F1dG8nIH1cclxuXHRcdC8vIH1cclxuXHRcdHZhciBmb3JtX3NldHRpbmdzID0ge1xyXG5cdFx0XHRvcHRpb25zICAgICA6IHt9LFxyXG5cdFx0XHRjc3NfdmFycyAgICA6IFtdLFxyXG5cdFx0XHRiZmJfb3B0aW9ucyA6IHsgYWR2YW5jZWRfbW9kZV9zb3VyY2U6ICdidWlsZGVyJyB9XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIExldCBTZXR0aW5ncyBPcHRpb25zIChhbmQgYW55IG90aGVyIG1vZHVsZSkgY29udHJpYnV0ZSBsb2NhbCBmb3JtIHNldHRpbmdzLlxyXG5cdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNvbGxlY3QnLCB7XHJcblx0XHRcdHNldHRpbmdzIDogZm9ybV9zZXR0aW5ncyxcclxuXHRcdFx0Zm9ybV9uYW1lOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdH0gKTtcclxuXHJcblx0XHQvLyBOb3JtYWxpemUgY3NzX3ZhcnMgdG8gYXJyYXkgKHNjaGVtYSBlbmZvcmNlbWVudCkuXHJcblx0XHRpZiAoIGZvcm1fc2V0dGluZ3MgJiYgZm9ybV9zZXR0aW5ncy5jc3NfdmFycyAmJiAhIEFycmF5LmlzQXJyYXkoIGZvcm1fc2V0dGluZ3MuY3NzX3ZhcnMgKSApIHtcclxuXHRcdFx0dmFyIG91dCA9IFtdO1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGZvciAoIHZhciBrIGluIGZvcm1fc2V0dGluZ3MuY3NzX3ZhcnMgKSB7XHJcblx0XHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZm9ybV9zZXR0aW5ncy5jc3NfdmFycywgayApICkge1xyXG5cdFx0XHRcdFx0XHRvdXQucHVzaCggeyBuYW1lOiBTdHJpbmcoIGsgKSwgdmFsdWU6IFN0cmluZyggZm9ybV9zZXR0aW5ncy5jc3NfdmFyc1sgayBdICkgfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIF9lMCApIHt9XHJcblx0XHRcdGZvcm1fc2V0dGluZ3MuY3NzX3ZhcnMgPSBvdXQ7XHJcblx0XHR9XHJcblx0XHRpZiAoICEgZm9ybV9zZXR0aW5ncy5iZmJfb3B0aW9ucyB8fCB0eXBlb2YgZm9ybV9zZXR0aW5ncy5iZmJfb3B0aW9ucyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdGZvcm1fc2V0dGluZ3MuYmZiX29wdGlvbnMgPSB7IGFkdmFuY2VkX21vZGVfc291cmNlOiAnYnVpbGRlcicgfTtcclxuXHRcdH1cclxuXHRcdGlmICggISBmb3JtX3NldHRpbmdzLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlICkge1xyXG5cdFx0XHRmb3JtX3NldHRpbmdzLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlID0gJ2J1aWxkZXInO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBwYXlsb2FkID0ge1xyXG5cdFx0XHRhY3Rpb24gICAgICAgIDogJ1dQQkNfQUpYX0JGQl9TQVZFX0ZPUk1fQ09ORklHJyxcclxuXHRcdFx0bm9uY2UgICAgICAgICA6IGNmZy5ub25jZV9zYXZlIHx8ICcnLFxyXG5cdFx0XHRmb3JtX25hbWUgICAgIDogY2ZnLmZvcm1fbmFtZSB8fCAnc3RhbmRhcmQnLFxyXG5cdFx0XHRlbmdpbmUgICAgICAgIDogY2ZnLmVuZ2luZSB8fCAnYmZiJyxcclxuXHRcdFx0ZW5naW5lX3ZlcnNpb246IGNmZy5lbmdpbmVfdmVyc2lvbiB8fCAnMS4wJyxcclxuXHRcdFx0c3RydWN0dXJlICAgICA6IEpTT04uc3RyaW5naWZ5KCBzdHJ1Y3R1cmUgKSxcclxuXHRcdFx0c2V0dGluZ3MgICAgICA6IEpTT04uc3RyaW5naWZ5KCBmb3JtX3NldHRpbmdzIClcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIENob29zZSB3aGVyZSBhZHZhbmNlZF9mb3JtICsgY29udGVudF9mb3JtIGFyZSB0YWtlbiBmcm9tLlxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBzYXZlX3NvdXJjZSA9IGdldF9zYXZlX3NvdXJjZSggY2ZnLCBidG4gKTtcclxuXHJcblx0XHQvLyAxKSBUcnkgQWR2YW5jZWQgTW9kZSB0ZXh0IChpZiBzZWxlY3RlZCAvIGF1dG8rZGlydHkpLlxyXG5cdFx0dmFyIGFkdiA9IG51bGw7XHJcblxyXG5cdFx0aWYgKCBzYXZlX3NvdXJjZSA9PT0gJ2FkdmFuY2VkJyB8fCBzYXZlX3NvdXJjZSA9PT0gJ2F1dG8nICkge1xyXG5cdFx0XHRhZHYgPSByZWFkX2FkdmFuY2VkX21vZGVfcGF5bG9hZCgpO1xyXG5cclxuXHRcdFx0dmFyIGNhbl91c2VfYWR2YW5jZWQgPVxyXG5cdFx0XHRcdFx0KCBzYXZlX3NvdXJjZSA9PT0gJ2FkdmFuY2VkJyApIHx8XHJcblx0XHRcdFx0XHQoIHNhdmVfc291cmNlID09PSAnYXV0bycgJiYgYWR2ICYmIGFkdi5pc19kaXJ0eSApO1xyXG5cclxuXHRcdFx0aWYgKCBjYW5fdXNlX2FkdmFuY2VkICkge1xyXG5cclxuXHRcdFx0XHQvLyBJZiB1c2VyIGZvcmNlZCBcImFkdmFuY2VkXCIgYnV0IGJvdGggYXJlIGVtcHR5IC0+IGZhbGxiYWNrIHRvIGV4cG9ydGVyLlxyXG5cdFx0XHRcdGlmICggISBoYXNfdGV4dCggYWR2LmFkdmFuY2VkX2Zvcm0gKSAmJiAhIGhhc190ZXh0KCBhZHYuY29udGVudF9mb3JtICkgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0FkdmFuY2VkIE1vZGUgaXMgc2VsZWN0ZWQsIGJ1dCBlZGl0b3JzIGFyZSBlbXB0eS4gVXNpbmcgQnVpbGRlciBleHBvcnQuJywgJ3dhcm5pbmcnLCA2MDAwICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICggaGFzX3RleHQoIGFkdi5hZHZhbmNlZF9mb3JtICkgKSB7XHJcblx0XHRcdFx0XHRcdHBheWxvYWQuYWR2YW5jZWRfZm9ybSA9IGFkdi5hZHZhbmNlZF9mb3JtO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBoYXNfdGV4dCggYWR2LmNvbnRlbnRfZm9ybSApICkge1xyXG5cdFx0XHRcdFx0XHRwYXlsb2FkLmNvbnRlbnRfZm9ybSA9IGFkdi5jb250ZW50X2Zvcm07XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRmb3JtX3NldHRpbmdzLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlID0gJ2FkdmFuY2VkJztcclxuXHRcdFx0XHRcdHBheWxvYWQuc2V0dGluZ3MgPSBKU09OLnN0cmluZ2lmeSggZm9ybV9zZXR0aW5ncyApOyAvLyBrZWVwIHBheWxvYWQgaW4gc3luYy5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAyKSBJZiBub3QgdGFrZW4gZnJvbSBBZHZhbmNlZCBNb2RlIC0+IGV4cG9ydCBmcm9tIEJ1aWxkZXIgc3RydWN0dXJlIChjdXJyZW50IGJlaGF2aW9yKS5cclxuXHRcdGlmICggISBwYXlsb2FkLmFkdmFuY2VkX2Zvcm0gfHwgISBwYXlsb2FkLmNvbnRlbnRfZm9ybSApIHtcclxuXHJcblx0XHRcdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfYWxsID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUHJlZmVyIE9wdGlvbiBBIHBhY2s6IHNldHRpbmdzLm9wdGlvbnMuKlxyXG5cdFx0XHRcdFx0dmFyIG9wdF9wYWNrICAgICAgID0gZm9ybV9zZXR0aW5ncy5vcHRpb25zO1xyXG5cdFx0XHRcdFx0dmFyIHdpZHRoX2NvbWJpbmVkID0gb3B0X3BhY2suYm9va2luZ19mb3JtX2xheW91dF93aWR0aCB8fCAnJztcclxuXHRcdFx0XHRcdHZhciBwYXJzZWRfd2lkdGggICA9IHBhcnNlX2xlbmd0aF92YWx1ZSggd2lkdGhfY29tYmluZWQgKTtcclxuXHJcblx0XHRcdFx0XHR2YXIgZXhwb3J0X29wdGlvbnMgPSB7XHJcblx0XHRcdFx0XHRcdGdhcFBlcmNlbnQgICAgICA6IDMsXHJcblx0XHRcdFx0XHRcdGZvcm1fc2x1ZyAgICAgICA6IHBheWxvYWQuZm9ybV9uYW1lLFxyXG5cdFx0XHRcdFx0XHRmb3JtX3dpZHRoX3ZhbHVlOiBwYXJzZWRfd2lkdGgubnVtLFxyXG5cdFx0XHRcdFx0XHRmb3JtX3dpZHRoX3VuaXQgOiBwYXJzZWRfd2lkdGgudW5pdFxyXG5cdFx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0XHR2YXIgZXhwb3J0X3Jlc3VsdCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCggc3RydWN0dXJlIHx8IFtdLCBleHBvcnRfb3B0aW9ucyApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggZXhwb3J0X3Jlc3VsdCApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCAhIHBheWxvYWQuYWR2YW5jZWRfZm9ybSAmJiBleHBvcnRfcmVzdWx0LmFkdmFuY2VkX2Zvcm0gKSB7XHJcblx0XHRcdFx0XHRcdFx0cGF5bG9hZC5hZHZhbmNlZF9mb3JtID0gZXhwb3J0X3Jlc3VsdC5hZHZhbmNlZF9mb3JtO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGlmICggISBwYXlsb2FkLmNvbnRlbnRfZm9ybSAmJiBleHBvcnRfcmVzdWx0LmZpZWxkc19kYXRhICkge1xyXG5cdFx0XHRcdFx0XHRcdHBheWxvYWQuY29udGVudF9mb3JtID0gZXhwb3J0X3Jlc3VsdC5maWVsZHNfZGF0YTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGZvcm1fc2V0dGluZ3MuYmZiX29wdGlvbnMuYWR2YW5jZWRfbW9kZV9zb3VyY2UgPSAnYnVpbGRlcic7XHJcblx0XHRcdFx0XHRwYXlsb2FkLnNldHRpbmdzID0gSlNPTi5zdHJpbmdpZnkoIGZvcm1fc2V0dGluZ3MgKTsgLy8ga2VlcCBwYXlsb2FkIGluIHN5bmMuXHJcblxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogZXhwb3J0X2FsbCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGV4cG9ydF9hbGwgZXJyb3InLCBlICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVXBkYXRlIHBheWxvYWQgYmVmb3JlIHNlbmQgdmlhIEFKQVgsICBpZiBuZWVkZWQuXHJcblx0XHR2YXIgaG9va19kZXRhaWwgPSB7IHBheWxvYWQ6IHBheWxvYWQgfTtcclxuXHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybTpiZWZvcmVfc2F2ZV9wYXlsb2FkJywgaG9va19kZXRhaWwgKTtcclxuXHRcdHBheWxvYWQgPSBob29rX2RldGFpbC5wYXlsb2FkO1xyXG5cclxuXHRcdHZhciBhamF4X3JlcXVlc3QgPSB3cGJjX2JmYl9fYWpheF9wb3N0KCBjZmcudXJsLCBwYXlsb2FkICk7XHJcblxyXG5cdFx0YWpheF9yZXF1ZXN0XHJcblx0XHRcdC5kb25lKFxyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCwgX3RleHRfc3RhdHVzLCBqcXhociApIHtcclxuXHJcblx0XHRcdFx0XHQvLyBLZWVwIG9sZCBiZWhhdmlvcjogb25seSB0cmVhdCBleGFjdCAyMDAgYXMgc3VjY2Vzcy5cclxuXHRcdFx0XHRcdGlmICggISBqcXhociB8fCBqcXhoci5zdGF0dXMgIT09IDIwMCApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0XHR0cnkgeyBkb25lX2NiKCBmYWxzZSwgbnVsbCApOyB9IGNhdGNoICggX2UxICkge31cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBzYXZlIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IHNhdmUgSFRUUCBlcnJvcicsIGpxeGhyID8ganF4aHIuc3RhdHVzIDogMCApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIHJlc3AgPSB3cGJjX2JmYl9fc2FmZV9qc29uX3BhcnNlKCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0XHRpZiAoICEgcmVzcCApIHtcclxuXHRcdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogc2F2ZSBKU09OIHBhcnNlIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBzYXZlIEpTT04gcGFyc2UgZXJyb3InLCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoICEgcmVzcCB8fCAhIHJlc3Auc3VjY2VzcyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgZXJyb3JfbWVzc2FnZSA9ICggIHJlc3AuZGF0YSAmJiAgcmVzcC5kYXRhLm1lc3NhZ2UgKSA/IHJlc3AuZGF0YS5tZXNzYWdlIDogJyc7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IHNhdmUgZmFpbGVkLicgKyAnIHwgJyArIGVycm9yX21lc3NhZ2UsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogc2F2ZSBmYWlsZWQnLCByZXNwICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR0cnkgeyBkb25lX2NiKCB0cnVlLCByZXNwICk7IH0gY2F0Y2ggKCBfZTIgKSB7fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybTphamF4X3NhdmVkJywge1xyXG5cdFx0XHRcdFx0XHRsb2FkZWRfZGF0YTogcmVzcC5kYXRhLFxyXG5cdFx0XHRcdFx0XHRmb3JtX25hbWUgIDogY2ZnLmZvcm1fbmFtZSB8fCAnc3RhbmRhcmQnXHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdHJlc3AuZGF0YVxyXG5cdFx0XHRcdFx0XHQmJiByZXNwLmRhdGEuc2V0dXBfc3RlcF9zYXZlZFxyXG5cdFx0XHRcdFx0XHQmJiB0eXBlb2Ygdy53cGJjX3NldHVwX3dpemFyZF9zZXRfY3VycmVudF9zdGVwX3NhdmVkID09PSAnZnVuY3Rpb24nXHJcblx0XHRcdFx0XHQpIHtcclxuXHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHR3LndwYmNfc2V0dXBfd2l6YXJkX3NldF9jdXJyZW50X3N0ZXBfc2F2ZWQoKTtcclxuXHRcdFx0XHRcdFx0fSBjYXRjaCAoIF9lX3NldHVwX3NldCApIHt9XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2Ygdy53cGJjX3NldHVwX3dpemFyZF9tYXJrX2N1cnJlbnRfc3RlcF9zYXZlZCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0XHR3LndwYmNfc2V0dXBfd2l6YXJkX21hcmtfY3VycmVudF9zdGVwX3NhdmVkKCk7XHJcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKCBfZV9zZXR1cCApIHt9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gT3B0aW9uYWw6IHZpc3VhbCBmZWVkYmFjay5cclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnRm9ybSBzYXZlZCcsICdzdWNjZXNzJywgMTAwMCwgZmFsc2UgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdClcclxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICgganF4aHIgKSB7XHJcblxyXG5cdFx0XHRcdC8vIE9sZCBiZWhhdmlvcjogc3RhdHVzICE9IDIwMCB0cmlnZ2VycyBkb25lX2NiKGZhbHNlLCBudWxsKS5cclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dHJ5IHsgZG9uZV9jYiggZmFsc2UsIG51bGwgKTsgfSBjYXRjaCAoIF9lMyApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBzYXZlIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogc2F2ZSBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRcdC8vIC0tLSBCdXN5IEVORCAoYWx3YXlzKSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICYmIHR5cGVvZiB3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQoICRidG4gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0JGJ0bi5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApLnJlbW92ZUNsYXNzKCAnd3BiYy1pcy1idXN5JyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGJ0biApIHtcclxuXHRcdFx0XHRcdGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyggYWR2YW5jZWRfZm9ybSwgY29udGVudF9mb3JtLCBhZHZhbmNlZF9tb2RlX3NvdXJjZSApIHtcclxuXHJcblx0XHR2YXIgYWYgPSAoIGFkdmFuY2VkX2Zvcm0gPT0gbnVsbCApID8gJycgOiBTdHJpbmcoIGFkdmFuY2VkX2Zvcm0gKTtcclxuXHRcdHZhciBjZiA9ICggY29udGVudF9mb3JtID09IG51bGwgKSA/ICcnIDogU3RyaW5nKCBjb250ZW50X2Zvcm0gKTtcclxuXHJcblx0XHQvLyBBbHdheXMgdXBkYXRlIHVuZGVybHlpbmcgPHRleHRhcmVhPiBzbyBpdCB3b3JrcyBldmVuIGlmIENvZGVNaXJyb3IgaXNuJ3QgaW5pdGVkIHlldC5cclxuXHRcdHZhciB0YV9mb3JtICAgID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX2VkaXRvcicgKTtcclxuXHRcdHZhciB0YV9jb250ZW50ID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fZWRpdG9yJyApO1xyXG5cclxuXHRcdGlmICggdGFfZm9ybSApIHtcclxuXHRcdFx0dGFfZm9ybS52YWx1ZSA9IGFmO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCB0YV9jb250ZW50ICkge1xyXG5cdFx0XHR0YV9jb250ZW50LnZhbHVlID0gY2Y7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTm90aWZ5IEFkdmFuY2VkIE1vZGUgbW9kdWxlIChpZiBsb2FkZWQpIHRvIHN5bmMgQ29kZU1pcnJvciArIGZsYWdzLlxyXG5cdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjphZHZhbmNlZF90ZXh0OmFwcGx5Jywge1xyXG5cdFx0XHRhZHZhbmNlZF9mb3JtICAgICAgIDogYWYsXHJcblx0XHRcdGNvbnRlbnRfZm9ybSAgICAgICAgOiBjZixcclxuXHRcdFx0YWR2YW5jZWRfbW9kZV9zb3VyY2U6IGFkdmFuY2VkX21vZGVfc291cmNlXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBMT0FEOiBmZXRjaCBGb3JtQ29uZmlnIGZyb20gUEhQIGFuZCBoYW5kIHN0cnVjdHVyZSB0byBCdWlsZGVyLlxyXG5cdCAqXHJcblx0ICogQWxzbyB1c2VzIGJ1c3kgaGVscGVycyBpZiBhdmFpbGFibGUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2FqYXhfbG9hZF9jdXJyZW50X2Zvcm0oIGJ0biwgZG9uZV9jYiApIHtcclxuXHJcblx0XHR2YXIgY2ZnICAgICA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdHZhciBidWlsZGVyID0gdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cclxuXHRcdHZhciAkYnRuID0gYnRuID8gJCggYnRuICkgOiBudWxsO1xyXG5cclxuXHRcdC8vIC0tLSBCdXN5IFNUQVJUIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQgPT09ICdmdW5jdGlvbicgKSB7ICAgICAgICAgIC8vIEZJWDogZ3VhcmRcclxuXHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9zdGFydCggJGJ0biApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCRidG4ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKCBidG4gKSB7XHJcblx0XHRcdGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHBheWxvYWQgPSB7XHJcblx0XHRcdGFjdGlvbiAgIDogJ1dQQkNfQUpYX0JGQl9MT0FEX0ZPUk1fQ09ORklHJyxcclxuXHRcdFx0bm9uY2UgICAgOiBjZmcubm9uY2VfbG9hZCB8fCAnJyxcclxuXHRcdFx0Zm9ybV9uYW1lOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdH07XHJcblxyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyggJycgKTtcclxuXHRcdC8vIHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnUHJvY2Vzc2luZycsICdpbmZvJywgMTAwMCwgZmFsc2UgKTsgICAgLy8gT3B0aW9uYWw6IHZpc3VhbCBmZWVkYmFjay5cclxuXHJcblx0XHR2YXIgYWpheF9yZXF1ZXN0ID0gd3BiY19iZmJfX2FqYXhfcG9zdCggY2ZnLnVybCwgcGF5bG9hZCApO1xyXG5cclxuXHRcdGFqYXhfcmVxdWVzdFxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZV90ZXh0LCBfdGV4dF9zdGF0dXMsIGpxeGhyICkge1xyXG5cclxuXHRcdFx0XHRpZiAoICEganF4aHIgfHwganF4aHIuc3RhdHVzICE9PSAyMDAgKSB7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dHJ5IHsgZG9uZV9jYiggZmFsc2UsIG51bGwgKTsgfSBjYXRjaCAoIF9lMCApIHt9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbG9hZCBIVFRQIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbG9hZCBIVFRQIGVycm9yJywganF4aHIgPyBqcXhoci5zdGF0dXMgOiAwICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgcmVzcCA9IHdwYmNfYmZiX19zYWZlX2pzb25fcGFyc2UoIHJlc3BvbnNlX3RleHQgKTtcclxuXHRcdFx0XHRpZiAoICEgcmVzcCApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxvYWQgSlNPTiBwYXJzZSBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxvYWQgSlNPTiBwYXJzZSBlcnJvcicsIHJlc3BvbnNlX3RleHQgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISByZXNwIHx8ICEgcmVzcC5zdWNjZXNzIHx8ICEgcmVzcC5kYXRhICkge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbG9hZCBmYWlsZWQnLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBsb2FkIGZhaWxlZCcsIHJlc3AgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciBkYXRhICAgICAgPSByZXNwLmRhdGE7XHJcblx0XHRcdFx0dmFyIHN0cnVjdHVyZSA9IGRhdGEuc3RydWN0dXJlIHx8IFtdO1xyXG5cclxuXHRcdFx0XHQvLyBBcHBseSBBZHZhbmNlZCBNb2RlIHNhdmVkIHRleHRzIChpZiBwcm92aWRlZCBieSBQSFApLlxyXG5cdFx0XHRcdGlmICggZGF0YSAmJiAoIHR5cGVvZiBkYXRhLmFkdmFuY2VkX2Zvcm0gIT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBkYXRhLmNvbnRlbnRfZm9ybSAhPT0gJ3VuZGVmaW5lZCcgKSApIHtcclxuXHRcdFx0XHRcdHZhciBhbXMgPSAnJztcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdHZhciBzMSA9ICggdHlwZW9mIGRhdGEuc2V0dGluZ3MgPT09ICdzdHJpbmcnICkgPyBKU09OLnBhcnNlKCBkYXRhLnNldHRpbmdzICkgOiBkYXRhLnNldHRpbmdzO1xyXG5cdFx0XHRcdFx0XHRhbXMgPSAoIHMxICYmIHMxLmJmYl9vcHRpb25zICYmIHMxLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlICkgPyBzMS5iZmJfb3B0aW9ucy5hZHZhbmNlZF9tb2RlX3NvdXJjZSA6ICcnO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lMSApIHt9XHJcblxyXG5cdFx0XHRcdFx0YXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyhcclxuXHRcdFx0XHRcdFx0ZGF0YS5hZHZhbmNlZF9mb3JtIHx8ICcnLFxyXG5cdFx0XHRcdFx0XHRkYXRhLmNvbnRlbnRfZm9ybSB8fCAnJyxcclxuXHRcdFx0XHRcdFx0YW1zXHJcblx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gQXBwbHkgc2V0dGluZ3MgdG8gVUkgKGxvY2FsIGZvcm0gc2V0dGluZ3MpIGlmIHByb3ZpZGVkLlxyXG5cdFx0XHRcdGlmICggZGF0YS5zZXR0aW5ncyApIHtcclxuXHRcdFx0XHRcdHZhciBwYXJzZWRfc2V0dGluZ3MgPSBudWxsO1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0cGFyc2VkX3NldHRpbmdzID0gKCB0eXBlb2YgZGF0YS5zZXR0aW5ncyA9PT0gJ3N0cmluZycgKSA/IEpTT04ucGFyc2UoIGRhdGEuc2V0dGluZ3MgKSA6IGRhdGEuc2V0dGluZ3M7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UyICkge1xyXG5cdFx0XHRcdFx0XHRwYXJzZWRfc2V0dGluZ3MgPSBudWxsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBwYXJzZWRfc2V0dGluZ3MgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczphcHBseScsIHtcclxuXHRcdFx0XHRcdFx0XHRzZXR0aW5ncyA6IHBhcnNlZF9zZXR0aW5ncyxcclxuXHRcdFx0XHRcdFx0XHRmb3JtX25hbWU6IGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmZvcm06YWpheF9sb2FkZWQnLCB7XHJcblx0XHRcdFx0XHRsb2FkZWRfZGF0YTogZGF0YSxcclxuXHRcdFx0XHRcdGZvcm1fbmFtZSAgOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR0cnkgeyBkb25lX2NiKCB0cnVlLCBkYXRhICk7IH0gY2F0Y2ggKCBfZTMgKSB7fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gUHJlZmVyIHlvdXIgZXhpc3RpbmcgY2FsbGJhY2sgaWYgaXQgYWxyZWFkeSBrbm93cyBob3cgdG8gaW5pdCBCdWlsZGVyLlxyXG5cdFx0XHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkKCBzdHJ1Y3R1cmUgKTtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnRG9uZScsICdpbmZvJywgMTAwMCwgZmFsc2UgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBidWlsZGVyICYmIHR5cGVvZiBidWlsZGVyLmxvYWRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0YnVpbGRlci5sb2FkX3N0cnVjdHVyZSggc3RydWN0dXJlICk7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0RvbmUnLCAnaW5mbycsIDEwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbnNvbGUud2FybiggJ1dQQkMgQkZCOiBubyBsb2FkZXIgZm9yIHN0cnVjdHVyZScsIHN0cnVjdHVyZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApXHJcblx0XHRcdC5mYWlsKCBmdW5jdGlvbiAoIGpxeGhyICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dHJ5IHsgZG9uZV9jYiggZmFsc2UsIG51bGwgKTsgfSBjYXRjaCAoIF9lNCApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsb2FkIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbG9hZCBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRcdC8vIC0tLSBCdXN5IEVORCAoYWx3YXlzKSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICYmIHR5cGVvZiB3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQoICRidG4gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0JGJ0bi5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApLnJlbW92ZUNsYXNzKCAnd3BiYy1pcy1idXN5JyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGJ0biApIHtcclxuXHRcdFx0XHRcdGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2FqYXhfY3JlYXRlX2Zvcm0oIGJ0biwgY3JlYXRlX3BheWxvYWQsIHRlbXBsYXRlX2Zvcm1fa2V5LCBkb25lX2NiICkge1xyXG5cclxuXHRcdHZhciBjZmcgPSB3LldQQkNfQkZCX0FqYXggfHwge307XHJcblxyXG5cdFx0aWYgKCAhIGNmZy51cmwgfHwgISBjZmcubm9uY2VfY3JlYXRlICkge1xyXG5cdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBjcmVhdGUgY29uZmlnIGlzIG1pc3NpbmcgKHVybC9ub25jZSkuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0ZW1wbGF0ZV9mb3JtX2tleSA9IFN0cmluZyggdGVtcGxhdGVfZm9ybV9rZXkgfHwgJycgKS50cmltKCk7XHJcblx0XHRpZiAoIHRlbXBsYXRlX2Zvcm1fa2V5ID09PSAnX19ibGFua19fJyApIHtcclxuXHRcdFx0dGVtcGxhdGVfZm9ybV9rZXkgPSAnJztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcGF5bG9hZCA9IHtcclxuXHRcdFx0YWN0aW9uICAgICAgICAgICAgOiAnV1BCQ19BSlhfQkZCX0NSRUFURV9GT1JNX0NPTkZJRycsXHJcblx0XHRcdG5vbmNlICAgICAgICAgICAgIDogY2ZnLm5vbmNlX2NyZWF0ZSxcclxuXHRcdFx0Zm9ybV9uYW1lICAgICAgICAgOiBTdHJpbmcoIGNyZWF0ZV9wYXlsb2FkLmZvcm1fc2x1ZyB8fCAnJyApLFxyXG5cdFx0XHR0ZW1wbGF0ZV9mb3JtX25hbWU6IHRlbXBsYXRlX2Zvcm1fa2V5IHx8ICcnLFxyXG5cdFx0XHR0aXRsZSAgICAgICAgICAgICA6IFN0cmluZyggY3JlYXRlX3BheWxvYWQuZm9ybV90aXRsZSB8fCAnJyApLFxyXG5cdFx0XHRkZXNjcmlwdGlvbiAgICAgICA6IFN0cmluZyggY3JlYXRlX3BheWxvYWQuZm9ybV9kZXNjcmlwdGlvbiB8fCAnJyApLFxyXG5cdFx0XHRpbWFnZV91cmwgICAgICAgICA6IFN0cmluZyggY3JlYXRlX3BheWxvYWQuZm9ybV9pbWFnZV91cmwgfHwgJycgKVxyXG5cdFx0fTtcclxuXHJcblx0XHR2YXIgYWpheF9yZXF1ZXN0ID0gd3BiY19iZmJfX2FqYXhfcG9zdCggY2ZnLnVybCwgcGF5bG9hZCApO1xyXG5cclxuXHRcdGFqYXhfcmVxdWVzdFxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZV90ZXh0LCBfdGV4dF9zdGF0dXMsIGpxeGhyICkge1xyXG5cclxuXHRcdFx0XHRpZiAoICEganF4aHIgfHwganF4aHIuc3RhdHVzICE9PSAyMDAgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBjcmVhdGUgSFRUUCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIHJlc3AgPSB3cGJjX2JmYl9fc2FmZV9qc29uX3BhcnNlKCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBjcmVhdGUgSlNPTiBwYXJzZSBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgfHwgISByZXNwLnN1Y2Nlc3MgfHwgISByZXNwLmRhdGEgKSB7XHJcblx0XHRcdFx0XHR2YXIgbXNnID0gKCByZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSApID8gcmVzcC5kYXRhLm1lc3NhZ2UgOiAnV1BCQyBCRkI6IGNyZWF0ZSBmYWlsZWQnO1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIG1zZywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCByZXNwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBTd2l0Y2ggY3VycmVudCBmb3JtIHRvIHRoZSBuZXdseSBjcmVhdGVkIGtleS5cclxuXHRcdFx0XHRjZmcuZm9ybV9uYW1lID0gcmVzcC5kYXRhLmZvcm1fbmFtZSB8fCBjcmVhdGVfcGF5bG9hZC5mb3JtX3NsdWc7XHJcblxyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCB0cnVlLCByZXNwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IClcclxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICgganF4aHIgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogY3JlYXRlIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGNyZWF0ZSBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdC8vIExvYWQgQUxMIEZvcm1zLlxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X2xpc3RfdXNlcl9mb3JtcyggYnRuLCBhcmdzLCBkb25lX2NiICkge1xyXG5cclxuXHRcdHZhciBjZmcgPSB3LldQQkNfQkZCX0FqYXggfHwge307XHJcblxyXG5cdFx0aWYgKCAhIGNmZy51cmwgfHwgISBjZmcubm9uY2VfbGlzdCApIHtcclxuXHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbGlzdCBjb25maWcgaXMgbWlzc2luZyAodXJsL25vbmNlX2xpc3QpLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHBhZ2UgID0gKCBhcmdzICYmIGFyZ3MucGFnZSApID8gcGFyc2VJbnQoIGFyZ3MucGFnZSwgMTAgKSA6IDE7XHJcblx0XHR2YXIgbGltaXQgPSAoIGFyZ3MgJiYgKCBhcmdzLmxpbWl0IHx8IGFyZ3MucGVyX3BhZ2UgKSApID8gcGFyc2VJbnQoICggYXJncy5saW1pdCB8fCBhcmdzLnBlcl9wYWdlICksIDEwICkgOiAyMDtcclxuXHJcblx0XHRpZiAoICEgcGFnZSB8fCBwYWdlIDwgMSApIHtcclxuXHRcdFx0cGFnZSA9IDE7XHJcblx0XHR9XHJcblx0XHRpZiAoICEgbGltaXQgfHwgbGltaXQgPCAxICkge1xyXG5cdFx0XHRsaW1pdCA9IDIwO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBwYXlsb2FkID0ge1xyXG5cdFx0XHRhY3Rpb24gICAgICAgIDogJ1dQQkNfQUpYX0JGQl9MSVNUX0ZPUk1TJyxcclxuXHRcdFx0bm9uY2UgICAgICAgICA6IGNmZy5ub25jZV9saXN0LFxyXG5cdFx0XHRpbmNsdWRlX2dsb2JhbDogKCBhcmdzICYmIGFyZ3MuaW5jbHVkZV9nbG9iYWwgKSA/IDEgOiAwLFxyXG5cdFx0XHRzdGF0dXMgICAgICAgIDogKCBhcmdzICYmIGFyZ3Muc3RhdHVzICkgPyBTdHJpbmcoIGFyZ3Muc3RhdHVzICkgOiAncHVibGlzaGVkJyxcclxuXHRcdFx0c2VhcmNoICAgICAgICA6ICggYXJncyAmJiBhcmdzLnNlYXJjaCApID8gU3RyaW5nKCBhcmdzLnNlYXJjaCApIDogJycsXHJcblx0XHRcdHBhZ2UgICAgICAgICAgOiBwYWdlLFxyXG5cdFx0XHRsaW1pdCAgICAgICAgIDogbGltaXRcclxuXHRcdH07XHJcblxyXG5cdFx0dmFyIGFqYXhfcmVxdWVzdCA9IHdwYmNfYmZiX19hamF4X3Bvc3QoIGNmZy51cmwsIHBheWxvYWQgKTtcclxuXHJcblx0XHRhamF4X3JlcXVlc3RcclxuXHRcdFx0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCwgX3RleHRfc3RhdHVzLCBqcXhociApIHtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGpxeGhyIHx8IGpxeGhyLnN0YXR1cyAhPT0gMjAwICkge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbGlzdCBIVFRQIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgcmVzcCA9IHdwYmNfYmZiX19zYWZlX2pzb25fcGFyc2UoIHJlc3BvbnNlX3RleHQgKTtcclxuXHRcdFx0XHRpZiAoICEgcmVzcCApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxpc3QgSlNPTiBwYXJzZSBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgfHwgISByZXNwLnN1Y2Nlc3MgfHwgISByZXNwLmRhdGEgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsaXN0IGZhaWxlZCcsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgcmVzcCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmVfY2IoIHRydWUsIHJlc3AuZGF0YSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApXHJcblx0XHRcdC5mYWlsKCBmdW5jdGlvbiAoIGpxeGhyICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxpc3QgSFRUUCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbGlzdCBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X2xvYWRfZm9ybV9ieV9zbHVnKCBmb3JtX3NsdWcsIGJ0biwgZG9uZV9jYiApIHtcclxuXHJcblx0XHR2YXIgY2ZnICAgICA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdHZhciBidWlsZGVyID0gdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cclxuXHRcdGZvcm1fc2x1ZyA9IFN0cmluZyggZm9ybV9zbHVnIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0aWYgKCAhIGZvcm1fc2x1ZyApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgJGJ0biA9IGJ0biA/ICQoIGJ0biApIDogbnVsbDtcclxuXHJcblx0XHQvLyBCdXN5IFNUQVJUXHJcblx0XHRpZiAoICRidG4gJiYgJGJ0bi5sZW5ndGggKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0ID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHcud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkYnRuICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0JGJ0bi5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoIGJ0biApIHtcclxuXHRcdFx0YnRuLmRpc2FibGVkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcGF5bG9hZCA9IHtcclxuXHRcdFx0YWN0aW9uICAgOiAnV1BCQ19BSlhfQkZCX0xPQURfRk9STV9DT05GSUcnLFxyXG5cdFx0XHRub25jZSAgICA6IGNmZy5ub25jZV9sb2FkIHx8ICcnLFxyXG5cdFx0XHRmb3JtX25hbWU6IGZvcm1fc2x1Z1xyXG5cdFx0fTtcclxuXHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nKCAnJyApO1xyXG5cclxuXHRcdHZhciBhamF4X3JlcXVlc3QgPSB3cGJjX2JmYl9fYWpheF9wb3N0KCBjZmcudXJsLCBwYXlsb2FkICk7XHJcblxyXG5cdFx0YWpheF9yZXF1ZXN0XHJcblx0XHRcdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlX3RleHQsIF90ZXh0X3N0YXR1cywganF4aHIgKSB7XHJcblxyXG5cdFx0XHRcdGlmICggISBqcXhociB8fCBqcXhoci5zdGF0dXMgIT09IDIwMCApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxvYWQgSFRUUCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIHJlc3AgPSB3cGJjX2JmYl9fc2FmZV9qc29uX3BhcnNlKCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsb2FkIEpTT04gcGFyc2UgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISByZXNwIHx8ICEgcmVzcC5zdWNjZXNzIHx8ICEgcmVzcC5kYXRhICkge1xyXG5cclxuXHRcdFx0XHRcdGlmICggcmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhLm1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6ICcgKyByZXNwLmRhdGEubWVzc2FnZSwgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxvYWQgZmFpbGVkJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgcmVzcCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGRhdGEgICAgICA9IHJlc3AuZGF0YTtcclxuXHRcdFx0XHR2YXIgc3RydWN0dXJlID0gZGF0YS5zdHJ1Y3R1cmUgfHwgW107XHJcblxyXG5cdFx0XHRcdC8vIElNUE9SVEFOVDogc3dpdGNoIFwiY3VycmVudCBmb3JtXCIgYWZ0ZXIgc3VjY2Vzc2Z1bCBsb2FkXHJcblx0XHRcdFx0Y2ZnLmZvcm1fbmFtZSA9IGZvcm1fc2x1ZztcclxuXHJcblx0XHRcdFx0Ly8gQXBwbHkgQWR2YW5jZWQgTW9kZSB0ZXh0cyBpZiBwcmVzZW50LlxyXG5cdFx0XHRcdGlmICggZGF0YSAmJiAoIHR5cGVvZiBkYXRhLmFkdmFuY2VkX2Zvcm0gIT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBkYXRhLmNvbnRlbnRfZm9ybSAhPT0gJ3VuZGVmaW5lZCcgKSApIHtcclxuXHJcblx0XHRcdFx0XHR2YXIgYW1zMiA9ICcnO1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0dmFyIHMyID0gKCB0eXBlb2YgZGF0YS5zZXR0aW5ncyA9PT0gJ3N0cmluZycgKSA/IEpTT04ucGFyc2UoIGRhdGEuc2V0dGluZ3MgKSA6IGRhdGEuc2V0dGluZ3M7XHJcblx0XHRcdFx0XHRcdGFtczIgPSAoIHMyICYmIHMyLmJmYl9vcHRpb25zICYmIHMyLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlICkgPyBzMi5iZmJfb3B0aW9ucy5hZHZhbmNlZF9tb2RlX3NvdXJjZSA6ICcnO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lMiApIHt9XHJcblxyXG5cdFx0XHRcdFx0YXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyhcclxuXHRcdFx0XHRcdFx0ZGF0YS5hZHZhbmNlZF9mb3JtIHx8ICcnLFxyXG5cdFx0XHRcdFx0XHRkYXRhLmNvbnRlbnRfZm9ybSB8fCAnJyxcclxuXHRcdFx0XHRcdFx0YW1zMlxyXG5cdFx0XHRcdFx0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEFwcGx5IHNldHRpbmdzIGlmIHByZXNlbnQuXHJcblx0XHRcdFx0aWYgKCBkYXRhLnNldHRpbmdzICkge1xyXG5cdFx0XHRcdFx0dmFyIHBhcnNlZF9zZXR0aW5ncyA9IG51bGw7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRwYXJzZWRfc2V0dGluZ3MgPSAoIHR5cGVvZiBkYXRhLnNldHRpbmdzID09PSAnc3RyaW5nJyApID8gSlNPTi5wYXJzZSggZGF0YS5zZXR0aW5ncyApIDogZGF0YS5zZXR0aW5ncztcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfZTMgKSB7XHJcblx0XHRcdFx0XHRcdHBhcnNlZF9zZXR0aW5ncyA9IG51bGw7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHBhcnNlZF9zZXR0aW5ncyApIHtcclxuXHRcdFx0XHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5Jywge1xyXG5cdFx0XHRcdFx0XHRcdHNldHRpbmdzIDogcGFyc2VkX3NldHRpbmdzLFxyXG5cdFx0XHRcdFx0XHRcdGZvcm1fbmFtZTogY2ZnLmZvcm1fbmFtZSB8fCAnc3RhbmRhcmQnXHJcblx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybTphamF4X2xvYWRlZCcsIHtcclxuXHRcdFx0XHRcdGxvYWRlZF9kYXRhOiBkYXRhLFxyXG5cdFx0XHRcdFx0Zm9ybV9uYW1lICA6IGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHRyeSB7IGRvbmVfY2IoIHRydWUsIGRhdGEgKTsgfSBjYXRjaCAoIF9lNCApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dy53cGJjX2JmYl9fb25fc3RydWN0dXJlX2xvYWRlZCggc3RydWN0dXJlICk7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0RvbmUnLCAnaW5mbycsIDEwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5sb2FkX3N0cnVjdHVyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGJ1aWxkZXIubG9hZF9zdHJ1Y3R1cmUoIHN0cnVjdHVyZSApO1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdEb25lJywgJ2luZm8nLCAxMDAwLCBmYWxzZSApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oICdXUEJDIEJGQjogbm8gbG9hZGVyIGZvciBzdHJ1Y3R1cmUnLCBzdHJ1Y3R1cmUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCBqcXhociApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsb2FkIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxvYWQgSFRUUCBlcnJvcicsIGpxeGhyICYmIGpxeGhyLnN0YXR1cywganF4aHIgJiYganF4aHIuc3RhdHVzVGV4dCApO1xyXG5cdFx0XHR9IClcclxuXHRcdFx0LmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdFx0XHQvLyBCdXN5IEVORFxyXG5cdFx0XHRcdGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCAmJiB0eXBlb2Ygdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdCRidG4ucHJvcCggJ2Rpc2FibGVkJywgZmFsc2UgKS5yZW1vdmVDbGFzcyggJ3dwYmMtaXMtYnVzeScgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBidG4gKSB7XHJcblx0XHRcdFx0XHRidG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X2RlbGV0ZV90ZW1wbGF0ZV9ieV9zbHVnKCBmb3JtX3NsdWcsIGRvbmVfY2IgKSB7XHJcblxyXG5cdFx0dmFyIGNmZyAgICAgICAgICA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdHZhciBkZWxldGVfbm9uY2UgPSBjZmcubm9uY2VfZGVsZXRlIHx8IGNmZy5ub25jZV9saXN0IHx8ICcnO1xyXG5cclxuXHRcdGZvcm1fc2x1ZyA9IFN0cmluZyggZm9ybV9zbHVnIHx8ICcnICkudHJpbSgpO1xyXG5cclxuXHRcdGlmICggISBmb3JtX3NsdWcgKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIHsgZGF0YTogeyBtZXNzYWdlOiAnVGVtcGxhdGUga2V5IGlzIHJlcXVpcmVkLicgfSB9ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBjZmcudXJsIHx8ICEgZGVsZXRlX25vbmNlICkge1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGRlbGV0ZSB0ZW1wbGF0ZSBjb25maWcgaXMgbWlzc2luZyAodXJsL25vbmNlKS4nICk7XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIHsgZGF0YTogeyBtZXNzYWdlOiAnV1BCQyBCRkI6IGRlbGV0ZSB0ZW1wbGF0ZSBjb25maWcgaXMgbWlzc2luZyAodXJsL25vbmNlKS4nIH0gfSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcGF5bG9hZCA9IHtcclxuXHRcdFx0YWN0aW9uICAgOiAnV1BCQ19BSlhfQkZCX0RFTEVURV9URU1QTEFURV9DT05GSUcnLFxyXG5cdFx0XHRub25jZSAgICA6IGRlbGV0ZV9ub25jZSxcclxuXHRcdFx0Zm9ybV9uYW1lOiBmb3JtX3NsdWdcclxuXHRcdH07XHJcblxyXG5cdFx0dmFyIGFqYXhfcmVxdWVzdCA9IHdwYmNfYmZiX19hamF4X3Bvc3QoIGNmZy51cmwsIHBheWxvYWQgKTtcclxuXHJcblx0XHRhamF4X3JlcXVlc3RcclxuXHRcdFx0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCwgX3RleHRfc3RhdHVzLCBqcXhociApIHtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGpxeGhyIHx8IGpxeGhyLnN0YXR1cyAhPT0gMjAwICkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciByZXNwID0gd3BiY19iZmJfX3NhZmVfanNvbl9wYXJzZSggcmVzcG9uc2VfdGV4dCApO1xyXG5cdFx0XHRcdGlmICggISByZXNwICkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISByZXNwLnN1Y2Nlc3MgKSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgcmVzcCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmVfY2IoIHRydWUsIHJlc3AgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCBqcXhociApIHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBkZWxldGUgdGVtcGxhdGUgSFRUUCBlcnJvcicsIGpxeGhyICYmIGpxeGhyLnN0YXR1cywganF4aHIgJiYganF4aHIuc3RhdHVzVGV4dCApO1xyXG5cdFx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gRXhwb3NlIGdsb2JhbHMgZm9yIGJ1dHRvbnMgKG9uY2xpY2sgYXR0cmlidXRlcykuXHJcblx0dy53cGJjX2JmYl9fYWpheF9kZWxldGVfdGVtcGxhdGVfYnlfc2x1ZyA9IHdwYmNfYmZiX19hamF4X2RlbGV0ZV90ZW1wbGF0ZV9ieV9zbHVnO1xyXG5cdHcud3BiY19iZmJfX2FqYXhfc2F2ZV9jdXJyZW50X2Zvcm0gICAgICAgPSB3cGJjX2JmYl9fYWpheF9zYXZlX2N1cnJlbnRfZm9ybTtcclxuXHR3LndwYmNfYmZiX19hamF4X2xvYWRfY3VycmVudF9mb3JtICAgICAgID0gd3BiY19iZmJfX2FqYXhfbG9hZF9jdXJyZW50X2Zvcm07XHJcblx0dy53cGJjX2JmYl9fYWpheF9jcmVhdGVfZm9ybSAgICAgICAgICAgICA9IHdwYmNfYmZiX19hamF4X2NyZWF0ZV9mb3JtO1xyXG5cdHcud3BiY19iZmJfX2FqYXhfbGlzdF91c2VyX2Zvcm1zICAgICAgICAgPSB3cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXM7XHJcblx0dy53cGJjX2JmYl9fYWpheF9sb2FkX2Zvcm1fYnlfc2x1ZyAgICAgICA9IHdwYmNfYmZiX19hamF4X2xvYWRfZm9ybV9ieV9zbHVnO1xyXG5cclxufSkoIHdpbmRvdywgZG9jdW1lbnQsIHdpbmRvdy5qUXVlcnkgKTtcclxuXHJcblxyXG4vLyAtLSBBamF4IEhlbHBlcnM6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyoqXHJcbiAqIENvbW1vbiBjYWxsYmFjayB1c2VkIGJ5IGxvYWRlcnMgdGhhdCByZXR1cm4gc3RydWN0dXJlIEpTT04uXHJcbiAqXHJcbiAqIEBwYXJhbSB2YWxcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkKCB2YWwgKSB7XHJcblx0dHJ5IHtcclxuXHRcdGlmICggdHlwZW9mIHZhbCA9PT0gJ3N0cmluZycgKSB7XHJcblx0XHRcdHZhbCA9IEpTT04ucGFyc2UoIHZhbCApO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGJ1aWxkZXIgPSB3aW5kb3cud3BiY19iZmIgfHwgbnVsbDsgICAgICAgICAgICAgICAgICAgICAgIC8vIEZJWDogdXNlIHdpbmRvdy4qXHJcblx0XHRpZiAoIGJ1aWxkZXIgJiYgdHlwZW9mIGJ1aWxkZXIubG9hZF9zYXZlZF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdGJ1aWxkZXIubG9hZF9zYXZlZF9zdHJ1Y3R1cmUoIHZhbCB8fCBbXSApO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICd3cGJjX2JmYl9fb25fc3RydWN0dXJlX2xvYWRlZCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRjb25zb2xlLmVycm9yKCAnd3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQgZXJyb3InLCBlICk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X2FqYXhfdXJsKCkge1xyXG5cdGlmICggdHlwZW9mIGFqYXh1cmwgIT09ICd1bmRlZmluZWQnICYmIGFqYXh1cmwgKSB7XHJcblx0XHRyZXR1cm4gYWpheHVybDtcclxuXHR9XHJcblxyXG5cdHZhciBBamF4Q2ZnID0gd2luZG93LldQQkNfQkZCX0FqYXggfHwge307ICAgICAgICAgICAgICAgICAgICAgICAgLy8gRklYOiBndWFyZCB2aWEgd2luZG93LipcclxuXHRpZiAoIEFqYXhDZmcudXJsICkge1xyXG5cdFx0cmV0dXJuIEFqYXhDZmcudXJsO1xyXG5cdH1cclxuXHJcblx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogYWpheCBVUkwgaXMgbWlzc2luZy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogYWpheCBVUkwgaXMgbWlzc2luZy4nICk7XHJcblx0cmV0dXJuICcnO1xyXG59XHJcblxyXG5cclxuLy8gLS0gU2hhcmVkIGhlbHBlcnM6IGJ1dHRvbiBidXN5IHN0YXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19idXR0b25fYnVzeV9zdGFydCggJGJ0biApIHtcclxuXHJcblx0aWYgKCAhICRidG4gfHwgISAkYnRuLmxlbmd0aCApIHJldHVybjtcclxuXHJcblx0dmFyIG9yaWdpbmFsX2h0bWwgPSAkYnRuLmh0bWwoKTtcclxuXHR2YXIgYnVzeV90ZXh0ICAgICA9ICRidG4uZGF0YSggJ3dwYmMtdS1idXN5LXRleHQnICkgfHwgJyc7XHJcblx0dmFyIHNwaW5uZXJfaHRtbCAgPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluIHdwYmNfYWpheF9pY29uIHdwYmNfcHJvY2Vzc2luZyB3cGJjX2ljbl9hdXRvcmVuZXdcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L3NwYW4+JztcclxuXHJcblx0JGJ0blxyXG5cdFx0LmRhdGEoICd3cGJjLW9yaWdpbmFsLWh0bWwnLCBvcmlnaW5hbF9odG1sIClcclxuXHRcdC5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlIClcclxuXHRcdC5hZGRDbGFzcyggJ3dwYmMtaXMtYnVzeScgKTtcclxuXHJcblx0aWYgKCBidXN5X3RleHQgKSB7XHJcblx0XHQkYnRuLmh0bWwoIGJ1c3lfdGV4dCArICcgJyArIHNwaW5uZXJfaHRtbCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQkYnRuLmFwcGVuZCggc3Bpbm5lcl9odG1sICk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICkge1xyXG5cdGlmICggISAkYnRuIHx8ICEgJGJ0bi5sZW5ndGggKSByZXR1cm47XHJcblxyXG5cdHZhciBvcmlnaW5hbCA9ICRidG4uZGF0YSggJ3dwYmMtb3JpZ2luYWwtaHRtbCcgKTtcclxuXHRpZiAoIHR5cGVvZiBvcmlnaW5hbCA9PT0gJ3N0cmluZycgKSB7XHJcblx0XHQkYnRuLmh0bWwoIG9yaWdpbmFsICk7XHJcblx0fVxyXG5cdCRidG5cclxuXHRcdC5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApXHJcblx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjLWlzLWJ1c3knIClcclxuXHRcdC5yZW1vdmVEYXRhKCAnd3BiYy1vcmlnaW5hbC1odG1sJyApO1xyXG59XHJcblxyXG5cclxuLy8gLS0gSW1wb3J0IEhlbHBlcnM6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qKlxyXG4gKiBJbXBvcnQgZnJvbSBTaW1wbGUgRm9ybSDigJQgd2l0aCBidXN5IHN0YXRlXHJcbiAqXHJcbiAqIEBwYXJhbSBidG5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19pbXBvcnRfZnJvbV9zaW1wbGVfZm9ybSggYnRuICkge1xyXG5cdHRyeSB7XHJcblx0XHR2YXIgJGJ0biAgID0galF1ZXJ5KCBidG4gKTtcclxuXHRcdHZhciBub25jZSAgPSAkYnRuLmRhdGEoICd3cGJjLWJmYi1pbXBvcnQtbm9uY2UnICk7XHJcblx0XHR2YXIgYWN0aW9uID0gJGJ0bi5kYXRhKCAnd3BiYy1iZmItaW1wb3J0LWFjdGlvbicgKSB8fCAnd3BiY19iZmJfaW1wb3J0X3NpbXBsZV9mb3JtJztcclxuXHJcblx0XHRpZiAoICEgbm9uY2UgKSB7XHJcblx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IG1pc3NpbmcgaW1wb3J0IG5vbmNlLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbWlzc2luZyBpbXBvcnQgbm9uY2UuJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGFqYXhfdXJsID0gd3BiY19iZmJfX2dldF9hamF4X3VybCgpO1xyXG5cdFx0aWYgKCAhIGFqYXhfdXJsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkYnRuICk7XHJcblxyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyggJycgKTtcclxuXHJcblx0XHRqUXVlcnkucG9zdCggYWpheF91cmwsIHtcclxuXHRcdFx0YWN0aW9uOiBhY3Rpb24sXHJcblx0XHRcdG5vbmNlIDogbm9uY2VcclxuXHRcdH0gKVxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwICkge1xyXG5cdFx0XHRcdGlmICggcmVzcCAmJiByZXNwLnN1Y2Nlc3MgJiYgcmVzcC5kYXRhICYmIHJlc3AuZGF0YS5zdHJ1Y3R1cmUgKSB7XHJcblx0XHRcdFx0XHR2YXIgYnVpbGRlciA9IHdpbmRvdy53cGJjX2JmYiB8fCBudWxsOyAgICAgICAgICAgLy8gRklYOiB1c2Ugd2luZG93LipcclxuXHRcdFx0XHRcdGlmICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5sb2FkX3NhdmVkX3N0cnVjdHVyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0YnVpbGRlci5sb2FkX3NhdmVkX3N0cnVjdHVyZSggcmVzcC5kYXRhLnN0cnVjdHVyZSB8fCBbXSApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0RvbmUnLCAnaW5mbycsIDEwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGltcG9ydCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGltcG9ydCBlcnJvcicsIHJlc3AgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogQUpBWCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBBSkFYIGVycm9yJywgeGhyLnN0YXR1cywgeGhyLnN0YXR1c1RleHQgKTtcclxuXHRcdFx0fSApXHJcblx0XHRcdC5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBpbXBvcnQgZXhjZXB0aW9uJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogaW1wb3J0IGV4Y2VwdGlvbicsIGUgKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbXBvcnQgbGVnYWN5IGJvb2tpbmcgZm9ybXMgaW50byBCRkIgc3RvcmFnZS5cclxuICpcclxuICogU3VwcG9ydGVkIG1vZGVzOlxyXG4gKiAtIGN1cnJlbnRfY29udGV4dFxyXG4gKiAtIGFsbF9nbG9iYWxcclxuICogLSBhbGxfdXNlcnNcclxuICpcclxuICogQHBhcmFtIGJ0blxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19iZmJfX2ltcG9ydF9sZWdhY3lfZm9ybXMoIGJ0biApIHtcclxuXHR0cnkge1xyXG5cdFx0dmFyICRidG4gICA9IGpRdWVyeSggYnRuICk7XHJcblx0XHR2YXIgbm9uY2UgID0gJGJ0bi5kYXRhKCAnd3BiYy1iZmItaW1wb3J0LW5vbmNlJyApO1xyXG5cdFx0dmFyIGFjdGlvbiA9ICRidG4uZGF0YSggJ3dwYmMtYmZiLWltcG9ydC1hY3Rpb24nICkgfHwgJ1dQQkNfQUpYX0JGQl9JTVBPUlRfTEVHQUNZX0ZPUk1TJztcclxuXHRcdHZhciBtb2RlICAgPSAkYnRuLmRhdGEoICd3cGJjLWJmYi1pbXBvcnQtbW9kZScgKSB8fCAnY3VycmVudF9jb250ZXh0JztcclxuXHJcblx0XHR2YXIgc2tpcF9pZl9leGlzdHMgICAgICAgICAgID0gJGJ0bi5kYXRhKCAnd3BiYy1iZmItc2tpcC1pZi1leGlzdHMnICkgfHwgJ3NraXAnO1xyXG5cdFx0dmFyIHNldF9iZmJfZm9ybV9ub3RfZGVmaW5lZCA9ICRidG4uZGF0YSggJ3dwYmMtYmZiLXNldC1mb3JtLW5vdC1kZWZpbmVkJyApIHx8ICdub3RfZGVmaW5lZCc7XHJcblxyXG5cdFx0aWYgKCAhIG5vbmNlICkge1xyXG5cdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBtaXNzaW5nIGxlZ2FjeSBpbXBvcnQgbm9uY2UuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBtaXNzaW5nIGxlZ2FjeSBpbXBvcnQgbm9uY2UuJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGFqYXhfdXJsID0gd3BiY19iZmJfX2dldF9hamF4X3VybCgpO1xyXG5cdFx0aWYgKCAhIGFqYXhfdXJsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkYnRuICk7XHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nKCAnJyApO1xyXG5cclxuXHRcdGpRdWVyeS5wb3N0KCBhamF4X3VybCwge1xyXG5cdFx0XHRhY3Rpb24gICAgICAgICAgICAgICAgICA6IGFjdGlvbixcclxuXHRcdFx0bm9uY2UgICAgICAgICAgICAgICAgICAgOiBub25jZSxcclxuXHRcdFx0bW9kZSAgICAgICAgICAgICAgICAgICAgOiBtb2RlLFxyXG5cdFx0XHRza2lwX2lmX2V4aXN0cyAgICAgICAgICA6IHNraXBfaWZfZXhpc3RzLFxyXG5cdFx0XHRzZXRfYmZiX2Zvcm1fbm90X2RlZmluZWQ6IHNldF9iZmJfZm9ybV9ub3RfZGVmaW5lZCxcclxuXHRcdH0gKVxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIHJlc3AgJiYgcmVzcC5zdWNjZXNzICYmIHJlc3AuZGF0YSApIHtcclxuXHJcblx0XHRcdFx0XHR2YXIgbXNnID0gcmVzcC5kYXRhLm1lc3NhZ2UgfHwgJ0xlZ2FjeSBmb3JtcyBpbXBvcnQgZmluaXNoZWQuJztcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtc2csICdzdWNjZXNzJywgNjAwMCwgZmFsc2UgKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIHJlc3AuZGF0YS5pbXBvcnRlZCApIHtcclxuXHRcdFx0XHRcdFx0Ly8gUmVsb2FkIGN1cnJlbnQgZm9ybSwgIGlmIGltcG9ydGVkIHNvbWUgZm9ybXMuXHJcblx0XHRcdFx0XHRcdHdwYmNfYmZiX19hamF4X2xvYWRfY3VycmVudF9mb3JtKCBudWxsICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCBkb2N1bWVudCApLnRyaWdnZXIoICd3cGJjX2JmYl9sZWdhY3lfZm9ybXNfaW1wb3J0ZWQnLCBbIHJlc3AuZGF0YSBdICk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbGVnYWN5IGZvcm1zIGltcG9ydCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBpbXBvcnQgZXJyb3InLCByZXNwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IClcclxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICggeGhyICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBBSkFYIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBBSkFYIGVycm9yJywgeGhyLnN0YXR1cywgeGhyLnN0YXR1c1RleHQgKTtcclxuXHRcdFx0fSApXHJcblx0XHRcdC5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsZWdhY3kgZm9ybXMgaW1wb3J0IGV4Y2VwdGlvbicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBpbXBvcnQgZXhjZXB0aW9uJywgZSApO1xyXG5cdH1cclxufVxyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0EsQ0FB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

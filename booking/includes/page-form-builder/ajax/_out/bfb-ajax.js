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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWpheC9fb3V0L2JmYi1hamF4LmpzIiwibmFtZXMiOlsidyIsImQiLCIkIiwiQWpheENmZyIsIldQQkNfQkZCX0FqYXgiLCJ1cmwiLCJhamF4Iiwid3BiY19hZG1pbl9zaG93X21lc3NhZ2UiLCJjb25zb2xlIiwiZXJyb3IiLCJnZXRfc2F2ZV9zb3VyY2UiLCJjZmciLCJidG4iLCJ2IiwiZ2V0QXR0cmlidXRlIiwiZSIsInNhdmVfc291cmNlIiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJpbmRleE9mIiwicmVhZF9hZHZhbmNlZF9tb2RlX3BheWxvYWQiLCJ3cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpIiwiZ2V0X3ZhbHVlcyIsInRhX2Zvcm0iLCJnZXRFbGVtZW50QnlJZCIsInRhX2NvbnRlbnQiLCJhZHZhbmNlZF9mb3JtIiwidmFsdWUiLCJjb250ZW50X2Zvcm0iLCJpc19kaXJ0eSIsImhhc190ZXh0IiwidHJpbSIsIndwYmNfYmZiX19zZXJpYWxpemVfcG9zdF92YWx1ZSIsIkpTT04iLCJzdHJpbmdpZnkiLCJ3cGJjX2JmYl9fbm9ybWFsaXplX3Bvc3RfZGF0YSIsInJhd19kYXRhIiwib3V0IiwiayIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY2FsbCIsIndwYmNfYmZiX19hamF4X3Bvc3QiLCJwYXlsb2FkIiwidHlwZSIsImRhdGEiLCJkYXRhVHlwZSIsImNvbnRlbnRUeXBlIiwid3BiY19iZmJfX3NhZmVfanNvbl9wYXJzZSIsInRleHQiLCJwYXJzZSIsInBhcnNlX2xlbmd0aF92YWx1ZSIsInJhdyIsIm0iLCJtYXRjaCIsIm51bSIsInVuaXQiLCJ3cGJjX2JmYl9fYWpheF9zYXZlX2N1cnJlbnRfZm9ybSIsImRvbmVfY2IiLCJidWlsZGVyIiwid3BiY19iZmIiLCIkYnRuIiwibGVuZ3RoIiwid3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0IiwicHJvcCIsImRpc2FibGVkIiwic3RydWN0dXJlIiwiZ2V0X3N0cnVjdHVyZSIsImZvcm1fc2V0dGluZ3MiLCJvcHRpb25zIiwiY3NzX3ZhcnMiLCJiZmJfb3B0aW9ucyIsImFkdmFuY2VkX21vZGVfc291cmNlIiwid3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUiLCJzZXR0aW5ncyIsImZvcm1fbmFtZSIsIkFycmF5IiwiaXNBcnJheSIsInB1c2giLCJuYW1lIiwiX2UwIiwiYWN0aW9uIiwibm9uY2UiLCJub25jZV9zYXZlIiwiZW5naW5lIiwiZW5naW5lX3ZlcnNpb24iLCJhZHYiLCJjYW5fdXNlX2FkdmFuY2VkIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJleHBvcnRfYWxsIiwib3B0X3BhY2siLCJ3aWR0aF9jb21iaW5lZCIsImJvb2tpbmdfZm9ybV9sYXlvdXRfd2lkdGgiLCJwYXJzZWRfd2lkdGgiLCJleHBvcnRfb3B0aW9ucyIsImdhcFBlcmNlbnQiLCJmb3JtX3NsdWciLCJmb3JtX3dpZHRoX3ZhbHVlIiwiZm9ybV93aWR0aF91bml0IiwiZXhwb3J0X3Jlc3VsdCIsImZpZWxkc19kYXRhIiwiaG9va19kZXRhaWwiLCJhamF4X3JlcXVlc3QiLCJkb25lIiwicmVzcG9uc2VfdGV4dCIsIl90ZXh0X3N0YXR1cyIsImpxeGhyIiwic3RhdHVzIiwiX2UxIiwicmVzcCIsInN1Y2Nlc3MiLCJlcnJvcl9tZXNzYWdlIiwibWVzc2FnZSIsIl9lMiIsImxvYWRlZF9kYXRhIiwiZmFpbCIsIl9lMyIsInN0YXR1c1RleHQiLCJhbHdheXMiLCJ3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kIiwicmVtb3ZlQ2xhc3MiLCJhcHBseV9hZHZhbmNlZF9tb2RlX3RleHRzIiwiYWYiLCJjZiIsIndwYmNfYmZiX19hamF4X2xvYWRfY3VycmVudF9mb3JtIiwibm9uY2VfbG9hZCIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlX3Byb2Nlc3NpbmciLCJhbXMiLCJzMSIsInBhcnNlZF9zZXR0aW5ncyIsIndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkIiwibG9hZF9zdHJ1Y3R1cmUiLCJ3YXJuIiwiX2U0Iiwid3BiY19iZmJfX2FqYXhfY3JlYXRlX2Zvcm0iLCJjcmVhdGVfcGF5bG9hZCIsInRlbXBsYXRlX2Zvcm1fa2V5Iiwibm9uY2VfY3JlYXRlIiwidGVtcGxhdGVfZm9ybV9uYW1lIiwidGl0bGUiLCJmb3JtX3RpdGxlIiwiZGVzY3JpcHRpb24iLCJmb3JtX2Rlc2NyaXB0aW9uIiwiaW1hZ2VfdXJsIiwiZm9ybV9pbWFnZV91cmwiLCJtc2ciLCJ3cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMiLCJhcmdzIiwibm9uY2VfbGlzdCIsInBhZ2UiLCJwYXJzZUludCIsImxpbWl0IiwicGVyX3BhZ2UiLCJpbmNsdWRlX2dsb2JhbCIsInNlYXJjaCIsIndwYmNfYmZiX19hamF4X2xvYWRfZm9ybV9ieV9zbHVnIiwiYW1zMiIsInMyIiwid3BiY19iZmJfX2FqYXhfZGVsZXRlX3RlbXBsYXRlX2J5X3NsdWciLCJkZWxldGVfbm9uY2UiLCJub25jZV9kZWxldGUiLCJ3aW5kb3ciLCJkb2N1bWVudCIsImpRdWVyeSIsInZhbCIsImxvYWRfc2F2ZWRfc3RydWN0dXJlIiwid3BiY19iZmJfX2dldF9hamF4X3VybCIsImFqYXh1cmwiLCJvcmlnaW5hbF9odG1sIiwiaHRtbCIsImJ1c3lfdGV4dCIsInNwaW5uZXJfaHRtbCIsImFkZENsYXNzIiwiYXBwZW5kIiwib3JpZ2luYWwiLCJyZW1vdmVEYXRhIiwid3BiY19iZmJfX2ltcG9ydF9mcm9tX3NpbXBsZV9mb3JtIiwiYWpheF91cmwiLCJwb3N0IiwieGhyIiwid3BiY19iZmJfX2ltcG9ydF9sZWdhY3lfZm9ybXMiLCJtb2RlIiwic2tpcF9pZl9leGlzdHMiLCJzZXRfYmZiX2Zvcm1fbm90X2RlZmluZWQiLCJpbXBvcnRlZCIsInRyaWdnZXIiLCJfZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2FqYXgvX3NyYy9iZmItYWpheC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gPT0gRmlsZSAgLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWpheC9fb3V0L2JmYi1hamF4LmpzICAtIGFmdGVyICByZWZhY3RvciAyMDI2LTAyLTI4IDE1OjE0IHJvbGJhY2sgIHRvICB0aGlzIHBhb2ludCwgIGlmIHNvbWV0aGluZyB3aWxsICBnbyAgd3JvbmcuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oZnVuY3Rpb24gKHcsIGQsICQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdHZhciBBamF4Q2ZnID0gdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdGlmICggISBBamF4Q2ZnLnVybCApIHtcclxuXHRcdC8vIE5vdCBvbiBidWlsZGVyIHBhZ2Ugb3IgY29uZmlnIG5vdCBpbmplY3RlZC5cclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdGlmICggISAkIHx8ICEgJC5hamF4ICkge1xyXG5cdFx0Ly8gSW4gV1AgYWRtaW4galF1ZXJ5IHNob3VsZCBleGlzdDsgaWYgbm90LCBzdG9wIHRvIGF2b2lkIHNpbGVudCBjb3JydXB0aW9uLlxyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogalF1ZXJ5IGlzIG5vdCBhdmFpbGFibGUuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogalF1ZXJ5IGlzIG5vdCBhdmFpbGFibGUuJyApO1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3NhdmVfc291cmNlKCBjZmcsIGJ0biApIHtcclxuXHJcblx0XHQvLyBwcmlvcml0eTogYnV0dG9uIGF0dHIgLT4gZ2xvYmFsIGNmZyAtPiBkZWZhdWx0XHJcblx0XHR2YXIgdiA9ICcnO1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0aWYgKCBidG4gJiYgYnRuLmdldEF0dHJpYnV0ZSApIHtcclxuXHRcdFx0XHR2ID0gYnRuLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItc2F2ZS1zb3VyY2UnICkgfHwgJyc7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBlICkge31cclxuXHJcblx0XHRpZiAoICEgdiAmJiBjZmcgJiYgY2ZnLnNhdmVfc291cmNlICkge1xyXG5cdFx0XHR2ID0gY2ZnLnNhdmVfc291cmNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHYgPSBTdHJpbmcoIHYgfHwgJ2F1dG8nICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdGlmICggWyAnYnVpbGRlcicsICdhZHZhbmNlZCcsICdhdXRvJyBdLmluZGV4T2YoIHYgKSA9PT0gLTEgKSB7XHJcblx0XHRcdHYgPSAnYnVpbGRlcic7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlYWRfYWR2YW5jZWRfbW9kZV9wYXlsb2FkKCkge1xyXG5cclxuXHRcdC8vIGJlc3Q6IEFQSSAoc3luY3MgQ29kZU1pcnJvciAtPiB0ZXh0YXJlYSlcclxuXHRcdGlmICggdy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpICYmIHR5cGVvZiB3LndwYmNfYmZiX2FkdmFuY2VkX2VkaXRvcl9hcGkuZ2V0X3ZhbHVlcyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRyZXR1cm4gdy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpLmdldF92YWx1ZXMoKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGZhbGxiYWNrOiByZWFkIHRleHRhcmVhcyBkaXJlY3RseSAobWF5IGJlIHN0YWxlIGlmIENNIG5vdCBzYXZlZClcclxuXHRcdHZhciB0YV9mb3JtICAgID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX2VkaXRvcicgKTtcclxuXHRcdHZhciB0YV9jb250ZW50ID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fZWRpdG9yJyApO1xyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGFkdmFuY2VkX2Zvcm06IHRhX2Zvcm0gPyBTdHJpbmcoIHRhX2Zvcm0udmFsdWUgfHwgJycgKSA6ICcnLFxyXG5cdFx0XHRjb250ZW50X2Zvcm0gOiB0YV9jb250ZW50ID8gU3RyaW5nKCB0YV9jb250ZW50LnZhbHVlIHx8ICcnICkgOiAnJyxcclxuXHRcdFx0aXNfZGlydHkgICAgIDogZmFsc2VcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoYXNfdGV4dCggdiApIHtcclxuXHRcdHJldHVybiAhISAoIHYgJiYgU3RyaW5nKCB2ICkudHJpbSgpICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTZXJpYWxpemUgdmFsdWVzIHNvIHBheWxvYWQgbWF0Y2hlcyBwcmV2aW91cyBYTUxIdHRwUmVxdWVzdCBiZWhhdmlvcjpcclxuXHQgKiAtIG51bGwvdW5kZWZpbmVkID0+ICcnXHJcblx0ICogLSBvYmplY3RzL2FycmF5cyA9PiBKU09OLnN0cmluZ2lmeSguLi4pXHJcblx0ICogLSBldmVyeXRoaW5nIGVsc2UgPT4gU3RyaW5nKC4uLilcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7Kn0gdmFsdWVcclxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3NlcmlhbGl6ZV9wb3N0X3ZhbHVlKCB2YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoIHZhbHVlID09PSBudWxsIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcgKSB7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KCB2YWx1ZSApO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gJyc7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTm9ybWFsaXplIHBheWxvYWQgdG8gc2NhbGFyIHN0cmluZ3Mgc28galF1ZXJ5IGRvZXMgbm90IHByb2R1Y2UgXCJbb2JqZWN0IE9iamVjdF1cIi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSByYXdfZGF0YVxyXG5cdCAqIEByZXR1cm4ge09iamVjdH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fbm9ybWFsaXplX3Bvc3RfZGF0YSggcmF3X2RhdGEgKSB7XHJcblxyXG5cdFx0dmFyIG91dCA9IHt9O1xyXG5cdFx0cmF3X2RhdGEgPSByYXdfZGF0YSB8fCB7fTtcclxuXHJcblx0XHRmb3IgKCB2YXIgayBpbiByYXdfZGF0YSApIHtcclxuXHRcdFx0aWYgKCAhIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcmF3X2RhdGEsIGsgKSApIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRvdXRbIGsgXSA9IHdwYmNfYmZiX19zZXJpYWxpemVfcG9zdF92YWx1ZSggcmF3X2RhdGFbIGsgXSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBvdXQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQT1NUIGhlbHBlciAoalF1ZXJ5IG9ubHkpIHJldHVybmluZyBqcVhIUiBwcm9taXNlLlxyXG5cdCAqIElNUE9SVEFOVDogZGF0YVR5cGU6J3RleHQnIHNvIGNhbGxlcnMga2VlcCBtYW51YWwgSlNPTi5wYXJzZSBleGFjdGx5IGFzIGJlZm9yZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB1cmxcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGF5bG9hZFxyXG5cdCAqIEByZXR1cm4ge2pxWEhSfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X3Bvc3QoIHVybCwgcGF5bG9hZCApIHtcclxuXHJcblx0XHRyZXR1cm4gJC5hamF4KCB7XHJcblx0XHRcdHVybCAgICAgICAgIDogdXJsLFxyXG5cdFx0XHR0eXBlICAgICAgICA6ICdQT1NUJyxcclxuXHRcdFx0ZGF0YSAgICAgICAgOiB3cGJjX2JmYl9fbm9ybWFsaXplX3Bvc3RfZGF0YSggcGF5bG9hZCApLFxyXG5cdFx0XHRkYXRhVHlwZSAgICA6ICd0ZXh0JyxcclxuXHRcdFx0Y29udGVudFR5cGUgOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04J1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2FmZSBKU09OIHBhcnNlIGhlbHBlci5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0XHJcblx0ICogQHJldHVybiB7T2JqZWN0fG51bGx9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3NhZmVfanNvbl9wYXJzZSggdGV4dCApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKCB0ZXh0ICk7XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBjb21iaW5lZCBsZW5ndGggc3RyaW5nIGxpa2UgXCIxMDAlXCIsIFwiMzIwcHhcIiwgXCIxMi41cmVtXCIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWVcclxuXHQgKiBAcmV0dXJuIHt7bnVtOnN0cmluZywgdW5pdDpzdHJpbmd9fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHBhcnNlX2xlbmd0aF92YWx1ZSggdmFsdWUgKSB7XHJcblx0XHR2YXIgcmF3ID0gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApLnRyaW0oKTtcclxuXHRcdHZhciBtID0gcmF3Lm1hdGNoKCAvXlxccyooLT9cXGQrKD86XFwuXFxkKyk/KVxccyooW2EteiVdKilcXHMqJC9pICk7XHJcblx0XHRpZiAoICEgbSApIHtcclxuXHRcdFx0cmV0dXJuIHsgbnVtOiByYXcsIHVuaXQ6ICcnIH07XHJcblx0XHR9XHJcblx0XHRyZXR1cm4geyBudW06ICggbVsxXSB8fCAnJyApLCB1bml0OiAoIG1bMl0gfHwgJycgKSB9O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU0FWRTogc2VuZCBjdXJyZW50IEJ1aWxkZXIgc3RydWN0dXJlICgrIGV4cG9ydGVkIHNob3J0Y29kZXMpIHRvIFBIUC5cclxuXHQgKlxyXG5cdCAqIFVzZXM6XHJcblx0ICogIC0gV1BCQ19CRkJfQWpheC51cmwgLyBub25jZV9zYXZlIC8gZm9ybV9uYW1lIC8gZW5naW5lIC8gZW5naW5lX3ZlcnNpb25cclxuXHQgKiAgLSBPcHRpb25hbCBXUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfYWxsKClcclxuXHQgKiAgLSBCdXN5IGhlbHBlcnMgd3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0IC8gX2VuZCBpZiBhdmFpbGFibGUuXHJcblx0ICpcclxuXHQgKiBJTVBPUlRBTlQ6XHJcblx0ICogLSBMb2NhbCAoZm9ybSkgc2V0dGluZ3MgYXJlIGNvbGxlY3RlZCBPTkxZIGhlcmUgKFNhdmUgZm9ybSksXHJcblx0ICogICB2aWEgZXZlbnQgXCJ3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNvbGxlY3RcIi5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fYWpheF9zYXZlX2N1cnJlbnRfZm9ybSggYnRuLCBkb25lX2NiICkge1xyXG5cclxuXHRcdHZhciBjZmcgICAgID0gdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdFx0dmFyIGJ1aWxkZXIgPSB3LndwYmNfYmZiIHx8IG51bGw7XHJcblxyXG5cdFx0dmFyICRidG4gPSBidG4gPyAkKCBidG4gKSA6IG51bGw7XHJcblxyXG5cdFx0Ly8gLS0tIEJ1c3kgU1RBUlQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0XHQvLyBXaWxsIHJlYWQgZGF0YS13cGJjLXUtYnVzeS10ZXh0PVwiU2F2aW5nLi4uXCIgZnJvbSB0aGUgPGE+IGFuZCBhZGQgc3Bpbm5lci5cclxuXHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQgPT09ICdmdW5jdGlvbicgKSB7ICAgICAgICAgIC8vIEZJWDogZ3VhcmRcclxuXHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9zdGFydCggJGJ0biApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCRidG4ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKCBidG4gKSB7XHJcblx0XHRcdGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tIEdhdGhlciBzdHJ1Y3R1cmUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIHN0cnVjdHVyZSA9ICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5nZXRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkgPyBidWlsZGVyLmdldF9zdHJ1Y3R1cmUoKSA6IFtdO1xyXG5cclxuXHRcdC8vIC0tLSBHYXRoZXIgY3VycmVudCBmb3JtIHNldHRpbmdzIChldmVudC1iYXNlZDsgbW9kdWxlcyBjYW4gY29udHJpYnV0ZSkgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gT05MWSBzdXBwb3J0ZWQgc2V0dGluZ3MgZm9ybWF0OlxyXG5cdFx0Ly8ge1xyXG5cdFx0Ly8gICBvcHRpb25zICAgICA6IHsga2V5OiB2YWx1ZSwgLi4uIH0sXHJcblx0XHQvLyAgIGNzc192YXJzICAgIDogW10sXHJcblx0XHQvLyAgIGJmYl9vcHRpb25zIDogeyBhZHZhbmNlZF9tb2RlX3NvdXJjZTogJ2J1aWxkZXInfCdhZHZhbmNlZCd8J2F1dG8nIH1cclxuXHRcdC8vIH1cclxuXHRcdHZhciBmb3JtX3NldHRpbmdzID0ge1xyXG5cdFx0XHRvcHRpb25zICAgICA6IHt9LFxyXG5cdFx0XHRjc3NfdmFycyAgICA6IFtdLFxyXG5cdFx0XHRiZmJfb3B0aW9ucyA6IHsgYWR2YW5jZWRfbW9kZV9zb3VyY2U6ICdidWlsZGVyJyB9XHJcblx0XHR9O1xyXG5cclxuXHRcdC8vIExldCBTZXR0aW5ncyBPcHRpb25zIChhbmQgYW55IG90aGVyIG1vZHVsZSkgY29udHJpYnV0ZSBsb2NhbCBmb3JtIHNldHRpbmdzLlxyXG5cdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmNvbGxlY3QnLCB7XHJcblx0XHRcdHNldHRpbmdzIDogZm9ybV9zZXR0aW5ncyxcclxuXHRcdFx0Zm9ybV9uYW1lOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdH0gKTtcclxuXHJcblx0XHQvLyBOb3JtYWxpemUgY3NzX3ZhcnMgdG8gYXJyYXkgKHNjaGVtYSBlbmZvcmNlbWVudCkuXHJcblx0XHRpZiAoIGZvcm1fc2V0dGluZ3MgJiYgZm9ybV9zZXR0aW5ncy5jc3NfdmFycyAmJiAhIEFycmF5LmlzQXJyYXkoIGZvcm1fc2V0dGluZ3MuY3NzX3ZhcnMgKSApIHtcclxuXHRcdFx0dmFyIG91dCA9IFtdO1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGZvciAoIHZhciBrIGluIGZvcm1fc2V0dGluZ3MuY3NzX3ZhcnMgKSB7XHJcblx0XHRcdFx0XHRpZiAoIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggZm9ybV9zZXR0aW5ncy5jc3NfdmFycywgayApICkge1xyXG5cdFx0XHRcdFx0XHRvdXQucHVzaCggeyBuYW1lOiBTdHJpbmcoIGsgKSwgdmFsdWU6IFN0cmluZyggZm9ybV9zZXR0aW5ncy5jc3NfdmFyc1sgayBdICkgfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIF9lMCApIHt9XHJcblx0XHRcdGZvcm1fc2V0dGluZ3MuY3NzX3ZhcnMgPSBvdXQ7XHJcblx0XHR9XHJcblx0XHRpZiAoICEgZm9ybV9zZXR0aW5ncy5iZmJfb3B0aW9ucyB8fCB0eXBlb2YgZm9ybV9zZXR0aW5ncy5iZmJfb3B0aW9ucyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdGZvcm1fc2V0dGluZ3MuYmZiX29wdGlvbnMgPSB7IGFkdmFuY2VkX21vZGVfc291cmNlOiAnYnVpbGRlcicgfTtcclxuXHRcdH1cclxuXHRcdGlmICggISBmb3JtX3NldHRpbmdzLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlICkge1xyXG5cdFx0XHRmb3JtX3NldHRpbmdzLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlID0gJ2J1aWxkZXInO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBwYXlsb2FkID0ge1xyXG5cdFx0XHRhY3Rpb24gICAgICAgIDogJ1dQQkNfQUpYX0JGQl9TQVZFX0ZPUk1fQ09ORklHJyxcclxuXHRcdFx0bm9uY2UgICAgICAgICA6IGNmZy5ub25jZV9zYXZlIHx8ICcnLFxyXG5cdFx0XHRmb3JtX25hbWUgICAgIDogY2ZnLmZvcm1fbmFtZSB8fCAnc3RhbmRhcmQnLFxyXG5cdFx0XHRlbmdpbmUgICAgICAgIDogY2ZnLmVuZ2luZSB8fCAnYmZiJyxcclxuXHRcdFx0ZW5naW5lX3ZlcnNpb246IGNmZy5lbmdpbmVfdmVyc2lvbiB8fCAnMS4wJyxcclxuXHRcdFx0c3RydWN0dXJlICAgICA6IEpTT04uc3RyaW5naWZ5KCBzdHJ1Y3R1cmUgKSxcclxuXHRcdFx0c2V0dGluZ3MgICAgICA6IEpTT04uc3RyaW5naWZ5KCBmb3JtX3NldHRpbmdzIClcclxuXHRcdH07XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIENob29zZSB3aGVyZSBhZHZhbmNlZF9mb3JtICsgY29udGVudF9mb3JtIGFyZSB0YWtlbiBmcm9tLlxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBzYXZlX3NvdXJjZSA9IGdldF9zYXZlX3NvdXJjZSggY2ZnLCBidG4gKTtcclxuXHJcblx0XHQvLyAxKSBUcnkgQWR2YW5jZWQgTW9kZSB0ZXh0IChpZiBzZWxlY3RlZCAvIGF1dG8rZGlydHkpLlxyXG5cdFx0dmFyIGFkdiA9IG51bGw7XHJcblxyXG5cdFx0aWYgKCBzYXZlX3NvdXJjZSA9PT0gJ2FkdmFuY2VkJyB8fCBzYXZlX3NvdXJjZSA9PT0gJ2F1dG8nICkge1xyXG5cdFx0XHRhZHYgPSByZWFkX2FkdmFuY2VkX21vZGVfcGF5bG9hZCgpO1xyXG5cclxuXHRcdFx0dmFyIGNhbl91c2VfYWR2YW5jZWQgPVxyXG5cdFx0XHRcdFx0KCBzYXZlX3NvdXJjZSA9PT0gJ2FkdmFuY2VkJyApIHx8XHJcblx0XHRcdFx0XHQoIHNhdmVfc291cmNlID09PSAnYXV0bycgJiYgYWR2ICYmIGFkdi5pc19kaXJ0eSApO1xyXG5cclxuXHRcdFx0aWYgKCBjYW5fdXNlX2FkdmFuY2VkICkge1xyXG5cclxuXHRcdFx0XHQvLyBJZiB1c2VyIGZvcmNlZCBcImFkdmFuY2VkXCIgYnV0IGJvdGggYXJlIGVtcHR5IC0+IGZhbGxiYWNrIHRvIGV4cG9ydGVyLlxyXG5cdFx0XHRcdGlmICggISBoYXNfdGV4dCggYWR2LmFkdmFuY2VkX2Zvcm0gKSAmJiAhIGhhc190ZXh0KCBhZHYuY29udGVudF9mb3JtICkgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0FkdmFuY2VkIE1vZGUgaXMgc2VsZWN0ZWQsIGJ1dCBlZGl0b3JzIGFyZSBlbXB0eS4gVXNpbmcgQnVpbGRlciBleHBvcnQuJywgJ3dhcm5pbmcnLCA2MDAwICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGlmICggaGFzX3RleHQoIGFkdi5hZHZhbmNlZF9mb3JtICkgKSB7XHJcblx0XHRcdFx0XHRcdHBheWxvYWQuYWR2YW5jZWRfZm9ybSA9IGFkdi5hZHZhbmNlZF9mb3JtO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBoYXNfdGV4dCggYWR2LmNvbnRlbnRfZm9ybSApICkge1xyXG5cdFx0XHRcdFx0XHRwYXlsb2FkLmNvbnRlbnRfZm9ybSA9IGFkdi5jb250ZW50X2Zvcm07XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRmb3JtX3NldHRpbmdzLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlID0gJ2FkdmFuY2VkJztcclxuXHRcdFx0XHRcdHBheWxvYWQuc2V0dGluZ3MgPSBKU09OLnN0cmluZ2lmeSggZm9ybV9zZXR0aW5ncyApOyAvLyBrZWVwIHBheWxvYWQgaW4gc3luYy5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAyKSBJZiBub3QgdGFrZW4gZnJvbSBBZHZhbmNlZCBNb2RlIC0+IGV4cG9ydCBmcm9tIEJ1aWxkZXIgc3RydWN0dXJlIChjdXJyZW50IGJlaGF2aW9yKS5cclxuXHRcdGlmICggISBwYXlsb2FkLmFkdmFuY2VkX2Zvcm0gfHwgISBwYXlsb2FkLmNvbnRlbnRfZm9ybSApIHtcclxuXHJcblx0XHRcdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfYWxsID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHRyeSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUHJlZmVyIE9wdGlvbiBBIHBhY2s6IHNldHRpbmdzLm9wdGlvbnMuKlxyXG5cdFx0XHRcdFx0dmFyIG9wdF9wYWNrICAgICAgID0gZm9ybV9zZXR0aW5ncy5vcHRpb25zO1xyXG5cdFx0XHRcdFx0dmFyIHdpZHRoX2NvbWJpbmVkID0gb3B0X3BhY2suYm9va2luZ19mb3JtX2xheW91dF93aWR0aCB8fCAnJztcclxuXHRcdFx0XHRcdHZhciBwYXJzZWRfd2lkdGggICA9IHBhcnNlX2xlbmd0aF92YWx1ZSggd2lkdGhfY29tYmluZWQgKTtcclxuXHJcblx0XHRcdFx0XHR2YXIgZXhwb3J0X29wdGlvbnMgPSB7XHJcblx0XHRcdFx0XHRcdGdhcFBlcmNlbnQgICAgICA6IDMsXHJcblx0XHRcdFx0XHRcdGZvcm1fc2x1ZyAgICAgICA6IHBheWxvYWQuZm9ybV9uYW1lLFxyXG5cdFx0XHRcdFx0XHRmb3JtX3dpZHRoX3ZhbHVlOiBwYXJzZWRfd2lkdGgubnVtLFxyXG5cdFx0XHRcdFx0XHRmb3JtX3dpZHRoX3VuaXQgOiBwYXJzZWRfd2lkdGgudW5pdFxyXG5cdFx0XHRcdFx0fTtcclxuXHJcblx0XHRcdFx0XHR2YXIgZXhwb3J0X3Jlc3VsdCA9IHcuV1BCQ19CRkJfRXhwb3J0ZXIuZXhwb3J0X2FsbCggc3RydWN0dXJlIHx8IFtdLCBleHBvcnRfb3B0aW9ucyApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggZXhwb3J0X3Jlc3VsdCApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCAhIHBheWxvYWQuYWR2YW5jZWRfZm9ybSAmJiBleHBvcnRfcmVzdWx0LmFkdmFuY2VkX2Zvcm0gKSB7XHJcblx0XHRcdFx0XHRcdFx0cGF5bG9hZC5hZHZhbmNlZF9mb3JtID0gZXhwb3J0X3Jlc3VsdC5hZHZhbmNlZF9mb3JtO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGlmICggISBwYXlsb2FkLmNvbnRlbnRfZm9ybSAmJiBleHBvcnRfcmVzdWx0LmZpZWxkc19kYXRhICkge1xyXG5cdFx0XHRcdFx0XHRcdHBheWxvYWQuY29udGVudF9mb3JtID0gZXhwb3J0X3Jlc3VsdC5maWVsZHNfZGF0YTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGZvcm1fc2V0dGluZ3MuYmZiX29wdGlvbnMuYWR2YW5jZWRfbW9kZV9zb3VyY2UgPSAnYnVpbGRlcic7XHJcblx0XHRcdFx0XHRwYXlsb2FkLnNldHRpbmdzID0gSlNPTi5zdHJpbmdpZnkoIGZvcm1fc2V0dGluZ3MgKTsgLy8ga2VlcCBwYXlsb2FkIGluIHN5bmMuXHJcblxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogZXhwb3J0X2FsbCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGV4cG9ydF9hbGwgZXJyb3InLCBlICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVXBkYXRlIHBheWxvYWQgYmVmb3JlIHNlbmQgdmlhIEFKQVgsICBpZiBuZWVkZWQuXHJcblx0XHR2YXIgaG9va19kZXRhaWwgPSB7IHBheWxvYWQ6IHBheWxvYWQgfTtcclxuXHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybTpiZWZvcmVfc2F2ZV9wYXlsb2FkJywgaG9va19kZXRhaWwgKTtcclxuXHRcdHBheWxvYWQgPSBob29rX2RldGFpbC5wYXlsb2FkO1xyXG5cclxuXHRcdHZhciBhamF4X3JlcXVlc3QgPSB3cGJjX2JmYl9fYWpheF9wb3N0KCBjZmcudXJsLCBwYXlsb2FkICk7XHJcblxyXG5cdFx0YWpheF9yZXF1ZXN0XHJcblx0XHRcdC5kb25lKFxyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCwgX3RleHRfc3RhdHVzLCBqcXhociApIHtcclxuXHJcblx0XHRcdFx0XHQvLyBLZWVwIG9sZCBiZWhhdmlvcjogb25seSB0cmVhdCBleGFjdCAyMDAgYXMgc3VjY2Vzcy5cclxuXHRcdFx0XHRcdGlmICggISBqcXhociB8fCBqcXhoci5zdGF0dXMgIT09IDIwMCApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0XHR0cnkgeyBkb25lX2NiKCBmYWxzZSwgbnVsbCApOyB9IGNhdGNoICggX2UxICkge31cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBzYXZlIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IHNhdmUgSFRUUCBlcnJvcicsIGpxeGhyID8ganF4aHIuc3RhdHVzIDogMCApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dmFyIHJlc3AgPSB3cGJjX2JmYl9fc2FmZV9qc29uX3BhcnNlKCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0XHRpZiAoICEgcmVzcCApIHtcclxuXHRcdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogc2F2ZSBKU09OIHBhcnNlIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBzYXZlIEpTT04gcGFyc2UgZXJyb3InLCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoICEgcmVzcCB8fCAhIHJlc3Auc3VjY2VzcyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3QgZXJyb3JfbWVzc2FnZSA9ICggIHJlc3AuZGF0YSAmJiAgcmVzcC5kYXRhLm1lc3NhZ2UgKSA/IHJlc3AuZGF0YS5tZXNzYWdlIDogJyc7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IHNhdmUgZmFpbGVkLicgKyAnIHwgJyArIGVycm9yX21lc3NhZ2UsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogc2F2ZSBmYWlsZWQnLCByZXNwICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR0cnkgeyBkb25lX2NiKCB0cnVlLCByZXNwICk7IH0gY2F0Y2ggKCBfZTIgKSB7fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybTphamF4X3NhdmVkJywge1xyXG5cdFx0XHRcdFx0XHRsb2FkZWRfZGF0YTogcmVzcC5kYXRhLFxyXG5cdFx0XHRcdFx0XHRmb3JtX25hbWUgIDogY2ZnLmZvcm1fbmFtZSB8fCAnc3RhbmRhcmQnXHJcblx0XHRcdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gT3B0aW9uYWw6IHZpc3VhbCBmZWVkYmFjay5cclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnRm9ybSBzYXZlZCcsICdzdWNjZXNzJywgMTAwMCwgZmFsc2UgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdClcclxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICgganF4aHIgKSB7XHJcblxyXG5cdFx0XHRcdC8vIE9sZCBiZWhhdmlvcjogc3RhdHVzICE9IDIwMCB0cmlnZ2VycyBkb25lX2NiKGZhbHNlLCBudWxsKS5cclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dHJ5IHsgZG9uZV9jYiggZmFsc2UsIG51bGwgKTsgfSBjYXRjaCAoIF9lMyApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBzYXZlIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogc2F2ZSBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRcdC8vIC0tLSBCdXN5IEVORCAoYWx3YXlzKSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICYmIHR5cGVvZiB3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQoICRidG4gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0JGJ0bi5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApLnJlbW92ZUNsYXNzKCAnd3BiYy1pcy1idXN5JyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGJ0biApIHtcclxuXHRcdFx0XHRcdGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyggYWR2YW5jZWRfZm9ybSwgY29udGVudF9mb3JtLCBhZHZhbmNlZF9tb2RlX3NvdXJjZSApIHtcclxuXHJcblx0XHR2YXIgYWYgPSAoIGFkdmFuY2VkX2Zvcm0gPT0gbnVsbCApID8gJycgOiBTdHJpbmcoIGFkdmFuY2VkX2Zvcm0gKTtcclxuXHRcdHZhciBjZiA9ICggY29udGVudF9mb3JtID09IG51bGwgKSA/ICcnIDogU3RyaW5nKCBjb250ZW50X2Zvcm0gKTtcclxuXHJcblx0XHQvLyBBbHdheXMgdXBkYXRlIHVuZGVybHlpbmcgPHRleHRhcmVhPiBzbyBpdCB3b3JrcyBldmVuIGlmIENvZGVNaXJyb3IgaXNuJ3QgaW5pdGVkIHlldC5cclxuXHRcdHZhciB0YV9mb3JtICAgID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX2VkaXRvcicgKTtcclxuXHRcdHZhciB0YV9jb250ZW50ID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fZWRpdG9yJyApO1xyXG5cclxuXHRcdGlmICggdGFfZm9ybSApIHtcclxuXHRcdFx0dGFfZm9ybS52YWx1ZSA9IGFmO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCB0YV9jb250ZW50ICkge1xyXG5cdFx0XHR0YV9jb250ZW50LnZhbHVlID0gY2Y7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTm90aWZ5IEFkdmFuY2VkIE1vZGUgbW9kdWxlIChpZiBsb2FkZWQpIHRvIHN5bmMgQ29kZU1pcnJvciArIGZsYWdzLlxyXG5cdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjphZHZhbmNlZF90ZXh0OmFwcGx5Jywge1xyXG5cdFx0XHRhZHZhbmNlZF9mb3JtICAgICAgIDogYWYsXHJcblx0XHRcdGNvbnRlbnRfZm9ybSAgICAgICAgOiBjZixcclxuXHRcdFx0YWR2YW5jZWRfbW9kZV9zb3VyY2U6IGFkdmFuY2VkX21vZGVfc291cmNlXHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBMT0FEOiBmZXRjaCBGb3JtQ29uZmlnIGZyb20gUEhQIGFuZCBoYW5kIHN0cnVjdHVyZSB0byBCdWlsZGVyLlxyXG5cdCAqXHJcblx0ICogQWxzbyB1c2VzIGJ1c3kgaGVscGVycyBpZiBhdmFpbGFibGUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2FqYXhfbG9hZF9jdXJyZW50X2Zvcm0oIGJ0biwgZG9uZV9jYiApIHtcclxuXHJcblx0XHR2YXIgY2ZnICAgICA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdHZhciBidWlsZGVyID0gdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cclxuXHRcdHZhciAkYnRuID0gYnRuID8gJCggYnRuICkgOiBudWxsO1xyXG5cclxuXHRcdC8vIC0tLSBCdXN5IFNUQVJUIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQgPT09ICdmdW5jdGlvbicgKSB7ICAgICAgICAgIC8vIEZJWDogZ3VhcmRcclxuXHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9zdGFydCggJGJ0biApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdCRidG4ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9IGVsc2UgaWYgKCBidG4gKSB7XHJcblx0XHRcdGJ0bi5kaXNhYmxlZCA9IHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHBheWxvYWQgPSB7XHJcblx0XHRcdGFjdGlvbiAgIDogJ1dQQkNfQUpYX0JGQl9MT0FEX0ZPUk1fQ09ORklHJyxcclxuXHRcdFx0bm9uY2UgICAgOiBjZmcubm9uY2VfbG9hZCB8fCAnJyxcclxuXHRcdFx0Zm9ybV9uYW1lOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdH07XHJcblxyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyggJycgKTtcclxuXHRcdC8vIHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnUHJvY2Vzc2luZycsICdpbmZvJywgMTAwMCwgZmFsc2UgKTsgICAgLy8gT3B0aW9uYWw6IHZpc3VhbCBmZWVkYmFjay5cclxuXHJcblx0XHR2YXIgYWpheF9yZXF1ZXN0ID0gd3BiY19iZmJfX2FqYXhfcG9zdCggY2ZnLnVybCwgcGF5bG9hZCApO1xyXG5cclxuXHRcdGFqYXhfcmVxdWVzdFxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZV90ZXh0LCBfdGV4dF9zdGF0dXMsIGpxeGhyICkge1xyXG5cclxuXHRcdFx0XHRpZiAoICEganF4aHIgfHwganF4aHIuc3RhdHVzICE9PSAyMDAgKSB7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dHJ5IHsgZG9uZV9jYiggZmFsc2UsIG51bGwgKTsgfSBjYXRjaCAoIF9lMCApIHt9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbG9hZCBIVFRQIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbG9hZCBIVFRQIGVycm9yJywganF4aHIgPyBqcXhoci5zdGF0dXMgOiAwICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgcmVzcCA9IHdwYmNfYmZiX19zYWZlX2pzb25fcGFyc2UoIHJlc3BvbnNlX3RleHQgKTtcclxuXHRcdFx0XHRpZiAoICEgcmVzcCApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxvYWQgSlNPTiBwYXJzZSBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxvYWQgSlNPTiBwYXJzZSBlcnJvcicsIHJlc3BvbnNlX3RleHQgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISByZXNwIHx8ICEgcmVzcC5zdWNjZXNzIHx8ICEgcmVzcC5kYXRhICkge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbG9hZCBmYWlsZWQnLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBsb2FkIGZhaWxlZCcsIHJlc3AgKTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciBkYXRhICAgICAgPSByZXNwLmRhdGE7XHJcblx0XHRcdFx0dmFyIHN0cnVjdHVyZSA9IGRhdGEuc3RydWN0dXJlIHx8IFtdO1xyXG5cclxuXHRcdFx0XHQvLyBBcHBseSBBZHZhbmNlZCBNb2RlIHNhdmVkIHRleHRzIChpZiBwcm92aWRlZCBieSBQSFApLlxyXG5cdFx0XHRcdGlmICggZGF0YSAmJiAoIHR5cGVvZiBkYXRhLmFkdmFuY2VkX2Zvcm0gIT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBkYXRhLmNvbnRlbnRfZm9ybSAhPT0gJ3VuZGVmaW5lZCcgKSApIHtcclxuXHRcdFx0XHRcdHZhciBhbXMgPSAnJztcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdHZhciBzMSA9ICggdHlwZW9mIGRhdGEuc2V0dGluZ3MgPT09ICdzdHJpbmcnICkgPyBKU09OLnBhcnNlKCBkYXRhLnNldHRpbmdzICkgOiBkYXRhLnNldHRpbmdzO1xyXG5cdFx0XHRcdFx0XHRhbXMgPSAoIHMxICYmIHMxLmJmYl9vcHRpb25zICYmIHMxLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlICkgPyBzMS5iZmJfb3B0aW9ucy5hZHZhbmNlZF9tb2RlX3NvdXJjZSA6ICcnO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lMSApIHt9XHJcblxyXG5cdFx0XHRcdFx0YXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyhcclxuXHRcdFx0XHRcdFx0ZGF0YS5hZHZhbmNlZF9mb3JtIHx8ICcnLFxyXG5cdFx0XHRcdFx0XHRkYXRhLmNvbnRlbnRfZm9ybSB8fCAnJyxcclxuXHRcdFx0XHRcdFx0YW1zXHJcblx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gQXBwbHkgc2V0dGluZ3MgdG8gVUkgKGxvY2FsIGZvcm0gc2V0dGluZ3MpIGlmIHByb3ZpZGVkLlxyXG5cdFx0XHRcdGlmICggZGF0YS5zZXR0aW5ncyApIHtcclxuXHRcdFx0XHRcdHZhciBwYXJzZWRfc2V0dGluZ3MgPSBudWxsO1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0cGFyc2VkX3NldHRpbmdzID0gKCB0eXBlb2YgZGF0YS5zZXR0aW5ncyA9PT0gJ3N0cmluZycgKSA/IEpTT04ucGFyc2UoIGRhdGEuc2V0dGluZ3MgKSA6IGRhdGEuc2V0dGluZ3M7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UyICkge1xyXG5cdFx0XHRcdFx0XHRwYXJzZWRfc2V0dGluZ3MgPSBudWxsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCBwYXJzZWRfc2V0dGluZ3MgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczphcHBseScsIHtcclxuXHRcdFx0XHRcdFx0XHRzZXR0aW5ncyA6IHBhcnNlZF9zZXR0aW5ncyxcclxuXHRcdFx0XHRcdFx0XHRmb3JtX25hbWU6IGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmZvcm06YWpheF9sb2FkZWQnLCB7XHJcblx0XHRcdFx0XHRsb2FkZWRfZGF0YTogZGF0YSxcclxuXHRcdFx0XHRcdGZvcm1fbmFtZSAgOiBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCdcclxuXHRcdFx0XHR9ICk7XHJcblxyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR0cnkgeyBkb25lX2NiKCB0cnVlLCBkYXRhICk7IH0gY2F0Y2ggKCBfZTMgKSB7fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gUHJlZmVyIHlvdXIgZXhpc3RpbmcgY2FsbGJhY2sgaWYgaXQgYWxyZWFkeSBrbm93cyBob3cgdG8gaW5pdCBCdWlsZGVyLlxyXG5cdFx0XHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkKCBzdHJ1Y3R1cmUgKTtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnRG9uZScsICdpbmZvJywgMTAwMCwgZmFsc2UgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBidWlsZGVyICYmIHR5cGVvZiBidWlsZGVyLmxvYWRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0YnVpbGRlci5sb2FkX3N0cnVjdHVyZSggc3RydWN0dXJlICk7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0RvbmUnLCAnaW5mbycsIDEwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGNvbnNvbGUud2FybiggJ1dQQkMgQkZCOiBubyBsb2FkZXIgZm9yIHN0cnVjdHVyZScsIHN0cnVjdHVyZSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApXHJcblx0XHRcdC5mYWlsKCBmdW5jdGlvbiAoIGpxeGhyICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dHJ5IHsgZG9uZV9jYiggZmFsc2UsIG51bGwgKTsgfSBjYXRjaCAoIF9lNCApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsb2FkIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbG9hZCBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuYWx3YXlzKCBmdW5jdGlvbiAoKSB7XHJcblxyXG5cdFx0XHRcdC8vIC0tLSBCdXN5IEVORCAoYWx3YXlzKSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICYmIHR5cGVvZiB3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQoICRidG4gKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0JGJ0bi5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApLnJlbW92ZUNsYXNzKCAnd3BiYy1pcy1idXN5JyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGJ0biApIHtcclxuXHRcdFx0XHRcdGJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2FqYXhfY3JlYXRlX2Zvcm0oIGJ0biwgY3JlYXRlX3BheWxvYWQsIHRlbXBsYXRlX2Zvcm1fa2V5LCBkb25lX2NiICkge1xyXG5cclxuXHRcdHZhciBjZmcgPSB3LldQQkNfQkZCX0FqYXggfHwge307XHJcblxyXG5cdFx0aWYgKCAhIGNmZy51cmwgfHwgISBjZmcubm9uY2VfY3JlYXRlICkge1xyXG5cdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBjcmVhdGUgY29uZmlnIGlzIG1pc3NpbmcgKHVybC9ub25jZSkuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR0ZW1wbGF0ZV9mb3JtX2tleSA9IFN0cmluZyggdGVtcGxhdGVfZm9ybV9rZXkgfHwgJycgKS50cmltKCk7XHJcblx0XHRpZiAoIHRlbXBsYXRlX2Zvcm1fa2V5ID09PSAnX19ibGFua19fJyApIHtcclxuXHRcdFx0dGVtcGxhdGVfZm9ybV9rZXkgPSAnJztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcGF5bG9hZCA9IHtcclxuXHRcdFx0YWN0aW9uICAgICAgICAgICAgOiAnV1BCQ19BSlhfQkZCX0NSRUFURV9GT1JNX0NPTkZJRycsXHJcblx0XHRcdG5vbmNlICAgICAgICAgICAgIDogY2ZnLm5vbmNlX2NyZWF0ZSxcclxuXHRcdFx0Zm9ybV9uYW1lICAgICAgICAgOiBTdHJpbmcoIGNyZWF0ZV9wYXlsb2FkLmZvcm1fc2x1ZyB8fCAnJyApLFxyXG5cdFx0XHR0ZW1wbGF0ZV9mb3JtX25hbWU6IHRlbXBsYXRlX2Zvcm1fa2V5IHx8ICcnLFxyXG5cdFx0XHR0aXRsZSAgICAgICAgICAgICA6IFN0cmluZyggY3JlYXRlX3BheWxvYWQuZm9ybV90aXRsZSB8fCAnJyApLFxyXG5cdFx0XHRkZXNjcmlwdGlvbiAgICAgICA6IFN0cmluZyggY3JlYXRlX3BheWxvYWQuZm9ybV9kZXNjcmlwdGlvbiB8fCAnJyApLFxyXG5cdFx0XHRpbWFnZV91cmwgICAgICAgICA6IFN0cmluZyggY3JlYXRlX3BheWxvYWQuZm9ybV9pbWFnZV91cmwgfHwgJycgKVxyXG5cdFx0fTtcclxuXHJcblx0XHR2YXIgYWpheF9yZXF1ZXN0ID0gd3BiY19iZmJfX2FqYXhfcG9zdCggY2ZnLnVybCwgcGF5bG9hZCApO1xyXG5cclxuXHRcdGFqYXhfcmVxdWVzdFxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwb25zZV90ZXh0LCBfdGV4dF9zdGF0dXMsIGpxeGhyICkge1xyXG5cclxuXHRcdFx0XHRpZiAoICEganF4aHIgfHwganF4aHIuc3RhdHVzICE9PSAyMDAgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBjcmVhdGUgSFRUUCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIHJlc3AgPSB3cGJjX2JmYl9fc2FmZV9qc29uX3BhcnNlKCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBjcmVhdGUgSlNPTiBwYXJzZSBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgfHwgISByZXNwLnN1Y2Nlc3MgfHwgISByZXNwLmRhdGEgKSB7XHJcblx0XHRcdFx0XHR2YXIgbXNnID0gKCByZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSApID8gcmVzcC5kYXRhLm1lc3NhZ2UgOiAnV1BCQyBCRkI6IGNyZWF0ZSBmYWlsZWQnO1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIG1zZywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCByZXNwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBTd2l0Y2ggY3VycmVudCBmb3JtIHRvIHRoZSBuZXdseSBjcmVhdGVkIGtleS5cclxuXHRcdFx0XHRjZmcuZm9ybV9uYW1lID0gcmVzcC5kYXRhLmZvcm1fbmFtZSB8fCBjcmVhdGVfcGF5bG9hZC5mb3JtX3NsdWc7XHJcblxyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCB0cnVlLCByZXNwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IClcclxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICgganF4aHIgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogY3JlYXRlIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGNyZWF0ZSBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdC8vIExvYWQgQUxMIEZvcm1zLlxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X2xpc3RfdXNlcl9mb3JtcyggYnRuLCBhcmdzLCBkb25lX2NiICkge1xyXG5cclxuXHRcdHZhciBjZmcgPSB3LldQQkNfQkZCX0FqYXggfHwge307XHJcblxyXG5cdFx0aWYgKCAhIGNmZy51cmwgfHwgISBjZmcubm9uY2VfbGlzdCApIHtcclxuXHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbGlzdCBjb25maWcgaXMgbWlzc2luZyAodXJsL25vbmNlX2xpc3QpLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIHBhZ2UgID0gKCBhcmdzICYmIGFyZ3MucGFnZSApID8gcGFyc2VJbnQoIGFyZ3MucGFnZSwgMTAgKSA6IDE7XHJcblx0XHR2YXIgbGltaXQgPSAoIGFyZ3MgJiYgKCBhcmdzLmxpbWl0IHx8IGFyZ3MucGVyX3BhZ2UgKSApID8gcGFyc2VJbnQoICggYXJncy5saW1pdCB8fCBhcmdzLnBlcl9wYWdlICksIDEwICkgOiAyMDtcclxuXHJcblx0XHRpZiAoICEgcGFnZSB8fCBwYWdlIDwgMSApIHtcclxuXHRcdFx0cGFnZSA9IDE7XHJcblx0XHR9XHJcblx0XHRpZiAoICEgbGltaXQgfHwgbGltaXQgPCAxICkge1xyXG5cdFx0XHRsaW1pdCA9IDIwO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBwYXlsb2FkID0ge1xyXG5cdFx0XHRhY3Rpb24gICAgICAgIDogJ1dQQkNfQUpYX0JGQl9MSVNUX0ZPUk1TJyxcclxuXHRcdFx0bm9uY2UgICAgICAgICA6IGNmZy5ub25jZV9saXN0LFxyXG5cdFx0XHRpbmNsdWRlX2dsb2JhbDogKCBhcmdzICYmIGFyZ3MuaW5jbHVkZV9nbG9iYWwgKSA/IDEgOiAwLFxyXG5cdFx0XHRzdGF0dXMgICAgICAgIDogKCBhcmdzICYmIGFyZ3Muc3RhdHVzICkgPyBTdHJpbmcoIGFyZ3Muc3RhdHVzICkgOiAncHVibGlzaGVkJyxcclxuXHRcdFx0c2VhcmNoICAgICAgICA6ICggYXJncyAmJiBhcmdzLnNlYXJjaCApID8gU3RyaW5nKCBhcmdzLnNlYXJjaCApIDogJycsXHJcblx0XHRcdHBhZ2UgICAgICAgICAgOiBwYWdlLFxyXG5cdFx0XHRsaW1pdCAgICAgICAgIDogbGltaXRcclxuXHRcdH07XHJcblxyXG5cdFx0dmFyIGFqYXhfcmVxdWVzdCA9IHdwYmNfYmZiX19hamF4X3Bvc3QoIGNmZy51cmwsIHBheWxvYWQgKTtcclxuXHJcblx0XHRhamF4X3JlcXVlc3RcclxuXHRcdFx0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCwgX3RleHRfc3RhdHVzLCBqcXhociApIHtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGpxeGhyIHx8IGpxeGhyLnN0YXR1cyAhPT0gMjAwICkge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbGlzdCBIVFRQIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR2YXIgcmVzcCA9IHdwYmNfYmZiX19zYWZlX2pzb25fcGFyc2UoIHJlc3BvbnNlX3RleHQgKTtcclxuXHRcdFx0XHRpZiAoICEgcmVzcCApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxpc3QgSlNPTiBwYXJzZSBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgfHwgISByZXNwLnN1Y2Nlc3MgfHwgISByZXNwLmRhdGEgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsaXN0IGZhaWxlZCcsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgcmVzcCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmVfY2IoIHRydWUsIHJlc3AuZGF0YSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApXHJcblx0XHRcdC5mYWlsKCBmdW5jdGlvbiAoIGpxeGhyICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxpc3QgSFRUUCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbGlzdCBIVFRQIGVycm9yJywganF4aHIgJiYganF4aHIuc3RhdHVzLCBqcXhociAmJiBqcXhoci5zdGF0dXNUZXh0ICk7XHJcblx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X2xvYWRfZm9ybV9ieV9zbHVnKCBmb3JtX3NsdWcsIGJ0biwgZG9uZV9jYiApIHtcclxuXHJcblx0XHR2YXIgY2ZnICAgICA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdHZhciBidWlsZGVyID0gdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cclxuXHRcdGZvcm1fc2x1ZyA9IFN0cmluZyggZm9ybV9zbHVnIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0aWYgKCAhIGZvcm1fc2x1ZyApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgJGJ0biA9IGJ0biA/ICQoIGJ0biApIDogbnVsbDtcclxuXHJcblx0XHQvLyBCdXN5IFNUQVJUXHJcblx0XHRpZiAoICRidG4gJiYgJGJ0bi5sZW5ndGggKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0ID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHcud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkYnRuICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0JGJ0bi5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICk7XHJcblx0XHRcdH1cclxuXHRcdH0gZWxzZSBpZiAoIGJ0biApIHtcclxuXHRcdFx0YnRuLmRpc2FibGVkID0gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcGF5bG9hZCA9IHtcclxuXHRcdFx0YWN0aW9uICAgOiAnV1BCQ19BSlhfQkZCX0xPQURfRk9STV9DT05GSUcnLFxyXG5cdFx0XHRub25jZSAgICA6IGNmZy5ub25jZV9sb2FkIHx8ICcnLFxyXG5cdFx0XHRmb3JtX25hbWU6IGZvcm1fc2x1Z1xyXG5cdFx0fTtcclxuXHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nKCAnJyApO1xyXG5cclxuXHRcdHZhciBhamF4X3JlcXVlc3QgPSB3cGJjX2JmYl9fYWpheF9wb3N0KCBjZmcudXJsLCBwYXlsb2FkICk7XHJcblxyXG5cdFx0YWpheF9yZXF1ZXN0XHJcblx0XHRcdC5kb25lKCBmdW5jdGlvbiAoIHJlc3BvbnNlX3RleHQsIF90ZXh0X3N0YXR1cywganF4aHIgKSB7XHJcblxyXG5cdFx0XHRcdGlmICggISBqcXhociB8fCBqcXhoci5zdGF0dXMgIT09IDIwMCApIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxvYWQgSFRUUCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIHJlc3AgPSB3cGJjX2JmYl9fc2FmZV9qc29uX3BhcnNlKCByZXNwb25zZV90ZXh0ICk7XHJcblx0XHRcdFx0aWYgKCAhIHJlc3AgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsb2FkIEpTT04gcGFyc2UgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISByZXNwIHx8ICEgcmVzcC5zdWNjZXNzIHx8ICEgcmVzcC5kYXRhICkge1xyXG5cclxuXHRcdFx0XHRcdGlmICggcmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhLm1lc3NhZ2UgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6ICcgKyByZXNwLmRhdGEubWVzc2FnZSwgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxvYWQgZmFpbGVkJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgcmVzcCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGRhdGEgICAgICA9IHJlc3AuZGF0YTtcclxuXHRcdFx0XHR2YXIgc3RydWN0dXJlID0gZGF0YS5zdHJ1Y3R1cmUgfHwgW107XHJcblxyXG5cdFx0XHRcdC8vIElNUE9SVEFOVDogc3dpdGNoIFwiY3VycmVudCBmb3JtXCIgYWZ0ZXIgc3VjY2Vzc2Z1bCBsb2FkXHJcblx0XHRcdFx0Y2ZnLmZvcm1fbmFtZSA9IGZvcm1fc2x1ZztcclxuXHJcblx0XHRcdFx0Ly8gQXBwbHkgQWR2YW5jZWQgTW9kZSB0ZXh0cyBpZiBwcmVzZW50LlxyXG5cdFx0XHRcdGlmICggZGF0YSAmJiAoIHR5cGVvZiBkYXRhLmFkdmFuY2VkX2Zvcm0gIT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBkYXRhLmNvbnRlbnRfZm9ybSAhPT0gJ3VuZGVmaW5lZCcgKSApIHtcclxuXHJcblx0XHRcdFx0XHR2YXIgYW1zMiA9ICcnO1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0dmFyIHMyID0gKCB0eXBlb2YgZGF0YS5zZXR0aW5ncyA9PT0gJ3N0cmluZycgKSA/IEpTT04ucGFyc2UoIGRhdGEuc2V0dGluZ3MgKSA6IGRhdGEuc2V0dGluZ3M7XHJcblx0XHRcdFx0XHRcdGFtczIgPSAoIHMyICYmIHMyLmJmYl9vcHRpb25zICYmIHMyLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlICkgPyBzMi5iZmJfb3B0aW9ucy5hZHZhbmNlZF9tb2RlX3NvdXJjZSA6ICcnO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lMiApIHt9XHJcblxyXG5cdFx0XHRcdFx0YXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyhcclxuXHRcdFx0XHRcdFx0ZGF0YS5hZHZhbmNlZF9mb3JtIHx8ICcnLFxyXG5cdFx0XHRcdFx0XHRkYXRhLmNvbnRlbnRfZm9ybSB8fCAnJyxcclxuXHRcdFx0XHRcdFx0YW1zMlxyXG5cdFx0XHRcdFx0KTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEFwcGx5IHNldHRpbmdzIGlmIHByZXNlbnQuXHJcblx0XHRcdFx0aWYgKCBkYXRhLnNldHRpbmdzICkge1xyXG5cdFx0XHRcdFx0dmFyIHBhcnNlZF9zZXR0aW5ncyA9IG51bGw7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRwYXJzZWRfc2V0dGluZ3MgPSAoIHR5cGVvZiBkYXRhLnNldHRpbmdzID09PSAnc3RyaW5nJyApID8gSlNPTi5wYXJzZSggZGF0YS5zZXR0aW5ncyApIDogZGF0YS5zZXR0aW5ncztcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfZTMgKSB7XHJcblx0XHRcdFx0XHRcdHBhcnNlZF9zZXR0aW5ncyA9IG51bGw7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHBhcnNlZF9zZXR0aW5ncyApIHtcclxuXHRcdFx0XHRcdFx0d3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5Jywge1xyXG5cdFx0XHRcdFx0XHRcdHNldHRpbmdzIDogcGFyc2VkX3NldHRpbmdzLFxyXG5cdFx0XHRcdFx0XHRcdGZvcm1fbmFtZTogY2ZnLmZvcm1fbmFtZSB8fCAnc3RhbmRhcmQnXHJcblx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHdwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybTphamF4X2xvYWRlZCcsIHtcclxuXHRcdFx0XHRcdGxvYWRlZF9kYXRhOiBkYXRhLFxyXG5cdFx0XHRcdFx0Zm9ybV9uYW1lICA6IGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHRyeSB7IGRvbmVfY2IoIHRydWUsIGRhdGEgKTsgfSBjYXRjaCAoIF9lNCApIHt9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dy53cGJjX2JmYl9fb25fc3RydWN0dXJlX2xvYWRlZCggc3RydWN0dXJlICk7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0RvbmUnLCAnaW5mbycsIDEwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5sb2FkX3N0cnVjdHVyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGJ1aWxkZXIubG9hZF9zdHJ1Y3R1cmUoIHN0cnVjdHVyZSApO1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdEb25lJywgJ2luZm8nLCAxMDAwLCBmYWxzZSApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRjb25zb2xlLndhcm4oICdXUEJDIEJGQjogbm8gbG9hZGVyIGZvciBzdHJ1Y3R1cmUnLCBzdHJ1Y3R1cmUgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCBqcXhociApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsb2FkIEhUVFAgZXJyb3InLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxvYWQgSFRUUCBlcnJvcicsIGpxeGhyICYmIGpxeGhyLnN0YXR1cywganF4aHIgJiYganF4aHIuc3RhdHVzVGV4dCApO1xyXG5cdFx0XHR9IClcclxuXHRcdFx0LmFsd2F5cyggZnVuY3Rpb24gKCkge1xyXG5cclxuXHRcdFx0XHQvLyBCdXN5IEVORFxyXG5cdFx0XHRcdGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCAmJiB0eXBlb2Ygdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdCRidG4ucHJvcCggJ2Rpc2FibGVkJywgZmFsc2UgKS5yZW1vdmVDbGFzcyggJ3dwYmMtaXMtYnVzeScgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBidG4gKSB7XHJcblx0XHRcdFx0XHRidG4uZGlzYWJsZWQgPSBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19hamF4X2RlbGV0ZV90ZW1wbGF0ZV9ieV9zbHVnKCBmb3JtX3NsdWcsIGRvbmVfY2IgKSB7XHJcblxyXG5cdFx0dmFyIGNmZyAgICAgICAgICA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdHZhciBkZWxldGVfbm9uY2UgPSBjZmcubm9uY2VfZGVsZXRlIHx8IGNmZy5ub25jZV9saXN0IHx8ICcnO1xyXG5cclxuXHRcdGZvcm1fc2x1ZyA9IFN0cmluZyggZm9ybV9zbHVnIHx8ICcnICkudHJpbSgpO1xyXG5cclxuXHRcdGlmICggISBmb3JtX3NsdWcgKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIHsgZGF0YTogeyBtZXNzYWdlOiAnVGVtcGxhdGUga2V5IGlzIHJlcXVpcmVkLicgfSB9ICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBjZmcudXJsIHx8ICEgZGVsZXRlX25vbmNlICkge1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGRlbGV0ZSB0ZW1wbGF0ZSBjb25maWcgaXMgbWlzc2luZyAodXJsL25vbmNlKS4nICk7XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIHsgZGF0YTogeyBtZXNzYWdlOiAnV1BCQyBCRkI6IGRlbGV0ZSB0ZW1wbGF0ZSBjb25maWcgaXMgbWlzc2luZyAodXJsL25vbmNlKS4nIH0gfSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgcGF5bG9hZCA9IHtcclxuXHRcdFx0YWN0aW9uICAgOiAnV1BCQ19BSlhfQkZCX0RFTEVURV9URU1QTEFURV9DT05GSUcnLFxyXG5cdFx0XHRub25jZSAgICA6IGRlbGV0ZV9ub25jZSxcclxuXHRcdFx0Zm9ybV9uYW1lOiBmb3JtX3NsdWdcclxuXHRcdH07XHJcblxyXG5cdFx0dmFyIGFqYXhfcmVxdWVzdCA9IHdwYmNfYmZiX19hamF4X3Bvc3QoIGNmZy51cmwsIHBheWxvYWQgKTtcclxuXHJcblx0XHRhamF4X3JlcXVlc3RcclxuXHRcdFx0LmRvbmUoIGZ1bmN0aW9uICggcmVzcG9uc2VfdGV4dCwgX3RleHRfc3RhdHVzLCBqcXhociApIHtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGpxeGhyIHx8IGpxeGhyLnN0YXR1cyAhPT0gMjAwICkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciByZXNwID0gd3BiY19iZmJfX3NhZmVfanNvbl9wYXJzZSggcmVzcG9uc2VfdGV4dCApO1xyXG5cdFx0XHRcdGlmICggISByZXNwICkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISByZXNwLnN1Y2Nlc3MgKSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgcmVzcCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmVfY2IoIHRydWUsIHJlc3AgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCBqcXhociApIHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBkZWxldGUgdGVtcGxhdGUgSFRUUCBlcnJvcicsIGpxeGhyICYmIGpxeGhyLnN0YXR1cywganF4aHIgJiYganF4aHIuc3RhdHVzVGV4dCApO1xyXG5cdFx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gRXhwb3NlIGdsb2JhbHMgZm9yIGJ1dHRvbnMgKG9uY2xpY2sgYXR0cmlidXRlcykuXHJcblx0dy53cGJjX2JmYl9fYWpheF9kZWxldGVfdGVtcGxhdGVfYnlfc2x1ZyA9IHdwYmNfYmZiX19hamF4X2RlbGV0ZV90ZW1wbGF0ZV9ieV9zbHVnO1xyXG5cdHcud3BiY19iZmJfX2FqYXhfc2F2ZV9jdXJyZW50X2Zvcm0gICAgICAgPSB3cGJjX2JmYl9fYWpheF9zYXZlX2N1cnJlbnRfZm9ybTtcclxuXHR3LndwYmNfYmZiX19hamF4X2xvYWRfY3VycmVudF9mb3JtICAgICAgID0gd3BiY19iZmJfX2FqYXhfbG9hZF9jdXJyZW50X2Zvcm07XHJcblx0dy53cGJjX2JmYl9fYWpheF9jcmVhdGVfZm9ybSAgICAgICAgICAgICA9IHdwYmNfYmZiX19hamF4X2NyZWF0ZV9mb3JtO1xyXG5cdHcud3BiY19iZmJfX2FqYXhfbGlzdF91c2VyX2Zvcm1zICAgICAgICAgPSB3cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXM7XHJcblx0dy53cGJjX2JmYl9fYWpheF9sb2FkX2Zvcm1fYnlfc2x1ZyAgICAgICA9IHdwYmNfYmZiX19hamF4X2xvYWRfZm9ybV9ieV9zbHVnO1xyXG5cclxufSkoIHdpbmRvdywgZG9jdW1lbnQsIHdpbmRvdy5qUXVlcnkgKTtcclxuXHJcblxyXG4vLyAtLSBBamF4IEhlbHBlcnM6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyoqXHJcbiAqIENvbW1vbiBjYWxsYmFjayB1c2VkIGJ5IGxvYWRlcnMgdGhhdCByZXR1cm4gc3RydWN0dXJlIEpTT04uXHJcbiAqXHJcbiAqIEBwYXJhbSB2YWxcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkKCB2YWwgKSB7XHJcblx0dHJ5IHtcclxuXHRcdGlmICggdHlwZW9mIHZhbCA9PT0gJ3N0cmluZycgKSB7XHJcblx0XHRcdHZhbCA9IEpTT04ucGFyc2UoIHZhbCApO1xyXG5cdFx0fVxyXG5cdFx0dmFyIGJ1aWxkZXIgPSB3aW5kb3cud3BiY19iZmIgfHwgbnVsbDsgICAgICAgICAgICAgICAgICAgICAgIC8vIEZJWDogdXNlIHdpbmRvdy4qXHJcblx0XHRpZiAoIGJ1aWxkZXIgJiYgdHlwZW9mIGJ1aWxkZXIubG9hZF9zYXZlZF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdGJ1aWxkZXIubG9hZF9zYXZlZF9zdHJ1Y3R1cmUoIHZhbCB8fCBbXSApO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICd3cGJjX2JmYl9fb25fc3RydWN0dXJlX2xvYWRlZCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRjb25zb2xlLmVycm9yKCAnd3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQgZXJyb3InLCBlICk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X2FqYXhfdXJsKCkge1xyXG5cdGlmICggdHlwZW9mIGFqYXh1cmwgIT09ICd1bmRlZmluZWQnICYmIGFqYXh1cmwgKSB7XHJcblx0XHRyZXR1cm4gYWpheHVybDtcclxuXHR9XHJcblxyXG5cdHZhciBBamF4Q2ZnID0gd2luZG93LldQQkNfQkZCX0FqYXggfHwge307ICAgICAgICAgICAgICAgICAgICAgICAgLy8gRklYOiBndWFyZCB2aWEgd2luZG93LipcclxuXHRpZiAoIEFqYXhDZmcudXJsICkge1xyXG5cdFx0cmV0dXJuIEFqYXhDZmcudXJsO1xyXG5cdH1cclxuXHJcblx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogYWpheCBVUkwgaXMgbWlzc2luZy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogYWpheCBVUkwgaXMgbWlzc2luZy4nICk7XHJcblx0cmV0dXJuICcnO1xyXG59XHJcblxyXG5cclxuLy8gLS0gU2hhcmVkIGhlbHBlcnM6IGJ1dHRvbiBidXN5IHN0YXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19idXR0b25fYnVzeV9zdGFydCggJGJ0biApIHtcclxuXHJcblx0aWYgKCAhICRidG4gfHwgISAkYnRuLmxlbmd0aCApIHJldHVybjtcclxuXHJcblx0dmFyIG9yaWdpbmFsX2h0bWwgPSAkYnRuLmh0bWwoKTtcclxuXHR2YXIgYnVzeV90ZXh0ICAgICA9ICRidG4uZGF0YSggJ3dwYmMtdS1idXN5LXRleHQnICkgfHwgJyc7XHJcblx0dmFyIHNwaW5uZXJfaHRtbCAgPSAnPHNwYW4gY2xhc3M9XCJ3cGJjX2ljbl9yb3RhdGVfcmlnaHQgd3BiY19zcGluIHdwYmNfYWpheF9pY29uIHdwYmNfcHJvY2Vzc2luZyB3cGJjX2ljbl9hdXRvcmVuZXdcIiBhcmlhLWhpZGRlbj1cInRydWVcIj48L3NwYW4+JztcclxuXHJcblx0JGJ0blxyXG5cdFx0LmRhdGEoICd3cGJjLW9yaWdpbmFsLWh0bWwnLCBvcmlnaW5hbF9odG1sIClcclxuXHRcdC5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlIClcclxuXHRcdC5hZGRDbGFzcyggJ3dwYmMtaXMtYnVzeScgKTtcclxuXHJcblx0aWYgKCBidXN5X3RleHQgKSB7XHJcblx0XHQkYnRuLmh0bWwoIGJ1c3lfdGV4dCArICcgJyArIHNwaW5uZXJfaHRtbCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHQkYnRuLmFwcGVuZCggc3Bpbm5lcl9odG1sICk7XHJcblx0fVxyXG59XHJcblxyXG5mdW5jdGlvbiB3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICkge1xyXG5cdGlmICggISAkYnRuIHx8ICEgJGJ0bi5sZW5ndGggKSByZXR1cm47XHJcblxyXG5cdHZhciBvcmlnaW5hbCA9ICRidG4uZGF0YSggJ3dwYmMtb3JpZ2luYWwtaHRtbCcgKTtcclxuXHRpZiAoIHR5cGVvZiBvcmlnaW5hbCA9PT0gJ3N0cmluZycgKSB7XHJcblx0XHQkYnRuLmh0bWwoIG9yaWdpbmFsICk7XHJcblx0fVxyXG5cdCRidG5cclxuXHRcdC5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApXHJcblx0XHQucmVtb3ZlQ2xhc3MoICd3cGJjLWlzLWJ1c3knIClcclxuXHRcdC5yZW1vdmVEYXRhKCAnd3BiYy1vcmlnaW5hbC1odG1sJyApO1xyXG59XHJcblxyXG5cclxuLy8gLS0gSW1wb3J0IEhlbHBlcnM6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qKlxyXG4gKiBJbXBvcnQgZnJvbSBTaW1wbGUgRm9ybSDigJQgd2l0aCBidXN5IHN0YXRlXHJcbiAqXHJcbiAqIEBwYXJhbSBidG5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19pbXBvcnRfZnJvbV9zaW1wbGVfZm9ybSggYnRuICkge1xyXG5cdHRyeSB7XHJcblx0XHR2YXIgJGJ0biAgID0galF1ZXJ5KCBidG4gKTtcclxuXHRcdHZhciBub25jZSAgPSAkYnRuLmRhdGEoICd3cGJjLWJmYi1pbXBvcnQtbm9uY2UnICk7XHJcblx0XHR2YXIgYWN0aW9uID0gJGJ0bi5kYXRhKCAnd3BiYy1iZmItaW1wb3J0LWFjdGlvbicgKSB8fCAnd3BiY19iZmJfaW1wb3J0X3NpbXBsZV9mb3JtJztcclxuXHJcblx0XHRpZiAoICEgbm9uY2UgKSB7XHJcblx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IG1pc3NpbmcgaW1wb3J0IG5vbmNlLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogbWlzc2luZyBpbXBvcnQgbm9uY2UuJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGFqYXhfdXJsID0gd3BiY19iZmJfX2dldF9hamF4X3VybCgpO1xyXG5cdFx0aWYgKCAhIGFqYXhfdXJsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkYnRuICk7XHJcblxyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2VfcHJvY2Vzc2luZyggJycgKTtcclxuXHJcblx0XHRqUXVlcnkucG9zdCggYWpheF91cmwsIHtcclxuXHRcdFx0YWN0aW9uOiBhY3Rpb24sXHJcblx0XHRcdG5vbmNlIDogbm9uY2VcclxuXHRcdH0gKVxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwICkge1xyXG5cdFx0XHRcdGlmICggcmVzcCAmJiByZXNwLnN1Y2Nlc3MgJiYgcmVzcC5kYXRhICYmIHJlc3AuZGF0YS5zdHJ1Y3R1cmUgKSB7XHJcblx0XHRcdFx0XHR2YXIgYnVpbGRlciA9IHdpbmRvdy53cGJjX2JmYiB8fCBudWxsOyAgICAgICAgICAgLy8gRklYOiB1c2Ugd2luZG93LipcclxuXHRcdFx0XHRcdGlmICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5sb2FkX3NhdmVkX3N0cnVjdHVyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0YnVpbGRlci5sb2FkX3NhdmVkX3N0cnVjdHVyZSggcmVzcC5kYXRhLnN0cnVjdHVyZSB8fCBbXSApO1xyXG5cdFx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0RvbmUnLCAnaW5mbycsIDEwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGltcG9ydCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGltcG9ydCBlcnJvcicsIHJlc3AgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKCB4aHIgKSB7XHJcblx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogQUpBWCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBBSkFYIGVycm9yJywgeGhyLnN0YXR1cywgeGhyLnN0YXR1c1RleHQgKTtcclxuXHRcdFx0fSApXHJcblx0XHRcdC5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBpbXBvcnQgZXhjZXB0aW9uJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDIEJGQjogaW1wb3J0IGV4Y2VwdGlvbicsIGUgKTtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbXBvcnQgbGVnYWN5IGJvb2tpbmcgZm9ybXMgaW50byBCRkIgc3RvcmFnZS5cclxuICpcclxuICogU3VwcG9ydGVkIG1vZGVzOlxyXG4gKiAtIGN1cnJlbnRfY29udGV4dFxyXG4gKiAtIGFsbF9nbG9iYWxcclxuICogLSBhbGxfdXNlcnNcclxuICpcclxuICogQHBhcmFtIGJ0blxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19iZmJfX2ltcG9ydF9sZWdhY3lfZm9ybXMoIGJ0biApIHtcclxuXHR0cnkge1xyXG5cdFx0dmFyICRidG4gICA9IGpRdWVyeSggYnRuICk7XHJcblx0XHR2YXIgbm9uY2UgID0gJGJ0bi5kYXRhKCAnd3BiYy1iZmItaW1wb3J0LW5vbmNlJyApO1xyXG5cdFx0dmFyIGFjdGlvbiA9ICRidG4uZGF0YSggJ3dwYmMtYmZiLWltcG9ydC1hY3Rpb24nICkgfHwgJ1dQQkNfQUpYX0JGQl9JTVBPUlRfTEVHQUNZX0ZPUk1TJztcclxuXHRcdHZhciBtb2RlICAgPSAkYnRuLmRhdGEoICd3cGJjLWJmYi1pbXBvcnQtbW9kZScgKSB8fCAnY3VycmVudF9jb250ZXh0JztcclxuXHJcblx0XHR2YXIgc2tpcF9pZl9leGlzdHMgICAgICAgICAgID0gJGJ0bi5kYXRhKCAnd3BiYy1iZmItc2tpcC1pZi1leGlzdHMnICkgfHwgJ3NraXAnO1xyXG5cdFx0dmFyIHNldF9iZmJfZm9ybV9ub3RfZGVmaW5lZCA9ICRidG4uZGF0YSggJ3dwYmMtYmZiLXNldC1mb3JtLW5vdC1kZWZpbmVkJyApIHx8ICdub3RfZGVmaW5lZCc7XHJcblxyXG5cdFx0aWYgKCAhIG5vbmNlICkge1xyXG5cdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBtaXNzaW5nIGxlZ2FjeSBpbXBvcnQgbm9uY2UuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBtaXNzaW5nIGxlZ2FjeSBpbXBvcnQgbm9uY2UuJyApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGFqYXhfdXJsID0gd3BiY19iZmJfX2dldF9hamF4X3VybCgpO1xyXG5cdFx0aWYgKCAhIGFqYXhfdXJsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkYnRuICk7XHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZV9wcm9jZXNzaW5nKCAnJyApO1xyXG5cclxuXHRcdGpRdWVyeS5wb3N0KCBhamF4X3VybCwge1xyXG5cdFx0XHRhY3Rpb24gICAgICAgICAgICAgICAgICA6IGFjdGlvbixcclxuXHRcdFx0bm9uY2UgICAgICAgICAgICAgICAgICAgOiBub25jZSxcclxuXHRcdFx0bW9kZSAgICAgICAgICAgICAgICAgICAgOiBtb2RlLFxyXG5cdFx0XHRza2lwX2lmX2V4aXN0cyAgICAgICAgICA6IHNraXBfaWZfZXhpc3RzLFxyXG5cdFx0XHRzZXRfYmZiX2Zvcm1fbm90X2RlZmluZWQ6IHNldF9iZmJfZm9ybV9ub3RfZGVmaW5lZCxcclxuXHRcdH0gKVxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKCByZXNwICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIHJlc3AgJiYgcmVzcC5zdWNjZXNzICYmIHJlc3AuZGF0YSApIHtcclxuXHJcblx0XHRcdFx0XHR2YXIgbXNnID0gcmVzcC5kYXRhLm1lc3NhZ2UgfHwgJ0xlZ2FjeSBmb3JtcyBpbXBvcnQgZmluaXNoZWQuJztcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtc2csICdzdWNjZXNzJywgNjAwMCwgZmFsc2UgKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIHJlc3AuZGF0YS5pbXBvcnRlZCApIHtcclxuXHRcdFx0XHRcdFx0Ly8gUmVsb2FkIGN1cnJlbnQgZm9ybSwgIGlmIGltcG9ydGVkIHNvbWUgZm9ybXMuXHJcblx0XHRcdFx0XHRcdHdwYmNfYmZiX19hamF4X2xvYWRfY3VycmVudF9mb3JtKCBudWxsICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCBkb2N1bWVudCApLnRyaWdnZXIoICd3cGJjX2JmYl9sZWdhY3lfZm9ybXNfaW1wb3J0ZWQnLCBbIHJlc3AuZGF0YSBdICk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggX2UgKSB7fVxyXG5cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbGVnYWN5IGZvcm1zIGltcG9ydCBlcnJvcicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBpbXBvcnQgZXJyb3InLCByZXNwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IClcclxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uICggeGhyICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBBSkFYIGVycm9yJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBBSkFYIGVycm9yJywgeGhyLnN0YXR1cywgeGhyLnN0YXR1c1RleHQgKTtcclxuXHRcdFx0fSApXHJcblx0XHRcdC5hbHdheXMoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBsZWdhY3kgZm9ybXMgaW1wb3J0IGV4Y2VwdGlvbicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRjb25zb2xlLmVycm9yKCAnV1BCQyBCRkI6IGxlZ2FjeSBmb3JtcyBpbXBvcnQgZXhjZXB0aW9uJywgZSApO1xyXG5cdH1cclxufSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRUMsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDbkIsWUFBWTs7RUFFWixJQUFJQyxPQUFPLEdBQUdILENBQUMsQ0FBQ0ksYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNuQyxJQUFLLENBQUVELE9BQU8sQ0FBQ0UsR0FBRyxFQUFHO0lBQ3BCO0lBQ0E7RUFDRDtFQUVBLElBQUssQ0FBRUgsQ0FBQyxJQUFJLENBQUVBLENBQUMsQ0FBQ0ksSUFBSSxFQUFHO0lBQ3RCO0lBQ0FDLHVCQUF1QixDQUFFLG9DQUFvQyxFQUFFLE9BQU8sRUFBRSxLQUFNLENBQUM7SUFDL0VDLE9BQU8sQ0FBQ0MsS0FBSyxDQUFFLG9DQUFxQyxDQUFDO0lBQ3JEO0VBQ0Q7RUFFQSxTQUFTQyxlQUFlQSxDQUFFQyxHQUFHLEVBQUVDLEdBQUcsRUFBRztJQUVwQztJQUNBLElBQUlDLENBQUMsR0FBRyxFQUFFO0lBQ1YsSUFBSTtNQUNILElBQUtELEdBQUcsSUFBSUEsR0FBRyxDQUFDRSxZQUFZLEVBQUc7UUFDOUJELENBQUMsR0FBR0QsR0FBRyxDQUFDRSxZQUFZLENBQUUsMkJBQTRCLENBQUMsSUFBSSxFQUFFO01BQzFEO0lBQ0QsQ0FBQyxDQUFDLE9BQVFDLENBQUMsRUFBRyxDQUFDO0lBRWYsSUFBSyxDQUFFRixDQUFDLElBQUlGLEdBQUcsSUFBSUEsR0FBRyxDQUFDSyxXQUFXLEVBQUc7TUFDcENILENBQUMsR0FBR0YsR0FBRyxDQUFDSyxXQUFXO0lBQ3BCO0lBRUFILENBQUMsR0FBR0ksTUFBTSxDQUFFSixDQUFDLElB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

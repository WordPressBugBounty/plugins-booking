"use strict";

/**
 * Booking Calendar — Apply Template modal helper (BFB Admin)
 *
 * UI.Modal_Apply_Template.open(on_confirm, on_open)
 *
 * on_confirm(payload):
 *  payload = {
 *    template_form_slug : string // '__blank__' or '' => blank/reset
 *  }
 *
 * Applies template by:
 * - Loading template FormConfig (status=template) via AJAX load endpoint
 * - Applying returned structure + settings + advanced/content form texts into current editor
 * - Does NOT auto-save (user clicks "Save Form")
 *
 * Depends on:
 * - UI.Templates.ensure_dom_ref_from_wp_template
 * - UI.Modals.show/hide
 * - wpbc_bfb__ajax_list_user_forms()
 * - window.jQuery
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_apply_template.js
 */

/* globals window, document */
(function (w, d) {
  'use strict';

  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  const UI = Core.UI = Core.UI || {};
  UI.Modal_Apply_Template = UI.Modal_Apply_Template || {};

  // Idempotency guard.
  if (UI.Modal_Apply_Template.__bound) {
    return;
  }
  UI.Modal_Apply_Template.__bound = true;
  const MODAL_DOM_ID = 'wpbc_bfb_modal__apply_template';
  const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-apply_template';
  const ID_TPL_SEARCH = 'wpbc_bfb_popup_modal__apply_template__tpl_search';
  const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
  const SEL_CANCEL = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
  const SEL_ERROR = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';
  const BLANK_TEMPLATE_SLUG = '__blank__';
  function wpbc_bfb__i18n(key, fallback) {
    if (typeof w.wpbc_bfb__i18n === 'function') {
      return w.wpbc_bfb__i18n(key, fallback);
    }
    return String(fallback || '');
  }
  function wpbc_bfb__has_text(value) {
    return !!(value && String(value).trim());
  }
  function wpbc_bfb__get_el(id) {
    return d.getElementById(id);
  }
  function wpbc_bfb__get_modal_el() {
    return d.getElementById(MODAL_DOM_ID);
  }
  function wpbc_bfb__set_error(msg) {
    const el = d.querySelector(SEL_ERROR);
    if (!el) {
      return;
    }
    if (wpbc_bfb__has_text(msg)) {
      // Safer: do not inject HTML here.
      el.textContent = String(msg);
      el.style.display = '';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }
  function wpbc_bfb__collect_payload(modal_el) {
    return {
      template_form_slug: wpbc_bfb__get_selected_template_slug(modal_el)
    };
  }

  // -- Helpers ------------------------------------------------------------------------------------------------------

  function wpbc_bfb__get_selected_template_slug(modal_el) {
    if (!modal_el) {
      return BLANK_TEMPLATE_SLUG;
    }
    const picker = modal_el.__wpbc_bfb_template_picker || null;
    if (picker && typeof picker.get_selected_template_slug === 'function') {
      return picker.get_selected_template_slug();
    }
    const v = String(modal_el.__wpbc_bfb_selected_template_slug || '');
    return v ? v : BLANK_TEMPLATE_SLUG;
  }
  function wpbc_bfb__get_template_picker(modal_el) {
    if (!modal_el) {
      return null;
    }
    if (!UI.Template_Picker || typeof UI.Template_Picker.create !== 'function') {
      if (typeof w.wpbc_admin_show_message === 'function') {
        w.wpbc_admin_show_message('WPBC BFB: Template Picker helper is not available.', 'error', 10000);
      }
      return null;
    }
    if (!modal_el.__wpbc_bfb_template_picker) {
      modal_el.__wpbc_bfb_template_picker = UI.Template_Picker.create({
        modal_el: modal_el,
        search_input_id: ID_TPL_SEARCH,
        blank_template_slug: BLANK_TEMPLATE_SLUG,
        allow_delete: true,
        allow_presets: true,
        allow_same_click_blank: false,
        blank_desc: wpbc_bfb__i18n('text_apply_template_blank_desc', 'Reset to an empty Builder layout.'),
        empty_text: wpbc_bfb__i18n('text_apply_template_empty_templates', 'No templates found.'),
        list_helper_missing_text: wpbc_bfb__i18n('text_apply_template_list_helper_missing', 'WPBC BFB: list forms helper missing.'),
        load_failed_text: wpbc_bfb__i18n('text_apply_template_load_failed', 'Failed to load templates list.'),
        on_set_error: wpbc_bfb__set_error
      });
    }
    return modal_el.__wpbc_bfb_template_picker;
  }
  UI.Modal_Apply_Template.open = function (on_confirm, on_open, opts) {
    const ref = UI.Templates.ensure_dom_ref_from_wp_template(TPL_MODAL_ID, MODAL_DOM_ID);
    if (!ref || !ref.el) {
      return;
    }
    let modal_el = ref.el;

    // If template root is a wrapper (like <span>), find the actual modal inside it.
    if (modal_el && modal_el.id !== MODAL_DOM_ID) {
      const inside = modal_el.querySelector ? modal_el.querySelector('#' + MODAL_DOM_ID) : null;
      if (inside) {
        modal_el = inside;
      }
    }
    if (!modal_el) {
      return;
    }
    modal_el.__wpbc_bfb_apply_template_cb = typeof on_confirm === 'function' ? on_confirm : null;
    const picker = wpbc_bfb__get_template_picker(modal_el);
    if (!picker) {
      if (typeof w.wpbc_admin_show_message === 'function') {
        w.wpbc_admin_show_message('WPBC BFB: Template Picker helper is not available.', 'error', 10000);
      }
      return;
    }
    picker.bind_handlers();
    picker.reset_state();
    UI.Modals.show(modal_el);

    // Optional initial search (prefill + auto-load).
    let initial_search = '';
    let auto_select_first_real = false;
    try {
      if (opts && typeof opts === 'object' && opts.initial_search) {
        initial_search = String(opts.initial_search || '').trim();
      }
      if (opts && typeof opts === 'object' && opts.auto_select_first_real) {
        auto_select_first_real = true;
      }
    } catch (_e0) {}

    // Accept URL separator "^" in initial_search and show the UI separator "|" in the input.
    initial_search = w.wpbc_bfb__normalize_template_search(initial_search);
    picker.set_pager(1, false);
    picker.apply_search_value(initial_search, function (ok, data) {
      if (auto_select_first_real && ok && picker && typeof picker.select_first_real_template === 'function') {
        picker.select_first_real_template(data && data.forms ? data.forms : null);
      }
    });

    // Focus search input.
    w.setTimeout(function () {
      const s_el = wpbc_bfb__get_el(ID_TPL_SEARCH);
      if (s_el && s_el.focus) {
        try {
          s_el.focus();
        } catch (_e1) {}
        try {
          s_el.select();
        } catch (_e2) {}
      }
    }, 0);
    if (on_open) {
      try {
        on_open(modal_el);
      } catch (_e3) {}
    }
  };

  // Confirm / Cancel (single delegated listener).
  d.addEventListener('click', function (e) {
    const modal_el = wpbc_bfb__get_modal_el();
    if (!modal_el || !e || !e.target || !e.target.closest) {
      return;
    }
    const is_confirm = e.target.closest(SEL_CONFIRM);
    if (is_confirm) {
      e.preventDefault();
      const payload = wpbc_bfb__collect_payload(modal_el);
      wpbc_bfb__set_error('');
      const cb = modal_el.__wpbc_bfb_apply_template_cb || null;
      modal_el.__wpbc_bfb_apply_template_cb = null;
      UI.Modals.hide(modal_el);
      if (cb) {
        try {
          cb(payload);
        } catch (_e3) {}
      }
      return;
    }
    const is_cancel = e.target.closest(SEL_CANCEL);
    if (is_cancel) {
      e.preventDefault();
      modal_el.__wpbc_bfb_apply_template_cb = null;
      UI.Modals.hide(modal_el);
    }
  }, true);
})(window, document);

/**
 * Apply selected template (payload) into current form editor.
 *
 * @param {Object} payload
 * @param {HTMLElement|null} menu_option_this Optional menu button (busy UI). Can be null.
 */
function wpbc_bfb__apply_template_from_payload(payload, menu_option_this) {
  var template_form_key = '';
  if (payload && payload.template_form_slug && payload.template_form_slug !== '__blank__') {
    template_form_key = String(payload.template_form_slug);
  } else {
    template_form_key = '';
  }
  var $btn = window.jQuery && menu_option_this ? window.jQuery(menu_option_this) : null;
  var original_busy_text = '';
  if ($btn && $btn.length) {
    original_busy_text = $btn.data('wpbc-u-busy-text') || '';
    $btn.data('wpbc-u-busy-text', wpbc_bfb__i18n('text_apply_template_applying', 'Applying...'));
    if (typeof window.wpbc_bfb__button_busy_start === 'function') {
      window.wpbc_bfb__button_busy_start($btn);
    }
  }
  function wpbc_bfb__busy_end() {
    if ($btn && $btn.length) {
      if (typeof window.wpbc_bfb__button_busy_end === 'function') {
        window.wpbc_bfb__button_busy_end($btn);
      }
      $btn.data('wpbc-u-busy-text', original_busy_text);
    }
  }

  // Apply blank (no AJAX).
  if (!template_form_key) {
    wpbc_bfb__apply_template_to_current_form({
      structure: [{
        page: 1,
        content: []
      }],
      settings: {
        options: {},
        css_vars: [],
        bfb_options: {
          advanced_mode_source: 'builder'
        }
      },
      advanced_form: '',
      content_form: ''
    });
    wpbc_bfb__busy_end();
    if (typeof window.wpbc_admin_show_message === 'function') {
      window.wpbc_admin_show_message(wpbc_bfb__i18n('text_apply_template_blank_applied', 'Blank layout applied. Click “Save Form” to keep changes.'), 'info', 4000, false);
    }
    return;
  }

  // Load template config (status=template) and apply.
  wpbc_bfb__load_template_form_config(template_form_key, function (ok, data) {
    if (!ok || !data) {
      wpbc_bfb__busy_end();
      if (typeof window.wpbc_admin_show_message === 'function') {
        window.wpbc_admin_show_message(wpbc_bfb__i18n('text_apply_template_form_load_failed', 'Failed to load template.'), 'error', 10000);
      }
      return;
    }
    wpbc_bfb__apply_template_to_current_form(data);
    wpbc_bfb__busy_end();
    if (typeof window.wpbc_admin_show_message === 'function') {
      window.wpbc_admin_show_message(wpbc_bfb__i18n('text_apply_template_applied', 'Template applied. Click “Save Form” to keep changes.'), 'success', 4000, false);
    }
  });
}

/**
 * Menu action: open modal and apply selected template into current form editor.
 *
 * Usage in menu:
 * onclick="wpbc_bfb__menu_forms__apply_template(this);"
 *
 * @param {HTMLElement|null} menu_option_this
 * @param {Object} [opts]
 * @param {string} [opts.initial_search] Optional prefilled template search string.
 * @param {boolean} [opts.auto_select_first_real] Select the first non-blank result after search load.
 */
function wpbc_bfb__menu_forms__apply_template(menu_option_this, opts) {
  if (!window.WPBC_BFB_Core || !window.WPBC_BFB_Core.UI || !window.WPBC_BFB_Core.UI.Modal_Apply_Template) {
    if (typeof window.wpbc_admin_show_message === 'function') {
      window.wpbc_admin_show_message('WPBC BFB: Apply Template modal is not available.', 'error', 10000);
    }
    return;
  }

  // Ensure opts is a plain object.
  if (!opts || typeof opts !== 'object') {
    opts = {};
  }
  window.WPBC_BFB_Core.UI.Modal_Apply_Template.open(function (payload) {
    // IMPORTANT: apply directly from payload (DO NOT reopen the modal).
    wpbc_bfb__apply_template_from_payload(payload, menu_option_this || null);
  }, null, opts);
}

/**
 * Open "Apply Template" modal with prefilled search and auto-search.
 *
 * Example:
 *   wpbc_bfb__menu_forms__apply_template_search( 'time', null );
 *   wpbc_bfb__menu_forms__apply_template_search( 'full day', null );
 *
 * @param {string} search_key
 * @param {HTMLElement|null} menu_option_this Optional menu button (busy UI). Can be null.
 * @param {Object} [opts]
 */
function wpbc_bfb__menu_forms__apply_template_search(search_key, menu_option_this, opts) {
  search_key = String(search_key || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

  // Normalize configured OR separator (default "|") so server can split reliably.
  search_key = window.wpbc_bfb__normalize_template_search(search_key);
  if (!opts || typeof opts !== 'object') {
    opts = {};
  }
  opts.initial_search = search_key;

  // Open the same modal, but pass initial_search.
  wpbc_bfb__menu_forms__apply_template(menu_option_this || null, opts);
}

/**
 * Load template FormConfig via existing AJAX endpoint.
 *
 * @param {string} template_form_slug
 * @param {Function} done_cb function(ok:boolean, data:Object|null)
 */
function wpbc_bfb__load_template_form_config(template_form_slug, done_cb) {
  try {
    var cfg = window.WPBC_BFB_Ajax || {};
    var $ = window.jQuery || null;
    template_form_slug = String(template_form_slug || '').trim();
    if (!template_form_slug) {
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      return;
    }
    if (!cfg.url || !cfg.nonce_load) {
      if (typeof window.wpbc_admin_show_message === 'function') {
        window.wpbc_admin_show_message('WPBC BFB: ajax load config is missing.', 'error', 10000);
      }
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      return;
    }
    if (!$ || !$.ajax) {
      if (typeof window.wpbc_admin_show_message === 'function') {
        window.wpbc_admin_show_message('WPBC BFB: jQuery is not available.', 'error', 10000);
      }
      if (typeof done_cb === 'function') {
        done_cb(false, null);
      }
      return;
    }
    $.ajax({
      url: cfg.url,
      type: 'POST',
      dataType: 'text',
      data: {
        action: 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
        nonce: cfg.nonce_load,
        form_name: template_form_slug,
        status: 'template'
      }
    }).done(function (response_text, _text_status, jqxhr) {
      if (!jqxhr || jqxhr.status !== 200) {
        if (typeof done_cb === 'function') {
          done_cb(false, null);
        }
        return;
      }
      var resp = null;
      try {
        resp = JSON.parse(response_text);
      } catch (_e1) {
        resp = null;
      }
      if (!resp || !resp.success || !resp.data) {
        if (typeof done_cb === 'function') {
          done_cb(false, resp);
        }
        return;
      }
      if (typeof done_cb === 'function') {
        done_cb(true, resp.data);
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      if (typeof done_cb === 'function') {
        done_cb(false, jqXHR.responseText ? jqXHR.responseText : null);
      }
    });
  } catch (_e2) {
    if (typeof done_cb === 'function') {
      done_cb(false, null);
    }
  }
}

/**
 * Apply template data to current form editor.
 *
 * Expected data:
 * - structure (array)
 * - settings (array|object)
 * - advanced_form (string)
 * - content_form (string)
 *
 * @param {Object} data
 */
function wpbc_bfb__apply_template_to_current_form(data) {
  var builder = window.wpbc_bfb || null;
  var structure = data && data.structure ? data.structure : [];
  var settings = data && data.settings ? data.settings : null;

  // 1) Apply structure into Builder.
  if (builder && typeof builder.load_saved_structure === 'function') {
    builder.load_saved_structure(structure || []);
  } else if (builder && typeof builder.load_structure === 'function') {
    builder.load_structure(structure || []);
  } else if (typeof window.wpbc_bfb__on_structure_loaded === 'function') {
    window.wpbc_bfb__on_structure_loaded(structure || []);
  }

  // 2) Apply settings into Settings Options UI (and other listeners).
  if (settings) {
    try {
      // Some call-sites may return JSON string, be defensive.
      if (typeof settings === 'string') {
        settings = JSON.parse(settings);
      }
    } catch (_e0) {}
    if (settings) {
      if (typeof window.wpbc_bfb__dispatch_event_safe === 'function') {
        window.wpbc_bfb__dispatch_event_safe('wpbc:bfb:form_settings:apply', {
          settings: settings,
          form_name: window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.form_name ? window.WPBC_BFB_Ajax.form_name : 'standard'
        });
      } else {
        try {
          document.dispatchEvent(new CustomEvent('wpbc:bfb:form_settings:apply', {
            detail: {
              settings: settings
            }
          }));
        } catch (_e1) {}
      }
    }
  }

  // 3) Apply Advanced/Content texts (updates textarea + notifies Advanced Mode module).
  wpbc_bfb__apply_advanced_mode_texts(data && typeof data.advanced_form !== 'undefined' ? data.advanced_form : '', data && typeof data.content_form !== 'undefined' ? data.content_form : '', settings && settings.bfb_options && settings.bfb_options.advanced_mode_source ? settings.bfb_options.advanced_mode_source : 'builder');

  // 4) Notify: template applied (optional hooks).
  if (typeof window.wpbc_bfb__dispatch_event_safe === 'function') {
    window.wpbc_bfb__dispatch_event_safe('wpbc:bfb:form:template_applied', {
      template_form_slug: data && data.form_name ? data.form_name : '',
      form_name: window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.form_name ? window.WPBC_BFB_Ajax.form_name : 'standard'
    });
  }
}

/**
 * Apply advanced/content texts into editor UI safely.
 *
 * @param {string} advanced_form
 * @param {string} content_form
 * @param {string} advanced_mode_source
 */
function wpbc_bfb__apply_advanced_mode_texts(advanced_form, content_form, advanced_mode_source) {
  var af = advanced_form == null ? '' : String(advanced_form);
  var cf = content_form == null ? '' : String(content_form);
  var ta_form = document.getElementById('wpbc_bfb__advanced_form_editor');
  var ta_content = document.getElementById('wpbc_bfb__content_form_editor');
  if (ta_form) {
    ta_form.value = af;
  }
  if (ta_content) {
    ta_content.value = cf;
  }
  if (typeof window.wpbc_bfb__dispatch_event_safe === 'function') {
    window.wpbc_bfb__dispatch_event_safe('wpbc:bfb:advanced_text:apply', {
      advanced_form: af,
      content_form: cf,
      advanced_mode_source: advanced_mode_source
    });
  }
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9hcHBseV90ZW1wbGF0ZS5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJVSSIsIk1vZGFsX0FwcGx5X1RlbXBsYXRlIiwiX19ib3VuZCIsIk1PREFMX0RPTV9JRCIsIlRQTF9NT0RBTF9JRCIsIklEX1RQTF9TRUFSQ0giLCJTRUxfQ09ORklSTSIsIlNFTF9DQU5DRUwiLCJTRUxfRVJST1IiLCJCTEFOS19URU1QTEFURV9TTFVHIiwid3BiY19iZmJfX2kxOG4iLCJrZXkiLCJmYWxsYmFjayIsIlN0cmluZyIsIndwYmNfYmZiX19oYXNfdGV4dCIsInZhbHVlIiwidHJpbSIsIndwYmNfYmZiX19nZXRfZWwiLCJpZCIsImdldEVsZW1lbnRCeUlkIiwid3BiY19iZmJfX2dldF9tb2RhbF9lbCIsIndwYmNfYmZiX19zZXRfZXJyb3IiLCJtc2ciLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJ0ZXh0Q29udGVudCIsInN0eWxlIiwiZGlzcGxheSIsIndwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQiLCJtb2RhbF9lbCIsInRlbXBsYXRlX2Zvcm1fc2x1ZyIsIndwYmNfYmZiX19nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyIsInBpY2tlciIsIl9fd3BiY19iZmJfdGVtcGxhdGVfcGlja2VyIiwiZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWciLCJ2IiwiX193cGJjX2JmYl9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnIiwid3BiY19iZmJfX2dldF90ZW1wbGF0ZV9waWNrZXIiLCJUZW1wbGF0ZV9QaWNrZXIiLCJjcmVhdGUiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsInNlYXJjaF9pbnB1dF9pZCIsImJsYW5rX3RlbXBsYXRlX3NsdWciLCJhbGxvd19kZWxldGUiLCJhbGxvd19wcmVzZXRzIiwiYWxsb3dfc2FtZV9jbGlja19ibGFuayIsImJsYW5rX2Rlc2MiLCJlbXB0eV90ZXh0IiwibGlzdF9oZWxwZXJfbWlzc2luZ190ZXh0IiwibG9hZF9mYWlsZWRfdGV4dCIsIm9uX3NldF9lcnJvciIsIm9wZW4iLCJvbl9jb25maXJtIiwib25fb3BlbiIsIm9wdHMiLCJyZWYiLCJUZW1wbGF0ZXMiLCJlbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlIiwiaW5zaWRlIiwiX193cGJjX2JmYl9hcHBseV90ZW1wbGF0ZV9jYiIsImJpbmRfaGFuZGxlcnMiLCJyZXNldF9zdGF0ZSIsIk1vZGFscyIsInNob3ciLCJpbml0aWFsX3NlYXJjaCIsImF1dG9fc2VsZWN0X2ZpcnN0X3JlYWwiLCJfZTAiLCJ3cGJjX2JmYl9fbm9ybWFsaXplX3RlbXBsYXRlX3NlYXJjaCIsInNldF9wYWdlciIsImFwcGx5X3NlYXJjaF92YWx1ZSIsIm9rIiwiZGF0YSIsInNlbGVjdF9maXJzdF9yZWFsX3RlbXBsYXRlIiwiZm9ybXMiLCJzZXRUaW1lb3V0Iiwic19lbCIsImZvY3VzIiwiX2UxIiwic2VsZWN0IiwiX2UyIiwiX2UzIiwiYWRkRXZlbnRMaXN0ZW5lciIsImUiLCJ0YXJnZXQiLCJjbG9zZXN0IiwiaXNfY29uZmlybSIsInByZXZlbnREZWZhdWx0IiwicGF5bG9hZCIsImNiIiwiaGlkZSIsImlzX2NhbmNlbCIsIndpbmRvdyIsImRvY3VtZW50Iiwid3BiY19iZmJfX2FwcGx5X3RlbXBsYXRlX2Zyb21fcGF5bG9hZCIsIm1lbnVfb3B0aW9uX3RoaXMiLCJ0ZW1wbGF0ZV9mb3JtX2tleSIsIiRidG4iLCJqUXVlcnkiLCJvcmlnaW5hbF9idXN5X3RleHQiLCJsZW5ndGgiLCJ3cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQiLCJ3cGJjX2JmYl9fYnVzeV9lbmQiLCJ3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kIiwid3BiY19iZmJfX2FwcGx5X3RlbXBsYXRlX3RvX2N1cnJlbnRfZm9ybSIsInN0cnVjdHVyZSIsInBhZ2UiLCJjb250ZW50Iiwic2V0dGluZ3MiLCJvcHRpb25zIiwiY3NzX3ZhcnMiLCJiZmJfb3B0aW9ucyIsImFkdmFuY2VkX21vZGVfc291cmNlIiwiYWR2YW5jZWRfZm9ybSIsImNvbnRlbnRfZm9ybSIsIndwYmNfYmZiX19sb2FkX3RlbXBsYXRlX2Zvcm1fY29uZmlnIiwid3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlIiwid3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaCIsInNlYXJjaF9rZXkiLCJyZXBsYWNlIiwiZG9uZV9jYiIsImNmZyIsIldQQkNfQkZCX0FqYXgiLCIkIiwidXJsIiwibm9uY2VfbG9hZCIsImFqYXgiLCJ0eXBlIiwiZGF0YVR5cGUiLCJhY3Rpb24iLCJub25jZSIsImZvcm1fbmFtZSIsInN0YXR1cyIsImRvbmUiLCJyZXNwb25zZV90ZXh0IiwiX3RleHRfc3RhdHVzIiwianF4aHIiLCJyZXNwIiwiSlNPTiIsInBhcnNlIiwic3VjY2VzcyIsImZhaWwiLCJqcVhIUiIsInRleHRTdGF0dXMiLCJlcnJvclRocm93biIsInJlc3BvbnNlVGV4dCIsImJ1aWxkZXIiLCJ3cGJjX2JmYiIsImxvYWRfc2F2ZWRfc3RydWN0dXJlIiwibG9hZF9zdHJ1Y3R1cmUiLCJ3cGJjX2JmYl9fb25fc3RydWN0dXJlX2xvYWRlZCIsIndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlIiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwid3BiY19iZmJfX2FwcGx5X2FkdmFuY2VkX21vZGVfdGV4dHMiLCJhZiIsImNmIiwidGFfZm9ybSIsInRhX2NvbnRlbnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9hZG1pbi1wYWdlLXRwbC9fc3JjL21vZGFsX19mb3JtX2FwcGx5X3RlbXBsYXRlLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCb29raW5nIENhbGVuZGFyIOKAlCBBcHBseSBUZW1wbGF0ZSBtb2RhbCBoZWxwZXIgKEJGQiBBZG1pbilcclxuICpcclxuICogVUkuTW9kYWxfQXBwbHlfVGVtcGxhdGUub3Blbihvbl9jb25maXJtLCBvbl9vcGVuKVxyXG4gKlxyXG4gKiBvbl9jb25maXJtKHBheWxvYWQpOlxyXG4gKiAgcGF5bG9hZCA9IHtcclxuICogICAgdGVtcGxhdGVfZm9ybV9zbHVnIDogc3RyaW5nIC8vICdfX2JsYW5rX18nIG9yICcnID0+IGJsYW5rL3Jlc2V0XHJcbiAqICB9XHJcbiAqXHJcbiAqIEFwcGxpZXMgdGVtcGxhdGUgYnk6XHJcbiAqIC0gTG9hZGluZyB0ZW1wbGF0ZSBGb3JtQ29uZmlnIChzdGF0dXM9dGVtcGxhdGUpIHZpYSBBSkFYIGxvYWQgZW5kcG9pbnRcclxuICogLSBBcHBseWluZyByZXR1cm5lZCBzdHJ1Y3R1cmUgKyBzZXR0aW5ncyArIGFkdmFuY2VkL2NvbnRlbnQgZm9ybSB0ZXh0cyBpbnRvIGN1cnJlbnQgZWRpdG9yXHJcbiAqIC0gRG9lcyBOT1QgYXV0by1zYXZlICh1c2VyIGNsaWNrcyBcIlNhdmUgRm9ybVwiKVxyXG4gKlxyXG4gKiBEZXBlbmRzIG9uOlxyXG4gKiAtIFVJLlRlbXBsYXRlcy5lbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlXHJcbiAqIC0gVUkuTW9kYWxzLnNob3cvaGlkZVxyXG4gKiAtIHdwYmNfYmZiX19hamF4X2xpc3RfdXNlcl9mb3JtcygpXHJcbiAqIC0gd2luZG93LmpRdWVyeVxyXG4gKlxyXG4gKiBAZmlsZTogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9hcHBseV90ZW1wbGF0ZS5qc1xyXG4gKi9cclxuXHJcbi8qIGdsb2JhbHMgd2luZG93LCBkb2N1bWVudCAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdGNvbnN0IENvcmUgPSAody5XUEJDX0JGQl9Db3JlID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9KTtcclxuXHRjb25zdCBVSSAgID0gKENvcmUuVUkgPSBDb3JlLlVJIHx8IHt9KTtcclxuXHJcblx0VUkuTW9kYWxfQXBwbHlfVGVtcGxhdGUgPSBVSS5Nb2RhbF9BcHBseV9UZW1wbGF0ZSB8fCB7fTtcclxuXHJcblx0Ly8gSWRlbXBvdGVuY3kgZ3VhcmQuXHJcblx0aWYgKCBVSS5Nb2RhbF9BcHBseV9UZW1wbGF0ZS5fX2JvdW5kICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHRVSS5Nb2RhbF9BcHBseV9UZW1wbGF0ZS5fX2JvdW5kID0gdHJ1ZTtcclxuXHJcblx0Y29uc3QgTU9EQUxfRE9NX0lEID0gJ3dwYmNfYmZiX21vZGFsX19hcHBseV90ZW1wbGF0ZSc7XHJcblx0Y29uc3QgVFBMX01PREFMX0lEID0gJ3dwYmMtYmZiLXRwbC1tb2RhbC1hcHBseV90ZW1wbGF0ZSc7XHJcblxyXG5cdGNvbnN0IElEX1RQTF9TRUFSQ0ggPSAnd3BiY19iZmJfcG9wdXBfbW9kYWxfX2FwcGx5X3RlbXBsYXRlX190cGxfc2VhcmNoJztcclxuXHJcblx0Y29uc3QgU0VMX0NPTkZJUk0gPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLWNvbmZpcm09XCIxXCJdJztcclxuXHRjb25zdCBTRUxfQ0FOQ0VMICA9ICcjJyArIE1PREFMX0RPTV9JRCArICcgW2RhdGEtd3BiYy1iZmItY2FuY2VsPVwiMVwiXSc7XHJcblx0Y29uc3QgU0VMX0VSUk9SICAgPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLWVycm9yPVwiMVwiXSc7XHJcblxyXG5cdGNvbnN0IEJMQU5LX1RFTVBMQVRFX1NMVUcgPSAnX19ibGFua19fJztcclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2kxOG4oa2V5LCBmYWxsYmFjaykge1xyXG5cdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2JmYl9faTE4biA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmV0dXJuIHcud3BiY19iZmJfX2kxOG4oIGtleSwgZmFsbGJhY2sgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBTdHJpbmcoIGZhbGxiYWNrIHx8ICcnICk7XHJcblx0fVxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2hhc190ZXh0KHZhbHVlKSB7XHJcblx0XHRyZXR1cm4gISEgKCB2YWx1ZSAmJiBTdHJpbmcoIHZhbHVlICkudHJpbSgpICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X2VsKGlkKSB7XHJcblx0XHRyZXR1cm4gZC5nZXRFbGVtZW50QnlJZCggaWQgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19nZXRfbW9kYWxfZWwoKSB7XHJcblx0XHRyZXR1cm4gZC5nZXRFbGVtZW50QnlJZCggTU9EQUxfRE9NX0lEICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fc2V0X2Vycm9yKG1zZykge1xyXG5cdFx0Y29uc3QgZWwgPSBkLnF1ZXJ5U2VsZWN0b3IoIFNFTF9FUlJPUiApO1xyXG5cdFx0aWYgKCAhIGVsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRpZiAoIHdwYmNfYmZiX19oYXNfdGV4dCggbXNnICkgKSB7XHJcblx0XHRcdC8vIFNhZmVyOiBkbyBub3QgaW5qZWN0IEhUTUwgaGVyZS5cclxuXHRcdFx0ZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoIG1zZyApO1xyXG5cdFx0XHRlbC5zdHlsZS5kaXNwbGF5ID0gJyc7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRlbC50ZXh0Q29udGVudCA9ICcnO1xyXG5cdFx0XHRlbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2NvbGxlY3RfcGF5bG9hZChtb2RhbF9lbCkge1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0dGVtcGxhdGVfZm9ybV9zbHVnOiB3cGJjX2JmYl9fZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcoIG1vZGFsX2VsIClcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHQvLyAtLSBIZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcobW9kYWxfZWwpIHtcclxuXHRcdGlmICggISBtb2RhbF9lbCApIHtcclxuXHRcdFx0cmV0dXJuIEJMQU5LX1RFTVBMQVRFX1NMVUc7XHJcblx0XHR9XHJcblx0XHRjb25zdCBwaWNrZXIgPSBtb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlX3BpY2tlciB8fCBudWxsO1xyXG5cdFx0aWYgKCBwaWNrZXIgJiYgdHlwZW9mIHBpY2tlci5nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmV0dXJuIHBpY2tlci5nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZygpO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgdiA9IFN0cmluZyggbW9kYWxfZWwuX193cGJjX2JmYl9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnIHx8ICcnICk7XHJcblx0XHRyZXR1cm4gdiA/IHYgOiBCTEFOS19URU1QTEFURV9TTFVHO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2dldF90ZW1wbGF0ZV9waWNrZXIobW9kYWxfZWwpIHtcclxuXHRcdGlmICggISBtb2RhbF9lbCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIFVJLlRlbXBsYXRlX1BpY2tlciB8fCB0eXBlb2YgVUkuVGVtcGxhdGVfUGlja2VyLmNyZWF0ZSAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IFRlbXBsYXRlIFBpY2tlciBoZWxwZXIgaXMgbm90IGF2YWlsYWJsZS4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBtb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlX3BpY2tlciApIHtcclxuXHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXIgPSBVSS5UZW1wbGF0ZV9QaWNrZXIuY3JlYXRlKFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG1vZGFsX2VsICAgICAgICAgICAgICAgIDogbW9kYWxfZWwsXHJcblx0XHRcdFx0XHRzZWFyY2hfaW5wdXRfaWQgICAgICAgICA6IElEX1RQTF9TRUFSQ0gsXHJcblx0XHRcdFx0XHRibGFua190ZW1wbGF0ZV9zbHVnICAgICA6IEJMQU5LX1RFTVBMQVRFX1NMVUcsXHJcblx0XHRcdFx0XHRhbGxvd19kZWxldGUgICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRhbGxvd19wcmVzZXRzICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRhbGxvd19zYW1lX2NsaWNrX2JsYW5rICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0YmxhbmtfZGVzYyAgICAgICAgICAgICAgOiB3cGJjX2JmYl9faTE4biggJ3RleHRfYXBwbHlfdGVtcGxhdGVfYmxhbmtfZGVzYycsICdSZXNldCB0byBhbiBlbXB0eSBCdWlsZGVyIGxheW91dC4nICksXHJcblx0XHRcdFx0XHRlbXB0eV90ZXh0ICAgICAgICAgICAgICA6IHdwYmNfYmZiX19pMThuKCAndGV4dF9hcHBseV90ZW1wbGF0ZV9lbXB0eV90ZW1wbGF0ZXMnLCAnTm8gdGVtcGxhdGVzIGZvdW5kLicgKSxcclxuXHRcdFx0XHRcdGxpc3RfaGVscGVyX21pc3NpbmdfdGV4dDogd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FwcGx5X3RlbXBsYXRlX2xpc3RfaGVscGVyX21pc3NpbmcnLCAnV1BCQyBCRkI6IGxpc3QgZm9ybXMgaGVscGVyIG1pc3NpbmcuJyApLFxyXG5cdFx0XHRcdFx0bG9hZF9mYWlsZWRfdGV4dCAgICAgICAgOiB3cGJjX2JmYl9faTE4biggJ3RleHRfYXBwbHlfdGVtcGxhdGVfbG9hZF9mYWlsZWQnLCAnRmFpbGVkIHRvIGxvYWQgdGVtcGxhdGVzIGxpc3QuJyApLFxyXG5cdFx0XHRcdFx0b25fc2V0X2Vycm9yICAgICAgICAgICAgOiB3cGJjX2JmYl9fc2V0X2Vycm9yXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBtb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlX3BpY2tlcjtcclxuXHR9XHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblx0VUkuTW9kYWxfQXBwbHlfVGVtcGxhdGUub3BlbiA9IGZ1bmN0aW9uIChvbl9jb25maXJtLCBvbl9vcGVuLCBvcHRzKSB7XHJcblxyXG5cdFx0Y29uc3QgcmVmID0gVUkuVGVtcGxhdGVzLmVuc3VyZV9kb21fcmVmX2Zyb21fd3BfdGVtcGxhdGUoIFRQTF9NT0RBTF9JRCwgTU9EQUxfRE9NX0lEICk7XHJcblx0XHRpZiAoICEgcmVmIHx8ICEgcmVmLmVsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IG1vZGFsX2VsID0gcmVmLmVsO1xyXG5cclxuXHRcdC8vIElmIHRlbXBsYXRlIHJvb3QgaXMgYSB3cmFwcGVyIChsaWtlIDxzcGFuPiksIGZpbmQgdGhlIGFjdHVhbCBtb2RhbCBpbnNpZGUgaXQuXHJcblx0XHRpZiAoIG1vZGFsX2VsICYmIG1vZGFsX2VsLmlkICE9PSBNT0RBTF9ET01fSUQgKSB7XHJcblx0XHRcdGNvbnN0IGluc2lkZSA9IG1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IgPyBtb2RhbF9lbC5xdWVyeVNlbGVjdG9yKCAnIycgKyBNT0RBTF9ET01fSUQgKSA6IG51bGw7XHJcblx0XHRcdGlmICggaW5zaWRlICkge1xyXG5cdFx0XHRcdG1vZGFsX2VsID0gaW5zaWRlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2FwcGx5X3RlbXBsYXRlX2NiID0gKHR5cGVvZiBvbl9jb25maXJtID09PSAnZnVuY3Rpb24nKSA/IG9uX2NvbmZpcm0gOiBudWxsO1xyXG5cclxuXHRcdGNvbnN0IHBpY2tlciA9IHdwYmNfYmZiX19nZXRfdGVtcGxhdGVfcGlja2VyKCBtb2RhbF9lbCApO1xyXG5cdFx0aWYgKCAhIHBpY2tlciApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IFRlbXBsYXRlIFBpY2tlciBoZWxwZXIgaXMgbm90IGF2YWlsYWJsZS4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHBpY2tlci5iaW5kX2hhbmRsZXJzKCk7XHJcblx0XHRwaWNrZXIucmVzZXRfc3RhdGUoKTtcclxuXHJcblx0XHRVSS5Nb2RhbHMuc2hvdyggbW9kYWxfZWwgKTtcclxuXHJcblx0XHQvLyBPcHRpb25hbCBpbml0aWFsIHNlYXJjaCAocHJlZmlsbCArIGF1dG8tbG9hZCkuXG5cdFx0bGV0IGluaXRpYWxfc2VhcmNoID0gJyc7XG5cdFx0bGV0IGF1dG9fc2VsZWN0X2ZpcnN0X3JlYWwgPSBmYWxzZTtcblx0XHR0cnkge1xuXHRcdFx0aWYgKCBvcHRzICYmIHR5cGVvZiBvcHRzID09PSAnb2JqZWN0JyAmJiBvcHRzLmluaXRpYWxfc2VhcmNoICkge1xuXHRcdFx0XHRpbml0aWFsX3NlYXJjaCA9IFN0cmluZyggb3B0cy5pbml0aWFsX3NlYXJjaCB8fCAnJyApLnRyaW0oKTtcblx0XHRcdH1cblx0XHRcdGlmICggb3B0cyAmJiB0eXBlb2Ygb3B0cyA9PT0gJ29iamVjdCcgJiYgb3B0cy5hdXRvX3NlbGVjdF9maXJzdF9yZWFsICkge1xuXHRcdFx0XHRhdXRvX3NlbGVjdF9maXJzdF9yZWFsID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9IGNhdGNoICggX2UwICkge31cblxyXG5cdFx0Ly8gQWNjZXB0IFVSTCBzZXBhcmF0b3IgXCJeXCIgaW4gaW5pdGlhbF9zZWFyY2ggYW5kIHNob3cgdGhlIFVJIHNlcGFyYXRvciBcInxcIiBpbiB0aGUgaW5wdXQuXHJcblx0XHRpbml0aWFsX3NlYXJjaCA9IHcud3BiY19iZmJfX25vcm1hbGl6ZV90ZW1wbGF0ZV9zZWFyY2goIGluaXRpYWxfc2VhcmNoICk7XG5cblx0XHRwaWNrZXIuc2V0X3BhZ2VyKCAxLCBmYWxzZSApO1xuXHRcdHBpY2tlci5hcHBseV9zZWFyY2hfdmFsdWUoIGluaXRpYWxfc2VhcmNoLCBmdW5jdGlvbiAob2ssIGRhdGEpIHtcblx0XHRcdGlmICggYXV0b19zZWxlY3RfZmlyc3RfcmVhbCAmJiBvayAmJiBwaWNrZXIgJiYgdHlwZW9mIHBpY2tlci5zZWxlY3RfZmlyc3RfcmVhbF90ZW1wbGF0ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0cGlja2VyLnNlbGVjdF9maXJzdF9yZWFsX3RlbXBsYXRlKCAoIGRhdGEgJiYgZGF0YS5mb3JtcyApID8gZGF0YS5mb3JtcyA6IG51bGwgKTtcblx0XHRcdH1cblx0XHR9ICk7XG5cclxuXHRcdC8vIEZvY3VzIHNlYXJjaCBpbnB1dC5cclxuXHRcdHcuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRjb25zdCBzX2VsID0gd3BiY19iZmJfX2dldF9lbCggSURfVFBMX1NFQVJDSCApO1xyXG5cdFx0XHRpZiAoIHNfZWwgJiYgc19lbC5mb2N1cyApIHtcclxuXHRcdFx0XHR0cnkgeyBzX2VsLmZvY3VzKCk7IH0gY2F0Y2ggKCBfZTEgKSB7fVxyXG5cdFx0XHRcdHRyeSB7IHNfZWwuc2VsZWN0KCk7IH0gY2F0Y2ggKCBfZTIgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHR9LCAwICk7XHJcblxyXG5cdFx0aWYgKCBvbl9vcGVuICkge1xyXG5cdFx0XHR0cnkgeyBvbl9vcGVuKCBtb2RhbF9lbCApOyB9IGNhdGNoICggX2UzICkge31cclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvLyBDb25maXJtIC8gQ2FuY2VsIChzaW5nbGUgZGVsZWdhdGVkIGxpc3RlbmVyKS5cclxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcblxyXG5cdFx0Y29uc3QgbW9kYWxfZWwgPSB3cGJjX2JmYl9fZ2V0X21vZGFsX2VsKCk7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgfHwgISBlIHx8ICEgZS50YXJnZXQgfHwgISBlLnRhcmdldC5jbG9zZXN0ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgaXNfY29uZmlybSA9IGUudGFyZ2V0LmNsb3Nlc3QoIFNFTF9DT05GSVJNICk7XHJcblx0XHRpZiAoIGlzX2NvbmZpcm0gKSB7XHJcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdGNvbnN0IHBheWxvYWQgPSB3cGJjX2JmYl9fY29sbGVjdF9wYXlsb2FkKCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdFx0d3BiY19iZmJfX3NldF9lcnJvciggJycgKTtcclxuXHJcblx0XHRcdGNvbnN0IGNiID0gbW9kYWxfZWwuX193cGJjX2JmYl9hcHBseV90ZW1wbGF0ZV9jYiB8fCBudWxsO1xyXG5cdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2FwcGx5X3RlbXBsYXRlX2NiID0gbnVsbDtcclxuXHJcblx0XHRcdFVJLk1vZGFscy5oaWRlKCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdFx0aWYgKCBjYiApIHtcclxuXHRcdFx0XHR0cnkgeyBjYiggcGF5bG9hZCApOyB9IGNhdGNoICggX2UzICkge31cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgaXNfY2FuY2VsID0gZS50YXJnZXQuY2xvc2VzdCggU0VMX0NBTkNFTCApO1xyXG5cdFx0aWYgKCBpc19jYW5jZWwgKSB7XHJcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9hcHBseV90ZW1wbGF0ZV9jYiA9IG51bGw7XHJcblx0XHRcdFVJLk1vZGFscy5oaWRlKCBtb2RhbF9lbCApO1xyXG5cdFx0fVxyXG5cclxuXHR9LCB0cnVlICk7XHJcblxyXG59KCB3aW5kb3csIGRvY3VtZW50ICkpO1xyXG5cclxuXHJcbi8qKlxyXG4gKiBBcHBseSBzZWxlY3RlZCB0ZW1wbGF0ZSAocGF5bG9hZCkgaW50byBjdXJyZW50IGZvcm0gZWRpdG9yLlxyXG4gKlxyXG4gKiBAcGFyYW0ge09iamVjdH0gcGF5bG9hZFxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IG1lbnVfb3B0aW9uX3RoaXMgT3B0aW9uYWwgbWVudSBidXR0b24gKGJ1c3kgVUkpLiBDYW4gYmUgbnVsbC5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19hcHBseV90ZW1wbGF0ZV9mcm9tX3BheWxvYWQocGF5bG9hZCwgbWVudV9vcHRpb25fdGhpcykge1xyXG5cclxuXHR2YXIgdGVtcGxhdGVfZm9ybV9rZXkgPSAnJztcclxuXHJcblx0aWYgKCBwYXlsb2FkICYmIHBheWxvYWQudGVtcGxhdGVfZm9ybV9zbHVnICYmIHBheWxvYWQudGVtcGxhdGVfZm9ybV9zbHVnICE9PSAnX19ibGFua19fJyApIHtcclxuXHRcdHRlbXBsYXRlX2Zvcm1fa2V5ID0gU3RyaW5nKCBwYXlsb2FkLnRlbXBsYXRlX2Zvcm1fc2x1ZyApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0ZW1wbGF0ZV9mb3JtX2tleSA9ICcnO1xyXG5cdH1cclxuXHJcblx0dmFyICRidG4gPSAoIHdpbmRvdy5qUXVlcnkgJiYgbWVudV9vcHRpb25fdGhpcyApID8gd2luZG93LmpRdWVyeSggbWVudV9vcHRpb25fdGhpcyApIDogbnVsbDtcclxuXHR2YXIgb3JpZ2luYWxfYnVzeV90ZXh0ID0gJyc7XHJcblxyXG5cdGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCApIHtcclxuXHRcdG9yaWdpbmFsX2J1c3lfdGV4dCA9ICRidG4uZGF0YSggJ3dwYmMtdS1idXN5LXRleHQnICkgfHwgJyc7XHJcblx0XHQkYnRuLmRhdGEoICd3cGJjLXUtYnVzeS10ZXh0Jywgd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FwcGx5X3RlbXBsYXRlX2FwcGx5aW5nJywgJ0FwcGx5aW5nLi4uJyApICk7XHJcblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0ID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR3aW5kb3cud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkYnRuICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fYnVzeV9lbmQoKSB7XHJcblx0XHRpZiAoICRidG4gJiYgJGJ0bi5sZW5ndGggKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdH1cclxuXHRcdFx0JGJ0bi5kYXRhKCAnd3BiYy11LWJ1c3ktdGV4dCcsIG9yaWdpbmFsX2J1c3lfdGV4dCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gQXBwbHkgYmxhbmsgKG5vIEFKQVgpLlxyXG5cdGlmICggISB0ZW1wbGF0ZV9mb3JtX2tleSApIHtcclxuXHJcblx0XHR3cGJjX2JmYl9fYXBwbHlfdGVtcGxhdGVfdG9fY3VycmVudF9mb3JtKFxuXHRcdFx0e1xuXHRcdFx0XHRzdHJ1Y3R1cmUgICAgIDogWyB7IHBhZ2U6IDEsIGNvbnRlbnQ6IFtdIH0gXSxcblx0XHRcdFx0c2V0dGluZ3MgICAgICA6IHtcblx0XHRcdFx0XHRvcHRpb25zICAgIDoge30sXG5cdFx0XHRcdFx0Y3NzX3ZhcnMgICA6IFtdLFxuXHRcdFx0XHRcdGJmYl9vcHRpb25zOiB7IGFkdmFuY2VkX21vZGVfc291cmNlOiAnYnVpbGRlcicgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhZHZhbmNlZF9mb3JtIDogJycsXG5cdFx0XHRcdGNvbnRlbnRfZm9ybSAgOiAnJ1xuXHRcdFx0fVxuXHRcdCk7XG5cclxuXHRcdHdwYmNfYmZiX19idXN5X2VuZCgpO1xyXG5cclxuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0d2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCB3cGJjX2JmYl9faTE4biggJ3RleHRfYXBwbHlfdGVtcGxhdGVfYmxhbmtfYXBwbGllZCcsICdCbGFuayBsYXlvdXQgYXBwbGllZC4gQ2xpY2sg4oCcU2F2ZSBGb3Jt4oCdIHRvIGtlZXAgY2hhbmdlcy4nICksICdpbmZvJywgNDAwMCwgZmFsc2UgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvLyBMb2FkIHRlbXBsYXRlIGNvbmZpZyAoc3RhdHVzPXRlbXBsYXRlKSBhbmQgYXBwbHkuXHJcblx0d3BiY19iZmJfX2xvYWRfdGVtcGxhdGVfZm9ybV9jb25maWcoIHRlbXBsYXRlX2Zvcm1fa2V5LCBmdW5jdGlvbiAob2ssIGRhdGEpIHtcclxuXHJcblx0XHRpZiAoICEgb2sgfHwgISBkYXRhICkge1xyXG5cdFx0XHR3cGJjX2JmYl9fYnVzeV9lbmQoKTtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FwcGx5X3RlbXBsYXRlX2Zvcm1fbG9hZF9mYWlsZWQnLCAnRmFpbGVkIHRvIGxvYWQgdGVtcGxhdGUuJyApLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR3cGJjX2JmYl9fYXBwbHlfdGVtcGxhdGVfdG9fY3VycmVudF9mb3JtKCBkYXRhICk7XHJcblxyXG5cdFx0d3BiY19iZmJfX2J1c3lfZW5kKCk7XHJcblxyXG5cdFx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIHdwYmNfYmZiX19pMThuKCAndGV4dF9hcHBseV90ZW1wbGF0ZV9hcHBsaWVkJywgJ1RlbXBsYXRlIGFwcGxpZWQuIENsaWNrIOKAnFNhdmUgRm9ybeKAnSB0byBrZWVwIGNoYW5nZXMuJyApLCAnc3VjY2VzcycsIDQwMDAsIGZhbHNlICk7XHJcblx0XHR9XHJcblx0fSApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIE1lbnUgYWN0aW9uOiBvcGVuIG1vZGFsIGFuZCBhcHBseSBzZWxlY3RlZCB0ZW1wbGF0ZSBpbnRvIGN1cnJlbnQgZm9ybSBlZGl0b3IuXHJcbiAqXHJcbiAqIFVzYWdlIGluIG1lbnU6XHJcbiAqIG9uY2xpY2s9XCJ3cGJjX2JmYl9fbWVudV9mb3Jtc19fYXBwbHlfdGVtcGxhdGUodGhpcyk7XCJcclxuICpcclxuICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBtZW51X29wdGlvbl90aGlzXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0c11cclxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRzLmluaXRpYWxfc2VhcmNoXSBPcHRpb25hbCBwcmVmaWxsZWQgdGVtcGxhdGUgc2VhcmNoIHN0cmluZy5cbiAqIEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuYXV0b19zZWxlY3RfZmlyc3RfcmVhbF0gU2VsZWN0IHRoZSBmaXJzdCBub24tYmxhbmsgcmVzdWx0IGFmdGVyIHNlYXJjaCBsb2FkLlxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19tZW51X2Zvcm1zX19hcHBseV90ZW1wbGF0ZShtZW51X29wdGlvbl90aGlzLCBvcHRzKSB7XHJcblxyXG5cdGlmICggISB3aW5kb3cuV1BCQ19CRkJfQ29yZSB8fCAhIHdpbmRvdy5XUEJDX0JGQl9Db3JlLlVJIHx8ICEgd2luZG93LldQQkNfQkZCX0NvcmUuVUkuTW9kYWxfQXBwbHlfVGVtcGxhdGUgKSB7XHJcblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBBcHBseSBUZW1wbGF0ZSBtb2RhbCBpcyBub3QgYXZhaWxhYmxlLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHQvLyBFbnN1cmUgb3B0cyBpcyBhIHBsYWluIG9iamVjdC5cclxuXHRpZiAoICEgb3B0cyB8fCB0eXBlb2Ygb3B0cyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRvcHRzID0ge307XHJcblx0fVxyXG5cclxuXHR3aW5kb3cuV1BCQ19CRkJfQ29yZS5VSS5Nb2RhbF9BcHBseV9UZW1wbGF0ZS5vcGVuKFxyXG5cdFx0ZnVuY3Rpb24gKHBheWxvYWQpIHtcclxuXHRcdFx0Ly8gSU1QT1JUQU5UOiBhcHBseSBkaXJlY3RseSBmcm9tIHBheWxvYWQgKERPIE5PVCByZW9wZW4gdGhlIG1vZGFsKS5cclxuXHRcdFx0d3BiY19iZmJfX2FwcGx5X3RlbXBsYXRlX2Zyb21fcGF5bG9hZCggcGF5bG9hZCwgbWVudV9vcHRpb25fdGhpcyB8fCBudWxsICk7XHJcblx0XHR9LFxyXG5cdFx0bnVsbCxcclxuXHRcdG9wdHNcclxuXHQpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIE9wZW4gXCJBcHBseSBUZW1wbGF0ZVwiIG1vZGFsIHdpdGggcHJlZmlsbGVkIHNlYXJjaCBhbmQgYXV0by1zZWFyY2guXHJcbiAqXHJcbiAqIEV4YW1wbGU6XHJcbiAqICAgd3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaCggJ3RpbWUnLCBudWxsICk7XHJcbiAqICAgd3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaCggJ2Z1bGwgZGF5JywgbnVsbCApO1xyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gc2VhcmNoX2tleVxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IG1lbnVfb3B0aW9uX3RoaXMgT3B0aW9uYWwgbWVudSBidXR0b24gKGJ1c3kgVUkpLiBDYW4gYmUgbnVsbC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0c11cbiAqL1xuZnVuY3Rpb24gd3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaChzZWFyY2hfa2V5LCBtZW51X29wdGlvbl90aGlzLCBvcHRzKSB7XG5cclxuXHRzZWFyY2hfa2V5ID0gU3RyaW5nKCBzZWFyY2hfa2V5IHx8ICcnIClcclxuXHRcdC5yZXBsYWNlKCAvW1xcdTAwMDAtXFx1MDAxRlxcdTAwN0ZdL2csICcgJyApXHJcblx0XHQucmVwbGFjZSggL1xccysvZywgJyAnIClcclxuXHRcdC50cmltKCk7XHJcblxyXG5cdC8vIE5vcm1hbGl6ZSBjb25maWd1cmVkIE9SIHNlcGFyYXRvciAoZGVmYXVsdCBcInxcIikgc28gc2VydmVyIGNhbiBzcGxpdCByZWxpYWJseS5cclxuXHRzZWFyY2hfa2V5ID0gd2luZG93LndwYmNfYmZiX19ub3JtYWxpemVfdGVtcGxhdGVfc2VhcmNoKCBzZWFyY2hfa2V5ICk7XHJcblxyXG5cdGlmICggISBvcHRzIHx8IHR5cGVvZiBvcHRzICE9PSAnb2JqZWN0JyApIHtcblx0XHRvcHRzID0ge307XG5cdH1cblx0b3B0cy5pbml0aWFsX3NlYXJjaCA9IHNlYXJjaF9rZXk7XG5cblx0Ly8gT3BlbiB0aGUgc2FtZSBtb2RhbCwgYnV0IHBhc3MgaW5pdGlhbF9zZWFyY2guXG5cdHdwYmNfYmZiX19tZW51X2Zvcm1zX19hcHBseV90ZW1wbGF0ZSggbWVudV9vcHRpb25fdGhpcyB8fCBudWxsLCBvcHRzICk7XG59XG5cclxuLyoqXHJcbiAqIExvYWQgdGVtcGxhdGUgRm9ybUNvbmZpZyB2aWEgZXhpc3RpbmcgQUpBWCBlbmRwb2ludC5cclxuICpcclxuICogQHBhcmFtIHtzdHJpbmd9IHRlbXBsYXRlX2Zvcm1fc2x1Z1xyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBkb25lX2NiIGZ1bmN0aW9uKG9rOmJvb2xlYW4sIGRhdGE6T2JqZWN0fG51bGwpXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JmYl9fbG9hZF90ZW1wbGF0ZV9mb3JtX2NvbmZpZyh0ZW1wbGF0ZV9mb3JtX3NsdWcsIGRvbmVfY2IpIHtcclxuXHJcblx0dHJ5IHtcclxuXHRcdHZhciBjZmcgPSB3aW5kb3cuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdHZhciAkICAgPSB3aW5kb3cualF1ZXJ5IHx8IG51bGw7XHJcblxyXG5cdFx0dGVtcGxhdGVfZm9ybV9zbHVnID0gU3RyaW5nKCB0ZW1wbGF0ZV9mb3JtX3NsdWcgfHwgJycgKS50cmltKCk7XHJcblxyXG5cdFx0aWYgKCAhIHRlbXBsYXRlX2Zvcm1fc2x1ZyApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgY2ZnLnVybCB8fCAhIGNmZy5ub25jZV9sb2FkICkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0d2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IGFqYXggbG9hZCBjb25maWcgaXMgbWlzc2luZy4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhICQgfHwgISAkLmFqYXggKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogalF1ZXJ5IGlzIG5vdCBhdmFpbGFibGUuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdCQuYWpheCgge1xyXG5cdFx0XHR1cmwgICAgICA6IGNmZy51cmwsXHJcblx0XHRcdHR5cGUgICAgIDogJ1BPU1QnLFxyXG5cdFx0XHRkYXRhVHlwZSA6ICd0ZXh0JyxcclxuXHRcdFx0ZGF0YSAgICAgOiB7XHJcblx0XHRcdFx0YWN0aW9uICAgOiAnV1BCQ19BSlhfQkZCX0xPQURfRk9STV9DT05GSUcnLFxyXG5cdFx0XHRcdG5vbmNlICAgIDogY2ZnLm5vbmNlX2xvYWQsXHJcblx0XHRcdFx0Zm9ybV9uYW1lOiB0ZW1wbGF0ZV9mb3JtX3NsdWcsXHJcblx0XHRcdFx0c3RhdHVzICAgOiAndGVtcGxhdGUnXHJcblx0XHRcdH1cclxuXHRcdH0gKVxyXG5cdFx0XHQuZG9uZSggZnVuY3Rpb24gKHJlc3BvbnNlX3RleHQsIF90ZXh0X3N0YXR1cywganF4aHIpIHtcclxuXHJcblx0XHRcdFx0aWYgKCAhIGpxeGhyIHx8IGpxeGhyLnN0YXR1cyAhPT0gMjAwICkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHZhciByZXNwID0gbnVsbDtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0cmVzcCA9IEpTT04ucGFyc2UoIHJlc3BvbnNlX3RleHQgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggX2UxICkge1xyXG5cdFx0XHRcdFx0cmVzcCA9IG51bGw7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoICEgcmVzcCB8fCAhIHJlc3Auc3VjY2VzcyB8fCAhIHJlc3AuZGF0YSApIHtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCByZXNwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZV9jYiggdHJ1ZSwgcmVzcC5kYXRhICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IClcclxuXHRcdFx0LmZhaWwoIGZ1bmN0aW9uIChqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24pIHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsICggKGpxWEhSLnJlc3BvbnNlVGV4dCkgPyBqcVhIUi5yZXNwb25zZVRleHQgOiBudWxsICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHJcblx0fSBjYXRjaCAoIF9lMiApIHtcclxuXHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdGRvbmVfY2IoIGZhbHNlLCBudWxsICk7XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQXBwbHkgdGVtcGxhdGUgZGF0YSB0byBjdXJyZW50IGZvcm0gZWRpdG9yLlxyXG4gKlxyXG4gKiBFeHBlY3RlZCBkYXRhOlxyXG4gKiAtIHN0cnVjdHVyZSAoYXJyYXkpXHJcbiAqIC0gc2V0dGluZ3MgKGFycmF5fG9iamVjdClcclxuICogLSBhZHZhbmNlZF9mb3JtIChzdHJpbmcpXHJcbiAqIC0gY29udGVudF9mb3JtIChzdHJpbmcpXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JmYl9fYXBwbHlfdGVtcGxhdGVfdG9fY3VycmVudF9mb3JtKGRhdGEpIHtcclxuXHJcblx0dmFyIGJ1aWxkZXIgPSB3aW5kb3cud3BiY19iZmIgfHwgbnVsbDtcclxuXHJcblx0dmFyIHN0cnVjdHVyZSA9ICggZGF0YSAmJiBkYXRhLnN0cnVjdHVyZSApID8gZGF0YS5zdHJ1Y3R1cmUgOiBbXTtcclxuXHR2YXIgc2V0dGluZ3MgID0gKCBkYXRhICYmIGRhdGEuc2V0dGluZ3MgKSA/IGRhdGEuc2V0dGluZ3MgOiBudWxsO1xyXG5cclxuXHQvLyAxKSBBcHBseSBzdHJ1Y3R1cmUgaW50byBCdWlsZGVyLlxyXG5cdGlmICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5sb2FkX3NhdmVkX3N0cnVjdHVyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdGJ1aWxkZXIubG9hZF9zYXZlZF9zdHJ1Y3R1cmUoIHN0cnVjdHVyZSB8fCBbXSApO1xyXG5cdH0gZWxzZSBpZiAoIGJ1aWxkZXIgJiYgdHlwZW9mIGJ1aWxkZXIubG9hZF9zdHJ1Y3R1cmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRidWlsZGVyLmxvYWRfc3RydWN0dXJlKCBzdHJ1Y3R1cmUgfHwgW10gKTtcclxuXHR9IGVsc2UgaWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0d2luZG93LndwYmNfYmZiX19vbl9zdHJ1Y3R1cmVfbG9hZGVkKCBzdHJ1Y3R1cmUgfHwgW10gKTtcclxuXHR9XHJcblxyXG5cdC8vIDIpIEFwcGx5IHNldHRpbmdzIGludG8gU2V0dGluZ3MgT3B0aW9ucyBVSSAoYW5kIG90aGVyIGxpc3RlbmVycykuXHJcblx0aWYgKCBzZXR0aW5ncyApIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdC8vIFNvbWUgY2FsbC1zaXRlcyBtYXkgcmV0dXJuIEpTT04gc3RyaW5nLCBiZSBkZWZlbnNpdmUuXHJcblx0XHRcdGlmICggdHlwZW9mIHNldHRpbmdzID09PSAnc3RyaW5nJyApIHtcclxuXHRcdFx0XHRzZXR0aW5ncyA9IEpTT04ucGFyc2UoIHNldHRpbmdzICk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBfZTAgKSB7fVxyXG5cclxuXHRcdGlmICggc2V0dGluZ3MgKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtX3NldHRpbmdzOmFwcGx5Jywge1xyXG5cdFx0XHRcdFx0c2V0dGluZ3MgOiBzZXR0aW5ncyxcclxuXHRcdFx0XHRcdGZvcm1fbmFtZTogKCB3aW5kb3cuV1BCQ19CRkJfQWpheCAmJiB3aW5kb3cuV1BCQ19CRkJfQWpheC5mb3JtX25hbWUgKSA/IHdpbmRvdy5XUEJDX0JGQl9BamF4LmZvcm1fbmFtZSA6ICdzdGFuZGFyZCdcclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6YXBwbHknLCB7IGRldGFpbDogeyBzZXR0aW5nczogc2V0dGluZ3MgfSB9ICkgKTtcclxuXHRcdFx0XHR9IGNhdGNoICggX2UxICkge31cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gMykgQXBwbHkgQWR2YW5jZWQvQ29udGVudCB0ZXh0cyAodXBkYXRlcyB0ZXh0YXJlYSArIG5vdGlmaWVzIEFkdmFuY2VkIE1vZGUgbW9kdWxlKS5cclxuXHR3cGJjX2JmYl9fYXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyhcclxuXHRcdCggZGF0YSAmJiB0eXBlb2YgZGF0YS5hZHZhbmNlZF9mb3JtICE9PSAndW5kZWZpbmVkJyApID8gZGF0YS5hZHZhbmNlZF9mb3JtIDogJycsXHJcblx0XHQoIGRhdGEgJiYgdHlwZW9mIGRhdGEuY29udGVudF9mb3JtICE9PSAndW5kZWZpbmVkJyApID8gZGF0YS5jb250ZW50X2Zvcm0gOiAnJyxcclxuXHRcdCggc2V0dGluZ3MgJiYgc2V0dGluZ3MuYmZiX29wdGlvbnMgJiYgc2V0dGluZ3MuYmZiX29wdGlvbnMuYWR2YW5jZWRfbW9kZV9zb3VyY2UgKSA/IHNldHRpbmdzLmJmYl9vcHRpb25zLmFkdmFuY2VkX21vZGVfc291cmNlIDogJ2J1aWxkZXInXHJcblx0KTtcclxuXHJcblx0Ly8gNCkgTm90aWZ5OiB0ZW1wbGF0ZSBhcHBsaWVkIChvcHRpb25hbCBob29rcykuXHJcblx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0d2luZG93LndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6Zm9ybTp0ZW1wbGF0ZV9hcHBsaWVkJywge1xyXG5cdFx0XHR0ZW1wbGF0ZV9mb3JtX3NsdWc6ICggZGF0YSAmJiBkYXRhLmZvcm1fbmFtZSApID8gZGF0YS5mb3JtX25hbWUgOiAnJyxcclxuXHRcdFx0Zm9ybV9uYW1lICAgICAgICAgOiAoIHdpbmRvdy5XUEJDX0JGQl9BamF4ICYmIHdpbmRvdy5XUEJDX0JGQl9BamF4LmZvcm1fbmFtZSApID8gd2luZG93LldQQkNfQkZCX0FqYXguZm9ybV9uYW1lIDogJ3N0YW5kYXJkJ1xyXG5cdFx0fSApO1xyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEFwcGx5IGFkdmFuY2VkL2NvbnRlbnQgdGV4dHMgaW50byBlZGl0b3IgVUkgc2FmZWx5LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gYWR2YW5jZWRfZm9ybVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gY29udGVudF9mb3JtXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBhZHZhbmNlZF9tb2RlX3NvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19iZmJfX2FwcGx5X2FkdmFuY2VkX21vZGVfdGV4dHMoYWR2YW5jZWRfZm9ybSwgY29udGVudF9mb3JtLCBhZHZhbmNlZF9tb2RlX3NvdXJjZSkge1xyXG5cclxuXHR2YXIgYWYgPSAoIGFkdmFuY2VkX2Zvcm0gPT0gbnVsbCApID8gJycgOiBTdHJpbmcoIGFkdmFuY2VkX2Zvcm0gKTtcclxuXHR2YXIgY2YgPSAoIGNvbnRlbnRfZm9ybSA9PSBudWxsICkgPyAnJyA6IFN0cmluZyggY29udGVudF9mb3JtICk7XHJcblxyXG5cdHZhciB0YV9mb3JtICAgID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fYWR2YW5jZWRfZm9ybV9lZGl0b3InICk7XHJcblx0dmFyIHRhX2NvbnRlbnQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19jb250ZW50X2Zvcm1fZWRpdG9yJyApO1xyXG5cclxuXHRpZiAoIHRhX2Zvcm0gKSB7XHJcblx0XHR0YV9mb3JtLnZhbHVlID0gYWY7XHJcblx0fVxyXG5cdGlmICggdGFfY29udGVudCApIHtcclxuXHRcdHRhX2NvbnRlbnQudmFsdWUgPSBjZjtcclxuXHR9XHJcblxyXG5cdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdHdpbmRvdy53cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmFkdmFuY2VkX3RleHQ6YXBwbHknLCB7XHJcblx0XHRcdGFkdmFuY2VkX2Zvcm0gICAgICAgOiBhZixcclxuXHRcdFx0Y29udGVudF9mb3JtICAgICAgICA6IGNmLFxyXG5cdFx0XHRhZHZhbmNlZF9tb2RlX3NvdXJjZTogYWR2YW5jZWRfbW9kZV9zb3VyY2VcclxuXHRcdH0gKTtcclxuXHR9XHJcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0MsV0FBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixNQUFNQyxJQUFJLEdBQUlGLENBQUMsQ0FBQ0csYUFBYSxHQUFHSCxDQUFDLENBQUNHLGFBQWEsSUFBSSxDQUFDLENBQUU7RUFDdEQsTUFBTUMsRUFBRSxHQUFNRixJQUFJLENBQUNFLEVBQUUsR0FBR0YsSUFBSSxDQUFDRSxFQUFFLElBQUksQ0FBQyxDQUFFO0VBRXRDQSxFQUFFLENBQUNDLG9CQUFvQixHQUFHRCxFQUFFLENBQUNDLG9CQUFvQixJQUFJLENBQUMsQ0FBQzs7RUFFdkQ7RUFDQSxJQUFLRCxFQUFFLENBQUNDLG9CQUFvQixDQUFDQyxPQUFPLEVBQUc7SUFDdEM7RUFDRDtFQUNBRixFQUFFLENBQUNDLG9CQUFvQixDQUFDQyxPQUFPLEdBQUcsSUFB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

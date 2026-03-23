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
    try {
      if (opts && typeof opts === 'object' && opts.initial_search) {
        initial_search = String(opts.initial_search || '').trim();
      }
    } catch (_e0) {}

    // Accept URL separator "^" in initial_search and show the UI separator "|" in the input.
    initial_search = w.wpbc_bfb__normalize_template_search(initial_search);
    picker.set_pager(1, false);
    picker.apply_search_value(initial_search, function () {});

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
 */
function wpbc_bfb__menu_forms__apply_template_search(search_key, menu_option_this) {
  search_key = String(search_key || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();

  // Normalize configured OR separator (default "|") so server can split reliably.
  search_key = window.wpbc_bfb__normalize_template_search(search_key);

  // Open the same modal, but pass initial_search.
  wpbc_bfb__menu_forms__apply_template(menu_option_this || null, {
    initial_search: search_key
  });
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9hcHBseV90ZW1wbGF0ZS5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJVSSIsIk1vZGFsX0FwcGx5X1RlbXBsYXRlIiwiX19ib3VuZCIsIk1PREFMX0RPTV9JRCIsIlRQTF9NT0RBTF9JRCIsIklEX1RQTF9TRUFSQ0giLCJTRUxfQ09ORklSTSIsIlNFTF9DQU5DRUwiLCJTRUxfRVJST1IiLCJCTEFOS19URU1QTEFURV9TTFVHIiwid3BiY19iZmJfX2kxOG4iLCJrZXkiLCJmYWxsYmFjayIsIlN0cmluZyIsIndwYmNfYmZiX19oYXNfdGV4dCIsInZhbHVlIiwidHJpbSIsIndwYmNfYmZiX19nZXRfZWwiLCJpZCIsImdldEVsZW1lbnRCeUlkIiwid3BiY19iZmJfX2dldF9tb2RhbF9lbCIsIndwYmNfYmZiX19zZXRfZXJyb3IiLCJtc2ciLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJ0ZXh0Q29udGVudCIsInN0eWxlIiwiZGlzcGxheSIsIndwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQiLCJtb2RhbF9lbCIsInRlbXBsYXRlX2Zvcm1fc2x1ZyIsIndwYmNfYmZiX19nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyIsInBpY2tlciIsIl9fd3BiY19iZmJfdGVtcGxhdGVfcGlja2VyIiwiZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWciLCJ2IiwiX193cGJjX2JmYl9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnIiwid3BiY19iZmJfX2dldF90ZW1wbGF0ZV9waWNrZXIiLCJUZW1wbGF0ZV9QaWNrZXIiLCJjcmVhdGUiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsInNlYXJjaF9pbnB1dF9pZCIsImJsYW5rX3RlbXBsYXRlX3NsdWciLCJhbGxvd19kZWxldGUiLCJhbGxvd19wcmVzZXRzIiwiYWxsb3dfc2FtZV9jbGlja19ibGFuayIsImJsYW5rX2Rlc2MiLCJlbXB0eV90ZXh0IiwibGlzdF9oZWxwZXJfbWlzc2luZ190ZXh0IiwibG9hZF9mYWlsZWRfdGV4dCIsIm9uX3NldF9lcnJvciIsIm9wZW4iLCJvbl9jb25maXJtIiwib25fb3BlbiIsIm9wdHMiLCJyZWYiLCJUZW1wbGF0ZXMiLCJlbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlIiwiaW5zaWRlIiwiX193cGJjX2JmYl9hcHBseV90ZW1wbGF0ZV9jYiIsImJpbmRfaGFuZGxlcnMiLCJyZXNldF9zdGF0ZSIsIk1vZGFscyIsInNob3ciLCJpbml0aWFsX3NlYXJjaCIsIl9lMCIsIndwYmNfYmZiX19ub3JtYWxpemVfdGVtcGxhdGVfc2VhcmNoIiwic2V0X3BhZ2VyIiwiYXBwbHlfc2VhcmNoX3ZhbHVlIiwic2V0VGltZW91dCIsInNfZWwiLCJmb2N1cyIsIl9lMSIsInNlbGVjdCIsIl9lMiIsIl9lMyIsImFkZEV2ZW50TGlzdGVuZXIiLCJlIiwidGFyZ2V0IiwiY2xvc2VzdCIsImlzX2NvbmZpcm0iLCJwcmV2ZW50RGVmYXVsdCIsInBheWxvYWQiLCJjYiIsImhpZGUiLCJpc19jYW5jZWwiLCJ3aW5kb3ciLCJkb2N1bWVudCIsIndwYmNfYmZiX19hcHBseV90ZW1wbGF0ZV9mcm9tX3BheWxvYWQiLCJtZW51X29wdGlvbl90aGlzIiwidGVtcGxhdGVfZm9ybV9rZXkiLCIkYnRuIiwialF1ZXJ5Iiwib3JpZ2luYWxfYnVzeV90ZXh0IiwibGVuZ3RoIiwiZGF0YSIsIndwYmNfYmZiX19idXR0b25fYnVzeV9zdGFydCIsIndwYmNfYmZiX19idXN5X2VuZCIsIndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQiLCJ3cGJjX2JmYl9fYXBwbHlfdGVtcGxhdGVfdG9fY3VycmVudF9mb3JtIiwic3RydWN0dXJlIiwicGFnZSIsImNvbnRlbnQiLCJzZXR0aW5ncyIsIm9wdGlvbnMiLCJjc3NfdmFycyIsImJmYl9vcHRpb25zIiwiYWR2YW5jZWRfbW9kZV9zb3VyY2UiLCJhZHZhbmNlZF9mb3JtIiwiY29udGVudF9mb3JtIiwid3BiY19iZmJfX2xvYWRfdGVtcGxhdGVfZm9ybV9jb25maWciLCJvayIsIndwYmNfYmZiX19tZW51X2Zvcm1zX19hcHBseV90ZW1wbGF0ZSIsIndwYmNfYmZiX19tZW51X2Zvcm1zX19hcHBseV90ZW1wbGF0ZV9zZWFyY2giLCJzZWFyY2hfa2V5IiwicmVwbGFjZSIsImRvbmVfY2IiLCJjZmciLCJXUEJDX0JGQl9BamF4IiwiJCIsInVybCIsIm5vbmNlX2xvYWQiLCJhamF4IiwidHlwZSIsImRhdGFUeXBlIiwiYWN0aW9uIiwibm9uY2UiLCJmb3JtX25hbWUiLCJzdGF0dXMiLCJkb25lIiwicmVzcG9uc2VfdGV4dCIsIl90ZXh0X3N0YXR1cyIsImpxeGhyIiwicmVzcCIsIkpTT04iLCJwYXJzZSIsInN1Y2Nlc3MiLCJmYWlsIiwianFYSFIiLCJ0ZXh0U3RhdHVzIiwiZXJyb3JUaHJvd24iLCJyZXNwb25zZVRleHQiLCJidWlsZGVyIiwid3BiY19iZmIiLCJsb2FkX3NhdmVkX3N0cnVjdHVyZSIsImxvYWRfc3RydWN0dXJlIiwid3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQiLCJ3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSIsImRpc3BhdGNoRXZlbnQiLCJDdXN0b21FdmVudCIsImRldGFpbCIsIndwYmNfYmZiX19hcHBseV9hZHZhbmNlZF9tb2RlX3RleHRzIiwiYWYiLCJjZiIsInRhX2Zvcm0iLCJ0YV9jb250ZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX3NyYy9tb2RhbF9fZm9ybV9hcHBseV90ZW1wbGF0ZS5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQm9va2luZyBDYWxlbmRhciDigJQgQXBwbHkgVGVtcGxhdGUgbW9kYWwgaGVscGVyIChCRkIgQWRtaW4pXHJcbiAqXHJcbiAqIFVJLk1vZGFsX0FwcGx5X1RlbXBsYXRlLm9wZW4ob25fY29uZmlybSwgb25fb3BlbilcclxuICpcclxuICogb25fY29uZmlybShwYXlsb2FkKTpcclxuICogIHBheWxvYWQgPSB7XHJcbiAqICAgIHRlbXBsYXRlX2Zvcm1fc2x1ZyA6IHN0cmluZyAvLyAnX19ibGFua19fJyBvciAnJyA9PiBibGFuay9yZXNldFxyXG4gKiAgfVxyXG4gKlxyXG4gKiBBcHBsaWVzIHRlbXBsYXRlIGJ5OlxyXG4gKiAtIExvYWRpbmcgdGVtcGxhdGUgRm9ybUNvbmZpZyAoc3RhdHVzPXRlbXBsYXRlKSB2aWEgQUpBWCBsb2FkIGVuZHBvaW50XHJcbiAqIC0gQXBwbHlpbmcgcmV0dXJuZWQgc3RydWN0dXJlICsgc2V0dGluZ3MgKyBhZHZhbmNlZC9jb250ZW50IGZvcm0gdGV4dHMgaW50byBjdXJyZW50IGVkaXRvclxyXG4gKiAtIERvZXMgTk9UIGF1dG8tc2F2ZSAodXNlciBjbGlja3MgXCJTYXZlIEZvcm1cIilcclxuICpcclxuICogRGVwZW5kcyBvbjpcclxuICogLSBVSS5UZW1wbGF0ZXMuZW5zdXJlX2RvbV9yZWZfZnJvbV93cF90ZW1wbGF0ZVxyXG4gKiAtIFVJLk1vZGFscy5zaG93L2hpZGVcclxuICogLSB3cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMoKVxyXG4gKiAtIHdpbmRvdy5qUXVlcnlcclxuICpcclxuICogQGZpbGU6IC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2FkbWluLXBhZ2UtdHBsL19vdXQvbW9kYWxfX2Zvcm1fYXBwbHlfdGVtcGxhdGUuanNcclxuICovXHJcblxyXG4vKiBnbG9iYWxzIHdpbmRvdywgZG9jdW1lbnQgKi9cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjb25zdCBDb3JlID0gKHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSk7XHJcblx0Y29uc3QgVUkgICA9IChDb3JlLlVJID0gQ29yZS5VSSB8fCB7fSk7XHJcblxyXG5cdFVJLk1vZGFsX0FwcGx5X1RlbXBsYXRlID0gVUkuTW9kYWxfQXBwbHlfVGVtcGxhdGUgfHwge307XHJcblxyXG5cdC8vIElkZW1wb3RlbmN5IGd1YXJkLlxyXG5cdGlmICggVUkuTW9kYWxfQXBwbHlfVGVtcGxhdGUuX19ib3VuZCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0VUkuTW9kYWxfQXBwbHlfVGVtcGxhdGUuX19ib3VuZCA9IHRydWU7XHJcblxyXG5cdGNvbnN0IE1PREFMX0RPTV9JRCA9ICd3cGJjX2JmYl9tb2RhbF9fYXBwbHlfdGVtcGxhdGUnO1xyXG5cdGNvbnN0IFRQTF9NT0RBTF9JRCA9ICd3cGJjLWJmYi10cGwtbW9kYWwtYXBwbHlfdGVtcGxhdGUnO1xyXG5cclxuXHRjb25zdCBJRF9UUExfU0VBUkNIID0gJ3dwYmNfYmZiX3BvcHVwX21vZGFsX19hcHBseV90ZW1wbGF0ZV9fdHBsX3NlYXJjaCc7XHJcblxyXG5cdGNvbnN0IFNFTF9DT05GSVJNID0gJyMnICsgTU9EQUxfRE9NX0lEICsgJyBbZGF0YS13cGJjLWJmYi1jb25maXJtPVwiMVwiXSc7XHJcblx0Y29uc3QgU0VMX0NBTkNFTCAgPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLWNhbmNlbD1cIjFcIl0nO1xyXG5cdGNvbnN0IFNFTF9FUlJPUiAgID0gJyMnICsgTU9EQUxfRE9NX0lEICsgJyBbZGF0YS13cGJjLWJmYi1lcnJvcj1cIjFcIl0nO1xyXG5cclxuXHRjb25zdCBCTEFOS19URU1QTEFURV9TTFVHID0gJ19fYmxhbmtfXyc7XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19pMThuKGtleSwgZmFsbGJhY2spIHtcclxuXHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX2kxOG4gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHJldHVybiB3LndwYmNfYmZiX19pMThuKCBrZXksIGZhbGxiYWNrICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gU3RyaW5nKCBmYWxsYmFjayB8fCAnJyApO1xyXG5cdH1cclxuXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19oYXNfdGV4dCh2YWx1ZSkge1xyXG5cdFx0cmV0dXJuICEhICggdmFsdWUgJiYgU3RyaW5nKCB2YWx1ZSApLnRyaW0oKSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2dldF9lbChpZCkge1xyXG5cdFx0cmV0dXJuIGQuZ2V0RWxlbWVudEJ5SWQoIGlkICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X21vZGFsX2VsKCkge1xyXG5cdFx0cmV0dXJuIGQuZ2V0RWxlbWVudEJ5SWQoIE1PREFMX0RPTV9JRCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3NldF9lcnJvcihtc2cpIHtcclxuXHRcdGNvbnN0IGVsID0gZC5xdWVyeVNlbGVjdG9yKCBTRUxfRVJST1IgKTtcclxuXHRcdGlmICggISBlbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCB3cGJjX2JmYl9faGFzX3RleHQoIG1zZyApICkge1xyXG5cdFx0XHQvLyBTYWZlcjogZG8gbm90IGluamVjdCBIVE1MIGhlcmUuXHJcblx0XHRcdGVsLnRleHRDb250ZW50ID0gU3RyaW5nKCBtc2cgKTtcclxuXHRcdFx0ZWwuc3R5bGUuZGlzcGxheSA9ICcnO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZWwudGV4dENvbnRlbnQgPSAnJztcclxuXHRcdFx0ZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQobW9kYWxfZWwpIHtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHRlbXBsYXRlX2Zvcm1fc2x1Zzogd3BiY19iZmJfX2dldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnKCBtb2RhbF9lbCApXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0Ly8gLS0gSGVscGVycyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2dldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnKG1vZGFsX2VsKSB7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgKSB7XHJcblx0XHRcdHJldHVybiBCTEFOS19URU1QTEFURV9TTFVHO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgcGlja2VyID0gbW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXIgfHwgbnVsbDtcclxuXHRcdGlmICggcGlja2VyICYmIHR5cGVvZiBwaWNrZXIuZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHJldHVybiBwaWNrZXIuZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcoKTtcclxuXHRcdH1cclxuXHRcdGNvbnN0IHYgPSBTdHJpbmcoIG1vZGFsX2VsLl9fd3BiY19iZmJfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyB8fCAnJyApO1xyXG5cdFx0cmV0dXJuIHYgPyB2IDogQkxBTktfVEVNUExBVEVfU0xVRztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19nZXRfdGVtcGxhdGVfcGlja2VyKG1vZGFsX2VsKSB7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBVSS5UZW1wbGF0ZV9QaWNrZXIgfHwgdHlwZW9mIFVJLlRlbXBsYXRlX1BpY2tlci5jcmVhdGUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBUZW1wbGF0ZSBQaWNrZXIgaGVscGVyIGlzIG5vdCBhdmFpbGFibGUuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgbW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXIgKSB7XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfdGVtcGxhdGVfcGlja2VyID0gVUkuVGVtcGxhdGVfUGlja2VyLmNyZWF0ZShcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRtb2RhbF9lbCAgICAgICAgICAgICAgICA6IG1vZGFsX2VsLFxyXG5cdFx0XHRcdFx0c2VhcmNoX2lucHV0X2lkICAgICAgICAgOiBJRF9UUExfU0VBUkNILFxyXG5cdFx0XHRcdFx0YmxhbmtfdGVtcGxhdGVfc2x1ZyAgICAgOiBCTEFOS19URU1QTEFURV9TTFVHLFxyXG5cdFx0XHRcdFx0YWxsb3dfZGVsZXRlICAgICAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0YWxsb3dfcHJlc2V0cyAgICAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0YWxsb3dfc2FtZV9jbGlja19ibGFuayAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdGJsYW5rX2Rlc2MgICAgICAgICAgICAgIDogd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FwcGx5X3RlbXBsYXRlX2JsYW5rX2Rlc2MnLCAnUmVzZXQgdG8gYW4gZW1wdHkgQnVpbGRlciBsYXlvdXQuJyApLFxyXG5cdFx0XHRcdFx0ZW1wdHlfdGV4dCAgICAgICAgICAgICAgOiB3cGJjX2JmYl9faTE4biggJ3RleHRfYXBwbHlfdGVtcGxhdGVfZW1wdHlfdGVtcGxhdGVzJywgJ05vIHRlbXBsYXRlcyBmb3VuZC4nICksXHJcblx0XHRcdFx0XHRsaXN0X2hlbHBlcl9taXNzaW5nX3RleHQ6IHdwYmNfYmZiX19pMThuKCAndGV4dF9hcHBseV90ZW1wbGF0ZV9saXN0X2hlbHBlcl9taXNzaW5nJywgJ1dQQkMgQkZCOiBsaXN0IGZvcm1zIGhlbHBlciBtaXNzaW5nLicgKSxcclxuXHRcdFx0XHRcdGxvYWRfZmFpbGVkX3RleHQgICAgICAgIDogd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FwcGx5X3RlbXBsYXRlX2xvYWRfZmFpbGVkJywgJ0ZhaWxlZCB0byBsb2FkIHRlbXBsYXRlcyBsaXN0LicgKSxcclxuXHRcdFx0XHRcdG9uX3NldF9lcnJvciAgICAgICAgICAgIDogd3BiY19iZmJfX3NldF9lcnJvclxyXG5cdFx0XHRcdH1cclxuXHRcdFx0KTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXI7XHJcblx0fVxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cdFVJLk1vZGFsX0FwcGx5X1RlbXBsYXRlLm9wZW4gPSBmdW5jdGlvbiAob25fY29uZmlybSwgb25fb3Blbiwgb3B0cykge1xyXG5cclxuXHRcdGNvbnN0IHJlZiA9IFVJLlRlbXBsYXRlcy5lbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlKCBUUExfTU9EQUxfSUQsIE1PREFMX0RPTV9JRCApO1xyXG5cdFx0aWYgKCAhIHJlZiB8fCAhIHJlZi5lbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBtb2RhbF9lbCA9IHJlZi5lbDtcclxuXHJcblx0XHQvLyBJZiB0ZW1wbGF0ZSByb290IGlzIGEgd3JhcHBlciAobGlrZSA8c3Bhbj4pLCBmaW5kIHRoZSBhY3R1YWwgbW9kYWwgaW5zaWRlIGl0LlxyXG5cdFx0aWYgKCBtb2RhbF9lbCAmJiBtb2RhbF9lbC5pZCAhPT0gTU9EQUxfRE9NX0lEICkge1xyXG5cdFx0XHRjb25zdCBpbnNpZGUgPSBtb2RhbF9lbC5xdWVyeVNlbGVjdG9yID8gbW9kYWxfZWwucXVlcnlTZWxlY3RvciggJyMnICsgTU9EQUxfRE9NX0lEICkgOiBudWxsO1xyXG5cdFx0XHRpZiAoIGluc2lkZSApIHtcclxuXHRcdFx0XHRtb2RhbF9lbCA9IGluc2lkZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIG1vZGFsX2VsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bW9kYWxfZWwuX193cGJjX2JmYl9hcHBseV90ZW1wbGF0ZV9jYiA9ICh0eXBlb2Ygb25fY29uZmlybSA9PT0gJ2Z1bmN0aW9uJykgPyBvbl9jb25maXJtIDogbnVsbDtcclxuXHJcblx0XHRjb25zdCBwaWNrZXIgPSB3cGJjX2JmYl9fZ2V0X3RlbXBsYXRlX3BpY2tlciggbW9kYWxfZWwgKTtcclxuXHRcdGlmICggISBwaWNrZXIgKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0dy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBUZW1wbGF0ZSBQaWNrZXIgaGVscGVyIGlzIG5vdCBhdmFpbGFibGUuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRwaWNrZXIuYmluZF9oYW5kbGVycygpO1xyXG5cdFx0cGlja2VyLnJlc2V0X3N0YXRlKCk7XHJcblxyXG5cdFx0VUkuTW9kYWxzLnNob3coIG1vZGFsX2VsICk7XHJcblxyXG5cdFx0Ly8gT3B0aW9uYWwgaW5pdGlhbCBzZWFyY2ggKHByZWZpbGwgKyBhdXRvLWxvYWQpLlxyXG5cdFx0bGV0IGluaXRpYWxfc2VhcmNoID0gJyc7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoIG9wdHMgJiYgdHlwZW9mIG9wdHMgPT09ICdvYmplY3QnICYmIG9wdHMuaW5pdGlhbF9zZWFyY2ggKSB7XHJcblx0XHRcdFx0aW5pdGlhbF9zZWFyY2ggPSBTdHJpbmcoIG9wdHMuaW5pdGlhbF9zZWFyY2ggfHwgJycgKS50cmltKCk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBfZTAgKSB7fVxyXG5cclxuXHRcdC8vIEFjY2VwdCBVUkwgc2VwYXJhdG9yIFwiXlwiIGluIGluaXRpYWxfc2VhcmNoIGFuZCBzaG93IHRoZSBVSSBzZXBhcmF0b3IgXCJ8XCIgaW4gdGhlIGlucHV0LlxyXG5cdFx0aW5pdGlhbF9zZWFyY2ggPSB3LndwYmNfYmZiX19ub3JtYWxpemVfdGVtcGxhdGVfc2VhcmNoKCBpbml0aWFsX3NlYXJjaCApO1xyXG5cclxuXHRcdHBpY2tlci5zZXRfcGFnZXIoIDEsIGZhbHNlICk7XHJcblx0XHRwaWNrZXIuYXBwbHlfc2VhcmNoX3ZhbHVlKCBpbml0aWFsX3NlYXJjaCwgZnVuY3Rpb24gKCkgeyB9ICk7XHJcblxyXG5cdFx0Ly8gRm9jdXMgc2VhcmNoIGlucHV0LlxyXG5cdFx0dy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGNvbnN0IHNfZWwgPSB3cGJjX2JmYl9fZ2V0X2VsKCBJRF9UUExfU0VBUkNIICk7XHJcblx0XHRcdGlmICggc19lbCAmJiBzX2VsLmZvY3VzICkge1xyXG5cdFx0XHRcdHRyeSB7IHNfZWwuZm9jdXMoKTsgfSBjYXRjaCAoIF9lMSApIHt9XHJcblx0XHRcdFx0dHJ5IHsgc19lbC5zZWxlY3QoKTsgfSBjYXRjaCAoIF9lMiApIHt9XHJcblx0XHRcdH1cclxuXHRcdH0sIDAgKTtcclxuXHJcblx0XHRpZiAoIG9uX29wZW4gKSB7XHJcblx0XHRcdHRyeSB7IG9uX29wZW4oIG1vZGFsX2VsICk7IH0gY2F0Y2ggKCBfZTMgKSB7fVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIENvbmZpcm0gLyBDYW5jZWwgKHNpbmdsZSBkZWxlZ2F0ZWQgbGlzdGVuZXIpLlxyXG5cdGQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHJcblx0XHRjb25zdCBtb2RhbF9lbCA9IHdwYmNfYmZiX19nZXRfbW9kYWxfZWwoKTtcclxuXHRcdGlmICggISBtb2RhbF9lbCB8fCAhIGUgfHwgISBlLnRhcmdldCB8fCAhIGUudGFyZ2V0LmNsb3Nlc3QgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBpc19jb25maXJtID0gZS50YXJnZXQuY2xvc2VzdCggU0VMX0NPTkZJUk0gKTtcclxuXHRcdGlmICggaXNfY29uZmlybSApIHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0Y29uc3QgcGF5bG9hZCA9IHdwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQoIG1vZGFsX2VsICk7XHJcblxyXG5cdFx0XHR3cGJjX2JmYl9fc2V0X2Vycm9yKCAnJyApO1xyXG5cclxuXHRcdFx0Y29uc3QgY2IgPSBtb2RhbF9lbC5fX3dwYmNfYmZiX2FwcGx5X3RlbXBsYXRlX2NiIHx8IG51bGw7XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfYXBwbHlfdGVtcGxhdGVfY2IgPSBudWxsO1xyXG5cclxuXHRcdFx0VUkuTW9kYWxzLmhpZGUoIG1vZGFsX2VsICk7XHJcblxyXG5cdFx0XHRpZiAoIGNiICkge1xyXG5cdFx0XHRcdHRyeSB7IGNiKCBwYXlsb2FkICk7IH0gY2F0Y2ggKCBfZTMgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBpc19jYW5jZWwgPSBlLnRhcmdldC5jbG9zZXN0KCBTRUxfQ0FOQ0VMICk7XHJcblx0XHRpZiAoIGlzX2NhbmNlbCApIHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2FwcGx5X3RlbXBsYXRlX2NiID0gbnVsbDtcclxuXHRcdFx0VUkuTW9kYWxzLmhpZGUoIG1vZGFsX2VsICk7XHJcblx0XHR9XHJcblxyXG5cdH0sIHRydWUgKTtcclxuXHJcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSk7XHJcblxyXG5cclxuLyoqXHJcbiAqIEFwcGx5IHNlbGVjdGVkIHRlbXBsYXRlIChwYXlsb2FkKSBpbnRvIGN1cnJlbnQgZm9ybSBlZGl0b3IuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYXlsb2FkXHJcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gbWVudV9vcHRpb25fdGhpcyBPcHRpb25hbCBtZW51IGJ1dHRvbiAoYnVzeSBVSSkuIENhbiBiZSBudWxsLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19iZmJfX2FwcGx5X3RlbXBsYXRlX2Zyb21fcGF5bG9hZChwYXlsb2FkLCBtZW51X29wdGlvbl90aGlzKSB7XHJcblxyXG5cdHZhciB0ZW1wbGF0ZV9mb3JtX2tleSA9ICcnO1xyXG5cclxuXHRpZiAoIHBheWxvYWQgJiYgcGF5bG9hZC50ZW1wbGF0ZV9mb3JtX3NsdWcgJiYgcGF5bG9hZC50ZW1wbGF0ZV9mb3JtX3NsdWcgIT09ICdfX2JsYW5rX18nICkge1xyXG5cdFx0dGVtcGxhdGVfZm9ybV9rZXkgPSBTdHJpbmcoIHBheWxvYWQudGVtcGxhdGVfZm9ybV9zbHVnICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRlbXBsYXRlX2Zvcm1fa2V5ID0gJyc7XHJcblx0fVxyXG5cclxuXHR2YXIgJGJ0biA9ICggd2luZG93LmpRdWVyeSAmJiBtZW51X29wdGlvbl90aGlzICkgPyB3aW5kb3cualF1ZXJ5KCBtZW51X29wdGlvbl90aGlzICkgOiBudWxsO1xyXG5cdHZhciBvcmlnaW5hbF9idXN5X3RleHQgPSAnJztcclxuXHJcblx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0b3JpZ2luYWxfYnVzeV90ZXh0ID0gJGJ0bi5kYXRhKCAnd3BiYy11LWJ1c3ktdGV4dCcgKSB8fCAnJztcclxuXHRcdCRidG4uZGF0YSggJ3dwYmMtdS1idXN5LXRleHQnLCB3cGJjX2JmYl9faTE4biggJ3RleHRfYXBwbHlfdGVtcGxhdGVfYXBwbHlpbmcnLCAnQXBwbHlpbmcuLi4nICkgKTtcclxuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHdpbmRvdy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQoICRidG4gKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19idXN5X2VuZCgpIHtcclxuXHRcdGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0d2luZG93LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQoICRidG4gKTtcclxuXHRcdFx0fVxyXG5cdFx0XHQkYnRuLmRhdGEoICd3cGJjLXUtYnVzeS10ZXh0Jywgb3JpZ2luYWxfYnVzeV90ZXh0ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBBcHBseSBibGFuayAobm8gQUpBWCkuXHJcblx0aWYgKCAhIHRlbXBsYXRlX2Zvcm1fa2V5ICkge1xyXG5cclxuXHRcdHdwYmNfYmZiX19hcHBseV90ZW1wbGF0ZV90b19jdXJyZW50X2Zvcm0oXHJcblx0XHRcdHtcclxuXHRcdFx0XHRzdHJ1Y3R1cmUgICAgIDogWyB7IHBhZ2U6IDEsIGNvbnRlbnQ6IFtdIH0gXSxcclxuXHRcdFx0XHRzZXR0aW5ncyAgICAgIDogeyBvcHRpb25zOiB7fSwgY3NzX3ZhcnM6IFtdLCBiZmJfb3B0aW9uczogeyBhZHZhbmNlZF9tb2RlX3NvdXJjZTogJ2J1aWxkZXInIH0gfSxcclxuXHRcdFx0XHRhZHZhbmNlZF9mb3JtIDogJycsXHJcblx0XHRcdFx0Y29udGVudF9mb3JtICA6ICcnXHJcblx0XHRcdH1cclxuXHRcdCk7XHJcblxyXG5cdFx0d3BiY19iZmJfX2J1c3lfZW5kKCk7XHJcblxyXG5cdFx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIHdwYmNfYmZiX19pMThuKCAndGV4dF9hcHBseV90ZW1wbGF0ZV9ibGFua19hcHBsaWVkJywgJ0JsYW5rIGxheW91dCBhcHBsaWVkLiBDbGljayDigJxTYXZlIEZvcm3igJ0gdG8ga2VlcCBjaGFuZ2VzLicgKSwgJ2luZm8nLCA0MDAwLCBmYWxzZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8vIExvYWQgdGVtcGxhdGUgY29uZmlnIChzdGF0dXM9dGVtcGxhdGUpIGFuZCBhcHBseS5cclxuXHR3cGJjX2JmYl9fbG9hZF90ZW1wbGF0ZV9mb3JtX2NvbmZpZyggdGVtcGxhdGVfZm9ybV9rZXksIGZ1bmN0aW9uIChvaywgZGF0YSkge1xyXG5cclxuXHRcdGlmICggISBvayB8fCAhIGRhdGEgKSB7XHJcblx0XHRcdHdwYmNfYmZiX19idXN5X2VuZCgpO1xyXG5cdFx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0d2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCB3cGJjX2JmYl9faTE4biggJ3RleHRfYXBwbHlfdGVtcGxhdGVfZm9ybV9sb2FkX2ZhaWxlZCcsICdGYWlsZWQgdG8gbG9hZCB0ZW1wbGF0ZS4nICksICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdwYmNfYmZiX19hcHBseV90ZW1wbGF0ZV90b19jdXJyZW50X2Zvcm0oIGRhdGEgKTtcclxuXHJcblx0XHR3cGJjX2JmYl9fYnVzeV9lbmQoKTtcclxuXHJcblx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FwcGx5X3RlbXBsYXRlX2FwcGxpZWQnLCAnVGVtcGxhdGUgYXBwbGllZC4gQ2xpY2sg4oCcU2F2ZSBGb3Jt4oCdIHRvIGtlZXAgY2hhbmdlcy4nICksICdzdWNjZXNzJywgNDAwMCwgZmFsc2UgKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogTWVudSBhY3Rpb246IG9wZW4gbW9kYWwgYW5kIGFwcGx5IHNlbGVjdGVkIHRlbXBsYXRlIGludG8gY3VycmVudCBmb3JtIGVkaXRvci5cclxuICpcclxuICogVXNhZ2UgaW4gbWVudTpcclxuICogb25jbGljaz1cIndwYmNfYmZiX19tZW51X2Zvcm1zX19hcHBseV90ZW1wbGF0ZSh0aGlzKTtcIlxyXG4gKlxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IG1lbnVfb3B0aW9uX3RoaXNcclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRzXVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gW29wdHMuaW5pdGlhbF9zZWFyY2hdIE9wdGlvbmFsIHByZWZpbGxlZCB0ZW1wbGF0ZSBzZWFyY2ggc3RyaW5nLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlKG1lbnVfb3B0aW9uX3RoaXMsIG9wdHMpIHtcclxuXHJcblx0aWYgKCAhIHdpbmRvdy5XUEJDX0JGQl9Db3JlIHx8ICEgd2luZG93LldQQkNfQkZCX0NvcmUuVUkgfHwgISB3aW5kb3cuV1BCQ19CRkJfQ29yZS5VSS5Nb2RhbF9BcHBseV9UZW1wbGF0ZSApIHtcclxuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0d2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IEFwcGx5IFRlbXBsYXRlIG1vZGFsIGlzIG5vdCBhdmFpbGFibGUuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8vIEVuc3VyZSBvcHRzIGlzIGEgcGxhaW4gb2JqZWN0LlxyXG5cdGlmICggISBvcHRzIHx8IHR5cGVvZiBvcHRzICE9PSAnb2JqZWN0JyApIHtcclxuXHRcdG9wdHMgPSB7fTtcclxuXHR9XHJcblxyXG5cdHdpbmRvdy5XUEJDX0JGQl9Db3JlLlVJLk1vZGFsX0FwcGx5X1RlbXBsYXRlLm9wZW4oXHJcblx0XHRmdW5jdGlvbiAocGF5bG9hZCkge1xyXG5cdFx0XHQvLyBJTVBPUlRBTlQ6IGFwcGx5IGRpcmVjdGx5IGZyb20gcGF5bG9hZCAoRE8gTk9UIHJlb3BlbiB0aGUgbW9kYWwpLlxyXG5cdFx0XHR3cGJjX2JmYl9fYXBwbHlfdGVtcGxhdGVfZnJvbV9wYXlsb2FkKCBwYXlsb2FkLCBtZW51X29wdGlvbl90aGlzIHx8IG51bGwgKTtcclxuXHRcdH0sXHJcblx0XHRudWxsLFxyXG5cdFx0b3B0c1xyXG5cdCk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogT3BlbiBcIkFwcGx5IFRlbXBsYXRlXCIgbW9kYWwgd2l0aCBwcmVmaWxsZWQgc2VhcmNoIGFuZCBhdXRvLXNlYXJjaC5cclxuICpcclxuICogRXhhbXBsZTpcclxuICogICB3cGJjX2JmYl9fbWVudV9mb3Jtc19fYXBwbHlfdGVtcGxhdGVfc2VhcmNoKCAndGltZScsIG51bGwgKTtcclxuICogICB3cGJjX2JmYl9fbWVudV9mb3Jtc19fYXBwbHlfdGVtcGxhdGVfc2VhcmNoKCAnZnVsbCBkYXknLCBudWxsICk7XHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBzZWFyY2hfa2V5XHJcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR8bnVsbH0gbWVudV9vcHRpb25fdGhpcyBPcHRpb25hbCBtZW51IGJ1dHRvbiAoYnVzeSBVSSkuIENhbiBiZSBudWxsLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlX3NlYXJjaChzZWFyY2hfa2V5LCBtZW51X29wdGlvbl90aGlzKSB7XHJcblxyXG5cdHNlYXJjaF9rZXkgPSBTdHJpbmcoIHNlYXJjaF9rZXkgfHwgJycgKVxyXG5cdFx0LnJlcGxhY2UoIC9bXFx1MDAwMC1cXHUwMDFGXFx1MDA3Rl0vZywgJyAnIClcclxuXHRcdC5yZXBsYWNlKCAvXFxzKy9nLCAnICcgKVxyXG5cdFx0LnRyaW0oKTtcclxuXHJcblx0Ly8gTm9ybWFsaXplIGNvbmZpZ3VyZWQgT1Igc2VwYXJhdG9yIChkZWZhdWx0IFwifFwiKSBzbyBzZXJ2ZXIgY2FuIHNwbGl0IHJlbGlhYmx5LlxyXG5cdHNlYXJjaF9rZXkgPSB3aW5kb3cud3BiY19iZmJfX25vcm1hbGl6ZV90ZW1wbGF0ZV9zZWFyY2goIHNlYXJjaF9rZXkgKTtcclxuXHJcblx0Ly8gT3BlbiB0aGUgc2FtZSBtb2RhbCwgYnV0IHBhc3MgaW5pdGlhbF9zZWFyY2guXHJcblx0d3BiY19iZmJfX21lbnVfZm9ybXNfX2FwcGx5X3RlbXBsYXRlKCBtZW51X29wdGlvbl90aGlzIHx8IG51bGwsIHsgaW5pdGlhbF9zZWFyY2g6IHNlYXJjaF9rZXkgfSApO1xyXG59XHJcblxyXG4vKipcclxuICogTG9hZCB0ZW1wbGF0ZSBGb3JtQ29uZmlnIHZpYSBleGlzdGluZyBBSkFYIGVuZHBvaW50LlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gdGVtcGxhdGVfZm9ybV9zbHVnXHJcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGRvbmVfY2IgZnVuY3Rpb24ob2s6Ym9vbGVhbiwgZGF0YTpPYmplY3R8bnVsbClcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19sb2FkX3RlbXBsYXRlX2Zvcm1fY29uZmlnKHRlbXBsYXRlX2Zvcm1fc2x1ZywgZG9uZV9jYikge1xyXG5cclxuXHR0cnkge1xyXG5cdFx0dmFyIGNmZyA9IHdpbmRvdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdFx0dmFyICQgICA9IHdpbmRvdy5qUXVlcnkgfHwgbnVsbDtcclxuXHJcblx0XHR0ZW1wbGF0ZV9mb3JtX3NsdWcgPSBTdHJpbmcoIHRlbXBsYXRlX2Zvcm1fc2x1ZyB8fCAnJyApLnRyaW0oKTtcclxuXHJcblx0XHRpZiAoICEgdGVtcGxhdGVfZm9ybV9zbHVnICkge1xyXG5cdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdGRvbmVfY2IoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBjZmcudXJsIHx8ICEgY2ZnLm5vbmNlX2xvYWQgKSB7XHJcblx0XHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogYWpheCBsb2FkIGNvbmZpZyBpcyBtaXNzaW5nLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgJCB8fCAhICQuYWpheCApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1dQQkMgQkZCOiBqUXVlcnkgaXMgbm90IGF2YWlsYWJsZS4nLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0JC5hamF4KCB7XHJcblx0XHRcdHVybCAgICAgIDogY2ZnLnVybCxcclxuXHRcdFx0dHlwZSAgICAgOiAnUE9TVCcsXHJcblx0XHRcdGRhdGFUeXBlIDogJ3RleHQnLFxyXG5cdFx0XHRkYXRhICAgICA6IHtcclxuXHRcdFx0XHRhY3Rpb24gICA6ICdXUEJDX0FKWF9CRkJfTE9BRF9GT1JNX0NPTkZJRycsXHJcblx0XHRcdFx0bm9uY2UgICAgOiBjZmcubm9uY2VfbG9hZCxcclxuXHRcdFx0XHRmb3JtX25hbWU6IHRlbXBsYXRlX2Zvcm1fc2x1ZyxcclxuXHRcdFx0XHRzdGF0dXMgICA6ICd0ZW1wbGF0ZSdcclxuXHRcdFx0fVxyXG5cdFx0fSApXHJcblx0XHRcdC5kb25lKCBmdW5jdGlvbiAocmVzcG9uc2VfdGV4dCwgX3RleHRfc3RhdHVzLCBqcXhocikge1xyXG5cclxuXHRcdFx0XHRpZiAoICEganF4aHIgfHwganF4aHIuc3RhdHVzICE9PSAyMDAgKSB7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lX2NiID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIHJlc3AgPSBudWxsO1xyXG5cdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRyZXNwID0gSlNPTi5wYXJzZSggcmVzcG9uc2VfdGV4dCApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZTEgKSB7XHJcblx0XHRcdFx0XHRyZXNwID0gbnVsbDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggISByZXNwIHx8ICEgcmVzcC5zdWNjZXNzIHx8ICEgcmVzcC5kYXRhICkge1xyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0ZG9uZV9jYiggZmFsc2UsIHJlc3AgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCB0cnVlLCByZXNwLmRhdGEgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQuZmFpbCggZnVuY3Rpb24gKGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93bikge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmVfY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lX2NiKCBmYWxzZSwgKCAoanFYSFIucmVzcG9uc2VUZXh0KSA/IGpxWEhSLnJlc3BvbnNlVGV4dCA6IG51bGwgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cclxuXHR9IGNhdGNoICggX2UyICkge1xyXG5cdFx0aWYgKCB0eXBlb2YgZG9uZV9jYiA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0ZG9uZV9jYiggZmFsc2UsIG51bGwgKTtcclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBcHBseSB0ZW1wbGF0ZSBkYXRhIHRvIGN1cnJlbnQgZm9ybSBlZGl0b3IuXHJcbiAqXHJcbiAqIEV4cGVjdGVkIGRhdGE6XHJcbiAqIC0gc3RydWN0dXJlIChhcnJheSlcclxuICogLSBzZXR0aW5ncyAoYXJyYXl8b2JqZWN0KVxyXG4gKiAtIGFkdmFuY2VkX2Zvcm0gKHN0cmluZylcclxuICogLSBjb250ZW50X2Zvcm0gKHN0cmluZylcclxuICpcclxuICogQHBhcmFtIHtPYmplY3R9IGRhdGFcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19hcHBseV90ZW1wbGF0ZV90b19jdXJyZW50X2Zvcm0oZGF0YSkge1xyXG5cclxuXHR2YXIgYnVpbGRlciA9IHdpbmRvdy53cGJjX2JmYiB8fCBudWxsO1xyXG5cclxuXHR2YXIgc3RydWN0dXJlID0gKCBkYXRhICYmIGRhdGEuc3RydWN0dXJlICkgPyBkYXRhLnN0cnVjdHVyZSA6IFtdO1xyXG5cdHZhciBzZXR0aW5ncyAgPSAoIGRhdGEgJiYgZGF0YS5zZXR0aW5ncyApID8gZGF0YS5zZXR0aW5ncyA6IG51bGw7XHJcblxyXG5cdC8vIDEpIEFwcGx5IHN0cnVjdHVyZSBpbnRvIEJ1aWxkZXIuXHJcblx0aWYgKCBidWlsZGVyICYmIHR5cGVvZiBidWlsZGVyLmxvYWRfc2F2ZWRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0YnVpbGRlci5sb2FkX3NhdmVkX3N0cnVjdHVyZSggc3RydWN0dXJlIHx8IFtdICk7XHJcblx0fSBlbHNlIGlmICggYnVpbGRlciAmJiB0eXBlb2YgYnVpbGRlci5sb2FkX3N0cnVjdHVyZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdGJ1aWxkZXIubG9hZF9zdHJ1Y3R1cmUoIHN0cnVjdHVyZSB8fCBbXSApO1xyXG5cdH0gZWxzZSBpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHR3aW5kb3cud3BiY19iZmJfX29uX3N0cnVjdHVyZV9sb2FkZWQoIHN0cnVjdHVyZSB8fCBbXSApO1xyXG5cdH1cclxuXHJcblx0Ly8gMikgQXBwbHkgc2V0dGluZ3MgaW50byBTZXR0aW5ncyBPcHRpb25zIFVJIChhbmQgb3RoZXIgbGlzdGVuZXJzKS5cclxuXHRpZiAoIHNldHRpbmdzICkge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Ly8gU29tZSBjYWxsLXNpdGVzIG1heSByZXR1cm4gSlNPTiBzdHJpbmcsIGJlIGRlZmVuc2l2ZS5cclxuXHRcdFx0aWYgKCB0eXBlb2Ygc2V0dGluZ3MgPT09ICdzdHJpbmcnICkge1xyXG5cdFx0XHRcdHNldHRpbmdzID0gSlNPTi5wYXJzZSggc2V0dGluZ3MgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIF9lMCApIHt9XHJcblxyXG5cdFx0aWYgKCBzZXR0aW5ncyApIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHdpbmRvdy53cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6YXBwbHknLCB7XHJcblx0XHRcdFx0XHRzZXR0aW5ncyA6IHNldHRpbmdzLFxyXG5cdFx0XHRcdFx0Zm9ybV9uYW1lOiAoIHdpbmRvdy5XUEJDX0JGQl9BamF4ICYmIHdpbmRvdy5XUEJDX0JGQl9BamF4LmZvcm1fbmFtZSApID8gd2luZG93LldQQkNfQkZCX0FqYXguZm9ybV9uYW1lIDogJ3N0YW5kYXJkJ1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiYzpiZmI6Zm9ybV9zZXR0aW5nczphcHBseScsIHsgZGV0YWlsOiB7IHNldHRpbmdzOiBzZXR0aW5ncyB9IH0gKSApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZTEgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyAzKSBBcHBseSBBZHZhbmNlZC9Db250ZW50IHRleHRzICh1cGRhdGVzIHRleHRhcmVhICsgbm90aWZpZXMgQWR2YW5jZWQgTW9kZSBtb2R1bGUpLlxyXG5cdHdwYmNfYmZiX19hcHBseV9hZHZhbmNlZF9tb2RlX3RleHRzKFxyXG5cdFx0KCBkYXRhICYmIHR5cGVvZiBkYXRhLmFkdmFuY2VkX2Zvcm0gIT09ICd1bmRlZmluZWQnICkgPyBkYXRhLmFkdmFuY2VkX2Zvcm0gOiAnJyxcclxuXHRcdCggZGF0YSAmJiB0eXBlb2YgZGF0YS5jb250ZW50X2Zvcm0gIT09ICd1bmRlZmluZWQnICkgPyBkYXRhLmNvbnRlbnRfZm9ybSA6ICcnLFxyXG5cdFx0KCBzZXR0aW5ncyAmJiBzZXR0aW5ncy5iZmJfb3B0aW9ucyAmJiBzZXR0aW5ncy5iZmJfb3B0aW9ucy5hZHZhbmNlZF9tb2RlX3NvdXJjZSApID8gc2V0dGluZ3MuYmZiX29wdGlvbnMuYWR2YW5jZWRfbW9kZV9zb3VyY2UgOiAnYnVpbGRlcidcclxuXHQpO1xyXG5cclxuXHQvLyA0KSBOb3RpZnk6IHRlbXBsYXRlIGFwcGxpZWQgKG9wdGlvbmFsIGhvb2tzKS5cclxuXHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHR3aW5kb3cud3BiY19iZmJfX2Rpc3BhdGNoX2V2ZW50X3NhZmUoICd3cGJjOmJmYjpmb3JtOnRlbXBsYXRlX2FwcGxpZWQnLCB7XHJcblx0XHRcdHRlbXBsYXRlX2Zvcm1fc2x1ZzogKCBkYXRhICYmIGRhdGEuZm9ybV9uYW1lICkgPyBkYXRhLmZvcm1fbmFtZSA6ICcnLFxyXG5cdFx0XHRmb3JtX25hbWUgICAgICAgICA6ICggd2luZG93LldQQkNfQkZCX0FqYXggJiYgd2luZG93LldQQkNfQkZCX0FqYXguZm9ybV9uYW1lICkgPyB3aW5kb3cuV1BCQ19CRkJfQWpheC5mb3JtX25hbWUgOiAnc3RhbmRhcmQnXHJcblx0XHR9ICk7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQXBwbHkgYWR2YW5jZWQvY29udGVudCB0ZXh0cyBpbnRvIGVkaXRvciBVSSBzYWZlbHkuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBhZHZhbmNlZF9mb3JtXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBjb250ZW50X2Zvcm1cclxuICogQHBhcmFtIHtzdHJpbmd9IGFkdmFuY2VkX21vZGVfc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JmYl9fYXBwbHlfYWR2YW5jZWRfbW9kZV90ZXh0cyhhZHZhbmNlZF9mb3JtLCBjb250ZW50X2Zvcm0sIGFkdmFuY2VkX21vZGVfc291cmNlKSB7XHJcblxyXG5cdHZhciBhZiA9ICggYWR2YW5jZWRfZm9ybSA9PSBudWxsICkgPyAnJyA6IFN0cmluZyggYWR2YW5jZWRfZm9ybSApO1xyXG5cdHZhciBjZiA9ICggY29udGVudF9mb3JtID09IG51bGwgKSA/ICcnIDogU3RyaW5nKCBjb250ZW50X2Zvcm0gKTtcclxuXHJcblx0dmFyIHRhX2Zvcm0gICAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19hZHZhbmNlZF9mb3JtX2VkaXRvcicgKTtcclxuXHR2YXIgdGFfY29udGVudCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2NvbnRlbnRfZm9ybV9lZGl0b3InICk7XHJcblxyXG5cdGlmICggdGFfZm9ybSApIHtcclxuXHRcdHRhX2Zvcm0udmFsdWUgPSBhZjtcclxuXHR9XHJcblx0aWYgKCB0YV9jb250ZW50ICkge1xyXG5cdFx0dGFfY29udGVudC52YWx1ZSA9IGNmO1xyXG5cdH1cclxuXHJcblx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0d2luZG93LndwYmNfYmZiX19kaXNwYXRjaF9ldmVudF9zYWZlKCAnd3BiYzpiZmI6YWR2YW5jZWRfdGV4dDphcHBseScsIHtcclxuXHRcdFx0YWR2YW5jZWRfZm9ybSAgICAgICA6IGFmLFxyXG5cdFx0XHRjb250ZW50X2Zvcm0gICAgICAgIDogY2YsXHJcblx0XHRcdGFkdmFuY2VkX21vZGVfc291cmNlOiBhZHZhbmNlZF9tb2RlX3NvdXJjZVxyXG5cdFx0fSApO1xyXG5cdH1cclxufSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0MsV0FBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixNQUFNQyxJQUFJLEdBQUlGLENBQUMsQ0FBQ0csYUFBYSxHQUFHSCxDQUFDLENBQUNHLGFBQWEsSUFBSSxDQUFDLENBQUU7RUFDdEQsTUFBTUMsRUFBRSxHQUFN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

"use strict";

/**
 * Booking Calendar — Add New Form modal helper (BFB Admin)
 *
 * UI.Modal_Add_New_Form.open(on_confirm, on_open)
 *
 * on_confirm(payload):
 *  payload = {
 *    template_form_slug : string, // '' or '__blank__' -> blank form
 *    form_title         : string,
 *    form_slug          : string,
 *    form_image_url     : string,
 *    form_description   : string
 *  }
 *
 * Depends on:
 * - UI.Templates.ensure_dom_ref_from_wp_template
 * - UI.Modals.show/hide
 * - wpbc_bfb__ajax_list_user_forms()
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_add_new.js
 */

(function (w, d) {
  'use strict';

  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  const UI = Core.UI = Core.UI || {};
  UI.Modal_Add_New_Form = UI.Modal_Add_New_Form || {};

  // Idempotency guard.
  if (UI.Modal_Add_New_Form.__bound) {
    return;
  }
  UI.Modal_Add_New_Form.__bound = true;
  const MODAL_DOM_ID = 'wpbc_bfb_modal__add_new_form';
  const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-add_new_form';
  const ID_TITLE = 'wpbc_bfb_popup_modal__add_new_form__title';
  const ID_SLUG = 'wpbc_bfb_popup_modal__add_new_form__slug';
  const ID_IMAGE_URL = 'wpbc_bfb_popup_modal__add_new_form__image_url';
  const ID_DESCRIPTION = 'wpbc_bfb_popup_modal__add_new_form__description';
  const ID_TPL_SEARCH = 'wpbc_bfb_popup_modal__add_new_form__tpl_search';
  const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
  const SEL_CANCEL = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
  const SEL_ERROR = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';
  const SEL_CLEAR_IMAGE = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-clear-image="1"]';
  const BLANK_TEMPLATE_SLUG = '__blank__';
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
      el.textContent = String(msg);
      el.style.display = '';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }
  function wpbc_bfb__set_confirm_enabled(is_enabled) {
    const btn = d.querySelector(SEL_CONFIRM);
    if (!btn) {
      return;
    }
    if (is_enabled) {
      btn.classList.remove('disabled');
      btn.setAttribute('aria-disabled', 'false');
    } else {
      btn.classList.add('disabled');
      btn.setAttribute('aria-disabled', 'true');
    }
  }

  /**
   * Create a "slug/key" from title (underscore style).
   *
   * @param {string} value
   * @return {string}
   */
  function wpbc_bfb__slugify_to_key(value) {
    let v = String(value || '').trim().toLowerCase();

    // Remove accents when possible.
    try {
      if (v && v.normalize) {
        v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      }
    } catch (_e) {}

    // Replace quotes, then keep only a-z0-9 _ - space.
    v = v.replace(/['"]/g, '');
    v = v.replace(/[^a-z0-9_\-\s]+/g, '');

    // Convert spaces/dashes to underscores.
    v = v.replace(/[\s\-]+/g, '_');

    // Collapse underscores, trim.
    v = v.replace(/_+/g, '_'); // .replace( /^_+|_+$/g, '' );

    // Safety: must start with a letter if possible.
    if (v && /^[0-9]/.test(v)) {
      v = 'form_' + v;
    }
    return v;
  }

  /**
   * Sanitize user-entered slug/key.
   *
   * @param {string} value
   * @return {string}
   */
  function wpbc_bfb__sanitize_key(value) {
    let v = String(value || '').trim().toLowerCase();
    v = v.replace(/[^a-z0-9_]+/g, '_');
    v = v.replace(/_+/g, '_'); // .replace( /^_+|_+$/g, '' );
    if (v && /^[0-9]/.test(v)) {
      v = 'form_' + v;
    }
    return v;
  }
  function wpbc_bfb__render_thumb(modal_el, url) {
    if (!modal_el || !modal_el.querySelector) {
      return;
    }
    const thumb = modal_el.querySelector('[data-wpbc-bfb-thumb="1"]');
    if (!thumb) {
      return;
    }
    const safe_url = String(url || '').trim();
    if (safe_url) {
      thumb.innerHTML = '<img src="' + safe_url.replace(/"/g, '&quot;') + '" style="width:100%;height:100%;object-fit:cover;" alt="" />';
    } else {
      thumb.innerHTML = '';
      const span = d.createElement('span');
      span.className = 'description';
      span.style.padding = '6px';
      span.style.textAlign = 'center';
      span.textContent = wpbc_bfb__i18n('text_no_image', 'No Image');
      thumb.appendChild(span);
    }
  }
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
      return null;
    }
    if (!modal_el.__wpbc_bfb_template_picker) {
      modal_el.__wpbc_bfb_template_picker = UI.Template_Picker.create({
        modal_el: modal_el,
        search_input_id: ID_TPL_SEARCH,
        blank_template_slug: BLANK_TEMPLATE_SLUG,
        allow_delete: true,
        allow_presets: true,
        allow_same_click_blank: true,
        blank_desc: wpbc_bfb__i18n('text_add_new_blank_desc', 'Start with an empty layout.'),
        empty_text: wpbc_bfb__i18n('text_add_new_empty_templates', 'No templates found. You can still create a blank form.'),
        list_helper_missing_text: wpbc_bfb__i18n('text_add_new_list_helper_missing', 'WPBC BFB: list forms helper missing.'),
        load_failed_text: wpbc_bfb__i18n('text_add_new_load_failed', 'Failed to load templates list. You can still create a blank form.'),
        on_set_error: wpbc_bfb__set_error,
        on_selection_change: function () {
          if (typeof modal_el.__wpbc_bfb_add_new_update_confirm_state === 'function') {
            modal_el.__wpbc_bfb_add_new_update_confirm_state();
          }
        }
      });
    }
    return modal_el.__wpbc_bfb_template_picker;
  }
  function wpbc_bfb__collect_payload(modal_el) {
    const title_el = wpbc_bfb__get_el(ID_TITLE);
    const slug_el = wpbc_bfb__get_el(ID_SLUG);
    const img_el = wpbc_bfb__get_el(ID_IMAGE_URL);
    const desc_el = wpbc_bfb__get_el(ID_DESCRIPTION);
    const title_raw = title_el ? String(title_el.value || '').trim() : '';
    let slug_raw = slug_el ? String(slug_el.value || '').trim() : '';
    slug_raw = wpbc_bfb__sanitize_key(slug_raw);
    const payload = {
      template_form_slug: wpbc_bfb__get_selected_template_slug(modal_el),
      form_title: title_raw,
      form_slug: slug_raw,
      form_image_url: img_el ? String(img_el.value || '').trim() : '',
      form_description: desc_el ? String(desc_el.value || '').trim() : ''
    };
    return payload;
  }

  /**
   * Template is optional. Only title + slug are required.
   *
   * @param {Object} payload
   * @return {string} error message or ''
   */
  function wpbc_bfb__validate_payload(payload) {
    if (!wpbc_bfb__has_text(payload.form_title)) {
      return wpbc_bfb__i18n('text_add_new_validation_title', 'Please enter a form title.');
    }
    if (!wpbc_bfb__has_text(payload.form_slug)) {
      return wpbc_bfb__i18n('text_add_new_validation_slug', 'Please enter a valid form key (slug).');
    }
    return '';
  }

  // ------------------------------------------------------------------------------------
  // Modal state/bind
  // ------------------------------------------------------------------------------------

  function wpbc_bfb__reset_modal_state(modal_el) {
    const title_el = wpbc_bfb__get_el(ID_TITLE);
    const slug_el = wpbc_bfb__get_el(ID_SLUG);
    const img_el = wpbc_bfb__get_el(ID_IMAGE_URL);
    const desc_el = wpbc_bfb__get_el(ID_DESCRIPTION);
    if (title_el) title_el.value = '';
    if (slug_el) slug_el.value = '';
    if (img_el) img_el.value = '';
    if (desc_el) desc_el.value = '';

    // Auto-slug mode by default.
    if (modal_el) {
      modal_el.__wpbc_bfb_manual_slug = false;
    }
    const picker = wpbc_bfb__get_template_picker(modal_el);
    if (picker) {
      picker.reset_state();
    } else if (modal_el) {
      modal_el.__wpbc_bfb_selected_template_slug = BLANK_TEMPLATE_SLUG;
      modal_el.__wpbc_bfb_templates_cache = [];
      modal_el.__wpbc_bfb_tpl_page = 1;
      modal_el.__wpbc_bfb_tpl_has_more = false;
      modal_el.__wpbc_bfb_tpl_search = '';
      modal_el.__wpbc_bfb_tpl_search_timer = 0;
    }
    wpbc_bfb__render_thumb(modal_el, '');
    wpbc_bfb__set_error('');
    wpbc_bfb__set_confirm_enabled(false);
  }
  function wpbc_bfb__bind_modal_handlers(modal_el) {
    if (!modal_el || modal_el.__wpbc_bfb_handlers_bound) {
      return;
    }
    modal_el.__wpbc_bfb_handlers_bound = true;
    const title_el = wpbc_bfb__get_el(ID_TITLE);
    const slug_el = wpbc_bfb__get_el(ID_SLUG);
    const img_el = wpbc_bfb__get_el(ID_IMAGE_URL);
    function wpbc_bfb__update_confirm_state() {
      const payload = wpbc_bfb__collect_payload(modal_el);
      const err = wpbc_bfb__validate_payload(payload);
      wpbc_bfb__set_error('');
      wpbc_bfb__set_confirm_enabled(!err);
    }
    modal_el.__wpbc_bfb_add_new_update_confirm_state = wpbc_bfb__update_confirm_state;

    // Title -> auto slug (if not manual).
    if (title_el) {
      title_el.addEventListener('input', function () {
        const is_manual = !!modal_el.__wpbc_bfb_manual_slug;
        if (!is_manual && slug_el) {
          const auto_slug = wpbc_bfb__slugify_to_key(title_el.value || '');
          slug_el.value = auto_slug;
        }
        wpbc_bfb__update_confirm_state();
      }, true);
    }

    // Slug manual.
    if (slug_el) {
      slug_el.addEventListener('input', function () {
        modal_el.__wpbc_bfb_manual_slug = true;
        const sanitized = wpbc_bfb__sanitize_key(slug_el.value || '');
        if (sanitized !== slug_el.value) {
          slug_el.value = sanitized;
        }
        wpbc_bfb__update_confirm_state();
      }, true);
    }

    // Image url -> thumbnail.
    if (img_el) {
      const update_thumb = function () {
        wpbc_bfb__render_thumb(modal_el, img_el.value || '');
      };

      // wpbc_media_upload_button triggers via jQuery(.trigger) -> listen via jQuery(.on)
      if (w.jQuery) {
        w.jQuery(img_el).off('wpbc_media_upload_url_set.wpbcBfbAddNewForm').on('wpbc_media_upload_url_set.wpbcBfbAddNewForm', update_thumb);
      }

      // Native fallback.
      img_el.addEventListener('wpbc_media_upload_url_set', update_thumb, true);
      img_el.addEventListener('input', update_thumb, true);
      img_el.addEventListener('change', update_thumb, true);
    }

    // Clear image.
    modal_el.addEventListener('click', function (e) {
      if (!e || !e.target || !e.target.closest) {
        return;
      }
      const clear_btn = e.target.closest(SEL_CLEAR_IMAGE);
      if (!clear_btn) {
        return;
      }
      e.preventDefault();
      const img = wpbc_bfb__get_el(ID_IMAGE_URL);
      if (img) {
        img.value = '';
        try {
          const ev = new Event('wpbc_media_upload_url_set');
          img.dispatchEvent(ev);
        } catch (_e) {
          wpbc_bfb__render_thumb(modal_el, '');
        }
      }
    }, true);

    // Any input that can affect validation -> update confirm state.
    modal_el.addEventListener('input', function (e) {
      if (!e || !e.target) {
        return;
      }
      if (e.target.id === ID_DESCRIPTION) {
        wpbc_bfb__update_confirm_state();
      }
    }, true);
    const picker = wpbc_bfb__get_template_picker(modal_el);
    if (picker) {
      picker.bind_handlers();
    }
  }
  UI.Modal_Add_New_Form.open = function (on_confirm, on_open) {
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

    // Store callback on modal instance (single modal, single active confirm).
    modal_el.__wpbc_bfb_add_new_form_cb = typeof on_confirm === 'function' ? on_confirm : null;
    wpbc_bfb__bind_modal_handlers(modal_el);
    wpbc_bfb__reset_modal_state(modal_el);
    UI.Modals.show(modal_el);
    const picker = wpbc_bfb__get_template_picker(modal_el);
    if (picker) {
      picker.set_pager(1, false);
      picker.apply_search_value('', function () {
        const payload = wpbc_bfb__collect_payload(modal_el);
        const err = wpbc_bfb__validate_payload(payload);
        wpbc_bfb__set_confirm_enabled(!err);
      });
    } else {
      wpbc_bfb__set_error('WPBC BFB: Template Picker helper is not available. You can still create a blank form.');
    }

    // Focus title input.
    w.setTimeout(function () {
      const title_el = wpbc_bfb__get_el(ID_TITLE);
      if (title_el && title_el.focus) {
        try {
          title_el.focus();
        } catch (_e) {}
        try {
          title_el.select();
        } catch (_e2) {}
      }
    }, 0);
    if (on_open) {
      try {
        on_open(modal_el);
      } catch (_e3) {}
    }

    // Bind WP Media uploader buttons inside modal.
    if (w.jQuery) {
      w.jQuery(modal_el).off('click.wpbcMedia', '.wpbc_media_upload_button').on('click.wpbcMedia', '.wpbc_media_upload_button', function (event) {
        // Use safe typeof check (avoids ReferenceError).
        if (typeof w.wpbc_media_upload_button_clicked === 'function') {
          w.wpbc_media_upload_button_clicked(this, event);
        } else if (typeof wpbc_media_upload_button_clicked === 'function') {
          wpbc_media_upload_button_clicked(this, event);
        } else {
          alert(wpbc_bfb__i18n('text_add_new_media_demo_restricted', 'Warning! This feature is restricted in the public live demo.'));
        }
      });
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

      // Prevent confirm if disabled.
      if (is_confirm.classList.contains('disabled') || is_confirm.getAttribute('aria-disabled') === 'true') {
        const payload0 = wpbc_bfb__collect_payload(modal_el);
        const err0 = wpbc_bfb__validate_payload(payload0);
        if (err0) {
          wpbc_bfb__set_error(err0);
        }
        return;
      }
      const payload = wpbc_bfb__collect_payload(modal_el);
      const err = wpbc_bfb__validate_payload(payload);
      if (err) {
        wpbc_bfb__set_error(err);
        wpbc_bfb__set_confirm_enabled(false);
        return;
      }
      wpbc_bfb__set_error('');
      const cb = modal_el.__wpbc_bfb_add_new_form_cb || null;
      modal_el.__wpbc_bfb_add_new_form_cb = null;
      UI.Modals.hide(modal_el);
      if (cb) {
        try {
          cb(payload);
        } catch (_e4) {}
      }
      return;
    }
    const is_cancel = e.target.closest(SEL_CANCEL);
    if (is_cancel) {
      e.preventDefault();
      modal_el.__wpbc_bfb_add_new_form_cb = null;
      UI.Modals.hide(modal_el);
    }
  }, true);
})(window, document);
function wpbc_bfb__menu_forms__new(menu_option_this) {
  WPBC_BFB_Core.UI.Modal_Add_New_Form.open(function (payload) {
    var template_form_key = '';

    // Blank when:
    // - '__blank__' selected
    // - empty value (defensive)
    if (payload && payload.template_form_slug && payload.template_form_slug !== '__blank__') {
      template_form_key = String(payload.template_form_slug);
    } else {
      template_form_key = '';
    }
    var $btn = window.jQuery && menu_option_this ? window.jQuery(menu_option_this) : null;
    var original_busy_text = '';
    if ($btn && $btn.length) {
      original_busy_text = $btn.data('wpbc-u-busy-text') || '';
      $btn.data('wpbc-u-busy-text', wpbc_bfb__i18n('text_add_new_creating', 'Creating...'));
    }

    // 1) Create form in DB (clone template).
    if (typeof window.wpbc_bfb__ajax_create_form !== 'function') {
      wpbc_admin_show_message('WPBC BFB: create helper missing.', 'error', 10000);
      return;
    }
    window.wpbc_bfb__ajax_create_form(menu_option_this, payload, template_form_key, function (is_created, resp) {
      if ($btn && $btn.length) {
        $btn.data('wpbc-u-busy-text', original_busy_text);
      }
      if (!is_created) {
        return;
      }

      // 2) Load the created form into Builder UI.
      if (typeof window.wpbc_bfb__ajax_load_current_form === 'function') {
        window.wpbc_bfb__ajax_load_current_form(menu_option_this);
      }
      if (typeof window.wpbc_admin_show_message === 'function') {
        window.wpbc_admin_show_message(wpbc_bfb__i18n('text_add_new_form_created', 'Form created'), 'success', 2000, false);
      }
    });
  });
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9hZGRfbmV3LmpzIiwibmFtZXMiOlsidyIsImQiLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlVJIiwiTW9kYWxfQWRkX05ld19Gb3JtIiwiX19ib3VuZCIsIk1PREFMX0RPTV9JRCIsIlRQTF9NT0RBTF9JRCIsIklEX1RJVExFIiwiSURfU0xVRyIsIklEX0lNQUdFX1VSTCIsIklEX0RFU0NSSVBUSU9OIiwiSURfVFBMX1NFQVJDSCIsIlNFTF9DT05GSVJNIiwiU0VMX0NBTkNFTCIsIlNFTF9FUlJPUiIsIlNFTF9DTEVBUl9JTUFHRSIsIkJMQU5LX1RFTVBMQVRFX1NMVUciLCJ3cGJjX2JmYl9faGFzX3RleHQiLCJ2YWx1ZSIsIlN0cmluZyIsInRyaW0iLCJ3cGJjX2JmYl9fZ2V0X2VsIiwiaWQiLCJnZXRFbGVtZW50QnlJZCIsIndwYmNfYmZiX19nZXRfbW9kYWxfZWwiLCJ3cGJjX2JmYl9fc2V0X2Vycm9yIiwibXNnIiwiZWwiLCJxdWVyeVNlbGVjdG9yIiwidGV4dENvbnRlbnQiLCJzdHlsZSIsImRpc3BsYXkiLCJ3cGJjX2JmYl9fc2V0X2NvbmZpcm1fZW5hYmxlZCIsImlzX2VuYWJsZWQiLCJidG4iLCJjbGFzc0xpc3QiLCJyZW1vdmUiLCJzZXRBdHRyaWJ1dGUiLCJhZGQiLCJ3cGJjX2JmYl9fc2x1Z2lmeV90b19rZXkiLCJ2IiwidG9Mb3dlckNhc2UiLCJub3JtYWxpemUiLCJyZXBsYWNlIiwiX2UiLCJ0ZXN0Iiwid3BiY19iZmJfX3Nhbml0aXplX2tleSIsIndwYmNfYmZiX19yZW5kZXJfdGh1bWIiLCJtb2RhbF9lbCIsInVybCIsInRodW1iIiwic2FmZV91cmwiLCJpbm5lckhUTUwiLCJzcGFuIiwiY3JlYXRlRWxlbWVudCIsImNsYXNzTmFtZSIsInBhZGRpbmciLCJ0ZXh0QWxpZ24iLCJ3cGJjX2JmYl9faTE4biIsImFwcGVuZENoaWxkIiwid3BiY19iZmJfX2dldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnIiwicGlja2VyIiwiX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXIiLCJnZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyIsIl9fd3BiY19iZmJfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyIsIndwYmNfYmZiX19nZXRfdGVtcGxhdGVfcGlja2VyIiwiVGVtcGxhdGVfUGlja2VyIiwiY3JlYXRlIiwic2VhcmNoX2lucHV0X2lkIiwiYmxhbmtfdGVtcGxhdGVfc2x1ZyIsImFsbG93X2RlbGV0ZSIsImFsbG93X3ByZXNldHMiLCJhbGxvd19zYW1lX2NsaWNrX2JsYW5rIiwiYmxhbmtfZGVzYyIsImVtcHR5X3RleHQiLCJsaXN0X2hlbHBlcl9taXNzaW5nX3RleHQiLCJsb2FkX2ZhaWxlZF90ZXh0Iiwib25fc2V0X2Vycm9yIiwib25fc2VsZWN0aW9uX2NoYW5nZSIsIl9fd3BiY19iZmJfYWRkX25ld191cGRhdGVfY29uZmlybV9zdGF0ZSIsIndwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQiLCJ0aXRsZV9lbCIsInNsdWdfZWwiLCJpbWdfZWwiLCJkZXNjX2VsIiwidGl0bGVfcmF3Iiwic2x1Z19yYXciLCJwYXlsb2FkIiwidGVtcGxhdGVfZm9ybV9zbHVnIiwiZm9ybV90aXRsZSIsImZvcm1fc2x1ZyIsImZvcm1faW1hZ2VfdXJsIiwiZm9ybV9kZXNjcmlwdGlvbiIsIndwYmNfYmZiX192YWxpZGF0ZV9wYXlsb2FkIiwid3BiY19iZmJfX3Jlc2V0X21vZGFsX3N0YXRlIiwiX193cGJjX2JmYl9tYW51YWxfc2x1ZyIsInJlc2V0X3N0YXRlIiwiX193cGJjX2JmYl90ZW1wbGF0ZXNfY2FjaGUiLCJfX3dwYmNfYmZiX3RwbF9wYWdlIiwiX193cGJjX2JmYl90cGxfaGFzX21vcmUiLCJfX3dwYmNfYmZiX3RwbF9zZWFyY2giLCJfX3dwYmNfYmZiX3RwbF9zZWFyY2hfdGltZXIiLCJ3cGJjX2JmYl9fYmluZF9tb2RhbF9oYW5kbGVycyIsIl9fd3BiY19iZmJfaGFuZGxlcnNfYm91bmQiLCJ3cGJjX2JmYl9fdXBkYXRlX2NvbmZpcm1fc3RhdGUiLCJlcnIiLCJhZGRFdmVudExpc3RlbmVyIiwiaXNfbWFudWFsIiwiYXV0b19zbHVnIiwic2FuaXRpemVkIiwidXBkYXRlX3RodW1iIiwialF1ZXJ5Iiwib2ZmIiwib24iLCJlIiwidGFyZ2V0IiwiY2xvc2VzdCIsImNsZWFyX2J0biIsInByZXZlbnREZWZhdWx0IiwiaW1nIiwiZXYiLCJFdmVudCIsImRpc3BhdGNoRXZlbnQiLCJiaW5kX2hhbmRsZXJzIiwib3BlbiIsIm9uX2NvbmZpcm0iLCJvbl9vcGVuIiwicmVmIiwiVGVtcGxhdGVzIiwiZW5zdXJlX2RvbV9yZWZfZnJvbV93cF90ZW1wbGF0ZSIsImluc2lkZSIsIl9fd3BiY19iZmJfYWRkX25ld19mb3JtX2NiIiwiTW9kYWxzIiwic2hvdyIsInNldF9wYWdlciIsImFwcGx5X3NlYXJjaF92YWx1ZSIsInNldFRpbWVvdXQiLCJmb2N1cyIsInNlbGVjdCIsIl9lMiIsIl9lMyIsImV2ZW50Iiwid3BiY19tZWRpYV91cGxvYWRfYnV0dG9uX2NsaWNrZWQiLCJhbGVydCIsImlzX2NvbmZpcm0iLCJjb250YWlucyIsImdldEF0dHJpYnV0ZSIsInBheWxvYWQwIiwiZXJyMCIsImNiIiwiaGlkZSIsIl9lNCIsImlzX2NhbmNlbCIsIndpbmRvdyIsImRvY3VtZW50Iiwid3BiY19iZmJfX21lbnVfZm9ybXNfX25ldyIsIm1lbnVfb3B0aW9uX3RoaXMiLCJ0ZW1wbGF0ZV9mb3JtX2tleSIsIiRidG4iLCJvcmlnaW5hbF9idXN5X3RleHQiLCJsZW5ndGgiLCJkYXRhIiwid3BiY19iZmJfX2FqYXhfY3JlYXRlX2Zvcm0iLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsImlzX2NyZWF0ZWQiLCJyZXNwIiwid3BiY19iZmJfX2FqYXhfbG9hZF9jdXJyZW50X2Zvcm0iXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9hZG1pbi1wYWdlLXRwbC9fc3JjL21vZGFsX19mb3JtX2FkZF9uZXcuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEJvb2tpbmcgQ2FsZW5kYXIg4oCUIEFkZCBOZXcgRm9ybSBtb2RhbCBoZWxwZXIgKEJGQiBBZG1pbilcclxuICpcclxuICogVUkuTW9kYWxfQWRkX05ld19Gb3JtLm9wZW4ob25fY29uZmlybSwgb25fb3BlbilcclxuICpcclxuICogb25fY29uZmlybShwYXlsb2FkKTpcclxuICogIHBheWxvYWQgPSB7XHJcbiAqICAgIHRlbXBsYXRlX2Zvcm1fc2x1ZyA6IHN0cmluZywgLy8gJycgb3IgJ19fYmxhbmtfXycgLT4gYmxhbmsgZm9ybVxyXG4gKiAgICBmb3JtX3RpdGxlICAgICAgICAgOiBzdHJpbmcsXHJcbiAqICAgIGZvcm1fc2x1ZyAgICAgICAgICA6IHN0cmluZyxcclxuICogICAgZm9ybV9pbWFnZV91cmwgICAgIDogc3RyaW5nLFxyXG4gKiAgICBmb3JtX2Rlc2NyaXB0aW9uICAgOiBzdHJpbmdcclxuICogIH1cclxuICpcclxuICogRGVwZW5kcyBvbjpcclxuICogLSBVSS5UZW1wbGF0ZXMuZW5zdXJlX2RvbV9yZWZfZnJvbV93cF90ZW1wbGF0ZVxyXG4gKiAtIFVJLk1vZGFscy5zaG93L2hpZGVcclxuICogLSB3cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMoKVxyXG4gKlxyXG4gKiBAZmlsZTogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9hZGRfbmV3LmpzXHJcbiAqL1xyXG5cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRjb25zdCBDb3JlID0gKHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSk7XHJcblx0Y29uc3QgVUkgICA9IChDb3JlLlVJID0gQ29yZS5VSSB8fCB7fSk7XHJcblxyXG5cdFVJLk1vZGFsX0FkZF9OZXdfRm9ybSA9IFVJLk1vZGFsX0FkZF9OZXdfRm9ybSB8fCB7fTtcclxuXHJcblx0Ly8gSWRlbXBvdGVuY3kgZ3VhcmQuXHJcblx0aWYgKCBVSS5Nb2RhbF9BZGRfTmV3X0Zvcm0uX19ib3VuZCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0VUkuTW9kYWxfQWRkX05ld19Gb3JtLl9fYm91bmQgPSB0cnVlO1xyXG5cclxuXHRjb25zdCBNT0RBTF9ET01fSUQgPSAnd3BiY19iZmJfbW9kYWxfX2FkZF9uZXdfZm9ybSc7XHJcblx0Y29uc3QgVFBMX01PREFMX0lEID0gJ3dwYmMtYmZiLXRwbC1tb2RhbC1hZGRfbmV3X2Zvcm0nO1xyXG5cclxuXHRjb25zdCBJRF9USVRMRSAgICAgICA9ICd3cGJjX2JmYl9wb3B1cF9tb2RhbF9fYWRkX25ld19mb3JtX190aXRsZSc7XHJcblx0Y29uc3QgSURfU0xVRyAgICAgICAgPSAnd3BiY19iZmJfcG9wdXBfbW9kYWxfX2FkZF9uZXdfZm9ybV9fc2x1Zyc7XHJcblx0Y29uc3QgSURfSU1BR0VfVVJMICAgPSAnd3BiY19iZmJfcG9wdXBfbW9kYWxfX2FkZF9uZXdfZm9ybV9faW1hZ2VfdXJsJztcclxuXHRjb25zdCBJRF9ERVNDUklQVElPTiA9ICd3cGJjX2JmYl9wb3B1cF9tb2RhbF9fYWRkX25ld19mb3JtX19kZXNjcmlwdGlvbic7XHJcblxyXG5cdGNvbnN0IElEX1RQTF9TRUFSQ0ggID0gJ3dwYmNfYmZiX3BvcHVwX21vZGFsX19hZGRfbmV3X2Zvcm1fX3RwbF9zZWFyY2gnO1xyXG5cclxuXHRjb25zdCBTRUxfQ09ORklSTSA9ICcjJyArIE1PREFMX0RPTV9JRCArICcgW2RhdGEtd3BiYy1iZmItY29uZmlybT1cIjFcIl0nO1xyXG5cdGNvbnN0IFNFTF9DQU5DRUwgID0gJyMnICsgTU9EQUxfRE9NX0lEICsgJyBbZGF0YS13cGJjLWJmYi1jYW5jZWw9XCIxXCJdJztcclxuXHRjb25zdCBTRUxfRVJST1IgICA9ICcjJyArIE1PREFMX0RPTV9JRCArICcgW2RhdGEtd3BiYy1iZmItZXJyb3I9XCIxXCJdJztcclxuXHRjb25zdCBTRUxfQ0xFQVJfSU1BR0UgPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLWNsZWFyLWltYWdlPVwiMVwiXSc7XHJcblxyXG5cdGNvbnN0IEJMQU5LX1RFTVBMQVRFX1NMVUcgPSAnX19ibGFua19fJztcclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2hhc190ZXh0KHZhbHVlKSB7XHJcblx0XHRyZXR1cm4gISEgKCB2YWx1ZSAmJiBTdHJpbmcoIHZhbHVlICkudHJpbSgpICk7XHJcblx0fVxyXG5cclxuXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19nZXRfZWwoaWQpIHtcclxuXHRcdHJldHVybiBkLmdldEVsZW1lbnRCeUlkKCBpZCApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2dldF9tb2RhbF9lbCgpIHtcclxuXHRcdHJldHVybiBkLmdldEVsZW1lbnRCeUlkKCBNT0RBTF9ET01fSUQgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19zZXRfZXJyb3IobXNnKSB7XHJcblx0XHRjb25zdCBlbCA9IGQucXVlcnlTZWxlY3RvciggU0VMX0VSUk9SICk7XHJcblx0XHRpZiAoICEgZWwgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGlmICggd3BiY19iZmJfX2hhc190ZXh0KCBtc2cgKSApIHtcclxuXHRcdFx0ZWwudGV4dENvbnRlbnQgPSBTdHJpbmcoIG1zZyApO1xyXG5cdFx0XHRlbC5zdHlsZS5kaXNwbGF5ID0gJyc7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRlbC50ZXh0Q29udGVudCA9ICcnO1xyXG5cdFx0XHRlbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3NldF9jb25maXJtX2VuYWJsZWQoaXNfZW5hYmxlZCkge1xyXG5cdFx0Y29uc3QgYnRuID0gZC5xdWVyeVNlbGVjdG9yKCBTRUxfQ09ORklSTSApO1xyXG5cdFx0aWYgKCAhIGJ0biApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfZW5hYmxlZCApIHtcclxuXHRcdFx0YnRuLmNsYXNzTGlzdC5yZW1vdmUoICdkaXNhYmxlZCcgKTtcclxuXHRcdFx0YnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRidG4uY2xhc3NMaXN0LmFkZCggJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRidG4uc2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ3JlYXRlIGEgXCJzbHVnL2tleVwiIGZyb20gdGl0bGUgKHVuZGVyc2NvcmUgc3R5bGUpLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlXHJcblx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19zbHVnaWZ5X3RvX2tleSh2YWx1ZSkge1xyXG5cdFx0bGV0IHYgPSBTdHJpbmcoIHZhbHVlIHx8ICcnICkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIGFjY2VudHMgd2hlbiBwb3NzaWJsZS5cclxuXHRcdHRyeSB7XHJcblx0XHRcdGlmICggdiAmJiB2Lm5vcm1hbGl6ZSApIHtcclxuXHRcdFx0XHR2ID0gdi5ub3JtYWxpemUoICdORkQnICkucmVwbGFjZSggL1tcXHUwMzAwLVxcdTAzNmZdL2csICcnICk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblxyXG5cdFx0Ly8gUmVwbGFjZSBxdW90ZXMsIHRoZW4ga2VlcCBvbmx5IGEtejAtOSBfIC0gc3BhY2UuXHJcblx0XHR2ID0gdi5yZXBsYWNlKCAvWydcIl0vZywgJycgKTtcclxuXHRcdHYgPSB2LnJlcGxhY2UoIC9bXmEtejAtOV9cXC1cXHNdKy9nLCAnJyApO1xyXG5cclxuXHRcdC8vIENvbnZlcnQgc3BhY2VzL2Rhc2hlcyB0byB1bmRlcnNjb3Jlcy5cclxuXHRcdHYgPSB2LnJlcGxhY2UoIC9bXFxzXFwtXSsvZywgJ18nICk7XHJcblxyXG5cdFx0Ly8gQ29sbGFwc2UgdW5kZXJzY29yZXMsIHRyaW0uXHJcblx0XHR2ID0gdi5yZXBsYWNlKCAvXysvZywgJ18nICk7IC8vIC5yZXBsYWNlKCAvXl8rfF8rJC9nLCAnJyApO1xyXG5cclxuXHRcdC8vIFNhZmV0eTogbXVzdCBzdGFydCB3aXRoIGEgbGV0dGVyIGlmIHBvc3NpYmxlLlxyXG5cdFx0aWYgKCB2ICYmIC9eWzAtOV0vLnRlc3QoIHYgKSApIHtcclxuXHRcdFx0diA9ICdmb3JtXycgKyB2O1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB2O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2FuaXRpemUgdXNlci1lbnRlcmVkIHNsdWcva2V5LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlXHJcblx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19zYW5pdGl6ZV9rZXkodmFsdWUpIHtcclxuXHRcdGxldCB2ID0gU3RyaW5nKCB2YWx1ZSB8fCAnJyApLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0diA9IHYucmVwbGFjZSggL1teYS16MC05X10rL2csICdfJyApO1xyXG5cdFx0diA9IHYucmVwbGFjZSggL18rL2csICdfJyApOyAvLyAucmVwbGFjZSggL15fK3xfKyQvZywgJycgKTtcclxuXHRcdGlmICggdiAmJiAvXlswLTldLy50ZXN0KCB2ICkgKSB7XHJcblx0XHRcdHYgPSAnZm9ybV8nICsgdjtcclxuXHRcdH1cclxuXHRcdHJldHVybiB2O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3JlbmRlcl90aHVtYihtb2RhbF9lbCwgdXJsKSB7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgfHwgISBtb2RhbF9lbC5xdWVyeVNlbGVjdG9yICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgdGh1bWIgPSBtb2RhbF9lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItdGh1bWI9XCIxXCJdJyApO1xyXG5cdFx0aWYgKCAhIHRodW1iICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3Qgc2FmZV91cmwgPSBTdHJpbmcoIHVybCB8fCAnJyApLnRyaW0oKTtcclxuXHJcblx0XHRpZiAoIHNhZmVfdXJsICkge1xyXG5cdFx0XHR0aHVtYi5pbm5lckhUTUwgPSAnPGltZyBzcmM9XCInICsgc2FmZV91cmwucmVwbGFjZSggL1wiL2csICcmcXVvdDsnICkgKyAnXCIgc3R5bGU9XCJ3aWR0aDoxMDAlO2hlaWdodDoxMDAlO29iamVjdC1maXQ6Y292ZXI7XCIgYWx0PVwiXCIgLz4nO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGh1bWIuaW5uZXJIVE1MID0gJyc7XHJcblxyXG5cdFx0XHRjb25zdCBzcGFuID0gZC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKTtcclxuXHRcdFx0c3Bhbi5jbGFzc05hbWUgPSAnZGVzY3JpcHRpb24nO1xyXG5cdFx0XHRzcGFuLnN0eWxlLnBhZGRpbmcgPSAnNnB4JztcclxuXHRcdFx0c3Bhbi5zdHlsZS50ZXh0QWxpZ24gPSAnY2VudGVyJztcclxuXHRcdFx0c3Bhbi50ZXh0Q29udGVudCA9IHdwYmNfYmZiX19pMThuKCAndGV4dF9ub19pbWFnZScsICdObyBJbWFnZScgKTtcclxuXHJcblx0XHRcdHRodW1iLmFwcGVuZENoaWxkKCBzcGFuICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcobW9kYWxfZWwpIHtcclxuXHRcdGlmICggISBtb2RhbF9lbCApIHtcclxuXHRcdFx0cmV0dXJuIEJMQU5LX1RFTVBMQVRFX1NMVUc7XHJcblx0XHR9XHJcblx0XHRjb25zdCBwaWNrZXIgPSBtb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlX3BpY2tlciB8fCBudWxsO1xyXG5cdFx0aWYgKCBwaWNrZXIgJiYgdHlwZW9mIHBpY2tlci5nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0cmV0dXJuIHBpY2tlci5nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZygpO1xyXG5cdFx0fVxyXG5cdFx0Y29uc3QgdiA9IFN0cmluZyggbW9kYWxfZWwuX193cGJjX2JmYl9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnIHx8ICcnICk7XHJcblx0XHRyZXR1cm4gdiA/IHYgOiBCTEFOS19URU1QTEFURV9TTFVHO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2dldF90ZW1wbGF0ZV9waWNrZXIobW9kYWxfZWwpIHtcclxuXHRcdGlmICggISBtb2RhbF9lbCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQhIFVJLlRlbXBsYXRlX1BpY2tlciB8fFxyXG5cdFx0XHR0eXBlb2YgVUkuVGVtcGxhdGVfUGlja2VyLmNyZWF0ZSAhPT0gJ2Z1bmN0aW9uJ1xyXG5cdFx0KSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBtb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlX3BpY2tlciApIHtcclxuXHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXIgPSBVSS5UZW1wbGF0ZV9QaWNrZXIuY3JlYXRlKFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdG1vZGFsX2VsICAgICAgICAgICAgICAgIDogbW9kYWxfZWwsXHJcblx0XHRcdFx0XHRzZWFyY2hfaW5wdXRfaWQgICAgICAgICA6IElEX1RQTF9TRUFSQ0gsXHJcblx0XHRcdFx0XHRibGFua190ZW1wbGF0ZV9zbHVnICAgICA6IEJMQU5LX1RFTVBMQVRFX1NMVUcsXHJcblx0XHRcdFx0XHRhbGxvd19kZWxldGUgICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRhbGxvd19wcmVzZXRzICAgICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRhbGxvd19zYW1lX2NsaWNrX2JsYW5rICA6IHRydWUsXHJcblx0XHRcdFx0XHRibGFua19kZXNjICAgICAgICAgICAgICA6IHdwYmNfYmZiX19pMThuKCAndGV4dF9hZGRfbmV3X2JsYW5rX2Rlc2MnLCAnU3RhcnQgd2l0aCBhbiBlbXB0eSBsYXlvdXQuJyApLFxyXG5cdFx0XHRcdFx0ZW1wdHlfdGV4dCAgICAgICAgICAgICAgOiB3cGJjX2JmYl9faTE4biggJ3RleHRfYWRkX25ld19lbXB0eV90ZW1wbGF0ZXMnLCAnTm8gdGVtcGxhdGVzIGZvdW5kLiBZb3UgY2FuIHN0aWxsIGNyZWF0ZSBhIGJsYW5rIGZvcm0uJyApLFxyXG5cdFx0XHRcdFx0bGlzdF9oZWxwZXJfbWlzc2luZ190ZXh0OiB3cGJjX2JmYl9faTE4biggJ3RleHRfYWRkX25ld19saXN0X2hlbHBlcl9taXNzaW5nJywgJ1dQQkMgQkZCOiBsaXN0IGZvcm1zIGhlbHBlciBtaXNzaW5nLicgKSxcclxuXHRcdFx0XHRcdGxvYWRfZmFpbGVkX3RleHQgICAgICAgIDogd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FkZF9uZXdfbG9hZF9mYWlsZWQnLCAnRmFpbGVkIHRvIGxvYWQgdGVtcGxhdGVzIGxpc3QuIFlvdSBjYW4gc3RpbGwgY3JlYXRlIGEgYmxhbmsgZm9ybS4nICksXHJcblx0XHRcdFx0XHRvbl9zZXRfZXJyb3IgICAgICAgICAgICA6IHdwYmNfYmZiX19zZXRfZXJyb3IsXHJcblx0XHRcdFx0XHRvbl9zZWxlY3Rpb25fY2hhbmdlICAgICA6IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0aWYgKCB0eXBlb2YgbW9kYWxfZWwuX193cGJjX2JmYl9hZGRfbmV3X3VwZGF0ZV9jb25maXJtX3N0YXRlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfYWRkX25ld191cGRhdGVfY29uZmlybV9zdGF0ZSgpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHQpO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBtb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlX3BpY2tlcjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQobW9kYWxfZWwpIHtcclxuXHRcdGNvbnN0IHRpdGxlX2VsID0gd3BiY19iZmJfX2dldF9lbCggSURfVElUTEUgKTtcclxuXHRcdGNvbnN0IHNsdWdfZWwgID0gd3BiY19iZmJfX2dldF9lbCggSURfU0xVRyApO1xyXG5cclxuXHRcdGNvbnN0IGltZ19lbCAgID0gd3BiY19iZmJfX2dldF9lbCggSURfSU1BR0VfVVJMICk7XHJcblx0XHRjb25zdCBkZXNjX2VsICA9IHdwYmNfYmZiX19nZXRfZWwoIElEX0RFU0NSSVBUSU9OICk7XHJcblxyXG5cdFx0Y29uc3QgdGl0bGVfcmF3ID0gdGl0bGVfZWwgPyBTdHJpbmcoIHRpdGxlX2VsLnZhbHVlIHx8ICcnICkudHJpbSgpIDogJyc7XHJcblx0XHRsZXQgc2x1Z19yYXcgICAgPSBzbHVnX2VsICA/IFN0cmluZyggc2x1Z19lbC52YWx1ZSAgfHwgJycgKS50cmltKCkgOiAnJztcclxuXHJcblx0XHRzbHVnX3JhdyA9IHdwYmNfYmZiX19zYW5pdGl6ZV9rZXkoIHNsdWdfcmF3ICk7XHJcblxyXG5cdFx0Y29uc3QgcGF5bG9hZCA9IHtcclxuXHRcdFx0dGVtcGxhdGVfZm9ybV9zbHVnIDogd3BiY19iZmJfX2dldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnKCBtb2RhbF9lbCApLFxyXG5cdFx0XHRmb3JtX3RpdGxlICAgICAgICAgOiB0aXRsZV9yYXcsXHJcblx0XHRcdGZvcm1fc2x1ZyAgICAgICAgICA6IHNsdWdfcmF3LFxyXG5cdFx0XHRmb3JtX2ltYWdlX3VybCAgICAgOiBpbWdfZWwgID8gU3RyaW5nKCBpbWdfZWwudmFsdWUgIHx8ICcnICkudHJpbSgpIDogJycsXHJcblx0XHRcdGZvcm1fZGVzY3JpcHRpb24gICA6IGRlc2NfZWwgPyBTdHJpbmcoIGRlc2NfZWwudmFsdWUgfHwgJycgKS50cmltKCkgOiAnJ1xyXG5cdFx0fTtcclxuXHJcblx0XHRyZXR1cm4gcGF5bG9hZDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFRlbXBsYXRlIGlzIG9wdGlvbmFsLiBPbmx5IHRpdGxlICsgc2x1ZyBhcmUgcmVxdWlyZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gcGF5bG9hZFxyXG5cdCAqIEByZXR1cm4ge3N0cmluZ30gZXJyb3IgbWVzc2FnZSBvciAnJ1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX192YWxpZGF0ZV9wYXlsb2FkKHBheWxvYWQpIHtcclxuXHRcdGlmICggISB3cGJjX2JmYl9faGFzX3RleHQoIHBheWxvYWQuZm9ybV90aXRsZSApICkge1xyXG5cdFx0XHRyZXR1cm4gd3BiY19iZmJfX2kxOG4oICd0ZXh0X2FkZF9uZXdfdmFsaWRhdGlvbl90aXRsZScsICdQbGVhc2UgZW50ZXIgYSBmb3JtIHRpdGxlLicgKTtcclxuXHRcdH1cclxuXHRcdGlmICggISB3cGJjX2JmYl9faGFzX3RleHQoIHBheWxvYWQuZm9ybV9zbHVnICkgKSB7XHJcblx0XHRcdHJldHVybiB3cGJjX2JmYl9faTE4biggJ3RleHRfYWRkX25ld192YWxpZGF0aW9uX3NsdWcnLCAnUGxlYXNlIGVudGVyIGEgdmFsaWQgZm9ybSBrZXkgKHNsdWcpLicgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiAnJztcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBNb2RhbCBzdGF0ZS9iaW5kXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19yZXNldF9tb2RhbF9zdGF0ZShtb2RhbF9lbCkge1xyXG5cclxuXHRcdGNvbnN0IHRpdGxlX2VsICAgPSB3cGJjX2JmYl9fZ2V0X2VsKCBJRF9USVRMRSApO1xyXG5cdFx0Y29uc3Qgc2x1Z19lbCAgICA9IHdwYmNfYmZiX19nZXRfZWwoIElEX1NMVUcgKTtcclxuXHRcdGNvbnN0IGltZ19lbCAgICAgPSB3cGJjX2JmYl9fZ2V0X2VsKCBJRF9JTUFHRV9VUkwgKTtcclxuXHRcdGNvbnN0IGRlc2NfZWwgICAgPSB3cGJjX2JmYl9fZ2V0X2VsKCBJRF9ERVNDUklQVElPTiApO1xyXG5cclxuXHJcblx0XHRpZiAoIHRpdGxlX2VsICkgdGl0bGVfZWwudmFsdWUgPSAnJztcclxuXHRcdGlmICggc2x1Z19lbCApICBzbHVnX2VsLnZhbHVlICA9ICcnO1xyXG5cdFx0aWYgKCBpbWdfZWwgKSAgIGltZ19lbC52YWx1ZSAgID0gJyc7XHJcblx0XHRpZiAoIGRlc2NfZWwgKSAgZGVzY19lbC52YWx1ZSAgPSAnJztcclxuXHJcblxyXG5cdFx0Ly8gQXV0by1zbHVnIG1vZGUgYnkgZGVmYXVsdC5cclxuXHRcdGlmICggbW9kYWxfZWwgKSB7XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfbWFudWFsX3NsdWcgPSBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBwaWNrZXIgPSB3cGJjX2JmYl9fZ2V0X3RlbXBsYXRlX3BpY2tlciggbW9kYWxfZWwgKTtcclxuXHRcdGlmICggcGlja2VyICkge1xyXG5cdFx0XHRwaWNrZXIucmVzZXRfc3RhdGUoKTtcclxuXHRcdH0gZWxzZSBpZiAoIG1vZGFsX2VsICkge1xyXG5cdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcgPSBCTEFOS19URU1QTEFURV9TTFVHO1xyXG5cdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlc19jYWNoZSAgID0gW107XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfdHBsX3BhZ2UgICAgICAgICAgPSAxO1xyXG5cdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9oYXNfbW9yZSAgICAgID0gZmFsc2U7XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfdHBsX3NlYXJjaCAgICAgICAgPSAnJztcclxuXHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl90cGxfc2VhcmNoX3RpbWVyICA9IDA7XHJcblx0XHR9XHJcblx0XHR3cGJjX2JmYl9fcmVuZGVyX3RodW1iKCBtb2RhbF9lbCwgJycgKTtcclxuXHRcdHdwYmNfYmZiX19zZXRfZXJyb3IoICcnICk7XHJcblx0XHR3cGJjX2JmYl9fc2V0X2NvbmZpcm1fZW5hYmxlZCggZmFsc2UgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19iaW5kX21vZGFsX2hhbmRsZXJzKG1vZGFsX2VsKSB7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgfHwgbW9kYWxfZWwuX193cGJjX2JmYl9oYW5kbGVyc19ib3VuZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0bW9kYWxfZWwuX193cGJjX2JmYl9oYW5kbGVyc19ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0Y29uc3QgdGl0bGVfZWwgID0gd3BiY19iZmJfX2dldF9lbCggSURfVElUTEUgKTtcclxuXHRcdGNvbnN0IHNsdWdfZWwgICA9IHdwYmNfYmZiX19nZXRfZWwoIElEX1NMVUcgKTtcclxuXHRcdGNvbnN0IGltZ19lbCAgICA9IHdwYmNfYmZiX19nZXRfZWwoIElEX0lNQUdFX1VSTCApO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHdwYmNfYmZiX191cGRhdGVfY29uZmlybV9zdGF0ZSgpIHtcclxuXHRcdFx0Y29uc3QgcGF5bG9hZCA9IHdwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQoIG1vZGFsX2VsICk7XHJcblx0XHRcdGNvbnN0IGVyciAgICAgPSB3cGJjX2JmYl9fdmFsaWRhdGVfcGF5bG9hZCggcGF5bG9hZCApO1xyXG5cdFx0XHR3cGJjX2JmYl9fc2V0X2Vycm9yKCAnJyApO1xyXG5cdFx0XHR3cGJjX2JmYl9fc2V0X2NvbmZpcm1fZW5hYmxlZCggISBlcnIgKTtcclxuXHRcdH1cclxuXHJcblx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2FkZF9uZXdfdXBkYXRlX2NvbmZpcm1fc3RhdGUgPSB3cGJjX2JmYl9fdXBkYXRlX2NvbmZpcm1fc3RhdGU7XHJcblxyXG5cdFx0Ly8gVGl0bGUgLT4gYXV0byBzbHVnIChpZiBub3QgbWFudWFsKS5cclxuXHRcdGlmICggdGl0bGVfZWwgKSB7XHJcblx0XHRcdHRpdGxlX2VsLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uICgpIHtcclxuXHJcblx0XHRcdFx0Y29uc3QgaXNfbWFudWFsID0gISEgbW9kYWxfZWwuX193cGJjX2JmYl9tYW51YWxfc2x1ZztcclxuXHRcdFx0XHRpZiAoICEgaXNfbWFudWFsICYmIHNsdWdfZWwgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBhdXRvX3NsdWcgPSB3cGJjX2JmYl9fc2x1Z2lmeV90b19rZXkoIHRpdGxlX2VsLnZhbHVlIHx8ICcnICk7XHJcblx0XHRcdFx0XHRzbHVnX2VsLnZhbHVlID0gYXV0b19zbHVnO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0d3BiY19iZmJfX3VwZGF0ZV9jb25maXJtX3N0YXRlKCk7XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTbHVnIG1hbnVhbC5cclxuXHRcdGlmICggc2x1Z19lbCApIHtcclxuXHRcdFx0c2x1Z19lbC5hZGRFdmVudExpc3RlbmVyKCAnaW5wdXQnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9tYW51YWxfc2x1ZyA9IHRydWU7XHJcblxyXG5cdFx0XHRcdGNvbnN0IHNhbml0aXplZCA9IHdwYmNfYmZiX19zYW5pdGl6ZV9rZXkoIHNsdWdfZWwudmFsdWUgfHwgJycgKTtcclxuXHRcdFx0XHRpZiAoIHNhbml0aXplZCAhPT0gc2x1Z19lbC52YWx1ZSApIHtcclxuXHRcdFx0XHRcdHNsdWdfZWwudmFsdWUgPSBzYW5pdGl6ZWQ7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR3cGJjX2JmYl9fdXBkYXRlX2NvbmZpcm1fc3RhdGUoKTtcclxuXHRcdFx0fSwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEltYWdlIHVybCAtPiB0aHVtYm5haWwuXHJcblx0XHRpZiAoIGltZ19lbCApIHtcclxuXHJcblx0XHRcdGNvbnN0IHVwZGF0ZV90aHVtYiA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHR3cGJjX2JmYl9fcmVuZGVyX3RodW1iKCBtb2RhbF9lbCwgaW1nX2VsLnZhbHVlIHx8ICcnICk7XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyB3cGJjX21lZGlhX3VwbG9hZF9idXR0b24gdHJpZ2dlcnMgdmlhIGpRdWVyeSgudHJpZ2dlcikgLT4gbGlzdGVuIHZpYSBqUXVlcnkoLm9uKVxyXG5cdFx0XHRpZiAoIHcualF1ZXJ5ICkge1xyXG5cdFx0XHRcdHcualF1ZXJ5KCBpbWdfZWwgKVxyXG5cdFx0XHRcdFx0Lm9mZiggJ3dwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQud3BiY0JmYkFkZE5ld0Zvcm0nIClcclxuXHRcdFx0XHRcdC5vbiggJ3dwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQud3BiY0JmYkFkZE5ld0Zvcm0nLCB1cGRhdGVfdGh1bWIgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gTmF0aXZlIGZhbGxiYWNrLlxyXG5cdFx0XHRpbWdfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ3dwYmNfbWVkaWFfdXBsb2FkX3VybF9zZXQnLCB1cGRhdGVfdGh1bWIsIHRydWUgKTtcclxuXHRcdFx0aW1nX2VsLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIHVwZGF0ZV90aHVtYiwgdHJ1ZSApO1xyXG5cdFx0XHRpbWdfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2NoYW5nZScsIHVwZGF0ZV90aHVtYiwgdHJ1ZSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIENsZWFyIGltYWdlLlxyXG5cdFx0bW9kYWxfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0aWYgKCAhIGUgfHwgISBlLnRhcmdldCB8fCAhIGUudGFyZ2V0LmNsb3Nlc3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGNsZWFyX2J0biA9IGUudGFyZ2V0LmNsb3Nlc3QoIFNFTF9DTEVBUl9JTUFHRSApO1xyXG5cdFx0XHRpZiAoICEgY2xlYXJfYnRuICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRjb25zdCBpbWcgPSB3cGJjX2JmYl9fZ2V0X2VsKCBJRF9JTUFHRV9VUkwgKTtcclxuXHRcdFx0aWYgKCBpbWcgKSB7XHJcblx0XHRcdFx0aW1nLnZhbHVlID0gJyc7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGNvbnN0IGV2ID0gbmV3IEV2ZW50KCAnd3BiY19tZWRpYV91cGxvYWRfdXJsX3NldCcgKTtcclxuXHRcdFx0XHRcdGltZy5kaXNwYXRjaEV2ZW50KCBldiApO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHRcdHdwYmNfYmZiX19yZW5kZXJfdGh1bWIoIG1vZGFsX2VsLCAnJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSwgdHJ1ZSApO1xyXG5cclxuXHRcdC8vIEFueSBpbnB1dCB0aGF0IGNhbiBhZmZlY3QgdmFsaWRhdGlvbiAtPiB1cGRhdGUgY29uZmlybSBzdGF0ZS5cclxuXHRcdG1vZGFsX2VsLmFkZEV2ZW50TGlzdGVuZXIoICdpbnB1dCcsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdGlmICggISBlIHx8ICEgZS50YXJnZXQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZS50YXJnZXQuaWQgPT09IElEX0RFU0NSSVBUSU9OICkge1xyXG5cdFx0XHRcdHdwYmNfYmZiX191cGRhdGVfY29uZmlybV9zdGF0ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0Y29uc3QgcGlja2VyID0gd3BiY19iZmJfX2dldF90ZW1wbGF0ZV9waWNrZXIoIG1vZGFsX2VsICk7XHJcblx0XHRpZiAoIHBpY2tlciApIHtcclxuXHRcdFx0cGlja2VyLmJpbmRfaGFuZGxlcnMoKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdFVJLk1vZGFsX0FkZF9OZXdfRm9ybS5vcGVuID0gZnVuY3Rpb24gKG9uX2NvbmZpcm0sIG9uX29wZW4pIHtcclxuXHJcblx0XHRjb25zdCByZWYgPSBVSS5UZW1wbGF0ZXMuZW5zdXJlX2RvbV9yZWZfZnJvbV93cF90ZW1wbGF0ZSggVFBMX01PREFMX0lELCBNT0RBTF9ET01fSUQgKTtcclxuXHRcdGlmICggISByZWYgfHwgISByZWYuZWwgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRsZXQgbW9kYWxfZWwgPSByZWYuZWw7XHJcblxyXG5cdFx0Ly8gSWYgdGVtcGxhdGUgcm9vdCBpcyBhIHdyYXBwZXIgKGxpa2UgPHNwYW4+KSwgZmluZCB0aGUgYWN0dWFsIG1vZGFsIGluc2lkZSBpdC5cclxuXHRcdGlmICggbW9kYWxfZWwgJiYgbW9kYWxfZWwuaWQgIT09IE1PREFMX0RPTV9JRCApIHtcclxuXHRcdFx0Y29uc3QgaW5zaWRlID0gbW9kYWxfZWwucXVlcnlTZWxlY3RvciA/IG1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IoICcjJyArIE1PREFMX0RPTV9JRCApIDogbnVsbDtcclxuXHRcdFx0aWYgKCBpbnNpZGUgKSB7XHJcblx0XHRcdFx0bW9kYWxfZWwgPSBpbnNpZGU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGlmICggISBtb2RhbF9lbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFN0b3JlIGNhbGxiYWNrIG9uIG1vZGFsIGluc3RhbmNlIChzaW5nbGUgbW9kYWwsIHNpbmdsZSBhY3RpdmUgY29uZmlybSkuXHJcblx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2FkZF9uZXdfZm9ybV9jYiA9ICggdHlwZW9mIG9uX2NvbmZpcm0gPT09ICdmdW5jdGlvbicgKSA/IG9uX2NvbmZpcm0gOiBudWxsO1xyXG5cclxuXHRcdHdwYmNfYmZiX19iaW5kX21vZGFsX2hhbmRsZXJzKCBtb2RhbF9lbCApO1xyXG5cdFx0d3BiY19iZmJfX3Jlc2V0X21vZGFsX3N0YXRlKCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdFVJLk1vZGFscy5zaG93KCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdGNvbnN0IHBpY2tlciA9IHdwYmNfYmZiX19nZXRfdGVtcGxhdGVfcGlja2VyKCBtb2RhbF9lbCApO1xyXG5cdFx0aWYgKCBwaWNrZXIgKSB7XHJcblx0XHRcdHBpY2tlci5zZXRfcGFnZXIoIDEsIGZhbHNlICk7XHJcblx0XHRcdHBpY2tlci5hcHBseV9zZWFyY2hfdmFsdWUoICcnLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0Y29uc3QgcGF5bG9hZCA9IHdwYmNfYmZiX19jb2xsZWN0X3BheWxvYWQoIG1vZGFsX2VsICk7XHJcblx0XHRcdFx0Y29uc3QgZXJyICAgICA9IHdwYmNfYmZiX192YWxpZGF0ZV9wYXlsb2FkKCBwYXlsb2FkICk7XHJcblx0XHRcdFx0d3BiY19iZmJfX3NldF9jb25maXJtX2VuYWJsZWQoICEgZXJyICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHdwYmNfYmZiX19zZXRfZXJyb3IoICdXUEJDIEJGQjogVGVtcGxhdGUgUGlja2VyIGhlbHBlciBpcyBub3QgYXZhaWxhYmxlLiBZb3UgY2FuIHN0aWxsIGNyZWF0ZSBhIGJsYW5rIGZvcm0uJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEZvY3VzIHRpdGxlIGlucHV0LlxyXG5cdFx0dy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGNvbnN0IHRpdGxlX2VsID0gd3BiY19iZmJfX2dldF9lbCggSURfVElUTEUgKTtcclxuXHRcdFx0aWYgKCB0aXRsZV9lbCAmJiB0aXRsZV9lbC5mb2N1cyApIHtcclxuXHRcdFx0XHR0cnkgeyB0aXRsZV9lbC5mb2N1cygpOyB9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHRcdHRyeSB7IHRpdGxlX2VsLnNlbGVjdCgpOyB9IGNhdGNoICggX2UyICkge31cclxuXHRcdFx0fVxyXG5cdFx0fSwgMCApO1xyXG5cclxuXHRcdGlmICggb25fb3BlbiApIHtcclxuXHRcdFx0dHJ5IHsgb25fb3BlbiggbW9kYWxfZWwgKTsgfSBjYXRjaCAoIF9lMyApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQmluZCBXUCBNZWRpYSB1cGxvYWRlciBidXR0b25zIGluc2lkZSBtb2RhbC5cclxuXHRcdGlmICggdy5qUXVlcnkgKSB7XHJcblx0XHRcdHcualF1ZXJ5KCBtb2RhbF9lbCApXHJcblx0XHRcdFx0Lm9mZiggJ2NsaWNrLndwYmNNZWRpYScsICcud3BiY19tZWRpYV91cGxvYWRfYnV0dG9uJyApXHJcblx0XHRcdFx0Lm9uKCAnY2xpY2sud3BiY01lZGlhJywgJy53cGJjX21lZGlhX3VwbG9hZF9idXR0b24nLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuXHJcblx0XHRcdFx0XHQvLyBVc2Ugc2FmZSB0eXBlb2YgY2hlY2sgKGF2b2lkcyBSZWZlcmVuY2VFcnJvcikuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbl9jbGlja2VkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3LndwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbl9jbGlja2VkKCB0aGlzLCBldmVudCApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIGlmICggdHlwZW9mIHdwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbl9jbGlja2VkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX21lZGlhX3VwbG9hZF9idXR0b25fY2xpY2tlZCggdGhpcywgZXZlbnQgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGFsZXJ0KFxyXG5cdFx0XHRcdFx0XHRcdHdwYmNfYmZiX19pMThuKFxyXG5cdFx0XHRcdFx0XHRcdFx0J3RleHRfYWRkX25ld19tZWRpYV9kZW1vX3Jlc3RyaWN0ZWQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0J1dhcm5pbmchIFRoaXMgZmVhdHVyZSBpcyByZXN0cmljdGVkIGluIHRoZSBwdWJsaWMgbGl2ZSBkZW1vLidcclxuXHRcdFx0XHRcdFx0XHQpXHJcblx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvLyBDb25maXJtIC8gQ2FuY2VsIChzaW5nbGUgZGVsZWdhdGVkIGxpc3RlbmVyKS5cclxuXHRkLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcblxyXG5cdFx0Y29uc3QgbW9kYWxfZWwgPSB3cGJjX2JmYl9fZ2V0X21vZGFsX2VsKCk7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgfHwgISBlIHx8ICEgZS50YXJnZXQgfHwgISBlLnRhcmdldC5jbG9zZXN0ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgaXNfY29uZmlybSA9IGUudGFyZ2V0LmNsb3Nlc3QoIFNFTF9DT05GSVJNICk7XHJcblx0XHRpZiAoIGlzX2NvbmZpcm0gKSB7XHJcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdC8vIFByZXZlbnQgY29uZmlybSBpZiBkaXNhYmxlZC5cclxuXHRcdFx0aWYgKCBpc19jb25maXJtLmNsYXNzTGlzdC5jb250YWlucyggJ2Rpc2FibGVkJyApIHx8IGlzX2NvbmZpcm0uZ2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKSA9PT0gJ3RydWUnICkge1xyXG5cdFx0XHRcdGNvbnN0IHBheWxvYWQwID0gd3BiY19iZmJfX2NvbGxlY3RfcGF5bG9hZCggbW9kYWxfZWwgKTtcclxuXHRcdFx0XHRjb25zdCBlcnIwICAgICA9IHdwYmNfYmZiX192YWxpZGF0ZV9wYXlsb2FkKCBwYXlsb2FkMCApO1xyXG5cdFx0XHRcdGlmICggZXJyMCApIHtcclxuXHRcdFx0XHRcdHdwYmNfYmZiX19zZXRfZXJyb3IoIGVycjAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBwYXlsb2FkID0gd3BiY19iZmJfX2NvbGxlY3RfcGF5bG9hZCggbW9kYWxfZWwgKTtcclxuXHRcdFx0Y29uc3QgZXJyICAgICA9IHdwYmNfYmZiX192YWxpZGF0ZV9wYXlsb2FkKCBwYXlsb2FkICk7XHJcblx0XHRcdGlmICggZXJyICkge1xyXG5cdFx0XHRcdHdwYmNfYmZiX19zZXRfZXJyb3IoIGVyciApO1xyXG5cdFx0XHRcdHdwYmNfYmZiX19zZXRfY29uZmlybV9lbmFibGVkKCBmYWxzZSApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d3BiY19iZmJfX3NldF9lcnJvciggJycgKTtcclxuXHJcblx0XHRcdGNvbnN0IGNiID0gbW9kYWxfZWwuX193cGJjX2JmYl9hZGRfbmV3X2Zvcm1fY2IgfHwgbnVsbDtcclxuXHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9hZGRfbmV3X2Zvcm1fY2IgPSBudWxsO1xyXG5cclxuXHRcdFx0VUkuTW9kYWxzLmhpZGUoIG1vZGFsX2VsICk7XHJcblxyXG5cdFx0XHRpZiAoIGNiICkge1xyXG5cdFx0XHRcdHRyeSB7IGNiKCBwYXlsb2FkICk7IH0gY2F0Y2ggKCBfZTQgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBpc19jYW5jZWwgPSBlLnRhcmdldC5jbG9zZXN0KCBTRUxfQ0FOQ0VMICk7XHJcblx0XHRpZiAoIGlzX2NhbmNlbCApIHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2FkZF9uZXdfZm9ybV9jYiA9IG51bGw7XHJcblx0XHRcdFVJLk1vZGFscy5oaWRlKCBtb2RhbF9lbCApO1xyXG5cdFx0fVxyXG5cclxuXHR9LCB0cnVlICk7XHJcblxyXG59KCB3aW5kb3csIGRvY3VtZW50ICkpO1xyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19tZW51X2Zvcm1zX19uZXcobWVudV9vcHRpb25fdGhpcykge1xyXG5cclxuXHRXUEJDX0JGQl9Db3JlLlVJLk1vZGFsX0FkZF9OZXdfRm9ybS5vcGVuKCBmdW5jdGlvbiAocGF5bG9hZCkge1xyXG5cclxuXHRcdHZhciB0ZW1wbGF0ZV9mb3JtX2tleSA9ICcnO1xyXG5cclxuXHRcdC8vIEJsYW5rIHdoZW46XHJcblx0XHQvLyAtICdfX2JsYW5rX18nIHNlbGVjdGVkXHJcblx0XHQvLyAtIGVtcHR5IHZhbHVlIChkZWZlbnNpdmUpXHJcblx0XHRpZiAoIHBheWxvYWQgJiYgcGF5bG9hZC50ZW1wbGF0ZV9mb3JtX3NsdWcgJiYgcGF5bG9hZC50ZW1wbGF0ZV9mb3JtX3NsdWcgIT09ICdfX2JsYW5rX18nICkge1xyXG5cdFx0XHR0ZW1wbGF0ZV9mb3JtX2tleSA9IFN0cmluZyggcGF5bG9hZC50ZW1wbGF0ZV9mb3JtX3NsdWcgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRlbXBsYXRlX2Zvcm1fa2V5ID0gJyc7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyICRidG4gPSAoIHdpbmRvdy5qUXVlcnkgJiYgbWVudV9vcHRpb25fdGhpcyApID8gd2luZG93LmpRdWVyeSggbWVudV9vcHRpb25fdGhpcyApIDogbnVsbDtcclxuXHRcdHZhciBvcmlnaW5hbF9idXN5X3RleHQgPSAnJztcclxuXHRcdGlmICggJGJ0biAmJiAkYnRuLmxlbmd0aCApIHtcclxuXHRcdFx0b3JpZ2luYWxfYnVzeV90ZXh0ID0gJGJ0bi5kYXRhKCAnd3BiYy11LWJ1c3ktdGV4dCcgKSB8fCAnJztcclxuXHRcdFx0JGJ0bi5kYXRhKCAnd3BiYy11LWJ1c3ktdGV4dCcsIHdwYmNfYmZiX19pMThuKCAndGV4dF9hZGRfbmV3X2NyZWF0aW5nJywgJ0NyZWF0aW5nLi4uJyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gMSkgQ3JlYXRlIGZvcm0gaW4gREIgKGNsb25lIHRlbXBsYXRlKS5cclxuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9fYWpheF9jcmVhdGVfZm9ybSAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogY3JlYXRlIGhlbHBlciBtaXNzaW5nLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR3aW5kb3cud3BiY19iZmJfX2FqYXhfY3JlYXRlX2Zvcm0oIG1lbnVfb3B0aW9uX3RoaXMsIHBheWxvYWQsIHRlbXBsYXRlX2Zvcm1fa2V5LCBmdW5jdGlvbiAoaXNfY3JlYXRlZCwgcmVzcCkge1xyXG5cclxuXHRcdFx0aWYgKCAkYnRuICYmICRidG4ubGVuZ3RoICkge1xyXG5cdFx0XHRcdCRidG4uZGF0YSggJ3dwYmMtdS1idXN5LXRleHQnLCBvcmlnaW5hbF9idXN5X3RleHQgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAhIGlzX2NyZWF0ZWQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAyKSBMb2FkIHRoZSBjcmVhdGVkIGZvcm0gaW50byBCdWlsZGVyIFVJLlxyXG5cdFx0XHRpZiAoIHR5cGVvZiB3aW5kb3cud3BiY19iZmJfX2FqYXhfbG9hZF9jdXJyZW50X2Zvcm0gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0d2luZG93LndwYmNfYmZiX19hamF4X2xvYWRfY3VycmVudF9mb3JtKCBtZW51X29wdGlvbl90aGlzICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHR3aW5kb3cud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIHdwYmNfYmZiX19pMThuKCAndGV4dF9hZGRfbmV3X2Zvcm1fY3JlYXRlZCcsICdGb3JtIGNyZWF0ZWQnICksICdzdWNjZXNzJywgMjAwMCwgZmFsc2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cclxuXHR9ICk7XHJcbn0iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVDLFdBQVVBLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0VBQ2hCLFlBQVk7O0VBRVosTUFBTUMsSUFBSSxHQUFJRixDQUFDLENBQUNHLGFBQWEsR0FBR0gsQ0FBQyxDQUFDRyxhQUFhLElBQUksQ0FBQyxDQUFFO0VBQ3RELE1BQU1DLEVBQUUsR0FBTUYsSUFBSSxDQUFDRSxFQUFFLEdBQUdGLElBQUksQ0FBQ0UsRUFBRSxJQUFJLENBQUMsQ0FBRTtFQUV0Q0EsRUFBRSxDQUFDQyxrQkFBa0IsR0FBR0QsRUFBRSxDQUFDQyxrQkFBa0IsSUFBSSxDQUFDLENBQUM7O0VBRW5EO0VBQ0EsSUFBS0QsRUFBRSxDQUFDQyxrQkFBa0IsQ0FBQ0MsT0FBTyxFQUFHO0lBQ3BDO0VBQ0Q7RUFDQUYsRUFBRSxDQUFD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

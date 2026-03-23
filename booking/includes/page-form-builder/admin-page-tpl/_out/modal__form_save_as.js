"use strict";

/**
 * Booking Calendar — "Save As" modal helper (BFB Admin)
 *
 * - Saves as Regular Form (published) or Template (template).
 * - Forces payload.form_details to JSON built from modal fields:
 *     { title, description, picture_url }
 * - NEVER sends form_details.form_name (prevents reserved/rename path).
 * - Updates thumbnail preview on image select / typing / remove.
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_save_as.js
 */

/* global wpbc_admin_show_message */
(function (w, d) {
  'use strict';

  // Shared tiny namespace.
  w.WPBC_BFB_Save_As = w.WPBC_BFB_Save_As || {};
  if (!w.WPBC_BFB_Save_As.LOCK_MAX_MS) {
    w.WPBC_BFB_Save_As.LOCK_MAX_MS = 20000;
  }
  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  const UI = Core.UI = Core.UI || {};
  UI.Modal_Save_As_Form = UI.Modal_Save_As_Form || {};
  if (UI.Modal_Save_As_Form.__bound) {
    return;
  }
  UI.Modal_Save_As_Form.__bound = true;
  const MODAL_DOM_ID = 'wpbc_bfb_modal__save_as_form';
  const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-save_as_form';
  const ID_TITLE = 'wpbc_bfb_popup_modal__save_as_form__title';
  const ID_SLUG = 'wpbc_bfb_popup_modal__save_as_form__slug';
  const ID_IMAGE_URL = 'wpbc_bfb_popup_modal__save_as_form__image_url';
  const ID_DESCRIPTION = 'wpbc_bfb_popup_modal__save_as_form__description';
  const NAME_SAVE_TYPE = 'wpbc_bfb_save_as_form__save_type';
  const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
  const SEL_CANCEL = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
  const SEL_ERROR = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';
  const SEL_THUMB = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-thumb="1"]';
  const SEL_CLEAR_IMAGE = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-clear-image="1"]';
  const ACTION_SAVE_PUBLISHED = 'WPBC_AJX_BFB_SAVE_FORM_CONFIG';
  const ACTION_SAVE_TEMPLATE = 'WPBC_AJX_BFB_SAVE_FORM_CONFIG_TEMPLATE';

  // -----------------------------------------------------------------------------------------------------------------
  // Small helpers
  // -----------------------------------------------------------------------------------------------------------------

  function has_text(v) {
    return !!(v && String(v).trim());
  }
  function get_cfg() {
    return w.WPBC_BFB_Ajax || {};
  }
  function get_el(id) {
    return d.getElementById(id);
  }
  function get_state() {
    const cfg = get_cfg();
    cfg.__wpbc_bfb_save_as_state = cfg.__wpbc_bfb_save_as_state || {
      is_active: false,
      lock_time: 0,
      original_form_name: '',
      target_form_name: '',
      save_type: 'published',
      form_title: '',
      form_description: '',
      form_picture_url: ''
    };
    return cfg.__wpbc_bfb_save_as_state;
  }
  function get_cached_meta() {
    const cfg = get_cfg();
    cfg.__wpbc_bfb_form_meta_cache = cfg.__wpbc_bfb_form_meta_cache || {
      title: '',
      description: '',
      picture_url: ''
    };
    return cfg.__wpbc_bfb_form_meta_cache;
  }
  function set_error(msg) {
    const el = d.querySelector(SEL_ERROR);
    if (!el) {
      return;
    }
    if (has_text(msg)) {
      el.innerHTML = String(msg);
      el.style.display = '';
    } else {
      el.innerHTML = '';
      el.style.display = 'none';
    }
  }
  function set_confirm_enabled(is_enabled) {
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
  function show_modal(modal_el) {
    if (UI.Modals && typeof UI.Modals.show === 'function') {
      try {
        UI.Modals.show(modal_el);
        return;
      } catch (_e) {}
    }
    if (w.jQuery && w.jQuery.fn && typeof w.jQuery.fn.modal === 'function') {
      try {
        w.jQuery(modal_el).modal('show');
        return;
      } catch (_e2) {}
    }
  }
  function hide_modal(modal_el) {
    if (UI.Modals && typeof UI.Modals.hide === 'function') {
      try {
        UI.Modals.hide(modal_el);
      } catch (_e) {}
    } else if (w.jQuery && w.jQuery.fn && typeof w.jQuery.fn.modal === 'function') {
      try {
        w.jQuery(modal_el).modal('hide');
      } catch (_e2) {}
    }

    // safety cleanup for stuck backdrop
    try {
      const backdrops = d.querySelectorAll('.modal-backdrop');
      for (let i = 0; i < backdrops.length; i++) {
        backdrops[i].parentNode && backdrops[i].parentNode.removeChild(backdrops[i]);
      }
      if (d.body) {
        d.body.classList.remove('modal-open');
        d.body.style.paddingRight = '';
      }
    } catch (_e3) {}
  }
  function sanitize_key(value) {
    let v = String(value || '').trim().toLowerCase();
    v = v.replace(/[^a-z0-9_]+/g, '_');
    v = v.replace(/_+/g, '_'); // .replace( /^_+|_+$/g, '' );
    if (v && /^[0-9]/.test(v)) {
      v = 'form_' + v;
    }
    return v;
  }
  function slugify_to_key(value) {
    let v = String(value || '').trim().toLowerCase();
    try {
      if (v && v.normalize) {
        v = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      }
    } catch (_e) {}
    v = v.replace(/['"]/g, '');
    v = v.replace(/[^a-z0-9_\-\s]+/g, '');
    v = v.replace(/[\s\-]+/g, '_');
    v = v.replace(/_+/g, '_'); // .replace( /^_+|_+$/g, '' );
    if (v && /^[0-9]/.test(v)) {
      v = 'form_' + v;
    }
    return v;
  }
  function get_save_type() {
    const el = d.querySelector('input[name="' + NAME_SAVE_TYPE + '"]:checked');
    const v = el ? String(el.value || '').toLowerCase() : 'published';
    return v === 'template' ? 'template' : 'published';
  }
  function render_thumb(url) {
    const thumb = d.querySelector(SEL_THUMB);
    if (!thumb) {
      return;
    }
    const safe_url = String(url || '').trim();
    if (safe_url) {
      thumb.innerHTML = '<img src="' + safe_url.replace(/"/g, '&quot;') + '" style="width:100%;height:100%;object-fit:cover;" alt="" />';
    } else {
      thumb.innerHTML = '<span class="description" style="padding:6px;text-align:center;">No Image</span>';
    }
  }
  function collect_payload() {
    const title_el = get_el(ID_TITLE);
    const slug_el = get_el(ID_SLUG);
    const img_el = get_el(ID_IMAGE_URL);
    const desc_el = get_el(ID_DESCRIPTION);
    const title_raw = title_el ? String(title_el.value || '') : '';
    let slug_raw = slug_el ? String(slug_el.value || '') : '';
    slug_raw = sanitize_key(slug_raw);
    return {
      form_title: String(title_raw).trim(),
      form_slug: slug_raw,
      save_type: get_save_type(),
      form_picture_url: img_el ? String(img_el.value || '').trim() : '',
      form_description: desc_el ? String(desc_el.value || '') : ''
    };
  }
  function validate_payload(payload) {
    if (!has_text(payload.form_slug)) {
      return 'Please enter a valid form key (slug).';
    }
    if ('standard' === String(payload.form_slug)) {
      return 'This form key is reserved. Please choose another.';
    }
    return '';
  }
  function build_form_details_json(st) {
    // IMPORTANT: do NOT include form_name here.
    const details = {
      title: String(st.form_title || ''),
      description: String(st.form_description || ''),
      picture_url: String(st.form_picture_url || '')
    };
    try {
      return JSON.stringify(details);
    } catch (_e) {
      return '{"title":"","description":"","picture_url":""}';
    }
  }
  function set_payload_for_save_as(payload, st) {
    const save_type = st.save_type === 'template' ? 'template' : 'published';
    payload.form_name = String(st.target_form_name);
    payload.action = save_type === 'template' ? ACTION_SAVE_TEMPLATE : ACTION_SAVE_PUBLISHED;
    payload.status = save_type === 'template' ? 'template' : 'published';

    // Force meta from modal (always JSON string).
    payload.form_details = build_form_details_json(st);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Cache current form meta on load (so modal can prefill image/desc).
  // -----------------------------------------------------------------------------------------------------------------
  if (!d.__wpbc_bfb_save_as_meta_cache_bound) {
    d.__wpbc_bfb_save_as_meta_cache_bound = true;
    d.addEventListener('wpbc:bfb:form:ajax_loaded', function (e) {
      try {
        const cfg = get_cfg();
        const detail = e && e.detail ? e.detail : null;
        const data = detail && detail.loaded_data ? detail.loaded_data : null;
        if (!data) {
          return;
        }
        cfg.__wpbc_bfb_form_meta_cache = cfg.__wpbc_bfb_form_meta_cache || {};
        cfg.__wpbc_bfb_form_meta_cache.title = data.title ? String(data.title) : '';
        cfg.__wpbc_bfb_form_meta_cache.description = data.description ? String(data.description) : '';
        cfg.__wpbc_bfb_form_meta_cache.picture_url = data.picture_url ? String(data.picture_url) : '';
      } catch (_e0) {}
    }, true);
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Patch outgoing save payload (hook + last-chance prefilter)
  // -----------------------------------------------------------------------------------------------------------------
  if (!d.__wpbc_bfb_save_as_before_save_bound) {
    d.__wpbc_bfb_save_as_before_save_bound = true;
    d.addEventListener('wpbc:bfb:form:before_save_payload', function (e) {
      const st = get_state();
      if (!st.is_active || !st.target_form_name) {
        return;
      }
      const detail = e && e.detail ? e.detail : null;
      if (!detail || !detail.payload) {
        return;
      }
      set_payload_for_save_as(detail.payload, st);
    }, true);
  }
  if (w.jQuery && !w.WPBC_BFB_Save_As.__ajax_prefilter_bound) {
    w.WPBC_BFB_Save_As.__ajax_prefilter_bound = true;
    function strip_name_params_from_urlsearchparams(p) {
      // Remove potential nested array serialization variants:
      // form_details[form_name]=standard etc.
      const keys_to_delete = ['form_details[form_name]', 'form_details[form_slug]', 'form_details[slug]', 'form_details[key]', 'form_name_in_details', 'form_details_form_name'];
      for (let i = 0; i < keys_to_delete.length; i++) {
        try {
          p.delete(keys_to_delete[i]);
        } catch (_e) {}
      }
    }
    function strip_name_fields_from_formdata(fd) {
      const keys_to_delete = ['form_details[form_name]', 'form_details[form_slug]', 'form_details[slug]', 'form_details[key]', 'form_name_in_details', 'form_details_form_name'];
      for (let i = 0; i < keys_to_delete.length; i++) {
        try {
          fd.delete(keys_to_delete[i]);
        } catch (_e) {}
      }
    }
    w.jQuery.ajaxPrefilter(function (options, original_options) {
      try {
        const st = get_state();
        if (!st || !st.is_active || !st.target_form_name) {
          return;
        }
        const data = options && options.data !== undefined ? options.data : original_options ? original_options.data : null;
        if (!data) {
          return;
        }
        const action = st.save_type === 'template' ? ACTION_SAVE_TEMPLATE : ACTION_SAVE_PUBLISHED;
        const status = st.save_type === 'template' ? 'template' : 'published';
        const target = String(st.target_form_name);

        // ---------------------------------------------------------------------------------
        // 1) Object payload (classic jQuery style)
        // ---------------------------------------------------------------------------------
        if (typeof data === 'object' && !(w.FormData && data instanceof w.FormData)) {
          const a = String(data.action || '');
          if (a !== ACTION_SAVE_PUBLISHED && a !== ACTION_SAVE_TEMPLATE) {
            return; // do not touch unrelated requests
          }
          data.action = action;
          data.status = status;
          data.form_name = target;

          // IMPORTANT: force JSON string; do NOT allow nested form_details[...] keys.
          data.form_details = build_form_details_json(st);

          // Also wipe any possible helper keys if some module adds them.
          try {
            delete data.form_details_form_name;
          } catch (_e1) {}
          try {
            delete data.form_name_in_details;
          } catch (_e2) {}
          options.data = data;
          return;
        }

        // ---------------------------------------------------------------------------------
        // 2) FormData payload (some save helpers use it)
        // ---------------------------------------------------------------------------------
        if (w.FormData && data instanceof w.FormData) {
          // best effort: only if it's a save request
          const a = String(data.get ? data.get('action') || '' : '');
          if (a !== ACTION_SAVE_PUBLISHED && a !== ACTION_SAVE_TEMPLATE) {
            return;
          }
          strip_name_fields_from_formdata(data);
          if (data.set) {
            data.set('action', action);
            data.set('status', status);
            data.set('form_name', target);
            data.set('form_details', build_form_details_json(st));
          } else {
            // fallback if no .set()
            data.append('action', action);
            data.append('status', status);
            data.append('form_name', target);
            data.append('form_details', build_form_details_json(st));
          }
          options.data = data;
          return;
        }

        // ---------------------------------------------------------------------------------
        // 3) String payload (URL-encoded)  <<< THIS was missing in your current code
        // ---------------------------------------------------------------------------------
        if (typeof data === 'string' && w.URLSearchParams) {
          const p = new URLSearchParams(data);
          const a = String(p.get('action') || '');
          if (a !== ACTION_SAVE_PUBLISHED && a !== ACTION_SAVE_TEMPLATE) {
            return;
          }

          // Kill any nested name keys that PHP would interpret as form_details['form_name'].
          strip_name_params_from_urlsearchparams(p);
          p.set('action', action);
          p.set('status', status);
          p.set('form_name', target);

          // Force JSON string (NO form_name inside).
          p.set('form_details', build_form_details_json(st));
          options.data = p.toString();
        }
      } catch (_e) {}
    });
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Modal: open + bind
  // -----------------------------------------------------------------------------------------------------------------

  function bind_modal_handlers_once(modal_el) {
    if (!modal_el || modal_el.__wpbc_bfb_handlers_bound) {
      return;
    }
    modal_el.__wpbc_bfb_handlers_bound = true;
    const title_el = get_el(ID_TITLE);
    const slug_el = get_el(ID_SLUG);
    const img_el = get_el(ID_IMAGE_URL);
    function update_confirm_state() {
      const p = collect_payload();
      const err = validate_payload(p);
      set_error('');
      set_confirm_enabled(!err);
    }
    if (title_el) {
      title_el.addEventListener('input', function () {
        // only auto-suggest slug if user did not touch slug manually.
        if (slug_el && !modal_el.__wpbc_bfb_manual_slug) {
          const auto_slug = slugify_to_key(title_el.value || '');
          if (auto_slug) {
            slug_el.value = auto_slug;
          }
        }
        update_confirm_state();
      }, true);
    }
    if (slug_el) {
      slug_el.addEventListener('input', function () {
        modal_el.__wpbc_bfb_manual_slug = true;
        const sanitized = sanitize_key(slug_el.value || '');
        if (sanitized !== slug_el.value) {
          slug_el.value = sanitized;
        }
        update_confirm_state();
      }, true);
    }

    // Save type change: does not affect validation, but keep UI consistent.
    modal_el.addEventListener('change', function (e) {
      if (e && e.target && e.target.name === NAME_SAVE_TYPE) {
        update_confirm_state();
      }
    }, true);

    // Image thumb updates (same approach as Add New Form).
    if (img_el) {
      const update_thumb = function () {
        render_thumb(img_el.value || '');
      };
      if (w.jQuery) {
        w.jQuery(img_el).off('wpbc_media_upload_url_set.wpbcBfbSaveAsForm').on('wpbc_media_upload_url_set.wpbcBfbSaveAsForm', update_thumb);
      }
      img_el.addEventListener('wpbc_media_upload_url_set', update_thumb, true);
      img_el.addEventListener('input', update_thumb, true);
      img_el.addEventListener('change', update_thumb, true);
    }

    // Clear image.
    modal_el.addEventListener('click', function (e) {
      if (!e || !e.target || !e.target.closest) {
        return;
      }
      const btn = e.target.closest(SEL_CLEAR_IMAGE);
      if (!btn) {
        return;
      }
      e.preventDefault();
      const img = get_el(ID_IMAGE_URL);
      if (img) {
        img.value = '';
        render_thumb('');

        // keep behavior consistent with uploader listeners
        try {
          const ev = new Event('wpbc_media_upload_url_set');
          img.dispatchEvent(ev);
        } catch (_e0) {}
      }
    }, true);
  }
  function reset_modal_state(modal_el) {
    const title_el = get_el(ID_TITLE);
    const slug_el = get_el(ID_SLUG);
    const img_el = get_el(ID_IMAGE_URL);
    const desc_el = get_el(ID_DESCRIPTION);
    if (title_el) title_el.value = '';
    if (slug_el) slug_el.value = '';
    if (img_el) img_el.value = '';
    if (desc_el) desc_el.value = '';
    const published_radio = d.querySelector('input[name="' + NAME_SAVE_TYPE + '"][value="published"]');
    if (published_radio) {
      published_radio.checked = true;
    }
    if (modal_el) {
      modal_el.__wpbc_bfb_manual_slug = false;
    }
    render_thumb('');
    set_error('');
    set_confirm_enabled(false);
  }
  function prefill_from_cache() {
    const meta = get_cached_meta();
    const title_el = get_el(ID_TITLE);
    const img_el = get_el(ID_IMAGE_URL);
    const desc_el = get_el(ID_DESCRIPTION);

    // Fill only if empty (so re-open after cancel keeps latest cache).
    if (title_el && !has_text(title_el.value) && has_text(meta.title)) {
      title_el.value = String(meta.title);
    }
    if (img_el && !has_text(img_el.value) && has_text(meta.picture_url)) {
      img_el.value = String(meta.picture_url);
    }
    if (desc_el && !has_text(desc_el.value) && has_text(meta.description)) {
      desc_el.value = String(meta.description);
    }
    render_thumb(img_el ? img_el.value : '');
  }
  UI.Modal_Save_As_Form.open = function (on_confirm, on_open) {
    const ref = UI.Templates.ensure_dom_ref_from_wp_template(TPL_MODAL_ID, MODAL_DOM_ID);
    if (!ref || !ref.el) {
      return;
    }
    let modal_el = ref.el;
    if (modal_el && modal_el.id !== MODAL_DOM_ID) {
      const inside = modal_el.querySelector ? modal_el.querySelector('#' + MODAL_DOM_ID) : null;
      if (inside) {
        modal_el = inside;
      }
    }
    if (!modal_el) {
      return;
    }
    if (!d.body.contains(modal_el)) {
      try {
        d.body.appendChild(modal_el);
      } catch (_e0) {}
    }
    modal_el.__wpbc_bfb_save_as_cb = typeof on_confirm === 'function' ? on_confirm : null;
    bind_modal_handlers_once(modal_el);
    reset_modal_state(modal_el);
    prefill_from_cache();
    show_modal(modal_el);

    // Bind media upload button click inside this modal (same as Add New Form).
    if (w.jQuery) {
      w.jQuery(modal_el).off('click.wpbcMediaSaveAs', '.wpbc_media_upload_button').on('click.wpbcMediaSaveAs', '.wpbc_media_upload_button', function (event) {
        // Use safe typeof check (avoids ReferenceError).
        if (typeof w.wpbc_media_upload_button_clicked === 'function') {
          w.wpbc_media_upload_button_clicked(this, event);
        } else if (typeof wpbc_media_upload_button_clicked === 'function') {
          wpbc_media_upload_button_clicked(this, event);
        } else {
          alert('Warning! This feature is restricted in the public live demo.');
        }
      });
    }
    // Also open media modal when clicking on the thumbnail preview.
    if (w.jQuery) {
      w.jQuery(modal_el).off('click.wpbcMediaSaveAsThumb', '[data-wpbc-bfb-open-media="1"]').on('click.wpbcMediaSaveAsThumb', '[data-wpbc-bfb-open-media="1"]', function (event) {
        // Find the "Select Image" button inside the same modal and trigger uploader on it.
        const btn = modal_el.querySelector ? modal_el.querySelector('.wpbc_media_upload_button') : null;
        if (!btn) {
          return;
        }

        // Use safe typeof check (avoids ReferenceError).
        if (typeof w.wpbc_media_upload_button_clicked === 'function') {
          w.wpbc_media_upload_button_clicked(btn, event);
        } else if (typeof wpbc_media_upload_button_clicked === 'function') {
          wpbc_media_upload_button_clicked(btn, event);
        } else {
          alert('Warning! This feature is restricted in the public live demo.');
        }
      });
    }
    // Focus slug input.
    w.setTimeout(function () {
      const slug_el = get_el(ID_SLUG);
      if (slug_el && slug_el.focus) {
        try {
          slug_el.focus();
        } catch (_e1) {}
        try {
          slug_el.select();
        } catch (_e2) {}
      }
    }, 0);
    if (typeof on_open === 'function') {
      try {
        on_open(modal_el);
      } catch (_e3) {}
    }
  };

  // Confirm / Cancel (delegated).
  d.addEventListener('click', function (e) {
    const modal_el = d.getElementById(MODAL_DOM_ID);
    if (!modal_el || !e || !e.target || !e.target.closest) {
      return;
    }
    const is_confirm = e.target.closest(SEL_CONFIRM);
    if (is_confirm) {
      e.preventDefault();
      if (is_confirm.classList.contains('disabled') || is_confirm.getAttribute('aria-disabled') === 'true') {
        const p0 = collect_payload();
        const err0 = validate_payload(p0);
        if (err0) {
          set_error(err0);
        }
        return;
      }
      const payload = collect_payload();
      const err = validate_payload(payload);
      if (err) {
        set_error(err);
        set_confirm_enabled(false);
        return;
      }
      set_error('');
      const cb = modal_el.__wpbc_bfb_save_as_cb || null;
      modal_el.__wpbc_bfb_save_as_cb = null;
      hide_modal(modal_el);
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
      modal_el.__wpbc_bfb_save_as_cb = null;
      hide_modal(modal_el);
    }
  }, true);
})(window, document);

/**
 * Menu handler: "Save As..."
 *
 * @param {HTMLElement} menu_option_this
 */
function wpbc_bfb__menu_forms__save_as(menu_option_this) {
  var cfg = window.WPBC_BFB_Ajax || {};
  var lock_ms = window.WPBC_BFB_Save_As && window.WPBC_BFB_Save_As.LOCK_MAX_MS ? parseInt(window.WPBC_BFB_Save_As.LOCK_MAX_MS, 10) : 20000;
  if (!window.WPBC_BFB_Core || !window.WPBC_BFB_Core.UI || !window.WPBC_BFB_Core.UI.Modal_Save_As_Form) {
    wpbc_admin_show_message('WPBC BFB: Save As modal is not loaded.', 'error', 8000);
    return;
  }
  window.WPBC_BFB_Core.UI.Modal_Save_As_Form.open(function (payload) {
    if (!payload || !payload.form_slug) {
      return;
    }
    if (typeof window.wpbc_bfb__ajax_save_current_form !== 'function') {
      wpbc_admin_show_message('WPBC BFB: save helper missing.', 'error', 10000);
      return;
    }
    var st = cfg.__wpbc_bfb_save_as_state = cfg.__wpbc_bfb_save_as_state || {};

    // Simple lock.
    if (st.is_active) {
      var age = Date.now() - (parseInt(st.lock_time || 0, 10) || 0);
      if (age < lock_ms) {
        wpbc_admin_show_message('Save As is still in progress...', 'warning', 2000, false);
        return;
      }
      st.is_active = false;
    }
    var original_form_name = String(cfg.form_name || 'standard');
    var target_form_name = String(payload.form_slug);
    var save_type = payload.save_type === 'template' ? 'template' : 'published';

    // Activate state used by hook + prefilter.
    st.is_active = true;
    st.lock_time = Date.now();
    st.original_form_name = original_form_name;
    st.target_form_name = target_form_name;
    st.save_type = save_type;

    // Meta (always taken from modal).
    st.form_title = String(payload.form_title || '');
    st.form_description = String(payload.form_description || '');
    st.form_picture_url = String(payload.form_picture_url || '');

    // Switch context so saving targets the new slug.
    cfg.form_name = target_form_name;
    var watchdog_id = setTimeout(function () {
      st.is_active = false;
    }, lock_ms);
    window.wpbc_bfb__ajax_save_current_form(menu_option_this, function (is_saved) {
      try {
        clearTimeout(watchdog_id);
      } catch (_e0) {}
      if (!is_saved) {
        cfg.form_name = original_form_name;
        st.is_active = false;
        return;
      }
      if (save_type === 'template') {
        // keep working on the original
        cfg.form_name = original_form_name;
        wpbc_admin_show_message('Template saved: ' + target_form_name, 'success', 2000, false);
      } else {
        wpbc_admin_show_message('Saved As: ' + target_form_name, 'success', 2000, false);
      }
      st.is_active = false;
    });
  }, function () {
    // Suggest slug based on current form.
    var slug_el = document.getElementById('wpbc_bfb_popup_modal__save_as_form__slug');
    if (!slug_el) {
      return;
    }
    var base = String(cfg.form_name || 'standard');
    var suggested = /_copy(\d+)?$/.test(base) ? base.replace(/_copy(\d+)?$/, function (_m, n) {
      var num = n ? parseInt(n, 10) : 1;
      num = !num || num < 1 ? 1 : num;
      return '_copy' + (num + 1);
    }) : base + '_copy';
    if ('standard' === suggested) {
      suggested = 'standard_copy';
    }
    slug_el.value = suggested;

    // Trigger sanitization + enable confirm.
    try {
      slug_el.dispatchEvent(new Event('input'));
    } catch (_e) {}
  });
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9zYXZlX2FzLmpzIiwibmFtZXMiOlsidyIsImQiLCJXUEJDX0JGQl9TYXZlX0FzIiwiTE9DS19NQVhfTVMiLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlVJIiwiTW9kYWxfU2F2ZV9Bc19Gb3JtIiwiX19ib3VuZCIsIk1PREFMX0RPTV9JRCIsIlRQTF9NT0RBTF9JRCIsIklEX1RJVExFIiwiSURfU0xVRyIsIklEX0lNQUdFX1VSTCIsIklEX0RFU0NSSVBUSU9OIiwiTkFNRV9TQVZFX1RZUEUiLCJTRUxfQ09ORklSTSIsIlNFTF9DQU5DRUwiLCJTRUxfRVJST1IiLCJTRUxfVEhVTUIiLCJTRUxfQ0xFQVJfSU1BR0UiLCJBQ1RJT05fU0FWRV9QVUJMSVNIRUQiLCJBQ1RJT05fU0FWRV9URU1QTEFURSIsImhhc190ZXh0IiwidiIsIlN0cmluZyIsInRyaW0iLCJnZXRfY2ZnIiwiV1BCQ19CRkJfQWpheCIsImdldF9lbCIsImlkIiwiZ2V0RWxlbWVudEJ5SWQiLCJnZXRfc3RhdGUiLCJjZmciLCJfX3dwYmNfYmZiX3NhdmVfYXNfc3RhdGUiLCJpc19hY3RpdmUiLCJsb2NrX3RpbWUiLCJvcmlnaW5hbF9mb3JtX25hbWUiLCJ0YXJnZXRfZm9ybV9uYW1lIiwic2F2ZV90eXBlIiwiZm9ybV90aXRsZSIsImZvcm1fZGVzY3JpcHRpb24iLCJmb3JtX3BpY3R1cmVfdXJsIiwiZ2V0X2NhY2hlZF9tZXRhIiwiX193cGJjX2JmYl9mb3JtX21ldGFfY2FjaGUiLCJ0aXRsZSIsImRlc2NyaXB0aW9uIiwicGljdHVyZV91cmwiLCJzZXRfZXJyb3IiLCJtc2ciLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJpbm5lckhUTUwiLCJzdHlsZSIsImRpc3BsYXkiLCJzZXRfY29uZmlybV9lbmFibGVkIiwiaXNfZW5hYmxlZCIsImJ0biIsImNsYXNzTGlzdCIsInJlbW92ZSIsInNldEF0dHJpYnV0ZSIsImFkZCIsInNob3dfbW9kYWwiLCJtb2RhbF9lbCIsIk1vZGFscyIsInNob3ciLCJfZSIsImpRdWVyeSIsImZuIiwibW9kYWwiLCJfZTIiLCJoaWRlX21vZGFsIiwiaGlkZSIsImJhY2tkcm9wcyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJpIiwibGVuZ3RoIiwicGFyZW50Tm9kZSIsInJlbW92ZUNoaWxkIiwiYm9keSIsInBhZGRpbmdSaWdodCIsIl9lMyIsInNhbml0aXplX2tleSIsInZhbHVlIiwidG9Mb3dlckNhc2UiLCJyZXBsYWNlIiwidGVzdCIsInNsdWdpZnlfdG9fa2V5Iiwibm9ybWFsaXplIiwiZ2V0X3NhdmVfdHlwZSIsInJlbmRlcl90aHVtYiIsInVybCIsInRodW1iIiwic2FmZV91cmwiLCJjb2xsZWN0X3BheWxvYWQiLCJ0aXRsZV9lbCIsInNsdWdfZWwiLCJpbWdfZWwiLCJkZXNjX2VsIiwidGl0bGVfcmF3Iiwic2x1Z19yYXciLCJmb3JtX3NsdWciLCJ2YWxpZGF0ZV9wYXlsb2FkIiwicGF5bG9hZCIsImJ1aWxkX2Zvcm1fZGV0YWlsc19qc29uIiwic3QiLCJkZXRhaWxzIiwiSlNPTiIsInN0cmluZ2lmeSIsInNldF9wYXlsb2FkX2Zvcl9zYXZlX2FzIiwiZm9ybV9uYW1lIiwiYWN0aW9uIiwic3RhdHVzIiwiZm9ybV9kZXRhaWxzIiwiX193cGJjX2JmYl9zYXZlX2FzX21ldGFfY2FjaGVfYm91bmQiLCJhZGRFdmVudExpc3RlbmVyIiwiZSIsImRldGFpbCIsImRhdGEiLCJsb2FkZWRfZGF0YSIsIl9lMCIsIl9fd3BiY19iZmJfc2F2ZV9hc19iZWZvcmVfc2F2ZV9ib3VuZCIsIl9fYWpheF9wcmVmaWx0ZXJfYm91bmQiLCJzdHJpcF9uYW1lX3BhcmFtc19mcm9tX3VybHNlYXJjaHBhcmFtcyIsInAiLCJrZXlzX3RvX2RlbGV0ZSIsImRlbGV0ZSIsInN0cmlwX25hbWVfZmllbGRzX2Zyb21fZm9ybWRhdGEiLCJmZCIsImFqYXhQcmVmaWx0ZXIiLCJvcHRpb25zIiwib3JpZ2luYWxfb3B0aW9ucyIsInVuZGVmaW5lZCIsInRhcmdldCIsIkZvcm1EYXRhIiwiYSIsImZvcm1fZGV0YWlsc19mb3JtX25hbWUiLCJfZTEiLCJmb3JtX25hbWVfaW5fZGV0YWlscyIsImdldCIsInNldCIsImFwcGVuZCIsIlVSTFNlYXJjaFBhcmFtcyIsInRvU3RyaW5nIiwiYmluZF9tb2RhbF9oYW5kbGVyc19vbmNlIiwiX193cGJjX2JmYl9oYW5kbGVyc19ib3VuZCIsInVwZGF0ZV9jb25maXJtX3N0YXRlIiwiZXJyIiwiX193cGJjX2JmYl9tYW51YWxfc2x1ZyIsImF1dG9fc2x1ZyIsInNhbml0aXplZCIsIm5hbWUiLCJ1cGRhdGVfdGh1bWIiLCJvZmYiLCJvbiIsImNsb3Nlc3QiLCJwcmV2ZW50RGVmYXVsdCIsImltZyIsImV2IiwiRXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwicmVzZXRfbW9kYWxfc3RhdGUiLCJwdWJsaXNoZWRfcmFkaW8iLCJjaGVja2VkIiwicHJlZmlsbF9mcm9tX2NhY2hlIiwibWV0YSIsIm9wZW4iLCJvbl9jb25maXJtIiwib25fb3BlbiIsInJlZiIsIlRlbXBsYXRlcyIsImVuc3VyZV9kb21fcmVmX2Zyb21fd3BfdGVtcGxhdGUiLCJpbnNpZGUiLCJjb250YWlucyIsImFwcGVuZENoaWxkIiwiX193cGJjX2JmYl9zYXZlX2FzX2NiIiwiZXZlbnQiLCJ3cGJjX21lZGlhX3VwbG9hZF9idXR0b25fY2xpY2tlZCIsImFsZXJ0Iiwic2V0VGltZW91dCIsImZvY3VzIiwic2VsZWN0IiwiaXNfY29uZmlybSIsImdldEF0dHJpYnV0ZSIsInAwIiwiZXJyMCIsImNiIiwiX2U0IiwiaXNfY2FuY2VsIiwid2luZG93IiwiZG9jdW1lbnQiLCJ3cGJjX2JmYl9fbWVudV9mb3Jtc19fc2F2ZV9hcyIsIm1lbnVfb3B0aW9uX3RoaXMiLCJsb2NrX21zIiwicGFyc2VJbnQiLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsIndwYmNfYmZiX19hamF4X3NhdmVfY3VycmVudF9mb3JtIiwiYWdlIiwiRGF0ZSIsIm5vdyIsIndhdGNoZG9nX2lkIiwiaXNfc2F2ZWQiLCJjbGVhclRpbWVvdXQiLCJiYXNlIiwic3VnZ2VzdGVkIiwiX20iLCJuIiwibnVtIl0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX3NyYy9tb2RhbF9fZm9ybV9zYXZlX2FzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCb29raW5nIENhbGVuZGFyIOKAlCBcIlNhdmUgQXNcIiBtb2RhbCBoZWxwZXIgKEJGQiBBZG1pbilcclxuICpcclxuICogLSBTYXZlcyBhcyBSZWd1bGFyIEZvcm0gKHB1Ymxpc2hlZCkgb3IgVGVtcGxhdGUgKHRlbXBsYXRlKS5cclxuICogLSBGb3JjZXMgcGF5bG9hZC5mb3JtX2RldGFpbHMgdG8gSlNPTiBidWlsdCBmcm9tIG1vZGFsIGZpZWxkczpcclxuICogICAgIHsgdGl0bGUsIGRlc2NyaXB0aW9uLCBwaWN0dXJlX3VybCB9XHJcbiAqIC0gTkVWRVIgc2VuZHMgZm9ybV9kZXRhaWxzLmZvcm1fbmFtZSAocHJldmVudHMgcmVzZXJ2ZWQvcmVuYW1lIHBhdGgpLlxyXG4gKiAtIFVwZGF0ZXMgdGh1bWJuYWlsIHByZXZpZXcgb24gaW1hZ2Ugc2VsZWN0IC8gdHlwaW5nIC8gcmVtb3ZlLlxyXG4gKlxyXG4gKiBAZmlsZTogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9zYXZlX2FzLmpzXHJcbiAqL1xyXG5cclxuLyogZ2xvYmFsIHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Ly8gU2hhcmVkIHRpbnkgbmFtZXNwYWNlLlxyXG5cdHcuV1BCQ19CRkJfU2F2ZV9BcyA9IHcuV1BCQ19CRkJfU2F2ZV9BcyB8fCB7fTtcclxuXHRpZiAoICEgdy5XUEJDX0JGQl9TYXZlX0FzLkxPQ0tfTUFYX01TICkge1xyXG5cdFx0dy5XUEJDX0JGQl9TYXZlX0FzLkxPQ0tfTUFYX01TID0gMjAwMDA7XHJcblx0fVxyXG5cclxuXHRjb25zdCBDb3JlID0gKHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSk7XHJcblx0Y29uc3QgVUkgICA9IChDb3JlLlVJID0gQ29yZS5VSSB8fCB7fSk7XHJcblx0VUkuTW9kYWxfU2F2ZV9Bc19Gb3JtID0gVUkuTW9kYWxfU2F2ZV9Bc19Gb3JtIHx8IHt9O1xyXG5cclxuXHRpZiAoIFVJLk1vZGFsX1NhdmVfQXNfRm9ybS5fX2JvdW5kICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHRVSS5Nb2RhbF9TYXZlX0FzX0Zvcm0uX19ib3VuZCA9IHRydWU7XHJcblxyXG5cdGNvbnN0IE1PREFMX0RPTV9JRCA9ICd3cGJjX2JmYl9tb2RhbF9fc2F2ZV9hc19mb3JtJztcclxuXHRjb25zdCBUUExfTU9EQUxfSUQgPSAnd3BiYy1iZmItdHBsLW1vZGFsLXNhdmVfYXNfZm9ybSc7XHJcblxyXG5cdGNvbnN0IElEX1RJVExFICAgICAgID0gJ3dwYmNfYmZiX3BvcHVwX21vZGFsX19zYXZlX2FzX2Zvcm1fX3RpdGxlJztcclxuXHRjb25zdCBJRF9TTFVHICAgICAgICA9ICd3cGJjX2JmYl9wb3B1cF9tb2RhbF9fc2F2ZV9hc19mb3JtX19zbHVnJztcclxuXHRjb25zdCBJRF9JTUFHRV9VUkwgICA9ICd3cGJjX2JmYl9wb3B1cF9tb2RhbF9fc2F2ZV9hc19mb3JtX19pbWFnZV91cmwnO1xyXG5cdGNvbnN0IElEX0RFU0NSSVBUSU9OID0gJ3dwYmNfYmZiX3BvcHVwX21vZGFsX19zYXZlX2FzX2Zvcm1fX2Rlc2NyaXB0aW9uJztcclxuXHJcblx0Y29uc3QgTkFNRV9TQVZFX1RZUEUgPSAnd3BiY19iZmJfc2F2ZV9hc19mb3JtX19zYXZlX3R5cGUnO1xyXG5cclxuXHRjb25zdCBTRUxfQ09ORklSTSAgICAgPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLWNvbmZpcm09XCIxXCJdJztcclxuXHRjb25zdCBTRUxfQ0FOQ0VMICAgICAgPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLWNhbmNlbD1cIjFcIl0nO1xyXG5cdGNvbnN0IFNFTF9FUlJPUiAgICAgICA9ICcjJyArIE1PREFMX0RPTV9JRCArICcgW2RhdGEtd3BiYy1iZmItZXJyb3I9XCIxXCJdJztcclxuXHRjb25zdCBTRUxfVEhVTUIgICAgICAgPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLXRodW1iPVwiMVwiXSc7XHJcblx0Y29uc3QgU0VMX0NMRUFSX0lNQUdFID0gJyMnICsgTU9EQUxfRE9NX0lEICsgJyBbZGF0YS13cGJjLWJmYi1jbGVhci1pbWFnZT1cIjFcIl0nO1xyXG5cclxuXHRjb25zdCBBQ1RJT05fU0FWRV9QVUJMSVNIRUQgPSAnV1BCQ19BSlhfQkZCX1NBVkVfRk9STV9DT05GSUcnO1xyXG5cdGNvbnN0IEFDVElPTl9TQVZFX1RFTVBMQVRFICA9ICdXUEJDX0FKWF9CRkJfU0FWRV9GT1JNX0NPTkZJR19URU1QTEFURSc7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU21hbGwgaGVscGVyc1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdGZ1bmN0aW9uIGhhc190ZXh0KCB2ICkge1xyXG5cdFx0cmV0dXJuICEhICggdiAmJiBTdHJpbmcoIHYgKS50cmltKCkgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9jZmcoKSB7XHJcblx0XHRyZXR1cm4gKCB3LldQQkNfQkZCX0FqYXggfHwge30gKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9lbCggaWQgKSB7XHJcblx0XHRyZXR1cm4gZC5nZXRFbGVtZW50QnlJZCggaWQgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9zdGF0ZSgpIHtcclxuXHRcdGNvbnN0IGNmZyA9IGdldF9jZmcoKTtcclxuXHRcdGNmZy5fX3dwYmNfYmZiX3NhdmVfYXNfc3RhdGUgPSBjZmcuX193cGJjX2JmYl9zYXZlX2FzX3N0YXRlIHx8IHtcclxuXHRcdFx0aXNfYWN0aXZlICAgICAgICAgOiBmYWxzZSxcclxuXHRcdFx0bG9ja190aW1lICAgICAgICAgOiAwLFxyXG5cdFx0XHRvcmlnaW5hbF9mb3JtX25hbWU6ICcnLFxyXG5cdFx0XHR0YXJnZXRfZm9ybV9uYW1lICA6ICcnLFxyXG5cdFx0XHRzYXZlX3R5cGUgICAgICAgICA6ICdwdWJsaXNoZWQnLFxyXG5cdFx0XHRmb3JtX3RpdGxlICAgICAgICA6ICcnLFxyXG5cdFx0XHRmb3JtX2Rlc2NyaXB0aW9uICA6ICcnLFxyXG5cdFx0XHRmb3JtX3BpY3R1cmVfdXJsICA6ICcnXHJcblx0XHR9O1xyXG5cdFx0cmV0dXJuIGNmZy5fX3dwYmNfYmZiX3NhdmVfYXNfc3RhdGU7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfY2FjaGVkX21ldGEoKSB7XHJcblx0XHRjb25zdCBjZmcgPSBnZXRfY2ZnKCk7XHJcblx0XHRjZmcuX193cGJjX2JmYl9mb3JtX21ldGFfY2FjaGUgPSBjZmcuX193cGJjX2JmYl9mb3JtX21ldGFfY2FjaGUgfHwge1xyXG5cdFx0XHR0aXRsZSAgICAgIDogJycsXHJcblx0XHRcdGRlc2NyaXB0aW9uOiAnJyxcclxuXHRcdFx0cGljdHVyZV91cmw6ICcnXHJcblx0XHR9O1xyXG5cdFx0cmV0dXJuIGNmZy5fX3dwYmNfYmZiX2Zvcm1fbWV0YV9jYWNoZTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9lcnJvciggbXNnICkge1xyXG5cdFx0Y29uc3QgZWwgPSBkLnF1ZXJ5U2VsZWN0b3IoIFNFTF9FUlJPUiApO1xyXG5cdFx0aWYgKCAhIGVsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRpZiAoIGhhc190ZXh0KCBtc2cgKSApIHtcclxuXHRcdFx0ZWwuaW5uZXJIVE1MID0gU3RyaW5nKCBtc2cgKTtcclxuXHRcdFx0ZWwuc3R5bGUuZGlzcGxheSA9ICcnO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZWwuaW5uZXJIVE1MID0gJyc7XHJcblx0XHRcdGVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfY29uZmlybV9lbmFibGVkKCBpc19lbmFibGVkICkge1xyXG5cdFx0Y29uc3QgYnRuID0gZC5xdWVyeVNlbGVjdG9yKCBTRUxfQ09ORklSTSApO1xyXG5cdFx0aWYgKCAhIGJ0biApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19lbmFibGVkICkge1xyXG5cdFx0XHRidG4uY2xhc3NMaXN0LnJlbW92ZSggJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRidG4uc2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcsICdmYWxzZScgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGJ0bi5jbGFzc0xpc3QuYWRkKCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdGJ0bi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ3RydWUnICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzaG93X21vZGFsKCBtb2RhbF9lbCApIHtcclxuXHRcdGlmICggVUkuTW9kYWxzICYmIHR5cGVvZiBVSS5Nb2RhbHMuc2hvdyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dHJ5IHsgVUkuTW9kYWxzLnNob3coIG1vZGFsX2VsICk7IHJldHVybjsgfSBjYXRjaCAoIF9lICkge31cclxuXHRcdH1cclxuXHRcdGlmICggdy5qUXVlcnkgJiYgdy5qUXVlcnkuZm4gJiYgdHlwZW9mIHcualF1ZXJ5LmZuLm1vZGFsID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHR0cnkgeyB3LmpRdWVyeSggbW9kYWxfZWwgKS5tb2RhbCggJ3Nob3cnICk7IHJldHVybjsgfSBjYXRjaCAoIF9lMiApIHt9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoaWRlX21vZGFsKCBtb2RhbF9lbCApIHtcclxuXHRcdGlmICggVUkuTW9kYWxzICYmIHR5cGVvZiBVSS5Nb2RhbHMuaGlkZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dHJ5IHsgVUkuTW9kYWxzLmhpZGUoIG1vZGFsX2VsICk7IH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHR9IGVsc2UgaWYgKCB3LmpRdWVyeSAmJiB3LmpRdWVyeS5mbiAmJiB0eXBlb2Ygdy5qUXVlcnkuZm4ubW9kYWwgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHRyeSB7IHcualF1ZXJ5KCBtb2RhbF9lbCApLm1vZGFsKCAnaGlkZScgKTsgfSBjYXRjaCAoIF9lMiApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gc2FmZXR5IGNsZWFudXAgZm9yIHN0dWNrIGJhY2tkcm9wXHJcblx0XHR0cnkge1xyXG5cdFx0XHRjb25zdCBiYWNrZHJvcHMgPSBkLnF1ZXJ5U2VsZWN0b3JBbGwoICcubW9kYWwtYmFja2Ryb3AnICk7XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IGJhY2tkcm9wcy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRiYWNrZHJvcHNbaV0ucGFyZW50Tm9kZSAmJiBiYWNrZHJvcHNbaV0ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggYmFja2Ryb3BzW2ldICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBkLmJvZHkgKSB7XHJcblx0XHRcdFx0ZC5ib2R5LmNsYXNzTGlzdC5yZW1vdmUoICdtb2RhbC1vcGVuJyApO1xyXG5cdFx0XHRcdGQuYm9keS5zdHlsZS5wYWRkaW5nUmlnaHQgPSAnJztcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIF9lMyApIHt9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzYW5pdGl6ZV9rZXkoIHZhbHVlICkge1xyXG5cdFx0bGV0IHYgPSBTdHJpbmcoIHZhbHVlIHx8ICcnICkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHR2ID0gdi5yZXBsYWNlKCAvW15hLXowLTlfXSsvZywgJ18nICk7XHJcblx0XHR2ID0gdi5yZXBsYWNlKCAvXysvZywgJ18nICk7IC8vIC5yZXBsYWNlKCAvXl8rfF8rJC9nLCAnJyApO1xyXG5cdFx0aWYgKCB2ICYmIC9eWzAtOV0vLnRlc3QoIHYgKSApIHtcclxuXHRcdFx0diA9ICdmb3JtXycgKyB2O1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIHY7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzbHVnaWZ5X3RvX2tleSggdmFsdWUgKSB7XHJcblx0XHRsZXQgdiA9IFN0cmluZyggdmFsdWUgfHwgJycgKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGlmICggdiAmJiB2Lm5vcm1hbGl6ZSApIHtcclxuXHRcdFx0XHR2ID0gdi5ub3JtYWxpemUoICdORkQnICkucmVwbGFjZSggL1tcXHUwMzAwLVxcdTAzNmZdL2csICcnICk7XHJcblx0XHRcdH1cclxuXHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHR2ID0gdi5yZXBsYWNlKCAvWydcIl0vZywgJycgKTtcclxuXHRcdHYgPSB2LnJlcGxhY2UoIC9bXmEtejAtOV9cXC1cXHNdKy9nLCAnJyApO1xyXG5cdFx0diA9IHYucmVwbGFjZSggL1tcXHNcXC1dKy9nLCAnXycgKTtcclxuXHRcdHYgPSB2LnJlcGxhY2UoIC9fKy9nLCAnXycgKTsgLy8gLnJlcGxhY2UoIC9eXyt8XyskL2csICcnICk7XHJcblx0XHRpZiAoIHYgJiYgL15bMC05XS8udGVzdCggdiApICkge1xyXG5cdFx0XHR2ID0gJ2Zvcm1fJyArIHY7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9zYXZlX3R5cGUoKSB7XHJcblx0XHRjb25zdCBlbCA9IGQucXVlcnlTZWxlY3RvciggJ2lucHV0W25hbWU9XCInICsgTkFNRV9TQVZFX1RZUEUgKyAnXCJdOmNoZWNrZWQnICk7XHJcblx0XHRjb25zdCB2ICA9IGVsID8gU3RyaW5nKCBlbC52YWx1ZSB8fCAnJyApLnRvTG93ZXJDYXNlKCkgOiAncHVibGlzaGVkJztcclxuXHRcdHJldHVybiAoIHYgPT09ICd0ZW1wbGF0ZScgKSA/ICd0ZW1wbGF0ZScgOiAncHVibGlzaGVkJztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlbmRlcl90aHVtYiggdXJsICkge1xyXG5cdFx0Y29uc3QgdGh1bWIgPSBkLnF1ZXJ5U2VsZWN0b3IoIFNFTF9USFVNQiApO1xyXG5cdFx0aWYgKCAhIHRodW1iICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRjb25zdCBzYWZlX3VybCA9IFN0cmluZyggdXJsIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0aWYgKCBzYWZlX3VybCApIHtcclxuXHRcdFx0dGh1bWIuaW5uZXJIVE1MID0gJzxpbWcgc3JjPVwiJyArIHNhZmVfdXJsLnJlcGxhY2UoIC9cIi9nLCAnJnF1b3Q7JyApICsgJ1wiIHN0eWxlPVwid2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtvYmplY3QtZml0OmNvdmVyO1wiIGFsdD1cIlwiIC8+JztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRodW1iLmlubmVySFRNTCA9ICc8c3BhbiBjbGFzcz1cImRlc2NyaXB0aW9uXCIgc3R5bGU9XCJwYWRkaW5nOjZweDt0ZXh0LWFsaWduOmNlbnRlcjtcIj5ObyBJbWFnZTwvc3Bhbj4nO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gY29sbGVjdF9wYXlsb2FkKCkge1xyXG5cdFx0Y29uc3QgdGl0bGVfZWwgPSBnZXRfZWwoIElEX1RJVExFICk7XHJcblx0XHRjb25zdCBzbHVnX2VsICA9IGdldF9lbCggSURfU0xVRyApO1xyXG5cdFx0Y29uc3QgaW1nX2VsICAgPSBnZXRfZWwoIElEX0lNQUdFX1VSTCApO1xyXG5cdFx0Y29uc3QgZGVzY19lbCAgPSBnZXRfZWwoIElEX0RFU0NSSVBUSU9OICk7XHJcblxyXG5cdFx0Y29uc3QgdGl0bGVfcmF3ID0gdGl0bGVfZWwgPyBTdHJpbmcoIHRpdGxlX2VsLnZhbHVlIHx8ICcnICkgOiAnJztcclxuXHRcdGxldCBzbHVnX3JhdyAgICA9IHNsdWdfZWwgPyBTdHJpbmcoIHNsdWdfZWwudmFsdWUgfHwgJycgKSA6ICcnO1xyXG5cdFx0c2x1Z19yYXcgPSBzYW5pdGl6ZV9rZXkoIHNsdWdfcmF3ICk7XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0Zm9ybV90aXRsZSAgICAgIDogU3RyaW5nKCB0aXRsZV9yYXcgKS50cmltKCksXHJcblx0XHRcdGZvcm1fc2x1ZyAgICAgICA6IHNsdWdfcmF3LFxyXG5cdFx0XHRzYXZlX3R5cGUgICAgICAgOiBnZXRfc2F2ZV90eXBlKCksXHJcblx0XHRcdGZvcm1fcGljdHVyZV91cmw6IGltZ19lbCA/IFN0cmluZyggaW1nX2VsLnZhbHVlIHx8ICcnICkudHJpbSgpIDogJycsXHJcblx0XHRcdGZvcm1fZGVzY3JpcHRpb246IGRlc2NfZWwgPyBTdHJpbmcoIGRlc2NfZWwudmFsdWUgfHwgJycgKSA6ICcnXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gdmFsaWRhdGVfcGF5bG9hZCggcGF5bG9hZCApIHtcclxuXHRcdGlmICggISBoYXNfdGV4dCggcGF5bG9hZC5mb3JtX3NsdWcgKSApIHtcclxuXHRcdFx0cmV0dXJuICdQbGVhc2UgZW50ZXIgYSB2YWxpZCBmb3JtIGtleSAoc2x1ZykuJztcclxuXHRcdH1cclxuXHRcdGlmICggJ3N0YW5kYXJkJyA9PT0gU3RyaW5nKCBwYXlsb2FkLmZvcm1fc2x1ZyApICkge1xyXG5cdFx0XHRyZXR1cm4gJ1RoaXMgZm9ybSBrZXkgaXMgcmVzZXJ2ZWQuIFBsZWFzZSBjaG9vc2UgYW5vdGhlci4nO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuICcnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gYnVpbGRfZm9ybV9kZXRhaWxzX2pzb24oIHN0ICkge1xyXG5cdFx0Ly8gSU1QT1JUQU5UOiBkbyBOT1QgaW5jbHVkZSBmb3JtX25hbWUgaGVyZS5cclxuXHRcdGNvbnN0IGRldGFpbHMgPSB7XHJcblx0XHRcdHRpdGxlICAgICAgOiBTdHJpbmcoIHN0LmZvcm1fdGl0bGUgfHwgJycgKSxcclxuXHRcdFx0ZGVzY3JpcHRpb246IFN0cmluZyggc3QuZm9ybV9kZXNjcmlwdGlvbiB8fCAnJyApLFxyXG5cdFx0XHRwaWN0dXJlX3VybDogU3RyaW5nKCBzdC5mb3JtX3BpY3R1cmVfdXJsIHx8ICcnIClcclxuXHRcdH07XHJcblx0XHR0cnkge1xyXG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoIGRldGFpbHMgKTtcclxuXHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0cmV0dXJuICd7XCJ0aXRsZVwiOlwiXCIsXCJkZXNjcmlwdGlvblwiOlwiXCIsXCJwaWN0dXJlX3VybFwiOlwiXCJ9JztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHNldF9wYXlsb2FkX2Zvcl9zYXZlX2FzKCBwYXlsb2FkLCBzdCApIHtcclxuXHRcdGNvbnN0IHNhdmVfdHlwZSA9ICggc3Quc2F2ZV90eXBlID09PSAndGVtcGxhdGUnICkgPyAndGVtcGxhdGUnIDogJ3B1Ymxpc2hlZCc7XHJcblxyXG5cdFx0cGF5bG9hZC5mb3JtX25hbWUgPSBTdHJpbmcoIHN0LnRhcmdldF9mb3JtX25hbWUgKTtcclxuXHJcblx0XHRwYXlsb2FkLmFjdGlvbiA9ICggc2F2ZV90eXBlID09PSAndGVtcGxhdGUnICkgPyBBQ1RJT05fU0FWRV9URU1QTEFURSA6IEFDVElPTl9TQVZFX1BVQkxJU0hFRDtcclxuXHRcdHBheWxvYWQuc3RhdHVzID0gKCBzYXZlX3R5cGUgPT09ICd0ZW1wbGF0ZScgKSA/ICd0ZW1wbGF0ZScgOiAncHVibGlzaGVkJztcclxuXHJcblx0XHQvLyBGb3JjZSBtZXRhIGZyb20gbW9kYWwgKGFsd2F5cyBKU09OIHN0cmluZykuXHJcblx0XHRwYXlsb2FkLmZvcm1fZGV0YWlscyA9IGJ1aWxkX2Zvcm1fZGV0YWlsc19qc29uKCBzdCApO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBDYWNoZSBjdXJyZW50IGZvcm0gbWV0YSBvbiBsb2FkIChzbyBtb2RhbCBjYW4gcHJlZmlsbCBpbWFnZS9kZXNjKS5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGlmICggISBkLl9fd3BiY19iZmJfc2F2ZV9hc19tZXRhX2NhY2hlX2JvdW5kICkge1xyXG5cdFx0ZC5fX3dwYmNfYmZiX3NhdmVfYXNfbWV0YV9jYWNoZV9ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Zm9ybTphamF4X2xvYWRlZCcsIGZ1bmN0aW9uICggZSApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBjZmcgPSBnZXRfY2ZnKCk7XHJcblx0XHRcdFx0Y29uc3QgZGV0YWlsID0gZSAmJiBlLmRldGFpbCA/IGUuZGV0YWlsIDogbnVsbDtcclxuXHRcdFx0XHRjb25zdCBkYXRhID0gZGV0YWlsICYmIGRldGFpbC5sb2FkZWRfZGF0YSA/IGRldGFpbC5sb2FkZWRfZGF0YSA6IG51bGw7XHJcblx0XHRcdFx0aWYgKCAhIGRhdGEgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGNmZy5fX3dwYmNfYmZiX2Zvcm1fbWV0YV9jYWNoZSA9IGNmZy5fX3dwYmNfYmZiX2Zvcm1fbWV0YV9jYWNoZSB8fCB7fTtcclxuXHRcdFx0XHRjZmcuX193cGJjX2JmYl9mb3JtX21ldGFfY2FjaGUudGl0bGUgICAgICAgPSBkYXRhLnRpdGxlID8gU3RyaW5nKCBkYXRhLnRpdGxlICkgOiAnJztcclxuXHRcdFx0XHRjZmcuX193cGJjX2JmYl9mb3JtX21ldGFfY2FjaGUuZGVzY3JpcHRpb24gPSBkYXRhLmRlc2NyaXB0aW9uID8gU3RyaW5nKCBkYXRhLmRlc2NyaXB0aW9uICkgOiAnJztcclxuXHRcdFx0XHRjZmcuX193cGJjX2JmYl9mb3JtX21ldGFfY2FjaGUucGljdHVyZV91cmwgPSBkYXRhLnBpY3R1cmVfdXJsID8gU3RyaW5nKCBkYXRhLnBpY3R1cmVfdXJsICkgOiAnJztcclxuXHRcdFx0fSBjYXRjaCAoIF9lMCApIHt9XHJcblx0XHR9LCB0cnVlICk7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFBhdGNoIG91dGdvaW5nIHNhdmUgcGF5bG9hZCAoaG9vayArIGxhc3QtY2hhbmNlIHByZWZpbHRlcilcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGlmICggISBkLl9fd3BiY19iZmJfc2F2ZV9hc19iZWZvcmVfc2F2ZV9ib3VuZCApIHtcclxuXHRcdGQuX193cGJjX2JmYl9zYXZlX2FzX2JlZm9yZV9zYXZlX2JvdW5kID0gdHJ1ZTtcclxuXHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjOmJmYjpmb3JtOmJlZm9yZV9zYXZlX3BheWxvYWQnLCBmdW5jdGlvbiAoIGUgKSB7XHJcblxyXG5cdFx0XHRjb25zdCBzdCA9IGdldF9zdGF0ZSgpO1xyXG5cdFx0XHRpZiAoICEgc3QuaXNfYWN0aXZlIHx8ICEgc3QudGFyZ2V0X2Zvcm1fbmFtZSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGRldGFpbCA9IGUgJiYgZS5kZXRhaWwgPyBlLmRldGFpbCA6IG51bGw7XHJcblx0XHRcdGlmICggISBkZXRhaWwgfHwgISBkZXRhaWwucGF5bG9hZCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNldF9wYXlsb2FkX2Zvcl9zYXZlX2FzKCBkZXRhaWwucGF5bG9hZCwgc3QgKTtcclxuXHJcblx0XHR9LCB0cnVlICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHcualF1ZXJ5ICYmICEgdy5XUEJDX0JGQl9TYXZlX0FzLl9fYWpheF9wcmVmaWx0ZXJfYm91bmQgKSB7XHJcblx0XHR3LldQQkNfQkZCX1NhdmVfQXMuX19hamF4X3ByZWZpbHRlcl9ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0ZnVuY3Rpb24gc3RyaXBfbmFtZV9wYXJhbXNfZnJvbV91cmxzZWFyY2hwYXJhbXMocCkge1xyXG5cdFx0XHQvLyBSZW1vdmUgcG90ZW50aWFsIG5lc3RlZCBhcnJheSBzZXJpYWxpemF0aW9uIHZhcmlhbnRzOlxyXG5cdFx0XHQvLyBmb3JtX2RldGFpbHNbZm9ybV9uYW1lXT1zdGFuZGFyZCBldGMuXHJcblx0XHRcdGNvbnN0IGtleXNfdG9fZGVsZXRlID0gW1xyXG5cdFx0XHRcdCdmb3JtX2RldGFpbHNbZm9ybV9uYW1lXScsXHJcblx0XHRcdFx0J2Zvcm1fZGV0YWlsc1tmb3JtX3NsdWddJyxcclxuXHRcdFx0XHQnZm9ybV9kZXRhaWxzW3NsdWddJyxcclxuXHRcdFx0XHQnZm9ybV9kZXRhaWxzW2tleV0nLFxyXG5cdFx0XHRcdCdmb3JtX25hbWVfaW5fZGV0YWlscycsXHJcblx0XHRcdFx0J2Zvcm1fZGV0YWlsc19mb3JtX25hbWUnXHJcblx0XHRcdF07XHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IGtleXNfdG9fZGVsZXRlLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdHRyeSB7IHAuZGVsZXRlKCBrZXlzX3RvX2RlbGV0ZVtpXSApOyB9IGNhdGNoICggX2UgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0ZnVuY3Rpb24gc3RyaXBfbmFtZV9maWVsZHNfZnJvbV9mb3JtZGF0YShmZCkge1xyXG5cdFx0XHRjb25zdCBrZXlzX3RvX2RlbGV0ZSA9IFtcclxuXHRcdFx0XHQnZm9ybV9kZXRhaWxzW2Zvcm1fbmFtZV0nLFxyXG5cdFx0XHRcdCdmb3JtX2RldGFpbHNbZm9ybV9zbHVnXScsXHJcblx0XHRcdFx0J2Zvcm1fZGV0YWlsc1tzbHVnXScsXHJcblx0XHRcdFx0J2Zvcm1fZGV0YWlsc1trZXldJyxcclxuXHRcdFx0XHQnZm9ybV9uYW1lX2luX2RldGFpbHMnLFxyXG5cdFx0XHRcdCdmb3JtX2RldGFpbHNfZm9ybV9uYW1lJ1xyXG5cdFx0XHRdO1xyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBrZXlzX3RvX2RlbGV0ZS5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHR0cnkgeyBmZC5kZWxldGUoIGtleXNfdG9fZGVsZXRlW2ldICk7IH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHR3LmpRdWVyeS5hamF4UHJlZmlsdGVyKCBmdW5jdGlvbiAoIG9wdGlvbnMsIG9yaWdpbmFsX29wdGlvbnMgKSB7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGNvbnN0IHN0ID0gZ2V0X3N0YXRlKCk7XHJcblx0XHRcdFx0aWYgKCAhIHN0IHx8ICEgc3QuaXNfYWN0aXZlIHx8ICEgc3QudGFyZ2V0X2Zvcm1fbmFtZSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IGRhdGEgPSAoIG9wdGlvbnMgJiYgb3B0aW9ucy5kYXRhICE9PSB1bmRlZmluZWQgKVxyXG5cdFx0XHRcdFx0PyBvcHRpb25zLmRhdGFcclxuXHRcdFx0XHRcdDogKCBvcmlnaW5hbF9vcHRpb25zID8gb3JpZ2luYWxfb3B0aW9ucy5kYXRhIDogbnVsbCApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgZGF0YSApIHtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9ICggc3Quc2F2ZV90eXBlID09PSAndGVtcGxhdGUnICkgPyBBQ1RJT05fU0FWRV9URU1QTEFURSA6IEFDVElPTl9TQVZFX1BVQkxJU0hFRDtcclxuXHRcdFx0XHRjb25zdCBzdGF0dXMgPSAoIHN0LnNhdmVfdHlwZSA9PT0gJ3RlbXBsYXRlJyApID8gJ3RlbXBsYXRlJyA6ICdwdWJsaXNoZWQnO1xyXG5cdFx0XHRcdGNvbnN0IHRhcmdldCA9IFN0cmluZyggc3QudGFyZ2V0X2Zvcm1fbmFtZSApO1xyXG5cclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHQvLyAxKSBPYmplY3QgcGF5bG9hZCAoY2xhc3NpYyBqUXVlcnkgc3R5bGUpXHJcblx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcgJiYgISAoIHcuRm9ybURhdGEgJiYgZGF0YSBpbnN0YW5jZW9mIHcuRm9ybURhdGEgKSApIHtcclxuXHJcblx0XHRcdFx0XHRjb25zdCBhID0gU3RyaW5nKCBkYXRhLmFjdGlvbiB8fCAnJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBhICE9PSBBQ1RJT05fU0FWRV9QVUJMSVNIRUQgJiYgYSAhPT0gQUNUSU9OX1NBVkVfVEVNUExBVEUgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjsgLy8gZG8gbm90IHRvdWNoIHVucmVsYXRlZCByZXF1ZXN0c1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGRhdGEuYWN0aW9uICAgID0gYWN0aW9uO1xyXG5cdFx0XHRcdFx0ZGF0YS5zdGF0dXMgICAgPSBzdGF0dXM7XHJcblx0XHRcdFx0XHRkYXRhLmZvcm1fbmFtZSA9IHRhcmdldDtcclxuXHJcblx0XHRcdFx0XHQvLyBJTVBPUlRBTlQ6IGZvcmNlIEpTT04gc3RyaW5nOyBkbyBOT1QgYWxsb3cgbmVzdGVkIGZvcm1fZGV0YWlsc1suLi5dIGtleXMuXHJcblx0XHRcdFx0XHRkYXRhLmZvcm1fZGV0YWlscyA9IGJ1aWxkX2Zvcm1fZGV0YWlsc19qc29uKCBzdCApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFsc28gd2lwZSBhbnkgcG9zc2libGUgaGVscGVyIGtleXMgaWYgc29tZSBtb2R1bGUgYWRkcyB0aGVtLlxyXG5cdFx0XHRcdFx0dHJ5IHsgZGVsZXRlIGRhdGEuZm9ybV9kZXRhaWxzX2Zvcm1fbmFtZTsgfSBjYXRjaCAoIF9lMSApIHt9XHJcblx0XHRcdFx0XHR0cnkgeyBkZWxldGUgZGF0YS5mb3JtX25hbWVfaW5fZGV0YWlsczsgfSBjYXRjaCAoIF9lMiApIHt9XHJcblxyXG5cdFx0XHRcdFx0b3B0aW9ucy5kYXRhID0gZGF0YTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdC8vIDIpIEZvcm1EYXRhIHBheWxvYWQgKHNvbWUgc2F2ZSBoZWxwZXJzIHVzZSBpdClcclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRpZiAoIHcuRm9ybURhdGEgJiYgZGF0YSBpbnN0YW5jZW9mIHcuRm9ybURhdGEgKSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gYmVzdCBlZmZvcnQ6IG9ubHkgaWYgaXQncyBhIHNhdmUgcmVxdWVzdFxyXG5cdFx0XHRcdFx0Y29uc3QgYSA9IFN0cmluZyggZGF0YS5nZXQgPyAoZGF0YS5nZXQoJ2FjdGlvbicpIHx8ICcnKSA6ICcnICk7XHJcblx0XHRcdFx0XHRpZiAoIGEgIT09IEFDVElPTl9TQVZFX1BVQkxJU0hFRCAmJiBhICE9PSBBQ1RJT05fU0FWRV9URU1QTEFURSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHN0cmlwX25hbWVfZmllbGRzX2Zyb21fZm9ybWRhdGEoIGRhdGEgKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIGRhdGEuc2V0ICkge1xyXG5cdFx0XHRcdFx0XHRkYXRhLnNldCggJ2FjdGlvbicsIGFjdGlvbiApO1xyXG5cdFx0XHRcdFx0XHRkYXRhLnNldCggJ3N0YXR1cycsIHN0YXR1cyApO1xyXG5cdFx0XHRcdFx0XHRkYXRhLnNldCggJ2Zvcm1fbmFtZScsIHRhcmdldCApO1xyXG5cdFx0XHRcdFx0XHRkYXRhLnNldCggJ2Zvcm1fZGV0YWlscycsIGJ1aWxkX2Zvcm1fZGV0YWlsc19qc29uKCBzdCApICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHQvLyBmYWxsYmFjayBpZiBubyAuc2V0KClcclxuXHRcdFx0XHRcdFx0ZGF0YS5hcHBlbmQoICdhY3Rpb24nLCBhY3Rpb24gKTtcclxuXHRcdFx0XHRcdFx0ZGF0YS5hcHBlbmQoICdzdGF0dXMnLCBzdGF0dXMgKTtcclxuXHRcdFx0XHRcdFx0ZGF0YS5hcHBlbmQoICdmb3JtX25hbWUnLCB0YXJnZXQgKTtcclxuXHRcdFx0XHRcdFx0ZGF0YS5hcHBlbmQoICdmb3JtX2RldGFpbHMnLCBidWlsZF9mb3JtX2RldGFpbHNfanNvbiggc3QgKSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdG9wdGlvbnMuZGF0YSA9IGRhdGE7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHQvLyAzKSBTdHJpbmcgcGF5bG9hZCAoVVJMLWVuY29kZWQpICA8PDwgVEhJUyB3YXMgbWlzc2luZyBpbiB5b3VyIGN1cnJlbnQgY29kZVxyXG5cdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnICYmIHcuVVJMU2VhcmNoUGFyYW1zICkge1xyXG5cclxuXHRcdFx0XHRcdGNvbnN0IHAgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCBkYXRhICk7XHJcblx0XHRcdFx0XHRjb25zdCBhID0gU3RyaW5nKCBwLmdldCggJ2FjdGlvbicgKSB8fCAnJyApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggYSAhPT0gQUNUSU9OX1NBVkVfUFVCTElTSEVEICYmIGEgIT09IEFDVElPTl9TQVZFX1RFTVBMQVRFICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gS2lsbCBhbnkgbmVzdGVkIG5hbWUga2V5cyB0aGF0IFBIUCB3b3VsZCBpbnRlcnByZXQgYXMgZm9ybV9kZXRhaWxzWydmb3JtX25hbWUnXS5cclxuXHRcdFx0XHRcdHN0cmlwX25hbWVfcGFyYW1zX2Zyb21fdXJsc2VhcmNocGFyYW1zKCBwICk7XHJcblxyXG5cdFx0XHRcdFx0cC5zZXQoICdhY3Rpb24nLCBhY3Rpb24gKTtcclxuXHRcdFx0XHRcdHAuc2V0KCAnc3RhdHVzJywgc3RhdHVzICk7XHJcblx0XHRcdFx0XHRwLnNldCggJ2Zvcm1fbmFtZScsIHRhcmdldCApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEZvcmNlIEpTT04gc3RyaW5nIChOTyBmb3JtX25hbWUgaW5zaWRlKS5cclxuXHRcdFx0XHRcdHAuc2V0KCAnZm9ybV9kZXRhaWxzJywgYnVpbGRfZm9ybV9kZXRhaWxzX2pzb24oIHN0ICkgKTtcclxuXHJcblx0XHRcdFx0XHRvcHRpb25zLmRhdGEgPSBwLnRvU3RyaW5nKCk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge31cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTW9kYWw6IG9wZW4gKyBiaW5kXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0ZnVuY3Rpb24gYmluZF9tb2RhbF9oYW5kbGVyc19vbmNlKCBtb2RhbF9lbCApIHtcclxuXHRcdGlmICggISBtb2RhbF9lbCB8fCBtb2RhbF9lbC5fX3dwYmNfYmZiX2hhbmRsZXJzX2JvdW5kICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2hhbmRsZXJzX2JvdW5kID0gdHJ1ZTtcclxuXHJcblx0XHRjb25zdCB0aXRsZV9lbCA9IGdldF9lbCggSURfVElUTEUgKTtcclxuXHRcdGNvbnN0IHNsdWdfZWwgID0gZ2V0X2VsKCBJRF9TTFVHICk7XHJcblx0XHRjb25zdCBpbWdfZWwgICA9IGdldF9lbCggSURfSU1BR0VfVVJMICk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gdXBkYXRlX2NvbmZpcm1fc3RhdGUoKSB7XHJcblx0XHRcdGNvbnN0IHAgPSBjb2xsZWN0X3BheWxvYWQoKTtcclxuXHRcdFx0Y29uc3QgZXJyID0gdmFsaWRhdGVfcGF5bG9hZCggcCApO1xyXG5cdFx0XHRzZXRfZXJyb3IoICcnICk7XHJcblx0XHRcdHNldF9jb25maXJtX2VuYWJsZWQoICEgZXJyICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB0aXRsZV9lbCApIHtcclxuXHRcdFx0dGl0bGVfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdC8vIG9ubHkgYXV0by1zdWdnZXN0IHNsdWcgaWYgdXNlciBkaWQgbm90IHRvdWNoIHNsdWcgbWFudWFsbHkuXHJcblx0XHRcdFx0aWYgKCBzbHVnX2VsICYmICEgbW9kYWxfZWwuX193cGJjX2JmYl9tYW51YWxfc2x1ZyApIHtcclxuXHRcdFx0XHRcdGNvbnN0IGF1dG9fc2x1ZyA9IHNsdWdpZnlfdG9fa2V5KCB0aXRsZV9lbC52YWx1ZSB8fCAnJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBhdXRvX3NsdWcgKSB7XHJcblx0XHRcdFx0XHRcdHNsdWdfZWwudmFsdWUgPSBhdXRvX3NsdWc7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHVwZGF0ZV9jb25maXJtX3N0YXRlKCk7XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHNsdWdfZWwgKSB7XHJcblx0XHRcdHNsdWdfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfbWFudWFsX3NsdWcgPSB0cnVlO1xyXG5cclxuXHRcdFx0XHRjb25zdCBzYW5pdGl6ZWQgPSBzYW5pdGl6ZV9rZXkoIHNsdWdfZWwudmFsdWUgfHwgJycgKTtcclxuXHRcdFx0XHRpZiAoIHNhbml0aXplZCAhPT0gc2x1Z19lbC52YWx1ZSApIHtcclxuXHRcdFx0XHRcdHNsdWdfZWwudmFsdWUgPSBzYW5pdGl6ZWQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHVwZGF0ZV9jb25maXJtX3N0YXRlKCk7XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBTYXZlIHR5cGUgY2hhbmdlOiBkb2VzIG5vdCBhZmZlY3QgdmFsaWRhdGlvbiwgYnV0IGtlZXAgVUkgY29uc2lzdGVudC5cclxuXHRcdG1vZGFsX2VsLmFkZEV2ZW50TGlzdGVuZXIoICdjaGFuZ2UnLCBmdW5jdGlvbiAoIGUgKSB7XHJcblx0XHRcdGlmICggZSAmJiBlLnRhcmdldCAmJiBlLnRhcmdldC5uYW1lID09PSBOQU1FX1NBVkVfVFlQRSApIHtcclxuXHRcdFx0XHR1cGRhdGVfY29uZmlybV9zdGF0ZSgpO1xyXG5cdFx0XHR9XHJcblx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0Ly8gSW1hZ2UgdGh1bWIgdXBkYXRlcyAoc2FtZSBhcHByb2FjaCBhcyBBZGQgTmV3IEZvcm0pLlxyXG5cdFx0aWYgKCBpbWdfZWwgKSB7XHJcblx0XHRcdGNvbnN0IHVwZGF0ZV90aHVtYiA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRyZW5kZXJfdGh1bWIoIGltZ19lbC52YWx1ZSB8fCAnJyApO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0aWYgKCB3LmpRdWVyeSApIHtcclxuXHRcdFx0XHR3LmpRdWVyeSggaW1nX2VsIClcclxuXHRcdFx0XHRcdC5vZmYoICd3cGJjX21lZGlhX3VwbG9hZF91cmxfc2V0LndwYmNCZmJTYXZlQXNGb3JtJyApXHJcblx0XHRcdFx0XHQub24oICd3cGJjX21lZGlhX3VwbG9hZF91cmxfc2V0LndwYmNCZmJTYXZlQXNGb3JtJywgdXBkYXRlX3RodW1iICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGltZ19lbC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19tZWRpYV91cGxvYWRfdXJsX3NldCcsIHVwZGF0ZV90aHVtYiwgdHJ1ZSApO1xyXG5cdFx0XHRpbWdfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgdXBkYXRlX3RodW1iLCB0cnVlICk7XHJcblx0XHRcdGltZ19lbC5hZGRFdmVudExpc3RlbmVyKCAnY2hhbmdlJywgdXBkYXRlX3RodW1iLCB0cnVlICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQ2xlYXIgaW1hZ2UuXHJcblx0XHRtb2RhbF9lbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGUgKSB7XHJcblx0XHRcdGlmICggISBlIHx8ICEgZS50YXJnZXQgfHwgISBlLnRhcmdldC5jbG9zZXN0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBidG4gPSBlLnRhcmdldC5jbG9zZXN0KCBTRUxfQ0xFQVJfSU1BR0UgKTtcclxuXHRcdFx0aWYgKCAhIGJ0biApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0Y29uc3QgaW1nID0gZ2V0X2VsKCBJRF9JTUFHRV9VUkwgKTtcclxuXHRcdFx0aWYgKCBpbWcgKSB7XHJcblx0XHRcdFx0aW1nLnZhbHVlID0gJyc7XHJcblx0XHRcdFx0cmVuZGVyX3RodW1iKCAnJyApO1xyXG5cclxuXHRcdFx0XHQvLyBrZWVwIGJlaGF2aW9yIGNvbnNpc3RlbnQgd2l0aCB1cGxvYWRlciBsaXN0ZW5lcnNcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0Y29uc3QgZXYgPSBuZXcgRXZlbnQoICd3cGJjX21lZGlhX3VwbG9hZF91cmxfc2V0JyApO1xyXG5cdFx0XHRcdFx0aW1nLmRpc3BhdGNoRXZlbnQoIGV2ICk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIF9lMCApIHt9XHJcblx0XHRcdH1cclxuXHRcdH0sIHRydWUgKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHJlc2V0X21vZGFsX3N0YXRlKCBtb2RhbF9lbCApIHtcclxuXHJcblx0XHRjb25zdCB0aXRsZV9lbCA9IGdldF9lbCggSURfVElUTEUgKTtcclxuXHRcdGNvbnN0IHNsdWdfZWwgID0gZ2V0X2VsKCBJRF9TTFVHICk7XHJcblx0XHRjb25zdCBpbWdfZWwgICA9IGdldF9lbCggSURfSU1BR0VfVVJMICk7XHJcblx0XHRjb25zdCBkZXNjX2VsICA9IGdldF9lbCggSURfREVTQ1JJUFRJT04gKTtcclxuXHJcblx0XHRpZiAoIHRpdGxlX2VsICkgdGl0bGVfZWwudmFsdWUgPSAnJztcclxuXHRcdGlmICggc2x1Z19lbCApICBzbHVnX2VsLnZhbHVlICA9ICcnO1xyXG5cdFx0aWYgKCBpbWdfZWwgKSAgIGltZ19lbC52YWx1ZSAgID0gJyc7XHJcblx0XHRpZiAoIGRlc2NfZWwgKSAgZGVzY19lbC52YWx1ZSAgPSAnJztcclxuXHJcblx0XHRjb25zdCBwdWJsaXNoZWRfcmFkaW8gPSBkLnF1ZXJ5U2VsZWN0b3IoICdpbnB1dFtuYW1lPVwiJyArIE5BTUVfU0FWRV9UWVBFICsgJ1wiXVt2YWx1ZT1cInB1Ymxpc2hlZFwiXScgKTtcclxuXHRcdGlmICggcHVibGlzaGVkX3JhZGlvICkge1xyXG5cdFx0XHRwdWJsaXNoZWRfcmFkaW8uY2hlY2tlZCA9IHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBtb2RhbF9lbCApIHtcclxuXHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9tYW51YWxfc2x1ZyA9IGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJlbmRlcl90aHVtYiggJycgKTtcclxuXHRcdHNldF9lcnJvciggJycgKTtcclxuXHRcdHNldF9jb25maXJtX2VuYWJsZWQoIGZhbHNlICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBwcmVmaWxsX2Zyb21fY2FjaGUoKSB7XHJcblx0XHRjb25zdCBtZXRhID0gZ2V0X2NhY2hlZF9tZXRhKCk7XHJcblxyXG5cdFx0Y29uc3QgdGl0bGVfZWwgPSBnZXRfZWwoIElEX1RJVExFICk7XHJcblx0XHRjb25zdCBpbWdfZWwgICA9IGdldF9lbCggSURfSU1BR0VfVVJMICk7XHJcblx0XHRjb25zdCBkZXNjX2VsICA9IGdldF9lbCggSURfREVTQ1JJUFRJT04gKTtcclxuXHJcblx0XHQvLyBGaWxsIG9ubHkgaWYgZW1wdHkgKHNvIHJlLW9wZW4gYWZ0ZXIgY2FuY2VsIGtlZXBzIGxhdGVzdCBjYWNoZSkuXHJcblx0XHRpZiAoIHRpdGxlX2VsICYmICEgaGFzX3RleHQoIHRpdGxlX2VsLnZhbHVlICkgJiYgaGFzX3RleHQoIG1ldGEudGl0bGUgKSApIHtcclxuXHRcdFx0dGl0bGVfZWwudmFsdWUgPSBTdHJpbmcoIG1ldGEudGl0bGUgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaW1nX2VsICYmICEgaGFzX3RleHQoIGltZ19lbC52YWx1ZSApICYmIGhhc190ZXh0KCBtZXRhLnBpY3R1cmVfdXJsICkgKSB7XHJcblx0XHRcdGltZ19lbC52YWx1ZSA9IFN0cmluZyggbWV0YS5waWN0dXJlX3VybCApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBkZXNjX2VsICYmICEgaGFzX3RleHQoIGRlc2NfZWwudmFsdWUgKSAmJiBoYXNfdGV4dCggbWV0YS5kZXNjcmlwdGlvbiApICkge1xyXG5cdFx0XHRkZXNjX2VsLnZhbHVlID0gU3RyaW5nKCBtZXRhLmRlc2NyaXB0aW9uICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmVuZGVyX3RodW1iKCBpbWdfZWwgPyBpbWdfZWwudmFsdWUgOiAnJyApO1xyXG5cdH1cclxuXHJcblx0VUkuTW9kYWxfU2F2ZV9Bc19Gb3JtLm9wZW4gPSBmdW5jdGlvbiAoIG9uX2NvbmZpcm0sIG9uX29wZW4gKSB7XHJcblxyXG5cdFx0Y29uc3QgcmVmID0gVUkuVGVtcGxhdGVzLmVuc3VyZV9kb21fcmVmX2Zyb21fd3BfdGVtcGxhdGUoIFRQTF9NT0RBTF9JRCwgTU9EQUxfRE9NX0lEICk7XHJcblx0XHRpZiAoICEgcmVmIHx8ICEgcmVmLmVsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IG1vZGFsX2VsID0gcmVmLmVsO1xyXG5cclxuXHRcdGlmICggbW9kYWxfZWwgJiYgbW9kYWxfZWwuaWQgIT09IE1PREFMX0RPTV9JRCApIHtcclxuXHRcdFx0Y29uc3QgaW5zaWRlID0gbW9kYWxfZWwucXVlcnlTZWxlY3RvciA/IG1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IoICcjJyArIE1PREFMX0RPTV9JRCApIDogbnVsbDtcclxuXHRcdFx0aWYgKCBpbnNpZGUgKSB7XHJcblx0XHRcdFx0bW9kYWxfZWwgPSBpbnNpZGU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdGlmICggISBtb2RhbF9lbCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBkLmJvZHkuY29udGFpbnMoIG1vZGFsX2VsICkgKSB7XHJcblx0XHRcdHRyeSB7IGQuYm9keS5hcHBlbmRDaGlsZCggbW9kYWxfZWwgKTsgfSBjYXRjaCAoIF9lMCApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0bW9kYWxfZWwuX193cGJjX2JmYl9zYXZlX2FzX2NiID0gKCB0eXBlb2Ygb25fY29uZmlybSA9PT0gJ2Z1bmN0aW9uJyApID8gb25fY29uZmlybSA6IG51bGw7XHJcblxyXG5cdFx0YmluZF9tb2RhbF9oYW5kbGVyc19vbmNlKCBtb2RhbF9lbCApO1xyXG5cdFx0cmVzZXRfbW9kYWxfc3RhdGUoIG1vZGFsX2VsICk7XHJcblx0XHRwcmVmaWxsX2Zyb21fY2FjaGUoKTtcclxuXHJcblx0XHRzaG93X21vZGFsKCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdC8vIEJpbmQgbWVkaWEgdXBsb2FkIGJ1dHRvbiBjbGljayBpbnNpZGUgdGhpcyBtb2RhbCAoc2FtZSBhcyBBZGQgTmV3IEZvcm0pLlxyXG5cdFx0aWYgKCB3LmpRdWVyeSApIHtcclxuXHRcdFx0dy5qUXVlcnkoIG1vZGFsX2VsIClcclxuXHRcdFx0XHQub2ZmKCAnY2xpY2sud3BiY01lZGlhU2F2ZUFzJywgJy53cGJjX21lZGlhX3VwbG9hZF9idXR0b24nIClcclxuXHRcdFx0XHQub24oICdjbGljay53cGJjTWVkaWFTYXZlQXMnLCAnLndwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbicsIGZ1bmN0aW9uICggZXZlbnQgKSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gVXNlIHNhZmUgdHlwZW9mIGNoZWNrIChhdm9pZHMgUmVmZXJlbmNlRXJyb3IpLlxyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX21lZGlhX3VwbG9hZF9idXR0b25fY2xpY2tlZCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0dy53cGJjX21lZGlhX3VwbG9hZF9idXR0b25fY2xpY2tlZCggdGhpcywgZXZlbnQgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoIHR5cGVvZiB3cGJjX21lZGlhX3VwbG9hZF9idXR0b25fY2xpY2tlZCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0d3BiY19tZWRpYV91cGxvYWRfYnV0dG9uX2NsaWNrZWQoIHRoaXMsIGV2ZW50ICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0ICAgYWxlcnQoJ1dhcm5pbmchIFRoaXMgZmVhdHVyZSBpcyByZXN0cmljdGVkIGluIHRoZSBwdWJsaWMgbGl2ZSBkZW1vLicgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0XHQvLyBBbHNvIG9wZW4gbWVkaWEgbW9kYWwgd2hlbiBjbGlja2luZyBvbiB0aGUgdGh1bWJuYWlsIHByZXZpZXcuXHJcblx0XHRpZiAoIHcualF1ZXJ5ICkge1xyXG5cdFx0XHR3LmpRdWVyeSggbW9kYWxfZWwgKVxyXG5cdFx0XHQgLm9mZiggJ2NsaWNrLndwYmNNZWRpYVNhdmVBc1RodW1iJywgJ1tkYXRhLXdwYmMtYmZiLW9wZW4tbWVkaWE9XCIxXCJdJyApXHJcblx0XHRcdCAub24oICdjbGljay53cGJjTWVkaWFTYXZlQXNUaHVtYicsICdbZGF0YS13cGJjLWJmYi1vcGVuLW1lZGlhPVwiMVwiXScsIGZ1bmN0aW9uIChldmVudCkge1xyXG5cclxuXHRcdFx0XHQgLy8gRmluZCB0aGUgXCJTZWxlY3QgSW1hZ2VcIiBidXR0b24gaW5zaWRlIHRoZSBzYW1lIG1vZGFsIGFuZCB0cmlnZ2VyIHVwbG9hZGVyIG9uIGl0LlxyXG5cdFx0XHRcdCBjb25zdCBidG4gPSBtb2RhbF9lbC5xdWVyeVNlbGVjdG9yID8gbW9kYWxfZWwucXVlcnlTZWxlY3RvciggJy53cGJjX21lZGlhX3VwbG9hZF9idXR0b24nICkgOiBudWxsO1xyXG5cdFx0XHRcdCBpZiAoICEgYnRuICkge1xyXG5cdFx0XHRcdFx0IHJldHVybjtcclxuXHRcdFx0XHQgfVxyXG5cclxuXHRcdFx0XHQgLy8gVXNlIHNhZmUgdHlwZW9mIGNoZWNrIChhdm9pZHMgUmVmZXJlbmNlRXJyb3IpLlxyXG5cdFx0XHRcdCBpZiAoIHR5cGVvZiB3LndwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbl9jbGlja2VkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0IHcud3BiY19tZWRpYV91cGxvYWRfYnV0dG9uX2NsaWNrZWQoIGJ0biwgZXZlbnQgKTtcclxuXHRcdFx0XHQgfSBlbHNlIGlmICggdHlwZW9mIHdwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbl9jbGlja2VkID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0IHdwYmNfbWVkaWFfdXBsb2FkX2J1dHRvbl9jbGlja2VkKCBidG4sIGV2ZW50ICk7XHJcblx0XHRcdFx0IH0gZWxzZSB7XHJcblx0XHRcdFx0ICAgYWxlcnQoJ1dhcm5pbmchIFRoaXMgZmVhdHVyZSBpcyByZXN0cmljdGVkIGluIHRoZSBwdWJsaWMgbGl2ZSBkZW1vLicgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdCB9ICk7XHJcblx0XHR9XHJcblx0XHQvLyBGb2N1cyBzbHVnIGlucHV0LlxyXG5cdFx0dy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGNvbnN0IHNsdWdfZWwgPSBnZXRfZWwoIElEX1NMVUcgKTtcclxuXHRcdFx0aWYgKCBzbHVnX2VsICYmIHNsdWdfZWwuZm9jdXMgKSB7XHJcblx0XHRcdFx0dHJ5IHsgc2x1Z19lbC5mb2N1cygpOyB9IGNhdGNoICggX2UxICkge31cclxuXHRcdFx0XHR0cnkgeyBzbHVnX2VsLnNlbGVjdCgpOyB9IGNhdGNoICggX2UyICkge31cclxuXHRcdFx0fVxyXG5cdFx0fSwgMCApO1xyXG5cclxuXHRcdGlmICggdHlwZW9mIG9uX29wZW4gPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHRyeSB7IG9uX29wZW4oIG1vZGFsX2VsICk7IH0gY2F0Y2ggKCBfZTMgKSB7fVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIENvbmZpcm0gLyBDYW5jZWwgKGRlbGVnYXRlZCkuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoIGUgKSB7XHJcblxyXG5cdFx0Y29uc3QgbW9kYWxfZWwgPSBkLmdldEVsZW1lbnRCeUlkKCBNT0RBTF9ET01fSUQgKTtcclxuXHRcdGlmICggISBtb2RhbF9lbCB8fCAhIGUgfHwgISBlLnRhcmdldCB8fCAhIGUudGFyZ2V0LmNsb3Nlc3QgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBpc19jb25maXJtID0gZS50YXJnZXQuY2xvc2VzdCggU0VMX0NPTkZJUk0gKTtcclxuXHRcdGlmICggaXNfY29uZmlybSApIHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0aWYgKCBpc19jb25maXJtLmNsYXNzTGlzdC5jb250YWlucyggJ2Rpc2FibGVkJyApIHx8IGlzX2NvbmZpcm0uZ2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKSA9PT0gJ3RydWUnICkge1xyXG5cdFx0XHRcdGNvbnN0IHAwID0gY29sbGVjdF9wYXlsb2FkKCk7XHJcblx0XHRcdFx0Y29uc3QgZXJyMCA9IHZhbGlkYXRlX3BheWxvYWQoIHAwICk7XHJcblx0XHRcdFx0aWYgKCBlcnIwICkge1xyXG5cdFx0XHRcdFx0c2V0X2Vycm9yKCBlcnIwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgcGF5bG9hZCA9IGNvbGxlY3RfcGF5bG9hZCgpO1xyXG5cdFx0XHRjb25zdCBlcnIgPSB2YWxpZGF0ZV9wYXlsb2FkKCBwYXlsb2FkICk7XHJcblx0XHRcdGlmICggZXJyICkge1xyXG5cdFx0XHRcdHNldF9lcnJvciggZXJyICk7XHJcblx0XHRcdFx0c2V0X2NvbmZpcm1fZW5hYmxlZCggZmFsc2UgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNldF9lcnJvciggJycgKTtcclxuXHJcblx0XHRcdGNvbnN0IGNiID0gbW9kYWxfZWwuX193cGJjX2JmYl9zYXZlX2FzX2NiIHx8IG51bGw7XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfc2F2ZV9hc19jYiA9IG51bGw7XHJcblxyXG5cdFx0XHRoaWRlX21vZGFsKCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdFx0aWYgKCBjYiApIHtcclxuXHRcdFx0XHR0cnkgeyBjYiggcGF5bG9hZCApOyB9IGNhdGNoICggX2U0ICkge31cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgaXNfY2FuY2VsID0gZS50YXJnZXQuY2xvc2VzdCggU0VMX0NBTkNFTCApO1xyXG5cdFx0aWYgKCBpc19jYW5jZWwgKSB7XHJcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9zYXZlX2FzX2NiID0gbnVsbDtcclxuXHRcdFx0aGlkZV9tb2RhbCggbW9kYWxfZWwgKTtcclxuXHRcdH1cclxuXHJcblx0fSwgdHJ1ZSApO1xyXG5cclxufSggd2luZG93LCBkb2N1bWVudCApKTtcclxuXHJcblxyXG4vKipcclxuICogTWVudSBoYW5kbGVyOiBcIlNhdmUgQXMuLi5cIlxyXG4gKlxyXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBtZW51X29wdGlvbl90aGlzXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2JmYl9fbWVudV9mb3Jtc19fc2F2ZV9hcyggbWVudV9vcHRpb25fdGhpcyApIHtcclxuXHJcblx0dmFyIGNmZyA9IHdpbmRvdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdHZhciBsb2NrX21zID0gKCB3aW5kb3cuV1BCQ19CRkJfU2F2ZV9BcyAmJiB3aW5kb3cuV1BCQ19CRkJfU2F2ZV9Bcy5MT0NLX01BWF9NUyApID8gcGFyc2VJbnQoIHdpbmRvdy5XUEJDX0JGQl9TYXZlX0FzLkxPQ0tfTUFYX01TLCAxMCApIDogMjAwMDA7XHJcblxyXG5cdGlmICggISB3aW5kb3cuV1BCQ19CRkJfQ29yZSB8fCAhIHdpbmRvdy5XUEJDX0JGQl9Db3JlLlVJIHx8ICEgd2luZG93LldQQkNfQkZCX0NvcmUuVUkuTW9kYWxfU2F2ZV9Bc19Gb3JtICkge1xyXG5cdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogU2F2ZSBBcyBtb2RhbCBpcyBub3QgbG9hZGVkLicsICdlcnJvcicsIDgwMDAgKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdHdpbmRvdy5XUEJDX0JGQl9Db3JlLlVJLk1vZGFsX1NhdmVfQXNfRm9ybS5vcGVuKFxyXG5cdFx0ZnVuY3Rpb24gKCBwYXlsb2FkICkge1xyXG5cclxuXHRcdFx0aWYgKCAhIHBheWxvYWQgfHwgISBwYXlsb2FkLmZvcm1fc2x1ZyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB0eXBlb2Ygd2luZG93LndwYmNfYmZiX19hamF4X3NhdmVfY3VycmVudF9mb3JtICE9PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnV1BCQyBCRkI6IHNhdmUgaGVscGVyIG1pc3NpbmcuJywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBzdCA9ICggY2ZnLl9fd3BiY19iZmJfc2F2ZV9hc19zdGF0ZSA9IGNmZy5fX3dwYmNfYmZiX3NhdmVfYXNfc3RhdGUgfHwge30gKTtcclxuXHJcblx0XHRcdC8vIFNpbXBsZSBsb2NrLlxyXG5cdFx0XHRpZiAoIHN0LmlzX2FjdGl2ZSApIHtcclxuXHRcdFx0XHR2YXIgYWdlID0gRGF0ZS5ub3coKSAtICggcGFyc2VJbnQoIHN0LmxvY2tfdGltZSB8fCAwLCAxMCApIHx8IDAgKTtcclxuXHRcdFx0XHRpZiAoIGFnZSA8IGxvY2tfbXMgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ1NhdmUgQXMgaXMgc3RpbGwgaW4gcHJvZ3Jlc3MuLi4nLCAnd2FybmluZycsIDIwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHN0LmlzX2FjdGl2ZSA9IGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgb3JpZ2luYWxfZm9ybV9uYW1lID0gU3RyaW5nKCBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCcgKTtcclxuXHRcdFx0dmFyIHRhcmdldF9mb3JtX25hbWUgICA9IFN0cmluZyggcGF5bG9hZC5mb3JtX3NsdWcgKTtcclxuXHRcdFx0dmFyIHNhdmVfdHlwZSAgICAgICAgICA9ICggcGF5bG9hZC5zYXZlX3R5cGUgPT09ICd0ZW1wbGF0ZScgKSA/ICd0ZW1wbGF0ZScgOiAncHVibGlzaGVkJztcclxuXHJcblx0XHRcdC8vIEFjdGl2YXRlIHN0YXRlIHVzZWQgYnkgaG9vayArIHByZWZpbHRlci5cclxuXHRcdFx0c3QuaXNfYWN0aXZlICAgICAgICAgID0gdHJ1ZTtcclxuXHRcdFx0c3QubG9ja190aW1lICAgICAgICAgID0gRGF0ZS5ub3coKTtcclxuXHRcdFx0c3Qub3JpZ2luYWxfZm9ybV9uYW1lID0gb3JpZ2luYWxfZm9ybV9uYW1lO1xyXG5cdFx0XHRzdC50YXJnZXRfZm9ybV9uYW1lICAgPSB0YXJnZXRfZm9ybV9uYW1lO1xyXG5cdFx0XHRzdC5zYXZlX3R5cGUgICAgICAgICAgPSBzYXZlX3R5cGU7XHJcblxyXG5cdFx0XHQvLyBNZXRhIChhbHdheXMgdGFrZW4gZnJvbSBtb2RhbCkuXHJcblx0XHRcdHN0LmZvcm1fdGl0bGUgICAgICAgICA9IFN0cmluZyggcGF5bG9hZC5mb3JtX3RpdGxlIHx8ICcnICk7XHJcblx0XHRcdHN0LmZvcm1fZGVzY3JpcHRpb24gICA9IFN0cmluZyggcGF5bG9hZC5mb3JtX2Rlc2NyaXB0aW9uIHx8ICcnICk7XHJcblx0XHRcdHN0LmZvcm1fcGljdHVyZV91cmwgICA9IFN0cmluZyggcGF5bG9hZC5mb3JtX3BpY3R1cmVfdXJsIHx8ICcnICk7XHJcblxyXG5cdFx0XHQvLyBTd2l0Y2ggY29udGV4dCBzbyBzYXZpbmcgdGFyZ2V0cyB0aGUgbmV3IHNsdWcuXHJcblx0XHRcdGNmZy5mb3JtX25hbWUgPSB0YXJnZXRfZm9ybV9uYW1lO1xyXG5cclxuXHRcdFx0dmFyIHdhdGNoZG9nX2lkID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHN0LmlzX2FjdGl2ZSA9IGZhbHNlO1xyXG5cdFx0XHR9LCBsb2NrX21zICk7XHJcblxyXG5cdFx0XHR3aW5kb3cud3BiY19iZmJfX2FqYXhfc2F2ZV9jdXJyZW50X2Zvcm0oIG1lbnVfb3B0aW9uX3RoaXMsIGZ1bmN0aW9uICggaXNfc2F2ZWQgKSB7XHJcblxyXG5cdFx0XHRcdHRyeSB7IGNsZWFyVGltZW91dCggd2F0Y2hkb2dfaWQgKTsgfSBjYXRjaCAoIF9lMCApIHt9XHJcblxyXG5cdFx0XHRcdGlmICggISBpc19zYXZlZCApIHtcclxuXHRcdFx0XHRcdGNmZy5mb3JtX25hbWUgPSBvcmlnaW5hbF9mb3JtX25hbWU7XHJcblx0XHRcdFx0XHRzdC5pc19hY3RpdmUgPSBmYWxzZTtcclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggc2F2ZV90eXBlID09PSAndGVtcGxhdGUnICkge1xyXG5cdFx0XHRcdFx0Ly8ga2VlcCB3b3JraW5nIG9uIHRoZSBvcmlnaW5hbFxyXG5cdFx0XHRcdFx0Y2ZnLmZvcm1fbmFtZSA9IG9yaWdpbmFsX2Zvcm1fbmFtZTtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnVGVtcGxhdGUgc2F2ZWQ6ICcgKyB0YXJnZXRfZm9ybV9uYW1lLCAnc3VjY2VzcycsIDIwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdHdwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCAnU2F2ZWQgQXM6ICcgKyB0YXJnZXRfZm9ybV9uYW1lLCAnc3VjY2VzcycsIDIwMDAsIGZhbHNlICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRzdC5pc19hY3RpdmUgPSBmYWxzZTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fSxcclxuXHRcdGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Ly8gU3VnZ2VzdCBzbHVnIGJhc2VkIG9uIGN1cnJlbnQgZm9ybS5cclxuXHRcdFx0dmFyIHNsdWdfZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX3BvcHVwX21vZGFsX19zYXZlX2FzX2Zvcm1fX3NsdWcnICk7XHJcblx0XHRcdGlmICggISBzbHVnX2VsICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIGJhc2UgPSBTdHJpbmcoIGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJyApO1xyXG5cdFx0XHR2YXIgc3VnZ2VzdGVkID0gL19jb3B5KFxcZCspPyQvLnRlc3QoIGJhc2UgKVxyXG5cdFx0XHRcdD8gYmFzZS5yZXBsYWNlKCAvX2NvcHkoXFxkKyk/JC8sIGZ1bmN0aW9uICggX20sIG4gKSB7XHJcblx0XHRcdFx0XHR2YXIgbnVtID0gbiA/IHBhcnNlSW50KCBuLCAxMCApIDogMTtcclxuXHRcdFx0XHRcdG51bSA9ICggISBudW0gfHwgbnVtIDwgMSApID8gMSA6IG51bTtcclxuXHRcdFx0XHRcdHJldHVybiAnX2NvcHknICsgKCBudW0gKyAxICk7XHJcblx0XHRcdFx0fSApXHJcblx0XHRcdFx0OiAoIGJhc2UgKyAnX2NvcHknICk7XHJcblxyXG5cdFx0XHRpZiAoICdzdGFuZGFyZCcgPT09IHN1Z2dlc3RlZCApIHtcclxuXHRcdFx0XHRzdWdnZXN0ZWQgPSAnc3RhbmRhcmRfY29weSc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNsdWdfZWwudmFsdWUgPSBzdWdnZXN0ZWQ7XHJcblxyXG5cdFx0XHQvLyBUcmlnZ2VyIHNhbml0aXphdGlvbiArIGVuYWJsZSBjb25maXJtLlxyXG5cdFx0XHR0cnkgeyBzbHVnX2VsLmRpc3BhdGNoRXZlbnQoIG5ldyBFdmVudCggJ2lucHV0JyApICk7IH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHR9XHJcblx0KTtcclxufSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0MsV0FBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtFQUNBRCxDQUFDLENBQUNFLGdCQUFnQixHQUFHRixDQUFDLENBQUNFLGdCQUFnQixJQUFJLENBQUMsQ0FBQztFQUM3QyxJQUFLLENBQUVGLENBQUMsQ0FBQ0UsZ0JBQWdCLENBQUNDLFdBQVcsRUFBRztJQUN2Q0gsQ0FBQyxDQUFDRSxnQkFBZ0IsQ0FBQ0MsV0FBVyxHQUFHLEtBQUs7RUFDdkM7RUFFQSxNQUFNQyxJQUFJLEdBQUlKLENBQUMsQ0FB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

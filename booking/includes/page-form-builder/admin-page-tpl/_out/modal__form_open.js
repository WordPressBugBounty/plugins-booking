"use strict";

/**
 * Booking Calendar — Load Form modal helper (BFB Admin)
 *
 * UI.Modal_Load_Form.open(on_confirm, on_open)
 *
 * on_confirm(payload):
 * payload = { form_slug: string, form: Object|null }
 *
 * Depends on:
 * - UI.Templates.ensure_dom_ref_from_wp_template
 * - UI.Modals.show/hide
 * - wpbc_bfb__ajax_list_user_forms()
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_open.js
 */
(function (w, d) {
  'use strict';

  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  const UI = Core.UI = Core.UI || {};
  UI.Modal_Load_Form = UI.Modal_Load_Form || {};

  // Idempotency guard.
  if (UI.Modal_Load_Form.__bound) {
    return;
  }
  UI.Modal_Load_Form.__bound = true;
  const MODAL_DOM_ID = 'wpbc_bfb_modal__load_form';
  const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-load_form';
  const ID_SEARCH = 'wpbc_bfb_popup_modal__load_form__search';
  const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
  const SEL_CANCEL = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
  const SEL_ERROR = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';
  function has_text(v) {
    return !!(v && String(v).trim());
  }
  function get_el(id) {
    return d.getElementById(id);
  }
  function get_modal_el() {
    return d.getElementById(MODAL_DOM_ID);
  }
  function set_error(msg) {
    const modal_el = get_modal_el();
    const el = modal_el ? modal_el.querySelector('[data-wpbc-bfb-error="1"]') : null;
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
    const modal_el = get_modal_el();
    const btn = modal_el ? modal_el.querySelector('[data-wpbc-bfb-confirm="1"]') : null;
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
  function escape_html(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function render_list(modal_el, forms) {
    const root = modal_el ? modal_el.querySelector('[data-wpbc-bfb-forms-list="1"]') : null;
    if (!root) {
      return;
    }
    let html = '';
    let any = false;
    for (let i = 0; i < (forms || []).length; i++) {
      const item = forms[i] || {};
      const slug = String(item.form_slug || '');
      const title = String(item.title || slug || '');
      const desc = String(item.description || '');
      const pic = String(item.picture_url || item.image_url || '');
      if (!slug) {
        continue;
      }
      any = true;
      const thumb = pic ? '<img src="' + escape_html(pic) + '" alt="" />' : '<div class="wpbc_bfb__load_form_item_thumb_blank_img">No image</div>';
      const meta = '<div class="form_item_text_slug">' + escape_html(slug) + '</div>';
      const line2 = desc ? '<div class="form_item_text_desc">' + escape_html(desc) + '</div>' : '';
      html += '' + '<div class="wpbc_bfb__load_form_item" data-wpbc-bfb-form-item="1" data-form-slug="' + escape_html(slug) + '"' + ' >' + '  <div class="wpbc_bfb__load_form_item_thumb">' + thumb + '</div>' + '  <div  class="wpbc_bfb__load_form_item_text">' + '    <div class="form_item_text_title">' + escape_html(title) + '</div>' + meta + line2 + '  </div>' + '</div>';
    }
    if (!any) {
      html = '<div style="padding:10px;color:#666;">No forms found.</div>';
    }
    root.innerHTML = html;

    // Re-apply selection highlight if still present on this page.
    const sel = modal_el.__wpbc_bfb_selected_form_slug || '';
    if (sel) {
      let found = null;
      try {
        found = root.querySelector('[data-form-slug="' + CSS.escape(sel) + '"]');
      } catch (_e) {
        found = null;
      }
      if (found) {
        // found.style.background = '#f6f7f7';
        found.classList.add('wpbc_bfb__load_form_item_selected');
        set_confirm_enabled(true);
      } else {
        // Selection not on this page anymore -> reset.
        root.querySelectorAll('.wpbc_bfb__load_form_item').forEach(el => {
          el.classList.remove('wpbc_bfb__load_form_item_selected');
        });
        modal_el.__wpbc_bfb_selected_form_slug = '';
        set_confirm_enabled(false);
      }
    }
  }
  function set_pager(modal_el, page, has_more) {
    const pager = modal_el ? modal_el.querySelector('[data-wpbc-bfb-forms-pager="1"]') : null;
    if (!pager) {
      return;
    }
    const prev = pager.querySelector('[data-wpbc-bfb-page-prev="1"]');
    const next = pager.querySelector('[data-wpbc-bfb-page-next="1"]');
    const lab = pager.querySelector('[data-wpbc-bfb-page-label="1"]');
    page = parseInt(page || 1, 10);
    if (!page || page < 1) {
      page = 1;
    }
    if (lab) {
      lab.textContent = 'Page ' + page;
    }
    const prev_enabled = page > 1;
    const next_enabled = !!has_more;
    function set_btn(btn, enabled) {
      if (!btn) {
        return;
      }
      if (enabled) {
        btn.classList.remove('disabled');
        btn.setAttribute('aria-disabled', 'false');
      } else {
        btn.classList.add('disabled');
        btn.setAttribute('aria-disabled', 'true');
      }
    }
    set_btn(prev, prev_enabled);
    set_btn(next, next_enabled);
  }
  function set_loading(modal_el, is_loading) {
    const root = modal_el ? modal_el.querySelector('[data-wpbc-bfb-forms-list="1"]') : null;
    if (!root) {
      return;
    }
    if (is_loading) {
      const mainNav = document.querySelector('.wpbc_bfb_popup_modal__forms_loading_spin_container').outerHTML;
      root.innerHTML = mainNav;
      // root.innerHTML = '<div class="wpbc_bfb_popup_modal__forms_loading_spin_container" data-wpbc-bfb-forms-loading="1">Loading...</div>'; //.
    }
  }
  function bind_handlers(modal_el) {
    if (!modal_el || modal_el.__wpbc_bfb_handlers_bound) {
      return;
    }
    modal_el.__wpbc_bfb_handlers_bound = true;

    // Click select item (delegated inside list).
    modal_el.addEventListener('click', function (e) {
      if (!e || !e.target || !e.target.closest) {
        return;
      }
      const item = e.target.closest('[data-wpbc-bfb-form-item="1"]');
      if (!item) {
        return;
      }
      const slug = item.getAttribute('data-form-slug') || '';
      modal_el.__wpbc_bfb_selected_form_slug = slug;

      // Visual highlight
      const root = modal_el.querySelector('[data-wpbc-bfb-forms-list="1"]');
      if (root) {
        const all = root.querySelectorAll('[data-wpbc-bfb-form-item="1"]');
        for (let i = 0; i < all.length; i++) {
          all[i].style.background = '';
        }
      }
      // item.style.background = '#f6f7f7';
      root.querySelectorAll('.wpbc_bfb__load_form_item').forEach(el => {
        el.classList.remove('wpbc_bfb__load_form_item_selected');
      });
      item.classList.add('wpbc_bfb__load_form_item_selected');
      set_confirm_enabled(!!slug);
    }, true);

    // Search filter. (server-side, debounced).
    const search_el = get_el(ID_SEARCH);
    if (search_el) {
      if (!modal_el.__wpbc_bfb_search_timer) {
        modal_el.__wpbc_bfb_search_timer = 0;
      }
      search_el.addEventListener('input', function () {
        const v = String(search_el.value || '');
        if (modal_el.__wpbc_bfb_search_timer) {
          clearTimeout(modal_el.__wpbc_bfb_search_timer);
        }
        modal_el.__wpbc_bfb_search_timer = setTimeout(function () {
          load_forms(modal_el, 1, v);
        }, 300);
      }, true);
    }

    // Pager click.
    modal_el.addEventListener('click', function (e) {
      if (!e || !e.target || !e.target.closest) {
        return;
      }
      const prev = e.target.closest('[data-wpbc-bfb-page-prev="1"]');
      const next = e.target.closest('[data-wpbc-bfb-page-next="1"]');
      if (!prev && !next) {
        return;
      }
      e.preventDefault();
      if (prev && (prev.classList.contains('disabled') || prev.getAttribute('aria-disabled') === 'true') || next && (next.classList.contains('disabled') || next.getAttribute('aria-disabled') === 'true')) {
        return;
      }
      const page = parseInt(modal_el.__wpbc_bfb_page || 1, 10) || 1;
      const search = String(modal_el.__wpbc_bfb_search || '');
      if (prev) {
        load_forms(modal_el, Math.max(1, page - 1), search);
      }
      if (next) {
        load_forms(modal_el, page + 1, search);
      }
    }, true);
  }
  function load_forms(modal_el, page, search, done) {
    if (typeof w.wpbc_bfb__ajax_list_user_forms !== 'function') {
      set_error('WPBC BFB: list forms helper missing.');
      set_loading(modal_el, false);
      if (typeof done === 'function') {
        done(false, null);
      }
      return;
    }
    page = parseInt(page || 1, 10);
    search = String(search || '');
    if (!page || page < 1) {
      page = 1;
    }
    set_error('');
    set_confirm_enabled(false);
    modal_el.__wpbc_bfb_selected_form_slug = '';
    set_loading(modal_el, true);
    w.wpbc_bfb__ajax_list_user_forms(null, {
      include_global: 0,
      page: page,
      limit: 20,
      search: search
    }, function (ok, data) {
      if (!ok || !data || !data.forms) {
        set_loading(modal_el, false);
        set_error('Failed to load forms list.');
        set_pager(modal_el, 1, false);
        if (typeof done === 'function') {
          done(false, null);
        }
        return;
      }
      modal_el.__wpbc_bfb_forms_cache = data.forms || [];
      modal_el.__wpbc_bfb_page = data.page || page;
      modal_el.__wpbc_bfb_has_more = !!data.has_more;
      modal_el.__wpbc_bfb_search = search;
      render_list(modal_el, modal_el.__wpbc_bfb_forms_cache);
      set_pager(modal_el, modal_el.__wpbc_bfb_page, modal_el.__wpbc_bfb_has_more);
      set_error('');
      if (typeof done === 'function') {
        done(true, data);
      }
    });
  }
  UI.Modal_Load_Form.open = function (on_confirm, on_open) {
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
    modal_el.__wpbc_bfb_load_form_cb = typeof on_confirm === 'function' ? on_confirm : null;
    bind_handlers(modal_el);

    // Reset basic UI.
    const search_el = get_el(ID_SEARCH);
    if (search_el) {
      search_el.value = '';
    }
    modal_el.__wpbc_bfb_forms_cache = [];
    modal_el.__wpbc_bfb_selected_form_slug = '';
    set_error('');
    set_confirm_enabled(false);
    set_loading(modal_el, true);
    UI.Modals.show(modal_el);

    // Load list via ajax.
    modal_el.__wpbc_bfb_page = 1;
    modal_el.__wpbc_bfb_has_more = false;
    modal_el.__wpbc_bfb_search = '';
    load_forms(modal_el, 1, '');
    set_pager(modal_el, 1, false);

    // Focus search.
    w.setTimeout(function () {
      const s = get_el(ID_SEARCH);
      if (s && s.focus) {
        try {
          s.focus();
        } catch (_e) {}
      }
    }, 0);
    if (on_open) {
      try {
        on_open(modal_el);
      } catch (_e2) {}
    }
  };

  // Confirm / Cancel (delegated).
  d.addEventListener('click', function (e) {
    const modal_el = get_modal_el();
    if (!modal_el || !e || !e.target || !e.target.closest) {
      return;
    }
    const is_confirm = e.target.closest(SEL_CONFIRM);
    if (is_confirm) {
      e.preventDefault();
      if (is_confirm.classList.contains('disabled') || is_confirm.getAttribute('aria-disabled') === 'true') {
        return;
      }
      const slug = modal_el.__wpbc_bfb_selected_form_slug || '';
      if (!slug) {
        return;
      }
      const cb = modal_el.__wpbc_bfb_load_form_cb || null;
      modal_el.__wpbc_bfb_load_form_cb = null;
      UI.Modals.hide(modal_el);
      if (cb) {
        // Try to find selected full object:
        let full = null;
        const list = modal_el.__wpbc_bfb_forms_cache || [];
        for (let i = 0; i < list.length; i++) {
          if (String(list[i].form_slug || '') === String(slug)) {
            full = list[i];
            break;
          }
        }
        try {
          cb({
            form_slug: slug,
            form: full
          });
        } catch (_e3) {}
      }
      return;
    }
    const is_cancel = e.target.closest(SEL_CANCEL);
    if (is_cancel) {
      e.preventDefault();
      modal_el.__wpbc_bfb_load_form_cb = null;
      UI.Modals.hide(modal_el);
    }
  }, true);
})(window, document);
function wpbc_bfb__menu_forms__load(menu_option_this) {
  WPBC_BFB_Core.UI.Modal_Load_Form.open(function (payload) {
    if (!payload || !payload.form_slug) {
      return;
    }

    // Load selected form into builder.
    if (typeof window.wpbc_bfb__ajax_load_form_by_slug !== 'function') {
      wpbc_admin_show_message('WPBC BFB: load-by-slug helper missing.', 'error', 10000);
      return;
    }
    window.wpbc_bfb__ajax_load_form_by_slug(payload.form_slug, menu_option_this, function (ok, data) {
      if (ok) {
        wpbc_admin_show_message('Form loaded', 'success', 1500, false);
      }
    });
  });
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV9vcGVuLmpzIiwibmFtZXMiOlsidyIsImQiLCJDb3JlIiwiV1BCQ19CRkJfQ29yZSIsIlVJIiwiTW9kYWxfTG9hZF9Gb3JtIiwiX19ib3VuZCIsIk1PREFMX0RPTV9JRCIsIlRQTF9NT0RBTF9JRCIsIklEX1NFQVJDSCIsIlNFTF9DT05GSVJNIiwiU0VMX0NBTkNFTCIsIlNFTF9FUlJPUiIsImhhc190ZXh0IiwidiIsIlN0cmluZyIsInRyaW0iLCJnZXRfZWwiLCJpZCIsImdldEVsZW1lbnRCeUlkIiwiZ2V0X21vZGFsX2VsIiwic2V0X2Vycm9yIiwibXNnIiwibW9kYWxfZWwiLCJlbCIsInF1ZXJ5U2VsZWN0b3IiLCJpbm5lckhUTUwiLCJzdHlsZSIsImRpc3BsYXkiLCJzZXRfY29uZmlybV9lbmFibGVkIiwiaXNfZW5hYmxlZCIsImJ0biIsImNsYXNzTGlzdCIsInJlbW92ZSIsInNldEF0dHJpYnV0ZSIsImFkZCIsImVzY2FwZV9odG1sIiwicyIsInJlcGxhY2UiLCJyZW5kZXJfbGlzdCIsImZvcm1zIiwicm9vdCIsImh0bWwiLCJhbnkiLCJpIiwibGVuZ3RoIiwiaXRlbSIsInNsdWciLCJmb3JtX3NsdWciLCJ0aXRsZSIsImRlc2MiLCJkZXNjcmlwdGlvbiIsInBpYyIsInBpY3R1cmVfdXJsIiwiaW1hZ2VfdXJsIiwidGh1bWIiLCJtZXRhIiwibGluZTIiLCJzZWwiLCJfX3dwYmNfYmZiX3NlbGVjdGVkX2Zvcm1fc2x1ZyIsImZvdW5kIiwiQ1NTIiwiZXNjYXBlIiwiX2UiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsInNldF9wYWdlciIsInBhZ2UiLCJoYXNfbW9yZSIsInBhZ2VyIiwicHJldiIsIm5leHQiLCJsYWIiLCJwYXJzZUludCIsInRleHRDb250ZW50IiwicHJldl9lbmFibGVkIiwibmV4dF9lbmFibGVkIiwic2V0X2J0biIsImVuYWJsZWQiLCJzZXRfbG9hZGluZyIsImlzX2xvYWRpbmciLCJtYWluTmF2IiwiZG9jdW1lbnQiLCJvdXRlckhUTUwiLCJiaW5kX2hhbmRsZXJzIiwiX193cGJjX2JmYl9oYW5kbGVyc19ib3VuZCIsImFkZEV2ZW50TGlzdGVuZXIiLCJlIiwidGFyZ2V0IiwiY2xvc2VzdCIsImdldEF0dHJpYnV0ZSIsImFsbCIsImJhY2tncm91bmQiLCJzZWFyY2hfZWwiLCJfX3dwYmNfYmZiX3NlYXJjaF90aW1lciIsInZhbHVlIiwiY2xlYXJUaW1lb3V0Iiwic2V0VGltZW91dCIsImxvYWRfZm9ybXMiLCJwcmV2ZW50RGVmYXVsdCIsImNvbnRhaW5zIiwiX193cGJjX2JmYl9wYWdlIiwic2VhcmNoIiwiX193cGJjX2JmYl9zZWFyY2giLCJNYXRoIiwibWF4IiwiZG9uZSIsIndwYmNfYmZiX19hamF4X2xpc3RfdXNlcl9mb3JtcyIsImluY2x1ZGVfZ2xvYmFsIiwibGltaXQiLCJvayIsImRhdGEiLCJfX3dwYmNfYmZiX2Zvcm1zX2NhY2hlIiwiX193cGJjX2JmYl9oYXNfbW9yZSIsIm9wZW4iLCJvbl9jb25maXJtIiwib25fb3BlbiIsInJlZiIsIlRlbXBsYXRlcyIsImVuc3VyZV9kb21fcmVmX2Zyb21fd3BfdGVtcGxhdGUiLCJpbnNpZGUiLCJfX3dwYmNfYmZiX2xvYWRfZm9ybV9jYiIsIk1vZGFscyIsInNob3ciLCJmb2N1cyIsIl9lMiIsImlzX2NvbmZpcm0iLCJjYiIsImhpZGUiLCJmdWxsIiwibGlzdCIsImZvcm0iLCJfZTMiLCJpc19jYW5jZWwiLCJ3aW5kb3ciLCJ3cGJjX2JmYl9fbWVudV9mb3Jtc19fbG9hZCIsIm1lbnVfb3B0aW9uX3RoaXMiLCJwYXlsb2FkIiwid3BiY19iZmJfX2FqYXhfbG9hZF9mb3JtX2J5X3NsdWciLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2FkbWluLXBhZ2UtdHBsL19zcmMvbW9kYWxfX2Zvcm1fb3Blbi5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQm9va2luZyBDYWxlbmRhciDigJQgTG9hZCBGb3JtIG1vZGFsIGhlbHBlciAoQkZCIEFkbWluKVxyXG4gKlxyXG4gKiBVSS5Nb2RhbF9Mb2FkX0Zvcm0ub3Blbihvbl9jb25maXJtLCBvbl9vcGVuKVxyXG4gKlxyXG4gKiBvbl9jb25maXJtKHBheWxvYWQpOlxyXG4gKiBwYXlsb2FkID0geyBmb3JtX3NsdWc6IHN0cmluZywgZm9ybTogT2JqZWN0fG51bGwgfVxyXG4gKlxyXG4gKiBEZXBlbmRzIG9uOlxyXG4gKiAtIFVJLlRlbXBsYXRlcy5lbnN1cmVfZG9tX3JlZl9mcm9tX3dwX3RlbXBsYXRlXHJcbiAqIC0gVUkuTW9kYWxzLnNob3cvaGlkZVxyXG4gKiAtIHdwYmNfYmZiX19hamF4X2xpc3RfdXNlcl9mb3JtcygpXHJcbiAqXHJcbiAqIEBmaWxlOiAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9hZG1pbi1wYWdlLXRwbC9fb3V0L21vZGFsX19mb3JtX29wZW4uanNcclxuICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Y29uc3QgQ29yZSAgICAgICAgID0gKHcuV1BCQ19CRkJfQ29yZSA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fSk7XHJcblx0Y29uc3QgVUkgICAgICAgICAgID0gKENvcmUuVUkgPSBDb3JlLlVJIHx8IHt9KTtcclxuXHRVSS5Nb2RhbF9Mb2FkX0Zvcm0gPSBVSS5Nb2RhbF9Mb2FkX0Zvcm0gfHwge307XHJcblxyXG5cdC8vIElkZW1wb3RlbmN5IGd1YXJkLlxyXG5cdGlmICggVUkuTW9kYWxfTG9hZF9Gb3JtLl9fYm91bmQgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cdFVJLk1vZGFsX0xvYWRfRm9ybS5fX2JvdW5kID0gdHJ1ZTtcclxuXHJcblx0Y29uc3QgTU9EQUxfRE9NX0lEID0gJ3dwYmNfYmZiX21vZGFsX19sb2FkX2Zvcm0nO1xyXG5cdGNvbnN0IFRQTF9NT0RBTF9JRCA9ICd3cGJjLWJmYi10cGwtbW9kYWwtbG9hZF9mb3JtJztcclxuXHJcblx0Y29uc3QgSURfU0VBUkNIID0gJ3dwYmNfYmZiX3BvcHVwX21vZGFsX19sb2FkX2Zvcm1fX3NlYXJjaCc7XHJcblxyXG5cdGNvbnN0IFNFTF9DT05GSVJNID0gJyMnICsgTU9EQUxfRE9NX0lEICsgJyBbZGF0YS13cGJjLWJmYi1jb25maXJtPVwiMVwiXSc7XHJcblx0Y29uc3QgU0VMX0NBTkNFTCAgPSAnIycgKyBNT0RBTF9ET01fSUQgKyAnIFtkYXRhLXdwYmMtYmZiLWNhbmNlbD1cIjFcIl0nO1xyXG5cdGNvbnN0IFNFTF9FUlJPUiAgID0gJyMnICsgTU9EQUxfRE9NX0lEICsgJyBbZGF0YS13cGJjLWJmYi1lcnJvcj1cIjFcIl0nO1xyXG5cclxuXHRmdW5jdGlvbiBoYXNfdGV4dCh2KSB7XHJcblx0XHRyZXR1cm4gISEgKHYgJiYgU3RyaW5nKCB2ICkudHJpbSgpKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9lbChpZCkge1xyXG5cdFx0cmV0dXJuIGQuZ2V0RWxlbWVudEJ5SWQoIGlkICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBnZXRfbW9kYWxfZWwoKSB7XHJcblx0XHRyZXR1cm4gZC5nZXRFbGVtZW50QnlJZCggTU9EQUxfRE9NX0lEICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfZXJyb3IobXNnKSB7XHJcblx0XHRjb25zdCBtb2RhbF9lbCA9IGdldF9tb2RhbF9lbCgpO1xyXG5cdFx0Y29uc3QgZWwgICAgICAgPSBtb2RhbF9lbCA/IG1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1lcnJvcj1cIjFcIl0nICkgOiBudWxsO1xyXG5cdFx0aWYgKCAhIGVsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBoYXNfdGV4dCggbXNnICkgKSB7XHJcblx0XHRcdGVsLmlubmVySFRNTCAgICAgPSBTdHJpbmcoIG1zZyApO1xyXG5cdFx0XHRlbC5zdHlsZS5kaXNwbGF5ID0gJyc7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRlbC5pbm5lckhUTUwgICAgID0gJyc7XHJcblx0XHRcdGVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfY29uZmlybV9lbmFibGVkKGlzX2VuYWJsZWQpIHtcclxuXHRcdGNvbnN0IG1vZGFsX2VsID0gZ2V0X21vZGFsX2VsKCk7XHJcblx0XHRjb25zdCBidG4gICAgICA9IG1vZGFsX2VsID8gbW9kYWxfZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWNvbmZpcm09XCIxXCJdJyApIDogbnVsbDtcclxuXHRcdGlmICggISBidG4gKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2VuYWJsZWQgKSB7XHJcblx0XHRcdGJ0bi5jbGFzc0xpc3QucmVtb3ZlKCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdGJ0bi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0YnRuLmNsYXNzTGlzdC5hZGQoICdkaXNhYmxlZCcgKTtcclxuXHRcdFx0YnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGVzY2FwZV9odG1sKHMpIHtcclxuXHRcdHJldHVybiBTdHJpbmcoIHMgPT0gbnVsbCA/ICcnIDogcyApXHJcblx0XHRcdC5yZXBsYWNlKCAvJi9nLCAnJmFtcDsnIClcclxuXHRcdFx0LnJlcGxhY2UoIC88L2csICcmbHQ7JyApXHJcblx0XHRcdC5yZXBsYWNlKCAvPi9nLCAnJmd0OycgKVxyXG5cdFx0XHQucmVwbGFjZSggL1wiL2csICcmcXVvdDsnIClcclxuXHRcdFx0LnJlcGxhY2UoIC8nL2csICcmIzAzOTsnICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiByZW5kZXJfbGlzdChtb2RhbF9lbCwgZm9ybXMpIHtcclxuXHRcdGNvbnN0IHJvb3QgPSBtb2RhbF9lbCA/IG1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1mb3Jtcy1saXN0PVwiMVwiXScgKSA6IG51bGw7XHJcblx0XHRpZiAoICEgcm9vdCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdGxldCBodG1sID0gJyc7XHJcblx0XHRsZXQgYW55ICA9IGZhbHNlO1xyXG5cclxuXHRcdGZvciAoIGxldCBpID0gMDsgaSA8IChmb3JtcyB8fCBbXSkubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdGNvbnN0IGl0ZW0gID0gZm9ybXNbaV0gfHwge307XHJcblx0XHRcdGNvbnN0IHNsdWcgID0gU3RyaW5nKCBpdGVtLmZvcm1fc2x1ZyB8fCAnJyApO1xyXG5cdFx0XHRjb25zdCB0aXRsZSA9IFN0cmluZyggaXRlbS50aXRsZSB8fCBzbHVnIHx8ICcnICk7XHJcblx0XHRcdGNvbnN0IGRlc2MgID0gU3RyaW5nKCBpdGVtLmRlc2NyaXB0aW9uIHx8ICcnICk7XHJcblx0XHRcdGNvbnN0IHBpYyAgID0gU3RyaW5nKCBpdGVtLnBpY3R1cmVfdXJsIHx8IGl0ZW0uaW1hZ2VfdXJsIHx8ICcnICk7XHJcblxyXG5cdFx0XHRpZiAoICEgc2x1ZyApIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRhbnkgPSB0cnVlO1xyXG5cclxuXHRcdFx0Y29uc3QgdGh1bWIgPSBwaWNcclxuXHRcdFx0XHQ/ICc8aW1nIHNyYz1cIicgKyBlc2NhcGVfaHRtbCggcGljICkgKyAnXCIgYWx0PVwiXCIgLz4nXHJcblx0XHRcdFx0OiAnPGRpdiBjbGFzcz1cIndwYmNfYmZiX19sb2FkX2Zvcm1faXRlbV90aHVtYl9ibGFua19pbWdcIj5ObyBpbWFnZTwvZGl2Pic7XHJcblxyXG5cdFx0XHRjb25zdCBtZXRhID0gJzxkaXYgY2xhc3M9XCJmb3JtX2l0ZW1fdGV4dF9zbHVnXCI+JyArIGVzY2FwZV9odG1sKCBzbHVnICkgKyAnPC9kaXY+JztcclxuXHJcblx0XHRcdGNvbnN0IGxpbmUyID0gZGVzYyA/ICc8ZGl2IGNsYXNzPVwiZm9ybV9pdGVtX3RleHRfZGVzY1wiPicgKyBlc2NhcGVfaHRtbCggZGVzYyApICsgJzwvZGl2PicgOiAnJztcclxuXHJcblx0XHRcdGh0bWwgKz0gJydcclxuXHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtXCIgZGF0YS13cGJjLWJmYi1mb3JtLWl0ZW09XCIxXCIgZGF0YS1mb3JtLXNsdWc9XCInICsgZXNjYXBlX2h0bWwoIHNsdWcgKSArICdcIidcclxuXHRcdFx0XHQrICcgPidcclxuXHRcdFx0XHQrICcgIDxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1fdGh1bWJcIj4nICsgdGh1bWIgKyAnPC9kaXY+J1xyXG5cdFx0XHRcdCsgJyAgPGRpdiAgY2xhc3M9XCJ3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1fdGV4dFwiPidcclxuXHRcdFx0XHQrICcgICAgPGRpdiBjbGFzcz1cImZvcm1faXRlbV90ZXh0X3RpdGxlXCI+JyArIGVzY2FwZV9odG1sKCB0aXRsZSApICsgJzwvZGl2PidcclxuXHRcdFx0XHQrIG1ldGFcclxuXHRcdFx0XHQrIGxpbmUyXHJcblx0XHRcdFx0KyAnICA8L2Rpdj4nXHJcblx0XHRcdFx0KyAnPC9kaXY+JztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgYW55ICkge1xyXG5cdFx0XHRodG1sID0gJzxkaXYgc3R5bGU9XCJwYWRkaW5nOjEwcHg7Y29sb3I6IzY2NjtcIj5ObyBmb3JtcyBmb3VuZC48L2Rpdj4nO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJvb3QuaW5uZXJIVE1MID0gaHRtbDtcclxuXHJcblx0XHQvLyBSZS1hcHBseSBzZWxlY3Rpb24gaGlnaGxpZ2h0IGlmIHN0aWxsIHByZXNlbnQgb24gdGhpcyBwYWdlLlxyXG5cdFx0Y29uc3Qgc2VsID0gbW9kYWxfZWwuX193cGJjX2JmYl9zZWxlY3RlZF9mb3JtX3NsdWcgfHwgJyc7XHJcblx0XHRpZiAoIHNlbCApIHtcclxuXHRcdFx0bGV0IGZvdW5kID0gbnVsbDtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRmb3VuZCA9IHJvb3QucXVlcnlTZWxlY3RvciggJ1tkYXRhLWZvcm0tc2x1Zz1cIicgKyBDU1MuZXNjYXBlKCBzZWwgKSArICdcIl0nICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcclxuXHRcdFx0XHRmb3VuZCA9IG51bGw7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCBmb3VuZCApIHtcclxuXHRcdFx0XHQvLyBmb3VuZC5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmNmY3ZjcnO1xyXG5cdFx0XHRcdGZvdW5kLmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1fc2VsZWN0ZWQnICk7XHJcblx0XHRcdFx0c2V0X2NvbmZpcm1fZW5hYmxlZCggdHJ1ZSApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIFNlbGVjdGlvbiBub3Qgb24gdGhpcyBwYWdlIGFueW1vcmUgLT4gcmVzZXQuXHJcblx0XHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfYmZiX19sb2FkX2Zvcm1faXRlbScgKS5mb3JFYWNoKCAoZWwpID0+IHtcclxuXHRcdFx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1fc2VsZWN0ZWQnICk7XHJcblx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfc2VsZWN0ZWRfZm9ybV9zbHVnID0gJyc7XHJcblx0XHRcdFx0c2V0X2NvbmZpcm1fZW5hYmxlZCggZmFsc2UgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2V0X3BhZ2VyKG1vZGFsX2VsLCBwYWdlLCBoYXNfbW9yZSkge1xyXG5cdFx0Y29uc3QgcGFnZXIgPSBtb2RhbF9lbCA/IG1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1mb3Jtcy1wYWdlcj1cIjFcIl0nICkgOiBudWxsO1xyXG5cdFx0aWYgKCAhIHBhZ2VyICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgcHJldiA9IHBhZ2VyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1wYWdlLXByZXY9XCIxXCJdJyApO1xyXG5cdFx0Y29uc3QgbmV4dCA9IHBhZ2VyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1wYWdlLW5leHQ9XCIxXCJdJyApO1xyXG5cdFx0Y29uc3QgbGFiICA9IHBhZ2VyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1wYWdlLWxhYmVsPVwiMVwiXScgKTtcclxuXHJcblx0XHRwYWdlID0gcGFyc2VJbnQoIHBhZ2UgfHwgMSwgMTAgKTtcclxuXHRcdGlmICggISBwYWdlIHx8IHBhZ2UgPCAxICkge1xyXG5cdFx0XHRwYWdlID0gMTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGxhYiApIHtcclxuXHRcdFx0bGFiLnRleHRDb250ZW50ID0gJ1BhZ2UgJyArIHBhZ2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgcHJldl9lbmFibGVkID0gKHBhZ2UgPiAxKTtcclxuXHRcdGNvbnN0IG5leHRfZW5hYmxlZCA9ICEhIGhhc19tb3JlO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHNldF9idG4oYnRuLCBlbmFibGVkKSB7XHJcblx0XHRcdGlmICggISBidG4gKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggZW5hYmxlZCApIHtcclxuXHRcdFx0XHRidG4uY2xhc3NMaXN0LnJlbW92ZSggJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdGJ0bi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGJ0bi5jbGFzc0xpc3QuYWRkKCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0YnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHNldF9idG4oIHByZXYsIHByZXZfZW5hYmxlZCApO1xyXG5cdFx0c2V0X2J0biggbmV4dCwgbmV4dF9lbmFibGVkICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzZXRfbG9hZGluZyhtb2RhbF9lbCwgaXNfbG9hZGluZykge1xyXG5cdFx0Y29uc3Qgcm9vdCA9IG1vZGFsX2VsID8gbW9kYWxfZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLWZvcm1zLWxpc3Q9XCIxXCJdJyApIDogbnVsbDtcclxuXHRcdGlmICggISByb290ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc19sb2FkaW5nICkge1xyXG5cdFx0XHRjb25zdCBtYWluTmF2ICA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfcG9wdXBfbW9kYWxfX2Zvcm1zX2xvYWRpbmdfc3Bpbl9jb250YWluZXInICkub3V0ZXJIVE1MO1xyXG5cdFx0XHRyb290LmlubmVySFRNTCA9IG1haW5OYXY7XHJcblx0XHRcdC8vIHJvb3QuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9wb3B1cF9tb2RhbF9fZm9ybXNfbG9hZGluZ19zcGluX2NvbnRhaW5lclwiIGRhdGEtd3BiYy1iZmItZm9ybXMtbG9hZGluZz1cIjFcIj5Mb2FkaW5nLi4uPC9kaXY+JzsgLy8uXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBiaW5kX2hhbmRsZXJzKG1vZGFsX2VsKSB7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgfHwgbW9kYWxfZWwuX193cGJjX2JmYl9oYW5kbGVyc19ib3VuZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0bW9kYWxfZWwuX193cGJjX2JmYl9oYW5kbGVyc19ib3VuZCA9IHRydWU7XHJcblxyXG5cdFx0Ly8gQ2xpY2sgc2VsZWN0IGl0ZW0gKGRlbGVnYXRlZCBpbnNpZGUgbGlzdCkuXHJcblx0XHRtb2RhbF9lbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRpZiAoICEgZSB8fCAhIGUudGFyZ2V0IHx8ICEgZS50YXJnZXQuY2xvc2VzdCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGl0ZW0gPSBlLnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1iZmItZm9ybS1pdGVtPVwiMVwiXScgKTtcclxuXHRcdFx0aWYgKCAhIGl0ZW0gKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBzbHVnICAgICAgICAgICAgICAgICAgICAgICAgICAgICA9IGl0ZW0uZ2V0QXR0cmlidXRlKCAnZGF0YS1mb3JtLXNsdWcnICkgfHwgJyc7XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfc2VsZWN0ZWRfZm9ybV9zbHVnID0gc2x1ZztcclxuXHJcblx0XHRcdC8vIFZpc3VhbCBoaWdobGlnaHRcclxuXHRcdFx0Y29uc3Qgcm9vdCA9IG1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1mb3Jtcy1saXN0PVwiMVwiXScgKTtcclxuXHRcdFx0aWYgKCByb290ICkge1xyXG5cdFx0XHRcdGNvbnN0IGFsbCA9IHJvb3QucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYmZiLWZvcm0taXRlbT1cIjFcIl0nICk7XHJcblx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgYWxsLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdFx0YWxsW2ldLnN0eWxlLmJhY2tncm91bmQgPSAnJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0Ly8gaXRlbS5zdHlsZS5iYWNrZ3JvdW5kID0gJyNmNmY3ZjcnO1xyXG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtJyApLmZvckVhY2goIChlbCkgPT4ge1xyXG5cdFx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1fc2VsZWN0ZWQnICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0aXRlbS5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtX3NlbGVjdGVkJyApO1xyXG5cdFx0XHRzZXRfY29uZmlybV9lbmFibGVkKCAhISBzbHVnICk7XHJcblx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0Ly8gU2VhcmNoIGZpbHRlci4gKHNlcnZlci1zaWRlLCBkZWJvdW5jZWQpLlxyXG5cdFx0Y29uc3Qgc2VhcmNoX2VsID0gZ2V0X2VsKCBJRF9TRUFSQ0ggKTtcclxuXHRcdGlmICggc2VhcmNoX2VsICkge1xyXG5cdFx0XHRpZiAoICEgbW9kYWxfZWwuX193cGJjX2JmYl9zZWFyY2hfdGltZXIgKSB7XHJcblx0XHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9zZWFyY2hfdGltZXIgPSAwO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRzZWFyY2hfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdGNvbnN0IHYgPSBTdHJpbmcoIHNlYXJjaF9lbC52YWx1ZSB8fCAnJyApO1xyXG5cclxuXHRcdFx0XHRpZiAoIG1vZGFsX2VsLl9fd3BiY19iZmJfc2VhcmNoX3RpbWVyICkge1xyXG5cdFx0XHRcdFx0Y2xlYXJUaW1lb3V0KCBtb2RhbF9lbC5fX3dwYmNfYmZiX3NlYXJjaF90aW1lciApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX3NlYXJjaF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGxvYWRfZm9ybXMoIG1vZGFsX2VsLCAxLCB2ICk7XHJcblx0XHRcdFx0fSwgMzAwICk7XHJcblx0XHRcdH0sIHRydWUgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBQYWdlciBjbGljay5cclxuXHRcdG1vZGFsX2VsLmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdGlmICggISBlIHx8ICEgZS50YXJnZXQgfHwgISBlLnRhcmdldC5jbG9zZXN0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgcHJldiA9IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi1wYWdlLXByZXY9XCIxXCJdJyApO1xyXG5cdFx0XHRjb25zdCBuZXh0ID0gZS50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYmZiLXBhZ2UtbmV4dD1cIjFcIl0nICk7XHJcblxyXG5cdFx0XHRpZiAoICEgcHJldiAmJiAhIG5leHQgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRpZiAoIChwcmV2ICYmIChwcmV2LmNsYXNzTGlzdC5jb250YWlucyggJ2Rpc2FibGVkJyApIHx8IHByZXYuZ2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKSA9PT0gJ3RydWUnKSkgfHxcclxuXHRcdFx0XHQobmV4dCAmJiAobmV4dC5jbGFzc0xpc3QuY29udGFpbnMoICdkaXNhYmxlZCcgKSB8fCBuZXh0LmdldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnICkgPT09ICd0cnVlJykpICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgcGFnZSAgID0gcGFyc2VJbnQoIG1vZGFsX2VsLl9fd3BiY19iZmJfcGFnZSB8fCAxLCAxMCApIHx8IDE7XHJcblx0XHRcdGNvbnN0IHNlYXJjaCA9IFN0cmluZyggbW9kYWxfZWwuX193cGJjX2JmYl9zZWFyY2ggfHwgJycgKTtcclxuXHJcblx0XHRcdGlmICggcHJldiApIHtcclxuXHRcdFx0XHRsb2FkX2Zvcm1zKCBtb2RhbF9lbCwgTWF0aC5tYXgoIDEsIHBhZ2UgLSAxICksIHNlYXJjaCApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggbmV4dCApIHtcclxuXHRcdFx0XHRsb2FkX2Zvcm1zKCBtb2RhbF9lbCwgcGFnZSArIDEsIHNlYXJjaCApO1xyXG5cdFx0XHR9XHJcblx0XHR9LCB0cnVlICk7XHJcblxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbG9hZF9mb3Jtcyhtb2RhbF9lbCwgcGFnZSwgc2VhcmNoLCBkb25lKSB7XHJcblx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYmZiX19hamF4X2xpc3RfdXNlcl9mb3JtcyAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0c2V0X2Vycm9yKCAnV1BCQyBCRkI6IGxpc3QgZm9ybXMgaGVscGVyIG1pc3NpbmcuJyApO1xyXG5cdFx0XHRzZXRfbG9hZGluZyggbW9kYWxfZWwsIGZhbHNlICk7XHJcblx0XHRcdGlmICggdHlwZW9mIGRvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZG9uZSggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0cGFnZSAgID0gcGFyc2VJbnQoIHBhZ2UgfHwgMSwgMTAgKTtcclxuXHRcdHNlYXJjaCA9IFN0cmluZyggc2VhcmNoIHx8ICcnICk7XHJcblxyXG5cdFx0aWYgKCAhIHBhZ2UgfHwgcGFnZSA8IDEgKSB7XHJcblx0XHRcdHBhZ2UgPSAxO1xyXG5cdFx0fVxyXG5cclxuXHRcdHNldF9lcnJvciggJycgKTtcclxuXHRcdHNldF9jb25maXJtX2VuYWJsZWQoIGZhbHNlICk7XHJcblx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX3NlbGVjdGVkX2Zvcm1fc2x1ZyA9ICcnO1xyXG5cdFx0c2V0X2xvYWRpbmcoIG1vZGFsX2VsLCB0cnVlICk7XHJcblxyXG5cdFx0dy53cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMoXHJcblx0XHRcdG51bGwsXHJcblx0XHRcdHtcclxuXHRcdFx0XHRpbmNsdWRlX2dsb2JhbDogMCxcclxuXHRcdFx0XHRwYWdlICAgICAgICAgIDogcGFnZSxcclxuXHRcdFx0XHRsaW1pdCAgICAgICAgIDogMjAsXHJcblx0XHRcdFx0c2VhcmNoICAgICAgICA6IHNlYXJjaFxyXG5cdFx0XHR9LFxyXG5cdFx0XHRmdW5jdGlvbiAob2ssIGRhdGEpIHtcclxuXHRcdFx0XHRpZiAoICEgb2sgfHwgISBkYXRhIHx8ICEgZGF0YS5mb3JtcyApIHtcclxuXHRcdFx0XHRcdHNldF9sb2FkaW5nKCBtb2RhbF9lbCwgZmFsc2UgKTtcclxuXHRcdFx0XHRcdHNldF9lcnJvciggJ0ZhaWxlZCB0byBsb2FkIGZvcm1zIGxpc3QuJyApO1xyXG5cdFx0XHRcdFx0c2V0X3BhZ2VyKCBtb2RhbF9lbCwgMSwgZmFsc2UgKTtcclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmUoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2Zvcm1zX2NhY2hlID0gZGF0YS5mb3JtcyB8fCBbXTtcclxuXHRcdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX3BhZ2UgICAgICAgID0gZGF0YS5wYWdlIHx8IHBhZ2U7XHJcblx0XHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9oYXNfbW9yZSAgICA9ICEhIGRhdGEuaGFzX21vcmU7XHJcblx0XHRcdFx0bW9kYWxfZWwuX193cGJjX2JmYl9zZWFyY2ggICAgICA9IHNlYXJjaDtcclxuXHJcblx0XHRcdFx0cmVuZGVyX2xpc3QoIG1vZGFsX2VsLCBtb2RhbF9lbC5fX3dwYmNfYmZiX2Zvcm1zX2NhY2hlICk7XHJcblx0XHRcdFx0c2V0X3BhZ2VyKCBtb2RhbF9lbCwgbW9kYWxfZWwuX193cGJjX2JmYl9wYWdlLCBtb2RhbF9lbC5fX3dwYmNfYmZiX2hhc19tb3JlICk7XHJcblxyXG5cdFx0XHRcdHNldF9lcnJvciggJycgKTtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZSggdHJ1ZSwgZGF0YSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cclxuXHRVSS5Nb2RhbF9Mb2FkX0Zvcm0ub3BlbiA9IGZ1bmN0aW9uIChvbl9jb25maXJtLCBvbl9vcGVuKSB7XHJcblxyXG5cdFx0Y29uc3QgcmVmID0gVUkuVGVtcGxhdGVzLmVuc3VyZV9kb21fcmVmX2Zyb21fd3BfdGVtcGxhdGUoIFRQTF9NT0RBTF9JRCwgTU9EQUxfRE9NX0lEICk7XHJcblx0XHRpZiAoICEgcmVmIHx8ICEgcmVmLmVsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bGV0IG1vZGFsX2VsID0gcmVmLmVsO1xyXG5cdFx0aWYgKCBtb2RhbF9lbCAmJiBtb2RhbF9lbC5pZCAhPT0gTU9EQUxfRE9NX0lEICkge1xyXG5cdFx0XHRjb25zdCBpbnNpZGUgPSBtb2RhbF9lbC5xdWVyeVNlbGVjdG9yID8gbW9kYWxfZWwucXVlcnlTZWxlY3RvciggJyMnICsgTU9EQUxfRE9NX0lEICkgOiBudWxsO1xyXG5cdFx0XHRpZiAoIGluc2lkZSApIHtcclxuXHRcdFx0XHRtb2RhbF9lbCA9IGluc2lkZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIG1vZGFsX2VsICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0bW9kYWxfZWwuX193cGJjX2JmYl9sb2FkX2Zvcm1fY2IgPSAodHlwZW9mIG9uX2NvbmZpcm0gPT09ICdmdW5jdGlvbicpID8gb25fY29uZmlybSA6IG51bGw7XHJcblxyXG5cdFx0YmluZF9oYW5kbGVycyggbW9kYWxfZWwgKTtcclxuXHJcblx0XHQvLyBSZXNldCBiYXNpYyBVSS5cclxuXHRcdGNvbnN0IHNlYXJjaF9lbCA9IGdldF9lbCggSURfU0VBUkNIICk7XHJcblx0XHRpZiAoIHNlYXJjaF9lbCApIHtcclxuXHRcdFx0c2VhcmNoX2VsLnZhbHVlID0gJyc7XHJcblx0XHR9XHJcblx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2Zvcm1zX2NhY2hlICAgICAgICA9IFtdO1xyXG5cdFx0bW9kYWxfZWwuX193cGJjX2JmYl9zZWxlY3RlZF9mb3JtX3NsdWcgPSAnJztcclxuXHRcdHNldF9lcnJvciggJycgKTtcclxuXHRcdHNldF9jb25maXJtX2VuYWJsZWQoIGZhbHNlICk7XHJcblx0XHRzZXRfbG9hZGluZyggbW9kYWxfZWwsIHRydWUgKTtcclxuXHJcblx0XHRVSS5Nb2RhbHMuc2hvdyggbW9kYWxfZWwgKTtcclxuXHJcblx0XHQvLyBMb2FkIGxpc3QgdmlhIGFqYXguXHJcblx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX3BhZ2UgICAgID0gMTtcclxuXHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfaGFzX21vcmUgPSBmYWxzZTtcclxuXHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfc2VhcmNoICAgPSAnJztcclxuXHJcblx0XHRsb2FkX2Zvcm1zKCBtb2RhbF9lbCwgMSwgJycgKTtcclxuXHRcdHNldF9wYWdlciggbW9kYWxfZWwsIDEsIGZhbHNlICk7XHJcblxyXG5cdFx0Ly8gRm9jdXMgc2VhcmNoLlxyXG5cdFx0dy5zZXRUaW1lb3V0KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGNvbnN0IHMgPSBnZXRfZWwoIElEX1NFQVJDSCApO1xyXG5cdFx0XHRpZiAoIHMgJiYgcy5mb2N1cyApIHtcclxuXHRcdFx0XHR0cnkgeyBzLmZvY3VzKCk7IH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHRcdH1cclxuXHRcdH0sIDAgKTtcclxuXHJcblx0XHRpZiAoIG9uX29wZW4gKSB7XHJcblx0XHRcdHRyeSB7IG9uX29wZW4oIG1vZGFsX2VsICk7IH0gY2F0Y2ggKCBfZTIgKSB7fVxyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8vIENvbmZpcm0gLyBDYW5jZWwgKGRlbGVnYXRlZCkuXHJcblx0ZC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG5cclxuXHRcdGNvbnN0IG1vZGFsX2VsID0gZ2V0X21vZGFsX2VsKCk7XHJcblx0XHRpZiAoICEgbW9kYWxfZWwgfHwgISBlIHx8ICEgZS50YXJnZXQgfHwgISBlLnRhcmdldC5jbG9zZXN0ICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Y29uc3QgaXNfY29uZmlybSA9IGUudGFyZ2V0LmNsb3Nlc3QoIFNFTF9DT05GSVJNICk7XHJcblx0XHRpZiAoIGlzX2NvbmZpcm0gKSB7XHJcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdGlmICggaXNfY29uZmlybS5jbGFzc0xpc3QuY29udGFpbnMoICdkaXNhYmxlZCcgKSB8fCBpc19jb25maXJtLmdldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnICkgPT09ICd0cnVlJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IHNsdWcgPSBtb2RhbF9lbC5fX3dwYmNfYmZiX3NlbGVjdGVkX2Zvcm1fc2x1ZyB8fCAnJztcclxuXHRcdFx0aWYgKCAhIHNsdWcgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCBjYiAgICAgICAgICAgICAgICAgICAgICAgICA9IG1vZGFsX2VsLl9fd3BiY19iZmJfbG9hZF9mb3JtX2NiIHx8IG51bGw7XHJcblx0XHRcdG1vZGFsX2VsLl9fd3BiY19iZmJfbG9hZF9mb3JtX2NiID0gbnVsbDtcclxuXHJcblx0XHRcdFVJLk1vZGFscy5oaWRlKCBtb2RhbF9lbCApO1xyXG5cclxuXHRcdFx0aWYgKCBjYiApIHtcclxuXHRcdFx0XHQvLyBUcnkgdG8gZmluZCBzZWxlY3RlZCBmdWxsIG9iamVjdDpcclxuXHRcdFx0XHRsZXQgZnVsbCAgID0gbnVsbDtcclxuXHRcdFx0XHRjb25zdCBsaXN0ID0gbW9kYWxfZWwuX193cGJjX2JmYl9mb3Jtc19jYWNoZSB8fCBbXTtcclxuXHRcdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdFx0aWYgKCBTdHJpbmcoIGxpc3RbaV0uZm9ybV9zbHVnIHx8ICcnICkgPT09IFN0cmluZyggc2x1ZyApICkge1xyXG5cdFx0XHRcdFx0XHRmdWxsID0gbGlzdFtpXTtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHRyeSB7IGNiKCB7IGZvcm1fc2x1Zzogc2x1ZywgZm9ybTogZnVsbCB9ICk7IH0gY2F0Y2ggKCBfZTMgKSB7fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRjb25zdCBpc19jYW5jZWwgPSBlLnRhcmdldC5jbG9zZXN0KCBTRUxfQ0FOQ0VMICk7XHJcblx0XHRpZiAoIGlzX2NhbmNlbCApIHtcclxuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRtb2RhbF9lbC5fX3dwYmNfYmZiX2xvYWRfZm9ybV9jYiA9IG51bGw7XHJcblx0XHRcdFVJLk1vZGFscy5oaWRlKCBtb2RhbF9lbCApO1xyXG5cdFx0fVxyXG5cclxuXHR9LCB0cnVlICk7XHJcblxyXG59KSggd2luZG93LCBkb2N1bWVudCApO1xyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfYmZiX19tZW51X2Zvcm1zX19sb2FkKG1lbnVfb3B0aW9uX3RoaXMpIHtcclxuXHJcblx0V1BCQ19CRkJfQ29yZS5VSS5Nb2RhbF9Mb2FkX0Zvcm0ub3BlbiggZnVuY3Rpb24gKHBheWxvYWQpIHtcclxuXHJcblx0XHRpZiAoICEgcGF5bG9hZCB8fCAhIHBheWxvYWQuZm9ybV9zbHVnICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTG9hZCBzZWxlY3RlZCBmb3JtIGludG8gYnVpbGRlci5cclxuXHRcdGlmICggdHlwZW9mIHdpbmRvdy53cGJjX2JmYl9fYWpheF9sb2FkX2Zvcm1fYnlfc2x1ZyAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0d3BiY19hZG1pbl9zaG93X21lc3NhZ2UoICdXUEJDIEJGQjogbG9hZC1ieS1zbHVnIGhlbHBlciBtaXNzaW5nLicsICdlcnJvcicsIDEwMDAwICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR3aW5kb3cud3BiY19iZmJfX2FqYXhfbG9hZF9mb3JtX2J5X3NsdWcoIHBheWxvYWQuZm9ybV9zbHVnLCBtZW51X29wdGlvbl90aGlzLCBmdW5jdGlvbiAob2ssIGRhdGEpIHtcclxuXHRcdFx0aWYgKCBvayApIHtcclxuXHRcdFx0XHR3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSggJ0Zvcm0gbG9hZGVkJywgJ3N1Y2Nlc3MnLCAxNTAwLCBmYWxzZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9ICk7XHJcblxyXG5cdH0gKTtcclxufVxyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQyxVQUFVQSxDQUFDLEVBQUVDLENBQUMsRUFBRTtFQUNoQixZQUFZOztFQUVaLE1BQU1DLElBQUksR0FBWUYsQ0FBQyxDQUFDRyxhQUFhLEdBQUdILENBQUMsQ0FBQ0csYUFBYSxJQUFJLENBQUMsQ0FBRTtFQUM5RCxNQUFNQyxFQUFFLEdBQWNGLElBQUksQ0FBQ0UsRUFBRSxHQUFHRixJQUFJLENBQUNFLEVBQUUsSUFBSSxDQUFDLENBQUU7RUFDOUNBLEVBQUUsQ0FBQ0MsZUFBZSxHQUFHRCxFQUFFLENBQUNDLGVBQWUsSUFBSSxDQUFDLENBQUM7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

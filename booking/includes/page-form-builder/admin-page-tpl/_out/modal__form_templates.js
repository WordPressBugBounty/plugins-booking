"use strict";

/**
 * @file: ../includes/page-form-builder/admin-page-tpl/_src/modal__form_templates.js
 */
(function (w, d) {
  'use strict';

  const Core = w.WPBC_BFB_Core = w.WPBC_BFB_Core || {};
  const UI = Core.UI = Core.UI || {};
  UI.Template_Picker = UI.Template_Picker || {};
  function wpbc_bfb__i18n(key, fallback) {
    try {
      const cfg = w.WPBC_BFB_Ajax || {};
      const val = cfg && typeof cfg[key] !== 'undefined' ? String(cfg[key]) : '';
      return val ? val : String(fallback || '');
    } catch (_e) {
      return String(fallback || '');
    }
  }

  /**
   * Get configured OR separator for multi-keyword search.
   *
   * @returns {string}
   */
  function wpbc_bfb__get_template_search_or_sep() {
    try {
      const cfg = w.WPBC_BFB_Ajax || {};
      const v = cfg && cfg.template_search_or_sep ? String(cfg.template_search_or_sep) : '';
      return v ? v : '|';
    } catch (_e) {
      return '|';
    }
  }

  /**
   * Get URL OR separator.
   *
   * @returns {string}
   */
  function wpbc_bfb__get_template_search_or_sep_url() {
    try {
      const cfg = w.WPBC_BFB_Ajax || {};
      const v = cfg && cfg.template_search_or_sep_url ? String(cfg.template_search_or_sep_url) : '';
      return v ? v : '^';
    } catch (_e) {
      return '^';
    }
  }

  /**
   * Escape a string for use in RegExp constructor.
   *
   * @param {string} s
   * @returns {string}
   */
  function wpbc_bfb__escape_regex(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Normalize a search string so server-side split works.
   *
   * @param {string} raw
   * @returns {string}
   */
  function wpbc_bfb__normalize_template_search(raw) {
    let s = String(raw || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    const sep = wpbc_bfb__get_template_search_or_sep();
    const url_sep = wpbc_bfb__get_template_search_or_sep_url();
    if (url_sep && url_sep !== sep) {
      const esc_url = wpbc_bfb__escape_regex(url_sep);
      s = s.replace(new RegExp('\\s*' + esc_url + '\\s*', 'g'), sep);
    }
    s = s.replace(/\s*\|\s*/g, sep);
    const esc = wpbc_bfb__escape_regex(sep);
    s = s.replace(new RegExp('\\s*' + esc + '\\s*', 'g'), sep);
    s = s.replace(new RegExp(esc + '{2,}', 'g'), sep);
    s = s.replace(new RegExp('^' + esc + '+|' + esc + '+$', 'g'), '').trim();
    if (s.length > 80) {
      s = s.slice(0, 80).trim();
    }
    return s;
  }

  /**
   * Escape HTML.
   *
   * @param {*} s
   * @returns {string}
   */
  function wpbc_bfb__escape_html(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  /**
   * Get config text.
   *
   * @param {string} key
   * @param {string} fallback
   * @returns {string}
   */
  function wpbc_bfb__get_cfg_text(key, fallback) {
    try {
      const cfg = w.WPBC_BFB_Ajax || {};
      const val = cfg && cfg[key] ? String(cfg[key]) : '';
      return val ? val : String(fallback || '');
    } catch (_e) {
      return String(fallback || '');
    }
  }

  /**
   * Toggle busy state for template delete button.
   *
   * @param {HTMLElement|null} delete_btn
   * @param {boolean} is_busy
   * @returns {void}
   */
  function wpbc_bfb__set_tpl_delete_busy(delete_btn, is_busy) {
    if (!delete_btn) {
      return;
    }
    if (is_busy) {
      delete_btn.setAttribute('aria-disabled', 'true');
      delete_btn.style.pointerEvents = 'none';
      delete_btn.style.opacity = '0.5';
    } else {
      delete_btn.setAttribute('aria-disabled', 'false');
      delete_btn.style.pointerEvents = '';
      delete_btn.style.opacity = '';
    }
  }
  UI.Template_Picker.create = function (args) {
    args = args || {};
    const api = {};
    api.modal_el = args.modal_el || null;
    api.search_input_id = args.search_input_id || '';
    api.blank_template_slug = args.blank_template_slug || '__blank__';
    api.allow_delete = !!args.allow_delete;
    api.allow_presets = !!args.allow_presets;
    api.allow_same_click_blank = !!args.allow_same_click_blank;
    api.empty_text = String(args.empty_text || 'No templates found.');
    api.blank_desc = String(args.blank_desc || 'Start with an empty layout.');
    api.list_helper_missing_text = String(args.list_helper_missing_text || 'WPBC BFB: list forms helper missing.');
    api.load_failed_text = String(args.load_failed_text || 'Failed to load templates list.');
    api.on_selection_change = typeof args.on_selection_change === 'function' ? args.on_selection_change : function () {};
    api.on_delete_click = typeof args.on_delete_click === 'function' ? args.on_delete_click : null;
    api.on_set_error = typeof args.on_set_error === 'function' ? args.on_set_error : function () {};
    api.get_search_input = function () {
      return api.search_input_id ? d.getElementById(api.search_input_id) : null;
    };
    api.get_list_root = function () {
      return api.modal_el ? api.modal_el.querySelector('[data-wpbc-bfb-tpl-list="1"]') : null;
    };
    api.get_pager_root = function () {
      return api.modal_el ? api.modal_el.querySelector('[data-wpbc-bfb-tpl-pager="1"]') : null;
    };
    api.get_selected_template_slug = function () {
      if (!api.modal_el) {
        return api.blank_template_slug;
      }
      const v = String(api.modal_el.__wpbc_bfb_selected_template_slug || '');
      return v ? v : api.blank_template_slug;
    };
    api.set_selected_template_slug = function (slug) {
      if (!api.modal_el) {
        return;
      }
      slug = String(slug || '').trim();
      api.modal_el.__wpbc_bfb_selected_template_slug = slug ? slug : api.blank_template_slug;
    };
    api.count_real_templates = function (forms) {
      let count = 0;
      for (let i = 0; i < (forms || []).length; i++) {
        const item = forms[i] || {};
        const slug = String(item.form_slug || '');
        if (slug && slug !== api.blank_template_slug) {
          count++;
        }
      }
      return count;
    };

    /**
     * Delete template by delete button element and refresh current picker list.
     *
     * @param {HTMLElement} delete_btn
     * @param {Function} done Optional callback function(ok:boolean, resp:Object|null)
     * @returns {void}
     */
    api.delete_template = function (delete_btn, done) {
      if (!delete_btn) {
        if (typeof done === 'function') {
          done(false, null);
        }
        return;
      }
      if (delete_btn.getAttribute('aria-disabled') === 'true') {
        return;
      }
      const template_slug = String(delete_btn.getAttribute('data-template-slug') || '').trim();
      const template_title = String(delete_btn.getAttribute('data-template-title') || template_slug).trim();
      if (!template_slug || template_slug === api.blank_template_slug) {
        if (typeof done === 'function') {
          done(false, null);
        }
        return;
      }
      if (typeof w.wpbc_bfb__ajax_delete_template_by_slug !== 'function') {
        const missing_msg = wpbc_bfb__get_cfg_text('template_delete_missing_helper', 'WPBC BFB: template delete helper is not available.');
        api.on_set_error(missing_msg);
        if (typeof w.wpbc_admin_show_message === 'function') {
          w.wpbc_admin_show_message(missing_msg, 'error', 10000);
        }
        if (typeof done === 'function') {
          done(false, null);
        }
        return;
      }
      const confirm_text = wpbc_bfb__get_cfg_text('template_delete_confirm', 'Delete template "%s"? This action cannot be undone.').replace('%s', template_title || template_slug);
      if (!w.confirm(confirm_text)) {
        return;
      }
      api.on_set_error('');
      wpbc_bfb__set_tpl_delete_busy(delete_btn, true);
      w.wpbc_bfb__ajax_delete_template_by_slug(template_slug, function (ok, resp) {
        wpbc_bfb__set_tpl_delete_busy(delete_btn, false);
        if (!ok || !resp || !resp.success) {
          let error_message = '';
          try {
            error_message = resp && resp.data && resp.data.message ? String(resp.data.message) : '';
          } catch (_e0) {
            error_message = '';
          }
          if (!error_message) {
            error_message = wpbc_bfb__get_cfg_text('template_delete_failed', 'Failed to delete template.');
          }
          api.on_set_error(error_message);
          if (typeof w.wpbc_admin_show_message === 'function') {
            w.wpbc_admin_show_message(error_message, 'error', 10000);
          }
          if (typeof done === 'function') {
            done(false, resp);
          }
          return;
        }
        if (api.get_selected_template_slug() === template_slug) {
          api.set_selected_template_slug(api.blank_template_slug);
        }
        const current_page = parseInt(api.modal_el && api.modal_el.__wpbc_bfb_tpl_page || 1, 10) || 1;
        const current_search = String(api.modal_el && api.modal_el.__wpbc_bfb_tpl_search || '');
        const finish_success = function () {
          api.on_selection_change(api.get_selected_template_slug(), api);
          if (typeof w.wpbc_admin_show_message === 'function') {
            const success_message = resp && resp.data && resp.data.message ? String(resp.data.message) : wpbc_bfb__get_cfg_text('template_delete_success', 'Template deleted.');
            w.wpbc_admin_show_message(success_message, 'success', 4000, false);
          }
          if (typeof done === 'function') {
            done(true, resp);
          }
        };
        api.load_templates(current_page, current_search, function (load_ok) {
          if (load_ok && current_page > 1 && api.count_real_templates(api.modal_el && api.modal_el.__wpbc_bfb_templates_cache || []) < 1) {
            api.load_templates(current_page - 1, current_search, function () {
              finish_success();
            });
            return;
          }
          finish_success();
        });
      });
    };
    api.sync_template_search_presets = function (current_search) {
      if (!api.modal_el || !api.allow_presets) {
        return;
      }
      const root = api.modal_el.querySelector('[data-wpbc-bfb-tpl-search-presets="1"]');
      if (!root) {
        return;
      }
      current_search = wpbc_bfb__normalize_template_search(current_search);
      root.querySelectorAll('[data-wpbc-bfb-tpl-search-key]').forEach(function (btn) {
        const preset_search = wpbc_bfb__normalize_template_search(btn.getAttribute('data-wpbc-bfb-tpl-search-key') || '');
        const is_active = preset_search === current_search;
        btn.setAttribute('aria-pressed', is_active ? 'true' : 'false');
        btn.classList.toggle('is-active', is_active);
      });
    };
    api.set_loading = function (is_loading) {
      const root = api.get_list_root();
      if (!root) {
        return;
      }
      if (is_loading) {
        let spin = '';
        try {
          const src = d.querySelector('.wpbc_bfb_popup_modal__forms_loading_spin_container');
          if (src) {
            spin = src.outerHTML;
          }
        } catch (_e) {}
        root.innerHTML = spin || '<div style="padding:10px;color:#656565;">' + wpbc_bfb__escape_html(wpbc_bfb__i18n('text_loading', 'Loading...')) + '</div>';
      }
    };
    api.set_pager = function (page, has_more) {
      const pager = api.get_pager_root();
      if (!pager) {
        return;
      }
      const prev = pager.querySelector('[data-wpbc-bfb-tpl-page-prev="1"]');
      const next = pager.querySelector('[data-wpbc-bfb-tpl-page-next="1"]');
      const lab = pager.querySelector('[data-wpbc-bfb-tpl-page-label="1"]');
      page = parseInt(page || 1, 10);
      if (!page || page < 1) {
        page = 1;
      }
      if (lab) {
        lab.textContent = wpbc_bfb__escape_html(wpbc_bfb__i18n('text_page', 'Page')) + ' ' + page;
      }
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
      set_btn(prev, page > 1);
      set_btn(next, !!has_more);
    };
    api.refresh_selection_highlight = function () {
      const root = api.get_list_root();
      if (!root) {
        return;
      }
      const sel = api.get_selected_template_slug();
      let found = null;
      root.querySelectorAll('.wpbc_bfb__load_form_item').forEach(function (el) {
        el.classList.remove('wpbc_bfb__load_form_item_selected');
      });
      try {
        found = root.querySelector('[data-template-slug="' + CSS.escape(sel) + '"]');
      } catch (_e) {
        found = null;
      }
      if (found) {
        found.classList.add('wpbc_bfb__load_form_item_selected');
      }
    };
    api.render_list = function (forms) {
      const root = api.get_list_root();
      if (!root) {
        return;
      }
      let html = '';
      html += '' + '<div class="wpbc_bfb__load_form_item" data-wpbc-bfb-tpl-item="1" data-template-slug="' + wpbc_bfb__escape_html(api.blank_template_slug) + '">' + '  <div class="wpbc_bfb__load_form_item_thumb">' + '    <div class="wpbc_bfb__load_form_item_thumb_blank_img">' + wpbc_bfb__escape_html(wpbc_bfb__i18n('text_blank_thumb', 'Blank')) + '</div>' + '  </div>' + '  <div class="wpbc_bfb__load_form_item_text">' + '    <div class="form_item_text_title">' + wpbc_bfb__escape_html(wpbc_bfb__i18n('text_blank_form_title', 'Blank Form')) + '</div>' + '    <div class="form_item_text_slug">' + wpbc_bfb__escape_html(api.blank_template_slug) + '</div>' + '    <div class="form_item_text_desc">' + wpbc_bfb__escape_html(api.blank_desc) + '</div>' + '  </div>' + '</div>';
      let any_templates = false;
      const delete_label = wpbc_bfb__get_cfg_text('template_delete_label', 'Delete template');
      for (let i = 0; i < (forms || []).length; i++) {
        const item = forms[i] || {};
        const slug = String(item.form_slug || '');
        if (!slug || slug === api.blank_template_slug) {
          continue;
        }
        any_templates = true;
        const title = String(item.title || slug || '');
        const desc = String(item.description || '');
        const pic = String(item.picture_url || item.image_url || '');
        const thumb = pic ? '<img src="' + wpbc_bfb__escape_html(pic) + '" alt="" />' : '<div class="wpbc_bfb__load_form_item_thumb_blank_img">' + wpbc_bfb__escape_html(wpbc_bfb__i18n('text_no_image_thumb', 'No image')) + '</div>';
        let delete_btn = '';
        if (api.allow_delete && parseInt(item.can_delete || 0, 10) === 1) {
          delete_btn = '' + '<a href="#"' + ' class="button-link-delete"' + ' data-wpbc-bfb-tpl-delete="1"' + ' data-template-slug="' + wpbc_bfb__escape_html(slug) + '"' + ' data-template-title="' + wpbc_bfb__escape_html(title) + '"' + ' aria-label="' + wpbc_bfb__escape_html(delete_label) + '"' + ' title="' + wpbc_bfb__escape_html(delete_label) + '"' + ' style="margin-left:auto;color:#b32d2e;text-decoration:none;line-height:1;">' + '   <span class="dashicons dashicons-trash" aria-hidden="true"></span>' + '</a>';
        }
        const meta = '<div class="form_item_text_slug" title="' + wpbc_bfb__escape_html(slug) + '">' + wpbc_bfb__escape_html(slug) + '</div>';
        const line2 = desc ? '<div class="form_item_text_desc" title="' + wpbc_bfb__escape_html(desc) + '">' + '<span class="form_item_text_desc__text">' + wpbc_bfb__escape_html(desc) + '</span>' + delete_btn + '</div>' : delete_btn ? '<div class="form_item_text_desc">' + delete_btn + '</div>' : '';
        html += '' + '<div class="wpbc_bfb__load_form_item" data-wpbc-bfb-tpl-item="1" data-template-slug="' + wpbc_bfb__escape_html(slug) + '">' + '  <div class="wpbc_bfb__load_form_item_thumb">' + thumb + '</div>' + '  <div class="wpbc_bfb__load_form_item_text">' + '    <div style="display:flex;align-items:flex-start;gap:8px;">' + '      <div class="form_item_text_title" style="flex:1 1 auto;">' + wpbc_bfb__escape_html(title) + '</div>' + '    </div>' + meta + line2 + '  </div>' + '</div>';
      }
      if (!any_templates) {
        html += '<div style="padding:10px;color:#666;">' + wpbc_bfb__escape_html(api.empty_text) + '</div>';
      }
      root.innerHTML = html;
      api.refresh_selection_highlight();
    };
    api.load_templates = function (page, search, done) {
      if (typeof w.wpbc_bfb__ajax_list_user_forms !== 'function') {
        api.on_set_error(api.list_helper_missing_text);
        api.set_loading(false);
        api.set_pager(1, false);
        api.render_list([]);
        if (typeof done === 'function') {
          done(false, null);
        }
        return;
      }
      page = parseInt(page || 1, 10);
      search = wpbc_bfb__normalize_template_search(search);
      if (!page || page < 1) {
        page = 1;
      }
      api.on_set_error('');
      api.set_loading(true);
      w.wpbc_bfb__ajax_list_user_forms(null, {
        include_global: 1,
        status: 'template',
        page: page,
        limit: 20,
        search: search
      }, function (ok, data) {
        if (!ok || !data || !data.forms) {
          api.set_loading(false);
          api.on_set_error(api.load_failed_text);
          api.set_pager(1, false);
          api.render_list([]);
          if (typeof done === 'function') {
            done(false, null);
          }
          return;
        }
        api.modal_el.__wpbc_bfb_templates_cache = data.forms || [];
        api.modal_el.__wpbc_bfb_tpl_page = data.page || page;
        api.modal_el.__wpbc_bfb_tpl_has_more = !!data.has_more;
        api.modal_el.__wpbc_bfb_tpl_search = search;
        api.sync_template_search_presets(search);
        api.render_list(api.modal_el.__wpbc_bfb_templates_cache);
        api.set_pager(api.modal_el.__wpbc_bfb_tpl_page, api.modal_el.__wpbc_bfb_tpl_has_more);
        if (typeof done === 'function') {
          done(true, data);
        }
      });
    };
    api.apply_search_value = function (search_value, done) {
      const search_el = api.get_search_input();
      const normalized_search = wpbc_bfb__normalize_template_search(search_value);
      if (search_el) {
        search_el.value = normalized_search;
      }
      if (api.modal_el) {
        api.modal_el.__wpbc_bfb_tpl_search = normalized_search;
      }
      api.sync_template_search_presets(normalized_search);
      api.load_templates(1, normalized_search, done);
    };
    api.reset_state = function () {
      const search_el = api.get_search_input();
      if (search_el) {
        search_el.value = '';
      }
      if (api.modal_el) {
        api.modal_el.__wpbc_bfb_selected_template_slug = api.blank_template_slug;
        api.modal_el.__wpbc_bfb_templates_cache = [];
        api.modal_el.__wpbc_bfb_tpl_page = 1;
        api.modal_el.__wpbc_bfb_tpl_has_more = false;
        api.modal_el.__wpbc_bfb_tpl_search = '';
        if (api.modal_el.__wpbc_bfb_tpl_search_timer) {
          try {
            clearTimeout(api.modal_el.__wpbc_bfb_tpl_search_timer);
          } catch (_e) {}
        }
        api.modal_el.__wpbc_bfb_tpl_search_timer = 0;
      }
      api.sync_template_search_presets('');
      api.on_set_error('');
    };
    api.bind_handlers = function () {
      if (!api.modal_el || api.modal_el.__wpbc_bfb_template_picker_handlers_bound) {
        return;
      }
      api.modal_el.__wpbc_bfb_template_picker_handlers_bound = true;
      const search_el = api.get_search_input();
      api.modal_el.addEventListener('click', function (e) {
        if (!e || !e.target || !e.target.closest) {
          return;
        }
        const delete_btn = e.target.closest('[data-wpbc-bfb-tpl-delete="1"]');
        if (delete_btn) {
          if (!api.allow_delete) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          if (api.on_delete_click) {
            api.on_delete_click(delete_btn, api);
          } else if (typeof api.delete_template === 'function') {
            api.delete_template(delete_btn);
          }
          return;
        }
        const preset_btn = e.target.closest('[data-wpbc-bfb-tpl-search-key]');
        if (preset_btn) {
          e.preventDefault();
          e.stopPropagation();
          api.apply_search_value(preset_btn.getAttribute('data-wpbc-bfb-tpl-search-key') || '', function () {
            api.on_selection_change(api.get_selected_template_slug(), api);
          });
          return;
        }
        const pager = e.target.closest('[data-wpbc-bfb-tpl-pager="1"]');
        if (pager) {
          const prev = e.target.closest('[data-wpbc-bfb-tpl-page-prev="1"]');
          const next = e.target.closest('[data-wpbc-bfb-tpl-page-next="1"]');
          if (!prev && !next) {
            return;
          }
          e.preventDefault();
          if (prev && (prev.classList.contains('disabled') || prev.getAttribute('aria-disabled') === 'true') || next && (next.classList.contains('disabled') || next.getAttribute('aria-disabled') === 'true')) {
            return;
          }
          const page = parseInt(api.modal_el.__wpbc_bfb_tpl_page || 1, 10) || 1;
          const search = String(api.modal_el.__wpbc_bfb_tpl_search || '');
          if (prev) {
            api.load_templates(Math.max(1, page - 1), search, function () {});
          }
          if (next) {
            api.load_templates(page + 1, search, function () {});
          }
          return;
        }
        const item = e.target.closest('[data-wpbc-bfb-tpl-item="1"]');
        if (!item) {
          return;
        }
        e.preventDefault();
        const clicked = item.getAttribute('data-template-slug') || '';
        const current = api.get_selected_template_slug();
        if (clicked && clicked === current && clicked !== api.blank_template_slug && api.allow_same_click_blank) {
          api.set_selected_template_slug(api.blank_template_slug);
        } else if (clicked) {
          api.set_selected_template_slug(clicked);
        } else {
          api.set_selected_template_slug(api.blank_template_slug);
        }
        api.refresh_selection_highlight();
        api.on_selection_change(api.get_selected_template_slug(), api);
      }, true);
      if (search_el) {
        search_el.addEventListener('input', function () {
          const v = String(search_el.value || '');
          if (api.modal_el.__wpbc_bfb_tpl_search_timer) {
            clearTimeout(api.modal_el.__wpbc_bfb_tpl_search_timer);
          }
          api.modal_el.__wpbc_bfb_tpl_search_timer = setTimeout(function () {
            api.apply_search_value(v, function () {
              api.on_selection_change(api.get_selected_template_slug(), api);
            });
          }, 300);
        }, true);
      }
    };
    return api;
  };
  w.wpbc_bfb__get_template_search_or_sep = wpbc_bfb__get_template_search_or_sep;
  w.wpbc_bfb__get_template_search_or_sep_url = wpbc_bfb__get_template_search_or_sep_url;
  w.wpbc_bfb__escape_regex = wpbc_bfb__escape_regex;
  w.wpbc_bfb__normalize_template_search = wpbc_bfb__normalize_template_search;
  w.wpbc_bfb__i18n = wpbc_bfb__i18n;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX291dC9tb2RhbF9fZm9ybV90ZW1wbGF0ZXMuanMiLCJuYW1lcyI6WyJ3IiwiZCIsIkNvcmUiLCJXUEJDX0JGQl9Db3JlIiwiVUkiLCJUZW1wbGF0ZV9QaWNrZXIiLCJ3cGJjX2JmYl9faTE4biIsImtleSIsImZhbGxiYWNrIiwiY2ZnIiwiV1BCQ19CRkJfQWpheCIsInZhbCIsIlN0cmluZyIsIl9lIiwid3BiY19iZmJfX2dldF90ZW1wbGF0ZV9zZWFyY2hfb3Jfc2VwIiwidiIsInRlbXBsYXRlX3NlYXJjaF9vcl9zZXAiLCJ3cGJjX2JmYl9fZ2V0X3RlbXBsYXRlX3NlYXJjaF9vcl9zZXBfdXJsIiwidGVtcGxhdGVfc2VhcmNoX29yX3NlcF91cmwiLCJ3cGJjX2JmYl9fZXNjYXBlX3JlZ2V4IiwicyIsInJlcGxhY2UiLCJ3cGJjX2JmYl9fbm9ybWFsaXplX3RlbXBsYXRlX3NlYXJjaCIsInJhdyIsInRyaW0iLCJzZXAiLCJ1cmxfc2VwIiwiZXNjX3VybCIsIlJlZ0V4cCIsImVzYyIsImxlbmd0aCIsInNsaWNlIiwid3BiY19iZmJfX2VzY2FwZV9odG1sIiwid3BiY19iZmJfX2dldF9jZmdfdGV4dCIsIndwYmNfYmZiX19zZXRfdHBsX2RlbGV0ZV9idXN5IiwiZGVsZXRlX2J0biIsImlzX2J1c3kiLCJzZXRBdHRyaWJ1dGUiLCJzdHlsZSIsInBvaW50ZXJFdmVudHMiLCJvcGFjaXR5IiwiY3JlYXRlIiwiYXJncyIsImFwaSIsIm1vZGFsX2VsIiwic2VhcmNoX2lucHV0X2lkIiwiYmxhbmtfdGVtcGxhdGVfc2x1ZyIsImFsbG93X2RlbGV0ZSIsImFsbG93X3ByZXNldHMiLCJhbGxvd19zYW1lX2NsaWNrX2JsYW5rIiwiZW1wdHlfdGV4dCIsImJsYW5rX2Rlc2MiLCJsaXN0X2hlbHBlcl9taXNzaW5nX3RleHQiLCJsb2FkX2ZhaWxlZF90ZXh0Iiwib25fc2VsZWN0aW9uX2NoYW5nZSIsIm9uX2RlbGV0ZV9jbGljayIsIm9uX3NldF9lcnJvciIsImdldF9zZWFyY2hfaW5wdXQiLCJnZXRFbGVtZW50QnlJZCIsImdldF9saXN0X3Jvb3QiLCJxdWVyeVNlbGVjdG9yIiwiZ2V0X3BhZ2VyX3Jvb3QiLCJnZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyIsIl9fd3BiY19iZmJfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyIsInNldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnIiwic2x1ZyIsImNvdW50X3JlYWxfdGVtcGxhdGVzIiwiZm9ybXMiLCJjb3VudCIsImkiLCJpdGVtIiwiZm9ybV9zbHVnIiwiZGVsZXRlX3RlbXBsYXRlIiwiZG9uZSIsImdldEF0dHJpYnV0ZSIsInRlbXBsYXRlX3NsdWciLCJ0ZW1wbGF0ZV90aXRsZSIsIndwYmNfYmZiX19hamF4X2RlbGV0ZV90ZW1wbGF0ZV9ieV9zbHVnIiwibWlzc2luZ19tc2ciLCJ3cGJjX2FkbWluX3Nob3dfbWVzc2FnZSIsImNvbmZpcm1fdGV4dCIsImNvbmZpcm0iLCJvayIsInJlc3AiLCJzdWNjZXNzIiwiZXJyb3JfbWVzc2FnZSIsImRhdGEiLCJtZXNzYWdlIiwiX2UwIiwiY3VycmVudF9wYWdlIiwicGFyc2VJbnQiLCJfX3dwYmNfYmZiX3RwbF9wYWdlIiwiY3VycmVudF9zZWFyY2giLCJfX3dwYmNfYmZiX3RwbF9zZWFyY2giLCJmaW5pc2hfc3VjY2VzcyIsInN1Y2Nlc3NfbWVzc2FnZSIsImxvYWRfdGVtcGxhdGVzIiwibG9hZF9vayIsIl9fd3BiY19iZmJfdGVtcGxhdGVzX2NhY2hlIiwic3luY190ZW1wbGF0ZV9zZWFyY2hfcHJlc2V0cyIsInJvb3QiLCJxdWVyeVNlbGVjdG9yQWxsIiwiZm9yRWFjaCIsImJ0biIsInByZXNldF9zZWFyY2giLCJpc19hY3RpdmUiLCJjbGFzc0xpc3QiLCJ0b2dnbGUiLCJzZXRfbG9hZGluZyIsImlzX2xvYWRpbmciLCJzcGluIiwic3JjIiwib3V0ZXJIVE1MIiwiaW5uZXJIVE1MIiwic2V0X3BhZ2VyIiwicGFnZSIsImhhc19tb3JlIiwicGFnZXIiLCJwcmV2IiwibmV4dCIsImxhYiIsInRleHRDb250ZW50Iiwic2V0X2J0biIsImVuYWJsZWQiLCJyZW1vdmUiLCJhZGQiLCJyZWZyZXNoX3NlbGVjdGlvbl9oaWdobGlnaHQiLCJzZWwiLCJmb3VuZCIsImVsIiwiQ1NTIiwiZXNjYXBlIiwicmVuZGVyX2xpc3QiLCJodG1sIiwiYW55X3RlbXBsYXRlcyIsImRlbGV0ZV9sYWJlbCIsInRpdGxlIiwiZGVzYyIsImRlc2NyaXB0aW9uIiwicGljIiwicGljdHVyZV91cmwiLCJpbWFnZV91cmwiLCJ0aHVtYiIsImNhbl9kZWxldGUiLCJtZXRhIiwibGluZTIiLCJzZWFyY2giLCJ3cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMiLCJpbmNsdWRlX2dsb2JhbCIsInN0YXR1cyIsImxpbWl0IiwiX193cGJjX2JmYl90cGxfaGFzX21vcmUiLCJhcHBseV9zZWFyY2hfdmFsdWUiLCJzZWFyY2hfdmFsdWUiLCJzZWFyY2hfZWwiLCJub3JtYWxpemVkX3NlYXJjaCIsInZhbHVlIiwicmVzZXRfc3RhdGUiLCJfX3dwYmNfYmZiX3RwbF9zZWFyY2hfdGltZXIiLCJjbGVhclRpbWVvdXQiLCJiaW5kX2hhbmRsZXJzIiwiX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXJfaGFuZGxlcnNfYm91bmQiLCJhZGRFdmVudExpc3RlbmVyIiwiZSIsInRhcmdldCIsImNsb3Nlc3QiLCJwcmV2ZW50RGVmYXVsdCIsInN0b3BQcm9wYWdhdGlvbiIsInByZXNldF9idG4iLCJjb250YWlucyIsIk1hdGgiLCJtYXgiLCJjbGlja2VkIiwiY3VycmVudCIsInNldFRpbWVvdXQiLCJ3aW5kb3ciLCJkb2N1bWVudCJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2FkbWluLXBhZ2UtdHBsL19zcmMvbW9kYWxfX2Zvcm1fdGVtcGxhdGVzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBAZmlsZTogLi4vaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvYWRtaW4tcGFnZS10cGwvX3NyYy9tb2RhbF9fZm9ybV90ZW1wbGF0ZXMuanNcclxuICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Y29uc3QgQ29yZSA9ICh3LldQQkNfQkZCX0NvcmUgPSB3LldQQkNfQkZCX0NvcmUgfHwge30pO1xyXG5cdGNvbnN0IFVJICAgPSAoQ29yZS5VSSA9IENvcmUuVUkgfHwge30pO1xyXG5cclxuXHRVSS5UZW1wbGF0ZV9QaWNrZXIgPSBVSS5UZW1wbGF0ZV9QaWNrZXIgfHwge307XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19pMThuKGtleSwgZmFsbGJhY2spIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGNvbnN0IGNmZyA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdFx0Y29uc3QgdmFsID0gKGNmZyAmJiB0eXBlb2YgY2ZnW2tleV0gIT09ICd1bmRlZmluZWQnKSA/IFN0cmluZyggY2ZnW2tleV0gKSA6ICcnO1xyXG5cdFx0XHRyZXR1cm4gdmFsID8gdmFsIDogU3RyaW5nKCBmYWxsYmFjayB8fCAnJyApO1xyXG5cdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBmYWxsYmFjayB8fCAnJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGNvbmZpZ3VyZWQgT1Igc2VwYXJhdG9yIGZvciBtdWx0aS1rZXl3b3JkIHNlYXJjaC5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2dldF90ZW1wbGF0ZV9zZWFyY2hfb3Jfc2VwKCkge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Y29uc3QgY2ZnID0gdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdFx0XHRjb25zdCB2ID0gKCBjZmcgJiYgY2ZnLnRlbXBsYXRlX3NlYXJjaF9vcl9zZXAgKSA/IFN0cmluZyggY2ZnLnRlbXBsYXRlX3NlYXJjaF9vcl9zZXAgKSA6ICcnO1xyXG5cdFx0XHRyZXR1cm4gdiA/IHYgOiAnfCc7XHJcblx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdHJldHVybiAnfCc7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgVVJMIE9SIHNlcGFyYXRvci5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2dldF90ZW1wbGF0ZV9zZWFyY2hfb3Jfc2VwX3VybCgpIHtcclxuXHRcdHRyeSB7XHJcblx0XHRcdGNvbnN0IGNmZyA9IHcuV1BCQ19CRkJfQWpheCB8fCB7fTtcclxuXHRcdFx0Y29uc3QgdiA9ICggY2ZnICYmIGNmZy50ZW1wbGF0ZV9zZWFyY2hfb3Jfc2VwX3VybCApID8gU3RyaW5nKCBjZmcudGVtcGxhdGVfc2VhcmNoX29yX3NlcF91cmwgKSA6ICcnO1xyXG5cdFx0XHRyZXR1cm4gdiA/IHYgOiAnXic7XHJcblx0XHR9IGNhdGNoICggX2UgKSB7XHJcblx0XHRcdHJldHVybiAnXic7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBFc2NhcGUgYSBzdHJpbmcgZm9yIHVzZSBpbiBSZWdFeHAgY29uc3RydWN0b3IuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc1xyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2VzY2FwZV9yZWdleChzKSB7XHJcblx0XHRyZXR1cm4gU3RyaW5nKCBzIHx8ICcnICkucmVwbGFjZSggL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJyApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogTm9ybWFsaXplIGEgc2VhcmNoIHN0cmluZyBzbyBzZXJ2ZXItc2lkZSBzcGxpdCB3b3Jrcy5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSByYXdcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19ub3JtYWxpemVfdGVtcGxhdGVfc2VhcmNoKHJhdykge1xyXG5cdFx0bGV0IHMgPSBTdHJpbmcoIHJhdyB8fCAnJyApXHJcblx0XHRcdC5yZXBsYWNlKCAvW1xcdTAwMDAtXFx1MDAxRlxcdTAwN0ZdL2csICcgJyApXHJcblx0XHRcdC5yZXBsYWNlKCAvXFxzKy9nLCAnICcgKVxyXG5cdFx0XHQudHJpbSgpO1xyXG5cclxuXHRcdGNvbnN0IHNlcCAgICA9IHdwYmNfYmZiX19nZXRfdGVtcGxhdGVfc2VhcmNoX29yX3NlcCgpO1xyXG5cdFx0Y29uc3QgdXJsX3NlcCA9IHdwYmNfYmZiX19nZXRfdGVtcGxhdGVfc2VhcmNoX29yX3NlcF91cmwoKTtcclxuXHJcblx0XHRpZiAoIHVybF9zZXAgJiYgdXJsX3NlcCAhPT0gc2VwICkge1xyXG5cdFx0XHRjb25zdCBlc2NfdXJsID0gd3BiY19iZmJfX2VzY2FwZV9yZWdleCggdXJsX3NlcCApO1xyXG5cdFx0XHRzID0gcy5yZXBsYWNlKCBuZXcgUmVnRXhwKCAnXFxcXHMqJyArIGVzY191cmwgKyAnXFxcXHMqJywgJ2cnICksIHNlcCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHMgPSBzLnJlcGxhY2UoIC9cXHMqXFx8XFxzKi9nLCBzZXAgKTtcclxuXHJcblx0XHRjb25zdCBlc2MgPSB3cGJjX2JmYl9fZXNjYXBlX3JlZ2V4KCBzZXAgKTtcclxuXHRcdHMgPSBzLnJlcGxhY2UoIG5ldyBSZWdFeHAoICdcXFxccyonICsgZXNjICsgJ1xcXFxzKicsICdnJyApLCBzZXAgKTtcclxuXHRcdHMgPSBzLnJlcGxhY2UoIG5ldyBSZWdFeHAoIGVzYyArICd7Mix9JywgJ2cnICksIHNlcCApO1xyXG5cdFx0cyA9IHMucmVwbGFjZSggbmV3IFJlZ0V4cCggJ14nICsgZXNjICsgJyt8JyArIGVzYyArICcrJCcsICdnJyApLCAnJyApLnRyaW0oKTtcclxuXHJcblx0XHRpZiAoIHMubGVuZ3RoID4gODAgKSB7XHJcblx0XHRcdHMgPSBzLnNsaWNlKCAwLCA4MCApLnRyaW0oKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEVzY2FwZSBIVE1MLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHsqfSBzXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9fZXNjYXBlX2h0bWwocykge1xyXG5cdFx0cmV0dXJuIFN0cmluZyggcyA9PSBudWxsID8gJycgOiBzIClcclxuXHRcdFx0LnJlcGxhY2UoIC8mL2csICcmYW1wOycgKVxyXG5cdFx0XHQucmVwbGFjZSggLzwvZywgJyZsdDsnIClcclxuXHRcdFx0LnJlcGxhY2UoIC8+L2csICcmZ3Q7JyApXHJcblx0XHRcdC5yZXBsYWNlKCAvXCIvZywgJyZxdW90OycgKVxyXG5cdFx0XHQucmVwbGFjZSggLycvZywgJyYjMDM5OycgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBjb25maWcgdGV4dC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZmFsbGJhY2tcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX19nZXRfY2ZnX3RleHQoa2V5LCBmYWxsYmFjaykge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0Y29uc3QgY2ZnID0gdy5XUEJDX0JGQl9BamF4IHx8IHt9O1xyXG5cdFx0XHRjb25zdCB2YWwgPSAoIGNmZyAmJiBjZmdbIGtleSBdICkgPyBTdHJpbmcoIGNmZ1sga2V5IF0gKSA6ICcnO1xyXG5cdFx0XHRyZXR1cm4gdmFsID8gdmFsIDogU3RyaW5nKCBmYWxsYmFjayB8fCAnJyApO1xyXG5cdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRyZXR1cm4gU3RyaW5nKCBmYWxsYmFjayB8fCAnJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFRvZ2dsZSBidXN5IHN0YXRlIGZvciB0ZW1wbGF0ZSBkZWxldGUgYnV0dG9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtIVE1MRWxlbWVudHxudWxsfSBkZWxldGVfYnRuXHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19idXN5XHJcblx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX3NldF90cGxfZGVsZXRlX2J1c3koZGVsZXRlX2J0biwgaXNfYnVzeSkge1xyXG5cdFx0aWYgKCAhIGRlbGV0ZV9idG4gKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2J1c3kgKSB7XHJcblx0XHRcdGRlbGV0ZV9idG4uc2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xyXG5cdFx0XHRkZWxldGVfYnRuLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnbm9uZSc7XHJcblx0XHRcdGRlbGV0ZV9idG4uc3R5bGUub3BhY2l0eSA9ICcwLjUnO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0ZGVsZXRlX2J0bi5zZXRBdHRyaWJ1dGUoICdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyApO1xyXG5cdFx0XHRkZWxldGVfYnRuLnN0eWxlLnBvaW50ZXJFdmVudHMgPSAnJztcclxuXHRcdFx0ZGVsZXRlX2J0bi5zdHlsZS5vcGFjaXR5ID0gJyc7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRVSS5UZW1wbGF0ZV9QaWNrZXIuY3JlYXRlID0gZnVuY3Rpb24gKGFyZ3MpIHtcclxuXHJcblx0XHRhcmdzID0gYXJncyB8fCB7fTtcclxuXHJcblx0XHRjb25zdCBhcGkgPSB7fTtcclxuXHJcblx0XHRhcGkubW9kYWxfZWwgICAgICAgICAgICAgICA9IGFyZ3MubW9kYWxfZWwgfHwgbnVsbDtcclxuXHRcdGFwaS5zZWFyY2hfaW5wdXRfaWQgICAgICAgID0gYXJncy5zZWFyY2hfaW5wdXRfaWQgfHwgJyc7XHJcblx0XHRhcGkuYmxhbmtfdGVtcGxhdGVfc2x1ZyAgICA9IGFyZ3MuYmxhbmtfdGVtcGxhdGVfc2x1ZyB8fCAnX19ibGFua19fJztcclxuXHRcdGFwaS5hbGxvd19kZWxldGUgICAgICAgICAgID0gISEgYXJncy5hbGxvd19kZWxldGU7XHJcblx0XHRhcGkuYWxsb3dfcHJlc2V0cyAgICAgICAgICA9ICEhIGFyZ3MuYWxsb3dfcHJlc2V0cztcclxuXHRcdGFwaS5hbGxvd19zYW1lX2NsaWNrX2JsYW5rID0gISEgYXJncy5hbGxvd19zYW1lX2NsaWNrX2JsYW5rO1xyXG5cdFx0YXBpLmVtcHR5X3RleHQgICAgICAgICAgICAgPSBTdHJpbmcoIGFyZ3MuZW1wdHlfdGV4dCB8fCAnTm8gdGVtcGxhdGVzIGZvdW5kLicgKTtcclxuXHRcdGFwaS5ibGFua19kZXNjICAgICAgICAgICAgID0gU3RyaW5nKCBhcmdzLmJsYW5rX2Rlc2MgfHwgJ1N0YXJ0IHdpdGggYW4gZW1wdHkgbGF5b3V0LicgKTtcclxuXHRcdGFwaS5saXN0X2hlbHBlcl9taXNzaW5nX3RleHQgPSBTdHJpbmcoIGFyZ3MubGlzdF9oZWxwZXJfbWlzc2luZ190ZXh0IHx8ICdXUEJDIEJGQjogbGlzdCBmb3JtcyBoZWxwZXIgbWlzc2luZy4nICk7XHJcblx0XHRhcGkubG9hZF9mYWlsZWRfdGV4dCAgICAgICA9IFN0cmluZyggYXJncy5sb2FkX2ZhaWxlZF90ZXh0IHx8ICdGYWlsZWQgdG8gbG9hZCB0ZW1wbGF0ZXMgbGlzdC4nICk7XHJcblx0XHRhcGkub25fc2VsZWN0aW9uX2NoYW5nZSAgICA9ICggdHlwZW9mIGFyZ3Mub25fc2VsZWN0aW9uX2NoYW5nZSA9PT0gJ2Z1bmN0aW9uJyApID8gYXJncy5vbl9zZWxlY3Rpb25fY2hhbmdlIDogZnVuY3Rpb24gKCkge307XHJcblx0XHRhcGkub25fZGVsZXRlX2NsaWNrICAgICAgICA9ICggdHlwZW9mIGFyZ3Mub25fZGVsZXRlX2NsaWNrID09PSAnZnVuY3Rpb24nICkgPyBhcmdzLm9uX2RlbGV0ZV9jbGljayA6IG51bGw7XHJcblx0XHRhcGkub25fc2V0X2Vycm9yICAgICAgICAgICA9ICggdHlwZW9mIGFyZ3Mub25fc2V0X2Vycm9yID09PSAnZnVuY3Rpb24nICkgPyBhcmdzLm9uX3NldF9lcnJvciA6IGZ1bmN0aW9uICgpIHt9O1xyXG5cclxuXHRcdGFwaS5nZXRfc2VhcmNoX2lucHV0ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRyZXR1cm4gYXBpLnNlYXJjaF9pbnB1dF9pZCA/IGQuZ2V0RWxlbWVudEJ5SWQoIGFwaS5zZWFyY2hfaW5wdXRfaWQgKSA6IG51bGw7XHJcblx0XHR9O1xyXG5cclxuXHRcdGFwaS5nZXRfbGlzdF9yb290ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRyZXR1cm4gYXBpLm1vZGFsX2VsID8gYXBpLm1vZGFsX2VsLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi10cGwtbGlzdD1cIjFcIl0nICkgOiBudWxsO1xyXG5cdFx0fTtcclxuXHJcblx0XHRhcGkuZ2V0X3BhZ2VyX3Jvb3QgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdHJldHVybiBhcGkubW9kYWxfZWwgPyBhcGkubW9kYWxfZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLXRwbC1wYWdlcj1cIjFcIl0nICkgOiBudWxsO1xyXG5cdFx0fTtcclxuXHJcblx0XHRhcGkuZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggISBhcGkubW9kYWxfZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGFwaS5ibGFua190ZW1wbGF0ZV9zbHVnO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHYgPSBTdHJpbmcoIGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcgfHwgJycgKTtcclxuXHRcdFx0cmV0dXJuIHYgPyB2IDogYXBpLmJsYW5rX3RlbXBsYXRlX3NsdWc7XHJcblx0XHR9O1xyXG5cclxuXHRcdGFwaS5zZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyA9IGZ1bmN0aW9uIChzbHVnKSB7XHJcblx0XHRcdGlmICggISBhcGkubW9kYWxfZWwgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdHNsdWcgPSBTdHJpbmcoIHNsdWcgfHwgJycgKS50cmltKCk7XHJcblx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcgPSBzbHVnID8gc2x1ZyA6IGFwaS5ibGFua190ZW1wbGF0ZV9zbHVnO1xyXG5cdFx0fTtcclxuXHJcblx0XHRhcGkuY291bnRfcmVhbF90ZW1wbGF0ZXMgPSBmdW5jdGlvbiAoZm9ybXMpIHtcclxuXHRcdFx0bGV0IGNvdW50ID0gMDtcclxuXHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8ICggZm9ybXMgfHwgW10gKS5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRjb25zdCBpdGVtID0gZm9ybXNbIGkgXSB8fCB7fTtcclxuXHRcdFx0XHRjb25zdCBzbHVnID0gU3RyaW5nKCBpdGVtLmZvcm1fc2x1ZyB8fCAnJyApO1xyXG5cclxuXHRcdFx0XHRpZiAoIHNsdWcgJiYgc2x1ZyAhPT0gYXBpLmJsYW5rX3RlbXBsYXRlX3NsdWcgKSB7XHJcblx0XHRcdFx0XHRjb3VudCsrO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGNvdW50O1xyXG5cdFx0fTtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIERlbGV0ZSB0ZW1wbGF0ZSBieSBkZWxldGUgYnV0dG9uIGVsZW1lbnQgYW5kIHJlZnJlc2ggY3VycmVudCBwaWNrZXIgbGlzdC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBkZWxldGVfYnRuXHJcblx0XHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBkb25lIE9wdGlvbmFsIGNhbGxiYWNrIGZ1bmN0aW9uKG9rOmJvb2xlYW4sIHJlc3A6T2JqZWN0fG51bGwpXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0YXBpLmRlbGV0ZV90ZW1wbGF0ZSA9IGZ1bmN0aW9uIChkZWxldGVfYnRuLCBkb25lKSB7XHJcblxyXG5cdFx0XHRpZiAoICEgZGVsZXRlX2J0biApIHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZSggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIGRlbGV0ZV9idG4uZ2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKSA9PT0gJ3RydWUnICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgdGVtcGxhdGVfc2x1ZyAgPSBTdHJpbmcoIGRlbGV0ZV9idG4uZ2V0QXR0cmlidXRlKCAnZGF0YS10ZW1wbGF0ZS1zbHVnJyApIHx8ICcnICkudHJpbSgpO1xyXG5cdFx0XHRjb25zdCB0ZW1wbGF0ZV90aXRsZSA9IFN0cmluZyggZGVsZXRlX2J0bi5nZXRBdHRyaWJ1dGUoICdkYXRhLXRlbXBsYXRlLXRpdGxlJyApIHx8IHRlbXBsYXRlX3NsdWcgKS50cmltKCk7XHJcblxyXG5cdFx0XHRpZiAoICEgdGVtcGxhdGVfc2x1ZyB8fCB0ZW1wbGF0ZV9zbHVnID09PSBhcGkuYmxhbmtfdGVtcGxhdGVfc2x1ZyApIHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZSggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYmZiX19hamF4X2RlbGV0ZV90ZW1wbGF0ZV9ieV9zbHVnICE9PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdGNvbnN0IG1pc3NpbmdfbXNnID0gd3BiY19iZmJfX2dldF9jZmdfdGV4dChcclxuXHRcdFx0XHRcdCd0ZW1wbGF0ZV9kZWxldGVfbWlzc2luZ19oZWxwZXInLFxyXG5cdFx0XHRcdFx0J1dQQkMgQkZCOiB0ZW1wbGF0ZSBkZWxldGUgaGVscGVyIGlzIG5vdCBhdmFpbGFibGUuJ1xyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdGFwaS5vbl9zZXRfZXJyb3IoIG1pc3NpbmdfbXNnICk7XHJcblxyXG5cdFx0XHRcdGlmICggdHlwZW9mIHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBtaXNzaW5nX21zZywgJ2Vycm9yJywgMTAwMDAgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggdHlwZW9mIGRvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRkb25lKCBmYWxzZSwgbnVsbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGNvbnN0IGNvbmZpcm1fdGV4dCA9IHdwYmNfYmZiX19nZXRfY2ZnX3RleHQoXHJcblx0XHRcdFx0J3RlbXBsYXRlX2RlbGV0ZV9jb25maXJtJyxcclxuXHRcdFx0XHQnRGVsZXRlIHRlbXBsYXRlIFwiJXNcIj8gVGhpcyBhY3Rpb24gY2Fubm90IGJlIHVuZG9uZS4nXHJcblx0XHRcdCkucmVwbGFjZSggJyVzJywgdGVtcGxhdGVfdGl0bGUgfHwgdGVtcGxhdGVfc2x1ZyApO1xyXG5cclxuXHRcdFx0aWYgKCAhIHcuY29uZmlybSggY29uZmlybV90ZXh0ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRhcGkub25fc2V0X2Vycm9yKCAnJyApO1xyXG5cdFx0XHR3cGJjX2JmYl9fc2V0X3RwbF9kZWxldGVfYnVzeSggZGVsZXRlX2J0biwgdHJ1ZSApO1xyXG5cclxuXHRcdFx0dy53cGJjX2JmYl9fYWpheF9kZWxldGVfdGVtcGxhdGVfYnlfc2x1ZyggdGVtcGxhdGVfc2x1ZywgZnVuY3Rpb24gKG9rLCByZXNwKSB7XHJcblxyXG5cdFx0XHRcdHdwYmNfYmZiX19zZXRfdHBsX2RlbGV0ZV9idXN5KCBkZWxldGVfYnRuLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0XHRpZiAoICEgb2sgfHwgISByZXNwIHx8ICEgcmVzcC5zdWNjZXNzICkge1xyXG5cclxuXHRcdFx0XHRcdGxldCBlcnJvcl9tZXNzYWdlID0gJyc7XHJcblxyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9ICggcmVzcCAmJiByZXNwLmRhdGEgJiYgcmVzcC5kYXRhLm1lc3NhZ2UgKSA/IFN0cmluZyggcmVzcC5kYXRhLm1lc3NhZ2UgKSA6ICcnO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIF9lMCApIHtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9ICcnO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggISBlcnJvcl9tZXNzYWdlICkge1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gd3BiY19iZmJfX2dldF9jZmdfdGV4dChcclxuXHRcdFx0XHRcdFx0XHQndGVtcGxhdGVfZGVsZXRlX2ZhaWxlZCcsXHJcblx0XHRcdFx0XHRcdFx0J0ZhaWxlZCB0byBkZWxldGUgdGVtcGxhdGUuJ1xyXG5cdFx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGFwaS5vbl9zZXRfZXJyb3IoIGVycm9yX21lc3NhZ2UgKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHR3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlLCAnZXJyb3InLCAxMDAwMCApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmUoIGZhbHNlLCByZXNwICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIGFwaS5nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZygpID09PSB0ZW1wbGF0ZV9zbHVnICkge1xyXG5cdFx0XHRcdFx0YXBpLnNldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnKCBhcGkuYmxhbmtfdGVtcGxhdGVfc2x1ZyApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgY3VycmVudF9wYWdlICAgPSBwYXJzZUludCggKCBhcGkubW9kYWxfZWwgJiYgYXBpLm1vZGFsX2VsLl9fd3BiY19iZmJfdHBsX3BhZ2UgKSB8fCAxLCAxMCApIHx8IDE7XHJcblx0XHRcdFx0Y29uc3QgY3VycmVudF9zZWFyY2ggPSBTdHJpbmcoICggYXBpLm1vZGFsX2VsICYmIGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2ggKSB8fCAnJyApO1xyXG5cclxuXHRcdFx0XHRjb25zdCBmaW5pc2hfc3VjY2VzcyA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdGFwaS5vbl9zZWxlY3Rpb25fY2hhbmdlKCBhcGkuZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcoKSwgYXBpICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2FkbWluX3Nob3dfbWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0Y29uc3Qgc3VjY2Vzc19tZXNzYWdlID0gKCByZXNwICYmIHJlc3AuZGF0YSAmJiByZXNwLmRhdGEubWVzc2FnZSApXHJcblx0XHRcdFx0XHRcdFx0PyBTdHJpbmcoIHJlc3AuZGF0YS5tZXNzYWdlIClcclxuXHRcdFx0XHRcdFx0XHQ6IHdwYmNfYmZiX19nZXRfY2ZnX3RleHQoICd0ZW1wbGF0ZV9kZWxldGVfc3VjY2VzcycsICdUZW1wbGF0ZSBkZWxldGVkLicgKTtcclxuXHJcblx0XHRcdFx0XHRcdHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoIHN1Y2Nlc3NfbWVzc2FnZSwgJ3N1Y2Nlc3MnLCA0MDAwLCBmYWxzZSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmUoIHRydWUsIHJlc3AgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRhcGkubG9hZF90ZW1wbGF0ZXMoIGN1cnJlbnRfcGFnZSwgY3VycmVudF9zZWFyY2gsIGZ1bmN0aW9uIChsb2FkX29rKSB7XHJcblxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHRsb2FkX29rICYmXHJcblx0XHRcdFx0XHRcdGN1cnJlbnRfcGFnZSA+IDEgJiZcclxuXHRcdFx0XHRcdFx0YXBpLmNvdW50X3JlYWxfdGVtcGxhdGVzKCAoIGFwaS5tb2RhbF9lbCAmJiBhcGkubW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZXNfY2FjaGUgKSB8fCBbXSApIDwgMVxyXG5cdFx0XHRcdFx0KSB7XHJcblx0XHRcdFx0XHRcdGFwaS5sb2FkX3RlbXBsYXRlcyggY3VycmVudF9wYWdlIC0gMSwgY3VycmVudF9zZWFyY2gsIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0XHRmaW5pc2hfc3VjY2VzcygpO1xyXG5cdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRmaW5pc2hfc3VjY2VzcygpO1xyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fTtcclxuXHJcblxyXG5cdFx0YXBpLnN5bmNfdGVtcGxhdGVfc2VhcmNoX3ByZXNldHMgPSBmdW5jdGlvbiAoY3VycmVudF9zZWFyY2gpIHtcclxuXHRcdFx0aWYgKCAhIGFwaS5tb2RhbF9lbCB8fCAhIGFwaS5hbGxvd19wcmVzZXRzICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgcm9vdCA9IGFwaS5tb2RhbF9lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItdHBsLXNlYXJjaC1wcmVzZXRzPVwiMVwiXScgKTtcclxuXHRcdFx0aWYgKCAhIHJvb3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjdXJyZW50X3NlYXJjaCA9IHdwYmNfYmZiX19ub3JtYWxpemVfdGVtcGxhdGVfc2VhcmNoKCBjdXJyZW50X3NlYXJjaCApO1xyXG5cclxuXHRcdFx0cm9vdC5xdWVyeVNlbGVjdG9yQWxsKCAnW2RhdGEtd3BiYy1iZmItdHBsLXNlYXJjaC1rZXldJyApLmZvckVhY2goIGZ1bmN0aW9uIChidG4pIHtcclxuXHRcdFx0XHRjb25zdCBwcmVzZXRfc2VhcmNoID0gd3BiY19iZmJfX25vcm1hbGl6ZV90ZW1wbGF0ZV9zZWFyY2goXHJcblx0XHRcdFx0XHRidG4uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi10cGwtc2VhcmNoLWtleScgKSB8fCAnJ1xyXG5cdFx0XHRcdCk7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGlzX2FjdGl2ZSA9ICggcHJlc2V0X3NlYXJjaCA9PT0gY3VycmVudF9zZWFyY2ggKTtcclxuXHJcblx0XHRcdFx0YnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtcHJlc3NlZCcsIGlzX2FjdGl2ZSA/ICd0cnVlJyA6ICdmYWxzZScgKTtcclxuXHRcdFx0XHRidG4uY2xhc3NMaXN0LnRvZ2dsZSggJ2lzLWFjdGl2ZScsIGlzX2FjdGl2ZSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGFwaS5zZXRfbG9hZGluZyA9IGZ1bmN0aW9uIChpc19sb2FkaW5nKSB7XHJcblx0XHRcdGNvbnN0IHJvb3QgPSBhcGkuZ2V0X2xpc3Rfcm9vdCgpO1xyXG5cdFx0XHRpZiAoICEgcm9vdCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggaXNfbG9hZGluZyApIHtcclxuXHRcdFx0XHRsZXQgc3BpbiA9ICcnO1xyXG5cclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0Y29uc3Qgc3JjID0gZC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX3BvcHVwX21vZGFsX19mb3Jtc19sb2FkaW5nX3NwaW5fY29udGFpbmVyJyApO1xyXG5cdFx0XHRcdFx0aWYgKCBzcmMgKSB7XHJcblx0XHRcdFx0XHRcdHNwaW4gPSBzcmMub3V0ZXJIVE1MO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblxyXG5cdFx0XHRcdHJvb3QuaW5uZXJIVE1MID0gc3BpbiB8fCAnPGRpdiBzdHlsZT1cInBhZGRpbmc6MTBweDtjb2xvcjojNjU2NTY1O1wiPicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIHdwYmNfYmZiX19pMThuKCAndGV4dF9sb2FkaW5nJywgJ0xvYWRpbmcuLi4nICkgKSArICc8L2Rpdj4nO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cclxuXHRcdGFwaS5zZXRfcGFnZXIgPSBmdW5jdGlvbiAocGFnZSwgaGFzX21vcmUpIHtcclxuXHRcdFx0Y29uc3QgcGFnZXIgPSBhcGkuZ2V0X3BhZ2VyX3Jvb3QoKTtcclxuXHRcdFx0aWYgKCAhIHBhZ2VyICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgcHJldiA9IHBhZ2VyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi10cGwtcGFnZS1wcmV2PVwiMVwiXScgKTtcclxuXHRcdFx0Y29uc3QgbmV4dCA9IHBhZ2VyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi10cGwtcGFnZS1uZXh0PVwiMVwiXScgKTtcclxuXHRcdFx0Y29uc3QgbGFiICA9IHBhZ2VyLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi10cGwtcGFnZS1sYWJlbD1cIjFcIl0nICk7XHJcblxyXG5cdFx0XHRwYWdlID0gcGFyc2VJbnQoIHBhZ2UgfHwgMSwgMTAgKTtcclxuXHRcdFx0aWYgKCAhIHBhZ2UgfHwgcGFnZSA8IDEgKSB7XHJcblx0XHRcdFx0cGFnZSA9IDE7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggbGFiICkge1xyXG5cdFx0XHRcdGxhYi50ZXh0Q29udGVudCA9IHdwYmNfYmZiX19lc2NhcGVfaHRtbCggd3BiY19iZmJfX2kxOG4oICd0ZXh0X3BhZ2UnLCAnUGFnZScgKSApICsgJyAnICsgcGFnZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0ZnVuY3Rpb24gc2V0X2J0bihidG4sIGVuYWJsZWQpIHtcclxuXHRcdFx0XHRpZiAoICEgYnRuICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGVuYWJsZWQgKSB7XHJcblx0XHRcdFx0XHRidG4uY2xhc3NMaXN0LnJlbW92ZSggJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdFx0YnRuLnNldEF0dHJpYnV0ZSggJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGJ0bi5jbGFzc0xpc3QuYWRkKCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0XHRidG4uc2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcsICd0cnVlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2V0X2J0biggcHJldiwgcGFnZSA+IDEgKTtcclxuXHRcdFx0c2V0X2J0biggbmV4dCwgISEgaGFzX21vcmUgKTtcclxuXHRcdH07XHJcblxyXG5cdFx0YXBpLnJlZnJlc2hfc2VsZWN0aW9uX2hpZ2hsaWdodCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0Y29uc3Qgcm9vdCA9IGFwaS5nZXRfbGlzdF9yb290KCk7XHJcblx0XHRcdGlmICggISByb290ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3Qgc2VsID0gYXBpLmdldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnKCk7XHJcblx0XHRcdGxldCBmb3VuZCA9IG51bGw7XHJcblxyXG5cdFx0XHRyb290LnF1ZXJ5U2VsZWN0b3JBbGwoICcud3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtJyApLmZvckVhY2goIGZ1bmN0aW9uIChlbCkge1xyXG5cdFx0XHRcdGVsLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1fc2VsZWN0ZWQnICk7XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0Zm91bmQgPSByb290LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS10ZW1wbGF0ZS1zbHVnPVwiJyArIENTUy5lc2NhcGUoIHNlbCApICsgJ1wiXScgKTtcclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge1xyXG5cdFx0XHRcdGZvdW5kID0gbnVsbDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBmb3VuZCApIHtcclxuXHRcdFx0XHRmb3VuZC5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtX3NlbGVjdGVkJyApO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cclxuXHRcdGFwaS5yZW5kZXJfbGlzdCA9IGZ1bmN0aW9uIChmb3Jtcykge1xyXG5cdFx0XHRjb25zdCByb290ID0gYXBpLmdldF9saXN0X3Jvb3QoKTtcclxuXHRcdFx0aWYgKCAhIHJvb3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRsZXQgaHRtbCA9ICcnO1xyXG5cclxuXHRcdFx0aHRtbCArPSAnJ1xyXG5cdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1cIiBkYXRhLXdwYmMtYmZiLXRwbC1pdGVtPVwiMVwiIGRhdGEtdGVtcGxhdGUtc2x1Zz1cIicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIGFwaS5ibGFua190ZW1wbGF0ZV9zbHVnICkgKyAnXCI+J1xyXG5cdFx0XHRcdCsgJyAgPGRpdiBjbGFzcz1cIndwYmNfYmZiX19sb2FkX2Zvcm1faXRlbV90aHVtYlwiPidcclxuXHRcdFx0XHQrICcgICAgPGRpdiBjbGFzcz1cIndwYmNfYmZiX19sb2FkX2Zvcm1faXRlbV90aHVtYl9ibGFua19pbWdcIj4nICsgd3BiY19iZmJfX2VzY2FwZV9odG1sKCB3cGJjX2JmYl9faTE4biggJ3RleHRfYmxhbmtfdGh1bWInLCAnQmxhbmsnICkgKSArICc8L2Rpdj4nXHJcblx0XHRcdFx0KyAnICA8L2Rpdj4nXHJcblx0XHRcdFx0KyAnICA8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtX3RleHRcIj4nXHJcblx0XHRcdFx0KyAnICAgIDxkaXYgY2xhc3M9XCJmb3JtX2l0ZW1fdGV4dF90aXRsZVwiPicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIHdwYmNfYmZiX19pMThuKCAndGV4dF9ibGFua19mb3JtX3RpdGxlJywgJ0JsYW5rIEZvcm0nICkgKSArICc8L2Rpdj4nXHJcblx0XHRcdFx0KyAnICAgIDxkaXYgY2xhc3M9XCJmb3JtX2l0ZW1fdGV4dF9zbHVnXCI+JyArIHdwYmNfYmZiX19lc2NhcGVfaHRtbCggYXBpLmJsYW5rX3RlbXBsYXRlX3NsdWcgKSArICc8L2Rpdj4nXHJcblx0XHRcdFx0KyAnICAgIDxkaXYgY2xhc3M9XCJmb3JtX2l0ZW1fdGV4dF9kZXNjXCI+JyArIHdwYmNfYmZiX19lc2NhcGVfaHRtbCggYXBpLmJsYW5rX2Rlc2MgKSArICc8L2Rpdj4nXHJcblx0XHRcdFx0KyAnICA8L2Rpdj4nXHJcblx0XHRcdFx0KyAnPC9kaXY+JztcclxuXHJcblx0XHRcdGxldCBhbnlfdGVtcGxhdGVzID0gZmFsc2U7XHJcblx0XHRcdGNvbnN0IGRlbGV0ZV9sYWJlbCA9IHdwYmNfYmZiX19nZXRfY2ZnX3RleHQoICd0ZW1wbGF0ZV9kZWxldGVfbGFiZWwnLCAnRGVsZXRlIHRlbXBsYXRlJyApO1xyXG5cclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgKCBmb3JtcyB8fCBbXSApLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSBmb3Jtc1sgaSBdIHx8IHt9O1xyXG5cdFx0XHRcdGNvbnN0IHNsdWcgPSBTdHJpbmcoIGl0ZW0uZm9ybV9zbHVnIHx8ICcnICk7XHJcblxyXG5cdFx0XHRcdGlmICggISBzbHVnIHx8IHNsdWcgPT09IGFwaS5ibGFua190ZW1wbGF0ZV9zbHVnICkge1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRhbnlfdGVtcGxhdGVzID0gdHJ1ZTtcclxuXHJcblx0XHRcdFx0Y29uc3QgdGl0bGUgPSBTdHJpbmcoIGl0ZW0udGl0bGUgfHwgc2x1ZyB8fCAnJyApO1xyXG5cdFx0XHRcdGNvbnN0IGRlc2MgID0gU3RyaW5nKCBpdGVtLmRlc2NyaXB0aW9uIHx8ICcnICk7XHJcblx0XHRcdFx0Y29uc3QgcGljICAgPSBTdHJpbmcoIGl0ZW0ucGljdHVyZV91cmwgfHwgaXRlbS5pbWFnZV91cmwgfHwgJycgKTtcclxuXHJcblx0XHRcdFx0Y29uc3QgdGh1bWIgPSBwaWNcclxuXHRcdFx0XHRcdD8gJzxpbWcgc3JjPVwiJyArIHdwYmNfYmZiX19lc2NhcGVfaHRtbCggcGljICkgKyAnXCIgYWx0PVwiXCIgLz4nXHJcblx0XHRcdFx0XHQ6ICc8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtX3RodW1iX2JsYW5rX2ltZ1wiPicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIHdwYmNfYmZiX19pMThuKCAndGV4dF9ub19pbWFnZV90aHVtYicsICdObyBpbWFnZScgKSApICsgJzwvZGl2Pic7XHJcblxyXG5cdFx0XHRcdGxldCBkZWxldGVfYnRuID0gJyc7XHJcblxyXG5cdFx0XHRcdGlmICggYXBpLmFsbG93X2RlbGV0ZSAmJiBwYXJzZUludCggaXRlbS5jYW5fZGVsZXRlIHx8IDAsIDEwICkgPT09IDEgKSB7XHJcblx0XHRcdFx0XHRkZWxldGVfYnRuID0gJydcclxuXHRcdFx0XHRcdFx0KyAnPGEgaHJlZj1cIiNcIidcclxuXHRcdFx0XHRcdFx0KyAnIGNsYXNzPVwiYnV0dG9uLWxpbmstZGVsZXRlXCInXHJcblx0XHRcdFx0XHRcdCsgJyBkYXRhLXdwYmMtYmZiLXRwbC1kZWxldGU9XCIxXCInXHJcblx0XHRcdFx0XHRcdCsgJyBkYXRhLXRlbXBsYXRlLXNsdWc9XCInICsgd3BiY19iZmJfX2VzY2FwZV9odG1sKCBzbHVnICkgKyAnXCInXHJcblx0XHRcdFx0XHRcdCsgJyBkYXRhLXRlbXBsYXRlLXRpdGxlPVwiJyArIHdwYmNfYmZiX19lc2NhcGVfaHRtbCggdGl0bGUgKSArICdcIidcclxuXHRcdFx0XHRcdFx0KyAnIGFyaWEtbGFiZWw9XCInICsgd3BiY19iZmJfX2VzY2FwZV9odG1sKCBkZWxldGVfbGFiZWwgKSArICdcIidcclxuXHRcdFx0XHRcdFx0KyAnIHRpdGxlPVwiJyArIHdwYmNfYmZiX19lc2NhcGVfaHRtbCggZGVsZXRlX2xhYmVsICkgKyAnXCInXHJcblx0XHRcdFx0XHRcdCsgJyBzdHlsZT1cIm1hcmdpbi1sZWZ0OmF1dG87Y29sb3I6I2IzMmQyZTt0ZXh0LWRlY29yYXRpb246bm9uZTtsaW5lLWhlaWdodDoxO1wiPidcclxuXHRcdFx0XHRcdFx0KyAnICAgPHNwYW4gY2xhc3M9XCJkYXNoaWNvbnMgZGFzaGljb25zLXRyYXNoXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCI+PC9zcGFuPidcclxuXHRcdFx0XHRcdFx0KyAnPC9hPic7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBtZXRhID0gJzxkaXYgY2xhc3M9XCJmb3JtX2l0ZW1fdGV4dF9zbHVnXCIgdGl0bGU9XCInICsgd3BiY19iZmJfX2VzY2FwZV9odG1sKCBzbHVnICkgKyAnXCI+JyArIHdwYmNfYmZiX19lc2NhcGVfaHRtbCggc2x1ZyApICsgJzwvZGl2Pic7XHJcblxyXG5cdFx0XHRcdGNvbnN0IGxpbmUyID0gZGVzY1xyXG5cdFx0XHRcdFx0PyAnPGRpdiBjbGFzcz1cImZvcm1faXRlbV90ZXh0X2Rlc2NcIiB0aXRsZT1cIicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIGRlc2MgKSArICdcIj4nXHJcblx0XHRcdFx0XHRcdFx0KyAnPHNwYW4gY2xhc3M9XCJmb3JtX2l0ZW1fdGV4dF9kZXNjX190ZXh0XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0KyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIGRlc2MgKVxyXG5cdFx0XHRcdFx0XHRcdCsgJzwvc3Bhbj4nXHJcblx0XHRcdFx0XHRcdFx0KyBkZWxldGVfYnRuXHJcblx0XHRcdFx0XHRcdCsgJzwvZGl2PidcclxuXHRcdFx0XHRcdDogKCBkZWxldGVfYnRuID8gJzxkaXYgY2xhc3M9XCJmb3JtX2l0ZW1fdGV4dF9kZXNjXCI+JyArIGRlbGV0ZV9idG4gKyAnPC9kaXY+JyA6ICcnICk7XHJcblxyXG5cdFx0XHRcdGh0bWwgKz0gJydcclxuXHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1cIiBkYXRhLXdwYmMtYmZiLXRwbC1pdGVtPVwiMVwiIGRhdGEtdGVtcGxhdGUtc2x1Zz1cIicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIHNsdWcgKSArICdcIj4nXHJcblx0XHRcdFx0XHQrICcgIDxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9fbG9hZF9mb3JtX2l0ZW1fdGh1bWJcIj4nICsgdGh1bWIgKyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0KyAnICA8ZGl2IGNsYXNzPVwid3BiY19iZmJfX2xvYWRfZm9ybV9pdGVtX3RleHRcIj4nXHJcblx0XHRcdFx0XHQrICcgICAgPGRpdiBzdHlsZT1cImRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O2dhcDo4cHg7XCI+J1xyXG5cdFx0XHRcdFx0KyAnICAgICAgPGRpdiBjbGFzcz1cImZvcm1faXRlbV90ZXh0X3RpdGxlXCIgc3R5bGU9XCJmbGV4OjEgMSBhdXRvO1wiPicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIHRpdGxlICkgKyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0KyAnICAgIDwvZGl2PidcclxuXHRcdFx0XHRcdCsgICAgICBtZXRhXHJcblx0XHRcdFx0XHQrICAgICAgbGluZTJcclxuXHRcdFx0XHRcdCsgJyAgPC9kaXY+J1xyXG5cdFx0XHRcdFx0KyAnPC9kaXY+JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAhIGFueV90ZW1wbGF0ZXMgKSB7XHJcblx0XHRcdFx0aHRtbCArPSAnPGRpdiBzdHlsZT1cInBhZGRpbmc6MTBweDtjb2xvcjojNjY2O1wiPicgKyB3cGJjX2JmYl9fZXNjYXBlX2h0bWwoIGFwaS5lbXB0eV90ZXh0ICkgKyAnPC9kaXY+JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cm9vdC5pbm5lckhUTUwgPSBodG1sO1xyXG5cdFx0XHRhcGkucmVmcmVzaF9zZWxlY3Rpb25faGlnaGxpZ2h0KCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGFwaS5sb2FkX3RlbXBsYXRlcyA9IGZ1bmN0aW9uIChwYWdlLCBzZWFyY2gsIGRvbmUpIHtcclxuXHRcdFx0aWYgKCB0eXBlb2Ygdy53cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0YXBpLm9uX3NldF9lcnJvciggYXBpLmxpc3RfaGVscGVyX21pc3NpbmdfdGV4dCApO1xyXG5cdFx0XHRcdGFwaS5zZXRfbG9hZGluZyggZmFsc2UgKTtcclxuXHRcdFx0XHRhcGkuc2V0X3BhZ2VyKCAxLCBmYWxzZSApO1xyXG5cdFx0XHRcdGFwaS5yZW5kZXJfbGlzdCggW10gKTtcclxuXHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmUoIGZhbHNlLCBudWxsICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cGFnZSAgID0gcGFyc2VJbnQoIHBhZ2UgfHwgMSwgMTAgKTtcclxuXHRcdFx0c2VhcmNoID0gd3BiY19iZmJfX25vcm1hbGl6ZV90ZW1wbGF0ZV9zZWFyY2goIHNlYXJjaCApO1xyXG5cclxuXHRcdFx0aWYgKCAhIHBhZ2UgfHwgcGFnZSA8IDEgKSB7XHJcblx0XHRcdFx0cGFnZSA9IDE7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGFwaS5vbl9zZXRfZXJyb3IoICcnICk7XHJcblx0XHRcdGFwaS5zZXRfbG9hZGluZyggdHJ1ZSApO1xyXG5cclxuXHRcdFx0dy53cGJjX2JmYl9fYWpheF9saXN0X3VzZXJfZm9ybXMoXHJcblx0XHRcdFx0bnVsbCxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRpbmNsdWRlX2dsb2JhbCA6IDEsXHJcblx0XHRcdFx0XHRzdGF0dXMgICAgICAgICA6ICd0ZW1wbGF0ZScsXHJcblx0XHRcdFx0XHRwYWdlICAgICAgICAgICA6IHBhZ2UsXHJcblx0XHRcdFx0XHRsaW1pdCAgICAgICAgICA6IDIwLFxyXG5cdFx0XHRcdFx0c2VhcmNoICAgICAgICAgOiBzZWFyY2hcclxuXHRcdFx0XHR9LFxyXG5cdFx0XHRcdGZ1bmN0aW9uIChvaywgZGF0YSkge1xyXG5cclxuXHRcdFx0XHRcdGlmICggISBvayB8fCAhIGRhdGEgfHwgISBkYXRhLmZvcm1zICkge1xyXG5cdFx0XHRcdFx0XHRhcGkuc2V0X2xvYWRpbmcoIGZhbHNlICk7XHJcblx0XHRcdFx0XHRcdGFwaS5vbl9zZXRfZXJyb3IoIGFwaS5sb2FkX2ZhaWxlZF90ZXh0ICk7XHJcblx0XHRcdFx0XHRcdGFwaS5zZXRfcGFnZXIoIDEsIGZhbHNlICk7XHJcblx0XHRcdFx0XHRcdGFwaS5yZW5kZXJfbGlzdCggW10gKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdFx0ZG9uZSggZmFsc2UsIG51bGwgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0YXBpLm1vZGFsX2VsLl9fd3BiY19iZmJfdGVtcGxhdGVzX2NhY2hlID0gZGF0YS5mb3JtcyB8fCBbXTtcclxuXHRcdFx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9wYWdlICAgICAgICA9IGRhdGEucGFnZSB8fCBwYWdlO1xyXG5cdFx0XHRcdFx0YXBpLm1vZGFsX2VsLl9fd3BiY19iZmJfdHBsX2hhc19tb3JlICAgID0gISEgZGF0YS5oYXNfbW9yZTtcclxuXHRcdFx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2ggICAgICA9IHNlYXJjaDtcclxuXHJcblx0XHRcdFx0XHRhcGkuc3luY190ZW1wbGF0ZV9zZWFyY2hfcHJlc2V0cyggc2VhcmNoICk7XHJcblx0XHRcdFx0XHRhcGkucmVuZGVyX2xpc3QoIGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RlbXBsYXRlc19jYWNoZSApO1xyXG5cdFx0XHRcdFx0YXBpLnNldF9wYWdlciggYXBpLm1vZGFsX2VsLl9fd3BiY19iZmJfdHBsX3BhZ2UsIGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9oYXNfbW9yZSApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggdHlwZW9mIGRvbmUgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRcdGRvbmUoIHRydWUsIGRhdGEgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdCk7XHJcblx0XHR9O1xyXG5cclxuXHRcdGFwaS5hcHBseV9zZWFyY2hfdmFsdWUgPSBmdW5jdGlvbiAoc2VhcmNoX3ZhbHVlLCBkb25lKSB7XHJcblx0XHRcdGNvbnN0IHNlYXJjaF9lbCA9IGFwaS5nZXRfc2VhcmNoX2lucHV0KCk7XHJcblx0XHRcdGNvbnN0IG5vcm1hbGl6ZWRfc2VhcmNoID0gd3BiY19iZmJfX25vcm1hbGl6ZV90ZW1wbGF0ZV9zZWFyY2goIHNlYXJjaF92YWx1ZSApO1xyXG5cclxuXHRcdFx0aWYgKCBzZWFyY2hfZWwgKSB7XHJcblx0XHRcdFx0c2VhcmNoX2VsLnZhbHVlID0gbm9ybWFsaXplZF9zZWFyY2g7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggYXBpLm1vZGFsX2VsICkge1xyXG5cdFx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2ggPSBub3JtYWxpemVkX3NlYXJjaDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0YXBpLnN5bmNfdGVtcGxhdGVfc2VhcmNoX3ByZXNldHMoIG5vcm1hbGl6ZWRfc2VhcmNoICk7XHJcblx0XHRcdGFwaS5sb2FkX3RlbXBsYXRlcyggMSwgbm9ybWFsaXplZF9zZWFyY2gsIGRvbmUgKTtcclxuXHRcdH07XHJcblxyXG5cdFx0YXBpLnJlc2V0X3N0YXRlID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRjb25zdCBzZWFyY2hfZWwgPSBhcGkuZ2V0X3NlYXJjaF9pbnB1dCgpO1xyXG5cclxuXHRcdFx0aWYgKCBzZWFyY2hfZWwgKSB7XHJcblx0XHRcdFx0c2VhcmNoX2VsLnZhbHVlID0gJyc7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggYXBpLm1vZGFsX2VsICkge1xyXG5cdFx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcgPSBhcGkuYmxhbmtfdGVtcGxhdGVfc2x1ZztcclxuXHRcdFx0XHRhcGkubW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZXNfY2FjaGUgPSBbXTtcclxuXHRcdFx0XHRhcGkubW9kYWxfZWwuX193cGJjX2JmYl90cGxfcGFnZSAgICAgICAgPSAxO1xyXG5cdFx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9oYXNfbW9yZSAgICA9IGZhbHNlO1xyXG5cdFx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2ggICAgICA9ICcnO1xyXG5cclxuXHRcdFx0XHRpZiAoIGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2hfdGltZXIgKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRjbGVhclRpbWVvdXQoIGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2hfdGltZXIgKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBfZSApIHt9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2hfdGltZXIgPSAwO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRhcGkuc3luY190ZW1wbGF0ZV9zZWFyY2hfcHJlc2V0cyggJycgKTtcclxuXHRcdFx0YXBpLm9uX3NldF9lcnJvciggJycgKTtcclxuXHRcdH07XHJcblxyXG5cdFx0YXBpLmJpbmRfaGFuZGxlcnMgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggISBhcGkubW9kYWxfZWwgfHwgYXBpLm1vZGFsX2VsLl9fd3BiY19iZmJfdGVtcGxhdGVfcGlja2VyX2hhbmRsZXJzX2JvdW5kICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRhcGkubW9kYWxfZWwuX193cGJjX2JmYl90ZW1wbGF0ZV9waWNrZXJfaGFuZGxlcnNfYm91bmQgPSB0cnVlO1xyXG5cclxuXHRcdFx0Y29uc3Qgc2VhcmNoX2VsID0gYXBpLmdldF9zZWFyY2hfaW5wdXQoKTtcclxuXHJcblx0XHRcdGFwaS5tb2RhbF9lbC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRcdGlmICggISBlIHx8ICEgZS50YXJnZXQgfHwgISBlLnRhcmdldC5jbG9zZXN0ICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgZGVsZXRlX2J0biA9IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi10cGwtZGVsZXRlPVwiMVwiXScgKTtcclxuXHRcdFx0XHRpZiAoIGRlbGV0ZV9idG4gKSB7XHJcblx0XHRcdFx0XHRpZiAoICEgYXBpLmFsbG93X2RlbGV0ZSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0XHRcdGlmICggYXBpLm9uX2RlbGV0ZV9jbGljayApIHtcclxuXHRcdFx0XHRcdFx0YXBpLm9uX2RlbGV0ZV9jbGljayggZGVsZXRlX2J0biwgYXBpICk7XHJcblx0XHRcdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2YgYXBpLmRlbGV0ZV90ZW1wbGF0ZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdFx0YXBpLmRlbGV0ZV90ZW1wbGF0ZSggZGVsZXRlX2J0biApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Y29uc3QgcHJlc2V0X2J0biA9IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi10cGwtc2VhcmNoLWtleV0nICk7XHJcblx0XHRcdFx0aWYgKCBwcmVzZXRfYnRuICkge1xyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuXHRcdFx0XHRcdGFwaS5hcHBseV9zZWFyY2hfdmFsdWUoXHJcblx0XHRcdFx0XHRcdHByZXNldF9idG4uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi10cGwtc2VhcmNoLWtleScgKSB8fCAnJyxcclxuXHRcdFx0XHRcdFx0ZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRcdGFwaS5vbl9zZWxlY3Rpb25fY2hhbmdlKCBhcGkuZ2V0X3NlbGVjdGVkX3RlbXBsYXRlX3NsdWcoKSwgYXBpICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRjb25zdCBwYWdlciA9IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi10cGwtcGFnZXI9XCIxXCJdJyApO1xyXG5cdFx0XHRcdGlmICggcGFnZXIgKSB7XHJcblx0XHRcdFx0XHRjb25zdCBwcmV2ID0gZS50YXJnZXQuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYmZiLXRwbC1wYWdlLXByZXY9XCIxXCJdJyApO1xyXG5cdFx0XHRcdFx0Y29uc3QgbmV4dCA9IGUudGFyZ2V0LmNsb3Nlc3QoICdbZGF0YS13cGJjLWJmYi10cGwtcGFnZS1uZXh0PVwiMVwiXScgKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoICEgcHJldiAmJiAhIG5leHQgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQoIHByZXYgJiYgKCBwcmV2LmNsYXNzTGlzdC5jb250YWlucyggJ2Rpc2FibGVkJyApIHx8IHByZXYuZ2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKSA9PT0gJ3RydWUnICkgKSB8fFxyXG5cdFx0XHRcdFx0XHQoIG5leHQgJiYgKCBuZXh0LmNsYXNzTGlzdC5jb250YWlucyggJ2Rpc2FibGVkJyApIHx8IG5leHQuZ2V0QXR0cmlidXRlKCAnYXJpYS1kaXNhYmxlZCcgKSA9PT0gJ3RydWUnICkgKVxyXG5cdFx0XHRcdFx0KSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRjb25zdCBwYWdlICAgPSBwYXJzZUludCggYXBpLm1vZGFsX2VsLl9fd3BiY19iZmJfdHBsX3BhZ2UgfHwgMSwgMTAgKSB8fCAxO1xyXG5cdFx0XHRcdFx0Y29uc3Qgc2VhcmNoID0gU3RyaW5nKCBhcGkubW9kYWxfZWwuX193cGJjX2JmYl90cGxfc2VhcmNoIHx8ICcnICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBwcmV2ICkge1xyXG5cdFx0XHRcdFx0XHRhcGkubG9hZF90ZW1wbGF0ZXMoIE1hdGgubWF4KCAxLCBwYWdlIC0gMSApLCBzZWFyY2gsIGZ1bmN0aW9uICgpIHt9ICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIG5leHQgKSB7XHJcblx0XHRcdFx0XHRcdGFwaS5sb2FkX3RlbXBsYXRlcyggcGFnZSArIDEsIHNlYXJjaCwgZnVuY3Rpb24gKCkge30gKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGNvbnN0IGl0ZW0gPSBlLnRhcmdldC5jbG9zZXN0KCAnW2RhdGEtd3BiYy1iZmItdHBsLWl0ZW09XCIxXCJdJyApO1xyXG5cdFx0XHRcdGlmICggISBpdGVtICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0XHRjb25zdCBjbGlja2VkID0gaXRlbS5nZXRBdHRyaWJ1dGUoICdkYXRhLXRlbXBsYXRlLXNsdWcnICkgfHwgJyc7XHJcblx0XHRcdFx0Y29uc3QgY3VycmVudCA9IGFwaS5nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZygpO1xyXG5cclxuXHRcdFx0XHRpZiAoIGNsaWNrZWQgJiYgY2xpY2tlZCA9PT0gY3VycmVudCAmJiBjbGlja2VkICE9PSBhcGkuYmxhbmtfdGVtcGxhdGVfc2x1ZyAmJiBhcGkuYWxsb3dfc2FtZV9jbGlja19ibGFuayApIHtcclxuXHRcdFx0XHRcdGFwaS5zZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyggYXBpLmJsYW5rX3RlbXBsYXRlX3NsdWcgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBjbGlja2VkICkge1xyXG5cdFx0XHRcdFx0YXBpLnNldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnKCBjbGlja2VkICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdGFwaS5zZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZyggYXBpLmJsYW5rX3RlbXBsYXRlX3NsdWcgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGFwaS5yZWZyZXNoX3NlbGVjdGlvbl9oaWdobGlnaHQoKTtcclxuXHRcdFx0XHRhcGkub25fc2VsZWN0aW9uX2NoYW5nZSggYXBpLmdldF9zZWxlY3RlZF90ZW1wbGF0ZV9zbHVnKCksIGFwaSApO1xyXG5cdFx0XHR9LCB0cnVlICk7XHJcblxyXG5cdFx0XHRpZiAoIHNlYXJjaF9lbCApIHtcclxuXHRcdFx0XHRzZWFyY2hfZWwuYWRkRXZlbnRMaXN0ZW5lciggJ2lucHV0JywgZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0Y29uc3QgdiA9IFN0cmluZyggc2VhcmNoX2VsLnZhbHVlIHx8ICcnICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBhcGkubW9kYWxfZWwuX193cGJjX2JmYl90cGxfc2VhcmNoX3RpbWVyICkge1xyXG5cdFx0XHRcdFx0XHRjbGVhclRpbWVvdXQoIGFwaS5tb2RhbF9lbC5fX3dwYmNfYmZiX3RwbF9zZWFyY2hfdGltZXIgKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRhcGkubW9kYWxfZWwuX193cGJjX2JmYl90cGxfc2VhcmNoX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0XHRhcGkuYXBwbHlfc2VhcmNoX3ZhbHVlKCB2LCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRcdFx0YXBpLm9uX3NlbGVjdGlvbl9jaGFuZ2UoIGFwaS5nZXRfc2VsZWN0ZWRfdGVtcGxhdGVfc2x1ZygpLCBhcGkgKTtcclxuXHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0fSwgMzAwICk7XHJcblx0XHRcdFx0fSwgdHJ1ZSApO1xyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cclxuXHRcdHJldHVybiBhcGk7XHJcblx0fTtcclxuXHJcblx0dy53cGJjX2JmYl9fZ2V0X3RlbXBsYXRlX3NlYXJjaF9vcl9zZXAgICAgID0gd3BiY19iZmJfX2dldF90ZW1wbGF0ZV9zZWFyY2hfb3Jfc2VwO1xyXG5cdHcud3BiY19iZmJfX2dldF90ZW1wbGF0ZV9zZWFyY2hfb3Jfc2VwX3VybCA9IHdwYmNfYmZiX19nZXRfdGVtcGxhdGVfc2VhcmNoX29yX3NlcF91cmw7XHJcblx0dy53cGJjX2JmYl9fZXNjYXBlX3JlZ2V4ICAgICAgICAgICAgICAgICAgID0gd3BiY19iZmJfX2VzY2FwZV9yZWdleDtcclxuXHR3LndwYmNfYmZiX19ub3JtYWxpemVfdGVtcGxhdGVfc2VhcmNoICAgICAgPSB3cGJjX2JmYl9fbm9ybWFsaXplX3RlbXBsYXRlX3NlYXJjaDtcclxuXHR3LndwYmNfYmZiX19pMThuICAgICAgICAgICAgICAgICAgICAgICAgICAgPSB3cGJjX2JmYl9faTE4bjtcclxuXHJcbn0oIHdpbmRvdywgZG9jdW1lbnQgKSk7XHJcblxyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0MsV0FBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixNQUFNQyxJQUFJLEdBQUlGLENBQUMsQ0FBQ0csYUFBYSxHQUFHSCxDQUFDLENBQUNHLGFBQWEsSUFBSSxDQUFDLENBQUU7RUFDdEQsTUFBTUMsRUFBRSxHQUFNRixJQUFJLENBQUNFLEVBQUUsR0FBR0YsSUFBSSxDQUFDRSxFQUFFLElBQUksQ0FBQyxDQUFFO0VBRXRDQSxFQUFFLENBQUNDLGVBQWUsR0FBR0QsRUFBRSxDQUFDQyxlQUFlLElBQUksQ0FBQyxDQUFDO0VBRTdDLFNBQVNDLGNBQWNBLENBQUNDLEdBQUcsRUFBRUMsUUFBUSxFQUFFO0lBQ3RDLElBQUk7TUFDSCxNQUFNQyxHQUFHLEdBQUdULENBQUMsQ0FBQ1UsYUFBYSxJQUFJLENBQUMsQ0FBQztNQUNqQyxNQUFN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

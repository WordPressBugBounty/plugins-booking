"use strict";

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/preview/_out/bfb-preview.js
// == BFB Preview Client — sends current structure via AJAX and loads preview URL into iframe
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
  'use strict';

  /**
   * Simple logger alias (optional).
   *
   * @type {{log:Function, error:Function}}
   */
  var dev = w._wpbc && w._wpbc.dev ? w._wpbc.dev : {
    log: function () {},
    error: function () {}
  };

  /**
   * Preview client class.
   * Binds to a preview panel root that contains button + iframe.
   */
  class wpbc_bfb_preview_client {
    /**
     * @param {HTMLElement} root_el Root element of the preview panel.
     */
    constructor(root_el) {
      this.root_el = root_el;
      this.iframe = root_el.querySelector('[data-wpbc-bfb-preview-iframe="1"]');
      this.loader = root_el.querySelector('[data-wpbc-bfb-preview-loader="1"]'); // NEW
      this.button = null; // No local "Update Preview" button in panel anymore.

      this.nonce = root_el.getAttribute('data-preview-nonce') || '';
      this.is_busy = false;
      if (!this.iframe) {
        dev.error('wpbc_bfb_preview_client', 'Missing iframe element');
        return;
      }
      this.bind_events();
    }

    /**
     * Show/hide the overlay loader over the iframe.
     *
     * @param {boolean} is_visible
     */
    set_loader_visible(is_visible) {
      if (!this.loader) {
        return;
      }
      if (is_visible) {
        this.loader.classList.add('is-visible');
      } else {
        this.loader.classList.remove('is-visible');
      }
    }

    /**
     * Bind UI events (panel-local button, if present).
     */
    bind_events() {
      var self = this;
      if (!this.button) {
        return;
      }
      this.button.addEventListener('click', function () {
        self.update_preview();
      });
    }

    /**
     * Get current BFB structure from global builder.
     *
     * @returns {Object|null}
     */
    get_current_structure() {
      if (!w.wpbc_bfb || typeof w.wpbc_bfb.get_structure !== 'function') {
        dev.error('wpbc_bfb_preview_client', 'wpbc_bfb.get_structure() is not available');
        return null;
      }
      try {
        return w.wpbc_bfb.get_structure();
      } catch (e) {
        dev.error('wpbc_bfb_preview_client.get_current_structure', e);
        return null;
      }
    }

    /**
     * Parse combined length value like "100%", "320px", "12.5rem".
     *
     * @param {string} value
     * @return {{num:string, unit:string}}
     */
    parse_length_value(value) {
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
     * Build current form settings payload (same structure as real Save):
     * {
     *   options: { ...source-of-truth... },
     *   css_vars: { ...compiled... }
     * }
     *
     * @param {string} form_name
     * @returns {{options:Object, css_vars:Object}}
     */
    get_current_form_settings(form_name) {
      var form_settings = {
        options: {},
        css_vars: {}
      };

      // --- same event contract as ajax/_out/bfb-ajax.js ----------------------------------------------
      wpbc_bfb__dispatch_event_safe('wpbc:bfb:form_settings:collect', {
        settings: form_settings,
        form_name: form_name || 'standard'
      });

      // Strict: require correct shape.
      if (!form_settings || typeof form_settings !== 'object') {
        form_settings = {
          options: {},
          css_vars: {}
        };
      }
      if (!form_settings.options || typeof form_settings.options !== 'object') {
        form_settings.options = {};
      }
      if (!form_settings.css_vars || typeof form_settings.css_vars !== 'object') {
        form_settings.css_vars = {};
      }
      return form_settings;
    }

    /**
     * Get the currently selected calendar skin URL from the Builder page.
     *
     * @returns {string}
     */
    get_selected_calendar_skin_url() {
      var select_el = d.querySelector('.js-wpbc-bfb-calendar-skin');
      if (select_el && select_el.options) {
        var selected_option = select_el.options[select_el.selectedIndex];
        if (selected_option) {
          var selected_url = selected_option.getAttribute('data-wpbc-calendar-skin-url');
          if (selected_url) {
            return String(selected_url);
          }
        }
      }
      var stylesheet = d.getElementById('wpbc-calendar-skin-css');
      if (stylesheet && stylesheet.href) {
        return String(stylesheet.href);
      }
      return '';
    }

    /**
     * Apply the unsaved Builder calendar skin inside the loaded Preview iframe.
     *
     * @param {string} skin_url
     * @param {Function} done
     * @param {number} tries
     */
    apply_calendar_skin_to_iframe(skin_url, done, tries) {
      var self = this;
      var attempt_num = Number(tries || 0);
      if (!skin_url || !this.iframe || !this.iframe.contentWindow) {
        if (typeof done === 'function') {
          done();
        }
        return;
      }
      try {
        if (typeof this.iframe.contentWindow.wpbc__calendar__change_skin === 'function') {
          this.iframe.contentWindow.wpbc__calendar__change_skin(skin_url);
          if (typeof done === 'function') {
            done();
          }
          return;
        }
      } catch (e) {
        dev.error('wpbc_bfb_preview_client.apply_calendar_skin_to_iframe', e);
      }
      if (attempt_num >= 20) {
        if (typeof done === 'function') {
          done();
        }
        return;
      }
      w.setTimeout(function () {
        self.apply_calendar_skin_to_iframe(skin_url, done, attempt_num + 1);
      }, 100);
    }

    /**
     * Send snapshot to server and update iframe src with returned preview URL.
     *
     * @param {{source_button?:HTMLElement}} [opts]
     */
    update_preview(opts) {
      if (this.is_busy) {
        return;
      }
      var structure = this.get_current_structure();
      if (!structure) {
        return;
      }
      this.set_loader_visible(true);
      var options = opts || {};
      var source_btn = options.source_button || null;
      var $source_btn = null;
      if (source_btn && w.jQuery && typeof w.wpbc_bfb__button_busy_start === 'function') {
        $source_btn = w.jQuery(source_btn);
        if ($source_btn && $source_btn.length) {
          w.wpbc_bfb__button_busy_start($source_btn);
        }
      }
      this.is_busy = true;
      this.set_button_busy(true); // local "Update Preview" button in the panel

      var payload = new w.FormData();
      var cfg = w.WPBC_BFB_Ajax || {};

      // Build settings payload (same as real saving).
      var form_settings = this.get_current_form_settings(cfg.form_name || 'standard');
      payload.append('action', 'WPBC_AJX_BFB_SAVE_FORM_CONFIG');
      payload.append('nonce', cfg.nonce_save || this.nonce || '');

      // IMPORTANT:
      // - form_name is the logical form key (usually 'standard' or selected form)
      payload.append('form_name', cfg.form_name || 'standard');
      payload.append('status', 'preview');
      payload.append('return_preview_url', '1');
      payload.append('engine', cfg.engine || 'bfb');
      payload.append('engine_version', cfg.engine_version || '1.0');
      payload.append('structure', JSON.stringify(structure));

      // Send real settings (options + compiled css_vars).
      payload.append('settings', JSON.stringify(form_settings));

      // ----------------------------------------------------------------------------
      // Choose where advanced_form + content_form are taken from (auto|builder|advanced)
      // ----------------------------------------------------------------------------
      var preview_source = wpbc_bfb_preview__get_source(cfg, source_btn);
      payload.append('preview_source', preview_source);
      var adv = null;

      // 1) Try Advanced Mode text (if selected / auto+dirty)
      if (preview_source === 'advanced' || preview_source === 'auto') {
        adv = wpbc_bfb_preview__read_advanced_mode_payload(d, w);
        var can_use_advanced = preview_source === 'advanced' || preview_source === 'auto' && adv && adv.is_dirty;
        if (can_use_advanced) {
          // Forced "advanced" but empty -> fallback to builder export.
          if (!wpbc_bfb_preview__has_text(adv.advanced_form) && !wpbc_bfb_preview__has_text(adv.content_form)) {
            if (typeof w.wpbc_admin_show_message === 'function') {
              w.wpbc_admin_show_message('Advanced Mode is selected, but editors are empty. Using Builder export.', 'warning', 6000);
            }
          } else {
            if (wpbc_bfb_preview__has_text(adv.advanced_form)) {
              payload.append('advanced_form', adv.advanced_form);
            }
            if (wpbc_bfb_preview__has_text(adv.content_form)) {
              payload.append('content_form', adv.content_form);
            }
          }
        }
      }

      // 2) If not taken from Advanced Mode -> export from Builder structure (current behavior)
      var already_has_adv = payload.has && (payload.has('advanced_form') || payload.has('content_form')); // some browsers
      // support
      // FormData.has

      // Fallback for old browsers (no FormData.has)
      if (typeof payload.has !== 'function') {
        already_has_adv = false; // just try exporter if needed
      }
      if (!already_has_adv) {
        if (w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function') {
          try {
            var width_combined = form_settings.options.booking_form_layout_width || '';
            var parsed_width = this.parse_length_value(width_combined);
            var width_unit = parsed_width.unit ? parsed_width.unit : '%';
            var export_options = {
              gapPercent: 3,
              form_slug: cfg.form_name || 'standard',
              form_width_value: parsed_width.num,
              form_width_unit: width_unit
            };
            var export_result = w.WPBC_BFB_Exporter.export_all(structure || [], export_options);
            if (export_result) {
              if (export_result.advanced_form) {
                payload.append('advanced_form', export_result.advanced_form);
              }
              if (export_result.fields_data) {
                payload.append('content_form', export_result.fields_data);
              }
            }
          } catch (e) {
            console.error('WPBC BFB: export_all error', e);
          }
        }
      }

      // Use shared helper if available; fallback to ajaxurl.
      var ajax_url = '';
      if (typeof w.wpbc_bfb__get_ajax_url === 'function') {
        ajax_url = w.wpbc_bfb__get_ajax_url();
      } else if (typeof w.ajaxurl !== 'undefined' && w.ajaxurl) {
        ajax_url = w.ajaxurl;
      }
      var self = this;
      var preview_calendar_skin_url = this.get_selected_calendar_skin_url();
      function end_busy_now() {
        self._end_busy($source_btn);
      }
      if (!ajax_url) {
        dev.error('wpbc_bfb_preview_client', 'ajax URL is not defined');
        end_busy_now();
        return;
      }
      w.fetch(ajax_url, {
        method: 'POST',
        body: payload
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        if (!data || !data.success || !data.data || !data.data.preview_url) {
          dev.error('wpbc_bfb_preview_client', 'Preview AJAX error', data);
          end_busy_now();
          return;
        }
        if (!self.iframe) {
          dev.error('wpbc_bfb_preview_client', 'Missing iframe element');
          end_busy_now();
          return;
        }

        // Wait until iframe has really loaded the preview URL.
        var on_load = function () {
          self.iframe.removeEventListener('load', on_load);
          self.apply_calendar_skin_to_iframe(preview_calendar_skin_url, end_busy_now);
        };
        self.iframe.addEventListener('load', on_load);
        self.iframe.setAttribute('src', data.data.preview_url);
      }).catch(function (err) {
        dev.error('wpbc_bfb_preview_client', 'Preview AJAX failed', err);
        end_busy_now();
      });
    }

    /**
     * Internal helper: stop busy state on panel button + optional top toolbar button.
     *
     * @param {jQuery|null} $source_btn
     * @private
     */
    _end_busy($source_btn) {
      this.is_busy = false;
      this.set_button_busy(false);
      this.set_loader_visible(false); // NEW

      if ($source_btn && typeof w.wpbc_bfb__button_busy_end === 'function') {
        w.wpbc_bfb__button_busy_end($source_btn);
      }
    }

    /**
     * Force-reset any busy states related to preview.
     * This is called when switching back to Builder mode (soft-cancel UX).
     */
    reset_busy_state() {
      this.is_busy = false;
      this.set_button_busy(false); // panel button, if any
      this.set_loader_visible(false); // NEW

      if (w.jQuery && typeof w.wpbc_bfb__button_busy_end === 'function') {
        // Top toolbar buttons that may show "Loading preview..."
        var $btns = w.jQuery('[data-wpbc-bfb-top-preview-btn="1"],' + '[data-wpbc-bfb-top-refresh-btn="1"]');
        $btns.each(function () {
          var $b = w.jQuery(this);
          if ($b.hasClass('wpbc-is-busy')) {
            w.wpbc_bfb__button_busy_end($b);
          }
        });
      }
    }

    /**
     * Simple busy indicator for the panel "Update Preview" button.
     * Reuses global WPBC busy helpers if available, so the spinner matches Save/Load buttons.
     *
     * @param {boolean} is_busy
     */
    set_button_busy(is_busy) {
      if (!this.button) {
        return;
      }

      // If jQuery + global helpers exist, use same spinner as other toolbar buttons.
      if (w.jQuery && typeof w.wpbc_bfb__button_busy_start === 'function' && typeof w.wpbc_bfb__button_busy_end === 'function') {
        var $btn = w.jQuery(this.button);
        if (is_busy) {
          w.wpbc_bfb__button_busy_start($btn);
        } else {
          w.wpbc_bfb__button_busy_end($btn);
        }
        return;
      }

      // Fallback: simple disabled state without spinner.
      if (is_busy) {
        this.button.setAttribute('disabled', 'disabled');
        this.button.classList.add('wpbc_bfb__preview_btn_busy');
      } else {
        this.button.removeAttribute('disabled');
        this.button.classList.remove('wpbc_bfb__preview_btn_busy');
      }
    }

    /**
     * Set current view mode: "builder" or "preview".
     * Applies/removes CSS class on <body>.
     *
     * @param {('builder'|'preview')} mode
     */
    set_mode(mode) {
      var body = d.body;
      if (!body) {
        return;
      }
      if (mode === 'preview') {
        body.classList.add('wpbc_bfb__mode_preview');
      } else {
        body.classList.remove('wpbc_bfb__mode_preview');
      }
    }
  }

  // -- Helpers ------------------------------------------------------------------------------------------------------
  /**
   * Is Preview mode currently active?
   * We prefer body class (set by client.set_mode), fallback to active tab id.
   *
   * @return {boolean}
   */
  function wpbc_bfb_preview__is_preview_mode_active() {
    var body = d.body;
    if (body && body.classList && body.classList.contains('wpbc_bfb__mode_preview')) {
      return true;
    }
    return wpbc_bfb_preview__get_active_top_tab_id() === 'preview_tab';
  }

  /**
   * When a form is loaded via AJAX while Preview tab is active,
   * refresh the iframe so it shows the newly loaded form.
   *
   * @param {wpbc_bfb_preview_client} client
   */
  function wpbc_bfb_preview__bind_form_ajax_loaded_events(client) {
    if (!client) {
      return;
    }

    // Prevent double binding if this script is injected twice.
    if (w.__wpbc_bfb_preview__form_ajax_loaded_bound === '1') {
      return;
    }
    w.__wpbc_bfb_preview__form_ajax_loaded_bound = '1';
    var debounce_id = null;
    d.addEventListener('wpbc:bfb:form:ajax_loaded', function (ev) {
      // Only do anything if Preview is currently active.
      if (!wpbc_bfb_preview__is_preview_mode_active()) {
        return;
      }
      var det = ev && ev.detail ? ev.detail : {};
      var fn = det.form_name ? String(det.form_name) : '';

      // Best-effort: keep cfg.form_name in sync for payload building.
      if (fn) {
        w.WPBC_BFB_Ajax = w.WPBC_BFB_Ajax || {};
        w.WPBC_BFB_Ajax.form_name = fn;
      }

      // Debounce multiple rapid loads (or secondary events).
      if (debounce_id) {
        clearTimeout(debounce_id);
      }
      debounce_id = setTimeout(function () {
        debounce_id = null;

        // Preview might have been left while waiting.
        if (!wpbc_bfb_preview__is_preview_mode_active()) {
          return;
        }

        // If we are already sending preview, don't stack another request.
        if (client.is_busy) {
          // Try once more shortly (safe).
          setTimeout(function () {
            if (wpbc_bfb_preview__is_preview_mode_active() && !client.is_busy) {
              client.update_preview({
                source_button: null
              });
            }
          }, 250);
          return;
        }

        // Wait until builder API is present (form load can be async).
        var tries = 0;
        (function wait_for_builder() {
          if (!wpbc_bfb_preview__is_preview_mode_active()) {
            return;
          }
          if (w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function') {
            client.update_preview({
              source_button: null
            });
            return;
          }
          tries++;
          if (tries < 15) {
            setTimeout(wait_for_builder, 200);
          }
        })();
      }, 180);
    }, {
      passive: true
    });
  }
  function wpbc_bfb_preview__get_source(cfg, btn) {
    // priority: button attr -> global cfg -> default
    var v = '';
    try {
      if (btn && btn.getAttribute) {
        v = btn.getAttribute('data-wpbc-bfb-preview-source') || btn.getAttribute('data-wpbc-bfb-save-source') || '';
      }
    } catch (e) {}
    if (!v && cfg && (cfg.preview_source || cfg.save_source)) {
      v = cfg.preview_source || cfg.save_source;
    }
    v = String(v || 'auto').toLowerCase();
    if (['builder', 'advanced', 'auto'].indexOf(v) === -1) {
      v = 'builder';
    }
    return v;
  }
  function wpbc_bfb_preview__has_text(v) {
    return !!(v && String(v).trim());
  }
  function wpbc_bfb_preview__read_advanced_mode_payload(d, w) {
    // best: API (syncs CodeMirror -> textarea)
    if (w.wpbc_bfb_advanced_editor_api && typeof w.wpbc_bfb_advanced_editor_api.get_values === 'function') {
      try {
        return w.wpbc_bfb_advanced_editor_api.get_values();
      } catch (e) {}
    }

    // fallback: read textareas directly
    var ta_form = d.getElementById('wpbc_bfb__advanced_form_editor');
    var ta_content = d.getElementById('wpbc_bfb__content_form_editor');
    return {
      advanced_form: ta_form ? String(ta_form.value || '') : '',
      content_form: ta_content ? String(ta_content.value || '') : '',
      is_dirty: false
    };
  }

  /**
   * Is this element the Preview TAB link in top tabs nav?
   *
   * @param {HTMLElement|null} el
   * @return {boolean}
   */
  function wpbc_bfb_preview__is_preview_tab_link(el) {
    if (!el || !el.getAttribute) {
      return false;
    }
    return el.getAttribute('data-wpbc-bfb-action') === 'panel' && el.getAttribute('data-wpbc-bfb-tab') === 'preview_tab';
  }

  /**
   * Is this element the Builder TAB link in top tabs nav?
   *
   * @param {HTMLElement|null} el
   * @return {boolean}
   */
  function wpbc_bfb_preview__is_builder_tab_link(el) {
    if (!el || !el.getAttribute) {
      return false;
    }
    return el.getAttribute('data-wpbc-bfb-action') === 'panel' && el.getAttribute('data-wpbc-bfb-tab') === 'builder_tab';
  }

  /**
   * Activate a "panel" tab and show its panel section (scoped).
   *
   * Strategy:
   * 1) Try to click the real top-tab link (best).
   * 2) If link does not exist (e.g. Preview tab removed from nav), do a scoped manual switch:
   *    - use nav's data-wpbc-bfb-panels-root + data-wpbc-bfb-panel-class
   *    - hide/show ONLY those outer panels
   *    - DO NOT touch inner panels
   *
   * @param {string} tab_id
   * @return {boolean}
   */
  function wpbc_bfb__activate_panel_tab(tab_id) {
    tab_id = String(tab_id || '').trim();
    if (!tab_id) {
      return false;
    }

    // 1) Best: trigger existing top-tabs switching by clicking the tab link (if it exists).
    var tab_link = d.querySelector('[data-wpbc-bfb-action="panel"][data-wpbc-bfb-tab="' + tab_id + '"]');
    if (tab_link && typeof tab_link.click === 'function') {
      try {
        tab_link.click();
        return true;
      } catch (_e) {}
    }

    // 2) Fallback: scoped manual toggle (outer panels only).
    var nav = d.getElementById('wpbc_bfb__top_horisontal_nav');

    // Determine outer panels root.
    var panels_root = d;
    var panels_root_selector = '';
    if (nav) {
      panels_root_selector = nav.getAttribute('data-wpbc-bfb-panels-root') || '';
      panels_root_selector = String(panels_root_selector || '').trim();
    }

    // Fallback if attribute missing: prefer #wpbc_bfb__top_panels if present.
    if (!panels_root_selector) {
      panels_root_selector = '#wpbc_bfb__top_panels';
    }
    if (panels_root_selector) {
      try {
        var root_el = d.querySelector(panels_root_selector);
        if (root_el) {
          panels_root = root_el;
        }
      } catch (_e2) {}
    }

    // Determine outer base class (IMPORTANT: must be the OUTER base, not wpbc_bfb__tab_section).
    var panel_base_class = 'wpbc_bfb__top_tab_section';
    if (nav) {
      var from_nav = nav.getAttribute('data-wpbc-bfb-panel-class') || '';
      from_nav = String(from_nav || '').trim();
      if (from_nav) {
        panel_base_class = from_nav;
      }
    }

    // Update active tab on nav (source of truth).
    if (nav) {
      nav.setAttribute('data-active-tab', tab_id);
    }

    // Hide ONLY outer panels (scoped by base class).
    var selector_all = '.' + panel_base_class;
    var panel_nodes = panels_root.querySelectorAll(selector_all);
    for (var i = 0; i < panel_nodes.length; i++) {
      panel_nodes[i].style.display = 'none';
    }

    // Show requested outer panel.
    var selector_active = '.' + panel_base_class + '__' + tab_id;
    var active_panel = panels_root.querySelector(selector_active);
    if (!active_panel) {
      // Backward-compatible fallback (if someone forgot to add outer classes).
      active_panel = panels_root.querySelector('.wpbc_bfb__tab_section__' + tab_id);
    }
    if (active_panel) {
      active_panel.style.display = '';
    }

    // Mark active item in outer nav if it exists (Preview can be missing).
    if (nav) {
      var items = nav.querySelectorAll('.wpbc_ui_el__horis_nav_item');
      for (var j = 0; j < items.length; j++) {
        items[j].classList.remove('active');
      }
      var active_item = nav.querySelector('.wpbc_ui_el__horis_nav_item__' + tab_id);
      if (active_item) {
        active_item.classList.add('active');
      }
    }

    // Emit same event as bfb-top-tabs.js so other modules stay in sync.
    try {
      d.dispatchEvent(new CustomEvent('wpbc:bfb:top-tab', {
        detail: {
          tab: tab_id,
          nav_id: nav && nav.id ? String(nav.id) : ''
        }
      }));
    } catch (_e3) {}
    return true;
  }

  /**
   * Get currently active top tab id from the nav container.
   *
   * @return {string}
   */
  function wpbc_bfb_preview__get_active_top_tab_id() {
    var nav = d.getElementById('wpbc_bfb__top_horisontal_nav');
    if (!nav) {
      return '';
    }
    return nav.getAttribute('data-active-tab') || '';
  }

  /**
   * Sync preview "mode" with currently active top tab.
   *
   * Rules:
   * - preview_tab => enable preview mode (buttons make sense)
   * - any other tab => disable preview mode + reset busy states
   *
   * IMPORTANT:
   * - We do NOT change the active top tab here (no panel switching).
   *   We only sync preview UI mode.
   *
   * @param {string} tab_id
   * @param {wpbc_bfb_preview_client} client
   */
  function wpbc_bfb_preview__sync_mode_to_tab(tab_id, client) {
    tab_id = String(tab_id || '');
    if (!client) {
      return;
    }
    if ('preview_tab' === tab_id) {
      client.set_mode('preview');
      return;
    }

    // Leaving preview -> soft-cancel busy state and hide preview-specific toolbar.
    if (typeof client.reset_busy_state === 'function') {
      client.reset_busy_state();
    }
    client.set_mode('builder');
  }

  /**
   * Bind to top-tab switch event emitted by bfb-top-tabs.js.
   *
   * @param {wpbc_bfb_preview_client} client
   */
  function wpbc_bfb_preview__bind_top_tab_events(client) {
    // Sync immediately (in case event already fired before this script init).
    wpbc_bfb_preview__sync_mode_to_tab(wpbc_bfb_preview__get_active_top_tab_id(), client);

    // React to future tab changes.
    d.addEventListener('wpbc:bfb:top-tab', function (ev) {
      var det = ev && ev.detail ? ev.detail : {};
      var tab_id = det.tab ? String(det.tab) : '';
      var nav_id = det.nav_id ? String(det.nav_id) : '';
      var prev_id = det.prev_tab ? String(det.prev_tab) : '';

      // If user switched to preview_tab in the MAIN top nav,
      // remember what tab they came from.
      if (nav_id === TOP_NAV_ID && tab_id === 'preview_tab' && prev_id && prev_id !== 'preview_tab') {
        return_tab_id = prev_id;
      }
      wpbc_bfb_preview__sync_mode_to_tab(tab_id, client);
    });
  }

  // -- Bind | Init on Load ------------------------------------------------------------------------------------------
  var TOP_NAV_ID = 'wpbc_bfb__top_horisontal_nav';
  var return_tab_id = 'builder_tab';
  function remember_return_tab_from_dom() {
    var cur = wpbc_bfb_preview__get_active_top_tab_id();
    if (cur && cur !== 'preview_tab') {
      return_tab_id = cur;
    }
  }
  function get_return_tab_id() {
    var t = String(return_tab_id || '').trim();
    if (!t || t === 'preview_tab') t = 'builder_tab';
    return t;
  }

  /**
   * Auto-init preview client on Builder page and wire top toolbar buttons.
   */
  function wpbc_bfb_init_preview_client() {
    var root = d.querySelector('[data-wpbc-bfb-preview-root="1"]');
    if (!root) {
      return;
    }
    var client = new wpbc_bfb_preview_client(root);
    if (!w.WPBC_BFB_Preview) {
      w.WPBC_BFB_Preview = {
        client: client,
        show_preview: function (opts) {
          var opt = opts || {};
          var src = opt.source_button || null;

          // Remember where we were BEFORE switching to preview.
          remember_return_tab_from_dom();
          if (!wpbc_bfb_preview__is_preview_tab_link(src)) {
            wpbc_bfb__activate_panel_tab('preview_tab');
          }

          // Enable preview mode UI (shows refresh/back buttons etc).
          client.set_mode('preview');

          // IMPORTANT: Always regenerate when show_preview() is called (Preview tab click included).
          client.update_preview({
            source_button: src
          });
        },
        show_builder: function (opts) {
          var opt = opts || {};
          var src = opt.source_button || null;
          if (client && typeof client.reset_busy_state === 'function') {
            client.reset_busy_state();
          }
          var back_to = get_return_tab_id();

          // If Back button itself is not a real tab link -> just activate remembered tab.
          // If activation fails (tab removed), fallback to builder_tab.
          if (!wpbc_bfb_preview__is_builder_tab_link(src)) {
            if (!wpbc_bfb__activate_panel_tab(back_to)) {
              wpbc_bfb__activate_panel_tab('builder_tab');
            }
          }
          client.set_mode('builder');
        },
        show_advanced_tab: function (opts) {
          var opt = opts || {};
          if (client && typeof client.reset_busy_state === 'function') {
            client.reset_busy_state();
          }
          wpbc_bfb__activate_panel_tab('advanced_tab');
          client.set_mode('builder');
        }
      };
    }

    // Listen for top-tab changes and sync preview mode automatically.
    wpbc_bfb_preview__bind_top_tab_events(client);

    // When a form is loaded via AJAX, refresh preview (only if preview mode is active).
    wpbc_bfb_preview__bind_form_ajax_loaded_events(client);
    wpbc_bfb_bind_top_toolbar_buttons(client);
  }

  /**
   * Bind top toolbar Builder / Preview / Refresh buttons.
   * Supports multiple elements for each action (toolbar buttons, top tabs, etc.)
   * via data-wpbc-bfb-top-*-btn="1".
   */
  function wpbc_bfb_bind_top_toolbar_buttons(client) {
    var btn_preview_list = d.querySelectorAll('[data-wpbc-bfb-top-preview-btn="1"]');
    var btn_builder_list = d.querySelectorAll('[data-wpbc-bfb-top-builder-btn="1"]');
    var btn_refresh_list = d.querySelectorAll('[data-wpbc-bfb-top-refresh-btn="1"]');
    function for_each_node(list, cb) {
      if (!list || !list.length) {
        return;
      }
      Array.prototype.forEach.call(list, function (el) {
        if (el && typeof cb === 'function') {
          cb(el);
        }
      });
    }
    for_each_node(btn_preview_list, function (btn_preview) {
      // Prevent double binding if this script runs twice.
      if (btn_preview.getAttribute('data-wpbc-bfb-bound') === '1') {
        return;
      }
      btn_preview.setAttribute('data-wpbc-bfb-bound', '1');
      btn_preview.addEventListener('click', function (e) {
        e.preventDefault();
        if (w.WPBC_BFB_Preview && typeof w.WPBC_BFB_Preview.show_preview === 'function') {
          w.WPBC_BFB_Preview.show_preview({
            source_button: btn_preview
          });
        }
      });
    });
    for_each_node(btn_refresh_list, function (btn_refresh) {
      if (btn_refresh.getAttribute('data-wpbc-bfb-bound') === '1') {
        return;
      }
      btn_refresh.setAttribute('data-wpbc-bfb-bound', '1');
      btn_refresh.addEventListener('click', function (e) {
        e.preventDefault();
        if (w.WPBC_BFB_Preview && typeof w.WPBC_BFB_Preview.show_preview === 'function') {
          w.WPBC_BFB_Preview.show_preview({
            update: true,
            source_button: btn_refresh
          });
        }
      });
    });
    for_each_node(btn_builder_list, function (btn_builder) {
      if (btn_builder.getAttribute('data-wpbc-bfb-bound') === '1') {
        return;
      }
      btn_builder.setAttribute('data-wpbc-bfb-bound', '1');
      btn_builder.addEventListener('click', function (e) {
        e.preventDefault();
        if (w.WPBC_BFB_Preview && typeof w.WPBC_BFB_Preview.show_builder === 'function') {
          w.WPBC_BFB_Preview.show_builder({
            source_button: btn_builder
          });
        }
      });
    });
  }
  if (d.readyState === 'complete' || d.readyState === 'interactive') {
    setTimeout(wpbc_bfb_init_preview_client, 0);
  } else {
    d.addEventListener('DOMContentLoaded', wpbc_bfb_init_preview_client);
  }
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvcHJldmlldy9fb3V0L2JmYi1wcmV2aWV3LmpzIiwibmFtZXMiOlsidyIsImQiLCJkZXYiLCJfd3BiYyIsImxvZyIsImVycm9yIiwid3BiY19iZmJfcHJldmlld19jbGllbnQiLCJjb25zdHJ1Y3RvciIsInJvb3RfZWwiLCJpZnJhbWUiLCJxdWVyeVNlbGVjdG9yIiwibG9hZGVyIiwiYnV0dG9uIiwibm9uY2UiLCJnZXRBdHRyaWJ1dGUiLCJpc19idXN5IiwiYmluZF9ldmVudHMiLCJzZXRfbG9hZGVyX3Zpc2libGUiLCJpc192aXNpYmxlIiwiY2xhc3NMaXN0IiwiYWRkIiwicmVtb3ZlIiwic2VsZiIsImFkZEV2ZW50TGlzdGVuZXIiLCJ1cGRhdGVfcHJldmlldyIsImdldF9jdXJyZW50X3N0cnVjdHVyZSIsIndwYmNfYmZiIiwiZ2V0X3N0cnVjdHVyZSIsImUiLCJwYXJzZV9sZW5ndGhfdmFsdWUiLCJ2YWx1ZSIsInJhdyIsIlN0cmluZyIsInRyaW0iLCJtIiwibWF0Y2giLCJudW0iLCJ1bml0IiwiZ2V0X2N1cnJlbnRfZm9ybV9zZXR0aW5ncyIsImZvcm1fbmFtZSIsImZvcm1fc2V0dGluZ3MiLCJvcHRpb25zIiwiY3NzX3ZhcnMiLCJ3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSIsInNldHRpbmdzIiwiZ2V0X3NlbGVjdGVkX2NhbGVuZGFyX3NraW5fdXJsIiwic2VsZWN0X2VsIiwic2VsZWN0ZWRfb3B0aW9uIiwic2VsZWN0ZWRJbmRleCIsInNlbGVjdGVkX3VybCIsInN0eWxlc2hlZXQiLCJnZXRFbGVtZW50QnlJZCIsImhyZWYiLCJhcHBseV9jYWxlbmRhcl9za2luX3RvX2lmcmFtZSIsInNraW5fdXJsIiwiZG9uZSIsInRyaWVzIiwiYXR0ZW1wdF9udW0iLCJOdW1iZXIiLCJjb250ZW50V2luZG93Iiwid3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luIiwic2V0VGltZW91dCIsIm9wdHMiLCJzdHJ1Y3R1cmUiLCJzb3VyY2VfYnRuIiwic291cmNlX2J1dHRvbiIsIiRzb3VyY2VfYnRuIiwialF1ZXJ5Iiwid3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0IiwibGVuZ3RoIiwic2V0X2J1dHRvbl9idXN5IiwicGF5bG9hZCIsIkZvcm1EYXRhIiwiY2ZnIiwiV1BCQ19CRkJfQWpheCIsImFwcGVuZCIsIm5vbmNlX3NhdmUiLCJlbmdpbmUiLCJlbmdpbmVfdmVyc2lvbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJwcmV2aWV3X3NvdXJjZSIsIndwYmNfYmZiX3ByZXZpZXdfX2dldF9zb3VyY2UiLCJhZHYiLCJ3cGJjX2JmYl9wcmV2aWV3X19yZWFkX2FkdmFuY2VkX21vZGVfcGF5bG9hZCIsImNhbl91c2VfYWR2YW5jZWQiLCJpc19kaXJ0eSIsIndwYmNfYmZiX3ByZXZpZXdfX2hhc190ZXh0IiwiYWR2YW5jZWRfZm9ybSIsImNvbnRlbnRfZm9ybSIsIndwYmNfYWRtaW5fc2hvd19tZXNzYWdlIiwiYWxyZWFkeV9oYXNfYWR2IiwiaGFzIiwiV1BCQ19CRkJfRXhwb3J0ZXIiLCJleHBvcnRfYWxsIiwid2lkdGhfY29tYmluZWQiLCJib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoIiwicGFyc2VkX3dpZHRoIiwid2lkdGhfdW5pdCIsImV4cG9ydF9vcHRpb25zIiwiZ2FwUGVyY2VudCIsImZvcm1fc2x1ZyIsImZvcm1fd2lkdGhfdmFsdWUiLCJmb3JtX3dpZHRoX3VuaXQiLCJleHBvcnRfcmVzdWx0IiwiZmllbGRzX2RhdGEiLCJjb25zb2xlIiwiYWpheF91cmwiLCJ3cGJjX2JmYl9fZ2V0X2FqYXhfdXJsIiwiYWpheHVybCIsInByZXZpZXdfY2FsZW5kYXJfc2tpbl91cmwiLCJlbmRfYnVzeV9ub3ciLCJfZW5kX2J1c3kiLCJmZXRjaCIsIm1ldGhvZCIsImJvZHkiLCJ0aGVuIiwicmVzcG9uc2UiLCJqc29uIiwiZGF0YSIsInN1Y2Nlc3MiLCJwcmV2aWV3X3VybCIsIm9uX2xvYWQiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwic2V0QXR0cmlidXRlIiwiY2F0Y2giLCJlcnIiLCJ3cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kIiwicmVzZXRfYnVzeV9zdGF0ZSIsIiRidG5zIiwiZWFjaCIsIiRiIiwiaGFzQ2xhc3MiLCIkYnRuIiwicmVtb3ZlQXR0cmlidXRlIiwic2V0X21vZGUiLCJtb2RlIiwid3BiY19iZmJfcHJldmlld19faXNfcHJldmlld19tb2RlX2FjdGl2ZSIsImNvbnRhaW5zIiwid3BiY19iZmJfcHJldmlld19fZ2V0X2FjdGl2ZV90b3BfdGFiX2lkIiwid3BiY19iZmJfcHJldmlld19fYmluZF9mb3JtX2FqYXhfbG9hZGVkX2V2ZW50cyIsImNsaWVudCIsIl9fd3BiY19iZmJfcHJldmlld19fZm9ybV9hamF4X2xvYWRlZF9ib3VuZCIsImRlYm91bmNlX2lkIiwiZXYiLCJkZXQiLCJkZXRhaWwiLCJmbiIsImNsZWFyVGltZW91dCIsIndhaXRfZm9yX2J1aWxkZXIiLCJwYXNzaXZlIiwiYnRuIiwidiIsInNhdmVfc291cmNlIiwidG9Mb3dlckNhc2UiLCJpbmRleE9mIiwid3BiY19iZmJfYWR2YW5jZWRfZWRpdG9yX2FwaSIsImdldF92YWx1ZXMiLCJ0YV9mb3JtIiwidGFfY29udGVudCIsIndwYmNfYmZiX3ByZXZpZXdfX2lzX3ByZXZpZXdfdGFiX2xpbmsiLCJlbCIsIndwYmNfYmZiX3ByZXZpZXdfX2lzX2J1aWxkZXJfdGFiX2xpbmsiLCJ3cGJjX2JmYl9fYWN0aXZhdGVfcGFuZWxfdGFiIiwidGFiX2lkIiwidGFiX2xpbmsiLCJjbGljayIsIl9lIiwibmF2IiwicGFuZWxzX3Jvb3QiLCJwYW5lbHNfcm9vdF9zZWxlY3RvciIsIl9lMiIsInBhbmVsX2Jhc2VfY2xhc3MiLCJmcm9tX25hdiIsInNlbGVjdG9yX2FsbCIsInBhbmVsX25vZGVzIiwicXVlcnlTZWxlY3RvckFsbCIsImkiLCJzdHlsZSIsImRpc3BsYXkiLCJzZWxlY3Rvcl9hY3RpdmUiLCJhY3RpdmVfcGFuZWwiLCJpdGVtcyIsImoiLCJhY3RpdmVfaXRlbSIsImRpc3BhdGNoRXZlbnQiLCJDdXN0b21FdmVudCIsInRhYiIsIm5hdl9pZCIsImlkIiwiX2UzIiwid3BiY19iZmJfcHJldmlld19fc3luY19tb2RlX3RvX3RhYiIsIndwYmNfYmZiX3ByZXZpZXdfX2JpbmRfdG9wX3RhYl9ldmVudHMiLCJwcmV2X2lkIiwicHJldl90YWIiLCJUT1BfTkFWX0lEIiwicmV0dXJuX3RhYl9pZCIsInJlbWVtYmVyX3JldHVybl90YWJfZnJvbV9kb20iLCJjdXIiLCJnZXRfcmV0dXJuX3RhYl9pZCIsInQiLCJ3cGJjX2JmYl9pbml0X3ByZXZpZXdfY2xpZW50Iiwicm9vdCIsIldQQkNfQkZCX1ByZXZpZXciLCJzaG93X3ByZXZpZXciLCJvcHQiLCJzcmMiLCJzaG93X2J1aWxkZXIiLCJiYWNrX3RvIiwic2hvd19hZHZhbmNlZF90YWIiLCJ3cGJjX2JmYl9iaW5kX3RvcF90b29sYmFyX2J1dHRvbnMiLCJidG5fcHJldmlld19saXN0IiwiYnRuX2J1aWxkZXJfbGlzdCIsImJ0bl9yZWZyZXNoX2xpc3QiLCJmb3JfZWFjaF9ub2RlIiwibGlzdCIsImNiIiwiQXJyYXkiLCJwcm90b3R5cGUiLCJmb3JFYWNoIiwiY2FsbCIsImJ0bl9wcmV2aWV3IiwicHJldmVudERlZmF1bHQiLCJidG5fcmVmcmVzaCIsInVwZGF0ZSIsImJ0bl9idWlsZGVyIiwicmVhZHlTdGF0ZSIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvcHJldmlldy9fc3JjL2JmYi1wcmV2aWV3LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyA9PSBGaWxlICAvaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvcHJldmlldy9fb3V0L2JmYi1wcmV2aWV3LmpzXHJcbi8vID09IEJGQiBQcmV2aWV3IENsaWVudCDigJQgc2VuZHMgY3VycmVudCBzdHJ1Y3R1cmUgdmlhIEFKQVggYW5kIGxvYWRzIHByZXZpZXcgVVJMIGludG8gaWZyYW1lXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNpbXBsZSBsb2dnZXIgYWxpYXMgKG9wdGlvbmFsKS5cclxuXHQgKlxyXG5cdCAqIEB0eXBlIHt7bG9nOkZ1bmN0aW9uLCBlcnJvcjpGdW5jdGlvbn19XHJcblx0ICovXHJcblx0dmFyIGRldiA9ICh3Ll93cGJjICYmIHcuX3dwYmMuZGV2KSA/IHcuX3dwYmMuZGV2IDoge1xyXG5cdFx0bG9nOiBmdW5jdGlvbiAoKSB7fSxcclxuXHRcdGVycm9yOiBmdW5jdGlvbiAoKSB7fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFByZXZpZXcgY2xpZW50IGNsYXNzLlxyXG5cdCAqIEJpbmRzIHRvIGEgcHJldmlldyBwYW5lbCByb290IHRoYXQgY29udGFpbnMgYnV0dG9uICsgaWZyYW1lLlxyXG5cdCAqL1xyXG5cdGNsYXNzIHdwYmNfYmZiX3ByZXZpZXdfY2xpZW50IHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IHJvb3RfZWwgUm9vdCBlbGVtZW50IG9mIHRoZSBwcmV2aWV3IHBhbmVsLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3Rvcihyb290X2VsKSB7XHJcblx0XHRcdHRoaXMucm9vdF9lbCA9IHJvb3RfZWw7XHJcblx0XHRcdHRoaXMuaWZyYW1lICA9IHJvb3RfZWwucXVlcnlTZWxlY3RvciggJ1tkYXRhLXdwYmMtYmZiLXByZXZpZXctaWZyYW1lPVwiMVwiXScgKTtcclxuXHRcdFx0dGhpcy5sb2FkZXIgID0gcm9vdF9lbC5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItcHJldmlldy1sb2FkZXI9XCIxXCJdJyApOyAvLyBORVdcclxuXHRcdFx0dGhpcy5idXR0b24gID0gbnVsbDsgLy8gTm8gbG9jYWwgXCJVcGRhdGUgUHJldmlld1wiIGJ1dHRvbiBpbiBwYW5lbCBhbnltb3JlLlxyXG5cclxuXHRcdFx0dGhpcy5ub25jZSAgID0gcm9vdF9lbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXByZXZpZXctbm9uY2UnICkgfHwgJyc7XHJcblx0XHRcdHRoaXMuaXNfYnVzeSA9IGZhbHNlO1xyXG5cclxuXHRcdFx0aWYgKCAhdGhpcy5pZnJhbWUgKSB7XHJcblx0XHRcdFx0ZGV2LmVycm9yKCAnd3BiY19iZmJfcHJldmlld19jbGllbnQnLCAnTWlzc2luZyBpZnJhbWUgZWxlbWVudCcgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuYmluZF9ldmVudHMoKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93L2hpZGUgdGhlIG92ZXJsYXkgbG9hZGVyIG92ZXIgdGhlIGlmcmFtZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX3Zpc2libGVcclxuXHRcdCAqL1xyXG5cdFx0c2V0X2xvYWRlcl92aXNpYmxlKGlzX3Zpc2libGUpIHtcclxuXHRcdFx0aWYgKCAhdGhpcy5sb2FkZXIgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggaXNfdmlzaWJsZSApIHtcclxuXHRcdFx0XHR0aGlzLmxvYWRlci5jbGFzc0xpc3QuYWRkKCAnaXMtdmlzaWJsZScgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aGlzLmxvYWRlci5jbGFzc0xpc3QucmVtb3ZlKCAnaXMtdmlzaWJsZScgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQmluZCBVSSBldmVudHMgKHBhbmVsLWxvY2FsIGJ1dHRvbiwgaWYgcHJlc2VudCkuXHJcblx0XHQgKi9cclxuXHRcdGJpbmRfZXZlbnRzKCkge1xyXG5cdFx0XHR2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG5cdFx0XHRpZiAoICEgdGhpcy5idXR0b24gKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLmJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0c2VsZi51cGRhdGVfcHJldmlldygpO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgY3VycmVudCBCRkIgc3RydWN0dXJlIGZyb20gZ2xvYmFsIGJ1aWxkZXIuXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybnMge09iamVjdHxudWxsfVxyXG5cdFx0ICovXHJcblx0XHRnZXRfY3VycmVudF9zdHJ1Y3R1cmUoKSB7XHJcblx0XHRcdGlmICggISB3LndwYmNfYmZiIHx8IHR5cGVvZiB3LndwYmNfYmZiLmdldF9zdHJ1Y3R1cmUgIT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0ZGV2LmVycm9yKCAnd3BiY19iZmJfcHJldmlld19jbGllbnQnLCAnd3BiY19iZmIuZ2V0X3N0cnVjdHVyZSgpIGlzIG5vdCBhdmFpbGFibGUnICk7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0cmV0dXJuIHcud3BiY19iZmIuZ2V0X3N0cnVjdHVyZSgpO1xyXG5cdFx0XHR9IGNhdGNoIChlKSB7XHJcblx0XHRcdFx0ZGV2LmVycm9yKCAnd3BiY19iZmJfcHJldmlld19jbGllbnQuZ2V0X2N1cnJlbnRfc3RydWN0dXJlJywgZSApO1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBjb21iaW5lZCBsZW5ndGggdmFsdWUgbGlrZSBcIjEwMCVcIiwgXCIzMjBweFwiLCBcIjEyLjVyZW1cIi5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gdmFsdWVcclxuXHRcdCAqIEByZXR1cm4ge3tudW06c3RyaW5nLCB1bml0OnN0cmluZ319XHJcblx0XHQgKi9cclxuXHRcdHBhcnNlX2xlbmd0aF92YWx1ZSh2YWx1ZSkge1xyXG5cdFx0XHR2YXIgcmF3ID0gU3RyaW5nKHZhbHVlID09IG51bGwgPyAnJyA6IHZhbHVlKS50cmltKCk7XHJcblx0XHRcdHZhciBtID0gcmF3Lm1hdGNoKC9eXFxzKigtP1xcZCsoPzpcXC5cXGQrKT8pXFxzKihbYS16JV0qKVxccyokL2kpO1xyXG5cdFx0XHRpZiAoIW0pIHtcclxuXHRcdFx0XHRyZXR1cm4geyBudW06IHJhdywgdW5pdDogJycgfTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4geyBudW06IChtWzFdIHx8ICcnKSwgdW5pdDogKG1bMl0gfHwgJycpIH07XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBCdWlsZCBjdXJyZW50IGZvcm0gc2V0dGluZ3MgcGF5bG9hZCAoc2FtZSBzdHJ1Y3R1cmUgYXMgcmVhbCBTYXZlKTpcclxuXHRcdCAqIHtcclxuXHRcdCAqICAgb3B0aW9uczogeyAuLi5zb3VyY2Utb2YtdHJ1dGguLi4gfSxcclxuXHRcdCAqICAgY3NzX3ZhcnM6IHsgLi4uY29tcGlsZWQuLi4gfVxyXG5cdFx0ICogfVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmb3JtX25hbWVcclxuXHRcdCAqIEByZXR1cm5zIHt7b3B0aW9uczpPYmplY3QsIGNzc192YXJzOk9iamVjdH19XHJcblx0XHQgKi9cclxuXHRcdGdldF9jdXJyZW50X2Zvcm1fc2V0dGluZ3MoZm9ybV9uYW1lKSB7XHJcblxyXG5cdFx0XHR2YXIgZm9ybV9zZXR0aW5ncyA9IHtcclxuXHRcdFx0XHRvcHRpb25zIDoge30sXHJcblx0XHRcdFx0Y3NzX3ZhcnM6IHt9XHJcblx0XHRcdH07XHJcblxyXG5cdFx0XHQvLyAtLS0gc2FtZSBldmVudCBjb250cmFjdCBhcyBhamF4L19vdXQvYmZiLWFqYXguanMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHR3cGJjX2JmYl9fZGlzcGF0Y2hfZXZlbnRfc2FmZSggJ3dwYmM6YmZiOmZvcm1fc2V0dGluZ3M6Y29sbGVjdCcsIHtcclxuXHRcdFx0XHRzZXR0aW5ncyA6IGZvcm1fc2V0dGluZ3MsXHJcblx0XHRcdFx0Zm9ybV9uYW1lOiBmb3JtX25hbWUgfHwgJ3N0YW5kYXJkJ1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHQvLyBTdHJpY3Q6IHJlcXVpcmUgY29ycmVjdCBzaGFwZS5cclxuXHRcdFx0aWYgKCAhZm9ybV9zZXR0aW5ncyB8fCB0eXBlb2YgZm9ybV9zZXR0aW5ncyAhPT0gJ29iamVjdCcgKSB7XHJcblx0XHRcdFx0Zm9ybV9zZXR0aW5ncyA9IHsgb3B0aW9uczoge30sIGNzc192YXJzOiB7fSB9O1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggIWZvcm1fc2V0dGluZ3Mub3B0aW9ucyB8fCB0eXBlb2YgZm9ybV9zZXR0aW5ncy5vcHRpb25zICE9PSAnb2JqZWN0JyApIHtcclxuXHRcdFx0XHRmb3JtX3NldHRpbmdzLm9wdGlvbnMgPSB7fTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICFmb3JtX3NldHRpbmdzLmNzc192YXJzIHx8IHR5cGVvZiBmb3JtX3NldHRpbmdzLmNzc192YXJzICE9PSAnb2JqZWN0JyApIHtcclxuXHRcdFx0XHRmb3JtX3NldHRpbmdzLmNzc192YXJzID0ge307XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBmb3JtX3NldHRpbmdzO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IHRoZSBjdXJyZW50bHkgc2VsZWN0ZWQgY2FsZW5kYXIgc2tpbiBVUkwgZnJvbSB0aGUgQnVpbGRlciBwYWdlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHtzdHJpbmd9XHJcblx0XHQgKi9cclxuXHRcdGdldF9zZWxlY3RlZF9jYWxlbmRhcl9za2luX3VybCgpIHtcclxuXHRcdFx0dmFyIHNlbGVjdF9lbCA9IGQucXVlcnlTZWxlY3RvciggJy5qcy13cGJjLWJmYi1jYWxlbmRhci1za2luJyApO1xyXG5cdFx0XHRpZiAoIHNlbGVjdF9lbCAmJiBzZWxlY3RfZWwub3B0aW9ucyApIHtcclxuXHRcdFx0XHR2YXIgc2VsZWN0ZWRfb3B0aW9uID0gc2VsZWN0X2VsLm9wdGlvbnNbIHNlbGVjdF9lbC5zZWxlY3RlZEluZGV4IF07XHJcblx0XHRcdFx0aWYgKCBzZWxlY3RlZF9vcHRpb24gKSB7XHJcblx0XHRcdFx0XHR2YXIgc2VsZWN0ZWRfdXJsID0gc2VsZWN0ZWRfb3B0aW9uLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1jYWxlbmRhci1za2luLXVybCcgKTtcclxuXHRcdFx0XHRcdGlmICggc2VsZWN0ZWRfdXJsICkge1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gU3RyaW5nKCBzZWxlY3RlZF91cmwgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBzdHlsZXNoZWV0ID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmMtY2FsZW5kYXItc2tpbi1jc3MnICk7XHJcblx0XHRcdGlmICggc3R5bGVzaGVldCAmJiBzdHlsZXNoZWV0LmhyZWYgKSB7XHJcblx0XHRcdFx0cmV0dXJuIFN0cmluZyggc3R5bGVzaGVldC5ocmVmICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFwcGx5IHRoZSB1bnNhdmVkIEJ1aWxkZXIgY2FsZW5kYXIgc2tpbiBpbnNpZGUgdGhlIGxvYWRlZCBQcmV2aWV3IGlmcmFtZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gc2tpbl91cmxcclxuXHRcdCAqIEBwYXJhbSB7RnVuY3Rpb259IGRvbmVcclxuXHRcdCAqIEBwYXJhbSB7bnVtYmVyfSB0cmllc1xyXG5cdFx0ICovXHJcblx0XHRhcHBseV9jYWxlbmRhcl9za2luX3RvX2lmcmFtZShza2luX3VybCwgZG9uZSwgdHJpZXMpIHtcclxuXHRcdFx0dmFyIHNlbGYgICAgICAgID0gdGhpcztcclxuXHRcdFx0dmFyIGF0dGVtcHRfbnVtID0gTnVtYmVyKCB0cmllcyB8fCAwICk7XHJcblxyXG5cdFx0XHRpZiAoICEgc2tpbl91cmwgfHwgISB0aGlzLmlmcmFtZSB8fCAhIHRoaXMuaWZyYW1lLmNvbnRlbnRXaW5kb3cgKSB7XHJcblx0XHRcdFx0aWYgKCB0eXBlb2YgZG9uZSA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGRvbmUoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggdHlwZW9mIHRoaXMuaWZyYW1lLmNvbnRlbnRXaW5kb3cud3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dGhpcy5pZnJhbWUuY29udGVudFdpbmRvdy53cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4oIHNraW5fdXJsICk7XHJcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRkb25lKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRkZXYuZXJyb3IoICd3cGJjX2JmYl9wcmV2aWV3X2NsaWVudC5hcHBseV9jYWxlbmRhcl9za2luX3RvX2lmcmFtZScsIGUgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCBhdHRlbXB0X251bSA+PSAyMCApIHtcclxuXHRcdFx0XHRpZiAoIHR5cGVvZiBkb25lID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0ZG9uZSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHcuc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdHNlbGYuYXBwbHlfY2FsZW5kYXJfc2tpbl90b19pZnJhbWUoIHNraW5fdXJsLCBkb25lLCBhdHRlbXB0X251bSArIDEgKTtcclxuXHRcdFx0fSwgMTAwICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZW5kIHNuYXBzaG90IHRvIHNlcnZlciBhbmQgdXBkYXRlIGlmcmFtZSBzcmMgd2l0aCByZXR1cm5lZCBwcmV2aWV3IFVSTC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3tzb3VyY2VfYnV0dG9uPzpIVE1MRWxlbWVudH19IFtvcHRzXVxyXG5cdFx0ICovXHJcblx0XHR1cGRhdGVfcHJldmlldyggb3B0cyApIHtcclxuXHRcdFx0aWYgKCB0aGlzLmlzX2J1c3kgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgc3RydWN0dXJlID0gdGhpcy5nZXRfY3VycmVudF9zdHJ1Y3R1cmUoKTtcclxuXHRcdFx0aWYgKCAhIHN0cnVjdHVyZSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuc2V0X2xvYWRlcl92aXNpYmxlKCB0cnVlICk7XHJcblxyXG5cdFx0XHR2YXIgb3B0aW9ucyAgICA9IG9wdHMgfHwge307XHJcblx0XHRcdHZhciBzb3VyY2VfYnRuID0gb3B0aW9ucy5zb3VyY2VfYnV0dG9uIHx8IG51bGw7XHJcblxyXG5cdFx0XHR2YXIgJHNvdXJjZV9idG4gPSBudWxsO1xyXG5cdFx0XHRpZiAoIHNvdXJjZV9idG4gJiYgdy5qUXVlcnkgJiYgdHlwZW9mIHcud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0ID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdCRzb3VyY2VfYnRuID0gdy5qUXVlcnkoIHNvdXJjZV9idG4gKTtcclxuXHRcdFx0XHRpZiAoICRzb3VyY2VfYnRuICYmICRzb3VyY2VfYnRuLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdHcud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0KCAkc291cmNlX2J0biApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5pc19idXN5ID0gdHJ1ZTtcclxuXHRcdFx0dGhpcy5zZXRfYnV0dG9uX2J1c3koIHRydWUgKTsgLy8gbG9jYWwgXCJVcGRhdGUgUHJldmlld1wiIGJ1dHRvbiBpbiB0aGUgcGFuZWxcclxuXHJcblx0XHRcdHZhciBwYXlsb2FkID0gbmV3IHcuRm9ybURhdGEoKTtcclxuXHRcdFx0dmFyIGNmZyAgICAgPSB3LldQQkNfQkZCX0FqYXggfHwge307XHJcblxyXG5cdFx0XHQvLyBCdWlsZCBzZXR0aW5ncyBwYXlsb2FkIChzYW1lIGFzIHJlYWwgc2F2aW5nKS5cclxuXHRcdFx0dmFyIGZvcm1fc2V0dGluZ3MgPSB0aGlzLmdldF9jdXJyZW50X2Zvcm1fc2V0dGluZ3MoIGNmZy5mb3JtX25hbWUgfHwgJ3N0YW5kYXJkJyApO1xyXG5cclxuXHRcdFx0cGF5bG9hZC5hcHBlbmQoICdhY3Rpb24nLCAnV1BCQ19BSlhfQkZCX1NBVkVfRk9STV9DT05GSUcnICk7XHJcblx0XHRcdHBheWxvYWQuYXBwZW5kKCAnbm9uY2UnLCAoIGNmZy5ub25jZV9zYXZlIHx8IHRoaXMubm9uY2UgfHwgJycgKSApO1xyXG5cclxuXHRcdFx0Ly8gSU1QT1JUQU5UOlxyXG5cdFx0XHQvLyAtIGZvcm1fbmFtZSBpcyB0aGUgbG9naWNhbCBmb3JtIGtleSAodXN1YWxseSAnc3RhbmRhcmQnIG9yIHNlbGVjdGVkIGZvcm0pXHJcblx0XHRcdHBheWxvYWQuYXBwZW5kKCAnZm9ybV9uYW1lJywgKCBjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCcgKSApO1xyXG5cdFx0XHRwYXlsb2FkLmFwcGVuZCggJ3N0YXR1cycsICdwcmV2aWV3JyApO1xyXG5cdFx0XHRwYXlsb2FkLmFwcGVuZCggJ3JldHVybl9wcmV2aWV3X3VybCcsICcxJyApO1xyXG5cclxuXHRcdFx0cGF5bG9hZC5hcHBlbmQoICdlbmdpbmUnLCAoIGNmZy5lbmdpbmUgfHwgJ2JmYicgKSApO1xyXG5cdFx0XHRwYXlsb2FkLmFwcGVuZCggJ2VuZ2luZV92ZXJzaW9uJywgKCBjZmcuZW5naW5lX3ZlcnNpb24gfHwgJzEuMCcgKSApO1xyXG5cclxuXHRcdFx0cGF5bG9hZC5hcHBlbmQoICdzdHJ1Y3R1cmUnLCBKU09OLnN0cmluZ2lmeSggc3RydWN0dXJlICkgKTtcclxuXHJcblx0XHRcdC8vIFNlbmQgcmVhbCBzZXR0aW5ncyAob3B0aW9ucyArIGNvbXBpbGVkIGNzc192YXJzKS5cclxuXHRcdFx0cGF5bG9hZC5hcHBlbmQoICdzZXR0aW5ncycsIEpTT04uc3RyaW5naWZ5KCBmb3JtX3NldHRpbmdzICkgKTtcclxuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0Ly8gQ2hvb3NlIHdoZXJlIGFkdmFuY2VkX2Zvcm0gKyBjb250ZW50X2Zvcm0gYXJlIHRha2VuIGZyb20gKGF1dG98YnVpbGRlcnxhZHZhbmNlZClcclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHR2YXIgcHJldmlld19zb3VyY2UgPSB3cGJjX2JmYl9wcmV2aWV3X19nZXRfc291cmNlKCBjZmcsIHNvdXJjZV9idG4gKTtcclxuXHRcdFx0cGF5bG9hZC5hcHBlbmQoICdwcmV2aWV3X3NvdXJjZScsIHByZXZpZXdfc291cmNlICk7XHJcblxyXG5cdFx0XHR2YXIgYWR2ID0gbnVsbDtcclxuXHJcblx0XHRcdC8vIDEpIFRyeSBBZHZhbmNlZCBNb2RlIHRleHQgKGlmIHNlbGVjdGVkIC8gYXV0bytkaXJ0eSlcclxuXHRcdFx0aWYgKCBwcmV2aWV3X3NvdXJjZSA9PT0gJ2FkdmFuY2VkJyB8fCBwcmV2aWV3X3NvdXJjZSA9PT0gJ2F1dG8nICkge1xyXG5cclxuXHRcdFx0XHRhZHYgPSB3cGJjX2JmYl9wcmV2aWV3X19yZWFkX2FkdmFuY2VkX21vZGVfcGF5bG9hZCggZCwgdyApO1xyXG5cclxuXHRcdFx0XHR2YXIgY2FuX3VzZV9hZHZhbmNlZCA9XHJcblx0XHRcdFx0XHRcdChwcmV2aWV3X3NvdXJjZSA9PT0gJ2FkdmFuY2VkJykgfHxcclxuXHRcdFx0XHRcdFx0KHByZXZpZXdfc291cmNlID09PSAnYXV0bycgJiYgYWR2ICYmIGFkdi5pc19kaXJ0eSk7XHJcblxyXG5cdFx0XHRcdGlmICggY2FuX3VzZV9hZHZhbmNlZCApIHtcclxuXHJcblx0XHRcdFx0XHQvLyBGb3JjZWQgXCJhZHZhbmNlZFwiIGJ1dCBlbXB0eSAtPiBmYWxsYmFjayB0byBidWlsZGVyIGV4cG9ydC5cclxuXHRcdFx0XHRcdGlmICggISB3cGJjX2JmYl9wcmV2aWV3X19oYXNfdGV4dCggYWR2LmFkdmFuY2VkX2Zvcm0gKSAmJiAhIHdwYmNfYmZiX3ByZXZpZXdfX2hhc190ZXh0KCBhZHYuY29udGVudF9mb3JtICkgKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoIHR5cGVvZiB3LndwYmNfYWRtaW5fc2hvd19tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdHcud3BiY19hZG1pbl9zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHQnQWR2YW5jZWQgTW9kZSBpcyBzZWxlY3RlZCwgYnV0IGVkaXRvcnMgYXJlIGVtcHR5LiBVc2luZyBCdWlsZGVyIGV4cG9ydC4nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0NjAwMFxyXG5cdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCB3cGJjX2JmYl9wcmV2aWV3X19oYXNfdGV4dCggYWR2LmFkdmFuY2VkX2Zvcm0gKSApIHtcclxuXHRcdFx0XHRcdFx0XHRwYXlsb2FkLmFwcGVuZCggJ2FkdmFuY2VkX2Zvcm0nLCBhZHYuYWR2YW5jZWRfZm9ybSApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGlmICggd3BiY19iZmJfcHJldmlld19faGFzX3RleHQoIGFkdi5jb250ZW50X2Zvcm0gKSApIHtcclxuXHRcdFx0XHRcdFx0XHRwYXlsb2FkLmFwcGVuZCggJ2NvbnRlbnRfZm9ybScsIGFkdi5jb250ZW50X2Zvcm0gKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIDIpIElmIG5vdCB0YWtlbiBmcm9tIEFkdmFuY2VkIE1vZGUgLT4gZXhwb3J0IGZyb20gQnVpbGRlciBzdHJ1Y3R1cmUgKGN1cnJlbnQgYmVoYXZpb3IpXHJcblx0XHRcdHZhciBhbHJlYWR5X2hhc19hZHYgPVxyXG5cdFx0XHRcdFx0cGF5bG9hZC5oYXMgJiYgKHBheWxvYWQuaGFzKCAnYWR2YW5jZWRfZm9ybScgKSB8fCBwYXlsb2FkLmhhcyggJ2NvbnRlbnRfZm9ybScgKSk7IC8vIHNvbWUgYnJvd3NlcnNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIC8vIHN1cHBvcnRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIC8vIEZvcm1EYXRhLmhhc1xyXG5cclxuXHRcdFx0Ly8gRmFsbGJhY2sgZm9yIG9sZCBicm93c2VycyAobm8gRm9ybURhdGEuaGFzKVxyXG5cdFx0XHRpZiAoIHR5cGVvZiBwYXlsb2FkLmhhcyAhPT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRhbHJlYWR5X2hhc19hZHYgPSBmYWxzZTsgLy8ganVzdCB0cnkgZXhwb3J0ZXIgaWYgbmVlZGVkXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggISBhbHJlYWR5X2hhc19hZHYgKSB7XHJcblxyXG5cdFx0XHRcdGlmICggdy5XUEJDX0JGQl9FeHBvcnRlciAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9FeHBvcnRlci5leHBvcnRfYWxsID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHJcblx0XHRcdFx0XHRcdHZhciB3aWR0aF9jb21iaW5lZCA9IGZvcm1fc2V0dGluZ3Mub3B0aW9ucy5ib29raW5nX2Zvcm1fbGF5b3V0X3dpZHRoIHx8ICcnO1xyXG5cdFx0XHRcdFx0XHR2YXIgcGFyc2VkX3dpZHRoICAgPSB0aGlzLnBhcnNlX2xlbmd0aF92YWx1ZSggd2lkdGhfY29tYmluZWQgKTtcclxuXHRcdFx0XHRcdFx0dmFyIHdpZHRoX3VuaXQgICAgID0gcGFyc2VkX3dpZHRoLnVuaXQgPyBwYXJzZWRfd2lkdGgudW5pdCA6ICclJztcclxuXHJcblx0XHRcdFx0XHRcdHZhciBleHBvcnRfb3B0aW9ucyA9IHtcclxuXHRcdFx0XHRcdFx0XHRnYXBQZXJjZW50ICAgICAgOiAzLFxyXG5cdFx0XHRcdFx0XHRcdGZvcm1fc2x1ZyAgICAgICA6IChjZmcuZm9ybV9uYW1lIHx8ICdzdGFuZGFyZCcpLFxyXG5cdFx0XHRcdFx0XHRcdGZvcm1fd2lkdGhfdmFsdWU6IHBhcnNlZF93aWR0aC5udW0sXHJcblx0XHRcdFx0XHRcdFx0Zm9ybV93aWR0aF91bml0IDogd2lkdGhfdW5pdFxyXG5cdFx0XHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGV4cG9ydF9yZXN1bHQgPSB3LldQQkNfQkZCX0V4cG9ydGVyLmV4cG9ydF9hbGwoIHN0cnVjdHVyZSB8fCBbXSwgZXhwb3J0X29wdGlvbnMgKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggZXhwb3J0X3Jlc3VsdCApIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIGV4cG9ydF9yZXN1bHQuYWR2YW5jZWRfZm9ybSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHBheWxvYWQuYXBwZW5kKCAnYWR2YW5jZWRfZm9ybScsIGV4cG9ydF9yZXN1bHQuYWR2YW5jZWRfZm9ybSApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRpZiAoIGV4cG9ydF9yZXN1bHQuZmllbGRzX2RhdGEgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHRwYXlsb2FkLmFwcGVuZCggJ2NvbnRlbnRfZm9ybScsIGV4cG9ydF9yZXN1bHQuZmllbGRzX2RhdGEgKTtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkMgQkZCOiBleHBvcnRfYWxsIGVycm9yJywgZSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdC8vIFVzZSBzaGFyZWQgaGVscGVyIGlmIGF2YWlsYWJsZTsgZmFsbGJhY2sgdG8gYWpheHVybC5cclxuXHRcdFx0dmFyIGFqYXhfdXJsID0gJyc7XHJcblx0XHRcdGlmICggdHlwZW9mIHcud3BiY19iZmJfX2dldF9hamF4X3VybCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRhamF4X3VybCA9IHcud3BiY19iZmJfX2dldF9hamF4X3VybCgpO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCB0eXBlb2Ygdy5hamF4dXJsICE9PSAndW5kZWZpbmVkJyAmJiB3LmFqYXh1cmwgKSB7XHJcblx0XHRcdFx0YWpheF91cmwgPSB3LmFqYXh1cmw7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBzZWxmID0gdGhpcztcclxuXHRcdFx0dmFyIHByZXZpZXdfY2FsZW5kYXJfc2tpbl91cmwgPSB0aGlzLmdldF9zZWxlY3RlZF9jYWxlbmRhcl9za2luX3VybCgpO1xyXG5cclxuXHRcdFx0ZnVuY3Rpb24gZW5kX2J1c3lfbm93KCkge1xyXG5cdFx0XHRcdHNlbGYuX2VuZF9idXN5KCAkc291cmNlX2J0biApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoICEgYWpheF91cmwgKSB7XHJcblx0XHRcdFx0ZGV2LmVycm9yKCAnd3BiY19iZmJfcHJldmlld19jbGllbnQnLCAnYWpheCBVUkwgaXMgbm90IGRlZmluZWQnICk7XHJcblx0XHRcdFx0ZW5kX2J1c3lfbm93KCk7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR3LmZldGNoKCBhamF4X3VybCwge1xyXG5cdFx0XHRcdG1ldGhvZDogJ1BPU1QnLFxyXG5cdFx0XHRcdGJvZHk6ICAgcGF5bG9hZFxyXG5cdFx0XHR9IClcclxuXHRcdFx0LnRoZW4oIGZ1bmN0aW9uIChyZXNwb25zZSkge1xyXG5cdFx0XHRcdHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcblx0XHRcdH0gKVxyXG5cdFx0XHQudGhlbiggZnVuY3Rpb24gKGRhdGEpIHtcclxuXHRcdFx0XHRpZiAoICEgZGF0YSB8fCAhIGRhdGEuc3VjY2VzcyB8fCAhIGRhdGEuZGF0YSB8fCAhIGRhdGEuZGF0YS5wcmV2aWV3X3VybCApIHtcclxuXHRcdFx0XHRcdGRldi5lcnJvciggJ3dwYmNfYmZiX3ByZXZpZXdfY2xpZW50JywgJ1ByZXZpZXcgQUpBWCBlcnJvcicsIGRhdGEgKTtcclxuXHRcdFx0XHRcdGVuZF9idXN5X25vdygpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIHNlbGYuaWZyYW1lICkge1xyXG5cdFx0XHRcdFx0ZGV2LmVycm9yKCAnd3BiY19iZmJfcHJldmlld19jbGllbnQnLCAnTWlzc2luZyBpZnJhbWUgZWxlbWVudCcgKTtcclxuXHRcdFx0XHRcdGVuZF9idXN5X25vdygpO1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gV2FpdCB1bnRpbCBpZnJhbWUgaGFzIHJlYWxseSBsb2FkZWQgdGhlIHByZXZpZXcgVVJMLlxyXG5cdFx0XHRcdHZhciBvbl9sb2FkID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0c2VsZi5pZnJhbWUucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2xvYWQnLCBvbl9sb2FkICk7XHJcblx0XHRcdFx0XHRzZWxmLmFwcGx5X2NhbGVuZGFyX3NraW5fdG9faWZyYW1lKCBwcmV2aWV3X2NhbGVuZGFyX3NraW5fdXJsLCBlbmRfYnVzeV9ub3cgKTtcclxuXHRcdFx0XHR9O1xyXG5cclxuXHRcdFx0XHRzZWxmLmlmcmFtZS5hZGRFdmVudExpc3RlbmVyKCAnbG9hZCcsIG9uX2xvYWQgKTtcclxuXHRcdFx0XHRzZWxmLmlmcmFtZS5zZXRBdHRyaWJ1dGUoICdzcmMnLCBkYXRhLmRhdGEucHJldmlld191cmwgKTtcclxuXHRcdFx0fSApXHJcblx0XHRcdC5jYXRjaCggZnVuY3Rpb24gKGVycikge1xyXG5cdFx0XHRcdGRldi5lcnJvciggJ3dwYmNfYmZiX3ByZXZpZXdfY2xpZW50JywgJ1ByZXZpZXcgQUpBWCBmYWlsZWQnLCBlcnIgKTtcclxuXHRcdFx0XHRlbmRfYnVzeV9ub3coKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSW50ZXJuYWwgaGVscGVyOiBzdG9wIGJ1c3kgc3RhdGUgb24gcGFuZWwgYnV0dG9uICsgb3B0aW9uYWwgdG9wIHRvb2xiYXIgYnV0dG9uLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7alF1ZXJ5fG51bGx9ICRzb3VyY2VfYnRuXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICovXHJcblx0XHRfZW5kX2J1c3koJHNvdXJjZV9idG4pIHtcclxuXHRcdFx0dGhpcy5pc19idXN5ID0gZmFsc2U7XHJcblx0XHRcdHRoaXMuc2V0X2J1dHRvbl9idXN5KCBmYWxzZSApO1xyXG5cdFx0XHR0aGlzLnNldF9sb2FkZXJfdmlzaWJsZSggZmFsc2UgKTsgLy8gTkVXXHJcblxyXG5cdFx0XHRpZiAoICRzb3VyY2VfYnRuICYmIHR5cGVvZiB3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0dy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkc291cmNlX2J0biApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGb3JjZS1yZXNldCBhbnkgYnVzeSBzdGF0ZXMgcmVsYXRlZCB0byBwcmV2aWV3LlxyXG5cdFx0ICogVGhpcyBpcyBjYWxsZWQgd2hlbiBzd2l0Y2hpbmcgYmFjayB0byBCdWlsZGVyIG1vZGUgKHNvZnQtY2FuY2VsIFVYKS5cclxuXHRcdCAqL1xyXG5cdFx0cmVzZXRfYnVzeV9zdGF0ZSgpIHtcclxuXHRcdFx0dGhpcy5pc19idXN5ID0gZmFsc2U7XHJcblx0XHRcdHRoaXMuc2V0X2J1dHRvbl9idXN5KCBmYWxzZSApOyAvLyBwYW5lbCBidXR0b24sIGlmIGFueVxyXG5cdFx0XHR0aGlzLnNldF9sb2FkZXJfdmlzaWJsZSggZmFsc2UgKTsgLy8gTkVXXHJcblxyXG5cdFx0XHRpZiAoIHcualF1ZXJ5ICYmIHR5cGVvZiB3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0Ly8gVG9wIHRvb2xiYXIgYnV0dG9ucyB0aGF0IG1heSBzaG93IFwiTG9hZGluZyBwcmV2aWV3Li4uXCJcclxuXHRcdFx0XHR2YXIgJGJ0bnMgPSB3LmpRdWVyeShcclxuXHRcdFx0XHRcdCdbZGF0YS13cGJjLWJmYi10b3AtcHJldmlldy1idG49XCIxXCJdLCcgK1xyXG5cdFx0XHRcdFx0J1tkYXRhLXdwYmMtYmZiLXRvcC1yZWZyZXNoLWJ0bj1cIjFcIl0nXHJcblx0XHRcdFx0KTtcclxuXHJcblx0XHRcdFx0JGJ0bnMuZWFjaCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0dmFyICRiID0gdy5qUXVlcnkoIHRoaXMgKTtcclxuXHRcdFx0XHRcdGlmICggJGIuaGFzQ2xhc3MoICd3cGJjLWlzLWJ1c3knICkgKSB7XHJcblx0XHRcdFx0XHRcdHcud3BiY19iZmJfX2J1dHRvbl9idXN5X2VuZCggJGIgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNpbXBsZSBidXN5IGluZGljYXRvciBmb3IgdGhlIHBhbmVsIFwiVXBkYXRlIFByZXZpZXdcIiBidXR0b24uXHJcblx0XHQgKiBSZXVzZXMgZ2xvYmFsIFdQQkMgYnVzeSBoZWxwZXJzIGlmIGF2YWlsYWJsZSwgc28gdGhlIHNwaW5uZXIgbWF0Y2hlcyBTYXZlL0xvYWQgYnV0dG9ucy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2J1c3lcclxuXHRcdCAqL1xyXG5cdFx0c2V0X2J1dHRvbl9idXN5KCBpc19idXN5ICkge1xyXG5cdFx0XHRpZiAoICEgdGhpcy5idXR0b24gKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBJZiBqUXVlcnkgKyBnbG9iYWwgaGVscGVycyBleGlzdCwgdXNlIHNhbWUgc3Bpbm5lciBhcyBvdGhlciB0b29sYmFyIGJ1dHRvbnMuXHJcblx0XHRcdGlmICggdy5qUXVlcnkgJiYgdHlwZW9mIHcud3BiY19iZmJfX2J1dHRvbl9idXN5X3N0YXJ0ID09PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB3LndwYmNfYmZiX19idXR0b25fYnVzeV9lbmQgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0dmFyICRidG4gPSB3LmpRdWVyeSggdGhpcy5idXR0b24gKTtcclxuXHJcblx0XHRcdFx0aWYgKCBpc19idXN5ICkge1xyXG5cdFx0XHRcdFx0dy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfc3RhcnQoICRidG4gKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0dy53cGJjX2JmYl9fYnV0dG9uX2J1c3lfZW5kKCAkYnRuICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZhbGxiYWNrOiBzaW1wbGUgZGlzYWJsZWQgc3RhdGUgd2l0aG91dCBzcGlubmVyLlxyXG5cdFx0XHRpZiAoIGlzX2J1c3kgKSB7XHJcblx0XHRcdFx0dGhpcy5idXR0b24uc2V0QXR0cmlidXRlKCAnZGlzYWJsZWQnLCAnZGlzYWJsZWQnICk7XHJcblx0XHRcdFx0dGhpcy5idXR0b24uY2xhc3NMaXN0LmFkZCggJ3dwYmNfYmZiX19wcmV2aWV3X2J0bl9idXN5JyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRoaXMuYnV0dG9uLnJlbW92ZUF0dHJpYnV0ZSggJ2Rpc2FibGVkJyApO1xyXG5cdFx0XHRcdHRoaXMuYnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fcHJldmlld19idG5fYnVzeScgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU2V0IGN1cnJlbnQgdmlldyBtb2RlOiBcImJ1aWxkZXJcIiBvciBcInByZXZpZXdcIi5cclxuXHRcdCAqIEFwcGxpZXMvcmVtb3ZlcyBDU1MgY2xhc3Mgb24gPGJvZHk+LlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7KCdidWlsZGVyJ3wncHJldmlldycpfSBtb2RlXHJcblx0XHQgKi9cclxuXHRcdHNldF9tb2RlKCBtb2RlICkge1xyXG5cdFx0XHR2YXIgYm9keSA9IGQuYm9keTtcclxuXHRcdFx0aWYgKCAhIGJvZHkgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIG1vZGUgPT09ICdwcmV2aWV3JyApIHtcclxuXHRcdFx0XHRib2R5LmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fbW9kZV9wcmV2aWV3JyApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGJvZHkuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19tb2RlX3ByZXZpZXcnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHQvLyAtLSBIZWxwZXJzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qKlxyXG5cdCAqIElzIFByZXZpZXcgbW9kZSBjdXJyZW50bHkgYWN0aXZlP1xyXG5cdCAqIFdlIHByZWZlciBib2R5IGNsYXNzIChzZXQgYnkgY2xpZW50LnNldF9tb2RlKSwgZmFsbGJhY2sgdG8gYWN0aXZlIHRhYiBpZC5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfcHJldmlld19faXNfcHJldmlld19tb2RlX2FjdGl2ZSgpIHtcclxuXHRcdHZhciBib2R5ID0gZC5ib2R5O1xyXG5cdFx0aWYgKCBib2R5ICYmIGJvZHkuY2xhc3NMaXN0ICYmIGJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKCAnd3BiY19iZmJfX21vZGVfcHJldmlldycgKSApIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gKHdwYmNfYmZiX3ByZXZpZXdfX2dldF9hY3RpdmVfdG9wX3RhYl9pZCgpID09PSAncHJldmlld190YWInKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdoZW4gYSBmb3JtIGlzIGxvYWRlZCB2aWEgQUpBWCB3aGlsZSBQcmV2aWV3IHRhYiBpcyBhY3RpdmUsXHJcblx0ICogcmVmcmVzaCB0aGUgaWZyYW1lIHNvIGl0IHNob3dzIHRoZSBuZXdseSBsb2FkZWQgZm9ybS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7d3BiY19iZmJfcHJldmlld19jbGllbnR9IGNsaWVudFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX3ByZXZpZXdfX2JpbmRfZm9ybV9hamF4X2xvYWRlZF9ldmVudHMoY2xpZW50KSB7XHJcblxyXG5cdFx0aWYgKCAhIGNsaWVudCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFByZXZlbnQgZG91YmxlIGJpbmRpbmcgaWYgdGhpcyBzY3JpcHQgaXMgaW5qZWN0ZWQgdHdpY2UuXHJcblx0XHRpZiAoIHcuX193cGJjX2JmYl9wcmV2aWV3X19mb3JtX2FqYXhfbG9hZGVkX2JvdW5kID09PSAnMScgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHcuX193cGJjX2JmYl9wcmV2aWV3X19mb3JtX2FqYXhfbG9hZGVkX2JvdW5kID0gJzEnO1xyXG5cclxuXHRcdHZhciBkZWJvdW5jZV9pZCA9IG51bGw7XHJcblxyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKFxyXG5cdFx0XHQnd3BiYzpiZmI6Zm9ybTphamF4X2xvYWRlZCcsXHJcblx0XHRcdGZ1bmN0aW9uIChldikge1xyXG5cclxuXHRcdFx0XHQvLyBPbmx5IGRvIGFueXRoaW5nIGlmIFByZXZpZXcgaXMgY3VycmVudGx5IGFjdGl2ZS5cclxuXHRcdFx0XHRpZiAoICEgd3BiY19iZmJfcHJldmlld19faXNfcHJldmlld19tb2RlX2FjdGl2ZSgpICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dmFyIGRldCA9IChldiAmJiBldi5kZXRhaWwpID8gZXYuZGV0YWlsIDoge307XHJcblx0XHRcdFx0dmFyIGZuICA9IGRldC5mb3JtX25hbWUgPyBTdHJpbmcoIGRldC5mb3JtX25hbWUgKSA6ICcnO1xyXG5cclxuXHRcdFx0XHQvLyBCZXN0LWVmZm9ydDoga2VlcCBjZmcuZm9ybV9uYW1lIGluIHN5bmMgZm9yIHBheWxvYWQgYnVpbGRpbmcuXHJcblx0XHRcdFx0aWYgKCBmbiApIHtcclxuXHRcdFx0XHRcdHcuV1BCQ19CRkJfQWpheCAgICAgICAgICAgPSB3LldQQkNfQkZCX0FqYXggfHwge307XHJcblx0XHRcdFx0XHR3LldQQkNfQkZCX0FqYXguZm9ybV9uYW1lID0gZm47XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBEZWJvdW5jZSBtdWx0aXBsZSByYXBpZCBsb2FkcyAob3Igc2Vjb25kYXJ5IGV2ZW50cykuXHJcblx0XHRcdFx0aWYgKCBkZWJvdW5jZV9pZCApIHtcclxuXHRcdFx0XHRcdGNsZWFyVGltZW91dCggZGVib3VuY2VfaWQgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGRlYm91bmNlX2lkID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0ZGVib3VuY2VfaWQgPSBudWxsO1xyXG5cclxuXHRcdFx0XHRcdC8vIFByZXZpZXcgbWlnaHQgaGF2ZSBiZWVuIGxlZnQgd2hpbGUgd2FpdGluZy5cclxuXHRcdFx0XHRcdGlmICggISB3cGJjX2JmYl9wcmV2aWV3X19pc19wcmV2aWV3X21vZGVfYWN0aXZlKCkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBJZiB3ZSBhcmUgYWxyZWFkeSBzZW5kaW5nIHByZXZpZXcsIGRvbid0IHN0YWNrIGFub3RoZXIgcmVxdWVzdC5cclxuXHRcdFx0XHRcdGlmICggY2xpZW50LmlzX2J1c3kgKSB7XHJcblx0XHRcdFx0XHRcdC8vIFRyeSBvbmNlIG1vcmUgc2hvcnRseSAoc2FmZSkuXHJcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpIHtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIHdwYmNfYmZiX3ByZXZpZXdfX2lzX3ByZXZpZXdfbW9kZV9hY3RpdmUoKSAmJiAhIGNsaWVudC5pc19idXN5ICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y2xpZW50LnVwZGF0ZV9wcmV2aWV3KCB7IHNvdXJjZV9idXR0b246IG51bGwgfSApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fSwgMjUwICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBXYWl0IHVudGlsIGJ1aWxkZXIgQVBJIGlzIHByZXNlbnQgKGZvcm0gbG9hZCBjYW4gYmUgYXN5bmMpLlxyXG5cdFx0XHRcdFx0dmFyIHRyaWVzID0gMDtcclxuXHRcdFx0XHRcdChmdW5jdGlvbiB3YWl0X2Zvcl9idWlsZGVyKCkge1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAhIHdwYmNfYmZiX3ByZXZpZXdfX2lzX3ByZXZpZXdfbW9kZV9hY3RpdmUoKSApIHtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdGlmICggdy53cGJjX2JmYiAmJiB0eXBlb2Ygdy53cGJjX2JmYi5nZXRfc3RydWN0dXJlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRcdGNsaWVudC51cGRhdGVfcHJldmlldyggeyBzb3VyY2VfYnV0dG9uOiBudWxsIH0gKTtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdHRyaWVzKys7XHJcblx0XHRcdFx0XHRcdGlmICggdHJpZXMgPCAxNSApIHtcclxuXHRcdFx0XHRcdFx0XHRzZXRUaW1lb3V0KCB3YWl0X2Zvcl9idWlsZGVyLCAyMDAgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fSkoKTtcclxuXHRcdFx0XHR9LCAxODAgKTtcclxuXHJcblx0XHRcdH0sXHJcblx0XHRcdHsgcGFzc2l2ZTogdHJ1ZSB9XHJcblx0XHQpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfcHJldmlld19fZ2V0X3NvdXJjZShjZmcsIGJ0bikge1xyXG5cclxuXHRcdC8vIHByaW9yaXR5OiBidXR0b24gYXR0ciAtPiBnbG9iYWwgY2ZnIC0+IGRlZmF1bHRcclxuXHRcdHZhciB2ID0gJyc7XHJcblx0XHR0cnkge1xyXG5cdFx0XHRpZiAoIGJ0biAmJiBidG4uZ2V0QXR0cmlidXRlICkge1xyXG5cdFx0XHRcdHYgPSBidG4uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1wcmV2aWV3LXNvdXJjZScgKSB8fCBidG4uZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1zYXZlLXNvdXJjZScgKSB8fCAnJztcclxuXHRcdFx0fVxyXG5cdFx0fSBjYXRjaCAoIGUgKSB7fVxyXG5cclxuXHRcdGlmICggISB2ICYmIGNmZyAmJiAoY2ZnLnByZXZpZXdfc291cmNlIHx8IGNmZy5zYXZlX3NvdXJjZSkgKSB7XHJcblx0XHRcdHYgPSBjZmcucHJldmlld19zb3VyY2UgfHwgY2ZnLnNhdmVfc291cmNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHYgPSBTdHJpbmcoIHYgfHwgJ2F1dG8nICkudG9Mb3dlckNhc2UoKTtcclxuXHRcdGlmICggWyAnYnVpbGRlcicsICdhZHZhbmNlZCcsICdhdXRvJyBdLmluZGV4T2YoIHYgKSA9PT0gLTEgKSB7XHJcblx0XHRcdHYgPSAnYnVpbGRlcic7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gdjtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX3ByZXZpZXdfX2hhc190ZXh0KHYpIHtcclxuXHRcdHJldHVybiAhISAodiAmJiBTdHJpbmcoIHYgKS50cmltKCkpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfcHJldmlld19fcmVhZF9hZHZhbmNlZF9tb2RlX3BheWxvYWQoZCwgdykge1xyXG5cclxuXHRcdC8vIGJlc3Q6IEFQSSAoc3luY3MgQ29kZU1pcnJvciAtPiB0ZXh0YXJlYSlcclxuXHRcdGlmICggdy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpICYmIHR5cGVvZiB3LndwYmNfYmZiX2FkdmFuY2VkX2VkaXRvcl9hcGkuZ2V0X3ZhbHVlcyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRyZXR1cm4gdy53cGJjX2JmYl9hZHZhbmNlZF9lZGl0b3JfYXBpLmdldF92YWx1ZXMoKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIGZhbGxiYWNrOiByZWFkIHRleHRhcmVhcyBkaXJlY3RseVxyXG5cdFx0dmFyIHRhX2Zvcm0gICAgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2FkdmFuY2VkX2Zvcm1fZWRpdG9yJyApO1xyXG5cdFx0dmFyIHRhX2NvbnRlbnQgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2NvbnRlbnRfZm9ybV9lZGl0b3InICk7XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0YWR2YW5jZWRfZm9ybTogdGFfZm9ybSA/IFN0cmluZyggdGFfZm9ybS52YWx1ZSB8fCAnJyApIDogJycsXHJcblx0XHRcdGNvbnRlbnRfZm9ybSA6IHRhX2NvbnRlbnQgPyBTdHJpbmcoIHRhX2NvbnRlbnQudmFsdWUgfHwgJycgKSA6ICcnLFxyXG5cdFx0XHRpc19kaXJ0eSAgICAgOiBmYWxzZVxyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIElzIHRoaXMgZWxlbWVudCB0aGUgUHJldmlldyBUQUIgbGluayBpbiB0b3AgdGFicyBuYXY/XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGVsXHJcblx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9wcmV2aWV3X19pc19wcmV2aWV3X3RhYl9saW5rKGVsKSB7XHJcblx0XHRpZiAoICFlbCB8fCAhZWwuZ2V0QXR0cmlidXRlICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHRlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWFjdGlvbicgKSA9PT0gJ3BhbmVsJyAmJlxyXG5cdFx0XHRlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLXRhYicgKSA9PT0gJ3ByZXZpZXdfdGFiJ1xyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIElzIHRoaXMgZWxlbWVudCB0aGUgQnVpbGRlciBUQUIgbGluayBpbiB0b3AgdGFicyBuYXY/XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fG51bGx9IGVsXHJcblx0ICogQHJldHVybiB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9wcmV2aWV3X19pc19idWlsZGVyX3RhYl9saW5rKGVsKSB7XHJcblx0XHRpZiAoICFlbCB8fCAhZWwuZ2V0QXR0cmlidXRlICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHRlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWFjdGlvbicgKSA9PT0gJ3BhbmVsJyAmJlxyXG5cdFx0XHRlbC5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLXRhYicgKSA9PT0gJ2J1aWxkZXJfdGFiJ1xyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFjdGl2YXRlIGEgXCJwYW5lbFwiIHRhYiBhbmQgc2hvdyBpdHMgcGFuZWwgc2VjdGlvbiAoc2NvcGVkKS5cclxuXHQgKlxyXG5cdCAqIFN0cmF0ZWd5OlxyXG5cdCAqIDEpIFRyeSB0byBjbGljayB0aGUgcmVhbCB0b3AtdGFiIGxpbmsgKGJlc3QpLlxyXG5cdCAqIDIpIElmIGxpbmsgZG9lcyBub3QgZXhpc3QgKGUuZy4gUHJldmlldyB0YWIgcmVtb3ZlZCBmcm9tIG5hdiksIGRvIGEgc2NvcGVkIG1hbnVhbCBzd2l0Y2g6XHJcblx0ICogICAgLSB1c2UgbmF2J3MgZGF0YS13cGJjLWJmYi1wYW5lbHMtcm9vdCArIGRhdGEtd3BiYy1iZmItcGFuZWwtY2xhc3NcclxuXHQgKiAgICAtIGhpZGUvc2hvdyBPTkxZIHRob3NlIG91dGVyIHBhbmVsc1xyXG5cdCAqICAgIC0gRE8gTk9UIHRvdWNoIGlubmVyIHBhbmVsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHRhYl9pZFxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfX2FjdGl2YXRlX3BhbmVsX3RhYih0YWJfaWQpIHtcclxuXHJcblx0XHR0YWJfaWQgPSBTdHJpbmcoIHRhYl9pZCB8fCAnJyApLnRyaW0oKTtcclxuXHRcdGlmICggISB0YWJfaWQgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAxKSBCZXN0OiB0cmlnZ2VyIGV4aXN0aW5nIHRvcC10YWJzIHN3aXRjaGluZyBieSBjbGlja2luZyB0aGUgdGFiIGxpbmsgKGlmIGl0IGV4aXN0cykuXHJcblx0XHR2YXIgdGFiX2xpbmsgPSBkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1hY3Rpb249XCJwYW5lbFwiXVtkYXRhLXdwYmMtYmZiLXRhYj1cIicgKyB0YWJfaWQgKyAnXCJdJyApO1xyXG5cdFx0aWYgKCB0YWJfbGluayAmJiB0eXBlb2YgdGFiX2xpbmsuY2xpY2sgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dGFiX2xpbmsuY2xpY2soKTtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fSBjYXRjaCAoIF9lICkge31cclxuXHRcdH1cclxuXHJcblx0XHQvLyAyKSBGYWxsYmFjazogc2NvcGVkIG1hbnVhbCB0b2dnbGUgKG91dGVyIHBhbmVscyBvbmx5KS5cclxuXHRcdHZhciBuYXYgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3RvcF9ob3Jpc29udGFsX25hdicgKTtcclxuXHJcblx0XHQvLyBEZXRlcm1pbmUgb3V0ZXIgcGFuZWxzIHJvb3QuXHJcblx0XHR2YXIgcGFuZWxzX3Jvb3QgICAgICAgICAgPSBkO1xyXG5cdFx0dmFyIHBhbmVsc19yb290X3NlbGVjdG9yID0gJyc7XHJcblxyXG5cdFx0aWYgKCBuYXYgKSB7XHJcblx0XHRcdHBhbmVsc19yb290X3NlbGVjdG9yID0gbmF2LmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItcGFuZWxzLXJvb3QnICkgfHwgJyc7XHJcblx0XHRcdHBhbmVsc19yb290X3NlbGVjdG9yID0gU3RyaW5nKCBwYW5lbHNfcm9vdF9zZWxlY3RvciB8fCAnJyApLnRyaW0oKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBGYWxsYmFjayBpZiBhdHRyaWJ1dGUgbWlzc2luZzogcHJlZmVyICN3cGJjX2JmYl9fdG9wX3BhbmVscyBpZiBwcmVzZW50LlxyXG5cdFx0aWYgKCAhIHBhbmVsc19yb290X3NlbGVjdG9yICkge1xyXG5cdFx0XHRwYW5lbHNfcm9vdF9zZWxlY3RvciA9ICcjd3BiY19iZmJfX3RvcF9wYW5lbHMnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggcGFuZWxzX3Jvb3Rfc2VsZWN0b3IgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dmFyIHJvb3RfZWwgPSBkLnF1ZXJ5U2VsZWN0b3IoIHBhbmVsc19yb290X3NlbGVjdG9yICk7XHJcblx0XHRcdFx0aWYgKCByb290X2VsICkge1xyXG5cdFx0XHRcdFx0cGFuZWxzX3Jvb3QgPSByb290X2VsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIF9lMiApIHt9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRGV0ZXJtaW5lIG91dGVyIGJhc2UgY2xhc3MgKElNUE9SVEFOVDogbXVzdCBiZSB0aGUgT1VURVIgYmFzZSwgbm90IHdwYmNfYmZiX190YWJfc2VjdGlvbikuXHJcblx0XHR2YXIgcGFuZWxfYmFzZV9jbGFzcyA9ICd3cGJjX2JmYl9fdG9wX3RhYl9zZWN0aW9uJztcclxuXHRcdGlmICggbmF2ICkge1xyXG5cdFx0XHR2YXIgZnJvbV9uYXYgPSBuYXYuZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1wYW5lbC1jbGFzcycgKSB8fCAnJztcclxuXHRcdFx0ZnJvbV9uYXYgICAgID0gU3RyaW5nKCBmcm9tX25hdiB8fCAnJyApLnRyaW0oKTtcclxuXHRcdFx0aWYgKCBmcm9tX25hdiApIHtcclxuXHRcdFx0XHRwYW5lbF9iYXNlX2NsYXNzID0gZnJvbV9uYXY7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBVcGRhdGUgYWN0aXZlIHRhYiBvbiBuYXYgKHNvdXJjZSBvZiB0cnV0aCkuXHJcblx0XHRpZiAoIG5hdiApIHtcclxuXHRcdFx0bmF2LnNldEF0dHJpYnV0ZSggJ2RhdGEtYWN0aXZlLXRhYicsIHRhYl9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEhpZGUgT05MWSBvdXRlciBwYW5lbHMgKHNjb3BlZCBieSBiYXNlIGNsYXNzKS5cclxuXHRcdHZhciBzZWxlY3Rvcl9hbGwgPSAnLicgKyBwYW5lbF9iYXNlX2NsYXNzO1xyXG5cdFx0dmFyIHBhbmVsX25vZGVzICA9IHBhbmVsc19yb290LnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yX2FsbCApO1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHBhbmVsX25vZGVzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0XHRwYW5lbF9ub2Rlc1tpXS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFNob3cgcmVxdWVzdGVkIG91dGVyIHBhbmVsLlxyXG5cdFx0dmFyIHNlbGVjdG9yX2FjdGl2ZSA9ICcuJyArIHBhbmVsX2Jhc2VfY2xhc3MgKyAnX18nICsgdGFiX2lkO1xyXG5cdFx0dmFyIGFjdGl2ZV9wYW5lbCAgICA9IHBhbmVsc19yb290LnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yX2FjdGl2ZSApO1xyXG5cclxuXHRcdGlmICggISBhY3RpdmVfcGFuZWwgKSB7XHJcblx0XHRcdC8vIEJhY2t3YXJkLWNvbXBhdGlibGUgZmFsbGJhY2sgKGlmIHNvbWVvbmUgZm9yZ290IHRvIGFkZCBvdXRlciBjbGFzc2VzKS5cclxuXHRcdFx0YWN0aXZlX3BhbmVsID0gcGFuZWxzX3Jvb3QucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9fdGFiX3NlY3Rpb25fXycgKyB0YWJfaWQgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGFjdGl2ZV9wYW5lbCApIHtcclxuXHRcdFx0YWN0aXZlX3BhbmVsLnN0eWxlLmRpc3BsYXkgPSAnJztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBNYXJrIGFjdGl2ZSBpdGVtIGluIG91dGVyIG5hdiBpZiBpdCBleGlzdHMgKFByZXZpZXcgY2FuIGJlIG1pc3NpbmcpLlxyXG5cdFx0aWYgKCBuYXYgKSB7XHJcblx0XHRcdHZhciBpdGVtcyA9IG5hdi5xdWVyeVNlbGVjdG9yQWxsKCAnLndwYmNfdWlfZWxfX2hvcmlzX25hdl9pdGVtJyApO1xyXG5cdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBpdGVtcy5sZW5ndGg7IGorKyApIHtcclxuXHRcdFx0XHRpdGVtc1tqXS5jbGFzc0xpc3QucmVtb3ZlKCAnYWN0aXZlJyApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgYWN0aXZlX2l0ZW0gPSBuYXYucXVlcnlTZWxlY3RvciggJy53cGJjX3VpX2VsX19ob3Jpc19uYXZfaXRlbV9fJyArIHRhYl9pZCApO1xyXG5cdFx0XHRpZiAoIGFjdGl2ZV9pdGVtICkge1xyXG5cdFx0XHRcdGFjdGl2ZV9pdGVtLmNsYXNzTGlzdC5hZGQoICdhY3RpdmUnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBFbWl0IHNhbWUgZXZlbnQgYXMgYmZiLXRvcC10YWJzLmpzIHNvIG90aGVyIG1vZHVsZXMgc3RheSBpbiBzeW5jLlxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0ZC5kaXNwYXRjaEV2ZW50KFxyXG5cdFx0XHRcdG5ldyBDdXN0b21FdmVudCggJ3dwYmM6YmZiOnRvcC10YWInLCB7XHJcblx0XHRcdFx0XHRkZXRhaWw6IHtcclxuXHRcdFx0XHRcdFx0dGFiICAgOiB0YWJfaWQsXHJcblx0XHRcdFx0XHRcdG5hdl9pZDogKG5hdiAmJiBuYXYuaWQpID8gU3RyaW5nKCBuYXYuaWQgKSA6ICcnXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSApXHJcblx0XHRcdCk7XHJcblx0XHR9IGNhdGNoICggX2UzICkge31cclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgY3VycmVudGx5IGFjdGl2ZSB0b3AgdGFiIGlkIGZyb20gdGhlIG5hdiBjb250YWluZXIuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19iZmJfcHJldmlld19fZ2V0X2FjdGl2ZV90b3BfdGFiX2lkKCkge1xyXG5cdFx0dmFyIG5hdiA9IGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fdG9wX2hvcmlzb250YWxfbmF2JyApO1xyXG5cdFx0aWYgKCAhbmF2ICkge1xyXG5cdFx0XHRyZXR1cm4gJyc7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gbmF2LmdldEF0dHJpYnV0ZSggJ2RhdGEtYWN0aXZlLXRhYicgKSB8fCAnJztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFN5bmMgcHJldmlldyBcIm1vZGVcIiB3aXRoIGN1cnJlbnRseSBhY3RpdmUgdG9wIHRhYi5cclxuXHQgKlxyXG5cdCAqIFJ1bGVzOlxyXG5cdCAqIC0gcHJldmlld190YWIgPT4gZW5hYmxlIHByZXZpZXcgbW9kZSAoYnV0dG9ucyBtYWtlIHNlbnNlKVxyXG5cdCAqIC0gYW55IG90aGVyIHRhYiA9PiBkaXNhYmxlIHByZXZpZXcgbW9kZSArIHJlc2V0IGJ1c3kgc3RhdGVzXHJcblx0ICpcclxuXHQgKiBJTVBPUlRBTlQ6XHJcblx0ICogLSBXZSBkbyBOT1QgY2hhbmdlIHRoZSBhY3RpdmUgdG9wIHRhYiBoZXJlIChubyBwYW5lbCBzd2l0Y2hpbmcpLlxyXG5cdCAqICAgV2Ugb25seSBzeW5jIHByZXZpZXcgVUkgbW9kZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0YWJfaWRcclxuXHQgKiBAcGFyYW0ge3dwYmNfYmZiX3ByZXZpZXdfY2xpZW50fSBjbGllbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9wcmV2aWV3X19zeW5jX21vZGVfdG9fdGFiKHRhYl9pZCwgY2xpZW50KSB7XHJcblxyXG5cdFx0dGFiX2lkID0gU3RyaW5nKCB0YWJfaWQgfHwgJycgKTtcclxuXHJcblx0XHRpZiAoICFjbGllbnQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICdwcmV2aWV3X3RhYicgPT09IHRhYl9pZCApIHtcclxuXHRcdFx0Y2xpZW50LnNldF9tb2RlKCAncHJldmlldycgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExlYXZpbmcgcHJldmlldyAtPiBzb2Z0LWNhbmNlbCBidXN5IHN0YXRlIGFuZCBoaWRlIHByZXZpZXctc3BlY2lmaWMgdG9vbGJhci5cclxuXHRcdGlmICggdHlwZW9mIGNsaWVudC5yZXNldF9idXN5X3N0YXRlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRjbGllbnQucmVzZXRfYnVzeV9zdGF0ZSgpO1xyXG5cdFx0fVxyXG5cdFx0Y2xpZW50LnNldF9tb2RlKCAnYnVpbGRlcicgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEJpbmQgdG8gdG9wLXRhYiBzd2l0Y2ggZXZlbnQgZW1pdHRlZCBieSBiZmItdG9wLXRhYnMuanMuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3dwYmNfYmZiX3ByZXZpZXdfY2xpZW50fSBjbGllbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9wcmV2aWV3X19iaW5kX3RvcF90YWJfZXZlbnRzKGNsaWVudCkge1xyXG5cclxuXHRcdC8vIFN5bmMgaW1tZWRpYXRlbHkgKGluIGNhc2UgZXZlbnQgYWxyZWFkeSBmaXJlZCBiZWZvcmUgdGhpcyBzY3JpcHQgaW5pdCkuXHJcblx0XHR3cGJjX2JmYl9wcmV2aWV3X19zeW5jX21vZGVfdG9fdGFiKCB3cGJjX2JmYl9wcmV2aWV3X19nZXRfYWN0aXZlX3RvcF90YWJfaWQoKSwgY2xpZW50ICk7XHJcblxyXG5cdFx0Ly8gUmVhY3QgdG8gZnV0dXJlIHRhYiBjaGFuZ2VzLlxyXG5cdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6dG9wLXRhYicsIGZ1bmN0aW9uIChldikge1xyXG5cdFx0XHR2YXIgZGV0ICAgICA9IChldiAmJiBldi5kZXRhaWwpID8gZXYuZGV0YWlsIDoge307XHJcblx0XHRcdHZhciB0YWJfaWQgID0gZGV0LnRhYiA/IFN0cmluZyggZGV0LnRhYiApIDogJyc7XHJcblx0XHRcdHZhciBuYXZfaWQgID0gZGV0Lm5hdl9pZCA/IFN0cmluZyggZGV0Lm5hdl9pZCApIDogJyc7XHJcblx0XHRcdHZhciBwcmV2X2lkID0gZGV0LnByZXZfdGFiID8gU3RyaW5nKCBkZXQucHJldl90YWIgKSA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gSWYgdXNlciBzd2l0Y2hlZCB0byBwcmV2aWV3X3RhYiBpbiB0aGUgTUFJTiB0b3AgbmF2LFxyXG5cdFx0XHQvLyByZW1lbWJlciB3aGF0IHRhYiB0aGV5IGNhbWUgZnJvbS5cclxuXHRcdFx0aWYgKCBuYXZfaWQgPT09IFRPUF9OQVZfSUQgJiYgdGFiX2lkID09PSAncHJldmlld190YWInICYmIHByZXZfaWQgJiYgcHJldl9pZCAhPT0gJ3ByZXZpZXdfdGFiJyApIHtcclxuXHRcdFx0XHRyZXR1cm5fdGFiX2lkID0gcHJldl9pZDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0d3BiY19iZmJfcHJldmlld19fc3luY19tb2RlX3RvX3RhYiggdGFiX2lkLCBjbGllbnQgKTtcclxuXHRcdH0gKTtcclxuXHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLS0gQmluZCB8IEluaXQgb24gTG9hZCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgVE9QX05BVl9JRCA9ICd3cGJjX2JmYl9fdG9wX2hvcmlzb250YWxfbmF2JztcclxuXHR2YXIgcmV0dXJuX3RhYl9pZCA9ICdidWlsZGVyX3RhYic7XHJcblxyXG5cdGZ1bmN0aW9uIHJlbWVtYmVyX3JldHVybl90YWJfZnJvbV9kb20oKSB7XHJcblx0XHR2YXIgY3VyID0gd3BiY19iZmJfcHJldmlld19fZ2V0X2FjdGl2ZV90b3BfdGFiX2lkKCk7XHJcblx0XHRpZiAoY3VyICYmIGN1ciAhPT0gJ3ByZXZpZXdfdGFiJykge1xyXG5cdFx0XHRyZXR1cm5fdGFiX2lkID0gY3VyO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3JldHVybl90YWJfaWQoKSB7XHJcblx0XHR2YXIgdCA9IFN0cmluZyhyZXR1cm5fdGFiX2lkIHx8ICcnKS50cmltKCk7XHJcblx0XHRpZiAoIXQgfHwgdCA9PT0gJ3ByZXZpZXdfdGFiJykgdCA9ICdidWlsZGVyX3RhYic7XHJcblx0XHRyZXR1cm4gdDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEF1dG8taW5pdCBwcmV2aWV3IGNsaWVudCBvbiBCdWlsZGVyIHBhZ2UgYW5kIHdpcmUgdG9wIHRvb2xiYXIgYnV0dG9ucy5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2JmYl9pbml0X3ByZXZpZXdfY2xpZW50KCkge1xyXG5cdFx0dmFyIHJvb3QgPSBkLnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1wcmV2aWV3LXJvb3Q9XCIxXCJdJyApO1xyXG5cclxuXHRcdGlmICggIXJvb3QgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY2xpZW50ID0gbmV3IHdwYmNfYmZiX3ByZXZpZXdfY2xpZW50KCByb290ICk7XHJcblxyXG5cdFx0aWYgKCAhdy5XUEJDX0JGQl9QcmV2aWV3ICkge1xyXG5cdFx0XHR3LldQQkNfQkZCX1ByZXZpZXcgPSB7XHJcblx0XHRcdFx0Y2xpZW50OiBjbGllbnQsXHJcblxyXG5cdFx0XHRcdHNob3dfcHJldmlldzogZnVuY3Rpb24gKG9wdHMpIHtcclxuXHRcdFx0XHRcdHZhciBvcHQgPSBvcHRzIHx8IHt9O1xyXG5cdFx0XHRcdFx0dmFyIHNyYyA9IG9wdC5zb3VyY2VfYnV0dG9uIHx8IG51bGw7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVtZW1iZXIgd2hlcmUgd2Ugd2VyZSBCRUZPUkUgc3dpdGNoaW5nIHRvIHByZXZpZXcuXHJcblx0XHRcdFx0XHRyZW1lbWJlcl9yZXR1cm5fdGFiX2Zyb21fZG9tKCk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAhIHdwYmNfYmZiX3ByZXZpZXdfX2lzX3ByZXZpZXdfdGFiX2xpbmsoIHNyYyApICkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX2JmYl9fYWN0aXZhdGVfcGFuZWxfdGFiKCAncHJldmlld190YWInICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gRW5hYmxlIHByZXZpZXcgbW9kZSBVSSAoc2hvd3MgcmVmcmVzaC9iYWNrIGJ1dHRvbnMgZXRjKS5cclxuXHRcdFx0XHRcdGNsaWVudC5zZXRfbW9kZSggJ3ByZXZpZXcnICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gSU1QT1JUQU5UOiBBbHdheXMgcmVnZW5lcmF0ZSB3aGVuIHNob3dfcHJldmlldygpIGlzIGNhbGxlZCAoUHJldmlldyB0YWIgY2xpY2sgaW5jbHVkZWQpLlxyXG5cdFx0XHRcdFx0Y2xpZW50LnVwZGF0ZV9wcmV2aWV3KCB7IHNvdXJjZV9idXR0b246IHNyYyB9ICk7XHJcblx0XHRcdFx0fSxcclxuXHJcblxyXG5cdFx0XHRcdHNob3dfYnVpbGRlcjogZnVuY3Rpb24gKG9wdHMpIHtcclxuXHRcdFx0XHRcdHZhciBvcHQgPSBvcHRzIHx8IHt9O1xyXG5cdFx0XHRcdFx0dmFyIHNyYyA9IG9wdC5zb3VyY2VfYnV0dG9uIHx8IG51bGw7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBjbGllbnQgJiYgdHlwZW9mIGNsaWVudC5yZXNldF9idXN5X3N0YXRlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRjbGllbnQucmVzZXRfYnVzeV9zdGF0ZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHZhciBiYWNrX3RvID0gZ2V0X3JldHVybl90YWJfaWQoKTtcclxuXHJcblx0XHRcdFx0XHQvLyBJZiBCYWNrIGJ1dHRvbiBpdHNlbGYgaXMgbm90IGEgcmVhbCB0YWIgbGluayAtPiBqdXN0IGFjdGl2YXRlIHJlbWVtYmVyZWQgdGFiLlxyXG5cdFx0XHRcdFx0Ly8gSWYgYWN0aXZhdGlvbiBmYWlscyAodGFiIHJlbW92ZWQpLCBmYWxsYmFjayB0byBidWlsZGVyX3RhYi5cclxuXHRcdFx0XHRcdGlmICggISB3cGJjX2JmYl9wcmV2aWV3X19pc19idWlsZGVyX3RhYl9saW5rKCBzcmMgKSApIHtcclxuXHRcdFx0XHRcdFx0aWYgKCAhIHdwYmNfYmZiX19hY3RpdmF0ZV9wYW5lbF90YWIoIGJhY2tfdG8gKSApIHtcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2JmYl9fYWN0aXZhdGVfcGFuZWxfdGFiKCAnYnVpbGRlcl90YWInICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRjbGllbnQuc2V0X21vZGUoICdidWlsZGVyJyApO1xyXG5cdFx0XHRcdH0sXHJcblxyXG5cdFx0XHRcdHNob3dfYWR2YW5jZWRfdGFiOiBmdW5jdGlvbiAob3B0cykge1xyXG5cdFx0XHRcdFx0dmFyIG9wdCA9IG9wdHMgfHwge307XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBjbGllbnQgJiYgdHlwZW9mIGNsaWVudC5yZXNldF9idXN5X3N0YXRlID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0XHRjbGllbnQucmVzZXRfYnVzeV9zdGF0ZSgpO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0d3BiY19iZmJfX2FjdGl2YXRlX3BhbmVsX3RhYiggJ2FkdmFuY2VkX3RhYicgKTtcclxuXHRcdFx0XHRcdGNsaWVudC5zZXRfbW9kZSggJ2J1aWxkZXInICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gTGlzdGVuIGZvciB0b3AtdGFiIGNoYW5nZXMgYW5kIHN5bmMgcHJldmlldyBtb2RlIGF1dG9tYXRpY2FsbHkuXHJcblx0XHR3cGJjX2JmYl9wcmV2aWV3X19iaW5kX3RvcF90YWJfZXZlbnRzKCBjbGllbnQgKTtcclxuXHJcblx0XHQvLyBXaGVuIGEgZm9ybSBpcyBsb2FkZWQgdmlhIEFKQVgsIHJlZnJlc2ggcHJldmlldyAob25seSBpZiBwcmV2aWV3IG1vZGUgaXMgYWN0aXZlKS5cclxuXHRcdHdwYmNfYmZiX3ByZXZpZXdfX2JpbmRfZm9ybV9hamF4X2xvYWRlZF9ldmVudHMoIGNsaWVudCApO1xyXG5cclxuXHRcdHdwYmNfYmZiX2JpbmRfdG9wX3Rvb2xiYXJfYnV0dG9ucyggY2xpZW50ICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQmluZCB0b3AgdG9vbGJhciBCdWlsZGVyIC8gUHJldmlldyAvIFJlZnJlc2ggYnV0dG9ucy5cclxuXHQgKiBTdXBwb3J0cyBtdWx0aXBsZSBlbGVtZW50cyBmb3IgZWFjaCBhY3Rpb24gKHRvb2xiYXIgYnV0dG9ucywgdG9wIHRhYnMsIGV0Yy4pXHJcblx0ICogdmlhIGRhdGEtd3BiYy1iZmItdG9wLSotYnRuPVwiMVwiLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYmZiX2JpbmRfdG9wX3Rvb2xiYXJfYnV0dG9ucyhjbGllbnQpIHtcclxuXHJcblx0XHR2YXIgYnRuX3ByZXZpZXdfbGlzdCA9IGQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYmZiLXRvcC1wcmV2aWV3LWJ0bj1cIjFcIl0nICk7XHJcblx0XHR2YXIgYnRuX2J1aWxkZXJfbGlzdCA9IGQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYmZiLXRvcC1idWlsZGVyLWJ0bj1cIjFcIl0nICk7XHJcblx0XHR2YXIgYnRuX3JlZnJlc2hfbGlzdCA9IGQucXVlcnlTZWxlY3RvckFsbCggJ1tkYXRhLXdwYmMtYmZiLXRvcC1yZWZyZXNoLWJ0bj1cIjFcIl0nICk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gZm9yX2VhY2hfbm9kZShsaXN0LCBjYikge1xyXG5cdFx0XHRpZiAoICFsaXN0IHx8ICFsaXN0Lmxlbmd0aCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCggbGlzdCwgZnVuY3Rpb24gKGVsKSB7XHJcblx0XHRcdFx0aWYgKCBlbCAmJiB0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRjYiggZWwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRmb3JfZWFjaF9ub2RlKCBidG5fcHJldmlld19saXN0LCBmdW5jdGlvbiAoYnRuX3ByZXZpZXcpIHtcclxuXHJcblx0XHRcdC8vIFByZXZlbnQgZG91YmxlIGJpbmRpbmcgaWYgdGhpcyBzY3JpcHQgcnVucyB0d2ljZS5cclxuXHRcdFx0aWYgKCBidG5fcHJldmlldy5nZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWJvdW5kJyApID09PSAnMScgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGJ0bl9wcmV2aWV3LnNldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItYm91bmQnLCAnMScgKTtcclxuXHJcblx0XHRcdGJ0bl9wcmV2aWV3LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cclxuXHRcdFx0XHRpZiAoIHcuV1BCQ19CRkJfUHJldmlldyAmJiB0eXBlb2Ygdy5XUEJDX0JGQl9QcmV2aWV3LnNob3dfcHJldmlldyA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHcuV1BCQ19CRkJfUHJldmlldy5zaG93X3ByZXZpZXcoIHtcclxuXHRcdFx0XHRcdFx0c291cmNlX2J1dHRvbjogYnRuX3ByZXZpZXdcclxuXHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH0gKTtcclxuXHJcblx0XHRmb3JfZWFjaF9ub2RlKCBidG5fcmVmcmVzaF9saXN0LCBmdW5jdGlvbiAoYnRuX3JlZnJlc2gpIHtcclxuXHJcblx0XHRcdGlmICggYnRuX3JlZnJlc2guZ2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1ib3VuZCcgKSA9PT0gJzEnICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRidG5fcmVmcmVzaC5zZXRBdHRyaWJ1dGUoICdkYXRhLXdwYmMtYmZiLWJvdW5kJywgJzEnICk7XHJcblxyXG5cdFx0XHRidG5fcmVmcmVzaC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCBmdW5jdGlvbiAoZSkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHJcblx0XHRcdFx0aWYgKCB3LldQQkNfQkZCX1ByZXZpZXcgJiYgdHlwZW9mIHcuV1BCQ19CRkJfUHJldmlldy5zaG93X3ByZXZpZXcgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHR3LldQQkNfQkZCX1ByZXZpZXcuc2hvd19wcmV2aWV3KCB7XHJcblx0XHRcdFx0XHRcdHVwZGF0ZSAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRcdHNvdXJjZV9idXR0b246IGJ0bl9yZWZyZXNoXHJcblx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblxyXG5cdFx0Zm9yX2VhY2hfbm9kZSggYnRuX2J1aWxkZXJfbGlzdCwgZnVuY3Rpb24gKGJ0bl9idWlsZGVyKSB7XHJcblxyXG5cdFx0XHRpZiAoIGJ0bl9idWlsZGVyLmdldEF0dHJpYnV0ZSggJ2RhdGEtd3BiYy1iZmItYm91bmQnICkgPT09ICcxJyApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0YnRuX2J1aWxkZXIuc2V0QXR0cmlidXRlKCAnZGF0YS13cGJjLWJmYi1ib3VuZCcsICcxJyApO1xyXG5cclxuXHRcdFx0YnRuX2J1aWxkZXIuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblxyXG5cdFx0XHRcdGlmICggdy5XUEJDX0JGQl9QcmV2aWV3ICYmIHR5cGVvZiB3LldQQkNfQkZCX1ByZXZpZXcuc2hvd19idWlsZGVyID09PSAnZnVuY3Rpb24nICkge1xyXG5cdFx0XHRcdFx0dy5XUEJDX0JGQl9QcmV2aWV3LnNob3dfYnVpbGRlciggeyBzb3VyY2VfYnV0dG9uOiBidG5fYnVpbGRlciB9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0aWYgKCBkLnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScgfHwgZC5yZWFkeVN0YXRlID09PSAnaW50ZXJhY3RpdmUnICkge1xyXG5cdFx0c2V0VGltZW91dCggd3BiY19iZmJfaW5pdF9wcmV2aWV3X2NsaWVudCwgMCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgd3BiY19iZmJfaW5pdF9wcmV2aWV3X2NsaWVudCApO1xyXG5cdH1cclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWjtBQUNEO0FBQ0E7QUFDQTtBQUNBO0VBQ0MsSUFBSUMs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

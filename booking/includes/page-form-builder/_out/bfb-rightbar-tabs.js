"use strict";

/**
 * Booking Calendar — Rightbar Tabs Controller (JS)
 *
 * Purpose: Handles the main right sidebar tabs (Library / Inspector / Settings) in the Booking Form Builder.
 * - Manages keyboard and mouse navigation for tabs.
 * - Keeps ARIA attributes in sync and shows/hides matching tabpanels.
 * - Supports programmatic switching via the 'wpbc_bfb:show_panel' event and emits 'wpbc_bfb:panel_shown'.
 * - Uses hard-wired selectors for rightbar markup; optionally uses WPBC_BFB_Sanitize for safe selectors.
 *
 * Markup contract:
 * - Tabs:    [role="tab"][aria-controls="<panel_id>"]
 * - Tablist: .wpbc_bfb__rightbar_tabs[role="tablist"]
 * - Panels:  .wpbc_bfb__palette_panel#<panel_id> (with aria-labelledby)
 *
 * @package   Booking Calendar
 * @subpackage Admin\UI
 * @since     11.0.0
 * @version   1.0.0
 * @see       File  ../includes/page-form-builder/_src/bfb-rightbar-tabs.js
 */
(function (w, d) {
  'use strict';

  const Core = w.WPBC_BFB_Core || {};
  const Sanit = Core.WPBC_BFB_Sanitize || null;

  /**
   * Accessible tabs controller for the right-side palettes (Library / Inspector / Settings)
   * of the Booking Form Builder UI. Handles:
   *  - Mouse and keyboard navigation (delegated on the tablist container).
   *  - Showing/hiding associated tabpanels and keeping ARIA in sync.
   *  - Programmatic switching via the `wpbc_bfb:show_panel` CustomEvent (listened on document).
   *
   * If present, {@link WPBC_BFB_Sanitize.esc_attr_value_for_selector} is used to safely
   * select the tab that controls a given panel id.
   *
   * @version 2025-08-26
   */
  class WPBC_BFB_Rightbar_Tabs {
    /**
     * Constructor.
     *
     * @param {Object} [opts]
     * @param {Object} [opts.selectors]
     * @param {string} [opts.selectors.panels='.wpbc_bfb__palette_panel'] CSS selector that matches tabpanels.
     * @param {string} [opts.selectors.tablist='.wpbc_bfb__rightbar_tabs[role="tablist"]'] CSS selector for tablist roots.
     */
    constructor(opts = {}) {
      const def = {
        panels: '.wpbc_bfb__palette_panel',
        tablist: '.wpbc_bfb__rightbar_tabs[role="tablist"]'
      };
      this.selectors = Object.assign({}, def, opts.selectors || {});
      this._on_keydown = this._on_keydown.bind(this);
      this._on_click = this._on_click.bind(this);
      this._on_show_panel_evt = this._on_show_panel_evt.bind(this);
      this._tablists = [];
    }

    /**
     * Attach DOM listeners to each tablist container and perform initial ARIA sync.
     * Keyboard & mouse handlers are scoped to the tablist(s) for easier debugging.
     *
     * @returns {void}
     */
    init() {
      this._tablists = Array.from(d.querySelectorAll(this.selectors.tablist));
      this._tablists.forEach(list => {
        list.addEventListener('keydown', this._on_keydown, true);
        list.addEventListener('click', this._on_click, false);
      });
      // Programmatic switching kept on document for back-compat with existing dispatches.
      d.addEventListener('wpbc_bfb:show_panel', this._on_show_panel_evt);
      this.sync_initial_aria();
    }

    /**
     * Remove listeners attached in {@link init}.
     *
     * @returns {void}
     */
    destroy() {
      this._tablists.forEach(list => {
        list.removeEventListener('keydown', this._on_keydown, true);
        list.removeEventListener('click', this._on_click, false);
      });
      this._tablists = [];
      d.removeEventListener('wpbc_bfb:show_panel', this._on_show_panel_evt);
    }

    /**
     * Show a specific panel and update the selected tab state.
     * - Hides all panels matched by {@link selectors.panels} by setting
     *   `hidden` and `aria-hidden="true"`.
     * - Reveals the target panel by removing `hidden` and setting `aria-hidden="false"`.
     * - If a tab element is provided (or discoverable by aria-controls),
     *   marks that tab `aria-selected="true"` and clears others in its tablist.
     *
     * @param {string} panel_id  The id attribute of the panel (tabpanel) to show.
     * @param {HTMLElement} [tab_el] An explicit tab element to mark selected (optional).
     * @returns {void}
     */
    show_panel(panel_id, tab_el) {
      const panel = d.getElementById(panel_id);
      if (!panel) {
        console.warn('[WPBC] Panel not found:', panel_id);
        return;
      }
      this._hide_all_panels();
      panel.removeAttribute('hidden');
      panel.setAttribute('aria-hidden', 'false');
      const tab = tab_el || this._get_tab_for_panel(panel_id);
      if (!tab) {
        return;
      }
      const tablist = tab.closest('[role="tablist"]') || d.querySelector(this.selectors.tablist);
      if (!tablist) {
        return;
      }
      tablist.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', 'false'));
      tab.setAttribute('aria-selected', 'true');

      // Fire a hook when a panel changes.
      d.dispatchEvent(new CustomEvent('wpbc_bfb:panel_shown', {
        detail: {
          panel_id,
          tab_el: tab
        }
      }));
    }

    /**
     * Ensure a consistent initial ARIA state:
     * - If a panel is already visible, mark it and its controlling tab as active.
     * - Otherwise, reveal the first panel and mark its tab selected.
     *
     * @returns {void}
     */
    sync_initial_aria() {
      const visible = d.querySelector(`${this.selectors.panels}:not([hidden])`);
      if (visible) {
        visible.setAttribute('aria-hidden', 'false');
        const labelled_by = visible.getAttribute('aria-labelledby');
        const tab = labelled_by ? d.getElementById(labelled_by) : this._get_tab_for_panel(visible.id);
        if (tab) {
          const tablist = tab.closest('[role="tablist"]') || d.querySelector(this.selectors.tablist);
          if (tablist) {
            tablist.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', 'false'));
          }
          tab.setAttribute('aria-selected', 'true');
        }
        return;
      }
      const first = d.querySelector(this.selectors.panels);
      if (first) {
        first.removeAttribute('hidden');
        first.setAttribute('aria-hidden', 'false');
        const labelled_by = first.getAttribute('aria-labelledby');
        const tab = labelled_by ? d.getElementById(labelled_by) : this._get_tab_for_panel(first.id);
        if (tab) {
          const tablist = tab.closest('[role="tablist"]') || d.querySelector(this.selectors.tablist);
          if (tablist) tablist.querySelectorAll('[role="tab"]').forEach(t => t.setAttribute('aria-selected', 'false'));
          tab.setAttribute('aria-selected', 'true');
        }
      }
    }

    // ---- private helpers ----

    /**
     * Get all tabpanel elements matched by {@link selectors.panels}.
     *
     * @private
     * @returns {HTMLElement[]} Array of panels.
     */
    _panels() {
      return Array.from(d.querySelectorAll(this.selectors.panels));
    }

    /**
     * Hide every panel (set `hidden` and `aria-hidden="true"`).
     *
     * @private
     * @returns {void}
     */
    _hide_all_panels() {
      this._panels().forEach(p => {
        p.setAttribute('hidden', 'true');
        p.setAttribute('aria-hidden', 'true');
      });
    }

    /**
     * Find the tab element that controls the given panel id by matching
     * `[role="tab"][aria-controls="<panel_id>"]`. If the sanitize helper is available,
     * it is used to escape the id for a safe CSS attribute selector.
     *
     * @private
     * @param {string} panel_id
     * @returns {HTMLElement|null} The matching tab element, or null if not found.
     */
    _get_tab_for_panel(panel_id) {
      const esc = val => {
        if (Sanit && typeof Sanit.esc_attr_value_for_selector === 'function') {
          return Sanit.esc_attr_value_for_selector(val);
        }
        return String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ').replace(/\]/g, '\\]');
      };
      return d.querySelector(`[role="tab"][aria-controls="${esc(panel_id)}"]`);
    }

    /**
     * Keyboard interaction for tabs (delegated on tablist element):
     * ArrowRight/ArrowDown -> focus next tab
     * ArrowLeft/ArrowUp   -> focus previous tab
     * Home/End            -> focus first/last tab
     * Enter/Space         -> activate focused tab
     *
     * @private
     * @param {KeyboardEvent} e
     * @returns {void}
     */
    _on_keydown(e) {
      const tab = e.target && e.target.closest && e.target.closest('[role="tab"]');
      if (!tab) return;
      const list = tab.closest('[role="tablist"]');
      if (!list) {
        return;
      }
      const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
      const idx = tabs.indexOf(tab);
      const focus = i => {
        if (tabs[i]) tabs[i].focus();
      };
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          focus((idx + 1) % tabs.length);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          focus((idx - 1 + tabs.length) % tabs.length);
          break;
        case 'Home':
          e.preventDefault();
          focus(0);
          break;
        case 'End':
          e.preventDefault();
          focus(tabs.length - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.show_panel(tab.getAttribute('aria-controls'), tab);
          break;
      }
    }

    /**
     * Mouse interaction for tabs (delegated on tablist element).
     *
     * @private
     * @param {MouseEvent} e
     * @returns {void}
     */
    _on_click(e) {
      const tab = e.target && e.target.closest && e.target.closest('[role="tab"]');
      if (!tab) {
        return;
      }
      const panel_id = tab.getAttribute('aria-controls');
      if (panel_id) {
        e.preventDefault();
        this.show_panel(panel_id, tab);
      }
    }

    /**
     * Programmatic switching via CustomEvent listened on document:
     *  detail = { panel_id: string, tab_el?: HTMLElement, tab_id?: string, tab_selector?: string }
     *
     * @private
     * @param {CustomEvent} e
     * @returns {void}
     */
    _on_show_panel_evt(e) {
      const detail = e && e.detail || {};
      const panel_id = detail.panel_id;
      const tab_el = detail.tab_el || (detail.tab_id ? d.getElementById(detail.tab_id) : null) || (detail.tab_selector ? d.querySelector(detail.tab_selector) : null);
      if (panel_id) {
        this.show_panel(panel_id, tab_el || undefined);
      }
    }
  }
  function esc_attr_selector_value(value) {
    if (Sanit && typeof Sanit.esc_attr_value_for_selector === 'function') {
      return Sanit.esc_attr_value_for_selector(value);
    }
    return String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ').replace(/\]/g, '\\]');
  }
  function get_url_params() {
    try {
      return new URLSearchParams(w.location.search || '');
    } catch (_e) {
      return null;
    }
  }
  function open_settings_group(group_key) {
    const panel = d.getElementById('wpbc_bfb__inspector_form_settings') || d;
    const group = panel.querySelector('.wpbc_bfb__inspector__group[data-group="' + esc_attr_selector_value(group_key) + '"]');
    if (!group) {
      return false;
    }
    const header = group.querySelector('.group__header');
    const fields = group.querySelector('.group__fields');
    group.classList.add('is-open');
    if (header) {
      header.setAttribute('aria-expanded', 'true');
    }
    if (fields) {
      fields.removeAttribute('hidden');
      fields.setAttribute('aria-hidden', 'false');
    }
    return true;
  }
  function focus_settings_row(row_key) {
    const panel = d.getElementById('wpbc_bfb__inspector_form_settings') || d;
    const row = panel.querySelector('.wpbc-setting[data-key="' + esc_attr_selector_value(row_key) + '"]');
    if (!row) {
      return false;
    }
    try {
      row.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    } catch (_e) {
      row.scrollIntoView(true);
    }
    row.classList.remove('wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse');
    void row.offsetWidth;
    row.classList.add('wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse');
    setTimeout(() => {
      row.classList.remove('wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse');
    }, 2200);
    const control = row.querySelector('[data-wpbc-bfb-fs-key="' + esc_attr_selector_value(row_key) + '"]') || row.querySelector('select,input,textarea,button');
    if (control && typeof control.focus === 'function') {
      setTimeout(() => {
        try {
          control.focus({
            preventScroll: true
          });
        } catch (_e) {
          control.focus();
        }
      }, 250);
    }
    return true;
  }
  let deep_link_done = false;
  let deep_link_ajax_listener_bound = false;
  function has_initial_deep_link() {
    const params = get_url_params();
    return !!(params && 'form_settings' === params.get('wpbc_bfb_panel'));
  }
  function handle_initial_deep_link(tabs, attempt = 0) {
    if (deep_link_done) {
      return;
    }
    const params = get_url_params();
    if (!params || 'form_settings' !== params.get('wpbc_bfb_panel')) {
      return;
    }
    const panel_id = 'wpbc_bfb__inspector_form_settings';
    const tab = d.getElementById('wpbc_tab_form');
    const panel = d.getElementById(panel_id);
    if (!tab || !panel) {
      if (attempt < 25) {
        setTimeout(() => handle_initial_deep_link(tabs, attempt + 1), 80);
      }
      return;
    }
    tabs.show_panel(panel_id, tab);
    const group_key = params.get('wpbc_bfb_group');
    const row_key = params.get('wpbc_bfb_focus');
    const group_ok = group_key ? open_settings_group(group_key) : true;
    const row_ok = row_key ? focus_settings_row(row_key) : true;
    if ((!group_ok || !row_ok) && attempt < 25) {
      setTimeout(() => handle_initial_deep_link(tabs, attempt + 1), 80);
      return;
    }
    deep_link_done = group_ok && row_ok;
  }
  function schedule_initial_deep_link(tabs, delay = 0) {
    if (deep_link_done || !has_initial_deep_link()) {
      return;
    }
    setTimeout(() => handle_initial_deep_link(tabs), delay);
  }
  function bind_initial_deep_link_after_form_load(tabs, attempt = 0) {
    if (!has_initial_deep_link()) {
      return;
    }
    if (!deep_link_ajax_listener_bound) {
      deep_link_ajax_listener_bound = true;
      d.addEventListener('wpbc:bfb:form:ajax_loaded', () => {
        // Legacy/blank forms do not always emit STRUCTURE_LOADED; wait until add_page() and UI defaults settle.
        schedule_initial_deep_link(tabs, 450);
      }, {
        once: true
      });
    }
    if (!w.wpbc_bfb_api || !w.wpbc_bfb_api.ready || typeof w.wpbc_bfb_api.ready.then !== 'function') {
      if (attempt < 25) {
        setTimeout(() => bind_initial_deep_link_after_form_load(tabs, attempt + 1), 80);
      }
      return;
    }
    w.wpbc_bfb_api.ready.then(builder => {
      const events = w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Events || {};
      const event_name = events.STRUCTURE_LOADED || 'wpbc:bfb:structure:loaded';
      if (!builder || !builder.bus || typeof builder.bus.on !== 'function') {
        return;
      }
      const on_structure_loaded = () => {
        if (builder.bus && typeof builder.bus.off === 'function') {
          builder.bus.off(event_name, on_structure_loaded);
        }
        // Run after selection clearing/inspector defaults attached to the same load event.
        schedule_initial_deep_link(tabs, 0);
      };
      builder.bus.on(event_name, on_structure_loaded);
    });
  }

  // Boot once DOM is ready.
  const instance = new WPBC_BFB_Rightbar_Tabs();
  const boot = () => {
    instance.init();
    bind_initial_deep_link_after_form_load(instance);
  };
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // (Optional) expose for debugging:
  // w.WPBC_BFB_Rightbar_Tabs = instance;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItcmlnaHRiYXItdGFicy5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJTYW5pdCIsIldQQkNfQkZCX1Nhbml0aXplIiwiV1BCQ19CRkJfUmlnaHRiYXJfVGFicyIsImNvbnN0cnVjdG9yIiwib3B0cyIsImRlZiIsInBhbmVscyIsInRhYmxpc3QiLCJzZWxlY3RvcnMiLCJPYmplY3QiLCJhc3NpZ24iLCJfb25fa2V5ZG93biIsImJpbmQiLCJfb25fY2xpY2siLCJfb25fc2hvd19wYW5lbF9ldnQiLCJfdGFibGlzdHMiLCJpbml0IiwiQXJyYXkiLCJmcm9tIiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJsaXN0IiwiYWRkRXZlbnRMaXN0ZW5lciIsInN5bmNfaW5pdGlhbF9hcmlhIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJzaG93X3BhbmVsIiwicGFuZWxfaWQiLCJ0YWJfZWwiLCJwYW5lbCIsImdldEVsZW1lbnRCeUlkIiwiY29uc29sZSIsIndhcm4iLCJfaGlkZV9hbGxfcGFuZWxzIiwicmVtb3ZlQXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwidGFiIiwiX2dldF90YWJfZm9yX3BhbmVsIiwiY2xvc2VzdCIsInF1ZXJ5U2VsZWN0b3IiLCJ0IiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwidmlzaWJsZSIsImxhYmVsbGVkX2J5IiwiZ2V0QXR0cmlidXRlIiwiaWQiLCJmaXJzdCIsIl9wYW5lbHMiLCJwIiwiZXNjIiwidmFsIiwiZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yIiwiU3RyaW5nIiwicmVwbGFjZSIsImUiLCJ0YXJnZXQiLCJ0YWJzIiwiaWR4IiwiaW5kZXhPZiIsImZvY3VzIiwiaSIsImtleSIsInByZXZlbnREZWZhdWx0IiwibGVuZ3RoIiwidGFiX2lkIiwidGFiX3NlbGVjdG9yIiwidW5kZWZpbmVkIiwiZXNjX2F0dHJfc2VsZWN0b3JfdmFsdWUiLCJ2YWx1ZSIsImdldF91cmxfcGFyYW1zIiwiVVJMU2VhcmNoUGFyYW1zIiwibG9jYXRpb24iLCJzZWFyY2giLCJfZSIsIm9wZW5fc2V0dGluZ3NfZ3JvdXAiLCJncm91cF9rZXkiLCJncm91cCIsImhlYWRlciIsImZpZWxkcyIsImNsYXNzTGlzdCIsImFkZCIsImZvY3VzX3NldHRpbmdzX3JvdyIsInJvd19rZXkiLCJyb3ciLCJzY3JvbGxJbnRvVmlldyIsImJlaGF2aW9yIiwiYmxvY2siLCJpbmxpbmUiLCJyZW1vdmUiLCJvZmZzZXRXaWR0aCIsInNldFRpbWVvdXQiLCJjb250cm9sIiwicHJldmVudFNjcm9sbCIsImRlZXBfbGlua19kb25lIiwiZGVlcF9saW5rX2FqYXhfbGlzdGVuZXJfYm91bmQiLCJoYXNfaW5pdGlhbF9kZWVwX2xpbmsiLCJwYXJhbXMiLCJnZXQiLCJoYW5kbGVfaW5pdGlhbF9kZWVwX2xpbmsiLCJhdHRlbXB0IiwiZ3JvdXBfb2siLCJyb3dfb2siLCJzY2hlZHVsZV9pbml0aWFsX2RlZXBfbGluayIsImRlbGF5IiwiYmluZF9pbml0aWFsX2RlZXBfbGlua19hZnRlcl9mb3JtX2xvYWQiLCJvbmNlIiwid3BiY19iZmJfYXBpIiwicmVhZHkiLCJ0aGVuIiwiYnVpbGRlciIsImV2ZW50cyIsIldQQkNfQkZCX0V2ZW50cyIsImV2ZW50X25hbWUiLCJTVFJVQ1RVUkVfTE9BREVEIiwiYnVzIiwib24iLCJvbl9zdHJ1Y3R1cmVfbG9hZGVkIiwib2ZmIiwiaW5zdGFuY2UiLCJib290IiwicmVhZHlTdGF0ZSIsIndpbmRvdyIsImRvY3VtZW50Il0sInNvdXJjZXMiOlsiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX3NyYy9iZmItcmlnaHRiYXItdGFicy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQm9va2luZyBDYWxlbmRhciDigJQgUmlnaHRiYXIgVGFicyBDb250cm9sbGVyIChKUylcclxuICpcclxuICogUHVycG9zZTogSGFuZGxlcyB0aGUgbWFpbiByaWdodCBzaWRlYmFyIHRhYnMgKExpYnJhcnkgLyBJbnNwZWN0b3IgLyBTZXR0aW5ncykgaW4gdGhlIEJvb2tpbmcgRm9ybSBCdWlsZGVyLlxyXG4gKiAtIE1hbmFnZXMga2V5Ym9hcmQgYW5kIG1vdXNlIG5hdmlnYXRpb24gZm9yIHRhYnMuXHJcbiAqIC0gS2VlcHMgQVJJQSBhdHRyaWJ1dGVzIGluIHN5bmMgYW5kIHNob3dzL2hpZGVzIG1hdGNoaW5nIHRhYnBhbmVscy5cclxuICogLSBTdXBwb3J0cyBwcm9ncmFtbWF0aWMgc3dpdGNoaW5nIHZpYSB0aGUgJ3dwYmNfYmZiOnNob3dfcGFuZWwnIGV2ZW50IGFuZCBlbWl0cyAnd3BiY19iZmI6cGFuZWxfc2hvd24nLlxyXG4gKiAtIFVzZXMgaGFyZC13aXJlZCBzZWxlY3RvcnMgZm9yIHJpZ2h0YmFyIG1hcmt1cDsgb3B0aW9uYWxseSB1c2VzIFdQQkNfQkZCX1Nhbml0aXplIGZvciBzYWZlIHNlbGVjdG9ycy5cclxuICpcclxuICogTWFya3VwIGNvbnRyYWN0OlxyXG4gKiAtIFRhYnM6ICAgIFtyb2xlPVwidGFiXCJdW2FyaWEtY29udHJvbHM9XCI8cGFuZWxfaWQ+XCJdXHJcbiAqIC0gVGFibGlzdDogLndwYmNfYmZiX19yaWdodGJhcl90YWJzW3JvbGU9XCJ0YWJsaXN0XCJdXHJcbiAqIC0gUGFuZWxzOiAgLndwYmNfYmZiX19wYWxldHRlX3BhbmVsIzxwYW5lbF9pZD4gKHdpdGggYXJpYS1sYWJlbGxlZGJ5KVxyXG4gKlxyXG4gKiBAcGFja2FnZSAgIEJvb2tpbmcgQ2FsZW5kYXJcclxuICogQHN1YnBhY2thZ2UgQWRtaW5cXFVJXHJcbiAqIEBzaW5jZSAgICAgMTEuMC4wXHJcbiAqIEB2ZXJzaW9uICAgMS4wLjBcclxuICogQHNlZSAgICAgICBGaWxlICAuLi9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2JmYi1yaWdodGJhci10YWJzLmpzXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdGNvbnN0IENvcmUgID0gdy5XUEJDX0JGQl9Db3JlIHx8IHt9O1xyXG5cdGNvbnN0IFNhbml0ID0gQ29yZS5XUEJDX0JGQl9TYW5pdGl6ZSB8fCBudWxsO1xyXG5cclxuXHQvKipcclxuXHQgKiBBY2Nlc3NpYmxlIHRhYnMgY29udHJvbGxlciBmb3IgdGhlIHJpZ2h0LXNpZGUgcGFsZXR0ZXMgKExpYnJhcnkgLyBJbnNwZWN0b3IgLyBTZXR0aW5ncylcclxuXHQgKiBvZiB0aGUgQm9va2luZyBGb3JtIEJ1aWxkZXIgVUkuIEhhbmRsZXM6XHJcblx0ICogIC0gTW91c2UgYW5kIGtleWJvYXJkIG5hdmlnYXRpb24gKGRlbGVnYXRlZCBvbiB0aGUgdGFibGlzdCBjb250YWluZXIpLlxyXG5cdCAqICAtIFNob3dpbmcvaGlkaW5nIGFzc29jaWF0ZWQgdGFicGFuZWxzIGFuZCBrZWVwaW5nIEFSSUEgaW4gc3luYy5cclxuXHQgKiAgLSBQcm9ncmFtbWF0aWMgc3dpdGNoaW5nIHZpYSB0aGUgYHdwYmNfYmZiOnNob3dfcGFuZWxgIEN1c3RvbUV2ZW50IChsaXN0ZW5lZCBvbiBkb2N1bWVudCkuXHJcblx0ICpcclxuXHQgKiBJZiBwcmVzZW50LCB7QGxpbmsgV1BCQ19CRkJfU2FuaXRpemUuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yfSBpcyB1c2VkIHRvIHNhZmVseVxyXG5cdCAqIHNlbGVjdCB0aGUgdGFiIHRoYXQgY29udHJvbHMgYSBnaXZlbiBwYW5lbCBpZC5cclxuXHQgKlxyXG5cdCAqIEB2ZXJzaW9uIDIwMjUtMDgtMjZcclxuXHQgKi9cclxuXHRjbGFzcyBXUEJDX0JGQl9SaWdodGJhcl9UYWJzIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENvbnN0cnVjdG9yLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0c11cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0cy5zZWxlY3RvcnNdXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gW29wdHMuc2VsZWN0b3JzLnBhbmVscz0nLndwYmNfYmZiX19wYWxldHRlX3BhbmVsJ10gQ1NTIHNlbGVjdG9yIHRoYXQgbWF0Y2hlcyB0YWJwYW5lbHMuXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gW29wdHMuc2VsZWN0b3JzLnRhYmxpc3Q9Jy53cGJjX2JmYl9fcmlnaHRiYXJfdGFic1tyb2xlPVwidGFibGlzdFwiXSddIENTUyBzZWxlY3RvciBmb3IgdGFibGlzdCByb290cy5cclxuXHRcdCAqL1xyXG5cdFx0Y29uc3RydWN0b3Iob3B0cyA9IHt9KSB7XHJcblx0XHRcdGNvbnN0IGRlZiAgICAgICAgICAgICAgID0ge1xyXG5cdFx0XHRcdHBhbmVscyA6ICcud3BiY19iZmJfX3BhbGV0dGVfcGFuZWwnLFxyXG5cdFx0XHRcdHRhYmxpc3Q6ICcud3BiY19iZmJfX3JpZ2h0YmFyX3RhYnNbcm9sZT1cInRhYmxpc3RcIl0nXHJcblx0XHRcdH07XHJcblx0XHRcdHRoaXMuc2VsZWN0b3JzICAgICAgICAgID0gT2JqZWN0LmFzc2lnbigge30sIGRlZiwgb3B0cy5zZWxlY3RvcnMgfHwge30gKTtcclxuXHRcdFx0dGhpcy5fb25fa2V5ZG93biAgICAgICAgPSB0aGlzLl9vbl9rZXlkb3duLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5fb25fY2xpY2sgICAgICAgICAgPSB0aGlzLl9vbl9jbGljay5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX29uX3Nob3dfcGFuZWxfZXZ0ID0gdGhpcy5fb25fc2hvd19wYW5lbF9ldnQuYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cyAgICAgICAgICA9IFtdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQXR0YWNoIERPTSBsaXN0ZW5lcnMgdG8gZWFjaCB0YWJsaXN0IGNvbnRhaW5lciBhbmQgcGVyZm9ybSBpbml0aWFsIEFSSUEgc3luYy5cclxuXHRcdCAqIEtleWJvYXJkICYgbW91c2UgaGFuZGxlcnMgYXJlIHNjb3BlZCB0byB0aGUgdGFibGlzdChzKSBmb3IgZWFzaWVyIGRlYnVnZ2luZy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0aW5pdCgpIHtcclxuXHRcdFx0dGhpcy5fdGFibGlzdHMgPSBBcnJheS5mcm9tKCBkLnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMuc2VsZWN0b3JzLnRhYmxpc3QgKSApO1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cy5mb3JFYWNoKCAobGlzdCkgPT4ge1xyXG5cdFx0XHRcdGxpc3QuYWRkRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCB0aGlzLl9vbl9rZXlkb3duLCB0cnVlICk7XHJcblx0XHRcdFx0bGlzdC5hZGRFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jbGljaywgZmFsc2UgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHQvLyBQcm9ncmFtbWF0aWMgc3dpdGNoaW5nIGtlcHQgb24gZG9jdW1lbnQgZm9yIGJhY2stY29tcGF0IHdpdGggZXhpc3RpbmcgZGlzcGF0Y2hlcy5cclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiY19iZmI6c2hvd19wYW5lbCcsIHRoaXMuX29uX3Nob3dfcGFuZWxfZXZ0ICk7XHJcblxyXG5cdFx0XHR0aGlzLnN5bmNfaW5pdGlhbF9hcmlhKCk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZW1vdmUgbGlzdGVuZXJzIGF0dGFjaGVkIGluIHtAbGluayBpbml0fS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZGVzdHJveSgpIHtcclxuXHRcdFx0dGhpcy5fdGFibGlzdHMuZm9yRWFjaCggKGxpc3QpID0+IHtcclxuXHRcdFx0XHRsaXN0LnJlbW92ZUV2ZW50TGlzdGVuZXIoICdrZXlkb3duJywgdGhpcy5fb25fa2V5ZG93biwgdHJ1ZSApO1xyXG5cdFx0XHRcdGxpc3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgdGhpcy5fb25fY2xpY2ssIGZhbHNlICk7XHJcblx0XHRcdH0gKTtcclxuXHRcdFx0dGhpcy5fdGFibGlzdHMgPSBbXTtcclxuXHRcdFx0ZC5yZW1vdmVFdmVudExpc3RlbmVyKCAnd3BiY19iZmI6c2hvd19wYW5lbCcsIHRoaXMuX29uX3Nob3dfcGFuZWxfZXZ0ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBTaG93IGEgc3BlY2lmaWMgcGFuZWwgYW5kIHVwZGF0ZSB0aGUgc2VsZWN0ZWQgdGFiIHN0YXRlLlxyXG5cdFx0ICogLSBIaWRlcyBhbGwgcGFuZWxzIG1hdGNoZWQgYnkge0BsaW5rIHNlbGVjdG9ycy5wYW5lbHN9IGJ5IHNldHRpbmdcclxuXHRcdCAqICAgYGhpZGRlbmAgYW5kIGBhcmlhLWhpZGRlbj1cInRydWVcImAuXHJcblx0XHQgKiAtIFJldmVhbHMgdGhlIHRhcmdldCBwYW5lbCBieSByZW1vdmluZyBgaGlkZGVuYCBhbmQgc2V0dGluZyBgYXJpYS1oaWRkZW49XCJmYWxzZVwiYC5cclxuXHRcdCAqIC0gSWYgYSB0YWIgZWxlbWVudCBpcyBwcm92aWRlZCAob3IgZGlzY292ZXJhYmxlIGJ5IGFyaWEtY29udHJvbHMpLFxyXG5cdFx0ICogICBtYXJrcyB0aGF0IHRhYiBgYXJpYS1zZWxlY3RlZD1cInRydWVcImAgYW5kIGNsZWFycyBvdGhlcnMgaW4gaXRzIHRhYmxpc3QuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHBhbmVsX2lkICBUaGUgaWQgYXR0cmlidXRlIG9mIHRoZSBwYW5lbCAodGFicGFuZWwpIHRvIHNob3cuXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBbdGFiX2VsXSBBbiBleHBsaWNpdCB0YWIgZWxlbWVudCB0byBtYXJrIHNlbGVjdGVkIChvcHRpb25hbCkuXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c2hvd19wYW5lbChwYW5lbF9pZCwgdGFiX2VsKSB7XHJcblx0XHRcdGNvbnN0IHBhbmVsID0gZC5nZXRFbGVtZW50QnlJZCggcGFuZWxfaWQgKTtcclxuXHRcdFx0aWYgKCAhIHBhbmVsICkge1xyXG5cdFx0XHRcdGNvbnNvbGUud2FybiggJ1tXUEJDXSBQYW5lbCBub3QgZm91bmQ6JywgcGFuZWxfaWQgKTtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRoaXMuX2hpZGVfYWxsX3BhbmVscygpO1xyXG5cdFx0XHRwYW5lbC5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdHBhbmVsLnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xyXG5cclxuXHRcdFx0Y29uc3QgdGFiID0gdGFiX2VsIHx8IHRoaXMuX2dldF90YWJfZm9yX3BhbmVsKCBwYW5lbF9pZCApO1xyXG5cdFx0XHRpZiAoICEgdGFiICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Y29uc3QgdGFibGlzdCA9IHRhYi5jbG9zZXN0KCAnW3JvbGU9XCJ0YWJsaXN0XCJdJyApIHx8IGQucXVlcnlTZWxlY3RvciggdGhpcy5zZWxlY3RvcnMudGFibGlzdCApO1xyXG5cdFx0XHRpZiAoICEgdGFibGlzdCApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRhYmxpc3QucXVlcnlTZWxlY3RvckFsbCggJ1tyb2xlPVwidGFiXCJdJyApLmZvckVhY2goICh0KSA9PiB0LnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICkgKTtcclxuXHRcdFx0dGFiLnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZScgKTtcclxuXHJcblx0XHRcdC8vIEZpcmUgYSBob29rIHdoZW4gYSBwYW5lbCBjaGFuZ2VzLlxyXG5cdFx0XHRkLmRpc3BhdGNoRXZlbnQoIG5ldyBDdXN0b21FdmVudCggJ3dwYmNfYmZiOnBhbmVsX3Nob3duJywgeyBkZXRhaWw6IHsgcGFuZWxfaWQsIHRhYl9lbDogdGFiIH0gfSApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbnN1cmUgYSBjb25zaXN0ZW50IGluaXRpYWwgQVJJQSBzdGF0ZTpcclxuXHRcdCAqIC0gSWYgYSBwYW5lbCBpcyBhbHJlYWR5IHZpc2libGUsIG1hcmsgaXQgYW5kIGl0cyBjb250cm9sbGluZyB0YWIgYXMgYWN0aXZlLlxyXG5cdFx0ICogLSBPdGhlcndpc2UsIHJldmVhbCB0aGUgZmlyc3QgcGFuZWwgYW5kIG1hcmsgaXRzIHRhYiBzZWxlY3RlZC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0c3luY19pbml0aWFsX2FyaWEoKSB7XHJcblx0XHRcdGNvbnN0IHZpc2libGUgPSBkLnF1ZXJ5U2VsZWN0b3IoIGAke3RoaXMuc2VsZWN0b3JzLnBhbmVsc306bm90KFtoaWRkZW5dKWAgKTtcclxuXHRcdFx0aWYgKCB2aXNpYmxlICkge1xyXG5cdFx0XHRcdHZpc2libGUuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0XHRcdFx0Y29uc3QgbGFiZWxsZWRfYnkgPSB2aXNpYmxlLmdldEF0dHJpYnV0ZSggJ2FyaWEtbGFiZWxsZWRieScgKTtcclxuXHRcdFx0XHRjb25zdCB0YWIgICAgICAgICA9IGxhYmVsbGVkX2J5ID8gZC5nZXRFbGVtZW50QnlJZCggbGFiZWxsZWRfYnkgKSA6IHRoaXMuX2dldF90YWJfZm9yX3BhbmVsKCB2aXNpYmxlLmlkICk7XHJcblx0XHRcdFx0aWYgKCB0YWIgKSB7XHJcblx0XHRcdFx0XHRjb25zdCB0YWJsaXN0ID0gdGFiLmNsb3Nlc3QoICdbcm9sZT1cInRhYmxpc3RcIl0nICkgfHwgZC5xdWVyeVNlbGVjdG9yKCB0aGlzLnNlbGVjdG9ycy50YWJsaXN0ICk7XHJcblx0XHRcdFx0XHRpZiAoIHRhYmxpc3QgKSB7XHJcblx0XHRcdFx0XHRcdHRhYmxpc3QucXVlcnlTZWxlY3RvckFsbCggJ1tyb2xlPVwidGFiXCJdJyApLmZvckVhY2goICh0KSA9PiB0LnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICkgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHRhYi5zZXRBdHRyaWJ1dGUoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBmaXJzdCA9IGQucXVlcnlTZWxlY3RvciggdGhpcy5zZWxlY3RvcnMucGFuZWxzICk7XHJcblx0XHRcdGlmICggZmlyc3QgKSB7XHJcblx0XHRcdFx0Zmlyc3QucmVtb3ZlQXR0cmlidXRlKCAnaGlkZGVuJyApO1xyXG5cdFx0XHRcdGZpcnN0LnNldEF0dHJpYnV0ZSggJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyApO1xyXG5cdFx0XHRcdGNvbnN0IGxhYmVsbGVkX2J5ID0gZmlyc3QuZ2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbGxlZGJ5JyApO1xyXG5cdFx0XHRcdGNvbnN0IHRhYiAgICAgICAgID0gbGFiZWxsZWRfYnkgPyBkLmdldEVsZW1lbnRCeUlkKCBsYWJlbGxlZF9ieSApIDogdGhpcy5fZ2V0X3RhYl9mb3JfcGFuZWwoIGZpcnN0LmlkICk7XHJcblx0XHRcdFx0aWYgKCB0YWIgKSB7XHJcblx0XHRcdFx0XHRjb25zdCB0YWJsaXN0ID0gdGFiLmNsb3Nlc3QoICdbcm9sZT1cInRhYmxpc3RcIl0nICkgfHwgZC5xdWVyeVNlbGVjdG9yKCB0aGlzLnNlbGVjdG9ycy50YWJsaXN0ICk7XHJcblx0XHRcdFx0XHRpZiAoIHRhYmxpc3QgKSB0YWJsaXN0LnF1ZXJ5U2VsZWN0b3JBbGwoICdbcm9sZT1cInRhYlwiXScgKS5mb3JFYWNoKCAodCkgPT4gdC5zZXRBdHRyaWJ1dGUoICdhcmlhLXNlbGVjdGVkJywgJ2ZhbHNlJyApICk7XHJcblx0XHRcdFx0XHR0YWIuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0gcHJpdmF0ZSBoZWxwZXJzIC0tLS1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBhbGwgdGFicGFuZWwgZWxlbWVudHMgbWF0Y2hlZCBieSB7QGxpbmsgc2VsZWN0b3JzLnBhbmVsc30uXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudFtdfSBBcnJheSBvZiBwYW5lbHMuXHJcblx0XHQgKi9cclxuXHRcdF9wYW5lbHMoKSB7XHJcblx0XHRcdHJldHVybiBBcnJheS5mcm9tKCBkLnF1ZXJ5U2VsZWN0b3JBbGwoIHRoaXMuc2VsZWN0b3JzLnBhbmVscyApICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBIaWRlIGV2ZXJ5IHBhbmVsIChzZXQgYGhpZGRlbmAgYW5kIGBhcmlhLWhpZGRlbj1cInRydWVcImApLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X2hpZGVfYWxsX3BhbmVscygpIHtcclxuXHRcdFx0dGhpcy5fcGFuZWxzKCkuZm9yRWFjaCggKHApID0+IHtcclxuXHRcdFx0XHRwLnNldEF0dHJpYnV0ZSggJ2hpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0XHRcdHAuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogRmluZCB0aGUgdGFiIGVsZW1lbnQgdGhhdCBjb250cm9scyB0aGUgZ2l2ZW4gcGFuZWwgaWQgYnkgbWF0Y2hpbmdcclxuXHRcdCAqIGBbcm9sZT1cInRhYlwiXVthcmlhLWNvbnRyb2xzPVwiPHBhbmVsX2lkPlwiXWAuIElmIHRoZSBzYW5pdGl6ZSBoZWxwZXIgaXMgYXZhaWxhYmxlLFxyXG5cdFx0ICogaXQgaXMgdXNlZCB0byBlc2NhcGUgdGhlIGlkIGZvciBhIHNhZmUgQ1NTIGF0dHJpYnV0ZSBzZWxlY3Rvci5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IHBhbmVsX2lkXHJcblx0XHQgKiBAcmV0dXJucyB7SFRNTEVsZW1lbnR8bnVsbH0gVGhlIG1hdGNoaW5nIHRhYiBlbGVtZW50LCBvciBudWxsIGlmIG5vdCBmb3VuZC5cclxuXHRcdCAqL1xyXG5cdFx0X2dldF90YWJfZm9yX3BhbmVsKHBhbmVsX2lkKSB7XHJcblx0XHRcdGNvbnN0IGVzYyA9ICh2YWwpID0+IHtcclxuXHRcdFx0XHRpZiAoIFNhbml0ICYmIHR5cGVvZiBTYW5pdC5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gU2FuaXQuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB2YWwgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuIFN0cmluZyggdmFsIClcclxuXHRcdFx0XHRcdC5yZXBsYWNlKCAvXFxcXC9nLCAnXFxcXFxcXFwnIClcclxuXHRcdFx0XHRcdC5yZXBsYWNlKCAvXCIvZywgJ1xcXFxcIicgKVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9cXG4vZywgJ1xcXFxBICcgKVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9cXF0vZywgJ1xcXFxdJyApO1xyXG5cdFx0XHR9O1xyXG5cdFx0XHRyZXR1cm4gZC5xdWVyeVNlbGVjdG9yKCBgW3JvbGU9XCJ0YWJcIl1bYXJpYS1jb250cm9scz1cIiR7ZXNjKCBwYW5lbF9pZCApfVwiXWAgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEtleWJvYXJkIGludGVyYWN0aW9uIGZvciB0YWJzIChkZWxlZ2F0ZWQgb24gdGFibGlzdCBlbGVtZW50KTpcclxuXHRcdCAqIEFycm93UmlnaHQvQXJyb3dEb3duIC0+IGZvY3VzIG5leHQgdGFiXHJcblx0XHQgKiBBcnJvd0xlZnQvQXJyb3dVcCAgIC0+IGZvY3VzIHByZXZpb3VzIHRhYlxyXG5cdFx0ICogSG9tZS9FbmQgICAgICAgICAgICAtPiBmb2N1cyBmaXJzdC9sYXN0IHRhYlxyXG5cdFx0ICogRW50ZXIvU3BhY2UgICAgICAgICAtPiBhY3RpdmF0ZSBmb2N1c2VkIHRhYlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0tleWJvYXJkRXZlbnR9IGVcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfb25fa2V5ZG93bihlKSB7XHJcblx0XHRcdGNvbnN0IHRhYiA9IGUudGFyZ2V0ICYmIGUudGFyZ2V0LmNsb3Nlc3QgJiYgZS50YXJnZXQuY2xvc2VzdCggJ1tyb2xlPVwidGFiXCJdJyApO1xyXG5cdFx0XHRpZiAoICF0YWIgKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBsaXN0ID0gdGFiLmNsb3Nlc3QoICdbcm9sZT1cInRhYmxpc3RcIl0nICk7XHJcblx0XHRcdGlmICggISBsaXN0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCB0YWJzICA9IEFycmF5LmZyb20oIGxpc3QucXVlcnlTZWxlY3RvckFsbCggJ1tyb2xlPVwidGFiXCJdJyApICk7XHJcblx0XHRcdGNvbnN0IGlkeCAgID0gdGFicy5pbmRleE9mKCB0YWIgKTtcclxuXHRcdFx0Y29uc3QgZm9jdXMgPSAoaSkgPT4ge1xyXG5cdFx0XHRcdGlmICggdGFic1tpXSApIHRhYnNbaV0uZm9jdXMoKTtcclxuXHRcdFx0fTtcclxuXHJcblx0XHRcdHN3aXRjaCAoIGUua2V5ICkge1xyXG5cdFx0XHRcdGNhc2UgJ0Fycm93UmlnaHQnOlxyXG5cdFx0XHRcdGNhc2UgJ0Fycm93RG93bic6XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRmb2N1cyggKGlkeCArIDEpICUgdGFicy5sZW5ndGggKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2UgJ0Fycm93TGVmdCc6XHJcblx0XHRcdFx0Y2FzZSAnQXJyb3dVcCc6XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRmb2N1cyggKGlkeCAtIDEgKyB0YWJzLmxlbmd0aCkgJSB0YWJzLmxlbmd0aCApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnSG9tZSc6XHJcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0XHRmb2N1cyggMCApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnRW5kJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGZvY3VzKCB0YWJzLmxlbmd0aCAtIDEgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGNhc2UgJ0VudGVyJzpcclxuXHRcdFx0XHRjYXNlICcgJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdHRoaXMuc2hvd19wYW5lbCggdGFiLmdldEF0dHJpYnV0ZSggJ2FyaWEtY29udHJvbHMnICksIHRhYiApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1vdXNlIGludGVyYWN0aW9uIGZvciB0YWJzIChkZWxlZ2F0ZWQgb24gdGFibGlzdCBlbGVtZW50KS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtNb3VzZUV2ZW50fSBlXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X29uX2NsaWNrKGUpIHtcclxuXHRcdFx0Y29uc3QgdGFiID0gZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCAmJiBlLnRhcmdldC5jbG9zZXN0KCAnW3JvbGU9XCJ0YWJcIl0nICk7XHJcblx0XHRcdGlmICggIXRhYiApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdFx0Y29uc3QgcGFuZWxfaWQgPSB0YWIuZ2V0QXR0cmlidXRlKCAnYXJpYS1jb250cm9scycgKTtcclxuXHRcdFx0aWYgKCBwYW5lbF9pZCApIHtcclxuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XHJcblx0XHRcdFx0dGhpcy5zaG93X3BhbmVsKCBwYW5lbF9pZCwgdGFiICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFByb2dyYW1tYXRpYyBzd2l0Y2hpbmcgdmlhIEN1c3RvbUV2ZW50IGxpc3RlbmVkIG9uIGRvY3VtZW50OlxyXG5cdFx0ICogIGRldGFpbCA9IHsgcGFuZWxfaWQ6IHN0cmluZywgdGFiX2VsPzogSFRNTEVsZW1lbnQsIHRhYl9pZD86IHN0cmluZywgdGFiX3NlbGVjdG9yPzogc3RyaW5nIH1cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHBhcmFtIHtDdXN0b21FdmVudH0gZVxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9vbl9zaG93X3BhbmVsX2V2dChlKSB7XHJcblx0XHRcdGNvbnN0IGRldGFpbCAgID0gKGUgJiYgZS5kZXRhaWwpIHx8IHt9O1xyXG5cdFx0XHRjb25zdCBwYW5lbF9pZCA9IGRldGFpbC5wYW5lbF9pZDtcclxuXHRcdFx0Y29uc3QgdGFiX2VsICAgPSBkZXRhaWwudGFiX2VsXHJcblx0XHRcdFx0fHwgKGRldGFpbC50YWJfaWQgPyBkLmdldEVsZW1lbnRCeUlkKCBkZXRhaWwudGFiX2lkICkgOiBudWxsKVxyXG5cdFx0XHRcdHx8IChkZXRhaWwudGFiX3NlbGVjdG9yID8gZC5xdWVyeVNlbGVjdG9yKCBkZXRhaWwudGFiX3NlbGVjdG9yICkgOiBudWxsKTtcclxuXHJcblx0XHRcdGlmICggcGFuZWxfaWQgKSB7XHJcblx0XHRcdFx0dGhpcy5zaG93X3BhbmVsKCBwYW5lbF9pZCwgdGFiX2VsIHx8IHVuZGVmaW5lZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxuXG5cdGZ1bmN0aW9uIGVzY19hdHRyX3NlbGVjdG9yX3ZhbHVlKHZhbHVlKSB7XG5cdFx0aWYgKCBTYW5pdCAmJiB0eXBlb2YgU2FuaXQuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0cmV0dXJuIFNhbml0LmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciggdmFsdWUgKTtcblx0XHR9XG5cdFx0cmV0dXJuIFN0cmluZyggdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUgKVxuXHRcdFx0LnJlcGxhY2UoIC9cXFxcL2csICdcXFxcXFxcXCcgKVxuXHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApXG5cdFx0XHQucmVwbGFjZSggL1xcbi9nLCAnXFxcXEEgJyApXG5cdFx0XHQucmVwbGFjZSggL1xcXS9nLCAnXFxcXF0nICk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRfdXJsX3BhcmFtcygpIHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIG5ldyBVUkxTZWFyY2hQYXJhbXMoIHcubG9jYXRpb24uc2VhcmNoIHx8ICcnICk7XG5cdFx0fSBjYXRjaCAoIF9lICkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gb3Blbl9zZXR0aW5nc19ncm91cChncm91cF9rZXkpIHtcblx0XHRjb25zdCBwYW5lbCA9IGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9faW5zcGVjdG9yX2Zvcm1fc2V0dGluZ3MnICkgfHwgZDtcblx0XHRjb25zdCBncm91cCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiY19iZmJfX2luc3BlY3Rvcl9fZ3JvdXBbZGF0YS1ncm91cD1cIicgKyBlc2NfYXR0cl9zZWxlY3Rvcl92YWx1ZSggZ3JvdXBfa2V5ICkgKyAnXCJdJyApO1xuXHRcdGlmICggISBncm91cCApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBoZWFkZXIgPSBncm91cC5xdWVyeVNlbGVjdG9yKCAnLmdyb3VwX19oZWFkZXInICk7XG5cdFx0Y29uc3QgZmllbGRzID0gZ3JvdXAucXVlcnlTZWxlY3RvciggJy5ncm91cF9fZmllbGRzJyApO1xuXG5cdFx0Z3JvdXAuY2xhc3NMaXN0LmFkZCggJ2lzLW9wZW4nICk7XG5cdFx0aWYgKCBoZWFkZXIgKSB7XG5cdFx0XHRoZWFkZXIuc2V0QXR0cmlidXRlKCAnYXJpYS1leHBhbmRlZCcsICd0cnVlJyApO1xuXHRcdH1cblx0XHRpZiAoIGZpZWxkcyApIHtcblx0XHRcdGZpZWxkcy5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XG5cdFx0XHRmaWVsZHMuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRmdW5jdGlvbiBmb2N1c19zZXR0aW5nc19yb3cocm93X2tleSkge1xuXHRcdGNvbnN0IHBhbmVsID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3JfZm9ybV9zZXR0aW5ncycgKSB8fCBkO1xuXHRcdGNvbnN0IHJvdyA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoICcud3BiYy1zZXR0aW5nW2RhdGEta2V5PVwiJyArIGVzY19hdHRyX3NlbGVjdG9yX3ZhbHVlKCByb3dfa2V5ICkgKyAnXCJdJyApO1xuXHRcdGlmICggISByb3cgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJvdy5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnY2VudGVyJywgaW5saW5lOiAnbmVhcmVzdCcgfSApO1xuXHRcdH0gY2F0Y2ggKCBfZSApIHtcblx0XHRcdHJvdy5zY3JvbGxJbnRvVmlldyggdHJ1ZSApO1xuXHRcdH1cblxuXHRcdHJvdy5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY19iZmJfX3Njcm9sbC1wdWxzZScsICd3cGJjX2JmYl9faGlnaGxpZ2h0LXB1bHNlJyApO1xuXHRcdHZvaWQgcm93Lm9mZnNldFdpZHRoO1xuXHRcdHJvdy5jbGFzc0xpc3QuYWRkKCAnd3BiY19iZmJfX3Njcm9sbC1wdWxzZScsICd3cGJjX2JmYl9faGlnaGxpZ2h0LXB1bHNlJyApO1xuXG5cdFx0c2V0VGltZW91dCggKCkgPT4ge1xuXHRcdFx0cm93LmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJywgJ3dwYmNfYmZiX19oaWdobGlnaHQtcHVsc2UnICk7XG5cdFx0fSwgMjIwMCApO1xuXG5cdFx0Y29uc3QgY29udHJvbCA9IHJvdy5xdWVyeVNlbGVjdG9yKCAnW2RhdGEtd3BiYy1iZmItZnMta2V5PVwiJyArIGVzY19hdHRyX3NlbGVjdG9yX3ZhbHVlKCByb3dfa2V5ICkgKyAnXCJdJyApXG5cdFx0XHR8fCByb3cucXVlcnlTZWxlY3RvciggJ3NlbGVjdCxpbnB1dCx0ZXh0YXJlYSxidXR0b24nICk7XG5cblx0XHRpZiAoIGNvbnRyb2wgJiYgdHlwZW9mIGNvbnRyb2wuZm9jdXMgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29udHJvbC5mb2N1cyggeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0gKTtcblx0XHRcdFx0fSBjYXRjaCAoIF9lICkge1xuXHRcdFx0XHRcdGNvbnRyb2wuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMjUwICk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRsZXQgZGVlcF9saW5rX2RvbmUgPSBmYWxzZTtcblx0bGV0IGRlZXBfbGlua19hamF4X2xpc3RlbmVyX2JvdW5kID0gZmFsc2U7XG5cblx0ZnVuY3Rpb24gaGFzX2luaXRpYWxfZGVlcF9saW5rKCkge1xuXHRcdGNvbnN0IHBhcmFtcyA9IGdldF91cmxfcGFyYW1zKCk7XG5cdFx0cmV0dXJuICEhICggcGFyYW1zICYmICdmb3JtX3NldHRpbmdzJyA9PT0gcGFyYW1zLmdldCggJ3dwYmNfYmZiX3BhbmVsJyApICk7XG5cdH1cblxuXHRmdW5jdGlvbiBoYW5kbGVfaW5pdGlhbF9kZWVwX2xpbmsodGFicywgYXR0ZW1wdCA9IDApIHtcblx0XHRpZiAoIGRlZXBfbGlua19kb25lICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhcmFtcyA9IGdldF91cmxfcGFyYW1zKCk7XG5cdFx0aWYgKCAhIHBhcmFtcyB8fCAnZm9ybV9zZXR0aW5ncycgIT09IHBhcmFtcy5nZXQoICd3cGJjX2JmYl9wYW5lbCcgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYW5lbF9pZCA9ICd3cGJjX2JmYl9faW5zcGVjdG9yX2Zvcm1fc2V0dGluZ3MnO1xuXHRcdGNvbnN0IHRhYiA9IGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX3RhYl9mb3JtJyApO1xuXHRcdGNvbnN0IHBhbmVsID0gZC5nZXRFbGVtZW50QnlJZCggcGFuZWxfaWQgKTtcblx0XHRpZiAoICEgdGFiIHx8ICEgcGFuZWwgKSB7XG5cdFx0XHRpZiAoIGF0dGVtcHQgPCAyNSApIHtcblx0XHRcdFx0c2V0VGltZW91dCggKCkgPT4gaGFuZGxlX2luaXRpYWxfZGVlcF9saW5rKCB0YWJzLCBhdHRlbXB0ICsgMSApLCA4MCApO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRhYnMuc2hvd19wYW5lbCggcGFuZWxfaWQsIHRhYiApO1xuXG5cdFx0Y29uc3QgZ3JvdXBfa2V5ID0gcGFyYW1zLmdldCggJ3dwYmNfYmZiX2dyb3VwJyApO1xuXHRcdGNvbnN0IHJvd19rZXkgPSBwYXJhbXMuZ2V0KCAnd3BiY19iZmJfZm9jdXMnICk7XG5cdFx0Y29uc3QgZ3JvdXBfb2sgPSBncm91cF9rZXkgPyBvcGVuX3NldHRpbmdzX2dyb3VwKCBncm91cF9rZXkgKSA6IHRydWU7XG5cdFx0Y29uc3Qgcm93X29rID0gcm93X2tleSA/IGZvY3VzX3NldHRpbmdzX3Jvdyggcm93X2tleSApIDogdHJ1ZTtcblxuXHRcdGlmICggKCAhIGdyb3VwX29rIHx8ICEgcm93X29rICkgJiYgYXR0ZW1wdCA8IDI1ICkge1xuXHRcdFx0c2V0VGltZW91dCggKCkgPT4gaGFuZGxlX2luaXRpYWxfZGVlcF9saW5rKCB0YWJzLCBhdHRlbXB0ICsgMSApLCA4MCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGRlZXBfbGlua19kb25lID0gZ3JvdXBfb2sgJiYgcm93X29rO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2NoZWR1bGVfaW5pdGlhbF9kZWVwX2xpbmsodGFicywgZGVsYXkgPSAwKSB7XG5cdFx0aWYgKCBkZWVwX2xpbmtfZG9uZSB8fCAhIGhhc19pbml0aWFsX2RlZXBfbGluaygpICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHNldFRpbWVvdXQoICgpID0+IGhhbmRsZV9pbml0aWFsX2RlZXBfbGluayggdGFicyApLCBkZWxheSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gYmluZF9pbml0aWFsX2RlZXBfbGlua19hZnRlcl9mb3JtX2xvYWQodGFicywgYXR0ZW1wdCA9IDApIHtcblx0XHRpZiAoICEgaGFzX2luaXRpYWxfZGVlcF9saW5rKCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAhIGRlZXBfbGlua19hamF4X2xpc3RlbmVyX2JvdW5kICkge1xuXHRcdFx0ZGVlcF9saW5rX2FqYXhfbGlzdGVuZXJfYm91bmQgPSB0cnVlO1xuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Zm9ybTphamF4X2xvYWRlZCcsICgpID0+IHtcblx0XHRcdFx0Ly8gTGVnYWN5L2JsYW5rIGZvcm1zIGRvIG5vdCBhbHdheXMgZW1pdCBTVFJVQ1RVUkVfTE9BREVEOyB3YWl0IHVudGlsIGFkZF9wYWdlKCkgYW5kIFVJIGRlZmF1bHRzIHNldHRsZS5cblx0XHRcdFx0c2NoZWR1bGVfaW5pdGlhbF9kZWVwX2xpbmsoIHRhYnMsIDQ1MCApO1xuXHRcdFx0fSwgeyBvbmNlOiB0cnVlIH0gKTtcblx0XHR9XG5cblx0XHRpZiAoICEgdy53cGJjX2JmYl9hcGkgfHwgISB3LndwYmNfYmZiX2FwaS5yZWFkeSB8fCB0eXBlb2Ygdy53cGJjX2JmYl9hcGkucmVhZHkudGhlbiAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdGlmICggYXR0ZW1wdCA8IDI1ICkge1xuXHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiBiaW5kX2luaXRpYWxfZGVlcF9saW5rX2FmdGVyX2Zvcm1fbG9hZCggdGFicywgYXR0ZW1wdCArIDEgKSwgODAgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKCAoYnVpbGRlcikgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnRzID0gKCB3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX0V2ZW50cyApIHx8IHt9O1xuXHRcdFx0Y29uc3QgZXZlbnRfbmFtZSA9IGV2ZW50cy5TVFJVQ1RVUkVfTE9BREVEIHx8ICd3cGJjOmJmYjpzdHJ1Y3R1cmU6bG9hZGVkJztcblx0XHRcdGlmICggISBidWlsZGVyIHx8ICEgYnVpbGRlci5idXMgfHwgdHlwZW9mIGJ1aWxkZXIuYnVzLm9uICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9uX3N0cnVjdHVyZV9sb2FkZWQgPSAoKSA9PiB7XG5cdFx0XHRcdGlmICggYnVpbGRlci5idXMgJiYgdHlwZW9mIGJ1aWxkZXIuYnVzLm9mZiA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRidWlsZGVyLmJ1cy5vZmYoIGV2ZW50X25hbWUsIG9uX3N0cnVjdHVyZV9sb2FkZWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBSdW4gYWZ0ZXIgc2VsZWN0aW9uIGNsZWFyaW5nL2luc3BlY3RvciBkZWZhdWx0cyBhdHRhY2hlZCB0byB0aGUgc2FtZSBsb2FkIGV2ZW50LlxuXHRcdFx0XHRzY2hlZHVsZV9pbml0aWFsX2RlZXBfbGluayggdGFicywgMCApO1xuXHRcdFx0fTtcblxuXHRcdFx0YnVpbGRlci5idXMub24oIGV2ZW50X25hbWUsIG9uX3N0cnVjdHVyZV9sb2FkZWQgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvLyBCb290IG9uY2UgRE9NIGlzIHJlYWR5LlxuXHRjb25zdCBpbnN0YW5jZSA9IG5ldyBXUEJDX0JGQl9SaWdodGJhcl9UYWJzKCk7XG5cdGNvbnN0IGJvb3QgPSAoKSA9PiB7XG5cdFx0aW5zdGFuY2UuaW5pdCgpO1xuXHRcdGJpbmRfaW5pdGlhbF9kZWVwX2xpbmtfYWZ0ZXJfZm9ybV9sb2FkKCBpbnN0YW5jZSApO1xuXHR9O1xuXHRpZiAoIGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnICkge1xuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBib290ICk7XG5cdH0gZWxzZSB7XG5cdFx0Ym9vdCgpO1xuXHR9XG5cclxuXHQvLyAoT3B0aW9uYWwpIGV4cG9zZSBmb3IgZGVidWdnaW5nOlxyXG5cdC8vIHcuV1BCQ19CRkJfUmlnaHRiYXJfVGFicyA9IGluc3RhbmNlO1xyXG5cclxufSkoIHdpbmRvdywgZG9jdW1lbnQgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRUMsQ0FBQyxFQUFFO0VBQ2hCLFlBQVk7O0VBRVosTUFBTUMsSUFBSSxHQUFJRixDQUFDLENBQUNHLGFBQWEsSUFBSSxDQUFDLENBQUM7RUFDbkMsTUFBTUMs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

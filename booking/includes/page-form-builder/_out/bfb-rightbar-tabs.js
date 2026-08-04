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

  /**
   * Open one collapsible Add Fields palette group.
   *
   * The setup-wizard deep link uses this helper to reveal a field pack without
   * inserting or otherwise changing the current booking form.
   *
   * @param {string} group_key Palette group key from its data-group attribute.
   * @returns {boolean} Whether the requested palette group was found and opened.
   */
  function open_palette_group(group_key) {
    const panel = d.getElementById('wpbc_bfb__palette_add_new') || d;
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

  /**
   * Focus and visually highlight one Add Fields palette item.
   *
   * @param {string} field_type Registered Form Builder field type.
   * @returns {boolean} Whether the requested field pack palette item was found.
   */
  function focus_palette_field(field_type) {
    const panel = d.getElementById('wpbc_bfb__palette_add_new') || d;
    const field = panel.querySelector('.wpbc_bfb__field[data-type="' + esc_attr_selector_value(field_type) + '"]');
    if (!field) {
      return false;
    }
    try {
      field.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    } catch (_e) {
      field.scrollIntoView(true);
    }
    field.classList.remove('wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse');
    void field.offsetWidth;
    field.classList.add('wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse');
    field.setAttribute('tabindex', '-1');
    setTimeout(() => {
      field.classList.remove('wpbc_bfb__scroll-pulse', 'wpbc_bfb__highlight-pulse');
    }, 2200);
    setTimeout(() => {
      try {
        field.focus({
          preventScroll: true
        });
      } catch (_e) {
        field.focus();
      }
    }, 250);
    return true;
  }
  let deep_link_done = false;
  let deep_link_ajax_listener_bound = false;
  function has_initial_deep_link() {
    const params = get_url_params();
    return !!(params && -1 !== ['form_settings', 'add_fields'].indexOf(params.get('wpbc_bfb_panel')));
  }
  function handle_initial_deep_link(tabs, attempt = 0) {
    if (deep_link_done) {
      return;
    }
    const params = get_url_params();
    if (!params || -1 === ['form_settings', 'add_fields'].indexOf(params.get('wpbc_bfb_panel'))) {
      return;
    }
    const panel_mode = params.get('wpbc_bfb_panel');
    const panel_id = 'add_fields' === panel_mode ? 'wpbc_bfb__palette_add_new' : 'wpbc_bfb__inspector_form_settings';
    const tab = d.getElementById('add_fields' === panel_mode ? 'wpbc_tab_library' : 'wpbc_tab_form');
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
    const group_ok = group_key ? 'add_fields' === panel_mode ? open_palette_group(group_key) : open_settings_group(group_key) : true;
    const row_ok = row_key ? 'add_fields' === panel_mode ? focus_palette_field(row_key) : focus_settings_row(row_key) : true;
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItcmlnaHRiYXItdGFicy5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJTYW5pdCIsIldQQkNfQkZCX1Nhbml0aXplIiwiV1BCQ19CRkJfUmlnaHRiYXJfVGFicyIsImNvbnN0cnVjdG9yIiwib3B0cyIsImRlZiIsInBhbmVscyIsInRhYmxpc3QiLCJzZWxlY3RvcnMiLCJPYmplY3QiLCJhc3NpZ24iLCJfb25fa2V5ZG93biIsImJpbmQiLCJfb25fY2xpY2siLCJfb25fc2hvd19wYW5lbF9ldnQiLCJfdGFibGlzdHMiLCJpbml0IiwiQXJyYXkiLCJmcm9tIiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJsaXN0IiwiYWRkRXZlbnRMaXN0ZW5lciIsInN5bmNfaW5pdGlhbF9hcmlhIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJzaG93X3BhbmVsIiwicGFuZWxfaWQiLCJ0YWJfZWwiLCJwYW5lbCIsImdldEVsZW1lbnRCeUlkIiwiY29uc29sZSIsIndhcm4iLCJfaGlkZV9hbGxfcGFuZWxzIiwicmVtb3ZlQXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwidGFiIiwiX2dldF90YWJfZm9yX3BhbmVsIiwiY2xvc2VzdCIsInF1ZXJ5U2VsZWN0b3IiLCJ0IiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwidmlzaWJsZSIsImxhYmVsbGVkX2J5IiwiZ2V0QXR0cmlidXRlIiwiaWQiLCJmaXJzdCIsIl9wYW5lbHMiLCJwIiwiZXNjIiwidmFsIiwiZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yIiwiU3RyaW5nIiwicmVwbGFjZSIsImUiLCJ0YXJnZXQiLCJ0YWJzIiwiaWR4IiwiaW5kZXhPZiIsImZvY3VzIiwiaSIsImtleSIsInByZXZlbnREZWZhdWx0IiwibGVuZ3RoIiwidGFiX2lkIiwidGFiX3NlbGVjdG9yIiwidW5kZWZpbmVkIiwiZXNjX2F0dHJfc2VsZWN0b3JfdmFsdWUiLCJ2YWx1ZSIsImdldF91cmxfcGFyYW1zIiwiVVJMU2VhcmNoUGFyYW1zIiwibG9jYXRpb24iLCJzZWFyY2giLCJfZSIsIm9wZW5fc2V0dGluZ3NfZ3JvdXAiLCJncm91cF9rZXkiLCJncm91cCIsImhlYWRlciIsImZpZWxkcyIsImNsYXNzTGlzdCIsImFkZCIsImZvY3VzX3NldHRpbmdzX3JvdyIsInJvd19rZXkiLCJyb3ciLCJzY3JvbGxJbnRvVmlldyIsImJlaGF2aW9yIiwiYmxvY2siLCJpbmxpbmUiLCJyZW1vdmUiLCJvZmZzZXRXaWR0aCIsInNldFRpbWVvdXQiLCJjb250cm9sIiwicHJldmVudFNjcm9sbCIsIm9wZW5fcGFsZXR0ZV9ncm91cCIsImZvY3VzX3BhbGV0dGVfZmllbGQiLCJmaWVsZF90eXBlIiwiZmllbGQiLCJkZWVwX2xpbmtfZG9uZSIsImRlZXBfbGlua19hamF4X2xpc3RlbmVyX2JvdW5kIiwiaGFzX2luaXRpYWxfZGVlcF9saW5rIiwicGFyYW1zIiwiZ2V0IiwiaGFuZGxlX2luaXRpYWxfZGVlcF9saW5rIiwiYXR0ZW1wdCIsInBhbmVsX21vZGUiLCJncm91cF9vayIsInJvd19vayIsInNjaGVkdWxlX2luaXRpYWxfZGVlcF9saW5rIiwiZGVsYXkiLCJiaW5kX2luaXRpYWxfZGVlcF9saW5rX2FmdGVyX2Zvcm1fbG9hZCIsIm9uY2UiLCJ3cGJjX2JmYl9hcGkiLCJyZWFkeSIsInRoZW4iLCJidWlsZGVyIiwiZXZlbnRzIiwiV1BCQ19CRkJfRXZlbnRzIiwiZXZlbnRfbmFtZSIsIlNUUlVDVFVSRV9MT0FERUQiLCJidXMiLCJvbiIsIm9uX3N0cnVjdHVyZV9sb2FkZWQiLCJvZmYiLCJpbnN0YW5jZSIsImJvb3QiLCJyZWFkeVN0YXRlIiwid2luZG93IiwiZG9jdW1lbnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2JmYi1yaWdodGJhci10YWJzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCb29raW5nIENhbGVuZGFyIOKAlCBSaWdodGJhciBUYWJzIENvbnRyb2xsZXIgKEpTKVxyXG4gKlxyXG4gKiBQdXJwb3NlOiBIYW5kbGVzIHRoZSBtYWluIHJpZ2h0IHNpZGViYXIgdGFicyAoTGlicmFyeSAvIEluc3BlY3RvciAvIFNldHRpbmdzKSBpbiB0aGUgQm9va2luZyBGb3JtIEJ1aWxkZXIuXHJcbiAqIC0gTWFuYWdlcyBrZXlib2FyZCBhbmQgbW91c2UgbmF2aWdhdGlvbiBmb3IgdGFicy5cclxuICogLSBLZWVwcyBBUklBIGF0dHJpYnV0ZXMgaW4gc3luYyBhbmQgc2hvd3MvaGlkZXMgbWF0Y2hpbmcgdGFicGFuZWxzLlxyXG4gKiAtIFN1cHBvcnRzIHByb2dyYW1tYXRpYyBzd2l0Y2hpbmcgdmlhIHRoZSAnd3BiY19iZmI6c2hvd19wYW5lbCcgZXZlbnQgYW5kIGVtaXRzICd3cGJjX2JmYjpwYW5lbF9zaG93bicuXHJcbiAqIC0gVXNlcyBoYXJkLXdpcmVkIHNlbGVjdG9ycyBmb3IgcmlnaHRiYXIgbWFya3VwOyBvcHRpb25hbGx5IHVzZXMgV1BCQ19CRkJfU2FuaXRpemUgZm9yIHNhZmUgc2VsZWN0b3JzLlxyXG4gKlxyXG4gKiBNYXJrdXAgY29udHJhY3Q6XHJcbiAqIC0gVGFiczogICAgW3JvbGU9XCJ0YWJcIl1bYXJpYS1jb250cm9scz1cIjxwYW5lbF9pZD5cIl1cclxuICogLSBUYWJsaXN0OiAud3BiY19iZmJfX3JpZ2h0YmFyX3RhYnNbcm9sZT1cInRhYmxpc3RcIl1cclxuICogLSBQYW5lbHM6ICAud3BiY19iZmJfX3BhbGV0dGVfcGFuZWwjPHBhbmVsX2lkPiAod2l0aCBhcmlhLWxhYmVsbGVkYnkpXHJcbiAqXHJcbiAqIEBwYWNrYWdlICAgQm9va2luZyBDYWxlbmRhclxyXG4gKiBAc3VicGFja2FnZSBBZG1pblxcVUlcclxuICogQHNpbmNlICAgICAxMS4wLjBcclxuICogQHZlcnNpb24gICAxLjAuMFxyXG4gKiBAc2VlICAgICAgIEZpbGUgIC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYmZiLXJpZ2h0YmFyLXRhYnMuanNcclxuICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Y29uc3QgQ29yZSAgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0Y29uc3QgU2FuaXQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8IG51bGw7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFjY2Vzc2libGUgdGFicyBjb250cm9sbGVyIGZvciB0aGUgcmlnaHQtc2lkZSBwYWxldHRlcyAoTGlicmFyeSAvIEluc3BlY3RvciAvIFNldHRpbmdzKVxyXG5cdCAqIG9mIHRoZSBCb29raW5nIEZvcm0gQnVpbGRlciBVSS4gSGFuZGxlczpcclxuXHQgKiAgLSBNb3VzZSBhbmQga2V5Ym9hcmQgbmF2aWdhdGlvbiAoZGVsZWdhdGVkIG9uIHRoZSB0YWJsaXN0IGNvbnRhaW5lcikuXHJcblx0ICogIC0gU2hvd2luZy9oaWRpbmcgYXNzb2NpYXRlZCB0YWJwYW5lbHMgYW5kIGtlZXBpbmcgQVJJQSBpbiBzeW5jLlxyXG5cdCAqICAtIFByb2dyYW1tYXRpYyBzd2l0Y2hpbmcgdmlhIHRoZSBgd3BiY19iZmI6c2hvd19wYW5lbGAgQ3VzdG9tRXZlbnQgKGxpc3RlbmVkIG9uIGRvY3VtZW50KS5cclxuXHQgKlxyXG5cdCAqIElmIHByZXNlbnQsIHtAbGluayBXUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3J9IGlzIHVzZWQgdG8gc2FmZWx5XHJcblx0ICogc2VsZWN0IHRoZSB0YWIgdGhhdCBjb250cm9scyBhIGdpdmVuIHBhbmVsIGlkLlxyXG5cdCAqXHJcblx0ICogQHZlcnNpb24gMjAyNS0wOC0yNlxyXG5cdCAqL1xyXG5cdGNsYXNzIFdQQkNfQkZCX1JpZ2h0YmFyX1RhYnMge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29uc3RydWN0b3IuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzXVxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzLnNlbGVjdG9yc11cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0cy5zZWxlY3RvcnMucGFuZWxzPScud3BiY19iZmJfX3BhbGV0dGVfcGFuZWwnXSBDU1Mgc2VsZWN0b3IgdGhhdCBtYXRjaGVzIHRhYnBhbmVscy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0cy5zZWxlY3RvcnMudGFibGlzdD0nLndwYmNfYmZiX19yaWdodGJhcl90YWJzW3JvbGU9XCJ0YWJsaXN0XCJdJ10gQ1NTIHNlbGVjdG9yIGZvciB0YWJsaXN0IHJvb3RzLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3RvcihvcHRzID0ge30pIHtcclxuXHRcdFx0Y29uc3QgZGVmICAgICAgICAgICAgICAgPSB7XHJcblx0XHRcdFx0cGFuZWxzIDogJy53cGJjX2JmYl9fcGFsZXR0ZV9wYW5lbCcsXHJcblx0XHRcdFx0dGFibGlzdDogJy53cGJjX2JmYl9fcmlnaHRiYXJfdGFic1tyb2xlPVwidGFibGlzdFwiXSdcclxuXHRcdFx0fTtcclxuXHRcdFx0dGhpcy5zZWxlY3RvcnMgICAgICAgICAgPSBPYmplY3QuYXNzaWduKCB7fSwgZGVmLCBvcHRzLnNlbGVjdG9ycyB8fCB7fSApO1xyXG5cdFx0XHR0aGlzLl9vbl9rZXlkb3duICAgICAgICA9IHRoaXMuX29uX2tleWRvd24uYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLl9vbl9jbGljayAgICAgICAgICA9IHRoaXMuX29uX2NsaWNrLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5fb25fc2hvd19wYW5lbF9ldnQgPSB0aGlzLl9vbl9zaG93X3BhbmVsX2V2dC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX3RhYmxpc3RzICAgICAgICAgID0gW107XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBdHRhY2ggRE9NIGxpc3RlbmVycyB0byBlYWNoIHRhYmxpc3QgY29udGFpbmVyIGFuZCBwZXJmb3JtIGluaXRpYWwgQVJJQSBzeW5jLlxyXG5cdFx0ICogS2V5Ym9hcmQgJiBtb3VzZSBoYW5kbGVycyBhcmUgc2NvcGVkIHRvIHRoZSB0YWJsaXN0KHMpIGZvciBlYXNpZXIgZGVidWdnaW5nLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cyA9IEFycmF5LmZyb20oIGQucXVlcnlTZWxlY3RvckFsbCggdGhpcy5zZWxlY3RvcnMudGFibGlzdCApICk7XHJcblx0XHRcdHRoaXMuX3RhYmxpc3RzLmZvckVhY2goIChsaXN0KSA9PiB7XHJcblx0XHRcdFx0bGlzdC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleWRvd24sIHRydWUgKTtcclxuXHRcdFx0XHRsaXN0LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHRoaXMuX29uX2NsaWNrLCBmYWxzZSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdC8vIFByb2dyYW1tYXRpYyBzd2l0Y2hpbmcga2VwdCBvbiBkb2N1bWVudCBmb3IgYmFjay1jb21wYXQgd2l0aCBleGlzdGluZyBkaXNwYXRjaGVzLlxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYjpzaG93X3BhbmVsJywgdGhpcy5fb25fc2hvd19wYW5lbF9ldnQgKTtcclxuXHJcblx0XHRcdHRoaXMuc3luY19pbml0aWFsX2FyaWEoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbW92ZSBsaXN0ZW5lcnMgYXR0YWNoZWQgaW4ge0BsaW5rIGluaXR9LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cy5mb3JFYWNoKCAobGlzdCkgPT4ge1xyXG5cdFx0XHRcdGxpc3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCB0aGlzLl9vbl9rZXlkb3duLCB0cnVlICk7XHJcblx0XHRcdFx0bGlzdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jbGljaywgZmFsc2UgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cyA9IFtdO1xyXG5cdFx0XHRkLnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYjpzaG93X3BhbmVsJywgdGhpcy5fb25fc2hvd19wYW5lbF9ldnQgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgYSBzcGVjaWZpYyBwYW5lbCBhbmQgdXBkYXRlIHRoZSBzZWxlY3RlZCB0YWIgc3RhdGUuXHJcblx0XHQgKiAtIEhpZGVzIGFsbCBwYW5lbHMgbWF0Y2hlZCBieSB7QGxpbmsgc2VsZWN0b3JzLnBhbmVsc30gYnkgc2V0dGluZ1xyXG5cdFx0ICogICBgaGlkZGVuYCBhbmQgYGFyaWEtaGlkZGVuPVwidHJ1ZVwiYC5cclxuXHRcdCAqIC0gUmV2ZWFscyB0aGUgdGFyZ2V0IHBhbmVsIGJ5IHJlbW92aW5nIGBoaWRkZW5gIGFuZCBzZXR0aW5nIGBhcmlhLWhpZGRlbj1cImZhbHNlXCJgLlxyXG5cdFx0ICogLSBJZiBhIHRhYiBlbGVtZW50IGlzIHByb3ZpZGVkIChvciBkaXNjb3ZlcmFibGUgYnkgYXJpYS1jb250cm9scyksXHJcblx0XHQgKiAgIG1hcmtzIHRoYXQgdGFiIGBhcmlhLXNlbGVjdGVkPVwidHJ1ZVwiYCBhbmQgY2xlYXJzIG90aGVycyBpbiBpdHMgdGFibGlzdC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcGFuZWxfaWQgIFRoZSBpZCBhdHRyaWJ1dGUgb2YgdGhlIHBhbmVsICh0YWJwYW5lbCkgdG8gc2hvdy5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IFt0YWJfZWxdIEFuIGV4cGxpY2l0IHRhYiBlbGVtZW50IHRvIG1hcmsgc2VsZWN0ZWQgKG9wdGlvbmFsKS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzaG93X3BhbmVsKHBhbmVsX2lkLCB0YWJfZWwpIHtcclxuXHRcdFx0Y29uc3QgcGFuZWwgPSBkLmdldEVsZW1lbnRCeUlkKCBwYW5lbF9pZCApO1xyXG5cdFx0XHRpZiAoICEgcGFuZWwgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnW1dQQkNdIFBhbmVsIG5vdCBmb3VuZDonLCBwYW5lbF9pZCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5faGlkZV9hbGxfcGFuZWxzKCk7XHJcblx0XHRcdHBhbmVsLnJlbW92ZUF0dHJpYnV0ZSggJ2hpZGRlbicgKTtcclxuXHRcdFx0cGFuZWwuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblxyXG5cdFx0XHRjb25zdCB0YWIgPSB0YWJfZWwgfHwgdGhpcy5fZ2V0X3RhYl9mb3JfcGFuZWwoIHBhbmVsX2lkICk7XHJcblx0XHRcdGlmICggISB0YWIgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCB0YWJsaXN0ID0gdGFiLmNsb3Nlc3QoICdbcm9sZT1cInRhYmxpc3RcIl0nICkgfHwgZC5xdWVyeVNlbGVjdG9yKCB0aGlzLnNlbGVjdG9ycy50YWJsaXN0ICk7XHJcblx0XHRcdGlmICggISB0YWJsaXN0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGFibGlzdC5xdWVyeVNlbGVjdG9yQWxsKCAnW3JvbGU9XCJ0YWJcIl0nICkuZm9yRWFjaCggKHQpID0+IHQuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScgKSApO1xyXG5cdFx0XHR0YWIuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZSBhIGhvb2sgd2hlbiBhIHBhbmVsIGNoYW5nZXMuXHJcblx0XHRcdGQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiY19iZmI6cGFuZWxfc2hvd24nLCB7IGRldGFpbDogeyBwYW5lbF9pZCwgdGFiX2VsOiB0YWIgfSB9ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVuc3VyZSBhIGNvbnNpc3RlbnQgaW5pdGlhbCBBUklBIHN0YXRlOlxyXG5cdFx0ICogLSBJZiBhIHBhbmVsIGlzIGFscmVhZHkgdmlzaWJsZSwgbWFyayBpdCBhbmQgaXRzIGNvbnRyb2xsaW5nIHRhYiBhcyBhY3RpdmUuXHJcblx0XHQgKiAtIE90aGVyd2lzZSwgcmV2ZWFsIHRoZSBmaXJzdCBwYW5lbCBhbmQgbWFyayBpdHMgdGFiIHNlbGVjdGVkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzeW5jX2luaXRpYWxfYXJpYSgpIHtcclxuXHRcdFx0Y29uc3QgdmlzaWJsZSA9IGQucXVlcnlTZWxlY3RvciggYCR7dGhpcy5zZWxlY3RvcnMucGFuZWxzfTpub3QoW2hpZGRlbl0pYCApO1xyXG5cdFx0XHRpZiAoIHZpc2libGUgKSB7XHJcblx0XHRcdFx0dmlzaWJsZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcclxuXHRcdFx0XHRjb25zdCBsYWJlbGxlZF9ieSA9IHZpc2libGUuZ2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbGxlZGJ5JyApO1xyXG5cdFx0XHRcdGNvbnN0IHRhYiAgICAgICAgID0gbGFiZWxsZWRfYnkgPyBkLmdldEVsZW1lbnRCeUlkKCBsYWJlbGxlZF9ieSApIDogdGhpcy5fZ2V0X3RhYl9mb3JfcGFuZWwoIHZpc2libGUuaWQgKTtcclxuXHRcdFx0XHRpZiAoIHRhYiApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHRhYmxpc3QgPSB0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKSB8fCBkLnF1ZXJ5U2VsZWN0b3IoIHRoaXMuc2VsZWN0b3JzLnRhYmxpc3QgKTtcclxuXHRcdFx0XHRcdGlmICggdGFibGlzdCApIHtcclxuXHRcdFx0XHRcdFx0dGFibGlzdC5xdWVyeVNlbGVjdG9yQWxsKCAnW3JvbGU9XCJ0YWJcIl0nICkuZm9yRWFjaCggKHQpID0+IHQuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScgKSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dGFiLnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGZpcnN0ID0gZC5xdWVyeVNlbGVjdG9yKCB0aGlzLnNlbGVjdG9ycy5wYW5lbHMgKTtcclxuXHRcdFx0aWYgKCBmaXJzdCApIHtcclxuXHRcdFx0XHRmaXJzdC5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdFx0Zmlyc3Quc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0XHRcdFx0Y29uc3QgbGFiZWxsZWRfYnkgPSBmaXJzdC5nZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsbGVkYnknICk7XHJcblx0XHRcdFx0Y29uc3QgdGFiICAgICAgICAgPSBsYWJlbGxlZF9ieSA/IGQuZ2V0RWxlbWVudEJ5SWQoIGxhYmVsbGVkX2J5ICkgOiB0aGlzLl9nZXRfdGFiX2Zvcl9wYW5lbCggZmlyc3QuaWQgKTtcclxuXHRcdFx0XHRpZiAoIHRhYiApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHRhYmxpc3QgPSB0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKSB8fCBkLnF1ZXJ5U2VsZWN0b3IoIHRoaXMuc2VsZWN0b3JzLnRhYmxpc3QgKTtcclxuXHRcdFx0XHRcdGlmICggdGFibGlzdCApIHRhYmxpc3QucXVlcnlTZWxlY3RvckFsbCggJ1tyb2xlPVwidGFiXCJdJyApLmZvckVhY2goICh0KSA9PiB0LnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICkgKTtcclxuXHRcdFx0XHRcdHRhYi5zZXRBdHRyaWJ1dGUoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLSBwcml2YXRlIGhlbHBlcnMgLS0tLVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGFsbCB0YWJwYW5lbCBlbGVtZW50cyBtYXRjaGVkIGJ5IHtAbGluayBzZWxlY3RvcnMucGFuZWxzfS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50W119IEFycmF5IG9mIHBhbmVscy5cclxuXHRcdCAqL1xyXG5cdFx0X3BhbmVscygpIHtcclxuXHRcdFx0cmV0dXJuIEFycmF5LmZyb20oIGQucXVlcnlTZWxlY3RvckFsbCggdGhpcy5zZWxlY3RvcnMucGFuZWxzICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhpZGUgZXZlcnkgcGFuZWwgKHNldCBgaGlkZGVuYCBhbmQgYGFyaWEtaGlkZGVuPVwidHJ1ZVwiYCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfaGlkZV9hbGxfcGFuZWxzKCkge1xyXG5cdFx0XHR0aGlzLl9wYW5lbHMoKS5mb3JFYWNoKCAocCkgPT4ge1xyXG5cdFx0XHRcdHAuc2V0QXR0cmlidXRlKCAnaGlkZGVuJywgJ3RydWUnICk7XHJcblx0XHRcdFx0cC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGaW5kIHRoZSB0YWIgZWxlbWVudCB0aGF0IGNvbnRyb2xzIHRoZSBnaXZlbiBwYW5lbCBpZCBieSBtYXRjaGluZ1xyXG5cdFx0ICogYFtyb2xlPVwidGFiXCJdW2FyaWEtY29udHJvbHM9XCI8cGFuZWxfaWQ+XCJdYC4gSWYgdGhlIHNhbml0aXplIGhlbHBlciBpcyBhdmFpbGFibGUsXHJcblx0XHQgKiBpdCBpcyB1c2VkIHRvIGVzY2FwZSB0aGUgaWQgZm9yIGEgc2FmZSBDU1MgYXR0cmlidXRlIHNlbGVjdG9yLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcGFuZWxfaWRcclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudHxudWxsfSBUaGUgbWF0Y2hpbmcgdGFiIGVsZW1lbnQsIG9yIG51bGwgaWYgbm90IGZvdW5kLlxyXG5cdFx0ICovXHJcblx0XHRfZ2V0X3RhYl9mb3JfcGFuZWwocGFuZWxfaWQpIHtcclxuXHRcdFx0Y29uc3QgZXNjID0gKHZhbCkgPT4ge1xyXG5cdFx0XHRcdGlmICggU2FuaXQgJiYgdHlwZW9mIFNhbml0LmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHJldHVybiBTYW5pdC5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIHZhbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCB2YWwgKVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9cXFxcL2csICdcXFxcXFxcXCcgKVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApXHJcblx0XHRcdFx0XHQucmVwbGFjZSggL1xcbi9nLCAnXFxcXEEgJyApXHJcblx0XHRcdFx0XHQucmVwbGFjZSggL1xcXS9nLCAnXFxcXF0nICk7XHJcblx0XHRcdH07XHJcblx0XHRcdHJldHVybiBkLnF1ZXJ5U2VsZWN0b3IoIGBbcm9sZT1cInRhYlwiXVthcmlhLWNvbnRyb2xzPVwiJHtlc2MoIHBhbmVsX2lkICl9XCJdYCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogS2V5Ym9hcmQgaW50ZXJhY3Rpb24gZm9yIHRhYnMgKGRlbGVnYXRlZCBvbiB0YWJsaXN0IGVsZW1lbnQpOlxyXG5cdFx0ICogQXJyb3dSaWdodC9BcnJvd0Rvd24gLT4gZm9jdXMgbmV4dCB0YWJcclxuXHRcdCAqIEFycm93TGVmdC9BcnJvd1VwICAgLT4gZm9jdXMgcHJldmlvdXMgdGFiXHJcblx0XHQgKiBIb21lL0VuZCAgICAgICAgICAgIC0+IGZvY3VzIGZpcnN0L2xhc3QgdGFiXHJcblx0XHQgKiBFbnRlci9TcGFjZSAgICAgICAgIC0+IGFjdGl2YXRlIGZvY3VzZWQgdGFiXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZVxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9vbl9rZXlkb3duKGUpIHtcclxuXHRcdFx0Y29uc3QgdGFiID0gZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCAmJiBlLnRhcmdldC5jbG9zZXN0KCAnW3JvbGU9XCJ0YWJcIl0nICk7XHJcblx0XHRcdGlmICggIXRhYiApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGxpc3QgPSB0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHRhYnMgID0gQXJyYXkuZnJvbSggbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCAnW3JvbGU9XCJ0YWJcIl0nICkgKTtcclxuXHRcdFx0Y29uc3QgaWR4ICAgPSB0YWJzLmluZGV4T2YoIHRhYiApO1xyXG5cdFx0XHRjb25zdCBmb2N1cyA9IChpKSA9PiB7XHJcblx0XHRcdFx0aWYgKCB0YWJzW2ldICkgdGFic1tpXS5mb2N1cygpO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0c3dpdGNoICggZS5rZXkgKSB7XHJcblx0XHRcdFx0Y2FzZSAnQXJyb3dSaWdodCc6XHJcblx0XHRcdFx0Y2FzZSAnQXJyb3dEb3duJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGZvY3VzKCAoaWR4ICsgMSkgJSB0YWJzLmxlbmd0aCApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnQXJyb3dMZWZ0JzpcclxuXHRcdFx0XHRjYXNlICdBcnJvd1VwJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGZvY3VzKCAoaWR4IC0gMSArIHRhYnMubGVuZ3RoKSAlIHRhYnMubGVuZ3RoICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlICdIb21lJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGZvY3VzKCAwICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlICdFbmQnOlxyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0Zm9jdXMoIHRhYnMubGVuZ3RoIC0gMSApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnRW50ZXInOlxyXG5cdFx0XHRcdGNhc2UgJyAnOlxyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0dGhpcy5zaG93X3BhbmVsKCB0YWIuZ2V0QXR0cmlidXRlKCAnYXJpYS1jb250cm9scycgKSwgdGFiICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTW91c2UgaW50ZXJhY3Rpb24gZm9yIHRhYnMgKGRlbGVnYXRlZCBvbiB0YWJsaXN0IGVsZW1lbnQpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGVcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfb25fY2xpY2soZSkge1xyXG5cdFx0XHRjb25zdCB0YWIgPSBlLnRhcmdldCAmJiBlLnRhcmdldC5jbG9zZXN0ICYmIGUudGFyZ2V0LmNsb3Nlc3QoICdbcm9sZT1cInRhYlwiXScgKTtcclxuXHRcdFx0aWYgKCAhdGFiICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBwYW5lbF9pZCA9IHRhYi5nZXRBdHRyaWJ1dGUoICdhcmlhLWNvbnRyb2xzJyApO1xyXG5cdFx0XHRpZiAoIHBhbmVsX2lkICkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHR0aGlzLnNob3dfcGFuZWwoIHBhbmVsX2lkLCB0YWIgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUHJvZ3JhbW1hdGljIHN3aXRjaGluZyB2aWEgQ3VzdG9tRXZlbnQgbGlzdGVuZWQgb24gZG9jdW1lbnQ6XHJcblx0XHQgKiAgZGV0YWlsID0geyBwYW5lbF9pZDogc3RyaW5nLCB0YWJfZWw/OiBIVE1MRWxlbWVudCwgdGFiX2lkPzogc3RyaW5nLCB0YWJfc2VsZWN0b3I/OiBzdHJpbmcgfVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBlXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X29uX3Nob3dfcGFuZWxfZXZ0KGUpIHtcclxuXHRcdFx0Y29uc3QgZGV0YWlsICAgPSAoZSAmJiBlLmRldGFpbCkgfHwge307XHJcblx0XHRcdGNvbnN0IHBhbmVsX2lkID0gZGV0YWlsLnBhbmVsX2lkO1xyXG5cdFx0XHRjb25zdCB0YWJfZWwgICA9IGRldGFpbC50YWJfZWxcclxuXHRcdFx0XHR8fCAoZGV0YWlsLnRhYl9pZCA/IGQuZ2V0RWxlbWVudEJ5SWQoIGRldGFpbC50YWJfaWQgKSA6IG51bGwpXHJcblx0XHRcdFx0fHwgKGRldGFpbC50YWJfc2VsZWN0b3IgPyBkLnF1ZXJ5U2VsZWN0b3IoIGRldGFpbC50YWJfc2VsZWN0b3IgKSA6IG51bGwpO1xyXG5cclxuXHRcdFx0aWYgKCBwYW5lbF9pZCApIHtcclxuXHRcdFx0XHR0aGlzLnNob3dfcGFuZWwoIHBhbmVsX2lkLCB0YWJfZWwgfHwgdW5kZWZpbmVkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XG5cblx0ZnVuY3Rpb24gZXNjX2F0dHJfc2VsZWN0b3JfdmFsdWUodmFsdWUpIHtcblx0XHRpZiAoIFNhbml0ICYmIHR5cGVvZiBTYW5pdC5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IgPT09ICdmdW5jdGlvbicgKSB7XG5cdFx0XHRyZXR1cm4gU2FuaXQuZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yKCB2YWx1ZSApO1xuXHRcdH1cblx0XHRyZXR1cm4gU3RyaW5nKCB2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSApXG5cdFx0XHQucmVwbGFjZSggL1xcXFwvZywgJ1xcXFxcXFxcJyApXG5cdFx0XHQucmVwbGFjZSggL1wiL2csICdcXFxcXCInIClcblx0XHRcdC5yZXBsYWNlKCAvXFxuL2csICdcXFxcQSAnIClcblx0XHRcdC5yZXBsYWNlKCAvXFxdL2csICdcXFxcXScgKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldF91cmxfcGFyYW1zKCkge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gbmV3IFVSTFNlYXJjaFBhcmFtcyggdy5sb2NhdGlvbi5zZWFyY2ggfHwgJycgKTtcblx0XHR9IGNhdGNoICggX2UgKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBvcGVuX3NldHRpbmdzX2dyb3VwKGdyb3VwX2tleSkge1xuXHRcdGNvbnN0IHBhbmVsID0gZC5nZXRFbGVtZW50QnlJZCggJ3dwYmNfYmZiX19pbnNwZWN0b3JfZm9ybV9zZXR0aW5ncycgKSB8fCBkO1xuXHRcdGNvbnN0IGdyb3VwID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ncm91cFtkYXRhLWdyb3VwPVwiJyArIGVzY19hdHRyX3NlbGVjdG9yX3ZhbHVlKCBncm91cF9rZXkgKSArICdcIl0nICk7XG5cdFx0aWYgKCAhIGdyb3VwICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlciA9IGdyb3VwLnF1ZXJ5U2VsZWN0b3IoICcuZ3JvdXBfX2hlYWRlcicgKTtcblx0XHRjb25zdCBmaWVsZHMgPSBncm91cC5xdWVyeVNlbGVjdG9yKCAnLmdyb3VwX19maWVsZHMnICk7XG5cblx0XHRncm91cC5jbGFzc0xpc3QuYWRkKCAnaXMtb3BlbicgKTtcblx0XHRpZiAoIGhlYWRlciApIHtcblx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0fVxuXHRcdGlmICggZmllbGRzICkge1xuXHRcdFx0ZmllbGRzLnJlbW92ZUF0dHJpYnV0ZSggJ2hpZGRlbicgKTtcblx0XHRcdGZpZWxkcy5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGZ1bmN0aW9uIGZvY3VzX3NldHRpbmdzX3Jvdyhyb3dfa2V5KSB7XG5cdFx0Y29uc3QgcGFuZWwgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX2luc3BlY3Rvcl9mb3JtX3NldHRpbmdzJyApIHx8IGQ7XG5cdFx0Y29uc3Qgcm93ID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjLXNldHRpbmdbZGF0YS1rZXk9XCInICsgZXNjX2F0dHJfc2VsZWN0b3JfdmFsdWUoIHJvd19rZXkgKSArICdcIl0nICk7XG5cdFx0aWYgKCAhIHJvdyApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0cm93LnNjcm9sbEludG9WaWV3KCB7IGJlaGF2aW9yOiAnc21vb3RoJywgYmxvY2s6ICdjZW50ZXInLCBpbmxpbmU6ICduZWFyZXN0JyB9ICk7XG5cdFx0fSBjYXRjaCAoIF9lICkge1xuXHRcdFx0cm93LnNjcm9sbEludG9WaWV3KCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0cm93LmNsYXNzTGlzdC5yZW1vdmUoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJywgJ3dwYmNfYmZiX19oaWdobGlnaHQtcHVsc2UnICk7XG5cdFx0dm9pZCByb3cub2Zmc2V0V2lkdGg7XG5cdFx0cm93LmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJywgJ3dwYmNfYmZiX19oaWdobGlnaHQtcHVsc2UnICk7XG5cblx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XG5cdFx0XHRyb3cuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19zY3JvbGwtcHVsc2UnLCAnd3BiY19iZmJfX2hpZ2hsaWdodC1wdWxzZScgKTtcblx0XHR9LCAyMjAwICk7XG5cblx0XHRjb25zdCBjb250cm9sID0gcm93LnF1ZXJ5U2VsZWN0b3IoICdbZGF0YS13cGJjLWJmYi1mcy1rZXk9XCInICsgZXNjX2F0dHJfc2VsZWN0b3JfdmFsdWUoIHJvd19rZXkgKSArICdcIl0nIClcblx0XHRcdHx8IHJvdy5xdWVyeVNlbGVjdG9yKCAnc2VsZWN0LGlucHV0LHRleHRhcmVhLGJ1dHRvbicgKTtcblxuXHRcdGlmICggY29udHJvbCAmJiB0eXBlb2YgY29udHJvbC5mb2N1cyA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdHNldFRpbWVvdXQoICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb250cm9sLmZvY3VzKCB7IHByZXZlbnRTY3JvbGw6IHRydWUgfSApO1xuXHRcdFx0XHR9IGNhdGNoICggX2UgKSB7XG5cdFx0XHRcdFx0Y29udHJvbC5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCAyNTAgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBPcGVuIG9uZSBjb2xsYXBzaWJsZSBBZGQgRmllbGRzIHBhbGV0dGUgZ3JvdXAuXG5cdCAqXG5cdCAqIFRoZSBzZXR1cC13aXphcmQgZGVlcCBsaW5rIHVzZXMgdGhpcyBoZWxwZXIgdG8gcmV2ZWFsIGEgZmllbGQgcGFjayB3aXRob3V0XG5cdCAqIGluc2VydGluZyBvciBvdGhlcndpc2UgY2hhbmdpbmcgdGhlIGN1cnJlbnQgYm9va2luZyBmb3JtLlxuXHQgKlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gZ3JvdXBfa2V5IFBhbGV0dGUgZ3JvdXAga2V5IGZyb20gaXRzIGRhdGEtZ3JvdXAgYXR0cmlidXRlLlxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gV2hldGhlciB0aGUgcmVxdWVzdGVkIHBhbGV0dGUgZ3JvdXAgd2FzIGZvdW5kIGFuZCBvcGVuZWQuXG5cdCAqL1xuXHRmdW5jdGlvbiBvcGVuX3BhbGV0dGVfZ3JvdXAoZ3JvdXBfa2V5KSB7XG5cdFx0Y29uc3QgcGFuZWwgPSBkLmdldEVsZW1lbnRCeUlkKCAnd3BiY19iZmJfX3BhbGV0dGVfYWRkX25ldycgKSB8fCBkO1xuXHRcdGNvbnN0IGdyb3VwID0gcGFuZWwucXVlcnlTZWxlY3RvciggJy53cGJjX2JmYl9faW5zcGVjdG9yX19ncm91cFtkYXRhLWdyb3VwPVwiJyArIGVzY19hdHRyX3NlbGVjdG9yX3ZhbHVlKCBncm91cF9rZXkgKSArICdcIl0nICk7XG5cdFx0aWYgKCAhIGdyb3VwICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlciA9IGdyb3VwLnF1ZXJ5U2VsZWN0b3IoICcuZ3JvdXBfX2hlYWRlcicgKTtcblx0XHRjb25zdCBmaWVsZHMgPSBncm91cC5xdWVyeVNlbGVjdG9yKCAnLmdyb3VwX19maWVsZHMnICk7XG5cblx0XHRncm91cC5jbGFzc0xpc3QuYWRkKCAnaXMtb3BlbicgKTtcblx0XHRpZiAoIGhlYWRlciApIHtcblx0XHRcdGhlYWRlci5zZXRBdHRyaWJ1dGUoICdhcmlhLWV4cGFuZGVkJywgJ3RydWUnICk7XG5cdFx0fVxuXHRcdGlmICggZmllbGRzICkge1xuXHRcdFx0ZmllbGRzLnJlbW92ZUF0dHJpYnV0ZSggJ2hpZGRlbicgKTtcblx0XHRcdGZpZWxkcy5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGb2N1cyBhbmQgdmlzdWFsbHkgaGlnaGxpZ2h0IG9uZSBBZGQgRmllbGRzIHBhbGV0dGUgaXRlbS5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IGZpZWxkX3R5cGUgUmVnaXN0ZXJlZCBGb3JtIEJ1aWxkZXIgZmllbGQgdHlwZS5cblx0ICogQHJldHVybnMge2Jvb2xlYW59IFdoZXRoZXIgdGhlIHJlcXVlc3RlZCBmaWVsZCBwYWNrIHBhbGV0dGUgaXRlbSB3YXMgZm91bmQuXG5cdCAqL1xuXHRmdW5jdGlvbiBmb2N1c19wYWxldHRlX2ZpZWxkKGZpZWxkX3R5cGUpIHtcblx0XHRjb25zdCBwYW5lbCA9IGQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjX2JmYl9fcGFsZXR0ZV9hZGRfbmV3JyApIHx8IGQ7XG5cdFx0Y29uc3QgZmllbGQgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCAnLndwYmNfYmZiX19maWVsZFtkYXRhLXR5cGU9XCInICsgZXNjX2F0dHJfc2VsZWN0b3JfdmFsdWUoIGZpZWxkX3R5cGUgKSArICdcIl0nICk7XG5cdFx0aWYgKCAhIGZpZWxkICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRmaWVsZC5zY3JvbGxJbnRvVmlldyggeyBiZWhhdmlvcjogJ3Ntb290aCcsIGJsb2NrOiAnY2VudGVyJywgaW5saW5lOiAnbmVhcmVzdCcgfSApO1xuXHRcdH0gY2F0Y2ggKCBfZSApIHtcblx0XHRcdGZpZWxkLnNjcm9sbEludG9WaWV3KCB0cnVlICk7XG5cdFx0fVxuXG5cdFx0ZmllbGQuY2xhc3NMaXN0LnJlbW92ZSggJ3dwYmNfYmZiX19zY3JvbGwtcHVsc2UnLCAnd3BiY19iZmJfX2hpZ2hsaWdodC1wdWxzZScgKTtcblx0XHR2b2lkIGZpZWxkLm9mZnNldFdpZHRoO1xuXHRcdGZpZWxkLmNsYXNzTGlzdC5hZGQoICd3cGJjX2JmYl9fc2Nyb2xsLXB1bHNlJywgJ3dwYmNfYmZiX19oaWdobGlnaHQtcHVsc2UnICk7XG5cdFx0ZmllbGQuc2V0QXR0cmlidXRlKCAndGFiaW5kZXgnLCAnLTEnICk7XG5cblx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XG5cdFx0XHRmaWVsZC5jbGFzc0xpc3QucmVtb3ZlKCAnd3BiY19iZmJfX3Njcm9sbC1wdWxzZScsICd3cGJjX2JmYl9faGlnaGxpZ2h0LXB1bHNlJyApO1xuXHRcdH0sIDIyMDAgKTtcblx0XHRzZXRUaW1lb3V0KCAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmaWVsZC5mb2N1cyggeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0gKTtcblx0XHRcdH0gY2F0Y2ggKCBfZSApIHtcblx0XHRcdFx0ZmllbGQuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9LCAyNTAgKTtcblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0bGV0IGRlZXBfbGlua19kb25lID0gZmFsc2U7XG5cdGxldCBkZWVwX2xpbmtfYWpheF9saXN0ZW5lcl9ib3VuZCA9IGZhbHNlO1xuXG5cdGZ1bmN0aW9uIGhhc19pbml0aWFsX2RlZXBfbGluaygpIHtcblx0XHRjb25zdCBwYXJhbXMgPSBnZXRfdXJsX3BhcmFtcygpO1xuXHRcdHJldHVybiAhISAoXG5cdFx0XHRwYXJhbXNcblx0XHRcdCYmIC0xICE9PSBbICdmb3JtX3NldHRpbmdzJywgJ2FkZF9maWVsZHMnIF0uaW5kZXhPZiggcGFyYW1zLmdldCggJ3dwYmNfYmZiX3BhbmVsJyApIClcblx0XHQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gaGFuZGxlX2luaXRpYWxfZGVlcF9saW5rKHRhYnMsIGF0dGVtcHQgPSAwKSB7XG5cdFx0aWYgKCBkZWVwX2xpbmtfZG9uZSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJhbXMgPSBnZXRfdXJsX3BhcmFtcygpO1xuXHRcdGlmICggISBwYXJhbXMgfHwgLTEgPT09IFsgJ2Zvcm1fc2V0dGluZ3MnLCAnYWRkX2ZpZWxkcycgXS5pbmRleE9mKCBwYXJhbXMuZ2V0KCAnd3BiY19iZmJfcGFuZWwnICkgKSApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYW5lbF9tb2RlID0gcGFyYW1zLmdldCggJ3dwYmNfYmZiX3BhbmVsJyApO1xuXHRcdGNvbnN0IHBhbmVsX2lkID0gJ2FkZF9maWVsZHMnID09PSBwYW5lbF9tb2RlID8gJ3dwYmNfYmZiX19wYWxldHRlX2FkZF9uZXcnIDogJ3dwYmNfYmZiX19pbnNwZWN0b3JfZm9ybV9zZXR0aW5ncyc7XG5cdFx0Y29uc3QgdGFiID0gZC5nZXRFbGVtZW50QnlJZCggJ2FkZF9maWVsZHMnID09PSBwYW5lbF9tb2RlID8gJ3dwYmNfdGFiX2xpYnJhcnknIDogJ3dwYmNfdGFiX2Zvcm0nICk7XG5cdFx0Y29uc3QgcGFuZWwgPSBkLmdldEVsZW1lbnRCeUlkKCBwYW5lbF9pZCApO1xuXHRcdGlmICggISB0YWIgfHwgISBwYW5lbCApIHtcblx0XHRcdGlmICggYXR0ZW1wdCA8IDI1ICkge1xuXHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiBoYW5kbGVfaW5pdGlhbF9kZWVwX2xpbmsoIHRhYnMsIGF0dGVtcHQgKyAxICksIDgwICk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGFicy5zaG93X3BhbmVsKCBwYW5lbF9pZCwgdGFiICk7XG5cblx0XHRjb25zdCBncm91cF9rZXkgPSBwYXJhbXMuZ2V0KCAnd3BiY19iZmJfZ3JvdXAnICk7XG5cdFx0Y29uc3Qgcm93X2tleSA9IHBhcmFtcy5nZXQoICd3cGJjX2JmYl9mb2N1cycgKTtcblx0XHRjb25zdCBncm91cF9vayA9IGdyb3VwX2tleVxuXHRcdFx0PyAoICdhZGRfZmllbGRzJyA9PT0gcGFuZWxfbW9kZSA/IG9wZW5fcGFsZXR0ZV9ncm91cCggZ3JvdXBfa2V5ICkgOiBvcGVuX3NldHRpbmdzX2dyb3VwKCBncm91cF9rZXkgKSApXG5cdFx0XHQ6IHRydWU7XG5cdFx0Y29uc3Qgcm93X29rID0gcm93X2tleVxuXHRcdFx0PyAoICdhZGRfZmllbGRzJyA9PT0gcGFuZWxfbW9kZSA/IGZvY3VzX3BhbGV0dGVfZmllbGQoIHJvd19rZXkgKSA6IGZvY3VzX3NldHRpbmdzX3Jvdyggcm93X2tleSApIClcblx0XHRcdDogdHJ1ZTtcblxuXHRcdGlmICggKCAhIGdyb3VwX29rIHx8ICEgcm93X29rICkgJiYgYXR0ZW1wdCA8IDI1ICkge1xuXHRcdFx0c2V0VGltZW91dCggKCkgPT4gaGFuZGxlX2luaXRpYWxfZGVlcF9saW5rKCB0YWJzLCBhdHRlbXB0ICsgMSApLCA4MCApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGRlZXBfbGlua19kb25lID0gZ3JvdXBfb2sgJiYgcm93X29rO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2NoZWR1bGVfaW5pdGlhbF9kZWVwX2xpbmsodGFicywgZGVsYXkgPSAwKSB7XG5cdFx0aWYgKCBkZWVwX2xpbmtfZG9uZSB8fCAhIGhhc19pbml0aWFsX2RlZXBfbGluaygpICkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHNldFRpbWVvdXQoICgpID0+IGhhbmRsZV9pbml0aWFsX2RlZXBfbGluayggdGFicyApLCBkZWxheSApO1xuXHR9XG5cblx0ZnVuY3Rpb24gYmluZF9pbml0aWFsX2RlZXBfbGlua19hZnRlcl9mb3JtX2xvYWQodGFicywgYXR0ZW1wdCA9IDApIHtcblx0XHRpZiAoICEgaGFzX2luaXRpYWxfZGVlcF9saW5rKCkgKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCAhIGRlZXBfbGlua19hamF4X2xpc3RlbmVyX2JvdW5kICkge1xuXHRcdFx0ZGVlcF9saW5rX2FqYXhfbGlzdGVuZXJfYm91bmQgPSB0cnVlO1xuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnd3BiYzpiZmI6Zm9ybTphamF4X2xvYWRlZCcsICgpID0+IHtcblx0XHRcdFx0Ly8gTGVnYWN5L2JsYW5rIGZvcm1zIGRvIG5vdCBhbHdheXMgZW1pdCBTVFJVQ1RVUkVfTE9BREVEOyB3YWl0IHVudGlsIGFkZF9wYWdlKCkgYW5kIFVJIGRlZmF1bHRzIHNldHRsZS5cblx0XHRcdFx0c2NoZWR1bGVfaW5pdGlhbF9kZWVwX2xpbmsoIHRhYnMsIDQ1MCApO1xuXHRcdFx0fSwgeyBvbmNlOiB0cnVlIH0gKTtcblx0XHR9XG5cblx0XHRpZiAoICEgdy53cGJjX2JmYl9hcGkgfHwgISB3LndwYmNfYmZiX2FwaS5yZWFkeSB8fCB0eXBlb2Ygdy53cGJjX2JmYl9hcGkucmVhZHkudGhlbiAhPT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdGlmICggYXR0ZW1wdCA8IDI1ICkge1xuXHRcdFx0XHRzZXRUaW1lb3V0KCAoKSA9PiBiaW5kX2luaXRpYWxfZGVlcF9saW5rX2FmdGVyX2Zvcm1fbG9hZCggdGFicywgYXR0ZW1wdCArIDEgKSwgODAgKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR3LndwYmNfYmZiX2FwaS5yZWFkeS50aGVuKCAoYnVpbGRlcikgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnRzID0gKCB3LldQQkNfQkZCX0NvcmUgJiYgdy5XUEJDX0JGQl9Db3JlLldQQkNfQkZCX0V2ZW50cyApIHx8IHt9O1xuXHRcdFx0Y29uc3QgZXZlbnRfbmFtZSA9IGV2ZW50cy5TVFJVQ1RVUkVfTE9BREVEIHx8ICd3cGJjOmJmYjpzdHJ1Y3R1cmU6bG9hZGVkJztcblx0XHRcdGlmICggISBidWlsZGVyIHx8ICEgYnVpbGRlci5idXMgfHwgdHlwZW9mIGJ1aWxkZXIuYnVzLm9uICE9PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9uX3N0cnVjdHVyZV9sb2FkZWQgPSAoKSA9PiB7XG5cdFx0XHRcdGlmICggYnVpbGRlci5idXMgJiYgdHlwZW9mIGJ1aWxkZXIuYnVzLm9mZiA9PT0gJ2Z1bmN0aW9uJyApIHtcblx0XHRcdFx0XHRidWlsZGVyLmJ1cy5vZmYoIGV2ZW50X25hbWUsIG9uX3N0cnVjdHVyZV9sb2FkZWQgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBSdW4gYWZ0ZXIgc2VsZWN0aW9uIGNsZWFyaW5nL2luc3BlY3RvciBkZWZhdWx0cyBhdHRhY2hlZCB0byB0aGUgc2FtZSBsb2FkIGV2ZW50LlxuXHRcdFx0XHRzY2hlZHVsZV9pbml0aWFsX2RlZXBfbGluayggdGFicywgMCApO1xuXHRcdFx0fTtcblxuXHRcdFx0YnVpbGRlci5idXMub24oIGV2ZW50X25hbWUsIG9uX3N0cnVjdHVyZV9sb2FkZWQgKTtcblx0XHR9ICk7XG5cdH1cblxuXHQvLyBCb290IG9uY2UgRE9NIGlzIHJlYWR5LlxuXHRjb25zdCBpbnN0YW5jZSA9IG5ldyBXUEJDX0JGQl9SaWdodGJhcl9UYWJzKCk7XG5cdGNvbnN0IGJvb3QgPSAoKSA9PiB7XG5cdFx0aW5zdGFuY2UuaW5pdCgpO1xuXHRcdGJpbmRfaW5pdGlhbF9kZWVwX2xpbmtfYWZ0ZXJfZm9ybV9sb2FkKCBpbnN0YW5jZSApO1xuXHR9O1xuXHRpZiAoIGQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnICkge1xuXHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBib290ICk7XG5cdH0gZWxzZSB7XG5cdFx0Ym9vdCgpO1xuXHR9XG5cclxuXHQvLyAoT3B0aW9uYWwpIGV4cG9zZSBmb3IgZGVidWdnaW5nOlxyXG5cdC8vIHcuV1BCQ19CRkJfUmlnaHRiYXJfVGFicyA9IGluc3RhbmNlO1xyXG5cclxufSkoIHdpbmRvdywgZG9jdW1lbnQgKTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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

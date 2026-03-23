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

  // Boot once DOM is ready.
  const instance = new WPBC_BFB_Rightbar_Tabs();
  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', () => instance.init());
  } else {
    instance.init();
  }

  // (Optional) expose for debugging:
  // w.WPBC_BFB_Rightbar_Tabs = instance;
})(window, document);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvX291dC9iZmItcmlnaHRiYXItdGFicy5qcyIsIm5hbWVzIjpbInciLCJkIiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJTYW5pdCIsIldQQkNfQkZCX1Nhbml0aXplIiwiV1BCQ19CRkJfUmlnaHRiYXJfVGFicyIsImNvbnN0cnVjdG9yIiwib3B0cyIsImRlZiIsInBhbmVscyIsInRhYmxpc3QiLCJzZWxlY3RvcnMiLCJPYmplY3QiLCJhc3NpZ24iLCJfb25fa2V5ZG93biIsImJpbmQiLCJfb25fY2xpY2siLCJfb25fc2hvd19wYW5lbF9ldnQiLCJfdGFibGlzdHMiLCJpbml0IiwiQXJyYXkiLCJmcm9tIiwicXVlcnlTZWxlY3RvckFsbCIsImZvckVhY2giLCJsaXN0IiwiYWRkRXZlbnRMaXN0ZW5lciIsInN5bmNfaW5pdGlhbF9hcmlhIiwiZGVzdHJveSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJzaG93X3BhbmVsIiwicGFuZWxfaWQiLCJ0YWJfZWwiLCJwYW5lbCIsImdldEVsZW1lbnRCeUlkIiwiY29uc29sZSIsIndhcm4iLCJfaGlkZV9hbGxfcGFuZWxzIiwicmVtb3ZlQXR0cmlidXRlIiwic2V0QXR0cmlidXRlIiwidGFiIiwiX2dldF90YWJfZm9yX3BhbmVsIiwiY2xvc2VzdCIsInF1ZXJ5U2VsZWN0b3IiLCJ0IiwiZGlzcGF0Y2hFdmVudCIsIkN1c3RvbUV2ZW50IiwiZGV0YWlsIiwidmlzaWJsZSIsImxhYmVsbGVkX2J5IiwiZ2V0QXR0cmlidXRlIiwiaWQiLCJmaXJzdCIsIl9wYW5lbHMiLCJwIiwiZXNjIiwidmFsIiwiZXNjX2F0dHJfdmFsdWVfZm9yX3NlbGVjdG9yIiwiU3RyaW5nIiwicmVwbGFjZSIsImUiLCJ0YXJnZXQiLCJ0YWJzIiwiaWR4IiwiaW5kZXhPZiIsImZvY3VzIiwiaSIsImtleSIsInByZXZlbnREZWZhdWx0IiwibGVuZ3RoIiwidGFiX2lkIiwidGFiX3NlbGVjdG9yIiwidW5kZWZpbmVkIiwiaW5zdGFuY2UiLCJyZWFkeVN0YXRlIiwid2luZG93IiwiZG9jdW1lbnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9fc3JjL2JmYi1yaWdodGJhci10YWJzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCb29raW5nIENhbGVuZGFyIOKAlCBSaWdodGJhciBUYWJzIENvbnRyb2xsZXIgKEpTKVxyXG4gKlxyXG4gKiBQdXJwb3NlOiBIYW5kbGVzIHRoZSBtYWluIHJpZ2h0IHNpZGViYXIgdGFicyAoTGlicmFyeSAvIEluc3BlY3RvciAvIFNldHRpbmdzKSBpbiB0aGUgQm9va2luZyBGb3JtIEJ1aWxkZXIuXHJcbiAqIC0gTWFuYWdlcyBrZXlib2FyZCBhbmQgbW91c2UgbmF2aWdhdGlvbiBmb3IgdGFicy5cclxuICogLSBLZWVwcyBBUklBIGF0dHJpYnV0ZXMgaW4gc3luYyBhbmQgc2hvd3MvaGlkZXMgbWF0Y2hpbmcgdGFicGFuZWxzLlxyXG4gKiAtIFN1cHBvcnRzIHByb2dyYW1tYXRpYyBzd2l0Y2hpbmcgdmlhIHRoZSAnd3BiY19iZmI6c2hvd19wYW5lbCcgZXZlbnQgYW5kIGVtaXRzICd3cGJjX2JmYjpwYW5lbF9zaG93bicuXHJcbiAqIC0gVXNlcyBoYXJkLXdpcmVkIHNlbGVjdG9ycyBmb3IgcmlnaHRiYXIgbWFya3VwOyBvcHRpb25hbGx5IHVzZXMgV1BCQ19CRkJfU2FuaXRpemUgZm9yIHNhZmUgc2VsZWN0b3JzLlxyXG4gKlxyXG4gKiBNYXJrdXAgY29udHJhY3Q6XHJcbiAqIC0gVGFiczogICAgW3JvbGU9XCJ0YWJcIl1bYXJpYS1jb250cm9scz1cIjxwYW5lbF9pZD5cIl1cclxuICogLSBUYWJsaXN0OiAud3BiY19iZmJfX3JpZ2h0YmFyX3RhYnNbcm9sZT1cInRhYmxpc3RcIl1cclxuICogLSBQYW5lbHM6ICAud3BiY19iZmJfX3BhbGV0dGVfcGFuZWwjPHBhbmVsX2lkPiAod2l0aCBhcmlhLWxhYmVsbGVkYnkpXHJcbiAqXHJcbiAqIEBwYWNrYWdlICAgQm9va2luZyBDYWxlbmRhclxyXG4gKiBAc3VicGFja2FnZSBBZG1pblxcVUlcclxuICogQHNpbmNlICAgICAxMS4wLjBcclxuICogQHZlcnNpb24gICAxLjAuMFxyXG4gKiBAc2VlICAgICAgIEZpbGUgIC4uL2luY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL19zcmMvYmZiLXJpZ2h0YmFyLXRhYnMuanNcclxuICovXHJcbihmdW5jdGlvbiAodywgZCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0Y29uc3QgQ29yZSAgPSB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0Y29uc3QgU2FuaXQgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplIHx8IG51bGw7XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFjY2Vzc2libGUgdGFicyBjb250cm9sbGVyIGZvciB0aGUgcmlnaHQtc2lkZSBwYWxldHRlcyAoTGlicmFyeSAvIEluc3BlY3RvciAvIFNldHRpbmdzKVxyXG5cdCAqIG9mIHRoZSBCb29raW5nIEZvcm0gQnVpbGRlciBVSS4gSGFuZGxlczpcclxuXHQgKiAgLSBNb3VzZSBhbmQga2V5Ym9hcmQgbmF2aWdhdGlvbiAoZGVsZWdhdGVkIG9uIHRoZSB0YWJsaXN0IGNvbnRhaW5lcikuXHJcblx0ICogIC0gU2hvd2luZy9oaWRpbmcgYXNzb2NpYXRlZCB0YWJwYW5lbHMgYW5kIGtlZXBpbmcgQVJJQSBpbiBzeW5jLlxyXG5cdCAqICAtIFByb2dyYW1tYXRpYyBzd2l0Y2hpbmcgdmlhIHRoZSBgd3BiY19iZmI6c2hvd19wYW5lbGAgQ3VzdG9tRXZlbnQgKGxpc3RlbmVkIG9uIGRvY3VtZW50KS5cclxuXHQgKlxyXG5cdCAqIElmIHByZXNlbnQsIHtAbGluayBXUEJDX0JGQl9TYW5pdGl6ZS5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3J9IGlzIHVzZWQgdG8gc2FmZWx5XHJcblx0ICogc2VsZWN0IHRoZSB0YWIgdGhhdCBjb250cm9scyBhIGdpdmVuIHBhbmVsIGlkLlxyXG5cdCAqXHJcblx0ICogQHZlcnNpb24gMjAyNS0wOC0yNlxyXG5cdCAqL1xyXG5cdGNsYXNzIFdQQkNfQkZCX1JpZ2h0YmFyX1RhYnMge1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ29uc3RydWN0b3IuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzXVxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9IFtvcHRzLnNlbGVjdG9yc11cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0cy5zZWxlY3RvcnMucGFuZWxzPScud3BiY19iZmJfX3BhbGV0dGVfcGFuZWwnXSBDU1Mgc2VsZWN0b3IgdGhhdCBtYXRjaGVzIHRhYnBhbmVscy5cclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBbb3B0cy5zZWxlY3RvcnMudGFibGlzdD0nLndwYmNfYmZiX19yaWdodGJhcl90YWJzW3JvbGU9XCJ0YWJsaXN0XCJdJ10gQ1NTIHNlbGVjdG9yIGZvciB0YWJsaXN0IHJvb3RzLlxyXG5cdFx0ICovXHJcblx0XHRjb25zdHJ1Y3RvcihvcHRzID0ge30pIHtcclxuXHRcdFx0Y29uc3QgZGVmICAgICAgICAgICAgICAgPSB7XHJcblx0XHRcdFx0cGFuZWxzIDogJy53cGJjX2JmYl9fcGFsZXR0ZV9wYW5lbCcsXHJcblx0XHRcdFx0dGFibGlzdDogJy53cGJjX2JmYl9fcmlnaHRiYXJfdGFic1tyb2xlPVwidGFibGlzdFwiXSdcclxuXHRcdFx0fTtcclxuXHRcdFx0dGhpcy5zZWxlY3RvcnMgICAgICAgICAgPSBPYmplY3QuYXNzaWduKCB7fSwgZGVmLCBvcHRzLnNlbGVjdG9ycyB8fCB7fSApO1xyXG5cdFx0XHR0aGlzLl9vbl9rZXlkb3duICAgICAgICA9IHRoaXMuX29uX2tleWRvd24uYmluZCggdGhpcyApO1xyXG5cdFx0XHR0aGlzLl9vbl9jbGljayAgICAgICAgICA9IHRoaXMuX29uX2NsaWNrLmJpbmQoIHRoaXMgKTtcclxuXHRcdFx0dGhpcy5fb25fc2hvd19wYW5lbF9ldnQgPSB0aGlzLl9vbl9zaG93X3BhbmVsX2V2dC5iaW5kKCB0aGlzICk7XHJcblx0XHRcdHRoaXMuX3RhYmxpc3RzICAgICAgICAgID0gW107XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBdHRhY2ggRE9NIGxpc3RlbmVycyB0byBlYWNoIHRhYmxpc3QgY29udGFpbmVyIGFuZCBwZXJmb3JtIGluaXRpYWwgQVJJQSBzeW5jLlxyXG5cdFx0ICogS2V5Ym9hcmQgJiBtb3VzZSBoYW5kbGVycyBhcmUgc2NvcGVkIHRvIHRoZSB0YWJsaXN0KHMpIGZvciBlYXNpZXIgZGVidWdnaW5nLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRpbml0KCkge1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cyA9IEFycmF5LmZyb20oIGQucXVlcnlTZWxlY3RvckFsbCggdGhpcy5zZWxlY3RvcnMudGFibGlzdCApICk7XHJcblx0XHRcdHRoaXMuX3RhYmxpc3RzLmZvckVhY2goIChsaXN0KSA9PiB7XHJcblx0XHRcdFx0bGlzdC5hZGRFdmVudExpc3RlbmVyKCAna2V5ZG93bicsIHRoaXMuX29uX2tleWRvd24sIHRydWUgKTtcclxuXHRcdFx0XHRsaXN0LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIHRoaXMuX29uX2NsaWNrLCBmYWxzZSApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHRcdC8vIFByb2dyYW1tYXRpYyBzd2l0Y2hpbmcga2VwdCBvbiBkb2N1bWVudCBmb3IgYmFjay1jb21wYXQgd2l0aCBleGlzdGluZyBkaXNwYXRjaGVzLlxyXG5cdFx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYjpzaG93X3BhbmVsJywgdGhpcy5fb25fc2hvd19wYW5lbF9ldnQgKTtcclxuXHJcblx0XHRcdHRoaXMuc3luY19pbml0aWFsX2FyaWEoKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbW92ZSBsaXN0ZW5lcnMgYXR0YWNoZWQgaW4ge0BsaW5rIGluaXR9LlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRkZXN0cm95KCkge1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cy5mb3JFYWNoKCAobGlzdCkgPT4ge1xyXG5cdFx0XHRcdGxpc3QucmVtb3ZlRXZlbnRMaXN0ZW5lciggJ2tleWRvd24nLCB0aGlzLl9vbl9rZXlkb3duLCB0cnVlICk7XHJcblx0XHRcdFx0bGlzdC5yZW1vdmVFdmVudExpc3RlbmVyKCAnY2xpY2snLCB0aGlzLl9vbl9jbGljaywgZmFsc2UgKTtcclxuXHRcdFx0fSApO1xyXG5cdFx0XHR0aGlzLl90YWJsaXN0cyA9IFtdO1xyXG5cdFx0XHRkLnJlbW92ZUV2ZW50TGlzdGVuZXIoICd3cGJjX2JmYjpzaG93X3BhbmVsJywgdGhpcy5fb25fc2hvd19wYW5lbF9ldnQgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFNob3cgYSBzcGVjaWZpYyBwYW5lbCBhbmQgdXBkYXRlIHRoZSBzZWxlY3RlZCB0YWIgc3RhdGUuXHJcblx0XHQgKiAtIEhpZGVzIGFsbCBwYW5lbHMgbWF0Y2hlZCBieSB7QGxpbmsgc2VsZWN0b3JzLnBhbmVsc30gYnkgc2V0dGluZ1xyXG5cdFx0ICogICBgaGlkZGVuYCBhbmQgYGFyaWEtaGlkZGVuPVwidHJ1ZVwiYC5cclxuXHRcdCAqIC0gUmV2ZWFscyB0aGUgdGFyZ2V0IHBhbmVsIGJ5IHJlbW92aW5nIGBoaWRkZW5gIGFuZCBzZXR0aW5nIGBhcmlhLWhpZGRlbj1cImZhbHNlXCJgLlxyXG5cdFx0ICogLSBJZiBhIHRhYiBlbGVtZW50IGlzIHByb3ZpZGVkIChvciBkaXNjb3ZlcmFibGUgYnkgYXJpYS1jb250cm9scyksXHJcblx0XHQgKiAgIG1hcmtzIHRoYXQgdGFiIGBhcmlhLXNlbGVjdGVkPVwidHJ1ZVwiYCBhbmQgY2xlYXJzIG90aGVycyBpbiBpdHMgdGFibGlzdC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcGFuZWxfaWQgIFRoZSBpZCBhdHRyaWJ1dGUgb2YgdGhlIHBhbmVsICh0YWJwYW5lbCkgdG8gc2hvdy5cclxuXHRcdCAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IFt0YWJfZWxdIEFuIGV4cGxpY2l0IHRhYiBlbGVtZW50IHRvIG1hcmsgc2VsZWN0ZWQgKG9wdGlvbmFsKS5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzaG93X3BhbmVsKHBhbmVsX2lkLCB0YWJfZWwpIHtcclxuXHRcdFx0Y29uc3QgcGFuZWwgPSBkLmdldEVsZW1lbnRCeUlkKCBwYW5lbF9pZCApO1xyXG5cdFx0XHRpZiAoICEgcGFuZWwgKSB7XHJcblx0XHRcdFx0Y29uc29sZS53YXJuKCAnW1dQQkNdIFBhbmVsIG5vdCBmb3VuZDonLCBwYW5lbF9pZCApO1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGhpcy5faGlkZV9hbGxfcGFuZWxzKCk7XHJcblx0XHRcdHBhbmVsLnJlbW92ZUF0dHJpYnV0ZSggJ2hpZGRlbicgKTtcclxuXHRcdFx0cGFuZWwuc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblxyXG5cdFx0XHRjb25zdCB0YWIgPSB0YWJfZWwgfHwgdGhpcy5fZ2V0X3RhYl9mb3JfcGFuZWwoIHBhbmVsX2lkICk7XHJcblx0XHRcdGlmICggISB0YWIgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRjb25zdCB0YWJsaXN0ID0gdGFiLmNsb3Nlc3QoICdbcm9sZT1cInRhYmxpc3RcIl0nICkgfHwgZC5xdWVyeVNlbGVjdG9yKCB0aGlzLnNlbGVjdG9ycy50YWJsaXN0ICk7XHJcblx0XHRcdGlmICggISB0YWJsaXN0ICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGFibGlzdC5xdWVyeVNlbGVjdG9yQWxsKCAnW3JvbGU9XCJ0YWJcIl0nICkuZm9yRWFjaCggKHQpID0+IHQuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScgKSApO1xyXG5cdFx0XHR0YWIuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsICd0cnVlJyApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZSBhIGhvb2sgd2hlbiBhIHBhbmVsIGNoYW5nZXMuXHJcblx0XHRcdGQuZGlzcGF0Y2hFdmVudCggbmV3IEN1c3RvbUV2ZW50KCAnd3BiY19iZmI6cGFuZWxfc2hvd24nLCB7IGRldGFpbDogeyBwYW5lbF9pZCwgdGFiX2VsOiB0YWIgfSB9ICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEVuc3VyZSBhIGNvbnNpc3RlbnQgaW5pdGlhbCBBUklBIHN0YXRlOlxyXG5cdFx0ICogLSBJZiBhIHBhbmVsIGlzIGFscmVhZHkgdmlzaWJsZSwgbWFyayBpdCBhbmQgaXRzIGNvbnRyb2xsaW5nIHRhYiBhcyBhY3RpdmUuXHJcblx0XHQgKiAtIE90aGVyd2lzZSwgcmV2ZWFsIHRoZSBmaXJzdCBwYW5lbCBhbmQgbWFyayBpdHMgdGFiIHNlbGVjdGVkLlxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzeW5jX2luaXRpYWxfYXJpYSgpIHtcclxuXHRcdFx0Y29uc3QgdmlzaWJsZSA9IGQucXVlcnlTZWxlY3RvciggYCR7dGhpcy5zZWxlY3RvcnMucGFuZWxzfTpub3QoW2hpZGRlbl0pYCApO1xyXG5cdFx0XHRpZiAoIHZpc2libGUgKSB7XHJcblx0XHRcdFx0dmlzaWJsZS5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICdmYWxzZScgKTtcclxuXHRcdFx0XHRjb25zdCBsYWJlbGxlZF9ieSA9IHZpc2libGUuZ2V0QXR0cmlidXRlKCAnYXJpYS1sYWJlbGxlZGJ5JyApO1xyXG5cdFx0XHRcdGNvbnN0IHRhYiAgICAgICAgID0gbGFiZWxsZWRfYnkgPyBkLmdldEVsZW1lbnRCeUlkKCBsYWJlbGxlZF9ieSApIDogdGhpcy5fZ2V0X3RhYl9mb3JfcGFuZWwoIHZpc2libGUuaWQgKTtcclxuXHRcdFx0XHRpZiAoIHRhYiApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHRhYmxpc3QgPSB0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKSB8fCBkLnF1ZXJ5U2VsZWN0b3IoIHRoaXMuc2VsZWN0b3JzLnRhYmxpc3QgKTtcclxuXHRcdFx0XHRcdGlmICggdGFibGlzdCApIHtcclxuXHRcdFx0XHRcdFx0dGFibGlzdC5xdWVyeVNlbGVjdG9yQWxsKCAnW3JvbGU9XCJ0YWJcIl0nICkuZm9yRWFjaCggKHQpID0+IHQuc2V0QXR0cmlidXRlKCAnYXJpYS1zZWxlY3RlZCcsICdmYWxzZScgKSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dGFiLnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCAndHJ1ZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IGZpcnN0ID0gZC5xdWVyeVNlbGVjdG9yKCB0aGlzLnNlbGVjdG9ycy5wYW5lbHMgKTtcclxuXHRcdFx0aWYgKCBmaXJzdCApIHtcclxuXHRcdFx0XHRmaXJzdC5yZW1vdmVBdHRyaWJ1dGUoICdoaWRkZW4nICk7XHJcblx0XHRcdFx0Zmlyc3Quc2V0QXR0cmlidXRlKCAnYXJpYS1oaWRkZW4nLCAnZmFsc2UnICk7XHJcblx0XHRcdFx0Y29uc3QgbGFiZWxsZWRfYnkgPSBmaXJzdC5nZXRBdHRyaWJ1dGUoICdhcmlhLWxhYmVsbGVkYnknICk7XHJcblx0XHRcdFx0Y29uc3QgdGFiICAgICAgICAgPSBsYWJlbGxlZF9ieSA/IGQuZ2V0RWxlbWVudEJ5SWQoIGxhYmVsbGVkX2J5ICkgOiB0aGlzLl9nZXRfdGFiX2Zvcl9wYW5lbCggZmlyc3QuaWQgKTtcclxuXHRcdFx0XHRpZiAoIHRhYiApIHtcclxuXHRcdFx0XHRcdGNvbnN0IHRhYmxpc3QgPSB0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKSB8fCBkLnF1ZXJ5U2VsZWN0b3IoIHRoaXMuc2VsZWN0b3JzLnRhYmxpc3QgKTtcclxuXHRcdFx0XHRcdGlmICggdGFibGlzdCApIHRhYmxpc3QucXVlcnlTZWxlY3RvckFsbCggJ1tyb2xlPVwidGFiXCJdJyApLmZvckVhY2goICh0KSA9PiB0LnNldEF0dHJpYnV0ZSggJ2FyaWEtc2VsZWN0ZWQnLCAnZmFsc2UnICkgKTtcclxuXHRcdFx0XHRcdHRhYi5zZXRBdHRyaWJ1dGUoICdhcmlhLXNlbGVjdGVkJywgJ3RydWUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLSBwcml2YXRlIGhlbHBlcnMgLS0tLVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGFsbCB0YWJwYW5lbCBlbGVtZW50cyBtYXRjaGVkIGJ5IHtAbGluayBzZWxlY3RvcnMucGFuZWxzfS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcHJpdmF0ZVxyXG5cdFx0ICogQHJldHVybnMge0hUTUxFbGVtZW50W119IEFycmF5IG9mIHBhbmVscy5cclxuXHRcdCAqL1xyXG5cdFx0X3BhbmVscygpIHtcclxuXHRcdFx0cmV0dXJuIEFycmF5LmZyb20oIGQucXVlcnlTZWxlY3RvckFsbCggdGhpcy5zZWxlY3RvcnMucGFuZWxzICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEhpZGUgZXZlcnkgcGFuZWwgKHNldCBgaGlkZGVuYCBhbmQgYGFyaWEtaGlkZGVuPVwidHJ1ZVwiYCkuXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfaGlkZV9hbGxfcGFuZWxzKCkge1xyXG5cdFx0XHR0aGlzLl9wYW5lbHMoKS5mb3JFYWNoKCAocCkgPT4ge1xyXG5cdFx0XHRcdHAuc2V0QXR0cmlidXRlKCAnaGlkZGVuJywgJ3RydWUnICk7XHJcblx0XHRcdFx0cC5zZXRBdHRyaWJ1dGUoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBGaW5kIHRoZSB0YWIgZWxlbWVudCB0aGF0IGNvbnRyb2xzIHRoZSBnaXZlbiBwYW5lbCBpZCBieSBtYXRjaGluZ1xyXG5cdFx0ICogYFtyb2xlPVwidGFiXCJdW2FyaWEtY29udHJvbHM9XCI8cGFuZWxfaWQ+XCJdYC4gSWYgdGhlIHNhbml0aXplIGhlbHBlciBpcyBhdmFpbGFibGUsXHJcblx0XHQgKiBpdCBpcyB1c2VkIHRvIGVzY2FwZSB0aGUgaWQgZm9yIGEgc2FmZSBDU1MgYXR0cmlidXRlIHNlbGVjdG9yLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gcGFuZWxfaWRcclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MRWxlbWVudHxudWxsfSBUaGUgbWF0Y2hpbmcgdGFiIGVsZW1lbnQsIG9yIG51bGwgaWYgbm90IGZvdW5kLlxyXG5cdFx0ICovXHJcblx0XHRfZ2V0X3RhYl9mb3JfcGFuZWwocGFuZWxfaWQpIHtcclxuXHRcdFx0Y29uc3QgZXNjID0gKHZhbCkgPT4ge1xyXG5cdFx0XHRcdGlmICggU2FuaXQgJiYgdHlwZW9mIFNhbml0LmVzY19hdHRyX3ZhbHVlX2Zvcl9zZWxlY3RvciA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdHJldHVybiBTYW5pdC5lc2NfYXR0cl92YWx1ZV9mb3Jfc2VsZWN0b3IoIHZhbCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gU3RyaW5nKCB2YWwgKVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9cXFxcL2csICdcXFxcXFxcXCcgKVxyXG5cdFx0XHRcdFx0LnJlcGxhY2UoIC9cIi9nLCAnXFxcXFwiJyApXHJcblx0XHRcdFx0XHQucmVwbGFjZSggL1xcbi9nLCAnXFxcXEEgJyApXHJcblx0XHRcdFx0XHQucmVwbGFjZSggL1xcXS9nLCAnXFxcXF0nICk7XHJcblx0XHRcdH07XHJcblx0XHRcdHJldHVybiBkLnF1ZXJ5U2VsZWN0b3IoIGBbcm9sZT1cInRhYlwiXVthcmlhLWNvbnRyb2xzPVwiJHtlc2MoIHBhbmVsX2lkICl9XCJdYCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogS2V5Ym9hcmQgaW50ZXJhY3Rpb24gZm9yIHRhYnMgKGRlbGVnYXRlZCBvbiB0YWJsaXN0IGVsZW1lbnQpOlxyXG5cdFx0ICogQXJyb3dSaWdodC9BcnJvd0Rvd24gLT4gZm9jdXMgbmV4dCB0YWJcclxuXHRcdCAqIEFycm93TGVmdC9BcnJvd1VwICAgLT4gZm9jdXMgcHJldmlvdXMgdGFiXHJcblx0XHQgKiBIb21lL0VuZCAgICAgICAgICAgIC0+IGZvY3VzIGZpcnN0L2xhc3QgdGFiXHJcblx0XHQgKiBFbnRlci9TcGFjZSAgICAgICAgIC0+IGFjdGl2YXRlIGZvY3VzZWQgdGFiXHJcblx0XHQgKlxyXG5cdFx0ICogQHByaXZhdGVcclxuXHRcdCAqIEBwYXJhbSB7S2V5Ym9hcmRFdmVudH0gZVxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdF9vbl9rZXlkb3duKGUpIHtcclxuXHRcdFx0Y29uc3QgdGFiID0gZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCAmJiBlLnRhcmdldC5jbG9zZXN0KCAnW3JvbGU9XCJ0YWJcIl0nICk7XHJcblx0XHRcdGlmICggIXRhYiApIHJldHVybjtcclxuXHJcblx0XHRcdGNvbnN0IGxpc3QgPSB0YWIuY2xvc2VzdCggJ1tyb2xlPVwidGFibGlzdFwiXScgKTtcclxuXHRcdFx0aWYgKCAhIGxpc3QgKSB7XHJcblx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHR9XHJcblx0XHRcdGNvbnN0IHRhYnMgID0gQXJyYXkuZnJvbSggbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCAnW3JvbGU9XCJ0YWJcIl0nICkgKTtcclxuXHRcdFx0Y29uc3QgaWR4ICAgPSB0YWJzLmluZGV4T2YoIHRhYiApO1xyXG5cdFx0XHRjb25zdCBmb2N1cyA9IChpKSA9PiB7XHJcblx0XHRcdFx0aWYgKCB0YWJzW2ldICkgdGFic1tpXS5mb2N1cygpO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0c3dpdGNoICggZS5rZXkgKSB7XHJcblx0XHRcdFx0Y2FzZSAnQXJyb3dSaWdodCc6XHJcblx0XHRcdFx0Y2FzZSAnQXJyb3dEb3duJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGZvY3VzKCAoaWR4ICsgMSkgJSB0YWJzLmxlbmd0aCApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnQXJyb3dMZWZ0JzpcclxuXHRcdFx0XHRjYXNlICdBcnJvd1VwJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGZvY3VzKCAoaWR4IC0gMSArIHRhYnMubGVuZ3RoKSAlIHRhYnMubGVuZ3RoICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlICdIb21lJzpcclxuXHRcdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHRcdGZvY3VzKCAwICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRjYXNlICdFbmQnOlxyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0Zm9jdXMoIHRhYnMubGVuZ3RoIC0gMSApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0Y2FzZSAnRW50ZXInOlxyXG5cdFx0XHRcdGNhc2UgJyAnOlxyXG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG5cdFx0XHRcdFx0dGhpcy5zaG93X3BhbmVsKCB0YWIuZ2V0QXR0cmlidXRlKCAnYXJpYS1jb250cm9scycgKSwgdGFiICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTW91c2UgaW50ZXJhY3Rpb24gZm9yIHRhYnMgKGRlbGVnYXRlZCBvbiB0YWJsaXN0IGVsZW1lbnQpLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge01vdXNlRXZlbnR9IGVcclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRfb25fY2xpY2soZSkge1xyXG5cdFx0XHRjb25zdCB0YWIgPSBlLnRhcmdldCAmJiBlLnRhcmdldC5jbG9zZXN0ICYmIGUudGFyZ2V0LmNsb3Nlc3QoICdbcm9sZT1cInRhYlwiXScgKTtcclxuXHRcdFx0aWYgKCAhdGFiICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0XHRjb25zdCBwYW5lbF9pZCA9IHRhYi5nZXRBdHRyaWJ1dGUoICdhcmlhLWNvbnRyb2xzJyApO1xyXG5cdFx0XHRpZiAoIHBhbmVsX2lkICkge1xyXG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcclxuXHRcdFx0XHR0aGlzLnNob3dfcGFuZWwoIHBhbmVsX2lkLCB0YWIgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogUHJvZ3JhbW1hdGljIHN3aXRjaGluZyB2aWEgQ3VzdG9tRXZlbnQgbGlzdGVuZWQgb24gZG9jdW1lbnQ6XHJcblx0XHQgKiAgZGV0YWlsID0geyBwYW5lbF9pZDogc3RyaW5nLCB0YWJfZWw/OiBIVE1MRWxlbWVudCwgdGFiX2lkPzogc3RyaW5nLCB0YWJfc2VsZWN0b3I/OiBzdHJpbmcgfVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwcml2YXRlXHJcblx0XHQgKiBAcGFyYW0ge0N1c3RvbUV2ZW50fSBlXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0X29uX3Nob3dfcGFuZWxfZXZ0KGUpIHtcclxuXHRcdFx0Y29uc3QgZGV0YWlsICAgPSAoZSAmJiBlLmRldGFpbCkgfHwge307XHJcblx0XHRcdGNvbnN0IHBhbmVsX2lkID0gZGV0YWlsLnBhbmVsX2lkO1xyXG5cdFx0XHRjb25zdCB0YWJfZWwgICA9IGRldGFpbC50YWJfZWxcclxuXHRcdFx0XHR8fCAoZGV0YWlsLnRhYl9pZCA/IGQuZ2V0RWxlbWVudEJ5SWQoIGRldGFpbC50YWJfaWQgKSA6IG51bGwpXHJcblx0XHRcdFx0fHwgKGRldGFpbC50YWJfc2VsZWN0b3IgPyBkLnF1ZXJ5U2VsZWN0b3IoIGRldGFpbC50YWJfc2VsZWN0b3IgKSA6IG51bGwpO1xyXG5cclxuXHRcdFx0aWYgKCBwYW5lbF9pZCApIHtcclxuXHRcdFx0XHR0aGlzLnNob3dfcGFuZWwoIHBhbmVsX2lkLCB0YWJfZWwgfHwgdW5kZWZpbmVkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIEJvb3Qgb25jZSBET00gaXMgcmVhZHkuXHJcblx0Y29uc3QgaW5zdGFuY2UgPSBuZXcgV1BCQ19CRkJfUmlnaHRiYXJfVGFicygpO1xyXG5cdGlmICggZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRkLmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgKCkgPT4gaW5zdGFuY2UuaW5pdCgpICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGluc3RhbmNlLmluaXQoKTtcclxuXHR9XHJcblxyXG5cdC8vIChPcHRpb25hbCkgZXhwb3NlIGZvciBkZWJ1Z2dpbmc6XHJcblx0Ly8gdy5XUEJDX0JGQl9SaWdodGJhcl9UYWJzID0gaW5zdGFuY2U7XHJcblxyXG59KSggd2luZG93LCBkb2N1bWVudCApO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLENBQUMsVUFBVUEsQ0FBQyxFQUFFQyxDQUFDLEVBQUU7RUFDaEIsWUFBWTs7RUFFWixNQUFNQyxJQUFJLEdBQUlGLENBQUMsQ0FBQ0csYUFBYSxJQUFJLENBQUMs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

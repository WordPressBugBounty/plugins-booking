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

	const Core  = w.WPBC_BFB_Core || {};
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
			const def               = {
				panels : '.wpbc_bfb__palette_panel',
				tablist: '.wpbc_bfb__rightbar_tabs[role="tablist"]'
			};
			this.selectors          = Object.assign( {}, def, opts.selectors || {} );
			this._on_keydown        = this._on_keydown.bind( this );
			this._on_click          = this._on_click.bind( this );
			this._on_show_panel_evt = this._on_show_panel_evt.bind( this );
			this._tablists          = [];
		}

		/**
		 * Attach DOM listeners to each tablist container and perform initial ARIA sync.
		 * Keyboard & mouse handlers are scoped to the tablist(s) for easier debugging.
		 *
		 * @returns {void}
		 */
		init() {
			this._tablists = Array.from( d.querySelectorAll( this.selectors.tablist ) );
			this._tablists.forEach( (list) => {
				list.addEventListener( 'keydown', this._on_keydown, true );
				list.addEventListener( 'click', this._on_click, false );
			} );
			// Programmatic switching kept on document for back-compat with existing dispatches.
			d.addEventListener( 'wpbc_bfb:show_panel', this._on_show_panel_evt );

			this.sync_initial_aria();
		}

		/**
		 * Remove listeners attached in {@link init}.
		 *
		 * @returns {void}
		 */
		destroy() {
			this._tablists.forEach( (list) => {
				list.removeEventListener( 'keydown', this._on_keydown, true );
				list.removeEventListener( 'click', this._on_click, false );
			} );
			this._tablists = [];
			d.removeEventListener( 'wpbc_bfb:show_panel', this._on_show_panel_evt );
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
			const panel = d.getElementById( panel_id );
			if ( ! panel ) {
				console.warn( '[WPBC] Panel not found:', panel_id );
				return;
			}

			this._hide_all_panels();
			panel.removeAttribute( 'hidden' );
			panel.setAttribute( 'aria-hidden', 'false' );

			const tab = tab_el || this._get_tab_for_panel( panel_id );
			if ( ! tab ) {
				return;
			}

			const tablist = tab.closest( '[role="tablist"]' ) || d.querySelector( this.selectors.tablist );
			if ( ! tablist ) {
				return;
			}

			tablist.querySelectorAll( '[role="tab"]' ).forEach( (t) => t.setAttribute( 'aria-selected', 'false' ) );
			tab.setAttribute( 'aria-selected', 'true' );

			// Fire a hook when a panel changes.
			d.dispatchEvent( new CustomEvent( 'wpbc_bfb:panel_shown', { detail: { panel_id, tab_el: tab } } ) );
		}

		/**
		 * Ensure a consistent initial ARIA state:
		 * - If a panel is already visible, mark it and its controlling tab as active.
		 * - Otherwise, reveal the first panel and mark its tab selected.
		 *
		 * @returns {void}
		 */
		sync_initial_aria() {
			const visible = d.querySelector( `${this.selectors.panels}:not([hidden])` );
			if ( visible ) {
				visible.setAttribute( 'aria-hidden', 'false' );
				const labelled_by = visible.getAttribute( 'aria-labelledby' );
				const tab         = labelled_by ? d.getElementById( labelled_by ) : this._get_tab_for_panel( visible.id );
				if ( tab ) {
					const tablist = tab.closest( '[role="tablist"]' ) || d.querySelector( this.selectors.tablist );
					if ( tablist ) {
						tablist.querySelectorAll( '[role="tab"]' ).forEach( (t) => t.setAttribute( 'aria-selected', 'false' ) );
					}
					tab.setAttribute( 'aria-selected', 'true' );
				}
				return;
			}
			const first = d.querySelector( this.selectors.panels );
			if ( first ) {
				first.removeAttribute( 'hidden' );
				first.setAttribute( 'aria-hidden', 'false' );
				const labelled_by = first.getAttribute( 'aria-labelledby' );
				const tab         = labelled_by ? d.getElementById( labelled_by ) : this._get_tab_for_panel( first.id );
				if ( tab ) {
					const tablist = tab.closest( '[role="tablist"]' ) || d.querySelector( this.selectors.tablist );
					if ( tablist ) tablist.querySelectorAll( '[role="tab"]' ).forEach( (t) => t.setAttribute( 'aria-selected', 'false' ) );
					tab.setAttribute( 'aria-selected', 'true' );
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
			return Array.from( d.querySelectorAll( this.selectors.panels ) );
		}

		/**
		 * Hide every panel (set `hidden` and `aria-hidden="true"`).
		 *
		 * @private
		 * @returns {void}
		 */
		_hide_all_panels() {
			this._panels().forEach( (p) => {
				p.setAttribute( 'hidden', 'true' );
				p.setAttribute( 'aria-hidden', 'true' );
			} );
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
			const esc = (val) => {
				if ( Sanit && typeof Sanit.esc_attr_value_for_selector === 'function' ) {
					return Sanit.esc_attr_value_for_selector( val );
				}
				return String( val )
					.replace( /\\/g, '\\\\' )
					.replace( /"/g, '\\"' )
					.replace( /\n/g, '\\A ' )
					.replace( /\]/g, '\\]' );
			};
			return d.querySelector( `[role="tab"][aria-controls="${esc( panel_id )}"]` );
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
			const tab = e.target && e.target.closest && e.target.closest( '[role="tab"]' );
			if ( !tab ) return;

			const list = tab.closest( '[role="tablist"]' );
			if ( ! list ) {
				return;
			}
			const tabs  = Array.from( list.querySelectorAll( '[role="tab"]' ) );
			const idx   = tabs.indexOf( tab );
			const focus = (i) => {
				if ( tabs[i] ) tabs[i].focus();
			};

			switch ( e.key ) {
				case 'ArrowRight':
				case 'ArrowDown':
					e.preventDefault();
					focus( (idx + 1) % tabs.length );
					break;
				case 'ArrowLeft':
				case 'ArrowUp':
					e.preventDefault();
					focus( (idx - 1 + tabs.length) % tabs.length );
					break;
				case 'Home':
					e.preventDefault();
					focus( 0 );
					break;
				case 'End':
					e.preventDefault();
					focus( tabs.length - 1 );
					break;
				case 'Enter':
				case ' ':
					e.preventDefault();
					this.show_panel( tab.getAttribute( 'aria-controls' ), tab );
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
			const tab = e.target && e.target.closest && e.target.closest( '[role="tab"]' );
			if ( !tab ) {
				return;
			}
			const panel_id = tab.getAttribute( 'aria-controls' );
			if ( panel_id ) {
				e.preventDefault();
				this.show_panel( panel_id, tab );
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
			const detail   = (e && e.detail) || {};
			const panel_id = detail.panel_id;
			const tab_el   = detail.tab_el
				|| (detail.tab_id ? d.getElementById( detail.tab_id ) : null)
				|| (detail.tab_selector ? d.querySelector( detail.tab_selector ) : null);

			if ( panel_id ) {
				this.show_panel( panel_id, tab_el || undefined );
			}
		}
	}

	// Boot once DOM is ready.
	const instance = new WPBC_BFB_Rightbar_Tabs();
	if ( d.readyState === 'loading' ) {
		d.addEventListener( 'DOMContentLoaded', () => instance.init() );
	} else {
		instance.init();
	}

	// (Optional) expose for debugging:
	// w.WPBC_BFB_Rightbar_Tabs = instance;

})( window, document );

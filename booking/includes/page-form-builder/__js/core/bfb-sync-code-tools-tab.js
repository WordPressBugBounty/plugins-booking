// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/__js/core/bfb-sync-code-tools-tab.js   | 2026-04-06 | 16:38
// ---------------------------------------------------------------------------------------------------------------------
(function ( w, d ) {
	'use strict';

	/**
	 * Dispatch request to show a right sidebar panel.
	 *
	 * @param {string} panel_id
	 * @param {string} tab_id
	 *
	 * @return {void}
	 */
	function wpbc_bfb__dispatch_show_panel( panel_id, tab_id ) {

		var event_detail;

		if ( ! panel_id || ! tab_id ) {
			return;
		}

		event_detail = {
			panel_id: panel_id,
			tab_id  : tab_id
		};

		if ( typeof w.wpbc_bfb__dispatch_event_safe === 'function' ) {
			w.wpbc_bfb__dispatch_event_safe( 'wpbc_bfb:show_panel', event_detail );
			return;
		}

		d.dispatchEvent(
			new CustomEvent(
				'wpbc_bfb:show_panel',
				{
					detail: event_detail
				}
			)
		);
	}

	/**
	 * Sync right sidebar with top mode tabs.
	 *
	 * Uses top tabs nav attribute `data-active-tab` as the source of truth.
	 * This avoids false detection on initial page load, because top panels are
	 * hidden by inline style `display:none`, not by the `hidden` attribute.
	 */
	class WPBC_BFB_Mode_Rightbar_Sync {

		constructor() {
			this.top_tabs_nav      = null;
			this.advanced_tab_wrap = null;
			this.advanced_panel    = null;
			this.mutation_observer = null;
			this.last_mode         = '';
			this.sync_rightbar_mode = this.sync_rightbar_mode.bind( this );
			this.handle_click      = this.handle_click.bind( this );
		}

		/**
		 * Init controller.
		 *
		 * @return {void}
		 */
		init() {
			this.top_tabs_nav      = d.getElementById( 'wpbc_bfb__top_horisontal_nav' );
			this.advanced_tab_wrap = d.querySelector( '.wpbc_bfb__rightbar_tab_wrap--advanced_tools' );
			this.advanced_panel    = d.getElementById( 'wpbc_bfb__inspector_advanced_tools' );

			if ( ! this.advanced_tab_wrap || ! this.advanced_panel ) {
				return;
			}

			// Observe active tab changes in the top tabs nav.
			if ( this.top_tabs_nav ) {
				this.mutation_observer = new MutationObserver( this.sync_rightbar_mode );
				this.mutation_observer.observe(
					this.top_tabs_nav,
					{
						attributes     : true,
						attributeFilter: [ 'data-active-tab' ]
					}
				);
			}

			// Fallback for click-driven switching.
			d.addEventListener( 'click', this.handle_click, true );

			// Initial sync.
			this.sync_rightbar_mode();
		}

		/**
		 * Get active top tab id.
		 *
		 * Priority:
		 * 1. data-active-tab from top tabs nav
		 * 2. active CSS class in nav
		 * 3. visible top panel fallback
		 *
		 * @return {string}
		 */
		get_active_top_tab_id() {
			var active_tab_id = '';
			var active_link   = null;
			var advanced_panel = null;
			var builder_panel  = null;

			if ( this.top_tabs_nav ) {
				active_tab_id = String( this.top_tabs_nav.getAttribute( 'data-active-tab' ) || '' ).trim();
				if ( '' !== active_tab_id ) {
					return active_tab_id;
				}

				active_link = this.top_tabs_nav.querySelector( '.wpbc_ui_el__horis_nav_item.active [data-wpbc-bfb-tab]' );
				if ( active_link ) {
					active_tab_id = String( active_link.getAttribute( 'data-wpbc-bfb-tab' ) || '' ).trim();
					if ( '' !== active_tab_id ) {
						return active_tab_id;
					}
				}
			}

			// Final fallback: detect visible panel.
			advanced_panel = d.querySelector( '.wpbc_bfb__top_tab_section__advanced_tab' );
			builder_panel  = d.querySelector( '.wpbc_bfb__top_tab_section__builder_tab' );

			if ( this.is_element_visible( advanced_panel ) ) {
				return 'advanced_tab';
			}
			if ( this.is_element_visible( builder_panel ) ) {
				return 'builder_tab';
			}

			return '';
		}

		/**
		 * Check element visibility.
		 *
		 * @param {HTMLElement|null} el
		 *
		 * @return {boolean}
		 */
		is_element_visible( el ) {
			var style;

			if ( ! el ) {
				return false;
			}

			style = w.getComputedStyle( el );

			if ( ! style ) {
				return false;
			}

			if ( 'none' === style.display ) {
				return false;
			}

			if ( 'hidden' === style.visibility ) {
				return false;
			}

			return true;
		}

		/**
		 * Check if Advanced Mode is active.
		 *
		 * @return {boolean}
		 */
		is_advanced_mode_active() {
			return ( 'advanced_tab' === this.get_active_top_tab_id() );
		}

		/**
		 * Show Code Tools tab button.
		 *
		 * @return {void}
		 */
		show_advanced_tools_tab() {
			this.advanced_tab_wrap.removeAttribute( 'hidden' );
			this.advanced_tab_wrap.setAttribute( 'aria-hidden', 'false' );
		}

		/**
		 * Hide Code Tools tab button.
		 *
		 * @return {void}
		 */
		hide_advanced_tools_tab() {
			this.advanced_tab_wrap.setAttribute( 'hidden', 'true' );
			this.advanced_tab_wrap.setAttribute( 'aria-hidden', 'true' );
		}

		/**
		 * Check if Code Tools panel is currently active.
		 *
		 * @return {boolean}
		 */
		is_advanced_tools_panel_active() {
			return !! ( this.advanced_panel && ! this.advanced_panel.hasAttribute( 'hidden' ) );
		}

		/**
		 * Open Code Tools panel.
		 *
		 * @return {void}
		 */
		open_advanced_tools_panel() {
			wpbc_bfb__dispatch_show_panel( 'wpbc_bfb__inspector_advanced_tools', 'wpbc_tab_advanced_tools' );
		}

		/**
		 * Open default builder rightbar panel.
		 *
		 * @return {void}
		 */
		open_default_visual_panel() {
			wpbc_bfb__dispatch_show_panel( 'wpbc_bfb__palette_add_new', 'wpbc_tab_library' );
		}

		/**
		 * Sync rightbar mode with top tabs mode.
		 *
		 * @return {void}
		 */
		sync_rightbar_mode() {
			var is_advanced_mode = this.is_advanced_mode_active();

			if ( is_advanced_mode ) {
				this.show_advanced_tools_tab();

				if ( 'advanced' !== this.last_mode ) {
					this.open_advanced_tools_panel();
				}

				this.last_mode = 'advanced';
				return;
			}

			if ( this.is_advanced_tools_panel_active() ) {
				this.open_default_visual_panel();
			}

			this.hide_advanced_tools_tab();
			this.last_mode = 'builder';
		}

		/**
		 * Fallback click handler for top tabs.
		 *
		 * @param {Event} event
		 *
		 * @return {void}
		 */
		handle_click( event ) {
			var target = event.target.closest( '[data-wpbc-bfb-tab]' );
			var this_obj = this;

			if ( ! target ) {
				return;
			}

			setTimeout(
				function () {
					this_obj.sync_rightbar_mode();
				},
				0
			);
		}
	}

	if ( d.readyState === 'loading' ) {
		d.addEventListener(
			'DOMContentLoaded',
			function () {
				( new WPBC_BFB_Mode_Rightbar_Sync() ).init();
			}
		);
	} else {
		( new WPBC_BFB_Mode_Rightbar_Sync() ).init();
	}

})( window, document );
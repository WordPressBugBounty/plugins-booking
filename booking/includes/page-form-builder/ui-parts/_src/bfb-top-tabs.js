/**
 * @file ../includes/page-form-builder/ui-parts/_src/bfb-top-tabs.js
 * Tabs switcher (scoped by nav attributes):
 * - data-wpbc-bfb-tabs-nav="1"
 * - data-active-tab="..."
 * - data-wpbc-bfb-panels-root="#selector" (optional)
 * - data-wpbc-bfb-panel-class="base_class" (optional)
 *
 * Panels:
 * - .{base_class}
 * - .{base_class}__{tab_id}
 */
(function (w, d) {
	'use strict';

	function closest_nav(el) {
		return (el && el.closest) ? el.closest( '[data-wpbc-bfb-tabs-nav="1"]' ) : null;
	}

	function get_panels_root(nav) {
		var sel = nav ? String( nav.getAttribute( 'data-wpbc-bfb-panels-root' ) || '' ).trim() : '';
		if ( sel ) {
			try {
				var root = d.querySelector( sel );
				if ( root ) {
					return root;
				}
			} catch ( e ) {}
		}
		return d;
	}

	function get_panel_base_class(nav) {
		var base = nav ? String( nav.getAttribute( 'data-wpbc-bfb-panel-class' ) || '' ).trim() : '';
		return base ? base : 'wpbc_bfb__tab_section';
	}

	function emit_change(nav, tab_id, prev_tab_id) {
		var nav_id = (nav && nav.id) ? String(nav.id) : '';
		try {
			d.dispatchEvent(
				new CustomEvent('wpbc:bfb:top-tab', {
					detail: {
						tab     : tab_id,
						prev_tab: prev_tab_id || '',
						nav_id  : nav_id
					}
				})
			);
		} catch (e) {}
	}

	function set_active_menu_item(nav, tab_id) {
		var items = nav.querySelectorAll( '.wpbc_ui_el__horis_nav_item' );
		for ( var i = 0; i < items.length; i++ ) {
			items[i].classList.remove( 'active' );
		}
		var active = nav.querySelector( '.wpbc_ui_el__horis_nav_item__' + tab_id );
		if ( active ) {
			active.classList.add( 'active' );
		}
	}

	// --- update activate() to capture prev tab ---
	function activate(nav, tab_id) {
		if (!nav || !tab_id) return;

		tab_id = String(tab_id).trim();
		if (!tab_id) return;

		var root = get_panels_root(nav);
		var base = get_panel_base_class(nav);

		var active_panel = root.querySelector('.' + base + '__' + tab_id);
		if (!active_panel) return;

		var prev_tab_id = String(nav.getAttribute('data-active-tab') || '').trim();   // NEW

		nav.setAttribute('data-active-tab', tab_id);

		var panels = root.querySelectorAll('.' + base);
		for (var i = 0; i < panels.length; i++) {
			panels[i].style.display = 'none';
		}
		active_panel.style.display = '';

		set_active_menu_item(nav, tab_id);

		emit_change(nav, tab_id, prev_tab_id);                                       // NEW
	}

	// TODO listen for the loading tab on first  initial  load  and depends from  the "bfb_options":{"advanced_mode_source":"builder"}  set  active specific tab: builder or advanced.

	// Click handler (delegated).
	d.addEventListener( 'click', function (ev) {
		var link = (ev.target && ev.target.closest) ? ev.target.closest( '[data-wpbc-bfb-action="panel"][data-wpbc-bfb-tab]' ) : null;
		if ( ! link ) {
			return;
		}

		var nav = closest_nav( link );
		if ( ! nav ) {
			return;
		}

		ev.preventDefault();
		activate( nav, link.getAttribute( 'data-wpbc-bfb-tab' ) );
	} );

	// Init all nav containers on load.
	d.addEventListener( 'DOMContentLoaded', function () {
		var navs = d.querySelectorAll( '[data-wpbc-bfb-tabs-nav="1"]' );

		for ( var i = 0; i < navs.length; i++ ) {
			var nav = navs[i];

			// Use data-active-tab if valid, otherwise fallback to first panel tab link.
			var tab_id = String( nav.getAttribute( 'data-active-tab' ) || '' ).trim();

			if ( tab_id ) {
				activate( nav, tab_id );
				continue;
			}

			var first_link = nav.querySelector( '[data-wpbc-bfb-action="panel"][data-wpbc-bfb-tab]' );
			if ( first_link ) {
				activate( nav, first_link.getAttribute( 'data-wpbc-bfb-tab' ) );
			}
		}
	} );

})( window, document );

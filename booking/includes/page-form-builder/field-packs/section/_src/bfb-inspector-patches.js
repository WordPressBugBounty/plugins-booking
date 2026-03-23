/**
 * Inspector Patches / Glue for Section:
 * ---------------------------------------------------------------------------------
 * 1) Prevent full re-render when changing "columns" for .wpbc_bfb__section
 * 2) Bind inspector to:
 *    - Mount "layout_chips" slot
 *    - Keep numeric "columns" input stable & debounced
 *    - Observe live DOM column changes and sync inspector
 *    - Mount/refresh "column_styles" slot exposed by UI.wpbc_bfb_column_styles
 *
 * == File: /includes/page-form-builder/field-packs/section/_out/bfb-inspector-patches.js
 *
 * @since     11.0.0
 * @modified  2025-09-16 11:26
 * @version   1.0.0
 */
(function ( w ) {
	'use strict';

	var Core = ( w.WPBC_BFB_Core = w.WPBC_BFB_Core || {} );
	var UI   = ( Core.UI = Core.UI || {} );

	var H   = Core.WPBC_Form_Builder_Helper || {};
	var DOM = ( Core.WPBC_BFB_DOM && Core.WPBC_BFB_DOM.SELECTORS ) || {
		row    : '.wpbc_bfb__row',
		column : '.wpbc_bfb__column'
	};

	/**
	 * Read actual number of columns from DOM.
	 *
	 * @param {HTMLElement} el
	 * @returns {number}
	 */
	function dom_cols( el ) {
		try {
			var row = el ? el.querySelector( ':scope > ' + DOM.row ) : null;
			var cnt = row ? row.querySelectorAll( ':scope > ' + DOM.column ).length : 1;
			var clamp = Core.WPBC_BFB_Sanitize && Core.WPBC_BFB_Sanitize.clamp ? Core.WPBC_BFB_Sanitize.clamp : function ( n, a, b ) { return Math.max( a, Math.min( b, n ) ); };
			return clamp( Number( cnt ) || 1, 1, 4 );
		} catch ( _e ) {
			return 1;
		}
	}

	/**
	 * Observe column DOM changes to keep inspector inputs in sync.
	 *
	 * @param {object}      builder
	 * @param {HTMLElement} section_el
	 * @param {HTMLElement} inspector_root
	 * @returns {Function}  disconnect
	 */
	function observe_cols( builder, section_el, inspector_root ) {
		var row = section_el && section_el.querySelector( ':scope > ' + DOM.row );
		if ( ! row ) { return function () {}; }

		var input = inspector_root && inspector_root.querySelector( 'input[data-inspector-key="columns"]' );
		var mo = new MutationObserver( function () {
			var cnt = dom_cols( section_el );
			if ( input && input.value !== String( cnt ) ) {
				input.value = String( cnt );
				// Fire an input event so len-control syncs the slider too.
				try { input.dispatchEvent( new Event('input', { bubbles: true }) ); } catch (_e) {}
			}
			inspector_root && inspector_root.setAttribute( 'data-bfb-section-cols', String( cnt ) );
			section_el.dataset.columns = String( cnt );

			// Also refresh column styles if present.
			if ( UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.refresh_for_section === 'function' ) {
				UI.wpbc_bfb_column_styles.refresh_for_section( builder, section_el, inspector_root );
			}
		} );
		try { mo.observe( row, { childList : true } ); } catch ( _err ) {}
		return function unobserve() { try { mo.disconnect(); } catch ( _e ) {} };
	}

	/**
	 * Ensure host for layout chips stays stable.
	 *
	 * @param {HTMLElement} inspector_root
	 * @returns {HTMLElement|null}
	 */
	function ensure_chips_host( inspector_root ) {
		if ( ! inspector_root ) { return null; }
		var host = inspector_root.querySelector( '[data-bfb-slot="layout_chips"]' )
			|| inspector_root.querySelector( '.inspector__row--layout-chips .wpbc_bfb__layout_chips' )
			|| inspector_root.querySelector( '#wpbc_bfb__layout_chips_host' );
		if ( host ) {
			host.classList.add( 'wpbc_bfb__layout_chips' );
			host.setAttribute( 'data-bfb-slot', 'layout_chips' );
		}
		return host;
	}

	/**
	 * Render layout chips into inspector, if available.
	 *
	 * @param {object}      builder
	 * @param {HTMLElement} section_el
	 * @param {HTMLElement} inspector_root
	 */
	function render_chips_into_inspector( builder, section_el, inspector_root ) {
		if ( ! UI.WPBC_BFB_Layout_Chips || typeof UI.WPBC_BFB_Layout_Chips.render_for_section !== 'function' ) { return; }
		var host = ensure_chips_host( inspector_root );
		if ( ! host ) { return; }
		host.innerHTML = '';
		UI.WPBC_BFB_Layout_Chips.render_for_section( builder, section_el, host );
	}

	// ------------------------------------------------------------------------------------------------
	// 1) Patch: prevent full re-render for columns change (section only)
	// ------------------------------------------------------------------------------------------------
	(function patch_no_rerender_for_columns() {
		var Inspector = w.WPBC_BFB_Inspector;
		if ( ! Inspector || Inspector.__wpbc_no_rerender_columns ) { return; }
		Inspector.__wpbc_no_rerender_columns = true;

		var orig = Inspector.prototype._needs_rerender;
		Inspector.prototype._needs_rerender = function ( el, key, e ) {
			if ( el && el.classList && el.classList.contains( 'wpbc_bfb__section' ) && key === 'columns' ) {
				return false;
			}
			return ( typeof orig === 'function' ) ? orig.call( this, el, key, e ) : false;
		};
	})();

	// ------------------------------------------------------------------------------------------------
	// 2) Patch: extend Inspector.bind_to_field to wire chips + columns input + column styles slot
	// ------------------------------------------------------------------------------------------------
	function patch_inspector_bind_once() {
		var Inspector = w.WPBC_BFB_Inspector;
		if ( ! Inspector || Inspector.__wpbc_section_bind_patched ) { return; }
		if ( ! Inspector.prototype || ! Inspector.prototype.bind_to_field ) { return; }
		Inspector.__wpbc_section_bind_patched = true;

		var orig_bind = Inspector.prototype.bind_to_field;

		Inspector.prototype.bind_to_field = function ( el ) {
			orig_bind.call( this, el );

			try {
				var ins     = this.panel || document.getElementById( 'wpbc_bfb__inspector' ) || document.querySelector( '.wpbc_bfb__inspector' );
				var builder = this.builder || w.wpbc_bfb || null;
				if ( ! ins || ! builder || !( el && el.classList && el.classList.contains( 'wpbc_bfb__section' ) ) ) { return; }


				// Layout chips.
				render_chips_into_inspector( builder, el, ins );

				// Stable numeric "columns" input behavior.
				var input = ins.querySelector( 'input[data-inspector-key="columns"]' );
				if ( input && ! input.__wpbc_cols_hooked ) {
					input.__wpbc_cols_hooked = true;
					input.value = String( dom_cols( el ) );

					var apply_change = function () {
						var desired = ( Core.WPBC_BFB_Sanitize && Core.WPBC_BFB_Sanitize.clamp )
							? Core.WPBC_BFB_Sanitize.clamp( input.value | 0, 1, 4 )
							: Math.max( 1, Math.min( 4, Number( input.value ) || 1 ) );
						var current = dom_cols( el );
						if ( desired === current ) { return; }

						if ( typeof builder.set_section_columns === 'function' ) {
							builder.set_section_columns( el, desired );
						}
						el.dataset.columns = String( desired );
						ins.setAttribute( 'data-bfb-section-cols', String( desired ) );

						// Refresh column styles UI on column count change.
						if ( UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.refresh_for_section === 'function' ) {
							UI.wpbc_bfb_column_styles.refresh_for_section( builder, el, ins );
						}
					};

					var debounced = ( H && H.debounce ) ? H.debounce( apply_change, 120 ) : apply_change;
					input.addEventListener( 'input', debounced );
					input.addEventListener( 'change', apply_change );
				}

				// Observe DOM changes in columns (sync inspector).
				if ( this.__wpbc_cols_unobserve ) {
					try { this.__wpbc_cols_unobserve(); } catch ( _e ) {}
					this.__wpbc_cols_unobserve = null;
				}
				this.__wpbc_cols_unobserve = observe_cols( builder, el, ins );

				// Mount reusable "column_styles" slot into the inspector, if available.
				if ( UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.render_for_section === 'function' ) {
					UI.wpbc_bfb_column_styles.render_for_section( builder, el, ins.querySelector( '[data-bfb-slot="column_styles"]' ) );
				}

				// Keep both slots fresh on structure events.
				var EV = Core.WPBC_BFB_Events || {};
				var refresh = () => {
					var cur = builder.get_selected_field && builder.get_selected_field();
					if ( ! cur || ! cur.classList || ! cur.classList.contains( 'wpbc_bfb__section' ) ) { return; }
					render_chips_into_inspector( builder, cur, ins );
					if ( UI && UI.wpbc_bfb_column_styles && typeof UI.wpbc_bfb_column_styles.refresh_for_section === 'function' ) {
						UI.wpbc_bfb_column_styles.refresh_for_section( builder, cur, ins );
					}
					var c = dom_cols( cur );
					ins.setAttribute( 'data-bfb-section-cols', String( c ) );
					var inp = ins.querySelector( 'input[data-inspector-key="columns"]' );
					if ( inp ) { inp.value = String( c ); }
				};

				if ( ! this.__wpbc_cols_bus_hooked && builder.bus ) {
					this.__wpbc_cols_bus_hooked = true;
					builder.bus.on && builder.bus.on( EV.FIELD_ADD,         refresh );
					builder.bus.on && builder.bus.on( EV.FIELD_REMOVE,      refresh );
					builder.bus.on && builder.bus.on( EV.STRUCTURE_LOADED,  refresh );
					builder.bus.on && builder.bus.on( EV.STRUCTURE_CHANGE, function (ev) {
						// The bus gives a DOM CustomEvent → data is in ev.detail. But be defensive in case some callers pass a plain object.
						var d   = ev && (ev.detail || ev);
						var src = d && d.source;
						// Skip re-render when only per-column styles changed.
						if ( src === 'column_styles' || src === 'column_styles_reset' ) {
							// Optional: keep the "columns" input value in sync without re-rendering.
							try {
								var cur = builder.get_selected_field && builder.get_selected_field();
								if ( cur && cur.classList && cur.classList.contains( 'wpbc_bfb__section' ) ) {
									var c = dom_cols( cur );
									ins.setAttribute( 'data-bfb-section-cols', String( c ) );
									var inp = ins.querySelector( 'input[data-inspector-key="columns"]' );
									if ( inp ) {
										inp.value = String( c );
									}
								}
							} catch ( _e ) {}
							return;
						}
						refresh();
					} );
				}

			} catch ( e ) {
				w._wpbc && w._wpbc.dev && w._wpbc.dev.error && w._wpbc.dev.error( 'section_inspector.patch_bind', e );
			}
		};
	}

	patch_inspector_bind_once();
	document.addEventListener( 'wpbc_bfb_inspector_ready', patch_inspector_bind_once );

})( window );

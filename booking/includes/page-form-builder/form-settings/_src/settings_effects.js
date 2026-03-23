/**
 * Applies effects in Canvas, after changing some settings in the right sidebar in BFB.
 *
 * @file ../includes/page-form-builder/form-settings/_src/settings_effects.js
 */
(function (w, d) {
	'use strict';

	const Effects = (w.WPBC_BFB_Settings_Effects = w.WPBC_BFB_Settings_Effects || {});
	const map     = (Effects.map = Effects.map || Object.create( null ));

	Effects.register = function (key, fn) {
		if ( key && typeof fn === 'function' ) {
			map[String( key )] = fn;
		}
	};

	function get_canvas_root() {
		return (
			d.querySelector( '#wpbc_bfb__pages_container' ) ||
			d.querySelector( '.wpbc_bfb__panel--preview' ) ||
			d.getElementById( 'wpbc_bfb__preview' ) ||
			d.body || d.documentElement
		);
	}

	Effects.apply_one = function (key, value, ctx) {
		const fn = map[String( key )];
		if ( ! fn ) {
			return;
		}
		try {
			fn( value, Object.assign( { key, value, canvas: get_canvas_root() }, ctx || {} ) );
		} catch ( e ) {
			// keep silent in production if you prefer
			console.error( 'WPBC Effects error:', key, e );
		}
	};

	Effects.apply_all = function (options, ctx) {
		if ( ! options || typeof options !== 'object' ) {
			return;
		}
		Object.keys( options ).forEach( function (k) {
			Effects.apply_one( k, options[k], ctx );
		} );
	};

	/**
	 * Normalize settings pack to the minimum required shape:
	 * { options: {}, css_vars: {} }
	 *
	 * @param {*} pack
	 * @return {{options:Object, css_vars:Object, bfb_options?:Object}|null}
	 */
	Effects.normalize_pack = function (pack) {

		if ( pack === null || typeof pack === 'undefined' || pack === '' ) {
			return null;
		}

		// Parse JSON string if needed.
		if ( typeof pack === 'string' ) {
			try {
				pack = JSON.parse( pack );
			} catch ( _e ) {
				return null;
			}
		}

		if ( ! pack || typeof pack !== 'object' ) {
			return null;
		}

		// If user passed just {key:value} options map, wrap it.
		const has_shape =
				  Object.prototype.hasOwnProperty.call( pack, 'options' ) ||
				  Object.prototype.hasOwnProperty.call( pack, 'css_vars' ) ||
				  Object.prototype.hasOwnProperty.call( pack, 'bfb_options' );

		if ( ! has_shape ) {
			pack = { options: pack, css_vars: {} };
		}

		if ( ! pack.options || typeof pack.options !== 'object' ) {
			pack.options = {};
		}
		if ( ! pack.css_vars || typeof pack.css_vars !== 'object' ) {
			pack.css_vars = {};
		}

		// bfb_options is optional; keep if valid.
		if ( pack.bfb_options && typeof pack.bfb_options !== 'object' ) {
			delete pack.bfb_options;
		}

		return pack;
	};

	/**
	 * Re-apply settings effects after a canvas rebuild / structure load.
	 *
	 * This is needed because structure loading can replace DOM nodes that effects target.
	 *
	 * @param {*} settings_pack  string|object settings_json pack (or plain options map)
	 * @param {Object} [ctx]
	 */
	Effects.reapply_after_canvas = function (settings_pack, ctx) {

		const pack = Effects.normalize_pack( settings_pack );
		if ( ! pack ) {
			return;
		}

		// Apply immediately (best effort).
		Effects.apply_all( pack.options, Object.assign( { source: 'reapply_after_canvas' }, ctx || {} ) );

		// Some modules/hydration may run shortly after; do one more pass.
		setTimeout( function () {
			Effects.apply_all( pack.options, Object.assign( { source: 'reapply_after_canvas_delayed' }, ctx || {} ) );
		}, 60 );
	};

	// 1) Apply from AJAX load.
	d.addEventListener( 'wpbc:bfb:form_settings:apply', function (e) {
		const pack = e && e.detail ? e.detail.settings : null;
		if ( pack && pack.options ) {
			Effects.apply_all( pack.options, { source: 'apply' } );
		}
	} );

	// 2) Apply live from UI change (delegated).
	function css_escape(value) {
		const v = String( value == null ? '' : value );
		if ( w.CSS && typeof w.CSS.escape === 'function' ) {
			return w.CSS.escape( v );
		}
		return v.replace( /[^a-zA-Z0-9_\-]/g, '\\$&' );
	}

	function find_fs_root(el) {
		if ( ! el || ! el.closest ) {
			return null;
		}

		// 1) Direct: element or ancestor carries FS key (input/select/textarea writer, radio wrapper, etc.)
		const direct = el.closest( '[data-wpbc-bfb-fs-key]' );
		if ( direct ) {
			return direct;
		}

		// 2) Length: event came from number/unit/range inside .wpbc_slider_len_group
		const len_group = el.closest( '.wpbc_slider_len_group' );
		if ( len_group ) {
			return (
				len_group.querySelector( 'input[data-wpbc_slider_len_writer][data-wpbc-bfb-fs-key]' ) ||
				len_group.querySelector( 'input[data-wpbc-bfb-fs-type="length"][data-wpbc-bfb-fs-key]' ) ||
				null
			);
		}

		// 3) Range: event came from range input inside .wpbc_slider_range_group
		const range_group = el.closest( '.wpbc_slider_range_group' );
		if ( range_group ) {
			return (
				range_group.querySelector( 'input[data-wpbc_slider_range_writer][data-wpbc-bfb-fs-key]' ) ||
				range_group.querySelector( 'input[data-wpbc_slider_range_writer]' ) ||
				null
			);
		}

		return null;
	}

	function read_value_from_fs_root(fs_root, original_target) {
		if ( ! fs_root ) {
			return '';
		}

		const fs_type = String( fs_root.getAttribute( 'data-wpbc-bfb-fs-type' ) || '' );

		// RADIO: read checked within wrapper.
		if ( fs_type === 'radio' ) {
			const control_id = fs_root.getAttribute( 'data-wpbc-bfb-fs-controlid' ) || '';
			const selector   = control_id
				? 'input[type="radio"][name="' + css_escape( control_id ) + '"]:checked'
				: 'input[type="radio"]:checked';

			const checked = fs_root.querySelector( selector );
			return checked ? String( checked.value || '' ) : '';
		}

		// CHECKBOX / TOGGLE
		if ( (original_target && original_target.type === 'checkbox') || fs_root.type === 'checkbox' ) {
			const cb = (original_target && original_target.type === 'checkbox') ? original_target : fs_root;
			return cb.checked ? 'On' : 'Off';
		}

		// DEFAULT: writer/input/textarea/select
		if ( fs_root.value != null ) {
			return String( fs_root.value );
		}
		if ( original_target && original_target.value != null ) {
			return String( original_target.value );
		}

		return '';
	}

	function on_change(ev) {
		// Ignore events dispatched by code (apply/reapply, slider sync, etc.). Effects should react only to real user input + explicit wpbc:bfb:form_settings:apply.
		if ( ev && ev.isTrusted === false ) { return; }
		const target = ev && ev.target;
		if ( ! target ) { return; }

		const fs_root = find_fs_root( target );
		if ( ! fs_root ) { return; }


		// Normalize events so each control produces exactly one effect call.
		// - toggle/select/radio/checkbox => "change" only.
		// - everything else              => "input" only.
		const fs_type = String( fs_root.getAttribute( 'data-wpbc-bfb-fs-type' ) || '' );
		const tag     = String( target.tagName || '' ).toLowerCase();
		const type    = String( target.type || '' ).toLowerCase();

		const use_change = (fs_type === 'toggle') || (fs_type === 'select') || (fs_type === 'radio') || (type === 'checkbox') || (type === 'radio') || (tag === 'select');

		if ( use_change && ev.type !== 'change' ) { return; }
		if ( ! use_change && ev.type !== 'input' ) { return; }
		// -------------------------------------------------------------------------------------------

		const key = fs_root.getAttribute( 'data-wpbc-bfb-fs-key' );
		if ( ! key ) { return; }

		const scope = fs_root.getAttribute( 'data-wpbc-bfb-fs-scope' ) || '';
		const value = read_value_from_fs_root( fs_root, target );

		Effects.apply_one( key, value, { source: 'ui', scope: scope, control: target, fs_root: fs_root } );
	}

	d.addEventListener( 'input', on_change, false );
	d.addEventListener( 'change', on_change, false );

})( window, document );


// BOOKING_FORM_THEME.
WPBC_BFB_Settings_Effects.register( 'booking_form_theme', function (value, ctx) {
	// const root = ctx.canvas;
	const root = document.getElementById( 'wpbc_bfb__theme_scope' );
	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	// const wraps = root.querySelectorAll( '.wpbc_container.wpbc_form' );
	const wraps = root.querySelectorAll( '.wpbc_bfb__pages_panel' );
	if ( ! wraps.length ) {
		return;
	}

	wraps.forEach( function (wrap) {
		// remove any previous theme classes (simple + future-proof).
		Array.from( wrap.classList ).forEach( function (cls) {
			if ( /^wpbc_theme_/.test( cls ) ) {
				wrap.classList.remove( cls );
			}
		} );

		if ( value ) {
			wrap.classList.add( String( value ) );
		}
	} );
} );


// BOOKING_FORM_LAYOUT_WIDTH — Form width: applies combined "100%" / "600px" / "40rem" to the booking form containers.
WPBC_BFB_Settings_Effects.register( 'booking_form_layout_width', function (value, ctx) {
	const root = ctx && ctx.canvas;
	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	const wraps = root.querySelectorAll( '.wpbc_bfb__form_preview_section_container' );
	if ( ! wraps.length ) {
		return;
	}

	const v = String( value == null ? '' : value ).trim();

	// allow only "number + unit".
	if ( v && ! /^-?\d+(?:\.\d+)?(?:%|px|rem|em|vw|vh)$/.test( v ) ) {
		return;
	}

	wraps.forEach(
		function (wrap) {
			if ( ! wrap || ! wrap.style ) {
				return;
			}

			if ( ! v ) {
				wrap.style.removeProperty( '--wpbc-bfb-booking_form_layout_width' );
			} else {
				wrap.style.setProperty( '--wpbc-bfb-booking_form_layout_width', v );
			}
		}
	);
} );


// Debug Preview Mode.
WPBC_BFB_Settings_Effects.register( 'booking_bfb_preview_mode', function (value, ctx) {
	const root = ctx.canvas;
	if ( ! root || ! root.querySelectorAll ) {
		return;
	}

	const wraps = root.querySelectorAll( '.wpbc_container.wpbc_form' );
	if ( ! wraps.length ) {
		return;
	}

	// Get builder async.
	wpbc_bfb_api.with_builder(
		function (Builder) {

			/**
			 * Capture active right sidebar tab and return restore handle.
			 *
			 * @return {{restore:function():void}|null}
			 */
			function capture_right_sidebar_active_tab_restore_handle() {

				var tablist_el = document.querySelector( '.wpbc_bfb__rightbar_tabs[role="tablist"]' );
				if ( ! tablist_el ) {
					return null;
				}

				var active_tab_el = tablist_el.querySelector( '[role="tab"][aria-selected="true"]' );

				if ( ! active_tab_el ) {
					active_tab_el = tablist_el.querySelector( '[role="tab"][aria-controls="wpbc_bfb__palette_add_new"]' );
				}

				if ( ! active_tab_el || typeof active_tab_el.click !== 'function' ) {
					return null;
				}

				return {
					restore: function () {
						try { active_tab_el.click(); } catch ( _e ) {}
					}
				};
			}

			var tab_restore_handle = capture_right_sidebar_active_tab_restore_handle();

			let restored  = false;
			var EVS      = window.WPBC_BFB_Core && window.WPBC_BFB_Core.WPBC_BFB_Events ? window.WPBC_BFB_Core.WPBC_BFB_Events : {};
			var EV_DONE  = EVS.STRUCTURE_LOADED || EVS.CANVAS_REFRESHED || 'wpbc:bfb:structure-loaded';


			function do_restore() {
				if ( restored ) { return; }
				restored = true;
				try { Builder?.bus?.off?.( EV_DONE, do_restore ); } catch ( _ ) {}
				requestAnimationFrame( function () {
					if ( ! tab_restore_handle ) { return; }
					tab_restore_handle.restore();
				} );
			}

			// Listen once (best), plus a fallback in case event isn't fired.
			try { Builder?.bus?.on?.( EV_DONE, do_restore ); } catch ( _ ) {}


			var enabled = ('On' === value);
			Builder.set_preview_mode( enabled, { rebuild: true, reinit: true, source: 'settings-effects' } );
		}
	);

} );

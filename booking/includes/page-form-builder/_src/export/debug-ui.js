/**
 * Debug UI — populate existing textareas, bind existing buttons.
 *
 * IMPORTANT:
 * - This file does NOT create any markup anymore.
 * - All blocks/textareas/buttons must exist in PHP template.
 *
 * @file: ../includes/page-form-builder/_out/export/debug-ui.js
 */
(function (w, d) {
	'use strict';

	// Prevent double init (if file is injected twice).
	if ( w.__wpbc_bfb__debug_ui_inited === '1' ) {
		return;
	}
	w.__wpbc_bfb__debug_ui_inited = '1';

	const DEBUG_PANEL_ID = 'wpbc_bfb__debug_export_panel';
	const DEBUG_TAB_SEL  = '.wpbc_bfb__tab_section__debug_tab';

	function has_debug_ui() {
		return !! ( d.getElementById( DEBUG_PANEL_ID ) || d.querySelector( DEBUG_TAB_SEL ) );
	}

	if ( ! has_debug_ui() ) {
		return;
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------------------------------------------------
	function show_message( msg, type, timeout ) {
		const m = String( msg || '' );
		const t = String( type || 'info' );

		if ( typeof w.wpbc_admin_show_message === 'function' ) {
			try {
				w.wpbc_admin_show_message( m, t, timeout || 6000 );
				return;
			} catch ( _e ) {}
		}

		// Fallback.
		if ( t === 'error' ) {
			console.error( m );
		} else {
			console.log( m );
		}
	}

	function safe_json_parse( text ) {
		const raw = String( text == null ? '' : text ).trim();
		if ( ! raw ) {
			return null;
		}
		try {
			return JSON.parse( raw );
		} catch ( e ) {
			return null;
		}
	}

	// ---------------------------
	// Safe event dispatch helper (reuse preview contract)
	// ---------------------------
	function dispatch_event_safe( event_name, detail ) {
		if ( typeof w.wpbc_bfb__dispatch_event_safe === 'function' ) {
			try {
				w.wpbc_bfb__dispatch_event_safe( event_name, detail );
				return;
			} catch ( _e ) {}
		}
		try {
			d.dispatchEvent( new CustomEvent( event_name, { detail: detail || {} } ) );
		} catch ( _e2 ) {}
	}

	function with_builder( cb ) {
		if ( w.wpbc_bfb_api && w.wpbc_bfb_api.ready && typeof w.wpbc_bfb_api.ready.then === 'function' ) {
			w.wpbc_bfb_api.ready.then( function ( b ) {
				cb( b || w.wpbc_bfb || null );
			} );
			return;
		}
		cb( w.wpbc_bfb || null );
	}

	function is_debug_tab_visible() {
		const root = d.querySelector( DEBUG_TAB_SEL );
		if ( ! root ) {
			return true;
		}
		try {
			if ( root.hasAttribute( 'hidden' ) ) {
				return false;
			}
			const aria = String( root.getAttribute( 'aria-hidden' ) || '' ).toLowerCase();
			if ( aria === 'true' ) {
				return false;
			}
		} catch ( _e ) {}
		return true;
	}

	function get_debug_panel() {
		return d.getElementById( DEBUG_PANEL_ID ) || null;
	}

	function set_value( textarea_id, value ) {
		const el = d.getElementById( textarea_id );
		if ( ! el ) {
			return;
		}
		el.value = String( value || '' );
		try {
			el.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		} catch ( _ ) {}
	}

	function set_value_if_empty( textarea_id, value ) {
		const el = d.getElementById( textarea_id );
		if ( ! el ) {
			return;
		}
		if ( String( el.value || '' ).trim() !== '' ) {
			return;
		}
		set_value( textarea_id, value );
	}

	function copy_text_to_clipboard( text, btn ) {
		const raw = String( text || '' );
		if ( ! raw ) {
			return;
		}

		if ( typeof w.wpbc_copy_to_clipboard === 'function' ) {
			try {
				const orig = btn ? String( btn.textContent || '' ) : '';
				w.wpbc_copy_to_clipboard( raw ).then(
					function ( ok ) {
						if ( ! btn ) {
							return;
						}
						btn.textContent = ok ? 'Copied!' : 'Press Ctrl/Cmd+C to copy';
						w.setTimeout( function () {
							btn.textContent = orig;
						}, 1500 );
					},
					function () {
						if ( btn ) {
							btn.textContent = 'Press Ctrl/Cmd+C to copy';
						}
					}
				);
				return;
			} catch ( _e ) {}
		}

		show_message( 'Copy helper is not available. Please copy manually.', 'info', 4000 );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Data getters
	// -----------------------------------------------------------------------------------------------------------------
	function get_current_form_name() {
		const cfg = w.WPBC_BFB_Ajax || {};
		const v   = cfg && cfg.form_name ? String( cfg.form_name ) : '';
		return v ? v : 'standard';
	}

	// ---------------------------
	// Builder structure getter
	// ---------------------------
	function get_current_structure() {
		if ( w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function' ) {
			try {
				return w.wpbc_bfb.get_structure();
			} catch ( _e ) {
				return [];
			}
		}
		return [];
	}

	// ---------------------------
	// Settings collector (reuses Preview contract)
	// ---------------------------
	function get_current_form_settings( form_name ) {
		let form_settings = { options: {}, css_vars: {} };

		dispatch_event_safe( 'wpbc:bfb:form_settings:collect', {
			settings : form_settings,
			form_name: form_name || 'standard'
		} );

		// Strict: require correct shape.
		if ( ! form_settings || typeof form_settings !== 'object' ) {
			form_settings = { options: {}, css_vars: {} };
		}
		if ( ! form_settings.options || typeof form_settings.options !== 'object' ) {
			form_settings.options = {};
		}
		if ( ! form_settings.css_vars || typeof form_settings.css_vars !== 'object' ) {
			form_settings.css_vars = {};
		}

		return form_settings;
	}

	/**
	 * Parse combined length value like "100%", "320px", "12.5rem".
	 *
	 * @param {string} value
	 * @return {{num:string, unit:string}}
	 */
	function parse_length_value( value ) {
		const raw = String( value == null ? '' : value ).trim();
		const m   = raw.match( /^\s*(-?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i );
		if ( ! m ) {
			return { num: raw, unit: '' };
		}
		return { num: ( m[1] || '' ), unit: ( m[2] || '' ) };
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Import logic (unchanged)
	// -----------------------------------------------------------------------------------------------------------------
	function normalize_imported_settings( parsed ) {

		// Accept either:
		// 1) { options:{}, css_vars:{}, bfb_options:{} }
		// 2) { options:{...} } (css_vars optional)
		// 3) { ...optionsMap... } (we wrap into {options:...})
		var out = parsed;

		if ( ! out || typeof out !== 'object' ) {
			return { options: {}, css_vars: {} };
		}

		var has_shape =
				Object.prototype.hasOwnProperty.call( out, 'options' ) ||
				Object.prototype.hasOwnProperty.call( out, 'css_vars' ) ||
				Object.prototype.hasOwnProperty.call( out, 'bfb_options' );

		if ( ! has_shape ) {
			out = { options: out, css_vars: {} };
		}

		if ( ! out.options || typeof out.options !== 'object' ) {
			out.options = {};
		}
		if ( ! out.css_vars || typeof out.css_vars !== 'object' ) {
			out.css_vars = {};
		}
		if ( out.bfb_options && typeof out.bfb_options !== 'object' ) {
			out.bfb_options = {};
		}

		return out;
	}

	/**
	 * Apply canvas effects immediately (without relying on DOM events).
	 * This fixes the case when canvas was rebuilt after settings apply.
	 *
	 * @param {Object} settings_obj Normalized settings pack {options, css_vars, ...}
	 * @param {Object} ctx
	 */
	function run_settings_effects_now( settings_obj, ctx ) {
		try {
			var eff = w.WPBC_BFB_Settings_Effects || null;
			if ( ! eff || typeof eff.apply_all !== 'function' ) {
				return;
			}
			if ( ! settings_obj || ! settings_obj.options || typeof settings_obj.options !== 'object' ) {
				return;
			}
			eff.apply_all( settings_obj.options, ctx || { source: 'debug-import' } );
		} catch ( e ) {
			console.error( 'Debug UI: run_settings_effects_now error', e );
		}
	}

	function apply_imported_settings( settings_obj ) {
		var form_name = get_current_form_name();

		// 1) Update sidebar UI + let modules react.
		dispatch_event_safe( 'wpbc:bfb:form_settings:apply', {
			settings : settings_obj,
			form_name: form_name
		} );

		// Optional hint for any listeners that want to refresh debug outputs.
		dispatch_event_safe( 'wpbc:bfb:form_settings:changed', {
			settings : settings_obj,
			form_name: form_name,
			source   : 'debug-import'
		} );

		// 2) Apply effects right away to current canvas (no rebuild yet).
		// (Even if rebuild happens later, this gives immediate feedback.)
		run_settings_effects_now( settings_obj, { source: 'debug-import-apply' } );
	}

	function apply_imported_structure( structure_arr, on_done ) {
		with_builder( function ( builder ) {
			if ( ! builder ) {
				show_message( 'Debug UI: Builder is not ready.', 'error', 8000 );
				if ( typeof on_done === 'function' ) {
					on_done( false, null );
				}
				return;
			}

			try {
				// Prefer canonical loader if present (keeps compatibility with legacy callers).
				if ( typeof w.wpbc_bfb__on_structure_loaded === 'function' ) {
					w.wpbc_bfb__on_structure_loaded( structure_arr );
				} else if ( typeof builder.load_saved_structure === 'function' ) {
					builder.load_saved_structure( structure_arr, { deferIfTyping: false } );
				} else if ( w.wpbc_bfb_api && typeof w.wpbc_bfb_api.load_structure === 'function' ) {
					w.wpbc_bfb_api.load_structure( structure_arr );
				} else {
					show_message( 'Debug UI: No structure loader found.', 'error', 8000 );
					if ( typeof on_done === 'function' ) {
						on_done( false, builder );
					}
					return;
				}

				// IMPORTANT:
				// Do NOT do rebuild:true here, because load_saved_structure() already rebuilt DOM.
				// Rebuild:true would rebuild twice and can wipe effects.
				if ( typeof builder.refresh_canvas === 'function' ) {
					builder.refresh_canvas( {
						hard   : true,
						rebuild: false,
						reinit : true,
						source : 'debug-import-structure'
					} );
				}

				if ( typeof on_done === 'function' ) {
					on_done( true, builder );
				}
			} catch ( e ) {
				show_message( 'Debug UI: Failed to apply structure. Check console.', 'error', 8000 );
				console.error( 'Debug UI apply_imported_structure error', e );
				if ( typeof on_done === 'function' ) {
					on_done( false, builder );
				}
			}
		} );
	}

	function import_from_textareas( mode ) {
		var s_text = ( d.getElementById( 'wpbc_bfb__structure_import' ) || {} ).value || '';
		var o_text = ( d.getElementById( 'wpbc_bfb__settings_import' ) || {} ).value || '';

		var structure = null;
		var settings  = null;

		if ( mode === 'structure' || mode === 'both' ) {
			var parsed_s = safe_json_parse( s_text );
			if ( ! Array.isArray( parsed_s ) ) {
				show_message( 'Debug UI: Structure JSON must be an array.', 'error', 8000 );
				return;
			}
			structure = parsed_s;
		}

		if ( mode === 'settings' || mode === 'both' ) {
			var parsed_o = safe_json_parse( o_text );
			if ( ! parsed_o || typeof parsed_o !== 'object' ) {
				show_message( 'Debug UI: Settings JSON must be an object.', 'error', 8000 );
				return;
			}
			settings = normalize_imported_settings( parsed_o );
		}

		// Apply settings first (updates sidebar + immediate effects).
		if ( settings ) {
			apply_imported_settings( settings );
		}

		// Structure path: structure load rebuilds DOM -> re-apply settings AFTER load.
		if ( structure ) {
			apply_imported_structure( structure, function ( ok ) {
				if ( ! ok ) {
					return;
				}

				// Re-dispatch settings apply AFTER structure rebuild, so settings_effects.js
				// applies to the FINAL DOM (new wrappers).
				if ( settings ) {
					var form_name = get_current_form_name();

					// 1) Dispatch apply again (this is what settings_effects.js listens for).
					dispatch_event_safe( 'wpbc:bfb:form_settings:apply', {
						settings : settings,
						form_name: form_name
					} );

					// 2) Direct call fallback (in case the effects listener is not ready at that moment).
					run_settings_effects_now( settings, { source: 'debug-import-after-structure' } );

					setTimeout( function () {
						run_settings_effects_now( settings, { source: 'debug-import-after-structure-delayed' } );
					}, 60 );
				}

				show_message( 'Imported into Builder (structure/settings).', 'success', 3000 );

				setTimeout( function () {
					schedule_update();
				}, 160 );
			} );

			return;
		}

		// Settings-only import: DO NOT rebuild structure.
		with_builder( function ( builder ) {
			if ( builder && typeof builder.refresh_canvas === 'function' ) {
				builder.refresh_canvas( {
					hard   : true,
					rebuild: false,
					reinit : true,
					source : 'debug-import-settings-only'
				} );
			}

			// Ensure effects apply even if refresh_canvas rebuilt some preview markup.
			if ( settings ) {
				run_settings_effects_now( settings, { source: 'debug-import-settings-only' } );
				setTimeout( function () {
					run_settings_effects_now( settings, { source: 'debug-import-settings-only-delayed' } );
				}, 60 );
			}

			show_message( 'Imported settings into UI.', 'success', 2500 );

			setTimeout( function () {
				schedule_update();
			}, 160 );
		} );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Populate outputs (NO UI creation)
	// -----------------------------------------------------------------------------------------------------------------
	function render_outputs( structure ) {
		if ( ! is_debug_tab_visible() ) {
			return;
		}

		const form_name     = get_current_form_name();
		const form_settings = get_current_form_settings( form_name );

		// Exporter outputs (Advanced + Content).
		if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function' ) {
			let export_options = { gapPercent: 3 };

			// Best-effort: match Preview export options (width + slug) for accurate output.
			try {
				const width_combined = ( form_settings && form_settings.options )
					? ( form_settings.options.booking_form_layout_width || '' )
					: '';

				const parsed_width = parse_length_value( width_combined );
				const width_unit   = parsed_width.unit ? parsed_width.unit : '%';

				export_options = {
					gapPercent      : 3,
					form_slug       : form_name,
					form_width_value: parsed_width.num,
					form_width_unit : width_unit
				};
			} catch ( _e1 ) {}

			try {
				const pkg = w.WPBC_BFB_Exporter.export_all( structure || [], export_options );

				set_value( 'wpbc_bfb__advanced_form_output', ( pkg && pkg.advanced_form ) ? pkg.advanced_form : '' );
				set_value( 'wpbc_bfb__content_form_output', ( pkg && pkg.fields_data ) ? pkg.fields_data : '' );
			} catch ( e2 ) {
				set_value( 'wpbc_bfb__advanced_form_output', '// Exporter error: ' + ( ( e2 && e2.message ) ? e2.message : String( e2 ) ) );
				set_value( 'wpbc_bfb__content_form_output', '' );
			}
		} else {
			set_value( 'wpbc_bfb__advanced_form_output', '// WPBC_BFB_Exporter not loaded.' );
			set_value( 'wpbc_bfb__content_form_output',  '// WPBC_BFB_Exporter not loaded.' );
		}

		// Structure JSON export + prefill import.
		try {
			const s = JSON.stringify( structure || [], null, 2 );
			set_value( 'wpbc_bfb__structure_output', s );
			set_value_if_empty( 'wpbc_bfb__structure_import', s );
		} catch ( e3 ) {
			set_value( 'wpbc_bfb__structure_output', '// Error serializing structure: ' + ( ( e3 && e3.message ) ? e3.message : String( e3 ) ) );
		}

		// Settings JSON export + prefill import.
		try {
			const o = JSON.stringify( form_settings || { options: {}, css_vars: {} }, null, 2 );
			set_value( 'wpbc_bfb__settings_output', o );
			set_value_if_empty( 'wpbc_bfb__settings_import', o );
		} catch ( e4 ) {
			set_value( 'wpbc_bfb__settings_output', '// Error serializing settings: ' + ( ( e4 && e4.message ) ? e4.message : String( e4 ) ) );
		}
	}

	// Debounce to avoid heavy exports on rapid drag/drop.
	let update_timer = 0;

	function schedule_update( structure ) {
		w.clearTimeout( update_timer );
		update_timer = w.setTimeout( function () {
			render_outputs( structure || get_current_structure() );
		}, 80 );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Bind existing buttons (no UI creation)
	// -----------------------------------------------------------------------------------------------------------------
	function bind_debug_buttons_once() {
		const panel = get_debug_panel();
		if ( ! panel ) {
			return;
		}

		// 1) If you later add data attributes, we support them.
		const data_btns = panel.querySelectorAll( '[data-wpbc-bfb-debug-action]' );
		if ( data_btns && data_btns.length ) {
			data_btns.forEach( function ( btn ) {
				if ( ! btn || ! btn.addEventListener ) {
					return;
				}
				if ( btn.getAttribute( 'data-wpbc-bfb-debug-bound' ) === '1' ) {
					return;
				}
				btn.setAttribute( 'data-wpbc-bfb-debug-bound', '1' );

				btn.addEventListener( 'click', function ( e ) {
					e.preventDefault();

					const action = String( btn.getAttribute( 'data-wpbc-bfb-debug-action' ) || '' ).toLowerCase();
					const target = String( btn.getAttribute( 'data-wpbc-bfb-debug-target' ) || '' );

					if ( action === 'copy' && target ) {
						const ta = d.getElementById( target );
						if ( ta ) {
							copy_text_to_clipboard( ta.value, btn );
						}
						return;
					}

					if ( action === 'apply_structure' ) {
						import_from_textareas( 'structure' );
						return;
					}
					if ( action === 'apply_settings' ) {
						import_from_textareas( 'settings' );
						return;
					}
					if ( action === 'apply_both' ) {
						import_from_textareas( 'both' );
						return;
					}
					if ( action === 'refresh' ) {
						schedule_update();
						return;
					}
				} );
			} );

			return; // data-attrs are the preferred binding method.
		}

		// 2) Fallback binding for your current HTML (by textarea id + button order in block).
		const blocks = panel.querySelectorAll( '.wpbc_bfb__debug_block' );
		if ( ! blocks || ! blocks.length ) {
			return;
		}

		blocks.forEach( function ( block ) {
			const ta = block.querySelector( 'textarea' );
			if ( ! ta || ! ta.id ) {
				return;
			}

			const btns = block.querySelectorAll( 'button' );
			if ( ! btns || ! btns.length ) {
				return;
			}

			// Copy = always first button.
			const btn_copy = btns[0];
			if ( btn_copy && btn_copy.getAttribute( 'data-wpbc-bfb-debug-bound' ) !== '1' ) {
				btn_copy.setAttribute( 'data-wpbc-bfb-debug-bound', '1' );
				btn_copy.addEventListener( 'click', function ( e ) {
					e.preventDefault();
					copy_text_to_clipboard( ta.value, btn_copy );
				} );
			}

			// Import blocks have more buttons.
			if ( ta.id === 'wpbc_bfb__structure_import' ) {
				if ( btns[1] && btns[1].getAttribute( 'data-wpbc-bfb-debug-bound' ) !== '1' ) {
					btns[1].setAttribute( 'data-wpbc-bfb-debug-bound', '1' );
					btns[1].addEventListener( 'click', function ( e ) {
						e.preventDefault();
						import_from_textareas( 'structure' );
					} );
				}
				if ( btns[2] && btns[2].getAttribute( 'data-wpbc-bfb-debug-bound' ) !== '1' ) {
					btns[2].setAttribute( 'data-wpbc-bfb-debug-bound', '1' );
					btns[2].addEventListener( 'click', function ( e ) {
						e.preventDefault();
						import_from_textareas( 'both' );
					} );
				}
			}

			if ( ta.id === 'wpbc_bfb__settings_import' ) {
				if ( btns[1] && btns[1].getAttribute( 'data-wpbc-bfb-debug-bound' ) !== '1' ) {
					btns[1].setAttribute( 'data-wpbc-bfb-debug-bound', '1' );
					btns[1].addEventListener( 'click', function ( e ) {
						e.preventDefault();
						import_from_textareas( 'settings' );
					} );
				}
				if ( btns[2] && btns[2].getAttribute( 'data-wpbc-bfb-debug-bound' ) !== '1' ) {
					btns[2].setAttribute( 'data-wpbc-bfb-debug-bound', '1' );
					btns[2].addEventListener( 'click', function ( e ) {
						e.preventDefault();
						import_from_textareas( 'both' );
					} );
				}
			}
		} );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Wiring
	// -----------------------------------------------------------------------------------------------------------------
	d.addEventListener( 'DOMContentLoaded', function () {
		bind_debug_buttons_once();
		schedule_update();
	} );

	// Refresh when switching to Debug tab OR debug internal tabs.
	d.addEventListener( 'wpbc:bfb:top-tab', function ( ev ) {
		const tab_id = ( ev && ev.detail && ev.detail.tab ) ? String( ev.detail.tab ) : '';
		if ( tab_id === 'debug_tab' || tab_id.indexOf( 'debug_mode__' ) === 0 ) {
			bind_debug_buttons_once();
			schedule_update();
		}
	} );

	// Fallback event (if you still dispatch it somewhere).
	d.addEventListener( 'wpbc:bfb:structure:change', function () {
		schedule_update();
	} );

	// Settings apply/changed should refresh debug output.
	d.addEventListener( 'wpbc:bfb:form_settings:apply', function () {
		schedule_update();
	}, { passive: true } );

	d.addEventListener( 'wpbc:bfb:form_settings:changed', function () {
		schedule_update();
	}, { passive: true } );

	// Low-cost fallback: refresh on any change to SO controls (data-wpbc-u-save-*).
	d.addEventListener(
		'change',
		function ( e ) {
			const t = e ? e.target : null;
			if ( ! t || ! t.getAttribute ) {
				return;
			}

			const attrs = t.attributes || null;
			if ( ! attrs || ! attrs.length ) {
				return;
			}

			for ( let i = 0; i < attrs.length; i++ ) {
				const n = attrs[i] ? String( attrs[i].name || '' ) : '';
				if ( n && n.indexOf( 'data-wpbc-u-save-' ) === 0 ) {
					schedule_update();
					return;
				}
			}
		},
		{ passive: true }
	);

	// Prefer EventBus when available.
	(function hook_bus() {
		const Core = w.WPBC_BFB_Core || {};
		const EV   = Core.WPBC_BFB_Events || null;

		if ( ! EV || ! w.wpbc_bfb_api || ! w.wpbc_bfb_api.ready ) {
			return;
		}

		w.wpbc_bfb_api.ready.then( function ( builder ) {
			if ( ! builder || ! builder.bus || typeof builder.bus.on !== 'function' ) {
				return;
			}

			[
				EV.STRUCTURE_CHANGE,
				EV.FIELD_ADD,
				EV.FIELD_REMOVE,
				EV.STRUCTURE_LOADED
			].filter( Boolean ).forEach( function ( event_name ) {
				try {
					builder.bus.on( event_name, function () {
						schedule_update();
					} );
				} catch ( e ) {
					if ( w._wpbc && w._wpbc.dev && typeof w._wpbc.dev.error === 'function' ) {
						w._wpbc.dev.error( 'debug-ui: bus.on failed', event_name, e );
					}
				}
			} );
		} );
	})();
})( window, document );
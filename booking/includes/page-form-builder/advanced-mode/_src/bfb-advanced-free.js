/*
 * Advanced Mode Bridge (FREE) + CodeMirror Highlighting:
 * - Builder is the only editor.
 * - Always sync ON (Advanced text = Builder export).
 * - CodeMirror read-only highlighting for textareas (oshortcode overlay).
 * - Provides wpbc_bfb_advanced_editor_api.get_values() for Save/Preview.
 *
 * @file ../includes/page-form-builder/advanced-mode/_out/bfb-advanced-free.js
 */
(function (w, d) {
	'use strict';

	// True after wpbc:bfb:structure:loaded fired at least once.
	var structure_loaded_once = false;

	// == Constants =========================================================================================
	var IDS = {
		ta_form   : 'wpbc_bfb__advanced_form_editor',
		ta_content: 'wpbc_bfb__content_form_editor'
	};

	var KEY = {
		FORM   : 'advanced_form',
		CONTENT: 'content_form'
	};

	var TA_ID_BY_KEY          = {};
	TA_ID_BY_KEY[KEY.FORM]    = IDS.ta_form;
	TA_ID_BY_KEY[KEY.CONTENT] = IDS.ta_content;

	// == DOM ===============================================================================================
	var DOM = (function () {

		function get_by_id(id) {
			return d.getElementById( id );
		}

		function has_textareas() {
			return !! (get_by_id( IDS.ta_form ) && get_by_id( IDS.ta_content ));
		}

		function on(type, fn) {
			d.addEventListener( type, fn );
		}

		return {
			get          : get_by_id,
			has_textareas: has_textareas,
			on           : on
		};
	})();

	// == Editor (CodeMirror readonly + oshortcode highlighting) ============================================
	var Editor = (function () {

		var is_inited        = false;
		var editors          = {}; // key -> wp.codeEditor instance (or null)
		editors[KEY.FORM]    = null;
		editors[KEY.CONTENT] = null;

		var is_oshortcode_defined = false;

		function can_init_codemirror() {
			var wpns = w.wp || null;
			return !! (
				wpns &&
				wpns.codeEditor &&
				typeof wpns.codeEditor.initialize === 'function' &&
				w.wpbc_bfb_code_editor_settings
			);
		}

		function ensure_oshortcode_mode() {
			if ( is_oshortcode_defined ) {
				return;
			}

			var CM = (w.wp && w.wp.CodeMirror) ? w.wp.CodeMirror : null;
			if ( ! CM || typeof CM.defineMode !== 'function' ) {
				return;
			}

			CM.defineMode( 'oshortcode', function (config, parserConfig) {

				var overlay = {
					token: function (stream) {
						var ch;

						// [name ...] or [name* ...]
						if ( stream.match( /^\[([a-zA-Z0-9_]+)\*?\s?/ ) ) {
							while ( (ch = stream.next()) != null ) {
								if ( ch === ']' ) {
									return 'oshortcode';
								}
							}
						}

						while ( stream.next() != null && ! stream.match( /^\[([a-zA-Z0-9_]+)\*?\s?/, false ) ) {}
						return null;
					}
				};

				var base = CM.getMode( config, (parserConfig && parserConfig.backdrop) || 'htmlmixed' );

				// Fallback if overlay addon is missing.
				if ( typeof CM.overlayMode !== 'function' ) {
					return base;
				}

				return CM.overlayMode( base, overlay );
			} );

			is_oshortcode_defined = true;
		}

		function init_one(textarea_el, key) {
			var wpns = w.wp || null;
			if ( ! textarea_el || ! wpns || ! wpns.codeEditor || typeof wpns.codeEditor.initialize !== 'function' ) {
				return null;
			}

			var base = w.wpbc_bfb_code_editor_settings || null;
			if ( ! base ) {
				return null;
			}

			ensure_oshortcode_mode();

			// Clone so we don't mutate localized shared settings object.
			var settings        = Object.assign( {}, base );
			settings.codemirror = Object.assign( {}, base.codemirror || {} );

			// Highlight shortcodes in HTML-like markup.
			settings.codemirror.mode = 'oshortcode';

			// FREE: read-only editor (still selectable/copyable).
			settings.codemirror.readOnly = true;

			// Nice UX for read-only:
			// - no active line highlight in some themes
			// - no cursor blinking distraction
			settings.codemirror.styleActiveLine = false;
			settings.codemirror.cursorBlinkRate = -1;

			var inst     = wpns.codeEditor.initialize( textarea_el, settings );
			editors[key] = inst || null;

			return inst || null;
		}

		function ensure_inited() {
			if ( is_inited ) {
				return true;
			}

			var ta_form = DOM.get( IDS.ta_form );
			var ta_cnt  = DOM.get( IDS.ta_content );

			if ( ! ta_form || ! ta_cnt ) {
				return false;
			}

			// Initialize CodeMirror if possible; otherwise, plain textarea fallback.
			if ( can_init_codemirror() ) {
				init_one( ta_form, KEY.FORM );
				init_one( ta_cnt, KEY.CONTENT );
			}

			is_inited = true;
			return true;
		}

		function textarea_id_for(key) {
			return TA_ID_BY_KEY[key] || '';
		}

		function set_value(key, value) {
			value = (value == null) ? '' : String( value );

			var ta = DOM.get( textarea_id_for( key ) );
			if ( ta ) {
				ta.value = value;
			}

			var inst = editors[key];
			try {
				if ( inst && inst.codemirror && typeof inst.codemirror.setValue === 'function' ) {
					inst.codemirror.setValue( value );
					if ( typeof inst.codemirror.save === 'function' ) {
						inst.codemirror.save();
					}
				}
			} catch ( e ) {}
		}

		function refresh_all() {
			var keys = Object.keys( editors );
			for ( var i = 0; i < keys.length; i++ ) {
				var inst = editors[keys[i]];
				try {
					if ( inst && inst.codemirror && typeof inst.codemirror.refresh === 'function' ) {
						inst.codemirror.refresh();
					}
				} catch ( e ) {}
			}

			var root = d.documentElement;
			if ( ! root ) {
				return;
			}
			root.setAttribute( 'data-wpbc-bfb-live-source', 'builder' );
		}

		return {
			ensure_inited: ensure_inited,
			set_value    : set_value,
			refresh_all  : refresh_all
		};
	})();

	// == Bridge (Builder export -> snapshot -> editor/textarea) ============================================
	var Bridge = (function () {

		var last_good   = { advanced_form: '', content_form: '' };
		var debounce_id = null;

		/**
		 * Check if adapted structure contains ANY field (including inside sections).
		 *
		 * @param {Object|null} adapted
		 * @return {boolean}
		 */
		function adapted_has_any_field(adapted) {
			if ( ! adapted || ! Array.isArray( adapted.pages ) ) {
				return false;
			}

			var has = false;

			function walk_section(sec) {
				if ( has || ! sec ) {
					return;
				}
				var cols = Array.isArray( sec.columns ) ? sec.columns : [];
				for ( var i = 0; i < cols.length; i++ ) {
					var col = cols[i] || {};
					if ( Array.isArray( col.fields ) && col.fields.length ) {
						has = true;
						return;
					}
					var nested = Array.isArray( col.sections ) ? col.sections : [];
					for ( var j = 0; j < nested.length; j++ ) {
						walk_section( nested[j] );
						if ( has ) {
							return;
						}
					}
				}
			}

			for ( var p = 0; p < adapted.pages.length; p++ ) {
				var page = adapted.pages[p] || {};
				var items = Array.isArray( page.items ) ? page.items : [];
				for ( var k = 0; k < items.length; k++ ) {
					var it = items[k] || {};
					if ( it.kind === 'field' ) {
						return true;
					}
					if ( it.kind === 'section' ) {
						walk_section( it.data );
						if ( has ) {
							return true;
						}
					}
				}
			}

			return has;
		}

		function can_export_from_builder() {
			return !! (
				w.wpbc_bfb &&
				typeof w.wpbc_bfb.get_structure === 'function' &&
				w.WPBC_BFB_Exporter &&
				typeof w.WPBC_BFB_Exporter.export_all === 'function'
			);
		}

		function export_all_from_builder() {
			if ( ! can_export_from_builder() ) {
				return null;
			}
			try {
				return w.WPBC_BFB_Exporter.export_all( w.wpbc_bfb.get_structure(), { gapPercent: 3 } );
			} catch ( e ) {
				return null;
			}
		}

		// Prevent “wrapper-only / empty” early exports.
		function export_output_looks_ready(out) {
			if ( ! out ) {
				return false;
			}

			var af = (out.advanced_form == null) ? '' : String( out.advanced_form ).trim();
			var cf = (out.fields_data == null) ? '' : String( out.fields_data ).trim();
			if ( ! af && ! cf ) {
				return false;
			}

			// If structure is loaded and there are NO fields anywhere, accept empty export.
			// (Empty form should still regenerate to a valid wrapper+step markup.)
			if ( structure_loaded_once && ! adapted_has_any_field( out.adapted ) ) {
				return true;
			}

			// Real export usually includes <item> at least.
			var has_any_item = /<\s*item\b/i.test( af ) || /<\s*item\b/i.test( cf );
			return has_any_item;
		}

		function apply_snapshot(values) {
			// Update both textarea and CodeMirror (if inited).
			Editor.ensure_inited();
			Editor.set_value( KEY.FORM, values.advanced_form || '' );
			Editor.set_value( KEY.CONTENT, values.content_form || '' );
		}

		function refresh_snapshot() {
			var out = export_all_from_builder();
			if ( ! out || ! export_output_looks_ready( out ) ) {
				return false;
			}

			last_good.advanced_form = String( out.advanced_form || '' );
			last_good.content_form  = String( out.fields_data || '' );

			apply_snapshot( last_good );
			return true;
		}

		function schedule_refresh(ms) {
			if ( debounce_id ) {
				clearTimeout( debounce_id );
			}
			debounce_id = setTimeout( function () {
				debounce_id = null;
				refresh_snapshot();
			}, ms );
		}

		function get_values() {
			// Try to refresh now; fallback to last_good if exporter not ready.
			refresh_snapshot();
			return {
				advanced_form: String( last_good.advanced_form || '' ),
				content_form : String( last_good.content_form || '' ),
				is_dirty     : false
			};
		}

		return {
			refresh_now     : refresh_snapshot,
			schedule_refresh: schedule_refresh,
			get_values      : get_values
		};
	})();

	// == Events ============================================================================================
	var Events = (function () {

		function hook() {

			// Structure loaded: immediate + delayed refresh (exporter can be late).
			DOM.on( 'wpbc:bfb:structure:loaded', function () {
				structure_loaded_once = true;
				Bridge.refresh_now();
				Bridge.schedule_refresh( 200 );
				setTimeout( Editor.refresh_all, 60 );
			} );

			// Structure changed: debounce refresh.
			DOM.on( 'wpbc:bfb:structure:change', function () {
				Bridge.schedule_refresh( 250 );
			} );

			// If you still have an “advanced” tab/panel visible in Free, CodeMirror may need refresh.
			DOM.on( 'wpbc:bfb:top-tab', function () {
				setTimeout( Editor.refresh_all, 60 );
			} );
		}

		return { hook: hook };
	})();

	// == Public API (same as Pro) ===========================================================================
	w.wpbc_bfb_advanced_editor_api = w.wpbc_bfb_advanced_editor_api || {};

	w.wpbc_bfb_advanced_editor_api.get_values = function () {
		return Bridge.get_values();
	};

	// Compatibility no-op.
	w.wpbc_bfb_advanced_editor_api.set_dirty = function () {
	};

	// == Boot ==============================================================================================
	DOM.on( 'DOMContentLoaded', function () {
		// Init editor if textareas exist.
		if ( DOM.has_textareas() ) {
			Editor.ensure_inited();
			Bridge.refresh_now();
			setTimeout( Editor.refresh_all, 60 );
		}

		Events.hook();
	} );
})( window, document );

/*
 * Advanced Booking form mode.
 *
 * Refactored: module-style (DOM / State / Editor / Sync / Clipboard / Events / UI)
 *
 * @file ../includes/page-form-builder/advanced-mode/_out/bfb-advanced-form-editor.js
 */
(function (w, d) {
	'use strict';

	// True after wpbc:bfb:structure:loaded fired at least once.
	var structure_loaded_once = false;

	function adapted_has_any_field(adapted) {
		if ( ! adapted || ! Array.isArray( adapted.pages ) ) {
			return false;
		}

		var has = false;

		function walk_section(sec) {
			if ( has || ! sec ) { return; }
			var cols = Array.isArray( sec.columns ) ? sec.columns : [];
			for ( var i = 0; i < cols.length; i++ ) {
				var col = cols[i] || {};
				if ( Array.isArray( col.fields ) && col.fields.length ) { has = true; return; }
				var nested = Array.isArray( col.sections ) ? col.sections : [];
				for ( var j = 0; j < nested.length; j++ ) {
					walk_section( nested[j] );
					if ( has ) { return; }
				}
			}
		}

		for ( var p = 0; p < adapted.pages.length; p++ ) {
			var page  = adapted.pages[p] || {};
			var items = Array.isArray( page.items ) ? page.items : [];
			for ( var k = 0; k < items.length; k++ ) {
				var it = items[k] || {};
				if ( it.kind === 'field' ) { return true; }
				if ( it.kind === 'section' ) {
					walk_section( it.data );
					if ( has ) { return true; }
				}
			}
		}
		return has;
	}

	// ==  Constants  ==================================================================================================
	var IDS = {
		panels       : 'wpbc_bfb__advanced_mode_panels',
		ta_form      : 'wpbc_bfb__advanced_form_editor',
		ta_content   : 'wpbc_bfb__content_form_editor',
		btn_regen    : 'wpbc_bfb__advanced_regenerate_btn',
		btn_copy_form: 'wpbc_bfb__advanced_copy_form_btn',
		btn_copy_cnt : 'wpbc_bfb__advanced_copy_content_btn',
		cb_autosync  : 'wpbc_bfb__advanced_autosync',
		dirty_hint   : 'wpbc_bfb__advanced_dirty_hint'
	};

	var KEY = {
		FORM   : 'advanced_form',
		CONTENT: 'content_form'
	};

	var TA_ID_BY_KEY          = {};
	TA_ID_BY_KEY[KEY.FORM]    = IDS.ta_form;
	TA_ID_BY_KEY[KEY.CONTENT] = IDS.ta_content;

	// ==  DOM helpers  ================================================================================================
	var DOM = (function () {

		function get_by_id(id) {
			return d.getElementById( id );
		}

		function on(el, type, fn) {
			if ( el ) {
				el.addEventListener( type, fn );
			}
		}

		function is_advanced_ui_present() {
			return !! d.querySelector( '#' + IDS.panels );
		}

		return {
			get   : get_by_id,
			on    : on,
			has_ui: is_advanced_ui_present
		};
	})();

	// ==  State  ======================================================================================================
	var State = (function () {

		var state = {
			editors                : {},  // key -> wp.codeEditor instance (or null)
			autosync_user_value    : null, // null = not decided by user, boolean = user explicitly set
			sync_state_bootstrapped: false,
			is_dirty               : false,
			is_programmatic_update : false,
			is_inited              : false,
			textarea_fallback_bound: false
		};

		state.editors[KEY.FORM]    = null;
		state.editors[KEY.CONTENT] = null;

		function set_live_badges() {
			var cb      = DOM.get( IDS.cb_autosync );
			var sync_on = !! (cb && cb.checked);

			var live = (sync_on && ! state.is_dirty) ? 'builder' : 'advanced';

			var root = d.documentElement;
			if ( ! root ) {
				return;
			}

			root.setAttribute( 'data-wpbc-bfb-live-source', live === 'builder' ? 'builder' : 'advanced' );
			root.setAttribute( 'data-wpbc-bfb-sync-mode', sync_on ? 'on' : 'off' );
		}

		function set_dirty(on) {
			state.is_dirty = !! on;

			var hint = DOM.get( IDS.dirty_hint );
			if ( hint ) {
				hint.style.display = state.is_dirty ? 'inline' : 'none';
			}

			var autosync = DOM.get( IDS.cb_autosync );

			if ( state.is_dirty ) {
				// User edited Advanced => explicit opt-out of autosync for this session.
				state.autosync_user_value     = false;
				state.sync_state_bootstrapped = true;

				if ( autosync ) {
					autosync.checked = false;
				}
			} else {
				// IMPORTANT:
				// When clearing dirty state, do NOT force autosync checkbox ON.
				// Checkbox state is controlled by:
				// - user action (cb change)
				// - Sync.apply_autosync_state() when autosync_user_value === null
			}

			set_live_badges();
		}


		function is_autosync_on() {
			var cb = DOM.get( IDS.cb_autosync );
			return !! (cb && cb.checked && ! state.is_dirty);
		}

		return {
			raw           : state,
			set_dirty     : set_dirty,
			is_autosync_on: is_autosync_on,
			update_badges : set_live_badges
		};
	})();

	// ==  Editor (CodeMirror + textarea fallback + shortcode highlighting mode)  ======================================
	var Editor = (function () {

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

			var CM = w.wp && w.wp.CodeMirror ? w.wp.CodeMirror : null;
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

		function bind_textarea_dirty_fallback() {
			if ( State.raw.textarea_fallback_bound ) {
				return;
			}

			var ta_form = DOM.get( IDS.ta_form );
			var ta_cnt  = DOM.get( IDS.ta_content );
			if ( ! ta_form || ! ta_cnt ) {
				return;
			}

			function on_change() {
				if ( State.raw.is_programmatic_update ) {
					return;
				}
				State.set_dirty( true );
			}

			ta_form.addEventListener( 'input', on_change );
			ta_form.addEventListener( 'change', on_change );
			ta_cnt.addEventListener( 'input', on_change );
			ta_cnt.addEventListener( 'change', on_change );

			State.raw.textarea_fallback_bound = true;
		}

		function init_editor(textarea_el, key) {
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
			var settings             = Object.assign( {}, base );
			settings.codemirror      = Object.assign( {}, base.codemirror || {} );
			settings.codemirror.mode = 'oshortcode';

			var inst = wpns.codeEditor.initialize( textarea_el, settings );

			if ( inst && inst.codemirror ) {
				inst.codemirror.on( 'change', function () {
					if ( State.raw.is_programmatic_update ) {
						return;
					}
					State.set_dirty( true );
				} );
			}

			State.raw.editors[key] = inst;
			return inst;
		}

		function ensure_inited() {
			if ( State.raw.is_inited ) {
				return true;
			}

			var ta_form = DOM.get( IDS.ta_form );
			var ta_cnt  = DOM.get( IDS.ta_content );
			if ( ! ta_form || ! ta_cnt ) {
				return false;
			}

			bind_textarea_dirty_fallback();

			if ( can_init_codemirror() ) {
				var i1 = init_editor( ta_form, KEY.FORM );
				var i2 = init_editor( ta_cnt, KEY.CONTENT );

				if ( ! i1 ) {
					State.raw.editors[KEY.FORM] = null;
				}
				if ( ! i2 ) {
					State.raw.editors[KEY.CONTENT] = null;
				}
			}

			State.raw.is_inited = true;
			return true;
		}

		function refresh_all() {
			var keys = Object.keys( State.raw.editors );
			for ( var i = 0; i < keys.length; i++ ) {
				var inst = State.raw.editors[keys[i]];
				try {
					if ( inst && inst.codemirror && typeof inst.codemirror.refresh === 'function' ) {
						inst.codemirror.refresh();
					}
				} catch ( e ) {}
			}
		}

		function textarea_id_for(key) {
			return TA_ID_BY_KEY[key] || '';
		}

		function get_value(key) {
			var inst = State.raw.editors[key];
			if ( inst && inst.codemirror && typeof inst.codemirror.getValue === 'function' ) {
				return String( inst.codemirror.getValue() || '' );
			}
			var ta = DOM.get( textarea_id_for( key ) );
			return ta ? String( ta.value || '' ) : '';
		}

		function set_value(key, value) {
			value = (value == null) ? '' : String( value );

			var ta = DOM.get( textarea_id_for( key ) );

			State.raw.is_programmatic_update = true;
			try {
				if ( ta ) {
					ta.value = value;
				}

				var inst = State.raw.editors[key];
				if ( inst && inst.codemirror && typeof inst.codemirror.setValue === 'function' ) {
					inst.codemirror.setValue( value );
					if ( typeof inst.codemirror.save === 'function' ) {
						inst.codemirror.save();
					}
				}
			} finally {
				State.raw.is_programmatic_update = false;
			}
		}

		function focus_and_select(key) {
			var ta = DOM.get( textarea_id_for( key ) );
			if ( ! ta ) {
				return;
			}
			try {
				ta.focus();
				ta.select();
			} catch ( e ) {}
		}

		function save_all_to_textareas() {
			var keys = Object.keys( State.raw.editors );
			for ( var i = 0; i < keys.length; i++ ) {
				var inst = State.raw.editors[keys[i]];
				try {
					if ( inst && inst.codemirror && typeof inst.codemirror.save === 'function' ) {
						inst.codemirror.save();
					}
				} catch ( e ) {}
			}
		}

		return {
			ensure_inited: ensure_inited,
			refresh_all  : refresh_all,
			get_value    : get_value,
			set_value    : set_value,
			focus_select : focus_and_select,
			save_all     : save_all_to_textareas
		};
	})();

	// ==  Builder export + Sync  ======================================================================================
	var Sync = (function () {

		var poll_timer_id     = null;
		var debounce_timer_id = null;

		function can_export_from_builder() {
			return !! (
				w.wpbc_bfb &&
				typeof w.wpbc_bfb.get_structure === 'function' &&
				w.WPBC_BFB_Exporter &&
				typeof w.WPBC_BFB_Exporter.export_all === 'function'
			);
		}

		function get_current_structure() {
			return (w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function') ? w.wpbc_bfb.get_structure() : [];
		}

		function export_all_from_builder() {
			if ( ! w.WPBC_BFB_Exporter || typeof w.WPBC_BFB_Exporter.export_all !== 'function' ) {
				return null;
			}
			try {
				return w.WPBC_BFB_Exporter.export_all( get_current_structure(), { gapPercent: 3 } );
			} catch ( e ) {
				return null;
			}
		}

		function export_output_looks_ready(out) {
			if ( ! out ) {
				return false;
			}

			var af = (out.advanced_form == null) ? '' : String( out.advanced_form );
			var cf = (out.fields_data == null) ? '' : String( out.fields_data );

			af = af.trim();
			cf = cf.trim();

			if ( ! af && ! cf ) {
				return false;
			}

			// If structure is loaded and there are NO fields, accept empty export.
			if ( structure_loaded_once && ! adapted_has_any_field( out.adapted ) ) {
				return true;
			}

			// Real BFB export includes layout tags (<r>, <c>, <item>).
			var has_layout_tags = /<\s*(r|c|item)\b/i.test( af ) || /<\s*(r|c|item)\b/i.test( cf );
			var has_any_item    = /<\s*item\b/i.test( af ) || /<\s*item\b/i.test( cf );

			return has_layout_tags && has_any_item;
		}

		function get_builder_export_if_ready() {
			if ( ! can_export_from_builder() ) {
				return null;
			}

			var out = export_all_from_builder();
			if ( ! out ) {
				return null;
			}

			if ( ! export_output_looks_ready( out ) ) {
				return null;
			}

			return out;
		}

		// --- Normalization for compare -------------------------------------------------------
		function normalize_style_value(css) {
			css = (css == null) ? '' : String( css );

			css = css.replace( /\r\n/g, '\n' ).replace( /\r/g, '\n' );
			css = css.replace( /\t/g, ' ' );
			css = css.replace( /\s+/g, ' ' );

			css = css.replace( /\s*;\s*/g, ';' );
			css = css.replace( /\s*:\s*/g, ':' );

			css = css.trim().replace( /;+\s*$/g, '' );
			if ( css !== '' ) {
				css += ';';
			}

			return css;
		}

		function normalize_inline_styles_in_markup(html) {
			html = (html == null) ? '' : String( html );

			return html.replace( /\bstyle=(["'])(.*?)\1/gi, function (_m, quote, css) {
				return 'style=' + quote + normalize_style_value( css ) + quote;
			} );
		}

		function normalize_text(s) {
			s = (s == null) ? '' : String( s );

			s = s.replace( /\r\n/g, '\n' ).replace( /\r/g, '\n' );
			s = normalize_inline_styles_in_markup( s );

			s = s.replace( /[ \t]+$/gm, '' );
			s = s.replace( /[ ]{2,}/g, ' ' );
			s = s.replace( /^\s+/gm, '' );
			s = s.replace( /\n{3,}/g, '\n\n' );

			return s.trim();
		}

		function get_current_advanced_texts() {
			return {
				advanced_form: Editor.get_value( KEY.FORM ),
				content_form : Editor.get_value( KEY.CONTENT )
			};
		}

		function detect_sync_state_with_export() {
			var out = get_builder_export_if_ready();
			if ( ! out ) {
				return null;
			}

			var cur = get_current_advanced_texts();

			var a1 = normalize_text( cur.advanced_form );
			var a2 = normalize_text( cur.content_form );

			var b1 = normalize_text( out.advanced_form || '' );
			var b2 = normalize_text( out.fields_data || '' );

			return {
				is_synced: (a1 === b1) && (a2 === b2),
				out      : out
			};
		}

		function apply_autosync_from_sync_state(is_synced) {
			var cb = DOM.get( IDS.cb_autosync );
			if ( ! cb ) {
				return;
			}

			if ( State.raw.is_dirty ) {
				State.raw.autosync_user_value     = false;
				State.raw.sync_state_bootstrapped = true;
				cb.checked                        = false;
				State.update_badges();
				return;
			}

			// Only auto-set checkbox if user never explicitly touched it.
			if ( State.raw.autosync_user_value === null ) {
				cb.checked = !! is_synced;
			}

			State.raw.sync_state_bootstrapped = true;
			State.update_badges();
		}

		function regenerate_from_builder(out_opt) {
			var out = out_opt || get_builder_export_if_ready();
			if ( ! out ) {
				return false;
			}

			Editor.set_value( KEY.FORM, out.advanced_form || '' );
			Editor.set_value( KEY.CONTENT, out.fields_data || '' );

			State.set_dirty( false );
			State.update_badges();

			return true;
		}

		function sync_detect_and_apply() {
			var res = detect_sync_state_with_export();
			if ( res === null ) {
				return false;
			}

			var cb      = DOM.get( IDS.cb_autosync );
			var sync_on = !! (cb && cb.checked);

			State.raw.sync_state_bootstrapped = true;

			if ( State.raw.is_dirty ) {
				apply_autosync_from_sync_state( false );
				return true;
			}

			if ( sync_on ) {
				if ( ! res.is_synced ) {
					regenerate_from_builder( res.out );
				} else {
					State.update_badges();
				}
				return true;
			}

			apply_autosync_from_sync_state( res.is_synced );
			return true;
		}

		// --- Poll / debounce -------------------------------------------------------
		function schedule_sync_detect(reason) {

			if ( poll_timer_id ) {
				clearTimeout( poll_timer_id );
				poll_timer_id = null;
			}

			var started_ms   = Date.now();
			var max_total_ms = 12000;
			var delay_ms     = 150;

			(function tick() {

				if ( ! DOM.has_ui() ) {
					poll_timer_id = null;
					return;
				}

				Editor.ensure_inited();

				if ( State.raw.is_dirty ) {
					apply_autosync_from_sync_state( false );
					poll_timer_id = null;
					return;
				}

				if ( sync_detect_and_apply() ) {
					poll_timer_id = null;
					return;
				}

				if ( (Date.now() - started_ms) < max_total_ms ) {
					delay_ms      = Math.min( 600, Math.floor( delay_ms * 1.25 ) );
					poll_timer_id = setTimeout( tick, delay_ms );
					return;
				}

				poll_timer_id = null;
			})();
		}

		function schedule_sync_detect_debounced(reason) {
			if ( debounce_timer_id ) {
				clearTimeout( debounce_timer_id );
			}
			debounce_timer_id = setTimeout( function () {
				debounce_timer_id = null;
				schedule_sync_detect( reason );
			}, 250 );
		}

		return {
			schedule_detect          : schedule_sync_detect,
			schedule_detect_debounced: schedule_sync_detect_debounced,
			regenerate               : regenerate_from_builder,
			apply_autosync_state     : apply_autosync_from_sync_state
		};
	})();

	// ==  Clipboard  ==================================================================================================
	var Clipboard = (function () {

		async function copy_text(text) {
			text = (text == null) ? '' : String( text );

			if ( typeof w.wpbc_copy_to_clipboard === 'function' ) {
				try { return await w.wpbc_copy_to_clipboard( text ); } catch ( e ) {}
			}

			try {
				if ( w.isSecureContext && navigator.clipboard && navigator.clipboard.writeText ) {
					await navigator.clipboard.writeText( text );
					return true;
				}
			} catch ( e ) {}

			try {
				var ta   = d.createElement( 'textarea' );
				ta.value = text;
				ta.setAttribute( 'readonly', '' );
				ta.style.position = 'fixed';
				ta.style.top      = '-9999px';
				ta.style.opacity  = '0';
				d.body.appendChild( ta );
				ta.focus();
				ta.select();
				var ok = d.execCommand( 'copy' );
				d.body.removeChild( ta );
				return !! ok;
			} catch ( e ) {
				return false;
			}
		}

		function feedback_button(btn, ok) {
			if ( ! btn ) {
				return;
			}

			var original = btn.getAttribute( 'data-wpbc-original-text' ) || btn.textContent;
			btn.setAttribute( 'data-wpbc-original-text', original );

			btn.textContent = ok ? 'Copied!' : 'Press Ctrl/Cmd+C to copy';
			setTimeout( function () {
				btn.textContent = original;
			}, 1500 );
		}

		async function copy_editor_value(key, btn) {
			Editor.ensure_inited();

			var ok = await copy_text( Editor.get_value( key ) );
			if ( ! ok ) {
				Editor.focus_select( key );
			}

			feedback_button( btn, ok );
		}

		return {
			copy_editor_value: copy_editor_value
		};
	})();

	// ==  UI bindings
	var UI = (function () {

		function bind_ui() {

			DOM.on( DOM.get( IDS.btn_regen ), 'click', function (e) {
				e.preventDefault();
				Editor.ensure_inited();
				Sync.regenerate();
				Editor.refresh_all();

				// Safe default until we can confirm sync state.
				var cb = DOM.get( IDS.cb_autosync );
				if ( cb ) {
					cb.checked = true;
					State.update_badges();
				}
			} );

			DOM.on( DOM.get( IDS.cb_autosync ), 'change', function () {

				var cb = DOM.get( IDS.cb_autosync );
				if ( ! cb ) {
					return;
				}

				State.raw.autosync_user_value     = !! cb.checked; // explicit user choice
				State.raw.sync_state_bootstrapped = true;

				if ( cb.checked ) {
					State.set_dirty( false );
					Editor.ensure_inited();

					if ( ! Sync.regenerate() ) {
						Sync.schedule_detect( 'autosync_user_on_wait_ready' );
					}

					Editor.refresh_all();
				}

				State.update_badges();
			} );

			DOM.on( DOM.get( IDS.btn_copy_form ), 'click', function (e) {
				e.preventDefault();
				Clipboard.copy_editor_value( KEY.FORM, DOM.get( IDS.btn_copy_form ) );
			} );

			DOM.on( DOM.get( IDS.btn_copy_cnt ), 'click', function (e) {
				e.preventDefault();
				Clipboard.copy_editor_value( KEY.CONTENT, DOM.get( IDS.btn_copy_cnt ) );
			} );
		}

		return {
			bind: bind_ui
		};
	})();

	// ==  WP / Builder events  ========================================================================================
	var Events = (function () {

		function hook_events() {

			/**
			 * Infer apply source without relying on any "advanced_source" key.
			 *
			 * Returns:
			 * - 'builder'  : if texts match current Builder export (when export is ready)
			 * - 'advanced' : if texts do not match Builder export (but have any content)
			 * - 'auto'     : if Builder export is not available/ready (safe default)
			 *
			 * @param {string} af
			 * @param {string} cf
			 * @return {'builder'|'advanced'|'auto'}
			 */
			function infer_apply_source(af, cf) {

				af = (af == null) ? '' : String(af);
				cf = (cf == null) ? '' : String(cf);

				function has_text(v) {
					return !! (v && String(v).trim());
				}

				function normalize_style_value(css) {
					css = (css == null) ? '' : String( css );

					css = css.replace( /\r\n/g, '\n' ).replace( /\r/g, '\n' );
					css = css.replace( /\t/g, ' ' );
					css = css.replace( /\s+/g, ' ' );

					// Normalize spacing around separators.
					css = css.replace( /\s*;\s*/g, ';' );
					css = css.replace( /\s*:\s*/g, ':' );

					// Ensure stable trailing semicolon (important for compare).
					css = css.trim().replace( /;+\s*$/g, '' );
					if ( css !== '' ) {
						css += ';';
					}
					return css;
				}

				function normalize_inline_styles_in_markup(html) {
					html = (html == null) ? '' : String( html );

					// Handles: style="..." and style='...' (with optional spaces around '=')
					return html.replace( /\bstyle\s*=\s*(["'])(.*?)\1/gi, function (_m, quote, css) {
						return 'style=' + quote + normalize_style_value( css ) + quote;
					} );
				}

				function normalize_text(s) {
					s = (s == null) ? '' : String(s);
					s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

					// IMPORTANT: normalize inline styles so "flex:1" == "flex:1;"
					s = normalize_inline_styles_in_markup(s);

					s = s.replace(/[ \t]+$/gm, '');
					s = s.replace(/[ ]{2,}/g, ' ');
					s = s.replace(/^\s+/gm, '');
					s = s.replace(/\n{3,}/g, '\n\n');
					return s.trim();
				}

				function export_output_looks_ready(out) {
					if (!out) return false;
					var a = normalize_text(out.advanced_form || '');
					var b = normalize_text(out.fields_data || '');
					if (!a && !b) return false;
					// If structure is loaded and there are NO fields, accept empty export.
					if ( structure_loaded_once && ! adapted_has_any_field( out.adapted ) ) {
						return true;
					}
					// Expect layout tags to exist in real export.
					var has_layout_tags = /<\s*(r|c|item)\b/i.test(a) || /<\s*(r|c|item)\b/i.test(b);
					var has_any_item    = /<\s*item\b/i.test(a) || /<\s*item\b/i.test(b);
					return has_layout_tags && has_any_item;
				}

				function try_get_builder_export() {
					try {
						if (
							!w.wpbc_bfb ||
							typeof w.wpbc_bfb.get_structure !== 'function' ||
							!w.WPBC_BFB_Exporter ||
							typeof w.WPBC_BFB_Exporter.export_all !== 'function'
						) {
							return null;
						}
						var out = w.WPBC_BFB_Exporter.export_all(w.wpbc_bfb.get_structure(), { gapPercent: 3 });
						if (!export_output_looks_ready(out)) {
							return null;
						}
						return out;
					} catch (_e) {
						return null;
					}
				}

				var out = try_get_builder_export();
				if (!out) {
					return 'auto';
				}

				var in_af = normalize_text(af);
				var in_cf = normalize_text(cf);
				var ex_af = normalize_text(out.advanced_form || '');
				var ex_cf = normalize_text(out.fields_data || '');

				if (in_af === ex_af && in_cf === ex_cf) {
					return 'builder';
				}

				if (has_text(af) || has_text(cf)) {
					return 'advanced';
				}

				return 'auto';
			}


			d.addEventListener( 'wpbc:bfb:structure:change', function () {
				if ( ! Editor.ensure_inited() ) {
					return;
				}

				if ( State.raw.is_dirty ) {
					return;
				}

				if ( State.raw.autosync_user_value === false ) {
					return;
				}

				var cb = DOM.get( IDS.cb_autosync );
				if ( ! cb ) {
					return;
				}

				if ( ! State.raw.sync_state_bootstrapped ) {
					Sync.schedule_detect_debounced( 'structure_change_pre_bootstrap' );
					return;
				}

				Sync.schedule_detect_debounced( 'structure_change' );
			} );

			d.addEventListener( 'wpbc:bfb:structure:loaded', function () {
				structure_loaded_once = true;
				Sync.schedule_detect( 'structure_loaded' );
			} );

			d.addEventListener( 'wpbc:bfb:top-tab', function (ev) {

				var tab_id   = (ev && ev.detail && ev.detail.tab) ? String( ev.detail.tab ) : '';
				var is_inner = (tab_id === 'advanced_mode__booking_form' || tab_id === 'advanced_mode__booking_data');

				// Entering Advanced Mode (root tab) or switching inner tabs.
				if ( tab_id !== 'advanced_tab' && ! is_inner ) {
					return;
				}

				if ( ! Editor.ensure_inited() ) {
					return;
				}

				if ( State.is_autosync_on() ) {
					if ( ! Sync.regenerate() ) {
						Sync.schedule_detect( 'top_tab_wait_ready' );
					}
				}


				setTimeout( Editor.refresh_all, 60 );
				if ( tab_id === 'advanced_mode__booking_data' ) {
					setTimeout( Editor.refresh_all, 120 );
				}
			} );

			d.addEventListener( 'wpbc:bfb:advanced_text:apply', function (ev) {

				var det = (ev && ev.detail) ? ev.detail : {};
				var af  = (det.advanced_form == null) ? '' : String( det.advanced_form );
				var cf  = (det.content_form == null) ? '' : String( det.content_form );

				var src = String( det.advanced_mode_source || 'auto' ).toLowerCase(); // builder|advanced|auto.
				if ( src !== 'builder' && src !== 'advanced' && src !== 'auto' ) {
					src = 'auto';
				}
				if ( src === 'auto' ) {
					src = infer_apply_source( af, cf ); // builder|advanced|auto.
				}


				var cb = DOM.get( IDS.cb_autosync );

				// Always use Editor API (keeps textarea + CodeMirror in sync).
				Editor.ensure_inited();
				Editor.set_value( KEY.FORM, af );
				Editor.set_value( KEY.CONTENT, cf );
				setTimeout( Editor.refresh_all, 60 );

				if ( src === 'advanced' ) {
					// Advanced is authoritative => dirty + autosync OFF.
					if ( cb ) { cb.checked = false; }
					State.set_dirty( true );                 // also sets autosync_user_value=false and bootstrapped=true .

				} else if ( src === 'builder' ) {
					// Builder is authoritative => autosync ON.
					if ( cb ) { cb.checked = true; }
					State.raw.autosync_user_value     = true;
					State.raw.sync_state_bootstrapped = true;
					State.set_dirty( false );

				} else {
					// auto/unknown:  Safe default = autosync OFF until we confirm real sync state.  This prevents Preview using Builder before export is ready / comparison is done.
					if ( cb ) { cb.checked = false; }
					State.raw.autosync_user_value     = null;
					State.raw.sync_state_bootstrapped = false;
					State.set_dirty( false );
				}

				State.update_badges();
				Sync.schedule_detect( 'advanced_text_apply' );
			} );


		}

		return {
			hook: hook_events
		};
	})();

	// == Public API (unchanged)  ======================================================================================
	w.wpbc_bfb_advanced_editor_api = w.wpbc_bfb_advanced_editor_api || {};

	w.wpbc_bfb_advanced_editor_api.get_values = function () {

		// Ensure CodeMirror is ready (if enabled).
		Editor.ensure_inited();

		// Push CodeMirror -> textarea (no-op if not inited).
		Editor.save_all();

		// In your system, "manual mode" (autosync OFF) must be treated as "use Advanced".
		var use_advanced = !! State.raw.is_dirty || ! State.is_autosync_on();

		return {
			advanced_form: Editor.get_value( KEY.FORM ),
			content_form : Editor.get_value( KEY.CONTENT ),
			is_dirty     : use_advanced
		};
	};


	w.wpbc_bfb_advanced_editor_api.set_dirty = function (state) {
		State.set_dirty( !! state );
	};

	// ==  Boot  =======================================================================================================
	d.addEventListener( 'DOMContentLoaded', function () {

		UI.bind();
		Events.hook();

		if ( DOM.has_ui() ) {
			Editor.ensure_inited();
			setTimeout( Editor.refresh_all, 60 );

			// Safe default until we can confirm sync state.
			var cb = DOM.get( IDS.cb_autosync );
			if ( cb && State.raw.autosync_user_value === null && ! State.raw.sync_state_bootstrapped ) {
				cb.checked = false;
				State.update_badges();
			}
		}

		// Initial autosync checkbox state (based on real sync status).
		Sync.schedule_detect( 'boot' );
	} );

})( window, document );

// ---------------------------------------------------------------------------------------------------------------------
// == File  ../includes/page-form-builder/ajax/_out/bfb-ajax.js  - after  refactor 2026-02-28 15:14 rolback  to  this paoint,  if something will  go  wrong.
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d, $) {
	'use strict';

	var AjaxCfg = w.WPBC_BFB_Ajax || {};
	if ( ! AjaxCfg.url ) {
		// Not on builder page or config not injected.
		return;
	}

	if ( ! $ || ! $.ajax ) {
		// In WP admin jQuery should exist; if not, stop to avoid silent corruption.
		wpbc_admin_show_message( 'WPBC BFB: jQuery is not available.', 'error', 10000 );
		console.error( 'WPBC BFB: jQuery is not available.' );
		return;
	}

	function get_save_source( cfg, btn ) {

		// priority: button attr -> global cfg -> default
		var v = '';
		try {
			if ( btn && btn.getAttribute ) {
				v = btn.getAttribute( 'data-wpbc-bfb-save-source' ) || '';
			}
		} catch ( e ) {}

		if ( ! v && cfg && cfg.save_source ) {
			v = cfg.save_source;
		}

		v = String( v || 'auto' ).toLowerCase();
		if ( [ 'builder', 'advanced', 'auto' ].indexOf( v ) === -1 ) {
			v = 'builder';
		}
		return v;
	}

	function read_advanced_mode_payload() {

		// best: API (syncs CodeMirror -> textarea)
		if ( w.wpbc_bfb_advanced_editor_api && typeof w.wpbc_bfb_advanced_editor_api.get_values === 'function' ) {
			try {
				return w.wpbc_bfb_advanced_editor_api.get_values();
			} catch ( e ) {}
		}

		// fallback: read textareas directly (may be stale if CM not saved)
		var ta_form    = d.getElementById( 'wpbc_bfb__advanced_form_editor' );
		var ta_content = d.getElementById( 'wpbc_bfb__content_form_editor' );

		return {
			advanced_form: ta_form ? String( ta_form.value || '' ) : '',
			content_form : ta_content ? String( ta_content.value || '' ) : '',
			is_dirty     : false
		};
	}

	function has_text( v ) {
		return !! ( v && String( v ).trim() );
	}

	/**
	 * Serialize values so payload matches previous XMLHttpRequest behavior:
	 * - null/undefined => ''
	 * - objects/arrays => JSON.stringify(...)
	 * - everything else => String(...)
	 *
	 * @param {*} value
	 * @return {string}
	 */
	function wpbc_bfb__serialize_post_value( value ) {

		if ( value === null || typeof value === 'undefined' ) {
			return '';
		}

		if ( typeof value === 'object' ) {
			try {
				return JSON.stringify( value );
			} catch ( e ) {
				return '';
			}
		}

		return String( value );
	}

	/**
	 * Normalize payload to scalar strings so jQuery does not produce "[object Object]".
	 *
	 * @param {Object} raw_data
	 * @return {Object}
	 */
	function wpbc_bfb__normalize_post_data( raw_data ) {

		var out = {};
		raw_data = raw_data || {};

		for ( var k in raw_data ) {
			if ( ! Object.prototype.hasOwnProperty.call( raw_data, k ) ) {
				continue;
			}
			out[ k ] = wpbc_bfb__serialize_post_value( raw_data[ k ] );
		}

		return out;
	}

	/**
	 * POST helper (jQuery only) returning jqXHR promise.
	 * IMPORTANT: dataType:'text' so callers keep manual JSON.parse exactly as before.
	 *
	 * @param {string} url
	 * @param {Object} payload
	 * @return {jqXHR}
	 */
	function wpbc_bfb__ajax_post( url, payload ) {

		return $.ajax( {
			url         : url,
			type        : 'POST',
			data        : wpbc_bfb__normalize_post_data( payload ),
			dataType    : 'text',
			contentType : 'application/x-www-form-urlencoded; charset=UTF-8'
		} );
	}

	/**
	 * Safe JSON parse helper.
	 *
	 * @param {string} text
	 * @return {Object|null}
	 */
	function wpbc_bfb__safe_json_parse( text ) {
		try {
			return JSON.parse( text );
		} catch ( e ) {
			return null;
		}
	}

	/**
	 * Parse combined length string like "100%", "320px", "12.5rem".
	 *
	 * @param {string} value
	 * @return {{num:string, unit:string}}
	 */
	function parse_length_value( value ) {
		var raw = String( value == null ? '' : value ).trim();
		var m = raw.match( /^\s*(-?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i );
		if ( ! m ) {
			return { num: raw, unit: '' };
		}
		return { num: ( m[1] || '' ), unit: ( m[2] || '' ) };
	}

	/**
	 * SAVE: send current Builder structure (+ exported shortcodes) to PHP.
	 *
	 * Uses:
	 *  - WPBC_BFB_Ajax.url / nonce_save / form_name / engine / engine_version
	 *  - Optional WPBC_BFB_Exporter.export_all()
	 *  - Busy helpers wpbc_bfb__button_busy_start / _end if available.
	 *
	 * IMPORTANT:
	 * - Local (form) settings are collected ONLY here (Save form),
	 *   via event "wpbc:bfb:form_settings:collect".
	 */
	function wpbc_bfb__ajax_save_current_form( btn, done_cb ) {

		var cfg     = w.WPBC_BFB_Ajax || {};
		var builder = w.wpbc_bfb || null;

		var $btn = btn ? $( btn ) : null;

		// --- Busy START ----------------------------------------------------------------------------------------------
		if ( $btn && $btn.length ) {
			// Will read data-wpbc-u-busy-text="Saving..." from the <a> and add spinner.
			if ( typeof w.wpbc_bfb__button_busy_start === 'function' ) {          // FIX: guard
				w.wpbc_bfb__button_busy_start( $btn );
			} else {
				$btn.prop( 'disabled', true );
			}
		} else if ( btn ) {
			btn.disabled = true;
		}

		// --- Gather structure ----------------------------------------------------------------------------------------
		var structure = ( builder && typeof builder.get_structure === 'function' ) ? builder.get_structure() : [];

		// --- Gather current form settings (event-based; modules can contribute) -------------------------------------
		// ONLY supported settings format:
		// {
		//   options     : { key: value, ... },
		//   css_vars    : [],
		//   bfb_options : { advanced_mode_source: 'builder'|'advanced'|'auto' }
		// }
		var form_settings = {
			options     : {},
			css_vars    : [],
			bfb_options : { advanced_mode_source: 'builder' }
		};

		// Let Settings Options (and any other module) contribute local form settings.
		wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form_settings:collect', {
			settings : form_settings,
			form_name: cfg.form_name || 'standard'
		} );

		// Normalize css_vars to array (schema enforcement).
		if ( form_settings && form_settings.css_vars && ! Array.isArray( form_settings.css_vars ) ) {
			var out = [];
			try {
				for ( var k in form_settings.css_vars ) {
					if ( Object.prototype.hasOwnProperty.call( form_settings.css_vars, k ) ) {
						out.push( { name: String( k ), value: String( form_settings.css_vars[ k ] ) } );
					}
				}
			} catch ( _e0 ) {}
			form_settings.css_vars = out;
		}
		if ( ! form_settings.bfb_options || typeof form_settings.bfb_options !== 'object' ) {
			form_settings.bfb_options = { advanced_mode_source: 'builder' };
		}
		if ( ! form_settings.bfb_options.advanced_mode_source ) {
			form_settings.bfb_options.advanced_mode_source = 'builder';
		}

		var payload = {
			action        : 'WPBC_AJX_BFB_SAVE_FORM_CONFIG',
			nonce         : cfg.nonce_save || '',
			form_name     : cfg.form_name || 'standard',
			engine        : cfg.engine || 'bfb',
			engine_version: cfg.engine_version || '1.0',
			structure     : JSON.stringify( structure ),
			settings      : JSON.stringify( form_settings )
		};

		// -----------------------------------------------------------------------------
		// Choose where advanced_form + content_form are taken from.
		// -----------------------------------------------------------------------------
		var save_source = get_save_source( cfg, btn );

		// 1) Try Advanced Mode text (if selected / auto+dirty).
		var adv = null;

		if ( save_source === 'advanced' || save_source === 'auto' ) {
			adv = read_advanced_mode_payload();

			var can_use_advanced =
					( save_source === 'advanced' ) ||
					( save_source === 'auto' && adv && adv.is_dirty );

			if ( can_use_advanced ) {

				// If user forced "advanced" but both are empty -> fallback to exporter.
				if ( ! has_text( adv.advanced_form ) && ! has_text( adv.content_form ) ) {
					wpbc_admin_show_message( 'Advanced Mode is selected, but editors are empty. Using Builder export.', 'warning', 6000 );
				} else {
					if ( has_text( adv.advanced_form ) ) {
						payload.advanced_form = adv.advanced_form;
					}
					if ( has_text( adv.content_form ) ) {
						payload.content_form = adv.content_form;
					}
					form_settings.bfb_options.advanced_mode_source = 'advanced';
					payload.settings = JSON.stringify( form_settings ); // keep payload in sync.
				}
			}
		}

		// 2) If not taken from Advanced Mode -> export from Builder structure (current behavior).
		if ( ! payload.advanced_form || ! payload.content_form ) {

			if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function' ) {
				try {

					// Prefer Option A pack: settings.options.*
					var opt_pack       = form_settings.options;
					var width_combined = opt_pack.booking_form_layout_width || '';
					var parsed_width   = parse_length_value( width_combined );

					var export_options = {
						gapPercent      : 3,
						form_slug       : payload.form_name,
						form_width_value: parsed_width.num,
						form_width_unit : parsed_width.unit
					};

					var export_result = w.WPBC_BFB_Exporter.export_all( structure || [], export_options );

					if ( export_result ) {
						if ( ! payload.advanced_form && export_result.advanced_form ) {
							payload.advanced_form = export_result.advanced_form;
						}
						if ( ! payload.content_form && export_result.fields_data ) {
							payload.content_form = export_result.fields_data;
						}
					}

					form_settings.bfb_options.advanced_mode_source = 'builder';
					payload.settings = JSON.stringify( form_settings ); // keep payload in sync.

				} catch ( e ) {
					wpbc_admin_show_message( 'WPBC BFB: export_all error', 'error', 10000 );
					console.error( 'WPBC BFB: export_all error', e );
				}
			}
		}

		// Update payload before send via AJAX,  if needed.
		var hook_detail = { payload: payload };
		wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form:before_save_payload', hook_detail );
		payload = hook_detail.payload;

		var ajax_request = wpbc_bfb__ajax_post( cfg.url, payload );

		ajax_request
			.done(
				function ( response_text, _text_status, jqxhr ) {

					// Keep old behavior: only treat exact 200 as success.
					if ( ! jqxhr || jqxhr.status !== 200 ) {
						if ( typeof done_cb === 'function' ) {
							try { done_cb( false, null ); } catch ( _e1 ) {}
						}
						wpbc_admin_show_message( 'WPBC BFB: save HTTP error', 'error', 10000 );
						console.error( 'WPBC BFB: save HTTP error', jqxhr ? jqxhr.status : 0 );
						return;
					}

					var resp = wpbc_bfb__safe_json_parse( response_text );
					if ( ! resp ) {
						wpbc_admin_show_message( 'WPBC BFB: save JSON parse error', 'error', 10000 );
						console.error( 'WPBC BFB: save JSON parse error', response_text );
						return;
					}

					if ( ! resp || ! resp.success ) {
						const error_message = (  resp.data &&  resp.data.message ) ? resp.data.message : '';
						wpbc_admin_show_message( 'WPBC BFB: save failed.' + ' | ' + error_message, 'error', 10000 );
						console.error( 'WPBC BFB: save failed', resp );
						return;
					}

					if ( typeof done_cb === 'function' ) {
						try { done_cb( true, resp ); } catch ( _e2 ) {}
					}

					wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form:ajax_saved', {
						loaded_data: resp.data,
						form_name  : cfg.form_name || 'standard'
					} );

					// Optional: visual feedback.
					wpbc_admin_show_message( 'Form saved', 'success', 1000, false );
				}
			)
			.fail( function ( jqxhr ) {

				// Old behavior: status != 200 triggers done_cb(false, null).
				if ( typeof done_cb === 'function' ) {
					try { done_cb( false, null ); } catch ( _e3 ) {}
				}

				wpbc_admin_show_message( 'WPBC BFB: save HTTP error', 'error', 10000 );
				console.error( 'WPBC BFB: save HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText );
			} )
			.always( function () {

				// --- Busy END (always) ----------------------------------------------------------------------------------
				if ( $btn && $btn.length && typeof w.wpbc_bfb__button_busy_end === 'function' ) {
					w.wpbc_bfb__button_busy_end( $btn );
				} else if ( $btn && $btn.length ) {
					$btn.prop( 'disabled', false ).removeClass( 'wpbc-is-busy' );
				} else if ( btn ) {
					btn.disabled = false;
				}
			} );
	}

	function apply_advanced_mode_texts( advanced_form, content_form, advanced_mode_source ) {

		var af = ( advanced_form == null ) ? '' : String( advanced_form );
		var cf = ( content_form == null ) ? '' : String( content_form );

		// Always update underlying <textarea> so it works even if CodeMirror isn't inited yet.
		var ta_form    = d.getElementById( 'wpbc_bfb__advanced_form_editor' );
		var ta_content = d.getElementById( 'wpbc_bfb__content_form_editor' );

		if ( ta_form ) {
			ta_form.value = af;
		}
		if ( ta_content ) {
			ta_content.value = cf;
		}

		// Notify Advanced Mode module (if loaded) to sync CodeMirror + flags.
		wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:advanced_text:apply', {
			advanced_form       : af,
			content_form        : cf,
			advanced_mode_source: advanced_mode_source
		} );
	}

	/**
	 * LOAD: fetch FormConfig from PHP and hand structure to Builder.
	 *
	 * Also uses busy helpers if available.
	 */
	function wpbc_bfb__ajax_load_current_form( btn, done_cb ) {

		var cfg     = w.WPBC_BFB_Ajax || {};
		var builder = w.wpbc_bfb || null;

		var $btn = btn ? $( btn ) : null;

		// --- Busy START ----------------------------------------------------------------------------------------------
		if ( $btn && $btn.length ) {
			if ( typeof w.wpbc_bfb__button_busy_start === 'function' ) {          // FIX: guard
				w.wpbc_bfb__button_busy_start( $btn );
			} else {
				$btn.prop( 'disabled', true );
			}
		} else if ( btn ) {
			btn.disabled = true;
		}

		var payload = {
			action   : 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
			nonce    : cfg.nonce_load || '',
			form_name: cfg.form_name || 'standard'
		};

		wpbc_admin_show_message_processing( '' );
		// wpbc_admin_show_message( 'Processing', 'info', 1000, false );    // Optional: visual feedback.

		var ajax_request = wpbc_bfb__ajax_post( cfg.url, payload );

		ajax_request
			.done( function ( response_text, _text_status, jqxhr ) {

				if ( ! jqxhr || jqxhr.status !== 200 ) {

					if ( typeof done_cb === 'function' ) {
						try { done_cb( false, null ); } catch ( _e0 ) {}
					}

					wpbc_admin_show_message( 'WPBC BFB: load HTTP error', 'error', 10000 );
					console.error( 'WPBC BFB: load HTTP error', jqxhr ? jqxhr.status : 0 );
					return;
				}

				var resp = wpbc_bfb__safe_json_parse( response_text );
				if ( ! resp ) {
					wpbc_admin_show_message( 'WPBC BFB: load JSON parse error', 'error', 10000 );
					console.error( 'WPBC BFB: load JSON parse error', response_text );
					return;
				}

				if ( ! resp || ! resp.success || ! resp.data ) {
					wpbc_admin_show_message( 'WPBC BFB: load failed', 'error', 10000 );
					console.error( 'WPBC BFB: load failed', resp );
					return;
				}

				var data      = resp.data;
				var structure = data.structure || [];

				// Apply Advanced Mode saved texts (if provided by PHP).
				if ( data && ( typeof data.advanced_form !== 'undefined' || typeof data.content_form !== 'undefined' ) ) {
					var ams = '';
					try {
						var s1 = ( typeof data.settings === 'string' ) ? JSON.parse( data.settings ) : data.settings;
						ams = ( s1 && s1.bfb_options && s1.bfb_options.advanced_mode_source ) ? s1.bfb_options.advanced_mode_source : '';
					} catch ( _e1 ) {}

					apply_advanced_mode_texts(
						data.advanced_form || '',
						data.content_form || '',
						ams
					);
				}

				// Apply settings to UI (local form settings) if provided.
				if ( data.settings ) {
					var parsed_settings = null;
					try {
						parsed_settings = ( typeof data.settings === 'string' ) ? JSON.parse( data.settings ) : data.settings;
					} catch ( _e2 ) {
						parsed_settings = null;
					}
					if ( parsed_settings ) {
						wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form_settings:apply', {
							settings : parsed_settings,
							form_name: cfg.form_name || 'standard'
						} );
					}
				}

				wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form:ajax_loaded', {
					loaded_data: data,
					form_name  : cfg.form_name || 'standard'
				} );

				if ( typeof done_cb === 'function' ) {
					try { done_cb( true, data ); } catch ( _e3 ) {}
				}

				// Prefer your existing callback if it already knows how to init Builder.
				if ( typeof w.wpbc_bfb__on_structure_loaded === 'function' ) {
					w.wpbc_bfb__on_structure_loaded( structure );
					wpbc_admin_show_message( 'Done', 'info', 1000, false );
				} else if ( builder && typeof builder.load_structure === 'function' ) {
					builder.load_structure( structure );
					wpbc_admin_show_message( 'Done', 'info', 1000, false );
				} else {
					console.warn( 'WPBC BFB: no loader for structure', structure );
				}
			} )
			.fail( function ( jqxhr ) {

				if ( typeof done_cb === 'function' ) {
					try { done_cb( false, null ); } catch ( _e4 ) {}
				}

				wpbc_admin_show_message( 'WPBC BFB: load HTTP error', 'error', 10000 );
				console.error( 'WPBC BFB: load HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText );
			} )
			.always( function () {

				// --- Busy END (always) ----------------------------------------------------------------------------------
				if ( $btn && $btn.length && typeof w.wpbc_bfb__button_busy_end === 'function' ) {
					w.wpbc_bfb__button_busy_end( $btn );
				} else if ( $btn && $btn.length ) {
					$btn.prop( 'disabled', false ).removeClass( 'wpbc-is-busy' );
				} else if ( btn ) {
					btn.disabled = false;
				}
			} );
	}

	function wpbc_bfb__ajax_create_form( btn, create_payload, template_form_key, done_cb ) {

		var cfg = w.WPBC_BFB_Ajax || {};

		if ( ! cfg.url || ! cfg.nonce_create ) {
			wpbc_admin_show_message( 'WPBC BFB: create config is missing (url/nonce).', 'error', 10000 );
			if ( typeof done_cb === 'function' ) {
				done_cb( false, null );
			}
			return;
		}

		template_form_key = String( template_form_key || '' ).trim();
		if ( template_form_key === '__blank__' ) {
			template_form_key = '';
		}

		var payload = {
			action            : 'WPBC_AJX_BFB_CREATE_FORM_CONFIG',
			nonce             : cfg.nonce_create,
			form_name         : String( create_payload.form_slug || '' ),
			template_form_name: template_form_key || '',
			title             : String( create_payload.form_title || '' ),
			description       : String( create_payload.form_description || '' ),
			image_url         : String( create_payload.form_image_url || '' )
		};

		var ajax_request = wpbc_bfb__ajax_post( cfg.url, payload );

		ajax_request
			.done( function ( response_text, _text_status, jqxhr ) {

				if ( ! jqxhr || jqxhr.status !== 200 ) {
					wpbc_admin_show_message( 'WPBC BFB: create HTTP error', 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				var resp = wpbc_bfb__safe_json_parse( response_text );
				if ( ! resp ) {
					wpbc_admin_show_message( 'WPBC BFB: create JSON parse error', 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				if ( ! resp || ! resp.success || ! resp.data ) {
					var msg = ( resp && resp.data && resp.data.message ) ? resp.data.message : 'WPBC BFB: create failed';
					wpbc_admin_show_message( msg, 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, resp );
					}
					return;
				}

				// Switch current form to the newly created key.
				cfg.form_name = resp.data.form_name || create_payload.form_slug;

				if ( typeof done_cb === 'function' ) {
					done_cb( true, resp );
				}
			} )
			.fail( function ( jqxhr ) {
				wpbc_admin_show_message( 'WPBC BFB: create HTTP error', 'error', 10000 );
				if ( typeof done_cb === 'function' ) {
					done_cb( false, null );
				}
				console.error( 'WPBC BFB: create HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText );
			} );
	}

	// Load ALL Forms.
	function wpbc_bfb__ajax_list_user_forms( btn, args, done_cb ) {

		var cfg = w.WPBC_BFB_Ajax || {};

		if ( ! cfg.url || ! cfg.nonce_list ) {
			wpbc_admin_show_message( 'WPBC BFB: list config is missing (url/nonce_list).', 'error', 10000 );
			if ( typeof done_cb === 'function' ) {
				done_cb( false, null );
			}
			return;
		}

		var page  = ( args && args.page ) ? parseInt( args.page, 10 ) : 1;
		var limit = ( args && ( args.limit || args.per_page ) ) ? parseInt( ( args.limit || args.per_page ), 10 ) : 20;

		if ( ! page || page < 1 ) {
			page = 1;
		}
		if ( ! limit || limit < 1 ) {
			limit = 20;
		}

		var payload = {
			action        : 'WPBC_AJX_BFB_LIST_FORMS',
			nonce         : cfg.nonce_list,
			include_global: ( args && args.include_global ) ? 1 : 0,
			status        : ( args && args.status ) ? String( args.status ) : 'published',
			search        : ( args && args.search ) ? String( args.search ) : '',
			page          : page,
			limit         : limit
		};

		var ajax_request = wpbc_bfb__ajax_post( cfg.url, payload );

		ajax_request
			.done( function ( response_text, _text_status, jqxhr ) {

				if ( ! jqxhr || jqxhr.status !== 200 ) {
					wpbc_admin_show_message( 'WPBC BFB: list HTTP error', 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				var resp = wpbc_bfb__safe_json_parse( response_text );
				if ( ! resp ) {
					wpbc_admin_show_message( 'WPBC BFB: list JSON parse error', 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				if ( ! resp || ! resp.success || ! resp.data ) {
					wpbc_admin_show_message( 'WPBC BFB: list failed', 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, resp );
					}
					return;
				}

				if ( typeof done_cb === 'function' ) {
					done_cb( true, resp.data );
				}
			} )
			.fail( function ( jqxhr ) {
				wpbc_admin_show_message( 'WPBC BFB: list HTTP error', 'error', 10000 );
				if ( typeof done_cb === 'function' ) {
					done_cb( false, null );
				}
				console.error( 'WPBC BFB: list HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText );
			} );
	}

	function wpbc_bfb__ajax_load_form_by_slug( form_slug, btn, done_cb ) {

		var cfg     = w.WPBC_BFB_Ajax || {};
		var builder = w.wpbc_bfb || null;

		form_slug = String( form_slug || '' ).trim();
		if ( ! form_slug ) {
			if ( typeof done_cb === 'function' ) {
				done_cb( false, null );
			}
			return;
		}

		var $btn = btn ? $( btn ) : null;

		// Busy START
		if ( $btn && $btn.length ) {
			if ( typeof w.wpbc_bfb__button_busy_start === 'function' ) {
				w.wpbc_bfb__button_busy_start( $btn );
			} else {
				$btn.prop( 'disabled', true );
			}
		} else if ( btn ) {
			btn.disabled = true;
		}

		var payload = {
			action   : 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
			nonce    : cfg.nonce_load || '',
			form_name: form_slug
		};

		wpbc_admin_show_message_processing( '' );

		var ajax_request = wpbc_bfb__ajax_post( cfg.url, payload );

		ajax_request
			.done( function ( response_text, _text_status, jqxhr ) {

				if ( ! jqxhr || jqxhr.status !== 200 ) {
					wpbc_admin_show_message( 'WPBC BFB: load HTTP error', 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				var resp = wpbc_bfb__safe_json_parse( response_text );
				if ( ! resp ) {
					wpbc_admin_show_message( 'WPBC BFB: load JSON parse error', 'error', 10000 );
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				if ( ! resp || ! resp.success || ! resp.data ) {

					if ( resp && resp.data && resp.data.message ) {
						wpbc_admin_show_message( 'WPBC BFB: ' + resp.data.message, 'error', 10000 );
					} else {
						wpbc_admin_show_message( 'WPBC BFB: load failed', 'error', 10000 );
					}

					if ( typeof done_cb === 'function' ) {
						done_cb( false, resp );
					}
					return;
				}

				var data      = resp.data;
				var structure = data.structure || [];

				// IMPORTANT: switch "current form" after successful load
				cfg.form_name = form_slug;

				// Apply Advanced Mode texts if present.
				if ( data && ( typeof data.advanced_form !== 'undefined' || typeof data.content_form !== 'undefined' ) ) {

					var ams2 = '';
					try {
						var s2 = ( typeof data.settings === 'string' ) ? JSON.parse( data.settings ) : data.settings;
						ams2 = ( s2 && s2.bfb_options && s2.bfb_options.advanced_mode_source ) ? s2.bfb_options.advanced_mode_source : '';
					} catch ( _e2 ) {}

					apply_advanced_mode_texts(
						data.advanced_form || '',
						data.content_form || '',
						ams2
					);
				}

				// Apply settings if present.
				if ( data.settings ) {
					var parsed_settings = null;
					try {
						parsed_settings = ( typeof data.settings === 'string' ) ? JSON.parse( data.settings ) : data.settings;
					} catch ( _e3 ) {
						parsed_settings = null;
					}
					if ( parsed_settings ) {
						wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form_settings:apply', {
							settings : parsed_settings,
							form_name: cfg.form_name || 'standard'
						} );
					}
				}

				wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form:ajax_loaded', {
					loaded_data: data,
					form_name  : cfg.form_name || 'standard'
				} );

				if ( typeof done_cb === 'function' ) {
					try { done_cb( true, data ); } catch ( _e4 ) {}
				}

				if ( typeof w.wpbc_bfb__on_structure_loaded === 'function' ) {
					w.wpbc_bfb__on_structure_loaded( structure );
					wpbc_admin_show_message( 'Done', 'info', 1000, false );
				} else if ( builder && typeof builder.load_structure === 'function' ) {
					builder.load_structure( structure );
					wpbc_admin_show_message( 'Done', 'info', 1000, false );
				} else {
					console.warn( 'WPBC BFB: no loader for structure', structure );
				}
			} )
			.fail( function ( jqxhr ) {
				wpbc_admin_show_message( 'WPBC BFB: load HTTP error', 'error', 10000 );
				if ( typeof done_cb === 'function' ) {
					done_cb( false, null );
				}
				console.error( 'WPBC BFB: load HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText );
			} )
			.always( function () {

				// Busy END
				if ( $btn && $btn.length && typeof w.wpbc_bfb__button_busy_end === 'function' ) {
					w.wpbc_bfb__button_busy_end( $btn );
				} else if ( $btn && $btn.length ) {
					$btn.prop( 'disabled', false ).removeClass( 'wpbc-is-busy' );
				} else if ( btn ) {
					btn.disabled = false;
				}
			} );
	}

	function wpbc_bfb__ajax_delete_template_by_slug( form_slug, done_cb ) {

		var cfg          = w.WPBC_BFB_Ajax || {};
		var delete_nonce = cfg.nonce_delete || cfg.nonce_list || '';

		form_slug = String( form_slug || '' ).trim();

		if ( ! form_slug ) {
			if ( typeof done_cb === 'function' ) {
				done_cb( false, { data: { message: 'Template key is required.' } } );
			}
			return;
		}

		if ( ! cfg.url || ! delete_nonce ) {
			console.error( 'WPBC BFB: delete template config is missing (url/nonce).' );
			if ( typeof done_cb === 'function' ) {
				done_cb( false, { data: { message: 'WPBC BFB: delete template config is missing (url/nonce).' } } );
			}
			return;
		}

		var payload = {
			action   : 'WPBC_AJX_BFB_DELETE_TEMPLATE_CONFIG',
			nonce    : delete_nonce,
			form_name: form_slug
		};

		var ajax_request = wpbc_bfb__ajax_post( cfg.url, payload );

		ajax_request
			.done( function ( response_text, _text_status, jqxhr ) {

				if ( ! jqxhr || jqxhr.status !== 200 ) {
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				var resp = wpbc_bfb__safe_json_parse( response_text );
				if ( ! resp ) {
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				if ( ! resp.success ) {
					if ( typeof done_cb === 'function' ) {
						done_cb( false, resp );
					}
					return;
				}

				if ( typeof done_cb === 'function' ) {
					done_cb( true, resp );
				}
			} )
			.fail( function ( jqxhr ) {
				if ( typeof done_cb === 'function' ) {
					done_cb( false, null );
				}
				console.error( 'WPBC BFB: delete template HTTP error', jqxhr && jqxhr.status, jqxhr && jqxhr.statusText );
			} );
	}


	// Expose globals for buttons (onclick attributes).
	w.wpbc_bfb__ajax_delete_template_by_slug = wpbc_bfb__ajax_delete_template_by_slug;
	w.wpbc_bfb__ajax_save_current_form       = wpbc_bfb__ajax_save_current_form;
	w.wpbc_bfb__ajax_load_current_form       = wpbc_bfb__ajax_load_current_form;
	w.wpbc_bfb__ajax_create_form             = wpbc_bfb__ajax_create_form;
	w.wpbc_bfb__ajax_list_user_forms         = wpbc_bfb__ajax_list_user_forms;
	w.wpbc_bfb__ajax_load_form_by_slug       = wpbc_bfb__ajax_load_form_by_slug;

})( window, document, window.jQuery );


// -- Ajax Helpers: ----------------------------------------------------------------------------------------------------
/**
 * Common callback used by loaders that return structure JSON.
 *
 * @param val
 */
function wpbc_bfb__on_structure_loaded( val ) {
	try {
		if ( typeof val === 'string' ) {
			val = JSON.parse( val );
		}
		var builder = window.wpbc_bfb || null;                       // FIX: use window.*
		if ( builder && typeof builder.load_saved_structure === 'function' ) {
			builder.load_saved_structure( val || [] );
		}
	} catch ( e ) {
		wpbc_admin_show_message( 'wpbc_bfb__on_structure_loaded error', 'error', 10000 );
		console.error( 'wpbc_bfb__on_structure_loaded error', e );
	}
}

function wpbc_bfb__get_ajax_url() {
	if ( typeof ajaxurl !== 'undefined' && ajaxurl ) {
		return ajaxurl;
	}

	var AjaxCfg = window.WPBC_BFB_Ajax || {};                        // FIX: guard via window.*
	if ( AjaxCfg.url ) {
		return AjaxCfg.url;
	}

	wpbc_admin_show_message( 'WPBC BFB: ajax URL is missing.', 'error', 10000 );
	console.error( 'WPBC BFB: ajax URL is missing.' );
	return '';
}


// -- Shared helpers: button busy state --------------------------------------------------------------------------------
function wpbc_bfb__button_busy_start( $btn ) {

	if ( ! $btn || ! $btn.length ) return;

	var original_html = $btn.html();
	var busy_text     = $btn.data( 'wpbc-u-busy-text' ) || '';
	var spinner_html  = '<span class="wpbc_icn_rotate_right wpbc_spin wpbc_ajax_icon wpbc_processing wpbc_icn_autorenew" aria-hidden="true"></span>';

	$btn
		.data( 'wpbc-original-html', original_html )
		.prop( 'disabled', true )
		.addClass( 'wpbc-is-busy' );

	if ( busy_text ) {
		$btn.html( busy_text + ' ' + spinner_html );
	} else {
		$btn.append( spinner_html );
	}
}

function wpbc_bfb__button_busy_end( $btn ) {
	if ( ! $btn || ! $btn.length ) return;

	var original = $btn.data( 'wpbc-original-html' );
	if ( typeof original === 'string' ) {
		$btn.html( original );
	}
	$btn
		.prop( 'disabled', false )
		.removeClass( 'wpbc-is-busy' )
		.removeData( 'wpbc-original-html' );
}


// -- Import Helpers: --------------------------------------------------------------------------------------------------
/**
 * Import from Simple Form — with busy state
 *
 * @param btn
 */
function wpbc_bfb__import_from_simple_form( btn ) {
	try {
		var $btn   = jQuery( btn );
		var nonce  = $btn.data( 'wpbc-bfb-import-nonce' );
		var action = $btn.data( 'wpbc-bfb-import-action' ) || 'wpbc_bfb_import_simple_form';

		if ( ! nonce ) {
			wpbc_admin_show_message( 'WPBC BFB: missing import nonce.', 'error', 10000 );
			console.error( 'WPBC BFB: missing import nonce.' );
			return;
		}

		var ajax_url = wpbc_bfb__get_ajax_url();
		if ( ! ajax_url ) {
			return;
		}

		wpbc_bfb__button_busy_start( $btn );

		wpbc_admin_show_message_processing( '' );

		jQuery.post( ajax_url, {
			action: action,
			nonce : nonce
		} )
			.done( function ( resp ) {
				if ( resp && resp.success && resp.data && resp.data.structure ) {
					var builder = window.wpbc_bfb || null;           // FIX: use window.*
					if ( builder && typeof builder.load_saved_structure === 'function' ) {
						builder.load_saved_structure( resp.data.structure || [] );
						wpbc_admin_show_message( 'Done', 'info', 1000, false );
					}
				} else {
					wpbc_admin_show_message( 'WPBC BFB: import error', 'error', 10000 );
					console.error( 'WPBC BFB: import error', resp );
				}
			} )
			.fail( function ( xhr ) {
				wpbc_admin_show_message( 'WPBC BFB: AJAX error', 'error', 10000 );
				console.error( 'WPBC BFB: AJAX error', xhr.status, xhr.statusText );
			} )
			.always( function () {
				wpbc_bfb__button_busy_end( $btn );
			} );

	} catch ( e ) {
		wpbc_admin_show_message( 'WPBC BFB: import exception', 'error', 10000 );
		console.error( 'WPBC BFB: import exception', e );
	}
}

/**
 * Import legacy booking forms into BFB storage.
 *
 * Supported modes:
 * - current_context
 * - all_global
 * - all_users
 *
 * @param btn
 */
function wpbc_bfb__import_legacy_forms( btn ) {
	try {
		var $btn   = jQuery( btn );
		var nonce  = $btn.data( 'wpbc-bfb-import-nonce' );
		var action = $btn.data( 'wpbc-bfb-import-action' ) || 'WPBC_AJX_BFB_IMPORT_LEGACY_FORMS';
		var mode   = $btn.data( 'wpbc-bfb-import-mode' ) || 'current_context';

		var skip_if_exists           = $btn.data( 'wpbc-bfb-skip-if-exists' ) || 'skip';
		var set_bfb_form_not_defined = $btn.data( 'wpbc-bfb-set-form-not-defined' ) || 'not_defined';

		if ( ! nonce ) {
			wpbc_admin_show_message( 'WPBC BFB: missing legacy import nonce.', 'error', 10000 );
			console.error( 'WPBC BFB: missing legacy import nonce.' );
			return;
		}

		var ajax_url = wpbc_bfb__get_ajax_url();
		if ( ! ajax_url ) {
			return;
		}

		wpbc_bfb__button_busy_start( $btn );
		wpbc_admin_show_message_processing( '' );

		jQuery.post( ajax_url, {
			action                  : action,
			nonce                   : nonce,
			mode                    : mode,
			skip_if_exists          : skip_if_exists,
			set_bfb_form_not_defined: set_bfb_form_not_defined,
		} )
			.done( function ( resp ) {

				if ( resp && resp.success && resp.data ) {

					var msg = resp.data.message || 'Legacy forms import finished.';
					wpbc_admin_show_message( msg, 'success', 6000, false );

					if ( resp.data.imported ) {
						// Reload current form,  if imported some forms.
						wpbc_bfb__ajax_load_current_form( null );
					}

					try {
						jQuery( document ).trigger( 'wpbc_bfb_legacy_forms_imported', [ resp.data ] );
					} catch ( _e ) {}

				} else {
					wpbc_admin_show_message( 'WPBC BFB: legacy forms import error', 'error', 10000 );
					console.error( 'WPBC BFB: legacy forms import error', resp );
				}
			} )
			.fail( function ( xhr ) {
				wpbc_admin_show_message( 'WPBC BFB: legacy forms AJAX error', 'error', 10000 );
				console.error( 'WPBC BFB: legacy forms AJAX error', xhr.status, xhr.statusText );
			} )
			.always( function () {
				wpbc_bfb__button_busy_end( $btn );
			} );

	} catch ( e ) {
		wpbc_admin_show_message( 'WPBC BFB: legacy forms import exception', 'error', 10000 );
		console.error( 'WPBC BFB: legacy forms import exception', e );
	}
}
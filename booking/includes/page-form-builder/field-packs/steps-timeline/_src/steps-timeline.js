// File: /includes/page-form-builder/field-packs/steps-timeline/_out/steps-timeline.js
(function (w, d) {
	'use strict';

	var Core     = w.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		_wpbc?.dev?.error?.( 'wpbc_bfb_field_steps_timeline', 'Core registry/base missing' );
		return;
	}

	/**
	 * Field Renderer: steps_timeline
	 * - Renders states: "completed", "active", "future"
	 * - Adds active connector segments via ".wpbc_steps_for_timeline_line_active"
	 * - Scopes color with legacy class suffix + inline CSS var injection
	 *
	 * @class wpbc_bfb_field_steps_timeline
	 * @extends Core.WPBC_BFB_Field_Base
	 */
	class wpbc_bfb_field_steps_timeline extends Base {

		/**
		 * Return default props for "steps_timeline".
		 * Must stay in sync with PHP schema defaults.
		 *
		 * @jDoc
		 * @returns {{type:string,steps_count:number,active_step:number,color:string,cssclass_extra:string,name:string,html_id:string,help:string,usage_key:string}}
		 */
		static get_defaults() {
			return {
				type            : 'steps_timeline',
				steps_count     : 3,
				active_step     : 1,
				color           : '#619d40',
				cssclass_extra  : '',
				name            : '',
				html_id         : '',
				help            : '',
				usage_key       : 'steps_timeline'
			};
		}

		/**
		 * Clamp integer into [min,max], falling back to def if NaN.
		 *
		 * @jDoc
		 * @param {any} v    Raw value to clamp.
		 * @param {number} min Minimum allowed value.
		 * @param {number} max Maximum allowed value.
		 * @param {number} def Default to use if v is NaN.
		 * @returns {number} Clamped integer.
		 */
		static clamp_int( v, min, max, def ) {
			var n = parseInt( v, 10 );
			if ( isNaN( n ) ) { n = def; }
			if ( n < min ) { n = min; }
			if ( n > max ) { n = max; }
			return n;
		}

		/**
		 * Create a stable per-element numeric suffix used in the scoped class name.
		 * Persists in element dataset to remain stable across re-renders.
		 *
		 * @jDoc
		 * @param {HTMLElement} el Field wrapper element.
		 * @returns {string} Numeric suffix (e.g., "6614").
		 */
		static ensure_scope_suffix( el ) {
			var suffix = el && el.dataset ? el.dataset.steps_scope_suffix : '';
			if ( suffix ) {
				return suffix;
			}
			try {
				var stab = el.getAttribute( 'data-id' ) || el.getAttribute( 'data-name' ) || '';
				if ( stab ) {
					var m = String( stab ).match( /(\d{3,})$/ );
					suffix = m ? m[1] : String( Math.floor( Math.random() * 9000 ) + 1000 );
				} else {
					suffix = String( Math.floor( Math.random() * 9000 ) + 1000 );
				}
			} catch (e) {
				suffix = String( Math.floor( Math.random() * 9000 ) + 1000 );
			}
			if ( el && el.dataset ) {
				el.dataset.steps_scope_suffix = suffix;
			}
			return suffix;
		}

		/**
		 * Build a step node by visual state.
		 *
		 * @jDoc
		 * @param {'completed'|'active'|'future'} state Step visual state.
		 * @returns {string} HTML string of a single step node.
		 */
		static build_step_node_html( state ) {
			var cls = 'wpbc_steps_for_timeline_step';
			if ( state === 'completed' ) { cls += ' wpbc_steps_for_timeline_step_completed'; }
			if ( state === 'active' )    { cls += ' wpbc_steps_for_timeline_step_active'; }

			return '' +
				'<div class="' + cls + '">' +
					'<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img" class="icon icon-success" aria-hidden="true" width="10" height="10">' +
						'<path fill="currentColor" d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"></path>' +
					'</svg>' +
					'<svg viewBox="0 0 352 512" xmlns="http://www.w3.org/2000/svg" role="img" class="icon icon-failed" aria-hidden="true" width="8" height="11">' +
						'<path fill="currentColor" d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path>' +
					'</svg>' +
				'</div>';
		}

		/**
		 * Build connector line, optionally marked as active (completed segment).
		 *
		 * @jDoc
		 * @param {boolean} is_active True to add "wpbc_steps_for_timeline_line_active".
		 * @returns {string} HTML string for a connector line.
		 */
		static build_step_line_html( is_active ) {
			var cls = 'wpbc_steps_for_timeline_step_line';
			if ( is_active ) { cls += ' wpbc_steps_for_timeline_line_active'; }
			return '<div class="' + cls + '"></div>';
		}

		/**
		 * Render the preview markup into the field element.
		 * - Generates `.wpbc_steps_for_timeline__steps_timeline{suffix}` scope class (legacy "timline" spelling).
		 * - Injects scoped CSS variable rule for front-end: `.booking_form_div .{scope} .wpbc_steps_for_timeline_container{ --wpbc_steps_for_timeline_active_color:#hex; }`
		 * - Adds minimal base CSS once if external CSS not enqueued.
		 *
		 * @jDoc
		 * @param {HTMLElement} el Field root element inside the canvas.
		 * @param {Object} data Field props (already normalized by schema).
		 * @param {{builder?:any, sanit?:any}} [ctx]  Context object.
		 * @returns {void}
		 */
		static render( el, data, ctx ) {
			if ( ! el ) { return; }

			var d            = this.normalize_data( data );
			var esc_html     = (v) => Core.WPBC_BFB_Sanitize.escape_html( v );
			var sanitize_id  = (v) => Core.WPBC_BFB_Sanitize.sanitize_html_id( v );
			var sanitize_name= (v) => Core.WPBC_BFB_Sanitize.sanitize_html_name( v );
			var sanitize_cls = (v) => Core.WPBC_BFB_Sanitize.sanitize_css_classlist( v );
			var sanitize_hex = (v) => Core.WPBC_BFB_Sanitize.sanitize_hex_color( v, '#619d40' );

			var steps_count  = wpbc_bfb_field_steps_timeline.clamp_int( d.steps_count, 2, 12, 3 );
			var active_step  = wpbc_bfb_field_steps_timeline.clamp_int( d.active_step, 1, steps_count, 1 );
			var color_val    = sanitize_hex( d.color );

			var html_id      = d.html_id ? sanitize_id( String( d.html_id ) ) : '';
			var name_val     = d.name    ? sanitize_name( String( d.name ) )  : '';
			var cls_extra    = sanitize_cls( String( d.cssclass_extra || '' ) );

			if ( String( el.dataset.steps_count ) !== String( steps_count ) ) { el.dataset.steps_count = String( steps_count ); }
			if ( String( el.dataset.active_step ) !== String( active_step ) ) { el.dataset.active_step = String( active_step ); }
			if ( el.dataset.color !== color_val ) { el.dataset.color = color_val; }
			if ( el.dataset.cssclass_extra !== cls_extra ) { el.dataset.cssclass_extra = cls_extra; }
			if ( el.dataset.html_id !== html_id ) { el.dataset.html_id = html_id; }
			if ( el.dataset.name !== name_val ) { el.dataset.name = name_val; }

			// Scope class with legacy "timline" spelling + numeric suffix
			var scope_suffix = wpbc_bfb_field_steps_timeline.ensure_scope_suffix( el );
			var scope_cls    = 'wpbc_steps_for_timeline__steps_timeline' + scope_suffix;

			var id_attr      = html_id ? ' id="' + esc_html( html_id ) + '"' : '';
			var name_attr    = name_val ? ' name="' + esc_html( name_val ) + '"' : '';
			var cls_attr     = cls_extra ? ' class="' + esc_html( cls_extra ) + '"' : '';

			// Build markup with states + active lines BEFORE the active step
			var parts = [];
			for ( var i = 1; i <= steps_count; i++ ) {
				var state = (i < active_step) ? 'completed' : (i === active_step ? 'active' : 'future');
				parts.push( wpbc_bfb_field_steps_timeline.build_step_node_html( state ) );
				if ( i < steps_count ) {
					var is_active_line = (i < active_step);
					parts.push( wpbc_bfb_field_steps_timeline.build_step_line_html( is_active_line ) );
				}
			}

			var help_html = d.help ? '<div class="wpbc_bfb__help">' + esc_html( String( d.help ) ) + '</div>' : '';

			// Scoped inline CSS rule for frontend (within .booking_form_div)
			var style_id = 'wpbc_bfb_steps_timeline_style__' + scope_suffix;
			var css_rule = '.booking_form_div .' + scope_cls + ' .wpbc_steps_for_timeline_container{' +
				'--wpbc_steps_for_timeline_active_color:' + esc_html( color_val ) + ';' +
			'}';

			el.innerHTML =
				'<style id="' + style_id + '">' + css_rule + '</style>' +
				'<span class="' + scope_cls + ' wpbc_bfb__no-drag-zone" inert="">' +
					'<div class="wpbc_steps_for_timeline_container"' + id_attr + name_attr + cls_attr +
						' style="--wpbc_steps_for_timeline_active_color:' + esc_html( color_val ) + ';">' +
						'<div class="wpbc_steps_for_timeline" role="list" aria-label="Steps timeline">' +
							parts.join( '' ) +
						'</div>' +
					'</div>' +
					help_html +
				'</span>';

			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		/**
		 * Optional hook executed after field is dropped from the palette.
		 * Keeps base behavior (auto-name, auto-id).
		 *
		 * @jDoc
		 * @param {Object} data Field data snapshot.
		 * @param {HTMLElement} el Field element.
		 * @param {{palette_item?: HTMLElement}} [ctx] Context with palette_item.
		 * @returns {void}
		 */
		static on_field_drop( data, el, ctx ) {
			try { super.on_field_drop?.( data, el, ctx ); } catch (e) {}
		}
	}

	// Register renderer.
	try {
		registry.register( 'steps_timeline', wpbc_bfb_field_steps_timeline );
	} catch (e) { _wpbc?.dev?.error?.( 'wpbc_bfb_field_steps_timeline.register', e ); }


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Form" (Advanced Form shortcode)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Register Booking Form exporter callback (Advanced Form) for "steps_timeline".
	 *
	 * This exporter:
	 *  - Emits the legacy shortcode:
	 *        [steps_timeline steps_count="N" active_step="K" color="#hex"]
	 *    wrapped optionally in:
	 *        <span id="…" class="…" style="flex:1;">…</span>
	 *  - Keeps behavior compatible with the previous centralized exporter:
	 *      • clamps steps_count to [2,12] (default 3),
	 *      • clamps active_step to [1,steps_count] (default 1),
	 *      • sanitizes color via sanitize_hex_color() with default "#619d40",
	 *      • ensures unique html_id via extras.ctx.usedIds (if provided),
	 *      • renders help inline inside the wrapper and clears field.help
	 *        to prevent outer duplication.
	 */
	function register_steps_timeline_booking_form_exporter() {

		var Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'steps_timeline' ) ) { return; }

		var S           = Core.WPBC_BFB_Sanitize || {};
		var esc_html    = S.escape_html            || function( v ){ return String( v ).replace( /[<>&"]/g, '' ); };
		var sanitizeId  = S.sanitize_html_id       || function( v ){ return String( v ).trim(); };
		var sanitizeCls = S.sanitize_css_classlist || function( v ){ return String( v ).trim(); };
		var sanitizeHex = S.sanitize_hex_color     || function( v, def ){
			if ( typeof v === 'string' && /^#?[0-9a-f]{3,8}$/i.test( v ) ) {
				return ( v.charAt( 0 ) === '#' ) ? v : ( '#' + v );
			}
			return def || '#619d40';
		};

		/**
		 * @type {WPBC_BFB_ExporterCallback}
		 * @param {Object} field
		 * @param {function(string):void} emit
		 * @param {{ctx?:{usedIds?:Set<any>}}} [extras]
		 */
		var exporter_callback = function( field, emit, extras ) {

			extras = extras || {};

			// Clamp steps_count into [2,12], default 3 (legacy behavior).
			var sc = parseInt( field && field.steps_count, 10 );
			if ( isNaN( sc ) ) { sc = 3; }
			if ( sc < 2 ) { sc = 2; }
			if ( sc > 12 ) { sc = 12; }

			// Clamp active_step into [1,steps_count], default 1 (legacy behavior).
			var as = parseInt( field && field.active_step, 10 );
			if ( isNaN( as ) ) { as = 1; }
			if ( as < 1 ) { as = 1; }
			if ( as > sc ) { as = sc; }

			// Sanitize color with default.
			var col = sanitizeHex( field && field.color, '#619d40' );

			// Sanitize id/class for outer <span>.
			var html_id = ( field && field.html_id ) ? sanitizeId( String( field.html_id ) ) : '';
			var cls_raw = String(
				( field && ( field.cssclass_extra || field.cssclass || field['class'] ) ) || ''
			);
			var cls_val = sanitizeCls( cls_raw );

			// Ensure html_id is unique across export (shared ctx.usedIds set).
			var used_ids = extras && extras.ctx && extras.ctx.usedIds;
			if ( html_id && used_ids instanceof Set ) {
				var unique = html_id;
				var i      = 2;
				while ( used_ids.has( unique ) ) {
					unique = html_id + '_' + ( i++ );
				}
				used_ids.add( unique );
				html_id = unique;
			}

			var id_attr  = html_id ? ( ' id="' + esc_html( html_id ) + '"' ) : '';
			var cls_attr = cls_val ? ( ' class="' + esc_html( cls_val ) + '"' ) : '';

			// Help inside the wrapper (legacy behavior).
			var help_html = ( field && field.help ) ? '<div class="wpbc_field_description">' + esc_html( String( field.help ) ) + '</div>' : '';

			// Only wrap in <span ... style="flex:1;"> if id or class exists.
			var has_wrapper = !! ( id_attr || cls_attr );
			var open        = has_wrapper ? ( '<span' + id_attr + cls_attr + ' style="flex:1;">' ) : '';
			var close       = has_wrapper ? '</span>' : '';

			// Legacy shortcode name spelling is intentional: "steps_timeline".
			emit(
				open +
					'[steps_timeline steps_count="' + sc + '" active_step="' + as + '" color="' + col + '"]' +
					help_html +
				close
			);

			// Prevent outer wrapper from printing help again.
			if ( field ) {
				field.help = '';
			}
		};

		Exp.register( 'steps_timeline', exporter_callback );
	}

	if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
		register_steps_timeline_booking_form_exporter();
	} else {
		d.addEventListener( 'wpbc:bfb:exporter-ready', register_steps_timeline_booking_form_exporter, { once: true } );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Export for "Booking Data" (Content of booking fields data)
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 * Register Booking Data exporter callback ("Content of booking fields data") for "steps_timeline".
	 *
	 * Steps Timeline is purely presentational and does not carry user-entered values,
	 * so it is intentionally omitted from the "Content of booking fields data" output.
	 */
	function register_steps_timeline_booking_data_exporter() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'steps_timeline' ) ) { return; }

		/**
		 * @param {Object} field
		 * @param {function(string):void} emit
		 * @param {Object} [extras]
		 * @returns {void}
		 */
		var exporter_callback = function( field, emit, extras ) {
			// Intentionally empty: steps_timeline has no dynamic token/value
			// to show in booking data.
			return;
		};

		C.register( 'steps_timeline', exporter_callback );
	}

	if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_steps_timeline_booking_data_exporter();
	} else {
		d.addEventListener( 'wpbc:bfb:content-exporter-ready', register_steps_timeline_booking_data_exporter, { once: true } );
	}


})( window, document );

// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/field-packs/calendar/_out/calendar.js
// == Pack  Calendar (WP-template–driven) — minimal, modern, and Builder-focused renderer
// == Compatible with PHP pack: ../calendar.php (version 1.2.2)
// ---------------------------------------------------------------------------------------------------------------------
(function (w) {
	'use strict';

	// Direct dev logger alias (snake format); no local wrappers.
	const dev = (w._wpbc && w._wpbc.dev) ? w._wpbc.dev : { log(){}, error(){} };

	// Core singletons from the Builder.
	var Core       = w.WPBC_BFB_Core || {};
	var Registry   = Core.WPBC_BFB_Field_Renderer_Registry;
	var Field_Base = Core.WPBC_BFB_Field_Base || null;

	if ( !Registry || !Registry.register ) {
		dev.error( 'WPBC_BFB_Field_Calendar', 'Registry missing — load bfb-core first.' );
		return;
	}

	// Localized boot payload from PHP (calendar.php::enqueue_js()).
	var Boot = w.WPBC_BFB_CalendarBoot || {};

	// Remember which resource IDs already have their data loaded this session.
	var rid_loaded_cache = Object.create( null );

	// -----------------------------------------------------------------------------------------------------------------
	// Resource ID Helpers
	// -----------------------------------------------------------------------------------------------------------------
	/**
	 *  Get configured preview booking resource ID from localized boot data.
	 *
	 * @returns {number}
	 */
	function get_configured_preview_resource_id() {
		var rid = Number( Boot.default_preview_resource_id || 1 );
		rid     = isFinite( rid ) ? Math.max( 1, Math.floor( rid ) ) : 1;
		return rid;
	}

	/**
	 * Get first existing booking resource ID from localized boot data.
	 *
	 * @returns {number}
	 */
	function get_first_existing_resource_id() {

		var resources = Array.isArray( Boot.booking_resources ) ? Boot.booking_resources : [];

		for ( var i = 0; i < resources.length; i++ ) {
			var id = Number( resources[i] && resources[i].booking_type_id );
			if ( isFinite( id ) && id > 0 ) {
				return Math.floor( id );
			}
		}

		return 1;
	}

	/**
	 * Resolve effective preview booking resource ID.
	 * Priority:
	 * 1. Configured default preview resource, if it exists
	 * 2. Provided rid, if it exists
	 * 3. First existing booking resource
	 * 4. Fallback to 1
	 *
	 * @param {number} rid_candidate
	 * @returns {number}
	 */
	function resolve_effective_resource_id(rid_candidate) {

		var resources = Array.isArray( Boot.booking_resources ) ? Boot.booking_resources : [];
		var configured_rid = get_configured_preview_resource_id();
		var candidate = Number( rid_candidate || 1 );

		function resource_exists(id) {
			id = Number( id || 1 );
			if ( ! isFinite( id ) || id <= 0 ) {
				return false;
			}

			for ( var i = 0; i < resources.length; i++ ) {
				if ( Number( resources[i] && resources[i].booking_type_id ) === id ) {
					return true;
				}
			}
			return false;
		}

		if ( resource_exists( configured_rid ) ) {
			return configured_rid;
		}

		if ( resource_exists( candidate ) ) {
			return candidate;
		}

		return get_first_existing_resource_id();
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Small utilities
	// -----------------------------------------------------------------------------------------------------------------

	/**
	 * Debounce wrapper.
	 *
	 * @param {Function} fn
	 * @param {number}   ms
	 * @returns {Function}
	 */
	function debounce(fn, ms) {
		var t;
		return function () {
			var a = arguments;
			clearTimeout( t );
			t = setTimeout( function () {
				fn.apply( null, a );
			}, ms );
		};
	}

	/**
	 * Wait until calendar API is present in the window (e.g., wpbc_calendar_show).
	 *
	 * @param {Function} cb           Callback when ready.
	 * @param {number}   max_tries    Maximum retry attempts.
	 * @param {number}   delay_ms     Delay between attempts.
	 */
	function wait_until_api_ready(cb, max_tries, delay_ms) {
		var tries = 0;
		(function tick() {
			if ( typeof w.wpbc_calendar_show === 'function' ) {
				try {
					cb();
				} catch ( e ) {
					dev.error( 'api_ready_cb', e );
				}
				return;
			}
			if ( tries++ >= (max_tries || 40) ) {
				dev.log( 'calendar_api_not_ready_after_retries' );
				return;
			}
			w.setTimeout( tick, delay_ms || 100 );
		})();
	}

	/**
	 * Apply "months in row" class to container element.
	 *
	 * @param {Element} field_el  Field root element (wrap).
	 * @param {number}  months    1..12
	 */
	function apply_months_class(field_el, months) {
		var cont = field_el ? field_el.querySelector( '.wpbc_cal_container' ) : null;
		if ( ! cont ) {
			return;
		}
		// Remove existing cal_month_num_* safely via classList.
		Array.from( cont.classList ).forEach( function (c) {
			if ( /^cal_month_num_\d+$/.test( c ) ) {
				cont.classList.remove( c );
			}
		} );
		cont.classList.add( 'cal_month_num_' + months );
	}

	/**
	 * Set secure parameters (nonce, user_id, locale) before any AJAX calls.
	 */
	function set_secure_params() {
		try {
			if ( !(w._wpbc && typeof w._wpbc.set_secure_param === 'function') ) {
				return;
			}
			if ( Boot.nonce ) {
				w._wpbc.set_secure_param( 'nonce', String( Boot.nonce ) );
			}
			if ( Boot.user_id != null ) {
				w._wpbc.set_secure_param( 'user_id', String( Boot.user_id ) );
			}
			if ( Boot.locale ) {
				w._wpbc.set_secure_param( 'locale', String( Boot.locale ) );
			}
		} catch ( e ) {
			dev.log( 'secure_params_skip', e );
		}
	}

	/**
	 * Builder canvas preview starts at next month so it does not mostly show past/unavailable dates near month end.
	 *
	 * @returns {number[]} [year, month]
	 */
	function get_canvas_next_month_scroll_to() {
		var today_arr = null;

		try {
			if ( w._wpbc && typeof w._wpbc.get_other_param === 'function' ) {
				today_arr = w._wpbc.get_other_param( 'today_arr' );
			}
		} catch ( e ) {
		}

		var base_date = new Date();
		if ( today_arr && today_arr.length >= 2 ) {
			base_date = new Date( Number( today_arr[0] ), Number( today_arr[1] ) - 1, 1 );
		} else {
			base_date.setDate( 1 );
		}

		base_date.setMonth( base_date.getMonth() + 1 );

		return [ base_date.getFullYear(), base_date.getMonth() + 1 ];
	}

	/**
	 * Push calendar environment parameters for a specific resource and months count.
	 * We *directly* set parameters (no global polyfill) to keep this file self-contained.
	 *
	 * @param {number} rid
	 * @param {number} months
	 */
	function set_calendar_params(rid, months) {
		var L = Boot || {};
		try {
			if ( w._wpbc && typeof w._wpbc.balancer__set_max_threads === 'function' ) {
				w._wpbc.balancer__set_max_threads( Number( L.balancer_max_threads || 1 ) );
			}
		} catch ( e ) {
		}

		function set_param(k, v) {
			try {
				if ( w._wpbc && typeof w._wpbc.calendar__set_param_value === 'function' ) {
					w._wpbc.calendar__set_param_value( rid, k, v );
				}
			} catch ( e ) {
			}
		}

		if ( L.booking_max_monthes_in_calendar != null ) {
			set_param( 'booking_max_monthes_in_calendar', String( L.booking_max_monthes_in_calendar ) );
		}
		if ( L.booking_start_day_weeek != null ) {
			set_param( 'booking_start_day_weeek', String( L.booking_start_day_weeek ) );
		}
		set_param( 'calendar_number_of_months', String( months ) );
		set_param( 'calendar_scroll_to', get_canvas_next_month_scroll_to() );

		if ( L.booking_date_format ) {
			set_param( 'booking_date_format', String( L.booking_date_format ) );
		}
		if ( L.booking_time_format ) {
			set_param( 'booking_time_format', String( L.booking_time_format ) );
		}

		var ds = L.days_selection || {};
		set_param( 'days_select_mode', String( ds.days_select_mode || 'multiple' ) );
		set_param( 'fixed__days_num', Number( ds.fixed__days_num || 0 ) );
		if ( ds.fixed__week_days__start != null ) {
			set_param( 'fixed__week_days__start', [ String( ds.fixed__week_days__start ) ] );
		}
		set_param( 'dynamic__days_min', Number( ds.dynamic__days_min || 0 ) );
		set_param( 'dynamic__days_max', Number( ds.dynamic__days_max || 0 ) );
		if ( ds.dynamic__days_specific != null ) {
			var arr = String( ds.dynamic__days_specific || '' ).split( /\s*,\s*/ ).filter( Boolean ).map( Number );
			set_param( 'dynamic__days_specific', arr );
		}
		if ( ds.dynamic__week_days__start != null ) {
			set_param( 'dynamic__week_days__start', [ String( ds.dynamic__week_days__start ) ] );
		}

		try {
			if ( typeof w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm === 'function' ) {
				w.wpbc__conditions__SAVE_INITIAL__days_selection_params__bm( rid );
			}
		} catch ( e ) {
		}
	}

	/**
	 * Extract sanitized rid and months from data or DOM.
	 *
	 * @param {Element} field_el
	 * @param {object}  data
	 * @returns {{rid:number, months:number}}
	 */
	function get_rid_and_months(field_el, data) {
		var rid    = 1;
		var months = 1;

		// NEW: prefer dataset on the wrap (Inspector edits land here first)
		var wrap = field_el ? (field_el.closest && field_el.closest('.wpbc_calendar_wraper')) || field_el : null;
		if (wrap && wrap.dataset) {
			if (wrap.dataset.resource_id != null && wrap.dataset.resource_id !== '') {
				rid = Number(wrap.dataset.resource_id);
			}
			if (wrap.dataset.months != null && wrap.dataset.months !== '') {
				months = Number(wrap.dataset.months);
			}
		}

		if ( data && data.resource_id != null ) {
			rid = Number( data.resource_id );
		}
		if ( data && data.months != null ) {
			months = Number( data.months );
		}

		if ( !data ) {
			// Fallbacks from DOM when data object is not provided.
			var n = field_el ? field_el.querySelector( '[id^="calendar_booking"]' ) : null;
			if ( n && n.id ) {
				var m1 = n.id.match( /calendar_booking(\d+)/ );
				if ( m1 ) {
					rid = Number( m1[1] );
				}
			}
			var cont = field_el ? field_el.querySelector( '.wpbc_cal_container' ) : null;
			if ( cont && cont.className ) {
				var m2 = cont.className.match( /cal_month_num_(\d+)/ );
				if ( m2 ) {
					months = Number( m2[1] );
				}
			}
		}

		// FixIn: 2026-03-07   Override to  always get the default booking resource,  for specific user in MU or for existed resourecs !
		rid = resolve_effective_resource_id( rid );

		months = isFinite( months ) ? Math.max( 1, Math.min( 12, Math.floor( months ) ) ) : 1;

		return { rid: rid, months: months };
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Minimal preview bootstrap — load/refresh a calendar for a field
	// -----------------------------------------------------------------------------------------------------------------


	/**
	 * Initialize (or update) a calendar preview for a given field element.
	 *
	 * @param {Element} field_el           - calendar field element (wrap)
	 * @param {object}  data               - builder field data (optional)
	 * @param {boolean} should_reload_data - force AJAX data reload
	 */
	function init_field(field_el, data, should_reload_data = true) {
		if ( !field_el ) {
			return;
		}

		var pair = get_rid_and_months( field_el, data );
		var rid  = pair.rid;


		wait_until_api_ready( function () {

			// 1) Always (re)apply local UI — needed after DOM moves.
			apply_months_class( field_el, pair.months );
			set_calendar_params( rid, pair.months );

			try {
				w.wpbc_calendar_show( String( rid ) );
			} catch ( e1 ) {
				dev.error( 'wpbc_calendar_show', e1 );
			}
			set_secure_params();

			// 2) Decide on AJAX strictly by RID state + explicit request.
			var first_time_for_rid = !rid_loaded_cache[rid];
			// Respect caller intent. Reload only if explicitly asked OR first time for this RID.
			var do_reload          = !!should_reload_data || first_time_for_rid;

			try {
				if ( typeof w.wpbc_calendar__load_data__ajx === 'function' ) {
					if ( do_reload ) {
						w.wpbc_calendar__load_data__ajx( {
							'resource_id'              : rid,
							'booking_hash'             : '',
							'request_uri'              : Boot.request_uri || (w.location ? String( w.location.pathname + w.location.search ) : ''),
							'custom_form'              : 'standard',
							'aggregate_resource_id_str': '',
							'aggregate_type'           : 'all'
						} );
						// Mark this rid as loaded so subsequent DOM churn uses look-only refresh.
						rid_loaded_cache[rid] = true;
					} else if ( typeof w.wpbc_calendar__update_look === 'function' ) {
						w.wpbc_calendar__update_look( rid );
					}
				}
			} catch ( e2 ) {
				dev.log( 'calendar_data_load_skip', e2 );
			}

			// Track last config for soft dedupe (UI churn); keep per-element.
			try { field_el.setAttribute('data-wpbc-cal-init', '1'); field_el.setAttribute('data-wpbc-cal-loaded-rid', String(rid)); } catch (e3) {}
			try { apply_calendar_legend_preview_from_controls(); } catch (e4) {}

		}, 40, 100 );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// FOCS: tiny bus & DOM helpers (snake format)
	// -----------------------------------------------------------------------------------------------------------------
	const defer_fn = (fn) => (typeof w.requestAnimationFrame === 'function' ? w.requestAnimationFrame( fn ) : setTimeout( fn, 0 ));

	function find_calendar_wrap(el) {
		if ( ! el ) {
			return null;
		}
		return (el.closest && el.closest( '.wpbc_calendar_wraper' )) || el;
	}

	function is_calendar_wrap(el) {
		var wrap = find_calendar_wrap( el );
		return !!(wrap && (
			(wrap.dataset && wrap.dataset.type === 'calendar') ||
			(wrap.querySelector && wrap.querySelector( '[id^="calendar_booking"]' ))
		));
	}

	function look_refresh(target, opts) {
		var o    = opts || {};
		var wrap = find_calendar_wrap( target );
		if ( ! wrap || ! document.contains( wrap ) ) {
			return;
		}
		defer_fn( function () {
			init_field( wrap, null, !!o.reload );
		} );
	}

	function on_event(type, handler) {
		document.addEventListener( type, handler );
	}

	function get_calendar_skin_url_from_select(select_el) {
		if ( ! select_el || ! select_el.options ) {
			return '';
		}

		var selected_option = select_el.options[ select_el.selectedIndex ];
		if ( selected_option ) {
			return String( selected_option.getAttribute( 'data-wpbc-calendar-skin-url' ) || select_el.value || '' );
		}

		return String( select_el.value || '' );
	}

	function apply_calendar_skin_from_select(select_el) {
		var skin_url = get_calendar_skin_url_from_select( select_el );
		if ( ! skin_url || typeof w.wpbc__calendar__change_skin !== 'function' ) {
			return;
		}

		try {
			w.wpbc__calendar__change_skin( skin_url );
		} catch ( e ) {
			dev.error( 'calendar_skin_preview', e );
		}
	}

	function bind_calendar_skin_preview_events() {
		document.addEventListener( 'change', function (e) {
			var target = e && e.target;
			if ( target && target.matches && target.matches( '.js-wpbc-bfb-calendar-skin' ) ) {
				apply_calendar_skin_from_select( target );
			}
		}, true );
	}

	function escape_html(s) {
		return String( s == null ? '' : s )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	var legend_item_option_map = {
		available  : { show: 'booking_legend_is_show_item_available', text: 'booking_legend_text_for_item_available' },
		pending    : { show: 'booking_legend_is_show_item_pending', text: 'booking_legend_text_for_item_pending' },
		approved   : { show: 'booking_legend_is_show_item_approved', text: 'booking_legend_text_for_item_approved' },
		partially  : { show: 'booking_legend_is_show_item_partially', text: 'booking_legend_text_for_item_partially' },
		unavailable: { show: 'booking_legend_is_show_item_unavailable', text: 'booking_legend_text_for_item_unavailable' }
	};

	function get_checkbox_value_from_id(id, fallback) {
		var el = document.getElementById( id );
		if ( el ) {
			return el.checked ? 'On' : 'Off';
		}
		return fallback === 'On' ? 'On' : 'Off';
	}

	function get_text_value_from_id(id, fallback) {
		var el = document.getElementById( id );
		if ( el ) {
			return String( el.value || '' );
		}
		return String( fallback || '' );
	}

	function get_calendar_legend_values_from_controls() {
		var boot_legend = Boot.calendar_legend || {};
		var boot_items  = boot_legend.items || {};
		var values      = {
			show_legend : get_checkbox_value_from_id( 'booking_is_show_legend', boot_legend.show_legend ),
			show_numbers: get_checkbox_value_from_id( 'booking_legend_is_show_numbers', boot_legend.show_numbers ),
			is_vertical : get_checkbox_value_from_id( 'booking_legend_is_vertical', boot_legend.is_vertical ),
			items       : {}
		};

		Object.keys( legend_item_option_map ).forEach( function (item_key) {
			var map       = legend_item_option_map[item_key];
			var boot_item = boot_items[item_key] || {};
			values.items[item_key] = {
				show : get_checkbox_value_from_id( map.show, boot_item.show ),
				title: get_text_value_from_id( map.text, boot_item.title || boot_item.placeholder || '' )
			};
		} );

		return values;
	}

	function extract_legend_item_html(template_html) {
		var tmp = document.createElement( 'div' );
		tmp.innerHTML = String( template_html || '' );
		var item = tmp.querySelector( '.wpdev_hint_with_text' );
		return item ? item.outerHTML : '';
	}

	function render_calendar_legend_html(values) {
		var boot_legend = Boot.calendar_legend || {};
		var boot_items  = boot_legend.items || {};
		var order       = Array.isArray( boot_legend.items_order ) ? boot_legend.items_order : Object.keys( legend_item_option_map );
		var html        = '';

		if ( ! values || values.show_legend !== 'On' ) {
			return '';
		}

		order.forEach( function (item_key) {
			var item_values = values.items[item_key] || {};
			var boot_item   = boot_items[item_key] || {};
			var template    = (values.show_numbers === 'On') ? boot_item.template_number : boot_item.template_blank;
			var item_html   = extract_legend_item_html( template );

			if ( item_values.show !== 'On' || ! item_html ) {
				return;
			}

			item_html = item_html.replace( /__WPBC_LEGEND_TITLE__/g, escape_html( item_values.title || boot_item.placeholder || '' ) );
			html += item_html;
		} );

		if ( ! html ) {
			return '';
		}

		return '<div class="block_hints datepick ' + (values.is_vertical === 'On' ? ' block_hints_vertical ' : '') + '">' + html + '</div>';
	}

	function store_calendar_legend_values_in_boot(values) {
		Boot.calendar_legend = Boot.calendar_legend || {};
		Boot.calendar_legend.items = Boot.calendar_legend.items || {};
		Boot.calendar_legend.show_legend  = values.show_legend;
		Boot.calendar_legend.show_numbers = values.show_numbers;
		Boot.calendar_legend.is_vertical  = values.is_vertical;

		Object.keys( values.items || {} ).forEach( function (item_key) {
			Boot.calendar_legend.items[item_key] = Boot.calendar_legend.items[item_key] || {};
			Boot.calendar_legend.items[item_key].show  = values.items[item_key].show;
			Boot.calendar_legend.items[item_key].title = values.items[item_key].title;
		} );
	}

	function apply_calendar_legend_preview_from_controls() {
		var values = get_calendar_legend_values_from_controls();
		var html   = render_calendar_legend_html( values );
		var nodes  = document.querySelectorAll( '.js-wpbc-bfb-calendar-legend-preview' );

		store_calendar_legend_values_in_boot( values );

		for ( var i = 0; i < nodes.length; i++ ) {
			nodes[i].innerHTML = html;
		}
	}

	function sync_calendar_legend_inspector_visibility() {
		var main    = document.getElementById( 'booking_is_show_legend' );
		var options = document.querySelector( '.js-wpbc-bfb-calendar-legend-options' );
		if ( ! main || ! options ) {
			return;
		}
		options.style.display = main.checked ? '' : 'none';
	}

	function bind_calendar_legend_preview_events() {
		function on_inspector_render() {
			sync_calendar_legend_inspector_visibility();
		}

		document.addEventListener( 'change', function (e) {
			var target = e && e.target;
			if ( target && target.matches && target.matches( '.js-wpbc-bfb-calendar-legend-control' ) ) {
				sync_calendar_legend_inspector_visibility();
				apply_calendar_legend_preview_from_controls();
			}
		}, true );

		document.addEventListener( 'input', debounce( function (e) {
			var target = e && e.target;
			if ( target && target.matches && target.matches( '.js-wpbc-bfb-calendar-legend-control' ) ) {
				apply_calendar_legend_preview_from_controls();
			}
		}, 150 ), true );

		document.addEventListener( 'wpbc_bfb_inspector_ready', on_inspector_render );
		document.addEventListener( 'wpbc_bfb_inspector_render', on_inspector_render );
	}

	/**
	 * Initialize all calendars present in the current Builder preview panel.
	 */
	function init_all_on_page(should_reload_data = true) {
		var scope = w.document.querySelector( '#wpbc_bfb__pages_panel' ) || w.document;
		var nodes = scope.querySelectorAll( '[id^="calendar_booking"]' );
		for ( var i = 0; i < nodes.length; i++ ) {
			var node     = nodes[i];
			var field_el = node.closest( '.wpbc_calendar_wraper' ) || node.parentElement || node;
			init_field( field_el, null, should_reload_data );
		}
	}


	/**
	 * Listen to builder’s bus (events bubble on document via Core.WPBC_BFB_EventBus)
	 */
	function bind_builder_bus_events() {

		// Alias events once.
		var EV = Core.WPBC_BFB_Events || {};

		// 1) First structure ready -> look-only render.
		on_event( EV.STRUCTURE_LOADED, function () {
			init_all_on_page( false );
		} );

		// 2) Field/section added -> initialize that node if it’s a calendar (force reload).
		on_event( EV.FIELD_ADD, function (e) {
			var el = e && e.detail && e.detail.el;
			if ( ! el ) {
				// Defensive fallback: if emitter didn’t provide the element, refresh all calendars (look-only).
				return defer_fn(function () { init_all_on_page(false); });
			}
			if ( is_calendar_wrap( el ) ) {
				look_refresh( el, { reload: true } ); // builder just inserted; So do Ajax fetch data.
			}
		} );


		// 3) Generic structure changes.
		on_event( EV.STRUCTURE_CHANGE, function (e) {
			var d      = (e && e.detail) || {};
			var reason = d.reason || '';

			// Heavy operations -> cheap look refresh for all calendars, no data reload.
			if ( reason === 'sort-update' || reason === 'section-move' || reason === 'delete' ) {
				return defer_fn( function () {
					init_all_on_page( false );
				} );
			}

			// Only care about calendar targets.
			if ( ! is_calendar_wrap( d.el ) ) return;

			// Only reload data on committed resource_id changes.
			var k     = d.key || '';
			var phase = (d.phase || '').toLowerCase(); // set by the emitter above.
			if ( k === 'resource_id' && phase !== 'change' ) {
				return; // Skip on second input handler: ins.addEventListener( 'input', handler, true );  in ../includes/page-form-builder/__js/core/bfb-ui.js //.
			}
			// Replace to  TRUE,  if needs to  FORCE ajax reload of calendar  data of resource ID change.
			var must_reload = (k === 'resource_id' && phase === 'change')
				? false
				: false;
			look_refresh( d.el, { reload: must_reload } );
		} );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Field Renderer (class-like, extendable)
	// -----------------------------------------------------------------------------------------------------------------
	class WPBC_BFB_Field_Calendar extends (Field_Base || class {}) {

		static template_id = 'wpbc-bfb-field-calendar';  // Underscore template id from PHP printer.
		static kind        = 'calendar';

		/**
		 * Default props — keep in sync with PHP schema defaults.
		 */
		static get_defaults() {
			return {
				type       : 'calendar',
				label      : 'Select Date',
				resource_id: resolve_effective_resource_id( 1 ),
				months     : 1,
				name       : '',
				html_id    : '',
				cssclass   : '',
				help       : '',
				min_width  : '250px'
			};
		}

		/**
		 * Called by the Builder after the field is dropped/loaded/previewed.
		 * We (re)initialize the preview for the specific element.
		 *
		 * @param {object}  data
		 * @param {Element} field_el
		 * @param {{context:string}} ctx
		 */
		static on_field_drop(data, field_el, ctx) {
			try {
				init_field( field_el, data, false );
			} catch ( e ) {
				dev.error( 'WPBC_BFB_Field_Calendar.on_field_drop', e );
			}
		}

		/**
		 * Hydrate after preview render (no rebuild). Called by builder.render_preview().
		 */
		static hydrate(field_el, data, ctx) {
			try {
				init_field( field_el, data, false );
			} catch ( e ) {
				dev.error( 'WPBC_BFB_Field_Calendar.hydrate', e );
			}
		}

	}

	// Register pack renderer with the central registry.
	try {
		Registry.register( 'calendar', WPBC_BFB_Field_Calendar );
	} catch ( e ) {
		dev.error( 'WPBC_BFB_Field_Calendar.register', e );
	}

	// Bootstrap: on DOM ready, run a first scan and wire light reactivity.
	function on_ready(fn) {
		if ( w.document.readyState === 'interactive' || w.document.readyState === 'complete' ) {
			try {
				fn();
			} catch ( e ) {
			}
		} else {
			w.document.addEventListener( 'DOMContentLoaded', function () {
				try {
					fn();
				} catch ( e ) {
				}
			} );
		}
	}

	on_ready( function () {
		setTimeout( function () {
			init_all_on_page( false );
			bind_builder_bus_events();
			bind_calendar_skin_preview_events();
			bind_calendar_legend_preview_events();
			sync_calendar_legend_inspector_visibility();
		}, 0 );
	} );

	// Optional export (handy for debugging).
	w.WPBC_BFB_Field_Calendar = WPBC_BFB_Field_Calendar;


	// -- Export for "Booking Form" ------------------------------------------------------------------------------------

	/**
	 * Register the "calendar" exporter (lazy: tries now, or waits for exporter-ready).
	 * Output:
	 *   • [calendar] only (no rid/months/class/id tokens inside)
	 *   • If html_id / cssclass set → wrap shortcode in <span ... style="flex:1;">…</span>
	 *   • Label above (when addLabels !== false).
	 *     Help text is appended by WPBC_BFB_Exporter.render_field_node().
	 *
	 * Booking Form exporter callback (Advanced Form shortcode).
	 *
	 * This callback is registered per field type via:
	 *   WPBC_BFB_Exporter.register( 'shortcode_name', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
	 *     → callback( field, emit, { io, cfg, once, ctx, core } );
	 *
	 * @callback WPBC_BFB_ExporterCallback
	 * @param {Object}  field
	 *   Normalized field data coming from the Builder structure.
	 *   - field.type          {string}   Field type, e.g. "text".
	 *   - field.name          {string}   Name as stored on the canvas (already validated).
	 *   - field.id / html_id  {string}   Optional HTML id / user-visible id.
	 *   - field.label         {string}   Visible label in the form (may be empty).
	 *   - field.placeholder   {string}   Placeholder text (may be empty).
	 *   - field.required      {boolean|number|string} "truthy" if required.
	 *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
	 *   - field.default_value {string}   Default text value.
	 *   - field.options       {Array}    Only for option-based fields (select, checkbox, etc.).
	 *   - ...                 (Any other pack-specific props are also present.)
	 *
	 * @param {function(string):void} emit
	 *   Emits one line/fragment into the export buffer.
	 *   - Each call corresponds to one `push()` in the core exporter.
	 *   - For multi-line output (e.g. label + shortcode), call `emit()` multiple times:
	 *       emit('<l>Label</l>');
	 *       emit('<br>[text* name ...]');
	 *
	 * @param {Object} [extras]
	 *   Extra context passed by the core exporter.
	 *
	 * @param {Object} [extras.io]
	 *   Low-level writer used internally by the core.
	 *   Normally you do NOT need it in packs — prefer `emit()`.
	 *   - extras.io.open(str)   → open a nested block (increments indentation).
	 *   - extras.io.close(str)  → close a block (decrements indentation).
	 *   - extras.io.push(str)   → push raw line (used by `emit()`).
	 *   - extras.io.blank()     → push an empty line.
	 *
	 * @param {Object} [extras.cfg]
	 *   Export configuration (same object passed to WPBC_BFB_Exporter.export_form()).
	 *   Useful flags for field packs:
	 *   - extras.cfg.addLabels {boolean}  Default: true.
	 *       If false, packs should NOT emit <l>Label</l> lines.
	 *   - extras.cfg.newline   {string}   Newline separator (usually "\n").
	 *   - extras.cfg.gapPercent{number}   Layout gap (used only by section/column logic).
	 *
	 * @param {Object} [extras.once]
	 *   Shared "once-per-form" guards across all fields.
	 *   Counters are incremented by some field types (captcha, coupon, etc.).
	 *   Typical shape:
	 *   - extras.once.captcha          {number}
	 *   - extras.once.country          {number}
	 *   - extras.once.coupon           {number}
	 *   - extras.once.cost_corrections {number}
	 *   - extras.once.submit           {number}
	 *
	 *   Text field usually does not touch this object, but other packs can use it
	 *   to skip duplicates (e.g. only the first [coupon] per form is exported).
	 *
	 * @param {Object} [extras.ctx]
	 *   Shared export context for the entire form.
	 *   Currently:
	 *   - extras.ctx.usedIds {Set<string>}
	 *       Set of HTML/shortcode IDs already used in this export.
	 *       Helpers like Exp.id_option(field, ctx) use it to ensure uniqueness.
	 *
	 *   Packs normally just pass `ctx` into helpers (id_option, etc.) without
	 *   mutating it directly.
	 *
	 * @param {Object} [extras.core]
	 *   Reference to WPBC_BFB_Core passed from builder-exporter.js.
	 *   Primarily used to access sanitizers:
	 *   - extras.core.WPBC_BFB_Sanitize.escape_html(...)
	 *   - extras.core.WPBC_BFB_Sanitize.escape_for_shortcode(...)
	 *   - extras.core.WPBC_BFB_Sanitize.sanitize_html_name(...)
	 *   - etc.
	 */
	function export_shortcode_in_booking_form() {

		const Exp = w.WPBC_BFB_Exporter;
		if ( ! Exp || typeof Exp.register !== 'function' ) { return false; }
		if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'calendar' ) ) { return true; }

		// Use sanitize helpers from core (already loaded).
		const S    = Core.WPBC_BFB_Sanitize || (w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize) || {};
		const esc  = S.escape_html || (v => String( v ));
		const sid  = S.sanitize_html_id || (v => String( v ));
		const scls = S.sanitize_css_classlist || (v => String( v ));

		/**
		 * Per-field exporter for "calendar" in Advanced Form.
		 * @type {WPBC_BFB_ExporterCallback}
		 */
		Exp.register( 'calendar', (field, emit, extras = {}) => {

			const cfg       = extras.cfg || {};
			const ctx       = extras.ctx;
			const usedIds   = (ctx && ctx.usedIds instanceof Set) ? ctx.usedIds : null;
			const addLabels = cfg.addLabels !== false;

			// Optional wrapper attrs (id/class on outer span, not inside [calendar]).
			let html_id = field && field.html_id ? sid( String( field.html_id ) ) : '';
			if ( html_id && usedIds ) {
				let u = html_id, i = 2;
				while ( usedIds.has( u ) ) {
					u = `${html_id}_${i++}`;
				}
				usedIds.add( u );
				html_id = u;
			}

			const cls_raw = field && (field.cssclass_extra || field.cssclass || field.class) || '';
			const cls     = scls( String( cls_raw ) );

			const hasWrap   = !!( html_id || cls );
			const wrapOpen  = hasWrap
				? `<span${html_id ? ` id="${esc( html_id )}"` : ''}${cls ? ` class="${esc( cls )}"` : ''} style="flex:1;">`
				: '';
			const wrapClose = hasWrap ? '</span>' : '';

			// Calendar body is intentionally minimal; no rid/months/id/class tokens inside shortcode.
			const body  = '[calendar]';
			const label = (typeof field?.label === 'string') ? field.label.trim() : '';

			if ( label && addLabels ) {
				emit( `<l>${esc( label )}</l>` );
				emit( `<br>${wrapOpen}${body}${wrapClose}` );
			} else {
				emit( `${wrapOpen}${body}${wrapClose}` );
			}
		} );

		return true;
	}

	// Try now; if exporter isn't ready yet, wait for one-shot event from builder-exporter.
	if ( ! export_shortcode_in_booking_form() ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', export_shortcode_in_booking_form, { once: true } );
	}

	// -- Export for "Booking Data" ------------------------------------------------------------------------------------

	/**
	 * Register the "calendar" exporter for "Content of booking fields data". Produces e.g.: "<b>Dates</b>:
	 * <f>[dates]</f><br>"
	 *
	 * Booking Data exporter callback ("Content of booking fields data").  Default output: <b>Label</b>:
	 * <f>[field_name]</f><br>
	 *
	 * Registered per field type via:
	 *   WPBC_BFB_ContentExporter.register( 'shortcode_name', callback )
	 *
	 * Core call site (builder-exporter.js):
	 *   WPBC_BFB_ContentExporter.run_registered_exporter( field, emit, { cfg, core } );
	 *
	 * @callback WPBC_BFB_ContentExporterCallback
	 * @param {Object}  field
	 *   Normalized field data (same shape as in the main exporter).
	 *   Important properties for content templates:
	 *   - field.type      {string}  Field type, e.g. "text".
	 *   - field.name      {string}  Field name used as placeholder token.
	 *   - field.label     {string}  Human-readable label (may be empty).
	 *   - field.options   {Array}   For option-based fields (select, checkbox, radio, etc.).
	 *   - Other pack-specific props if needed.
	 *
	 * @param {function(string):void} emit
	 *   Emits a raw HTML fragment into the "Content of booking fields data" template.
	 *   Core will wrap everything once into:
	 *     <div class="standard-content-form">
	 *       ... emitted fragments ...
	 *     </div>
	 *
	 *   Typical usage pattern:
	 *     emit('<b>Label</b>: <f>[field_name]</f><br>');
	 *
	 *   In most cases, packs call the shared helper:
	 *     WPBC_BFB_ContentExporter.emit_line_bold_field(emit, label, token, cfg);
	 *
	 * @param {Object} [extras]
	 *   Additional context passed from run_registered_exporter().
	 *
	 * @param {Object} [extras.cfg]
	 *   Content exporter configuration:
	 *   - extras.cfg.addLabels {boolean} Default: true.
	 *       If false, helper may omit the bold label part.
	 *   - extras.cfg.sep       {string}  Label separator, default ": ".
	 *       Example: "<b>Label</b>: " vs "<b>Label</b> – ".
	 *   - extras.cfg.newline   {string}  Newline separator when joining lines (usually "\n").
	 *
	 * @param {Object} [extras.core]
	 *   Reference to WPBC_BFB_Core (same as in main exporter).
	 *   Usually not needed here, because:
	 *   - Sanitization and consistent rendering are already done via
	 *     WPBC_BFB_ContentExporter.emit_line_bold_field( ... ).
	 */
	function export_shortcode_in_booking_data() {

		var C = w.WPBC_BFB_ContentExporter;
		if ( ! C || typeof C.register !== 'function' ) { return false; }
		if ( typeof C.has_exporter === 'function' && C.has_exporter( 'calendar' ) ) { return true; }

		C.register( 'calendar', function ( field, emit, extras ) {

			extras    = extras || {};
			var cfg   = extras.cfg || {};
			var label = (typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : 'Dates';

			// Reuse shared formatter from builder-exporter - e.g.: emit_line_bold_field(emit, label, token, cfg) ->  emit(`<b>${S.escape_html(label)}</b>${sep}<f>[${token}]</f><br>`); .
			// C.emit_line_bold_field( emit, label, 'dates', cfg );

			if(0) {
				// Defensive fallback: keep a simple, backward-compatible output. Just for help  in using in other field packs.
				var core_local = extras.core || Core || {};
				var S_local    = core_local.WPBC_BFB_Sanitize || {};
				var esc        = S_local.escape_html || function (s) { return String( s ); };

				var sep   = (cfg && typeof cfg.sep === 'string') ? cfg.sep : ': ';
				var title = label ? '<b>' + esc( label ) + '</b>' + sep : '';
				emit( title + '<f>[dates]</f><br>' );
			}
		} );

		return true;
	}

	if ( ! export_shortcode_in_booking_data() ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', export_shortcode_in_booking_data, { once: true } );
	}

})( window );

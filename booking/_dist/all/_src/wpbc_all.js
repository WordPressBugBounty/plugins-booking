/**
 * =====================================================================================================================
 * JavaScript Util Functions		../includes/__js/utils/wpbc_utils.js
 * =====================================================================================================================
 */

/**
 * Trim  strings and array joined with  (,)
 *
 * @param string_to_trim   string / array
 * @returns string
 */
function wpbc_trim(string_to_trim) {

	if ( Array.isArray( string_to_trim ) ) {
		string_to_trim = string_to_trim.join( ',' );
	}

	if ( 'string' == typeof (string_to_trim) ) {
		string_to_trim = string_to_trim.trim();
	}

	return string_to_trim;
}

/**
 * Check if element in array
 *
 * @param array_here		array
 * @param p_val				element to  check
 * @returns {boolean}
 */
function wpbc_in_array(array_here, p_val) {
	for ( var i = 0, l = array_here.length; i < l; i++ ) {
		if ( array_here[i] == p_val ) {
			return true;
		}
	}
	return false;
}

/**
 * Prevent opening blank windows on WordPress playground for pseudo links like this: <a href="javascript:void(0)"> or # to stay in the same tab.
 */
(function () {
	'use strict';

	function is_playground_origin() {
		return location.origin === 'https://playground.wordpress.net';
	}

	function is_pseudo_link(a) {
		if ( !a || !a.getAttribute ) return true;
		var href = (a.getAttribute( 'href' ) || '').trim().toLowerCase();
		return (
			!href ||
			href === '#' ||
			href.indexOf( '#' ) === 0 ||
			href.indexOf( 'javascript:' ) === 0 ||
			href.indexOf( 'mailto:' ) === 0 ||
			href.indexOf( 'tel:' ) === 0
		);
	}

	function fix_target(a) {
		if ( ! a ) return;
		if ( is_pseudo_link( a ) || a.hasAttribute( 'data-wp-no-blank' ) ) {
			a.target = '_self';
		}
	}

	function init_fix() {
		// Optional: clean up current DOM (harmless—affects only pseudo/datamarked links).
		var nodes = document.querySelectorAll( 'a[href]' );
		for ( var i = 0; i < nodes.length; i++ ) fix_target( nodes[i] );

		// Late bubble-phase listeners (run after Playground's handlers)
		document.addEventListener( 'click', function (e) {
			var a = e.target && e.target.closest ? e.target.closest( 'a[href]' ) : null;
			if ( a ) fix_target( a );
		}, false );

		document.addEventListener( 'focusin', function (e) {
			var a = e.target && e.target.closest ? e.target.closest( 'a[href]' ) : null;
			if ( a ) fix_target( a );
		} );
	}

	function schedule_init() {
		if ( !is_playground_origin() ) return;
		setTimeout( init_fix, 1000 ); // ensure we attach after Playground's script.
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', schedule_init );
	} else {
		schedule_init();
	}
})();
"use strict";
/**
 * =====================================================================================================================
 *	includes/__js/wpbc/wpbc.js
 * =====================================================================================================================
 */

/**
 * Deep Clone of object or array
 *
 * @param obj
 * @returns {any}
 */
function wpbc_clone_obj( obj ){

	return JSON.parse( JSON.stringify( obj ) );
}



/**
 * Main _wpbc JS object
 */

var _wpbc = (function ( obj, $) {

	// Secure parameters for Ajax	------------------------------------------------------------------------------------
	var p_secure = obj.security_obj = obj.security_obj || {
															user_id: 0,
															nonce  : '',
															locale : ''
														  };
	obj.set_secure_param = function ( param_key, param_val ) {
		p_secure[ param_key ] = param_val;
	};

	obj.get_secure_param = function ( param_key ) {
		return p_secure[ param_key ];
	};


	// Calendars 	----------------------------------------------------------------------------------------------------
	var p_calendars = obj.calendars_obj = obj.calendars_obj || {
																		// sort            : "booking_id",
																		// sort_type       : "DESC",
																		// page_num        : 1,
																		// page_items_count: 10,
																		// create_date     : "",
																		// keyword         : "",
																		// source          : ""
																};

	/**
	 *  Check if calendar for specific booking resource defined   ::   true | false
	 *
	 * @param {string|int} resource_id
	 * @returns {boolean}
	 */
	obj.calendar__is_defined = function ( resource_id ) {

		return ('undefined' !== typeof( p_calendars[ 'calendar_' + resource_id ] ) );
	};

	/**
	 *  Create Calendar initializing
	 *
	 * @param {string|int} resource_id
	 */
	obj.calendar__init = function ( resource_id ) {

		p_calendars[ 'calendar_' + resource_id ] = {};
		p_calendars[ 'calendar_' + resource_id ][ 'id' ] = resource_id;
		p_calendars[ 'calendar_' + resource_id ][ 'pending_days_selectable' ] = false;

	};

	/**
	 * Check  if the type of this property  is INT
	 * @param property_name
	 * @returns {boolean}
	 */
	obj.calendar__is_prop_int = function ( property_name ) {													// FixIn: 9.9.0.29.

		var p_calendar_int_properties = ['dynamic__days_min', 'dynamic__days_max', 'fixed__days_num'];

		var is_include = p_calendar_int_properties.includes( property_name );

		return is_include;
	};


	/**
	 * Set params for all  calendars
	 *
	 * @param {object} calendars_obj		Object { calendar_1: {} }
	 * 												 calendar_3: {}, ... }
	 */
	obj.calendars_all__set = function ( calendars_obj ) {
		p_calendars = calendars_obj;
	};

	/**
	 * Get bookings in all calendars
	 *
	 * @returns {object|{}}
	 */
	obj.calendars_all__get = function () {
		return p_calendars;
	};

	/**
	 * Get calendar object   ::   { id: 1, … }
	 *
	 * @param {string|int} resource_id				  '2'
	 * @returns {object|boolean}					{ id: 2 ,… }
	 */
	obj.calendar__get_parameters = function ( resource_id ) {

		if ( obj.calendar__is_defined( resource_id ) ){

			return p_calendars[ 'calendar_' + resource_id ];
		} else {
			return false;
		}
	};

	/**
	 * Set calendar object   ::   { dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
	 *
	 * if calendar object  not defined, then  it's will be defined and ID set
	 * if calendar exist, then  system set  as new or overwrite only properties from calendar_property_obj parameter,  but other properties will be existed and not overwrite, like 'id'
	 *
	 * @param {string|int} resource_id				  '2'
	 * @param {object} calendar_property_obj					  {  dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }  }
	 * @param {boolean} is_complete_overwrite		  if 'true' (default: 'false'),  then  only overwrite or add  new properties in  calendar_property_obj
	 * @returns {*}
	 *
	 * Examples:
	 *
	 * Common usage in PHP:
	 *   			echo "  _wpbc.calendar__set(  " .intval( $resource_id ) . ", { 'dates': " . wp_json_encode( $availability_per_days_arr ) . " } );";
	 */
	obj.calendar__set_parameters = function ( resource_id, calendar_property_obj, is_complete_overwrite = false  ) {

		if ( (!obj.calendar__is_defined( resource_id )) || (true === is_complete_overwrite) ){
			obj.calendar__init( resource_id );
		}

		for ( var prop_name in calendar_property_obj ){

			p_calendars[ 'calendar_' + resource_id ][ prop_name ] = calendar_property_obj[ prop_name ];
		}

		return p_calendars[ 'calendar_' + resource_id ];
	};

	/**
	 * Set property  to  calendar
	 * @param resource_id	"1"
	 * @param prop_name		name of property
	 * @param prop_value	value of property
	 * @returns {*}			calendar object
	 */
	obj.calendar__set_param_value = function ( resource_id, prop_name, prop_value ) {

		if ( (!obj.calendar__is_defined( resource_id )) ){
			obj.calendar__init( resource_id );
		}

		p_calendars[ 'calendar_' + resource_id ][ prop_name ] = prop_value;

		return p_calendars[ 'calendar_' + resource_id ];
	};

	/**
	 *  Get calendar property value   	::   mixed | null
	 *
	 * @param {string|int}  resource_id		'1'
	 * @param {string} prop_name			'selection_mode'
	 * @returns {*|null}					mixed | null
	 */
	obj.calendar__get_param_value = function( resource_id, prop_name ){

		if (
			   ( obj.calendar__is_defined( resource_id ) )
			&& ( 'undefined' !== typeof ( p_calendars[ 'calendar_' + resource_id ][ prop_name ] ) )
		){
			// FixIn: 9.9.0.29.
			if ( obj.calendar__is_prop_int( prop_name ) ){
				p_calendars[ 'calendar_' + resource_id ][ prop_name ] = parseInt( p_calendars[ 'calendar_' + resource_id ][ prop_name ] );
			}
			return  p_calendars[ 'calendar_' + resource_id ][ prop_name ];
		}

		return null;		// If some property not defined, then null;
	};
	// -----------------------------------------------------------------------------------------------------------------


	// Bookings 	----------------------------------------------------------------------------------------------------
	var p_bookings = obj.bookings_obj = obj.bookings_obj || {
																// calendar_1: Object {
 																//						   id:     1
 																//						 , dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, …
																// }
															};

	/**
	 *  Check if bookings for specific booking resource defined   ::   true | false
	 *
	 * @param {string|int} resource_id
	 * @returns {boolean}
	 */
	obj.bookings_in_calendar__is_defined = function ( resource_id ) {

		return ('undefined' !== typeof( p_bookings[ 'calendar_' + resource_id ] ) );
	};

	/**
	 * Get bookings calendar object   ::   { id: 1 , dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
	 *
	 * @param {string|int} resource_id				  '2'
	 * @returns {object|boolean}					{ id: 2 , dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
	 */
	obj.bookings_in_calendar__get = function( resource_id ){

		if ( obj.bookings_in_calendar__is_defined( resource_id ) ){

			return p_bookings[ 'calendar_' + resource_id ];
		} else {
			return false;
		}
	};

	/**
	 * Set bookings calendar object   ::   { dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
	 *
	 * if calendar object  not defined, then  it's will be defined and ID set
	 * if calendar exist, then  system set  as new or overwrite only properties from calendar_obj parameter,  but other properties will be existed and not overwrite, like 'id'
	 *
	 * @param {string|int} resource_id				  '2'
	 * @param {object} calendar_obj					  {  dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }  }
	 * @returns {*}
	 *
	 * Examples:
	 *
	 * Common usage in PHP:
	 *   			echo "  _wpbc.bookings_in_calendar__set(  " .intval( $resource_id ) . ", { 'dates': " . wp_json_encode( $availability_per_days_arr ) . " } );";
	 */
	obj.bookings_in_calendar__set = function( resource_id, calendar_obj ){

		if ( ! obj.bookings_in_calendar__is_defined( resource_id ) ){
			p_bookings[ 'calendar_' + resource_id ] = {};
			p_bookings[ 'calendar_' + resource_id ][ 'id' ] = resource_id;
		}

		for ( var prop_name in calendar_obj ){

			p_bookings[ 'calendar_' + resource_id ][ prop_name ] = calendar_obj[ prop_name ];
		}

		return p_bookings[ 'calendar_' + resource_id ];
	};

	// Dates

	/**
	 *  Get bookings data for ALL Dates in calendar   ::   false | { "2023-07-22": {…}, "2023-07-23": {…}, … }
	 *
	 * @param {string|int} resource_id			'1'
	 * @returns {object|boolean}				false | Object {
																"2023-07-24": Object { ['summary']['status_for_day']: "available", day_availability: 1, max_capacity: 1, … }
																"2023-07-26": Object { ['summary']['status_for_day']: "full_day_booking", ['summary']['status_for_bookings']: "pending", day_availability: 0, … }
																"2023-07-29": Object { ['summary']['status_for_day']: "resource_availability", day_availability: 0, max_capacity: 1, … }
																"2023-07-30": {…}, "2023-07-31": {…}, …
															}
	 */
	obj.bookings_in_calendar__get_dates = function( resource_id){

		if (
			   ( obj.bookings_in_calendar__is_defined( resource_id ) )
			&& ( 'undefined' !== typeof ( p_bookings[ 'calendar_' + resource_id ][ 'dates' ] ) )
		){
			return  p_bookings[ 'calendar_' + resource_id ][ 'dates' ];
		}

		return false;		// If some property not defined, then false;
	};

	/**
	 * Set bookings dates in calendar object   ::    { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
	 *
	 * if calendar object  not defined, then  it's will be defined and 'id', 'dates' set
	 * if calendar exist, then system add a  new or overwrite only dates from dates_obj parameter,
	 * but other dates not from parameter dates_obj will be existed and not overwrite.
	 *
	 * @param {string|int} resource_id				  '2'
	 * @param {object} dates_obj					  { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
	 * @param {boolean} is_complete_overwrite		  if false,  then  only overwrite or add  dates from 	dates_obj
	 * @returns {*}
	 *
	 * Examples:
	 *   			_wpbc.bookings_in_calendar__set_dates( resource_id, { "2023-07-21": {…}, "2023-07-22": {…}, … }  );		<-   overwrite ALL dates
	 *   			_wpbc.bookings_in_calendar__set_dates( resource_id, { "2023-07-22": {…} },  false  );					<-   add or overwrite only  	"2023-07-22": {}
	 *
	 * Common usage in PHP:
	 *   			echo "  _wpbc.bookings_in_calendar__set_dates(  " . intval( $resource_id ) . ",  " . wp_json_encode( $availability_per_days_arr ) . "  );  ";
	 */
	obj.bookings_in_calendar__set_dates = function( resource_id, dates_obj , is_complete_overwrite = true ){

		if ( !obj.bookings_in_calendar__is_defined( resource_id ) ){
			obj.bookings_in_calendar__set( resource_id, { 'dates': {} } );
		}

		if ( 'undefined' === typeof (p_bookings[ 'calendar_' + resource_id ][ 'dates' ]) ){
			p_bookings[ 'calendar_' + resource_id ][ 'dates' ] = {}
		}

		if (is_complete_overwrite){

			// Complete overwrite all  booking dates
			p_bookings[ 'calendar_' + resource_id ][ 'dates' ] = dates_obj;
		} else {

			// Add only  new or overwrite exist booking dates from  parameter. Booking dates not from  parameter  will  be without chnanges
			for ( var prop_name in dates_obj ){

				p_bookings[ 'calendar_' + resource_id ]['dates'][ prop_name ] = dates_obj[ prop_name ];
			}
		}

		return p_bookings[ 'calendar_' + resource_id ];
	};


	/**
	 *  Get bookings data for specific date in calendar   ::   false | { day_availability: 1, ... }
	 *
	 * @param {string|int} resource_id			'1'
	 * @param {string} sql_class_day			'2023-07-21'
	 * @returns {object|boolean}				false | {
															day_availability: 4
															max_capacity: 4															//  >= Business Large
															2: Object { is_day_unavailable: false, _day_status: "available" }
															10: Object { is_day_unavailable: false, _day_status: "available" }		//  >= Business Large ...
															11: Object { is_day_unavailable: false, _day_status: "available" }
															12: Object { is_day_unavailable: false, _day_status: "available" }
														}
	 */
	obj.bookings_in_calendar__get_for_date = function( resource_id, sql_class_day ){

		if (
			   ( obj.bookings_in_calendar__is_defined( resource_id ) )
			&& ( 'undefined' !== typeof ( p_bookings[ 'calendar_' + resource_id ][ 'dates' ] ) )
			&& ( 'undefined' !== typeof ( p_bookings[ 'calendar_' + resource_id ][ 'dates' ][ sql_class_day ] ) )
		){
			return  p_bookings[ 'calendar_' + resource_id ][ 'dates' ][ sql_class_day ];
		}

		return false;		// If some property not defined, then false;
	};


	// Any  PARAMS   in bookings

	/**
	 * Set property  to  booking
	 * @param resource_id	"1"
	 * @param prop_name		name of property
	 * @param prop_value	value of property
	 * @returns {*}			booking object
	 */
	obj.booking__set_param_value = function ( resource_id, prop_name, prop_value ) {

		if ( ! obj.bookings_in_calendar__is_defined( resource_id ) ){
			p_bookings[ 'calendar_' + resource_id ] = {};
			p_bookings[ 'calendar_' + resource_id ][ 'id' ] = resource_id;
		}

		p_bookings[ 'calendar_' + resource_id ][ prop_name ] = prop_value;

		return p_bookings[ 'calendar_' + resource_id ];
	};

	/**
	 *  Get booking property value   	::   mixed | null
	 *
	 * @param {string|int}  resource_id		'1'
	 * @param {string} prop_name			'selection_mode'
	 * @returns {*|null}					mixed | null
	 */
	obj.booking__get_param_value = function( resource_id, prop_name ){

		if (
			   ( obj.bookings_in_calendar__is_defined( resource_id ) )
			&& ( 'undefined' !== typeof ( p_bookings[ 'calendar_' + resource_id ][ prop_name ] ) )
		){
			return  p_bookings[ 'calendar_' + resource_id ][ prop_name ];
		}

		return null;		// If some property not defined, then null;
	};




	/**
	 * Set bookings for all  calendars
	 *
	 * @param {object} calendars_obj		Object { calendar_1: { id: 1, dates: Object { "2023-07-22": {…}, "2023-07-23": {…}, "2023-07-24": {…}, … } }
	 * 												 calendar_3: {}, ... }
	 */
	obj.bookings_in_calendars__set_all = function ( calendars_obj ) {
		p_bookings = calendars_obj;
	};

	/**
	 * Get bookings in all calendars
	 *
	 * @returns {object|{}}
	 */
	obj.bookings_in_calendars__get_all = function () {
		return p_bookings;
	};
	// -----------------------------------------------------------------------------------------------------------------




	// Seasons 	----------------------------------------------------------------------------------------------------
	var p_seasons = obj.seasons_obj = obj.seasons_obj || {
																// calendar_1: Object {
 																//						   id:     1
 																//						 , dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, …
																// }
															};

	/**
	 * Add season names for dates in calendar object   ::    { "2023-07-21": [ 'wpbc_season_september_2023', 'wpbc_season_september_2024' ], "2023-07-22": [...], ... }
	 *
	 *
	 * @param {string|int} resource_id				  '2'
	 * @param {object} dates_obj					  { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
	 * @param {boolean} is_complete_overwrite		  if false,  then  only  add  dates from 	dates_obj
	 * @returns {*}
	 *
	 * Examples:
	 *   			_wpbc.seasons__set( resource_id, { "2023-07-21": [ 'wpbc_season_september_2023', 'wpbc_season_september_2024' ], "2023-07-22": [...], ... }  );
	 */
	obj.seasons__set = function( resource_id, dates_obj , is_complete_overwrite = false ){

		if ( 'undefined' === typeof (p_seasons[ 'calendar_' + resource_id ]) ){
			p_seasons[ 'calendar_' + resource_id ] = {};
		}

		if ( is_complete_overwrite ){

			// Complete overwrite all  season dates
			p_seasons[ 'calendar_' + resource_id ] = dates_obj;

		} else {

			// Add only  new or overwrite exist booking dates from  parameter. Booking dates not from  parameter  will  be without chnanges
			for ( var prop_name in dates_obj ){

				if ( 'undefined' === typeof (p_seasons[ 'calendar_' + resource_id ][ prop_name ]) ){
					p_seasons[ 'calendar_' + resource_id ][ prop_name ] = [];
				}
				for ( var season_name_key in dates_obj[ prop_name ] ){
					p_seasons[ 'calendar_' + resource_id ][ prop_name ].push( dates_obj[ prop_name ][ season_name_key ] );
				}
			}
		}

		return p_seasons[ 'calendar_' + resource_id ];
	};


	/**
	 *  Get bookings data for specific date in calendar   ::   [] | [ 'wpbc_season_september_2023', 'wpbc_season_september_2024' ]
	 *
	 * @param {string|int} resource_id			'1'
	 * @param {string} sql_class_day			'2023-07-21'
	 * @returns {object|boolean}				[]  |  [ 'wpbc_season_september_2023', 'wpbc_season_september_2024' ]
	 */
	obj.seasons__get_for_date = function( resource_id, sql_class_day ){

		if (
			   ( 'undefined' !== typeof ( p_seasons[ 'calendar_' + resource_id ] ) )
			&& ( 'undefined' !== typeof ( p_seasons[ 'calendar_' + resource_id ][ sql_class_day ] ) )
		){
			return  p_seasons[ 'calendar_' + resource_id ][ sql_class_day ];
		}

		return [];		// If not defined, then [];
	};


	// Other parameters 			------------------------------------------------------------------------------------
	var p_other = obj.other_obj = obj.other_obj || { };

	obj.set_other_param = function ( param_key, param_val ) {
		p_other[ param_key ] = param_val;
	};

	obj.get_other_param = function ( param_key ) {
		return p_other[ param_key ];
	};

	/**
	 * Get all other params
	 *
	 * @returns {object|{}}
	 */
	obj.get_other_param__all = function () {
		return p_other;
	};

	// Messages 			        ------------------------------------------------------------------------------------
	var p_messages = obj.messages_obj = obj.messages_obj || { };

	obj.set_message = function ( param_key, param_val ) {
		p_messages[ param_key ] = param_val;
	};

	obj.get_message = function ( param_key ) {
		return p_messages[ param_key ];
	};

	/**
	 * Get all other params
	 *
	 * @returns {object|{}}
	 */
	obj.get_messages__all = function () {
		return p_messages;
	};

	// -----------------------------------------------------------------------------------------------------------------

	return obj;

}( _wpbc || {}, jQuery ));

window.__WPBC_DEV = true;

/**
 * Extend _wpbc with  new methods
 *
 * @type {*|{}}
 * @private
 */
_wpbc = (function (obj, $) {

	/**
	 * Dev logger (no-op unless window.__WPBC_DEV = true)
	 *
	 * @type {*|{warn: (function(*, *, *): void), error: (function(*, *, *): void), once: obj.dev.once, try: ((function(*, *, *): (*|undefined))|*)}}
	 */
	obj.dev = obj.dev || (() => {
		const seen    = new Set();
		const enabled = () => !!window.__WPBC_DEV;

		function out(level, code, msg, extra) {
			if ( !enabled() ) return;
			try {
				(console[level] || console.warn)( `[WPBC][${code}] ${msg}`, extra ?? '' );
			} catch {
			}
		}

		return {
			log  : (code, msg, extra) => out('log',   code, msg, extra),
			debug: (code, msg, extra) => out('debug', code, msg, extra),
			warn : (code, msg, extra) => out( 'warn', code, msg, extra ),
			error: (code, errOrMsg, extra) =>
				out( 'error', code,
					errOrMsg instanceof Error ? errOrMsg.message : String( errOrMsg ),
					errOrMsg instanceof Error ? errOrMsg : extra ),
			once : (code, msg, extra) => {
				if ( !enabled() ) return;
				const key = `${code}|${msg}`;
				if ( seen.has( key ) ) return;
				seen.add( key );
				out( 'error', code, msg, extra );
			},
			try  : (code, fn, extra) => {
				try {
					return fn();
				} catch ( e ) {
					out( 'error', code, e, extra );
				}
			}
		};
	})();

	// Optional: global traps in dev.
	if ( window.__WPBC_DEV ) {
		window.addEventListener( 'error', (e) => {
			try { _wpbc?.dev?.error( 'GLOBAL-ERROR', e?.error || e?.message, e ); } catch ( _ ) {}
		} );
		window.addEventListener( 'unhandledrejection', (e) => {
			try { _wpbc?.dev?.error( 'GLOBAL-REJECTION', e?.reason ); } catch ( _ ) {}
		} );
	}

	return obj;
	}( _wpbc || {}, jQuery ));

/**
 * Extend _wpbc with  new methods        // FixIn: 9.8.6.2.
 *
 * @type {*|{}}
 * @private
 */
 _wpbc = (function ( obj, $) {

	// Load Balancer 	-----------------------------------------------------------------------------------------------

	var p_balancer = obj.balancer_obj = obj.balancer_obj || {
																'max_threads': 2,
																'in_process' : [],
																'wait'       : []
															};

	 /**
	  * Set  max parallel request  to  load
	  *
	  * @param max_threads
	  */
	obj.balancer__set_max_threads = function ( max_threads ){

		p_balancer[ 'max_threads' ] = max_threads;
	};

	/**
	 *  Check if balancer for specific booking resource defined   ::   true | false
	 *
	 * @param {string|int} resource_id
	 * @returns {boolean}
	 */
	obj.balancer__is_defined = function ( resource_id ) {

		return ('undefined' !== typeof( p_balancer[ 'balancer_' + resource_id ] ) );
	};


	/**
	 *  Create balancer initializing
	 *
	 * @param {string|int} resource_id
	 */
	obj.balancer__init = function ( resource_id, function_name , params ={}) {

		var balance_obj = {};
		balance_obj[ 'resource_id' ]   = resource_id;
		balance_obj[ 'priority' ]      = 1;
		balance_obj[ 'function_name' ] = function_name;
		balance_obj[ 'params' ]        = wpbc_clone_obj( params );


		if ( obj.balancer__is_already_run( resource_id, function_name ) ){
			return 'run';
		}
		if ( obj.balancer__is_already_wait( resource_id, function_name ) ){
			return 'wait';
		}


		if ( obj.balancer__can_i_run() ){
			obj.balancer__add_to__run( balance_obj );
			return 'run';
		} else {
			obj.balancer__add_to__wait( balance_obj );
			return 'wait';
		}
	};

	 /**
	  * Can I Run ?
	  * @returns {boolean}
	  */
	obj.balancer__can_i_run = function (){
		return ( p_balancer[ 'in_process' ].length < p_balancer[ 'max_threads' ] );
	}

		 /**
		  * Add to WAIT
		  * @param balance_obj
		  */
		obj.balancer__add_to__wait = function ( balance_obj ) {
			p_balancer['wait'].push( balance_obj );
		}

		 /**
		  * Remove from Wait
		  *
		  * @param resource_id
		  * @param function_name
		  * @returns {*|boolean}
		  */
		obj.balancer__remove_from__wait_list = function ( resource_id, function_name ){

			var removed_el = false;

			if ( p_balancer[ 'wait' ].length ){					// FixIn: 9.8.10.1.
				for ( var i in p_balancer[ 'wait' ] ){
					if (
						(resource_id === p_balancer[ 'wait' ][ i ][ 'resource_id' ])
						&& (function_name === p_balancer[ 'wait' ][ i ][ 'function_name' ])
					){
						removed_el = p_balancer[ 'wait' ].splice( i, 1 );
						removed_el = removed_el.pop();
						p_balancer[ 'wait' ] = p_balancer[ 'wait' ].filter( function ( v ){
							return v;
						} );					// Reindex array
						return removed_el;
					}
				}
			}
			return removed_el;
		}

		/**
		* Is already WAIT
		*
		* @param resource_id
		* @param function_name
		* @returns {boolean}
		*/
		obj.balancer__is_already_wait = function ( resource_id, function_name ){

			if ( p_balancer[ 'wait' ].length ){				// FixIn: 9.8.10.1.
				for ( var i in p_balancer[ 'wait' ] ){
					if (
						(resource_id === p_balancer[ 'wait' ][ i ][ 'resource_id' ])
						&& (function_name === p_balancer[ 'wait' ][ i ][ 'function_name' ])
					){
						return true;
					}
				}
			}
			return false;
		}


		 /**
		  * Add to RUN
		  * @param balance_obj
		  */
		obj.balancer__add_to__run = function ( balance_obj ) {
			p_balancer['in_process'].push( balance_obj );
		}

		/**
		* Remove from RUN list
		*
		* @param resource_id
		* @param function_name
		* @returns {*|boolean}
		*/
		obj.balancer__remove_from__run_list = function ( resource_id, function_name ){

			 var removed_el = false;

			 if ( p_balancer[ 'in_process' ].length ){				// FixIn: 9.8.10.1.
				 for ( var i in p_balancer[ 'in_process' ] ){
					 if (
						 (resource_id === p_balancer[ 'in_process' ][ i ][ 'resource_id' ])
						 && (function_name === p_balancer[ 'in_process' ][ i ][ 'function_name' ])
					 ){
						 removed_el = p_balancer[ 'in_process' ].splice( i, 1 );
						 removed_el = removed_el.pop();
						 p_balancer[ 'in_process' ] = p_balancer[ 'in_process' ].filter( function ( v ){
							 return v;
						 } );		// Reindex array
						 return removed_el;
					 }
				 }
			 }
			 return removed_el;
		}

		/**
		* Is already RUN
		*
		* @param resource_id
		* @param function_name
		* @returns {boolean}
		*/
		obj.balancer__is_already_run = function ( resource_id, function_name ){

			if ( p_balancer[ 'in_process' ].length ){					// FixIn: 9.8.10.1.
				for ( var i in p_balancer[ 'in_process' ] ){
					if (
						(resource_id === p_balancer[ 'in_process' ][ i ][ 'resource_id' ])
						&& (function_name === p_balancer[ 'in_process' ][ i ][ 'function_name' ])
					){
						return true;
					}
				}
			}
			return false;
		}



	obj.balancer__run_next = function (){

		// Get 1st from  Wait list
		var removed_el = false;
		if ( p_balancer[ 'wait' ].length ){					// FixIn: 9.8.10.1.
			for ( var i in p_balancer[ 'wait' ] ){
				removed_el = obj.balancer__remove_from__wait_list( p_balancer[ 'wait' ][ i ][ 'resource_id' ], p_balancer[ 'wait' ][ i ][ 'function_name' ] );
				break;
			}
		}

		if ( false !== removed_el ){

			// Run
			obj.balancer__run( removed_el );
		}
	}

	 /**
	  * Run
	  * @param balance_obj
	  */
	obj.balancer__run = function ( balance_obj ){

		switch ( balance_obj[ 'function_name' ] ){

			case 'wpbc_calendar__load_data__ajx':

				// Add to run list
				obj.balancer__add_to__run( balance_obj );

				wpbc_calendar__load_data__ajx( balance_obj[ 'params' ] )
				break;

			default:
		}
	}

	return obj;

}( _wpbc || {}, jQuery ));


 	/**
 	 * -- Help functions ----------------------------------------------------------------------------------------------
	 */

	function wpbc_balancer__is_wait( params, function_name ){
//console.log('::wpbc_balancer__is_wait',params , function_name );
		if ( 'undefined' !== typeof (params[ 'resource_id' ]) ){

			var balancer_status = _wpbc.balancer__init( params[ 'resource_id' ], function_name, params );

			return ( 'wait' === balancer_status );
		}

		return false;
	}


	function wpbc_balancer__completed( resource_id , function_name ){
//console.log('::wpbc_balancer__completed',resource_id , function_name );
		_wpbc.balancer__remove_from__run_list( resource_id, function_name );
		_wpbc.balancer__run_next();
	}
/**
 * =====================================================================================================================
 *	includes/__js/cal/wpbc_cal.js
 * =====================================================================================================================
 */

/**
 * Order or child booking resources saved here:  	_wpbc.booking__get_param_value( resource_id,
 * 'resources_id_arr__in_dates' )		[2,10,12,11]
 */

/**
 * How to check  booked times on  specific date: ?
 *
			_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21');

			console.log(
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[2].booked_time_slots.merged_seconds,
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[10].booked_time_slots.merged_seconds,
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[11].booked_time_slots.merged_seconds,
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[12].booked_time_slots.merged_seconds
					);
 *  OR
			console.log(
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[2].booked_time_slots.merged_readable,
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[10].booked_time_slots.merged_readable,
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[11].booked_time_slots.merged_readable,
						_wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[12].booked_time_slots.merged_readable
					);
 *
 */

/**
 * Days selection:
 * 					wpbc_calendar__unselect_all_dates( resource_id );
 *
 *					var resource_id = 1;
 * 	Example 1:		var num_selected_days = wpbc_auto_select_dates_in_calendar( resource_id, '2024-05-15',
 * '2024-05-25' ); Example 2:		var num_selected_days = wpbc_auto_select_dates_in_calendar( resource_id,
 * ['2024-05-09','2024-05-19','2024-05-25'] );
 *
 */


/**
 * C A L E N D A R  ---------------------------------------------------------------------------------------------------
 */


/**
 *  Show WPBC Calendar
 *
 * @param resource_id			- resource ID
 * @returns {boolean}
 */
function wpbc_calendar_show( resource_id ){

	// If no calendar HTML tag,  then  exit
	if ( 0 === jQuery( '#calendar_booking' + resource_id ).length ){ return false; }

	// If the calendar with the same Booking resource is activated already, then exit. But in Elementor the class can be stale, so verify instance.
	if ( jQuery( '#calendar_booking' + resource_id ).hasClass( 'hasDatepick' ) ) {

		var existing_inst = null;

		try {
			existing_inst = jQuery.datepick._getInst( jQuery( '#calendar_booking' + resource_id ).get( 0 ) );
		} catch ( e ) {
			existing_inst = null;
		}

		if ( existing_inst ) {
			return false;
		}

		// Stale marker: remove and continue with init.
		jQuery( '#calendar_booking' + resource_id ).removeClass( 'hasDatepick' );
	}

	wpbc_range_selection__hide_guidance( resource_id );



	// -----------------------------------------------------------------------------------------------------------------
	// Days selection
	// -----------------------------------------------------------------------------------------------------------------
	var local__is_range_select = false;
	var local__multi_days_select_num   = 365;					// multiple | fixed
	if ( 'dynamic' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ){
		local__is_range_select = true;
		local__multi_days_select_num = 0;
	}
	if ( 'single'  === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ){
		local__multi_days_select_num = 0;
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Min - Max days to scroll/show
	// -----------------------------------------------------------------------------------------------------------------
	var local__min_date = 0;
 	local__min_date = new Date( _wpbc.get_other_param( 'today_arr' )[ 0 ], (parseInt( _wpbc.get_other_param( 'today_arr' )[ 1 ] ) - 1), _wpbc.get_other_param( 'today_arr' )[ 2 ], 0, 0, 0 );			// FixIn: 9.9.0.17.
//console.log( local__min_date );
	var local__max_date = _wpbc.calendar__get_param_value( resource_id, 'booking_max_monthes_in_calendar' );
	//local__max_date = new Date(2024, 5, 28);  It is here issue of not selectable dates, but some dates showing in calendar as available, but we can not select it.

	//// Define last day in calendar (as a last day of month (and not date, which is related to actual 'Today' date).
	//// E.g. if today is 2023-09-25, and we set 'Number of months to scroll' as 5 months, then last day will be 2024-02-29 and not the 2024-02-25.
	// var cal_last_day_in_month = jQuery.datepick._determineDate( null, local__max_date, new Date() );
	// cal_last_day_in_month = new Date( cal_last_day_in_month.getFullYear(), cal_last_day_in_month.getMonth() + 1, 0 );
	// local__max_date = cal_last_day_in_month;			// FixIn: 10.0.0.26.

	// Get start / end dates from  the Booking Calendar shortcode. Example: [booking calendar_dates_start='2026-01-01' calendar_dates_end='2026-12-31'  resource_id=1] // FixIn: 10.13.1.4.
	if ( false !== wpbc_calendar__get_dates_start( resource_id ) ) {
		local__min_date = wpbc_calendar__get_dates_start( resource_id );  // E.g. - local__min_date = new Date( 2025, 0, 1 );
	}
	if ( false !== wpbc_calendar__get_dates_end( resource_id ) ) {
		local__max_date = wpbc_calendar__get_dates_end( resource_id );    // E.g. - local__max_date = new Date( 2025, 11, 31 );
	}

	// In case we edit booking in past or have specific parameter in URL.
	var wpbc_edit_booking_hash = _wpbc.get_other_param( 'this_page_booking_hash' );
	var wpbc_is_edit_booking_context = ( 'undefined' !== typeof wpbc_edit_booking_hash ) && ( '' !== wpbc_edit_booking_hash );
	var wpbc_allow_past_context = _wpbc.get_other_param( 'this_page_allow_past' );
	var wpbc_is_allow_past_context = ( '1' === String( wpbc_allow_past_context ) ) || ( 1 === wpbc_allow_past_context ) || ( true === wpbc_allow_past_context );
	var wpbc_allow_past_date_arr = _wpbc.get_other_param( 'this_page_allow_past_arr' );
	var wpbc_is_add_booking_admin_page = ( location.href.indexOf( 'page=wpbc' ) != -1 ) && ( location.href.indexOf( 'tab=add-booking' ) != -1 );
	if (   ( wpbc_is_add_booking_admin_page || wpbc_is_edit_booking_context || wpbc_is_allow_past_context )
		&& (
			  wpbc_is_edit_booking_context
		   || wpbc_is_allow_past_context
		   || ( location.href.indexOf('booking_hash') != -1 )                  // Comment this line for ability to add  booking in past days at  Booking > Add booking page.
		   || ( location.href.indexOf('allow_past') != -1 )                // FixIn: 10.7.1.2.
		)
	){
		// local__min_date = null;
		// FixIn: 10.14.1.4.
		var wpbc_min_date_arr = ( wpbc_is_allow_past_context && wpbc_allow_past_date_arr && ( 5 <= wpbc_allow_past_date_arr.length ) ) ? wpbc_allow_past_date_arr : _wpbc.get_other_param( 'time_local_arr' );
		local__min_date  = new Date( wpbc_min_date_arr[0], ( parseInt( wpbc_min_date_arr[1] ) - 1), wpbc_min_date_arr[2], wpbc_min_date_arr[3], wpbc_min_date_arr[4], 0 );
		local__max_date = null;
	}

	var local__start_weekday    = _wpbc.calendar__get_param_value( resource_id, 'booking_start_day_weeek' );
	var local__number_of_months = parseInt( _wpbc.calendar__get_param_value( resource_id, 'calendar_number_of_months' ) );

	jQuery( '#calendar_booking' + resource_id ).text( '' );					// Remove all HTML in calendar tag
	// -----------------------------------------------------------------------------------------------------------------
	// Show calendar
	// -----------------------------------------------------------------------------------------------------------------
	jQuery('#calendar_booking'+ resource_id).datepick(
			{
				beforeShowDay: function ( js_date ){
									return wpbc__calendar__apply_css_to_days( js_date, {'resource_id': resource_id}, this );
							  },
				onSelect: function ( string_dates, js_dates_arr ){  /**
																	 *	string_dates   =   '23.08.2023 - 26.08.2023'
																	 *   |    '23.08.2023 - 23.08.2023'    |
																	 * '19.09.2023, 24.08.2023, 30.09.2023'
																	 * js_dates_arr   =   range: [ Date (Aug 23 2023),
																	 * Date (Aug 25 2023)]     |     multiple: [
																	 * Date(Oct 24 2023), Date(Oct 20 2023), Date(Oct
																	 * 16 2023) ]
																	 */
									return wpbc__calendar__on_select_days( string_dates, {'resource_id': resource_id}, this );
							  },
				onHover: function ( string_date, js_date ){
									return wpbc__calendar__on_hover_days( string_date, js_date, {'resource_id': resource_id}, this );
							  },
				onChangeMonthYear: function ( year, real_month, js_date__1st_day_in_month ){ },
				showOn        : 'both',
				numberOfMonths: local__number_of_months,
				stepMonths    : 1,
				// prevText      : '&laquo;',
				// nextText      : '&raquo;',
				prevText      : '&lsaquo;',
				nextText      : '&rsaquo;',
				dateFormat    : 'dd.mm.yy',
				changeMonth   : false,
				changeYear    : false,
				minDate       : local__min_date,
				maxDate       : local__max_date, 														// '1Y',
				// minDate: new Date(2020, 2, 1), maxDate: new Date(2020, 9, 31),             	// Ability to set any  start and end date in calendar
				showStatus      : false,
				multiSeparator  : ', ',
				closeAtTop      : false,
				firstDay        : local__start_weekday,
				gotoCurrent     : false,
				hideIfNoPrevNext: true,
				multiSelect     : local__multi_days_select_num,
				rangeSelect     : local__is_range_select,
				// showWeeks: true,
				useThemeRoller: false
			}
	);



	// -----------------------------------------------------------------------------------------------------------------
	// Clear today date highlighting
	// -----------------------------------------------------------------------------------------------------------------
	setTimeout( function (){  wpbc_calendars__clear_days_highlighting( resource_id );  }, 500 );                    	// FixIn: 7.1.2.8.

	// -----------------------------------------------------------------------------------------------------------------
	// Scroll calendar to  specific month
	// -----------------------------------------------------------------------------------------------------------------
	var start_bk_month = _wpbc.calendar__get_param_value( resource_id, 'calendar_scroll_to' );
	if ( false !== start_bk_month ){
		wpbc_calendar__scroll_to( resource_id, start_bk_month[ 0 ], start_bk_month[ 1 ] );
	}
	}


	/**
	 * Get booking statuses as array from the structured summary field, with fallback to the legacy string field.
	 *
	 * @param date_bookings_obj
	 * @returns {[]}
	 */
	function wpbc_get_booking_statuses__as_arr( date_bookings_obj ){

		if (
			   ( ! date_bookings_obj )
			|| ( 'undefined' === typeof (date_bookings_obj[ 'summary' ]) )
		){
			return [];
		}

		if ( Array.isArray( date_bookings_obj[ 'summary' ][ 'status_for_bookings_arr' ] ) ){
			return date_bookings_obj[ 'summary' ][ 'status_for_bookings_arr' ].filter( function ( booking_status ){
				return '' !== booking_status;
			} );
		}

		if ( ! date_bookings_obj[ 'summary' ][ 'status_for_bookings' ] ){
			return [];
		}

		return date_bookings_obj[ 'summary' ][ 'status_for_bookings' ].toString().trim().split( /\s+/ ).filter( function ( booking_status ){
			return '' !== booking_status;
		} );
	}


	/**
	 * Check exact booking status in statuses array.
	 *
	 * @param {[]} booking_statuses_arr
	 * @param {string} booking_status
	 * @returns {boolean}
	 */
	function wpbc_booking_statuses__has( booking_statuses_arr, booking_status ){
		return booking_statuses_arr.indexOf( booking_status ) > -1;
	}


	/**
	 * Check booking status part, e.g. "pending" in "approved_pending".
	 *
	 * @param {[]} booking_statuses_arr
	 * @param {string} booking_status_part
	 * @returns {boolean}
	 */
	function wpbc_booking_statuses__has_part( booking_statuses_arr, booking_status_part ){

		for ( var i = 0; i < booking_statuses_arr.length; i++ ){
			if ( booking_statuses_arr[ i ].split( '_' ).indexOf( booking_status_part ) > -1 ){
				return true;
			}
		}

		return false;
	}


	/**
	 * Apply CSS to calendar date cells
	 *
	 * @param date										-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00
	 *     GMT+0200 (Eastern European Standard Time)
	 * @param calendar_params_arr						-  Calendar Settings Object:  	{
	 *																  						"resource_id": 4
	 *																					}
	 * @param datepick_this								- this of datepick Obj
	 * @returns {(*|string)[]|(boolean|string)[]}		- [ {true -available | false - unavailable}, 'CSS classes for
	 *     calendar day cell' ]
	 */
	function wpbc__calendar__apply_css_to_days( date, calendar_params_arr, datepick_this ){

		var today_date = new Date( _wpbc.get_other_param( 'today_arr' )[ 0 ], (parseInt( _wpbc.get_other_param( 'today_arr' )[ 1 ] ) - 1), _wpbc.get_other_param( 'today_arr' )[ 2 ], 0, 0, 0 );								// Today JS_Date_Obj.
		var class_day     = wpbc__get__td_class_date( date );																					// '1-9-2023'
		var sql_class_day = wpbc__get__sql_class_date( date );																					// '2023-01-09'
		var resource_id = ( 'undefined' !== typeof(calendar_params_arr[ 'resource_id' ]) ) ? calendar_params_arr[ 'resource_id' ] : '1'; 		// '1'

		// Get Selected dates in calendar
		var selected_dates_sql = wpbc_get__selected_dates_sql__as_arr( resource_id );

		// Get Data --------------------------------------------------------------------------------------------------------
		var date_bookings_obj = _wpbc.bookings_in_calendar__get_for_date( resource_id, sql_class_day );


		// Array with CSS classes for date ---------------------------------------------------------------------------------
		var css_classes__for_date = [];
		css_classes__for_date.push( 'sql_date_'     + sql_class_day );				//  'sql_date_2023-07-21'
		css_classes__for_date.push( 'cal4date-'     + class_day );					//  'cal4date-7-21-2023'
		css_classes__for_date.push( 'wpbc_weekday_' + date.getDay() );				//  'wpbc_weekday_4'

		// Define Selected Check In/Out dates in TD  -----------------------------------------------------------------------
		if (
				( selected_dates_sql.length  )
			//&&  ( selected_dates_sql[ 0 ] !== selected_dates_sql[ (selected_dates_sql.length - 1) ] )
		){
			if ( sql_class_day === selected_dates_sql[ 0 ] ){
				css_classes__for_date.push( 'selected_check_in' );
				css_classes__for_date.push( 'selected_check_in_out' );
			}
			if (  ( selected_dates_sql.length > 1 ) && ( sql_class_day === selected_dates_sql[ (selected_dates_sql.length - 1) ] ) ) {
				css_classes__for_date.push( 'selected_check_out' );
				css_classes__for_date.push( 'selected_check_in_out' );
			}
		}


		var is_day_selectable = false;

		// If something not defined,  then  this date closed --------------------------------------------------------------- // FixIn: 10.12.4.6.
		if ( (false === date_bookings_obj) || ('undefined' === typeof (date_bookings_obj[resource_id])) ) {

			css_classes__for_date.push( 'date_user_unavailable' );

			return [ is_day_selectable, css_classes__for_date.join(' ')  ];
		}


		// -----------------------------------------------------------------------------------------------------------------
		//   date_bookings_obj  - Defined.            Dates can be selectable.
		// -----------------------------------------------------------------------------------------------------------------
		var booking_statuses_arr = wpbc_get_booking_statuses__as_arr( date_bookings_obj );

		// -----------------------------------------------------------------------------------------------------------------
		// Add season names to the day CSS classes -- it is required for correct  work  of conditional fields --------------
		var season_names_arr = _wpbc.seasons__get_for_date( resource_id, sql_class_day );

		for ( var season_key in season_names_arr ){

			css_classes__for_date.push( season_names_arr[ season_key ] );				//  'wpdevbk_season_september_2023'
		}
		// -----------------------------------------------------------------------------------------------------------------


		// Cost Rate -------------------------------------------------------------------------------------------------------
		css_classes__for_date.push( 'rate_' + date_bookings_obj[ resource_id ][ 'date_cost_rate' ].toString().replace( /[\.\s]/g, '_' ) );						//  'rate_99_00' -> 99.00


		if ( parseInt( date_bookings_obj[ 'day_availability' ] ) > 0 ){
			is_day_selectable = true;
			css_classes__for_date.push( 'date_available' );
			css_classes__for_date.push( 'reserved_days_count' + parseInt( date_bookings_obj[ 'max_capacity' ] - date_bookings_obj[ 'day_availability' ] ) );
		} else {
			is_day_selectable = false;
			css_classes__for_date.push( 'date_user_unavailable' );
		}


		switch ( date_bookings_obj[ 'summary']['status_for_day' ] ){

			case 'available':
				break;

			case 'time_slots_booking':
				css_classes__for_date.push( 'timespartly', 'times_clock' );
				break;

			case 'full_day_booking':
				css_classes__for_date.push( 'full_day_booking' );
				break;

			case 'season_filter':
				css_classes__for_date.push( 'date_user_unavailable', 'season_unavailable' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				date_bookings_obj[ 'summary']['status_for_bookings_arr' ] = [];
				booking_statuses_arr = [];
				break;

			case 'resource_availability':
				css_classes__for_date.push( 'date_user_unavailable', 'resource_unavailable' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				date_bookings_obj[ 'summary']['status_for_bookings_arr' ] = [];
				booking_statuses_arr = [];
				break;

			case 'weekday_unavailable':
				css_classes__for_date.push( 'date_user_unavailable', 'weekday_unavailable' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				date_bookings_obj[ 'summary']['status_for_bookings_arr' ] = [];
				booking_statuses_arr = [];
				break;

			case 'from_today_unavailable':
				css_classes__for_date.push( 'date_user_unavailable', 'from_today_unavailable' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				date_bookings_obj[ 'summary']['status_for_bookings_arr' ] = [];
				booking_statuses_arr = [];
				break;

			case 'limit_available_from_today':
				css_classes__for_date.push( 'date_user_unavailable', 'limit_available_from_today' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				date_bookings_obj[ 'summary']['status_for_bookings_arr' ] = [];
				booking_statuses_arr = [];
				break;

			case 'change_over':
				/*
				 *
				//  check_out_time_date2approve 	 	check_in_time_date2approve
				//  check_out_time_date2approve 	 	check_in_time_date_approved
				//  check_in_time_date2approve 		 	check_out_time_date_approved
				//  check_out_time_date_approved 	 	check_in_time_date_approved
				 */

				css_classes__for_date.push( 'timespartly', 'check_in_time', 'check_out_time' );
				// FixIn: 10.0.0.2.
				if ( wpbc_booking_statuses__has( booking_statuses_arr, 'approved_pending' ) ){
					css_classes__for_date.push( 'check_out_time_date_approved', 'check_in_time_date2approve' );
				}
				if ( wpbc_booking_statuses__has( booking_statuses_arr, 'pending_approved' ) ){
					css_classes__for_date.push( 'check_out_time_date2approve', 'check_in_time_date_approved' );
				}
				break;

			case 'check_in':
				css_classes__for_date.push( 'timespartly', 'check_in_time' );

				// FixIn: 9.9.0.33.
				if ( wpbc_booking_statuses__has_part( booking_statuses_arr, 'pending' ) ){
					css_classes__for_date.push( 'check_in_time_date2approve' );
				} else if ( wpbc_booking_statuses__has_part( booking_statuses_arr, 'approved' ) ){
					css_classes__for_date.push( 'check_in_time_date_approved' );
				}
				break;

			case 'check_out':
				css_classes__for_date.push( 'timespartly', 'check_out_time' );

				// FixIn: 9.9.0.33.
				if ( wpbc_booking_statuses__has_part( booking_statuses_arr, 'pending' ) ){
					css_classes__for_date.push( 'check_out_time_date2approve' );
				} else if ( wpbc_booking_statuses__has_part( booking_statuses_arr, 'approved' ) ){
					css_classes__for_date.push( 'check_out_time_date_approved' );
				}
				break;

			default:
				// mixed statuses: 'change_over check_out' .... variations.... check more in 		function wpbc_get_availability_per_days_arr()
				date_bookings_obj[ 'summary']['status_for_day' ] = 'available';
		}



		if ( 'available' != date_bookings_obj[ 'summary']['status_for_day' ] ){

			var is_set_pending_days_selectable = _wpbc.calendar__get_param_value( resource_id, 'pending_days_selectable' );	// set pending days selectable          // FixIn: 8.6.1.18.

			if ( wpbc_booking_statuses__has( booking_statuses_arr, 'pending' ) ){
				css_classes__for_date.push( 'date2approve' );
				is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
			}
			if ( wpbc_booking_statuses__has( booking_statuses_arr, 'approved' ) ){
				css_classes__for_date.push( 'date_approved' );
			}
			if ( wpbc_booking_statuses__has( booking_statuses_arr, 'pending_pending' ) ){
				css_classes__for_date.push( 'check_out_time_date2approve', 'check_in_time_date2approve' );
				is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
			}
			if ( wpbc_booking_statuses__has( booking_statuses_arr, 'pending_approved' ) ){
				css_classes__for_date.push( 'check_out_time_date2approve', 'check_in_time_date_approved' );
				is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
			}
			if ( wpbc_booking_statuses__has( booking_statuses_arr, 'approved_pending' ) ){
				css_classes__for_date.push( 'check_out_time_date_approved', 'check_in_time_date2approve' );
				is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
			}
			if ( wpbc_booking_statuses__has( booking_statuses_arr, 'approved_approved' ) ){
				css_classes__for_date.push( 'check_out_time_date_approved', 'check_in_time_date_approved' );
			}
		}

		return [ is_day_selectable, css_classes__for_date.join( ' ' ) ];
	}


	/**
	 * Mouseover calendar date cells
	 *
	 * @param string_date
	 * @param date										-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00
	 *     GMT+0200 (Eastern European Standard Time)
	 * @param calendar_params_arr						-  Calendar Settings Object:  	{
	 *																  						"resource_id": 4
	 *																					}
	 * @param datepick_this								- this of datepick Obj
	 * @returns {boolean}
	 */
	function wpbc__calendar__on_hover_days( string_date, date, calendar_params_arr, datepick_this ) {

		if ( null === date ) {
			wpbc_calendars__clear_days_highlighting( ('undefined' !== typeof (calendar_params_arr[ 'resource_id' ])) ? calendar_params_arr[ 'resource_id' ] : '1' );		// FixIn: 10.5.2.4.
			return false;
		}

		var class_day     = wpbc__get__td_class_date( date );																					// '1-9-2023'
		var sql_class_day = wpbc__get__sql_class_date( date );																					// '2023-01-09'
		var resource_id = ( 'undefined' !== typeof(calendar_params_arr[ 'resource_id' ]) ) ? calendar_params_arr[ 'resource_id' ] : '1';		// '1'

		// Get Data --------------------------------------------------------------------------------------------------------
		var date_booking_obj = _wpbc.bookings_in_calendar__get_for_date( resource_id, sql_class_day );											// {...}

		if ( ! date_booking_obj ){ return false; }


		// T o o l t i p s -------------------------------------------------------------------------------------------------
		var tooltip_text = '';
		if ( date_booking_obj[ 'summary']['tooltip_availability' ].length > 0 ){
			tooltip_text +=  date_booking_obj[ 'summary']['tooltip_availability' ];
		}
		if ( date_booking_obj[ 'summary']['tooltip_day_cost' ].length > 0 ){
			tooltip_text +=  date_booking_obj[ 'summary']['tooltip_day_cost' ];
		}
		if ( date_booking_obj[ 'summary']['tooltip_times' ].length > 0 ){
			tooltip_text +=  date_booking_obj[ 'summary']['tooltip_times' ];
		}
		if ( date_booking_obj[ 'summary']['tooltip_booking_details' ].length > 0 ){
			tooltip_text +=  date_booking_obj[ 'summary']['tooltip_booking_details' ];
		}
		wpbc_set_tooltip___for__calendar_date( tooltip_text, resource_id, class_day );



		//  U n h o v e r i n g    in    UNSELECTABLE_CALENDAR  ------------------------------------------------------------
		var is_unselectable_calendar = ( jQuery( '#calendar_booking_unselectable' + resource_id ).length > 0);				// FixIn: 8.0.1.2.
		var is_booking_form_exist    = ( jQuery( '#booking_form_div' + resource_id ).length > 0 );
		var is_add_booking_modal_calendar = ( jQuery( '#calendar_booking' + resource_id ).closest( '#wpbc_modal__add_booking__section' ).length > 0 );
		var is_admin_calendar_preview = ( jQuery( '#calendar_booking' + resource_id ).closest( '[data-wpbc-admin-calendar-preview="1"]' ).length > 0 );

		if ( ( is_unselectable_calendar ) && ( ! is_booking_form_exist ) ){

			/**
			 *  Un Hover all dates in calendar (without the booking form), if only Availability Calendar here and we do
			 * not insert Booking form by mistake.
			 */

			wpbc_calendars__clear_days_highlighting( resource_id ); 							// Clear days highlighting

			var css_of_calendar = '.wpbc_only_calendar #calendar_booking' + resource_id;
			jQuery( css_of_calendar + ' .datepick-days-cell, '
				  + css_of_calendar + ' .datepick-days-cell a' ).css( 'cursor', 'default' );	// Set cursor to Default
			return false;
		}



		//  D a y s    H o v e r i n g  ------------------------------------------------------------------------------------
		if (
			   ( location.href.indexOf( 'page=wpbc' ) == -1 )
			|| ( ( location.href.indexOf( 'page=wpbc' ) > 0 ) && ( location.href.indexOf( 'tab=add-booking' ) > 0 ) )
			|| ( is_add_booking_modal_calendar )
			|| ( is_admin_calendar_preview )
			|| ( location.href.indexOf( 'page=wpbc-setup' ) > 0 )
			|| ( location.href.indexOf( 'page=wpbc-availability' ) > 0 )
			|| (  ( location.href.indexOf( 'page=wpbc-settings' ) > 0 )  &&
				  ( location.href.indexOf( 'tab=builder_booking_form' ) > 0 )
			   )
		){
			// The same as dates selection,  but for days hovering

			if ( 'function' == typeof( wpbc__calendar__do_days_highlight__bs ) ){
				wpbc__calendar__do_days_highlight__bs( sql_class_day, date, resource_id );
			} else if ( 'dynamic' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ) {
				wpbc__calendar__do_days_highlight__unrestricted_range( sql_class_day, date, resource_id );
			}
		}

	}


	/**
	 * Highlight an unrestricted proposed range after the first click when Business Small is not loaded.
	 *
	 * @param {string} sql_class_day Hovered date in SQL format.
	 * @param {Date} date Hovered date.
	 * @param {number|string} resource_id Booking resource ID.
	 * @returns {boolean} True when the complete proposed range is available and highlighted.
	 */
	function wpbc__calendar__do_days_highlight__unrestricted_range( sql_class_day, date, resource_id ){

		var inst = wpbc_calendar__get_inst( resource_id );
		var range_start;
		var range_end;
		var working_date;
		var td_overs = [];

		wpbc_calendars__clear_days_highlighting( resource_id );

		if (
			   null === inst
			|| 'dynamic' !== _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' )
		) {
			return false;
		}

		// Before a range starts, or after it is complete, preview the hovered date as the possible first day.
		if ( 1 !== inst.dates.length || ! inst.dates[ 0 ] ) {
			if ( ! wpbc_is_this_day_selectable( resource_id, sql_class_day ) ) {
				return false;
			}

			jQuery( '#calendar_booking' + resource_id + ' .cal4date-' + wpbc__get__td_class_date( date ) )
				.addClass( 'datepick-days-cell-over' );
			return true;
		}

		range_start = new Date( inst.dates[ 0 ].getFullYear(), inst.dates[ 0 ].getMonth(), inst.dates[ 0 ].getDate(), 0, 0, 0 );
		range_end   = new Date( date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0 );

		// Datepick only permits a check-out date on/after the first click. Do not preview a backward range.
		if ( range_end.getTime() < range_start.getTime() ) {
			return false;
		}

		working_date = new Date( range_start.getTime() );
		while ( working_date.getTime() <= range_end.getTime() ) {
			sql_class_day = wpbc__get__sql_class_date( working_date );
			if ( ! wpbc_is_this_day_selectable( resource_id, sql_class_day ) ) {
				return false;
			}

			td_overs.push( '#calendar_booking' + resource_id + ' .cal4date-' + wpbc__get__td_class_date( working_date ) );
			working_date.setDate( working_date.getDate() + 1 );
		}

		if ( td_overs.length ) {
			jQuery( td_overs.join( ',' ) ).addClass( 'datepick-days-cell-over' );
		}

		return true;
	}


	/**
	 * Complete an unrestricted two-click range when the Business Small range engine is not loaded.
	 * The hidden booking field must contain every date because Free time/hint handlers consume a comma-separated list.
	 *
	 * @param {string} selected_dates Datepick's endpoint string.
	 * @param {number|string} resource_id Booking resource ID.
	 * @returns {boolean} True after a complete valid range, false while incomplete or invalid.
	 */
	function wpbc__calendar__do_days_select__unrestricted_range( selected_dates, resource_id ){

		var inst = wpbc_calendar__get_inst( resource_id );
		var range_start;
		var range_end;
		var current_date;
		var selected_range = [];

		if ( null === inst ) {
			return false;
		}

		// Datepick writes "start - start" after click one. Keep its internal endpoint, but do not expose a submittable range yet.
		if ( true === inst.stayOpen || inst.dates.length < 2 || ! inst.dates[ 0 ] || ! inst.dates[ 1 ] ) {
			jQuery( '#date_booking' + resource_id ).val( '' );
			return false;
		}

		range_start = new Date( inst.dates[ 0 ].getFullYear(), inst.dates[ 0 ].getMonth(), inst.dates[ 0 ].getDate(), 0, 0, 0 );
		range_end   = new Date( inst.dates[ 1 ].getFullYear(), inst.dates[ 1 ].getMonth(), inst.dates[ 1 ].getDate(), 0, 0, 0 );

		// Defensive normalization. Datepick normally prevents an end date before the first endpoint.
		if ( range_end.getTime() < range_start.getTime() ) {
			current_date = range_start;
			range_start = range_end;
			range_end = current_date;
		}

		current_date = new Date( range_start.getTime() );
		while ( current_date.getTime() <= range_end.getTime() ) {
			if ( ! wpbc_is_this_day_selectable( resource_id, wpbc__get__sql_class_date( current_date ) ) ) {
				wpbc_calendar__unselect_all_dates( resource_id );
				if ( 'function' === typeof ( wpbc_front_end__show_message__warning ) ) {
					wpbc_front_end__show_message__warning(
						'#booking_form_div' + resource_id + ' .bk_calendar_frame',
						_wpbc.get_message( 'message_range_selection_has_unavailable_dates' ),
						'text'
					);
				}
				return false;
			}

			selected_range.push( jQuery.datepick._formatDate( inst, current_date ) );
			current_date.setDate( current_date.getDate() + 1 );
		}

		jQuery( '#date_booking' + resource_id ).val( selected_range.join( ', ' ) );
		return true;
	}


	/**
	 * Remove the range-selection guidance belonging to one calendar.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 */
	function wpbc_range_selection__hide_guidance( resource_id ){
		jQuery( '#wpbc_range_selection_guidance' + resource_id ).remove();
	}


	/**
	 * Show a persistent informational note after the first range click.
	 * The calendar parameter can be set to false by PHP or JavaScript to suppress this UI per resource.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 * @returns {boolean} True when the note was inserted.
	 */
	function wpbc_range_selection__show_guidance( resource_id ){

		var is_enabled = _wpbc.calendar__get_param_value( resource_id, 'range_selection_guidance_is_enabled' );
		var $booking_form = jQuery( '#booking_form_div' + resource_id );
		var $calendar_frame;
		var $note;

		wpbc_range_selection__hide_guidance( resource_id );

		if (
			   false === is_enabled
			|| 0 === is_enabled
			|| '0' === is_enabled
			|| 'off' === String( is_enabled ).toLowerCase()
			|| 'false' === String( is_enabled ).toLowerCase()
			|| 'dynamic' !== _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' )
			|| 0 === $booking_form.length
		) {
			return false;
		}

		$calendar_frame = $booking_form.find( '.block_hints.datepick' ).first();
		if ( 0 === $calendar_frame.length ) {
			$calendar_frame = $booking_form.find( '.wpbc_cal_powered_by' ).first();
			if ( 0 === $calendar_frame.length ) {
				$calendar_frame = $booking_form.find( '.bk_calendar_frame' ).first();
				if ( 0 === $calendar_frame.length ) {
					return false;
				}
			}
		}

		$note = jQuery( '<div>', {
			'id': 'wpbc_range_selection_guidance' + resource_id,
			'class': 'wpbc_range_selection_guidance wpbc_front_end__message wpbc_fe_message_info',
			'role': 'status',
			'aria-live': 'polite'
		} );
		$note.append( jQuery( '<i>', {
			'class': 'menu_icon icon-1x wpbc_icn_info_outline',
			'aria-hidden': 'true'
		} ) );
		$note.append( jQuery( '<span>' ).text( _wpbc.get_message( 'message_range_selection_click_last_date' ) ) );
		$calendar_frame.after( $note );

		return true;
	}


	/**
	 * Synchronize the guidance with Datepick's two-click range state.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 */
	function wpbc_range_selection__sync_guidance( resource_id ){

		var inst = wpbc_calendar__get_inst( resource_id );

		if (
			   null !== inst
			&& 'dynamic' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' )
			&& true === inst.stayOpen
			&& 1 === inst.dates.length
			&& inst.dates[ 0 ]
		) {
			wpbc_range_selection__show_guidance( resource_id );
			return;
		}

		wpbc_range_selection__hide_guidance( resource_id );
	}


	/**
	 * Select calendar date cells
	 *
	 * @param date										-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00
	 *     GMT+0200 (Eastern European Standard Time)
	 * @param calendar_params_arr						-  Calendar Settings Object:  	{
	 *																  						"resource_id": 4
	 *																					}
	 * @param datepick_this								- this of datepick Obj
	 *
	 */
	function wpbc__calendar__on_select_days( date, calendar_params_arr, datepick_this ){

		var resource_id = ( 'undefined' !== typeof(calendar_params_arr[ 'resource_id' ]) ) ? calendar_params_arr[ 'resource_id' ] : '1';		// '1'

		// Set unselectable,  if only Availability Calendar  here (and we do not insert Booking form by mistake).
		var is_unselectable_calendar = ( jQuery( '#calendar_booking_unselectable' + resource_id ).length > 0);				// FixIn: 8.0.1.2.
		var is_booking_form_exist    = ( jQuery( '#booking_form_div' + resource_id ).length > 0 );
		if ( ( is_unselectable_calendar ) && ( ! is_booking_form_exist ) ){
			wpbc_calendar__unselect_all_dates( resource_id );																			// Unselect Dates
			jQuery('.wpbc_only_calendar .popover_calendar_hover').remove();                      							// Hide all opened popovers
			return false;
		}

		jQuery( '#date_booking' + resource_id ).val( date );																// Add selected dates to  hidden textarea


		if ( 'function' === typeof (wpbc__calendar__do_days_select__bs) ) {
			wpbc__calendar__do_days_select__bs( date, resource_id );
		} else if ( 'dynamic' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ) {
			wpbc__calendar__do_days_select__unrestricted_range( date, resource_id );
		}

		wpbc_range_selection__sync_guidance( resource_id );

		wpbc_disable_time_fields_in_booking_form( resource_id );

		// Hook -- trigger day selection -----------------------------------------------------------------------------------
		var mouse_clicked_dates = date;																						// Can be: "05.10.2023 - 07.10.2023"  |  "10.10.2023 - 10.10.2023"  |
		var all_selected_dates_arr = wpbc_get__selected_dates_sql__as_arr( resource_id );									// Can be: [ "2023-10-05", "2023-10-06", "2023-10-07", … ]
		jQuery( ".booking_form_div" ).trigger( "date_selected", [ resource_id, mouse_clicked_dates, all_selected_dates_arr ] );
	}

	// Mark middle selected dates with 0.5 opacity		// FixIn: 10.3.0.9.
	jQuery( document ).ready( function (){
		jQuery( ".booking_form_div" ).on( 'date_selected', function ( event, resource_id, date ){
				if (
					   (  'fixed' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ))
					|| ('dynamic' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ))
				){
					var closed_timer = setTimeout( function (){
						var middle_days_opacity = _wpbc.get_other_param( 'calendars__days_selection__middle_days_opacity' );
						jQuery( '#calendar_booking' + resource_id + ' .datepick-current-day' ).not( ".selected_check_in_out" ).css( 'opacity', middle_days_opacity );
					}, 10 );
				}
		} );
	} );


	/**
	 * --  T i m e    F i e l d s     start  --------------------------------------------------------------------------
	 */

	/**
	 * Disable time slots in booking form depend on selected dates and booked dates/times
	 *
	 * @param resource_id
	 */
	function wpbc_disable_time_fields_in_booking_form( resource_id ){

		/**
		 * 	1. Get all time fields in the booking form as array  of objects
		 * 					[
		 * 					 	   {	jquery_option:      jQuery_Object {}
		 * 								name:               'rangetime2[]'
		 * 								times_as_seconds:   [ 21600, 23400 ]
		 * 								value_option_24h:   '06:00 - 06:30'
		 * 					     }
		 * 					  ...
		 * 						   {	jquery_option:      jQuery_Object {}
		 * 								name:               'starttime2[]'
		 * 								times_as_seconds:   [ 21600 ]
		 * 								value_option_24h:   '06:00'
		 *  					    }
		 * 					 ]
		 */
		var time_fields_obj_arr = wpbc_get__time_fields__in_booking_form__as_arr( resource_id );

		// 2. Get all selected dates in  SQL format  like this [ "2023-08-23", "2023-08-24", "2023-08-25", ... ]
		var selected_dates_arr = wpbc_get__selected_dates_sql__as_arr( resource_id );

		// 3. Get child booking resources  or single booking resource  that  exist  in dates
		var child_resources_arr = wpbc_clone_obj( _wpbc.booking__get_param_value( resource_id, 'resources_id_arr__in_dates' ) );

		var sql_date;
		var child_resource_id;
		var merged_seconds;
		var time_fields_obj;
		var is_intersect;
		var is_check_in;

		var today_time__real  = new Date( _wpbc.get_other_param( 'time_local_arr' )[0], ( parseInt( _wpbc.get_other_param( 'time_local_arr' )[1] ) - 1), _wpbc.get_other_param( 'time_local_arr' )[2], _wpbc.get_other_param( 'time_local_arr' )[3], _wpbc.get_other_param( 'time_local_arr' )[4], 0 );
		var today_time__shift = new Date( _wpbc.get_other_param( 'today_arr'      )[0], ( parseInt( _wpbc.get_other_param(      'today_arr' )[1] ) - 1), _wpbc.get_other_param( 'today_arr'      )[2], _wpbc.get_other_param( 'today_arr'      )[3], _wpbc.get_other_param( 'today_arr'      )[4], 0 );
		var allow_past_context = _wpbc.get_other_param( 'this_page_allow_past' );
		var edit_booking_hash_context = _wpbc.get_other_param( 'this_page_booking_hash' );
		var is_allow_past_context =
			   ( '1' === String( allow_past_context ) )
			|| ( 1 === allow_past_context )
			|| ( true === allow_past_context )
			|| ( '' !== String( edit_booking_hash_context || '' ) )
			|| ( location.href.indexOf( 'booking_hash' ) > -1 )
			|| ( location.href.indexOf( 'allow_past' ) > -1 );

		// 4. Loop  all  time Fields options		// FixIn: 10.3.0.2.
		for ( let field_key = 0; field_key < time_fields_obj_arr.length; field_key++ ){

			time_fields_obj_arr[ field_key ].disabled = 0;          // By default, this time field is not disabled.

			time_fields_obj = time_fields_obj_arr[ field_key ];		// { times_as_seconds: [ 21600, 23400 ], value_option_24h: '06:00 - 06:30', name: 'rangetime2[]', jquery_option: jQuery_Object {}}

			// Loop  all  selected dates.
			for ( var i = 0; i < selected_dates_arr.length; i++ ) {

				// Get Date: '2023-08-18'.
				sql_date = selected_dates_arr[i];

				var is_time_in_past = is_allow_past_context ? false : wpbc_check_is_time_in_past( today_time__shift, sql_date, time_fields_obj );
				// Exception  for 'End Time' field,  when  selected several dates. // FixIn: 10.14.1.5.
				if ( ( ! is_allow_past_context ) &&
					('On' !== _wpbc.calendar__get_param_value( resource_id, 'booking_recurrent_time' )) &&
					(-1 !== time_fields_obj.name.indexOf( 'endtime' )) &&
					(selected_dates_arr.length > 1)
				) {
					is_time_in_past = wpbc_check_is_time_in_past( today_time__shift, selected_dates_arr[(selected_dates_arr.length - 1)], time_fields_obj );
				}
				if ( is_time_in_past ) {
					// This time for selected date already  in the past.
					time_fields_obj_arr[field_key].disabled = 1;
					break;											// exist  from   Dates LOOP.
				}
				// FixIn: 9.9.0.31.
				if (
					   ( 'Off' === _wpbc.calendar__get_param_value( resource_id, 'booking_recurrent_time' ) )
					&& ( selected_dates_arr.length>1 )
				){
					//TODO: skip some fields checking if it's start / end time for mulple dates  selection  mode.
					//TODO: we need to fix situation  for entimes,  when  user  select  several  dates,  and in start  time booked 00:00 - 15:00 , but systsme block untill 15:00 the end time as well,  which  is wrong,  because it 2 or 3 dates selection  and end date can be fullu  available

					if ( (0 == i) && (time_fields_obj[ 'name' ].indexOf( 'endtime' ) >= 0) ){
						break;
					}
					if ( ( (selected_dates_arr.length-1) == i ) && (time_fields_obj[ 'name' ].indexOf( 'starttime' ) >= 0) ){
						break;
					}
				}



				var how_many_resources_intersected = 0;
				// Loop all resources ID
					// for ( var res_key in child_resources_arr ){	 						// FixIn: 10.3.0.2.
				if ( null === child_resources_arr ) {
					child_resources_arr = [];
				}
				for ( let res_key = 0; res_key < child_resources_arr.length; res_key++ ){

					child_resource_id = child_resources_arr[ res_key ];

					// _wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[12].booked_time_slots.merged_seconds		= [ "07:00:11 - 07:30:02", "10:00:11 - 00:00:00" ]
					// _wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[2].booked_time_slots.merged_seconds			= [  [ 25211, 27002 ], [ 36011, 86400 ]  ]

					if ( false !== _wpbc.bookings_in_calendar__get_for_date( resource_id, sql_date ) ){
						merged_seconds = _wpbc.bookings_in_calendar__get_for_date( resource_id, sql_date )[ child_resource_id ].booked_time_slots.merged_seconds;		// [  [ 25211, 27002 ], [ 36011, 86400 ]  ]
					} else {
						merged_seconds = [];
					}
					if ( time_fields_obj.times_as_seconds.length > 1 ){
						is_intersect = wpbc_is_intersect__range_time_interval(  [
																					[
																						( parseInt( time_fields_obj.times_as_seconds[0] ) + 20 ),
																						( parseInt( time_fields_obj.times_as_seconds[1] ) - 20 )
																					]
																				]
																				, merged_seconds );
					} else {
						is_check_in = (-1 !== time_fields_obj.name.indexOf( 'start' ));
						is_intersect = wpbc_is_intersect__one_time_interval(
																				( ( is_check_in )
																							  ? parseInt( time_fields_obj.times_as_seconds ) + 20
																							  : parseInt( time_fields_obj.times_as_seconds ) - 20
																				)
																				, merged_seconds );
					}
					if (is_intersect){
						how_many_resources_intersected++;			// Increase
					}

				}

				if ( child_resources_arr.length == how_many_resources_intersected ) {
					// All resources intersected,  then  it's means that this time-slot or time must  be  Disabled, and we can  exist  from   selected_dates_arr LOOP

					time_fields_obj_arr[ field_key ].disabled = 1;
					break;											// exist  from   Dates LOOP
				}
			}
		}


		// 5. Now we can disable time slot in HTML by  using  ( field.disabled == 1 ) property
		wpbc__html__time_field_options__set_disabled( time_fields_obj_arr );

		jQuery( ".booking_form_div" ).trigger( 'wpbc_hook_timeslots_disabled', [resource_id, selected_dates_arr] );					// Trigger hook on disabling timeslots.		Usage: 	jQuery( ".booking_form_div" ).on( 'wpbc_hook_timeslots_disabled', function ( event, bk_type, all_dates ){ ... } );		// FixIn: 8.7.11.9.
	}


		/**
		 * Check if specific time(-slot) already  in the past for selected date
		 *
		 * @param js_current_time_to_check		- JS Date
		 * @param sql_date						- '2025-01-26'
		 * @param time_fields_obj				- Object
		 * @returns {boolean}
		 */
		function wpbc_check_is_time_in_past( js_current_time_to_check, sql_date, time_fields_obj ) {

			// FixIn: 10.9.6.4
			var sql_date_arr = sql_date.split( '-' );
			var sql_date__midnight = new Date( parseInt( sql_date_arr[0] ), ( parseInt( sql_date_arr[1] ) - 1 ), parseInt( sql_date_arr[2] ), 0, 0, 0 );
			var sql_date__midnight_miliseconds = sql_date__midnight.getTime();

			var is_intersect = false;

			if ( time_fields_obj.times_as_seconds.length > 1 ) {

				if ( js_current_time_to_check.getTime() > (sql_date__midnight_miliseconds + (parseInt( time_fields_obj.times_as_seconds[0] ) + 20) * 1000) ) {
					is_intersect = true;
				}
				if ( js_current_time_to_check.getTime() > (sql_date__midnight_miliseconds + (parseInt( time_fields_obj.times_as_seconds[1] ) - 20) * 1000) ) {
					is_intersect = true;
				}

			} else {
				var is_check_in = (-1 !== time_fields_obj.name.indexOf( 'start' ));

				var times_as_seconds_check = (is_check_in) ? parseInt( time_fields_obj.times_as_seconds ) + 20 : parseInt( time_fields_obj.times_as_seconds ) - 20;

				times_as_seconds_check = sql_date__midnight_miliseconds + times_as_seconds_check * 1000;

				if ( js_current_time_to_check.getTime() > times_as_seconds_check ) {
					is_intersect = true;
				}
			}

			return is_intersect;
		}

		/**
		 * Is number inside /intersect  of array of intervals ?
		 *
		 * @param time_A		     	- 25800
		 * @param time_interval_B		- [  [ 25211, 27002 ], [ 36011, 86400 ]  ]
		 * @returns {boolean}
		 */
		function wpbc_is_intersect__one_time_interval( time_A, time_interval_B ){

			for ( var j = 0; j < time_interval_B.length; j++ ){

				if ( (parseInt( time_A ) > parseInt( time_interval_B[ j ][ 0 ] )) && (parseInt( time_A ) < parseInt( time_interval_B[ j ][ 1 ] )) ){
					return true
				}

				// if ( ( parseInt( time_A ) == parseInt( time_interval_B[ j ][ 0 ] ) ) || ( parseInt( time_A ) == parseInt( time_interval_B[ j ][ 1 ] ) ) ) {
				// 			// Time A just  at  the border of interval
				// }
			}

		    return false;
		}

		/**
		 * Is these array of intervals intersected ?
		 *
		 * @param time_interval_A		- [ [ 21600, 23400 ] ]
		 * @param time_interval_B		- [  [ 25211, 27002 ], [ 36011, 86400 ]  ]
		 * @returns {boolean}
		 */
		function wpbc_is_intersect__range_time_interval( time_interval_A, time_interval_B ){

			var is_intersect;

			for ( var i = 0; i < time_interval_A.length; i++ ){

				for ( var j = 0; j < time_interval_B.length; j++ ){

					is_intersect = wpbc_intervals__is_intersected( time_interval_A[ i ], time_interval_B[ j ] );

					if ( is_intersect ){
						return true;
					}
				}
			}

			return false;
		}

		/**
		 * Get all time fields in the booking form as array  of objects
		 *
		 * @param resource_id
		 * @returns []
		 *
		 * 		Example:
		 * 					[
		 * 					 	   {
		 * 								value_option_24h:   '06:00 - 06:30'
		 * 								times_as_seconds:   [ 21600, 23400 ]
		 * 					 	   		jquery_option:      jQuery_Object {}
		 * 								name:               'rangetime2[]'
		 * 					     }
		 * 					  ...
		 * 						   {
		 * 								value_option_24h:   '06:00'
		 * 								times_as_seconds:   [ 21600 ]
		 * 						   		jquery_option:      jQuery_Object {}
		 * 								name:               'starttime2[]'
		 *  					    }
		 * 					 ]
		 */
		function wpbc_get__time_fields__in_booking_form__as_arr( resource_id ){
		    /**
			 * Fields with  []  like this   select[name="rangetime1[]"]
			 * it's when we have 'multiple' in shortcode:   [select* rangetime multiple  "06:00 - 06:30" ... ]
			 */
			var time_fields_arr=[
									'select[name="rangetime' + resource_id + '"]',
									'select[name="rangetime' + resource_id + '[]"]',
									'select[name="starttime' + resource_id + '"]',
									'select[name="starttime' + resource_id + '[]"]',
									'select[name="endtime' + resource_id + '"]',
									'select[name="endtime' + resource_id + '[]"]'
								];

			var time_fields_obj_arr = [];

			// Loop all Time Fields
			for ( var ctf= 0; ctf < time_fields_arr.length; ctf++ ){

				var time_field = time_fields_arr[ ctf ];
				var time_option = jQuery( time_field + ' option' );

				// Loop all options in time field
				for ( var j = 0; j < time_option.length; j++ ){

					var jquery_option = jQuery( time_field + ' option:eq(' + j + ')' );
					var value_option_seconds_arr = jquery_option.val().split( '-' );
					var times_as_seconds = [];

					// Get time as seconds
					if ( value_option_seconds_arr.length ){									// FixIn: 9.8.10.1.
						for ( let i = 0; i < value_option_seconds_arr.length; i++ ){		// FixIn: 10.0.0.56.
							// value_option_seconds_arr[i] = '14:00 '  | ' 16:00'   (if from 'rangetime') and '16:00'  if (start/end time)

							var start_end_times_arr = value_option_seconds_arr[ i ].trim().split( ':' );

							var time_in_seconds = parseInt( start_end_times_arr[ 0 ] ) * 60 * 60 + parseInt( start_end_times_arr[ 1 ] ) * 60;

							times_as_seconds.push( time_in_seconds );
						}
					}

					time_fields_obj_arr.push( {
												'name'            : jQuery( time_field ).attr( 'name' ),
												'value_option_24h': jquery_option.val(),
												'jquery_option'   : jquery_option,
												'times_as_seconds': times_as_seconds
											} );
				}
			}

			return time_fields_obj_arr;
		}

			/**
			 * Disable HTML options and add booked CSS class
			 *
			 * @param time_fields_obj_arr      - this value is from  the func:
			 *     	wpbc_get__time_fields__in_booking_form__as_arr( resource_id )
			 * 					[
			 * 					 	   {	jquery_option:      jQuery_Object {}
			 * 								name:               'rangetime2[]'
			 * 								times_as_seconds:   [ 21600, 23400 ]
			 * 								value_option_24h:   '06:00 - 06:30'
			 * 	  						    disabled = 1
			 * 					     }
			 * 					  ...
			 * 						   {	jquery_option:      jQuery_Object {}
			 * 								name:               'starttime2[]'
			 * 								times_as_seconds:   [ 21600 ]
			 * 								value_option_24h:   '06:00'
			 *   							disabled = 0
			 *  					    }
			 * 					 ]
			 *
			 */
			function wpbc__html__time_field_options__set_disabled( time_fields_obj_arr ){

				var jquery_option;

				for ( var i = 0; i < time_fields_obj_arr.length; i++ ){

					var jquery_option = time_fields_obj_arr[ i ].jquery_option;

					if ( 1 == time_fields_obj_arr[ i ].disabled ){
						jquery_option.prop( 'disabled', true ); 		// Make disable some options
						jquery_option.addClass( 'booked' );           	// Add "booked" CSS class

						// if this booked element selected --> then deselect  it
						if ( jquery_option.prop( 'selected' ) ){
							jquery_option.prop( 'selected', false );

							jquery_option.parent().find( 'option:not([disabled]):first' ).prop( 'selected', true ).trigger( "change" );
						}

					} else {
						jquery_option.prop( 'disabled', false );  		// Make active all times
						jquery_option.removeClass( 'booked' );   		// Remove class "booked"
					}
				}

			}

	/**
	 * Check if this time_range | Time_Slot is Full Day  booked
	 *
	 * @param timeslot_arr_in_seconds		- [ 36011, 86400 ]
	 * @returns {boolean}
	 */
	function wpbc_is_this_timeslot__full_day_booked( timeslot_arr_in_seconds ){

		if (
				( timeslot_arr_in_seconds.length > 1 )
			&& ( parseInt( timeslot_arr_in_seconds[ 0 ] ) < 30 )
			&& ( parseInt( timeslot_arr_in_seconds[ 1 ] ) >  ( (24 * 60 * 60) - 30) )
		){
			return true;
		}

		return false;
	}


	// -----------------------------------------------------------------------------------------------------------------
	/*  ==  S e l e c t e d    D a t e s  /  T i m e - F i e l d s  ==
	// ----------------------------------------------------------------------------------------------------------------- */

	/**
	 *  Get all selected dates in SQL format like this [ "2023-08-23", "2023-08-24" , ... ]
	 *
	 * @param resource_id
	 * @returns {[]}			[ "2023-08-23", "2023-08-24", "2023-08-25", "2023-08-26", "2023-08-27", "2023-08-28",
	 *     "2023-08-29" ]
	 */
	function wpbc_get__selected_dates_sql__as_arr( resource_id ){

		var selected_dates_arr = [];
		selected_dates_arr = jQuery( '#date_booking' + resource_id ).val().split(',');

		if ( selected_dates_arr.length ){												// FixIn: 9.8.10.1.
			for ( let i = 0; i < selected_dates_arr.length; i++ ){						// FixIn: 10.0.0.56.
				selected_dates_arr[ i ] = selected_dates_arr[ i ].trim();
				selected_dates_arr[ i ] = selected_dates_arr[ i ].split( '.' );
				if ( selected_dates_arr[ i ].length > 1 ){
					selected_dates_arr[ i ] = selected_dates_arr[ i ][ 2 ] + '-' + selected_dates_arr[ i ][ 1 ] + '-' + selected_dates_arr[ i ][ 0 ];
				}
			}
		}

		// Remove empty elements from an array
		selected_dates_arr = selected_dates_arr.filter( function ( n ){ return parseInt(n); } );

		selected_dates_arr.sort();

		return selected_dates_arr;
	}


	/**
	 * Get all time fields in the booking form as array  of objects
	 *
	 * @param resource_id
	 * @param is_only_selected_time
	 * @returns []
	 *
	 * 		Example:
	 * 					[
	 * 					 	   {
	 * 								value_option_24h:   '06:00 - 06:30'
	 * 								times_as_seconds:   [ 21600, 23400 ]
	 * 					 	   		jquery_option:      jQuery_Object {}
	 * 								name:               'rangetime2[]'
	 * 					     }
	 * 					  ...
	 * 						   {
	 * 								value_option_24h:   '06:00'
	 * 								times_as_seconds:   [ 21600 ]
	 * 						   		jquery_option:      jQuery_Object {}
	 * 								name:               'starttime2[]'
	 *  					    }
	 * 					 ]
	 */
	function wpbc_get__selected_time_fields__in_booking_form__as_arr( resource_id, is_only_selected_time = true ){
		/**
		 * Fields with  []  like this   select[name="rangetime1[]"]
		 * it's when we have 'multiple' in shortcode:   [select* rangetime multiple  "06:00 - 06:30" ... ]
		 */
		var time_fields_arr=[
								'select[name="rangetime' + resource_id + '"]',
								'select[name="rangetime' + resource_id + '[]"]',
								'select[name="starttime' + resource_id + '"]',
								'select[name="starttime' + resource_id + '[]"]',
								'select[name="endtime' + resource_id + '"]',
								'select[name="endtime' + resource_id + '[]"]',
								'select[name="durationtime' + resource_id + '"]',
								'select[name="durationtime' + resource_id + '[]"]'
							];

		var time_fields_obj_arr = [];

		// Loop all Time Fields
		for ( var ctf= 0; ctf < time_fields_arr.length; ctf++ ){

			var time_field = time_fields_arr[ ctf ];

			var time_option;
			if ( is_only_selected_time ){
				time_option = jQuery( '#booking_form' + resource_id + ' ' + time_field + ' option:selected' );			// Exclude conditional  fields,  because of using '#booking_form3 ...'
			} else {
				time_option = jQuery( '#booking_form' + resource_id + ' ' + time_field + ' option' );				// All  time fields
			}


			// Loop all options in time field
			for ( var j = 0; j < time_option.length; j++ ){

				var jquery_option = jQuery( time_option[ j ] );		// Get only  selected options 	//jQuery( time_field + ' option:eq(' + j + ')' );
				var value_option_seconds_arr = jquery_option.val().split( '-' );
				var times_as_seconds = [];

				// Get time as seconds
				if ( value_option_seconds_arr.length ){				 								// FixIn: 9.8.10.1.
					for ( let i = 0; i < value_option_seconds_arr.length; i++ ){					// FixIn: 10.0.0.56.
						// value_option_seconds_arr[i] = '14:00 '  | ' 16:00'   (if from 'rangetime') and '16:00'  if (start/end time)

						var start_end_times_arr = value_option_seconds_arr[ i ].trim().split( ':' );

						var time_in_seconds = parseInt( start_end_times_arr[ 0 ] ) * 60 * 60 + parseInt( start_end_times_arr[ 1 ] ) * 60;

						times_as_seconds.push( time_in_seconds );
					}
				}

				time_fields_obj_arr.push( {
											'name'            : jQuery( '#booking_form' + resource_id + ' ' + time_field ).attr( 'name' ),
											'value_option_24h': jquery_option.val(),
											'jquery_option'   : jquery_option,
											'times_as_seconds': times_as_seconds
										} );
			}
		}

		// Text:   [starttime] - [endtime] -----------------------------------------------------------------------------

		var text_time_fields_arr=[
									'input[name="starttime' + resource_id + '"]',
									'input[name="endtime' + resource_id + '"]',
								];
		for ( var tf= 0; tf < text_time_fields_arr.length; tf++ ){

			var text_jquery = jQuery( '#booking_form' + resource_id + ' ' + text_time_fields_arr[ tf ] );								// Exclude conditional  fields,  because of using '#booking_form3 ...'
			if ( text_jquery.length > 0 ){

				var time__h_m__arr = text_jquery.val().trim().split( ':' );														// '14:00'
				if ( 0 == time__h_m__arr.length ){
					continue;									// Not entered time value in a field
				}
				if ( 1 == time__h_m__arr.length ){
					if ( '' === time__h_m__arr[ 0 ] ){
						continue;								// Not entered time value in a field
					}
					time__h_m__arr[ 1 ] = 0;
				}
				var text_time_in_seconds = parseInt( time__h_m__arr[ 0 ] ) * 60 * 60 + parseInt( time__h_m__arr[ 1 ] ) * 60;

				var text_times_as_seconds = [];
				text_times_as_seconds.push( text_time_in_seconds );

				time_fields_obj_arr.push( {
											'name'            : text_jquery.attr( 'name' ),
											'value_option_24h': text_jquery.val(),
											'jquery_option'   : text_jquery,
											'times_as_seconds': text_times_as_seconds
										} );
			}
		}

		return time_fields_obj_arr;
	}



// ---------------------------------------------------------------------------------------------------------------------
/*  ==  S U P P O R T    for    C A L E N D A R  ==
// --------------------------------------------------------------------------------------------------------------------- */

	/**
	 * Get Calendar datepick Instance.
	 *
	 * @param {int|string} resource_id
	 * @returns {*|null}
	 */
	function wpbc_calendar__get_inst(resource_id) {

		if ( 'undefined' === typeof (resource_id) ) {
			resource_id = '1';
		}

		if ( jQuery( '#calendar_booking' + resource_id ).length > 0 ) {

			try {
				var inst = jQuery.datepick._getInst( jQuery( '#calendar_booking' + resource_id ).get( 0 ) );
				return inst ? inst : null;
			} catch ( e ) {
				return null;
			}
		}

		return null;
	}


	/**
	 * Unselect  all dates in calendar and visually update this calendar
	 *
	 * @param resource_id		ID of booking resource
	 * @returns {boolean}		true on success | false,  if no such  calendar
	 */
	function wpbc_calendar__unselect_all_dates( resource_id ){

		if ( 'undefined' === typeof (resource_id) ){
			resource_id = '1';
		}

		wpbc_range_selection__hide_guidance( resource_id );

		var inst = wpbc_calendar__get_inst( resource_id )

		if ( null !== inst ){

			// Unselect all dates and set  properties of Datepick
			jQuery( '#date_booking' + resource_id ).val( '' );      //FixIn: 5.4.3
			inst.stayOpen = false;
			inst.dates = [];
			jQuery.datepick._updateDatepick( inst );

			return true
		}

		return false;

	}

	/**
	 * Clear days highlighting in All or specific Calendars
	 *
     * @param resource_id  - can be skiped to  clear highlighting in all calendars
     */
	function wpbc_calendars__clear_days_highlighting( resource_id ){

		if ( 'undefined' !== typeof ( resource_id ) ){

			jQuery( '#calendar_booking' + resource_id + ' .datepick-days-cell-over' ).removeClass( 'datepick-days-cell-over' );		// Clear in specific calendar

		} else {
			jQuery( '.datepick-days-cell-over' ).removeClass( 'datepick-days-cell-over' );								// Clear in all calendars
		}
	}

	/**
	 * Scroll to specific month in calendar
	 *
	 * @param resource_id		ID of resource
	 * @param year				- real year  - 2023
	 * @param month				- real month - 12
	 * @returns {boolean}
	 */
	function wpbc_calendar__scroll_to( resource_id, year, month ){

		if ( 'undefined' === typeof (resource_id) ){ resource_id = '1'; }
		var inst = wpbc_calendar__get_inst( resource_id )
		if ( null !== inst ){

			year  = parseInt( year );
			month = parseInt( month ) - 1;		// In JS date,  month -1

			inst.cursorDate = new Date();
			// In some cases,  the setFullYear can  set  only Year,  and not the Month and day      // FixIn: 6.2.3.5.
			inst.cursorDate.setFullYear( year, month, 1 );
			inst.cursorDate.setMonth( month );
			inst.cursorDate.setDate( 1 );

			inst.drawMonth = inst.cursorDate.getMonth();
			inst.drawYear = inst.cursorDate.getFullYear();

			jQuery.datepick._notifyChange( inst );
			jQuery.datepick._adjustInstDate( inst );
			jQuery.datepick._showDate( inst );
			jQuery.datepick._updateDatepick( inst );

			return true;
		}
		return false;
	}

	/**
	 * Is this date selectable in calendar (mainly it's means AVAILABLE date)
	 *
	 * @param {int|string} resource_id		1
	 * @param {string} sql_class_day		'2023-08-11'
	 * @returns {boolean}					true | false
	 */
	function wpbc_is_this_day_selectable( resource_id, sql_class_day ){

		// Get Data --------------------------------------------------------------------------------------------------------
		var date_bookings_obj = _wpbc.bookings_in_calendar__get_for_date( resource_id, sql_class_day );
		if ( ! date_bookings_obj || 'undefined' === typeof ( date_bookings_obj[ 'day_availability' ] ) ) {
			return false;
		}

		var is_day_selectable = ( parseInt( date_bookings_obj[ 'day_availability' ] ) > 0 );

		if ( typeof (date_bookings_obj[ 'summary' ]) === 'undefined' ){
			return is_day_selectable;
		}

		if ( 'available' != date_bookings_obj[ 'summary']['status_for_day' ] ){

			var is_set_pending_days_selectable = _wpbc.calendar__get_param_value( resource_id, 'pending_days_selectable' );		// set pending days selectable          // FixIn: 8.6.1.18.
			var booking_statuses_arr = wpbc_get_booking_statuses__as_arr( date_bookings_obj );

			if (
				   ( wpbc_booking_statuses__has( booking_statuses_arr, 'pending' ) )
				|| ( wpbc_booking_statuses__has( booking_statuses_arr, 'pending_pending' ) )
				|| ( wpbc_booking_statuses__has( booking_statuses_arr, 'pending_approved' ) )
				|| ( wpbc_booking_statuses__has( booking_statuses_arr, 'approved_pending' ) )
			){
				is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
			}
		}

		return is_day_selectable;
	}

	/**
	 * Is date to check IN array of selected dates
	 *
	 * @param {date}js_date_to_check		- JS Date			- simple  JavaScript Date object
	 * @param {[]} js_dates_arr			- [ JSDate, ... ]   - array  of JS dates
	 * @returns {boolean}
	 */
	function wpbc_is_this_day_among_selected_days( js_date_to_check, js_dates_arr ){

		for ( var date_index = 0; date_index < js_dates_arr.length ; date_index++ ){     									// FixIn: 8.4.5.16.
			if ( ( js_dates_arr[ date_index ].getFullYear() === js_date_to_check.getFullYear() ) &&
				 ( js_dates_arr[ date_index ].getMonth() === js_date_to_check.getMonth() ) &&
				 ( js_dates_arr[ date_index ].getDate() === js_date_to_check.getDate() ) ) {
					return true;
			}
		}

		return  false;
	}

	/**
	 * Get SQL Class Date '2023-08-01' from  JS Date
	 *
	 * @param date				JS Date
	 * @returns {string}		'2023-08-12'
	 */
	function wpbc__get__sql_class_date( date ){

		var sql_class_day = date.getFullYear() + '-';
			sql_class_day += ( ( date.getMonth() + 1 ) < 10 ) ? '0' : '';
			sql_class_day += ( date.getMonth() + 1 ) + '-'
			sql_class_day += ( date.getDate() < 10 ) ? '0' : '';
			sql_class_day += date.getDate();

			return sql_class_day;
	}

	/**
	 * Get JS Date from  the SQL date format '2024-05-14'
	 * @param sql_class_date
	 * @returns {Date}
	 */
	function wpbc__get__js_date( sql_class_date ){

		var sql_class_date_arr = sql_class_date.split( '-' );

		var date_js = new Date();

		date_js.setFullYear( parseInt( sql_class_date_arr[ 0 ] ), (parseInt( sql_class_date_arr[ 1 ] ) - 1), parseInt( sql_class_date_arr[ 2 ] ) );  // year, month, date

		// Without this time adjust Dates selection  in Datepicker can not work!!!
		date_js.setHours(0);
		date_js.setMinutes(0);
		date_js.setSeconds(0);
		date_js.setMilliseconds(0);

		return date_js;
	}

	/**
	 * Get TD Class Date '1-31-2023' from  JS Date
	 *
	 * @param date				JS Date
	 * @returns {string}		'1-31-2023'
	 */
	function wpbc__get__td_class_date( date ){

		var td_class_day = (date.getMonth() + 1) + '-' + date.getDate() + '-' + date.getFullYear();								// '1-9-2023'

		return td_class_day;
	}

	/**
	 * Get date params from  string date
	 *
	 * @param date			string date like '31.5.2023'
	 * @param separator		default '.'  can be skipped.
	 * @returns {  {date: number, month: number, year: number}  }
	 */
	function wpbc__get__date_params__from_string_date( date , separator){

		separator = ( 'undefined' !== typeof (separator) ) ? separator : '.';

		var date_arr = date.split( separator );
		var date_obj = {
			'year' :  parseInt( date_arr[ 2 ] ),
			'month': (parseInt( date_arr[ 1 ] ) - 1),
			'date' :  parseInt( date_arr[ 0 ] )
		};
		return date_obj;		// for 		 = new Date( date_obj.year , date_obj.month , date_obj.date );
	}

	/**
	 * Add Spin Loader to  calendar
	 * @param resource_id
	 */
	function wpbc_calendar__loading__start( resource_id ){
		if ( ! jQuery( '#calendar_booking' + resource_id ).next().hasClass( 'wpbc_spins_loader_wrapper' ) ){
			jQuery( '#calendar_booking' + resource_id ).after( '<div class="wpbc_spins_loader_wrapper"><div class="wpbc_spin_loader_one_new"></div></div>' );
		}
		if ( ! jQuery( '#calendar_booking' + resource_id ).hasClass( 'wpbc_calendar_blur_small' ) ){
			jQuery( '#calendar_booking' + resource_id ).addClass( 'wpbc_calendar_blur_small' );
		}
		wpbc_calendar__blur__start( resource_id );
	}

	/**
	 * Remove Spin Loader to  calendar
	 * @param resource_id
	 */
	function wpbc_calendar__loading__stop( resource_id ){
		jQuery( '#calendar_booking' + resource_id + ' + .wpbc_spins_loader_wrapper' ).remove();
		jQuery( '#calendar_booking' + resource_id ).removeClass( 'wpbc_calendar_blur_small' );
		wpbc_calendar__blur__stop( resource_id );
	}

	/**
	 * Add Blur to  calendar
	 * @param resource_id
	 */
	function wpbc_calendar__blur__start( resource_id ){
		if ( ! jQuery( '#calendar_booking' + resource_id ).hasClass( 'wpbc_calendar_blur' ) ){
			jQuery( '#calendar_booking' + resource_id ).addClass( 'wpbc_calendar_blur' );
		}
	}

	/**
	 * Remove Blur in  calendar
	 * @param resource_id
	 */
	function wpbc_calendar__blur__stop( resource_id ){
		jQuery( '#calendar_booking' + resource_id ).removeClass( 'wpbc_calendar_blur' );
	}


	// .................................................................................................................
	/*  ==  Calendar Update  - View  ==
	// ................................................................................................................. */

	/**
	 * Update look of calendar (safe).
	 *
	 * In Elementor preview the DOM can be re-rendered, so the calendar element may exist
	 * while the Datepick instance is missing. In that case try to (re)initialize.
	 *
	 * @param {int|string} resource_id
	 * @return {boolean} true if updated, false if not possible
	 */
	function wpbc_calendar__update_look(resource_id) {

		var inst = wpbc_calendar__get_inst( resource_id );

		// If instance missing, try to re-init calendar once.
		if ( null === inst ) {

			var jq_cal = jQuery( '#calendar_booking' + resource_id );

			if ( jq_cal.length && ('function' === typeof wpbc_calendar_show) ) {

				// Elementor sometimes leaves stale class without real instance.
				if ( jq_cal.hasClass( 'hasDatepick' ) ) {
					jq_cal.removeClass( 'hasDatepick' );
				}

				// Try to init datepick markup now.
				wpbc_calendar_show( resource_id );

				// Try again.
				inst = wpbc_calendar__get_inst( resource_id );
			}
		}

		// Still no instance -> do not crash the whole ajax flow.
		if ( null === inst ) {
			return false;
		}

		jQuery.datepick._updateDatepick( inst );
		return true;
	}



	/**
	 * Update dynamically Number of Months in calendar
	 *
	 * @param resource_id int
	 * @param months_number int
	 */
	function wpbc_calendar__update_months_number( resource_id, months_number ){
		var inst = wpbc_calendar__get_inst( resource_id );
		if ( null !== inst ){
			inst.settings[ 'numberOfMonths' ] = months_number;
			//_wpbc.calendar__set_param_value( resource_id, 'calendar_number_of_months', months_number );
			wpbc_calendar__update_look( resource_id );
		}
	}


	/**
	 * Show calendar in  different Skin
	 *
	 * @param selected_skin_url
	 */
	function wpbc__calendar__change_skin( selected_skin_url ){

	//console.log( 'SKIN SELECTION ::', selected_skin_url );

		// Remove CSS skin
		var stylesheet = document.getElementById( 'wpbc-calendar-skin-css' );
		stylesheet.parentNode.removeChild( stylesheet );


		// Add new CSS skin
		var headID = document.getElementsByTagName( "head" )[ 0 ];
		var cssNode = document.createElement( 'link' );
		cssNode.type = 'text/css';
		cssNode.setAttribute( "id", "wpbc-calendar-skin-css" );
		cssNode.rel = 'stylesheet';
		cssNode.media = 'screen';
		cssNode.href = selected_skin_url;	//"http://beta/wp-content/plugins/booking/css/skins/green-01.css";
		headID.appendChild( cssNode );
	}


	function wpbc__css__change_skin( selected_skin_url, stylesheet_id = 'wpbc-time_picker-skin-css' ){

		// Remove CSS skin
		var stylesheet = document.getElementById( stylesheet_id );
		stylesheet.parentNode.removeChild( stylesheet );


		// Add new CSS skin
		var headID = document.getElementsByTagName( "head" )[ 0 ];
		var cssNode = document.createElement( 'link' );
		cssNode.type = 'text/css';
		cssNode.setAttribute( "id", stylesheet_id );
		cssNode.rel = 'stylesheet';
		cssNode.media = 'screen';
		cssNode.href = selected_skin_url;	//"http://beta/wp-content/plugins/booking/css/skins/green-01.css";
		headID.appendChild( cssNode );
	}


// ---------------------------------------------------------------------------------------------------------------------
/*  ==  S U P P O R T    M A T H  ==
// --------------------------------------------------------------------------------------------------------------------- */

		/**
		 * Merge several  intersected intervals or return not intersected:
		 * [[1,3],[2,6],[8,10],[15,18]]  ->   [[1,6],[8,10],[15,18]]
		 *
		 * @param [] intervals			 [ [1,3],[2,4],[6,8],[9,10],[3,7] ]
		 * @returns []					 [ [1,8],[9,10] ]
		 *
		 * Exmample: wpbc_intervals__merge_inersected(  [ [1,3],[2,4],[6,8],[9,10],[3,7] ]  );
		 */
		function wpbc_intervals__merge_inersected( intervals ){

			if ( ! intervals || intervals.length === 0 ){
				return [];
			}

			var merged = [];
			intervals.sort( function ( a, b ){
				return a[ 0 ] - b[ 0 ];
			} );

			var mergedInterval = intervals[ 0 ];

			for ( var i = 1; i < intervals.length; i++ ){
				var interval = intervals[ i ];

				if ( interval[ 0 ] <= mergedInterval[ 1 ] ){
					mergedInterval[ 1 ] = Math.max( mergedInterval[ 1 ], interval[ 1 ] );
				} else {
					merged.push( mergedInterval );
					mergedInterval = interval;
				}
			}

			merged.push( mergedInterval );
			return merged;
		}


		/**
		 * Is 2 intervals intersected:       [36011, 86392]    <=>    [1, 43192]  =>  true      ( intersected )
		 *
		 * Good explanation  here
		 * https://stackoverflow.com/questions/3269434/whats-the-most-efficient-way-to-test-if-two-ranges-overlap
		 *
		 * @param  interval_A   - [ 36011, 86392 ]
		 * @param  interval_B   - [     1, 43192 ]
		 *
		 * @return bool
		 */
		function wpbc_intervals__is_intersected( interval_A, interval_B ) {

			if (
					( 0 == interval_A.length )
				 || ( 0 == interval_B.length )
			){
				return false;
			}

			interval_A[ 0 ] = parseInt( interval_A[ 0 ] );
			interval_A[ 1 ] = parseInt( interval_A[ 1 ] );
			interval_B[ 0 ] = parseInt( interval_B[ 0 ] );
			interval_B[ 1 ] = parseInt( interval_B[ 1 ] );

			var is_intersected = Math.max( interval_A[ 0 ], interval_B[ 0 ] ) - Math.min( interval_A[ 1 ], interval_B[ 1 ] );

			// if ( 0 == is_intersected ) {
			//	                                 // Such ranges going one after other, e.g.: [ 12, 15 ] and [ 15, 21 ]
			// }

			if ( is_intersected < 0 ) {
				return true;                     // INTERSECTED
			}

			return false;                       // Not intersected
		}


		/**
		 * Get the closets ABS value of element in array to the current myValue
		 *
		 * @param myValue 	- int element to search closet 			4
		 * @param myArray	- array of elements where to search 	[5,8,1,7]
		 * @returns int												5
		 */
		function wpbc_get_abs_closest_value_in_arr( myValue, myArray ){

			if ( myArray.length == 0 ){ 								// If the array is empty -> return  the myValue
				return myValue;
			}

			var obj = myArray[ 0 ];
			var diff = Math.abs( myValue - obj );             	// Get distance between  1st element
			var closetValue = myArray[ 0 ];                   			// Save 1st element

			for ( var i = 1; i < myArray.length; i++ ){
				obj = myArray[ i ];

				if ( Math.abs( myValue - obj ) < diff ){     			// we found closer value -> save it
					diff = Math.abs( myValue - obj );
					closetValue = obj;
				}
			}

			return closetValue;
		}


// ---------------------------------------------------------------------------------------------------------------------
/*  ==  T O O L T I P S  ==
// --------------------------------------------------------------------------------------------------------------------- */

	/**
	 * Define tooltip to show,  when  mouse over Date in Calendar
	 *
	 * @param  tooltip_text			- Text to show				'Booked time: 12:00 - 13:00<br>Cost: $20.00'
	 * @param  resource_id			- ID of booking resource	'1'
	 * @param  td_class				- SQL class					'1-9-2023'
	 * @returns {boolean}					- defined to show or not
	 */
	function wpbc_set_tooltip___for__calendar_date( tooltip_text, resource_id, td_class ){

		//TODO: make escaping of text for quot symbols,  and JS/HTML...

		jQuery( '#calendar_booking' + resource_id + ' td.cal4date-' + td_class ).attr( 'data-content', tooltip_text );

		var td_el = jQuery( '#calendar_booking' + resource_id + ' td.cal4date-' + td_class ).get( 0 );					// FixIn: 9.0.1.1.

		if (
			   ( 'undefined' !== typeof(td_el) )
			&& ( undefined == td_el._tippy )
			&& ( '' !== tooltip_text )
		){

			wpbc_tippy( td_el , {
					content( reference ){

						var popover_content = reference.getAttribute( 'data-content' );

						return '<div class="popover popover_tippy">'
									+ '<div class="popover-content">'
										+ popover_content
									+ '</div>'
							 + '</div>';
					},
					allowHTML        : true,
					trigger			 : 'mouseenter focus',
					interactive      : false,
					hideOnClick      : true,
					interactiveBorder: 10,
					maxWidth         : 550,
					theme            : 'wpbc-tippy-times',
					placement        : 'top',
					delay			 : [400, 0],																		// FixIn: 9.4.2.2.
					//delay			 : [0, 9999999999],						// Debuge  tooltip
					ignoreAttributes : true,
					touch			 : true,								//['hold', 500], // 500ms delay				// FixIn: 9.2.1.5.
					appendTo: () => document.body,
			});

			return  true;
		}

		return  false;
	}


// ---------------------------------------------------------------------------------------------------------------------
/*  ==  Dates Functions  ==
// --------------------------------------------------------------------------------------------------------------------- */

/**
 * Get number of dates between 2 JS Dates
 *
 * @param date1		JS Date
 * @param date2		JS Date
 * @returns {number}
 */
function wpbc_dates__days_between(date1, date2) {

    // The number of milliseconds in one day
    var ONE_DAY = 1000 * 60 * 60 * 24;

    // Convert both dates to milliseconds
    var date1_ms = date1.getTime();
    var date2_ms = date2.getTime();

    // Calculate the difference in milliseconds
    var difference_ms =  date1_ms - date2_ms;

    // Convert back to days and return
    return Math.round(difference_ms/ONE_DAY);
}


/**
 * Check  if this array  of dates is consecutive array  of dates or not.
 * 		e.g.  ['2024-05-09','2024-05-19','2024-05-30'] -> false
 * 		e.g.  ['2024-05-09','2024-05-10','2024-05-11'] -> true
 * @param sql_dates_arr	 array		e.g.: ['2024-05-09','2024-05-19','2024-05-30']
 * @returns {boolean}
 */
function wpbc_dates__is_consecutive_dates_arr_range( sql_dates_arr ){													// FixIn: 10.0.0.50.

	if ( sql_dates_arr.length > 1 ){
		var previos_date = wpbc__get__js_date( sql_dates_arr[ 0 ] );
		var current_date;

		for ( var i = 1; i < sql_dates_arr.length; i++ ){
			current_date = wpbc__get__js_date( sql_dates_arr[i] );

			if ( wpbc_dates__days_between( current_date, previos_date ) != 1 ){
				return  false;
			}

			previos_date = current_date;
		}
	}

	return true;
}


// ---------------------------------------------------------------------------------------------------------------------
/*  ==  Auto Dates Selection  ==
// --------------------------------------------------------------------------------------------------------------------- */

/**
 *  == How to  use ? ==
 *
 *  For Dates selection, we need to use this logic!     We need select the dates only after booking data loaded!
 *
 *  Check example bellow.
 *
 *	// Fire on all booking dates loaded
 *	jQuery( 'body' ).on( 'wpbc_calendar_ajx__loaded_data', function ( event, loaded_resource_id ){
 *
 *		if ( loaded_resource_id == select_dates_in_calendar_id ){
 *			wpbc_auto_select_dates_in_calendar( select_dates_in_calendar_id, '2024-05-15', '2024-05-25' );
 *		}
 *	} );
 *
 */


/**
 * Try to Auto select dates in specific calendar by simulated clicks in datepicker
 *
 * @param resource_id		1
 * @param check_in_ymd		'2024-05-09'		OR  	['2024-05-09','2024-05-19','2024-05-20']
 * @param check_out_ymd		'2024-05-15'		Optional
 *
 * @returns {number}		number of selected dates
 *
 * 	Example 1:				var num_selected_days = wpbc_auto_select_dates_in_calendar( 1, '2024-05-15',
 *     '2024-05-25' ); Example 2:				var num_selected_days = wpbc_auto_select_dates_in_calendar( 1,
 *     ['2024-05-09','2024-05-19','2024-05-20'] );
 */
function wpbc_auto_select_dates_in_calendar( resource_id, check_in_ymd, check_out_ymd = '' ){								// FixIn: 10.0.0.47.

	console.log( 'WPBC_AUTO_SELECT_DATES_IN_CALENDAR( RESOURCE_ID, CHECK_IN_YMD, CHECK_OUT_YMD )', resource_id, check_in_ymd, check_out_ymd );

	if (
		   ( '2100-01-01' == check_in_ymd )
		|| ( '2100-01-01' == check_out_ymd )
		|| ( ( '' == check_in_ymd ) && ( '' == check_out_ymd ) )
	){
		return 0;
	}

	// -----------------------------------------------------------------------------------------------------------------
	// If 	check_in_ymd  =  [ '2024-05-09','2024-05-19','2024-05-30' ]				ARRAY of DATES						// FixIn: 10.0.0.50.
	// -----------------------------------------------------------------------------------------------------------------
	var dates_to_select_arr = [];
	if ( Array.isArray( check_in_ymd ) ){
		dates_to_select_arr = wpbc_clone_obj( check_in_ymd );

		// -------------------------------------------------------------------------------------------------------------
		// Exceptions to  set  	MULTIPLE DAYS 	mode
		// -------------------------------------------------------------------------------------------------------------
		// if dates as NOT CONSECUTIVE: ['2024-05-09','2024-05-19','2024-05-30'], -> set MULTIPLE DAYS mode
		if (
			   ( dates_to_select_arr.length > 0 )
			&& ( '' == check_out_ymd )
			&& ( ! wpbc_dates__is_consecutive_dates_arr_range( dates_to_select_arr ) )
		){
			wpbc_cal_days_select__multiple( resource_id );
		}
		// if multiple days to select, but enabled SINGLE day mode, -> set MULTIPLE DAYS mode
		if (
			   ( dates_to_select_arr.length > 1 )
			&& ( '' == check_out_ymd )
			&& ( 'single' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) )
		){
			wpbc_cal_days_select__multiple( resource_id );
		}
		// -------------------------------------------------------------------------------------------------------------
		check_in_ymd = dates_to_select_arr[ 0 ];
		if ( '' == check_out_ymd ){
			check_out_ymd = dates_to_select_arr[ (dates_to_select_arr.length-1) ];
		}
	}
	// -----------------------------------------------------------------------------------------------------------------


	if ( '' == check_in_ymd ){
		check_in_ymd = check_out_ymd;
	}
	if ( '' == check_out_ymd ){
		check_out_ymd = check_in_ymd;
	}

	if ( 'undefined' === typeof (resource_id) ){
		resource_id = '1';
	}


	var inst = wpbc_calendar__get_inst( resource_id );

	if ( null !== inst ){

		// Unselect all dates and set  properties of Datepick
		jQuery( '#date_booking' + resource_id ).val( '' );      														//FixIn: 5.4.3
		inst.stayOpen = false;
		inst.dates = [];
		var check_in_js = wpbc__get__js_date( check_in_ymd );
		var td_cell     = wpbc_get_clicked_td( inst.id, check_in_js );

		// Is ome type of error, then select multiple days selection  mode.
		if ( '' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ) {
 			_wpbc.calendar__set_param_value( resource_id, 'days_select_mode', 'multiple' );
		}


		// ---------------------------------------------------------------------------------------------------------
		//  == DYNAMIC ==
		if ( 'dynamic' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ){
			// 1-st click
			inst.stayOpen = false;
			jQuery.datepick._selectDay( td_cell, '#' + inst.id, check_in_js.getTime() );
			if ( 0 === inst.dates.length ){
				return 0;  								// First click  was unsuccessful, so we must not make other click
			}

			// 2-nd click
			var check_out_js = wpbc__get__js_date( check_out_ymd );
			var td_cell_out = wpbc_get_clicked_td( inst.id, check_out_js );
			inst.stayOpen = true;
			jQuery.datepick._selectDay( td_cell_out, '#' + inst.id, check_out_js.getTime() );
		}

		// ---------------------------------------------------------------------------------------------------------
		//  == FIXED ==
		if (  'fixed' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' )) {
			jQuery.datepick._selectDay( td_cell, '#' + inst.id, check_in_js.getTime() );
		}

		// ---------------------------------------------------------------------------------------------------------
		//  == SINGLE ==
		if ( 'single' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ){
			//jQuery.datepick._restrictMinMax( inst, jQuery.datepick._determineDate( inst, check_in_js, null ) );		// Do we need to run  this ? Please note, check_in_js must  have time,  min, sec defined to 0!
			jQuery.datepick._selectDay( td_cell, '#' + inst.id, check_in_js.getTime() );
		}

		// ---------------------------------------------------------------------------------------------------------
		//  == MULTIPLE ==
		if ( 'multiple' === _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' ) ){

			var dates_arr;

			if ( dates_to_select_arr.length > 0 ){
				// Situation, when we have dates array: ['2024-05-09','2024-05-19','2024-05-30'].  and not the Check In / Check  out dates as parameter in this function
				dates_arr = wpbc_get_selection_dates_js_str_arr__from_arr( dates_to_select_arr );
			} else {
				dates_arr = wpbc_get_selection_dates_js_str_arr__from_check_in_out( check_in_ymd, check_out_ymd, inst );
			}

			if ( 0 === dates_arr.dates_js.length ){
				return 0;
			}

			// For Calendar Days selection
			for ( var j = 0; j < dates_arr.dates_js.length; j++ ){       // Loop array of dates

				var str_date = wpbc__get__sql_class_date( dates_arr.dates_js[ j ] );

				// Date unavailable !
				if ( 0 == _wpbc.bookings_in_calendar__get_for_date( resource_id, str_date ).day_availability ){
					return 0;
				}

				if ( dates_arr.dates_js[ j ] != -1 ) {
					inst.dates.push( dates_arr.dates_js[ j ] );
				}
			}

			var check_out_date = dates_arr.dates_js[ (dates_arr.dates_js.length - 1) ];

			inst.dates.push( check_out_date ); 			// Need add one additional SAME date for correct  works of dates selection !!!!!

			var checkout_timestamp = check_out_date.getTime();
			var td_cell = wpbc_get_clicked_td( inst.id, check_out_date );

			jQuery.datepick._selectDay( td_cell, '#' + inst.id, checkout_timestamp );
		}


		if ( 0 !== inst.dates.length ){
			// Scroll to specific month, if we set dates in some future months
			wpbc_calendar__scroll_to( resource_id, inst.dates[ 0 ].getFullYear(), inst.dates[ 0 ].getMonth()+1 );
		}

		return inst.dates.length;
	}

	return 0;
}

	/**
	 * Get HTML td element (where was click in calendar  day  cell)
	 *
	 * @param calendar_html_id			'calendar_booking1'
	 * @param date_js					JS Date
	 * @returns {*|jQuery}				Dom HTML td element
	 */
	function wpbc_get_clicked_td( calendar_html_id, date_js ){

	    var td_cell = jQuery( '#' + calendar_html_id + ' .sql_date_' + wpbc__get__sql_class_date( date_js ) ).get( 0 );

		return td_cell;
	}

	/**
	 * Get arrays of JS and SQL dates as dates array
	 *
	 * @param check_in_ymd							'2024-05-15'
	 * @param check_out_ymd							'2024-05-25'
	 * @param inst									Datepick Inst. Use wpbc_calendar__get_inst( resource_id );
	 * @returns {{dates_js: *[], dates_str: *[]}}
	 */
	function wpbc_get_selection_dates_js_str_arr__from_check_in_out( check_in_ymd, check_out_ymd , inst ){

		var original_array = [];
		var date;
		var bk_distinct_dates = [];

		var check_in_date = check_in_ymd.split( '-' );
		var check_out_date = check_out_ymd.split( '-' );

		date = new Date();
		date.setFullYear( check_in_date[ 0 ], (check_in_date[ 1 ] - 1), check_in_date[ 2 ] );                                    // year, month, date
		var original_check_in_date = date;
		original_array.push( jQuery.datepick._restrictMinMax( inst, jQuery.datepick._determineDate( inst, date, null ) ) ); //add date
		if ( ! wpbc_in_array( bk_distinct_dates, (check_in_date[ 2 ] + '.' + check_in_date[ 1 ] + '.' + check_in_date[ 0 ]) ) ){
			bk_distinct_dates.push( parseInt(check_in_date[ 2 ]) + '.' + parseInt(check_in_date[ 1 ]) + '.' + check_in_date[ 0 ] );
		}

		var date_out = new Date();
		date_out.setFullYear( check_out_date[ 0 ], (check_out_date[ 1 ] - 1), check_out_date[ 2 ] );                                    // year, month, date
		var original_check_out_date = date_out;

		var mewDate = new Date( original_check_in_date.getFullYear(), original_check_in_date.getMonth(), original_check_in_date.getDate() );
		mewDate.setDate( original_check_in_date.getDate() + 1 );

		while (
			(original_check_out_date > date) &&
			(original_check_in_date != original_check_out_date) ){
			date = new Date( mewDate.getFullYear(), mewDate.getMonth(), mewDate.getDate() );

			original_array.push( jQuery.datepick._restrictMinMax( inst, jQuery.datepick._determineDate( inst, date, null ) ) ); //add date
			if ( !wpbc_in_array( bk_distinct_dates, (date.getDate() + '.' + parseInt( date.getMonth() + 1 ) + '.' + date.getFullYear()) ) ){
				bk_distinct_dates.push( (parseInt(date.getDate()) + '.' + parseInt( date.getMonth() + 1 ) + '.' + date.getFullYear()) );
			}

			mewDate = new Date( date.getFullYear(), date.getMonth(), date.getDate() );
			mewDate.setDate( mewDate.getDate() + 1 );
		}
		original_array.pop();
		bk_distinct_dates.pop();

		return {'dates_js': original_array, 'dates_str': bk_distinct_dates};
	}

	/**
	 * Get arrays of JS and SQL dates as dates array
	 *
	 * @param dates_to_select_arr	= ['2024-05-09','2024-05-19','2024-05-30']
	 *
	 * @returns {{dates_js: *[], dates_str: *[]}}
	 */
	function wpbc_get_selection_dates_js_str_arr__from_arr( dates_to_select_arr ){										// FixIn: 10.0.0.50.

		var original_array    = [];
		var bk_distinct_dates = [];
		var one_date_str;

		for ( var d = 0; d < dates_to_select_arr.length; d++ ){

			original_array.push( wpbc__get__js_date( dates_to_select_arr[ d ] ) );

			one_date_str = dates_to_select_arr[ d ].split('-')
			if ( ! wpbc_in_array( bk_distinct_dates, (one_date_str[ 2 ] + '.' + one_date_str[ 1 ] + '.' + one_date_str[ 0 ]) ) ){
				bk_distinct_dates.push( parseInt(one_date_str[ 2 ]) + '.' + parseInt(one_date_str[ 1 ]) + '.' + one_date_str[ 0 ] );
			}
		}

		return {'dates_js': original_array, 'dates_str': original_array};
	}

// =====================================================================================================================
/*  ==  Auto Fill Fields / Auto Select Dates  ==
// ===================================================================================================================== */

jQuery( document ).ready( function (){

	var url_params = new URLSearchParams( window.location.search );

	// Disable days selection  in calendar,  after  redirection  from  the "Search results page,  after  search  availability" 			// FixIn: 8.8.2.3.
	if  ( 'On' != _wpbc.get_other_param( 'is_enabled_booking_search_results_days_select' ) ) {
		if (
			( url_params.has( 'wpbc_select_check_in' ) ) &&
			( url_params.has( 'wpbc_select_check_out' ) ) &&
			( url_params.has( 'wpbc_select_calendar_id' ) )
		){

			var select_dates_in_calendar_id = parseInt( url_params.get( 'wpbc_select_calendar_id' ) );

			// Fire on all booking dates loaded
			jQuery( 'body' ).on( 'wpbc_calendar_ajx__loaded_data', function ( event, loaded_resource_id ){

				if ( loaded_resource_id == select_dates_in_calendar_id ){
					wpbc_auto_select_dates_in_calendar( select_dates_in_calendar_id, url_params.get( 'wpbc_select_check_in' ), url_params.get( 'wpbc_select_check_out' ) );
				}
			} );
		}
	}

	if ( url_params.has( 'wpbc_auto_fill' ) ){

		var wpbc_auto_fill_value = url_params.get( 'wpbc_auto_fill' );

		// Convert back.     Some systems do not like symbol '~' in URL, so  we need to replace to  some other symbols
		wpbc_auto_fill_value = wpbc_auto_fill_value.replaceAll( '_^_', '~' );

		wpbc_auto_fill_booking_fields( wpbc_auto_fill_value );
	}

} );

/**
 * Autofill / select booking form  fields by  values from  the GET request  parameter: ?wpbc_auto_fill=
 *
 * @param auto_fill_str
 */
function wpbc_auto_fill_booking_fields( auto_fill_str ){																// FixIn: 10.0.0.48.

	if ( '' == auto_fill_str ){
		return;
	}

// console.log( 'WPBC_AUTO_FILL_BOOKING_FIELDS( AUTO_FILL_STR )', auto_fill_str);

	var fields_arr = wpbc_auto_fill_booking_fields__parse( auto_fill_str );

	for ( let i = 0; i < fields_arr.length; i++ ){
		jQuery( '[name="' + fields_arr[ i ][ 'name' ] + '"]' ).val( fields_arr[ i ][ 'value' ] );
	}
}

	/**
	 * Parse data from  get parameter:	?wpbc_auto_fill=visitors231^2~max_capacity231^2
	 *
	 * @param data_str      =   'visitors231^2~max_capacity231^2';
	 * @returns {*}
	 */
	function wpbc_auto_fill_booking_fields__parse( data_str ){

		var filter_options_arr = [];

		var data_arr = data_str.split( '~' );

		for ( var j = 0; j < data_arr.length; j++ ){

			var my_form_field = data_arr[ j ].split( '^' );

			var filter_name  = ('undefined' !== typeof (my_form_field[ 0 ])) ? my_form_field[ 0 ] : '';
			var filter_value = ('undefined' !== typeof (my_form_field[ 1 ])) ? my_form_field[ 1 ] : '';

			filter_options_arr.push(
										{
											'name'  : filter_name,
											'value' : filter_value
										}
								   );
		}
		return filter_options_arr;
	}

	/**
	 * Parse data from  get parameter:	?search_get__custom_params=...
	 *
	 * @param data_str      =   'text^search_field__display_check_in^23.05.2024~text^search_field__display_check_out^26.05.2024~selectbox-one^search_quantity^2~selectbox-one^location^Spain~selectbox-one^max_capacity^2~selectbox-one^amenity^parking~checkbox^search_field__extend_search_days^5~submit^^Search~hidden^search_get__check_in_ymd^2024-05-23~hidden^search_get__check_out_ymd^2024-05-26~hidden^search_get__time^~hidden^search_get__quantity^2~hidden^search_get__extend^5~hidden^search_get__users_id^~hidden^search_get__custom_params^~';
	 * @returns {*}
	 */
	function wpbc_auto_fill_search_fields__parse( data_str ){

		var filter_options_arr = [];

		var data_arr = data_str.split( '~' );

		for ( var j = 0; j < data_arr.length; j++ ){

			var my_form_field = data_arr[ j ].split( '^' );

			var filter_type  = ('undefined' !== typeof (my_form_field[ 0 ])) ? my_form_field[ 0 ] : '';
			var filter_name  = ('undefined' !== typeof (my_form_field[ 1 ])) ? my_form_field[ 1 ] : '';
			var filter_value = ('undefined' !== typeof (my_form_field[ 2 ])) ? my_form_field[ 2 ] : '';

			filter_options_arr.push(
										{
											'type'  : filter_type,
											'name'  : filter_name,
											'value' : filter_value
										}
								   );
		}
		return filter_options_arr;
	}


// ---------------------------------------------------------------------------------------------------------------------
/*  ==  Auto Update number of months in calendars ON screen size changed  ==
// --------------------------------------------------------------------------------------------------------------------- */

/**
 * Auto Update Number of Months in Calendar, e.g.:  		if    ( WINDOW_WIDTH <= 782px )   >>> 	MONTHS_NUMBER = 1
 *   ELSE:  number of months defined in shortcode.
 * @param resource_id int
 *
 */
function wpbc_calendar__auto_update_months_number__on_resize( resource_id ){

	if ( true === _wpbc.get_other_param( 'is_allow_several_months_on_mobile' ) ) {
		return false;
	}

	var local__number_of_months = parseInt( _wpbc.calendar__get_param_value( resource_id, 'calendar_number_of_months' ) );

	if ( local__number_of_months > 1 ){

		if ( jQuery( window ).width() <= 782 ){
			wpbc_calendar__update_months_number( resource_id, 1 );
		} else {
			wpbc_calendar__update_months_number( resource_id, local__number_of_months );
		}

	}
}

/**
 * Auto Update Number of Months in   ALL   Calendars
 *
 */
function wpbc_calendars__auto_update_months_number(){

	var all_calendars_arr = _wpbc.calendars_all__get();

	// This LOOP "for in" is GOOD, because we check  here keys    'calendar_' === calendar_id.slice( 0, 9 )
	for ( var calendar_id in all_calendars_arr ){
		if ( 'calendar_' === calendar_id.slice( 0, 9 ) ){
			var resource_id = parseInt( calendar_id.slice( 9 ) );			//  'calendar_3' -> 3
			if ( resource_id > 0 ){
				wpbc_calendar__auto_update_months_number__on_resize( resource_id );
			}
		}
	}
}

/**
 * If browser window changed,  then  update number of months.
 */
jQuery( window ).on( 'resize', function (){
	wpbc_calendars__auto_update_months_number();
} );

/**
 * Auto update calendar number of months on initial page load
 */
jQuery( document ).ready( function (){
	var closed_timer = setTimeout( function (){
		wpbc_calendars__auto_update_months_number();
	}, 100 );
});

// ---------------------------------------------------------------------------------------------------------------------
/*  ==  Check: calendar_dates_start: "2026-01-01", calendar_dates_end: "2026-12-31" ==  // FixIn: 10.13.1.4.
// --------------------------------------------------------------------------------------------------------------------- */
	/**
	 * Get Start JS Date of starting dates in calendar, from the _wpbc object.
	 *
	 * @param integer resource_id - resource ID, e.g.: 1.
	 */
	function wpbc_calendar__get_dates_start( resource_id ) {
		return wpbc_calendar__get_date_parameter( resource_id, 'calendar_dates_start' );
	}

	/**
	 * Get End JS Date of ending dates in calendar, from the _wpbc object.
	 *
	 * @param integer resource_id - resource ID, e.g.: 1.
	 */
	function wpbc_calendar__get_dates_end(resource_id) {
		return wpbc_calendar__get_date_parameter( resource_id, 'calendar_dates_end' );
	}

/**
 * Get validates date parameter.
 *
 * @param resource_id   - 1
 * @param parameter_str - 'calendar_dates_start' | 'calendar_dates_end' | ...
 */
function wpbc_calendar__get_date_parameter(resource_id, parameter_str) {

	var date_expected_ymd = _wpbc.calendar__get_param_value( resource_id, parameter_str );

	if ( ! date_expected_ymd ) {
		return false;             // '' | 0 | null | undefined  -> false.
	}

	if ( -1 !== date_expected_ymd.indexOf( '-' ) ) {

		var date_expected_ymd_arr = date_expected_ymd.split( '-' );	// '2025-07-26' -> ['2025', '07', '26']

		if ( date_expected_ymd_arr.length > 0 ) {
			var year  = (date_expected_ymd_arr.length > 0) ? parseInt( date_expected_ymd_arr[0] ) : new Date().getFullYear();	// Year.
			var month = (date_expected_ymd_arr.length > 1) ? (parseInt( date_expected_ymd_arr[1] ) - 1) : 0;  // (month - 1) or 0 - Jan.
			var day   = (date_expected_ymd_arr.length > 2) ? parseInt( date_expected_ymd_arr[2] ) : 1;  // date or Otherwise 1st of month

			var date_js = new Date( year, month, day, 0, 0, 0, 0 );

			return date_js;
		}
	}

	return false;  // Fallback,  if we not parsed this parameter  'calendar_dates_start' = '2025-07-26',  for example because of 'calendar_dates_start' = 'sfsdf'.
}

/**
 * ====================================================================================================================
 *	includes/__js/cal/days_select_custom.js
 * ====================================================================================================================
 */

// FixIn: 9.8.9.2.

/**
 * Re-Init Calendar and Re-Render it.
 *
 * @param resource_id
 */
function wpbc_cal__re_init( resource_id ){

	// Remove CLASS  for ability to re-render and reinit calendar.
	jQuery( '#calendar_booking' + resource_id ).removeClass( 'hasDatepick' );
	wpbc_calendar_show( resource_id );
}


/**
 * Re-Init previously  saved days selection  variables.
 *
 * @param resource_id
 */
function wpbc_cal_days_select__re_init( resource_id ){

	_wpbc.calendar__set_param_value( resource_id, 'saved_variable___days_select_initial'
		, {
			'dynamic__days_min'        : _wpbc.calendar__get_param_value( resource_id, 'dynamic__days_min' ),
			'dynamic__days_max'        : _wpbc.calendar__get_param_value( resource_id, 'dynamic__days_max' ),
			'dynamic__days_specific'   : _wpbc.calendar__get_param_value( resource_id, 'dynamic__days_specific' ),
			'dynamic__week_days__start': _wpbc.calendar__get_param_value( resource_id, 'dynamic__week_days__start' ),
			'fixed__days_num'          : _wpbc.calendar__get_param_value( resource_id, 'fixed__days_num' ),
			'fixed__week_days__start'  : _wpbc.calendar__get_param_value( resource_id, 'fixed__week_days__start' )
		}
	);
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set Single Day selection - after page load
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_ready_days_select__single( resource_id ){

	// Re-define selection, only after page loaded with all init vars
	jQuery(document).ready(function(){

		// Wait 1 second, just to  be sure, that all init vars defined
		setTimeout(function(){

			wpbc_cal_days_select__single( resource_id );

		}, 1000);
	});
}

/**
 * Set Single Day selection
 * Can be run at any  time,  when  calendar defined - useful for console run.
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_days_select__single( resource_id ){

	_wpbc.calendar__set_parameters( resource_id, {'days_select_mode': 'single'} );

	wpbc_cal_days_select__re_init( resource_id );
	wpbc_cal__re_init( resource_id );
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set Multiple Days selection  - after page load
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_ready_days_select__multiple( resource_id ){

	// Re-define selection, only after page loaded with all init vars
	jQuery(document).ready(function(){

		// Wait 1 second, just to  be sure, that all init vars defined
		setTimeout(function(){

			wpbc_cal_days_select__multiple( resource_id );

		}, 1000);
	});
}


/**
 * Set Multiple Days selection
 * Can be run at any  time,  when  calendar defined - useful for console run.
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_days_select__multiple( resource_id ){

	_wpbc.calendar__set_parameters( resource_id, {'days_select_mode': 'multiple'} );

	wpbc_cal_days_select__re_init( resource_id );
	wpbc_cal__re_init( resource_id );
}


// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set Fixed Days selection with  1 mouse click  - after page load
 *
 * @integer resource_id			- 1				   -- ID of booking resource (calendar) -
 * @integer days_number			- 3				   -- number of days to  select	-
 * @array week_days__start	- [-1] | [ 1, 5]   --  { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }
 */
function wpbc_cal_ready_days_select__fixed( resource_id, days_number, week_days__start = [-1] ){

	// Re-define selection, only after page loaded with all init vars
	jQuery(document).ready(function(){

		// Wait 1 second, just to  be sure, that all init vars defined
		setTimeout(function(){

			wpbc_cal_days_select__fixed( resource_id, days_number, week_days__start );

		}, 1000);
	});
}


/**
 * Set Fixed Days selection with  1 mouse click
 * Can be run at any  time,  when  calendar defined - useful for console run.
 *
 * @integer resource_id			- 1				   -- ID of booking resource (calendar) -
 * @integer days_number			- 3				   -- number of days to  select	-
 * @array week_days__start	- [-1] | [ 1, 5]   --  { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }
 */
function wpbc_cal_days_select__fixed( resource_id, days_number, week_days__start = [-1] ){

	_wpbc.calendar__set_parameters( resource_id, {'days_select_mode': 'fixed'} );

	_wpbc.calendar__set_parameters( resource_id, {'fixed__days_num': parseInt( days_number )} );			// Number of days selection with 1 mouse click
	_wpbc.calendar__set_parameters( resource_id, {'fixed__week_days__start': week_days__start} ); 	// { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }

	wpbc_cal_days_select__re_init( resource_id );
	wpbc_cal__re_init( resource_id );
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set the existing calendar parameters to two-click range mode after page load.
 * Free uses the unrestricted shared handler; Business Small+ keeps its already initialized advanced range rules.
 *
 * @param resource_id ID of booking resource.
 */
function wpbc_cal_ready_days_select__range_mode( resource_id ){

	jQuery(document).ready(function(){
		setTimeout(function(){
			wpbc_cal_days_select__range_mode( resource_id );
		}, 1000);
	});
}

/**
 * Switch to two-click range mode without changing any advanced range parameters.
 *
 * @param resource_id ID of booking resource.
 */
function wpbc_cal_days_select__range_mode( resource_id ){

	_wpbc.calendar__set_parameters( resource_id, {'days_select_mode': 'dynamic'} );

	wpbc_cal_days_select__re_init( resource_id );
	wpbc_cal__re_init( resource_id );
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set Range Days selection  with  2 mouse clicks  - after page load
 *
 * @integer resource_id			- 1				   		-- ID of booking resource (calendar)
 * @integer days_min			- 7				   		-- Min number of days to select
 * @integer days_max			- 30			   		-- Max number of days to select
 * @array days_specific			- [] | [7,14,21,28]		-- Restriction for Specific number of days selection
 * @array week_days__start		- [-1] | [ 1, 5]   		--  { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }
 */
function wpbc_cal_ready_days_select__range( resource_id, days_min, days_max, days_specific = [], week_days__start = [-1] ){

	// Re-define selection, only after page loaded with all init vars
	jQuery(document).ready(function(){

		// Wait 1 second, just to  be sure, that all init vars defined
		setTimeout(function(){

			wpbc_cal_days_select__range( resource_id, days_min, days_max, days_specific, week_days__start );
		}, 1000);
	});
}

/**
 * Set Range Days selection  with  2 mouse clicks
 * Can be run at any  time,  when  calendar defined - useful for console run.
 *
 * @integer resource_id			- 1				   		-- ID of booking resource (calendar)
 * @integer days_min			- 7				   		-- Min number of days to select
 * @integer days_max			- 30			   		-- Max number of days to select
 * @array days_specific			- [] | [7,14,21,28]		-- Restriction for Specific number of days selection
 * @array week_days__start		- [-1] | [ 1, 5]   		--  { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }
 */
function wpbc_cal_days_select__range( resource_id, days_min, days_max, days_specific = [], week_days__start = [-1] ){

	_wpbc.calendar__set_parameters(  resource_id, {'days_select_mode': 'dynamic'}  );
	_wpbc.calendar__set_param_value( resource_id, 'dynamic__days_min'         , parseInt( days_min )  );           		// Min. Number of days selection with 2 mouse clicks
	_wpbc.calendar__set_param_value( resource_id, 'dynamic__days_max'         , parseInt( days_max )  );          		// Max. Number of days selection with 2 mouse clicks
	_wpbc.calendar__set_param_value( resource_id, 'dynamic__days_specific'    , days_specific  );	      				// Example [5,7]
	_wpbc.calendar__set_param_value( resource_id, 'dynamic__week_days__start' , week_days__start  );  					// { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }

	wpbc_cal_days_select__re_init( resource_id );
	wpbc_cal__re_init( resource_id );
}

/**
 * ====================================================================================================================
 *	includes/__js/cal_ajx_load/wpbc_cal_ajx.js
 * ====================================================================================================================
 */

// ---------------------------------------------------------------------------------------------------------------------
//  A j a x    L o a d    C a l e n d a r    D a t a
// ---------------------------------------------------------------------------------------------------------------------

function wpbc_calendar__load_data__ajx( params ){

	// FixIn: 9.8.6.2.
	wpbc_calendar__loading__start( params['resource_id'] );

	// Trigger event for calendar before loading Booking data,  but after showing Calendar.
	if ( jQuery( '#calendar_booking' + params['resource_id'] ).length > 0 ){
		var target_elm = jQuery( 'body' ).trigger( "wpbc_calendar_ajx__before_loaded_data", [params['resource_id']] );
		 //jQuery( 'body' ).on( 'wpbc_calendar_ajx__before_loaded_data', function( event, resource_id ) { ... } );
	}

	if ( wpbc_balancer__is_wait( params , 'wpbc_calendar__load_data__ajx' ) ){
		return false;
	}

	// FixIn: 9.8.6.2.
	wpbc_calendar__blur__stop( params['resource_id'] );

	// -----------------------------------------------------------------------------------------------------------------
	// == Get start / end dates from  the Booking Calendar shortcode. ==
	// Example: [booking calendar_dates_start='2026-01-01' calendar_dates_end='2026-12-31'  resource_id=1]              // FixIn: 10.13.1.4.
	// -----------------------------------------------------------------------------------------------------------------
	if ( false !== wpbc_calendar__get_dates_start( params['resource_id'] ) ) {
		if ( ! params['dates_to_check'] ) { params['dates_to_check'] = []; }
		var dates_start = wpbc_calendar__get_dates_start( params['resource_id'] );  // E.g. - local__min_date = new Date( 2025, 0, 1 );
		if ( false !== dates_start ){
			params['dates_to_check'][0] = wpbc__get__sql_class_date( dates_start );
		}
	}
	if ( false !== wpbc_calendar__get_dates_end( params['resource_id'] ) ) {
		if ( !params['dates_to_check'] ) { params['dates_to_check'] = []; }
		var dates_end = wpbc_calendar__get_dates_end( params['resource_id'] );  // E.g. - local__min_date = new Date( 2025, 0, 1 );
		if ( false !== dates_end ) {
			params['dates_to_check'][1] = wpbc__get__sql_class_date( dates_end );
			if ( !params['dates_to_check'][0] ) {
				params['dates_to_check'][0] = wpbc__get__sql_class_date( new Date() );
			}
		}
	}
	// -----------------------------------------------------------------------------------------------------------------

// console.groupEnd(); console.time('resource_id_' + params['resource_id']);
console.groupCollapsed( 'WPBC_AJX_CALENDAR_LOAD' ); console.log( ' == Before Ajax Send - calendars_all__get() == ' , _wpbc.calendars_all__get() );
	if ( 'function' === typeof (wpbc_hook__init_timeselector) ) {
		wpbc_hook__init_timeselector();
	}

	// Start Ajax
	jQuery.post( wpbc_url_ajax,
				{
					action          : 'WPBC_AJX_CALENDAR_LOAD',
					wpbc_ajx_user_id: _wpbc.get_secure_param( 'user_id' ),
					nonce           : _wpbc.get_secure_param( 'nonce' ),
					wpbc_ajx_locale : _wpbc.get_secure_param( 'locale' ),

					calendar_request_params : params 						// Usually like: { 'resource_id': 1, 'max_days_count': 365 }
				},

				/**
				 * S u c c e s s
				 *
				 * @param response_data		-	its object returned from  Ajax - class-live-search.php
				 * @param textStatus		-	'success'
				 * @param jqXHR				-	Object
				 */
				function ( response_data, textStatus, jqXHR ) {
// console.timeEnd('resource_id_' + response_data['resource_id']);
console.log( ' == Response WPBC_AJX_CALENDAR_LOAD == ', response_data ); console.groupEnd();

					// FixIn: 9.8.6.2.
					var ajx_post_data__resource_id = wpbc_get_resource_id__from_ajx_post_data_url( this.data );
					wpbc_balancer__completed( ajx_post_data__resource_id , 'wpbc_calendar__load_data__ajx' );

					// Probably Error
					if ( (typeof response_data !== 'object') || (response_data === null) ){

						var jq_node  = wpbc_get_calendar__jq_node__for_messages( this.data );
						var message_type = 'info';

						if ( '' === response_data ){
							response_data = 'The server responds with an empty string. The server probably stopped working unexpectedly. <br>Please check your <strong>error.log</strong> in your server configuration for relative errors.';
							message_type = 'warning';
						}

						// Show Message
						wpbc_front_end__show_message( response_data , { 'type'     : message_type,
																		'show_here': {'jq_node': jq_node, 'where': 'after'},
																		'is_append': true,
																		'style'    : 'text-align:left;',
																		'delay'    : 0
																	} );
						return;
					}

					// Show Calendar
					wpbc_calendar__loading__stop( response_data[ 'resource_id' ] );

					// -------------------------------------------------------------------------------------------------
					// Bookings - Dates
					_wpbc.bookings_in_calendar__set_dates(  response_data[ 'resource_id' ], response_data[ 'ajx_data' ]['dates']  );

					// Bookings - Child or only single booking resource in dates
					_wpbc.booking__set_param_value( response_data[ 'resource_id' ], 'resources_id_arr__in_dates', response_data[ 'ajx_data' ][ 'resources_id_arr__in_dates' ] );

					// Aggregate booking resources,  if any ?
					_wpbc.booking__set_param_value( response_data[ 'resource_id' ], 'aggregate_resource_id_arr', response_data[ 'ajx_data' ][ 'aggregate_resource_id_arr' ] );
					// -------------------------------------------------------------------------------------------------

					// Update calendar
					wpbc_calendar__update_look( response_data[ 'resource_id' ] );

					if ( 'function' === typeof (wpbc_hook__init_timeselector) ) {
						wpbc_hook__init_timeselector();
					}

					if (
							( 'undefined' !== typeof (response_data[ 'ajx_data' ][ 'ajx_after_action_message' ]) )
						 && ( '' != response_data[ 'ajx_data' ][ 'ajx_after_action_message' ].replace( /\n/g, "<br />" ) )
					){

						var jq_node  = wpbc_get_calendar__jq_node__for_messages( this.data );

						// Show Message
						wpbc_front_end__show_message( response_data[ 'ajx_data' ][ 'ajx_after_action_message' ].replace( /\n/g, "<br />" ),
														{   'type'     : ( 'undefined' !== typeof( response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ] ) )
																		  ? response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ] : 'info',
															'show_here': {'jq_node': jq_node, 'where': 'after'},
															'is_append': true,
															'style'    : 'text-align:left;',
															'delay'    : 10000
														} );
					}

					if ( 'function' === typeof (wpbc_update_capacity_hint) ) {
						wpbc_update_capacity_hint( response_data['resource_id'] );
					}

					// Trigger event that calendar has been		 // FixIn: 10.0.0.44.  // FixIn: 10.14.17.2.
					if ( (jQuery( '#calendar_booking' + response_data['resource_id'] ).length > 0) || (jQuery( '#date_booking' + response_data['resource_id'] ).length > 0) ) {
						var target_elm = jQuery( 'body' ).trigger( "wpbc_calendar_ajx__loaded_data", [response_data[ 'resource_id' ]] );
						 //jQuery( 'body' ).on( 'wpbc_calendar_ajx__loaded_data', function( event, resource_id ) { ... } );
					}

					//jQuery( '#ajax_respond' ).html( response_data );		// For ability to show response, add such DIV element to page
				}
			  ).fail( function ( jqXHR, textStatus, errorThrown ) {    if ( window.console && window.console.log ){ console.log( 'Ajax_Error', jqXHR, textStatus, errorThrown ); }

					var ajx_post_data__resource_id = wpbc_get_resource_id__from_ajx_post_data_url( this.data );
					wpbc_balancer__completed( ajx_post_data__resource_id , 'wpbc_calendar__load_data__ajx' );

					// Get Content of Error Message
					var error_message = '<strong>' + 'Error!' + '</strong> ' + errorThrown ;
					if ( jqXHR.status ){
						error_message += ' (<b>' + jqXHR.status + '</b>)';
						if (403 == jqXHR.status ){
							error_message += '<br> Probably nonce for this page has been expired. Please <a href="javascript:void(0)" onclick="javascript:location.reload();">reload the page</a>.';
							error_message += '<br> Otherwise, please check this <a style="font-weight: 600;" href="https://wpbookingcalendar.com/faq/request-do-not-pass-security-check/?after_update=10.1.1">troubleshooting instruction</a>.<br>'
						}
					}
					var message_show_delay = 3000;
					if ( jqXHR.responseText ){
						error_message += ' ' + jqXHR.responseText;
						message_show_delay = 10;
					}
					error_message = error_message.replace( /\n/g, "<br />" );

					var jq_node  = wpbc_get_calendar__jq_node__for_messages( this.data );

					/**
					 * If we make fast clicking on different pages,
					 * then under calendar will show error message with  empty  text, because ajax was not received.
					 * To  not show such warnings we are set delay  in 3 seconds.  var message_show_delay = 3000;
					 */
					var closed_timer = setTimeout( function (){

																// Show Message
																wpbc_front_end__show_message( error_message , { 'type'     : 'error',
																												'show_here': {'jq_node': jq_node, 'where': 'after'},
																												'is_append': true,
																												'style'    : 'text-align:left;',
																												'css_class':'wpbc_fe_message_alt',
																												'delay'    : 0
																											} );
														   } ,
														   parseInt( message_show_delay )   );

			  })
	          // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
			  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
			  ;  // End Ajax
}



// ---------------------------------------------------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------------------------------------------------

	/**
	 * Get Calendar jQuery node for showing messages during Ajax
	 * This parameter:   calendar_request_params[resource_id]   parsed from this.data Ajax post  data
	 *
	 * @param ajx_post_data_url_params		 'action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params'
	 * @returns {string}	''#calendar_booking1'  |   '.booking_form_div' ...
	 *
	 * Example    var jq_node  = wpbc_get_calendar__jq_node__for_messages( this.data );
	 */
	function wpbc_get_calendar__jq_node__for_messages( ajx_post_data_url_params ){

		var jq_node = '.booking_form_div';

		var calendar_resource_id = wpbc_get_resource_id__from_ajx_post_data_url( ajx_post_data_url_params );

		if ( calendar_resource_id > 0 ){
			jq_node = '#calendar_booking' + calendar_resource_id;
		}

		return jq_node;
	}


	/**
	 * Get resource ID from ajx post data url   usually  from  this.data  =
	 * 'action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params'
	 *
	 * @param ajx_post_data_url_params		 'action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params'
	 * @returns {int}						 1 | 0  (if errror then  0)
	 *
	 * Example    var jq_node  = wpbc_get_calendar__jq_node__for_messages( this.data );
	 */
	function wpbc_get_resource_id__from_ajx_post_data_url( ajx_post_data_url_params ){

		// Get booking resource ID from Ajax Post Request  -> this.data = 'action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params'
		var calendar_resource_id = wpbc_get_uri_param_by_name( 'calendar_request_params[resource_id]', ajx_post_data_url_params );
		if ( (null !== calendar_resource_id) && ('' !== calendar_resource_id) ){
			calendar_resource_id = parseInt( calendar_resource_id );
			if ( calendar_resource_id > 0 ){
				return calendar_resource_id;
			}
		}
		return 0;
	}


	/**
	 * Get parameter from URL  -  parse URL parameters,  like this:
	 * action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params
	 * @param name  parameter  name,  like 'calendar_request_params[resource_id]'
	 * @param url	'parameter  string URL'
	 * @returns {string|null}   parameter value
	 *
	 * Example: 		wpbc_get_uri_param_by_name( 'calendar_request_params[resource_id]', this.data );  -> '2'
	 */
	function wpbc_get_uri_param_by_name( name, url ){

		url = decodeURIComponent( url );

		name = name.replace( /[\[\]]/g, '\\$&' );
		var regex = new RegExp( '[?&]' + name + '(=([^&#]*)|&|#|$)' ),
			results = regex.exec( url );
		if ( !results ) return null;
		if ( !results[ 2 ] ) return '';
		return decodeURIComponent( results[ 2 ].replace( /\+/g, ' ' ) );
	}

/**
 * =====================================================================================================================
 *	includes/__js/front_end_messages/wpbc_fe_messages.js
 * =====================================================================================================================
 */

// ---------------------------------------------------------------------------------------------------------------------
// Show Messages at Front-Edn side
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Show message in content
 *
 * @param message				Message HTML
 * @param params = {
 *								'type'     : 'warning',							// 'error' | 'warning' | 'info' | 'success'
 *								'show_here' : {
 *													'jq_node' : '',				// any jQuery node definition
 *													'where'   : 'inside'		// 'inside' | 'before' | 'after' | 'right' | 'left'
 *											  },
 *								'is_append': true,								// Apply  only if 	'where'   : 'inside'
 *								'style'    : 'text-align:left;',				// styles, if needed
 *							    'css_class': '',								// For example can  be: 'wpbc_fe_message_alt'
 *								'delay'    : 0,									// how many microsecond to  show,  if 0  then  show forever
 *								'if_visible_not_show': false					// if true,  then do not show message,  if previos message was not hided (not apply if 'where'   : 'inside' )
 *				};
 * Examples:
 * 			var html_id = wpbc_front_end__show_message( 'You can test days selection in calendar', {} );
 *
 *			var notice_message_id = wpbc_front_end__show_message( _wpbc.get_message( 'message_check_required' ), { 'type': 'warning', 'delay': 10000, 'if_visible_not_show': true,
 *																  'show_here': {'where': 'right', 'jq_node': el,} } );
 *
 *			wpbc_front_end__show_message( response_data[ 'ajx_data' ][ 'ajx_after_action_message' ].replace( /\n/g, "<br />" ),
 *											{   'type'     : ( 'undefined' !== typeof( response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ] ) )
 *															  ? response_data[ 'ajx_data' ][ 'ajx_after_action_message_status' ] : 'info',
 *												'show_here': {'jq_node': jq_node, 'where': 'after'},
 *												'css_class':'wpbc_fe_message_alt',
 *												'delay'    : 10000
 *											} );
 *
 *
 * @returns string  - HTML ID		or 0 if not showing during this time.
 */
function wpbc_front_end__show_message( message, params = {} ){

	var params_default = {
								'type'     : 'warning',							// 'error' | 'warning' | 'info' | 'success'
								'show_here' : {
													'jq_node' : '',				// any jQuery node definition
													'where'   : 'inside'		// 'inside' | 'before' | 'after' | 'right' | 'left'
											  },
								'is_append': true,								// Apply  only if 	'where'   : 'inside'
								'style'    : 'text-align:left;',				// styles, if needed
							    'css_class': '',								// For example can  be: 'wpbc_fe_message_alt'
								'delay'    : 0,									// how many microsecond to  show,  if 0  then  show forever
								'if_visible_not_show': false,					// if true,  then do not show message,  if previos message was not hided (not apply if 'where'   : 'inside' )
								'is_scroll': true,								// is scroll  to  this element
								'content_mode': 'html'							// 'html' for trusted legacy content | 'text' for editable/user content
						};
	for ( var p_key in params ){
		params_default[ p_key ] = params[ p_key ];
	}
	params = params_default;

	if ( 'text' === params[ 'content_mode' ] ) {
		message = jQuery( '<div>' ).text( null === message || 'undefined' === typeof message ? '' : String( message ) ).html().replace( /\n/g, '<br />' );
	}

    var unique_div_id = new Date();
    unique_div_id = 'wpbc_notice_' + unique_div_id.getTime();

	params['css_class'] += ' wpbc_fe_message';
	if ( params['type'] == 'error' ){
		params['css_class'] += ' wpbc_fe_message_error';
		message = '<i class="menu_icon icon-1x wpbc_icn_report_gmailerrorred"></i>' + message;
	}
	if ( params['type'] == 'warning' ){
		params['css_class'] += ' wpbc_fe_message_warning';
		message = '<i class="menu_icon icon-1x wpbc_icn_warning"></i>' + message;
	}
	if ( params['type'] == 'info' ){
		params['css_class'] += ' wpbc_fe_message_info';
	}
	if ( params['type'] == 'success' ){
		params['css_class'] += ' wpbc_fe_message_success';
		message = '<i class="menu_icon icon-1x wpbc_icn_done_outline"></i>' + message;
	}

	var scroll_to_element = '<div id="' + unique_div_id + '_scroll" style="display:none;"></div>';
	message = '<div id="' + unique_div_id + '" class="wpbc_front_end__message ' + params['css_class'] + '" style="' + params[ 'style' ] + '">' + message + '</div>';


	var jq_el_message = false;
	var is_show_message = true;

	if ( 'inside' === params[ 'show_here' ][ 'where' ] ){

		if ( params[ 'is_append' ] ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).append( scroll_to_element );
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).append( message );
		} else {
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).html( scroll_to_element + message );
		}

	} else if ( 'before' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).siblings( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( message );
		}

	} else if ( 'after' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).nextAll( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );		// We need to  set  here before(for handy scroll)
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).after( message );
		}

	} else if ( 'right' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).nextAll( '.wpbc_front_end__message_container_right' ).find( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );		// We need to  set  here before(for handy scroll)
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).after( '<div class="wpbc_front_end__message_container_right">' + message + '</div>' );
		}
	} else if ( 'left' === params[ 'show_here' ][ 'where' ] ){

		jq_el_message = jQuery( params[ 'show_here' ][ 'jq_node' ] ).siblings( '.wpbc_front_end__message_container_left' ).find( '[id^="wpbc_notice_"]' );
		if ( (params[ 'if_visible_not_show' ]) && (jq_el_message.is( ':visible' )) ){
			is_show_message = false;
			unique_div_id = jQuery( jq_el_message.get( 0 ) ).attr( 'id' );
		}
		if ( is_show_message ){
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( scroll_to_element );		// We need to  set  here before(for handy scroll)
			jQuery( params[ 'show_here' ][ 'jq_node' ] ).before( '<div class="wpbc_front_end__message_container_left">' + message + '</div>' );
		}
	}

	if (   ( is_show_message )  &&  ( parseInt( params[ 'delay' ] ) > 0 )   ){
		var closed_timer = setTimeout( function (){
													jQuery( '#' + unique_div_id ).fadeOut( 1500 );
										} , parseInt( params[ 'delay' ] )   );

		var closed_timer2 = setTimeout( function (){
														jQuery( '#' + unique_div_id ).trigger( 'hide' );
										}, ( parseInt( params[ 'delay' ] ) + 1501 ) );
	}

	// Check  if showed message in some hidden parent section and show it. But it must  be lower than '.wpbc_container'
	var parent_els = jQuery( '#' + unique_div_id ).parents().map( function (){
		if ( (!jQuery( this ).is( 'visible' )) && (jQuery( '.wpbc_container' ).has( this )) ){
			jQuery( this ).show();
		}
	} );

	if ( params[ 'is_scroll' ] ){
		wpbc_do_scroll( '#' + unique_div_id + '_scroll' );
	}

	return unique_div_id;
}


	/**
	 * Error message. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__error( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'right',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Error message UNDER element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__error_under_element( jq_node, message, message_delay, content_mode ){

		if ( 'undefined' === typeof (message_delay) ){
			message_delay = 0
		}
		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : message_delay,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'after',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Error message UNDER element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__error_above_element( jq_node, message, message_delay, content_mode ){

		if ( 'undefined' === typeof (message_delay) ){
			message_delay = 10000
		}
		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : message_delay,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'before',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Warning message. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__warning( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'right',
																							'jq_node': jq_node
																						   }
																}
														);
		wpbc_highlight_error_on_form_field( jq_node );
		return notice_message_id;
	}


	/**
	 * Warning message UNDER element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__warning_under_element( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'after',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}


	/**
	 * Warning message ABOVE element. 	Preset of parameters for real message function.
	 *
	 * @param el		- any jQuery node definition
	 * @param message	- Message HTML
	 * @returns string  - HTML ID		or 0 if not showing during this time.
	 */
	function wpbc_front_end__show_message__warning_above_element( jq_node, message, content_mode ){

		content_mode = ( 'undefined' === typeof content_mode ) ? 'html' : content_mode;

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																			'if_visible_not_show': true,
																			'content_mode'       : content_mode,
																	'show_here'          : {
																							'where'  : 'before',
																							'jq_node': jq_node
																						   }
																}
														);
		return notice_message_id;
	}

	/**
	 * Highlight Error in specific field
	 *
	 * @param jq_node					string or jQuery element,  where scroll  to
	 */
	function wpbc_highlight_error_on_form_field( jq_node ){

		if ( !jQuery( jq_node ).length ){
			return;
		}
		if ( ! jQuery( jq_node ).is( ':input' ) ){
			// Situation with  checkboxes or radio  buttons
			var jq_node_arr = jQuery( jq_node ).find( ':input' );
			if ( !jq_node_arr.length ){
				return
			}
			jq_node = jq_node_arr.get( 0 );
		}
		var params = {};
		params[ 'delay' ] = 10000;

		if ( !jQuery( jq_node ).hasClass( 'wpbc_form_field_error' ) ){

			jQuery( jq_node ).addClass( 'wpbc_form_field_error' )

			if ( parseInt( params[ 'delay' ] ) > 0 ){
				var closed_timer = setTimeout( function (){
															 jQuery( jq_node ).removeClass( 'wpbc_form_field_error' );
														  }
											   , parseInt( params[ 'delay' ] )
									);

			}
		}
	}

/**
 * Scroll to specific element
 *
 * @param jq_node					string or jQuery element,  where scroll  to
 * @param extra_shift_offset		int shift offset from  jq_node
 */
function wpbc_do_scroll( jq_node , extra_shift_offset = 0 ){

	if ( !jQuery( jq_node ).length ){
		return;
	}
	var targetOffset = jQuery( jq_node ).offset().top;

	if ( targetOffset <= 0 ){
		if ( 0 != jQuery( jq_node ).nextAll( ':visible' ).length ){
			targetOffset = jQuery( jq_node ).nextAll( ':visible' ).first().offset().top;
		} else if ( 0 != jQuery( jq_node ).parent().nextAll( ':visible' ).length ){
			targetOffset = jQuery( jq_node ).parent().nextAll( ':visible' ).first().offset().top;
		}
	}

	if ( jQuery( '#wpadminbar' ).length > 0 ){
		targetOffset = targetOffset - 50 - 50;
	} else {
		targetOffset = targetOffset - 20 - 50;
	}
	targetOffset += extra_shift_offset;

	// Scroll only  if we did not scroll before
	if ( ! jQuery( 'html,body' ).is( ':animated' ) ){
		jQuery( 'html,body' ).animate( {scrollTop: targetOffset}, 500 );
	}
}



// FixIn: 10.2.0.4.
/**
 * Define Popovers for Timelines in WP Booking Calendar
 *
 * @returns {string|boolean}
 */
function wpbc_define_tippy_popover(){
	if ( 'function' !== typeof (wpbc_tippy) ){
		console.log( 'WPBC Error. wpbc_tippy was not defined.' );
		return false;
	}
	wpbc_tippy( '.popover_bottom.popover_click', {
		content( reference ){
			var popover_title = reference.getAttribute( 'data-original-title' );
			var popover_content = reference.getAttribute( 'data-content' );
			return '<div class="popover popover_tippy">'
				+ '<div class="popover-close"><a href="javascript:void(0)" onclick="javascript:this.parentElement.parentElement.parentElement.parentElement.parentElement._tippy.hide();" >&times;</a></div>'
				+ popover_content
				+ '</div>';
		},
		allowHTML        : true,
		trigger          : 'manual',
		interactive      : true,
		hideOnClick      : false,
		interactiveBorder: 10,
		maxWidth         : 550,
		theme            : 'wpbc-tippy-popover',
		placement        : 'bottom-start',
		touch            : ['hold', 500],
	} );
	jQuery( '.popover_bottom.popover_click' ).on( 'click', function (){
		if ( this._tippy.state.isVisible ){
			this._tippy.hide();
		} else {
			this._tippy.show();
		}
	} );
	wpbc_define_hide_tippy_on_scroll();
}



function wpbc_define_hide_tippy_on_scroll(){
	jQuery( '.flex_tl__scrolling_section2,.flex_tl__scrolling_sections' ).on( 'scroll', function ( event ){
		if ( 'function' === typeof (wpbc_tippy) ){
			wpbc_tippy.hideAll();
		}
	} );
}

/**
 * WPBC calendar loader bootstrap.
 * ==============================================================================================
 * - Finds every .calendar_loader_frame[data-wpbc-rid] on the page (now or later).
 * - For each loader element, waits a "grace" period (data-wpbc-grace, default 8000 ms):
 *     - If the real calendar appears: do nothing (loader naturally replaced).
 *     - If not: show a helpful message (missing jQuery/_wpbc/datepick) or a duplicate notice.
 * - Works with multiple calendars and even duplicate RIDs on the same page.
 * - No inline JS needed in the shortcode/template output.
 *
 * File:  ../includes/__js/client/cal/wpbc_cal_loader.js
 *
 * @since    10.14.5
 * @modified 2025-09-07 12:21
 * @version  1.0.0
 *
 */
/**
 * WPBC calendar loader bootstrap.
 * - Auto-detects .calendar_loader_frame[data-wpbc-rid] blocks.
 * - Waits a "grace" period per element before showing a helpful message
 *   if the real calendar hasn't replaced the loader.
 * - Multiple calendars and duplicate RIDs are handled.
 */
(function (w, d) {
	'use strict';

	/* ---------------------------------------------------------------------------
	 * Small utilities (snake_case)
	 * ------------------------------------------------------------------------ */

	/** Track processed loader elements; fallback to data flag if WeakSet missing. */
	var processed_set = typeof WeakSet === 'function' ? new WeakSet() : null;

	/** Return first match inside optional root. */
	function query_one(selector, root) {
		return (root || d).querySelector( selector );
	}

	/** Return NodeList of matches inside optional root. */
	function query_all(selector, root) {
		return (root || d).querySelectorAll( selector );
	}

	/** Run a callback when DOM is ready. */
	function on_ready(fn) {
		if ( d.readyState === 'loading' ) {
			d.addEventListener( 'DOMContentLoaded', fn );
		} else {
			fn();
		}
	}

	/** Clear interval safely. */
	function safe_clear(interval_id) {
		try {
			w.clearInterval( interval_id );
		} catch ( e ) {
		}
	}

	/** Mark element processed (WeakSet or data attribute). */
	function mark_processed(el) {
		if ( processed_set ) {
			processed_set.add( el );
		} else {
			try {
				el.dataset.wpbcProcessed = '1';
			} catch ( e ) {
			}
		}
	}

	/** Check if element was processed. */
	function is_processed(el) {
		return processed_set ? processed_set.has( el ) : (el && el.dataset && el.dataset.wpbcProcessed === '1');
	}

	/* ---------------------------------------------------------------------------
	 * Messages (fixed English strings; no i18n)
	 * ------------------------------------------------------------------------ */

	/**
	 * Build fixed English messages for a resource.
	 * @param {string|number} rid
	 * @return {{duplicate:string,support:string,lib_jq:string,lib_dp:string,lib_wpbc:string}}
	 */
	function get_messages(rid) {
		var rid_int = parseInt( rid, 10 );
		return {
			duplicate  :
				'You have added the same calendar (ID = ' + rid_int + ') more than once on this page. ' +
				'Please keep only one calendar with the same ID on a page to avoid conflicts.',
			init_failed:
				'The calendar could not be initialized on this page.' + '\n' +
				'Please check your browser console for JavaScript errors and conflicts with other scripts/plugins.',
			support    : '', /* 'Contact support@wpbookingcalendar.com if you have any questions.', */
			lib_jq     :
				'It appears that the "jQuery" library is not loading correctly.' + '\n' +
				'For more information, please refer to this page: https://wpbookingcalendar.com/faq/',
			lib_dp     :
				'It appears that the "jQuery.datepick" library is not loading correctly.' + '\n' +
				'For more information, please refer to this page: https://wpbookingcalendar.com/faq/',
			lib_wpbc   :
				'It appears that the "_wpbc" library is not loading correctly.' + '\n' +
				'Please enable the loading of JS/CSS files for this page on the "WP Booking Calendar" - "Settings General" - "Advanced" page' + '\n' +
				'For more information, please refer to this page: https://wpbookingcalendar.com/faq/'
		};
	}

	/**
	 * Wrap plain text (with newlines) in a small HTML container.
	 * @param {string} msg
	 * @return {string}
	 */
	function wrap_html(msg) {
		return '<div style="font-size:13px;margin:10px;">' + String( msg || '' ).replace( /\n/g, '<br>' ) + '</div>';
	}

	/** Library presence checks (fast & cheap). */
	function has_jq() {
		return !!(w.jQuery && jQuery.fn && typeof jQuery.fn.on === 'function');
	}

	function has_dp() {
		return !!(w.jQuery && jQuery.datepick);
	}

	function has_wpbc() {
		return !!(w._wpbc && typeof w._wpbc.set_other_param === 'function');
	}

	function normalize_rid(rid) {
		var n = parseInt( rid, 10 );
		return (n > 0) ? String( n ) : '';
	}

	function get_rid_counts(rid) {
		var r = normalize_rid( rid );
		return {
			rid       : r,
			loaders   : r ? query_all( '.calendar_loader_frame[data-wpbc-rid="' + r + '"]' ).length : 0,
			containers: r ? query_all( '#calendar_booking' + r ).length : 0
		};
	}

	function is_duplicate_rid(rid) {
		var c = get_rid_counts( rid );
		return (c.loaders > 1) || (c.containers > 1);
	}

	/**
	 * Determine if the loader has been replaced by the real calendar.
	 *
	 * @param {Element} el       Loader element
	 * @param {string} rid       Resource ID
	 * @param {Element|null} container Optional #calendar_booking{rid} element
	 * @return {boolean}
	 */
	function is_replaced(el, rid, container) {
		var loader_still_in_dom = d.body.contains( el );
		var calendar_exists     = !!query_one( '.wpbc_calendar_id_' + rid, container || d );
		return (!loader_still_in_dom) || calendar_exists;
	}

	/**
	 * Start watcher for a single loader element.
	 * - Polls and observes the calendar container.
	 * - After grace, injects a suitable message if not replaced.
	 *
	 * @param {Element} el
	 */
	function start_for(el) {
		if ( ! el || is_processed( el ) ) {
			return;
		}
		mark_processed( el );

		var rid = el.dataset.wpbcRid;
		if ( ! rid ) {
			return;
		}

		var grace_ms = parseInt( el.dataset.wpbcGrace || '8000', 10 );
		if ( ! (grace_ms > 0) ) {
			grace_ms = 8000;
		}

		var container_id = 'calendar_booking' + rid;
		var container    = d.getElementById( container_id );
		var text_el      = query_one( '.calendar_loader_text', el );

		function replaced_now() {
			return is_replaced( el, rid, container );
		}

		// Already replaced -> nothing to do.
		if ( replaced_now() ) {
			return;
		}

		// 1) Cheap polling.
		var poll_id = w.setInterval( function () {
			if ( replaced_now() ) {
				safe_clear( poll_id );
				if ( observer ) {
					try {
						observer.disconnect();
					} catch ( e ) {
					}
				}
			}
		}, 250 );

		// 2) MutationObserver for faster reaction.
		var observer = null;
		if ( container && 'MutationObserver' in w ) {
			try {
				observer = new MutationObserver( function () {
					if ( replaced_now() ) {
						safe_clear( poll_id );
						try {
							observer.disconnect();
						} catch ( e ) {
						}
					}
				} );
				observer.observe( container, { childList: true, subtree: true } );
			} catch ( e ) {
			}
		}

		// 3) Final decision after grace period.
		w.setTimeout( function finalize_after_grace() {
			if ( replaced_now() ) {
				safe_clear( poll_id );
				if ( observer ) {
					try {
						observer.disconnect();
					} catch ( e ) {
					}
				}
				return;
			}

			var M = get_messages( rid );
			var msg;
			if ( ! has_jq() ) {
				msg = M.lib_jq;
			} else if ( ! has_wpbc() ) {
				msg = M.lib_wpbc;
			} else if ( ! has_dp() ) {
				msg = M.lib_dp;
			} else {
				// Libraries are present, but loader wasn't replaced -> decide what is most likely.
				if ( is_duplicate_rid( rid ) ) {
					msg = M.duplicate + '\n\n' + M.support;
				} else {
					msg = M.init_failed + '\n\n' + M.support;
				}
			}

			try {
				if ( text_el ) {
					text_el.innerHTML = wrap_html( msg );
				}
			} catch ( e ) {
			}

			safe_clear( poll_id );
			if ( observer ) {
				try {
					observer.disconnect();
				} catch ( e ) {
				}
			}
		}, grace_ms );
	}

	/**
	 * Initialize watchers for loader elements already in the DOM.
	 */
	function bootstrap_existing() {
		query_all( '.calendar_loader_frame[data-wpbc-rid]' ).forEach( start_for );
	}

	/**
	 * Observe the document for any new loader elements inserted later (AJAX, block render).
	 */
	function observe_new_loaders() {
		if ( ! ('MutationObserver' in w) ) {
			return;
		}
		try {
			var doc_observer = new MutationObserver( function (mutations) {
				for ( var i = 0; i < mutations.length; i++ ) {
					var nodes = mutations[i].addedNodes || [];
					for ( var j = 0; j < nodes.length; j++ ) {
						var node = nodes[j];
						if ( ! node || node.nodeType !== 1 ) {
							continue;
						}
						if ( node.matches && node.matches( '.calendar_loader_frame[data-wpbc-rid]' ) ) {
							start_for( node );
						}
						if ( node.querySelectorAll ) {
							var inner = node.querySelectorAll( '.calendar_loader_frame[data-wpbc-rid]' );
							if ( inner && inner.length ) {
								inner.forEach( start_for );
							}
						}
					}
				}
			} );
			doc_observer.observe( d.documentElement, { childList: true, subtree: true } );
		} catch ( e ) {
		}
	}

	/* ---------------------------------------------------------------------------
	 * Boot
	 * ------------------------------------------------------------------------ */
	on_ready( function () {
		bootstrap_existing();
		observe_new_loaders();
	} );

})( window, document );

(function( w ) {

	'use strict';

	if ( ! w.WPBC_FE ) {
		w.WPBC_FE = {};
	}

	/**
	 * Auto-fill booking form fields (text/email) based on input "name" patterns.
	 *
	 * Form ID format: booking_form{resource_id}
	 * Skips date field: date_booking{resource_id}
	 *
	 * @param {number} resource_id Booking resource ID.
	 * @param {Object} fill_values Values to inject (strings).
	 *
	 * @return {boolean} True if form found and processed, false otherwise.
	 */
	w.WPBC_FE.autofill_booking_form_fields = function( resource_id, fill_values ) {

		resource_id  = parseInt( resource_id, 10 ) || 0;
		fill_values  = fill_values || {};

		var form_id   = 'booking_form' + resource_id;
		var date_name = 'date_booking' + resource_id;

		var submit_form = document.getElementById( form_id );

		if ( ! submit_form ) {
			/* eslint-disable no-console */
			console.error( 'WPBC: No booking form: ' + form_id );
			/* eslint-enable no-console */
			return false;
		}

		// Keep same regex rules and priority order as legacy inline JS.
		var rules = array_rules( fill_values );

		var elements = submit_form.elements || [];
		var count    = elements.length;
		var el;
		var i;
		var j;

		for ( i = 0; i < count; i++ ) {

			el = elements[ i ];

			if ( ! el || ! el.name ) {
				continue;
			}

			// Only text/email inputs.
			if ( ( el.type !== 'text' ) && ( el.type !== 'email' ) ) {
				continue;
			}

			// Skip date field.
			if ( el.name === date_name ) {
				continue;
			}

			// Fill only empty values (legacy behavior: == "").
			if ( el.value !== '' ) {
				continue;
			}

			for ( j = 0; j < rules.length; j++ ) {

				if ( rules[ j ].re.test( el.name ) ) {

					if ( rules[ j ].val !== '' ) {
						el.value = rules[ j ].val;
					}

					break; // Stop at first matching rule (priority).
				}
			}
		}

		return true;
	};

	/**
	 * Build rules array for autofill.
	 *
	 * @param {Object} fill_values Values to inject.
	 *
	 * @return {Array} Rules list.
	 */
	function array_rules( fill_values ) {

		// Normalize to strings (prevent "undefined" in fields).
		var nickname  = ( fill_values.nickname != null ) ? String( fill_values.nickname ) : '';
		var last_name = ( fill_values.last_name != null ) ? String( fill_values.last_name ) : '';
		var first_name = ( fill_values.first_name != null ) ? String( fill_values.first_name ) : '';
		var email     = ( fill_values.email != null ) ? String( fill_values.email ) : '';
		var phone     = ( fill_values.phone != null ) ? String( fill_values.phone ) : '';
		var nb_enfant = ( fill_values.nb_enfant != null ) ? String( fill_values.nb_enfant ) : '';
		var url       = ( fill_values.url != null ) ? String( fill_values.url ) : '';

		return [
			{ re: /^([A-Za-z0-9_\-\.])*(nickname){1}([A-Za-z0-9_\-\.])*$/, val: nickname },
			{ re: /^([A-Za-z0-9_\-\.])*(last|second){1}([_\-\.])?name([A-Za-z0-9_\-\.])*$/, val: last_name },
			{ re: /^name([0-9_\-\.])*$/, val: first_name },
			{ re: /^([A-Za-z0-9_\-\.])*(first|my){1}([_\-\.])?name([A-Za-z0-9_\-\.])*$/, val: first_name },
			{ re: /^(e)?([_\-\.])?mail([0-9_\-\.]*)$/, val: email },
			{ re: /^([A-Za-z0-9_\-\.])*(phone|fone){1}([A-Za-z0-9_\-\.])*$/, val: phone },
			{ re: /^(e)?([_\-\.])?nb_enfant([0-9_\-\.]*)$/, val: nb_enfant },
			{ re: /^([A-Za-z0-9_\-\.])*(URL|site|web|WEB){1}([A-Za-z0-9_\-\.])*$/, val: url }
		];
	}

})( window );

// == Submit Booking Data ==============================================================================================
// Refactored (safe), with new wpbc_* names.
// Backward-compatible wrappers for legacy function names are included at the bottom.
// @file: includes/__js/client/front_end_form/booking_form_submit.js

/**
 * Check fields at form and then send request (legacy: mybooking_submit).
 *
 * @param {HTMLFormElement} submit_form
 * @param {number|string}   resource_id
 * @param {string}          wpdev_active_locale
 *
 * @return {false|undefined} Legacy behavior: returns false in some cases, otherwise undefined.
 */
function wpbc_booking_form_submit( submit_form, resource_id, wpdev_active_locale ) {

	resource_id = parseInt( resource_id, 10 );

	// Safety guard (legacy code assumed valid form).
	if ( ! submit_form || ! submit_form.elements ) {
		/* eslint-disable no-console */
		console.error( 'WPBC: Invalid submit form in wpbc_booking_form_submit().' );
		/* eslint-enable no-console */
		return false;
	}

	// -------------------------------------------------------------------------
	// External hook: allow pause submit on confirmation/summary step.
	// -------------------------------------------------------------------------
	var target_elm = jQuery( '.booking_form_div' ).trigger( 'booking_form_submit_click', [ resource_id, submit_form, wpdev_active_locale ] ); // FixIn: 8.8.3.13.

	if (
		( jQuery( target_elm ).find( 'input[name="booking_form_show_summary"]' ).length > 0 ) &&
		( 'pause_submit' === jQuery( target_elm ).find( 'input[name="booking_form_show_summary"]' ).val() )
	) {
		return false;
	}

	// FixIn: 8.4.0.2.
	var is_error = wpbc_check_errors_in_booking_form( resource_id );
	if ( is_error ) {
		return false;
	}

	// -------------------------------------------------------------------------
	// Show message if no selected days in Calendar(s).
	// -------------------------------------------------------------------------
	var date_input = document.getElementById( 'date_booking' + resource_id );
	var date_value = ( date_input ) ? date_input.value : '';

	if ( '' === date_value ) {

		var arr_of_selected_additional_calendars = wpbc_get_arr_of_selected_additional_calendars( resource_id ); // FixIn: 8.5.2.26.

		if ( ! arr_of_selected_additional_calendars || ( arr_of_selected_additional_calendars.length === 0 ) ) {
			wpbc_front_end__show_message__warning(
				'#booking_form_div' + resource_id + ' .bk_calendar_frame',
				_wpbc.get_message( 'message_check_no_selected_dates' ),
				'text'
			);
			return;
		}
	}

	// -------------------------------------------------------------------------
	// FixIn: 6.1.1.3. Time selection availability checks.
	// -------------------------------------------------------------------------
	if ( typeof wpbc_is_this_time_selection_not_available === 'function' ) {

		if ( '' === date_value ) { // Primary calendar not selected.

			var additional_calendars_el = document.getElementById( 'additional_calendars' + resource_id );

			if ( additional_calendars_el !== null ) { // Checking additional calendars.

				var id_additional_str = additional_calendars_el.value;
				var id_additional_arr = id_additional_str.split( ',' );
				var is_times_dates_ok = false;

				for ( var ia = 0; ia < id_additional_arr.length; ia++ ) {

					var add_id = id_additional_arr[ ia ];

					var add_date_el = document.getElementById( 'date_booking' + add_id );
					var add_date_val = ( add_date_el ) ? add_date_el.value : '';

					if (
						( '' !== add_date_val ) &&
						( ! wpbc_is_this_time_selection_not_available( add_id, submit_form.elements ) )
					) {
						is_times_dates_ok = true;
					}
				}

				if ( ! is_times_dates_ok ) {
					return;
				}
			}

		} else { // Primary calendar selected.

			if ( wpbc_is_this_time_selection_not_available( resource_id, submit_form.elements ) ) {
				return;
			}
		}
	}

	// -------------------------------------------------------------------------
	// Serialize form (legacy format).
	// -------------------------------------------------------------------------
	var count    = submit_form.elements.length;
	var formdata = '';
	var inp_value;
	var inp_title_value;
	var element;
	var el_type;

	// Helper: legacy escaping for the serialized value.
	function wpbc_escape_serialized_value( val ) {

		val = ( val == null ) ? '' : String( val );

		// Replace registered characters.
		val = val.replace( new RegExp( '\\^', 'g' ), '&#94;' );
		val = val.replace( new RegExp( '~', 'g' ), '&#126;' );

		// Replace quotes.
		val = val.replace( /"/g, '&#34;' );
		val = val.replace( /'/g, '&#39;' );

		return val;
	}

	// Helper: determine UI type for title extraction (legacy logic).
	function wpbc_get_input_element_type( el ) {

		if ( ! el || ! el.tagName ) {
			return '';
		}

		var tag = String( el.tagName ).toLowerCase();

		if ( 'input' === tag ) {
			return ( el.type ) ? String( el.type ).toLowerCase() : 'text';
		}

		// Legacy used "select" string here.
		if ( 'select' === tag ) {
			return 'select';
		}

		return tag;
	}

	for ( var i = 0; i < count; i++ ) { // FixIn: 9.1.5.1.

		element = submit_form.elements[ i ];

		if ( ! element ) {
			continue;
		}

		if ( jQuery( element ).closest( '.booking_form_garbage' ).length ) {
			continue; // Skip elements from garbage. FixIn: 7.1.2.14.
		}

		if ( '1' === String( jQuery( element ).attr( 'data-wpbc-booking-submit-ignore' ) || '' ) ) {
			continue;
		}

		if (
			( element.type !== 'button' ) &&
			( element.type !== 'hidden' ) &&
			( element.name !== ( 'date_booking' + resource_id ) )
			// && ( jQuery( element ).is( ':visible' ) ) //FixIn: 7.2.1.12.2
		) {

			// -------------------------------------------------------------
			// Get element value.
			// -------------------------------------------------------------
			if ( element.type === 'checkbox' ) {

				if ( element.value === '' ) {
					inp_value = element.checked;
				} else {
					inp_value = ( element.checked ) ? element.value : '';
				}

			} else if ( element.type === 'radio' ) {

				if ( element.checked ) {
					inp_value = element.value;
				} else {

					// Required radio: show warning if none checked.
					// FixIn: 7.0.1.62.
					if (
						( element.className.indexOf( 'wpdev-validates-as-required' ) !== -1 ) &&
						( jQuery( element ).is( ':visible' ) ) && // FixIn: 7.2.1.12.2.
						( ! jQuery( ':radio[name="' + element.name + '"]', submit_form ).is( ':checked' ) )
					) {
						wpbc_front_end__show_message__warning( element, _wpbc.get_message( 'message_check_required_for_radio_box' ), 'text' ); // FixIn: 8.5.1.3.
						return;
					}

					// Skip storing empty radio options.
					continue;
				}

			} else {
				inp_value = element.value;
			}

			inp_title_value = '';

			// -------------------------------------------------------------
			// Get human-friendly title value (legacy behavior).
			// -------------------------------------------------------------
			var input_element_type = wpbc_get_input_element_type( element );

			switch ( input_element_type ) {

				case 'text':
				case 'email':
					inp_title_value = inp_value;
					break;

				case 'select':
					inp_title_value = jQuery( element ).find( 'option:selected' ).text();
					break;

				case 'radio':
				case 'checkbox':
					if ( jQuery( element ).is( ':checked' ) ) {
						var label_element = jQuery( element ).parents( '.wpdev-list-item' ).find( '.wpdev-list-item-label' );
						if ( label_element.length ) {
							inp_title_value = label_element.html();
						}
					}
					break;

				default:
					inp_title_value = inp_value;
			}

			// -------------------------------------------------------------
			// Multiple select value extraction.
			// -------------------------------------------------------------
			if ( ( element.type === 'selectbox-multiple' ) || ( element.type === 'select-multiple' ) ) {
				inp_value = jQuery( '[name="' + element.name + '"]' ).val();
				if ( ( inp_value === null ) || ( String( inp_value ) === '' ) ) {
					inp_value = '';
				}
			}

			// -------------------------------------------------------------
			// Make validation only for visible elements.
			// -------------------------------------------------------------
			if ( jQuery( element ).is( ':visible' ) ) { // FixIn: 7.2.1.12.2.

				// Recheck max available visitors selection.
				if ( typeof wpbc__is_less_than_required__of_max_available_slots__bl === 'function' ) {
					if ( wpbc__is_less_than_required__of_max_available_slots__bl( resource_id, element ) ) {
						return;
					}
				}

				// Required fields.
				if ( element.className.indexOf( 'wpdev-validates-as-required' ) !== -1 ) {

					if ( ( element.type === 'checkbox' ) && ( element.checked === false ) ) {

						if ( ! jQuery( ':checkbox[name="' + element.name + '"]', submit_form ).is( ':checked' ) ) {
							wpbc_front_end__show_message__warning( element, _wpbc.get_message( 'message_check_required_for_check_box' ), 'text' ); // FixIn: 8.5.1.3.
							return;
						}
					}

					if ( element.type === 'radio' ) {

						if ( ! jQuery( ':radio[name="' + element.name + '"]', submit_form ).is( ':checked' ) ) {
							wpbc_front_end__show_message__warning( element, _wpbc.get_message( 'message_check_required_for_radio_box' ), 'text' ); // FixIn: 8.5.1.3.
							return;
						}
					}

					if ( ( element.type !== 'checkbox' ) && ( element.type !== 'radio' ) && ( '' === wpbc_trim( inp_value ) ) ) {
						wpbc_front_end__show_message__warning( element, _wpbc.get_message( 'message_check_required' ), 'text' ); // FixIn: 8.5.1.3.
						return;
					}
				}

				// Email format validation.
				if ( element.className.indexOf( 'wpdev-validates-as-email' ) !== -1 ) {

					inp_value = String( inp_value ).replace( /^\s+|\s+$/gm, '' ); // Trim white space. FixIn: 5.4.5.
					var reg_email = /^([A-Za-z0-9_\-\.\+])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,})$/;

					if ( inp_value !== '' ) {
						if ( reg_email.test( inp_value ) === false ) {
							wpbc_front_end__show_message__warning( element, _wpbc.get_message( 'message_check_email' ), 'text' ); // FixIn: 8.5.1.3.
							return;
						}
					}
				}

				// Same email field validation (verification field).
				if ( ( element.className.indexOf( 'wpdev-validates-as-email' ) !== -1 ) && ( element.className.indexOf( 'same_as_' ) !== -1 ) ) {

					var primary_email_name = element.className.match( /same_as_([^\s])+/gi );

					if ( primary_email_name !== null ) {

						primary_email_name = primary_email_name[ 0 ].substr( 8 );

						if ( jQuery( '[name="' + primary_email_name + resource_id + '"]' ).length > 0 ) {

							if ( jQuery( '[name="' + primary_email_name + resource_id + '"]' ).val() !== inp_value ) {
								wpbc_front_end__show_message__warning( element, _wpbc.get_message( 'message_check_same_email' ), 'text' ); // FixIn: 8.5.1.3.
								return;
							}
						}
					}

					// Skip one loop for the email verification field.
					continue; // FixIn: 8.1.2.15.
				}
			}

			// -------------------------------------------------------------
			// Get Form Data (legacy format).
			// -------------------------------------------------------------
			if ( element.name !== ( 'captcha_input' + resource_id ) ) {

				if ( formdata !== '' ) {
					formdata += '~';
				}

				el_type = element.type;

				if ( element.className.indexOf( 'wpdev-validates-as-email' ) !== -1 ) {
					el_type = 'email';
				}
				if ( element.className.indexOf( 'wpdev-validates-as-coupon' ) !== -1 ) {
					el_type = 'coupon';
				}

				inp_value = wpbc_escape_serialized_value( inp_value );

				if ( el_type === 'select-one' ) {
					el_type = 'selectbox-one';
				}
				if ( el_type === 'select-multiple' ) {
					el_type = 'selectbox-multiple';
				}

				formdata += el_type + '^' + element.name + '^' + inp_value;

				// Add title/label value (legacy).
				var clean_field_name = String( element.name );

				// BUGFIX: replaceAll(RegExp) is not supported in older browsers.
				// Keep legacy intent: remove [] suffix occurrences.
				clean_field_name = clean_field_name.replace( /\[\]/gi, '' );

				var resource_id_str = String( resource_id );

				// Legacy assumed suffix ends with resource_id, make it safe.
				if (
					( clean_field_name.length >= resource_id_str.length ) &&
					( clean_field_name.substr( clean_field_name.length - resource_id_str.length ) === resource_id_str )
				) {
					clean_field_name = clean_field_name.substr( 0, clean_field_name.length - resource_id_str.length );
				}

				formdata += '~' + el_type + '^' + clean_field_name + '_val' + resource_id + '^' + inp_title_value;
			}
		}
	}

	// TODO: here was function for 'Check if visitor finish dates selection.

	// Captcha verify.
	var captcha = document.getElementById( 'wpdev_captcha_challenge_' + resource_id );

	if ( captcha !== null ) {
		wpbc_form_submit_send( resource_id, formdata, captcha.value, document.getElementById( 'captcha_input' + resource_id ).value, wpdev_active_locale );
	} else {
		wpbc_form_submit_send( resource_id, formdata, '', '', wpdev_active_locale );
	}

	return;
}


/**
 * Gathering params for sending Ajax request and then send it (legacy: form_submit_send).
 *
 * @param {number|string} resource_id
 * @param {string}        formdata
 * @param {string}        captcha_chalange
 * @param {string}        user_captcha
 * @param {string}        wpdev_active_locale
 *
 * @return {undefined} Legacy behavior.
 */
function wpbc_form_submit_send( resource_id, formdata, captcha_chalange, user_captcha, wpdev_active_locale ) {

	resource_id = parseInt( resource_id, 10 );

	var my_booking_form = '';
	var booking_form_type_el = document.getElementById( 'booking_form_type' + resource_id );
	if ( booking_form_type_el !== null ) {
		my_booking_form = booking_form_type_el.value;
	}

	var my_booking_hash = '';
	if ( _wpbc.get_other_param( 'this_page_booking_hash' ) !== '' ) {
		my_booking_hash = _wpbc.get_other_param( 'this_page_booking_hash' );
	}

	var is_send_emeils = 1;
	var $is_send_email_toggle = jQuery( '#is_send_email_for_pending' );
	var $modal_send_email_toggle = jQuery( '#booking_form' + resource_id ).closest( '.wpbc_modal__add_booking__section' ).find( '[data-wpbc-add-booking-send-emails]' ).first();
	if ( $modal_send_email_toggle.length ) {
		$is_send_email_toggle = $modal_send_email_toggle;
	}
	if ( $is_send_email_toggle.length ) { // FixIn: 8.7.9.5.

		is_send_emeils = $is_send_email_toggle.is( ':checked' );

		if ( false === is_send_emeils ) {
			is_send_emeils = 0;
		} else {
			is_send_emeils = 1;
		}
	}

	var date_el = document.getElementById( 'date_booking' + resource_id );
	var date_value = ( date_el ) ? date_el.value : '';

	if ( '' !== date_value ) { // FixIn: 6.1.1.3.
		wpbc_send_ajax_submit( resource_id, formdata, captcha_chalange, user_captcha, is_send_emeils, my_booking_hash, my_booking_form, wpdev_active_locale );
	} else {
		jQuery( '#booking_form_div' + resource_id ).hide();
		jQuery( '#submiting' + resource_id ).hide();
	}

	// -------------------------------------------------------------------------
	// Additional calendars submit.
	// -------------------------------------------------------------------------
	var additional_calendars_el = document.getElementById( 'additional_calendars' + resource_id );
	if ( additional_calendars_el === null ) {
		return;
	}

	var id_additional_str = additional_calendars_el.value;
	var id_additional_arr = id_additional_str.split( ',' );

	// FixIn: 10.9.4.1.
	for ( var ia = 0; ia < id_additional_arr.length; ia++ ) {
		id_additional_arr[ ia ] = parseInt( id_additional_arr[ ia ], 10 );
	}

	if ( ! jQuery( '#booking_form_div' + resource_id ).is( ':visible' ) ) {
		wpbc_booking_form__spin_loader__show( resource_id ); // Show Spinner
	}

	// Helper: rewrite field name suffix from resource_id -> id_additional.
	function wpbc_rewrite_field_name_suffix( field_name, old_id, new_id ) {

		field_name = String( field_name );

		var old_id_str = String( old_id );
		var new_id_str = String( new_id );

		// Handle fields with [].
		if (
			( field_name.length >= ( old_id_str.length + 2 ) ) &&
			( field_name.substr( field_name.length - ( old_id_str.length + 2 ) ) === ( old_id_str + '[]' ) )
		) {
			return field_name.substr( 0, field_name.length - ( old_id_str.length + 2 ) ) + new_id_str + '[]';
		}

		// Handle fields without [].
		if (
			( field_name.length >= old_id_str.length ) &&
			( field_name.substr( field_name.length - old_id_str.length ) === old_id_str )
		) {
			return field_name.substr( 0, field_name.length - old_id_str.length ) + new_id_str;
		}

		// Fallback: return unchanged (safer than breaking name).
		return field_name;
	}

	for ( ia = 0; ia < id_additional_arr.length; ia++ ) {

		var id_additional = id_additional_arr[ ia ];

		// FixIn: 10.9.4.1.
		if ( id_additional <= 0 ) {
			continue;
		}

		// Rebuild formdata for each additional calendar (legacy behavior).
		var formdata_additional_arr = String( formdata ).split( '~' );
		var formdata_additional = '';

		for ( var j = 0; j < formdata_additional_arr.length; j++ ) {

			var my_form_field = formdata_additional_arr[ j ].split( '^' );

			if ( formdata_additional !== '' ) {
				formdata_additional += '~';
			}

			// Safety: ensure we have at least type ^ name ^ value.
			if ( my_form_field.length < 3 ) {
				formdata_additional += formdata_additional_arr[ j ];
				continue;
			}

			my_form_field[ 1 ] = wpbc_rewrite_field_name_suffix( my_form_field[ 1 ], resource_id, id_additional );
			formdata_additional += my_form_field[ 0 ] + '^' + my_form_field[ 1 ] + '^' + my_form_field[ 2 ];
		}

		// If payment form for main booking resource is showing, append for additional calendars.
		if ( jQuery( '#gateway_payment_forms' + resource_id ).length > 0 ) {
			jQuery( '#gateway_payment_forms' + resource_id ).after( '<div id="gateway_payment_forms' + id_additional + '"></div>' );
			jQuery( '#gateway_payment_forms' + resource_id ).after( '<div id="ajax_respond_insert' + id_additional + '" style="display:none;"></div>' );
		}

		// FixIn: 8.5.2.17.
		wpbc_send_ajax_submit( id_additional, formdata_additional, captcha_chalange, user_captcha, is_send_emeils, my_booking_hash, my_booking_form, wpdev_active_locale );
	}
}


/**
 * Send Ajax submit (legacy: send_ajax_submit).
 *
 * @param {number|string} resource_id
 * @param {string}        formdata
 * @param {string}        captcha_chalange
 * @param {string}        user_captcha
 * @param {number}        is_send_emeils
 * @param {string}        my_booking_hash
 * @param {string}        my_booking_form
 * @param {string}        wpdev_active_locale
 *
 * @return {undefined} Legacy behavior.
 */
function wpbc_send_ajax_submit(resource_id, formdata, captcha_chalange, user_captcha, is_send_emeils, my_booking_hash, my_booking_form, wpdev_active_locale) {

	resource_id = parseInt( resource_id, 10 );

	// Disable Submit | Show spin loader.
	wpbc_booking_form__on_submit__ui_elements_disable( resource_id );

	// FixIn: 2026-02-05 - pass preview context to booking create Ajax.
	var form_status  = wpbc__get_form_status_for_submit( resource_id );
	var preview_args = (form_status === 'preview') ? wpbc__get_bfb_preview_args_from_location() : null;
	var $add_booking_modal = jQuery( '#booking_form' + resource_id ).closest( '#wpbc_modal__add_booking__section' );
	var is_allow_past = 0;
	var has_add_booking_modal_context = ( $add_booking_modal.length && $add_booking_modal.is( ':visible' ) );

	if ( has_add_booking_modal_context ) {
		is_allow_past = $add_booking_modal.find( '[data-wpbc-add-booking-allow-past]' ).first().is( ':checked' ) ? 1 : 0;
		if ( ! is_allow_past ) {
			is_allow_past = ( '1' === String( $add_booking_modal.attr( 'data-wpbc-add-booking-allow-past' ) || '0' ) ) ? 1 : 0;
		}
	}
	if ( ! has_add_booking_modal_context && ( 'undefined' !== typeof _wpbc ) ) {
		is_allow_past = ( '1' === String( _wpbc.get_other_param( 'this_page_allow_past' ) || '0' ) ) ? 1 : 0;
	}

	var request_params = {
		'resource_id'              : resource_id,
		'dates_ddmmyy_csv'         : document.getElementById( 'date_booking' + resource_id ).value,
		'formdata'                 : formdata,
		'booking_hash'             : my_booking_hash,
		'custom_form'              : my_booking_form,
		'aggregate_resource_id_arr': ( ( null !== _wpbc.booking__get_param_value( resource_id, 'aggregate_resource_id_arr' ) ) ? _wpbc.booking__get_param_value( resource_id, 'aggregate_resource_id_arr' ).join( ',' ) : '' ),
		'captcha_chalange'         : captcha_chalange,
		'captcha_user_input'       : user_captcha,
		'is_emails_send'           : is_send_emeils,
		'active_locale'            : wpdev_active_locale,
		'form_status'              : form_status,
		'allow_past'               : is_allow_past
	};

	var $time_override_panel = jQuery( '#booking_form' + resource_id ).find( '[data-wpbc-add-booking-time-override-panel]' ).first();
	if ( ! $time_override_panel.length ) {
		$time_override_panel = jQuery( '#wpbc_modal__add_booking__section:visible' ).find( '[data-wpbc-add-booking-time-override-panel]' ).first();
	}
	if (
		   $time_override_panel.length
		&& $time_override_panel.find( '[data-wpbc-add-booking-time-override-enabled]' ).first().is( ':checked' )
	) {
		request_params['wpbc_time_override_enabled'] = 1;
		request_params['wpbc_time_override_source']  = $time_override_panel.attr( 'data-wpbc-add-booking-time-override-source' ) || '';
		request_params['wpbc_time_override_start']   = $time_override_panel.find( '[data-wpbc-add-booking-time-override-field="start"]' ).first().val() || '';
		request_params['wpbc_time_override_end']     = $time_override_panel.find( '[data-wpbc-add-booking-time-override-field="end"]' ).first().val() || '';
	}

	var selected_dates_count = String( request_params['dates_ddmmyy_csv'] || '' ).split( ',' ).filter( function( date_text ){
		return '' !== String( date_text || '' ).replace( /^\s+|\s+$/g, '' );
	} ).length;
	var is_times_availability_override = (
		   ( 1 === parseInt( request_params['wpbc_time_override_enabled'] || 0, 10 ) )
		&& ( 'times_availability' === String( request_params['wpbc_time_override_source'] || '' ) )
	);
	if (
		   (
			   has_add_booking_modal_context
			&& '1' === String( $add_booking_modal.attr( 'data-wpbc-add-booking-force-recurrent-time' ) || '0' )
		   )
		|| (
			   is_times_availability_override
			&& ( selected_dates_count > 1 )
		   )
	) {
		request_params['is_use_booking_recurrent_time'] = 1;
	}

	// If preview, pass session identifiers so PHP can load transient snapshot.
	if ( preview_args && preview_args.token && preview_args.form_id ) {
		request_params['wpbc_bfb_preview']         = 1;
		request_params['wpbc_bfb_preview_token']   = preview_args.token;
		request_params['wpbc_bfb_preview_form_id'] = preview_args.form_id;
		request_params['wpbc_bfb_preview_nonce']   = preview_args.nonce; // note: URL param is `nonce`.
	}

	var is_exit = wpbc_ajx_booking__create( request_params );

	if ( true === is_exit ) {
		return;
	}
}



// == Helper Functions =================================================================================================

/**
 * Parse query string into {key:value} (old-browser safe).
 *
 * @param {string} qs
 * @return {Object}
 */
function wpbc__parse_query_string(qs) {
	var out = {};
	qs      = (qs || '');
	qs      = qs.replace( /^\?/, '' );
	if ( ! qs ) {
		return out;
	}

	var parts = qs.split( '&' );
	for ( var i = 0; i < parts.length; i++ ) {
		var kv = parts[i].split( '=' );
		var k  = decodeURIComponent( kv[0] || '' );
		if ( ! k ) {
			continue;
		}
		var v  = decodeURIComponent( kv.slice( 1 ).join( '=' ) || '' );
		out[k] = v;
	}
	return out;
}

/**
 * Detect preview args from current URL (iframe URL).
 *
 * @return {Object|null} { token, form_id, nonce } or null
 */
function wpbc__get_bfb_preview_args_from_location() {
	try {
		var p = wpbc__parse_query_string( (window.location && window.location.search) ? window.location.search : '' );

		if ( ! p.wpbc_bfb_preview || (p.wpbc_bfb_preview === '0') ) {
			return null;
		}

		if ( ! p.wpbc_bfb_preview_token || ! p.wpbc_bfb_preview_form_id ) {
			return null;
		}

		return {
			token  : String( p.wpbc_bfb_preview_token ),
			form_id: parseInt( p.wpbc_bfb_preview_form_id, 10 ) || 0,
			nonce  : (p.nonce) ? String( p.nonce ) : ''
		};
	} catch ( e ) {
		return null;
	}
}

/**
 * Resolve form status for submit.
 *
 * Priority:
 * 1) shortcode param exposed via _wpbc.booking__get_param_value(..., 'form_status')
 * 2) detect preview URL args
 * 3) fallback: published
 *
 * @param {number} resource_id
 * @return {string} 'preview'|'published'
 */
function wpbc__get_form_status_for_submit(resource_id) {

	var status = '';

	try {
		if ( (typeof _wpbc !== 'undefined') && _wpbc.booking__get_param_value ) {
			status = _wpbc.booking__get_param_value( resource_id, 'form_status' );
		}
	} catch ( e ) {}

	status = (status == null) ? '' : String( status );
	status = status.toLowerCase();

	// URL-based detection for preview iframe.
	var preview_args = wpbc__get_bfb_preview_args_from_location();
	if ( preview_args ) {
		return 'preview';
	}

	return (status === 'preview') ? 'preview' : 'published';
}



// == Backward-compatible wrappers (keep old global names working 100% as before). =====================================
function mybooking_submit( submit_form, resource_id, wpdev_active_locale ) {
	return wpbc_booking_form_submit( submit_form, resource_id, wpdev_active_locale );
}

try {
	var ev = (typeof CustomEvent === 'function') ? new CustomEvent( 'wpbc-ready' ) : document.createEvent( 'Event' );
	if ( ev.initEvent ) {
		ev.initEvent( 'wpbc-ready', true, true );
	}
	document.dispatchEvent( ev );
	console.log( 'wpbc-ready' );
} catch ( e ) {
	console.error( "WPBC event 'wpbc-ready' failed!", e );
}

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndwYmNfdXRpbHMuanMiLCJ3cGJjLmpzIiwiZGV2X2xvZy5qcyIsImFqeF9sb2FkX2JhbGFuY2VyLmpzIiwid3BiY19jYWwuanMiLCJkYXlzX3NlbGVjdF9jdXN0b20uanMiLCJ3cGJjX2NhbF9hanguanMiLCJ3cGJjX2ZlX21lc3NhZ2VzLmpzIiwidGltZWxpbmVfcG9wb3Zlci5qcyIsIndwYmNfY2FsX2xvYWRlci5qcyIsImF1dG9maWxsX2ZpZWxkcy5qcyIsImJvb2tpbmdfZm9ybV9zdWJtaXQuanMiLCJ3cGJjX3JlYWR5X2V2ZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9oQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3gvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JhQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbHVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IndwYmNfYWxsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBKYXZhU2NyaXB0IFV0aWwgRnVuY3Rpb25zXHRcdC4uL2luY2x1ZGVzL19fanMvdXRpbHMvd3BiY191dGlscy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogVHJpbSAgc3RyaW5ncyBhbmQgYXJyYXkgam9pbmVkIHdpdGggICgsKVxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nX3RvX3RyaW0gICBzdHJpbmcgLyBhcnJheVxyXG4gKiBAcmV0dXJucyBzdHJpbmdcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdHJpbShzdHJpbmdfdG9fdHJpbSkge1xyXG5cclxuXHRpZiAoIEFycmF5LmlzQXJyYXkoIHN0cmluZ190b190cmltICkgKSB7XHJcblx0XHRzdHJpbmdfdG9fdHJpbSA9IHN0cmluZ190b190cmltLmpvaW4oICcsJyApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAnc3RyaW5nJyA9PSB0eXBlb2YgKHN0cmluZ190b190cmltKSApIHtcclxuXHRcdHN0cmluZ190b190cmltID0gc3RyaW5nX3RvX3RyaW0udHJpbSgpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHN0cmluZ190b190cmltO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgZWxlbWVudCBpbiBhcnJheVxyXG4gKlxyXG4gKiBAcGFyYW0gYXJyYXlfaGVyZVx0XHRhcnJheVxyXG4gKiBAcGFyYW0gcF92YWxcdFx0XHRcdGVsZW1lbnQgdG8gIGNoZWNrXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19pbl9hcnJheShhcnJheV9oZXJlLCBwX3ZhbCkge1xyXG5cdGZvciAoIHZhciBpID0gMCwgbCA9IGFycmF5X2hlcmUubGVuZ3RoOyBpIDwgbDsgaSsrICkge1xyXG5cdFx0aWYgKCBhcnJheV9oZXJlW2ldID09IHBfdmFsICkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vKipcclxuICogUHJldmVudCBvcGVuaW5nIGJsYW5rIHdpbmRvd3Mgb24gV29yZFByZXNzIHBsYXlncm91bmQgZm9yIHBzZXVkbyBsaW5rcyBsaWtlIHRoaXM6IDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIj4gb3IgIyB0byBzdGF5IGluIHRoZSBzYW1lIHRhYi5cclxuICovXHJcbihmdW5jdGlvbiAoKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRmdW5jdGlvbiBpc19wbGF5Z3JvdW5kX29yaWdpbigpIHtcclxuXHRcdHJldHVybiBsb2NhdGlvbi5vcmlnaW4gPT09ICdodHRwczovL3BsYXlncm91bmQud29yZHByZXNzLm5ldCc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19wc2V1ZG9fbGluayhhKSB7XHJcblx0XHRpZiAoICFhIHx8ICFhLmdldEF0dHJpYnV0ZSApIHJldHVybiB0cnVlO1xyXG5cdFx0dmFyIGhyZWYgPSAoYS5nZXRBdHRyaWJ1dGUoICdocmVmJyApIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCFocmVmIHx8XHJcblx0XHRcdGhyZWYgPT09ICcjJyB8fFxyXG5cdFx0XHRocmVmLmluZGV4T2YoICcjJyApID09PSAwIHx8XHJcblx0XHRcdGhyZWYuaW5kZXhPZiggJ2phdmFzY3JpcHQ6JyApID09PSAwIHx8XHJcblx0XHRcdGhyZWYuaW5kZXhPZiggJ21haWx0bzonICkgPT09IDAgfHxcclxuXHRcdFx0aHJlZi5pbmRleE9mKCAndGVsOicgKSA9PT0gMFxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGZpeF90YXJnZXQoYSkge1xyXG5cdFx0aWYgKCAhIGEgKSByZXR1cm47XHJcblx0XHRpZiAoIGlzX3BzZXVkb19saW5rKCBhICkgfHwgYS5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwLW5vLWJsYW5rJyApICkge1xyXG5cdFx0XHRhLnRhcmdldCA9ICdfc2VsZic7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X2ZpeCgpIHtcclxuXHRcdC8vIE9wdGlvbmFsOiBjbGVhbiB1cCBjdXJyZW50IERPTSAoaGFybWxlc3PigJRhZmZlY3RzIG9ubHkgcHNldWRvL2RhdGFtYXJrZWQgbGlua3MpLlxyXG5cdFx0dmFyIG5vZGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ2FbaHJlZl0nICk7XHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKyApIGZpeF90YXJnZXQoIG5vZGVzW2ldICk7XHJcblxyXG5cdFx0Ly8gTGF0ZSBidWJibGUtcGhhc2UgbGlzdGVuZXJzIChydW4gYWZ0ZXIgUGxheWdyb3VuZCdzIGhhbmRsZXJzKVxyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0dmFyIGEgPSBlLnRhcmdldCAmJiBlLnRhcmdldC5jbG9zZXN0ID8gZS50YXJnZXQuY2xvc2VzdCggJ2FbaHJlZl0nICkgOiBudWxsO1xyXG5cdFx0XHRpZiAoIGEgKSBmaXhfdGFyZ2V0KCBhICk7XHJcblx0XHR9LCBmYWxzZSApO1xyXG5cclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0dmFyIGEgPSBlLnRhcmdldCAmJiBlLnRhcmdldC5jbG9zZXN0ID8gZS50YXJnZXQuY2xvc2VzdCggJ2FbaHJlZl0nICkgOiBudWxsO1xyXG5cdFx0XHRpZiAoIGEgKSBmaXhfdGFyZ2V0KCBhICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzY2hlZHVsZV9pbml0KCkge1xyXG5cdFx0aWYgKCAhaXNfcGxheWdyb3VuZF9vcmlnaW4oKSApIHJldHVybjtcclxuXHRcdHNldFRpbWVvdXQoIGluaXRfZml4LCAxMDAwICk7IC8vIGVuc3VyZSB3ZSBhdHRhY2ggYWZ0ZXIgUGxheWdyb3VuZCdzIHNjcmlwdC5cclxuXHR9XHJcblxyXG5cdGlmICggZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnICkge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBzY2hlZHVsZV9pbml0ICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHNjaGVkdWxlX2luaXQoKTtcclxuXHR9XHJcbn0pKCk7IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvd3BiYy93cGJjLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBEZWVwIENsb25lIG9mIG9iamVjdCBvciBhcnJheVxyXG4gKlxyXG4gKiBAcGFyYW0gb2JqXHJcbiAqIEByZXR1cm5zIHthbnl9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Nsb25lX29iaiggb2JqICl7XHJcblxyXG5cdHJldHVybiBKU09OLnBhcnNlKCBKU09OLnN0cmluZ2lmeSggb2JqICkgKTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogTWFpbiBfd3BiYyBKUyBvYmplY3RcclxuICovXHJcblxyXG52YXIgX3dwYmMgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gU2VjdXJlIHBhcmFtZXRlcnMgZm9yIEFqYXhcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlY3VyZSA9IG9iai5zZWN1cml0eV9vYmogPSBvYmouc2VjdXJpdHlfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcl9pZDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm9uY2UgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsZSA6ICcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH07XHJcblx0b2JqLnNldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9zZWN1cmVbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBDYWxlbmRhcnMgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfY2FsZW5kYXJzID0gb2JqLmNhbGVuZGFyc19vYmogPSBvYmouY2FsZW5kYXJzX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgY2FsZW5kYXIgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBDcmVhdGUgQ2FsZW5kYXIgaW5pdGlhbGl6aW5nXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pbml0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgXSA9IGZhbHNlO1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayAgaWYgdGhlIHR5cGUgb2YgdGhpcyBwcm9wZXJ0eSAgaXMgSU5UXHJcblx0ICogQHBhcmFtIHByb3BlcnR5X25hbWVcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2lzX3Byb3BfaW50ID0gZnVuY3Rpb24gKCBwcm9wZXJ0eV9uYW1lICkge1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOS4wLjI5LlxyXG5cclxuXHRcdHZhciBwX2NhbGVuZGFyX2ludF9wcm9wZXJ0aWVzID0gWydkeW5hbWljX19kYXlzX21pbicsICdkeW5hbWljX19kYXlzX21heCcsICdmaXhlZF9fZGF5c19udW0nXTtcclxuXHJcblx0XHR2YXIgaXNfaW5jbHVkZSA9IHBfY2FsZW5kYXJfaW50X3Byb3BlcnRpZXMuaW5jbHVkZXMoIHByb3BlcnR5X25hbWUgKTtcclxuXHJcblx0XHRyZXR1cm4gaXNfaW5jbHVkZTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHBhcmFtcyBmb3IgYWxsICBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcnNfb2JqXHRcdE9iamVjdCB7IGNhbGVuZGFyXzE6IHt9IH1cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgY2FsZW5kYXJfMzoge30sIC4uLiB9XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyc19hbGxfX3NldCA9IGZ1bmN0aW9uICggY2FsZW5kYXJzX29iaiApIHtcclxuXHRcdHBfY2FsZW5kYXJzID0gY2FsZW5kYXJzX29iajtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYm9va2luZ3MgaW4gYWxsIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJzX2FsbF9fZ2V0ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfY2FsZW5kYXJzO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgaWQ6IDEsIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFx0eyBpZDogMiAs4oCmIH1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2dldF9wYXJhbWV0ZXJzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRpZiAoIG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0cmV0dXJuIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBpZiBjYWxlbmRhciBvYmplY3QgIG5vdCBkZWZpbmVkLCB0aGVuICBpdCdzIHdpbGwgYmUgZGVmaW5lZCBhbmQgSUQgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gIHN5c3RlbSBzZXQgIGFzIG5ldyBvciBvdmVyd3JpdGUgb25seSBwcm9wZXJ0aWVzIGZyb20gY2FsZW5kYXJfcHJvcGVydHlfb2JqIHBhcmFtZXRlciwgIGJ1dCBvdGhlciBwcm9wZXJ0aWVzIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZSwgbGlrZSAnaWQnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcl9wcm9wZXJ0eV9vYmpcdFx0XHRcdFx0ICB7ICBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9ICB9XHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19jb21wbGV0ZV9vdmVyd3JpdGVcdFx0ICBpZiAndHJ1ZScgKGRlZmF1bHQ6ICdmYWxzZScpLCAgdGhlbiAgb25seSBvdmVyd3JpdGUgb3IgYWRkICBuZXcgcHJvcGVydGllcyBpbiAgY2FsZW5kYXJfcHJvcGVydHlfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5jYWxlbmRhcl9fc2V0KCAgXCIgLmludHZhbCggJHJlc291cmNlX2lkICkgLiBcIiwgeyAnZGF0ZXMnOiBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgfSApO1wiO1xyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBjYWxlbmRhcl9wcm9wZXJ0eV9vYmosIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IGZhbHNlICApIHtcclxuXHJcblx0XHRpZiAoICghb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApKSB8fCAodHJ1ZSA9PT0gaXNfY29tcGxldGVfb3ZlcndyaXRlKSApe1xyXG5cdFx0XHRvYmouY2FsZW5kYXJfX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBjYWxlbmRhcl9wcm9wZXJ0eV9vYmogKXtcclxuXHJcblx0XHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gY2FsZW5kYXJfcHJvcGVydHlfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgcHJvcGVydHkgIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XCIxXCJcclxuXHQgKiBAcGFyYW0gcHJvcF9uYW1lXHRcdG5hbWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcGFyYW0gcHJvcF92YWx1ZVx0dmFsdWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcmV0dXJucyB7Kn1cdFx0XHRjYWxlbmRhciBvYmplY3RcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSwgcHJvcF92YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoICghb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApKSApe1xyXG5cdFx0XHRvYmouY2FsZW5kYXJfX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwcm9wX3ZhbHVlO1xyXG5cclxuXHRcdHJldHVybiBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgY2FsZW5kYXIgcHJvcGVydHkgdmFsdWUgICBcdDo6ICAgbWl4ZWQgfCBudWxsXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9ICByZXNvdXJjZV9pZFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcHJvcF9uYW1lXHRcdFx0J3NlbGVjdGlvbl9tb2RlJ1xyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHRcdFx0XHRcdG1peGVkIHwgbnVsbFxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBwcm9wX25hbWUgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHQvLyBGaXhJbjogOS45LjAuMjkuXHJcblx0XHRcdGlmICggb2JqLmNhbGVuZGFyX19pc19wcm9wX2ludCggcHJvcF9uYW1lICkgKXtcclxuXHRcdFx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IHBhcnNlSW50KCBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiAgcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG51bGw7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gbnVsbDtcclxuXHR9O1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHQvLyBCb29raW5ncyBcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9ib29raW5ncyA9IG9iai5ib29raW5nc19vYmogPSBvYmouYm9va2luZ3Nfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBjYWxlbmRhcl8xOiBPYmplY3Qge1xyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAgIGlkOiAgICAgMVxyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgYm9va2luZ3MgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSApICk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBpZDogMSAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0XHR7IGlkOiAyICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0ID0gZnVuY3Rpb24oIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBpZiBjYWxlbmRhciBvYmplY3QgIG5vdCBkZWZpbmVkLCB0aGVuICBpdCdzIHdpbGwgYmUgZGVmaW5lZCBhbmQgSUQgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gIHN5c3RlbSBzZXQgIGFzIG5ldyBvciBvdmVyd3JpdGUgb25seSBwcm9wZXJ0aWVzIGZyb20gY2FsZW5kYXJfb2JqIHBhcmFtZXRlciwgIGJ1dCBvdGhlciBwcm9wZXJ0aWVzIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZSwgbGlrZSAnaWQnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcl9vYmpcdFx0XHRcdFx0ICB7ICBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9ICB9XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0KCAgXCIgLmludHZhbCggJHJlc291cmNlX2lkICkgLiBcIiwgeyAnZGF0ZXMnOiBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgfSApO1wiO1xyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0ID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBjYWxlbmRhcl9vYmogKXtcclxuXHJcblx0XHRpZiAoICEgb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdpZCcgXSA9IHJlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gY2FsZW5kYXJfb2JqICl7XHJcblxyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gY2FsZW5kYXJfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cdC8vIERhdGVzXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3IgQUxMIERhdGVzIGluIGNhbGVuZGFyICAgOjogICBmYWxzZSB8IHsgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0JzEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0ZmFsc2UgfCBPYmplY3Qge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yNFwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJhdmFpbGFibGVcIiwgZGF5X2F2YWlsYWJpbGl0eTogMSwgbWF4X2NhcGFjaXR5OiAxLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yNlwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJmdWxsX2RheV9ib29raW5nXCIsIFsnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJ106IFwicGVuZGluZ1wiLCBkYXlfYXZhaWxhYmlsaXR5OiAwLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yOVwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJyZXNvdXJjZV9hdmFpbGFiaWxpdHlcIiwgZGF5X2F2YWlsYWJpbGl0eTogMCwgbWF4X2NhcGFjaXR5OiAxLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0zMFwiOiB74oCmfSwgXCIyMDIzLTA3LTMxXCI6IHvigKZ9LCDigKZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2RhdGVzID0gZnVuY3Rpb24oIHJlc291cmNlX2lkKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBmYWxzZTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgYm9va2luZ3MgZGF0ZXMgaW4gY2FsZW5kYXIgb2JqZWN0ICAgOjogICAgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kICdpZCcsICdkYXRlcycgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gc3lzdGVtIGFkZCBhICBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgZGF0ZXMgZnJvbSBkYXRlc19vYmogcGFyYW1ldGVyLFxyXG5cdCAqIGJ1dCBvdGhlciBkYXRlcyBub3QgZnJvbSBwYXJhbWV0ZXIgZGF0ZXNfb2JqIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGRhdGVzX29ialx0XHRcdFx0XHQgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2NvbXBsZXRlX292ZXJ3cml0ZVx0XHQgIGlmIGZhbHNlLCAgdGhlbiAgb25seSBvdmVyd3JpdGUgb3IgYWRkICBkYXRlcyBmcm9tIFx0ZGF0ZXNfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKiAgIFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoIHJlc291cmNlX2lkLCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCDigKYgfSAgKTtcdFx0PC0gICBvdmVyd3JpdGUgQUxMIGRhdGVzXHJcblx0ICogICBcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjJcIjoge+KApn0gfSwgIGZhbHNlICApO1x0XHRcdFx0XHQ8LSAgIGFkZCBvciBvdmVyd3JpdGUgb25seSAgXHRcIjIwMjMtMDctMjJcIjoge31cclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCAgXCIgLiBpbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsICBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgICk7ICBcIjtcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgZGF0ZXNfb2JqICwgaXNfY29tcGxldGVfb3ZlcndyaXRlID0gdHJ1ZSApe1xyXG5cclxuXHRcdGlmICggIW9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cdFx0XHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCggcmVzb3VyY2VfaWQsIHsgJ2RhdGVzJzoge30gfSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0pICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdID0ge31cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoaXNfY29tcGxldGVfb3ZlcndyaXRlKXtcclxuXHJcblx0XHRcdC8vIENvbXBsZXRlIG92ZXJ3cml0ZSBhbGwgIGJvb2tpbmcgZGF0ZXNcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gPSBkYXRlc19vYmo7XHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0Ly8gQWRkIG9ubHkgIG5ldyBvciBvdmVyd3JpdGUgZXhpc3QgYm9va2luZyBkYXRlcyBmcm9tICBwYXJhbWV0ZXIuIEJvb2tpbmcgZGF0ZXMgbm90IGZyb20gIHBhcmFtZXRlciAgd2lsbCAgYmUgd2l0aG91dCBjaG5hbmdlc1xyXG5cdFx0XHRmb3IgKCB2YXIgcHJvcF9uYW1lIGluIGRhdGVzX29iaiApe1xyXG5cclxuXHRcdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bJ2RhdGVzJ11bIHByb3BfbmFtZSBdID0gZGF0ZXNfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3Igc3BlY2lmaWMgZGF0ZSBpbiBjYWxlbmRhciAgIDo6ICAgZmFsc2UgfCB7IGRheV9hdmFpbGFiaWxpdHk6IDEsIC4uLiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXlcdFx0XHQnMjAyMy0wNy0yMSdcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRmYWxzZSB8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF5X2F2YWlsYWJpbGl0eTogNFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtYXhfY2FwYWNpdHk6IDRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAgPj0gQnVzaW5lc3MgTGFyZ2VcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MjogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMDogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVx0XHQvLyAgPj0gQnVzaW5lc3MgTGFyZ2UgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDExOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDEyOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdWyBzcWxfY2xhc3NfZGF5IF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdWyBzcWxfY2xhc3NfZGF5IF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIGZhbHNlO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBBbnkgIFBBUkFNUyAgIGluIGJvb2tpbmdzXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBwcm9wZXJ0eSAgdG8gIGJvb2tpbmdcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFwiMVwiXHJcblx0ICogQHBhcmFtIHByb3BfbmFtZVx0XHRuYW1lIG9mIHByb3BlcnR5XHJcblx0ICogQHBhcmFtIHByb3BfdmFsdWVcdHZhbHVlIG9mIHByb3BlcnR5XHJcblx0ICogQHJldHVybnMgeyp9XHRcdFx0Ym9va2luZyBvYmplY3RcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lLCBwcm9wX3ZhbHVlICkge1xyXG5cclxuXHRcdGlmICggISBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2lkJyBdID0gcmVzb3VyY2VfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IHByb3BfdmFsdWU7XHJcblxyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmcgcHJvcGVydHkgdmFsdWUgICBcdDo6ICAgbWl4ZWQgfCBudWxsXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9ICByZXNvdXJjZV9pZFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcHJvcF9uYW1lXHRcdFx0J3NlbGVjdGlvbl9tb2RlJ1xyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHRcdFx0XHRcdG1peGVkIHwgbnVsbFxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIG51bGw7XHJcblx0fTtcclxuXHJcblxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGZvciBhbGwgIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGNhbGVuZGFyc19vYmpcdFx0T2JqZWN0IHsgY2FsZW5kYXJfMTogeyBpZDogMSwgZGF0ZXM6IE9iamVjdCB7IFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCBcIjIwMjMtMDctMjRcIjoge+KApn0sIOKApiB9IH1cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgY2FsZW5kYXJfMzoge30sIC4uLiB9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyc19fc2V0X2FsbCA9IGZ1bmN0aW9uICggY2FsZW5kYXJzX29iaiApIHtcclxuXHRcdHBfYm9va2luZ3MgPSBjYWxlbmRhcnNfb2JqO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5ncyBpbiBhbGwgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcnNfX2dldF9hbGwgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9ib29raW5ncztcclxuXHR9O1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHJcblxyXG5cdC8vIFNlYXNvbnMgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfc2Vhc29ucyA9IG9iai5zZWFzb25zX29iaiA9IG9iai5zZWFzb25zX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY2FsZW5kYXJfMTogT2JqZWN0IHtcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgICBpZDogICAgIDFcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKAplxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQWRkIHNlYXNvbiBuYW1lcyBmb3IgZGF0ZXMgaW4gY2FsZW5kYXIgb2JqZWN0ICAgOjogICAgeyBcIjIwMjMtMDctMjFcIjogWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF0sIFwiMjAyMy0wNy0yMlwiOiBbLi4uXSwgLi4uIH1cclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gZGF0ZXNfb2JqXHRcdFx0XHRcdCAgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgZmFsc2UsICB0aGVuICBvbmx5ICBhZGQgIGRhdGVzIGZyb20gXHRkYXRlc19vYmpcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGVzOlxyXG5cdCAqICAgXHRcdFx0X3dwYmMuc2Vhc29uc19fc2V0KCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjFcIjogWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF0sIFwiMjAyMy0wNy0yMlwiOiBbLi4uXSwgLi4uIH0gICk7XHJcblx0ICovXHJcblx0b2JqLnNlYXNvbnNfX3NldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgZGF0ZXNfb2JqICwgaXNfY29tcGxldGVfb3ZlcndyaXRlID0gZmFsc2UgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdKSApe1xyXG5cdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfY29tcGxldGVfb3ZlcndyaXRlICl7XHJcblxyXG5cdFx0XHQvLyBDb21wbGV0ZSBvdmVyd3JpdGUgYWxsICBzZWFzb24gZGF0ZXNcclxuXHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSBkYXRlc19vYmo7XHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdC8vIEFkZCBvbmx5ICBuZXcgb3Igb3ZlcndyaXRlIGV4aXN0IGJvb2tpbmcgZGF0ZXMgZnJvbSAgcGFyYW1ldGVyLiBCb29raW5nIGRhdGVzIG5vdCBmcm9tICBwYXJhbWV0ZXIgIHdpbGwgIGJlIHdpdGhvdXQgY2huYW5nZXNcclxuXHRcdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBkYXRlc19vYmogKXtcclxuXHJcblx0XHRcdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0pICl7XHJcblx0XHRcdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBbXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Zm9yICggdmFyIHNlYXNvbl9uYW1lX2tleSBpbiBkYXRlc19vYmpbIHByb3BfbmFtZSBdICl7XHJcblx0XHRcdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0ucHVzaCggZGF0ZXNfb2JqWyBwcm9wX25hbWUgXVsgc2Vhc29uX25hbWVfa2V5IF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3Igc3BlY2lmaWMgZGF0ZSBpbiBjYWxlbmRhciAgIDo6ICAgW10gfCBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzcWxfY2xhc3NfZGF5XHRcdFx0JzIwMjMtMDctMjEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0W10gIHwgIFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdXHJcblx0ICovXHJcblx0b2JqLnNlYXNvbnNfX2dldF9mb3JfZGF0ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBzcWxfY2xhc3NfZGF5IF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBzcWxfY2xhc3NfZGF5IF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFtdO1x0XHQvLyBJZiBub3QgZGVmaW5lZCwgdGhlbiBbXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gT3RoZXIgcGFyYW1ldGVycyBcdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9vdGhlciA9IG9iai5vdGhlcl9vYmogPSBvYmoub3RoZXJfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlclsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFsbCBvdGhlciBwYXJhbXNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbV9fYWxsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXI7XHJcblx0fTtcclxuXHJcblx0Ly8gTWVzc2FnZXMgXHRcdFx0ICAgICAgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9tZXNzYWdlcyA9IG9iai5tZXNzYWdlc19vYmogPSBvYmoubWVzc2FnZXNfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9tZXNzYWdlID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfbWVzc2FnZXNbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfbWVzc2FnZSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfbWVzc2FnZXNbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgb3RoZXIgcGFyYW1zXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5nZXRfbWVzc2FnZXNfX2FsbCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX21lc3NhZ2VzO1xyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHJldHVybiBvYmo7XHJcblxyXG59KCBfd3BiYyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG4iLCJ3aW5kb3cuX19XUEJDX0RFViA9IHRydWU7XHJcblxyXG4vKipcclxuICogRXh0ZW5kIF93cGJjIHdpdGggIG5ldyBtZXRob2RzXHJcbiAqXHJcbiAqIEB0eXBlIHsqfHt9fVxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuX3dwYmMgPSAoZnVuY3Rpb24gKG9iaiwgJCkge1xyXG5cclxuXHQvKipcclxuXHQgKiBEZXYgbG9nZ2VyIChuby1vcCB1bmxlc3Mgd2luZG93Ll9fV1BCQ19ERVYgPSB0cnVlKVxyXG5cdCAqXHJcblx0ICogQHR5cGUgeyp8e3dhcm46IChmdW5jdGlvbigqLCAqLCAqKTogdm9pZCksIGVycm9yOiAoZnVuY3Rpb24oKiwgKiwgKik6IHZvaWQpLCBvbmNlOiBvYmouZGV2Lm9uY2UsIHRyeTogKChmdW5jdGlvbigqLCAqLCAqKTogKCp8dW5kZWZpbmVkKSl8Kil9fVxyXG5cdCAqL1xyXG5cdG9iai5kZXYgPSBvYmouZGV2IHx8ICgoKSA9PiB7XHJcblx0XHRjb25zdCBzZWVuICAgID0gbmV3IFNldCgpO1xyXG5cdFx0Y29uc3QgZW5hYmxlZCA9ICgpID0+ICEhd2luZG93Ll9fV1BCQ19ERVY7XHJcblxyXG5cdFx0ZnVuY3Rpb24gb3V0KGxldmVsLCBjb2RlLCBtc2csIGV4dHJhKSB7XHJcblx0XHRcdGlmICggIWVuYWJsZWQoKSApIHJldHVybjtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHQoY29uc29sZVtsZXZlbF0gfHwgY29uc29sZS53YXJuKSggYFtXUEJDXVske2NvZGV9XSAke21zZ31gLCBleHRyYSA/PyAnJyApO1xyXG5cdFx0XHR9IGNhdGNoIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGxvZyAgOiAoY29kZSwgbXNnLCBleHRyYSkgPT4gb3V0KCdsb2cnLCAgIGNvZGUsIG1zZywgZXh0cmEpLFxyXG5cdFx0XHRkZWJ1ZzogKGNvZGUsIG1zZywgZXh0cmEpID0+IG91dCgnZGVidWcnLCBjb2RlLCBtc2csIGV4dHJhKSxcclxuXHRcdFx0d2FybiA6IChjb2RlLCBtc2csIGV4dHJhKSA9PiBvdXQoICd3YXJuJywgY29kZSwgbXNnLCBleHRyYSApLFxyXG5cdFx0XHRlcnJvcjogKGNvZGUsIGVyck9yTXNnLCBleHRyYSkgPT5cclxuXHRcdFx0XHRvdXQoICdlcnJvcicsIGNvZGUsXHJcblx0XHRcdFx0XHRlcnJPck1zZyBpbnN0YW5jZW9mIEVycm9yID8gZXJyT3JNc2cubWVzc2FnZSA6IFN0cmluZyggZXJyT3JNc2cgKSxcclxuXHRcdFx0XHRcdGVyck9yTXNnIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJPck1zZyA6IGV4dHJhICksXHJcblx0XHRcdG9uY2UgOiAoY29kZSwgbXNnLCBleHRyYSkgPT4ge1xyXG5cdFx0XHRcdGlmICggIWVuYWJsZWQoKSApIHJldHVybjtcclxuXHRcdFx0XHRjb25zdCBrZXkgPSBgJHtjb2RlfXwke21zZ31gO1xyXG5cdFx0XHRcdGlmICggc2Vlbi5oYXMoIGtleSApICkgcmV0dXJuO1xyXG5cdFx0XHRcdHNlZW4uYWRkKCBrZXkgKTtcclxuXHRcdFx0XHRvdXQoICdlcnJvcicsIGNvZGUsIG1zZywgZXh0cmEgKTtcclxuXHRcdFx0fSxcclxuXHRcdFx0dHJ5ICA6IChjb2RlLCBmbiwgZXh0cmEpID0+IHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIGZuKCk7XHJcblx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHRvdXQoICdlcnJvcicsIGNvZGUsIGUsIGV4dHJhICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdH0pKCk7XHJcblxyXG5cdC8vIE9wdGlvbmFsOiBnbG9iYWwgdHJhcHMgaW4gZGV2LlxyXG5cdGlmICggd2luZG93Ll9fV1BCQ19ERVYgKSB7XHJcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ2Vycm9yJywgKGUpID0+IHtcclxuXHRcdFx0dHJ5IHsgX3dwYmM/LmRldj8uZXJyb3IoICdHTE9CQUwtRVJST1InLCBlPy5lcnJvciB8fCBlPy5tZXNzYWdlLCBlICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdH0gKTtcclxuXHRcdHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCAndW5oYW5kbGVkcmVqZWN0aW9uJywgKGUpID0+IHtcclxuXHRcdFx0dHJ5IHsgX3dwYmM/LmRldj8uZXJyb3IoICdHTE9CQUwtUkVKRUNUSU9OJywgZT8ucmVhc29uICk7IH0gY2F0Y2ggKCBfICkge31cclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBvYmo7XHJcblx0fSggX3dwYmMgfHwge30sIGpRdWVyeSApKTtcclxuIiwiLyoqXHJcbiAqIEV4dGVuZCBfd3BiYyB3aXRoICBuZXcgbWV0aG9kcyAgICAgICAgLy8gRml4SW46IDkuOC42LjIuXHJcbiAqXHJcbiAqIEB0eXBlIHsqfHt9fVxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuIF93cGJjID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIExvYWQgQmFsYW5jZXIgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHR2YXIgcF9iYWxhbmNlciA9IG9iai5iYWxhbmNlcl9vYmogPSBvYmouYmFsYW5jZXJfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbWF4X3RocmVhZHMnOiAyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpbl9wcm9jZXNzJyA6IFtdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3YWl0JyAgICAgICA6IFtdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdCAvKipcclxuXHQgICogU2V0ICBtYXggcGFyYWxsZWwgcmVxdWVzdCAgdG8gIGxvYWRcclxuXHQgICpcclxuXHQgICogQHBhcmFtIG1heF90aHJlYWRzXHJcblx0ICAqL1xyXG5cdG9iai5iYWxhbmNlcl9fc2V0X21heF90aHJlYWRzID0gZnVuY3Rpb24gKCBtYXhfdGhyZWFkcyApe1xyXG5cclxuXHRcdHBfYmFsYW5jZXJbICdtYXhfdGhyZWFkcycgXSA9IG1heF90aHJlYWRzO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBDaGVjayBpZiBiYWxhbmNlciBmb3Igc3BlY2lmaWMgYm9va2luZyByZXNvdXJjZSBkZWZpbmVkICAgOjogICB0cnVlIHwgZmFsc2VcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRvYmouYmFsYW5jZXJfX2lzX2RlZmluZWQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xyXG5cclxuXHRcdHJldHVybiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggcF9iYWxhbmNlclsgJ2JhbGFuY2VyXycgKyByZXNvdXJjZV9pZCBdICkgKTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogIENyZWF0ZSBiYWxhbmNlciBpbml0aWFsaXppbmdcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRvYmouYmFsYW5jZXJfX2luaXQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICwgcGFyYW1zID17fSkge1xyXG5cclxuXHRcdHZhciBiYWxhbmNlX29iaiA9IHt9O1xyXG5cdFx0YmFsYW5jZV9vYmpbICdyZXNvdXJjZV9pZCcgXSAgID0gcmVzb3VyY2VfaWQ7XHJcblx0XHRiYWxhbmNlX29ialsgJ3ByaW9yaXR5JyBdICAgICAgPSAxO1xyXG5cdFx0YmFsYW5jZV9vYmpbICdmdW5jdGlvbl9uYW1lJyBdID0gZnVuY3Rpb25fbmFtZTtcclxuXHRcdGJhbGFuY2Vfb2JqWyAncGFyYW1zJyBdICAgICAgICA9IHdwYmNfY2xvbmVfb2JqKCBwYXJhbXMgKTtcclxuXHJcblxyXG5cdFx0aWYgKCBvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfcnVuKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApICl7XHJcblx0XHRcdHJldHVybiAncnVuJztcclxuXHRcdH1cclxuXHRcdGlmICggb2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3dhaXQoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICkgKXtcclxuXHRcdFx0cmV0dXJuICd3YWl0JztcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0aWYgKCBvYmouYmFsYW5jZXJfX2Nhbl9pX3J1bigpICl7XHJcblx0XHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX19ydW4oIGJhbGFuY2Vfb2JqICk7XHJcblx0XHRcdHJldHVybiAncnVuJztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX193YWl0KCBiYWxhbmNlX29iaiApO1xyXG5cdFx0XHRyZXR1cm4gJ3dhaXQnO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCAvKipcclxuXHQgICogQ2FuIEkgUnVuID9cclxuXHQgICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICAqL1xyXG5cdG9iai5iYWxhbmNlcl9fY2FuX2lfcnVuID0gZnVuY3Rpb24gKCl7XHJcblx0XHRyZXR1cm4gKCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5sZW5ndGggPCBwX2JhbGFuY2VyWyAnbWF4X3RocmVhZHMnIF0gKTtcclxuXHR9XHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIEFkZCB0byBXQUlUXHJcblx0XHQgICogQHBhcmFtIGJhbGFuY2Vfb2JqXHJcblx0XHQgICovXHJcblx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fd2FpdCA9IGZ1bmN0aW9uICggYmFsYW5jZV9vYmogKSB7XHJcblx0XHRcdHBfYmFsYW5jZXJbJ3dhaXQnXS5wdXNoKCBiYWxhbmNlX29iaiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdCAvKipcclxuXHRcdCAgKiBSZW1vdmUgZnJvbSBXYWl0XHJcblx0XHQgICpcclxuXHRcdCAgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAgKiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0ICAqIEByZXR1cm5zIHsqfGJvb2xlYW59XHJcblx0XHQgICovXHJcblx0XHRvYmouYmFsYW5jZXJfX3JlbW92ZV9mcm9tX193YWl0X2xpc3QgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHR2YXIgcmVtb3ZlZF9lbCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0aWYgKCBwX2JhbGFuY2VyWyAnd2FpdCcgXS5sZW5ndGggKXtcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICd3YWl0JyBdICl7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRyZW1vdmVkX2VsID0gcF9iYWxhbmNlclsgJ3dhaXQnIF0uc3BsaWNlKCBpLCAxICk7XHJcblx0XHRcdFx0XHRcdHJlbW92ZWRfZWwgPSByZW1vdmVkX2VsLnBvcCgpO1xyXG5cdFx0XHRcdFx0XHRwX2JhbGFuY2VyWyAnd2FpdCcgXSA9IHBfYmFsYW5jZXJbICd3YWl0JyBdLmZpbHRlciggZnVuY3Rpb24gKCB2ICl7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHY7XHJcblx0XHRcdFx0XHRcdH0gKTtcdFx0XHRcdFx0Ly8gUmVpbmRleCBhcnJheVxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQqIElzIGFscmVhZHkgV0FJVFxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3dhaXQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICd3YWl0JyBdICl7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQgLyoqXHJcblx0XHQgICogQWRkIHRvIFJVTlxyXG5cdFx0ICAqIEBwYXJhbSBiYWxhbmNlX29ialxyXG5cdFx0ICAqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biA9IGZ1bmN0aW9uICggYmFsYW5jZV9vYmogKSB7XHJcblx0XHRcdHBfYmFsYW5jZXJbJ2luX3Byb2Nlc3MnXS5wdXNoKCBiYWxhbmNlX29iaiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0KiBSZW1vdmUgZnJvbSBSVU4gbGlzdFxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMgeyp8Ym9vbGVhbn1cclxuXHRcdCovXHJcblx0XHRvYmouYmFsYW5jZXJfX3JlbW92ZV9mcm9tX19ydW5fbGlzdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdCB2YXIgcmVtb3ZlZF9lbCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0IGlmICggcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0ubGVuZ3RoICl7XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0IGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdICl7XHJcblx0XHRcdFx0XHQgaWYgKFxyXG5cdFx0XHRcdFx0XHQgKHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCAmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQgKXtcclxuXHRcdFx0XHRcdFx0IHJlbW92ZWRfZWwgPSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5zcGxpY2UoIGksIDEgKTtcclxuXHRcdFx0XHRcdFx0IHJlbW92ZWRfZWwgPSByZW1vdmVkX2VsLnBvcCgpO1xyXG5cdFx0XHRcdFx0XHQgcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gPSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5maWx0ZXIoIGZ1bmN0aW9uICggdiApe1xyXG5cdFx0XHRcdFx0XHRcdCByZXR1cm4gdjtcclxuXHRcdFx0XHRcdFx0IH0gKTtcdFx0Ly8gUmVpbmRleCBhcnJheVxyXG5cdFx0XHRcdFx0XHQgcmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHRcdFx0XHQgfVxyXG5cdFx0XHRcdCB9XHJcblx0XHRcdCB9XHJcblx0XHRcdCByZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCogSXMgYWxyZWFkeSBSVU5cclxuXHRcdCpcclxuXHRcdCogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0Ki9cclxuXHRcdG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV9ydW4gPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCApe1x0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gKXtcclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0KHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0b2JqLmJhbGFuY2VyX19ydW5fbmV4dCA9IGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdC8vIEdldCAxc3QgZnJvbSAgV2FpdCBsaXN0XHJcblx0XHR2YXIgcmVtb3ZlZF9lbCA9IGZhbHNlO1xyXG5cdFx0aWYgKCBwX2JhbGFuY2VyWyAnd2FpdCcgXS5sZW5ndGggKXtcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnd2FpdCcgXSApe1xyXG5cdFx0XHRcdHJlbW92ZWRfZWwgPSBvYmouYmFsYW5jZXJfX3JlbW92ZV9mcm9tX193YWl0X2xpc3QoIHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSwgcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0gKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggZmFsc2UgIT09IHJlbW92ZWRfZWwgKXtcclxuXHJcblx0XHRcdC8vIFJ1blxyXG5cdFx0XHRvYmouYmFsYW5jZXJfX3J1biggcmVtb3ZlZF9lbCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0IC8qKlxyXG5cdCAgKiBSdW5cclxuXHQgICogQHBhcmFtIGJhbGFuY2Vfb2JqXHJcblx0ICAqL1xyXG5cdG9iai5iYWxhbmNlcl9fcnVuID0gZnVuY3Rpb24gKCBiYWxhbmNlX29iaiApe1xyXG5cclxuXHRcdHN3aXRjaCAoIGJhbGFuY2Vfb2JqWyAnZnVuY3Rpb25fbmFtZScgXSApe1xyXG5cclxuXHRcdFx0Y2FzZSAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnOlxyXG5cclxuXHRcdFx0XHQvLyBBZGQgdG8gcnVuIGxpc3RcclxuXHRcdFx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fcnVuKCBiYWxhbmNlX29iaiApO1xyXG5cclxuXHRcdFx0XHR3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCggYmFsYW5jZV9vYmpbICdwYXJhbXMnIF0gKVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBvYmo7XHJcblxyXG59KCBfd3BiYyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG5cclxuXHJcbiBcdC8qKlxyXG4gXHQgKiAtLSBIZWxwIGZ1bmN0aW9ucyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmFsYW5jZXJfX2lzX3dhaXQoIHBhcmFtcywgZnVuY3Rpb25fbmFtZSApe1xyXG4vL2NvbnNvbGUubG9nKCc6OndwYmNfYmFsYW5jZXJfX2lzX3dhaXQnLHBhcmFtcyAsIGZ1bmN0aW9uX25hbWUgKTtcclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocGFyYW1zWyAncmVzb3VyY2VfaWQnIF0pICl7XHJcblxyXG5cdFx0XHR2YXIgYmFsYW5jZXJfc3RhdHVzID0gX3dwYmMuYmFsYW5jZXJfX2luaXQoIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdLCBmdW5jdGlvbl9uYW1lLCBwYXJhbXMgKTtcclxuXHJcblx0XHRcdHJldHVybiAoICd3YWl0JyA9PT0gYmFsYW5jZXJfc3RhdHVzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCggcmVzb3VyY2VfaWQgLCBmdW5jdGlvbl9uYW1lICl7XHJcbi8vY29uc29sZS5sb2coJzo6d3BiY19iYWxhbmNlcl9fY29tcGxldGVkJyxyZXNvdXJjZV9pZCAsIGZ1bmN0aW9uX25hbWUgKTtcclxuXHRcdF93cGJjLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fcnVuX2xpc3QoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRfd3BiYy5iYWxhbmNlcl9fcnVuX25leHQoKTtcclxuXHR9IiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9jYWwvd3BiY19jYWwuanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIE9yZGVyIG9yIGNoaWxkIGJvb2tpbmcgcmVzb3VyY2VzIHNhdmVkIGhlcmU6ICBcdF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsXHJcbiAqICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgKVx0XHRbMiwxMCwxMiwxMV1cclxuICovXHJcblxyXG4vKipcclxuICogSG93IHRvIGNoZWNrICBib29rZWQgdGltZXMgb24gIHNwZWNpZmljIGRhdGU6ID9cclxuICpcclxuXHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJyk7XHJcblxyXG5cdFx0XHRjb25zb2xlLmxvZyhcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHMsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEwXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcyxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTFdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHNcclxuXHRcdFx0XHRcdCk7XHJcbiAqICBPUlxyXG5cdFx0XHRjb25zb2xlLmxvZyhcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMV0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlXHJcblx0XHRcdFx0XHQpO1xyXG4gKlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBEYXlzIHNlbGVjdGlvbjpcclxuICogXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKTtcclxuICpcclxuICpcdFx0XHRcdFx0dmFyIHJlc291cmNlX2lkID0gMTtcclxuICogXHRFeGFtcGxlIDE6XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLCAnMjAyNC0wNS0xNScsXHJcbiAqICcyMDI0LTA1LTI1JyApOyBFeGFtcGxlIDI6XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLFxyXG4gKiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0yNSddICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuXHJcbi8qKlxyXG4gKiBDIEEgTCBFIE4gRCBBIFIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogIFNob3cgV1BCQyBDYWxlbmRhclxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0XHQtIHJlc291cmNlIElEXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBJZiBubyBjYWxlbmRhciBIVE1MIHRhZywgIHRoZW4gIGV4aXRcclxuXHRpZiAoIDAgPT09IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkubGVuZ3RoICl7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHQvLyBJZiB0aGUgY2FsZW5kYXIgd2l0aCB0aGUgc2FtZSBCb29raW5nIHJlc291cmNlIGlzIGFjdGl2YXRlZCBhbHJlYWR5LCB0aGVuIGV4aXQuIEJ1dCBpbiBFbGVtZW50b3IgdGhlIGNsYXNzIGNhbiBiZSBzdGFsZSwgc28gdmVyaWZ5IGluc3RhbmNlLlxyXG5cdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5oYXNDbGFzcyggJ2hhc0RhdGVwaWNrJyApICkge1xyXG5cclxuXHRcdHZhciBleGlzdGluZ19pbnN0ID0gbnVsbDtcclxuXHJcblx0XHR0cnkge1xyXG5cdFx0XHRleGlzdGluZ19pbnN0ID0galF1ZXJ5LmRhdGVwaWNrLl9nZXRJbnN0KCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmdldCggMCApICk7XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0ZXhpc3RpbmdfaW5zdCA9IG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBleGlzdGluZ19pbnN0ICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3RhbGUgbWFya2VyOiByZW1vdmUgYW5kIGNvbnRpbnVlIHdpdGggaW5pdC5cclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcclxuXHR9XHJcblxyXG5cdHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19oaWRlX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRGF5cyBzZWxlY3Rpb25cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0ID0gZmFsc2U7XHJcblx0dmFyIGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gICA9IDM2NTtcdFx0XHRcdFx0Ly8gbXVsdGlwbGUgfCBmaXhlZFxyXG5cdGlmICggJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdGxvY2FsX19pc19yYW5nZV9zZWxlY3QgPSB0cnVlO1xyXG5cdFx0bG9jYWxfX211bHRpX2RheXNfc2VsZWN0X251bSA9IDA7XHJcblx0fVxyXG5cdGlmICggJ3NpbmdsZScgID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gPSAwO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBNaW4gLSBNYXggZGF5cyB0byBzY3JvbGwvc2hvd1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGxvY2FsX19taW5fZGF0ZSA9IDA7XHJcbiBcdGxvY2FsX19taW5fZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDAgXSwgKHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDEgXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHRcdFx0Ly8gRml4SW46IDkuOS4wLjE3LlxyXG4vL2NvbnNvbGUubG9nKCBsb2NhbF9fbWluX2RhdGUgKTtcclxuXHR2YXIgbG9jYWxfX21heF9kYXRlID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX21heF9tb250aGVzX2luX2NhbGVuZGFyJyApO1xyXG5cdC8vbG9jYWxfX21heF9kYXRlID0gbmV3IERhdGUoMjAyNCwgNSwgMjgpOyAgSXQgaXMgaGVyZSBpc3N1ZSBvZiBub3Qgc2VsZWN0YWJsZSBkYXRlcywgYnV0IHNvbWUgZGF0ZXMgc2hvd2luZyBpbiBjYWxlbmRhciBhcyBhdmFpbGFibGUsIGJ1dCB3ZSBjYW4gbm90IHNlbGVjdCBpdC5cclxuXHJcblx0Ly8vLyBEZWZpbmUgbGFzdCBkYXkgaW4gY2FsZW5kYXIgKGFzIGEgbGFzdCBkYXkgb2YgbW9udGggKGFuZCBub3QgZGF0ZSwgd2hpY2ggaXMgcmVsYXRlZCB0byBhY3R1YWwgJ1RvZGF5JyBkYXRlKS5cclxuXHQvLy8vIEUuZy4gaWYgdG9kYXkgaXMgMjAyMy0wOS0yNSwgYW5kIHdlIHNldCAnTnVtYmVyIG9mIG1vbnRocyB0byBzY3JvbGwnIGFzIDUgbW9udGhzLCB0aGVuIGxhc3QgZGF5IHdpbGwgYmUgMjAyNC0wMi0yOSBhbmQgbm90IHRoZSAyMDI0LTAyLTI1LlxyXG5cdC8vIHZhciBjYWxfbGFzdF9kYXlfaW5fbW9udGggPSBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIG51bGwsIGxvY2FsX19tYXhfZGF0ZSwgbmV3IERhdGUoKSApO1xyXG5cdC8vIGNhbF9sYXN0X2RheV9pbl9tb250aCA9IG5ldyBEYXRlKCBjYWxfbGFzdF9kYXlfaW5fbW9udGguZ2V0RnVsbFllYXIoKSwgY2FsX2xhc3RfZGF5X2luX21vbnRoLmdldE1vbnRoKCkgKyAxLCAwICk7XHJcblx0Ly8gbG9jYWxfX21heF9kYXRlID0gY2FsX2xhc3RfZGF5X2luX21vbnRoO1x0XHRcdC8vIEZpeEluOiAxMC4wLjAuMjYuXHJcblxyXG5cdC8vIEdldCBzdGFydCAvIGVuZCBkYXRlcyBmcm9tICB0aGUgQm9va2luZyBDYWxlbmRhciBzaG9ydGNvZGUuIEV4YW1wbGU6IFtib29raW5nIGNhbGVuZGFyX2RhdGVzX3N0YXJ0PScyMDI2LTAxLTAxJyBjYWxlbmRhcl9kYXRlc19lbmQ9JzIwMjYtMTItMzEnICByZXNvdXJjZV9pZD0xXSAvLyBGaXhJbjogMTAuMTMuMS40LlxyXG5cdGlmICggZmFsc2UgIT09IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19zdGFydCggcmVzb3VyY2VfaWQgKSApIHtcclxuXHRcdGxvY2FsX19taW5fZGF0ZSA9IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19zdGFydCggcmVzb3VyY2VfaWQgKTsgIC8vIEUuZy4gLSBsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggMjAyNSwgMCwgMSApO1xyXG5cdH1cclxuXHRpZiAoIGZhbHNlICE9PSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfZW5kKCByZXNvdXJjZV9pZCApICkge1xyXG5cdFx0bG9jYWxfX21heF9kYXRlID0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcmVzb3VyY2VfaWQgKTsgICAgLy8gRS5nLiAtIGxvY2FsX19tYXhfZGF0ZSA9IG5ldyBEYXRlKCAyMDI1LCAxMSwgMzEgKTtcclxuXHR9XHJcblxyXG5cdC8vIEluIGNhc2Ugd2UgZWRpdCBib29raW5nIGluIHBhc3Qgb3IgaGF2ZSBzcGVjaWZpYyBwYXJhbWV0ZXIgaW4gVVJMLlxyXG5cdHZhciB3cGJjX2VkaXRfYm9va2luZ19oYXNoID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2Jvb2tpbmdfaGFzaCcgKTtcclxuXHR2YXIgd3BiY19pc19lZGl0X2Jvb2tpbmdfY29udGV4dCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiB3cGJjX2VkaXRfYm9va2luZ19oYXNoICkgJiYgKCAnJyAhPT0gd3BiY19lZGl0X2Jvb2tpbmdfaGFzaCApO1xyXG5cdHZhciB3cGJjX2FsbG93X3Bhc3RfY29udGV4dCA9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9hbGxvd19wYXN0JyApO1xyXG5cdHZhciB3cGJjX2lzX2FsbG93X3Bhc3RfY29udGV4dCA9ICggJzEnID09PSBTdHJpbmcoIHdwYmNfYWxsb3dfcGFzdF9jb250ZXh0ICkgKSB8fCAoIDEgPT09IHdwYmNfYWxsb3dfcGFzdF9jb250ZXh0ICkgfHwgKCB0cnVlID09PSB3cGJjX2FsbG93X3Bhc3RfY29udGV4dCApO1xyXG5cdHZhciB3cGJjX2FsbG93X3Bhc3RfZGF0ZV9hcnIgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYWxsb3dfcGFzdF9hcnInICk7XHJcblx0dmFyIHdwYmNfaXNfYWRkX2Jvb2tpbmdfYWRtaW5fcGFnZSA9ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjJyApICE9IC0xICkgJiYgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICd0YWI9YWRkLWJvb2tpbmcnICkgIT0gLTEgKTtcclxuXHRpZiAoICAgKCB3cGJjX2lzX2FkZF9ib29raW5nX2FkbWluX3BhZ2UgfHwgd3BiY19pc19lZGl0X2Jvb2tpbmdfY29udGV4dCB8fCB3cGJjX2lzX2FsbG93X3Bhc3RfY29udGV4dCApXHJcblx0XHQmJiAoXHJcblx0XHRcdCAgd3BiY19pc19lZGl0X2Jvb2tpbmdfY29udGV4dFxyXG5cdFx0ICAgfHwgd3BiY19pc19hbGxvd19wYXN0X2NvbnRleHRcclxuXHRcdCAgIHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCdib29raW5nX2hhc2gnKSAhPSAtMSApICAgICAgICAgICAgICAgICAgLy8gQ29tbWVudCB0aGlzIGxpbmUgZm9yIGFiaWxpdHkgdG8gYWRkICBib29raW5nIGluIHBhc3QgZGF5cyBhdCAgQm9va2luZyA+IEFkZCBib29raW5nIHBhZ2UuXHJcblx0XHQgICB8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZignYWxsb3dfcGFzdCcpICE9IC0xICkgICAgICAgICAgICAgICAgLy8gRml4SW46IDEwLjcuMS4yLlxyXG5cdFx0KVxyXG5cdCl7XHJcblx0XHQvLyBsb2NhbF9fbWluX2RhdGUgPSBudWxsO1xyXG5cdFx0Ly8gRml4SW46IDEwLjE0LjEuNC5cclxuXHRcdHZhciB3cGJjX21pbl9kYXRlX2FyciA9ICggd3BiY19pc19hbGxvd19wYXN0X2NvbnRleHQgJiYgd3BiY19hbGxvd19wYXN0X2RhdGVfYXJyICYmICggNSA8PSB3cGJjX2FsbG93X3Bhc3RfZGF0ZV9hcnIubGVuZ3RoICkgKSA/IHdwYmNfYWxsb3dfcGFzdF9kYXRlX2FyciA6IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApO1xyXG5cdFx0bG9jYWxfX21pbl9kYXRlICA9IG5ldyBEYXRlKCB3cGJjX21pbl9kYXRlX2FyclswXSwgKCBwYXJzZUludCggd3BiY19taW5fZGF0ZV9hcnJbMV0gKSAtIDEpLCB3cGJjX21pbl9kYXRlX2FyclsyXSwgd3BiY19taW5fZGF0ZV9hcnJbM10sIHdwYmNfbWluX2RhdGVfYXJyWzRdLCAwICk7XHJcblx0XHRsb2NhbF9fbWF4X2RhdGUgPSBudWxsO1xyXG5cdH1cclxuXHJcblx0dmFyIGxvY2FsX19zdGFydF93ZWVrZGF5ICAgID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3N0YXJ0X2RheV93ZWVlaycgKTtcclxuXHR2YXIgbG9jYWxfX251bWJlcl9vZl9tb250aHMgPSBwYXJzZUludCggX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJyApICk7XHJcblxyXG5cdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkudGV4dCggJycgKTtcdFx0XHRcdFx0Ly8gUmVtb3ZlIGFsbCBIVE1MIGluIGNhbGVuZGFyIHRhZ1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2hvdyBjYWxlbmRhclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0alF1ZXJ5KCcjY2FsZW5kYXJfYm9va2luZycrIHJlc291cmNlX2lkKS5kYXRlcGljayhcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGJlZm9yZVNob3dEYXk6IGZ1bmN0aW9uICgganNfZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBqc19kYXRlLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uU2VsZWN0OiBmdW5jdGlvbiAoIHN0cmluZ19kYXRlcywganNfZGF0ZXNfYXJyICl7ICAvKipcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqXHRzdHJpbmdfZGF0ZXMgICA9ICAgJzIzLjA4LjIwMjMgLSAyNi4wOC4yMDIzJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICogICB8ICAgICcyMy4wOC4yMDIzIC0gMjMuMDguMjAyMycgICAgfFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICogJzE5LjA5LjIwMjMsIDI0LjA4LjIwMjMsIDMwLjA5LjIwMjMnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKiBqc19kYXRlc19hcnIgICA9ICAgcmFuZ2U6IFsgRGF0ZSAoQXVnIDIzIDIwMjMpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICogRGF0ZSAoQXVnIDI1IDIwMjMpXSAgICAgfCAgICAgbXVsdGlwbGU6IFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqIERhdGUoT2N0IDI0IDIwMjMpLCBEYXRlKE9jdCAyMCAyMDIzKSwgRGF0ZShPY3RcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqIDE2IDIwMjMpIF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqL1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX29uX3NlbGVjdF9kYXlzKCBzdHJpbmdfZGF0ZXMsIHsncmVzb3VyY2VfaWQnOiByZXNvdXJjZV9pZH0sIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHQgIH0sXHJcblx0XHRcdFx0b25Ib3ZlcjogZnVuY3Rpb24gKCBzdHJpbmdfZGF0ZSwganNfZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMoIHN0cmluZ19kYXRlLCBqc19kYXRlLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uQ2hhbmdlTW9udGhZZWFyOiBmdW5jdGlvbiAoIHllYXIsIHJlYWxfbW9udGgsIGpzX2RhdGVfXzFzdF9kYXlfaW5fbW9udGggKXsgfSxcclxuXHRcdFx0XHRzaG93T24gICAgICAgIDogJ2JvdGgnLFxyXG5cdFx0XHRcdG51bWJlck9mTW9udGhzOiBsb2NhbF9fbnVtYmVyX29mX21vbnRocyxcclxuXHRcdFx0XHRzdGVwTW9udGhzICAgIDogMSxcclxuXHRcdFx0XHQvLyBwcmV2VGV4dCAgICAgIDogJyZsYXF1bzsnLFxyXG5cdFx0XHRcdC8vIG5leHRUZXh0ICAgICAgOiAnJnJhcXVvOycsXHJcblx0XHRcdFx0cHJldlRleHQgICAgICA6ICcmbHNhcXVvOycsXHJcblx0XHRcdFx0bmV4dFRleHQgICAgICA6ICcmcnNhcXVvOycsXHJcblx0XHRcdFx0ZGF0ZUZvcm1hdCAgICA6ICdkZC5tbS55eScsXHJcblx0XHRcdFx0Y2hhbmdlTW9udGggICA6IGZhbHNlLFxyXG5cdFx0XHRcdGNoYW5nZVllYXIgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtaW5EYXRlICAgICAgIDogbG9jYWxfX21pbl9kYXRlLFxyXG5cdFx0XHRcdG1heERhdGUgICAgICAgOiBsb2NhbF9fbWF4X2RhdGUsIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMVknLFxyXG5cdFx0XHRcdC8vIG1pbkRhdGU6IG5ldyBEYXRlKDIwMjAsIDIsIDEpLCBtYXhEYXRlOiBuZXcgRGF0ZSgyMDIwLCA5LCAzMSksICAgICAgICAgICAgIFx0Ly8gQWJpbGl0eSB0byBzZXQgYW55ICBzdGFydCBhbmQgZW5kIGRhdGUgaW4gY2FsZW5kYXJcclxuXHRcdFx0XHRzaG93U3RhdHVzICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtdWx0aVNlcGFyYXRvciAgOiAnLCAnLFxyXG5cdFx0XHRcdGNsb3NlQXRUb3AgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdGZpcnN0RGF5ICAgICAgICA6IGxvY2FsX19zdGFydF93ZWVrZGF5LFxyXG5cdFx0XHRcdGdvdG9DdXJyZW50ICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdGhpZGVJZk5vUHJldk5leHQ6IHRydWUsXHJcblx0XHRcdFx0bXVsdGlTZWxlY3QgICAgIDogbG9jYWxfX211bHRpX2RheXNfc2VsZWN0X251bSxcclxuXHRcdFx0XHRyYW5nZVNlbGVjdCAgICAgOiBsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0LFxyXG5cdFx0XHRcdC8vIHNob3dXZWVrczogdHJ1ZSxcclxuXHRcdFx0XHR1c2VUaGVtZVJvbGxlcjogZmFsc2VcclxuXHRcdFx0fVxyXG5cdCk7XHJcblxyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBDbGVhciB0b2RheSBkYXRlIGhpZ2hsaWdodGluZ1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0c2V0VGltZW91dCggZnVuY3Rpb24gKCl7ICB3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICk7ICB9LCA1MDAgKTsgICAgICAgICAgICAgICAgICAgIFx0Ly8gRml4SW46IDcuMS4yLjguXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2Nyb2xsIGNhbGVuZGFyIHRvICBzcGVjaWZpYyBtb250aFxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHN0YXJ0X2JrX21vbnRoID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9zY3JvbGxfdG8nICk7XHJcblx0aWYgKCBmYWxzZSAhPT0gc3RhcnRfYmtfbW9udGggKXtcclxuXHRcdHdwYmNfY2FsZW5kYXJfX3Njcm9sbF90byggcmVzb3VyY2VfaWQsIHN0YXJ0X2JrX21vbnRoWyAwIF0sIHN0YXJ0X2JrX21vbnRoWyAxIF0gKTtcclxuXHR9XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmcgc3RhdHVzZXMgYXMgYXJyYXkgZnJvbSB0aGUgc3RydWN0dXJlZCBzdW1tYXJ5IGZpZWxkLCB3aXRoIGZhbGxiYWNrIHRvIHRoZSBsZWdhY3kgc3RyaW5nIGZpZWxkLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVfYm9va2luZ3Nfb2JqXHJcblx0ICogQHJldHVybnMge1tdfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X2Jvb2tpbmdfc3RhdHVzZXNfX2FzX2FyciggZGF0ZV9ib29raW5nc19vYmogKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggISBkYXRlX2Jvb2tpbmdzX29iaiApXHJcblx0XHRcdHx8ICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAoZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gW107XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzX2FycicgXSApICl7XHJcblx0XHRcdHJldHVybiBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzX2FycicgXS5maWx0ZXIoIGZ1bmN0aW9uICggYm9va2luZ19zdGF0dXMgKXtcclxuXHRcdFx0XHRyZXR1cm4gJycgIT09IGJvb2tpbmdfc3RhdHVzO1xyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAhIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gKXtcclxuXHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLnRvU3RyaW5nKCkudHJpbSgpLnNwbGl0KCAvXFxzKy8gKS5maWx0ZXIoIGZ1bmN0aW9uICggYm9va2luZ19zdGF0dXMgKXtcclxuXHRcdFx0cmV0dXJuICcnICE9PSBib29raW5nX3N0YXR1cztcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayBleGFjdCBib29raW5nIHN0YXR1cyBpbiBzdGF0dXNlcyBhcnJheS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7W119IGJvb2tpbmdfc3RhdHVzZXNfYXJyXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfc3RhdHVzXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCBib29raW5nX3N0YXR1cyApe1xyXG5cdFx0cmV0dXJuIGJvb2tpbmdfc3RhdHVzZXNfYXJyLmluZGV4T2YoIGJvb2tpbmdfc3RhdHVzICkgPiAtMTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayBib29raW5nIHN0YXR1cyBwYXJ0LCBlLmcuIFwicGVuZGluZ1wiIGluIFwiYXBwcm92ZWRfcGVuZGluZ1wiLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtbXX0gYm9va2luZ19zdGF0dXNlc19hcnJcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gYm9va2luZ19zdGF0dXNfcGFydFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzX3BhcnQoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCBib29raW5nX3N0YXR1c19wYXJ0ICl7XHJcblxyXG5cdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgYm9va2luZ19zdGF0dXNlc19hcnIubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0aWYgKCBib29raW5nX3N0YXR1c2VzX2FyclsgaSBdLnNwbGl0KCAnXycgKS5pbmRleE9mKCBib29raW5nX3N0YXR1c19wYXJ0ICkgPiAtMSApe1xyXG5cdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IENTUyB0byBjYWxlbmRhciBkYXRlIGNlbGxzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHRcdFx0XHRcdFx0LSAgSmF2YVNjcmlwdCBEYXRlIE9iajogIFx0XHRNb24gRGVjIDExIDIwMjMgMDA6MDA6MDBcclxuXHQgKiAgICAgR01UKzAyMDAgKEVhc3Rlcm4gRXVyb3BlYW4gU3RhbmRhcmQgVGltZSlcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0XHRcdFx0XHRcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFx0XHRcdFx0XHRcdFwicmVzb3VyY2VfaWRcIjogNFxyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0XHRcdFx0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKiBAcmV0dXJucyB7KCp8c3RyaW5nKVtdfChib29sZWFufHN0cmluZylbXX1cdFx0LSBbIHt0cnVlIC1hdmFpbGFibGUgfCBmYWxzZSAtIHVuYXZhaWxhYmxlfSwgJ0NTUyBjbGFzc2VzIGZvclxyXG5cdCAqICAgICBjYWxlbmRhciBkYXkgY2VsbCcgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cyggZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApe1xyXG5cclxuXHRcdHZhciB0b2RheV9kYXRlID0gbmV3IERhdGUoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMCBdLCAocGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMSBdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAyIF0sIDAsIDAsIDAgKTtcdFx0XHRcdFx0XHRcdFx0Ly8gVG9kYXkgSlNfRGF0ZV9PYmouXHJcblx0XHR2YXIgY2xhc3NfZGF5ICAgICA9IHdwYmNfX2dldF9fdGRfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcxLTktMjAyMydcclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcyMDIzLTAxLTA5J1xyXG5cdFx0dmFyIHJlc291cmNlX2lkID0gKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSkgKSA/IGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSA6ICcxJzsgXHRcdC8vICcxJ1xyXG5cclxuXHRcdC8vIEdldCBTZWxlY3RlZCBkYXRlcyBpbiBjYWxlbmRhclxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX3NxbCA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyBHZXQgRGF0YSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGRhdGVfYm9va2luZ3Nfb2JqID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblxyXG5cdFx0Ly8gQXJyYXkgd2l0aCBDU1MgY2xhc3NlcyBmb3IgZGF0ZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBjc3NfY2xhc3Nlc19fZm9yX2RhdGUgPSBbXTtcclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc3FsX2RhdGVfJyAgICAgKyBzcWxfY2xhc3NfZGF5ICk7XHRcdFx0XHQvLyAgJ3NxbF9kYXRlXzIwMjMtMDctMjEnXHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NhbDRkYXRlLScgICAgICsgY2xhc3NfZGF5ICk7XHRcdFx0XHRcdC8vICAnY2FsNGRhdGUtNy0yMS0yMDIzJ1xyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd3cGJjX3dlZWtkYXlfJyArIGRhdGUuZ2V0RGF5KCkgKTtcdFx0XHRcdC8vICAnd3BiY193ZWVrZGF5XzQnXHJcblxyXG5cdFx0Ly8gRGVmaW5lIFNlbGVjdGVkIENoZWNrIEluL091dCBkYXRlcyBpbiBURCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGlmIChcclxuXHRcdFx0XHQoIHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggIClcclxuXHRcdFx0Ly8mJiAgKCBzZWxlY3RlZF9kYXRlc19zcWxbIDAgXSAhPT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAoc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCAtIDEpIF0gKVxyXG5cdFx0KXtcclxuXHRcdFx0aWYgKCBzcWxfY2xhc3NfZGF5ID09PSBzZWxlY3RlZF9kYXRlc19zcWxbIDAgXSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfaW4nICk7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19pbl9vdXQnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAgKCBzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoID4gMSApICYmICggc3FsX2NsYXNzX2RheSA9PT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAoc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCAtIDEpIF0gKSApIHtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX291dCcgKTtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX2luX291dCcgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHR2YXIgaXNfZGF5X3NlbGVjdGFibGUgPSBmYWxzZTtcclxuXHJcblx0XHQvLyBJZiBzb21ldGhpbmcgbm90IGRlZmluZWQsICB0aGVuICB0aGlzIGRhdGUgY2xvc2VkIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvLyBGaXhJbjogMTAuMTIuNC42LlxyXG5cdFx0aWYgKCAoZmFsc2UgPT09IGRhdGVfYm9va2luZ3Nfb2JqKSB8fCAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAoZGF0ZV9ib29raW5nc19vYmpbcmVzb3VyY2VfaWRdKSkgKSB7XHJcblxyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHJcblx0XHRcdHJldHVybiBbIGlzX2RheV9zZWxlY3RhYmxlLCBjc3NfY2xhc3Nlc19fZm9yX2RhdGUuam9pbignICcpICBdO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gICBkYXRlX2Jvb2tpbmdzX29iaiAgLSBEZWZpbmVkLiAgICAgICAgICAgIERhdGVzIGNhbiBiZSBzZWxlY3RhYmxlLlxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBib29raW5nX3N0YXR1c2VzX2FyciA9IHdwYmNfZ2V0X2Jvb2tpbmdfc3RhdHVzZXNfX2FzX2FyciggZGF0ZV9ib29raW5nc19vYmogKTtcclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gQWRkIHNlYXNvbiBuYW1lcyB0byB0aGUgZGF5IENTUyBjbGFzc2VzIC0tIGl0IGlzIHJlcXVpcmVkIGZvciBjb3JyZWN0ICB3b3JrICBvZiBjb25kaXRpb25hbCBmaWVsZHMgLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBzZWFzb25fbmFtZXNfYXJyID0gX3dwYmMuc2Vhc29uc19fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApO1xyXG5cclxuXHRcdGZvciAoIHZhciBzZWFzb25fa2V5IGluIHNlYXNvbl9uYW1lc19hcnIgKXtcclxuXHJcblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCBzZWFzb25fbmFtZXNfYXJyWyBzZWFzb25fa2V5IF0gKTtcdFx0XHRcdC8vICAnd3BkZXZia19zZWFzb25fc2VwdGVtYmVyXzIwMjMnXHJcblx0XHR9XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0XHQvLyBDb3N0IFJhdGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdyYXRlXycgKyBkYXRlX2Jvb2tpbmdzX29ialsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVfY29zdF9yYXRlJyBdLnRvU3RyaW5nKCkucmVwbGFjZSggL1tcXC5cXHNdL2csICdfJyApICk7XHRcdFx0XHRcdFx0Ly8gICdyYXRlXzk5XzAwJyAtPiA5OS4wMFxyXG5cclxuXHJcblx0XHRpZiAoIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSA+IDAgKXtcclxuXHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSB0cnVlO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3Jlc2VydmVkX2RheXNfY291bnQnICsgcGFyc2VJbnQoIGRhdGVfYm9va2luZ3Nfb2JqWyAnbWF4X2NhcGFjaXR5JyBdIC0gZGF0ZV9ib29raW5nc19vYmpbICdkYXlfYXZhaWxhYmlsaXR5JyBdICkgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gZmFsc2U7XHJcblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRzd2l0Y2ggKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdGNhc2UgJ2F2YWlsYWJsZSc6XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICd0aW1lX3Nsb3RzX2Jvb2tpbmcnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAndGltZXNwYXJ0bHknLCAndGltZXNfY2xvY2snICk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdmdWxsX2RheV9ib29raW5nJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2Z1bGxfZGF5X2Jvb2tpbmcnICk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdzZWFzb25fZmlsdGVyJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdzZWFzb25fdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0gPSBbXTtcclxuXHRcdFx0XHRib29raW5nX3N0YXR1c2VzX2FyciA9IFtdO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAncmVzb3VyY2VfYXZhaWxhYmlsaXR5JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdyZXNvdXJjZV91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzX2FycicgXSA9IFtdO1xyXG5cdFx0XHRcdGJvb2tpbmdfc3RhdHVzZXNfYXJyID0gW107XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICd3ZWVrZGF5X3VuYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICd3ZWVrZGF5X3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3NfYXJyJyBdID0gW107XHJcblx0XHRcdFx0Ym9va2luZ19zdGF0dXNlc19hcnIgPSBbXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2Zyb21fdG9kYXlfdW5hdmFpbGFibGUnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ2Zyb21fdG9kYXlfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0gPSBbXTtcclxuXHRcdFx0XHRib29raW5nX3N0YXR1c2VzX2FyciA9IFtdO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5JyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3NfYXJyJyBdID0gW107XHJcblx0XHRcdFx0Ym9va2luZ19zdGF0dXNlc19hcnIgPSBbXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2NoYW5nZV9vdmVyJzpcclxuXHRcdFx0XHQvKlxyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0Ly8gIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZSBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlXHJcblx0XHRcdFx0Ly8gIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZSBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdC8vICBjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZSBcdFx0IFx0Y2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkIFx0IFx0Y2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkXHJcblx0XHRcdFx0ICovXHJcblxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAndGltZXNwYXJ0bHknLCAnY2hlY2tfaW5fdGltZScsICdjaGVja19vdXRfdGltZScgKTtcclxuXHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjIuXHJcblx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZF9wZW5kaW5nJyApICl7XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWQnLCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAncGVuZGluZ19hcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2NoZWNrX2luJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX2luX3RpbWUnICk7XHJcblxyXG5cdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4zMy5cclxuXHRcdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzX3BhcnQoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAncGVuZGluZycgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhc19wYXJ0KCBib29raW5nX3N0YXR1c2VzX2FyciwgJ2FwcHJvdmVkJyApICl7XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGVja19vdXQnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAndGltZXNwYXJ0bHknLCAnY2hlY2tfb3V0X3RpbWUnICk7XHJcblxyXG5cdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4zMy5cclxuXHRcdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzX3BhcnQoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAncGVuZGluZycgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXNfcGFydCggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0Ly8gbWl4ZWQgc3RhdHVzZXM6ICdjaGFuZ2Vfb3ZlciBjaGVja19vdXQnIC4uLi4gdmFyaWF0aW9ucy4uLi4gY2hlY2sgbW9yZSBpbiBcdFx0ZnVuY3Rpb24gd3BiY19nZXRfYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FycigpXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdID0gJ2F2YWlsYWJsZSc7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0XHRpZiAoICdhdmFpbGFibGUnICE9IGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSApe1xyXG5cclxuXHRcdFx0dmFyIGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncGVuZGluZ19kYXlzX3NlbGVjdGFibGUnICk7XHQvLyBzZXQgcGVuZGluZyBkYXlzIHNlbGVjdGFibGUgICAgICAgICAgLy8gRml4SW46IDguNi4xLjE4LlxyXG5cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdwZW5kaW5nJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ2FwcHJvdmVkJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAncGVuZGluZ19wZW5kaW5nJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfYXBwcm92ZWQnICkgKXtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScsICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ2FwcHJvdmVkX3BlbmRpbmcnICkgKXtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWQnLCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ2FwcHJvdmVkX2FwcHJvdmVkJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBbIGlzX2RheV9zZWxlY3RhYmxlLCBjc3NfY2xhc3Nlc19fZm9yX2RhdGUuam9pbiggJyAnICkgXTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBNb3VzZW92ZXIgY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHN0cmluZ19kYXRlXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwXHJcblx0ICogICAgIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMoIHN0cmluZ19kYXRlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICkge1xyXG5cclxuXHRcdGlmICggbnVsbCA9PT0gZGF0ZSApIHtcclxuXHRcdFx0d3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMScgKTtcdFx0Ly8gRml4SW46IDEwLjUuMi40LlxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7XHRcdC8vICcxJ1xyXG5cclxuXHRcdC8vIEdldCBEYXRhIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgZGF0ZV9ib29raW5nX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHsuLi59XHJcblxyXG5cdFx0aWYgKCAhIGRhdGVfYm9va2luZ19vYmogKXsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cclxuXHRcdC8vIFQgbyBvIGwgdCBpIHAgcyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgdG9vbHRpcF90ZXh0ID0gJyc7XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYXZhaWxhYmlsaXR5JyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2F2YWlsYWJpbGl0eScgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9ib29raW5nX2RldGFpbHMnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYm9va2luZ19kZXRhaWxzJyBdO1xyXG5cdFx0fVxyXG5cdFx0d3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHJcblx0XHQvLyAgVSBuIGggbyB2IGUgciBpIG4gZyAgICBpbiAgICBVTlNFTEVDVEFCTEVfQ0FMRU5EQVIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciA9ICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmdfdW5zZWxlY3RhYmxlJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCk7XHRcdFx0XHQvLyBGaXhJbjogOC4wLjEuMi5cclxuXHRcdHZhciBpc19ib29raW5nX2Zvcm1fZXhpc3QgICAgPSAoIGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApO1xyXG5cdFx0dmFyIGlzX2FkZF9ib29raW5nX21vZGFsX2NhbGVuZGFyID0gKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmNsb3Nlc3QoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICkubGVuZ3RoID4gMCApO1xyXG5cdFx0dmFyIGlzX2FkbWluX2NhbGVuZGFyX3ByZXZpZXcgPSAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYWRtaW4tY2FsZW5kYXItcHJldmlldz1cIjFcIl0nICkubGVuZ3RoID4gMCApO1xyXG5cclxuXHRcdGlmICggKCBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgKSAmJiAoICEgaXNfYm9va2luZ19mb3JtX2V4aXN0ICkgKXtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiAgVW4gSG92ZXIgYWxsIGRhdGVzIGluIGNhbGVuZGFyICh3aXRob3V0IHRoZSBib29raW5nIGZvcm0pLCBpZiBvbmx5IEF2YWlsYWJpbGl0eSBDYWxlbmRhciBoZXJlIGFuZCB3ZSBkb1xyXG5cdFx0XHQgKiBub3QgaW5zZXJ0IEJvb2tpbmcgZm9ybSBieSBtaXN0YWtlLlxyXG5cdFx0XHQgKi9cclxuXHJcblx0XHRcdHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTsgXHRcdFx0XHRcdFx0XHQvLyBDbGVhciBkYXlzIGhpZ2hsaWdodGluZ1xyXG5cclxuXHRcdFx0dmFyIGNzc19vZl9jYWxlbmRhciA9ICcud3BiY19vbmx5X2NhbGVuZGFyICNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkO1xyXG5cdFx0XHRqUXVlcnkoIGNzc19vZl9jYWxlbmRhciArICcgLmRhdGVwaWNrLWRheXMtY2VsbCwgJ1xyXG5cdFx0XHRcdCAgKyBjc3Nfb2ZfY2FsZW5kYXIgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwgYScgKS5jc3MoICdjdXJzb3InLCAnZGVmYXVsdCcgKTtcdC8vIFNldCBjdXJzb3IgdG8gRGVmYXVsdFxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0XHQvLyAgRCBhIHkgcyAgICBIIG8gdiBlIHIgaSBuIGcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYycgKSA9PSAtMSApXHJcblx0XHRcdHx8ICggKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMnICkgPiAwICkgJiYgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICd0YWI9YWRkLWJvb2tpbmcnICkgPiAwICkgKVxyXG5cdFx0XHR8fCAoIGlzX2FkZF9ib29raW5nX21vZGFsX2NhbGVuZGFyIClcclxuXHRcdFx0fHwgKCBpc19hZG1pbl9jYWxlbmRhcl9wcmV2aWV3IClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtc2V0dXAnICkgPiAwIClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtYXZhaWxhYmlsaXR5JyApID4gMCApXHJcblx0XHRcdHx8ICggICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLXNldHRpbmdzJyApID4gMCApICAmJlxyXG5cdFx0XHRcdCAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICd0YWI9YnVpbGRlcl9ib29raW5nX2Zvcm0nICkgPiAwIClcclxuXHRcdFx0ICAgKVxyXG5cdFx0KXtcclxuXHRcdFx0Ly8gVGhlIHNhbWUgYXMgZGF0ZXMgc2VsZWN0aW9uLCAgYnV0IGZvciBkYXlzIGhvdmVyaW5nXHJcblxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT0gdHlwZW9mKCB3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19oaWdobGlnaHRfX2JzICkgKXtcclxuXHRcdFx0XHR3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19oaWdobGlnaHRfX2JzKCBzcWxfY2xhc3NfZGF5LCBkYXRlLCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApIHtcclxuXHRcdFx0XHR3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19oaWdobGlnaHRfX3VucmVzdHJpY3RlZF9yYW5nZSggc3FsX2NsYXNzX2RheSwgZGF0ZSwgcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBIaWdobGlnaHQgYW4gdW5yZXN0cmljdGVkIHByb3Bvc2VkIHJhbmdlIGFmdGVyIHRoZSBmaXJzdCBjbGljayB3aGVuIEJ1c2luZXNzIFNtYWxsIGlzIG5vdCBsb2FkZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheSBIb3ZlcmVkIGRhdGUgaW4gU1FMIGZvcm1hdC5cclxuXHQgKiBAcGFyYW0ge0RhdGV9IGRhdGUgSG92ZXJlZCBkYXRlLlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjb21wbGV0ZSBwcm9wb3NlZCByYW5nZSBpcyBhdmFpbGFibGUgYW5kIGhpZ2hsaWdodGVkLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX2hpZ2hsaWdodF9fdW5yZXN0cmljdGVkX3JhbmdlKCBzcWxfY2xhc3NfZGF5LCBkYXRlLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHR2YXIgcmFuZ2Vfc3RhcnQ7XHJcblx0XHR2YXIgcmFuZ2VfZW5kO1xyXG5cdFx0dmFyIHdvcmtpbmdfZGF0ZTtcclxuXHRcdHZhciB0ZF9vdmVycyA9IFtdO1xyXG5cclxuXHRcdHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgIG51bGwgPT09IGluc3RcclxuXHRcdFx0fHwgJ2R5bmFtaWMnICE9PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnIClcclxuXHRcdCkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQmVmb3JlIGEgcmFuZ2Ugc3RhcnRzLCBvciBhZnRlciBpdCBpcyBjb21wbGV0ZSwgcHJldmlldyB0aGUgaG92ZXJlZCBkYXRlIGFzIHRoZSBwb3NzaWJsZSBmaXJzdCBkYXkuXHJcblx0XHRpZiAoIDEgIT09IGluc3QuZGF0ZXMubGVuZ3RoIHx8ICEgaW5zdC5kYXRlc1sgMCBdICkge1xyXG5cdFx0XHRpZiAoICEgd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5jYWw0ZGF0ZS0nICsgd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICkgKVxyXG5cdFx0XHRcdC5hZGRDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyYW5nZV9zdGFydCA9IG5ldyBEYXRlKCBpbnN0LmRhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSwgaW5zdC5kYXRlc1sgMCBdLmdldE1vbnRoKCksIGluc3QuZGF0ZXNbIDAgXS5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHRcdHJhbmdlX2VuZCAgID0gbmV3IERhdGUoIGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cclxuXHRcdC8vIERhdGVwaWNrIG9ubHkgcGVybWl0cyBhIGNoZWNrLW91dCBkYXRlIG9uL2FmdGVyIHRoZSBmaXJzdCBjbGljay4gRG8gbm90IHByZXZpZXcgYSBiYWNrd2FyZCByYW5nZS5cclxuXHRcdGlmICggcmFuZ2VfZW5kLmdldFRpbWUoKSA8IHJhbmdlX3N0YXJ0LmdldFRpbWUoKSApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdvcmtpbmdfZGF0ZSA9IG5ldyBEYXRlKCByYW5nZV9zdGFydC5nZXRUaW1lKCkgKTtcclxuXHRcdHdoaWxlICggd29ya2luZ19kYXRlLmdldFRpbWUoKSA8PSByYW5nZV9lbmQuZ2V0VGltZSgpICkge1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggd29ya2luZ19kYXRlICk7XHJcblx0XHRcdGlmICggISB3cGJjX2lzX3RoaXNfZGF5X3NlbGVjdGFibGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0ZF9vdmVycy5wdXNoKCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5jYWw0ZGF0ZS0nICsgd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCB3b3JraW5nX2RhdGUgKSApO1xyXG5cdFx0XHR3b3JraW5nX2RhdGUuc2V0RGF0ZSggd29ya2luZ19kYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHRkX292ZXJzLmxlbmd0aCApIHtcclxuXHRcdFx0alF1ZXJ5KCB0ZF9vdmVycy5qb2luKCAnLCcgKSApLmFkZENsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ29tcGxldGUgYW4gdW5yZXN0cmljdGVkIHR3by1jbGljayByYW5nZSB3aGVuIHRoZSBCdXNpbmVzcyBTbWFsbCByYW5nZSBlbmdpbmUgaXMgbm90IGxvYWRlZC5cclxuXHQgKiBUaGUgaGlkZGVuIGJvb2tpbmcgZmllbGQgbXVzdCBjb250YWluIGV2ZXJ5IGRhdGUgYmVjYXVzZSBGcmVlIHRpbWUvaGludCBoYW5kbGVycyBjb25zdW1lIGEgY29tbWEtc2VwYXJhdGVkIGxpc3QuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0ZWRfZGF0ZXMgRGF0ZXBpY2sncyBlbmRwb2ludCBzdHJpbmcuXHJcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGFmdGVyIGEgY29tcGxldGUgdmFsaWQgcmFuZ2UsIGZhbHNlIHdoaWxlIGluY29tcGxldGUgb3IgaW52YWxpZC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19zZWxlY3RfX3VucmVzdHJpY3RlZF9yYW5nZSggc2VsZWN0ZWRfZGF0ZXMsIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHRcdHZhciByYW5nZV9zdGFydDtcclxuXHRcdHZhciByYW5nZV9lbmQ7XHJcblx0XHR2YXIgY3VycmVudF9kYXRlO1xyXG5cdFx0dmFyIHNlbGVjdGVkX3JhbmdlID0gW107XHJcblxyXG5cdFx0aWYgKCBudWxsID09PSBpbnN0ICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRGF0ZXBpY2sgd3JpdGVzIFwic3RhcnQgLSBzdGFydFwiIGFmdGVyIGNsaWNrIG9uZS4gS2VlcCBpdHMgaW50ZXJuYWwgZW5kcG9pbnQsIGJ1dCBkbyBub3QgZXhwb3NlIGEgc3VibWl0dGFibGUgcmFuZ2UgeWV0LlxyXG5cdFx0aWYgKCB0cnVlID09PSBpbnN0LnN0YXlPcGVuIHx8IGluc3QuZGF0ZXMubGVuZ3RoIDwgMiB8fCAhIGluc3QuZGF0ZXNbIDAgXSB8fCAhIGluc3QuZGF0ZXNbIDEgXSApIHtcclxuXHRcdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJhbmdlX3N0YXJ0ID0gbmV3IERhdGUoIGluc3QuZGF0ZXNbIDAgXS5nZXRGdWxsWWVhcigpLCBpbnN0LmRhdGVzWyAwIF0uZ2V0TW9udGgoKSwgaW5zdC5kYXRlc1sgMCBdLmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cdFx0cmFuZ2VfZW5kICAgPSBuZXcgRGF0ZSggaW5zdC5kYXRlc1sgMSBdLmdldEZ1bGxZZWFyKCksIGluc3QuZGF0ZXNbIDEgXS5nZXRNb250aCgpLCBpbnN0LmRhdGVzWyAxIF0uZ2V0RGF0ZSgpLCAwLCAwLCAwICk7XHJcblxyXG5cdFx0Ly8gRGVmZW5zaXZlIG5vcm1hbGl6YXRpb24uIERhdGVwaWNrIG5vcm1hbGx5IHByZXZlbnRzIGFuIGVuZCBkYXRlIGJlZm9yZSB0aGUgZmlyc3QgZW5kcG9pbnQuXHJcblx0XHRpZiAoIHJhbmdlX2VuZC5nZXRUaW1lKCkgPCByYW5nZV9zdGFydC5nZXRUaW1lKCkgKSB7XHJcblx0XHRcdGN1cnJlbnRfZGF0ZSA9IHJhbmdlX3N0YXJ0O1xyXG5cdFx0XHRyYW5nZV9zdGFydCA9IHJhbmdlX2VuZDtcclxuXHRcdFx0cmFuZ2VfZW5kID0gY3VycmVudF9kYXRlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGN1cnJlbnRfZGF0ZSA9IG5ldyBEYXRlKCByYW5nZV9zdGFydC5nZXRUaW1lKCkgKTtcclxuXHRcdHdoaWxlICggY3VycmVudF9kYXRlLmdldFRpbWUoKSA8PSByYW5nZV9lbmQuZ2V0VGltZSgpICkge1xyXG5cdFx0XHRpZiAoICEgd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggY3VycmVudF9kYXRlICkgKSApIHtcclxuXHRcdFx0XHR3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICk7XHJcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKCB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nICkgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKFxyXG5cdFx0XHRcdFx0XHQnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIC5ia19jYWxlbmRhcl9mcmFtZScsXHJcblx0XHRcdFx0XHRcdF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9yYW5nZV9zZWxlY3Rpb25faGFzX3VuYXZhaWxhYmxlX2RhdGVzJyApLFxyXG5cdFx0XHRcdFx0XHQndGV4dCdcclxuXHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2VsZWN0ZWRfcmFuZ2UucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9mb3JtYXREYXRlKCBpbnN0LCBjdXJyZW50X2RhdGUgKSApO1xyXG5cdFx0XHRjdXJyZW50X2RhdGUuc2V0RGF0ZSggY3VycmVudF9kYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHJcblx0XHRqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCBzZWxlY3RlZF9yYW5nZS5qb2luKCAnLCAnICkgKTtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSB0aGUgcmFuZ2Utc2VsZWN0aW9uIGd1aWRhbmNlIGJlbG9uZ2luZyB0byBvbmUgY2FsZW5kYXIuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19yYW5nZV9zZWxlY3Rpb25fX2hpZGVfZ3VpZGFuY2UoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjd3BiY19yYW5nZV9zZWxlY3Rpb25fZ3VpZGFuY2UnICsgcmVzb3VyY2VfaWQgKS5yZW1vdmUoKTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTaG93IGEgcGVyc2lzdGVudCBpbmZvcm1hdGlvbmFsIG5vdGUgYWZ0ZXIgdGhlIGZpcnN0IHJhbmdlIGNsaWNrLlxyXG5cdCAqIFRoZSBjYWxlbmRhciBwYXJhbWV0ZXIgY2FuIGJlIHNldCB0byBmYWxzZSBieSBQSFAgb3IgSmF2YVNjcmlwdCB0byBzdXBwcmVzcyB0aGlzIFVJIHBlciByZXNvdXJjZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBub3RlIHdhcyBpbnNlcnRlZC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3JhbmdlX3NlbGVjdGlvbl9fc2hvd19ndWlkYW5jZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHR2YXIgaXNfZW5hYmxlZCA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncmFuZ2Vfc2VsZWN0aW9uX2d1aWRhbmNlX2lzX2VuYWJsZWQnICk7XHJcblx0XHR2YXIgJGJvb2tpbmdfZm9ybSA9IGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICk7XHJcblx0XHR2YXIgJGNhbGVuZGFyX2ZyYW1lO1xyXG5cdFx0dmFyICRub3RlO1xyXG5cclxuXHRcdHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19oaWRlX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgZmFsc2UgPT09IGlzX2VuYWJsZWRcclxuXHRcdFx0fHwgMCA9PT0gaXNfZW5hYmxlZFxyXG5cdFx0XHR8fCAnMCcgPT09IGlzX2VuYWJsZWRcclxuXHRcdFx0fHwgJ29mZicgPT09IFN0cmluZyggaXNfZW5hYmxlZCApLnRvTG93ZXJDYXNlKClcclxuXHRcdFx0fHwgJ2ZhbHNlJyA9PT0gU3RyaW5nKCBpc19lbmFibGVkICkudG9Mb3dlckNhc2UoKVxyXG5cdFx0XHR8fCAnZHluYW1pYycgIT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKVxyXG5cdFx0XHR8fCAwID09PSAkYm9va2luZ19mb3JtLmxlbmd0aFxyXG5cdFx0KSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQkY2FsZW5kYXJfZnJhbWUgPSAkYm9va2luZ19mb3JtLmZpbmQoICcuYmxvY2tfaGludHMuZGF0ZXBpY2snICkuZmlyc3QoKTtcclxuXHRcdGlmICggMCA9PT0gJGNhbGVuZGFyX2ZyYW1lLmxlbmd0aCApIHtcclxuXHRcdFx0JGNhbGVuZGFyX2ZyYW1lID0gJGJvb2tpbmdfZm9ybS5maW5kKCAnLndwYmNfY2FsX3Bvd2VyZWRfYnknICkuZmlyc3QoKTtcclxuXHRcdFx0aWYgKCAwID09PSAkY2FsZW5kYXJfZnJhbWUubGVuZ3RoICkge1xyXG5cdFx0XHRcdCRjYWxlbmRhcl9mcmFtZSA9ICRib29raW5nX2Zvcm0uZmluZCggJy5ia19jYWxlbmRhcl9mcmFtZScgKS5maXJzdCgpO1xyXG5cdFx0XHRcdGlmICggMCA9PT0gJGNhbGVuZGFyX2ZyYW1lLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQkbm90ZSA9IGpRdWVyeSggJzxkaXY+Jywge1xyXG5cdFx0XHQnaWQnOiAnd3BiY19yYW5nZV9zZWxlY3Rpb25fZ3VpZGFuY2UnICsgcmVzb3VyY2VfaWQsXHJcblx0XHRcdCdjbGFzcyc6ICd3cGJjX3JhbmdlX3NlbGVjdGlvbl9ndWlkYW5jZSB3cGJjX2Zyb250X2VuZF9fbWVzc2FnZSB3cGJjX2ZlX21lc3NhZ2VfaW5mbycsXHJcblx0XHRcdCdyb2xlJzogJ3N0YXR1cycsXHJcblx0XHRcdCdhcmlhLWxpdmUnOiAncG9saXRlJ1xyXG5cdFx0fSApO1xyXG5cdFx0JG5vdGUuYXBwZW5kKCBqUXVlcnkoICc8aT4nLCB7XHJcblx0XHRcdCdjbGFzcyc6ICdtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9pbmZvX291dGxpbmUnLFxyXG5cdFx0XHQnYXJpYS1oaWRkZW4nOiAndHJ1ZSdcclxuXHRcdH0gKSApO1xyXG5cdFx0JG5vdGUuYXBwZW5kKCBqUXVlcnkoICc8c3Bhbj4nICkudGV4dCggX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX3JhbmdlX3NlbGVjdGlvbl9jbGlja19sYXN0X2RhdGUnICkgKSApO1xyXG5cdFx0JGNhbGVuZGFyX2ZyYW1lLmFmdGVyKCAkbm90ZSApO1xyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFN5bmNocm9uaXplIHRoZSBndWlkYW5jZSB3aXRoIERhdGVwaWNrJ3MgdHdvLWNsaWNrIHJhbmdlIHN0YXRlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19zeW5jX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICBudWxsICE9PSBpbnN0XHJcblx0XHRcdCYmICdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApXHJcblx0XHRcdCYmIHRydWUgPT09IGluc3Quc3RheU9wZW5cclxuXHRcdFx0JiYgMSA9PT0gaW5zdC5kYXRlcy5sZW5ndGhcclxuXHRcdFx0JiYgaW5zdC5kYXRlc1sgMCBdXHJcblx0XHQpIHtcclxuXHRcdFx0d3BiY19yYW5nZV9zZWxlY3Rpb25fX3Nob3dfZ3VpZGFuY2UoIHJlc291cmNlX2lkICk7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR3cGJjX3JhbmdlX3NlbGVjdGlvbl9faGlkZV9ndWlkYW5jZSggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTZWxlY3QgY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwXHJcblx0ICogICAgIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fb25fc2VsZWN0X2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSApID8gY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdIDogJzEnO1x0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBTZXQgdW5zZWxlY3RhYmxlLCAgaWYgb25seSBBdmFpbGFiaWxpdHkgQ2FsZW5kYXIgIGhlcmUgKGFuZCB3ZSBkbyBub3QgaW5zZXJ0IEJvb2tpbmcgZm9ybSBieSBtaXN0YWtlKS5cclxuXHRcdHZhciBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgPSAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZScgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDApO1x0XHRcdFx0Ly8gRml4SW46IDguMC4xLjIuXHJcblx0XHR2YXIgaXNfYm9va2luZ19mb3JtX2V4aXN0ICAgID0gKCBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDAgKTtcclxuXHRcdGlmICggKCBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgKSAmJiAoICEgaXNfYm9va2luZ19mb3JtX2V4aXN0ICkgKXtcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gVW5zZWxlY3QgRGF0ZXNcclxuXHRcdFx0alF1ZXJ5KCcud3BiY19vbmx5X2NhbGVuZGFyIC5wb3BvdmVyX2NhbGVuZGFyX2hvdmVyJykucmVtb3ZlKCk7ICAgICAgICAgICAgICAgICAgICAgIFx0XHRcdFx0XHRcdFx0Ly8gSGlkZSBhbGwgb3BlbmVkIHBvcG92ZXJzXHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBBZGQgc2VsZWN0ZWQgZGF0ZXMgdG8gIGhpZGRlbiB0ZXh0YXJlYVxyXG5cclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19fY2FsZW5kYXJfX2RvX2RheXNfc2VsZWN0X19icykgKSB7XHJcblx0XHRcdHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMoIGRhdGUsIHJlc291cmNlX2lkICk7XHJcblx0XHR9IGVsc2UgaWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApIHtcclxuXHRcdFx0d3BiY19fY2FsZW5kYXJfX2RvX2RheXNfc2VsZWN0X191bnJlc3RyaWN0ZWRfcmFuZ2UoIGRhdGUsIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19yYW5nZV9zZWxlY3Rpb25fX3N5bmNfZ3VpZGFuY2UoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0d3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyBIb29rIC0tIHRyaWdnZXIgZGF5IHNlbGVjdGlvbiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIG1vdXNlX2NsaWNrZWRfZGF0ZXMgPSBkYXRlO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQ2FuIGJlOiBcIjA1LjEwLjIwMjMgLSAwNy4xMC4yMDIzXCIgIHwgIFwiMTAuMTAuMjAyMyAtIDEwLjEwLjIwMjNcIiAgfFxyXG5cdFx0dmFyIGFsbF9zZWxlY3RlZF9kYXRlc19hcnIgPSB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICk7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQ2FuIGJlOiBbIFwiMjAyMy0xMC0wNVwiLCBcIjIwMjMtMTAtMDZcIiwgXCIyMDIzLTEwLTA3XCIsIOKApiBdXHJcblx0XHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLnRyaWdnZXIoIFwiZGF0ZV9zZWxlY3RlZFwiLCBbIHJlc291cmNlX2lkLCBtb3VzZV9jbGlja2VkX2RhdGVzLCBhbGxfc2VsZWN0ZWRfZGF0ZXNfYXJyIF0gKTtcclxuXHR9XHJcblxyXG5cdC8vIE1hcmsgbWlkZGxlIHNlbGVjdGVkIGRhdGVzIHdpdGggMC41IG9wYWNpdHlcdFx0Ly8gRml4SW46IDEwLjMuMC45LlxyXG5cdGpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCl7XHJcblx0XHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLm9uKCAnZGF0ZV9zZWxlY3RlZCcsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBkYXRlICl7XHJcblx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0ICAgKCAgJ2ZpeGVkJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApKVxyXG5cdFx0XHRcdFx0fHwgKCdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApKVxyXG5cdFx0XHRcdCl7XHJcblx0XHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdHZhciBtaWRkbGVfZGF5c19vcGFjaXR5ID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnY2FsZW5kYXJzX19kYXlzX3NlbGVjdGlvbl9fbWlkZGxlX2RheXNfb3BhY2l0eScgKTtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5kYXRlcGljay1jdXJyZW50LWRheScgKS5ub3QoIFwiLnNlbGVjdGVkX2NoZWNrX2luX291dFwiICkuY3NzKCAnb3BhY2l0eScsIG1pZGRsZV9kYXlzX29wYWNpdHkgKTtcclxuXHRcdFx0XHRcdH0sIDEwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdH0gKTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIC0tICBUIGkgbSBlICAgIEYgaSBlIGwgZCBzICAgICBzdGFydCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKi9cclxuXHJcblx0LyoqXHJcblx0ICogRGlzYWJsZSB0aW1lIHNsb3RzIGluIGJvb2tpbmcgZm9ybSBkZXBlbmQgb24gc2VsZWN0ZWQgZGF0ZXMgYW5kIGJvb2tlZCBkYXRlcy90aW1lc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFx0MS4gR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0XHQgKiBcdFx0XHRcdFx0W1xyXG5cdFx0ICogXHRcdFx0XHRcdCBcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCAtIDA2OjMwJ1xyXG5cdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHQgKiBcdFx0XHRcdFx0XHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCdcclxuXHRcdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXVxyXG5cdFx0ICovXHJcblx0XHR2YXIgdGltZV9maWVsZHNfb2JqX2FyciA9IHdwYmNfZ2V0X190aW1lX2ZpZWxkc19faW5fYm9va2luZ19mb3JtX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gMi4gR2V0IGFsbCBzZWxlY3RlZCBkYXRlcyBpbiAgU1FMIGZvcm1hdCAgbGlrZSB0aGlzIFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiLCBcIjIwMjMtMDgtMjVcIiwgLi4uIF1cclxuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19hcnIgPSB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gMy4gR2V0IGNoaWxkIGJvb2tpbmcgcmVzb3VyY2VzICBvciBzaW5nbGUgYm9va2luZyByZXNvdXJjZSAgdGhhdCAgZXhpc3QgIGluIGRhdGVzXHJcblx0XHR2YXIgY2hpbGRfcmVzb3VyY2VzX2FyciA9IHdwYmNfY2xvbmVfb2JqKCBfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnICkgKTtcclxuXHJcblx0XHR2YXIgc3FsX2RhdGU7XHJcblx0XHR2YXIgY2hpbGRfcmVzb3VyY2VfaWQ7XHJcblx0XHR2YXIgbWVyZ2VkX3NlY29uZHM7XHJcblx0XHR2YXIgdGltZV9maWVsZHNfb2JqO1xyXG5cdFx0dmFyIGlzX2ludGVyc2VjdDtcclxuXHRcdHZhciBpc19jaGVja19pbjtcclxuXHJcblx0XHR2YXIgdG9kYXlfdGltZV9fcmVhbCAgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbMF0sICggcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzFdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbMl0sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzNdLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVs0XSwgMCApO1xyXG5cdFx0dmFyIHRvZGF5X3RpbWVfX3NoaWZ0ID0gbmV3IERhdGUoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgICAgICApWzBdLCAoIHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICAgICAgJ3RvZGF5X2FycicgKVsxXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgICAgICApWzJdLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVszXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbNF0sIDAgKTtcclxuXHRcdHZhciBhbGxvd19wYXN0X2NvbnRleHQgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYWxsb3dfcGFzdCcgKTtcclxuXHRcdHZhciBlZGl0X2Jvb2tpbmdfaGFzaF9jb250ZXh0ID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2Jvb2tpbmdfaGFzaCcgKTtcclxuXHRcdHZhciBpc19hbGxvd19wYXN0X2NvbnRleHQgPVxyXG5cdFx0XHQgICAoICcxJyA9PT0gU3RyaW5nKCBhbGxvd19wYXN0X2NvbnRleHQgKSApXHJcblx0XHRcdHx8ICggMSA9PT0gYWxsb3dfcGFzdF9jb250ZXh0IClcclxuXHRcdFx0fHwgKCB0cnVlID09PSBhbGxvd19wYXN0X2NvbnRleHQgKVxyXG5cdFx0XHR8fCAoICcnICE9PSBTdHJpbmcoIGVkaXRfYm9va2luZ19oYXNoX2NvbnRleHQgfHwgJycgKSApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAnYm9va2luZ19oYXNoJyApID4gLTEgKVxyXG5cdFx0XHR8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ2FsbG93X3Bhc3QnICkgPiAtMSApO1xyXG5cclxuXHRcdC8vIDQuIExvb3AgIGFsbCAgdGltZSBGaWVsZHMgb3B0aW9uc1x0XHQvLyBGaXhJbjogMTAuMy4wLjIuXHJcblx0XHRmb3IgKCBsZXQgZmllbGRfa2V5ID0gMDsgZmllbGRfa2V5IDwgdGltZV9maWVsZHNfb2JqX2Fyci5sZW5ndGg7IGZpZWxkX2tleSsrICl7XHJcblxyXG5cdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXS5kaXNhYmxlZCA9IDA7ICAgICAgICAgIC8vIEJ5IGRlZmF1bHQsIHRoaXMgdGltZSBmaWVsZCBpcyBub3QgZGlzYWJsZWQuXHJcblxyXG5cdFx0XHR0aW1lX2ZpZWxkc19vYmogPSB0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXTtcdFx0Ly8geyB0aW1lc19hc19zZWNvbmRzOiBbIDIxNjAwLCAyMzQwMCBdLCB2YWx1ZV9vcHRpb25fMjRoOiAnMDY6MDAgLSAwNjozMCcsIG5hbWU6ICdyYW5nZXRpbWUyW10nLCBqcXVlcnlfb3B0aW9uOiBqUXVlcnlfT2JqZWN0IHt9fVxyXG5cclxuXHRcdFx0Ly8gTG9vcCAgYWxsICBzZWxlY3RlZCBkYXRlcy5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICkge1xyXG5cclxuXHRcdFx0XHQvLyBHZXQgRGF0ZTogJzIwMjMtMDgtMTgnLlxyXG5cdFx0XHRcdHNxbF9kYXRlID0gc2VsZWN0ZWRfZGF0ZXNfYXJyW2ldO1xyXG5cclxuXHRcdFx0XHR2YXIgaXNfdGltZV9pbl9wYXN0ID0gaXNfYWxsb3dfcGFzdF9jb250ZXh0ID8gZmFsc2UgOiB3cGJjX2NoZWNrX2lzX3RpbWVfaW5fcGFzdCggdG9kYXlfdGltZV9fc2hpZnQsIHNxbF9kYXRlLCB0aW1lX2ZpZWxkc19vYmogKTtcclxuXHRcdFx0XHQvLyBFeGNlcHRpb24gIGZvciAnRW5kIFRpbWUnIGZpZWxkLCAgd2hlbiAgc2VsZWN0ZWQgc2V2ZXJhbCBkYXRlcy4gLy8gRml4SW46IDEwLjE0LjEuNS5cclxuXHRcdFx0XHRpZiAoICggISBpc19hbGxvd19wYXN0X2NvbnRleHQgKSAmJlxyXG5cdFx0XHRcdFx0KCdPbicgIT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19yZWN1cnJlbnRfdGltZScgKSkgJiZcclxuXHRcdFx0XHRcdCgtMSAhPT0gdGltZV9maWVsZHNfb2JqLm5hbWUuaW5kZXhPZiggJ2VuZHRpbWUnICkpICYmXHJcblx0XHRcdFx0XHQoc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aCA+IDEpXHJcblx0XHRcdFx0KSB7XHJcblx0XHRcdFx0XHRpc190aW1lX2luX3Bhc3QgPSB3cGJjX2NoZWNrX2lzX3RpbWVfaW5fcGFzdCggdG9kYXlfdGltZV9fc2hpZnQsIHNlbGVjdGVkX2RhdGVzX2Fyclsoc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aCAtIDEpXSwgdGltZV9maWVsZHNfb2JqICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggaXNfdGltZV9pbl9wYXN0ICkge1xyXG5cdFx0XHRcdFx0Ly8gVGhpcyB0aW1lIGZvciBzZWxlY3RlZCBkYXRlIGFscmVhZHkgIGluIHRoZSBwYXN0LlxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2FycltmaWVsZF9rZXldLmRpc2FibGVkID0gMTtcclxuXHRcdFx0XHRcdGJyZWFrO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBleGlzdCAgZnJvbSAgIERhdGVzIExPT1AuXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4zMS5cclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHQgICAoICdPZmYnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2Jvb2tpbmdfcmVjdXJyZW50X3RpbWUnICkgKVxyXG5cdFx0XHRcdFx0JiYgKCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoPjEgKVxyXG5cdFx0XHRcdCl7XHJcblx0XHRcdFx0XHQvL1RPRE86IHNraXAgc29tZSBmaWVsZHMgY2hlY2tpbmcgaWYgaXQncyBzdGFydCAvIGVuZCB0aW1lIGZvciBtdWxwbGUgZGF0ZXMgIHNlbGVjdGlvbiAgbW9kZS5cclxuXHRcdFx0XHRcdC8vVE9ETzogd2UgbmVlZCB0byBmaXggc2l0dWF0aW9uICBmb3IgZW50aW1lcywgIHdoZW4gIHVzZXIgIHNlbGVjdCAgc2V2ZXJhbCAgZGF0ZXMsICBhbmQgaW4gc3RhcnQgIHRpbWUgYm9va2VkIDAwOjAwIC0gMTU6MDAgLCBidXQgc3lzdHNtZSBibG9jayB1bnRpbGwgMTU6MDAgdGhlIGVuZCB0aW1lIGFzIHdlbGwsICB3aGljaCAgaXMgd3JvbmcsICBiZWNhdXNlIGl0IDIgb3IgMyBkYXRlcyBzZWxlY3Rpb24gIGFuZCBlbmQgZGF0ZSBjYW4gYmUgZnVsbHUgIGF2YWlsYWJsZVxyXG5cclxuXHRcdFx0XHRcdGlmICggKDAgPT0gaSkgJiYgKHRpbWVfZmllbGRzX29ialsgJ25hbWUnIF0uaW5kZXhPZiggJ2VuZHRpbWUnICkgPj0gMCkgKXtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoICggKHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGgtMSkgPT0gaSApICYmICh0aW1lX2ZpZWxkc19vYmpbICduYW1lJyBdLmluZGV4T2YoICdzdGFydHRpbWUnICkgPj0gMCkgKXtcclxuXHRcdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHJcblxyXG5cdFx0XHRcdHZhciBob3dfbWFueV9yZXNvdXJjZXNfaW50ZXJzZWN0ZWQgPSAwO1xyXG5cdFx0XHRcdC8vIExvb3AgYWxsIHJlc291cmNlcyBJRFxyXG5cdFx0XHRcdFx0Ly8gZm9yICggdmFyIHJlc19rZXkgaW4gY2hpbGRfcmVzb3VyY2VzX2FyciApe1x0IFx0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4zLjAuMi5cclxuXHRcdFx0XHRpZiAoIG51bGwgPT09IGNoaWxkX3Jlc291cmNlc19hcnIgKSB7XHJcblx0XHRcdFx0XHRjaGlsZF9yZXNvdXJjZXNfYXJyID0gW107XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGZvciAoIGxldCByZXNfa2V5ID0gMDsgcmVzX2tleSA8IGNoaWxkX3Jlc291cmNlc19hcnIubGVuZ3RoOyByZXNfa2V5KysgKXtcclxuXHJcblx0XHRcdFx0XHRjaGlsZF9yZXNvdXJjZV9pZCA9IGNoaWxkX3Jlc291cmNlc19hcnJbIHJlc19rZXkgXTtcclxuXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHNcdFx0PSBbIFwiMDc6MDA6MTEgLSAwNzozMDowMlwiLCBcIjEwOjAwOjExIC0gMDA6MDA6MDBcIiBdXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1x0XHRcdD0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cclxuXHRcdFx0XHRcdGlmICggZmFsc2UgIT09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSApICl7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9kYXRlIClbIGNoaWxkX3Jlc291cmNlX2lkIF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHM7XHRcdC8vIFsgIFsgMjUyMTEsIDI3MDAyIF0sIFsgMzYwMTEsIDg2NDAwIF0gIF1cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gW107XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzLmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX3JhbmdlX3RpbWVfaW50ZXJ2YWwoICBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1swXSApICsgMjAgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1sxXSApIC0gMjAgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIG1lcmdlZF9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpc19jaGVja19pbiA9ICgtMSAhPT0gdGltZV9maWVsZHNfb2JqLm5hbWUuaW5kZXhPZiggJ3N0YXJ0JyApKTtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX29uZV90aW1lX2ludGVydmFsKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KCAoIGlzX2NoZWNrX2luIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSArIDIwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIDogcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgLSAyMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBtZXJnZWRfc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGlzX2ludGVyc2VjdCl7XHJcblx0XHRcdFx0XHRcdGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCsrO1x0XHRcdC8vIEluY3JlYXNlXHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBjaGlsZF9yZXNvdXJjZXNfYXJyLmxlbmd0aCA9PSBob3dfbWFueV9yZXNvdXJjZXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdFx0XHQvLyBBbGwgcmVzb3VyY2VzIGludGVyc2VjdGVkLCAgdGhlbiAgaXQncyBtZWFucyB0aGF0IHRoaXMgdGltZS1zbG90IG9yIHRpbWUgbXVzdCAgYmUgIERpc2FibGVkLCBhbmQgd2UgY2FuICBleGlzdCAgZnJvbSAgIHNlbGVjdGVkX2RhdGVzX2FyciBMT09QXHJcblxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2FyclsgZmllbGRfa2V5IF0uZGlzYWJsZWQgPSAxO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGV4aXN0ICBmcm9tICAgRGF0ZXMgTE9PUFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyA1LiBOb3cgd2UgY2FuIGRpc2FibGUgdGltZSBzbG90IGluIEhUTUwgYnkgIHVzaW5nICAoIGZpZWxkLmRpc2FibGVkID09IDEgKSBwcm9wZXJ0eVxyXG5cdFx0d3BiY19faHRtbF9fdGltZV9maWVsZF9vcHRpb25zX19zZXRfZGlzYWJsZWQoIHRpbWVfZmllbGRzX29ial9hcnIgKTtcclxuXHJcblx0XHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLnRyaWdnZXIoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkJywgW3Jlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlc19hcnJdICk7XHRcdFx0XHRcdC8vIFRyaWdnZXIgaG9vayBvbiBkaXNhYmxpbmcgdGltZXNsb3RzLlx0XHRVc2FnZTogXHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLm9uKCAnd3BiY19ob29rX3RpbWVzbG90c19kaXNhYmxlZCcsIGZ1bmN0aW9uICggZXZlbnQsIGJrX3R5cGUsIGFsbF9kYXRlcyApeyAuLi4gfSApO1x0XHQvLyBGaXhJbjogOC43LjExLjkuXHJcblx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIGlmIHNwZWNpZmljIHRpbWUoLXNsb3QpIGFscmVhZHkgIGluIHRoZSBwYXN0IGZvciBzZWxlY3RlZCBkYXRlXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIGpzX2N1cnJlbnRfdGltZV90b19jaGVja1x0XHQtIEpTIERhdGVcclxuXHRcdCAqIEBwYXJhbSBzcWxfZGF0ZVx0XHRcdFx0XHRcdC0gJzIwMjUtMDEtMjYnXHJcblx0XHQgKiBAcGFyYW0gdGltZV9maWVsZHNfb2JqXHRcdFx0XHQtIE9iamVjdFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0KCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2ssIHNxbF9kYXRlLCB0aW1lX2ZpZWxkc19vYmogKSB7XHJcblxyXG5cdFx0XHQvLyBGaXhJbjogMTAuOS42LjRcclxuXHRcdFx0dmFyIHNxbF9kYXRlX2FyciA9IHNxbF9kYXRlLnNwbGl0KCAnLScgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlX19taWRuaWdodCA9IG5ldyBEYXRlKCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzBdICksICggcGFyc2VJbnQoIHNxbF9kYXRlX2FyclsxXSApIC0gMSApLCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzJdICksIDAsIDAsIDAgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyA9IHNxbF9kYXRlX19taWRuaWdodC5nZXRUaW1lKCk7XHJcblxyXG5cdFx0XHR2YXIgaXNfaW50ZXJzZWN0ID0gZmFsc2U7XHJcblxyXG5cdFx0XHRpZiAoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzLmxlbmd0aCA+IDEgKSB7XHJcblxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IChzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyAocGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzBdICkgKyAyMCkgKiAxMDAwKSApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IChzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyAocGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzFdICkgLSAyMCkgKiAxMDAwKSApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2YXIgaXNfY2hlY2tfaW4gPSAoLTEgIT09IHRpbWVfZmllbGRzX29iai5uYW1lLmluZGV4T2YoICdzdGFydCcgKSk7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzX2NoZWNrID0gKGlzX2NoZWNrX2luKSA/IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApICsgMjAgOiBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSAtIDIwO1xyXG5cclxuXHRcdFx0XHR0aW1lc19hc19zZWNvbmRzX2NoZWNrID0gc3FsX2RhdGVfX21pZG5pZ2h0X21pbGlzZWNvbmRzICsgdGltZXNfYXNfc2Vjb25kc19jaGVjayAqIDEwMDA7XHJcblxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgKSB7XHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGlzX2ludGVyc2VjdDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIG51bWJlciBpbnNpZGUgL2ludGVyc2VjdCAgb2YgYXJyYXkgb2YgaW50ZXJ2YWxzID9cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gdGltZV9BXHRcdCAgICAgXHQtIDI1ODAwXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19vbmVfdGltZV9pbnRlcnZhbCggdGltZV9BLCB0aW1lX2ludGVydmFsX0IgKXtcclxuXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfaW50ZXJ2YWxfQi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRpZiAoIChwYXJzZUludCggdGltZV9BICkgPiBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDAgXSApKSAmJiAocGFyc2VJbnQoIHRpbWVfQSApIDwgcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAxIF0gKSkgKXtcclxuXHRcdFx0XHRcdHJldHVybiB0cnVlXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBpZiAoICggcGFyc2VJbnQoIHRpbWVfQSApID09IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMCBdICkgKSB8fCAoIHBhcnNlSW50KCB0aW1lX0EgKSA9PSBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDEgXSApICkgKSB7XHJcblx0XHRcdFx0Ly8gXHRcdFx0Ly8gVGltZSBBIGp1c3QgIGF0ICB0aGUgYm9yZGVyIG9mIGludGVydmFsXHJcblx0XHRcdFx0Ly8gfVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0ICAgIHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIHRoZXNlIGFycmF5IG9mIGludGVydmFscyBpbnRlcnNlY3RlZCA/XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHRpbWVfaW50ZXJ2YWxfQVx0XHQtIFsgWyAyMTYwMCwgMjM0MDAgXSBdXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19yYW5nZV90aW1lX2ludGVydmFsKCB0aW1lX2ludGVydmFsX0EsIHRpbWVfaW50ZXJ2YWxfQiApe1xyXG5cclxuXHRcdFx0dmFyIGlzX2ludGVyc2VjdDtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHRpbWVfaW50ZXJ2YWxfQS5sZW5ndGg7IGkrKyApe1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX2ludGVydmFsX0IubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2ludGVydmFsc19faXNfaW50ZXJzZWN0ZWQoIHRpbWVfaW50ZXJ2YWxfQVsgaSBdLCB0aW1lX2ludGVydmFsX0JbIGogXSApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggaXNfaW50ZXJzZWN0ICl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKiBAcmV0dXJucyBbXVxyXG5cdFx0ICpcclxuXHRcdCAqIFx0XHRFeGFtcGxlOlxyXG5cdFx0ICogXHRcdFx0XHRcdFtcclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHQgKiBcdFx0XHRcdFx0XHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKXtcclxuXHRcdCAgICAvKipcclxuXHRcdFx0ICogRmllbGRzIHdpdGggIFtdICBsaWtlIHRoaXMgICBzZWxlY3RbbmFtZT1cInJhbmdldGltZTFbXVwiXVxyXG5cdFx0XHQgKiBpdCdzIHdoZW4gd2UgaGF2ZSAnbXVsdGlwbGUnIGluIHNob3J0Y29kZTogICBbc2VsZWN0KiByYW5nZXRpbWUgbXVsdGlwbGUgIFwiMDY6MDAgLSAwNjozMFwiIC4uLiBdXHJcblx0XHRcdCAqL1xyXG5cdFx0XHR2YXIgdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nXHJcblx0XHRcdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSBbXTtcclxuXHJcblx0XHRcdC8vIExvb3AgYWxsIFRpbWUgRmllbGRzXHJcblx0XHRcdGZvciAoIHZhciBjdGY9IDA7IGN0ZiA8IHRpbWVfZmllbGRzX2Fyci5sZW5ndGg7IGN0ZisrICl7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lX2ZpZWxkID0gdGltZV9maWVsZHNfYXJyWyBjdGYgXTtcclxuXHRcdFx0XHR2YXIgdGltZV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfZmllbGQgKyAnIG9wdGlvbicgKTtcclxuXHJcblx0XHRcdFx0Ly8gTG9vcCBhbGwgb3B0aW9ucyBpbiB0aW1lIGZpZWxkXHJcblx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9vcHRpb24ubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbiA9IGpRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uOmVxKCcgKyBqICsgJyknICk7XHJcblx0XHRcdFx0XHR2YXIgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyID0ganF1ZXJ5X29wdGlvbi52YWwoKS5zcGxpdCggJy0nICk7XHJcblx0XHRcdFx0XHR2YXIgdGltZXNfYXNfc2Vjb25kcyA9IFtdO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdldCB0aW1lIGFzIHNlY29uZHNcclxuXHRcdFx0XHRcdGlmICggdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aCApe1x0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aDsgaSsrICl7XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0XHRcdFx0Ly8gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyW2ldID0gJzE0OjAwICcgIHwgJyAxNjowMCcgICAoaWYgZnJvbSAncmFuZ2V0aW1lJykgYW5kICcxNjowMCcgIGlmIChzdGFydC9lbmQgdGltZSlcclxuXHJcblx0XHRcdFx0XHRcdFx0dmFyIHN0YXJ0X2VuZF90aW1lc19hcnIgPSB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbIGkgXS50cmltKCkuc3BsaXQoICc6JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHR2YXIgdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzLnB1c2goIHRpbWVfaW5fc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2Fyci5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgICAgICAgICAgIDogalF1ZXJ5KCB0aW1lX2ZpZWxkICkuYXR0ciggJ25hbWUnICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzoganF1ZXJ5X29wdGlvbi52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiBqcXVlcnlfb3B0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGltZXNfYXNfc2Vjb25kcyc6IHRpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0aW1lX2ZpZWxkc19vYmpfYXJyO1xyXG5cdFx0fVxyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIERpc2FibGUgSFRNTCBvcHRpb25zIGFuZCBhZGQgYm9va2VkIENTUyBjbGFzc1xyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcGFyYW0gdGltZV9maWVsZHNfb2JqX2FyciAgICAgIC0gdGhpcyB2YWx1ZSBpcyBmcm9tICB0aGUgZnVuYzpcclxuXHRcdFx0ICogICAgIFx0d3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0W1xyXG5cdFx0XHQgKiBcdFx0XHRcdFx0IFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0XHRcdCAqIFx0ICBcdFx0XHRcdFx0XHQgICAgZGlzYWJsZWQgPSAxXHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHRcdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdFx0XHQgKiAgIFx0XHRcdFx0XHRcdFx0ZGlzYWJsZWQgPSAwXHJcblx0XHRcdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHRcdFx0ICogXHRcdFx0XHRcdCBdXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiB3cGJjX19odG1sX190aW1lX2ZpZWxkX29wdGlvbnNfX3NldF9kaXNhYmxlZCggdGltZV9maWVsZHNfb2JqX2FyciApe1xyXG5cclxuXHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbjtcclxuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgdGltZV9maWVsZHNfb2JqX2Fyci5sZW5ndGg7IGkrKyApe1xyXG5cclxuXHRcdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uID0gdGltZV9maWVsZHNfb2JqX2FyclsgaSBdLmpxdWVyeV9vcHRpb247XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAxID09IHRpbWVfZmllbGRzX29ial9hcnJbIGkgXS5kaXNhYmxlZCApe1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKTsgXHRcdC8vIE1ha2UgZGlzYWJsZSBzb21lIG9wdGlvbnNcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5hZGRDbGFzcyggJ2Jvb2tlZCcgKTsgICAgICAgICAgIFx0Ly8gQWRkIFwiYm9va2VkXCIgQ1NTIGNsYXNzXHJcblxyXG5cdFx0XHRcdFx0XHQvLyBpZiB0aGlzIGJvb2tlZCBlbGVtZW50IHNlbGVjdGVkIC0tPiB0aGVuIGRlc2VsZWN0ICBpdFxyXG5cdFx0XHRcdFx0XHRpZiAoIGpxdWVyeV9vcHRpb24ucHJvcCggJ3NlbGVjdGVkJyApICl7XHJcblx0XHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5wcm9wKCAnc2VsZWN0ZWQnLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnBhcmVudCgpLmZpbmQoICdvcHRpb246bm90KFtkaXNhYmxlZF0pOmZpcnN0JyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCBcImNoYW5nZVwiICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIGZhbHNlICk7ICBcdFx0Ly8gTWFrZSBhY3RpdmUgYWxsIHRpbWVzXHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucmVtb3ZlQ2xhc3MoICdib29rZWQnICk7ICAgXHRcdC8vIFJlbW92ZSBjbGFzcyBcImJvb2tlZFwiXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayBpZiB0aGlzIHRpbWVfcmFuZ2UgfCBUaW1lX1Nsb3QgaXMgRnVsbCBEYXkgIGJvb2tlZFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzXHRcdC0gWyAzNjAxMSwgODY0MDAgXVxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc190aW1lc2xvdF9fZnVsbF9kYXlfYm9va2VkKCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kcyApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0XHQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzLmxlbmd0aCA+IDEgKVxyXG5cdFx0XHQmJiAoIHBhcnNlSW50KCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kc1sgMCBdICkgPCAzMCApXHJcblx0XHRcdCYmICggcGFyc2VJbnQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzWyAxIF0gKSA+ICAoICgyNCAqIDYwICogNjApIC0gMzApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qICA9PSAgUyBlIGwgZSBjIHQgZSBkICAgIEQgYSB0IGUgcyAgLyAgVCBpIG0gZSAtIEYgaSBlIGwgZCBzICA9PVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYWxsIHNlbGVjdGVkIGRhdGVzIGluIFNRTCBmb3JtYXQgbGlrZSB0aGlzIFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiICwgLi4uIF1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtbXX1cdFx0XHRbIFwiMjAyMy0wOC0yM1wiLCBcIjIwMjMtMDgtMjRcIiwgXCIyMDIzLTA4LTI1XCIsIFwiMjAyMy0wOC0yNlwiLCBcIjIwMjMtMDgtMjdcIiwgXCIyMDIzLTA4LTI4XCIsXHJcblx0ICogICAgIFwiMjAyMy0wOC0yOVwiIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX2FyciA9IFtdO1xyXG5cdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyID0galF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCgpLnNwbGl0KCcsJyk7XHJcblxyXG5cdFx0aWYgKCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjU2LlxyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0udHJpbSgpO1xyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0uc3BsaXQoICcuJyApO1xyXG5cdFx0XHRcdGlmICggc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0ubGVuZ3RoID4gMSApe1xyXG5cdFx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0gPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXVsgMiBdICsgJy0nICsgc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF1bIDEgXSArICctJyArIHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdWyAwIF07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIGVtcHR5IGVsZW1lbnRzIGZyb20gYW4gYXJyYXlcclxuXHRcdHNlbGVjdGVkX2RhdGVzX2FyciA9IHNlbGVjdGVkX2RhdGVzX2Fyci5maWx0ZXIoIGZ1bmN0aW9uICggbiApeyByZXR1cm4gcGFyc2VJbnQobik7IH0gKTtcclxuXHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIuc29ydCgpO1xyXG5cclxuXHRcdHJldHVybiBzZWxlY3RlZF9kYXRlc19hcnI7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKiBAcGFyYW0gaXNfb25seV9zZWxlY3RlZF90aW1lXHJcblx0ICogQHJldHVybnMgW11cclxuXHQgKlxyXG5cdCAqIFx0XHRFeGFtcGxlOlxyXG5cdCAqIFx0XHRcdFx0XHRbXHJcblx0ICogXHRcdFx0XHRcdCBcdCAgIHtcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwLCAyMzQwMCBdXHJcblx0ICogXHRcdFx0XHRcdCBcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHQgKiBcdFx0XHRcdFx0XHQgICB7XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdCAqIFx0XHRcdFx0XHRcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHQgKiBcdFx0XHRcdFx0IF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9fc2VsZWN0ZWRfdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCwgaXNfb25seV9zZWxlY3RlZF90aW1lID0gdHJ1ZSApe1xyXG5cdFx0LyoqXHJcblx0XHQgKiBGaWVsZHMgd2l0aCAgW10gIGxpa2UgdGhpcyAgIHNlbGVjdFtuYW1lPVwicmFuZ2V0aW1lMVtdXCJdXHJcblx0XHQgKiBpdCdzIHdoZW4gd2UgaGF2ZSAnbXVsdGlwbGUnIGluIHNob3J0Y29kZTogICBbc2VsZWN0KiByYW5nZXRpbWUgbXVsdGlwbGUgIFwiMDY6MDAgLSAwNjozMFwiIC4uLiBdXHJcblx0XHQgKi9cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19hcnI9W1xyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImR1cmF0aW9udGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXSdcclxuXHRcdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmpfYXJyID0gW107XHJcblxyXG5cdFx0Ly8gTG9vcCBhbGwgVGltZSBGaWVsZHNcclxuXHRcdGZvciAoIHZhciBjdGY9IDA7IGN0ZiA8IHRpbWVfZmllbGRzX2Fyci5sZW5ndGg7IGN0ZisrICl7XHJcblxyXG5cdFx0XHR2YXIgdGltZV9maWVsZCA9IHRpbWVfZmllbGRzX2FyclsgY3RmIF07XHJcblxyXG5cdFx0XHR2YXIgdGltZV9vcHRpb247XHJcblx0XHRcdGlmICggaXNfb25seV9zZWxlY3RlZF90aW1lICl7XHJcblx0XHRcdFx0dGltZV9vcHRpb24gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCArICcgb3B0aW9uOnNlbGVjdGVkJyApO1x0XHRcdC8vIEV4Y2x1ZGUgY29uZGl0aW9uYWwgIGZpZWxkcywgIGJlY2F1c2Ugb2YgdXNpbmcgJyNib29raW5nX2Zvcm0zIC4uLidcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aW1lX29wdGlvbiA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0aW1lX2ZpZWxkICsgJyBvcHRpb24nICk7XHRcdFx0XHQvLyBBbGwgIHRpbWUgZmllbGRzXHJcblx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHQvLyBMb29wIGFsbCBvcHRpb25zIGluIHRpbWUgZmllbGRcclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9vcHRpb24ubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfb3B0aW9uWyBqIF0gKTtcdFx0Ly8gR2V0IG9ubHkgIHNlbGVjdGVkIG9wdGlvbnMgXHQvL2pRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uOmVxKCcgKyBqICsgJyknICk7XHJcblx0XHRcdFx0dmFyIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyciA9IGpxdWVyeV9vcHRpb24udmFsKCkuc3BsaXQoICctJyApO1xyXG5cdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzID0gW107XHJcblxyXG5cdFx0XHRcdC8vIEdldCB0aW1lIGFzIHNlY29uZHNcclxuXHRcdFx0XHRpZiAoIHZhbHVlX29wdGlvbl9zZWNvbmRzX2Fyci5sZW5ndGggKXtcdFx0XHRcdCBcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aDsgaSsrICl7XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0XHRcdC8vIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FycltpXSA9ICcxNDowMCAnICB8ICcgMTY6MDAnICAgKGlmIGZyb20gJ3JhbmdldGltZScpIGFuZCAnMTY6MDAnICBpZiAoc3RhcnQvZW5kIHRpbWUpXHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgc3RhcnRfZW5kX3RpbWVzX2FyciA9IHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyclsgaSBdLnRyaW0oKS5zcGxpdCggJzonICk7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kcy5wdXNoKCB0aW1lX2luX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCApLmF0dHIoICduYW1lJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiBqcXVlcnlfb3B0aW9uLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiBqcXVlcnlfb3B0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0aW1lc19hc19zZWNvbmRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVGV4dDogICBbc3RhcnR0aW1lXSAtIFtlbmR0aW1lXSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdHZhciB0ZXh0X3RpbWVfZmllbGRzX2Fycj1bXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XTtcclxuXHRcdGZvciAoIHZhciB0Zj0gMDsgdGYgPCB0ZXh0X3RpbWVfZmllbGRzX2Fyci5sZW5ndGg7IHRmKysgKXtcclxuXHJcblx0XHRcdHZhciB0ZXh0X2pxdWVyeSA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0ZXh0X3RpbWVfZmllbGRzX2FyclsgdGYgXSApO1x0XHRcdFx0XHRcdFx0XHQvLyBFeGNsdWRlIGNvbmRpdGlvbmFsICBmaWVsZHMsICBiZWNhdXNlIG9mIHVzaW5nICcjYm9va2luZ19mb3JtMyAuLi4nXHJcblx0XHRcdGlmICggdGV4dF9qcXVlcnkubGVuZ3RoID4gMCApe1xyXG5cclxuXHRcdFx0XHR2YXIgdGltZV9faF9tX19hcnIgPSB0ZXh0X2pxdWVyeS52YWwoKS50cmltKCkuc3BsaXQoICc6JyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMTQ6MDAnXHJcblx0XHRcdFx0aWYgKCAwID09IHRpbWVfX2hfbV9fYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTm90IGVudGVyZWQgdGltZSB2YWx1ZSBpbiBhIGZpZWxkXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggMSA9PSB0aW1lX19oX21fX2Fyci5sZW5ndGggKXtcclxuXHRcdFx0XHRcdGlmICggJycgPT09IHRpbWVfX2hfbV9fYXJyWyAwIF0gKXtcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdC8vIE5vdCBlbnRlcmVkIHRpbWUgdmFsdWUgaW4gYSBmaWVsZFxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dGltZV9faF9tX19hcnJbIDEgXSA9IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciB0ZXh0X3RpbWVfaW5fc2Vjb25kcyA9IHBhcnNlSW50KCB0aW1lX19oX21fX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHRpbWVfX2hfbV9fYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHR2YXIgdGV4dF90aW1lc19hc19zZWNvbmRzID0gW107XHJcblx0XHRcdFx0dGV4dF90aW1lc19hc19zZWNvbmRzLnB1c2goIHRleHRfdGltZV9pbl9zZWNvbmRzICk7XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiB0ZXh0X2pxdWVyeS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzogdGV4dF9qcXVlcnkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IHRleHRfanF1ZXJ5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0ZXh0X3RpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGltZV9maWVsZHNfb2JqX2FycjtcclxuXHR9XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIFMgVSBQIFAgTyBSIFQgICAgZm9yICAgIEMgQSBMIEUgTiBEIEEgUiAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBDYWxlbmRhciBkYXRlcGljayBJbnN0YW5jZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7aW50fHN0cmluZ30gcmVzb3VyY2VfaWRcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KHJlc291cmNlX2lkKSB7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKSB7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICkge1xyXG5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHR2YXIgaW5zdCA9IGpRdWVyeS5kYXRlcGljay5fZ2V0SW5zdCggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5nZXQoIDAgKSApO1xyXG5cdFx0XHRcdHJldHVybiBpbnN0ID8gaW5zdCA6IG51bGw7XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVW5zZWxlY3QgIGFsbCBkYXRlcyBpbiBjYWxlbmRhciBhbmQgdmlzdWFsbHkgdXBkYXRlIHRoaXMgY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHRcdHRydWUgb24gc3VjY2VzcyB8IGZhbHNlLCAgaWYgbm8gc3VjaCAgY2FsZW5kYXJcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXtcclxuXHRcdFx0cmVzb3VyY2VfaWQgPSAnMSc7XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19yYW5nZV9zZWxlY3Rpb25fX2hpZGVfZ3VpZGFuY2UoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKVxyXG5cclxuXHRcdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cclxuXHRcdFx0Ly8gVW5zZWxlY3QgYWxsIGRhdGVzIGFuZCBzZXQgIHByb3BlcnRpZXMgb2YgRGF0ZXBpY2tcclxuXHRcdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTsgICAgICAvL0ZpeEluOiA1LjQuM1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gZmFsc2U7XHJcblx0XHRcdGluc3QuZGF0ZXMgPSBbXTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl91cGRhdGVEYXRlcGljayggaW5zdCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWVcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ2xlYXIgZGF5cyBoaWdobGlnaHRpbmcgaW4gQWxsIG9yIHNwZWNpZmljIENhbGVuZGFyc1xyXG5cdCAqXHJcbiAgICAgKiBAcGFyYW0gcmVzb3VyY2VfaWQgIC0gY2FuIGJlIHNraXBlZCB0byAgY2xlYXIgaGlnaGxpZ2h0aW5nIGluIGFsbCBjYWxlbmRhcnNcclxuICAgICAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCByZXNvdXJjZV9pZCApICl7XHJcblxyXG5cdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgLmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHRcdC8vIENsZWFyIGluIHNwZWNpZmljIGNhbGVuZGFyXHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0alF1ZXJ5KCAnLmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHRcdFx0XHRcdFx0XHRcdC8vIENsZWFyIGluIGFsbCBjYWxlbmRhcnNcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNjcm9sbCB0byBzcGVjaWZpYyBtb250aCBpbiBjYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIHJlc291cmNlXHJcblx0ICogQHBhcmFtIHllYXJcdFx0XHRcdC0gcmVhbCB5ZWFyICAtIDIwMjNcclxuXHQgKiBAcGFyYW0gbW9udGhcdFx0XHRcdC0gcmVhbCBtb250aCAtIDEyXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fc2Nyb2xsX3RvKCByZXNvdXJjZV9pZCwgeWVhciwgbW9udGggKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHJlc291cmNlX2lkKSApeyByZXNvdXJjZV9pZCA9ICcxJzsgfVxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKVxyXG5cdFx0aWYgKCBudWxsICE9PSBpbnN0ICl7XHJcblxyXG5cdFx0XHR5ZWFyICA9IHBhcnNlSW50KCB5ZWFyICk7XHJcblx0XHRcdG1vbnRoID0gcGFyc2VJbnQoIG1vbnRoICkgLSAxO1x0XHQvLyBJbiBKUyBkYXRlLCAgbW9udGggLTFcclxuXHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZSA9IG5ldyBEYXRlKCk7XHJcblx0XHRcdC8vIEluIHNvbWUgY2FzZXMsICB0aGUgc2V0RnVsbFllYXIgY2FuICBzZXQgIG9ubHkgWWVhciwgIGFuZCBub3QgdGhlIE1vbnRoIGFuZCBkYXkgICAgICAvLyBGaXhJbjogNi4yLjMuNS5cclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlLnNldEZ1bGxZZWFyKCB5ZWFyLCBtb250aCwgMSApO1xyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUuc2V0TW9udGgoIG1vbnRoICk7XHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZS5zZXREYXRlKCAxICk7XHJcblxyXG5cdFx0XHRpbnN0LmRyYXdNb250aCA9IGluc3QuY3Vyc29yRGF0ZS5nZXRNb250aCgpO1xyXG5cdFx0XHRpbnN0LmRyYXdZZWFyID0gaW5zdC5jdXJzb3JEYXRlLmdldEZ1bGxZZWFyKCk7XHJcblxyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX25vdGlmeUNoYW5nZSggaW5zdCApO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX2FkanVzdEluc3REYXRlKCBpbnN0ICk7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2hvd0RhdGUoIGluc3QgKTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl91cGRhdGVEYXRlcGljayggaW5zdCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJcyB0aGlzIGRhdGUgc2VsZWN0YWJsZSBpbiBjYWxlbmRhciAobWFpbmx5IGl0J3MgbWVhbnMgQVZBSUxBQkxFIGRhdGUpXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2ludHxzdHJpbmd9IHJlc291cmNlX2lkXHRcdDFcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheVx0XHQnMjAyMy0wOC0xMSdcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0XHRcdFx0dHJ1ZSB8IGZhbHNlXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApe1xyXG5cclxuXHRcdC8vIEdldCBEYXRhIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgZGF0ZV9ib29raW5nc19vYmogPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApO1xyXG5cdFx0aWYgKCAhIGRhdGVfYm9va2luZ3Nfb2JqIHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBpc19kYXlfc2VsZWN0YWJsZSA9ICggcGFyc2VJbnQoIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApID4gMCApO1xyXG5cclxuXHRcdGlmICggdHlwZW9mIChkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF0pID09PSAndW5kZWZpbmVkJyApe1xyXG5cdFx0XHRyZXR1cm4gaXNfZGF5X3NlbGVjdGFibGU7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnYXZhaWxhYmxlJyAhPSBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdHZhciBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGUgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlJyApO1x0XHQvLyBzZXQgcGVuZGluZyBkYXlzIHNlbGVjdGFibGUgICAgICAgICAgLy8gRml4SW46IDguNi4xLjE4LlxyXG5cdFx0XHR2YXIgYm9va2luZ19zdGF0dXNlc19hcnIgPSB3cGJjX2dldF9ib29raW5nX3N0YXR1c2VzX19hc19hcnIoIGRhdGVfYm9va2luZ3Nfb2JqICk7XHJcblxyXG5cdFx0XHRpZiAoXHJcblx0XHRcdFx0ICAgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdwZW5kaW5nJyApIClcclxuXHRcdFx0XHR8fCAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfcGVuZGluZycgKSApXHJcblx0XHRcdFx0fHwgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdwZW5kaW5nX2FwcHJvdmVkJyApIClcclxuXHRcdFx0XHR8fCAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ2FwcHJvdmVkX3BlbmRpbmcnICkgKVxyXG5cdFx0XHQpe1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gaXNfZGF5X3NlbGVjdGFibGU7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJcyBkYXRlIHRvIGNoZWNrIElOIGFycmF5IG9mIHNlbGVjdGVkIGRhdGVzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2RhdGV9anNfZGF0ZV90b19jaGVja1x0XHQtIEpTIERhdGVcdFx0XHQtIHNpbXBsZSAgSmF2YVNjcmlwdCBEYXRlIG9iamVjdFxyXG5cdCAqIEBwYXJhbSB7W119IGpzX2RhdGVzX2Fyclx0XHRcdC0gWyBKU0RhdGUsIC4uLiBdICAgLSBhcnJheSAgb2YgSlMgZGF0ZXNcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2lzX3RoaXNfZGF5X2Ftb25nX3NlbGVjdGVkX2RheXMoIGpzX2RhdGVfdG9fY2hlY2ssIGpzX2RhdGVzX2FyciApe1xyXG5cclxuXHRcdGZvciAoIHZhciBkYXRlX2luZGV4ID0gMDsgZGF0ZV9pbmRleCA8IGpzX2RhdGVzX2Fyci5sZW5ndGggOyBkYXRlX2luZGV4KysgKXsgICAgIFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA4LjQuNS4xNi5cclxuXHRcdFx0aWYgKCAoIGpzX2RhdGVzX2FyclsgZGF0ZV9pbmRleCBdLmdldEZ1bGxZZWFyKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RnVsbFllYXIoKSApICYmXHJcblx0XHRcdFx0ICgganNfZGF0ZXNfYXJyWyBkYXRlX2luZGV4IF0uZ2V0TW9udGgoKSA9PT0ganNfZGF0ZV90b19jaGVjay5nZXRNb250aCgpICkgJiZcclxuXHRcdFx0XHQgKCBqc19kYXRlc19hcnJbIGRhdGVfaW5kZXggXS5nZXREYXRlKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RGF0ZSgpICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAgZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgU1FMIENsYXNzIERhdGUgJzIwMjMtMDgtMDEnIGZyb20gIEpTIERhdGVcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRKUyBEYXRlXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cdFx0JzIwMjMtMDgtMTInXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApe1xyXG5cclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9ICggKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgPCAxMCApID8gJzAnIDogJyc7XHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLSdcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSAoIGRhdGUuZ2V0RGF0ZSgpIDwgMTAgKSA/ICcwJyA6ICcnO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9IGRhdGUuZ2V0RGF0ZSgpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHNxbF9jbGFzc19kYXk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgSlMgRGF0ZSBmcm9tICB0aGUgU1FMIGRhdGUgZm9ybWF0ICcyMDI0LTA1LTE0J1xyXG5cdCAqIEBwYXJhbSBzcWxfY2xhc3NfZGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtEYXRlfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2NsYXNzX2RhdGUgKXtcclxuXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RhdGVfYXJyID0gc3FsX2NsYXNzX2RhdGUuc3BsaXQoICctJyApO1xyXG5cclxuXHRcdHZhciBkYXRlX2pzID0gbmV3IERhdGUoKTtcclxuXHJcblx0XHRkYXRlX2pzLnNldEZ1bGxZZWFyKCBwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAwIF0gKSwgKHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDEgXSApIC0gMSksIHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDIgXSApICk7ICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cclxuXHRcdC8vIFdpdGhvdXQgdGhpcyB0aW1lIGFkanVzdCBEYXRlcyBzZWxlY3Rpb24gIGluIERhdGVwaWNrZXIgY2FuIG5vdCB3b3JrISEhXHJcblx0XHRkYXRlX2pzLnNldEhvdXJzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaW51dGVzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRTZWNvbmRzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaWxsaXNlY29uZHMoMCk7XHJcblxyXG5cdFx0cmV0dXJuIGRhdGVfanM7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgVEQgQ2xhc3MgRGF0ZSAnMS0zMS0yMDIzJyBmcm9tICBKUyBEYXRlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHRcdCcxLTMxLTIwMjMnXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICl7XHJcblxyXG5cdFx0dmFyIHRkX2NsYXNzX2RheSA9IChkYXRlLmdldE1vbnRoKCkgKyAxKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1x0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblxyXG5cdFx0cmV0dXJuIHRkX2NsYXNzX2RheTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBkYXRlIHBhcmFtcyBmcm9tICBzdHJpbmcgZGF0ZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRzdHJpbmcgZGF0ZSBsaWtlICczMS41LjIwMjMnXHJcblx0ICogQHBhcmFtIHNlcGFyYXRvclx0XHRkZWZhdWx0ICcuJyAgY2FuIGJlIHNraXBwZWQuXHJcblx0ICogQHJldHVybnMgeyAge2RhdGU6IG51bWJlciwgbW9udGg6IG51bWJlciwgeWVhcjogbnVtYmVyfSAgfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fZGF0ZV9wYXJhbXNfX2Zyb21fc3RyaW5nX2RhdGUoIGRhdGUgLCBzZXBhcmF0b3Ipe1xyXG5cclxuXHRcdHNlcGFyYXRvciA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoc2VwYXJhdG9yKSApID8gc2VwYXJhdG9yIDogJy4nO1xyXG5cclxuXHRcdHZhciBkYXRlX2FyciA9IGRhdGUuc3BsaXQoIHNlcGFyYXRvciApO1xyXG5cdFx0dmFyIGRhdGVfb2JqID0ge1xyXG5cdFx0XHQneWVhcicgOiAgcGFyc2VJbnQoIGRhdGVfYXJyWyAyIF0gKSxcclxuXHRcdFx0J21vbnRoJzogKHBhcnNlSW50KCBkYXRlX2FyclsgMSBdICkgLSAxKSxcclxuXHRcdFx0J2RhdGUnIDogIHBhcnNlSW50KCBkYXRlX2FyclsgMCBdIClcclxuXHRcdH07XHJcblx0XHRyZXR1cm4gZGF0ZV9vYmo7XHRcdC8vIGZvciBcdFx0ID0gbmV3IERhdGUoIGRhdGVfb2JqLnllYXIgLCBkYXRlX29iai5tb250aCAsIGRhdGVfb2JqLmRhdGUgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdGFydCggcmVzb3VyY2VfaWQgKXtcclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLm5leHQoKS5oYXNDbGFzcyggJ3dwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZnRlciggJzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIndwYmNfc3Bpbl9sb2FkZXJfb25lX25ld1wiPjwvZGl2PjwvZGl2PicgKTtcclxuXHRcdH1cclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmhhc0NsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApICl7XHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuYWRkQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICk7XHJcblx0XHR9XHJcblx0XHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdGFydCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wKCByZXNvdXJjZV9pZCApe1xyXG5cdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnICsgLndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkucmVtb3ZlKCk7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApO1xyXG5cdFx0d3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBCbHVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0YXJ0KCByZXNvdXJjZV9pZCApe1xyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZGRDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cicgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBCbHVyIGluICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0b3AoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyJyApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblx0LyogID09ICBDYWxlbmRhciBVcGRhdGUgIC0gVmlldyAgPT1cclxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGUgbG9vayBvZiBjYWxlbmRhciAoc2FmZSkuXHJcblx0ICpcclxuXHQgKiBJbiBFbGVtZW50b3IgcHJldmlldyB0aGUgRE9NIGNhbiBiZSByZS1yZW5kZXJlZCwgc28gdGhlIGNhbGVuZGFyIGVsZW1lbnQgbWF5IGV4aXN0XHJcblx0ICogd2hpbGUgdGhlIERhdGVwaWNrIGluc3RhbmNlIGlzIG1pc3NpbmcuIEluIHRoYXQgY2FzZSB0cnkgdG8gKHJlKWluaXRpYWxpemUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2ludHxzdHJpbmd9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gdHJ1ZSBpZiB1cGRhdGVkLCBmYWxzZSBpZiBub3QgcG9zc2libGVcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayhyZXNvdXJjZV9pZCkge1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gSWYgaW5zdGFuY2UgbWlzc2luZywgdHJ5IHRvIHJlLWluaXQgY2FsZW5kYXIgb25jZS5cclxuXHRcdGlmICggbnVsbCA9PT0gaW5zdCApIHtcclxuXHJcblx0XHRcdHZhciBqcV9jYWwgPSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0aWYgKCBqcV9jYWwubGVuZ3RoICYmICgnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19jYWxlbmRhcl9zaG93KSApIHtcclxuXHJcblx0XHRcdFx0Ly8gRWxlbWVudG9yIHNvbWV0aW1lcyBsZWF2ZXMgc3RhbGUgY2xhc3Mgd2l0aG91dCByZWFsIGluc3RhbmNlLlxyXG5cdFx0XHRcdGlmICgganFfY2FsLmhhc0NsYXNzKCAnaGFzRGF0ZXBpY2snICkgKSB7XHJcblx0XHRcdFx0XHRqcV9jYWwucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFRyeSB0byBpbml0IGRhdGVwaWNrIG1hcmt1cCBub3cuXHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0XHQvLyBUcnkgYWdhaW4uXHJcblx0XHRcdFx0aW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3RpbGwgbm8gaW5zdGFuY2UgLT4gZG8gbm90IGNyYXNoIHRoZSB3aG9sZSBhamF4IGZsb3cuXHJcblx0XHRpZiAoIG51bGwgPT09IGluc3QgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRqUXVlcnkuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBpbnN0ICk7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlIGR5bmFtaWNhbGx5IE51bWJlciBvZiBNb250aHMgaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZCBpbnRcclxuXHQgKiBAcGFyYW0gbW9udGhzX251bWJlciBpbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIG1vbnRoc19udW1iZXIgKXtcclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHRcdFx0aW5zdC5zZXR0aW5nc1sgJ251bWJlck9mTW9udGhzJyBdID0gbW9udGhzX251bWJlcjtcclxuXHRcdFx0Ly9fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX251bWJlcl9vZl9tb250aHMnLCBtb250aHNfbnVtYmVyICk7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNob3cgY2FsZW5kYXIgaW4gIGRpZmZlcmVudCBTa2luXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gc2VsZWN0ZWRfc2tpbl91cmxcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4oIHNlbGVjdGVkX3NraW5fdXJsICl7XHJcblxyXG5cdC8vY29uc29sZS5sb2coICdTS0lOIFNFTEVDVElPTiA6OicsIHNlbGVjdGVkX3NraW5fdXJsICk7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIENTUyBza2luXHJcblx0XHR2YXIgc3R5bGVzaGVldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiYy1jYWxlbmRhci1za2luLWNzcycgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgXCJ3cGJjLWNhbGVuZGFyLXNraW4tY3NzXCIgKTtcclxuXHRcdGNzc05vZGUucmVsID0gJ3N0eWxlc2hlZXQnO1xyXG5cdFx0Y3NzTm9kZS5tZWRpYSA9ICdzY3JlZW4nO1xyXG5cdFx0Y3NzTm9kZS5ocmVmID0gc2VsZWN0ZWRfc2tpbl91cmw7XHQvL1wiaHR0cDovL2JldGEvd3AtY29udGVudC9wbHVnaW5zL2Jvb2tpbmcvY3NzL3NraW5zL2dyZWVuLTAxLmNzc1wiO1xyXG5cdFx0aGVhZElELmFwcGVuZENoaWxkKCBjc3NOb2RlICk7XHJcblx0fVxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggc2VsZWN0ZWRfc2tpbl91cmwsIHN0eWxlc2hlZXRfaWQgPSAnd3BiYy10aW1lX3BpY2tlci1za2luLWNzcycgKXtcclxuXHJcblx0XHQvLyBSZW1vdmUgQ1NTIHNraW5cclxuXHRcdHZhciBzdHlsZXNoZWV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHN0eWxlc2hlZXRfaWQgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgc3R5bGVzaGVldF9pZCApO1xyXG5cdFx0Y3NzTm9kZS5yZWwgPSAnc3R5bGVzaGVldCc7XHJcblx0XHRjc3NOb2RlLm1lZGlhID0gJ3NjcmVlbic7XHJcblx0XHRjc3NOb2RlLmhyZWYgPSBzZWxlY3RlZF9za2luX3VybDtcdC8vXCJodHRwOi8vYmV0YS93cC1jb250ZW50L3BsdWdpbnMvYm9va2luZy9jc3Mvc2tpbnMvZ3JlZW4tMDEuY3NzXCI7XHJcblx0XHRoZWFkSUQuYXBwZW5kQ2hpbGQoIGNzc05vZGUgKTtcclxuXHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgUyBVIFAgUCBPIFIgVCAgICBNIEEgVCBIICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1lcmdlIHNldmVyYWwgIGludGVyc2VjdGVkIGludGVydmFscyBvciByZXR1cm4gbm90IGludGVyc2VjdGVkOlxyXG5cdFx0ICogW1sxLDNdLFsyLDZdLFs4LDEwXSxbMTUsMThdXSAgLT4gICBbWzEsNl0sWzgsMTBdLFsxNSwxOF1dXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIFtdIGludGVydmFsc1x0XHRcdCBbIFsxLDNdLFsyLDRdLFs2LDhdLFs5LDEwXSxbMyw3XSBdXHJcblx0XHQgKiBAcmV0dXJucyBbXVx0XHRcdFx0XHQgWyBbMSw4XSxbOSwxMF0gXVxyXG5cdFx0ICpcclxuXHRcdCAqIEV4bWFtcGxlOiB3cGJjX2ludGVydmFsc19fbWVyZ2VfaW5lcnNlY3RlZCggIFsgWzEsM10sWzIsNF0sWzYsOF0sWzksMTBdLFszLDddIF0gICk7XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaW50ZXJ2YWxzX19tZXJnZV9pbmVyc2VjdGVkKCBpbnRlcnZhbHMgKXtcclxuXHJcblx0XHRcdGlmICggISBpbnRlcnZhbHMgfHwgaW50ZXJ2YWxzLmxlbmd0aCA9PT0gMCApe1xyXG5cdFx0XHRcdHJldHVybiBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIG1lcmdlZCA9IFtdO1xyXG5cdFx0XHRpbnRlcnZhbHMuc29ydCggZnVuY3Rpb24gKCBhLCBiICl7XHJcblx0XHRcdFx0cmV0dXJuIGFbIDAgXSAtIGJbIDAgXTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dmFyIG1lcmdlZEludGVydmFsID0gaW50ZXJ2YWxzWyAwIF07XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBpbnRlcnZhbHMubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0XHR2YXIgaW50ZXJ2YWwgPSBpbnRlcnZhbHNbIGkgXTtcclxuXHJcblx0XHRcdFx0aWYgKCBpbnRlcnZhbFsgMCBdIDw9IG1lcmdlZEludGVydmFsWyAxIF0gKXtcclxuXHRcdFx0XHRcdG1lcmdlZEludGVydmFsWyAxIF0gPSBNYXRoLm1heCggbWVyZ2VkSW50ZXJ2YWxbIDEgXSwgaW50ZXJ2YWxbIDEgXSApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRtZXJnZWQucHVzaCggbWVyZ2VkSW50ZXJ2YWwgKTtcclxuXHRcdFx0XHRcdG1lcmdlZEludGVydmFsID0gaW50ZXJ2YWw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRtZXJnZWQucHVzaCggbWVyZ2VkSW50ZXJ2YWwgKTtcclxuXHRcdFx0cmV0dXJuIG1lcmdlZDtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJcyAyIGludGVydmFscyBpbnRlcnNlY3RlZDogICAgICAgWzM2MDExLCA4NjM5Ml0gICAgPD0+ICAgIFsxLCA0MzE5Ml0gID0+ICB0cnVlICAgICAgKCBpbnRlcnNlY3RlZCApXHJcblx0XHQgKlxyXG5cdFx0ICogR29vZCBleHBsYW5hdGlvbiAgaGVyZVxyXG5cdFx0ICogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzI2OTQzNC93aGF0cy10aGUtbW9zdC1lZmZpY2llbnQtd2F5LXRvLXRlc3QtaWYtdHdvLXJhbmdlcy1vdmVybGFwXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtICBpbnRlcnZhbF9BICAgLSBbIDM2MDExLCA4NjM5MiBdXHJcblx0XHQgKiBAcGFyYW0gIGludGVydmFsX0IgICAtIFsgICAgIDEsIDQzMTkyIF1cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIGJvb2xcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pbnRlcnZhbHNfX2lzX2ludGVyc2VjdGVkKCBpbnRlcnZhbF9BLCBpbnRlcnZhbF9CICkge1xyXG5cclxuXHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0KCAwID09IGludGVydmFsX0EubGVuZ3RoIClcclxuXHRcdFx0XHQgfHwgKCAwID09IGludGVydmFsX0IubGVuZ3RoIClcclxuXHRcdFx0KXtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGludGVydmFsX0FbIDAgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9BWyAwIF0gKTtcclxuXHRcdFx0aW50ZXJ2YWxfQVsgMSBdID0gcGFyc2VJbnQoIGludGVydmFsX0FbIDEgXSApO1xyXG5cdFx0XHRpbnRlcnZhbF9CWyAwIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQlsgMCBdICk7XHJcblx0XHRcdGludGVydmFsX0JbIDEgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9CWyAxIF0gKTtcclxuXHJcblx0XHRcdHZhciBpc19pbnRlcnNlY3RlZCA9IE1hdGgubWF4KCBpbnRlcnZhbF9BWyAwIF0sIGludGVydmFsX0JbIDAgXSApIC0gTWF0aC5taW4oIGludGVydmFsX0FbIDEgXSwgaW50ZXJ2YWxfQlsgMSBdICk7XHJcblxyXG5cdFx0XHQvLyBpZiAoIDAgPT0gaXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdC8vXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdWNoIHJhbmdlcyBnb2luZyBvbmUgYWZ0ZXIgb3RoZXIsIGUuZy46IFsgMTIsIDE1IF0gYW5kIFsgMTUsIDIxIF1cclxuXHRcdFx0Ly8gfVxyXG5cclxuXHRcdFx0aWYgKCBpc19pbnRlcnNlY3RlZCA8IDAgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7ICAgICAgICAgICAgICAgICAgICAgLy8gSU5URVJTRUNURURcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAgLy8gTm90IGludGVyc2VjdGVkXHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IHRoZSBjbG9zZXRzIEFCUyB2YWx1ZSBvZiBlbGVtZW50IGluIGFycmF5IHRvIHRoZSBjdXJyZW50IG15VmFsdWVcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gbXlWYWx1ZSBcdC0gaW50IGVsZW1lbnQgdG8gc2VhcmNoIGNsb3NldCBcdFx0XHQ0XHJcblx0XHQgKiBAcGFyYW0gbXlBcnJheVx0LSBhcnJheSBvZiBlbGVtZW50cyB3aGVyZSB0byBzZWFyY2ggXHRbNSw4LDEsN11cclxuXHRcdCAqIEByZXR1cm5zIGludFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDVcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfYWJzX2Nsb3Nlc3RfdmFsdWVfaW5fYXJyKCBteVZhbHVlLCBteUFycmF5ICl7XHJcblxyXG5cdFx0XHRpZiAoIG15QXJyYXkubGVuZ3RoID09IDAgKXsgXHRcdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBhcnJheSBpcyBlbXB0eSAtPiByZXR1cm4gIHRoZSBteVZhbHVlXHJcblx0XHRcdFx0cmV0dXJuIG15VmFsdWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBvYmogPSBteUFycmF5WyAwIF07XHJcblx0XHRcdHZhciBkaWZmID0gTWF0aC5hYnMoIG15VmFsdWUgLSBvYmogKTsgICAgICAgICAgICAgXHQvLyBHZXQgZGlzdGFuY2UgYmV0d2VlbiAgMXN0IGVsZW1lbnRcclxuXHRcdFx0dmFyIGNsb3NldFZhbHVlID0gbXlBcnJheVsgMCBdOyAgICAgICAgICAgICAgICAgICBcdFx0XHQvLyBTYXZlIDFzdCBlbGVtZW50XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBteUFycmF5Lmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0b2JqID0gbXlBcnJheVsgaSBdO1xyXG5cclxuXHRcdFx0XHRpZiAoIE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICkgPCBkaWZmICl7ICAgICBcdFx0XHQvLyB3ZSBmb3VuZCBjbG9zZXIgdmFsdWUgLT4gc2F2ZSBpdFxyXG5cdFx0XHRcdFx0ZGlmZiA9IE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICk7XHJcblx0XHRcdFx0XHRjbG9zZXRWYWx1ZSA9IG9iajtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBjbG9zZXRWYWx1ZTtcclxuXHRcdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBUIE8gTyBMIFQgSSBQIFMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdG9vbHRpcCB0byBzaG93LCAgd2hlbiAgbW91c2Ugb3ZlciBEYXRlIGluIENhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gIHRvb2x0aXBfdGV4dFx0XHRcdC0gVGV4dCB0byBzaG93XHRcdFx0XHQnQm9va2VkIHRpbWU6IDEyOjAwIC0gMTM6MDA8YnI+Q29zdDogJDIwLjAwJ1xyXG5cdCAqIEBwYXJhbSAgcmVzb3VyY2VfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcdCcxJ1xyXG5cdCAqIEBwYXJhbSAgdGRfY2xhc3NcdFx0XHRcdC0gU1FMIGNsYXNzXHRcdFx0XHRcdCcxLTktMjAyMydcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0XHRcdFx0LSBkZWZpbmVkIHRvIHNob3cgb3Igbm90XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgdGRfY2xhc3MgKXtcclxuXHJcblx0XHQvL1RPRE86IG1ha2UgZXNjYXBpbmcgb2YgdGV4dCBmb3IgcXVvdCBzeW1ib2xzLCAgYW5kIEpTL0hUTUwuLi5cclxuXHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICkuYXR0ciggJ2RhdGEtY29udGVudCcsIHRvb2x0aXBfdGV4dCApO1xyXG5cclxuXHRcdHZhciB0ZF9lbCA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKS5nZXQoIDAgKTtcdFx0XHRcdFx0Ly8gRml4SW46IDkuMC4xLjEuXHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YodGRfZWwpIClcclxuXHRcdFx0JiYgKCB1bmRlZmluZWQgPT0gdGRfZWwuX3RpcHB5IClcclxuXHRcdFx0JiYgKCAnJyAhPT0gdG9vbHRpcF90ZXh0IClcclxuXHRcdCl7XHJcblxyXG5cdFx0XHR3cGJjX3RpcHB5KCB0ZF9lbCAsIHtcclxuXHRcdFx0XHRcdGNvbnRlbnQoIHJlZmVyZW5jZSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJwb3BvdmVyIHBvcG92ZXJfdGlwcHlcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJwb3BvdmVyLWNvbnRlbnRcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyBwb3BvdmVyX2NvbnRlbnRcclxuXHRcdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdCArICc8L2Rpdj4nO1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdGFsbG93SFRNTCAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dHJpZ2dlclx0XHRcdCA6ICdtb3VzZWVudGVyIGZvY3VzJyxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdGhpZGVPbkNsaWNrICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmVCb3JkZXI6IDEwLFxyXG5cdFx0XHRcdFx0bWF4V2lkdGggICAgICAgICA6IDU1MCxcclxuXHRcdFx0XHRcdHRoZW1lICAgICAgICAgICAgOiAnd3BiYy10aXBweS10aW1lcycsXHJcblx0XHRcdFx0XHRwbGFjZW1lbnQgICAgICAgIDogJ3RvcCcsXHJcblx0XHRcdFx0XHRkZWxheVx0XHRcdCA6IFs0MDAsIDBdLFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjQuMi4yLlxyXG5cdFx0XHRcdFx0Ly9kZWxheVx0XHRcdCA6IFswLCA5OTk5OTk5OTk5XSxcdFx0XHRcdFx0XHQvLyBEZWJ1Z2UgIHRvb2x0aXBcclxuXHRcdFx0XHRcdGlnbm9yZUF0dHJpYnV0ZXMgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dG91Y2hcdFx0XHQgOiB0cnVlLFx0XHRcdFx0XHRcdFx0XHQvL1snaG9sZCcsIDUwMF0sIC8vIDUwMG1zIGRlbGF5XHRcdFx0XHQvLyBGaXhJbjogOS4yLjEuNS5cclxuXHRcdFx0XHRcdGFwcGVuZFRvOiAoKSA9PiBkb2N1bWVudC5ib2R5LFxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybiAgdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBEYXRlcyBGdW5jdGlvbnMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEdldCBudW1iZXIgb2YgZGF0ZXMgYmV0d2VlbiAyIEpTIERhdGVzXHJcbiAqXHJcbiAqIEBwYXJhbSBkYXRlMVx0XHRKUyBEYXRlXHJcbiAqIEBwYXJhbSBkYXRlMlx0XHRKUyBEYXRlXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oZGF0ZTEsIGRhdGUyKSB7XHJcblxyXG4gICAgLy8gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgaW4gb25lIGRheVxyXG4gICAgdmFyIE9ORV9EQVkgPSAxMDAwICogNjAgKiA2MCAqIDI0O1xyXG5cclxuICAgIC8vIENvbnZlcnQgYm90aCBkYXRlcyB0byBtaWxsaXNlY29uZHNcclxuICAgIHZhciBkYXRlMV9tcyA9IGRhdGUxLmdldFRpbWUoKTtcclxuICAgIHZhciBkYXRlMl9tcyA9IGRhdGUyLmdldFRpbWUoKTtcclxuXHJcbiAgICAvLyBDYWxjdWxhdGUgdGhlIGRpZmZlcmVuY2UgaW4gbWlsbGlzZWNvbmRzXHJcbiAgICB2YXIgZGlmZmVyZW5jZV9tcyA9ICBkYXRlMV9tcyAtIGRhdGUyX21zO1xyXG5cclxuICAgIC8vIENvbnZlcnQgYmFjayB0byBkYXlzIGFuZCByZXR1cm5cclxuICAgIHJldHVybiBNYXRoLnJvdW5kKGRpZmZlcmVuY2VfbXMvT05FX0RBWSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2hlY2sgIGlmIHRoaXMgYXJyYXkgIG9mIGRhdGVzIGlzIGNvbnNlY3V0aXZlIGFycmF5ICBvZiBkYXRlcyBvciBub3QuXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddIC0+IGZhbHNlXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTEwJywnMjAyNC0wNS0xMSddIC0+IHRydWVcclxuICogQHBhcmFtIHNxbF9kYXRlc19hcnJcdCBhcnJheVx0XHRlLmcuOiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBzcWxfZGF0ZXNfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cclxuXHRpZiAoIHNxbF9kYXRlc19hcnIubGVuZ3RoID4gMSApe1xyXG5cdFx0dmFyIHByZXZpb3NfZGF0ZSA9IHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2RhdGVzX2FyclsgMCBdICk7XHJcblx0XHR2YXIgY3VycmVudF9kYXRlO1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMTsgaSA8IHNxbF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0Y3VycmVudF9kYXRlID0gd3BiY19fZ2V0X19qc19kYXRlKCBzcWxfZGF0ZXNfYXJyW2ldICk7XHJcblxyXG5cdFx0XHRpZiAoIHdwYmNfZGF0ZXNfX2RheXNfYmV0d2VlbiggY3VycmVudF9kYXRlLCBwcmV2aW9zX2RhdGUgKSAhPSAxICl7XHJcblx0XHRcdFx0cmV0dXJuICBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cHJldmlvc19kYXRlID0gY3VycmVudF9kYXRlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBBdXRvIERhdGVzIFNlbGVjdGlvbiAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogID09IEhvdyB0byAgdXNlID8gPT1cclxuICpcclxuICogIEZvciBEYXRlcyBzZWxlY3Rpb24sIHdlIG5lZWQgdG8gdXNlIHRoaXMgbG9naWMhICAgICBXZSBuZWVkIHNlbGVjdCB0aGUgZGF0ZXMgb25seSBhZnRlciBib29raW5nIGRhdGEgbG9hZGVkIVxyXG4gKlxyXG4gKiAgQ2hlY2sgZXhhbXBsZSBiZWxsb3cuXHJcbiAqXHJcbiAqXHQvLyBGaXJlIG9uIGFsbCBib29raW5nIGRhdGVzIGxvYWRlZFxyXG4gKlx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uICggZXZlbnQsIGxvYWRlZF9yZXNvdXJjZV9pZCApe1xyXG4gKlxyXG4gKlx0XHRpZiAoIGxvYWRlZF9yZXNvdXJjZV9pZCA9PSBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQgKXtcclxuICpcdFx0XHR3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqXHRcdH1cclxuICpcdH0gKTtcclxuICpcclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqIFRyeSB0byBBdXRvIHNlbGVjdCBkYXRlcyBpbiBzcGVjaWZpYyBjYWxlbmRhciBieSBzaW11bGF0ZWQgY2xpY2tzIGluIGRhdGVwaWNrZXJcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdDFcclxuICogQHBhcmFtIGNoZWNrX2luX3ltZFx0XHQnMjAyNC0wNS0wOSdcdFx0T1IgIFx0WycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjAnXVxyXG4gKiBAcGFyYW0gY2hlY2tfb3V0X3ltZFx0XHQnMjAyNC0wNS0xNSdcdFx0T3B0aW9uYWxcclxuICpcclxuICogQHJldHVybnMge251bWJlcn1cdFx0bnVtYmVyIG9mIHNlbGVjdGVkIGRhdGVzXHJcbiAqXHJcbiAqIFx0RXhhbXBsZSAxOlx0XHRcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggMSwgJzIwMjQtMDUtMTUnLFxyXG4gKiAgICAgJzIwMjQtMDUtMjUnICk7IEV4YW1wbGUgMjpcdFx0XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIDEsXHJcbiAqICAgICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0yMCddICk7XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kID0gJycgKXtcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC40Ny5cclxuXHJcblx0Y29uc29sZS5sb2coICdXUEJDX0FVVE9fU0VMRUNUX0RBVEVTX0lOX0NBTEVOREFSKCBSRVNPVVJDRV9JRCwgQ0hFQ0tfSU5fWU1ELCBDSEVDS19PVVRfWU1EICknLCByZXNvdXJjZV9pZCwgY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kICk7XHJcblxyXG5cdGlmIChcclxuXHRcdCAgICggJzIxMDAtMDEtMDEnID09IGNoZWNrX2luX3ltZCApXHJcblx0XHR8fCAoICcyMTAwLTAxLTAxJyA9PSBjaGVja19vdXRfeW1kIClcclxuXHRcdHx8ICggKCAnJyA9PSBjaGVja19pbl95bWQgKSAmJiAoICcnID09IGNoZWNrX291dF95bWQgKSApXHJcblx0KXtcclxuXHRcdHJldHVybiAwO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBJZiBcdGNoZWNrX2luX3ltZCAgPSAgWyAnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJyBdXHRcdFx0XHRBUlJBWSBvZiBEQVRFU1x0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTAuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgZGF0ZXNfdG9fc2VsZWN0X2FyciA9IFtdO1xyXG5cdGlmICggQXJyYXkuaXNBcnJheSggY2hlY2tfaW5feW1kICkgKXtcclxuXHRcdGRhdGVzX3RvX3NlbGVjdF9hcnIgPSB3cGJjX2Nsb25lX29iaiggY2hlY2tfaW5feW1kICk7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRXhjZXB0aW9ucyB0byAgc2V0ICBcdE1VTFRJUExFIERBWVMgXHRtb2RlXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBpZiBkYXRlcyBhcyBOT1QgQ09OU0VDVVRJVkU6IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ10sIC0+IHNldCBNVUxUSVBMRSBEQVlTIG1vZGVcclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKVxyXG5cdFx0XHQmJiAoICcnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0XHQmJiAoICEgd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBkYXRlc190b19zZWxlY3RfYXJyICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0Ly8gaWYgbXVsdGlwbGUgZGF5cyB0byBzZWxlY3QsIGJ1dCBlbmFibGVkIFNJTkdMRSBkYXkgbW9kZSwgLT4gc2V0IE1VTFRJUExFIERBWVMgbW9kZVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoID4gMSApXHJcblx0XHRcdCYmICggJycgPT0gY2hlY2tfb3V0X3ltZCApXHJcblx0XHRcdCYmICggJ3NpbmdsZScgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApXHJcblx0XHQpe1xyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRjaGVja19pbl95bWQgPSBkYXRlc190b19zZWxlY3RfYXJyWyAwIF07XHJcblx0XHRpZiAoICcnID09IGNoZWNrX291dF95bWQgKXtcclxuXHRcdFx0Y2hlY2tfb3V0X3ltZCA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIChkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aC0xKSBdO1xyXG5cdFx0fVxyXG5cdH1cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0aWYgKCAnJyA9PSBjaGVja19pbl95bWQgKXtcclxuXHRcdGNoZWNrX2luX3ltZCA9IGNoZWNrX291dF95bWQ7XHJcblx0fVxyXG5cdGlmICggJycgPT0gY2hlY2tfb3V0X3ltZCApe1xyXG5cdFx0Y2hlY2tfb3V0X3ltZCA9IGNoZWNrX2luX3ltZDtcclxuXHR9XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRyZXNvdXJjZV9pZCA9ICcxJztcclxuXHR9XHJcblxyXG5cclxuXHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHQvLyBVbnNlbGVjdCBhbGwgZGF0ZXMgYW5kIHNldCAgcHJvcGVydGllcyBvZiBEYXRlcGlja1xyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTsgICAgICBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogNS40LjNcclxuXHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdGluc3QuZGF0ZXMgPSBbXTtcclxuXHRcdHZhciBjaGVja19pbl9qcyA9IHdwYmNfX2dldF9fanNfZGF0ZSggY2hlY2tfaW5feW1kICk7XHJcblx0XHR2YXIgdGRfY2VsbCAgICAgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19pbl9qcyApO1xyXG5cclxuXHRcdC8vIElzIG9tZSB0eXBlIG9mIGVycm9yLCB0aGVuIHNlbGVjdCBtdWx0aXBsZSBkYXlzIHNlbGVjdGlvbiAgbW9kZS5cclxuXHRcdGlmICggJycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApIHtcclxuIFx0XHRcdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScsICdtdWx0aXBsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRFlOQU1JQyA9PVxyXG5cdFx0aWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cdFx0XHQvLyAxLXN0IGNsaWNrXHJcblx0XHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0XHRpZiAoIDAgPT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdFx0cmV0dXJuIDA7ICBcdFx0XHRcdFx0XHRcdFx0Ly8gRmlyc3QgY2xpY2sgIHdhcyB1bnN1Y2Nlc3NmdWwsIHNvIHdlIG11c3Qgbm90IG1ha2Ugb3RoZXIgY2xpY2tcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gMi1uZCBjbGlja1xyXG5cdFx0XHR2YXIgY2hlY2tfb3V0X2pzID0gd3BiY19fZ2V0X19qc19kYXRlKCBjaGVja19vdXRfeW1kICk7XHJcblx0XHRcdHZhciB0ZF9jZWxsX291dCA9IHdwYmNfZ2V0X2NsaWNrZWRfdGQoIGluc3QuaWQsIGNoZWNrX291dF9qcyApO1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gdHJ1ZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGxfb3V0LCAnIycgKyBpbnN0LmlkLCBjaGVja19vdXRfanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRklYRUQgPT1cclxuXHRcdGlmICggICdmaXhlZCcgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSkge1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gU0lOR0xFID09XHJcblx0XHRpZiAoICdzaW5nbGUnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdFx0Ly9qUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGNoZWNrX2luX2pzLCBudWxsICkgKTtcdFx0Ly8gRG8gd2UgbmVlZCB0byBydW4gIHRoaXMgPyBQbGVhc2Ugbm90ZSwgY2hlY2tfaW5fanMgbXVzdCAgaGF2ZSB0aW1lLCAgbWluLCBzZWMgZGVmaW5lZCB0byAwIVxyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gTVVMVElQTEUgPT1cclxuXHRcdGlmICggJ211bHRpcGxlJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyO1xyXG5cclxuXHRcdFx0aWYgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0XHQvLyBTaXR1YXRpb24sIHdoZW4gd2UgaGF2ZSBkYXRlcyBhcnJheTogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXS4gIGFuZCBub3QgdGhlIENoZWNrIEluIC8gQ2hlY2sgIG91dCBkYXRlcyBhcyBwYXJhbWV0ZXIgaW4gdGhpcyBmdW5jdGlvblxyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2FyciggZGF0ZXNfdG9fc2VsZWN0X2FyciApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kLCBpbnN0ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggMCA9PT0gZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGb3IgQ2FsZW5kYXIgRGF5cyBzZWxlY3Rpb25cclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aDsgaisrICl7ICAgICAgIC8vIExvb3AgYXJyYXkgb2YgZGF0ZXNcclxuXHJcblx0XHRcdFx0dmFyIHN0cl9kYXRlID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHJcblx0XHRcdFx0Ly8gRGF0ZSB1bmF2YWlsYWJsZSAhXHJcblx0XHRcdFx0aWYgKCAwID09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzdHJfZGF0ZSApLmRheV9hdmFpbGFiaWxpdHkgKXtcclxuXHRcdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBkYXRlc19hcnIuZGF0ZXNfanNbIGogXSAhPSAtMSApIHtcclxuXHRcdFx0XHRcdGluc3QuZGF0ZXMucHVzaCggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBjaGVja19vdXRfZGF0ZSA9IGRhdGVzX2Fyci5kYXRlc19qc1sgKGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGggLSAxKSBdO1xyXG5cclxuXHRcdFx0aW5zdC5kYXRlcy5wdXNoKCBjaGVja19vdXRfZGF0ZSApOyBcdFx0XHQvLyBOZWVkIGFkZCBvbmUgYWRkaXRpb25hbCBTQU1FIGRhdGUgZm9yIGNvcnJlY3QgIHdvcmtzIG9mIGRhdGVzIHNlbGVjdGlvbiAhISEhIVxyXG5cclxuXHRcdFx0dmFyIGNoZWNrb3V0X3RpbWVzdGFtcCA9IGNoZWNrX291dF9kYXRlLmdldFRpbWUoKTtcclxuXHRcdFx0dmFyIHRkX2NlbGwgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19vdXRfZGF0ZSApO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrb3V0X3RpbWVzdGFtcCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRpZiAoIDAgIT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdC8vIFNjcm9sbCB0byBzcGVjaWZpYyBtb250aCwgaWYgd2Ugc2V0IGRhdGVzIGluIHNvbWUgZnV0dXJlIG1vbnRoc1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBpbnN0LmRhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSwgaW5zdC5kYXRlc1sgMCBdLmdldE1vbnRoKCkrMSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBpbnN0LmRhdGVzLmxlbmd0aDtcclxuXHR9XHJcblxyXG5cdHJldHVybiAwO1xyXG59XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBIVE1MIHRkIGVsZW1lbnQgKHdoZXJlIHdhcyBjbGljayBpbiBjYWxlbmRhciAgZGF5ICBjZWxsKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX2h0bWxfaWRcdFx0XHQnY2FsZW5kYXJfYm9va2luZzEnXHJcblx0ICogQHBhcmFtIGRhdGVfanNcdFx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHsqfGpRdWVyeX1cdFx0XHRcdERvbSBIVE1MIHRkIGVsZW1lbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9jbGlja2VkX3RkKCBjYWxlbmRhcl9odG1sX2lkLCBkYXRlX2pzICl7XHJcblxyXG5cdCAgICB2YXIgdGRfY2VsbCA9IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfaHRtbF9pZCArICcgLnNxbF9kYXRlXycgKyB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlX2pzICkgKS5nZXQoIDAgKTtcclxuXHJcblx0XHRyZXR1cm4gdGRfY2VsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNoZWNrX2luX3ltZFx0XHRcdFx0XHRcdFx0JzIwMjQtMDUtMTUnXHJcblx0ICogQHBhcmFtIGNoZWNrX291dF95bWRcdFx0XHRcdFx0XHRcdCcyMDI0LTA1LTI1J1xyXG5cdCAqIEBwYXJhbSBpbnN0XHRcdFx0XHRcdFx0XHRcdFx0RGF0ZXBpY2sgSW5zdC4gVXNlIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdCAqIEByZXR1cm5zIHt7ZGF0ZXNfanM6ICpbXSwgZGF0ZXNfc3RyOiAqW119fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kICwgaW5zdCApe1xyXG5cclxuXHRcdHZhciBvcmlnaW5hbF9hcnJheSA9IFtdO1xyXG5cdFx0dmFyIGRhdGU7XHJcblx0XHR2YXIgYmtfZGlzdGluY3RfZGF0ZXMgPSBbXTtcclxuXHJcblx0XHR2YXIgY2hlY2tfaW5fZGF0ZSA9IGNoZWNrX2luX3ltZC5zcGxpdCggJy0nICk7XHJcblx0XHR2YXIgY2hlY2tfb3V0X2RhdGUgPSBjaGVja19vdXRfeW1kLnNwbGl0KCAnLScgKTtcclxuXHJcblx0XHRkYXRlID0gbmV3IERhdGUoKTtcclxuXHRcdGRhdGUuc2V0RnVsbFllYXIoIGNoZWNrX2luX2RhdGVbIDAgXSwgKGNoZWNrX2luX2RhdGVbIDEgXSAtIDEpLCBjaGVja19pbl9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgPSBkYXRlO1xyXG5cdFx0b3JpZ2luYWxfYXJyYXkucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBkYXRlLCBudWxsICkgKSApOyAvL2FkZCBkYXRlXHJcblx0XHRpZiAoICEgd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChjaGVja19pbl9kYXRlWyAyIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAxIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0pICkgKXtcclxuXHRcdFx0YmtfZGlzdGluY3RfZGF0ZXMucHVzaCggcGFyc2VJbnQoY2hlY2tfaW5fZGF0ZVsgMiBdKSArICcuJyArIHBhcnNlSW50KGNoZWNrX2luX2RhdGVbIDEgXSkgKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0gKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZGF0ZV9vdXQgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0ZGF0ZV9vdXQuc2V0RnVsbFllYXIoIGNoZWNrX291dF9kYXRlWyAwIF0sIChjaGVja19vdXRfZGF0ZVsgMSBdIC0gMSksIGNoZWNrX291dF9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID0gZGF0ZV9vdXQ7XHJcblxyXG5cdFx0dmFyIG1ld0RhdGUgPSBuZXcgRGF0ZSggb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXRGdWxsWWVhcigpLCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldE1vbnRoKCksIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICk7XHJcblx0XHRtZXdEYXRlLnNldERhdGUoIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICsgMSApO1xyXG5cclxuXHRcdHdoaWxlIChcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID4gZGF0ZSkgJiZcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgIT0gb3JpZ2luYWxfY2hlY2tfb3V0X2RhdGUpICl7XHJcblx0XHRcdGRhdGUgPSBuZXcgRGF0ZSggbWV3RGF0ZS5nZXRGdWxsWWVhcigpLCBtZXdEYXRlLmdldE1vbnRoKCksIG1ld0RhdGUuZ2V0RGF0ZSgpICk7XHJcblxyXG5cdFx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCBqUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGRhdGUsIG51bGwgKSApICk7IC8vYWRkIGRhdGVcclxuXHRcdFx0aWYgKCAhd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChkYXRlLmdldERhdGUoKSArICcuJyArIHBhcnNlSW50KCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLicgKyBkYXRlLmdldEZ1bGxZZWFyKCkpICkgKXtcclxuXHRcdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCAocGFyc2VJbnQoZGF0ZS5nZXREYXRlKCkpICsgJy4nICsgcGFyc2VJbnQoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICcuJyArIGRhdGUuZ2V0RnVsbFllYXIoKSkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWV3RGF0ZSA9IG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKTtcclxuXHRcdFx0bWV3RGF0ZS5zZXREYXRlKCBtZXdEYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHRcdG9yaWdpbmFsX2FycmF5LnBvcCgpO1xyXG5cdFx0YmtfZGlzdGluY3RfZGF0ZXMucG9wKCk7XHJcblxyXG5cdFx0cmV0dXJuIHsnZGF0ZXNfanMnOiBvcmlnaW5hbF9hcnJheSwgJ2RhdGVzX3N0cic6IGJrX2Rpc3RpbmN0X2RhdGVzfTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVzX3RvX3NlbGVjdF9hcnJcdD0gWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXVxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3tkYXRlc19qczogKltdLCBkYXRlc19zdHI6ICpbXX19XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfc2VsZWN0aW9uX2RhdGVzX2pzX3N0cl9hcnJfX2Zyb21fYXJyKCBkYXRlc190b19zZWxlY3RfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cclxuXHRcdHZhciBvcmlnaW5hbF9hcnJheSAgICA9IFtdO1xyXG5cdFx0dmFyIGJrX2Rpc3RpbmN0X2RhdGVzID0gW107XHJcblx0XHR2YXIgb25lX2RhdGVfc3RyO1xyXG5cclxuXHRcdGZvciAoIHZhciBkID0gMDsgZCA8IGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoOyBkKysgKXtcclxuXHJcblx0XHRcdG9yaWdpbmFsX2FycmF5LnB1c2goIHdwYmNfX2dldF9fanNfZGF0ZSggZGF0ZXNfdG9fc2VsZWN0X2FyclsgZCBdICkgKTtcclxuXHJcblx0XHRcdG9uZV9kYXRlX3N0ciA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIGQgXS5zcGxpdCgnLScpXHJcblx0XHRcdGlmICggISB3cGJjX2luX2FycmF5KCBia19kaXN0aW5jdF9kYXRlcywgKG9uZV9kYXRlX3N0clsgMiBdICsgJy4nICsgb25lX2RhdGVfc3RyWyAxIF0gKyAnLicgKyBvbmVfZGF0ZV9zdHJbIDAgXSkgKSApe1xyXG5cdFx0XHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnB1c2goIHBhcnNlSW50KG9uZV9kYXRlX3N0clsgMiBdKSArICcuJyArIHBhcnNlSW50KG9uZV9kYXRlX3N0clsgMSBdKSArICcuJyArIG9uZV9kYXRlX3N0clsgMCBdICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4geydkYXRlc19qcyc6IG9yaWdpbmFsX2FycmF5LCAnZGF0ZXNfc3RyJzogb3JpZ2luYWxfYXJyYXl9O1xyXG5cdH1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vKiAgPT0gIEF1dG8gRmlsbCBGaWVsZHMgLyBBdXRvIFNlbGVjdCBEYXRlcyAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHR2YXIgdXJsX3BhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2ggKTtcclxuXHJcblx0Ly8gRGlzYWJsZSBkYXlzIHNlbGVjdGlvbiAgaW4gY2FsZW5kYXIsICBhZnRlciAgcmVkaXJlY3Rpb24gIGZyb20gIHRoZSBcIlNlYXJjaCByZXN1bHRzIHBhZ2UsICBhZnRlciAgc2VhcmNoICBhdmFpbGFiaWxpdHlcIiBcdFx0XHQvLyBGaXhJbjogOC44LjIuMy5cclxuXHRpZiAgKCAnT24nICE9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfYm9va2luZ19zZWFyY2hfcmVzdWx0c19kYXlzX3NlbGVjdCcgKSApIHtcclxuXHRcdGlmIChcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NoZWNrX2luJyApICkgJiZcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NoZWNrX291dCcgKSApICYmXHJcblx0XHRcdCggdXJsX3BhcmFtcy5oYXMoICd3cGJjX3NlbGVjdF9jYWxlbmRhcl9pZCcgKSApXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0dmFyIHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCA9IHBhcnNlSW50KCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NhbGVuZGFyX2lkJyApICk7XHJcblxyXG5cdFx0XHQvLyBGaXJlIG9uIGFsbCBib29raW5nIGRhdGVzIGxvYWRlZFxyXG5cdFx0XHRqUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24gKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHRcdGlmICggbG9hZGVkX3Jlc291cmNlX2lkID09IHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCApe1xyXG5cdFx0XHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkLCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NoZWNrX2luJyApLCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NoZWNrX291dCcgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfYXV0b19maWxsJyApICl7XHJcblxyXG5cdFx0dmFyIHdwYmNfYXV0b19maWxsX3ZhbHVlID0gdXJsX3BhcmFtcy5nZXQoICd3cGJjX2F1dG9fZmlsbCcgKTtcclxuXHJcblx0XHQvLyBDb252ZXJ0IGJhY2suICAgICBTb21lIHN5c3RlbXMgZG8gbm90IGxpa2Ugc3ltYm9sICd+JyBpbiBVUkwsIHNvICB3ZSBuZWVkIHRvIHJlcGxhY2UgdG8gIHNvbWUgb3RoZXIgc3ltYm9sc1xyXG5cdFx0d3BiY19hdXRvX2ZpbGxfdmFsdWUgPSB3cGJjX2F1dG9fZmlsbF92YWx1ZS5yZXBsYWNlQWxsKCAnX15fJywgJ34nICk7XHJcblxyXG5cdFx0d3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHMoIHdwYmNfYXV0b19maWxsX3ZhbHVlICk7XHJcblx0fVxyXG5cclxufSApO1xyXG5cclxuLyoqXHJcbiAqIEF1dG9maWxsIC8gc2VsZWN0IGJvb2tpbmcgZm9ybSAgZmllbGRzIGJ5ICB2YWx1ZXMgZnJvbSAgdGhlIEdFVCByZXF1ZXN0ICBwYXJhbWV0ZXI6ID93cGJjX2F1dG9fZmlsbD1cclxuICpcclxuICogQHBhcmFtIGF1dG9fZmlsbF9zdHJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzKCBhdXRvX2ZpbGxfc3RyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjQ4LlxyXG5cclxuXHRpZiAoICcnID09IGF1dG9fZmlsbF9zdHIgKXtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG4vLyBjb25zb2xlLmxvZyggJ1dQQkNfQVVUT19GSUxMX0JPT0tJTkdfRklFTERTKCBBVVRPX0ZJTExfU1RSICknLCBhdXRvX2ZpbGxfc3RyKTtcclxuXHJcblx0dmFyIGZpZWxkc19hcnIgPSB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UoIGF1dG9fZmlsbF9zdHIgKTtcclxuXHJcblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgZmllbGRzX2Fyci5sZW5ndGg7IGkrKyApe1xyXG5cdFx0alF1ZXJ5KCAnW25hbWU9XCInICsgZmllbGRzX2FyclsgaSBdWyAnbmFtZScgXSArICdcIl0nICkudmFsKCBmaWVsZHNfYXJyWyBpIF1bICd2YWx1ZScgXSApO1xyXG5cdH1cclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBkYXRhIGZyb20gIGdldCBwYXJhbWV0ZXI6XHQ/d3BiY19hdXRvX2ZpbGw9dmlzaXRvcnMyMzFeMn5tYXhfY2FwYWNpdHkyMzFeMlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGFfc3RyICAgICAgPSAgICd2aXNpdG9yczIzMV4yfm1heF9jYXBhY2l0eTIzMV4yJztcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UoIGRhdGFfc3RyICl7XHJcblxyXG5cdFx0dmFyIGZpbHRlcl9vcHRpb25zX2FyciA9IFtdO1xyXG5cclxuXHRcdHZhciBkYXRhX2FyciA9IGRhdGFfc3RyLnNwbGl0KCAnficgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBkYXRhX2Fyci5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0dmFyIG15X2Zvcm1fZmllbGQgPSBkYXRhX2FyclsgaiBdLnNwbGl0KCAnXicgKTtcclxuXHJcblx0XHRcdHZhciBmaWx0ZXJfbmFtZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMCBdKSkgPyBteV9mb3JtX2ZpZWxkWyAwIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl92YWx1ZSA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAxIF0pKSA/IG15X2Zvcm1fZmllbGRbIDEgXSA6ICcnO1xyXG5cclxuXHRcdFx0ZmlsdGVyX29wdGlvbnNfYXJyLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICA6IGZpbHRlcl9uYW1lLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlJyA6IGZpbHRlcl92YWx1ZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCAgICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmlsdGVyX29wdGlvbnNfYXJyO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgZGF0YSBmcm9tICBnZXQgcGFyYW1ldGVyOlx0P3NlYXJjaF9nZXRfX2N1c3RvbV9wYXJhbXM9Li4uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0YV9zdHIgICAgICA9ICAgJ3RleHRec2VhcmNoX2ZpZWxkX19kaXNwbGF5X2NoZWNrX2luXjIzLjA1LjIwMjR+dGV4dF5zZWFyY2hfZmllbGRfX2Rpc3BsYXlfY2hlY2tfb3V0XjI2LjA1LjIwMjR+c2VsZWN0Ym94LW9uZV5zZWFyY2hfcXVhbnRpdHleMn5zZWxlY3Rib3gtb25lXmxvY2F0aW9uXlNwYWlufnNlbGVjdGJveC1vbmVebWF4X2NhcGFjaXR5XjJ+c2VsZWN0Ym94LW9uZV5hbWVuaXR5XnBhcmtpbmd+Y2hlY2tib3hec2VhcmNoX2ZpZWxkX19leHRlbmRfc2VhcmNoX2RheXNeNX5zdWJtaXReXlNlYXJjaH5oaWRkZW5ec2VhcmNoX2dldF9fY2hlY2tfaW5feW1kXjIwMjQtMDUtMjN+aGlkZGVuXnNlYXJjaF9nZXRfX2NoZWNrX291dF95bWReMjAyNC0wNS0yNn5oaWRkZW5ec2VhcmNoX2dldF9fdGltZV5+aGlkZGVuXnNlYXJjaF9nZXRfX3F1YW50aXR5XjJ+aGlkZGVuXnNlYXJjaF9nZXRfX2V4dGVuZF41fmhpZGRlbl5zZWFyY2hfZ2V0X191c2Vyc19pZF5+aGlkZGVuXnNlYXJjaF9nZXRfX2N1c3RvbV9wYXJhbXNefic7XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdXRvX2ZpbGxfc2VhcmNoX2ZpZWxkc19fcGFyc2UoIGRhdGFfc3RyICl7XHJcblxyXG5cdFx0dmFyIGZpbHRlcl9vcHRpb25zX2FyciA9IFtdO1xyXG5cclxuXHRcdHZhciBkYXRhX2FyciA9IGRhdGFfc3RyLnNwbGl0KCAnficgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBkYXRhX2Fyci5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0dmFyIG15X2Zvcm1fZmllbGQgPSBkYXRhX2FyclsgaiBdLnNwbGl0KCAnXicgKTtcclxuXHJcblx0XHRcdHZhciBmaWx0ZXJfdHlwZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMCBdKSkgPyBteV9mb3JtX2ZpZWxkWyAwIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl9uYW1lICA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAxIF0pKSA/IG15X2Zvcm1fZmllbGRbIDEgXSA6ICcnO1xyXG5cdFx0XHR2YXIgZmlsdGVyX3ZhbHVlID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDIgXSkpID8gbXlfZm9ybV9maWVsZFsgMiBdIDogJyc7XHJcblxyXG5cdFx0XHRmaWx0ZXJfb3B0aW9uc19hcnIucHVzaChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgIDogZmlsdGVyX3R5cGUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgIDogZmlsdGVyX25hbWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWUnIDogZmlsdGVyX3ZhbHVlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0ICAgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBmaWx0ZXJfb3B0aW9uc19hcnI7XHJcblx0fVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIEF1dG8gVXBkYXRlIG51bWJlciBvZiBtb250aHMgaW4gY2FsZW5kYXJzIE9OIHNjcmVlbiBzaXplIGNoYW5nZWQgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEF1dG8gVXBkYXRlIE51bWJlciBvZiBNb250aHMgaW4gQ2FsZW5kYXIsIGUuZy46ICBcdFx0aWYgICAgKCBXSU5ET1dfV0lEVEggPD0gNzgycHggKSAgID4+PiBcdE1PTlRIU19OVU1CRVIgPSAxXHJcbiAqICAgRUxTRTogIG51bWJlciBvZiBtb250aHMgZGVmaW5lZCBpbiBzaG9ydGNvZGUuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCBpbnRcclxuICpcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXJfX29uX3Jlc2l6ZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0aWYgKCB0cnVlID09PSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19hbGxvd19zZXZlcmFsX21vbnRoc19vbl9tb2JpbGUnICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR2YXIgbG9jYWxfX251bWJlcl9vZl9tb250aHMgPSBwYXJzZUludCggX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJyApICk7XHJcblxyXG5cdGlmICggbG9jYWxfX251bWJlcl9vZl9tb250aHMgPiAxICl7XHJcblxyXG5cdFx0aWYgKCBqUXVlcnkoIHdpbmRvdyApLndpZHRoKCkgPD0gNzgyICl7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9tb250aHNfbnVtYmVyKCByZXNvdXJjZV9pZCwgMSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fdXBkYXRlX21vbnRoc19udW1iZXIoIHJlc291cmNlX2lkLCBsb2NhbF9fbnVtYmVyX29mX21vbnRocyApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdXRvIFVwZGF0ZSBOdW1iZXIgb2YgTW9udGhzIGluICAgQUxMICAgQ2FsZW5kYXJzXHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpe1xyXG5cclxuXHR2YXIgYWxsX2NhbGVuZGFyc19hcnIgPSBfd3BiYy5jYWxlbmRhcnNfYWxsX19nZXQoKTtcclxuXHJcblx0Ly8gVGhpcyBMT09QIFwiZm9yIGluXCIgaXMgR09PRCwgYmVjYXVzZSB3ZSBjaGVjayAgaGVyZSBrZXlzICAgICdjYWxlbmRhcl8nID09PSBjYWxlbmRhcl9pZC5zbGljZSggMCwgOSApXHJcblx0Zm9yICggdmFyIGNhbGVuZGFyX2lkIGluIGFsbF9jYWxlbmRhcnNfYXJyICl7XHJcblx0XHRpZiAoICdjYWxlbmRhcl8nID09PSBjYWxlbmRhcl9pZC5zbGljZSggMCwgOSApICl7XHJcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IHBhcnNlSW50KCBjYWxlbmRhcl9pZC5zbGljZSggOSApICk7XHRcdFx0Ly8gICdjYWxlbmRhcl8zJyAtPiAzXHJcblx0XHRcdGlmICggcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9fYXV0b191cGRhdGVfbW9udGhzX251bWJlcl9fb25fcmVzaXplKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogSWYgYnJvd3NlciB3aW5kb3cgY2hhbmdlZCwgIHRoZW4gIHVwZGF0ZSBudW1iZXIgb2YgbW9udGhzLlxyXG4gKi9cclxualF1ZXJ5KCB3aW5kb3cgKS5vbiggJ3Jlc2l6ZScsIGZ1bmN0aW9uICgpe1xyXG5cdHdwYmNfY2FsZW5kYXJzX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyKCk7XHJcbn0gKTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvIHVwZGF0ZSBjYWxlbmRhciBudW1iZXIgb2YgbW9udGhzIG9uIGluaXRpYWwgcGFnZSBsb2FkXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdHdwYmNfY2FsZW5kYXJzX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyKCk7XHJcblx0fSwgMTAwICk7XHJcbn0pO1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgQ2hlY2s6IGNhbGVuZGFyX2RhdGVzX3N0YXJ0OiBcIjIwMjYtMDEtMDFcIiwgY2FsZW5kYXJfZGF0ZXNfZW5kOiBcIjIwMjYtMTItMzFcIiA9PSAgLy8gRml4SW46IDEwLjEzLjEuNC5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblx0LyoqXHJcblx0ICogR2V0IFN0YXJ0IEpTIERhdGUgb2Ygc3RhcnRpbmcgZGF0ZXMgaW4gY2FsZW5kYXIsIGZyb20gdGhlIF93cGJjIG9iamVjdC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBpbnRlZ2VyIHJlc291cmNlX2lkIC0gcmVzb3VyY2UgSUQsIGUuZy46IDEuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX3N0YXJ0KCByZXNvdXJjZV9pZCApIHtcclxuXHRcdHJldHVybiB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZV9wYXJhbWV0ZXIoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfZGF0ZXNfc3RhcnQnICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgRW5kIEpTIERhdGUgb2YgZW5kaW5nIGRhdGVzIGluIGNhbGVuZGFyLCBmcm9tIHRoZSBfd3BiYyBvYmplY3QuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gaW50ZWdlciByZXNvdXJjZV9pZCAtIHJlc291cmNlIElELCBlLmcuOiAxLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19lbmQocmVzb3VyY2VfaWQpIHtcclxuXHRcdHJldHVybiB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZV9wYXJhbWV0ZXIoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfZGF0ZXNfZW5kJyApO1xyXG5cdH1cclxuXHJcbi8qKlxyXG4gKiBHZXQgdmFsaWRhdGVzIGRhdGUgcGFyYW1ldGVyLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgICAtIDFcclxuICogQHBhcmFtIHBhcmFtZXRlcl9zdHIgLSAnY2FsZW5kYXJfZGF0ZXNfc3RhcnQnIHwgJ2NhbGVuZGFyX2RhdGVzX2VuZCcgfCAuLi5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlX3BhcmFtZXRlcihyZXNvdXJjZV9pZCwgcGFyYW1ldGVyX3N0cikge1xyXG5cclxuXHR2YXIgZGF0ZV9leHBlY3RlZF95bWQgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgcGFyYW1ldGVyX3N0ciApO1xyXG5cclxuXHRpZiAoICEgZGF0ZV9leHBlY3RlZF95bWQgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7ICAgICAgICAgICAgIC8vICcnIHwgMCB8IG51bGwgfCB1bmRlZmluZWQgIC0+IGZhbHNlLlxyXG5cdH1cclxuXHJcblx0aWYgKCAtMSAhPT0gZGF0ZV9leHBlY3RlZF95bWQuaW5kZXhPZiggJy0nICkgKSB7XHJcblxyXG5cdFx0dmFyIGRhdGVfZXhwZWN0ZWRfeW1kX2FyciA9IGRhdGVfZXhwZWN0ZWRfeW1kLnNwbGl0KCAnLScgKTtcdC8vICcyMDI1LTA3LTI2JyAtPiBbJzIwMjUnLCAnMDcnLCAnMjYnXVxyXG5cclxuXHRcdGlmICggZGF0ZV9leHBlY3RlZF95bWRfYXJyLmxlbmd0aCA+IDAgKSB7XHJcblx0XHRcdHZhciB5ZWFyICA9IChkYXRlX2V4cGVjdGVkX3ltZF9hcnIubGVuZ3RoID4gMCkgPyBwYXJzZUludCggZGF0ZV9leHBlY3RlZF95bWRfYXJyWzBdICkgOiBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCk7XHQvLyBZZWFyLlxyXG5cdFx0XHR2YXIgbW9udGggPSAoZGF0ZV9leHBlY3RlZF95bWRfYXJyLmxlbmd0aCA+IDEpID8gKHBhcnNlSW50KCBkYXRlX2V4cGVjdGVkX3ltZF9hcnJbMV0gKSAtIDEpIDogMDsgIC8vIChtb250aCAtIDEpIG9yIDAgLSBKYW4uXHJcblx0XHRcdHZhciBkYXkgICA9IChkYXRlX2V4cGVjdGVkX3ltZF9hcnIubGVuZ3RoID4gMikgPyBwYXJzZUludCggZGF0ZV9leHBlY3RlZF95bWRfYXJyWzJdICkgOiAxOyAgLy8gZGF0ZSBvciBPdGhlcndpc2UgMXN0IG9mIG1vbnRoXHJcblxyXG5cdFx0XHR2YXIgZGF0ZV9qcyA9IG5ldyBEYXRlKCB5ZWFyLCBtb250aCwgZGF5LCAwLCAwLCAwLCAwICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gZGF0ZV9qcztcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBmYWxzZTsgIC8vIEZhbGxiYWNrLCAgaWYgd2Ugbm90IHBhcnNlZCB0aGlzIHBhcmFtZXRlciAgJ2NhbGVuZGFyX2RhdGVzX3N0YXJ0JyA9ICcyMDI1LTA3LTI2JywgIGZvciBleGFtcGxlIGJlY2F1c2Ugb2YgJ2NhbGVuZGFyX2RhdGVzX3N0YXJ0JyA9ICdzZnNkZicuXHJcbn1cclxuIiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2NhbC9kYXlzX3NlbGVjdF9jdXN0b20uanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vLyBGaXhJbjogOS44LjkuMi5cclxuXHJcbi8qKlxyXG4gKiBSZS1Jbml0IENhbGVuZGFyIGFuZCBSZS1SZW5kZXIgaXQuXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIFJlbW92ZSBDTEFTUyAgZm9yIGFiaWxpdHkgdG8gcmUtcmVuZGVyIGFuZCByZWluaXQgY2FsZW5kYXIuXHJcblx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5yZW1vdmVDbGFzcyggJ2hhc0RhdGVwaWNrJyApO1xyXG5cdHdwYmNfY2FsZW5kYXJfc2hvdyggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBSZS1Jbml0IHByZXZpb3VzbHkgIHNhdmVkIGRheXMgc2VsZWN0aW9uICB2YXJpYWJsZXMuXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnc2F2ZWRfdmFyaWFibGVfX19kYXlzX3NlbGVjdF9pbml0aWFsJ1xyXG5cdFx0LCB7XHJcblx0XHRcdCdkeW5hbWljX19kYXlzX21pbicgICAgICAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21pbicgKSxcclxuXHRcdFx0J2R5bmFtaWNfX2RheXNfbWF4JyAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWF4JyApLFxyXG5cdFx0XHQnZHluYW1pY19fZGF5c19zcGVjaWZpYycgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19zcGVjaWZpYycgKSxcclxuXHRcdFx0J2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnICksXHJcblx0XHRcdCdmaXhlZF9fZGF5c19udW0nICAgICAgICAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdmaXhlZF9fZGF5c19udW0nICksXHJcblx0XHRcdCdmaXhlZF9fd2Vla19kYXlzX19zdGFydCcgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdmaXhlZF9fd2Vla19kYXlzX19zdGFydCcgKVxyXG5cdFx0fVxyXG5cdCk7XHJcbn1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNldCBTaW5nbGUgRGF5IHNlbGVjdGlvbiAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgU2luZ2xlIERheSBzZWxlY3Rpb25cclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdzaW5nbGUnfSApO1xyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IE11bHRpcGxlIERheXMgc2VsZWN0aW9uICAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNldCBNdWx0aXBsZSBEYXlzIHNlbGVjdGlvblxyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnbXVsdGlwbGUnfSApO1xyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNldCBGaXhlZCBEYXlzIHNlbGVjdGlvbiB3aXRoICAxIG1vdXNlIGNsaWNrICAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgLS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpIC1cclxuICogQGludGVnZXIgZGF5c19udW1iZXJcdFx0XHQtIDNcdFx0XHRcdCAgIC0tIG51bWJlciBvZiBkYXlzIHRvICBzZWxlY3RcdC1cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdC0gWy0xXSB8IFsgMSwgNV0gICAtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fZml4ZWQoIHJlc291cmNlX2lkLCBkYXlzX251bWJlciwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZCggcmVzb3VyY2VfaWQsIGRheXNfbnVtYmVyLCB3ZWVrX2RheXNfX3N0YXJ0ICk7XHJcblxyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2V0IEZpeGVkIERheXMgc2VsZWN0aW9uIHdpdGggIDEgbW91c2UgY2xpY2tcclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKSAtXHJcbiAqIEBpbnRlZ2VyIGRheXNfbnVtYmVyXHRcdFx0LSAzXHRcdFx0XHQgICAtLSBudW1iZXIgb2YgZGF5cyB0byAgc2VsZWN0XHQtXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHQtIFstMV0gfCBbIDEsIDVdICAgLS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkKCByZXNvdXJjZV9pZCwgZGF5c19udW1iZXIsIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdmaXhlZCd9ICk7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZml4ZWRfX2RheXNfbnVtJzogcGFyc2VJbnQoIGRheXNfbnVtYmVyICl9ICk7XHRcdFx0Ly8gTnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uIHdpdGggMSBtb3VzZSBjbGlja1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnOiB3ZWVrX2RheXNfX3N0YXJ0fSApOyBcdC8vIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogU2V0IHRoZSBleGlzdGluZyBjYWxlbmRhciBwYXJhbWV0ZXJzIHRvIHR3by1jbGljayByYW5nZSBtb2RlIGFmdGVyIHBhZ2UgbG9hZC5cbiAqIEZyZWUgdXNlcyB0aGUgdW5yZXN0cmljdGVkIHNoYXJlZCBoYW5kbGVyOyBCdXNpbmVzcyBTbWFsbCsga2VlcHMgaXRzIGFscmVhZHkgaW5pdGlhbGl6ZWQgYWR2YW5jZWQgcmFuZ2UgcnVsZXMuXG4gKlxuICogQHBhcmFtIHJlc291cmNlX2lkIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UuXG4gKi9cbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19yYW5nZV9tb2RlKCByZXNvdXJjZV9pZCApe1xuXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2VfbW9kZSggcmVzb3VyY2VfaWQgKTtcblx0XHR9LCAxMDAwKTtcblx0fSk7XG59XG5cbi8qKlxuICogU3dpdGNoIHRvIHR3by1jbGljayByYW5nZSBtb2RlIHdpdGhvdXQgY2hhbmdpbmcgYW55IGFkdmFuY2VkIHJhbmdlIHBhcmFtZXRlcnMuXG4gKlxuICogQHBhcmFtIHJlc291cmNlX2lkIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UuXG4gKi9cbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZV9tb2RlKCByZXNvdXJjZV9pZCApe1xuXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdkeW5hbWljJ30gKTtcblxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFNldCBSYW5nZSBEYXlzIHNlbGVjdGlvbiAgd2l0aCAgMiBtb3VzZSBjbGlja3MgIC0gYWZ0ZXIgcGFnZSBsb2FkXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgXHRcdC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKVxyXG4gKiBAaW50ZWdlciBkYXlzX21pblx0XHRcdC0gN1x0XHRcdFx0ICAgXHRcdC0tIE1pbiBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGludGVnZXIgZGF5c19tYXhcdFx0XHQtIDMwXHRcdFx0ICAgXHRcdC0tIE1heCBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGFycmF5IGRheXNfc3BlY2lmaWNcdFx0XHQtIFtdIHwgWzcsMTQsMjEsMjhdXHRcdC0tIFJlc3RyaWN0aW9uIGZvciBTcGVjaWZpYyBudW1iZXIgb2YgZGF5cyBzZWxlY3Rpb25cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdFx0LSBbLTFdIHwgWyAxLCA1XSAgIFx0XHQtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fcmFuZ2UoIHJlc291cmNlX2lkLCBkYXlzX21pbiwgZGF5c19tYXgsIGRheXNfc3BlY2lmaWMgPSBbXSwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYywgd2Vla19kYXlzX19zdGFydCApO1xyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgUmFuZ2UgRGF5cyBzZWxlY3Rpb24gIHdpdGggIDIgbW91c2UgY2xpY2tzXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICBcdFx0LS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpXHJcbiAqIEBpbnRlZ2VyIGRheXNfbWluXHRcdFx0LSA3XHRcdFx0XHQgICBcdFx0LS0gTWluIG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAaW50ZWdlciBkYXlzX21heFx0XHRcdC0gMzBcdFx0XHQgICBcdFx0LS0gTWF4IG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAYXJyYXkgZGF5c19zcGVjaWZpY1x0XHRcdC0gW10gfCBbNywxNCwyMSwyOF1cdFx0LS0gUmVzdHJpY3Rpb24gZm9yIFNwZWNpZmljIG51bWJlciBvZiBkYXlzIHNlbGVjdGlvblxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0XHQtIFstMV0gfCBbIDEsIDVdICAgXHRcdC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYyA9IFtdLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoICByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ2R5bmFtaWMnfSAgKTtcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJyAgICAgICAgICwgcGFyc2VJbnQoIGRheXNfbWluICkgICk7ICAgICAgICAgICBcdFx0Ly8gTWluLiBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAyIG1vdXNlIGNsaWNrc1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnICAgICAgICAgLCBwYXJzZUludCggZGF5c19tYXggKSAgKTsgICAgICAgICAgXHRcdC8vIE1heC4gTnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uIHdpdGggMiBtb3VzZSBjbGlja3NcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnICAgICwgZGF5c19zcGVjaWZpYyAgKTtcdCAgICAgIFx0XHRcdFx0Ly8gRXhhbXBsZSBbNSw3XVxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcgLCB3ZWVrX2RheXNfX3N0YXJ0ICApOyAgXHRcdFx0XHRcdC8vIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG4iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsX2FqeF9sb2FkL3dwYmNfY2FsX2FqeC5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyAgQSBqIGEgeCAgICBMIG8gYSBkICAgIEMgYSBsIGUgbiBkIGEgciAgICBEIGEgdCBhXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIHBhcmFtcyApe1xyXG5cclxuXHQvLyBGaXhJbjogOS44LjYuMi5cclxuXHR3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdGFydCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7XHJcblxyXG5cdC8vIFRyaWdnZXIgZXZlbnQgZm9yIGNhbGVuZGFyIGJlZm9yZSBsb2FkaW5nIEJvb2tpbmcgZGF0YSwgIGJ1dCBhZnRlciBzaG93aW5nIENhbGVuZGFyLlxyXG5cdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcGFyYW1zWydyZXNvdXJjZV9pZCddICkubGVuZ3RoID4gMCApe1xyXG5cdFx0dmFyIHRhcmdldF9lbG0gPSBqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoIFwid3BiY19jYWxlbmRhcl9hanhfX2JlZm9yZV9sb2FkZWRfZGF0YVwiLCBbcGFyYW1zWydyZXNvdXJjZV9pZCddXSApO1xyXG5cdFx0IC8valF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19iZWZvcmVfbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiggZXZlbnQsIHJlc291cmNlX2lkICkgeyAuLi4gfSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3cGJjX2JhbGFuY2VyX19pc193YWl0KCBwYXJhbXMgLCAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnICkgKXtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIEZpeEluOiA5LjguNi4yLlxyXG5cdHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0b3AoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApO1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vID09IEdldCBzdGFydCAvIGVuZCBkYXRlcyBmcm9tICB0aGUgQm9va2luZyBDYWxlbmRhciBzaG9ydGNvZGUuID09XHJcblx0Ly8gRXhhbXBsZTogW2Jvb2tpbmcgY2FsZW5kYXJfZGF0ZXNfc3RhcnQ9JzIwMjYtMDEtMDEnIGNhbGVuZGFyX2RhdGVzX2VuZD0nMjAyNi0xMi0zMScgIHJlc291cmNlX2lkPTFdICAgICAgICAgICAgICAvLyBGaXhJbjogMTAuMTMuMS40LlxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0aWYgKCBmYWxzZSAhPT0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX3N0YXJ0KCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKSApIHtcclxuXHRcdGlmICggISBwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ10gKSB7IHBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXSA9IFtdOyB9XHJcblx0XHR2YXIgZGF0ZXNfc3RhcnQgPSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApOyAgLy8gRS5nLiAtIGxvY2FsX19taW5fZGF0ZSA9IG5ldyBEYXRlKCAyMDI1LCAwLCAxICk7XHJcblx0XHRpZiAoIGZhbHNlICE9PSBkYXRlc19zdGFydCApe1xyXG5cdFx0XHRwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ11bMF0gPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlc19zdGFydCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRpZiAoIGZhbHNlICE9PSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfZW5kKCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKSApIHtcclxuXHRcdGlmICggIXBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXSApIHsgcGFyYW1zWydkYXRlc190b19jaGVjayddID0gW107IH1cclxuXHRcdHZhciBkYXRlc19lbmQgPSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfZW5kKCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKTsgIC8vIEUuZy4gLSBsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggMjAyNSwgMCwgMSApO1xyXG5cdFx0aWYgKCBmYWxzZSAhPT0gZGF0ZXNfZW5kICkge1xyXG5cdFx0XHRwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ11bMV0gPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlc19lbmQgKTtcclxuXHRcdFx0aWYgKCAhcGFyYW1zWydkYXRlc190b19jaGVjayddWzBdICkge1xyXG5cdFx0XHRcdHBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXVswXSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIG5ldyBEYXRlKCkgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLy8gY29uc29sZS5ncm91cEVuZCgpOyBjb25zb2xlLnRpbWUoJ3Jlc291cmNlX2lkXycgKyBwYXJhbXNbJ3Jlc291cmNlX2lkJ10pO1xyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfQ0FMRU5EQVJfTE9BRCcgKTsgY29uc29sZS5sb2coICcgPT0gQmVmb3JlIEFqYXggU2VuZCAtIGNhbGVuZGFyc19hbGxfX2dldCgpID09ICcgLCBfd3BiYy5jYWxlbmRhcnNfYWxsX19nZXQoKSApO1xyXG5cdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKSApIHtcclxuXHRcdHdwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IoKTtcclxuXHR9XHJcblxyXG5cdC8vIFN0YXJ0IEFqYXhcclxuXHRqUXVlcnkucG9zdCggd3BiY191cmxfYWpheCxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRhY3Rpb24gICAgICAgICAgOiAnV1BCQ19BSlhfQ0FMRU5EQVJfTE9BRCcsXHJcblx0XHRcdFx0XHR3cGJjX2FqeF91c2VyX2lkOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAndXNlcl9pZCcgKSxcclxuXHRcdFx0XHRcdG5vbmNlICAgICAgICAgICA6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICdub25jZScgKSxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X2xvY2FsZSA6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICdsb2NhbGUnICksXHJcblxyXG5cdFx0XHRcdFx0Y2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMgOiBwYXJhbXMgXHRcdFx0XHRcdFx0Ly8gVXN1YWxseSBsaWtlOiB7ICdyZXNvdXJjZV9pZCc6IDEsICdtYXhfZGF5c19jb3VudCc6IDM2NSB9XHJcblx0XHRcdFx0fSxcclxuXHJcblx0XHRcdFx0LyoqXHJcblx0XHRcdFx0ICogUyB1IGMgYyBlIHMgc1xyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0ICogQHBhcmFtIHJlc3BvbnNlX2RhdGFcdFx0LVx0aXRzIG9iamVjdCByZXR1cm5lZCBmcm9tICBBamF4IC0gY2xhc3MtbGl2ZS1zZWFyY2gucGhwXHJcblx0XHRcdFx0ICogQHBhcmFtIHRleHRTdGF0dXNcdFx0LVx0J3N1Y2Nlc3MnXHJcblx0XHRcdFx0ICogQHBhcmFtIGpxWEhSXHRcdFx0XHQtXHRPYmplY3RcclxuXHRcdFx0XHQgKi9cclxuXHRcdFx0XHRmdW5jdGlvbiAoIHJlc3BvbnNlX2RhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkge1xyXG4vLyBjb25zb2xlLnRpbWVFbmQoJ3Jlc291cmNlX2lkXycgKyByZXNwb25zZV9kYXRhWydyZXNvdXJjZV9pZCddKTtcclxuY29uc29sZS5sb2coICcgPT0gUmVzcG9uc2UgV1BCQ19BSlhfQ0FMRU5EQVJfTE9BRCA9PSAnLCByZXNwb25zZV9kYXRhICk7IGNvbnNvbGUuZ3JvdXBFbmQoKTtcclxuXHJcblx0XHRcdFx0XHQvLyBGaXhJbjogOS44LjYuMi5cclxuXHRcdFx0XHRcdHZhciBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCB0aGlzLmRhdGEgKTtcclxuXHRcdFx0XHRcdHdwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCggYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgLCAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUHJvYmFibHkgRXJyb3JcclxuXHRcdFx0XHRcdGlmICggKHR5cGVvZiByZXNwb25zZV9kYXRhICE9PSAnb2JqZWN0JykgfHwgKHJlc3BvbnNlX2RhdGEgPT09IG51bGwpICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHRcdFx0XHRcdFx0dmFyIG1lc3NhZ2VfdHlwZSA9ICdpbmZvJztcclxuXHJcblx0XHRcdFx0XHRcdGlmICggJycgPT09IHJlc3BvbnNlX2RhdGEgKXtcclxuXHRcdFx0XHRcdFx0XHRyZXNwb25zZV9kYXRhID0gJ1RoZSBzZXJ2ZXIgcmVzcG9uZHMgd2l0aCBhbiBlbXB0eSBzdHJpbmcuIFRoZSBzZXJ2ZXIgcHJvYmFibHkgc3RvcHBlZCB3b3JraW5nIHVuZXhwZWN0ZWRseS4gPGJyPlBsZWFzZSBjaGVjayB5b3VyIDxzdHJvbmc+ZXJyb3IubG9nPC9zdHJvbmc+IGluIHlvdXIgc2VydmVyIGNvbmZpZ3VyYXRpb24gZm9yIHJlbGF0aXZlIGVycm9ycy4nO1xyXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2VfdHlwZSA9ICd3YXJuaW5nJztcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGEgLCB7ICd0eXBlJyAgICAgOiBtZXNzYWdlX3R5cGUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBTaG93IENhbGVuZGFyXHJcblx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdFx0XHQvLyBCb29raW5ncyAtIERhdGVzXHJcblx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCAgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bJ2RhdGVzJ10gICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQm9va2luZ3MgLSBDaGlsZCBvciBvbmx5IHNpbmdsZSBib29raW5nIHJlc291cmNlIGluIGRhdGVzXHJcblx0XHRcdFx0XHRfd3BiYy5ib29raW5nX19zZXRfcGFyYW1fdmFsdWUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJywgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnIF0gKTtcclxuXHJcblx0XHRcdFx0XHQvLyBBZ2dyZWdhdGUgYm9va2luZyByZXNvdXJjZXMsICBpZiBhbnkgP1xyXG5cdFx0XHRcdFx0X3dwYmMuYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJywgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicgXSApO1xyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdFx0XHRcdC8vIFVwZGF0ZSBjYWxlbmRhclxyXG5cdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fdXBkYXRlX2xvb2soIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKSApIHtcclxuXHRcdFx0XHRcdFx0d3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcigpO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0XHQoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXSkgKVxyXG5cdFx0XHRcdFx0XHQgJiYgKCAnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICkgKVxyXG5cdFx0XHRcdFx0KXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHsgICAndHlwZScgICAgIDogKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdICkgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgID8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICdpbmZvJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfdXBkYXRlX2NhcGFjaXR5X2hpbnQpICkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX3VwZGF0ZV9jYXBhY2l0eV9oaW50KCByZXNwb25zZV9kYXRhWydyZXNvdXJjZV9pZCddICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gVHJpZ2dlciBldmVudCB0aGF0IGNhbGVuZGFyIGhhcyBiZWVuXHRcdCAvLyBGaXhJbjogMTAuMC4wLjQ0LiAgLy8gRml4SW46IDEwLjE0LjE3LjIuXHJcblx0XHRcdFx0XHRpZiAoIChqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNwb25zZV9kYXRhWydyZXNvdXJjZV9pZCddICkubGVuZ3RoID4gMCkgfHwgKGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzcG9uc2VfZGF0YVsncmVzb3VyY2VfaWQnXSApLmxlbmd0aCA+IDApICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgdGFyZ2V0X2VsbSA9IGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggXCJ3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGFcIiwgW3Jlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXV0gKTtcclxuXHRcdFx0XHRcdFx0IC8valF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uKCBldmVudCwgcmVzb3VyY2VfaWQgKSB7IC4uLiB9ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly9qUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cclxuXHRcdFx0XHRcdHZhciBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCB0aGlzLmRhdGEgKTtcclxuXHRcdFx0XHRcdHdwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCggYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgLCAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gR2V0IENvbnRlbnQgb2YgRXJyb3IgTWVzc2FnZVxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKDxiPicgKyBqcVhIUi5zdGF0dXMgKyAnPC9iPiknO1xyXG5cdFx0XHRcdFx0XHRpZiAoNDAzID09IGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJzxicj4gUHJvYmFibHkgbm9uY2UgZm9yIHRoaXMgcGFnZSBoYXMgYmVlbiBleHBpcmVkLiBQbGVhc2UgPGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIG9uY2xpY2s9XCJqYXZhc2NyaXB0OmxvY2F0aW9uLnJlbG9hZCgpO1wiPnJlbG9hZCB0aGUgcGFnZTwvYT4uJztcclxuXHRcdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICc8YnI+IE90aGVyd2lzZSwgcGxlYXNlIGNoZWNrIHRoaXMgPGEgc3R5bGU9XCJmb250LXdlaWdodDogNjAwO1wiIGhyZWY9XCJodHRwczovL3dwYm9va2luZ2NhbGVuZGFyLmNvbS9mYXEvcmVxdWVzdC1kby1ub3QtcGFzcy1zZWN1cml0eS1jaGVjay8/YWZ0ZXJfdXBkYXRlPTEwLjEuMVwiPnRyb3VibGVzaG9vdGluZyBpbnN0cnVjdGlvbjwvYT4uPGJyPidcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dmFyIG1lc3NhZ2Vfc2hvd19kZWxheSA9IDMwMDA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgJyArIGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdFx0bWVzc2FnZV9zaG93X2RlbGF5ID0gMTA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHR2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHJcblx0XHRcdFx0XHQvKipcclxuXHRcdFx0XHRcdCAqIElmIHdlIG1ha2UgZmFzdCBjbGlja2luZyBvbiBkaWZmZXJlbnQgcGFnZXMsXHJcblx0XHRcdFx0XHQgKiB0aGVuIHVuZGVyIGNhbGVuZGFyIHdpbGwgc2hvdyBlcnJvciBtZXNzYWdlIHdpdGggIGVtcHR5ICB0ZXh0LCBiZWNhdXNlIGFqYXggd2FzIG5vdCByZWNlaXZlZC5cclxuXHRcdFx0XHRcdCAqIFRvICBub3Qgc2hvdyBzdWNoIHdhcm5pbmdzIHdlIGFyZSBzZXQgZGVsYXkgIGluIDMgc2Vjb25kcy4gIHZhciBtZXNzYWdlX3Nob3dfZGVsYXkgPSAzMDAwO1xyXG5cdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgLCB7ICd0eXBlJyAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9ICxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIHBhcnNlSW50KCBtZXNzYWdlX3Nob3dfZGVsYXkgKSAgICk7XHJcblxyXG5cdFx0XHQgIH0pXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG59XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBTdXBwb3J0XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgQ2FsZW5kYXIgalF1ZXJ5IG5vZGUgZm9yIHNob3dpbmcgbWVzc2FnZXMgZHVyaW5nIEFqYXhcclxuXHQgKiBUaGlzIHBhcmFtZXRlcjogICBjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0gICBwYXJzZWQgZnJvbSB0aGlzLmRhdGEgQWpheCBwb3N0ICBkYXRhXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zXHRcdCAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVx0JycjY2FsZW5kYXJfYm9va2luZzEnICB8ICAgJy5ib29raW5nX2Zvcm1fZGl2JyAuLi5cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGUgICAgdmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICl7XHJcblxyXG5cdFx0dmFyIGpxX25vZGUgPSAnLmJvb2tpbmdfZm9ybV9kaXYnO1xyXG5cclxuXHRcdHZhciBjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKTtcclxuXHJcblx0XHRpZiAoIGNhbGVuZGFyX3Jlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRqcV9ub2RlID0gJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3Jlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBqcV9ub2RlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCByZXNvdXJjZSBJRCBmcm9tIGFqeCBwb3N0IGRhdGEgdXJsICAgdXN1YWxseSAgZnJvbSAgdGhpcy5kYXRhICA9XHJcblx0ICogJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zXHRcdCAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKiBAcmV0dXJucyB7aW50fVx0XHRcdFx0XHRcdCAxIHwgMCAgKGlmIGVycnJvciB0aGVuICAwKVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZSAgICB2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICl7XHJcblxyXG5cdFx0Ly8gR2V0IGJvb2tpbmcgcmVzb3VyY2UgSUQgZnJvbSBBamF4IFBvc3QgUmVxdWVzdCAgLT4gdGhpcy5kYXRhID0gJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0XHR2YXIgY2FsZW5kYXJfcmVzb3VyY2VfaWQgPSB3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXScsIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApO1xyXG5cdFx0aWYgKCAobnVsbCAhPT0gY2FsZW5kYXJfcmVzb3VyY2VfaWQpICYmICgnJyAhPT0gY2FsZW5kYXJfcmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdGNhbGVuZGFyX3Jlc291cmNlX2lkID0gcGFyc2VJbnQoIGNhbGVuZGFyX3Jlc291cmNlX2lkICk7XHJcblx0XHRcdGlmICggY2FsZW5kYXJfcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdFx0cmV0dXJuIGNhbGVuZGFyX3Jlc291cmNlX2lkO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gMDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgcGFyYW1ldGVyIGZyb20gVVJMICAtICBwYXJzZSBVUkwgcGFyYW1ldGVycywgIGxpa2UgdGhpczpcclxuXHQgKiBhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zXHJcblx0ICogQHBhcmFtIG5hbWUgIHBhcmFtZXRlciAgbmFtZSwgIGxpa2UgJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXSdcclxuXHQgKiBAcGFyYW0gdXJsXHQncGFyYW1ldGVyICBzdHJpbmcgVVJMJ1xyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gICBwYXJhbWV0ZXIgdmFsdWVcclxuXHQgKlxyXG5cdCAqIEV4YW1wbGU6IFx0XHR3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXScsIHRoaXMuZGF0YSApOyAgLT4gJzInXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfdXJpX3BhcmFtX2J5X25hbWUoIG5hbWUsIHVybCApe1xyXG5cclxuXHRcdHVybCA9IGRlY29kZVVSSUNvbXBvbmVudCggdXJsICk7XHJcblxyXG5cdFx0bmFtZSA9IG5hbWUucmVwbGFjZSggL1tcXFtcXF1dL2csICdcXFxcJCYnICk7XHJcblx0XHR2YXIgcmVnZXggPSBuZXcgUmVnRXhwKCAnWz8mXScgKyBuYW1lICsgJyg9KFteJiNdKil8JnwjfCQpJyApLFxyXG5cdFx0XHRyZXN1bHRzID0gcmVnZXguZXhlYyggdXJsICk7XHJcblx0XHRpZiAoICFyZXN1bHRzICkgcmV0dXJuIG51bGw7XHJcblx0XHRpZiAoICFyZXN1bHRzWyAyIF0gKSByZXR1cm4gJyc7XHJcblx0XHRyZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KCByZXN1bHRzWyAyIF0ucmVwbGFjZSggL1xcKy9nLCAnICcgKSApO1xyXG5cdH1cclxuIiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9mcm9udF9lbmRfbWVzc2FnZXMvd3BiY19mZV9tZXNzYWdlcy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gU2hvdyBNZXNzYWdlcyBhdCBGcm9udC1FZG4gc2lkZVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTaG93IG1lc3NhZ2UgaW4gY29udGVudFxyXG4gKlxyXG4gKiBAcGFyYW0gbWVzc2FnZVx0XHRcdFx0TWVzc2FnZSBIVE1MXHJcbiAqIEBwYXJhbSBwYXJhbXMgPSB7XHJcbiAqXHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgOiAnd2FybmluZycsXHRcdFx0XHRcdFx0XHQvLyAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2luZm8nIHwgJ3N1Y2Nlc3MnXHJcbiAqXHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnIDoge1xyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnIDogJycsXHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgIDogJ2luc2lkZSdcdFx0Ly8gJ2luc2lkZScgfCAnYmVmb3JlJyB8ICdhZnRlcicgfCAncmlnaHQnIHwgJ2xlZnQnXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfSxcclxuICpcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIEFwcGx5ICBvbmx5IGlmIFx0J3doZXJlJyAgIDogJ2luc2lkZSdcclxuICpcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcdFx0XHRcdC8vIHN0eWxlcywgaWYgbmVlZGVkXHJcbiAqXHRcdFx0XHRcdFx0XHQgICAgJ2Nzc19jbGFzcyc6ICcnLFx0XHRcdFx0XHRcdFx0XHQvLyBGb3IgZXhhbXBsZSBjYW4gIGJlOiAnd3BiY19mZV9tZXNzYWdlX2FsdCdcclxuICpcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHRcdFx0XHRcdFx0XHRcdFx0Ly8gaG93IG1hbnkgbWljcm9zZWNvbmQgdG8gIHNob3csICBpZiAwICB0aGVuICBzaG93IGZvcmV2ZXJcclxuICpcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiBmYWxzZVx0XHRcdFx0XHQvLyBpZiB0cnVlLCAgdGhlbiBkbyBub3Qgc2hvdyBtZXNzYWdlLCAgaWYgcHJldmlvcyBtZXNzYWdlIHdhcyBub3QgaGlkZWQgKG5vdCBhcHBseSBpZiAnd2hlcmUnICAgOiAnaW5zaWRlJyApXHJcbiAqXHRcdFx0XHR9O1xyXG4gKiBFeGFtcGxlczpcclxuICogXHRcdFx0dmFyIGh0bWxfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCAnWW91IGNhbiB0ZXN0IGRheXMgc2VsZWN0aW9uIGluIGNhbGVuZGFyJywge30gKTtcclxuICpcclxuICpcdFx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfcmVxdWlyZWQnICksIHsgJ3R5cGUnOiAnd2FybmluZycsICdkZWxheSc6IDEwMDAwLCAnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICdzaG93X2hlcmUnOiB7J3doZXJlJzogJ3JpZ2h0JywgJ2pxX25vZGUnOiBlbCx9IH0gKTtcclxuICpcclxuICpcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICksXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHsgICAndHlwZScgICAgIDogKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdICkgKVxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdIDogJ2luZm8nLFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY3NzX2NsYXNzJzond3BiY19mZV9tZXNzYWdlX2FsdCcsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDEwMDAwXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuICpcclxuICpcclxuICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggbWVzc2FnZSwgcGFyYW1zID0ge30gKXtcclxuXHJcblx0dmFyIHBhcmFtc19kZWZhdWx0ID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICd3YXJuaW5nJyxcdFx0XHRcdFx0XHRcdC8vICdlcnJvcicgfCAnd2FybmluZycgfCAnaW5mbycgfCAnc3VjY2VzcydcclxuXHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJyA6ICcnLFx0XHRcdFx0Ly8gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICAgOiAnaW5zaWRlJ1x0XHQvLyAnaW5zaWRlJyB8ICdiZWZvcmUnIHwgJ2FmdGVyJyB8ICdyaWdodCcgfCAnbGVmdCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFx0XHRcdFx0XHRcdFx0XHQvLyBBcHBseSAgb25seSBpZiBcdCd3aGVyZScgICA6ICdpbnNpZGUnXHJcblx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFx0XHRcdFx0Ly8gc3R5bGVzLCBpZiBuZWVkZWRcclxuXHRcdFx0XHRcdFx0XHQgICAgJ2Nzc19jbGFzcyc6ICcnLFx0XHRcdFx0XHRcdFx0XHQvLyBGb3IgZXhhbXBsZSBjYW4gIGJlOiAnd3BiY19mZV9tZXNzYWdlX2FsdCdcclxuXHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwLFx0XHRcdFx0XHRcdFx0XHRcdC8vIGhvdyBtYW55IG1pY3Jvc2Vjb25kIHRvICBzaG93LCAgaWYgMCAgdGhlbiAgc2hvdyBmb3JldmVyXG5cdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiBmYWxzZSxcdFx0XHRcdFx0Ly8gaWYgdHJ1ZSwgIHRoZW4gZG8gbm90IHNob3cgbWVzc2FnZSwgIGlmIHByZXZpb3MgbWVzc2FnZSB3YXMgbm90IGhpZGVkIChub3QgYXBwbHkgaWYgJ3doZXJlJyAgIDogJ2luc2lkZScgKVxuXHRcdFx0XHRcdFx0XHRcdCdpc19zY3JvbGwnOiB0cnVlLFx0XHRcdFx0XHRcdFx0XHQvLyBpcyBzY3JvbGwgIHRvICB0aGlzIGVsZW1lbnRcblx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJzogJ2h0bWwnXHRcdFx0XHRcdFx0XHQvLyAnaHRtbCcgZm9yIHRydXN0ZWQgbGVnYWN5IGNvbnRlbnQgfCAndGV4dCcgZm9yIGVkaXRhYmxlL3VzZXIgY29udGVudFxuXHRcdFx0XHRcdFx0fTtcclxuXHRmb3IgKCB2YXIgcF9rZXkgaW4gcGFyYW1zICl7XHJcblx0XHRwYXJhbXNfZGVmYXVsdFsgcF9rZXkgXSA9IHBhcmFtc1sgcF9rZXkgXTtcclxuXHR9XHJcblx0cGFyYW1zID0gcGFyYW1zX2RlZmF1bHQ7XG5cblx0aWYgKCAndGV4dCcgPT09IHBhcmFtc1sgJ2NvbnRlbnRfbW9kZScgXSApIHtcblx0XHRtZXNzYWdlID0galF1ZXJ5KCAnPGRpdj4nICkudGV4dCggbnVsbCA9PT0gbWVzc2FnZSB8fCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIG1lc3NhZ2UgPyAnJyA6IFN0cmluZyggbWVzc2FnZSApICkuaHRtbCgpLnJlcGxhY2UoIC9cXG4vZywgJzxiciAvPicgKTtcblx0fVxuXHJcbiAgICB2YXIgdW5pcXVlX2Rpdl9pZCA9IG5ldyBEYXRlKCk7XHJcbiAgICB1bmlxdWVfZGl2X2lkID0gJ3dwYmNfbm90aWNlXycgKyB1bmlxdWVfZGl2X2lkLmdldFRpbWUoKTtcclxuXHJcblx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZSc7XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnZXJyb3InICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX2Vycm9yJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yZXBvcnRfZ21haWxlcnJvcnJlZFwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnd2FybmluZycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2Vfd2FybmluZyc7XHJcblx0XHRtZXNzYWdlID0gJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fd2FybmluZ1wiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnaW5mbycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2VfaW5mbyc7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ3N1Y2Nlc3MnICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX3N1Y2Nlc3MnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RvbmVfb3V0bGluZVwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblxyXG5cdHZhciBzY3JvbGxfdG9fZWxlbWVudCA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnX3Njcm9sbFwiIHN0eWxlPVwiZGlzcGxheTpub25lO1wiPjwvZGl2Pic7XHJcblx0bWVzc2FnZSA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZSAnICsgcGFyYW1zWydjc3NfY2xhc3MnXSArICdcIiBzdHlsZT1cIicgKyBwYXJhbXNbICdzdHlsZScgXSArICdcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nO1xyXG5cclxuXHJcblx0dmFyIGpxX2VsX21lc3NhZ2UgPSBmYWxzZTtcclxuXHR2YXIgaXNfc2hvd19tZXNzYWdlID0gdHJ1ZTtcclxuXHJcblx0aWYgKCAnaW5zaWRlJyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRpZiAoIHBhcmFtc1sgJ2lzX2FwcGVuZCcgXSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hcHBlbmQoIHNjcm9sbF90b19lbGVtZW50ICk7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFwcGVuZCggbWVzc2FnZSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuaHRtbCggc2Nyb2xsX3RvX2VsZW1lbnQgKyBtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdH0gZWxzZSBpZiAoICdiZWZvcmUnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5zaWJsaW5ncyggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdH0gZWxzZSBpZiAoICdhZnRlcicgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLm5leHRBbGwoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHRcdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBiZWZvcmUoZm9yIGhhbmR5IHNjcm9sbClcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYWZ0ZXIoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ3JpZ2h0JyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkubmV4dEFsbCggJy53cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfcmlnaHQnICkuZmluZCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcdFx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGJlZm9yZShmb3IgaGFuZHkgc2Nyb2xsKVxyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hZnRlciggJzxkaXYgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfcmlnaHRcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nICk7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICggJ2xlZnQnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5zaWJsaW5ncyggJy53cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfbGVmdCcgKS5maW5kKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1x0XHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYmVmb3JlKGZvciBoYW5keSBzY3JvbGwpXHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggJzxkaXYgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfbGVmdFwiPicgKyBtZXNzYWdlICsgJzwvZGl2PicgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggICAoIGlzX3Nob3dfbWVzc2FnZSApICAmJiAgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSA+IDAgKSAgICl7XHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkuZmFkZU91dCggMTUwMCApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gLCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSAgICk7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lcjIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLnRyaWdnZXIoICdoaWRlJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sICggcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdICkgKyAxNTAxICkgKTtcclxuXHR9XHJcblxyXG5cdC8vIENoZWNrICBpZiBzaG93ZWQgbWVzc2FnZSBpbiBzb21lIGhpZGRlbiBwYXJlbnQgc2VjdGlvbiBhbmQgc2hvdyBpdC4gQnV0IGl0IG11c3QgIGJlIGxvd2VyIHRoYW4gJy53cGJjX2NvbnRhaW5lcidcclxuXHR2YXIgcGFyZW50X2VscyA9IGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLnBhcmVudHMoKS5tYXAoIGZ1bmN0aW9uICgpe1xyXG5cdFx0aWYgKCAoIWpRdWVyeSggdGhpcyApLmlzKCAndmlzaWJsZScgKSkgJiYgKGpRdWVyeSggJy53cGJjX2NvbnRhaW5lcicgKS5oYXMoIHRoaXMgKSkgKXtcclxuXHRcdFx0alF1ZXJ5KCB0aGlzICkuc2hvdygpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0aWYgKCBwYXJhbXNbICdpc19zY3JvbGwnIF0gKXtcclxuXHRcdHdwYmNfZG9fc2Nyb2xsKCAnIycgKyB1bmlxdWVfZGl2X2lkICsgJ19zY3JvbGwnICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdW5pcXVlX2Rpdl9pZDtcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRXJyb3IgbWVzc2FnZS4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3IoIGpxX25vZGUsIG1lc3NhZ2UsIGNvbnRlbnRfbW9kZSApe1xuXG5cdFx0Y29udGVudF9tb2RlID0gKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGNvbnRlbnRfbW9kZSApID8gJ2h0bWwnIDogY29udGVudF9tb2RlO1xuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnICAgICAgIDogY29udGVudF9tb2RlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAncmlnaHQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRXJyb3IgbWVzc2FnZSBVTkRFUiBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcl91bmRlcl9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlLCBtZXNzYWdlX2RlbGF5LCBjb250ZW50X21vZGUgKXtcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChtZXNzYWdlX2RlbGF5KSApe1xuXHRcdFx0bWVzc2FnZV9kZWxheSA9IDBcblx0XHR9XG5cdFx0Y29udGVudF9tb2RlID0gKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGNvbnRlbnRfbW9kZSApID8gJ2h0bWwnIDogY29udGVudF9tb2RlO1xuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiBtZXNzYWdlX2RlbGF5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZScgICAgICAgOiBjb250ZW50X21vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlIFVOREVSIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yX2Fib3ZlX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UsIG1lc3NhZ2VfZGVsYXksIGNvbnRlbnRfbW9kZSApe1xuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKG1lc3NhZ2VfZGVsYXkpICl7XG5cdFx0XHRtZXNzYWdlX2RlbGF5ID0gMTAwMDBcblx0XHR9XG5cdFx0Y29udGVudF9tb2RlID0gKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGNvbnRlbnRfbW9kZSApID8gJ2h0bWwnIDogY29udGVudF9tb2RlO1xuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiBtZXNzYWdlX2RlbGF5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZScgICAgICAgOiBjb250ZW50X21vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdiZWZvcmUnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogV2FybmluZyBtZXNzYWdlLiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBqcV9ub2RlLCBtZXNzYWdlLCBjb250ZW50X21vZGUgKXtcblxuXHRcdGNvbnRlbnRfbW9kZSA9ICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBjb250ZW50X21vZGUgKSA/ICdodG1sJyA6IGNvbnRlbnRfbW9kZTtcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnICAgICAgIDogY29udGVudF9tb2RlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAncmlnaHQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHR3cGJjX2hpZ2hsaWdodF9lcnJvcl9vbl9mb3JtX2ZpZWxkKCBqcV9ub2RlICk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogV2FybmluZyBtZXNzYWdlIFVOREVSIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfdW5kZXJfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgY29udGVudF9tb2RlICl7XG5cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJyAgICAgICA6IGNvbnRlbnRfbW9kZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFdhcm5pbmcgbWVzc2FnZSBBQk9WRSBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nX2Fib3ZlX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UsIGNvbnRlbnRfbW9kZSApe1xuXG5cdFx0Y29udGVudF9tb2RlID0gKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGNvbnRlbnRfbW9kZSApID8gJ2h0bWwnIDogY29udGVudF9tb2RlO1xuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZScgICAgICAgOiBjb250ZW50X21vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdiZWZvcmUnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBIaWdobGlnaHQgRXJyb3IgaW4gc3BlY2lmaWMgZmllbGRcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBqcV9ub2RlXHRcdFx0XHRcdHN0cmluZyBvciBqUXVlcnkgZWxlbWVudCwgIHdoZXJlIHNjcm9sbCAgdG9cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2hpZ2hsaWdodF9lcnJvcl9vbl9mb3JtX2ZpZWxkKCBqcV9ub2RlICl7XHJcblxyXG5cdFx0aWYgKCAhalF1ZXJ5KCBqcV9ub2RlICkubGVuZ3RoICl7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGlmICggISBqUXVlcnkoIGpxX25vZGUgKS5pcyggJzppbnB1dCcgKSApe1xyXG5cdFx0XHQvLyBTaXR1YXRpb24gd2l0aCAgY2hlY2tib3hlcyBvciByYWRpbyAgYnV0dG9uc1xyXG5cdFx0XHR2YXIganFfbm9kZV9hcnIgPSBqUXVlcnkoIGpxX25vZGUgKS5maW5kKCAnOmlucHV0JyApO1xyXG5cdFx0XHRpZiAoICFqcV9ub2RlX2Fyci5sZW5ndGggKXtcclxuXHRcdFx0XHRyZXR1cm5cclxuXHRcdFx0fVxyXG5cdFx0XHRqcV9ub2RlID0ganFfbm9kZV9hcnIuZ2V0KCAwICk7XHJcblx0XHR9XHJcblx0XHR2YXIgcGFyYW1zID0ge307XHJcblx0XHRwYXJhbXNbICdkZWxheScgXSA9IDEwMDAwO1xyXG5cclxuXHRcdGlmICggIWpRdWVyeSgganFfbm9kZSApLmhhc0NsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApICl7XHJcblxyXG5cdFx0XHRqUXVlcnkoIGpxX25vZGUgKS5hZGRDbGFzcyggJ3dwYmNfZm9ybV9maWVsZF9lcnJvcicgKVxyXG5cclxuXHRcdFx0aWYgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSA+IDAgKXtcclxuXHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCBqUXVlcnkoIGpxX25vZGUgKS5yZW1vdmVDbGFzcyggJ3dwYmNfZm9ybV9maWVsZF9lcnJvcicgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgLCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcbi8qKlxyXG4gKiBTY3JvbGwgdG8gc3BlY2lmaWMgZWxlbWVudFxyXG4gKlxyXG4gKiBAcGFyYW0ganFfbm9kZVx0XHRcdFx0XHRzdHJpbmcgb3IgalF1ZXJ5IGVsZW1lbnQsICB3aGVyZSBzY3JvbGwgIHRvXHJcbiAqIEBwYXJhbSBleHRyYV9zaGlmdF9vZmZzZXRcdFx0aW50IHNoaWZ0IG9mZnNldCBmcm9tICBqcV9ub2RlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RvX3Njcm9sbCgganFfbm9kZSAsIGV4dHJhX3NoaWZ0X29mZnNldCA9IDAgKXtcclxuXHJcblx0aWYgKCAhalF1ZXJ5KCBqcV9ub2RlICkubGVuZ3RoICl7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cdHZhciB0YXJnZXRPZmZzZXQgPSBqUXVlcnkoIGpxX25vZGUgKS5vZmZzZXQoKS50b3A7XHJcblxyXG5cdGlmICggdGFyZ2V0T2Zmc2V0IDw9IDAgKXtcclxuXHRcdGlmICggMCAhPSBqUXVlcnkoIGpxX25vZGUgKS5uZXh0QWxsKCAnOnZpc2libGUnICkubGVuZ3RoICl7XHJcblx0XHRcdHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLm5leHRBbGwoICc6dmlzaWJsZScgKS5maXJzdCgpLm9mZnNldCgpLnRvcDtcclxuXHRcdH0gZWxzZSBpZiAoIDAgIT0galF1ZXJ5KCBqcV9ub2RlICkucGFyZW50KCkubmV4dEFsbCggJzp2aXNpYmxlJyApLmxlbmd0aCApe1xyXG5cdFx0XHR0YXJnZXRPZmZzZXQgPSBqUXVlcnkoIGpxX25vZGUgKS5wYXJlbnQoKS5uZXh0QWxsKCAnOnZpc2libGUnICkuZmlyc3QoKS5vZmZzZXQoKS50b3A7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoIGpRdWVyeSggJyN3cGFkbWluYmFyJyApLmxlbmd0aCA+IDAgKXtcclxuXHRcdHRhcmdldE9mZnNldCA9IHRhcmdldE9mZnNldCAtIDUwIC0gNTA7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRhcmdldE9mZnNldCA9IHRhcmdldE9mZnNldCAtIDIwIC0gNTA7XHJcblx0fVxyXG5cdHRhcmdldE9mZnNldCArPSBleHRyYV9zaGlmdF9vZmZzZXQ7XHJcblxyXG5cdC8vIFNjcm9sbCBvbmx5ICBpZiB3ZSBkaWQgbm90IHNjcm9sbCBiZWZvcmVcclxuXHRpZiAoICEgalF1ZXJ5KCAnaHRtbCxib2R5JyApLmlzKCAnOmFuaW1hdGVkJyApICl7XHJcblx0XHRqUXVlcnkoICdodG1sLGJvZHknICkuYW5pbWF0ZSgge3Njcm9sbFRvcDogdGFyZ2V0T2Zmc2V0fSwgNTAwICk7XHJcblx0fVxyXG59XHJcblxyXG4iLCJcclxuLy8gRml4SW46IDEwLjIuMC40LlxyXG4vKipcclxuICogRGVmaW5lIFBvcG92ZXJzIGZvciBUaW1lbGluZXMgaW4gV1AgQm9va2luZyBDYWxlbmRhclxyXG4gKlxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfGJvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlZmluZV90aXBweV9wb3BvdmVyKCl7XHJcblx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgKHdwYmNfdGlwcHkpICl7XHJcblx0XHRjb25zb2xlLmxvZyggJ1dQQkMgRXJyb3IuIHdwYmNfdGlwcHkgd2FzIG5vdCBkZWZpbmVkLicgKTtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblx0d3BiY190aXBweSggJy5wb3BvdmVyX2JvdHRvbS5wb3BvdmVyX2NsaWNrJywge1xyXG5cdFx0Y29udGVudCggcmVmZXJlbmNlICl7XHJcblx0XHRcdHZhciBwb3BvdmVyX3RpdGxlID0gcmVmZXJlbmNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnICk7XHJcblx0XHRcdHZhciBwb3BvdmVyX2NvbnRlbnQgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb250ZW50JyApO1xyXG5cdFx0XHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJwb3BvdmVyIHBvcG92ZXJfdGlwcHlcIj4nXHJcblx0XHRcdFx0KyAnPGRpdiBjbGFzcz1cInBvcG92ZXItY2xvc2VcIj48YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgb25jbGljaz1cImphdmFzY3JpcHQ6dGhpcy5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQuX3RpcHB5LmhpZGUoKTtcIiA+JnRpbWVzOzwvYT48L2Rpdj4nXHJcblx0XHRcdFx0KyBwb3BvdmVyX2NvbnRlbnRcclxuXHRcdFx0XHQrICc8L2Rpdj4nO1xyXG5cdFx0fSxcclxuXHRcdGFsbG93SFRNTCAgICAgICAgOiB0cnVlLFxyXG5cdFx0dHJpZ2dlciAgICAgICAgICA6ICdtYW51YWwnLFxyXG5cdFx0aW50ZXJhY3RpdmUgICAgICA6IHRydWUsXHJcblx0XHRoaWRlT25DbGljayAgICAgIDogZmFsc2UsXHJcblx0XHRpbnRlcmFjdGl2ZUJvcmRlcjogMTAsXHJcblx0XHRtYXhXaWR0aCAgICAgICAgIDogNTUwLFxyXG5cdFx0dGhlbWUgICAgICAgICAgICA6ICd3cGJjLXRpcHB5LXBvcG92ZXInLFxyXG5cdFx0cGxhY2VtZW50ICAgICAgICA6ICdib3R0b20tc3RhcnQnLFxyXG5cdFx0dG91Y2ggICAgICAgICAgICA6IFsnaG9sZCcsIDUwMF0sXHJcblx0fSApO1xyXG5cdGpRdWVyeSggJy5wb3BvdmVyX2JvdHRvbS5wb3BvdmVyX2NsaWNrJyApLm9uKCAnY2xpY2snLCBmdW5jdGlvbiAoKXtcclxuXHRcdGlmICggdGhpcy5fdGlwcHkuc3RhdGUuaXNWaXNpYmxlICl7XHJcblx0XHRcdHRoaXMuX3RpcHB5LmhpZGUoKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX3RpcHB5LnNob3coKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblx0d3BiY19kZWZpbmVfaGlkZV90aXBweV9vbl9zY3JvbGwoKTtcclxufVxyXG5cclxuXHJcblxyXG5mdW5jdGlvbiB3cGJjX2RlZmluZV9oaWRlX3RpcHB5X29uX3Njcm9sbCgpe1xyXG5cdGpRdWVyeSggJy5mbGV4X3RsX19zY3JvbGxpbmdfc2VjdGlvbjIsLmZsZXhfdGxfX3Njcm9sbGluZ19zZWN0aW9ucycgKS5vbiggJ3Njcm9sbCcsIGZ1bmN0aW9uICggZXZlbnQgKXtcclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX3RpcHB5KSApe1xyXG5cdFx0XHR3cGJjX3RpcHB5LmhpZGVBbGwoKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuIiwiLyoqXHJcbiAqIFdQQkMgY2FsZW5kYXIgbG9hZGVyIGJvb3RzdHJhcC5cclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiAtIEZpbmRzIGV2ZXJ5IC5jYWxlbmRhcl9sb2FkZXJfZnJhbWVbZGF0YS13cGJjLXJpZF0gb24gdGhlIHBhZ2UgKG5vdyBvciBsYXRlcikuXHJcbiAqIC0gRm9yIGVhY2ggbG9hZGVyIGVsZW1lbnQsIHdhaXRzIGEgXCJncmFjZVwiIHBlcmlvZCAoZGF0YS13cGJjLWdyYWNlLCBkZWZhdWx0IDgwMDAgbXMpOlxyXG4gKiAgICAgLSBJZiB0aGUgcmVhbCBjYWxlbmRhciBhcHBlYXJzOiBkbyBub3RoaW5nIChsb2FkZXIgbmF0dXJhbGx5IHJlcGxhY2VkKS5cclxuICogICAgIC0gSWYgbm90OiBzaG93IGEgaGVscGZ1bCBtZXNzYWdlIChtaXNzaW5nIGpRdWVyeS9fd3BiYy9kYXRlcGljaykgb3IgYSBkdXBsaWNhdGUgbm90aWNlLlxyXG4gKiAtIFdvcmtzIHdpdGggbXVsdGlwbGUgY2FsZW5kYXJzIGFuZCBldmVuIGR1cGxpY2F0ZSBSSURzIG9uIHRoZSBzYW1lIHBhZ2UuXHJcbiAqIC0gTm8gaW5saW5lIEpTIG5lZWRlZCBpbiB0aGUgc2hvcnRjb2RlL3RlbXBsYXRlIG91dHB1dC5cclxuICpcclxuICogRmlsZTogIC4uL2luY2x1ZGVzL19fanMvY2xpZW50L2NhbC93cGJjX2NhbF9sb2FkZXIuanNcclxuICpcclxuICogQHNpbmNlICAgIDEwLjE0LjVcclxuICogQG1vZGlmaWVkIDIwMjUtMDktMDcgMTI6MjFcclxuICogQHZlcnNpb24gIDEuMC4wXHJcbiAqXHJcbiAqL1xyXG4vKipcclxuICogV1BCQyBjYWxlbmRhciBsb2FkZXIgYm9vdHN0cmFwLlxyXG4gKiAtIEF1dG8tZGV0ZWN0cyAuY2FsZW5kYXJfbG9hZGVyX2ZyYW1lW2RhdGEtd3BiYy1yaWRdIGJsb2Nrcy5cclxuICogLSBXYWl0cyBhIFwiZ3JhY2VcIiBwZXJpb2QgcGVyIGVsZW1lbnQgYmVmb3JlIHNob3dpbmcgYSBoZWxwZnVsIG1lc3NhZ2VcclxuICogICBpZiB0aGUgcmVhbCBjYWxlbmRhciBoYXNuJ3QgcmVwbGFjZWQgdGhlIGxvYWRlci5cclxuICogLSBNdWx0aXBsZSBjYWxlbmRhcnMgYW5kIGR1cGxpY2F0ZSBSSURzIGFyZSBoYW5kbGVkLlxyXG4gKi9cclxuKGZ1bmN0aW9uICh3LCBkKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHQvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKiBTbWFsbCB1dGlsaXRpZXMgKHNuYWtlX2Nhc2UpXHJcblx0ICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKiBUcmFjayBwcm9jZXNzZWQgbG9hZGVyIGVsZW1lbnRzOyBmYWxsYmFjayB0byBkYXRhIGZsYWcgaWYgV2Vha1NldCBtaXNzaW5nLiAqL1xyXG5cdHZhciBwcm9jZXNzZWRfc2V0ID0gdHlwZW9mIFdlYWtTZXQgPT09ICdmdW5jdGlvbicgPyBuZXcgV2Vha1NldCgpIDogbnVsbDtcclxuXHJcblx0LyoqIFJldHVybiBmaXJzdCBtYXRjaCBpbnNpZGUgb3B0aW9uYWwgcm9vdC4gKi9cclxuXHRmdW5jdGlvbiBxdWVyeV9vbmUoc2VsZWN0b3IsIHJvb3QpIHtcclxuXHRcdHJldHVybiAocm9vdCB8fCBkKS5xdWVyeVNlbGVjdG9yKCBzZWxlY3RvciApO1xyXG5cdH1cclxuXHJcblx0LyoqIFJldHVybiBOb2RlTGlzdCBvZiBtYXRjaGVzIGluc2lkZSBvcHRpb25hbCByb290LiAqL1xyXG5cdGZ1bmN0aW9uIHF1ZXJ5X2FsbChzZWxlY3Rvciwgcm9vdCkge1xyXG5cdFx0cmV0dXJuIChyb290IHx8IGQpLnF1ZXJ5U2VsZWN0b3JBbGwoIHNlbGVjdG9yICk7XHJcblx0fVxyXG5cclxuXHQvKiogUnVuIGEgY2FsbGJhY2sgd2hlbiBET00gaXMgcmVhZHkuICovXHJcblx0ZnVuY3Rpb24gb25fcmVhZHkoZm4pIHtcclxuXHRcdGlmICggZC5yZWFkeVN0YXRlID09PSAnbG9hZGluZycgKSB7XHJcblx0XHRcdGQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBmbiApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0Zm4oKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKiBDbGVhciBpbnRlcnZhbCBzYWZlbHkuICovXHJcblx0ZnVuY3Rpb24gc2FmZV9jbGVhcihpbnRlcnZhbF9pZCkge1xyXG5cdFx0dHJ5IHtcclxuXHRcdFx0dy5jbGVhckludGVydmFsKCBpbnRlcnZhbF9pZCApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKiogTWFyayBlbGVtZW50IHByb2Nlc3NlZCAoV2Vha1NldCBvciBkYXRhIGF0dHJpYnV0ZSkuICovXHJcblx0ZnVuY3Rpb24gbWFya19wcm9jZXNzZWQoZWwpIHtcclxuXHRcdGlmICggcHJvY2Vzc2VkX3NldCApIHtcclxuXHRcdFx0cHJvY2Vzc2VkX3NldC5hZGQoIGVsICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGVsLmRhdGFzZXQud3BiY1Byb2Nlc3NlZCA9ICcxJztcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKiBDaGVjayBpZiBlbGVtZW50IHdhcyBwcm9jZXNzZWQuICovXHJcblx0ZnVuY3Rpb24gaXNfcHJvY2Vzc2VkKGVsKSB7XHJcblx0XHRyZXR1cm4gcHJvY2Vzc2VkX3NldCA/IHByb2Nlc3NlZF9zZXQuaGFzKCBlbCApIDogKGVsICYmIGVsLmRhdGFzZXQgJiYgZWwuZGF0YXNldC53cGJjUHJvY2Vzc2VkID09PSAnMScpO1xyXG5cdH1cclxuXHJcblx0LyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ICogTWVzc2FnZXMgKGZpeGVkIEVuZ2xpc2ggc3RyaW5nczsgbm8gaTE4bilcclxuXHQgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogQnVpbGQgZml4ZWQgRW5nbGlzaCBtZXNzYWdlcyBmb3IgYSByZXNvdXJjZS5cclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IHJpZFxyXG5cdCAqIEByZXR1cm4ge3tkdXBsaWNhdGU6c3RyaW5nLHN1cHBvcnQ6c3RyaW5nLGxpYl9qcTpzdHJpbmcsbGliX2RwOnN0cmluZyxsaWJfd3BiYzpzdHJpbmd9fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGdldF9tZXNzYWdlcyhyaWQpIHtcclxuXHRcdHZhciByaWRfaW50ID0gcGFyc2VJbnQoIHJpZCwgMTAgKTtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdGR1cGxpY2F0ZSAgOlxyXG5cdFx0XHRcdCdZb3UgaGF2ZSBhZGRlZCB0aGUgc2FtZSBjYWxlbmRhciAoSUQgPSAnICsgcmlkX2ludCArICcpIG1vcmUgdGhhbiBvbmNlIG9uIHRoaXMgcGFnZS4gJyArXHJcblx0XHRcdFx0J1BsZWFzZSBrZWVwIG9ubHkgb25lIGNhbGVuZGFyIHdpdGggdGhlIHNhbWUgSUQgb24gYSBwYWdlIHRvIGF2b2lkIGNvbmZsaWN0cy4nLFxyXG5cdFx0XHRpbml0X2ZhaWxlZDpcclxuXHRcdFx0XHQnVGhlIGNhbGVuZGFyIGNvdWxkIG5vdCBiZSBpbml0aWFsaXplZCBvbiB0aGlzIHBhZ2UuJyArICdcXG4nICtcclxuXHRcdFx0XHQnUGxlYXNlIGNoZWNrIHlvdXIgYnJvd3NlciBjb25zb2xlIGZvciBKYXZhU2NyaXB0IGVycm9ycyBhbmQgY29uZmxpY3RzIHdpdGggb3RoZXIgc2NyaXB0cy9wbHVnaW5zLicsXHJcblx0XHRcdHN1cHBvcnQgICAgOiAnJywgLyogJ0NvbnRhY3Qgc3VwcG9ydEB3cGJvb2tpbmdjYWxlbmRhci5jb20gaWYgeW91IGhhdmUgYW55IHF1ZXN0aW9ucy4nLCAqL1xyXG5cdFx0XHRsaWJfanEgICAgIDpcclxuXHRcdFx0XHQnSXQgYXBwZWFycyB0aGF0IHRoZSBcImpRdWVyeVwiIGxpYnJhcnkgaXMgbm90IGxvYWRpbmcgY29ycmVjdGx5LicgKyAnXFxuJyArXHJcblx0XHRcdFx0J0ZvciBtb3JlIGluZm9ybWF0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhpcyBwYWdlOiBodHRwczovL3dwYm9va2luZ2NhbGVuZGFyLmNvbS9mYXEvJyxcclxuXHRcdFx0bGliX2RwICAgICA6XHJcblx0XHRcdFx0J0l0IGFwcGVhcnMgdGhhdCB0aGUgXCJqUXVlcnkuZGF0ZXBpY2tcIiBsaWJyYXJ5IGlzIG5vdCBsb2FkaW5nIGNvcnJlY3RseS4nICsgJ1xcbicgK1xyXG5cdFx0XHRcdCdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHJlZmVyIHRvIHRoaXMgcGFnZTogaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vZmFxLycsXHJcblx0XHRcdGxpYl93cGJjICAgOlxyXG5cdFx0XHRcdCdJdCBhcHBlYXJzIHRoYXQgdGhlIFwiX3dwYmNcIiBsaWJyYXJ5IGlzIG5vdCBsb2FkaW5nIGNvcnJlY3RseS4nICsgJ1xcbicgK1xyXG5cdFx0XHRcdCdQbGVhc2UgZW5hYmxlIHRoZSBsb2FkaW5nIG9mIEpTL0NTUyBmaWxlcyBmb3IgdGhpcyBwYWdlIG9uIHRoZSBcIldQIEJvb2tpbmcgQ2FsZW5kYXJcIiAtIFwiU2V0dGluZ3MgR2VuZXJhbFwiIC0gXCJBZHZhbmNlZFwiIHBhZ2UnICsgJ1xcbicgK1xyXG5cdFx0XHRcdCdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHJlZmVyIHRvIHRoaXMgcGFnZTogaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vZmFxLydcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBXcmFwIHBsYWluIHRleHQgKHdpdGggbmV3bGluZXMpIGluIGEgc21hbGwgSFRNTCBjb250YWluZXIuXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IG1zZ1xyXG5cdCAqIEByZXR1cm4ge3N0cmluZ31cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cmFwX2h0bWwobXNnKSB7XHJcblx0XHRyZXR1cm4gJzxkaXYgc3R5bGU9XCJmb250LXNpemU6MTNweDttYXJnaW46MTBweDtcIj4nICsgU3RyaW5nKCBtc2cgfHwgJycgKS5yZXBsYWNlKCAvXFxuL2csICc8YnI+JyApICsgJzwvZGl2Pic7XHJcblx0fVxyXG5cclxuXHQvKiogTGlicmFyeSBwcmVzZW5jZSBjaGVja3MgKGZhc3QgJiBjaGVhcCkuICovXHJcblx0ZnVuY3Rpb24gaGFzX2pxKCkge1xyXG5cdFx0cmV0dXJuICEhKHcualF1ZXJ5ICYmIGpRdWVyeS5mbiAmJiB0eXBlb2YgalF1ZXJ5LmZuLm9uID09PSAnZnVuY3Rpb24nKTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGhhc19kcCgpIHtcclxuXHRcdHJldHVybiAhISh3LmpRdWVyeSAmJiBqUXVlcnkuZGF0ZXBpY2spO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaGFzX3dwYmMoKSB7XHJcblx0XHRyZXR1cm4gISEody5fd3BiYyAmJiB0eXBlb2Ygdy5fd3BiYy5zZXRfb3RoZXJfcGFyYW0gPT09ICdmdW5jdGlvbicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gbm9ybWFsaXplX3JpZChyaWQpIHtcclxuXHRcdHZhciBuID0gcGFyc2VJbnQoIHJpZCwgMTAgKTtcclxuXHRcdHJldHVybiAobiA+IDApID8gU3RyaW5nKCBuICkgOiAnJztcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGdldF9yaWRfY291bnRzKHJpZCkge1xyXG5cdFx0dmFyIHIgPSBub3JtYWxpemVfcmlkKCByaWQgKTtcclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHJpZCAgICAgICA6IHIsXHJcblx0XHRcdGxvYWRlcnMgICA6IHIgPyBxdWVyeV9hbGwoICcuY2FsZW5kYXJfbG9hZGVyX2ZyYW1lW2RhdGEtd3BiYy1yaWQ9XCInICsgciArICdcIl0nICkubGVuZ3RoIDogMCxcclxuXHRcdFx0Y29udGFpbmVyczogciA/IHF1ZXJ5X2FsbCggJyNjYWxlbmRhcl9ib29raW5nJyArIHIgKS5sZW5ndGggOiAwXHJcblx0XHR9O1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfZHVwbGljYXRlX3JpZChyaWQpIHtcclxuXHRcdHZhciBjID0gZ2V0X3JpZF9jb3VudHMoIHJpZCApO1xyXG5cdFx0cmV0dXJuIChjLmxvYWRlcnMgPiAxKSB8fCAoYy5jb250YWluZXJzID4gMSk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBEZXRlcm1pbmUgaWYgdGhlIGxvYWRlciBoYXMgYmVlbiByZXBsYWNlZCBieSB0aGUgcmVhbCBjYWxlbmRhci5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7RWxlbWVudH0gZWwgICAgICAgTG9hZGVyIGVsZW1lbnRcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcmlkICAgICAgIFJlc291cmNlIElEXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fG51bGx9IGNvbnRhaW5lciBPcHRpb25hbCAjY2FsZW5kYXJfYm9va2luZ3tyaWR9IGVsZW1lbnRcclxuXHQgKiBAcmV0dXJuIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGlzX3JlcGxhY2VkKGVsLCByaWQsIGNvbnRhaW5lcikge1xyXG5cdFx0dmFyIGxvYWRlcl9zdGlsbF9pbl9kb20gPSBkLmJvZHkuY29udGFpbnMoIGVsICk7XHJcblx0XHR2YXIgY2FsZW5kYXJfZXhpc3RzICAgICA9ICEhcXVlcnlfb25lKCAnLndwYmNfY2FsZW5kYXJfaWRfJyArIHJpZCwgY29udGFpbmVyIHx8IGQgKTtcclxuXHRcdHJldHVybiAoIWxvYWRlcl9zdGlsbF9pbl9kb20pIHx8IGNhbGVuZGFyX2V4aXN0cztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFN0YXJ0IHdhdGNoZXIgZm9yIGEgc2luZ2xlIGxvYWRlciBlbGVtZW50LlxyXG5cdCAqIC0gUG9sbHMgYW5kIG9ic2VydmVzIHRoZSBjYWxlbmRhciBjb250YWluZXIuXHJcblx0ICogLSBBZnRlciBncmFjZSwgaW5qZWN0cyBhIHN1aXRhYmxlIG1lc3NhZ2UgaWYgbm90IHJlcGxhY2VkLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fSBlbFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHN0YXJ0X2ZvcihlbCkge1xyXG5cdFx0aWYgKCAhIGVsIHx8IGlzX3Byb2Nlc3NlZCggZWwgKSApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0bWFya19wcm9jZXNzZWQoIGVsICk7XHJcblxyXG5cdFx0dmFyIHJpZCA9IGVsLmRhdGFzZXQud3BiY1JpZDtcclxuXHRcdGlmICggISByaWQgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZ3JhY2VfbXMgPSBwYXJzZUludCggZWwuZGF0YXNldC53cGJjR3JhY2UgfHwgJzgwMDAnLCAxMCApO1xyXG5cdFx0aWYgKCAhIChncmFjZV9tcyA+IDApICkge1xyXG5cdFx0XHRncmFjZV9tcyA9IDgwMDA7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNvbnRhaW5lcl9pZCA9ICdjYWxlbmRhcl9ib29raW5nJyArIHJpZDtcclxuXHRcdHZhciBjb250YWluZXIgICAgPSBkLmdldEVsZW1lbnRCeUlkKCBjb250YWluZXJfaWQgKTtcclxuXHRcdHZhciB0ZXh0X2VsICAgICAgPSBxdWVyeV9vbmUoICcuY2FsZW5kYXJfbG9hZGVyX3RleHQnLCBlbCApO1xyXG5cclxuXHRcdGZ1bmN0aW9uIHJlcGxhY2VkX25vdygpIHtcclxuXHRcdFx0cmV0dXJuIGlzX3JlcGxhY2VkKCBlbCwgcmlkLCBjb250YWluZXIgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBBbHJlYWR5IHJlcGxhY2VkIC0+IG5vdGhpbmcgdG8gZG8uXHJcblx0XHRpZiAoIHJlcGxhY2VkX25vdygpICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gMSkgQ2hlYXAgcG9sbGluZy5cclxuXHRcdHZhciBwb2xsX2lkID0gdy5zZXRJbnRlcnZhbCggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRpZiAoIHJlcGxhY2VkX25vdygpICkge1xyXG5cdFx0XHRcdHNhZmVfY2xlYXIoIHBvbGxfaWQgKTtcclxuXHRcdFx0XHRpZiAoIG9ic2VydmVyICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9LCAyNTAgKTtcclxuXHJcblx0XHQvLyAyKSBNdXRhdGlvbk9ic2VydmVyIGZvciBmYXN0ZXIgcmVhY3Rpb24uXHJcblx0XHR2YXIgb2JzZXJ2ZXIgPSBudWxsO1xyXG5cdFx0aWYgKCBjb250YWluZXIgJiYgJ011dGF0aW9uT2JzZXJ2ZXInIGluIHcgKSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0b2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggZnVuY3Rpb24gKCkge1xyXG5cdFx0XHRcdFx0aWYgKCByZXBsYWNlZF9ub3coKSApIHtcclxuXHRcdFx0XHRcdFx0c2FmZV9jbGVhciggcG9sbF9pZCApO1xyXG5cdFx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuXHRcdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0b2JzZXJ2ZXIub2JzZXJ2ZSggY29udGFpbmVyLCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9ICk7XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gMykgRmluYWwgZGVjaXNpb24gYWZ0ZXIgZ3JhY2UgcGVyaW9kLlxyXG5cdFx0dy5zZXRUaW1lb3V0KCBmdW5jdGlvbiBmaW5hbGl6ZV9hZnRlcl9ncmFjZSgpIHtcclxuXHRcdFx0aWYgKCByZXBsYWNlZF9ub3coKSApIHtcclxuXHRcdFx0XHRzYWZlX2NsZWFyKCBwb2xsX2lkICk7XHJcblx0XHRcdFx0aWYgKCBvYnNlcnZlciApIHtcclxuXHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuXHRcdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBNID0gZ2V0X21lc3NhZ2VzKCByaWQgKTtcclxuXHRcdFx0dmFyIG1zZztcclxuXHRcdFx0aWYgKCAhIGhhc19qcSgpICkge1xyXG5cdFx0XHRcdG1zZyA9IE0ubGliX2pxO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAhIGhhc193cGJjKCkgKSB7XHJcblx0XHRcdFx0bXNnID0gTS5saWJfd3BiYztcclxuXHRcdFx0fSBlbHNlIGlmICggISBoYXNfZHAoKSApIHtcclxuXHRcdFx0XHRtc2cgPSBNLmxpYl9kcDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyBMaWJyYXJpZXMgYXJlIHByZXNlbnQsIGJ1dCBsb2FkZXIgd2Fzbid0IHJlcGxhY2VkIC0+IGRlY2lkZSB3aGF0IGlzIG1vc3QgbGlrZWx5LlxyXG5cdFx0XHRcdGlmICggaXNfZHVwbGljYXRlX3JpZCggcmlkICkgKSB7XHJcblx0XHRcdFx0XHRtc2cgPSBNLmR1cGxpY2F0ZSArICdcXG5cXG4nICsgTS5zdXBwb3J0O1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRtc2cgPSBNLmluaXRfZmFpbGVkICsgJ1xcblxcbicgKyBNLnN1cHBvcnQ7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdGlmICggdGV4dF9lbCApIHtcclxuXHRcdFx0XHRcdHRleHRfZWwuaW5uZXJIVE1MID0gd3JhcF9odG1sKCBtc2cgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRzYWZlX2NsZWFyKCBwb2xsX2lkICk7XHJcblx0XHRcdGlmICggb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdG9ic2VydmVyLmRpc2Nvbm5lY3QoKTtcclxuXHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sIGdyYWNlX21zICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJbml0aWFsaXplIHdhdGNoZXJzIGZvciBsb2FkZXIgZWxlbWVudHMgYWxyZWFkeSBpbiB0aGUgRE9NLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGJvb3RzdHJhcF9leGlzdGluZygpIHtcclxuXHRcdHF1ZXJ5X2FsbCggJy5jYWxlbmRhcl9sb2FkZXJfZnJhbWVbZGF0YS13cGJjLXJpZF0nICkuZm9yRWFjaCggc3RhcnRfZm9yICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBPYnNlcnZlIHRoZSBkb2N1bWVudCBmb3IgYW55IG5ldyBsb2FkZXIgZWxlbWVudHMgaW5zZXJ0ZWQgbGF0ZXIgKEFKQVgsIGJsb2NrIHJlbmRlcikuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gb2JzZXJ2ZV9uZXdfbG9hZGVycygpIHtcclxuXHRcdGlmICggISAoJ011dGF0aW9uT2JzZXJ2ZXInIGluIHcpICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHR0cnkge1xyXG5cdFx0XHR2YXIgZG9jX29ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoIGZ1bmN0aW9uIChtdXRhdGlvbnMpIHtcclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBtdXRhdGlvbnMubGVuZ3RoOyBpKysgKSB7XHJcblx0XHRcdFx0XHR2YXIgbm9kZXMgPSBtdXRhdGlvbnNbaV0uYWRkZWROb2RlcyB8fCBbXTtcclxuXHRcdFx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IG5vZGVzLmxlbmd0aDsgaisrICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgbm9kZSA9IG5vZGVzW2pdO1xyXG5cdFx0XHRcdFx0XHRpZiAoICEgbm9kZSB8fCBub2RlLm5vZGVUeXBlICE9PSAxICkge1xyXG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdGlmICggbm9kZS5tYXRjaGVzICYmIG5vZGUubWF0Y2hlcyggJy5jYWxlbmRhcl9sb2FkZXJfZnJhbWVbZGF0YS13cGJjLXJpZF0nICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0c3RhcnRfZm9yKCBub2RlICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0aWYgKCBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwgKSB7XHJcblx0XHRcdFx0XHRcdFx0dmFyIGlubmVyID0gbm9kZS5xdWVyeVNlbGVjdG9yQWxsKCAnLmNhbGVuZGFyX2xvYWRlcl9mcmFtZVtkYXRhLXdwYmMtcmlkXScgKTtcclxuXHRcdFx0XHRcdFx0XHRpZiAoIGlubmVyICYmIGlubmVyLmxlbmd0aCApIHtcclxuXHRcdFx0XHRcdFx0XHRcdGlubmVyLmZvckVhY2goIHN0YXJ0X2ZvciApO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0XHRkb2Nfb2JzZXJ2ZXIub2JzZXJ2ZSggZC5kb2N1bWVudEVsZW1lbnQsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0gKTtcclxuXHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ICogQm9vdFxyXG5cdCAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cdG9uX3JlYWR5KCBmdW5jdGlvbiAoKSB7XHJcblx0XHRib290c3RyYXBfZXhpc3RpbmcoKTtcclxuXHRcdG9ic2VydmVfbmV3X2xvYWRlcnMoKTtcclxuXHR9ICk7XHJcblxyXG59KSggd2luZG93LCBkb2N1bWVudCApO1xyXG4iLCIoZnVuY3Rpb24oIHcgKSB7XHJcblxyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0aWYgKCAhIHcuV1BCQ19GRSApIHtcclxuXHRcdHcuV1BCQ19GRSA9IHt9O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQXV0by1maWxsIGJvb2tpbmcgZm9ybSBmaWVsZHMgKHRleHQvZW1haWwpIGJhc2VkIG9uIGlucHV0IFwibmFtZVwiIHBhdHRlcm5zLlxyXG5cdCAqXHJcblx0ICogRm9ybSBJRCBmb3JtYXQ6IGJvb2tpbmdfZm9ybXtyZXNvdXJjZV9pZH1cclxuXHQgKiBTa2lwcyBkYXRlIGZpZWxkOiBkYXRlX2Jvb2tpbmd7cmVzb3VyY2VfaWR9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKiBAcGFyYW0ge09iamVjdH0gZmlsbF92YWx1ZXMgVmFsdWVzIHRvIGluamVjdCAoc3RyaW5ncykuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGZvcm0gZm91bmQgYW5kIHByb2Nlc3NlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxyXG5cdCAqL1xyXG5cdHcuV1BCQ19GRS5hdXRvZmlsbF9ib29raW5nX2Zvcm1fZmllbGRzID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBmaWxsX3ZhbHVlcyApIHtcclxuXHJcblx0XHRyZXNvdXJjZV9pZCAgPSBwYXJzZUludCggcmVzb3VyY2VfaWQsIDEwICkgfHwgMDtcclxuXHRcdGZpbGxfdmFsdWVzICA9IGZpbGxfdmFsdWVzIHx8IHt9O1xyXG5cclxuXHRcdHZhciBmb3JtX2lkICAgPSAnYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkO1xyXG5cdFx0dmFyIGRhdGVfbmFtZSA9ICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQ7XHJcblxyXG5cdFx0dmFyIHN1Ym1pdF9mb3JtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIGZvcm1faWQgKTtcclxuXHJcblx0XHRpZiAoICEgc3VibWl0X2Zvcm0gKSB7XHJcblx0XHRcdC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cclxuXHRcdFx0Y29uc29sZS5lcnJvciggJ1dQQkM6IE5vIGJvb2tpbmcgZm9ybTogJyArIGZvcm1faWQgKTtcclxuXHRcdFx0LyogZXNsaW50LWVuYWJsZSBuby1jb25zb2xlICovXHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBLZWVwIHNhbWUgcmVnZXggcnVsZXMgYW5kIHByaW9yaXR5IG9yZGVyIGFzIGxlZ2FjeSBpbmxpbmUgSlMuXHJcblx0XHR2YXIgcnVsZXMgPSBhcnJheV9ydWxlcyggZmlsbF92YWx1ZXMgKTtcclxuXHJcblx0XHR2YXIgZWxlbWVudHMgPSBzdWJtaXRfZm9ybS5lbGVtZW50cyB8fCBbXTtcclxuXHRcdHZhciBjb3VudCAgICA9IGVsZW1lbnRzLmxlbmd0aDtcclxuXHRcdHZhciBlbDtcclxuXHRcdHZhciBpO1xyXG5cdFx0dmFyIGo7XHJcblxyXG5cdFx0Zm9yICggaSA9IDA7IGkgPCBjb3VudDsgaSsrICkge1xyXG5cclxuXHRcdFx0ZWwgPSBlbGVtZW50c1sgaSBdO1xyXG5cclxuXHRcdFx0aWYgKCAhIGVsIHx8ICEgZWwubmFtZSApIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gT25seSB0ZXh0L2VtYWlsIGlucHV0cy5cclxuXHRcdFx0aWYgKCAoIGVsLnR5cGUgIT09ICd0ZXh0JyApICYmICggZWwudHlwZSAhPT0gJ2VtYWlsJyApICkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTa2lwIGRhdGUgZmllbGQuXHJcblx0XHRcdGlmICggZWwubmFtZSA9PT0gZGF0ZV9uYW1lICkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGaWxsIG9ubHkgZW1wdHkgdmFsdWVzIChsZWdhY3kgYmVoYXZpb3I6ID09IFwiXCIpLlxyXG5cdFx0XHRpZiAoIGVsLnZhbHVlICE9PSAnJyApIHtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Zm9yICggaiA9IDA7IGogPCBydWxlcy5sZW5ndGg7IGorKyApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBydWxlc1sgaiBdLnJlLnRlc3QoIGVsLm5hbWUgKSApIHtcclxuXHJcblx0XHRcdFx0XHRpZiAoIHJ1bGVzWyBqIF0udmFsICE9PSAnJyApIHtcclxuXHRcdFx0XHRcdFx0ZWwudmFsdWUgPSBydWxlc1sgaiBdLnZhbDtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRicmVhazsgLy8gU3RvcCBhdCBmaXJzdCBtYXRjaGluZyBydWxlIChwcmlvcml0eSkuXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQnVpbGQgcnVsZXMgYXJyYXkgZm9yIGF1dG9maWxsLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtPYmplY3R9IGZpbGxfdmFsdWVzIFZhbHVlcyB0byBpbmplY3QuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJuIHtBcnJheX0gUnVsZXMgbGlzdC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBhcnJheV9ydWxlcyggZmlsbF92YWx1ZXMgKSB7XHJcblxyXG5cdFx0Ly8gTm9ybWFsaXplIHRvIHN0cmluZ3MgKHByZXZlbnQgXCJ1bmRlZmluZWRcIiBpbiBmaWVsZHMpLlxyXG5cdFx0dmFyIG5pY2tuYW1lICA9ICggZmlsbF92YWx1ZXMubmlja25hbWUgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy5uaWNrbmFtZSApIDogJyc7XHJcblx0XHR2YXIgbGFzdF9uYW1lID0gKCBmaWxsX3ZhbHVlcy5sYXN0X25hbWUgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy5sYXN0X25hbWUgKSA6ICcnO1xyXG5cdFx0dmFyIGZpcnN0X25hbWUgPSAoIGZpbGxfdmFsdWVzLmZpcnN0X25hbWUgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy5maXJzdF9uYW1lICkgOiAnJztcclxuXHRcdHZhciBlbWFpbCAgICAgPSAoIGZpbGxfdmFsdWVzLmVtYWlsICE9IG51bGwgKSA/IFN0cmluZyggZmlsbF92YWx1ZXMuZW1haWwgKSA6ICcnO1xyXG5cdFx0dmFyIHBob25lICAgICA9ICggZmlsbF92YWx1ZXMucGhvbmUgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy5waG9uZSApIDogJyc7XHJcblx0XHR2YXIgbmJfZW5mYW50ID0gKCBmaWxsX3ZhbHVlcy5uYl9lbmZhbnQgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy5uYl9lbmZhbnQgKSA6ICcnO1xyXG5cdFx0dmFyIHVybCAgICAgICA9ICggZmlsbF92YWx1ZXMudXJsICE9IG51bGwgKSA/IFN0cmluZyggZmlsbF92YWx1ZXMudXJsICkgOiAnJztcclxuXHJcblx0XHRyZXR1cm4gW1xyXG5cdFx0XHR7IHJlOiAvXihbQS1aYS16MC05X1xcLVxcLl0pKihuaWNrbmFtZSl7MX0oW0EtWmEtejAtOV9cXC1cXC5dKSokLywgdmFsOiBuaWNrbmFtZSB9LFxyXG5cdFx0XHR7IHJlOiAvXihbQS1aYS16MC05X1xcLVxcLl0pKihsYXN0fHNlY29uZCl7MX0oW19cXC1cXC5dKT9uYW1lKFtBLVphLXowLTlfXFwtXFwuXSkqJC8sIHZhbDogbGFzdF9uYW1lIH0sXHJcblx0XHRcdHsgcmU6IC9ebmFtZShbMC05X1xcLVxcLl0pKiQvLCB2YWw6IGZpcnN0X25hbWUgfSxcclxuXHRcdFx0eyByZTogL14oW0EtWmEtejAtOV9cXC1cXC5dKSooZmlyc3R8bXkpezF9KFtfXFwtXFwuXSk/bmFtZShbQS1aYS16MC05X1xcLVxcLl0pKiQvLCB2YWw6IGZpcnN0X25hbWUgfSxcclxuXHRcdFx0eyByZTogL14oZSk/KFtfXFwtXFwuXSk/bWFpbChbMC05X1xcLVxcLl0qKSQvLCB2YWw6IGVtYWlsIH0sXHJcblx0XHRcdHsgcmU6IC9eKFtBLVphLXowLTlfXFwtXFwuXSkqKHBob25lfGZvbmUpezF9KFtBLVphLXowLTlfXFwtXFwuXSkqJC8sIHZhbDogcGhvbmUgfSxcclxuXHRcdFx0eyByZTogL14oZSk/KFtfXFwtXFwuXSk/bmJfZW5mYW50KFswLTlfXFwtXFwuXSopJC8sIHZhbDogbmJfZW5mYW50IH0sXHJcblx0XHRcdHsgcmU6IC9eKFtBLVphLXowLTlfXFwtXFwuXSkqKFVSTHxzaXRlfHdlYnxXRUIpezF9KFtBLVphLXowLTlfXFwtXFwuXSkqJC8sIHZhbDogdXJsIH1cclxuXHRcdF07XHJcblx0fVxyXG5cclxufSkoIHdpbmRvdyApO1xyXG4iLCIvLyA9PSBTdWJtaXQgQm9va2luZyBEYXRhID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLy8gUmVmYWN0b3JlZCAoc2FmZSksIHdpdGggbmV3IHdwYmNfKiBuYW1lcy5cclxuLy8gQmFja3dhcmQtY29tcGF0aWJsZSB3cmFwcGVycyBmb3IgbGVnYWN5IGZ1bmN0aW9uIG5hbWVzIGFyZSBpbmNsdWRlZCBhdCB0aGUgYm90dG9tLlxyXG4vLyBAZmlsZTogaW5jbHVkZXMvX19qcy9jbGllbnQvZnJvbnRfZW5kX2Zvcm0vYm9va2luZ19mb3JtX3N1Ym1pdC5qc1xyXG5cclxuLyoqXHJcbiAqIENoZWNrIGZpZWxkcyBhdCBmb3JtIGFuZCB0aGVuIHNlbmQgcmVxdWVzdCAobGVnYWN5OiBteWJvb2tpbmdfc3VibWl0KS5cclxuICpcclxuICogQHBhcmFtIHtIVE1MRm9ybUVsZW1lbnR9IHN1Ym1pdF9mb3JtXHJcbiAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gICByZXNvdXJjZV9pZFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgICAgd3BkZXZfYWN0aXZlX2xvY2FsZVxyXG4gKlxyXG4gKiBAcmV0dXJuIHtmYWxzZXx1bmRlZmluZWR9IExlZ2FjeSBiZWhhdmlvcjogcmV0dXJucyBmYWxzZSBpbiBzb21lIGNhc2VzLCBvdGhlcndpc2UgdW5kZWZpbmVkLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fc3VibWl0KCBzdWJtaXRfZm9ybSwgcmVzb3VyY2VfaWQsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKSB7XHJcblxyXG5cdHJlc291cmNlX2lkID0gcGFyc2VJbnQoIHJlc291cmNlX2lkLCAxMCApO1xyXG5cclxuXHQvLyBTYWZldHkgZ3VhcmQgKGxlZ2FjeSBjb2RlIGFzc3VtZWQgdmFsaWQgZm9ybSkuXHJcblx0aWYgKCAhIHN1Ym1pdF9mb3JtIHx8ICEgc3VibWl0X2Zvcm0uZWxlbWVudHMgKSB7XHJcblx0XHQvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25zb2xlICovXHJcblx0XHRjb25zb2xlLmVycm9yKCAnV1BCQzogSW52YWxpZCBzdWJtaXQgZm9ybSBpbiB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXQoKS4nICk7XHJcblx0XHQvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBFeHRlcm5hbCBob29rOiBhbGxvdyBwYXVzZSBzdWJtaXQgb24gY29uZmlybWF0aW9uL3N1bW1hcnkgc3RlcC5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHRhcmdldF9lbG0gPSBqUXVlcnkoICcuYm9va2luZ19mb3JtX2RpdicgKS50cmlnZ2VyKCAnYm9va2luZ19mb3JtX3N1Ym1pdF9jbGljaycsIFsgcmVzb3VyY2VfaWQsIHN1Ym1pdF9mb3JtLCB3cGRldl9hY3RpdmVfbG9jYWxlIF0gKTsgLy8gRml4SW46IDguOC4zLjEzLlxyXG5cclxuXHRpZiAoXHJcblx0XHQoIGpRdWVyeSggdGFyZ2V0X2VsbSApLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ19mb3JtX3Nob3dfc3VtbWFyeVwiXScgKS5sZW5ndGggPiAwICkgJiZcclxuXHRcdCggJ3BhdXNlX3N1Ym1pdCcgPT09IGpRdWVyeSggdGFyZ2V0X2VsbSApLmZpbmQoICdpbnB1dFtuYW1lPVwiYm9va2luZ19mb3JtX3Nob3dfc3VtbWFyeVwiXScgKS52YWwoKSApXHJcblx0KSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBGaXhJbjogOC40LjAuMi5cclxuXHR2YXIgaXNfZXJyb3IgPSB3cGJjX2NoZWNrX2Vycm9yc19pbl9ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkICk7XHJcblx0aWYgKCBpc19lcnJvciApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTaG93IG1lc3NhZ2UgaWYgbm8gc2VsZWN0ZWQgZGF5cyBpbiBDYWxlbmRhcihzKS5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGRhdGVfaW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBkYXRlX3ZhbHVlID0gKCBkYXRlX2lucHV0ICkgPyBkYXRlX2lucHV0LnZhbHVlIDogJyc7XHJcblxyXG5cdGlmICggJycgPT09IGRhdGVfdmFsdWUgKSB7XHJcblxyXG5cdFx0dmFyIGFycl9vZl9zZWxlY3RlZF9hZGRpdGlvbmFsX2NhbGVuZGFycyA9IHdwYmNfZ2V0X2Fycl9vZl9zZWxlY3RlZF9hZGRpdGlvbmFsX2NhbGVuZGFycyggcmVzb3VyY2VfaWQgKTsgLy8gRml4SW46IDguNS4yLjI2LlxyXG5cclxuXHRcdGlmICggISBhcnJfb2Zfc2VsZWN0ZWRfYWRkaXRpb25hbF9jYWxlbmRhcnMgfHwgKCBhcnJfb2Zfc2VsZWN0ZWRfYWRkaXRpb25hbF9jYWxlbmRhcnMubGVuZ3RoID09PSAwICkgKSB7XHJcblx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoXG5cdFx0XHRcdCcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCArICcgLmJrX2NhbGVuZGFyX2ZyYW1lJyxcblx0XHRcdFx0X3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX25vX3NlbGVjdGVkX2RhdGVzJyApLFxuXHRcdFx0XHQndGV4dCdcblx0XHRcdCk7XG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRml4SW46IDYuMS4xLjMuIFRpbWUgc2VsZWN0aW9uIGF2YWlsYWJpbGl0eSBjaGVja3MuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGlmICggdHlwZW9mIHdwYmNfaXNfdGhpc190aW1lX3NlbGVjdGlvbl9ub3RfYXZhaWxhYmxlID09PSAnZnVuY3Rpb24nICkge1xyXG5cclxuXHRcdGlmICggJycgPT09IGRhdGVfdmFsdWUgKSB7IC8vIFByaW1hcnkgY2FsZW5kYXIgbm90IHNlbGVjdGVkLlxyXG5cclxuXHRcdFx0dmFyIGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdhZGRpdGlvbmFsX2NhbGVuZGFycycgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0aWYgKCBhZGRpdGlvbmFsX2NhbGVuZGFyc19lbCAhPT0gbnVsbCApIHsgLy8gQ2hlY2tpbmcgYWRkaXRpb25hbCBjYWxlbmRhcnMuXHJcblxyXG5cdFx0XHRcdHZhciBpZF9hZGRpdGlvbmFsX3N0ciA9IGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsLnZhbHVlO1xyXG5cdFx0XHRcdHZhciBpZF9hZGRpdGlvbmFsX2FyciA9IGlkX2FkZGl0aW9uYWxfc3RyLnNwbGl0KCAnLCcgKTtcclxuXHRcdFx0XHR2YXIgaXNfdGltZXNfZGF0ZXNfb2sgPSBmYWxzZTtcclxuXHJcblx0XHRcdFx0Zm9yICggdmFyIGlhID0gMDsgaWEgPCBpZF9hZGRpdGlvbmFsX2Fyci5sZW5ndGg7IGlhKysgKSB7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGFkZF9pZCA9IGlkX2FkZGl0aW9uYWxfYXJyWyBpYSBdO1xyXG5cclxuXHRcdFx0XHRcdHZhciBhZGRfZGF0ZV9lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZGF0ZV9ib29raW5nJyArIGFkZF9pZCApO1xyXG5cdFx0XHRcdFx0dmFyIGFkZF9kYXRlX3ZhbCA9ICggYWRkX2RhdGVfZWwgKSA/IGFkZF9kYXRlX2VsLnZhbHVlIDogJyc7XHJcblxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQoICcnICE9PSBhZGRfZGF0ZV92YWwgKSAmJlxyXG5cdFx0XHRcdFx0XHQoICEgd3BiY19pc190aGlzX3RpbWVfc2VsZWN0aW9uX25vdF9hdmFpbGFibGUoIGFkZF9pZCwgc3VibWl0X2Zvcm0uZWxlbWVudHMgKSApXHJcblx0XHRcdFx0XHQpIHtcclxuXHRcdFx0XHRcdFx0aXNfdGltZXNfZGF0ZXNfb2sgPSB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIGlzX3RpbWVzX2RhdGVzX29rICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdH0gZWxzZSB7IC8vIFByaW1hcnkgY2FsZW5kYXIgc2VsZWN0ZWQuXHJcblxyXG5cdFx0XHRpZiAoIHdwYmNfaXNfdGhpc190aW1lX3NlbGVjdGlvbl9ub3RfYXZhaWxhYmxlKCByZXNvdXJjZV9pZCwgc3VibWl0X2Zvcm0uZWxlbWVudHMgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTZXJpYWxpemUgZm9ybSAobGVnYWN5IGZvcm1hdCkuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBjb3VudCAgICA9IHN1Ym1pdF9mb3JtLmVsZW1lbnRzLmxlbmd0aDtcclxuXHR2YXIgZm9ybWRhdGEgPSAnJztcclxuXHR2YXIgaW5wX3ZhbHVlO1xyXG5cdHZhciBpbnBfdGl0bGVfdmFsdWU7XHJcblx0dmFyIGVsZW1lbnQ7XHJcblx0dmFyIGVsX3R5cGU7XHJcblxyXG5cdC8vIEhlbHBlcjogbGVnYWN5IGVzY2FwaW5nIGZvciB0aGUgc2VyaWFsaXplZCB2YWx1ZS5cclxuXHRmdW5jdGlvbiB3cGJjX2VzY2FwZV9zZXJpYWxpemVkX3ZhbHVlKCB2YWwgKSB7XHJcblxyXG5cdFx0dmFsID0gKCB2YWwgPT0gbnVsbCApID8gJycgOiBTdHJpbmcoIHZhbCApO1xyXG5cclxuXHRcdC8vIFJlcGxhY2UgcmVnaXN0ZXJlZCBjaGFyYWN0ZXJzLlxyXG5cdFx0dmFsID0gdmFsLnJlcGxhY2UoIG5ldyBSZWdFeHAoICdcXFxcXicsICdnJyApLCAnJiM5NDsnICk7XHJcblx0XHR2YWwgPSB2YWwucmVwbGFjZSggbmV3IFJlZ0V4cCggJ34nLCAnZycgKSwgJyYjMTI2OycgKTtcclxuXHJcblx0XHQvLyBSZXBsYWNlIHF1b3Rlcy5cclxuXHRcdHZhbCA9IHZhbC5yZXBsYWNlKCAvXCIvZywgJyYjMzQ7JyApO1xyXG5cdFx0dmFsID0gdmFsLnJlcGxhY2UoIC8nL2csICcmIzM5OycgKTtcclxuXHJcblx0XHRyZXR1cm4gdmFsO1xyXG5cdH1cclxuXHJcblx0Ly8gSGVscGVyOiBkZXRlcm1pbmUgVUkgdHlwZSBmb3IgdGl0bGUgZXh0cmFjdGlvbiAobGVnYWN5IGxvZ2ljKS5cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9pbnB1dF9lbGVtZW50X3R5cGUoIGVsICkge1xyXG5cclxuXHRcdGlmICggISBlbCB8fCAhIGVsLnRhZ05hbWUgKSB7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgdGFnID0gU3RyaW5nKCBlbC50YWdOYW1lICkudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0XHRpZiAoICdpbnB1dCcgPT09IHRhZyApIHtcclxuXHRcdFx0cmV0dXJuICggZWwudHlwZSApID8gU3RyaW5nKCBlbC50eXBlICkudG9Mb3dlckNhc2UoKSA6ICd0ZXh0JztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBMZWdhY3kgdXNlZCBcInNlbGVjdFwiIHN0cmluZyBoZXJlLlxyXG5cdFx0aWYgKCAnc2VsZWN0JyA9PT0gdGFnICkge1xyXG5cdFx0XHRyZXR1cm4gJ3NlbGVjdCc7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRhZztcclxuXHR9XHJcblxyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGNvdW50OyBpKysgKSB7IC8vIEZpeEluOiA5LjEuNS4xLlxyXG5cclxuXHRcdGVsZW1lbnQgPSBzdWJtaXRfZm9ybS5lbGVtZW50c1sgaSBdO1xyXG5cclxuXHRcdGlmICggISBlbGVtZW50ICkge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGpRdWVyeSggZWxlbWVudCApLmNsb3Nlc3QoICcuYm9va2luZ19mb3JtX2dhcmJhZ2UnICkubGVuZ3RoICkge1xyXG5cdFx0XHRjb250aW51ZTsgLy8gU2tpcCBlbGVtZW50cyBmcm9tIGdhcmJhZ2UuIEZpeEluOiA3LjEuMi4xNC5cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICcxJyA9PT0gU3RyaW5nKCBqUXVlcnkoIGVsZW1lbnQgKS5hdHRyKCAnZGF0YS13cGJjLWJvb2tpbmctc3VibWl0LWlnbm9yZScgKSB8fCAnJyApICkge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCggZWxlbWVudC50eXBlICE9PSAnYnV0dG9uJyApICYmXHJcblx0XHRcdCggZWxlbWVudC50eXBlICE9PSAnaGlkZGVuJyApICYmXHJcblx0XHRcdCggZWxlbWVudC5uYW1lICE9PSAoICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdC8vICYmICggalF1ZXJ5KCBlbGVtZW50ICkuaXMoICc6dmlzaWJsZScgKSApIC8vRml4SW46IDcuMi4xLjEyLjJcclxuXHRcdCkge1xyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBHZXQgZWxlbWVudCB2YWx1ZS5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRpZiAoIGVsZW1lbnQudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBlbGVtZW50LnZhbHVlID09PSAnJyApIHtcclxuXHRcdFx0XHRcdGlucF92YWx1ZSA9IGVsZW1lbnQuY2hlY2tlZDtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gKCBlbGVtZW50LmNoZWNrZWQgKSA/IGVsZW1lbnQudmFsdWUgOiAnJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBlbGVtZW50LnR5cGUgPT09ICdyYWRpbycgKSB7XHJcblxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jaGVja2VkICkge1xyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gZWxlbWVudC52YWx1ZTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdC8vIFJlcXVpcmVkIHJhZGlvOiBzaG93IHdhcm5pbmcgaWYgbm9uZSBjaGVja2VkLlxyXG5cdFx0XHRcdFx0Ly8gRml4SW46IDcuMC4xLjYyLlxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQoIGVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoICd3cGRldi12YWxpZGF0ZXMtYXMtcmVxdWlyZWQnICkgIT09IC0xICkgJiZcclxuXHRcdFx0XHRcdFx0KCBqUXVlcnkoIGVsZW1lbnQgKS5pcyggJzp2aXNpYmxlJyApICkgJiYgLy8gRml4SW46IDcuMi4xLjEyLjIuXHJcblx0XHRcdFx0XHRcdCggISBqUXVlcnkoICc6cmFkaW9bbmFtZT1cIicgKyBlbGVtZW50Lm5hbWUgKyAnXCJdJywgc3VibWl0X2Zvcm0gKS5pcyggJzpjaGVja2VkJyApIClcclxuXHRcdFx0XHRcdCkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfcmVxdWlyZWRfZm9yX3JhZGlvX2JveCcgKSwgJ3RleHQnICk7IC8vIEZpeEluOiA4LjUuMS4zLlxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNraXAgc3RvcmluZyBlbXB0eSByYWRpbyBvcHRpb25zLlxyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRpbnBfdmFsdWUgPSBlbGVtZW50LnZhbHVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpbnBfdGl0bGVfdmFsdWUgPSAnJztcclxuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0Ly8gR2V0IGh1bWFuLWZyaWVuZGx5IHRpdGxlIHZhbHVlIChsZWdhY3kgYmVoYXZpb3IpLlxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdHZhciBpbnB1dF9lbGVtZW50X3R5cGUgPSB3cGJjX2dldF9pbnB1dF9lbGVtZW50X3R5cGUoIGVsZW1lbnQgKTtcclxuXHJcblx0XHRcdHN3aXRjaCAoIGlucHV0X2VsZW1lbnRfdHlwZSApIHtcclxuXHJcblx0XHRcdFx0Y2FzZSAndGV4dCc6XHJcblx0XHRcdFx0Y2FzZSAnZW1haWwnOlxyXG5cdFx0XHRcdFx0aW5wX3RpdGxlX3ZhbHVlID0gaW5wX3ZhbHVlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3NlbGVjdCc6XHJcblx0XHRcdFx0XHRpbnBfdGl0bGVfdmFsdWUgPSBqUXVlcnkoIGVsZW1lbnQgKS5maW5kKCAnb3B0aW9uOnNlbGVjdGVkJyApLnRleHQoKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdyYWRpbyc6XHJcblx0XHRcdFx0Y2FzZSAnY2hlY2tib3gnOlxyXG5cdFx0XHRcdFx0aWYgKCBqUXVlcnkoIGVsZW1lbnQgKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgbGFiZWxfZWxlbWVudCA9IGpRdWVyeSggZWxlbWVudCApLnBhcmVudHMoICcud3BkZXYtbGlzdC1pdGVtJyApLmZpbmQoICcud3BkZXYtbGlzdC1pdGVtLWxhYmVsJyApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGxhYmVsX2VsZW1lbnQubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0XHRcdGlucF90aXRsZV92YWx1ZSA9IGxhYmVsX2VsZW1lbnQuaHRtbCgpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRcdGlucF90aXRsZV92YWx1ZSA9IGlucF92YWx1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBNdWx0aXBsZSBzZWxlY3QgdmFsdWUgZXh0cmFjdGlvbi5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRpZiAoICggZWxlbWVudC50eXBlID09PSAnc2VsZWN0Ym94LW11bHRpcGxlJyApIHx8ICggZWxlbWVudC50eXBlID09PSAnc2VsZWN0LW11bHRpcGxlJyApICkge1xyXG5cdFx0XHRcdGlucF92YWx1ZSA9IGpRdWVyeSggJ1tuYW1lPVwiJyArIGVsZW1lbnQubmFtZSArICdcIl0nICkudmFsKCk7XHJcblx0XHRcdFx0aWYgKCAoIGlucF92YWx1ZSA9PT0gbnVsbCApIHx8ICggU3RyaW5nKCBpbnBfdmFsdWUgKSA9PT0gJycgKSApIHtcclxuXHRcdFx0XHRcdGlucF92YWx1ZSA9ICcnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBNYWtlIHZhbGlkYXRpb24gb25seSBmb3IgdmlzaWJsZSBlbGVtZW50cy5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRpZiAoIGpRdWVyeSggZWxlbWVudCApLmlzKCAnOnZpc2libGUnICkgKSB7IC8vIEZpeEluOiA3LjIuMS4xMi4yLlxyXG5cclxuXHRcdFx0XHQvLyBSZWNoZWNrIG1heCBhdmFpbGFibGUgdmlzaXRvcnMgc2VsZWN0aW9uLlxyXG5cdFx0XHRcdGlmICggdHlwZW9mIHdwYmNfX2lzX2xlc3NfdGhhbl9yZXF1aXJlZF9fb2ZfbWF4X2F2YWlsYWJsZV9zbG90c19fYmwgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRpZiAoIHdwYmNfX2lzX2xlc3NfdGhhbl9yZXF1aXJlZF9fb2ZfbWF4X2F2YWlsYWJsZV9zbG90c19fYmwoIHJlc291cmNlX2lkLCBlbGVtZW50ICkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFJlcXVpcmVkIGZpZWxkcy5cclxuXHRcdFx0XHRpZiAoIGVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoICd3cGRldi12YWxpZGF0ZXMtYXMtcmVxdWlyZWQnICkgIT09IC0xICkge1xyXG5cclxuXHRcdFx0XHRcdGlmICggKCBlbGVtZW50LnR5cGUgPT09ICdjaGVja2JveCcgKSAmJiAoIGVsZW1lbnQuY2hlY2tlZCA9PT0gZmFsc2UgKSApIHtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggISBqUXVlcnkoICc6Y2hlY2tib3hbbmFtZT1cIicgKyBlbGVtZW50Lm5hbWUgKyAnXCJdJywgc3VibWl0X2Zvcm0gKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGVsZW1lbnQsIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZF9mb3JfY2hlY2tfYm94JyApLCAndGV4dCcgKTsgLy8gRml4SW46IDguNS4xLjMuXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggZWxlbWVudC50eXBlID09PSAncmFkaW8nICkge1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAhIGpRdWVyeSggJzpyYWRpb1tuYW1lPVwiJyArIGVsZW1lbnQubmFtZSArICdcIl0nLCBzdWJtaXRfZm9ybSApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggZWxlbWVudCwgX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX3JlcXVpcmVkX2Zvcl9yYWRpb19ib3gnICksICd0ZXh0JyApOyAvLyBGaXhJbjogOC41LjEuMy5cblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAoIGVsZW1lbnQudHlwZSAhPT0gJ2NoZWNrYm94JyApICYmICggZWxlbWVudC50eXBlICE9PSAncmFkaW8nICkgJiYgKCAnJyA9PT0gd3BiY190cmltKCBpbnBfdmFsdWUgKSApICkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfcmVxdWlyZWQnICksICd0ZXh0JyApOyAvLyBGaXhJbjogOC41LjEuMy5cblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEVtYWlsIGZvcm1hdCB2YWxpZGF0aW9uLlxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3dwZGV2LXZhbGlkYXRlcy1hcy1lbWFpbCcgKSAhPT0gLTEgKSB7XHJcblxyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gU3RyaW5nKCBpbnBfdmFsdWUgKS5yZXBsYWNlKCAvXlxccyt8XFxzKyQvZ20sICcnICk7IC8vIFRyaW0gd2hpdGUgc3BhY2UuIEZpeEluOiA1LjQuNS5cclxuXHRcdFx0XHRcdHZhciByZWdfZW1haWwgPSAvXihbQS1aYS16MC05X1xcLVxcLlxcK10pK1xcQChbQS1aYS16MC05X1xcLVxcLl0pK1xcLihbQS1aYS16XXsyLH0pJC87XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBpbnBfdmFsdWUgIT09ICcnICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHJlZ19lbWFpbC50ZXN0KCBpbnBfdmFsdWUgKSA9PT0gZmFsc2UgKSB7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggZWxlbWVudCwgX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX2VtYWlsJyApLCAndGV4dCcgKTsgLy8gRml4SW46IDguNS4xLjMuXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gU2FtZSBlbWFpbCBmaWVsZCB2YWxpZGF0aW9uICh2ZXJpZmljYXRpb24gZmllbGQpLlxyXG5cdFx0XHRcdGlmICggKCBlbGVtZW50LmNsYXNzTmFtZS5pbmRleE9mKCAnd3BkZXYtdmFsaWRhdGVzLWFzLWVtYWlsJyApICE9PSAtMSApICYmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3NhbWVfYXNfJyApICE9PSAtMSApICkge1xyXG5cclxuXHRcdFx0XHRcdHZhciBwcmltYXJ5X2VtYWlsX25hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5tYXRjaCggL3NhbWVfYXNfKFteXFxzXSkrL2dpICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBwcmltYXJ5X2VtYWlsX25hbWUgIT09IG51bGwgKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRwcmltYXJ5X2VtYWlsX25hbWUgPSBwcmltYXJ5X2VtYWlsX25hbWVbIDAgXS5zdWJzdHIoIDggKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnW25hbWU9XCInICsgcHJpbWFyeV9lbWFpbF9uYW1lICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLmxlbmd0aCA+IDAgKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnW25hbWU9XCInICsgcHJpbWFyeV9lbWFpbF9uYW1lICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLnZhbCgpICE9PSBpbnBfdmFsdWUgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfc2FtZV9lbWFpbCcgKSwgJ3RleHQnICk7IC8vIEZpeEluOiA4LjUuMS4zLlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBTa2lwIG9uZSBsb29wIGZvciB0aGUgZW1haWwgdmVyaWZpY2F0aW9uIGZpZWxkLlxyXG5cdFx0XHRcdFx0Y29udGludWU7IC8vIEZpeEluOiA4LjEuMi4xNS5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0Ly8gR2V0IEZvcm0gRGF0YSAobGVnYWN5IGZvcm1hdCkuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0aWYgKCBlbGVtZW50Lm5hbWUgIT09ICggJ2NhcHRjaGFfaW5wdXQnICsgcmVzb3VyY2VfaWQgKSApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBmb3JtZGF0YSAhPT0gJycgKSB7XHJcblx0XHRcdFx0XHRmb3JtZGF0YSArPSAnfic7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRlbF90eXBlID0gZWxlbWVudC50eXBlO1xyXG5cclxuXHRcdFx0XHRpZiAoIGVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoICd3cGRldi12YWxpZGF0ZXMtYXMtZW1haWwnICkgIT09IC0xICkge1xyXG5cdFx0XHRcdFx0ZWxfdHlwZSA9ICdlbWFpbCc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3dwZGV2LXZhbGlkYXRlcy1hcy1jb3Vwb24nICkgIT09IC0xICkge1xyXG5cdFx0XHRcdFx0ZWxfdHlwZSA9ICdjb3Vwb24nO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aW5wX3ZhbHVlID0gd3BiY19lc2NhcGVfc2VyaWFsaXplZF92YWx1ZSggaW5wX3ZhbHVlICk7XHJcblxyXG5cdFx0XHRcdGlmICggZWxfdHlwZSA9PT0gJ3NlbGVjdC1vbmUnICkge1xyXG5cdFx0XHRcdFx0ZWxfdHlwZSA9ICdzZWxlY3Rib3gtb25lJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBlbF90eXBlID09PSAnc2VsZWN0LW11bHRpcGxlJyApIHtcclxuXHRcdFx0XHRcdGVsX3R5cGUgPSAnc2VsZWN0Ym94LW11bHRpcGxlJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZvcm1kYXRhICs9IGVsX3R5cGUgKyAnXicgKyBlbGVtZW50Lm5hbWUgKyAnXicgKyBpbnBfdmFsdWU7XHJcblxyXG5cdFx0XHRcdC8vIEFkZCB0aXRsZS9sYWJlbCB2YWx1ZSAobGVnYWN5KS5cclxuXHRcdFx0XHR2YXIgY2xlYW5fZmllbGRfbmFtZSA9IFN0cmluZyggZWxlbWVudC5uYW1lICk7XHJcblxyXG5cdFx0XHRcdC8vIEJVR0ZJWDogcmVwbGFjZUFsbChSZWdFeHApIGlzIG5vdCBzdXBwb3J0ZWQgaW4gb2xkZXIgYnJvd3NlcnMuXHJcblx0XHRcdFx0Ly8gS2VlcCBsZWdhY3kgaW50ZW50OiByZW1vdmUgW10gc3VmZml4IG9jY3VycmVuY2VzLlxyXG5cdFx0XHRcdGNsZWFuX2ZpZWxkX25hbWUgPSBjbGVhbl9maWVsZF9uYW1lLnJlcGxhY2UoIC9cXFtcXF0vZ2ksICcnICk7XHJcblxyXG5cdFx0XHRcdHZhciByZXNvdXJjZV9pZF9zdHIgPSBTdHJpbmcoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0XHRcdC8vIExlZ2FjeSBhc3N1bWVkIHN1ZmZpeCBlbmRzIHdpdGggcmVzb3VyY2VfaWQsIG1ha2UgaXQgc2FmZS5cclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHQoIGNsZWFuX2ZpZWxkX25hbWUubGVuZ3RoID49IHJlc291cmNlX2lkX3N0ci5sZW5ndGggKSAmJlxyXG5cdFx0XHRcdFx0KCBjbGVhbl9maWVsZF9uYW1lLnN1YnN0ciggY2xlYW5fZmllbGRfbmFtZS5sZW5ndGggLSByZXNvdXJjZV9pZF9zdHIubGVuZ3RoICkgPT09IHJlc291cmNlX2lkX3N0ciApXHJcblx0XHRcdFx0KSB7XHJcblx0XHRcdFx0XHRjbGVhbl9maWVsZF9uYW1lID0gY2xlYW5fZmllbGRfbmFtZS5zdWJzdHIoIDAsIGNsZWFuX2ZpZWxkX25hbWUubGVuZ3RoIC0gcmVzb3VyY2VfaWRfc3RyLmxlbmd0aCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Zm9ybWRhdGEgKz0gJ34nICsgZWxfdHlwZSArICdeJyArIGNsZWFuX2ZpZWxkX25hbWUgKyAnX3ZhbCcgKyByZXNvdXJjZV9pZCArICdeJyArIGlucF90aXRsZV92YWx1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gVE9ETzogaGVyZSB3YXMgZnVuY3Rpb24gZm9yICdDaGVjayBpZiB2aXNpdG9yIGZpbmlzaCBkYXRlcyBzZWxlY3Rpb24uXHJcblxyXG5cdC8vIENhcHRjaGEgdmVyaWZ5LlxyXG5cdHZhciBjYXB0Y2hhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGRldl9jYXB0Y2hhX2NoYWxsZW5nZV8nICsgcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0aWYgKCBjYXB0Y2hhICE9PSBudWxsICkge1xyXG5cdFx0d3BiY19mb3JtX3N1Ym1pdF9zZW5kKCByZXNvdXJjZV9pZCwgZm9ybWRhdGEsIGNhcHRjaGEudmFsdWUsIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FwdGNoYV9pbnB1dCcgKyByZXNvdXJjZV9pZCApLnZhbHVlLCB3cGRldl9hY3RpdmVfbG9jYWxlICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdwYmNfZm9ybV9zdWJtaXRfc2VuZCggcmVzb3VyY2VfaWQsIGZvcm1kYXRhLCAnJywgJycsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybjtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBHYXRoZXJpbmcgcGFyYW1zIGZvciBzZW5kaW5nIEFqYXggcmVxdWVzdCBhbmQgdGhlbiBzZW5kIGl0IChsZWdhY3k6IGZvcm1fc3VibWl0X3NlbmQpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgZm9ybWRhdGFcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBjYXB0Y2hhX2NoYWxhbmdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgdXNlcl9jYXB0Y2hhXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgd3BkZXZfYWN0aXZlX2xvY2FsZVxyXG4gKlxyXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9IExlZ2FjeSBiZWhhdmlvci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZm9ybV9zdWJtaXRfc2VuZCggcmVzb3VyY2VfaWQsIGZvcm1kYXRhLCBjYXB0Y2hhX2NoYWxhbmdlLCB1c2VyX2NhcHRjaGEsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKSB7XHJcblxyXG5cdHJlc291cmNlX2lkID0gcGFyc2VJbnQoIHJlc291cmNlX2lkLCAxMCApO1xyXG5cclxuXHR2YXIgbXlfYm9va2luZ19mb3JtID0gJyc7XHJcblx0dmFyIGJvb2tpbmdfZm9ybV90eXBlX2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdib29raW5nX2Zvcm1fdHlwZScgKyByZXNvdXJjZV9pZCApO1xyXG5cdGlmICggYm9va2luZ19mb3JtX3R5cGVfZWwgIT09IG51bGwgKSB7XHJcblx0XHRteV9ib29raW5nX2Zvcm0gPSBib29raW5nX2Zvcm1fdHlwZV9lbC52YWx1ZTtcclxuXHR9XHJcblxyXG5cdHZhciBteV9ib29raW5nX2hhc2ggPSAnJztcclxuXHRpZiAoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9ib29raW5nX2hhc2gnICkgIT09ICcnICkge1xyXG5cdFx0bXlfYm9va2luZ19oYXNoID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2Jvb2tpbmdfaGFzaCcgKTtcclxuXHR9XHJcblxyXG5cdHZhciBpc19zZW5kX2VtZWlscyA9IDE7XHJcblx0dmFyICRpc19zZW5kX2VtYWlsX3RvZ2dsZSA9IGpRdWVyeSggJyNpc19zZW5kX2VtYWlsX2Zvcl9wZW5kaW5nJyApO1xyXG5cdHZhciAkbW9kYWxfc2VuZF9lbWFpbF90b2dnbGUgPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkuY2xvc2VzdCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKS5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1zZW5kLWVtYWlsc10nICkuZmlyc3QoKTtcclxuXHRpZiAoICRtb2RhbF9zZW5kX2VtYWlsX3RvZ2dsZS5sZW5ndGggKSB7XHJcblx0XHQkaXNfc2VuZF9lbWFpbF90b2dnbGUgPSAkbW9kYWxfc2VuZF9lbWFpbF90b2dnbGU7XHJcblx0fVxyXG5cdGlmICggJGlzX3NlbmRfZW1haWxfdG9nZ2xlLmxlbmd0aCApIHsgLy8gRml4SW46IDguNy45LjUuXHJcblxyXG5cdFx0aXNfc2VuZF9lbWVpbHMgPSAkaXNfc2VuZF9lbWFpbF90b2dnbGUuaXMoICc6Y2hlY2tlZCcgKTtcclxuXHJcblx0XHRpZiAoIGZhbHNlID09PSBpc19zZW5kX2VtZWlscyApIHtcclxuXHRcdFx0aXNfc2VuZF9lbWVpbHMgPSAwO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aXNfc2VuZF9lbWVpbHMgPSAxO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIGRhdGVfZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBkYXRlX3ZhbHVlID0gKCBkYXRlX2VsICkgPyBkYXRlX2VsLnZhbHVlIDogJyc7XHJcblxyXG5cdGlmICggJycgIT09IGRhdGVfdmFsdWUgKSB7IC8vIEZpeEluOiA2LjEuMS4zLlxyXG5cdFx0d3BiY19zZW5kX2FqYXhfc3VibWl0KCByZXNvdXJjZV9pZCwgZm9ybWRhdGEsIGNhcHRjaGFfY2hhbGFuZ2UsIHVzZXJfY2FwdGNoYSwgaXNfc2VuZF9lbWVpbHMsIG15X2Jvb2tpbmdfaGFzaCwgbXlfYm9va2luZ19mb3JtLCB3cGRldl9hY3RpdmVfbG9jYWxlICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkuaGlkZSgpO1xyXG5cdFx0alF1ZXJ5KCAnI3N1Ym1pdGluZycgKyByZXNvdXJjZV9pZCApLmhpZGUoKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBBZGRpdGlvbmFsIGNhbGVuZGFycyBzdWJtaXQuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBhZGRpdGlvbmFsX2NhbGVuZGFyc19lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnYWRkaXRpb25hbF9jYWxlbmRhcnMnICsgcmVzb3VyY2VfaWQgKTtcclxuXHRpZiAoIGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsID09PSBudWxsICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyIGlkX2FkZGl0aW9uYWxfc3RyID0gYWRkaXRpb25hbF9jYWxlbmRhcnNfZWwudmFsdWU7XHJcblx0dmFyIGlkX2FkZGl0aW9uYWxfYXJyID0gaWRfYWRkaXRpb25hbF9zdHIuc3BsaXQoICcsJyApO1xyXG5cclxuXHQvLyBGaXhJbjogMTAuOS40LjEuXHJcblx0Zm9yICggdmFyIGlhID0gMDsgaWEgPCBpZF9hZGRpdGlvbmFsX2Fyci5sZW5ndGg7IGlhKysgKSB7XHJcblx0XHRpZF9hZGRpdGlvbmFsX2FyclsgaWEgXSA9IHBhcnNlSW50KCBpZF9hZGRpdGlvbmFsX2FyclsgaWEgXSwgMTAgKTtcclxuXHR9XHJcblxyXG5cdGlmICggISBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3coIHJlc291cmNlX2lkICk7IC8vIFNob3cgU3Bpbm5lclxyXG5cdH1cclxuXHJcblx0Ly8gSGVscGVyOiByZXdyaXRlIGZpZWxkIG5hbWUgc3VmZml4IGZyb20gcmVzb3VyY2VfaWQgLT4gaWRfYWRkaXRpb25hbC5cclxuXHRmdW5jdGlvbiB3cGJjX3Jld3JpdGVfZmllbGRfbmFtZV9zdWZmaXgoIGZpZWxkX25hbWUsIG9sZF9pZCwgbmV3X2lkICkge1xyXG5cclxuXHRcdGZpZWxkX25hbWUgPSBTdHJpbmcoIGZpZWxkX25hbWUgKTtcclxuXHJcblx0XHR2YXIgb2xkX2lkX3N0ciA9IFN0cmluZyggb2xkX2lkICk7XHJcblx0XHR2YXIgbmV3X2lkX3N0ciA9IFN0cmluZyggbmV3X2lkICk7XHJcblxyXG5cdFx0Ly8gSGFuZGxlIGZpZWxkcyB3aXRoIFtdLlxyXG5cdFx0aWYgKFxyXG5cdFx0XHQoIGZpZWxkX25hbWUubGVuZ3RoID49ICggb2xkX2lkX3N0ci5sZW5ndGggKyAyICkgKSAmJlxyXG5cdFx0XHQoIGZpZWxkX25hbWUuc3Vic3RyKCBmaWVsZF9uYW1lLmxlbmd0aCAtICggb2xkX2lkX3N0ci5sZW5ndGggKyAyICkgKSA9PT0gKCBvbGRfaWRfc3RyICsgJ1tdJyApIClcclxuXHRcdCkge1xyXG5cdFx0XHRyZXR1cm4gZmllbGRfbmFtZS5zdWJzdHIoIDAsIGZpZWxkX25hbWUubGVuZ3RoIC0gKCBvbGRfaWRfc3RyLmxlbmd0aCArIDIgKSApICsgbmV3X2lkX3N0ciArICdbXSc7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gSGFuZGxlIGZpZWxkcyB3aXRob3V0IFtdLlxyXG5cdFx0aWYgKFxyXG5cdFx0XHQoIGZpZWxkX25hbWUubGVuZ3RoID49IG9sZF9pZF9zdHIubGVuZ3RoICkgJiZcclxuXHRcdFx0KCBmaWVsZF9uYW1lLnN1YnN0ciggZmllbGRfbmFtZS5sZW5ndGggLSBvbGRfaWRfc3RyLmxlbmd0aCApID09PSBvbGRfaWRfc3RyIClcclxuXHRcdCkge1xyXG5cdFx0XHRyZXR1cm4gZmllbGRfbmFtZS5zdWJzdHIoIDAsIGZpZWxkX25hbWUubGVuZ3RoIC0gb2xkX2lkX3N0ci5sZW5ndGggKSArIG5ld19pZF9zdHI7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRmFsbGJhY2s6IHJldHVybiB1bmNoYW5nZWQgKHNhZmVyIHRoYW4gYnJlYWtpbmcgbmFtZSkuXHJcblx0XHRyZXR1cm4gZmllbGRfbmFtZTtcclxuXHR9XHJcblxyXG5cdGZvciAoIGlhID0gMDsgaWEgPCBpZF9hZGRpdGlvbmFsX2Fyci5sZW5ndGg7IGlhKysgKSB7XHJcblxyXG5cdFx0dmFyIGlkX2FkZGl0aW9uYWwgPSBpZF9hZGRpdGlvbmFsX2FyclsgaWEgXTtcclxuXHJcblx0XHQvLyBGaXhJbjogMTAuOS40LjEuXHJcblx0XHRpZiAoIGlkX2FkZGl0aW9uYWwgPD0gMCApIHtcclxuXHRcdFx0Y29udGludWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmVidWlsZCBmb3JtZGF0YSBmb3IgZWFjaCBhZGRpdGlvbmFsIGNhbGVuZGFyIChsZWdhY3kgYmVoYXZpb3IpLlxyXG5cdFx0dmFyIGZvcm1kYXRhX2FkZGl0aW9uYWxfYXJyID0gU3RyaW5nKCBmb3JtZGF0YSApLnNwbGl0KCAnficgKTtcclxuXHRcdHZhciBmb3JtZGF0YV9hZGRpdGlvbmFsID0gJyc7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZm9ybWRhdGFfYWRkaXRpb25hbF9hcnIubGVuZ3RoOyBqKysgKSB7XHJcblxyXG5cdFx0XHR2YXIgbXlfZm9ybV9maWVsZCA9IGZvcm1kYXRhX2FkZGl0aW9uYWxfYXJyWyBqIF0uc3BsaXQoICdeJyApO1xyXG5cclxuXHRcdFx0aWYgKCBmb3JtZGF0YV9hZGRpdGlvbmFsICE9PSAnJyApIHtcclxuXHRcdFx0XHRmb3JtZGF0YV9hZGRpdGlvbmFsICs9ICd+JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU2FmZXR5OiBlbnN1cmUgd2UgaGF2ZSBhdCBsZWFzdCB0eXBlIF4gbmFtZSBeIHZhbHVlLlxyXG5cdFx0XHRpZiAoIG15X2Zvcm1fZmllbGQubGVuZ3RoIDwgMyApIHtcclxuXHRcdFx0XHRmb3JtZGF0YV9hZGRpdGlvbmFsICs9IGZvcm1kYXRhX2FkZGl0aW9uYWxfYXJyWyBqIF07XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG15X2Zvcm1fZmllbGRbIDEgXSA9IHdwYmNfcmV3cml0ZV9maWVsZF9uYW1lX3N1ZmZpeCggbXlfZm9ybV9maWVsZFsgMSBdLCByZXNvdXJjZV9pZCwgaWRfYWRkaXRpb25hbCApO1xyXG5cdFx0XHRmb3JtZGF0YV9hZGRpdGlvbmFsICs9IG15X2Zvcm1fZmllbGRbIDAgXSArICdeJyArIG15X2Zvcm1fZmllbGRbIDEgXSArICdeJyArIG15X2Zvcm1fZmllbGRbIDIgXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBJZiBwYXltZW50IGZvcm0gZm9yIG1haW4gYm9va2luZyByZXNvdXJjZSBpcyBzaG93aW5nLCBhcHBlbmQgZm9yIGFkZGl0aW9uYWwgY2FsZW5kYXJzLlxyXG5cdFx0aWYgKCBqUXVlcnkoICcjZ2F0ZXdheV9wYXltZW50X2Zvcm1zJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApIHtcclxuXHRcdFx0alF1ZXJ5KCAnI2dhdGV3YXlfcGF5bWVudF9mb3JtcycgKyByZXNvdXJjZV9pZCApLmFmdGVyKCAnPGRpdiBpZD1cImdhdGV3YXlfcGF5bWVudF9mb3JtcycgKyBpZF9hZGRpdGlvbmFsICsgJ1wiPjwvZGl2PicgKTtcclxuXHRcdFx0alF1ZXJ5KCAnI2dhdGV3YXlfcGF5bWVudF9mb3JtcycgKyByZXNvdXJjZV9pZCApLmFmdGVyKCAnPGRpdiBpZD1cImFqYXhfcmVzcG9uZF9pbnNlcnQnICsgaWRfYWRkaXRpb25hbCArICdcIiBzdHlsZT1cImRpc3BsYXk6bm9uZTtcIj48L2Rpdj4nICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRml4SW46IDguNS4yLjE3LlxyXG5cdFx0d3BiY19zZW5kX2FqYXhfc3VibWl0KCBpZF9hZGRpdGlvbmFsLCBmb3JtZGF0YV9hZGRpdGlvbmFsLCBjYXB0Y2hhX2NoYWxhbmdlLCB1c2VyX2NhcHRjaGEsIGlzX3NlbmRfZW1laWxzLCBteV9ib29raW5nX2hhc2gsIG15X2Jvb2tpbmdfZm9ybSwgd3BkZXZfYWN0aXZlX2xvY2FsZSApO1xyXG5cdH1cclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggc3VibWl0IChsZWdhY3k6IHNlbmRfYWpheF9zdWJtaXQpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgZm9ybWRhdGFcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBjYXB0Y2hhX2NoYWxhbmdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgdXNlcl9jYXB0Y2hhXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgaXNfc2VuZF9lbWVpbHNcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBteV9ib29raW5nX2hhc2hcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBteV9ib29raW5nX2Zvcm1cclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICB3cGRldl9hY3RpdmVfbG9jYWxlXHJcbiAqXHJcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH0gTGVnYWN5IGJlaGF2aW9yLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZW5kX2FqYXhfc3VibWl0KHJlc291cmNlX2lkLCBmb3JtZGF0YSwgY2FwdGNoYV9jaGFsYW5nZSwgdXNlcl9jYXB0Y2hhLCBpc19zZW5kX2VtZWlscywgbXlfYm9va2luZ19oYXNoLCBteV9ib29raW5nX2Zvcm0sIHdwZGV2X2FjdGl2ZV9sb2NhbGUpIHtcclxuXHJcblx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggcmVzb3VyY2VfaWQsIDEwICk7XHJcblxyXG5cdC8vIERpc2FibGUgU3VibWl0IHwgU2hvdyBzcGluIGxvYWRlci5cclxuXHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fc3VibWl0X191aV9lbGVtZW50c19kaXNhYmxlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHQvLyBGaXhJbjogMjAyNi0wMi0wNSAtIHBhc3MgcHJldmlldyBjb250ZXh0IHRvIGJvb2tpbmcgY3JlYXRlIEFqYXguXHJcblx0dmFyIGZvcm1fc3RhdHVzICA9IHdwYmNfX2dldF9mb3JtX3N0YXR1c19mb3Jfc3VibWl0KCByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBwcmV2aWV3X2FyZ3MgPSAoZm9ybV9zdGF0dXMgPT09ICdwcmV2aWV3JykgPyB3cGJjX19nZXRfYmZiX3ByZXZpZXdfYXJnc19mcm9tX2xvY2F0aW9uKCkgOiBudWxsO1xyXG5cdHZhciAkYWRkX2Jvb2tpbmdfbW9kYWwgPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkuY2xvc2VzdCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcclxuXHR2YXIgaXNfYWxsb3dfcGFzdCA9IDA7XHJcblx0dmFyIGhhc19hZGRfYm9va2luZ19tb2RhbF9jb250ZXh0ID0gKCAkYWRkX2Jvb2tpbmdfbW9kYWwubGVuZ3RoICYmICRhZGRfYm9va2luZ19tb2RhbC5pcyggJzp2aXNpYmxlJyApICk7XHJcblxyXG5cdGlmICggaGFzX2FkZF9ib29raW5nX21vZGFsX2NvbnRleHQgKSB7XHJcblx0XHRpc19hbGxvd19wYXN0ID0gJGFkZF9ib29raW5nX21vZGFsLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLWFsbG93LXBhc3RdJyApLmZpcnN0KCkuaXMoICc6Y2hlY2tlZCcgKSA/IDEgOiAwO1xyXG5cdFx0aWYgKCAhIGlzX2FsbG93X3Bhc3QgKSB7XHJcblx0XHRcdGlzX2FsbG93X3Bhc3QgPSAoICcxJyA9PT0gU3RyaW5nKCAkYWRkX2Jvb2tpbmdfbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0JyApIHx8ICcwJyApICkgPyAxIDogMDtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKCAhIGhhc19hZGRfYm9va2luZ19tb2RhbF9jb250ZXh0ICYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyApICkge1xyXG5cdFx0aXNfYWxsb3dfcGFzdCA9ICggJzEnID09PSBTdHJpbmcoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9hbGxvd19wYXN0JyApIHx8ICcwJyApICkgPyAxIDogMDtcclxuXHR9XHJcblxyXG5cdHZhciByZXF1ZXN0X3BhcmFtcyA9IHtcclxuXHRcdCdyZXNvdXJjZV9pZCcgICAgICAgICAgICAgIDogcmVzb3VyY2VfaWQsXHJcblx0XHQnZGF0ZXNfZGRtbXl5X2NzdicgICAgICAgICA6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsdWUsXHJcblx0XHQnZm9ybWRhdGEnICAgICAgICAgICAgICAgICA6IGZvcm1kYXRhLFxyXG5cdFx0J2Jvb2tpbmdfaGFzaCcgICAgICAgICAgICAgOiBteV9ib29raW5nX2hhc2gsXHJcblx0XHQnY3VzdG9tX2Zvcm0nICAgICAgICAgICAgICA6IG15X2Jvb2tpbmdfZm9ybSxcclxuXHRcdCdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJzogKCAoIG51bGwgIT09IF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJyApICkgPyBfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicgKS5qb2luKCAnLCcgKSA6ICcnICksXHJcblx0XHQnY2FwdGNoYV9jaGFsYW5nZScgICAgICAgICA6IGNhcHRjaGFfY2hhbGFuZ2UsXHJcblx0XHQnY2FwdGNoYV91c2VyX2lucHV0JyAgICAgICA6IHVzZXJfY2FwdGNoYSxcclxuXHRcdCdpc19lbWFpbHNfc2VuZCcgICAgICAgICAgIDogaXNfc2VuZF9lbWVpbHMsXHJcblx0XHQnYWN0aXZlX2xvY2FsZScgICAgICAgICAgICA6IHdwZGV2X2FjdGl2ZV9sb2NhbGUsXHJcblx0XHQnZm9ybV9zdGF0dXMnICAgICAgICAgICAgICA6IGZvcm1fc3RhdHVzLFxyXG5cdFx0J2FsbG93X3Bhc3QnICAgICAgICAgICAgICAgOiBpc19hbGxvd19wYXN0XHJcblx0fTtcclxuXHJcblx0dmFyICR0aW1lX292ZXJyaWRlX3BhbmVsID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtcGFuZWxdJyApLmZpcnN0KCk7XHJcblx0aWYgKCAhICR0aW1lX292ZXJyaWRlX3BhbmVsLmxlbmd0aCApIHtcclxuXHRcdCR0aW1lX292ZXJyaWRlX3BhbmVsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uOnZpc2libGUnICkuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1wYW5lbF0nICkuZmlyc3QoKTtcclxuXHR9XHJcblx0aWYgKFxyXG5cdFx0ICAgJHRpbWVfb3ZlcnJpZGVfcGFuZWwubGVuZ3RoXHJcblx0XHQmJiAkdGltZV9vdmVycmlkZV9wYW5lbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLmZpcnN0KCkuaXMoICc6Y2hlY2tlZCcgKVxyXG5cdCkge1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfdGltZV9vdmVycmlkZV9lbmFibGVkJ10gPSAxO1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfdGltZV9vdmVycmlkZV9zb3VyY2UnXSAgPSAkdGltZV9vdmVycmlkZV9wYW5lbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc291cmNlJyApIHx8ICcnO1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfdGltZV9vdmVycmlkZV9zdGFydCddICAgPSAkdGltZV9vdmVycmlkZV9wYW5lbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWZpZWxkPVwic3RhcnRcIl0nICkuZmlyc3QoKS52YWwoKSB8fCAnJztcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX3RpbWVfb3ZlcnJpZGVfZW5kJ10gICAgID0gJHRpbWVfb3ZlcnJpZGVfcGFuZWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cImVuZFwiXScgKS5maXJzdCgpLnZhbCgpIHx8ICcnO1xyXG5cdH1cclxuXHJcblx0dmFyIHNlbGVjdGVkX2RhdGVzX2NvdW50ID0gU3RyaW5nKCByZXF1ZXN0X3BhcmFtc1snZGF0ZXNfZGRtbXl5X2NzdiddIHx8ICcnICkuc3BsaXQoICcsJyApLmZpbHRlciggZnVuY3Rpb24oIGRhdGVfdGV4dCApe1xyXG5cdFx0cmV0dXJuICcnICE9PSBTdHJpbmcoIGRhdGVfdGV4dCB8fCAnJyApLnJlcGxhY2UoIC9eXFxzK3xcXHMrJC9nLCAnJyApO1xyXG5cdH0gKS5sZW5ndGg7XHJcblx0dmFyIGlzX3RpbWVzX2F2YWlsYWJpbGl0eV9vdmVycmlkZSA9IChcclxuXHRcdCAgICggMSA9PT0gcGFyc2VJbnQoIHJlcXVlc3RfcGFyYW1zWyd3cGJjX3RpbWVfb3ZlcnJpZGVfZW5hYmxlZCddIHx8IDAsIDEwICkgKVxyXG5cdFx0JiYgKCAndGltZXNfYXZhaWxhYmlsaXR5JyA9PT0gU3RyaW5nKCByZXF1ZXN0X3BhcmFtc1snd3BiY190aW1lX292ZXJyaWRlX3NvdXJjZSddIHx8ICcnICkgKVxyXG5cdCk7XHJcblx0aWYgKFxyXG5cdFx0ICAgKFxyXG5cdFx0XHQgICBoYXNfYWRkX2Jvb2tpbmdfbW9kYWxfY29udGV4dFxyXG5cdFx0XHQmJiAnMScgPT09IFN0cmluZyggJGFkZF9ib29raW5nX21vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctZm9yY2UtcmVjdXJyZW50LXRpbWUnICkgfHwgJzAnIClcclxuXHRcdCAgIClcclxuXHRcdHx8IChcclxuXHRcdFx0ICAgaXNfdGltZXNfYXZhaWxhYmlsaXR5X292ZXJyaWRlXHJcblx0XHRcdCYmICggc2VsZWN0ZWRfZGF0ZXNfY291bnQgPiAxIClcclxuXHRcdCAgIClcclxuXHQpIHtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWydpc191c2VfYm9va2luZ19yZWN1cnJlbnRfdGltZSddID0gMTtcclxuXHR9XHJcblxyXG5cdC8vIElmIHByZXZpZXcsIHBhc3Mgc2Vzc2lvbiBpZGVudGlmaWVycyBzbyBQSFAgY2FuIGxvYWQgdHJhbnNpZW50IHNuYXBzaG90LlxyXG5cdGlmICggcHJldmlld19hcmdzICYmIHByZXZpZXdfYXJncy50b2tlbiAmJiBwcmV2aWV3X2FyZ3MuZm9ybV9pZCApIHtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX2JmYl9wcmV2aWV3J10gICAgICAgICA9IDE7XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snd3BiY19iZmJfcHJldmlld190b2tlbiddICAgPSBwcmV2aWV3X2FyZ3MudG9rZW47XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snd3BiY19iZmJfcHJldmlld19mb3JtX2lkJ10gPSBwcmV2aWV3X2FyZ3MuZm9ybV9pZDtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX2JmYl9wcmV2aWV3X25vbmNlJ10gICA9IHByZXZpZXdfYXJncy5ub25jZTsgLy8gbm90ZTogVVJMIHBhcmFtIGlzIGBub25jZWAuXHJcblx0fVxyXG5cclxuXHR2YXIgaXNfZXhpdCA9IHdwYmNfYWp4X2Jvb2tpbmdfX2NyZWF0ZSggcmVxdWVzdF9wYXJhbXMgKTtcclxuXHJcblx0aWYgKCB0cnVlID09PSBpc19leGl0ICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxufVxyXG5cclxuXHJcblxyXG4vLyA9PSBIZWxwZXIgRnVuY3Rpb25zID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBQYXJzZSBxdWVyeSBzdHJpbmcgaW50byB7a2V5OnZhbHVlfSAob2xkLWJyb3dzZXIgc2FmZSkuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBxc1xyXG4gKiBAcmV0dXJuIHtPYmplY3R9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX19wYXJzZV9xdWVyeV9zdHJpbmcocXMpIHtcclxuXHR2YXIgb3V0ID0ge307XHJcblx0cXMgICAgICA9IChxcyB8fCAnJyk7XHJcblx0cXMgICAgICA9IHFzLnJlcGxhY2UoIC9eXFw/LywgJycgKTtcclxuXHRpZiAoICEgcXMgKSB7XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0dmFyIHBhcnRzID0gcXMuc3BsaXQoICcmJyApO1xyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0dmFyIGt2ID0gcGFydHNbaV0uc3BsaXQoICc9JyApO1xyXG5cdFx0dmFyIGsgID0gZGVjb2RlVVJJQ29tcG9uZW50KCBrdlswXSB8fCAnJyApO1xyXG5cdFx0aWYgKCAhIGsgKSB7XHJcblx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHYgID0gZGVjb2RlVVJJQ29tcG9uZW50KCBrdi5zbGljZSggMSApLmpvaW4oICc9JyApIHx8ICcnICk7XHJcblx0XHRvdXRba10gPSB2O1xyXG5cdH1cclxuXHRyZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogRGV0ZWN0IHByZXZpZXcgYXJncyBmcm9tIGN1cnJlbnQgVVJMIChpZnJhbWUgVVJMKS5cclxuICpcclxuICogQHJldHVybiB7T2JqZWN0fG51bGx9IHsgdG9rZW4sIGZvcm1faWQsIG5vbmNlIH0gb3IgbnVsbFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19fZ2V0X2JmYl9wcmV2aWV3X2FyZ3NfZnJvbV9sb2NhdGlvbigpIHtcclxuXHR0cnkge1xyXG5cdFx0dmFyIHAgPSB3cGJjX19wYXJzZV9xdWVyeV9zdHJpbmcoICh3aW5kb3cubG9jYXRpb24gJiYgd2luZG93LmxvY2F0aW9uLnNlYXJjaCkgPyB3aW5kb3cubG9jYXRpb24uc2VhcmNoIDogJycgKTtcclxuXHJcblx0XHRpZiAoICEgcC53cGJjX2JmYl9wcmV2aWV3IHx8IChwLndwYmNfYmZiX3ByZXZpZXcgPT09ICcwJykgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBwLndwYmNfYmZiX3ByZXZpZXdfdG9rZW4gfHwgISBwLndwYmNfYmZiX3ByZXZpZXdfZm9ybV9pZCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0dG9rZW4gIDogU3RyaW5nKCBwLndwYmNfYmZiX3ByZXZpZXdfdG9rZW4gKSxcclxuXHRcdFx0Zm9ybV9pZDogcGFyc2VJbnQoIHAud3BiY19iZmJfcHJldmlld19mb3JtX2lkLCAxMCApIHx8IDAsXHJcblx0XHRcdG5vbmNlICA6IChwLm5vbmNlKSA/IFN0cmluZyggcC5ub25jZSApIDogJydcclxuXHRcdH07XHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXNvbHZlIGZvcm0gc3RhdHVzIGZvciBzdWJtaXQuXHJcbiAqXHJcbiAqIFByaW9yaXR5OlxyXG4gKiAxKSBzaG9ydGNvZGUgcGFyYW0gZXhwb3NlZCB2aWEgX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKC4uLiwgJ2Zvcm1fc3RhdHVzJylcclxuICogMikgZGV0ZWN0IHByZXZpZXcgVVJMIGFyZ3NcclxuICogMykgZmFsbGJhY2s6IHB1Ymxpc2hlZFxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWRcclxuICogQHJldHVybiB7c3RyaW5nfSAncHJldmlldyd8J3B1Ymxpc2hlZCdcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfX2dldF9mb3JtX3N0YXR1c19mb3Jfc3VibWl0KHJlc291cmNlX2lkKSB7XHJcblxyXG5cdHZhciBzdGF0dXMgPSAnJztcclxuXHJcblx0dHJ5IHtcclxuXHRcdGlmICggKHR5cGVvZiBfd3BiYyAhPT0gJ3VuZGVmaW5lZCcpICYmIF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSApIHtcclxuXHRcdFx0c3RhdHVzID0gX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2Zvcm1fc3RhdHVzJyApO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKCBlICkge31cclxuXHJcblx0c3RhdHVzID0gKHN0YXR1cyA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCBzdGF0dXMgKTtcclxuXHRzdGF0dXMgPSBzdGF0dXMudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0Ly8gVVJMLWJhc2VkIGRldGVjdGlvbiBmb3IgcHJldmlldyBpZnJhbWUuXHJcblx0dmFyIHByZXZpZXdfYXJncyA9IHdwYmNfX2dldF9iZmJfcHJldmlld19hcmdzX2Zyb21fbG9jYXRpb24oKTtcclxuXHRpZiAoIHByZXZpZXdfYXJncyApIHtcclxuXHRcdHJldHVybiAncHJldmlldyc7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gKHN0YXR1cyA9PT0gJ3ByZXZpZXcnKSA/ICdwcmV2aWV3JyA6ICdwdWJsaXNoZWQnO1xyXG59XHJcblxyXG5cclxuXHJcbi8vID09IEJhY2t3YXJkLWNvbXBhdGlibGUgd3JhcHBlcnMgKGtlZXAgb2xkIGdsb2JhbCBuYW1lcyB3b3JraW5nIDEwMCUgYXMgYmVmb3JlKS4gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5mdW5jdGlvbiBteWJvb2tpbmdfc3VibWl0KCBzdWJtaXRfZm9ybSwgcmVzb3VyY2VfaWQsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKSB7XHJcblx0cmV0dXJuIHdwYmNfYm9va2luZ19mb3JtX3N1Ym1pdCggc3VibWl0X2Zvcm0sIHJlc291cmNlX2lkLCB3cGRldl9hY3RpdmVfbG9jYWxlICk7XHJcbn1cclxuIiwidHJ5IHtcclxuXHR2YXIgZXYgPSAodHlwZW9mIEN1c3RvbUV2ZW50ID09PSAnZnVuY3Rpb24nKSA/IG5ldyBDdXN0b21FdmVudCggJ3dwYmMtcmVhZHknICkgOiBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0V2ZW50JyApO1xyXG5cdGlmICggZXYuaW5pdEV2ZW50ICkge1xyXG5cdFx0ZXYuaW5pdEV2ZW50KCAnd3BiYy1yZWFkeScsIHRydWUsIHRydWUgKTtcclxuXHR9XHJcblx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggZXYgKTtcclxuXHRjb25zb2xlLmxvZyggJ3dwYmMtcmVhZHknICk7XHJcbn0gY2F0Y2ggKCBlICkge1xyXG5cdGNvbnNvbGUuZXJyb3IoIFwiV1BCQyBldmVudCAnd3BiYy1yZWFkeScgZmFpbGVkIVwiLCBlICk7XHJcbn1cclxuIl19

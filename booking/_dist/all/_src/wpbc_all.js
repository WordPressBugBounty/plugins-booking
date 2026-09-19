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

	wpbc_range_selection__prepare_guidance( resource_id );



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
	 * Prepare a collapsed range-selection guidance note for one calendar.
	 * Keeping one reusable node avoids repeated insertion while inactive guidance occupies no layout space.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 * @returns {jQuery} The prepared note, or an empty collection when guidance is unavailable.
	 */
	function wpbc_range_selection__prepare_guidance( resource_id ){

		var is_enabled = _wpbc.calendar__get_param_value( resource_id, 'range_selection_guidance_is_enabled' );
		var $booking_form = jQuery( '#booking_form_div' + resource_id );
		var $calendar_frame;
		var $note = jQuery( '#wpbc_range_selection_guidance' + resource_id );

		if (
			   false === is_enabled
			|| 0 === is_enabled
			|| '0' === is_enabled
			|| 'off' === String( is_enabled ).toLowerCase()
			|| 'false' === String( is_enabled ).toLowerCase()
			|| 'dynamic' !== _wpbc.calendar__get_param_value( resource_id, 'days_select_mode' )
			|| 0 === $booking_form.length
		) {
			$note.remove();
			return jQuery();
		}

		if ( 0 < $note.length ) {
			$note.stop( true, true ).hide().attr( 'aria-hidden', 'true' );
			return $note;
		}

		$calendar_frame = $booking_form.find( '.block_hints.datepick' ).first();
		if ( 0 === $calendar_frame.length ) {
			$calendar_frame = $booking_form.find( '.wpbc_cal_powered_by' ).first();
			if ( 0 === $calendar_frame.length ) {
				$calendar_frame = $booking_form.find( '.bk_calendar_frame' ).first();
				if ( 0 === $calendar_frame.length ) {
					return jQuery();
				}
			}
		}

		$note = jQuery( '<div>', {
			'id': 'wpbc_range_selection_guidance' + resource_id,
			'class': 'wpbc_range_selection_guidance wpbc_front_end__message wpbc_fe_message_info',
			'role': 'status',
			'aria-live': 'polite',
			'aria-hidden': 'true',
			'style': 'display: none;'
		} );
		$note.append( jQuery( '<i>', {
			'class': 'menu_icon icon-1x wpbc_icn_info_outline',
			'aria-hidden': 'true'
		} ) );
		$note.append( jQuery( '<span>' ).text( _wpbc.get_message( 'message_range_selection_click_last_date' ) ) );
		$calendar_frame.after( $note );

		return $note;
	}


	/**
	 * Get the range-guidance animation duration for the current motion preference.
	 *
	 * @returns {number} Animation duration in milliseconds, or zero when reduced motion is preferred.
	 */
	function wpbc_range_selection__get_guidance_animation_duration(){

		if (
			'function' === typeof window.matchMedia
			&& window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
		) {
			return 0;
		}

		return 160;
	}


	/**
	 * Collapse the range-selection guidance so it does not reserve empty layout space.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 */
	function wpbc_range_selection__hide_guidance( resource_id ){

		jQuery( '#wpbc_range_selection_guidance' + resource_id )
			.attr( 'aria-hidden', 'true' )
			.stop( true, true )
			.slideUp( wpbc_range_selection__get_guidance_animation_duration() );
	}


	/**
	 * Show the prepared informational note after the first range click.
	 * The calendar parameter can be set to false by PHP or JavaScript to suppress this UI per resource.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 * @returns {boolean} True when the note was shown.
	 */
	function wpbc_range_selection__show_guidance( resource_id ){

		var $note = wpbc_range_selection__prepare_guidance( resource_id );

		if ( 0 === $note.length ) {
			return false;
		}

		$note
			.stop( true, true )
			.slideDown( wpbc_range_selection__get_guidance_animation_duration() )
			.removeAttr( 'aria-hidden' );
		$note.find( 'span' ).text( _wpbc.get_message( 'message_range_selection_click_last_date' ) );

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

	if (
		url_params.has( 'wpbc_auto_fill' )
		&& ! jQuery( 'body' ).hasClass( 'wp-admin' )
	){

		var wpbc_auto_fill_value = url_params.get( 'wpbc_auto_fill' );

		// Convert back.     Some systems do not like symbol '~' in URL, so  we need to replace to  some other symbols
		wpbc_auto_fill_value = wpbc_auto_fill_value.replaceAll( '_^_', '~' );

		wpbc_auto_fill_booking_fields( wpbc_auto_fill_value );
	}

} );

/**
 * Autofill / select booking form  fields by  values from  the GET request  parameter: ?wpbc_auto_fill=
 *
 * URL-provided field names are resolved through the exact-name DOM API so
 * they can never be interpreted as CSS selector syntax.
 *
 * @param {string} auto_fill_str Serialized field-name and value pairs.
 * @return {void}
 */
function wpbc_auto_fill_booking_fields( auto_fill_str ){																// FixIn: 10.0.0.48.

	if ( '' == auto_fill_str ){
		return;
	}

// console.log( 'WPBC_AUTO_FILL_BOOKING_FIELDS( AUTO_FILL_STR )', auto_fill_str);

	var fields_arr = wpbc_auto_fill_booking_fields__parse( auto_fill_str );

	for ( let i = 0; i < fields_arr.length; i++ ){
		var field_name = String( fields_arr[ i ][ 'name' ] || '' );
		if ( '' === field_name ) {
			continue;
		}

		var field_elements = document.getElementsByName( field_name );
		if ( 0 < field_elements.length ) {
			jQuery( field_elements ).val( fields_arr[ i ][ 'value' ] );
		}
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

					var is_valid_response = (
							(typeof response_data === 'object')
						 && (response_data !== null)
						 && (! Array.isArray( response_data ))
						 && Object.prototype.hasOwnProperty.call( response_data, 'resource_id' )
						 && (typeof response_data[ 'ajx_data' ] === 'object')
						 && (response_data[ 'ajx_data' ] !== null)
						 && (! Array.isArray( response_data[ 'ajx_data' ] ))
						 && Object.prototype.hasOwnProperty.call( response_data[ 'ajx_data' ], 'dates' )
						 && Object.prototype.hasOwnProperty.call( response_data[ 'ajx_data' ], 'resources_id_arr__in_dates' )
						 && Object.prototype.hasOwnProperty.call( response_data[ 'ajx_data' ], 'aggregate_resource_id_arr' )
					);

					if ( ! is_valid_response ) {
						var jq_node = wpbc_get_calendar__jq_node__for_messages( this.data );
						var response_error_message = _wpbc.get_message( 'message_unexpected_server_response' ) || 'The server returned an unexpected response. Please reload the page and try again.';

						wpbc_front_end__log_unexpected_ajax_response( 'WPBC_AJX_CALENDAR_LOAD', response_data, jqXHR, textStatus, 'Invalid response structure' );
						wpbc_calendar__loading__stop( ajx_post_data__resource_id );

						wpbc_front_end__show_message( response_error_message, { 'type'        : 'error',
																							  'show_here'   : {'jq_node': jq_node, 'where': 'after'},
																							  'is_append'   : true,
																							  'style'       : 'text-align:left;',
																							  'content_mode': 'text',
																							  'delay'       : 0
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
			  ).fail( function ( jqXHR, textStatus, errorThrown ) {
					wpbc_front_end__log_unexpected_ajax_response( 'WPBC_AJX_CALENDAR_LOAD', jqXHR.responseText || '', jqXHR, textStatus, errorThrown );

					var ajx_post_data__resource_id = wpbc_get_resource_id__from_ajx_post_data_url( this.data );
					wpbc_balancer__completed( ajx_post_data__resource_id , 'wpbc_calendar__load_data__ajx' );
					wpbc_calendar__loading__stop( ajx_post_data__resource_id );

					var error_message = _wpbc.get_message( 'message_unexpected_server_response' ) || 'The server returned an unexpected response. Please reload the page and try again.';
					if ( jqXHR.status ){
						error_message += ' (' + parseInt( jqXHR.status, 10 ) + ')';
					}
					var message_show_delay = 3000;

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
																									'content_mode': 'text',
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
 * Log an unexpected AJAX response for browser-console diagnostics.
 *
 * The response is intentionally kept out of frontend notices because it can contain a complete HTML error or login page.
 * Logging it here preserves the server payload and request context for support troubleshooting.
 *
 * @param {string}      ajax_action   WordPress AJAX action that produced the unexpected response.
 * @param {*}           response_data Raw response payload returned by the server.
 * @param {jqXHR|null}  jq_xhr        jQuery XHR object, when available.
 * @param {string}      text_status   jQuery request status or success state.
 * @param {string|Error} error_thrown Error description or exception reported by jQuery.
 * @return {void}
 */
function wpbc_front_end__log_unexpected_ajax_response( ajax_action, response_data, jq_xhr, text_status, error_thrown ) {
	if ( ! window.console || 'function' !== typeof window.console.error ) {
		return;
	}

	try {
		var content_type = '';
		if ( jq_xhr && 'function' === typeof jq_xhr.getResponseHeader ) {
			content_type = jq_xhr.getResponseHeader( 'content-type' ) || '';
		}

		window.console.error( '[WPBC][AJAX-UNEXPECTED-RESPONSE] ' + ajax_action, {
			'action'          : ajax_action,
			'http_status'     : jq_xhr && jq_xhr.status ? parseInt( jq_xhr.status, 10 ) : 0,
			'http_status_text': jq_xhr && jq_xhr.statusText ? jq_xhr.statusText : '',
			'text_status'     : text_status || '',
			'error'           : error_thrown || '',
			'content_type'    : content_type,
			'response'        : response_data
		} );
	} catch ( logging_error ) {
		// Console diagnostics must never interrupt frontend error recovery.
	}
}

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
	var classic_booking_context_token = '';
	var admin_booking_nonce = '';
	var has_add_booking_modal_context = ( $add_booking_modal.length && $add_booking_modal.is( ':visible' ) );
	if ( 'undefined' !== typeof _wpbc ) {
		admin_booking_nonce = String( _wpbc.get_other_param( 'this_page_admin_booking_nonce' ) || '' );
	}

	if ( has_add_booking_modal_context ) {
		is_allow_past = $add_booking_modal.find( '[data-wpbc-add-booking-allow-past]' ).first().is( ':checked' ) ? 1 : 0;
		if ( ! is_allow_past ) {
			is_allow_past = ( '1' === String( $add_booking_modal.attr( 'data-wpbc-add-booking-allow-past' ) || '0' ) ) ? 1 : 0;
		}
	}
	if ( ! has_add_booking_modal_context && ( 'undefined' !== typeof _wpbc ) ) {
		is_allow_past = ( '1' === String( _wpbc.get_other_param( 'this_page_allow_past' ) || '0' ) ) ? 1 : 0;
		classic_booking_context_token = String( _wpbc.booking__get_param_value( resource_id, 'classic_booking_context_token' ) || '' );
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
		'allow_past'               : is_allow_past,
		'classic_booking_context_token': classic_booking_context_token,
		'wpbc_admin_booking_nonce'     : admin_booking_nonce
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndwYmNfdXRpbHMuanMiLCJ3cGJjLmpzIiwiZGV2X2xvZy5qcyIsImFqeF9sb2FkX2JhbGFuY2VyLmpzIiwid3BiY19jYWwuanMiLCJkYXlzX3NlbGVjdF9jdXN0b20uanMiLCJ3cGJjX2NhbF9hanguanMiLCJ3cGJjX2ZlX21lc3NhZ2VzLmpzIiwidGltZWxpbmVfcG9wb3Zlci5qcyIsIndwYmNfY2FsX2xvYWRlci5qcyIsImF1dG9maWxsX2ZpZWxkcy5qcyIsImJvb2tpbmdfZm9ybV9zdWJtaXQuanMiLCJ3cGJjX3JlYWR5X2V2ZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9oQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1akZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3BSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNjQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hVQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzF1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJ3cGJjX2FsbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogSmF2YVNjcmlwdCBVdGlsIEZ1bmN0aW9uc1x0XHQuLi9pbmNsdWRlcy9fX2pzL3V0aWxzL3dwYmNfdXRpbHMuanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFRyaW0gIHN0cmluZ3MgYW5kIGFycmF5IGpvaW5lZCB3aXRoICAoLClcclxuICpcclxuICogQHBhcmFtIHN0cmluZ190b190cmltICAgc3RyaW5nIC8gYXJyYXlcclxuICogQHJldHVybnMgc3RyaW5nXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3RyaW0oc3RyaW5nX3RvX3RyaW0pIHtcclxuXHJcblx0aWYgKCBBcnJheS5pc0FycmF5KCBzdHJpbmdfdG9fdHJpbSApICkge1xyXG5cdFx0c3RyaW5nX3RvX3RyaW0gPSBzdHJpbmdfdG9fdHJpbS5qb2luKCAnLCcgKTtcclxuXHR9XHJcblxyXG5cdGlmICggJ3N0cmluZycgPT0gdHlwZW9mIChzdHJpbmdfdG9fdHJpbSkgKSB7XHJcblx0XHRzdHJpbmdfdG9fdHJpbSA9IHN0cmluZ190b190cmltLnRyaW0oKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBzdHJpbmdfdG9fdHJpbTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIGVsZW1lbnQgaW4gYXJyYXlcclxuICpcclxuICogQHBhcmFtIGFycmF5X2hlcmVcdFx0YXJyYXlcclxuICogQHBhcmFtIHBfdmFsXHRcdFx0XHRlbGVtZW50IHRvICBjaGVja1xyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfaW5fYXJyYXkoYXJyYXlfaGVyZSwgcF92YWwpIHtcclxuXHRmb3IgKCB2YXIgaSA9IDAsIGwgPSBhcnJheV9oZXJlLmxlbmd0aDsgaSA8IGw7IGkrKyApIHtcclxuXHRcdGlmICggYXJyYXlfaGVyZVtpXSA9PSBwX3ZhbCApIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFByZXZlbnQgb3BlbmluZyBibGFuayB3aW5kb3dzIG9uIFdvcmRQcmVzcyBwbGF5Z3JvdW5kIGZvciBwc2V1ZG8gbGlua3MgbGlrZSB0aGlzOiA8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCI+IG9yICMgdG8gc3RheSBpbiB0aGUgc2FtZSB0YWIuXHJcbiAqL1xyXG4oZnVuY3Rpb24gKCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0ZnVuY3Rpb24gaXNfcGxheWdyb3VuZF9vcmlnaW4oKSB7XHJcblx0XHRyZXR1cm4gbG9jYXRpb24ub3JpZ2luID09PSAnaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfcHNldWRvX2xpbmsoYSkge1xyXG5cdFx0aWYgKCAhYSB8fCAhYS5nZXRBdHRyaWJ1dGUgKSByZXR1cm4gdHJ1ZTtcclxuXHRcdHZhciBocmVmID0gKGEuZ2V0QXR0cmlidXRlKCAnaHJlZicgKSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQhaHJlZiB8fFxyXG5cdFx0XHRocmVmID09PSAnIycgfHxcclxuXHRcdFx0aHJlZi5pbmRleE9mKCAnIycgKSA9PT0gMCB8fFxyXG5cdFx0XHRocmVmLmluZGV4T2YoICdqYXZhc2NyaXB0OicgKSA9PT0gMCB8fFxyXG5cdFx0XHRocmVmLmluZGV4T2YoICdtYWlsdG86JyApID09PSAwIHx8XHJcblx0XHRcdGhyZWYuaW5kZXhPZiggJ3RlbDonICkgPT09IDBcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmaXhfdGFyZ2V0KGEpIHtcclxuXHRcdGlmICggISBhICkgcmV0dXJuO1xyXG5cdFx0aWYgKCBpc19wc2V1ZG9fbGluayggYSApIHx8IGEuaGFzQXR0cmlidXRlKCAnZGF0YS13cC1uby1ibGFuaycgKSApIHtcclxuXHRcdFx0YS50YXJnZXQgPSAnX3NlbGYnO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdF9maXgoKSB7XHJcblx0XHQvLyBPcHRpb25hbDogY2xlYW4gdXAgY3VycmVudCBET00gKGhhcm1sZXNz4oCUYWZmZWN0cyBvbmx5IHBzZXVkby9kYXRhbWFya2VkIGxpbmtzKS5cclxuXHRcdHZhciBub2RlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdhW2hyZWZdJyApO1xyXG5cdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKysgKSBmaXhfdGFyZ2V0KCBub2Rlc1tpXSApO1xyXG5cclxuXHRcdC8vIExhdGUgYnViYmxlLXBoYXNlIGxpc3RlbmVycyAocnVuIGFmdGVyIFBsYXlncm91bmQncyBoYW5kbGVycylcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBhID0gZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCA/IGUudGFyZ2V0LmNsb3Nlc3QoICdhW2hyZWZdJyApIDogbnVsbDtcclxuXHRcdFx0aWYgKCBhICkgZml4X3RhcmdldCggYSApO1xyXG5cdFx0fSwgZmFsc2UgKTtcclxuXHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnZm9jdXNpbicsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBhID0gZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCA/IGUudGFyZ2V0LmNsb3Nlc3QoICdhW2hyZWZdJyApIDogbnVsbDtcclxuXHRcdFx0aWYgKCBhICkgZml4X3RhcmdldCggYSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2NoZWR1bGVfaW5pdCgpIHtcclxuXHRcdGlmICggIWlzX3BsYXlncm91bmRfb3JpZ2luKCkgKSByZXR1cm47XHJcblx0XHRzZXRUaW1lb3V0KCBpbml0X2ZpeCwgMTAwMCApOyAvLyBlbnN1cmUgd2UgYXR0YWNoIGFmdGVyIFBsYXlncm91bmQncyBzY3JpcHQuXHJcblx0fVxyXG5cclxuXHRpZiAoIGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgc2NoZWR1bGVfaW5pdCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRzY2hlZHVsZV9pbml0KCk7XHJcblx0fVxyXG59KSgpOyIsIlwidXNlIHN0cmljdFwiO1xyXG4vKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL3dwYmMvd3BiYy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogRGVlcCBDbG9uZSBvZiBvYmplY3Qgb3IgYXJyYXlcclxuICpcclxuICogQHBhcmFtIG9ialxyXG4gKiBAcmV0dXJucyB7YW55fVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jbG9uZV9vYmooIG9iaiApe1xyXG5cclxuXHRyZXR1cm4gSlNPTi5wYXJzZSggSlNPTi5zdHJpbmdpZnkoIG9iaiApICk7XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIE1haW4gX3dwYmMgSlMgb2JqZWN0XHJcbiAqL1xyXG5cclxudmFyIF93cGJjID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cdG9iai5zZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfc2VjdXJlWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfc2VjdXJlWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gQ2FsZW5kYXJzIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2NhbGVuZGFycyA9IG9iai5jYWxlbmRhcnNfb2JqID0gb2JqLmNhbGVuZGFyc19vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0ICAgICAgICAgICAgOiBcImJvb2tpbmdfaWRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc29ydF90eXBlICAgICAgIDogXCJERVNDXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHBhZ2VfbnVtICAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHBhZ2VfaXRlbXNfY291bnQ6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBjcmVhdGVfZGF0ZSAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBrZXl3b3JkICAgICAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3VyY2UgICAgICAgICAgOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGNhbGVuZGFyIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdICkgKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ3JlYXRlIENhbGVuZGFyIGluaXRpYWxpemluZ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9faW5pdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2lkJyBdID0gcmVzb3VyY2VfaWQ7XHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAncGVuZGluZ19kYXlzX3NlbGVjdGFibGUnIF0gPSBmYWxzZTtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgIGlmIHRoZSB0eXBlIG9mIHRoaXMgcHJvcGVydHkgIGlzIElOVFxyXG5cdCAqIEBwYXJhbSBwcm9wZXJ0eV9uYW1lXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pc19wcm9wX2ludCA9IGZ1bmN0aW9uICggcHJvcGVydHlfbmFtZSApIHtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4yOS5cclxuXHJcblx0XHR2YXIgcF9jYWxlbmRhcl9pbnRfcHJvcGVydGllcyA9IFsnZHluYW1pY19fZGF5c19taW4nLCAnZHluYW1pY19fZGF5c19tYXgnLCAnZml4ZWRfX2RheXNfbnVtJ107XHJcblxyXG5cdFx0dmFyIGlzX2luY2x1ZGUgPSBwX2NhbGVuZGFyX2ludF9wcm9wZXJ0aWVzLmluY2x1ZGVzKCBwcm9wZXJ0eV9uYW1lICk7XHJcblxyXG5cdFx0cmV0dXJuIGlzX2luY2x1ZGU7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBwYXJhbXMgZm9yIGFsbCAgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJzX29ialx0XHRPYmplY3QgeyBjYWxlbmRhcl8xOiB7fSB9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGNhbGVuZGFyXzM6IHt9LCAuLi4gfVxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcnNfYWxsX19zZXQgPSBmdW5jdGlvbiAoIGNhbGVuZGFyc19vYmogKSB7XHJcblx0XHRwX2NhbGVuZGFycyA9IGNhbGVuZGFyc19vYmo7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGluIGFsbCBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyc19hbGxfX2dldCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2NhbGVuZGFycztcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgY2FsZW5kYXIgb2JqZWN0ICAgOjogICB7IGlkOiAxLCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRcdHsgaWQ6IDIgLOKApiB9XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19nZXRfcGFyYW1ldGVycyA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0aWYgKCBvYmouY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdHJldHVybiBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kIElEIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuICBzeXN0ZW0gc2V0ICBhcyBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgcHJvcGVydGllcyBmcm9tIGNhbGVuZGFyX3Byb3BlcnR5X29iaiBwYXJhbWV0ZXIsICBidXQgb3RoZXIgcHJvcGVydGllcyB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUsIGxpa2UgJ2lkJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJfcHJvcGVydHlfb2JqXHRcdFx0XHRcdCAgeyAgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfSAgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgJ3RydWUnIChkZWZhdWx0OiAnZmFsc2UnKSwgIHRoZW4gIG9ubHkgb3ZlcndyaXRlIG9yIGFkZCAgbmV3IHByb3BlcnRpZXMgaW4gIGNhbGVuZGFyX3Byb3BlcnR5X29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuY2FsZW5kYXJfX3NldCggIFwiIC5pbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsIHsgJ2RhdGVzJzogXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiIH0gKTtcIjtcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgY2FsZW5kYXJfcHJvcGVydHlfb2JqLCBpc19jb21wbGV0ZV9vdmVyd3JpdGUgPSBmYWxzZSAgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgfHwgKHRydWUgPT09IGlzX2NvbXBsZXRlX292ZXJ3cml0ZSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gY2FsZW5kYXJfcHJvcGVydHlfb2JqICl7XHJcblxyXG5cdFx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IGNhbGVuZGFyX3Byb3BlcnR5X29ialsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHByb3BlcnR5ICB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFwiMVwiXHJcblx0ICogQHBhcmFtIHByb3BfbmFtZVx0XHRuYW1lIG9mIHByb3BlcnR5XHJcblx0ICogQHBhcmFtIHByb3BfdmFsdWVcdHZhbHVlIG9mIHByb3BlcnR5XHJcblx0ICogQHJldHVybnMgeyp9XHRcdFx0Y2FsZW5kYXIgb2JqZWN0XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBwcm9wX25hbWUsIHByb3BfdmFsdWUgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gcHJvcF92YWx1ZTtcclxuXHJcblx0XHRyZXR1cm4gcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGNhbGVuZGFyIHByb3BlcnR5IHZhbHVlICAgXHQ6OiAgIG1peGVkIHwgbnVsbFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSAgcmVzb3VyY2VfaWRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHByb3BfbmFtZVx0XHRcdCdzZWxlY3Rpb25fbW9kZSdcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVx0XHRcdFx0XHRtaXhlZCB8IG51bGxcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0Ly8gRml4SW46IDkuOS4wLjI5LlxyXG5cdFx0XHRpZiAoIG9iai5jYWxlbmRhcl9faXNfcHJvcF9pbnQoIHByb3BfbmFtZSApICl7XHJcblx0XHRcdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwYXJzZUludCggcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIG51bGw7XHJcblx0fTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0Ly8gQm9va2luZ3MgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfYm9va2luZ3MgPSBvYmouYm9va2luZ3Nfb2JqID0gb2JqLmJvb2tpbmdzX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY2FsZW5kYXJfMTogT2JqZWN0IHtcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgICBpZDogICAgIDFcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKAplxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGJvb2tpbmdzIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5ncyBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgaWQ6IDEgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFx0eyBpZDogMiAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblxyXG5cdFx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBib29raW5ncyBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kIElEIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuICBzeXN0ZW0gc2V0ICBhcyBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgcHJvcGVydGllcyBmcm9tIGNhbGVuZGFyX29iaiBwYXJhbWV0ZXIsICBidXQgb3RoZXIgcHJvcGVydGllcyB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUsIGxpa2UgJ2lkJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJfb2JqXHRcdFx0XHRcdCAgeyAgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfSAgfVxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCggIFwiIC5pbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsIHsgJ2RhdGVzJzogXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiIH0gKTtcIjtcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgY2FsZW5kYXJfb2JqICl7XHJcblxyXG5cdFx0aWYgKCAhIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSB7fTtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKCB2YXIgcHJvcF9uYW1lIGluIGNhbGVuZGFyX29iaiApe1xyXG5cclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IGNhbGVuZGFyX29ialsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvLyBEYXRlc1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIEFMTCBEYXRlcyBpbiBjYWxlbmRhciAgIDo6ICAgZmFsc2UgfCB7IFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdGZhbHNlIHwgT2JqZWN0IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjRcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwiYXZhaWxhYmxlXCIsIGRheV9hdmFpbGFiaWxpdHk6IDEsIG1heF9jYXBhY2l0eTogMSwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjZcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwiZnVsbF9kYXlfYm9va2luZ1wiLCBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncyddOiBcInBlbmRpbmdcIiwgZGF5X2F2YWlsYWJpbGl0eTogMCwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjlcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwicmVzb3VyY2VfYXZhaWxhYmlsaXR5XCIsIGRheV9hdmFpbGFiaWxpdHk6IDAsIG1heF9jYXBhY2l0eTogMSwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMzBcIjoge+KApn0sIFwiMjAyMy0wNy0zMVwiOiB74oCmfSwg4oCmXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9kYXRlcyA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gZmFsc2U7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGRhdGVzIGluIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIGlmIGNhbGVuZGFyIG9iamVjdCAgbm90IGRlZmluZWQsIHRoZW4gIGl0J3Mgd2lsbCBiZSBkZWZpbmVkIGFuZCAnaWQnLCAnZGF0ZXMnIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuIHN5c3RlbSBhZGQgYSAgbmV3IG9yIG92ZXJ3cml0ZSBvbmx5IGRhdGVzIGZyb20gZGF0ZXNfb2JqIHBhcmFtZXRlcixcclxuXHQgKiBidXQgb3RoZXIgZGF0ZXMgbm90IGZyb20gcGFyYW1ldGVyIGRhdGVzX29iaiB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBkYXRlc19vYmpcdFx0XHRcdFx0ICB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19jb21wbGV0ZV9vdmVyd3JpdGVcdFx0ICBpZiBmYWxzZSwgIHRoZW4gIG9ubHkgb3ZlcndyaXRlIG9yIGFkZCAgZGF0ZXMgZnJvbSBcdGRhdGVzX29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICogICBcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwg4oCmIH0gICk7XHRcdDwtICAgb3ZlcndyaXRlIEFMTCBkYXRlc1xyXG5cdCAqICAgXHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggcmVzb3VyY2VfaWQsIHsgXCIyMDIzLTA3LTIyXCI6IHvigKZ9IH0sICBmYWxzZSAgKTtcdFx0XHRcdFx0PC0gICBhZGQgb3Igb3ZlcndyaXRlIG9ubHkgIFx0XCIyMDIzLTA3LTIyXCI6IHt9XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIFwiIC4gaW50dmFsKCAkcmVzb3VyY2VfaWQgKSAuIFwiLCAgXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiICApOyAgXCI7XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGRhdGVzX29iaiAsIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IHRydWUgKXtcclxuXHJcblx0XHRpZiAoICFvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHRcdFx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXQoIHJlc291cmNlX2lkLCB7ICdkYXRlcyc6IHt9IH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdKSApe1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXSA9IHt9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGlzX2NvbXBsZXRlX292ZXJ3cml0ZSl7XHJcblxyXG5cdFx0XHQvLyBDb21wbGV0ZSBvdmVyd3JpdGUgYWxsICBib29raW5nIGRhdGVzXHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdID0gZGF0ZXNfb2JqO1xyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdC8vIEFkZCBvbmx5ICBuZXcgb3Igb3ZlcndyaXRlIGV4aXN0IGJvb2tpbmcgZGF0ZXMgZnJvbSAgcGFyYW1ldGVyLiBCb29raW5nIGRhdGVzIG5vdCBmcm9tICBwYXJhbWV0ZXIgIHdpbGwgIGJlIHdpdGhvdXQgY2huYW5nZXNcclxuXHRcdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBkYXRlc19vYmogKXtcclxuXHJcblx0XHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWydkYXRlcyddWyBwcm9wX25hbWUgXSA9IGRhdGVzX29ialsgcHJvcF9uYW1lIF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIHNwZWNpZmljIGRhdGUgaW4gY2FsZW5kYXIgICA6OiAgIGZhbHNlIHwgeyBkYXlfYXZhaWxhYmlsaXR5OiAxLCAuLi4gfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzcWxfY2xhc3NfZGF5XHRcdFx0JzIwMjMtMDctMjEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0ZmFsc2UgfCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRheV9hdmFpbGFiaWxpdHk6IDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWF4X2NhcGFjaXR5OiA0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gID49IEJ1c2luZXNzIExhcmdlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDI6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MTA6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cdFx0Ly8gID49IEJ1c2luZXNzIExhcmdlIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMTogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMjogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXVsgc3FsX2NsYXNzX2RheSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBmYWxzZTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gQW55ICBQQVJBTVMgICBpbiBib29raW5nc1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgcHJvcGVydHkgIHRvICBib29raW5nXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHRcIjFcIlxyXG5cdCAqIEBwYXJhbSBwcm9wX25hbWVcdFx0bmFtZSBvZiBwcm9wZXJ0eVxyXG5cdCAqIEBwYXJhbSBwcm9wX3ZhbHVlXHR2YWx1ZSBvZiBwcm9wZXJ0eVxyXG5cdCAqIEByZXR1cm5zIHsqfVx0XHRcdGJvb2tpbmcgb2JqZWN0XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSwgcHJvcF92YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoICEgb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdpZCcgXSA9IHJlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwcm9wX3ZhbHVlO1xyXG5cclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBib29raW5nIHByb3BlcnR5IHZhbHVlICAgXHQ6OiAgIG1peGVkIHwgbnVsbFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSAgcmVzb3VyY2VfaWRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHByb3BfbmFtZVx0XHRcdCdzZWxlY3Rpb25fbW9kZSdcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVx0XHRcdFx0XHRtaXhlZCB8IG51bGxcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBwcm9wX25hbWUgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiAgcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBudWxsO1xyXG5cdH07XHJcblxyXG5cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBib29raW5ncyBmb3IgYWxsICBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcnNfb2JqXHRcdE9iamVjdCB7IGNhbGVuZGFyXzE6IHsgaWQ6IDEsIGRhdGVzOiBPYmplY3QgeyBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwgXCIyMDIzLTA3LTI0XCI6IHvigKZ9LCDigKYgfSB9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGNhbGVuZGFyXzM6IHt9LCAuLi4gfVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcnNfX3NldF9hbGwgPSBmdW5jdGlvbiAoIGNhbGVuZGFyc19vYmogKSB7XHJcblx0XHRwX2Jvb2tpbmdzID0gY2FsZW5kYXJzX29iajtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYm9va2luZ3MgaW4gYWxsIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJzX19nZXRfYWxsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3M7XHJcblx0fTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblxyXG5cclxuXHQvLyBTZWFzb25zIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlYXNvbnMgPSBvYmouc2Vhc29uc19vYmogPSBvYmouc2Vhc29uc19vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNhbGVuZGFyXzE6IE9iamVjdCB7XHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICAgaWQ6ICAgICAxXHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBzZWFzb24gbmFtZXMgZm9yIGRhdGVzIGluIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgIHsgXCIyMDIzLTA3LTIxXCI6IFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdLCBcIjIwMjMtMDctMjJcIjogWy4uLl0sIC4uLiB9XHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGRhdGVzX29ialx0XHRcdFx0XHQgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2NvbXBsZXRlX292ZXJ3cml0ZVx0XHQgIGlmIGZhbHNlLCAgdGhlbiAgb25seSAgYWRkICBkYXRlcyBmcm9tIFx0ZGF0ZXNfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKiAgIFx0XHRcdF93cGJjLnNlYXNvbnNfX3NldCggcmVzb3VyY2VfaWQsIHsgXCIyMDIzLTA3LTIxXCI6IFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdLCBcIjIwMjMtMDctMjJcIjogWy4uLl0sIC4uLiB9ICApO1xyXG5cdCAqL1xyXG5cdG9iai5zZWFzb25zX19zZXQgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGRhdGVzX29iaiAsIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IGZhbHNlICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSkgKXtcclxuXHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSApe1xyXG5cclxuXHRcdFx0Ly8gQ29tcGxldGUgb3ZlcndyaXRlIGFsbCAgc2Vhc29uIGRhdGVzXHJcblx0XHRcdHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0gZGF0ZXNfb2JqO1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHQvLyBBZGQgb25seSAgbmV3IG9yIG92ZXJ3cml0ZSBleGlzdCBib29raW5nIGRhdGVzIGZyb20gIHBhcmFtZXRlci4gQm9va2luZyBkYXRlcyBub3QgZnJvbSAgcGFyYW1ldGVyICB3aWxsICBiZSB3aXRob3V0IGNobmFuZ2VzXHJcblx0XHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gZGF0ZXNfb2JqICl7XHJcblxyXG5cdFx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdKSApe1xyXG5cdFx0XHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gW107XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGZvciAoIHZhciBzZWFzb25fbmFtZV9rZXkgaW4gZGF0ZXNfb2JqWyBwcm9wX25hbWUgXSApe1xyXG5cdFx0XHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdLnB1c2goIGRhdGVzX29ialsgcHJvcF9uYW1lIF1bIHNlYXNvbl9uYW1lX2tleSBdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIHNwZWNpZmljIGRhdGUgaW4gY2FsZW5kYXIgICA6OiAgIFtdIHwgWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheVx0XHRcdCcyMDIzLTA3LTIxJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFtdICB8ICBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXVxyXG5cdCAqL1xyXG5cdG9iai5zZWFzb25zX19nZXRfZm9yX2RhdGUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgc3FsX2NsYXNzX2RheSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBbXTtcdFx0Ly8gSWYgbm90IGRlZmluZWQsIHRoZW4gW107XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIE90aGVyIHBhcmFtZXRlcnMgXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfb3RoZXIgPSBvYmoub3RoZXJfb2JqID0gb2JqLm90aGVyX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9vdGhlclsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXJbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgb3RoZXIgcGFyYW1zXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5nZXRfb3RoZXJfcGFyYW1fX2FsbCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX290aGVyO1xyXG5cdH07XHJcblxyXG5cdC8vIE1lc3NhZ2VzIFx0XHRcdCAgICAgICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfbWVzc2FnZXMgPSBvYmoubWVzc2FnZXNfb2JqID0gb2JqLm1lc3NhZ2VzX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfbWVzc2FnZSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX21lc3NhZ2VzWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X21lc3NhZ2UgPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX21lc3NhZ2VzWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYWxsIG90aGVyIHBhcmFtc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouZ2V0X21lc3NhZ2VzX19hbGwgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9tZXNzYWdlcztcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cclxufSggX3dwYmMgfHwge30sIGpRdWVyeSApKTtcclxuIiwid2luZG93Ll9fV1BCQ19ERVYgPSB0cnVlO1xyXG5cclxuLyoqXHJcbiAqIEV4dGVuZCBfd3BiYyB3aXRoICBuZXcgbWV0aG9kc1xyXG4gKlxyXG4gKiBAdHlwZSB7Knx7fX1cclxuICogQHByaXZhdGVcclxuICovXHJcbl93cGJjID0gKGZ1bmN0aW9uIChvYmosICQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogRGV2IGxvZ2dlciAobm8tb3AgdW5sZXNzIHdpbmRvdy5fX1dQQkNfREVWID0gdHJ1ZSlcclxuXHQgKlxyXG5cdCAqIEB0eXBlIHsqfHt3YXJuOiAoZnVuY3Rpb24oKiwgKiwgKik6IHZvaWQpLCBlcnJvcjogKGZ1bmN0aW9uKCosICosICopOiB2b2lkKSwgb25jZTogb2JqLmRldi5vbmNlLCB0cnk6ICgoZnVuY3Rpb24oKiwgKiwgKik6ICgqfHVuZGVmaW5lZCkpfCopfX1cclxuXHQgKi9cclxuXHRvYmouZGV2ID0gb2JqLmRldiB8fCAoKCkgPT4ge1xyXG5cdFx0Y29uc3Qgc2VlbiAgICA9IG5ldyBTZXQoKTtcclxuXHRcdGNvbnN0IGVuYWJsZWQgPSAoKSA9PiAhIXdpbmRvdy5fX1dQQkNfREVWO1xyXG5cclxuXHRcdGZ1bmN0aW9uIG91dChsZXZlbCwgY29kZSwgbXNnLCBleHRyYSkge1xyXG5cdFx0XHRpZiAoICFlbmFibGVkKCkgKSByZXR1cm47XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0KGNvbnNvbGVbbGV2ZWxdIHx8IGNvbnNvbGUud2FybikoIGBbV1BCQ11bJHtjb2RlfV0gJHttc2d9YCwgZXh0cmEgPz8gJycgKTtcclxuXHRcdFx0fSBjYXRjaCB7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRsb2cgIDogKGNvZGUsIG1zZywgZXh0cmEpID0+IG91dCgnbG9nJywgICBjb2RlLCBtc2csIGV4dHJhKSxcclxuXHRcdFx0ZGVidWc6IChjb2RlLCBtc2csIGV4dHJhKSA9PiBvdXQoJ2RlYnVnJywgY29kZSwgbXNnLCBleHRyYSksXHJcblx0XHRcdHdhcm4gOiAoY29kZSwgbXNnLCBleHRyYSkgPT4gb3V0KCAnd2FybicsIGNvZGUsIG1zZywgZXh0cmEgKSxcclxuXHRcdFx0ZXJyb3I6IChjb2RlLCBlcnJPck1zZywgZXh0cmEpID0+XHJcblx0XHRcdFx0b3V0KCAnZXJyb3InLCBjb2RlLFxyXG5cdFx0XHRcdFx0ZXJyT3JNc2cgaW5zdGFuY2VvZiBFcnJvciA/IGVyck9yTXNnLm1lc3NhZ2UgOiBTdHJpbmcoIGVyck9yTXNnICksXHJcblx0XHRcdFx0XHRlcnJPck1zZyBpbnN0YW5jZW9mIEVycm9yID8gZXJyT3JNc2cgOiBleHRyYSApLFxyXG5cdFx0XHRvbmNlIDogKGNvZGUsIG1zZywgZXh0cmEpID0+IHtcclxuXHRcdFx0XHRpZiAoICFlbmFibGVkKCkgKSByZXR1cm47XHJcblx0XHRcdFx0Y29uc3Qga2V5ID0gYCR7Y29kZX18JHttc2d9YDtcclxuXHRcdFx0XHRpZiAoIHNlZW4uaGFzKCBrZXkgKSApIHJldHVybjtcclxuXHRcdFx0XHRzZWVuLmFkZCgga2V5ICk7XHJcblx0XHRcdFx0b3V0KCAnZXJyb3InLCBjb2RlLCBtc2csIGV4dHJhICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdHRyeSAgOiAoY29kZSwgZm4sIGV4dHJhKSA9PiB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHJldHVybiBmbigpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0b3V0KCAnZXJyb3InLCBjb2RlLCBlLCBleHRyYSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyBPcHRpb25hbDogZ2xvYmFsIHRyYXBzIGluIGRldi5cclxuXHRpZiAoIHdpbmRvdy5fX1dQQkNfREVWICkge1xyXG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdlcnJvcicsIChlKSA9PiB7XHJcblx0XHRcdHRyeSB7IF93cGJjPy5kZXY/LmVycm9yKCAnR0xPQkFMLUVSUk9SJywgZT8uZXJyb3IgfHwgZT8ubWVzc2FnZSwgZSApOyB9IGNhdGNoICggXyApIHt9XHJcblx0XHR9ICk7XHJcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3VuaGFuZGxlZHJlamVjdGlvbicsIChlKSA9PiB7XHJcblx0XHRcdHRyeSB7IF93cGJjPy5kZXY/LmVycm9yKCAnR0xPQkFMLVJFSkVDVElPTicsIGU/LnJlYXNvbiApOyB9IGNhdGNoICggXyApIHt9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cdH0oIF93cGJjIHx8IHt9LCBqUXVlcnkgKSk7XHJcbiIsIi8qKlxyXG4gKiBFeHRlbmQgX3dwYmMgd2l0aCAgbmV3IG1ldGhvZHMgICAgICAgIC8vIEZpeEluOiA5LjguNi4yLlxyXG4gKlxyXG4gKiBAdHlwZSB7Knx7fX1cclxuICogQHByaXZhdGVcclxuICovXHJcbiBfd3BiYyA9IChmdW5jdGlvbiAoIG9iaiwgJCkge1xyXG5cclxuXHQvLyBMb2FkIEJhbGFuY2VyIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0dmFyIHBfYmFsYW5jZXIgPSBvYmouYmFsYW5jZXJfb2JqID0gb2JqLmJhbGFuY2VyX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J21heF90aHJlYWRzJzogMixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaW5fcHJvY2VzcycgOiBbXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2FpdCcgICAgICAgOiBbXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQgLyoqXHJcblx0ICAqIFNldCAgbWF4IHBhcmFsbGVsIHJlcXVlc3QgIHRvICBsb2FkXHJcblx0ICAqXHJcblx0ICAqIEBwYXJhbSBtYXhfdGhyZWFkc1xyXG5cdCAgKi9cclxuXHRvYmouYmFsYW5jZXJfX3NldF9tYXhfdGhyZWFkcyA9IGZ1bmN0aW9uICggbWF4X3RocmVhZHMgKXtcclxuXHJcblx0XHRwX2JhbGFuY2VyWyAnbWF4X3RocmVhZHMnIF0gPSBtYXhfdGhyZWFkcztcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgYmFsYW5jZXIgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmJhbGFuY2VyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfYmFsYW5jZXJbICdiYWxhbmNlcl8nICsgcmVzb3VyY2VfaWQgXSApICk7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBDcmVhdGUgYmFsYW5jZXIgaW5pdGlhbGl6aW5nXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0b2JqLmJhbGFuY2VyX19pbml0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSAsIHBhcmFtcyA9e30pIHtcclxuXHJcblx0XHR2YXIgYmFsYW5jZV9vYmogPSB7fTtcclxuXHRcdGJhbGFuY2Vfb2JqWyAncmVzb3VyY2VfaWQnIF0gICA9IHJlc291cmNlX2lkO1xyXG5cdFx0YmFsYW5jZV9vYmpbICdwcmlvcml0eScgXSAgICAgID0gMTtcclxuXHRcdGJhbGFuY2Vfb2JqWyAnZnVuY3Rpb25fbmFtZScgXSA9IGZ1bmN0aW9uX25hbWU7XHJcblx0XHRiYWxhbmNlX29ialsgJ3BhcmFtcycgXSAgICAgICAgPSB3cGJjX2Nsb25lX29iaiggcGFyYW1zICk7XHJcblxyXG5cclxuXHRcdGlmICggb2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3J1biggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKSApe1xyXG5cdFx0XHRyZXR1cm4gJ3J1bic7XHJcblx0XHR9XHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV93YWl0KCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApICl7XHJcblx0XHRcdHJldHVybiAnd2FpdCc7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdGlmICggb2JqLmJhbGFuY2VyX19jYW5faV9ydW4oKSApe1xyXG5cdFx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fcnVuKCBiYWxhbmNlX29iaiApO1xyXG5cdFx0XHRyZXR1cm4gJ3J1bic7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fd2FpdCggYmFsYW5jZV9vYmogKTtcclxuXHRcdFx0cmV0dXJuICd3YWl0JztcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQgLyoqXHJcblx0ICAqIENhbiBJIFJ1biA/XHJcblx0ICAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAgKi9cclxuXHRvYmouYmFsYW5jZXJfX2Nhbl9pX3J1biA9IGZ1bmN0aW9uICgpe1xyXG5cdFx0cmV0dXJuICggcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0ubGVuZ3RoIDwgcF9iYWxhbmNlclsgJ21heF90aHJlYWRzJyBdICk7XHJcblx0fVxyXG5cclxuXHRcdCAvKipcclxuXHRcdCAgKiBBZGQgdG8gV0FJVFxyXG5cdFx0ICAqIEBwYXJhbSBiYWxhbmNlX29ialxyXG5cdFx0ICAqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3dhaXQgPSBmdW5jdGlvbiAoIGJhbGFuY2Vfb2JqICkge1xyXG5cdFx0XHRwX2JhbGFuY2VyWyd3YWl0J10ucHVzaCggYmFsYW5jZV9vYmogKTtcclxuXHRcdH1cclxuXHJcblx0XHQgLyoqXHJcblx0XHQgICogUmVtb3ZlIGZyb20gV2FpdFxyXG5cdFx0ICAqXHJcblx0XHQgICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgICogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCAgKiBAcmV0dXJucyB7Knxib29sZWFufVxyXG5cdFx0ICAqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fd2FpdF9saXN0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0dmFyIHJlbW92ZWRfZWwgPSBmYWxzZTtcclxuXHJcblx0XHRcdGlmICggcF9iYWxhbmNlclsgJ3dhaXQnIF0ubGVuZ3RoICl7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnd2FpdCcgXSApe1xyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0JiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0cmVtb3ZlZF9lbCA9IHBfYmFsYW5jZXJbICd3YWl0JyBdLnNwbGljZSggaSwgMSApO1xyXG5cdFx0XHRcdFx0XHRyZW1vdmVkX2VsID0gcmVtb3ZlZF9lbC5wb3AoKTtcclxuXHRcdFx0XHRcdFx0cF9iYWxhbmNlclsgJ3dhaXQnIF0gPSBwX2JhbGFuY2VyWyAnd2FpdCcgXS5maWx0ZXIoIGZ1bmN0aW9uICggdiApe1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB2O1xyXG5cdFx0XHRcdFx0XHR9ICk7XHRcdFx0XHRcdC8vIFJlaW5kZXggYXJyYXlcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0KiBJcyBhbHJlYWR5IFdBSVRcclxuXHRcdCpcclxuXHRcdCogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0Ki9cclxuXHRcdG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV93YWl0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0aWYgKCBwX2JhbGFuY2VyWyAnd2FpdCcgXS5sZW5ndGggKXtcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnd2FpdCcgXSApe1xyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0JiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIEFkZCB0byBSVU5cclxuXHRcdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX19ydW4gPSBmdW5jdGlvbiAoIGJhbGFuY2Vfb2JqICkge1xyXG5cdFx0XHRwX2JhbGFuY2VyWydpbl9wcm9jZXNzJ10ucHVzaCggYmFsYW5jZV9vYmogKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCogUmVtb3ZlIGZyb20gUlVOIGxpc3RcclxuXHRcdCpcclxuXHRcdCogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQqIEByZXR1cm5zIHsqfGJvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fcnVuX2xpc3QgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHQgdmFyIHJlbW92ZWRfZWwgPSBmYWxzZTtcclxuXHJcblx0XHRcdCBpZiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCApe1x0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdCBmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXSApe1xyXG5cdFx0XHRcdFx0IGlmIChcclxuXHRcdFx0XHRcdFx0IChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQgJiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0ICl7XHJcblx0XHRcdFx0XHRcdCByZW1vdmVkX2VsID0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0uc3BsaWNlKCBpLCAxICk7XHJcblx0XHRcdFx0XHRcdCByZW1vdmVkX2VsID0gcmVtb3ZlZF9lbC5wb3AoKTtcclxuXHRcdFx0XHRcdFx0IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdID0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0uZmlsdGVyKCBmdW5jdGlvbiAoIHYgKXtcclxuXHRcdFx0XHRcdFx0XHQgcmV0dXJuIHY7XHJcblx0XHRcdFx0XHRcdCB9ICk7XHRcdC8vIFJlaW5kZXggYXJyYXlcclxuXHRcdFx0XHRcdFx0IHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0XHRcdFx0IH1cclxuXHRcdFx0XHQgfVxyXG5cdFx0XHQgfVxyXG5cdFx0XHQgcmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQqIElzIGFscmVhZHkgUlVOXHJcblx0XHQqXHJcblx0XHQqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0KiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCovXHJcblx0XHRvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfcnVuID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0aWYgKCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5sZW5ndGggKXtcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdICl7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHJcblxyXG5cdG9iai5iYWxhbmNlcl9fcnVuX25leHQgPSBmdW5jdGlvbiAoKXtcclxuXHJcblx0XHQvLyBHZXQgMXN0IGZyb20gIFdhaXQgbGlzdFxyXG5cdFx0dmFyIHJlbW92ZWRfZWwgPSBmYWxzZTtcclxuXHRcdGlmICggcF9iYWxhbmNlclsgJ3dhaXQnIF0ubGVuZ3RoICl7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ3dhaXQnIF0gKXtcclxuXHRcdFx0XHRyZW1vdmVkX2VsID0gb2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fd2FpdF9saXN0KCBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0sIHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdICk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGZhbHNlICE9PSByZW1vdmVkX2VsICl7XHJcblxyXG5cdFx0XHQvLyBSdW5cclxuXHRcdFx0b2JqLmJhbGFuY2VyX19ydW4oIHJlbW92ZWRfZWwgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdCAvKipcclxuXHQgICogUnVuXHJcblx0ICAqIEBwYXJhbSBiYWxhbmNlX29ialxyXG5cdCAgKi9cclxuXHRvYmouYmFsYW5jZXJfX3J1biA9IGZ1bmN0aW9uICggYmFsYW5jZV9vYmogKXtcclxuXHJcblx0XHRzd2l0Y2ggKCBiYWxhbmNlX29ialsgJ2Z1bmN0aW9uX25hbWUnIF0gKXtcclxuXHJcblx0XHRcdGNhc2UgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JzpcclxuXHJcblx0XHRcdFx0Ly8gQWRkIHRvIHJ1biBsaXN0XHJcblx0XHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biggYmFsYW5jZV9vYmogKTtcclxuXHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIGJhbGFuY2Vfb2JqWyAncGFyYW1zJyBdIClcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cclxufSggX3dwYmMgfHwge30sIGpRdWVyeSApKTtcclxuXHJcblxyXG4gXHQvKipcclxuIFx0ICogLS0gSGVscCBmdW5jdGlvbnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JhbGFuY2VyX19pc193YWl0KCBwYXJhbXMsIGZ1bmN0aW9uX25hbWUgKXtcclxuLy9jb25zb2xlLmxvZygnOjp3cGJjX2JhbGFuY2VyX19pc193YWl0JyxwYXJhbXMgLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdKSApe1xyXG5cclxuXHRcdFx0dmFyIGJhbGFuY2VyX3N0YXR1cyA9IF93cGJjLmJhbGFuY2VyX19pbml0KCBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSwgZnVuY3Rpb25fbmFtZSwgcGFyYW1zICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gKCAnd2FpdCcgPT09IGJhbGFuY2VyX3N0YXR1cyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQoIHJlc291cmNlX2lkICwgZnVuY3Rpb25fbmFtZSApe1xyXG4vL2NvbnNvbGUubG9nKCc6OndwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCcscmVzb3VyY2VfaWQgLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRfd3BiYy5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3J1bl9saXN0KCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApO1xyXG5cdFx0X3dwYmMuYmFsYW5jZXJfX3J1bl9uZXh0KCk7XHJcblx0fSIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsL3dwYmNfY2FsLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBPcmRlciBvciBjaGlsZCBib29raW5nIHJlc291cmNlcyBzYXZlZCBoZXJlOiAgXHRfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLFxyXG4gKiAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnIClcdFx0WzIsMTAsMTIsMTFdXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEhvdyB0byBjaGVjayAgYm9va2VkIHRpbWVzIG9uICBzcGVjaWZpYyBkYXRlOiA/XHJcbiAqXHJcblx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpO1xyXG5cclxuXHRcdFx0Y29uc29sZS5sb2coXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHMsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzExXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcyxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzXHJcblx0XHRcdFx0XHQpO1xyXG4gKiAgT1JcclxuXHRcdFx0Y29uc29sZS5sb2coXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTBdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTFdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZVxyXG5cdFx0XHRcdFx0KTtcclxuICpcclxuICovXHJcblxyXG4vKipcclxuICogRGF5cyBzZWxlY3Rpb246XHJcbiAqIFx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICk7XHJcbiAqXHJcbiAqXHRcdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IDE7XHJcbiAqIFx0RXhhbXBsZSAxOlx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgJzIwMjQtMDUtMTUnLFxyXG4gKiAnMjAyNC0wNS0yNScgKTsgRXhhbXBsZSAyOlx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCxcclxuICogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjUnXSApO1xyXG4gKlxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogQyBBIEwgRSBOIEQgQSBSICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqICBTaG93IFdQQkMgQ2FsZW5kYXJcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdFx0LSByZXNvdXJjZSBJRFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfc2hvdyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gSWYgbm8gY2FsZW5kYXIgSFRNTCB0YWcsICB0aGVuICBleGl0XHJcblx0aWYgKCAwID09PSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmxlbmd0aCApeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcblx0Ly8gSWYgdGhlIGNhbGVuZGFyIHdpdGggdGhlIHNhbWUgQm9va2luZyByZXNvdXJjZSBpcyBhY3RpdmF0ZWQgYWxyZWFkeSwgdGhlbiBleGl0LiBCdXQgaW4gRWxlbWVudG9yIHRoZSBjbGFzcyBjYW4gYmUgc3RhbGUsIHNvIHZlcmlmeSBpbnN0YW5jZS5cclxuXHRpZiAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKSApIHtcclxuXHJcblx0XHR2YXIgZXhpc3RpbmdfaW5zdCA9IG51bGw7XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0ZXhpc3RpbmdfaW5zdCA9IGpRdWVyeS5kYXRlcGljay5fZ2V0SW5zdCggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5nZXQoIDAgKSApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdGV4aXN0aW5nX2luc3QgPSBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggZXhpc3RpbmdfaW5zdCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFN0YWxlIG1hcmtlcjogcmVtb3ZlIGFuZCBjb250aW51ZSB3aXRoIGluaXQuXHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnaGFzRGF0ZXBpY2snICk7XHJcblx0fVxyXG5cclxuXHR3cGJjX3JhbmdlX3NlbGVjdGlvbl9fcHJlcGFyZV9ndWlkYW5jZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERheXMgc2VsZWN0aW9uXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCA9IGZhbHNlO1xyXG5cdHZhciBsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtICAgPSAzNjU7XHRcdFx0XHRcdC8vIG11bHRpcGxlIHwgZml4ZWRcclxuXHRpZiAoICdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0ID0gdHJ1ZTtcclxuXHRcdGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gPSAwO1xyXG5cdH1cclxuXHRpZiAoICdzaW5nbGUnICA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtID0gMDtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTWluIC0gTWF4IGRheXMgdG8gc2Nyb2xsL3Nob3dcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBsb2NhbF9fbWluX2RhdGUgPSAwO1xyXG4gXHRsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAwIF0sIChwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDIgXSwgMCwgMCwgMCApO1x0XHRcdC8vIEZpeEluOiA5LjkuMC4xNy5cclxuLy9jb25zb2xlLmxvZyggbG9jYWxfX21pbl9kYXRlICk7XHJcblx0dmFyIGxvY2FsX19tYXhfZGF0ZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhcicgKTtcclxuXHQvL2xvY2FsX19tYXhfZGF0ZSA9IG5ldyBEYXRlKDIwMjQsIDUsIDI4KTsgIEl0IGlzIGhlcmUgaXNzdWUgb2Ygbm90IHNlbGVjdGFibGUgZGF0ZXMsIGJ1dCBzb21lIGRhdGVzIHNob3dpbmcgaW4gY2FsZW5kYXIgYXMgYXZhaWxhYmxlLCBidXQgd2UgY2FuIG5vdCBzZWxlY3QgaXQuXHJcblxyXG5cdC8vLy8gRGVmaW5lIGxhc3QgZGF5IGluIGNhbGVuZGFyIChhcyBhIGxhc3QgZGF5IG9mIG1vbnRoIChhbmQgbm90IGRhdGUsIHdoaWNoIGlzIHJlbGF0ZWQgdG8gYWN0dWFsICdUb2RheScgZGF0ZSkuXHJcblx0Ly8vLyBFLmcuIGlmIHRvZGF5IGlzIDIwMjMtMDktMjUsIGFuZCB3ZSBzZXQgJ051bWJlciBvZiBtb250aHMgdG8gc2Nyb2xsJyBhcyA1IG1vbnRocywgdGhlbiBsYXN0IGRheSB3aWxsIGJlIDIwMjQtMDItMjkgYW5kIG5vdCB0aGUgMjAyNC0wMi0yNS5cclxuXHQvLyB2YXIgY2FsX2xhc3RfZGF5X2luX21vbnRoID0galF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBudWxsLCBsb2NhbF9fbWF4X2RhdGUsIG5ldyBEYXRlKCkgKTtcclxuXHQvLyBjYWxfbGFzdF9kYXlfaW5fbW9udGggPSBuZXcgRGF0ZSggY2FsX2xhc3RfZGF5X2luX21vbnRoLmdldEZ1bGxZZWFyKCksIGNhbF9sYXN0X2RheV9pbl9tb250aC5nZXRNb250aCgpICsgMSwgMCApO1xyXG5cdC8vIGxvY2FsX19tYXhfZGF0ZSA9IGNhbF9sYXN0X2RheV9pbl9tb250aDtcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjI2LlxyXG5cclxuXHQvLyBHZXQgc3RhcnQgLyBlbmQgZGF0ZXMgZnJvbSAgdGhlIEJvb2tpbmcgQ2FsZW5kYXIgc2hvcnRjb2RlLiBFeGFtcGxlOiBbYm9va2luZyBjYWxlbmRhcl9kYXRlc19zdGFydD0nMjAyNi0wMS0wMScgY2FsZW5kYXJfZGF0ZXNfZW5kPScyMDI2LTEyLTMxJyAgcmVzb3VyY2VfaWQ9MV0gLy8gRml4SW46IDEwLjEzLjEuNC5cclxuXHRpZiAoIGZhbHNlICE9PSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHJlc291cmNlX2lkICkgKSB7XHJcblx0XHRsb2NhbF9fbWluX2RhdGUgPSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHJlc291cmNlX2lkICk7ICAvLyBFLmcuIC0gbG9jYWxfX21pbl9kYXRlID0gbmV3IERhdGUoIDIwMjUsIDAsIDEgKTtcclxuXHR9XHJcblx0aWYgKCBmYWxzZSAhPT0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcmVzb3VyY2VfaWQgKSApIHtcclxuXHRcdGxvY2FsX19tYXhfZGF0ZSA9IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19lbmQoIHJlc291cmNlX2lkICk7ICAgIC8vIEUuZy4gLSBsb2NhbF9fbWF4X2RhdGUgPSBuZXcgRGF0ZSggMjAyNSwgMTEsIDMxICk7XHJcblx0fVxyXG5cclxuXHQvLyBJbiBjYXNlIHdlIGVkaXQgYm9va2luZyBpbiBwYXN0IG9yIGhhdmUgc3BlY2lmaWMgcGFyYW1ldGVyIGluIFVSTC5cclxuXHR2YXIgd3BiY19lZGl0X2Jvb2tpbmdfaGFzaCA9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9ib29raW5nX2hhc2gnICk7XHJcblx0dmFyIHdwYmNfaXNfZWRpdF9ib29raW5nX2NvbnRleHQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd3BiY19lZGl0X2Jvb2tpbmdfaGFzaCApICYmICggJycgIT09IHdwYmNfZWRpdF9ib29raW5nX2hhc2ggKTtcclxuXHR2YXIgd3BiY19hbGxvd19wYXN0X2NvbnRleHQgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYWxsb3dfcGFzdCcgKTtcclxuXHR2YXIgd3BiY19pc19hbGxvd19wYXN0X2NvbnRleHQgPSAoICcxJyA9PT0gU3RyaW5nKCB3cGJjX2FsbG93X3Bhc3RfY29udGV4dCApICkgfHwgKCAxID09PSB3cGJjX2FsbG93X3Bhc3RfY29udGV4dCApIHx8ICggdHJ1ZSA9PT0gd3BiY19hbGxvd19wYXN0X2NvbnRleHQgKTtcclxuXHR2YXIgd3BiY19hbGxvd19wYXN0X2RhdGVfYXJyID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2FsbG93X3Bhc3RfYXJyJyApO1xyXG5cdHZhciB3cGJjX2lzX2FkZF9ib29raW5nX2FkbWluX3BhZ2UgPSAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYycgKSAhPSAtMSApICYmICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAndGFiPWFkZC1ib29raW5nJyApICE9IC0xICk7XHJcblx0aWYgKCAgICggd3BiY19pc19hZGRfYm9va2luZ19hZG1pbl9wYWdlIHx8IHdwYmNfaXNfZWRpdF9ib29raW5nX2NvbnRleHQgfHwgd3BiY19pc19hbGxvd19wYXN0X2NvbnRleHQgKVxyXG5cdFx0JiYgKFxyXG5cdFx0XHQgIHdwYmNfaXNfZWRpdF9ib29raW5nX2NvbnRleHRcclxuXHRcdCAgIHx8IHdwYmNfaXNfYWxsb3dfcGFzdF9jb250ZXh0XHJcblx0XHQgICB8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZignYm9va2luZ19oYXNoJykgIT0gLTEgKSAgICAgICAgICAgICAgICAgIC8vIENvbW1lbnQgdGhpcyBsaW5lIGZvciBhYmlsaXR5IHRvIGFkZCAgYm9va2luZyBpbiBwYXN0IGRheXMgYXQgIEJvb2tpbmcgPiBBZGQgYm9va2luZyBwYWdlLlxyXG5cdFx0ICAgfHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoJ2FsbG93X3Bhc3QnKSAhPSAtMSApICAgICAgICAgICAgICAgIC8vIEZpeEluOiAxMC43LjEuMi5cclxuXHRcdClcclxuXHQpe1xyXG5cdFx0Ly8gbG9jYWxfX21pbl9kYXRlID0gbnVsbDtcclxuXHRcdC8vIEZpeEluOiAxMC4xNC4xLjQuXHJcblx0XHR2YXIgd3BiY19taW5fZGF0ZV9hcnIgPSAoIHdwYmNfaXNfYWxsb3dfcGFzdF9jb250ZXh0ICYmIHdwYmNfYWxsb3dfcGFzdF9kYXRlX2FyciAmJiAoIDUgPD0gd3BiY19hbGxvd19wYXN0X2RhdGVfYXJyLmxlbmd0aCApICkgPyB3cGJjX2FsbG93X3Bhc3RfZGF0ZV9hcnIgOiBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKTtcclxuXHRcdGxvY2FsX19taW5fZGF0ZSAgPSBuZXcgRGF0ZSggd3BiY19taW5fZGF0ZV9hcnJbMF0sICggcGFyc2VJbnQoIHdwYmNfbWluX2RhdGVfYXJyWzFdICkgLSAxKSwgd3BiY19taW5fZGF0ZV9hcnJbMl0sIHdwYmNfbWluX2RhdGVfYXJyWzNdLCB3cGJjX21pbl9kYXRlX2Fycls0XSwgMCApO1xyXG5cdFx0bG9jYWxfX21heF9kYXRlID0gbnVsbDtcclxuXHR9XHJcblxyXG5cdHZhciBsb2NhbF9fc3RhcnRfd2Vla2RheSAgICA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19zdGFydF9kYXlfd2VlZWsnICk7XHJcblx0dmFyIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID0gcGFyc2VJbnQoIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycgKSApO1xyXG5cclxuXHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnRleHQoICcnICk7XHRcdFx0XHRcdC8vIFJlbW92ZSBhbGwgSFRNTCBpbiBjYWxlbmRhciB0YWdcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNob3cgY2FsZW5kYXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSgnI2NhbGVuZGFyX2Jvb2tpbmcnKyByZXNvdXJjZV9pZCkuZGF0ZXBpY2soXHJcblx0XHRcdHtcclxuXHRcdFx0XHRiZWZvcmVTaG93RGF5OiBmdW5jdGlvbiAoIGpzX2RhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cygganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvblNlbGVjdDogZnVuY3Rpb24gKCBzdHJpbmdfZGF0ZXMsIGpzX2RhdGVzX2FyciApeyAgLyoqXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKlx0c3RyaW5nX2RhdGVzICAgPSAgICcyMy4wOC4yMDIzIC0gMjYuMDguMjAyMydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqICAgfCAgICAnMjMuMDguMjAyMyAtIDIzLjA4LjIwMjMnICAgIHxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqICcxOS4wOS4yMDIzLCAyNC4wOC4yMDIzLCAzMC4wOS4yMDIzJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICoganNfZGF0ZXNfYXJyICAgPSAgIHJhbmdlOiBbIERhdGUgKEF1ZyAyMyAyMDIzKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqIERhdGUgKEF1ZyAyNSAyMDIzKV0gICAgIHwgICAgIG11bHRpcGxlOiBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKiBEYXRlKE9jdCAyNCAyMDIzKSwgRGF0ZShPY3QgMjAgMjAyMyksIERhdGUoT2N0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKiAxNiAyMDIzKSBdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9zZWxlY3RfZGF5cyggc3RyaW5nX2RhdGVzLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uSG92ZXI6IGZ1bmN0aW9uICggc3RyaW5nX2RhdGUsIGpzX2RhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9ob3Zlcl9kYXlzKCBzdHJpbmdfZGF0ZSwganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvbkNoYW5nZU1vbnRoWWVhcjogZnVuY3Rpb24gKCB5ZWFyLCByZWFsX21vbnRoLCBqc19kYXRlX18xc3RfZGF5X2luX21vbnRoICl7IH0sXHJcblx0XHRcdFx0c2hvd09uICAgICAgICA6ICdib3RoJyxcclxuXHRcdFx0XHRudW1iZXJPZk1vbnRoczogbG9jYWxfX251bWJlcl9vZl9tb250aHMsXHJcblx0XHRcdFx0c3RlcE1vbnRocyAgICA6IDEsXHJcblx0XHRcdFx0Ly8gcHJldlRleHQgICAgICA6ICcmbGFxdW87JyxcclxuXHRcdFx0XHQvLyBuZXh0VGV4dCAgICAgIDogJyZyYXF1bzsnLFxyXG5cdFx0XHRcdHByZXZUZXh0ICAgICAgOiAnJmxzYXF1bzsnLFxyXG5cdFx0XHRcdG5leHRUZXh0ICAgICAgOiAnJnJzYXF1bzsnLFxyXG5cdFx0XHRcdGRhdGVGb3JtYXQgICAgOiAnZGQubW0ueXknLFxyXG5cdFx0XHRcdGNoYW5nZU1vbnRoICAgOiBmYWxzZSxcclxuXHRcdFx0XHRjaGFuZ2VZZWFyICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bWluRGF0ZSAgICAgICA6IGxvY2FsX19taW5fZGF0ZSxcclxuXHRcdFx0XHRtYXhEYXRlICAgICAgIDogbG9jYWxfX21heF9kYXRlLCBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzFZJyxcclxuXHRcdFx0XHQvLyBtaW5EYXRlOiBuZXcgRGF0ZSgyMDIwLCAyLCAxKSwgbWF4RGF0ZTogbmV3IERhdGUoMjAyMCwgOSwgMzEpLCAgICAgICAgICAgICBcdC8vIEFiaWxpdHkgdG8gc2V0IGFueSAgc3RhcnQgYW5kIGVuZCBkYXRlIGluIGNhbGVuZGFyXHJcblx0XHRcdFx0c2hvd1N0YXR1cyAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bXVsdGlTZXBhcmF0b3IgIDogJywgJyxcclxuXHRcdFx0XHRjbG9zZUF0VG9wICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRmaXJzdERheSAgICAgICAgOiBsb2NhbF9fc3RhcnRfd2Vla2RheSxcclxuXHRcdFx0XHRnb3RvQ3VycmVudCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRoaWRlSWZOb1ByZXZOZXh0OiB0cnVlLFxyXG5cdFx0XHRcdG11bHRpU2VsZWN0ICAgICA6IGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0sXHJcblx0XHRcdFx0cmFuZ2VTZWxlY3QgICAgIDogbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCxcclxuXHRcdFx0XHQvLyBzaG93V2Vla3M6IHRydWUsXHJcblx0XHRcdFx0dXNlVGhlbWVSb2xsZXI6IGZhbHNlXHJcblx0XHRcdH1cclxuXHQpO1xyXG5cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ2xlYXIgdG9kYXkgZGF0ZSBoaWdobGlnaHRpbmdcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpeyAgd3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCByZXNvdXJjZV9pZCApOyAgfSwgNTAwICk7ICAgICAgICAgICAgICAgICAgICBcdC8vIEZpeEluOiA3LjEuMi44LlxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNjcm9sbCBjYWxlbmRhciB0byAgc3BlY2lmaWMgbW9udGhcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBzdGFydF9ia19tb250aCA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfc2Nyb2xsX3RvJyApO1xyXG5cdGlmICggZmFsc2UgIT09IHN0YXJ0X2JrX21vbnRoICl7XHJcblx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBzdGFydF9ia19tb250aFsgMCBdLCBzdGFydF9ia19tb250aFsgMSBdICk7XHJcblx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5nIHN0YXR1c2VzIGFzIGFycmF5IGZyb20gdGhlIHN0cnVjdHVyZWQgc3VtbWFyeSBmaWVsZCwgd2l0aCBmYWxsYmFjayB0byB0aGUgbGVnYWN5IHN0cmluZyBmaWVsZC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlX2Jvb2tpbmdzX29ialxyXG5cdCAqIEByZXR1cm5zIHtbXX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9ib29raW5nX3N0YXR1c2VzX19hc19hcnIoIGRhdGVfYm9va2luZ3Nfb2JqICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoICEgZGF0ZV9ib29raW5nc19vYmogKVxyXG5cdFx0XHR8fCAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXSkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggQXJyYXkuaXNBcnJheSggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0gKSApe1xyXG5cdFx0XHRyZXR1cm4gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0uZmlsdGVyKCBmdW5jdGlvbiAoIGJvb2tpbmdfc3RhdHVzICl7XHJcblx0XHRcdFx0cmV0dXJuICcnICE9PSBib29raW5nX3N0YXR1cztcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdICl7XHJcblx0XHRcdHJldHVybiBbXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5ncycgXS50b1N0cmluZygpLnRyaW0oKS5zcGxpdCggL1xccysvICkuZmlsdGVyKCBmdW5jdGlvbiAoIGJvb2tpbmdfc3RhdHVzICl7XHJcblx0XHRcdHJldHVybiAnJyAhPT0gYm9va2luZ19zdGF0dXM7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgZXhhY3QgYm9va2luZyBzdGF0dXMgaW4gc3RhdHVzZXMgYXJyYXkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1tdfSBib29raW5nX3N0YXR1c2VzX2FyclxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX3N0YXR1c1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgYm9va2luZ19zdGF0dXMgKXtcclxuXHRcdHJldHVybiBib29raW5nX3N0YXR1c2VzX2Fyci5pbmRleE9mKCBib29raW5nX3N0YXR1cyApID4gLTE7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgYm9va2luZyBzdGF0dXMgcGFydCwgZS5nLiBcInBlbmRpbmdcIiBpbiBcImFwcHJvdmVkX3BlbmRpbmdcIi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7W119IGJvb2tpbmdfc3RhdHVzZXNfYXJyXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfc3RhdHVzX3BhcnRcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhc19wYXJ0KCBib29raW5nX3N0YXR1c2VzX2FyciwgYm9va2luZ19zdGF0dXNfcGFydCApe1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGJvb2tpbmdfc3RhdHVzZXNfYXJyLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdGlmICggYm9va2luZ19zdGF0dXNlc19hcnJbIGkgXS5zcGxpdCggJ18nICkuaW5kZXhPZiggYm9va2luZ19zdGF0dXNfcGFydCApID4gLTEgKXtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBDU1MgdG8gY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwXHJcblx0ICogICAgIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMgeygqfHN0cmluZylbXXwoYm9vbGVhbnxzdHJpbmcpW119XHRcdC0gWyB7dHJ1ZSAtYXZhaWxhYmxlIHwgZmFsc2UgLSB1bmF2YWlsYWJsZX0sICdDU1MgY2xhc3NlcyBmb3JcclxuXHQgKiAgICAgY2FsZW5kYXIgZGF5IGNlbGwnIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgdG9kYXlfZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDAgXSwgKHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDEgXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHRcdFx0XHRcdFx0XHRcdC8vIFRvZGF5IEpTX0RhdGVfT2JqLlxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7IFx0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBHZXQgU2VsZWN0ZWQgZGF0ZXMgaW4gY2FsZW5kYXJcclxuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19zcWwgPSB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gR2V0IERhdGEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBkYXRlX2Jvb2tpbmdzX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHRcdC8vIEFycmF5IHdpdGggQ1NTIGNsYXNzZXMgZm9yIGRhdGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlID0gW107XHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NxbF9kYXRlXycgICAgICsgc3FsX2NsYXNzX2RheSApO1x0XHRcdFx0Ly8gICdzcWxfZGF0ZV8yMDIzLTA3LTIxJ1xyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjYWw0ZGF0ZS0nICAgICArIGNsYXNzX2RheSApO1x0XHRcdFx0XHQvLyAgJ2NhbDRkYXRlLTctMjEtMjAyMydcclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnd3BiY193ZWVrZGF5XycgKyBkYXRlLmdldERheSgpICk7XHRcdFx0XHQvLyAgJ3dwYmNfd2Vla2RheV80J1xyXG5cclxuXHRcdC8vIERlZmluZSBTZWxlY3RlZCBDaGVjayBJbi9PdXQgZGF0ZXMgaW4gVEQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoXHJcblx0XHRcdFx0KCBzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoICApXHJcblx0XHRcdC8vJiYgICggc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gIT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdIClcclxuXHRcdCl7XHJcblx0XHRcdGlmICggc3FsX2NsYXNzX2RheSA9PT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gKXtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX2luJyApO1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfaW5fb3V0JyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggICggc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCA+IDEgKSAmJiAoIHNxbF9jbGFzc19kYXkgPT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdICkgKSB7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19vdXQnICk7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19pbl9vdXQnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0dmFyIGlzX2RheV9zZWxlY3RhYmxlID0gZmFsc2U7XHJcblxyXG5cdFx0Ly8gSWYgc29tZXRoaW5nIG5vdCBkZWZpbmVkLCAgdGhlbiAgdGhpcyBkYXRlIGNsb3NlZCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy8gRml4SW46IDEwLjEyLjQuNi5cclxuXHRcdGlmICggKGZhbHNlID09PSBkYXRlX2Jvb2tpbmdzX29iaikgfHwgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgKGRhdGVfYm9va2luZ3Nfb2JqW3Jlc291cmNlX2lkXSkpICkge1xyXG5cclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gWyBpc19kYXlfc2VsZWN0YWJsZSwgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlLmpvaW4oJyAnKSAgXTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICAgZGF0ZV9ib29raW5nc19vYmogIC0gRGVmaW5lZC4gICAgICAgICAgICBEYXRlcyBjYW4gYmUgc2VsZWN0YWJsZS5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgYm9va2luZ19zdGF0dXNlc19hcnIgPSB3cGJjX2dldF9ib29raW5nX3N0YXR1c2VzX19hc19hcnIoIGRhdGVfYm9va2luZ3Nfb2JqICk7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEFkZCBzZWFzb24gbmFtZXMgdG8gdGhlIGRheSBDU1MgY2xhc3NlcyAtLSBpdCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCAgd29yayAgb2YgY29uZGl0aW9uYWwgZmllbGRzIC0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgc2Vhc29uX25hbWVzX2FyciA9IF93cGJjLnNlYXNvbnNfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgc2Vhc29uX2tleSBpbiBzZWFzb25fbmFtZXNfYXJyICl7XHJcblxyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggc2Vhc29uX25hbWVzX2Fyclsgc2Vhc29uX2tleSBdICk7XHRcdFx0XHQvLyAgJ3dwZGV2Ymtfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJ1xyXG5cdFx0fVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdFx0Ly8gQ29zdCBSYXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAncmF0ZV8nICsgZGF0ZV9ib29raW5nc19vYmpbIHJlc291cmNlX2lkIF1bICdkYXRlX2Nvc3RfcmF0ZScgXS50b1N0cmluZygpLnJlcGxhY2UoIC9bXFwuXFxzXS9nLCAnXycgKSApO1x0XHRcdFx0XHRcdC8vICAncmF0ZV85OV8wMCcgLT4gOTkuMDBcclxuXHJcblxyXG5cdFx0aWYgKCBwYXJzZUludCggZGF0ZV9ib29raW5nc19vYmpbICdkYXlfYXZhaWxhYmlsaXR5JyBdICkgPiAwICl7XHJcblx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gdHJ1ZTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX2F2YWlsYWJsZScgKTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdyZXNlcnZlZF9kYXlzX2NvdW50JyArIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ21heF9jYXBhY2l0eScgXSAtIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IGZhbHNlO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0c3dpdGNoICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHRjYXNlICdhdmFpbGFibGUnOlxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAndGltZV9zbG90c19ib29raW5nJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ3RpbWVzX2Nsb2NrJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnZnVsbF9kYXlfYm9va2luZyc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdmdWxsX2RheV9ib29raW5nJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnc2Vhc29uX2ZpbHRlcic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnc2Vhc29uX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3NfYXJyJyBdID0gW107XHJcblx0XHRcdFx0Ym9va2luZ19zdGF0dXNlc19hcnIgPSBbXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ3Jlc291cmNlX2F2YWlsYWJpbGl0eSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAncmVzb3VyY2VfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0gPSBbXTtcclxuXHRcdFx0XHRib29raW5nX3N0YXR1c2VzX2FyciA9IFtdO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnd2Vla2RheV91bmF2YWlsYWJsZSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnd2Vla2RheV91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzX2FycicgXSA9IFtdO1xyXG5cdFx0XHRcdGJvb2tpbmdfc3RhdHVzZXNfYXJyID0gW107XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3NfYXJyJyBdID0gW107XHJcblx0XHRcdFx0Ym9va2luZ19zdGF0dXNlc19hcnIgPSBbXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdsaW1pdF9hdmFpbGFibGVfZnJvbV90b2RheScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzX2FycicgXSA9IFtdO1xyXG5cdFx0XHRcdGJvb2tpbmdfc3RhdHVzZXNfYXJyID0gW107XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGFuZ2Vfb3Zlcic6XHJcblx0XHRcdFx0LypcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUgXHQgXHRjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZVxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUgXHQgXHRjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWRcclxuXHRcdFx0XHQvLyAgY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUgXHRcdCBcdGNoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWRcclxuXHRcdFx0XHQvLyAgY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdCAqL1xyXG5cclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX2luX3RpbWUnLCAnY2hlY2tfb3V0X3RpbWUnICk7XHJcblx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC4yLlxyXG5cdFx0XHRcdGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAnYXBwcm92ZWRfcGVuZGluZycgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfYXBwcm92ZWQnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJywgJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGVja19pbic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd0aW1lc3BhcnRseScsICdjaGVja19pbl90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhc19wYXJ0KCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmcnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXNfcGFydCggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnY2hlY2tfb3V0JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX291dF90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhc19wYXJ0KCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmcnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzX3BhcnQoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAnYXBwcm92ZWQnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdC8vIG1peGVkIHN0YXR1c2VzOiAnY2hhbmdlX292ZXIgY2hlY2tfb3V0JyAuLi4uIHZhcmlhdGlvbnMuLi4uIGNoZWNrIG1vcmUgaW4gXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2F2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIoKVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSA9ICdhdmFpbGFibGUnO1xyXG5cdFx0fVxyXG5cclxuXHJcblxyXG5cdFx0aWYgKCAnYXZhaWxhYmxlJyAhPSBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdHZhciBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGUgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlJyApO1x0Ly8gc2V0IHBlbmRpbmcgZGF5cyBzZWxlY3RhYmxlICAgICAgICAgIC8vIEZpeEluOiA4LjYuMS4xOC5cclxuXHJcblx0XHRcdGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAncGVuZGluZycgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfcGVuZGluZycgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdwZW5kaW5nX2FwcHJvdmVkJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZF9wZW5kaW5nJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZF9hcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcsICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gWyBpc19kYXlfc2VsZWN0YWJsZSwgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlLmpvaW4oICcgJyApIF07XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogTW91c2VvdmVyIGNhbGVuZGFyIGRhdGUgY2VsbHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBzdHJpbmdfZGF0ZVxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdFx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMFxyXG5cdCAqICAgICBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHRcdFx0XHRcdFx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXHRcdFx0XHRcdFx0XCJyZXNvdXJjZV9pZFwiOiA0XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHRcdFx0XHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2NhbGVuZGFyX19vbl9ob3Zlcl9kYXlzKCBzdHJpbmdfZGF0ZSwgZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApIHtcclxuXHJcblx0XHRpZiAoIG51bGwgPT09IGRhdGUgKSB7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSkpID8gY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdIDogJzEnICk7XHRcdC8vIEZpeEluOiAxMC41LjIuNC5cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBjbGFzc19kYXkgICAgID0gd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzEtOS0yMDIzJ1xyXG5cdFx0dmFyIHNxbF9jbGFzc19kYXkgPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzIwMjMtMDEtMDknXHJcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSApID8gY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdIDogJzEnO1x0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBHZXQgRGF0YSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGRhdGVfYm9va2luZ19vYmogPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB7Li4ufVxyXG5cclxuXHRcdGlmICggISBkYXRlX2Jvb2tpbmdfb2JqICl7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHJcblx0XHQvLyBUIG8gbyBsIHQgaSBwIHMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIHRvb2x0aXBfdGV4dCA9ICcnO1xyXG5cdFx0aWYgKCBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2F2YWlsYWJpbGl0eScgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9hdmFpbGFiaWxpdHknIF07XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfZGF5X2Nvc3QnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfZGF5X2Nvc3QnIF07XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfdGltZXMnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfdGltZXMnIF07XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYm9va2luZ19kZXRhaWxzJyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2Jvb2tpbmdfZGV0YWlscycgXTtcclxuXHRcdH1cclxuXHRcdHdwYmNfc2V0X3Rvb2x0aXBfX19mb3JfX2NhbGVuZGFyX2RhdGUoIHRvb2x0aXBfdGV4dCwgcmVzb3VyY2VfaWQsIGNsYXNzX2RheSApO1xyXG5cclxuXHJcblxyXG5cdFx0Ly8gIFUgbiBoIG8gdiBlIHIgaSBuIGcgICAgaW4gICAgVU5TRUxFQ1RBQkxFX0NBTEVOREFSICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgPSAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZScgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDApO1x0XHRcdFx0Ly8gRml4SW46IDguMC4xLjIuXHJcblx0XHR2YXIgaXNfYm9va2luZ19mb3JtX2V4aXN0ICAgID0gKCBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDAgKTtcclxuXHRcdHZhciBpc19hZGRfYm9va2luZ19tb2RhbF9jYWxlbmRhciA9ICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5jbG9zZXN0KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApLmxlbmd0aCA+IDAgKTtcclxuXHRcdHZhciBpc19hZG1pbl9jYWxlbmRhcl9wcmV2aWV3ID0gKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmNsb3Nlc3QoICdbZGF0YS13cGJjLWFkbWluLWNhbGVuZGFyLXByZXZpZXc9XCIxXCJdJyApLmxlbmd0aCA+IDAgKTtcclxuXHJcblx0XHRpZiAoICggaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyICkgJiYgKCAhIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCApICl7XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogIFVuIEhvdmVyIGFsbCBkYXRlcyBpbiBjYWxlbmRhciAod2l0aG91dCB0aGUgYm9va2luZyBmb3JtKSwgaWYgb25seSBBdmFpbGFiaWxpdHkgQ2FsZW5kYXIgaGVyZSBhbmQgd2UgZG9cclxuXHRcdFx0ICogbm90IGluc2VydCBCb29raW5nIGZvcm0gYnkgbWlzdGFrZS5cclxuXHRcdFx0ICovXHJcblxyXG5cdFx0XHR3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICk7IFx0XHRcdFx0XHRcdFx0Ly8gQ2xlYXIgZGF5cyBoaWdobGlnaHRpbmdcclxuXHJcblx0XHRcdHZhciBjc3Nfb2ZfY2FsZW5kYXIgPSAnLndwYmNfb25seV9jYWxlbmRhciAjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZDtcclxuXHRcdFx0alF1ZXJ5KCBjc3Nfb2ZfY2FsZW5kYXIgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwsICdcclxuXHRcdFx0XHQgICsgY3NzX29mX2NhbGVuZGFyICsgJyAuZGF0ZXBpY2stZGF5cy1jZWxsIGEnICkuY3NzKCAnY3Vyc29yJywgJ2RlZmF1bHQnICk7XHQvLyBTZXQgY3Vyc29yIHRvIERlZmF1bHRcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHJcblxyXG5cdFx0Ly8gIEQgYSB5IHMgICAgSCBvIHYgZSByIGkgbiBnICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMnICkgPT0gLTEgKVxyXG5cdFx0XHR8fCAoICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjJyApID4gMCApICYmICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAndGFiPWFkZC1ib29raW5nJyApID4gMCApIClcclxuXHRcdFx0fHwgKCBpc19hZGRfYm9va2luZ19tb2RhbF9jYWxlbmRhciApXHJcblx0XHRcdHx8ICggaXNfYWRtaW5fY2FsZW5kYXJfcHJldmlldyApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLXNldHVwJyApID4gMCApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLWF2YWlsYWJpbGl0eScgKSA+IDAgKVxyXG5cdFx0XHR8fCAoICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1zZXR0aW5ncycgKSA+IDAgKSAgJiZcclxuXHRcdFx0XHQgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAndGFiPWJ1aWxkZXJfYm9va2luZ19mb3JtJyApID4gMCApXHJcblx0XHRcdCAgIClcclxuXHRcdCl7XHJcblx0XHRcdC8vIFRoZSBzYW1lIGFzIGRhdGVzIHNlbGVjdGlvbiwgIGJ1dCBmb3IgZGF5cyBob3ZlcmluZ1xyXG5cclxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09IHR5cGVvZiggd3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X19icyApICl7XHJcblx0XHRcdFx0d3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X19icyggc3FsX2NsYXNzX2RheSwgZGF0ZSwgcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fSBlbHNlIGlmICggJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKSB7XHJcblx0XHRcdFx0d3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X191bnJlc3RyaWN0ZWRfcmFuZ2UoIHNxbF9jbGFzc19kYXksIGRhdGUsIHJlc291cmNlX2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogSGlnaGxpZ2h0IGFuIHVucmVzdHJpY3RlZCBwcm9wb3NlZCByYW5nZSBhZnRlciB0aGUgZmlyc3QgY2xpY2sgd2hlbiBCdXNpbmVzcyBTbWFsbCBpcyBub3QgbG9hZGVkLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXkgSG92ZXJlZCBkYXRlIGluIFNRTCBmb3JtYXQuXHJcblx0ICogQHBhcmFtIHtEYXRlfSBkYXRlIEhvdmVyZWQgZGF0ZS5cclxuXHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgY29tcGxldGUgcHJvcG9zZWQgcmFuZ2UgaXMgYXZhaWxhYmxlIGFuZCBoaWdobGlnaHRlZC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19oaWdobGlnaHRfX3VucmVzdHJpY3RlZF9yYW5nZSggc3FsX2NsYXNzX2RheSwgZGF0ZSwgcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0dmFyIHJhbmdlX3N0YXJ0O1xyXG5cdFx0dmFyIHJhbmdlX2VuZDtcclxuXHRcdHZhciB3b3JraW5nX2RhdGU7XHJcblx0XHR2YXIgdGRfb3ZlcnMgPSBbXTtcclxuXHJcblx0XHR3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICBudWxsID09PSBpbnN0XHJcblx0XHRcdHx8ICdkeW5hbWljJyAhPT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApXHJcblx0XHQpIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEJlZm9yZSBhIHJhbmdlIHN0YXJ0cywgb3IgYWZ0ZXIgaXQgaXMgY29tcGxldGUsIHByZXZpZXcgdGhlIGhvdmVyZWQgZGF0ZSBhcyB0aGUgcG9zc2libGUgZmlyc3QgZGF5LlxyXG5cdFx0aWYgKCAxICE9PSBpbnN0LmRhdGVzLmxlbmd0aCB8fCAhIGluc3QuZGF0ZXNbIDAgXSApIHtcclxuXHRcdFx0aWYgKCAhIHdwYmNfaXNfdGhpc19kYXlfc2VsZWN0YWJsZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKSApIHtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyAuY2FsNGRhdGUtJyArIHdwYmNfX2dldF9fdGRfY2xhc3NfZGF0ZSggZGF0ZSApIClcclxuXHRcdFx0XHQuYWRkQ2xhc3MoICdkYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKTtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmFuZ2Vfc3RhcnQgPSBuZXcgRGF0ZSggaW5zdC5kYXRlc1sgMCBdLmdldEZ1bGxZZWFyKCksIGluc3QuZGF0ZXNbIDAgXS5nZXRNb250aCgpLCBpbnN0LmRhdGVzWyAwIF0uZ2V0RGF0ZSgpLCAwLCAwLCAwICk7XHJcblx0XHRyYW5nZV9lbmQgICA9IG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHJcblx0XHQvLyBEYXRlcGljayBvbmx5IHBlcm1pdHMgYSBjaGVjay1vdXQgZGF0ZSBvbi9hZnRlciB0aGUgZmlyc3QgY2xpY2suIERvIG5vdCBwcmV2aWV3IGEgYmFja3dhcmQgcmFuZ2UuXHJcblx0XHRpZiAoIHJhbmdlX2VuZC5nZXRUaW1lKCkgPCByYW5nZV9zdGFydC5nZXRUaW1lKCkgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHR3b3JraW5nX2RhdGUgPSBuZXcgRGF0ZSggcmFuZ2Vfc3RhcnQuZ2V0VGltZSgpICk7XHJcblx0XHR3aGlsZSAoIHdvcmtpbmdfZGF0ZS5nZXRUaW1lKCkgPD0gcmFuZ2VfZW5kLmdldFRpbWUoKSApIHtcclxuXHRcdFx0c3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIHdvcmtpbmdfZGF0ZSApO1xyXG5cdFx0XHRpZiAoICEgd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dGRfb3ZlcnMucHVzaCggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyAuY2FsNGRhdGUtJyArIHdwYmNfX2dldF9fdGRfY2xhc3NfZGF0ZSggd29ya2luZ19kYXRlICkgKTtcclxuXHRcdFx0d29ya2luZ19kYXRlLnNldERhdGUoIHdvcmtpbmdfZGF0ZS5nZXREYXRlKCkgKyAxICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCB0ZF9vdmVycy5sZW5ndGggKSB7XHJcblx0XHRcdGpRdWVyeSggdGRfb3ZlcnMuam9pbiggJywnICkgKS5hZGRDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbXBsZXRlIGFuIHVucmVzdHJpY3RlZCB0d28tY2xpY2sgcmFuZ2Ugd2hlbiB0aGUgQnVzaW5lc3MgU21hbGwgcmFuZ2UgZW5naW5lIGlzIG5vdCBsb2FkZWQuXHJcblx0ICogVGhlIGhpZGRlbiBib29raW5nIGZpZWxkIG11c3QgY29udGFpbiBldmVyeSBkYXRlIGJlY2F1c2UgRnJlZSB0aW1lL2hpbnQgaGFuZGxlcnMgY29uc3VtZSBhIGNvbW1hLXNlcGFyYXRlZCBsaXN0LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdGVkX2RhdGVzIERhdGVwaWNrJ3MgZW5kcG9pbnQgc3RyaW5nLlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBhZnRlciBhIGNvbXBsZXRlIHZhbGlkIHJhbmdlLCBmYWxzZSB3aGlsZSBpbmNvbXBsZXRlIG9yIGludmFsaWQuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX2RvX2RheXNfc2VsZWN0X191bnJlc3RyaWN0ZWRfcmFuZ2UoIHNlbGVjdGVkX2RhdGVzLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHR2YXIgcmFuZ2Vfc3RhcnQ7XHJcblx0XHR2YXIgcmFuZ2VfZW5kO1xyXG5cdFx0dmFyIGN1cnJlbnRfZGF0ZTtcclxuXHRcdHZhciBzZWxlY3RlZF9yYW5nZSA9IFtdO1xyXG5cclxuXHRcdGlmICggbnVsbCA9PT0gaW5zdCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIERhdGVwaWNrIHdyaXRlcyBcInN0YXJ0IC0gc3RhcnRcIiBhZnRlciBjbGljayBvbmUuIEtlZXAgaXRzIGludGVybmFsIGVuZHBvaW50LCBidXQgZG8gbm90IGV4cG9zZSBhIHN1Ym1pdHRhYmxlIHJhbmdlIHlldC5cclxuXHRcdGlmICggdHJ1ZSA9PT0gaW5zdC5zdGF5T3BlbiB8fCBpbnN0LmRhdGVzLmxlbmd0aCA8IDIgfHwgISBpbnN0LmRhdGVzWyAwIF0gfHwgISBpbnN0LmRhdGVzWyAxIF0gKSB7XHJcblx0XHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoICcnICk7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRyYW5nZV9zdGFydCA9IG5ldyBEYXRlKCBpbnN0LmRhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSwgaW5zdC5kYXRlc1sgMCBdLmdldE1vbnRoKCksIGluc3QuZGF0ZXNbIDAgXS5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHRcdHJhbmdlX2VuZCAgID0gbmV3IERhdGUoIGluc3QuZGF0ZXNbIDEgXS5nZXRGdWxsWWVhcigpLCBpbnN0LmRhdGVzWyAxIF0uZ2V0TW9udGgoKSwgaW5zdC5kYXRlc1sgMSBdLmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cclxuXHRcdC8vIERlZmVuc2l2ZSBub3JtYWxpemF0aW9uLiBEYXRlcGljayBub3JtYWxseSBwcmV2ZW50cyBhbiBlbmQgZGF0ZSBiZWZvcmUgdGhlIGZpcnN0IGVuZHBvaW50LlxyXG5cdFx0aWYgKCByYW5nZV9lbmQuZ2V0VGltZSgpIDwgcmFuZ2Vfc3RhcnQuZ2V0VGltZSgpICkge1xyXG5cdFx0XHRjdXJyZW50X2RhdGUgPSByYW5nZV9zdGFydDtcclxuXHRcdFx0cmFuZ2Vfc3RhcnQgPSByYW5nZV9lbmQ7XHJcblx0XHRcdHJhbmdlX2VuZCA9IGN1cnJlbnRfZGF0ZTtcclxuXHRcdH1cclxuXHJcblx0XHRjdXJyZW50X2RhdGUgPSBuZXcgRGF0ZSggcmFuZ2Vfc3RhcnQuZ2V0VGltZSgpICk7XHJcblx0XHR3aGlsZSAoIGN1cnJlbnRfZGF0ZS5nZXRUaW1lKCkgPD0gcmFuZ2VfZW5kLmdldFRpbWUoKSApIHtcclxuXHRcdFx0aWYgKCAhIHdwYmNfaXNfdGhpc19kYXlfc2VsZWN0YWJsZSggcmVzb3VyY2VfaWQsIHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGN1cnJlbnRfZGF0ZSApICkgKSB7XHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICggd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyApICkge1xyXG5cdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyhcclxuXHRcdFx0XHRcdFx0JyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyAuYmtfY2FsZW5kYXJfZnJhbWUnLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfcmFuZ2Vfc2VsZWN0aW9uX2hhc191bmF2YWlsYWJsZV9kYXRlcycgKSxcclxuXHRcdFx0XHRcdFx0J3RleHQnXHJcblx0XHRcdFx0XHQpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNlbGVjdGVkX3JhbmdlLnB1c2goIGpRdWVyeS5kYXRlcGljay5fZm9ybWF0RGF0ZSggaW5zdCwgY3VycmVudF9kYXRlICkgKTtcclxuXHRcdFx0Y3VycmVudF9kYXRlLnNldERhdGUoIGN1cnJlbnRfZGF0ZS5nZXREYXRlKCkgKyAxICk7XHJcblx0XHR9XHJcblxyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggc2VsZWN0ZWRfcmFuZ2Uuam9pbiggJywgJyApICk7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBQcmVwYXJlIGEgY29sbGFwc2VkIHJhbmdlLXNlbGVjdGlvbiBndWlkYW5jZSBub3RlIGZvciBvbmUgY2FsZW5kYXIuXHJcblx0ICogS2VlcGluZyBvbmUgcmV1c2FibGUgbm9kZSBhdm9pZHMgcmVwZWF0ZWQgaW5zZXJ0aW9uIHdoaWxlIGluYWN0aXZlIGd1aWRhbmNlIG9jY3VwaWVzIG5vIGxheW91dCBzcGFjZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKiBAcmV0dXJucyB7alF1ZXJ5fSBUaGUgcHJlcGFyZWQgbm90ZSwgb3IgYW4gZW1wdHkgY29sbGVjdGlvbiB3aGVuIGd1aWRhbmNlIGlzIHVuYXZhaWxhYmxlLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19wcmVwYXJlX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBpc19lbmFibGVkID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdyYW5nZV9zZWxlY3Rpb25fZ3VpZGFuY2VfaXNfZW5hYmxlZCcgKTtcclxuXHRcdHZhciAkYm9va2luZ19mb3JtID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKTtcclxuXHRcdHZhciAkY2FsZW5kYXJfZnJhbWU7XHJcblx0XHR2YXIgJG5vdGUgPSBqUXVlcnkoICcjd3BiY19yYW5nZV9zZWxlY3Rpb25fZ3VpZGFuY2UnICsgcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgIGZhbHNlID09PSBpc19lbmFibGVkXHJcblx0XHRcdHx8IDAgPT09IGlzX2VuYWJsZWRcclxuXHRcdFx0fHwgJzAnID09PSBpc19lbmFibGVkXHJcblx0XHRcdHx8ICdvZmYnID09PSBTdHJpbmcoIGlzX2VuYWJsZWQgKS50b0xvd2VyQ2FzZSgpXHJcblx0XHRcdHx8ICdmYWxzZScgPT09IFN0cmluZyggaXNfZW5hYmxlZCApLnRvTG93ZXJDYXNlKClcclxuXHRcdFx0fHwgJ2R5bmFtaWMnICE9PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnIClcclxuXHRcdFx0fHwgMCA9PT0gJGJvb2tpbmdfZm9ybS5sZW5ndGhcclxuXHRcdCkge1xyXG5cdFx0XHQkbm90ZS5yZW1vdmUoKTtcclxuXHRcdFx0cmV0dXJuIGpRdWVyeSgpO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggMCA8ICRub3RlLmxlbmd0aCApIHtcclxuXHRcdFx0JG5vdGUuc3RvcCggdHJ1ZSwgdHJ1ZSApLmhpZGUoKS5hdHRyKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKTtcclxuXHRcdFx0cmV0dXJuICRub3RlO1xyXG5cdFx0fVxyXG5cclxuXHRcdCRjYWxlbmRhcl9mcmFtZSA9ICRib29raW5nX2Zvcm0uZmluZCggJy5ibG9ja19oaW50cy5kYXRlcGljaycgKS5maXJzdCgpO1xyXG5cdFx0aWYgKCAwID09PSAkY2FsZW5kYXJfZnJhbWUubGVuZ3RoICkge1xyXG5cdFx0XHQkY2FsZW5kYXJfZnJhbWUgPSAkYm9va2luZ19mb3JtLmZpbmQoICcud3BiY19jYWxfcG93ZXJlZF9ieScgKS5maXJzdCgpO1xyXG5cdFx0XHRpZiAoIDAgPT09ICRjYWxlbmRhcl9mcmFtZS5sZW5ndGggKSB7XHJcblx0XHRcdFx0JGNhbGVuZGFyX2ZyYW1lID0gJGJvb2tpbmdfZm9ybS5maW5kKCAnLmJrX2NhbGVuZGFyX2ZyYW1lJyApLmZpcnN0KCk7XHJcblx0XHRcdFx0aWYgKCAwID09PSAkY2FsZW5kYXJfZnJhbWUubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIGpRdWVyeSgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdCRub3RlID0galF1ZXJ5KCAnPGRpdj4nLCB7XHJcblx0XHRcdCdpZCc6ICd3cGJjX3JhbmdlX3NlbGVjdGlvbl9ndWlkYW5jZScgKyByZXNvdXJjZV9pZCxcclxuXHRcdFx0J2NsYXNzJzogJ3dwYmNfcmFuZ2Vfc2VsZWN0aW9uX2d1aWRhbmNlIHdwYmNfZnJvbnRfZW5kX19tZXNzYWdlIHdwYmNfZmVfbWVzc2FnZV9pbmZvJyxcclxuXHRcdFx0J3JvbGUnOiAnc3RhdHVzJyxcclxuXHRcdFx0J2FyaWEtbGl2ZSc6ICdwb2xpdGUnLFxyXG5cdFx0XHQnYXJpYS1oaWRkZW4nOiAndHJ1ZScsXHJcblx0XHRcdCdzdHlsZSc6ICdkaXNwbGF5OiBub25lOydcclxuXHRcdH0gKTtcclxuXHRcdCRub3RlLmFwcGVuZCggalF1ZXJ5KCAnPGk+Jywge1xyXG5cdFx0XHQnY2xhc3MnOiAnbWVudV9pY29uIGljb24tMXggd3BiY19pY25faW5mb19vdXRsaW5lJyxcclxuXHRcdFx0J2FyaWEtaGlkZGVuJzogJ3RydWUnXHJcblx0XHR9ICkgKTtcclxuXHRcdCRub3RlLmFwcGVuZCggalF1ZXJ5KCAnPHNwYW4+JyApLnRleHQoIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9yYW5nZV9zZWxlY3Rpb25fY2xpY2tfbGFzdF9kYXRlJyApICkgKTtcclxuXHRcdCRjYWxlbmRhcl9mcmFtZS5hZnRlciggJG5vdGUgKTtcclxuXHJcblx0XHRyZXR1cm4gJG5vdGU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IHRoZSByYW5nZS1ndWlkYW5jZSBhbmltYXRpb24gZHVyYXRpb24gZm9yIHRoZSBjdXJyZW50IG1vdGlvbiBwcmVmZXJlbmNlLlxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge251bWJlcn0gQW5pbWF0aW9uIGR1cmF0aW9uIGluIG1pbGxpc2Vjb25kcywgb3IgemVybyB3aGVuIHJlZHVjZWQgbW90aW9uIGlzIHByZWZlcnJlZC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3JhbmdlX3NlbGVjdGlvbl9fZ2V0X2d1aWRhbmNlX2FuaW1hdGlvbl9kdXJhdGlvbigpe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0J2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHdpbmRvdy5tYXRjaE1lZGlhXHJcblx0XHRcdCYmIHdpbmRvdy5tYXRjaE1lZGlhKCAnKHByZWZlcnMtcmVkdWNlZC1tb3Rpb246IHJlZHVjZSknICkubWF0Y2hlc1xyXG5cdFx0KSB7XHJcblx0XHRcdHJldHVybiAwO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAxNjA7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ29sbGFwc2UgdGhlIHJhbmdlLXNlbGVjdGlvbiBndWlkYW5jZSBzbyBpdCBkb2VzIG5vdCByZXNlcnZlIGVtcHR5IGxheW91dCBzcGFjZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3JhbmdlX3NlbGVjdGlvbl9faGlkZV9ndWlkYW5jZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRqUXVlcnkoICcjd3BiY19yYW5nZV9zZWxlY3Rpb25fZ3VpZGFuY2UnICsgcmVzb3VyY2VfaWQgKVxyXG5cdFx0XHQuYXR0ciggJ2FyaWEtaGlkZGVuJywgJ3RydWUnIClcclxuXHRcdFx0LnN0b3AoIHRydWUsIHRydWUgKVxyXG5cdFx0XHQuc2xpZGVVcCggd3BiY19yYW5nZV9zZWxlY3Rpb25fX2dldF9ndWlkYW5jZV9hbmltYXRpb25fZHVyYXRpb24oKSApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNob3cgdGhlIHByZXBhcmVkIGluZm9ybWF0aW9uYWwgbm90ZSBhZnRlciB0aGUgZmlyc3QgcmFuZ2UgY2xpY2suXHJcblx0ICogVGhlIGNhbGVuZGFyIHBhcmFtZXRlciBjYW4gYmUgc2V0IHRvIGZhbHNlIGJ5IFBIUCBvciBKYXZhU2NyaXB0IHRvIHN1cHByZXNzIHRoaXMgVUkgcGVyIHJlc291cmNlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIG5vdGUgd2FzIHNob3duLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19zaG93X2d1aWRhbmNlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciAkbm90ZSA9IHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19wcmVwYXJlX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdGlmICggMCA9PT0gJG5vdGUubGVuZ3RoICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0JG5vdGVcclxuXHRcdFx0LnN0b3AoIHRydWUsIHRydWUgKVxyXG5cdFx0XHQuc2xpZGVEb3duKCB3cGJjX3JhbmdlX3NlbGVjdGlvbl9fZ2V0X2d1aWRhbmNlX2FuaW1hdGlvbl9kdXJhdGlvbigpIClcclxuXHRcdFx0LnJlbW92ZUF0dHIoICdhcmlhLWhpZGRlbicgKTtcclxuXHRcdCRub3RlLmZpbmQoICdzcGFuJyApLnRleHQoIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9yYW5nZV9zZWxlY3Rpb25fY2xpY2tfbGFzdF9kYXRlJyApICk7XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU3luY2hyb25pemUgdGhlIGd1aWRhbmNlIHdpdGggRGF0ZXBpY2sncyB0d28tY2xpY2sgcmFuZ2Ugc3RhdGUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19yYW5nZV9zZWxlY3Rpb25fX3N5bmNfZ3VpZGFuY2UoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgIG51bGwgIT09IGluc3RcclxuXHRcdFx0JiYgJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnIClcclxuXHRcdFx0JiYgdHJ1ZSA9PT0gaW5zdC5zdGF5T3BlblxyXG5cdFx0XHQmJiAxID09PSBpbnN0LmRhdGVzLmxlbmd0aFxyXG5cdFx0XHQmJiBpbnN0LmRhdGVzWyAwIF1cclxuXHRcdCkge1xyXG5cdFx0XHR3cGJjX3JhbmdlX3NlbGVjdGlvbl9fc2hvd19ndWlkYW5jZSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19oaWRlX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNlbGVjdCBjYWxlbmRhciBkYXRlIGNlbGxzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHRcdFx0XHRcdFx0LSAgSmF2YVNjcmlwdCBEYXRlIE9iajogIFx0XHRNb24gRGVjIDExIDIwMjMgMDA6MDA6MDBcclxuXHQgKiAgICAgR01UKzAyMDAgKEVhc3Rlcm4gRXVyb3BlYW4gU3RhbmRhcmQgVGltZSlcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0XHRcdFx0XHRcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFx0XHRcdFx0XHRcdFwicmVzb3VyY2VfaWRcIjogNFxyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0XHRcdFx0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2NhbGVuZGFyX19vbl9zZWxlY3RfZGF5cyggZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApe1xyXG5cclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7XHRcdC8vICcxJ1xyXG5cclxuXHRcdC8vIFNldCB1bnNlbGVjdGFibGUsICBpZiBvbmx5IEF2YWlsYWJpbGl0eSBDYWxlbmRhciAgaGVyZSAoYW5kIHdlIGRvIG5vdCBpbnNlcnQgQm9va2luZyBmb3JtIGJ5IG1pc3Rha2UpLlxyXG5cdFx0dmFyIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciA9ICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmdfdW5zZWxlY3RhYmxlJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCk7XHRcdFx0XHQvLyBGaXhJbjogOC4wLjEuMi5cclxuXHRcdHZhciBpc19ib29raW5nX2Zvcm1fZXhpc3QgICAgPSAoIGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApO1xyXG5cdFx0aWYgKCAoIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciApICYmICggISBpc19ib29raW5nX2Zvcm1fZXhpc3QgKSApe1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBVbnNlbGVjdCBEYXRlc1xyXG5cdFx0XHRqUXVlcnkoJy53cGJjX29ubHlfY2FsZW5kYXIgLnBvcG92ZXJfY2FsZW5kYXJfaG92ZXInKS5yZW1vdmUoKTsgICAgICAgICAgICAgICAgICAgICAgXHRcdFx0XHRcdFx0XHQvLyBIaWRlIGFsbCBvcGVuZWQgcG9wb3ZlcnNcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEFkZCBzZWxlY3RlZCBkYXRlcyB0byAgaGlkZGVuIHRleHRhcmVhXHJcblxyXG5cclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19zZWxlY3RfX2JzKSApIHtcclxuXHRcdFx0d3BiY19fY2FsZW5kYXJfX2RvX2RheXNfc2VsZWN0X19icyggZGF0ZSwgcmVzb3VyY2VfaWQgKTtcclxuXHRcdH0gZWxzZSBpZiAoICdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICkge1xyXG5cdFx0XHR3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19zZWxlY3RfX3VucmVzdHJpY3RlZF9yYW5nZSggZGF0ZSwgcmVzb3VyY2VfaWQgKTtcclxuXHRcdH1cclxuXHJcblx0XHR3cGJjX3JhbmdlX3NlbGVjdGlvbl9fc3luY19ndWlkYW5jZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHR3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIEhvb2sgLS0gdHJpZ2dlciBkYXkgc2VsZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgbW91c2VfY2xpY2tlZF9kYXRlcyA9IGRhdGU7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFwiMDUuMTAuMjAyMyAtIDA3LjEwLjIwMjNcIiAgfCAgXCIxMC4xMC4yMDIzIC0gMTAuMTAuMjAyM1wiICB8XHJcblx0XHR2YXIgYWxsX3NlbGVjdGVkX2RhdGVzX2FyciA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFsgXCIyMDIzLTEwLTA1XCIsIFwiMjAyMy0xMC0wNlwiLCBcIjIwMjMtMTAtMDdcIiwg4oCmIF1cclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkudHJpZ2dlciggXCJkYXRlX3NlbGVjdGVkXCIsIFsgcmVzb3VyY2VfaWQsIG1vdXNlX2NsaWNrZWRfZGF0ZXMsIGFsbF9zZWxlY3RlZF9kYXRlc19hcnIgXSApO1xyXG5cdH1cclxuXHJcblx0Ly8gTWFyayBtaWRkbGUgc2VsZWN0ZWQgZGF0ZXMgd2l0aCAwLjUgb3BhY2l0eVx0XHQvLyBGaXhJbjogMTAuMy4wLjkuXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkub24oICdkYXRlX3NlbGVjdGVkJywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIGRhdGUgKXtcclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHQgICAoICAnZml4ZWQnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpXHJcblx0XHRcdFx0XHR8fCAoJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0dmFyIG1pZGRsZV9kYXlzX29wYWNpdHkgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdjYWxlbmRhcnNfX2RheXNfc2VsZWN0aW9uX19taWRkbGVfZGF5c19vcGFjaXR5JyApO1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgLmRhdGVwaWNrLWN1cnJlbnQtZGF5JyApLm5vdCggXCIuc2VsZWN0ZWRfY2hlY2tfaW5fb3V0XCIgKS5jc3MoICdvcGFjaXR5JywgbWlkZGxlX2RheXNfb3BhY2l0eSApO1xyXG5cdFx0XHRcdFx0fSwgMTAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fSApO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogLS0gIFQgaSBtIGUgICAgRiBpIGUgbCBkIHMgICAgIHN0YXJ0ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEaXNhYmxlIHRpbWUgc2xvdHMgaW4gYm9va2luZyBmb3JtIGRlcGVuZCBvbiBzZWxlY3RlZCBkYXRlcyBhbmQgYm9va2VkIGRhdGVzL3RpbWVzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogXHQxLiBHZXQgYWxsIHRpbWUgZmllbGRzIGluIHRoZSBib29raW5nIGZvcm0gYXMgYXJyYXkgIG9mIG9iamVjdHNcclxuXHRcdCAqIFx0XHRcdFx0XHRbXHJcblx0XHQgKiBcdFx0XHRcdFx0IFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0XHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdFx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCBdXHJcblx0XHQgKi9cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmpfYXJyID0gd3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyAyLiBHZXQgYWxsIHNlbGVjdGVkIGRhdGVzIGluICBTUUwgZm9ybWF0ICBsaWtlIHRoaXMgWyBcIjIwMjMtMDgtMjNcIiwgXCIyMDIzLTA4LTI0XCIsIFwiMjAyMy0wOC0yNVwiLCAuLi4gXVxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX2FyciA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyAzLiBHZXQgY2hpbGQgYm9va2luZyByZXNvdXJjZXMgIG9yIHNpbmdsZSBib29raW5nIHJlc291cmNlICB0aGF0ICBleGlzdCAgaW4gZGF0ZXNcclxuXHRcdHZhciBjaGlsZF9yZXNvdXJjZXNfYXJyID0gd3BiY19jbG9uZV9vYmooIF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgKSApO1xyXG5cclxuXHRcdHZhciBzcWxfZGF0ZTtcclxuXHRcdHZhciBjaGlsZF9yZXNvdXJjZV9pZDtcclxuXHRcdHZhciBtZXJnZWRfc2Vjb25kcztcclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmo7XHJcblx0XHR2YXIgaXNfaW50ZXJzZWN0O1xyXG5cdFx0dmFyIGlzX2NoZWNrX2luO1xyXG5cclxuXHRcdHZhciB0b2RheV90aW1lX19yZWFsICA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVswXSwgKCBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbMV0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsyXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbM10sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzRdLCAwICk7XHJcblx0XHR2YXIgdG9kYXlfdGltZV9fc2hpZnQgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbMF0sICggcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggICAgICAndG9kYXlfYXJyJyApWzFdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbMl0sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgICAgICApWzNdLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVs0XSwgMCApO1xyXG5cdFx0dmFyIGFsbG93X3Bhc3RfY29udGV4dCA9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9hbGxvd19wYXN0JyApO1xyXG5cdFx0dmFyIGVkaXRfYm9va2luZ19oYXNoX2NvbnRleHQgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYm9va2luZ19oYXNoJyApO1xyXG5cdFx0dmFyIGlzX2FsbG93X3Bhc3RfY29udGV4dCA9XHJcblx0XHRcdCAgICggJzEnID09PSBTdHJpbmcoIGFsbG93X3Bhc3RfY29udGV4dCApIClcclxuXHRcdFx0fHwgKCAxID09PSBhbGxvd19wYXN0X2NvbnRleHQgKVxyXG5cdFx0XHR8fCAoIHRydWUgPT09IGFsbG93X3Bhc3RfY29udGV4dCApXHJcblx0XHRcdHx8ICggJycgIT09IFN0cmluZyggZWRpdF9ib29raW5nX2hhc2hfY29udGV4dCB8fCAnJyApIClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdib29raW5nX2hhc2gnICkgPiAtMSApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAnYWxsb3dfcGFzdCcgKSA+IC0xICk7XHJcblxyXG5cdFx0Ly8gNC4gTG9vcCAgYWxsICB0aW1lIEZpZWxkcyBvcHRpb25zXHRcdC8vIEZpeEluOiAxMC4zLjAuMi5cclxuXHRcdGZvciAoIGxldCBmaWVsZF9rZXkgPSAwOyBmaWVsZF9rZXkgPCB0aW1lX2ZpZWxkc19vYmpfYXJyLmxlbmd0aDsgZmllbGRfa2V5KysgKXtcclxuXHJcblx0XHRcdHRpbWVfZmllbGRzX29ial9hcnJbIGZpZWxkX2tleSBdLmRpc2FibGVkID0gMDsgICAgICAgICAgLy8gQnkgZGVmYXVsdCwgdGhpcyB0aW1lIGZpZWxkIGlzIG5vdCBkaXNhYmxlZC5cclxuXHJcblx0XHRcdHRpbWVfZmllbGRzX29iaiA9IHRpbWVfZmllbGRzX29ial9hcnJbIGZpZWxkX2tleSBdO1x0XHQvLyB7IHRpbWVzX2FzX3NlY29uZHM6IFsgMjE2MDAsIDIzNDAwIF0sIHZhbHVlX29wdGlvbl8yNGg6ICcwNjowMCAtIDA2OjMwJywgbmFtZTogJ3JhbmdldGltZTJbXScsIGpxdWVyeV9vcHRpb246IGpRdWVyeV9PYmplY3Qge319XHJcblxyXG5cdFx0XHQvLyBMb29wICBhbGwgIHNlbGVjdGVkIGRhdGVzLlxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKSB7XHJcblxyXG5cdFx0XHRcdC8vIEdldCBEYXRlOiAnMjAyMy0wOC0xOCcuXHJcblx0XHRcdFx0c3FsX2RhdGUgPSBzZWxlY3RlZF9kYXRlc19hcnJbaV07XHJcblxyXG5cdFx0XHRcdHZhciBpc190aW1lX2luX3Bhc3QgPSBpc19hbGxvd19wYXN0X2NvbnRleHQgPyBmYWxzZSA6IHdwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0KCB0b2RheV90aW1lX19zaGlmdCwgc3FsX2RhdGUsIHRpbWVfZmllbGRzX29iaiApO1xyXG5cdFx0XHRcdC8vIEV4Y2VwdGlvbiAgZm9yICdFbmQgVGltZScgZmllbGQsICB3aGVuICBzZWxlY3RlZCBzZXZlcmFsIGRhdGVzLiAvLyBGaXhJbjogMTAuMTQuMS41LlxyXG5cdFx0XHRcdGlmICggKCAhIGlzX2FsbG93X3Bhc3RfY29udGV4dCApICYmXHJcblx0XHRcdFx0XHQoJ09uJyAhPT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3JlY3VycmVudF90aW1lJyApKSAmJlxyXG5cdFx0XHRcdFx0KC0xICE9PSB0aW1lX2ZpZWxkc19vYmoubmFtZS5pbmRleE9mKCAnZW5kdGltZScgKSkgJiZcclxuXHRcdFx0XHRcdChzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoID4gMSlcclxuXHRcdFx0XHQpIHtcclxuXHRcdFx0XHRcdGlzX3RpbWVfaW5fcGFzdCA9IHdwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0KCB0b2RheV90aW1lX19zaGlmdCwgc2VsZWN0ZWRfZGF0ZXNfYXJyWyhzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoIC0gMSldLCB0aW1lX2ZpZWxkc19vYmogKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBpc190aW1lX2luX3Bhc3QgKSB7XHJcblx0XHRcdFx0XHQvLyBUaGlzIHRpbWUgZm9yIHNlbGVjdGVkIGRhdGUgYWxyZWFkeSAgaW4gdGhlIHBhc3QuXHJcblx0XHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyW2ZpZWxkX2tleV0uZGlzYWJsZWQgPSAxO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGV4aXN0ICBmcm9tICAgRGF0ZXMgTE9PUC5cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gRml4SW46IDkuOS4wLjMxLlxyXG5cdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCAgICggJ09mZicgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19yZWN1cnJlbnRfdGltZScgKSApXHJcblx0XHRcdFx0XHQmJiAoIHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGg+MSApXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdC8vVE9ETzogc2tpcCBzb21lIGZpZWxkcyBjaGVja2luZyBpZiBpdCdzIHN0YXJ0IC8gZW5kIHRpbWUgZm9yIG11bHBsZSBkYXRlcyAgc2VsZWN0aW9uICBtb2RlLlxyXG5cdFx0XHRcdFx0Ly9UT0RPOiB3ZSBuZWVkIHRvIGZpeCBzaXR1YXRpb24gIGZvciBlbnRpbWVzLCAgd2hlbiAgdXNlciAgc2VsZWN0ICBzZXZlcmFsICBkYXRlcywgIGFuZCBpbiBzdGFydCAgdGltZSBib29rZWQgMDA6MDAgLSAxNTowMCAsIGJ1dCBzeXN0c21lIGJsb2NrIHVudGlsbCAxNTowMCB0aGUgZW5kIHRpbWUgYXMgd2VsbCwgIHdoaWNoICBpcyB3cm9uZywgIGJlY2F1c2UgaXQgMiBvciAzIGRhdGVzIHNlbGVjdGlvbiAgYW5kIGVuZCBkYXRlIGNhbiBiZSBmdWxsdSAgYXZhaWxhYmxlXHJcblxyXG5cdFx0XHRcdFx0aWYgKCAoMCA9PSBpKSAmJiAodGltZV9maWVsZHNfb2JqWyAnbmFtZScgXS5pbmRleE9mKCAnZW5kdGltZScgKSA+PSAwKSApe1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggKCAoc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aC0xKSA9PSBpICkgJiYgKHRpbWVfZmllbGRzX29ialsgJ25hbWUnIF0uaW5kZXhPZiggJ3N0YXJ0dGltZScgKSA+PSAwKSApe1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cclxuXHJcblx0XHRcdFx0dmFyIGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCA9IDA7XHJcblx0XHRcdFx0Ly8gTG9vcCBhbGwgcmVzb3VyY2VzIElEXHJcblx0XHRcdFx0XHQvLyBmb3IgKCB2YXIgcmVzX2tleSBpbiBjaGlsZF9yZXNvdXJjZXNfYXJyICl7XHQgXHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjMuMC4yLlxyXG5cdFx0XHRcdGlmICggbnVsbCA9PT0gY2hpbGRfcmVzb3VyY2VzX2FyciApIHtcclxuXHRcdFx0XHRcdGNoaWxkX3Jlc291cmNlc19hcnIgPSBbXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Zm9yICggbGV0IHJlc19rZXkgPSAwOyByZXNfa2V5IDwgY2hpbGRfcmVzb3VyY2VzX2Fyci5sZW5ndGg7IHJlc19rZXkrKyApe1xyXG5cclxuXHRcdFx0XHRcdGNoaWxkX3Jlc291cmNlX2lkID0gY2hpbGRfcmVzb3VyY2VzX2FyclsgcmVzX2tleSBdO1xyXG5cclxuXHRcdFx0XHRcdC8vIF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1x0XHQ9IFsgXCIwNzowMDoxMSAtIDA3OjMwOjAyXCIsIFwiMTA6MDA6MTEgLSAwMDowMDowMFwiIF1cclxuXHRcdFx0XHRcdC8vIF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzXHRcdFx0PSBbICBbIDI1MjExLCAyNzAwMiBdLCBbIDM2MDExLCA4NjQwMCBdICBdXHJcblxyXG5cdFx0XHRcdFx0aWYgKCBmYWxzZSAhPT0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9kYXRlICkgKXtcclxuXHRcdFx0XHRcdFx0bWVyZ2VkX3NlY29uZHMgPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2RhdGUgKVsgY2hpbGRfcmVzb3VyY2VfaWQgXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcztcdFx0Ly8gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bWVyZ2VkX3NlY29uZHMgPSBbXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMubGVuZ3RoID4gMSApe1xyXG5cdFx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2lzX2ludGVyc2VjdF9fcmFuZ2VfdGltZV9pbnRlcnZhbCggIFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0W1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCggcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzBdICkgKyAyMCApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCggcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzFdICkgLSAyMCApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgbWVyZ2VkX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlzX2NoZWNrX2luID0gKC0xICE9PSB0aW1lX2ZpZWxkc19vYmoubmFtZS5pbmRleE9mKCAnc3RhcnQnICkpO1xyXG5cdFx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2lzX2ludGVyc2VjdF9fb25lX3RpbWVfaW50ZXJ2YWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoICggaXNfY2hlY2tfaW4gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApICsgMjBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgOiBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSAtIDIwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIG1lcmdlZF9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoaXNfaW50ZXJzZWN0KXtcclxuXHRcdFx0XHRcdFx0aG93X21hbnlfcmVzb3VyY2VzX2ludGVyc2VjdGVkKys7XHRcdFx0Ly8gSW5jcmVhc2VcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIGNoaWxkX3Jlc291cmNlc19hcnIubGVuZ3RoID09IGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCApIHtcclxuXHRcdFx0XHRcdC8vIEFsbCByZXNvdXJjZXMgaW50ZXJzZWN0ZWQsICB0aGVuICBpdCdzIG1lYW5zIHRoYXQgdGhpcyB0aW1lLXNsb3Qgb3IgdGltZSBtdXN0ICBiZSAgRGlzYWJsZWQsIGFuZCB3ZSBjYW4gIGV4aXN0ICBmcm9tICAgc2VsZWN0ZWRfZGF0ZXNfYXJyIExPT1BcclxuXHJcblx0XHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXS5kaXNhYmxlZCA9IDE7XHJcblx0XHRcdFx0XHRicmVhaztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gZXhpc3QgIGZyb20gICBEYXRlcyBMT09QXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vIDUuIE5vdyB3ZSBjYW4gZGlzYWJsZSB0aW1lIHNsb3QgaW4gSFRNTCBieSAgdXNpbmcgICggZmllbGQuZGlzYWJsZWQgPT0gMSApIHByb3BlcnR5XHJcblx0XHR3cGJjX19odG1sX190aW1lX2ZpZWxkX29wdGlvbnNfX3NldF9kaXNhYmxlZCggdGltZV9maWVsZHNfb2JqX2FyciApO1xyXG5cclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkudHJpZ2dlciggJ3dwYmNfaG9va190aW1lc2xvdHNfZGlzYWJsZWQnLCBbcmVzb3VyY2VfaWQsIHNlbGVjdGVkX2RhdGVzX2Fycl0gKTtcdFx0XHRcdFx0Ly8gVHJpZ2dlciBob29rIG9uIGRpc2FibGluZyB0aW1lc2xvdHMuXHRcdFVzYWdlOiBcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkub24oICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkJywgZnVuY3Rpb24gKCBldmVudCwgYmtfdHlwZSwgYWxsX2RhdGVzICl7IC4uLiB9ICk7XHRcdC8vIEZpeEluOiA4LjcuMTEuOS5cclxuXHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgaWYgc3BlY2lmaWMgdGltZSgtc2xvdCkgYWxyZWFkeSAgaW4gdGhlIHBhc3QgZm9yIHNlbGVjdGVkIGRhdGVcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ganNfY3VycmVudF90aW1lX3RvX2NoZWNrXHRcdC0gSlMgRGF0ZVxyXG5cdFx0ICogQHBhcmFtIHNxbF9kYXRlXHRcdFx0XHRcdFx0LSAnMjAyNS0wMS0yNidcclxuXHRcdCAqIEBwYXJhbSB0aW1lX2ZpZWxkc19vYmpcdFx0XHRcdC0gT2JqZWN0XHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19jaGVja19pc190aW1lX2luX3Bhc3QoIGpzX2N1cnJlbnRfdGltZV90b19jaGVjaywgc3FsX2RhdGUsIHRpbWVfZmllbGRzX29iaiApIHtcclxuXHJcblx0XHRcdC8vIEZpeEluOiAxMC45LjYuNFxyXG5cdFx0XHR2YXIgc3FsX2RhdGVfYXJyID0gc3FsX2RhdGUuc3BsaXQoICctJyApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGVfX21pZG5pZ2h0ID0gbmV3IERhdGUoIHBhcnNlSW50KCBzcWxfZGF0ZV9hcnJbMF0gKSwgKCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzFdICkgLSAxICksIHBhcnNlSW50KCBzcWxfZGF0ZV9hcnJbMl0gKSwgMCwgMCwgMCApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGVfX21pZG5pZ2h0X21pbGlzZWNvbmRzID0gc3FsX2RhdGVfX21pZG5pZ2h0LmdldFRpbWUoKTtcclxuXHJcblx0XHRcdHZhciBpc19pbnRlcnNlY3QgPSBmYWxzZTtcclxuXHJcblx0XHRcdGlmICggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2suZ2V0VGltZSgpID4gKHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyArIChwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHNbMF0gKSArIDIwKSAqIDEwMDApICkge1xyXG5cdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2suZ2V0VGltZSgpID4gKHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyArIChwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHNbMV0gKSAtIDIwKSAqIDEwMDApICkge1xyXG5cdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZhciBpc19jaGVja19pbiA9ICgtMSAhPT0gdGltZV9maWVsZHNfb2JqLm5hbWUuaW5kZXhPZiggJ3N0YXJ0JyApKTtcclxuXHJcblx0XHRcdFx0dmFyIHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgPSAoaXNfY2hlY2tfaW4pID8gcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgKyAyMCA6IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApIC0gMjA7XHJcblxyXG5cdFx0XHRcdHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgPSBzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyB0aW1lc19hc19zZWNvbmRzX2NoZWNrICogMTAwMDtcclxuXHJcblx0XHRcdFx0aWYgKCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2suZ2V0VGltZSgpID4gdGltZXNfYXNfc2Vjb25kc19jaGVjayApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gaXNfaW50ZXJzZWN0O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSXMgbnVtYmVyIGluc2lkZSAvaW50ZXJzZWN0ICBvZiBhcnJheSBvZiBpbnRlcnZhbHMgP1xyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB0aW1lX0FcdFx0ICAgICBcdC0gMjU4MDBcclxuXHRcdCAqIEBwYXJhbSB0aW1lX2ludGVydmFsX0JcdFx0LSBbICBbIDI1MjExLCAyNzAwMiBdLCBbIDM2MDExLCA4NjQwMCBdICBdXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pc19pbnRlcnNlY3RfX29uZV90aW1lX2ludGVydmFsKCB0aW1lX0EsIHRpbWVfaW50ZXJ2YWxfQiApe1xyXG5cclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9pbnRlcnZhbF9CLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHRcdGlmICggKHBhcnNlSW50KCB0aW1lX0EgKSA+IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMCBdICkpICYmIChwYXJzZUludCggdGltZV9BICkgPCBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDEgXSApKSApe1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWVcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIGlmICggKCBwYXJzZUludCggdGltZV9BICkgPT0gcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAwIF0gKSApIHx8ICggcGFyc2VJbnQoIHRpbWVfQSApID09IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMSBdICkgKSApIHtcclxuXHRcdFx0XHQvLyBcdFx0XHQvLyBUaW1lIEEganVzdCAgYXQgIHRoZSBib3JkZXIgb2YgaW50ZXJ2YWxcclxuXHRcdFx0XHQvLyB9XHJcblx0XHRcdH1cclxuXHJcblx0XHQgICAgcmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSXMgdGhlc2UgYXJyYXkgb2YgaW50ZXJ2YWxzIGludGVyc2VjdGVkID9cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9BXHRcdC0gWyBbIDIxNjAwLCAyMzQwMCBdIF1cclxuXHRcdCAqIEBwYXJhbSB0aW1lX2ludGVydmFsX0JcdFx0LSBbICBbIDI1MjExLCAyNzAwMiBdLCBbIDM2MDExLCA4NjQwMCBdICBdXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pc19pbnRlcnNlY3RfX3JhbmdlX3RpbWVfaW50ZXJ2YWwoIHRpbWVfaW50ZXJ2YWxfQSwgdGltZV9pbnRlcnZhbF9CICl7XHJcblxyXG5cdFx0XHR2YXIgaXNfaW50ZXJzZWN0O1xyXG5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgdGltZV9pbnRlcnZhbF9BLmxlbmd0aDsgaSsrICl7XHJcblxyXG5cdFx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfaW50ZXJ2YWxfQi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHdwYmNfaW50ZXJ2YWxzX19pc19pbnRlcnNlY3RlZCggdGltZV9pbnRlcnZhbF9BWyBpIF0sIHRpbWVfaW50ZXJ2YWxfQlsgaiBdICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBpc19pbnRlcnNlY3QgKXtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgYWxsIHRpbWUgZmllbGRzIGluIHRoZSBib29raW5nIGZvcm0gYXMgYXJyYXkgIG9mIG9iamVjdHNcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqIEByZXR1cm5zIFtdXHJcblx0XHQgKlxyXG5cdFx0ICogXHRcdEV4YW1wbGU6XHJcblx0XHQgKiBcdFx0XHRcdFx0W1xyXG5cdFx0ICogXHRcdFx0XHRcdCBcdCAgIHtcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCAtIDA2OjMwJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdCBcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0XHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0ICAgXHRcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHRcdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2dldF9fdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCApe1xyXG5cdFx0ICAgIC8qKlxyXG5cdFx0XHQgKiBGaWVsZHMgd2l0aCAgW10gIGxpa2UgdGhpcyAgIHNlbGVjdFtuYW1lPVwicmFuZ2V0aW1lMVtdXCJdXHJcblx0XHRcdCAqIGl0J3Mgd2hlbiB3ZSBoYXZlICdtdWx0aXBsZScgaW4gc2hvcnRjb2RlOiAgIFtzZWxlY3QqIHJhbmdldGltZSBtdWx0aXBsZSAgXCIwNjowMCAtIDA2OjMwXCIgLi4uIF1cclxuXHRcdFx0ICovXHJcblx0XHRcdHZhciB0aW1lX2ZpZWxkc19hcnI9W1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXSdcclxuXHRcdFx0XHRcdFx0XHRcdF07XHJcblxyXG5cdFx0XHR2YXIgdGltZV9maWVsZHNfb2JqX2FyciA9IFtdO1xyXG5cclxuXHRcdFx0Ly8gTG9vcCBhbGwgVGltZSBGaWVsZHNcclxuXHRcdFx0Zm9yICggdmFyIGN0Zj0gMDsgY3RmIDwgdGltZV9maWVsZHNfYXJyLmxlbmd0aDsgY3RmKysgKXtcclxuXHJcblx0XHRcdFx0dmFyIHRpbWVfZmllbGQgPSB0aW1lX2ZpZWxkc19hcnJbIGN0ZiBdO1xyXG5cdFx0XHRcdHZhciB0aW1lX29wdGlvbiA9IGpRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uJyApO1xyXG5cclxuXHRcdFx0XHQvLyBMb29wIGFsbCBvcHRpb25zIGluIHRpbWUgZmllbGRcclxuXHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX29wdGlvbi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uID0galF1ZXJ5KCB0aW1lX2ZpZWxkICsgJyBvcHRpb246ZXEoJyArIGogKyAnKScgKTtcclxuXHRcdFx0XHRcdHZhciB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIgPSBqcXVlcnlfb3B0aW9uLnZhbCgpLnNwbGl0KCAnLScgKTtcclxuXHRcdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzID0gW107XHJcblxyXG5cdFx0XHRcdFx0Ly8gR2V0IHRpbWUgYXMgc2Vjb25kc1xyXG5cdFx0XHRcdFx0aWYgKCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoICl7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0Ly8gRml4SW46IDEwLjAuMC41Ni5cclxuXHRcdFx0XHRcdFx0XHQvLyB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbaV0gPSAnMTQ6MDAgJyAgfCAnIDE2OjAwJyAgIChpZiBmcm9tICdyYW5nZXRpbWUnKSBhbmQgJzE2OjAwJyAgaWYgKHN0YXJ0L2VuZCB0aW1lKVxyXG5cclxuXHRcdFx0XHRcdFx0XHR2YXIgc3RhcnRfZW5kX3RpbWVzX2FyciA9IHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyclsgaSBdLnRyaW0oKS5zcGxpdCggJzonICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHZhciB0aW1lX2luX3NlY29uZHMgPSBwYXJzZUludCggc3RhcnRfZW5kX3RpbWVzX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDEgXSApICogNjA7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHMucHVzaCggdGltZV9pbl9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyLnB1c2goIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiBqUXVlcnkoIHRpbWVfZmllbGQgKS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiBqcXVlcnlfb3B0aW9uLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IGpxdWVyeV9vcHRpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0aW1lc19hc19zZWNvbmRzJzogdGltZXNfYXNfc2Vjb25kc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRpbWVfZmllbGRzX29ial9hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogRGlzYWJsZSBIVE1MIG9wdGlvbnMgYW5kIGFkZCBib29rZWQgQ1NTIGNsYXNzXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSB0aW1lX2ZpZWxkc19vYmpfYXJyICAgICAgLSB0aGlzIHZhbHVlIGlzIGZyb20gIHRoZSBmdW5jOlxyXG5cdFx0XHQgKiAgICAgXHR3cGJjX2dldF9fdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCApXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRbXHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdFx0ICogXHQgIFx0XHRcdFx0XHRcdCAgICBkaXNhYmxlZCA9IDFcclxuXHRcdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHRcdCAqICAgXHRcdFx0XHRcdFx0XHRkaXNhYmxlZCA9IDBcclxuXHRcdFx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdFx0ICpcclxuXHRcdFx0ICovXHJcblx0XHRcdGZ1bmN0aW9uIHdwYmNfX2h0bWxfX3RpbWVfZmllbGRfb3B0aW9uc19fc2V0X2Rpc2FibGVkKCB0aW1lX2ZpZWxkc19vYmpfYXJyICl7XHJcblxyXG5cdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uO1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aW1lX2ZpZWxkc19vYmpfYXJyLmxlbmd0aDsgaSsrICl7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb24gPSB0aW1lX2ZpZWxkc19vYmpfYXJyWyBpIF0uanF1ZXJ5X29wdGlvbjtcclxuXHJcblx0XHRcdFx0XHRpZiAoIDEgPT0gdGltZV9maWVsZHNfb2JqX2FyclsgaSBdLmRpc2FibGVkICl7XHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApOyBcdFx0Ly8gTWFrZSBkaXNhYmxlIHNvbWUgb3B0aW9uc1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLmFkZENsYXNzKCAnYm9va2VkJyApOyAgICAgICAgICAgXHQvLyBBZGQgXCJib29rZWRcIiBDU1MgY2xhc3NcclxuXHJcblx0XHRcdFx0XHRcdC8vIGlmIHRoaXMgYm9va2VkIGVsZW1lbnQgc2VsZWN0ZWQgLS0+IHRoZW4gZGVzZWxlY3QgIGl0XHJcblx0XHRcdFx0XHRcdGlmICgganF1ZXJ5X29wdGlvbi5wcm9wKCAnc2VsZWN0ZWQnICkgKXtcclxuXHRcdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdzZWxlY3RlZCcsIGZhbHNlICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucGFyZW50KCkuZmluZCggJ29wdGlvbjpub3QoW2Rpc2FibGVkXSk6Zmlyc3QnICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucHJvcCggJ2Rpc2FibGVkJywgZmFsc2UgKTsgIFx0XHQvLyBNYWtlIGFjdGl2ZSBhbGwgdGltZXNcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5yZW1vdmVDbGFzcyggJ2Jvb2tlZCcgKTsgICBcdFx0Ly8gUmVtb3ZlIGNsYXNzIFwiYm9va2VkXCJcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrIGlmIHRoaXMgdGltZV9yYW5nZSB8IFRpbWVfU2xvdCBpcyBGdWxsIERheSAgYm9va2VkXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gdGltZXNsb3RfYXJyX2luX3NlY29uZHNcdFx0LSBbIDM2MDExLCA4NjQwMCBdXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX3RpbWVzbG90X19mdWxsX2RheV9ib29rZWQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHRcdCggdGltZXNsb3RfYXJyX2luX3NlY29uZHMubGVuZ3RoID4gMSApXHJcblx0XHRcdCYmICggcGFyc2VJbnQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzWyAwIF0gKSA8IDMwIClcclxuXHRcdFx0JiYgKCBwYXJzZUludCggdGltZXNsb3RfYXJyX2luX3NlY29uZHNbIDEgXSApID4gICggKDI0ICogNjAgKiA2MCkgLSAzMCkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyogID09ICBTIGUgbCBlIGMgdCBlIGQgICAgRCBhIHQgZSBzICAvICBUIGkgbSBlIC0gRiBpIGUgbCBkIHMgID09XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBhbGwgc2VsZWN0ZWQgZGF0ZXMgaW4gU1FMIGZvcm1hdCBsaWtlIHRoaXMgWyBcIjIwMjMtMDgtMjNcIiwgXCIyMDIzLTA4LTI0XCIgLCAuLi4gXVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge1tdfVx0XHRcdFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiLCBcIjIwMjMtMDgtMjVcIiwgXCIyMDIzLTA4LTI2XCIsIFwiMjAyMy0wOC0yN1wiLCBcIjIwMjMtMDgtMjhcIixcclxuXHQgKiAgICAgXCIyMDIzLTA4LTI5XCIgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHR2YXIgc2VsZWN0ZWRfZGF0ZXNfYXJyID0gW107XHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIgPSBqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCkuc3BsaXQoJywnKTtcclxuXHJcblx0XHRpZiAoIHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGggKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGg7IGkrKyApe1x0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0gPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXS50cmltKCk7XHJcblx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0gPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXS5zcGxpdCggJy4nICk7XHJcblx0XHRcdFx0aWYgKCBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXS5sZW5ndGggPiAxICl7XHJcblx0XHRcdFx0XHRzZWxlY3RlZF9kYXRlc19hcnJbIGkgXSA9IHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdWyAyIF0gKyAnLScgKyBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXVsgMSBdICsgJy0nICsgc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF1bIDAgXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBSZW1vdmUgZW1wdHkgZWxlbWVudHMgZnJvbSBhbiBhcnJheVxyXG5cdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyID0gc2VsZWN0ZWRfZGF0ZXNfYXJyLmZpbHRlciggZnVuY3Rpb24gKCBuICl7IHJldHVybiBwYXJzZUludChuKTsgfSApO1xyXG5cclxuXHRcdHNlbGVjdGVkX2RhdGVzX2Fyci5zb3J0KCk7XHJcblxyXG5cdFx0cmV0dXJuIHNlbGVjdGVkX2RhdGVzX2FycjtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYWxsIHRpbWUgZmllbGRzIGluIHRoZSBib29raW5nIGZvcm0gYXMgYXJyYXkgIG9mIG9iamVjdHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqIEBwYXJhbSBpc19vbmx5X3NlbGVjdGVkX3RpbWVcclxuXHQgKiBAcmV0dXJucyBbXVxyXG5cdCAqXHJcblx0ICogXHRcdEV4YW1wbGU6XHJcblx0ICogXHRcdFx0XHRcdFtcclxuXHQgKiBcdFx0XHRcdFx0IFx0ICAge1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCAtIDA2OjMwJ1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHQgKiBcdFx0XHRcdFx0IFx0ICAgXHRcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdCAqIFx0XHRcdFx0XHQgIC4uLlxyXG5cdCAqIFx0XHRcdFx0XHRcdCAgIHtcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCBdXHJcblx0ICogXHRcdFx0XHRcdFx0ICAgXHRcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdCAqIFx0XHRcdFx0XHQgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X19zZWxlY3RlZF90aW1lX2ZpZWxkc19faW5fYm9va2luZ19mb3JtX19hc19hcnIoIHJlc291cmNlX2lkLCBpc19vbmx5X3NlbGVjdGVkX3RpbWUgPSB0cnVlICl7XHJcblx0XHQvKipcclxuXHRcdCAqIEZpZWxkcyB3aXRoICBbXSAgbGlrZSB0aGlzICAgc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUxW11cIl1cclxuXHRcdCAqIGl0J3Mgd2hlbiB3ZSBoYXZlICdtdWx0aXBsZScgaW4gc2hvcnRjb2RlOiAgIFtzZWxlY3QqIHJhbmdldGltZSBtdWx0aXBsZSAgXCIwNjowMCAtIDA2OjMwXCIgLi4uIF1cclxuXHRcdCAqL1xyXG5cdFx0dmFyIHRpbWVfZmllbGRzX2Fycj1bXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImR1cmF0aW9udGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZHVyYXRpb250aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJ1xyXG5cdFx0XHRcdFx0XHRcdF07XHJcblxyXG5cdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSBbXTtcclxuXHJcblx0XHQvLyBMb29wIGFsbCBUaW1lIEZpZWxkc1xyXG5cdFx0Zm9yICggdmFyIGN0Zj0gMDsgY3RmIDwgdGltZV9maWVsZHNfYXJyLmxlbmd0aDsgY3RmKysgKXtcclxuXHJcblx0XHRcdHZhciB0aW1lX2ZpZWxkID0gdGltZV9maWVsZHNfYXJyWyBjdGYgXTtcclxuXHJcblx0XHRcdHZhciB0aW1lX29wdGlvbjtcclxuXHRcdFx0aWYgKCBpc19vbmx5X3NlbGVjdGVkX3RpbWUgKXtcclxuXHRcdFx0XHR0aW1lX29wdGlvbiA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0aW1lX2ZpZWxkICsgJyBvcHRpb246c2VsZWN0ZWQnICk7XHRcdFx0Ly8gRXhjbHVkZSBjb25kaXRpb25hbCAgZmllbGRzLCAgYmVjYXVzZSBvZiB1c2luZyAnI2Jvb2tpbmdfZm9ybTMgLi4uJ1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRpbWVfb3B0aW9uID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgJyArIHRpbWVfZmllbGQgKyAnIG9wdGlvbicgKTtcdFx0XHRcdC8vIEFsbCAgdGltZSBmaWVsZHNcclxuXHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdC8vIExvb3AgYWxsIG9wdGlvbnMgaW4gdGltZSBmaWVsZFxyXG5cdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX29wdGlvbi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbiA9IGpRdWVyeSggdGltZV9vcHRpb25bIGogXSApO1x0XHQvLyBHZXQgb25seSAgc2VsZWN0ZWQgb3B0aW9ucyBcdC8valF1ZXJ5KCB0aW1lX2ZpZWxkICsgJyBvcHRpb246ZXEoJyArIGogKyAnKScgKTtcclxuXHRcdFx0XHR2YXIgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyID0ganF1ZXJ5X29wdGlvbi52YWwoKS5zcGxpdCggJy0nICk7XHJcblx0XHRcdFx0dmFyIHRpbWVzX2FzX3NlY29uZHMgPSBbXTtcclxuXHJcblx0XHRcdFx0Ly8gR2V0IHRpbWUgYXMgc2Vjb25kc1xyXG5cdFx0XHRcdGlmICggdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aCApe1x0XHRcdFx0IFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41Ni5cclxuXHRcdFx0XHRcdFx0Ly8gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyW2ldID0gJzE0OjAwICcgIHwgJyAxNjowMCcgICAoaWYgZnJvbSAncmFuZ2V0aW1lJykgYW5kICcxNjowMCcgIGlmIChzdGFydC9lbmQgdGltZSlcclxuXHJcblx0XHRcdFx0XHRcdHZhciBzdGFydF9lbmRfdGltZXNfYXJyID0gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyWyBpIF0udHJpbSgpLnNwbGl0KCAnOicgKTtcclxuXHJcblx0XHRcdFx0XHRcdHZhciB0aW1lX2luX3NlY29uZHMgPSBwYXJzZUludCggc3RhcnRfZW5kX3RpbWVzX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDEgXSApICogNjA7XHJcblxyXG5cdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzLnB1c2goIHRpbWVfaW5fc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2Fyci5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgICAgICAgICAgICA6IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0aW1lX2ZpZWxkICkuYXR0ciggJ25hbWUnICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWVfb3B0aW9uXzI0aCc6IGpxdWVyeV9vcHRpb24udmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IGpxdWVyeV9vcHRpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGltZXNfYXNfc2Vjb25kcyc6IHRpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBUZXh0OiAgIFtzdGFydHRpbWVdIC0gW2VuZHRpbWVdIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0dmFyIHRleHRfdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2lucHV0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2lucHV0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRdO1xyXG5cdFx0Zm9yICggdmFyIHRmPSAwOyB0ZiA8IHRleHRfdGltZV9maWVsZHNfYXJyLmxlbmd0aDsgdGYrKyApe1xyXG5cclxuXHRcdFx0dmFyIHRleHRfanF1ZXJ5ID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgJyArIHRleHRfdGltZV9maWVsZHNfYXJyWyB0ZiBdICk7XHRcdFx0XHRcdFx0XHRcdC8vIEV4Y2x1ZGUgY29uZGl0aW9uYWwgIGZpZWxkcywgIGJlY2F1c2Ugb2YgdXNpbmcgJyNib29raW5nX2Zvcm0zIC4uLidcclxuXHRcdFx0aWYgKCB0ZXh0X2pxdWVyeS5sZW5ndGggPiAwICl7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lX19oX21fX2FyciA9IHRleHRfanF1ZXJ5LnZhbCgpLnRyaW0oKS5zcGxpdCggJzonICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcxNDowMCdcclxuXHRcdFx0XHRpZiAoIDAgPT0gdGltZV9faF9tX19hcnIubGVuZ3RoICl7XHJcblx0XHRcdFx0XHRjb250aW51ZTtcdFx0XHRcdFx0XHRcdFx0XHQvLyBOb3QgZW50ZXJlZCB0aW1lIHZhbHVlIGluIGEgZmllbGRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCAxID09IHRpbWVfX2hfbV9fYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdFx0aWYgKCAnJyA9PT0gdGltZV9faF9tX19hcnJbIDAgXSApe1xyXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcdFx0XHRcdFx0XHRcdFx0Ly8gTm90IGVudGVyZWQgdGltZSB2YWx1ZSBpbiBhIGZpZWxkXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR0aW1lX19oX21fX2FyclsgMSBdID0gMDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIHRleHRfdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHRpbWVfX2hfbV9fYXJyWyAwIF0gKSAqIDYwICogNjAgKyBwYXJzZUludCggdGltZV9faF9tX19hcnJbIDEgXSApICogNjA7XHJcblxyXG5cdFx0XHRcdHZhciB0ZXh0X3RpbWVzX2FzX3NlY29uZHMgPSBbXTtcclxuXHRcdFx0XHR0ZXh0X3RpbWVzX2FzX3NlY29uZHMucHVzaCggdGV4dF90aW1lX2luX3NlY29uZHMgKTtcclxuXHJcblx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2Fyci5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgICAgICAgICAgICA6IHRleHRfanF1ZXJ5LmF0dHIoICduYW1lJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiB0ZXh0X2pxdWVyeS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcXVlcnlfb3B0aW9uJyAgIDogdGV4dF9qcXVlcnksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGltZXNfYXNfc2Vjb25kcyc6IHRleHRfdGltZXNfYXNfc2Vjb25kc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aW1lX2ZpZWxkc19vYmpfYXJyO1xyXG5cdH1cclxuXHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgUyBVIFAgUCBPIFIgVCAgICBmb3IgICAgQyBBIEwgRSBOIEQgQSBSICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IENhbGVuZGFyIGRhdGVwaWNrIEluc3RhbmNlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtpbnR8c3RyaW5nfSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QocmVzb3VyY2VfaWQpIHtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHJlc291cmNlX2lkKSApIHtcclxuXHRcdFx0cmVzb3VyY2VfaWQgPSAnMSc7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDAgKSB7XHJcblxyXG5cdFx0XHR0cnkge1xyXG5cdFx0XHRcdHZhciBpbnN0ID0galF1ZXJ5LmRhdGVwaWNrLl9nZXRJbnN0KCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmdldCggMCApICk7XHJcblx0XHRcdFx0cmV0dXJuIGluc3QgPyBpbnN0IDogbnVsbDtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBVbnNlbGVjdCAgYWxsIGRhdGVzIGluIGNhbGVuZGFyIGFuZCB2aXN1YWxseSB1cGRhdGUgdGhpcyBjYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0dHJ1ZSBvbiBzdWNjZXNzIHwgZmFsc2UsICBpZiBubyBzdWNoICBjYWxlbmRhclxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHJlc291cmNlX2lkKSApe1xyXG5cdFx0XHRyZXNvdXJjZV9pZCA9ICcxJztcclxuXHRcdH1cclxuXHJcblx0XHR3cGJjX3JhbmdlX3NlbGVjdGlvbl9faGlkZV9ndWlkYW5jZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApXHJcblxyXG5cdFx0aWYgKCBudWxsICE9PSBpbnN0ICl7XHJcblxyXG5cdFx0XHQvLyBVbnNlbGVjdCBhbGwgZGF0ZXMgYW5kIHNldCAgcHJvcGVydGllcyBvZiBEYXRlcGlja1xyXG5cdFx0XHRqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCAnJyApOyAgICAgIC8vRml4SW46IDUuNC4zXHJcblx0XHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdFx0aW5zdC5kYXRlcyA9IFtdO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBpbnN0ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDbGVhciBkYXlzIGhpZ2hsaWdodGluZyBpbiBBbGwgb3Igc3BlY2lmaWMgQ2FsZW5kYXJzXHJcblx0ICpcclxuICAgICAqIEBwYXJhbSByZXNvdXJjZV9pZCAgLSBjYW4gYmUgc2tpcGVkIHRvICBjbGVhciBoaWdobGlnaHRpbmcgaW4gYWxsIGNhbGVuZGFyc1xyXG4gICAgICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyAuZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICkucmVtb3ZlQ2xhc3MoICdkYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKTtcdFx0Ly8gQ2xlYXIgaW4gc3BlY2lmaWMgY2FsZW5kYXJcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRqUXVlcnkoICcuZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICkucmVtb3ZlQ2xhc3MoICdkYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKTtcdFx0XHRcdFx0XHRcdFx0Ly8gQ2xlYXIgaW4gYWxsIGNhbGVuZGFyc1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU2Nyb2xsIHRvIHNwZWNpZmljIG1vbnRoIGluIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgcmVzb3VyY2VcclxuXHQgKiBAcGFyYW0geWVhclx0XHRcdFx0LSByZWFsIHllYXIgIC0gMjAyM1xyXG5cdCAqIEBwYXJhbSBtb250aFx0XHRcdFx0LSByZWFsIG1vbnRoIC0gMTJcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCB5ZWFyLCBtb250aCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7IHJlc291cmNlX2lkID0gJzEnOyB9XHJcblx0XHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApXHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHRcdHllYXIgID0gcGFyc2VJbnQoIHllYXIgKTtcclxuXHRcdFx0bW9udGggPSBwYXJzZUludCggbW9udGggKSAtIDE7XHRcdC8vIEluIEpTIGRhdGUsICBtb250aCAtMVxyXG5cclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlID0gbmV3IERhdGUoKTtcclxuXHRcdFx0Ly8gSW4gc29tZSBjYXNlcywgIHRoZSBzZXRGdWxsWWVhciBjYW4gIHNldCAgb25seSBZZWFyLCAgYW5kIG5vdCB0aGUgTW9udGggYW5kIGRheSAgICAgIC8vIEZpeEluOiA2LjIuMy41LlxyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUuc2V0RnVsbFllYXIoIHllYXIsIG1vbnRoLCAxICk7XHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZS5zZXRNb250aCggbW9udGggKTtcclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlLnNldERhdGUoIDEgKTtcclxuXHJcblx0XHRcdGluc3QuZHJhd01vbnRoID0gaW5zdC5jdXJzb3JEYXRlLmdldE1vbnRoKCk7XHJcblx0XHRcdGluc3QuZHJhd1llYXIgPSBpbnN0LmN1cnNvckRhdGUuZ2V0RnVsbFllYXIoKTtcclxuXHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fbm90aWZ5Q2hhbmdlKCBpbnN0ICk7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fYWRqdXN0SW5zdERhdGUoIGluc3QgKTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zaG93RGF0ZSggaW5zdCApO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBpbnN0ICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIElzIHRoaXMgZGF0ZSBzZWxlY3RhYmxlIGluIGNhbGVuZGFyIChtYWlubHkgaXQncyBtZWFucyBBVkFJTEFCTEUgZGF0ZSlcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7aW50fHN0cmluZ30gcmVzb3VyY2VfaWRcdFx0MVxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzcWxfY2xhc3NfZGF5XHRcdCcyMDIzLTA4LTExJ1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVx0XHRcdFx0XHR0cnVlIHwgZmFsc2VcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2lzX3RoaXNfZGF5X3NlbGVjdGFibGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICl7XHJcblxyXG5cdFx0Ly8gR2V0IERhdGEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBkYXRlX2Jvb2tpbmdzX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHJcblx0XHRpZiAoICEgZGF0ZV9ib29raW5nc19vYmogfHwgJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGlzX2RheV9zZWxlY3RhYmxlID0gKCBwYXJzZUludCggZGF0ZV9ib29raW5nc19vYmpbICdkYXlfYXZhaWxhYmlsaXR5JyBdICkgPiAwICk7XHJcblxyXG5cdFx0aWYgKCB0eXBlb2YgKGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXSkgPT09ICd1bmRlZmluZWQnICl7XHJcblx0XHRcdHJldHVybiBpc19kYXlfc2VsZWN0YWJsZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICdhdmFpbGFibGUnICE9IGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSApe1xyXG5cclxuXHRcdFx0dmFyIGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncGVuZGluZ19kYXlzX3NlbGVjdGFibGUnICk7XHRcdC8vIHNldCBwZW5kaW5nIGRheXMgc2VsZWN0YWJsZSAgICAgICAgICAvLyBGaXhJbjogOC42LjEuMTguXHJcblx0XHRcdHZhciBib29raW5nX3N0YXR1c2VzX2FyciA9IHdwYmNfZ2V0X2Jvb2tpbmdfc3RhdHVzZXNfX2FzX2FyciggZGF0ZV9ib29raW5nc19vYmogKTtcclxuXHJcblx0XHRcdGlmIChcclxuXHRcdFx0XHQgICAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmcnICkgKVxyXG5cdFx0XHRcdHx8ICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAncGVuZGluZ19wZW5kaW5nJyApIClcclxuXHRcdFx0XHR8fCAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfYXBwcm92ZWQnICkgKVxyXG5cdFx0XHRcdHx8ICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAnYXBwcm92ZWRfcGVuZGluZycgKSApXHJcblx0XHRcdCl7XHJcblx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBpc19kYXlfc2VsZWN0YWJsZTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIElzIGRhdGUgdG8gY2hlY2sgSU4gYXJyYXkgb2Ygc2VsZWN0ZWQgZGF0ZXNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7ZGF0ZX1qc19kYXRlX3RvX2NoZWNrXHRcdC0gSlMgRGF0ZVx0XHRcdC0gc2ltcGxlICBKYXZhU2NyaXB0IERhdGUgb2JqZWN0XHJcblx0ICogQHBhcmFtIHtbXX0ganNfZGF0ZXNfYXJyXHRcdFx0LSBbIEpTRGF0ZSwgLi4uIF0gICAtIGFycmF5ICBvZiBKUyBkYXRlc1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc19kYXlfYW1vbmdfc2VsZWN0ZWRfZGF5cygganNfZGF0ZV90b19jaGVjaywganNfZGF0ZXNfYXJyICl7XHJcblxyXG5cdFx0Zm9yICggdmFyIGRhdGVfaW5kZXggPSAwOyBkYXRlX2luZGV4IDwganNfZGF0ZXNfYXJyLmxlbmd0aCA7IGRhdGVfaW5kZXgrKyApeyAgICAgXHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDguNC41LjE2LlxyXG5cdFx0XHRpZiAoICgganNfZGF0ZXNfYXJyWyBkYXRlX2luZGV4IF0uZ2V0RnVsbFllYXIoKSA9PT0ganNfZGF0ZV90b19jaGVjay5nZXRGdWxsWWVhcigpICkgJiZcclxuXHRcdFx0XHQgKCBqc19kYXRlc19hcnJbIGRhdGVfaW5kZXggXS5nZXRNb250aCgpID09PSBqc19kYXRlX3RvX2NoZWNrLmdldE1vbnRoKCkgKSAmJlxyXG5cdFx0XHRcdCAoIGpzX2RhdGVzX2FyclsgZGF0ZV9pbmRleCBdLmdldERhdGUoKSA9PT0ganNfZGF0ZV90b19jaGVjay5nZXREYXRlKCkgKSApIHtcclxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBTUUwgQ2xhc3MgRGF0ZSAnMjAyMy0wOC0wMScgZnJvbSAgSlMgRGF0ZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdEpTIERhdGVcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVx0XHQnMjAyMy0wOC0xMidcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlICl7XHJcblxyXG5cdFx0dmFyIHNxbF9jbGFzc19kYXkgPSBkYXRlLmdldEZ1bGxZZWFyKCkgKyAnLSc7XHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gKCAoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSA8IDEwICkgPyAnMCcgOiAnJztcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSAoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICctJ1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9ICggZGF0ZS5nZXREYXRlKCkgPCAxMCApID8gJzAnIDogJyc7XHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gZGF0ZS5nZXREYXRlKCk7XHJcblxyXG5cdFx0XHRyZXR1cm4gc3FsX2NsYXNzX2RheTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBKUyBEYXRlIGZyb20gIHRoZSBTUUwgZGF0ZSBmb3JtYXQgJzIwMjQtMDUtMTQnXHJcblx0ICogQHBhcmFtIHNxbF9jbGFzc19kYXRlXHJcblx0ICogQHJldHVybnMge0RhdGV9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X19qc19kYXRlKCBzcWxfY2xhc3NfZGF0ZSApe1xyXG5cclxuXHRcdHZhciBzcWxfY2xhc3NfZGF0ZV9hcnIgPSBzcWxfY2xhc3NfZGF0ZS5zcGxpdCggJy0nICk7XHJcblxyXG5cdFx0dmFyIGRhdGVfanMgPSBuZXcgRGF0ZSgpO1xyXG5cclxuXHRcdGRhdGVfanMuc2V0RnVsbFllYXIoIHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDAgXSApLCAocGFyc2VJbnQoIHNxbF9jbGFzc19kYXRlX2FyclsgMSBdICkgLSAxKSwgcGFyc2VJbnQoIHNxbF9jbGFzc19kYXRlX2FyclsgMiBdICkgKTsgIC8vIHllYXIsIG1vbnRoLCBkYXRlXHJcblxyXG5cdFx0Ly8gV2l0aG91dCB0aGlzIHRpbWUgYWRqdXN0IERhdGVzIHNlbGVjdGlvbiAgaW4gRGF0ZXBpY2tlciBjYW4gbm90IHdvcmshISFcclxuXHRcdGRhdGVfanMuc2V0SG91cnMoMCk7XHJcblx0XHRkYXRlX2pzLnNldE1pbnV0ZXMoMCk7XHJcblx0XHRkYXRlX2pzLnNldFNlY29uZHMoMCk7XHJcblx0XHRkYXRlX2pzLnNldE1pbGxpc2Vjb25kcygwKTtcclxuXHJcblx0XHRyZXR1cm4gZGF0ZV9qcztcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBURCBDbGFzcyBEYXRlICcxLTMxLTIwMjMnIGZyb20gIEpTIERhdGVcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRKUyBEYXRlXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cdFx0JzEtMzEtMjAyMydcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKXtcclxuXHJcblx0XHR2YXIgdGRfY2xhc3NfZGF5ID0gKGRhdGUuZ2V0TW9udGgoKSArIDEpICsgJy0nICsgZGF0ZS5nZXREYXRlKCkgKyAnLScgKyBkYXRlLmdldEZ1bGxZZWFyKCk7XHRcdFx0XHRcdFx0XHRcdC8vICcxLTktMjAyMydcclxuXHJcblx0XHRyZXR1cm4gdGRfY2xhc3NfZGF5O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGRhdGUgcGFyYW1zIGZyb20gIHN0cmluZyBkYXRlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdHN0cmluZyBkYXRlIGxpa2UgJzMxLjUuMjAyMydcclxuXHQgKiBAcGFyYW0gc2VwYXJhdG9yXHRcdGRlZmF1bHQgJy4nICBjYW4gYmUgc2tpcHBlZC5cclxuXHQgKiBAcmV0dXJucyB7ICB7ZGF0ZTogbnVtYmVyLCBtb250aDogbnVtYmVyLCB5ZWFyOiBudW1iZXJ9ICB9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X19kYXRlX3BhcmFtc19fZnJvbV9zdHJpbmdfZGF0ZSggZGF0ZSAsIHNlcGFyYXRvcil7XHJcblxyXG5cdFx0c2VwYXJhdG9yID0gKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChzZXBhcmF0b3IpICkgPyBzZXBhcmF0b3IgOiAnLic7XHJcblxyXG5cdFx0dmFyIGRhdGVfYXJyID0gZGF0ZS5zcGxpdCggc2VwYXJhdG9yICk7XHJcblx0XHR2YXIgZGF0ZV9vYmogPSB7XHJcblx0XHRcdCd5ZWFyJyA6ICBwYXJzZUludCggZGF0ZV9hcnJbIDIgXSApLFxyXG5cdFx0XHQnbW9udGgnOiAocGFyc2VJbnQoIGRhdGVfYXJyWyAxIF0gKSAtIDEpLFxyXG5cdFx0XHQnZGF0ZScgOiAgcGFyc2VJbnQoIGRhdGVfYXJyWyAwIF0gKVxyXG5cdFx0fTtcclxuXHRcdHJldHVybiBkYXRlX29iajtcdFx0Ly8gZm9yIFx0XHQgPSBuZXcgRGF0ZSggZGF0ZV9vYmoueWVhciAsIGRhdGVfb2JqLm1vbnRoICwgZGF0ZV9vYmouZGF0ZSApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQWRkIFNwaW4gTG9hZGVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0YXJ0KCByZXNvdXJjZV9pZCApe1xyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkubmV4dCgpLmhhc0NsYXNzKCAnd3BiY19zcGluc19sb2FkZXJfd3JhcHBlcicgKSApe1xyXG5cdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmFmdGVyKCAnPGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXJcIj48ZGl2IGNsYXNzPVwid3BiY19zcGluX2xvYWRlcl9vbmVfbmV3XCI+PC9kaXY+PC9kaXY+JyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZGRDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cl9zbWFsbCcgKTtcclxuXHRcdH1cclxuXHRcdHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0YXJ0KCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIFNwaW4gTG9hZGVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgKyAud3BiY19zcGluc19sb2FkZXJfd3JhcHBlcicgKS5yZW1vdmUoKTtcclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICk7XHJcblx0XHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdG9wKCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQWRkIEJsdXIgdG8gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fYmx1cl9fc3RhcnQoIHJlc291cmNlX2lkICl7XHJcblx0XHRpZiAoICEgalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5oYXNDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cicgKSApe1xyXG5cdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmFkZENsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIEJsdXIgaW4gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcmVzb3VyY2VfaWQgKXtcclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXInICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHQvKiAgPT0gIENhbGVuZGFyIFVwZGF0ZSAgLSBWaWV3ICA9PVxyXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZSBsb29rIG9mIGNhbGVuZGFyIChzYWZlKS5cclxuXHQgKlxyXG5cdCAqIEluIEVsZW1lbnRvciBwcmV2aWV3IHRoZSBET00gY2FuIGJlIHJlLXJlbmRlcmVkLCBzbyB0aGUgY2FsZW5kYXIgZWxlbWVudCBtYXkgZXhpc3RcclxuXHQgKiB3aGlsZSB0aGUgRGF0ZXBpY2sgaW5zdGFuY2UgaXMgbWlzc2luZy4gSW4gdGhhdCBjYXNlIHRyeSB0byAocmUpaW5pdGlhbGl6ZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7aW50fHN0cmluZ30gcmVzb3VyY2VfaWRcclxuXHQgKiBAcmV0dXJuIHtib29sZWFufSB0cnVlIGlmIHVwZGF0ZWQsIGZhbHNlIGlmIG5vdCBwb3NzaWJsZVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKHJlc291cmNlX2lkKSB7XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyBJZiBpbnN0YW5jZSBtaXNzaW5nLCB0cnkgdG8gcmUtaW5pdCBjYWxlbmRhciBvbmNlLlxyXG5cdFx0aWYgKCBudWxsID09PSBpbnN0ICkge1xyXG5cclxuXHRcdFx0dmFyIGpxX2NhbCA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0XHRpZiAoIGpxX2NhbC5sZW5ndGggJiYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX2NhbGVuZGFyX3Nob3cpICkge1xyXG5cclxuXHRcdFx0XHQvLyBFbGVtZW50b3Igc29tZXRpbWVzIGxlYXZlcyBzdGFsZSBjbGFzcyB3aXRob3V0IHJlYWwgaW5zdGFuY2UuXHJcblx0XHRcdFx0aWYgKCBqcV9jYWwuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKSApIHtcclxuXHRcdFx0XHRcdGpxX2NhbC5yZW1vdmVDbGFzcyggJ2hhc0RhdGVwaWNrJyApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gVHJ5IHRvIGluaXQgZGF0ZXBpY2sgbWFya3VwIG5vdy5cclxuXHRcdFx0XHR3cGJjX2NhbGVuZGFyX3Nob3coIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0XHRcdC8vIFRyeSBhZ2Fpbi5cclxuXHRcdFx0XHRpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBTdGlsbCBubyBpbnN0YW5jZSAtPiBkbyBub3QgY3Jhc2ggdGhlIHdob2xlIGFqYXggZmxvdy5cclxuXHRcdGlmICggbnVsbCA9PT0gaW5zdCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGUgZHluYW1pY2FsbHkgTnVtYmVyIG9mIE1vbnRocyBpbiBjYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkIGludFxyXG5cdCAqIEBwYXJhbSBtb250aHNfbnVtYmVyIGludFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9tb250aHNfbnVtYmVyKCByZXNvdXJjZV9pZCwgbW9udGhzX251bWJlciApe1xyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHRcdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cdFx0XHRpbnN0LnNldHRpbmdzWyAnbnVtYmVyT2ZNb250aHMnIF0gPSBtb250aHNfbnVtYmVyO1xyXG5cdFx0XHQvL193cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycsIG1vbnRoc19udW1iZXIgKTtcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fdXBkYXRlX2xvb2soIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2hvdyBjYWxlbmRhciBpbiAgZGlmZmVyZW50IFNraW5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBzZWxlY3RlZF9za2luX3VybFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2NhbGVuZGFyX19jaGFuZ2Vfc2tpbiggc2VsZWN0ZWRfc2tpbl91cmwgKXtcclxuXHJcblx0Ly9jb25zb2xlLmxvZyggJ1NLSU4gU0VMRUNUSU9OIDo6Jywgc2VsZWN0ZWRfc2tpbl91cmwgKTtcclxuXHJcblx0XHQvLyBSZW1vdmUgQ1NTIHNraW5cclxuXHRcdHZhciBzdHlsZXNoZWV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGJjLWNhbGVuZGFyLXNraW4tY3NzJyApO1xyXG5cdFx0c3R5bGVzaGVldC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBzdHlsZXNoZWV0ICk7XHJcblxyXG5cclxuXHRcdC8vIEFkZCBuZXcgQ1NTIHNraW5cclxuXHRcdHZhciBoZWFkSUQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSggXCJoZWFkXCIgKVsgMCBdO1xyXG5cdFx0dmFyIGNzc05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGluaycgKTtcclxuXHRcdGNzc05vZGUudHlwZSA9ICd0ZXh0L2Nzcyc7XHJcblx0XHRjc3NOb2RlLnNldEF0dHJpYnV0ZSggXCJpZFwiLCBcIndwYmMtY2FsZW5kYXItc2tpbi1jc3NcIiApO1xyXG5cdFx0Y3NzTm9kZS5yZWwgPSAnc3R5bGVzaGVldCc7XHJcblx0XHRjc3NOb2RlLm1lZGlhID0gJ3NjcmVlbic7XHJcblx0XHRjc3NOb2RlLmhyZWYgPSBzZWxlY3RlZF9za2luX3VybDtcdC8vXCJodHRwOi8vYmV0YS93cC1jb250ZW50L3BsdWdpbnMvYm9va2luZy9jc3Mvc2tpbnMvZ3JlZW4tMDEuY3NzXCI7XHJcblx0XHRoZWFkSUQuYXBwZW5kQ2hpbGQoIGNzc05vZGUgKTtcclxuXHR9XHJcblxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX19jc3NfX2NoYW5nZV9za2luKCBzZWxlY3RlZF9za2luX3VybCwgc3R5bGVzaGVldF9pZCA9ICd3cGJjLXRpbWVfcGlja2VyLXNraW4tY3NzJyApe1xyXG5cclxuXHRcdC8vIFJlbW92ZSBDU1Mgc2tpblxyXG5cdFx0dmFyIHN0eWxlc2hlZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggc3R5bGVzaGVldF9pZCApO1xyXG5cdFx0c3R5bGVzaGVldC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBzdHlsZXNoZWV0ICk7XHJcblxyXG5cclxuXHRcdC8vIEFkZCBuZXcgQ1NTIHNraW5cclxuXHRcdHZhciBoZWFkSUQgPSBkb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSggXCJoZWFkXCIgKVsgMCBdO1xyXG5cdFx0dmFyIGNzc05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnbGluaycgKTtcclxuXHRcdGNzc05vZGUudHlwZSA9ICd0ZXh0L2Nzcyc7XHJcblx0XHRjc3NOb2RlLnNldEF0dHJpYnV0ZSggXCJpZFwiLCBzdHlsZXNoZWV0X2lkICk7XHJcblx0XHRjc3NOb2RlLnJlbCA9ICdzdHlsZXNoZWV0JztcclxuXHRcdGNzc05vZGUubWVkaWEgPSAnc2NyZWVuJztcclxuXHRcdGNzc05vZGUuaHJlZiA9IHNlbGVjdGVkX3NraW5fdXJsO1x0Ly9cImh0dHA6Ly9iZXRhL3dwLWNvbnRlbnQvcGx1Z2lucy9ib29raW5nL2Nzcy9za2lucy9ncmVlbi0wMS5jc3NcIjtcclxuXHRcdGhlYWRJRC5hcHBlbmRDaGlsZCggY3NzTm9kZSApO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBTIFUgUCBQIE8gUiBUICAgIE0gQSBUIEggID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTWVyZ2Ugc2V2ZXJhbCAgaW50ZXJzZWN0ZWQgaW50ZXJ2YWxzIG9yIHJldHVybiBub3QgaW50ZXJzZWN0ZWQ6XHJcblx0XHQgKiBbWzEsM10sWzIsNl0sWzgsMTBdLFsxNSwxOF1dICAtPiAgIFtbMSw2XSxbOCwxMF0sWzE1LDE4XV1cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gW10gaW50ZXJ2YWxzXHRcdFx0IFsgWzEsM10sWzIsNF0sWzYsOF0sWzksMTBdLFszLDddIF1cclxuXHRcdCAqIEByZXR1cm5zIFtdXHRcdFx0XHRcdCBbIFsxLDhdLFs5LDEwXSBdXHJcblx0XHQgKlxyXG5cdFx0ICogRXhtYW1wbGU6IHdwYmNfaW50ZXJ2YWxzX19tZXJnZV9pbmVyc2VjdGVkKCAgWyBbMSwzXSxbMiw0XSxbNiw4XSxbOSwxMF0sWzMsN10gXSAgKTtcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pbnRlcnZhbHNfX21lcmdlX2luZXJzZWN0ZWQoIGludGVydmFscyApe1xyXG5cclxuXHRcdFx0aWYgKCAhIGludGVydmFscyB8fCBpbnRlcnZhbHMubGVuZ3RoID09PSAwICl7XHJcblx0XHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgbWVyZ2VkID0gW107XHJcblx0XHRcdGludGVydmFscy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKXtcclxuXHRcdFx0XHRyZXR1cm4gYVsgMCBdIC0gYlsgMCBdO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHR2YXIgbWVyZ2VkSW50ZXJ2YWwgPSBpbnRlcnZhbHNbIDAgXTtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMTsgaSA8IGludGVydmFscy5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRcdHZhciBpbnRlcnZhbCA9IGludGVydmFsc1sgaSBdO1xyXG5cclxuXHRcdFx0XHRpZiAoIGludGVydmFsWyAwIF0gPD0gbWVyZ2VkSW50ZXJ2YWxbIDEgXSApe1xyXG5cdFx0XHRcdFx0bWVyZ2VkSW50ZXJ2YWxbIDEgXSA9IE1hdGgubWF4KCBtZXJnZWRJbnRlcnZhbFsgMSBdLCBpbnRlcnZhbFsgMSBdICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG1lcmdlZC5wdXNoKCBtZXJnZWRJbnRlcnZhbCApO1xyXG5cdFx0XHRcdFx0bWVyZ2VkSW50ZXJ2YWwgPSBpbnRlcnZhbDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG1lcmdlZC5wdXNoKCBtZXJnZWRJbnRlcnZhbCApO1xyXG5cdFx0XHRyZXR1cm4gbWVyZ2VkO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIDIgaW50ZXJ2YWxzIGludGVyc2VjdGVkOiAgICAgICBbMzYwMTEsIDg2MzkyXSAgICA8PT4gICAgWzEsIDQzMTkyXSAgPT4gIHRydWUgICAgICAoIGludGVyc2VjdGVkIClcclxuXHRcdCAqXHJcblx0XHQgKiBHb29kIGV4cGxhbmF0aW9uICBoZXJlXHJcblx0XHQgKiBodHRwczovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zMjY5NDM0L3doYXRzLXRoZS1tb3N0LWVmZmljaWVudC13YXktdG8tdGVzdC1pZi10d28tcmFuZ2VzLW92ZXJsYXBcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gIGludGVydmFsX0EgICAtIFsgMzYwMTEsIDg2MzkyIF1cclxuXHRcdCAqIEBwYXJhbSAgaW50ZXJ2YWxfQiAgIC0gWyAgICAgMSwgNDMxOTIgXVxyXG5cdFx0ICpcclxuXHRcdCAqIEByZXR1cm4gYm9vbFxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2ludGVydmFsc19faXNfaW50ZXJzZWN0ZWQoIGludGVydmFsX0EsIGludGVydmFsX0IgKSB7XHJcblxyXG5cdFx0XHRpZiAoXHJcblx0XHRcdFx0XHQoIDAgPT0gaW50ZXJ2YWxfQS5sZW5ndGggKVxyXG5cdFx0XHRcdCB8fCAoIDAgPT0gaW50ZXJ2YWxfQi5sZW5ndGggKVxyXG5cdFx0XHQpe1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aW50ZXJ2YWxfQVsgMCBdID0gcGFyc2VJbnQoIGludGVydmFsX0FbIDAgXSApO1xyXG5cdFx0XHRpbnRlcnZhbF9BWyAxIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQVsgMSBdICk7XHJcblx0XHRcdGludGVydmFsX0JbIDAgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9CWyAwIF0gKTtcclxuXHRcdFx0aW50ZXJ2YWxfQlsgMSBdID0gcGFyc2VJbnQoIGludGVydmFsX0JbIDEgXSApO1xyXG5cclxuXHRcdFx0dmFyIGlzX2ludGVyc2VjdGVkID0gTWF0aC5tYXgoIGludGVydmFsX0FbIDAgXSwgaW50ZXJ2YWxfQlsgMCBdICkgLSBNYXRoLm1pbiggaW50ZXJ2YWxfQVsgMSBdLCBpbnRlcnZhbF9CWyAxIF0gKTtcclxuXHJcblx0XHRcdC8vIGlmICggMCA9PSBpc19pbnRlcnNlY3RlZCApIHtcclxuXHRcdFx0Ly9cdCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFN1Y2ggcmFuZ2VzIGdvaW5nIG9uZSBhZnRlciBvdGhlciwgZS5nLjogWyAxMiwgMTUgXSBhbmQgWyAxNSwgMjEgXVxyXG5cdFx0XHQvLyB9XHJcblxyXG5cdFx0XHRpZiAoIGlzX2ludGVyc2VjdGVkIDwgMCApIHtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgICAgICAgICAgICAgICAgICAgICAvLyBJTlRFUlNFQ1RFRFxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7ICAgICAgICAgICAgICAgICAgICAgICAvLyBOb3QgaW50ZXJzZWN0ZWRcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgdGhlIGNsb3NldHMgQUJTIHZhbHVlIG9mIGVsZW1lbnQgaW4gYXJyYXkgdG8gdGhlIGN1cnJlbnQgbXlWYWx1ZVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBteVZhbHVlIFx0LSBpbnQgZWxlbWVudCB0byBzZWFyY2ggY2xvc2V0IFx0XHRcdDRcclxuXHRcdCAqIEBwYXJhbSBteUFycmF5XHQtIGFycmF5IG9mIGVsZW1lbnRzIHdoZXJlIHRvIHNlYXJjaCBcdFs1LDgsMSw3XVxyXG5cdFx0ICogQHJldHVybnMgaW50XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0NVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2dldF9hYnNfY2xvc2VzdF92YWx1ZV9pbl9hcnIoIG15VmFsdWUsIG15QXJyYXkgKXtcclxuXHJcblx0XHRcdGlmICggbXlBcnJheS5sZW5ndGggPT0gMCApeyBcdFx0XHRcdFx0XHRcdFx0Ly8gSWYgdGhlIGFycmF5IGlzIGVtcHR5IC0+IHJldHVybiAgdGhlIG15VmFsdWVcclxuXHRcdFx0XHRyZXR1cm4gbXlWYWx1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIG9iaiA9IG15QXJyYXlbIDAgXTtcclxuXHRcdFx0dmFyIGRpZmYgPSBNYXRoLmFicyggbXlWYWx1ZSAtIG9iaiApOyAgICAgICAgICAgICBcdC8vIEdldCBkaXN0YW5jZSBiZXR3ZWVuICAxc3QgZWxlbWVudFxyXG5cdFx0XHR2YXIgY2xvc2V0VmFsdWUgPSBteUFycmF5WyAwIF07ICAgICAgICAgICAgICAgICAgIFx0XHRcdC8vIFNhdmUgMXN0IGVsZW1lbnRcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMTsgaSA8IG15QXJyYXkubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0XHRvYmogPSBteUFycmF5WyBpIF07XHJcblxyXG5cdFx0XHRcdGlmICggTWF0aC5hYnMoIG15VmFsdWUgLSBvYmogKSA8IGRpZmYgKXsgICAgIFx0XHRcdC8vIHdlIGZvdW5kIGNsb3NlciB2YWx1ZSAtPiBzYXZlIGl0XHJcblx0XHRcdFx0XHRkaWZmID0gTWF0aC5hYnMoIG15VmFsdWUgLSBvYmogKTtcclxuXHRcdFx0XHRcdGNsb3NldFZhbHVlID0gb2JqO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGNsb3NldFZhbHVlO1xyXG5cdFx0fVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIFQgTyBPIEwgVCBJIFAgUyAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIERlZmluZSB0b29sdGlwIHRvIHNob3csICB3aGVuICBtb3VzZSBvdmVyIERhdGUgaW4gQ2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSAgdG9vbHRpcF90ZXh0XHRcdFx0LSBUZXh0IHRvIHNob3dcdFx0XHRcdCdCb29rZWQgdGltZTogMTI6MDAgLSAxMzowMDxicj5Db3N0OiAkMjAuMDAnXHJcblx0ICogQHBhcmFtICByZXNvdXJjZV9pZFx0XHRcdC0gSUQgb2YgYm9va2luZyByZXNvdXJjZVx0JzEnXHJcblx0ICogQHBhcmFtICB0ZF9jbGFzc1x0XHRcdFx0LSBTUUwgY2xhc3NcdFx0XHRcdFx0JzEtOS0yMDIzJ1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVx0XHRcdFx0XHQtIGRlZmluZWQgdG8gc2hvdyBvciBub3RcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3NldF90b29sdGlwX19fZm9yX19jYWxlbmRhcl9kYXRlKCB0b29sdGlwX3RleHQsIHJlc291cmNlX2lkLCB0ZF9jbGFzcyApe1xyXG5cclxuXHRcdC8vVE9ETzogbWFrZSBlc2NhcGluZyBvZiB0ZXh0IGZvciBxdW90IHN5bWJvbHMsICBhbmQgSlMvSFRNTC4uLlxyXG5cclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKS5hdHRyKCAnZGF0YS1jb250ZW50JywgdG9vbHRpcF90ZXh0ICk7XHJcblxyXG5cdFx0dmFyIHRkX2VsID0galF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIHRkLmNhbDRkYXRlLScgKyB0ZF9jbGFzcyApLmdldCggMCApO1x0XHRcdFx0XHQvLyBGaXhJbjogOS4wLjEuMS5cclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZih0ZF9lbCkgKVxyXG5cdFx0XHQmJiAoIHVuZGVmaW5lZCA9PSB0ZF9lbC5fdGlwcHkgKVxyXG5cdFx0XHQmJiAoICcnICE9PSB0b29sdGlwX3RleHQgKVxyXG5cdFx0KXtcclxuXHJcblx0XHRcdHdwYmNfdGlwcHkoIHRkX2VsICwge1xyXG5cdFx0XHRcdFx0Y29udGVudCggcmVmZXJlbmNlICl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgcG9wb3Zlcl9jb250ZW50ID0gcmVmZXJlbmNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29udGVudCcgKTtcclxuXHJcblx0XHRcdFx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cInBvcG92ZXIgcG9wb3Zlcl90aXBweVwiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0KyAnPGRpdiBjbGFzcz1cInBvcG92ZXItY29udGVudFwiPidcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHQrIHBvcG92ZXJfY29udGVudFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQrICc8L2Rpdj4nXHJcblx0XHRcdFx0XHRcdFx0ICsgJzwvZGl2Pic7XHJcblx0XHRcdFx0XHR9LFxyXG5cdFx0XHRcdFx0YWxsb3dIVE1MICAgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHR0cmlnZ2VyXHRcdFx0IDogJ21vdXNlZW50ZXIgZm9jdXMnLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmUgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdFx0aGlkZU9uQ2xpY2sgICAgICA6IHRydWUsXHJcblx0XHRcdFx0XHRpbnRlcmFjdGl2ZUJvcmRlcjogMTAsXHJcblx0XHRcdFx0XHRtYXhXaWR0aCAgICAgICAgIDogNTUwLFxyXG5cdFx0XHRcdFx0dGhlbWUgICAgICAgICAgICA6ICd3cGJjLXRpcHB5LXRpbWVzJyxcclxuXHRcdFx0XHRcdHBsYWNlbWVudCAgICAgICAgOiAndG9wJyxcclxuXHRcdFx0XHRcdGRlbGF5XHRcdFx0IDogWzQwMCwgMF0sXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuNC4yLjIuXHJcblx0XHRcdFx0XHQvL2RlbGF5XHRcdFx0IDogWzAsIDk5OTk5OTk5OTldLFx0XHRcdFx0XHRcdC8vIERlYnVnZSAgdG9vbHRpcFxyXG5cdFx0XHRcdFx0aWdub3JlQXR0cmlidXRlcyA6IHRydWUsXHJcblx0XHRcdFx0XHR0b3VjaFx0XHRcdCA6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vWydob2xkJywgNTAwXSwgLy8gNTAwbXMgZGVsYXlcdFx0XHRcdC8vIEZpeEluOiA5LjIuMS41LlxyXG5cdFx0XHRcdFx0YXBwZW5kVG86ICgpID0+IGRvY3VtZW50LmJvZHksXHJcblx0XHRcdH0pO1xyXG5cclxuXHRcdFx0cmV0dXJuICB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAgZmFsc2U7XHJcblx0fVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIERhdGVzIEZ1bmN0aW9ucyAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogR2V0IG51bWJlciBvZiBkYXRlcyBiZXR3ZWVuIDIgSlMgRGF0ZXNcclxuICpcclxuICogQHBhcmFtIGRhdGUxXHRcdEpTIERhdGVcclxuICogQHBhcmFtIGRhdGUyXHRcdEpTIERhdGVcclxuICogQHJldHVybnMge251bWJlcn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGF0ZXNfX2RheXNfYmV0d2VlbihkYXRlMSwgZGF0ZTIpIHtcclxuXHJcbiAgICAvLyBUaGUgbnVtYmVyIG9mIG1pbGxpc2Vjb25kcyBpbiBvbmUgZGF5XHJcbiAgICB2YXIgT05FX0RBWSA9IDEwMDAgKiA2MCAqIDYwICogMjQ7XHJcblxyXG4gICAgLy8gQ29udmVydCBib3RoIGRhdGVzIHRvIG1pbGxpc2Vjb25kc1xyXG4gICAgdmFyIGRhdGUxX21zID0gZGF0ZTEuZ2V0VGltZSgpO1xyXG4gICAgdmFyIGRhdGUyX21zID0gZGF0ZTIuZ2V0VGltZSgpO1xyXG5cclxuICAgIC8vIENhbGN1bGF0ZSB0aGUgZGlmZmVyZW5jZSBpbiBtaWxsaXNlY29uZHNcclxuICAgIHZhciBkaWZmZXJlbmNlX21zID0gIGRhdGUxX21zIC0gZGF0ZTJfbXM7XHJcblxyXG4gICAgLy8gQ29udmVydCBiYWNrIHRvIGRheXMgYW5kIHJldHVyblxyXG4gICAgcmV0dXJuIE1hdGgucm91bmQoZGlmZmVyZW5jZV9tcy9PTkVfREFZKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBDaGVjayAgaWYgdGhpcyBhcnJheSAgb2YgZGF0ZXMgaXMgY29uc2VjdXRpdmUgYXJyYXkgIG9mIGRhdGVzIG9yIG5vdC5cclxuICogXHRcdGUuZy4gIFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ10gLT4gZmFsc2VcclxuICogXHRcdGUuZy4gIFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTAnLCcyMDI0LTA1LTExJ10gLT4gdHJ1ZVxyXG4gKiBAcGFyYW0gc3FsX2RhdGVzX2Fyclx0IGFycmF5XHRcdGUuZy46IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ11cclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RhdGVzX19pc19jb25zZWN1dGl2ZV9kYXRlc19hcnJfcmFuZ2UoIHNxbF9kYXRlc19hcnIgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTAuXHJcblxyXG5cdGlmICggc3FsX2RhdGVzX2Fyci5sZW5ndGggPiAxICl7XHJcblx0XHR2YXIgcHJldmlvc19kYXRlID0gd3BiY19fZ2V0X19qc19kYXRlKCBzcWxfZGF0ZXNfYXJyWyAwIF0gKTtcclxuXHRcdHZhciBjdXJyZW50X2RhdGU7XHJcblxyXG5cdFx0Zm9yICggdmFyIGkgPSAxOyBpIDwgc3FsX2RhdGVzX2Fyci5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRjdXJyZW50X2RhdGUgPSB3cGJjX19nZXRfX2pzX2RhdGUoIHNxbF9kYXRlc19hcnJbaV0gKTtcclxuXHJcblx0XHRcdGlmICggd3BiY19kYXRlc19fZGF5c19iZXR3ZWVuKCBjdXJyZW50X2RhdGUsIHByZXZpb3NfZGF0ZSApICE9IDEgKXtcclxuXHRcdFx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRwcmV2aW9zX2RhdGUgPSBjdXJyZW50X2RhdGU7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIEF1dG8gRGF0ZXMgU2VsZWN0aW9uICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiAgPT0gSG93IHRvICB1c2UgPyA9PVxyXG4gKlxyXG4gKiAgRm9yIERhdGVzIHNlbGVjdGlvbiwgd2UgbmVlZCB0byB1c2UgdGhpcyBsb2dpYyEgICAgIFdlIG5lZWQgc2VsZWN0IHRoZSBkYXRlcyBvbmx5IGFmdGVyIGJvb2tpbmcgZGF0YSBsb2FkZWQhXHJcbiAqXHJcbiAqICBDaGVjayBleGFtcGxlIGJlbGxvdy5cclxuICpcclxuICpcdC8vIEZpcmUgb24gYWxsIGJvb2tpbmcgZGF0ZXMgbG9hZGVkXHJcbiAqXHRqUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24gKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcbiAqXHJcbiAqXHRcdGlmICggbG9hZGVkX3Jlc291cmNlX2lkID09IHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCApe1xyXG4gKlx0XHRcdHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCwgJzIwMjQtMDUtMTUnLCAnMjAyNC0wNS0yNScgKTtcclxuICpcdFx0fVxyXG4gKlx0fSApO1xyXG4gKlxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogVHJ5IHRvIEF1dG8gc2VsZWN0IGRhdGVzIGluIHNwZWNpZmljIGNhbGVuZGFyIGJ5IHNpbXVsYXRlZCBjbGlja3MgaW4gZGF0ZXBpY2tlclxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0MVxyXG4gKiBAcGFyYW0gY2hlY2tfaW5feW1kXHRcdCcyMDI0LTA1LTA5J1x0XHRPUiAgXHRbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0yMCddXHJcbiAqIEBwYXJhbSBjaGVja19vdXRfeW1kXHRcdCcyMDI0LTA1LTE1J1x0XHRPcHRpb25hbFxyXG4gKlxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfVx0XHRudW1iZXIgb2Ygc2VsZWN0ZWQgZGF0ZXNcclxuICpcclxuICogXHRFeGFtcGxlIDE6XHRcdFx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCAxLCAnMjAyNC0wNS0xNScsXHJcbiAqICAgICAnMjAyNC0wNS0yNScgKTsgRXhhbXBsZSAyOlx0XHRcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggMSxcclxuICogICAgIFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTIwJ10gKTtcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLCBjaGVja19pbl95bWQsIGNoZWNrX291dF95bWQgPSAnJyApe1x0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjQ3LlxyXG5cclxuXHRjb25zb2xlLmxvZyggJ1dQQkNfQVVUT19TRUxFQ1RfREFURVNfSU5fQ0FMRU5EQVIoIFJFU09VUkNFX0lELCBDSEVDS19JTl9ZTUQsIENIRUNLX09VVF9ZTUQgKScsIHJlc291cmNlX2lkLCBjaGVja19pbl95bWQsIGNoZWNrX291dF95bWQgKTtcclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgKCAnMjEwMC0wMS0wMScgPT0gY2hlY2tfaW5feW1kIClcclxuXHRcdHx8ICggJzIxMDAtMDEtMDEnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0fHwgKCAoICcnID09IGNoZWNrX2luX3ltZCApICYmICggJycgPT0gY2hlY2tfb3V0X3ltZCApIClcclxuXHQpe1xyXG5cdFx0cmV0dXJuIDA7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIElmIFx0Y2hlY2tfaW5feW1kICA9ICBbICcyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnIF1cdFx0XHRcdEFSUkFZIG9mIERBVEVTXHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41MC5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBkYXRlc190b19zZWxlY3RfYXJyID0gW107XHJcblx0aWYgKCBBcnJheS5pc0FycmF5KCBjaGVja19pbl95bWQgKSApe1xyXG5cdFx0ZGF0ZXNfdG9fc2VsZWN0X2FyciA9IHdwYmNfY2xvbmVfb2JqKCBjaGVja19pbl95bWQgKTtcclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBFeGNlcHRpb25zIHRvICBzZXQgIFx0TVVMVElQTEUgREFZUyBcdG1vZGVcclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIGlmIGRhdGVzIGFzIE5PVCBDT05TRUNVVElWRTogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXSwgLT4gc2V0IE1VTFRJUExFIERBWVMgbW9kZVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoID4gMCApXHJcblx0XHRcdCYmICggJycgPT0gY2hlY2tfb3V0X3ltZCApXHJcblx0XHRcdCYmICggISB3cGJjX2RhdGVzX19pc19jb25zZWN1dGl2ZV9kYXRlc19hcnJfcmFuZ2UoIGRhdGVzX3RvX3NlbGVjdF9hcnIgKSApXHJcblx0XHQpe1xyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0XHQvLyBpZiBtdWx0aXBsZSBkYXlzIHRvIHNlbGVjdCwgYnV0IGVuYWJsZWQgU0lOR0xFIGRheSBtb2RlLCAtPiBzZXQgTVVMVElQTEUgREFZUyBtb2RlXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGggPiAxIClcclxuXHRcdFx0JiYgKCAnJyA9PSBjaGVja19vdXRfeW1kIClcclxuXHRcdFx0JiYgKCAnc2luZ2xlJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApIClcclxuXHRcdCl7XHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdH1cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGNoZWNrX2luX3ltZCA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIDAgXTtcclxuXHRcdGlmICggJycgPT0gY2hlY2tfb3V0X3ltZCApe1xyXG5cdFx0XHRjaGVja19vdXRfeW1kID0gZGF0ZXNfdG9fc2VsZWN0X2FyclsgKGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoLTEpIF07XHJcblx0XHR9XHJcblx0fVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHRpZiAoICcnID09IGNoZWNrX2luX3ltZCApe1xyXG5cdFx0Y2hlY2tfaW5feW1kID0gY2hlY2tfb3V0X3ltZDtcclxuXHR9XHJcblx0aWYgKCAnJyA9PSBjaGVja19vdXRfeW1kICl7XHJcblx0XHRjaGVja19vdXRfeW1kID0gY2hlY2tfaW5feW1kO1xyXG5cdH1cclxuXHJcblx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXtcclxuXHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdH1cclxuXHJcblxyXG5cdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cclxuXHRcdC8vIFVuc2VsZWN0IGFsbCBkYXRlcyBhbmQgc2V0ICBwcm9wZXJ0aWVzIG9mIERhdGVwaWNrXHJcblx0XHRqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCAnJyApOyAgICAgIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA1LjQuM1xyXG5cdFx0aW5zdC5zdGF5T3BlbiA9IGZhbHNlO1xyXG5cdFx0aW5zdC5kYXRlcyA9IFtdO1xyXG5cdFx0dmFyIGNoZWNrX2luX2pzID0gd3BiY19fZ2V0X19qc19kYXRlKCBjaGVja19pbl95bWQgKTtcclxuXHRcdHZhciB0ZF9jZWxsICAgICA9IHdwYmNfZ2V0X2NsaWNrZWRfdGQoIGluc3QuaWQsIGNoZWNrX2luX2pzICk7XHJcblxyXG5cdFx0Ly8gSXMgb21lIHR5cGUgb2YgZXJyb3IsIHRoZW4gc2VsZWN0IG11bHRpcGxlIGRheXMgc2VsZWN0aW9uICBtb2RlLlxyXG5cdFx0aWYgKCAnJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICkge1xyXG4gXHRcdFx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJywgJ211bHRpcGxlJyApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICA9PSBEWU5BTUlDID09XHJcblx0XHRpZiAoICdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRcdC8vIDEtc3QgY2xpY2tcclxuXHRcdFx0aW5zdC5zdGF5T3BlbiA9IGZhbHNlO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHRcdGlmICggMCA9PT0gaW5zdC5kYXRlcy5sZW5ndGggKXtcclxuXHRcdFx0XHRyZXR1cm4gMDsgIFx0XHRcdFx0XHRcdFx0XHQvLyBGaXJzdCBjbGljayAgd2FzIHVuc3VjY2Vzc2Z1bCwgc28gd2UgbXVzdCBub3QgbWFrZSBvdGhlciBjbGlja1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAyLW5kIGNsaWNrXHJcblx0XHRcdHZhciBjaGVja19vdXRfanMgPSB3cGJjX19nZXRfX2pzX2RhdGUoIGNoZWNrX291dF95bWQgKTtcclxuXHRcdFx0dmFyIHRkX2NlbGxfb3V0ID0gd3BiY19nZXRfY2xpY2tlZF90ZCggaW5zdC5pZCwgY2hlY2tfb3V0X2pzICk7XHJcblx0XHRcdGluc3Quc3RheU9wZW4gPSB0cnVlO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbF9vdXQsICcjJyArIGluc3QuaWQsIGNoZWNrX291dF9qcy5nZXRUaW1lKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICA9PSBGSVhFRCA9PVxyXG5cdFx0aWYgKCAgJ2ZpeGVkJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApKSB7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsLCAnIycgKyBpbnN0LmlkLCBjaGVja19pbl9qcy5nZXRUaW1lKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICA9PSBTSU5HTEUgPT1cclxuXHRcdGlmICggJ3NpbmdsZScgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cdFx0XHQvL2pRdWVyeS5kYXRlcGljay5fcmVzdHJpY3RNaW5NYXgoIGluc3QsIGpRdWVyeS5kYXRlcGljay5fZGV0ZXJtaW5lRGF0ZSggaW5zdCwgY2hlY2tfaW5fanMsIG51bGwgKSApO1x0XHQvLyBEbyB3ZSBuZWVkIHRvIHJ1biAgdGhpcyA/IFBsZWFzZSBub3RlLCBjaGVja19pbl9qcyBtdXN0ICBoYXZlIHRpbWUsICBtaW4sIHNlYyBkZWZpbmVkIHRvIDAhXHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsLCAnIycgKyBpbnN0LmlkLCBjaGVja19pbl9qcy5nZXRUaW1lKCkgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICA9PSBNVUxUSVBMRSA9PVxyXG5cdFx0aWYgKCAnbXVsdGlwbGUnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHJcblx0XHRcdHZhciBkYXRlc19hcnI7XHJcblxyXG5cdFx0XHRpZiAoIGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoID4gMCApe1xyXG5cdFx0XHRcdC8vIFNpdHVhdGlvbiwgd2hlbiB3ZSBoYXZlIGRhdGVzIGFycmF5OiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddLiAgYW5kIG5vdCB0aGUgQ2hlY2sgSW4gLyBDaGVjayAgb3V0IGRhdGVzIGFzIHBhcmFtZXRlciBpbiB0aGlzIGZ1bmN0aW9uXHJcblx0XHRcdFx0ZGF0ZXNfYXJyID0gd3BiY19nZXRfc2VsZWN0aW9uX2RhdGVzX2pzX3N0cl9hcnJfX2Zyb21fYXJyKCBkYXRlc190b19zZWxlY3RfYXJyICk7XHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0ZGF0ZXNfYXJyID0gd3BiY19nZXRfc2VsZWN0aW9uX2RhdGVzX2pzX3N0cl9hcnJfX2Zyb21fY2hlY2tfaW5fb3V0KCBjaGVja19pbl95bWQsIGNoZWNrX291dF95bWQsIGluc3QgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0aWYgKCAwID09PSBkYXRlc19hcnIuZGF0ZXNfanMubGVuZ3RoICl7XHJcblx0XHRcdFx0cmV0dXJuIDA7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZvciBDYWxlbmRhciBEYXlzIHNlbGVjdGlvblxyXG5cdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBkYXRlc19hcnIuZGF0ZXNfanMubGVuZ3RoOyBqKysgKXsgICAgICAgLy8gTG9vcCBhcnJheSBvZiBkYXRlc1xyXG5cclxuXHRcdFx0XHR2YXIgc3RyX2RhdGUgPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlc19hcnIuZGF0ZXNfanNbIGogXSApO1xyXG5cclxuXHRcdFx0XHQvLyBEYXRlIHVuYXZhaWxhYmxlICFcclxuXHRcdFx0XHRpZiAoIDAgPT0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHN0cl9kYXRlICkuZGF5X2F2YWlsYWJpbGl0eSApe1xyXG5cdFx0XHRcdFx0cmV0dXJuIDA7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIGRhdGVzX2Fyci5kYXRlc19qc1sgaiBdICE9IC0xICkge1xyXG5cdFx0XHRcdFx0aW5zdC5kYXRlcy5wdXNoKCBkYXRlc19hcnIuZGF0ZXNfanNbIGogXSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIGNoZWNrX291dF9kYXRlID0gZGF0ZXNfYXJyLmRhdGVzX2pzWyAoZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aCAtIDEpIF07XHJcblxyXG5cdFx0XHRpbnN0LmRhdGVzLnB1c2goIGNoZWNrX291dF9kYXRlICk7IFx0XHRcdC8vIE5lZWQgYWRkIG9uZSBhZGRpdGlvbmFsIFNBTUUgZGF0ZSBmb3IgY29ycmVjdCAgd29ya3Mgb2YgZGF0ZXMgc2VsZWN0aW9uICEhISEhXHJcblxyXG5cdFx0XHR2YXIgY2hlY2tvdXRfdGltZXN0YW1wID0gY2hlY2tfb3V0X2RhdGUuZ2V0VGltZSgpO1xyXG5cdFx0XHR2YXIgdGRfY2VsbCA9IHdwYmNfZ2V0X2NsaWNrZWRfdGQoIGluc3QuaWQsIGNoZWNrX291dF9kYXRlICk7XHJcblxyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tvdXRfdGltZXN0YW1wICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdGlmICggMCAhPT0gaW5zdC5kYXRlcy5sZW5ndGggKXtcclxuXHRcdFx0Ly8gU2Nyb2xsIHRvIHNwZWNpZmljIG1vbnRoLCBpZiB3ZSBzZXQgZGF0ZXMgaW4gc29tZSBmdXR1cmUgbW9udGhzXHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3Njcm9sbF90byggcmVzb3VyY2VfaWQsIGluc3QuZGF0ZXNbIDAgXS5nZXRGdWxsWWVhcigpLCBpbnN0LmRhdGVzWyAwIF0uZ2V0TW9udGgoKSsxICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGluc3QuZGF0ZXMubGVuZ3RoO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIDA7XHJcbn1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IEhUTUwgdGQgZWxlbWVudCAod2hlcmUgd2FzIGNsaWNrIGluIGNhbGVuZGFyICBkYXkgIGNlbGwpXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfaHRtbF9pZFx0XHRcdCdjYWxlbmRhcl9ib29raW5nMSdcclxuXHQgKiBAcGFyYW0gZGF0ZV9qc1x0XHRcdFx0XHRKUyBEYXRlXHJcblx0ICogQHJldHVybnMgeyp8alF1ZXJ5fVx0XHRcdFx0RG9tIEhUTUwgdGQgZWxlbWVudFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X2NsaWNrZWRfdGQoIGNhbGVuZGFyX2h0bWxfaWQsIGRhdGVfanMgKXtcclxuXHJcblx0ICAgIHZhciB0ZF9jZWxsID0galF1ZXJ5KCAnIycgKyBjYWxlbmRhcl9odG1sX2lkICsgJyAuc3FsX2RhdGVfJyArIHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGVfanMgKSApLmdldCggMCApO1xyXG5cclxuXHRcdHJldHVybiB0ZF9jZWxsO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFycmF5cyBvZiBKUyBhbmQgU1FMIGRhdGVzIGFzIGRhdGVzIGFycmF5XHJcblx0ICpcclxuXHQgKiBAcGFyYW0gY2hlY2tfaW5feW1kXHRcdFx0XHRcdFx0XHQnMjAyNC0wNS0xNSdcclxuXHQgKiBAcGFyYW0gY2hlY2tfb3V0X3ltZFx0XHRcdFx0XHRcdFx0JzIwMjQtMDUtMjUnXHJcblx0ICogQHBhcmFtIGluc3RcdFx0XHRcdFx0XHRcdFx0XHREYXRlcGljayBJbnN0LiBVc2Ugd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0ICogQHJldHVybnMge3tkYXRlc19qczogKltdLCBkYXRlc19zdHI6ICpbXX19XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfc2VsZWN0aW9uX2RhdGVzX2pzX3N0cl9hcnJfX2Zyb21fY2hlY2tfaW5fb3V0KCBjaGVja19pbl95bWQsIGNoZWNrX291dF95bWQgLCBpbnN0ICl7XHJcblxyXG5cdFx0dmFyIG9yaWdpbmFsX2FycmF5ID0gW107XHJcblx0XHR2YXIgZGF0ZTtcclxuXHRcdHZhciBia19kaXN0aW5jdF9kYXRlcyA9IFtdO1xyXG5cclxuXHRcdHZhciBjaGVja19pbl9kYXRlID0gY2hlY2tfaW5feW1kLnNwbGl0KCAnLScgKTtcclxuXHRcdHZhciBjaGVja19vdXRfZGF0ZSA9IGNoZWNrX291dF95bWQuc3BsaXQoICctJyApO1xyXG5cclxuXHRcdGRhdGUgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0ZGF0ZS5zZXRGdWxsWWVhciggY2hlY2tfaW5fZGF0ZVsgMCBdLCAoY2hlY2tfaW5fZGF0ZVsgMSBdIC0gMSksIGNoZWNrX2luX2RhdGVbIDIgXSApOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHllYXIsIG1vbnRoLCBkYXRlXHJcblx0XHR2YXIgb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZSA9IGRhdGU7XHJcblx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCBqUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGRhdGUsIG51bGwgKSApICk7IC8vYWRkIGRhdGVcclxuXHRcdGlmICggISB3cGJjX2luX2FycmF5KCBia19kaXN0aW5jdF9kYXRlcywgKGNoZWNrX2luX2RhdGVbIDIgXSArICcuJyArIGNoZWNrX2luX2RhdGVbIDEgXSArICcuJyArIGNoZWNrX2luX2RhdGVbIDAgXSkgKSApe1xyXG5cdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCBwYXJzZUludChjaGVja19pbl9kYXRlWyAyIF0pICsgJy4nICsgcGFyc2VJbnQoY2hlY2tfaW5fZGF0ZVsgMSBdKSArICcuJyArIGNoZWNrX2luX2RhdGVbIDAgXSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBkYXRlX291dCA9IG5ldyBEYXRlKCk7XHJcblx0XHRkYXRlX291dC5zZXRGdWxsWWVhciggY2hlY2tfb3V0X2RhdGVbIDAgXSwgKGNoZWNrX291dF9kYXRlWyAxIF0gLSAxKSwgY2hlY2tfb3V0X2RhdGVbIDIgXSApOyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHllYXIsIG1vbnRoLCBkYXRlXHJcblx0XHR2YXIgb3JpZ2luYWxfY2hlY2tfb3V0X2RhdGUgPSBkYXRlX291dDtcclxuXHJcblx0XHR2YXIgbWV3RGF0ZSA9IG5ldyBEYXRlKCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldEZ1bGxZZWFyKCksIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0TW9udGgoKSwgb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXREYXRlKCkgKTtcclxuXHRcdG1ld0RhdGUuc2V0RGF0ZSggb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXREYXRlKCkgKyAxICk7XHJcblxyXG5cdFx0d2hpbGUgKFxyXG5cdFx0XHQob3JpZ2luYWxfY2hlY2tfb3V0X2RhdGUgPiBkYXRlKSAmJlxyXG5cdFx0XHQob3JpZ2luYWxfY2hlY2tfaW5fZGF0ZSAhPSBvcmlnaW5hbF9jaGVja19vdXRfZGF0ZSkgKXtcclxuXHRcdFx0ZGF0ZSA9IG5ldyBEYXRlKCBtZXdEYXRlLmdldEZ1bGxZZWFyKCksIG1ld0RhdGUuZ2V0TW9udGgoKSwgbWV3RGF0ZS5nZXREYXRlKCkgKTtcclxuXHJcblx0XHRcdG9yaWdpbmFsX2FycmF5LnB1c2goIGpRdWVyeS5kYXRlcGljay5fcmVzdHJpY3RNaW5NYXgoIGluc3QsIGpRdWVyeS5kYXRlcGljay5fZGV0ZXJtaW5lRGF0ZSggaW5zdCwgZGF0ZSwgbnVsbCApICkgKTsgLy9hZGQgZGF0ZVxyXG5cdFx0XHRpZiAoICF3cGJjX2luX2FycmF5KCBia19kaXN0aW5jdF9kYXRlcywgKGRhdGUuZ2V0RGF0ZSgpICsgJy4nICsgcGFyc2VJbnQoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICcuJyArIGRhdGUuZ2V0RnVsbFllYXIoKSkgKSApe1xyXG5cdFx0XHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnB1c2goIChwYXJzZUludChkYXRlLmdldERhdGUoKSkgKyAnLicgKyBwYXJzZUludCggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy4nICsgZGF0ZS5nZXRGdWxsWWVhcigpKSApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRtZXdEYXRlID0gbmV3IERhdGUoIGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSApO1xyXG5cdFx0XHRtZXdEYXRlLnNldERhdGUoIG1ld0RhdGUuZ2V0RGF0ZSgpICsgMSApO1xyXG5cdFx0fVxyXG5cdFx0b3JpZ2luYWxfYXJyYXkucG9wKCk7XHJcblx0XHRia19kaXN0aW5jdF9kYXRlcy5wb3AoKTtcclxuXHJcblx0XHRyZXR1cm4geydkYXRlc19qcyc6IG9yaWdpbmFsX2FycmF5LCAnZGF0ZXNfc3RyJzogYmtfZGlzdGluY3RfZGF0ZXN9O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFycmF5cyBvZiBKUyBhbmQgU1FMIGRhdGVzIGFzIGRhdGVzIGFycmF5XHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZXNfdG9fc2VsZWN0X2Fyclx0PSBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7e2RhdGVzX2pzOiAqW10sIGRhdGVzX3N0cjogKltdfX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9hcnIoIGRhdGVzX3RvX3NlbGVjdF9hcnIgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTAuXHJcblxyXG5cdFx0dmFyIG9yaWdpbmFsX2FycmF5ICAgID0gW107XHJcblx0XHR2YXIgYmtfZGlzdGluY3RfZGF0ZXMgPSBbXTtcclxuXHRcdHZhciBvbmVfZGF0ZV9zdHI7XHJcblxyXG5cdFx0Zm9yICggdmFyIGQgPSAwOyBkIDwgZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGg7IGQrKyApe1xyXG5cclxuXHRcdFx0b3JpZ2luYWxfYXJyYXkucHVzaCggd3BiY19fZ2V0X19qc19kYXRlKCBkYXRlc190b19zZWxlY3RfYXJyWyBkIF0gKSApO1xyXG5cclxuXHRcdFx0b25lX2RhdGVfc3RyID0gZGF0ZXNfdG9fc2VsZWN0X2FyclsgZCBdLnNwbGl0KCctJylcclxuXHRcdFx0aWYgKCAhIHdwYmNfaW5fYXJyYXkoIGJrX2Rpc3RpbmN0X2RhdGVzLCAob25lX2RhdGVfc3RyWyAyIF0gKyAnLicgKyBvbmVfZGF0ZV9zdHJbIDEgXSArICcuJyArIG9uZV9kYXRlX3N0clsgMCBdKSApICl7XHJcblx0XHRcdFx0YmtfZGlzdGluY3RfZGF0ZXMucHVzaCggcGFyc2VJbnQob25lX2RhdGVfc3RyWyAyIF0pICsgJy4nICsgcGFyc2VJbnQob25lX2RhdGVfc3RyWyAxIF0pICsgJy4nICsgb25lX2RhdGVfc3RyWyAwIF0gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7J2RhdGVzX2pzJzogb3JpZ2luYWxfYXJyYXksICdkYXRlc19zdHInOiBvcmlnaW5hbF9hcnJheX07XHJcblx0fVxyXG5cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbi8qICA9PSAgQXV0byBGaWxsIEZpZWxkcyAvIEF1dG8gU2VsZWN0IERhdGVzICA9PVxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gKi9cclxuXHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCl7XHJcblxyXG5cdHZhciB1cmxfcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyggd2luZG93LmxvY2F0aW9uLnNlYXJjaCApO1xyXG5cclxuXHQvLyBEaXNhYmxlIGRheXMgc2VsZWN0aW9uICBpbiBjYWxlbmRhciwgIGFmdGVyICByZWRpcmVjdGlvbiAgZnJvbSAgdGhlIFwiU2VhcmNoIHJlc3VsdHMgcGFnZSwgIGFmdGVyICBzZWFyY2ggIGF2YWlsYWJpbGl0eVwiIFx0XHRcdC8vIEZpeEluOiA4LjguMi4zLlxyXG5cdGlmICAoICdPbicgIT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfZW5hYmxlZF9ib29raW5nX3NlYXJjaF9yZXN1bHRzX2RheXNfc2VsZWN0JyApICkge1xyXG5cdFx0aWYgKFxyXG5cdFx0XHQoIHVybF9wYXJhbXMuaGFzKCAnd3BiY19zZWxlY3RfY2hlY2tfaW4nICkgKSAmJlxyXG5cdFx0XHQoIHVybF9wYXJhbXMuaGFzKCAnd3BiY19zZWxlY3RfY2hlY2tfb3V0JyApICkgJiZcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NhbGVuZGFyX2lkJyApIClcclxuXHRcdCl7XHJcblxyXG5cdFx0XHR2YXIgc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkID0gcGFyc2VJbnQoIHVybF9wYXJhbXMuZ2V0KCAnd3BiY19zZWxlY3RfY2FsZW5kYXJfaWQnICkgKTtcclxuXHJcblx0XHRcdC8vIEZpcmUgb24gYWxsIGJvb2tpbmcgZGF0ZXMgbG9hZGVkXHJcblx0XHRcdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiAoIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdFx0aWYgKCBsb2FkZWRfcmVzb3VyY2VfaWQgPT0gc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkICl7XHJcblx0XHRcdFx0XHR3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQsIHVybF9wYXJhbXMuZ2V0KCAnd3BiY19zZWxlY3RfY2hlY2tfaW4nICksIHVybF9wYXJhbXMuZ2V0KCAnd3BiY19zZWxlY3RfY2hlY2tfb3V0JyApICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoXG5cdFx0dXJsX3BhcmFtcy5oYXMoICd3cGJjX2F1dG9fZmlsbCcgKVxuXHRcdCYmICEgalF1ZXJ5KCAnYm9keScgKS5oYXNDbGFzcyggJ3dwLWFkbWluJyApXG5cdCl7XG5cclxuXHRcdHZhciB3cGJjX2F1dG9fZmlsbF92YWx1ZSA9IHVybF9wYXJhbXMuZ2V0KCAnd3BiY19hdXRvX2ZpbGwnICk7XHJcblxyXG5cdFx0Ly8gQ29udmVydCBiYWNrLiAgICAgU29tZSBzeXN0ZW1zIGRvIG5vdCBsaWtlIHN5bWJvbCAnficgaW4gVVJMLCBzbyAgd2UgbmVlZCB0byByZXBsYWNlIHRvICBzb21lIG90aGVyIHN5bWJvbHNcclxuXHRcdHdwYmNfYXV0b19maWxsX3ZhbHVlID0gd3BiY19hdXRvX2ZpbGxfdmFsdWUucmVwbGFjZUFsbCggJ19eXycsICd+JyApO1xyXG5cclxuXHRcdHdwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzKCB3cGJjX2F1dG9fZmlsbF92YWx1ZSApO1xyXG5cdH1cclxuXHJcbn0gKTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvZmlsbCAvIHNlbGVjdCBib29raW5nIGZvcm0gIGZpZWxkcyBieSAgdmFsdWVzIGZyb20gIHRoZSBHRVQgcmVxdWVzdCAgcGFyYW1ldGVyOiA/d3BiY19hdXRvX2ZpbGw9XHJcbiAqXHJcbiAqIFVSTC1wcm92aWRlZCBmaWVsZCBuYW1lcyBhcmUgcmVzb2x2ZWQgdGhyb3VnaCB0aGUgZXhhY3QtbmFtZSBET00gQVBJIHNvXG4gKiB0aGV5IGNhbiBuZXZlciBiZSBpbnRlcnByZXRlZCBhcyBDU1Mgc2VsZWN0b3Igc3ludGF4LlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSBhdXRvX2ZpbGxfc3RyIFNlcmlhbGl6ZWQgZmllbGQtbmFtZSBhbmQgdmFsdWUgcGFpcnMuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzKCBhdXRvX2ZpbGxfc3RyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjQ4LlxyXG5cclxuXHRpZiAoICcnID09IGF1dG9fZmlsbF9zdHIgKXtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG4vLyBjb25zb2xlLmxvZyggJ1dQQkNfQVVUT19GSUxMX0JPT0tJTkdfRklFTERTKCBBVVRPX0ZJTExfU1RSICknLCBhdXRvX2ZpbGxfc3RyKTtcclxuXHJcblx0dmFyIGZpZWxkc19hcnIgPSB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UoIGF1dG9fZmlsbF9zdHIgKTtcblxuXHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBmaWVsZHNfYXJyLmxlbmd0aDsgaSsrICl7XG5cdFx0dmFyIGZpZWxkX25hbWUgPSBTdHJpbmcoIGZpZWxkc19hcnJbIGkgXVsgJ25hbWUnIF0gfHwgJycgKTtcblx0XHRpZiAoICcnID09PSBmaWVsZF9uYW1lICkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0dmFyIGZpZWxkX2VsZW1lbnRzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeU5hbWUoIGZpZWxkX25hbWUgKTtcblx0XHRpZiAoIDAgPCBmaWVsZF9lbGVtZW50cy5sZW5ndGggKSB7XG5cdFx0XHRqUXVlcnkoIGZpZWxkX2VsZW1lbnRzICkudmFsKCBmaWVsZHNfYXJyWyBpIF1bICd2YWx1ZScgXSApO1xuXHRcdH1cblx0fVxufVxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgZGF0YSBmcm9tICBnZXQgcGFyYW1ldGVyOlx0P3dwYmNfYXV0b19maWxsPXZpc2l0b3JzMjMxXjJ+bWF4X2NhcGFjaXR5MjMxXjJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRhX3N0ciAgICAgID0gICAndmlzaXRvcnMyMzFeMn5tYXhfY2FwYWNpdHkyMzFeMic7XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHNfX3BhcnNlKCBkYXRhX3N0ciApe1xyXG5cclxuXHRcdHZhciBmaWx0ZXJfb3B0aW9uc19hcnIgPSBbXTtcclxuXHJcblx0XHR2YXIgZGF0YV9hcnIgPSBkYXRhX3N0ci5zcGxpdCggJ34nICk7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0YV9hcnIubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdHZhciBteV9mb3JtX2ZpZWxkID0gZGF0YV9hcnJbIGogXS5zcGxpdCggJ14nICk7XHJcblxyXG5cdFx0XHR2YXIgZmlsdGVyX25hbWUgID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDAgXSkpID8gbXlfZm9ybV9maWVsZFsgMCBdIDogJyc7XHJcblx0XHRcdHZhciBmaWx0ZXJfdmFsdWUgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMSBdKSkgPyBteV9mb3JtX2ZpZWxkWyAxIF0gOiAnJztcclxuXHJcblx0XHRcdGZpbHRlcl9vcHRpb25zX2Fyci5wdXNoKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgOiBmaWx0ZXJfbmFtZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZScgOiBmaWx0ZXJfdmFsdWVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQgICApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZpbHRlcl9vcHRpb25zX2FycjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIGRhdGEgZnJvbSAgZ2V0IHBhcmFtZXRlcjpcdD9zZWFyY2hfZ2V0X19jdXN0b21fcGFyYW1zPS4uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGFfc3RyICAgICAgPSAgICd0ZXh0XnNlYXJjaF9maWVsZF9fZGlzcGxheV9jaGVja19pbl4yMy4wNS4yMDI0fnRleHRec2VhcmNoX2ZpZWxkX19kaXNwbGF5X2NoZWNrX291dF4yNi4wNS4yMDI0fnNlbGVjdGJveC1vbmVec2VhcmNoX3F1YW50aXR5XjJ+c2VsZWN0Ym94LW9uZV5sb2NhdGlvbl5TcGFpbn5zZWxlY3Rib3gtb25lXm1heF9jYXBhY2l0eV4yfnNlbGVjdGJveC1vbmVeYW1lbml0eV5wYXJraW5nfmNoZWNrYm94XnNlYXJjaF9maWVsZF9fZXh0ZW5kX3NlYXJjaF9kYXlzXjV+c3VibWl0Xl5TZWFyY2h+aGlkZGVuXnNlYXJjaF9nZXRfX2NoZWNrX2luX3ltZF4yMDI0LTA1LTIzfmhpZGRlbl5zZWFyY2hfZ2V0X19jaGVja19vdXRfeW1kXjIwMjQtMDUtMjZ+aGlkZGVuXnNlYXJjaF9nZXRfX3RpbWVefmhpZGRlbl5zZWFyY2hfZ2V0X19xdWFudGl0eV4yfmhpZGRlbl5zZWFyY2hfZ2V0X19leHRlbmReNX5oaWRkZW5ec2VhcmNoX2dldF9fdXNlcnNfaWRefmhpZGRlbl5zZWFyY2hfZ2V0X19jdXN0b21fcGFyYW1zXn4nO1xyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYXV0b19maWxsX3NlYXJjaF9maWVsZHNfX3BhcnNlKCBkYXRhX3N0ciApe1xyXG5cclxuXHRcdHZhciBmaWx0ZXJfb3B0aW9uc19hcnIgPSBbXTtcclxuXHJcblx0XHR2YXIgZGF0YV9hcnIgPSBkYXRhX3N0ci5zcGxpdCggJ34nICk7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0YV9hcnIubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdHZhciBteV9mb3JtX2ZpZWxkID0gZGF0YV9hcnJbIGogXS5zcGxpdCggJ14nICk7XHJcblxyXG5cdFx0XHR2YXIgZmlsdGVyX3R5cGUgID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDAgXSkpID8gbXlfZm9ybV9maWVsZFsgMCBdIDogJyc7XHJcblx0XHRcdHZhciBmaWx0ZXJfbmFtZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMSBdKSkgPyBteV9mb3JtX2ZpZWxkWyAxIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl92YWx1ZSA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAyIF0pKSA/IG15X2Zvcm1fZmllbGRbIDIgXSA6ICcnO1xyXG5cclxuXHRcdFx0ZmlsdGVyX29wdGlvbnNfYXJyLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICA6IGZpbHRlcl90eXBlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICA6IGZpbHRlcl9uYW1lLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlJyA6IGZpbHRlcl92YWx1ZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCAgICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmlsdGVyX29wdGlvbnNfYXJyO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBBdXRvIFVwZGF0ZSBudW1iZXIgb2YgbW9udGhzIGluIGNhbGVuZGFycyBPTiBzY3JlZW4gc2l6ZSBjaGFuZ2VkICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBBdXRvIFVwZGF0ZSBOdW1iZXIgb2YgTW9udGhzIGluIENhbGVuZGFyLCBlLmcuOiAgXHRcdGlmICAgICggV0lORE9XX1dJRFRIIDw9IDc4MnB4ICkgICA+Pj4gXHRNT05USFNfTlVNQkVSID0gMVxyXG4gKiAgIEVMU0U6ICBudW1iZXIgb2YgbW9udGhzIGRlZmluZWQgaW4gc2hvcnRjb2RlLlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgaW50XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyX19vbl9yZXNpemUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdGlmICggdHJ1ZSA9PT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfYWxsb3dfc2V2ZXJhbF9tb250aHNfb25fbW9iaWxlJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID0gcGFyc2VJbnQoIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycgKSApO1xyXG5cclxuXHRpZiAoIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID4gMSApe1xyXG5cclxuXHRcdGlmICggalF1ZXJ5KCB3aW5kb3cgKS53aWR0aCgpIDw9IDc4MiApe1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIDEgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9tb250aHNfbnVtYmVyKCByZXNvdXJjZV9pZCwgbG9jYWxfX251bWJlcl9vZl9tb250aHMgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQXV0byBVcGRhdGUgTnVtYmVyIG9mIE1vbnRocyBpbiAgIEFMTCAgIENhbGVuZGFyc1xyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcnNfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXIoKXtcclxuXHJcblx0dmFyIGFsbF9jYWxlbmRhcnNfYXJyID0gX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0KCk7XHJcblxyXG5cdC8vIFRoaXMgTE9PUCBcImZvciBpblwiIGlzIEdPT0QsIGJlY2F1c2Ugd2UgY2hlY2sgIGhlcmUga2V5cyAgICAnY2FsZW5kYXJfJyA9PT0gY2FsZW5kYXJfaWQuc2xpY2UoIDAsIDkgKVxyXG5cdGZvciAoIHZhciBjYWxlbmRhcl9pZCBpbiBhbGxfY2FsZW5kYXJzX2FyciApe1xyXG5cdFx0aWYgKCAnY2FsZW5kYXJfJyA9PT0gY2FsZW5kYXJfaWQuc2xpY2UoIDAsIDkgKSApe1xyXG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggY2FsZW5kYXJfaWQuc2xpY2UoIDkgKSApO1x0XHRcdC8vICAnY2FsZW5kYXJfMycgLT4gM1xyXG5cdFx0XHRpZiAoIHJlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXJfX29uX3Jlc2l6ZSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIElmIGJyb3dzZXIgd2luZG93IGNoYW5nZWQsICB0aGVuICB1cGRhdGUgbnVtYmVyIG9mIG1vbnRocy5cclxuICovXHJcbmpRdWVyeSggd2luZG93ICkub24oICdyZXNpemUnLCBmdW5jdGlvbiAoKXtcclxuXHR3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpO1xyXG59ICk7XHJcblxyXG4vKipcclxuICogQXV0byB1cGRhdGUgY2FsZW5kYXIgbnVtYmVyIG9mIG1vbnRocyBvbiBpbml0aWFsIHBhZ2UgbG9hZFxyXG4gKi9cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHR3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpO1xyXG5cdH0sIDEwMCApO1xyXG59KTtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIENoZWNrOiBjYWxlbmRhcl9kYXRlc19zdGFydDogXCIyMDI2LTAxLTAxXCIsIGNhbGVuZGFyX2RhdGVzX2VuZDogXCIyMDI2LTEyLTMxXCIgPT0gIC8vIEZpeEluOiAxMC4xMy4xLjQuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cdC8qKlxyXG5cdCAqIEdldCBTdGFydCBKUyBEYXRlIG9mIHN0YXJ0aW5nIGRhdGVzIGluIGNhbGVuZGFyLCBmcm9tIHRoZSBfd3BiYyBvYmplY3QuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gaW50ZWdlciByZXNvdXJjZV9pZCAtIHJlc291cmNlIElELCBlLmcuOiAxLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19zdGFydCggcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRyZXR1cm4gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVfcGFyYW1ldGVyKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX2RhdGVzX3N0YXJ0JyApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IEVuZCBKUyBEYXRlIG9mIGVuZGluZyBkYXRlcyBpbiBjYWxlbmRhciwgZnJvbSB0aGUgX3dwYmMgb2JqZWN0LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGludGVnZXIgcmVzb3VyY2VfaWQgLSByZXNvdXJjZSBJRCwgZS5nLjogMS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfZW5kKHJlc291cmNlX2lkKSB7XHJcblx0XHRyZXR1cm4gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVfcGFyYW1ldGVyKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX2RhdGVzX2VuZCcgKTtcclxuXHR9XHJcblxyXG4vKipcclxuICogR2V0IHZhbGlkYXRlcyBkYXRlIHBhcmFtZXRlci5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkICAgLSAxXHJcbiAqIEBwYXJhbSBwYXJhbWV0ZXJfc3RyIC0gJ2NhbGVuZGFyX2RhdGVzX3N0YXJ0JyB8ICdjYWxlbmRhcl9kYXRlc19lbmQnIHwgLi4uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZV9wYXJhbWV0ZXIocmVzb3VyY2VfaWQsIHBhcmFtZXRlcl9zdHIpIHtcclxuXHJcblx0dmFyIGRhdGVfZXhwZWN0ZWRfeW1kID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsIHBhcmFtZXRlcl9zdHIgKTtcclxuXHJcblx0aWYgKCAhIGRhdGVfZXhwZWN0ZWRfeW1kICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAvLyAnJyB8IDAgfCBudWxsIHwgdW5kZWZpbmVkICAtPiBmYWxzZS5cclxuXHR9XHJcblxyXG5cdGlmICggLTEgIT09IGRhdGVfZXhwZWN0ZWRfeW1kLmluZGV4T2YoICctJyApICkge1xyXG5cclxuXHRcdHZhciBkYXRlX2V4cGVjdGVkX3ltZF9hcnIgPSBkYXRlX2V4cGVjdGVkX3ltZC5zcGxpdCggJy0nICk7XHQvLyAnMjAyNS0wNy0yNicgLT4gWycyMDI1JywgJzA3JywgJzI2J11cclxuXHJcblx0XHRpZiAoIGRhdGVfZXhwZWN0ZWRfeW1kX2Fyci5sZW5ndGggPiAwICkge1xyXG5cdFx0XHR2YXIgeWVhciAgPSAoZGF0ZV9leHBlY3RlZF95bWRfYXJyLmxlbmd0aCA+IDApID8gcGFyc2VJbnQoIGRhdGVfZXhwZWN0ZWRfeW1kX2FyclswXSApIDogbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpO1x0Ly8gWWVhci5cclxuXHRcdFx0dmFyIG1vbnRoID0gKGRhdGVfZXhwZWN0ZWRfeW1kX2Fyci5sZW5ndGggPiAxKSA/IChwYXJzZUludCggZGF0ZV9leHBlY3RlZF95bWRfYXJyWzFdICkgLSAxKSA6IDA7ICAvLyAobW9udGggLSAxKSBvciAwIC0gSmFuLlxyXG5cdFx0XHR2YXIgZGF5ICAgPSAoZGF0ZV9leHBlY3RlZF95bWRfYXJyLmxlbmd0aCA+IDIpID8gcGFyc2VJbnQoIGRhdGVfZXhwZWN0ZWRfeW1kX2FyclsyXSApIDogMTsgIC8vIGRhdGUgb3IgT3RoZXJ3aXNlIDFzdCBvZiBtb250aFxyXG5cclxuXHRcdFx0dmFyIGRhdGVfanMgPSBuZXcgRGF0ZSggeWVhciwgbW9udGgsIGRheSwgMCwgMCwgMCwgMCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIGRhdGVfanM7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZmFsc2U7ICAvLyBGYWxsYmFjaywgIGlmIHdlIG5vdCBwYXJzZWQgdGhpcyBwYXJhbWV0ZXIgICdjYWxlbmRhcl9kYXRlc19zdGFydCcgPSAnMjAyNS0wNy0yNicsICBmb3IgZXhhbXBsZSBiZWNhdXNlIG9mICdjYWxlbmRhcl9kYXRlc19zdGFydCcgPSAnc2ZzZGYnLlxyXG59XHJcbiIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9jYWwvZGF5c19zZWxlY3RfY3VzdG9tLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLy8gRml4SW46IDkuOC45LjIuXHJcblxyXG4vKipcclxuICogUmUtSW5pdCBDYWxlbmRhciBhbmQgUmUtUmVuZGVyIGl0LlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBSZW1vdmUgQ0xBU1MgIGZvciBhYmlsaXR5IHRvIHJlLXJlbmRlciBhbmQgcmVpbml0IGNhbGVuZGFyLlxyXG5cdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcclxuXHR3cGJjX2NhbGVuZGFyX3Nob3coIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogUmUtSW5pdCBwcmV2aW91c2x5ICBzYXZlZCBkYXlzIHNlbGVjdGlvbiAgdmFyaWFibGVzLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3NhdmVkX3ZhcmlhYmxlX19fZGF5c19zZWxlY3RfaW5pdGlhbCdcclxuXHRcdCwge1xyXG5cdFx0XHQnZHluYW1pY19fZGF5c19taW4nICAgICAgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19taW4nICksXHJcblx0XHRcdCdkeW5hbWljX19kYXlzX21heCcgICAgICAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21heCcgKSxcclxuXHRcdFx0J2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnICksXHJcblx0XHRcdCdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JzogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JyApLFxyXG5cdFx0XHQnZml4ZWRfX2RheXNfbnVtJyAgICAgICAgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZml4ZWRfX2RheXNfbnVtJyApLFxyXG5cdFx0XHQnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnIClcclxuXHRcdH1cclxuXHQpO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgU2luZ2xlIERheSBzZWxlY3Rpb24gLSBhZnRlciBwYWdlIGxvYWRcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19zaW5nbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fc2luZ2xlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IFNpbmdsZSBEYXkgc2VsZWN0aW9uXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fc2luZ2xlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnc2luZ2xlJ30gKTtcclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNldCBNdWx0aXBsZSBEYXlzIHNlbGVjdGlvbiAgLSBhZnRlciBwYWdlIGxvYWRcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZXQgTXVsdGlwbGUgRGF5cyBzZWxlY3Rpb25cclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ211bHRpcGxlJ30gKTtcclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgRml4ZWQgRGF5cyBzZWxlY3Rpb24gd2l0aCAgMSBtb3VzZSBjbGljayAgLSBhZnRlciBwYWdlIGxvYWRcclxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKSAtXHJcbiAqIEBpbnRlZ2VyIGRheXNfbnVtYmVyXHRcdFx0LSAzXHRcdFx0XHQgICAtLSBudW1iZXIgb2YgZGF5cyB0byAgc2VsZWN0XHQtXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHQtIFstMV0gfCBbIDEsIDVdICAgLS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX2ZpeGVkKCByZXNvdXJjZV9pZCwgZGF5c19udW1iZXIsIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fZml4ZWQoIHJlc291cmNlX2lkLCBkYXlzX251bWJlciwgd2Vla19kYXlzX19zdGFydCApO1xyXG5cclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNldCBGaXhlZCBEYXlzIHNlbGVjdGlvbiB3aXRoICAxIG1vdXNlIGNsaWNrXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICAtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcikgLVxyXG4gKiBAaW50ZWdlciBkYXlzX251bWJlclx0XHRcdC0gM1x0XHRcdFx0ICAgLS0gbnVtYmVyIG9mIGRheXMgdG8gIHNlbGVjdFx0LVxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0LSBbLTFdIHwgWyAxLCA1XSAgIC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZCggcmVzb3VyY2VfaWQsIGRheXNfbnVtYmVyLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnZml4ZWQnfSApO1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2ZpeGVkX19kYXlzX251bSc6IHBhcnNlSW50KCBkYXlzX251bWJlciApfSApO1x0XHRcdC8vIE51bWJlciBvZiBkYXlzIHNlbGVjdGlvbiB3aXRoIDEgbW91c2UgY2xpY2tcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0Jzogd2Vla19kYXlzX19zdGFydH0gKTsgXHQvLyB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFNldCB0aGUgZXhpc3RpbmcgY2FsZW5kYXIgcGFyYW1ldGVycyB0byB0d28tY2xpY2sgcmFuZ2UgbW9kZSBhZnRlciBwYWdlIGxvYWQuXG4gKiBGcmVlIHVzZXMgdGhlIHVucmVzdHJpY3RlZCBzaGFyZWQgaGFuZGxlcjsgQnVzaW5lc3MgU21hbGwrIGtlZXBzIGl0cyBhbHJlYWR5IGluaXRpYWxpemVkIGFkdmFuY2VkIHJhbmdlIHJ1bGVzLlxuICpcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCBJRCBvZiBib29raW5nIHJlc291cmNlLlxuICovXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fcmFuZ2VfbW9kZSggcmVzb3VyY2VfaWQgKXtcblxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlX21vZGUoIHJlc291cmNlX2lkICk7XG5cdFx0fSwgMTAwMCk7XG5cdH0pO1xufVxuXG4vKipcbiAqIFN3aXRjaCB0byB0d28tY2xpY2sgcmFuZ2UgbW9kZSB3aXRob3V0IGNoYW5naW5nIGFueSBhZHZhbmNlZCByYW5nZSBwYXJhbWV0ZXJzLlxuICpcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCBJRCBvZiBib29raW5nIHJlc291cmNlLlxuICovXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2VfbW9kZSggcmVzb3VyY2VfaWQgKXtcblxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnZHluYW1pYyd9ICk7XG5cblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBTZXQgUmFuZ2UgRGF5cyBzZWxlY3Rpb24gIHdpdGggIDIgbW91c2UgY2xpY2tzICAtIGFmdGVyIHBhZ2UgbG9hZFxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIFx0XHQtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcilcclxuICogQGludGVnZXIgZGF5c19taW5cdFx0XHQtIDdcdFx0XHRcdCAgIFx0XHQtLSBNaW4gbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBpbnRlZ2VyIGRheXNfbWF4XHRcdFx0LSAzMFx0XHRcdCAgIFx0XHQtLSBNYXggbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBhcnJheSBkYXlzX3NwZWNpZmljXHRcdFx0LSBbXSB8IFs3LDE0LDIxLDI4XVx0XHQtLSBSZXN0cmljdGlvbiBmb3IgU3BlY2lmaWMgbnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHRcdC0gWy0xXSB8IFsgMSwgNV0gICBcdFx0LS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX3JhbmdlKCByZXNvdXJjZV9pZCwgZGF5c19taW4sIGRheXNfbWF4LCBkYXlzX3NwZWNpZmljID0gW10sIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2UoIHJlc291cmNlX2lkLCBkYXlzX21pbiwgZGF5c19tYXgsIGRheXNfc3BlY2lmaWMsIHdlZWtfZGF5c19fc3RhcnQgKTtcclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IFJhbmdlIERheXMgc2VsZWN0aW9uICB3aXRoICAyIG1vdXNlIGNsaWNrc1xyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgXHRcdC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKVxyXG4gKiBAaW50ZWdlciBkYXlzX21pblx0XHRcdC0gN1x0XHRcdFx0ICAgXHRcdC0tIE1pbiBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGludGVnZXIgZGF5c19tYXhcdFx0XHQtIDMwXHRcdFx0ICAgXHRcdC0tIE1heCBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGFycmF5IGRheXNfc3BlY2lmaWNcdFx0XHQtIFtdIHwgWzcsMTQsMjEsMjhdXHRcdC0tIFJlc3RyaWN0aW9uIGZvciBTcGVjaWZpYyBudW1iZXIgb2YgZGF5cyBzZWxlY3Rpb25cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdFx0LSBbLTFdIHwgWyAxLCA1XSAgIFx0XHQtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2UoIHJlc291cmNlX2lkLCBkYXlzX21pbiwgZGF5c19tYXgsIGRheXNfc3BlY2lmaWMgPSBbXSwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCAgcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdkeW5hbWljJ30gICk7XHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21pbicgICAgICAgICAsIHBhcnNlSW50KCBkYXlzX21pbiApICApOyAgICAgICAgICAgXHRcdC8vIE1pbi4gTnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uIHdpdGggMiBtb3VzZSBjbGlja3NcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWF4JyAgICAgICAgICwgcGFyc2VJbnQoIGRheXNfbWF4ICkgICk7ICAgICAgICAgIFx0XHQvLyBNYXguIE51bWJlciBvZiBkYXlzIHNlbGVjdGlvbiB3aXRoIDIgbW91c2UgY2xpY2tzXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJyAgICAsIGRheXNfc3BlY2lmaWMgICk7XHQgICAgICBcdFx0XHRcdC8vIEV4YW1wbGUgWzUsN11cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnICwgd2Vla19kYXlzX19zdGFydCAgKTsgIFx0XHRcdFx0XHQvLyB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuIiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2NhbF9hanhfbG9hZC93cGJjX2NhbF9hanguanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gIEEgaiBhIHggICAgTCBvIGEgZCAgICBDIGEgbCBlIG4gZCBhIHIgICAgRCBhIHQgYVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4KCBwYXJhbXMgKXtcclxuXHJcblx0Ly8gRml4SW46IDkuOC42LjIuXHJcblx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RhcnQoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApO1xyXG5cclxuXHQvLyBUcmlnZ2VyIGV2ZW50IGZvciBjYWxlbmRhciBiZWZvcmUgbG9hZGluZyBCb29raW5nIGRhdGEsICBidXQgYWZ0ZXIgc2hvd2luZyBDYWxlbmRhci5cclxuXHRpZiAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApLmxlbmd0aCA+IDAgKXtcclxuXHRcdHZhciB0YXJnZXRfZWxtID0galF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCBcIndwYmNfY2FsZW5kYXJfYWp4X19iZWZvcmVfbG9hZGVkX2RhdGFcIiwgW3BhcmFtc1sncmVzb3VyY2VfaWQnXV0gKTtcclxuXHRcdCAvL2pRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fYmVmb3JlX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24oIGV2ZW50LCByZXNvdXJjZV9pZCApIHsgLi4uIH0gKTtcclxuXHR9XHJcblxyXG5cdGlmICggd3BiY19iYWxhbmNlcl9faXNfd2FpdCggcGFyYW1zICwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApICl7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBGaXhJbjogOS44LjYuMi5cclxuXHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdG9wKCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyA9PSBHZXQgc3RhcnQgLyBlbmQgZGF0ZXMgZnJvbSAgdGhlIEJvb2tpbmcgQ2FsZW5kYXIgc2hvcnRjb2RlLiA9PVxyXG5cdC8vIEV4YW1wbGU6IFtib29raW5nIGNhbGVuZGFyX2RhdGVzX3N0YXJ0PScyMDI2LTAxLTAxJyBjYWxlbmRhcl9kYXRlc19lbmQ9JzIwMjYtMTItMzEnICByZXNvdXJjZV9pZD0xXSAgICAgICAgICAgICAgLy8gRml4SW46IDEwLjEzLjEuNC5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGlmICggZmFsc2UgIT09IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19zdGFydCggcGFyYW1zWydyZXNvdXJjZV9pZCddICkgKSB7XHJcblx0XHRpZiAoICEgcGFyYW1zWydkYXRlc190b19jaGVjayddICkgeyBwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ10gPSBbXTsgfVxyXG5cdFx0dmFyIGRhdGVzX3N0YXJ0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX3N0YXJ0KCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKTsgIC8vIEUuZy4gLSBsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggMjAyNSwgMCwgMSApO1xyXG5cdFx0aWYgKCBmYWxzZSAhPT0gZGF0ZXNfc3RhcnQgKXtcclxuXHRcdFx0cGFyYW1zWydkYXRlc190b19jaGVjayddWzBdID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfc3RhcnQgKTtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKCBmYWxzZSAhPT0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcGFyYW1zWydyZXNvdXJjZV9pZCddICkgKSB7XHJcblx0XHRpZiAoICFwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ10gKSB7IHBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXSA9IFtdOyB9XHJcblx0XHR2YXIgZGF0ZXNfZW5kID0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7ICAvLyBFLmcuIC0gbG9jYWxfX21pbl9kYXRlID0gbmV3IERhdGUoIDIwMjUsIDAsIDEgKTtcclxuXHRcdGlmICggZmFsc2UgIT09IGRhdGVzX2VuZCApIHtcclxuXHRcdFx0cGFyYW1zWydkYXRlc190b19jaGVjayddWzFdID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfZW5kICk7XHJcblx0XHRcdGlmICggIXBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXVswXSApIHtcclxuXHRcdFx0XHRwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ11bMF0gPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBuZXcgRGF0ZSgpICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8vIGNvbnNvbGUuZ3JvdXBFbmQoKTsgY29uc29sZS50aW1lKCdyZXNvdXJjZV9pZF8nICsgcGFyYW1zWydyZXNvdXJjZV9pZCddKTtcclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnICk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBjYWxlbmRhcnNfYWxsX19nZXQoKSA9PSAnICwgX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0KCkgKTtcclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcikgKSB7XHJcblx0XHR3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKCk7XHJcblx0fVxyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbm9uY2UnICksXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGUgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zIDogcGFyYW1zIFx0XHRcdFx0XHRcdC8vIFVzdWFsbHkgbGlrZTogeyAncmVzb3VyY2VfaWQnOiAxLCAnbWF4X2RheXNfY291bnQnOiAzNjUgfVxyXG5cdFx0XHRcdH0sXHJcblxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNoLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuLy8gY29uc29sZS50aW1lRW5kKCdyZXNvdXJjZV9pZF8nICsgcmVzcG9uc2VfZGF0YVsncmVzb3VyY2VfaWQnXSk7XHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0NBTEVOREFSX0xPQUQgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gRml4SW46IDkuOC42LjIuXHJcblx0XHRcdFx0XHR2YXIgYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHR3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQoIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkICwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApO1xyXG5cclxuXHRcdFx0XHRcdHZhciBpc192YWxpZF9yZXNwb25zZSA9IChcblx0XHRcdFx0XHRcdFx0KHR5cGVvZiByZXNwb25zZV9kYXRhID09PSAnb2JqZWN0Jylcblx0XHRcdFx0XHRcdCAmJiAocmVzcG9uc2VfZGF0YSAhPT0gbnVsbClcblx0XHRcdFx0XHRcdCAmJiAoISBBcnJheS5pc0FycmF5KCByZXNwb25zZV9kYXRhICkpXG5cdFx0XHRcdFx0XHQgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCByZXNwb25zZV9kYXRhLCAncmVzb3VyY2VfaWQnIClcblx0XHRcdFx0XHRcdCAmJiAodHlwZW9mIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXSA9PT0gJ29iamVjdCcpXG5cdFx0XHRcdFx0XHQgJiYgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXSAhPT0gbnVsbClcblx0XHRcdFx0XHRcdCAmJiAoISBBcnJheS5pc0FycmF5KCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0gKSlcblx0XHRcdFx0XHRcdCAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXSwgJ2RhdGVzJyApXG5cdFx0XHRcdFx0XHQgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0sICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgKVxuXHRcdFx0XHRcdFx0ICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicgKVxuXHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRpZiAoICEgaXNfdmFsaWRfcmVzcG9uc2UgKSB7XG5cdFx0XHRcdFx0XHR2YXIganFfbm9kZSA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xuXHRcdFx0XHRcdFx0dmFyIHJlc3BvbnNlX2Vycm9yX21lc3NhZ2UgPSBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfdW5leHBlY3RlZF9zZXJ2ZXJfcmVzcG9uc2UnICkgfHwgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5leHBlY3RlZCByZXNwb25zZS4gUGxlYXNlIHJlbG9hZCB0aGUgcGFnZSBhbmQgdHJ5IGFnYWluLic7XG5cblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19sb2dfdW5leHBlY3RlZF9hamF4X3Jlc3BvbnNlKCAnV1BCQ19BSlhfQ0FMRU5EQVJfTE9BRCcsIHJlc3BvbnNlX2RhdGEsIGpxWEhSLCB0ZXh0U3RhdHVzLCAnSW52YWxpZCByZXNwb25zZSBzdHJ1Y3R1cmUnICk7XG5cdFx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wKCBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9lcnJvcl9tZXNzYWdlLCB7ICd0eXBlJyAgICAgICAgOiAnZXJyb3InLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3Nob3dfaGVyZScgICA6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ2lzX2FwcGVuZCcgICA6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAnc3R5bGUnICAgICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ2NvbnRlbnRfbW9kZSc6ICd0ZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICdkZWxheScgICAgICAgOiAwXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBDYWxlbmRhclxyXG5cdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RvcCggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0Ly8gQm9va2luZ3MgLSBEYXRlc1xyXG5cdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWydkYXRlcyddICApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEJvb2tpbmdzIC0gQ2hpbGQgb3Igb25seSBzaW5nbGUgYm9va2luZyByZXNvdXJjZSBpbiBkYXRlc1xyXG5cdFx0XHRcdFx0X3dwYmMuYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWdncmVnYXRlIGJvb2tpbmcgcmVzb3VyY2VzLCAgaWYgYW55ID9cclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInIF0gKTtcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRcdFx0XHQvLyBVcGRhdGUgY2FsZW5kYXJcclxuXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcikgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IoKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdFx0KCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0pIClcclxuXHRcdFx0XHRcdFx0ICYmICggJycgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApIClcclxuXHRcdFx0XHRcdCl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7ICAgJ3R5cGUnICAgICA6ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSApIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnaW5mbycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX3VwZGF0ZV9jYXBhY2l0eV9oaW50KSApIHtcclxuXHRcdFx0XHRcdFx0d3BiY191cGRhdGVfY2FwYWNpdHlfaGludCggcmVzcG9uc2VfZGF0YVsncmVzb3VyY2VfaWQnXSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFRyaWdnZXIgZXZlbnQgdGhhdCBjYWxlbmRhciBoYXMgYmVlblx0XHQgLy8gRml4SW46IDEwLjAuMC40NC4gIC8vIEZpeEluOiAxMC4xNC4xNy4yLlxyXG5cdFx0XHRcdFx0aWYgKCAoalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzcG9uc2VfZGF0YVsncmVzb3VyY2VfaWQnXSApLmxlbmd0aCA+IDApIHx8IChqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc3BvbnNlX2RhdGFbJ3Jlc291cmNlX2lkJ10gKS5sZW5ndGggPiAwKSApIHtcclxuXHRcdFx0XHRcdFx0dmFyIHRhcmdldF9lbG0gPSBqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoIFwid3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhXCIsIFtyZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF1dICk7XHJcblx0XHRcdFx0XHRcdCAvL2pRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiggZXZlbnQsIHJlc291cmNlX2lkICkgeyAuLi4gfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8valF1ZXJ5KCAnI2FqYXhfcmVzcG9uZCcgKS5odG1sKCByZXNwb25zZV9kYXRhICk7XHRcdC8vIEZvciBhYmlsaXR5IHRvIHNob3cgcmVzcG9uc2UsIGFkZCBzdWNoIERJViBlbGVtZW50IHRvIHBhZ2VcclxuXHRcdFx0XHR9XHJcblx0XHRcdCAgKS5mYWlsKCBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHtcblx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fbG9nX3VuZXhwZWN0ZWRfYWpheF9yZXNwb25zZSggJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnLCBqcVhIUi5yZXNwb25zZVRleHQgfHwgJycsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApO1xuXHJcblx0XHRcdFx0XHR2YXIgYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XG5cdFx0XHRcdFx0d3BiY19iYWxhbmNlcl9fY29tcGxldGVkKCBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCAsICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCcgKTtcblx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wKCBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCApO1xuXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfdW5leHBlY3RlZF9zZXJ2ZXJfcmVzcG9uc2UnICkgfHwgJ1RoZSBzZXJ2ZXIgcmV0dXJuZWQgYW4gdW5leHBlY3RlZCByZXNwb25zZS4gUGxlYXNlIHJlbG9hZCB0aGUgcGFnZSBhbmQgdHJ5IGFnYWluLic7XG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5zdGF0dXMgKXtcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAoJyArIHBhcnNlSW50KCBqcVhIUi5zdGF0dXMsIDEwICkgKyAnKSc7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhciBtZXNzYWdlX3Nob3dfZGVsYXkgPSAzMDAwO1xuXG5cdFx0XHRcdFx0dmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XG5cclxuXHRcdFx0XHRcdC8qKlxyXG5cdFx0XHRcdFx0ICogSWYgd2UgbWFrZSBmYXN0IGNsaWNraW5nIG9uIGRpZmZlcmVudCBwYWdlcyxcclxuXHRcdFx0XHRcdCAqIHRoZW4gdW5kZXIgY2FsZW5kYXIgd2lsbCBzaG93IGVycm9yIG1lc3NhZ2Ugd2l0aCAgZW1wdHkgIHRleHQsIGJlY2F1c2UgYWpheCB3YXMgbm90IHJlY2VpdmVkLlxyXG5cdFx0XHRcdFx0ICogVG8gIG5vdCBzaG93IHN1Y2ggd2FybmluZ3Mgd2UgYXJlIHNldCBkZWxheSAgaW4gMyBzZWNvbmRzLiAgdmFyIG1lc3NhZ2Vfc2hvd19kZWxheSA9IDMwMDA7XHJcblx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggZXJyb3JfbWVzc2FnZSAsIHsgJ3R5cGUnICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY3NzX2NsYXNzJzond3BiY19mZV9tZXNzYWdlX2FsdCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnOiAndGV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9ICxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIHBhcnNlSW50KCBtZXNzYWdlX3Nob3dfZGVsYXkgKSAgICk7XHJcblxyXG5cdFx0XHQgIH0pXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG59XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBTdXBwb3J0XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgQ2FsZW5kYXIgalF1ZXJ5IG5vZGUgZm9yIHNob3dpbmcgbWVzc2FnZXMgZHVyaW5nIEFqYXhcclxuXHQgKiBUaGlzIHBhcmFtZXRlcjogICBjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0gICBwYXJzZWQgZnJvbSB0aGlzLmRhdGEgQWpheCBwb3N0ICBkYXRhXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zXHRcdCAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVx0JycjY2FsZW5kYXJfYm9va2luZzEnICB8ICAgJy5ib29raW5nX2Zvcm1fZGl2JyAuLi5cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGUgICAgdmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICl7XHJcblxyXG5cdFx0dmFyIGpxX25vZGUgPSAnLmJvb2tpbmdfZm9ybV9kaXYnO1xyXG5cclxuXHRcdHZhciBjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKTtcclxuXHJcblx0XHRpZiAoIGNhbGVuZGFyX3Jlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRqcV9ub2RlID0gJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3Jlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBqcV9ub2RlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCByZXNvdXJjZSBJRCBmcm9tIGFqeCBwb3N0IGRhdGEgdXJsICAgdXN1YWxseSAgZnJvbSAgdGhpcy5kYXRhICA9XHJcblx0ICogJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zXHRcdCAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKiBAcmV0dXJucyB7aW50fVx0XHRcdFx0XHRcdCAxIHwgMCAgKGlmIGVycnJvciB0aGVuICAwKVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZSAgICB2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICl7XHJcblxyXG5cdFx0Ly8gR2V0IGJvb2tpbmcgcmVzb3VyY2UgSUQgZnJvbSBBamF4IFBvc3QgUmVxdWVzdCAgLT4gdGhpcy5kYXRhID0gJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0XHR2YXIgY2FsZW5kYXJfcmVzb3VyY2VfaWQgPSB3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXScsIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApO1xyXG5cdFx0aWYgKCAobnVsbCAhPT0gY2FsZW5kYXJfcmVzb3VyY2VfaWQpICYmICgnJyAhPT0gY2FsZW5kYXJfcmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdGNhbGVuZGFyX3Jlc291cmNlX2lkID0gcGFyc2VJbnQoIGNhbGVuZGFyX3Jlc291cmNlX2lkICk7XHJcblx0XHRcdGlmICggY2FsZW5kYXJfcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdFx0cmV0dXJuIGNhbGVuZGFyX3Jlc291cmNlX2lkO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gMDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgcGFyYW1ldGVyIGZyb20gVVJMICAtICBwYXJzZSBVUkwgcGFyYW1ldGVycywgIGxpa2UgdGhpczpcclxuXHQgKiBhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zXHJcblx0ICogQHBhcmFtIG5hbWUgIHBhcmFtZXRlciAgbmFtZSwgIGxpa2UgJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXSdcclxuXHQgKiBAcGFyYW0gdXJsXHQncGFyYW1ldGVyICBzdHJpbmcgVVJMJ1xyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gICBwYXJhbWV0ZXIgdmFsdWVcclxuXHQgKlxyXG5cdCAqIEV4YW1wbGU6IFx0XHR3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXScsIHRoaXMuZGF0YSApOyAgLT4gJzInXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfdXJpX3BhcmFtX2J5X25hbWUoIG5hbWUsIHVybCApe1xyXG5cclxuXHRcdHVybCA9IGRlY29kZVVSSUNvbXBvbmVudCggdXJsICk7XHJcblxyXG5cdFx0bmFtZSA9IG5hbWUucmVwbGFjZSggL1tcXFtcXF1dL2csICdcXFxcJCYnICk7XHJcblx0XHR2YXIgcmVnZXggPSBuZXcgUmVnRXhwKCAnWz8mXScgKyBuYW1lICsgJyg9KFteJiNdKil8JnwjfCQpJyApLFxyXG5cdFx0XHRyZXN1bHRzID0gcmVnZXguZXhlYyggdXJsICk7XHJcblx0XHRpZiAoICFyZXN1bHRzICkgcmV0dXJuIG51bGw7XHJcblx0XHRpZiAoICFyZXN1bHRzWyAyIF0gKSByZXR1cm4gJyc7XHJcblx0XHRyZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KCByZXN1bHRzWyAyIF0ucmVwbGFjZSggL1xcKy9nLCAnICcgKSApO1xyXG5cdH1cclxuIiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9mcm9udF9lbmRfbWVzc2FnZXMvd3BiY19mZV9tZXNzYWdlcy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gU2hvdyBNZXNzYWdlcyBhdCBGcm9udC1FZG4gc2lkZVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogTG9nIGFuIHVuZXhwZWN0ZWQgQUpBWCByZXNwb25zZSBmb3IgYnJvd3Nlci1jb25zb2xlIGRpYWdub3N0aWNzLlxuICpcbiAqIFRoZSByZXNwb25zZSBpcyBpbnRlbnRpb25hbGx5IGtlcHQgb3V0IG9mIGZyb250ZW5kIG5vdGljZXMgYmVjYXVzZSBpdCBjYW4gY29udGFpbiBhIGNvbXBsZXRlIEhUTUwgZXJyb3Igb3IgbG9naW4gcGFnZS5cbiAqIExvZ2dpbmcgaXQgaGVyZSBwcmVzZXJ2ZXMgdGhlIHNlcnZlciBwYXlsb2FkIGFuZCByZXF1ZXN0IGNvbnRleHQgZm9yIHN1cHBvcnQgdHJvdWJsZXNob290aW5nLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGFqYXhfYWN0aW9uICAgV29yZFByZXNzIEFKQVggYWN0aW9uIHRoYXQgcHJvZHVjZWQgdGhlIHVuZXhwZWN0ZWQgcmVzcG9uc2UuXG4gKiBAcGFyYW0geyp9ICAgICAgICAgICByZXNwb25zZV9kYXRhIFJhdyByZXNwb25zZSBwYXlsb2FkIHJldHVybmVkIGJ5IHRoZSBzZXJ2ZXIuXG4gKiBAcGFyYW0ge2pxWEhSfG51bGx9ICBqcV94aHIgICAgICAgIGpRdWVyeSBYSFIgb2JqZWN0LCB3aGVuIGF2YWlsYWJsZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIHRleHRfc3RhdHVzICAgalF1ZXJ5IHJlcXVlc3Qgc3RhdHVzIG9yIHN1Y2Nlc3Mgc3RhdGUuXG4gKiBAcGFyYW0ge3N0cmluZ3xFcnJvcn0gZXJyb3JfdGhyb3duIEVycm9yIGRlc2NyaXB0aW9uIG9yIGV4Y2VwdGlvbiByZXBvcnRlZCBieSBqUXVlcnkuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5mdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fbG9nX3VuZXhwZWN0ZWRfYWpheF9yZXNwb25zZSggYWpheF9hY3Rpb24sIHJlc3BvbnNlX2RhdGEsIGpxX3hociwgdGV4dF9zdGF0dXMsIGVycm9yX3Rocm93biApIHtcblx0aWYgKCAhIHdpbmRvdy5jb25zb2xlIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuY29uc29sZS5lcnJvciApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHR0cnkge1xuXHRcdHZhciBjb250ZW50X3R5cGUgPSAnJztcblx0XHRpZiAoIGpxX3hociAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YganFfeGhyLmdldFJlc3BvbnNlSGVhZGVyICkge1xuXHRcdFx0Y29udGVudF90eXBlID0ganFfeGhyLmdldFJlc3BvbnNlSGVhZGVyKCAnY29udGVudC10eXBlJyApIHx8ICcnO1xuXHRcdH1cblxuXHRcdHdpbmRvdy5jb25zb2xlLmVycm9yKCAnW1dQQkNdW0FKQVgtVU5FWFBFQ1RFRC1SRVNQT05TRV0gJyArIGFqYXhfYWN0aW9uLCB7XG5cdFx0XHQnYWN0aW9uJyAgICAgICAgICA6IGFqYXhfYWN0aW9uLFxuXHRcdFx0J2h0dHBfc3RhdHVzJyAgICAgOiBqcV94aHIgJiYganFfeGhyLnN0YXR1cyA/IHBhcnNlSW50KCBqcV94aHIuc3RhdHVzLCAxMCApIDogMCxcblx0XHRcdCdodHRwX3N0YXR1c190ZXh0JzoganFfeGhyICYmIGpxX3hoci5zdGF0dXNUZXh0ID8ganFfeGhyLnN0YXR1c1RleHQgOiAnJyxcblx0XHRcdCd0ZXh0X3N0YXR1cycgICAgIDogdGV4dF9zdGF0dXMgfHwgJycsXG5cdFx0XHQnZXJyb3InICAgICAgICAgICA6IGVycm9yX3Rocm93biB8fCAnJyxcblx0XHRcdCdjb250ZW50X3R5cGUnICAgIDogY29udGVudF90eXBlLFxuXHRcdFx0J3Jlc3BvbnNlJyAgICAgICAgOiByZXNwb25zZV9kYXRhXG5cdFx0fSApO1xuXHR9IGNhdGNoICggbG9nZ2luZ19lcnJvciApIHtcblx0XHQvLyBDb25zb2xlIGRpYWdub3N0aWNzIG11c3QgbmV2ZXIgaW50ZXJydXB0IGZyb250ZW5kIGVycm9yIHJlY292ZXJ5LlxuXHR9XG59XG5cbi8qKlxuICogU2hvdyBtZXNzYWdlIGluIGNvbnRlbnRcbiAqXHJcbiAqIEBwYXJhbSBtZXNzYWdlXHRcdFx0XHRNZXNzYWdlIEhUTUxcclxuICogQHBhcmFtIHBhcmFtcyA9IHtcclxuICpcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICd3YXJuaW5nJyxcdFx0XHRcdFx0XHRcdC8vICdlcnJvcicgfCAnd2FybmluZycgfCAnaW5mbycgfCAnc3VjY2VzcydcclxuICpcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZScgOiAnJyxcdFx0XHRcdC8vIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICAgOiAnaW5zaWRlJ1x0XHQvLyAnaW5zaWRlJyB8ICdiZWZvcmUnIHwgJ2FmdGVyJyB8ICdyaWdodCcgfCAnbGVmdCdcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcdFx0XHRcdFx0XHRcdFx0Ly8gQXBwbHkgIG9ubHkgaWYgXHQnd2hlcmUnICAgOiAnaW5zaWRlJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFx0XHRcdFx0Ly8gc3R5bGVzLCBpZiBuZWVkZWRcclxuICpcdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcdFx0XHRcdFx0XHRcdFx0XHQvLyBob3cgbWFueSBtaWNyb3NlY29uZCB0byAgc2hvdywgIGlmIDAgIHRoZW4gIHNob3cgZm9yZXZlclxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IGZhbHNlXHRcdFx0XHRcdC8vIGlmIHRydWUsICB0aGVuIGRvIG5vdCBzaG93IG1lc3NhZ2UsICBpZiBwcmV2aW9zIG1lc3NhZ2Ugd2FzIG5vdCBoaWRlZCAobm90IGFwcGx5IGlmICd3aGVyZScgICA6ICdpbnNpZGUnIClcclxuICpcdFx0XHRcdH07XHJcbiAqIEV4YW1wbGVzOlxyXG4gKiBcdFx0XHR2YXIgaHRtbF9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoICdZb3UgY2FuIHRlc3QgZGF5cyBzZWxlY3Rpb24gaW4gY2FsZW5kYXInLCB7fSApO1xyXG4gKlxyXG4gKlx0XHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZCcgKSwgeyAndHlwZSc6ICd3YXJuaW5nJywgJ2RlbGF5JzogMTAwMDAsICdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3Nob3dfaGVyZSc6IHsnd2hlcmUnOiAncmlnaHQnLCAnanFfbm9kZSc6IGVsLH0gfSApO1xyXG4gKlxyXG4gKlx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyAgICd0eXBlJyAgICAgOiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gKSApXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnaW5mbycsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0JyxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMTAwMDBcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKlxyXG4gKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCBwYXJhbXMgPSB7fSApe1xyXG5cclxuXHR2YXIgcGFyYW1zX2RlZmF1bHQgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgIDogJ3dhcm5pbmcnLFx0XHRcdFx0XHRcdFx0Ly8gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJyB8ICdzdWNjZXNzJ1xyXG5cdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnIDogJycsXHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgICA6ICdpbnNpZGUnXHRcdC8vICdpbnNpZGUnIHwgJ2JlZm9yZScgfCAnYWZ0ZXInIHwgJ3JpZ2h0JyB8ICdsZWZ0J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIEFwcGx5ICBvbmx5IGlmIFx0J3doZXJlJyAgIDogJ2luc2lkZSdcclxuXHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHRcdFx0XHQvLyBzdHlsZXMsIGlmIG5lZWRlZFxyXG5cdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG5cdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHRcdFx0XHRcdFx0XHRcdFx0Ly8gaG93IG1hbnkgbWljcm9zZWNvbmQgdG8gIHNob3csICBpZiAwICB0aGVuICBzaG93IGZvcmV2ZXJcblx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IGZhbHNlLFx0XHRcdFx0XHQvLyBpZiB0cnVlLCAgdGhlbiBkbyBub3Qgc2hvdyBtZXNzYWdlLCAgaWYgcHJldmlvcyBtZXNzYWdlIHdhcyBub3QgaGlkZWQgKG5vdCBhcHBseSBpZiAnd2hlcmUnICAgOiAnaW5zaWRlJyApXG5cdFx0XHRcdFx0XHRcdFx0J2lzX3Njcm9sbCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIGlzIHNjcm9sbCAgdG8gIHRoaXMgZWxlbWVudFxuXHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnOiAnaHRtbCdcdFx0XHRcdFx0XHRcdC8vICdodG1sJyBmb3IgdHJ1c3RlZCBsZWdhY3kgY29udGVudCB8ICd0ZXh0JyBmb3IgZWRpdGFibGUvdXNlciBjb250ZW50XG5cdFx0XHRcdFx0XHR9O1xyXG5cdGZvciAoIHZhciBwX2tleSBpbiBwYXJhbXMgKXtcclxuXHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcGFyYW1zWyBwX2tleSBdO1xyXG5cdH1cclxuXHRwYXJhbXMgPSBwYXJhbXNfZGVmYXVsdDtcblxuXHRpZiAoICd0ZXh0JyA9PT0gcGFyYW1zWyAnY29udGVudF9tb2RlJyBdICkge1xuXHRcdG1lc3NhZ2UgPSBqUXVlcnkoICc8ZGl2PicgKS50ZXh0KCBudWxsID09PSBtZXNzYWdlIHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgbWVzc2FnZSA/ICcnIDogU3RyaW5nKCBtZXNzYWdlICkgKS5odG1sKCkucmVwbGFjZSggL1xcbi9nLCAnPGJyIC8+JyApO1xuXHR9XG5cclxuICAgIHZhciB1bmlxdWVfZGl2X2lkID0gbmV3IERhdGUoKTtcclxuICAgIHVuaXF1ZV9kaXZfaWQgPSAnd3BiY19ub3RpY2VfJyArIHVuaXF1ZV9kaXZfaWQuZ2V0VGltZSgpO1xyXG5cclxuXHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlJztcclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdlcnJvcicgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2VfZXJyb3InO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JlcG9ydF9nbWFpbGVycm9ycmVkXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICd3YXJuaW5nJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV93YXJuaW5nJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl93YXJuaW5nXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdpbmZvJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV9pbmZvJztcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnc3VjY2VzcycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2Vfc3VjY2Vzcyc7XHJcblx0XHRtZXNzYWdlID0gJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fZG9uZV9vdXRsaW5lXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHJcblx0dmFyIHNjcm9sbF90b19lbGVtZW50ID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdfc2Nyb2xsXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7XCI+PC9kaXY+JztcclxuXHRtZXNzYWdlID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdcIiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlICcgKyBwYXJhbXNbJ2Nzc19jbGFzcyddICsgJ1wiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ3N0eWxlJyBdICsgJ1wiPicgKyBtZXNzYWdlICsgJzwvZGl2Pic7XHJcblxyXG5cclxuXHR2YXIganFfZWxfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdHZhciBpc19zaG93X21lc3NhZ2UgPSB0cnVlO1xyXG5cclxuXHRpZiAoICdpbnNpZGUnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGlmICggcGFyYW1zWyAnaXNfYXBwZW5kJyBdICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFwcGVuZCggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYXBwZW5kKCBtZXNzYWdlICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5odG1sKCBzY3JvbGxfdG9fZWxlbWVudCArIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ2JlZm9yZScgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLnNpYmxpbmdzKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ2FmdGVyJyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkubmV4dEFsbCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcdFx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGJlZm9yZShmb3IgaGFuZHkgc2Nyb2xsKVxyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hZnRlciggbWVzc2FnZSApO1xyXG5cdFx0fVxyXG5cclxuXHR9IGVsc2UgaWYgKCAncmlnaHQnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5uZXh0QWxsKCAnLndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9yaWdodCcgKS5maW5kKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1x0XHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYmVmb3JlKGZvciBoYW5keSBzY3JvbGwpXHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFmdGVyKCAnPGRpdiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9yaWdodFwiPicgKyBtZXNzYWdlICsgJzwvZGl2PicgKTtcclxuXHRcdH1cclxuXHR9IGVsc2UgaWYgKCAnbGVmdCcgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLnNpYmxpbmdzKCAnLndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9sZWZ0JyApLmZpbmQoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHRcdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBiZWZvcmUoZm9yIGhhbmR5IHNjcm9sbClcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCAnPGRpdiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9sZWZ0XCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCAgICggaXNfc2hvd19tZXNzYWdlICkgICYmICAoIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApID4gMCApICAgKXtcclxuXHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRqUXVlcnkoICcjJyArIHVuaXF1ZV9kaXZfaWQgKS5mYWRlT3V0KCAxNTAwICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSAsIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApICAgKTtcclxuXHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyMiA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkudHJpZ2dlciggJ2hpZGUnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSwgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSArIDE1MDEgKSApO1xyXG5cdH1cclxuXHJcblx0Ly8gQ2hlY2sgIGlmIHNob3dlZCBtZXNzYWdlIGluIHNvbWUgaGlkZGVuIHBhcmVudCBzZWN0aW9uIGFuZCBzaG93IGl0LiBCdXQgaXQgbXVzdCAgYmUgbG93ZXIgdGhhbiAnLndwYmNfY29udGFpbmVyJ1xyXG5cdHZhciBwYXJlbnRfZWxzID0galF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkucGFyZW50cygpLm1hcCggZnVuY3Rpb24gKCl7XHJcblx0XHRpZiAoICghalF1ZXJ5KCB0aGlzICkuaXMoICd2aXNpYmxlJyApKSAmJiAoalF1ZXJ5KCAnLndwYmNfY29udGFpbmVyJyApLmhhcyggdGhpcyApKSApe1xyXG5cdFx0XHRqUXVlcnkoIHRoaXMgKS5zaG93KCk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHRpZiAoIHBhcmFtc1sgJ2lzX3Njcm9sbCcgXSApe1xyXG5cdFx0d3BiY19kb19zY3JvbGwoICcjJyArIHVuaXF1ZV9kaXZfaWQgKyAnX3Njcm9sbCcgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB1bmlxdWVfZGl2X2lkO1xyXG59XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlLiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcigganFfbm9kZSwgbWVzc2FnZSwgY29udGVudF9tb2RlICl7XG5cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZScgICAgICAgOiBjb250ZW50X21vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdyaWdodCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlIFVOREVSIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yX3VuZGVyX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UsIG1lc3NhZ2VfZGVsYXksIGNvbnRlbnRfbW9kZSApe1xuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKG1lc3NhZ2VfZGVsYXkpICl7XG5cdFx0XHRtZXNzYWdlX2RlbGF5ID0gMFxuXHRcdH1cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IG1lc3NhZ2VfZGVsYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJyAgICAgICA6IGNvbnRlbnRfbW9kZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVycm9yIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3JfYWJvdmVfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgbWVzc2FnZV9kZWxheSwgY29udGVudF9tb2RlICl7XG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAobWVzc2FnZV9kZWxheSkgKXtcblx0XHRcdG1lc3NhZ2VfZGVsYXkgPSAxMDAwMFxuXHRcdH1cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IG1lc3NhZ2VfZGVsYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJyAgICAgICA6IGNvbnRlbnRfbW9kZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2JlZm9yZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGpxX25vZGUsIG1lc3NhZ2UsIGNvbnRlbnRfbW9kZSApe1xuXG5cdFx0Y29udGVudF9tb2RlID0gKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGNvbnRlbnRfbW9kZSApID8gJ2h0bWwnIDogY29udGVudF9tb2RlO1xuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZScgICAgICAgOiBjb250ZW50X21vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdyaWdodCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHdwYmNfaGlnaGxpZ2h0X2Vycm9yX29uX2Zvcm1fZmllbGQoIGpxX25vZGUgKTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZ191bmRlcl9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlLCBjb250ZW50X21vZGUgKXtcblxuXHRcdGNvbnRlbnRfbW9kZSA9ICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBjb250ZW50X21vZGUgKSA/ICdodG1sJyA6IGNvbnRlbnRfbW9kZTtcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnICAgICAgIDogY29udGVudF9tb2RlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYWZ0ZXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogV2FybmluZyBtZXNzYWdlIEFCT1ZFIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfYWJvdmVfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgY29udGVudF9tb2RlICl7XG5cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJyAgICAgICA6IGNvbnRlbnRfbW9kZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2JlZm9yZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhpZ2hsaWdodCBFcnJvciBpbiBzcGVjaWZpYyBmaWVsZFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpxX25vZGVcdFx0XHRcdFx0c3RyaW5nIG9yIGpRdWVyeSBlbGVtZW50LCAgd2hlcmUgc2Nyb2xsICB0b1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaGlnaGxpZ2h0X2Vycm9yX29uX2Zvcm1fZmllbGQoIGpxX25vZGUgKXtcclxuXHJcblx0XHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5sZW5ndGggKXtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIGpRdWVyeSgganFfbm9kZSApLmlzKCAnOmlucHV0JyApICl7XHJcblx0XHRcdC8vIFNpdHVhdGlvbiB3aXRoICBjaGVja2JveGVzIG9yIHJhZGlvICBidXR0b25zXHJcblx0XHRcdHZhciBqcV9ub2RlX2FyciA9IGpRdWVyeSgganFfbm9kZSApLmZpbmQoICc6aW5wdXQnICk7XHJcblx0XHRcdGlmICggIWpxX25vZGVfYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVyblxyXG5cdFx0XHR9XHJcblx0XHRcdGpxX25vZGUgPSBqcV9ub2RlX2Fyci5nZXQoIDAgKTtcclxuXHRcdH1cclxuXHRcdHZhciBwYXJhbXMgPSB7fTtcclxuXHRcdHBhcmFtc1sgJ2RlbGF5JyBdID0gMTAwMDA7XHJcblxyXG5cdFx0aWYgKCAhalF1ZXJ5KCBqcV9ub2RlICkuaGFzQ2xhc3MoICd3cGJjX2Zvcm1fZmllbGRfZXJyb3InICkgKXtcclxuXHJcblx0XHRcdGpRdWVyeSgganFfbm9kZSApLmFkZENsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApXHJcblxyXG5cdFx0XHRpZiAoIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApID4gMCApe1xyXG5cdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGpRdWVyeSgganFfbm9kZSApLnJlbW92ZUNsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICAsIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuLyoqXHJcbiAqIFNjcm9sbCB0byBzcGVjaWZpYyBlbGVtZW50XHJcbiAqXHJcbiAqIEBwYXJhbSBqcV9ub2RlXHRcdFx0XHRcdHN0cmluZyBvciBqUXVlcnkgZWxlbWVudCwgIHdoZXJlIHNjcm9sbCAgdG9cclxuICogQHBhcmFtIGV4dHJhX3NoaWZ0X29mZnNldFx0XHRpbnQgc2hpZnQgb2Zmc2V0IGZyb20gIGpxX25vZGVcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZG9fc2Nyb2xsKCBqcV9ub2RlICwgZXh0cmFfc2hpZnRfb2Zmc2V0ID0gMCApe1xyXG5cclxuXHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5sZW5ndGggKXtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0dmFyIHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLm9mZnNldCgpLnRvcDtcclxuXHJcblx0aWYgKCB0YXJnZXRPZmZzZXQgPD0gMCApe1xyXG5cdFx0aWYgKCAwICE9IGpRdWVyeSgganFfbm9kZSApLm5leHRBbGwoICc6dmlzaWJsZScgKS5sZW5ndGggKXtcclxuXHRcdFx0dGFyZ2V0T2Zmc2V0ID0galF1ZXJ5KCBqcV9ub2RlICkubmV4dEFsbCggJzp2aXNpYmxlJyApLmZpcnN0KCkub2Zmc2V0KCkudG9wO1xyXG5cdFx0fSBlbHNlIGlmICggMCAhPSBqUXVlcnkoIGpxX25vZGUgKS5wYXJlbnQoKS5uZXh0QWxsKCAnOnZpc2libGUnICkubGVuZ3RoICl7XHJcblx0XHRcdHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLnBhcmVudCgpLm5leHRBbGwoICc6dmlzaWJsZScgKS5maXJzdCgpLm9mZnNldCgpLnRvcDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggalF1ZXJ5KCAnI3dwYWRtaW5iYXInICkubGVuZ3RoID4gMCApe1xyXG5cdFx0dGFyZ2V0T2Zmc2V0ID0gdGFyZ2V0T2Zmc2V0IC0gNTAgLSA1MDtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGFyZ2V0T2Zmc2V0ID0gdGFyZ2V0T2Zmc2V0IC0gMjAgLSA1MDtcclxuXHR9XHJcblx0dGFyZ2V0T2Zmc2V0ICs9IGV4dHJhX3NoaWZ0X29mZnNldDtcclxuXHJcblx0Ly8gU2Nyb2xsIG9ubHkgIGlmIHdlIGRpZCBub3Qgc2Nyb2xsIGJlZm9yZVxyXG5cdGlmICggISBqUXVlcnkoICdodG1sLGJvZHknICkuaXMoICc6YW5pbWF0ZWQnICkgKXtcclxuXHRcdGpRdWVyeSggJ2h0bWwsYm9keScgKS5hbmltYXRlKCB7c2Nyb2xsVG9wOiB0YXJnZXRPZmZzZXR9LCA1MDAgKTtcclxuXHR9XHJcbn1cclxuXHJcbiIsIlxyXG4vLyBGaXhJbjogMTAuMi4wLjQuXHJcbi8qKlxyXG4gKiBEZWZpbmUgUG9wb3ZlcnMgZm9yIFRpbWVsaW5lcyBpbiBXUCBCb29raW5nIENhbGVuZGFyXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd8Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX3RpcHB5X3BvcG92ZXIoKXtcclxuXHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdGNvbnNvbGUubG9nKCAnV1BCQyBFcnJvci4gd3BiY190aXBweSB3YXMgbm90IGRlZmluZWQuJyApO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHR3cGJjX3RpcHB5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snLCB7XHJcblx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHRcdFx0dmFyIHBvcG92ZXJfdGl0bGUgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKTtcclxuXHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cInBvcG92ZXIgcG9wb3Zlcl90aXBweVwiPidcclxuXHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jbG9zZVwiPjxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDp0aGlzLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5fdGlwcHkuaGlkZSgpO1wiID4mdGltZXM7PC9hPjwvZGl2PidcclxuXHRcdFx0XHQrIHBvcG92ZXJfY29udGVudFxyXG5cdFx0XHRcdCsgJzwvZGl2Pic7XHJcblx0XHR9LFxyXG5cdFx0YWxsb3dIVE1MICAgICAgICA6IHRydWUsXHJcblx0XHR0cmlnZ2VyICAgICAgICAgIDogJ21hbnVhbCcsXHJcblx0XHRpbnRlcmFjdGl2ZSAgICAgIDogdHJ1ZSxcclxuXHRcdGhpZGVPbkNsaWNrICAgICAgOiBmYWxzZSxcclxuXHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktcG9wb3ZlcicsXHJcblx0XHRwbGFjZW1lbnQgICAgICAgIDogJ2JvdHRvbS1zdGFydCcsXHJcblx0XHR0b3VjaCAgICAgICAgICAgIDogWydob2xkJywgNTAwXSxcclxuXHR9ICk7XHJcblx0alF1ZXJ5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snICkub24oICdjbGljaycsIGZ1bmN0aW9uICgpe1xyXG5cdFx0aWYgKCB0aGlzLl90aXBweS5zdGF0ZS5pc1Zpc2libGUgKXtcclxuXHRcdFx0dGhpcy5fdGlwcHkuaGlkZSgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5fdGlwcHkuc2hvdygpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHR3cGJjX2RlZmluZV9oaWRlX3RpcHB5X29uX3Njcm9sbCgpO1xyXG59XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX2hpZGVfdGlwcHlfb25fc2Nyb2xsKCl7XHJcblx0alF1ZXJ5KCAnLmZsZXhfdGxfX3Njcm9sbGluZ19zZWN0aW9uMiwuZmxleF90bF9fc2Nyb2xsaW5nX3NlY3Rpb25zJyApLm9uKCAnc2Nyb2xsJywgZnVuY3Rpb24gKCBldmVudCApe1xyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfdGlwcHkpICl7XHJcblx0XHRcdHdwYmNfdGlwcHkuaGlkZUFsbCgpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG4iLCIvKipcclxuICogV1BCQyBjYWxlbmRhciBsb2FkZXIgYm9vdHN0cmFwLlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqIC0gRmluZHMgZXZlcnkgLmNhbGVuZGFyX2xvYWRlcl9mcmFtZVtkYXRhLXdwYmMtcmlkXSBvbiB0aGUgcGFnZSAobm93IG9yIGxhdGVyKS5cclxuICogLSBGb3IgZWFjaCBsb2FkZXIgZWxlbWVudCwgd2FpdHMgYSBcImdyYWNlXCIgcGVyaW9kIChkYXRhLXdwYmMtZ3JhY2UsIGRlZmF1bHQgODAwMCBtcyk6XHJcbiAqICAgICAtIElmIHRoZSByZWFsIGNhbGVuZGFyIGFwcGVhcnM6IGRvIG5vdGhpbmcgKGxvYWRlciBuYXR1cmFsbHkgcmVwbGFjZWQpLlxyXG4gKiAgICAgLSBJZiBub3Q6IHNob3cgYSBoZWxwZnVsIG1lc3NhZ2UgKG1pc3NpbmcgalF1ZXJ5L193cGJjL2RhdGVwaWNrKSBvciBhIGR1cGxpY2F0ZSBub3RpY2UuXHJcbiAqIC0gV29ya3Mgd2l0aCBtdWx0aXBsZSBjYWxlbmRhcnMgYW5kIGV2ZW4gZHVwbGljYXRlIFJJRHMgb24gdGhlIHNhbWUgcGFnZS5cclxuICogLSBObyBpbmxpbmUgSlMgbmVlZGVkIGluIHRoZSBzaG9ydGNvZGUvdGVtcGxhdGUgb3V0cHV0LlxyXG4gKlxyXG4gKiBGaWxlOiAgLi4vaW5jbHVkZXMvX19qcy9jbGllbnQvY2FsL3dwYmNfY2FsX2xvYWRlci5qc1xyXG4gKlxyXG4gKiBAc2luY2UgICAgMTAuMTQuNVxyXG4gKiBAbW9kaWZpZWQgMjAyNS0wOS0wNyAxMjoyMVxyXG4gKiBAdmVyc2lvbiAgMS4wLjBcclxuICpcclxuICovXHJcbi8qKlxyXG4gKiBXUEJDIGNhbGVuZGFyIGxvYWRlciBib290c3RyYXAuXHJcbiAqIC0gQXV0by1kZXRlY3RzIC5jYWxlbmRhcl9sb2FkZXJfZnJhbWVbZGF0YS13cGJjLXJpZF0gYmxvY2tzLlxyXG4gKiAtIFdhaXRzIGEgXCJncmFjZVwiIHBlcmlvZCBwZXIgZWxlbWVudCBiZWZvcmUgc2hvd2luZyBhIGhlbHBmdWwgbWVzc2FnZVxyXG4gKiAgIGlmIHRoZSByZWFsIGNhbGVuZGFyIGhhc24ndCByZXBsYWNlZCB0aGUgbG9hZGVyLlxyXG4gKiAtIE11bHRpcGxlIGNhbGVuZGFycyBhbmQgZHVwbGljYXRlIFJJRHMgYXJlIGhhbmRsZWQuXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqIFNtYWxsIHV0aWxpdGllcyAoc25ha2VfY2FzZSlcclxuXHQgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqIFRyYWNrIHByb2Nlc3NlZCBsb2FkZXIgZWxlbWVudHM7IGZhbGxiYWNrIHRvIGRhdGEgZmxhZyBpZiBXZWFrU2V0IG1pc3NpbmcuICovXHJcblx0dmFyIHByb2Nlc3NlZF9zZXQgPSB0eXBlb2YgV2Vha1NldCA9PT0gJ2Z1bmN0aW9uJyA/IG5ldyBXZWFrU2V0KCkgOiBudWxsO1xyXG5cclxuXHQvKiogUmV0dXJuIGZpcnN0IG1hdGNoIGluc2lkZSBvcHRpb25hbCByb290LiAqL1xyXG5cdGZ1bmN0aW9uIHF1ZXJ5X29uZShzZWxlY3Rvciwgcm9vdCkge1xyXG5cdFx0cmV0dXJuIChyb290IHx8IGQpLnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICk7XHJcblx0fVxyXG5cclxuXHQvKiogUmV0dXJuIE5vZGVMaXN0IG9mIG1hdGNoZXMgaW5zaWRlIG9wdGlvbmFsIHJvb3QuICovXHJcblx0ZnVuY3Rpb24gcXVlcnlfYWxsKHNlbGVjdG9yLCByb290KSB7XHJcblx0XHRyZXR1cm4gKHJvb3QgfHwgZCkucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKTtcclxuXHR9XHJcblxyXG5cdC8qKiBSdW4gYSBjYWxsYmFjayB3aGVuIERPTSBpcyByZWFkeS4gKi9cclxuXHRmdW5jdGlvbiBvbl9yZWFkeShmbikge1xyXG5cdFx0aWYgKCBkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIGZuICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRmbigpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqIENsZWFyIGludGVydmFsIHNhZmVseS4gKi9cclxuXHRmdW5jdGlvbiBzYWZlX2NsZWFyKGludGVydmFsX2lkKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHR3LmNsZWFySW50ZXJ2YWwoIGludGVydmFsX2lkICk7XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKiBNYXJrIGVsZW1lbnQgcHJvY2Vzc2VkIChXZWFrU2V0IG9yIGRhdGEgYXR0cmlidXRlKS4gKi9cclxuXHRmdW5jdGlvbiBtYXJrX3Byb2Nlc3NlZChlbCkge1xyXG5cdFx0aWYgKCBwcm9jZXNzZWRfc2V0ICkge1xyXG5cdFx0XHRwcm9jZXNzZWRfc2V0LmFkZCggZWwgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC53cGJjUHJvY2Vzc2VkID0gJzEnO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqIENoZWNrIGlmIGVsZW1lbnQgd2FzIHByb2Nlc3NlZC4gKi9cclxuXHRmdW5jdGlvbiBpc19wcm9jZXNzZWQoZWwpIHtcclxuXHRcdHJldHVybiBwcm9jZXNzZWRfc2V0ID8gcHJvY2Vzc2VkX3NldC5oYXMoIGVsICkgOiAoZWwgJiYgZWwuZGF0YXNldCAmJiBlbC5kYXRhc2V0LndwYmNQcm9jZXNzZWQgPT09ICcxJyk7XHJcblx0fVxyXG5cclxuXHQvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKiBNZXNzYWdlcyAoZml4ZWQgRW5nbGlzaCBzdHJpbmdzOyBubyBpMThuKVxyXG5cdCAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBCdWlsZCBmaXhlZCBFbmdsaXNoIG1lc3NhZ2VzIGZvciBhIHJlc291cmNlLlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfG51bWJlcn0gcmlkXHJcblx0ICogQHJldHVybiB7e2R1cGxpY2F0ZTpzdHJpbmcsc3VwcG9ydDpzdHJpbmcsbGliX2pxOnN0cmluZyxsaWJfZHA6c3RyaW5nLGxpYl93cGJjOnN0cmluZ319XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gZ2V0X21lc3NhZ2VzKHJpZCkge1xyXG5cdFx0dmFyIHJpZF9pbnQgPSBwYXJzZUludCggcmlkLCAxMCApO1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0ZHVwbGljYXRlICA6XHJcblx0XHRcdFx0J1lvdSBoYXZlIGFkZGVkIHRoZSBzYW1lIGNhbGVuZGFyIChJRCA9ICcgKyByaWRfaW50ICsgJykgbW9yZSB0aGFuIG9uY2Ugb24gdGhpcyBwYWdlLiAnICtcclxuXHRcdFx0XHQnUGxlYXNlIGtlZXAgb25seSBvbmUgY2FsZW5kYXIgd2l0aCB0aGUgc2FtZSBJRCBvbiBhIHBhZ2UgdG8gYXZvaWQgY29uZmxpY3RzLicsXHJcblx0XHRcdGluaXRfZmFpbGVkOlxyXG5cdFx0XHRcdCdUaGUgY2FsZW5kYXIgY291bGQgbm90IGJlIGluaXRpYWxpemVkIG9uIHRoaXMgcGFnZS4nICsgJ1xcbicgK1xyXG5cdFx0XHRcdCdQbGVhc2UgY2hlY2sgeW91ciBicm93c2VyIGNvbnNvbGUgZm9yIEphdmFTY3JpcHQgZXJyb3JzIGFuZCBjb25mbGljdHMgd2l0aCBvdGhlciBzY3JpcHRzL3BsdWdpbnMuJyxcclxuXHRcdFx0c3VwcG9ydCAgICA6ICcnLCAvKiAnQ29udGFjdCBzdXBwb3J0QHdwYm9va2luZ2NhbGVuZGFyLmNvbSBpZiB5b3UgaGF2ZSBhbnkgcXVlc3Rpb25zLicsICovXHJcblx0XHRcdGxpYl9qcSAgICAgOlxyXG5cdFx0XHRcdCdJdCBhcHBlYXJzIHRoYXQgdGhlIFwialF1ZXJ5XCIgbGlicmFyeSBpcyBub3QgbG9hZGluZyBjb3JyZWN0bHkuJyArICdcXG4nICtcclxuXHRcdFx0XHQnRm9yIG1vcmUgaW5mb3JtYXRpb24sIHBsZWFzZSByZWZlciB0byB0aGlzIHBhZ2U6IGh0dHBzOi8vd3Bib29raW5nY2FsZW5kYXIuY29tL2ZhcS8nLFxyXG5cdFx0XHRsaWJfZHAgICAgIDpcclxuXHRcdFx0XHQnSXQgYXBwZWFycyB0aGF0IHRoZSBcImpRdWVyeS5kYXRlcGlja1wiIGxpYnJhcnkgaXMgbm90IGxvYWRpbmcgY29ycmVjdGx5LicgKyAnXFxuJyArXHJcblx0XHRcdFx0J0ZvciBtb3JlIGluZm9ybWF0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhpcyBwYWdlOiBodHRwczovL3dwYm9va2luZ2NhbGVuZGFyLmNvbS9mYXEvJyxcclxuXHRcdFx0bGliX3dwYmMgICA6XHJcblx0XHRcdFx0J0l0IGFwcGVhcnMgdGhhdCB0aGUgXCJfd3BiY1wiIGxpYnJhcnkgaXMgbm90IGxvYWRpbmcgY29ycmVjdGx5LicgKyAnXFxuJyArXHJcblx0XHRcdFx0J1BsZWFzZSBlbmFibGUgdGhlIGxvYWRpbmcgb2YgSlMvQ1NTIGZpbGVzIGZvciB0aGlzIHBhZ2Ugb24gdGhlIFwiV1AgQm9va2luZyBDYWxlbmRhclwiIC0gXCJTZXR0aW5ncyBHZW5lcmFsXCIgLSBcIkFkdmFuY2VkXCIgcGFnZScgKyAnXFxuJyArXHJcblx0XHRcdFx0J0ZvciBtb3JlIGluZm9ybWF0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhpcyBwYWdlOiBodHRwczovL3dwYm9va2luZ2NhbGVuZGFyLmNvbS9mYXEvJ1xyXG5cdFx0fTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdyYXAgcGxhaW4gdGV4dCAod2l0aCBuZXdsaW5lcykgaW4gYSBzbWFsbCBIVE1MIGNvbnRhaW5lci5cclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbXNnXHJcblx0ICogQHJldHVybiB7c3RyaW5nfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdyYXBfaHRtbChtc2cpIHtcclxuXHRcdHJldHVybiAnPGRpdiBzdHlsZT1cImZvbnQtc2l6ZToxM3B4O21hcmdpbjoxMHB4O1wiPicgKyBTdHJpbmcoIG1zZyB8fCAnJyApLnJlcGxhY2UoIC9cXG4vZywgJzxicj4nICkgKyAnPC9kaXY+JztcclxuXHR9XHJcblxyXG5cdC8qKiBMaWJyYXJ5IHByZXNlbmNlIGNoZWNrcyAoZmFzdCAmIGNoZWFwKS4gKi9cclxuXHRmdW5jdGlvbiBoYXNfanEoKSB7XHJcblx0XHRyZXR1cm4gISEody5qUXVlcnkgJiYgalF1ZXJ5LmZuICYmIHR5cGVvZiBqUXVlcnkuZm4ub24gPT09ICdmdW5jdGlvbicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaGFzX2RwKCkge1xyXG5cdFx0cmV0dXJuICEhKHcualF1ZXJ5ICYmIGpRdWVyeS5kYXRlcGljayk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoYXNfd3BiYygpIHtcclxuXHRcdHJldHVybiAhISh3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBub3JtYWxpemVfcmlkKHJpZCkge1xyXG5cdFx0dmFyIG4gPSBwYXJzZUludCggcmlkLCAxMCApO1xyXG5cdFx0cmV0dXJuIChuID4gMCkgPyBTdHJpbmcoIG4gKSA6ICcnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3JpZF9jb3VudHMocmlkKSB7XHJcblx0XHR2YXIgciA9IG5vcm1hbGl6ZV9yaWQoIHJpZCApO1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0cmlkICAgICAgIDogcixcclxuXHRcdFx0bG9hZGVycyAgIDogciA/IHF1ZXJ5X2FsbCggJy5jYWxlbmRhcl9sb2FkZXJfZnJhbWVbZGF0YS13cGJjLXJpZD1cIicgKyByICsgJ1wiXScgKS5sZW5ndGggOiAwLFxyXG5cdFx0XHRjb250YWluZXJzOiByID8gcXVlcnlfYWxsKCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgciApLmxlbmd0aCA6IDBcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19kdXBsaWNhdGVfcmlkKHJpZCkge1xyXG5cdFx0dmFyIGMgPSBnZXRfcmlkX2NvdW50cyggcmlkICk7XHJcblx0XHRyZXR1cm4gKGMubG9hZGVycyA+IDEpIHx8IChjLmNvbnRhaW5lcnMgPiAxKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGVybWluZSBpZiB0aGUgbG9hZGVyIGhhcyBiZWVuIHJlcGxhY2VkIGJ5IHRoZSByZWFsIGNhbGVuZGFyLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fSBlbCAgICAgICBMb2FkZXIgZWxlbWVudFxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSByaWQgICAgICAgUmVzb3VyY2UgSURcclxuXHQgKiBAcGFyYW0ge0VsZW1lbnR8bnVsbH0gY29udGFpbmVyIE9wdGlvbmFsICNjYWxlbmRhcl9ib29raW5ne3JpZH0gZWxlbWVudFxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gaXNfcmVwbGFjZWQoZWwsIHJpZCwgY29udGFpbmVyKSB7XHJcblx0XHR2YXIgbG9hZGVyX3N0aWxsX2luX2RvbSA9IGQuYm9keS5jb250YWlucyggZWwgKTtcclxuXHRcdHZhciBjYWxlbmRhcl9leGlzdHMgICAgID0gISFxdWVyeV9vbmUoICcud3BiY19jYWxlbmRhcl9pZF8nICsgcmlkLCBjb250YWluZXIgfHwgZCApO1xyXG5cdFx0cmV0dXJuICghbG9hZGVyX3N0aWxsX2luX2RvbSkgfHwgY2FsZW5kYXJfZXhpc3RzO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU3RhcnQgd2F0Y2hlciBmb3IgYSBzaW5nbGUgbG9hZGVyIGVsZW1lbnQuXHJcblx0ICogLSBQb2xscyBhbmQgb2JzZXJ2ZXMgdGhlIGNhbGVuZGFyIGNvbnRhaW5lci5cclxuXHQgKiAtIEFmdGVyIGdyYWNlLCBpbmplY3RzIGEgc3VpdGFibGUgbWVzc2FnZSBpZiBub3QgcmVwbGFjZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGVsXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gc3RhcnRfZm9yKGVsKSB7XHJcblx0XHRpZiAoICEgZWwgfHwgaXNfcHJvY2Vzc2VkKCBlbCApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRtYXJrX3Byb2Nlc3NlZCggZWwgKTtcclxuXHJcblx0XHR2YXIgcmlkID0gZWwuZGF0YXNldC53cGJjUmlkO1xyXG5cdFx0aWYgKCAhIHJpZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBncmFjZV9tcyA9IHBhcnNlSW50KCBlbC5kYXRhc2V0LndwYmNHcmFjZSB8fCAnODAwMCcsIDEwICk7XHJcblx0XHRpZiAoICEgKGdyYWNlX21zID4gMCkgKSB7XHJcblx0XHRcdGdyYWNlX21zID0gODAwMDtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY29udGFpbmVyX2lkID0gJ2NhbGVuZGFyX2Jvb2tpbmcnICsgcmlkO1xyXG5cdFx0dmFyIGNvbnRhaW5lciAgICA9IGQuZ2V0RWxlbWVudEJ5SWQoIGNvbnRhaW5lcl9pZCApO1xyXG5cdFx0dmFyIHRleHRfZWwgICAgICA9IHF1ZXJ5X29uZSggJy5jYWxlbmRhcl9sb2FkZXJfdGV4dCcsIGVsICk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gcmVwbGFjZWRfbm93KCkge1xyXG5cdFx0XHRyZXR1cm4gaXNfcmVwbGFjZWQoIGVsLCByaWQsIGNvbnRhaW5lciApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEFscmVhZHkgcmVwbGFjZWQgLT4gbm90aGluZyB0byBkby5cclxuXHRcdGlmICggcmVwbGFjZWRfbm93KCkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAxKSBDaGVhcCBwb2xsaW5nLlxyXG5cdFx0dmFyIHBvbGxfaWQgPSB3LnNldEludGVydmFsKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggcmVwbGFjZWRfbm93KCkgKSB7XHJcblx0XHRcdFx0c2FmZV9jbGVhciggcG9sbF9pZCApO1xyXG5cdFx0XHRcdGlmICggb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sIDI1MCApO1xyXG5cclxuXHRcdC8vIDIpIE11dGF0aW9uT2JzZXJ2ZXIgZm9yIGZhc3RlciByZWFjdGlvbi5cclxuXHRcdHZhciBvYnNlcnZlciA9IG51bGw7XHJcblx0XHRpZiAoIGNvbnRhaW5lciAmJiAnTXV0YXRpb25PYnNlcnZlcicgaW4gdyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRpZiAoIHJlcGxhY2VkX25vdygpICkge1xyXG5cdFx0XHRcdFx0XHRzYWZlX2NsZWFyKCBwb2xsX2lkICk7XHJcblx0XHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRvYnNlcnZlci5vYnNlcnZlKCBjb250YWluZXIsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0gKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAzKSBGaW5hbCBkZWNpc2lvbiBhZnRlciBncmFjZSBwZXJpb2QuXHJcblx0XHR3LnNldFRpbWVvdXQoIGZ1bmN0aW9uIGZpbmFsaXplX2FmdGVyX2dyYWNlKCkge1xyXG5cdFx0XHRpZiAoIHJlcGxhY2VkX25vdygpICkge1xyXG5cdFx0XHRcdHNhZmVfY2xlYXIoIHBvbGxfaWQgKTtcclxuXHRcdFx0XHRpZiAoIG9ic2VydmVyICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIE0gPSBnZXRfbWVzc2FnZXMoIHJpZCApO1xyXG5cdFx0XHR2YXIgbXNnO1xyXG5cdFx0XHRpZiAoICEgaGFzX2pxKCkgKSB7XHJcblx0XHRcdFx0bXNnID0gTS5saWJfanE7XHJcblx0XHRcdH0gZWxzZSBpZiAoICEgaGFzX3dwYmMoKSApIHtcclxuXHRcdFx0XHRtc2cgPSBNLmxpYl93cGJjO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAhIGhhc19kcCgpICkge1xyXG5cdFx0XHRcdG1zZyA9IE0ubGliX2RwO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIExpYnJhcmllcyBhcmUgcHJlc2VudCwgYnV0IGxvYWRlciB3YXNuJ3QgcmVwbGFjZWQgLT4gZGVjaWRlIHdoYXQgaXMgbW9zdCBsaWtlbHkuXHJcblx0XHRcdFx0aWYgKCBpc19kdXBsaWNhdGVfcmlkKCByaWQgKSApIHtcclxuXHRcdFx0XHRcdG1zZyA9IE0uZHVwbGljYXRlICsgJ1xcblxcbicgKyBNLnN1cHBvcnQ7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG1zZyA9IE0uaW5pdF9mYWlsZWQgKyAnXFxuXFxuJyArIE0uc3VwcG9ydDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0aWYgKCB0ZXh0X2VsICkge1xyXG5cdFx0XHRcdFx0dGV4dF9lbC5pbm5lckhUTUwgPSB3cmFwX2h0bWwoIG1zZyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNhZmVfY2xlYXIoIHBvbGxfaWQgKTtcclxuXHRcdFx0aWYgKCBvYnNlcnZlciApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSwgZ3JhY2VfbXMgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEluaXRpYWxpemUgd2F0Y2hlcnMgZm9yIGxvYWRlciBlbGVtZW50cyBhbHJlYWR5IGluIHRoZSBET00uXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gYm9vdHN0cmFwX2V4aXN0aW5nKCkge1xyXG5cdFx0cXVlcnlfYWxsKCAnLmNhbGVuZGFyX2xvYWRlcl9mcmFtZVtkYXRhLXdwYmMtcmlkXScgKS5mb3JFYWNoKCBzdGFydF9mb3IgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIE9ic2VydmUgdGhlIGRvY3VtZW50IGZvciBhbnkgbmV3IGxvYWRlciBlbGVtZW50cyBpbnNlcnRlZCBsYXRlciAoQUpBWCwgYmxvY2sgcmVuZGVyKS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBvYnNlcnZlX25ld19sb2FkZXJzKCkge1xyXG5cdFx0aWYgKCAhICgnTXV0YXRpb25PYnNlcnZlcicgaW4gdykgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciBkb2Nfb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggZnVuY3Rpb24gKG11dGF0aW9ucykge1xyXG5cdFx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IG11dGF0aW9ucy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRcdHZhciBub2RlcyA9IG11dGF0aW9uc1tpXS5hZGRlZE5vZGVzIHx8IFtdO1xyXG5cdFx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgbm9kZXMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0XHRcdHZhciBub2RlID0gbm9kZXNbal07XHJcblx0XHRcdFx0XHRcdGlmICggISBub2RlIHx8IG5vZGUubm9kZVR5cGUgIT09IDEgKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0aWYgKCBub2RlLm1hdGNoZXMgJiYgbm9kZS5tYXRjaGVzKCAnLmNhbGVuZGFyX2xvYWRlcl9mcmFtZVtkYXRhLXdwYmMtcmlkXScgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRzdGFydF9mb3IoIG5vZGUgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRpZiAoIG5vZGUucXVlcnlTZWxlY3RvckFsbCApIHtcclxuXHRcdFx0XHRcdFx0XHR2YXIgaW5uZXIgPSBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICcuY2FsZW5kYXJfbG9hZGVyX2ZyYW1lW2RhdGEtd3BiYy1yaWRdJyApO1xyXG5cdFx0XHRcdFx0XHRcdGlmICggaW5uZXIgJiYgaW5uZXIubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0aW5uZXIuZm9yRWFjaCggc3RhcnRfZm9yICk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGRvY19vYnNlcnZlci5vYnNlcnZlKCBkLmRvY3VtZW50RWxlbWVudCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKiBCb290XHJcblx0ICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblx0b25fcmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHRcdGJvb3RzdHJhcF9leGlzdGluZygpO1xyXG5cdFx0b2JzZXJ2ZV9uZXdfbG9hZGVycygpO1xyXG5cdH0gKTtcclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiIsIihmdW5jdGlvbiggdyApIHtcclxuXHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRpZiAoICEgdy5XUEJDX0ZFICkge1xyXG5cdFx0dy5XUEJDX0ZFID0ge307XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBdXRvLWZpbGwgYm9va2luZyBmb3JtIGZpZWxkcyAodGV4dC9lbWFpbCkgYmFzZWQgb24gaW5wdXQgXCJuYW1lXCIgcGF0dGVybnMuXHJcblx0ICpcclxuXHQgKiBGb3JtIElEIGZvcm1hdDogYm9va2luZ19mb3Jte3Jlc291cmNlX2lkfVxyXG5cdCAqIFNraXBzIGRhdGUgZmllbGQ6IGRhdGVfYm9va2luZ3tyZXNvdXJjZV9pZH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWxsX3ZhbHVlcyBWYWx1ZXMgdG8gaW5qZWN0IChzdHJpbmdzKS5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgZm9ybSBmb3VuZCBhbmQgcHJvY2Vzc2VkLCBmYWxzZSBvdGhlcndpc2UuXHJcblx0ICovXHJcblx0dy5XUEJDX0ZFLmF1dG9maWxsX2Jvb2tpbmdfZm9ybV9maWVsZHMgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGZpbGxfdmFsdWVzICkge1xyXG5cclxuXHRcdHJlc291cmNlX2lkICA9IHBhcnNlSW50KCByZXNvdXJjZV9pZCwgMTAgKSB8fCAwO1xyXG5cdFx0ZmlsbF92YWx1ZXMgID0gZmlsbF92YWx1ZXMgfHwge307XHJcblxyXG5cdFx0dmFyIGZvcm1faWQgICA9ICdib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQ7XHJcblx0XHR2YXIgZGF0ZV9uYW1lID0gJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZDtcclxuXHJcblx0XHR2YXIgc3VibWl0X2Zvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggZm9ybV9pZCApO1xyXG5cclxuXHRcdGlmICggISBzdWJtaXRfZm9ybSApIHtcclxuXHRcdFx0LyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQzogTm8gYm9va2luZyBmb3JtOiAnICsgZm9ybV9pZCApO1xyXG5cdFx0XHQvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEtlZXAgc2FtZSByZWdleCBydWxlcyBhbmQgcHJpb3JpdHkgb3JkZXIgYXMgbGVnYWN5IGlubGluZSBKUy5cclxuXHRcdHZhciBydWxlcyA9IGFycmF5X3J1bGVzKCBmaWxsX3ZhbHVlcyApO1xyXG5cclxuXHRcdHZhciBlbGVtZW50cyA9IHN1Ym1pdF9mb3JtLmVsZW1lbnRzIHx8IFtdO1xyXG5cdFx0dmFyIGNvdW50ICAgID0gZWxlbWVudHMubGVuZ3RoO1xyXG5cdFx0dmFyIGVsO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgajtcclxuXHJcblx0XHRmb3IgKCBpID0gMDsgaSA8IGNvdW50OyBpKysgKSB7XHJcblxyXG5cdFx0XHRlbCA9IGVsZW1lbnRzWyBpIF07XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgfHwgISBlbC5uYW1lICkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBPbmx5IHRleHQvZW1haWwgaW5wdXRzLlxyXG5cdFx0XHRpZiAoICggZWwudHlwZSAhPT0gJ3RleHQnICkgJiYgKCBlbC50eXBlICE9PSAnZW1haWwnICkgKSB7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNraXAgZGF0ZSBmaWVsZC5cclxuXHRcdFx0aWYgKCBlbC5uYW1lID09PSBkYXRlX25hbWUgKSB7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZpbGwgb25seSBlbXB0eSB2YWx1ZXMgKGxlZ2FjeSBiZWhhdmlvcjogPT0gXCJcIikuXHJcblx0XHRcdGlmICggZWwudmFsdWUgIT09ICcnICkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBqID0gMDsgaiA8IHJ1bGVzLmxlbmd0aDsgaisrICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIHJ1bGVzWyBqIF0ucmUudGVzdCggZWwubmFtZSApICkge1xyXG5cclxuXHRcdFx0XHRcdGlmICggcnVsZXNbIGogXS52YWwgIT09ICcnICkge1xyXG5cdFx0XHRcdFx0XHRlbC52YWx1ZSA9IHJ1bGVzWyBqIF0udmFsO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGJyZWFrOyAvLyBTdG9wIGF0IGZpcnN0IG1hdGNoaW5nIHJ1bGUgKHByaW9yaXR5KS5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBCdWlsZCBydWxlcyBhcnJheSBmb3IgYXV0b2ZpbGwuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gZmlsbF92YWx1ZXMgVmFsdWVzIHRvIGluamVjdC5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm4ge0FycmF5fSBSdWxlcyBsaXN0LlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGFycmF5X3J1bGVzKCBmaWxsX3ZhbHVlcyApIHtcclxuXHJcblx0XHQvLyBOb3JtYWxpemUgdG8gc3RyaW5ncyAocHJldmVudCBcInVuZGVmaW5lZFwiIGluIGZpZWxkcykuXHJcblx0XHR2YXIgbmlja25hbWUgID0gKCBmaWxsX3ZhbHVlcy5uaWNrbmFtZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLm5pY2tuYW1lICkgOiAnJztcclxuXHRcdHZhciBsYXN0X25hbWUgPSAoIGZpbGxfdmFsdWVzLmxhc3RfbmFtZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLmxhc3RfbmFtZSApIDogJyc7XHJcblx0XHR2YXIgZmlyc3RfbmFtZSA9ICggZmlsbF92YWx1ZXMuZmlyc3RfbmFtZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLmZpcnN0X25hbWUgKSA6ICcnO1xyXG5cdFx0dmFyIGVtYWlsICAgICA9ICggZmlsbF92YWx1ZXMuZW1haWwgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy5lbWFpbCApIDogJyc7XHJcblx0XHR2YXIgcGhvbmUgICAgID0gKCBmaWxsX3ZhbHVlcy5waG9uZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLnBob25lICkgOiAnJztcclxuXHRcdHZhciBuYl9lbmZhbnQgPSAoIGZpbGxfdmFsdWVzLm5iX2VuZmFudCAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLm5iX2VuZmFudCApIDogJyc7XHJcblx0XHR2YXIgdXJsICAgICAgID0gKCBmaWxsX3ZhbHVlcy51cmwgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy51cmwgKSA6ICcnO1xyXG5cclxuXHRcdHJldHVybiBbXHJcblx0XHRcdHsgcmU6IC9eKFtBLVphLXowLTlfXFwtXFwuXSkqKG5pY2tuYW1lKXsxfShbQS1aYS16MC05X1xcLVxcLl0pKiQvLCB2YWw6IG5pY2tuYW1lIH0sXHJcblx0XHRcdHsgcmU6IC9eKFtBLVphLXowLTlfXFwtXFwuXSkqKGxhc3R8c2Vjb25kKXsxfShbX1xcLVxcLl0pP25hbWUoW0EtWmEtejAtOV9cXC1cXC5dKSokLywgdmFsOiBsYXN0X25hbWUgfSxcclxuXHRcdFx0eyByZTogL15uYW1lKFswLTlfXFwtXFwuXSkqJC8sIHZhbDogZmlyc3RfbmFtZSB9LFxyXG5cdFx0XHR7IHJlOiAvXihbQS1aYS16MC05X1xcLVxcLl0pKihmaXJzdHxteSl7MX0oW19cXC1cXC5dKT9uYW1lKFtBLVphLXowLTlfXFwtXFwuXSkqJC8sIHZhbDogZmlyc3RfbmFtZSB9LFxyXG5cdFx0XHR7IHJlOiAvXihlKT8oW19cXC1cXC5dKT9tYWlsKFswLTlfXFwtXFwuXSopJC8sIHZhbDogZW1haWwgfSxcclxuXHRcdFx0eyByZTogL14oW0EtWmEtejAtOV9cXC1cXC5dKSoocGhvbmV8Zm9uZSl7MX0oW0EtWmEtejAtOV9cXC1cXC5dKSokLywgdmFsOiBwaG9uZSB9LFxyXG5cdFx0XHR7IHJlOiAvXihlKT8oW19cXC1cXC5dKT9uYl9lbmZhbnQoWzAtOV9cXC1cXC5dKikkLywgdmFsOiBuYl9lbmZhbnQgfSxcclxuXHRcdFx0eyByZTogL14oW0EtWmEtejAtOV9cXC1cXC5dKSooVVJMfHNpdGV8d2VifFdFQil7MX0oW0EtWmEtejAtOV9cXC1cXC5dKSokLywgdmFsOiB1cmwgfVxyXG5cdFx0XTtcclxuXHR9XHJcblxyXG59KSggd2luZG93ICk7XHJcbiIsIi8vID09IFN1Ym1pdCBCb29raW5nIERhdGEgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBSZWZhY3RvcmVkIChzYWZlKSwgd2l0aCBuZXcgd3BiY18qIG5hbWVzLlxyXG4vLyBCYWNrd2FyZC1jb21wYXRpYmxlIHdyYXBwZXJzIGZvciBsZWdhY3kgZnVuY3Rpb24gbmFtZXMgYXJlIGluY2x1ZGVkIGF0IHRoZSBib3R0b20uXHJcbi8vIEBmaWxlOiBpbmNsdWRlcy9fX2pzL2NsaWVudC9mcm9udF9lbmRfZm9ybS9ib29raW5nX2Zvcm1fc3VibWl0LmpzXHJcblxyXG4vKipcclxuICogQ2hlY2sgZmllbGRzIGF0IGZvcm0gYW5kIHRoZW4gc2VuZCByZXF1ZXN0IChsZWdhY3k6IG15Ym9va2luZ19zdWJtaXQpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0hUTUxGb3JtRWxlbWVudH0gc3VibWl0X2Zvcm1cclxuICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSAgIHJlc291cmNlX2lkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICB3cGRldl9hY3RpdmVfbG9jYWxlXHJcbiAqXHJcbiAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gTGVnYWN5IGJlaGF2aW9yOiByZXR1cm5zIGZhbHNlIGluIHNvbWUgY2FzZXMsIG90aGVyd2lzZSB1bmRlZmluZWQuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXQoIHN1Ym1pdF9mb3JtLCByZXNvdXJjZV9pZCwgd3BkZXZfYWN0aXZlX2xvY2FsZSApIHtcclxuXHJcblx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggcmVzb3VyY2VfaWQsIDEwICk7XHJcblxyXG5cdC8vIFNhZmV0eSBndWFyZCAobGVnYWN5IGNvZGUgYXNzdW1lZCB2YWxpZCBmb3JtKS5cclxuXHRpZiAoICEgc3VibWl0X2Zvcm0gfHwgISBzdWJtaXRfZm9ybS5lbGVtZW50cyApIHtcclxuXHRcdC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cclxuXHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDOiBJbnZhbGlkIHN1Ym1pdCBmb3JtIGluIHdwYmNfYm9va2luZ19mb3JtX3N1Ym1pdCgpLicgKTtcclxuXHRcdC8qIGVzbGludC1lbmFibGUgbm8tY29uc29sZSAqL1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4dGVybmFsIGhvb2s6IGFsbG93IHBhdXNlIHN1Ym1pdCBvbiBjb25maXJtYXRpb24vc3VtbWFyeSBzdGVwLlxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgdGFyZ2V0X2VsbSA9IGpRdWVyeSggJy5ib29raW5nX2Zvcm1fZGl2JyApLnRyaWdnZXIoICdib29raW5nX2Zvcm1fc3VibWl0X2NsaWNrJywgWyByZXNvdXJjZV9pZCwgc3VibWl0X2Zvcm0sIHdwZGV2X2FjdGl2ZV9sb2NhbGUgXSApOyAvLyBGaXhJbjogOC44LjMuMTMuXHJcblxyXG5cdGlmIChcclxuXHRcdCggalF1ZXJ5KCB0YXJnZXRfZWxtICkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX2Zvcm1fc2hvd19zdW1tYXJ5XCJdJyApLmxlbmd0aCA+IDAgKSAmJlxyXG5cdFx0KCAncGF1c2Vfc3VibWl0JyA9PT0galF1ZXJ5KCB0YXJnZXRfZWxtICkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX2Zvcm1fc2hvd19zdW1tYXJ5XCJdJyApLnZhbCgpIClcclxuXHQpIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIEZpeEluOiA4LjQuMC4yLlxyXG5cdHZhciBpc19lcnJvciA9IHdwYmNfY2hlY2tfZXJyb3JzX2luX2Jvb2tpbmdfZm9ybSggcmVzb3VyY2VfaWQgKTtcclxuXHRpZiAoIGlzX2Vycm9yICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNob3cgbWVzc2FnZSBpZiBubyBzZWxlY3RlZCBkYXlzIGluIENhbGVuZGFyKHMpLlxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgZGF0ZV9pbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICk7XHJcblx0dmFyIGRhdGVfdmFsdWUgPSAoIGRhdGVfaW5wdXQgKSA/IGRhdGVfaW5wdXQudmFsdWUgOiAnJztcclxuXHJcblx0aWYgKCAnJyA9PT0gZGF0ZV92YWx1ZSApIHtcclxuXHJcblx0XHR2YXIgYXJyX29mX3NlbGVjdGVkX2FkZGl0aW9uYWxfY2FsZW5kYXJzID0gd3BiY19nZXRfYXJyX29mX3NlbGVjdGVkX2FkZGl0aW9uYWxfY2FsZW5kYXJzKCByZXNvdXJjZV9pZCApOyAvLyBGaXhJbjogOC41LjIuMjYuXHJcblxyXG5cdFx0aWYgKCAhIGFycl9vZl9zZWxlY3RlZF9hZGRpdGlvbmFsX2NhbGVuZGFycyB8fCAoIGFycl9vZl9zZWxlY3RlZF9hZGRpdGlvbmFsX2NhbGVuZGFycy5sZW5ndGggPT09IDAgKSApIHtcclxuXHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyhcblx0XHRcdFx0JyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICsgJyAuYmtfY2FsZW5kYXJfZnJhbWUnLFxuXHRcdFx0XHRfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfbm9fc2VsZWN0ZWRfZGF0ZXMnICksXG5cdFx0XHRcdCd0ZXh0J1xuXHRcdFx0KTtcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBGaXhJbjogNi4xLjEuMy4gVGltZSBzZWxlY3Rpb24gYXZhaWxhYmlsaXR5IGNoZWNrcy5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0aWYgKCB0eXBlb2Ygd3BiY19pc190aGlzX3RpbWVfc2VsZWN0aW9uX25vdF9hdmFpbGFibGUgPT09ICdmdW5jdGlvbicgKSB7XHJcblxyXG5cdFx0aWYgKCAnJyA9PT0gZGF0ZV92YWx1ZSApIHsgLy8gUHJpbWFyeSBjYWxlbmRhciBub3Qgc2VsZWN0ZWQuXHJcblxyXG5cdFx0XHR2YXIgYWRkaXRpb25hbF9jYWxlbmRhcnNfZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2FkZGl0aW9uYWxfY2FsZW5kYXJzJyArIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0XHRpZiAoIGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsICE9PSBudWxsICkgeyAvLyBDaGVja2luZyBhZGRpdGlvbmFsIGNhbGVuZGFycy5cclxuXHJcblx0XHRcdFx0dmFyIGlkX2FkZGl0aW9uYWxfc3RyID0gYWRkaXRpb25hbF9jYWxlbmRhcnNfZWwudmFsdWU7XHJcblx0XHRcdFx0dmFyIGlkX2FkZGl0aW9uYWxfYXJyID0gaWRfYWRkaXRpb25hbF9zdHIuc3BsaXQoICcsJyApO1xyXG5cdFx0XHRcdHZhciBpc190aW1lc19kYXRlc19vayA9IGZhbHNlO1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaWEgPSAwOyBpYSA8IGlkX2FkZGl0aW9uYWxfYXJyLmxlbmd0aDsgaWErKyApIHtcclxuXHJcblx0XHRcdFx0XHR2YXIgYWRkX2lkID0gaWRfYWRkaXRpb25hbF9hcnJbIGlhIF07XHJcblxyXG5cdFx0XHRcdFx0dmFyIGFkZF9kYXRlX2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdkYXRlX2Jvb2tpbmcnICsgYWRkX2lkICk7XHJcblx0XHRcdFx0XHR2YXIgYWRkX2RhdGVfdmFsID0gKCBhZGRfZGF0ZV9lbCApID8gYWRkX2RhdGVfZWwudmFsdWUgOiAnJztcclxuXHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdCggJycgIT09IGFkZF9kYXRlX3ZhbCApICYmXHJcblx0XHRcdFx0XHRcdCggISB3cGJjX2lzX3RoaXNfdGltZV9zZWxlY3Rpb25fbm90X2F2YWlsYWJsZSggYWRkX2lkLCBzdWJtaXRfZm9ybS5lbGVtZW50cyApIClcclxuXHRcdFx0XHRcdCkge1xyXG5cdFx0XHRcdFx0XHRpc190aW1lc19kYXRlc19vayA9IHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoICEgaXNfdGltZXNfZGF0ZXNfb2sgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fSBlbHNlIHsgLy8gUHJpbWFyeSBjYWxlbmRhciBzZWxlY3RlZC5cclxuXHJcblx0XHRcdGlmICggd3BiY19pc190aGlzX3RpbWVfc2VsZWN0aW9uX25vdF9hdmFpbGFibGUoIHJlc291cmNlX2lkLCBzdWJtaXRfZm9ybS5lbGVtZW50cyApICkge1xyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNlcmlhbGl6ZSBmb3JtIChsZWdhY3kgZm9ybWF0KS5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGNvdW50ICAgID0gc3VibWl0X2Zvcm0uZWxlbWVudHMubGVuZ3RoO1xyXG5cdHZhciBmb3JtZGF0YSA9ICcnO1xyXG5cdHZhciBpbnBfdmFsdWU7XHJcblx0dmFyIGlucF90aXRsZV92YWx1ZTtcclxuXHR2YXIgZWxlbWVudDtcclxuXHR2YXIgZWxfdHlwZTtcclxuXHJcblx0Ly8gSGVscGVyOiBsZWdhY3kgZXNjYXBpbmcgZm9yIHRoZSBzZXJpYWxpemVkIHZhbHVlLlxyXG5cdGZ1bmN0aW9uIHdwYmNfZXNjYXBlX3NlcmlhbGl6ZWRfdmFsdWUoIHZhbCApIHtcclxuXHJcblx0XHR2YWwgPSAoIHZhbCA9PSBudWxsICkgPyAnJyA6IFN0cmluZyggdmFsICk7XHJcblxyXG5cdFx0Ly8gUmVwbGFjZSByZWdpc3RlcmVkIGNoYXJhY3RlcnMuXHJcblx0XHR2YWwgPSB2YWwucmVwbGFjZSggbmV3IFJlZ0V4cCggJ1xcXFxeJywgJ2cnICksICcmIzk0OycgKTtcclxuXHRcdHZhbCA9IHZhbC5yZXBsYWNlKCBuZXcgUmVnRXhwKCAnficsICdnJyApLCAnJiMxMjY7JyApO1xyXG5cclxuXHRcdC8vIFJlcGxhY2UgcXVvdGVzLlxyXG5cdFx0dmFsID0gdmFsLnJlcGxhY2UoIC9cIi9nLCAnJiMzNDsnICk7XHJcblx0XHR2YWwgPSB2YWwucmVwbGFjZSggLycvZywgJyYjMzk7JyApO1xyXG5cclxuXHRcdHJldHVybiB2YWw7XHJcblx0fVxyXG5cclxuXHQvLyBIZWxwZXI6IGRldGVybWluZSBVSSB0eXBlIGZvciB0aXRsZSBleHRyYWN0aW9uIChsZWdhY3kgbG9naWMpLlxyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X2lucHV0X2VsZW1lbnRfdHlwZSggZWwgKSB7XHJcblxyXG5cdFx0aWYgKCAhIGVsIHx8ICEgZWwudGFnTmFtZSApIHtcclxuXHRcdFx0cmV0dXJuICcnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciB0YWcgPSBTdHJpbmcoIGVsLnRhZ05hbWUgKS50b0xvd2VyQ2FzZSgpO1xyXG5cclxuXHRcdGlmICggJ2lucHV0JyA9PT0gdGFnICkge1xyXG5cdFx0XHRyZXR1cm4gKCBlbC50eXBlICkgPyBTdHJpbmcoIGVsLnR5cGUgKS50b0xvd2VyQ2FzZSgpIDogJ3RleHQnO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIExlZ2FjeSB1c2VkIFwic2VsZWN0XCIgc3RyaW5nIGhlcmUuXHJcblx0XHRpZiAoICdzZWxlY3QnID09PSB0YWcgKSB7XHJcblx0XHRcdHJldHVybiAnc2VsZWN0JztcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGFnO1xyXG5cdH1cclxuXHJcblx0Zm9yICggdmFyIGkgPSAwOyBpIDwgY291bnQ7IGkrKyApIHsgLy8gRml4SW46IDkuMS41LjEuXHJcblxyXG5cdFx0ZWxlbWVudCA9IHN1Ym1pdF9mb3JtLmVsZW1lbnRzWyBpIF07XHJcblxyXG5cdFx0aWYgKCAhIGVsZW1lbnQgKSB7XHJcblx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggalF1ZXJ5KCBlbGVtZW50ICkuY2xvc2VzdCggJy5ib29raW5nX2Zvcm1fZ2FyYmFnZScgKS5sZW5ndGggKSB7XHJcblx0XHRcdGNvbnRpbnVlOyAvLyBTa2lwIGVsZW1lbnRzIGZyb20gZ2FyYmFnZS4gRml4SW46IDcuMS4yLjE0LlxyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJzEnID09PSBTdHJpbmcoIGpRdWVyeSggZWxlbWVudCApLmF0dHIoICdkYXRhLXdwYmMtYm9va2luZy1zdWJtaXQtaWdub3JlJyApIHx8ICcnICkgKSB7XHJcblx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0KCBlbGVtZW50LnR5cGUgIT09ICdidXR0b24nICkgJiZcclxuXHRcdFx0KCBlbGVtZW50LnR5cGUgIT09ICdoaWRkZW4nICkgJiZcclxuXHRcdFx0KCBlbGVtZW50Lm5hbWUgIT09ICggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0Ly8gJiYgKCBqUXVlcnkoIGVsZW1lbnQgKS5pcyggJzp2aXNpYmxlJyApICkgLy9GaXhJbjogNy4yLjEuMTIuMlxyXG5cdFx0KSB7XHJcblxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdC8vIEdldCBlbGVtZW50IHZhbHVlLlxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGlmICggZWxlbWVudC50eXBlID09PSAnY2hlY2tib3gnICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIGVsZW1lbnQudmFsdWUgPT09ICcnICkge1xyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gZWxlbWVudC5jaGVja2VkO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRpbnBfdmFsdWUgPSAoIGVsZW1lbnQuY2hlY2tlZCApID8gZWxlbWVudC52YWx1ZSA6ICcnO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSBpZiAoIGVsZW1lbnQudHlwZSA9PT0gJ3JhZGlvJyApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBlbGVtZW50LmNoZWNrZWQgKSB7XHJcblx0XHRcdFx0XHRpbnBfdmFsdWUgPSBlbGVtZW50LnZhbHVlO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHRcdFx0Ly8gUmVxdWlyZWQgcmFkaW86IHNob3cgd2FybmluZyBpZiBub25lIGNoZWNrZWQuXHJcblx0XHRcdFx0XHQvLyBGaXhJbjogNy4wLjEuNjIuXHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdCggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3dwZGV2LXZhbGlkYXRlcy1hcy1yZXF1aXJlZCcgKSAhPT0gLTEgKSAmJlxyXG5cdFx0XHRcdFx0XHQoIGpRdWVyeSggZWxlbWVudCApLmlzKCAnOnZpc2libGUnICkgKSAmJiAvLyBGaXhJbjogNy4yLjEuMTIuMi5cclxuXHRcdFx0XHRcdFx0KCAhIGpRdWVyeSggJzpyYWRpb1tuYW1lPVwiJyArIGVsZW1lbnQubmFtZSArICdcIl0nLCBzdWJtaXRfZm9ybSApLmlzKCAnOmNoZWNrZWQnICkgKVxyXG5cdFx0XHRcdFx0KSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGVsZW1lbnQsIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZF9mb3JfcmFkaW9fYm94JyApLCAndGV4dCcgKTsgLy8gRml4SW46IDguNS4xLjMuXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2tpcCBzdG9yaW5nIGVtcHR5IHJhZGlvIG9wdGlvbnMuXHJcblx0XHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGlucF92YWx1ZSA9IGVsZW1lbnQudmFsdWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlucF90aXRsZV92YWx1ZSA9ICcnO1xyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBHZXQgaHVtYW4tZnJpZW5kbHkgdGl0bGUgdmFsdWUgKGxlZ2FjeSBiZWhhdmlvcikuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0dmFyIGlucHV0X2VsZW1lbnRfdHlwZSA9IHdwYmNfZ2V0X2lucHV0X2VsZW1lbnRfdHlwZSggZWxlbWVudCApO1xyXG5cclxuXHRcdFx0c3dpdGNoICggaW5wdXRfZWxlbWVudF90eXBlICkge1xyXG5cclxuXHRcdFx0XHRjYXNlICd0ZXh0JzpcclxuXHRcdFx0XHRjYXNlICdlbWFpbCc6XHJcblx0XHRcdFx0XHRpbnBfdGl0bGVfdmFsdWUgPSBpbnBfdmFsdWU7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAnc2VsZWN0JzpcclxuXHRcdFx0XHRcdGlucF90aXRsZV92YWx1ZSA9IGpRdWVyeSggZWxlbWVudCApLmZpbmQoICdvcHRpb246c2VsZWN0ZWQnICkudGV4dCgpO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3JhZGlvJzpcclxuXHRcdFx0XHRjYXNlICdjaGVja2JveCc6XHJcblx0XHRcdFx0XHRpZiAoIGpRdWVyeSggZWxlbWVudCApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdHZhciBsYWJlbF9lbGVtZW50ID0galF1ZXJ5KCBlbGVtZW50ICkucGFyZW50cyggJy53cGRldi1saXN0LWl0ZW0nICkuZmluZCggJy53cGRldi1saXN0LWl0ZW0tbGFiZWwnICk7XHJcblx0XHRcdFx0XHRcdGlmICggbGFiZWxfZWxlbWVudC5sZW5ndGggKSB7XHJcblx0XHRcdFx0XHRcdFx0aW5wX3RpdGxlX3ZhbHVlID0gbGFiZWxfZWxlbWVudC5odG1sKCk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdFx0aW5wX3RpdGxlX3ZhbHVlID0gaW5wX3ZhbHVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdC8vIE11bHRpcGxlIHNlbGVjdCB2YWx1ZSBleHRyYWN0aW9uLlxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGlmICggKCBlbGVtZW50LnR5cGUgPT09ICdzZWxlY3Rib3gtbXVsdGlwbGUnICkgfHwgKCBlbGVtZW50LnR5cGUgPT09ICdzZWxlY3QtbXVsdGlwbGUnICkgKSB7XHJcblx0XHRcdFx0aW5wX3ZhbHVlID0galF1ZXJ5KCAnW25hbWU9XCInICsgZWxlbWVudC5uYW1lICsgJ1wiXScgKS52YWwoKTtcclxuXHRcdFx0XHRpZiAoICggaW5wX3ZhbHVlID09PSBudWxsICkgfHwgKCBTdHJpbmcoIGlucF92YWx1ZSApID09PSAnJyApICkge1xyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gJyc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdC8vIE1ha2UgdmFsaWRhdGlvbiBvbmx5IGZvciB2aXNpYmxlIGVsZW1lbnRzLlxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdGlmICggalF1ZXJ5KCBlbGVtZW50ICkuaXMoICc6dmlzaWJsZScgKSApIHsgLy8gRml4SW46IDcuMi4xLjEyLjIuXHJcblxyXG5cdFx0XHRcdC8vIFJlY2hlY2sgbWF4IGF2YWlsYWJsZSB2aXNpdG9ycyBzZWxlY3Rpb24uXHJcblx0XHRcdFx0aWYgKCB0eXBlb2Ygd3BiY19faXNfbGVzc190aGFuX3JlcXVpcmVkX19vZl9tYXhfYXZhaWxhYmxlX3Nsb3RzX19ibCA9PT0gJ2Z1bmN0aW9uJyApIHtcclxuXHRcdFx0XHRcdGlmICggd3BiY19faXNfbGVzc190aGFuX3JlcXVpcmVkX19vZl9tYXhfYXZhaWxhYmxlX3Nsb3RzX19ibCggcmVzb3VyY2VfaWQsIGVsZW1lbnQgKSApIHtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gUmVxdWlyZWQgZmllbGRzLlxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3dwZGV2LXZhbGlkYXRlcy1hcy1yZXF1aXJlZCcgKSAhPT0gLTEgKSB7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAoIGVsZW1lbnQudHlwZSA9PT0gJ2NoZWNrYm94JyApICYmICggZWxlbWVudC5jaGVja2VkID09PSBmYWxzZSApICkge1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAhIGpRdWVyeSggJzpjaGVja2JveFtuYW1lPVwiJyArIGVsZW1lbnQubmFtZSArICdcIl0nLCBzdWJtaXRfZm9ybSApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggZWxlbWVudCwgX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX3JlcXVpcmVkX2Zvcl9jaGVja19ib3gnICksICd0ZXh0JyApOyAvLyBGaXhJbjogOC41LjEuMy5cblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBlbGVtZW50LnR5cGUgPT09ICdyYWRpbycgKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICEgalF1ZXJ5KCAnOnJhZGlvW25hbWU9XCInICsgZWxlbWVudC5uYW1lICsgJ1wiXScsIHN1Ym1pdF9mb3JtICkuaXMoICc6Y2hlY2tlZCcgKSApIHtcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfcmVxdWlyZWRfZm9yX3JhZGlvX2JveCcgKSwgJ3RleHQnICk7IC8vIEZpeEluOiA4LjUuMS4zLlxuXHRcdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoICggZWxlbWVudC50eXBlICE9PSAnY2hlY2tib3gnICkgJiYgKCBlbGVtZW50LnR5cGUgIT09ICdyYWRpbycgKSAmJiAoICcnID09PSB3cGJjX3RyaW0oIGlucF92YWx1ZSApICkgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGVsZW1lbnQsIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZCcgKSwgJ3RleHQnICk7IC8vIEZpeEluOiA4LjUuMS4zLlxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRW1haWwgZm9ybWF0IHZhbGlkYXRpb24uXHJcblx0XHRcdFx0aWYgKCBlbGVtZW50LmNsYXNzTmFtZS5pbmRleE9mKCAnd3BkZXYtdmFsaWRhdGVzLWFzLWVtYWlsJyApICE9PSAtMSApIHtcclxuXHJcblx0XHRcdFx0XHRpbnBfdmFsdWUgPSBTdHJpbmcoIGlucF92YWx1ZSApLnJlcGxhY2UoIC9eXFxzK3xcXHMrJC9nbSwgJycgKTsgLy8gVHJpbSB3aGl0ZSBzcGFjZS4gRml4SW46IDUuNC41LlxyXG5cdFx0XHRcdFx0dmFyIHJlZ19lbWFpbCA9IC9eKFtBLVphLXowLTlfXFwtXFwuXFwrXSkrXFxAKFtBLVphLXowLTlfXFwtXFwuXSkrXFwuKFtBLVphLXpdezIsfSkkLztcclxuXHJcblx0XHRcdFx0XHRpZiAoIGlucF92YWx1ZSAhPT0gJycgKSB7XHJcblx0XHRcdFx0XHRcdGlmICggcmVnX2VtYWlsLnRlc3QoIGlucF92YWx1ZSApID09PSBmYWxzZSApIHtcclxuXHRcdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfZW1haWwnICksICd0ZXh0JyApOyAvLyBGaXhJbjogOC41LjEuMy5cblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBTYW1lIGVtYWlsIGZpZWxkIHZhbGlkYXRpb24gKHZlcmlmaWNhdGlvbiBmaWVsZCkuXHJcblx0XHRcdFx0aWYgKCAoIGVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoICd3cGRldi12YWxpZGF0ZXMtYXMtZW1haWwnICkgIT09IC0xICkgJiYgKCBlbGVtZW50LmNsYXNzTmFtZS5pbmRleE9mKCAnc2FtZV9hc18nICkgIT09IC0xICkgKSB7XHJcblxyXG5cdFx0XHRcdFx0dmFyIHByaW1hcnlfZW1haWxfbmFtZSA9IGVsZW1lbnQuY2xhc3NOYW1lLm1hdGNoKCAvc2FtZV9hc18oW15cXHNdKSsvZ2kgKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIHByaW1hcnlfZW1haWxfbmFtZSAhPT0gbnVsbCApIHtcclxuXHJcblx0XHRcdFx0XHRcdHByaW1hcnlfZW1haWxfbmFtZSA9IHByaW1hcnlfZW1haWxfbmFtZVsgMCBdLnN1YnN0ciggOCApO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCBqUXVlcnkoICdbbmFtZT1cIicgKyBwcmltYXJ5X2VtYWlsX25hbWUgKyByZXNvdXJjZV9pZCArICdcIl0nICkubGVuZ3RoID4gMCApIHtcclxuXHJcblx0XHRcdFx0XHRcdFx0aWYgKCBqUXVlcnkoICdbbmFtZT1cIicgKyBwcmltYXJ5X2VtYWlsX25hbWUgKyByZXNvdXJjZV9pZCArICdcIl0nICkudmFsKCkgIT09IGlucF92YWx1ZSApIHtcclxuXHRcdFx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGVsZW1lbnQsIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19zYW1lX2VtYWlsJyApLCAndGV4dCcgKTsgLy8gRml4SW46IDguNS4xLjMuXG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNraXAgb25lIGxvb3AgZm9yIHRoZSBlbWFpbCB2ZXJpZmljYXRpb24gZmllbGQuXHJcblx0XHRcdFx0XHRjb250aW51ZTsgLy8gRml4SW46IDguMS4yLjE1LlxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBHZXQgRm9ybSBEYXRhIChsZWdhY3kgZm9ybWF0KS5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRpZiAoIGVsZW1lbnQubmFtZSAhPT0gKCAnY2FwdGNoYV9pbnB1dCcgKyByZXNvdXJjZV9pZCApICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIGZvcm1kYXRhICE9PSAnJyApIHtcclxuXHRcdFx0XHRcdGZvcm1kYXRhICs9ICd+JztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGVsX3R5cGUgPSBlbGVtZW50LnR5cGU7XHJcblxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3dwZGV2LXZhbGlkYXRlcy1hcy1lbWFpbCcgKSAhPT0gLTEgKSB7XHJcblx0XHRcdFx0XHRlbF90eXBlID0gJ2VtYWlsJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBlbGVtZW50LmNsYXNzTmFtZS5pbmRleE9mKCAnd3BkZXYtdmFsaWRhdGVzLWFzLWNvdXBvbicgKSAhPT0gLTEgKSB7XHJcblx0XHRcdFx0XHRlbF90eXBlID0gJ2NvdXBvbic7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpbnBfdmFsdWUgPSB3cGJjX2VzY2FwZV9zZXJpYWxpemVkX3ZhbHVlKCBpbnBfdmFsdWUgKTtcclxuXHJcblx0XHRcdFx0aWYgKCBlbF90eXBlID09PSAnc2VsZWN0LW9uZScgKSB7XHJcblx0XHRcdFx0XHRlbF90eXBlID0gJ3NlbGVjdGJveC1vbmUnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGVsX3R5cGUgPT09ICdzZWxlY3QtbXVsdGlwbGUnICkge1xyXG5cdFx0XHRcdFx0ZWxfdHlwZSA9ICdzZWxlY3Rib3gtbXVsdGlwbGUnO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Zm9ybWRhdGEgKz0gZWxfdHlwZSArICdeJyArIGVsZW1lbnQubmFtZSArICdeJyArIGlucF92YWx1ZTtcclxuXHJcblx0XHRcdFx0Ly8gQWRkIHRpdGxlL2xhYmVsIHZhbHVlIChsZWdhY3kpLlxyXG5cdFx0XHRcdHZhciBjbGVhbl9maWVsZF9uYW1lID0gU3RyaW5nKCBlbGVtZW50Lm5hbWUgKTtcclxuXHJcblx0XHRcdFx0Ly8gQlVHRklYOiByZXBsYWNlQWxsKFJlZ0V4cCkgaXMgbm90IHN1cHBvcnRlZCBpbiBvbGRlciBicm93c2Vycy5cclxuXHRcdFx0XHQvLyBLZWVwIGxlZ2FjeSBpbnRlbnQ6IHJlbW92ZSBbXSBzdWZmaXggb2NjdXJyZW5jZXMuXHJcblx0XHRcdFx0Y2xlYW5fZmllbGRfbmFtZSA9IGNsZWFuX2ZpZWxkX25hbWUucmVwbGFjZSggL1xcW1xcXS9naSwgJycgKTtcclxuXHJcblx0XHRcdFx0dmFyIHJlc291cmNlX2lkX3N0ciA9IFN0cmluZyggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHRcdFx0Ly8gTGVnYWN5IGFzc3VtZWQgc3VmZml4IGVuZHMgd2l0aCByZXNvdXJjZV9pZCwgbWFrZSBpdCBzYWZlLlxyXG5cdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCggY2xlYW5fZmllbGRfbmFtZS5sZW5ndGggPj0gcmVzb3VyY2VfaWRfc3RyLmxlbmd0aCApICYmXHJcblx0XHRcdFx0XHQoIGNsZWFuX2ZpZWxkX25hbWUuc3Vic3RyKCBjbGVhbl9maWVsZF9uYW1lLmxlbmd0aCAtIHJlc291cmNlX2lkX3N0ci5sZW5ndGggKSA9PT0gcmVzb3VyY2VfaWRfc3RyIClcclxuXHRcdFx0XHQpIHtcclxuXHRcdFx0XHRcdGNsZWFuX2ZpZWxkX25hbWUgPSBjbGVhbl9maWVsZF9uYW1lLnN1YnN0ciggMCwgY2xlYW5fZmllbGRfbmFtZS5sZW5ndGggLSByZXNvdXJjZV9pZF9zdHIubGVuZ3RoICk7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRmb3JtZGF0YSArPSAnficgKyBlbF90eXBlICsgJ14nICsgY2xlYW5fZmllbGRfbmFtZSArICdfdmFsJyArIHJlc291cmNlX2lkICsgJ14nICsgaW5wX3RpdGxlX3ZhbHVlO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyBUT0RPOiBoZXJlIHdhcyBmdW5jdGlvbiBmb3IgJ0NoZWNrIGlmIHZpc2l0b3IgZmluaXNoIGRhdGVzIHNlbGVjdGlvbi5cclxuXHJcblx0Ly8gQ2FwdGNoYSB2ZXJpZnkuXHJcblx0dmFyIGNhcHRjaGEgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwZGV2X2NhcHRjaGFfY2hhbGxlbmdlXycgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRpZiAoIGNhcHRjaGEgIT09IG51bGwgKSB7XHJcblx0XHR3cGJjX2Zvcm1fc3VibWl0X3NlbmQoIHJlc291cmNlX2lkLCBmb3JtZGF0YSwgY2FwdGNoYS52YWx1ZSwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdjYXB0Y2hhX2lucHV0JyArIHJlc291cmNlX2lkICkudmFsdWUsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0d3BiY19mb3JtX3N1Ym1pdF9zZW5kKCByZXNvdXJjZV9pZCwgZm9ybWRhdGEsICcnLCAnJywgd3BkZXZfYWN0aXZlX2xvY2FsZSApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIEdhdGhlcmluZyBwYXJhbXMgZm9yIHNlbmRpbmcgQWpheCByZXF1ZXN0IGFuZCB0aGVuIHNlbmQgaXQgKGxlZ2FjeTogZm9ybV9zdWJtaXRfc2VuZCkuXHJcbiAqXHJcbiAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWRcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBmb3JtZGF0YVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIGNhcHRjaGFfY2hhbGFuZ2VcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICB1c2VyX2NhcHRjaGFcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICB3cGRldl9hY3RpdmVfbG9jYWxlXHJcbiAqXHJcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH0gTGVnYWN5IGJlaGF2aW9yLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19mb3JtX3N1Ym1pdF9zZW5kKCByZXNvdXJjZV9pZCwgZm9ybWRhdGEsIGNhcHRjaGFfY2hhbGFuZ2UsIHVzZXJfY2FwdGNoYSwgd3BkZXZfYWN0aXZlX2xvY2FsZSApIHtcclxuXHJcblx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggcmVzb3VyY2VfaWQsIDEwICk7XHJcblxyXG5cdHZhciBteV9ib29raW5nX2Zvcm0gPSAnJztcclxuXHR2YXIgYm9va2luZ19mb3JtX3R5cGVfZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2Jvb2tpbmdfZm9ybV90eXBlJyArIHJlc291cmNlX2lkICk7XHJcblx0aWYgKCBib29raW5nX2Zvcm1fdHlwZV9lbCAhPT0gbnVsbCApIHtcclxuXHRcdG15X2Jvb2tpbmdfZm9ybSA9IGJvb2tpbmdfZm9ybV90eXBlX2VsLnZhbHVlO1xyXG5cdH1cclxuXHJcblx0dmFyIG15X2Jvb2tpbmdfaGFzaCA9ICcnO1xyXG5cdGlmICggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2Jvb2tpbmdfaGFzaCcgKSAhPT0gJycgKSB7XHJcblx0XHRteV9ib29raW5nX2hhc2ggPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYm9va2luZ19oYXNoJyApO1xyXG5cdH1cclxuXHJcblx0dmFyIGlzX3NlbmRfZW1laWxzID0gMTtcclxuXHR2YXIgJGlzX3NlbmRfZW1haWxfdG9nZ2xlID0galF1ZXJ5KCAnI2lzX3NlbmRfZW1haWxfZm9yX3BlbmRpbmcnICk7XHJcblx0dmFyICRtb2RhbF9zZW5kX2VtYWlsX3RvZ2dsZSA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5jbG9zZXN0KCAnLndwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXNlbmQtZW1haWxzXScgKS5maXJzdCgpO1xyXG5cdGlmICggJG1vZGFsX3NlbmRfZW1haWxfdG9nZ2xlLmxlbmd0aCApIHtcclxuXHRcdCRpc19zZW5kX2VtYWlsX3RvZ2dsZSA9ICRtb2RhbF9zZW5kX2VtYWlsX3RvZ2dsZTtcclxuXHR9XHJcblx0aWYgKCAkaXNfc2VuZF9lbWFpbF90b2dnbGUubGVuZ3RoICkgeyAvLyBGaXhJbjogOC43LjkuNS5cclxuXHJcblx0XHRpc19zZW5kX2VtZWlscyA9ICRpc19zZW5kX2VtYWlsX3RvZ2dsZS5pcyggJzpjaGVja2VkJyApO1xyXG5cclxuXHRcdGlmICggZmFsc2UgPT09IGlzX3NlbmRfZW1laWxzICkge1xyXG5cdFx0XHRpc19zZW5kX2VtZWlscyA9IDA7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpc19zZW5kX2VtZWlscyA9IDE7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHR2YXIgZGF0ZV9lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICk7XHJcblx0dmFyIGRhdGVfdmFsdWUgPSAoIGRhdGVfZWwgKSA/IGRhdGVfZWwudmFsdWUgOiAnJztcclxuXHJcblx0aWYgKCAnJyAhPT0gZGF0ZV92YWx1ZSApIHsgLy8gRml4SW46IDYuMS4xLjMuXHJcblx0XHR3cGJjX3NlbmRfYWpheF9zdWJtaXQoIHJlc291cmNlX2lkLCBmb3JtZGF0YSwgY2FwdGNoYV9jaGFsYW5nZSwgdXNlcl9jYXB0Y2hhLCBpc19zZW5kX2VtZWlscywgbXlfYm9va2luZ19oYXNoLCBteV9ib29raW5nX2Zvcm0sIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKTtcclxuXHR9IGVsc2Uge1xyXG5cdFx0alF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKS5oaWRlKCk7XHJcblx0XHRqUXVlcnkoICcjc3VibWl0aW5nJyArIHJlc291cmNlX2lkICkuaGlkZSgpO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEFkZGl0aW9uYWwgY2FsZW5kYXJzIHN1Ym1pdC5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdhZGRpdGlvbmFsX2NhbGVuZGFycycgKyByZXNvdXJjZV9pZCApO1xyXG5cdGlmICggYWRkaXRpb25hbF9jYWxlbmRhcnNfZWwgPT09IG51bGwgKSB7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuXHR2YXIgaWRfYWRkaXRpb25hbF9zdHIgPSBhZGRpdGlvbmFsX2NhbGVuZGFyc19lbC52YWx1ZTtcclxuXHR2YXIgaWRfYWRkaXRpb25hbF9hcnIgPSBpZF9hZGRpdGlvbmFsX3N0ci5zcGxpdCggJywnICk7XHJcblxyXG5cdC8vIEZpeEluOiAxMC45LjQuMS5cclxuXHRmb3IgKCB2YXIgaWEgPSAwOyBpYSA8IGlkX2FkZGl0aW9uYWxfYXJyLmxlbmd0aDsgaWErKyApIHtcclxuXHRcdGlkX2FkZGl0aW9uYWxfYXJyWyBpYSBdID0gcGFyc2VJbnQoIGlkX2FkZGl0aW9uYWxfYXJyWyBpYSBdLCAxMCApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAhIGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkuaXMoICc6dmlzaWJsZScgKSApIHtcclxuXHRcdHdwYmNfYm9va2luZ19mb3JtX19zcGluX2xvYWRlcl9fc2hvdyggcmVzb3VyY2VfaWQgKTsgLy8gU2hvdyBTcGlubmVyXHJcblx0fVxyXG5cclxuXHQvLyBIZWxwZXI6IHJld3JpdGUgZmllbGQgbmFtZSBzdWZmaXggZnJvbSByZXNvdXJjZV9pZCAtPiBpZF9hZGRpdGlvbmFsLlxyXG5cdGZ1bmN0aW9uIHdwYmNfcmV3cml0ZV9maWVsZF9uYW1lX3N1ZmZpeCggZmllbGRfbmFtZSwgb2xkX2lkLCBuZXdfaWQgKSB7XHJcblxyXG5cdFx0ZmllbGRfbmFtZSA9IFN0cmluZyggZmllbGRfbmFtZSApO1xyXG5cclxuXHRcdHZhciBvbGRfaWRfc3RyID0gU3RyaW5nKCBvbGRfaWQgKTtcclxuXHRcdHZhciBuZXdfaWRfc3RyID0gU3RyaW5nKCBuZXdfaWQgKTtcclxuXHJcblx0XHQvLyBIYW5kbGUgZmllbGRzIHdpdGggW10uXHJcblx0XHRpZiAoXHJcblx0XHRcdCggZmllbGRfbmFtZS5sZW5ndGggPj0gKCBvbGRfaWRfc3RyLmxlbmd0aCArIDIgKSApICYmXHJcblx0XHRcdCggZmllbGRfbmFtZS5zdWJzdHIoIGZpZWxkX25hbWUubGVuZ3RoIC0gKCBvbGRfaWRfc3RyLmxlbmd0aCArIDIgKSApID09PSAoIG9sZF9pZF9zdHIgKyAnW10nICkgKVxyXG5cdFx0KSB7XHJcblx0XHRcdHJldHVybiBmaWVsZF9uYW1lLnN1YnN0ciggMCwgZmllbGRfbmFtZS5sZW5ndGggLSAoIG9sZF9pZF9zdHIubGVuZ3RoICsgMiApICkgKyBuZXdfaWRfc3RyICsgJ1tdJztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBIYW5kbGUgZmllbGRzIHdpdGhvdXQgW10uXHJcblx0XHRpZiAoXHJcblx0XHRcdCggZmllbGRfbmFtZS5sZW5ndGggPj0gb2xkX2lkX3N0ci5sZW5ndGggKSAmJlxyXG5cdFx0XHQoIGZpZWxkX25hbWUuc3Vic3RyKCBmaWVsZF9uYW1lLmxlbmd0aCAtIG9sZF9pZF9zdHIubGVuZ3RoICkgPT09IG9sZF9pZF9zdHIgKVxyXG5cdFx0KSB7XHJcblx0XHRcdHJldHVybiBmaWVsZF9uYW1lLnN1YnN0ciggMCwgZmllbGRfbmFtZS5sZW5ndGggLSBvbGRfaWRfc3RyLmxlbmd0aCApICsgbmV3X2lkX3N0cjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBGYWxsYmFjazogcmV0dXJuIHVuY2hhbmdlZCAoc2FmZXIgdGhhbiBicmVha2luZyBuYW1lKS5cclxuXHRcdHJldHVybiBmaWVsZF9uYW1lO1xyXG5cdH1cclxuXHJcblx0Zm9yICggaWEgPSAwOyBpYSA8IGlkX2FkZGl0aW9uYWxfYXJyLmxlbmd0aDsgaWErKyApIHtcclxuXHJcblx0XHR2YXIgaWRfYWRkaXRpb25hbCA9IGlkX2FkZGl0aW9uYWxfYXJyWyBpYSBdO1xyXG5cclxuXHRcdC8vIEZpeEluOiAxMC45LjQuMS5cclxuXHRcdGlmICggaWRfYWRkaXRpb25hbCA8PSAwICkge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBSZWJ1aWxkIGZvcm1kYXRhIGZvciBlYWNoIGFkZGl0aW9uYWwgY2FsZW5kYXIgKGxlZ2FjeSBiZWhhdmlvcikuXHJcblx0XHR2YXIgZm9ybWRhdGFfYWRkaXRpb25hbF9hcnIgPSBTdHJpbmcoIGZvcm1kYXRhICkuc3BsaXQoICd+JyApO1xyXG5cdFx0dmFyIGZvcm1kYXRhX2FkZGl0aW9uYWwgPSAnJztcclxuXHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBmb3JtZGF0YV9hZGRpdGlvbmFsX2Fyci5sZW5ndGg7IGorKyApIHtcclxuXHJcblx0XHRcdHZhciBteV9mb3JtX2ZpZWxkID0gZm9ybWRhdGFfYWRkaXRpb25hbF9hcnJbIGogXS5zcGxpdCggJ14nICk7XHJcblxyXG5cdFx0XHRpZiAoIGZvcm1kYXRhX2FkZGl0aW9uYWwgIT09ICcnICkge1xyXG5cdFx0XHRcdGZvcm1kYXRhX2FkZGl0aW9uYWwgKz0gJ34nO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBTYWZldHk6IGVuc3VyZSB3ZSBoYXZlIGF0IGxlYXN0IHR5cGUgXiBuYW1lIF4gdmFsdWUuXHJcblx0XHRcdGlmICggbXlfZm9ybV9maWVsZC5sZW5ndGggPCAzICkge1xyXG5cdFx0XHRcdGZvcm1kYXRhX2FkZGl0aW9uYWwgKz0gZm9ybWRhdGFfYWRkaXRpb25hbF9hcnJbIGogXTtcclxuXHRcdFx0XHRjb250aW51ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bXlfZm9ybV9maWVsZFsgMSBdID0gd3BiY19yZXdyaXRlX2ZpZWxkX25hbWVfc3VmZml4KCBteV9mb3JtX2ZpZWxkWyAxIF0sIHJlc291cmNlX2lkLCBpZF9hZGRpdGlvbmFsICk7XHJcblx0XHRcdGZvcm1kYXRhX2FkZGl0aW9uYWwgKz0gbXlfZm9ybV9maWVsZFsgMCBdICsgJ14nICsgbXlfZm9ybV9maWVsZFsgMSBdICsgJ14nICsgbXlfZm9ybV9maWVsZFsgMiBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIElmIHBheW1lbnQgZm9ybSBmb3IgbWFpbiBib29raW5nIHJlc291cmNlIGlzIHNob3dpbmcsIGFwcGVuZCBmb3IgYWRkaXRpb25hbCBjYWxlbmRhcnMuXHJcblx0XHRpZiAoIGpRdWVyeSggJyNnYXRld2F5X3BheW1lbnRfZm9ybXMnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICkge1xyXG5cdFx0XHRqUXVlcnkoICcjZ2F0ZXdheV9wYXltZW50X2Zvcm1zJyArIHJlc291cmNlX2lkICkuYWZ0ZXIoICc8ZGl2IGlkPVwiZ2F0ZXdheV9wYXltZW50X2Zvcm1zJyArIGlkX2FkZGl0aW9uYWwgKyAnXCI+PC9kaXY+JyApO1xyXG5cdFx0XHRqUXVlcnkoICcjZ2F0ZXdheV9wYXltZW50X2Zvcm1zJyArIHJlc291cmNlX2lkICkuYWZ0ZXIoICc8ZGl2IGlkPVwiYWpheF9yZXNwb25kX2luc2VydCcgKyBpZF9hZGRpdGlvbmFsICsgJ1wiIHN0eWxlPVwiZGlzcGxheTpub25lO1wiPjwvZGl2PicgKTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBGaXhJbjogOC41LjIuMTcuXHJcblx0XHR3cGJjX3NlbmRfYWpheF9zdWJtaXQoIGlkX2FkZGl0aW9uYWwsIGZvcm1kYXRhX2FkZGl0aW9uYWwsIGNhcHRjaGFfY2hhbGFuZ2UsIHVzZXJfY2FwdGNoYSwgaXNfc2VuZF9lbWVpbHMsIG15X2Jvb2tpbmdfaGFzaCwgbXlfYm9va2luZ19mb3JtLCB3cGRldl9hY3RpdmVfbG9jYWxlICk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNlbmQgQWpheCBzdWJtaXQgKGxlZ2FjeTogc2VuZF9hamF4X3N1Ym1pdCkuXHJcbiAqXHJcbiAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWRcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBmb3JtZGF0YVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIGNhcHRjaGFfY2hhbGFuZ2VcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICB1c2VyX2NhcHRjaGFcclxuICogQHBhcmFtIHtudW1iZXJ9ICAgICAgICBpc19zZW5kX2VtZWlsc1xyXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIG15X2Jvb2tpbmdfaGFzaFxyXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIG15X2Jvb2tpbmdfZm9ybVxyXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIHdwZGV2X2FjdGl2ZV9sb2NhbGVcclxuICpcclxuICogQHJldHVybiB7dW5kZWZpbmVkfSBMZWdhY3kgYmVoYXZpb3IuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3NlbmRfYWpheF9zdWJtaXQocmVzb3VyY2VfaWQsIGZvcm1kYXRhLCBjYXB0Y2hhX2NoYWxhbmdlLCB1c2VyX2NhcHRjaGEsIGlzX3NlbmRfZW1laWxzLCBteV9ib29raW5nX2hhc2gsIG15X2Jvb2tpbmdfZm9ybSwgd3BkZXZfYWN0aXZlX2xvY2FsZSkge1xyXG5cclxuXHRyZXNvdXJjZV9pZCA9IHBhcnNlSW50KCByZXNvdXJjZV9pZCwgMTAgKTtcclxuXHJcblx0Ly8gRGlzYWJsZSBTdWJtaXQgfCBTaG93IHNwaW4gbG9hZGVyLlxyXG5cdHdwYmNfYm9va2luZ19mb3JtX19vbl9zdWJtaXRfX3VpX2VsZW1lbnRzX2Rpc2FibGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdC8vIEZpeEluOiAyMDI2LTAyLTA1IC0gcGFzcyBwcmV2aWV3IGNvbnRleHQgdG8gYm9va2luZyBjcmVhdGUgQWpheC5cclxuXHR2YXIgZm9ybV9zdGF0dXMgID0gd3BiY19fZ2V0X2Zvcm1fc3RhdHVzX2Zvcl9zdWJtaXQoIHJlc291cmNlX2lkICk7XHJcblx0dmFyIHByZXZpZXdfYXJncyA9IChmb3JtX3N0YXR1cyA9PT0gJ3ByZXZpZXcnKSA/IHdwYmNfX2dldF9iZmJfcHJldmlld19hcmdzX2Zyb21fbG9jYXRpb24oKSA6IG51bGw7XHJcblx0dmFyICRhZGRfYm9va2luZ19tb2RhbCA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5jbG9zZXN0KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uJyApO1xuXHR2YXIgaXNfYWxsb3dfcGFzdCA9IDA7XG5cdHZhciBjbGFzc2ljX2Jvb2tpbmdfY29udGV4dF90b2tlbiA9ICcnO1xuXHR2YXIgYWRtaW5fYm9va2luZ19ub25jZSA9ICcnO1xuXHR2YXIgaGFzX2FkZF9ib29raW5nX21vZGFsX2NvbnRleHQgPSAoICRhZGRfYm9va2luZ19tb2RhbC5sZW5ndGggJiYgJGFkZF9ib29raW5nX21vZGFsLmlzKCAnOnZpc2libGUnICkgKTtcblx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIF93cGJjICkge1xuXHRcdGFkbWluX2Jvb2tpbmdfbm9uY2UgPSBTdHJpbmcoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9hZG1pbl9ib29raW5nX25vbmNlJyApIHx8ICcnICk7XG5cdH1cblxyXG5cdGlmICggaGFzX2FkZF9ib29raW5nX21vZGFsX2NvbnRleHQgKSB7XHJcblx0XHRpc19hbGxvd19wYXN0ID0gJGFkZF9ib29raW5nX21vZGFsLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLWFsbG93LXBhc3RdJyApLmZpcnN0KCkuaXMoICc6Y2hlY2tlZCcgKSA/IDEgOiAwO1xyXG5cdFx0aWYgKCAhIGlzX2FsbG93X3Bhc3QgKSB7XHJcblx0XHRcdGlzX2FsbG93X3Bhc3QgPSAoICcxJyA9PT0gU3RyaW5nKCAkYWRkX2Jvb2tpbmdfbW9kYWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0JyApIHx8ICcwJyApICkgPyAxIDogMDtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKCAhIGhhc19hZGRfYm9va2luZ19tb2RhbF9jb250ZXh0ICYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyApICkge1xuXHRcdGlzX2FsbG93X3Bhc3QgPSAoICcxJyA9PT0gU3RyaW5nKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYWxsb3dfcGFzdCcgKSB8fCAnMCcgKSApID8gMSA6IDA7XG5cdFx0Y2xhc3NpY19ib29raW5nX2NvbnRleHRfdG9rZW4gPSBTdHJpbmcoIF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjbGFzc2ljX2Jvb2tpbmdfY29udGV4dF90b2tlbicgKSB8fCAnJyApO1xuXHR9XG5cclxuXHR2YXIgcmVxdWVzdF9wYXJhbXMgPSB7XHJcblx0XHQncmVzb3VyY2VfaWQnICAgICAgICAgICAgICA6IHJlc291cmNlX2lkLFxyXG5cdFx0J2RhdGVzX2RkbW15eV9jc3YnICAgICAgICAgOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbHVlLFxyXG5cdFx0J2Zvcm1kYXRhJyAgICAgICAgICAgICAgICAgOiBmb3JtZGF0YSxcclxuXHRcdCdib29raW5nX2hhc2gnICAgICAgICAgICAgIDogbXlfYm9va2luZ19oYXNoLFxyXG5cdFx0J2N1c3RvbV9mb3JtJyAgICAgICAgICAgICAgOiBteV9ib29raW5nX2Zvcm0sXHJcblx0XHQnYWdncmVnYXRlX3Jlc291cmNlX2lkX2Fycic6ICggKCBudWxsICE9PSBfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicgKSApID8gX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInICkuam9pbiggJywnICkgOiAnJyApLFxyXG5cdFx0J2NhcHRjaGFfY2hhbGFuZ2UnICAgICAgICAgOiBjYXB0Y2hhX2NoYWxhbmdlLFxyXG5cdFx0J2NhcHRjaGFfdXNlcl9pbnB1dCcgICAgICAgOiB1c2VyX2NhcHRjaGEsXHJcblx0XHQnaXNfZW1haWxzX3NlbmQnICAgICAgICAgICA6IGlzX3NlbmRfZW1laWxzLFxyXG5cdFx0J2FjdGl2ZV9sb2NhbGUnICAgICAgICAgICAgOiB3cGRldl9hY3RpdmVfbG9jYWxlLFxyXG5cdFx0J2Zvcm1fc3RhdHVzJyAgICAgICAgICAgICAgOiBmb3JtX3N0YXR1cyxcblx0XHQnYWxsb3dfcGFzdCcgICAgICAgICAgICAgICA6IGlzX2FsbG93X3Bhc3QsXG5cdFx0J2NsYXNzaWNfYm9va2luZ19jb250ZXh0X3Rva2VuJzogY2xhc3NpY19ib29raW5nX2NvbnRleHRfdG9rZW4sXG5cdFx0J3dwYmNfYWRtaW5fYm9va2luZ19ub25jZScgICAgIDogYWRtaW5fYm9va2luZ19ub25jZVxuXHR9O1xuXHJcblx0dmFyICR0aW1lX292ZXJyaWRlX3BhbmVsID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCApLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtcGFuZWxdJyApLmZpcnN0KCk7XHJcblx0aWYgKCAhICR0aW1lX292ZXJyaWRlX3BhbmVsLmxlbmd0aCApIHtcclxuXHRcdCR0aW1lX292ZXJyaWRlX3BhbmVsID0galF1ZXJ5KCAnI3dwYmNfbW9kYWxfX2FkZF9ib29raW5nX19zZWN0aW9uOnZpc2libGUnICkuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1wYW5lbF0nICkuZmlyc3QoKTtcclxuXHR9XHJcblx0aWYgKFxyXG5cdFx0ICAgJHRpbWVfb3ZlcnJpZGVfcGFuZWwubGVuZ3RoXHJcblx0XHQmJiAkdGltZV9vdmVycmlkZV9wYW5lbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWVuYWJsZWRdJyApLmZpcnN0KCkuaXMoICc6Y2hlY2tlZCcgKVxyXG5cdCkge1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfdGltZV9vdmVycmlkZV9lbmFibGVkJ10gPSAxO1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfdGltZV9vdmVycmlkZV9zb3VyY2UnXSAgPSAkdGltZV9vdmVycmlkZV9wYW5lbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtc291cmNlJyApIHx8ICcnO1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfdGltZV9vdmVycmlkZV9zdGFydCddICAgPSAkdGltZV9vdmVycmlkZV9wYW5lbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLWZpZWxkPVwic3RhcnRcIl0nICkuZmlyc3QoKS52YWwoKSB8fCAnJztcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX3RpbWVfb3ZlcnJpZGVfZW5kJ10gICAgID0gJHRpbWVfb3ZlcnJpZGVfcGFuZWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cImVuZFwiXScgKS5maXJzdCgpLnZhbCgpIHx8ICcnO1xyXG5cdH1cclxuXHJcblx0dmFyIHNlbGVjdGVkX2RhdGVzX2NvdW50ID0gU3RyaW5nKCByZXF1ZXN0X3BhcmFtc1snZGF0ZXNfZGRtbXl5X2NzdiddIHx8ICcnICkuc3BsaXQoICcsJyApLmZpbHRlciggZnVuY3Rpb24oIGRhdGVfdGV4dCApe1xyXG5cdFx0cmV0dXJuICcnICE9PSBTdHJpbmcoIGRhdGVfdGV4dCB8fCAnJyApLnJlcGxhY2UoIC9eXFxzK3xcXHMrJC9nLCAnJyApO1xyXG5cdH0gKS5sZW5ndGg7XHJcblx0dmFyIGlzX3RpbWVzX2F2YWlsYWJpbGl0eV9vdmVycmlkZSA9IChcclxuXHRcdCAgICggMSA9PT0gcGFyc2VJbnQoIHJlcXVlc3RfcGFyYW1zWyd3cGJjX3RpbWVfb3ZlcnJpZGVfZW5hYmxlZCddIHx8IDAsIDEwICkgKVxyXG5cdFx0JiYgKCAndGltZXNfYXZhaWxhYmlsaXR5JyA9PT0gU3RyaW5nKCByZXF1ZXN0X3BhcmFtc1snd3BiY190aW1lX292ZXJyaWRlX3NvdXJjZSddIHx8ICcnICkgKVxyXG5cdCk7XHJcblx0aWYgKFxyXG5cdFx0ICAgKFxyXG5cdFx0XHQgICBoYXNfYWRkX2Jvb2tpbmdfbW9kYWxfY29udGV4dFxyXG5cdFx0XHQmJiAnMScgPT09IFN0cmluZyggJGFkZF9ib29raW5nX21vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctZm9yY2UtcmVjdXJyZW50LXRpbWUnICkgfHwgJzAnIClcclxuXHRcdCAgIClcclxuXHRcdHx8IChcclxuXHRcdFx0ICAgaXNfdGltZXNfYXZhaWxhYmlsaXR5X292ZXJyaWRlXHJcblx0XHRcdCYmICggc2VsZWN0ZWRfZGF0ZXNfY291bnQgPiAxIClcclxuXHRcdCAgIClcclxuXHQpIHtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWydpc191c2VfYm9va2luZ19yZWN1cnJlbnRfdGltZSddID0gMTtcclxuXHR9XHJcblxyXG5cdC8vIElmIHByZXZpZXcsIHBhc3Mgc2Vzc2lvbiBpZGVudGlmaWVycyBzbyBQSFAgY2FuIGxvYWQgdHJhbnNpZW50IHNuYXBzaG90LlxyXG5cdGlmICggcHJldmlld19hcmdzICYmIHByZXZpZXdfYXJncy50b2tlbiAmJiBwcmV2aWV3X2FyZ3MuZm9ybV9pZCApIHtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX2JmYl9wcmV2aWV3J10gICAgICAgICA9IDE7XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snd3BiY19iZmJfcHJldmlld190b2tlbiddICAgPSBwcmV2aWV3X2FyZ3MudG9rZW47XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snd3BiY19iZmJfcHJldmlld19mb3JtX2lkJ10gPSBwcmV2aWV3X2FyZ3MuZm9ybV9pZDtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX2JmYl9wcmV2aWV3X25vbmNlJ10gICA9IHByZXZpZXdfYXJncy5ub25jZTsgLy8gbm90ZTogVVJMIHBhcmFtIGlzIGBub25jZWAuXHJcblx0fVxyXG5cclxuXHR2YXIgaXNfZXhpdCA9IHdwYmNfYWp4X2Jvb2tpbmdfX2NyZWF0ZSggcmVxdWVzdF9wYXJhbXMgKTtcclxuXHJcblx0aWYgKCB0cnVlID09PSBpc19leGl0ICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxufVxyXG5cclxuXHJcblxyXG4vLyA9PSBIZWxwZXIgRnVuY3Rpb25zID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuXHJcbi8qKlxyXG4gKiBQYXJzZSBxdWVyeSBzdHJpbmcgaW50byB7a2V5OnZhbHVlfSAob2xkLWJyb3dzZXIgc2FmZSkuXHJcbiAqXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSBxc1xyXG4gKiBAcmV0dXJuIHtPYmplY3R9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX19wYXJzZV9xdWVyeV9zdHJpbmcocXMpIHtcclxuXHR2YXIgb3V0ID0ge307XHJcblx0cXMgICAgICA9IChxcyB8fCAnJyk7XHJcblx0cXMgICAgICA9IHFzLnJlcGxhY2UoIC9eXFw/LywgJycgKTtcclxuXHRpZiAoICEgcXMgKSB7XHJcblx0XHRyZXR1cm4gb3V0O1xyXG5cdH1cclxuXHJcblx0dmFyIHBhcnRzID0gcXMuc3BsaXQoICcmJyApO1xyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrICkge1xyXG5cdFx0dmFyIGt2ID0gcGFydHNbaV0uc3BsaXQoICc9JyApO1xyXG5cdFx0dmFyIGsgID0gZGVjb2RlVVJJQ29tcG9uZW50KCBrdlswXSB8fCAnJyApO1xyXG5cdFx0aWYgKCAhIGsgKSB7XHJcblx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHYgID0gZGVjb2RlVVJJQ29tcG9uZW50KCBrdi5zbGljZSggMSApLmpvaW4oICc9JyApIHx8ICcnICk7XHJcblx0XHRvdXRba10gPSB2O1xyXG5cdH1cclxuXHRyZXR1cm4gb3V0O1xyXG59XHJcblxyXG4vKipcclxuICogRGV0ZWN0IHByZXZpZXcgYXJncyBmcm9tIGN1cnJlbnQgVVJMIChpZnJhbWUgVVJMKS5cclxuICpcclxuICogQHJldHVybiB7T2JqZWN0fG51bGx9IHsgdG9rZW4sIGZvcm1faWQsIG5vbmNlIH0gb3IgbnVsbFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19fZ2V0X2JmYl9wcmV2aWV3X2FyZ3NfZnJvbV9sb2NhdGlvbigpIHtcclxuXHR0cnkge1xyXG5cdFx0dmFyIHAgPSB3cGJjX19wYXJzZV9xdWVyeV9zdHJpbmcoICh3aW5kb3cubG9jYXRpb24gJiYgd2luZG93LmxvY2F0aW9uLnNlYXJjaCkgPyB3aW5kb3cubG9jYXRpb24uc2VhcmNoIDogJycgKTtcclxuXHJcblx0XHRpZiAoICEgcC53cGJjX2JmYl9wcmV2aWV3IHx8IChwLndwYmNfYmZiX3ByZXZpZXcgPT09ICcwJykgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBwLndwYmNfYmZiX3ByZXZpZXdfdG9rZW4gfHwgISBwLndwYmNfYmZiX3ByZXZpZXdfZm9ybV9pZCApIHtcclxuXHRcdFx0cmV0dXJuIG51bGw7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0dG9rZW4gIDogU3RyaW5nKCBwLndwYmNfYmZiX3ByZXZpZXdfdG9rZW4gKSxcclxuXHRcdFx0Zm9ybV9pZDogcGFyc2VJbnQoIHAud3BiY19iZmJfcHJldmlld19mb3JtX2lkLCAxMCApIHx8IDAsXHJcblx0XHRcdG5vbmNlICA6IChwLm5vbmNlKSA/IFN0cmluZyggcC5ub25jZSApIDogJydcclxuXHRcdH07XHJcblx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXNvbHZlIGZvcm0gc3RhdHVzIGZvciBzdWJtaXQuXHJcbiAqXHJcbiAqIFByaW9yaXR5OlxyXG4gKiAxKSBzaG9ydGNvZGUgcGFyYW0gZXhwb3NlZCB2aWEgX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKC4uLiwgJ2Zvcm1fc3RhdHVzJylcclxuICogMikgZGV0ZWN0IHByZXZpZXcgVVJMIGFyZ3NcclxuICogMykgZmFsbGJhY2s6IHB1Ymxpc2hlZFxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcn0gcmVzb3VyY2VfaWRcclxuICogQHJldHVybiB7c3RyaW5nfSAncHJldmlldyd8J3B1Ymxpc2hlZCdcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfX2dldF9mb3JtX3N0YXR1c19mb3Jfc3VibWl0KHJlc291cmNlX2lkKSB7XHJcblxyXG5cdHZhciBzdGF0dXMgPSAnJztcclxuXHJcblx0dHJ5IHtcclxuXHRcdGlmICggKHR5cGVvZiBfd3BiYyAhPT0gJ3VuZGVmaW5lZCcpICYmIF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSApIHtcclxuXHRcdFx0c3RhdHVzID0gX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2Zvcm1fc3RhdHVzJyApO1xyXG5cdFx0fVxyXG5cdH0gY2F0Y2ggKCBlICkge31cclxuXHJcblx0c3RhdHVzID0gKHN0YXR1cyA9PSBudWxsKSA/ICcnIDogU3RyaW5nKCBzdGF0dXMgKTtcclxuXHRzdGF0dXMgPSBzdGF0dXMudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0Ly8gVVJMLWJhc2VkIGRldGVjdGlvbiBmb3IgcHJldmlldyBpZnJhbWUuXHJcblx0dmFyIHByZXZpZXdfYXJncyA9IHdwYmNfX2dldF9iZmJfcHJldmlld19hcmdzX2Zyb21fbG9jYXRpb24oKTtcclxuXHRpZiAoIHByZXZpZXdfYXJncyApIHtcclxuXHRcdHJldHVybiAncHJldmlldyc7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gKHN0YXR1cyA9PT0gJ3ByZXZpZXcnKSA/ICdwcmV2aWV3JyA6ICdwdWJsaXNoZWQnO1xyXG59XHJcblxyXG5cclxuXHJcbi8vID09IEJhY2t3YXJkLWNvbXBhdGlibGUgd3JhcHBlcnMgKGtlZXAgb2xkIGdsb2JhbCBuYW1lcyB3b3JraW5nIDEwMCUgYXMgYmVmb3JlKS4gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG5mdW5jdGlvbiBteWJvb2tpbmdfc3VibWl0KCBzdWJtaXRfZm9ybSwgcmVzb3VyY2VfaWQsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKSB7XHJcblx0cmV0dXJuIHdwYmNfYm9va2luZ19mb3JtX3N1Ym1pdCggc3VibWl0X2Zvcm0sIHJlc291cmNlX2lkLCB3cGRldl9hY3RpdmVfbG9jYWxlICk7XHJcbn1cclxuIiwidHJ5IHtcclxuXHR2YXIgZXYgPSAodHlwZW9mIEN1c3RvbUV2ZW50ID09PSAnZnVuY3Rpb24nKSA/IG5ldyBDdXN0b21FdmVudCggJ3dwYmMtcmVhZHknICkgOiBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0V2ZW50JyApO1xyXG5cdGlmICggZXYuaW5pdEV2ZW50ICkge1xyXG5cdFx0ZXYuaW5pdEV2ZW50KCAnd3BiYy1yZWFkeScsIHRydWUsIHRydWUgKTtcclxuXHR9XHJcblx0ZG9jdW1lbnQuZGlzcGF0Y2hFdmVudCggZXYgKTtcclxuXHRjb25zb2xlLmxvZyggJ3dwYmMtcmVhZHknICk7XHJcbn0gY2F0Y2ggKCBlICkge1xyXG5cdGNvbnNvbGUuZXJyb3IoIFwiV1BCQyBldmVudCAnd3BiYy1yZWFkeScgZmFpbGVkIVwiLCBlICk7XHJcbn1cclxuIl19

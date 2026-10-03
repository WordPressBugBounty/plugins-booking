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
				beforeSelectDay: function ( js_date, inst ) {
					return 'function' === typeof wpbc__calendar__before_select_days__bs
						? wpbc__calendar__before_select_days__bs( js_date, resource_id, inst ) : true;
				},
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
	 * Apply optional, one-way date constraints to a native availability result.
	 *
	 * Listeners receive only a new constraint object. No booking, availability,
	 * season, or calendar parameter objects are exposed. Core availability stays
	 * authoritative because the returned state can only change from selectable to
	 * blocked; a listener cannot reopen a natively unavailable date.
	 *
	 * Event: wpbc_calendar__apply_date_constraints
	 *
	 * Constraint object:
	 * {
	 *     resource_id: resource_id,
	 *     sql_date: sql_date,
	 *     is_blocked: false,
	 *     css_classes: []
	 * }
	 *
	 * Listeners may set is_blocked to the boolean true and append individual,
	 * valid CSS class names to css_classes. Core-owned availability classes are
	 * ignored when supplied by listeners.
	 *
	 * @param {number|string} resource_id           Booking resource ID.
	 * @param {string}        sql_date              Calendar date in YYYY-MM-DD format.
	 * @param {boolean}       is_natively_selectable Whether core marked the date selectable.
	 * @param {string[]}      native_css_classes    Core-generated CSS classes.
	 * @returns {{is_selectable: boolean, css_classes: string[]}} Constrained result.
	 */
	function wpbc_calendar__evaluate_date_constraints( resource_id, sql_date, is_natively_selectable, native_css_classes ) {

		var date_constraint = {
			'resource_id': resource_id,
			'sql_date': sql_date,
			'is_blocked': false,
			'css_classes': []
		};
		var result_css_classes = Array.isArray( native_css_classes ) ? native_css_classes.slice( 0 ) : [];
		var constraint_class_index;
		var constraint_css_class;

		jQuery( 'body' ).trigger( 'wpbc_calendar__apply_date_constraints', [ date_constraint ] );

		if ( true === date_constraint.is_blocked ) {
			for ( constraint_class_index = result_css_classes.length - 1; constraint_class_index >= 0; constraint_class_index-- ) {
				if ( 'date_available' === result_css_classes[ constraint_class_index ] ) {
					result_css_classes.splice( constraint_class_index, 1 );
				}
			}

			if ( -1 === result_css_classes.indexOf( 'date_user_unavailable' ) ) {
				result_css_classes.push( 'date_user_unavailable' );
			}
		}

		if ( Array.isArray( date_constraint.css_classes ) ) {
			for ( constraint_class_index = 0; constraint_class_index < date_constraint.css_classes.length; constraint_class_index++ ) {
				if ( 'string' !== typeof date_constraint.css_classes[ constraint_class_index ] ) {
					continue;
				}

				constraint_css_class = date_constraint.css_classes[ constraint_class_index ].trim();
				if (
					   '' === constraint_css_class
					|| 'date_available' === constraint_css_class
					|| 'date_user_unavailable' === constraint_css_class
					|| ! /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test( constraint_css_class )
				) {
					continue;
				}

				if ( -1 === result_css_classes.indexOf( constraint_css_class ) ) {
					result_css_classes.push( constraint_css_class );
				}
			}
		}

		return {
			'is_selectable': Boolean( is_natively_selectable ) && true !== date_constraint.is_blocked,
			'css_classes': result_css_classes
		};
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


		var is_day_selectable     = false;
		var date_constraint_result;

		// If something not defined,  then  this date closed --------------------------------------------------------------- // FixIn: 10.12.4.6.
		if ( (false === date_bookings_obj) || ('undefined' === typeof (date_bookings_obj[resource_id])) ) {

			css_classes__for_date.push( 'date_user_unavailable' );
			date_constraint_result = wpbc_calendar__evaluate_date_constraints( resource_id, sql_class_day, is_day_selectable, css_classes__for_date );

			return [ date_constraint_result.is_selectable, date_constraint_result.css_classes.join( ' ' ) ];
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

		date_constraint_result = wpbc_calendar__evaluate_date_constraints( resource_id, sql_class_day, is_day_selectable, css_classes__for_date );

		return [ date_constraint_result.is_selectable, date_constraint_result.css_classes.join( ' ' ) ];
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
	 * Determine native date selectability without optional date constraints.
	 *
	 * This helper exposes the canonical calendar result for algorithms, such as
	 * gap discovery, that must not consume their own derived constraints. It does
	 * not trigger wpbc_calendar__apply_date_constraints and must remain free of
	 * optional-module state.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 * @param {string}        sql_date    Calendar date in YYYY-MM-DD format.
	 * @returns {boolean} True when core calendar data marks the date selectable.
	 */
	function wpbc_is_this_day_selectable__raw( resource_id, sql_date ){

		// Get Data --------------------------------------------------------------------------------------------------------
		var date_bookings_obj = _wpbc.bookings_in_calendar__get_for_date( resource_id, sql_date );
		var is_day_selectable = false;

		if ( date_bookings_obj && 'undefined' !== typeof ( date_bookings_obj[ 'day_availability' ] ) ) {
			is_day_selectable = ( parseInt( date_bookings_obj[ 'day_availability' ] ) > 0 );

			if ( 'undefined' !== typeof ( date_bookings_obj[ 'summary' ] ) && 'available' != date_bookings_obj[ 'summary']['status_for_day' ] ){

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
		}

		return Boolean( is_day_selectable );
	}

	/**
	 * Determine final date selectability after native and optional constraints.
	 *
	 * Native unavailability returns immediately. Optional modules may therefore
	 * only block a natively selectable date and can never reopen a core-unavailable
	 * date.
	 *
	 * @param {number|string} resource_id Booking resource ID.
	 * @param {string}        sql_date    Calendar date in YYYY-MM-DD format.
	 * @returns {boolean} True when the date remains selectable after constraints.
	 */
	function wpbc_is_this_day_selectable( resource_id, sql_date ){

		var is_natively_selectable = wpbc_is_this_day_selectable__raw( resource_id, sql_date );

		if ( ! is_natively_selectable ) {
			return false;
		}

		return wpbc_calendar__evaluate_date_constraints( resource_id, sql_date, is_natively_selectable, [] ).is_selectable;
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

		return wpbc_get__selected_dates_sql__as_arr( resource_id ).length;
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

					/**
					 * Allow optional modules to calculate derived calendar state after canonical
					 * AJAX data is stored and before the first refreshed calendar render.
					 *
					 * @param {number|string} resource_id Booking resource ID.
					 */
					jQuery( 'body' ).trigger( 'wpbc_calendar_ajx__before_update_look', [ response_data[ 'resource_id' ] ] );

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

					var fallback_error_message = _wpbc.get_message( 'message_unexpected_server_response' ) || 'The server returned an unexpected response. Please reload the page and try again.';
					var conflict_cache_hint    = _wpbc.get_message( 'message_http_conflict_cache_hint' ) || 'A cached or optimized version of this page may be outdated. Clear the browser cache and reload the page. Website administrators should also purge page, server, and CDN caches and regenerate minified or optimized files.';
					var error_message          = wpbc_front_end__get_ajax_error_message( jqXHR, fallback_error_message, conflict_cache_hint );
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
 * Extract a safe plain-text message from a recognized JSON AJAX error response.
 *
 * Only documented message properties are accepted. Callers must still render the returned value in text mode so an
 * upstream response cannot inject markup into the public booking page.
 *
 * @param {jqXHR|null} jq_xhr jQuery XHR object, when available.
 * @return {string} Bounded server message, or an empty string when the response is not recognized.
 */
function wpbc_front_end__get_safe_ajax_error_message( jq_xhr ) {
	if (
		! jq_xhr
		|| ! jq_xhr.responseJSON
		|| 'object' !== typeof jq_xhr.responseJSON
		|| Array.isArray( jq_xhr.responseJSON )
	) {
		return '';
	}

	var response_json      = jq_xhr.responseJSON;
	var message_candidates = [];

	if ( 'string' === typeof response_json.message ) {
		message_candidates.push( response_json.message );
	}
	if (
		response_json.data
		&& 'object' === typeof response_json.data
		&& ! Array.isArray( response_json.data )
		&& 'string' === typeof response_json.data.message
	) {
		message_candidates.push( response_json.data.message );
	}

	for ( var candidate_index = 0; candidate_index < message_candidates.length; candidate_index++ ) {
		var server_message = message_candidates[ candidate_index ].trim();
		if ( server_message ) {
			return server_message.slice( 0, 1000 );
		}
	}

	return '';
}

/**
 * Build a public-safe AJAX failure message with optional HTTP 409 cache troubleshooting guidance.
 *
 * @param {jqXHR|null} jq_xhr                    jQuery XHR object, when available.
 * @param {string}     fallback_message          Localized fallback shown when no safe server message exists.
 * @param {string}     http_conflict_cache_hint  Optional localized cache guidance for HTTP 409 responses.
 * @return {string} Plain-text message including the HTTP status when available.
 */
function wpbc_front_end__get_ajax_error_message( jq_xhr, fallback_message, http_conflict_cache_hint ) {
	var http_status         = jq_xhr && jq_xhr.status ? parseInt( jq_xhr.status, 10 ) : 0;
	var safe_server_message = wpbc_front_end__get_safe_ajax_error_message( jq_xhr );
	var error_message       = safe_server_message || String( fallback_message || '' ).trim();

	if ( 409 === http_status && http_conflict_cache_hint ) {
		error_message += ( error_message ? ' ' : '' ) + String( http_conflict_cache_hint ).trim();
	}
	if ( http_status ) {
		error_message += ' (' + http_status + ')';
	}

	return error_message;
}

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
		var content_type       = '';
		var response_text      = 'string' === typeof response_data ? response_data : '';
		var response_length    = response_text.length;
		var response_format    = response_text ? 'text' : 'empty';
		var http_status        = jq_xhr && jq_xhr.status ? parseInt( jq_xhr.status, 10 ) : 0;
		var diagnostic_action  = String( ajax_action || 'AJAX' ).replace( /^WPBC_AJX_/, '' ).replace( /[^A-Za-z0-9]+/g, '-' ).toUpperCase();
		var diagnostic_code    = 'WPBC-' + diagnostic_action + '-' + ( http_status || 'NETWORK' );
		var response_headers   = {};
		if ( jq_xhr && 'function' === typeof jq_xhr.getResponseHeader ) {
			content_type = jq_xhr.getResponseHeader( 'content-type' ) || '';
			response_headers = {
				'server'           : jq_xhr.getResponseHeader( 'server' ) || '',
				'cf_ray'           : jq_xhr.getResponseHeader( 'cf-ray' ) || '',
				'x_cache'          : jq_xhr.getResponseHeader( 'x-cache' ) || '',
				'x_cache_status'   : jq_xhr.getResponseHeader( 'x-cache-status' ) || '',
				'x_litespeed_cache': jq_xhr.getResponseHeader( 'x-litespeed-cache' ) || '',
				'x_request_id'     : jq_xhr.getResponseHeader( 'x-request-id' ) || ''
			};
		}
		if ( jq_xhr && jq_xhr.responseJSON && 'object' === typeof jq_xhr.responseJSON ) {
			response_format = 'json';
			try {
				response_length = JSON.stringify( jq_xhr.responseJSON ).length;
			} catch ( response_json_error ) {
				response_length = 0;
			}
		} else if ( -1 !== content_type.toLowerCase().indexOf( 'html' ) || /^\s*(?:<!doctype|<html)/i.test( response_text ) ) {
			response_format = 'html';
		}

		window.console.error( '[WPBC][AJAX-UNEXPECTED-RESPONSE] ' + ajax_action, {
			'action'          : ajax_action,
			'diagnostic_code' : diagnostic_code,
			'http_status'     : http_status,
			'http_status_text': jq_xhr && jq_xhr.statusText ? jq_xhr.statusText : '',
			'text_status'     : text_status || '',
			'error'           : error_thrown || '',
			'content_type'    : content_type,
			'response_format' : response_format,
			'response_length' : response_length,
			'server_message'  : wpbc_front_end__get_safe_ajax_error_message( jq_xhr ),
			'response_headers': response_headers,
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
	 * Messages
	 * ------------------------------------------------------------------------ */

	/**
	 * Build visitor messages for a resource, using localized Form Messages when available.
	 * @param {string|number} rid
	 * @return {{duplicate:string,init_failed:string,support:string,lib_jq:string,lib_dp:string,lib_wpbc:string}}
	 */
	function get_messages(rid) {
		var rid_int          = parseInt( rid, 10 );
		var duplicate_message =
			'More than one calendar or booking form for Booking Resource ID {resource_id} is present on this page. ' +
			'A hidden copy still conflicts with the visible form and can prevent booking submission. ' +
			'The site administrator must keep only one calendar or form for this Booking Resource. ' +
			'After the page is corrected, reload it and try again.';

		if ( w._wpbc && typeof w._wpbc.get_message === 'function' ) {
			duplicate_message = w._wpbc.get_message( 'message_duplicate_booking_resource_on_page' ) || duplicate_message;
		}
		duplicate_message = String( duplicate_message ).replace( /\{resource_id\}/g, String( rid_int ) );

		return {
			duplicate  : duplicate_message,
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
	 * Escape a plain-text loader message before inserting its wrapper markup.
	 *
	 * @param {string} plain_text Visitor-facing plain text.
	 * @return {string} HTML-safe text.
	 */
	function escape_html(plain_text) {
		return String( plain_text || '' )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	/**
	 * Wrap plain text (with newlines) in a small HTML container.
	 * @param {string} msg
	 * @return {string}
	 */
	function wrap_html(msg) {
		return '<div style="font-size:13px;margin:10px;">' + escape_html( msg ).replace( /\n/g, '<br>' ) + '</div>';
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
 * Check whether a form belongs to a request-local booking preview.
 *
 * Signed iframe and new-window previews intentionally do not use this marker;
 * they retain the complete Booking Calendar preview lifecycle.
 *
 * @param {HTMLFormElement} submit_form Booking form being submitted.
 * @return {boolean} True when final submission must remain local and non-mutating.
 */
function wpbc_booking_form__is_inline_preview_submission( submit_form ) {
	return 0 < jQuery( submit_form ).closest( '[data-wpbc-inline-booking-preview="1"]' ).length;
}

/**
 * Explain below the form why a request-local preview cannot create a booking.
 *
 * @param {HTMLFormElement} submit_form Booking form being submitted.
 * @return {void}
 */
function wpbc_booking_form__show_inline_preview_submission_notice( submit_form ) {
	wpbc_front_end__show_message__warning_under_element(
		submit_form,
		_wpbc.get_message( 'message_inline_preview_submission_disabled' ),
		'text'
	);
}

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

	if ( wpbc_booking_form__is_inline_preview_submission( submit_form ) ) {
		wpbc_booking_form__show_inline_preview_submission_notice( submit_form );
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndwYmNfdXRpbHMuanMiLCJ3cGJjLmpzIiwiZGV2X2xvZy5qcyIsImFqeF9sb2FkX2JhbGFuY2VyLmpzIiwid3BiY19jYWwuanMiLCJkYXlzX3NlbGVjdF9jdXN0b20uanMiLCJ3cGJjX2NhbF9hanguanMiLCJ3cGJjX2ZlX21lc3NhZ2VzLmpzIiwidGltZWxpbmVfcG9wb3Zlci5qcyIsIndwYmNfY2FsX2xvYWRlci5qcyIsImF1dG9maWxsX2ZpZWxkcy5qcyIsImJvb2tpbmdfZm9ybV9zdWJtaXQuanMiLCJ3cGJjX3JlYWR5X2V2ZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9oQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5cUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDM1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1aUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDaFdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzF3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJ3cGJjX2FsbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICogSmF2YVNjcmlwdCBVdGlsIEZ1bmN0aW9uc1x0XHQuLi9pbmNsdWRlcy9fX2pzL3V0aWxzL3dwYmNfdXRpbHMuanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFRyaW0gIHN0cmluZ3MgYW5kIGFycmF5IGpvaW5lZCB3aXRoICAoLClcclxuICpcclxuICogQHBhcmFtIHN0cmluZ190b190cmltICAgc3RyaW5nIC8gYXJyYXlcclxuICogQHJldHVybnMgc3RyaW5nXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX3RyaW0oc3RyaW5nX3RvX3RyaW0pIHtcclxuXHJcblx0aWYgKCBBcnJheS5pc0FycmF5KCBzdHJpbmdfdG9fdHJpbSApICkge1xyXG5cdFx0c3RyaW5nX3RvX3RyaW0gPSBzdHJpbmdfdG9fdHJpbS5qb2luKCAnLCcgKTtcclxuXHR9XHJcblxyXG5cdGlmICggJ3N0cmluZycgPT0gdHlwZW9mIChzdHJpbmdfdG9fdHJpbSkgKSB7XHJcblx0XHRzdHJpbmdfdG9fdHJpbSA9IHN0cmluZ190b190cmltLnRyaW0oKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBzdHJpbmdfdG9fdHJpbTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIGVsZW1lbnQgaW4gYXJyYXlcclxuICpcclxuICogQHBhcmFtIGFycmF5X2hlcmVcdFx0YXJyYXlcclxuICogQHBhcmFtIHBfdmFsXHRcdFx0XHRlbGVtZW50IHRvICBjaGVja1xyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfaW5fYXJyYXkoYXJyYXlfaGVyZSwgcF92YWwpIHtcclxuXHRmb3IgKCB2YXIgaSA9IDAsIGwgPSBhcnJheV9oZXJlLmxlbmd0aDsgaSA8IGw7IGkrKyApIHtcclxuXHRcdGlmICggYXJyYXlfaGVyZVtpXSA9PSBwX3ZhbCApIHtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0fVxyXG5cdHJldHVybiBmYWxzZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFByZXZlbnQgb3BlbmluZyBibGFuayB3aW5kb3dzIG9uIFdvcmRQcmVzcyBwbGF5Z3JvdW5kIGZvciBwc2V1ZG8gbGlua3MgbGlrZSB0aGlzOiA8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCI+IG9yICMgdG8gc3RheSBpbiB0aGUgc2FtZSB0YWIuXHJcbiAqL1xyXG4oZnVuY3Rpb24gKCkge1xyXG5cdCd1c2Ugc3RyaWN0JztcclxuXHJcblx0ZnVuY3Rpb24gaXNfcGxheWdyb3VuZF9vcmlnaW4oKSB7XHJcblx0XHRyZXR1cm4gbG9jYXRpb24ub3JpZ2luID09PSAnaHR0cHM6Ly9wbGF5Z3JvdW5kLndvcmRwcmVzcy5uZXQnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaXNfcHNldWRvX2xpbmsoYSkge1xyXG5cdFx0aWYgKCAhYSB8fCAhYS5nZXRBdHRyaWJ1dGUgKSByZXR1cm4gdHJ1ZTtcclxuXHRcdHZhciBocmVmID0gKGEuZ2V0QXR0cmlidXRlKCAnaHJlZicgKSB8fCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XHJcblx0XHRyZXR1cm4gKFxyXG5cdFx0XHQhaHJlZiB8fFxyXG5cdFx0XHRocmVmID09PSAnIycgfHxcclxuXHRcdFx0aHJlZi5pbmRleE9mKCAnIycgKSA9PT0gMCB8fFxyXG5cdFx0XHRocmVmLmluZGV4T2YoICdqYXZhc2NyaXB0OicgKSA9PT0gMCB8fFxyXG5cdFx0XHRocmVmLmluZGV4T2YoICdtYWlsdG86JyApID09PSAwIHx8XHJcblx0XHRcdGhyZWYuaW5kZXhPZiggJ3RlbDonICkgPT09IDBcclxuXHRcdCk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBmaXhfdGFyZ2V0KGEpIHtcclxuXHRcdGlmICggISBhICkgcmV0dXJuO1xyXG5cdFx0aWYgKCBpc19wc2V1ZG9fbGluayggYSApIHx8IGEuaGFzQXR0cmlidXRlKCAnZGF0YS13cC1uby1ibGFuaycgKSApIHtcclxuXHRcdFx0YS50YXJnZXQgPSAnX3NlbGYnO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaW5pdF9maXgoKSB7XHJcblx0XHQvLyBPcHRpb25hbDogY2xlYW4gdXAgY3VycmVudCBET00gKGhhcm1sZXNz4oCUYWZmZWN0cyBvbmx5IHBzZXVkby9kYXRhbWFya2VkIGxpbmtzKS5cclxuXHRcdHZhciBub2RlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoICdhW2hyZWZdJyApO1xyXG5cdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKysgKSBmaXhfdGFyZ2V0KCBub2Rlc1tpXSApO1xyXG5cclxuXHRcdC8vIExhdGUgYnViYmxlLXBoYXNlIGxpc3RlbmVycyAocnVuIGFmdGVyIFBsYXlncm91bmQncyBoYW5kbGVycylcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBhID0gZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCA/IGUudGFyZ2V0LmNsb3Nlc3QoICdhW2hyZWZdJyApIDogbnVsbDtcclxuXHRcdFx0aWYgKCBhICkgZml4X3RhcmdldCggYSApO1xyXG5cdFx0fSwgZmFsc2UgKTtcclxuXHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCAnZm9jdXNpbicsIGZ1bmN0aW9uIChlKSB7XHJcblx0XHRcdHZhciBhID0gZS50YXJnZXQgJiYgZS50YXJnZXQuY2xvc2VzdCA/IGUudGFyZ2V0LmNsb3Nlc3QoICdhW2hyZWZdJyApIDogbnVsbDtcclxuXHRcdFx0aWYgKCBhICkgZml4X3RhcmdldCggYSApO1xyXG5cdFx0fSApO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gc2NoZWR1bGVfaW5pdCgpIHtcclxuXHRcdGlmICggIWlzX3BsYXlncm91bmRfb3JpZ2luKCkgKSByZXR1cm47XHJcblx0XHRzZXRUaW1lb3V0KCBpbml0X2ZpeCwgMTAwMCApOyAvLyBlbnN1cmUgd2UgYXR0YWNoIGFmdGVyIFBsYXlncm91bmQncyBzY3JpcHQuXHJcblx0fVxyXG5cclxuXHRpZiAoIGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdET01Db250ZW50TG9hZGVkJywgc2NoZWR1bGVfaW5pdCApO1xyXG5cdH0gZWxzZSB7XHJcblx0XHRzY2hlZHVsZV9pbml0KCk7XHJcblx0fVxyXG59KSgpOyIsIlwidXNlIHN0cmljdFwiO1xyXG4vKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL3dwYmMvd3BiYy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogRGVlcCBDbG9uZSBvZiBvYmplY3Qgb3IgYXJyYXlcclxuICpcclxuICogQHBhcmFtIG9ialxyXG4gKiBAcmV0dXJucyB7YW55fVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jbG9uZV9vYmooIG9iaiApe1xyXG5cclxuXHRyZXR1cm4gSlNPTi5wYXJzZSggSlNPTi5zdHJpbmdpZnkoIG9iaiApICk7XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIE1haW4gX3dwYmMgSlMgb2JqZWN0XHJcbiAqL1xyXG5cclxudmFyIF93cGJjID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cdG9iai5zZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfc2VjdXJlWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfc2VjdXJlWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gQ2FsZW5kYXJzIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2NhbGVuZGFycyA9IG9iai5jYWxlbmRhcnNfb2JqID0gb2JqLmNhbGVuZGFyc19vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0ICAgICAgICAgICAgOiBcImJvb2tpbmdfaWRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc29ydF90eXBlICAgICAgIDogXCJERVNDXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHBhZ2VfbnVtICAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHBhZ2VfaXRlbXNfY291bnQ6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBjcmVhdGVfZGF0ZSAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBrZXl3b3JkICAgICAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3VyY2UgICAgICAgICAgOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGNhbGVuZGFyIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdICkgKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ3JlYXRlIENhbGVuZGFyIGluaXRpYWxpemluZ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9faW5pdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2lkJyBdID0gcmVzb3VyY2VfaWQ7XHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAncGVuZGluZ19kYXlzX3NlbGVjdGFibGUnIF0gPSBmYWxzZTtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgIGlmIHRoZSB0eXBlIG9mIHRoaXMgcHJvcGVydHkgIGlzIElOVFxyXG5cdCAqIEBwYXJhbSBwcm9wZXJ0eV9uYW1lXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pc19wcm9wX2ludCA9IGZ1bmN0aW9uICggcHJvcGVydHlfbmFtZSApIHtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4yOS5cclxuXHJcblx0XHR2YXIgcF9jYWxlbmRhcl9pbnRfcHJvcGVydGllcyA9IFsnZHluYW1pY19fZGF5c19taW4nLCAnZHluYW1pY19fZGF5c19tYXgnLCAnZml4ZWRfX2RheXNfbnVtJ107XHJcblxyXG5cdFx0dmFyIGlzX2luY2x1ZGUgPSBwX2NhbGVuZGFyX2ludF9wcm9wZXJ0aWVzLmluY2x1ZGVzKCBwcm9wZXJ0eV9uYW1lICk7XHJcblxyXG5cdFx0cmV0dXJuIGlzX2luY2x1ZGU7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBwYXJhbXMgZm9yIGFsbCAgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJzX29ialx0XHRPYmplY3QgeyBjYWxlbmRhcl8xOiB7fSB9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGNhbGVuZGFyXzM6IHt9LCAuLi4gfVxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcnNfYWxsX19zZXQgPSBmdW5jdGlvbiAoIGNhbGVuZGFyc19vYmogKSB7XHJcblx0XHRwX2NhbGVuZGFycyA9IGNhbGVuZGFyc19vYmo7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGluIGFsbCBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyc19hbGxfX2dldCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2NhbGVuZGFycztcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgY2FsZW5kYXIgb2JqZWN0ICAgOjogICB7IGlkOiAxLCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRcdHsgaWQ6IDIgLOKApiB9XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19nZXRfcGFyYW1ldGVycyA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0aWYgKCBvYmouY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdHJldHVybiBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kIElEIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuICBzeXN0ZW0gc2V0ICBhcyBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgcHJvcGVydGllcyBmcm9tIGNhbGVuZGFyX3Byb3BlcnR5X29iaiBwYXJhbWV0ZXIsICBidXQgb3RoZXIgcHJvcGVydGllcyB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUsIGxpa2UgJ2lkJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJfcHJvcGVydHlfb2JqXHRcdFx0XHRcdCAgeyAgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfSAgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgJ3RydWUnIChkZWZhdWx0OiAnZmFsc2UnKSwgIHRoZW4gIG9ubHkgb3ZlcndyaXRlIG9yIGFkZCAgbmV3IHByb3BlcnRpZXMgaW4gIGNhbGVuZGFyX3Byb3BlcnR5X29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuY2FsZW5kYXJfX3NldCggIFwiIC5pbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsIHsgJ2RhdGVzJzogXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiIH0gKTtcIjtcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgY2FsZW5kYXJfcHJvcGVydHlfb2JqLCBpc19jb21wbGV0ZV9vdmVyd3JpdGUgPSBmYWxzZSAgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgfHwgKHRydWUgPT09IGlzX2NvbXBsZXRlX292ZXJ3cml0ZSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gY2FsZW5kYXJfcHJvcGVydHlfb2JqICl7XHJcblxyXG5cdFx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IGNhbGVuZGFyX3Byb3BlcnR5X29ialsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHByb3BlcnR5ICB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFwiMVwiXHJcblx0ICogQHBhcmFtIHByb3BfbmFtZVx0XHRuYW1lIG9mIHByb3BlcnR5XHJcblx0ICogQHBhcmFtIHByb3BfdmFsdWVcdHZhbHVlIG9mIHByb3BlcnR5XHJcblx0ICogQHJldHVybnMgeyp9XHRcdFx0Y2FsZW5kYXIgb2JqZWN0XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBwcm9wX25hbWUsIHByb3BfdmFsdWUgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gcHJvcF92YWx1ZTtcclxuXHJcblx0XHRyZXR1cm4gcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGNhbGVuZGFyIHByb3BlcnR5IHZhbHVlICAgXHQ6OiAgIG1peGVkIHwgbnVsbFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSAgcmVzb3VyY2VfaWRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHByb3BfbmFtZVx0XHRcdCdzZWxlY3Rpb25fbW9kZSdcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVx0XHRcdFx0XHRtaXhlZCB8IG51bGxcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0Ly8gRml4SW46IDkuOS4wLjI5LlxyXG5cdFx0XHRpZiAoIG9iai5jYWxlbmRhcl9faXNfcHJvcF9pbnQoIHByb3BfbmFtZSApICl7XHJcblx0XHRcdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwYXJzZUludCggcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIG51bGw7XHJcblx0fTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0Ly8gQm9va2luZ3MgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfYm9va2luZ3MgPSBvYmouYm9va2luZ3Nfb2JqID0gb2JqLmJvb2tpbmdzX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY2FsZW5kYXJfMTogT2JqZWN0IHtcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgICBpZDogICAgIDFcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKAplxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGJvb2tpbmdzIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5ncyBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgaWQ6IDEgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFx0eyBpZDogMiAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblxyXG5cdFx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBib29raW5ncyBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kIElEIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuICBzeXN0ZW0gc2V0ICBhcyBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgcHJvcGVydGllcyBmcm9tIGNhbGVuZGFyX29iaiBwYXJhbWV0ZXIsICBidXQgb3RoZXIgcHJvcGVydGllcyB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUsIGxpa2UgJ2lkJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJfb2JqXHRcdFx0XHRcdCAgeyAgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfSAgfVxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCggIFwiIC5pbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsIHsgJ2RhdGVzJzogXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiIH0gKTtcIjtcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgY2FsZW5kYXJfb2JqICl7XHJcblxyXG5cdFx0aWYgKCAhIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSB7fTtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKCB2YXIgcHJvcF9uYW1lIGluIGNhbGVuZGFyX29iaiApe1xyXG5cclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IGNhbGVuZGFyX29ialsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvLyBEYXRlc1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIEFMTCBEYXRlcyBpbiBjYWxlbmRhciAgIDo6ICAgZmFsc2UgfCB7IFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdGZhbHNlIHwgT2JqZWN0IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjRcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwiYXZhaWxhYmxlXCIsIGRheV9hdmFpbGFiaWxpdHk6IDEsIG1heF9jYXBhY2l0eTogMSwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjZcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwiZnVsbF9kYXlfYm9va2luZ1wiLCBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncyddOiBcInBlbmRpbmdcIiwgZGF5X2F2YWlsYWJpbGl0eTogMCwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjlcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwicmVzb3VyY2VfYXZhaWxhYmlsaXR5XCIsIGRheV9hdmFpbGFiaWxpdHk6IDAsIG1heF9jYXBhY2l0eTogMSwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMzBcIjoge+KApn0sIFwiMjAyMy0wNy0zMVwiOiB74oCmfSwg4oCmXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9kYXRlcyA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gZmFsc2U7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGRhdGVzIGluIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIGlmIGNhbGVuZGFyIG9iamVjdCAgbm90IGRlZmluZWQsIHRoZW4gIGl0J3Mgd2lsbCBiZSBkZWZpbmVkIGFuZCAnaWQnLCAnZGF0ZXMnIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuIHN5c3RlbSBhZGQgYSAgbmV3IG9yIG92ZXJ3cml0ZSBvbmx5IGRhdGVzIGZyb20gZGF0ZXNfb2JqIHBhcmFtZXRlcixcclxuXHQgKiBidXQgb3RoZXIgZGF0ZXMgbm90IGZyb20gcGFyYW1ldGVyIGRhdGVzX29iaiB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBkYXRlc19vYmpcdFx0XHRcdFx0ICB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19jb21wbGV0ZV9vdmVyd3JpdGVcdFx0ICBpZiBmYWxzZSwgIHRoZW4gIG9ubHkgb3ZlcndyaXRlIG9yIGFkZCAgZGF0ZXMgZnJvbSBcdGRhdGVzX29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICogICBcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwg4oCmIH0gICk7XHRcdDwtICAgb3ZlcndyaXRlIEFMTCBkYXRlc1xyXG5cdCAqICAgXHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggcmVzb3VyY2VfaWQsIHsgXCIyMDIzLTA3LTIyXCI6IHvigKZ9IH0sICBmYWxzZSAgKTtcdFx0XHRcdFx0PC0gICBhZGQgb3Igb3ZlcndyaXRlIG9ubHkgIFx0XCIyMDIzLTA3LTIyXCI6IHt9XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIFwiIC4gaW50dmFsKCAkcmVzb3VyY2VfaWQgKSAuIFwiLCAgXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiICApOyAgXCI7XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGRhdGVzX29iaiAsIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IHRydWUgKXtcclxuXHJcblx0XHRpZiAoICFvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHRcdFx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXQoIHJlc291cmNlX2lkLCB7ICdkYXRlcyc6IHt9IH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdKSApe1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXSA9IHt9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGlzX2NvbXBsZXRlX292ZXJ3cml0ZSl7XHJcblxyXG5cdFx0XHQvLyBDb21wbGV0ZSBvdmVyd3JpdGUgYWxsICBib29raW5nIGRhdGVzXHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdID0gZGF0ZXNfb2JqO1xyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdC8vIEFkZCBvbmx5ICBuZXcgb3Igb3ZlcndyaXRlIGV4aXN0IGJvb2tpbmcgZGF0ZXMgZnJvbSAgcGFyYW1ldGVyLiBCb29raW5nIGRhdGVzIG5vdCBmcm9tICBwYXJhbWV0ZXIgIHdpbGwgIGJlIHdpdGhvdXQgY2huYW5nZXNcclxuXHRcdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBkYXRlc19vYmogKXtcclxuXHJcblx0XHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWydkYXRlcyddWyBwcm9wX25hbWUgXSA9IGRhdGVzX29ialsgcHJvcF9uYW1lIF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIHNwZWNpZmljIGRhdGUgaW4gY2FsZW5kYXIgICA6OiAgIGZhbHNlIHwgeyBkYXlfYXZhaWxhYmlsaXR5OiAxLCAuLi4gfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzcWxfY2xhc3NfZGF5XHRcdFx0JzIwMjMtMDctMjEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0ZmFsc2UgfCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRheV9hdmFpbGFiaWxpdHk6IDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWF4X2NhcGFjaXR5OiA0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gID49IEJ1c2luZXNzIExhcmdlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDI6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MTA6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cdFx0Ly8gID49IEJ1c2luZXNzIExhcmdlIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMTogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMjogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXVsgc3FsX2NsYXNzX2RheSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBmYWxzZTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gQW55ICBQQVJBTVMgICBpbiBib29raW5nc1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgcHJvcGVydHkgIHRvICBib29raW5nXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHRcIjFcIlxyXG5cdCAqIEBwYXJhbSBwcm9wX25hbWVcdFx0bmFtZSBvZiBwcm9wZXJ0eVxyXG5cdCAqIEBwYXJhbSBwcm9wX3ZhbHVlXHR2YWx1ZSBvZiBwcm9wZXJ0eVxyXG5cdCAqIEByZXR1cm5zIHsqfVx0XHRcdGJvb2tpbmcgb2JqZWN0XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSwgcHJvcF92YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoICEgb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdpZCcgXSA9IHJlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwcm9wX3ZhbHVlO1xyXG5cclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBib29raW5nIHByb3BlcnR5IHZhbHVlICAgXHQ6OiAgIG1peGVkIHwgbnVsbFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSAgcmVzb3VyY2VfaWRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHByb3BfbmFtZVx0XHRcdCdzZWxlY3Rpb25fbW9kZSdcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVx0XHRcdFx0XHRtaXhlZCB8IG51bGxcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBwcm9wX25hbWUgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiAgcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBudWxsO1xyXG5cdH07XHJcblxyXG5cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBib29raW5ncyBmb3IgYWxsICBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcnNfb2JqXHRcdE9iamVjdCB7IGNhbGVuZGFyXzE6IHsgaWQ6IDEsIGRhdGVzOiBPYmplY3QgeyBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwgXCIyMDIzLTA3LTI0XCI6IHvigKZ9LCDigKYgfSB9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGNhbGVuZGFyXzM6IHt9LCAuLi4gfVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcnNfX3NldF9hbGwgPSBmdW5jdGlvbiAoIGNhbGVuZGFyc19vYmogKSB7XHJcblx0XHRwX2Jvb2tpbmdzID0gY2FsZW5kYXJzX29iajtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYm9va2luZ3MgaW4gYWxsIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJzX19nZXRfYWxsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3M7XHJcblx0fTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblxyXG5cclxuXHQvLyBTZWFzb25zIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlYXNvbnMgPSBvYmouc2Vhc29uc19vYmogPSBvYmouc2Vhc29uc19vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNhbGVuZGFyXzE6IE9iamVjdCB7XHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICAgaWQ6ICAgICAxXHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBzZWFzb24gbmFtZXMgZm9yIGRhdGVzIGluIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgIHsgXCIyMDIzLTA3LTIxXCI6IFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdLCBcIjIwMjMtMDctMjJcIjogWy4uLl0sIC4uLiB9XHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGRhdGVzX29ialx0XHRcdFx0XHQgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2NvbXBsZXRlX292ZXJ3cml0ZVx0XHQgIGlmIGZhbHNlLCAgdGhlbiAgb25seSAgYWRkICBkYXRlcyBmcm9tIFx0ZGF0ZXNfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKiAgIFx0XHRcdF93cGJjLnNlYXNvbnNfX3NldCggcmVzb3VyY2VfaWQsIHsgXCIyMDIzLTA3LTIxXCI6IFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdLCBcIjIwMjMtMDctMjJcIjogWy4uLl0sIC4uLiB9ICApO1xyXG5cdCAqL1xyXG5cdG9iai5zZWFzb25zX19zZXQgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGRhdGVzX29iaiAsIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IGZhbHNlICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSkgKXtcclxuXHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSApe1xyXG5cclxuXHRcdFx0Ly8gQ29tcGxldGUgb3ZlcndyaXRlIGFsbCAgc2Vhc29uIGRhdGVzXHJcblx0XHRcdHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0gZGF0ZXNfb2JqO1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHQvLyBBZGQgb25seSAgbmV3IG9yIG92ZXJ3cml0ZSBleGlzdCBib29raW5nIGRhdGVzIGZyb20gIHBhcmFtZXRlci4gQm9va2luZyBkYXRlcyBub3QgZnJvbSAgcGFyYW1ldGVyICB3aWxsICBiZSB3aXRob3V0IGNobmFuZ2VzXHJcblx0XHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gZGF0ZXNfb2JqICl7XHJcblxyXG5cdFx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdKSApe1xyXG5cdFx0XHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gW107XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGZvciAoIHZhciBzZWFzb25fbmFtZV9rZXkgaW4gZGF0ZXNfb2JqWyBwcm9wX25hbWUgXSApe1xyXG5cdFx0XHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdLnB1c2goIGRhdGVzX29ialsgcHJvcF9uYW1lIF1bIHNlYXNvbl9uYW1lX2tleSBdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIHNwZWNpZmljIGRhdGUgaW4gY2FsZW5kYXIgICA6OiAgIFtdIHwgWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheVx0XHRcdCcyMDIzLTA3LTIxJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFtdICB8ICBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXVxyXG5cdCAqL1xyXG5cdG9iai5zZWFzb25zX19nZXRfZm9yX2RhdGUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgc3FsX2NsYXNzX2RheSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBbXTtcdFx0Ly8gSWYgbm90IGRlZmluZWQsIHRoZW4gW107XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIE90aGVyIHBhcmFtZXRlcnMgXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfb3RoZXIgPSBvYmoub3RoZXJfb2JqID0gb2JqLm90aGVyX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9vdGhlclsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXJbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgb3RoZXIgcGFyYW1zXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5nZXRfb3RoZXJfcGFyYW1fX2FsbCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX290aGVyO1xyXG5cdH07XHJcblxyXG5cdC8vIE1lc3NhZ2VzIFx0XHRcdCAgICAgICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfbWVzc2FnZXMgPSBvYmoubWVzc2FnZXNfb2JqID0gb2JqLm1lc3NhZ2VzX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfbWVzc2FnZSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX21lc3NhZ2VzWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X21lc3NhZ2UgPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX21lc3NhZ2VzWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYWxsIG90aGVyIHBhcmFtc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouZ2V0X21lc3NhZ2VzX19hbGwgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9tZXNzYWdlcztcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cclxufSggX3dwYmMgfHwge30sIGpRdWVyeSApKTtcclxuIiwid2luZG93Ll9fV1BCQ19ERVYgPSB0cnVlO1xyXG5cclxuLyoqXHJcbiAqIEV4dGVuZCBfd3BiYyB3aXRoICBuZXcgbWV0aG9kc1xyXG4gKlxyXG4gKiBAdHlwZSB7Knx7fX1cclxuICogQHByaXZhdGVcclxuICovXHJcbl93cGJjID0gKGZ1bmN0aW9uIChvYmosICQpIHtcclxuXHJcblx0LyoqXHJcblx0ICogRGV2IGxvZ2dlciAobm8tb3AgdW5sZXNzIHdpbmRvdy5fX1dQQkNfREVWID0gdHJ1ZSlcclxuXHQgKlxyXG5cdCAqIEB0eXBlIHsqfHt3YXJuOiAoZnVuY3Rpb24oKiwgKiwgKik6IHZvaWQpLCBlcnJvcjogKGZ1bmN0aW9uKCosICosICopOiB2b2lkKSwgb25jZTogb2JqLmRldi5vbmNlLCB0cnk6ICgoZnVuY3Rpb24oKiwgKiwgKik6ICgqfHVuZGVmaW5lZCkpfCopfX1cclxuXHQgKi9cclxuXHRvYmouZGV2ID0gb2JqLmRldiB8fCAoKCkgPT4ge1xyXG5cdFx0Y29uc3Qgc2VlbiAgICA9IG5ldyBTZXQoKTtcclxuXHRcdGNvbnN0IGVuYWJsZWQgPSAoKSA9PiAhIXdpbmRvdy5fX1dQQkNfREVWO1xyXG5cclxuXHRcdGZ1bmN0aW9uIG91dChsZXZlbCwgY29kZSwgbXNnLCBleHRyYSkge1xyXG5cdFx0XHRpZiAoICFlbmFibGVkKCkgKSByZXR1cm47XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0KGNvbnNvbGVbbGV2ZWxdIHx8IGNvbnNvbGUud2FybikoIGBbV1BCQ11bJHtjb2RlfV0gJHttc2d9YCwgZXh0cmEgPz8gJycgKTtcclxuXHRcdFx0fSBjYXRjaCB7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ge1xyXG5cdFx0XHRsb2cgIDogKGNvZGUsIG1zZywgZXh0cmEpID0+IG91dCgnbG9nJywgICBjb2RlLCBtc2csIGV4dHJhKSxcclxuXHRcdFx0ZGVidWc6IChjb2RlLCBtc2csIGV4dHJhKSA9PiBvdXQoJ2RlYnVnJywgY29kZSwgbXNnLCBleHRyYSksXHJcblx0XHRcdHdhcm4gOiAoY29kZSwgbXNnLCBleHRyYSkgPT4gb3V0KCAnd2FybicsIGNvZGUsIG1zZywgZXh0cmEgKSxcclxuXHRcdFx0ZXJyb3I6IChjb2RlLCBlcnJPck1zZywgZXh0cmEpID0+XHJcblx0XHRcdFx0b3V0KCAnZXJyb3InLCBjb2RlLFxyXG5cdFx0XHRcdFx0ZXJyT3JNc2cgaW5zdGFuY2VvZiBFcnJvciA/IGVyck9yTXNnLm1lc3NhZ2UgOiBTdHJpbmcoIGVyck9yTXNnICksXHJcblx0XHRcdFx0XHRlcnJPck1zZyBpbnN0YW5jZW9mIEVycm9yID8gZXJyT3JNc2cgOiBleHRyYSApLFxyXG5cdFx0XHRvbmNlIDogKGNvZGUsIG1zZywgZXh0cmEpID0+IHtcclxuXHRcdFx0XHRpZiAoICFlbmFibGVkKCkgKSByZXR1cm47XHJcblx0XHRcdFx0Y29uc3Qga2V5ID0gYCR7Y29kZX18JHttc2d9YDtcclxuXHRcdFx0XHRpZiAoIHNlZW4uaGFzKCBrZXkgKSApIHJldHVybjtcclxuXHRcdFx0XHRzZWVuLmFkZCgga2V5ICk7XHJcblx0XHRcdFx0b3V0KCAnZXJyb3InLCBjb2RlLCBtc2csIGV4dHJhICk7XHJcblx0XHRcdH0sXHJcblx0XHRcdHRyeSAgOiAoY29kZSwgZm4sIGV4dHJhKSA9PiB7XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdHJldHVybiBmbigpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdFx0b3V0KCAnZXJyb3InLCBjb2RlLCBlLCBleHRyYSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fTtcclxuXHR9KSgpO1xyXG5cclxuXHQvLyBPcHRpb25hbDogZ2xvYmFsIHRyYXBzIGluIGRldi5cclxuXHRpZiAoIHdpbmRvdy5fX1dQQkNfREVWICkge1xyXG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoICdlcnJvcicsIChlKSA9PiB7XHJcblx0XHRcdHRyeSB7IF93cGJjPy5kZXY/LmVycm9yKCAnR0xPQkFMLUVSUk9SJywgZT8uZXJyb3IgfHwgZT8ubWVzc2FnZSwgZSApOyB9IGNhdGNoICggXyApIHt9XHJcblx0XHR9ICk7XHJcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciggJ3VuaGFuZGxlZHJlamVjdGlvbicsIChlKSA9PiB7XHJcblx0XHRcdHRyeSB7IF93cGJjPy5kZXY/LmVycm9yKCAnR0xPQkFMLVJFSkVDVElPTicsIGU/LnJlYXNvbiApOyB9IGNhdGNoICggXyApIHt9XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cdH0oIF93cGJjIHx8IHt9LCBqUXVlcnkgKSk7XHJcbiIsIi8qKlxyXG4gKiBFeHRlbmQgX3dwYmMgd2l0aCAgbmV3IG1ldGhvZHMgICAgICAgIC8vIEZpeEluOiA5LjguNi4yLlxyXG4gKlxyXG4gKiBAdHlwZSB7Knx7fX1cclxuICogQHByaXZhdGVcclxuICovXHJcbiBfd3BiYyA9IChmdW5jdGlvbiAoIG9iaiwgJCkge1xyXG5cclxuXHQvLyBMb2FkIEJhbGFuY2VyIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0dmFyIHBfYmFsYW5jZXIgPSBvYmouYmFsYW5jZXJfb2JqID0gb2JqLmJhbGFuY2VyX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J21heF90aHJlYWRzJzogMixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaW5fcHJvY2VzcycgOiBbXSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2FpdCcgICAgICAgOiBbXVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQgLyoqXHJcblx0ICAqIFNldCAgbWF4IHBhcmFsbGVsIHJlcXVlc3QgIHRvICBsb2FkXHJcblx0ICAqXHJcblx0ICAqIEBwYXJhbSBtYXhfdGhyZWFkc1xyXG5cdCAgKi9cclxuXHRvYmouYmFsYW5jZXJfX3NldF9tYXhfdGhyZWFkcyA9IGZ1bmN0aW9uICggbWF4X3RocmVhZHMgKXtcclxuXHJcblx0XHRwX2JhbGFuY2VyWyAnbWF4X3RocmVhZHMnIF0gPSBtYXhfdGhyZWFkcztcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgYmFsYW5jZXIgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmJhbGFuY2VyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfYmFsYW5jZXJbICdiYWxhbmNlcl8nICsgcmVzb3VyY2VfaWQgXSApICk7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBDcmVhdGUgYmFsYW5jZXIgaW5pdGlhbGl6aW5nXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0b2JqLmJhbGFuY2VyX19pbml0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSAsIHBhcmFtcyA9e30pIHtcclxuXHJcblx0XHR2YXIgYmFsYW5jZV9vYmogPSB7fTtcclxuXHRcdGJhbGFuY2Vfb2JqWyAncmVzb3VyY2VfaWQnIF0gICA9IHJlc291cmNlX2lkO1xyXG5cdFx0YmFsYW5jZV9vYmpbICdwcmlvcml0eScgXSAgICAgID0gMTtcclxuXHRcdGJhbGFuY2Vfb2JqWyAnZnVuY3Rpb25fbmFtZScgXSA9IGZ1bmN0aW9uX25hbWU7XHJcblx0XHRiYWxhbmNlX29ialsgJ3BhcmFtcycgXSAgICAgICAgPSB3cGJjX2Nsb25lX29iaiggcGFyYW1zICk7XHJcblxyXG5cclxuXHRcdGlmICggb2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3J1biggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKSApe1xyXG5cdFx0XHRyZXR1cm4gJ3J1bic7XHJcblx0XHR9XHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV93YWl0KCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApICl7XHJcblx0XHRcdHJldHVybiAnd2FpdCc7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdGlmICggb2JqLmJhbGFuY2VyX19jYW5faV9ydW4oKSApe1xyXG5cdFx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fcnVuKCBiYWxhbmNlX29iaiApO1xyXG5cdFx0XHRyZXR1cm4gJ3J1bic7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fd2FpdCggYmFsYW5jZV9vYmogKTtcclxuXHRcdFx0cmV0dXJuICd3YWl0JztcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQgLyoqXHJcblx0ICAqIENhbiBJIFJ1biA/XHJcblx0ICAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAgKi9cclxuXHRvYmouYmFsYW5jZXJfX2Nhbl9pX3J1biA9IGZ1bmN0aW9uICgpe1xyXG5cdFx0cmV0dXJuICggcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0ubGVuZ3RoIDwgcF9iYWxhbmNlclsgJ21heF90aHJlYWRzJyBdICk7XHJcblx0fVxyXG5cclxuXHRcdCAvKipcclxuXHRcdCAgKiBBZGQgdG8gV0FJVFxyXG5cdFx0ICAqIEBwYXJhbSBiYWxhbmNlX29ialxyXG5cdFx0ICAqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3dhaXQgPSBmdW5jdGlvbiAoIGJhbGFuY2Vfb2JqICkge1xyXG5cdFx0XHRwX2JhbGFuY2VyWyd3YWl0J10ucHVzaCggYmFsYW5jZV9vYmogKTtcclxuXHRcdH1cclxuXHJcblx0XHQgLyoqXHJcblx0XHQgICogUmVtb3ZlIGZyb20gV2FpdFxyXG5cdFx0ICAqXHJcblx0XHQgICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgICogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCAgKiBAcmV0dXJucyB7Knxib29sZWFufVxyXG5cdFx0ICAqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fd2FpdF9saXN0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0dmFyIHJlbW92ZWRfZWwgPSBmYWxzZTtcclxuXHJcblx0XHRcdGlmICggcF9iYWxhbmNlclsgJ3dhaXQnIF0ubGVuZ3RoICl7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnd2FpdCcgXSApe1xyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0JiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0cmVtb3ZlZF9lbCA9IHBfYmFsYW5jZXJbICd3YWl0JyBdLnNwbGljZSggaSwgMSApO1xyXG5cdFx0XHRcdFx0XHRyZW1vdmVkX2VsID0gcmVtb3ZlZF9lbC5wb3AoKTtcclxuXHRcdFx0XHRcdFx0cF9iYWxhbmNlclsgJ3dhaXQnIF0gPSBwX2JhbGFuY2VyWyAnd2FpdCcgXS5maWx0ZXIoIGZ1bmN0aW9uICggdiApe1xyXG5cdFx0XHRcdFx0XHRcdHJldHVybiB2O1xyXG5cdFx0XHRcdFx0XHR9ICk7XHRcdFx0XHRcdC8vIFJlaW5kZXggYXJyYXlcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0KiBJcyBhbHJlYWR5IFdBSVRcclxuXHRcdCpcclxuXHRcdCogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0Ki9cclxuXHRcdG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV93YWl0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0aWYgKCBwX2JhbGFuY2VyWyAnd2FpdCcgXS5sZW5ndGggKXtcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnd2FpdCcgXSApe1xyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0JiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIEFkZCB0byBSVU5cclxuXHRcdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX19ydW4gPSBmdW5jdGlvbiAoIGJhbGFuY2Vfb2JqICkge1xyXG5cdFx0XHRwX2JhbGFuY2VyWydpbl9wcm9jZXNzJ10ucHVzaCggYmFsYW5jZV9vYmogKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCogUmVtb3ZlIGZyb20gUlVOIGxpc3RcclxuXHRcdCpcclxuXHRcdCogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQqIEByZXR1cm5zIHsqfGJvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fcnVuX2xpc3QgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHQgdmFyIHJlbW92ZWRfZWwgPSBmYWxzZTtcclxuXHJcblx0XHRcdCBpZiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCApe1x0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdCBmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXSApe1xyXG5cdFx0XHRcdFx0IGlmIChcclxuXHRcdFx0XHRcdFx0IChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQgJiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0ICl7XHJcblx0XHRcdFx0XHRcdCByZW1vdmVkX2VsID0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0uc3BsaWNlKCBpLCAxICk7XHJcblx0XHRcdFx0XHRcdCByZW1vdmVkX2VsID0gcmVtb3ZlZF9lbC5wb3AoKTtcclxuXHRcdFx0XHRcdFx0IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdID0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0uZmlsdGVyKCBmdW5jdGlvbiAoIHYgKXtcclxuXHRcdFx0XHRcdFx0XHQgcmV0dXJuIHY7XHJcblx0XHRcdFx0XHRcdCB9ICk7XHRcdC8vIFJlaW5kZXggYXJyYXlcclxuXHRcdFx0XHRcdFx0IHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0XHRcdFx0IH1cclxuXHRcdFx0XHQgfVxyXG5cdFx0XHQgfVxyXG5cdFx0XHQgcmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQqIElzIGFscmVhZHkgUlVOXHJcblx0XHQqXHJcblx0XHQqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0KiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCovXHJcblx0XHRvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfcnVuID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0aWYgKCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5sZW5ndGggKXtcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdICl7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHJcblxyXG5cdG9iai5iYWxhbmNlcl9fcnVuX25leHQgPSBmdW5jdGlvbiAoKXtcclxuXHJcblx0XHQvLyBHZXQgMXN0IGZyb20gIFdhaXQgbGlzdFxyXG5cdFx0dmFyIHJlbW92ZWRfZWwgPSBmYWxzZTtcclxuXHRcdGlmICggcF9iYWxhbmNlclsgJ3dhaXQnIF0ubGVuZ3RoICl7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ3dhaXQnIF0gKXtcclxuXHRcdFx0XHRyZW1vdmVkX2VsID0gb2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fd2FpdF9saXN0KCBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0sIHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdICk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGZhbHNlICE9PSByZW1vdmVkX2VsICl7XHJcblxyXG5cdFx0XHQvLyBSdW5cclxuXHRcdFx0b2JqLmJhbGFuY2VyX19ydW4oIHJlbW92ZWRfZWwgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdCAvKipcclxuXHQgICogUnVuXHJcblx0ICAqIEBwYXJhbSBiYWxhbmNlX29ialxyXG5cdCAgKi9cclxuXHRvYmouYmFsYW5jZXJfX3J1biA9IGZ1bmN0aW9uICggYmFsYW5jZV9vYmogKXtcclxuXHJcblx0XHRzd2l0Y2ggKCBiYWxhbmNlX29ialsgJ2Z1bmN0aW9uX25hbWUnIF0gKXtcclxuXHJcblx0XHRcdGNhc2UgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JzpcclxuXHJcblx0XHRcdFx0Ly8gQWRkIHRvIHJ1biBsaXN0XHJcblx0XHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biggYmFsYW5jZV9vYmogKTtcclxuXHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIGJhbGFuY2Vfb2JqWyAncGFyYW1zJyBdIClcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cclxufSggX3dwYmMgfHwge30sIGpRdWVyeSApKTtcclxuXHJcblxyXG4gXHQvKipcclxuIFx0ICogLS0gSGVscCBmdW5jdGlvbnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JhbGFuY2VyX19pc193YWl0KCBwYXJhbXMsIGZ1bmN0aW9uX25hbWUgKXtcclxuLy9jb25zb2xlLmxvZygnOjp3cGJjX2JhbGFuY2VyX19pc193YWl0JyxwYXJhbXMgLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdKSApe1xyXG5cclxuXHRcdFx0dmFyIGJhbGFuY2VyX3N0YXR1cyA9IF93cGJjLmJhbGFuY2VyX19pbml0KCBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSwgZnVuY3Rpb25fbmFtZSwgcGFyYW1zICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gKCAnd2FpdCcgPT09IGJhbGFuY2VyX3N0YXR1cyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQoIHJlc291cmNlX2lkICwgZnVuY3Rpb25fbmFtZSApe1xyXG4vL2NvbnNvbGUubG9nKCc6OndwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCcscmVzb3VyY2VfaWQgLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRfd3BiYy5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3J1bl9saXN0KCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApO1xyXG5cdFx0X3dwYmMuYmFsYW5jZXJfX3J1bl9uZXh0KCk7XHJcblx0fSIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsL3dwYmNfY2FsLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBPcmRlciBvciBjaGlsZCBib29raW5nIHJlc291cmNlcyBzYXZlZCBoZXJlOiAgXHRfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLFxyXG4gKiAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnIClcdFx0WzIsMTAsMTIsMTFdXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEhvdyB0byBjaGVjayAgYm9va2VkIHRpbWVzIG9uICBzcGVjaWZpYyBkYXRlOiA/XHJcbiAqXHJcblx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpO1xyXG5cclxuXHRcdFx0Y29uc29sZS5sb2coXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHMsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzExXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcyxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzXHJcblx0XHRcdFx0XHQpO1xyXG4gKiAgT1JcclxuXHRcdFx0Y29uc29sZS5sb2coXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTBdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTFdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZVxyXG5cdFx0XHRcdFx0KTtcclxuICpcclxuICovXHJcblxyXG4vKipcclxuICogRGF5cyBzZWxlY3Rpb246XHJcbiAqIFx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICk7XHJcbiAqXHJcbiAqXHRcdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IDE7XHJcbiAqIFx0RXhhbXBsZSAxOlx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgJzIwMjQtMDUtMTUnLFxyXG4gKiAnMjAyNC0wNS0yNScgKTsgRXhhbXBsZSAyOlx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCxcclxuICogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjUnXSApO1xyXG4gKlxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogQyBBIEwgRSBOIEQgQSBSICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqICBTaG93IFdQQkMgQ2FsZW5kYXJcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdFx0LSByZXNvdXJjZSBJRFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfc2hvdyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gSWYgbm8gY2FsZW5kYXIgSFRNTCB0YWcsICB0aGVuICBleGl0XHJcblx0aWYgKCAwID09PSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmxlbmd0aCApeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcblx0Ly8gSWYgdGhlIGNhbGVuZGFyIHdpdGggdGhlIHNhbWUgQm9va2luZyByZXNvdXJjZSBpcyBhY3RpdmF0ZWQgYWxyZWFkeSwgdGhlbiBleGl0LiBCdXQgaW4gRWxlbWVudG9yIHRoZSBjbGFzcyBjYW4gYmUgc3RhbGUsIHNvIHZlcmlmeSBpbnN0YW5jZS5cclxuXHRpZiAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKSApIHtcclxuXHJcblx0XHR2YXIgZXhpc3RpbmdfaW5zdCA9IG51bGw7XHJcblxyXG5cdFx0dHJ5IHtcclxuXHRcdFx0ZXhpc3RpbmdfaW5zdCA9IGpRdWVyeS5kYXRlcGljay5fZ2V0SW5zdCggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5nZXQoIDAgKSApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdGV4aXN0aW5nX2luc3QgPSBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggZXhpc3RpbmdfaW5zdCApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFN0YWxlIG1hcmtlcjogcmVtb3ZlIGFuZCBjb250aW51ZSB3aXRoIGluaXQuXHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnaGFzRGF0ZXBpY2snICk7XHJcblx0fVxyXG5cclxuXHR3cGJjX3JhbmdlX3NlbGVjdGlvbl9fcHJlcGFyZV9ndWlkYW5jZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERheXMgc2VsZWN0aW9uXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCA9IGZhbHNlO1xyXG5cdHZhciBsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtICAgPSAzNjU7XHRcdFx0XHRcdC8vIG11bHRpcGxlIHwgZml4ZWRcclxuXHRpZiAoICdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0ID0gdHJ1ZTtcclxuXHRcdGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gPSAwO1xyXG5cdH1cclxuXHRpZiAoICdzaW5nbGUnICA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtID0gMDtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTWluIC0gTWF4IGRheXMgdG8gc2Nyb2xsL3Nob3dcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBsb2NhbF9fbWluX2RhdGUgPSAwO1xyXG4gXHRsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAwIF0sIChwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDIgXSwgMCwgMCwgMCApO1x0XHRcdC8vIEZpeEluOiA5LjkuMC4xNy5cclxuLy9jb25zb2xlLmxvZyggbG9jYWxfX21pbl9kYXRlICk7XHJcblx0dmFyIGxvY2FsX19tYXhfZGF0ZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhcicgKTtcclxuXHQvL2xvY2FsX19tYXhfZGF0ZSA9IG5ldyBEYXRlKDIwMjQsIDUsIDI4KTsgIEl0IGlzIGhlcmUgaXNzdWUgb2Ygbm90IHNlbGVjdGFibGUgZGF0ZXMsIGJ1dCBzb21lIGRhdGVzIHNob3dpbmcgaW4gY2FsZW5kYXIgYXMgYXZhaWxhYmxlLCBidXQgd2UgY2FuIG5vdCBzZWxlY3QgaXQuXHJcblxyXG5cdC8vLy8gRGVmaW5lIGxhc3QgZGF5IGluIGNhbGVuZGFyIChhcyBhIGxhc3QgZGF5IG9mIG1vbnRoIChhbmQgbm90IGRhdGUsIHdoaWNoIGlzIHJlbGF0ZWQgdG8gYWN0dWFsICdUb2RheScgZGF0ZSkuXHJcblx0Ly8vLyBFLmcuIGlmIHRvZGF5IGlzIDIwMjMtMDktMjUsIGFuZCB3ZSBzZXQgJ051bWJlciBvZiBtb250aHMgdG8gc2Nyb2xsJyBhcyA1IG1vbnRocywgdGhlbiBsYXN0IGRheSB3aWxsIGJlIDIwMjQtMDItMjkgYW5kIG5vdCB0aGUgMjAyNC0wMi0yNS5cclxuXHQvLyB2YXIgY2FsX2xhc3RfZGF5X2luX21vbnRoID0galF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBudWxsLCBsb2NhbF9fbWF4X2RhdGUsIG5ldyBEYXRlKCkgKTtcclxuXHQvLyBjYWxfbGFzdF9kYXlfaW5fbW9udGggPSBuZXcgRGF0ZSggY2FsX2xhc3RfZGF5X2luX21vbnRoLmdldEZ1bGxZZWFyKCksIGNhbF9sYXN0X2RheV9pbl9tb250aC5nZXRNb250aCgpICsgMSwgMCApO1xyXG5cdC8vIGxvY2FsX19tYXhfZGF0ZSA9IGNhbF9sYXN0X2RheV9pbl9tb250aDtcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjI2LlxyXG5cclxuXHQvLyBHZXQgc3RhcnQgLyBlbmQgZGF0ZXMgZnJvbSAgdGhlIEJvb2tpbmcgQ2FsZW5kYXIgc2hvcnRjb2RlLiBFeGFtcGxlOiBbYm9va2luZyBjYWxlbmRhcl9kYXRlc19zdGFydD0nMjAyNi0wMS0wMScgY2FsZW5kYXJfZGF0ZXNfZW5kPScyMDI2LTEyLTMxJyAgcmVzb3VyY2VfaWQ9MV0gLy8gRml4SW46IDEwLjEzLjEuNC5cclxuXHRpZiAoIGZhbHNlICE9PSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHJlc291cmNlX2lkICkgKSB7XHJcblx0XHRsb2NhbF9fbWluX2RhdGUgPSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHJlc291cmNlX2lkICk7ICAvLyBFLmcuIC0gbG9jYWxfX21pbl9kYXRlID0gbmV3IERhdGUoIDIwMjUsIDAsIDEgKTtcclxuXHR9XHJcblx0aWYgKCBmYWxzZSAhPT0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcmVzb3VyY2VfaWQgKSApIHtcclxuXHRcdGxvY2FsX19tYXhfZGF0ZSA9IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19lbmQoIHJlc291cmNlX2lkICk7ICAgIC8vIEUuZy4gLSBsb2NhbF9fbWF4X2RhdGUgPSBuZXcgRGF0ZSggMjAyNSwgMTEsIDMxICk7XHJcblx0fVxyXG5cclxuXHQvLyBJbiBjYXNlIHdlIGVkaXQgYm9va2luZyBpbiBwYXN0IG9yIGhhdmUgc3BlY2lmaWMgcGFyYW1ldGVyIGluIFVSTC5cclxuXHR2YXIgd3BiY19lZGl0X2Jvb2tpbmdfaGFzaCA9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9ib29raW5nX2hhc2gnICk7XHJcblx0dmFyIHdwYmNfaXNfZWRpdF9ib29raW5nX2NvbnRleHQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2Ygd3BiY19lZGl0X2Jvb2tpbmdfaGFzaCApICYmICggJycgIT09IHdwYmNfZWRpdF9ib29raW5nX2hhc2ggKTtcclxuXHR2YXIgd3BiY19hbGxvd19wYXN0X2NvbnRleHQgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYWxsb3dfcGFzdCcgKTtcclxuXHR2YXIgd3BiY19pc19hbGxvd19wYXN0X2NvbnRleHQgPSAoICcxJyA9PT0gU3RyaW5nKCB3cGJjX2FsbG93X3Bhc3RfY29udGV4dCApICkgfHwgKCAxID09PSB3cGJjX2FsbG93X3Bhc3RfY29udGV4dCApIHx8ICggdHJ1ZSA9PT0gd3BiY19hbGxvd19wYXN0X2NvbnRleHQgKTtcclxuXHR2YXIgd3BiY19hbGxvd19wYXN0X2RhdGVfYXJyID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2FsbG93X3Bhc3RfYXJyJyApO1xyXG5cdHZhciB3cGJjX2lzX2FkZF9ib29raW5nX2FkbWluX3BhZ2UgPSAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYycgKSAhPSAtMSApICYmICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAndGFiPWFkZC1ib29raW5nJyApICE9IC0xICk7XHJcblx0aWYgKCAgICggd3BiY19pc19hZGRfYm9va2luZ19hZG1pbl9wYWdlIHx8IHdwYmNfaXNfZWRpdF9ib29raW5nX2NvbnRleHQgfHwgd3BiY19pc19hbGxvd19wYXN0X2NvbnRleHQgKVxyXG5cdFx0JiYgKFxyXG5cdFx0XHQgIHdwYmNfaXNfZWRpdF9ib29raW5nX2NvbnRleHRcclxuXHRcdCAgIHx8IHdwYmNfaXNfYWxsb3dfcGFzdF9jb250ZXh0XHJcblx0XHQgICB8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZignYm9va2luZ19oYXNoJykgIT0gLTEgKSAgICAgICAgICAgICAgICAgIC8vIENvbW1lbnQgdGhpcyBsaW5lIGZvciBhYmlsaXR5IHRvIGFkZCAgYm9va2luZyBpbiBwYXN0IGRheXMgYXQgIEJvb2tpbmcgPiBBZGQgYm9va2luZyBwYWdlLlxyXG5cdFx0ICAgfHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoJ2FsbG93X3Bhc3QnKSAhPSAtMSApICAgICAgICAgICAgICAgIC8vIEZpeEluOiAxMC43LjEuMi5cclxuXHRcdClcclxuXHQpe1xyXG5cdFx0Ly8gbG9jYWxfX21pbl9kYXRlID0gbnVsbDtcclxuXHRcdC8vIEZpeEluOiAxMC4xNC4xLjQuXHJcblx0XHR2YXIgd3BiY19taW5fZGF0ZV9hcnIgPSAoIHdwYmNfaXNfYWxsb3dfcGFzdF9jb250ZXh0ICYmIHdwYmNfYWxsb3dfcGFzdF9kYXRlX2FyciAmJiAoIDUgPD0gd3BiY19hbGxvd19wYXN0X2RhdGVfYXJyLmxlbmd0aCApICkgPyB3cGJjX2FsbG93X3Bhc3RfZGF0ZV9hcnIgOiBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKTtcclxuXHRcdGxvY2FsX19taW5fZGF0ZSAgPSBuZXcgRGF0ZSggd3BiY19taW5fZGF0ZV9hcnJbMF0sICggcGFyc2VJbnQoIHdwYmNfbWluX2RhdGVfYXJyWzFdICkgLSAxKSwgd3BiY19taW5fZGF0ZV9hcnJbMl0sIHdwYmNfbWluX2RhdGVfYXJyWzNdLCB3cGJjX21pbl9kYXRlX2Fycls0XSwgMCApO1xyXG5cdFx0bG9jYWxfX21heF9kYXRlID0gbnVsbDtcclxuXHR9XHJcblxyXG5cdHZhciBsb2NhbF9fc3RhcnRfd2Vla2RheSAgICA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19zdGFydF9kYXlfd2VlZWsnICk7XHJcblx0dmFyIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID0gcGFyc2VJbnQoIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycgKSApO1xyXG5cclxuXHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnRleHQoICcnICk7XHRcdFx0XHRcdC8vIFJlbW92ZSBhbGwgSFRNTCBpbiBjYWxlbmRhciB0YWdcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNob3cgY2FsZW5kYXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSgnI2NhbGVuZGFyX2Jvb2tpbmcnKyByZXNvdXJjZV9pZCkuZGF0ZXBpY2soXHJcblx0XHRcdHtcblx0XHRcdFx0YmVmb3JlU2VsZWN0RGF5OiBmdW5jdGlvbiAoIGpzX2RhdGUsIGluc3QgKSB7XG5cdFx0XHRcdFx0cmV0dXJuICdmdW5jdGlvbicgPT09IHR5cGVvZiB3cGJjX19jYWxlbmRhcl9fYmVmb3JlX3NlbGVjdF9kYXlzX19ic1xuXHRcdFx0XHRcdFx0PyB3cGJjX19jYWxlbmRhcl9fYmVmb3JlX3NlbGVjdF9kYXlzX19icygganNfZGF0ZSwgcmVzb3VyY2VfaWQsIGluc3QgKSA6IHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJlZm9yZVNob3dEYXk6IGZ1bmN0aW9uICgganNfZGF0ZSApe1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cygganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvblNlbGVjdDogZnVuY3Rpb24gKCBzdHJpbmdfZGF0ZXMsIGpzX2RhdGVzX2FyciApeyAgLyoqXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKlx0c3RyaW5nX2RhdGVzICAgPSAgICcyMy4wOC4yMDIzIC0gMjYuMDguMjAyMydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqICAgfCAgICAnMjMuMDguMjAyMyAtIDIzLjA4LjIwMjMnICAgIHxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqICcxOS4wOS4yMDIzLCAyNC4wOC4yMDIzLCAzMC4wOS4yMDIzJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICoganNfZGF0ZXNfYXJyICAgPSAgIHJhbmdlOiBbIERhdGUgKEF1ZyAyMyAyMDIzKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqIERhdGUgKEF1ZyAyNSAyMDIzKV0gICAgIHwgICAgIG11bHRpcGxlOiBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKiBEYXRlKE9jdCAyNCAyMDIzKSwgRGF0ZShPY3QgMjAgMjAyMyksIERhdGUoT2N0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKiAxNiAyMDIzKSBdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9zZWxlY3RfZGF5cyggc3RyaW5nX2RhdGVzLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uSG92ZXI6IGZ1bmN0aW9uICggc3RyaW5nX2RhdGUsIGpzX2RhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9ob3Zlcl9kYXlzKCBzdHJpbmdfZGF0ZSwganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvbkNoYW5nZU1vbnRoWWVhcjogZnVuY3Rpb24gKCB5ZWFyLCByZWFsX21vbnRoLCBqc19kYXRlX18xc3RfZGF5X2luX21vbnRoICl7IH0sXHJcblx0XHRcdFx0c2hvd09uICAgICAgICA6ICdib3RoJyxcclxuXHRcdFx0XHRudW1iZXJPZk1vbnRoczogbG9jYWxfX251bWJlcl9vZl9tb250aHMsXHJcblx0XHRcdFx0c3RlcE1vbnRocyAgICA6IDEsXHJcblx0XHRcdFx0Ly8gcHJldlRleHQgICAgICA6ICcmbGFxdW87JyxcclxuXHRcdFx0XHQvLyBuZXh0VGV4dCAgICAgIDogJyZyYXF1bzsnLFxyXG5cdFx0XHRcdHByZXZUZXh0ICAgICAgOiAnJmxzYXF1bzsnLFxyXG5cdFx0XHRcdG5leHRUZXh0ICAgICAgOiAnJnJzYXF1bzsnLFxyXG5cdFx0XHRcdGRhdGVGb3JtYXQgICAgOiAnZGQubW0ueXknLFxyXG5cdFx0XHRcdGNoYW5nZU1vbnRoICAgOiBmYWxzZSxcclxuXHRcdFx0XHRjaGFuZ2VZZWFyICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bWluRGF0ZSAgICAgICA6IGxvY2FsX19taW5fZGF0ZSxcclxuXHRcdFx0XHRtYXhEYXRlICAgICAgIDogbG9jYWxfX21heF9kYXRlLCBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzFZJyxcclxuXHRcdFx0XHQvLyBtaW5EYXRlOiBuZXcgRGF0ZSgyMDIwLCAyLCAxKSwgbWF4RGF0ZTogbmV3IERhdGUoMjAyMCwgOSwgMzEpLCAgICAgICAgICAgICBcdC8vIEFiaWxpdHkgdG8gc2V0IGFueSAgc3RhcnQgYW5kIGVuZCBkYXRlIGluIGNhbGVuZGFyXHJcblx0XHRcdFx0c2hvd1N0YXR1cyAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bXVsdGlTZXBhcmF0b3IgIDogJywgJyxcclxuXHRcdFx0XHRjbG9zZUF0VG9wICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRmaXJzdERheSAgICAgICAgOiBsb2NhbF9fc3RhcnRfd2Vla2RheSxcclxuXHRcdFx0XHRnb3RvQ3VycmVudCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRoaWRlSWZOb1ByZXZOZXh0OiB0cnVlLFxyXG5cdFx0XHRcdG11bHRpU2VsZWN0ICAgICA6IGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0sXHJcblx0XHRcdFx0cmFuZ2VTZWxlY3QgICAgIDogbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCxcclxuXHRcdFx0XHQvLyBzaG93V2Vla3M6IHRydWUsXHJcblx0XHRcdFx0dXNlVGhlbWVSb2xsZXI6IGZhbHNlXHJcblx0XHRcdH1cclxuXHQpO1xyXG5cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gQ2xlYXIgdG9kYXkgZGF0ZSBoaWdobGlnaHRpbmdcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpeyAgd3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCByZXNvdXJjZV9pZCApOyAgfSwgNTAwICk7ICAgICAgICAgICAgICAgICAgICBcdC8vIEZpeEluOiA3LjEuMi44LlxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNjcm9sbCBjYWxlbmRhciB0byAgc3BlY2lmaWMgbW9udGhcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBzdGFydF9ia19tb250aCA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfc2Nyb2xsX3RvJyApO1xyXG5cdGlmICggZmFsc2UgIT09IHN0YXJ0X2JrX21vbnRoICl7XHJcblx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBzdGFydF9ia19tb250aFsgMCBdLCBzdGFydF9ia19tb250aFsgMSBdICk7XHJcblx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5nIHN0YXR1c2VzIGFzIGFycmF5IGZyb20gdGhlIHN0cnVjdHVyZWQgc3VtbWFyeSBmaWVsZCwgd2l0aCBmYWxsYmFjayB0byB0aGUgbGVnYWN5IHN0cmluZyBmaWVsZC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlX2Jvb2tpbmdzX29ialxyXG5cdCAqIEByZXR1cm5zIHtbXX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9ib29raW5nX3N0YXR1c2VzX19hc19hcnIoIGRhdGVfYm9va2luZ3Nfb2JqICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoICEgZGF0ZV9ib29raW5nc19vYmogKVxyXG5cdFx0XHR8fCAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXSkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggQXJyYXkuaXNBcnJheSggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0gKSApe1xyXG5cdFx0XHRyZXR1cm4gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0uZmlsdGVyKCBmdW5jdGlvbiAoIGJvb2tpbmdfc3RhdHVzICl7XHJcblx0XHRcdFx0cmV0dXJuICcnICE9PSBib29raW5nX3N0YXR1cztcclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggISBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdICl7XHJcblx0XHRcdHJldHVybiBbXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5ncycgXS50b1N0cmluZygpLnRyaW0oKS5zcGxpdCggL1xccysvICkuZmlsdGVyKCBmdW5jdGlvbiAoIGJvb2tpbmdfc3RhdHVzICl7XHJcblx0XHRcdHJldHVybiAnJyAhPT0gYm9va2luZ19zdGF0dXM7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgZXhhY3QgYm9va2luZyBzdGF0dXMgaW4gc3RhdHVzZXMgYXJyYXkuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge1tdfSBib29raW5nX3N0YXR1c2VzX2FyclxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBib29raW5nX3N0YXR1c1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgYm9va2luZ19zdGF0dXMgKXtcclxuXHRcdHJldHVybiBib29raW5nX3N0YXR1c2VzX2Fyci5pbmRleE9mKCBib29raW5nX3N0YXR1cyApID4gLTE7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgYm9va2luZyBzdGF0dXMgcGFydCwgZS5nLiBcInBlbmRpbmdcIiBpbiBcImFwcHJvdmVkX3BlbmRpbmdcIi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7W119IGJvb2tpbmdfc3RhdHVzZXNfYXJyXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IGJvb2tpbmdfc3RhdHVzX3BhcnRcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhc19wYXJ0KCBib29raW5nX3N0YXR1c2VzX2FyciwgYm9va2luZ19zdGF0dXNfcGFydCApe1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMDsgaSA8IGJvb2tpbmdfc3RhdHVzZXNfYXJyLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdGlmICggYm9va2luZ19zdGF0dXNlc19hcnJbIGkgXS5zcGxpdCggJ18nICkuaW5kZXhPZiggYm9va2luZ19zdGF0dXNfcGFydCApID4gLTEgKXtcclxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XG5cblxuXHQvKipcblx0ICogQXBwbHkgb3B0aW9uYWwsIG9uZS13YXkgZGF0ZSBjb25zdHJhaW50cyB0byBhIG5hdGl2ZSBhdmFpbGFiaWxpdHkgcmVzdWx0LlxuXHQgKlxuXHQgKiBMaXN0ZW5lcnMgcmVjZWl2ZSBvbmx5IGEgbmV3IGNvbnN0cmFpbnQgb2JqZWN0LiBObyBib29raW5nLCBhdmFpbGFiaWxpdHksXG5cdCAqIHNlYXNvbiwgb3IgY2FsZW5kYXIgcGFyYW1ldGVyIG9iamVjdHMgYXJlIGV4cG9zZWQuIENvcmUgYXZhaWxhYmlsaXR5IHN0YXlzXG5cdCAqIGF1dGhvcml0YXRpdmUgYmVjYXVzZSB0aGUgcmV0dXJuZWQgc3RhdGUgY2FuIG9ubHkgY2hhbmdlIGZyb20gc2VsZWN0YWJsZSB0b1xuXHQgKiBibG9ja2VkOyBhIGxpc3RlbmVyIGNhbm5vdCByZW9wZW4gYSBuYXRpdmVseSB1bmF2YWlsYWJsZSBkYXRlLlxuXHQgKlxuXHQgKiBFdmVudDogd3BiY19jYWxlbmRhcl9fYXBwbHlfZGF0ZV9jb25zdHJhaW50c1xuXHQgKlxuXHQgKiBDb25zdHJhaW50IG9iamVjdDpcblx0ICoge1xuXHQgKiAgICAgcmVzb3VyY2VfaWQ6IHJlc291cmNlX2lkLFxuXHQgKiAgICAgc3FsX2RhdGU6IHNxbF9kYXRlLFxuXHQgKiAgICAgaXNfYmxvY2tlZDogZmFsc2UsXG5cdCAqICAgICBjc3NfY2xhc3NlczogW11cblx0ICogfVxuXHQgKlxuXHQgKiBMaXN0ZW5lcnMgbWF5IHNldCBpc19ibG9ja2VkIHRvIHRoZSBib29sZWFuIHRydWUgYW5kIGFwcGVuZCBpbmRpdmlkdWFsLFxuXHQgKiB2YWxpZCBDU1MgY2xhc3MgbmFtZXMgdG8gY3NzX2NsYXNzZXMuIENvcmUtb3duZWQgYXZhaWxhYmlsaXR5IGNsYXNzZXMgYXJlXG5cdCAqIGlnbm9yZWQgd2hlbiBzdXBwbGllZCBieSBsaXN0ZW5lcnMuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgICAgICAgICAgIEJvb2tpbmcgcmVzb3VyY2UgSUQuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgc3FsX2RhdGUgICAgICAgICAgICAgIENhbGVuZGFyIGRhdGUgaW4gWVlZWS1NTS1ERCBmb3JtYXQuXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gICAgICAgaXNfbmF0aXZlbHlfc2VsZWN0YWJsZSBXaGV0aGVyIGNvcmUgbWFya2VkIHRoZSBkYXRlIHNlbGVjdGFibGUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nW119ICAgICAgbmF0aXZlX2Nzc19jbGFzc2VzICAgIENvcmUtZ2VuZXJhdGVkIENTUyBjbGFzc2VzLlxuXHQgKiBAcmV0dXJucyB7e2lzX3NlbGVjdGFibGU6IGJvb2xlYW4sIGNzc19jbGFzc2VzOiBzdHJpbmdbXX19IENvbnN0cmFpbmVkIHJlc3VsdC5cblx0ICovXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2V2YWx1YXRlX2RhdGVfY29uc3RyYWludHMoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSwgaXNfbmF0aXZlbHlfc2VsZWN0YWJsZSwgbmF0aXZlX2Nzc19jbGFzc2VzICkge1xuXG5cdFx0dmFyIGRhdGVfY29uc3RyYWludCA9IHtcblx0XHRcdCdyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkLFxuXHRcdFx0J3NxbF9kYXRlJzogc3FsX2RhdGUsXG5cdFx0XHQnaXNfYmxvY2tlZCc6IGZhbHNlLFxuXHRcdFx0J2Nzc19jbGFzc2VzJzogW11cblx0XHR9O1xuXHRcdHZhciByZXN1bHRfY3NzX2NsYXNzZXMgPSBBcnJheS5pc0FycmF5KCBuYXRpdmVfY3NzX2NsYXNzZXMgKSA/IG5hdGl2ZV9jc3NfY2xhc3Nlcy5zbGljZSggMCApIDogW107XG5cdFx0dmFyIGNvbnN0cmFpbnRfY2xhc3NfaW5kZXg7XG5cdFx0dmFyIGNvbnN0cmFpbnRfY3NzX2NsYXNzO1xuXG5cdFx0alF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19jYWxlbmRhcl9fYXBwbHlfZGF0ZV9jb25zdHJhaW50cycsIFsgZGF0ZV9jb25zdHJhaW50IF0gKTtcblxuXHRcdGlmICggdHJ1ZSA9PT0gZGF0ZV9jb25zdHJhaW50LmlzX2Jsb2NrZWQgKSB7XG5cdFx0XHRmb3IgKCBjb25zdHJhaW50X2NsYXNzX2luZGV4ID0gcmVzdWx0X2Nzc19jbGFzc2VzLmxlbmd0aCAtIDE7IGNvbnN0cmFpbnRfY2xhc3NfaW5kZXggPj0gMDsgY29uc3RyYWludF9jbGFzc19pbmRleC0tICkge1xuXHRcdFx0XHRpZiAoICdkYXRlX2F2YWlsYWJsZScgPT09IHJlc3VsdF9jc3NfY2xhc3Nlc1sgY29uc3RyYWludF9jbGFzc19pbmRleCBdICkge1xuXHRcdFx0XHRcdHJlc3VsdF9jc3NfY2xhc3Nlcy5zcGxpY2UoIGNvbnN0cmFpbnRfY2xhc3NfaW5kZXgsIDEgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIC0xID09PSByZXN1bHRfY3NzX2NsYXNzZXMuaW5kZXhPZiggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKSApIHtcblx0XHRcdFx0cmVzdWx0X2Nzc19jbGFzc2VzLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCBBcnJheS5pc0FycmF5KCBkYXRlX2NvbnN0cmFpbnQuY3NzX2NsYXNzZXMgKSApIHtcblx0XHRcdGZvciAoIGNvbnN0cmFpbnRfY2xhc3NfaW5kZXggPSAwOyBjb25zdHJhaW50X2NsYXNzX2luZGV4IDwgZGF0ZV9jb25zdHJhaW50LmNzc19jbGFzc2VzLmxlbmd0aDsgY29uc3RyYWludF9jbGFzc19pbmRleCsrICkge1xuXHRcdFx0XHRpZiAoICdzdHJpbmcnICE9PSB0eXBlb2YgZGF0ZV9jb25zdHJhaW50LmNzc19jbGFzc2VzWyBjb25zdHJhaW50X2NsYXNzX2luZGV4IF0gKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdHJhaW50X2Nzc19jbGFzcyA9IGRhdGVfY29uc3RyYWludC5jc3NfY2xhc3Nlc1sgY29uc3RyYWludF9jbGFzc19pbmRleCBdLnRyaW0oKTtcblx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdCAgICcnID09PSBjb25zdHJhaW50X2Nzc19jbGFzc1xuXHRcdFx0XHRcdHx8ICdkYXRlX2F2YWlsYWJsZScgPT09IGNvbnN0cmFpbnRfY3NzX2NsYXNzXG5cdFx0XHRcdFx0fHwgJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgPT09IGNvbnN0cmFpbnRfY3NzX2NsYXNzXG5cdFx0XHRcdFx0fHwgISAvXi0/W19hLXpBLVpdK1tfYS16QS1aMC05LV0qJC8udGVzdCggY29uc3RyYWludF9jc3NfY2xhc3MgKVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICggLTEgPT09IHJlc3VsdF9jc3NfY2xhc3Nlcy5pbmRleE9mKCBjb25zdHJhaW50X2Nzc19jbGFzcyApICkge1xuXHRcdFx0XHRcdHJlc3VsdF9jc3NfY2xhc3Nlcy5wdXNoKCBjb25zdHJhaW50X2Nzc19jbGFzcyApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdCdpc19zZWxlY3RhYmxlJzogQm9vbGVhbiggaXNfbmF0aXZlbHlfc2VsZWN0YWJsZSApICYmIHRydWUgIT09IGRhdGVfY29uc3RyYWludC5pc19ibG9ja2VkLFxuXHRcdFx0J2Nzc19jbGFzc2VzJzogcmVzdWx0X2Nzc19jbGFzc2VzXG5cdFx0fTtcblx0fVxuXG5cblx0LyoqXG5cdCAqIEFwcGx5IENTUyB0byBjYWxlbmRhciBkYXRlIGNlbGxzXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwXHJcblx0ICogICAgIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMgeygqfHN0cmluZylbXXwoYm9vbGVhbnxzdHJpbmcpW119XHRcdC0gWyB7dHJ1ZSAtYXZhaWxhYmxlIHwgZmFsc2UgLSB1bmF2YWlsYWJsZX0sICdDU1MgY2xhc3NlcyBmb3JcclxuXHQgKiAgICAgY2FsZW5kYXIgZGF5IGNlbGwnIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgdG9kYXlfZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDAgXSwgKHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDEgXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHRcdFx0XHRcdFx0XHRcdC8vIFRvZGF5IEpTX0RhdGVfT2JqLlxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7IFx0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBHZXQgU2VsZWN0ZWQgZGF0ZXMgaW4gY2FsZW5kYXJcclxuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19zcWwgPSB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gR2V0IERhdGEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBkYXRlX2Jvb2tpbmdzX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHRcdC8vIEFycmF5IHdpdGggQ1NTIGNsYXNzZXMgZm9yIGRhdGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlID0gW107XHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NxbF9kYXRlXycgICAgICsgc3FsX2NsYXNzX2RheSApO1x0XHRcdFx0Ly8gICdzcWxfZGF0ZV8yMDIzLTA3LTIxJ1xyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjYWw0ZGF0ZS0nICAgICArIGNsYXNzX2RheSApO1x0XHRcdFx0XHQvLyAgJ2NhbDRkYXRlLTctMjEtMjAyMydcclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnd3BiY193ZWVrZGF5XycgKyBkYXRlLmdldERheSgpICk7XHRcdFx0XHQvLyAgJ3dwYmNfd2Vla2RheV80J1xyXG5cclxuXHRcdC8vIERlZmluZSBTZWxlY3RlZCBDaGVjayBJbi9PdXQgZGF0ZXMgaW4gVEQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoXHJcblx0XHRcdFx0KCBzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoICApXHJcblx0XHRcdC8vJiYgICggc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gIT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdIClcclxuXHRcdCl7XHJcblx0XHRcdGlmICggc3FsX2NsYXNzX2RheSA9PT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gKXtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX2luJyApO1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfaW5fb3V0JyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggICggc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCA+IDEgKSAmJiAoIHNxbF9jbGFzc19kYXkgPT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdICkgKSB7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19vdXQnICk7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19pbl9vdXQnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0dmFyIGlzX2RheV9zZWxlY3RhYmxlICAgICA9IGZhbHNlO1xuXHRcdHZhciBkYXRlX2NvbnN0cmFpbnRfcmVzdWx0O1xuXHJcblx0XHQvLyBJZiBzb21ldGhpbmcgbm90IGRlZmluZWQsICB0aGVuICB0aGlzIGRhdGUgY2xvc2VkIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAvLyBGaXhJbjogMTAuMTIuNC42LlxyXG5cdFx0aWYgKCAoZmFsc2UgPT09IGRhdGVfYm9va2luZ3Nfb2JqKSB8fCAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAoZGF0ZV9ib29raW5nc19vYmpbcmVzb3VyY2VfaWRdKSkgKSB7XG5cblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyApO1xuXHRcdFx0ZGF0ZV9jb25zdHJhaW50X3Jlc3VsdCA9IHdwYmNfY2FsZW5kYXJfX2V2YWx1YXRlX2RhdGVfY29uc3RyYWludHMoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5LCBpc19kYXlfc2VsZWN0YWJsZSwgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlICk7XG5cblx0XHRcdHJldHVybiBbIGRhdGVfY29uc3RyYWludF9yZXN1bHQuaXNfc2VsZWN0YWJsZSwgZGF0ZV9jb25zdHJhaW50X3Jlc3VsdC5jc3NfY2xhc3Nlcy5qb2luKCAnICcgKSBdO1xuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICAgZGF0ZV9ib29raW5nc19vYmogIC0gRGVmaW5lZC4gICAgICAgICAgICBEYXRlcyBjYW4gYmUgc2VsZWN0YWJsZS5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgYm9va2luZ19zdGF0dXNlc19hcnIgPSB3cGJjX2dldF9ib29raW5nX3N0YXR1c2VzX19hc19hcnIoIGRhdGVfYm9va2luZ3Nfb2JqICk7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEFkZCBzZWFzb24gbmFtZXMgdG8gdGhlIGRheSBDU1MgY2xhc3NlcyAtLSBpdCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCAgd29yayAgb2YgY29uZGl0aW9uYWwgZmllbGRzIC0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgc2Vhc29uX25hbWVzX2FyciA9IF93cGJjLnNlYXNvbnNfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgc2Vhc29uX2tleSBpbiBzZWFzb25fbmFtZXNfYXJyICl7XHJcblxyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggc2Vhc29uX25hbWVzX2Fyclsgc2Vhc29uX2tleSBdICk7XHRcdFx0XHQvLyAgJ3dwZGV2Ymtfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJ1xyXG5cdFx0fVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdFx0Ly8gQ29zdCBSYXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAncmF0ZV8nICsgZGF0ZV9ib29raW5nc19vYmpbIHJlc291cmNlX2lkIF1bICdkYXRlX2Nvc3RfcmF0ZScgXS50b1N0cmluZygpLnJlcGxhY2UoIC9bXFwuXFxzXS9nLCAnXycgKSApO1x0XHRcdFx0XHRcdC8vICAncmF0ZV85OV8wMCcgLT4gOTkuMDBcclxuXHJcblxyXG5cdFx0aWYgKCBwYXJzZUludCggZGF0ZV9ib29raW5nc19vYmpbICdkYXlfYXZhaWxhYmlsaXR5JyBdICkgPiAwICl7XHJcblx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gdHJ1ZTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX2F2YWlsYWJsZScgKTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdyZXNlcnZlZF9kYXlzX2NvdW50JyArIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ21heF9jYXBhY2l0eScgXSAtIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IGZhbHNlO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0c3dpdGNoICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHRjYXNlICdhdmFpbGFibGUnOlxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAndGltZV9zbG90c19ib29raW5nJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ3RpbWVzX2Nsb2NrJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnZnVsbF9kYXlfYm9va2luZyc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdmdWxsX2RheV9ib29raW5nJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnc2Vhc29uX2ZpbHRlcic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnc2Vhc29uX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3NfYXJyJyBdID0gW107XHJcblx0XHRcdFx0Ym9va2luZ19zdGF0dXNlc19hcnIgPSBbXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ3Jlc291cmNlX2F2YWlsYWJpbGl0eSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAncmVzb3VyY2VfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5nc19hcnInIF0gPSBbXTtcclxuXHRcdFx0XHRib29raW5nX3N0YXR1c2VzX2FyciA9IFtdO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnd2Vla2RheV91bmF2YWlsYWJsZSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnd2Vla2RheV91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzX2FycicgXSA9IFtdO1xyXG5cdFx0XHRcdGJvb2tpbmdfc3RhdHVzZXNfYXJyID0gW107XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3NfYXJyJyBdID0gW107XHJcblx0XHRcdFx0Ym9va2luZ19zdGF0dXNlc19hcnIgPSBbXTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdsaW1pdF9hdmFpbGFibGVfZnJvbV90b2RheScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzX2FycicgXSA9IFtdO1xyXG5cdFx0XHRcdGJvb2tpbmdfc3RhdHVzZXNfYXJyID0gW107XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGFuZ2Vfb3Zlcic6XHJcblx0XHRcdFx0LypcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUgXHQgXHRjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZVxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUgXHQgXHRjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWRcclxuXHRcdFx0XHQvLyAgY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUgXHRcdCBcdGNoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWRcclxuXHRcdFx0XHQvLyAgY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdCAqL1xyXG5cclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX2luX3RpbWUnLCAnY2hlY2tfb3V0X3RpbWUnICk7XHJcblx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC4yLlxyXG5cdFx0XHRcdGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAnYXBwcm92ZWRfcGVuZGluZycgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfYXBwcm92ZWQnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJywgJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGVja19pbic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd0aW1lc3BhcnRseScsICdjaGVja19pbl90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhc19wYXJ0KCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmcnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXNfcGFydCggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnY2hlY2tfb3V0JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX291dF90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhc19wYXJ0KCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmcnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzX3BhcnQoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAnYXBwcm92ZWQnICkgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdC8vIG1peGVkIHN0YXR1c2VzOiAnY2hhbmdlX292ZXIgY2hlY2tfb3V0JyAuLi4uIHZhcmlhdGlvbnMuLi4uIGNoZWNrIG1vcmUgaW4gXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2F2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIoKVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSA9ICdhdmFpbGFibGUnO1xyXG5cdFx0fVxyXG5cclxuXHJcblxyXG5cdFx0aWYgKCAnYXZhaWxhYmxlJyAhPSBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdHZhciBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGUgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlJyApO1x0Ly8gc2V0IHBlbmRpbmcgZGF5cyBzZWxlY3RhYmxlICAgICAgICAgIC8vIEZpeEluOiA4LjYuMS4xOC5cclxuXHJcblx0XHRcdGlmICggd3BiY19ib29raW5nX3N0YXR1c2VzX19oYXMoIGJvb2tpbmdfc3RhdHVzZXNfYXJyLCAncGVuZGluZycgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfcGVuZGluZycgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdwZW5kaW5nX2FwcHJvdmVkJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZF9wZW5kaW5nJyApICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdhcHByb3ZlZF9hcHByb3ZlZCcgKSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcsICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRkYXRlX2NvbnN0cmFpbnRfcmVzdWx0ID0gd3BiY19jYWxlbmRhcl9fZXZhbHVhdGVfZGF0ZV9jb25zdHJhaW50cyggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXksIGlzX2RheV9zZWxlY3RhYmxlLCBjc3NfY2xhc3Nlc19fZm9yX2RhdGUgKTtcblxuXHRcdHJldHVybiBbIGRhdGVfY29uc3RyYWludF9yZXN1bHQuaXNfc2VsZWN0YWJsZSwgZGF0ZV9jb25zdHJhaW50X3Jlc3VsdC5jc3NfY2xhc3Nlcy5qb2luKCAnICcgKSBdO1xuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBNb3VzZW92ZXIgY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHN0cmluZ19kYXRlXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwXHJcblx0ICogICAgIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMoIHN0cmluZ19kYXRlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICkge1xyXG5cclxuXHRcdGlmICggbnVsbCA9PT0gZGF0ZSApIHtcclxuXHRcdFx0d3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMScgKTtcdFx0Ly8gRml4SW46IDEwLjUuMi40LlxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7XHRcdC8vICcxJ1xyXG5cclxuXHRcdC8vIEdldCBEYXRhIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgZGF0ZV9ib29raW5nX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHsuLi59XHJcblxyXG5cdFx0aWYgKCAhIGRhdGVfYm9va2luZ19vYmogKXsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cclxuXHRcdC8vIFQgbyBvIGwgdCBpIHAgcyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgdG9vbHRpcF90ZXh0ID0gJyc7XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYXZhaWxhYmlsaXR5JyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2F2YWlsYWJpbGl0eScgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9ib29raW5nX2RldGFpbHMnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYm9va2luZ19kZXRhaWxzJyBdO1xyXG5cdFx0fVxyXG5cdFx0d3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHJcblx0XHQvLyAgVSBuIGggbyB2IGUgciBpIG4gZyAgICBpbiAgICBVTlNFTEVDVEFCTEVfQ0FMRU5EQVIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciA9ICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmdfdW5zZWxlY3RhYmxlJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCk7XHRcdFx0XHQvLyBGaXhJbjogOC4wLjEuMi5cclxuXHRcdHZhciBpc19ib29raW5nX2Zvcm1fZXhpc3QgICAgPSAoIGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApO1xyXG5cdFx0dmFyIGlzX2FkZF9ib29raW5nX21vZGFsX2NhbGVuZGFyID0gKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmNsb3Nlc3QoICcjd3BiY19tb2RhbF9fYWRkX2Jvb2tpbmdfX3NlY3Rpb24nICkubGVuZ3RoID4gMCApO1xyXG5cdFx0dmFyIGlzX2FkbWluX2NhbGVuZGFyX3ByZXZpZXcgPSAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuY2xvc2VzdCggJ1tkYXRhLXdwYmMtYWRtaW4tY2FsZW5kYXItcHJldmlldz1cIjFcIl0nICkubGVuZ3RoID4gMCApO1xyXG5cclxuXHRcdGlmICggKCBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgKSAmJiAoICEgaXNfYm9va2luZ19mb3JtX2V4aXN0ICkgKXtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiAgVW4gSG92ZXIgYWxsIGRhdGVzIGluIGNhbGVuZGFyICh3aXRob3V0IHRoZSBib29raW5nIGZvcm0pLCBpZiBvbmx5IEF2YWlsYWJpbGl0eSBDYWxlbmRhciBoZXJlIGFuZCB3ZSBkb1xyXG5cdFx0XHQgKiBub3QgaW5zZXJ0IEJvb2tpbmcgZm9ybSBieSBtaXN0YWtlLlxyXG5cdFx0XHQgKi9cclxuXHJcblx0XHRcdHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTsgXHRcdFx0XHRcdFx0XHQvLyBDbGVhciBkYXlzIGhpZ2hsaWdodGluZ1xyXG5cclxuXHRcdFx0dmFyIGNzc19vZl9jYWxlbmRhciA9ICcud3BiY19vbmx5X2NhbGVuZGFyICNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkO1xyXG5cdFx0XHRqUXVlcnkoIGNzc19vZl9jYWxlbmRhciArICcgLmRhdGVwaWNrLWRheXMtY2VsbCwgJ1xyXG5cdFx0XHRcdCAgKyBjc3Nfb2ZfY2FsZW5kYXIgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwgYScgKS5jc3MoICdjdXJzb3InLCAnZGVmYXVsdCcgKTtcdC8vIFNldCBjdXJzb3IgdG8gRGVmYXVsdFxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0XHQvLyAgRCBhIHkgcyAgICBIIG8gdiBlIHIgaSBuIGcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYycgKSA9PSAtMSApXHJcblx0XHRcdHx8ICggKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMnICkgPiAwICkgJiYgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICd0YWI9YWRkLWJvb2tpbmcnICkgPiAwICkgKVxyXG5cdFx0XHR8fCAoIGlzX2FkZF9ib29raW5nX21vZGFsX2NhbGVuZGFyIClcclxuXHRcdFx0fHwgKCBpc19hZG1pbl9jYWxlbmRhcl9wcmV2aWV3IClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtc2V0dXAnICkgPiAwIClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtYXZhaWxhYmlsaXR5JyApID4gMCApXHJcblx0XHRcdHx8ICggICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLXNldHRpbmdzJyApID4gMCApICAmJlxyXG5cdFx0XHRcdCAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICd0YWI9YnVpbGRlcl9ib29raW5nX2Zvcm0nICkgPiAwIClcclxuXHRcdFx0ICAgKVxyXG5cdFx0KXtcclxuXHRcdFx0Ly8gVGhlIHNhbWUgYXMgZGF0ZXMgc2VsZWN0aW9uLCAgYnV0IGZvciBkYXlzIGhvdmVyaW5nXHJcblxyXG5cdFx0XHRpZiAoICdmdW5jdGlvbicgPT0gdHlwZW9mKCB3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19oaWdobGlnaHRfX2JzICkgKXtcclxuXHRcdFx0XHR3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19oaWdobGlnaHRfX2JzKCBzcWxfY2xhc3NfZGF5LCBkYXRlLCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApIHtcclxuXHRcdFx0XHR3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19oaWdobGlnaHRfX3VucmVzdHJpY3RlZF9yYW5nZSggc3FsX2NsYXNzX2RheSwgZGF0ZSwgcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBIaWdobGlnaHQgYW4gdW5yZXN0cmljdGVkIHByb3Bvc2VkIHJhbmdlIGFmdGVyIHRoZSBmaXJzdCBjbGljayB3aGVuIEJ1c2luZXNzIFNtYWxsIGlzIG5vdCBsb2FkZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheSBIb3ZlcmVkIGRhdGUgaW4gU1FMIGZvcm1hdC5cclxuXHQgKiBAcGFyYW0ge0RhdGV9IGRhdGUgSG92ZXJlZCBkYXRlLlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIHRoZSBjb21wbGV0ZSBwcm9wb3NlZCByYW5nZSBpcyBhdmFpbGFibGUgYW5kIGhpZ2hsaWdodGVkLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX2hpZ2hsaWdodF9fdW5yZXN0cmljdGVkX3JhbmdlKCBzcWxfY2xhc3NfZGF5LCBkYXRlLCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHR2YXIgcmFuZ2Vfc3RhcnQ7XHJcblx0XHR2YXIgcmFuZ2VfZW5kO1xyXG5cdFx0dmFyIHdvcmtpbmdfZGF0ZTtcclxuXHRcdHZhciB0ZF9vdmVycyA9IFtdO1xyXG5cclxuXHRcdHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgIG51bGwgPT09IGluc3RcclxuXHRcdFx0fHwgJ2R5bmFtaWMnICE9PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnIClcclxuXHRcdCkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gQmVmb3JlIGEgcmFuZ2Ugc3RhcnRzLCBvciBhZnRlciBpdCBpcyBjb21wbGV0ZSwgcHJldmlldyB0aGUgaG92ZXJlZCBkYXRlIGFzIHRoZSBwb3NzaWJsZSBmaXJzdCBkYXkuXHJcblx0XHRpZiAoIDEgIT09IGluc3QuZGF0ZXMubGVuZ3RoIHx8ICEgaW5zdC5kYXRlc1sgMCBdICkge1xyXG5cdFx0XHRpZiAoICEgd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApICkge1xyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5jYWw0ZGF0ZS0nICsgd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICkgKVxyXG5cdFx0XHRcdC5hZGRDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyYW5nZV9zdGFydCA9IG5ldyBEYXRlKCBpbnN0LmRhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSwgaW5zdC5kYXRlc1sgMCBdLmdldE1vbnRoKCksIGluc3QuZGF0ZXNbIDAgXS5nZXREYXRlKCksIDAsIDAsIDAgKTtcclxuXHRcdHJhbmdlX2VuZCAgID0gbmV3IERhdGUoIGRhdGUuZ2V0RnVsbFllYXIoKSwgZGF0ZS5nZXRNb250aCgpLCBkYXRlLmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cclxuXHRcdC8vIERhdGVwaWNrIG9ubHkgcGVybWl0cyBhIGNoZWNrLW91dCBkYXRlIG9uL2FmdGVyIHRoZSBmaXJzdCBjbGljay4gRG8gbm90IHByZXZpZXcgYSBiYWNrd2FyZCByYW5nZS5cclxuXHRcdGlmICggcmFuZ2VfZW5kLmdldFRpbWUoKSA8IHJhbmdlX3N0YXJ0LmdldFRpbWUoKSApIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdvcmtpbmdfZGF0ZSA9IG5ldyBEYXRlKCByYW5nZV9zdGFydC5nZXRUaW1lKCkgKTtcclxuXHRcdHdoaWxlICggd29ya2luZ19kYXRlLmdldFRpbWUoKSA8PSByYW5nZV9lbmQuZ2V0VGltZSgpICkge1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggd29ya2luZ19kYXRlICk7XHJcblx0XHRcdGlmICggISB3cGJjX2lzX3RoaXNfZGF5X3NlbGVjdGFibGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICkgKSB7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0ZF9vdmVycy5wdXNoKCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5jYWw0ZGF0ZS0nICsgd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCB3b3JraW5nX2RhdGUgKSApO1xyXG5cdFx0XHR3b3JraW5nX2RhdGUuc2V0RGF0ZSggd29ya2luZ19kYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIHRkX292ZXJzLmxlbmd0aCApIHtcclxuXHRcdFx0alF1ZXJ5KCB0ZF9vdmVycy5qb2luKCAnLCcgKSApLmFkZENsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRydWU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQ29tcGxldGUgYW4gdW5yZXN0cmljdGVkIHR3by1jbGljayByYW5nZSB3aGVuIHRoZSBCdXNpbmVzcyBTbWFsbCByYW5nZSBlbmdpbmUgaXMgbm90IGxvYWRlZC5cclxuXHQgKiBUaGUgaGlkZGVuIGJvb2tpbmcgZmllbGQgbXVzdCBjb250YWluIGV2ZXJ5IGRhdGUgYmVjYXVzZSBGcmVlIHRpbWUvaGludCBoYW5kbGVycyBjb25zdW1lIGEgY29tbWEtc2VwYXJhdGVkIGxpc3QuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0ZWRfZGF0ZXMgRGF0ZXBpY2sncyBlbmRwb2ludCBzdHJpbmcuXHJcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGFmdGVyIGEgY29tcGxldGUgdmFsaWQgcmFuZ2UsIGZhbHNlIHdoaWxlIGluY29tcGxldGUgb3IgaW52YWxpZC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19zZWxlY3RfX3VucmVzdHJpY3RlZF9yYW5nZSggc2VsZWN0ZWRfZGF0ZXMsIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHRcdHZhciByYW5nZV9zdGFydDtcclxuXHRcdHZhciByYW5nZV9lbmQ7XHJcblx0XHR2YXIgY3VycmVudF9kYXRlO1xyXG5cdFx0dmFyIHNlbGVjdGVkX3JhbmdlID0gW107XHJcblxyXG5cdFx0aWYgKCBudWxsID09PSBpbnN0ICkge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRGF0ZXBpY2sgd3JpdGVzIFwic3RhcnQgLSBzdGFydFwiIGFmdGVyIGNsaWNrIG9uZS4gS2VlcCBpdHMgaW50ZXJuYWwgZW5kcG9pbnQsIGJ1dCBkbyBub3QgZXhwb3NlIGEgc3VibWl0dGFibGUgcmFuZ2UgeWV0LlxyXG5cdFx0aWYgKCB0cnVlID09PSBpbnN0LnN0YXlPcGVuIHx8IGluc3QuZGF0ZXMubGVuZ3RoIDwgMiB8fCAhIGluc3QuZGF0ZXNbIDAgXSB8fCAhIGluc3QuZGF0ZXNbIDEgXSApIHtcclxuXHRcdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJhbmdlX3N0YXJ0ID0gbmV3IERhdGUoIGluc3QuZGF0ZXNbIDAgXS5nZXRGdWxsWWVhcigpLCBpbnN0LmRhdGVzWyAwIF0uZ2V0TW9udGgoKSwgaW5zdC5kYXRlc1sgMCBdLmdldERhdGUoKSwgMCwgMCwgMCApO1xyXG5cdFx0cmFuZ2VfZW5kICAgPSBuZXcgRGF0ZSggaW5zdC5kYXRlc1sgMSBdLmdldEZ1bGxZZWFyKCksIGluc3QuZGF0ZXNbIDEgXS5nZXRNb250aCgpLCBpbnN0LmRhdGVzWyAxIF0uZ2V0RGF0ZSgpLCAwLCAwLCAwICk7XHJcblxyXG5cdFx0Ly8gRGVmZW5zaXZlIG5vcm1hbGl6YXRpb24uIERhdGVwaWNrIG5vcm1hbGx5IHByZXZlbnRzIGFuIGVuZCBkYXRlIGJlZm9yZSB0aGUgZmlyc3QgZW5kcG9pbnQuXHJcblx0XHRpZiAoIHJhbmdlX2VuZC5nZXRUaW1lKCkgPCByYW5nZV9zdGFydC5nZXRUaW1lKCkgKSB7XHJcblx0XHRcdGN1cnJlbnRfZGF0ZSA9IHJhbmdlX3N0YXJ0O1xyXG5cdFx0XHRyYW5nZV9zdGFydCA9IHJhbmdlX2VuZDtcclxuXHRcdFx0cmFuZ2VfZW5kID0gY3VycmVudF9kYXRlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGN1cnJlbnRfZGF0ZSA9IG5ldyBEYXRlKCByYW5nZV9zdGFydC5nZXRUaW1lKCkgKTtcclxuXHRcdHdoaWxlICggY3VycmVudF9kYXRlLmdldFRpbWUoKSA8PSByYW5nZV9lbmQuZ2V0VGltZSgpICkge1xyXG5cdFx0XHRpZiAoICEgd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggY3VycmVudF9kYXRlICkgKSApIHtcclxuXHRcdFx0XHR3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICk7XHJcblx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKCB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nICkgKSB7XHJcblx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKFxyXG5cdFx0XHRcdFx0XHQnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKyAnIC5ia19jYWxlbmRhcl9mcmFtZScsXHJcblx0XHRcdFx0XHRcdF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9yYW5nZV9zZWxlY3Rpb25faGFzX3VuYXZhaWxhYmxlX2RhdGVzJyApLFxyXG5cdFx0XHRcdFx0XHQndGV4dCdcclxuXHRcdFx0XHRcdCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0c2VsZWN0ZWRfcmFuZ2UucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9mb3JtYXREYXRlKCBpbnN0LCBjdXJyZW50X2RhdGUgKSApO1xyXG5cdFx0XHRjdXJyZW50X2RhdGUuc2V0RGF0ZSggY3VycmVudF9kYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHJcblx0XHRqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCBzZWxlY3RlZF9yYW5nZS5qb2luKCAnLCAnICkgKTtcclxuXHRcdHJldHVybiB0cnVlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFByZXBhcmUgYSBjb2xsYXBzZWQgcmFuZ2Utc2VsZWN0aW9uIGd1aWRhbmNlIG5vdGUgZm9yIG9uZSBjYWxlbmRhci5cclxuXHQgKiBLZWVwaW5nIG9uZSByZXVzYWJsZSBub2RlIGF2b2lkcyByZXBlYXRlZCBpbnNlcnRpb24gd2hpbGUgaW5hY3RpdmUgZ3VpZGFuY2Ugb2NjdXBpZXMgbm8gbGF5b3V0IHNwYWNlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIEByZXR1cm5zIHtqUXVlcnl9IFRoZSBwcmVwYXJlZCBub3RlLCBvciBhbiBlbXB0eSBjb2xsZWN0aW9uIHdoZW4gZ3VpZGFuY2UgaXMgdW5hdmFpbGFibGUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19yYW5nZV9zZWxlY3Rpb25fX3ByZXBhcmVfZ3VpZGFuY2UoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIGlzX2VuYWJsZWQgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3JhbmdlX3NlbGVjdGlvbl9ndWlkYW5jZV9pc19lbmFibGVkJyApO1xyXG5cdFx0dmFyICRib29raW5nX2Zvcm0gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApO1xyXG5cdFx0dmFyICRjYWxlbmRhcl9mcmFtZTtcclxuXHRcdHZhciAkbm90ZSA9IGpRdWVyeSggJyN3cGJjX3JhbmdlX3NlbGVjdGlvbl9ndWlkYW5jZScgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgZmFsc2UgPT09IGlzX2VuYWJsZWRcclxuXHRcdFx0fHwgMCA9PT0gaXNfZW5hYmxlZFxyXG5cdFx0XHR8fCAnMCcgPT09IGlzX2VuYWJsZWRcclxuXHRcdFx0fHwgJ29mZicgPT09IFN0cmluZyggaXNfZW5hYmxlZCApLnRvTG93ZXJDYXNlKClcclxuXHRcdFx0fHwgJ2ZhbHNlJyA9PT0gU3RyaW5nKCBpc19lbmFibGVkICkudG9Mb3dlckNhc2UoKVxyXG5cdFx0XHR8fCAnZHluYW1pYycgIT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKVxyXG5cdFx0XHR8fCAwID09PSAkYm9va2luZ19mb3JtLmxlbmd0aFxyXG5cdFx0KSB7XHJcblx0XHRcdCRub3RlLnJlbW92ZSgpO1xyXG5cdFx0XHRyZXR1cm4galF1ZXJ5KCk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAwIDwgJG5vdGUubGVuZ3RoICkge1xyXG5cdFx0XHQkbm90ZS5zdG9wKCB0cnVlLCB0cnVlICkuaGlkZSgpLmF0dHIoICdhcmlhLWhpZGRlbicsICd0cnVlJyApO1xyXG5cdFx0XHRyZXR1cm4gJG5vdGU7XHJcblx0XHR9XHJcblxyXG5cdFx0JGNhbGVuZGFyX2ZyYW1lID0gJGJvb2tpbmdfZm9ybS5maW5kKCAnLmJsb2NrX2hpbnRzLmRhdGVwaWNrJyApLmZpcnN0KCk7XHJcblx0XHRpZiAoIDAgPT09ICRjYWxlbmRhcl9mcmFtZS5sZW5ndGggKSB7XHJcblx0XHRcdCRjYWxlbmRhcl9mcmFtZSA9ICRib29raW5nX2Zvcm0uZmluZCggJy53cGJjX2NhbF9wb3dlcmVkX2J5JyApLmZpcnN0KCk7XHJcblx0XHRcdGlmICggMCA9PT0gJGNhbGVuZGFyX2ZyYW1lLmxlbmd0aCApIHtcclxuXHRcdFx0XHQkY2FsZW5kYXJfZnJhbWUgPSAkYm9va2luZ19mb3JtLmZpbmQoICcuYmtfY2FsZW5kYXJfZnJhbWUnICkuZmlyc3QoKTtcclxuXHRcdFx0XHRpZiAoIDAgPT09ICRjYWxlbmRhcl9mcmFtZS5sZW5ndGggKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4galF1ZXJ5KCk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0JG5vdGUgPSBqUXVlcnkoICc8ZGl2PicsIHtcclxuXHRcdFx0J2lkJzogJ3dwYmNfcmFuZ2Vfc2VsZWN0aW9uX2d1aWRhbmNlJyArIHJlc291cmNlX2lkLFxyXG5cdFx0XHQnY2xhc3MnOiAnd3BiY19yYW5nZV9zZWxlY3Rpb25fZ3VpZGFuY2Ugd3BiY19mcm9udF9lbmRfX21lc3NhZ2Ugd3BiY19mZV9tZXNzYWdlX2luZm8nLFxyXG5cdFx0XHQncm9sZSc6ICdzdGF0dXMnLFxyXG5cdFx0XHQnYXJpYS1saXZlJzogJ3BvbGl0ZScsXHJcblx0XHRcdCdhcmlhLWhpZGRlbic6ICd0cnVlJyxcclxuXHRcdFx0J3N0eWxlJzogJ2Rpc3BsYXk6IG5vbmU7J1xyXG5cdFx0fSApO1xyXG5cdFx0JG5vdGUuYXBwZW5kKCBqUXVlcnkoICc8aT4nLCB7XHJcblx0XHRcdCdjbGFzcyc6ICdtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9pbmZvX291dGxpbmUnLFxyXG5cdFx0XHQnYXJpYS1oaWRkZW4nOiAndHJ1ZSdcclxuXHRcdH0gKSApO1xyXG5cdFx0JG5vdGUuYXBwZW5kKCBqUXVlcnkoICc8c3Bhbj4nICkudGV4dCggX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX3JhbmdlX3NlbGVjdGlvbl9jbGlja19sYXN0X2RhdGUnICkgKSApO1xyXG5cdFx0JGNhbGVuZGFyX2ZyYW1lLmFmdGVyKCAkbm90ZSApO1xyXG5cclxuXHRcdHJldHVybiAkbm90ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgdGhlIHJhbmdlLWd1aWRhbmNlIGFuaW1hdGlvbiBkdXJhdGlvbiBmb3IgdGhlIGN1cnJlbnQgbW90aW9uIHByZWZlcmVuY2UuXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7bnVtYmVyfSBBbmltYXRpb24gZHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzLCBvciB6ZXJvIHdoZW4gcmVkdWNlZCBtb3Rpb24gaXMgcHJlZmVycmVkLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19nZXRfZ3VpZGFuY2VfYW5pbWF0aW9uX2R1cmF0aW9uKCl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQnZnVuY3Rpb24nID09PSB0eXBlb2Ygd2luZG93Lm1hdGNoTWVkaWFcclxuXHRcdFx0JiYgd2luZG93Lm1hdGNoTWVkaWEoICcocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjogcmVkdWNlKScgKS5tYXRjaGVzXHJcblx0XHQpIHtcclxuXHRcdFx0cmV0dXJuIDA7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIDE2MDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBDb2xsYXBzZSB0aGUgcmFuZ2Utc2VsZWN0aW9uIGd1aWRhbmNlIHNvIGl0IGRvZXMgbm90IHJlc2VydmUgZW1wdHkgbGF5b3V0IHNwYWNlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19oaWRlX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGpRdWVyeSggJyN3cGJjX3JhbmdlX3NlbGVjdGlvbl9ndWlkYW5jZScgKyByZXNvdXJjZV9pZCApXHJcblx0XHRcdC5hdHRyKCAnYXJpYS1oaWRkZW4nLCAndHJ1ZScgKVxyXG5cdFx0XHQuc3RvcCggdHJ1ZSwgdHJ1ZSApXHJcblx0XHRcdC5zbGlkZVVwKCB3cGJjX3JhbmdlX3NlbGVjdGlvbl9fZ2V0X2d1aWRhbmNlX2FuaW1hdGlvbl9kdXJhdGlvbigpICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2hvdyB0aGUgcHJlcGFyZWQgaW5mb3JtYXRpb25hbCBub3RlIGFmdGVyIHRoZSBmaXJzdCByYW5nZSBjbGljay5cclxuXHQgKiBUaGUgY2FsZW5kYXIgcGFyYW1ldGVyIGNhbiBiZSBzZXQgdG8gZmFsc2UgYnkgUEhQIG9yIEphdmFTY3JpcHQgdG8gc3VwcHJlc3MgdGhpcyBVSSBwZXIgcmVzb3VyY2UuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgd2hlbiB0aGUgbm90ZSB3YXMgc2hvd24uXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19yYW5nZV9zZWxlY3Rpb25fX3Nob3dfZ3VpZGFuY2UoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyICRub3RlID0gd3BiY19yYW5nZV9zZWxlY3Rpb25fX3ByZXBhcmVfZ3VpZGFuY2UoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0aWYgKCAwID09PSAkbm90ZS5sZW5ndGggKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQkbm90ZVxyXG5cdFx0XHQuc3RvcCggdHJ1ZSwgdHJ1ZSApXHJcblx0XHRcdC5zbGlkZURvd24oIHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19nZXRfZ3VpZGFuY2VfYW5pbWF0aW9uX2R1cmF0aW9uKCkgKVxyXG5cdFx0XHQucmVtb3ZlQXR0ciggJ2FyaWEtaGlkZGVuJyApO1xyXG5cdFx0JG5vdGUuZmluZCggJ3NwYW4nICkudGV4dCggX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX3JhbmdlX3NlbGVjdGlvbl9jbGlja19sYXN0X2RhdGUnICkgKTtcclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTeW5jaHJvbml6ZSB0aGUgZ3VpZGFuY2Ugd2l0aCBEYXRlcGljaydzIHR3by1jbGljayByYW5nZSBzdGF0ZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX3JhbmdlX3NlbGVjdGlvbl9fc3luY19ndWlkYW5jZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgbnVsbCAhPT0gaW5zdFxyXG5cdFx0XHQmJiAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKVxyXG5cdFx0XHQmJiB0cnVlID09PSBpbnN0LnN0YXlPcGVuXHJcblx0XHRcdCYmIDEgPT09IGluc3QuZGF0ZXMubGVuZ3RoXHJcblx0XHRcdCYmIGluc3QuZGF0ZXNbIDAgXVxyXG5cdFx0KSB7XHJcblx0XHRcdHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19zaG93X2d1aWRhbmNlKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblxyXG5cdFx0d3BiY19yYW5nZV9zZWxlY3Rpb25fX2hpZGVfZ3VpZGFuY2UoIHJlc291cmNlX2lkICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2VsZWN0IGNhbGVuZGFyIGRhdGUgY2VsbHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdFx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMFxyXG5cdCAqICAgICBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHRcdFx0XHRcdFx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXHRcdFx0XHRcdFx0XCJyZXNvdXJjZV9pZFwiOiA0XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHRcdFx0XHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX29uX3NlbGVjdF9kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0dmFyIHJlc291cmNlX2lkID0gKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSkgKSA/IGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSA6ICcxJztcdFx0Ly8gJzEnXHJcblxyXG5cdFx0Ly8gU2V0IHVuc2VsZWN0YWJsZSwgIGlmIG9ubHkgQXZhaWxhYmlsaXR5IENhbGVuZGFyICBoZXJlIChhbmQgd2UgZG8gbm90IGluc2VydCBCb29raW5nIGZvcm0gYnkgbWlzdGFrZSkuXHJcblx0XHR2YXIgaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyID0gKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZ191bnNlbGVjdGFibGUnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwKTtcdFx0XHRcdC8vIEZpeEluOiA4LjAuMS4yLlxyXG5cdFx0dmFyIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCAgICA9ICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICk7XHJcblx0XHRpZiAoICggaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyICkgJiYgKCAhIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCApICl7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFVuc2VsZWN0IERhdGVzXHJcblx0XHRcdGpRdWVyeSgnLndwYmNfb25seV9jYWxlbmRhciAucG9wb3Zlcl9jYWxlbmRhcl9ob3ZlcicpLnJlbW92ZSgpOyAgICAgICAgICAgICAgICAgICAgICBcdFx0XHRcdFx0XHRcdC8vIEhpZGUgYWxsIG9wZW5lZCBwb3BvdmVyc1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQWRkIHNlbGVjdGVkIGRhdGVzIHRvICBoaWRkZW4gdGV4dGFyZWFcclxuXHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMpICkge1xyXG5cdFx0XHR3cGJjX19jYWxlbmRhcl9fZG9fZGF5c19zZWxlY3RfX2JzKCBkYXRlLCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fSBlbHNlIGlmICggJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKSB7XHJcblx0XHRcdHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fdW5yZXN0cmljdGVkX3JhbmdlKCBkYXRlLCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19zeW5jX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdHdwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gSG9vayAtLSB0cmlnZ2VyIGRheSBzZWxlY3Rpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBtb3VzZV9jbGlja2VkX2RhdGVzID0gZGF0ZTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIENhbiBiZTogXCIwNS4xMC4yMDIzIC0gMDcuMTAuMjAyM1wiICB8ICBcIjEwLjEwLjIwMjMgLSAxMC4xMC4yMDIzXCIgIHxcclxuXHRcdHZhciBhbGxfc2VsZWN0ZWRfZGF0ZXNfYXJyID0gd3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCByZXNvdXJjZV9pZCApO1x0XHRcdFx0XHRcdFx0XHRcdC8vIENhbiBiZTogWyBcIjIwMjMtMTAtMDVcIiwgXCIyMDIzLTEwLTA2XCIsIFwiMjAyMy0xMC0wN1wiLCDigKYgXVxyXG5cdFx0alF1ZXJ5KCBcIi5ib29raW5nX2Zvcm1fZGl2XCIgKS50cmlnZ2VyKCBcImRhdGVfc2VsZWN0ZWRcIiwgWyByZXNvdXJjZV9pZCwgbW91c2VfY2xpY2tlZF9kYXRlcywgYWxsX3NlbGVjdGVkX2RhdGVzX2FyciBdICk7XHJcblx0fVxyXG5cclxuXHQvLyBNYXJrIG1pZGRsZSBzZWxlY3RlZCBkYXRlcyB3aXRoIDAuNSBvcGFjaXR5XHRcdC8vIEZpeEluOiAxMC4zLjAuOS5cclxuXHRqUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cdFx0alF1ZXJ5KCBcIi5ib29raW5nX2Zvcm1fZGl2XCIgKS5vbiggJ2RhdGVfc2VsZWN0ZWQnLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgZGF0ZSApe1xyXG5cdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCAgICggICdmaXhlZCcgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSlcclxuXHRcdFx0XHRcdHx8ICgnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSlcclxuXHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHR2YXIgbWlkZGxlX2RheXNfb3BhY2l0eSA9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2NhbGVuZGFyc19fZGF5c19zZWxlY3Rpb25fX21pZGRsZV9kYXlzX29wYWNpdHknICk7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyAuZGF0ZXBpY2stY3VycmVudC1kYXknICkubm90KCBcIi5zZWxlY3RlZF9jaGVja19pbl9vdXRcIiApLmNzcyggJ29wYWNpdHknLCBtaWRkbGVfZGF5c19vcGFjaXR5ICk7XHJcblx0XHRcdFx0XHR9LCAxMCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9ICk7XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAtLSAgVCBpIG0gZSAgICBGIGkgZSBsIGQgcyAgICAgc3RhcnQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIERpc2FibGUgdGltZSBzbG90cyBpbiBib29raW5nIGZvcm0gZGVwZW5kIG9uIHNlbGVjdGVkIGRhdGVzIGFuZCBib29rZWQgZGF0ZXMvdGltZXNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBcdDEuIEdldCBhbGwgdGltZSBmaWVsZHMgaW4gdGhlIGJvb2tpbmcgZm9ybSBhcyBhcnJheSAgb2Ygb2JqZWN0c1xyXG5cdFx0ICogXHRcdFx0XHRcdFtcclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwLCAyMzQwMCBdXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHRcdCAqIFx0XHRcdFx0XHQgIC4uLlxyXG5cdFx0ICogXHRcdFx0XHRcdFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCBdXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdCAqL1xyXG5cdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSB3cGJjX2dldF9fdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIDIuIEdldCBhbGwgc2VsZWN0ZWQgZGF0ZXMgaW4gIFNRTCBmb3JtYXQgIGxpa2UgdGhpcyBbIFwiMjAyMy0wOC0yM1wiLCBcIjIwMjMtMDgtMjRcIiwgXCIyMDIzLTA4LTI1XCIsIC4uLiBdXHJcblx0XHR2YXIgc2VsZWN0ZWRfZGF0ZXNfYXJyID0gd3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIDMuIEdldCBjaGlsZCBib29raW5nIHJlc291cmNlcyAgb3Igc2luZ2xlIGJvb2tpbmcgcmVzb3VyY2UgIHRoYXQgIGV4aXN0ICBpbiBkYXRlc1xyXG5cdFx0dmFyIGNoaWxkX3Jlc291cmNlc19hcnIgPSB3cGJjX2Nsb25lX29iaiggX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyApICk7XHJcblxyXG5cdFx0dmFyIHNxbF9kYXRlO1xyXG5cdFx0dmFyIGNoaWxkX3Jlc291cmNlX2lkO1xyXG5cdFx0dmFyIG1lcmdlZF9zZWNvbmRzO1xyXG5cdFx0dmFyIHRpbWVfZmllbGRzX29iajtcclxuXHRcdHZhciBpc19pbnRlcnNlY3Q7XHJcblx0XHR2YXIgaXNfY2hlY2tfaW47XHJcblxyXG5cdFx0dmFyIHRvZGF5X3RpbWVfX3JlYWwgID0gbmV3IERhdGUoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzBdLCAoIHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsxXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzJdLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVszXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbNF0sIDAgKTtcclxuXHRcdHZhciB0b2RheV90aW1lX19zaGlmdCA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVswXSwgKCBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAgICAgICd0b2RheV9hcnInIClbMV0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVsyXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbM10sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgICAgICApWzRdLCAwICk7XHJcblx0XHR2YXIgYWxsb3dfcGFzdF9jb250ZXh0ID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2FsbG93X3Bhc3QnICk7XHJcblx0XHR2YXIgZWRpdF9ib29raW5nX2hhc2hfY29udGV4dCA9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9ib29raW5nX2hhc2gnICk7XHJcblx0XHR2YXIgaXNfYWxsb3dfcGFzdF9jb250ZXh0ID1cclxuXHRcdFx0ICAgKCAnMScgPT09IFN0cmluZyggYWxsb3dfcGFzdF9jb250ZXh0ICkgKVxyXG5cdFx0XHR8fCAoIDEgPT09IGFsbG93X3Bhc3RfY29udGV4dCApXHJcblx0XHRcdHx8ICggdHJ1ZSA9PT0gYWxsb3dfcGFzdF9jb250ZXh0IClcclxuXHRcdFx0fHwgKCAnJyAhPT0gU3RyaW5nKCBlZGl0X2Jvb2tpbmdfaGFzaF9jb250ZXh0IHx8ICcnICkgKVxyXG5cdFx0XHR8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ2Jvb2tpbmdfaGFzaCcgKSA+IC0xIClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdhbGxvd19wYXN0JyApID4gLTEgKTtcclxuXHJcblx0XHQvLyA0LiBMb29wICBhbGwgIHRpbWUgRmllbGRzIG9wdGlvbnNcdFx0Ly8gRml4SW46IDEwLjMuMC4yLlxyXG5cdFx0Zm9yICggbGV0IGZpZWxkX2tleSA9IDA7IGZpZWxkX2tleSA8IHRpbWVfZmllbGRzX29ial9hcnIubGVuZ3RoOyBmaWVsZF9rZXkrKyApe1xyXG5cclxuXHRcdFx0dGltZV9maWVsZHNfb2JqX2FyclsgZmllbGRfa2V5IF0uZGlzYWJsZWQgPSAwOyAgICAgICAgICAvLyBCeSBkZWZhdWx0LCB0aGlzIHRpbWUgZmllbGQgaXMgbm90IGRpc2FibGVkLlxyXG5cclxuXHRcdFx0dGltZV9maWVsZHNfb2JqID0gdGltZV9maWVsZHNfb2JqX2FyclsgZmllbGRfa2V5IF07XHRcdC8vIHsgdGltZXNfYXNfc2Vjb25kczogWyAyMTYwMCwgMjM0MDAgXSwgdmFsdWVfb3B0aW9uXzI0aDogJzA2OjAwIC0gMDY6MzAnLCBuYW1lOiAncmFuZ2V0aW1lMltdJywganF1ZXJ5X29wdGlvbjogalF1ZXJ5X09iamVjdCB7fX1cclxuXHJcblx0XHRcdC8vIExvb3AgIGFsbCAgc2VsZWN0ZWQgZGF0ZXMuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGg7IGkrKyApIHtcclxuXHJcblx0XHRcdFx0Ly8gR2V0IERhdGU6ICcyMDIzLTA4LTE4Jy5cclxuXHRcdFx0XHRzcWxfZGF0ZSA9IHNlbGVjdGVkX2RhdGVzX2FycltpXTtcclxuXHJcblx0XHRcdFx0dmFyIGlzX3RpbWVfaW5fcGFzdCA9IGlzX2FsbG93X3Bhc3RfY29udGV4dCA/IGZhbHNlIDogd3BiY19jaGVja19pc190aW1lX2luX3Bhc3QoIHRvZGF5X3RpbWVfX3NoaWZ0LCBzcWxfZGF0ZSwgdGltZV9maWVsZHNfb2JqICk7XHJcblx0XHRcdFx0Ly8gRXhjZXB0aW9uICBmb3IgJ0VuZCBUaW1lJyBmaWVsZCwgIHdoZW4gIHNlbGVjdGVkIHNldmVyYWwgZGF0ZXMuIC8vIEZpeEluOiAxMC4xNC4xLjUuXHJcblx0XHRcdFx0aWYgKCAoICEgaXNfYWxsb3dfcGFzdF9jb250ZXh0ICkgJiZcclxuXHRcdFx0XHRcdCgnT24nICE9PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2Jvb2tpbmdfcmVjdXJyZW50X3RpbWUnICkpICYmXHJcblx0XHRcdFx0XHQoLTEgIT09IHRpbWVfZmllbGRzX29iai5uYW1lLmluZGV4T2YoICdlbmR0aW1lJyApKSAmJlxyXG5cdFx0XHRcdFx0KHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGggPiAxKVxyXG5cdFx0XHRcdCkge1xyXG5cdFx0XHRcdFx0aXNfdGltZV9pbl9wYXN0ID0gd3BiY19jaGVja19pc190aW1lX2luX3Bhc3QoIHRvZGF5X3RpbWVfX3NoaWZ0LCBzZWxlY3RlZF9kYXRlc19hcnJbKHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGggLSAxKV0sIHRpbWVfZmllbGRzX29iaiApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGlzX3RpbWVfaW5fcGFzdCApIHtcclxuXHRcdFx0XHRcdC8vIFRoaXMgdGltZSBmb3Igc2VsZWN0ZWQgZGF0ZSBhbHJlYWR5ICBpbiB0aGUgcGFzdC5cclxuXHRcdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnJbZmllbGRfa2V5XS5kaXNhYmxlZCA9IDE7XHJcblx0XHRcdFx0XHRicmVhaztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gZXhpc3QgIGZyb20gICBEYXRlcyBMT09QLlxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzEuXHJcblx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0ICAgKCAnT2ZmJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3JlY3VycmVudF90aW1lJyApIClcclxuXHRcdFx0XHRcdCYmICggc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aD4xIClcclxuXHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0Ly9UT0RPOiBza2lwIHNvbWUgZmllbGRzIGNoZWNraW5nIGlmIGl0J3Mgc3RhcnQgLyBlbmQgdGltZSBmb3IgbXVscGxlIGRhdGVzICBzZWxlY3Rpb24gIG1vZGUuXHJcblx0XHRcdFx0XHQvL1RPRE86IHdlIG5lZWQgdG8gZml4IHNpdHVhdGlvbiAgZm9yIGVudGltZXMsICB3aGVuICB1c2VyICBzZWxlY3QgIHNldmVyYWwgIGRhdGVzLCAgYW5kIGluIHN0YXJ0ICB0aW1lIGJvb2tlZCAwMDowMCAtIDE1OjAwICwgYnV0IHN5c3RzbWUgYmxvY2sgdW50aWxsIDE1OjAwIHRoZSBlbmQgdGltZSBhcyB3ZWxsLCAgd2hpY2ggIGlzIHdyb25nLCAgYmVjYXVzZSBpdCAyIG9yIDMgZGF0ZXMgc2VsZWN0aW9uICBhbmQgZW5kIGRhdGUgY2FuIGJlIGZ1bGx1ICBhdmFpbGFibGVcclxuXHJcblx0XHRcdFx0XHRpZiAoICgwID09IGkpICYmICh0aW1lX2ZpZWxkc19vYmpbICduYW1lJyBdLmluZGV4T2YoICdlbmR0aW1lJyApID49IDApICl7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCAoIChzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoLTEpID09IGkgKSAmJiAodGltZV9maWVsZHNfb2JqWyAnbmFtZScgXS5pbmRleE9mKCAnc3RhcnR0aW1lJyApID49IDApICl7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblxyXG5cclxuXHRcdFx0XHR2YXIgaG93X21hbnlfcmVzb3VyY2VzX2ludGVyc2VjdGVkID0gMDtcclxuXHRcdFx0XHQvLyBMb29wIGFsbCByZXNvdXJjZXMgSURcclxuXHRcdFx0XHRcdC8vIGZvciAoIHZhciByZXNfa2V5IGluIGNoaWxkX3Jlc291cmNlc19hcnIgKXtcdCBcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMy4wLjIuXHJcblx0XHRcdFx0aWYgKCBudWxsID09PSBjaGlsZF9yZXNvdXJjZXNfYXJyICkge1xyXG5cdFx0XHRcdFx0Y2hpbGRfcmVzb3VyY2VzX2FyciA9IFtdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRmb3IgKCBsZXQgcmVzX2tleSA9IDA7IHJlc19rZXkgPCBjaGlsZF9yZXNvdXJjZXNfYXJyLmxlbmd0aDsgcmVzX2tleSsrICl7XHJcblxyXG5cdFx0XHRcdFx0Y2hpbGRfcmVzb3VyY2VfaWQgPSBjaGlsZF9yZXNvdXJjZXNfYXJyWyByZXNfa2V5IF07XHJcblxyXG5cdFx0XHRcdFx0Ly8gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzXHRcdD0gWyBcIjA3OjAwOjExIC0gMDc6MzA6MDJcIiwgXCIxMDowMDoxMSAtIDAwOjAwOjAwXCIgXVxyXG5cdFx0XHRcdFx0Ly8gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHNcdFx0XHQ9IFsgIFsgMjUyMTEsIDI3MDAyIF0sIFsgMzYwMTEsIDg2NDAwIF0gIF1cclxuXHJcblx0XHRcdFx0XHRpZiAoIGZhbHNlICE9PSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2RhdGUgKSApe1xyXG5cdFx0XHRcdFx0XHRtZXJnZWRfc2Vjb25kcyA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSApWyBjaGlsZF9yZXNvdXJjZV9pZCBdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzO1x0XHQvLyBbICBbIDI1MjExLCAyNzAwMiBdLCBbIDM2MDExLCA4NjQwMCBdICBdXHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRtZXJnZWRfc2Vjb25kcyA9IFtdO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcy5sZW5ndGggPiAxICl7XHJcblx0XHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHdwYmNfaXNfaW50ZXJzZWN0X19yYW5nZV90aW1lX2ludGVydmFsKCAgW1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KCBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHNbMF0gKSArIDIwICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KCBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHNbMV0gKSAtIDIwIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBtZXJnZWRfc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0aXNfY2hlY2tfaW4gPSAoLTEgIT09IHRpbWVfZmllbGRzX29iai5uYW1lLmluZGV4T2YoICdzdGFydCcgKSk7XHJcblx0XHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHdwYmNfaXNfaW50ZXJzZWN0X19vbmVfdGltZV9pbnRlcnZhbChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCggKCBpc19jaGVja19pbiApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgID8gcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgKyAyMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA6IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApIC0gMjBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgbWVyZ2VkX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmIChpc19pbnRlcnNlY3Qpe1xyXG5cdFx0XHRcdFx0XHRob3dfbWFueV9yZXNvdXJjZXNfaW50ZXJzZWN0ZWQrKztcdFx0XHQvLyBJbmNyZWFzZVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggY2hpbGRfcmVzb3VyY2VzX2Fyci5sZW5ndGggPT0gaG93X21hbnlfcmVzb3VyY2VzX2ludGVyc2VjdGVkICkge1xyXG5cdFx0XHRcdFx0Ly8gQWxsIHJlc291cmNlcyBpbnRlcnNlY3RlZCwgIHRoZW4gIGl0J3MgbWVhbnMgdGhhdCB0aGlzIHRpbWUtc2xvdCBvciB0aW1lIG11c3QgIGJlICBEaXNhYmxlZCwgYW5kIHdlIGNhbiAgZXhpc3QgIGZyb20gICBzZWxlY3RlZF9kYXRlc19hcnIgTE9PUFxyXG5cclxuXHRcdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnJbIGZpZWxkX2tleSBdLmRpc2FibGVkID0gMTtcclxuXHRcdFx0XHRcdGJyZWFrO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBleGlzdCAgZnJvbSAgIERhdGVzIExPT1BcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gNS4gTm93IHdlIGNhbiBkaXNhYmxlIHRpbWUgc2xvdCBpbiBIVE1MIGJ5ICB1c2luZyAgKCBmaWVsZC5kaXNhYmxlZCA9PSAxICkgcHJvcGVydHlcclxuXHRcdHdwYmNfX2h0bWxfX3RpbWVfZmllbGRfb3B0aW9uc19fc2V0X2Rpc2FibGVkKCB0aW1lX2ZpZWxkc19vYmpfYXJyICk7XHJcblxyXG5cdFx0alF1ZXJ5KCBcIi5ib29raW5nX2Zvcm1fZGl2XCIgKS50cmlnZ2VyKCAnd3BiY19ob29rX3RpbWVzbG90c19kaXNhYmxlZCcsIFtyZXNvdXJjZV9pZCwgc2VsZWN0ZWRfZGF0ZXNfYXJyXSApO1x0XHRcdFx0XHQvLyBUcmlnZ2VyIGhvb2sgb24gZGlzYWJsaW5nIHRpbWVzbG90cy5cdFx0VXNhZ2U6IFx0alF1ZXJ5KCBcIi5ib29raW5nX2Zvcm1fZGl2XCIgKS5vbiggJ3dwYmNfaG9va190aW1lc2xvdHNfZGlzYWJsZWQnLCBmdW5jdGlvbiAoIGV2ZW50LCBia190eXBlLCBhbGxfZGF0ZXMgKXsgLi4uIH0gKTtcdFx0Ly8gRml4SW46IDguNy4xMS45LlxyXG5cdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBDaGVjayBpZiBzcGVjaWZpYyB0aW1lKC1zbG90KSBhbHJlYWR5ICBpbiB0aGUgcGFzdCBmb3Igc2VsZWN0ZWQgZGF0ZVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2tcdFx0LSBKUyBEYXRlXHJcblx0XHQgKiBAcGFyYW0gc3FsX2RhdGVcdFx0XHRcdFx0XHQtICcyMDI1LTAxLTI2J1xyXG5cdFx0ICogQHBhcmFtIHRpbWVfZmllbGRzX29ialx0XHRcdFx0LSBPYmplY3RcclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2NoZWNrX2lzX3RpbWVfaW5fcGFzdCgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLCBzcWxfZGF0ZSwgdGltZV9maWVsZHNfb2JqICkge1xyXG5cclxuXHRcdFx0Ly8gRml4SW46IDEwLjkuNi40XHJcblx0XHRcdHZhciBzcWxfZGF0ZV9hcnIgPSBzcWxfZGF0ZS5zcGxpdCggJy0nICk7XHJcblx0XHRcdHZhciBzcWxfZGF0ZV9fbWlkbmlnaHQgPSBuZXcgRGF0ZSggcGFyc2VJbnQoIHNxbF9kYXRlX2FyclswXSApLCAoIHBhcnNlSW50KCBzcWxfZGF0ZV9hcnJbMV0gKSAtIDEgKSwgcGFyc2VJbnQoIHNxbF9kYXRlX2FyclsyXSApLCAwLCAwLCAwICk7XHJcblx0XHRcdHZhciBzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgPSBzcWxfZGF0ZV9fbWlkbmlnaHQuZ2V0VGltZSgpO1xyXG5cclxuXHRcdFx0dmFyIGlzX2ludGVyc2VjdCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0aWYgKCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcy5sZW5ndGggPiAxICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIGpzX2N1cnJlbnRfdGltZV90b19jaGVjay5nZXRUaW1lKCkgPiAoc3FsX2RhdGVfX21pZG5pZ2h0X21pbGlzZWNvbmRzICsgKHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1swXSApICsgMjApICogMTAwMCkgKSB7XHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGpzX2N1cnJlbnRfdGltZV90b19jaGVjay5nZXRUaW1lKCkgPiAoc3FsX2RhdGVfX21pZG5pZ2h0X21pbGlzZWNvbmRzICsgKHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1sxXSApIC0gMjApICogMTAwMCkgKSB7XHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dmFyIGlzX2NoZWNrX2luID0gKC0xICE9PSB0aW1lX2ZpZWxkc19vYmoubmFtZS5pbmRleE9mKCAnc3RhcnQnICkpO1xyXG5cclxuXHRcdFx0XHR2YXIgdGltZXNfYXNfc2Vjb25kc19jaGVjayA9IChpc19jaGVja19pbikgPyBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSArIDIwIDogcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgLSAyMDtcclxuXHJcblx0XHRcdFx0dGltZXNfYXNfc2Vjb25kc19jaGVjayA9IHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyArIHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgKiAxMDAwO1xyXG5cclxuXHRcdFx0XHRpZiAoIGpzX2N1cnJlbnRfdGltZV90b19jaGVjay5nZXRUaW1lKCkgPiB0aW1lc19hc19zZWNvbmRzX2NoZWNrICkge1xyXG5cdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBpc19pbnRlcnNlY3Q7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJcyBudW1iZXIgaW5zaWRlIC9pbnRlcnNlY3QgIG9mIGFycmF5IG9mIGludGVydmFscyA/XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHRpbWVfQVx0XHQgICAgIFx0LSAyNTgwMFxyXG5cdFx0ICogQHBhcmFtIHRpbWVfaW50ZXJ2YWxfQlx0XHQtIFsgIFsgMjUyMTEsIDI3MDAyIF0sIFsgMzYwMTEsIDg2NDAwIF0gIF1cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2lzX2ludGVyc2VjdF9fb25lX3RpbWVfaW50ZXJ2YWwoIHRpbWVfQSwgdGltZV9pbnRlcnZhbF9CICl7XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX2ludGVydmFsX0IubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0aWYgKCAocGFyc2VJbnQoIHRpbWVfQSApID4gcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAwIF0gKSkgJiYgKHBhcnNlSW50KCB0aW1lX0EgKSA8IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMSBdICkpICl7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gaWYgKCAoIHBhcnNlSW50KCB0aW1lX0EgKSA9PSBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDAgXSApICkgfHwgKCBwYXJzZUludCggdGltZV9BICkgPT0gcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAxIF0gKSApICkge1xyXG5cdFx0XHRcdC8vIFx0XHRcdC8vIFRpbWUgQSBqdXN0ICBhdCAgdGhlIGJvcmRlciBvZiBpbnRlcnZhbFxyXG5cdFx0XHRcdC8vIH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdCAgICByZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJcyB0aGVzZSBhcnJheSBvZiBpbnRlcnZhbHMgaW50ZXJzZWN0ZWQgP1xyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB0aW1lX2ludGVydmFsX0FcdFx0LSBbIFsgMjE2MDAsIDIzNDAwIF0gXVxyXG5cdFx0ICogQHBhcmFtIHRpbWVfaW50ZXJ2YWxfQlx0XHQtIFsgIFsgMjUyMTEsIDI3MDAyIF0sIFsgMzYwMTEsIDg2NDAwIF0gIF1cclxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2lzX2ludGVyc2VjdF9fcmFuZ2VfdGltZV9pbnRlcnZhbCggdGltZV9pbnRlcnZhbF9BLCB0aW1lX2ludGVydmFsX0IgKXtcclxuXHJcblx0XHRcdHZhciBpc19pbnRlcnNlY3Q7XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aW1lX2ludGVydmFsX0EubGVuZ3RoOyBpKysgKXtcclxuXHJcblx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9pbnRlcnZhbF9CLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pbnRlcnZhbHNfX2lzX2ludGVyc2VjdGVkKCB0aW1lX2ludGVydmFsX0FbIGkgXSwgdGltZV9pbnRlcnZhbF9CWyBqIF0gKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoIGlzX2ludGVyc2VjdCApe1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCBhbGwgdGltZSBmaWVsZHMgaW4gdGhlIGJvb2tpbmcgZm9ybSBhcyBhcnJheSAgb2Ygb2JqZWN0c1xyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICogQHJldHVybnMgW11cclxuXHRcdCAqXHJcblx0XHQgKiBcdFx0RXhhbXBsZTpcclxuXHRcdCAqIFx0XHRcdFx0XHRbXHJcblx0XHQgKiBcdFx0XHRcdFx0IFx0ICAge1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwLCAyMzQwMCBdXHJcblx0XHQgKiBcdFx0XHRcdFx0IFx0ICAgXHRcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHRcdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHRcdCAqIFx0XHRcdFx0XHQgIC4uLlxyXG5cdFx0ICogXHRcdFx0XHRcdFx0ICAge1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCBdXHJcblx0XHQgKiBcdFx0XHRcdFx0XHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdFx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCBdXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X190aW1lX2ZpZWxkc19faW5fYm9va2luZ19mb3JtX19hc19hcnIoIHJlc291cmNlX2lkICl7XHJcblx0XHQgICAgLyoqXHJcblx0XHRcdCAqIEZpZWxkcyB3aXRoICBbXSAgbGlrZSB0aGlzICAgc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUxW11cIl1cclxuXHRcdFx0ICogaXQncyB3aGVuIHdlIGhhdmUgJ211bHRpcGxlJyBpbiBzaG9ydGNvZGU6ICAgW3NlbGVjdCogcmFuZ2V0aW1lIG11bHRpcGxlICBcIjA2OjAwIC0gMDY6MzBcIiAuLi4gXVxyXG5cdFx0XHQgKi9cclxuXHRcdFx0dmFyIHRpbWVfZmllbGRzX2Fycj1bXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XTtcclxuXHJcblx0XHRcdHZhciB0aW1lX2ZpZWxkc19vYmpfYXJyID0gW107XHJcblxyXG5cdFx0XHQvLyBMb29wIGFsbCBUaW1lIEZpZWxkc1xyXG5cdFx0XHRmb3IgKCB2YXIgY3RmPSAwOyBjdGYgPCB0aW1lX2ZpZWxkc19hcnIubGVuZ3RoOyBjdGYrKyApe1xyXG5cclxuXHRcdFx0XHR2YXIgdGltZV9maWVsZCA9IHRpbWVfZmllbGRzX2FyclsgY3RmIF07XHJcblx0XHRcdFx0dmFyIHRpbWVfb3B0aW9uID0galF1ZXJ5KCB0aW1lX2ZpZWxkICsgJyBvcHRpb24nICk7XHJcblxyXG5cdFx0XHRcdC8vIExvb3AgYWxsIG9wdGlvbnMgaW4gdGltZSBmaWVsZFxyXG5cdFx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfb3B0aW9uLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfZmllbGQgKyAnIG9wdGlvbjplcSgnICsgaiArICcpJyApO1xyXG5cdFx0XHRcdFx0dmFyIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyciA9IGpxdWVyeV9vcHRpb24udmFsKCkuc3BsaXQoICctJyApO1xyXG5cdFx0XHRcdFx0dmFyIHRpbWVzX2FzX3NlY29uZHMgPSBbXTtcclxuXHJcblx0XHRcdFx0XHQvLyBHZXQgdGltZSBhcyBzZWNvbmRzXHJcblx0XHRcdFx0XHRpZiAoIHZhbHVlX29wdGlvbl9zZWNvbmRzX2Fyci5sZW5ndGggKXtcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHZhbHVlX29wdGlvbl9zZWNvbmRzX2Fyci5sZW5ndGg7IGkrKyApe1x0XHQvLyBGaXhJbjogMTAuMC4wLjU2LlxyXG5cdFx0XHRcdFx0XHRcdC8vIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FycltpXSA9ICcxNDowMCAnICB8ICcgMTY6MDAnICAgKGlmIGZyb20gJ3JhbmdldGltZScpIGFuZCAnMTY6MDAnICBpZiAoc3RhcnQvZW5kIHRpbWUpXHJcblxyXG5cdFx0XHRcdFx0XHRcdHZhciBzdGFydF9lbmRfdGltZXNfYXJyID0gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyWyBpIF0udHJpbSgpLnNwbGl0KCAnOicgKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0dmFyIHRpbWVfaW5fc2Vjb25kcyA9IHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAwIF0gKSAqIDYwICogNjAgKyBwYXJzZUludCggc3RhcnRfZW5kX3RpbWVzX2FyclsgMSBdICkgKiA2MDtcclxuXHJcblx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kcy5wdXNoKCB0aW1lX2luX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgICAgICAgICAgICA6IGpRdWVyeSggdGltZV9maWVsZCApLmF0dHIoICduYW1lJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWVfb3B0aW9uXzI0aCc6IGpxdWVyeV9vcHRpb24udmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcXVlcnlfb3B0aW9uJyAgIDoganF1ZXJ5X29wdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0aW1lc19hc19zZWNvbmRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gdGltZV9maWVsZHNfb2JqX2FycjtcclxuXHRcdH1cclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBEaXNhYmxlIEhUTUwgb3B0aW9ucyBhbmQgYWRkIGJvb2tlZCBDU1MgY2xhc3NcclxuXHRcdFx0ICpcclxuXHRcdFx0ICogQHBhcmFtIHRpbWVfZmllbGRzX29ial9hcnIgICAgICAtIHRoaXMgdmFsdWUgaXMgZnJvbSAgdGhlIGZ1bmM6XHJcblx0XHRcdCAqICAgICBcdHdwYmNfZ2V0X190aW1lX2ZpZWxkc19faW5fYm9va2luZ19mb3JtX19hc19hcnIoIHJlc291cmNlX2lkIClcclxuXHRcdFx0ICogXHRcdFx0XHRcdFtcclxuXHRcdFx0ICogXHRcdFx0XHRcdCBcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwLCAyMzQwMCBdXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCAtIDA2OjMwJ1xyXG5cdFx0XHQgKiBcdCAgXHRcdFx0XHRcdFx0ICAgIGRpc2FibGVkID0gMVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgIC4uLlxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCBdXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCdcclxuXHRcdFx0ICogICBcdFx0XHRcdFx0XHRcdGRpc2FibGVkID0gMFxyXG5cdFx0XHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgXVxyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0ZnVuY3Rpb24gd3BiY19faHRtbF9fdGltZV9maWVsZF9vcHRpb25zX19zZXRfZGlzYWJsZWQoIHRpbWVfZmllbGRzX29ial9hcnIgKXtcclxuXHJcblx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb247XHJcblxyXG5cdFx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHRpbWVfZmllbGRzX29ial9hcnIubGVuZ3RoOyBpKysgKXtcclxuXHJcblx0XHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbiA9IHRpbWVfZmllbGRzX29ial9hcnJbIGkgXS5qcXVlcnlfb3B0aW9uO1xyXG5cclxuXHRcdFx0XHRcdGlmICggMSA9PSB0aW1lX2ZpZWxkc19vYmpfYXJyWyBpIF0uZGlzYWJsZWQgKXtcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5wcm9wKCAnZGlzYWJsZWQnLCB0cnVlICk7IFx0XHQvLyBNYWtlIGRpc2FibGUgc29tZSBvcHRpb25zXHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24uYWRkQ2xhc3MoICdib29rZWQnICk7ICAgICAgICAgICBcdC8vIEFkZCBcImJvb2tlZFwiIENTUyBjbGFzc1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gaWYgdGhpcyBib29rZWQgZWxlbWVudCBzZWxlY3RlZCAtLT4gdGhlbiBkZXNlbGVjdCAgaXRcclxuXHRcdFx0XHRcdFx0aWYgKCBqcXVlcnlfb3B0aW9uLnByb3AoICdzZWxlY3RlZCcgKSApe1xyXG5cdFx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucHJvcCggJ3NlbGVjdGVkJywgZmFsc2UgKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5wYXJlbnQoKS5maW5kKCAnb3B0aW9uOm5vdChbZGlzYWJsZWRdKTpmaXJzdCcgKS5wcm9wKCAnc2VsZWN0ZWQnLCB0cnVlICkudHJpZ2dlciggXCJjaGFuZ2VcIiApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5wcm9wKCAnZGlzYWJsZWQnLCBmYWxzZSApOyAgXHRcdC8vIE1ha2UgYWN0aXZlIGFsbCB0aW1lc1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnJlbW92ZUNsYXNzKCAnYm9va2VkJyApOyAgIFx0XHQvLyBSZW1vdmUgY2xhc3MgXCJib29rZWRcIlxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgaWYgdGhpcyB0aW1lX3JhbmdlIHwgVGltZV9TbG90IGlzIEZ1bGwgRGF5ICBib29rZWRcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kc1x0XHQtIFsgMzYwMTEsIDg2NDAwIF1cclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2lzX3RoaXNfdGltZXNsb3RfX2Z1bGxfZGF5X2Jvb2tlZCggdGltZXNsb3RfYXJyX2luX3NlY29uZHMgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdFx0KCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kcy5sZW5ndGggPiAxIClcclxuXHRcdFx0JiYgKCBwYXJzZUludCggdGltZXNsb3RfYXJyX2luX3NlY29uZHNbIDAgXSApIDwgMzAgKVxyXG5cdFx0XHQmJiAoIHBhcnNlSW50KCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kc1sgMSBdICkgPiAgKCAoMjQgKiA2MCAqIDYwKSAtIDMwKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKiAgPT0gIFMgZSBsIGUgYyB0IGUgZCAgICBEIGEgdCBlIHMgIC8gIFQgaSBtIGUgLSBGIGkgZSBsIGQgcyAgPT1cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGFsbCBzZWxlY3RlZCBkYXRlcyBpbiBTUUwgZm9ybWF0IGxpa2UgdGhpcyBbIFwiMjAyMy0wOC0yM1wiLCBcIjIwMjMtMDgtMjRcIiAsIC4uLiBdXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKiBAcmV0dXJucyB7W119XHRcdFx0WyBcIjIwMjMtMDgtMjNcIiwgXCIyMDIzLTA4LTI0XCIsIFwiMjAyMy0wOC0yNVwiLCBcIjIwMjMtMDgtMjZcIiwgXCIyMDIzLTA4LTI3XCIsIFwiMjAyMy0wOC0yOFwiLFxyXG5cdCAqICAgICBcIjIwMjMtMDgtMjlcIiBdXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19hcnIgPSBbXTtcclxuXHRcdHNlbGVjdGVkX2RhdGVzX2FyciA9IGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoKS5zcGxpdCgnLCcpO1xyXG5cclxuXHRcdGlmICggc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aCApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICl7XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41Ni5cclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlc19hcnJbIGkgXSA9IHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdLnRyaW0oKTtcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlc19hcnJbIGkgXSA9IHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdLnNwbGl0KCAnLicgKTtcclxuXHRcdFx0XHRpZiAoIHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdLmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF1bIDIgXSArICctJyArIHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdWyAxIF0gKyAnLScgKyBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXVsgMCBdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFJlbW92ZSBlbXB0eSBlbGVtZW50cyBmcm9tIGFuIGFycmF5XHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIgPSBzZWxlY3RlZF9kYXRlc19hcnIuZmlsdGVyKCBmdW5jdGlvbiAoIG4gKXsgcmV0dXJuIHBhcnNlSW50KG4pOyB9ICk7XHJcblxyXG5cdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyLnNvcnQoKTtcclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWRfZGF0ZXNfYXJyO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgdGltZSBmaWVsZHMgaW4gdGhlIGJvb2tpbmcgZm9ybSBhcyBhcnJheSAgb2Ygb2JqZWN0c1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICogQHBhcmFtIGlzX29ubHlfc2VsZWN0ZWRfdGltZVxyXG5cdCAqIEByZXR1cm5zIFtdXHJcblx0ICpcclxuXHQgKiBcdFx0RXhhbXBsZTpcclxuXHQgKiBcdFx0XHRcdFx0W1xyXG5cdCAqIFx0XHRcdFx0XHQgXHQgICB7XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdCAqIFx0XHRcdFx0XHQgXHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0ICogXHRcdFx0XHRcdFx0ICAge1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCdcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHQgKiBcdFx0XHRcdFx0XHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0ICogXHRcdFx0XHRcdCBdXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfX3NlbGVjdGVkX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQsIGlzX29ubHlfc2VsZWN0ZWRfdGltZSA9IHRydWUgKXtcclxuXHRcdC8qKlxyXG5cdFx0ICogRmllbGRzIHdpdGggIFtdICBsaWtlIHRoaXMgICBzZWxlY3RbbmFtZT1cInJhbmdldGltZTFbXVwiXVxyXG5cdFx0ICogaXQncyB3aGVuIHdlIGhhdmUgJ211bHRpcGxlJyBpbiBzaG9ydGNvZGU6ICAgW3NlbGVjdCogcmFuZ2V0aW1lIG11bHRpcGxlICBcIjA2OjAwIC0gMDY6MzBcIiAuLi4gXVxyXG5cdFx0ICovXHJcblx0XHR2YXIgdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZHVyYXRpb250aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nXHJcblx0XHRcdFx0XHRcdFx0XTtcclxuXHJcblx0XHR2YXIgdGltZV9maWVsZHNfb2JqX2FyciA9IFtdO1xyXG5cclxuXHRcdC8vIExvb3AgYWxsIFRpbWUgRmllbGRzXHJcblx0XHRmb3IgKCB2YXIgY3RmPSAwOyBjdGYgPCB0aW1lX2ZpZWxkc19hcnIubGVuZ3RoOyBjdGYrKyApe1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfZmllbGQgPSB0aW1lX2ZpZWxkc19hcnJbIGN0ZiBdO1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfb3B0aW9uO1xyXG5cdFx0XHRpZiAoIGlzX29ubHlfc2VsZWN0ZWRfdGltZSApe1xyXG5cdFx0XHRcdHRpbWVfb3B0aW9uID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgJyArIHRpbWVfZmllbGQgKyAnIG9wdGlvbjpzZWxlY3RlZCcgKTtcdFx0XHQvLyBFeGNsdWRlIGNvbmRpdGlvbmFsICBmaWVsZHMsICBiZWNhdXNlIG9mIHVzaW5nICcjYm9va2luZ19mb3JtMyAuLi4nXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGltZV9vcHRpb24gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCArICcgb3B0aW9uJyApO1x0XHRcdFx0Ly8gQWxsICB0aW1lIGZpZWxkc1xyXG5cdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0Ly8gTG9vcCBhbGwgb3B0aW9ucyBpbiB0aW1lIGZpZWxkXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfb3B0aW9uLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uID0galF1ZXJ5KCB0aW1lX29wdGlvblsgaiBdICk7XHRcdC8vIEdldCBvbmx5ICBzZWxlY3RlZCBvcHRpb25zIFx0Ly9qUXVlcnkoIHRpbWVfZmllbGQgKyAnIG9wdGlvbjplcSgnICsgaiArICcpJyApO1xyXG5cdFx0XHRcdHZhciB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIgPSBqcXVlcnlfb3B0aW9uLnZhbCgpLnNwbGl0KCAnLScgKTtcclxuXHRcdFx0XHR2YXIgdGltZXNfYXNfc2Vjb25kcyA9IFtdO1xyXG5cclxuXHRcdFx0XHQvLyBHZXQgdGltZSBhcyBzZWNvbmRzXHJcblx0XHRcdFx0aWYgKCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoICl7XHRcdFx0XHQgXHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHZhbHVlX29wdGlvbl9zZWNvbmRzX2Fyci5sZW5ndGg7IGkrKyApe1x0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjU2LlxyXG5cdFx0XHRcdFx0XHQvLyB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbaV0gPSAnMTQ6MDAgJyAgfCAnIDE2OjAwJyAgIChpZiBmcm9tICdyYW5nZXRpbWUnKSBhbmQgJzE2OjAwJyAgaWYgKHN0YXJ0L2VuZCB0aW1lKVxyXG5cclxuXHRcdFx0XHRcdFx0dmFyIHN0YXJ0X2VuZF90aW1lc19hcnIgPSB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbIGkgXS50cmltKCkuc3BsaXQoICc6JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIHRpbWVfaW5fc2Vjb25kcyA9IHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAwIF0gKSAqIDYwICogNjAgKyBwYXJzZUludCggc3RhcnRfZW5kX3RpbWVzX2FyclsgMSBdICkgKiA2MDtcclxuXHJcblx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHMucHVzaCggdGltZV9pbl9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyLnB1c2goIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgICAgICAgICAgIDogalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgJyArIHRpbWVfZmllbGQgKS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzoganF1ZXJ5X29wdGlvbi52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcXVlcnlfb3B0aW9uJyAgIDoganF1ZXJ5X29wdGlvbixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0aW1lc19hc19zZWNvbmRzJzogdGltZXNfYXNfc2Vjb25kc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFRleHQ6ICAgW3N0YXJ0dGltZV0gLSBbZW5kdGltZV0gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHR2YXIgdGV4dF90aW1lX2ZpZWxkc19hcnI9W1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnaW5wdXRbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnaW5wdXRbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdF07XHJcblx0XHRmb3IgKCB2YXIgdGY9IDA7IHRmIDwgdGV4dF90aW1lX2ZpZWxkc19hcnIubGVuZ3RoOyB0ZisrICl7XHJcblxyXG5cdFx0XHR2YXIgdGV4dF9qcXVlcnkgPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGV4dF90aW1lX2ZpZWxkc19hcnJbIHRmIF0gKTtcdFx0XHRcdFx0XHRcdFx0Ly8gRXhjbHVkZSBjb25kaXRpb25hbCAgZmllbGRzLCAgYmVjYXVzZSBvZiB1c2luZyAnI2Jvb2tpbmdfZm9ybTMgLi4uJ1xyXG5cdFx0XHRpZiAoIHRleHRfanF1ZXJ5Lmxlbmd0aCA+IDAgKXtcclxuXHJcblx0XHRcdFx0dmFyIHRpbWVfX2hfbV9fYXJyID0gdGV4dF9qcXVlcnkudmFsKCkudHJpbSgpLnNwbGl0KCAnOicgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzE0OjAwJ1xyXG5cdFx0XHRcdGlmICggMCA9PSB0aW1lX19oX21fX2Fyci5sZW5ndGggKXtcclxuXHRcdFx0XHRcdGNvbnRpbnVlO1x0XHRcdFx0XHRcdFx0XHRcdC8vIE5vdCBlbnRlcmVkIHRpbWUgdmFsdWUgaW4gYSBmaWVsZFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIDEgPT0gdGltZV9faF9tX19hcnIubGVuZ3RoICl7XHJcblx0XHRcdFx0XHRpZiAoICcnID09PSB0aW1lX19oX21fX2FyclsgMCBdICl7XHJcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1x0XHRcdFx0XHRcdFx0XHQvLyBOb3QgZW50ZXJlZCB0aW1lIHZhbHVlIGluIGEgZmllbGRcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHRpbWVfX2hfbV9fYXJyWyAxIF0gPSAwO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHR2YXIgdGV4dF90aW1lX2luX3NlY29uZHMgPSBwYXJzZUludCggdGltZV9faF9tX19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCB0aW1lX19oX21fX2FyclsgMSBdICkgKiA2MDtcclxuXHJcblx0XHRcdFx0dmFyIHRleHRfdGltZXNfYXNfc2Vjb25kcyA9IFtdO1xyXG5cdFx0XHRcdHRleHRfdGltZXNfYXNfc2Vjb25kcy5wdXNoKCB0ZXh0X3RpbWVfaW5fc2Vjb25kcyApO1xyXG5cclxuXHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyLnB1c2goIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgICAgICAgICAgIDogdGV4dF9qcXVlcnkuYXR0ciggJ25hbWUnICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWVfb3B0aW9uXzI0aCc6IHRleHRfanF1ZXJ5LnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiB0ZXh0X2pxdWVyeSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0aW1lc19hc19zZWNvbmRzJzogdGV4dF90aW1lc19hc19zZWNvbmRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRpbWVfZmllbGRzX29ial9hcnI7XHJcblx0fVxyXG5cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBTIFUgUCBQIE8gUiBUICAgIGZvciAgICBDIEEgTCBFIE4gRCBBIFIgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgQ2FsZW5kYXIgZGF0ZXBpY2sgSW5zdGFuY2UuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2ludHxzdHJpbmd9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMgeyp8bnVsbH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdChyZXNvdXJjZV9pZCkge1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICkge1xyXG5cdFx0XHRyZXNvdXJjZV9pZCA9ICcxJztcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApIHtcclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0dmFyIGluc3QgPSBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuZ2V0KCAwICkgKTtcclxuXHRcdFx0XHRyZXR1cm4gaW5zdCA/IGluc3QgOiBudWxsO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFVuc2VsZWN0ICBhbGwgZGF0ZXMgaW4gY2FsZW5kYXIgYW5kIHZpc3VhbGx5IHVwZGF0ZSB0aGlzIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVx0XHR0cnVlIG9uIHN1Y2Nlc3MgfCBmYWxzZSwgIGlmIG5vIHN1Y2ggIGNhbGVuZGFyXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHdwYmNfcmFuZ2Vfc2VsZWN0aW9uX19oaWRlX2d1aWRhbmNlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHRcdC8vIFVuc2VsZWN0IGFsbCBkYXRlcyBhbmQgc2V0ICBwcm9wZXJ0aWVzIG9mIERhdGVwaWNrXHJcblx0XHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoICcnICk7ICAgICAgLy9GaXhJbjogNS40LjNcclxuXHRcdFx0aW5zdC5zdGF5T3BlbiA9IGZhbHNlO1xyXG5cdFx0XHRpbnN0LmRhdGVzID0gW107XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENsZWFyIGRheXMgaGlnaGxpZ2h0aW5nIGluIEFsbCBvciBzcGVjaWZpYyBDYWxlbmRhcnNcclxuXHQgKlxyXG4gICAgICogQHBhcmFtIHJlc291cmNlX2lkICAtIGNhbiBiZSBza2lwZWQgdG8gIGNsZWFyIGhpZ2hsaWdodGluZyBpbiBhbGwgY2FsZW5kYXJzXHJcbiAgICAgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHQvLyBDbGVhciBpbiBzcGVjaWZpYyBjYWxlbmRhclxyXG5cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGpRdWVyeSggJy5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHRcdFx0XHRcdFx0XHQvLyBDbGVhciBpbiBhbGwgY2FsZW5kYXJzXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTY3JvbGwgdG8gc3BlY2lmaWMgbW9udGggaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiByZXNvdXJjZVxyXG5cdCAqIEBwYXJhbSB5ZWFyXHRcdFx0XHQtIHJlYWwgeWVhciAgLSAyMDIzXHJcblx0ICogQHBhcmFtIG1vbnRoXHRcdFx0XHQtIHJlYWwgbW9udGggLSAxMlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3Njcm9sbF90byggcmVzb3VyY2VfaWQsIHllYXIsIG1vbnRoICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXsgcmVzb3VyY2VfaWQgPSAnMSc7IH1cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHRcdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cclxuXHRcdFx0eWVhciAgPSBwYXJzZUludCggeWVhciApO1xyXG5cdFx0XHRtb250aCA9IHBhcnNlSW50KCBtb250aCApIC0gMTtcdFx0Ly8gSW4gSlMgZGF0ZSwgIG1vbnRoIC0xXHJcblxyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHQvLyBJbiBzb21lIGNhc2VzLCAgdGhlIHNldEZ1bGxZZWFyIGNhbiAgc2V0ICBvbmx5IFllYXIsICBhbmQgbm90IHRoZSBNb250aCBhbmQgZGF5ICAgICAgLy8gRml4SW46IDYuMi4zLjUuXHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZS5zZXRGdWxsWWVhciggeWVhciwgbW9udGgsIDEgKTtcclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlLnNldE1vbnRoKCBtb250aCApO1xyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUuc2V0RGF0ZSggMSApO1xyXG5cclxuXHRcdFx0aW5zdC5kcmF3TW9udGggPSBpbnN0LmN1cnNvckRhdGUuZ2V0TW9udGgoKTtcclxuXHRcdFx0aW5zdC5kcmF3WWVhciA9IGluc3QuY3Vyc29yRGF0ZS5nZXRGdWxsWWVhcigpO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9ub3RpZnlDaGFuZ2UoIGluc3QgKTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9hZGp1c3RJbnN0RGF0ZSggaW5zdCApO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3Nob3dEYXRlKCBpbnN0ICk7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0LyoqXG5cdCAqIERldGVybWluZSBuYXRpdmUgZGF0ZSBzZWxlY3RhYmlsaXR5IHdpdGhvdXQgb3B0aW9uYWwgZGF0ZSBjb25zdHJhaW50cy5cblx0ICpcblx0ICogVGhpcyBoZWxwZXIgZXhwb3NlcyB0aGUgY2Fub25pY2FsIGNhbGVuZGFyIHJlc3VsdCBmb3IgYWxnb3JpdGhtcywgc3VjaCBhc1xuXHQgKiBnYXAgZGlzY292ZXJ5LCB0aGF0IG11c3Qgbm90IGNvbnN1bWUgdGhlaXIgb3duIGRlcml2ZWQgY29uc3RyYWludHMuIEl0IGRvZXNcblx0ICogbm90IHRyaWdnZXIgd3BiY19jYWxlbmRhcl9fYXBwbHlfZGF0ZV9jb25zdHJhaW50cyBhbmQgbXVzdCByZW1haW4gZnJlZSBvZlxuXHQgKiBvcHRpb25hbC1tb2R1bGUgc3RhdGUuXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfHN0cmluZ30gcmVzb3VyY2VfaWQgQm9va2luZyByZXNvdXJjZSBJRC5cblx0ICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBzcWxfZGF0ZSAgICBDYWxlbmRhciBkYXRlIGluIFlZWVktTU0tREQgZm9ybWF0LlxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGNvcmUgY2FsZW5kYXIgZGF0YSBtYXJrcyB0aGUgZGF0ZSBzZWxlY3RhYmxlLlxuXHQgKi9cblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlX19yYXcoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSApe1xuXG5cdFx0Ly8gR2V0IERhdGEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0XHR2YXIgZGF0ZV9ib29raW5nc19vYmogPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2RhdGUgKTtcblx0XHR2YXIgaXNfZGF5X3NlbGVjdGFibGUgPSBmYWxzZTtcblxuXHRcdGlmICggZGF0ZV9ib29raW5nc19vYmogJiYgJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApICkge1xuXHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSA+IDAgKTtcblxuXHRcdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdICkgJiYgJ2F2YWlsYWJsZScgIT0gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XG5cblx0XHRcdFx0dmFyIGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncGVuZGluZ19kYXlzX3NlbGVjdGFibGUnICk7XHRcdC8vIHNldCBwZW5kaW5nIGRheXMgc2VsZWN0YWJsZSAgICAgICAgICAvLyBGaXhJbjogOC42LjEuMTguXG5cdFx0XHRcdHZhciBib29raW5nX3N0YXR1c2VzX2FyciA9IHdwYmNfZ2V0X2Jvb2tpbmdfc3RhdHVzZXNfX2FzX2FyciggZGF0ZV9ib29raW5nc19vYmogKTtcblxuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0ICAgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdwZW5kaW5nJyApIClcblx0XHRcdFx0XHR8fCAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ3BlbmRpbmdfcGVuZGluZycgKSApXG5cdFx0XHRcdFx0fHwgKCB3cGJjX2Jvb2tpbmdfc3RhdHVzZXNfX2hhcyggYm9va2luZ19zdGF0dXNlc19hcnIsICdwZW5kaW5nX2FwcHJvdmVkJyApIClcblx0XHRcdFx0XHR8fCAoIHdwYmNfYm9va2luZ19zdGF0dXNlc19faGFzKCBib29raW5nX3N0YXR1c2VzX2FyciwgJ2FwcHJvdmVkX3BlbmRpbmcnICkgKVxuXHRcdFx0XHQpe1xuXHRcdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gQm9vbGVhbiggaXNfZGF5X3NlbGVjdGFibGUgKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZXRlcm1pbmUgZmluYWwgZGF0ZSBzZWxlY3RhYmlsaXR5IGFmdGVyIG5hdGl2ZSBhbmQgb3B0aW9uYWwgY29uc3RyYWludHMuXG5cdCAqXG5cdCAqIE5hdGl2ZSB1bmF2YWlsYWJpbGl0eSByZXR1cm5zIGltbWVkaWF0ZWx5LiBPcHRpb25hbCBtb2R1bGVzIG1heSB0aGVyZWZvcmVcblx0ICogb25seSBibG9jayBhIG5hdGl2ZWx5IHNlbGVjdGFibGUgZGF0ZSBhbmQgY2FuIG5ldmVyIHJlb3BlbiBhIGNvcmUtdW5hdmFpbGFibGVcblx0ICogZGF0ZS5cblx0ICpcblx0ICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gICAgICAgIHNxbF9kYXRlICAgIENhbGVuZGFyIGRhdGUgaW4gWVlZWS1NTS1ERCBmb3JtYXQuXG5cdCAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIHdoZW4gdGhlIGRhdGUgcmVtYWlucyBzZWxlY3RhYmxlIGFmdGVyIGNvbnN0cmFpbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgc3FsX2RhdGUgKXtcblxuXHRcdHZhciBpc19uYXRpdmVseV9zZWxlY3RhYmxlID0gd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlX19yYXcoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSApO1xuXG5cdFx0aWYgKCAhIGlzX25hdGl2ZWx5X3NlbGVjdGFibGUgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHdwYmNfY2FsZW5kYXJfX2V2YWx1YXRlX2RhdGVfY29uc3RyYWludHMoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSwgaXNfbmF0aXZlbHlfc2VsZWN0YWJsZSwgW10gKS5pc19zZWxlY3RhYmxlO1xuXHR9XG5cclxuXHQvKipcclxuXHQgKiBJcyBkYXRlIHRvIGNoZWNrIElOIGFycmF5IG9mIHNlbGVjdGVkIGRhdGVzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2RhdGV9anNfZGF0ZV90b19jaGVja1x0XHQtIEpTIERhdGVcdFx0XHQtIHNpbXBsZSAgSmF2YVNjcmlwdCBEYXRlIG9iamVjdFxyXG5cdCAqIEBwYXJhbSB7W119IGpzX2RhdGVzX2Fyclx0XHRcdC0gWyBKU0RhdGUsIC4uLiBdICAgLSBhcnJheSAgb2YgSlMgZGF0ZXNcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2lzX3RoaXNfZGF5X2Ftb25nX3NlbGVjdGVkX2RheXMoIGpzX2RhdGVfdG9fY2hlY2ssIGpzX2RhdGVzX2FyciApe1xyXG5cclxuXHRcdGZvciAoIHZhciBkYXRlX2luZGV4ID0gMDsgZGF0ZV9pbmRleCA8IGpzX2RhdGVzX2Fyci5sZW5ndGggOyBkYXRlX2luZGV4KysgKXsgICAgIFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA4LjQuNS4xNi5cclxuXHRcdFx0aWYgKCAoIGpzX2RhdGVzX2FyclsgZGF0ZV9pbmRleCBdLmdldEZ1bGxZZWFyKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RnVsbFllYXIoKSApICYmXHJcblx0XHRcdFx0ICgganNfZGF0ZXNfYXJyWyBkYXRlX2luZGV4IF0uZ2V0TW9udGgoKSA9PT0ganNfZGF0ZV90b19jaGVjay5nZXRNb250aCgpICkgJiZcclxuXHRcdFx0XHQgKCBqc19kYXRlc19hcnJbIGRhdGVfaW5kZXggXS5nZXREYXRlKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RGF0ZSgpICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAgZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgU1FMIENsYXNzIERhdGUgJzIwMjMtMDgtMDEnIGZyb20gIEpTIERhdGVcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRKUyBEYXRlXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cdFx0JzIwMjMtMDgtMTInXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApe1xyXG5cclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9ICggKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgPCAxMCApID8gJzAnIDogJyc7XHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLSdcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSAoIGRhdGUuZ2V0RGF0ZSgpIDwgMTAgKSA/ICcwJyA6ICcnO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9IGRhdGUuZ2V0RGF0ZSgpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHNxbF9jbGFzc19kYXk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgSlMgRGF0ZSBmcm9tICB0aGUgU1FMIGRhdGUgZm9ybWF0ICcyMDI0LTA1LTE0J1xyXG5cdCAqIEBwYXJhbSBzcWxfY2xhc3NfZGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtEYXRlfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2NsYXNzX2RhdGUgKXtcclxuXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RhdGVfYXJyID0gc3FsX2NsYXNzX2RhdGUuc3BsaXQoICctJyApO1xyXG5cclxuXHRcdHZhciBkYXRlX2pzID0gbmV3IERhdGUoKTtcclxuXHJcblx0XHRkYXRlX2pzLnNldEZ1bGxZZWFyKCBwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAwIF0gKSwgKHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDEgXSApIC0gMSksIHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDIgXSApICk7ICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cclxuXHRcdC8vIFdpdGhvdXQgdGhpcyB0aW1lIGFkanVzdCBEYXRlcyBzZWxlY3Rpb24gIGluIERhdGVwaWNrZXIgY2FuIG5vdCB3b3JrISEhXHJcblx0XHRkYXRlX2pzLnNldEhvdXJzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaW51dGVzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRTZWNvbmRzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaWxsaXNlY29uZHMoMCk7XHJcblxyXG5cdFx0cmV0dXJuIGRhdGVfanM7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgVEQgQ2xhc3MgRGF0ZSAnMS0zMS0yMDIzJyBmcm9tICBKUyBEYXRlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHRcdCcxLTMxLTIwMjMnXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICl7XHJcblxyXG5cdFx0dmFyIHRkX2NsYXNzX2RheSA9IChkYXRlLmdldE1vbnRoKCkgKyAxKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1x0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblxyXG5cdFx0cmV0dXJuIHRkX2NsYXNzX2RheTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBkYXRlIHBhcmFtcyBmcm9tICBzdHJpbmcgZGF0ZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRzdHJpbmcgZGF0ZSBsaWtlICczMS41LjIwMjMnXHJcblx0ICogQHBhcmFtIHNlcGFyYXRvclx0XHRkZWZhdWx0ICcuJyAgY2FuIGJlIHNraXBwZWQuXHJcblx0ICogQHJldHVybnMgeyAge2RhdGU6IG51bWJlciwgbW9udGg6IG51bWJlciwgeWVhcjogbnVtYmVyfSAgfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fZGF0ZV9wYXJhbXNfX2Zyb21fc3RyaW5nX2RhdGUoIGRhdGUgLCBzZXBhcmF0b3Ipe1xyXG5cclxuXHRcdHNlcGFyYXRvciA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoc2VwYXJhdG9yKSApID8gc2VwYXJhdG9yIDogJy4nO1xyXG5cclxuXHRcdHZhciBkYXRlX2FyciA9IGRhdGUuc3BsaXQoIHNlcGFyYXRvciApO1xyXG5cdFx0dmFyIGRhdGVfb2JqID0ge1xyXG5cdFx0XHQneWVhcicgOiAgcGFyc2VJbnQoIGRhdGVfYXJyWyAyIF0gKSxcclxuXHRcdFx0J21vbnRoJzogKHBhcnNlSW50KCBkYXRlX2FyclsgMSBdICkgLSAxKSxcclxuXHRcdFx0J2RhdGUnIDogIHBhcnNlSW50KCBkYXRlX2FyclsgMCBdIClcclxuXHRcdH07XHJcblx0XHRyZXR1cm4gZGF0ZV9vYmo7XHRcdC8vIGZvciBcdFx0ID0gbmV3IERhdGUoIGRhdGVfb2JqLnllYXIgLCBkYXRlX29iai5tb250aCAsIGRhdGVfb2JqLmRhdGUgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdGFydCggcmVzb3VyY2VfaWQgKXtcclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLm5leHQoKS5oYXNDbGFzcyggJ3dwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZnRlciggJzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIndwYmNfc3Bpbl9sb2FkZXJfb25lX25ld1wiPjwvZGl2PjwvZGl2PicgKTtcclxuXHRcdH1cclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmhhc0NsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApICl7XHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuYWRkQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICk7XHJcblx0XHR9XHJcblx0XHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdGFydCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wKCByZXNvdXJjZV9pZCApe1xyXG5cdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnICsgLndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkucmVtb3ZlKCk7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApO1xyXG5cdFx0d3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBCbHVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0YXJ0KCByZXNvdXJjZV9pZCApe1xyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZGRDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cicgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBCbHVyIGluICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0b3AoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyJyApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblx0LyogID09ICBDYWxlbmRhciBVcGRhdGUgIC0gVmlldyAgPT1cclxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGUgbG9vayBvZiBjYWxlbmRhciAoc2FmZSkuXHJcblx0ICpcclxuXHQgKiBJbiBFbGVtZW50b3IgcHJldmlldyB0aGUgRE9NIGNhbiBiZSByZS1yZW5kZXJlZCwgc28gdGhlIGNhbGVuZGFyIGVsZW1lbnQgbWF5IGV4aXN0XHJcblx0ICogd2hpbGUgdGhlIERhdGVwaWNrIGluc3RhbmNlIGlzIG1pc3NpbmcuIEluIHRoYXQgY2FzZSB0cnkgdG8gKHJlKWluaXRpYWxpemUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2ludHxzdHJpbmd9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybiB7Ym9vbGVhbn0gdHJ1ZSBpZiB1cGRhdGVkLCBmYWxzZSBpZiBub3QgcG9zc2libGVcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayhyZXNvdXJjZV9pZCkge1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gSWYgaW5zdGFuY2UgbWlzc2luZywgdHJ5IHRvIHJlLWluaXQgY2FsZW5kYXIgb25jZS5cclxuXHRcdGlmICggbnVsbCA9PT0gaW5zdCApIHtcclxuXHJcblx0XHRcdHZhciBqcV9jYWwgPSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0aWYgKCBqcV9jYWwubGVuZ3RoICYmICgnZnVuY3Rpb24nID09PSB0eXBlb2Ygd3BiY19jYWxlbmRhcl9zaG93KSApIHtcclxuXHJcblx0XHRcdFx0Ly8gRWxlbWVudG9yIHNvbWV0aW1lcyBsZWF2ZXMgc3RhbGUgY2xhc3Mgd2l0aG91dCByZWFsIGluc3RhbmNlLlxyXG5cdFx0XHRcdGlmICgganFfY2FsLmhhc0NsYXNzKCAnaGFzRGF0ZXBpY2snICkgKSB7XHJcblx0XHRcdFx0XHRqcV9jYWwucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFRyeSB0byBpbml0IGRhdGVwaWNrIG1hcmt1cCBub3cuXHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0XHQvLyBUcnkgYWdhaW4uXHJcblx0XHRcdFx0aW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gU3RpbGwgbm8gaW5zdGFuY2UgLT4gZG8gbm90IGNyYXNoIHRoZSB3aG9sZSBhamF4IGZsb3cuXHJcblx0XHRpZiAoIG51bGwgPT09IGluc3QgKSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRqUXVlcnkuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBpbnN0ICk7XHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9XHJcblxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlIGR5bmFtaWNhbGx5IE51bWJlciBvZiBNb250aHMgaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZCBpbnRcclxuXHQgKiBAcGFyYW0gbW9udGhzX251bWJlciBpbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIG1vbnRoc19udW1iZXIgKXtcclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHRcdFx0aW5zdC5zZXR0aW5nc1sgJ251bWJlck9mTW9udGhzJyBdID0gbW9udGhzX251bWJlcjtcclxuXHRcdFx0Ly9fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX251bWJlcl9vZl9tb250aHMnLCBtb250aHNfbnVtYmVyICk7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNob3cgY2FsZW5kYXIgaW4gIGRpZmZlcmVudCBTa2luXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gc2VsZWN0ZWRfc2tpbl91cmxcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4oIHNlbGVjdGVkX3NraW5fdXJsICl7XHJcblxyXG5cdC8vY29uc29sZS5sb2coICdTS0lOIFNFTEVDVElPTiA6OicsIHNlbGVjdGVkX3NraW5fdXJsICk7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIENTUyBza2luXHJcblx0XHR2YXIgc3R5bGVzaGVldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiYy1jYWxlbmRhci1za2luLWNzcycgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgXCJ3cGJjLWNhbGVuZGFyLXNraW4tY3NzXCIgKTtcclxuXHRcdGNzc05vZGUucmVsID0gJ3N0eWxlc2hlZXQnO1xyXG5cdFx0Y3NzTm9kZS5tZWRpYSA9ICdzY3JlZW4nO1xyXG5cdFx0Y3NzTm9kZS5ocmVmID0gc2VsZWN0ZWRfc2tpbl91cmw7XHQvL1wiaHR0cDovL2JldGEvd3AtY29udGVudC9wbHVnaW5zL2Jvb2tpbmcvY3NzL3NraW5zL2dyZWVuLTAxLmNzc1wiO1xyXG5cdFx0aGVhZElELmFwcGVuZENoaWxkKCBjc3NOb2RlICk7XHJcblx0fVxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggc2VsZWN0ZWRfc2tpbl91cmwsIHN0eWxlc2hlZXRfaWQgPSAnd3BiYy10aW1lX3BpY2tlci1za2luLWNzcycgKXtcclxuXHJcblx0XHQvLyBSZW1vdmUgQ1NTIHNraW5cclxuXHRcdHZhciBzdHlsZXNoZWV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHN0eWxlc2hlZXRfaWQgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgc3R5bGVzaGVldF9pZCApO1xyXG5cdFx0Y3NzTm9kZS5yZWwgPSAnc3R5bGVzaGVldCc7XHJcblx0XHRjc3NOb2RlLm1lZGlhID0gJ3NjcmVlbic7XHJcblx0XHRjc3NOb2RlLmhyZWYgPSBzZWxlY3RlZF9za2luX3VybDtcdC8vXCJodHRwOi8vYmV0YS93cC1jb250ZW50L3BsdWdpbnMvYm9va2luZy9jc3Mvc2tpbnMvZ3JlZW4tMDEuY3NzXCI7XHJcblx0XHRoZWFkSUQuYXBwZW5kQ2hpbGQoIGNzc05vZGUgKTtcclxuXHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgUyBVIFAgUCBPIFIgVCAgICBNIEEgVCBIICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1lcmdlIHNldmVyYWwgIGludGVyc2VjdGVkIGludGVydmFscyBvciByZXR1cm4gbm90IGludGVyc2VjdGVkOlxyXG5cdFx0ICogW1sxLDNdLFsyLDZdLFs4LDEwXSxbMTUsMThdXSAgLT4gICBbWzEsNl0sWzgsMTBdLFsxNSwxOF1dXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIFtdIGludGVydmFsc1x0XHRcdCBbIFsxLDNdLFsyLDRdLFs2LDhdLFs5LDEwXSxbMyw3XSBdXHJcblx0XHQgKiBAcmV0dXJucyBbXVx0XHRcdFx0XHQgWyBbMSw4XSxbOSwxMF0gXVxyXG5cdFx0ICpcclxuXHRcdCAqIEV4bWFtcGxlOiB3cGJjX2ludGVydmFsc19fbWVyZ2VfaW5lcnNlY3RlZCggIFsgWzEsM10sWzIsNF0sWzYsOF0sWzksMTBdLFszLDddIF0gICk7XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaW50ZXJ2YWxzX19tZXJnZV9pbmVyc2VjdGVkKCBpbnRlcnZhbHMgKXtcclxuXHJcblx0XHRcdGlmICggISBpbnRlcnZhbHMgfHwgaW50ZXJ2YWxzLmxlbmd0aCA9PT0gMCApe1xyXG5cdFx0XHRcdHJldHVybiBbXTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIG1lcmdlZCA9IFtdO1xyXG5cdFx0XHRpbnRlcnZhbHMuc29ydCggZnVuY3Rpb24gKCBhLCBiICl7XHJcblx0XHRcdFx0cmV0dXJuIGFbIDAgXSAtIGJbIDAgXTtcclxuXHRcdFx0fSApO1xyXG5cclxuXHRcdFx0dmFyIG1lcmdlZEludGVydmFsID0gaW50ZXJ2YWxzWyAwIF07XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBpbnRlcnZhbHMubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0XHR2YXIgaW50ZXJ2YWwgPSBpbnRlcnZhbHNbIGkgXTtcclxuXHJcblx0XHRcdFx0aWYgKCBpbnRlcnZhbFsgMCBdIDw9IG1lcmdlZEludGVydmFsWyAxIF0gKXtcclxuXHRcdFx0XHRcdG1lcmdlZEludGVydmFsWyAxIF0gPSBNYXRoLm1heCggbWVyZ2VkSW50ZXJ2YWxbIDEgXSwgaW50ZXJ2YWxbIDEgXSApO1xyXG5cdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRtZXJnZWQucHVzaCggbWVyZ2VkSW50ZXJ2YWwgKTtcclxuXHRcdFx0XHRcdG1lcmdlZEludGVydmFsID0gaW50ZXJ2YWw7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRtZXJnZWQucHVzaCggbWVyZ2VkSW50ZXJ2YWwgKTtcclxuXHRcdFx0cmV0dXJuIG1lcmdlZDtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBJcyAyIGludGVydmFscyBpbnRlcnNlY3RlZDogICAgICAgWzM2MDExLCA4NjM5Ml0gICAgPD0+ICAgIFsxLCA0MzE5Ml0gID0+ICB0cnVlICAgICAgKCBpbnRlcnNlY3RlZCApXHJcblx0XHQgKlxyXG5cdFx0ICogR29vZCBleHBsYW5hdGlvbiAgaGVyZVxyXG5cdFx0ICogaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzI2OTQzNC93aGF0cy10aGUtbW9zdC1lZmZpY2llbnQtd2F5LXRvLXRlc3QtaWYtdHdvLXJhbmdlcy1vdmVybGFwXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtICBpbnRlcnZhbF9BICAgLSBbIDM2MDExLCA4NjM5MiBdXHJcblx0XHQgKiBAcGFyYW0gIGludGVydmFsX0IgICAtIFsgICAgIDEsIDQzMTkyIF1cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIGJvb2xcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pbnRlcnZhbHNfX2lzX2ludGVyc2VjdGVkKCBpbnRlcnZhbF9BLCBpbnRlcnZhbF9CICkge1xyXG5cclxuXHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0KCAwID09IGludGVydmFsX0EubGVuZ3RoIClcclxuXHRcdFx0XHQgfHwgKCAwID09IGludGVydmFsX0IubGVuZ3RoIClcclxuXHRcdFx0KXtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGludGVydmFsX0FbIDAgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9BWyAwIF0gKTtcclxuXHRcdFx0aW50ZXJ2YWxfQVsgMSBdID0gcGFyc2VJbnQoIGludGVydmFsX0FbIDEgXSApO1xyXG5cdFx0XHRpbnRlcnZhbF9CWyAwIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQlsgMCBdICk7XHJcblx0XHRcdGludGVydmFsX0JbIDEgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9CWyAxIF0gKTtcclxuXHJcblx0XHRcdHZhciBpc19pbnRlcnNlY3RlZCA9IE1hdGgubWF4KCBpbnRlcnZhbF9BWyAwIF0sIGludGVydmFsX0JbIDAgXSApIC0gTWF0aC5taW4oIGludGVydmFsX0FbIDEgXSwgaW50ZXJ2YWxfQlsgMSBdICk7XHJcblxyXG5cdFx0XHQvLyBpZiAoIDAgPT0gaXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdC8vXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdWNoIHJhbmdlcyBnb2luZyBvbmUgYWZ0ZXIgb3RoZXIsIGUuZy46IFsgMTIsIDE1IF0gYW5kIFsgMTUsIDIxIF1cclxuXHRcdFx0Ly8gfVxyXG5cclxuXHRcdFx0aWYgKCBpc19pbnRlcnNlY3RlZCA8IDAgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7ICAgICAgICAgICAgICAgICAgICAgLy8gSU5URVJTRUNURURcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAgLy8gTm90IGludGVyc2VjdGVkXHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IHRoZSBjbG9zZXRzIEFCUyB2YWx1ZSBvZiBlbGVtZW50IGluIGFycmF5IHRvIHRoZSBjdXJyZW50IG15VmFsdWVcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gbXlWYWx1ZSBcdC0gaW50IGVsZW1lbnQgdG8gc2VhcmNoIGNsb3NldCBcdFx0XHQ0XHJcblx0XHQgKiBAcGFyYW0gbXlBcnJheVx0LSBhcnJheSBvZiBlbGVtZW50cyB3aGVyZSB0byBzZWFyY2ggXHRbNSw4LDEsN11cclxuXHRcdCAqIEByZXR1cm5zIGludFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDVcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfYWJzX2Nsb3Nlc3RfdmFsdWVfaW5fYXJyKCBteVZhbHVlLCBteUFycmF5ICl7XHJcblxyXG5cdFx0XHRpZiAoIG15QXJyYXkubGVuZ3RoID09IDAgKXsgXHRcdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBhcnJheSBpcyBlbXB0eSAtPiByZXR1cm4gIHRoZSBteVZhbHVlXHJcblx0XHRcdFx0cmV0dXJuIG15VmFsdWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBvYmogPSBteUFycmF5WyAwIF07XHJcblx0XHRcdHZhciBkaWZmID0gTWF0aC5hYnMoIG15VmFsdWUgLSBvYmogKTsgICAgICAgICAgICAgXHQvLyBHZXQgZGlzdGFuY2UgYmV0d2VlbiAgMXN0IGVsZW1lbnRcclxuXHRcdFx0dmFyIGNsb3NldFZhbHVlID0gbXlBcnJheVsgMCBdOyAgICAgICAgICAgICAgICAgICBcdFx0XHQvLyBTYXZlIDFzdCBlbGVtZW50XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBteUFycmF5Lmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0b2JqID0gbXlBcnJheVsgaSBdO1xyXG5cclxuXHRcdFx0XHRpZiAoIE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICkgPCBkaWZmICl7ICAgICBcdFx0XHQvLyB3ZSBmb3VuZCBjbG9zZXIgdmFsdWUgLT4gc2F2ZSBpdFxyXG5cdFx0XHRcdFx0ZGlmZiA9IE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICk7XHJcblx0XHRcdFx0XHRjbG9zZXRWYWx1ZSA9IG9iajtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBjbG9zZXRWYWx1ZTtcclxuXHRcdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBUIE8gTyBMIFQgSSBQIFMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdG9vbHRpcCB0byBzaG93LCAgd2hlbiAgbW91c2Ugb3ZlciBEYXRlIGluIENhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gIHRvb2x0aXBfdGV4dFx0XHRcdC0gVGV4dCB0byBzaG93XHRcdFx0XHQnQm9va2VkIHRpbWU6IDEyOjAwIC0gMTM6MDA8YnI+Q29zdDogJDIwLjAwJ1xyXG5cdCAqIEBwYXJhbSAgcmVzb3VyY2VfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcdCcxJ1xyXG5cdCAqIEBwYXJhbSAgdGRfY2xhc3NcdFx0XHRcdC0gU1FMIGNsYXNzXHRcdFx0XHRcdCcxLTktMjAyMydcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0XHRcdFx0LSBkZWZpbmVkIHRvIHNob3cgb3Igbm90XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgdGRfY2xhc3MgKXtcclxuXHJcblx0XHQvL1RPRE86IG1ha2UgZXNjYXBpbmcgb2YgdGV4dCBmb3IgcXVvdCBzeW1ib2xzLCAgYW5kIEpTL0hUTUwuLi5cclxuXHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICkuYXR0ciggJ2RhdGEtY29udGVudCcsIHRvb2x0aXBfdGV4dCApO1xyXG5cclxuXHRcdHZhciB0ZF9lbCA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKS5nZXQoIDAgKTtcdFx0XHRcdFx0Ly8gRml4SW46IDkuMC4xLjEuXHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YodGRfZWwpIClcclxuXHRcdFx0JiYgKCB1bmRlZmluZWQgPT0gdGRfZWwuX3RpcHB5IClcclxuXHRcdFx0JiYgKCAnJyAhPT0gdG9vbHRpcF90ZXh0IClcclxuXHRcdCl7XHJcblxyXG5cdFx0XHR3cGJjX3RpcHB5KCB0ZF9lbCAsIHtcclxuXHRcdFx0XHRcdGNvbnRlbnQoIHJlZmVyZW5jZSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJwb3BvdmVyIHBvcG92ZXJfdGlwcHlcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJwb3BvdmVyLWNvbnRlbnRcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyBwb3BvdmVyX2NvbnRlbnRcclxuXHRcdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdCArICc8L2Rpdj4nO1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdGFsbG93SFRNTCAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dHJpZ2dlclx0XHRcdCA6ICdtb3VzZWVudGVyIGZvY3VzJyxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdGhpZGVPbkNsaWNrICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmVCb3JkZXI6IDEwLFxyXG5cdFx0XHRcdFx0bWF4V2lkdGggICAgICAgICA6IDU1MCxcclxuXHRcdFx0XHRcdHRoZW1lICAgICAgICAgICAgOiAnd3BiYy10aXBweS10aW1lcycsXHJcblx0XHRcdFx0XHRwbGFjZW1lbnQgICAgICAgIDogJ3RvcCcsXHJcblx0XHRcdFx0XHRkZWxheVx0XHRcdCA6IFs0MDAsIDBdLFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjQuMi4yLlxyXG5cdFx0XHRcdFx0Ly9kZWxheVx0XHRcdCA6IFswLCA5OTk5OTk5OTk5XSxcdFx0XHRcdFx0XHQvLyBEZWJ1Z2UgIHRvb2x0aXBcclxuXHRcdFx0XHRcdGlnbm9yZUF0dHJpYnV0ZXMgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dG91Y2hcdFx0XHQgOiB0cnVlLFx0XHRcdFx0XHRcdFx0XHQvL1snaG9sZCcsIDUwMF0sIC8vIDUwMG1zIGRlbGF5XHRcdFx0XHQvLyBGaXhJbjogOS4yLjEuNS5cclxuXHRcdFx0XHRcdGFwcGVuZFRvOiAoKSA9PiBkb2N1bWVudC5ib2R5LFxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybiAgdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBEYXRlcyBGdW5jdGlvbnMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEdldCBudW1iZXIgb2YgZGF0ZXMgYmV0d2VlbiAyIEpTIERhdGVzXHJcbiAqXHJcbiAqIEBwYXJhbSBkYXRlMVx0XHRKUyBEYXRlXHJcbiAqIEBwYXJhbSBkYXRlMlx0XHRKUyBEYXRlXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oZGF0ZTEsIGRhdGUyKSB7XHJcblxyXG4gICAgLy8gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgaW4gb25lIGRheVxyXG4gICAgdmFyIE9ORV9EQVkgPSAxMDAwICogNjAgKiA2MCAqIDI0O1xyXG5cclxuICAgIC8vIENvbnZlcnQgYm90aCBkYXRlcyB0byBtaWxsaXNlY29uZHNcclxuICAgIHZhciBkYXRlMV9tcyA9IGRhdGUxLmdldFRpbWUoKTtcclxuICAgIHZhciBkYXRlMl9tcyA9IGRhdGUyLmdldFRpbWUoKTtcclxuXHJcbiAgICAvLyBDYWxjdWxhdGUgdGhlIGRpZmZlcmVuY2UgaW4gbWlsbGlzZWNvbmRzXHJcbiAgICB2YXIgZGlmZmVyZW5jZV9tcyA9ICBkYXRlMV9tcyAtIGRhdGUyX21zO1xyXG5cclxuICAgIC8vIENvbnZlcnQgYmFjayB0byBkYXlzIGFuZCByZXR1cm5cclxuICAgIHJldHVybiBNYXRoLnJvdW5kKGRpZmZlcmVuY2VfbXMvT05FX0RBWSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2hlY2sgIGlmIHRoaXMgYXJyYXkgIG9mIGRhdGVzIGlzIGNvbnNlY3V0aXZlIGFycmF5ICBvZiBkYXRlcyBvciBub3QuXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddIC0+IGZhbHNlXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTEwJywnMjAyNC0wNS0xMSddIC0+IHRydWVcclxuICogQHBhcmFtIHNxbF9kYXRlc19hcnJcdCBhcnJheVx0XHRlLmcuOiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBzcWxfZGF0ZXNfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cclxuXHRpZiAoIHNxbF9kYXRlc19hcnIubGVuZ3RoID4gMSApe1xyXG5cdFx0dmFyIHByZXZpb3NfZGF0ZSA9IHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2RhdGVzX2FyclsgMCBdICk7XHJcblx0XHR2YXIgY3VycmVudF9kYXRlO1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMTsgaSA8IHNxbF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0Y3VycmVudF9kYXRlID0gd3BiY19fZ2V0X19qc19kYXRlKCBzcWxfZGF0ZXNfYXJyW2ldICk7XHJcblxyXG5cdFx0XHRpZiAoIHdwYmNfZGF0ZXNfX2RheXNfYmV0d2VlbiggY3VycmVudF9kYXRlLCBwcmV2aW9zX2RhdGUgKSAhPSAxICl7XHJcblx0XHRcdFx0cmV0dXJuICBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cHJldmlvc19kYXRlID0gY3VycmVudF9kYXRlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBBdXRvIERhdGVzIFNlbGVjdGlvbiAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogID09IEhvdyB0byAgdXNlID8gPT1cclxuICpcclxuICogIEZvciBEYXRlcyBzZWxlY3Rpb24sIHdlIG5lZWQgdG8gdXNlIHRoaXMgbG9naWMhICAgICBXZSBuZWVkIHNlbGVjdCB0aGUgZGF0ZXMgb25seSBhZnRlciBib29raW5nIGRhdGEgbG9hZGVkIVxyXG4gKlxyXG4gKiAgQ2hlY2sgZXhhbXBsZSBiZWxsb3cuXHJcbiAqXHJcbiAqXHQvLyBGaXJlIG9uIGFsbCBib29raW5nIGRhdGVzIGxvYWRlZFxyXG4gKlx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uICggZXZlbnQsIGxvYWRlZF9yZXNvdXJjZV9pZCApe1xyXG4gKlxyXG4gKlx0XHRpZiAoIGxvYWRlZF9yZXNvdXJjZV9pZCA9PSBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQgKXtcclxuICpcdFx0XHR3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqXHRcdH1cclxuICpcdH0gKTtcclxuICpcclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqIFRyeSB0byBBdXRvIHNlbGVjdCBkYXRlcyBpbiBzcGVjaWZpYyBjYWxlbmRhciBieSBzaW11bGF0ZWQgY2xpY2tzIGluIGRhdGVwaWNrZXJcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdDFcclxuICogQHBhcmFtIGNoZWNrX2luX3ltZFx0XHQnMjAyNC0wNS0wOSdcdFx0T1IgIFx0WycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjAnXVxyXG4gKiBAcGFyYW0gY2hlY2tfb3V0X3ltZFx0XHQnMjAyNC0wNS0xNSdcdFx0T3B0aW9uYWxcclxuICpcclxuICogQHJldHVybnMge251bWJlcn1cdFx0bnVtYmVyIG9mIHNlbGVjdGVkIGRhdGVzXHJcbiAqXHJcbiAqIFx0RXhhbXBsZSAxOlx0XHRcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggMSwgJzIwMjQtMDUtMTUnLFxyXG4gKiAgICAgJzIwMjQtMDUtMjUnICk7IEV4YW1wbGUgMjpcdFx0XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIDEsXHJcbiAqICAgICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0yMCddICk7XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kID0gJycgKXtcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC40Ny5cclxuXHJcblx0Y29uc29sZS5sb2coICdXUEJDX0FVVE9fU0VMRUNUX0RBVEVTX0lOX0NBTEVOREFSKCBSRVNPVVJDRV9JRCwgQ0hFQ0tfSU5fWU1ELCBDSEVDS19PVVRfWU1EICknLCByZXNvdXJjZV9pZCwgY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kICk7XHJcblxyXG5cdGlmIChcclxuXHRcdCAgICggJzIxMDAtMDEtMDEnID09IGNoZWNrX2luX3ltZCApXHJcblx0XHR8fCAoICcyMTAwLTAxLTAxJyA9PSBjaGVja19vdXRfeW1kIClcclxuXHRcdHx8ICggKCAnJyA9PSBjaGVja19pbl95bWQgKSAmJiAoICcnID09IGNoZWNrX291dF95bWQgKSApXHJcblx0KXtcclxuXHRcdHJldHVybiAwO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBJZiBcdGNoZWNrX2luX3ltZCAgPSAgWyAnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJyBdXHRcdFx0XHRBUlJBWSBvZiBEQVRFU1x0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTAuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgZGF0ZXNfdG9fc2VsZWN0X2FyciA9IFtdO1xyXG5cdGlmICggQXJyYXkuaXNBcnJheSggY2hlY2tfaW5feW1kICkgKXtcclxuXHRcdGRhdGVzX3RvX3NlbGVjdF9hcnIgPSB3cGJjX2Nsb25lX29iaiggY2hlY2tfaW5feW1kICk7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRXhjZXB0aW9ucyB0byAgc2V0ICBcdE1VTFRJUExFIERBWVMgXHRtb2RlXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBpZiBkYXRlcyBhcyBOT1QgQ09OU0VDVVRJVkU6IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ10sIC0+IHNldCBNVUxUSVBMRSBEQVlTIG1vZGVcclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKVxyXG5cdFx0XHQmJiAoICcnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0XHQmJiAoICEgd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBkYXRlc190b19zZWxlY3RfYXJyICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0Ly8gaWYgbXVsdGlwbGUgZGF5cyB0byBzZWxlY3QsIGJ1dCBlbmFibGVkIFNJTkdMRSBkYXkgbW9kZSwgLT4gc2V0IE1VTFRJUExFIERBWVMgbW9kZVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoID4gMSApXHJcblx0XHRcdCYmICggJycgPT0gY2hlY2tfb3V0X3ltZCApXHJcblx0XHRcdCYmICggJ3NpbmdsZScgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApXHJcblx0XHQpe1xyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRjaGVja19pbl95bWQgPSBkYXRlc190b19zZWxlY3RfYXJyWyAwIF07XHJcblx0XHRpZiAoICcnID09IGNoZWNrX291dF95bWQgKXtcclxuXHRcdFx0Y2hlY2tfb3V0X3ltZCA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIChkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aC0xKSBdO1xyXG5cdFx0fVxyXG5cdH1cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0aWYgKCAnJyA9PSBjaGVja19pbl95bWQgKXtcclxuXHRcdGNoZWNrX2luX3ltZCA9IGNoZWNrX291dF95bWQ7XHJcblx0fVxyXG5cdGlmICggJycgPT0gY2hlY2tfb3V0X3ltZCApe1xyXG5cdFx0Y2hlY2tfb3V0X3ltZCA9IGNoZWNrX2luX3ltZDtcclxuXHR9XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRyZXNvdXJjZV9pZCA9ICcxJztcclxuXHR9XHJcblxyXG5cclxuXHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHQvLyBVbnNlbGVjdCBhbGwgZGF0ZXMgYW5kIHNldCAgcHJvcGVydGllcyBvZiBEYXRlcGlja1xyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTsgICAgICBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogNS40LjNcclxuXHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdGluc3QuZGF0ZXMgPSBbXTtcclxuXHRcdHZhciBjaGVja19pbl9qcyA9IHdwYmNfX2dldF9fanNfZGF0ZSggY2hlY2tfaW5feW1kICk7XHJcblx0XHR2YXIgdGRfY2VsbCAgICAgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19pbl9qcyApO1xyXG5cclxuXHRcdC8vIElzIG9tZSB0eXBlIG9mIGVycm9yLCB0aGVuIHNlbGVjdCBtdWx0aXBsZSBkYXlzIHNlbGVjdGlvbiAgbW9kZS5cclxuXHRcdGlmICggJycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApIHtcclxuIFx0XHRcdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScsICdtdWx0aXBsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRFlOQU1JQyA9PVxyXG5cdFx0aWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cdFx0XHQvLyAxLXN0IGNsaWNrXHJcblx0XHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0XHRpZiAoIDAgPT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdFx0cmV0dXJuIDA7ICBcdFx0XHRcdFx0XHRcdFx0Ly8gRmlyc3QgY2xpY2sgIHdhcyB1bnN1Y2Nlc3NmdWwsIHNvIHdlIG11c3Qgbm90IG1ha2Ugb3RoZXIgY2xpY2tcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gMi1uZCBjbGlja1xyXG5cdFx0XHR2YXIgY2hlY2tfb3V0X2pzID0gd3BiY19fZ2V0X19qc19kYXRlKCBjaGVja19vdXRfeW1kICk7XHJcblx0XHRcdHZhciB0ZF9jZWxsX291dCA9IHdwYmNfZ2V0X2NsaWNrZWRfdGQoIGluc3QuaWQsIGNoZWNrX291dF9qcyApO1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gdHJ1ZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGxfb3V0LCAnIycgKyBpbnN0LmlkLCBjaGVja19vdXRfanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRklYRUQgPT1cclxuXHRcdGlmICggICdmaXhlZCcgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSkge1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gU0lOR0xFID09XHJcblx0XHRpZiAoICdzaW5nbGUnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdFx0Ly9qUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGNoZWNrX2luX2pzLCBudWxsICkgKTtcdFx0Ly8gRG8gd2UgbmVlZCB0byBydW4gIHRoaXMgPyBQbGVhc2Ugbm90ZSwgY2hlY2tfaW5fanMgbXVzdCAgaGF2ZSB0aW1lLCAgbWluLCBzZWMgZGVmaW5lZCB0byAwIVxyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gTVVMVElQTEUgPT1cclxuXHRcdGlmICggJ211bHRpcGxlJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyO1xyXG5cclxuXHRcdFx0aWYgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0XHQvLyBTaXR1YXRpb24sIHdoZW4gd2UgaGF2ZSBkYXRlcyBhcnJheTogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXS4gIGFuZCBub3QgdGhlIENoZWNrIEluIC8gQ2hlY2sgIG91dCBkYXRlcyBhcyBwYXJhbWV0ZXIgaW4gdGhpcyBmdW5jdGlvblxyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2FyciggZGF0ZXNfdG9fc2VsZWN0X2FyciApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kLCBpbnN0ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggMCA9PT0gZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGb3IgQ2FsZW5kYXIgRGF5cyBzZWxlY3Rpb25cclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aDsgaisrICl7ICAgICAgIC8vIExvb3AgYXJyYXkgb2YgZGF0ZXNcclxuXHJcblx0XHRcdFx0dmFyIHN0cl9kYXRlID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHJcblx0XHRcdFx0Ly8gRGF0ZSB1bmF2YWlsYWJsZSAhXHJcblx0XHRcdFx0aWYgKCAwID09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzdHJfZGF0ZSApLmRheV9hdmFpbGFiaWxpdHkgKXtcclxuXHRcdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBkYXRlc19hcnIuZGF0ZXNfanNbIGogXSAhPSAtMSApIHtcclxuXHRcdFx0XHRcdGluc3QuZGF0ZXMucHVzaCggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBjaGVja19vdXRfZGF0ZSA9IGRhdGVzX2Fyci5kYXRlc19qc1sgKGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGggLSAxKSBdO1xyXG5cclxuXHRcdFx0aW5zdC5kYXRlcy5wdXNoKCBjaGVja19vdXRfZGF0ZSApOyBcdFx0XHQvLyBOZWVkIGFkZCBvbmUgYWRkaXRpb25hbCBTQU1FIGRhdGUgZm9yIGNvcnJlY3QgIHdvcmtzIG9mIGRhdGVzIHNlbGVjdGlvbiAhISEhIVxyXG5cclxuXHRcdFx0dmFyIGNoZWNrb3V0X3RpbWVzdGFtcCA9IGNoZWNrX291dF9kYXRlLmdldFRpbWUoKTtcclxuXHRcdFx0dmFyIHRkX2NlbGwgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19vdXRfZGF0ZSApO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrb3V0X3RpbWVzdGFtcCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRpZiAoIDAgIT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdC8vIFNjcm9sbCB0byBzcGVjaWZpYyBtb250aCwgaWYgd2Ugc2V0IGRhdGVzIGluIHNvbWUgZnV0dXJlIG1vbnRoc1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBpbnN0LmRhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSwgaW5zdC5kYXRlc1sgMCBdLmdldE1vbnRoKCkrMSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICkubGVuZ3RoO1xuXHR9XHJcblxyXG5cdHJldHVybiAwO1xyXG59XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBIVE1MIHRkIGVsZW1lbnQgKHdoZXJlIHdhcyBjbGljayBpbiBjYWxlbmRhciAgZGF5ICBjZWxsKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX2h0bWxfaWRcdFx0XHQnY2FsZW5kYXJfYm9va2luZzEnXHJcblx0ICogQHBhcmFtIGRhdGVfanNcdFx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHsqfGpRdWVyeX1cdFx0XHRcdERvbSBIVE1MIHRkIGVsZW1lbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9jbGlja2VkX3RkKCBjYWxlbmRhcl9odG1sX2lkLCBkYXRlX2pzICl7XHJcblxyXG5cdCAgICB2YXIgdGRfY2VsbCA9IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfaHRtbF9pZCArICcgLnNxbF9kYXRlXycgKyB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlX2pzICkgKS5nZXQoIDAgKTtcclxuXHJcblx0XHRyZXR1cm4gdGRfY2VsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNoZWNrX2luX3ltZFx0XHRcdFx0XHRcdFx0JzIwMjQtMDUtMTUnXHJcblx0ICogQHBhcmFtIGNoZWNrX291dF95bWRcdFx0XHRcdFx0XHRcdCcyMDI0LTA1LTI1J1xyXG5cdCAqIEBwYXJhbSBpbnN0XHRcdFx0XHRcdFx0XHRcdFx0RGF0ZXBpY2sgSW5zdC4gVXNlIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdCAqIEByZXR1cm5zIHt7ZGF0ZXNfanM6ICpbXSwgZGF0ZXNfc3RyOiAqW119fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kICwgaW5zdCApe1xyXG5cclxuXHRcdHZhciBvcmlnaW5hbF9hcnJheSA9IFtdO1xyXG5cdFx0dmFyIGRhdGU7XHJcblx0XHR2YXIgYmtfZGlzdGluY3RfZGF0ZXMgPSBbXTtcclxuXHJcblx0XHR2YXIgY2hlY2tfaW5fZGF0ZSA9IGNoZWNrX2luX3ltZC5zcGxpdCggJy0nICk7XHJcblx0XHR2YXIgY2hlY2tfb3V0X2RhdGUgPSBjaGVja19vdXRfeW1kLnNwbGl0KCAnLScgKTtcclxuXHJcblx0XHRkYXRlID0gbmV3IERhdGUoKTtcclxuXHRcdGRhdGUuc2V0RnVsbFllYXIoIGNoZWNrX2luX2RhdGVbIDAgXSwgKGNoZWNrX2luX2RhdGVbIDEgXSAtIDEpLCBjaGVja19pbl9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgPSBkYXRlO1xyXG5cdFx0b3JpZ2luYWxfYXJyYXkucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBkYXRlLCBudWxsICkgKSApOyAvL2FkZCBkYXRlXHJcblx0XHRpZiAoICEgd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChjaGVja19pbl9kYXRlWyAyIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAxIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0pICkgKXtcclxuXHRcdFx0YmtfZGlzdGluY3RfZGF0ZXMucHVzaCggcGFyc2VJbnQoY2hlY2tfaW5fZGF0ZVsgMiBdKSArICcuJyArIHBhcnNlSW50KGNoZWNrX2luX2RhdGVbIDEgXSkgKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0gKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZGF0ZV9vdXQgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0ZGF0ZV9vdXQuc2V0RnVsbFllYXIoIGNoZWNrX291dF9kYXRlWyAwIF0sIChjaGVja19vdXRfZGF0ZVsgMSBdIC0gMSksIGNoZWNrX291dF9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID0gZGF0ZV9vdXQ7XHJcblxyXG5cdFx0dmFyIG1ld0RhdGUgPSBuZXcgRGF0ZSggb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXRGdWxsWWVhcigpLCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldE1vbnRoKCksIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICk7XHJcblx0XHRtZXdEYXRlLnNldERhdGUoIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICsgMSApO1xyXG5cclxuXHRcdHdoaWxlIChcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID4gZGF0ZSkgJiZcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgIT0gb3JpZ2luYWxfY2hlY2tfb3V0X2RhdGUpICl7XHJcblx0XHRcdGRhdGUgPSBuZXcgRGF0ZSggbWV3RGF0ZS5nZXRGdWxsWWVhcigpLCBtZXdEYXRlLmdldE1vbnRoKCksIG1ld0RhdGUuZ2V0RGF0ZSgpICk7XHJcblxyXG5cdFx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCBqUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGRhdGUsIG51bGwgKSApICk7IC8vYWRkIGRhdGVcclxuXHRcdFx0aWYgKCAhd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChkYXRlLmdldERhdGUoKSArICcuJyArIHBhcnNlSW50KCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLicgKyBkYXRlLmdldEZ1bGxZZWFyKCkpICkgKXtcclxuXHRcdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCAocGFyc2VJbnQoZGF0ZS5nZXREYXRlKCkpICsgJy4nICsgcGFyc2VJbnQoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICcuJyArIGRhdGUuZ2V0RnVsbFllYXIoKSkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWV3RGF0ZSA9IG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKTtcclxuXHRcdFx0bWV3RGF0ZS5zZXREYXRlKCBtZXdEYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHRcdG9yaWdpbmFsX2FycmF5LnBvcCgpO1xyXG5cdFx0YmtfZGlzdGluY3RfZGF0ZXMucG9wKCk7XHJcblxyXG5cdFx0cmV0dXJuIHsnZGF0ZXNfanMnOiBvcmlnaW5hbF9hcnJheSwgJ2RhdGVzX3N0cic6IGJrX2Rpc3RpbmN0X2RhdGVzfTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVzX3RvX3NlbGVjdF9hcnJcdD0gWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXVxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3tkYXRlc19qczogKltdLCBkYXRlc19zdHI6ICpbXX19XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfc2VsZWN0aW9uX2RhdGVzX2pzX3N0cl9hcnJfX2Zyb21fYXJyKCBkYXRlc190b19zZWxlY3RfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cclxuXHRcdHZhciBvcmlnaW5hbF9hcnJheSAgICA9IFtdO1xyXG5cdFx0dmFyIGJrX2Rpc3RpbmN0X2RhdGVzID0gW107XHJcblx0XHR2YXIgb25lX2RhdGVfc3RyO1xyXG5cclxuXHRcdGZvciAoIHZhciBkID0gMDsgZCA8IGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoOyBkKysgKXtcclxuXHJcblx0XHRcdG9yaWdpbmFsX2FycmF5LnB1c2goIHdwYmNfX2dldF9fanNfZGF0ZSggZGF0ZXNfdG9fc2VsZWN0X2FyclsgZCBdICkgKTtcclxuXHJcblx0XHRcdG9uZV9kYXRlX3N0ciA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIGQgXS5zcGxpdCgnLScpXHJcblx0XHRcdGlmICggISB3cGJjX2luX2FycmF5KCBia19kaXN0aW5jdF9kYXRlcywgKG9uZV9kYXRlX3N0clsgMiBdICsgJy4nICsgb25lX2RhdGVfc3RyWyAxIF0gKyAnLicgKyBvbmVfZGF0ZV9zdHJbIDAgXSkgKSApe1xyXG5cdFx0XHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnB1c2goIHBhcnNlSW50KG9uZV9kYXRlX3N0clsgMiBdKSArICcuJyArIHBhcnNlSW50KG9uZV9kYXRlX3N0clsgMSBdKSArICcuJyArIG9uZV9kYXRlX3N0clsgMCBdICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4geydkYXRlc19qcyc6IG9yaWdpbmFsX2FycmF5LCAnZGF0ZXNfc3RyJzogb3JpZ2luYWxfYXJyYXl9O1xyXG5cdH1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vKiAgPT0gIEF1dG8gRmlsbCBGaWVsZHMgLyBBdXRvIFNlbGVjdCBEYXRlcyAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHR2YXIgdXJsX3BhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2ggKTtcclxuXHJcblx0Ly8gRGlzYWJsZSBkYXlzIHNlbGVjdGlvbiAgaW4gY2FsZW5kYXIsICBhZnRlciAgcmVkaXJlY3Rpb24gIGZyb20gIHRoZSBcIlNlYXJjaCByZXN1bHRzIHBhZ2UsICBhZnRlciAgc2VhcmNoICBhdmFpbGFiaWxpdHlcIiBcdFx0XHQvLyBGaXhJbjogOC44LjIuMy5cclxuXHRpZiAgKCAnT24nICE9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfYm9va2luZ19zZWFyY2hfcmVzdWx0c19kYXlzX3NlbGVjdCcgKSApIHtcclxuXHRcdGlmIChcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NoZWNrX2luJyApICkgJiZcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NoZWNrX291dCcgKSApICYmXHJcblx0XHRcdCggdXJsX3BhcmFtcy5oYXMoICd3cGJjX3NlbGVjdF9jYWxlbmRhcl9pZCcgKSApXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0dmFyIHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCA9IHBhcnNlSW50KCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NhbGVuZGFyX2lkJyApICk7XHJcblxyXG5cdFx0XHQvLyBGaXJlIG9uIGFsbCBib29raW5nIGRhdGVzIGxvYWRlZFxyXG5cdFx0XHRqUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24gKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHRcdGlmICggbG9hZGVkX3Jlc291cmNlX2lkID09IHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCApe1xyXG5cdFx0XHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkLCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NoZWNrX2luJyApLCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NoZWNrX291dCcgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKFxuXHRcdHVybF9wYXJhbXMuaGFzKCAnd3BiY19hdXRvX2ZpbGwnIClcblx0XHQmJiAhIGpRdWVyeSggJ2JvZHknICkuaGFzQ2xhc3MoICd3cC1hZG1pbicgKVxuXHQpe1xuXHJcblx0XHR2YXIgd3BiY19hdXRvX2ZpbGxfdmFsdWUgPSB1cmxfcGFyYW1zLmdldCggJ3dwYmNfYXV0b19maWxsJyApO1xyXG5cclxuXHRcdC8vIENvbnZlcnQgYmFjay4gICAgIFNvbWUgc3lzdGVtcyBkbyBub3QgbGlrZSBzeW1ib2wgJ34nIGluIFVSTCwgc28gIHdlIG5lZWQgdG8gcmVwbGFjZSB0byAgc29tZSBvdGhlciBzeW1ib2xzXHJcblx0XHR3cGJjX2F1dG9fZmlsbF92YWx1ZSA9IHdwYmNfYXV0b19maWxsX3ZhbHVlLnJlcGxhY2VBbGwoICdfXl8nLCAnficgKTtcclxuXHJcblx0XHR3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkcyggd3BiY19hdXRvX2ZpbGxfdmFsdWUgKTtcclxuXHR9XHJcblxyXG59ICk7XHJcblxyXG4vKipcclxuICogQXV0b2ZpbGwgLyBzZWxlY3QgYm9va2luZyBmb3JtICBmaWVsZHMgYnkgIHZhbHVlcyBmcm9tICB0aGUgR0VUIHJlcXVlc3QgIHBhcmFtZXRlcjogP3dwYmNfYXV0b19maWxsPVxyXG4gKlxyXG4gKiBVUkwtcHJvdmlkZWQgZmllbGQgbmFtZXMgYXJlIHJlc29sdmVkIHRocm91Z2ggdGhlIGV4YWN0LW5hbWUgRE9NIEFQSSBzb1xuICogdGhleSBjYW4gbmV2ZXIgYmUgaW50ZXJwcmV0ZWQgYXMgQ1NTIHNlbGVjdG9yIHN5bnRheC5cbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gYXV0b19maWxsX3N0ciBTZXJpYWxpemVkIGZpZWxkLW5hbWUgYW5kIHZhbHVlIHBhaXJzLlxuICogQHJldHVybiB7dm9pZH1cbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkcyggYXV0b19maWxsX3N0ciApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC40OC5cclxuXHJcblx0aWYgKCAnJyA9PSBhdXRvX2ZpbGxfc3RyICl7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuLy8gY29uc29sZS5sb2coICdXUEJDX0FVVE9fRklMTF9CT09LSU5HX0ZJRUxEUyggQVVUT19GSUxMX1NUUiApJywgYXV0b19maWxsX3N0cik7XHJcblxyXG5cdHZhciBmaWVsZHNfYXJyID0gd3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHNfX3BhcnNlKCBhdXRvX2ZpbGxfc3RyICk7XG5cblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgZmllbGRzX2Fyci5sZW5ndGg7IGkrKyApe1xuXHRcdHZhciBmaWVsZF9uYW1lID0gU3RyaW5nKCBmaWVsZHNfYXJyWyBpIF1bICduYW1lJyBdIHx8ICcnICk7XG5cdFx0aWYgKCAnJyA9PT0gZmllbGRfbmFtZSApIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdHZhciBmaWVsZF9lbGVtZW50cyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlOYW1lKCBmaWVsZF9uYW1lICk7XG5cdFx0aWYgKCAwIDwgZmllbGRfZWxlbWVudHMubGVuZ3RoICkge1xuXHRcdFx0alF1ZXJ5KCBmaWVsZF9lbGVtZW50cyApLnZhbCggZmllbGRzX2FyclsgaSBdWyAndmFsdWUnIF0gKTtcblx0XHR9XG5cdH1cbn1cblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIGRhdGEgZnJvbSAgZ2V0IHBhcmFtZXRlcjpcdD93cGJjX2F1dG9fZmlsbD12aXNpdG9yczIzMV4yfm1heF9jYXBhY2l0eTIzMV4yXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0YV9zdHIgICAgICA9ICAgJ3Zpc2l0b3JzMjMxXjJ+bWF4X2NhcGFjaXR5MjMxXjInO1xyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzX19wYXJzZSggZGF0YV9zdHIgKXtcclxuXHJcblx0XHR2YXIgZmlsdGVyX29wdGlvbnNfYXJyID0gW107XHJcblxyXG5cdFx0dmFyIGRhdGFfYXJyID0gZGF0YV9zdHIuc3BsaXQoICd+JyApO1xyXG5cclxuXHRcdGZvciAoIHZhciBqID0gMDsgaiA8IGRhdGFfYXJyLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHR2YXIgbXlfZm9ybV9maWVsZCA9IGRhdGFfYXJyWyBqIF0uc3BsaXQoICdeJyApO1xyXG5cclxuXHRcdFx0dmFyIGZpbHRlcl9uYW1lICA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAwIF0pKSA/IG15X2Zvcm1fZmllbGRbIDAgXSA6ICcnO1xyXG5cdFx0XHR2YXIgZmlsdGVyX3ZhbHVlID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDEgXSkpID8gbXlfZm9ybV9maWVsZFsgMSBdIDogJyc7XHJcblxyXG5cdFx0XHRmaWx0ZXJfb3B0aW9uc19hcnIucHVzaChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgIDogZmlsdGVyX25hbWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWUnIDogZmlsdGVyX3ZhbHVlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0ICAgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBmaWx0ZXJfb3B0aW9uc19hcnI7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBkYXRhIGZyb20gIGdldCBwYXJhbWV0ZXI6XHQ/c2VhcmNoX2dldF9fY3VzdG9tX3BhcmFtcz0uLi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRhX3N0ciAgICAgID0gICAndGV4dF5zZWFyY2hfZmllbGRfX2Rpc3BsYXlfY2hlY2tfaW5eMjMuMDUuMjAyNH50ZXh0XnNlYXJjaF9maWVsZF9fZGlzcGxheV9jaGVja19vdXReMjYuMDUuMjAyNH5zZWxlY3Rib3gtb25lXnNlYXJjaF9xdWFudGl0eV4yfnNlbGVjdGJveC1vbmVebG9jYXRpb25eU3BhaW5+c2VsZWN0Ym94LW9uZV5tYXhfY2FwYWNpdHleMn5zZWxlY3Rib3gtb25lXmFtZW5pdHlecGFya2luZ35jaGVja2JveF5zZWFyY2hfZmllbGRfX2V4dGVuZF9zZWFyY2hfZGF5c141fnN1Ym1pdF5eU2VhcmNofmhpZGRlbl5zZWFyY2hfZ2V0X19jaGVja19pbl95bWReMjAyNC0wNS0yM35oaWRkZW5ec2VhcmNoX2dldF9fY2hlY2tfb3V0X3ltZF4yMDI0LTA1LTI2fmhpZGRlbl5zZWFyY2hfZ2V0X190aW1lXn5oaWRkZW5ec2VhcmNoX2dldF9fcXVhbnRpdHleMn5oaWRkZW5ec2VhcmNoX2dldF9fZXh0ZW5kXjV+aGlkZGVuXnNlYXJjaF9nZXRfX3VzZXJzX2lkXn5oaWRkZW5ec2VhcmNoX2dldF9fY3VzdG9tX3BhcmFtc15+JztcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2F1dG9fZmlsbF9zZWFyY2hfZmllbGRzX19wYXJzZSggZGF0YV9zdHIgKXtcclxuXHJcblx0XHR2YXIgZmlsdGVyX29wdGlvbnNfYXJyID0gW107XHJcblxyXG5cdFx0dmFyIGRhdGFfYXJyID0gZGF0YV9zdHIuc3BsaXQoICd+JyApO1xyXG5cclxuXHRcdGZvciAoIHZhciBqID0gMDsgaiA8IGRhdGFfYXJyLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHR2YXIgbXlfZm9ybV9maWVsZCA9IGRhdGFfYXJyWyBqIF0uc3BsaXQoICdeJyApO1xyXG5cclxuXHRcdFx0dmFyIGZpbHRlcl90eXBlICA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAwIF0pKSA/IG15X2Zvcm1fZmllbGRbIDAgXSA6ICcnO1xyXG5cdFx0XHR2YXIgZmlsdGVyX25hbWUgID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDEgXSkpID8gbXlfZm9ybV9maWVsZFsgMSBdIDogJyc7XHJcblx0XHRcdHZhciBmaWx0ZXJfdmFsdWUgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMiBdKSkgPyBteV9mb3JtX2ZpZWxkWyAyIF0gOiAnJztcclxuXHJcblx0XHRcdGZpbHRlcl9vcHRpb25zX2Fyci5wdXNoKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgOiBmaWx0ZXJfdHlwZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgOiBmaWx0ZXJfbmFtZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZScgOiBmaWx0ZXJfdmFsdWVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQgICApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZpbHRlcl9vcHRpb25zX2FycjtcclxuXHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgQXV0byBVcGRhdGUgbnVtYmVyIG9mIG1vbnRocyBpbiBjYWxlbmRhcnMgT04gc2NyZWVuIHNpemUgY2hhbmdlZCAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogQXV0byBVcGRhdGUgTnVtYmVyIG9mIE1vbnRocyBpbiBDYWxlbmRhciwgZS5nLjogIFx0XHRpZiAgICAoIFdJTkRPV19XSURUSCA8PSA3ODJweCApICAgPj4+IFx0TU9OVEhTX05VTUJFUiA9IDFcclxuICogICBFTFNFOiAgbnVtYmVyIG9mIG1vbnRocyBkZWZpbmVkIGluIHNob3J0Y29kZS5cclxuICogQHBhcmFtIHJlc291cmNlX2lkIGludFxyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fYXV0b191cGRhdGVfbW9udGhzX251bWJlcl9fb25fcmVzaXplKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRpZiAoIHRydWUgPT09IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2lzX2FsbG93X3NldmVyYWxfbW9udGhzX29uX21vYmlsZScgKSApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdHZhciBsb2NhbF9fbnVtYmVyX29mX21vbnRocyA9IHBhcnNlSW50KCBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX251bWJlcl9vZl9tb250aHMnICkgKTtcclxuXHJcblx0aWYgKCBsb2NhbF9fbnVtYmVyX29mX21vbnRocyA+IDEgKXtcclxuXHJcblx0XHRpZiAoIGpRdWVyeSggd2luZG93ICkud2lkdGgoKSA8PSA3ODIgKXtcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fdXBkYXRlX21vbnRoc19udW1iZXIoIHJlc291cmNlX2lkLCAxICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzICk7XHJcblx0XHR9XHJcblxyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEF1dG8gVXBkYXRlIE51bWJlciBvZiBNb250aHMgaW4gICBBTEwgICBDYWxlbmRhcnNcclxuICpcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJzX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyKCl7XHJcblxyXG5cdHZhciBhbGxfY2FsZW5kYXJzX2FyciA9IF93cGJjLmNhbGVuZGFyc19hbGxfX2dldCgpO1xyXG5cclxuXHQvLyBUaGlzIExPT1AgXCJmb3IgaW5cIiBpcyBHT09ELCBiZWNhdXNlIHdlIGNoZWNrICBoZXJlIGtleXMgICAgJ2NhbGVuZGFyXycgPT09IGNhbGVuZGFyX2lkLnNsaWNlKCAwLCA5IClcclxuXHRmb3IgKCB2YXIgY2FsZW5kYXJfaWQgaW4gYWxsX2NhbGVuZGFyc19hcnIgKXtcclxuXHRcdGlmICggJ2NhbGVuZGFyXycgPT09IGNhbGVuZGFyX2lkLnNsaWNlKCAwLCA5ICkgKXtcclxuXHRcdFx0dmFyIHJlc291cmNlX2lkID0gcGFyc2VJbnQoIGNhbGVuZGFyX2lkLnNsaWNlKCA5ICkgKTtcdFx0XHQvLyAgJ2NhbGVuZGFyXzMnIC0+IDNcclxuXHRcdFx0aWYgKCByZXNvdXJjZV9pZCA+IDAgKXtcclxuXHRcdFx0XHR3cGJjX2NhbGVuZGFyX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyX19vbl9yZXNpemUoIHJlc291cmNlX2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJZiBicm93c2VyIHdpbmRvdyBjaGFuZ2VkLCAgdGhlbiAgdXBkYXRlIG51bWJlciBvZiBtb250aHMuXHJcbiAqL1xyXG5qUXVlcnkoIHdpbmRvdyApLm9uKCAncmVzaXplJywgZnVuY3Rpb24gKCl7XHJcblx0d3BiY19jYWxlbmRhcnNfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXIoKTtcclxufSApO1xyXG5cclxuLyoqXHJcbiAqIEF1dG8gdXBkYXRlIGNhbGVuZGFyIG51bWJlciBvZiBtb250aHMgb24gaW5pdGlhbCBwYWdlIGxvYWRcclxuICovXHJcbmpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCl7XHJcblx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0d3BiY19jYWxlbmRhcnNfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXIoKTtcclxuXHR9LCAxMDAgKTtcclxufSk7XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBDaGVjazogY2FsZW5kYXJfZGF0ZXNfc3RhcnQ6IFwiMjAyNi0wMS0wMVwiLCBjYWxlbmRhcl9kYXRlc19lbmQ6IFwiMjAyNi0xMi0zMVwiID09ICAvLyBGaXhJbjogMTAuMTMuMS40LlxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHQvKipcclxuXHQgKiBHZXQgU3RhcnQgSlMgRGF0ZSBvZiBzdGFydGluZyBkYXRlcyBpbiBjYWxlbmRhciwgZnJvbSB0aGUgX3dwYmMgb2JqZWN0LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGludGVnZXIgcmVzb3VyY2VfaWQgLSByZXNvdXJjZSBJRCwgZS5nLjogMS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHJlc291cmNlX2lkICkge1xyXG5cdFx0cmV0dXJuIHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlX3BhcmFtZXRlciggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9kYXRlc19zdGFydCcgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBFbmQgSlMgRGF0ZSBvZiBlbmRpbmcgZGF0ZXMgaW4gY2FsZW5kYXIsIGZyb20gdGhlIF93cGJjIG9iamVjdC5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBpbnRlZ2VyIHJlc291cmNlX2lkIC0gcmVzb3VyY2UgSUQsIGUuZy46IDEuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZChyZXNvdXJjZV9pZCkge1xyXG5cdFx0cmV0dXJuIHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlX3BhcmFtZXRlciggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9kYXRlc19lbmQnICk7XHJcblx0fVxyXG5cclxuLyoqXHJcbiAqIEdldCB2YWxpZGF0ZXMgZGF0ZSBwYXJhbWV0ZXIuXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCAgIC0gMVxyXG4gKiBAcGFyYW0gcGFyYW1ldGVyX3N0ciAtICdjYWxlbmRhcl9kYXRlc19zdGFydCcgfCAnY2FsZW5kYXJfZGF0ZXNfZW5kJyB8IC4uLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVfcGFyYW1ldGVyKHJlc291cmNlX2lkLCBwYXJhbWV0ZXJfc3RyKSB7XHJcblxyXG5cdHZhciBkYXRlX2V4cGVjdGVkX3ltZCA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCBwYXJhbWV0ZXJfc3RyICk7XHJcblxyXG5cdGlmICggISBkYXRlX2V4cGVjdGVkX3ltZCApIHtcclxuXHRcdHJldHVybiBmYWxzZTsgICAgICAgICAgICAgLy8gJycgfCAwIHwgbnVsbCB8IHVuZGVmaW5lZCAgLT4gZmFsc2UuXHJcblx0fVxyXG5cclxuXHRpZiAoIC0xICE9PSBkYXRlX2V4cGVjdGVkX3ltZC5pbmRleE9mKCAnLScgKSApIHtcclxuXHJcblx0XHR2YXIgZGF0ZV9leHBlY3RlZF95bWRfYXJyID0gZGF0ZV9leHBlY3RlZF95bWQuc3BsaXQoICctJyApO1x0Ly8gJzIwMjUtMDctMjYnIC0+IFsnMjAyNScsICcwNycsICcyNiddXHJcblxyXG5cdFx0aWYgKCBkYXRlX2V4cGVjdGVkX3ltZF9hcnIubGVuZ3RoID4gMCApIHtcclxuXHRcdFx0dmFyIHllYXIgID0gKGRhdGVfZXhwZWN0ZWRfeW1kX2Fyci5sZW5ndGggPiAwKSA/IHBhcnNlSW50KCBkYXRlX2V4cGVjdGVkX3ltZF9hcnJbMF0gKSA6IG5ldyBEYXRlKCkuZ2V0RnVsbFllYXIoKTtcdC8vIFllYXIuXHJcblx0XHRcdHZhciBtb250aCA9IChkYXRlX2V4cGVjdGVkX3ltZF9hcnIubGVuZ3RoID4gMSkgPyAocGFyc2VJbnQoIGRhdGVfZXhwZWN0ZWRfeW1kX2FyclsxXSApIC0gMSkgOiAwOyAgLy8gKG1vbnRoIC0gMSkgb3IgMCAtIEphbi5cclxuXHRcdFx0dmFyIGRheSAgID0gKGRhdGVfZXhwZWN0ZWRfeW1kX2Fyci5sZW5ndGggPiAyKSA/IHBhcnNlSW50KCBkYXRlX2V4cGVjdGVkX3ltZF9hcnJbMl0gKSA6IDE7ICAvLyBkYXRlIG9yIE90aGVyd2lzZSAxc3Qgb2YgbW9udGhcclxuXHJcblx0XHRcdHZhciBkYXRlX2pzID0gbmV3IERhdGUoIHllYXIsIG1vbnRoLCBkYXksIDAsIDAsIDAsIDAgKTtcclxuXHJcblx0XHRcdHJldHVybiBkYXRlX2pzO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIGZhbHNlOyAgLy8gRmFsbGJhY2ssICBpZiB3ZSBub3QgcGFyc2VkIHRoaXMgcGFyYW1ldGVyICAnY2FsZW5kYXJfZGF0ZXNfc3RhcnQnID0gJzIwMjUtMDctMjYnLCAgZm9yIGV4YW1wbGUgYmVjYXVzZSBvZiAnY2FsZW5kYXJfZGF0ZXNfc3RhcnQnID0gJ3Nmc2RmJy5cclxufVxyXG4iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsL2RheXNfc2VsZWN0X2N1c3RvbS5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIEZpeEluOiA5LjguOS4yLlxyXG5cclxuLyoqXHJcbiAqIFJlLUluaXQgQ2FsZW5kYXIgYW5kIFJlLVJlbmRlciBpdC5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gUmVtb3ZlIENMQVNTICBmb3IgYWJpbGl0eSB0byByZS1yZW5kZXIgYW5kIHJlaW5pdCBjYWxlbmRhci5cclxuXHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnaGFzRGF0ZXBpY2snICk7XHJcblx0d3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFJlLUluaXQgcHJldmlvdXNseSAgc2F2ZWQgZGF5cyBzZWxlY3Rpb24gIHZhcmlhYmxlcy5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdzYXZlZF92YXJpYWJsZV9fX2RheXNfc2VsZWN0X2luaXRpYWwnXHJcblx0XHQsIHtcclxuXHRcdFx0J2R5bmFtaWNfX2RheXNfbWluJyAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJyApLFxyXG5cdFx0XHQnZHluYW1pY19fZGF5c19tYXgnICAgICAgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnICksXHJcblx0XHRcdCdkeW5hbWljX19kYXlzX3NwZWNpZmljJyAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJyApLFxyXG5cdFx0XHQnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCc6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcgKSxcclxuXHRcdFx0J2ZpeGVkX19kYXlzX251bScgICAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2ZpeGVkX19kYXlzX251bScgKSxcclxuXHRcdFx0J2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JyAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JyApXHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IFNpbmdsZSBEYXkgc2VsZWN0aW9uIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fc2luZ2xlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCBTaW5nbGUgRGF5IHNlbGVjdGlvblxyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ3NpbmdsZSd9ICk7XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgTXVsdGlwbGUgRGF5cyBzZWxlY3Rpb24gIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2V0IE11bHRpcGxlIERheXMgc2VsZWN0aW9uXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdtdWx0aXBsZSd9ICk7XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IEZpeGVkIERheXMgc2VsZWN0aW9uIHdpdGggIDEgbW91c2UgY2xpY2sgIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICAtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcikgLVxyXG4gKiBAaW50ZWdlciBkYXlzX251bWJlclx0XHRcdC0gM1x0XHRcdFx0ICAgLS0gbnVtYmVyIG9mIGRheXMgdG8gIHNlbGVjdFx0LVxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0LSBbLTFdIHwgWyAxLCA1XSAgIC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19maXhlZCggcmVzb3VyY2VfaWQsIGRheXNfbnVtYmVyLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkKCByZXNvdXJjZV9pZCwgZGF5c19udW1iZXIsIHdlZWtfZGF5c19fc3RhcnQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZXQgRml4ZWQgRGF5cyBzZWxlY3Rpb24gd2l0aCAgMSBtb3VzZSBjbGlja1xyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgLS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpIC1cclxuICogQGludGVnZXIgZGF5c19udW1iZXJcdFx0XHQtIDNcdFx0XHRcdCAgIC0tIG51bWJlciBvZiBkYXlzIHRvICBzZWxlY3RcdC1cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdC0gWy0xXSB8IFsgMSwgNV0gICAtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fZml4ZWQoIHJlc291cmNlX2lkLCBkYXlzX251bWJlciwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ2ZpeGVkJ30gKTtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydmaXhlZF9fZGF5c19udW0nOiBwYXJzZUludCggZGF5c19udW1iZXIgKX0gKTtcdFx0XHQvLyBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAxIG1vdXNlIGNsaWNrXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydmaXhlZF9fd2Vla19kYXlzX19zdGFydCc6IHdlZWtfZGF5c19fc3RhcnR9ICk7IFx0Ly8geyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBTZXQgdGhlIGV4aXN0aW5nIGNhbGVuZGFyIHBhcmFtZXRlcnMgdG8gdHdvLWNsaWNrIHJhbmdlIG1vZGUgYWZ0ZXIgcGFnZSBsb2FkLlxuICogRnJlZSB1c2VzIHRoZSB1bnJlc3RyaWN0ZWQgc2hhcmVkIGhhbmRsZXI7IEJ1c2luZXNzIFNtYWxsKyBrZWVwcyBpdHMgYWxyZWFkeSBpbml0aWFsaXplZCBhZHZhbmNlZCByYW5nZSBydWxlcy5cbiAqXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgSUQgb2YgYm9va2luZyByZXNvdXJjZS5cbiAqL1xuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX3JhbmdlX21vZGUoIHJlc291cmNlX2lkICl7XG5cblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZV9tb2RlKCByZXNvdXJjZV9pZCApO1xuXHRcdH0sIDEwMDApO1xuXHR9KTtcbn1cblxuLyoqXG4gKiBTd2l0Y2ggdG8gdHdvLWNsaWNrIHJhbmdlIG1vZGUgd2l0aG91dCBjaGFuZ2luZyBhbnkgYWR2YW5jZWQgcmFuZ2UgcGFyYW1ldGVycy5cbiAqXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgSUQgb2YgYm9va2luZyByZXNvdXJjZS5cbiAqL1xuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlX21vZGUoIHJlc291cmNlX2lkICl7XG5cblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ2R5bmFtaWMnfSApO1xuXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogU2V0IFJhbmdlIERheXMgc2VsZWN0aW9uICB3aXRoICAyIG1vdXNlIGNsaWNrcyAgLSBhZnRlciBwYWdlIGxvYWRcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICBcdFx0LS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpXHJcbiAqIEBpbnRlZ2VyIGRheXNfbWluXHRcdFx0LSA3XHRcdFx0XHQgICBcdFx0LS0gTWluIG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAaW50ZWdlciBkYXlzX21heFx0XHRcdC0gMzBcdFx0XHQgICBcdFx0LS0gTWF4IG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAYXJyYXkgZGF5c19zcGVjaWZpY1x0XHRcdC0gW10gfCBbNywxNCwyMSwyOF1cdFx0LS0gUmVzdHJpY3Rpb24gZm9yIFNwZWNpZmljIG51bWJlciBvZiBkYXlzIHNlbGVjdGlvblxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0XHQtIFstMV0gfCBbIDEsIDVdICAgXHRcdC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYyA9IFtdLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlKCByZXNvdXJjZV9pZCwgZGF5c19taW4sIGRheXNfbWF4LCBkYXlzX3NwZWNpZmljLCB3ZWVrX2RheXNfX3N0YXJ0ICk7XHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCBSYW5nZSBEYXlzIHNlbGVjdGlvbiAgd2l0aCAgMiBtb3VzZSBjbGlja3NcclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIFx0XHQtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcilcclxuICogQGludGVnZXIgZGF5c19taW5cdFx0XHQtIDdcdFx0XHRcdCAgIFx0XHQtLSBNaW4gbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBpbnRlZ2VyIGRheXNfbWF4XHRcdFx0LSAzMFx0XHRcdCAgIFx0XHQtLSBNYXggbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBhcnJheSBkYXlzX3NwZWNpZmljXHRcdFx0LSBbXSB8IFs3LDE0LDIxLDI4XVx0XHQtLSBSZXN0cmljdGlvbiBmb3IgU3BlY2lmaWMgbnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHRcdC0gWy0xXSB8IFsgMSwgNV0gICBcdFx0LS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlKCByZXNvdXJjZV9pZCwgZGF5c19taW4sIGRheXNfbWF4LCBkYXlzX3NwZWNpZmljID0gW10sIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnZHluYW1pYyd9ICApO1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19taW4nICAgICAgICAgLCBwYXJzZUludCggZGF5c19taW4gKSAgKTsgICAgICAgICAgIFx0XHQvLyBNaW4uIE51bWJlciBvZiBkYXlzIHNlbGVjdGlvbiB3aXRoIDIgbW91c2UgY2xpY2tzXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21heCcgICAgICAgICAsIHBhcnNlSW50KCBkYXlzX21heCApICApOyAgICAgICAgICBcdFx0Ly8gTWF4LiBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAyIG1vdXNlIGNsaWNrc1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19zcGVjaWZpYycgICAgLCBkYXlzX3NwZWNpZmljICApO1x0ICAgICAgXHRcdFx0XHQvLyBFeGFtcGxlIFs1LDddXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JyAsIHdlZWtfZGF5c19fc3RhcnQgICk7ICBcdFx0XHRcdFx0Ly8geyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcbiIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9jYWxfYWp4X2xvYWQvd3BiY19jYWxfYWp4LmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vICBBIGogYSB4ICAgIEwgbyBhIGQgICAgQyBhIGwgZSBuIGQgYSByICAgIEQgYSB0IGFcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCggcGFyYW1zICl7XHJcblxyXG5cdC8vIEZpeEluOiA5LjguNi4yLlxyXG5cdHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0YXJ0KCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKTtcclxuXHJcblx0Ly8gVHJpZ2dlciBldmVudCBmb3IgY2FsZW5kYXIgYmVmb3JlIGxvYWRpbmcgQm9va2luZyBkYXRhLCAgYnV0IGFmdGVyIHNob3dpbmcgQ2FsZW5kYXIuXHJcblx0aWYgKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKS5sZW5ndGggPiAwICl7XHJcblx0XHR2YXIgdGFyZ2V0X2VsbSA9IGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggXCJ3cGJjX2NhbGVuZGFyX2FqeF9fYmVmb3JlX2xvYWRlZF9kYXRhXCIsIFtwYXJhbXNbJ3Jlc291cmNlX2lkJ11dICk7XHJcblx0XHQgLy9qUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2JlZm9yZV9sb2FkZWRfZGF0YScsIGZ1bmN0aW9uKCBldmVudCwgcmVzb3VyY2VfaWQgKSB7IC4uLiB9ICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHdwYmNfYmFsYW5jZXJfX2lzX3dhaXQoIHBhcmFtcyAsICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCcgKSApe1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gRml4SW46IDkuOC42LjIuXHJcblx0d3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gPT0gR2V0IHN0YXJ0IC8gZW5kIGRhdGVzIGZyb20gIHRoZSBCb29raW5nIENhbGVuZGFyIHNob3J0Y29kZS4gPT1cclxuXHQvLyBFeGFtcGxlOiBbYm9va2luZyBjYWxlbmRhcl9kYXRlc19zdGFydD0nMjAyNi0wMS0wMScgY2FsZW5kYXJfZGF0ZXNfZW5kPScyMDI2LTEyLTMxJyAgcmVzb3VyY2VfaWQ9MV0gICAgICAgICAgICAgIC8vIEZpeEluOiAxMC4xMy4xLjQuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRpZiAoIGZhbHNlICE9PSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApICkge1xyXG5cdFx0aWYgKCAhIHBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXSApIHsgcGFyYW1zWydkYXRlc190b19jaGVjayddID0gW107IH1cclxuXHRcdHZhciBkYXRlc19zdGFydCA9IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19zdGFydCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7ICAvLyBFLmcuIC0gbG9jYWxfX21pbl9kYXRlID0gbmV3IERhdGUoIDIwMjUsIDAsIDEgKTtcclxuXHRcdGlmICggZmFsc2UgIT09IGRhdGVzX3N0YXJ0ICl7XHJcblx0XHRcdHBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXVswXSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGVzX3N0YXJ0ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cdGlmICggZmFsc2UgIT09IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19lbmQoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApICkge1xyXG5cdFx0aWYgKCAhcGFyYW1zWydkYXRlc190b19jaGVjayddICkgeyBwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ10gPSBbXTsgfVxyXG5cdFx0dmFyIGRhdGVzX2VuZCA9IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19lbmQoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApOyAgLy8gRS5nLiAtIGxvY2FsX19taW5fZGF0ZSA9IG5ldyBEYXRlKCAyMDI1LCAwLCAxICk7XHJcblx0XHRpZiAoIGZhbHNlICE9PSBkYXRlc19lbmQgKSB7XHJcblx0XHRcdHBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXVsxXSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGVzX2VuZCApO1xyXG5cdFx0XHRpZiAoICFwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ11bMF0gKSB7XHJcblx0XHRcdFx0cGFyYW1zWydkYXRlc190b19jaGVjayddWzBdID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggbmV3IERhdGUoKSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vLyBjb25zb2xlLmdyb3VwRW5kKCk7IGNvbnNvbGUudGltZSgncmVzb3VyY2VfaWRfJyArIHBhcmFtc1sncmVzb3VyY2VfaWQnXSk7XHJcbmNvbnNvbGUuZ3JvdXBDb2xsYXBzZWQoICdXUEJDX0FKWF9DQUxFTkRBUl9MT0FEJyApOyBjb25zb2xlLmxvZyggJyA9PSBCZWZvcmUgQWpheCBTZW5kIC0gY2FsZW5kYXJzX2FsbF9fZ2V0KCkgPT0gJyAsIF93cGJjLmNhbGVuZGFyc19hbGxfX2dldCgpICk7XHJcblx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IpICkge1xyXG5cdFx0d3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcigpO1xyXG5cdH1cclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9DQUxFTkRBUl9MT0FEJyxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X3VzZXJfaWQ6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSxcclxuXHJcblx0XHRcdFx0XHRjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyA6IHBhcmFtcyBcdFx0XHRcdFx0XHQvLyBVc3VhbGx5IGxpa2U6IHsgJ3Jlc291cmNlX2lkJzogMSwgJ21heF9kYXlzX2NvdW50JzogMzY1IH1cclxuXHRcdFx0XHR9LFxyXG5cclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjaC5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcbi8vIGNvbnNvbGUudGltZUVuZCgncmVzb3VyY2VfaWRfJyArIHJlc3BvbnNlX2RhdGFbJ3Jlc291cmNlX2lkJ10pO1xyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9DQUxFTkRBUl9MT0FEID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHRcdFx0XHRcdC8vIEZpeEluOiA5LjguNi4yLlxyXG5cdFx0XHRcdFx0dmFyIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0d3BiY19iYWxhbmNlcl9fY29tcGxldGVkKCBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCAsICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCcgKTtcclxuXHJcblx0XHRcdFx0XHR2YXIgaXNfdmFsaWRfcmVzcG9uc2UgPSAoXG5cdFx0XHRcdFx0XHRcdCh0eXBlb2YgcmVzcG9uc2VfZGF0YSA9PT0gJ29iamVjdCcpXG5cdFx0XHRcdFx0XHQgJiYgKHJlc3BvbnNlX2RhdGEgIT09IG51bGwpXG5cdFx0XHRcdFx0XHQgJiYgKCEgQXJyYXkuaXNBcnJheSggcmVzcG9uc2VfZGF0YSApKVxuXHRcdFx0XHRcdFx0ICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcmVzcG9uc2VfZGF0YSwgJ3Jlc291cmNlX2lkJyApXG5cdFx0XHRcdFx0XHQgJiYgKHR5cGVvZiByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0gPT09ICdvYmplY3QnKVxuXHRcdFx0XHRcdFx0ICYmIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0gIT09IG51bGwpXG5cdFx0XHRcdFx0XHQgJiYgKCEgQXJyYXkuaXNBcnJheSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdICkpXG5cdFx0XHRcdFx0XHQgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF0sICdkYXRlcycgKVxuXHRcdFx0XHRcdFx0ICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdLCAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnIClcblx0XHRcdFx0XHRcdCAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXSwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInIClcblx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0aWYgKCAhIGlzX3ZhbGlkX3Jlc3BvbnNlICkge1xuXHRcdFx0XHRcdFx0dmFyIGpxX25vZGUgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcblx0XHRcdFx0XHRcdHZhciByZXNwb25zZV9lcnJvcl9tZXNzYWdlID0gX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX3VuZXhwZWN0ZWRfc2VydmVyX3Jlc3BvbnNlJyApIHx8ICdUaGUgc2VydmVyIHJldHVybmVkIGFuIHVuZXhwZWN0ZWQgcmVzcG9uc2UuIFBsZWFzZSByZWxvYWQgdGhlIHBhZ2UgYW5kIHRyeSBhZ2Fpbi4nO1xuXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fbG9nX3VuZXhwZWN0ZWRfYWpheF9yZXNwb25zZSggJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnLCByZXNwb25zZV9kYXRhLCBqcVhIUiwgdGV4dFN0YXR1cywgJ0ludmFsaWQgcmVzcG9uc2Ugc3RydWN0dXJlJyApO1xuXHRcdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RvcCggYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgKTtcblxuXHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZXJyb3JfbWVzc2FnZSwgeyAndHlwZScgICAgICAgIDogJ2Vycm9yJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICdzaG93X2hlcmUnICAgOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICdpc19hcHBlbmQnICAgOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3N0eWxlJyAgICAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICdjb250ZW50X21vZGUnOiAndGV4dCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAnZGVsYXknICAgICAgIDogMFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cclxuXHRcdFx0XHRcdC8vIFNob3cgQ2FsZW5kYXJcclxuXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIEJvb2tpbmdzIC0gRGF0ZXNcclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoICByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsnZGF0ZXMnXSAgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBCb29raW5ncyAtIENoaWxkIG9yIG9ubHkgc2luZ2xlIGJvb2tpbmcgcmVzb3VyY2UgaW4gZGF0ZXNcclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnLCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFnZ3JlZ2F0ZSBib29raW5nIHJlc291cmNlcywgIGlmIGFueSA/XHJcblx0XHRcdFx0XHRfd3BiYy5ib29raW5nX19zZXRfcGFyYW1fdmFsdWUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInLCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJyBdICk7XG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5cdFx0XHRcdFx0LyoqXG5cdFx0XHRcdFx0ICogQWxsb3cgb3B0aW9uYWwgbW9kdWxlcyB0byBjYWxjdWxhdGUgZGVyaXZlZCBjYWxlbmRhciBzdGF0ZSBhZnRlciBjYW5vbmljYWxcblx0XHRcdFx0XHQgKiBBSkFYIGRhdGEgaXMgc3RvcmVkIGFuZCBiZWZvcmUgdGhlIGZpcnN0IHJlZnJlc2hlZCBjYWxlbmRhciByZW5kZXIuXG5cdFx0XHRcdFx0ICpcblx0XHRcdFx0XHQgKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkIEJvb2tpbmcgcmVzb3VyY2UgSUQuXG5cdFx0XHRcdFx0ICovXG5cdFx0XHRcdFx0alF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCAnd3BiY19jYWxlbmRhcl9hanhfX2JlZm9yZV91cGRhdGVfbG9vaycsIFsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdIF0gKTtcblxuXHRcdFx0XHRcdC8vIFVwZGF0ZSBjYWxlbmRhclxuXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcblxyXG5cdFx0XHRcdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IpICkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKCk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHRcdCggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdKSApXHJcblx0XHRcdFx0XHRcdCAmJiAoICcnICE9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSApXHJcblx0XHRcdFx0XHQpe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyAgICd0eXBlJyAgICAgOiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gKSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdIDogJ2luZm8nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMTAwMDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY191cGRhdGVfY2FwYWNpdHlfaGludCkgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfdXBkYXRlX2NhcGFjaXR5X2hpbnQoIHJlc3BvbnNlX2RhdGFbJ3Jlc291cmNlX2lkJ10gKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBUcmlnZ2VyIGV2ZW50IHRoYXQgY2FsZW5kYXIgaGFzIGJlZW5cdFx0IC8vIEZpeEluOiAxMC4wLjAuNDQuICAvLyBGaXhJbjogMTAuMTQuMTcuMi5cclxuXHRcdFx0XHRcdGlmICggKGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc3BvbnNlX2RhdGFbJ3Jlc291cmNlX2lkJ10gKS5sZW5ndGggPiAwKSB8fCAoalF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNwb25zZV9kYXRhWydyZXNvdXJjZV9pZCddICkubGVuZ3RoID4gMCkgKSB7XHJcblx0XHRcdFx0XHRcdHZhciB0YXJnZXRfZWxtID0galF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCBcIndwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YVwiLCBbcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdXSApO1xyXG5cdFx0XHRcdFx0XHQgLy9qUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24oIGV2ZW50LCByZXNvdXJjZV9pZCApIHsgLi4uIH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvL2pRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7XG5cdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX2xvZ191bmV4cGVjdGVkX2FqYXhfcmVzcG9uc2UoICdXUEJDX0FKWF9DQUxFTkRBUl9MT0FEJywganFYSFIucmVzcG9uc2VUZXh0IHx8ICcnLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTtcblxyXG5cdFx0XHRcdFx0dmFyIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xuXHRcdFx0XHRcdHdwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCggYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgLCAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnICk7XG5cdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RvcCggYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgKTtcblxuXHRcdFx0XHRcdHZhciBmYWxsYmFja19lcnJvcl9tZXNzYWdlID0gX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX3VuZXhwZWN0ZWRfc2VydmVyX3Jlc3BvbnNlJyApIHx8ICdUaGUgc2VydmVyIHJldHVybmVkIGFuIHVuZXhwZWN0ZWQgcmVzcG9uc2UuIFBsZWFzZSByZWxvYWQgdGhlIHBhZ2UgYW5kIHRyeSBhZ2Fpbi4nO1xuXHRcdFx0XHRcdHZhciBjb25mbGljdF9jYWNoZV9oaW50ICAgID0gX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2h0dHBfY29uZmxpY3RfY2FjaGVfaGludCcgKSB8fCAnQSBjYWNoZWQgb3Igb3B0aW1pemVkIHZlcnNpb24gb2YgdGhpcyBwYWdlIG1heSBiZSBvdXRkYXRlZC4gQ2xlYXIgdGhlIGJyb3dzZXIgY2FjaGUgYW5kIHJlbG9hZCB0aGUgcGFnZS4gV2Vic2l0ZSBhZG1pbmlzdHJhdG9ycyBzaG91bGQgYWxzbyBwdXJnZSBwYWdlLCBzZXJ2ZXIsIGFuZCBDRE4gY2FjaGVzIGFuZCByZWdlbmVyYXRlIG1pbmlmaWVkIG9yIG9wdGltaXplZCBmaWxlcy4nO1xuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlICAgICAgICAgID0gd3BiY19mcm9udF9lbmRfX2dldF9hamF4X2Vycm9yX21lc3NhZ2UoIGpxWEhSLCBmYWxsYmFja19lcnJvcl9tZXNzYWdlLCBjb25mbGljdF9jYWNoZV9oaW50ICk7XG5cdFx0XHRcdFx0dmFyIG1lc3NhZ2Vfc2hvd19kZWxheSA9IDMwMDA7XG5cblx0XHRcdFx0XHR2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcblxyXG5cdFx0XHRcdFx0LyoqXHJcblx0XHRcdFx0XHQgKiBJZiB3ZSBtYWtlIGZhc3QgY2xpY2tpbmcgb24gZGlmZmVyZW50IHBhZ2VzLFxyXG5cdFx0XHRcdFx0ICogdGhlbiB1bmRlciBjYWxlbmRhciB3aWxsIHNob3cgZXJyb3IgbWVzc2FnZSB3aXRoICBlbXB0eSAgdGV4dCwgYmVjYXVzZSBhamF4IHdhcyBub3QgcmVjZWl2ZWQuXHJcblx0XHRcdFx0XHQgKiBUbyAgbm90IHNob3cgc3VjaCB3YXJuaW5ncyB3ZSBhcmUgc2V0IGRlbGF5ICBpbiAzIHNlY29uZHMuICB2YXIgbWVzc2FnZV9zaG93X2RlbGF5ID0gMzAwMDtcclxuXHRcdFx0XHRcdCAqL1xyXG5cdFx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICwgeyAndHlwZScgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZSc6ICd0ZXh0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH0gLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgcGFyc2VJbnQoIG1lc3NhZ2Vfc2hvd19kZWxheSApICAgKTtcclxuXHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcbn1cclxuXHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vIFN1cHBvcnRcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBDYWxlbmRhciBqUXVlcnkgbm9kZSBmb3Igc2hvd2luZyBtZXNzYWdlcyBkdXJpbmcgQWpheFxyXG5cdCAqIFRoaXMgcGFyYW1ldGVyOiAgIGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXSAgIHBhcnNlZCBmcm9tIHRoaXMuZGF0YSBBamF4IHBvc3QgIGRhdGFcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXNcdFx0ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHQnJyNjYWxlbmRhcl9ib29raW5nMScgIHwgICAnLmJvb2tpbmdfZm9ybV9kaXYnIC4uLlxyXG5cdCAqXHJcblx0ICogRXhhbXBsZSAgICB2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKXtcclxuXHJcblx0XHR2YXIganFfbm9kZSA9ICcuYm9va2luZ19mb3JtX2Rpdic7XHJcblxyXG5cdFx0dmFyIGNhbGVuZGFyX3Jlc291cmNlX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApO1xyXG5cclxuXHRcdGlmICggY2FsZW5kYXJfcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdGpxX25vZGUgPSAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcmVzb3VyY2VfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGpxX25vZGU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IHJlc291cmNlIElEIGZyb20gYWp4IHBvc3QgZGF0YSB1cmwgICB1c3VhbGx5ICBmcm9tICB0aGlzLmRhdGEgID1cclxuXHQgKiAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXNcdFx0ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdCAqIEByZXR1cm5zIHtpbnR9XHRcdFx0XHRcdFx0IDEgfCAwICAoaWYgZXJycm9yIHRoZW4gIDApXHJcblx0ICpcclxuXHQgKiBFeGFtcGxlICAgIHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKXtcclxuXHJcblx0XHQvLyBHZXQgYm9va2luZyByZXNvdXJjZSBJRCBmcm9tIEFqYXggUG9zdCBSZXF1ZXN0ICAtPiB0aGlzLmRhdGEgPSAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHRcdHZhciBjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3VyaV9wYXJhbV9ieV9uYW1lKCAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJywgYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICk7XHJcblx0XHRpZiAoIChudWxsICE9PSBjYWxlbmRhcl9yZXNvdXJjZV9pZCkgJiYgKCcnICE9PSBjYWxlbmRhcl9yZXNvdXJjZV9pZCkgKXtcclxuXHRcdFx0Y2FsZW5kYXJfcmVzb3VyY2VfaWQgPSBwYXJzZUludCggY2FsZW5kYXJfcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0aWYgKCBjYWxlbmRhcl9yZXNvdXJjZV9pZCA+IDAgKXtcclxuXHRcdFx0XHRyZXR1cm4gY2FsZW5kYXJfcmVzb3VyY2VfaWQ7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiAwO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBwYXJhbWV0ZXIgZnJvbSBVUkwgIC0gIHBhcnNlIFVSTCBwYXJhbWV0ZXJzLCAgbGlrZSB0aGlzOlxyXG5cdCAqIGFjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNcclxuXHQgKiBAcGFyYW0gbmFtZSAgcGFyYW1ldGVyICBuYW1lLCAgbGlrZSAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJ1xyXG5cdCAqIEBwYXJhbSB1cmxcdCdwYXJhbWV0ZXIgIHN0cmluZyBVUkwnXHJcblx0ICogQHJldHVybnMge3N0cmluZ3xudWxsfSAgIHBhcmFtZXRlciB2YWx1ZVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZTogXHRcdHdwYmNfZ2V0X3VyaV9wYXJhbV9ieV9uYW1lKCAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJywgdGhpcy5kYXRhICk7ICAtPiAnMidcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggbmFtZSwgdXJsICl7XHJcblxyXG5cdFx0dXJsID0gZGVjb2RlVVJJQ29tcG9uZW50KCB1cmwgKTtcclxuXHJcblx0XHRuYW1lID0gbmFtZS5yZXBsYWNlKCAvW1xcW1xcXV0vZywgJ1xcXFwkJicgKTtcclxuXHRcdHZhciByZWdleCA9IG5ldyBSZWdFeHAoICdbPyZdJyArIG5hbWUgKyAnKD0oW14mI10qKXwmfCN8JCknICksXHJcblx0XHRcdHJlc3VsdHMgPSByZWdleC5leGVjKCB1cmwgKTtcclxuXHRcdGlmICggIXJlc3VsdHMgKSByZXR1cm4gbnVsbDtcclxuXHRcdGlmICggIXJlc3VsdHNbIDIgXSApIHJldHVybiAnJztcclxuXHRcdHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoIHJlc3VsdHNbIDIgXS5yZXBsYWNlKCAvXFwrL2csICcgJyApICk7XHJcblx0fVxyXG4iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2Zyb250X2VuZF9tZXNzYWdlcy93cGJjX2ZlX21lc3NhZ2VzLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBTaG93IE1lc3NhZ2VzIGF0IEZyb250LUVkbiBzaWRlXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBFeHRyYWN0IGEgc2FmZSBwbGFpbi10ZXh0IG1lc3NhZ2UgZnJvbSBhIHJlY29nbml6ZWQgSlNPTiBBSkFYIGVycm9yIHJlc3BvbnNlLlxuICpcbiAqIE9ubHkgZG9jdW1lbnRlZCBtZXNzYWdlIHByb3BlcnRpZXMgYXJlIGFjY2VwdGVkLiBDYWxsZXJzIG11c3Qgc3RpbGwgcmVuZGVyIHRoZSByZXR1cm5lZCB2YWx1ZSBpbiB0ZXh0IG1vZGUgc28gYW5cbiAqIHVwc3RyZWFtIHJlc3BvbnNlIGNhbm5vdCBpbmplY3QgbWFya3VwIGludG8gdGhlIHB1YmxpYyBib29raW5nIHBhZ2UuXG4gKlxuICogQHBhcmFtIHtqcVhIUnxudWxsfSBqcV94aHIgalF1ZXJ5IFhIUiBvYmplY3QsIHdoZW4gYXZhaWxhYmxlLlxuICogQHJldHVybiB7c3RyaW5nfSBCb3VuZGVkIHNlcnZlciBtZXNzYWdlLCBvciBhbiBlbXB0eSBzdHJpbmcgd2hlbiB0aGUgcmVzcG9uc2UgaXMgbm90IHJlY29nbml6ZWQuXG4gKi9cbmZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19nZXRfc2FmZV9hamF4X2Vycm9yX21lc3NhZ2UoIGpxX3hociApIHtcblx0aWYgKFxuXHRcdCEganFfeGhyXG5cdFx0fHwgISBqcV94aHIucmVzcG9uc2VKU09OXG5cdFx0fHwgJ29iamVjdCcgIT09IHR5cGVvZiBqcV94aHIucmVzcG9uc2VKU09OXG5cdFx0fHwgQXJyYXkuaXNBcnJheSgganFfeGhyLnJlc3BvbnNlSlNPTiApXG5cdCkge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHZhciByZXNwb25zZV9qc29uICAgICAgPSBqcV94aHIucmVzcG9uc2VKU09OO1xuXHR2YXIgbWVzc2FnZV9jYW5kaWRhdGVzID0gW107XG5cblx0aWYgKCAnc3RyaW5nJyA9PT0gdHlwZW9mIHJlc3BvbnNlX2pzb24ubWVzc2FnZSApIHtcblx0XHRtZXNzYWdlX2NhbmRpZGF0ZXMucHVzaCggcmVzcG9uc2VfanNvbi5tZXNzYWdlICk7XG5cdH1cblx0aWYgKFxuXHRcdHJlc3BvbnNlX2pzb24uZGF0YVxuXHRcdCYmICdvYmplY3QnID09PSB0eXBlb2YgcmVzcG9uc2VfanNvbi5kYXRhXG5cdFx0JiYgISBBcnJheS5pc0FycmF5KCByZXNwb25zZV9qc29uLmRhdGEgKVxuXHRcdCYmICdzdHJpbmcnID09PSB0eXBlb2YgcmVzcG9uc2VfanNvbi5kYXRhLm1lc3NhZ2Vcblx0KSB7XG5cdFx0bWVzc2FnZV9jYW5kaWRhdGVzLnB1c2goIHJlc3BvbnNlX2pzb24uZGF0YS5tZXNzYWdlICk7XG5cdH1cblxuXHRmb3IgKCB2YXIgY2FuZGlkYXRlX2luZGV4ID0gMDsgY2FuZGlkYXRlX2luZGV4IDwgbWVzc2FnZV9jYW5kaWRhdGVzLmxlbmd0aDsgY2FuZGlkYXRlX2luZGV4KysgKSB7XG5cdFx0dmFyIHNlcnZlcl9tZXNzYWdlID0gbWVzc2FnZV9jYW5kaWRhdGVzWyBjYW5kaWRhdGVfaW5kZXggXS50cmltKCk7XG5cdFx0aWYgKCBzZXJ2ZXJfbWVzc2FnZSApIHtcblx0XHRcdHJldHVybiBzZXJ2ZXJfbWVzc2FnZS5zbGljZSggMCwgMTAwMCApO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiAnJztcbn1cblxuLyoqXG4gKiBCdWlsZCBhIHB1YmxpYy1zYWZlIEFKQVggZmFpbHVyZSBtZXNzYWdlIHdpdGggb3B0aW9uYWwgSFRUUCA0MDkgY2FjaGUgdHJvdWJsZXNob290aW5nIGd1aWRhbmNlLlxuICpcbiAqIEBwYXJhbSB7anFYSFJ8bnVsbH0ganFfeGhyICAgICAgICAgICAgICAgICAgICBqUXVlcnkgWEhSIG9iamVjdCwgd2hlbiBhdmFpbGFibGUuXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgIGZhbGxiYWNrX21lc3NhZ2UgICAgICAgICAgTG9jYWxpemVkIGZhbGxiYWNrIHNob3duIHdoZW4gbm8gc2FmZSBzZXJ2ZXIgbWVzc2FnZSBleGlzdHMuXG4gKiBAcGFyYW0ge3N0cmluZ30gICAgIGh0dHBfY29uZmxpY3RfY2FjaGVfaGludCAgT3B0aW9uYWwgbG9jYWxpemVkIGNhY2hlIGd1aWRhbmNlIGZvciBIVFRQIDQwOSByZXNwb25zZXMuXG4gKiBAcmV0dXJuIHtzdHJpbmd9IFBsYWluLXRleHQgbWVzc2FnZSBpbmNsdWRpbmcgdGhlIEhUVFAgc3RhdHVzIHdoZW4gYXZhaWxhYmxlLlxuICovXG5mdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fZ2V0X2FqYXhfZXJyb3JfbWVzc2FnZSgganFfeGhyLCBmYWxsYmFja19tZXNzYWdlLCBodHRwX2NvbmZsaWN0X2NhY2hlX2hpbnQgKSB7XG5cdHZhciBodHRwX3N0YXR1cyAgICAgICAgID0ganFfeGhyICYmIGpxX3hoci5zdGF0dXMgPyBwYXJzZUludCgganFfeGhyLnN0YXR1cywgMTAgKSA6IDA7XG5cdHZhciBzYWZlX3NlcnZlcl9tZXNzYWdlID0gd3BiY19mcm9udF9lbmRfX2dldF9zYWZlX2FqYXhfZXJyb3JfbWVzc2FnZSgganFfeGhyICk7XG5cdHZhciBlcnJvcl9tZXNzYWdlICAgICAgID0gc2FmZV9zZXJ2ZXJfbWVzc2FnZSB8fCBTdHJpbmcoIGZhbGxiYWNrX21lc3NhZ2UgfHwgJycgKS50cmltKCk7XG5cblx0aWYgKCA0MDkgPT09IGh0dHBfc3RhdHVzICYmIGh0dHBfY29uZmxpY3RfY2FjaGVfaGludCApIHtcblx0XHRlcnJvcl9tZXNzYWdlICs9ICggZXJyb3JfbWVzc2FnZSA/ICcgJyA6ICcnICkgKyBTdHJpbmcoIGh0dHBfY29uZmxpY3RfY2FjaGVfaGludCApLnRyaW0oKTtcblx0fVxuXHRpZiAoIGh0dHBfc3RhdHVzICkge1xuXHRcdGVycm9yX21lc3NhZ2UgKz0gJyAoJyArIGh0dHBfc3RhdHVzICsgJyknO1xuXHR9XG5cblx0cmV0dXJuIGVycm9yX21lc3NhZ2U7XG59XG5cbi8qKlxuICogTG9nIGFuIHVuZXhwZWN0ZWQgQUpBWCByZXNwb25zZSBmb3IgYnJvd3Nlci1jb25zb2xlIGRpYWdub3N0aWNzLlxuICpcbiAqIFRoZSByZXNwb25zZSBpcyBpbnRlbnRpb25hbGx5IGtlcHQgb3V0IG9mIGZyb250ZW5kIG5vdGljZXMgYmVjYXVzZSBpdCBjYW4gY29udGFpbiBhIGNvbXBsZXRlIEhUTUwgZXJyb3Igb3IgbG9naW4gcGFnZS5cbiAqIExvZ2dpbmcgaXQgaGVyZSBwcmVzZXJ2ZXMgdGhlIHNlcnZlciBwYXlsb2FkIGFuZCByZXF1ZXN0IGNvbnRleHQgZm9yIHN1cHBvcnQgdHJvdWJsZXNob290aW5nLlxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIGFqYXhfYWN0aW9uICAgV29yZFByZXNzIEFKQVggYWN0aW9uIHRoYXQgcHJvZHVjZWQgdGhlIHVuZXhwZWN0ZWQgcmVzcG9uc2UuXG4gKiBAcGFyYW0geyp9ICAgICAgICAgICByZXNwb25zZV9kYXRhIFJhdyByZXNwb25zZSBwYXlsb2FkIHJldHVybmVkIGJ5IHRoZSBzZXJ2ZXIuXG4gKiBAcGFyYW0ge2pxWEhSfG51bGx9ICBqcV94aHIgICAgICAgIGpRdWVyeSBYSFIgb2JqZWN0LCB3aGVuIGF2YWlsYWJsZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgIHRleHRfc3RhdHVzICAgalF1ZXJ5IHJlcXVlc3Qgc3RhdHVzIG9yIHN1Y2Nlc3Mgc3RhdGUuXG4gKiBAcGFyYW0ge3N0cmluZ3xFcnJvcn0gZXJyb3JfdGhyb3duIEVycm9yIGRlc2NyaXB0aW9uIG9yIGV4Y2VwdGlvbiByZXBvcnRlZCBieSBqUXVlcnkuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5mdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fbG9nX3VuZXhwZWN0ZWRfYWpheF9yZXNwb25zZSggYWpheF9hY3Rpb24sIHJlc3BvbnNlX2RhdGEsIGpxX3hociwgdGV4dF9zdGF0dXMsIGVycm9yX3Rocm93biApIHtcblx0aWYgKCAhIHdpbmRvdy5jb25zb2xlIHx8ICdmdW5jdGlvbicgIT09IHR5cGVvZiB3aW5kb3cuY29uc29sZS5lcnJvciApIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHR0cnkge1xuXHRcdHZhciBjb250ZW50X3R5cGUgICAgICAgPSAnJztcblx0XHR2YXIgcmVzcG9uc2VfdGV4dCAgICAgID0gJ3N0cmluZycgPT09IHR5cGVvZiByZXNwb25zZV9kYXRhID8gcmVzcG9uc2VfZGF0YSA6ICcnO1xuXHRcdHZhciByZXNwb25zZV9sZW5ndGggICAgPSByZXNwb25zZV90ZXh0Lmxlbmd0aDtcblx0XHR2YXIgcmVzcG9uc2VfZm9ybWF0ICAgID0gcmVzcG9uc2VfdGV4dCA/ICd0ZXh0JyA6ICdlbXB0eSc7XG5cdFx0dmFyIGh0dHBfc3RhdHVzICAgICAgICA9IGpxX3hociAmJiBqcV94aHIuc3RhdHVzID8gcGFyc2VJbnQoIGpxX3hoci5zdGF0dXMsIDEwICkgOiAwO1xuXHRcdHZhciBkaWFnbm9zdGljX2FjdGlvbiAgPSBTdHJpbmcoIGFqYXhfYWN0aW9uIHx8ICdBSkFYJyApLnJlcGxhY2UoIC9eV1BCQ19BSlhfLywgJycgKS5yZXBsYWNlKCAvW15BLVphLXowLTldKy9nLCAnLScgKS50b1VwcGVyQ2FzZSgpO1xuXHRcdHZhciBkaWFnbm9zdGljX2NvZGUgICAgPSAnV1BCQy0nICsgZGlhZ25vc3RpY19hY3Rpb24gKyAnLScgKyAoIGh0dHBfc3RhdHVzIHx8ICdORVRXT1JLJyApO1xuXHRcdHZhciByZXNwb25zZV9oZWFkZXJzICAgPSB7fTtcblx0XHRpZiAoIGpxX3hociAmJiAnZnVuY3Rpb24nID09PSB0eXBlb2YganFfeGhyLmdldFJlc3BvbnNlSGVhZGVyICkge1xuXHRcdFx0Y29udGVudF90eXBlID0ganFfeGhyLmdldFJlc3BvbnNlSGVhZGVyKCAnY29udGVudC10eXBlJyApIHx8ICcnO1xuXHRcdFx0cmVzcG9uc2VfaGVhZGVycyA9IHtcblx0XHRcdFx0J3NlcnZlcicgICAgICAgICAgIDoganFfeGhyLmdldFJlc3BvbnNlSGVhZGVyKCAnc2VydmVyJyApIHx8ICcnLFxuXHRcdFx0XHQnY2ZfcmF5JyAgICAgICAgICAgOiBqcV94aHIuZ2V0UmVzcG9uc2VIZWFkZXIoICdjZi1yYXknICkgfHwgJycsXG5cdFx0XHRcdCd4X2NhY2hlJyAgICAgICAgICA6IGpxX3hoci5nZXRSZXNwb25zZUhlYWRlciggJ3gtY2FjaGUnICkgfHwgJycsXG5cdFx0XHRcdCd4X2NhY2hlX3N0YXR1cycgICA6IGpxX3hoci5nZXRSZXNwb25zZUhlYWRlciggJ3gtY2FjaGUtc3RhdHVzJyApIHx8ICcnLFxuXHRcdFx0XHQneF9saXRlc3BlZWRfY2FjaGUnOiBqcV94aHIuZ2V0UmVzcG9uc2VIZWFkZXIoICd4LWxpdGVzcGVlZC1jYWNoZScgKSB8fCAnJyxcblx0XHRcdFx0J3hfcmVxdWVzdF9pZCcgICAgIDoganFfeGhyLmdldFJlc3BvbnNlSGVhZGVyKCAneC1yZXF1ZXN0LWlkJyApIHx8ICcnXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRpZiAoIGpxX3hociAmJiBqcV94aHIucmVzcG9uc2VKU09OICYmICdvYmplY3QnID09PSB0eXBlb2YganFfeGhyLnJlc3BvbnNlSlNPTiApIHtcblx0XHRcdHJlc3BvbnNlX2Zvcm1hdCA9ICdqc29uJztcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJlc3BvbnNlX2xlbmd0aCA9IEpTT04uc3RyaW5naWZ5KCBqcV94aHIucmVzcG9uc2VKU09OICkubGVuZ3RoO1xuXHRcdFx0fSBjYXRjaCAoIHJlc3BvbnNlX2pzb25fZXJyb3IgKSB7XG5cdFx0XHRcdHJlc3BvbnNlX2xlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICggLTEgIT09IGNvbnRlbnRfdHlwZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoICdodG1sJyApIHx8IC9eXFxzKig/OjwhZG9jdHlwZXw8aHRtbCkvaS50ZXN0KCByZXNwb25zZV90ZXh0ICkgKSB7XG5cdFx0XHRyZXNwb25zZV9mb3JtYXQgPSAnaHRtbCc7XG5cdFx0fVxuXG5cdFx0d2luZG93LmNvbnNvbGUuZXJyb3IoICdbV1BCQ11bQUpBWC1VTkVYUEVDVEVELVJFU1BPTlNFXSAnICsgYWpheF9hY3Rpb24sIHtcblx0XHRcdCdhY3Rpb24nICAgICAgICAgIDogYWpheF9hY3Rpb24sXG5cdFx0XHQnZGlhZ25vc3RpY19jb2RlJyA6IGRpYWdub3N0aWNfY29kZSxcblx0XHRcdCdodHRwX3N0YXR1cycgICAgIDogaHR0cF9zdGF0dXMsXG5cdFx0XHQnaHR0cF9zdGF0dXNfdGV4dCc6IGpxX3hociAmJiBqcV94aHIuc3RhdHVzVGV4dCA/IGpxX3hoci5zdGF0dXNUZXh0IDogJycsXG5cdFx0XHQndGV4dF9zdGF0dXMnICAgICA6IHRleHRfc3RhdHVzIHx8ICcnLFxuXHRcdFx0J2Vycm9yJyAgICAgICAgICAgOiBlcnJvcl90aHJvd24gfHwgJycsXG5cdFx0XHQnY29udGVudF90eXBlJyAgICA6IGNvbnRlbnRfdHlwZSxcblx0XHRcdCdyZXNwb25zZV9mb3JtYXQnIDogcmVzcG9uc2VfZm9ybWF0LFxuXHRcdFx0J3Jlc3BvbnNlX2xlbmd0aCcgOiByZXNwb25zZV9sZW5ndGgsXG5cdFx0XHQnc2VydmVyX21lc3NhZ2UnICA6IHdwYmNfZnJvbnRfZW5kX19nZXRfc2FmZV9hamF4X2Vycm9yX21lc3NhZ2UoIGpxX3hociApLFxuXHRcdFx0J3Jlc3BvbnNlX2hlYWRlcnMnOiByZXNwb25zZV9oZWFkZXJzLFxuXHRcdFx0J3Jlc3BvbnNlJyAgICAgICAgOiByZXNwb25zZV9kYXRhXG5cdFx0fSApO1xuXHR9IGNhdGNoICggbG9nZ2luZ19lcnJvciApIHtcblx0XHQvLyBDb25zb2xlIGRpYWdub3N0aWNzIG11c3QgbmV2ZXIgaW50ZXJydXB0IGZyb250ZW5kIGVycm9yIHJlY292ZXJ5LlxuXHR9XG59XG5cbi8qKlxuICogU2hvdyBtZXNzYWdlIGluIGNvbnRlbnRcbiAqXHJcbiAqIEBwYXJhbSBtZXNzYWdlXHRcdFx0XHRNZXNzYWdlIEhUTUxcclxuICogQHBhcmFtIHBhcmFtcyA9IHtcclxuICpcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICd3YXJuaW5nJyxcdFx0XHRcdFx0XHRcdC8vICdlcnJvcicgfCAnd2FybmluZycgfCAnaW5mbycgfCAnc3VjY2VzcydcclxuICpcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZScgOiAnJyxcdFx0XHRcdC8vIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICAgOiAnaW5zaWRlJ1x0XHQvLyAnaW5zaWRlJyB8ICdiZWZvcmUnIHwgJ2FmdGVyJyB8ICdyaWdodCcgfCAnbGVmdCdcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcdFx0XHRcdFx0XHRcdFx0Ly8gQXBwbHkgIG9ubHkgaWYgXHQnd2hlcmUnICAgOiAnaW5zaWRlJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFx0XHRcdFx0Ly8gc3R5bGVzLCBpZiBuZWVkZWRcclxuICpcdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcdFx0XHRcdFx0XHRcdFx0XHQvLyBob3cgbWFueSBtaWNyb3NlY29uZCB0byAgc2hvdywgIGlmIDAgIHRoZW4gIHNob3cgZm9yZXZlclxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IGZhbHNlXHRcdFx0XHRcdC8vIGlmIHRydWUsICB0aGVuIGRvIG5vdCBzaG93IG1lc3NhZ2UsICBpZiBwcmV2aW9zIG1lc3NhZ2Ugd2FzIG5vdCBoaWRlZCAobm90IGFwcGx5IGlmICd3aGVyZScgICA6ICdpbnNpZGUnIClcclxuICpcdFx0XHRcdH07XHJcbiAqIEV4YW1wbGVzOlxyXG4gKiBcdFx0XHR2YXIgaHRtbF9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoICdZb3UgY2FuIHRlc3QgZGF5cyBzZWxlY3Rpb24gaW4gY2FsZW5kYXInLCB7fSApO1xyXG4gKlxyXG4gKlx0XHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZCcgKSwgeyAndHlwZSc6ICd3YXJuaW5nJywgJ2RlbGF5JzogMTAwMDAsICdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3Nob3dfaGVyZSc6IHsnd2hlcmUnOiAncmlnaHQnLCAnanFfbm9kZSc6IGVsLH0gfSApO1xyXG4gKlxyXG4gKlx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyAgICd0eXBlJyAgICAgOiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gKSApXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnaW5mbycsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0JyxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMTAwMDBcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKlxyXG4gKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCBwYXJhbXMgPSB7fSApe1xyXG5cclxuXHR2YXIgcGFyYW1zX2RlZmF1bHQgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgIDogJ3dhcm5pbmcnLFx0XHRcdFx0XHRcdFx0Ly8gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJyB8ICdzdWNjZXNzJ1xyXG5cdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnIDogJycsXHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgICA6ICdpbnNpZGUnXHRcdC8vICdpbnNpZGUnIHwgJ2JlZm9yZScgfCAnYWZ0ZXInIHwgJ3JpZ2h0JyB8ICdsZWZ0J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIEFwcGx5ICBvbmx5IGlmIFx0J3doZXJlJyAgIDogJ2luc2lkZSdcclxuXHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHRcdFx0XHQvLyBzdHlsZXMsIGlmIG5lZWRlZFxyXG5cdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG5cdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHRcdFx0XHRcdFx0XHRcdFx0Ly8gaG93IG1hbnkgbWljcm9zZWNvbmQgdG8gIHNob3csICBpZiAwICB0aGVuICBzaG93IGZvcmV2ZXJcblx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IGZhbHNlLFx0XHRcdFx0XHQvLyBpZiB0cnVlLCAgdGhlbiBkbyBub3Qgc2hvdyBtZXNzYWdlLCAgaWYgcHJldmlvcyBtZXNzYWdlIHdhcyBub3QgaGlkZWQgKG5vdCBhcHBseSBpZiAnd2hlcmUnICAgOiAnaW5zaWRlJyApXG5cdFx0XHRcdFx0XHRcdFx0J2lzX3Njcm9sbCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIGlzIHNjcm9sbCAgdG8gIHRoaXMgZWxlbWVudFxuXHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnOiAnaHRtbCdcdFx0XHRcdFx0XHRcdC8vICdodG1sJyBmb3IgdHJ1c3RlZCBsZWdhY3kgY29udGVudCB8ICd0ZXh0JyBmb3IgZWRpdGFibGUvdXNlciBjb250ZW50XG5cdFx0XHRcdFx0XHR9O1xyXG5cdGZvciAoIHZhciBwX2tleSBpbiBwYXJhbXMgKXtcclxuXHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcGFyYW1zWyBwX2tleSBdO1xyXG5cdH1cclxuXHRwYXJhbXMgPSBwYXJhbXNfZGVmYXVsdDtcblxuXHRpZiAoICd0ZXh0JyA9PT0gcGFyYW1zWyAnY29udGVudF9tb2RlJyBdICkge1xuXHRcdG1lc3NhZ2UgPSBqUXVlcnkoICc8ZGl2PicgKS50ZXh0KCBudWxsID09PSBtZXNzYWdlIHx8ICd1bmRlZmluZWQnID09PSB0eXBlb2YgbWVzc2FnZSA/ICcnIDogU3RyaW5nKCBtZXNzYWdlICkgKS5odG1sKCkucmVwbGFjZSggL1xcbi9nLCAnPGJyIC8+JyApO1xuXHR9XG5cclxuICAgIHZhciB1bmlxdWVfZGl2X2lkID0gbmV3IERhdGUoKTtcclxuICAgIHVuaXF1ZV9kaXZfaWQgPSAnd3BiY19ub3RpY2VfJyArIHVuaXF1ZV9kaXZfaWQuZ2V0VGltZSgpO1xyXG5cclxuXHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlJztcclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdlcnJvcicgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2VfZXJyb3InO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JlcG9ydF9nbWFpbGVycm9ycmVkXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICd3YXJuaW5nJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV93YXJuaW5nJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl93YXJuaW5nXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdpbmZvJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV9pbmZvJztcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnc3VjY2VzcycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2Vfc3VjY2Vzcyc7XHJcblx0XHRtZXNzYWdlID0gJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fZG9uZV9vdXRsaW5lXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHJcblx0dmFyIHNjcm9sbF90b19lbGVtZW50ID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdfc2Nyb2xsXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7XCI+PC9kaXY+JztcclxuXHRtZXNzYWdlID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdcIiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlICcgKyBwYXJhbXNbJ2Nzc19jbGFzcyddICsgJ1wiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ3N0eWxlJyBdICsgJ1wiPicgKyBtZXNzYWdlICsgJzwvZGl2Pic7XHJcblxyXG5cclxuXHR2YXIganFfZWxfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdHZhciBpc19zaG93X21lc3NhZ2UgPSB0cnVlO1xyXG5cclxuXHRpZiAoICdpbnNpZGUnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGlmICggcGFyYW1zWyAnaXNfYXBwZW5kJyBdICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFwcGVuZCggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYXBwZW5kKCBtZXNzYWdlICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5odG1sKCBzY3JvbGxfdG9fZWxlbWVudCArIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ2JlZm9yZScgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLnNpYmxpbmdzKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ2FmdGVyJyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkubmV4dEFsbCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcdFx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGJlZm9yZShmb3IgaGFuZHkgc2Nyb2xsKVxyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hZnRlciggbWVzc2FnZSApO1xyXG5cdFx0fVxyXG5cclxuXHR9IGVsc2UgaWYgKCAncmlnaHQnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5uZXh0QWxsKCAnLndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9yaWdodCcgKS5maW5kKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1x0XHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYmVmb3JlKGZvciBoYW5keSBzY3JvbGwpXHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFmdGVyKCAnPGRpdiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9yaWdodFwiPicgKyBtZXNzYWdlICsgJzwvZGl2PicgKTtcclxuXHRcdH1cclxuXHR9IGVsc2UgaWYgKCAnbGVmdCcgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLnNpYmxpbmdzKCAnLndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9sZWZ0JyApLmZpbmQoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHRcdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBiZWZvcmUoZm9yIGhhbmR5IHNjcm9sbClcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCAnPGRpdiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9sZWZ0XCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCAgICggaXNfc2hvd19tZXNzYWdlICkgICYmICAoIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApID4gMCApICAgKXtcclxuXHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRqUXVlcnkoICcjJyArIHVuaXF1ZV9kaXZfaWQgKS5mYWRlT3V0KCAxNTAwICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSAsIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApICAgKTtcclxuXHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyMiA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkudHJpZ2dlciggJ2hpZGUnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSwgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSArIDE1MDEgKSApO1xyXG5cdH1cclxuXHJcblx0Ly8gQ2hlY2sgIGlmIHNob3dlZCBtZXNzYWdlIGluIHNvbWUgaGlkZGVuIHBhcmVudCBzZWN0aW9uIGFuZCBzaG93IGl0LiBCdXQgaXQgbXVzdCAgYmUgbG93ZXIgdGhhbiAnLndwYmNfY29udGFpbmVyJ1xyXG5cdHZhciBwYXJlbnRfZWxzID0galF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkucGFyZW50cygpLm1hcCggZnVuY3Rpb24gKCl7XHJcblx0XHRpZiAoICghalF1ZXJ5KCB0aGlzICkuaXMoICd2aXNpYmxlJyApKSAmJiAoalF1ZXJ5KCAnLndwYmNfY29udGFpbmVyJyApLmhhcyggdGhpcyApKSApe1xyXG5cdFx0XHRqUXVlcnkoIHRoaXMgKS5zaG93KCk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHRpZiAoIHBhcmFtc1sgJ2lzX3Njcm9sbCcgXSApe1xyXG5cdFx0d3BiY19kb19zY3JvbGwoICcjJyArIHVuaXF1ZV9kaXZfaWQgKyAnX3Njcm9sbCcgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB1bmlxdWVfZGl2X2lkO1xyXG59XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlLiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcigganFfbm9kZSwgbWVzc2FnZSwgY29udGVudF9tb2RlICl7XG5cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZScgICAgICAgOiBjb250ZW50X21vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdyaWdodCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlIFVOREVSIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yX3VuZGVyX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UsIG1lc3NhZ2VfZGVsYXksIGNvbnRlbnRfbW9kZSApe1xuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKG1lc3NhZ2VfZGVsYXkpICl7XG5cdFx0XHRtZXNzYWdlX2RlbGF5ID0gMFxuXHRcdH1cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IG1lc3NhZ2VfZGVsYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJyAgICAgICA6IGNvbnRlbnRfbW9kZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVycm9yIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3JfYWJvdmVfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgbWVzc2FnZV9kZWxheSwgY29udGVudF9tb2RlICl7XG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAobWVzc2FnZV9kZWxheSkgKXtcblx0XHRcdG1lc3NhZ2VfZGVsYXkgPSAxMDAwMFxuXHRcdH1cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IG1lc3NhZ2VfZGVsYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJyAgICAgICA6IGNvbnRlbnRfbW9kZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2JlZm9yZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGpxX25vZGUsIG1lc3NhZ2UsIGNvbnRlbnRfbW9kZSApe1xuXG5cdFx0Y29udGVudF9tb2RlID0gKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIGNvbnRlbnRfbW9kZSApID8gJ2h0bWwnIDogY29udGVudF9tb2RlO1xuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2NvbnRlbnRfbW9kZScgICAgICAgOiBjb250ZW50X21vZGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdyaWdodCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHdwYmNfaGlnaGxpZ2h0X2Vycm9yX29uX2Zvcm1fZmllbGQoIGpxX25vZGUgKTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZ191bmRlcl9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlLCBjb250ZW50X21vZGUgKXtcblxuXHRcdGNvbnRlbnRfbW9kZSA9ICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiBjb250ZW50X21vZGUgKSA/ICdodG1sJyA6IGNvbnRlbnRfbW9kZTtcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjb250ZW50X21vZGUnICAgICAgIDogY29udGVudF9tb2RlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYWZ0ZXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogV2FybmluZyBtZXNzYWdlIEFCT1ZFIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfYWJvdmVfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgY29udGVudF9tb2RlICl7XG5cblx0XHRjb250ZW50X21vZGUgPSAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgY29udGVudF9tb2RlICkgPyAnaHRtbCcgOiBjb250ZW50X21vZGU7XG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY29udGVudF9tb2RlJyAgICAgICA6IGNvbnRlbnRfbW9kZSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2JlZm9yZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhpZ2hsaWdodCBFcnJvciBpbiBzcGVjaWZpYyBmaWVsZFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpxX25vZGVcdFx0XHRcdFx0c3RyaW5nIG9yIGpRdWVyeSBlbGVtZW50LCAgd2hlcmUgc2Nyb2xsICB0b1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaGlnaGxpZ2h0X2Vycm9yX29uX2Zvcm1fZmllbGQoIGpxX25vZGUgKXtcclxuXHJcblx0XHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5sZW5ndGggKXtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIGpRdWVyeSgganFfbm9kZSApLmlzKCAnOmlucHV0JyApICl7XHJcblx0XHRcdC8vIFNpdHVhdGlvbiB3aXRoICBjaGVja2JveGVzIG9yIHJhZGlvICBidXR0b25zXHJcblx0XHRcdHZhciBqcV9ub2RlX2FyciA9IGpRdWVyeSgganFfbm9kZSApLmZpbmQoICc6aW5wdXQnICk7XHJcblx0XHRcdGlmICggIWpxX25vZGVfYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVyblxyXG5cdFx0XHR9XHJcblx0XHRcdGpxX25vZGUgPSBqcV9ub2RlX2Fyci5nZXQoIDAgKTtcclxuXHRcdH1cclxuXHRcdHZhciBwYXJhbXMgPSB7fTtcclxuXHRcdHBhcmFtc1sgJ2RlbGF5JyBdID0gMTAwMDA7XHJcblxyXG5cdFx0aWYgKCAhalF1ZXJ5KCBqcV9ub2RlICkuaGFzQ2xhc3MoICd3cGJjX2Zvcm1fZmllbGRfZXJyb3InICkgKXtcclxuXHJcblx0XHRcdGpRdWVyeSgganFfbm9kZSApLmFkZENsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApXHJcblxyXG5cdFx0XHRpZiAoIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApID4gMCApe1xyXG5cdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGpRdWVyeSgganFfbm9kZSApLnJlbW92ZUNsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICAsIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuLyoqXHJcbiAqIFNjcm9sbCB0byBzcGVjaWZpYyBlbGVtZW50XHJcbiAqXHJcbiAqIEBwYXJhbSBqcV9ub2RlXHRcdFx0XHRcdHN0cmluZyBvciBqUXVlcnkgZWxlbWVudCwgIHdoZXJlIHNjcm9sbCAgdG9cclxuICogQHBhcmFtIGV4dHJhX3NoaWZ0X29mZnNldFx0XHRpbnQgc2hpZnQgb2Zmc2V0IGZyb20gIGpxX25vZGVcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZG9fc2Nyb2xsKCBqcV9ub2RlICwgZXh0cmFfc2hpZnRfb2Zmc2V0ID0gMCApe1xyXG5cclxuXHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5sZW5ndGggKXtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0dmFyIHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLm9mZnNldCgpLnRvcDtcclxuXHJcblx0aWYgKCB0YXJnZXRPZmZzZXQgPD0gMCApe1xyXG5cdFx0aWYgKCAwICE9IGpRdWVyeSgganFfbm9kZSApLm5leHRBbGwoICc6dmlzaWJsZScgKS5sZW5ndGggKXtcclxuXHRcdFx0dGFyZ2V0T2Zmc2V0ID0galF1ZXJ5KCBqcV9ub2RlICkubmV4dEFsbCggJzp2aXNpYmxlJyApLmZpcnN0KCkub2Zmc2V0KCkudG9wO1xyXG5cdFx0fSBlbHNlIGlmICggMCAhPSBqUXVlcnkoIGpxX25vZGUgKS5wYXJlbnQoKS5uZXh0QWxsKCAnOnZpc2libGUnICkubGVuZ3RoICl7XHJcblx0XHRcdHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLnBhcmVudCgpLm5leHRBbGwoICc6dmlzaWJsZScgKS5maXJzdCgpLm9mZnNldCgpLnRvcDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggalF1ZXJ5KCAnI3dwYWRtaW5iYXInICkubGVuZ3RoID4gMCApe1xyXG5cdFx0dGFyZ2V0T2Zmc2V0ID0gdGFyZ2V0T2Zmc2V0IC0gNTAgLSA1MDtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGFyZ2V0T2Zmc2V0ID0gdGFyZ2V0T2Zmc2V0IC0gMjAgLSA1MDtcclxuXHR9XHJcblx0dGFyZ2V0T2Zmc2V0ICs9IGV4dHJhX3NoaWZ0X29mZnNldDtcclxuXHJcblx0Ly8gU2Nyb2xsIG9ubHkgIGlmIHdlIGRpZCBub3Qgc2Nyb2xsIGJlZm9yZVxyXG5cdGlmICggISBqUXVlcnkoICdodG1sLGJvZHknICkuaXMoICc6YW5pbWF0ZWQnICkgKXtcclxuXHRcdGpRdWVyeSggJ2h0bWwsYm9keScgKS5hbmltYXRlKCB7c2Nyb2xsVG9wOiB0YXJnZXRPZmZzZXR9LCA1MDAgKTtcclxuXHR9XHJcbn1cclxuXHJcbiIsIlxyXG4vLyBGaXhJbjogMTAuMi4wLjQuXHJcbi8qKlxyXG4gKiBEZWZpbmUgUG9wb3ZlcnMgZm9yIFRpbWVsaW5lcyBpbiBXUCBCb29raW5nIENhbGVuZGFyXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd8Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX3RpcHB5X3BvcG92ZXIoKXtcclxuXHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdGNvbnNvbGUubG9nKCAnV1BCQyBFcnJvci4gd3BiY190aXBweSB3YXMgbm90IGRlZmluZWQuJyApO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHR3cGJjX3RpcHB5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snLCB7XHJcblx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHRcdFx0dmFyIHBvcG92ZXJfdGl0bGUgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKTtcclxuXHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cInBvcG92ZXIgcG9wb3Zlcl90aXBweVwiPidcclxuXHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jbG9zZVwiPjxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDp0aGlzLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5fdGlwcHkuaGlkZSgpO1wiID4mdGltZXM7PC9hPjwvZGl2PidcclxuXHRcdFx0XHQrIHBvcG92ZXJfY29udGVudFxyXG5cdFx0XHRcdCsgJzwvZGl2Pic7XHJcblx0XHR9LFxyXG5cdFx0YWxsb3dIVE1MICAgICAgICA6IHRydWUsXHJcblx0XHR0cmlnZ2VyICAgICAgICAgIDogJ21hbnVhbCcsXHJcblx0XHRpbnRlcmFjdGl2ZSAgICAgIDogdHJ1ZSxcclxuXHRcdGhpZGVPbkNsaWNrICAgICAgOiBmYWxzZSxcclxuXHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktcG9wb3ZlcicsXHJcblx0XHRwbGFjZW1lbnQgICAgICAgIDogJ2JvdHRvbS1zdGFydCcsXHJcblx0XHR0b3VjaCAgICAgICAgICAgIDogWydob2xkJywgNTAwXSxcclxuXHR9ICk7XHJcblx0alF1ZXJ5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snICkub24oICdjbGljaycsIGZ1bmN0aW9uICgpe1xyXG5cdFx0aWYgKCB0aGlzLl90aXBweS5zdGF0ZS5pc1Zpc2libGUgKXtcclxuXHRcdFx0dGhpcy5fdGlwcHkuaGlkZSgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5fdGlwcHkuc2hvdygpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHR3cGJjX2RlZmluZV9oaWRlX3RpcHB5X29uX3Njcm9sbCgpO1xyXG59XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX2hpZGVfdGlwcHlfb25fc2Nyb2xsKCl7XHJcblx0alF1ZXJ5KCAnLmZsZXhfdGxfX3Njcm9sbGluZ19zZWN0aW9uMiwuZmxleF90bF9fc2Nyb2xsaW5nX3NlY3Rpb25zJyApLm9uKCAnc2Nyb2xsJywgZnVuY3Rpb24gKCBldmVudCApe1xyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfdGlwcHkpICl7XHJcblx0XHRcdHdwYmNfdGlwcHkuaGlkZUFsbCgpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG4iLCIvKipcclxuICogV1BCQyBjYWxlbmRhciBsb2FkZXIgYm9vdHN0cmFwLlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqIC0gRmluZHMgZXZlcnkgLmNhbGVuZGFyX2xvYWRlcl9mcmFtZVtkYXRhLXdwYmMtcmlkXSBvbiB0aGUgcGFnZSAobm93IG9yIGxhdGVyKS5cclxuICogLSBGb3IgZWFjaCBsb2FkZXIgZWxlbWVudCwgd2FpdHMgYSBcImdyYWNlXCIgcGVyaW9kIChkYXRhLXdwYmMtZ3JhY2UsIGRlZmF1bHQgODAwMCBtcyk6XHJcbiAqICAgICAtIElmIHRoZSByZWFsIGNhbGVuZGFyIGFwcGVhcnM6IGRvIG5vdGhpbmcgKGxvYWRlciBuYXR1cmFsbHkgcmVwbGFjZWQpLlxyXG4gKiAgICAgLSBJZiBub3Q6IHNob3cgYSBoZWxwZnVsIG1lc3NhZ2UgKG1pc3NpbmcgalF1ZXJ5L193cGJjL2RhdGVwaWNrKSBvciBhIGR1cGxpY2F0ZSBub3RpY2UuXHJcbiAqIC0gV29ya3Mgd2l0aCBtdWx0aXBsZSBjYWxlbmRhcnMgYW5kIGV2ZW4gZHVwbGljYXRlIFJJRHMgb24gdGhlIHNhbWUgcGFnZS5cclxuICogLSBObyBpbmxpbmUgSlMgbmVlZGVkIGluIHRoZSBzaG9ydGNvZGUvdGVtcGxhdGUgb3V0cHV0LlxyXG4gKlxyXG4gKiBGaWxlOiAgLi4vaW5jbHVkZXMvX19qcy9jbGllbnQvY2FsL3dwYmNfY2FsX2xvYWRlci5qc1xyXG4gKlxyXG4gKiBAc2luY2UgICAgMTAuMTQuNVxyXG4gKiBAbW9kaWZpZWQgMjAyNS0wOS0wNyAxMjoyMVxyXG4gKiBAdmVyc2lvbiAgMS4wLjBcclxuICpcclxuICovXHJcbi8qKlxyXG4gKiBXUEJDIGNhbGVuZGFyIGxvYWRlciBib290c3RyYXAuXHJcbiAqIC0gQXV0by1kZXRlY3RzIC5jYWxlbmRhcl9sb2FkZXJfZnJhbWVbZGF0YS13cGJjLXJpZF0gYmxvY2tzLlxyXG4gKiAtIFdhaXRzIGEgXCJncmFjZVwiIHBlcmlvZCBwZXIgZWxlbWVudCBiZWZvcmUgc2hvd2luZyBhIGhlbHBmdWwgbWVzc2FnZVxyXG4gKiAgIGlmIHRoZSByZWFsIGNhbGVuZGFyIGhhc24ndCByZXBsYWNlZCB0aGUgbG9hZGVyLlxyXG4gKiAtIE11bHRpcGxlIGNhbGVuZGFycyBhbmQgZHVwbGljYXRlIFJJRHMgYXJlIGhhbmRsZWQuXHJcbiAqL1xyXG4oZnVuY3Rpb24gKHcsIGQpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqIFNtYWxsIHV0aWxpdGllcyAoc25ha2VfY2FzZSlcclxuXHQgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqIFRyYWNrIHByb2Nlc3NlZCBsb2FkZXIgZWxlbWVudHM7IGZhbGxiYWNrIHRvIGRhdGEgZmxhZyBpZiBXZWFrU2V0IG1pc3NpbmcuICovXHJcblx0dmFyIHByb2Nlc3NlZF9zZXQgPSB0eXBlb2YgV2Vha1NldCA9PT0gJ2Z1bmN0aW9uJyA/IG5ldyBXZWFrU2V0KCkgOiBudWxsO1xyXG5cclxuXHQvKiogUmV0dXJuIGZpcnN0IG1hdGNoIGluc2lkZSBvcHRpb25hbCByb290LiAqL1xyXG5cdGZ1bmN0aW9uIHF1ZXJ5X29uZShzZWxlY3Rvciwgcm9vdCkge1xyXG5cdFx0cmV0dXJuIChyb290IHx8IGQpLnF1ZXJ5U2VsZWN0b3IoIHNlbGVjdG9yICk7XHJcblx0fVxyXG5cclxuXHQvKiogUmV0dXJuIE5vZGVMaXN0IG9mIG1hdGNoZXMgaW5zaWRlIG9wdGlvbmFsIHJvb3QuICovXHJcblx0ZnVuY3Rpb24gcXVlcnlfYWxsKHNlbGVjdG9yLCByb290KSB7XHJcblx0XHRyZXR1cm4gKHJvb3QgfHwgZCkucXVlcnlTZWxlY3RvckFsbCggc2VsZWN0b3IgKTtcclxuXHR9XHJcblxyXG5cdC8qKiBSdW4gYSBjYWxsYmFjayB3aGVuIERPTSBpcyByZWFkeS4gKi9cclxuXHRmdW5jdGlvbiBvbl9yZWFkeShmbikge1xyXG5cdFx0aWYgKCBkLnJlYWR5U3RhdGUgPT09ICdsb2FkaW5nJyApIHtcclxuXHRcdFx0ZC5hZGRFdmVudExpc3RlbmVyKCAnRE9NQ29udGVudExvYWRlZCcsIGZuICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRmbigpO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqIENsZWFyIGludGVydmFsIHNhZmVseS4gKi9cclxuXHRmdW5jdGlvbiBzYWZlX2NsZWFyKGludGVydmFsX2lkKSB7XHJcblx0XHR0cnkge1xyXG5cdFx0XHR3LmNsZWFySW50ZXJ2YWwoIGludGVydmFsX2lkICk7XHJcblx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKiBNYXJrIGVsZW1lbnQgcHJvY2Vzc2VkIChXZWFrU2V0IG9yIGRhdGEgYXR0cmlidXRlKS4gKi9cclxuXHRmdW5jdGlvbiBtYXJrX3Byb2Nlc3NlZChlbCkge1xyXG5cdFx0aWYgKCBwcm9jZXNzZWRfc2V0ICkge1xyXG5cdFx0XHRwcm9jZXNzZWRfc2V0LmFkZCggZWwgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0ZWwuZGF0YXNldC53cGJjUHJvY2Vzc2VkID0gJzEnO1xyXG5cdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqIENoZWNrIGlmIGVsZW1lbnQgd2FzIHByb2Nlc3NlZC4gKi9cclxuXHRmdW5jdGlvbiBpc19wcm9jZXNzZWQoZWwpIHtcclxuXHRcdHJldHVybiBwcm9jZXNzZWRfc2V0ID8gcHJvY2Vzc2VkX3NldC5oYXMoIGVsICkgOiAoZWwgJiYgZWwuZGF0YXNldCAmJiBlbC5kYXRhc2V0LndwYmNQcm9jZXNzZWQgPT09ICcxJyk7XHJcblx0fVxyXG5cclxuXHQvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblx0ICogTWVzc2FnZXNcblx0ICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG5cblx0LyoqXG5cdCAqIEJ1aWxkIHZpc2l0b3IgbWVzc2FnZXMgZm9yIGEgcmVzb3VyY2UsIHVzaW5nIGxvY2FsaXplZCBGb3JtIE1lc3NhZ2VzIHdoZW4gYXZhaWxhYmxlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ3xudW1iZXJ9IHJpZFxuXHQgKiBAcmV0dXJuIHt7ZHVwbGljYXRlOnN0cmluZyxpbml0X2ZhaWxlZDpzdHJpbmcsc3VwcG9ydDpzdHJpbmcsbGliX2pxOnN0cmluZyxsaWJfZHA6c3RyaW5nLGxpYl93cGJjOnN0cmluZ319XG5cdCAqL1xuXHRmdW5jdGlvbiBnZXRfbWVzc2FnZXMocmlkKSB7XG5cdFx0dmFyIHJpZF9pbnQgICAgICAgICAgPSBwYXJzZUludCggcmlkLCAxMCApO1xuXHRcdHZhciBkdXBsaWNhdGVfbWVzc2FnZSA9XG5cdFx0XHQnTW9yZSB0aGFuIG9uZSBjYWxlbmRhciBvciBib29raW5nIGZvcm0gZm9yIEJvb2tpbmcgUmVzb3VyY2UgSUQge3Jlc291cmNlX2lkfSBpcyBwcmVzZW50IG9uIHRoaXMgcGFnZS4gJyArXG5cdFx0XHQnQSBoaWRkZW4gY29weSBzdGlsbCBjb25mbGljdHMgd2l0aCB0aGUgdmlzaWJsZSBmb3JtIGFuZCBjYW4gcHJldmVudCBib29raW5nIHN1Ym1pc3Npb24uICcgK1xuXHRcdFx0J1RoZSBzaXRlIGFkbWluaXN0cmF0b3IgbXVzdCBrZWVwIG9ubHkgb25lIGNhbGVuZGFyIG9yIGZvcm0gZm9yIHRoaXMgQm9va2luZyBSZXNvdXJjZS4gJyArXG5cdFx0XHQnQWZ0ZXIgdGhlIHBhZ2UgaXMgY29ycmVjdGVkLCByZWxvYWQgaXQgYW5kIHRyeSBhZ2Fpbi4nO1xuXG5cdFx0aWYgKCB3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLmdldF9tZXNzYWdlID09PSAnZnVuY3Rpb24nICkge1xuXHRcdFx0ZHVwbGljYXRlX21lc3NhZ2UgPSB3Ll93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9kdXBsaWNhdGVfYm9va2luZ19yZXNvdXJjZV9vbl9wYWdlJyApIHx8IGR1cGxpY2F0ZV9tZXNzYWdlO1xuXHRcdH1cblx0XHRkdXBsaWNhdGVfbWVzc2FnZSA9IFN0cmluZyggZHVwbGljYXRlX21lc3NhZ2UgKS5yZXBsYWNlKCAvXFx7cmVzb3VyY2VfaWRcXH0vZywgU3RyaW5nKCByaWRfaW50ICkgKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRkdXBsaWNhdGUgIDogZHVwbGljYXRlX21lc3NhZ2UsXG5cdFx0XHRpbml0X2ZhaWxlZDpcclxuXHRcdFx0XHQnVGhlIGNhbGVuZGFyIGNvdWxkIG5vdCBiZSBpbml0aWFsaXplZCBvbiB0aGlzIHBhZ2UuJyArICdcXG4nICtcclxuXHRcdFx0XHQnUGxlYXNlIGNoZWNrIHlvdXIgYnJvd3NlciBjb25zb2xlIGZvciBKYXZhU2NyaXB0IGVycm9ycyBhbmQgY29uZmxpY3RzIHdpdGggb3RoZXIgc2NyaXB0cy9wbHVnaW5zLicsXHJcblx0XHRcdHN1cHBvcnQgICAgOiAnJywgLyogJ0NvbnRhY3Qgc3VwcG9ydEB3cGJvb2tpbmdjYWxlbmRhci5jb20gaWYgeW91IGhhdmUgYW55IHF1ZXN0aW9ucy4nLCAqL1xyXG5cdFx0XHRsaWJfanEgICAgIDpcclxuXHRcdFx0XHQnSXQgYXBwZWFycyB0aGF0IHRoZSBcImpRdWVyeVwiIGxpYnJhcnkgaXMgbm90IGxvYWRpbmcgY29ycmVjdGx5LicgKyAnXFxuJyArXHJcblx0XHRcdFx0J0ZvciBtb3JlIGluZm9ybWF0aW9uLCBwbGVhc2UgcmVmZXIgdG8gdGhpcyBwYWdlOiBodHRwczovL3dwYm9va2luZ2NhbGVuZGFyLmNvbS9mYXEvJyxcclxuXHRcdFx0bGliX2RwICAgICA6XHJcblx0XHRcdFx0J0l0IGFwcGVhcnMgdGhhdCB0aGUgXCJqUXVlcnkuZGF0ZXBpY2tcIiBsaWJyYXJ5IGlzIG5vdCBsb2FkaW5nIGNvcnJlY3RseS4nICsgJ1xcbicgK1xyXG5cdFx0XHRcdCdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHJlZmVyIHRvIHRoaXMgcGFnZTogaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vZmFxLycsXHJcblx0XHRcdGxpYl93cGJjICAgOlxyXG5cdFx0XHRcdCdJdCBhcHBlYXJzIHRoYXQgdGhlIFwiX3dwYmNcIiBsaWJyYXJ5IGlzIG5vdCBsb2FkaW5nIGNvcnJlY3RseS4nICsgJ1xcbicgK1xyXG5cdFx0XHRcdCdQbGVhc2UgZW5hYmxlIHRoZSBsb2FkaW5nIG9mIEpTL0NTUyBmaWxlcyBmb3IgdGhpcyBwYWdlIG9uIHRoZSBcIldQIEJvb2tpbmcgQ2FsZW5kYXJcIiAtIFwiU2V0dGluZ3MgR2VuZXJhbFwiIC0gXCJBZHZhbmNlZFwiIHBhZ2UnICsgJ1xcbicgK1xyXG5cdFx0XHRcdCdGb3IgbW9yZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHJlZmVyIHRvIHRoaXMgcGFnZTogaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vZmFxLydcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHQvKipcblx0ICogRXNjYXBlIGEgcGxhaW4tdGV4dCBsb2FkZXIgbWVzc2FnZSBiZWZvcmUgaW5zZXJ0aW5nIGl0cyB3cmFwcGVyIG1hcmt1cC5cblx0ICpcblx0ICogQHBhcmFtIHtzdHJpbmd9IHBsYWluX3RleHQgVmlzaXRvci1mYWNpbmcgcGxhaW4gdGV4dC5cblx0ICogQHJldHVybiB7c3RyaW5nfSBIVE1MLXNhZmUgdGV4dC5cblx0ICovXG5cdGZ1bmN0aW9uIGVzY2FwZV9odG1sKHBsYWluX3RleHQpIHtcblx0XHRyZXR1cm4gU3RyaW5nKCBwbGFpbl90ZXh0IHx8ICcnIClcblx0XHRcdC5yZXBsYWNlKCAvJi9nLCAnJmFtcDsnIClcblx0XHRcdC5yZXBsYWNlKCAvPC9nLCAnJmx0OycgKVxuXHRcdFx0LnJlcGxhY2UoIC8+L2csICcmZ3Q7JyApXG5cdFx0XHQucmVwbGFjZSggL1wiL2csICcmcXVvdDsnIClcblx0XHRcdC5yZXBsYWNlKCAvJy9nLCAnJiMwMzk7JyApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFdyYXAgcGxhaW4gdGV4dCAod2l0aCBuZXdsaW5lcykgaW4gYSBzbWFsbCBIVE1MIGNvbnRhaW5lci5cblx0ICogQHBhcmFtIHtzdHJpbmd9IG1zZ1xuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XG5cdCAqL1xuXHRmdW5jdGlvbiB3cmFwX2h0bWwobXNnKSB7XG5cdFx0cmV0dXJuICc8ZGl2IHN0eWxlPVwiZm9udC1zaXplOjEzcHg7bWFyZ2luOjEwcHg7XCI+JyArIGVzY2FwZV9odG1sKCBtc2cgKS5yZXBsYWNlKCAvXFxuL2csICc8YnI+JyApICsgJzwvZGl2Pic7XG5cdH1cblxyXG5cdC8qKiBMaWJyYXJ5IHByZXNlbmNlIGNoZWNrcyAoZmFzdCAmIGNoZWFwKS4gKi9cclxuXHRmdW5jdGlvbiBoYXNfanEoKSB7XHJcblx0XHRyZXR1cm4gISEody5qUXVlcnkgJiYgalF1ZXJ5LmZuICYmIHR5cGVvZiBqUXVlcnkuZm4ub24gPT09ICdmdW5jdGlvbicpO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gaGFzX2RwKCkge1xyXG5cdFx0cmV0dXJuICEhKHcualF1ZXJ5ICYmIGpRdWVyeS5kYXRlcGljayk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBoYXNfd3BiYygpIHtcclxuXHRcdHJldHVybiAhISh3Ll93cGJjICYmIHR5cGVvZiB3Ll93cGJjLnNldF9vdGhlcl9wYXJhbSA9PT0gJ2Z1bmN0aW9uJyk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBub3JtYWxpemVfcmlkKHJpZCkge1xyXG5cdFx0dmFyIG4gPSBwYXJzZUludCggcmlkLCAxMCApO1xyXG5cdFx0cmV0dXJuIChuID4gMCkgPyBTdHJpbmcoIG4gKSA6ICcnO1xyXG5cdH1cclxuXHJcblx0ZnVuY3Rpb24gZ2V0X3JpZF9jb3VudHMocmlkKSB7XHJcblx0XHR2YXIgciA9IG5vcm1hbGl6ZV9yaWQoIHJpZCApO1xyXG5cdFx0cmV0dXJuIHtcclxuXHRcdFx0cmlkICAgICAgIDogcixcclxuXHRcdFx0bG9hZGVycyAgIDogciA/IHF1ZXJ5X2FsbCggJy5jYWxlbmRhcl9sb2FkZXJfZnJhbWVbZGF0YS13cGJjLXJpZD1cIicgKyByICsgJ1wiXScgKS5sZW5ndGggOiAwLFxyXG5cdFx0XHRjb250YWluZXJzOiByID8gcXVlcnlfYWxsKCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgciApLmxlbmd0aCA6IDBcclxuXHRcdH07XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19kdXBsaWNhdGVfcmlkKHJpZCkge1xyXG5cdFx0dmFyIGMgPSBnZXRfcmlkX2NvdW50cyggcmlkICk7XHJcblx0XHRyZXR1cm4gKGMubG9hZGVycyA+IDEpIHx8IChjLmNvbnRhaW5lcnMgPiAxKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIERldGVybWluZSBpZiB0aGUgbG9hZGVyIGhhcyBiZWVuIHJlcGxhY2VkIGJ5IHRoZSByZWFsIGNhbGVuZGFyLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtFbGVtZW50fSBlbCAgICAgICBMb2FkZXIgZWxlbWVudFxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSByaWQgICAgICAgUmVzb3VyY2UgSURcclxuXHQgKiBAcGFyYW0ge0VsZW1lbnR8bnVsbH0gY29udGFpbmVyIE9wdGlvbmFsICNjYWxlbmRhcl9ib29raW5ne3JpZH0gZWxlbWVudFxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gaXNfcmVwbGFjZWQoZWwsIHJpZCwgY29udGFpbmVyKSB7XHJcblx0XHR2YXIgbG9hZGVyX3N0aWxsX2luX2RvbSA9IGQuYm9keS5jb250YWlucyggZWwgKTtcclxuXHRcdHZhciBjYWxlbmRhcl9leGlzdHMgICAgID0gISFxdWVyeV9vbmUoICcud3BiY19jYWxlbmRhcl9pZF8nICsgcmlkLCBjb250YWluZXIgfHwgZCApO1xyXG5cdFx0cmV0dXJuICghbG9hZGVyX3N0aWxsX2luX2RvbSkgfHwgY2FsZW5kYXJfZXhpc3RzO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogU3RhcnQgd2F0Y2hlciBmb3IgYSBzaW5nbGUgbG9hZGVyIGVsZW1lbnQuXHJcblx0ICogLSBQb2xscyBhbmQgb2JzZXJ2ZXMgdGhlIGNhbGVuZGFyIGNvbnRhaW5lci5cclxuXHQgKiAtIEFmdGVyIGdyYWNlLCBpbmplY3RzIGEgc3VpdGFibGUgbWVzc2FnZSBpZiBub3QgcmVwbGFjZWQuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge0VsZW1lbnR9IGVsXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gc3RhcnRfZm9yKGVsKSB7XHJcblx0XHRpZiAoICEgZWwgfHwgaXNfcHJvY2Vzc2VkKCBlbCApICkge1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRtYXJrX3Byb2Nlc3NlZCggZWwgKTtcclxuXHJcblx0XHR2YXIgcmlkID0gZWwuZGF0YXNldC53cGJjUmlkO1xyXG5cdFx0aWYgKCAhIHJpZCApIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBncmFjZV9tcyA9IHBhcnNlSW50KCBlbC5kYXRhc2V0LndwYmNHcmFjZSB8fCAnODAwMCcsIDEwICk7XHJcblx0XHRpZiAoICEgKGdyYWNlX21zID4gMCkgKSB7XHJcblx0XHRcdGdyYWNlX21zID0gODAwMDtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY29udGFpbmVyX2lkID0gJ2NhbGVuZGFyX2Jvb2tpbmcnICsgcmlkO1xyXG5cdFx0dmFyIGNvbnRhaW5lciAgICA9IGQuZ2V0RWxlbWVudEJ5SWQoIGNvbnRhaW5lcl9pZCApO1xyXG5cdFx0dmFyIHRleHRfZWwgICAgICA9IHF1ZXJ5X29uZSggJy5jYWxlbmRhcl9sb2FkZXJfdGV4dCcsIGVsICk7XHJcblxyXG5cdFx0ZnVuY3Rpb24gcmVwbGFjZWRfbm93KCkge1xyXG5cdFx0XHRyZXR1cm4gaXNfcmVwbGFjZWQoIGVsLCByaWQsIGNvbnRhaW5lciApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEFscmVhZHkgcmVwbGFjZWQgLT4gbm90aGluZyB0byBkby5cclxuXHRcdGlmICggcmVwbGFjZWRfbm93KCkgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHJcblx0XHQvLyAxKSBDaGVhcCBwb2xsaW5nLlxyXG5cdFx0dmFyIHBvbGxfaWQgPSB3LnNldEludGVydmFsKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdGlmICggcmVwbGFjZWRfbm93KCkgKSB7XHJcblx0XHRcdFx0c2FmZV9jbGVhciggcG9sbF9pZCApO1xyXG5cdFx0XHRcdGlmICggb2JzZXJ2ZXIgKSB7XHJcblx0XHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KCk7XHJcblx0XHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH0sIDI1MCApO1xyXG5cclxuXHRcdC8vIDIpIE11dGF0aW9uT2JzZXJ2ZXIgZm9yIGZhc3RlciByZWFjdGlvbi5cclxuXHRcdHZhciBvYnNlcnZlciA9IG51bGw7XHJcblx0XHRpZiAoIGNvbnRhaW5lciAmJiAnTXV0YXRpb25PYnNlcnZlcicgaW4gdyApIHtcclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKCBmdW5jdGlvbiAoKSB7XHJcblx0XHRcdFx0XHRpZiAoIHJlcGxhY2VkX25vdygpICkge1xyXG5cdFx0XHRcdFx0XHRzYWZlX2NsZWFyKCBwb2xsX2lkICk7XHJcblx0XHRcdFx0XHRcdHRyeSB7XHJcblx0XHRcdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdFx0XHR9IGNhdGNoICggZSApIHtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRvYnNlcnZlci5vYnNlcnZlKCBjb250YWluZXIsIHsgY2hpbGRMaXN0OiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0gKTtcclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyAzKSBGaW5hbCBkZWNpc2lvbiBhZnRlciBncmFjZSBwZXJpb2QuXHJcblx0XHR3LnNldFRpbWVvdXQoIGZ1bmN0aW9uIGZpbmFsaXplX2FmdGVyX2dyYWNlKCkge1xyXG5cdFx0XHRpZiAoIHJlcGxhY2VkX25vdygpICkge1xyXG5cdFx0XHRcdHNhZmVfY2xlYXIoIHBvbGxfaWQgKTtcclxuXHRcdFx0XHRpZiAoIG9ic2VydmVyICkge1xyXG5cdFx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHJldHVybjtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0dmFyIE0gPSBnZXRfbWVzc2FnZXMoIHJpZCApO1xyXG5cdFx0XHR2YXIgbXNnO1xyXG5cdFx0XHRpZiAoICEgaGFzX2pxKCkgKSB7XHJcblx0XHRcdFx0bXNnID0gTS5saWJfanE7XHJcblx0XHRcdH0gZWxzZSBpZiAoICEgaGFzX3dwYmMoKSApIHtcclxuXHRcdFx0XHRtc2cgPSBNLmxpYl93cGJjO1xyXG5cdFx0XHR9IGVsc2UgaWYgKCAhIGhhc19kcCgpICkge1xyXG5cdFx0XHRcdG1zZyA9IE0ubGliX2RwO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdC8vIExpYnJhcmllcyBhcmUgcHJlc2VudCwgYnV0IGxvYWRlciB3YXNuJ3QgcmVwbGFjZWQgLT4gZGVjaWRlIHdoYXQgaXMgbW9zdCBsaWtlbHkuXHJcblx0XHRcdFx0aWYgKCBpc19kdXBsaWNhdGVfcmlkKCByaWQgKSApIHtcclxuXHRcdFx0XHRcdG1zZyA9IE0uZHVwbGljYXRlICsgJ1xcblxcbicgKyBNLnN1cHBvcnQ7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG1zZyA9IE0uaW5pdF9mYWlsZWQgKyAnXFxuXFxuJyArIE0uc3VwcG9ydDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHRyeSB7XHJcblx0XHRcdFx0aWYgKCB0ZXh0X2VsICkge1xyXG5cdFx0XHRcdFx0dGV4dF9lbC5pbm5lckhUTUwgPSB3cmFwX2h0bWwoIG1zZyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHNhZmVfY2xlYXIoIHBvbGxfaWQgKTtcclxuXHRcdFx0aWYgKCBvYnNlcnZlciApIHtcclxuXHRcdFx0XHR0cnkge1xyXG5cdFx0XHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xyXG5cdFx0XHRcdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fSwgZ3JhY2VfbXMgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEluaXRpYWxpemUgd2F0Y2hlcnMgZm9yIGxvYWRlciBlbGVtZW50cyBhbHJlYWR5IGluIHRoZSBET00uXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gYm9vdHN0cmFwX2V4aXN0aW5nKCkge1xyXG5cdFx0cXVlcnlfYWxsKCAnLmNhbGVuZGFyX2xvYWRlcl9mcmFtZVtkYXRhLXdwYmMtcmlkXScgKS5mb3JFYWNoKCBzdGFydF9mb3IgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIE9ic2VydmUgdGhlIGRvY3VtZW50IGZvciBhbnkgbmV3IGxvYWRlciBlbGVtZW50cyBpbnNlcnRlZCBsYXRlciAoQUpBWCwgYmxvY2sgcmVuZGVyKS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiBvYnNlcnZlX25ld19sb2FkZXJzKCkge1xyXG5cdFx0aWYgKCAhICgnTXV0YXRpb25PYnNlcnZlcicgaW4gdykgKSB7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdHRyeSB7XHJcblx0XHRcdHZhciBkb2Nfb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlciggZnVuY3Rpb24gKG11dGF0aW9ucykge1xyXG5cdFx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IG11dGF0aW9ucy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdFx0XHRcdHZhciBub2RlcyA9IG11dGF0aW9uc1tpXS5hZGRlZE5vZGVzIHx8IFtdO1xyXG5cdFx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgbm9kZXMubGVuZ3RoOyBqKysgKSB7XHJcblx0XHRcdFx0XHRcdHZhciBub2RlID0gbm9kZXNbal07XHJcblx0XHRcdFx0XHRcdGlmICggISBub2RlIHx8IG5vZGUubm9kZVR5cGUgIT09IDEgKSB7XHJcblx0XHRcdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0aWYgKCBub2RlLm1hdGNoZXMgJiYgbm9kZS5tYXRjaGVzKCAnLmNhbGVuZGFyX2xvYWRlcl9mcmFtZVtkYXRhLXdwYmMtcmlkXScgKSApIHtcclxuXHRcdFx0XHRcdFx0XHRzdGFydF9mb3IoIG5vZGUgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRpZiAoIG5vZGUucXVlcnlTZWxlY3RvckFsbCApIHtcclxuXHRcdFx0XHRcdFx0XHR2YXIgaW5uZXIgPSBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoICcuY2FsZW5kYXJfbG9hZGVyX2ZyYW1lW2RhdGEtd3BiYy1yaWRdJyApO1xyXG5cdFx0XHRcdFx0XHRcdGlmICggaW5uZXIgJiYgaW5uZXIubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0XHRcdFx0aW5uZXIuZm9yRWFjaCggc3RhcnRfZm9yICk7XHJcblx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHRcdGRvY19vYnNlcnZlci5vYnNlcnZlKCBkLmRvY3VtZW50RWxlbWVudCwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSApO1xyXG5cdFx0fSBjYXRjaCAoIGUgKSB7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKiBCb290XHJcblx0ICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblx0b25fcmVhZHkoIGZ1bmN0aW9uICgpIHtcclxuXHRcdGJvb3RzdHJhcF9leGlzdGluZygpO1xyXG5cdFx0b2JzZXJ2ZV9uZXdfbG9hZGVycygpO1xyXG5cdH0gKTtcclxuXHJcbn0pKCB3aW5kb3csIGRvY3VtZW50ICk7XHJcbiIsIihmdW5jdGlvbiggdyApIHtcclxuXHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRpZiAoICEgdy5XUEJDX0ZFICkge1xyXG5cdFx0dy5XUEJDX0ZFID0ge307XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBdXRvLWZpbGwgYm9va2luZyBmb3JtIGZpZWxkcyAodGV4dC9lbWFpbCkgYmFzZWQgb24gaW5wdXQgXCJuYW1lXCIgcGF0dGVybnMuXHJcblx0ICpcclxuXHQgKiBGb3JtIElEIGZvcm1hdDogYm9va2luZ19mb3Jte3Jlc291cmNlX2lkfVxyXG5cdCAqIFNraXBzIGRhdGUgZmllbGQ6IGRhdGVfYm9va2luZ3tyZXNvdXJjZV9pZH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSByZXNvdXJjZV9pZCBCb29raW5nIHJlc291cmNlIElELlxyXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBmaWxsX3ZhbHVlcyBWYWx1ZXMgdG8gaW5qZWN0IChzdHJpbmdzKS5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm4ge2Jvb2xlYW59IFRydWUgaWYgZm9ybSBmb3VuZCBhbmQgcHJvY2Vzc2VkLCBmYWxzZSBvdGhlcndpc2UuXHJcblx0ICovXHJcblx0dy5XUEJDX0ZFLmF1dG9maWxsX2Jvb2tpbmdfZm9ybV9maWVsZHMgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGZpbGxfdmFsdWVzICkge1xyXG5cclxuXHRcdHJlc291cmNlX2lkICA9IHBhcnNlSW50KCByZXNvdXJjZV9pZCwgMTAgKSB8fCAwO1xyXG5cdFx0ZmlsbF92YWx1ZXMgID0gZmlsbF92YWx1ZXMgfHwge307XHJcblxyXG5cdFx0dmFyIGZvcm1faWQgICA9ICdib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQ7XHJcblx0XHR2YXIgZGF0ZV9uYW1lID0gJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZDtcclxuXHJcblx0XHR2YXIgc3VibWl0X2Zvcm0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggZm9ybV9pZCApO1xyXG5cclxuXHRcdGlmICggISBzdWJtaXRfZm9ybSApIHtcclxuXHRcdFx0LyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xyXG5cdFx0XHRjb25zb2xlLmVycm9yKCAnV1BCQzogTm8gYm9va2luZyBmb3JtOiAnICsgZm9ybV9pZCApO1xyXG5cdFx0XHQvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbnNvbGUgKi9cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIEtlZXAgc2FtZSByZWdleCBydWxlcyBhbmQgcHJpb3JpdHkgb3JkZXIgYXMgbGVnYWN5IGlubGluZSBKUy5cclxuXHRcdHZhciBydWxlcyA9IGFycmF5X3J1bGVzKCBmaWxsX3ZhbHVlcyApO1xyXG5cclxuXHRcdHZhciBlbGVtZW50cyA9IHN1Ym1pdF9mb3JtLmVsZW1lbnRzIHx8IFtdO1xyXG5cdFx0dmFyIGNvdW50ICAgID0gZWxlbWVudHMubGVuZ3RoO1xyXG5cdFx0dmFyIGVsO1xyXG5cdFx0dmFyIGk7XHJcblx0XHR2YXIgajtcclxuXHJcblx0XHRmb3IgKCBpID0gMDsgaSA8IGNvdW50OyBpKysgKSB7XHJcblxyXG5cdFx0XHRlbCA9IGVsZW1lbnRzWyBpIF07XHJcblxyXG5cdFx0XHRpZiAoICEgZWwgfHwgISBlbC5uYW1lICkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBPbmx5IHRleHQvZW1haWwgaW5wdXRzLlxyXG5cdFx0XHRpZiAoICggZWwudHlwZSAhPT0gJ3RleHQnICkgJiYgKCBlbC50eXBlICE9PSAnZW1haWwnICkgKSB7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIFNraXAgZGF0ZSBmaWVsZC5cclxuXHRcdFx0aWYgKCBlbC5uYW1lID09PSBkYXRlX25hbWUgKSB7XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIEZpbGwgb25seSBlbXB0eSB2YWx1ZXMgKGxlZ2FjeSBiZWhhdmlvcjogPT0gXCJcIikuXHJcblx0XHRcdGlmICggZWwudmFsdWUgIT09ICcnICkge1xyXG5cdFx0XHRcdGNvbnRpbnVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRmb3IgKCBqID0gMDsgaiA8IHJ1bGVzLmxlbmd0aDsgaisrICkge1xyXG5cclxuXHRcdFx0XHRpZiAoIHJ1bGVzWyBqIF0ucmUudGVzdCggZWwubmFtZSApICkge1xyXG5cclxuXHRcdFx0XHRcdGlmICggcnVsZXNbIGogXS52YWwgIT09ICcnICkge1xyXG5cdFx0XHRcdFx0XHRlbC52YWx1ZSA9IHJ1bGVzWyBqIF0udmFsO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGJyZWFrOyAvLyBTdG9wIGF0IGZpcnN0IG1hdGNoaW5nIHJ1bGUgKHByaW9yaXR5KS5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdHJ1ZTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBCdWlsZCBydWxlcyBhcnJheSBmb3IgYXV0b2ZpbGwuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge09iamVjdH0gZmlsbF92YWx1ZXMgVmFsdWVzIHRvIGluamVjdC5cclxuXHQgKlxyXG5cdCAqIEByZXR1cm4ge0FycmF5fSBSdWxlcyBsaXN0LlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIGFycmF5X3J1bGVzKCBmaWxsX3ZhbHVlcyApIHtcclxuXHJcblx0XHQvLyBOb3JtYWxpemUgdG8gc3RyaW5ncyAocHJldmVudCBcInVuZGVmaW5lZFwiIGluIGZpZWxkcykuXHJcblx0XHR2YXIgbmlja25hbWUgID0gKCBmaWxsX3ZhbHVlcy5uaWNrbmFtZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLm5pY2tuYW1lICkgOiAnJztcclxuXHRcdHZhciBsYXN0X25hbWUgPSAoIGZpbGxfdmFsdWVzLmxhc3RfbmFtZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLmxhc3RfbmFtZSApIDogJyc7XHJcblx0XHR2YXIgZmlyc3RfbmFtZSA9ICggZmlsbF92YWx1ZXMuZmlyc3RfbmFtZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLmZpcnN0X25hbWUgKSA6ICcnO1xyXG5cdFx0dmFyIGVtYWlsICAgICA9ICggZmlsbF92YWx1ZXMuZW1haWwgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy5lbWFpbCApIDogJyc7XHJcblx0XHR2YXIgcGhvbmUgICAgID0gKCBmaWxsX3ZhbHVlcy5waG9uZSAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLnBob25lICkgOiAnJztcclxuXHRcdHZhciBuYl9lbmZhbnQgPSAoIGZpbGxfdmFsdWVzLm5iX2VuZmFudCAhPSBudWxsICkgPyBTdHJpbmcoIGZpbGxfdmFsdWVzLm5iX2VuZmFudCApIDogJyc7XHJcblx0XHR2YXIgdXJsICAgICAgID0gKCBmaWxsX3ZhbHVlcy51cmwgIT0gbnVsbCApID8gU3RyaW5nKCBmaWxsX3ZhbHVlcy51cmwgKSA6ICcnO1xyXG5cclxuXHRcdHJldHVybiBbXHJcblx0XHRcdHsgcmU6IC9eKFtBLVphLXowLTlfXFwtXFwuXSkqKG5pY2tuYW1lKXsxfShbQS1aYS16MC05X1xcLVxcLl0pKiQvLCB2YWw6IG5pY2tuYW1lIH0sXHJcblx0XHRcdHsgcmU6IC9eKFtBLVphLXowLTlfXFwtXFwuXSkqKGxhc3R8c2Vjb25kKXsxfShbX1xcLVxcLl0pP25hbWUoW0EtWmEtejAtOV9cXC1cXC5dKSokLywgdmFsOiBsYXN0X25hbWUgfSxcclxuXHRcdFx0eyByZTogL15uYW1lKFswLTlfXFwtXFwuXSkqJC8sIHZhbDogZmlyc3RfbmFtZSB9LFxyXG5cdFx0XHR7IHJlOiAvXihbQS1aYS16MC05X1xcLVxcLl0pKihmaXJzdHxteSl7MX0oW19cXC1cXC5dKT9uYW1lKFtBLVphLXowLTlfXFwtXFwuXSkqJC8sIHZhbDogZmlyc3RfbmFtZSB9LFxyXG5cdFx0XHR7IHJlOiAvXihlKT8oW19cXC1cXC5dKT9tYWlsKFswLTlfXFwtXFwuXSopJC8sIHZhbDogZW1haWwgfSxcclxuXHRcdFx0eyByZTogL14oW0EtWmEtejAtOV9cXC1cXC5dKSoocGhvbmV8Zm9uZSl7MX0oW0EtWmEtejAtOV9cXC1cXC5dKSokLywgdmFsOiBwaG9uZSB9LFxyXG5cdFx0XHR7IHJlOiAvXihlKT8oW19cXC1cXC5dKT9uYl9lbmZhbnQoWzAtOV9cXC1cXC5dKikkLywgdmFsOiBuYl9lbmZhbnQgfSxcclxuXHRcdFx0eyByZTogL14oW0EtWmEtejAtOV9cXC1cXC5dKSooVVJMfHNpdGV8d2VifFdFQil7MX0oW0EtWmEtejAtOV9cXC1cXC5dKSokLywgdmFsOiB1cmwgfVxyXG5cdFx0XTtcclxuXHR9XHJcblxyXG59KSggd2luZG93ICk7XHJcbiIsIi8vID09IFN1Ym1pdCBCb29raW5nIERhdGEgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vLyBSZWZhY3RvcmVkIChzYWZlKSwgd2l0aCBuZXcgd3BiY18qIG5hbWVzLlxyXG4vLyBCYWNrd2FyZC1jb21wYXRpYmxlIHdyYXBwZXJzIGZvciBsZWdhY3kgZnVuY3Rpb24gbmFtZXMgYXJlIGluY2x1ZGVkIGF0IHRoZSBib3R0b20uXHJcbi8vIEBmaWxlOiBpbmNsdWRlcy9fX2pzL2NsaWVudC9mcm9udF9lbmRfZm9ybS9ib29raW5nX2Zvcm1fc3VibWl0LmpzXHJcblxyXG4vKipcbiAqIENoZWNrIHdoZXRoZXIgYSBmb3JtIGJlbG9uZ3MgdG8gYSByZXF1ZXN0LWxvY2FsIGJvb2tpbmcgcHJldmlldy5cbiAqXG4gKiBTaWduZWQgaWZyYW1lIGFuZCBuZXctd2luZG93IHByZXZpZXdzIGludGVudGlvbmFsbHkgZG8gbm90IHVzZSB0aGlzIG1hcmtlcjtcbiAqIHRoZXkgcmV0YWluIHRoZSBjb21wbGV0ZSBCb29raW5nIENhbGVuZGFyIHByZXZpZXcgbGlmZWN5Y2xlLlxuICpcbiAqIEBwYXJhbSB7SFRNTEZvcm1FbGVtZW50fSBzdWJtaXRfZm9ybSBCb29raW5nIGZvcm0gYmVpbmcgc3VibWl0dGVkLlxuICogQHJldHVybiB7Ym9vbGVhbn0gVHJ1ZSB3aGVuIGZpbmFsIHN1Ym1pc3Npb24gbXVzdCByZW1haW4gbG9jYWwgYW5kIG5vbi1tdXRhdGluZy5cbiAqL1xuZnVuY3Rpb24gd3BiY19ib29raW5nX2Zvcm1fX2lzX2lubGluZV9wcmV2aWV3X3N1Ym1pc3Npb24oIHN1Ym1pdF9mb3JtICkge1xuXHRyZXR1cm4gMCA8IGpRdWVyeSggc3VibWl0X2Zvcm0gKS5jbG9zZXN0KCAnW2RhdGEtd3BiYy1pbmxpbmUtYm9va2luZy1wcmV2aWV3PVwiMVwiXScgKS5sZW5ndGg7XG59XG5cbi8qKlxuICogRXhwbGFpbiBiZWxvdyB0aGUgZm9ybSB3aHkgYSByZXF1ZXN0LWxvY2FsIHByZXZpZXcgY2Fubm90IGNyZWF0ZSBhIGJvb2tpbmcuXG4gKlxuICogQHBhcmFtIHtIVE1MRm9ybUVsZW1lbnR9IHN1Ym1pdF9mb3JtIEJvb2tpbmcgZm9ybSBiZWluZyBzdWJtaXR0ZWQuXG4gKiBAcmV0dXJuIHt2b2lkfVxuICovXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9fc2hvd19pbmxpbmVfcHJldmlld19zdWJtaXNzaW9uX25vdGljZSggc3VibWl0X2Zvcm0gKSB7XG5cdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfdW5kZXJfZWxlbWVudChcblx0XHRzdWJtaXRfZm9ybSxcblx0XHRfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfaW5saW5lX3ByZXZpZXdfc3VibWlzc2lvbl9kaXNhYmxlZCcgKSxcblx0XHQndGV4dCdcblx0KTtcbn1cblxuLyoqXG4gKiBDaGVjayBmaWVsZHMgYXQgZm9ybSBhbmQgdGhlbiBzZW5kIHJlcXVlc3QgKGxlZ2FjeTogbXlib29raW5nX3N1Ym1pdCkuXG4gKlxyXG4gKiBAcGFyYW0ge0hUTUxGb3JtRWxlbWVudH0gc3VibWl0X2Zvcm1cclxuICogQHBhcmFtIHtudW1iZXJ8c3RyaW5nfSAgIHJlc291cmNlX2lkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgICB3cGRldl9hY3RpdmVfbG9jYWxlXHJcbiAqXHJcbiAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gTGVnYWN5IGJlaGF2aW9yOiByZXR1cm5zIGZhbHNlIGluIHNvbWUgY2FzZXMsIG90aGVyd2lzZSB1bmRlZmluZWQuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXQoIHN1Ym1pdF9mb3JtLCByZXNvdXJjZV9pZCwgd3BkZXZfYWN0aXZlX2xvY2FsZSApIHtcclxuXHJcblx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggcmVzb3VyY2VfaWQsIDEwICk7XHJcblxyXG5cdC8vIFNhZmV0eSBndWFyZCAobGVnYWN5IGNvZGUgYXNzdW1lZCB2YWxpZCBmb3JtKS5cclxuXHRpZiAoICEgc3VibWl0X2Zvcm0gfHwgISBzdWJtaXRfZm9ybS5lbGVtZW50cyApIHtcclxuXHRcdC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cclxuXHRcdGNvbnNvbGUuZXJyb3IoICdXUEJDOiBJbnZhbGlkIHN1Ym1pdCBmb3JtIGluIHdwYmNfYm9va2luZ19mb3JtX3N1Ym1pdCgpLicgKTtcclxuXHRcdC8qIGVzbGludC1lbmFibGUgbm8tY29uc29sZSAqL1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIEV4dGVybmFsIGhvb2s6IGFsbG93IHBhdXNlIHN1Ym1pdCBvbiBjb25maXJtYXRpb24vc3VtbWFyeSBzdGVwLlxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgdGFyZ2V0X2VsbSA9IGpRdWVyeSggJy5ib29raW5nX2Zvcm1fZGl2JyApLnRyaWdnZXIoICdib29raW5nX2Zvcm1fc3VibWl0X2NsaWNrJywgWyByZXNvdXJjZV9pZCwgc3VibWl0X2Zvcm0sIHdwZGV2X2FjdGl2ZV9sb2NhbGUgXSApOyAvLyBGaXhJbjogOC44LjMuMTMuXHJcblxyXG5cdGlmIChcclxuXHRcdCggalF1ZXJ5KCB0YXJnZXRfZWxtICkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX2Zvcm1fc2hvd19zdW1tYXJ5XCJdJyApLmxlbmd0aCA+IDAgKSAmJlxyXG5cdFx0KCAncGF1c2Vfc3VibWl0JyA9PT0galF1ZXJ5KCB0YXJnZXRfZWxtICkuZmluZCggJ2lucHV0W25hbWU9XCJib29raW5nX2Zvcm1fc2hvd19zdW1tYXJ5XCJdJyApLnZhbCgpIClcclxuXHQpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoIHdwYmNfYm9va2luZ19mb3JtX19pc19pbmxpbmVfcHJldmlld19zdWJtaXNzaW9uKCBzdWJtaXRfZm9ybSApICkge1xuXHRcdHdwYmNfYm9va2luZ19mb3JtX19zaG93X2lubGluZV9wcmV2aWV3X3N1Ym1pc3Npb25fbm90aWNlKCBzdWJtaXRfZm9ybSApO1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIEZpeEluOiA4LjQuMC4yLlxuXHR2YXIgaXNfZXJyb3IgPSB3cGJjX2NoZWNrX2Vycm9yc19pbl9ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkICk7XHJcblx0aWYgKCBpc19lcnJvciApIHtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTaG93IG1lc3NhZ2UgaWYgbm8gc2VsZWN0ZWQgZGF5cyBpbiBDYWxlbmRhcihzKS5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGRhdGVfaW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBkYXRlX3ZhbHVlID0gKCBkYXRlX2lucHV0ICkgPyBkYXRlX2lucHV0LnZhbHVlIDogJyc7XHJcblxyXG5cdGlmICggJycgPT09IGRhdGVfdmFsdWUgKSB7XHJcblxyXG5cdFx0dmFyIGFycl9vZl9zZWxlY3RlZF9hZGRpdGlvbmFsX2NhbGVuZGFycyA9IHdwYmNfZ2V0X2Fycl9vZl9zZWxlY3RlZF9hZGRpdGlvbmFsX2NhbGVuZGFycyggcmVzb3VyY2VfaWQgKTsgLy8gRml4SW46IDguNS4yLjI2LlxyXG5cclxuXHRcdGlmICggISBhcnJfb2Zfc2VsZWN0ZWRfYWRkaXRpb25hbF9jYWxlbmRhcnMgfHwgKCBhcnJfb2Zfc2VsZWN0ZWRfYWRkaXRpb25hbF9jYWxlbmRhcnMubGVuZ3RoID09PSAwICkgKSB7XHJcblx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoXG5cdFx0XHRcdCcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCArICcgLmJrX2NhbGVuZGFyX2ZyYW1lJyxcblx0XHRcdFx0X3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX25vX3NlbGVjdGVkX2RhdGVzJyApLFxuXHRcdFx0XHQndGV4dCdcblx0XHRcdCk7XG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRml4SW46IDYuMS4xLjMuIFRpbWUgc2VsZWN0aW9uIGF2YWlsYWJpbGl0eSBjaGVja3MuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGlmICggdHlwZW9mIHdwYmNfaXNfdGhpc190aW1lX3NlbGVjdGlvbl9ub3RfYXZhaWxhYmxlID09PSAnZnVuY3Rpb24nICkge1xyXG5cclxuXHRcdGlmICggJycgPT09IGRhdGVfdmFsdWUgKSB7IC8vIFByaW1hcnkgY2FsZW5kYXIgbm90IHNlbGVjdGVkLlxyXG5cclxuXHRcdFx0dmFyIGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdhZGRpdGlvbmFsX2NhbGVuZGFycycgKyByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdFx0aWYgKCBhZGRpdGlvbmFsX2NhbGVuZGFyc19lbCAhPT0gbnVsbCApIHsgLy8gQ2hlY2tpbmcgYWRkaXRpb25hbCBjYWxlbmRhcnMuXHJcblxyXG5cdFx0XHRcdHZhciBpZF9hZGRpdGlvbmFsX3N0ciA9IGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsLnZhbHVlO1xyXG5cdFx0XHRcdHZhciBpZF9hZGRpdGlvbmFsX2FyciA9IGlkX2FkZGl0aW9uYWxfc3RyLnNwbGl0KCAnLCcgKTtcclxuXHRcdFx0XHR2YXIgaXNfdGltZXNfZGF0ZXNfb2sgPSBmYWxzZTtcclxuXHJcblx0XHRcdFx0Zm9yICggdmFyIGlhID0gMDsgaWEgPCBpZF9hZGRpdGlvbmFsX2Fyci5sZW5ndGg7IGlhKysgKSB7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGFkZF9pZCA9IGlkX2FkZGl0aW9uYWxfYXJyWyBpYSBdO1xyXG5cclxuXHRcdFx0XHRcdHZhciBhZGRfZGF0ZV9lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnZGF0ZV9ib29raW5nJyArIGFkZF9pZCApO1xyXG5cdFx0XHRcdFx0dmFyIGFkZF9kYXRlX3ZhbCA9ICggYWRkX2RhdGVfZWwgKSA/IGFkZF9kYXRlX2VsLnZhbHVlIDogJyc7XHJcblxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQoICcnICE9PSBhZGRfZGF0ZV92YWwgKSAmJlxyXG5cdFx0XHRcdFx0XHQoICEgd3BiY19pc190aGlzX3RpbWVfc2VsZWN0aW9uX25vdF9hdmFpbGFibGUoIGFkZF9pZCwgc3VibWl0X2Zvcm0uZWxlbWVudHMgKSApXHJcblx0XHRcdFx0XHQpIHtcclxuXHRcdFx0XHRcdFx0aXNfdGltZXNfZGF0ZXNfb2sgPSB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCAhIGlzX3RpbWVzX2RhdGVzX29rICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdH0gZWxzZSB7IC8vIFByaW1hcnkgY2FsZW5kYXIgc2VsZWN0ZWQuXHJcblxyXG5cdFx0XHRpZiAoIHdwYmNfaXNfdGhpc190aW1lX3NlbGVjdGlvbl9ub3RfYXZhaWxhYmxlKCByZXNvdXJjZV9pZCwgc3VibWl0X2Zvcm0uZWxlbWVudHMgKSApIHtcclxuXHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTZXJpYWxpemUgZm9ybSAobGVnYWN5IGZvcm1hdCkuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBjb3VudCAgICA9IHN1Ym1pdF9mb3JtLmVsZW1lbnRzLmxlbmd0aDtcclxuXHR2YXIgZm9ybWRhdGEgPSAnJztcclxuXHR2YXIgaW5wX3ZhbHVlO1xyXG5cdHZhciBpbnBfdGl0bGVfdmFsdWU7XHJcblx0dmFyIGVsZW1lbnQ7XHJcblx0dmFyIGVsX3R5cGU7XHJcblxyXG5cdC8vIEhlbHBlcjogbGVnYWN5IGVzY2FwaW5nIGZvciB0aGUgc2VyaWFsaXplZCB2YWx1ZS5cclxuXHRmdW5jdGlvbiB3cGJjX2VzY2FwZV9zZXJpYWxpemVkX3ZhbHVlKCB2YWwgKSB7XHJcblxyXG5cdFx0dmFsID0gKCB2YWwgPT0gbnVsbCApID8gJycgOiBTdHJpbmcoIHZhbCApO1xyXG5cclxuXHRcdC8vIFJlcGxhY2UgcmVnaXN0ZXJlZCBjaGFyYWN0ZXJzLlxyXG5cdFx0dmFsID0gdmFsLnJlcGxhY2UoIG5ldyBSZWdFeHAoICdcXFxcXicsICdnJyApLCAnJiM5NDsnICk7XHJcblx0XHR2YWwgPSB2YWwucmVwbGFjZSggbmV3IFJlZ0V4cCggJ34nLCAnZycgKSwgJyYjMTI2OycgKTtcclxuXHJcblx0XHQvLyBSZXBsYWNlIHF1b3Rlcy5cclxuXHRcdHZhbCA9IHZhbC5yZXBsYWNlKCAvXCIvZywgJyYjMzQ7JyApO1xyXG5cdFx0dmFsID0gdmFsLnJlcGxhY2UoIC8nL2csICcmIzM5OycgKTtcclxuXHJcblx0XHRyZXR1cm4gdmFsO1xyXG5cdH1cclxuXHJcblx0Ly8gSGVscGVyOiBkZXRlcm1pbmUgVUkgdHlwZSBmb3IgdGl0bGUgZXh0cmFjdGlvbiAobGVnYWN5IGxvZ2ljKS5cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9pbnB1dF9lbGVtZW50X3R5cGUoIGVsICkge1xyXG5cclxuXHRcdGlmICggISBlbCB8fCAhIGVsLnRhZ05hbWUgKSB7XHJcblx0XHRcdHJldHVybiAnJztcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgdGFnID0gU3RyaW5nKCBlbC50YWdOYW1lICkudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0XHRpZiAoICdpbnB1dCcgPT09IHRhZyApIHtcclxuXHRcdFx0cmV0dXJuICggZWwudHlwZSApID8gU3RyaW5nKCBlbC50eXBlICkudG9Mb3dlckNhc2UoKSA6ICd0ZXh0JztcclxuXHRcdH1cclxuXHJcblx0XHQvLyBMZWdhY3kgdXNlZCBcInNlbGVjdFwiIHN0cmluZyBoZXJlLlxyXG5cdFx0aWYgKCAnc2VsZWN0JyA9PT0gdGFnICkge1xyXG5cdFx0XHRyZXR1cm4gJ3NlbGVjdCc7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHRhZztcclxuXHR9XHJcblxyXG5cdGZvciAoIHZhciBpID0gMDsgaSA8IGNvdW50OyBpKysgKSB7IC8vIEZpeEluOiA5LjEuNS4xLlxyXG5cclxuXHRcdGVsZW1lbnQgPSBzdWJtaXRfZm9ybS5lbGVtZW50c1sgaSBdO1xyXG5cclxuXHRcdGlmICggISBlbGVtZW50ICkge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGpRdWVyeSggZWxlbWVudCApLmNsb3Nlc3QoICcuYm9va2luZ19mb3JtX2dhcmJhZ2UnICkubGVuZ3RoICkge1xyXG5cdFx0XHRjb250aW51ZTsgLy8gU2tpcCBlbGVtZW50cyBmcm9tIGdhcmJhZ2UuIEZpeEluOiA3LjEuMi4xNC5cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICcxJyA9PT0gU3RyaW5nKCBqUXVlcnkoIGVsZW1lbnQgKS5hdHRyKCAnZGF0YS13cGJjLWJvb2tpbmctc3VibWl0LWlnbm9yZScgKSB8fCAnJyApICkge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCggZWxlbWVudC50eXBlICE9PSAnYnV0dG9uJyApICYmXHJcblx0XHRcdCggZWxlbWVudC50eXBlICE9PSAnaGlkZGVuJyApICYmXHJcblx0XHRcdCggZWxlbWVudC5uYW1lICE9PSAoICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdC8vICYmICggalF1ZXJ5KCBlbGVtZW50ICkuaXMoICc6dmlzaWJsZScgKSApIC8vRml4SW46IDcuMi4xLjEyLjJcclxuXHRcdCkge1xyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBHZXQgZWxlbWVudCB2YWx1ZS5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRpZiAoIGVsZW1lbnQudHlwZSA9PT0gJ2NoZWNrYm94JyApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBlbGVtZW50LnZhbHVlID09PSAnJyApIHtcclxuXHRcdFx0XHRcdGlucF92YWx1ZSA9IGVsZW1lbnQuY2hlY2tlZDtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gKCBlbGVtZW50LmNoZWNrZWQgKSA/IGVsZW1lbnQudmFsdWUgOiAnJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2UgaWYgKCBlbGVtZW50LnR5cGUgPT09ICdyYWRpbycgKSB7XHJcblxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jaGVja2VkICkge1xyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gZWxlbWVudC52YWx1ZTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdC8vIFJlcXVpcmVkIHJhZGlvOiBzaG93IHdhcm5pbmcgaWYgbm9uZSBjaGVja2VkLlxyXG5cdFx0XHRcdFx0Ly8gRml4SW46IDcuMC4xLjYyLlxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQoIGVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoICd3cGRldi12YWxpZGF0ZXMtYXMtcmVxdWlyZWQnICkgIT09IC0xICkgJiZcclxuXHRcdFx0XHRcdFx0KCBqUXVlcnkoIGVsZW1lbnQgKS5pcyggJzp2aXNpYmxlJyApICkgJiYgLy8gRml4SW46IDcuMi4xLjEyLjIuXHJcblx0XHRcdFx0XHRcdCggISBqUXVlcnkoICc6cmFkaW9bbmFtZT1cIicgKyBlbGVtZW50Lm5hbWUgKyAnXCJdJywgc3VibWl0X2Zvcm0gKS5pcyggJzpjaGVja2VkJyApIClcclxuXHRcdFx0XHRcdCkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfcmVxdWlyZWRfZm9yX3JhZGlvX2JveCcgKSwgJ3RleHQnICk7IC8vIEZpeEluOiA4LjUuMS4zLlxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNraXAgc3RvcmluZyBlbXB0eSByYWRpbyBvcHRpb25zLlxyXG5cdFx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRpbnBfdmFsdWUgPSBlbGVtZW50LnZhbHVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpbnBfdGl0bGVfdmFsdWUgPSAnJztcclxuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0Ly8gR2V0IGh1bWFuLWZyaWVuZGx5IHRpdGxlIHZhbHVlIChsZWdhY3kgYmVoYXZpb3IpLlxyXG5cdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRcdHZhciBpbnB1dF9lbGVtZW50X3R5cGUgPSB3cGJjX2dldF9pbnB1dF9lbGVtZW50X3R5cGUoIGVsZW1lbnQgKTtcclxuXHJcblx0XHRcdHN3aXRjaCAoIGlucHV0X2VsZW1lbnRfdHlwZSApIHtcclxuXHJcblx0XHRcdFx0Y2FzZSAndGV4dCc6XHJcblx0XHRcdFx0Y2FzZSAnZW1haWwnOlxyXG5cdFx0XHRcdFx0aW5wX3RpdGxlX3ZhbHVlID0gaW5wX3ZhbHVlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3NlbGVjdCc6XHJcblx0XHRcdFx0XHRpbnBfdGl0bGVfdmFsdWUgPSBqUXVlcnkoIGVsZW1lbnQgKS5maW5kKCAnb3B0aW9uOnNlbGVjdGVkJyApLnRleHQoKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdyYWRpbyc6XHJcblx0XHRcdFx0Y2FzZSAnY2hlY2tib3gnOlxyXG5cdFx0XHRcdFx0aWYgKCBqUXVlcnkoIGVsZW1lbnQgKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdFx0XHR2YXIgbGFiZWxfZWxlbWVudCA9IGpRdWVyeSggZWxlbWVudCApLnBhcmVudHMoICcud3BkZXYtbGlzdC1pdGVtJyApLmZpbmQoICcud3BkZXYtbGlzdC1pdGVtLWxhYmVsJyApO1xyXG5cdFx0XHRcdFx0XHRpZiAoIGxhYmVsX2VsZW1lbnQubGVuZ3RoICkge1xyXG5cdFx0XHRcdFx0XHRcdGlucF90aXRsZV92YWx1ZSA9IGxhYmVsX2VsZW1lbnQuaHRtbCgpO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHRcdGlucF90aXRsZV92YWx1ZSA9IGlucF92YWx1ZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBNdWx0aXBsZSBzZWxlY3QgdmFsdWUgZXh0cmFjdGlvbi5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRpZiAoICggZWxlbWVudC50eXBlID09PSAnc2VsZWN0Ym94LW11bHRpcGxlJyApIHx8ICggZWxlbWVudC50eXBlID09PSAnc2VsZWN0LW11bHRpcGxlJyApICkge1xyXG5cdFx0XHRcdGlucF92YWx1ZSA9IGpRdWVyeSggJ1tuYW1lPVwiJyArIGVsZW1lbnQubmFtZSArICdcIl0nICkudmFsKCk7XHJcblx0XHRcdFx0aWYgKCAoIGlucF92YWx1ZSA9PT0gbnVsbCApIHx8ICggU3RyaW5nKCBpbnBfdmFsdWUgKSA9PT0gJycgKSApIHtcclxuXHRcdFx0XHRcdGlucF92YWx1ZSA9ICcnO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHQvLyBNYWtlIHZhbGlkYXRpb24gb25seSBmb3IgdmlzaWJsZSBlbGVtZW50cy5cclxuXHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRpZiAoIGpRdWVyeSggZWxlbWVudCApLmlzKCAnOnZpc2libGUnICkgKSB7IC8vIEZpeEluOiA3LjIuMS4xMi4yLlxyXG5cclxuXHRcdFx0XHQvLyBSZWNoZWNrIG1heCBhdmFpbGFibGUgdmlzaXRvcnMgc2VsZWN0aW9uLlxyXG5cdFx0XHRcdGlmICggdHlwZW9mIHdwYmNfX2lzX2xlc3NfdGhhbl9yZXF1aXJlZF9fb2ZfbWF4X2F2YWlsYWJsZV9zbG90c19fYmwgPT09ICdmdW5jdGlvbicgKSB7XHJcblx0XHRcdFx0XHRpZiAoIHdwYmNfX2lzX2xlc3NfdGhhbl9yZXF1aXJlZF9fb2ZfbWF4X2F2YWlsYWJsZV9zbG90c19fYmwoIHJlc291cmNlX2lkLCBlbGVtZW50ICkgKSB7XHJcblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIFJlcXVpcmVkIGZpZWxkcy5cclxuXHRcdFx0XHRpZiAoIGVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoICd3cGRldi12YWxpZGF0ZXMtYXMtcmVxdWlyZWQnICkgIT09IC0xICkge1xyXG5cclxuXHRcdFx0XHRcdGlmICggKCBlbGVtZW50LnR5cGUgPT09ICdjaGVja2JveCcgKSAmJiAoIGVsZW1lbnQuY2hlY2tlZCA9PT0gZmFsc2UgKSApIHtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggISBqUXVlcnkoICc6Y2hlY2tib3hbbmFtZT1cIicgKyBlbGVtZW50Lm5hbWUgKyAnXCJdJywgc3VibWl0X2Zvcm0gKS5pcyggJzpjaGVja2VkJyApICkge1xyXG5cdFx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGVsZW1lbnQsIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZF9mb3JfY2hlY2tfYm94JyApLCAndGV4dCcgKTsgLy8gRml4SW46IDguNS4xLjMuXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdGlmICggZWxlbWVudC50eXBlID09PSAncmFkaW8nICkge1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAhIGpRdWVyeSggJzpyYWRpb1tuYW1lPVwiJyArIGVsZW1lbnQubmFtZSArICdcIl0nLCBzdWJtaXRfZm9ybSApLmlzKCAnOmNoZWNrZWQnICkgKSB7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggZWxlbWVudCwgX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX3JlcXVpcmVkX2Zvcl9yYWRpb19ib3gnICksICd0ZXh0JyApOyAvLyBGaXhJbjogOC41LjEuMy5cblx0XHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAoIGVsZW1lbnQudHlwZSAhPT0gJ2NoZWNrYm94JyApICYmICggZWxlbWVudC50eXBlICE9PSAncmFkaW8nICkgJiYgKCAnJyA9PT0gd3BiY190cmltKCBpbnBfdmFsdWUgKSApICkge1xyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfcmVxdWlyZWQnICksICd0ZXh0JyApOyAvLyBGaXhJbjogOC41LjEuMy5cblx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIEVtYWlsIGZvcm1hdCB2YWxpZGF0aW9uLlxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3dwZGV2LXZhbGlkYXRlcy1hcy1lbWFpbCcgKSAhPT0gLTEgKSB7XHJcblxyXG5cdFx0XHRcdFx0aW5wX3ZhbHVlID0gU3RyaW5nKCBpbnBfdmFsdWUgKS5yZXBsYWNlKCAvXlxccyt8XFxzKyQvZ20sICcnICk7IC8vIFRyaW0gd2hpdGUgc3BhY2UuIEZpeEluOiA1LjQuNS5cclxuXHRcdFx0XHRcdHZhciByZWdfZW1haWwgPSAvXihbQS1aYS16MC05X1xcLVxcLlxcK10pK1xcQChbQS1aYS16MC05X1xcLVxcLl0pK1xcLihbQS1aYS16XXsyLH0pJC87XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBpbnBfdmFsdWUgIT09ICcnICkge1xyXG5cdFx0XHRcdFx0XHRpZiAoIHJlZ19lbWFpbC50ZXN0KCBpbnBfdmFsdWUgKSA9PT0gZmFsc2UgKSB7XHJcblx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZyggZWxlbWVudCwgX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX2VtYWlsJyApLCAndGV4dCcgKTsgLy8gRml4SW46IDguNS4xLjMuXG5cdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gU2FtZSBlbWFpbCBmaWVsZCB2YWxpZGF0aW9uICh2ZXJpZmljYXRpb24gZmllbGQpLlxyXG5cdFx0XHRcdGlmICggKCBlbGVtZW50LmNsYXNzTmFtZS5pbmRleE9mKCAnd3BkZXYtdmFsaWRhdGVzLWFzLWVtYWlsJyApICE9PSAtMSApICYmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3NhbWVfYXNfJyApICE9PSAtMSApICkge1xyXG5cclxuXHRcdFx0XHRcdHZhciBwcmltYXJ5X2VtYWlsX25hbWUgPSBlbGVtZW50LmNsYXNzTmFtZS5tYXRjaCggL3NhbWVfYXNfKFteXFxzXSkrL2dpICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBwcmltYXJ5X2VtYWlsX25hbWUgIT09IG51bGwgKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRwcmltYXJ5X2VtYWlsX25hbWUgPSBwcmltYXJ5X2VtYWlsX25hbWVbIDAgXS5zdWJzdHIoIDggKTtcclxuXHJcblx0XHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnW25hbWU9XCInICsgcHJpbWFyeV9lbWFpbF9uYW1lICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLmxlbmd0aCA+IDAgKSB7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnW25hbWU9XCInICsgcHJpbWFyeV9lbWFpbF9uYW1lICsgcmVzb3VyY2VfaWQgKyAnXCJdJyApLnZhbCgpICE9PSBpbnBfdmFsdWUgKSB7XHJcblx0XHRcdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBlbGVtZW50LCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfc2FtZV9lbWFpbCcgKSwgJ3RleHQnICk7IC8vIEZpeEluOiA4LjUuMS4zLlxuXHRcdFx0XHRcdFx0XHRcdHJldHVybjtcclxuXHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBTa2lwIG9uZSBsb29wIGZvciB0aGUgZW1haWwgdmVyaWZpY2F0aW9uIGZpZWxkLlxyXG5cdFx0XHRcdFx0Y29udGludWU7IC8vIEZpeEluOiA4LjEuMi4xNS5cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0Ly8gR2V0IEZvcm0gRGF0YSAobGVnYWN5IGZvcm1hdCkuXHJcblx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0aWYgKCBlbGVtZW50Lm5hbWUgIT09ICggJ2NhcHRjaGFfaW5wdXQnICsgcmVzb3VyY2VfaWQgKSApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBmb3JtZGF0YSAhPT0gJycgKSB7XHJcblx0XHRcdFx0XHRmb3JtZGF0YSArPSAnfic7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRlbF90eXBlID0gZWxlbWVudC50eXBlO1xyXG5cclxuXHRcdFx0XHRpZiAoIGVsZW1lbnQuY2xhc3NOYW1lLmluZGV4T2YoICd3cGRldi12YWxpZGF0ZXMtYXMtZW1haWwnICkgIT09IC0xICkge1xyXG5cdFx0XHRcdFx0ZWxfdHlwZSA9ICdlbWFpbCc7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggZWxlbWVudC5jbGFzc05hbWUuaW5kZXhPZiggJ3dwZGV2LXZhbGlkYXRlcy1hcy1jb3Vwb24nICkgIT09IC0xICkge1xyXG5cdFx0XHRcdFx0ZWxfdHlwZSA9ICdjb3Vwb24nO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aW5wX3ZhbHVlID0gd3BiY19lc2NhcGVfc2VyaWFsaXplZF92YWx1ZSggaW5wX3ZhbHVlICk7XHJcblxyXG5cdFx0XHRcdGlmICggZWxfdHlwZSA9PT0gJ3NlbGVjdC1vbmUnICkge1xyXG5cdFx0XHRcdFx0ZWxfdHlwZSA9ICdzZWxlY3Rib3gtb25lJztcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBlbF90eXBlID09PSAnc2VsZWN0LW11bHRpcGxlJyApIHtcclxuXHRcdFx0XHRcdGVsX3R5cGUgPSAnc2VsZWN0Ym94LW11bHRpcGxlJztcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGZvcm1kYXRhICs9IGVsX3R5cGUgKyAnXicgKyBlbGVtZW50Lm5hbWUgKyAnXicgKyBpbnBfdmFsdWU7XHJcblxyXG5cdFx0XHRcdC8vIEFkZCB0aXRsZS9sYWJlbCB2YWx1ZSAobGVnYWN5KS5cclxuXHRcdFx0XHR2YXIgY2xlYW5fZmllbGRfbmFtZSA9IFN0cmluZyggZWxlbWVudC5uYW1lICk7XHJcblxyXG5cdFx0XHRcdC8vIEJVR0ZJWDogcmVwbGFjZUFsbChSZWdFeHApIGlzIG5vdCBzdXBwb3J0ZWQgaW4gb2xkZXIgYnJvd3NlcnMuXHJcblx0XHRcdFx0Ly8gS2VlcCBsZWdhY3kgaW50ZW50OiByZW1vdmUgW10gc3VmZml4IG9jY3VycmVuY2VzLlxyXG5cdFx0XHRcdGNsZWFuX2ZpZWxkX25hbWUgPSBjbGVhbl9maWVsZF9uYW1lLnJlcGxhY2UoIC9cXFtcXF0vZ2ksICcnICk7XHJcblxyXG5cdFx0XHRcdHZhciByZXNvdXJjZV9pZF9zdHIgPSBTdHJpbmcoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0XHRcdC8vIExlZ2FjeSBhc3N1bWVkIHN1ZmZpeCBlbmRzIHdpdGggcmVzb3VyY2VfaWQsIG1ha2UgaXQgc2FmZS5cclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHQoIGNsZWFuX2ZpZWxkX25hbWUubGVuZ3RoID49IHJlc291cmNlX2lkX3N0ci5sZW5ndGggKSAmJlxyXG5cdFx0XHRcdFx0KCBjbGVhbl9maWVsZF9uYW1lLnN1YnN0ciggY2xlYW5fZmllbGRfbmFtZS5sZW5ndGggLSByZXNvdXJjZV9pZF9zdHIubGVuZ3RoICkgPT09IHJlc291cmNlX2lkX3N0ciApXHJcblx0XHRcdFx0KSB7XHJcblx0XHRcdFx0XHRjbGVhbl9maWVsZF9uYW1lID0gY2xlYW5fZmllbGRfbmFtZS5zdWJzdHIoIDAsIGNsZWFuX2ZpZWxkX25hbWUubGVuZ3RoIC0gcmVzb3VyY2VfaWRfc3RyLmxlbmd0aCApO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Zm9ybWRhdGEgKz0gJ34nICsgZWxfdHlwZSArICdeJyArIGNsZWFuX2ZpZWxkX25hbWUgKyAnX3ZhbCcgKyByZXNvdXJjZV9pZCArICdeJyArIGlucF90aXRsZV92YWx1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0Ly8gVE9ETzogaGVyZSB3YXMgZnVuY3Rpb24gZm9yICdDaGVjayBpZiB2aXNpdG9yIGZpbmlzaCBkYXRlcyBzZWxlY3Rpb24uXHJcblxyXG5cdC8vIENhcHRjaGEgdmVyaWZ5LlxyXG5cdHZhciBjYXB0Y2hhID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICd3cGRldl9jYXB0Y2hhX2NoYWxsZW5nZV8nICsgcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0aWYgKCBjYXB0Y2hhICE9PSBudWxsICkge1xyXG5cdFx0d3BiY19mb3JtX3N1Ym1pdF9zZW5kKCByZXNvdXJjZV9pZCwgZm9ybWRhdGEsIGNhcHRjaGEudmFsdWUsIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnY2FwdGNoYV9pbnB1dCcgKyByZXNvdXJjZV9pZCApLnZhbHVlLCB3cGRldl9hY3RpdmVfbG9jYWxlICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHdwYmNfZm9ybV9zdWJtaXRfc2VuZCggcmVzb3VyY2VfaWQsIGZvcm1kYXRhLCAnJywgJycsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybjtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBHYXRoZXJpbmcgcGFyYW1zIGZvciBzZW5kaW5nIEFqYXggcmVxdWVzdCBhbmQgdGhlbiBzZW5kIGl0IChsZWdhY3k6IGZvcm1fc3VibWl0X3NlbmQpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgZm9ybWRhdGFcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBjYXB0Y2hhX2NoYWxhbmdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgdXNlcl9jYXB0Y2hhXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgd3BkZXZfYWN0aXZlX2xvY2FsZVxyXG4gKlxyXG4gKiBAcmV0dXJuIHt1bmRlZmluZWR9IExlZ2FjeSBiZWhhdmlvci5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZm9ybV9zdWJtaXRfc2VuZCggcmVzb3VyY2VfaWQsIGZvcm1kYXRhLCBjYXB0Y2hhX2NoYWxhbmdlLCB1c2VyX2NhcHRjaGEsIHdwZGV2X2FjdGl2ZV9sb2NhbGUgKSB7XHJcblxyXG5cdHJlc291cmNlX2lkID0gcGFyc2VJbnQoIHJlc291cmNlX2lkLCAxMCApO1xyXG5cclxuXHR2YXIgbXlfYm9va2luZ19mb3JtID0gJyc7XHJcblx0dmFyIGJvb2tpbmdfZm9ybV90eXBlX2VsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdib29raW5nX2Zvcm1fdHlwZScgKyByZXNvdXJjZV9pZCApO1xyXG5cdGlmICggYm9va2luZ19mb3JtX3R5cGVfZWwgIT09IG51bGwgKSB7XHJcblx0XHRteV9ib29raW5nX2Zvcm0gPSBib29raW5nX2Zvcm1fdHlwZV9lbC52YWx1ZTtcclxuXHR9XHJcblxyXG5cdHZhciBteV9ib29raW5nX2hhc2ggPSAnJztcclxuXHRpZiAoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RoaXNfcGFnZV9ib29raW5nX2hhc2gnICkgIT09ICcnICkge1xyXG5cdFx0bXlfYm9va2luZ19oYXNoID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2Jvb2tpbmdfaGFzaCcgKTtcclxuXHR9XHJcblxyXG5cdHZhciBpc19zZW5kX2VtZWlscyA9IDE7XHJcblx0dmFyICRpc19zZW5kX2VtYWlsX3RvZ2dsZSA9IGpRdWVyeSggJyNpc19zZW5kX2VtYWlsX2Zvcl9wZW5kaW5nJyApO1xyXG5cdHZhciAkbW9kYWxfc2VuZF9lbWFpbF90b2dnbGUgPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkuY2xvc2VzdCggJy53cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKS5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1zZW5kLWVtYWlsc10nICkuZmlyc3QoKTtcclxuXHRpZiAoICRtb2RhbF9zZW5kX2VtYWlsX3RvZ2dsZS5sZW5ndGggKSB7XHJcblx0XHQkaXNfc2VuZF9lbWFpbF90b2dnbGUgPSAkbW9kYWxfc2VuZF9lbWFpbF90b2dnbGU7XHJcblx0fVxyXG5cdGlmICggJGlzX3NlbmRfZW1haWxfdG9nZ2xlLmxlbmd0aCApIHsgLy8gRml4SW46IDguNy45LjUuXHJcblxyXG5cdFx0aXNfc2VuZF9lbWVpbHMgPSAkaXNfc2VuZF9lbWFpbF90b2dnbGUuaXMoICc6Y2hlY2tlZCcgKTtcclxuXHJcblx0XHRpZiAoIGZhbHNlID09PSBpc19zZW5kX2VtZWlscyApIHtcclxuXHRcdFx0aXNfc2VuZF9lbWVpbHMgPSAwO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aXNfc2VuZF9lbWVpbHMgPSAxO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dmFyIGRhdGVfZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBkYXRlX3ZhbHVlID0gKCBkYXRlX2VsICkgPyBkYXRlX2VsLnZhbHVlIDogJyc7XHJcblxyXG5cdGlmICggJycgIT09IGRhdGVfdmFsdWUgKSB7IC8vIEZpeEluOiA2LjEuMS4zLlxyXG5cdFx0d3BiY19zZW5kX2FqYXhfc3VibWl0KCByZXNvdXJjZV9pZCwgZm9ybWRhdGEsIGNhcHRjaGFfY2hhbGFuZ2UsIHVzZXJfY2FwdGNoYSwgaXNfc2VuZF9lbWVpbHMsIG15X2Jvb2tpbmdfaGFzaCwgbXlfYm9va2luZ19mb3JtLCB3cGRldl9hY3RpdmVfbG9jYWxlICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkuaGlkZSgpO1xyXG5cdFx0alF1ZXJ5KCAnI3N1Ym1pdGluZycgKyByZXNvdXJjZV9pZCApLmhpZGUoKTtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBBZGRpdGlvbmFsIGNhbGVuZGFycyBzdWJtaXQuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBhZGRpdGlvbmFsX2NhbGVuZGFyc19lbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnYWRkaXRpb25hbF9jYWxlbmRhcnMnICsgcmVzb3VyY2VfaWQgKTtcclxuXHRpZiAoIGFkZGl0aW9uYWxfY2FsZW5kYXJzX2VsID09PSBudWxsICkge1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHJcblx0dmFyIGlkX2FkZGl0aW9uYWxfc3RyID0gYWRkaXRpb25hbF9jYWxlbmRhcnNfZWwudmFsdWU7XHJcblx0dmFyIGlkX2FkZGl0aW9uYWxfYXJyID0gaWRfYWRkaXRpb25hbF9zdHIuc3BsaXQoICcsJyApO1xyXG5cclxuXHQvLyBGaXhJbjogMTAuOS40LjEuXHJcblx0Zm9yICggdmFyIGlhID0gMDsgaWEgPCBpZF9hZGRpdGlvbmFsX2Fyci5sZW5ndGg7IGlhKysgKSB7XHJcblx0XHRpZF9hZGRpdGlvbmFsX2FyclsgaWEgXSA9IHBhcnNlSW50KCBpZF9hZGRpdGlvbmFsX2FyclsgaWEgXSwgMTAgKTtcclxuXHR9XHJcblxyXG5cdGlmICggISBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLmlzKCAnOnZpc2libGUnICkgKSB7XHJcblx0XHR3cGJjX2Jvb2tpbmdfZm9ybV9fc3Bpbl9sb2FkZXJfX3Nob3coIHJlc291cmNlX2lkICk7IC8vIFNob3cgU3Bpbm5lclxyXG5cdH1cclxuXHJcblx0Ly8gSGVscGVyOiByZXdyaXRlIGZpZWxkIG5hbWUgc3VmZml4IGZyb20gcmVzb3VyY2VfaWQgLT4gaWRfYWRkaXRpb25hbC5cclxuXHRmdW5jdGlvbiB3cGJjX3Jld3JpdGVfZmllbGRfbmFtZV9zdWZmaXgoIGZpZWxkX25hbWUsIG9sZF9pZCwgbmV3X2lkICkge1xyXG5cclxuXHRcdGZpZWxkX25hbWUgPSBTdHJpbmcoIGZpZWxkX25hbWUgKTtcclxuXHJcblx0XHR2YXIgb2xkX2lkX3N0ciA9IFN0cmluZyggb2xkX2lkICk7XHJcblx0XHR2YXIgbmV3X2lkX3N0ciA9IFN0cmluZyggbmV3X2lkICk7XHJcblxyXG5cdFx0Ly8gSGFuZGxlIGZpZWxkcyB3aXRoIFtdLlxyXG5cdFx0aWYgKFxyXG5cdFx0XHQoIGZpZWxkX25hbWUubGVuZ3RoID49ICggb2xkX2lkX3N0ci5sZW5ndGggKyAyICkgKSAmJlxyXG5cdFx0XHQoIGZpZWxkX25hbWUuc3Vic3RyKCBmaWVsZF9uYW1lLmxlbmd0aCAtICggb2xkX2lkX3N0ci5sZW5ndGggKyAyICkgKSA9PT0gKCBvbGRfaWRfc3RyICsgJ1tdJyApIClcclxuXHRcdCkge1xyXG5cdFx0XHRyZXR1cm4gZmllbGRfbmFtZS5zdWJzdHIoIDAsIGZpZWxkX25hbWUubGVuZ3RoIC0gKCBvbGRfaWRfc3RyLmxlbmd0aCArIDIgKSApICsgbmV3X2lkX3N0ciArICdbXSc7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gSGFuZGxlIGZpZWxkcyB3aXRob3V0IFtdLlxyXG5cdFx0aWYgKFxyXG5cdFx0XHQoIGZpZWxkX25hbWUubGVuZ3RoID49IG9sZF9pZF9zdHIubGVuZ3RoICkgJiZcclxuXHRcdFx0KCBmaWVsZF9uYW1lLnN1YnN0ciggZmllbGRfbmFtZS5sZW5ndGggLSBvbGRfaWRfc3RyLmxlbmd0aCApID09PSBvbGRfaWRfc3RyIClcclxuXHRcdCkge1xyXG5cdFx0XHRyZXR1cm4gZmllbGRfbmFtZS5zdWJzdHIoIDAsIGZpZWxkX25hbWUubGVuZ3RoIC0gb2xkX2lkX3N0ci5sZW5ndGggKSArIG5ld19pZF9zdHI7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRmFsbGJhY2s6IHJldHVybiB1bmNoYW5nZWQgKHNhZmVyIHRoYW4gYnJlYWtpbmcgbmFtZSkuXHJcblx0XHRyZXR1cm4gZmllbGRfbmFtZTtcclxuXHR9XHJcblxyXG5cdGZvciAoIGlhID0gMDsgaWEgPCBpZF9hZGRpdGlvbmFsX2Fyci5sZW5ndGg7IGlhKysgKSB7XHJcblxyXG5cdFx0dmFyIGlkX2FkZGl0aW9uYWwgPSBpZF9hZGRpdGlvbmFsX2FyclsgaWEgXTtcclxuXHJcblx0XHQvLyBGaXhJbjogMTAuOS40LjEuXHJcblx0XHRpZiAoIGlkX2FkZGl0aW9uYWwgPD0gMCApIHtcclxuXHRcdFx0Y29udGludWU7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmVidWlsZCBmb3JtZGF0YSBmb3IgZWFjaCBhZGRpdGlvbmFsIGNhbGVuZGFyIChsZWdhY3kgYmVoYXZpb3IpLlxyXG5cdFx0dmFyIGZvcm1kYXRhX2FkZGl0aW9uYWxfYXJyID0gU3RyaW5nKCBmb3JtZGF0YSApLnNwbGl0KCAnficgKTtcclxuXHRcdHZhciBmb3JtZGF0YV9hZGRpdGlvbmFsID0gJyc7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZm9ybWRhdGFfYWRkaXRpb25hbF9hcnIubGVuZ3RoOyBqKysgKSB7XHJcblxyXG5cdFx0XHR2YXIgbXlfZm9ybV9maWVsZCA9IGZvcm1kYXRhX2FkZGl0aW9uYWxfYXJyWyBqIF0uc3BsaXQoICdeJyApO1xyXG5cclxuXHRcdFx0aWYgKCBmb3JtZGF0YV9hZGRpdGlvbmFsICE9PSAnJyApIHtcclxuXHRcdFx0XHRmb3JtZGF0YV9hZGRpdGlvbmFsICs9ICd+JztcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gU2FmZXR5OiBlbnN1cmUgd2UgaGF2ZSBhdCBsZWFzdCB0eXBlIF4gbmFtZSBeIHZhbHVlLlxyXG5cdFx0XHRpZiAoIG15X2Zvcm1fZmllbGQubGVuZ3RoIDwgMyApIHtcclxuXHRcdFx0XHRmb3JtZGF0YV9hZGRpdGlvbmFsICs9IGZvcm1kYXRhX2FkZGl0aW9uYWxfYXJyWyBqIF07XHJcblx0XHRcdFx0Y29udGludWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG15X2Zvcm1fZmllbGRbIDEgXSA9IHdwYmNfcmV3cml0ZV9maWVsZF9uYW1lX3N1ZmZpeCggbXlfZm9ybV9maWVsZFsgMSBdLCByZXNvdXJjZV9pZCwgaWRfYWRkaXRpb25hbCApO1xyXG5cdFx0XHRmb3JtZGF0YV9hZGRpdGlvbmFsICs9IG15X2Zvcm1fZmllbGRbIDAgXSArICdeJyArIG15X2Zvcm1fZmllbGRbIDEgXSArICdeJyArIG15X2Zvcm1fZmllbGRbIDIgXTtcclxuXHRcdH1cclxuXHJcblx0XHQvLyBJZiBwYXltZW50IGZvcm0gZm9yIG1haW4gYm9va2luZyByZXNvdXJjZSBpcyBzaG93aW5nLCBhcHBlbmQgZm9yIGFkZGl0aW9uYWwgY2FsZW5kYXJzLlxyXG5cdFx0aWYgKCBqUXVlcnkoICcjZ2F0ZXdheV9wYXltZW50X2Zvcm1zJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApIHtcclxuXHRcdFx0alF1ZXJ5KCAnI2dhdGV3YXlfcGF5bWVudF9mb3JtcycgKyByZXNvdXJjZV9pZCApLmFmdGVyKCAnPGRpdiBpZD1cImdhdGV3YXlfcGF5bWVudF9mb3JtcycgKyBpZF9hZGRpdGlvbmFsICsgJ1wiPjwvZGl2PicgKTtcclxuXHRcdFx0alF1ZXJ5KCAnI2dhdGV3YXlfcGF5bWVudF9mb3JtcycgKyByZXNvdXJjZV9pZCApLmFmdGVyKCAnPGRpdiBpZD1cImFqYXhfcmVzcG9uZF9pbnNlcnQnICsgaWRfYWRkaXRpb25hbCArICdcIiBzdHlsZT1cImRpc3BsYXk6bm9uZTtcIj48L2Rpdj4nICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gRml4SW46IDguNS4yLjE3LlxyXG5cdFx0d3BiY19zZW5kX2FqYXhfc3VibWl0KCBpZF9hZGRpdGlvbmFsLCBmb3JtZGF0YV9hZGRpdGlvbmFsLCBjYXB0Y2hhX2NoYWxhbmdlLCB1c2VyX2NhcHRjaGEsIGlzX3NlbmRfZW1laWxzLCBteV9ib29raW5nX2hhc2gsIG15X2Jvb2tpbmdfZm9ybSwgd3BkZXZfYWN0aXZlX2xvY2FsZSApO1xyXG5cdH1cclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZW5kIEFqYXggc3VibWl0IChsZWdhY3k6IHNlbmRfYWpheF9zdWJtaXQpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge251bWJlcnxzdHJpbmd9IHJlc291cmNlX2lkXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgZm9ybWRhdGFcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBjYXB0Y2hhX2NoYWxhbmdlXHJcbiAqIEBwYXJhbSB7c3RyaW5nfSAgICAgICAgdXNlcl9jYXB0Y2hhXHJcbiAqIEBwYXJhbSB7bnVtYmVyfSAgICAgICAgaXNfc2VuZF9lbWVpbHNcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBteV9ib29raW5nX2hhc2hcclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICBteV9ib29raW5nX2Zvcm1cclxuICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICB3cGRldl9hY3RpdmVfbG9jYWxlXHJcbiAqXHJcbiAqIEByZXR1cm4ge3VuZGVmaW5lZH0gTGVnYWN5IGJlaGF2aW9yLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19zZW5kX2FqYXhfc3VibWl0KHJlc291cmNlX2lkLCBmb3JtZGF0YSwgY2FwdGNoYV9jaGFsYW5nZSwgdXNlcl9jYXB0Y2hhLCBpc19zZW5kX2VtZWlscywgbXlfYm9va2luZ19oYXNoLCBteV9ib29raW5nX2Zvcm0sIHdwZGV2X2FjdGl2ZV9sb2NhbGUpIHtcclxuXHJcblx0cmVzb3VyY2VfaWQgPSBwYXJzZUludCggcmVzb3VyY2VfaWQsIDEwICk7XHJcblxyXG5cdC8vIERpc2FibGUgU3VibWl0IHwgU2hvdyBzcGluIGxvYWRlci5cclxuXHR3cGJjX2Jvb2tpbmdfZm9ybV9fb25fc3VibWl0X191aV9lbGVtZW50c19kaXNhYmxlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHQvLyBGaXhJbjogMjAyNi0wMi0wNSAtIHBhc3MgcHJldmlldyBjb250ZXh0IHRvIGJvb2tpbmcgY3JlYXRlIEFqYXguXHJcblx0dmFyIGZvcm1fc3RhdHVzICA9IHdwYmNfX2dldF9mb3JtX3N0YXR1c19mb3Jfc3VibWl0KCByZXNvdXJjZV9pZCApO1xyXG5cdHZhciBwcmV2aWV3X2FyZ3MgPSAoZm9ybV9zdGF0dXMgPT09ICdwcmV2aWV3JykgPyB3cGJjX19nZXRfYmZiX3ByZXZpZXdfYXJnc19mcm9tX2xvY2F0aW9uKCkgOiBudWxsO1xyXG5cdHZhciAkYWRkX2Jvb2tpbmdfbW9kYWwgPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICkuY2xvc2VzdCggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbicgKTtcblx0dmFyIGlzX2FsbG93X3Bhc3QgPSAwO1xuXHR2YXIgY2xhc3NpY19ib29raW5nX2NvbnRleHRfdG9rZW4gPSAnJztcblx0dmFyIGFkbWluX2Jvb2tpbmdfbm9uY2UgPSAnJztcblx0dmFyIGhhc19hZGRfYm9va2luZ19tb2RhbF9jb250ZXh0ID0gKCAkYWRkX2Jvb2tpbmdfbW9kYWwubGVuZ3RoICYmICRhZGRfYm9va2luZ19tb2RhbC5pcyggJzp2aXNpYmxlJyApICk7XG5cdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBfd3BiYyApIHtcblx0XHRhZG1pbl9ib29raW5nX25vbmNlID0gU3RyaW5nKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aGlzX3BhZ2VfYWRtaW5fYm9va2luZ19ub25jZScgKSB8fCAnJyApO1xuXHR9XG5cclxuXHRpZiAoIGhhc19hZGRfYm9va2luZ19tb2RhbF9jb250ZXh0ICkge1xyXG5cdFx0aXNfYWxsb3dfcGFzdCA9ICRhZGRfYm9va2luZ19tb2RhbC5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy1hbGxvdy1wYXN0XScgKS5maXJzdCgpLmlzKCAnOmNoZWNrZWQnICkgPyAxIDogMDtcclxuXHRcdGlmICggISBpc19hbGxvd19wYXN0ICkge1xyXG5cdFx0XHRpc19hbGxvd19wYXN0ID0gKCAnMScgPT09IFN0cmluZyggJGFkZF9ib29raW5nX21vZGFsLmF0dHIoICdkYXRhLXdwYmMtYWRkLWJvb2tpbmctYWxsb3ctcGFzdCcgKSB8fCAnMCcgKSApID8gMSA6IDA7XHJcblx0XHR9XHJcblx0fVxyXG5cdGlmICggISBoYXNfYWRkX2Jvb2tpbmdfbW9kYWxfY29udGV4dCAmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgX3dwYmMgKSApIHtcblx0XHRpc19hbGxvd19wYXN0ID0gKCAnMScgPT09IFN0cmluZyggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGhpc19wYWdlX2FsbG93X3Bhc3QnICkgfHwgJzAnICkgKSA/IDEgOiAwO1xuXHRcdGNsYXNzaWNfYm9va2luZ19jb250ZXh0X3Rva2VuID0gU3RyaW5nKCBfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2xhc3NpY19ib29raW5nX2NvbnRleHRfdG9rZW4nICkgfHwgJycgKTtcblx0fVxuXHJcblx0dmFyIHJlcXVlc3RfcGFyYW1zID0ge1xyXG5cdFx0J3Jlc291cmNlX2lkJyAgICAgICAgICAgICAgOiByZXNvdXJjZV9pZCxcclxuXHRcdCdkYXRlc19kZG1teXlfY3N2JyAgICAgICAgIDogZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoICdkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWx1ZSxcclxuXHRcdCdmb3JtZGF0YScgICAgICAgICAgICAgICAgIDogZm9ybWRhdGEsXHJcblx0XHQnYm9va2luZ19oYXNoJyAgICAgICAgICAgICA6IG15X2Jvb2tpbmdfaGFzaCxcclxuXHRcdCdjdXN0b21fZm9ybScgICAgICAgICAgICAgIDogbXlfYm9va2luZ19mb3JtLFxyXG5cdFx0J2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInOiAoICggbnVsbCAhPT0gX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInICkgKSA/IF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJyApLmpvaW4oICcsJyApIDogJycgKSxcclxuXHRcdCdjYXB0Y2hhX2NoYWxhbmdlJyAgICAgICAgIDogY2FwdGNoYV9jaGFsYW5nZSxcclxuXHRcdCdjYXB0Y2hhX3VzZXJfaW5wdXQnICAgICAgIDogdXNlcl9jYXB0Y2hhLFxyXG5cdFx0J2lzX2VtYWlsc19zZW5kJyAgICAgICAgICAgOiBpc19zZW5kX2VtZWlscyxcclxuXHRcdCdhY3RpdmVfbG9jYWxlJyAgICAgICAgICAgIDogd3BkZXZfYWN0aXZlX2xvY2FsZSxcclxuXHRcdCdmb3JtX3N0YXR1cycgICAgICAgICAgICAgIDogZm9ybV9zdGF0dXMsXG5cdFx0J2FsbG93X3Bhc3QnICAgICAgICAgICAgICAgOiBpc19hbGxvd19wYXN0LFxuXHRcdCdjbGFzc2ljX2Jvb2tpbmdfY29udGV4dF90b2tlbic6IGNsYXNzaWNfYm9va2luZ19jb250ZXh0X3Rva2VuLFxuXHRcdCd3cGJjX2FkbWluX2Jvb2tpbmdfbm9uY2UnICAgICA6IGFkbWluX2Jvb2tpbmdfbm9uY2Vcblx0fTtcblxyXG5cdHZhciAkdGltZV9vdmVycmlkZV9wYW5lbCA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKS5maW5kKCAnW2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXBhbmVsXScgKS5maXJzdCgpO1xyXG5cdGlmICggISAkdGltZV9vdmVycmlkZV9wYW5lbC5sZW5ndGggKSB7XHJcblx0XHQkdGltZV9vdmVycmlkZV9wYW5lbCA9IGpRdWVyeSggJyN3cGJjX21vZGFsX19hZGRfYm9va2luZ19fc2VjdGlvbjp2aXNpYmxlJyApLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtcGFuZWxdJyApLmZpcnN0KCk7XHJcblx0fVxyXG5cdGlmIChcclxuXHRcdCAgICR0aW1lX292ZXJyaWRlX3BhbmVsLmxlbmd0aFxyXG5cdFx0JiYgJHRpbWVfb3ZlcnJpZGVfcGFuZWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1lbmFibGVkXScgKS5maXJzdCgpLmlzKCAnOmNoZWNrZWQnIClcclxuXHQpIHtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX3RpbWVfb3ZlcnJpZGVfZW5hYmxlZCddID0gMTtcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX3RpbWVfb3ZlcnJpZGVfc291cmNlJ10gID0gJHRpbWVfb3ZlcnJpZGVfcGFuZWwuYXR0ciggJ2RhdGEtd3BiYy1hZGQtYm9va2luZy10aW1lLW92ZXJyaWRlLXNvdXJjZScgKSB8fCAnJztcclxuXHRcdHJlcXVlc3RfcGFyYW1zWyd3cGJjX3RpbWVfb3ZlcnJpZGVfc3RhcnQnXSAgID0gJHRpbWVfb3ZlcnJpZGVfcGFuZWwuZmluZCggJ1tkYXRhLXdwYmMtYWRkLWJvb2tpbmctdGltZS1vdmVycmlkZS1maWVsZD1cInN0YXJ0XCJdJyApLmZpcnN0KCkudmFsKCkgfHwgJyc7XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snd3BiY190aW1lX292ZXJyaWRlX2VuZCddICAgICA9ICR0aW1lX292ZXJyaWRlX3BhbmVsLmZpbmQoICdbZGF0YS13cGJjLWFkZC1ib29raW5nLXRpbWUtb3ZlcnJpZGUtZmllbGQ9XCJlbmRcIl0nICkuZmlyc3QoKS52YWwoKSB8fCAnJztcclxuXHR9XHJcblxyXG5cdHZhciBzZWxlY3RlZF9kYXRlc19jb3VudCA9IFN0cmluZyggcmVxdWVzdF9wYXJhbXNbJ2RhdGVzX2RkbW15eV9jc3YnXSB8fCAnJyApLnNwbGl0KCAnLCcgKS5maWx0ZXIoIGZ1bmN0aW9uKCBkYXRlX3RleHQgKXtcclxuXHRcdHJldHVybiAnJyAhPT0gU3RyaW5nKCBkYXRlX3RleHQgfHwgJycgKS5yZXBsYWNlKCAvXlxccyt8XFxzKyQvZywgJycgKTtcclxuXHR9ICkubGVuZ3RoO1xyXG5cdHZhciBpc190aW1lc19hdmFpbGFiaWxpdHlfb3ZlcnJpZGUgPSAoXHJcblx0XHQgICAoIDEgPT09IHBhcnNlSW50KCByZXF1ZXN0X3BhcmFtc1snd3BiY190aW1lX292ZXJyaWRlX2VuYWJsZWQnXSB8fCAwLCAxMCApIClcclxuXHRcdCYmICggJ3RpbWVzX2F2YWlsYWJpbGl0eScgPT09IFN0cmluZyggcmVxdWVzdF9wYXJhbXNbJ3dwYmNfdGltZV9vdmVycmlkZV9zb3VyY2UnXSB8fCAnJyApIClcclxuXHQpO1xyXG5cdGlmIChcclxuXHRcdCAgIChcclxuXHRcdFx0ICAgaGFzX2FkZF9ib29raW5nX21vZGFsX2NvbnRleHRcclxuXHRcdFx0JiYgJzEnID09PSBTdHJpbmcoICRhZGRfYm9va2luZ19tb2RhbC5hdHRyKCAnZGF0YS13cGJjLWFkZC1ib29raW5nLWZvcmNlLXJlY3VycmVudC10aW1lJyApIHx8ICcwJyApXHJcblx0XHQgICApXHJcblx0XHR8fCAoXHJcblx0XHRcdCAgIGlzX3RpbWVzX2F2YWlsYWJpbGl0eV9vdmVycmlkZVxyXG5cdFx0XHQmJiAoIHNlbGVjdGVkX2RhdGVzX2NvdW50ID4gMSApXHJcblx0XHQgICApXHJcblx0KSB7XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snaXNfdXNlX2Jvb2tpbmdfcmVjdXJyZW50X3RpbWUnXSA9IDE7XHJcblx0fVxyXG5cclxuXHQvLyBJZiBwcmV2aWV3LCBwYXNzIHNlc3Npb24gaWRlbnRpZmllcnMgc28gUEhQIGNhbiBsb2FkIHRyYW5zaWVudCBzbmFwc2hvdC5cclxuXHRpZiAoIHByZXZpZXdfYXJncyAmJiBwcmV2aWV3X2FyZ3MudG9rZW4gJiYgcHJldmlld19hcmdzLmZvcm1faWQgKSB7XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snd3BiY19iZmJfcHJldmlldyddICAgICAgICAgPSAxO1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfYmZiX3ByZXZpZXdfdG9rZW4nXSAgID0gcHJldmlld19hcmdzLnRva2VuO1xyXG5cdFx0cmVxdWVzdF9wYXJhbXNbJ3dwYmNfYmZiX3ByZXZpZXdfZm9ybV9pZCddID0gcHJldmlld19hcmdzLmZvcm1faWQ7XHJcblx0XHRyZXF1ZXN0X3BhcmFtc1snd3BiY19iZmJfcHJldmlld19ub25jZSddICAgPSBwcmV2aWV3X2FyZ3Mubm9uY2U7IC8vIG5vdGU6IFVSTCBwYXJhbSBpcyBgbm9uY2VgLlxyXG5cdH1cclxuXHJcblx0dmFyIGlzX2V4aXQgPSB3cGJjX2FqeF9ib29raW5nX19jcmVhdGUoIHJlcXVlc3RfcGFyYW1zICk7XHJcblxyXG5cdGlmICggdHJ1ZSA9PT0gaXNfZXhpdCApIHtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcbn1cclxuXHJcblxyXG5cclxuLy8gPT0gSGVscGVyIEZ1bmN0aW9ucyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcblxyXG4vKipcclxuICogUGFyc2UgcXVlcnkgc3RyaW5nIGludG8ge2tleTp2YWx1ZX0gKG9sZC1icm93c2VyIHNhZmUpLlxyXG4gKlxyXG4gKiBAcGFyYW0ge3N0cmluZ30gcXNcclxuICogQHJldHVybiB7T2JqZWN0fVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19fcGFyc2VfcXVlcnlfc3RyaW5nKHFzKSB7XHJcblx0dmFyIG91dCA9IHt9O1xyXG5cdHFzICAgICAgPSAocXMgfHwgJycpO1xyXG5cdHFzICAgICAgPSBxcy5yZXBsYWNlKCAvXlxcPy8sICcnICk7XHJcblx0aWYgKCAhIHFzICkge1xyXG5cdFx0cmV0dXJuIG91dDtcclxuXHR9XHJcblxyXG5cdHZhciBwYXJ0cyA9IHFzLnNwbGl0KCAnJicgKTtcclxuXHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKyApIHtcclxuXHRcdHZhciBrdiA9IHBhcnRzW2ldLnNwbGl0KCAnPScgKTtcclxuXHRcdHZhciBrICA9IGRlY29kZVVSSUNvbXBvbmVudCgga3ZbMF0gfHwgJycgKTtcclxuXHRcdGlmICggISBrICkge1xyXG5cdFx0XHRjb250aW51ZTtcclxuXHRcdH1cclxuXHRcdHZhciB2ICA9IGRlY29kZVVSSUNvbXBvbmVudCgga3Yuc2xpY2UoIDEgKS5qb2luKCAnPScgKSB8fCAnJyApO1xyXG5cdFx0b3V0W2tdID0gdjtcclxuXHR9XHJcblx0cmV0dXJuIG91dDtcclxufVxyXG5cclxuLyoqXHJcbiAqIERldGVjdCBwcmV2aWV3IGFyZ3MgZnJvbSBjdXJyZW50IFVSTCAoaWZyYW1lIFVSTCkuXHJcbiAqXHJcbiAqIEByZXR1cm4ge09iamVjdHxudWxsfSB7IHRva2VuLCBmb3JtX2lkLCBub25jZSB9IG9yIG51bGxcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfX2dldF9iZmJfcHJldmlld19hcmdzX2Zyb21fbG9jYXRpb24oKSB7XHJcblx0dHJ5IHtcclxuXHRcdHZhciBwID0gd3BiY19fcGFyc2VfcXVlcnlfc3RyaW5nKCAod2luZG93LmxvY2F0aW9uICYmIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2gpID8gd2luZG93LmxvY2F0aW9uLnNlYXJjaCA6ICcnICk7XHJcblxyXG5cdFx0aWYgKCAhIHAud3BiY19iZmJfcHJldmlldyB8fCAocC53cGJjX2JmYl9wcmV2aWV3ID09PSAnMCcpICkge1xyXG5cdFx0XHRyZXR1cm4gbnVsbDtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICEgcC53cGJjX2JmYl9wcmV2aWV3X3Rva2VuIHx8ICEgcC53cGJjX2JmYl9wcmV2aWV3X2Zvcm1faWQgKSB7XHJcblx0XHRcdHJldHVybiBudWxsO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB7XHJcblx0XHRcdHRva2VuICA6IFN0cmluZyggcC53cGJjX2JmYl9wcmV2aWV3X3Rva2VuICksXHJcblx0XHRcdGZvcm1faWQ6IHBhcnNlSW50KCBwLndwYmNfYmZiX3ByZXZpZXdfZm9ybV9pZCwgMTAgKSB8fCAwLFxyXG5cdFx0XHRub25jZSAgOiAocC5ub25jZSkgPyBTdHJpbmcoIHAubm9uY2UgKSA6ICcnXHJcblx0XHR9O1xyXG5cdH0gY2F0Y2ggKCBlICkge1xyXG5cdFx0cmV0dXJuIG51bGw7XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogUmVzb2x2ZSBmb3JtIHN0YXR1cyBmb3Igc3VibWl0LlxyXG4gKlxyXG4gKiBQcmlvcml0eTpcclxuICogMSkgc2hvcnRjb2RlIHBhcmFtIGV4cG9zZWQgdmlhIF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSguLi4sICdmb3JtX3N0YXR1cycpXHJcbiAqIDIpIGRldGVjdCBwcmV2aWV3IFVSTCBhcmdzXHJcbiAqIDMpIGZhbGxiYWNrOiBwdWJsaXNoZWRcclxuICpcclxuICogQHBhcmFtIHtudW1iZXJ9IHJlc291cmNlX2lkXHJcbiAqIEByZXR1cm4ge3N0cmluZ30gJ3ByZXZpZXcnfCdwdWJsaXNoZWQnXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX19nZXRfZm9ybV9zdGF0dXNfZm9yX3N1Ym1pdChyZXNvdXJjZV9pZCkge1xyXG5cclxuXHR2YXIgc3RhdHVzID0gJyc7XHJcblxyXG5cdHRyeSB7XHJcblx0XHRpZiAoICh0eXBlb2YgX3dwYmMgIT09ICd1bmRlZmluZWQnKSAmJiBfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUgKSB7XHJcblx0XHRcdHN0YXR1cyA9IF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdmb3JtX3N0YXR1cycgKTtcclxuXHRcdH1cclxuXHR9IGNhdGNoICggZSApIHt9XHJcblxyXG5cdHN0YXR1cyA9IChzdGF0dXMgPT0gbnVsbCkgPyAnJyA6IFN0cmluZyggc3RhdHVzICk7XHJcblx0c3RhdHVzID0gc3RhdHVzLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cdC8vIFVSTC1iYXNlZCBkZXRlY3Rpb24gZm9yIHByZXZpZXcgaWZyYW1lLlxyXG5cdHZhciBwcmV2aWV3X2FyZ3MgPSB3cGJjX19nZXRfYmZiX3ByZXZpZXdfYXJnc19mcm9tX2xvY2F0aW9uKCk7XHJcblx0aWYgKCBwcmV2aWV3X2FyZ3MgKSB7XHJcblx0XHRyZXR1cm4gJ3ByZXZpZXcnO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIChzdGF0dXMgPT09ICdwcmV2aWV3JykgPyAncHJldmlldycgOiAncHVibGlzaGVkJztcclxufVxyXG5cclxuXHJcblxyXG4vLyA9PSBCYWNrd2FyZC1jb21wYXRpYmxlIHdyYXBwZXJzIChrZWVwIG9sZCBnbG9iYWwgbmFtZXMgd29ya2luZyAxMDAlIGFzIGJlZm9yZSkuID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuZnVuY3Rpb24gbXlib29raW5nX3N1Ym1pdCggc3VibWl0X2Zvcm0sIHJlc291cmNlX2lkLCB3cGRldl9hY3RpdmVfbG9jYWxlICkge1xyXG5cdHJldHVybiB3cGJjX2Jvb2tpbmdfZm9ybV9zdWJtaXQoIHN1Ym1pdF9mb3JtLCByZXNvdXJjZV9pZCwgd3BkZXZfYWN0aXZlX2xvY2FsZSApO1xyXG59XHJcbiIsInRyeSB7XHJcblx0dmFyIGV2ID0gKHR5cGVvZiBDdXN0b21FdmVudCA9PT0gJ2Z1bmN0aW9uJykgPyBuZXcgQ3VzdG9tRXZlbnQoICd3cGJjLXJlYWR5JyApIDogZG9jdW1lbnQuY3JlYXRlRXZlbnQoICdFdmVudCcgKTtcclxuXHRpZiAoIGV2LmluaXRFdmVudCApIHtcclxuXHRcdGV2LmluaXRFdmVudCggJ3dwYmMtcmVhZHknLCB0cnVlLCB0cnVlICk7XHJcblx0fVxyXG5cdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQoIGV2ICk7XHJcblx0Y29uc29sZS5sb2coICd3cGJjLXJlYWR5JyApO1xyXG59IGNhdGNoICggZSApIHtcclxuXHRjb25zb2xlLmVycm9yKCBcIldQQkMgZXZlbnQgJ3dwYmMtcmVhZHknIGZhaWxlZCFcIiwgZSApO1xyXG59XHJcbiJdfQ==

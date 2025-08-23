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
 * Order or child booking resources saved here:  	_wpbc.booking__get_param_value( resource_id, 'resources_id_arr__in_dates' )		[2,10,12,11]
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
 * 	Example 1:		var num_selected_days = wpbc_auto_select_dates_in_calendar( resource_id, '2024-05-15', '2024-05-25' );
 * 	Example 2:		var num_selected_days = wpbc_auto_select_dates_in_calendar( resource_id, ['2024-05-09','2024-05-19','2024-05-25'] );
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

	// If the calendar with the same Booking resource is activated already, then exit.
	if ( true === jQuery( '#calendar_booking' + resource_id ).hasClass( 'hasDatepick' ) ){ return false; }

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
	if (   ( location.href.indexOf('page=wpbc-new') != -1 )
		&& (
			  ( location.href.indexOf('booking_hash') != -1 )                  // Comment this line for ability to add  booking in past days at  Booking > Add booking page.
		   || ( location.href.indexOf('allow_past') != -1 )                // FixIn: 10.7.1.2.
		)
	){
		// local__min_date = null;
		// FixIn: 10.14.1.4.
		local__min_date  = new Date( _wpbc.get_other_param( 'time_local_arr' )[0], ( parseInt( _wpbc.get_other_param( 'time_local_arr' )[1] ) - 1), _wpbc.get_other_param( 'time_local_arr' )[2], _wpbc.get_other_param( 'time_local_arr' )[3], _wpbc.get_other_param( 'time_local_arr' )[4], 0 );
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
																	 *	string_dates   =   '23.08.2023 - 26.08.2023'    |    '23.08.2023 - 23.08.2023'    |    '19.09.2023, 24.08.2023, 30.09.2023'
																	 *  js_dates_arr   =   range: [ Date (Aug 23 2023), Date (Aug 25 2023)]     |     multiple: [ Date(Oct 24 2023), Date(Oct 20 2023), Date(Oct 16 2023) ]
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
	 * Apply CSS to calendar date cells
	 *
	 * @param date										-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00 GMT+0200 (Eastern European Standard Time)
	 * @param calendar_params_arr						-  Calendar Settings Object:  	{
	 *																  						"resource_id": 4
	 *																					}
	 * @param datepick_this								- this of datepick Obj
	 * @returns {(*|string)[]|(boolean|string)[]}		- [ {true -available | false - unavailable}, 'CSS classes for calendar day cell' ]
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
				break;

			case 'resource_availability':
				css_classes__for_date.push( 'date_user_unavailable', 'resource_unavailable' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				break;

			case 'weekday_unavailable':
				css_classes__for_date.push( 'date_user_unavailable', 'weekday_unavailable' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				break;

			case 'from_today_unavailable':
				css_classes__for_date.push( 'date_user_unavailable', 'from_today_unavailable' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
				break;

			case 'limit_available_from_today':
				css_classes__for_date.push( 'date_user_unavailable', 'limit_available_from_today' );
				date_bookings_obj[ 'summary']['status_for_bookings' ] = '';														// Reset booking status color for possible old bookings on this date
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
				if ( date_bookings_obj[ 'summary' ][ 'status_for_bookings' ].indexOf( 'approved_pending' ) > -1 ){
					css_classes__for_date.push( 'check_out_time_date_approved', 'check_in_time_date2approve' );
				}
				if ( date_bookings_obj[ 'summary' ][ 'status_for_bookings' ].indexOf( 'pending_approved' ) > -1 ){
					css_classes__for_date.push( 'check_out_time_date2approve', 'check_in_time_date_approved' );
				}
				break;

			case 'check_in':
				css_classes__for_date.push( 'timespartly', 'check_in_time' );

				// FixIn: 9.9.0.33.
				if ( date_bookings_obj[ 'summary' ][ 'status_for_bookings' ].indexOf( 'pending' ) > -1 ){
					css_classes__for_date.push( 'check_in_time_date2approve' );
				} else if ( date_bookings_obj[ 'summary' ][ 'status_for_bookings' ].indexOf( 'approved' ) > -1 ){
					css_classes__for_date.push( 'check_in_time_date_approved' );
				}
				break;

			case 'check_out':
				css_classes__for_date.push( 'timespartly', 'check_out_time' );

				// FixIn: 9.9.0.33.
				if ( date_bookings_obj[ 'summary' ][ 'status_for_bookings' ].indexOf( 'pending' ) > -1 ){
					css_classes__for_date.push( 'check_out_time_date2approve' );
				} else if ( date_bookings_obj[ 'summary' ][ 'status_for_bookings' ].indexOf( 'approved' ) > -1 ){
					css_classes__for_date.push( 'check_out_time_date_approved' );
				}
				break;

			default:
				// mixed statuses: 'change_over check_out' .... variations.... check more in 		function wpbc_get_availability_per_days_arr()
				date_bookings_obj[ 'summary']['status_for_day' ] = 'available';
		}



		if ( 'available' != date_bookings_obj[ 'summary']['status_for_day' ] ){

			var is_set_pending_days_selectable = _wpbc.calendar__get_param_value( resource_id, 'pending_days_selectable' );	// set pending days selectable          // FixIn: 8.6.1.18.

			switch ( date_bookings_obj[ 'summary']['status_for_bookings' ] ){

				case '':
					// Usually  it's means that day  is available or unavailable without the bookings
					break;

				case 'pending':
					css_classes__for_date.push( 'date2approve' );
					is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
					break;

				case 'approved':
					css_classes__for_date.push( 'date_approved' );
					break;

				// Situations for "change-over" days: ----------------------------------------------------------------------
				case 'pending_pending':
					css_classes__for_date.push( 'check_out_time_date2approve', 'check_in_time_date2approve' );
					is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
					break;

				case 'pending_approved':
					css_classes__for_date.push( 'check_out_time_date2approve', 'check_in_time_date_approved' );
					is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
					break;

				case 'approved_pending':
					css_classes__for_date.push( 'check_out_time_date_approved', 'check_in_time_date2approve' );
					is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
					break;

				case 'approved_approved':
					css_classes__for_date.push( 'check_out_time_date_approved', 'check_in_time_date_approved' );
					break;

				default:

			}
		}

		return [ is_day_selectable, css_classes__for_date.join( ' ' ) ];
	}


	/**
	 * Mouseover calendar date cells
	 *
	 * @param string_date
	 * @param date										-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00 GMT+0200 (Eastern European Standard Time)
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

		if ( ( is_unselectable_calendar ) && ( ! is_booking_form_exist ) ){

			/**
			 *  Un Hover all dates in calendar (without the booking form), if only Availability Calendar here and we do not insert Booking form by mistake.
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
			|| ( location.href.indexOf( 'page=wpbc-new' ) > 0 )
			|| ( location.href.indexOf( 'page=wpbc-setup' ) > 0 )
			|| ( location.href.indexOf( 'page=wpbc-availability' ) > 0 )
			|| (  ( location.href.indexOf( 'page=wpbc-settings' ) > 0 )  &&
				  ( location.href.indexOf( '&tab=form' ) > 0 )
			   )
		){
			// The same as dates selection,  but for days hovering

			if ( 'function' == typeof( wpbc__calendar__do_days_highlight__bs ) ){
				wpbc__calendar__do_days_highlight__bs( sql_class_day, date, resource_id );
			}
		}

	}


	/**
	 * Select calendar date cells
	 *
	 * @param date										-  JavaScript Date Obj:  		Mon Dec 11 2023 00:00:00 GMT+0200 (Eastern European Standard Time)
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


		if ( 'function' === typeof (wpbc__calendar__do_days_select__bs) ){ wpbc__calendar__do_days_select__bs( date, resource_id ); }

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

		// 4. Loop  all  time Fields options		// FixIn: 10.3.0.2.
		for ( let field_key = 0; field_key < time_fields_obj_arr.length; field_key++ ){

			time_fields_obj_arr[ field_key ].disabled = 0;          // By default, this time field is not disabled.

			time_fields_obj = time_fields_obj_arr[ field_key ];		// { times_as_seconds: [ 21600, 23400 ], value_option_24h: '06:00 - 06:30', name: 'rangetime2[]', jquery_option: jQuery_Object {}}

			// Loop  all  selected dates.
			for ( var i = 0; i < selected_dates_arr.length; i++ ) {

				// Get Date: '2023-08-18'.
				sql_date = selected_dates_arr[i];

				var is_time_in_past = wpbc_check_is_time_in_past( today_time__shift, sql_date, time_fields_obj );
				// Exception  for 'End Time' field,  when  selected several dates. // FixIn: 10.14.1.5.
				if ( ('On' !== _wpbc.calendar__get_param_value( resource_id, 'booking_recurrent_time' )) &&
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
			 * @param time_fields_obj_arr      - this value is from  the func:  	wpbc_get__time_fields__in_booking_form__as_arr( resource_id )
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
	 * @returns {[]}			[ "2023-08-23", "2023-08-24", "2023-08-25", "2023-08-26", "2023-08-27", "2023-08-28", "2023-08-29" ]
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
	 * Get Calendar datepick  Instance
	 * @param resource_id  of booking resource
	 * @returns {*|null}
	 */
	function wpbc_calendar__get_inst( resource_id ){

		if ( 'undefined' === typeof (resource_id) ){
			resource_id = '1';
		}

		if ( jQuery( '#calendar_booking' + resource_id ).length > 0 ){
			return jQuery.datepick._getInst( jQuery( '#calendar_booking' + resource_id ).get( 0 ) );
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

		var is_day_selectable = ( parseInt( date_bookings_obj[ 'day_availability' ] ) > 0 );

		if ( typeof (date_bookings_obj[ 'summary' ]) === 'undefined' ){
			return is_day_selectable;
		}

		if ( 'available' != date_bookings_obj[ 'summary']['status_for_day' ] ){

			var is_set_pending_days_selectable = _wpbc.calendar__get_param_value( resource_id, 'pending_days_selectable' );		// set pending days selectable          // FixIn: 8.6.1.18.

			switch ( date_bookings_obj[ 'summary']['status_for_bookings' ] ){
				case 'pending':
				// Situations for "change-over" days:
				case 'pending_pending':
				case 'pending_approved':
				case 'approved_pending':
					is_day_selectable = (is_day_selectable) ? true : is_set_pending_days_selectable;
					break;
				default:
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
			jQuery( '#calendar_booking' + resource_id ).after( '<div class="wpbc_spins_loader_wrapper"><div class="wpbc_spins_loader"></div></div>' );
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
	 * Update Look  of calendar
	 *
	 * @param resource_id
	 */
	function wpbc_calendar__update_look( resource_id ){

		var inst = wpbc_calendar__get_inst( resource_id );

		jQuery.datepick._updateDatepick( inst );
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
		 * Merge several  intersected intervals or return not intersected:                        [[1,3],[2,6],[8,10],[15,18]]  ->   [[1,6],[8,10],[15,18]]
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
		 * Good explanation  here https://stackoverflow.com/questions/3269434/whats-the-most-efficient-way-to-test-if-two-ranges-overlap
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
 * 	Example 1:				var num_selected_days = wpbc_auto_select_dates_in_calendar( 1, '2024-05-15', '2024-05-25' );
 * 	Example 2:				var num_selected_days = wpbc_auto_select_dates_in_calendar( 1, ['2024-05-09','2024-05-19','2024-05-20'] );
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

					// Trigger event that calendar has been		 // FixIn: 10.0.0.44.
					if ( jQuery( '#calendar_booking' + response_data[ 'resource_id' ] ).length > 0 ){
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
	 * Get resource ID from ajx post data url   usually  from  this.data  = 'action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params'
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
	 * Get parameter from URL  -  parse URL parameters,  like this: action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params
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
								'is_scroll': true								// is scroll  to  this element
						};
	for ( var p_key in params ){
		params_default[ p_key ] = params[ p_key ];
	}
	params = params_default;

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
	function wpbc_front_end__show_message__error( jq_node, message ){

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : 10000,
																	'if_visible_not_show': true,
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
	function wpbc_front_end__show_message__error_under_element( jq_node, message, message_delay ){

		if ( 'undefined' === typeof (message_delay) ){
			message_delay = 0
		}

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : message_delay,
																	'if_visible_not_show': true,
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
	function wpbc_front_end__show_message__error_above_element( jq_node, message, message_delay ){

		if ( 'undefined' === typeof (message_delay) ){
			message_delay = 10000
		}

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'error',
																	'delay'              : message_delay,
																	'if_visible_not_show': true,
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
	function wpbc_front_end__show_message__warning( jq_node, message ){

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																	'if_visible_not_show': true,
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
	function wpbc_front_end__show_message__warning_under_element( jq_node, message ){

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																	'if_visible_not_show': true,
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
	function wpbc_front_end__show_message__warning_above_element( jq_node, message ){

		var notice_message_id = wpbc_front_end__show_message(
																message,
																{
																	'type'               : 'warning',
																	'delay'              : 10000,
																	'if_visible_not_show': true,
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndwYmNfdXRpbHMuanMiLCJ3cGJjLmpzIiwiYWp4X2xvYWRfYmFsYW5jZXIuanMiLCJ3cGJjX2NhbC5qcyIsImRheXNfc2VsZWN0X2N1c3RvbS5qcyIsIndwYmNfY2FsX2FqeC5qcyIsIndwYmNfZmVfbWVzc2FnZXMuanMiLCJ0aW1lbGluZV9wb3BvdmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9oQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN4bkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDNVFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IndwYmNfYWxsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBKYXZhU2NyaXB0IFV0aWwgRnVuY3Rpb25zXHRcdC4uL2luY2x1ZGVzL19fanMvdXRpbHMvd3BiY191dGlscy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogVHJpbSAgc3RyaW5ncyBhbmQgYXJyYXkgam9pbmVkIHdpdGggICgsKVxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nX3RvX3RyaW0gICBzdHJpbmcgLyBhcnJheVxyXG4gKiBAcmV0dXJucyBzdHJpbmdcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdHJpbShzdHJpbmdfdG9fdHJpbSkge1xyXG5cclxuXHRpZiAoIEFycmF5LmlzQXJyYXkoIHN0cmluZ190b190cmltICkgKSB7XHJcblx0XHRzdHJpbmdfdG9fdHJpbSA9IHN0cmluZ190b190cmltLmpvaW4oICcsJyApO1xyXG5cdH1cclxuXHJcblx0aWYgKCAnc3RyaW5nJyA9PSB0eXBlb2YgKHN0cmluZ190b190cmltKSApIHtcclxuXHRcdHN0cmluZ190b190cmltID0gc3RyaW5nX3RvX3RyaW0udHJpbSgpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHN0cmluZ190b190cmltO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgZWxlbWVudCBpbiBhcnJheVxyXG4gKlxyXG4gKiBAcGFyYW0gYXJyYXlfaGVyZVx0XHRhcnJheVxyXG4gKiBAcGFyYW0gcF92YWxcdFx0XHRcdGVsZW1lbnQgdG8gIGNoZWNrXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19pbl9hcnJheShhcnJheV9oZXJlLCBwX3ZhbCkge1xyXG5cdGZvciAoIHZhciBpID0gMCwgbCA9IGFycmF5X2hlcmUubGVuZ3RoOyBpIDwgbDsgaSsrICkge1xyXG5cdFx0aWYgKCBhcnJheV9oZXJlW2ldID09IHBfdmFsICkge1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG4vKipcclxuICogUHJldmVudCBvcGVuaW5nIGJsYW5rIHdpbmRvd3Mgb24gV29yZFByZXNzIHBsYXlncm91bmQgZm9yIHBzZXVkbyBsaW5rcyBsaWtlIHRoaXM6IDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIj4gb3IgIyB0byBzdGF5IGluIHRoZSBzYW1lIHRhYi5cclxuICovXHJcbihmdW5jdGlvbiAoKSB7XHJcblx0J3VzZSBzdHJpY3QnO1xyXG5cclxuXHRmdW5jdGlvbiBpc19wbGF5Z3JvdW5kX29yaWdpbigpIHtcclxuXHRcdHJldHVybiBsb2NhdGlvbi5vcmlnaW4gPT09ICdodHRwczovL3BsYXlncm91bmQud29yZHByZXNzLm5ldCc7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpc19wc2V1ZG9fbGluayhhKSB7XHJcblx0XHRpZiAoICFhIHx8ICFhLmdldEF0dHJpYnV0ZSApIHJldHVybiB0cnVlO1xyXG5cdFx0dmFyIGhyZWYgPSAoYS5nZXRBdHRyaWJ1dGUoICdocmVmJyApIHx8ICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcclxuXHRcdHJldHVybiAoXHJcblx0XHRcdCFocmVmIHx8XHJcblx0XHRcdGhyZWYgPT09ICcjJyB8fFxyXG5cdFx0XHRocmVmLmluZGV4T2YoICcjJyApID09PSAwIHx8XHJcblx0XHRcdGhyZWYuaW5kZXhPZiggJ2phdmFzY3JpcHQ6JyApID09PSAwIHx8XHJcblx0XHRcdGhyZWYuaW5kZXhPZiggJ21haWx0bzonICkgPT09IDAgfHxcclxuXHRcdFx0aHJlZi5pbmRleE9mKCAndGVsOicgKSA9PT0gMFxyXG5cdFx0KTtcclxuXHR9XHJcblxyXG5cdGZ1bmN0aW9uIGZpeF90YXJnZXQoYSkge1xyXG5cdFx0aWYgKCAhIGEgKSByZXR1cm47XHJcblx0XHRpZiAoIGlzX3BzZXVkb19saW5rKCBhICkgfHwgYS5oYXNBdHRyaWJ1dGUoICdkYXRhLXdwLW5vLWJsYW5rJyApICkge1xyXG5cdFx0XHRhLnRhcmdldCA9ICdfc2VsZic7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBpbml0X2ZpeCgpIHtcclxuXHRcdC8vIE9wdGlvbmFsOiBjbGVhbiB1cCBjdXJyZW50IERPTSAoaGFybWxlc3PigJRhZmZlY3RzIG9ubHkgcHNldWRvL2RhdGFtYXJrZWQgbGlua3MpLlxyXG5cdFx0dmFyIG5vZGVzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCggJ2FbaHJlZl0nICk7XHJcblx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKyApIGZpeF90YXJnZXQoIG5vZGVzW2ldICk7XHJcblxyXG5cdFx0Ly8gTGF0ZSBidWJibGUtcGhhc2UgbGlzdGVuZXJzIChydW4gYWZ0ZXIgUGxheWdyb3VuZCdzIGhhbmRsZXJzKVxyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0dmFyIGEgPSBlLnRhcmdldCAmJiBlLnRhcmdldC5jbG9zZXN0ID8gZS50YXJnZXQuY2xvc2VzdCggJ2FbaHJlZl0nICkgOiBudWxsO1xyXG5cdFx0XHRpZiAoIGEgKSBmaXhfdGFyZ2V0KCBhICk7XHJcblx0XHR9LCBmYWxzZSApO1xyXG5cclxuXHRcdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoICdmb2N1c2luJywgZnVuY3Rpb24gKGUpIHtcclxuXHRcdFx0dmFyIGEgPSBlLnRhcmdldCAmJiBlLnRhcmdldC5jbG9zZXN0ID8gZS50YXJnZXQuY2xvc2VzdCggJ2FbaHJlZl0nICkgOiBudWxsO1xyXG5cdFx0XHRpZiAoIGEgKSBmaXhfdGFyZ2V0KCBhICk7XHJcblx0XHR9ICk7XHJcblx0fVxyXG5cclxuXHRmdW5jdGlvbiBzY2hlZHVsZV9pbml0KCkge1xyXG5cdFx0aWYgKCAhaXNfcGxheWdyb3VuZF9vcmlnaW4oKSApIHJldHVybjtcclxuXHRcdHNldFRpbWVvdXQoIGluaXRfZml4LCAxMDAwICk7IC8vIGVuc3VyZSB3ZSBhdHRhY2ggYWZ0ZXIgUGxheWdyb3VuZCdzIHNjcmlwdC5cclxuXHR9XHJcblxyXG5cdGlmICggZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gJ2xvYWRpbmcnICkge1xyXG5cdFx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lciggJ0RPTUNvbnRlbnRMb2FkZWQnLCBzY2hlZHVsZV9pbml0ICk7XHJcblx0fSBlbHNlIHtcclxuXHRcdHNjaGVkdWxlX2luaXQoKTtcclxuXHR9XHJcbn0pKCk7IiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvd3BiYy93cGJjLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBEZWVwIENsb25lIG9mIG9iamVjdCBvciBhcnJheVxyXG4gKlxyXG4gKiBAcGFyYW0gb2JqXHJcbiAqIEByZXR1cm5zIHthbnl9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Nsb25lX29iaiggb2JqICl7XHJcblxyXG5cdHJldHVybiBKU09OLnBhcnNlKCBKU09OLnN0cmluZ2lmeSggb2JqICkgKTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogTWFpbiBfd3BiYyBKUyBvYmplY3RcclxuICovXHJcblxyXG52YXIgX3dwYmMgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gU2VjdXJlIHBhcmFtZXRlcnMgZm9yIEFqYXhcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlY3VyZSA9IG9iai5zZWN1cml0eV9vYmogPSBvYmouc2VjdXJpdHlfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcl9pZDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm9uY2UgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsZSA6ICcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH07XHJcblx0b2JqLnNldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9zZWN1cmVbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBDYWxlbmRhcnMgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfY2FsZW5kYXJzID0gb2JqLmNhbGVuZGFyc19vYmogPSBvYmouY2FsZW5kYXJzX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgY2FsZW5kYXIgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBDcmVhdGUgQ2FsZW5kYXIgaW5pdGlhbGl6aW5nXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pbml0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgXSA9IGZhbHNlO1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayAgaWYgdGhlIHR5cGUgb2YgdGhpcyBwcm9wZXJ0eSAgaXMgSU5UXHJcblx0ICogQHBhcmFtIHByb3BlcnR5X25hbWVcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2lzX3Byb3BfaW50ID0gZnVuY3Rpb24gKCBwcm9wZXJ0eV9uYW1lICkge1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOS4wLjI5LlxyXG5cclxuXHRcdHZhciBwX2NhbGVuZGFyX2ludF9wcm9wZXJ0aWVzID0gWydkeW5hbWljX19kYXlzX21pbicsICdkeW5hbWljX19kYXlzX21heCcsICdmaXhlZF9fZGF5c19udW0nXTtcclxuXHJcblx0XHR2YXIgaXNfaW5jbHVkZSA9IHBfY2FsZW5kYXJfaW50X3Byb3BlcnRpZXMuaW5jbHVkZXMoIHByb3BlcnR5X25hbWUgKTtcclxuXHJcblx0XHRyZXR1cm4gaXNfaW5jbHVkZTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHBhcmFtcyBmb3IgYWxsICBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcnNfb2JqXHRcdE9iamVjdCB7IGNhbGVuZGFyXzE6IHt9IH1cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgY2FsZW5kYXJfMzoge30sIC4uLiB9XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyc19hbGxfX3NldCA9IGZ1bmN0aW9uICggY2FsZW5kYXJzX29iaiApIHtcclxuXHRcdHBfY2FsZW5kYXJzID0gY2FsZW5kYXJzX29iajtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYm9va2luZ3MgaW4gYWxsIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJzX2FsbF9fZ2V0ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfY2FsZW5kYXJzO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgaWQ6IDEsIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFx0eyBpZDogMiAs4oCmIH1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2dldF9wYXJhbWV0ZXJzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRpZiAoIG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0cmV0dXJuIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBpZiBjYWxlbmRhciBvYmplY3QgIG5vdCBkZWZpbmVkLCB0aGVuICBpdCdzIHdpbGwgYmUgZGVmaW5lZCBhbmQgSUQgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gIHN5c3RlbSBzZXQgIGFzIG5ldyBvciBvdmVyd3JpdGUgb25seSBwcm9wZXJ0aWVzIGZyb20gY2FsZW5kYXJfcHJvcGVydHlfb2JqIHBhcmFtZXRlciwgIGJ1dCBvdGhlciBwcm9wZXJ0aWVzIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZSwgbGlrZSAnaWQnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcl9wcm9wZXJ0eV9vYmpcdFx0XHRcdFx0ICB7ICBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9ICB9XHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19jb21wbGV0ZV9vdmVyd3JpdGVcdFx0ICBpZiAndHJ1ZScgKGRlZmF1bHQ6ICdmYWxzZScpLCAgdGhlbiAgb25seSBvdmVyd3JpdGUgb3IgYWRkICBuZXcgcHJvcGVydGllcyBpbiAgY2FsZW5kYXJfcHJvcGVydHlfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5jYWxlbmRhcl9fc2V0KCAgXCIgLmludHZhbCggJHJlc291cmNlX2lkICkgLiBcIiwgeyAnZGF0ZXMnOiBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgfSApO1wiO1xyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBjYWxlbmRhcl9wcm9wZXJ0eV9vYmosIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IGZhbHNlICApIHtcclxuXHJcblx0XHRpZiAoICghb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApKSB8fCAodHJ1ZSA9PT0gaXNfY29tcGxldGVfb3ZlcndyaXRlKSApe1xyXG5cdFx0XHRvYmouY2FsZW5kYXJfX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBjYWxlbmRhcl9wcm9wZXJ0eV9vYmogKXtcclxuXHJcblx0XHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gY2FsZW5kYXJfcHJvcGVydHlfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgcHJvcGVydHkgIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XCIxXCJcclxuXHQgKiBAcGFyYW0gcHJvcF9uYW1lXHRcdG5hbWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcGFyYW0gcHJvcF92YWx1ZVx0dmFsdWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcmV0dXJucyB7Kn1cdFx0XHRjYWxlbmRhciBvYmplY3RcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSwgcHJvcF92YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoICghb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApKSApe1xyXG5cdFx0XHRvYmouY2FsZW5kYXJfX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwcm9wX3ZhbHVlO1xyXG5cclxuXHRcdHJldHVybiBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgY2FsZW5kYXIgcHJvcGVydHkgdmFsdWUgICBcdDo6ICAgbWl4ZWQgfCBudWxsXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9ICByZXNvdXJjZV9pZFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcHJvcF9uYW1lXHRcdFx0J3NlbGVjdGlvbl9tb2RlJ1xyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHRcdFx0XHRcdG1peGVkIHwgbnVsbFxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBwcm9wX25hbWUgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHQvLyBGaXhJbjogOS45LjAuMjkuXHJcblx0XHRcdGlmICggb2JqLmNhbGVuZGFyX19pc19wcm9wX2ludCggcHJvcF9uYW1lICkgKXtcclxuXHRcdFx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IHBhcnNlSW50KCBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiAgcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG51bGw7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gbnVsbDtcclxuXHR9O1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHQvLyBCb29raW5ncyBcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9ib29raW5ncyA9IG9iai5ib29raW5nc19vYmogPSBvYmouYm9va2luZ3Nfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBjYWxlbmRhcl8xOiBPYmplY3Qge1xyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAgIGlkOiAgICAgMVxyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgYm9va2luZ3MgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSApICk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBpZDogMSAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0XHR7IGlkOiAyICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0ID0gZnVuY3Rpb24oIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBpZiBjYWxlbmRhciBvYmplY3QgIG5vdCBkZWZpbmVkLCB0aGVuICBpdCdzIHdpbGwgYmUgZGVmaW5lZCBhbmQgSUQgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gIHN5c3RlbSBzZXQgIGFzIG5ldyBvciBvdmVyd3JpdGUgb25seSBwcm9wZXJ0aWVzIGZyb20gY2FsZW5kYXJfb2JqIHBhcmFtZXRlciwgIGJ1dCBvdGhlciBwcm9wZXJ0aWVzIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZSwgbGlrZSAnaWQnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcl9vYmpcdFx0XHRcdFx0ICB7ICBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9ICB9XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0KCAgXCIgLmludHZhbCggJHJlc291cmNlX2lkICkgLiBcIiwgeyAnZGF0ZXMnOiBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgfSApO1wiO1xyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0ID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBjYWxlbmRhcl9vYmogKXtcclxuXHJcblx0XHRpZiAoICEgb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdpZCcgXSA9IHJlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gY2FsZW5kYXJfb2JqICl7XHJcblxyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gY2FsZW5kYXJfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cdC8vIERhdGVzXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3IgQUxMIERhdGVzIGluIGNhbGVuZGFyICAgOjogICBmYWxzZSB8IHsgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0JzEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0ZmFsc2UgfCBPYmplY3Qge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yNFwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJhdmFpbGFibGVcIiwgZGF5X2F2YWlsYWJpbGl0eTogMSwgbWF4X2NhcGFjaXR5OiAxLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yNlwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJmdWxsX2RheV9ib29raW5nXCIsIFsnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJ106IFwicGVuZGluZ1wiLCBkYXlfYXZhaWxhYmlsaXR5OiAwLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yOVwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJyZXNvdXJjZV9hdmFpbGFiaWxpdHlcIiwgZGF5X2F2YWlsYWJpbGl0eTogMCwgbWF4X2NhcGFjaXR5OiAxLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0zMFwiOiB74oCmfSwgXCIyMDIzLTA3LTMxXCI6IHvigKZ9LCDigKZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2RhdGVzID0gZnVuY3Rpb24oIHJlc291cmNlX2lkKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBmYWxzZTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgYm9va2luZ3MgZGF0ZXMgaW4gY2FsZW5kYXIgb2JqZWN0ICAgOjogICAgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kICdpZCcsICdkYXRlcycgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gc3lzdGVtIGFkZCBhICBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgZGF0ZXMgZnJvbSBkYXRlc19vYmogcGFyYW1ldGVyLFxyXG5cdCAqIGJ1dCBvdGhlciBkYXRlcyBub3QgZnJvbSBwYXJhbWV0ZXIgZGF0ZXNfb2JqIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGRhdGVzX29ialx0XHRcdFx0XHQgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2NvbXBsZXRlX292ZXJ3cml0ZVx0XHQgIGlmIGZhbHNlLCAgdGhlbiAgb25seSBvdmVyd3JpdGUgb3IgYWRkICBkYXRlcyBmcm9tIFx0ZGF0ZXNfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKiAgIFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoIHJlc291cmNlX2lkLCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCDigKYgfSAgKTtcdFx0PC0gICBvdmVyd3JpdGUgQUxMIGRhdGVzXHJcblx0ICogICBcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjJcIjoge+KApn0gfSwgIGZhbHNlICApO1x0XHRcdFx0XHQ8LSAgIGFkZCBvciBvdmVyd3JpdGUgb25seSAgXHRcIjIwMjMtMDctMjJcIjoge31cclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCAgXCIgLiBpbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsICBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgICk7ICBcIjtcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgZGF0ZXNfb2JqICwgaXNfY29tcGxldGVfb3ZlcndyaXRlID0gdHJ1ZSApe1xyXG5cclxuXHRcdGlmICggIW9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cdFx0XHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCggcmVzb3VyY2VfaWQsIHsgJ2RhdGVzJzoge30gfSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0pICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdID0ge31cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoaXNfY29tcGxldGVfb3ZlcndyaXRlKXtcclxuXHJcblx0XHRcdC8vIENvbXBsZXRlIG92ZXJ3cml0ZSBhbGwgIGJvb2tpbmcgZGF0ZXNcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gPSBkYXRlc19vYmo7XHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0Ly8gQWRkIG9ubHkgIG5ldyBvciBvdmVyd3JpdGUgZXhpc3QgYm9va2luZyBkYXRlcyBmcm9tICBwYXJhbWV0ZXIuIEJvb2tpbmcgZGF0ZXMgbm90IGZyb20gIHBhcmFtZXRlciAgd2lsbCAgYmUgd2l0aG91dCBjaG5hbmdlc1xyXG5cdFx0XHRmb3IgKCB2YXIgcHJvcF9uYW1lIGluIGRhdGVzX29iaiApe1xyXG5cclxuXHRcdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bJ2RhdGVzJ11bIHByb3BfbmFtZSBdID0gZGF0ZXNfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3Igc3BlY2lmaWMgZGF0ZSBpbiBjYWxlbmRhciAgIDo6ICAgZmFsc2UgfCB7IGRheV9hdmFpbGFiaWxpdHk6IDEsIC4uLiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXlcdFx0XHQnMjAyMy0wNy0yMSdcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRmYWxzZSB8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF5X2F2YWlsYWJpbGl0eTogNFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtYXhfY2FwYWNpdHk6IDRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAgPj0gQnVzaW5lc3MgTGFyZ2VcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MjogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMDogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVx0XHQvLyAgPj0gQnVzaW5lc3MgTGFyZ2UgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDExOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDEyOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdWyBzcWxfY2xhc3NfZGF5IF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdWyBzcWxfY2xhc3NfZGF5IF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIGZhbHNlO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBBbnkgIFBBUkFNUyAgIGluIGJvb2tpbmdzXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBwcm9wZXJ0eSAgdG8gIGJvb2tpbmdcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFwiMVwiXHJcblx0ICogQHBhcmFtIHByb3BfbmFtZVx0XHRuYW1lIG9mIHByb3BlcnR5XHJcblx0ICogQHBhcmFtIHByb3BfdmFsdWVcdHZhbHVlIG9mIHByb3BlcnR5XHJcblx0ICogQHJldHVybnMgeyp9XHRcdFx0Ym9va2luZyBvYmplY3RcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lLCBwcm9wX3ZhbHVlICkge1xyXG5cclxuXHRcdGlmICggISBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2lkJyBdID0gcmVzb3VyY2VfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IHByb3BfdmFsdWU7XHJcblxyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmcgcHJvcGVydHkgdmFsdWUgICBcdDo6ICAgbWl4ZWQgfCBudWxsXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9ICByZXNvdXJjZV9pZFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcHJvcF9uYW1lXHRcdFx0J3NlbGVjdGlvbl9tb2RlJ1xyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHRcdFx0XHRcdG1peGVkIHwgbnVsbFxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIG51bGw7XHJcblx0fTtcclxuXHJcblxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGZvciBhbGwgIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGNhbGVuZGFyc19vYmpcdFx0T2JqZWN0IHsgY2FsZW5kYXJfMTogeyBpZDogMSwgZGF0ZXM6IE9iamVjdCB7IFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCBcIjIwMjMtMDctMjRcIjoge+KApn0sIOKApiB9IH1cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgY2FsZW5kYXJfMzoge30sIC4uLiB9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyc19fc2V0X2FsbCA9IGZ1bmN0aW9uICggY2FsZW5kYXJzX29iaiApIHtcclxuXHRcdHBfYm9va2luZ3MgPSBjYWxlbmRhcnNfb2JqO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5ncyBpbiBhbGwgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcnNfX2dldF9hbGwgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9ib29raW5ncztcclxuXHR9O1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHJcblxyXG5cdC8vIFNlYXNvbnMgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfc2Vhc29ucyA9IG9iai5zZWFzb25zX29iaiA9IG9iai5zZWFzb25zX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY2FsZW5kYXJfMTogT2JqZWN0IHtcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgICBpZDogICAgIDFcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKAplxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQWRkIHNlYXNvbiBuYW1lcyBmb3IgZGF0ZXMgaW4gY2FsZW5kYXIgb2JqZWN0ICAgOjogICAgeyBcIjIwMjMtMDctMjFcIjogWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF0sIFwiMjAyMy0wNy0yMlwiOiBbLi4uXSwgLi4uIH1cclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gZGF0ZXNfb2JqXHRcdFx0XHRcdCAgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgZmFsc2UsICB0aGVuICBvbmx5ICBhZGQgIGRhdGVzIGZyb20gXHRkYXRlc19vYmpcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGVzOlxyXG5cdCAqICAgXHRcdFx0X3dwYmMuc2Vhc29uc19fc2V0KCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjFcIjogWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF0sIFwiMjAyMy0wNy0yMlwiOiBbLi4uXSwgLi4uIH0gICk7XHJcblx0ICovXHJcblx0b2JqLnNlYXNvbnNfX3NldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgZGF0ZXNfb2JqICwgaXNfY29tcGxldGVfb3ZlcndyaXRlID0gZmFsc2UgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdKSApe1xyXG5cdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfY29tcGxldGVfb3ZlcndyaXRlICl7XHJcblxyXG5cdFx0XHQvLyBDb21wbGV0ZSBvdmVyd3JpdGUgYWxsICBzZWFzb24gZGF0ZXNcclxuXHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSBkYXRlc19vYmo7XHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdC8vIEFkZCBvbmx5ICBuZXcgb3Igb3ZlcndyaXRlIGV4aXN0IGJvb2tpbmcgZGF0ZXMgZnJvbSAgcGFyYW1ldGVyLiBCb29raW5nIGRhdGVzIG5vdCBmcm9tICBwYXJhbWV0ZXIgIHdpbGwgIGJlIHdpdGhvdXQgY2huYW5nZXNcclxuXHRcdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBkYXRlc19vYmogKXtcclxuXHJcblx0XHRcdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0pICl7XHJcblx0XHRcdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBbXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Zm9yICggdmFyIHNlYXNvbl9uYW1lX2tleSBpbiBkYXRlc19vYmpbIHByb3BfbmFtZSBdICl7XHJcblx0XHRcdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0ucHVzaCggZGF0ZXNfb2JqWyBwcm9wX25hbWUgXVsgc2Vhc29uX25hbWVfa2V5IF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3Igc3BlY2lmaWMgZGF0ZSBpbiBjYWxlbmRhciAgIDo6ICAgW10gfCBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzcWxfY2xhc3NfZGF5XHRcdFx0JzIwMjMtMDctMjEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0W10gIHwgIFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdXHJcblx0ICovXHJcblx0b2JqLnNlYXNvbnNfX2dldF9mb3JfZGF0ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBzcWxfY2xhc3NfZGF5IF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBzcWxfY2xhc3NfZGF5IF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFtdO1x0XHQvLyBJZiBub3QgZGVmaW5lZCwgdGhlbiBbXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gT3RoZXIgcGFyYW1ldGVycyBcdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9vdGhlciA9IG9iai5vdGhlcl9vYmogPSBvYmoub3RoZXJfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlclsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFsbCBvdGhlciBwYXJhbXNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbV9fYWxsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXI7XHJcblx0fTtcclxuXHJcblx0Ly8gTWVzc2FnZXMgXHRcdFx0ICAgICAgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9tZXNzYWdlcyA9IG9iai5tZXNzYWdlc19vYmogPSBvYmoubWVzc2FnZXNfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9tZXNzYWdlID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfbWVzc2FnZXNbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfbWVzc2FnZSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfbWVzc2FnZXNbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgb3RoZXIgcGFyYW1zXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5nZXRfbWVzc2FnZXNfX2FsbCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX21lc3NhZ2VzO1xyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHJldHVybiBvYmo7XHJcblxyXG59KCBfd3BiYyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG4iLCIvKipcclxuICogRXh0ZW5kIF93cGJjIHdpdGggIG5ldyBtZXRob2RzICAgICAgICAvLyBGaXhJbjogOS44LjYuMi5cclxuICpcclxuICogQHR5cGUgeyp8e319XHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG4gX3dwYmMgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gTG9hZCBCYWxhbmNlciBcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHZhciBwX2JhbGFuY2VyID0gb2JqLmJhbGFuY2VyX29iaiA9IG9iai5iYWxhbmNlcl9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdtYXhfdGhyZWFkcyc6IDIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2luX3Byb2Nlc3MnIDogW10sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3dhaXQnICAgICAgIDogW11cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0IC8qKlxyXG5cdCAgKiBTZXQgIG1heCBwYXJhbGxlbCByZXF1ZXN0ICB0byAgbG9hZFxyXG5cdCAgKlxyXG5cdCAgKiBAcGFyYW0gbWF4X3RocmVhZHNcclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19zZXRfbWF4X3RocmVhZHMgPSBmdW5jdGlvbiAoIG1heF90aHJlYWRzICl7XHJcblxyXG5cdFx0cF9iYWxhbmNlclsgJ21heF90aHJlYWRzJyBdID0gbWF4X3RocmVhZHM7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGJhbGFuY2VyIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5iYWxhbmNlcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2JhbGFuY2VyWyAnYmFsYW5jZXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgQ3JlYXRlIGJhbGFuY2VyIGluaXRpYWxpemluZ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdG9iai5iYWxhbmNlcl9faW5pdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgLCBwYXJhbXMgPXt9KSB7XHJcblxyXG5cdFx0dmFyIGJhbGFuY2Vfb2JqID0ge307XHJcblx0XHRiYWxhbmNlX29ialsgJ3Jlc291cmNlX2lkJyBdICAgPSByZXNvdXJjZV9pZDtcclxuXHRcdGJhbGFuY2Vfb2JqWyAncHJpb3JpdHknIF0gICAgICA9IDE7XHJcblx0XHRiYWxhbmNlX29ialsgJ2Z1bmN0aW9uX25hbWUnIF0gPSBmdW5jdGlvbl9uYW1lO1xyXG5cdFx0YmFsYW5jZV9vYmpbICdwYXJhbXMnIF0gICAgICAgID0gd3BiY19jbG9uZV9vYmooIHBhcmFtcyApO1xyXG5cclxuXHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV9ydW4oIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICkgKXtcclxuXHRcdFx0cmV0dXJuICdydW4nO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfd2FpdCggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKSApe1xyXG5cdFx0XHRyZXR1cm4gJ3dhaXQnO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9fY2FuX2lfcnVuKCkgKXtcclxuXHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biggYmFsYW5jZV9vYmogKTtcclxuXHRcdFx0cmV0dXJuICdydW4nO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3dhaXQoIGJhbGFuY2Vfb2JqICk7XHJcblx0XHRcdHJldHVybiAnd2FpdCc7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0IC8qKlxyXG5cdCAgKiBDYW4gSSBSdW4gP1xyXG5cdCAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19jYW5faV9ydW4gPSBmdW5jdGlvbiAoKXtcclxuXHRcdHJldHVybiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCA8IHBfYmFsYW5jZXJbICdtYXhfdGhyZWFkcycgXSApO1xyXG5cdH1cclxuXHJcblx0XHQgLyoqXHJcblx0XHQgICogQWRkIHRvIFdBSVRcclxuXHRcdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX193YWl0ID0gZnVuY3Rpb24gKCBiYWxhbmNlX29iaiApIHtcclxuXHRcdFx0cF9iYWxhbmNlclsnd2FpdCddLnB1c2goIGJhbGFuY2Vfb2JqICk7XHJcblx0XHR9XHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIFJlbW92ZSBmcm9tIFdhaXRcclxuXHRcdCAgKlxyXG5cdFx0ICAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICAqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQgICogQHJldHVybnMgeyp8Ym9vbGVhbn1cclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdHZhciByZW1vdmVkX2VsID0gZmFsc2U7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ3dhaXQnIF0gKXtcclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0KHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHJlbW92ZWRfZWwgPSBwX2JhbGFuY2VyWyAnd2FpdCcgXS5zcGxpY2UoIGksIDEgKTtcclxuXHRcdFx0XHRcdFx0cmVtb3ZlZF9lbCA9IHJlbW92ZWRfZWwucG9wKCk7XHJcblx0XHRcdFx0XHRcdHBfYmFsYW5jZXJbICd3YWl0JyBdID0gcF9iYWxhbmNlclsgJ3dhaXQnIF0uZmlsdGVyKCBmdW5jdGlvbiAoIHYgKXtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdjtcclxuXHRcdFx0XHRcdFx0fSApO1x0XHRcdFx0XHQvLyBSZWluZGV4IGFycmF5XHJcblx0XHRcdFx0XHRcdHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCogSXMgYWxyZWFkeSBXQUlUXHJcblx0XHQqXHJcblx0XHQqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0KiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCovXHJcblx0XHRvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfd2FpdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdGlmICggcF9iYWxhbmNlclsgJ3dhaXQnIF0ubGVuZ3RoICl7XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ3dhaXQnIF0gKXtcclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0KHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdCAvKipcclxuXHRcdCAgKiBBZGQgdG8gUlVOXHJcblx0XHQgICogQHBhcmFtIGJhbGFuY2Vfb2JqXHJcblx0XHQgICovXHJcblx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fcnVuID0gZnVuY3Rpb24gKCBiYWxhbmNlX29iaiApIHtcclxuXHRcdFx0cF9iYWxhbmNlclsnaW5fcHJvY2VzcyddLnB1c2goIGJhbGFuY2Vfb2JqICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQqIFJlbW92ZSBmcm9tIFJVTiBsaXN0XHJcblx0XHQqXHJcblx0XHQqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0KiBAcmV0dXJucyB7Knxib29sZWFufVxyXG5cdFx0Ki9cclxuXHRcdG9iai5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3J1bl9saXN0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0IHZhciByZW1vdmVkX2VsID0gZmFsc2U7XHJcblxyXG5cdFx0XHQgaWYgKCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5sZW5ndGggKXtcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHQgZm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gKXtcclxuXHRcdFx0XHRcdCBpZiAoXHJcblx0XHRcdFx0XHRcdCAocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0ICYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCApe1xyXG5cdFx0XHRcdFx0XHQgcmVtb3ZlZF9lbCA9IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLnNwbGljZSggaSwgMSApO1xyXG5cdFx0XHRcdFx0XHQgcmVtb3ZlZF9lbCA9IHJlbW92ZWRfZWwucG9wKCk7XHJcblx0XHRcdFx0XHRcdCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXSA9IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmZpbHRlciggZnVuY3Rpb24gKCB2ICl7XHJcblx0XHRcdFx0XHRcdFx0IHJldHVybiB2O1xyXG5cdFx0XHRcdFx0XHQgfSApO1x0XHQvLyBSZWluZGV4IGFycmF5XHJcblx0XHRcdFx0XHRcdCByZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdFx0XHRcdCB9XHJcblx0XHRcdFx0IH1cclxuXHRcdFx0IH1cclxuXHRcdFx0IHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0KiBJcyBhbHJlYWR5IFJVTlxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3J1biA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdGlmICggcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0ubGVuZ3RoICl7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXSApe1xyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0JiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblxyXG5cclxuXHRvYmouYmFsYW5jZXJfX3J1bl9uZXh0ID0gZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0Ly8gR2V0IDFzdCBmcm9tICBXYWl0IGxpc3RcclxuXHRcdHZhciByZW1vdmVkX2VsID0gZmFsc2U7XHJcblx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICd3YWl0JyBdICl7XHJcblx0XHRcdFx0cmVtb3ZlZF9lbCA9IG9iai5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCggcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdLCBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBmYWxzZSAhPT0gcmVtb3ZlZF9lbCApe1xyXG5cclxuXHRcdFx0Ly8gUnVuXHJcblx0XHRcdG9iai5iYWxhbmNlcl9fcnVuKCByZW1vdmVkX2VsICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQgLyoqXHJcblx0ICAqIFJ1blxyXG5cdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19ydW4gPSBmdW5jdGlvbiAoIGJhbGFuY2Vfb2JqICl7XHJcblxyXG5cdFx0c3dpdGNoICggYmFsYW5jZV9vYmpbICdmdW5jdGlvbl9uYW1lJyBdICl7XHJcblxyXG5cdFx0XHRjYXNlICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCc6XHJcblxyXG5cdFx0XHRcdC8vIEFkZCB0byBydW4gbGlzdFxyXG5cdFx0XHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX19ydW4oIGJhbGFuY2Vfb2JqICk7XHJcblxyXG5cdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4KCBiYWxhbmNlX29ialsgJ3BhcmFtcycgXSApXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIG9iajtcclxuXHJcbn0oIF93cGJjIHx8IHt9LCBqUXVlcnkgKSk7XHJcblxyXG5cclxuIFx0LyoqXHJcbiBcdCAqIC0tIEhlbHAgZnVuY3Rpb25zIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKi9cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iYWxhbmNlcl9faXNfd2FpdCggcGFyYW1zLCBmdW5jdGlvbl9uYW1lICl7XHJcbi8vY29uc29sZS5sb2coJzo6d3BiY19iYWxhbmNlcl9faXNfd2FpdCcscGFyYW1zICwgZnVuY3Rpb25fbmFtZSApO1xyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSkgKXtcclxuXHJcblx0XHRcdHZhciBiYWxhbmNlcl9zdGF0dXMgPSBfd3BiYy5iYWxhbmNlcl9faW5pdCggcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0sIGZ1bmN0aW9uX25hbWUsIHBhcmFtcyApO1xyXG5cclxuXHRcdFx0cmV0dXJuICggJ3dhaXQnID09PSBiYWxhbmNlcl9zdGF0dXMgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iYWxhbmNlcl9fY29tcGxldGVkKCByZXNvdXJjZV9pZCAsIGZ1bmN0aW9uX25hbWUgKXtcclxuLy9jb25zb2xlLmxvZygnOjp3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQnLHJlc291cmNlX2lkICwgZnVuY3Rpb25fbmFtZSApO1xyXG5cdFx0X3dwYmMuYmFsYW5jZXJfX3JlbW92ZV9mcm9tX19ydW5fbGlzdCggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKTtcclxuXHRcdF93cGJjLmJhbGFuY2VyX19ydW5fbmV4dCgpO1xyXG5cdH0iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2NhbC93cGJjX2NhbC5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogT3JkZXIgb3IgY2hpbGQgYm9va2luZyByZXNvdXJjZXMgc2F2ZWQgaGVyZTogIFx0X3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyApXHRcdFsyLDEwLDEyLDExXVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBIb3cgdG8gY2hlY2sgIGJvb2tlZCB0aW1lcyBvbiAgc3BlY2lmaWMgZGF0ZTogP1xyXG4gKlxyXG5cdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKTtcclxuXHJcblx0XHRcdGNvbnNvbGUubG9nKFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcyxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTBdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMV0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHMsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1xyXG5cdFx0XHRcdFx0KTtcclxuICogIE9SXHJcblx0XHRcdGNvbnNvbGUubG9nKFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGUsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEwXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGUsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzExXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGUsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGVcclxuXHRcdFx0XHRcdCk7XHJcbiAqXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIERheXMgc2VsZWN0aW9uOlxyXG4gKiBcdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApO1xyXG4gKlxyXG4gKlx0XHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSAxO1xyXG4gKiBcdEV4YW1wbGUgMTpcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqIFx0RXhhbXBsZSAyOlx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjUnXSApO1xyXG4gKlxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogQyBBIEwgRSBOIEQgQSBSICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqICBTaG93IFdQQkMgQ2FsZW5kYXJcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdFx0LSByZXNvdXJjZSBJRFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfc2hvdyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gSWYgbm8gY2FsZW5kYXIgSFRNTCB0YWcsICB0aGVuICBleGl0XHJcblx0aWYgKCAwID09PSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmxlbmd0aCApeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcblx0Ly8gSWYgdGhlIGNhbGVuZGFyIHdpdGggdGhlIHNhbWUgQm9va2luZyByZXNvdXJjZSBpcyBhY3RpdmF0ZWQgYWxyZWFkeSwgdGhlbiBleGl0LlxyXG5cdGlmICggdHJ1ZSA9PT0galF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5oYXNDbGFzcyggJ2hhc0RhdGVwaWNrJyApICl7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERheXMgc2VsZWN0aW9uXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCA9IGZhbHNlO1xyXG5cdHZhciBsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtICAgPSAzNjU7XHRcdFx0XHRcdC8vIG11bHRpcGxlIHwgZml4ZWRcclxuXHRpZiAoICdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0ID0gdHJ1ZTtcclxuXHRcdGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gPSAwO1xyXG5cdH1cclxuXHRpZiAoICdzaW5nbGUnICA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtID0gMDtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTWluIC0gTWF4IGRheXMgdG8gc2Nyb2xsL3Nob3dcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBsb2NhbF9fbWluX2RhdGUgPSAwO1xyXG4gXHRsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAwIF0sIChwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDIgXSwgMCwgMCwgMCApO1x0XHRcdC8vIEZpeEluOiA5LjkuMC4xNy5cclxuLy9jb25zb2xlLmxvZyggbG9jYWxfX21pbl9kYXRlICk7XHJcblx0dmFyIGxvY2FsX19tYXhfZGF0ZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhcicgKTtcclxuXHQvL2xvY2FsX19tYXhfZGF0ZSA9IG5ldyBEYXRlKDIwMjQsIDUsIDI4KTsgIEl0IGlzIGhlcmUgaXNzdWUgb2Ygbm90IHNlbGVjdGFibGUgZGF0ZXMsIGJ1dCBzb21lIGRhdGVzIHNob3dpbmcgaW4gY2FsZW5kYXIgYXMgYXZhaWxhYmxlLCBidXQgd2UgY2FuIG5vdCBzZWxlY3QgaXQuXHJcblxyXG5cdC8vLy8gRGVmaW5lIGxhc3QgZGF5IGluIGNhbGVuZGFyIChhcyBhIGxhc3QgZGF5IG9mIG1vbnRoIChhbmQgbm90IGRhdGUsIHdoaWNoIGlzIHJlbGF0ZWQgdG8gYWN0dWFsICdUb2RheScgZGF0ZSkuXHJcblx0Ly8vLyBFLmcuIGlmIHRvZGF5IGlzIDIwMjMtMDktMjUsIGFuZCB3ZSBzZXQgJ051bWJlciBvZiBtb250aHMgdG8gc2Nyb2xsJyBhcyA1IG1vbnRocywgdGhlbiBsYXN0IGRheSB3aWxsIGJlIDIwMjQtMDItMjkgYW5kIG5vdCB0aGUgMjAyNC0wMi0yNS5cclxuXHQvLyB2YXIgY2FsX2xhc3RfZGF5X2luX21vbnRoID0galF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBudWxsLCBsb2NhbF9fbWF4X2RhdGUsIG5ldyBEYXRlKCkgKTtcclxuXHQvLyBjYWxfbGFzdF9kYXlfaW5fbW9udGggPSBuZXcgRGF0ZSggY2FsX2xhc3RfZGF5X2luX21vbnRoLmdldEZ1bGxZZWFyKCksIGNhbF9sYXN0X2RheV9pbl9tb250aC5nZXRNb250aCgpICsgMSwgMCApO1xyXG5cdC8vIGxvY2FsX19tYXhfZGF0ZSA9IGNhbF9sYXN0X2RheV9pbl9tb250aDtcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjI2LlxyXG5cclxuXHQvLyBHZXQgc3RhcnQgLyBlbmQgZGF0ZXMgZnJvbSAgdGhlIEJvb2tpbmcgQ2FsZW5kYXIgc2hvcnRjb2RlLiBFeGFtcGxlOiBbYm9va2luZyBjYWxlbmRhcl9kYXRlc19zdGFydD0nMjAyNi0wMS0wMScgY2FsZW5kYXJfZGF0ZXNfZW5kPScyMDI2LTEyLTMxJyAgcmVzb3VyY2VfaWQ9MV0gLy8gRml4SW46IDEwLjEzLjEuNC5cclxuXHRpZiAoIGZhbHNlICE9PSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHJlc291cmNlX2lkICkgKSB7XHJcblx0XHRsb2NhbF9fbWluX2RhdGUgPSB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfc3RhcnQoIHJlc291cmNlX2lkICk7ICAvLyBFLmcuIC0gbG9jYWxfX21pbl9kYXRlID0gbmV3IERhdGUoIDIwMjUsIDAsIDEgKTtcclxuXHR9XHJcblx0aWYgKCBmYWxzZSAhPT0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcmVzb3VyY2VfaWQgKSApIHtcclxuXHRcdGxvY2FsX19tYXhfZGF0ZSA9IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19lbmQoIHJlc291cmNlX2lkICk7ICAgIC8vIEUuZy4gLSBsb2NhbF9fbWF4X2RhdGUgPSBuZXcgRGF0ZSggMjAyNSwgMTEsIDMxICk7XHJcblx0fVxyXG5cclxuXHQvLyBJbiBjYXNlIHdlIGVkaXQgYm9va2luZyBpbiBwYXN0IG9yIGhhdmUgc3BlY2lmaWMgcGFyYW1ldGVyIGluIFVSTC5cclxuXHRpZiAoICAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoJ3BhZ2U9d3BiYy1uZXcnKSAhPSAtMSApXHJcblx0XHQmJiAoXHJcblx0XHRcdCAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoJ2Jvb2tpbmdfaGFzaCcpICE9IC0xICkgICAgICAgICAgICAgICAgICAvLyBDb21tZW50IHRoaXMgbGluZSBmb3IgYWJpbGl0eSB0byBhZGQgIGJvb2tpbmcgaW4gcGFzdCBkYXlzIGF0ICBCb29raW5nID4gQWRkIGJvb2tpbmcgcGFnZS5cclxuXHRcdCAgIHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCdhbGxvd19wYXN0JykgIT0gLTEgKSAgICAgICAgICAgICAgICAvLyBGaXhJbjogMTAuNy4xLjIuXHJcblx0XHQpXHJcblx0KXtcclxuXHRcdC8vIGxvY2FsX19taW5fZGF0ZSA9IG51bGw7XHJcblx0XHQvLyBGaXhJbjogMTAuMTQuMS40LlxyXG5cdFx0bG9jYWxfX21pbl9kYXRlICA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVswXSwgKCBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbMV0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsyXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbM10sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzRdLCAwICk7XHJcblx0XHRsb2NhbF9fbWF4X2RhdGUgPSBudWxsO1xyXG5cdH1cclxuXHJcblx0dmFyIGxvY2FsX19zdGFydF93ZWVrZGF5ICAgID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3N0YXJ0X2RheV93ZWVlaycgKTtcclxuXHR2YXIgbG9jYWxfX251bWJlcl9vZl9tb250aHMgPSBwYXJzZUludCggX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJyApICk7XHJcblxyXG5cdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkudGV4dCggJycgKTtcdFx0XHRcdFx0Ly8gUmVtb3ZlIGFsbCBIVE1MIGluIGNhbGVuZGFyIHRhZ1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2hvdyBjYWxlbmRhclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0alF1ZXJ5KCcjY2FsZW5kYXJfYm9va2luZycrIHJlc291cmNlX2lkKS5kYXRlcGljayhcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGJlZm9yZVNob3dEYXk6IGZ1bmN0aW9uICgganNfZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBqc19kYXRlLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uU2VsZWN0OiBmdW5jdGlvbiAoIHN0cmluZ19kYXRlcywganNfZGF0ZXNfYXJyICl7ICAvKipcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqXHRzdHJpbmdfZGF0ZXMgICA9ICAgJzIzLjA4LjIwMjMgLSAyNi4wOC4yMDIzJyAgICB8ICAgICcyMy4wOC4yMDIzIC0gMjMuMDguMjAyMycgICAgfCAgICAnMTkuMDkuMjAyMywgMjQuMDguMjAyMywgMzAuMDkuMjAyMydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqICBqc19kYXRlc19hcnIgICA9ICAgcmFuZ2U6IFsgRGF0ZSAoQXVnIDIzIDIwMjMpLCBEYXRlIChBdWcgMjUgMjAyMyldICAgICB8ICAgICBtdWx0aXBsZTogWyBEYXRlKE9jdCAyNCAyMDIzKSwgRGF0ZShPY3QgMjAgMjAyMyksIERhdGUoT2N0IDE2IDIwMjMpIF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqL1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX29uX3NlbGVjdF9kYXlzKCBzdHJpbmdfZGF0ZXMsIHsncmVzb3VyY2VfaWQnOiByZXNvdXJjZV9pZH0sIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHQgIH0sXHJcblx0XHRcdFx0b25Ib3ZlcjogZnVuY3Rpb24gKCBzdHJpbmdfZGF0ZSwganNfZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMoIHN0cmluZ19kYXRlLCBqc19kYXRlLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uQ2hhbmdlTW9udGhZZWFyOiBmdW5jdGlvbiAoIHllYXIsIHJlYWxfbW9udGgsIGpzX2RhdGVfXzFzdF9kYXlfaW5fbW9udGggKXsgfSxcclxuXHRcdFx0XHRzaG93T24gICAgICAgIDogJ2JvdGgnLFxyXG5cdFx0XHRcdG51bWJlck9mTW9udGhzOiBsb2NhbF9fbnVtYmVyX29mX21vbnRocyxcclxuXHRcdFx0XHRzdGVwTW9udGhzICAgIDogMSxcclxuXHRcdFx0XHQvLyBwcmV2VGV4dCAgICAgIDogJyZsYXF1bzsnLFxyXG5cdFx0XHRcdC8vIG5leHRUZXh0ICAgICAgOiAnJnJhcXVvOycsXHJcblx0XHRcdFx0cHJldlRleHQgICAgICA6ICcmbHNhcXVvOycsXHJcblx0XHRcdFx0bmV4dFRleHQgICAgICA6ICcmcnNhcXVvOycsXHJcblx0XHRcdFx0ZGF0ZUZvcm1hdCAgICA6ICdkZC5tbS55eScsXHJcblx0XHRcdFx0Y2hhbmdlTW9udGggICA6IGZhbHNlLFxyXG5cdFx0XHRcdGNoYW5nZVllYXIgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtaW5EYXRlICAgICAgIDogbG9jYWxfX21pbl9kYXRlLFxyXG5cdFx0XHRcdG1heERhdGUgICAgICAgOiBsb2NhbF9fbWF4X2RhdGUsIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMVknLFxyXG5cdFx0XHRcdC8vIG1pbkRhdGU6IG5ldyBEYXRlKDIwMjAsIDIsIDEpLCBtYXhEYXRlOiBuZXcgRGF0ZSgyMDIwLCA5LCAzMSksICAgICAgICAgICAgIFx0Ly8gQWJpbGl0eSB0byBzZXQgYW55ICBzdGFydCBhbmQgZW5kIGRhdGUgaW4gY2FsZW5kYXJcclxuXHRcdFx0XHRzaG93U3RhdHVzICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtdWx0aVNlcGFyYXRvciAgOiAnLCAnLFxyXG5cdFx0XHRcdGNsb3NlQXRUb3AgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdGZpcnN0RGF5ICAgICAgICA6IGxvY2FsX19zdGFydF93ZWVrZGF5LFxyXG5cdFx0XHRcdGdvdG9DdXJyZW50ICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdGhpZGVJZk5vUHJldk5leHQ6IHRydWUsXHJcblx0XHRcdFx0bXVsdGlTZWxlY3QgICAgIDogbG9jYWxfX211bHRpX2RheXNfc2VsZWN0X251bSxcclxuXHRcdFx0XHRyYW5nZVNlbGVjdCAgICAgOiBsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0LFxyXG5cdFx0XHRcdC8vIHNob3dXZWVrczogdHJ1ZSxcclxuXHRcdFx0XHR1c2VUaGVtZVJvbGxlcjogZmFsc2VcclxuXHRcdFx0fVxyXG5cdCk7XHJcblxyXG5cclxuXHRcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIENsZWFyIHRvZGF5IGRhdGUgaGlnaGxpZ2h0aW5nXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXsgIHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTsgIH0sIDUwMCApOyAgICAgICAgICAgICAgICAgICAgXHQvLyBGaXhJbjogNy4xLjIuOC5cclxuXHRcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNjcm9sbCBjYWxlbmRhciB0byAgc3BlY2lmaWMgbW9udGhcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBzdGFydF9ia19tb250aCA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfc2Nyb2xsX3RvJyApO1xyXG5cdGlmICggZmFsc2UgIT09IHN0YXJ0X2JrX21vbnRoICl7XHJcblx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBzdGFydF9ia19tb250aFsgMCBdLCBzdGFydF9ia19tb250aFsgMSBdICk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBDU1MgdG8gY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMgeygqfHN0cmluZylbXXwoYm9vbGVhbnxzdHJpbmcpW119XHRcdC0gWyB7dHJ1ZSAtYXZhaWxhYmxlIHwgZmFsc2UgLSB1bmF2YWlsYWJsZX0sICdDU1MgY2xhc3NlcyBmb3IgY2FsZW5kYXIgZGF5IGNlbGwnIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgdG9kYXlfZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDAgXSwgKHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDEgXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHRcdFx0XHRcdFx0XHRcdC8vIFRvZGF5IEpTX0RhdGVfT2JqLlxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7IFx0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBHZXQgU2VsZWN0ZWQgZGF0ZXMgaW4gY2FsZW5kYXJcclxuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19zcWwgPSB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gR2V0IERhdGEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBkYXRlX2Jvb2tpbmdzX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHRcdC8vIEFycmF5IHdpdGggQ1NTIGNsYXNzZXMgZm9yIGRhdGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlID0gW107XHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NxbF9kYXRlXycgICAgICsgc3FsX2NsYXNzX2RheSApO1x0XHRcdFx0Ly8gICdzcWxfZGF0ZV8yMDIzLTA3LTIxJ1xyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjYWw0ZGF0ZS0nICAgICArIGNsYXNzX2RheSApO1x0XHRcdFx0XHQvLyAgJ2NhbDRkYXRlLTctMjEtMjAyMydcclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnd3BiY193ZWVrZGF5XycgKyBkYXRlLmdldERheSgpICk7XHRcdFx0XHQvLyAgJ3dwYmNfd2Vla2RheV80J1xyXG5cclxuXHRcdC8vIERlZmluZSBTZWxlY3RlZCBDaGVjayBJbi9PdXQgZGF0ZXMgaW4gVEQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoXHJcblx0XHRcdFx0KCBzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoICApXHJcblx0XHRcdC8vJiYgICggc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gIT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdIClcclxuXHRcdCl7XHJcblx0XHRcdGlmICggc3FsX2NsYXNzX2RheSA9PT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gKXtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX2luJyApO1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfaW5fb3V0JyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggICggc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCA+IDEgKSAmJiAoIHNxbF9jbGFzc19kYXkgPT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdICkgKSB7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19vdXQnICk7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19pbl9vdXQnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0dmFyIGlzX2RheV9zZWxlY3RhYmxlID0gZmFsc2U7XHJcblxyXG5cdFx0Ly8gSWYgc29tZXRoaW5nIG5vdCBkZWZpbmVkLCAgdGhlbiAgdGhpcyBkYXRlIGNsb3NlZCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gLy8gRml4SW46IDEwLjEyLjQuNi5cclxuXHRcdGlmICggKGZhbHNlID09PSBkYXRlX2Jvb2tpbmdzX29iaikgfHwgKCd1bmRlZmluZWQnID09PSB0eXBlb2YgKGRhdGVfYm9va2luZ3Nfb2JqW3Jlc291cmNlX2lkXSkpICkge1xyXG5cclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gWyBpc19kYXlfc2VsZWN0YWJsZSwgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlLmpvaW4oJyAnKSAgXTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICAgZGF0ZV9ib29raW5nc19vYmogIC0gRGVmaW5lZC4gICAgICAgICAgICBEYXRlcyBjYW4gYmUgc2VsZWN0YWJsZS5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEFkZCBzZWFzb24gbmFtZXMgdG8gdGhlIGRheSBDU1MgY2xhc3NlcyAtLSBpdCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCAgd29yayAgb2YgY29uZGl0aW9uYWwgZmllbGRzIC0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgc2Vhc29uX25hbWVzX2FyciA9IF93cGJjLnNlYXNvbnNfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgc2Vhc29uX2tleSBpbiBzZWFzb25fbmFtZXNfYXJyICl7XHJcblxyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggc2Vhc29uX25hbWVzX2Fyclsgc2Vhc29uX2tleSBdICk7XHRcdFx0XHQvLyAgJ3dwZGV2Ymtfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJ1xyXG5cdFx0fVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdFx0Ly8gQ29zdCBSYXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAncmF0ZV8nICsgZGF0ZV9ib29raW5nc19vYmpbIHJlc291cmNlX2lkIF1bICdkYXRlX2Nvc3RfcmF0ZScgXS50b1N0cmluZygpLnJlcGxhY2UoIC9bXFwuXFxzXS9nLCAnXycgKSApO1x0XHRcdFx0XHRcdC8vICAncmF0ZV85OV8wMCcgLT4gOTkuMDBcclxuXHJcblxyXG5cdFx0aWYgKCBwYXJzZUludCggZGF0ZV9ib29raW5nc19vYmpbICdkYXlfYXZhaWxhYmlsaXR5JyBdICkgPiAwICl7XHJcblx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gdHJ1ZTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX2F2YWlsYWJsZScgKTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdyZXNlcnZlZF9kYXlzX2NvdW50JyArIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ21heF9jYXBhY2l0eScgXSAtIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IGZhbHNlO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0c3dpdGNoICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHRjYXNlICdhdmFpbGFibGUnOlxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAndGltZV9zbG90c19ib29raW5nJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ3RpbWVzX2Nsb2NrJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnZnVsbF9kYXlfYm9va2luZyc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdmdWxsX2RheV9ib29raW5nJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnc2Vhc29uX2ZpbHRlcic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnc2Vhc29uX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdyZXNvdXJjZV9hdmFpbGFiaWxpdHknOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ3Jlc291cmNlX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICd3ZWVrZGF5X3VuYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICd3ZWVrZGF5X3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdsaW1pdF9hdmFpbGFibGVfZnJvbV90b2RheSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2NoYW5nZV9vdmVyJzpcclxuXHRcdFx0XHQvKlxyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0Ly8gIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZSBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlXHJcblx0XHRcdFx0Ly8gIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZSBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdC8vICBjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZSBcdFx0IFx0Y2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkIFx0IFx0Y2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkXHJcblx0XHRcdFx0ICovXHJcblxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAndGltZXNwYXJ0bHknLCAnY2hlY2tfaW5fdGltZScsICdjaGVja19vdXRfdGltZScgKTtcclxuXHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjIuXHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdhcHByb3ZlZF9wZW5kaW5nJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcsICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdwZW5kaW5nX2FwcHJvdmVkJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJywgJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGVja19pbic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd0aW1lc3BhcnRseScsICdjaGVja19pbl90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdwZW5kaW5nJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5ncycgXS5pbmRleE9mKCAnYXBwcm92ZWQnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnY2hlY2tfb3V0JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX291dF90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdwZW5kaW5nJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ2FwcHJvdmVkJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdC8vIG1peGVkIHN0YXR1c2VzOiAnY2hhbmdlX292ZXIgY2hlY2tfb3V0JyAuLi4uIHZhcmlhdGlvbnMuLi4uIGNoZWNrIG1vcmUgaW4gXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2F2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIoKVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSA9ICdhdmFpbGFibGUnO1xyXG5cdFx0fVxyXG5cclxuXHJcblxyXG5cdFx0aWYgKCAnYXZhaWxhYmxlJyAhPSBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdHZhciBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGUgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlJyApO1x0Ly8gc2V0IHBlbmRpbmcgZGF5cyBzZWxlY3RhYmxlICAgICAgICAgIC8vIEZpeEluOiA4LjYuMS4xOC5cclxuXHJcblx0XHRcdHN3aXRjaCAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdICl7XHJcblxyXG5cdFx0XHRcdGNhc2UgJyc6XHJcblx0XHRcdFx0XHQvLyBVc3VhbGx5ICBpdCdzIG1lYW5zIHRoYXQgZGF5ICBpcyBhdmFpbGFibGUgb3IgdW5hdmFpbGFibGUgd2l0aG91dCB0aGUgYm9va2luZ3NcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nJzpcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZCc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Ly8gU2l0dWF0aW9ucyBmb3IgXCJjaGFuZ2Utb3ZlclwiIGRheXM6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nX3BlbmRpbmcnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IChpc19kYXlfc2VsZWN0YWJsZSkgPyB0cnVlIDogaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmdfYXBwcm92ZWQnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZF9wZW5kaW5nJzpcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcsICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAnYXBwcm92ZWRfYXBwcm92ZWQnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBbIGlzX2RheV9zZWxlY3RhYmxlLCBjc3NfY2xhc3Nlc19fZm9yX2RhdGUuam9pbiggJyAnICkgXTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBNb3VzZW92ZXIgY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHN0cmluZ19kYXRlXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMoIHN0cmluZ19kYXRlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICkge1xyXG5cclxuXHRcdGlmICggbnVsbCA9PT0gZGF0ZSApIHtcclxuXHRcdFx0d3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMScgKTtcdFx0Ly8gRml4SW46IDEwLjUuMi40LlxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7XHRcdC8vICcxJ1xyXG5cclxuXHRcdC8vIEdldCBEYXRhIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgZGF0ZV9ib29raW5nX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHsuLi59XHJcblxyXG5cdFx0aWYgKCAhIGRhdGVfYm9va2luZ19vYmogKXsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cclxuXHRcdC8vIFQgbyBvIGwgdCBpIHAgcyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgdG9vbHRpcF90ZXh0ID0gJyc7XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYXZhaWxhYmlsaXR5JyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2F2YWlsYWJpbGl0eScgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9ib29raW5nX2RldGFpbHMnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYm9va2luZ19kZXRhaWxzJyBdO1xyXG5cdFx0fVxyXG5cdFx0d3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHJcblx0XHQvLyAgVSBuIGggbyB2IGUgciBpIG4gZyAgICBpbiAgICBVTlNFTEVDVEFCTEVfQ0FMRU5EQVIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciA9ICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmdfdW5zZWxlY3RhYmxlJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCk7XHRcdFx0XHQvLyBGaXhJbjogOC4wLjEuMi5cclxuXHRcdHZhciBpc19ib29raW5nX2Zvcm1fZXhpc3QgICAgPSAoIGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApO1xyXG5cclxuXHRcdGlmICggKCBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgKSAmJiAoICEgaXNfYm9va2luZ19mb3JtX2V4aXN0ICkgKXtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiAgVW4gSG92ZXIgYWxsIGRhdGVzIGluIGNhbGVuZGFyICh3aXRob3V0IHRoZSBib29raW5nIGZvcm0pLCBpZiBvbmx5IEF2YWlsYWJpbGl0eSBDYWxlbmRhciBoZXJlIGFuZCB3ZSBkbyBub3QgaW5zZXJ0IEJvb2tpbmcgZm9ybSBieSBtaXN0YWtlLlxyXG5cdFx0XHQgKi9cclxuXHJcblx0XHRcdHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTsgXHRcdFx0XHRcdFx0XHQvLyBDbGVhciBkYXlzIGhpZ2hsaWdodGluZ1xyXG5cclxuXHRcdFx0dmFyIGNzc19vZl9jYWxlbmRhciA9ICcud3BiY19vbmx5X2NhbGVuZGFyICNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkO1xyXG5cdFx0XHRqUXVlcnkoIGNzc19vZl9jYWxlbmRhciArICcgLmRhdGVwaWNrLWRheXMtY2VsbCwgJ1xyXG5cdFx0XHRcdCAgKyBjc3Nfb2ZfY2FsZW5kYXIgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwgYScgKS5jc3MoICdjdXJzb3InLCAnZGVmYXVsdCcgKTtcdC8vIFNldCBjdXJzb3IgdG8gRGVmYXVsdFxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0XHQvLyAgRCBhIHkgcyAgICBIIG8gdiBlIHIgaSBuIGcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYycgKSA9PSAtMSApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLW5ldycgKSA+IDAgKVxyXG5cdFx0XHR8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1zZXR1cCcgKSA+IDAgKVxyXG5cdFx0XHR8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1hdmFpbGFiaWxpdHknICkgPiAwIClcclxuXHRcdFx0fHwgKCAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtc2V0dGluZ3MnICkgPiAwICkgICYmXHJcblx0XHRcdFx0ICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJyZ0YWI9Zm9ybScgKSA+IDAgKVxyXG5cdFx0XHQgICApXHJcblx0XHQpe1xyXG5cdFx0XHQvLyBUaGUgc2FtZSBhcyBkYXRlcyBzZWxlY3Rpb24sICBidXQgZm9yIGRheXMgaG92ZXJpbmdcclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PSB0eXBlb2YoIHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX2hpZ2hsaWdodF9fYnMgKSApe1xyXG5cdFx0XHRcdHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX2hpZ2hsaWdodF9fYnMoIHNxbF9jbGFzc19kYXksIGRhdGUsIHJlc291cmNlX2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2VsZWN0IGNhbGVuZGFyIGRhdGUgY2VsbHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdFx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMCBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHRcdFx0XHRcdFx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXHRcdFx0XHRcdFx0XCJyZXNvdXJjZV9pZFwiOiA0XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHRcdFx0XHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX29uX3NlbGVjdF9kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0dmFyIHJlc291cmNlX2lkID0gKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSkgKSA/IGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSA6ICcxJztcdFx0Ly8gJzEnXHJcblxyXG5cdFx0Ly8gU2V0IHVuc2VsZWN0YWJsZSwgIGlmIG9ubHkgQXZhaWxhYmlsaXR5IENhbGVuZGFyICBoZXJlIChhbmQgd2UgZG8gbm90IGluc2VydCBCb29raW5nIGZvcm0gYnkgbWlzdGFrZSkuXHJcblx0XHR2YXIgaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyID0gKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZ191bnNlbGVjdGFibGUnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwKTtcdFx0XHRcdC8vIEZpeEluOiA4LjAuMS4yLlxyXG5cdFx0dmFyIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCAgICA9ICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICk7XHJcblx0XHRpZiAoICggaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyICkgJiYgKCAhIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCApICl7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFVuc2VsZWN0IERhdGVzXHJcblx0XHRcdGpRdWVyeSgnLndwYmNfb25seV9jYWxlbmRhciAucG9wb3Zlcl9jYWxlbmRhcl9ob3ZlcicpLnJlbW92ZSgpOyAgICAgICAgICAgICAgICAgICAgICBcdFx0XHRcdFx0XHRcdC8vIEhpZGUgYWxsIG9wZW5lZCBwb3BvdmVyc1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQWRkIHNlbGVjdGVkIGRhdGVzIHRvICBoaWRkZW4gdGV4dGFyZWFcclxuXHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMpICl7IHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMoIGRhdGUsIHJlc291cmNlX2lkICk7IH1cclxuXHJcblx0XHR3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIEhvb2sgLS0gdHJpZ2dlciBkYXkgc2VsZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgbW91c2VfY2xpY2tlZF9kYXRlcyA9IGRhdGU7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFwiMDUuMTAuMjAyMyAtIDA3LjEwLjIwMjNcIiAgfCAgXCIxMC4xMC4yMDIzIC0gMTAuMTAuMjAyM1wiICB8XHJcblx0XHR2YXIgYWxsX3NlbGVjdGVkX2RhdGVzX2FyciA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFsgXCIyMDIzLTEwLTA1XCIsIFwiMjAyMy0xMC0wNlwiLCBcIjIwMjMtMTAtMDdcIiwg4oCmIF1cclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkudHJpZ2dlciggXCJkYXRlX3NlbGVjdGVkXCIsIFsgcmVzb3VyY2VfaWQsIG1vdXNlX2NsaWNrZWRfZGF0ZXMsIGFsbF9zZWxlY3RlZF9kYXRlc19hcnIgXSApO1xyXG5cdH1cclxuXHJcblx0Ly8gTWFyayBtaWRkbGUgc2VsZWN0ZWQgZGF0ZXMgd2l0aCAwLjUgb3BhY2l0eVx0XHQvLyBGaXhJbjogMTAuMy4wLjkuXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkub24oICdkYXRlX3NlbGVjdGVkJywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIGRhdGUgKXtcclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHQgICAoICAnZml4ZWQnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpXHJcblx0XHRcdFx0XHR8fCAoJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0dmFyIG1pZGRsZV9kYXlzX29wYWNpdHkgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdjYWxlbmRhcnNfX2RheXNfc2VsZWN0aW9uX19taWRkbGVfZGF5c19vcGFjaXR5JyApO1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgLmRhdGVwaWNrLWN1cnJlbnQtZGF5JyApLm5vdCggXCIuc2VsZWN0ZWRfY2hlY2tfaW5fb3V0XCIgKS5jc3MoICdvcGFjaXR5JywgbWlkZGxlX2RheXNfb3BhY2l0eSApO1xyXG5cdFx0XHRcdFx0fSwgMTAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fSApO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogLS0gIFQgaSBtIGUgICAgRiBpIGUgbCBkIHMgICAgIHN0YXJ0ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEaXNhYmxlIHRpbWUgc2xvdHMgaW4gYm9va2luZyBmb3JtIGRlcGVuZCBvbiBzZWxlY3RlZCBkYXRlcyBhbmQgYm9va2VkIGRhdGVzL3RpbWVzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogXHQxLiBHZXQgYWxsIHRpbWUgZmllbGRzIGluIHRoZSBib29raW5nIGZvcm0gYXMgYXJyYXkgIG9mIG9iamVjdHNcclxuXHRcdCAqIFx0XHRcdFx0XHRbXHJcblx0XHQgKiBcdFx0XHRcdFx0IFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0XHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdFx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCBdXHJcblx0XHQgKi9cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmpfYXJyID0gd3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyAyLiBHZXQgYWxsIHNlbGVjdGVkIGRhdGVzIGluICBTUUwgZm9ybWF0ICBsaWtlIHRoaXMgWyBcIjIwMjMtMDgtMjNcIiwgXCIyMDIzLTA4LTI0XCIsIFwiMjAyMy0wOC0yNVwiLCAuLi4gXVxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX2FyciA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyAzLiBHZXQgY2hpbGQgYm9va2luZyByZXNvdXJjZXMgIG9yIHNpbmdsZSBib29raW5nIHJlc291cmNlICB0aGF0ICBleGlzdCAgaW4gZGF0ZXNcclxuXHRcdHZhciBjaGlsZF9yZXNvdXJjZXNfYXJyID0gd3BiY19jbG9uZV9vYmooIF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgKSApO1xyXG5cclxuXHRcdHZhciBzcWxfZGF0ZTtcclxuXHRcdHZhciBjaGlsZF9yZXNvdXJjZV9pZDtcclxuXHRcdHZhciBtZXJnZWRfc2Vjb25kcztcclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmo7XHJcblx0XHR2YXIgaXNfaW50ZXJzZWN0O1xyXG5cdFx0dmFyIGlzX2NoZWNrX2luO1xyXG5cclxuXHRcdHZhciB0b2RheV90aW1lX19yZWFsICA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVswXSwgKCBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbMV0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsyXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbM10sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzRdLCAwICk7XHJcblx0XHR2YXIgdG9kYXlfdGltZV9fc2hpZnQgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbMF0sICggcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggICAgICAndG9kYXlfYXJyJyApWzFdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbMl0sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgICAgICApWzNdLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVs0XSwgMCApO1xyXG5cclxuXHRcdC8vIDQuIExvb3AgIGFsbCAgdGltZSBGaWVsZHMgb3B0aW9uc1x0XHQvLyBGaXhJbjogMTAuMy4wLjIuXHJcblx0XHRmb3IgKCBsZXQgZmllbGRfa2V5ID0gMDsgZmllbGRfa2V5IDwgdGltZV9maWVsZHNfb2JqX2Fyci5sZW5ndGg7IGZpZWxkX2tleSsrICl7XHJcblxyXG5cdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXS5kaXNhYmxlZCA9IDA7ICAgICAgICAgIC8vIEJ5IGRlZmF1bHQsIHRoaXMgdGltZSBmaWVsZCBpcyBub3QgZGlzYWJsZWQuXHJcblxyXG5cdFx0XHR0aW1lX2ZpZWxkc19vYmogPSB0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXTtcdFx0Ly8geyB0aW1lc19hc19zZWNvbmRzOiBbIDIxNjAwLCAyMzQwMCBdLCB2YWx1ZV9vcHRpb25fMjRoOiAnMDY6MDAgLSAwNjozMCcsIG5hbWU6ICdyYW5nZXRpbWUyW10nLCBqcXVlcnlfb3B0aW9uOiBqUXVlcnlfT2JqZWN0IHt9fVxyXG5cclxuXHRcdFx0Ly8gTG9vcCAgYWxsICBzZWxlY3RlZCBkYXRlcy5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICkge1xyXG5cclxuXHRcdFx0XHQvLyBHZXQgRGF0ZTogJzIwMjMtMDgtMTgnLlxyXG5cdFx0XHRcdHNxbF9kYXRlID0gc2VsZWN0ZWRfZGF0ZXNfYXJyW2ldO1xyXG5cclxuXHRcdFx0XHR2YXIgaXNfdGltZV9pbl9wYXN0ID0gd3BiY19jaGVja19pc190aW1lX2luX3Bhc3QoIHRvZGF5X3RpbWVfX3NoaWZ0LCBzcWxfZGF0ZSwgdGltZV9maWVsZHNfb2JqICk7XHJcblx0XHRcdFx0Ly8gRXhjZXB0aW9uICBmb3IgJ0VuZCBUaW1lJyBmaWVsZCwgIHdoZW4gIHNlbGVjdGVkIHNldmVyYWwgZGF0ZXMuIC8vIEZpeEluOiAxMC4xNC4xLjUuXHJcblx0XHRcdFx0aWYgKCAoJ09uJyAhPT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3JlY3VycmVudF90aW1lJyApKSAmJlxyXG5cdFx0XHRcdFx0KC0xICE9PSB0aW1lX2ZpZWxkc19vYmoubmFtZS5pbmRleE9mKCAnZW5kdGltZScgKSkgJiZcclxuXHRcdFx0XHRcdChzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoID4gMSlcclxuXHRcdFx0XHQpIHtcclxuXHRcdFx0XHRcdGlzX3RpbWVfaW5fcGFzdCA9IHdwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0KCB0b2RheV90aW1lX19zaGlmdCwgc2VsZWN0ZWRfZGF0ZXNfYXJyWyhzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoIC0gMSldLCB0aW1lX2ZpZWxkc19vYmogKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBpc190aW1lX2luX3Bhc3QgKSB7XHJcblx0XHRcdFx0XHQvLyBUaGlzIHRpbWUgZm9yIHNlbGVjdGVkIGRhdGUgYWxyZWFkeSAgaW4gdGhlIHBhc3QuXHJcblx0XHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyW2ZpZWxkX2tleV0uZGlzYWJsZWQgPSAxO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGV4aXN0ICBmcm9tICAgRGF0ZXMgTE9PUC5cclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Ly8gRml4SW46IDkuOS4wLjMxLlxyXG5cdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCAgICggJ09mZicgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19yZWN1cnJlbnRfdGltZScgKSApXHJcblx0XHRcdFx0XHQmJiAoIHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGg+MSApXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdC8vVE9ETzogc2tpcCBzb21lIGZpZWxkcyBjaGVja2luZyBpZiBpdCdzIHN0YXJ0IC8gZW5kIHRpbWUgZm9yIG11bHBsZSBkYXRlcyAgc2VsZWN0aW9uICBtb2RlLlxyXG5cdFx0XHRcdFx0Ly9UT0RPOiB3ZSBuZWVkIHRvIGZpeCBzaXR1YXRpb24gIGZvciBlbnRpbWVzLCAgd2hlbiAgdXNlciAgc2VsZWN0ICBzZXZlcmFsICBkYXRlcywgIGFuZCBpbiBzdGFydCAgdGltZSBib29rZWQgMDA6MDAgLSAxNTowMCAsIGJ1dCBzeXN0c21lIGJsb2NrIHVudGlsbCAxNTowMCB0aGUgZW5kIHRpbWUgYXMgd2VsbCwgIHdoaWNoICBpcyB3cm9uZywgIGJlY2F1c2UgaXQgMiBvciAzIGRhdGVzIHNlbGVjdGlvbiAgYW5kIGVuZCBkYXRlIGNhbiBiZSBmdWxsdSAgYXZhaWxhYmxlXHJcblxyXG5cdFx0XHRcdFx0aWYgKCAoMCA9PSBpKSAmJiAodGltZV9maWVsZHNfb2JqWyAnbmFtZScgXS5pbmRleE9mKCAnZW5kdGltZScgKSA+PSAwKSApe1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggKCAoc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aC0xKSA9PSBpICkgJiYgKHRpbWVfZmllbGRzX29ialsgJ25hbWUnIF0uaW5kZXhPZiggJ3N0YXJ0dGltZScgKSA+PSAwKSApe1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cclxuXHJcblx0XHRcdFx0dmFyIGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCA9IDA7XHJcblx0XHRcdFx0Ly8gTG9vcCBhbGwgcmVzb3VyY2VzIElEXHJcblx0XHRcdFx0XHQvLyBmb3IgKCB2YXIgcmVzX2tleSBpbiBjaGlsZF9yZXNvdXJjZXNfYXJyICl7XHQgXHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjMuMC4yLlxyXG5cdFx0XHRcdGZvciAoIGxldCByZXNfa2V5ID0gMDsgcmVzX2tleSA8IGNoaWxkX3Jlc291cmNlc19hcnIubGVuZ3RoOyByZXNfa2V5KysgKXtcclxuXHJcblx0XHRcdFx0XHRjaGlsZF9yZXNvdXJjZV9pZCA9IGNoaWxkX3Jlc291cmNlc19hcnJbIHJlc19rZXkgXTtcclxuXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHNcdFx0PSBbIFwiMDc6MDA6MTEgLSAwNzozMDowMlwiLCBcIjEwOjAwOjExIC0gMDA6MDA6MDBcIiBdXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1x0XHRcdD0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cclxuXHRcdFx0XHRcdGlmICggZmFsc2UgIT09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSApICl7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9kYXRlIClbIGNoaWxkX3Jlc291cmNlX2lkIF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHM7XHRcdC8vIFsgIFsgMjUyMTEsIDI3MDAyIF0sIFsgMzYwMTEsIDg2NDAwIF0gIF1cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gW107XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzLmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX3JhbmdlX3RpbWVfaW50ZXJ2YWwoICBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1swXSApICsgMjAgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1sxXSApIC0gMjAgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIG1lcmdlZF9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpc19jaGVja19pbiA9ICgtMSAhPT0gdGltZV9maWVsZHNfb2JqLm5hbWUuaW5kZXhPZiggJ3N0YXJ0JyApKTtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX29uZV90aW1lX2ludGVydmFsKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KCAoIGlzX2NoZWNrX2luIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSArIDIwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIDogcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgLSAyMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBtZXJnZWRfc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGlzX2ludGVyc2VjdCl7XHJcblx0XHRcdFx0XHRcdGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCsrO1x0XHRcdC8vIEluY3JlYXNlXHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBjaGlsZF9yZXNvdXJjZXNfYXJyLmxlbmd0aCA9PSBob3dfbWFueV9yZXNvdXJjZXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdFx0XHQvLyBBbGwgcmVzb3VyY2VzIGludGVyc2VjdGVkLCAgdGhlbiAgaXQncyBtZWFucyB0aGF0IHRoaXMgdGltZS1zbG90IG9yIHRpbWUgbXVzdCAgYmUgIERpc2FibGVkLCBhbmQgd2UgY2FuICBleGlzdCAgZnJvbSAgIHNlbGVjdGVkX2RhdGVzX2FyciBMT09QXHJcblxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2FyclsgZmllbGRfa2V5IF0uZGlzYWJsZWQgPSAxO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGV4aXN0ICBmcm9tICAgRGF0ZXMgTE9PUFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyA1LiBOb3cgd2UgY2FuIGRpc2FibGUgdGltZSBzbG90IGluIEhUTUwgYnkgIHVzaW5nICAoIGZpZWxkLmRpc2FibGVkID09IDEgKSBwcm9wZXJ0eVxyXG5cdFx0d3BiY19faHRtbF9fdGltZV9maWVsZF9vcHRpb25zX19zZXRfZGlzYWJsZWQoIHRpbWVfZmllbGRzX29ial9hcnIgKTtcclxuXHJcblx0XHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLnRyaWdnZXIoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkJywgW3Jlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlc19hcnJdICk7XHRcdFx0XHRcdC8vIFRyaWdnZXIgaG9vayBvbiBkaXNhYmxpbmcgdGltZXNsb3RzLlx0XHRVc2FnZTogXHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLm9uKCAnd3BiY19ob29rX3RpbWVzbG90c19kaXNhYmxlZCcsIGZ1bmN0aW9uICggZXZlbnQsIGJrX3R5cGUsIGFsbF9kYXRlcyApeyAuLi4gfSApO1x0XHQvLyBGaXhJbjogOC43LjExLjkuXHJcblx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIGlmIHNwZWNpZmljIHRpbWUoLXNsb3QpIGFscmVhZHkgIGluIHRoZSBwYXN0IGZvciBzZWxlY3RlZCBkYXRlXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIGpzX2N1cnJlbnRfdGltZV90b19jaGVja1x0XHQtIEpTIERhdGVcclxuXHRcdCAqIEBwYXJhbSBzcWxfZGF0ZVx0XHRcdFx0XHRcdC0gJzIwMjUtMDEtMjYnXHJcblx0XHQgKiBAcGFyYW0gdGltZV9maWVsZHNfb2JqXHRcdFx0XHQtIE9iamVjdFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0KCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2ssIHNxbF9kYXRlLCB0aW1lX2ZpZWxkc19vYmogKSB7XHJcblxyXG5cdFx0XHQvLyBGaXhJbjogMTAuOS42LjRcclxuXHRcdFx0dmFyIHNxbF9kYXRlX2FyciA9IHNxbF9kYXRlLnNwbGl0KCAnLScgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlX19taWRuaWdodCA9IG5ldyBEYXRlKCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzBdICksICggcGFyc2VJbnQoIHNxbF9kYXRlX2FyclsxXSApIC0gMSApLCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzJdICksIDAsIDAsIDAgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyA9IHNxbF9kYXRlX19taWRuaWdodC5nZXRUaW1lKCk7XHJcblxyXG5cdFx0XHR2YXIgaXNfaW50ZXJzZWN0ID0gZmFsc2U7XHJcblxyXG5cdFx0XHRpZiAoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzLmxlbmd0aCA+IDEgKSB7XHJcblxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IChzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyAocGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzBdICkgKyAyMCkgKiAxMDAwKSApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IChzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyAocGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzFdICkgLSAyMCkgKiAxMDAwKSApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2YXIgaXNfY2hlY2tfaW4gPSAoLTEgIT09IHRpbWVfZmllbGRzX29iai5uYW1lLmluZGV4T2YoICdzdGFydCcgKSk7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzX2NoZWNrID0gKGlzX2NoZWNrX2luKSA/IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApICsgMjAgOiBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSAtIDIwO1xyXG5cclxuXHRcdFx0XHR0aW1lc19hc19zZWNvbmRzX2NoZWNrID0gc3FsX2RhdGVfX21pZG5pZ2h0X21pbGlzZWNvbmRzICsgdGltZXNfYXNfc2Vjb25kc19jaGVjayAqIDEwMDA7XHJcblxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgKSB7XHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGlzX2ludGVyc2VjdDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIG51bWJlciBpbnNpZGUgL2ludGVyc2VjdCAgb2YgYXJyYXkgb2YgaW50ZXJ2YWxzID9cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gdGltZV9BXHRcdCAgICAgXHQtIDI1ODAwXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19vbmVfdGltZV9pbnRlcnZhbCggdGltZV9BLCB0aW1lX2ludGVydmFsX0IgKXtcclxuXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfaW50ZXJ2YWxfQi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRpZiAoIChwYXJzZUludCggdGltZV9BICkgPiBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDAgXSApKSAmJiAocGFyc2VJbnQoIHRpbWVfQSApIDwgcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAxIF0gKSkgKXtcclxuXHRcdFx0XHRcdHJldHVybiB0cnVlXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBpZiAoICggcGFyc2VJbnQoIHRpbWVfQSApID09IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMCBdICkgKSB8fCAoIHBhcnNlSW50KCB0aW1lX0EgKSA9PSBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDEgXSApICkgKSB7XHJcblx0XHRcdFx0Ly8gXHRcdFx0Ly8gVGltZSBBIGp1c3QgIGF0ICB0aGUgYm9yZGVyIG9mIGludGVydmFsXHJcblx0XHRcdFx0Ly8gfVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0ICAgIHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIHRoZXNlIGFycmF5IG9mIGludGVydmFscyBpbnRlcnNlY3RlZCA/XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHRpbWVfaW50ZXJ2YWxfQVx0XHQtIFsgWyAyMTYwMCwgMjM0MDAgXSBdXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19yYW5nZV90aW1lX2ludGVydmFsKCB0aW1lX2ludGVydmFsX0EsIHRpbWVfaW50ZXJ2YWxfQiApe1xyXG5cclxuXHRcdFx0dmFyIGlzX2ludGVyc2VjdDtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHRpbWVfaW50ZXJ2YWxfQS5sZW5ndGg7IGkrKyApe1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX2ludGVydmFsX0IubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2ludGVydmFsc19faXNfaW50ZXJzZWN0ZWQoIHRpbWVfaW50ZXJ2YWxfQVsgaSBdLCB0aW1lX2ludGVydmFsX0JbIGogXSApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggaXNfaW50ZXJzZWN0ICl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKiBAcmV0dXJucyBbXVxyXG5cdFx0ICpcclxuXHRcdCAqIFx0XHRFeGFtcGxlOlxyXG5cdFx0ICogXHRcdFx0XHRcdFtcclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHQgKiBcdFx0XHRcdFx0XHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKXtcclxuXHRcdCAgICAvKipcclxuXHRcdFx0ICogRmllbGRzIHdpdGggIFtdICBsaWtlIHRoaXMgICBzZWxlY3RbbmFtZT1cInJhbmdldGltZTFbXVwiXVxyXG5cdFx0XHQgKiBpdCdzIHdoZW4gd2UgaGF2ZSAnbXVsdGlwbGUnIGluIHNob3J0Y29kZTogICBbc2VsZWN0KiByYW5nZXRpbWUgbXVsdGlwbGUgIFwiMDY6MDAgLSAwNjozMFwiIC4uLiBdXHJcblx0XHRcdCAqL1xyXG5cdFx0XHR2YXIgdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nXHJcblx0XHRcdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSBbXTtcclxuXHJcblx0XHRcdC8vIExvb3AgYWxsIFRpbWUgRmllbGRzXHJcblx0XHRcdGZvciAoIHZhciBjdGY9IDA7IGN0ZiA8IHRpbWVfZmllbGRzX2Fyci5sZW5ndGg7IGN0ZisrICl7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lX2ZpZWxkID0gdGltZV9maWVsZHNfYXJyWyBjdGYgXTtcclxuXHRcdFx0XHR2YXIgdGltZV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfZmllbGQgKyAnIG9wdGlvbicgKTtcclxuXHJcblx0XHRcdFx0Ly8gTG9vcCBhbGwgb3B0aW9ucyBpbiB0aW1lIGZpZWxkXHJcblx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9vcHRpb24ubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbiA9IGpRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uOmVxKCcgKyBqICsgJyknICk7XHJcblx0XHRcdFx0XHR2YXIgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyID0ganF1ZXJ5X29wdGlvbi52YWwoKS5zcGxpdCggJy0nICk7XHJcblx0XHRcdFx0XHR2YXIgdGltZXNfYXNfc2Vjb25kcyA9IFtdO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdldCB0aW1lIGFzIHNlY29uZHNcclxuXHRcdFx0XHRcdGlmICggdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aCApe1x0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aDsgaSsrICl7XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0XHRcdFx0Ly8gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyW2ldID0gJzE0OjAwICcgIHwgJyAxNjowMCcgICAoaWYgZnJvbSAncmFuZ2V0aW1lJykgYW5kICcxNjowMCcgIGlmIChzdGFydC9lbmQgdGltZSlcclxuXHJcblx0XHRcdFx0XHRcdFx0dmFyIHN0YXJ0X2VuZF90aW1lc19hcnIgPSB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbIGkgXS50cmltKCkuc3BsaXQoICc6JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHR2YXIgdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzLnB1c2goIHRpbWVfaW5fc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2Fyci5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgICAgICAgICAgIDogalF1ZXJ5KCB0aW1lX2ZpZWxkICkuYXR0ciggJ25hbWUnICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzoganF1ZXJ5X29wdGlvbi52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiBqcXVlcnlfb3B0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGltZXNfYXNfc2Vjb25kcyc6IHRpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0aW1lX2ZpZWxkc19vYmpfYXJyO1xyXG5cdFx0fVxyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIERpc2FibGUgSFRNTCBvcHRpb25zIGFuZCBhZGQgYm9va2VkIENTUyBjbGFzc1xyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcGFyYW0gdGltZV9maWVsZHNfb2JqX2FyciAgICAgIC0gdGhpcyB2YWx1ZSBpcyBmcm9tICB0aGUgZnVuYzogIFx0d3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0W1xyXG5cdFx0XHQgKiBcdFx0XHRcdFx0IFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0XHRcdCAqIFx0ICBcdFx0XHRcdFx0XHQgICAgZGlzYWJsZWQgPSAxXHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHRcdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdFx0XHQgKiAgIFx0XHRcdFx0XHRcdFx0ZGlzYWJsZWQgPSAwXHJcblx0XHRcdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHRcdFx0ICogXHRcdFx0XHRcdCBdXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiB3cGJjX19odG1sX190aW1lX2ZpZWxkX29wdGlvbnNfX3NldF9kaXNhYmxlZCggdGltZV9maWVsZHNfb2JqX2FyciApe1xyXG5cclxuXHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbjtcclxuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgdGltZV9maWVsZHNfb2JqX2Fyci5sZW5ndGg7IGkrKyApe1xyXG5cclxuXHRcdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uID0gdGltZV9maWVsZHNfb2JqX2FyclsgaSBdLmpxdWVyeV9vcHRpb247XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAxID09IHRpbWVfZmllbGRzX29ial9hcnJbIGkgXS5kaXNhYmxlZCApe1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKTsgXHRcdC8vIE1ha2UgZGlzYWJsZSBzb21lIG9wdGlvbnNcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5hZGRDbGFzcyggJ2Jvb2tlZCcgKTsgICAgICAgICAgIFx0Ly8gQWRkIFwiYm9va2VkXCIgQ1NTIGNsYXNzXHJcblxyXG5cdFx0XHRcdFx0XHQvLyBpZiB0aGlzIGJvb2tlZCBlbGVtZW50IHNlbGVjdGVkIC0tPiB0aGVuIGRlc2VsZWN0ICBpdFxyXG5cdFx0XHRcdFx0XHRpZiAoIGpxdWVyeV9vcHRpb24ucHJvcCggJ3NlbGVjdGVkJyApICl7XHJcblx0XHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5wcm9wKCAnc2VsZWN0ZWQnLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnBhcmVudCgpLmZpbmQoICdvcHRpb246bm90KFtkaXNhYmxlZF0pOmZpcnN0JyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCBcImNoYW5nZVwiICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIGZhbHNlICk7ICBcdFx0Ly8gTWFrZSBhY3RpdmUgYWxsIHRpbWVzXHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucmVtb3ZlQ2xhc3MoICdib29rZWQnICk7ICAgXHRcdC8vIFJlbW92ZSBjbGFzcyBcImJvb2tlZFwiXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayBpZiB0aGlzIHRpbWVfcmFuZ2UgfCBUaW1lX1Nsb3QgaXMgRnVsbCBEYXkgIGJvb2tlZFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzXHRcdC0gWyAzNjAxMSwgODY0MDAgXVxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc190aW1lc2xvdF9fZnVsbF9kYXlfYm9va2VkKCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kcyApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0XHQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzLmxlbmd0aCA+IDEgKVxyXG5cdFx0XHQmJiAoIHBhcnNlSW50KCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kc1sgMCBdICkgPCAzMCApXHJcblx0XHRcdCYmICggcGFyc2VJbnQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzWyAxIF0gKSA+ICAoICgyNCAqIDYwICogNjApIC0gMzApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qICA9PSAgUyBlIGwgZSBjIHQgZSBkICAgIEQgYSB0IGUgcyAgLyAgVCBpIG0gZSAtIEYgaSBlIGwgZCBzICA9PVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYWxsIHNlbGVjdGVkIGRhdGVzIGluIFNRTCBmb3JtYXQgbGlrZSB0aGlzIFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiICwgLi4uIF1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtbXX1cdFx0XHRbIFwiMjAyMy0wOC0yM1wiLCBcIjIwMjMtMDgtMjRcIiwgXCIyMDIzLTA4LTI1XCIsIFwiMjAyMy0wOC0yNlwiLCBcIjIwMjMtMDgtMjdcIiwgXCIyMDIzLTA4LTI4XCIsIFwiMjAyMy0wOC0yOVwiIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX2FyciA9IFtdO1xyXG5cdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyID0galF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCgpLnNwbGl0KCcsJyk7XHJcblxyXG5cdFx0aWYgKCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjU2LlxyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0udHJpbSgpO1xyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0uc3BsaXQoICcuJyApO1xyXG5cdFx0XHRcdGlmICggc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0ubGVuZ3RoID4gMSApe1xyXG5cdFx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0gPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXVsgMiBdICsgJy0nICsgc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF1bIDEgXSArICctJyArIHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdWyAwIF07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIGVtcHR5IGVsZW1lbnRzIGZyb20gYW4gYXJyYXlcclxuXHRcdHNlbGVjdGVkX2RhdGVzX2FyciA9IHNlbGVjdGVkX2RhdGVzX2Fyci5maWx0ZXIoIGZ1bmN0aW9uICggbiApeyByZXR1cm4gcGFyc2VJbnQobik7IH0gKTtcclxuXHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIuc29ydCgpO1xyXG5cclxuXHRcdHJldHVybiBzZWxlY3RlZF9kYXRlc19hcnI7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKiBAcGFyYW0gaXNfb25seV9zZWxlY3RlZF90aW1lXHJcblx0ICogQHJldHVybnMgW11cclxuXHQgKlxyXG5cdCAqIFx0XHRFeGFtcGxlOlxyXG5cdCAqIFx0XHRcdFx0XHRbXHJcblx0ICogXHRcdFx0XHRcdCBcdCAgIHtcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwLCAyMzQwMCBdXHJcblx0ICogXHRcdFx0XHRcdCBcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHQgKiBcdFx0XHRcdFx0XHQgICB7XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdCAqIFx0XHRcdFx0XHRcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHQgKiBcdFx0XHRcdFx0IF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9fc2VsZWN0ZWRfdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCwgaXNfb25seV9zZWxlY3RlZF90aW1lID0gdHJ1ZSApe1xyXG5cdFx0LyoqXHJcblx0XHQgKiBGaWVsZHMgd2l0aCAgW10gIGxpa2UgdGhpcyAgIHNlbGVjdFtuYW1lPVwicmFuZ2V0aW1lMVtdXCJdXHJcblx0XHQgKiBpdCdzIHdoZW4gd2UgaGF2ZSAnbXVsdGlwbGUnIGluIHNob3J0Y29kZTogICBbc2VsZWN0KiByYW5nZXRpbWUgbXVsdGlwbGUgIFwiMDY6MDAgLSAwNjozMFwiIC4uLiBdXHJcblx0XHQgKi9cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19hcnI9W1xyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImR1cmF0aW9udGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXSdcclxuXHRcdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmpfYXJyID0gW107XHJcblxyXG5cdFx0Ly8gTG9vcCBhbGwgVGltZSBGaWVsZHNcclxuXHRcdGZvciAoIHZhciBjdGY9IDA7IGN0ZiA8IHRpbWVfZmllbGRzX2Fyci5sZW5ndGg7IGN0ZisrICl7XHJcblxyXG5cdFx0XHR2YXIgdGltZV9maWVsZCA9IHRpbWVfZmllbGRzX2FyclsgY3RmIF07XHJcblxyXG5cdFx0XHR2YXIgdGltZV9vcHRpb247XHJcblx0XHRcdGlmICggaXNfb25seV9zZWxlY3RlZF90aW1lICl7XHJcblx0XHRcdFx0dGltZV9vcHRpb24gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCArICcgb3B0aW9uOnNlbGVjdGVkJyApO1x0XHRcdC8vIEV4Y2x1ZGUgY29uZGl0aW9uYWwgIGZpZWxkcywgIGJlY2F1c2Ugb2YgdXNpbmcgJyNib29raW5nX2Zvcm0zIC4uLidcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aW1lX29wdGlvbiA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0aW1lX2ZpZWxkICsgJyBvcHRpb24nICk7XHRcdFx0XHQvLyBBbGwgIHRpbWUgZmllbGRzXHJcblx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHQvLyBMb29wIGFsbCBvcHRpb25zIGluIHRpbWUgZmllbGRcclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9vcHRpb24ubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfb3B0aW9uWyBqIF0gKTtcdFx0Ly8gR2V0IG9ubHkgIHNlbGVjdGVkIG9wdGlvbnMgXHQvL2pRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uOmVxKCcgKyBqICsgJyknICk7XHJcblx0XHRcdFx0dmFyIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyciA9IGpxdWVyeV9vcHRpb24udmFsKCkuc3BsaXQoICctJyApO1xyXG5cdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzID0gW107XHJcblxyXG5cdFx0XHRcdC8vIEdldCB0aW1lIGFzIHNlY29uZHNcclxuXHRcdFx0XHRpZiAoIHZhbHVlX29wdGlvbl9zZWNvbmRzX2Fyci5sZW5ndGggKXtcdFx0XHRcdCBcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aDsgaSsrICl7XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0XHRcdC8vIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FycltpXSA9ICcxNDowMCAnICB8ICcgMTY6MDAnICAgKGlmIGZyb20gJ3JhbmdldGltZScpIGFuZCAnMTY6MDAnICBpZiAoc3RhcnQvZW5kIHRpbWUpXHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgc3RhcnRfZW5kX3RpbWVzX2FyciA9IHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyclsgaSBdLnRyaW0oKS5zcGxpdCggJzonICk7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kcy5wdXNoKCB0aW1lX2luX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCApLmF0dHIoICduYW1lJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiBqcXVlcnlfb3B0aW9uLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiBqcXVlcnlfb3B0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0aW1lc19hc19zZWNvbmRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVGV4dDogICBbc3RhcnR0aW1lXSAtIFtlbmR0aW1lXSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdHZhciB0ZXh0X3RpbWVfZmllbGRzX2Fycj1bXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XTtcclxuXHRcdGZvciAoIHZhciB0Zj0gMDsgdGYgPCB0ZXh0X3RpbWVfZmllbGRzX2Fyci5sZW5ndGg7IHRmKysgKXtcclxuXHJcblx0XHRcdHZhciB0ZXh0X2pxdWVyeSA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0ZXh0X3RpbWVfZmllbGRzX2FyclsgdGYgXSApO1x0XHRcdFx0XHRcdFx0XHQvLyBFeGNsdWRlIGNvbmRpdGlvbmFsICBmaWVsZHMsICBiZWNhdXNlIG9mIHVzaW5nICcjYm9va2luZ19mb3JtMyAuLi4nXHJcblx0XHRcdGlmICggdGV4dF9qcXVlcnkubGVuZ3RoID4gMCApe1xyXG5cclxuXHRcdFx0XHR2YXIgdGltZV9faF9tX19hcnIgPSB0ZXh0X2pxdWVyeS52YWwoKS50cmltKCkuc3BsaXQoICc6JyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMTQ6MDAnXHJcblx0XHRcdFx0aWYgKCAwID09IHRpbWVfX2hfbV9fYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTm90IGVudGVyZWQgdGltZSB2YWx1ZSBpbiBhIGZpZWxkXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggMSA9PSB0aW1lX19oX21fX2Fyci5sZW5ndGggKXtcclxuXHRcdFx0XHRcdGlmICggJycgPT09IHRpbWVfX2hfbV9fYXJyWyAwIF0gKXtcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdC8vIE5vdCBlbnRlcmVkIHRpbWUgdmFsdWUgaW4gYSBmaWVsZFxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dGltZV9faF9tX19hcnJbIDEgXSA9IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciB0ZXh0X3RpbWVfaW5fc2Vjb25kcyA9IHBhcnNlSW50KCB0aW1lX19oX21fX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHRpbWVfX2hfbV9fYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHR2YXIgdGV4dF90aW1lc19hc19zZWNvbmRzID0gW107XHJcblx0XHRcdFx0dGV4dF90aW1lc19hc19zZWNvbmRzLnB1c2goIHRleHRfdGltZV9pbl9zZWNvbmRzICk7XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiB0ZXh0X2pxdWVyeS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzogdGV4dF9qcXVlcnkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IHRleHRfanF1ZXJ5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0ZXh0X3RpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGltZV9maWVsZHNfb2JqX2FycjtcclxuXHR9XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIFMgVSBQIFAgTyBSIFQgICAgZm9yICAgIEMgQSBMIEUgTiBEIEEgUiAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBDYWxlbmRhciBkYXRlcGljayAgSW5zdGFuY2VcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWQgIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHJldHVybiBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuZ2V0KCAwICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVuc2VsZWN0ICBhbGwgZGF0ZXMgaW4gY2FsZW5kYXIgYW5kIHZpc3VhbGx5IHVwZGF0ZSB0aGlzIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVx0XHR0cnVlIG9uIHN1Y2Nlc3MgfCBmYWxzZSwgIGlmIG5vIHN1Y2ggIGNhbGVuZGFyXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHRcdC8vIFVuc2VsZWN0IGFsbCBkYXRlcyBhbmQgc2V0ICBwcm9wZXJ0aWVzIG9mIERhdGVwaWNrXHJcblx0XHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoICcnICk7ICAgICAgLy9GaXhJbjogNS40LjNcclxuXHRcdFx0aW5zdC5zdGF5T3BlbiA9IGZhbHNlO1xyXG5cdFx0XHRpbnN0LmRhdGVzID0gW107XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENsZWFyIGRheXMgaGlnaGxpZ2h0aW5nIGluIEFsbCBvciBzcGVjaWZpYyBDYWxlbmRhcnNcclxuXHQgKlxyXG4gICAgICogQHBhcmFtIHJlc291cmNlX2lkICAtIGNhbiBiZSBza2lwZWQgdG8gIGNsZWFyIGhpZ2hsaWdodGluZyBpbiBhbGwgY2FsZW5kYXJzXHJcbiAgICAgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHQvLyBDbGVhciBpbiBzcGVjaWZpYyBjYWxlbmRhclxyXG5cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGpRdWVyeSggJy5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHRcdFx0XHRcdFx0XHQvLyBDbGVhciBpbiBhbGwgY2FsZW5kYXJzXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTY3JvbGwgdG8gc3BlY2lmaWMgbW9udGggaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiByZXNvdXJjZVxyXG5cdCAqIEBwYXJhbSB5ZWFyXHRcdFx0XHQtIHJlYWwgeWVhciAgLSAyMDIzXHJcblx0ICogQHBhcmFtIG1vbnRoXHRcdFx0XHQtIHJlYWwgbW9udGggLSAxMlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3Njcm9sbF90byggcmVzb3VyY2VfaWQsIHllYXIsIG1vbnRoICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXsgcmVzb3VyY2VfaWQgPSAnMSc7IH1cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHRcdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cclxuXHRcdFx0eWVhciAgPSBwYXJzZUludCggeWVhciApO1xyXG5cdFx0XHRtb250aCA9IHBhcnNlSW50KCBtb250aCApIC0gMTtcdFx0Ly8gSW4gSlMgZGF0ZSwgIG1vbnRoIC0xXHJcblxyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHQvLyBJbiBzb21lIGNhc2VzLCAgdGhlIHNldEZ1bGxZZWFyIGNhbiAgc2V0ICBvbmx5IFllYXIsICBhbmQgbm90IHRoZSBNb250aCBhbmQgZGF5ICAgICAgLy8gRml4SW46IDYuMi4zLjUuXHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZS5zZXRGdWxsWWVhciggeWVhciwgbW9udGgsIDEgKTtcclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlLnNldE1vbnRoKCBtb250aCApO1xyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUuc2V0RGF0ZSggMSApO1xyXG5cclxuXHRcdFx0aW5zdC5kcmF3TW9udGggPSBpbnN0LmN1cnNvckRhdGUuZ2V0TW9udGgoKTtcclxuXHRcdFx0aW5zdC5kcmF3WWVhciA9IGluc3QuY3Vyc29yRGF0ZS5nZXRGdWxsWWVhcigpO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9ub3RpZnlDaGFuZ2UoIGluc3QgKTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9hZGp1c3RJbnN0RGF0ZSggaW5zdCApO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3Nob3dEYXRlKCBpbnN0ICk7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSXMgdGhpcyBkYXRlIHNlbGVjdGFibGUgaW4gY2FsZW5kYXIgKG1haW5seSBpdCdzIG1lYW5zIEFWQUlMQUJMRSBkYXRlKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtpbnR8c3RyaW5nfSByZXNvdXJjZV9pZFx0XHQxXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXlcdFx0JzIwMjMtMDgtMTEnXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHRcdFx0XHRcdHRydWUgfCBmYWxzZVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc19kYXlfc2VsZWN0YWJsZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHQvLyBHZXQgRGF0YSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGRhdGVfYm9va2luZ3Nfb2JqID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblx0XHR2YXIgaXNfZGF5X3NlbGVjdGFibGUgPSAoIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSA+IDAgKTtcclxuXHJcblx0XHRpZiAoIHR5cGVvZiAoZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdKSA9PT0gJ3VuZGVmaW5lZCcgKXtcclxuXHRcdFx0cmV0dXJuIGlzX2RheV9zZWxlY3RhYmxlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2F2YWlsYWJsZScgIT0gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHR2YXIgaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgKTtcdFx0Ly8gc2V0IHBlbmRpbmcgZGF5cyBzZWxlY3RhYmxlICAgICAgICAgIC8vIEZpeEluOiA4LjYuMS4xOC5cclxuXHJcblx0XHRcdHN3aXRjaCAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdICl7XHJcblx0XHRcdFx0Y2FzZSAncGVuZGluZyc6XHJcblx0XHRcdFx0Ly8gU2l0dWF0aW9ucyBmb3IgXCJjaGFuZ2Utb3ZlclwiIGRheXM6XHJcblx0XHRcdFx0Y2FzZSAncGVuZGluZ19wZW5kaW5nJzpcclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nX2FwcHJvdmVkJzpcclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZF9wZW5kaW5nJzpcclxuXHRcdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGlzX2RheV9zZWxlY3RhYmxlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSXMgZGF0ZSB0byBjaGVjayBJTiBhcnJheSBvZiBzZWxlY3RlZCBkYXRlc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtkYXRlfWpzX2RhdGVfdG9fY2hlY2tcdFx0LSBKUyBEYXRlXHRcdFx0LSBzaW1wbGUgIEphdmFTY3JpcHQgRGF0ZSBvYmplY3RcclxuXHQgKiBAcGFyYW0ge1tdfSBqc19kYXRlc19hcnJcdFx0XHQtIFsgSlNEYXRlLCAuLi4gXSAgIC0gYXJyYXkgIG9mIEpTIGRhdGVzXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX2RheV9hbW9uZ19zZWxlY3RlZF9kYXlzKCBqc19kYXRlX3RvX2NoZWNrLCBqc19kYXRlc19hcnIgKXtcclxuXHJcblx0XHRmb3IgKCB2YXIgZGF0ZV9pbmRleCA9IDA7IGRhdGVfaW5kZXggPCBqc19kYXRlc19hcnIubGVuZ3RoIDsgZGF0ZV9pbmRleCsrICl7ICAgICBcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOC40LjUuMTYuXHJcblx0XHRcdGlmICggKCBqc19kYXRlc19hcnJbIGRhdGVfaW5kZXggXS5nZXRGdWxsWWVhcigpID09PSBqc19kYXRlX3RvX2NoZWNrLmdldEZ1bGxZZWFyKCkgKSAmJlxyXG5cdFx0XHRcdCAoIGpzX2RhdGVzX2FyclsgZGF0ZV9pbmRleCBdLmdldE1vbnRoKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0TW9udGgoKSApICYmXHJcblx0XHRcdFx0ICgganNfZGF0ZXNfYXJyWyBkYXRlX2luZGV4IF0uZ2V0RGF0ZSgpID09PSBqc19kYXRlX3RvX2NoZWNrLmdldERhdGUoKSApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IFNRTCBDbGFzcyBEYXRlICcyMDIzLTA4LTAxJyBmcm9tICBKUyBEYXRlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHRcdCcyMDIzLTA4LTEyJ1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKXtcclxuXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IGRhdGUuZ2V0RnVsbFllYXIoKSArICctJztcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSAoICggZGF0ZS5nZXRNb250aCgpICsgMSApIDwgMTAgKSA/ICcwJyA6ICcnO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9ICggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy0nXHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gKCBkYXRlLmdldERhdGUoKSA8IDEwICkgPyAnMCcgOiAnJztcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSBkYXRlLmdldERhdGUoKTtcclxuXHJcblx0XHRcdHJldHVybiBzcWxfY2xhc3NfZGF5O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IEpTIERhdGUgZnJvbSAgdGhlIFNRTCBkYXRlIGZvcm1hdCAnMjAyNC0wNS0xNCdcclxuXHQgKiBAcGFyYW0gc3FsX2NsYXNzX2RhdGVcclxuXHQgKiBAcmV0dXJucyB7RGF0ZX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19nZXRfX2pzX2RhdGUoIHNxbF9jbGFzc19kYXRlICl7XHJcblxyXG5cdFx0dmFyIHNxbF9jbGFzc19kYXRlX2FyciA9IHNxbF9jbGFzc19kYXRlLnNwbGl0KCAnLScgKTtcclxuXHJcblx0XHR2YXIgZGF0ZV9qcyA9IG5ldyBEYXRlKCk7XHJcblxyXG5cdFx0ZGF0ZV9qcy5zZXRGdWxsWWVhciggcGFyc2VJbnQoIHNxbF9jbGFzc19kYXRlX2FyclsgMCBdICksIChwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAxIF0gKSAtIDEpLCBwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAyIF0gKSApOyAgLy8geWVhciwgbW9udGgsIGRhdGVcclxuXHJcblx0XHQvLyBXaXRob3V0IHRoaXMgdGltZSBhZGp1c3QgRGF0ZXMgc2VsZWN0aW9uICBpbiBEYXRlcGlja2VyIGNhbiBub3Qgd29yayEhIVxyXG5cdFx0ZGF0ZV9qcy5zZXRIb3VycygwKTtcclxuXHRcdGRhdGVfanMuc2V0TWludXRlcygwKTtcclxuXHRcdGRhdGVfanMuc2V0U2Vjb25kcygwKTtcclxuXHRcdGRhdGVfanMuc2V0TWlsbGlzZWNvbmRzKDApO1xyXG5cclxuXHRcdHJldHVybiBkYXRlX2pzO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IFREIENsYXNzIERhdGUgJzEtMzEtMjAyMycgZnJvbSAgSlMgRGF0ZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdEpTIERhdGVcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVx0XHQnMS0zMS0yMDIzJ1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fdGRfY2xhc3NfZGF0ZSggZGF0ZSApe1xyXG5cclxuXHRcdHZhciB0ZF9jbGFzc19kYXkgPSAoZGF0ZS5nZXRNb250aCgpICsgMSkgKyAnLScgKyBkYXRlLmdldERhdGUoKSArICctJyArIGRhdGUuZ2V0RnVsbFllYXIoKTtcdFx0XHRcdFx0XHRcdFx0Ly8gJzEtOS0yMDIzJ1xyXG5cclxuXHRcdHJldHVybiB0ZF9jbGFzc19kYXk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgZGF0ZSBwYXJhbXMgZnJvbSAgc3RyaW5nIGRhdGVcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0c3RyaW5nIGRhdGUgbGlrZSAnMzEuNS4yMDIzJ1xyXG5cdCAqIEBwYXJhbSBzZXBhcmF0b3JcdFx0ZGVmYXVsdCAnLicgIGNhbiBiZSBza2lwcGVkLlxyXG5cdCAqIEByZXR1cm5zIHsgIHtkYXRlOiBudW1iZXIsIG1vbnRoOiBudW1iZXIsIHllYXI6IG51bWJlcn0gIH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19nZXRfX2RhdGVfcGFyYW1zX19mcm9tX3N0cmluZ19kYXRlKCBkYXRlICwgc2VwYXJhdG9yKXtcclxuXHJcblx0XHRzZXBhcmF0b3IgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHNlcGFyYXRvcikgKSA/IHNlcGFyYXRvciA6ICcuJztcclxuXHJcblx0XHR2YXIgZGF0ZV9hcnIgPSBkYXRlLnNwbGl0KCBzZXBhcmF0b3IgKTtcclxuXHRcdHZhciBkYXRlX29iaiA9IHtcclxuXHRcdFx0J3llYXInIDogIHBhcnNlSW50KCBkYXRlX2FyclsgMiBdICksXHJcblx0XHRcdCdtb250aCc6IChwYXJzZUludCggZGF0ZV9hcnJbIDEgXSApIC0gMSksXHJcblx0XHRcdCdkYXRlJyA6ICBwYXJzZUludCggZGF0ZV9hcnJbIDAgXSApXHJcblx0XHR9O1xyXG5cdFx0cmV0dXJuIGRhdGVfb2JqO1x0XHQvLyBmb3IgXHRcdCA9IG5ldyBEYXRlKCBkYXRlX29iai55ZWFyICwgZGF0ZV9vYmoubW9udGggLCBkYXRlX29iai5kYXRlICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBZGQgU3BpbiBMb2FkZXIgdG8gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RhcnQoIHJlc291cmNlX2lkICl7XHJcblx0XHRpZiAoICEgalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5uZXh0KCkuaGFzQ2xhc3MoICd3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyJyApICl7XHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuYWZ0ZXIoICc8ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkZXJfd3JhcHBlclwiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlclwiPjwvZGl2PjwvZGl2PicgKTtcclxuXHRcdH1cclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmhhc0NsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApICl7XHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuYWRkQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICk7XHJcblx0XHR9XHJcblx0XHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdGFydCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wKCByZXNvdXJjZV9pZCApe1xyXG5cdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnICsgLndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkucmVtb3ZlKCk7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApO1xyXG5cdFx0d3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBCbHVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0YXJ0KCByZXNvdXJjZV9pZCApe1xyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZGRDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cicgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBCbHVyIGluICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0b3AoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyJyApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblx0LyogID09ICBDYWxlbmRhciBVcGRhdGUgIC0gVmlldyAgPT1cclxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGUgTG9vayAgb2YgY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0alF1ZXJ5LmRhdGVwaWNrLl91cGRhdGVEYXRlcGljayggaW5zdCApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZSBkeW5hbWljYWxseSBOdW1iZXIgb2YgTW9udGhzIGluIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWQgaW50XHJcblx0ICogQHBhcmFtIG1vbnRoc19udW1iZXIgaW50XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdXBkYXRlX21vbnRoc19udW1iZXIoIHJlc291cmNlX2lkLCBtb250aHNfbnVtYmVyICl7XHJcblx0XHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0aWYgKCBudWxsICE9PSBpbnN0ICl7XHJcblx0XHRcdGluc3Quc2V0dGluZ3NbICdudW1iZXJPZk1vbnRocycgXSA9IG1vbnRoc19udW1iZXI7XHJcblx0XHRcdC8vX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJywgbW9udGhzX251bWJlciApO1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayggcmVzb3VyY2VfaWQgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTaG93IGNhbGVuZGFyIGluICBkaWZmZXJlbnQgU2tpblxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHNlbGVjdGVkX3NraW5fdXJsXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luKCBzZWxlY3RlZF9za2luX3VybCApe1xyXG5cclxuXHQvL2NvbnNvbGUubG9nKCAnU0tJTiBTRUxFQ1RJT04gOjonLCBzZWxlY3RlZF9za2luX3VybCApO1xyXG5cclxuXHRcdC8vIFJlbW92ZSBDU1Mgc2tpblxyXG5cdFx0dmFyIHN0eWxlc2hlZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmMtY2FsZW5kYXItc2tpbi1jc3MnICk7XHJcblx0XHRzdHlsZXNoZWV0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHN0eWxlc2hlZXQgKTtcclxuXHJcblxyXG5cdFx0Ly8gQWRkIG5ldyBDU1Mgc2tpblxyXG5cdFx0dmFyIGhlYWRJRCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCBcImhlYWRcIiApWyAwIF07XHJcblx0XHR2YXIgY3NzTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaW5rJyApO1xyXG5cdFx0Y3NzTm9kZS50eXBlID0gJ3RleHQvY3NzJztcclxuXHRcdGNzc05vZGUuc2V0QXR0cmlidXRlKCBcImlkXCIsIFwid3BiYy1jYWxlbmRhci1za2luLWNzc1wiICk7XHJcblx0XHRjc3NOb2RlLnJlbCA9ICdzdHlsZXNoZWV0JztcclxuXHRcdGNzc05vZGUubWVkaWEgPSAnc2NyZWVuJztcclxuXHRcdGNzc05vZGUuaHJlZiA9IHNlbGVjdGVkX3NraW5fdXJsO1x0Ly9cImh0dHA6Ly9iZXRhL3dwLWNvbnRlbnQvcGx1Z2lucy9ib29raW5nL2Nzcy9za2lucy9ncmVlbi0wMS5jc3NcIjtcclxuXHRcdGhlYWRJRC5hcHBlbmRDaGlsZCggY3NzTm9kZSApO1xyXG5cdH1cclxuXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfX2Nzc19fY2hhbmdlX3NraW4oIHNlbGVjdGVkX3NraW5fdXJsLCBzdHlsZXNoZWV0X2lkID0gJ3dwYmMtdGltZV9waWNrZXItc2tpbi1jc3MnICl7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIENTUyBza2luXHJcblx0XHR2YXIgc3R5bGVzaGVldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBzdHlsZXNoZWV0X2lkICk7XHJcblx0XHRzdHlsZXNoZWV0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHN0eWxlc2hlZXQgKTtcclxuXHJcblxyXG5cdFx0Ly8gQWRkIG5ldyBDU1Mgc2tpblxyXG5cdFx0dmFyIGhlYWRJRCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCBcImhlYWRcIiApWyAwIF07XHJcblx0XHR2YXIgY3NzTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaW5rJyApO1xyXG5cdFx0Y3NzTm9kZS50eXBlID0gJ3RleHQvY3NzJztcclxuXHRcdGNzc05vZGUuc2V0QXR0cmlidXRlKCBcImlkXCIsIHN0eWxlc2hlZXRfaWQgKTtcclxuXHRcdGNzc05vZGUucmVsID0gJ3N0eWxlc2hlZXQnO1xyXG5cdFx0Y3NzTm9kZS5tZWRpYSA9ICdzY3JlZW4nO1xyXG5cdFx0Y3NzTm9kZS5ocmVmID0gc2VsZWN0ZWRfc2tpbl91cmw7XHQvL1wiaHR0cDovL2JldGEvd3AtY29udGVudC9wbHVnaW5zL2Jvb2tpbmcvY3NzL3NraW5zL2dyZWVuLTAxLmNzc1wiO1xyXG5cdFx0aGVhZElELmFwcGVuZENoaWxkKCBjc3NOb2RlICk7XHJcblx0fVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIFMgVSBQIFAgTyBSIFQgICAgTSBBIFQgSCAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBNZXJnZSBzZXZlcmFsICBpbnRlcnNlY3RlZCBpbnRlcnZhbHMgb3IgcmV0dXJuIG5vdCBpbnRlcnNlY3RlZDogICAgICAgICAgICAgICAgICAgICAgICBbWzEsM10sWzIsNl0sWzgsMTBdLFsxNSwxOF1dICAtPiAgIFtbMSw2XSxbOCwxMF0sWzE1LDE4XV1cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gW10gaW50ZXJ2YWxzXHRcdFx0IFsgWzEsM10sWzIsNF0sWzYsOF0sWzksMTBdLFszLDddIF1cclxuXHRcdCAqIEByZXR1cm5zIFtdXHRcdFx0XHRcdCBbIFsxLDhdLFs5LDEwXSBdXHJcblx0XHQgKlxyXG5cdFx0ICogRXhtYW1wbGU6IHdwYmNfaW50ZXJ2YWxzX19tZXJnZV9pbmVyc2VjdGVkKCAgWyBbMSwzXSxbMiw0XSxbNiw4XSxbOSwxMF0sWzMsN10gXSAgKTtcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pbnRlcnZhbHNfX21lcmdlX2luZXJzZWN0ZWQoIGludGVydmFscyApe1xyXG5cclxuXHRcdFx0aWYgKCAhIGludGVydmFscyB8fCBpbnRlcnZhbHMubGVuZ3RoID09PSAwICl7XHJcblx0XHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgbWVyZ2VkID0gW107XHJcblx0XHRcdGludGVydmFscy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKXtcclxuXHRcdFx0XHRyZXR1cm4gYVsgMCBdIC0gYlsgMCBdO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHR2YXIgbWVyZ2VkSW50ZXJ2YWwgPSBpbnRlcnZhbHNbIDAgXTtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMTsgaSA8IGludGVydmFscy5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRcdHZhciBpbnRlcnZhbCA9IGludGVydmFsc1sgaSBdO1xyXG5cclxuXHRcdFx0XHRpZiAoIGludGVydmFsWyAwIF0gPD0gbWVyZ2VkSW50ZXJ2YWxbIDEgXSApe1xyXG5cdFx0XHRcdFx0bWVyZ2VkSW50ZXJ2YWxbIDEgXSA9IE1hdGgubWF4KCBtZXJnZWRJbnRlcnZhbFsgMSBdLCBpbnRlcnZhbFsgMSBdICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG1lcmdlZC5wdXNoKCBtZXJnZWRJbnRlcnZhbCApO1xyXG5cdFx0XHRcdFx0bWVyZ2VkSW50ZXJ2YWwgPSBpbnRlcnZhbDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG1lcmdlZC5wdXNoKCBtZXJnZWRJbnRlcnZhbCApO1xyXG5cdFx0XHRyZXR1cm4gbWVyZ2VkO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIDIgaW50ZXJ2YWxzIGludGVyc2VjdGVkOiAgICAgICBbMzYwMTEsIDg2MzkyXSAgICA8PT4gICAgWzEsIDQzMTkyXSAgPT4gIHRydWUgICAgICAoIGludGVyc2VjdGVkIClcclxuXHRcdCAqXHJcblx0XHQgKiBHb29kIGV4cGxhbmF0aW9uICBoZXJlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzMyNjk0MzQvd2hhdHMtdGhlLW1vc3QtZWZmaWNpZW50LXdheS10by10ZXN0LWlmLXR3by1yYW5nZXMtb3ZlcmxhcFxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSAgaW50ZXJ2YWxfQSAgIC0gWyAzNjAxMSwgODYzOTIgXVxyXG5cdFx0ICogQHBhcmFtICBpbnRlcnZhbF9CICAgLSBbICAgICAxLCA0MzE5MiBdXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiBib29sXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaW50ZXJ2YWxzX19pc19pbnRlcnNlY3RlZCggaW50ZXJ2YWxfQSwgaW50ZXJ2YWxfQiApIHtcclxuXHJcblx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCggMCA9PSBpbnRlcnZhbF9BLmxlbmd0aCApXHJcblx0XHRcdFx0IHx8ICggMCA9PSBpbnRlcnZhbF9CLmxlbmd0aCApXHJcblx0XHRcdCl7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpbnRlcnZhbF9BWyAwIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQVsgMCBdICk7XHJcblx0XHRcdGludGVydmFsX0FbIDEgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9BWyAxIF0gKTtcclxuXHRcdFx0aW50ZXJ2YWxfQlsgMCBdID0gcGFyc2VJbnQoIGludGVydmFsX0JbIDAgXSApO1xyXG5cdFx0XHRpbnRlcnZhbF9CWyAxIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQlsgMSBdICk7XHJcblxyXG5cdFx0XHR2YXIgaXNfaW50ZXJzZWN0ZWQgPSBNYXRoLm1heCggaW50ZXJ2YWxfQVsgMCBdLCBpbnRlcnZhbF9CWyAwIF0gKSAtIE1hdGgubWluKCBpbnRlcnZhbF9BWyAxIF0sIGludGVydmFsX0JbIDEgXSApO1xyXG5cclxuXHRcdFx0Ly8gaWYgKCAwID09IGlzX2ludGVyc2VjdGVkICkge1xyXG5cdFx0XHQvL1x0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3VjaCByYW5nZXMgZ29pbmcgb25lIGFmdGVyIG90aGVyLCBlLmcuOiBbIDEyLCAxNSBdIGFuZCBbIDE1LCAyMSBdXHJcblx0XHRcdC8vIH1cclxuXHJcblx0XHRcdGlmICggaXNfaW50ZXJzZWN0ZWQgPCAwICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlOyAgICAgICAgICAgICAgICAgICAgIC8vIElOVEVSU0VDVEVEXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBmYWxzZTsgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vdCBpbnRlcnNlY3RlZFxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCB0aGUgY2xvc2V0cyBBQlMgdmFsdWUgb2YgZWxlbWVudCBpbiBhcnJheSB0byB0aGUgY3VycmVudCBteVZhbHVlXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIG15VmFsdWUgXHQtIGludCBlbGVtZW50IHRvIHNlYXJjaCBjbG9zZXQgXHRcdFx0NFxyXG5cdFx0ICogQHBhcmFtIG15QXJyYXlcdC0gYXJyYXkgb2YgZWxlbWVudHMgd2hlcmUgdG8gc2VhcmNoIFx0WzUsOCwxLDddXHJcblx0XHQgKiBAcmV0dXJucyBpbnRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ1XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2Fic19jbG9zZXN0X3ZhbHVlX2luX2FyciggbXlWYWx1ZSwgbXlBcnJheSApe1xyXG5cclxuXHRcdFx0aWYgKCBteUFycmF5Lmxlbmd0aCA9PSAwICl7IFx0XHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgYXJyYXkgaXMgZW1wdHkgLT4gcmV0dXJuICB0aGUgbXlWYWx1ZVxyXG5cdFx0XHRcdHJldHVybiBteVZhbHVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgb2JqID0gbXlBcnJheVsgMCBdO1xyXG5cdFx0XHR2YXIgZGlmZiA9IE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICk7ICAgICAgICAgICAgIFx0Ly8gR2V0IGRpc3RhbmNlIGJldHdlZW4gIDFzdCBlbGVtZW50XHJcblx0XHRcdHZhciBjbG9zZXRWYWx1ZSA9IG15QXJyYXlbIDAgXTsgICAgICAgICAgICAgICAgICAgXHRcdFx0Ly8gU2F2ZSAxc3QgZWxlbWVudFxyXG5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAxOyBpIDwgbXlBcnJheS5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRcdG9iaiA9IG15QXJyYXlbIGkgXTtcclxuXHJcblx0XHRcdFx0aWYgKCBNYXRoLmFicyggbXlWYWx1ZSAtIG9iaiApIDwgZGlmZiApeyAgICAgXHRcdFx0Ly8gd2UgZm91bmQgY2xvc2VyIHZhbHVlIC0+IHNhdmUgaXRcclxuXHRcdFx0XHRcdGRpZmYgPSBNYXRoLmFicyggbXlWYWx1ZSAtIG9iaiApO1xyXG5cdFx0XHRcdFx0Y2xvc2V0VmFsdWUgPSBvYmo7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gY2xvc2V0VmFsdWU7XHJcblx0XHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgVCBPIE8gTCBUIEkgUCBTICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIHRvb2x0aXAgdG8gc2hvdywgIHdoZW4gIG1vdXNlIG92ZXIgRGF0ZSBpbiBDYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtICB0b29sdGlwX3RleHRcdFx0XHQtIFRleHQgdG8gc2hvd1x0XHRcdFx0J0Jvb2tlZCB0aW1lOiAxMjowMCAtIDEzOjAwPGJyPkNvc3Q6ICQyMC4wMCdcclxuXHQgKiBAcGFyYW0gIHJlc291cmNlX2lkXHRcdFx0LSBJRCBvZiBib29raW5nIHJlc291cmNlXHQnMSdcclxuXHQgKiBAcGFyYW0gIHRkX2NsYXNzXHRcdFx0XHQtIFNRTCBjbGFzc1x0XHRcdFx0XHQnMS05LTIwMjMnXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHRcdFx0XHRcdC0gZGVmaW5lZCB0byBzaG93IG9yIG5vdFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfc2V0X3Rvb2x0aXBfX19mb3JfX2NhbGVuZGFyX2RhdGUoIHRvb2x0aXBfdGV4dCwgcmVzb3VyY2VfaWQsIHRkX2NsYXNzICl7XHJcblxyXG5cdFx0Ly9UT0RPOiBtYWtlIGVzY2FwaW5nIG9mIHRleHQgZm9yIHF1b3Qgc3ltYm9scywgIGFuZCBKUy9IVE1MLi4uXHJcblxyXG5cdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIHRkLmNhbDRkYXRlLScgKyB0ZF9jbGFzcyApLmF0dHIoICdkYXRhLWNvbnRlbnQnLCB0b29sdGlwX3RleHQgKTtcclxuXHJcblx0XHR2YXIgdGRfZWwgPSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICkuZ2V0KCAwICk7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjAuMS4xLlxyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKHRkX2VsKSApXHJcblx0XHRcdCYmICggdW5kZWZpbmVkID09IHRkX2VsLl90aXBweSApXHJcblx0XHRcdCYmICggJycgIT09IHRvb2x0aXBfdGV4dCApXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0d3BiY190aXBweSggdGRfZWwgLCB7XHJcblx0XHRcdFx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBwb3BvdmVyX2NvbnRlbnQgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb250ZW50JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuICc8ZGl2IGNsYXNzPVwicG9wb3ZlciBwb3BvdmVyX3RpcHB5XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jb250ZW50XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgcG9wb3Zlcl9jb250ZW50XHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHQgKyAnPC9kaXY+JztcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRhbGxvd0hUTUwgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRyaWdnZXJcdFx0XHQgOiAnbW91c2VlbnRlciBmb2N1cycsXHJcblx0XHRcdFx0XHRpbnRlcmFjdGl2ZSAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRoaWRlT25DbGljayAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdFx0XHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHRcdFx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktdGltZXMnLFxyXG5cdFx0XHRcdFx0cGxhY2VtZW50ICAgICAgICA6ICd0b3AnLFxyXG5cdFx0XHRcdFx0ZGVsYXlcdFx0XHQgOiBbNDAwLCAwXSxcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS40LjIuMi5cclxuXHRcdFx0XHRcdC8vZGVsYXlcdFx0XHQgOiBbMCwgOTk5OTk5OTk5OV0sXHRcdFx0XHRcdFx0Ly8gRGVidWdlICB0b29sdGlwXHJcblx0XHRcdFx0XHRpZ25vcmVBdHRyaWJ1dGVzIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRvdWNoXHRcdFx0IDogdHJ1ZSxcdFx0XHRcdFx0XHRcdFx0Ly9bJ2hvbGQnLCA1MDBdLCAvLyA1MDBtcyBkZWxheVx0XHRcdFx0Ly8gRml4SW46IDkuMi4xLjUuXHJcblx0XHRcdFx0XHRhcHBlbmRUbzogKCkgPT4gZG9jdW1lbnQuYm9keSxcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgRGF0ZXMgRnVuY3Rpb25zICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBHZXQgbnVtYmVyIG9mIGRhdGVzIGJldHdlZW4gMiBKUyBEYXRlc1xyXG4gKlxyXG4gKiBAcGFyYW0gZGF0ZTFcdFx0SlMgRGF0ZVxyXG4gKiBAcGFyYW0gZGF0ZTJcdFx0SlMgRGF0ZVxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kYXRlc19fZGF5c19iZXR3ZWVuKGRhdGUxLCBkYXRlMikge1xyXG5cclxuICAgIC8vIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIGluIG9uZSBkYXlcclxuICAgIHZhciBPTkVfREFZID0gMTAwMCAqIDYwICogNjAgKiAyNDtcclxuXHJcbiAgICAvLyBDb252ZXJ0IGJvdGggZGF0ZXMgdG8gbWlsbGlzZWNvbmRzXHJcbiAgICB2YXIgZGF0ZTFfbXMgPSBkYXRlMS5nZXRUaW1lKCk7XHJcbiAgICB2YXIgZGF0ZTJfbXMgPSBkYXRlMi5nZXRUaW1lKCk7XHJcblxyXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBkaWZmZXJlbmNlIGluIG1pbGxpc2Vjb25kc1xyXG4gICAgdmFyIGRpZmZlcmVuY2VfbXMgPSAgZGF0ZTFfbXMgLSBkYXRlMl9tcztcclxuXHJcbiAgICAvLyBDb252ZXJ0IGJhY2sgdG8gZGF5cyBhbmQgcmV0dXJuXHJcbiAgICByZXR1cm4gTWF0aC5yb3VuZChkaWZmZXJlbmNlX21zL09ORV9EQVkpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIENoZWNrICBpZiB0aGlzIGFycmF5ICBvZiBkYXRlcyBpcyBjb25zZWN1dGl2ZSBhcnJheSAgb2YgZGF0ZXMgb3Igbm90LlxyXG4gKiBcdFx0ZS5nLiAgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXSAtPiBmYWxzZVxyXG4gKiBcdFx0ZS5nLiAgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xMCcsJzIwMjQtMDUtMTEnXSAtPiB0cnVlXHJcbiAqIEBwYXJhbSBzcWxfZGF0ZXNfYXJyXHQgYXJyYXlcdFx0ZS5nLjogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXVxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGF0ZXNfX2lzX2NvbnNlY3V0aXZlX2RhdGVzX2Fycl9yYW5nZSggc3FsX2RhdGVzX2FyciApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41MC5cclxuXHJcblx0aWYgKCBzcWxfZGF0ZXNfYXJyLmxlbmd0aCA+IDEgKXtcclxuXHRcdHZhciBwcmV2aW9zX2RhdGUgPSB3cGJjX19nZXRfX2pzX2RhdGUoIHNxbF9kYXRlc19hcnJbIDAgXSApO1xyXG5cdFx0dmFyIGN1cnJlbnRfZGF0ZTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBzcWxfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdGN1cnJlbnRfZGF0ZSA9IHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2RhdGVzX2FycltpXSApO1xyXG5cclxuXHRcdFx0aWYgKCB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oIGN1cnJlbnRfZGF0ZSwgcHJldmlvc19kYXRlICkgIT0gMSApe1xyXG5cdFx0XHRcdHJldHVybiAgZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHByZXZpb3NfZGF0ZSA9IGN1cnJlbnRfZGF0ZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgQXV0byBEYXRlcyBTZWxlY3Rpb24gID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqICA9PSBIb3cgdG8gIHVzZSA/ID09XHJcbiAqXHJcbiAqICBGb3IgRGF0ZXMgc2VsZWN0aW9uLCB3ZSBuZWVkIHRvIHVzZSB0aGlzIGxvZ2ljISAgICAgV2UgbmVlZCBzZWxlY3QgdGhlIGRhdGVzIG9ubHkgYWZ0ZXIgYm9va2luZyBkYXRhIGxvYWRlZCFcclxuICpcclxuICogIENoZWNrIGV4YW1wbGUgYmVsbG93LlxyXG4gKlxyXG4gKlx0Ly8gRmlyZSBvbiBhbGwgYm9va2luZyBkYXRlcyBsb2FkZWRcclxuICpcdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiAoIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKXtcclxuICpcclxuICpcdFx0aWYgKCBsb2FkZWRfcmVzb3VyY2VfaWQgPT0gc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkICl7XHJcbiAqXHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkLCAnMjAyNC0wNS0xNScsICcyMDI0LTA1LTI1JyApO1xyXG4gKlx0XHR9XHJcbiAqXHR9ICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuXHJcbi8qKlxyXG4gKiBUcnkgdG8gQXV0byBzZWxlY3QgZGF0ZXMgaW4gc3BlY2lmaWMgY2FsZW5kYXIgYnkgc2ltdWxhdGVkIGNsaWNrcyBpbiBkYXRlcGlja2VyXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHQxXHJcbiAqIEBwYXJhbSBjaGVja19pbl95bWRcdFx0JzIwMjQtMDUtMDknXHRcdE9SICBcdFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTIwJ11cclxuICogQHBhcmFtIGNoZWNrX291dF95bWRcdFx0JzIwMjQtMDUtMTUnXHRcdE9wdGlvbmFsXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHRcdG51bWJlciBvZiBzZWxlY3RlZCBkYXRlc1xyXG4gKlxyXG4gKiBcdEV4YW1wbGUgMTpcdFx0XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIDEsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqIFx0RXhhbXBsZSAyOlx0XHRcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggMSwgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjAnXSApO1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCA9ICcnICl7XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNDcuXHJcblxyXG5cdGNvbnNvbGUubG9nKCAnV1BCQ19BVVRPX1NFTEVDVF9EQVRFU19JTl9DQUxFTkRBUiggUkVTT1VSQ0VfSUQsIENIRUNLX0lOX1lNRCwgQ0hFQ0tfT1VUX1lNRCApJywgcmVzb3VyY2VfaWQsIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCApO1xyXG5cclxuXHRpZiAoXHJcblx0XHQgICAoICcyMTAwLTAxLTAxJyA9PSBjaGVja19pbl95bWQgKVxyXG5cdFx0fHwgKCAnMjEwMC0wMS0wMScgPT0gY2hlY2tfb3V0X3ltZCApXHJcblx0XHR8fCAoICggJycgPT0gY2hlY2tfaW5feW1kICkgJiYgKCAnJyA9PSBjaGVja19vdXRfeW1kICkgKVxyXG5cdCl7XHJcblx0XHRyZXR1cm4gMDtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gSWYgXHRjaGVja19pbl95bWQgID0gIFsgJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCcgXVx0XHRcdFx0QVJSQVkgb2YgREFURVNcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGRhdGVzX3RvX3NlbGVjdF9hcnIgPSBbXTtcclxuXHRpZiAoIEFycmF5LmlzQXJyYXkoIGNoZWNrX2luX3ltZCApICl7XHJcblx0XHRkYXRlc190b19zZWxlY3RfYXJyID0gd3BiY19jbG9uZV9vYmooIGNoZWNrX2luX3ltZCApO1xyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEV4Y2VwdGlvbnMgdG8gIHNldCAgXHRNVUxUSVBMRSBEQVlTIFx0bW9kZVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gaWYgZGF0ZXMgYXMgTk9UIENPTlNFQ1VUSVZFOiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddLCAtPiBzZXQgTVVMVElQTEUgREFZUyBtb2RlXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGggPiAwIClcclxuXHRcdFx0JiYgKCAnJyA9PSBjaGVja19vdXRfeW1kIClcclxuXHRcdFx0JiYgKCAhIHdwYmNfZGF0ZXNfX2lzX2NvbnNlY3V0aXZlX2RhdGVzX2Fycl9yYW5nZSggZGF0ZXNfdG9fc2VsZWN0X2FyciApIClcclxuXHRcdCl7XHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdH1cclxuXHRcdC8vIGlmIG11bHRpcGxlIGRheXMgdG8gc2VsZWN0LCBidXQgZW5hYmxlZCBTSU5HTEUgZGF5IG1vZGUsIC0+IHNldCBNVUxUSVBMRSBEQVlTIG1vZGVcclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDEgKVxyXG5cdFx0XHQmJiAoICcnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0XHQmJiAoICdzaW5nbGUnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Y2hlY2tfaW5feW1kID0gZGF0ZXNfdG9fc2VsZWN0X2FyclsgMCBdO1xyXG5cdFx0aWYgKCAnJyA9PSBjaGVja19vdXRfeW1kICl7XHJcblx0XHRcdGNoZWNrX291dF95bWQgPSBkYXRlc190b19zZWxlY3RfYXJyWyAoZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGgtMSkgXTtcclxuXHRcdH1cclxuXHR9XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdGlmICggJycgPT0gY2hlY2tfaW5feW1kICl7XHJcblx0XHRjaGVja19pbl95bWQgPSBjaGVja19vdXRfeW1kO1xyXG5cdH1cclxuXHRpZiAoICcnID09IGNoZWNrX291dF95bWQgKXtcclxuXHRcdGNoZWNrX291dF95bWQgPSBjaGVja19pbl95bWQ7XHJcblx0fVxyXG5cclxuXHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHJlc291cmNlX2lkKSApe1xyXG5cdFx0cmVzb3VyY2VfaWQgPSAnMSc7XHJcblx0fVxyXG5cclxuXHJcblx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0aWYgKCBudWxsICE9PSBpbnN0ICl7XHJcblxyXG5cdFx0Ly8gVW5zZWxlY3QgYWxsIGRhdGVzIGFuZCBzZXQgIHByb3BlcnRpZXMgb2YgRGF0ZXBpY2tcclxuXHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoICcnICk7ICAgICAgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDUuNC4zXHJcblx0XHRpbnN0LnN0YXlPcGVuID0gZmFsc2U7XHJcblx0XHRpbnN0LmRhdGVzID0gW107XHJcblx0XHR2YXIgY2hlY2tfaW5fanMgPSB3cGJjX19nZXRfX2pzX2RhdGUoIGNoZWNrX2luX3ltZCApO1xyXG5cdFx0dmFyIHRkX2NlbGwgICAgID0gd3BiY19nZXRfY2xpY2tlZF90ZCggaW5zdC5pZCwgY2hlY2tfaW5fanMgKTtcclxuXHJcblx0XHQvLyBJcyBvbWUgdHlwZSBvZiBlcnJvciwgdGhlbiBzZWxlY3QgbXVsdGlwbGUgZGF5cyBzZWxlY3Rpb24gIG1vZGUuXHJcblx0XHRpZiAoICcnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKSB7XHJcbiBcdFx0XHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnLCAnbXVsdGlwbGUnICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IERZTkFNSUMgPT1cclxuXHRcdGlmICggJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdFx0Ly8gMS1zdCBjbGlja1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gZmFsc2U7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsLCAnIycgKyBpbnN0LmlkLCBjaGVja19pbl9qcy5nZXRUaW1lKCkgKTtcclxuXHRcdFx0aWYgKCAwID09PSBpbnN0LmRhdGVzLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVybiAwOyAgXHRcdFx0XHRcdFx0XHRcdC8vIEZpcnN0IGNsaWNrICB3YXMgdW5zdWNjZXNzZnVsLCBzbyB3ZSBtdXN0IG5vdCBtYWtlIG90aGVyIGNsaWNrXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIDItbmQgY2xpY2tcclxuXHRcdFx0dmFyIGNoZWNrX291dF9qcyA9IHdwYmNfX2dldF9fanNfZGF0ZSggY2hlY2tfb3V0X3ltZCApO1xyXG5cdFx0XHR2YXIgdGRfY2VsbF9vdXQgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19vdXRfanMgKTtcclxuXHRcdFx0aW5zdC5zdGF5T3BlbiA9IHRydWU7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsX291dCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfb3V0X2pzLmdldFRpbWUoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IEZJWEVEID09XHJcblx0XHRpZiAoICAnZml4ZWQnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpIHtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IFNJTkdMRSA9PVxyXG5cdFx0aWYgKCAnc2luZ2xlJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRcdC8valF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBjaGVja19pbl9qcywgbnVsbCApICk7XHRcdC8vIERvIHdlIG5lZWQgdG8gcnVuICB0aGlzID8gUGxlYXNlIG5vdGUsIGNoZWNrX2luX2pzIG11c3QgIGhhdmUgdGltZSwgIG1pbiwgc2VjIGRlZmluZWQgdG8gMCFcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IE1VTFRJUExFID09XHJcblx0XHRpZiAoICdtdWx0aXBsZScgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cclxuXHRcdFx0dmFyIGRhdGVzX2FycjtcclxuXHJcblx0XHRcdGlmICggZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGggPiAwICl7XHJcblx0XHRcdFx0Ly8gU2l0dWF0aW9uLCB3aGVuIHdlIGhhdmUgZGF0ZXMgYXJyYXk6IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ10uICBhbmQgbm90IHRoZSBDaGVjayBJbiAvIENoZWNrICBvdXQgZGF0ZXMgYXMgcGFyYW1ldGVyIGluIHRoaXMgZnVuY3Rpb25cclxuXHRcdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9hcnIoIGRhdGVzX3RvX3NlbGVjdF9hcnIgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9jaGVja19pbl9vdXQoIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCwgaW5zdCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIDAgPT09IGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGggKXtcclxuXHRcdFx0XHRyZXR1cm4gMDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRm9yIENhbGVuZGFyIERheXMgc2VsZWN0aW9uXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGg7IGorKyApeyAgICAgICAvLyBMb29wIGFycmF5IG9mIGRhdGVzXHJcblxyXG5cdFx0XHRcdHZhciBzdHJfZGF0ZSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGVzX2Fyci5kYXRlc19qc1sgaiBdICk7XHJcblxyXG5cdFx0XHRcdC8vIERhdGUgdW5hdmFpbGFibGUgIVxyXG5cdFx0XHRcdGlmICggMCA9PSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3RyX2RhdGUgKS5kYXlfYXZhaWxhYmlsaXR5ICl7XHJcblx0XHRcdFx0XHRyZXR1cm4gMDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gIT0gLTEgKSB7XHJcblx0XHRcdFx0XHRpbnN0LmRhdGVzLnB1c2goIGRhdGVzX2Fyci5kYXRlc19qc1sgaiBdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgY2hlY2tfb3V0X2RhdGUgPSBkYXRlc19hcnIuZGF0ZXNfanNbIChkYXRlc19hcnIuZGF0ZXNfanMubGVuZ3RoIC0gMSkgXTtcclxuXHJcblx0XHRcdGluc3QuZGF0ZXMucHVzaCggY2hlY2tfb3V0X2RhdGUgKTsgXHRcdFx0Ly8gTmVlZCBhZGQgb25lIGFkZGl0aW9uYWwgU0FNRSBkYXRlIGZvciBjb3JyZWN0ICB3b3JrcyBvZiBkYXRlcyBzZWxlY3Rpb24gISEhISFcclxuXHJcblx0XHRcdHZhciBjaGVja291dF90aW1lc3RhbXAgPSBjaGVja19vdXRfZGF0ZS5nZXRUaW1lKCk7XHJcblx0XHRcdHZhciB0ZF9jZWxsID0gd3BiY19nZXRfY2xpY2tlZF90ZCggaW5zdC5pZCwgY2hlY2tfb3V0X2RhdGUgKTtcclxuXHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsLCAnIycgKyBpbnN0LmlkLCBjaGVja291dF90aW1lc3RhbXAgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0aWYgKCAwICE9PSBpbnN0LmRhdGVzLmxlbmd0aCApe1xyXG5cdFx0XHQvLyBTY3JvbGwgdG8gc3BlY2lmaWMgbW9udGgsIGlmIHdlIHNldCBkYXRlcyBpbiBzb21lIGZ1dHVyZSBtb250aHNcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fc2Nyb2xsX3RvKCByZXNvdXJjZV9pZCwgaW5zdC5kYXRlc1sgMCBdLmdldEZ1bGxZZWFyKCksIGluc3QuZGF0ZXNbIDAgXS5nZXRNb250aCgpKzEgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gaW5zdC5kYXRlcy5sZW5ndGg7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gMDtcclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgSFRNTCB0ZCBlbGVtZW50ICh3aGVyZSB3YXMgY2xpY2sgaW4gY2FsZW5kYXIgIGRheSAgY2VsbClcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9odG1sX2lkXHRcdFx0J2NhbGVuZGFyX2Jvb2tpbmcxJ1xyXG5cdCAqIEBwYXJhbSBkYXRlX2pzXHRcdFx0XHRcdEpTIERhdGVcclxuXHQgKiBAcmV0dXJucyB7KnxqUXVlcnl9XHRcdFx0XHREb20gSFRNTCB0ZCBlbGVtZW50XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfY2xpY2tlZF90ZCggY2FsZW5kYXJfaHRtbF9pZCwgZGF0ZV9qcyApe1xyXG5cclxuXHQgICAgdmFyIHRkX2NlbGwgPSBqUXVlcnkoICcjJyArIGNhbGVuZGFyX2h0bWxfaWQgKyAnIC5zcWxfZGF0ZV8nICsgd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZV9qcyApICkuZ2V0KCAwICk7XHJcblxyXG5cdFx0cmV0dXJuIHRkX2NlbGw7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYXJyYXlzIG9mIEpTIGFuZCBTUUwgZGF0ZXMgYXMgZGF0ZXMgYXJyYXlcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBjaGVja19pbl95bWRcdFx0XHRcdFx0XHRcdCcyMDI0LTA1LTE1J1xyXG5cdCAqIEBwYXJhbSBjaGVja19vdXRfeW1kXHRcdFx0XHRcdFx0XHQnMjAyNC0wNS0yNSdcclxuXHQgKiBAcGFyYW0gaW5zdFx0XHRcdFx0XHRcdFx0XHRcdERhdGVwaWNrIEluc3QuIFVzZSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHQgKiBAcmV0dXJucyB7e2RhdGVzX2pzOiAqW10sIGRhdGVzX3N0cjogKltdfX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9jaGVja19pbl9vdXQoIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCAsIGluc3QgKXtcclxuXHJcblx0XHR2YXIgb3JpZ2luYWxfYXJyYXkgPSBbXTtcclxuXHRcdHZhciBkYXRlO1xyXG5cdFx0dmFyIGJrX2Rpc3RpbmN0X2RhdGVzID0gW107XHJcblxyXG5cdFx0dmFyIGNoZWNrX2luX2RhdGUgPSBjaGVja19pbl95bWQuc3BsaXQoICctJyApO1xyXG5cdFx0dmFyIGNoZWNrX291dF9kYXRlID0gY2hlY2tfb3V0X3ltZC5zcGxpdCggJy0nICk7XHJcblxyXG5cdFx0ZGF0ZSA9IG5ldyBEYXRlKCk7XHJcblx0XHRkYXRlLnNldEZ1bGxZZWFyKCBjaGVja19pbl9kYXRlWyAwIF0sIChjaGVja19pbl9kYXRlWyAxIF0gLSAxKSwgY2hlY2tfaW5fZGF0ZVsgMiBdICk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8geWVhciwgbW9udGgsIGRhdGVcclxuXHRcdHZhciBvcmlnaW5hbF9jaGVja19pbl9kYXRlID0gZGF0ZTtcclxuXHRcdG9yaWdpbmFsX2FycmF5LnB1c2goIGpRdWVyeS5kYXRlcGljay5fcmVzdHJpY3RNaW5NYXgoIGluc3QsIGpRdWVyeS5kYXRlcGljay5fZGV0ZXJtaW5lRGF0ZSggaW5zdCwgZGF0ZSwgbnVsbCApICkgKTsgLy9hZGQgZGF0ZVxyXG5cdFx0aWYgKCAhIHdwYmNfaW5fYXJyYXkoIGJrX2Rpc3RpbmN0X2RhdGVzLCAoY2hlY2tfaW5fZGF0ZVsgMiBdICsgJy4nICsgY2hlY2tfaW5fZGF0ZVsgMSBdICsgJy4nICsgY2hlY2tfaW5fZGF0ZVsgMCBdKSApICl7XHJcblx0XHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnB1c2goIHBhcnNlSW50KGNoZWNrX2luX2RhdGVbIDIgXSkgKyAnLicgKyBwYXJzZUludChjaGVja19pbl9kYXRlWyAxIF0pICsgJy4nICsgY2hlY2tfaW5fZGF0ZVsgMCBdICk7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGRhdGVfb3V0ID0gbmV3IERhdGUoKTtcclxuXHRcdGRhdGVfb3V0LnNldEZ1bGxZZWFyKCBjaGVja19vdXRfZGF0ZVsgMCBdLCAoY2hlY2tfb3V0X2RhdGVbIDEgXSAtIDEpLCBjaGVja19vdXRfZGF0ZVsgMiBdICk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8geWVhciwgbW9udGgsIGRhdGVcclxuXHRcdHZhciBvcmlnaW5hbF9jaGVja19vdXRfZGF0ZSA9IGRhdGVfb3V0O1xyXG5cclxuXHRcdHZhciBtZXdEYXRlID0gbmV3IERhdGUoIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RnVsbFllYXIoKSwgb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXRNb250aCgpLCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldERhdGUoKSApO1xyXG5cdFx0bWV3RGF0ZS5zZXREYXRlKCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHJcblx0XHR3aGlsZSAoXHJcblx0XHRcdChvcmlnaW5hbF9jaGVja19vdXRfZGF0ZSA+IGRhdGUpICYmXHJcblx0XHRcdChvcmlnaW5hbF9jaGVja19pbl9kYXRlICE9IG9yaWdpbmFsX2NoZWNrX291dF9kYXRlKSApe1xyXG5cdFx0XHRkYXRlID0gbmV3IERhdGUoIG1ld0RhdGUuZ2V0RnVsbFllYXIoKSwgbWV3RGF0ZS5nZXRNb250aCgpLCBtZXdEYXRlLmdldERhdGUoKSApO1xyXG5cclxuXHRcdFx0b3JpZ2luYWxfYXJyYXkucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBkYXRlLCBudWxsICkgKSApOyAvL2FkZCBkYXRlXHJcblx0XHRcdGlmICggIXdwYmNfaW5fYXJyYXkoIGJrX2Rpc3RpbmN0X2RhdGVzLCAoZGF0ZS5nZXREYXRlKCkgKyAnLicgKyBwYXJzZUludCggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy4nICsgZGF0ZS5nZXRGdWxsWWVhcigpKSApICl7XHJcblx0XHRcdFx0YmtfZGlzdGluY3RfZGF0ZXMucHVzaCggKHBhcnNlSW50KGRhdGUuZ2V0RGF0ZSgpKSArICcuJyArIHBhcnNlSW50KCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLicgKyBkYXRlLmdldEZ1bGxZZWFyKCkpICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG1ld0RhdGUgPSBuZXcgRGF0ZSggZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpICk7XHJcblx0XHRcdG1ld0RhdGUuc2V0RGF0ZSggbWV3RGF0ZS5nZXREYXRlKCkgKyAxICk7XHJcblx0XHR9XHJcblx0XHRvcmlnaW5hbF9hcnJheS5wb3AoKTtcclxuXHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnBvcCgpO1xyXG5cclxuXHRcdHJldHVybiB7J2RhdGVzX2pzJzogb3JpZ2luYWxfYXJyYXksICdkYXRlc19zdHInOiBia19kaXN0aW5jdF9kYXRlc307XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYXJyYXlzIG9mIEpTIGFuZCBTUUwgZGF0ZXMgYXMgZGF0ZXMgYXJyYXlcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlc190b19zZWxlY3RfYXJyXHQ9IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ11cclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHt7ZGF0ZXNfanM6ICpbXSwgZGF0ZXNfc3RyOiAqW119fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2FyciggZGF0ZXNfdG9fc2VsZWN0X2FyciApe1x0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41MC5cclxuXHJcblx0XHR2YXIgb3JpZ2luYWxfYXJyYXkgICAgPSBbXTtcclxuXHRcdHZhciBia19kaXN0aW5jdF9kYXRlcyA9IFtdO1xyXG5cdFx0dmFyIG9uZV9kYXRlX3N0cjtcclxuXHJcblx0XHRmb3IgKCB2YXIgZCA9IDA7IGQgPCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aDsgZCsrICl7XHJcblxyXG5cdFx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCB3cGJjX19nZXRfX2pzX2RhdGUoIGRhdGVzX3RvX3NlbGVjdF9hcnJbIGQgXSApICk7XHJcblxyXG5cdFx0XHRvbmVfZGF0ZV9zdHIgPSBkYXRlc190b19zZWxlY3RfYXJyWyBkIF0uc3BsaXQoJy0nKVxyXG5cdFx0XHRpZiAoICEgd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChvbmVfZGF0ZV9zdHJbIDIgXSArICcuJyArIG9uZV9kYXRlX3N0clsgMSBdICsgJy4nICsgb25lX2RhdGVfc3RyWyAwIF0pICkgKXtcclxuXHRcdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCBwYXJzZUludChvbmVfZGF0ZV9zdHJbIDIgXSkgKyAnLicgKyBwYXJzZUludChvbmVfZGF0ZV9zdHJbIDEgXSkgKyAnLicgKyBvbmVfZGF0ZV9zdHJbIDAgXSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHsnZGF0ZXNfanMnOiBvcmlnaW5hbF9hcnJheSwgJ2RhdGVzX3N0cic6IG9yaWdpbmFsX2FycmF5fTtcclxuXHR9XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLyogID09ICBBdXRvIEZpbGwgRmllbGRzIC8gQXV0byBTZWxlY3QgRGF0ZXMgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHJcblx0dmFyIHVybF9wYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCB3aW5kb3cubG9jYXRpb24uc2VhcmNoICk7XHJcblxyXG5cdC8vIERpc2FibGUgZGF5cyBzZWxlY3Rpb24gIGluIGNhbGVuZGFyLCAgYWZ0ZXIgIHJlZGlyZWN0aW9uICBmcm9tICB0aGUgXCJTZWFyY2ggcmVzdWx0cyBwYWdlLCAgYWZ0ZXIgIHNlYXJjaCAgYXZhaWxhYmlsaXR5XCIgXHRcdFx0Ly8gRml4SW46IDguOC4yLjMuXHJcblx0aWYgICggJ09uJyAhPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19lbmFibGVkX2Jvb2tpbmdfc2VhcmNoX3Jlc3VsdHNfZGF5c19zZWxlY3QnICkgKSB7XHJcblx0XHRpZiAoXHJcblx0XHRcdCggdXJsX3BhcmFtcy5oYXMoICd3cGJjX3NlbGVjdF9jaGVja19pbicgKSApICYmXHJcblx0XHRcdCggdXJsX3BhcmFtcy5oYXMoICd3cGJjX3NlbGVjdF9jaGVja19vdXQnICkgKSAmJlxyXG5cdFx0XHQoIHVybF9wYXJhbXMuaGFzKCAnd3BiY19zZWxlY3RfY2FsZW5kYXJfaWQnICkgKVxyXG5cdFx0KXtcclxuXHJcblx0XHRcdHZhciBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQgPSBwYXJzZUludCggdXJsX3BhcmFtcy5nZXQoICd3cGJjX3NlbGVjdF9jYWxlbmRhcl9pZCcgKSApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZSBvbiBhbGwgYm9va2luZyBkYXRlcyBsb2FkZWRcclxuXHRcdFx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uICggZXZlbnQsIGxvYWRlZF9yZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0XHRpZiAoIGxvYWRlZF9yZXNvdXJjZV9pZCA9PSBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQgKXtcclxuXHRcdFx0XHRcdHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCwgdXJsX3BhcmFtcy5nZXQoICd3cGJjX3NlbGVjdF9jaGVja19pbicgKSwgdXJsX3BhcmFtcy5nZXQoICd3cGJjX3NlbGVjdF9jaGVja19vdXQnICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggdXJsX3BhcmFtcy5oYXMoICd3cGJjX2F1dG9fZmlsbCcgKSApe1xyXG5cclxuXHRcdHZhciB3cGJjX2F1dG9fZmlsbF92YWx1ZSA9IHVybF9wYXJhbXMuZ2V0KCAnd3BiY19hdXRvX2ZpbGwnICk7XHJcblxyXG5cdFx0Ly8gQ29udmVydCBiYWNrLiAgICAgU29tZSBzeXN0ZW1zIGRvIG5vdCBsaWtlIHN5bWJvbCAnficgaW4gVVJMLCBzbyAgd2UgbmVlZCB0byByZXBsYWNlIHRvICBzb21lIG90aGVyIHN5bWJvbHNcclxuXHRcdHdwYmNfYXV0b19maWxsX3ZhbHVlID0gd3BiY19hdXRvX2ZpbGxfdmFsdWUucmVwbGFjZUFsbCggJ19eXycsICd+JyApO1xyXG5cclxuXHRcdHdwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzKCB3cGJjX2F1dG9fZmlsbF92YWx1ZSApO1xyXG5cdH1cclxuXHJcbn0gKTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvZmlsbCAvIHNlbGVjdCBib29raW5nIGZvcm0gIGZpZWxkcyBieSAgdmFsdWVzIGZyb20gIHRoZSBHRVQgcmVxdWVzdCAgcGFyYW1ldGVyOiA/d3BiY19hdXRvX2ZpbGw9XHJcbiAqXHJcbiAqIEBwYXJhbSBhdXRvX2ZpbGxfc3RyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkcyggYXV0b19maWxsX3N0ciApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC40OC5cclxuXHJcblx0aWYgKCAnJyA9PSBhdXRvX2ZpbGxfc3RyICl7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuLy8gY29uc29sZS5sb2coICdXUEJDX0FVVE9fRklMTF9CT09LSU5HX0ZJRUxEUyggQVVUT19GSUxMX1NUUiApJywgYXV0b19maWxsX3N0cik7XHJcblxyXG5cdHZhciBmaWVsZHNfYXJyID0gd3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHNfX3BhcnNlKCBhdXRvX2ZpbGxfc3RyICk7XHJcblxyXG5cdGZvciAoIGxldCBpID0gMDsgaSA8IGZpZWxkc19hcnIubGVuZ3RoOyBpKysgKXtcclxuXHRcdGpRdWVyeSggJ1tuYW1lPVwiJyArIGZpZWxkc19hcnJbIGkgXVsgJ25hbWUnIF0gKyAnXCJdJyApLnZhbCggZmllbGRzX2FyclsgaSBdWyAndmFsdWUnIF0gKTtcclxuXHR9XHJcbn1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgZGF0YSBmcm9tICBnZXQgcGFyYW1ldGVyOlx0P3dwYmNfYXV0b19maWxsPXZpc2l0b3JzMjMxXjJ+bWF4X2NhcGFjaXR5MjMxXjJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRhX3N0ciAgICAgID0gICAndmlzaXRvcnMyMzFeMn5tYXhfY2FwYWNpdHkyMzFeMic7XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHNfX3BhcnNlKCBkYXRhX3N0ciApe1xyXG5cclxuXHRcdHZhciBmaWx0ZXJfb3B0aW9uc19hcnIgPSBbXTtcclxuXHJcblx0XHR2YXIgZGF0YV9hcnIgPSBkYXRhX3N0ci5zcGxpdCggJ34nICk7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0YV9hcnIubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdHZhciBteV9mb3JtX2ZpZWxkID0gZGF0YV9hcnJbIGogXS5zcGxpdCggJ14nICk7XHJcblxyXG5cdFx0XHR2YXIgZmlsdGVyX25hbWUgID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDAgXSkpID8gbXlfZm9ybV9maWVsZFsgMCBdIDogJyc7XHJcblx0XHRcdHZhciBmaWx0ZXJfdmFsdWUgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMSBdKSkgPyBteV9mb3JtX2ZpZWxkWyAxIF0gOiAnJztcclxuXHJcblx0XHRcdGZpbHRlcl9vcHRpb25zX2Fyci5wdXNoKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgOiBmaWx0ZXJfbmFtZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZScgOiBmaWx0ZXJfdmFsdWVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQgICApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZpbHRlcl9vcHRpb25zX2FycjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIGRhdGEgZnJvbSAgZ2V0IHBhcmFtZXRlcjpcdD9zZWFyY2hfZ2V0X19jdXN0b21fcGFyYW1zPS4uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGFfc3RyICAgICAgPSAgICd0ZXh0XnNlYXJjaF9maWVsZF9fZGlzcGxheV9jaGVja19pbl4yMy4wNS4yMDI0fnRleHRec2VhcmNoX2ZpZWxkX19kaXNwbGF5X2NoZWNrX291dF4yNi4wNS4yMDI0fnNlbGVjdGJveC1vbmVec2VhcmNoX3F1YW50aXR5XjJ+c2VsZWN0Ym94LW9uZV5sb2NhdGlvbl5TcGFpbn5zZWxlY3Rib3gtb25lXm1heF9jYXBhY2l0eV4yfnNlbGVjdGJveC1vbmVeYW1lbml0eV5wYXJraW5nfmNoZWNrYm94XnNlYXJjaF9maWVsZF9fZXh0ZW5kX3NlYXJjaF9kYXlzXjV+c3VibWl0Xl5TZWFyY2h+aGlkZGVuXnNlYXJjaF9nZXRfX2NoZWNrX2luX3ltZF4yMDI0LTA1LTIzfmhpZGRlbl5zZWFyY2hfZ2V0X19jaGVja19vdXRfeW1kXjIwMjQtMDUtMjZ+aGlkZGVuXnNlYXJjaF9nZXRfX3RpbWVefmhpZGRlbl5zZWFyY2hfZ2V0X19xdWFudGl0eV4yfmhpZGRlbl5zZWFyY2hfZ2V0X19leHRlbmReNX5oaWRkZW5ec2VhcmNoX2dldF9fdXNlcnNfaWRefmhpZGRlbl5zZWFyY2hfZ2V0X19jdXN0b21fcGFyYW1zXn4nO1xyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYXV0b19maWxsX3NlYXJjaF9maWVsZHNfX3BhcnNlKCBkYXRhX3N0ciApe1xyXG5cclxuXHRcdHZhciBmaWx0ZXJfb3B0aW9uc19hcnIgPSBbXTtcclxuXHJcblx0XHR2YXIgZGF0YV9hcnIgPSBkYXRhX3N0ci5zcGxpdCggJ34nICk7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0YV9hcnIubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdHZhciBteV9mb3JtX2ZpZWxkID0gZGF0YV9hcnJbIGogXS5zcGxpdCggJ14nICk7XHJcblxyXG5cdFx0XHR2YXIgZmlsdGVyX3R5cGUgID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDAgXSkpID8gbXlfZm9ybV9maWVsZFsgMCBdIDogJyc7XHJcblx0XHRcdHZhciBmaWx0ZXJfbmFtZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMSBdKSkgPyBteV9mb3JtX2ZpZWxkWyAxIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl92YWx1ZSA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAyIF0pKSA/IG15X2Zvcm1fZmllbGRbIDIgXSA6ICcnO1xyXG5cclxuXHRcdFx0ZmlsdGVyX29wdGlvbnNfYXJyLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICA6IGZpbHRlcl90eXBlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICA6IGZpbHRlcl9uYW1lLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlJyA6IGZpbHRlcl92YWx1ZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCAgICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmlsdGVyX29wdGlvbnNfYXJyO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBBdXRvIFVwZGF0ZSBudW1iZXIgb2YgbW9udGhzIGluIGNhbGVuZGFycyBPTiBzY3JlZW4gc2l6ZSBjaGFuZ2VkICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBBdXRvIFVwZGF0ZSBOdW1iZXIgb2YgTW9udGhzIGluIENhbGVuZGFyLCBlLmcuOiAgXHRcdGlmICAgICggV0lORE9XX1dJRFRIIDw9IDc4MnB4ICkgICA+Pj4gXHRNT05USFNfTlVNQkVSID0gMVxyXG4gKiAgIEVMU0U6ICBudW1iZXIgb2YgbW9udGhzIGRlZmluZWQgaW4gc2hvcnRjb2RlLlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgaW50XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyX19vbl9yZXNpemUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdGlmICggdHJ1ZSA9PT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfYWxsb3dfc2V2ZXJhbF9tb250aHNfb25fbW9iaWxlJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID0gcGFyc2VJbnQoIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycgKSApO1xyXG5cclxuXHRpZiAoIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID4gMSApe1xyXG5cclxuXHRcdGlmICggalF1ZXJ5KCB3aW5kb3cgKS53aWR0aCgpIDw9IDc4MiApe1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIDEgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9tb250aHNfbnVtYmVyKCByZXNvdXJjZV9pZCwgbG9jYWxfX251bWJlcl9vZl9tb250aHMgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQXV0byBVcGRhdGUgTnVtYmVyIG9mIE1vbnRocyBpbiAgIEFMTCAgIENhbGVuZGFyc1xyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcnNfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXIoKXtcclxuXHJcblx0dmFyIGFsbF9jYWxlbmRhcnNfYXJyID0gX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0KCk7XHJcblxyXG5cdC8vIFRoaXMgTE9PUCBcImZvciBpblwiIGlzIEdPT0QsIGJlY2F1c2Ugd2UgY2hlY2sgIGhlcmUga2V5cyAgICAnY2FsZW5kYXJfJyA9PT0gY2FsZW5kYXJfaWQuc2xpY2UoIDAsIDkgKVxyXG5cdGZvciAoIHZhciBjYWxlbmRhcl9pZCBpbiBhbGxfY2FsZW5kYXJzX2FyciApe1xyXG5cdFx0aWYgKCAnY2FsZW5kYXJfJyA9PT0gY2FsZW5kYXJfaWQuc2xpY2UoIDAsIDkgKSApe1xyXG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggY2FsZW5kYXJfaWQuc2xpY2UoIDkgKSApO1x0XHRcdC8vICAnY2FsZW5kYXJfMycgLT4gM1xyXG5cdFx0XHRpZiAoIHJlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXJfX29uX3Jlc2l6ZSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIElmIGJyb3dzZXIgd2luZG93IGNoYW5nZWQsICB0aGVuICB1cGRhdGUgbnVtYmVyIG9mIG1vbnRocy5cclxuICovXHJcbmpRdWVyeSggd2luZG93ICkub24oICdyZXNpemUnLCBmdW5jdGlvbiAoKXtcclxuXHR3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpO1xyXG59ICk7XHJcblxyXG4vKipcclxuICogQXV0byB1cGRhdGUgY2FsZW5kYXIgbnVtYmVyIG9mIG1vbnRocyBvbiBpbml0aWFsIHBhZ2UgbG9hZFxyXG4gKi9cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHR3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpO1xyXG5cdH0sIDEwMCApO1xyXG59KTtcclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIENoZWNrOiBjYWxlbmRhcl9kYXRlc19zdGFydDogXCIyMDI2LTAxLTAxXCIsIGNhbGVuZGFyX2RhdGVzX2VuZDogXCIyMDI2LTEyLTMxXCIgPT0gIC8vIEZpeEluOiAxMC4xMy4xLjQuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cdC8qKlxyXG5cdCAqIEdldCBTdGFydCBKUyBEYXRlIG9mIHN0YXJ0aW5nIGRhdGVzIGluIGNhbGVuZGFyLCBmcm9tIHRoZSBfd3BiYyBvYmplY3QuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gaW50ZWdlciByZXNvdXJjZV9pZCAtIHJlc291cmNlIElELCBlLmcuOiAxLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19zdGFydCggcmVzb3VyY2VfaWQgKSB7XHJcblx0XHRyZXR1cm4gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVfcGFyYW1ldGVyKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX2RhdGVzX3N0YXJ0JyApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IEVuZCBKUyBEYXRlIG9mIGVuZGluZyBkYXRlcyBpbiBjYWxlbmRhciwgZnJvbSB0aGUgX3dwYmMgb2JqZWN0LlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGludGVnZXIgcmVzb3VyY2VfaWQgLSByZXNvdXJjZSBJRCwgZS5nLjogMS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZXNfZW5kKHJlc291cmNlX2lkKSB7XHJcblx0XHRyZXR1cm4gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVfcGFyYW1ldGVyKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX2RhdGVzX2VuZCcgKTtcclxuXHR9XHJcblxyXG4vKipcclxuICogR2V0IHZhbGlkYXRlcyBkYXRlIHBhcmFtZXRlci5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkICAgLSAxXHJcbiAqIEBwYXJhbSBwYXJhbWV0ZXJfc3RyIC0gJ2NhbGVuZGFyX2RhdGVzX3N0YXJ0JyB8ICdjYWxlbmRhcl9kYXRlc19lbmQnIHwgLi4uXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19nZXRfZGF0ZV9wYXJhbWV0ZXIocmVzb3VyY2VfaWQsIHBhcmFtZXRlcl9zdHIpIHtcclxuXHJcblx0dmFyIGRhdGVfZXhwZWN0ZWRfeW1kID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsIHBhcmFtZXRlcl9zdHIgKTtcclxuXHJcblx0aWYgKCAhIGRhdGVfZXhwZWN0ZWRfeW1kICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAvLyAnJyB8IDAgfCBudWxsIHwgdW5kZWZpbmVkICAtPiBmYWxzZS5cclxuXHR9XHJcblxyXG5cdGlmICggLTEgIT09IGRhdGVfZXhwZWN0ZWRfeW1kLmluZGV4T2YoICctJyApICkge1xyXG5cclxuXHRcdHZhciBkYXRlX2V4cGVjdGVkX3ltZF9hcnIgPSBkYXRlX2V4cGVjdGVkX3ltZC5zcGxpdCggJy0nICk7XHQvLyAnMjAyNS0wNy0yNicgLT4gWycyMDI1JywgJzA3JywgJzI2J11cclxuXHJcblx0XHRpZiAoIGRhdGVfZXhwZWN0ZWRfeW1kX2Fyci5sZW5ndGggPiAwICkge1xyXG5cdFx0XHR2YXIgeWVhciAgPSAoZGF0ZV9leHBlY3RlZF95bWRfYXJyLmxlbmd0aCA+IDApID8gcGFyc2VJbnQoIGRhdGVfZXhwZWN0ZWRfeW1kX2FyclswXSApIDogbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpO1x0Ly8gWWVhci5cclxuXHRcdFx0dmFyIG1vbnRoID0gKGRhdGVfZXhwZWN0ZWRfeW1kX2Fyci5sZW5ndGggPiAxKSA/IChwYXJzZUludCggZGF0ZV9leHBlY3RlZF95bWRfYXJyWzFdICkgLSAxKSA6IDA7ICAvLyAobW9udGggLSAxKSBvciAwIC0gSmFuLlxyXG5cdFx0XHR2YXIgZGF5ICAgPSAoZGF0ZV9leHBlY3RlZF95bWRfYXJyLmxlbmd0aCA+IDIpID8gcGFyc2VJbnQoIGRhdGVfZXhwZWN0ZWRfeW1kX2FyclsyXSApIDogMTsgIC8vIGRhdGUgb3IgT3RoZXJ3aXNlIDFzdCBvZiBtb250aFxyXG5cclxuXHRcdFx0dmFyIGRhdGVfanMgPSBuZXcgRGF0ZSggeWVhciwgbW9udGgsIGRheSwgMCwgMCwgMCwgMCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIGRhdGVfanM7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gZmFsc2U7ICAvLyBGYWxsYmFjaywgIGlmIHdlIG5vdCBwYXJzZWQgdGhpcyBwYXJhbWV0ZXIgICdjYWxlbmRhcl9kYXRlc19zdGFydCcgPSAnMjAyNS0wNy0yNicsICBmb3IgZXhhbXBsZSBiZWNhdXNlIG9mICdjYWxlbmRhcl9kYXRlc19zdGFydCcgPSAnc2ZzZGYnLlxyXG59IiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2NhbC9kYXlzX3NlbGVjdF9jdXN0b20uanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vLyBGaXhJbjogOS44LjkuMi5cclxuXHJcbi8qKlxyXG4gKiBSZS1Jbml0IENhbGVuZGFyIGFuZCBSZS1SZW5kZXIgaXQuXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIFJlbW92ZSBDTEFTUyAgZm9yIGFiaWxpdHkgdG8gcmUtcmVuZGVyIGFuZCByZWluaXQgY2FsZW5kYXIuXHJcblx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5yZW1vdmVDbGFzcyggJ2hhc0RhdGVwaWNrJyApO1xyXG5cdHdwYmNfY2FsZW5kYXJfc2hvdyggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBSZS1Jbml0IHByZXZpb3VzbHkgIHNhdmVkIGRheXMgc2VsZWN0aW9uICB2YXJpYWJsZXMuXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnc2F2ZWRfdmFyaWFibGVfX19kYXlzX3NlbGVjdF9pbml0aWFsJ1xyXG5cdFx0LCB7XHJcblx0XHRcdCdkeW5hbWljX19kYXlzX21pbicgICAgICAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21pbicgKSxcclxuXHRcdFx0J2R5bmFtaWNfX2RheXNfbWF4JyAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWF4JyApLFxyXG5cdFx0XHQnZHluYW1pY19fZGF5c19zcGVjaWZpYycgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19zcGVjaWZpYycgKSxcclxuXHRcdFx0J2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnICksXHJcblx0XHRcdCdmaXhlZF9fZGF5c19udW0nICAgICAgICAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdmaXhlZF9fZGF5c19udW0nICksXHJcblx0XHRcdCdmaXhlZF9fd2Vla19kYXlzX19zdGFydCcgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdmaXhlZF9fd2Vla19kYXlzX19zdGFydCcgKVxyXG5cdFx0fVxyXG5cdCk7XHJcbn1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNldCBTaW5nbGUgRGF5IHNlbGVjdGlvbiAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgU2luZ2xlIERheSBzZWxlY3Rpb25cclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdzaW5nbGUnfSApO1xyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IE11bHRpcGxlIERheXMgc2VsZWN0aW9uICAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNldCBNdWx0aXBsZSBEYXlzIHNlbGVjdGlvblxyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnbXVsdGlwbGUnfSApO1xyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNldCBGaXhlZCBEYXlzIHNlbGVjdGlvbiB3aXRoICAxIG1vdXNlIGNsaWNrICAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgLS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpIC1cclxuICogQGludGVnZXIgZGF5c19udW1iZXJcdFx0XHQtIDNcdFx0XHRcdCAgIC0tIG51bWJlciBvZiBkYXlzIHRvICBzZWxlY3RcdC1cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdC0gWy0xXSB8IFsgMSwgNV0gICAtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fZml4ZWQoIHJlc291cmNlX2lkLCBkYXlzX251bWJlciwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZCggcmVzb3VyY2VfaWQsIGRheXNfbnVtYmVyLCB3ZWVrX2RheXNfX3N0YXJ0ICk7XHJcblxyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2V0IEZpeGVkIERheXMgc2VsZWN0aW9uIHdpdGggIDEgbW91c2UgY2xpY2tcclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKSAtXHJcbiAqIEBpbnRlZ2VyIGRheXNfbnVtYmVyXHRcdFx0LSAzXHRcdFx0XHQgICAtLSBudW1iZXIgb2YgZGF5cyB0byAgc2VsZWN0XHQtXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHQtIFstMV0gfCBbIDEsIDVdICAgLS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkKCByZXNvdXJjZV9pZCwgZGF5c19udW1iZXIsIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdmaXhlZCd9ICk7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZml4ZWRfX2RheXNfbnVtJzogcGFyc2VJbnQoIGRheXNfbnVtYmVyICl9ICk7XHRcdFx0Ly8gTnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uIHdpdGggMSBtb3VzZSBjbGlja1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnOiB3ZWVrX2RheXNfX3N0YXJ0fSApOyBcdC8vIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IFJhbmdlIERheXMgc2VsZWN0aW9uICB3aXRoICAyIG1vdXNlIGNsaWNrcyAgLSBhZnRlciBwYWdlIGxvYWRcclxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIFx0XHQtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcilcclxuICogQGludGVnZXIgZGF5c19taW5cdFx0XHQtIDdcdFx0XHRcdCAgIFx0XHQtLSBNaW4gbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBpbnRlZ2VyIGRheXNfbWF4XHRcdFx0LSAzMFx0XHRcdCAgIFx0XHQtLSBNYXggbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBhcnJheSBkYXlzX3NwZWNpZmljXHRcdFx0LSBbXSB8IFs3LDE0LDIxLDI4XVx0XHQtLSBSZXN0cmljdGlvbiBmb3IgU3BlY2lmaWMgbnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHRcdC0gWy0xXSB8IFsgMSwgNV0gICBcdFx0LS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX3JhbmdlKCByZXNvdXJjZV9pZCwgZGF5c19taW4sIGRheXNfbWF4LCBkYXlzX3NwZWNpZmljID0gW10sIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2UoIHJlc291cmNlX2lkLCBkYXlzX21pbiwgZGF5c19tYXgsIGRheXNfc3BlY2lmaWMsIHdlZWtfZGF5c19fc3RhcnQgKTtcclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IFJhbmdlIERheXMgc2VsZWN0aW9uICB3aXRoICAyIG1vdXNlIGNsaWNrc1xyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgXHRcdC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKVxyXG4gKiBAaW50ZWdlciBkYXlzX21pblx0XHRcdC0gN1x0XHRcdFx0ICAgXHRcdC0tIE1pbiBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGludGVnZXIgZGF5c19tYXhcdFx0XHQtIDMwXHRcdFx0ICAgXHRcdC0tIE1heCBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGFycmF5IGRheXNfc3BlY2lmaWNcdFx0XHQtIFtdIHwgWzcsMTQsMjEsMjhdXHRcdC0tIFJlc3RyaWN0aW9uIGZvciBTcGVjaWZpYyBudW1iZXIgb2YgZGF5cyBzZWxlY3Rpb25cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdFx0LSBbLTFdIHwgWyAxLCA1XSAgIFx0XHQtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmFuZ2UoIHJlc291cmNlX2lkLCBkYXlzX21pbiwgZGF5c19tYXgsIGRheXNfc3BlY2lmaWMgPSBbXSwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCAgcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdkeW5hbWljJ30gICk7XHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21pbicgICAgICAgICAsIHBhcnNlSW50KCBkYXlzX21pbiApICApOyAgICAgICAgICAgXHRcdC8vIE1pbi4gTnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uIHdpdGggMiBtb3VzZSBjbGlja3NcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWF4JyAgICAgICAgICwgcGFyc2VJbnQoIGRheXNfbWF4ICkgICk7ICAgICAgICAgIFx0XHQvLyBNYXguIE51bWJlciBvZiBkYXlzIHNlbGVjdGlvbiB3aXRoIDIgbW91c2UgY2xpY2tzXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJyAgICAsIGRheXNfc3BlY2lmaWMgICk7XHQgICAgICBcdFx0XHRcdC8vIEV4YW1wbGUgWzUsN11cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX3dlZWtfZGF5c19fc3RhcnQnICwgd2Vla19kYXlzX19zdGFydCAgKTsgIFx0XHRcdFx0XHQvLyB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuIiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2NhbF9hanhfbG9hZC93cGJjX2NhbF9hanguanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gIEEgaiBhIHggICAgTCBvIGEgZCAgICBDIGEgbCBlIG4gZCBhIHIgICAgRCBhIHQgYVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4KCBwYXJhbXMgKXtcclxuXHJcblx0Ly8gRml4SW46IDkuOC42LjIuXHJcblx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RhcnQoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApO1xyXG5cclxuXHQvLyBUcmlnZ2VyIGV2ZW50IGZvciBjYWxlbmRhciBiZWZvcmUgbG9hZGluZyBCb29raW5nIGRhdGEsICBidXQgYWZ0ZXIgc2hvd2luZyBDYWxlbmRhci5cclxuXHRpZiAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApLmxlbmd0aCA+IDAgKXtcclxuXHRcdHZhciB0YXJnZXRfZWxtID0galF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCBcIndwYmNfY2FsZW5kYXJfYWp4X19iZWZvcmVfbG9hZGVkX2RhdGFcIiwgW3BhcmFtc1sncmVzb3VyY2VfaWQnXV0gKTtcclxuXHRcdCAvL2pRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fYmVmb3JlX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24oIGV2ZW50LCByZXNvdXJjZV9pZCApIHsgLi4uIH0gKTtcclxuXHR9XHJcblxyXG5cdGlmICggd3BiY19iYWxhbmNlcl9faXNfd2FpdCggcGFyYW1zICwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApICl7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvLyBGaXhJbjogOS44LjYuMi5cclxuXHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdG9wKCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyA9PSBHZXQgc3RhcnQgLyBlbmQgZGF0ZXMgZnJvbSAgdGhlIEJvb2tpbmcgQ2FsZW5kYXIgc2hvcnRjb2RlLiA9PVxyXG5cdC8vIEV4YW1wbGU6IFtib29raW5nIGNhbGVuZGFyX2RhdGVzX3N0YXJ0PScyMDI2LTAxLTAxJyBjYWxlbmRhcl9kYXRlc19lbmQ9JzIwMjYtMTItMzEnICByZXNvdXJjZV9pZD0xXSAgICAgICAgICAgICAgLy8gRml4SW46IDEwLjEzLjEuNC5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGlmICggZmFsc2UgIT09IHdwYmNfY2FsZW5kYXJfX2dldF9kYXRlc19zdGFydCggcGFyYW1zWydyZXNvdXJjZV9pZCddICkgKSB7XHJcblx0XHRpZiAoICEgcGFyYW1zWydkYXRlc190b19jaGVjayddICkgeyBwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ10gPSBbXTsgfVxyXG5cdFx0dmFyIGRhdGVzX3N0YXJ0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX3N0YXJ0KCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKTsgIC8vIEUuZy4gLSBsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggMjAyNSwgMCwgMSApO1xyXG5cdFx0aWYgKCBmYWxzZSAhPT0gZGF0ZXNfc3RhcnQgKXtcclxuXHRcdFx0cGFyYW1zWydkYXRlc190b19jaGVjayddWzBdID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfc3RhcnQgKTtcclxuXHRcdH1cclxuXHR9XHJcblx0aWYgKCBmYWxzZSAhPT0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcGFyYW1zWydyZXNvdXJjZV9pZCddICkgKSB7XHJcblx0XHRpZiAoICFwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ10gKSB7IHBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXSA9IFtdOyB9XHJcblx0XHR2YXIgZGF0ZXNfZW5kID0gd3BiY19jYWxlbmRhcl9fZ2V0X2RhdGVzX2VuZCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7ICAvLyBFLmcuIC0gbG9jYWxfX21pbl9kYXRlID0gbmV3IERhdGUoIDIwMjUsIDAsIDEgKTtcclxuXHRcdGlmICggZmFsc2UgIT09IGRhdGVzX2VuZCApIHtcclxuXHRcdFx0cGFyYW1zWydkYXRlc190b19jaGVjayddWzFdID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfZW5kICk7XHJcblx0XHRcdGlmICggIXBhcmFtc1snZGF0ZXNfdG9fY2hlY2snXVswXSApIHtcclxuXHRcdFx0XHRwYXJhbXNbJ2RhdGVzX3RvX2NoZWNrJ11bMF0gPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBuZXcgRGF0ZSgpICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8vIGNvbnNvbGUuZ3JvdXBFbmQoKTsgY29uc29sZS50aW1lKCdyZXNvdXJjZV9pZF8nICsgcGFyYW1zWydyZXNvdXJjZV9pZCddKTtcclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnICk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBjYWxlbmRhcnNfYWxsX19nZXQoKSA9PSAnICwgX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0KCkgKTtcclxuXHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcikgKSB7XHJcblx0XHR3cGJjX2hvb2tfX2luaXRfdGltZXNlbGVjdG9yKCk7XHJcblx0fVxyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbm9uY2UnICksXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGUgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zIDogcGFyYW1zIFx0XHRcdFx0XHRcdC8vIFVzdWFsbHkgbGlrZTogeyAncmVzb3VyY2VfaWQnOiAxLCAnbWF4X2RheXNfY291bnQnOiAzNjUgfVxyXG5cdFx0XHRcdH0sXHJcblxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNoLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuLy8gY29uc29sZS50aW1lRW5kKCdyZXNvdXJjZV9pZF8nICsgcmVzcG9uc2VfZGF0YVsncmVzb3VyY2VfaWQnXSk7XHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0NBTEVOREFSX0xPQUQgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gRml4SW46IDkuOC42LjIuXHJcblx0XHRcdFx0XHR2YXIgYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHR3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQoIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkICwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFByb2JhYmx5IEVycm9yXHJcblx0XHRcdFx0XHRpZiAoICh0eXBlb2YgcmVzcG9uc2VfZGF0YSAhPT0gJ29iamVjdCcpIHx8IChyZXNwb25zZV9kYXRhID09PSBudWxsKSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHRcdHZhciBtZXNzYWdlX3R5cGUgPSAnaW5mbyc7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICcnID09PSByZXNwb25zZV9kYXRhICl7XHJcblx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSA9ICdUaGUgc2VydmVyIHJlc3BvbmRzIHdpdGggYW4gZW1wdHkgc3RyaW5nLiBUaGUgc2VydmVyIHByb2JhYmx5IHN0b3BwZWQgd29ya2luZyB1bmV4cGVjdGVkbHkuIDxicj5QbGVhc2UgY2hlY2sgeW91ciA8c3Ryb25nPmVycm9yLmxvZzwvc3Ryb25nPiBpbiB5b3VyIHNlcnZlciBjb25maWd1cmF0aW9uIGZvciByZWxhdGl2ZSBlcnJvcnMuJztcclxuXHRcdFx0XHRcdFx0XHRtZXNzYWdlX3R5cGUgPSAnd2FybmluZyc7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhICwgeyAndHlwZScgICAgIDogbWVzc2FnZV90eXBlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBDYWxlbmRhclxyXG5cdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RvcCggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0Ly8gQm9va2luZ3MgLSBEYXRlc1xyXG5cdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWydkYXRlcyddICApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEJvb2tpbmdzIC0gQ2hpbGQgb3Igb25seSBzaW5nbGUgYm9va2luZyByZXNvdXJjZSBpbiBkYXRlc1xyXG5cdFx0XHRcdFx0X3dwYmMuYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWdncmVnYXRlIGJvb2tpbmcgcmVzb3VyY2VzLCAgaWYgYW55ID9cclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInIF0gKTtcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRcdFx0XHQvLyBVcGRhdGUgY2FsZW5kYXJcclxuXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblx0XHRcdFx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19ob29rX19pbml0X3RpbWVzZWxlY3RvcikgKSB7XHJcblx0XHRcdFx0XHRcdHdwYmNfaG9va19faW5pdF90aW1lc2VsZWN0b3IoKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdFx0KCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChyZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0pIClcclxuXHRcdFx0XHRcdFx0ICYmICggJycgIT0gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApIClcclxuXHRcdFx0XHRcdCl7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHJcblx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7ICAgJ3R5cGUnICAgICA6ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSApIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnaW5mbycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAxMDAwMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFRyaWdnZXIgZXZlbnQgdGhhdCBjYWxlbmRhciBoYXMgYmVlblx0XHQgLy8gRml4SW46IDEwLjAuMC40NC5cclxuXHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICkubGVuZ3RoID4gMCApe1xyXG5cdFx0XHRcdFx0XHR2YXIgdGFyZ2V0X2VsbSA9IGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggXCJ3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGFcIiwgW3Jlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXV0gKTtcclxuXHRcdFx0XHRcdFx0IC8valF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uKCBldmVudCwgcmVzb3VyY2VfaWQgKSB7IC4uLiB9ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly9qUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cclxuXHRcdFx0XHRcdHZhciBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCB0aGlzLmRhdGEgKTtcclxuXHRcdFx0XHRcdHdwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCggYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgLCAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gR2V0IENvbnRlbnQgb2YgRXJyb3IgTWVzc2FnZVxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKDxiPicgKyBqcVhIUi5zdGF0dXMgKyAnPC9iPiknO1xyXG5cdFx0XHRcdFx0XHRpZiAoNDAzID09IGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJzxicj4gUHJvYmFibHkgbm9uY2UgZm9yIHRoaXMgcGFnZSBoYXMgYmVlbiBleHBpcmVkLiBQbGVhc2UgPGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIG9uY2xpY2s9XCJqYXZhc2NyaXB0OmxvY2F0aW9uLnJlbG9hZCgpO1wiPnJlbG9hZCB0aGUgcGFnZTwvYT4uJztcclxuXHRcdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICc8YnI+IE90aGVyd2lzZSwgcGxlYXNlIGNoZWNrIHRoaXMgPGEgc3R5bGU9XCJmb250LXdlaWdodDogNjAwO1wiIGhyZWY9XCJodHRwczovL3dwYm9va2luZ2NhbGVuZGFyLmNvbS9mYXEvcmVxdWVzdC1kby1ub3QtcGFzcy1zZWN1cml0eS1jaGVjay8/YWZ0ZXJfdXBkYXRlPTEwLjEuMVwiPnRyb3VibGVzaG9vdGluZyBpbnN0cnVjdGlvbjwvYT4uPGJyPidcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dmFyIG1lc3NhZ2Vfc2hvd19kZWxheSA9IDMwMDA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgJyArIGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdFx0bWVzc2FnZV9zaG93X2RlbGF5ID0gMTA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHR2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHJcblx0XHRcdFx0XHQvKipcclxuXHRcdFx0XHRcdCAqIElmIHdlIG1ha2UgZmFzdCBjbGlja2luZyBvbiBkaWZmZXJlbnQgcGFnZXMsXHJcblx0XHRcdFx0XHQgKiB0aGVuIHVuZGVyIGNhbGVuZGFyIHdpbGwgc2hvdyBlcnJvciBtZXNzYWdlIHdpdGggIGVtcHR5ICB0ZXh0LCBiZWNhdXNlIGFqYXggd2FzIG5vdCByZWNlaXZlZC5cclxuXHRcdFx0XHRcdCAqIFRvICBub3Qgc2hvdyBzdWNoIHdhcm5pbmdzIHdlIGFyZSBzZXQgZGVsYXkgIGluIDMgc2Vjb25kcy4gIHZhciBtZXNzYWdlX3Nob3dfZGVsYXkgPSAzMDAwO1xyXG5cdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgLCB7ICd0eXBlJyAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9ICxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIHBhcnNlSW50KCBtZXNzYWdlX3Nob3dfZGVsYXkgKSAgICk7XHJcblxyXG5cdFx0XHQgIH0pXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG59XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBTdXBwb3J0XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgQ2FsZW5kYXIgalF1ZXJ5IG5vZGUgZm9yIHNob3dpbmcgbWVzc2FnZXMgZHVyaW5nIEFqYXhcclxuXHQgKiBUaGlzIHBhcmFtZXRlcjogICBjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0gICBwYXJzZWQgZnJvbSB0aGlzLmRhdGEgQWpheCBwb3N0ICBkYXRhXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zXHRcdCAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVx0JycjY2FsZW5kYXJfYm9va2luZzEnICB8ICAgJy5ib29raW5nX2Zvcm1fZGl2JyAuLi5cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGUgICAgdmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICl7XHJcblxyXG5cdFx0dmFyIGpxX25vZGUgPSAnLmJvb2tpbmdfZm9ybV9kaXYnO1xyXG5cclxuXHRcdHZhciBjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKTtcclxuXHJcblx0XHRpZiAoIGNhbGVuZGFyX3Jlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRqcV9ub2RlID0gJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3Jlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBqcV9ub2RlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCByZXNvdXJjZSBJRCBmcm9tIGFqeCBwb3N0IGRhdGEgdXJsICAgdXN1YWxseSAgZnJvbSAgdGhpcy5kYXRhICA9ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtc1x0XHQgJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0ICogQHJldHVybnMge2ludH1cdFx0XHRcdFx0XHQgMSB8IDAgIChpZiBlcnJyb3IgdGhlbiAgMClcclxuXHQgKlxyXG5cdCAqIEV4YW1wbGUgICAgdmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApe1xyXG5cclxuXHRcdC8vIEdldCBib29raW5nIHJlc291cmNlIElEIGZyb20gQWpheCBQb3N0IFJlcXVlc3QgIC0+IHRoaXMuZGF0YSA9ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdFx0dmFyIGNhbGVuZGFyX3Jlc291cmNlX2lkID0gd3BiY19nZXRfdXJpX3BhcmFtX2J5X25hbWUoICdjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0nLCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKTtcclxuXHRcdGlmICggKG51bGwgIT09IGNhbGVuZGFyX3Jlc291cmNlX2lkKSAmJiAoJycgIT09IGNhbGVuZGFyX3Jlc291cmNlX2lkKSApe1xyXG5cdFx0XHRjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHBhcnNlSW50KCBjYWxlbmRhcl9yZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRpZiAoIGNhbGVuZGFyX3Jlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRcdHJldHVybiBjYWxlbmRhcl9yZXNvdXJjZV9pZDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIDA7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IHBhcmFtZXRlciBmcm9tIFVSTCAgLSAgcGFyc2UgVVJMIHBhcmFtZXRlcnMsICBsaWtlIHRoaXM6IGFjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNcclxuXHQgKiBAcGFyYW0gbmFtZSAgcGFyYW1ldGVyICBuYW1lLCAgbGlrZSAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJ1xyXG5cdCAqIEBwYXJhbSB1cmxcdCdwYXJhbWV0ZXIgIHN0cmluZyBVUkwnXHJcblx0ICogQHJldHVybnMge3N0cmluZ3xudWxsfSAgIHBhcmFtZXRlciB2YWx1ZVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZTogXHRcdHdwYmNfZ2V0X3VyaV9wYXJhbV9ieV9uYW1lKCAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJywgdGhpcy5kYXRhICk7ICAtPiAnMidcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggbmFtZSwgdXJsICl7XHJcblxyXG5cdFx0dXJsID0gZGVjb2RlVVJJQ29tcG9uZW50KCB1cmwgKTtcclxuXHJcblx0XHRuYW1lID0gbmFtZS5yZXBsYWNlKCAvW1xcW1xcXV0vZywgJ1xcXFwkJicgKTtcclxuXHRcdHZhciByZWdleCA9IG5ldyBSZWdFeHAoICdbPyZdJyArIG5hbWUgKyAnKD0oW14mI10qKXwmfCN8JCknICksXHJcblx0XHRcdHJlc3VsdHMgPSByZWdleC5leGVjKCB1cmwgKTtcclxuXHRcdGlmICggIXJlc3VsdHMgKSByZXR1cm4gbnVsbDtcclxuXHRcdGlmICggIXJlc3VsdHNbIDIgXSApIHJldHVybiAnJztcclxuXHRcdHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoIHJlc3VsdHNbIDIgXS5yZXBsYWNlKCAvXFwrL2csICcgJyApICk7XHJcblx0fVxyXG4iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2Zyb250X2VuZF9tZXNzYWdlcy93cGJjX2ZlX21lc3NhZ2VzLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBTaG93IE1lc3NhZ2VzIGF0IEZyb250LUVkbiBzaWRlXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNob3cgbWVzc2FnZSBpbiBjb250ZW50XHJcbiAqXHJcbiAqIEBwYXJhbSBtZXNzYWdlXHRcdFx0XHRNZXNzYWdlIEhUTUxcclxuICogQHBhcmFtIHBhcmFtcyA9IHtcclxuICpcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICd3YXJuaW5nJyxcdFx0XHRcdFx0XHRcdC8vICdlcnJvcicgfCAnd2FybmluZycgfCAnaW5mbycgfCAnc3VjY2VzcydcclxuICpcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZScgOiAnJyxcdFx0XHRcdC8vIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICAgOiAnaW5zaWRlJ1x0XHQvLyAnaW5zaWRlJyB8ICdiZWZvcmUnIHwgJ2FmdGVyJyB8ICdyaWdodCcgfCAnbGVmdCdcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcdFx0XHRcdFx0XHRcdFx0Ly8gQXBwbHkgIG9ubHkgaWYgXHQnd2hlcmUnICAgOiAnaW5zaWRlJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFx0XHRcdFx0Ly8gc3R5bGVzLCBpZiBuZWVkZWRcclxuICpcdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcdFx0XHRcdFx0XHRcdFx0XHQvLyBob3cgbWFueSBtaWNyb3NlY29uZCB0byAgc2hvdywgIGlmIDAgIHRoZW4gIHNob3cgZm9yZXZlclxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IGZhbHNlXHRcdFx0XHRcdC8vIGlmIHRydWUsICB0aGVuIGRvIG5vdCBzaG93IG1lc3NhZ2UsICBpZiBwcmV2aW9zIG1lc3NhZ2Ugd2FzIG5vdCBoaWRlZCAobm90IGFwcGx5IGlmICd3aGVyZScgICA6ICdpbnNpZGUnIClcclxuICpcdFx0XHRcdH07XHJcbiAqIEV4YW1wbGVzOlxyXG4gKiBcdFx0XHR2YXIgaHRtbF9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoICdZb3UgY2FuIHRlc3QgZGF5cyBzZWxlY3Rpb24gaW4gY2FsZW5kYXInLCB7fSApO1xyXG4gKlxyXG4gKlx0XHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZCcgKSwgeyAndHlwZSc6ICd3YXJuaW5nJywgJ2RlbGF5JzogMTAwMDAsICdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3Nob3dfaGVyZSc6IHsnd2hlcmUnOiAncmlnaHQnLCAnanFfbm9kZSc6IGVsLH0gfSApO1xyXG4gKlxyXG4gKlx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyAgICd0eXBlJyAgICAgOiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gKSApXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnaW5mbycsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0JyxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMTAwMDBcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKlxyXG4gKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCBwYXJhbXMgPSB7fSApe1xyXG5cclxuXHR2YXIgcGFyYW1zX2RlZmF1bHQgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgIDogJ3dhcm5pbmcnLFx0XHRcdFx0XHRcdFx0Ly8gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJyB8ICdzdWNjZXNzJ1xyXG5cdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnIDogJycsXHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgICA6ICdpbnNpZGUnXHRcdC8vICdpbnNpZGUnIHwgJ2JlZm9yZScgfCAnYWZ0ZXInIHwgJ3JpZ2h0JyB8ICdsZWZ0J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIEFwcGx5ICBvbmx5IGlmIFx0J3doZXJlJyAgIDogJ2luc2lkZSdcclxuXHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHRcdFx0XHQvLyBzdHlsZXMsIGlmIG5lZWRlZFxyXG5cdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG5cdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHRcdFx0XHRcdFx0XHRcdFx0Ly8gaG93IG1hbnkgbWljcm9zZWNvbmQgdG8gIHNob3csICBpZiAwICB0aGVuICBzaG93IGZvcmV2ZXJcclxuXHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogZmFsc2UsXHRcdFx0XHRcdC8vIGlmIHRydWUsICB0aGVuIGRvIG5vdCBzaG93IG1lc3NhZ2UsICBpZiBwcmV2aW9zIG1lc3NhZ2Ugd2FzIG5vdCBoaWRlZCAobm90IGFwcGx5IGlmICd3aGVyZScgICA6ICdpbnNpZGUnIClcclxuXHRcdFx0XHRcdFx0XHRcdCdpc19zY3JvbGwnOiB0cnVlXHRcdFx0XHRcdFx0XHRcdC8vIGlzIHNjcm9sbCAgdG8gIHRoaXMgZWxlbWVudFxyXG5cdFx0XHRcdFx0XHR9O1xyXG5cdGZvciAoIHZhciBwX2tleSBpbiBwYXJhbXMgKXtcclxuXHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcGFyYW1zWyBwX2tleSBdO1xyXG5cdH1cclxuXHRwYXJhbXMgPSBwYXJhbXNfZGVmYXVsdDtcclxuXHJcbiAgICB2YXIgdW5pcXVlX2Rpdl9pZCA9IG5ldyBEYXRlKCk7XHJcbiAgICB1bmlxdWVfZGl2X2lkID0gJ3dwYmNfbm90aWNlXycgKyB1bmlxdWVfZGl2X2lkLmdldFRpbWUoKTtcclxuXHJcblx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZSc7XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnZXJyb3InICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX2Vycm9yJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yZXBvcnRfZ21haWxlcnJvcnJlZFwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnd2FybmluZycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2Vfd2FybmluZyc7XHJcblx0XHRtZXNzYWdlID0gJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fd2FybmluZ1wiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnaW5mbycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2VfaW5mbyc7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ3N1Y2Nlc3MnICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX3N1Y2Nlc3MnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RvbmVfb3V0bGluZVwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblxyXG5cdHZhciBzY3JvbGxfdG9fZWxlbWVudCA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnX3Njcm9sbFwiIHN0eWxlPVwiZGlzcGxheTpub25lO1wiPjwvZGl2Pic7XHJcblx0bWVzc2FnZSA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZSAnICsgcGFyYW1zWydjc3NfY2xhc3MnXSArICdcIiBzdHlsZT1cIicgKyBwYXJhbXNbICdzdHlsZScgXSArICdcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nO1xyXG5cclxuXHJcblx0dmFyIGpxX2VsX21lc3NhZ2UgPSBmYWxzZTtcclxuXHR2YXIgaXNfc2hvd19tZXNzYWdlID0gdHJ1ZTtcclxuXHJcblx0aWYgKCAnaW5zaWRlJyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRpZiAoIHBhcmFtc1sgJ2lzX2FwcGVuZCcgXSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hcHBlbmQoIHNjcm9sbF90b19lbGVtZW50ICk7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFwcGVuZCggbWVzc2FnZSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuaHRtbCggc2Nyb2xsX3RvX2VsZW1lbnQgKyBtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdH0gZWxzZSBpZiAoICdiZWZvcmUnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5zaWJsaW5ncyggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdH0gZWxzZSBpZiAoICdhZnRlcicgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLm5leHRBbGwoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHRcdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBiZWZvcmUoZm9yIGhhbmR5IHNjcm9sbClcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYWZ0ZXIoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ3JpZ2h0JyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkubmV4dEFsbCggJy53cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfcmlnaHQnICkuZmluZCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcdFx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGJlZm9yZShmb3IgaGFuZHkgc2Nyb2xsKVxyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hZnRlciggJzxkaXYgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfcmlnaHRcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nICk7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICggJ2xlZnQnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5zaWJsaW5ncyggJy53cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfbGVmdCcgKS5maW5kKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1x0XHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYmVmb3JlKGZvciBoYW5keSBzY3JvbGwpXHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggJzxkaXYgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfbGVmdFwiPicgKyBtZXNzYWdlICsgJzwvZGl2PicgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggICAoIGlzX3Nob3dfbWVzc2FnZSApICAmJiAgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSA+IDAgKSAgICl7XHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkuZmFkZU91dCggMTUwMCApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gLCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSAgICk7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lcjIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLnRyaWdnZXIoICdoaWRlJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sICggcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdICkgKyAxNTAxICkgKTtcclxuXHR9XHJcblxyXG5cdC8vIENoZWNrICBpZiBzaG93ZWQgbWVzc2FnZSBpbiBzb21lIGhpZGRlbiBwYXJlbnQgc2VjdGlvbiBhbmQgc2hvdyBpdC4gQnV0IGl0IG11c3QgIGJlIGxvd2VyIHRoYW4gJy53cGJjX2NvbnRhaW5lcidcclxuXHR2YXIgcGFyZW50X2VscyA9IGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLnBhcmVudHMoKS5tYXAoIGZ1bmN0aW9uICgpe1xyXG5cdFx0aWYgKCAoIWpRdWVyeSggdGhpcyApLmlzKCAndmlzaWJsZScgKSkgJiYgKGpRdWVyeSggJy53cGJjX2NvbnRhaW5lcicgKS5oYXMoIHRoaXMgKSkgKXtcclxuXHRcdFx0alF1ZXJ5KCB0aGlzICkuc2hvdygpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0aWYgKCBwYXJhbXNbICdpc19zY3JvbGwnIF0gKXtcclxuXHRcdHdwYmNfZG9fc2Nyb2xsKCAnIycgKyB1bmlxdWVfZGl2X2lkICsgJ19zY3JvbGwnICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdW5pcXVlX2Rpdl9pZDtcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRXJyb3IgbWVzc2FnZS4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3IoIGpxX25vZGUsIG1lc3NhZ2UgKXtcclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAncmlnaHQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRXJyb3IgbWVzc2FnZSBVTkRFUiBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcl91bmRlcl9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlLCBtZXNzYWdlX2RlbGF5ICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChtZXNzYWdlX2RlbGF5KSApe1xyXG5cdFx0XHRtZXNzYWdlX2RlbGF5ID0gMFxyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IG1lc3NhZ2VfZGVsYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVycm9yIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3JfYWJvdmVfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgbWVzc2FnZV9kZWxheSApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAobWVzc2FnZV9kZWxheSkgKXtcclxuXHRcdFx0bWVzc2FnZV9kZWxheSA9IDEwMDAwXHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogbWVzc2FnZV9kZWxheSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYmVmb3JlJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFdhcm5pbmcgbWVzc2FnZS4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZygganFfbm9kZSwgbWVzc2FnZSApe1xyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ3JpZ2h0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0d3BiY19oaWdobGlnaHRfZXJyb3Jfb25fZm9ybV9maWVsZCgganFfbm9kZSApO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFdhcm5pbmcgbWVzc2FnZSBVTkRFUiBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nX3VuZGVyX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UgKXtcclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UgQUJPVkUgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZ19hYm92ZV9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlICl7XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYmVmb3JlJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSGlnaGxpZ2h0IEVycm9yIGluIHNwZWNpZmljIGZpZWxkXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ganFfbm9kZVx0XHRcdFx0XHRzdHJpbmcgb3IgalF1ZXJ5IGVsZW1lbnQsICB3aGVyZSBzY3JvbGwgIHRvXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19oaWdobGlnaHRfZXJyb3Jfb25fZm9ybV9maWVsZCgganFfbm9kZSApe1xyXG5cclxuXHRcdGlmICggIWpRdWVyeSgganFfbm9kZSApLmxlbmd0aCApe1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRpZiAoICEgalF1ZXJ5KCBqcV9ub2RlICkuaXMoICc6aW5wdXQnICkgKXtcclxuXHRcdFx0Ly8gU2l0dWF0aW9uIHdpdGggIGNoZWNrYm94ZXMgb3IgcmFkaW8gIGJ1dHRvbnNcclxuXHRcdFx0dmFyIGpxX25vZGVfYXJyID0galF1ZXJ5KCBqcV9ub2RlICkuZmluZCggJzppbnB1dCcgKTtcclxuXHRcdFx0aWYgKCAhanFfbm9kZV9hcnIubGVuZ3RoICl7XHJcblx0XHRcdFx0cmV0dXJuXHJcblx0XHRcdH1cclxuXHRcdFx0anFfbm9kZSA9IGpxX25vZGVfYXJyLmdldCggMCApO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHBhcmFtcyA9IHt9O1xyXG5cdFx0cGFyYW1zWyAnZGVsYXknIF0gPSAxMDAwMDtcclxuXHJcblx0XHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5oYXNDbGFzcyggJ3dwYmNfZm9ybV9maWVsZF9lcnJvcicgKSApe1xyXG5cclxuXHRcdFx0alF1ZXJ5KCBqcV9ub2RlICkuYWRkQ2xhc3MoICd3cGJjX2Zvcm1fZmllbGRfZXJyb3InIClcclxuXHJcblx0XHRcdGlmICggcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdICkgPiAwICl7XHJcblx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgalF1ZXJ5KCBqcV9ub2RlICkucmVtb3ZlQ2xhc3MoICd3cGJjX2Zvcm1fZmllbGRfZXJyb3InICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgICwgcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG4vKipcclxuICogU2Nyb2xsIHRvIHNwZWNpZmljIGVsZW1lbnRcclxuICpcclxuICogQHBhcmFtIGpxX25vZGVcdFx0XHRcdFx0c3RyaW5nIG9yIGpRdWVyeSBlbGVtZW50LCAgd2hlcmUgc2Nyb2xsICB0b1xyXG4gKiBAcGFyYW0gZXh0cmFfc2hpZnRfb2Zmc2V0XHRcdGludCBzaGlmdCBvZmZzZXQgZnJvbSAganFfbm9kZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kb19zY3JvbGwoIGpxX25vZGUgLCBleHRyYV9zaGlmdF9vZmZzZXQgPSAwICl7XHJcblxyXG5cdGlmICggIWpRdWVyeSgganFfbm9kZSApLmxlbmd0aCApe1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHR2YXIgdGFyZ2V0T2Zmc2V0ID0galF1ZXJ5KCBqcV9ub2RlICkub2Zmc2V0KCkudG9wO1xyXG5cclxuXHRpZiAoIHRhcmdldE9mZnNldCA8PSAwICl7XHJcblx0XHRpZiAoIDAgIT0galF1ZXJ5KCBqcV9ub2RlICkubmV4dEFsbCggJzp2aXNpYmxlJyApLmxlbmd0aCApe1xyXG5cdFx0XHR0YXJnZXRPZmZzZXQgPSBqUXVlcnkoIGpxX25vZGUgKS5uZXh0QWxsKCAnOnZpc2libGUnICkuZmlyc3QoKS5vZmZzZXQoKS50b3A7XHJcblx0XHR9IGVsc2UgaWYgKCAwICE9IGpRdWVyeSgganFfbm9kZSApLnBhcmVudCgpLm5leHRBbGwoICc6dmlzaWJsZScgKS5sZW5ndGggKXtcclxuXHRcdFx0dGFyZ2V0T2Zmc2V0ID0galF1ZXJ5KCBqcV9ub2RlICkucGFyZW50KCkubmV4dEFsbCggJzp2aXNpYmxlJyApLmZpcnN0KCkub2Zmc2V0KCkudG9wO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCBqUXVlcnkoICcjd3BhZG1pbmJhcicgKS5sZW5ndGggPiAwICl7XHJcblx0XHR0YXJnZXRPZmZzZXQgPSB0YXJnZXRPZmZzZXQgLSA1MCAtIDUwO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0YXJnZXRPZmZzZXQgPSB0YXJnZXRPZmZzZXQgLSAyMCAtIDUwO1xyXG5cdH1cclxuXHR0YXJnZXRPZmZzZXQgKz0gZXh0cmFfc2hpZnRfb2Zmc2V0O1xyXG5cclxuXHQvLyBTY3JvbGwgb25seSAgaWYgd2UgZGlkIG5vdCBzY3JvbGwgYmVmb3JlXHJcblx0aWYgKCAhIGpRdWVyeSggJ2h0bWwsYm9keScgKS5pcyggJzphbmltYXRlZCcgKSApe1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCxib2R5JyApLmFuaW1hdGUoIHtzY3JvbGxUb3A6IHRhcmdldE9mZnNldH0sIDUwMCApO1xyXG5cdH1cclxufVxyXG5cclxuIiwiXHJcbi8vIEZpeEluOiAxMC4yLjAuNC5cclxuLyoqXHJcbiAqIERlZmluZSBQb3BvdmVycyBmb3IgVGltZWxpbmVzIGluIFdQIEJvb2tpbmcgQ2FsZW5kYXJcclxuICpcclxuICogQHJldHVybnMge3N0cmluZ3xib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kZWZpbmVfdGlwcHlfcG9wb3Zlcigpe1xyXG5cdGlmICggJ2Z1bmN0aW9uJyAhPT0gdHlwZW9mICh3cGJjX3RpcHB5KSApe1xyXG5cdFx0Y29uc29sZS5sb2coICdXUEJDIEVycm9yLiB3cGJjX3RpcHB5IHdhcyBub3QgZGVmaW5lZC4nICk7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cdHdwYmNfdGlwcHkoICcucG9wb3Zlcl9ib3R0b20ucG9wb3Zlcl9jbGljaycsIHtcclxuXHRcdGNvbnRlbnQoIHJlZmVyZW5jZSApe1xyXG5cdFx0XHR2YXIgcG9wb3Zlcl90aXRsZSA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLW9yaWdpbmFsLXRpdGxlJyApO1xyXG5cdFx0XHR2YXIgcG9wb3Zlcl9jb250ZW50ID0gcmVmZXJlbmNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtY29udGVudCcgKTtcclxuXHRcdFx0cmV0dXJuICc8ZGl2IGNsYXNzPVwicG9wb3ZlciBwb3BvdmVyX3RpcHB5XCI+J1xyXG5cdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJwb3BvdmVyLWNsb3NlXCI+PGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIG9uY2xpY2s9XCJqYXZhc2NyaXB0OnRoaXMucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50Ll90aXBweS5oaWRlKCk7XCIgPiZ0aW1lczs8L2E+PC9kaXY+J1xyXG5cdFx0XHRcdCsgcG9wb3Zlcl9jb250ZW50XHJcblx0XHRcdFx0KyAnPC9kaXY+JztcclxuXHRcdH0sXHJcblx0XHRhbGxvd0hUTUwgICAgICAgIDogdHJ1ZSxcclxuXHRcdHRyaWdnZXIgICAgICAgICAgOiAnbWFudWFsJyxcclxuXHRcdGludGVyYWN0aXZlICAgICAgOiB0cnVlLFxyXG5cdFx0aGlkZU9uQ2xpY2sgICAgICA6IGZhbHNlLFxyXG5cdFx0aW50ZXJhY3RpdmVCb3JkZXI6IDEwLFxyXG5cdFx0bWF4V2lkdGggICAgICAgICA6IDU1MCxcclxuXHRcdHRoZW1lICAgICAgICAgICAgOiAnd3BiYy10aXBweS1wb3BvdmVyJyxcclxuXHRcdHBsYWNlbWVudCAgICAgICAgOiAnYm90dG9tLXN0YXJ0JyxcclxuXHRcdHRvdWNoICAgICAgICAgICAgOiBbJ2hvbGQnLCA1MDBdLFxyXG5cdH0gKTtcclxuXHRqUXVlcnkoICcucG9wb3Zlcl9ib3R0b20ucG9wb3Zlcl9jbGljaycgKS5vbiggJ2NsaWNrJywgZnVuY3Rpb24gKCl7XHJcblx0XHRpZiAoIHRoaXMuX3RpcHB5LnN0YXRlLmlzVmlzaWJsZSApe1xyXG5cdFx0XHR0aGlzLl90aXBweS5oaWRlKCk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aGlzLl90aXBweS5zaG93KCk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cdHdwYmNfZGVmaW5lX2hpZGVfdGlwcHlfb25fc2Nyb2xsKCk7XHJcbn1cclxuXHJcblxyXG5cclxuZnVuY3Rpb24gd3BiY19kZWZpbmVfaGlkZV90aXBweV9vbl9zY3JvbGwoKXtcclxuXHRqUXVlcnkoICcuZmxleF90bF9fc2Nyb2xsaW5nX3NlY3Rpb24yLC5mbGV4X3RsX19zY3JvbGxpbmdfc2VjdGlvbnMnICkub24oICdzY3JvbGwnLCBmdW5jdGlvbiAoIGV2ZW50ICl7XHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdFx0d3BiY190aXBweS5oaWRlQWxsKCk7XHJcblx0XHR9XHJcblx0fSApO1xyXG59XHJcbiJdfQ==

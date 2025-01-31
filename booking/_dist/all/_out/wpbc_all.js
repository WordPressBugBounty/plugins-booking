"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
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
  if (Array.isArray(string_to_trim)) {
    string_to_trim = string_to_trim.join(',');
  }
  if ('string' == typeof string_to_trim) {
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
  for (var i = 0, l = array_here.length; i < l; i++) {
    if (array_here[i] == p_val) {
      return true;
    }
  }
  return false;
}
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
function wpbc_clone_obj(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Main _wpbc JS object
 */

var _wpbc = function (obj, $) {
  // Secure parameters for Ajax	------------------------------------------------------------------------------------
  var p_secure = obj.security_obj = obj.security_obj || {
    user_id: 0,
    nonce: '',
    locale: ''
  };
  obj.set_secure_param = function (param_key, param_val) {
    p_secure[param_key] = param_val;
  };
  obj.get_secure_param = function (param_key) {
    return p_secure[param_key];
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
  obj.calendar__is_defined = function (resource_id) {
    return 'undefined' !== typeof p_calendars['calendar_' + resource_id];
  };

  /**
   *  Create Calendar initializing
   *
   * @param {string|int} resource_id
   */
  obj.calendar__init = function (resource_id) {
    p_calendars['calendar_' + resource_id] = {};
    p_calendars['calendar_' + resource_id]['id'] = resource_id;
    p_calendars['calendar_' + resource_id]['pending_days_selectable'] = false;
  };

  /**
   * Check  if the type of this property  is INT
   * @param property_name
   * @returns {boolean}
   */
  obj.calendar__is_prop_int = function (property_name) {
    // FixIn: 9.9.0.29.

    var p_calendar_int_properties = ['dynamic__days_min', 'dynamic__days_max', 'fixed__days_num'];
    var is_include = p_calendar_int_properties.includes(property_name);
    return is_include;
  };

  /**
   * Set params for all  calendars
   *
   * @param {object} calendars_obj		Object { calendar_1: {} }
   * 												 calendar_3: {}, ... }
   */
  obj.calendars_all__set = function (calendars_obj) {
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
  obj.calendar__get_parameters = function (resource_id) {
    if (obj.calendar__is_defined(resource_id)) {
      return p_calendars['calendar_' + resource_id];
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
  obj.calendar__set_parameters = function (resource_id, calendar_property_obj) {
    var is_complete_overwrite = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    if (!obj.calendar__is_defined(resource_id) || true === is_complete_overwrite) {
      obj.calendar__init(resource_id);
    }
    for (var prop_name in calendar_property_obj) {
      p_calendars['calendar_' + resource_id][prop_name] = calendar_property_obj[prop_name];
    }
    return p_calendars['calendar_' + resource_id];
  };

  /**
   * Set property  to  calendar
   * @param resource_id	"1"
   * @param prop_name		name of property
   * @param prop_value	value of property
   * @returns {*}			calendar object
   */
  obj.calendar__set_param_value = function (resource_id, prop_name, prop_value) {
    if (!obj.calendar__is_defined(resource_id)) {
      obj.calendar__init(resource_id);
    }
    p_calendars['calendar_' + resource_id][prop_name] = prop_value;
    return p_calendars['calendar_' + resource_id];
  };

  /**
   *  Get calendar property value   	::   mixed | null
   *
   * @param {string|int}  resource_id		'1'
   * @param {string} prop_name			'selection_mode'
   * @returns {*|null}					mixed | null
   */
  obj.calendar__get_param_value = function (resource_id, prop_name) {
    if (obj.calendar__is_defined(resource_id) && 'undefined' !== typeof p_calendars['calendar_' + resource_id][prop_name]) {
      // FixIn: 9.9.0.29.
      if (obj.calendar__is_prop_int(prop_name)) {
        p_calendars['calendar_' + resource_id][prop_name] = parseInt(p_calendars['calendar_' + resource_id][prop_name]);
      }
      return p_calendars['calendar_' + resource_id][prop_name];
    }
    return null; // If some property not defined, then null;
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
  obj.bookings_in_calendar__is_defined = function (resource_id) {
    return 'undefined' !== typeof p_bookings['calendar_' + resource_id];
  };

  /**
   * Get bookings calendar object   ::   { id: 1 , dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
   *
   * @param {string|int} resource_id				  '2'
   * @returns {object|boolean}					{ id: 2 , dates:  Object { "2023-07-21": {…}, "2023-07-22": {…}, "2023-07-23": {…}, … }
   */
  obj.bookings_in_calendar__get = function (resource_id) {
    if (obj.bookings_in_calendar__is_defined(resource_id)) {
      return p_bookings['calendar_' + resource_id];
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
  obj.bookings_in_calendar__set = function (resource_id, calendar_obj) {
    if (!obj.bookings_in_calendar__is_defined(resource_id)) {
      p_bookings['calendar_' + resource_id] = {};
      p_bookings['calendar_' + resource_id]['id'] = resource_id;
    }
    for (var prop_name in calendar_obj) {
      p_bookings['calendar_' + resource_id][prop_name] = calendar_obj[prop_name];
    }
    return p_bookings['calendar_' + resource_id];
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
  obj.bookings_in_calendar__get_dates = function (resource_id) {
    if (obj.bookings_in_calendar__is_defined(resource_id) && 'undefined' !== typeof p_bookings['calendar_' + resource_id]['dates']) {
      return p_bookings['calendar_' + resource_id]['dates'];
    }
    return false; // If some property not defined, then false;
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
  obj.bookings_in_calendar__set_dates = function (resource_id, dates_obj) {
    var is_complete_overwrite = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    if (!obj.bookings_in_calendar__is_defined(resource_id)) {
      obj.bookings_in_calendar__set(resource_id, {
        'dates': {}
      });
    }
    if ('undefined' === typeof p_bookings['calendar_' + resource_id]['dates']) {
      p_bookings['calendar_' + resource_id]['dates'] = {};
    }
    if (is_complete_overwrite) {
      // Complete overwrite all  booking dates
      p_bookings['calendar_' + resource_id]['dates'] = dates_obj;
    } else {
      // Add only  new or overwrite exist booking dates from  parameter. Booking dates not from  parameter  will  be without chnanges
      for (var prop_name in dates_obj) {
        p_bookings['calendar_' + resource_id]['dates'][prop_name] = dates_obj[prop_name];
      }
    }
    return p_bookings['calendar_' + resource_id];
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
  obj.bookings_in_calendar__get_for_date = function (resource_id, sql_class_day) {
    if (obj.bookings_in_calendar__is_defined(resource_id) && 'undefined' !== typeof p_bookings['calendar_' + resource_id]['dates'] && 'undefined' !== typeof p_bookings['calendar_' + resource_id]['dates'][sql_class_day]) {
      return p_bookings['calendar_' + resource_id]['dates'][sql_class_day];
    }
    return false; // If some property not defined, then false;
  };

  // Any  PARAMS   in bookings

  /**
   * Set property  to  booking
   * @param resource_id	"1"
   * @param prop_name		name of property
   * @param prop_value	value of property
   * @returns {*}			booking object
   */
  obj.booking__set_param_value = function (resource_id, prop_name, prop_value) {
    if (!obj.bookings_in_calendar__is_defined(resource_id)) {
      p_bookings['calendar_' + resource_id] = {};
      p_bookings['calendar_' + resource_id]['id'] = resource_id;
    }
    p_bookings['calendar_' + resource_id][prop_name] = prop_value;
    return p_bookings['calendar_' + resource_id];
  };

  /**
   *  Get booking property value   	::   mixed | null
   *
   * @param {string|int}  resource_id		'1'
   * @param {string} prop_name			'selection_mode'
   * @returns {*|null}					mixed | null
   */
  obj.booking__get_param_value = function (resource_id, prop_name) {
    if (obj.bookings_in_calendar__is_defined(resource_id) && 'undefined' !== typeof p_bookings['calendar_' + resource_id][prop_name]) {
      return p_bookings['calendar_' + resource_id][prop_name];
    }
    return null; // If some property not defined, then null;
  };

  /**
   * Set bookings for all  calendars
   *
   * @param {object} calendars_obj		Object { calendar_1: { id: 1, dates: Object { "2023-07-22": {…}, "2023-07-23": {…}, "2023-07-24": {…}, … } }
   * 												 calendar_3: {}, ... }
   */
  obj.bookings_in_calendars__set_all = function (calendars_obj) {
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
  obj.seasons__set = function (resource_id, dates_obj) {
    var is_complete_overwrite = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    if ('undefined' === typeof p_seasons['calendar_' + resource_id]) {
      p_seasons['calendar_' + resource_id] = {};
    }
    if (is_complete_overwrite) {
      // Complete overwrite all  season dates
      p_seasons['calendar_' + resource_id] = dates_obj;
    } else {
      // Add only  new or overwrite exist booking dates from  parameter. Booking dates not from  parameter  will  be without chnanges
      for (var prop_name in dates_obj) {
        if ('undefined' === typeof p_seasons['calendar_' + resource_id][prop_name]) {
          p_seasons['calendar_' + resource_id][prop_name] = [];
        }
        for (var season_name_key in dates_obj[prop_name]) {
          p_seasons['calendar_' + resource_id][prop_name].push(dates_obj[prop_name][season_name_key]);
        }
      }
    }
    return p_seasons['calendar_' + resource_id];
  };

  /**
   *  Get bookings data for specific date in calendar   ::   [] | [ 'wpbc_season_september_2023', 'wpbc_season_september_2024' ]
   *
   * @param {string|int} resource_id			'1'
   * @param {string} sql_class_day			'2023-07-21'
   * @returns {object|boolean}				[]  |  [ 'wpbc_season_september_2023', 'wpbc_season_september_2024' ]
   */
  obj.seasons__get_for_date = function (resource_id, sql_class_day) {
    if ('undefined' !== typeof p_seasons['calendar_' + resource_id] && 'undefined' !== typeof p_seasons['calendar_' + resource_id][sql_class_day]) {
      return p_seasons['calendar_' + resource_id][sql_class_day];
    }
    return []; // If not defined, then [];
  };

  // Other parameters 			------------------------------------------------------------------------------------
  var p_other = obj.other_obj = obj.other_obj || {};
  obj.set_other_param = function (param_key, param_val) {
    p_other[param_key] = param_val;
  };
  obj.get_other_param = function (param_key) {
    return p_other[param_key];
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
  var p_messages = obj.messages_obj = obj.messages_obj || {};
  obj.set_message = function (param_key, param_val) {
    p_messages[param_key] = param_val;
  };
  obj.get_message = function (param_key) {
    return p_messages[param_key];
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
}(_wpbc || {}, jQuery);

/**
 * Extend _wpbc with  new methods        // FixIn: 9.8.6.2.
 *
 * @type {*|{}}
 * @private
 */
_wpbc = function (obj, $) {
  // Load Balancer 	-----------------------------------------------------------------------------------------------

  var p_balancer = obj.balancer_obj = obj.balancer_obj || {
    'max_threads': 2,
    'in_process': [],
    'wait': []
  };

  /**
   * Set  max parallel request  to  load
   *
   * @param max_threads
   */
  obj.balancer__set_max_threads = function (max_threads) {
    p_balancer['max_threads'] = max_threads;
  };

  /**
   *  Check if balancer for specific booking resource defined   ::   true | false
   *
   * @param {string|int} resource_id
   * @returns {boolean}
   */
  obj.balancer__is_defined = function (resource_id) {
    return 'undefined' !== typeof p_balancer['balancer_' + resource_id];
  };

  /**
   *  Create balancer initializing
   *
   * @param {string|int} resource_id
   */
  obj.balancer__init = function (resource_id, function_name) {
    var params = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var balance_obj = {};
    balance_obj['resource_id'] = resource_id;
    balance_obj['priority'] = 1;
    balance_obj['function_name'] = function_name;
    balance_obj['params'] = wpbc_clone_obj(params);
    if (obj.balancer__is_already_run(resource_id, function_name)) {
      return 'run';
    }
    if (obj.balancer__is_already_wait(resource_id, function_name)) {
      return 'wait';
    }
    if (obj.balancer__can_i_run()) {
      obj.balancer__add_to__run(balance_obj);
      return 'run';
    } else {
      obj.balancer__add_to__wait(balance_obj);
      return 'wait';
    }
  };

  /**
   * Can I Run ?
   * @returns {boolean}
   */
  obj.balancer__can_i_run = function () {
    return p_balancer['in_process'].length < p_balancer['max_threads'];
  };

  /**
   * Add to WAIT
   * @param balance_obj
   */
  obj.balancer__add_to__wait = function (balance_obj) {
    p_balancer['wait'].push(balance_obj);
  };

  /**
   * Remove from Wait
   *
   * @param resource_id
   * @param function_name
   * @returns {*|boolean}
   */
  obj.balancer__remove_from__wait_list = function (resource_id, function_name) {
    var removed_el = false;
    if (p_balancer['wait'].length) {
      // FixIn: 9.8.10.1.
      for (var i in p_balancer['wait']) {
        if (resource_id === p_balancer['wait'][i]['resource_id'] && function_name === p_balancer['wait'][i]['function_name']) {
          removed_el = p_balancer['wait'].splice(i, 1);
          removed_el = removed_el.pop();
          p_balancer['wait'] = p_balancer['wait'].filter(function (v) {
            return v;
          }); // Reindex array
          return removed_el;
        }
      }
    }
    return removed_el;
  };

  /**
  * Is already WAIT
  *
  * @param resource_id
  * @param function_name
  * @returns {boolean}
  */
  obj.balancer__is_already_wait = function (resource_id, function_name) {
    if (p_balancer['wait'].length) {
      // FixIn: 9.8.10.1.
      for (var i in p_balancer['wait']) {
        if (resource_id === p_balancer['wait'][i]['resource_id'] && function_name === p_balancer['wait'][i]['function_name']) {
          return true;
        }
      }
    }
    return false;
  };

  /**
   * Add to RUN
   * @param balance_obj
   */
  obj.balancer__add_to__run = function (balance_obj) {
    p_balancer['in_process'].push(balance_obj);
  };

  /**
  * Remove from RUN list
  *
  * @param resource_id
  * @param function_name
  * @returns {*|boolean}
  */
  obj.balancer__remove_from__run_list = function (resource_id, function_name) {
    var removed_el = false;
    if (p_balancer['in_process'].length) {
      // FixIn: 9.8.10.1.
      for (var i in p_balancer['in_process']) {
        if (resource_id === p_balancer['in_process'][i]['resource_id'] && function_name === p_balancer['in_process'][i]['function_name']) {
          removed_el = p_balancer['in_process'].splice(i, 1);
          removed_el = removed_el.pop();
          p_balancer['in_process'] = p_balancer['in_process'].filter(function (v) {
            return v;
          }); // Reindex array
          return removed_el;
        }
      }
    }
    return removed_el;
  };

  /**
  * Is already RUN
  *
  * @param resource_id
  * @param function_name
  * @returns {boolean}
  */
  obj.balancer__is_already_run = function (resource_id, function_name) {
    if (p_balancer['in_process'].length) {
      // FixIn: 9.8.10.1.
      for (var i in p_balancer['in_process']) {
        if (resource_id === p_balancer['in_process'][i]['resource_id'] && function_name === p_balancer['in_process'][i]['function_name']) {
          return true;
        }
      }
    }
    return false;
  };
  obj.balancer__run_next = function () {
    // Get 1st from  Wait list
    var removed_el = false;
    if (p_balancer['wait'].length) {
      // FixIn: 9.8.10.1.
      for (var i in p_balancer['wait']) {
        removed_el = obj.balancer__remove_from__wait_list(p_balancer['wait'][i]['resource_id'], p_balancer['wait'][i]['function_name']);
        break;
      }
    }
    if (false !== removed_el) {
      // Run
      obj.balancer__run(removed_el);
    }
  };

  /**
   * Run
   * @param balance_obj
   */
  obj.balancer__run = function (balance_obj) {
    switch (balance_obj['function_name']) {
      case 'wpbc_calendar__load_data__ajx':
        // Add to run list
        obj.balancer__add_to__run(balance_obj);
        wpbc_calendar__load_data__ajx(balance_obj['params']);
        break;
      default:
    }
  };
  return obj;
}(_wpbc || {}, jQuery);

/**
 * -- Help functions ----------------------------------------------------------------------------------------------
*/

function wpbc_balancer__is_wait(params, function_name) {
  //console.log('::wpbc_balancer__is_wait',params , function_name );
  if ('undefined' !== typeof params['resource_id']) {
    var balancer_status = _wpbc.balancer__init(params['resource_id'], function_name, params);
    return 'wait' === balancer_status;
  }
  return false;
}
function wpbc_balancer__completed(resource_id, function_name) {
  //console.log('::wpbc_balancer__completed',resource_id , function_name );
  _wpbc.balancer__remove_from__run_list(resource_id, function_name);
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
function wpbc_calendar_show(resource_id) {
  // If no calendar HTML tag,  then  exit
  if (0 === jQuery('#calendar_booking' + resource_id).length) {
    return false;
  }

  // If the calendar with the same Booking resource is activated already, then exit.
  if (true === jQuery('#calendar_booking' + resource_id).hasClass('hasDatepick')) {
    return false;
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Days selection
  // -----------------------------------------------------------------------------------------------------------------
  var local__is_range_select = false;
  var local__multi_days_select_num = 365; // multiple | fixed
  if ('dynamic' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
    local__is_range_select = true;
    local__multi_days_select_num = 0;
  }
  if ('single' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
    local__multi_days_select_num = 0;
  }

  // -----------------------------------------------------------------------------------------------------------------
  // Min - Max days to scroll/show
  // -----------------------------------------------------------------------------------------------------------------
  var local__min_date = 0;
  local__min_date = new Date(_wpbc.get_other_param('today_arr')[0], parseInt(_wpbc.get_other_param('today_arr')[1]) - 1, _wpbc.get_other_param('today_arr')[2], 0, 0, 0); // FixIn: 9.9.0.17.
  //console.log( local__min_date );
  var local__max_date = _wpbc.calendar__get_param_value(resource_id, 'booking_max_monthes_in_calendar');
  //local__max_date = new Date(2024, 5, 28);  It is here issue of not selectable dates, but some dates showing in calendar as available, but we can not select it.

  //// Define last day in calendar (as a last day of month (and not date, which is related to actual 'Today' date).
  //// E.g. if today is 2023-09-25, and we set 'Number of months to scroll' as 5 months, then last day will be 2024-02-29 and not the 2024-02-25.
  // var cal_last_day_in_month = jQuery.datepick._determineDate( null, local__max_date, new Date() );
  // cal_last_day_in_month = new Date( cal_last_day_in_month.getFullYear(), cal_last_day_in_month.getMonth() + 1, 0 );
  // local__max_date = cal_last_day_in_month;			// FixIn: 10.0.0.26.

  if (location.href.indexOf('page=wpbc-new') != -1 && (location.href.indexOf('booking_hash') != -1 // Comment this line for ability to add  booking in past days at  Booking > Add booking page.
  || location.href.indexOf('allow_past') != -1 // FixIn: 10.7.1.2.
  )) {
    local__min_date = null;
    local__max_date = null;
  }
  var local__start_weekday = _wpbc.calendar__get_param_value(resource_id, 'booking_start_day_weeek');
  var local__number_of_months = parseInt(_wpbc.calendar__get_param_value(resource_id, 'calendar_number_of_months'));
  jQuery('#calendar_booking' + resource_id).text(''); // Remove all HTML in calendar tag
  // -----------------------------------------------------------------------------------------------------------------
  // Show calendar
  // -----------------------------------------------------------------------------------------------------------------
  jQuery('#calendar_booking' + resource_id).datepick({
    beforeShowDay: function beforeShowDay(js_date) {
      return wpbc__calendar__apply_css_to_days(js_date, {
        'resource_id': resource_id
      }, this);
    },
    onSelect: function onSelect(string_dates, js_dates_arr) {
      /**
      *	string_dates   =   '23.08.2023 - 26.08.2023'    |    '23.08.2023 - 23.08.2023'    |    '19.09.2023, 24.08.2023, 30.09.2023'
      *  js_dates_arr   =   range: [ Date (Aug 23 2023), Date (Aug 25 2023)]     |     multiple: [ Date(Oct 24 2023), Date(Oct 20 2023), Date(Oct 16 2023) ]
      */
      return wpbc__calendar__on_select_days(string_dates, {
        'resource_id': resource_id
      }, this);
    },
    onHover: function onHover(string_date, js_date) {
      return wpbc__calendar__on_hover_days(string_date, js_date, {
        'resource_id': resource_id
      }, this);
    },
    onChangeMonthYear: function onChangeMonthYear(year, real_month, js_date__1st_day_in_month) {},
    showOn: 'both',
    numberOfMonths: local__number_of_months,
    stepMonths: 1,
    // prevText      : '&laquo;',
    // nextText      : '&raquo;',
    prevText: '&lsaquo;',
    nextText: '&rsaquo;',
    dateFormat: 'dd.mm.yy',
    changeMonth: false,
    changeYear: false,
    minDate: local__min_date,
    maxDate: local__max_date,
    // '1Y',
    // minDate: new Date(2020, 2, 1), maxDate: new Date(2020, 9, 31),             	// Ability to set any  start and end date in calendar
    showStatus: false,
    multiSeparator: ', ',
    closeAtTop: false,
    firstDay: local__start_weekday,
    gotoCurrent: false,
    hideIfNoPrevNext: true,
    multiSelect: local__multi_days_select_num,
    rangeSelect: local__is_range_select,
    // showWeeks: true,
    useThemeRoller: false
  });

  // -----------------------------------------------------------------------------------------------------------------
  // Clear today date highlighting
  // -----------------------------------------------------------------------------------------------------------------
  setTimeout(function () {
    wpbc_calendars__clear_days_highlighting(resource_id);
  }, 500); // FixIn: 7.1.2.8.

  // -----------------------------------------------------------------------------------------------------------------
  // Scroll calendar to  specific month
  // -----------------------------------------------------------------------------------------------------------------
  var start_bk_month = _wpbc.calendar__get_param_value(resource_id, 'calendar_scroll_to');
  if (false !== start_bk_month) {
    wpbc_calendar__scroll_to(resource_id, start_bk_month[0], start_bk_month[1]);
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
function wpbc__calendar__apply_css_to_days(date, calendar_params_arr, datepick_this) {
  var today_date = new Date(_wpbc.get_other_param('today_arr')[0], parseInt(_wpbc.get_other_param('today_arr')[1]) - 1, _wpbc.get_other_param('today_arr')[2], 0, 0, 0); // Today JS_Date_Obj.
  var class_day = wpbc__get__td_class_date(date); // '1-9-2023'
  var sql_class_day = wpbc__get__sql_class_date(date); // '2023-01-09'
  var resource_id = 'undefined' !== typeof calendar_params_arr['resource_id'] ? calendar_params_arr['resource_id'] : '1'; // '1'

  // Get Selected dates in calendar
  var selected_dates_sql = wpbc_get__selected_dates_sql__as_arr(resource_id);

  // Get Data --------------------------------------------------------------------------------------------------------
  var date_bookings_obj = _wpbc.bookings_in_calendar__get_for_date(resource_id, sql_class_day);

  // Array with CSS classes for date ---------------------------------------------------------------------------------
  var css_classes__for_date = [];
  css_classes__for_date.push('sql_date_' + sql_class_day); //  'sql_date_2023-07-21'
  css_classes__for_date.push('cal4date-' + class_day); //  'cal4date-7-21-2023'
  css_classes__for_date.push('wpbc_weekday_' + date.getDay()); //  'wpbc_weekday_4'

  // Define Selected Check In/Out dates in TD  -----------------------------------------------------------------------
  if (selected_dates_sql.length
  //&&  ( selected_dates_sql[ 0 ] !== selected_dates_sql[ (selected_dates_sql.length - 1) ] )
  ) {
    if (sql_class_day === selected_dates_sql[0]) {
      css_classes__for_date.push('selected_check_in');
      css_classes__for_date.push('selected_check_in_out');
    }
    if (selected_dates_sql.length > 1 && sql_class_day === selected_dates_sql[selected_dates_sql.length - 1]) {
      css_classes__for_date.push('selected_check_out');
      css_classes__for_date.push('selected_check_in_out');
    }
  }
  var is_day_selectable = false;

  // If something not defined,  then  this date closed ---------------------------------------------------------------
  if (false === date_bookings_obj) {
    css_classes__for_date.push('date_user_unavailable');
    return [is_day_selectable, css_classes__for_date.join(' ')];
  }

  // -----------------------------------------------------------------------------------------------------------------
  //   date_bookings_obj  - Defined.            Dates can be selectable.
  // -----------------------------------------------------------------------------------------------------------------

  // -----------------------------------------------------------------------------------------------------------------
  // Add season names to the day CSS classes -- it is required for correct  work  of conditional fields --------------
  var season_names_arr = _wpbc.seasons__get_for_date(resource_id, sql_class_day);
  for (var season_key in season_names_arr) {
    css_classes__for_date.push(season_names_arr[season_key]); //  'wpdevbk_season_september_2023'
  }
  // -----------------------------------------------------------------------------------------------------------------

  // Cost Rate -------------------------------------------------------------------------------------------------------
  css_classes__for_date.push('rate_' + date_bookings_obj[resource_id]['date_cost_rate'].toString().replace(/[\.\s]/g, '_')); //  'rate_99_00' -> 99.00

  if (parseInt(date_bookings_obj['day_availability']) > 0) {
    is_day_selectable = true;
    css_classes__for_date.push('date_available');
    css_classes__for_date.push('reserved_days_count' + parseInt(date_bookings_obj['max_capacity'] - date_bookings_obj['day_availability']));
  } else {
    is_day_selectable = false;
    css_classes__for_date.push('date_user_unavailable');
  }
  switch (date_bookings_obj['summary']['status_for_day']) {
    case 'available':
      break;
    case 'time_slots_booking':
      css_classes__for_date.push('timespartly', 'times_clock');
      break;
    case 'full_day_booking':
      css_classes__for_date.push('full_day_booking');
      break;
    case 'season_filter':
      css_classes__for_date.push('date_user_unavailable', 'season_unavailable');
      date_bookings_obj['summary']['status_for_bookings'] = ''; // Reset booking status color for possible old bookings on this date
      break;
    case 'resource_availability':
      css_classes__for_date.push('date_user_unavailable', 'resource_unavailable');
      date_bookings_obj['summary']['status_for_bookings'] = ''; // Reset booking status color for possible old bookings on this date
      break;
    case 'weekday_unavailable':
      css_classes__for_date.push('date_user_unavailable', 'weekday_unavailable');
      date_bookings_obj['summary']['status_for_bookings'] = ''; // Reset booking status color for possible old bookings on this date
      break;
    case 'from_today_unavailable':
      css_classes__for_date.push('date_user_unavailable', 'from_today_unavailable');
      date_bookings_obj['summary']['status_for_bookings'] = ''; // Reset booking status color for possible old bookings on this date
      break;
    case 'limit_available_from_today':
      css_classes__for_date.push('date_user_unavailable', 'limit_available_from_today');
      date_bookings_obj['summary']['status_for_bookings'] = ''; // Reset booking status color for possible old bookings on this date
      break;
    case 'change_over':
      /*
       *
      //  check_out_time_date2approve 	 	check_in_time_date2approve
      //  check_out_time_date2approve 	 	check_in_time_date_approved
      //  check_in_time_date2approve 		 	check_out_time_date_approved
      //  check_out_time_date_approved 	 	check_in_time_date_approved
       */

      css_classes__for_date.push('timespartly', 'check_in_time', 'check_out_time');
      // FixIn: 10.0.0.2.
      if (date_bookings_obj['summary']['status_for_bookings'].indexOf('approved_pending') > -1) {
        css_classes__for_date.push('check_out_time_date_approved', 'check_in_time_date2approve');
      }
      if (date_bookings_obj['summary']['status_for_bookings'].indexOf('pending_approved') > -1) {
        css_classes__for_date.push('check_out_time_date2approve', 'check_in_time_date_approved');
      }
      break;
    case 'check_in':
      css_classes__for_date.push('timespartly', 'check_in_time');

      // FixIn: 9.9.0.33.
      if (date_bookings_obj['summary']['status_for_bookings'].indexOf('pending') > -1) {
        css_classes__for_date.push('check_in_time_date2approve');
      } else if (date_bookings_obj['summary']['status_for_bookings'].indexOf('approved') > -1) {
        css_classes__for_date.push('check_in_time_date_approved');
      }
      break;
    case 'check_out':
      css_classes__for_date.push('timespartly', 'check_out_time');

      // FixIn: 9.9.0.33.
      if (date_bookings_obj['summary']['status_for_bookings'].indexOf('pending') > -1) {
        css_classes__for_date.push('check_out_time_date2approve');
      } else if (date_bookings_obj['summary']['status_for_bookings'].indexOf('approved') > -1) {
        css_classes__for_date.push('check_out_time_date_approved');
      }
      break;
    default:
      // mixed statuses: 'change_over check_out' .... variations.... check more in 		function wpbc_get_availability_per_days_arr()
      date_bookings_obj['summary']['status_for_day'] = 'available';
  }
  if ('available' != date_bookings_obj['summary']['status_for_day']) {
    var is_set_pending_days_selectable = _wpbc.calendar__get_param_value(resource_id, 'pending_days_selectable'); // set pending days selectable          // FixIn: 8.6.1.18.

    switch (date_bookings_obj['summary']['status_for_bookings']) {
      case '':
        // Usually  it's means that day  is available or unavailable without the bookings
        break;
      case 'pending':
        css_classes__for_date.push('date2approve');
        is_day_selectable = is_day_selectable ? true : is_set_pending_days_selectable;
        break;
      case 'approved':
        css_classes__for_date.push('date_approved');
        break;

      // Situations for "change-over" days: ----------------------------------------------------------------------
      case 'pending_pending':
        css_classes__for_date.push('check_out_time_date2approve', 'check_in_time_date2approve');
        is_day_selectable = is_day_selectable ? true : is_set_pending_days_selectable;
        break;
      case 'pending_approved':
        css_classes__for_date.push('check_out_time_date2approve', 'check_in_time_date_approved');
        is_day_selectable = is_day_selectable ? true : is_set_pending_days_selectable;
        break;
      case 'approved_pending':
        css_classes__for_date.push('check_out_time_date_approved', 'check_in_time_date2approve');
        is_day_selectable = is_day_selectable ? true : is_set_pending_days_selectable;
        break;
      case 'approved_approved':
        css_classes__for_date.push('check_out_time_date_approved', 'check_in_time_date_approved');
        break;
      default:
    }
  }
  return [is_day_selectable, css_classes__for_date.join(' ')];
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
function wpbc__calendar__on_hover_days(string_date, date, calendar_params_arr, datepick_this) {
  if (null === date) {
    wpbc_calendars__clear_days_highlighting('undefined' !== typeof calendar_params_arr['resource_id'] ? calendar_params_arr['resource_id'] : '1'); // FixIn: 10.5.2.4.
    return false;
  }
  var class_day = wpbc__get__td_class_date(date); // '1-9-2023'
  var sql_class_day = wpbc__get__sql_class_date(date); // '2023-01-09'
  var resource_id = 'undefined' !== typeof calendar_params_arr['resource_id'] ? calendar_params_arr['resource_id'] : '1'; // '1'

  // Get Data --------------------------------------------------------------------------------------------------------
  var date_booking_obj = _wpbc.bookings_in_calendar__get_for_date(resource_id, sql_class_day); // {...}

  if (!date_booking_obj) {
    return false;
  }

  // T o o l t i p s -------------------------------------------------------------------------------------------------
  var tooltip_text = '';
  if (date_booking_obj['summary']['tooltip_availability'].length > 0) {
    tooltip_text += date_booking_obj['summary']['tooltip_availability'];
  }
  if (date_booking_obj['summary']['tooltip_day_cost'].length > 0) {
    tooltip_text += date_booking_obj['summary']['tooltip_day_cost'];
  }
  if (date_booking_obj['summary']['tooltip_times'].length > 0) {
    tooltip_text += date_booking_obj['summary']['tooltip_times'];
  }
  if (date_booking_obj['summary']['tooltip_booking_details'].length > 0) {
    tooltip_text += date_booking_obj['summary']['tooltip_booking_details'];
  }
  wpbc_set_tooltip___for__calendar_date(tooltip_text, resource_id, class_day);

  //  U n h o v e r i n g    in    UNSELECTABLE_CALENDAR  ------------------------------------------------------------
  var is_unselectable_calendar = jQuery('#calendar_booking_unselectable' + resource_id).length > 0; // FixIn: 8.0.1.2.
  var is_booking_form_exist = jQuery('#booking_form_div' + resource_id).length > 0;
  if (is_unselectable_calendar && !is_booking_form_exist) {
    /**
     *  Un Hover all dates in calendar (without the booking form), if only Availability Calendar here and we do not insert Booking form by mistake.
     */

    wpbc_calendars__clear_days_highlighting(resource_id); // Clear days highlighting

    var css_of_calendar = '.wpbc_only_calendar #calendar_booking' + resource_id;
    jQuery(css_of_calendar + ' .datepick-days-cell, ' + css_of_calendar + ' .datepick-days-cell a').css('cursor', 'default'); // Set cursor to Default
    return false;
  }

  //  D a y s    H o v e r i n g  ------------------------------------------------------------------------------------
  if (location.href.indexOf('page=wpbc') == -1 || location.href.indexOf('page=wpbc-new') > 0 || location.href.indexOf('page=wpbc-setup') > 0 || location.href.indexOf('page=wpbc-availability') > 0 || location.href.indexOf('page=wpbc-settings') > 0 && location.href.indexOf('&tab=form') > 0) {
    // The same as dates selection,  but for days hovering

    if ('function' == typeof wpbc__calendar__do_days_highlight__bs) {
      wpbc__calendar__do_days_highlight__bs(sql_class_day, date, resource_id);
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
function wpbc__calendar__on_select_days(date, calendar_params_arr, datepick_this) {
  var resource_id = 'undefined' !== typeof calendar_params_arr['resource_id'] ? calendar_params_arr['resource_id'] : '1'; // '1'

  // Set unselectable,  if only Availability Calendar  here (and we do not insert Booking form by mistake).
  var is_unselectable_calendar = jQuery('#calendar_booking_unselectable' + resource_id).length > 0; // FixIn: 8.0.1.2.
  var is_booking_form_exist = jQuery('#booking_form_div' + resource_id).length > 0;
  if (is_unselectable_calendar && !is_booking_form_exist) {
    wpbc_calendar__unselect_all_dates(resource_id); // Unselect Dates
    jQuery('.wpbc_only_calendar .popover_calendar_hover').remove(); // Hide all opened popovers
    return false;
  }
  jQuery('#date_booking' + resource_id).val(date); // Add selected dates to  hidden textarea

  if ('function' === typeof wpbc__calendar__do_days_select__bs) {
    wpbc__calendar__do_days_select__bs(date, resource_id);
  }
  wpbc_disable_time_fields_in_booking_form(resource_id);

  // Hook -- trigger day selection -----------------------------------------------------------------------------------
  var mouse_clicked_dates = date; // Can be: "05.10.2023 - 07.10.2023"  |  "10.10.2023 - 10.10.2023"  |
  var all_selected_dates_arr = wpbc_get__selected_dates_sql__as_arr(resource_id); // Can be: [ "2023-10-05", "2023-10-06", "2023-10-07", … ]
  jQuery(".booking_form_div").trigger("date_selected", [resource_id, mouse_clicked_dates, all_selected_dates_arr]);
}

// Mark middle selected dates with 0.5 opacity		// FixIn: 10.3.0.9.
jQuery(document).ready(function () {
  jQuery(".booking_form_div").on('date_selected', function (event, resource_id, date) {
    if ('fixed' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode') || 'dynamic' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      var closed_timer = setTimeout(function () {
        var middle_days_opacity = _wpbc.get_other_param('calendars__days_selection__middle_days_opacity');
        jQuery('#calendar_booking' + resource_id + ' .datepick-current-day').not(".selected_check_in_out").css('opacity', middle_days_opacity);
      }, 10);
    }
  });
});

/**
 * --  T i m e    F i e l d s     start  --------------------------------------------------------------------------
 */

/**
 * Disable time slots in booking form depend on selected dates and booked dates/times
 *
 * @param resource_id
 */
function wpbc_disable_time_fields_in_booking_form(resource_id) {
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
  var time_fields_obj_arr = wpbc_get__time_fields__in_booking_form__as_arr(resource_id);

  // 2. Get all selected dates in  SQL format  like this [ "2023-08-23", "2023-08-24", "2023-08-25", ... ]
  var selected_dates_arr = wpbc_get__selected_dates_sql__as_arr(resource_id);

  // 3. Get child booking resources  or single booking resource  that  exist  in dates
  var child_resources_arr = wpbc_clone_obj(_wpbc.booking__get_param_value(resource_id, 'resources_id_arr__in_dates'));
  var sql_date;
  var child_resource_id;
  var merged_seconds;
  var time_fields_obj;
  var is_intersect;
  var is_check_in;
  var today_time__real = new Date(_wpbc.get_other_param('time_local_arr')[0], parseInt(_wpbc.get_other_param('time_local_arr')[1]) - 1, _wpbc.get_other_param('time_local_arr')[2], _wpbc.get_other_param('time_local_arr')[3], _wpbc.get_other_param('time_local_arr')[4], 0);
  var today_time__shift = new Date(_wpbc.get_other_param('today_arr')[0], parseInt(_wpbc.get_other_param('today_arr')[1]) - 1, _wpbc.get_other_param('today_arr')[2], _wpbc.get_other_param('today_arr')[3], _wpbc.get_other_param('today_arr')[4], 0);

  // 4. Loop  all  time Fields options		// FixIn: 10.3.0.2.
  for (var field_key = 0; field_key < time_fields_obj_arr.length; field_key++) {
    time_fields_obj_arr[field_key].disabled = 0; // By default, this time field is not disabled.

    time_fields_obj = time_fields_obj_arr[field_key]; // { times_as_seconds: [ 21600, 23400 ], value_option_24h: '06:00 - 06:30', name: 'rangetime2[]', jquery_option: jQuery_Object {}}

    // Loop  all  selected dates.
    for (var i = 0; i < selected_dates_arr.length; i++) {
      // Get Date: '2023-08-18'.
      sql_date = selected_dates_arr[i];
      var is_time_in_past = wpbc_check_is_time_in_past(today_time__shift, sql_date, time_fields_obj);
      if (is_time_in_past) {
        // This time for selected date already  in the past.
        time_fields_obj_arr[field_key].disabled = 1;
        break; // exist  from   Dates LOOP.
      }

      // FixIn: 9.9.0.31.
      if ('Off' === _wpbc.calendar__get_param_value(resource_id, 'booking_recurrent_time') && selected_dates_arr.length > 1) {
        //TODO: skip some fields checking if it's start / end time for mulple dates  selection  mode.
        //TODO: we need to fix situation  for entimes,  when  user  select  several  dates,  and in start  time booked 00:00 - 15:00 , but systsme block untill 15:00 the end time as well,  which  is wrong,  because it 2 or 3 dates selection  and end date can be fullu  available

        if (0 == i && time_fields_obj['name'].indexOf('endtime') >= 0) {
          break;
        }
        if (selected_dates_arr.length - 1 == i && time_fields_obj['name'].indexOf('starttime') >= 0) {
          break;
        }
      }
      var how_many_resources_intersected = 0;
      // Loop all resources ID
      // for ( var res_key in child_resources_arr ){	 						// FixIn: 10.3.0.2.
      for (var res_key = 0; res_key < child_resources_arr.length; res_key++) {
        child_resource_id = child_resources_arr[res_key];

        // _wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[12].booked_time_slots.merged_seconds		= [ "07:00:11 - 07:30:02", "10:00:11 - 00:00:00" ]
        // _wpbc.bookings_in_calendar__get_for_date(2,'2023-08-21')[2].booked_time_slots.merged_seconds			= [  [ 25211, 27002 ], [ 36011, 86400 ]  ]

        if (false !== _wpbc.bookings_in_calendar__get_for_date(resource_id, sql_date)) {
          merged_seconds = _wpbc.bookings_in_calendar__get_for_date(resource_id, sql_date)[child_resource_id].booked_time_slots.merged_seconds; // [  [ 25211, 27002 ], [ 36011, 86400 ]  ]
        } else {
          merged_seconds = [];
        }
        if (time_fields_obj.times_as_seconds.length > 1) {
          is_intersect = wpbc_is_intersect__range_time_interval([[parseInt(time_fields_obj.times_as_seconds[0]) + 20, parseInt(time_fields_obj.times_as_seconds[1]) - 20]], merged_seconds);
        } else {
          is_check_in = -1 !== time_fields_obj.name.indexOf('start');
          is_intersect = wpbc_is_intersect__one_time_interval(is_check_in ? parseInt(time_fields_obj.times_as_seconds) + 20 : parseInt(time_fields_obj.times_as_seconds) - 20, merged_seconds);
        }
        if (is_intersect) {
          how_many_resources_intersected++; // Increase
        }
      }
      if (child_resources_arr.length == how_many_resources_intersected) {
        // All resources intersected,  then  it's means that this time-slot or time must  be  Disabled, and we can  exist  from   selected_dates_arr LOOP

        time_fields_obj_arr[field_key].disabled = 1;
        break; // exist  from   Dates LOOP
      }
    }
  }

  // 5. Now we can disable time slot in HTML by  using  ( field.disabled == 1 ) property
  wpbc__html__time_field_options__set_disabled(time_fields_obj_arr);
  jQuery(".booking_form_div").trigger('wpbc_hook_timeslots_disabled', [resource_id, selected_dates_arr]); // Trigger hook on disabling timeslots.		Usage: 	jQuery( ".booking_form_div" ).on( 'wpbc_hook_timeslots_disabled', function ( event, bk_type, all_dates ){ ... } );		// FixIn: 8.7.11.9.
}

/**
 * Check if specific time(-slot) already  in the past for selected date
 *
 * @param js_current_time_to_check		- JS Date
 * @param sql_date						- '2025-01-26'
 * @param time_fields_obj				- Object
 * @returns {boolean}
 */
function wpbc_check_is_time_in_past(js_current_time_to_check, sql_date, time_fields_obj) {
  // FixIn: 10.9.6.4
  var sql_date_arr = sql_date.split('-');
  var sql_date__midnight = new Date(parseInt(sql_date_arr[0]), parseInt(sql_date_arr[1]) - 1, parseInt(sql_date_arr[2]), 0, 0, 0);
  var sql_date__midnight_miliseconds = sql_date__midnight.getTime();
  var is_intersect = false;
  if (time_fields_obj.times_as_seconds.length > 1) {
    if (js_current_time_to_check.getTime() > sql_date__midnight_miliseconds + (parseInt(time_fields_obj.times_as_seconds[0]) + 20) * 1000) {
      is_intersect = true;
    }
    if (js_current_time_to_check.getTime() > sql_date__midnight_miliseconds + (parseInt(time_fields_obj.times_as_seconds[1]) - 20) * 1000) {
      is_intersect = true;
    }
  } else {
    var is_check_in = -1 !== time_fields_obj.name.indexOf('start');
    var times_as_seconds_check = is_check_in ? parseInt(time_fields_obj.times_as_seconds) + 20 : parseInt(time_fields_obj.times_as_seconds) - 20;
    times_as_seconds_check = sql_date__midnight_miliseconds + times_as_seconds_check * 1000;
    if (js_current_time_to_check.getTime() > times_as_seconds_check) {
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
function wpbc_is_intersect__one_time_interval(time_A, time_interval_B) {
  for (var j = 0; j < time_interval_B.length; j++) {
    if (parseInt(time_A) > parseInt(time_interval_B[j][0]) && parseInt(time_A) < parseInt(time_interval_B[j][1])) {
      return true;
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
function wpbc_is_intersect__range_time_interval(time_interval_A, time_interval_B) {
  var is_intersect;
  for (var i = 0; i < time_interval_A.length; i++) {
    for (var j = 0; j < time_interval_B.length; j++) {
      is_intersect = wpbc_intervals__is_intersected(time_interval_A[i], time_interval_B[j]);
      if (is_intersect) {
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
function wpbc_get__time_fields__in_booking_form__as_arr(resource_id) {
  /**
  * Fields with  []  like this   select[name="rangetime1[]"]
  * it's when we have 'multiple' in shortcode:   [select* rangetime multiple  "06:00 - 06:30" ... ]
  */
  var time_fields_arr = ['select[name="rangetime' + resource_id + '"]', 'select[name="rangetime' + resource_id + '[]"]', 'select[name="starttime' + resource_id + '"]', 'select[name="starttime' + resource_id + '[]"]', 'select[name="endtime' + resource_id + '"]', 'select[name="endtime' + resource_id + '[]"]'];
  var time_fields_obj_arr = [];

  // Loop all Time Fields
  for (var ctf = 0; ctf < time_fields_arr.length; ctf++) {
    var time_field = time_fields_arr[ctf];
    var time_option = jQuery(time_field + ' option');

    // Loop all options in time field
    for (var j = 0; j < time_option.length; j++) {
      var jquery_option = jQuery(time_field + ' option:eq(' + j + ')');
      var value_option_seconds_arr = jquery_option.val().split('-');
      var times_as_seconds = [];

      // Get time as seconds
      if (value_option_seconds_arr.length) {
        // FixIn: 9.8.10.1.
        for (var i = 0; i < value_option_seconds_arr.length; i++) {
          // FixIn: 10.0.0.56.
          // value_option_seconds_arr[i] = '14:00 '  | ' 16:00'   (if from 'rangetime') and '16:00'  if (start/end time)

          var start_end_times_arr = value_option_seconds_arr[i].trim().split(':');
          var time_in_seconds = parseInt(start_end_times_arr[0]) * 60 * 60 + parseInt(start_end_times_arr[1]) * 60;
          times_as_seconds.push(time_in_seconds);
        }
      }
      time_fields_obj_arr.push({
        'name': jQuery(time_field).attr('name'),
        'value_option_24h': jquery_option.val(),
        'jquery_option': jquery_option,
        'times_as_seconds': times_as_seconds
      });
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
function wpbc__html__time_field_options__set_disabled(time_fields_obj_arr) {
  var jquery_option;
  for (var i = 0; i < time_fields_obj_arr.length; i++) {
    var jquery_option = time_fields_obj_arr[i].jquery_option;
    if (1 == time_fields_obj_arr[i].disabled) {
      jquery_option.prop('disabled', true); // Make disable some options
      jquery_option.addClass('booked'); // Add "booked" CSS class

      // if this booked element selected --> then deselect  it
      if (jquery_option.prop('selected')) {
        jquery_option.prop('selected', false);
        jquery_option.parent().find('option:not([disabled]):first').prop('selected', true).trigger("change");
      }
    } else {
      jquery_option.prop('disabled', false); // Make active all times
      jquery_option.removeClass('booked'); // Remove class "booked"
    }
  }
}

/**
 * Check if this time_range | Time_Slot is Full Day  booked
 *
 * @param timeslot_arr_in_seconds		- [ 36011, 86400 ]
 * @returns {boolean}
 */
function wpbc_is_this_timeslot__full_day_booked(timeslot_arr_in_seconds) {
  if (timeslot_arr_in_seconds.length > 1 && parseInt(timeslot_arr_in_seconds[0]) < 30 && parseInt(timeslot_arr_in_seconds[1]) > 24 * 60 * 60 - 30) {
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
function wpbc_get__selected_dates_sql__as_arr(resource_id) {
  var selected_dates_arr = [];
  selected_dates_arr = jQuery('#date_booking' + resource_id).val().split(',');
  if (selected_dates_arr.length) {
    // FixIn: 9.8.10.1.
    for (var i = 0; i < selected_dates_arr.length; i++) {
      // FixIn: 10.0.0.56.
      selected_dates_arr[i] = selected_dates_arr[i].trim();
      selected_dates_arr[i] = selected_dates_arr[i].split('.');
      if (selected_dates_arr[i].length > 1) {
        selected_dates_arr[i] = selected_dates_arr[i][2] + '-' + selected_dates_arr[i][1] + '-' + selected_dates_arr[i][0];
      }
    }
  }

  // Remove empty elements from an array
  selected_dates_arr = selected_dates_arr.filter(function (n) {
    return parseInt(n);
  });
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
function wpbc_get__selected_time_fields__in_booking_form__as_arr(resource_id) {
  var is_only_selected_time = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  /**
   * Fields with  []  like this   select[name="rangetime1[]"]
   * it's when we have 'multiple' in shortcode:   [select* rangetime multiple  "06:00 - 06:30" ... ]
   */
  var time_fields_arr = ['select[name="rangetime' + resource_id + '"]', 'select[name="rangetime' + resource_id + '[]"]', 'select[name="starttime' + resource_id + '"]', 'select[name="starttime' + resource_id + '[]"]', 'select[name="endtime' + resource_id + '"]', 'select[name="endtime' + resource_id + '[]"]', 'select[name="durationtime' + resource_id + '"]', 'select[name="durationtime' + resource_id + '[]"]'];
  var time_fields_obj_arr = [];

  // Loop all Time Fields
  for (var ctf = 0; ctf < time_fields_arr.length; ctf++) {
    var time_field = time_fields_arr[ctf];
    var time_option;
    if (is_only_selected_time) {
      time_option = jQuery('#booking_form' + resource_id + ' ' + time_field + ' option:selected'); // Exclude conditional  fields,  because of using '#booking_form3 ...'
    } else {
      time_option = jQuery('#booking_form' + resource_id + ' ' + time_field + ' option'); // All  time fields
    }

    // Loop all options in time field
    for (var j = 0; j < time_option.length; j++) {
      var jquery_option = jQuery(time_option[j]); // Get only  selected options 	//jQuery( time_field + ' option:eq(' + j + ')' );
      var value_option_seconds_arr = jquery_option.val().split('-');
      var times_as_seconds = [];

      // Get time as seconds
      if (value_option_seconds_arr.length) {
        // FixIn: 9.8.10.1.
        for (var i = 0; i < value_option_seconds_arr.length; i++) {
          // FixIn: 10.0.0.56.
          // value_option_seconds_arr[i] = '14:00 '  | ' 16:00'   (if from 'rangetime') and '16:00'  if (start/end time)

          var start_end_times_arr = value_option_seconds_arr[i].trim().split(':');
          var time_in_seconds = parseInt(start_end_times_arr[0]) * 60 * 60 + parseInt(start_end_times_arr[1]) * 60;
          times_as_seconds.push(time_in_seconds);
        }
      }
      time_fields_obj_arr.push({
        'name': jQuery('#booking_form' + resource_id + ' ' + time_field).attr('name'),
        'value_option_24h': jquery_option.val(),
        'jquery_option': jquery_option,
        'times_as_seconds': times_as_seconds
      });
    }
  }

  // Text:   [starttime] - [endtime] -----------------------------------------------------------------------------

  var text_time_fields_arr = ['input[name="starttime' + resource_id + '"]', 'input[name="endtime' + resource_id + '"]'];
  for (var tf = 0; tf < text_time_fields_arr.length; tf++) {
    var text_jquery = jQuery('#booking_form' + resource_id + ' ' + text_time_fields_arr[tf]); // Exclude conditional  fields,  because of using '#booking_form3 ...'
    if (text_jquery.length > 0) {
      var time__h_m__arr = text_jquery.val().trim().split(':'); // '14:00'
      if (0 == time__h_m__arr.length) {
        continue; // Not entered time value in a field
      }
      if (1 == time__h_m__arr.length) {
        if ('' === time__h_m__arr[0]) {
          continue; // Not entered time value in a field
        }
        time__h_m__arr[1] = 0;
      }
      var text_time_in_seconds = parseInt(time__h_m__arr[0]) * 60 * 60 + parseInt(time__h_m__arr[1]) * 60;
      var text_times_as_seconds = [];
      text_times_as_seconds.push(text_time_in_seconds);
      time_fields_obj_arr.push({
        'name': text_jquery.attr('name'),
        'value_option_24h': text_jquery.val(),
        'jquery_option': text_jquery,
        'times_as_seconds': text_times_as_seconds
      });
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
function wpbc_calendar__get_inst(resource_id) {
  if ('undefined' === typeof resource_id) {
    resource_id = '1';
  }
  if (jQuery('#calendar_booking' + resource_id).length > 0) {
    return jQuery.datepick._getInst(jQuery('#calendar_booking' + resource_id).get(0));
  }
  return null;
}

/**
 * Unselect  all dates in calendar and visually update this calendar
 *
 * @param resource_id		ID of booking resource
 * @returns {boolean}		true on success | false,  if no such  calendar
 */
function wpbc_calendar__unselect_all_dates(resource_id) {
  if ('undefined' === typeof resource_id) {
    resource_id = '1';
  }
  var inst = wpbc_calendar__get_inst(resource_id);
  if (null !== inst) {
    // Unselect all dates and set  properties of Datepick
    jQuery('#date_booking' + resource_id).val(''); //FixIn: 5.4.3
    inst.stayOpen = false;
    inst.dates = [];
    jQuery.datepick._updateDatepick(inst);
    return true;
  }
  return false;
}

/**
 * Clear days highlighting in All or specific Calendars
 *
    * @param resource_id  - can be skiped to  clear highlighting in all calendars
    */
function wpbc_calendars__clear_days_highlighting(resource_id) {
  if ('undefined' !== typeof resource_id) {
    jQuery('#calendar_booking' + resource_id + ' .datepick-days-cell-over').removeClass('datepick-days-cell-over'); // Clear in specific calendar
  } else {
    jQuery('.datepick-days-cell-over').removeClass('datepick-days-cell-over'); // Clear in all calendars
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
function wpbc_calendar__scroll_to(resource_id, year, month) {
  if ('undefined' === typeof resource_id) {
    resource_id = '1';
  }
  var inst = wpbc_calendar__get_inst(resource_id);
  if (null !== inst) {
    year = parseInt(year);
    month = parseInt(month) - 1; // In JS date,  month -1

    inst.cursorDate = new Date();
    // In some cases,  the setFullYear can  set  only Year,  and not the Month and day      // FixIn: 6.2.3.5.
    inst.cursorDate.setFullYear(year, month, 1);
    inst.cursorDate.setMonth(month);
    inst.cursorDate.setDate(1);
    inst.drawMonth = inst.cursorDate.getMonth();
    inst.drawYear = inst.cursorDate.getFullYear();
    jQuery.datepick._notifyChange(inst);
    jQuery.datepick._adjustInstDate(inst);
    jQuery.datepick._showDate(inst);
    jQuery.datepick._updateDatepick(inst);
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
function wpbc_is_this_day_selectable(resource_id, sql_class_day) {
  // Get Data --------------------------------------------------------------------------------------------------------
  var date_bookings_obj = _wpbc.bookings_in_calendar__get_for_date(resource_id, sql_class_day);
  var is_day_selectable = parseInt(date_bookings_obj['day_availability']) > 0;
  if (typeof date_bookings_obj['summary'] === 'undefined') {
    return is_day_selectable;
  }
  if ('available' != date_bookings_obj['summary']['status_for_day']) {
    var is_set_pending_days_selectable = _wpbc.calendar__get_param_value(resource_id, 'pending_days_selectable'); // set pending days selectable          // FixIn: 8.6.1.18.

    switch (date_bookings_obj['summary']['status_for_bookings']) {
      case 'pending':
      // Situations for "change-over" days:
      case 'pending_pending':
      case 'pending_approved':
      case 'approved_pending':
        is_day_selectable = is_day_selectable ? true : is_set_pending_days_selectable;
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
function wpbc_is_this_day_among_selected_days(js_date_to_check, js_dates_arr) {
  for (var date_index = 0; date_index < js_dates_arr.length; date_index++) {
    // FixIn: 8.4.5.16.
    if (js_dates_arr[date_index].getFullYear() === js_date_to_check.getFullYear() && js_dates_arr[date_index].getMonth() === js_date_to_check.getMonth() && js_dates_arr[date_index].getDate() === js_date_to_check.getDate()) {
      return true;
    }
  }
  return false;
}

/**
 * Get SQL Class Date '2023-08-01' from  JS Date
 *
 * @param date				JS Date
 * @returns {string}		'2023-08-12'
 */
function wpbc__get__sql_class_date(date) {
  var sql_class_day = date.getFullYear() + '-';
  sql_class_day += date.getMonth() + 1 < 10 ? '0' : '';
  sql_class_day += date.getMonth() + 1 + '-';
  sql_class_day += date.getDate() < 10 ? '0' : '';
  sql_class_day += date.getDate();
  return sql_class_day;
}

/**
 * Get JS Date from  the SQL date format '2024-05-14'
 * @param sql_class_date
 * @returns {Date}
 */
function wpbc__get__js_date(sql_class_date) {
  var sql_class_date_arr = sql_class_date.split('-');
  var date_js = new Date();
  date_js.setFullYear(parseInt(sql_class_date_arr[0]), parseInt(sql_class_date_arr[1]) - 1, parseInt(sql_class_date_arr[2])); // year, month, date

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
function wpbc__get__td_class_date(date) {
  var td_class_day = date.getMonth() + 1 + '-' + date.getDate() + '-' + date.getFullYear(); // '1-9-2023'

  return td_class_day;
}

/**
 * Get date params from  string date
 *
 * @param date			string date like '31.5.2023'
 * @param separator		default '.'  can be skipped.
 * @returns {  {date: number, month: number, year: number}  }
 */
function wpbc__get__date_params__from_string_date(date, separator) {
  separator = 'undefined' !== typeof separator ? separator : '.';
  var date_arr = date.split(separator);
  var date_obj = {
    'year': parseInt(date_arr[2]),
    'month': parseInt(date_arr[1]) - 1,
    'date': parseInt(date_arr[0])
  };
  return date_obj; // for 		 = new Date( date_obj.year , date_obj.month , date_obj.date );
}

/**
 * Add Spin Loader to  calendar
 * @param resource_id
 */
function wpbc_calendar__loading__start(resource_id) {
  if (!jQuery('#calendar_booking' + resource_id).next().hasClass('wpbc_spins_loader_wrapper')) {
    jQuery('#calendar_booking' + resource_id).after('<div class="wpbc_spins_loader_wrapper"><div class="wpbc_spins_loader"></div></div>');
  }
  if (!jQuery('#calendar_booking' + resource_id).hasClass('wpbc_calendar_blur_small')) {
    jQuery('#calendar_booking' + resource_id).addClass('wpbc_calendar_blur_small');
  }
  wpbc_calendar__blur__start(resource_id);
}

/**
 * Remove Spin Loader to  calendar
 * @param resource_id
 */
function wpbc_calendar__loading__stop(resource_id) {
  jQuery('#calendar_booking' + resource_id + ' + .wpbc_spins_loader_wrapper').remove();
  jQuery('#calendar_booking' + resource_id).removeClass('wpbc_calendar_blur_small');
  wpbc_calendar__blur__stop(resource_id);
}

/**
 * Add Blur to  calendar
 * @param resource_id
 */
function wpbc_calendar__blur__start(resource_id) {
  if (!jQuery('#calendar_booking' + resource_id).hasClass('wpbc_calendar_blur')) {
    jQuery('#calendar_booking' + resource_id).addClass('wpbc_calendar_blur');
  }
}

/**
 * Remove Blur in  calendar
 * @param resource_id
 */
function wpbc_calendar__blur__stop(resource_id) {
  jQuery('#calendar_booking' + resource_id).removeClass('wpbc_calendar_blur');
}

// .................................................................................................................
/*  ==  Calendar Update  - View  ==
// ................................................................................................................. */

/**
 * Update Look  of calendar
 *
 * @param resource_id
 */
function wpbc_calendar__update_look(resource_id) {
  var inst = wpbc_calendar__get_inst(resource_id);
  jQuery.datepick._updateDatepick(inst);
}

/**
 * Update dynamically Number of Months in calendar
 *
 * @param resource_id int
 * @param months_number int
 */
function wpbc_calendar__update_months_number(resource_id, months_number) {
  var inst = wpbc_calendar__get_inst(resource_id);
  if (null !== inst) {
    inst.settings['numberOfMonths'] = months_number;
    //_wpbc.calendar__set_param_value( resource_id, 'calendar_number_of_months', months_number );
    wpbc_calendar__update_look(resource_id);
  }
}

/**
 * Show calendar in  different Skin
 *
 * @param selected_skin_url
 */
function wpbc__calendar__change_skin(selected_skin_url) {
  //console.log( 'SKIN SELECTION ::', selected_skin_url );

  // Remove CSS skin
  var stylesheet = document.getElementById('wpbc-calendar-skin-css');
  stylesheet.parentNode.removeChild(stylesheet);

  // Add new CSS skin
  var headID = document.getElementsByTagName("head")[0];
  var cssNode = document.createElement('link');
  cssNode.type = 'text/css';
  cssNode.setAttribute("id", "wpbc-calendar-skin-css");
  cssNode.rel = 'stylesheet';
  cssNode.media = 'screen';
  cssNode.href = selected_skin_url; //"http://beta/wp-content/plugins/booking/css/skins/green-01.css";
  headID.appendChild(cssNode);
}
function wpbc__css__change_skin(selected_skin_url) {
  var stylesheet_id = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'wpbc-time_picker-skin-css';
  // Remove CSS skin
  var stylesheet = document.getElementById(stylesheet_id);
  stylesheet.parentNode.removeChild(stylesheet);

  // Add new CSS skin
  var headID = document.getElementsByTagName("head")[0];
  var cssNode = document.createElement('link');
  cssNode.type = 'text/css';
  cssNode.setAttribute("id", stylesheet_id);
  cssNode.rel = 'stylesheet';
  cssNode.media = 'screen';
  cssNode.href = selected_skin_url; //"http://beta/wp-content/plugins/booking/css/skins/green-01.css";
  headID.appendChild(cssNode);
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
function wpbc_intervals__merge_inersected(intervals) {
  if (!intervals || intervals.length === 0) {
    return [];
  }
  var merged = [];
  intervals.sort(function (a, b) {
    return a[0] - b[0];
  });
  var mergedInterval = intervals[0];
  for (var i = 1; i < intervals.length; i++) {
    var interval = intervals[i];
    if (interval[0] <= mergedInterval[1]) {
      mergedInterval[1] = Math.max(mergedInterval[1], interval[1]);
    } else {
      merged.push(mergedInterval);
      mergedInterval = interval;
    }
  }
  merged.push(mergedInterval);
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
function wpbc_intervals__is_intersected(interval_A, interval_B) {
  if (0 == interval_A.length || 0 == interval_B.length) {
    return false;
  }
  interval_A[0] = parseInt(interval_A[0]);
  interval_A[1] = parseInt(interval_A[1]);
  interval_B[0] = parseInt(interval_B[0]);
  interval_B[1] = parseInt(interval_B[1]);
  var is_intersected = Math.max(interval_A[0], interval_B[0]) - Math.min(interval_A[1], interval_B[1]);

  // if ( 0 == is_intersected ) {
  //	                                 // Such ranges going one after other, e.g.: [ 12, 15 ] and [ 15, 21 ]
  // }

  if (is_intersected < 0) {
    return true; // INTERSECTED
  }
  return false; // Not intersected
}

/**
 * Get the closets ABS value of element in array to the current myValue
 *
 * @param myValue 	- int element to search closet 			4
 * @param myArray	- array of elements where to search 	[5,8,1,7]
 * @returns int												5
 */
function wpbc_get_abs_closest_value_in_arr(myValue, myArray) {
  if (myArray.length == 0) {
    // If the array is empty -> return  the myValue
    return myValue;
  }
  var obj = myArray[0];
  var diff = Math.abs(myValue - obj); // Get distance between  1st element
  var closetValue = myArray[0]; // Save 1st element

  for (var i = 1; i < myArray.length; i++) {
    obj = myArray[i];
    if (Math.abs(myValue - obj) < diff) {
      // we found closer value -> save it
      diff = Math.abs(myValue - obj);
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
function wpbc_set_tooltip___for__calendar_date(tooltip_text, resource_id, td_class) {
  //TODO: make escaping of text for quot symbols,  and JS/HTML...

  jQuery('#calendar_booking' + resource_id + ' td.cal4date-' + td_class).attr('data-content', tooltip_text);
  var td_el = jQuery('#calendar_booking' + resource_id + ' td.cal4date-' + td_class).get(0); // FixIn: 9.0.1.1.

  if ('undefined' !== typeof td_el && undefined == td_el._tippy && '' !== tooltip_text) {
    wpbc_tippy(td_el, {
      content: function content(reference) {
        var popover_content = reference.getAttribute('data-content');
        return '<div class="popover popover_tippy">' + '<div class="popover-content">' + popover_content + '</div>' + '</div>';
      },
      allowHTML: true,
      trigger: 'mouseenter focus',
      interactive: false,
      hideOnClick: true,
      interactiveBorder: 10,
      maxWidth: 550,
      theme: 'wpbc-tippy-times',
      placement: 'top',
      delay: [400, 0],
      // FixIn: 9.4.2.2.
      //delay			 : [0, 9999999999],						// Debuge  tooltip
      ignoreAttributes: true,
      touch: true,
      //['hold', 500], // 500ms delay				// FixIn: 9.2.1.5.
      appendTo: function appendTo() {
        return document.body;
      }
    });
    return true;
  }
  return false;
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
  var difference_ms = date1_ms - date2_ms;

  // Convert back to days and return
  return Math.round(difference_ms / ONE_DAY);
}

/**
 * Check  if this array  of dates is consecutive array  of dates or not.
 * 		e.g.  ['2024-05-09','2024-05-19','2024-05-30'] -> false
 * 		e.g.  ['2024-05-09','2024-05-10','2024-05-11'] -> true
 * @param sql_dates_arr	 array		e.g.: ['2024-05-09','2024-05-19','2024-05-30']
 * @returns {boolean}
 */
function wpbc_dates__is_consecutive_dates_arr_range(sql_dates_arr) {
  // FixIn: 10.0.0.50.

  if (sql_dates_arr.length > 1) {
    var previos_date = wpbc__get__js_date(sql_dates_arr[0]);
    var current_date;
    for (var i = 1; i < sql_dates_arr.length; i++) {
      current_date = wpbc__get__js_date(sql_dates_arr[i]);
      if (wpbc_dates__days_between(current_date, previos_date) != 1) {
        return false;
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
function wpbc_auto_select_dates_in_calendar(resource_id, check_in_ymd) {
  var check_out_ymd = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  // FixIn: 10.0.0.47.

  console.log('WPBC_AUTO_SELECT_DATES_IN_CALENDAR( RESOURCE_ID, CHECK_IN_YMD, CHECK_OUT_YMD )', resource_id, check_in_ymd, check_out_ymd);
  if ('2100-01-01' == check_in_ymd || '2100-01-01' == check_out_ymd || '' == check_in_ymd && '' == check_out_ymd) {
    return 0;
  }

  // -----------------------------------------------------------------------------------------------------------------
  // If 	check_in_ymd  =  [ '2024-05-09','2024-05-19','2024-05-30' ]				ARRAY of DATES						// FixIn: 10.0.0.50.
  // -----------------------------------------------------------------------------------------------------------------
  var dates_to_select_arr = [];
  if (Array.isArray(check_in_ymd)) {
    dates_to_select_arr = wpbc_clone_obj(check_in_ymd);

    // -------------------------------------------------------------------------------------------------------------
    // Exceptions to  set  	MULTIPLE DAYS 	mode
    // -------------------------------------------------------------------------------------------------------------
    // if dates as NOT CONSECUTIVE: ['2024-05-09','2024-05-19','2024-05-30'], -> set MULTIPLE DAYS mode
    if (dates_to_select_arr.length > 0 && '' == check_out_ymd && !wpbc_dates__is_consecutive_dates_arr_range(dates_to_select_arr)) {
      wpbc_cal_days_select__multiple(resource_id);
    }
    // if multiple days to select, but enabled SINGLE day mode, -> set MULTIPLE DAYS mode
    if (dates_to_select_arr.length > 1 && '' == check_out_ymd && 'single' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      wpbc_cal_days_select__multiple(resource_id);
    }
    // -------------------------------------------------------------------------------------------------------------
    check_in_ymd = dates_to_select_arr[0];
    if ('' == check_out_ymd) {
      check_out_ymd = dates_to_select_arr[dates_to_select_arr.length - 1];
    }
  }
  // -----------------------------------------------------------------------------------------------------------------

  if ('' == check_in_ymd) {
    check_in_ymd = check_out_ymd;
  }
  if ('' == check_out_ymd) {
    check_out_ymd = check_in_ymd;
  }
  if ('undefined' === typeof resource_id) {
    resource_id = '1';
  }
  var inst = wpbc_calendar__get_inst(resource_id);
  if (null !== inst) {
    // Unselect all dates and set  properties of Datepick
    jQuery('#date_booking' + resource_id).val(''); //FixIn: 5.4.3
    inst.stayOpen = false;
    inst.dates = [];
    var check_in_js = wpbc__get__js_date(check_in_ymd);
    var td_cell = wpbc_get_clicked_td(inst.id, check_in_js);

    // Is ome type of error, then select multiple days selection  mode.
    if ('' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      _wpbc.calendar__set_param_value(resource_id, 'days_select_mode', 'multiple');
    }

    // ---------------------------------------------------------------------------------------------------------
    //  == DYNAMIC ==
    if ('dynamic' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      // 1-st click
      inst.stayOpen = false;
      jQuery.datepick._selectDay(td_cell, '#' + inst.id, check_in_js.getTime());
      if (0 === inst.dates.length) {
        return 0; // First click  was unsuccessful, so we must not make other click
      }

      // 2-nd click
      var check_out_js = wpbc__get__js_date(check_out_ymd);
      var td_cell_out = wpbc_get_clicked_td(inst.id, check_out_js);
      inst.stayOpen = true;
      jQuery.datepick._selectDay(td_cell_out, '#' + inst.id, check_out_js.getTime());
    }

    // ---------------------------------------------------------------------------------------------------------
    //  == FIXED ==
    if ('fixed' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      jQuery.datepick._selectDay(td_cell, '#' + inst.id, check_in_js.getTime());
    }

    // ---------------------------------------------------------------------------------------------------------
    //  == SINGLE ==
    if ('single' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      //jQuery.datepick._restrictMinMax( inst, jQuery.datepick._determineDate( inst, check_in_js, null ) );		// Do we need to run  this ? Please note, check_in_js must  have time,  min, sec defined to 0!
      jQuery.datepick._selectDay(td_cell, '#' + inst.id, check_in_js.getTime());
    }

    // ---------------------------------------------------------------------------------------------------------
    //  == MULTIPLE ==
    if ('multiple' === _wpbc.calendar__get_param_value(resource_id, 'days_select_mode')) {
      var dates_arr;
      if (dates_to_select_arr.length > 0) {
        // Situation, when we have dates array: ['2024-05-09','2024-05-19','2024-05-30'].  and not the Check In / Check  out dates as parameter in this function
        dates_arr = wpbc_get_selection_dates_js_str_arr__from_arr(dates_to_select_arr);
      } else {
        dates_arr = wpbc_get_selection_dates_js_str_arr__from_check_in_out(check_in_ymd, check_out_ymd, inst);
      }
      if (0 === dates_arr.dates_js.length) {
        return 0;
      }

      // For Calendar Days selection
      for (var j = 0; j < dates_arr.dates_js.length; j++) {
        // Loop array of dates

        var str_date = wpbc__get__sql_class_date(dates_arr.dates_js[j]);

        // Date unavailable !
        if (0 == _wpbc.bookings_in_calendar__get_for_date(resource_id, str_date).day_availability) {
          return 0;
        }
        if (dates_arr.dates_js[j] != -1) {
          inst.dates.push(dates_arr.dates_js[j]);
        }
      }
      var check_out_date = dates_arr.dates_js[dates_arr.dates_js.length - 1];
      inst.dates.push(check_out_date); // Need add one additional SAME date for correct  works of dates selection !!!!!

      var checkout_timestamp = check_out_date.getTime();
      var td_cell = wpbc_get_clicked_td(inst.id, check_out_date);
      jQuery.datepick._selectDay(td_cell, '#' + inst.id, checkout_timestamp);
    }
    if (0 !== inst.dates.length) {
      // Scroll to specific month, if we set dates in some future months
      wpbc_calendar__scroll_to(resource_id, inst.dates[0].getFullYear(), inst.dates[0].getMonth() + 1);
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
function wpbc_get_clicked_td(calendar_html_id, date_js) {
  var td_cell = jQuery('#' + calendar_html_id + ' .sql_date_' + wpbc__get__sql_class_date(date_js)).get(0);
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
function wpbc_get_selection_dates_js_str_arr__from_check_in_out(check_in_ymd, check_out_ymd, inst) {
  var original_array = [];
  var date;
  var bk_distinct_dates = [];
  var check_in_date = check_in_ymd.split('-');
  var check_out_date = check_out_ymd.split('-');
  date = new Date();
  date.setFullYear(check_in_date[0], check_in_date[1] - 1, check_in_date[2]); // year, month, date
  var original_check_in_date = date;
  original_array.push(jQuery.datepick._restrictMinMax(inst, jQuery.datepick._determineDate(inst, date, null))); //add date
  if (!wpbc_in_array(bk_distinct_dates, check_in_date[2] + '.' + check_in_date[1] + '.' + check_in_date[0])) {
    bk_distinct_dates.push(parseInt(check_in_date[2]) + '.' + parseInt(check_in_date[1]) + '.' + check_in_date[0]);
  }
  var date_out = new Date();
  date_out.setFullYear(check_out_date[0], check_out_date[1] - 1, check_out_date[2]); // year, month, date
  var original_check_out_date = date_out;
  var mewDate = new Date(original_check_in_date.getFullYear(), original_check_in_date.getMonth(), original_check_in_date.getDate());
  mewDate.setDate(original_check_in_date.getDate() + 1);
  while (original_check_out_date > date && original_check_in_date != original_check_out_date) {
    date = new Date(mewDate.getFullYear(), mewDate.getMonth(), mewDate.getDate());
    original_array.push(jQuery.datepick._restrictMinMax(inst, jQuery.datepick._determineDate(inst, date, null))); //add date
    if (!wpbc_in_array(bk_distinct_dates, date.getDate() + '.' + parseInt(date.getMonth() + 1) + '.' + date.getFullYear())) {
      bk_distinct_dates.push(parseInt(date.getDate()) + '.' + parseInt(date.getMonth() + 1) + '.' + date.getFullYear());
    }
    mewDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    mewDate.setDate(mewDate.getDate() + 1);
  }
  original_array.pop();
  bk_distinct_dates.pop();
  return {
    'dates_js': original_array,
    'dates_str': bk_distinct_dates
  };
}

/**
 * Get arrays of JS and SQL dates as dates array
 *
 * @param dates_to_select_arr	= ['2024-05-09','2024-05-19','2024-05-30']
 *
 * @returns {{dates_js: *[], dates_str: *[]}}
 */
function wpbc_get_selection_dates_js_str_arr__from_arr(dates_to_select_arr) {
  // FixIn: 10.0.0.50.

  var original_array = [];
  var bk_distinct_dates = [];
  var one_date_str;
  for (var d = 0; d < dates_to_select_arr.length; d++) {
    original_array.push(wpbc__get__js_date(dates_to_select_arr[d]));
    one_date_str = dates_to_select_arr[d].split('-');
    if (!wpbc_in_array(bk_distinct_dates, one_date_str[2] + '.' + one_date_str[1] + '.' + one_date_str[0])) {
      bk_distinct_dates.push(parseInt(one_date_str[2]) + '.' + parseInt(one_date_str[1]) + '.' + one_date_str[0]);
    }
  }
  return {
    'dates_js': original_array,
    'dates_str': original_array
  };
}

// =====================================================================================================================
/*  ==  Auto Fill Fields / Auto Select Dates  ==
// ===================================================================================================================== */

jQuery(document).ready(function () {
  var url_params = new URLSearchParams(window.location.search);

  // Disable days selection  in calendar,  after  redirection  from  the "Search results page,  after  search  availability" 			// FixIn: 8.8.2.3.
  if ('On' != _wpbc.get_other_param('is_enabled_booking_search_results_days_select')) {
    if (url_params.has('wpbc_select_check_in') && url_params.has('wpbc_select_check_out') && url_params.has('wpbc_select_calendar_id')) {
      var select_dates_in_calendar_id = parseInt(url_params.get('wpbc_select_calendar_id'));

      // Fire on all booking dates loaded
      jQuery('body').on('wpbc_calendar_ajx__loaded_data', function (event, loaded_resource_id) {
        if (loaded_resource_id == select_dates_in_calendar_id) {
          wpbc_auto_select_dates_in_calendar(select_dates_in_calendar_id, url_params.get('wpbc_select_check_in'), url_params.get('wpbc_select_check_out'));
        }
      });
    }
  }
  if (url_params.has('wpbc_auto_fill')) {
    var wpbc_auto_fill_value = url_params.get('wpbc_auto_fill');

    // Convert back.     Some systems do not like symbol '~' in URL, so  we need to replace to  some other symbols
    wpbc_auto_fill_value = wpbc_auto_fill_value.replaceAll('_^_', '~');
    wpbc_auto_fill_booking_fields(wpbc_auto_fill_value);
  }
});

/**
 * Autofill / select booking form  fields by  values from  the GET request  parameter: ?wpbc_auto_fill=
 *
 * @param auto_fill_str
 */
function wpbc_auto_fill_booking_fields(auto_fill_str) {
  // FixIn: 10.0.0.48.

  if ('' == auto_fill_str) {
    return;
  }

  // console.log( 'WPBC_AUTO_FILL_BOOKING_FIELDS( AUTO_FILL_STR )', auto_fill_str);

  var fields_arr = wpbc_auto_fill_booking_fields__parse(auto_fill_str);
  for (var i = 0; i < fields_arr.length; i++) {
    jQuery('[name="' + fields_arr[i]['name'] + '"]').val(fields_arr[i]['value']);
  }
}

/**
 * Parse data from  get parameter:	?wpbc_auto_fill=visitors231^2~max_capacity231^2
 *
 * @param data_str      =   'visitors231^2~max_capacity231^2';
 * @returns {*}
 */
function wpbc_auto_fill_booking_fields__parse(data_str) {
  var filter_options_arr = [];
  var data_arr = data_str.split('~');
  for (var j = 0; j < data_arr.length; j++) {
    var my_form_field = data_arr[j].split('^');
    var filter_name = 'undefined' !== typeof my_form_field[0] ? my_form_field[0] : '';
    var filter_value = 'undefined' !== typeof my_form_field[1] ? my_form_field[1] : '';
    filter_options_arr.push({
      'name': filter_name,
      'value': filter_value
    });
  }
  return filter_options_arr;
}

/**
 * Parse data from  get parameter:	?search_get__custom_params=...
 *
 * @param data_str      =   'text^search_field__display_check_in^23.05.2024~text^search_field__display_check_out^26.05.2024~selectbox-one^search_quantity^2~selectbox-one^location^Spain~selectbox-one^max_capacity^2~selectbox-one^amenity^parking~checkbox^search_field__extend_search_days^5~submit^^Search~hidden^search_get__check_in_ymd^2024-05-23~hidden^search_get__check_out_ymd^2024-05-26~hidden^search_get__time^~hidden^search_get__quantity^2~hidden^search_get__extend^5~hidden^search_get__users_id^~hidden^search_get__custom_params^~';
 * @returns {*}
 */
function wpbc_auto_fill_search_fields__parse(data_str) {
  var filter_options_arr = [];
  var data_arr = data_str.split('~');
  for (var j = 0; j < data_arr.length; j++) {
    var my_form_field = data_arr[j].split('^');
    var filter_type = 'undefined' !== typeof my_form_field[0] ? my_form_field[0] : '';
    var filter_name = 'undefined' !== typeof my_form_field[1] ? my_form_field[1] : '';
    var filter_value = 'undefined' !== typeof my_form_field[2] ? my_form_field[2] : '';
    filter_options_arr.push({
      'type': filter_type,
      'name': filter_name,
      'value': filter_value
    });
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
function wpbc_calendar__auto_update_months_number__on_resize(resource_id) {
  if (true === _wpbc.get_other_param('is_allow_several_months_on_mobile')) {
    return false;
  }
  var local__number_of_months = parseInt(_wpbc.calendar__get_param_value(resource_id, 'calendar_number_of_months'));
  if (local__number_of_months > 1) {
    if (jQuery(window).width() <= 782) {
      wpbc_calendar__update_months_number(resource_id, 1);
    } else {
      wpbc_calendar__update_months_number(resource_id, local__number_of_months);
    }
  }
}

/**
 * Auto Update Number of Months in   ALL   Calendars
 *
 */
function wpbc_calendars__auto_update_months_number() {
  var all_calendars_arr = _wpbc.calendars_all__get();

  // This LOOP "for in" is GOOD, because we check  here keys    'calendar_' === calendar_id.slice( 0, 9 )
  for (var calendar_id in all_calendars_arr) {
    if ('calendar_' === calendar_id.slice(0, 9)) {
      var resource_id = parseInt(calendar_id.slice(9)); //  'calendar_3' -> 3
      if (resource_id > 0) {
        wpbc_calendar__auto_update_months_number__on_resize(resource_id);
      }
    }
  }
}

/**
 * If browser window changed,  then  update number of months.
 */
jQuery(window).on('resize', function () {
  wpbc_calendars__auto_update_months_number();
});

/**
 * Auto update calendar number of months on initial page load
 */
jQuery(document).ready(function () {
  var closed_timer = setTimeout(function () {
    wpbc_calendars__auto_update_months_number();
  }, 100);
});
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
function wpbc_cal__re_init(resource_id) {
  // Remove CLASS  for ability to re-render and reinit calendar.
  jQuery('#calendar_booking' + resource_id).removeClass('hasDatepick');
  wpbc_calendar_show(resource_id);
}

/**
 * Re-Init previously  saved days selection  variables.
 *
 * @param resource_id
 */
function wpbc_cal_days_select__re_init(resource_id) {
  _wpbc.calendar__set_param_value(resource_id, 'saved_variable___days_select_initial', {
    'dynamic__days_min': _wpbc.calendar__get_param_value(resource_id, 'dynamic__days_min'),
    'dynamic__days_max': _wpbc.calendar__get_param_value(resource_id, 'dynamic__days_max'),
    'dynamic__days_specific': _wpbc.calendar__get_param_value(resource_id, 'dynamic__days_specific'),
    'dynamic__week_days__start': _wpbc.calendar__get_param_value(resource_id, 'dynamic__week_days__start'),
    'fixed__days_num': _wpbc.calendar__get_param_value(resource_id, 'fixed__days_num'),
    'fixed__week_days__start': _wpbc.calendar__get_param_value(resource_id, 'fixed__week_days__start')
  });
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set Single Day selection - after page load
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_ready_days_select__single(resource_id) {
  // Re-define selection, only after page loaded with all init vars
  jQuery(document).ready(function () {
    // Wait 1 second, just to  be sure, that all init vars defined
    setTimeout(function () {
      wpbc_cal_days_select__single(resource_id);
    }, 1000);
  });
}

/**
 * Set Single Day selection
 * Can be run at any  time,  when  calendar defined - useful for console run.
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_days_select__single(resource_id) {
  _wpbc.calendar__set_parameters(resource_id, {
    'days_select_mode': 'single'
  });
  wpbc_cal_days_select__re_init(resource_id);
  wpbc_cal__re_init(resource_id);
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set Multiple Days selection  - after page load
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_ready_days_select__multiple(resource_id) {
  // Re-define selection, only after page loaded with all init vars
  jQuery(document).ready(function () {
    // Wait 1 second, just to  be sure, that all init vars defined
    setTimeout(function () {
      wpbc_cal_days_select__multiple(resource_id);
    }, 1000);
  });
}

/**
 * Set Multiple Days selection
 * Can be run at any  time,  when  calendar defined - useful for console run.
 *
 * @param resource_id		ID of booking resource
 */
function wpbc_cal_days_select__multiple(resource_id) {
  _wpbc.calendar__set_parameters(resource_id, {
    'days_select_mode': 'multiple'
  });
  wpbc_cal_days_select__re_init(resource_id);
  wpbc_cal__re_init(resource_id);
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set Fixed Days selection with  1 mouse click  - after page load
 *
 * @integer resource_id			- 1				   -- ID of booking resource (calendar) -
 * @integer days_number			- 3				   -- number of days to  select	-
 * @array week_days__start	- [-1] | [ 1, 5]   --  { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }
 */
function wpbc_cal_ready_days_select__fixed(resource_id, days_number) {
  var week_days__start = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [-1];
  // Re-define selection, only after page loaded with all init vars
  jQuery(document).ready(function () {
    // Wait 1 second, just to  be sure, that all init vars defined
    setTimeout(function () {
      wpbc_cal_days_select__fixed(resource_id, days_number, week_days__start);
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
function wpbc_cal_days_select__fixed(resource_id, days_number) {
  var week_days__start = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [-1];
  _wpbc.calendar__set_parameters(resource_id, {
    'days_select_mode': 'fixed'
  });
  _wpbc.calendar__set_parameters(resource_id, {
    'fixed__days_num': parseInt(days_number)
  }); // Number of days selection with 1 mouse click
  _wpbc.calendar__set_parameters(resource_id, {
    'fixed__week_days__start': week_days__start
  }); // { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }

  wpbc_cal_days_select__re_init(resource_id);
  wpbc_cal__re_init(resource_id);
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
function wpbc_cal_ready_days_select__range(resource_id, days_min, days_max) {
  var days_specific = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  var week_days__start = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [-1];
  // Re-define selection, only after page loaded with all init vars
  jQuery(document).ready(function () {
    // Wait 1 second, just to  be sure, that all init vars defined
    setTimeout(function () {
      wpbc_cal_days_select__range(resource_id, days_min, days_max, days_specific, week_days__start);
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
function wpbc_cal_days_select__range(resource_id, days_min, days_max) {
  var days_specific = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  var week_days__start = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [-1];
  _wpbc.calendar__set_parameters(resource_id, {
    'days_select_mode': 'dynamic'
  });
  _wpbc.calendar__set_param_value(resource_id, 'dynamic__days_min', parseInt(days_min)); // Min. Number of days selection with 2 mouse clicks
  _wpbc.calendar__set_param_value(resource_id, 'dynamic__days_max', parseInt(days_max)); // Max. Number of days selection with 2 mouse clicks
  _wpbc.calendar__set_param_value(resource_id, 'dynamic__days_specific', days_specific); // Example [5,7]
  _wpbc.calendar__set_param_value(resource_id, 'dynamic__week_days__start', week_days__start); // { -1 - Any | 0 - Su,  1 - Mo,  2 - Tu, 3 - We, 4 - Th, 5 - Fr, 6 - Sat }

  wpbc_cal_days_select__re_init(resource_id);
  wpbc_cal__re_init(resource_id);
}

/**
 * ====================================================================================================================
 *	includes/__js/cal_ajx_load/wpbc_cal_ajx.js
 * ====================================================================================================================
 */

// ---------------------------------------------------------------------------------------------------------------------
//  A j a x    L o a d    C a l e n d a r    D a t a
// ---------------------------------------------------------------------------------------------------------------------

function wpbc_calendar__load_data__ajx(params) {
  // FixIn: 9.8.6.2.
  wpbc_calendar__loading__start(params['resource_id']);

  // Trigger event for calendar before loading Booking data,  but after showing Calendar.
  if (jQuery('#calendar_booking' + params['resource_id']).length > 0) {
    var target_elm = jQuery('body').trigger("wpbc_calendar_ajx__before_loaded_data", [params['resource_id']]);
    //jQuery( 'body' ).on( 'wpbc_calendar_ajx__before_loaded_data', function( event, resource_id ) { ... } );
  }
  if (wpbc_balancer__is_wait(params, 'wpbc_calendar__load_data__ajx')) {
    return false;
  }

  // FixIn: 9.8.6.2.
  wpbc_calendar__blur__stop(params['resource_id']);

  // console.groupEnd(); console.time('resource_id_' + params['resource_id']);
  console.groupCollapsed('WPBC_AJX_CALENDAR_LOAD');
  console.log(' == Before Ajax Send - calendars_all__get() == ', _wpbc.calendars_all__get());

  // Start Ajax
  jQuery.post(wpbc_url_ajax, {
    action: 'WPBC_AJX_CALENDAR_LOAD',
    wpbc_ajx_user_id: _wpbc.get_secure_param('user_id'),
    nonce: _wpbc.get_secure_param('nonce'),
    wpbc_ajx_locale: _wpbc.get_secure_param('locale'),
    calendar_request_params: params // Usually like: { 'resource_id': 1, 'max_days_count': 365 }
  },
  /**
   * S u c c e s s
   *
   * @param response_data		-	its object returned from  Ajax - class-live-search.php
   * @param textStatus		-	'success'
   * @param jqXHR				-	Object
   */
  function (response_data, textStatus, jqXHR) {
    // console.timeEnd('resource_id_' + response_data['resource_id']);
    console.log(' == Response WPBC_AJX_CALENDAR_LOAD == ', response_data);
    console.groupEnd();

    // FixIn: 9.8.6.2.
    var ajx_post_data__resource_id = wpbc_get_resource_id__from_ajx_post_data_url(this.data);
    wpbc_balancer__completed(ajx_post_data__resource_id, 'wpbc_calendar__load_data__ajx');

    // Probably Error
    if (_typeof(response_data) !== 'object' || response_data === null) {
      var jq_node = wpbc_get_calendar__jq_node__for_messages(this.data);
      var message_type = 'info';
      if ('' === response_data) {
        response_data = 'The server responds with an empty string. The server probably stopped working unexpectedly. <br>Please check your <strong>error.log</strong> in your server configuration for relative errors.';
        message_type = 'warning';
      }

      // Show Message
      wpbc_front_end__show_message(response_data, {
        'type': message_type,
        'show_here': {
          'jq_node': jq_node,
          'where': 'after'
        },
        'is_append': true,
        'style': 'text-align:left;',
        'delay': 0
      });
      return;
    }

    // Show Calendar
    wpbc_calendar__loading__stop(response_data['resource_id']);

    // -------------------------------------------------------------------------------------------------
    // Bookings - Dates
    _wpbc.bookings_in_calendar__set_dates(response_data['resource_id'], response_data['ajx_data']['dates']);

    // Bookings - Child or only single booking resource in dates
    _wpbc.booking__set_param_value(response_data['resource_id'], 'resources_id_arr__in_dates', response_data['ajx_data']['resources_id_arr__in_dates']);

    // Aggregate booking resources,  if any ?
    _wpbc.booking__set_param_value(response_data['resource_id'], 'aggregate_resource_id_arr', response_data['ajx_data']['aggregate_resource_id_arr']);
    // -------------------------------------------------------------------------------------------------

    // Update calendar
    wpbc_calendar__update_look(response_data['resource_id']);
    if ('undefined' !== typeof response_data['ajx_data']['ajx_after_action_message'] && '' != response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />")) {
      var jq_node = wpbc_get_calendar__jq_node__for_messages(this.data);

      // Show Message
      wpbc_front_end__show_message(response_data['ajx_data']['ajx_after_action_message'].replace(/\n/g, "<br />"), {
        'type': 'undefined' !== typeof response_data['ajx_data']['ajx_after_action_message_status'] ? response_data['ajx_data']['ajx_after_action_message_status'] : 'info',
        'show_here': {
          'jq_node': jq_node,
          'where': 'after'
        },
        'is_append': true,
        'style': 'text-align:left;',
        'delay': 10000
      });
    }

    // Trigger event that calendar has been		 // FixIn: 10.0.0.44.
    if (jQuery('#calendar_booking' + response_data['resource_id']).length > 0) {
      var target_elm = jQuery('body').trigger("wpbc_calendar_ajx__loaded_data", [response_data['resource_id']]);
      //jQuery( 'body' ).on( 'wpbc_calendar_ajx__loaded_data', function( event, resource_id ) { ... } );
    }

    //jQuery( '#ajax_respond' ).html( response_data );		// For ability to show response, add such DIV element to page
  }).fail(function (jqXHR, textStatus, errorThrown) {
    if (window.console && window.console.log) {
      console.log('Ajax_Error', jqXHR, textStatus, errorThrown);
    }
    var ajx_post_data__resource_id = wpbc_get_resource_id__from_ajx_post_data_url(this.data);
    wpbc_balancer__completed(ajx_post_data__resource_id, 'wpbc_calendar__load_data__ajx');

    // Get Content of Error Message
    var error_message = '<strong>' + 'Error!' + '</strong> ' + errorThrown;
    if (jqXHR.status) {
      error_message += ' (<b>' + jqXHR.status + '</b>)';
      if (403 == jqXHR.status) {
        error_message += '<br> Probably nonce for this page has been expired. Please <a href="javascript:void(0)" onclick="javascript:location.reload();">reload the page</a>.';
        error_message += '<br> Otherwise, please check this <a style="font-weight: 600;" href="https://wpbookingcalendar.com/faq/request-do-not-pass-security-check/?after_update=10.1.1">troubleshooting instruction</a>.<br>';
      }
    }
    var message_show_delay = 3000;
    if (jqXHR.responseText) {
      error_message += ' ' + jqXHR.responseText;
      message_show_delay = 10;
    }
    error_message = error_message.replace(/\n/g, "<br />");
    var jq_node = wpbc_get_calendar__jq_node__for_messages(this.data);

    /**
     * If we make fast clicking on different pages,
     * then under calendar will show error message with  empty  text, because ajax was not received.
     * To  not show such warnings we are set delay  in 3 seconds.  var message_show_delay = 3000;
     */
    var closed_timer = setTimeout(function () {
      // Show Message
      wpbc_front_end__show_message(error_message, {
        'type': 'error',
        'show_here': {
          'jq_node': jq_node,
          'where': 'after'
        },
        'is_append': true,
        'style': 'text-align:left;',
        'css_class': 'wpbc_fe_message_alt',
        'delay': 0
      });
    }, parseInt(message_show_delay));
  })
  // .done(   function ( data, textStatus, jqXHR ) {   if ( window.console && window.console.log ){ console.log( 'second success', data, textStatus, jqXHR ); }    })
  // .always( function ( data_jqXHR, textStatus, jqXHR_errorThrown ) {   if ( window.console && window.console.log ){ console.log( 'always finished', data_jqXHR, textStatus, jqXHR_errorThrown ); }     })
  ; // End Ajax
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
function wpbc_get_calendar__jq_node__for_messages(ajx_post_data_url_params) {
  var jq_node = '.booking_form_div';
  var calendar_resource_id = wpbc_get_resource_id__from_ajx_post_data_url(ajx_post_data_url_params);
  if (calendar_resource_id > 0) {
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
function wpbc_get_resource_id__from_ajx_post_data_url(ajx_post_data_url_params) {
  // Get booking resource ID from Ajax Post Request  -> this.data = 'action=WPBC_AJX_CALENDAR_LOAD...&calendar_request_params%5Bresource_id%5D=2&calendar_request_params%5Bbooking_hash%5D=&calendar_request_params'
  var calendar_resource_id = wpbc_get_uri_param_by_name('calendar_request_params[resource_id]', ajx_post_data_url_params);
  if (null !== calendar_resource_id && '' !== calendar_resource_id) {
    calendar_resource_id = parseInt(calendar_resource_id);
    if (calendar_resource_id > 0) {
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
function wpbc_get_uri_param_by_name(name, url) {
  url = decodeURIComponent(url);
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
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
function wpbc_front_end__show_message(message) {
  var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var params_default = {
    'type': 'warning',
    // 'error' | 'warning' | 'info' | 'success'
    'show_here': {
      'jq_node': '',
      // any jQuery node definition
      'where': 'inside' // 'inside' | 'before' | 'after' | 'right' | 'left'
    },
    'is_append': true,
    // Apply  only if 	'where'   : 'inside'
    'style': 'text-align:left;',
    // styles, if needed
    'css_class': '',
    // For example can  be: 'wpbc_fe_message_alt'
    'delay': 0,
    // how many microsecond to  show,  if 0  then  show forever
    'if_visible_not_show': false,
    // if true,  then do not show message,  if previos message was not hided (not apply if 'where'   : 'inside' )
    'is_scroll': true // is scroll  to  this element
  };
  for (var p_key in params) {
    params_default[p_key] = params[p_key];
  }
  params = params_default;
  var unique_div_id = new Date();
  unique_div_id = 'wpbc_notice_' + unique_div_id.getTime();
  params['css_class'] += ' wpbc_fe_message';
  if (params['type'] == 'error') {
    params['css_class'] += ' wpbc_fe_message_error';
    message = '<i class="menu_icon icon-1x wpbc_icn_report_gmailerrorred"></i>' + message;
  }
  if (params['type'] == 'warning') {
    params['css_class'] += ' wpbc_fe_message_warning';
    message = '<i class="menu_icon icon-1x wpbc_icn_warning"></i>' + message;
  }
  if (params['type'] == 'info') {
    params['css_class'] += ' wpbc_fe_message_info';
  }
  if (params['type'] == 'success') {
    params['css_class'] += ' wpbc_fe_message_success';
    message = '<i class="menu_icon icon-1x wpbc_icn_done_outline"></i>' + message;
  }
  var scroll_to_element = '<div id="' + unique_div_id + '_scroll" style="display:none;"></div>';
  message = '<div id="' + unique_div_id + '" class="wpbc_front_end__message ' + params['css_class'] + '" style="' + params['style'] + '">' + message + '</div>';
  var jq_el_message = false;
  var is_show_message = true;
  if ('inside' === params['show_here']['where']) {
    if (params['is_append']) {
      jQuery(params['show_here']['jq_node']).append(scroll_to_element);
      jQuery(params['show_here']['jq_node']).append(message);
    } else {
      jQuery(params['show_here']['jq_node']).html(scroll_to_element + message);
    }
  } else if ('before' === params['show_here']['where']) {
    jq_el_message = jQuery(params['show_here']['jq_node']).siblings('[id^="wpbc_notice_"]');
    if (params['if_visible_not_show'] && jq_el_message.is(':visible')) {
      is_show_message = false;
      unique_div_id = jQuery(jq_el_message.get(0)).attr('id');
    }
    if (is_show_message) {
      jQuery(params['show_here']['jq_node']).before(scroll_to_element);
      jQuery(params['show_here']['jq_node']).before(message);
    }
  } else if ('after' === params['show_here']['where']) {
    jq_el_message = jQuery(params['show_here']['jq_node']).nextAll('[id^="wpbc_notice_"]');
    if (params['if_visible_not_show'] && jq_el_message.is(':visible')) {
      is_show_message = false;
      unique_div_id = jQuery(jq_el_message.get(0)).attr('id');
    }
    if (is_show_message) {
      jQuery(params['show_here']['jq_node']).before(scroll_to_element); // We need to  set  here before(for handy scroll)
      jQuery(params['show_here']['jq_node']).after(message);
    }
  } else if ('right' === params['show_here']['where']) {
    jq_el_message = jQuery(params['show_here']['jq_node']).nextAll('.wpbc_front_end__message_container_right').find('[id^="wpbc_notice_"]');
    if (params['if_visible_not_show'] && jq_el_message.is(':visible')) {
      is_show_message = false;
      unique_div_id = jQuery(jq_el_message.get(0)).attr('id');
    }
    if (is_show_message) {
      jQuery(params['show_here']['jq_node']).before(scroll_to_element); // We need to  set  here before(for handy scroll)
      jQuery(params['show_here']['jq_node']).after('<div class="wpbc_front_end__message_container_right">' + message + '</div>');
    }
  } else if ('left' === params['show_here']['where']) {
    jq_el_message = jQuery(params['show_here']['jq_node']).siblings('.wpbc_front_end__message_container_left').find('[id^="wpbc_notice_"]');
    if (params['if_visible_not_show'] && jq_el_message.is(':visible')) {
      is_show_message = false;
      unique_div_id = jQuery(jq_el_message.get(0)).attr('id');
    }
    if (is_show_message) {
      jQuery(params['show_here']['jq_node']).before(scroll_to_element); // We need to  set  here before(for handy scroll)
      jQuery(params['show_here']['jq_node']).before('<div class="wpbc_front_end__message_container_left">' + message + '</div>');
    }
  }
  if (is_show_message && parseInt(params['delay']) > 0) {
    var closed_timer = setTimeout(function () {
      jQuery('#' + unique_div_id).fadeOut(1500);
    }, parseInt(params['delay']));
    var closed_timer2 = setTimeout(function () {
      jQuery('#' + unique_div_id).trigger('hide');
    }, parseInt(params['delay']) + 1501);
  }

  // Check  if showed message in some hidden parent section and show it. But it must  be lower than '.wpbc_container'
  var parent_els = jQuery('#' + unique_div_id).parents().map(function () {
    if (!jQuery(this).is('visible') && jQuery('.wpbc_container').has(this)) {
      jQuery(this).show();
    }
  });
  if (params['is_scroll']) {
    wpbc_do_scroll('#' + unique_div_id + '_scroll');
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
function wpbc_front_end__show_message__error(jq_node, message) {
  var notice_message_id = wpbc_front_end__show_message(message, {
    'type': 'error',
    'delay': 10000,
    'if_visible_not_show': true,
    'show_here': {
      'where': 'right',
      'jq_node': jq_node
    }
  });
  return notice_message_id;
}

/**
 * Error message UNDER element. 	Preset of parameters for real message function.
 *
 * @param el		- any jQuery node definition
 * @param message	- Message HTML
 * @returns string  - HTML ID		or 0 if not showing during this time.
 */
function wpbc_front_end__show_message__error_under_element(jq_node, message, message_delay) {
  if ('undefined' === typeof message_delay) {
    message_delay = 0;
  }
  var notice_message_id = wpbc_front_end__show_message(message, {
    'type': 'error',
    'delay': message_delay,
    'if_visible_not_show': true,
    'show_here': {
      'where': 'after',
      'jq_node': jq_node
    }
  });
  return notice_message_id;
}

/**
 * Error message UNDER element. 	Preset of parameters for real message function.
 *
 * @param el		- any jQuery node definition
 * @param message	- Message HTML
 * @returns string  - HTML ID		or 0 if not showing during this time.
 */
function wpbc_front_end__show_message__error_above_element(jq_node, message, message_delay) {
  if ('undefined' === typeof message_delay) {
    message_delay = 10000;
  }
  var notice_message_id = wpbc_front_end__show_message(message, {
    'type': 'error',
    'delay': message_delay,
    'if_visible_not_show': true,
    'show_here': {
      'where': 'before',
      'jq_node': jq_node
    }
  });
  return notice_message_id;
}

/**
 * Warning message. 	Preset of parameters for real message function.
 *
 * @param el		- any jQuery node definition
 * @param message	- Message HTML
 * @returns string  - HTML ID		or 0 if not showing during this time.
 */
function wpbc_front_end__show_message__warning(jq_node, message) {
  var notice_message_id = wpbc_front_end__show_message(message, {
    'type': 'warning',
    'delay': 10000,
    'if_visible_not_show': true,
    'show_here': {
      'where': 'right',
      'jq_node': jq_node
    }
  });
  wpbc_highlight_error_on_form_field(jq_node);
  return notice_message_id;
}

/**
 * Warning message UNDER element. 	Preset of parameters for real message function.
 *
 * @param el		- any jQuery node definition
 * @param message	- Message HTML
 * @returns string  - HTML ID		or 0 if not showing during this time.
 */
function wpbc_front_end__show_message__warning_under_element(jq_node, message) {
  var notice_message_id = wpbc_front_end__show_message(message, {
    'type': 'warning',
    'delay': 10000,
    'if_visible_not_show': true,
    'show_here': {
      'where': 'after',
      'jq_node': jq_node
    }
  });
  return notice_message_id;
}

/**
 * Warning message ABOVE element. 	Preset of parameters for real message function.
 *
 * @param el		- any jQuery node definition
 * @param message	- Message HTML
 * @returns string  - HTML ID		or 0 if not showing during this time.
 */
function wpbc_front_end__show_message__warning_above_element(jq_node, message) {
  var notice_message_id = wpbc_front_end__show_message(message, {
    'type': 'warning',
    'delay': 10000,
    'if_visible_not_show': true,
    'show_here': {
      'where': 'before',
      'jq_node': jq_node
    }
  });
  return notice_message_id;
}

/**
 * Highlight Error in specific field
 *
 * @param jq_node					string or jQuery element,  where scroll  to
 */
function wpbc_highlight_error_on_form_field(jq_node) {
  if (!jQuery(jq_node).length) {
    return;
  }
  if (!jQuery(jq_node).is(':input')) {
    // Situation with  checkboxes or radio  buttons
    var jq_node_arr = jQuery(jq_node).find(':input');
    if (!jq_node_arr.length) {
      return;
    }
    jq_node = jq_node_arr.get(0);
  }
  var params = {};
  params['delay'] = 10000;
  if (!jQuery(jq_node).hasClass('wpbc_form_field_error')) {
    jQuery(jq_node).addClass('wpbc_form_field_error');
    if (parseInt(params['delay']) > 0) {
      var closed_timer = setTimeout(function () {
        jQuery(jq_node).removeClass('wpbc_form_field_error');
      }, parseInt(params['delay']));
    }
  }
}

/**
 * Scroll to specific element
 *
 * @param jq_node					string or jQuery element,  where scroll  to
 * @param extra_shift_offset		int shift offset from  jq_node
 */
function wpbc_do_scroll(jq_node) {
  var extra_shift_offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  if (!jQuery(jq_node).length) {
    return;
  }
  var targetOffset = jQuery(jq_node).offset().top;
  if (targetOffset <= 0) {
    if (0 != jQuery(jq_node).nextAll(':visible').length) {
      targetOffset = jQuery(jq_node).nextAll(':visible').first().offset().top;
    } else if (0 != jQuery(jq_node).parent().nextAll(':visible').length) {
      targetOffset = jQuery(jq_node).parent().nextAll(':visible').first().offset().top;
    }
  }
  if (jQuery('#wpadminbar').length > 0) {
    targetOffset = targetOffset - 50 - 50;
  } else {
    targetOffset = targetOffset - 20 - 50;
  }
  targetOffset += extra_shift_offset;

  // Scroll only  if we did not scroll before
  if (!jQuery('html,body').is(':animated')) {
    jQuery('html,body').animate({
      scrollTop: targetOffset
    }, 500);
  }
}

// FixIn: 10.2.0.4.
/**
 * Define Popovers for Timelines in WP Booking Calendar
 *
 * @returns {string|boolean}
 */
function wpbc_define_tippy_popover() {
  if ('function' !== typeof wpbc_tippy) {
    console.log('WPBC Error. wpbc_tippy was not defined.');
    return false;
  }
  wpbc_tippy('.popover_bottom.popover_click', {
    content: function content(reference) {
      var popover_title = reference.getAttribute('data-original-title');
      var popover_content = reference.getAttribute('data-content');
      return '<div class="popover popover_tippy">' + '<div class="popover-close"><a href="javascript:void(0)" onclick="javascript:this.parentElement.parentElement.parentElement.parentElement.parentElement._tippy.hide();" >&times;</a></div>' + popover_content + '</div>';
    },
    allowHTML: true,
    trigger: 'manual',
    interactive: true,
    hideOnClick: false,
    interactiveBorder: 10,
    maxWidth: 550,
    theme: 'wpbc-tippy-popover',
    placement: 'bottom-start',
    touch: ['hold', 500]
  });
  jQuery('.popover_bottom.popover_click').on('click', function () {
    if (this._tippy.state.isVisible) {
      this._tippy.hide();
    } else {
      this._tippy.show();
    }
  });
  wpbc_define_hide_tippy_on_scroll();
}
function wpbc_define_hide_tippy_on_scroll() {
  jQuery('.flex_tl__scrolling_section2,.flex_tl__scrolling_sections').on('scroll', function (event) {
    if ('function' === typeof wpbc_tippy) {
      wpbc_tippy.hideAll();
    }
  });
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndwYmNfdXRpbHMuanMiLCJ3cGJjLmpzIiwiYWp4X2xvYWRfYmFsYW5jZXIuanMiLCJ3cGJjX2NhbC5qcyIsImRheXNfc2VsZWN0X2N1c3RvbS5qcyIsIndwYmNfY2FsX2FqeC5qcyIsIndwYmNfZmVfbWVzc2FnZXMuanMiLCJ0aW1lbGluZV9wb3BvdmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxTQUFBLENBQUEsY0FBQSxFQUFBO0VBRUEsSUFBQSxLQUFBLENBQUEsT0FBQSxDQUFBLGNBQUEsQ0FBQSxFQUFBO0lBQ0EsY0FBQSxHQUFBLGNBQUEsQ0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBO0VBQ0E7RUFFQSxJQUFBLFFBQUEsSUFBQSxPQUFBLGNBQUEsRUFBQTtJQUNBLGNBQUEsR0FBQSxjQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7RUFDQTtFQUVBLE9BQUEsY0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxhQUFBLENBQUEsVUFBQSxFQUFBLEtBQUEsRUFBQTtFQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFDQSxJQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxLQUFBLEVBQUE7TUFDQSxPQUFBLElBQUE7SUFDQTtFQUNBO0VBQ0EsT0FBQSxLQUFBO0FBQ0E7QUN2Q0EsWUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxjQUFBLENBQUEsR0FBQSxFQUFBO0VBRUEsT0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7QUFDQTs7QUFJQTtBQUNBO0FBQ0E7O0FBRUEsSUFBQSxLQUFBLEdBQUEsVUFBQSxHQUFBLEVBQUEsQ0FBQSxFQUFBO0VBRUE7RUFDQSxJQUFBLFFBQUEsR0FBQSxHQUFBLENBQUEsWUFBQSxHQUFBLEdBQUEsQ0FBQSxZQUFBLElBQUE7SUFDQSxPQUFBLEVBQUEsQ0FBQTtJQUNBLEtBQUEsRUFBQSxFQUFBO0lBQ0EsTUFBQSxFQUFBO0VBQ0EsQ0FBQTtFQUNBLEdBQUEsQ0FBQSxnQkFBQSxHQUFBLFVBQUEsU0FBQSxFQUFBLFNBQUEsRUFBQTtJQUNBLFFBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFBO0VBQ0EsQ0FBQTtFQUVBLEdBQUEsQ0FBQSxnQkFBQSxHQUFBLFVBQUEsU0FBQSxFQUFBO0lBQ0EsT0FBQSxRQUFBLENBQUEsU0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFHQTtFQUNBLElBQUEsV0FBQSxHQUFBLEdBQUEsQ0FBQSxhQUFBLEdBQUEsR0FBQSxDQUFBLGFBQUEsSUFBQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0VBQUEsQ0FDQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsb0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLE9BQUEsV0FBQSxLQUFBLE9BQUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsY0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7SUFDQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxHQUFBLFdBQUE7SUFDQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLHlCQUFBLENBQUEsR0FBQSxLQUFBO0VBRUEsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLHFCQUFBLEdBQUEsVUFBQSxhQUFBLEVBQUE7SUFBQTs7SUFFQSxJQUFBLHlCQUFBLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLG1CQUFBLEVBQUEsaUJBQUEsQ0FBQTtJQUVBLElBQUEsVUFBQSxHQUFBLHlCQUFBLENBQUEsUUFBQSxDQUFBLGFBQUEsQ0FBQTtJQUVBLE9BQUEsVUFBQTtFQUNBLENBQUE7O0VBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLGtCQUFBLEdBQUEsVUFBQSxhQUFBLEVBQUE7SUFDQSxXQUFBLEdBQUEsYUFBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxrQkFBQSxHQUFBLFlBQUE7SUFDQSxPQUFBLFdBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx3QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsSUFBQSxHQUFBLENBQUEsb0JBQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtNQUVBLE9BQUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7SUFDQSxDQUFBLE1BQUE7TUFDQSxPQUFBLEtBQUE7SUFDQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsd0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxxQkFBQSxFQUFBO0lBQUEsSUFBQSxxQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsS0FBQTtJQUVBLElBQUEsQ0FBQSxHQUFBLENBQUEsb0JBQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSxJQUFBLEtBQUEscUJBQUEsRUFBQTtNQUNBLEdBQUEsQ0FBQSxjQUFBLENBQUEsV0FBQSxDQUFBO0lBQ0E7SUFFQSxLQUFBLElBQUEsU0FBQSxJQUFBLHFCQUFBLEVBQUE7TUFFQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLHFCQUFBLENBQUEsU0FBQSxDQUFBO0lBQ0E7SUFFQSxPQUFBLFdBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx5QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLFNBQUEsRUFBQSxVQUFBLEVBQUE7SUFFQSxJQUFBLENBQUEsR0FBQSxDQUFBLG9CQUFBLENBQUEsV0FBQSxDQUFBLEVBQUE7TUFDQSxHQUFBLENBQUEsY0FBQSxDQUFBLFdBQUEsQ0FBQTtJQUNBO0lBRUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxVQUFBO0lBRUEsT0FBQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEseUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxTQUFBLEVBQUE7SUFFQSxJQUNBLEdBQUEsQ0FBQSxvQkFBQSxDQUFBLFdBQUEsQ0FBQSxJQUNBLFdBQUEsS0FBQSxPQUFBLFdBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLEVBQ0E7TUFDQTtNQUNBLElBQUEsR0FBQSxDQUFBLHFCQUFBLENBQUEsU0FBQSxDQUFBLEVBQUE7UUFDQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBO01BQ0E7TUFDQSxPQUFBLFdBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBO0lBQ0E7SUFFQSxPQUFBLElBQUEsQ0FBQSxDQUFBO0VBQ0EsQ0FBQTtFQUNBOztFQUdBO0VBQ0EsSUFBQSxVQUFBLEdBQUEsR0FBQSxDQUFBLFlBQUEsR0FBQSxHQUFBLENBQUEsWUFBQSxJQUFBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7RUFBQSxDQUNBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxnQ0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsT0FBQSxXQUFBLEtBQUEsT0FBQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLHlCQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUE7SUFFQSxJQUFBLEdBQUEsQ0FBQSxnQ0FBQSxDQUFBLFdBQUEsQ0FBQSxFQUFBO01BRUEsT0FBQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtJQUNBLENBQUEsTUFBQTtNQUNBLE9BQUEsS0FBQTtJQUNBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEseUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxZQUFBLEVBQUE7SUFFQSxJQUFBLENBQUEsR0FBQSxDQUFBLGdDQUFBLENBQUEsV0FBQSxDQUFBLEVBQUE7TUFDQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtNQUNBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLEdBQUEsV0FBQTtJQUNBO0lBRUEsS0FBQSxJQUFBLFNBQUEsSUFBQSxZQUFBLEVBQUE7TUFFQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFlBQUEsQ0FBQSxTQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsK0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLElBQ0EsR0FBQSxDQUFBLGdDQUFBLENBQUEsV0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsS0FBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLCtCQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsU0FBQSxFQUFBO0lBQUEsSUFBQSxxQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsSUFBQTtJQUVBLElBQUEsQ0FBQSxHQUFBLENBQUEsZ0NBQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtNQUNBLEdBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQTtRQUFBLE9BQUEsRUFBQSxDQUFBO01BQUEsQ0FBQSxDQUFBO0lBQ0E7SUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLEVBQUE7TUFDQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtJQUNBO0lBRUEsSUFBQSxxQkFBQSxFQUFBO01BRUE7TUFDQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLFNBQUE7SUFDQSxDQUFBLE1BQUE7TUFFQTtNQUNBLEtBQUEsSUFBQSxTQUFBLElBQUEsU0FBQSxFQUFBO1FBRUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFBLENBQUEsU0FBQSxDQUFBO01BQ0E7SUFDQTtJQUVBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsa0NBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxhQUFBLEVBQUE7SUFFQSxJQUNBLEdBQUEsQ0FBQSxnQ0FBQSxDQUFBLFdBQUEsQ0FBQSxJQUNBLFdBQUEsS0FBQSxPQUFBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxhQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxhQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsS0FBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLHdCQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsU0FBQSxFQUFBLFVBQUEsRUFBQTtJQUVBLElBQUEsQ0FBQSxHQUFBLENBQUEsZ0NBQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtNQUNBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO01BQ0EsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsR0FBQSxXQUFBO0lBQ0E7SUFFQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFVBQUE7SUFFQSxPQUFBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx3QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLFNBQUEsRUFBQTtJQUVBLElBQ0EsR0FBQSxDQUFBLGdDQUFBLENBQUEsV0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsSUFBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSw4QkFBQSxHQUFBLFVBQUEsYUFBQSxFQUFBO0lBQ0EsVUFBQSxHQUFBLGFBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsOEJBQUEsR0FBQSxZQUFBO0lBQ0EsT0FBQSxVQUFBO0VBQ0EsQ0FBQTtFQUNBOztFQUtBO0VBQ0EsSUFBQSxTQUFBLEdBQUEsR0FBQSxDQUFBLFdBQUEsR0FBQSxHQUFBLENBQUEsV0FBQSxJQUFBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7RUFBQSxDQUNBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxZQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsU0FBQSxFQUFBO0lBQUEsSUFBQSxxQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsS0FBQTtJQUVBLElBQUEsV0FBQSxLQUFBLE9BQUEsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsRUFBQTtNQUNBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0lBQ0E7SUFFQSxJQUFBLHFCQUFBLEVBQUE7TUFFQTtNQUNBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsU0FBQTtJQUVBLENBQUEsTUFBQTtNQUVBO01BQ0EsS0FBQSxJQUFBLFNBQUEsSUFBQSxTQUFBLEVBQUE7UUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLEVBQUE7VUFDQSxTQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLEVBQUE7UUFDQTtRQUNBLEtBQUEsSUFBQSxlQUFBLElBQUEsU0FBQSxDQUFBLFNBQUEsQ0FBQSxFQUFBO1VBQ0EsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsU0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGVBQUEsQ0FBQSxDQUFBO1FBQ0E7TUFDQTtJQUNBO0lBRUEsT0FBQSxTQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtFQUNBLENBQUE7O0VBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEscUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxhQUFBLEVBQUE7SUFFQSxJQUNBLFdBQUEsS0FBQSxPQUFBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxhQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxhQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsRUFBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBO0VBQ0EsSUFBQSxPQUFBLEdBQUEsR0FBQSxDQUFBLFNBQUEsR0FBQSxHQUFBLENBQUEsU0FBQSxJQUFBLENBQUEsQ0FBQTtFQUVBLEdBQUEsQ0FBQSxlQUFBLEdBQUEsVUFBQSxTQUFBLEVBQUEsU0FBQSxFQUFBO0lBQ0EsT0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFNBQUE7RUFDQSxDQUFBO0VBRUEsR0FBQSxDQUFBLGVBQUEsR0FBQSxVQUFBLFNBQUEsRUFBQTtJQUNBLE9BQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxvQkFBQSxHQUFBLFlBQUE7SUFDQSxPQUFBLE9BQUE7RUFDQSxDQUFBOztFQUVBO0VBQ0EsSUFBQSxVQUFBLEdBQUEsR0FBQSxDQUFBLFlBQUEsR0FBQSxHQUFBLENBQUEsWUFBQSxJQUFBLENBQUEsQ0FBQTtFQUVBLEdBQUEsQ0FBQSxXQUFBLEdBQUEsVUFBQSxTQUFBLEVBQUEsU0FBQSxFQUFBO0lBQ0EsVUFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFNBQUE7RUFDQSxDQUFBO0VBRUEsR0FBQSxDQUFBLFdBQUEsR0FBQSxVQUFBLFNBQUEsRUFBQTtJQUNBLE9BQUEsVUFBQSxDQUFBLFNBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxpQkFBQSxHQUFBLFlBQUE7SUFDQSxPQUFBLFVBQUE7RUFDQSxDQUFBOztFQUVBOztFQUVBLE9BQUEsR0FBQTtBQUVBLENBQUEsQ0FBQSxLQUFBLElBQUEsQ0FBQSxDQUFBLEVBQUEsTUFBQSxDQUFBOztBQzloQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBQSxHQUFBLFVBQUEsR0FBQSxFQUFBLENBQUEsRUFBQTtFQUVBOztFQUVBLElBQUEsVUFBQSxHQUFBLEdBQUEsQ0FBQSxZQUFBLEdBQUEsR0FBQSxDQUFBLFlBQUEsSUFBQTtJQUNBLGFBQUEsRUFBQSxDQUFBO0lBQ0EsWUFBQSxFQUFBLEVBQUE7SUFDQSxNQUFBLEVBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEseUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLFVBQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxXQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsb0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLE9BQUEsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsY0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtJQUFBLElBQUEsTUFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsQ0FBQSxDQUFBO0lBRUEsSUFBQSxXQUFBLEdBQUEsQ0FBQSxDQUFBO0lBQ0EsV0FBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLFdBQUE7SUFDQSxXQUFBLENBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQTtJQUNBLFdBQUEsQ0FBQSxlQUFBLENBQUEsR0FBQSxhQUFBO0lBQ0EsV0FBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLGNBQUEsQ0FBQSxNQUFBLENBQUE7SUFHQSxJQUFBLEdBQUEsQ0FBQSx3QkFBQSxDQUFBLFdBQUEsRUFBQSxhQUFBLENBQUEsRUFBQTtNQUNBLE9BQUEsS0FBQTtJQUNBO0lBQ0EsSUFBQSxHQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxDQUFBLEVBQUE7TUFDQSxPQUFBLE1BQUE7SUFDQTtJQUdBLElBQUEsR0FBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EsR0FBQSxDQUFBLHFCQUFBLENBQUEsV0FBQSxDQUFBO01BQ0EsT0FBQSxLQUFBO0lBQ0EsQ0FBQSxNQUFBO01BQ0EsR0FBQSxDQUFBLHNCQUFBLENBQUEsV0FBQSxDQUFBO01BQ0EsT0FBQSxNQUFBO0lBQ0E7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLG1CQUFBLEdBQUEsWUFBQTtJQUNBLE9BQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxVQUFBLENBQUEsYUFBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxzQkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBQ0EsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLGdDQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsYUFBQSxFQUFBO0lBRUEsSUFBQSxVQUFBLEdBQUEsS0FBQTtJQUVBLElBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtNQUFBO01BQ0EsS0FBQSxJQUFBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxDQUFBLEVBQUE7UUFDQSxJQUNBLFdBQUEsS0FBQSxVQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsYUFBQSxDQUFBLElBQ0EsYUFBQSxLQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsRUFDQTtVQUNBLFVBQUEsR0FBQSxVQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUE7VUFDQSxVQUFBLEdBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO1VBQ0EsVUFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsVUFBQSxDQUFBLEVBQUE7WUFDQSxPQUFBLENBQUE7VUFDQSxDQUFBLENBQUEsQ0FBQSxDQUFBO1VBQ0EsT0FBQSxVQUFBO1FBQ0E7TUFDQTtJQUNBO0lBQ0EsT0FBQSxVQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx5QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtJQUVBLElBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtNQUFBO01BQ0EsS0FBQSxJQUFBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxDQUFBLEVBQUE7UUFDQSxJQUNBLFdBQUEsS0FBQSxVQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsYUFBQSxDQUFBLElBQ0EsYUFBQSxLQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsRUFDQTtVQUNBLE9BQUEsSUFBQTtRQUNBO01BQ0E7SUFDQTtJQUNBLE9BQUEsS0FBQTtFQUNBLENBQUE7O0VBR0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEscUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUNBLFVBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSwrQkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtJQUVBLElBQUEsVUFBQSxHQUFBLEtBQUE7SUFFQSxJQUFBLFVBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7TUFBQTtNQUNBLEtBQUEsSUFBQSxDQUFBLElBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxFQUFBO1FBQ0EsSUFDQSxXQUFBLEtBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLGFBQUEsQ0FBQSxJQUNBLGFBQUEsS0FBQSxVQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsZUFBQSxDQUFBLEVBQ0E7VUFDQSxVQUFBLEdBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBO1VBQ0EsVUFBQSxHQUFBLFVBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtVQUNBLFVBQUEsQ0FBQSxZQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsTUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO1lBQ0EsT0FBQSxDQUFBO1VBQ0EsQ0FBQSxDQUFBLENBQUEsQ0FBQTtVQUNBLE9BQUEsVUFBQTtRQUNBO01BQ0E7SUFDQTtJQUNBLE9BQUEsVUFBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsd0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxhQUFBLEVBQUE7SUFFQSxJQUFBLFVBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7TUFBQTtNQUNBLEtBQUEsSUFBQSxDQUFBLElBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxFQUFBO1FBQ0EsSUFDQSxXQUFBLEtBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLGFBQUEsQ0FBQSxJQUNBLGFBQUEsS0FBQSxVQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsZUFBQSxDQUFBLEVBQ0E7VUFDQSxPQUFBLElBQUE7UUFDQTtNQUNBO0lBQ0E7SUFDQSxPQUFBLEtBQUE7RUFDQSxDQUFBO0VBSUEsR0FBQSxDQUFBLGtCQUFBLEdBQUEsWUFBQTtJQUVBO0lBQ0EsSUFBQSxVQUFBLEdBQUEsS0FBQTtJQUNBLElBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtNQUFBO01BQ0EsS0FBQSxJQUFBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxDQUFBLEVBQUE7UUFDQSxVQUFBLEdBQUEsR0FBQSxDQUFBLGdDQUFBLENBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLGFBQUEsQ0FBQSxFQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsQ0FBQTtRQUNBO01BQ0E7SUFDQTtJQUVBLElBQUEsS0FBQSxLQUFBLFVBQUEsRUFBQTtNQUVBO01BQ0EsR0FBQSxDQUFBLGFBQUEsQ0FBQSxVQUFBLENBQUE7SUFDQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsYUFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsUUFBQSxXQUFBLENBQUEsZUFBQSxDQUFBO01BRUEsS0FBQSwrQkFBQTtRQUVBO1FBQ0EsR0FBQSxDQUFBLHFCQUFBLENBQUEsV0FBQSxDQUFBO1FBRUEsNkJBQUEsQ0FBQSxXQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7UUFDQTtNQUVBO0lBQ0E7RUFDQSxDQUFBO0VBRUEsT0FBQSxHQUFBO0FBRUEsQ0FBQSxDQUFBLEtBQUEsSUFBQSxDQUFBLENBQUEsRUFBQSxNQUFBLENBQUE7O0FBR0E7QUFDQTtBQUNBOztBQUVBLFNBQUEsc0JBQUEsQ0FBQSxNQUFBLEVBQUEsYUFBQSxFQUFBO0VBQ0E7RUFDQSxJQUFBLFdBQUEsS0FBQSxPQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsZUFBQSxHQUFBLEtBQUEsQ0FBQSxjQUFBLENBQUEsTUFBQSxDQUFBLGFBQUEsQ0FBQSxFQUFBLGFBQUEsRUFBQSxNQUFBLENBQUE7SUFFQSxPQUFBLE1BQUEsS0FBQSxlQUFBO0VBQ0E7RUFFQSxPQUFBLEtBQUE7QUFDQTtBQUdBLFNBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxFQUFBO0VBQ0E7RUFDQSxLQUFBLENBQUEsK0JBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxDQUFBO0VBQ0EsS0FBQSxDQUFBLGtCQUFBLENBQUEsQ0FBQTtBQUNBO0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGtCQUFBLENBQUEsV0FBQSxFQUFBO0VBRUE7RUFDQSxJQUFBLENBQUEsS0FBQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7SUFBQSxPQUFBLEtBQUE7RUFBQTs7RUFFQTtFQUNBLElBQUEsSUFBQSxLQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSxhQUFBLENBQUEsRUFBQTtJQUFBLE9BQUEsS0FBQTtFQUFBOztFQUVBO0VBQ0E7RUFDQTtFQUNBLElBQUEsc0JBQUEsR0FBQSxLQUFBO0VBQ0EsSUFBQSw0QkFBQSxHQUFBLEdBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxTQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtJQUNBLHNCQUFBLEdBQUEsSUFBQTtJQUNBLDRCQUFBLEdBQUEsQ0FBQTtFQUNBO0VBQ0EsSUFBQSxRQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtJQUNBLDRCQUFBLEdBQUEsQ0FBQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBLElBQUEsZUFBQSxHQUFBLENBQUE7RUFDQSxlQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxRQUFBLENBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsZUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBO0VBQ0EsSUFBQSxlQUFBLEdBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGlDQUFBLENBQUE7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBLElBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsZUFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLEtBRUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsY0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7RUFBQSxHQUNBLFFBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBO0VBQUEsQ0FDQSxFQUNBO0lBQ0EsZUFBQSxHQUFBLElBQUE7SUFDQSxlQUFBLEdBQUEsSUFBQTtFQUNBO0VBRUEsSUFBQSxvQkFBQSxHQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSx5QkFBQSxDQUFBO0VBQ0EsSUFBQSx1QkFBQSxHQUFBLFFBQUEsQ0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsMkJBQUEsQ0FBQSxDQUFBO0VBRUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQTtFQUNBO0VBQ0E7RUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxRQUFBLENBQ0E7SUFDQSxhQUFBLEVBQUEsU0FBQSxjQUFBLE9BQUEsRUFBQTtNQUNBLE9BQUEsaUNBQUEsQ0FBQSxPQUFBLEVBQUE7UUFBQSxhQUFBLEVBQUE7TUFBQSxDQUFBLEVBQUEsSUFBQSxDQUFBO0lBQ0EsQ0FBQTtJQUNBLFFBQUEsRUFBQSxTQUFBLFNBQUEsWUFBQSxFQUFBLFlBQUEsRUFBQTtNQUFBO0FBQ0E7QUFDQTtBQUNBO01BQ0EsT0FBQSw4QkFBQSxDQUFBLFlBQUEsRUFBQTtRQUFBLGFBQUEsRUFBQTtNQUFBLENBQUEsRUFBQSxJQUFBLENBQUE7SUFDQSxDQUFBO0lBQ0EsT0FBQSxFQUFBLFNBQUEsUUFBQSxXQUFBLEVBQUEsT0FBQSxFQUFBO01BQ0EsT0FBQSw2QkFBQSxDQUFBLFdBQUEsRUFBQSxPQUFBLEVBQUE7UUFBQSxhQUFBLEVBQUE7TUFBQSxDQUFBLEVBQUEsSUFBQSxDQUFBO0lBQ0EsQ0FBQTtJQUNBLGlCQUFBLEVBQUEsU0FBQSxrQkFBQSxJQUFBLEVBQUEsVUFBQSxFQUFBLHlCQUFBLEVBQUEsQ0FBQSxDQUFBO0lBQ0EsTUFBQSxFQUFBLE1BQUE7SUFDQSxjQUFBLEVBQUEsdUJBQUE7SUFDQSxVQUFBLEVBQUEsQ0FBQTtJQUNBO0lBQ0E7SUFDQSxRQUFBLEVBQUEsVUFBQTtJQUNBLFFBQUEsRUFBQSxVQUFBO0lBQ0EsVUFBQSxFQUFBLFVBQUE7SUFDQSxXQUFBLEVBQUEsS0FBQTtJQUNBLFVBQUEsRUFBQSxLQUFBO0lBQ0EsT0FBQSxFQUFBLGVBQUE7SUFDQSxPQUFBLEVBQUEsZUFBQTtJQUFBO0lBQ0E7SUFDQSxVQUFBLEVBQUEsS0FBQTtJQUNBLGNBQUEsRUFBQSxJQUFBO0lBQ0EsVUFBQSxFQUFBLEtBQUE7SUFDQSxRQUFBLEVBQUEsb0JBQUE7SUFDQSxXQUFBLEVBQUEsS0FBQTtJQUNBLGdCQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQSw0QkFBQTtJQUNBLFdBQUEsRUFBQSxzQkFBQTtJQUNBO0lBQ0EsY0FBQSxFQUFBO0VBQ0EsQ0FDQSxDQUFBOztFQUlBO0VBQ0E7RUFDQTtFQUNBLFVBQUEsQ0FBQSxZQUFBO0lBQUEsdUNBQUEsQ0FBQSxXQUFBLENBQUE7RUFBQSxDQUFBLEVBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQSxJQUFBLGNBQUEsR0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsb0JBQUEsQ0FBQTtFQUNBLElBQUEsS0FBQSxLQUFBLGNBQUEsRUFBQTtJQUNBLHdCQUFBLENBQUEsV0FBQSxFQUFBLGNBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxjQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxpQ0FBQSxDQUFBLElBQUEsRUFBQSxtQkFBQSxFQUFBLGFBQUEsRUFBQTtFQUVBLElBQUEsVUFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLFNBQUEsR0FBQSx3QkFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLGFBQUEsR0FBQSx5QkFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLFdBQUEsR0FBQSxXQUFBLEtBQUEsT0FBQSxtQkFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLG1CQUFBLENBQUEsYUFBQSxDQUFBLEdBQUEsR0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLGtCQUFBLEdBQUEsb0NBQUEsQ0FBQSxXQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLGlCQUFBLEdBQUEsS0FBQSxDQUFBLGtDQUFBLENBQUEsV0FBQSxFQUFBLGFBQUEsQ0FBQTs7RUFHQTtFQUNBLElBQUEscUJBQUEsR0FBQSxFQUFBO0VBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsV0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSxXQUFBLEdBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGVBQUEsR0FBQSxJQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxJQUNBLGtCQUFBLENBQUE7RUFDQTtFQUFBLEVBQ0E7SUFDQSxJQUFBLGFBQUEsS0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsbUJBQUEsQ0FBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLENBQUE7SUFDQTtJQUNBLElBQUEsa0JBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxJQUFBLGFBQUEsS0FBQSxrQkFBQSxDQUFBLGtCQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsb0JBQUEsQ0FBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLENBQUE7SUFDQTtFQUNBO0VBR0EsSUFBQSxpQkFBQSxHQUFBLEtBQUE7O0VBRUE7RUFDQSxJQUFBLEtBQUEsS0FBQSxpQkFBQSxFQUFBO0lBRUEscUJBQUEsQ0FBQSxJQUFBLENBQUEsdUJBQUEsQ0FBQTtJQUVBLE9BQUEsQ0FBQSxpQkFBQSxFQUFBLHFCQUFBLENBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0VBQ0E7O0VBR0E7RUFDQTtFQUNBOztFQUVBO0VBQ0E7RUFDQSxJQUFBLGdCQUFBLEdBQUEsS0FBQSxDQUFBLHFCQUFBLENBQUEsV0FBQSxFQUFBLGFBQUEsQ0FBQTtFQUVBLEtBQUEsSUFBQSxVQUFBLElBQUEsZ0JBQUEsRUFBQTtJQUVBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGdCQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0E7RUFDQTs7RUFHQTtFQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLE9BQUEsR0FBQSxpQkFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLGdCQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLEVBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBOztFQUdBLElBQUEsUUFBQSxDQUFBLGlCQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsaUJBQUEsR0FBQSxJQUFBO0lBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsZ0JBQUEsQ0FBQTtJQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHFCQUFBLEdBQUEsUUFBQSxDQUFBLGlCQUFBLENBQUEsY0FBQSxDQUFBLEdBQUEsaUJBQUEsQ0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLENBQUEsTUFBQTtJQUNBLGlCQUFBLEdBQUEsS0FBQTtJQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLENBQUE7RUFDQTtFQUdBLFFBQUEsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxnQkFBQSxDQUFBO0lBRUEsS0FBQSxXQUFBO01BQ0E7SUFFQSxLQUFBLG9CQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsYUFBQSxFQUFBLGFBQUEsQ0FBQTtNQUNBO0lBRUEsS0FBQSxrQkFBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGtCQUFBLENBQUE7TUFDQTtJQUVBLEtBQUEsZUFBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLEVBQUEsb0JBQUEsQ0FBQTtNQUNBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBO01BQ0E7SUFFQSxLQUFBLHVCQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsdUJBQUEsRUFBQSxzQkFBQSxDQUFBO01BQ0EsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxxQkFBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLENBQUE7TUFDQTtJQUVBLEtBQUEscUJBQUE7TUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSx1QkFBQSxFQUFBLHFCQUFBLENBQUE7TUFDQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsQ0FBQTtNQUNBO0lBRUEsS0FBQSx3QkFBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLEVBQUEsd0JBQUEsQ0FBQTtNQUNBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBO01BQ0E7SUFFQSxLQUFBLDRCQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsdUJBQUEsRUFBQSw0QkFBQSxDQUFBO01BQ0EsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxxQkFBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLENBQUE7TUFDQTtJQUVBLEtBQUEsYUFBQTtNQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztNQUVBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGFBQUEsRUFBQSxlQUFBLEVBQUEsZ0JBQUEsQ0FBQTtNQUNBO01BQ0EsSUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsa0JBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsOEJBQUEsRUFBQSw0QkFBQSxDQUFBO01BQ0E7TUFDQSxJQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxrQkFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUE7UUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSw2QkFBQSxFQUFBLDZCQUFBLENBQUE7TUFDQTtNQUNBO0lBRUEsS0FBQSxVQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsYUFBQSxFQUFBLGVBQUEsQ0FBQTs7TUFFQTtNQUNBLElBQUEsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxxQkFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsNEJBQUEsQ0FBQTtNQUNBLENBQUEsTUFBQSxJQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQTtRQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLDZCQUFBLENBQUE7TUFDQTtNQUNBO0lBRUEsS0FBQSxXQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsYUFBQSxFQUFBLGdCQUFBLENBQUE7O01BRUE7TUFDQSxJQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQTtRQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLDZCQUFBLENBQUE7TUFDQSxDQUFBLE1BQUEsSUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUE7UUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSw4QkFBQSxDQUFBO01BQ0E7TUFDQTtJQUVBO01BQ0E7TUFDQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGdCQUFBLENBQUEsR0FBQSxXQUFBO0VBQ0E7RUFJQSxJQUFBLFdBQUEsSUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGdCQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsOEJBQUEsR0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEseUJBQUEsQ0FBQSxDQUFBLENBQUE7O0lBRUEsUUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUE7TUFFQSxLQUFBLEVBQUE7UUFDQTtRQUNBO01BRUEsS0FBQSxTQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsY0FBQSxDQUFBO1FBQ0EsaUJBQUEsR0FBQSxpQkFBQSxHQUFBLElBQUEsR0FBQSw4QkFBQTtRQUNBO01BRUEsS0FBQSxVQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsZUFBQSxDQUFBO1FBQ0E7O01BRUE7TUFDQSxLQUFBLGlCQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsNkJBQUEsRUFBQSw0QkFBQSxDQUFBO1FBQ0EsaUJBQUEsR0FBQSxpQkFBQSxHQUFBLElBQUEsR0FBQSw4QkFBQTtRQUNBO01BRUEsS0FBQSxrQkFBQTtRQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLDZCQUFBLEVBQUEsNkJBQUEsQ0FBQTtRQUNBLGlCQUFBLEdBQUEsaUJBQUEsR0FBQSxJQUFBLEdBQUEsOEJBQUE7UUFDQTtNQUVBLEtBQUEsa0JBQUE7UUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSw4QkFBQSxFQUFBLDRCQUFBLENBQUE7UUFDQSxpQkFBQSxHQUFBLGlCQUFBLEdBQUEsSUFBQSxHQUFBLDhCQUFBO1FBQ0E7TUFFQSxLQUFBLG1CQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsOEJBQUEsRUFBQSw2QkFBQSxDQUFBO1FBQ0E7TUFFQTtJQUVBO0VBQ0E7RUFFQSxPQUFBLENBQUEsaUJBQUEsRUFBQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDZCQUFBLENBQUEsV0FBQSxFQUFBLElBQUEsRUFBQSxtQkFBQSxFQUFBLGFBQUEsRUFBQTtFQUVBLElBQUEsSUFBQSxLQUFBLElBQUEsRUFBQTtJQUNBLHVDQUFBLENBQUEsV0FBQSxLQUFBLE9BQUEsbUJBQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxtQkFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxPQUFBLEtBQUE7RUFDQTtFQUVBLElBQUEsU0FBQSxHQUFBLHdCQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsYUFBQSxHQUFBLHlCQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsV0FBQSxHQUFBLFdBQUEsS0FBQSxPQUFBLG1CQUFBLENBQUEsYUFBQSxDQUFBLEdBQUEsbUJBQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxHQUFBLENBQUEsQ0FBQTs7RUFFQTtFQUNBLElBQUEsZ0JBQUEsR0FBQSxLQUFBLENBQUEsa0NBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQSxJQUFBLENBQUEsZ0JBQUEsRUFBQTtJQUFBLE9BQUEsS0FBQTtFQUFBOztFQUdBO0VBQ0EsSUFBQSxZQUFBLEdBQUEsRUFBQTtFQUNBLElBQUEsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxzQkFBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtJQUNBLFlBQUEsSUFBQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHNCQUFBLENBQUE7RUFDQTtFQUNBLElBQUEsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxrQkFBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtJQUNBLFlBQUEsSUFBQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGtCQUFBLENBQUE7RUFDQTtFQUNBLElBQUEsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsWUFBQSxJQUFBLGdCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsZUFBQSxDQUFBO0VBQ0E7RUFDQSxJQUFBLGdCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEseUJBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQUE7SUFDQSxZQUFBLElBQUEsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSx5QkFBQSxDQUFBO0VBQ0E7RUFDQSxxQ0FBQSxDQUFBLFlBQUEsRUFBQSxXQUFBLEVBQUEsU0FBQSxDQUFBOztFQUlBO0VBQ0EsSUFBQSx3QkFBQSxHQUFBLE1BQUEsQ0FBQSxnQ0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEscUJBQUEsR0FBQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQTtFQUVBLElBQUEsd0JBQUEsSUFBQSxDQUFBLHFCQUFBLEVBQUE7SUFFQTtBQUNBO0FBQ0E7O0lBRUEsdUNBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBOztJQUVBLElBQUEsZUFBQSxHQUFBLHVDQUFBLEdBQUEsV0FBQTtJQUNBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsd0JBQUEsR0FDQSxlQUFBLEdBQUEsd0JBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxRQUFBLEVBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLE9BQUEsS0FBQTtFQUNBOztFQUlBO0VBQ0EsSUFDQSxRQUFBLENBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsSUFDQSxRQUFBLENBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxlQUFBLENBQUEsR0FBQSxDQUFBLElBQ0EsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsaUJBQUEsQ0FBQSxHQUFBLENBQUEsSUFDQSxRQUFBLENBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSx3QkFBQSxDQUFBLEdBQUEsQ0FBQSxJQUNBLFFBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLG9CQUFBLENBQUEsR0FBQSxDQUFBLElBQ0EsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsV0FBQSxDQUFBLEdBQUEsQ0FDQSxFQUNBO0lBQ0E7O0lBRUEsSUFBQSxVQUFBLElBQUEsT0FBQSxxQ0FBQSxFQUFBO01BQ0EscUNBQUEsQ0FBQSxhQUFBLEVBQUEsSUFBQSxFQUFBLFdBQUEsQ0FBQTtJQUNBO0VBQ0E7QUFFQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsOEJBQUEsQ0FBQSxJQUFBLEVBQUEsbUJBQUEsRUFBQSxhQUFBLEVBQUE7RUFFQSxJQUFBLFdBQUEsR0FBQSxXQUFBLEtBQUEsT0FBQSxtQkFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLG1CQUFBLENBQUEsYUFBQSxDQUFBLEdBQUEsR0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLHdCQUFBLEdBQUEsTUFBQSxDQUFBLGdDQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxxQkFBQSxHQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBO0VBQ0EsSUFBQSx3QkFBQSxJQUFBLENBQUEscUJBQUEsRUFBQTtJQUNBLGlDQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLE1BQUEsQ0FBQSw2Q0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsT0FBQSxLQUFBO0VBQ0E7RUFFQSxNQUFBLENBQUEsZUFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBOztFQUdBLElBQUEsVUFBQSxLQUFBLE9BQUEsa0NBQUEsRUFBQTtJQUFBLGtDQUFBLENBQUEsSUFBQSxFQUFBLFdBQUEsQ0FBQTtFQUFBO0VBRUEsd0NBQUEsQ0FBQSxXQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLG1CQUFBLEdBQUEsSUFBQSxDQUFBLENBQUE7RUFDQSxJQUFBLHNCQUFBLEdBQUEsb0NBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsTUFBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsZUFBQSxFQUFBLENBQUEsV0FBQSxFQUFBLG1CQUFBLEVBQUEsc0JBQUEsQ0FBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLFlBQUE7RUFDQSxNQUFBLENBQUEsbUJBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxlQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUEsV0FBQSxFQUFBLElBQUEsRUFBQTtJQUNBLElBQ0EsT0FBQSxLQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLElBQ0EsU0FBQSxLQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLEVBQ0E7TUFDQSxJQUFBLFlBQUEsR0FBQSxVQUFBLENBQUEsWUFBQTtRQUNBLElBQUEsbUJBQUEsR0FBQSxLQUFBLENBQUEsZUFBQSxDQUFBLGdEQUFBLENBQUE7UUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLEdBQUEsd0JBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSx3QkFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLFNBQUEsRUFBQSxtQkFBQSxDQUFBO01BQ0EsQ0FBQSxFQUFBLEVBQUEsQ0FBQTtJQUNBO0VBQ0EsQ0FBQSxDQUFBO0FBQ0EsQ0FBQSxDQUFBOztBQUdBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx3Q0FBQSxDQUFBLFdBQUEsRUFBQTtFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsSUFBQSxtQkFBQSxHQUFBLDhDQUFBLENBQUEsV0FBQSxDQUFBOztFQUVBO0VBQ0EsSUFBQSxrQkFBQSxHQUFBLG9DQUFBLENBQUEsV0FBQSxDQUFBOztFQUVBO0VBQ0EsSUFBQSxtQkFBQSxHQUFBLGNBQUEsQ0FBQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUEsNEJBQUEsQ0FBQSxDQUFBO0VBRUEsSUFBQSxRQUFBO0VBQ0EsSUFBQSxpQkFBQTtFQUNBLElBQUEsY0FBQTtFQUNBLElBQUEsZUFBQTtFQUNBLElBQUEsWUFBQTtFQUNBLElBQUEsV0FBQTtFQUVBLElBQUEsZ0JBQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsZUFBQSxDQUFBLGdCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxRQUFBLENBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxpQkFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsZUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBOztFQUVBO0VBQ0EsS0FBQSxJQUFBLFNBQUEsR0FBQSxDQUFBLEVBQUEsU0FBQSxHQUFBLG1CQUFBLENBQUEsTUFBQSxFQUFBLFNBQUEsRUFBQSxFQUFBO0lBRUEsbUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxRQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7O0lBRUEsZUFBQSxHQUFBLG1CQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTs7SUFFQTtJQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxrQkFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtNQUVBO01BQ0EsUUFBQSxHQUFBLGtCQUFBLENBQUEsQ0FBQSxDQUFBO01BRUEsSUFBQSxlQUFBLEdBQUEsMEJBQUEsQ0FBQSxpQkFBQSxFQUFBLFFBQUEsRUFBQSxlQUFBLENBQUE7TUFDQSxJQUFBLGVBQUEsRUFBQTtRQUNBO1FBQ0EsbUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxRQUFBLEdBQUEsQ0FBQTtRQUNBLE1BQUEsQ0FBQTtNQUNBOztNQUVBO01BQ0EsSUFDQSxLQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLHdCQUFBLENBQUEsSUFDQSxrQkFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQ0E7UUFDQTtRQUNBOztRQUVBLElBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxlQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxJQUFBLENBQUEsRUFBQTtVQUNBO1FBQ0E7UUFDQSxJQUFBLGtCQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsZUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSxDQUFBLEVBQUE7VUFDQTtRQUNBO01BQ0E7TUFJQSxJQUFBLDhCQUFBLEdBQUEsQ0FBQTtNQUNBO01BQ0E7TUFDQSxLQUFBLElBQUEsT0FBQSxHQUFBLENBQUEsRUFBQSxPQUFBLEdBQUEsbUJBQUEsQ0FBQSxNQUFBLEVBQUEsT0FBQSxFQUFBLEVBQUE7UUFFQSxpQkFBQSxHQUFBLG1CQUFBLENBQUEsT0FBQSxDQUFBOztRQUVBO1FBQ0E7O1FBRUEsSUFBQSxLQUFBLEtBQUEsS0FBQSxDQUFBLGtDQUFBLENBQUEsV0FBQSxFQUFBLFFBQUEsQ0FBQSxFQUFBO1VBQ0EsY0FBQSxHQUFBLEtBQUEsQ0FBQSxrQ0FBQSxDQUFBLFdBQUEsRUFBQSxRQUFBLENBQUEsQ0FBQSxpQkFBQSxDQUFBLENBQUEsaUJBQUEsQ0FBQSxjQUFBLENBQUEsQ0FBQTtRQUNBLENBQUEsTUFBQTtVQUNBLGNBQUEsR0FBQSxFQUFBO1FBQ0E7UUFDQSxJQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQUE7VUFDQSxZQUFBLEdBQUEsc0NBQUEsQ0FBQSxDQUNBLENBQ0EsUUFBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxFQUNBLFFBQUEsQ0FBQSxlQUFBLENBQUEsZ0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FDQSxDQUNBLEVBQ0EsY0FBQSxDQUFBO1FBQ0EsQ0FBQSxNQUFBO1VBQ0EsV0FBQSxHQUFBLENBQUEsQ0FBQSxLQUFBLGVBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLE9BQUEsQ0FBQTtVQUNBLFlBQUEsR0FBQSxvQ0FBQSxDQUNBLFdBQUEsR0FDQSxRQUFBLENBQUEsZUFBQSxDQUFBLGdCQUFBLENBQUEsR0FBQSxFQUFBLEdBQ0EsUUFBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLEdBQUEsRUFBQSxFQUVBLGNBQUEsQ0FBQTtRQUNBO1FBQ0EsSUFBQSxZQUFBLEVBQUE7VUFDQSw4QkFBQSxFQUFBLENBQUEsQ0FBQTtRQUNBO01BRUE7TUFFQSxJQUFBLG1CQUFBLENBQUEsTUFBQSxJQUFBLDhCQUFBLEVBQUE7UUFDQTs7UUFFQSxtQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLFFBQUEsR0FBQSxDQUFBO1FBQ0EsTUFBQSxDQUFBO01BQ0E7SUFDQTtFQUNBOztFQUdBO0VBQ0EsNENBQUEsQ0FBQSxtQkFBQSxDQUFBO0VBRUEsTUFBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsOEJBQUEsRUFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsMEJBQUEsQ0FBQSx3QkFBQSxFQUFBLFFBQUEsRUFBQSxlQUFBLEVBQUE7RUFFQTtFQUNBLElBQUEsWUFBQSxHQUFBLFFBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0VBQ0EsSUFBQSxrQkFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxRQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLFFBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsOEJBQUEsR0FBQSxrQkFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBO0VBRUEsSUFBQSxZQUFBLEdBQUEsS0FBQTtFQUVBLElBQUEsZUFBQSxDQUFBLGdCQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsd0JBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxHQUFBLDhCQUFBLEdBQUEsQ0FBQSxRQUFBLENBQUEsZUFBQSxDQUFBLGdCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBLElBQUEsSUFBQSxFQUFBO01BQ0EsWUFBQSxHQUFBLElBQUE7SUFDQTtJQUNBLElBQUEsd0JBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxHQUFBLDhCQUFBLEdBQUEsQ0FBQSxRQUFBLENBQUEsZUFBQSxDQUFBLGdCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBLElBQUEsSUFBQSxFQUFBO01BQ0EsWUFBQSxHQUFBLElBQUE7SUFDQTtFQUVBLENBQUEsTUFBQTtJQUNBLElBQUEsV0FBQSxHQUFBLENBQUEsQ0FBQSxLQUFBLGVBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLE9BQUEsQ0FBQTtJQUVBLElBQUEsc0JBQUEsR0FBQSxXQUFBLEdBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLFFBQUEsQ0FBQSxlQUFBLENBQUEsZ0JBQUEsQ0FBQSxHQUFBLEVBQUE7SUFFQSxzQkFBQSxHQUFBLDhCQUFBLEdBQUEsc0JBQUEsR0FBQSxJQUFBO0lBRUEsSUFBQSx3QkFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEdBQUEsc0JBQUEsRUFBQTtNQUNBLFlBQUEsR0FBQSxJQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsWUFBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxvQ0FBQSxDQUFBLE1BQUEsRUFBQSxlQUFBLEVBQUE7RUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsZUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtJQUVBLElBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxlQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxRQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EsT0FBQSxJQUFBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBO0VBQ0E7RUFFQSxPQUFBLEtBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsc0NBQUEsQ0FBQSxlQUFBLEVBQUEsZUFBQSxFQUFBO0VBRUEsSUFBQSxZQUFBO0VBRUEsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLGVBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsZUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtNQUVBLFlBQUEsR0FBQSw4QkFBQSxDQUFBLGVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxlQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7TUFFQSxJQUFBLFlBQUEsRUFBQTtRQUNBLE9BQUEsSUFBQTtNQUNBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsS0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDhDQUFBLENBQUEsV0FBQSxFQUFBO0VBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxJQUFBLGVBQUEsR0FBQSxDQUNBLHdCQUFBLEdBQUEsV0FBQSxHQUFBLElBQUEsRUFDQSx3QkFBQSxHQUFBLFdBQUEsR0FBQSxNQUFBLEVBQ0Esd0JBQUEsR0FBQSxXQUFBLEdBQUEsSUFBQSxFQUNBLHdCQUFBLEdBQUEsV0FBQSxHQUFBLE1BQUEsRUFDQSxzQkFBQSxHQUFBLFdBQUEsR0FBQSxJQUFBLEVBQ0Esc0JBQUEsR0FBQSxXQUFBLEdBQUEsTUFBQSxDQUNBO0VBRUEsSUFBQSxtQkFBQSxHQUFBLEVBQUE7O0VBRUE7RUFDQSxLQUFBLElBQUEsR0FBQSxHQUFBLENBQUEsRUFBQSxHQUFBLEdBQUEsZUFBQSxDQUFBLE1BQUEsRUFBQSxHQUFBLEVBQUEsRUFBQTtJQUVBLElBQUEsVUFBQSxHQUFBLGVBQUEsQ0FBQSxHQUFBLENBQUE7SUFDQSxJQUFBLFdBQUEsR0FBQSxNQUFBLENBQUEsVUFBQSxHQUFBLFNBQUEsQ0FBQTs7SUFFQTtJQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxXQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO01BRUEsSUFBQSxhQUFBLEdBQUEsTUFBQSxDQUFBLFVBQUEsR0FBQSxhQUFBLEdBQUEsQ0FBQSxHQUFBLEdBQUEsQ0FBQTtNQUNBLElBQUEsd0JBQUEsR0FBQSxhQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO01BQ0EsSUFBQSxnQkFBQSxHQUFBLEVBQUE7O01BRUE7TUFDQSxJQUFBLHdCQUFBLENBQUEsTUFBQSxFQUFBO1FBQUE7UUFDQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsd0JBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7VUFBQTtVQUNBOztVQUVBLElBQUEsbUJBQUEsR0FBQSx3QkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtVQUVBLElBQUEsZUFBQSxHQUFBLFFBQUEsQ0FBQSxtQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxRQUFBLENBQUEsbUJBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUE7VUFFQSxnQkFBQSxDQUFBLElBQUEsQ0FBQSxlQUFBLENBQUE7UUFDQTtNQUNBO01BRUEsbUJBQUEsQ0FBQSxJQUFBLENBQUE7UUFDQSxNQUFBLEVBQUEsTUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxNQUFBLENBQUE7UUFDQSxrQkFBQSxFQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtRQUNBLGVBQUEsRUFBQSxhQUFBO1FBQ0Esa0JBQUEsRUFBQTtNQUNBLENBQUEsQ0FBQTtJQUNBO0VBQ0E7RUFFQSxPQUFBLG1CQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw0Q0FBQSxDQUFBLG1CQUFBLEVBQUE7RUFFQSxJQUFBLGFBQUE7RUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsbUJBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFFQSxJQUFBLGFBQUEsR0FBQSxtQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLGFBQUE7SUFFQSxJQUFBLENBQUEsSUFBQSxtQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLFFBQUEsRUFBQTtNQUNBLGFBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxFQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQSxhQUFBLENBQUEsUUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUE7O01BRUE7TUFDQSxJQUFBLGFBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxDQUFBLEVBQUE7UUFDQSxhQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsRUFBQSxLQUFBLENBQUE7UUFFQSxhQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsOEJBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLEVBQUEsSUFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLFFBQUEsQ0FBQTtNQUNBO0lBRUEsQ0FBQSxNQUFBO01BQ0EsYUFBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLEVBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLGFBQUEsQ0FBQSxXQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQTtJQUNBO0VBQ0E7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHNDQUFBLENBQUEsdUJBQUEsRUFBQTtFQUVBLElBQ0EsdUJBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxJQUNBLFFBQUEsQ0FBQSx1QkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxJQUNBLFFBQUEsQ0FBQSx1QkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQSxFQUNBO0lBQ0EsT0FBQSxJQUFBO0VBQ0E7RUFFQSxPQUFBLEtBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxvQ0FBQSxDQUFBLFdBQUEsRUFBQTtFQUVBLElBQUEsa0JBQUEsR0FBQSxFQUFBO0VBQ0Esa0JBQUEsR0FBQSxNQUFBLENBQUEsZUFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtFQUVBLElBQUEsa0JBQUEsQ0FBQSxNQUFBLEVBQUE7SUFBQTtJQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxrQkFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtNQUFBO01BQ0Esa0JBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBO01BQ0Esa0JBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7TUFDQSxJQUFBLGtCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtRQUNBLGtCQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQTtJQUNBO0VBQ0E7O0VBRUE7RUFDQSxrQkFBQSxHQUFBLGtCQUFBLENBQUEsTUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO0lBQUEsT0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBO0VBQUEsQ0FBQSxDQUFBO0VBRUEsa0JBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQTtFQUVBLE9BQUEsa0JBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHVEQUFBLENBQUEsV0FBQSxFQUFBO0VBQUEsSUFBQSxxQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsSUFBQTtFQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsSUFBQSxlQUFBLEdBQUEsQ0FDQSx3QkFBQSxHQUFBLFdBQUEsR0FBQSxJQUFBLEVBQ0Esd0JBQUEsR0FBQSxXQUFBLEdBQUEsTUFBQSxFQUNBLHdCQUFBLEdBQUEsV0FBQSxHQUFBLElBQUEsRUFDQSx3QkFBQSxHQUFBLFdBQUEsR0FBQSxNQUFBLEVBQ0Esc0JBQUEsR0FBQSxXQUFBLEdBQUEsSUFBQSxFQUNBLHNCQUFBLEdBQUEsV0FBQSxHQUFBLE1BQUEsRUFDQSwyQkFBQSxHQUFBLFdBQUEsR0FBQSxJQUFBLEVBQ0EsMkJBQUEsR0FBQSxXQUFBLEdBQUEsTUFBQSxDQUNBO0VBRUEsSUFBQSxtQkFBQSxHQUFBLEVBQUE7O0VBRUE7RUFDQSxLQUFBLElBQUEsR0FBQSxHQUFBLENBQUEsRUFBQSxHQUFBLEdBQUEsZUFBQSxDQUFBLE1BQUEsRUFBQSxHQUFBLEVBQUEsRUFBQTtJQUVBLElBQUEsVUFBQSxHQUFBLGVBQUEsQ0FBQSxHQUFBLENBQUE7SUFFQSxJQUFBLFdBQUE7SUFDQSxJQUFBLHFCQUFBLEVBQUE7TUFDQSxXQUFBLEdBQUEsTUFBQSxDQUFBLGVBQUEsR0FBQSxXQUFBLEdBQUEsR0FBQSxHQUFBLFVBQUEsR0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLENBQUEsTUFBQTtNQUNBLFdBQUEsR0FBQSxNQUFBLENBQUEsZUFBQSxHQUFBLFdBQUEsR0FBQSxHQUFBLEdBQUEsVUFBQSxHQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQTs7SUFHQTtJQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxXQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO01BRUEsSUFBQSxhQUFBLEdBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQSxJQUFBLHdCQUFBLEdBQUEsYUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtNQUNBLElBQUEsZ0JBQUEsR0FBQSxFQUFBOztNQUVBO01BQ0EsSUFBQSx3QkFBQSxDQUFBLE1BQUEsRUFBQTtRQUFBO1FBQ0EsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLHdCQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO1VBQUE7VUFDQTs7VUFFQSxJQUFBLG1CQUFBLEdBQUEsd0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7VUFFQSxJQUFBLGVBQUEsR0FBQSxRQUFBLENBQUEsbUJBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxFQUFBLEdBQUEsUUFBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBO1VBRUEsZ0JBQUEsQ0FBQSxJQUFBLENBQUEsZUFBQSxDQUFBO1FBQ0E7TUFDQTtNQUVBLG1CQUFBLENBQUEsSUFBQSxDQUFBO1FBQ0EsTUFBQSxFQUFBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsV0FBQSxHQUFBLEdBQUEsR0FBQSxVQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsTUFBQSxDQUFBO1FBQ0Esa0JBQUEsRUFBQSxhQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7UUFDQSxlQUFBLEVBQUEsYUFBQTtRQUNBLGtCQUFBLEVBQUE7TUFDQSxDQUFBLENBQUE7SUFDQTtFQUNBOztFQUVBOztFQUVBLElBQUEsb0JBQUEsR0FBQSxDQUNBLHVCQUFBLEdBQUEsV0FBQSxHQUFBLElBQUEsRUFDQSxxQkFBQSxHQUFBLFdBQUEsR0FBQSxJQUFBLENBQ0E7RUFDQSxLQUFBLElBQUEsRUFBQSxHQUFBLENBQUEsRUFBQSxFQUFBLEdBQUEsb0JBQUEsQ0FBQSxNQUFBLEVBQUEsRUFBQSxFQUFBLEVBQUE7SUFFQSxJQUFBLFdBQUEsR0FBQSxNQUFBLENBQUEsZUFBQSxHQUFBLFdBQUEsR0FBQSxHQUFBLEdBQUEsb0JBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxJQUFBLFdBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO01BRUEsSUFBQSxjQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLElBQUEsQ0FBQSxJQUFBLGNBQUEsQ0FBQSxNQUFBLEVBQUE7UUFDQSxTQUFBLENBQUE7TUFDQTtNQUNBLElBQUEsQ0FBQSxJQUFBLGNBQUEsQ0FBQSxNQUFBLEVBQUE7UUFDQSxJQUFBLEVBQUEsS0FBQSxjQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7VUFDQSxTQUFBLENBQUE7UUFDQTtRQUNBLGNBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBO01BQ0E7TUFDQSxJQUFBLG9CQUFBLEdBQUEsUUFBQSxDQUFBLGNBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxFQUFBLEdBQUEsUUFBQSxDQUFBLGNBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUE7TUFFQSxJQUFBLHFCQUFBLEdBQUEsRUFBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLG9CQUFBLENBQUE7TUFFQSxtQkFBQSxDQUFBLElBQUEsQ0FBQTtRQUNBLE1BQUEsRUFBQSxXQUFBLENBQUEsSUFBQSxDQUFBLE1BQUEsQ0FBQTtRQUNBLGtCQUFBLEVBQUEsV0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO1FBQ0EsZUFBQSxFQUFBLFdBQUE7UUFDQSxrQkFBQSxFQUFBO01BQ0EsQ0FBQSxDQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsbUJBQUE7QUFDQTs7QUFJQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsdUJBQUEsQ0FBQSxXQUFBLEVBQUE7RUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLFdBQUEsRUFBQTtJQUNBLFdBQUEsR0FBQSxHQUFBO0VBQ0E7RUFFQSxJQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQUE7SUFDQSxPQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBO0VBRUEsT0FBQSxJQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxpQ0FBQSxDQUFBLFdBQUEsRUFBQTtFQUVBLElBQUEsV0FBQSxLQUFBLE9BQUEsV0FBQSxFQUFBO0lBQ0EsV0FBQSxHQUFBLEdBQUE7RUFDQTtFQUVBLElBQUEsSUFBQSxHQUFBLHVCQUFBLENBQUEsV0FBQSxDQUFBO0VBRUEsSUFBQSxJQUFBLEtBQUEsSUFBQSxFQUFBO0lBRUE7SUFDQSxNQUFBLENBQUEsZUFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsSUFBQSxDQUFBLFFBQUEsR0FBQSxLQUFBO0lBQ0EsSUFBQSxDQUFBLEtBQUEsR0FBQSxFQUFBO0lBQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxlQUFBLENBQUEsSUFBQSxDQUFBO0lBRUEsT0FBQSxJQUFBO0VBQ0E7RUFFQSxPQUFBLEtBQUE7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx1Q0FBQSxDQUFBLFdBQUEsRUFBQTtFQUVBLElBQUEsV0FBQSxLQUFBLE9BQUEsV0FBQSxFQUFBO0lBRUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxHQUFBLDJCQUFBLENBQUEsQ0FBQSxXQUFBLENBQUEseUJBQUEsQ0FBQSxDQUFBLENBQUE7RUFFQSxDQUFBLE1BQUE7SUFDQSxNQUFBLENBQUEsMEJBQUEsQ0FBQSxDQUFBLFdBQUEsQ0FBQSx5QkFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUEsSUFBQSxFQUFBLEtBQUEsRUFBQTtFQUVBLElBQUEsV0FBQSxLQUFBLE9BQUEsV0FBQSxFQUFBO0lBQUEsV0FBQSxHQUFBLEdBQUE7RUFBQTtFQUNBLElBQUEsSUFBQSxHQUFBLHVCQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsSUFBQSxJQUFBLEtBQUEsSUFBQSxFQUFBO0lBRUEsSUFBQSxHQUFBLFFBQUEsQ0FBQSxJQUFBLENBQUE7SUFDQSxLQUFBLEdBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBOztJQUVBLElBQUEsQ0FBQSxVQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsQ0FBQTtJQUNBO0lBQ0EsSUFBQSxDQUFBLFVBQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSxFQUFBLEtBQUEsRUFBQSxDQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsVUFBQSxDQUFBLFFBQUEsQ0FBQSxLQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsVUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7SUFFQSxJQUFBLENBQUEsU0FBQSxHQUFBLElBQUEsQ0FBQSxVQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsUUFBQSxHQUFBLElBQUEsQ0FBQSxVQUFBLENBQUEsV0FBQSxDQUFBLENBQUE7SUFFQSxNQUFBLENBQUEsUUFBQSxDQUFBLGFBQUEsQ0FBQSxJQUFBLENBQUE7SUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxJQUFBLENBQUE7SUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLFNBQUEsQ0FBQSxJQUFBLENBQUE7SUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxJQUFBLENBQUE7SUFFQSxPQUFBLElBQUE7RUFDQTtFQUNBLE9BQUEsS0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSwyQkFBQSxDQUFBLFdBQUEsRUFBQSxhQUFBLEVBQUE7RUFFQTtFQUNBLElBQUEsaUJBQUEsR0FBQSxLQUFBLENBQUEsa0NBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxDQUFBO0VBRUEsSUFBQSxpQkFBQSxHQUFBLFFBQUEsQ0FBQSxpQkFBQSxDQUFBLGtCQUFBLENBQUEsQ0FBQSxHQUFBLENBQUE7RUFFQSxJQUFBLE9BQUEsaUJBQUEsQ0FBQSxTQUFBLENBQUEsS0FBQSxXQUFBLEVBQUE7SUFDQSxPQUFBLGlCQUFBO0VBQ0E7RUFFQSxJQUFBLFdBQUEsSUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGdCQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsOEJBQUEsR0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEseUJBQUEsQ0FBQSxDQUFBLENBQUE7O0lBRUEsUUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUE7TUFDQSxLQUFBLFNBQUE7TUFDQTtNQUNBLEtBQUEsaUJBQUE7TUFDQSxLQUFBLGtCQUFBO01BQ0EsS0FBQSxrQkFBQTtRQUNBLGlCQUFBLEdBQUEsaUJBQUEsR0FBQSxJQUFBLEdBQUEsOEJBQUE7UUFDQTtNQUNBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsaUJBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsb0NBQUEsQ0FBQSxnQkFBQSxFQUFBLFlBQUEsRUFBQTtFQUVBLEtBQUEsSUFBQSxVQUFBLEdBQUEsQ0FBQSxFQUFBLFVBQUEsR0FBQSxZQUFBLENBQUEsTUFBQSxFQUFBLFVBQUEsRUFBQSxFQUFBO0lBQUE7SUFDQSxJQUFBLFlBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxLQUFBLGdCQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsSUFDQSxZQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsS0FBQSxnQkFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLElBQ0EsWUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEtBQUEsZ0JBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EsT0FBQSxJQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsS0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEseUJBQUEsQ0FBQSxJQUFBLEVBQUE7RUFFQSxJQUFBLGFBQUEsR0FBQSxJQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBO0VBQ0EsYUFBQSxJQUFBLElBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsR0FBQSxHQUFBLEVBQUE7RUFDQSxhQUFBLElBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLEdBQUE7RUFDQSxhQUFBLElBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEdBQUEsR0FBQSxFQUFBO0VBQ0EsYUFBQSxJQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtFQUVBLE9BQUEsYUFBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGtCQUFBLENBQUEsY0FBQSxFQUFBO0VBRUEsSUFBQSxrQkFBQSxHQUFBLGNBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0VBRUEsSUFBQSxPQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsQ0FBQTtFQUVBLE9BQUEsQ0FBQSxXQUFBLENBQUEsUUFBQSxDQUFBLGtCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxRQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxRQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQTtFQUNBLE9BQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsT0FBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLE9BQUEsQ0FBQSxlQUFBLENBQUEsQ0FBQSxDQUFBO0VBRUEsT0FBQSxPQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx3QkFBQSxDQUFBLElBQUEsRUFBQTtFQUVBLElBQUEsWUFBQSxHQUFBLElBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLElBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUEsT0FBQSxZQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHdDQUFBLENBQUEsSUFBQSxFQUFBLFNBQUEsRUFBQTtFQUVBLFNBQUEsR0FBQSxXQUFBLEtBQUEsT0FBQSxTQUFBLEdBQUEsU0FBQSxHQUFBLEdBQUE7RUFFQSxJQUFBLFFBQUEsR0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLFNBQUEsQ0FBQTtFQUNBLElBQUEsUUFBQSxHQUFBO0lBQ0EsTUFBQSxFQUFBLFFBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxPQUFBLEVBQUEsUUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUE7SUFDQSxNQUFBLEVBQUEsUUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxDQUFBO0VBQ0EsT0FBQSxRQUFBLENBQUEsQ0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw2QkFBQSxDQUFBLFdBQUEsRUFBQTtFQUNBLElBQUEsQ0FBQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSwyQkFBQSxDQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsb0ZBQUEsQ0FBQTtFQUNBO0VBQ0EsSUFBQSxDQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSwwQkFBQSxDQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsMEJBQUEsQ0FBQTtFQUNBO0VBQ0EsMEJBQUEsQ0FBQSxXQUFBLENBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsNEJBQUEsQ0FBQSxXQUFBLEVBQUE7RUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLEdBQUEsK0JBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBO0VBQ0EsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsV0FBQSxDQUFBLDBCQUFBLENBQUE7RUFDQSx5QkFBQSxDQUFBLFdBQUEsQ0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSwwQkFBQSxDQUFBLFdBQUEsRUFBQTtFQUNBLElBQUEsQ0FBQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsb0JBQUEsQ0FBQSxFQUFBO0lBQ0EsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsUUFBQSxDQUFBLG9CQUFBLENBQUE7RUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQTtFQUNBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFdBQUEsQ0FBQSxvQkFBQSxDQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDBCQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsSUFBQSxJQUFBLEdBQUEsdUJBQUEsQ0FBQSxXQUFBLENBQUE7RUFFQSxNQUFBLENBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxJQUFBLENBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG1DQUFBLENBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtFQUNBLElBQUEsSUFBQSxHQUFBLHVCQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsSUFBQSxJQUFBLEtBQUEsSUFBQSxFQUFBO0lBQ0EsSUFBQSxDQUFBLFFBQUEsQ0FBQSxnQkFBQSxDQUFBLEdBQUEsYUFBQTtJQUNBO0lBQ0EsMEJBQUEsQ0FBQSxXQUFBLENBQUE7RUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDJCQUFBLENBQUEsaUJBQUEsRUFBQTtFQUVBOztFQUVBO0VBQ0EsSUFBQSxVQUFBLEdBQUEsUUFBQSxDQUFBLGNBQUEsQ0FBQSx3QkFBQSxDQUFBO0VBQ0EsVUFBQSxDQUFBLFVBQUEsQ0FBQSxXQUFBLENBQUEsVUFBQSxDQUFBOztFQUdBO0VBQ0EsSUFBQSxNQUFBLEdBQUEsUUFBQSxDQUFBLG9CQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxPQUFBLEdBQUEsUUFBQSxDQUFBLGFBQUEsQ0FBQSxNQUFBLENBQUE7RUFDQSxPQUFBLENBQUEsSUFBQSxHQUFBLFVBQUE7RUFDQSxPQUFBLENBQUEsWUFBQSxDQUFBLElBQUEsRUFBQSx3QkFBQSxDQUFBO0VBQ0EsT0FBQSxDQUFBLEdBQUEsR0FBQSxZQUFBO0VBQ0EsT0FBQSxDQUFBLEtBQUEsR0FBQSxRQUFBO0VBQ0EsT0FBQSxDQUFBLElBQUEsR0FBQSxpQkFBQSxDQUFBLENBQUE7RUFDQSxNQUFBLENBQUEsV0FBQSxDQUFBLE9BQUEsQ0FBQTtBQUNBO0FBR0EsU0FBQSxzQkFBQSxDQUFBLGlCQUFBLEVBQUE7RUFBQSxJQUFBLGFBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLDJCQUFBO0VBRUE7RUFDQSxJQUFBLFVBQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLGFBQUEsQ0FBQTtFQUNBLFVBQUEsQ0FBQSxVQUFBLENBQUEsV0FBQSxDQUFBLFVBQUEsQ0FBQTs7RUFHQTtFQUNBLElBQUEsTUFBQSxHQUFBLFFBQUEsQ0FBQSxvQkFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsT0FBQSxHQUFBLFFBQUEsQ0FBQSxhQUFBLENBQUEsTUFBQSxDQUFBO0VBQ0EsT0FBQSxDQUFBLElBQUEsR0FBQSxVQUFBO0VBQ0EsT0FBQSxDQUFBLFlBQUEsQ0FBQSxJQUFBLEVBQUEsYUFBQSxDQUFBO0VBQ0EsT0FBQSxDQUFBLEdBQUEsR0FBQSxZQUFBO0VBQ0EsT0FBQSxDQUFBLEtBQUEsR0FBQSxRQUFBO0VBQ0EsT0FBQSxDQUFBLElBQUEsR0FBQSxpQkFBQSxDQUFBLENBQUE7RUFDQSxNQUFBLENBQUEsV0FBQSxDQUFBLE9BQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxnQ0FBQSxDQUFBLFNBQUEsRUFBQTtFQUVBLElBQUEsQ0FBQSxTQUFBLElBQUEsU0FBQSxDQUFBLE1BQUEsS0FBQSxDQUFBLEVBQUE7SUFDQSxPQUFBLEVBQUE7RUFDQTtFQUVBLElBQUEsTUFBQSxHQUFBLEVBQUE7RUFDQSxTQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQTtJQUNBLE9BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxDQUFBLENBQUE7RUFFQSxJQUFBLGNBQUEsR0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBO0VBRUEsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFDQSxJQUFBLFFBQUEsR0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBO0lBRUEsSUFBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EsY0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLENBQUEsTUFBQTtNQUNBLE1BQUEsQ0FBQSxJQUFBLENBQUEsY0FBQSxDQUFBO01BQ0EsY0FBQSxHQUFBLFFBQUE7SUFDQTtFQUNBO0VBRUEsTUFBQSxDQUFBLElBQUEsQ0FBQSxjQUFBLENBQUE7RUFDQSxPQUFBLE1BQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsOEJBQUEsQ0FBQSxVQUFBLEVBQUEsVUFBQSxFQUFBO0VBRUEsSUFDQSxDQUFBLElBQUEsVUFBQSxDQUFBLE1BQUEsSUFDQSxDQUFBLElBQUEsVUFBQSxDQUFBLE1BQUEsRUFDQTtJQUNBLE9BQUEsS0FBQTtFQUNBO0VBRUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxVQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLFVBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxRQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsVUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFFQSxJQUFBLGNBQUEsR0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQTtFQUNBOztFQUVBLElBQUEsY0FBQSxHQUFBLENBQUEsRUFBQTtJQUNBLE9BQUEsSUFBQSxDQUFBLENBQUE7RUFDQTtFQUVBLE9BQUEsS0FBQSxDQUFBLENBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsaUNBQUEsQ0FBQSxPQUFBLEVBQUEsT0FBQSxFQUFBO0VBRUEsSUFBQSxPQUFBLENBQUEsTUFBQSxJQUFBLENBQUEsRUFBQTtJQUFBO0lBQ0EsT0FBQSxPQUFBO0VBQ0E7RUFFQSxJQUFBLEdBQUEsR0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxJQUFBLEdBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxPQUFBLEdBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsV0FBQSxHQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBOztFQUVBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxPQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO0lBQ0EsR0FBQSxHQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7SUFFQSxJQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsT0FBQSxHQUFBLEdBQUEsQ0FBQSxHQUFBLElBQUEsRUFBQTtNQUFBO01BQ0EsSUFBQSxHQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsT0FBQSxHQUFBLEdBQUEsQ0FBQTtNQUNBLFdBQUEsR0FBQSxHQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsV0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxxQ0FBQSxDQUFBLFlBQUEsRUFBQSxXQUFBLEVBQUEsUUFBQSxFQUFBO0VBRUE7O0VBRUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxHQUFBLGVBQUEsR0FBQSxRQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsY0FBQSxFQUFBLFlBQUEsQ0FBQTtFQUVBLElBQUEsS0FBQSxHQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsR0FBQSxlQUFBLEdBQUEsUUFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUEsSUFDQSxXQUFBLEtBQUEsT0FBQSxLQUFBLElBQ0EsU0FBQSxJQUFBLEtBQUEsQ0FBQSxNQUFBLElBQ0EsRUFBQSxLQUFBLFlBQUEsRUFDQTtJQUVBLFVBQUEsQ0FBQSxLQUFBLEVBQUE7TUFDQSxPQUFBLFdBQUEsUUFBQSxTQUFBLEVBQUE7UUFFQSxJQUFBLGVBQUEsR0FBQSxTQUFBLENBQUEsWUFBQSxDQUFBLGNBQUEsQ0FBQTtRQUVBLE9BQUEscUNBQUEsR0FDQSwrQkFBQSxHQUNBLGVBQUEsR0FDQSxRQUFBLEdBQ0EsUUFBQTtNQUNBLENBQUE7TUFDQSxTQUFBLEVBQUEsSUFBQTtNQUNBLE9BQUEsRUFBQSxrQkFBQTtNQUNBLFdBQUEsRUFBQSxLQUFBO01BQ0EsV0FBQSxFQUFBLElBQUE7TUFDQSxpQkFBQSxFQUFBLEVBQUE7TUFDQSxRQUFBLEVBQUEsR0FBQTtNQUNBLEtBQUEsRUFBQSxrQkFBQTtNQUNBLFNBQUEsRUFBQSxLQUFBO01BQ0EsS0FBQSxFQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsQ0FBQTtNQUFBO01BQ0E7TUFDQSxnQkFBQSxFQUFBLElBQUE7TUFDQSxLQUFBLEVBQUEsSUFBQTtNQUFBO01BQ0EsUUFBQSxFQUFBLFNBQUEsU0FBQTtRQUFBLE9BQUEsUUFBQSxDQUFBLElBQUE7TUFBQTtJQUNBLENBQUEsQ0FBQTtJQUVBLE9BQUEsSUFBQTtFQUNBO0VBRUEsT0FBQSxLQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx3QkFBQSxDQUFBLEtBQUEsRUFBQSxLQUFBLEVBQUE7RUFFQTtFQUNBLElBQUEsT0FBQSxHQUFBLElBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUE7O0VBRUE7RUFDQSxJQUFBLFFBQUEsR0FBQSxLQUFBLENBQUEsT0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLFFBQUEsR0FBQSxLQUFBLENBQUEsT0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLGFBQUEsR0FBQSxRQUFBLEdBQUEsUUFBQTs7RUFFQTtFQUNBLE9BQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxhQUFBLEdBQUEsT0FBQSxDQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDBDQUFBLENBQUEsYUFBQSxFQUFBO0VBQUE7O0VBRUEsSUFBQSxhQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtJQUNBLElBQUEsWUFBQSxHQUFBLGtCQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsSUFBQSxZQUFBO0lBRUEsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLGFBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7TUFDQSxZQUFBLEdBQUEsa0JBQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7TUFFQSxJQUFBLHdCQUFBLENBQUEsWUFBQSxFQUFBLFlBQUEsQ0FBQSxJQUFBLENBQUEsRUFBQTtRQUNBLE9BQUEsS0FBQTtNQUNBO01BRUEsWUFBQSxHQUFBLFlBQUE7SUFDQTtFQUNBO0VBRUEsT0FBQSxJQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsa0NBQUEsQ0FBQSxXQUFBLEVBQUEsWUFBQSxFQUFBO0VBQUEsSUFBQSxhQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsUUFBQSxTQUFBLFFBQUEsU0FBQSxHQUFBLFNBQUEsTUFBQSxFQUFBO0VBQUE7O0VBRUEsT0FBQSxDQUFBLEdBQUEsQ0FBQSxnRkFBQSxFQUFBLFdBQUEsRUFBQSxZQUFBLEVBQUEsYUFBQSxDQUFBO0VBRUEsSUFDQSxZQUFBLElBQUEsWUFBQSxJQUNBLFlBQUEsSUFBQSxhQUFBLElBQ0EsRUFBQSxJQUFBLFlBQUEsSUFBQSxFQUFBLElBQUEsYUFBQSxFQUNBO0lBQ0EsT0FBQSxDQUFBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBO0VBQ0EsSUFBQSxtQkFBQSxHQUFBLEVBQUE7RUFDQSxJQUFBLEtBQUEsQ0FBQSxPQUFBLENBQUEsWUFBQSxDQUFBLEVBQUE7SUFDQSxtQkFBQSxHQUFBLGNBQUEsQ0FBQSxZQUFBLENBQUE7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQSxJQUNBLG1CQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsSUFDQSxFQUFBLElBQUEsYUFBQSxJQUNBLENBQUEsMENBQUEsQ0FBQSxtQkFBQSxDQUFBLEVBQ0E7TUFDQSw4QkFBQSxDQUFBLFdBQUEsQ0FBQTtJQUNBO0lBQ0E7SUFDQSxJQUNBLG1CQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsSUFDQSxFQUFBLElBQUEsYUFBQSxJQUNBLFFBQUEsS0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsa0JBQUEsQ0FBQSxFQUNBO01BQ0EsOEJBQUEsQ0FBQSxXQUFBLENBQUE7SUFDQTtJQUNBO0lBQ0EsWUFBQSxHQUFBLG1CQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsSUFBQSxFQUFBLElBQUEsYUFBQSxFQUFBO01BQ0EsYUFBQSxHQUFBLG1CQUFBLENBQUEsbUJBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxDQUFBO0lBQ0E7RUFDQTtFQUNBOztFQUdBLElBQUEsRUFBQSxJQUFBLFlBQUEsRUFBQTtJQUNBLFlBQUEsR0FBQSxhQUFBO0VBQ0E7RUFDQSxJQUFBLEVBQUEsSUFBQSxhQUFBLEVBQUE7SUFDQSxhQUFBLEdBQUEsWUFBQTtFQUNBO0VBRUEsSUFBQSxXQUFBLEtBQUEsT0FBQSxXQUFBLEVBQUE7SUFDQSxXQUFBLEdBQUEsR0FBQTtFQUNBO0VBR0EsSUFBQSxJQUFBLEdBQUEsdUJBQUEsQ0FBQSxXQUFBLENBQUE7RUFFQSxJQUFBLElBQUEsS0FBQSxJQUFBLEVBQUE7SUFFQTtJQUNBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsUUFBQSxHQUFBLEtBQUE7SUFDQSxJQUFBLENBQUEsS0FBQSxHQUFBLEVBQUE7SUFDQSxJQUFBLFdBQUEsR0FBQSxrQkFBQSxDQUFBLFlBQUEsQ0FBQTtJQUNBLElBQUEsT0FBQSxHQUFBLG1CQUFBLENBQUEsSUFBQSxDQUFBLEVBQUEsRUFBQSxXQUFBLENBQUE7O0lBRUE7SUFDQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsa0JBQUEsQ0FBQSxFQUFBO01BQ0EsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLEVBQUEsVUFBQSxDQUFBO0lBQ0E7O0lBR0E7SUFDQTtJQUNBLElBQUEsU0FBQSxLQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLEVBQUE7TUFDQTtNQUNBLElBQUEsQ0FBQSxRQUFBLEdBQUEsS0FBQTtNQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsVUFBQSxDQUFBLE9BQUEsRUFBQSxHQUFBLEdBQUEsSUFBQSxDQUFBLEVBQUEsRUFBQSxXQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLElBQUEsQ0FBQSxLQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxFQUFBO1FBQ0EsT0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBOztNQUVBO01BQ0EsSUFBQSxZQUFBLEdBQUEsa0JBQUEsQ0FBQSxhQUFBLENBQUE7TUFDQSxJQUFBLFdBQUEsR0FBQSxtQkFBQSxDQUFBLElBQUEsQ0FBQSxFQUFBLEVBQUEsWUFBQSxDQUFBO01BQ0EsSUFBQSxDQUFBLFFBQUEsR0FBQSxJQUFBO01BQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsV0FBQSxFQUFBLEdBQUEsR0FBQSxJQUFBLENBQUEsRUFBQSxFQUFBLFlBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBLElBQUEsT0FBQSxLQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLEVBQUE7TUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxPQUFBLEVBQUEsR0FBQSxHQUFBLElBQUEsQ0FBQSxFQUFBLEVBQUEsV0FBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0EsSUFBQSxRQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtNQUNBO01BQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsT0FBQSxFQUFBLEdBQUEsR0FBQSxJQUFBLENBQUEsRUFBQSxFQUFBLFdBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0E7O0lBRUE7SUFDQTtJQUNBLElBQUEsVUFBQSxLQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLEVBQUE7TUFFQSxJQUFBLFNBQUE7TUFFQSxJQUFBLG1CQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtRQUNBO1FBQ0EsU0FBQSxHQUFBLDZDQUFBLENBQUEsbUJBQUEsQ0FBQTtNQUNBLENBQUEsTUFBQTtRQUNBLFNBQUEsR0FBQSxzREFBQSxDQUFBLFlBQUEsRUFBQSxhQUFBLEVBQUEsSUFBQSxDQUFBO01BQ0E7TUFFQSxJQUFBLENBQUEsS0FBQSxTQUFBLENBQUEsUUFBQSxDQUFBLE1BQUEsRUFBQTtRQUNBLE9BQUEsQ0FBQTtNQUNBOztNQUVBO01BQ0EsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLFNBQUEsQ0FBQSxRQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO1FBQUE7O1FBRUEsSUFBQSxRQUFBLEdBQUEseUJBQUEsQ0FBQSxTQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBOztRQUVBO1FBQ0EsSUFBQSxDQUFBLElBQUEsS0FBQSxDQUFBLGtDQUFBLENBQUEsV0FBQSxFQUFBLFFBQUEsQ0FBQSxDQUFBLGdCQUFBLEVBQUE7VUFDQSxPQUFBLENBQUE7UUFDQTtRQUVBLElBQUEsU0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsRUFBQTtVQUNBLElBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxDQUFBLFNBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7UUFDQTtNQUNBO01BRUEsSUFBQSxjQUFBLEdBQUEsU0FBQSxDQUFBLFFBQUEsQ0FBQSxTQUFBLENBQUEsUUFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLENBQUE7TUFFQSxJQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsQ0FBQSxjQUFBLENBQUEsQ0FBQSxDQUFBOztNQUVBLElBQUEsa0JBQUEsR0FBQSxjQUFBLENBQUEsT0FBQSxDQUFBLENBQUE7TUFDQSxJQUFBLE9BQUEsR0FBQSxtQkFBQSxDQUFBLElBQUEsQ0FBQSxFQUFBLEVBQUEsY0FBQSxDQUFBO01BRUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsT0FBQSxFQUFBLEdBQUEsR0FBQSxJQUFBLENBQUEsRUFBQSxFQUFBLGtCQUFBLENBQUE7SUFDQTtJQUdBLElBQUEsQ0FBQSxLQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQSxFQUFBO01BQ0E7TUFDQSx3QkFBQSxDQUFBLFdBQUEsRUFBQSxJQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLEVBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtJQUNBO0lBRUEsT0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLE1BQUE7RUFDQTtFQUVBLE9BQUEsQ0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxtQkFBQSxDQUFBLGdCQUFBLEVBQUEsT0FBQSxFQUFBO0VBRUEsSUFBQSxPQUFBLEdBQUEsTUFBQSxDQUFBLEdBQUEsR0FBQSxnQkFBQSxHQUFBLGFBQUEsR0FBQSx5QkFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQTtFQUVBLE9BQUEsT0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHNEQUFBLENBQUEsWUFBQSxFQUFBLGFBQUEsRUFBQSxJQUFBLEVBQUE7RUFFQSxJQUFBLGNBQUEsR0FBQSxFQUFBO0VBQ0EsSUFBQSxJQUFBO0VBQ0EsSUFBQSxpQkFBQSxHQUFBLEVBQUE7RUFFQSxJQUFBLGFBQUEsR0FBQSxZQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtFQUNBLElBQUEsY0FBQSxHQUFBLGFBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0VBRUEsSUFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLENBQUE7RUFDQSxJQUFBLENBQUEsV0FBQSxDQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLHNCQUFBLEdBQUEsSUFBQTtFQUNBLGNBQUEsQ0FBQSxJQUFBLENBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxlQUFBLENBQUEsSUFBQSxFQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLENBQUEsYUFBQSxDQUFBLGlCQUFBLEVBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO0lBQ0EsaUJBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxDQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxRQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBO0VBRUEsSUFBQSxRQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsQ0FBQTtFQUNBLFFBQUEsQ0FBQSxXQUFBLENBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLGNBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsdUJBQUEsR0FBQSxRQUFBO0VBRUEsSUFBQSxPQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsc0JBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxFQUFBLHNCQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsRUFBQSxzQkFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxPQUFBLENBQUEsT0FBQSxDQUFBLHNCQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7RUFFQSxPQUNBLHVCQUFBLEdBQUEsSUFBQSxJQUNBLHNCQUFBLElBQUEsdUJBQUEsRUFBQTtJQUNBLElBQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsRUFBQSxPQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsRUFBQSxPQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtJQUVBLGNBQUEsQ0FBQSxJQUFBLENBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxlQUFBLENBQUEsSUFBQSxFQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLElBQUEsRUFBQSxJQUFBLEVBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsYUFBQSxDQUFBLGlCQUFBLEVBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLFFBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTtNQUNBLGlCQUFBLENBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxRQUFBLENBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLElBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0E7SUFFQSxPQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLEVBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEVBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxPQUFBLENBQUEsT0FBQSxDQUFBLE9BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtFQUNBO0VBQ0EsY0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0VBQ0EsaUJBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtFQUVBLE9BQUE7SUFBQSxVQUFBLEVBQUEsY0FBQTtJQUFBLFdBQUEsRUFBQTtFQUFBLENBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsNkNBQUEsQ0FBQSxtQkFBQSxFQUFBO0VBQUE7O0VBRUEsSUFBQSxjQUFBLEdBQUEsRUFBQTtFQUNBLElBQUEsaUJBQUEsR0FBQSxFQUFBO0VBQ0EsSUFBQSxZQUFBO0VBRUEsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLG1CQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO0lBRUEsY0FBQSxDQUFBLElBQUEsQ0FBQSxrQkFBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtJQUVBLFlBQUEsR0FBQSxtQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsYUFBQSxDQUFBLGlCQUFBLEVBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxZQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EsaUJBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxRQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBO0VBQ0E7RUFFQSxPQUFBO0lBQUEsVUFBQSxFQUFBLGNBQUE7SUFBQSxXQUFBLEVBQUE7RUFBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBLE1BQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsWUFBQTtFQUVBLElBQUEsVUFBQSxHQUFBLElBQUEsZUFBQSxDQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsTUFBQSxDQUFBOztFQUVBO0VBQ0EsSUFBQSxJQUFBLElBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSwrQ0FBQSxDQUFBLEVBQUE7SUFDQSxJQUNBLFVBQUEsQ0FBQSxHQUFBLENBQUEsc0JBQUEsQ0FBQSxJQUNBLFVBQUEsQ0FBQSxHQUFBLENBQUEsdUJBQUEsQ0FBQSxJQUNBLFVBQUEsQ0FBQSxHQUFBLENBQUEseUJBQUEsQ0FBQSxFQUNBO01BRUEsSUFBQSwyQkFBQSxHQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxDQUFBLHlCQUFBLENBQUEsQ0FBQTs7TUFFQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsZ0NBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxrQkFBQSxFQUFBO1FBRUEsSUFBQSxrQkFBQSxJQUFBLDJCQUFBLEVBQUE7VUFDQSxrQ0FBQSxDQUFBLDJCQUFBLEVBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSxzQkFBQSxDQUFBLEVBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSx1QkFBQSxDQUFBLENBQUE7UUFDQTtNQUNBLENBQUEsQ0FBQTtJQUNBO0VBQ0E7RUFFQSxJQUFBLFVBQUEsQ0FBQSxHQUFBLENBQUEsZ0JBQUEsQ0FBQSxFQUFBO0lBRUEsSUFBQSxvQkFBQSxHQUFBLFVBQUEsQ0FBQSxHQUFBLENBQUEsZ0JBQUEsQ0FBQTs7SUFFQTtJQUNBLG9CQUFBLEdBQUEsb0JBQUEsQ0FBQSxVQUFBLENBQUEsS0FBQSxFQUFBLEdBQUEsQ0FBQTtJQUVBLDZCQUFBLENBQUEsb0JBQUEsQ0FBQTtFQUNBO0FBRUEsQ0FBQSxDQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDZCQUFBLENBQUEsYUFBQSxFQUFBO0VBQUE7O0VBRUEsSUFBQSxFQUFBLElBQUEsYUFBQSxFQUFBO0lBQ0E7RUFDQTs7RUFFQTs7RUFFQSxJQUFBLFVBQUEsR0FBQSxvQ0FBQSxDQUFBLGFBQUEsQ0FBQTtFQUVBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO0lBQ0EsTUFBQSxDQUFBLFNBQUEsR0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsSUFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtFQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxvQ0FBQSxDQUFBLFFBQUEsRUFBQTtFQUVBLElBQUEsa0JBQUEsR0FBQSxFQUFBO0VBRUEsSUFBQSxRQUFBLEdBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7RUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsUUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtJQUVBLElBQUEsYUFBQSxHQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0lBRUEsSUFBQSxXQUFBLEdBQUEsV0FBQSxLQUFBLE9BQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBO0lBQ0EsSUFBQSxZQUFBLEdBQUEsV0FBQSxLQUFBLE9BQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBO0lBRUEsa0JBQUEsQ0FBQSxJQUFBLENBQ0E7TUFDQSxNQUFBLEVBQUEsV0FBQTtNQUNBLE9BQUEsRUFBQTtJQUNBLENBQ0EsQ0FBQTtFQUNBO0VBQ0EsT0FBQSxrQkFBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsbUNBQUEsQ0FBQSxRQUFBLEVBQUE7RUFFQSxJQUFBLGtCQUFBLEdBQUEsRUFBQTtFQUVBLElBQUEsUUFBQSxHQUFBLFFBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0VBRUEsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFFQSxJQUFBLGFBQUEsR0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtJQUVBLElBQUEsV0FBQSxHQUFBLFdBQUEsS0FBQSxPQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQTtJQUNBLElBQUEsV0FBQSxHQUFBLFdBQUEsS0FBQSxPQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQTtJQUNBLElBQUEsWUFBQSxHQUFBLFdBQUEsS0FBQSxPQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQTtJQUVBLGtCQUFBLENBQUEsSUFBQSxDQUNBO01BQ0EsTUFBQSxFQUFBLFdBQUE7TUFDQSxNQUFBLEVBQUEsV0FBQTtNQUNBLE9BQUEsRUFBQTtJQUNBLENBQ0EsQ0FBQTtFQUNBO0VBQ0EsT0FBQSxrQkFBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG1EQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsSUFBQSxJQUFBLEtBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxtQ0FBQSxDQUFBLEVBQUE7SUFDQSxPQUFBLEtBQUE7RUFDQTtFQUVBLElBQUEsdUJBQUEsR0FBQSxRQUFBLENBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLDJCQUFBLENBQUEsQ0FBQTtFQUVBLElBQUEsdUJBQUEsR0FBQSxDQUFBLEVBQUE7SUFFQSxJQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxJQUFBLEdBQUEsRUFBQTtNQUNBLG1DQUFBLENBQUEsV0FBQSxFQUFBLENBQUEsQ0FBQTtJQUNBLENBQUEsTUFBQTtNQUNBLG1DQUFBLENBQUEsV0FBQSxFQUFBLHVCQUFBLENBQUE7SUFDQTtFQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHlDQUFBLENBQUEsRUFBQTtFQUVBLElBQUEsaUJBQUEsR0FBQSxLQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBOztFQUVBO0VBQ0EsS0FBQSxJQUFBLFdBQUEsSUFBQSxpQkFBQSxFQUFBO0lBQ0EsSUFBQSxXQUFBLEtBQUEsV0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLEVBQUE7TUFDQSxJQUFBLFdBQUEsR0FBQSxRQUFBLENBQUEsV0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQSxJQUFBLFdBQUEsR0FBQSxDQUFBLEVBQUE7UUFDQSxtREFBQSxDQUFBLFdBQUEsQ0FBQTtNQUNBO0lBQ0E7RUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsUUFBQSxFQUFBLFlBQUE7RUFDQSx5Q0FBQSxDQUFBLENBQUE7QUFDQSxDQUFBLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxZQUFBO0VBQ0EsSUFBQSxZQUFBLEdBQUEsVUFBQSxDQUFBLFlBQUE7SUFDQSx5Q0FBQSxDQUFBLENBQUE7RUFDQSxDQUFBLEVBQUEsR0FBQSxDQUFBO0FBQ0EsQ0FBQSxDQUFBO0FDbGpFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGlCQUFBLENBQUEsV0FBQSxFQUFBO0VBRUE7RUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxXQUFBLENBQUEsYUFBQSxDQUFBO0VBQ0Esa0JBQUEsQ0FBQSxXQUFBLENBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw2QkFBQSxDQUFBLFdBQUEsRUFBQTtFQUVBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxzQ0FBQSxFQUNBO0lBQ0EsbUJBQUEsRUFBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsbUJBQUEsQ0FBQTtJQUNBLG1CQUFBLEVBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLG1CQUFBLENBQUE7SUFDQSx3QkFBQSxFQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSx3QkFBQSxDQUFBO0lBQ0EsMkJBQUEsRUFBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsMkJBQUEsQ0FBQTtJQUNBLGlCQUFBLEVBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGlCQUFBLENBQUE7SUFDQSx5QkFBQSxFQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSx5QkFBQTtFQUNBLENBQ0EsQ0FBQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGtDQUFBLENBQUEsV0FBQSxFQUFBO0VBRUE7RUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLFlBQUE7SUFFQTtJQUNBLFVBQUEsQ0FBQSxZQUFBO01BRUEsNEJBQUEsQ0FBQSxXQUFBLENBQUE7SUFFQSxDQUFBLEVBQUEsSUFBQSxDQUFBO0VBQ0EsQ0FBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw0QkFBQSxDQUFBLFdBQUEsRUFBQTtFQUVBLEtBQUEsQ0FBQSx3QkFBQSxDQUFBLFdBQUEsRUFBQTtJQUFBLGtCQUFBLEVBQUE7RUFBQSxDQUFBLENBQUE7RUFFQSw2QkFBQSxDQUFBLFdBQUEsQ0FBQTtFQUNBLGlCQUFBLENBQUEsV0FBQSxDQUFBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsb0NBQUEsQ0FBQSxXQUFBLEVBQUE7RUFFQTtFQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsWUFBQTtJQUVBO0lBQ0EsVUFBQSxDQUFBLFlBQUE7TUFFQSw4QkFBQSxDQUFBLFdBQUEsQ0FBQTtJQUVBLENBQUEsRUFBQSxJQUFBLENBQUE7RUFDQSxDQUFBLENBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDhCQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsS0FBQSxDQUFBLHdCQUFBLENBQUEsV0FBQSxFQUFBO0lBQUEsa0JBQUEsRUFBQTtFQUFBLENBQUEsQ0FBQTtFQUVBLDZCQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsaUJBQUEsQ0FBQSxXQUFBLENBQUE7QUFDQTs7QUFHQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsaUNBQUEsQ0FBQSxXQUFBLEVBQUEsV0FBQSxFQUFBO0VBQUEsSUFBQSxnQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUVBO0VBQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxZQUFBO0lBRUE7SUFDQSxVQUFBLENBQUEsWUFBQTtNQUVBLDJCQUFBLENBQUEsV0FBQSxFQUFBLFdBQUEsRUFBQSxnQkFBQSxDQUFBO0lBRUEsQ0FBQSxFQUFBLElBQUEsQ0FBQTtFQUNBLENBQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDJCQUFBLENBQUEsV0FBQSxFQUFBLFdBQUEsRUFBQTtFQUFBLElBQUEsZ0JBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFFQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUE7SUFBQSxrQkFBQSxFQUFBO0VBQUEsQ0FBQSxDQUFBO0VBRUEsS0FBQSxDQUFBLHdCQUFBLENBQUEsV0FBQSxFQUFBO0lBQUEsaUJBQUEsRUFBQSxRQUFBLENBQUEsV0FBQTtFQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUE7SUFBQSx5QkFBQSxFQUFBO0VBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQSw2QkFBQSxDQUFBLFdBQUEsQ0FBQTtFQUNBLGlCQUFBLENBQUEsV0FBQSxDQUFBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxpQ0FBQSxDQUFBLFdBQUEsRUFBQSxRQUFBLEVBQUEsUUFBQSxFQUFBO0VBQUEsSUFBQSxhQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsUUFBQSxTQUFBLFFBQUEsU0FBQSxHQUFBLFNBQUEsTUFBQSxFQUFBO0VBQUEsSUFBQSxnQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUVBO0VBQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxZQUFBO0lBRUE7SUFDQSxVQUFBLENBQUEsWUFBQTtNQUVBLDJCQUFBLENBQUEsV0FBQSxFQUFBLFFBQUEsRUFBQSxRQUFBLEVBQUEsYUFBQSxFQUFBLGdCQUFBLENBQUE7SUFDQSxDQUFBLEVBQUEsSUFBQSxDQUFBO0VBQ0EsQ0FBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDJCQUFBLENBQUEsV0FBQSxFQUFBLFFBQUEsRUFBQSxRQUFBLEVBQUE7RUFBQSxJQUFBLGFBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLEVBQUE7RUFBQSxJQUFBLGdCQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsUUFBQSxTQUFBLFFBQUEsU0FBQSxHQUFBLFNBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBRUEsS0FBQSxDQUFBLHdCQUFBLENBQUEsV0FBQSxFQUFBO0lBQUEsa0JBQUEsRUFBQTtFQUFBLENBQUEsQ0FBQTtFQUNBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxtQkFBQSxFQUFBLFFBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsbUJBQUEsRUFBQSxRQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLHdCQUFBLEVBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSwyQkFBQSxFQUFBLGdCQUFBLENBQUEsQ0FBQSxDQUFBOztFQUVBLDZCQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsaUJBQUEsQ0FBQSxXQUFBLENBQUE7QUFDQTs7QUN2TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUEsU0FBQSw2QkFBQSxDQUFBLE1BQUEsRUFBQTtFQUVBO0VBQ0EsNkJBQUEsQ0FBQSxNQUFBLENBQUEsYUFBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQUE7SUFDQSxJQUFBLFVBQUEsR0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLHVDQUFBLEVBQUEsQ0FBQSxNQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQTtJQUNBO0VBQ0E7RUFFQSxJQUFBLHNCQUFBLENBQUEsTUFBQSxFQUFBLCtCQUFBLENBQUEsRUFBQTtJQUNBLE9BQUEsS0FBQTtFQUNBOztFQUVBO0VBQ0EseUJBQUEsQ0FBQSxNQUFBLENBQUEsYUFBQSxDQUFBLENBQUE7O0VBR0E7RUFDQSxPQUFBLENBQUEsY0FBQSxDQUFBLHdCQUFBLENBQUE7RUFBQSxPQUFBLENBQUEsR0FBQSxDQUFBLGlEQUFBLEVBQUEsS0FBQSxDQUFBLGtCQUFBLENBQUEsQ0FBQSxDQUFBOztFQUVBO0VBQ0EsTUFBQSxDQUFBLElBQUEsQ0FBQSxhQUFBLEVBQ0E7SUFDQSxNQUFBLEVBQUEsd0JBQUE7SUFDQSxnQkFBQSxFQUFBLEtBQUEsQ0FBQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQTtJQUNBLEtBQUEsRUFBQSxLQUFBLENBQUEsZ0JBQUEsQ0FBQSxPQUFBLENBQUE7SUFDQSxlQUFBLEVBQUEsS0FBQSxDQUFBLGdCQUFBLENBQUEsUUFBQSxDQUFBO0lBRUEsdUJBQUEsRUFBQSxNQUFBLENBQUE7RUFDQSxDQUFBO0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxVQUFBLGFBQUEsRUFBQSxVQUFBLEVBQUEsS0FBQSxFQUFBO0lBQ0E7SUFDQSxPQUFBLENBQUEsR0FBQSxDQUFBLHlDQUFBLEVBQUEsYUFBQSxDQUFBO0lBQUEsT0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBOztJQUVBO0lBQ0EsSUFBQSwwQkFBQSxHQUFBLDRDQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBLHdCQUFBLENBQUEsMEJBQUEsRUFBQSwrQkFBQSxDQUFBOztJQUVBO0lBQ0EsSUFBQSxPQUFBLENBQUEsYUFBQSxNQUFBLFFBQUEsSUFBQSxhQUFBLEtBQUEsSUFBQSxFQUFBO01BRUEsSUFBQSxPQUFBLEdBQUEsd0NBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBO01BQ0EsSUFBQSxZQUFBLEdBQUEsTUFBQTtNQUVBLElBQUEsRUFBQSxLQUFBLGFBQUEsRUFBQTtRQUNBLGFBQUEsR0FBQSxnTUFBQTtRQUNBLFlBQUEsR0FBQSxTQUFBO01BQ0E7O01BRUE7TUFDQSw0QkFBQSxDQUFBLGFBQUEsRUFBQTtRQUFBLE1BQUEsRUFBQSxZQUFBO1FBQ0EsV0FBQSxFQUFBO1VBQUEsU0FBQSxFQUFBLE9BQUE7VUFBQSxPQUFBLEVBQUE7UUFBQSxDQUFBO1FBQ0EsV0FBQSxFQUFBLElBQUE7UUFDQSxPQUFBLEVBQUEsa0JBQUE7UUFDQSxPQUFBLEVBQUE7TUFDQSxDQUFBLENBQUE7TUFDQTtJQUNBOztJQUVBO0lBQ0EsNEJBQUEsQ0FBQSxhQUFBLENBQUEsYUFBQSxDQUFBLENBQUE7O0lBRUE7SUFDQTtJQUNBLEtBQUEsQ0FBQSwrQkFBQSxDQUFBLGFBQUEsQ0FBQSxhQUFBLENBQUEsRUFBQSxhQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLENBQUE7O0lBRUE7SUFDQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxhQUFBLENBQUEsYUFBQSxDQUFBLEVBQUEsNEJBQUEsRUFBQSxhQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsNEJBQUEsQ0FBQSxDQUFBOztJQUVBO0lBQ0EsS0FBQSxDQUFBLHdCQUFBLENBQUEsYUFBQSxDQUFBLGFBQUEsQ0FBQSxFQUFBLDJCQUFBLEVBQUEsYUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLDJCQUFBLENBQUEsQ0FBQTtJQUNBOztJQUVBO0lBQ0EsMEJBQUEsQ0FBQSxhQUFBLENBQUEsYUFBQSxDQUFBLENBQUE7SUFHQSxJQUNBLFdBQUEsS0FBQSxPQUFBLGFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSwwQkFBQSxDQUFBLElBQ0EsRUFBQSxJQUFBLGFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSwwQkFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLEtBQUEsRUFBQSxRQUFBLENBQUEsRUFDQTtNQUVBLElBQUEsT0FBQSxHQUFBLHdDQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQTs7TUFFQTtNQUNBLDRCQUFBLENBQUEsYUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLDBCQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsS0FBQSxFQUFBLFFBQUEsQ0FBQSxFQUNBO1FBQUEsTUFBQSxFQUFBLFdBQUEsS0FBQSxPQUFBLGFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxpQ0FBQSxDQUFBLEdBQ0EsYUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLGlDQUFBLENBQUEsR0FBQSxNQUFBO1FBQ0EsV0FBQSxFQUFBO1VBQUEsU0FBQSxFQUFBLE9BQUE7VUFBQSxPQUFBLEVBQUE7UUFBQSxDQUFBO1FBQ0EsV0FBQSxFQUFBLElBQUE7UUFDQSxPQUFBLEVBQUEsa0JBQUE7UUFDQSxPQUFBLEVBQUE7TUFDQSxDQUFBLENBQUE7SUFDQTs7SUFFQTtJQUNBLElBQUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsYUFBQSxDQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtNQUNBLElBQUEsVUFBQSxHQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsZ0NBQUEsRUFBQSxDQUFBLGFBQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0E7SUFDQTs7SUFFQTtFQUNBLENBQ0EsQ0FBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLEtBQUEsRUFBQSxVQUFBLEVBQUEsV0FBQSxFQUFBO0lBQUEsSUFBQSxNQUFBLENBQUEsT0FBQSxJQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxFQUFBO01BQUEsT0FBQSxDQUFBLEdBQUEsQ0FBQSxZQUFBLEVBQUEsS0FBQSxFQUFBLFVBQUEsRUFBQSxXQUFBLENBQUE7SUFBQTtJQUVBLElBQUEsMEJBQUEsR0FBQSw0Q0FBQSxDQUFBLElBQUEsQ0FBQSxJQUFBLENBQUE7SUFDQSx3QkFBQSxDQUFBLDBCQUFBLEVBQUEsK0JBQUEsQ0FBQTs7SUFFQTtJQUNBLElBQUEsYUFBQSxHQUFBLFVBQUEsR0FBQSxRQUFBLEdBQUEsWUFBQSxHQUFBLFdBQUE7SUFDQSxJQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7TUFDQSxhQUFBLElBQUEsT0FBQSxHQUFBLEtBQUEsQ0FBQSxNQUFBLEdBQUEsT0FBQTtNQUNBLElBQUEsR0FBQSxJQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7UUFDQSxhQUFBLElBQUEsc0pBQUE7UUFDQSxhQUFBLElBQUEsc01BQUE7TUFDQTtJQUNBO0lBQ0EsSUFBQSxrQkFBQSxHQUFBLElBQUE7SUFDQSxJQUFBLEtBQUEsQ0FBQSxZQUFBLEVBQUE7TUFDQSxhQUFBLElBQUEsR0FBQSxHQUFBLEtBQUEsQ0FBQSxZQUFBO01BQ0Esa0JBQUEsR0FBQSxFQUFBO0lBQ0E7SUFDQSxhQUFBLEdBQUEsYUFBQSxDQUFBLE9BQUEsQ0FBQSxLQUFBLEVBQUEsUUFBQSxDQUFBO0lBRUEsSUFBQSxPQUFBLEdBQUEsd0NBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBOztJQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDQSxJQUFBLFlBQUEsR0FBQSxVQUFBLENBQUEsWUFBQTtNQUVBO01BQ0EsNEJBQUEsQ0FBQSxhQUFBLEVBQUE7UUFBQSxNQUFBLEVBQUEsT0FBQTtRQUNBLFdBQUEsRUFBQTtVQUFBLFNBQUEsRUFBQSxPQUFBO1VBQUEsT0FBQSxFQUFBO1FBQUEsQ0FBQTtRQUNBLFdBQUEsRUFBQSxJQUFBO1FBQ0EsT0FBQSxFQUFBLGtCQUFBO1FBQ0EsV0FBQSxFQUFBLHFCQUFBO1FBQ0EsT0FBQSxFQUFBO01BQ0EsQ0FBQSxDQUFBO0lBQ0EsQ0FBQSxFQUNBLFFBQUEsQ0FBQSxrQkFBQSxDQUFBLENBQUE7RUFFQSxDQUFBO0VBQ0E7RUFDQTtFQUFBLENBQ0EsQ0FBQTtBQUNBOztBQUlBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHdDQUFBLENBQUEsd0JBQUEsRUFBQTtFQUVBLElBQUEsT0FBQSxHQUFBLG1CQUFBO0VBRUEsSUFBQSxvQkFBQSxHQUFBLDRDQUFBLENBQUEsd0JBQUEsQ0FBQTtFQUVBLElBQUEsb0JBQUEsR0FBQSxDQUFBLEVBQUE7SUFDQSxPQUFBLEdBQUEsbUJBQUEsR0FBQSxvQkFBQTtFQUNBO0VBRUEsT0FBQSxPQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsNENBQUEsQ0FBQSx3QkFBQSxFQUFBO0VBRUE7RUFDQSxJQUFBLG9CQUFBLEdBQUEsMEJBQUEsQ0FBQSxzQ0FBQSxFQUFBLHdCQUFBLENBQUE7RUFDQSxJQUFBLElBQUEsS0FBQSxvQkFBQSxJQUFBLEVBQUEsS0FBQSxvQkFBQSxFQUFBO0lBQ0Esb0JBQUEsR0FBQSxRQUFBLENBQUEsb0JBQUEsQ0FBQTtJQUNBLElBQUEsb0JBQUEsR0FBQSxDQUFBLEVBQUE7TUFDQSxPQUFBLG9CQUFBO0lBQ0E7RUFDQTtFQUNBLE9BQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDBCQUFBLENBQUEsSUFBQSxFQUFBLEdBQUEsRUFBQTtFQUVBLEdBQUEsR0FBQSxrQkFBQSxDQUFBLEdBQUEsQ0FBQTtFQUVBLElBQUEsR0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLFNBQUEsRUFBQSxNQUFBLENBQUE7RUFDQSxJQUFBLEtBQUEsR0FBQSxJQUFBLE1BQUEsQ0FBQSxNQUFBLEdBQUEsSUFBQSxHQUFBLG1CQUFBLENBQUE7SUFDQSxPQUFBLEdBQUEsS0FBQSxDQUFBLElBQUEsQ0FBQSxHQUFBLENBQUE7RUFDQSxJQUFBLENBQUEsT0FBQSxFQUFBLE9BQUEsSUFBQTtFQUNBLElBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsT0FBQSxFQUFBO0VBQ0EsT0FBQSxrQkFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsS0FBQSxFQUFBLEdBQUEsQ0FBQSxDQUFBO0FBQ0E7O0FDL09BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsNEJBQUEsQ0FBQSxPQUFBLEVBQUE7RUFBQSxJQUFBLE1BQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLENBQUEsQ0FBQTtFQUVBLElBQUEsY0FBQSxHQUFBO0lBQ0EsTUFBQSxFQUFBLFNBQUE7SUFBQTtJQUNBLFdBQUEsRUFBQTtNQUNBLFNBQUEsRUFBQSxFQUFBO01BQUE7TUFDQSxPQUFBLEVBQUEsUUFBQSxDQUFBO0lBQ0EsQ0FBQTtJQUNBLFdBQUEsRUFBQSxJQUFBO0lBQUE7SUFDQSxPQUFBLEVBQUEsa0JBQUE7SUFBQTtJQUNBLFdBQUEsRUFBQSxFQUFBO0lBQUE7SUFDQSxPQUFBLEVBQUEsQ0FBQTtJQUFBO0lBQ0EscUJBQUEsRUFBQSxLQUFBO0lBQUE7SUFDQSxXQUFBLEVBQUEsSUFBQSxDQUFBO0VBQ0EsQ0FBQTtFQUNBLEtBQUEsSUFBQSxLQUFBLElBQUEsTUFBQSxFQUFBO0lBQ0EsY0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUE7RUFDQTtFQUNBLE1BQUEsR0FBQSxjQUFBO0VBRUEsSUFBQSxhQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsQ0FBQTtFQUNBLGFBQUEsR0FBQSxjQUFBLEdBQUEsYUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBO0VBRUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxJQUFBLGtCQUFBO0VBQ0EsSUFBQSxNQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsT0FBQSxFQUFBO0lBQ0EsTUFBQSxDQUFBLFdBQUEsQ0FBQSxJQUFBLHdCQUFBO0lBQ0EsT0FBQSxHQUFBLGlFQUFBLEdBQUEsT0FBQTtFQUNBO0VBQ0EsSUFBQSxNQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsU0FBQSxFQUFBO0lBQ0EsTUFBQSxDQUFBLFdBQUEsQ0FBQSxJQUFBLDBCQUFBO0lBQ0EsT0FBQSxHQUFBLG9EQUFBLEdBQUEsT0FBQTtFQUNBO0VBQ0EsSUFBQSxNQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsTUFBQSxFQUFBO0lBQ0EsTUFBQSxDQUFBLFdBQUEsQ0FBQSxJQUFBLHVCQUFBO0VBQ0E7RUFDQSxJQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxTQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsV0FBQSxDQUFBLElBQUEsMEJBQUE7SUFDQSxPQUFBLEdBQUEseURBQUEsR0FBQSxPQUFBO0VBQ0E7RUFFQSxJQUFBLGlCQUFBLEdBQUEsV0FBQSxHQUFBLGFBQUEsR0FBQSx1Q0FBQTtFQUNBLE9BQUEsR0FBQSxXQUFBLEdBQUEsYUFBQSxHQUFBLG1DQUFBLEdBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLFdBQUEsR0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsSUFBQSxHQUFBLE9BQUEsR0FBQSxRQUFBO0VBR0EsSUFBQSxhQUFBLEdBQUEsS0FBQTtFQUNBLElBQUEsZUFBQSxHQUFBLElBQUE7RUFFQSxJQUFBLFFBQUEsS0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLEVBQUE7SUFFQSxJQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsaUJBQUEsQ0FBQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBO0lBQ0EsQ0FBQSxNQUFBO01BQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxpQkFBQSxHQUFBLE9BQUEsQ0FBQTtJQUNBO0VBRUEsQ0FBQSxNQUFBLElBQUEsUUFBQSxLQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsRUFBQTtJQUVBLGFBQUEsR0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsUUFBQSxDQUFBLHNCQUFBLENBQUE7SUFDQSxJQUFBLE1BQUEsQ0FBQSxxQkFBQSxDQUFBLElBQUEsYUFBQSxDQUFBLEVBQUEsQ0FBQSxVQUFBLENBQUEsRUFBQTtNQUNBLGVBQUEsR0FBQSxLQUFBO01BQ0EsYUFBQSxHQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBO0lBQ0EsSUFBQSxlQUFBLEVBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLGlCQUFBLENBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQTtJQUNBO0VBRUEsQ0FBQSxNQUFBLElBQUEsT0FBQSxLQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsRUFBQTtJQUVBLGFBQUEsR0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLHNCQUFBLENBQUE7SUFDQSxJQUFBLE1BQUEsQ0FBQSxxQkFBQSxDQUFBLElBQUEsYUFBQSxDQUFBLEVBQUEsQ0FBQSxVQUFBLENBQUEsRUFBQTtNQUNBLGVBQUEsR0FBQSxLQUFBO01BQ0EsYUFBQSxHQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBO0lBQ0EsSUFBQSxlQUFBLEVBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLGlCQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxPQUFBLENBQUE7SUFDQTtFQUVBLENBQUEsTUFBQSxJQUFBLE9BQUEsS0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLEVBQUE7SUFFQSxhQUFBLEdBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSwwQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLHNCQUFBLENBQUE7SUFDQSxJQUFBLE1BQUEsQ0FBQSxxQkFBQSxDQUFBLElBQUEsYUFBQSxDQUFBLEVBQUEsQ0FBQSxVQUFBLENBQUEsRUFBQTtNQUNBLGVBQUEsR0FBQSxLQUFBO01BQ0EsYUFBQSxHQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBO0lBQ0EsSUFBQSxlQUFBLEVBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLGlCQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSx1REFBQSxHQUFBLE9BQUEsR0FBQSxRQUFBLENBQUE7SUFDQTtFQUNBLENBQUEsTUFBQSxJQUFBLE1BQUEsS0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLEVBQUE7SUFFQSxhQUFBLEdBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSx5Q0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLHNCQUFBLENBQUE7SUFDQSxJQUFBLE1BQUEsQ0FBQSxxQkFBQSxDQUFBLElBQUEsYUFBQSxDQUFBLEVBQUEsQ0FBQSxVQUFBLENBQUEsRUFBQTtNQUNBLGVBQUEsR0FBQSxLQUFBO01BQ0EsYUFBQSxHQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBO0lBQ0EsSUFBQSxlQUFBLEVBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLGlCQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxzREFBQSxHQUFBLE9BQUEsR0FBQSxRQUFBLENBQUE7SUFDQTtFQUNBO0VBRUEsSUFBQSxlQUFBLElBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQTtJQUNBLElBQUEsWUFBQSxHQUFBLFVBQUEsQ0FBQSxZQUFBO01BQ0EsTUFBQSxDQUFBLEdBQUEsR0FBQSxhQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsSUFBQSxDQUFBO0lBQ0EsQ0FBQSxFQUFBLFFBQUEsQ0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtJQUVBLElBQUEsYUFBQSxHQUFBLFVBQUEsQ0FBQSxZQUFBO01BQ0EsTUFBQSxDQUFBLEdBQUEsR0FBQSxhQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsTUFBQSxDQUFBO0lBQ0EsQ0FBQSxFQUFBLFFBQUEsQ0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsR0FBQSxJQUFBLENBQUE7RUFDQTs7RUFFQTtFQUNBLElBQUEsVUFBQSxHQUFBLE1BQUEsQ0FBQSxHQUFBLEdBQUEsYUFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsWUFBQTtJQUNBLElBQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLFNBQUEsQ0FBQSxJQUFBLE1BQUEsQ0FBQSxpQkFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLElBQUEsQ0FBQSxFQUFBO01BQ0EsTUFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBO0lBQ0E7RUFDQSxDQUFBLENBQUE7RUFFQSxJQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtJQUNBLGNBQUEsQ0FBQSxHQUFBLEdBQUEsYUFBQSxHQUFBLFNBQUEsQ0FBQTtFQUNBO0VBRUEsT0FBQSxhQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG1DQUFBLENBQUEsT0FBQSxFQUFBLE9BQUEsRUFBQTtFQUVBLElBQUEsaUJBQUEsR0FBQSw0QkFBQSxDQUNBLE9BQUEsRUFDQTtJQUNBLE1BQUEsRUFBQSxPQUFBO0lBQ0EsT0FBQSxFQUFBLEtBQUE7SUFDQSxxQkFBQSxFQUFBLElBQUE7SUFDQSxXQUFBLEVBQUE7TUFDQSxPQUFBLEVBQUEsT0FBQTtNQUNBLFNBQUEsRUFBQTtJQUNBO0VBQ0EsQ0FDQSxDQUFBO0VBQ0EsT0FBQSxpQkFBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxpREFBQSxDQUFBLE9BQUEsRUFBQSxPQUFBLEVBQUEsYUFBQSxFQUFBO0VBRUEsSUFBQSxXQUFBLEtBQUEsT0FBQSxhQUFBLEVBQUE7SUFDQSxhQUFBLEdBQUEsQ0FBQTtFQUNBO0VBRUEsSUFBQSxpQkFBQSxHQUFBLDRCQUFBLENBQ0EsT0FBQSxFQUNBO0lBQ0EsTUFBQSxFQUFBLE9BQUE7SUFDQSxPQUFBLEVBQUEsYUFBQTtJQUNBLHFCQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQTtNQUNBLE9BQUEsRUFBQSxPQUFBO01BQ0EsU0FBQSxFQUFBO0lBQ0E7RUFDQSxDQUNBLENBQUE7RUFDQSxPQUFBLGlCQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGlEQUFBLENBQUEsT0FBQSxFQUFBLE9BQUEsRUFBQSxhQUFBLEVBQUE7RUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLGFBQUEsRUFBQTtJQUNBLGFBQUEsR0FBQSxLQUFBO0VBQ0E7RUFFQSxJQUFBLGlCQUFBLEdBQUEsNEJBQUEsQ0FDQSxPQUFBLEVBQ0E7SUFDQSxNQUFBLEVBQUEsT0FBQTtJQUNBLE9BQUEsRUFBQSxhQUFBO0lBQ0EscUJBQUEsRUFBQSxJQUFBO0lBQ0EsV0FBQSxFQUFBO01BQ0EsT0FBQSxFQUFBLFFBQUE7TUFDQSxTQUFBLEVBQUE7SUFDQTtFQUNBLENBQ0EsQ0FBQTtFQUNBLE9BQUEsaUJBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEscUNBQUEsQ0FBQSxPQUFBLEVBQUEsT0FBQSxFQUFBO0VBRUEsSUFBQSxpQkFBQSxHQUFBLDRCQUFBLENBQ0EsT0FBQSxFQUNBO0lBQ0EsTUFBQSxFQUFBLFNBQUE7SUFDQSxPQUFBLEVBQUEsS0FBQTtJQUNBLHFCQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQTtNQUNBLE9BQUEsRUFBQSxPQUFBO01BQ0EsU0FBQSxFQUFBO0lBQ0E7RUFDQSxDQUNBLENBQUE7RUFDQSxrQ0FBQSxDQUFBLE9BQUEsQ0FBQTtFQUNBLE9BQUEsaUJBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsbURBQUEsQ0FBQSxPQUFBLEVBQUEsT0FBQSxFQUFBO0VBRUEsSUFBQSxpQkFBQSxHQUFBLDRCQUFBLENBQ0EsT0FBQSxFQUNBO0lBQ0EsTUFBQSxFQUFBLFNBQUE7SUFDQSxPQUFBLEVBQUEsS0FBQTtJQUNBLHFCQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQTtNQUNBLE9BQUEsRUFBQSxPQUFBO01BQ0EsU0FBQSxFQUFBO0lBQ0E7RUFDQSxDQUNBLENBQUE7RUFDQSxPQUFBLGlCQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG1EQUFBLENBQUEsT0FBQSxFQUFBLE9BQUEsRUFBQTtFQUVBLElBQUEsaUJBQUEsR0FBQSw0QkFBQSxDQUNBLE9BQUEsRUFDQTtJQUNBLE1BQUEsRUFBQSxTQUFBO0lBQ0EsT0FBQSxFQUFBLEtBQUE7SUFDQSxxQkFBQSxFQUFBLElBQUE7SUFDQSxXQUFBLEVBQUE7TUFDQSxPQUFBLEVBQUEsUUFBQTtNQUNBLFNBQUEsRUFBQTtJQUNBO0VBQ0EsQ0FDQSxDQUFBO0VBQ0EsT0FBQSxpQkFBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGtDQUFBLENBQUEsT0FBQSxFQUFBO0VBRUEsSUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7SUFDQTtFQUNBO0VBQ0EsSUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsUUFBQSxDQUFBLEVBQUE7SUFDQTtJQUNBLElBQUEsV0FBQSxHQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxDQUFBO0lBQ0EsSUFBQSxDQUFBLFdBQUEsQ0FBQSxNQUFBLEVBQUE7TUFDQTtJQUNBO0lBQ0EsT0FBQSxHQUFBLFdBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0E7RUFDQSxJQUFBLE1BQUEsR0FBQSxDQUFBLENBQUE7RUFDQSxNQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsS0FBQTtFQUVBLElBQUEsQ0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsUUFBQSxDQUFBLHVCQUFBLENBQUEsRUFBQTtJQUVBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsdUJBQUEsQ0FBQTtJQUVBLElBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQTtNQUNBLElBQUEsWUFBQSxHQUFBLFVBQUEsQ0FBQSxZQUFBO1FBQ0EsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLFdBQUEsQ0FBQSx1QkFBQSxDQUFBO01BQ0EsQ0FBQSxFQUNBLFFBQUEsQ0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQ0EsQ0FBQTtJQUVBO0VBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGNBQUEsQ0FBQSxPQUFBLEVBQUE7RUFBQSxJQUFBLGtCQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsUUFBQSxTQUFBLFFBQUEsU0FBQSxHQUFBLFNBQUEsTUFBQSxDQUFBO0VBRUEsSUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7SUFDQTtFQUNBO0VBQ0EsSUFBQSxZQUFBLEdBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsR0FBQTtFQUVBLElBQUEsWUFBQSxJQUFBLENBQUEsRUFBQTtJQUNBLElBQUEsQ0FBQSxJQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsTUFBQSxFQUFBO01BQ0EsWUFBQSxHQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUE7SUFDQSxDQUFBLE1BQUEsSUFBQSxDQUFBLElBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtNQUNBLFlBQUEsR0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUE7SUFDQTtFQUNBO0VBRUEsSUFBQSxNQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtJQUNBLFlBQUEsR0FBQSxZQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUE7RUFDQSxDQUFBLE1BQUE7SUFDQSxZQUFBLEdBQUEsWUFBQSxHQUFBLEVBQUEsR0FBQSxFQUFBO0VBQ0E7RUFDQSxZQUFBLElBQUEsa0JBQUE7O0VBRUE7RUFDQSxJQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtJQUNBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUE7TUFBQSxTQUFBLEVBQUE7SUFBQSxDQUFBLEVBQUEsR0FBQSxDQUFBO0VBQ0E7QUFDQTs7QUM3WUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx5QkFBQSxDQUFBLEVBQUE7RUFDQSxJQUFBLFVBQUEsS0FBQSxPQUFBLFVBQUEsRUFBQTtJQUNBLE9BQUEsQ0FBQSxHQUFBLENBQUEseUNBQUEsQ0FBQTtJQUNBLE9BQUEsS0FBQTtFQUNBO0VBQ0EsVUFBQSxDQUFBLCtCQUFBLEVBQUE7SUFDQSxPQUFBLFdBQUEsUUFBQSxTQUFBLEVBQUE7TUFDQSxJQUFBLGFBQUEsR0FBQSxTQUFBLENBQUEsWUFBQSxDQUFBLHFCQUFBLENBQUE7TUFDQSxJQUFBLGVBQUEsR0FBQSxTQUFBLENBQUEsWUFBQSxDQUFBLGNBQUEsQ0FBQTtNQUNBLE9BQUEscUNBQUEsR0FDQSwyTEFBQSxHQUNBLGVBQUEsR0FDQSxRQUFBO0lBQ0EsQ0FBQTtJQUNBLFNBQUEsRUFBQSxJQUFBO0lBQ0EsT0FBQSxFQUFBLFFBQUE7SUFDQSxXQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQSxLQUFBO0lBQ0EsaUJBQUEsRUFBQSxFQUFBO0lBQ0EsUUFBQSxFQUFBLEdBQUE7SUFDQSxLQUFBLEVBQUEsb0JBQUE7SUFDQSxTQUFBLEVBQUEsY0FBQTtJQUNBLEtBQUEsRUFBQSxDQUFBLE1BQUEsRUFBQSxHQUFBO0VBQ0EsQ0FBQSxDQUFBO0VBQ0EsTUFBQSxDQUFBLCtCQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsT0FBQSxFQUFBLFlBQUE7SUFDQSxJQUFBLElBQUEsQ0FBQSxNQUFBLENBQUEsS0FBQSxDQUFBLFNBQUEsRUFBQTtNQUNBLElBQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7SUFDQSxDQUFBLE1BQUE7TUFDQSxJQUFBLENBQUEsTUFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBO0lBQ0E7RUFDQSxDQUFBLENBQUE7RUFDQSxnQ0FBQSxDQUFBLENBQUE7QUFDQTtBQUlBLFNBQUEsZ0NBQUEsQ0FBQSxFQUFBO0VBQ0EsTUFBQSxDQUFBLDJEQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsUUFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBO0lBQ0EsSUFBQSxVQUFBLEtBQUEsT0FBQSxVQUFBLEVBQUE7TUFDQSxVQUFBLENBQUEsT0FBQSxDQUFBLENBQUE7SUFDQTtFQUNBLENBQUEsQ0FBQTtBQUNBIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKiBKYXZhU2NyaXB0IFV0aWwgRnVuY3Rpb25zXHRcdC4uL2luY2x1ZGVzL19fanMvdXRpbHMvd3BiY191dGlscy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogVHJpbSAgc3RyaW5ncyBhbmQgYXJyYXkgam9pbmVkIHdpdGggICgsKVxyXG4gKlxyXG4gKiBAcGFyYW0gc3RyaW5nX3RvX3RyaW0gICBzdHJpbmcgLyBhcnJheVxyXG4gKiBAcmV0dXJucyBzdHJpbmdcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfdHJpbSggc3RyaW5nX3RvX3RyaW0gKXtcclxuXHJcbiAgICBpZiAoIEFycmF5LmlzQXJyYXkoIHN0cmluZ190b190cmltICkgKXtcclxuICAgICAgICBzdHJpbmdfdG9fdHJpbSA9IHN0cmluZ190b190cmltLmpvaW4oICcsJyApO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICggJ3N0cmluZycgPT0gdHlwZW9mIChzdHJpbmdfdG9fdHJpbSkgKXtcclxuICAgICAgICBzdHJpbmdfdG9fdHJpbSA9IHN0cmluZ190b190cmltLnRyaW0oKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gc3RyaW5nX3RvX3RyaW07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBpZiBlbGVtZW50IGluIGFycmF5XHJcbiAqXHJcbiAqIEBwYXJhbSBhcnJheV9oZXJlXHRcdGFycmF5XHJcbiAqIEBwYXJhbSBwX3ZhbFx0XHRcdFx0ZWxlbWVudCB0byAgY2hlY2tcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2luX2FycmF5KCBhcnJheV9oZXJlLCBwX3ZhbCApe1xyXG5cdGZvciAoIHZhciBpID0gMCwgbCA9IGFycmF5X2hlcmUubGVuZ3RoOyBpIDwgbDsgaSsrICl7XHJcblx0XHRpZiAoIGFycmF5X2hlcmVbIGkgXSA9PSBwX3ZhbCApe1xyXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdH1cclxuXHR9XHJcblx0cmV0dXJuIGZhbHNlO1xyXG59XHJcbiIsIlwidXNlIHN0cmljdFwiO1xyXG4vKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL3dwYmMvd3BiYy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogRGVlcCBDbG9uZSBvZiBvYmplY3Qgb3IgYXJyYXlcclxuICpcclxuICogQHBhcmFtIG9ialxyXG4gKiBAcmV0dXJucyB7YW55fVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jbG9uZV9vYmooIG9iaiApe1xyXG5cclxuXHRyZXR1cm4gSlNPTi5wYXJzZSggSlNPTi5zdHJpbmdpZnkoIG9iaiApICk7XHJcbn1cclxuXHJcblxyXG5cclxuLyoqXHJcbiAqIE1haW4gX3dwYmMgSlMgb2JqZWN0XHJcbiAqL1xyXG5cclxudmFyIF93cGJjID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cdG9iai5zZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfc2VjdXJlWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X3NlY3VyZV9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfc2VjdXJlWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gQ2FsZW5kYXJzIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2NhbGVuZGFycyA9IG9iai5jYWxlbmRhcnNfb2JqID0gb2JqLmNhbGVuZGFyc19vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0ICAgICAgICAgICAgOiBcImJvb2tpbmdfaWRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc29ydF90eXBlICAgICAgIDogXCJERVNDXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHBhZ2VfbnVtICAgICAgICA6IDEsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHBhZ2VfaXRlbXNfY291bnQ6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBjcmVhdGVfZGF0ZSAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBrZXl3b3JkICAgICAgICAgOiBcIlwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3VyY2UgICAgICAgICAgOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGNhbGVuZGFyIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdICkgKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ3JlYXRlIENhbGVuZGFyIGluaXRpYWxpemluZ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9faW5pdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2lkJyBdID0gcmVzb3VyY2VfaWQ7XHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAncGVuZGluZ19kYXlzX3NlbGVjdGFibGUnIF0gPSBmYWxzZTtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQ2hlY2sgIGlmIHRoZSB0eXBlIG9mIHRoaXMgcHJvcGVydHkgIGlzIElOVFxyXG5cdCAqIEBwYXJhbSBwcm9wZXJ0eV9uYW1lXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pc19wcm9wX2ludCA9IGZ1bmN0aW9uICggcHJvcGVydHlfbmFtZSApIHtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4yOS5cclxuXHJcblx0XHR2YXIgcF9jYWxlbmRhcl9pbnRfcHJvcGVydGllcyA9IFsnZHluYW1pY19fZGF5c19taW4nLCAnZHluYW1pY19fZGF5c19tYXgnLCAnZml4ZWRfX2RheXNfbnVtJ107XHJcblxyXG5cdFx0dmFyIGlzX2luY2x1ZGUgPSBwX2NhbGVuZGFyX2ludF9wcm9wZXJ0aWVzLmluY2x1ZGVzKCBwcm9wZXJ0eV9uYW1lICk7XHJcblxyXG5cdFx0cmV0dXJuIGlzX2luY2x1ZGU7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBwYXJhbXMgZm9yIGFsbCAgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJzX29ialx0XHRPYmplY3QgeyBjYWxlbmRhcl8xOiB7fSB9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGNhbGVuZGFyXzM6IHt9LCAuLi4gfVxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcnNfYWxsX19zZXQgPSBmdW5jdGlvbiAoIGNhbGVuZGFyc19vYmogKSB7XHJcblx0XHRwX2NhbGVuZGFycyA9IGNhbGVuZGFyc19vYmo7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGluIGFsbCBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyc19hbGxfX2dldCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2NhbGVuZGFycztcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgY2FsZW5kYXIgb2JqZWN0ICAgOjogICB7IGlkOiAxLCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRcdHsgaWQ6IDIgLOKApiB9XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19nZXRfcGFyYW1ldGVycyA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0aWYgKCBvYmouY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdHJldHVybiBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kIElEIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuICBzeXN0ZW0gc2V0ICBhcyBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgcHJvcGVydGllcyBmcm9tIGNhbGVuZGFyX3Byb3BlcnR5X29iaiBwYXJhbWV0ZXIsICBidXQgb3RoZXIgcHJvcGVydGllcyB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUsIGxpa2UgJ2lkJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJfcHJvcGVydHlfb2JqXHRcdFx0XHRcdCAgeyAgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfSAgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgJ3RydWUnIChkZWZhdWx0OiAnZmFsc2UnKSwgIHRoZW4gIG9ubHkgb3ZlcndyaXRlIG9yIGFkZCAgbmV3IHByb3BlcnRpZXMgaW4gIGNhbGVuZGFyX3Byb3BlcnR5X29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuY2FsZW5kYXJfX3NldCggIFwiIC5pbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsIHsgJ2RhdGVzJzogXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiIH0gKTtcIjtcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgY2FsZW5kYXJfcHJvcGVydHlfb2JqLCBpc19jb21wbGV0ZV9vdmVyd3JpdGUgPSBmYWxzZSAgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgfHwgKHRydWUgPT09IGlzX2NvbXBsZXRlX292ZXJ3cml0ZSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gY2FsZW5kYXJfcHJvcGVydHlfb2JqICl7XHJcblxyXG5cdFx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IGNhbGVuZGFyX3Byb3BlcnR5X29ialsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHByb3BlcnR5ICB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFwiMVwiXHJcblx0ICogQHBhcmFtIHByb3BfbmFtZVx0XHRuYW1lIG9mIHByb3BlcnR5XHJcblx0ICogQHBhcmFtIHByb3BfdmFsdWVcdHZhbHVlIG9mIHByb3BlcnR5XHJcblx0ICogQHJldHVybnMgeyp9XHRcdFx0Y2FsZW5kYXIgb2JqZWN0XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBwcm9wX25hbWUsIHByb3BfdmFsdWUgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gcHJvcF92YWx1ZTtcclxuXHJcblx0XHRyZXR1cm4gcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGNhbGVuZGFyIHByb3BlcnR5IHZhbHVlICAgXHQ6OiAgIG1peGVkIHwgbnVsbFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSAgcmVzb3VyY2VfaWRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHByb3BfbmFtZVx0XHRcdCdzZWxlY3Rpb25fbW9kZSdcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVx0XHRcdFx0XHRtaXhlZCB8IG51bGxcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0Ly8gRml4SW46IDkuOS4wLjI5LlxyXG5cdFx0XHRpZiAoIG9iai5jYWxlbmRhcl9faXNfcHJvcF9pbnQoIHByb3BfbmFtZSApICl7XHJcblx0XHRcdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwYXJzZUludCggcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIG51bGw7XHJcblx0fTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0Ly8gQm9va2luZ3MgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfYm9va2luZ3MgPSBvYmouYm9va2luZ3Nfb2JqID0gb2JqLmJvb2tpbmdzX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY2FsZW5kYXJfMTogT2JqZWN0IHtcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgICBpZDogICAgIDFcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKAplxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGJvb2tpbmdzIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5ncyBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgaWQ6IDEgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFx0eyBpZDogMiAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblxyXG5cdFx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBib29raW5ncyBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kIElEIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuICBzeXN0ZW0gc2V0ICBhcyBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgcHJvcGVydGllcyBmcm9tIGNhbGVuZGFyX29iaiBwYXJhbWV0ZXIsICBidXQgb3RoZXIgcHJvcGVydGllcyB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUsIGxpa2UgJ2lkJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJfb2JqXHRcdFx0XHRcdCAgeyAgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfSAgfVxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCggIFwiIC5pbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsIHsgJ2RhdGVzJzogXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiIH0gKTtcIjtcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgY2FsZW5kYXJfb2JqICl7XHJcblxyXG5cdFx0aWYgKCAhIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSB7fTtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdH1cclxuXHJcblx0XHRmb3IgKCB2YXIgcHJvcF9uYW1lIGluIGNhbGVuZGFyX29iaiApe1xyXG5cclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IGNhbGVuZGFyX29ialsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvLyBEYXRlc1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIEFMTCBEYXRlcyBpbiBjYWxlbmRhciAgIDo6ICAgZmFsc2UgfCB7IFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdGZhbHNlIHwgT2JqZWN0IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjRcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwiYXZhaWxhYmxlXCIsIGRheV9hdmFpbGFiaWxpdHk6IDEsIG1heF9jYXBhY2l0eTogMSwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjZcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwiZnVsbF9kYXlfYm9va2luZ1wiLCBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncyddOiBcInBlbmRpbmdcIiwgZGF5X2F2YWlsYWJpbGl0eTogMCwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMjlcIjogT2JqZWN0IHsgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5J106IFwicmVzb3VyY2VfYXZhaWxhYmlsaXR5XCIsIGRheV9hdmFpbGFiaWxpdHk6IDAsIG1heF9jYXBhY2l0eTogMSwg4oCmIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcIjIwMjMtMDctMzBcIjoge+KApn0sIFwiMjAyMy0wNy0zMVwiOiB74oCmfSwg4oCmXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9kYXRlcyA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gZmFsc2U7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGRhdGVzIGluIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIGlmIGNhbGVuZGFyIG9iamVjdCAgbm90IGRlZmluZWQsIHRoZW4gIGl0J3Mgd2lsbCBiZSBkZWZpbmVkIGFuZCAnaWQnLCAnZGF0ZXMnIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuIHN5c3RlbSBhZGQgYSAgbmV3IG9yIG92ZXJ3cml0ZSBvbmx5IGRhdGVzIGZyb20gZGF0ZXNfb2JqIHBhcmFtZXRlcixcclxuXHQgKiBidXQgb3RoZXIgZGF0ZXMgbm90IGZyb20gcGFyYW1ldGVyIGRhdGVzX29iaiB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUuXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBkYXRlc19vYmpcdFx0XHRcdFx0ICB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19jb21wbGV0ZV9vdmVyd3JpdGVcdFx0ICBpZiBmYWxzZSwgIHRoZW4gIG9ubHkgb3ZlcndyaXRlIG9yIGFkZCAgZGF0ZXMgZnJvbSBcdGRhdGVzX29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICogICBcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwg4oCmIH0gICk7XHRcdDwtICAgb3ZlcndyaXRlIEFMTCBkYXRlc1xyXG5cdCAqICAgXHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggcmVzb3VyY2VfaWQsIHsgXCIyMDIzLTA3LTIyXCI6IHvigKZ9IH0sICBmYWxzZSAgKTtcdFx0XHRcdFx0PC0gICBhZGQgb3Igb3ZlcndyaXRlIG9ubHkgIFx0XCIyMDIzLTA3LTIyXCI6IHt9XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIFwiIC4gaW50dmFsKCAkcmVzb3VyY2VfaWQgKSAuIFwiLCAgXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiICApOyAgXCI7XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGRhdGVzX29iaiAsIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IHRydWUgKXtcclxuXHJcblx0XHRpZiAoICFvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHRcdFx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXQoIHJlc291cmNlX2lkLCB7ICdkYXRlcyc6IHt9IH0gKTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdKSApe1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXSA9IHt9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKGlzX2NvbXBsZXRlX292ZXJ3cml0ZSl7XHJcblxyXG5cdFx0XHQvLyBDb21wbGV0ZSBvdmVyd3JpdGUgYWxsICBib29raW5nIGRhdGVzXHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdID0gZGF0ZXNfb2JqO1xyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdC8vIEFkZCBvbmx5ICBuZXcgb3Igb3ZlcndyaXRlIGV4aXN0IGJvb2tpbmcgZGF0ZXMgZnJvbSAgcGFyYW1ldGVyLiBCb29raW5nIGRhdGVzIG5vdCBmcm9tICBwYXJhbWV0ZXIgIHdpbGwgIGJlIHdpdGhvdXQgY2huYW5nZXNcclxuXHRcdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBkYXRlc19vYmogKXtcclxuXHJcblx0XHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWydkYXRlcyddWyBwcm9wX25hbWUgXSA9IGRhdGVzX29ialsgcHJvcF9uYW1lIF07XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIHNwZWNpZmljIGRhdGUgaW4gY2FsZW5kYXIgICA6OiAgIGZhbHNlIHwgeyBkYXlfYXZhaWxhYmlsaXR5OiAxLCAuLi4gfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzcWxfY2xhc3NfZGF5XHRcdFx0JzIwMjMtMDctMjEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0ZmFsc2UgfCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGRheV9hdmFpbGFiaWxpdHk6IDRcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWF4X2NhcGFjaXR5OiA0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gID49IEJ1c2luZXNzIExhcmdlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDI6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MTA6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cdFx0Ly8gID49IEJ1c2luZXNzIExhcmdlIC4uLlxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMTogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMjogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXVsgc3FsX2NsYXNzX2RheSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBmYWxzZTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gQW55ICBQQVJBTVMgICBpbiBib29raW5nc1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgcHJvcGVydHkgIHRvICBib29raW5nXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHRcIjFcIlxyXG5cdCAqIEBwYXJhbSBwcm9wX25hbWVcdFx0bmFtZSBvZiBwcm9wZXJ0eVxyXG5cdCAqIEBwYXJhbSBwcm9wX3ZhbHVlXHR2YWx1ZSBvZiBwcm9wZXJ0eVxyXG5cdCAqIEByZXR1cm5zIHsqfVx0XHRcdGJvb2tpbmcgb2JqZWN0XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSwgcHJvcF92YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoICEgb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdpZCcgXSA9IHJlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwcm9wX3ZhbHVlO1xyXG5cclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBib29raW5nIHByb3BlcnR5IHZhbHVlICAgXHQ6OiAgIG1peGVkIHwgbnVsbFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSAgcmVzb3VyY2VfaWRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHByb3BfbmFtZVx0XHRcdCdzZWxlY3Rpb25fbW9kZSdcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVx0XHRcdFx0XHRtaXhlZCB8IG51bGxcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBwcm9wX25hbWUgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiAgcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBudWxsO1xyXG5cdH07XHJcblxyXG5cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBib29raW5ncyBmb3IgYWxsICBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcnNfb2JqXHRcdE9iamVjdCB7IGNhbGVuZGFyXzE6IHsgaWQ6IDEsIGRhdGVzOiBPYmplY3QgeyBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwgXCIyMDIzLTA3LTI0XCI6IHvigKZ9LCDigKYgfSB9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGNhbGVuZGFyXzM6IHt9LCAuLi4gfVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcnNfX3NldF9hbGwgPSBmdW5jdGlvbiAoIGNhbGVuZGFyc19vYmogKSB7XHJcblx0XHRwX2Jvb2tpbmdzID0gY2FsZW5kYXJzX29iajtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYm9va2luZ3MgaW4gYWxsIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJzX19nZXRfYWxsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3M7XHJcblx0fTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblxyXG5cclxuXHQvLyBTZWFzb25zIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlYXNvbnMgPSBvYmouc2Vhc29uc19vYmogPSBvYmouc2Vhc29uc19vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNhbGVuZGFyXzE6IE9iamVjdCB7XHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICAgaWQ6ICAgICAxXHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBzZWFzb24gbmFtZXMgZm9yIGRhdGVzIGluIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgIHsgXCIyMDIzLTA3LTIxXCI6IFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdLCBcIjIwMjMtMDctMjJcIjogWy4uLl0sIC4uLiB9XHJcblx0ICpcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGRhdGVzX29ialx0XHRcdFx0XHQgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2NvbXBsZXRlX292ZXJ3cml0ZVx0XHQgIGlmIGZhbHNlLCAgdGhlbiAgb25seSAgYWRkICBkYXRlcyBmcm9tIFx0ZGF0ZXNfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKiAgIFx0XHRcdF93cGJjLnNlYXNvbnNfX3NldCggcmVzb3VyY2VfaWQsIHsgXCIyMDIzLTA3LTIxXCI6IFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdLCBcIjIwMjMtMDctMjJcIjogWy4uLl0sIC4uLiB9ICApO1xyXG5cdCAqL1xyXG5cdG9iai5zZWFzb25zX19zZXQgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGRhdGVzX29iaiAsIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IGZhbHNlICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSkgKXtcclxuXHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSB7fTtcclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSApe1xyXG5cclxuXHRcdFx0Ly8gQ29tcGxldGUgb3ZlcndyaXRlIGFsbCAgc2Vhc29uIGRhdGVzXHJcblx0XHRcdHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0gZGF0ZXNfb2JqO1xyXG5cclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHQvLyBBZGQgb25seSAgbmV3IG9yIG92ZXJ3cml0ZSBleGlzdCBib29raW5nIGRhdGVzIGZyb20gIHBhcmFtZXRlci4gQm9va2luZyBkYXRlcyBub3QgZnJvbSAgcGFyYW1ldGVyICB3aWxsICBiZSB3aXRob3V0IGNobmFuZ2VzXHJcblx0XHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gZGF0ZXNfb2JqICl7XHJcblxyXG5cdFx0XHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdKSApe1xyXG5cdFx0XHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gW107XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGZvciAoIHZhciBzZWFzb25fbmFtZV9rZXkgaW4gZGF0ZXNfb2JqWyBwcm9wX25hbWUgXSApe1xyXG5cdFx0XHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdLnB1c2goIGRhdGVzX29ialsgcHJvcF9uYW1lIF1bIHNlYXNvbl9uYW1lX2tleSBdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmdzIGRhdGEgZm9yIHNwZWNpZmljIGRhdGUgaW4gY2FsZW5kYXIgICA6OiAgIFtdIHwgWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheVx0XHRcdCcyMDIzLTA3LTIxJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFtdICB8ICBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXVxyXG5cdCAqL1xyXG5cdG9iai5zZWFzb25zX19nZXRfZm9yX2RhdGUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgc3FsX2NsYXNzX2RheSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgc3FsX2NsYXNzX2RheSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBbXTtcdFx0Ly8gSWYgbm90IGRlZmluZWQsIHRoZW4gW107XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIE90aGVyIHBhcmFtZXRlcnMgXHRcdFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfb3RoZXIgPSBvYmoub3RoZXJfb2JqID0gb2JqLm90aGVyX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9vdGhlclsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXJbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgb3RoZXIgcGFyYW1zXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5nZXRfb3RoZXJfcGFyYW1fX2FsbCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX290aGVyO1xyXG5cdH07XHJcblxyXG5cdC8vIE1lc3NhZ2VzIFx0XHRcdCAgICAgICAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfbWVzc2FnZXMgPSBvYmoubWVzc2FnZXNfb2JqID0gb2JqLm1lc3NhZ2VzX29iaiB8fCB7IH07XHJcblxyXG5cdG9iai5zZXRfbWVzc2FnZSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX21lc3NhZ2VzWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X21lc3NhZ2UgPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX21lc3NhZ2VzWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYWxsIG90aGVyIHBhcmFtc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouZ2V0X21lc3NhZ2VzX19hbGwgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9tZXNzYWdlcztcclxuXHR9O1xyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cclxufSggX3dwYmMgfHwge30sIGpRdWVyeSApKTtcclxuIiwiLyoqXHJcbiAqIEV4dGVuZCBfd3BiYyB3aXRoICBuZXcgbWV0aG9kcyAgICAgICAgLy8gRml4SW46IDkuOC42LjIuXHJcbiAqXHJcbiAqIEB0eXBlIHsqfHt9fVxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuIF93cGJjID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIExvYWQgQmFsYW5jZXIgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHR2YXIgcF9iYWxhbmNlciA9IG9iai5iYWxhbmNlcl9vYmogPSBvYmouYmFsYW5jZXJfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbWF4X3RocmVhZHMnOiAyLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpbl9wcm9jZXNzJyA6IFtdLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3YWl0JyAgICAgICA6IFtdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdCAvKipcclxuXHQgICogU2V0ICBtYXggcGFyYWxsZWwgcmVxdWVzdCAgdG8gIGxvYWRcclxuXHQgICpcclxuXHQgICogQHBhcmFtIG1heF90aHJlYWRzXHJcblx0ICAqL1xyXG5cdG9iai5iYWxhbmNlcl9fc2V0X21heF90aHJlYWRzID0gZnVuY3Rpb24gKCBtYXhfdGhyZWFkcyApe1xyXG5cclxuXHRcdHBfYmFsYW5jZXJbICdtYXhfdGhyZWFkcycgXSA9IG1heF90aHJlYWRzO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBDaGVjayBpZiBiYWxhbmNlciBmb3Igc3BlY2lmaWMgYm9va2luZyByZXNvdXJjZSBkZWZpbmVkICAgOjogICB0cnVlIHwgZmFsc2VcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRvYmouYmFsYW5jZXJfX2lzX2RlZmluZWQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xyXG5cclxuXHRcdHJldHVybiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggcF9iYWxhbmNlclsgJ2JhbGFuY2VyXycgKyByZXNvdXJjZV9pZCBdICkgKTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogIENyZWF0ZSBiYWxhbmNlciBpbml0aWFsaXppbmdcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRvYmouYmFsYW5jZXJfX2luaXQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICwgcGFyYW1zID17fSkge1xyXG5cclxuXHRcdHZhciBiYWxhbmNlX29iaiA9IHt9O1xyXG5cdFx0YmFsYW5jZV9vYmpbICdyZXNvdXJjZV9pZCcgXSAgID0gcmVzb3VyY2VfaWQ7XHJcblx0XHRiYWxhbmNlX29ialsgJ3ByaW9yaXR5JyBdICAgICAgPSAxO1xyXG5cdFx0YmFsYW5jZV9vYmpbICdmdW5jdGlvbl9uYW1lJyBdID0gZnVuY3Rpb25fbmFtZTtcclxuXHRcdGJhbGFuY2Vfb2JqWyAncGFyYW1zJyBdICAgICAgICA9IHdwYmNfY2xvbmVfb2JqKCBwYXJhbXMgKTtcclxuXHJcblxyXG5cdFx0aWYgKCBvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfcnVuKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApICl7XHJcblx0XHRcdHJldHVybiAncnVuJztcclxuXHRcdH1cclxuXHRcdGlmICggb2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3dhaXQoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICkgKXtcclxuXHRcdFx0cmV0dXJuICd3YWl0JztcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0aWYgKCBvYmouYmFsYW5jZXJfX2Nhbl9pX3J1bigpICl7XHJcblx0XHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX19ydW4oIGJhbGFuY2Vfb2JqICk7XHJcblx0XHRcdHJldHVybiAncnVuJztcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX193YWl0KCBiYWxhbmNlX29iaiApO1xyXG5cdFx0XHRyZXR1cm4gJ3dhaXQnO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdCAvKipcclxuXHQgICogQ2FuIEkgUnVuID9cclxuXHQgICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICAqL1xyXG5cdG9iai5iYWxhbmNlcl9fY2FuX2lfcnVuID0gZnVuY3Rpb24gKCl7XHJcblx0XHRyZXR1cm4gKCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5sZW5ndGggPCBwX2JhbGFuY2VyWyAnbWF4X3RocmVhZHMnIF0gKTtcclxuXHR9XHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIEFkZCB0byBXQUlUXHJcblx0XHQgICogQHBhcmFtIGJhbGFuY2Vfb2JqXHJcblx0XHQgICovXHJcblx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fd2FpdCA9IGZ1bmN0aW9uICggYmFsYW5jZV9vYmogKSB7XHJcblx0XHRcdHBfYmFsYW5jZXJbJ3dhaXQnXS5wdXNoKCBiYWxhbmNlX29iaiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdCAvKipcclxuXHRcdCAgKiBSZW1vdmUgZnJvbSBXYWl0XHJcblx0XHQgICpcclxuXHRcdCAgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAgKiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0ICAqIEByZXR1cm5zIHsqfGJvb2xlYW59XHJcblx0XHQgICovXHJcblx0XHRvYmouYmFsYW5jZXJfX3JlbW92ZV9mcm9tX193YWl0X2xpc3QgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHR2YXIgcmVtb3ZlZF9lbCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0aWYgKCBwX2JhbGFuY2VyWyAnd2FpdCcgXS5sZW5ndGggKXtcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICd3YWl0JyBdICl7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRyZW1vdmVkX2VsID0gcF9iYWxhbmNlclsgJ3dhaXQnIF0uc3BsaWNlKCBpLCAxICk7XHJcblx0XHRcdFx0XHRcdHJlbW92ZWRfZWwgPSByZW1vdmVkX2VsLnBvcCgpO1xyXG5cdFx0XHRcdFx0XHRwX2JhbGFuY2VyWyAnd2FpdCcgXSA9IHBfYmFsYW5jZXJbICd3YWl0JyBdLmZpbHRlciggZnVuY3Rpb24gKCB2ICl7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHY7XHJcblx0XHRcdFx0XHRcdH0gKTtcdFx0XHRcdFx0Ly8gUmVpbmRleCBhcnJheVxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQqIElzIGFscmVhZHkgV0FJVFxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3dhaXQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICd3YWl0JyBdICl7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQgLyoqXHJcblx0XHQgICogQWRkIHRvIFJVTlxyXG5cdFx0ICAqIEBwYXJhbSBiYWxhbmNlX29ialxyXG5cdFx0ICAqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biA9IGZ1bmN0aW9uICggYmFsYW5jZV9vYmogKSB7XHJcblx0XHRcdHBfYmFsYW5jZXJbJ2luX3Byb2Nlc3MnXS5wdXNoKCBiYWxhbmNlX29iaiApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0KiBSZW1vdmUgZnJvbSBSVU4gbGlzdFxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMgeyp8Ym9vbGVhbn1cclxuXHRcdCovXHJcblx0XHRvYmouYmFsYW5jZXJfX3JlbW92ZV9mcm9tX19ydW5fbGlzdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdCB2YXIgcmVtb3ZlZF9lbCA9IGZhbHNlO1xyXG5cclxuXHRcdFx0IGlmICggcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0ubGVuZ3RoICl7XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0IGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdICl7XHJcblx0XHRcdFx0XHQgaWYgKFxyXG5cdFx0XHRcdFx0XHQgKHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCAmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQgKXtcclxuXHRcdFx0XHRcdFx0IHJlbW92ZWRfZWwgPSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5zcGxpY2UoIGksIDEgKTtcclxuXHRcdFx0XHRcdFx0IHJlbW92ZWRfZWwgPSByZW1vdmVkX2VsLnBvcCgpO1xyXG5cdFx0XHRcdFx0XHQgcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gPSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5maWx0ZXIoIGZ1bmN0aW9uICggdiApe1xyXG5cdFx0XHRcdFx0XHRcdCByZXR1cm4gdjtcclxuXHRcdFx0XHRcdFx0IH0gKTtcdFx0Ly8gUmVpbmRleCBhcnJheVxyXG5cdFx0XHRcdFx0XHQgcmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHRcdFx0XHQgfVxyXG5cdFx0XHRcdCB9XHJcblx0XHRcdCB9XHJcblx0XHRcdCByZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCogSXMgYWxyZWFkeSBSVU5cclxuXHRcdCpcclxuXHRcdCogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdFx0Ki9cclxuXHRcdG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV9ydW4gPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCApe1x0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gKXtcclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0KHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0b2JqLmJhbGFuY2VyX19ydW5fbmV4dCA9IGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdC8vIEdldCAxc3QgZnJvbSAgV2FpdCBsaXN0XHJcblx0XHR2YXIgcmVtb3ZlZF9lbCA9IGZhbHNlO1xyXG5cdFx0aWYgKCBwX2JhbGFuY2VyWyAnd2FpdCcgXS5sZW5ndGggKXtcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnd2FpdCcgXSApe1xyXG5cdFx0XHRcdHJlbW92ZWRfZWwgPSBvYmouYmFsYW5jZXJfX3JlbW92ZV9mcm9tX193YWl0X2xpc3QoIHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSwgcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0gKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggZmFsc2UgIT09IHJlbW92ZWRfZWwgKXtcclxuXHJcblx0XHRcdC8vIFJ1blxyXG5cdFx0XHRvYmouYmFsYW5jZXJfX3J1biggcmVtb3ZlZF9lbCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0IC8qKlxyXG5cdCAgKiBSdW5cclxuXHQgICogQHBhcmFtIGJhbGFuY2Vfb2JqXHJcblx0ICAqL1xyXG5cdG9iai5iYWxhbmNlcl9fcnVuID0gZnVuY3Rpb24gKCBiYWxhbmNlX29iaiApe1xyXG5cclxuXHRcdHN3aXRjaCAoIGJhbGFuY2Vfb2JqWyAnZnVuY3Rpb25fbmFtZScgXSApe1xyXG5cclxuXHRcdFx0Y2FzZSAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnOlxyXG5cclxuXHRcdFx0XHQvLyBBZGQgdG8gcnVuIGxpc3RcclxuXHRcdFx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fcnVuKCBiYWxhbmNlX29iaiApO1xyXG5cclxuXHRcdFx0XHR3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCggYmFsYW5jZV9vYmpbICdwYXJhbXMnIF0gKVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiBvYmo7XHJcblxyXG59KCBfd3BiYyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG5cclxuXHJcbiBcdC8qKlxyXG4gXHQgKiAtLSBIZWxwIGZ1bmN0aW9ucyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ICovXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmFsYW5jZXJfX2lzX3dhaXQoIHBhcmFtcywgZnVuY3Rpb25fbmFtZSApe1xyXG4vL2NvbnNvbGUubG9nKCc6OndwYmNfYmFsYW5jZXJfX2lzX3dhaXQnLHBhcmFtcyAsIGZ1bmN0aW9uX25hbWUgKTtcclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocGFyYW1zWyAncmVzb3VyY2VfaWQnIF0pICl7XHJcblxyXG5cdFx0XHR2YXIgYmFsYW5jZXJfc3RhdHVzID0gX3dwYmMuYmFsYW5jZXJfX2luaXQoIHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdLCBmdW5jdGlvbl9uYW1lLCBwYXJhbXMgKTtcclxuXHJcblx0XHRcdHJldHVybiAoICd3YWl0JyA9PT0gYmFsYW5jZXJfc3RhdHVzICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCggcmVzb3VyY2VfaWQgLCBmdW5jdGlvbl9uYW1lICl7XHJcbi8vY29uc29sZS5sb2coJzo6d3BiY19iYWxhbmNlcl9fY29tcGxldGVkJyxyZXNvdXJjZV9pZCAsIGZ1bmN0aW9uX25hbWUgKTtcclxuXHRcdF93cGJjLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fcnVuX2xpc3QoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRfd3BiYy5iYWxhbmNlcl9fcnVuX25leHQoKTtcclxuXHR9IiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9jYWwvd3BiY19jYWwuanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIE9yZGVyIG9yIGNoaWxkIGJvb2tpbmcgcmVzb3VyY2VzIHNhdmVkIGhlcmU6ICBcdF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgKVx0XHRbMiwxMCwxMiwxMV1cclxuICovXHJcblxyXG4vKipcclxuICogSG93IHRvIGNoZWNrICBib29rZWQgdGltZXMgb24gIHNwZWNpZmljIGRhdGU6ID9cclxuICpcclxuXHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJyk7XHJcblxyXG5cdFx0XHRjb25zb2xlLmxvZyhcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHMsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEwXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcyxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTFdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHNcclxuXHRcdFx0XHRcdCk7XHJcbiAqICBPUlxyXG5cdFx0XHRjb25zb2xlLmxvZyhcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMV0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3JlYWRhYmxlXHJcblx0XHRcdFx0XHQpO1xyXG4gKlxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBEYXlzIHNlbGVjdGlvbjpcclxuICogXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKTtcclxuICpcclxuICpcdFx0XHRcdFx0dmFyIHJlc291cmNlX2lkID0gMTtcclxuICogXHRFeGFtcGxlIDE6XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLCAnMjAyNC0wNS0xNScsICcyMDI0LTA1LTI1JyApO1xyXG4gKiBcdEV4YW1wbGUgMjpcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsIFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTI1J10gKTtcclxuICpcclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqIEMgQSBMIEUgTiBEIEEgUiAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAqL1xyXG5cclxuXHJcbi8qKlxyXG4gKiAgU2hvdyBXUEJDIENhbGVuZGFyXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRcdC0gcmVzb3VyY2UgSURcclxuICogQHJldHVybnMge2Jvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX3Nob3coIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIElmIG5vIGNhbGVuZGFyIEhUTUwgdGFnLCAgdGhlbiAgZXhpdFxyXG5cdGlmICggMCA9PT0galF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggKXsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cdC8vIElmIHRoZSBjYWxlbmRhciB3aXRoIHRoZSBzYW1lIEJvb2tpbmcgcmVzb3VyY2UgaXMgYWN0aXZhdGVkIGFscmVhZHksIHRoZW4gZXhpdC5cclxuXHRpZiAoIHRydWUgPT09IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICdoYXNEYXRlcGljaycgKSApeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBEYXlzIHNlbGVjdGlvblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGxvY2FsX19pc19yYW5nZV9zZWxlY3QgPSBmYWxzZTtcclxuXHR2YXIgbG9jYWxfX211bHRpX2RheXNfc2VsZWN0X251bSAgID0gMzY1O1x0XHRcdFx0XHQvLyBtdWx0aXBsZSB8IGZpeGVkXHJcblx0aWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cdFx0bG9jYWxfX2lzX3JhbmdlX3NlbGVjdCA9IHRydWU7XHJcblx0XHRsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtID0gMDtcclxuXHR9XHJcblx0aWYgKCAnc2luZ2xlJyAgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cdFx0bG9jYWxfX211bHRpX2RheXNfc2VsZWN0X251bSA9IDA7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIE1pbiAtIE1heCBkYXlzIHRvIHNjcm9sbC9zaG93XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgbG9jYWxfX21pbl9kYXRlID0gMDtcclxuIFx0bG9jYWxfX21pbl9kYXRlID0gbmV3IERhdGUoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMCBdLCAocGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMSBdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAyIF0sIDAsIDAsIDAgKTtcdFx0XHQvLyBGaXhJbjogOS45LjAuMTcuXHJcbi8vY29uc29sZS5sb2coIGxvY2FsX19taW5fZGF0ZSApO1xyXG5cdHZhciBsb2NhbF9fbWF4X2RhdGUgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2Jvb2tpbmdfbWF4X21vbnRoZXNfaW5fY2FsZW5kYXInICk7XHJcblx0Ly9sb2NhbF9fbWF4X2RhdGUgPSBuZXcgRGF0ZSgyMDI0LCA1LCAyOCk7ICBJdCBpcyBoZXJlIGlzc3VlIG9mIG5vdCBzZWxlY3RhYmxlIGRhdGVzLCBidXQgc29tZSBkYXRlcyBzaG93aW5nIGluIGNhbGVuZGFyIGFzIGF2YWlsYWJsZSwgYnV0IHdlIGNhbiBub3Qgc2VsZWN0IGl0LlxyXG5cclxuXHQvLy8vIERlZmluZSBsYXN0IGRheSBpbiBjYWxlbmRhciAoYXMgYSBsYXN0IGRheSBvZiBtb250aCAoYW5kIG5vdCBkYXRlLCB3aGljaCBpcyByZWxhdGVkIHRvIGFjdHVhbCAnVG9kYXknIGRhdGUpLlxyXG5cdC8vLy8gRS5nLiBpZiB0b2RheSBpcyAyMDIzLTA5LTI1LCBhbmQgd2Ugc2V0ICdOdW1iZXIgb2YgbW9udGhzIHRvIHNjcm9sbCcgYXMgNSBtb250aHMsIHRoZW4gbGFzdCBkYXkgd2lsbCBiZSAyMDI0LTAyLTI5IGFuZCBub3QgdGhlIDIwMjQtMDItMjUuXHJcblx0Ly8gdmFyIGNhbF9sYXN0X2RheV9pbl9tb250aCA9IGpRdWVyeS5kYXRlcGljay5fZGV0ZXJtaW5lRGF0ZSggbnVsbCwgbG9jYWxfX21heF9kYXRlLCBuZXcgRGF0ZSgpICk7XHJcblx0Ly8gY2FsX2xhc3RfZGF5X2luX21vbnRoID0gbmV3IERhdGUoIGNhbF9sYXN0X2RheV9pbl9tb250aC5nZXRGdWxsWWVhcigpLCBjYWxfbGFzdF9kYXlfaW5fbW9udGguZ2V0TW9udGgoKSArIDEsIDAgKTtcclxuXHQvLyBsb2NhbF9fbWF4X2RhdGUgPSBjYWxfbGFzdF9kYXlfaW5fbW9udGg7XHRcdFx0Ly8gRml4SW46IDEwLjAuMC4yNi5cclxuXHJcblx0aWYgKCAgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCdwYWdlPXdwYmMtbmV3JykgIT0gLTEgKVxyXG5cdFx0JiYgKFxyXG5cdFx0XHQgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCdib29raW5nX2hhc2gnKSAhPSAtMSApICAgICAgICAgICAgICAgICAgLy8gQ29tbWVudCB0aGlzIGxpbmUgZm9yIGFiaWxpdHkgdG8gYWRkICBib29raW5nIGluIHBhc3QgZGF5cyBhdCAgQm9va2luZyA+IEFkZCBib29raW5nIHBhZ2UuXHJcblx0XHQgICB8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZignYWxsb3dfcGFzdCcpICE9IC0xICkgICAgICAgICAgICAgICAgLy8gRml4SW46IDEwLjcuMS4yLlxyXG5cdFx0KVxyXG5cdCl7XHJcblx0XHRsb2NhbF9fbWluX2RhdGUgPSBudWxsO1xyXG5cdFx0bG9jYWxfX21heF9kYXRlID0gbnVsbDtcclxuXHR9XHJcblxyXG5cdHZhciBsb2NhbF9fc3RhcnRfd2Vla2RheSAgICA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19zdGFydF9kYXlfd2VlZWsnICk7XHJcblx0dmFyIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID0gcGFyc2VJbnQoIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycgKSApO1xyXG5cclxuXHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnRleHQoICcnICk7XHRcdFx0XHRcdC8vIFJlbW92ZSBhbGwgSFRNTCBpbiBjYWxlbmRhciB0YWdcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNob3cgY2FsZW5kYXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSgnI2NhbGVuZGFyX2Jvb2tpbmcnKyByZXNvdXJjZV9pZCkuZGF0ZXBpY2soXHJcblx0XHRcdHtcclxuXHRcdFx0XHRiZWZvcmVTaG93RGF5OiBmdW5jdGlvbiAoIGpzX2RhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cygganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvblNlbGVjdDogZnVuY3Rpb24gKCBzdHJpbmdfZGF0ZXMsIGpzX2RhdGVzX2FyciApeyAgLyoqXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKlx0c3RyaW5nX2RhdGVzICAgPSAgICcyMy4wOC4yMDIzIC0gMjYuMDguMjAyMycgICAgfCAgICAnMjMuMDguMjAyMyAtIDIzLjA4LjIwMjMnICAgIHwgICAgJzE5LjA5LjIwMjMsIDI0LjA4LjIwMjMsIDMwLjA5LjIwMjMnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKiAganNfZGF0ZXNfYXJyICAgPSAgIHJhbmdlOiBbIERhdGUgKEF1ZyAyMyAyMDIzKSwgRGF0ZSAoQXVnIDI1IDIwMjMpXSAgICAgfCAgICAgbXVsdGlwbGU6IFsgRGF0ZShPY3QgMjQgMjAyMyksIERhdGUoT2N0IDIwIDIwMjMpLCBEYXRlKE9jdCAxNiAyMDIzKSBdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9zZWxlY3RfZGF5cyggc3RyaW5nX2RhdGVzLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uSG92ZXI6IGZ1bmN0aW9uICggc3RyaW5nX2RhdGUsIGpzX2RhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9ob3Zlcl9kYXlzKCBzdHJpbmdfZGF0ZSwganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvbkNoYW5nZU1vbnRoWWVhcjogZnVuY3Rpb24gKCB5ZWFyLCByZWFsX21vbnRoLCBqc19kYXRlX18xc3RfZGF5X2luX21vbnRoICl7IH0sXHJcblx0XHRcdFx0c2hvd09uICAgICAgICA6ICdib3RoJyxcclxuXHRcdFx0XHRudW1iZXJPZk1vbnRoczogbG9jYWxfX251bWJlcl9vZl9tb250aHMsXHJcblx0XHRcdFx0c3RlcE1vbnRocyAgICA6IDEsXHJcblx0XHRcdFx0Ly8gcHJldlRleHQgICAgICA6ICcmbGFxdW87JyxcclxuXHRcdFx0XHQvLyBuZXh0VGV4dCAgICAgIDogJyZyYXF1bzsnLFxyXG5cdFx0XHRcdHByZXZUZXh0ICAgICAgOiAnJmxzYXF1bzsnLFxyXG5cdFx0XHRcdG5leHRUZXh0ICAgICAgOiAnJnJzYXF1bzsnLFxyXG5cdFx0XHRcdGRhdGVGb3JtYXQgICAgOiAnZGQubW0ueXknLFxyXG5cdFx0XHRcdGNoYW5nZU1vbnRoICAgOiBmYWxzZSxcclxuXHRcdFx0XHRjaGFuZ2VZZWFyICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bWluRGF0ZSAgICAgICA6IGxvY2FsX19taW5fZGF0ZSxcclxuXHRcdFx0XHRtYXhEYXRlICAgICAgIDogbG9jYWxfX21heF9kYXRlLCBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzFZJyxcclxuXHRcdFx0XHQvLyBtaW5EYXRlOiBuZXcgRGF0ZSgyMDIwLCAyLCAxKSwgbWF4RGF0ZTogbmV3IERhdGUoMjAyMCwgOSwgMzEpLCAgICAgICAgICAgICBcdC8vIEFiaWxpdHkgdG8gc2V0IGFueSAgc3RhcnQgYW5kIGVuZCBkYXRlIGluIGNhbGVuZGFyXHJcblx0XHRcdFx0c2hvd1N0YXR1cyAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bXVsdGlTZXBhcmF0b3IgIDogJywgJyxcclxuXHRcdFx0XHRjbG9zZUF0VG9wICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRmaXJzdERheSAgICAgICAgOiBsb2NhbF9fc3RhcnRfd2Vla2RheSxcclxuXHRcdFx0XHRnb3RvQ3VycmVudCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRoaWRlSWZOb1ByZXZOZXh0OiB0cnVlLFxyXG5cdFx0XHRcdG11bHRpU2VsZWN0ICAgICA6IGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0sXHJcblx0XHRcdFx0cmFuZ2VTZWxlY3QgICAgIDogbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCxcclxuXHRcdFx0XHQvLyBzaG93V2Vla3M6IHRydWUsXHJcblx0XHRcdFx0dXNlVGhlbWVSb2xsZXI6IGZhbHNlXHJcblx0XHRcdH1cclxuXHQpO1xyXG5cclxuXHJcblx0XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBDbGVhciB0b2RheSBkYXRlIGhpZ2hsaWdodGluZ1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0c2V0VGltZW91dCggZnVuY3Rpb24gKCl7ICB3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICk7ICB9LCA1MDAgKTsgICAgICAgICAgICAgICAgICAgIFx0Ly8gRml4SW46IDcuMS4yLjguXHJcblx0XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBTY3JvbGwgY2FsZW5kYXIgdG8gIHNwZWNpZmljIG1vbnRoXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgc3RhcnRfYmtfbW9udGggPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX3Njcm9sbF90bycgKTtcclxuXHRpZiAoIGZhbHNlICE9PSBzdGFydF9ia19tb250aCApe1xyXG5cdFx0d3BiY19jYWxlbmRhcl9fc2Nyb2xsX3RvKCByZXNvdXJjZV9pZCwgc3RhcnRfYmtfbW9udGhbIDAgXSwgc3RhcnRfYmtfbW9udGhbIDEgXSApO1xyXG5cdH1cclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogQXBwbHkgQ1NTIHRvIGNhbGVuZGFyIGRhdGUgY2VsbHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdFx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMCBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHRcdFx0XHRcdFx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXHRcdFx0XHRcdFx0XCJyZXNvdXJjZV9pZFwiOiA0XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHRcdFx0XHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqIEByZXR1cm5zIHsoKnxzdHJpbmcpW118KGJvb2xlYW58c3RyaW5nKVtdfVx0XHQtIFsge3RydWUgLWF2YWlsYWJsZSB8IGZhbHNlIC0gdW5hdmFpbGFibGV9LCAnQ1NTIGNsYXNzZXMgZm9yIGNhbGVuZGFyIGRheSBjZWxsJyBdXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0dmFyIHRvZGF5X2RhdGUgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAwIF0sIChwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDIgXSwgMCwgMCwgMCApO1x0XHRcdFx0XHRcdFx0XHQvLyBUb2RheSBKU19EYXRlX09iai5cclxuXHRcdHZhciBjbGFzc19kYXkgICAgID0gd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzEtOS0yMDIzJ1xyXG5cdFx0dmFyIHNxbF9jbGFzc19kYXkgPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzIwMjMtMDEtMDknXHJcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSApID8gY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdIDogJzEnOyBcdFx0Ly8gJzEnXHJcblxyXG5cdFx0Ly8gR2V0IFNlbGVjdGVkIGRhdGVzIGluIGNhbGVuZGFyXHJcblx0XHR2YXIgc2VsZWN0ZWRfZGF0ZXNfc3FsID0gd3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIEdldCBEYXRhIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgZGF0ZV9ib29raW5nc19vYmogPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApO1xyXG5cclxuXHJcblx0XHQvLyBBcnJheSB3aXRoIENTUyBjbGFzc2VzIGZvciBkYXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGNzc19jbGFzc2VzX19mb3JfZGF0ZSA9IFtdO1xyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzcWxfZGF0ZV8nICAgICArIHNxbF9jbGFzc19kYXkgKTtcdFx0XHRcdC8vICAnc3FsX2RhdGVfMjAyMy0wNy0yMSdcclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2FsNGRhdGUtJyAgICAgKyBjbGFzc19kYXkgKTtcdFx0XHRcdFx0Ly8gICdjYWw0ZGF0ZS03LTIxLTIwMjMnXHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3dwYmNfd2Vla2RheV8nICsgZGF0ZS5nZXREYXkoKSApO1x0XHRcdFx0Ly8gICd3cGJjX3dlZWtkYXlfNCdcclxuXHJcblx0XHQvLyBEZWZpbmUgU2VsZWN0ZWQgQ2hlY2sgSW4vT3V0IGRhdGVzIGluIFREICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKFxyXG5cdFx0XHRcdCggc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCAgKVxyXG5cdFx0XHQvLyYmICAoIHNlbGVjdGVkX2RhdGVzX3NxbFsgMCBdICE9PSBzZWxlY3RlZF9kYXRlc19zcWxbIChzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoIC0gMSkgXSApXHJcblx0XHQpe1xyXG5cdFx0XHRpZiAoIHNxbF9jbGFzc19kYXkgPT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgMCBdICl7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19pbicgKTtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX2luX291dCcgKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRpZiAoICAoIHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggPiAxICkgJiYgKCBzcWxfY2xhc3NfZGF5ID09PSBzZWxlY3RlZF9kYXRlc19zcWxbIChzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoIC0gMSkgXSApICkge1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfb3V0JyApO1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfaW5fb3V0JyApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdHZhciBpc19kYXlfc2VsZWN0YWJsZSA9IGZhbHNlO1xyXG5cclxuXHRcdC8vIElmIHNvbWV0aGluZyBub3QgZGVmaW5lZCwgIHRoZW4gIHRoaXMgZGF0ZSBjbG9zZWQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoIGZhbHNlID09PSBkYXRlX2Jvb2tpbmdzX29iaiApe1xyXG5cclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gWyBpc19kYXlfc2VsZWN0YWJsZSwgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlLmpvaW4oJyAnKSAgXTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vICAgZGF0ZV9ib29raW5nc19vYmogIC0gRGVmaW5lZC4gICAgICAgICAgICBEYXRlcyBjYW4gYmUgc2VsZWN0YWJsZS5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEFkZCBzZWFzb24gbmFtZXMgdG8gdGhlIGRheSBDU1MgY2xhc3NlcyAtLSBpdCBpcyByZXF1aXJlZCBmb3IgY29ycmVjdCAgd29yayAgb2YgY29uZGl0aW9uYWwgZmllbGRzIC0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgc2Vhc29uX25hbWVzX2FyciA9IF93cGJjLnNlYXNvbnNfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgc2Vhc29uX2tleSBpbiBzZWFzb25fbmFtZXNfYXJyICl7XHJcblxyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggc2Vhc29uX25hbWVzX2Fyclsgc2Vhc29uX2tleSBdICk7XHRcdFx0XHQvLyAgJ3dwZGV2Ymtfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJ1xyXG5cdFx0fVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdFx0Ly8gQ29zdCBSYXRlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAncmF0ZV8nICsgZGF0ZV9ib29raW5nc19vYmpbIHJlc291cmNlX2lkIF1bICdkYXRlX2Nvc3RfcmF0ZScgXS50b1N0cmluZygpLnJlcGxhY2UoIC9bXFwuXFxzXS9nLCAnXycgKSApO1x0XHRcdFx0XHRcdC8vICAncmF0ZV85OV8wMCcgLT4gOTkuMDBcclxuXHJcblxyXG5cdFx0aWYgKCBwYXJzZUludCggZGF0ZV9ib29raW5nc19vYmpbICdkYXlfYXZhaWxhYmlsaXR5JyBdICkgPiAwICl7XHJcblx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gdHJ1ZTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX2F2YWlsYWJsZScgKTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdyZXNlcnZlZF9kYXlzX2NvdW50JyArIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ21heF9jYXBhY2l0eScgXSAtIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IGZhbHNlO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0c3dpdGNoICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHRjYXNlICdhdmFpbGFibGUnOlxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAndGltZV9zbG90c19ib29raW5nJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ3RpbWVzX2Nsb2NrJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnZnVsbF9kYXlfYm9va2luZyc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdmdWxsX2RheV9ib29raW5nJyApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnc2Vhc29uX2ZpbHRlcic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnc2Vhc29uX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdyZXNvdXJjZV9hdmFpbGFiaWxpdHknOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ3Jlc291cmNlX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICd3ZWVrZGF5X3VuYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICd3ZWVrZGF5X3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdmcm9tX3RvZGF5X3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdsaW1pdF9hdmFpbGFibGVfZnJvbV90b2RheSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2NoYW5nZV9vdmVyJzpcclxuXHRcdFx0XHQvKlxyXG5cdFx0XHRcdCAqXHJcblx0XHRcdFx0Ly8gIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZSBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlXHJcblx0XHRcdFx0Ly8gIGNoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZSBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdC8vICBjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZSBcdFx0IFx0Y2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkIFx0IFx0Y2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkXHJcblx0XHRcdFx0ICovXHJcblxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAndGltZXNwYXJ0bHknLCAnY2hlY2tfaW5fdGltZScsICdjaGVja19vdXRfdGltZScgKTtcclxuXHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjIuXHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdhcHByb3ZlZF9wZW5kaW5nJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcsICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdwZW5kaW5nX2FwcHJvdmVkJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJywgJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGVja19pbic6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd0aW1lc3BhcnRseScsICdjaGVja19pbl90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdwZW5kaW5nJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5ncycgXS5pbmRleE9mKCAnYXBwcm92ZWQnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnY2hlY2tfb3V0JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX291dF90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzMuXHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdwZW5kaW5nJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH0gZWxzZSBpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ2FwcHJvdmVkJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHRcdC8vIG1peGVkIHN0YXR1c2VzOiAnY2hhbmdlX292ZXIgY2hlY2tfb3V0JyAuLi4uIHZhcmlhdGlvbnMuLi4uIGNoZWNrIG1vcmUgaW4gXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2F2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIoKVxyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSA9ICdhdmFpbGFibGUnO1xyXG5cdFx0fVxyXG5cclxuXHJcblxyXG5cdFx0aWYgKCAnYXZhaWxhYmxlJyAhPSBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdHZhciBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGUgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlJyApO1x0Ly8gc2V0IHBlbmRpbmcgZGF5cyBzZWxlY3RhYmxlICAgICAgICAgIC8vIEZpeEluOiA4LjYuMS4xOC5cclxuXHJcblx0XHRcdHN3aXRjaCAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdICl7XHJcblxyXG5cdFx0XHRcdGNhc2UgJyc6XHJcblx0XHRcdFx0XHQvLyBVc3VhbGx5ICBpdCdzIG1lYW5zIHRoYXQgZGF5ICBpcyBhdmFpbGFibGUgb3IgdW5hdmFpbGFibGUgd2l0aG91dCB0aGUgYm9va2luZ3NcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nJzpcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZCc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Ly8gU2l0dWF0aW9ucyBmb3IgXCJjaGFuZ2Utb3ZlclwiIGRheXM6IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nX3BlbmRpbmcnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IChpc19kYXlfc2VsZWN0YWJsZSkgPyB0cnVlIDogaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmdfYXBwcm92ZWQnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZF9wZW5kaW5nJzpcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCcsICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAnYXBwcm92ZWRfYXBwcm92ZWQnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBbIGlzX2RheV9zZWxlY3RhYmxlLCBjc3NfY2xhc3Nlc19fZm9yX2RhdGUuam9pbiggJyAnICkgXTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBNb3VzZW92ZXIgY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHN0cmluZ19kYXRlXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMoIHN0cmluZ19kYXRlLCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICkge1xyXG5cclxuXHRcdGlmICggbnVsbCA9PT0gZGF0ZSApIHtcclxuXHRcdFx0d3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMScgKTtcdFx0Ly8gRml4SW46IDEwLjUuMi40LlxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7XHRcdC8vICcxJ1xyXG5cclxuXHRcdC8vIEdldCBEYXRhIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgZGF0ZV9ib29raW5nX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHsuLi59XHJcblxyXG5cdFx0aWYgKCAhIGRhdGVfYm9va2luZ19vYmogKXsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cclxuXHRcdC8vIFQgbyBvIGwgdCBpIHAgcyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgdG9vbHRpcF90ZXh0ID0gJyc7XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYXZhaWxhYmlsaXR5JyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2F2YWlsYWJpbGl0eScgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9kYXlfY29zdCcgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF90aW1lcycgXTtcclxuXHRcdH1cclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9ib29raW5nX2RldGFpbHMnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYm9va2luZ19kZXRhaWxzJyBdO1xyXG5cdFx0fVxyXG5cdFx0d3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHJcblx0XHQvLyAgVSBuIGggbyB2IGUgciBpIG4gZyAgICBpbiAgICBVTlNFTEVDVEFCTEVfQ0FMRU5EQVIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciA9ICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmdfdW5zZWxlY3RhYmxlJyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCk7XHRcdFx0XHQvLyBGaXhJbjogOC4wLjEuMi5cclxuXHRcdHZhciBpc19ib29raW5nX2Zvcm1fZXhpc3QgICAgPSAoIGpRdWVyeSggJyNib29raW5nX2Zvcm1fZGl2JyArIHJlc291cmNlX2lkICkubGVuZ3RoID4gMCApO1xyXG5cclxuXHRcdGlmICggKCBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgKSAmJiAoICEgaXNfYm9va2luZ19mb3JtX2V4aXN0ICkgKXtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiAgVW4gSG92ZXIgYWxsIGRhdGVzIGluIGNhbGVuZGFyICh3aXRob3V0IHRoZSBib29raW5nIGZvcm0pLCBpZiBvbmx5IEF2YWlsYWJpbGl0eSBDYWxlbmRhciBoZXJlIGFuZCB3ZSBkbyBub3QgaW5zZXJ0IEJvb2tpbmcgZm9ybSBieSBtaXN0YWtlLlxyXG5cdFx0XHQgKi9cclxuXHJcblx0XHRcdHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTsgXHRcdFx0XHRcdFx0XHQvLyBDbGVhciBkYXlzIGhpZ2hsaWdodGluZ1xyXG5cclxuXHRcdFx0dmFyIGNzc19vZl9jYWxlbmRhciA9ICcud3BiY19vbmx5X2NhbGVuZGFyICNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkO1xyXG5cdFx0XHRqUXVlcnkoIGNzc19vZl9jYWxlbmRhciArICcgLmRhdGVwaWNrLWRheXMtY2VsbCwgJ1xyXG5cdFx0XHRcdCAgKyBjc3Nfb2ZfY2FsZW5kYXIgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwgYScgKS5jc3MoICdjdXJzb3InLCAnZGVmYXVsdCcgKTtcdC8vIFNldCBjdXJzb3IgdG8gRGVmYXVsdFxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0XHQvLyAgRCBhIHkgcyAgICBIIG8gdiBlIHIgaSBuIGcgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYycgKSA9PSAtMSApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLW5ldycgKSA+IDAgKVxyXG5cdFx0XHR8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1zZXR1cCcgKSA+IDAgKVxyXG5cdFx0XHR8fCAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1hdmFpbGFiaWxpdHknICkgPiAwIClcclxuXHRcdFx0fHwgKCAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtc2V0dGluZ3MnICkgPiAwICkgICYmXHJcblx0XHRcdFx0ICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJyZ0YWI9Zm9ybScgKSA+IDAgKVxyXG5cdFx0XHQgICApXHJcblx0XHQpe1xyXG5cdFx0XHQvLyBUaGUgc2FtZSBhcyBkYXRlcyBzZWxlY3Rpb24sICBidXQgZm9yIGRheXMgaG92ZXJpbmdcclxuXHJcblx0XHRcdGlmICggJ2Z1bmN0aW9uJyA9PSB0eXBlb2YoIHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX2hpZ2hsaWdodF9fYnMgKSApe1xyXG5cdFx0XHRcdHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX2hpZ2hsaWdodF9fYnMoIHNxbF9jbGFzc19kYXksIGRhdGUsIHJlc291cmNlX2lkICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2VsZWN0IGNhbGVuZGFyIGRhdGUgY2VsbHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRcdFx0XHRcdFx0XHQtICBKYXZhU2NyaXB0IERhdGUgT2JqOiAgXHRcdE1vbiBEZWMgMTEgMjAyMyAwMDowMDowMCBHTVQrMDIwMCAoRWFzdGVybiBFdXJvcGVhbiBTdGFuZGFyZCBUaW1lKVxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9wYXJhbXNfYXJyXHRcdFx0XHRcdFx0LSAgQ2FsZW5kYXIgU2V0dGluZ3MgT2JqZWN0OiAgXHR7XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgXHRcdFx0XHRcdFx0XCJyZXNvdXJjZV9pZFwiOiA0XHJcblx0ICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICogQHBhcmFtIGRhdGVwaWNrX3RoaXNcdFx0XHRcdFx0XHRcdFx0LSB0aGlzIG9mIGRhdGVwaWNrIE9ialxyXG5cdCAqXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX29uX3NlbGVjdF9kYXlzKCBkYXRlLCBjYWxlbmRhcl9wYXJhbXNfYXJyLCBkYXRlcGlja190aGlzICl7XHJcblxyXG5cdFx0dmFyIHJlc291cmNlX2lkID0gKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSkgKSA/IGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSA6ICcxJztcdFx0Ly8gJzEnXHJcblxyXG5cdFx0Ly8gU2V0IHVuc2VsZWN0YWJsZSwgIGlmIG9ubHkgQXZhaWxhYmlsaXR5IENhbGVuZGFyICBoZXJlIChhbmQgd2UgZG8gbm90IGluc2VydCBCb29raW5nIGZvcm0gYnkgbWlzdGFrZSkuXHJcblx0XHR2YXIgaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyID0gKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZ191bnNlbGVjdGFibGUnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwKTtcdFx0XHRcdC8vIEZpeEluOiA4LjAuMS4yLlxyXG5cdFx0dmFyIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCAgICA9ICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICk7XHJcblx0XHRpZiAoICggaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyICkgJiYgKCAhIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCApICl7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFVuc2VsZWN0IERhdGVzXHJcblx0XHRcdGpRdWVyeSgnLndwYmNfb25seV9jYWxlbmRhciAucG9wb3Zlcl9jYWxlbmRhcl9ob3ZlcicpLnJlbW92ZSgpOyAgICAgICAgICAgICAgICAgICAgICBcdFx0XHRcdFx0XHRcdC8vIEhpZGUgYWxsIG9wZW5lZCBwb3BvdmVyc1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQWRkIHNlbGVjdGVkIGRhdGVzIHRvICBoaWRkZW4gdGV4dGFyZWFcclxuXHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMpICl7IHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMoIGRhdGUsIHJlc291cmNlX2lkICk7IH1cclxuXHJcblx0XHR3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIEhvb2sgLS0gdHJpZ2dlciBkYXkgc2VsZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgbW91c2VfY2xpY2tlZF9kYXRlcyA9IGRhdGU7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFwiMDUuMTAuMjAyMyAtIDA3LjEwLjIwMjNcIiAgfCAgXCIxMC4xMC4yMDIzIC0gMTAuMTAuMjAyM1wiICB8XHJcblx0XHR2YXIgYWxsX3NlbGVjdGVkX2RhdGVzX2FyciA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFsgXCIyMDIzLTEwLTA1XCIsIFwiMjAyMy0xMC0wNlwiLCBcIjIwMjMtMTAtMDdcIiwg4oCmIF1cclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkudHJpZ2dlciggXCJkYXRlX3NlbGVjdGVkXCIsIFsgcmVzb3VyY2VfaWQsIG1vdXNlX2NsaWNrZWRfZGF0ZXMsIGFsbF9zZWxlY3RlZF9kYXRlc19hcnIgXSApO1xyXG5cdH1cclxuXHJcblx0Ly8gTWFyayBtaWRkbGUgc2VsZWN0ZWQgZGF0ZXMgd2l0aCAwLjUgb3BhY2l0eVx0XHQvLyBGaXhJbjogMTAuMy4wLjkuXHJcblx0alF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkub24oICdkYXRlX3NlbGVjdGVkJywgZnVuY3Rpb24gKCBldmVudCwgcmVzb3VyY2VfaWQsIGRhdGUgKXtcclxuXHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHQgICAoICAnZml4ZWQnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpXHJcblx0XHRcdFx0XHR8fCAoJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0dmFyIG1pZGRsZV9kYXlzX29wYWNpdHkgPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdjYWxlbmRhcnNfX2RheXNfc2VsZWN0aW9uX19taWRkbGVfZGF5c19vcGFjaXR5JyApO1xyXG5cdFx0XHRcdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgLmRhdGVwaWNrLWN1cnJlbnQtZGF5JyApLm5vdCggXCIuc2VsZWN0ZWRfY2hlY2tfaW5fb3V0XCIgKS5jc3MoICdvcGFjaXR5JywgbWlkZGxlX2RheXNfb3BhY2l0eSApO1xyXG5cdFx0XHRcdFx0fSwgMTAgKTtcclxuXHRcdFx0XHR9XHJcblx0XHR9ICk7XHJcblx0fSApO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogLS0gIFQgaSBtIGUgICAgRiBpIGUgbCBkIHMgICAgIHN0YXJ0ICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEaXNhYmxlIHRpbWUgc2xvdHMgaW4gYm9va2luZyBmb3JtIGRlcGVuZCBvbiBzZWxlY3RlZCBkYXRlcyBhbmQgYm9va2VkIGRhdGVzL3RpbWVzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogXHQxLiBHZXQgYWxsIHRpbWUgZmllbGRzIGluIHRoZSBib29raW5nIGZvcm0gYXMgYXJyYXkgIG9mIG9iamVjdHNcclxuXHRcdCAqIFx0XHRcdFx0XHRbXHJcblx0XHQgKiBcdFx0XHRcdFx0IFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0XHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdFx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCBdXHJcblx0XHQgKi9cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmpfYXJyID0gd3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyAyLiBHZXQgYWxsIHNlbGVjdGVkIGRhdGVzIGluICBTUUwgZm9ybWF0ICBsaWtlIHRoaXMgWyBcIjIwMjMtMDgtMjNcIiwgXCIyMDIzLTA4LTI0XCIsIFwiMjAyMy0wOC0yNVwiLCAuLi4gXVxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX2FyciA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyAzLiBHZXQgY2hpbGQgYm9va2luZyByZXNvdXJjZXMgIG9yIHNpbmdsZSBib29raW5nIHJlc291cmNlICB0aGF0ICBleGlzdCAgaW4gZGF0ZXNcclxuXHRcdHZhciBjaGlsZF9yZXNvdXJjZXNfYXJyID0gd3BiY19jbG9uZV9vYmooIF93cGJjLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgKSApO1xyXG5cclxuXHRcdHZhciBzcWxfZGF0ZTtcclxuXHRcdHZhciBjaGlsZF9yZXNvdXJjZV9pZDtcclxuXHRcdHZhciBtZXJnZWRfc2Vjb25kcztcclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmo7XHJcblx0XHR2YXIgaXNfaW50ZXJzZWN0O1xyXG5cdFx0dmFyIGlzX2NoZWNrX2luO1xyXG5cclxuXHRcdHZhciB0b2RheV90aW1lX19yZWFsICA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVswXSwgKCBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbMV0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsyXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbM10sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzRdLCAwICk7XHJcblx0XHR2YXIgdG9kYXlfdGltZV9fc2hpZnQgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbMF0sICggcGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggICAgICAndG9kYXlfYXJyJyApWzFdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbMl0sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgICAgICApWzNdLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVs0XSwgMCApO1xyXG5cclxuXHRcdC8vIDQuIExvb3AgIGFsbCAgdGltZSBGaWVsZHMgb3B0aW9uc1x0XHQvLyBGaXhJbjogMTAuMy4wLjIuXHJcblx0XHRmb3IgKCBsZXQgZmllbGRfa2V5ID0gMDsgZmllbGRfa2V5IDwgdGltZV9maWVsZHNfb2JqX2Fyci5sZW5ndGg7IGZpZWxkX2tleSsrICl7XHJcblxyXG5cdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXS5kaXNhYmxlZCA9IDA7ICAgICAgICAgIC8vIEJ5IGRlZmF1bHQsIHRoaXMgdGltZSBmaWVsZCBpcyBub3QgZGlzYWJsZWQuXHJcblxyXG5cdFx0XHR0aW1lX2ZpZWxkc19vYmogPSB0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXTtcdFx0Ly8geyB0aW1lc19hc19zZWNvbmRzOiBbIDIxNjAwLCAyMzQwMCBdLCB2YWx1ZV9vcHRpb25fMjRoOiAnMDY6MDAgLSAwNjozMCcsIG5hbWU6ICdyYW5nZXRpbWUyW10nLCBqcXVlcnlfb3B0aW9uOiBqUXVlcnlfT2JqZWN0IHt9fVxyXG5cclxuXHRcdFx0Ly8gTG9vcCAgYWxsICBzZWxlY3RlZCBkYXRlcy5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICkge1xyXG5cclxuXHRcdFx0XHQvLyBHZXQgRGF0ZTogJzIwMjMtMDgtMTgnLlxyXG5cdFx0XHRcdHNxbF9kYXRlID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF07XHJcblxyXG5cdFx0XHRcdHZhciBpc190aW1lX2luX3Bhc3QgPSB3cGJjX2NoZWNrX2lzX3RpbWVfaW5fcGFzdCggdG9kYXlfdGltZV9fc2hpZnQsIHNxbF9kYXRlLCB0aW1lX2ZpZWxkc19vYmogKTtcclxuXHRcdFx0XHRpZiAoIGlzX3RpbWVfaW5fcGFzdCApIHtcclxuXHRcdFx0XHRcdC8vIFRoaXMgdGltZSBmb3Igc2VsZWN0ZWQgZGF0ZSBhbHJlYWR5ICBpbiB0aGUgcGFzdC5cclxuXHRcdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnJbZmllbGRfa2V5XS5kaXNhYmxlZCA9IDE7XHJcblx0XHRcdFx0XHRicmVhaztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gZXhpc3QgIGZyb20gICBEYXRlcyBMT09QLlxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gRml4SW46IDkuOS4wLjMxLlxyXG5cdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCAgICggJ09mZicgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19yZWN1cnJlbnRfdGltZScgKSApXHJcblx0XHRcdFx0XHQmJiAoIHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGg+MSApXHJcblx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdC8vVE9ETzogc2tpcCBzb21lIGZpZWxkcyBjaGVja2luZyBpZiBpdCdzIHN0YXJ0IC8gZW5kIHRpbWUgZm9yIG11bHBsZSBkYXRlcyAgc2VsZWN0aW9uICBtb2RlLlxyXG5cdFx0XHRcdFx0Ly9UT0RPOiB3ZSBuZWVkIHRvIGZpeCBzaXR1YXRpb24gIGZvciBlbnRpbWVzLCAgd2hlbiAgdXNlciAgc2VsZWN0ICBzZXZlcmFsICBkYXRlcywgIGFuZCBpbiBzdGFydCAgdGltZSBib29rZWQgMDA6MDAgLSAxNTowMCAsIGJ1dCBzeXN0c21lIGJsb2NrIHVudGlsbCAxNTowMCB0aGUgZW5kIHRpbWUgYXMgd2VsbCwgIHdoaWNoICBpcyB3cm9uZywgIGJlY2F1c2UgaXQgMiBvciAzIGRhdGVzIHNlbGVjdGlvbiAgYW5kIGVuZCBkYXRlIGNhbiBiZSBmdWxsdSAgYXZhaWxhYmxlXHJcblxyXG5cdFx0XHRcdFx0aWYgKCAoMCA9PSBpKSAmJiAodGltZV9maWVsZHNfb2JqWyAnbmFtZScgXS5pbmRleE9mKCAnZW5kdGltZScgKSA+PSAwKSApe1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggKCAoc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aC0xKSA9PSBpICkgJiYgKHRpbWVfZmllbGRzX29ialsgJ25hbWUnIF0uaW5kZXhPZiggJ3N0YXJ0dGltZScgKSA+PSAwKSApe1xyXG5cdFx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cclxuXHJcblx0XHRcdFx0dmFyIGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCA9IDA7XHJcblx0XHRcdFx0Ly8gTG9vcCBhbGwgcmVzb3VyY2VzIElEXHJcblx0XHRcdFx0XHQvLyBmb3IgKCB2YXIgcmVzX2tleSBpbiBjaGlsZF9yZXNvdXJjZXNfYXJyICl7XHQgXHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjMuMC4yLlxyXG5cdFx0XHRcdGZvciAoIGxldCByZXNfa2V5ID0gMDsgcmVzX2tleSA8IGNoaWxkX3Jlc291cmNlc19hcnIubGVuZ3RoOyByZXNfa2V5KysgKXtcclxuXHJcblx0XHRcdFx0XHRjaGlsZF9yZXNvdXJjZV9pZCA9IGNoaWxkX3Jlc291cmNlc19hcnJbIHJlc19rZXkgXTtcclxuXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHNcdFx0PSBbIFwiMDc6MDA6MTEgLSAwNzozMDowMlwiLCBcIjEwOjAwOjExIC0gMDA6MDA6MDBcIiBdXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1x0XHRcdD0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cclxuXHRcdFx0XHRcdGlmICggZmFsc2UgIT09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSApICl7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9kYXRlIClbIGNoaWxkX3Jlc291cmNlX2lkIF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHM7XHRcdC8vIFsgIFsgMjUyMTEsIDI3MDAyIF0sIFsgMzYwMTEsIDg2NDAwIF0gIF1cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gW107XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzLmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX3JhbmdlX3RpbWVfaW50ZXJ2YWwoICBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1swXSApICsgMjAgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1sxXSApIC0gMjAgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIG1lcmdlZF9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpc19jaGVja19pbiA9ICgtMSAhPT0gdGltZV9maWVsZHNfb2JqLm5hbWUuaW5kZXhPZiggJ3N0YXJ0JyApKTtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX29uZV90aW1lX2ludGVydmFsKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KCAoIGlzX2NoZWNrX2luIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSArIDIwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIDogcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgLSAyMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBtZXJnZWRfc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGlzX2ludGVyc2VjdCl7XHJcblx0XHRcdFx0XHRcdGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCsrO1x0XHRcdC8vIEluY3JlYXNlXHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBjaGlsZF9yZXNvdXJjZXNfYXJyLmxlbmd0aCA9PSBob3dfbWFueV9yZXNvdXJjZXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdFx0XHQvLyBBbGwgcmVzb3VyY2VzIGludGVyc2VjdGVkLCAgdGhlbiAgaXQncyBtZWFucyB0aGF0IHRoaXMgdGltZS1zbG90IG9yIHRpbWUgbXVzdCAgYmUgIERpc2FibGVkLCBhbmQgd2UgY2FuICBleGlzdCAgZnJvbSAgIHNlbGVjdGVkX2RhdGVzX2FyciBMT09QXHJcblxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2FyclsgZmllbGRfa2V5IF0uZGlzYWJsZWQgPSAxO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGV4aXN0ICBmcm9tICAgRGF0ZXMgTE9PUFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyA1LiBOb3cgd2UgY2FuIGRpc2FibGUgdGltZSBzbG90IGluIEhUTUwgYnkgIHVzaW5nICAoIGZpZWxkLmRpc2FibGVkID09IDEgKSBwcm9wZXJ0eVxyXG5cdFx0d3BiY19faHRtbF9fdGltZV9maWVsZF9vcHRpb25zX19zZXRfZGlzYWJsZWQoIHRpbWVfZmllbGRzX29ial9hcnIgKTtcclxuXHJcblx0XHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLnRyaWdnZXIoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkJywgW3Jlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlc19hcnJdICk7XHRcdFx0XHRcdC8vIFRyaWdnZXIgaG9vayBvbiBkaXNhYmxpbmcgdGltZXNsb3RzLlx0XHRVc2FnZTogXHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLm9uKCAnd3BiY19ob29rX3RpbWVzbG90c19kaXNhYmxlZCcsIGZ1bmN0aW9uICggZXZlbnQsIGJrX3R5cGUsIGFsbF9kYXRlcyApeyAuLi4gfSApO1x0XHQvLyBGaXhJbjogOC43LjExLjkuXHJcblx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIENoZWNrIGlmIHNwZWNpZmljIHRpbWUoLXNsb3QpIGFscmVhZHkgIGluIHRoZSBwYXN0IGZvciBzZWxlY3RlZCBkYXRlXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIGpzX2N1cnJlbnRfdGltZV90b19jaGVja1x0XHQtIEpTIERhdGVcclxuXHRcdCAqIEBwYXJhbSBzcWxfZGF0ZVx0XHRcdFx0XHRcdC0gJzIwMjUtMDEtMjYnXHJcblx0XHQgKiBAcGFyYW0gdGltZV9maWVsZHNfb2JqXHRcdFx0XHQtIE9iamVjdFxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0KCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2ssIHNxbF9kYXRlLCB0aW1lX2ZpZWxkc19vYmogKSB7XHJcblxyXG5cdFx0XHQvLyBGaXhJbjogMTAuOS42LjRcclxuXHRcdFx0dmFyIHNxbF9kYXRlX2FyciA9IHNxbF9kYXRlLnNwbGl0KCAnLScgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlX19taWRuaWdodCA9IG5ldyBEYXRlKCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzBdICksICggcGFyc2VJbnQoIHNxbF9kYXRlX2FyclsxXSApIC0gMSApLCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzJdICksIDAsIDAsIDAgKTtcclxuXHRcdFx0dmFyIHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyA9IHNxbF9kYXRlX19taWRuaWdodC5nZXRUaW1lKCk7XHJcblxyXG5cdFx0XHR2YXIgaXNfaW50ZXJzZWN0ID0gZmFsc2U7XHJcblxyXG5cdFx0XHRpZiAoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzLmxlbmd0aCA+IDEgKSB7XHJcblxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IChzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyAocGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzBdICkgKyAyMCkgKiAxMDAwKSApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IChzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyAocGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzFdICkgLSAyMCkgKiAxMDAwKSApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR2YXIgaXNfY2hlY2tfaW4gPSAoLTEgIT09IHRpbWVfZmllbGRzX29iai5uYW1lLmluZGV4T2YoICdzdGFydCcgKSk7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzX2NoZWNrID0gKGlzX2NoZWNrX2luKSA/IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApICsgMjAgOiBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSAtIDIwO1xyXG5cclxuXHRcdFx0XHR0aW1lc19hc19zZWNvbmRzX2NoZWNrID0gc3FsX2RhdGVfX21pZG5pZ2h0X21pbGlzZWNvbmRzICsgdGltZXNfYXNfc2Vjb25kc19jaGVjayAqIDEwMDA7XHJcblxyXG5cdFx0XHRcdGlmICgganNfY3VycmVudF90aW1lX3RvX2NoZWNrLmdldFRpbWUoKSA+IHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgKSB7XHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB0cnVlO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGlzX2ludGVyc2VjdDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIG51bWJlciBpbnNpZGUgL2ludGVyc2VjdCAgb2YgYXJyYXkgb2YgaW50ZXJ2YWxzID9cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gdGltZV9BXHRcdCAgICAgXHQtIDI1ODAwXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19vbmVfdGltZV9pbnRlcnZhbCggdGltZV9BLCB0aW1lX2ludGVydmFsX0IgKXtcclxuXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfaW50ZXJ2YWxfQi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRpZiAoIChwYXJzZUludCggdGltZV9BICkgPiBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDAgXSApKSAmJiAocGFyc2VJbnQoIHRpbWVfQSApIDwgcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAxIF0gKSkgKXtcclxuXHRcdFx0XHRcdHJldHVybiB0cnVlXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBpZiAoICggcGFyc2VJbnQoIHRpbWVfQSApID09IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMCBdICkgKSB8fCAoIHBhcnNlSW50KCB0aW1lX0EgKSA9PSBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDEgXSApICkgKSB7XHJcblx0XHRcdFx0Ly8gXHRcdFx0Ly8gVGltZSBBIGp1c3QgIGF0ICB0aGUgYm9yZGVyIG9mIGludGVydmFsXHJcblx0XHRcdFx0Ly8gfVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0ICAgIHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIHRoZXNlIGFycmF5IG9mIGludGVydmFscyBpbnRlcnNlY3RlZCA/XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHRpbWVfaW50ZXJ2YWxfQVx0XHQtIFsgWyAyMTYwMCwgMjM0MDAgXSBdXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19yYW5nZV90aW1lX2ludGVydmFsKCB0aW1lX2ludGVydmFsX0EsIHRpbWVfaW50ZXJ2YWxfQiApe1xyXG5cclxuXHRcdFx0dmFyIGlzX2ludGVyc2VjdDtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHRpbWVfaW50ZXJ2YWxfQS5sZW5ndGg7IGkrKyApe1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX2ludGVydmFsX0IubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2ludGVydmFsc19faXNfaW50ZXJzZWN0ZWQoIHRpbWVfaW50ZXJ2YWxfQVsgaSBdLCB0aW1lX2ludGVydmFsX0JbIGogXSApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggaXNfaW50ZXJzZWN0ICl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKiBAcmV0dXJucyBbXVxyXG5cdFx0ICpcclxuXHRcdCAqIFx0XHRFeGFtcGxlOlxyXG5cdFx0ICogXHRcdFx0XHRcdFtcclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHQgKiBcdFx0XHRcdFx0XHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKXtcclxuXHRcdCAgICAvKipcclxuXHRcdFx0ICogRmllbGRzIHdpdGggIFtdICBsaWtlIHRoaXMgICBzZWxlY3RbbmFtZT1cInJhbmdldGltZTFbXVwiXVxyXG5cdFx0XHQgKiBpdCdzIHdoZW4gd2UgaGF2ZSAnbXVsdGlwbGUnIGluIHNob3J0Y29kZTogICBbc2VsZWN0KiByYW5nZXRpbWUgbXVsdGlwbGUgIFwiMDY6MDAgLSAwNjozMFwiIC4uLiBdXHJcblx0XHRcdCAqL1xyXG5cdFx0XHR2YXIgdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nXHJcblx0XHRcdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSBbXTtcclxuXHJcblx0XHRcdC8vIExvb3AgYWxsIFRpbWUgRmllbGRzXHJcblx0XHRcdGZvciAoIHZhciBjdGY9IDA7IGN0ZiA8IHRpbWVfZmllbGRzX2Fyci5sZW5ndGg7IGN0ZisrICl7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lX2ZpZWxkID0gdGltZV9maWVsZHNfYXJyWyBjdGYgXTtcclxuXHRcdFx0XHR2YXIgdGltZV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfZmllbGQgKyAnIG9wdGlvbicgKTtcclxuXHJcblx0XHRcdFx0Ly8gTG9vcCBhbGwgb3B0aW9ucyBpbiB0aW1lIGZpZWxkXHJcblx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9vcHRpb24ubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbiA9IGpRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uOmVxKCcgKyBqICsgJyknICk7XHJcblx0XHRcdFx0XHR2YXIgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyID0ganF1ZXJ5X29wdGlvbi52YWwoKS5zcGxpdCggJy0nICk7XHJcblx0XHRcdFx0XHR2YXIgdGltZXNfYXNfc2Vjb25kcyA9IFtdO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdldCB0aW1lIGFzIHNlY29uZHNcclxuXHRcdFx0XHRcdGlmICggdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aCApe1x0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aDsgaSsrICl7XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0XHRcdFx0Ly8gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyW2ldID0gJzE0OjAwICcgIHwgJyAxNjowMCcgICAoaWYgZnJvbSAncmFuZ2V0aW1lJykgYW5kICcxNjowMCcgIGlmIChzdGFydC9lbmQgdGltZSlcclxuXHJcblx0XHRcdFx0XHRcdFx0dmFyIHN0YXJ0X2VuZF90aW1lc19hcnIgPSB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbIGkgXS50cmltKCkuc3BsaXQoICc6JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHR2YXIgdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzLnB1c2goIHRpbWVfaW5fc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2Fyci5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgICAgICAgICAgIDogalF1ZXJ5KCB0aW1lX2ZpZWxkICkuYXR0ciggJ25hbWUnICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzoganF1ZXJ5X29wdGlvbi52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiBqcXVlcnlfb3B0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGltZXNfYXNfc2Vjb25kcyc6IHRpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiB0aW1lX2ZpZWxkc19vYmpfYXJyO1xyXG5cdFx0fVxyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIERpc2FibGUgSFRNTCBvcHRpb25zIGFuZCBhZGQgYm9va2VkIENTUyBjbGFzc1xyXG5cdFx0XHQgKlxyXG5cdFx0XHQgKiBAcGFyYW0gdGltZV9maWVsZHNfb2JqX2FyciAgICAgIC0gdGhpcyB2YWx1ZSBpcyBmcm9tICB0aGUgZnVuYzogIFx0d3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0W1xyXG5cdFx0XHQgKiBcdFx0XHRcdFx0IFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0XHRcdCAqIFx0ICBcdFx0XHRcdFx0XHQgICAgZGlzYWJsZWQgPSAxXHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHRcdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdFx0XHQgKiAgIFx0XHRcdFx0XHRcdFx0ZGlzYWJsZWQgPSAwXHJcblx0XHRcdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHRcdFx0ICogXHRcdFx0XHRcdCBdXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRmdW5jdGlvbiB3cGJjX19odG1sX190aW1lX2ZpZWxkX29wdGlvbnNfX3NldF9kaXNhYmxlZCggdGltZV9maWVsZHNfb2JqX2FyciApe1xyXG5cclxuXHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbjtcclxuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgdGltZV9maWVsZHNfb2JqX2Fyci5sZW5ndGg7IGkrKyApe1xyXG5cclxuXHRcdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uID0gdGltZV9maWVsZHNfb2JqX2FyclsgaSBdLmpxdWVyeV9vcHRpb247XHJcblxyXG5cdFx0XHRcdFx0aWYgKCAxID09IHRpbWVfZmllbGRzX29ial9hcnJbIGkgXS5kaXNhYmxlZCApe1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIHRydWUgKTsgXHRcdC8vIE1ha2UgZGlzYWJsZSBzb21lIG9wdGlvbnNcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5hZGRDbGFzcyggJ2Jvb2tlZCcgKTsgICAgICAgICAgIFx0Ly8gQWRkIFwiYm9va2VkXCIgQ1NTIGNsYXNzXHJcblxyXG5cdFx0XHRcdFx0XHQvLyBpZiB0aGlzIGJvb2tlZCBlbGVtZW50IHNlbGVjdGVkIC0tPiB0aGVuIGRlc2VsZWN0ICBpdFxyXG5cdFx0XHRcdFx0XHRpZiAoIGpxdWVyeV9vcHRpb24ucHJvcCggJ3NlbGVjdGVkJyApICl7XHJcblx0XHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5wcm9wKCAnc2VsZWN0ZWQnLCBmYWxzZSApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnBhcmVudCgpLmZpbmQoICdvcHRpb246bm90KFtkaXNhYmxlZF0pOmZpcnN0JyApLnByb3AoICdzZWxlY3RlZCcsIHRydWUgKS50cmlnZ2VyKCBcImNoYW5nZVwiICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdkaXNhYmxlZCcsIGZhbHNlICk7ICBcdFx0Ly8gTWFrZSBhY3RpdmUgYWxsIHRpbWVzXHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucmVtb3ZlQ2xhc3MoICdib29rZWQnICk7ICAgXHRcdC8vIFJlbW92ZSBjbGFzcyBcImJvb2tlZFwiXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayBpZiB0aGlzIHRpbWVfcmFuZ2UgfCBUaW1lX1Nsb3QgaXMgRnVsbCBEYXkgIGJvb2tlZFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzXHRcdC0gWyAzNjAxMSwgODY0MDAgXVxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc190aW1lc2xvdF9fZnVsbF9kYXlfYm9va2VkKCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kcyApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0XHQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzLmxlbmd0aCA+IDEgKVxyXG5cdFx0XHQmJiAoIHBhcnNlSW50KCB0aW1lc2xvdF9hcnJfaW5fc2Vjb25kc1sgMCBdICkgPCAzMCApXHJcblx0XHRcdCYmICggcGFyc2VJbnQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzWyAxIF0gKSA+ICAoICgyNCAqIDYwICogNjApIC0gMzApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8qICA9PSAgUyBlIGwgZSBjIHQgZSBkICAgIEQgYSB0IGUgcyAgLyAgVCBpIG0gZSAtIEYgaSBlIGwgZCBzICA9PVxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYWxsIHNlbGVjdGVkIGRhdGVzIGluIFNRTCBmb3JtYXQgbGlrZSB0aGlzIFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiICwgLi4uIF1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtbXX1cdFx0XHRbIFwiMjAyMy0wOC0yM1wiLCBcIjIwMjMtMDgtMjRcIiwgXCIyMDIzLTA4LTI1XCIsIFwiMjAyMy0wOC0yNlwiLCBcIjIwMjMtMDgtMjdcIiwgXCIyMDIzLTA4LTI4XCIsIFwiMjAyMy0wOC0yOVwiIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX2FyciA9IFtdO1xyXG5cdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyID0galF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCgpLnNwbGl0KCcsJyk7XHJcblxyXG5cdFx0aWYgKCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjU2LlxyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0udHJpbSgpO1xyXG5cdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0uc3BsaXQoICcuJyApO1xyXG5cdFx0XHRcdGlmICggc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0ubGVuZ3RoID4gMSApe1xyXG5cdFx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0gPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXVsgMiBdICsgJy0nICsgc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF1bIDEgXSArICctJyArIHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdWyAwIF07XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIGVtcHR5IGVsZW1lbnRzIGZyb20gYW4gYXJyYXlcclxuXHRcdHNlbGVjdGVkX2RhdGVzX2FyciA9IHNlbGVjdGVkX2RhdGVzX2Fyci5maWx0ZXIoIGZ1bmN0aW9uICggbiApeyByZXR1cm4gcGFyc2VJbnQobik7IH0gKTtcclxuXHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIuc29ydCgpO1xyXG5cclxuXHRcdHJldHVybiBzZWxlY3RlZF9kYXRlc19hcnI7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKiBAcGFyYW0gaXNfb25seV9zZWxlY3RlZF90aW1lXHJcblx0ICogQHJldHVybnMgW11cclxuXHQgKlxyXG5cdCAqIFx0XHRFeGFtcGxlOlxyXG5cdCAqIFx0XHRcdFx0XHRbXHJcblx0ICogXHRcdFx0XHRcdCBcdCAgIHtcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwLCAyMzQwMCBdXHJcblx0ICogXHRcdFx0XHRcdCBcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHQgKiBcdFx0XHRcdFx0XHQgICB7XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwJ1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdCAqIFx0XHRcdFx0XHRcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHQgKiBcdFx0XHRcdFx0IF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9fc2VsZWN0ZWRfdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCwgaXNfb25seV9zZWxlY3RlZF90aW1lID0gdHJ1ZSApe1xyXG5cdFx0LyoqXHJcblx0XHQgKiBGaWVsZHMgd2l0aCAgW10gIGxpa2UgdGhpcyAgIHNlbGVjdFtuYW1lPVwicmFuZ2V0aW1lMVtdXCJdXHJcblx0XHQgKiBpdCdzIHdoZW4gd2UgaGF2ZSAnbXVsdGlwbGUnIGluIHNob3J0Y29kZTogICBbc2VsZWN0KiByYW5nZXRpbWUgbXVsdGlwbGUgIFwiMDY6MDAgLSAwNjozMFwiIC4uLiBdXHJcblx0XHQgKi9cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19hcnI9W1xyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImR1cmF0aW9udGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXSdcclxuXHRcdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdHZhciB0aW1lX2ZpZWxkc19vYmpfYXJyID0gW107XHJcblxyXG5cdFx0Ly8gTG9vcCBhbGwgVGltZSBGaWVsZHNcclxuXHRcdGZvciAoIHZhciBjdGY9IDA7IGN0ZiA8IHRpbWVfZmllbGRzX2Fyci5sZW5ndGg7IGN0ZisrICl7XHJcblxyXG5cdFx0XHR2YXIgdGltZV9maWVsZCA9IHRpbWVfZmllbGRzX2FyclsgY3RmIF07XHJcblxyXG5cdFx0XHR2YXIgdGltZV9vcHRpb247XHJcblx0XHRcdGlmICggaXNfb25seV9zZWxlY3RlZF90aW1lICl7XHJcblx0XHRcdFx0dGltZV9vcHRpb24gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCArICcgb3B0aW9uOnNlbGVjdGVkJyApO1x0XHRcdC8vIEV4Y2x1ZGUgY29uZGl0aW9uYWwgIGZpZWxkcywgIGJlY2F1c2Ugb2YgdXNpbmcgJyNib29raW5nX2Zvcm0zIC4uLidcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHR0aW1lX29wdGlvbiA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0aW1lX2ZpZWxkICsgJyBvcHRpb24nICk7XHRcdFx0XHQvLyBBbGwgIHRpbWUgZmllbGRzXHJcblx0XHRcdH1cclxuXHJcblxyXG5cdFx0XHQvLyBMb29wIGFsbCBvcHRpb25zIGluIHRpbWUgZmllbGRcclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9vcHRpb24ubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfb3B0aW9uWyBqIF0gKTtcdFx0Ly8gR2V0IG9ubHkgIHNlbGVjdGVkIG9wdGlvbnMgXHQvL2pRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uOmVxKCcgKyBqICsgJyknICk7XHJcblx0XHRcdFx0dmFyIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyciA9IGpxdWVyeV9vcHRpb24udmFsKCkuc3BsaXQoICctJyApO1xyXG5cdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzID0gW107XHJcblxyXG5cdFx0XHRcdC8vIEdldCB0aW1lIGFzIHNlY29uZHNcclxuXHRcdFx0XHRpZiAoIHZhbHVlX29wdGlvbl9zZWNvbmRzX2Fyci5sZW5ndGggKXtcdFx0XHRcdCBcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdFx0Zm9yICggbGV0IGkgPSAwOyBpIDwgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aDsgaSsrICl7XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0XHRcdC8vIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FycltpXSA9ICcxNDowMCAnICB8ICcgMTY6MDAnICAgKGlmIGZyb20gJ3JhbmdldGltZScpIGFuZCAnMTY6MDAnICBpZiAoc3RhcnQvZW5kIHRpbWUpXHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgc3RhcnRfZW5kX3RpbWVzX2FyciA9IHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyclsgaSBdLnRyaW0oKS5zcGxpdCggJzonICk7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kcy5wdXNoKCB0aW1lX2luX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCApLmF0dHIoICduYW1lJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiBqcXVlcnlfb3B0aW9uLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiBqcXVlcnlfb3B0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0aW1lc19hc19zZWNvbmRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVGV4dDogICBbc3RhcnR0aW1lXSAtIFtlbmR0aW1lXSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdHZhciB0ZXh0X3RpbWVfZmllbGRzX2Fycj1bXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XTtcclxuXHRcdGZvciAoIHZhciB0Zj0gMDsgdGYgPCB0ZXh0X3RpbWVfZmllbGRzX2Fyci5sZW5ndGg7IHRmKysgKXtcclxuXHJcblx0XHRcdHZhciB0ZXh0X2pxdWVyeSA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0ZXh0X3RpbWVfZmllbGRzX2FyclsgdGYgXSApO1x0XHRcdFx0XHRcdFx0XHQvLyBFeGNsdWRlIGNvbmRpdGlvbmFsICBmaWVsZHMsICBiZWNhdXNlIG9mIHVzaW5nICcjYm9va2luZ19mb3JtMyAuLi4nXHJcblx0XHRcdGlmICggdGV4dF9qcXVlcnkubGVuZ3RoID4gMCApe1xyXG5cclxuXHRcdFx0XHR2YXIgdGltZV9faF9tX19hcnIgPSB0ZXh0X2pxdWVyeS52YWwoKS50cmltKCkuc3BsaXQoICc6JyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMTQ6MDAnXHJcblx0XHRcdFx0aWYgKCAwID09IHRpbWVfX2hfbV9fYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTm90IGVudGVyZWQgdGltZSB2YWx1ZSBpbiBhIGZpZWxkXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggMSA9PSB0aW1lX19oX21fX2Fyci5sZW5ndGggKXtcclxuXHRcdFx0XHRcdGlmICggJycgPT09IHRpbWVfX2hfbV9fYXJyWyAwIF0gKXtcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdC8vIE5vdCBlbnRlcmVkIHRpbWUgdmFsdWUgaW4gYSBmaWVsZFxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dGltZV9faF9tX19hcnJbIDEgXSA9IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciB0ZXh0X3RpbWVfaW5fc2Vjb25kcyA9IHBhcnNlSW50KCB0aW1lX19oX21fX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHRpbWVfX2hfbV9fYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHR2YXIgdGV4dF90aW1lc19hc19zZWNvbmRzID0gW107XHJcblx0XHRcdFx0dGV4dF90aW1lc19hc19zZWNvbmRzLnB1c2goIHRleHRfdGltZV9pbl9zZWNvbmRzICk7XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiB0ZXh0X2pxdWVyeS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzogdGV4dF9qcXVlcnkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IHRleHRfanF1ZXJ5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0ZXh0X3RpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGltZV9maWVsZHNfb2JqX2FycjtcclxuXHR9XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIFMgVSBQIFAgTyBSIFQgICAgZm9yICAgIEMgQSBMIEUgTiBEIEEgUiAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBDYWxlbmRhciBkYXRlcGljayAgSW5zdGFuY2VcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWQgIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHJldHVybiBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuZ2V0KCAwICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVuc2VsZWN0ICBhbGwgZGF0ZXMgaW4gY2FsZW5kYXIgYW5kIHZpc3VhbGx5IHVwZGF0ZSB0aGlzIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVx0XHR0cnVlIG9uIHN1Y2Nlc3MgfCBmYWxzZSwgIGlmIG5vIHN1Y2ggIGNhbGVuZGFyXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHRcdC8vIFVuc2VsZWN0IGFsbCBkYXRlcyBhbmQgc2V0ICBwcm9wZXJ0aWVzIG9mIERhdGVwaWNrXHJcblx0XHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoICcnICk7ICAgICAgLy9GaXhJbjogNS40LjNcclxuXHRcdFx0aW5zdC5zdGF5T3BlbiA9IGZhbHNlO1xyXG5cdFx0XHRpbnN0LmRhdGVzID0gW107XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENsZWFyIGRheXMgaGlnaGxpZ2h0aW5nIGluIEFsbCBvciBzcGVjaWZpYyBDYWxlbmRhcnNcclxuXHQgKlxyXG4gICAgICogQHBhcmFtIHJlc291cmNlX2lkICAtIGNhbiBiZSBza2lwZWQgdG8gIGNsZWFyIGhpZ2hsaWdodGluZyBpbiBhbGwgY2FsZW5kYXJzXHJcbiAgICAgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHQvLyBDbGVhciBpbiBzcGVjaWZpYyBjYWxlbmRhclxyXG5cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGpRdWVyeSggJy5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHRcdFx0XHRcdFx0XHQvLyBDbGVhciBpbiBhbGwgY2FsZW5kYXJzXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTY3JvbGwgdG8gc3BlY2lmaWMgbW9udGggaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiByZXNvdXJjZVxyXG5cdCAqIEBwYXJhbSB5ZWFyXHRcdFx0XHQtIHJlYWwgeWVhciAgLSAyMDIzXHJcblx0ICogQHBhcmFtIG1vbnRoXHRcdFx0XHQtIHJlYWwgbW9udGggLSAxMlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3Njcm9sbF90byggcmVzb3VyY2VfaWQsIHllYXIsIG1vbnRoICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXsgcmVzb3VyY2VfaWQgPSAnMSc7IH1cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHRcdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cclxuXHRcdFx0eWVhciAgPSBwYXJzZUludCggeWVhciApO1xyXG5cdFx0XHRtb250aCA9IHBhcnNlSW50KCBtb250aCApIC0gMTtcdFx0Ly8gSW4gSlMgZGF0ZSwgIG1vbnRoIC0xXHJcblxyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHQvLyBJbiBzb21lIGNhc2VzLCAgdGhlIHNldEZ1bGxZZWFyIGNhbiAgc2V0ICBvbmx5IFllYXIsICBhbmQgbm90IHRoZSBNb250aCBhbmQgZGF5ICAgICAgLy8gRml4SW46IDYuMi4zLjUuXHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZS5zZXRGdWxsWWVhciggeWVhciwgbW9udGgsIDEgKTtcclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlLnNldE1vbnRoKCBtb250aCApO1xyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUuc2V0RGF0ZSggMSApO1xyXG5cclxuXHRcdFx0aW5zdC5kcmF3TW9udGggPSBpbnN0LmN1cnNvckRhdGUuZ2V0TW9udGgoKTtcclxuXHRcdFx0aW5zdC5kcmF3WWVhciA9IGluc3QuY3Vyc29yRGF0ZS5nZXRGdWxsWWVhcigpO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9ub3RpZnlDaGFuZ2UoIGluc3QgKTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9hZGp1c3RJbnN0RGF0ZSggaW5zdCApO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3Nob3dEYXRlKCBpbnN0ICk7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSXMgdGhpcyBkYXRlIHNlbGVjdGFibGUgaW4gY2FsZW5kYXIgKG1haW5seSBpdCdzIG1lYW5zIEFWQUlMQUJMRSBkYXRlKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtpbnR8c3RyaW5nfSByZXNvdXJjZV9pZFx0XHQxXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXlcdFx0JzIwMjMtMDgtMTEnXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHRcdFx0XHRcdHRydWUgfCBmYWxzZVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc19kYXlfc2VsZWN0YWJsZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHQvLyBHZXQgRGF0YSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGRhdGVfYm9va2luZ3Nfb2JqID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblx0XHR2YXIgaXNfZGF5X3NlbGVjdGFibGUgPSAoIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSA+IDAgKTtcclxuXHJcblx0XHRpZiAoIHR5cGVvZiAoZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdKSA9PT0gJ3VuZGVmaW5lZCcgKXtcclxuXHRcdFx0cmV0dXJuIGlzX2RheV9zZWxlY3RhYmxlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2F2YWlsYWJsZScgIT0gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHR2YXIgaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgKTtcdFx0Ly8gc2V0IHBlbmRpbmcgZGF5cyBzZWxlY3RhYmxlICAgICAgICAgIC8vIEZpeEluOiA4LjYuMS4xOC5cclxuXHJcblx0XHRcdHN3aXRjaCAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdICl7XHJcblx0XHRcdFx0Y2FzZSAncGVuZGluZyc6XHJcblx0XHRcdFx0Ly8gU2l0dWF0aW9ucyBmb3IgXCJjaGFuZ2Utb3ZlclwiIGRheXM6XHJcblx0XHRcdFx0Y2FzZSAncGVuZGluZ19wZW5kaW5nJzpcclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nX2FwcHJvdmVkJzpcclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZF9wZW5kaW5nJzpcclxuXHRcdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHRcdFx0XHRkZWZhdWx0OlxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGlzX2RheV9zZWxlY3RhYmxlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSXMgZGF0ZSB0byBjaGVjayBJTiBhcnJheSBvZiBzZWxlY3RlZCBkYXRlc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtkYXRlfWpzX2RhdGVfdG9fY2hlY2tcdFx0LSBKUyBEYXRlXHRcdFx0LSBzaW1wbGUgIEphdmFTY3JpcHQgRGF0ZSBvYmplY3RcclxuXHQgKiBAcGFyYW0ge1tdfSBqc19kYXRlc19hcnJcdFx0XHQtIFsgSlNEYXRlLCAuLi4gXSAgIC0gYXJyYXkgIG9mIEpTIGRhdGVzXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX2RheV9hbW9uZ19zZWxlY3RlZF9kYXlzKCBqc19kYXRlX3RvX2NoZWNrLCBqc19kYXRlc19hcnIgKXtcclxuXHJcblx0XHRmb3IgKCB2YXIgZGF0ZV9pbmRleCA9IDA7IGRhdGVfaW5kZXggPCBqc19kYXRlc19hcnIubGVuZ3RoIDsgZGF0ZV9pbmRleCsrICl7ICAgICBcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOC40LjUuMTYuXHJcblx0XHRcdGlmICggKCBqc19kYXRlc19hcnJbIGRhdGVfaW5kZXggXS5nZXRGdWxsWWVhcigpID09PSBqc19kYXRlX3RvX2NoZWNrLmdldEZ1bGxZZWFyKCkgKSAmJlxyXG5cdFx0XHRcdCAoIGpzX2RhdGVzX2FyclsgZGF0ZV9pbmRleCBdLmdldE1vbnRoKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0TW9udGgoKSApICYmXHJcblx0XHRcdFx0ICgganNfZGF0ZXNfYXJyWyBkYXRlX2luZGV4IF0uZ2V0RGF0ZSgpID09PSBqc19kYXRlX3RvX2NoZWNrLmdldERhdGUoKSApICkge1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IFNRTCBDbGFzcyBEYXRlICcyMDIzLTA4LTAxJyBmcm9tICBKUyBEYXRlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHRcdCcyMDIzLTA4LTEyJ1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKXtcclxuXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IGRhdGUuZ2V0RnVsbFllYXIoKSArICctJztcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSAoICggZGF0ZS5nZXRNb250aCgpICsgMSApIDwgMTAgKSA/ICcwJyA6ICcnO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9ICggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy0nXHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gKCBkYXRlLmdldERhdGUoKSA8IDEwICkgPyAnMCcgOiAnJztcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSBkYXRlLmdldERhdGUoKTtcclxuXHJcblx0XHRcdHJldHVybiBzcWxfY2xhc3NfZGF5O1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IEpTIERhdGUgZnJvbSAgdGhlIFNRTCBkYXRlIGZvcm1hdCAnMjAyNC0wNS0xNCdcclxuXHQgKiBAcGFyYW0gc3FsX2NsYXNzX2RhdGVcclxuXHQgKiBAcmV0dXJucyB7RGF0ZX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19nZXRfX2pzX2RhdGUoIHNxbF9jbGFzc19kYXRlICl7XHJcblxyXG5cdFx0dmFyIHNxbF9jbGFzc19kYXRlX2FyciA9IHNxbF9jbGFzc19kYXRlLnNwbGl0KCAnLScgKTtcclxuXHJcblx0XHR2YXIgZGF0ZV9qcyA9IG5ldyBEYXRlKCk7XHJcblxyXG5cdFx0ZGF0ZV9qcy5zZXRGdWxsWWVhciggcGFyc2VJbnQoIHNxbF9jbGFzc19kYXRlX2FyclsgMCBdICksIChwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAxIF0gKSAtIDEpLCBwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAyIF0gKSApOyAgLy8geWVhciwgbW9udGgsIGRhdGVcclxuXHJcblx0XHQvLyBXaXRob3V0IHRoaXMgdGltZSBhZGp1c3QgRGF0ZXMgc2VsZWN0aW9uICBpbiBEYXRlcGlja2VyIGNhbiBub3Qgd29yayEhIVxyXG5cdFx0ZGF0ZV9qcy5zZXRIb3VycygwKTtcclxuXHRcdGRhdGVfanMuc2V0TWludXRlcygwKTtcclxuXHRcdGRhdGVfanMuc2V0U2Vjb25kcygwKTtcclxuXHRcdGRhdGVfanMuc2V0TWlsbGlzZWNvbmRzKDApO1xyXG5cclxuXHRcdHJldHVybiBkYXRlX2pzO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IFREIENsYXNzIERhdGUgJzEtMzEtMjAyMycgZnJvbSAgSlMgRGF0ZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdEpTIERhdGVcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVx0XHQnMS0zMS0yMDIzJ1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fdGRfY2xhc3NfZGF0ZSggZGF0ZSApe1xyXG5cclxuXHRcdHZhciB0ZF9jbGFzc19kYXkgPSAoZGF0ZS5nZXRNb250aCgpICsgMSkgKyAnLScgKyBkYXRlLmdldERhdGUoKSArICctJyArIGRhdGUuZ2V0RnVsbFllYXIoKTtcdFx0XHRcdFx0XHRcdFx0Ly8gJzEtOS0yMDIzJ1xyXG5cclxuXHRcdHJldHVybiB0ZF9jbGFzc19kYXk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgZGF0ZSBwYXJhbXMgZnJvbSAgc3RyaW5nIGRhdGVcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0c3RyaW5nIGRhdGUgbGlrZSAnMzEuNS4yMDIzJ1xyXG5cdCAqIEBwYXJhbSBzZXBhcmF0b3JcdFx0ZGVmYXVsdCAnLicgIGNhbiBiZSBza2lwcGVkLlxyXG5cdCAqIEByZXR1cm5zIHsgIHtkYXRlOiBudW1iZXIsIG1vbnRoOiBudW1iZXIsIHllYXI6IG51bWJlcn0gIH1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19nZXRfX2RhdGVfcGFyYW1zX19mcm9tX3N0cmluZ19kYXRlKCBkYXRlICwgc2VwYXJhdG9yKXtcclxuXHJcblx0XHRzZXBhcmF0b3IgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHNlcGFyYXRvcikgKSA/IHNlcGFyYXRvciA6ICcuJztcclxuXHJcblx0XHR2YXIgZGF0ZV9hcnIgPSBkYXRlLnNwbGl0KCBzZXBhcmF0b3IgKTtcclxuXHRcdHZhciBkYXRlX29iaiA9IHtcclxuXHRcdFx0J3llYXInIDogIHBhcnNlSW50KCBkYXRlX2FyclsgMiBdICksXHJcblx0XHRcdCdtb250aCc6IChwYXJzZUludCggZGF0ZV9hcnJbIDEgXSApIC0gMSksXHJcblx0XHRcdCdkYXRlJyA6ICBwYXJzZUludCggZGF0ZV9hcnJbIDAgXSApXHJcblx0XHR9O1xyXG5cdFx0cmV0dXJuIGRhdGVfb2JqO1x0XHQvLyBmb3IgXHRcdCA9IG5ldyBEYXRlKCBkYXRlX29iai55ZWFyICwgZGF0ZV9vYmoubW9udGggLCBkYXRlX29iai5kYXRlICk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBBZGQgU3BpbiBMb2FkZXIgdG8gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RhcnQoIHJlc291cmNlX2lkICl7XHJcblx0XHRpZiAoICEgalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5uZXh0KCkuaGFzQ2xhc3MoICd3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyJyApICl7XHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuYWZ0ZXIoICc8ZGl2IGNsYXNzPVwid3BiY19zcGluc19sb2FkZXJfd3JhcHBlclwiPjxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlclwiPjwvZGl2PjwvZGl2PicgKTtcclxuXHRcdH1cclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmhhc0NsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApICl7XHJcblx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuYWRkQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICk7XHJcblx0XHR9XHJcblx0XHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdGFydCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wKCByZXNvdXJjZV9pZCApe1xyXG5cdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnICsgLndwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkucmVtb3ZlKCk7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyX3NtYWxsJyApO1xyXG5cdFx0d3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcmVzb3VyY2VfaWQgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBCbHVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0YXJ0KCByZXNvdXJjZV9pZCApe1xyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZGRDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cicgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlbW92ZSBCbHVyIGluICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0b3AoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyJyApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uXHJcblx0LyogID09ICBDYWxlbmRhciBVcGRhdGUgIC0gVmlldyAgPT1cclxuXHQvLyAuLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLiAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBVcGRhdGUgTG9vayAgb2YgY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0alF1ZXJ5LmRhdGVwaWNrLl91cGRhdGVEYXRlcGljayggaW5zdCApO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZSBkeW5hbWljYWxseSBOdW1iZXIgb2YgTW9udGhzIGluIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWQgaW50XHJcblx0ICogQHBhcmFtIG1vbnRoc19udW1iZXIgaW50XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdXBkYXRlX21vbnRoc19udW1iZXIoIHJlc291cmNlX2lkLCBtb250aHNfbnVtYmVyICl7XHJcblx0XHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0aWYgKCBudWxsICE9PSBpbnN0ICl7XHJcblx0XHRcdGluc3Quc2V0dGluZ3NbICdudW1iZXJPZk1vbnRocycgXSA9IG1vbnRoc19udW1iZXI7XHJcblx0XHRcdC8vX3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJywgbW9udGhzX251bWJlciApO1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayggcmVzb3VyY2VfaWQgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTaG93IGNhbGVuZGFyIGluICBkaWZmZXJlbnQgU2tpblxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHNlbGVjdGVkX3NraW5fdXJsXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fY2FsZW5kYXJfX2NoYW5nZV9za2luKCBzZWxlY3RlZF9za2luX3VybCApe1xyXG5cclxuXHQvL2NvbnNvbGUubG9nKCAnU0tJTiBTRUxFQ1RJT04gOjonLCBzZWxlY3RlZF9za2luX3VybCApO1xyXG5cclxuXHRcdC8vIFJlbW92ZSBDU1Mgc2tpblxyXG5cdFx0dmFyIHN0eWxlc2hlZXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCggJ3dwYmMtY2FsZW5kYXItc2tpbi1jc3MnICk7XHJcblx0XHRzdHlsZXNoZWV0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHN0eWxlc2hlZXQgKTtcclxuXHJcblxyXG5cdFx0Ly8gQWRkIG5ldyBDU1Mgc2tpblxyXG5cdFx0dmFyIGhlYWRJRCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCBcImhlYWRcIiApWyAwIF07XHJcblx0XHR2YXIgY3NzTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaW5rJyApO1xyXG5cdFx0Y3NzTm9kZS50eXBlID0gJ3RleHQvY3NzJztcclxuXHRcdGNzc05vZGUuc2V0QXR0cmlidXRlKCBcImlkXCIsIFwid3BiYy1jYWxlbmRhci1za2luLWNzc1wiICk7XHJcblx0XHRjc3NOb2RlLnJlbCA9ICdzdHlsZXNoZWV0JztcclxuXHRcdGNzc05vZGUubWVkaWEgPSAnc2NyZWVuJztcclxuXHRcdGNzc05vZGUuaHJlZiA9IHNlbGVjdGVkX3NraW5fdXJsO1x0Ly9cImh0dHA6Ly9iZXRhL3dwLWNvbnRlbnQvcGx1Z2lucy9ib29raW5nL2Nzcy9za2lucy9ncmVlbi0wMS5jc3NcIjtcclxuXHRcdGhlYWRJRC5hcHBlbmRDaGlsZCggY3NzTm9kZSApO1xyXG5cdH1cclxuXHJcblxyXG5cdGZ1bmN0aW9uIHdwYmNfX2Nzc19fY2hhbmdlX3NraW4oIHNlbGVjdGVkX3NraW5fdXJsLCBzdHlsZXNoZWV0X2lkID0gJ3dwYmMtdGltZV9waWNrZXItc2tpbi1jc3MnICl7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIENTUyBza2luXHJcblx0XHR2YXIgc3R5bGVzaGVldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCBzdHlsZXNoZWV0X2lkICk7XHJcblx0XHRzdHlsZXNoZWV0LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoIHN0eWxlc2hlZXQgKTtcclxuXHJcblxyXG5cdFx0Ly8gQWRkIG5ldyBDU1Mgc2tpblxyXG5cdFx0dmFyIGhlYWRJRCA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCBcImhlYWRcIiApWyAwIF07XHJcblx0XHR2YXIgY3NzTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdsaW5rJyApO1xyXG5cdFx0Y3NzTm9kZS50eXBlID0gJ3RleHQvY3NzJztcclxuXHRcdGNzc05vZGUuc2V0QXR0cmlidXRlKCBcImlkXCIsIHN0eWxlc2hlZXRfaWQgKTtcclxuXHRcdGNzc05vZGUucmVsID0gJ3N0eWxlc2hlZXQnO1xyXG5cdFx0Y3NzTm9kZS5tZWRpYSA9ICdzY3JlZW4nO1xyXG5cdFx0Y3NzTm9kZS5ocmVmID0gc2VsZWN0ZWRfc2tpbl91cmw7XHQvL1wiaHR0cDovL2JldGEvd3AtY29udGVudC9wbHVnaW5zL2Jvb2tpbmcvY3NzL3NraW5zL2dyZWVuLTAxLmNzc1wiO1xyXG5cdFx0aGVhZElELmFwcGVuZENoaWxkKCBjc3NOb2RlICk7XHJcblx0fVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIFMgVSBQIFAgTyBSIFQgICAgTSBBIFQgSCAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBNZXJnZSBzZXZlcmFsICBpbnRlcnNlY3RlZCBpbnRlcnZhbHMgb3IgcmV0dXJuIG5vdCBpbnRlcnNlY3RlZDogICAgICAgICAgICAgICAgICAgICAgICBbWzEsM10sWzIsNl0sWzgsMTBdLFsxNSwxOF1dICAtPiAgIFtbMSw2XSxbOCwxMF0sWzE1LDE4XV1cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gW10gaW50ZXJ2YWxzXHRcdFx0IFsgWzEsM10sWzIsNF0sWzYsOF0sWzksMTBdLFszLDddIF1cclxuXHRcdCAqIEByZXR1cm5zIFtdXHRcdFx0XHRcdCBbIFsxLDhdLFs5LDEwXSBdXHJcblx0XHQgKlxyXG5cdFx0ICogRXhtYW1wbGU6IHdwYmNfaW50ZXJ2YWxzX19tZXJnZV9pbmVyc2VjdGVkKCAgWyBbMSwzXSxbMiw0XSxbNiw4XSxbOSwxMF0sWzMsN10gXSAgKTtcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pbnRlcnZhbHNfX21lcmdlX2luZXJzZWN0ZWQoIGludGVydmFscyApe1xyXG5cclxuXHRcdFx0aWYgKCAhIGludGVydmFscyB8fCBpbnRlcnZhbHMubGVuZ3RoID09PSAwICl7XHJcblx0XHRcdFx0cmV0dXJuIFtdO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgbWVyZ2VkID0gW107XHJcblx0XHRcdGludGVydmFscy5zb3J0KCBmdW5jdGlvbiAoIGEsIGIgKXtcclxuXHRcdFx0XHRyZXR1cm4gYVsgMCBdIC0gYlsgMCBdO1xyXG5cdFx0XHR9ICk7XHJcblxyXG5cdFx0XHR2YXIgbWVyZ2VkSW50ZXJ2YWwgPSBpbnRlcnZhbHNbIDAgXTtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMTsgaSA8IGludGVydmFscy5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRcdHZhciBpbnRlcnZhbCA9IGludGVydmFsc1sgaSBdO1xyXG5cclxuXHRcdFx0XHRpZiAoIGludGVydmFsWyAwIF0gPD0gbWVyZ2VkSW50ZXJ2YWxbIDEgXSApe1xyXG5cdFx0XHRcdFx0bWVyZ2VkSW50ZXJ2YWxbIDEgXSA9IE1hdGgubWF4KCBtZXJnZWRJbnRlcnZhbFsgMSBdLCBpbnRlcnZhbFsgMSBdICk7XHJcblx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdG1lcmdlZC5wdXNoKCBtZXJnZWRJbnRlcnZhbCApO1xyXG5cdFx0XHRcdFx0bWVyZ2VkSW50ZXJ2YWwgPSBpbnRlcnZhbDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG1lcmdlZC5wdXNoKCBtZXJnZWRJbnRlcnZhbCApO1xyXG5cdFx0XHRyZXR1cm4gbWVyZ2VkO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIDIgaW50ZXJ2YWxzIGludGVyc2VjdGVkOiAgICAgICBbMzYwMTEsIDg2MzkyXSAgICA8PT4gICAgWzEsIDQzMTkyXSAgPT4gIHRydWUgICAgICAoIGludGVyc2VjdGVkIClcclxuXHRcdCAqXHJcblx0XHQgKiBHb29kIGV4cGxhbmF0aW9uICBoZXJlIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzMyNjk0MzQvd2hhdHMtdGhlLW1vc3QtZWZmaWNpZW50LXdheS10by10ZXN0LWlmLXR3by1yYW5nZXMtb3ZlcmxhcFxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSAgaW50ZXJ2YWxfQSAgIC0gWyAzNjAxMSwgODYzOTIgXVxyXG5cdFx0ICogQHBhcmFtICBpbnRlcnZhbF9CICAgLSBbICAgICAxLCA0MzE5MiBdXHJcblx0XHQgKlxyXG5cdFx0ICogQHJldHVybiBib29sXHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaW50ZXJ2YWxzX19pc19pbnRlcnNlY3RlZCggaW50ZXJ2YWxfQSwgaW50ZXJ2YWxfQiApIHtcclxuXHJcblx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCggMCA9PSBpbnRlcnZhbF9BLmxlbmd0aCApXHJcblx0XHRcdFx0IHx8ICggMCA9PSBpbnRlcnZhbF9CLmxlbmd0aCApXHJcblx0XHRcdCl7XHJcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpbnRlcnZhbF9BWyAwIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQVsgMCBdICk7XHJcblx0XHRcdGludGVydmFsX0FbIDEgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9BWyAxIF0gKTtcclxuXHRcdFx0aW50ZXJ2YWxfQlsgMCBdID0gcGFyc2VJbnQoIGludGVydmFsX0JbIDAgXSApO1xyXG5cdFx0XHRpbnRlcnZhbF9CWyAxIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQlsgMSBdICk7XHJcblxyXG5cdFx0XHR2YXIgaXNfaW50ZXJzZWN0ZWQgPSBNYXRoLm1heCggaW50ZXJ2YWxfQVsgMCBdLCBpbnRlcnZhbF9CWyAwIF0gKSAtIE1hdGgubWluKCBpbnRlcnZhbF9BWyAxIF0sIGludGVydmFsX0JbIDEgXSApO1xyXG5cclxuXHRcdFx0Ly8gaWYgKCAwID09IGlzX2ludGVyc2VjdGVkICkge1xyXG5cdFx0XHQvL1x0ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gU3VjaCByYW5nZXMgZ29pbmcgb25lIGFmdGVyIG90aGVyLCBlLmcuOiBbIDEyLCAxNSBdIGFuZCBbIDE1LCAyMSBdXHJcblx0XHRcdC8vIH1cclxuXHJcblx0XHRcdGlmICggaXNfaW50ZXJzZWN0ZWQgPCAwICkge1xyXG5cdFx0XHRcdHJldHVybiB0cnVlOyAgICAgICAgICAgICAgICAgICAgIC8vIElOVEVSU0VDVEVEXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBmYWxzZTsgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vdCBpbnRlcnNlY3RlZFxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEdldCB0aGUgY2xvc2V0cyBBQlMgdmFsdWUgb2YgZWxlbWVudCBpbiBhcnJheSB0byB0aGUgY3VycmVudCBteVZhbHVlXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIG15VmFsdWUgXHQtIGludCBlbGVtZW50IHRvIHNlYXJjaCBjbG9zZXQgXHRcdFx0NFxyXG5cdFx0ICogQHBhcmFtIG15QXJyYXlcdC0gYXJyYXkgb2YgZWxlbWVudHMgd2hlcmUgdG8gc2VhcmNoIFx0WzUsOCwxLDddXHJcblx0XHQgKiBAcmV0dXJucyBpbnRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQ1XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfZ2V0X2Fic19jbG9zZXN0X3ZhbHVlX2luX2FyciggbXlWYWx1ZSwgbXlBcnJheSApe1xyXG5cclxuXHRcdFx0aWYgKCBteUFycmF5Lmxlbmd0aCA9PSAwICl7IFx0XHRcdFx0XHRcdFx0XHQvLyBJZiB0aGUgYXJyYXkgaXMgZW1wdHkgLT4gcmV0dXJuICB0aGUgbXlWYWx1ZVxyXG5cdFx0XHRcdHJldHVybiBteVZhbHVlO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgb2JqID0gbXlBcnJheVsgMCBdO1xyXG5cdFx0XHR2YXIgZGlmZiA9IE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICk7ICAgICAgICAgICAgIFx0Ly8gR2V0IGRpc3RhbmNlIGJldHdlZW4gIDFzdCBlbGVtZW50XHJcblx0XHRcdHZhciBjbG9zZXRWYWx1ZSA9IG15QXJyYXlbIDAgXTsgICAgICAgICAgICAgICAgICAgXHRcdFx0Ly8gU2F2ZSAxc3QgZWxlbWVudFxyXG5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAxOyBpIDwgbXlBcnJheS5sZW5ndGg7IGkrKyApe1xyXG5cdFx0XHRcdG9iaiA9IG15QXJyYXlbIGkgXTtcclxuXHJcblx0XHRcdFx0aWYgKCBNYXRoLmFicyggbXlWYWx1ZSAtIG9iaiApIDwgZGlmZiApeyAgICAgXHRcdFx0Ly8gd2UgZm91bmQgY2xvc2VyIHZhbHVlIC0+IHNhdmUgaXRcclxuXHRcdFx0XHRcdGRpZmYgPSBNYXRoLmFicyggbXlWYWx1ZSAtIG9iaiApO1xyXG5cdFx0XHRcdFx0Y2xvc2V0VmFsdWUgPSBvYmo7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gY2xvc2V0VmFsdWU7XHJcblx0XHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgVCBPIE8gTCBUIEkgUCBTICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogRGVmaW5lIHRvb2x0aXAgdG8gc2hvdywgIHdoZW4gIG1vdXNlIG92ZXIgRGF0ZSBpbiBDYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtICB0b29sdGlwX3RleHRcdFx0XHQtIFRleHQgdG8gc2hvd1x0XHRcdFx0J0Jvb2tlZCB0aW1lOiAxMjowMCAtIDEzOjAwPGJyPkNvc3Q6ICQyMC4wMCdcclxuXHQgKiBAcGFyYW0gIHJlc291cmNlX2lkXHRcdFx0LSBJRCBvZiBib29raW5nIHJlc291cmNlXHQnMSdcclxuXHQgKiBAcGFyYW0gIHRkX2NsYXNzXHRcdFx0XHQtIFNRTCBjbGFzc1x0XHRcdFx0XHQnMS05LTIwMjMnXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHRcdFx0XHRcdC0gZGVmaW5lZCB0byBzaG93IG9yIG5vdFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfc2V0X3Rvb2x0aXBfX19mb3JfX2NhbGVuZGFyX2RhdGUoIHRvb2x0aXBfdGV4dCwgcmVzb3VyY2VfaWQsIHRkX2NsYXNzICl7XHJcblxyXG5cdFx0Ly9UT0RPOiBtYWtlIGVzY2FwaW5nIG9mIHRleHQgZm9yIHF1b3Qgc3ltYm9scywgIGFuZCBKUy9IVE1MLi4uXHJcblxyXG5cdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIHRkLmNhbDRkYXRlLScgKyB0ZF9jbGFzcyApLmF0dHIoICdkYXRhLWNvbnRlbnQnLCB0b29sdGlwX3RleHQgKTtcclxuXHJcblx0XHR2YXIgdGRfZWwgPSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICkuZ2V0KCAwICk7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjAuMS4xLlxyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKHRkX2VsKSApXHJcblx0XHRcdCYmICggdW5kZWZpbmVkID09IHRkX2VsLl90aXBweSApXHJcblx0XHRcdCYmICggJycgIT09IHRvb2x0aXBfdGV4dCApXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0d3BiY190aXBweSggdGRfZWwgLCB7XHJcblx0XHRcdFx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBwb3BvdmVyX2NvbnRlbnQgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb250ZW50JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuICc8ZGl2IGNsYXNzPVwicG9wb3ZlciBwb3BvdmVyX3RpcHB5XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jb250ZW50XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgcG9wb3Zlcl9jb250ZW50XHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHQgKyAnPC9kaXY+JztcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRhbGxvd0hUTUwgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRyaWdnZXJcdFx0XHQgOiAnbW91c2VlbnRlciBmb2N1cycsXHJcblx0XHRcdFx0XHRpbnRlcmFjdGl2ZSAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRoaWRlT25DbGljayAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdFx0XHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHRcdFx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktdGltZXMnLFxyXG5cdFx0XHRcdFx0cGxhY2VtZW50ICAgICAgICA6ICd0b3AnLFxyXG5cdFx0XHRcdFx0ZGVsYXlcdFx0XHQgOiBbNDAwLCAwXSxcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS40LjIuMi5cclxuXHRcdFx0XHRcdC8vZGVsYXlcdFx0XHQgOiBbMCwgOTk5OTk5OTk5OV0sXHRcdFx0XHRcdFx0Ly8gRGVidWdlICB0b29sdGlwXHJcblx0XHRcdFx0XHRpZ25vcmVBdHRyaWJ1dGVzIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRvdWNoXHRcdFx0IDogdHJ1ZSxcdFx0XHRcdFx0XHRcdFx0Ly9bJ2hvbGQnLCA1MDBdLCAvLyA1MDBtcyBkZWxheVx0XHRcdFx0Ly8gRml4SW46IDkuMi4xLjUuXHJcblx0XHRcdFx0XHRhcHBlbmRUbzogKCkgPT4gZG9jdW1lbnQuYm9keSxcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuICBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgRGF0ZXMgRnVuY3Rpb25zICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBHZXQgbnVtYmVyIG9mIGRhdGVzIGJldHdlZW4gMiBKUyBEYXRlc1xyXG4gKlxyXG4gKiBAcGFyYW0gZGF0ZTFcdFx0SlMgRGF0ZVxyXG4gKiBAcGFyYW0gZGF0ZTJcdFx0SlMgRGF0ZVxyXG4gKiBAcmV0dXJucyB7bnVtYmVyfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kYXRlc19fZGF5c19iZXR3ZWVuKGRhdGUxLCBkYXRlMikge1xyXG5cclxuICAgIC8vIFRoZSBudW1iZXIgb2YgbWlsbGlzZWNvbmRzIGluIG9uZSBkYXlcclxuICAgIHZhciBPTkVfREFZID0gMTAwMCAqIDYwICogNjAgKiAyNDtcclxuXHJcbiAgICAvLyBDb252ZXJ0IGJvdGggZGF0ZXMgdG8gbWlsbGlzZWNvbmRzXHJcbiAgICB2YXIgZGF0ZTFfbXMgPSBkYXRlMS5nZXRUaW1lKCk7XHJcbiAgICB2YXIgZGF0ZTJfbXMgPSBkYXRlMi5nZXRUaW1lKCk7XHJcblxyXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBkaWZmZXJlbmNlIGluIG1pbGxpc2Vjb25kc1xyXG4gICAgdmFyIGRpZmZlcmVuY2VfbXMgPSAgZGF0ZTFfbXMgLSBkYXRlMl9tcztcclxuXHJcbiAgICAvLyBDb252ZXJ0IGJhY2sgdG8gZGF5cyBhbmQgcmV0dXJuXHJcbiAgICByZXR1cm4gTWF0aC5yb3VuZChkaWZmZXJlbmNlX21zL09ORV9EQVkpO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIENoZWNrICBpZiB0aGlzIGFycmF5ICBvZiBkYXRlcyBpcyBjb25zZWN1dGl2ZSBhcnJheSAgb2YgZGF0ZXMgb3Igbm90LlxyXG4gKiBcdFx0ZS5nLiAgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXSAtPiBmYWxzZVxyXG4gKiBcdFx0ZS5nLiAgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xMCcsJzIwMjQtMDUtMTEnXSAtPiB0cnVlXHJcbiAqIEBwYXJhbSBzcWxfZGF0ZXNfYXJyXHQgYXJyYXlcdFx0ZS5nLjogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXVxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGF0ZXNfX2lzX2NvbnNlY3V0aXZlX2RhdGVzX2Fycl9yYW5nZSggc3FsX2RhdGVzX2FyciApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41MC5cclxuXHJcblx0aWYgKCBzcWxfZGF0ZXNfYXJyLmxlbmd0aCA+IDEgKXtcclxuXHRcdHZhciBwcmV2aW9zX2RhdGUgPSB3cGJjX19nZXRfX2pzX2RhdGUoIHNxbF9kYXRlc19hcnJbIDAgXSApO1xyXG5cdFx0dmFyIGN1cnJlbnRfZGF0ZTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBzcWxfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdGN1cnJlbnRfZGF0ZSA9IHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2RhdGVzX2FycltpXSApO1xyXG5cclxuXHRcdFx0aWYgKCB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oIGN1cnJlbnRfZGF0ZSwgcHJldmlvc19kYXRlICkgIT0gMSApe1xyXG5cdFx0XHRcdHJldHVybiAgZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHByZXZpb3NfZGF0ZSA9IGN1cnJlbnRfZGF0ZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgQXV0byBEYXRlcyBTZWxlY3Rpb24gID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqICA9PSBIb3cgdG8gIHVzZSA/ID09XHJcbiAqXHJcbiAqICBGb3IgRGF0ZXMgc2VsZWN0aW9uLCB3ZSBuZWVkIHRvIHVzZSB0aGlzIGxvZ2ljISAgICAgV2UgbmVlZCBzZWxlY3QgdGhlIGRhdGVzIG9ubHkgYWZ0ZXIgYm9va2luZyBkYXRhIGxvYWRlZCFcclxuICpcclxuICogIENoZWNrIGV4YW1wbGUgYmVsbG93LlxyXG4gKlxyXG4gKlx0Ly8gRmlyZSBvbiBhbGwgYm9va2luZyBkYXRlcyBsb2FkZWRcclxuICpcdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiAoIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKXtcclxuICpcclxuICpcdFx0aWYgKCBsb2FkZWRfcmVzb3VyY2VfaWQgPT0gc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkICl7XHJcbiAqXHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkLCAnMjAyNC0wNS0xNScsICcyMDI0LTA1LTI1JyApO1xyXG4gKlx0XHR9XHJcbiAqXHR9ICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuXHJcbi8qKlxyXG4gKiBUcnkgdG8gQXV0byBzZWxlY3QgZGF0ZXMgaW4gc3BlY2lmaWMgY2FsZW5kYXIgYnkgc2ltdWxhdGVkIGNsaWNrcyBpbiBkYXRlcGlja2VyXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHQxXHJcbiAqIEBwYXJhbSBjaGVja19pbl95bWRcdFx0JzIwMjQtMDUtMDknXHRcdE9SICBcdFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTIwJ11cclxuICogQHBhcmFtIGNoZWNrX291dF95bWRcdFx0JzIwMjQtMDUtMTUnXHRcdE9wdGlvbmFsXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHRcdG51bWJlciBvZiBzZWxlY3RlZCBkYXRlc1xyXG4gKlxyXG4gKiBcdEV4YW1wbGUgMTpcdFx0XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIDEsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqIFx0RXhhbXBsZSAyOlx0XHRcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggMSwgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjAnXSApO1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCA9ICcnICl7XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNDcuXHJcblxyXG5cdGNvbnNvbGUubG9nKCAnV1BCQ19BVVRPX1NFTEVDVF9EQVRFU19JTl9DQUxFTkRBUiggUkVTT1VSQ0VfSUQsIENIRUNLX0lOX1lNRCwgQ0hFQ0tfT1VUX1lNRCApJywgcmVzb3VyY2VfaWQsIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCApO1xyXG5cclxuXHRpZiAoXHJcblx0XHQgICAoICcyMTAwLTAxLTAxJyA9PSBjaGVja19pbl95bWQgKVxyXG5cdFx0fHwgKCAnMjEwMC0wMS0wMScgPT0gY2hlY2tfb3V0X3ltZCApXHJcblx0XHR8fCAoICggJycgPT0gY2hlY2tfaW5feW1kICkgJiYgKCAnJyA9PSBjaGVja19vdXRfeW1kICkgKVxyXG5cdCl7XHJcblx0XHRyZXR1cm4gMDtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gSWYgXHRjaGVja19pbl95bWQgID0gIFsgJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCcgXVx0XHRcdFx0QVJSQVkgb2YgREFURVNcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGRhdGVzX3RvX3NlbGVjdF9hcnIgPSBbXTtcclxuXHRpZiAoIEFycmF5LmlzQXJyYXkoIGNoZWNrX2luX3ltZCApICl7XHJcblx0XHRkYXRlc190b19zZWxlY3RfYXJyID0gd3BiY19jbG9uZV9vYmooIGNoZWNrX2luX3ltZCApO1xyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdC8vIEV4Y2VwdGlvbnMgdG8gIHNldCAgXHRNVUxUSVBMRSBEQVlTIFx0bW9kZVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gaWYgZGF0ZXMgYXMgTk9UIENPTlNFQ1VUSVZFOiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddLCAtPiBzZXQgTVVMVElQTEUgREFZUyBtb2RlXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGggPiAwIClcclxuXHRcdFx0JiYgKCAnJyA9PSBjaGVja19vdXRfeW1kIClcclxuXHRcdFx0JiYgKCAhIHdwYmNfZGF0ZXNfX2lzX2NvbnNlY3V0aXZlX2RhdGVzX2Fycl9yYW5nZSggZGF0ZXNfdG9fc2VsZWN0X2FyciApIClcclxuXHRcdCl7XHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdH1cclxuXHRcdC8vIGlmIG11bHRpcGxlIGRheXMgdG8gc2VsZWN0LCBidXQgZW5hYmxlZCBTSU5HTEUgZGF5IG1vZGUsIC0+IHNldCBNVUxUSVBMRSBEQVlTIG1vZGVcclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDEgKVxyXG5cdFx0XHQmJiAoICcnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0XHQmJiAoICdzaW5nbGUnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Y2hlY2tfaW5feW1kID0gZGF0ZXNfdG9fc2VsZWN0X2FyclsgMCBdO1xyXG5cdFx0aWYgKCAnJyA9PSBjaGVja19vdXRfeW1kICl7XHJcblx0XHRcdGNoZWNrX291dF95bWQgPSBkYXRlc190b19zZWxlY3RfYXJyWyAoZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGgtMSkgXTtcclxuXHRcdH1cclxuXHR9XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdGlmICggJycgPT0gY2hlY2tfaW5feW1kICl7XHJcblx0XHRjaGVja19pbl95bWQgPSBjaGVja19vdXRfeW1kO1xyXG5cdH1cclxuXHRpZiAoICcnID09IGNoZWNrX291dF95bWQgKXtcclxuXHRcdGNoZWNrX291dF95bWQgPSBjaGVja19pbl95bWQ7XHJcblx0fVxyXG5cclxuXHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHJlc291cmNlX2lkKSApe1xyXG5cdFx0cmVzb3VyY2VfaWQgPSAnMSc7XHJcblx0fVxyXG5cclxuXHJcblx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0aWYgKCBudWxsICE9PSBpbnN0ICl7XHJcblxyXG5cdFx0Ly8gVW5zZWxlY3QgYWxsIGRhdGVzIGFuZCBzZXQgIHByb3BlcnRpZXMgb2YgRGF0ZXBpY2tcclxuXHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoICcnICk7ICAgICAgXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDUuNC4zXHJcblx0XHRpbnN0LnN0YXlPcGVuID0gZmFsc2U7XHJcblx0XHRpbnN0LmRhdGVzID0gW107XHJcblx0XHR2YXIgY2hlY2tfaW5fanMgPSB3cGJjX19nZXRfX2pzX2RhdGUoIGNoZWNrX2luX3ltZCApO1xyXG5cdFx0dmFyIHRkX2NlbGwgICAgID0gd3BiY19nZXRfY2xpY2tlZF90ZCggaW5zdC5pZCwgY2hlY2tfaW5fanMgKTtcclxuXHJcblx0XHQvLyBJcyBvbWUgdHlwZSBvZiBlcnJvciwgdGhlbiBzZWxlY3QgbXVsdGlwbGUgZGF5cyBzZWxlY3Rpb24gIG1vZGUuXHJcblx0XHRpZiAoICcnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKSB7XHJcbiBcdFx0XHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnLCAnbXVsdGlwbGUnICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IERZTkFNSUMgPT1cclxuXHRcdGlmICggJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdFx0Ly8gMS1zdCBjbGlja1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gZmFsc2U7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsLCAnIycgKyBpbnN0LmlkLCBjaGVja19pbl9qcy5nZXRUaW1lKCkgKTtcclxuXHRcdFx0aWYgKCAwID09PSBpbnN0LmRhdGVzLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVybiAwOyAgXHRcdFx0XHRcdFx0XHRcdC8vIEZpcnN0IGNsaWNrICB3YXMgdW5zdWNjZXNzZnVsLCBzbyB3ZSBtdXN0IG5vdCBtYWtlIG90aGVyIGNsaWNrXHJcblx0XHRcdH1cclxuXHJcblx0XHRcdC8vIDItbmQgY2xpY2tcclxuXHRcdFx0dmFyIGNoZWNrX291dF9qcyA9IHdwYmNfX2dldF9fanNfZGF0ZSggY2hlY2tfb3V0X3ltZCApO1xyXG5cdFx0XHR2YXIgdGRfY2VsbF9vdXQgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19vdXRfanMgKTtcclxuXHRcdFx0aW5zdC5zdGF5T3BlbiA9IHRydWU7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsX291dCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfb3V0X2pzLmdldFRpbWUoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IEZJWEVEID09XHJcblx0XHRpZiAoICAnZml4ZWQnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkpIHtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IFNJTkdMRSA9PVxyXG5cdFx0aWYgKCAnc2luZ2xlJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRcdC8valF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBjaGVja19pbl9qcywgbnVsbCApICk7XHRcdC8vIERvIHdlIG5lZWQgdG8gcnVuICB0aGlzID8gUGxlYXNlIG5vdGUsIGNoZWNrX2luX2pzIG11c3QgIGhhdmUgdGltZSwgIG1pbiwgc2VjIGRlZmluZWQgdG8gMCFcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gID09IE1VTFRJUExFID09XHJcblx0XHRpZiAoICdtdWx0aXBsZScgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cclxuXHRcdFx0dmFyIGRhdGVzX2FycjtcclxuXHJcblx0XHRcdGlmICggZGF0ZXNfdG9fc2VsZWN0X2Fyci5sZW5ndGggPiAwICl7XHJcblx0XHRcdFx0Ly8gU2l0dWF0aW9uLCB3aGVuIHdlIGhhdmUgZGF0ZXMgYXJyYXk6IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ10uICBhbmQgbm90IHRoZSBDaGVjayBJbiAvIENoZWNrICBvdXQgZGF0ZXMgYXMgcGFyYW1ldGVyIGluIHRoaXMgZnVuY3Rpb25cclxuXHRcdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9hcnIoIGRhdGVzX3RvX3NlbGVjdF9hcnIgKTtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRkYXRlc19hcnIgPSB3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9jaGVja19pbl9vdXQoIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCwgaW5zdCApO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRpZiAoIDAgPT09IGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGggKXtcclxuXHRcdFx0XHRyZXR1cm4gMDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gRm9yIENhbGVuZGFyIERheXMgc2VsZWN0aW9uXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGg7IGorKyApeyAgICAgICAvLyBMb29wIGFycmF5IG9mIGRhdGVzXHJcblxyXG5cdFx0XHRcdHZhciBzdHJfZGF0ZSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGVzX2Fyci5kYXRlc19qc1sgaiBdICk7XHJcblxyXG5cdFx0XHRcdC8vIERhdGUgdW5hdmFpbGFibGUgIVxyXG5cdFx0XHRcdGlmICggMCA9PSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3RyX2RhdGUgKS5kYXlfYXZhaWxhYmlsaXR5ICl7XHJcblx0XHRcdFx0XHRyZXR1cm4gMDtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdGlmICggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gIT0gLTEgKSB7XHJcblx0XHRcdFx0XHRpbnN0LmRhdGVzLnB1c2goIGRhdGVzX2Fyci5kYXRlc19qc1sgaiBdICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR2YXIgY2hlY2tfb3V0X2RhdGUgPSBkYXRlc19hcnIuZGF0ZXNfanNbIChkYXRlc19hcnIuZGF0ZXNfanMubGVuZ3RoIC0gMSkgXTtcclxuXHJcblx0XHRcdGluc3QuZGF0ZXMucHVzaCggY2hlY2tfb3V0X2RhdGUgKTsgXHRcdFx0Ly8gTmVlZCBhZGQgb25lIGFkZGl0aW9uYWwgU0FNRSBkYXRlIGZvciBjb3JyZWN0ICB3b3JrcyBvZiBkYXRlcyBzZWxlY3Rpb24gISEhISFcclxuXHJcblx0XHRcdHZhciBjaGVja291dF90aW1lc3RhbXAgPSBjaGVja19vdXRfZGF0ZS5nZXRUaW1lKCk7XHJcblx0XHRcdHZhciB0ZF9jZWxsID0gd3BiY19nZXRfY2xpY2tlZF90ZCggaW5zdC5pZCwgY2hlY2tfb3V0X2RhdGUgKTtcclxuXHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2VsZWN0RGF5KCB0ZF9jZWxsLCAnIycgKyBpbnN0LmlkLCBjaGVja291dF90aW1lc3RhbXAgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0aWYgKCAwICE9PSBpbnN0LmRhdGVzLmxlbmd0aCApe1xyXG5cdFx0XHQvLyBTY3JvbGwgdG8gc3BlY2lmaWMgbW9udGgsIGlmIHdlIHNldCBkYXRlcyBpbiBzb21lIGZ1dHVyZSBtb250aHNcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fc2Nyb2xsX3RvKCByZXNvdXJjZV9pZCwgaW5zdC5kYXRlc1sgMCBdLmdldEZ1bGxZZWFyKCksIGluc3QuZGF0ZXNbIDAgXS5nZXRNb250aCgpKzEgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gaW5zdC5kYXRlcy5sZW5ndGg7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gMDtcclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgSFRNTCB0ZCBlbGVtZW50ICh3aGVyZSB3YXMgY2xpY2sgaW4gY2FsZW5kYXIgIGRheSAgY2VsbClcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBjYWxlbmRhcl9odG1sX2lkXHRcdFx0J2NhbGVuZGFyX2Jvb2tpbmcxJ1xyXG5cdCAqIEBwYXJhbSBkYXRlX2pzXHRcdFx0XHRcdEpTIERhdGVcclxuXHQgKiBAcmV0dXJucyB7KnxqUXVlcnl9XHRcdFx0XHREb20gSFRNTCB0ZCBlbGVtZW50XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfY2xpY2tlZF90ZCggY2FsZW5kYXJfaHRtbF9pZCwgZGF0ZV9qcyApe1xyXG5cclxuXHQgICAgdmFyIHRkX2NlbGwgPSBqUXVlcnkoICcjJyArIGNhbGVuZGFyX2h0bWxfaWQgKyAnIC5zcWxfZGF0ZV8nICsgd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZV9qcyApICkuZ2V0KCAwICk7XHJcblxyXG5cdFx0cmV0dXJuIHRkX2NlbGw7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYXJyYXlzIG9mIEpTIGFuZCBTUUwgZGF0ZXMgYXMgZGF0ZXMgYXJyYXlcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBjaGVja19pbl95bWRcdFx0XHRcdFx0XHRcdCcyMDI0LTA1LTE1J1xyXG5cdCAqIEBwYXJhbSBjaGVja19vdXRfeW1kXHRcdFx0XHRcdFx0XHQnMjAyNC0wNS0yNSdcclxuXHQgKiBAcGFyYW0gaW5zdFx0XHRcdFx0XHRcdFx0XHRcdERhdGVwaWNrIEluc3QuIFVzZSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHQgKiBAcmV0dXJucyB7e2RhdGVzX2pzOiAqW10sIGRhdGVzX3N0cjogKltdfX1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9jaGVja19pbl9vdXQoIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCAsIGluc3QgKXtcclxuXHJcblx0XHR2YXIgb3JpZ2luYWxfYXJyYXkgPSBbXTtcclxuXHRcdHZhciBkYXRlO1xyXG5cdFx0dmFyIGJrX2Rpc3RpbmN0X2RhdGVzID0gW107XHJcblxyXG5cdFx0dmFyIGNoZWNrX2luX2RhdGUgPSBjaGVja19pbl95bWQuc3BsaXQoICctJyApO1xyXG5cdFx0dmFyIGNoZWNrX291dF9kYXRlID0gY2hlY2tfb3V0X3ltZC5zcGxpdCggJy0nICk7XHJcblxyXG5cdFx0ZGF0ZSA9IG5ldyBEYXRlKCk7XHJcblx0XHRkYXRlLnNldEZ1bGxZZWFyKCBjaGVja19pbl9kYXRlWyAwIF0sIChjaGVja19pbl9kYXRlWyAxIF0gLSAxKSwgY2hlY2tfaW5fZGF0ZVsgMiBdICk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8geWVhciwgbW9udGgsIGRhdGVcclxuXHRcdHZhciBvcmlnaW5hbF9jaGVja19pbl9kYXRlID0gZGF0ZTtcclxuXHRcdG9yaWdpbmFsX2FycmF5LnB1c2goIGpRdWVyeS5kYXRlcGljay5fcmVzdHJpY3RNaW5NYXgoIGluc3QsIGpRdWVyeS5kYXRlcGljay5fZGV0ZXJtaW5lRGF0ZSggaW5zdCwgZGF0ZSwgbnVsbCApICkgKTsgLy9hZGQgZGF0ZVxyXG5cdFx0aWYgKCAhIHdwYmNfaW5fYXJyYXkoIGJrX2Rpc3RpbmN0X2RhdGVzLCAoY2hlY2tfaW5fZGF0ZVsgMiBdICsgJy4nICsgY2hlY2tfaW5fZGF0ZVsgMSBdICsgJy4nICsgY2hlY2tfaW5fZGF0ZVsgMCBdKSApICl7XHJcblx0XHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnB1c2goIHBhcnNlSW50KGNoZWNrX2luX2RhdGVbIDIgXSkgKyAnLicgKyBwYXJzZUludChjaGVja19pbl9kYXRlWyAxIF0pICsgJy4nICsgY2hlY2tfaW5fZGF0ZVsgMCBdICk7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGRhdGVfb3V0ID0gbmV3IERhdGUoKTtcclxuXHRcdGRhdGVfb3V0LnNldEZ1bGxZZWFyKCBjaGVja19vdXRfZGF0ZVsgMCBdLCAoY2hlY2tfb3V0X2RhdGVbIDEgXSAtIDEpLCBjaGVja19vdXRfZGF0ZVsgMiBdICk7ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8geWVhciwgbW9udGgsIGRhdGVcclxuXHRcdHZhciBvcmlnaW5hbF9jaGVja19vdXRfZGF0ZSA9IGRhdGVfb3V0O1xyXG5cclxuXHRcdHZhciBtZXdEYXRlID0gbmV3IERhdGUoIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RnVsbFllYXIoKSwgb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXRNb250aCgpLCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldERhdGUoKSApO1xyXG5cdFx0bWV3RGF0ZS5zZXREYXRlKCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHJcblx0XHR3aGlsZSAoXHJcblx0XHRcdChvcmlnaW5hbF9jaGVja19vdXRfZGF0ZSA+IGRhdGUpICYmXHJcblx0XHRcdChvcmlnaW5hbF9jaGVja19pbl9kYXRlICE9IG9yaWdpbmFsX2NoZWNrX291dF9kYXRlKSApe1xyXG5cdFx0XHRkYXRlID0gbmV3IERhdGUoIG1ld0RhdGUuZ2V0RnVsbFllYXIoKSwgbWV3RGF0ZS5nZXRNb250aCgpLCBtZXdEYXRlLmdldERhdGUoKSApO1xyXG5cclxuXHRcdFx0b3JpZ2luYWxfYXJyYXkucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBkYXRlLCBudWxsICkgKSApOyAvL2FkZCBkYXRlXHJcblx0XHRcdGlmICggIXdwYmNfaW5fYXJyYXkoIGJrX2Rpc3RpbmN0X2RhdGVzLCAoZGF0ZS5nZXREYXRlKCkgKyAnLicgKyBwYXJzZUludCggZGF0ZS5nZXRNb250aCgpICsgMSApICsgJy4nICsgZGF0ZS5nZXRGdWxsWWVhcigpKSApICl7XHJcblx0XHRcdFx0YmtfZGlzdGluY3RfZGF0ZXMucHVzaCggKHBhcnNlSW50KGRhdGUuZ2V0RGF0ZSgpKSArICcuJyArIHBhcnNlSW50KCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLicgKyBkYXRlLmdldEZ1bGxZZWFyKCkpICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdG1ld0RhdGUgPSBuZXcgRGF0ZSggZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpICk7XHJcblx0XHRcdG1ld0RhdGUuc2V0RGF0ZSggbWV3RGF0ZS5nZXREYXRlKCkgKyAxICk7XHJcblx0XHR9XHJcblx0XHRvcmlnaW5hbF9hcnJheS5wb3AoKTtcclxuXHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnBvcCgpO1xyXG5cclxuXHRcdHJldHVybiB7J2RhdGVzX2pzJzogb3JpZ2luYWxfYXJyYXksICdkYXRlc19zdHInOiBia19kaXN0aW5jdF9kYXRlc307XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYXJyYXlzIG9mIEpTIGFuZCBTUUwgZGF0ZXMgYXMgZGF0ZXMgYXJyYXlcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlc190b19zZWxlY3RfYXJyXHQ9IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ11cclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHt7ZGF0ZXNfanM6ICpbXSwgZGF0ZXNfc3RyOiAqW119fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2FyciggZGF0ZXNfdG9fc2VsZWN0X2FyciApe1x0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41MC5cclxuXHJcblx0XHR2YXIgb3JpZ2luYWxfYXJyYXkgICAgPSBbXTtcclxuXHRcdHZhciBia19kaXN0aW5jdF9kYXRlcyA9IFtdO1xyXG5cdFx0dmFyIG9uZV9kYXRlX3N0cjtcclxuXHJcblx0XHRmb3IgKCB2YXIgZCA9IDA7IGQgPCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aDsgZCsrICl7XHJcblxyXG5cdFx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCB3cGJjX19nZXRfX2pzX2RhdGUoIGRhdGVzX3RvX3NlbGVjdF9hcnJbIGQgXSApICk7XHJcblxyXG5cdFx0XHRvbmVfZGF0ZV9zdHIgPSBkYXRlc190b19zZWxlY3RfYXJyWyBkIF0uc3BsaXQoJy0nKVxyXG5cdFx0XHRpZiAoICEgd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChvbmVfZGF0ZV9zdHJbIDIgXSArICcuJyArIG9uZV9kYXRlX3N0clsgMSBdICsgJy4nICsgb25lX2RhdGVfc3RyWyAwIF0pICkgKXtcclxuXHRcdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCBwYXJzZUludChvbmVfZGF0ZV9zdHJbIDIgXSkgKyAnLicgKyBwYXJzZUludChvbmVfZGF0ZV9zdHJbIDEgXSkgKyAnLicgKyBvbmVfZGF0ZV9zdHJbIDAgXSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHsnZGF0ZXNfanMnOiBvcmlnaW5hbF9hcnJheSwgJ2RhdGVzX3N0cic6IG9yaWdpbmFsX2FycmF5fTtcclxuXHR9XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLyogID09ICBBdXRvIEZpbGwgRmllbGRzIC8gQXV0byBTZWxlY3QgRGF0ZXMgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHJcblx0dmFyIHVybF9wYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCB3aW5kb3cubG9jYXRpb24uc2VhcmNoICk7XHJcblxyXG5cdC8vIERpc2FibGUgZGF5cyBzZWxlY3Rpb24gIGluIGNhbGVuZGFyLCAgYWZ0ZXIgIHJlZGlyZWN0aW9uICBmcm9tICB0aGUgXCJTZWFyY2ggcmVzdWx0cyBwYWdlLCAgYWZ0ZXIgIHNlYXJjaCAgYXZhaWxhYmlsaXR5XCIgXHRcdFx0Ly8gRml4SW46IDguOC4yLjMuXHJcblx0aWYgICggJ09uJyAhPSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19lbmFibGVkX2Jvb2tpbmdfc2VhcmNoX3Jlc3VsdHNfZGF5c19zZWxlY3QnICkgKSB7XHJcblx0XHRpZiAoXHJcblx0XHRcdCggdXJsX3BhcmFtcy5oYXMoICd3cGJjX3NlbGVjdF9jaGVja19pbicgKSApICYmXHJcblx0XHRcdCggdXJsX3BhcmFtcy5oYXMoICd3cGJjX3NlbGVjdF9jaGVja19vdXQnICkgKSAmJlxyXG5cdFx0XHQoIHVybF9wYXJhbXMuaGFzKCAnd3BiY19zZWxlY3RfY2FsZW5kYXJfaWQnICkgKVxyXG5cdFx0KXtcclxuXHJcblx0XHRcdHZhciBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQgPSBwYXJzZUludCggdXJsX3BhcmFtcy5nZXQoICd3cGJjX3NlbGVjdF9jYWxlbmRhcl9pZCcgKSApO1xyXG5cclxuXHRcdFx0Ly8gRmlyZSBvbiBhbGwgYm9va2luZyBkYXRlcyBsb2FkZWRcclxuXHRcdFx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uICggZXZlbnQsIGxvYWRlZF9yZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdFx0XHRpZiAoIGxvYWRlZF9yZXNvdXJjZV9pZCA9PSBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQgKXtcclxuXHRcdFx0XHRcdHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCwgdXJsX3BhcmFtcy5nZXQoICd3cGJjX3NlbGVjdF9jaGVja19pbicgKSwgdXJsX3BhcmFtcy5nZXQoICd3cGJjX3NlbGVjdF9jaGVja19vdXQnICkgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0gKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggdXJsX3BhcmFtcy5oYXMoICd3cGJjX2F1dG9fZmlsbCcgKSApe1xyXG5cclxuXHRcdHZhciB3cGJjX2F1dG9fZmlsbF92YWx1ZSA9IHVybF9wYXJhbXMuZ2V0KCAnd3BiY19hdXRvX2ZpbGwnICk7XHJcblxyXG5cdFx0Ly8gQ29udmVydCBiYWNrLiAgICAgU29tZSBzeXN0ZW1zIGRvIG5vdCBsaWtlIHN5bWJvbCAnficgaW4gVVJMLCBzbyAgd2UgbmVlZCB0byByZXBsYWNlIHRvICBzb21lIG90aGVyIHN5bWJvbHNcclxuXHRcdHdwYmNfYXV0b19maWxsX3ZhbHVlID0gd3BiY19hdXRvX2ZpbGxfdmFsdWUucmVwbGFjZUFsbCggJ19eXycsICd+JyApO1xyXG5cclxuXHRcdHdwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzKCB3cGJjX2F1dG9fZmlsbF92YWx1ZSApO1xyXG5cdH1cclxuXHJcbn0gKTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvZmlsbCAvIHNlbGVjdCBib29raW5nIGZvcm0gIGZpZWxkcyBieSAgdmFsdWVzIGZyb20gIHRoZSBHRVQgcmVxdWVzdCAgcGFyYW1ldGVyOiA/d3BiY19hdXRvX2ZpbGw9XHJcbiAqXHJcbiAqIEBwYXJhbSBhdXRvX2ZpbGxfc3RyXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkcyggYXV0b19maWxsX3N0ciApe1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC40OC5cclxuXHJcblx0aWYgKCAnJyA9PSBhdXRvX2ZpbGxfc3RyICl7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cclxuLy8gY29uc29sZS5sb2coICdXUEJDX0FVVE9fRklMTF9CT09LSU5HX0ZJRUxEUyggQVVUT19GSUxMX1NUUiApJywgYXV0b19maWxsX3N0cik7XHJcblxyXG5cdHZhciBmaWVsZHNfYXJyID0gd3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHNfX3BhcnNlKCBhdXRvX2ZpbGxfc3RyICk7XHJcblxyXG5cdGZvciAoIGxldCBpID0gMDsgaSA8IGZpZWxkc19hcnIubGVuZ3RoOyBpKysgKXtcclxuXHRcdGpRdWVyeSggJ1tuYW1lPVwiJyArIGZpZWxkc19hcnJbIGkgXVsgJ25hbWUnIF0gKyAnXCJdJyApLnZhbCggZmllbGRzX2FyclsgaSBdWyAndmFsdWUnIF0gKTtcclxuXHR9XHJcbn1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgZGF0YSBmcm9tICBnZXQgcGFyYW1ldGVyOlx0P3dwYmNfYXV0b19maWxsPXZpc2l0b3JzMjMxXjJ+bWF4X2NhcGFjaXR5MjMxXjJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRhX3N0ciAgICAgID0gICAndmlzaXRvcnMyMzFeMn5tYXhfY2FwYWNpdHkyMzFeMic7XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHNfX3BhcnNlKCBkYXRhX3N0ciApe1xyXG5cclxuXHRcdHZhciBmaWx0ZXJfb3B0aW9uc19hcnIgPSBbXTtcclxuXHJcblx0XHR2YXIgZGF0YV9hcnIgPSBkYXRhX3N0ci5zcGxpdCggJ34nICk7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0YV9hcnIubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdHZhciBteV9mb3JtX2ZpZWxkID0gZGF0YV9hcnJbIGogXS5zcGxpdCggJ14nICk7XHJcblxyXG5cdFx0XHR2YXIgZmlsdGVyX25hbWUgID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDAgXSkpID8gbXlfZm9ybV9maWVsZFsgMCBdIDogJyc7XHJcblx0XHRcdHZhciBmaWx0ZXJfdmFsdWUgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMSBdKSkgPyBteV9mb3JtX2ZpZWxkWyAxIF0gOiAnJztcclxuXHJcblx0XHRcdGZpbHRlcl9vcHRpb25zX2Fyci5wdXNoKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCduYW1lJyAgOiBmaWx0ZXJfbmFtZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZScgOiBmaWx0ZXJfdmFsdWVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHQgICApO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZpbHRlcl9vcHRpb25zX2FycjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFBhcnNlIGRhdGEgZnJvbSAgZ2V0IHBhcmFtZXRlcjpcdD9zZWFyY2hfZ2V0X19jdXN0b21fcGFyYW1zPS4uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGFfc3RyICAgICAgPSAgICd0ZXh0XnNlYXJjaF9maWVsZF9fZGlzcGxheV9jaGVja19pbl4yMy4wNS4yMDI0fnRleHRec2VhcmNoX2ZpZWxkX19kaXNwbGF5X2NoZWNrX291dF4yNi4wNS4yMDI0fnNlbGVjdGJveC1vbmVec2VhcmNoX3F1YW50aXR5XjJ+c2VsZWN0Ym94LW9uZV5sb2NhdGlvbl5TcGFpbn5zZWxlY3Rib3gtb25lXm1heF9jYXBhY2l0eV4yfnNlbGVjdGJveC1vbmVeYW1lbml0eV5wYXJraW5nfmNoZWNrYm94XnNlYXJjaF9maWVsZF9fZXh0ZW5kX3NlYXJjaF9kYXlzXjV+c3VibWl0Xl5TZWFyY2h+aGlkZGVuXnNlYXJjaF9nZXRfX2NoZWNrX2luX3ltZF4yMDI0LTA1LTIzfmhpZGRlbl5zZWFyY2hfZ2V0X19jaGVja19vdXRfeW1kXjIwMjQtMDUtMjZ+aGlkZGVuXnNlYXJjaF9nZXRfX3RpbWVefmhpZGRlbl5zZWFyY2hfZ2V0X19xdWFudGl0eV4yfmhpZGRlbl5zZWFyY2hfZ2V0X19leHRlbmReNX5oaWRkZW5ec2VhcmNoX2dldF9fdXNlcnNfaWRefmhpZGRlbl5zZWFyY2hfZ2V0X19jdXN0b21fcGFyYW1zXn4nO1xyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfYXV0b19maWxsX3NlYXJjaF9maWVsZHNfX3BhcnNlKCBkYXRhX3N0ciApe1xyXG5cclxuXHRcdHZhciBmaWx0ZXJfb3B0aW9uc19hcnIgPSBbXTtcclxuXHJcblx0XHR2YXIgZGF0YV9hcnIgPSBkYXRhX3N0ci5zcGxpdCggJ34nICk7XHJcblxyXG5cdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0YV9hcnIubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdHZhciBteV9mb3JtX2ZpZWxkID0gZGF0YV9hcnJbIGogXS5zcGxpdCggJ14nICk7XHJcblxyXG5cdFx0XHR2YXIgZmlsdGVyX3R5cGUgID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDAgXSkpID8gbXlfZm9ybV9maWVsZFsgMCBdIDogJyc7XHJcblx0XHRcdHZhciBmaWx0ZXJfbmFtZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMSBdKSkgPyBteV9mb3JtX2ZpZWxkWyAxIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl92YWx1ZSA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAyIF0pKSA/IG15X2Zvcm1fZmllbGRbIDIgXSA6ICcnO1xyXG5cclxuXHRcdFx0ZmlsdGVyX29wdGlvbnNfYXJyLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICA6IGZpbHRlcl90eXBlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICA6IGZpbHRlcl9uYW1lLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlJyA6IGZpbHRlcl92YWx1ZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCAgICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmlsdGVyX29wdGlvbnNfYXJyO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBBdXRvIFVwZGF0ZSBudW1iZXIgb2YgbW9udGhzIGluIGNhbGVuZGFycyBPTiBzY3JlZW4gc2l6ZSBjaGFuZ2VkICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcbi8qKlxyXG4gKiBBdXRvIFVwZGF0ZSBOdW1iZXIgb2YgTW9udGhzIGluIENhbGVuZGFyLCBlLmcuOiAgXHRcdGlmICAgICggV0lORE9XX1dJRFRIIDw9IDc4MnB4ICkgICA+Pj4gXHRNT05USFNfTlVNQkVSID0gMVxyXG4gKiAgIEVMU0U6ICBudW1iZXIgb2YgbW9udGhzIGRlZmluZWQgaW4gc2hvcnRjb2RlLlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWQgaW50XHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyX19vbl9yZXNpemUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdGlmICggdHJ1ZSA9PT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfYWxsb3dfc2V2ZXJhbF9tb250aHNfb25fbW9iaWxlJyApICkge1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0dmFyIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID0gcGFyc2VJbnQoIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycgKSApO1xyXG5cclxuXHRpZiAoIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID4gMSApe1xyXG5cclxuXHRcdGlmICggalF1ZXJ5KCB3aW5kb3cgKS53aWR0aCgpIDw9IDc4MiApe1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIDEgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9tb250aHNfbnVtYmVyKCByZXNvdXJjZV9pZCwgbG9jYWxfX251bWJlcl9vZl9tb250aHMgKTtcclxuXHRcdH1cclxuXHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogQXV0byBVcGRhdGUgTnVtYmVyIG9mIE1vbnRocyBpbiAgIEFMTCAgIENhbGVuZGFyc1xyXG4gKlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcnNfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXIoKXtcclxuXHJcblx0dmFyIGFsbF9jYWxlbmRhcnNfYXJyID0gX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0KCk7XHJcblxyXG5cdC8vIFRoaXMgTE9PUCBcImZvciBpblwiIGlzIEdPT0QsIGJlY2F1c2Ugd2UgY2hlY2sgIGhlcmUga2V5cyAgICAnY2FsZW5kYXJfJyA9PT0gY2FsZW5kYXJfaWQuc2xpY2UoIDAsIDkgKVxyXG5cdGZvciAoIHZhciBjYWxlbmRhcl9pZCBpbiBhbGxfY2FsZW5kYXJzX2FyciApe1xyXG5cdFx0aWYgKCAnY2FsZW5kYXJfJyA9PT0gY2FsZW5kYXJfaWQuc2xpY2UoIDAsIDkgKSApe1xyXG5cdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSBwYXJzZUludCggY2FsZW5kYXJfaWQuc2xpY2UoIDkgKSApO1x0XHRcdC8vICAnY2FsZW5kYXJfMycgLT4gM1xyXG5cdFx0XHRpZiAoIHJlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXJfX29uX3Jlc2l6ZSggcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxufVxyXG5cclxuLyoqXHJcbiAqIElmIGJyb3dzZXIgd2luZG93IGNoYW5nZWQsICB0aGVuICB1cGRhdGUgbnVtYmVyIG9mIG1vbnRocy5cclxuICovXHJcbmpRdWVyeSggd2luZG93ICkub24oICdyZXNpemUnLCBmdW5jdGlvbiAoKXtcclxuXHR3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpO1xyXG59ICk7XHJcblxyXG4vKipcclxuICogQXV0byB1cGRhdGUgY2FsZW5kYXIgbnVtYmVyIG9mIG1vbnRocyBvbiBpbml0aWFsIHBhZ2UgbG9hZFxyXG4gKi9cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHR3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpO1xyXG5cdH0sIDEwMCApO1xyXG59KTsiLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsL2RheXNfc2VsZWN0X2N1c3RvbS5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIEZpeEluOiA5LjguOS4yLlxyXG5cclxuLyoqXHJcbiAqIFJlLUluaXQgQ2FsZW5kYXIgYW5kIFJlLVJlbmRlciBpdC5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gUmVtb3ZlIENMQVNTICBmb3IgYWJpbGl0eSB0byByZS1yZW5kZXIgYW5kIHJlaW5pdCBjYWxlbmRhci5cclxuXHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnaGFzRGF0ZXBpY2snICk7XHJcblx0d3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFJlLUluaXQgcHJldmlvdXNseSAgc2F2ZWQgZGF5cyBzZWxlY3Rpb24gIHZhcmlhYmxlcy5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdzYXZlZF92YXJpYWJsZV9fX2RheXNfc2VsZWN0X2luaXRpYWwnXHJcblx0XHQsIHtcclxuXHRcdFx0J2R5bmFtaWNfX2RheXNfbWluJyAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJyApLFxyXG5cdFx0XHQnZHluYW1pY19fZGF5c19tYXgnICAgICAgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnICksXHJcblx0XHRcdCdkeW5hbWljX19kYXlzX3NwZWNpZmljJyAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJyApLFxyXG5cdFx0XHQnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCc6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcgKSxcclxuXHRcdFx0J2ZpeGVkX19kYXlzX251bScgICAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2ZpeGVkX19kYXlzX251bScgKSxcclxuXHRcdFx0J2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JyAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JyApXHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IFNpbmdsZSBEYXkgc2VsZWN0aW9uIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fc2luZ2xlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCBTaW5nbGUgRGF5IHNlbGVjdGlvblxyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ3NpbmdsZSd9ICk7XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgTXVsdGlwbGUgRGF5cyBzZWxlY3Rpb24gIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2V0IE11bHRpcGxlIERheXMgc2VsZWN0aW9uXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdtdWx0aXBsZSd9ICk7XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IEZpeGVkIERheXMgc2VsZWN0aW9uIHdpdGggIDEgbW91c2UgY2xpY2sgIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICAtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcikgLVxyXG4gKiBAaW50ZWdlciBkYXlzX251bWJlclx0XHRcdC0gM1x0XHRcdFx0ICAgLS0gbnVtYmVyIG9mIGRheXMgdG8gIHNlbGVjdFx0LVxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0LSBbLTFdIHwgWyAxLCA1XSAgIC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19maXhlZCggcmVzb3VyY2VfaWQsIGRheXNfbnVtYmVyLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkKCByZXNvdXJjZV9pZCwgZGF5c19udW1iZXIsIHdlZWtfZGF5c19fc3RhcnQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZXQgRml4ZWQgRGF5cyBzZWxlY3Rpb24gd2l0aCAgMSBtb3VzZSBjbGlja1xyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgLS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpIC1cclxuICogQGludGVnZXIgZGF5c19udW1iZXJcdFx0XHQtIDNcdFx0XHRcdCAgIC0tIG51bWJlciBvZiBkYXlzIHRvICBzZWxlY3RcdC1cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdC0gWy0xXSB8IFsgMSwgNV0gICAtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fZml4ZWQoIHJlc291cmNlX2lkLCBkYXlzX251bWJlciwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ2ZpeGVkJ30gKTtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydmaXhlZF9fZGF5c19udW0nOiBwYXJzZUludCggZGF5c19udW1iZXIgKX0gKTtcdFx0XHQvLyBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAxIG1vdXNlIGNsaWNrXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydmaXhlZF9fd2Vla19kYXlzX19zdGFydCc6IHdlZWtfZGF5c19fc3RhcnR9ICk7IFx0Ly8geyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgUmFuZ2UgRGF5cyBzZWxlY3Rpb24gIHdpdGggIDIgbW91c2UgY2xpY2tzICAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgXHRcdC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKVxyXG4gKiBAaW50ZWdlciBkYXlzX21pblx0XHRcdC0gN1x0XHRcdFx0ICAgXHRcdC0tIE1pbiBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGludGVnZXIgZGF5c19tYXhcdFx0XHQtIDMwXHRcdFx0ICAgXHRcdC0tIE1heCBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGFycmF5IGRheXNfc3BlY2lmaWNcdFx0XHQtIFtdIHwgWzcsMTQsMjEsMjhdXHRcdC0tIFJlc3RyaWN0aW9uIGZvciBTcGVjaWZpYyBudW1iZXIgb2YgZGF5cyBzZWxlY3Rpb25cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdFx0LSBbLTFdIHwgWyAxLCA1XSAgIFx0XHQtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fcmFuZ2UoIHJlc291cmNlX2lkLCBkYXlzX21pbiwgZGF5c19tYXgsIGRheXNfc3BlY2lmaWMgPSBbXSwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYywgd2Vla19kYXlzX19zdGFydCApO1xyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgUmFuZ2UgRGF5cyBzZWxlY3Rpb24gIHdpdGggIDIgbW91c2UgY2xpY2tzXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICBcdFx0LS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpXHJcbiAqIEBpbnRlZ2VyIGRheXNfbWluXHRcdFx0LSA3XHRcdFx0XHQgICBcdFx0LS0gTWluIG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAaW50ZWdlciBkYXlzX21heFx0XHRcdC0gMzBcdFx0XHQgICBcdFx0LS0gTWF4IG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAYXJyYXkgZGF5c19zcGVjaWZpY1x0XHRcdC0gW10gfCBbNywxNCwyMSwyOF1cdFx0LS0gUmVzdHJpY3Rpb24gZm9yIFNwZWNpZmljIG51bWJlciBvZiBkYXlzIHNlbGVjdGlvblxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0XHQtIFstMV0gfCBbIDEsIDVdICAgXHRcdC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYyA9IFtdLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoICByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ2R5bmFtaWMnfSAgKTtcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJyAgICAgICAgICwgcGFyc2VJbnQoIGRheXNfbWluICkgICk7ICAgICAgICAgICBcdFx0Ly8gTWluLiBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAyIG1vdXNlIGNsaWNrc1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnICAgICAgICAgLCBwYXJzZUludCggZGF5c19tYXggKSAgKTsgICAgICAgICAgXHRcdC8vIE1heC4gTnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uIHdpdGggMiBtb3VzZSBjbGlja3NcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnICAgICwgZGF5c19zcGVjaWZpYyAgKTtcdCAgICAgIFx0XHRcdFx0Ly8gRXhhbXBsZSBbNSw3XVxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcgLCB3ZWVrX2RheXNfX3N0YXJ0ICApOyAgXHRcdFx0XHRcdC8vIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG4iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsX2FqeF9sb2FkL3dwYmNfY2FsX2FqeC5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyAgQSBqIGEgeCAgICBMIG8gYSBkICAgIEMgYSBsIGUgbiBkIGEgciAgICBEIGEgdCBhXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIHBhcmFtcyApe1xyXG5cclxuXHQvLyBGaXhJbjogOS44LjYuMi5cclxuXHR3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdGFydCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7XHJcblxyXG5cdC8vIFRyaWdnZXIgZXZlbnQgZm9yIGNhbGVuZGFyIGJlZm9yZSBsb2FkaW5nIEJvb2tpbmcgZGF0YSwgIGJ1dCBhZnRlciBzaG93aW5nIENhbGVuZGFyLlxyXG5cdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcGFyYW1zWydyZXNvdXJjZV9pZCddICkubGVuZ3RoID4gMCApe1xyXG5cdFx0dmFyIHRhcmdldF9lbG0gPSBqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoIFwid3BiY19jYWxlbmRhcl9hanhfX2JlZm9yZV9sb2FkZWRfZGF0YVwiLCBbcGFyYW1zWydyZXNvdXJjZV9pZCddXSApO1xyXG5cdFx0IC8valF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19iZWZvcmVfbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiggZXZlbnQsIHJlc291cmNlX2lkICkgeyAuLi4gfSApO1xyXG5cdH1cclxuXHJcblx0aWYgKCB3cGJjX2JhbGFuY2VyX19pc193YWl0KCBwYXJhbXMgLCAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnICkgKXtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cdC8vIEZpeEluOiA5LjguNi4yLlxyXG5cdHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0b3AoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApO1xyXG5cclxuXHJcbi8vIGNvbnNvbGUuZ3JvdXBFbmQoKTsgY29uc29sZS50aW1lKCdyZXNvdXJjZV9pZF8nICsgcGFyYW1zWydyZXNvdXJjZV9pZCddKTtcclxuY29uc29sZS5ncm91cENvbGxhcHNlZCggJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnICk7IGNvbnNvbGUubG9nKCAnID09IEJlZm9yZSBBamF4IFNlbmQgLSBjYWxlbmRhcnNfYWxsX19nZXQoKSA9PSAnICwgX3dwYmMuY2FsZW5kYXJzX2FsbF9fZ2V0KCkgKTtcclxuXHJcblx0Ly8gU3RhcnQgQWpheFxyXG5cdGpRdWVyeS5wb3N0KCB3cGJjX3VybF9hamF4LFxyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGFjdGlvbiAgICAgICAgICA6ICdXUEJDX0FKWF9DQUxFTkRBUl9MT0FEJyxcclxuXHRcdFx0XHRcdHdwYmNfYWp4X3VzZXJfaWQ6IF93cGJjLmdldF9zZWN1cmVfcGFyYW0oICd1c2VyX2lkJyApLFxyXG5cdFx0XHRcdFx0bm9uY2UgICAgICAgICAgIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ25vbmNlJyApLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfbG9jYWxlIDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ2xvY2FsZScgKSxcclxuXHJcblx0XHRcdFx0XHRjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyA6IHBhcmFtcyBcdFx0XHRcdFx0XHQvLyBVc3VhbGx5IGxpa2U6IHsgJ3Jlc291cmNlX2lkJzogMSwgJ21heF9kYXlzX2NvdW50JzogMzY1IH1cclxuXHRcdFx0XHR9LFxyXG5cclxuXHRcdFx0XHQvKipcclxuXHRcdFx0XHQgKiBTIHUgYyBjIGUgcyBzXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQgKiBAcGFyYW0gcmVzcG9uc2VfZGF0YVx0XHQtXHRpdHMgb2JqZWN0IHJldHVybmVkIGZyb20gIEFqYXggLSBjbGFzcy1saXZlLXNlYXJjaC5waHBcclxuXHRcdFx0XHQgKiBAcGFyYW0gdGV4dFN0YXR1c1x0XHQtXHQnc3VjY2VzcydcclxuXHRcdFx0XHQgKiBAcGFyYW0ganFYSFJcdFx0XHRcdC1cdE9iamVjdFxyXG5cdFx0XHRcdCAqL1xyXG5cdFx0XHRcdGZ1bmN0aW9uICggcmVzcG9uc2VfZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7XHJcbi8vIGNvbnNvbGUudGltZUVuZCgncmVzb3VyY2VfaWRfJyArIHJlc3BvbnNlX2RhdGFbJ3Jlc291cmNlX2lkJ10pO1xyXG5jb25zb2xlLmxvZyggJyA9PSBSZXNwb25zZSBXUEJDX0FKWF9DQUxFTkRBUl9MT0FEID09ICcsIHJlc3BvbnNlX2RhdGEgKTsgY29uc29sZS5ncm91cEVuZCgpO1xyXG5cclxuXHRcdFx0XHRcdC8vIEZpeEluOiA5LjguNi4yLlxyXG5cdFx0XHRcdFx0dmFyIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0d3BiY19iYWxhbmNlcl9fY29tcGxldGVkKCBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCAsICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCcgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0XHR2YXIgbWVzc2FnZV90eXBlID0gJ2luZm8nO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAnJyA9PT0gcmVzcG9uc2VfZGF0YSApe1xyXG5cdFx0XHRcdFx0XHRcdHJlc3BvbnNlX2RhdGEgPSAnVGhlIHNlcnZlciByZXNwb25kcyB3aXRoIGFuIGVtcHR5IHN0cmluZy4gVGhlIHNlcnZlciBwcm9iYWJseSBzdG9wcGVkIHdvcmtpbmcgdW5leHBlY3RlZGx5LiA8YnI+UGxlYXNlIGNoZWNrIHlvdXIgPHN0cm9uZz5lcnJvci5sb2c8L3N0cm9uZz4gaW4geW91ciBzZXJ2ZXIgY29uZmlndXJhdGlvbiBmb3IgcmVsYXRpdmUgZXJyb3JzLic7XHJcblx0XHRcdFx0XHRcdFx0bWVzc2FnZV90eXBlID0gJ3dhcm5pbmcnO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YSAsIHsgJ3R5cGUnICAgICA6IG1lc3NhZ2VfdHlwZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgQ2FsZW5kYXJcclxuXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIEJvb2tpbmdzIC0gRGF0ZXNcclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoICByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsnZGF0ZXMnXSAgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBCb29raW5ncyAtIENoaWxkIG9yIG9ubHkgc2luZ2xlIGJvb2tpbmcgcmVzb3VyY2UgaW4gZGF0ZXNcclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnLCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFnZ3JlZ2F0ZSBib29raW5nIHJlc291cmNlcywgIGlmIGFueSA/XHJcblx0XHRcdFx0XHRfd3BiYy5ib29raW5nX19zZXRfcGFyYW1fdmFsdWUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInLCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJyBdICk7XHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0XHRcdFx0Ly8gVXBkYXRlIGNhbGVuZGFyXHJcblx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0XHQoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXSkgKVxyXG5cdFx0XHRcdFx0XHQgJiYgKCAnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICkgKVxyXG5cdFx0XHRcdFx0KXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHsgICAndHlwZScgICAgIDogKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdICkgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgID8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICdpbmZvJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gVHJpZ2dlciBldmVudCB0aGF0IGNhbGVuZGFyIGhhcyBiZWVuXHRcdCAvLyBGaXhJbjogMTAuMC4wLjQ0LlxyXG5cdFx0XHRcdFx0aWYgKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKS5sZW5ndGggPiAwICl7XHJcblx0XHRcdFx0XHRcdHZhciB0YXJnZXRfZWxtID0galF1ZXJ5KCAnYm9keScgKS50cmlnZ2VyKCBcIndwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YVwiLCBbcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdXSApO1xyXG5cdFx0XHRcdFx0XHQgLy9qUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24oIGV2ZW50LCByZXNvdXJjZV9pZCApIHsgLi4uIH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvL2pRdWVyeSggJyNhamF4X3Jlc3BvbmQnICkuaHRtbCggcmVzcG9uc2VfZGF0YSApO1x0XHQvLyBGb3IgYWJpbGl0eSB0byBzaG93IHJlc3BvbnNlLCBhZGQgc3VjaCBESVYgZWxlbWVudCB0byBwYWdlXHJcblx0XHRcdFx0fVxyXG5cdFx0XHQgICkuZmFpbCggZnVuY3Rpb24gKCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKSB7ICAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnQWpheF9FcnJvcicsIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApOyB9XHJcblxyXG5cdFx0XHRcdFx0dmFyIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0d3BiY19iYWxhbmNlcl9fY29tcGxldGVkKCBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCAsICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCcgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBHZXQgQ29udGVudCBvZiBFcnJvciBNZXNzYWdlXHJcblx0XHRcdFx0XHR2YXIgZXJyb3JfbWVzc2FnZSA9ICc8c3Ryb25nPicgKyAnRXJyb3IhJyArICc8L3N0cm9uZz4gJyArIGVycm9yVGhyb3duIDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAoPGI+JyArIGpxWEhSLnN0YXR1cyArICc8L2I+KSc7XHJcblx0XHRcdFx0XHRcdGlmICg0MDMgPT0ganFYSFIuc3RhdHVzICl7XHJcblx0XHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnPGJyPiBQcm9iYWJseSBub25jZSBmb3IgdGhpcyBwYWdlIGhhcyBiZWVuIGV4cGlyZWQuIFBsZWFzZSA8YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgb25jbGljaz1cImphdmFzY3JpcHQ6bG9jYXRpb24ucmVsb2FkKCk7XCI+cmVsb2FkIHRoZSBwYWdlPC9hPi4nO1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJzxicj4gT3RoZXJ3aXNlLCBwbGVhc2UgY2hlY2sgdGhpcyA8YSBzdHlsZT1cImZvbnQtd2VpZ2h0OiA2MDA7XCIgaHJlZj1cImh0dHBzOi8vd3Bib29raW5nY2FsZW5kYXIuY29tL2ZhcS9yZXF1ZXN0LWRvLW5vdC1wYXNzLXNlY3VyaXR5LWNoZWNrLz9hZnRlcl91cGRhdGU9MTAuMS4xXCI+dHJvdWJsZXNob290aW5nIGluc3RydWN0aW9uPC9hPi48YnI+J1xyXG5cdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR2YXIgbWVzc2FnZV9zaG93X2RlbGF5ID0gMzAwMDtcclxuXHRcdFx0XHRcdGlmICgganFYSFIucmVzcG9uc2VUZXh0ICl7XHJcblx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJyAnICsganFYSFIucmVzcG9uc2VUZXh0O1xyXG5cdFx0XHRcdFx0XHRtZXNzYWdlX3Nob3dfZGVsYXkgPSAxMDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgPSBlcnJvcl9tZXNzYWdlLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApO1xyXG5cclxuXHRcdFx0XHRcdHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdC8qKlxyXG5cdFx0XHRcdFx0ICogSWYgd2UgbWFrZSBmYXN0IGNsaWNraW5nIG9uIGRpZmZlcmVudCBwYWdlcyxcclxuXHRcdFx0XHRcdCAqIHRoZW4gdW5kZXIgY2FsZW5kYXIgd2lsbCBzaG93IGVycm9yIG1lc3NhZ2Ugd2l0aCAgZW1wdHkgIHRleHQsIGJlY2F1c2UgYWpheCB3YXMgbm90IHJlY2VpdmVkLlxyXG5cdFx0XHRcdFx0ICogVG8gIG5vdCBzaG93IHN1Y2ggd2FybmluZ3Mgd2UgYXJlIHNldCBkZWxheSAgaW4gMyBzZWNvbmRzLiAgdmFyIG1lc3NhZ2Vfc2hvd19kZWxheSA9IDMwMDA7XHJcblx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggZXJyb3JfbWVzc2FnZSAsIHsgJ3R5cGUnICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Nzc19jbGFzcyc6J3dwYmNfZmVfbWVzc2FnZV9hbHQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH0gLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgcGFyc2VJbnQoIG1lc3NhZ2Vfc2hvd19kZWxheSApICAgKTtcclxuXHJcblx0XHRcdCAgfSlcclxuXHQgICAgICAgICAgLy8gLmRvbmUoICAgZnVuY3Rpb24gKCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ3NlY29uZCBzdWNjZXNzJywgZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKTsgfSAgICB9KVxyXG5cdFx0XHQgIC8vIC5hbHdheXMoIGZ1bmN0aW9uICggZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdhbHdheXMgZmluaXNoZWQnLCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApOyB9ICAgICB9KVxyXG5cdFx0XHQgIDsgIC8vIEVuZCBBamF4XHJcbn1cclxuXHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vIFN1cHBvcnRcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBDYWxlbmRhciBqUXVlcnkgbm9kZSBmb3Igc2hvd2luZyBtZXNzYWdlcyBkdXJpbmcgQWpheFxyXG5cdCAqIFRoaXMgcGFyYW1ldGVyOiAgIGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXSAgIHBhcnNlZCBmcm9tIHRoaXMuZGF0YSBBamF4IHBvc3QgIGRhdGFcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXNcdFx0ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHQnJyNjYWxlbmRhcl9ib29raW5nMScgIHwgICAnLmJvb2tpbmdfZm9ybV9kaXYnIC4uLlxyXG5cdCAqXHJcblx0ICogRXhhbXBsZSAgICB2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKXtcclxuXHJcblx0XHR2YXIganFfbm9kZSA9ICcuYm9va2luZ19mb3JtX2Rpdic7XHJcblxyXG5cdFx0dmFyIGNhbGVuZGFyX3Jlc291cmNlX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApO1xyXG5cclxuXHRcdGlmICggY2FsZW5kYXJfcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdGpxX25vZGUgPSAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgY2FsZW5kYXJfcmVzb3VyY2VfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGpxX25vZGU7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IHJlc291cmNlIElEIGZyb20gYWp4IHBvc3QgZGF0YSB1cmwgICB1c3VhbGx5ICBmcm9tICB0aGlzLmRhdGEgID0gJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zXHRcdCAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKiBAcmV0dXJucyB7aW50fVx0XHRcdFx0XHRcdCAxIHwgMCAgKGlmIGVycnJvciB0aGVuICAwKVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZSAgICB2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICl7XHJcblxyXG5cdFx0Ly8gR2V0IGJvb2tpbmcgcmVzb3VyY2UgSUQgZnJvbSBBamF4IFBvc3QgUmVxdWVzdCAgLT4gdGhpcy5kYXRhID0gJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0XHR2YXIgY2FsZW5kYXJfcmVzb3VyY2VfaWQgPSB3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXScsIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApO1xyXG5cdFx0aWYgKCAobnVsbCAhPT0gY2FsZW5kYXJfcmVzb3VyY2VfaWQpICYmICgnJyAhPT0gY2FsZW5kYXJfcmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdGNhbGVuZGFyX3Jlc291cmNlX2lkID0gcGFyc2VJbnQoIGNhbGVuZGFyX3Jlc291cmNlX2lkICk7XHJcblx0XHRcdGlmICggY2FsZW5kYXJfcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdFx0cmV0dXJuIGNhbGVuZGFyX3Jlc291cmNlX2lkO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gMDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgcGFyYW1ldGVyIGZyb20gVVJMICAtICBwYXJzZSBVUkwgcGFyYW1ldGVycywgIGxpa2UgdGhpczogYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1xyXG5cdCAqIEBwYXJhbSBuYW1lICBwYXJhbWV0ZXIgIG5hbWUsICBsaWtlICdjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0nXHJcblx0ICogQHBhcmFtIHVybFx0J3BhcmFtZXRlciAgc3RyaW5nIFVSTCdcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfG51bGx9ICAgcGFyYW1ldGVyIHZhbHVlXHJcblx0ICpcclxuXHQgKiBFeGFtcGxlOiBcdFx0d3BiY19nZXRfdXJpX3BhcmFtX2J5X25hbWUoICdjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0nLCB0aGlzLmRhdGEgKTsgIC0+ICcyJ1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3VyaV9wYXJhbV9ieV9uYW1lKCBuYW1lLCB1cmwgKXtcclxuXHJcblx0XHR1cmwgPSBkZWNvZGVVUklDb21wb25lbnQoIHVybCApO1xyXG5cclxuXHRcdG5hbWUgPSBuYW1lLnJlcGxhY2UoIC9bXFxbXFxdXS9nLCAnXFxcXCQmJyApO1xyXG5cdFx0dmFyIHJlZ2V4ID0gbmV3IFJlZ0V4cCggJ1s/Jl0nICsgbmFtZSArICcoPShbXiYjXSopfCZ8I3wkKScgKSxcclxuXHRcdFx0cmVzdWx0cyA9IHJlZ2V4LmV4ZWMoIHVybCApO1xyXG5cdFx0aWYgKCAhcmVzdWx0cyApIHJldHVybiBudWxsO1xyXG5cdFx0aWYgKCAhcmVzdWx0c1sgMiBdICkgcmV0dXJuICcnO1xyXG5cdFx0cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudCggcmVzdWx0c1sgMiBdLnJlcGxhY2UoIC9cXCsvZywgJyAnICkgKTtcclxuXHR9XHJcbiIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvZnJvbnRfZW5kX21lc3NhZ2VzL3dwYmNfZmVfbWVzc2FnZXMuanNcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vIFNob3cgTWVzc2FnZXMgYXQgRnJvbnQtRWRuIHNpZGVcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2hvdyBtZXNzYWdlIGluIGNvbnRlbnRcclxuICpcclxuICogQHBhcmFtIG1lc3NhZ2VcdFx0XHRcdE1lc3NhZ2UgSFRNTFxyXG4gKiBAcGFyYW0gcGFyYW1zID0ge1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgIDogJ3dhcm5pbmcnLFx0XHRcdFx0XHRcdFx0Ly8gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJyB8ICdzdWNjZXNzJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyA6IHtcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJyA6ICcnLFx0XHRcdFx0Ly8gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgICA6ICdpbnNpZGUnXHRcdC8vICdpbnNpZGUnIHwgJ2JlZm9yZScgfCAnYWZ0ZXInIHwgJ3JpZ2h0JyB8ICdsZWZ0J1xyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH0sXHJcbiAqXHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFx0XHRcdFx0XHRcdFx0XHQvLyBBcHBseSAgb25seSBpZiBcdCd3aGVyZScgICA6ICdpbnNpZGUnXHJcbiAqXHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHRcdFx0XHQvLyBzdHlsZXMsIGlmIG5lZWRlZFxyXG4gKlx0XHRcdFx0XHRcdFx0ICAgICdjc3NfY2xhc3MnOiAnJyxcdFx0XHRcdFx0XHRcdFx0Ly8gRm9yIGV4YW1wbGUgY2FuICBiZTogJ3dwYmNfZmVfbWVzc2FnZV9hbHQnXHJcbiAqXHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwLFx0XHRcdFx0XHRcdFx0XHRcdC8vIGhvdyBtYW55IG1pY3Jvc2Vjb25kIHRvICBzaG93LCAgaWYgMCAgdGhlbiAgc2hvdyBmb3JldmVyXHJcbiAqXHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogZmFsc2VcdFx0XHRcdFx0Ly8gaWYgdHJ1ZSwgIHRoZW4gZG8gbm90IHNob3cgbWVzc2FnZSwgIGlmIHByZXZpb3MgbWVzc2FnZSB3YXMgbm90IGhpZGVkIChub3QgYXBwbHkgaWYgJ3doZXJlJyAgIDogJ2luc2lkZScgKVxyXG4gKlx0XHRcdFx0fTtcclxuICogRXhhbXBsZXM6XHJcbiAqIFx0XHRcdHZhciBodG1sX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggJ1lvdSBjYW4gdGVzdCBkYXlzIHNlbGVjdGlvbiBpbiBjYWxlbmRhcicsIHt9ICk7XHJcbiAqXHJcbiAqXHRcdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggX3dwYmMuZ2V0X21lc3NhZ2UoICdtZXNzYWdlX2NoZWNrX3JlcXVpcmVkJyApLCB7ICd0eXBlJzogJ3dhcm5pbmcnLCAnZGVsYXknOiAxMDAwMCwgJ2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAnc2hvd19oZXJlJzogeyd3aGVyZSc6ICdyaWdodCcsICdqcV9ub2RlJzogZWwsfSB9ICk7XHJcbiAqXHJcbiAqXHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApLFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7ICAgJ3R5cGUnICAgICA6ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSApIClcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgID8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICdpbmZvJyxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2Nzc19jbGFzcyc6J3dwYmNfZmVfbWVzc2FnZV9hbHQnLFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAxMDAwMFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcbiAqXHJcbiAqXHJcbiAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIG1lc3NhZ2UsIHBhcmFtcyA9IHt9ICl7XHJcblxyXG5cdHZhciBwYXJhbXNfZGVmYXVsdCA9IHtcclxuXHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgOiAnd2FybmluZycsXHRcdFx0XHRcdFx0XHQvLyAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2luZm8nIHwgJ3N1Y2Nlc3MnXHJcblx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZScgOiAnJyxcdFx0XHRcdC8vIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgIDogJ2luc2lkZSdcdFx0Ly8gJ2luc2lkZScgfCAnYmVmb3JlJyB8ICdhZnRlcicgfCAncmlnaHQnIHwgJ2xlZnQnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH0sXHJcblx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcdFx0XHRcdFx0XHRcdFx0Ly8gQXBwbHkgIG9ubHkgaWYgXHQnd2hlcmUnICAgOiAnaW5zaWRlJ1xyXG5cdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcdFx0XHRcdC8vIHN0eWxlcywgaWYgbmVlZGVkXHJcblx0XHRcdFx0XHRcdFx0ICAgICdjc3NfY2xhc3MnOiAnJyxcdFx0XHRcdFx0XHRcdFx0Ly8gRm9yIGV4YW1wbGUgY2FuICBiZTogJ3dwYmNfZmVfbWVzc2FnZV9hbHQnXHJcblx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcdFx0XHRcdFx0XHRcdFx0XHQvLyBob3cgbWFueSBtaWNyb3NlY29uZCB0byAgc2hvdywgIGlmIDAgIHRoZW4gIHNob3cgZm9yZXZlclxyXG5cdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiBmYWxzZSxcdFx0XHRcdFx0Ly8gaWYgdHJ1ZSwgIHRoZW4gZG8gbm90IHNob3cgbWVzc2FnZSwgIGlmIHByZXZpb3MgbWVzc2FnZSB3YXMgbm90IGhpZGVkIChub3QgYXBwbHkgaWYgJ3doZXJlJyAgIDogJ2luc2lkZScgKVxyXG5cdFx0XHRcdFx0XHRcdFx0J2lzX3Njcm9sbCc6IHRydWVcdFx0XHRcdFx0XHRcdFx0Ly8gaXMgc2Nyb2xsICB0byAgdGhpcyBlbGVtZW50XHJcblx0XHRcdFx0XHRcdH07XHJcblx0Zm9yICggdmFyIHBfa2V5IGluIHBhcmFtcyApe1xyXG5cdFx0cGFyYW1zX2RlZmF1bHRbIHBfa2V5IF0gPSBwYXJhbXNbIHBfa2V5IF07XHJcblx0fVxyXG5cdHBhcmFtcyA9IHBhcmFtc19kZWZhdWx0O1xyXG5cclxuICAgIHZhciB1bmlxdWVfZGl2X2lkID0gbmV3IERhdGUoKTtcclxuICAgIHVuaXF1ZV9kaXZfaWQgPSAnd3BiY19ub3RpY2VfJyArIHVuaXF1ZV9kaXZfaWQuZ2V0VGltZSgpO1xyXG5cclxuXHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlJztcclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdlcnJvcicgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2VfZXJyb3InO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3JlcG9ydF9nbWFpbGVycm9ycmVkXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICd3YXJuaW5nJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV93YXJuaW5nJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl93YXJuaW5nXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdpbmZvJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV9pbmZvJztcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnc3VjY2VzcycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2Vfc3VjY2Vzcyc7XHJcblx0XHRtZXNzYWdlID0gJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fZG9uZV9vdXRsaW5lXCI+PC9pPicgKyBtZXNzYWdlO1xyXG5cdH1cclxuXHJcblx0dmFyIHNjcm9sbF90b19lbGVtZW50ID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdfc2Nyb2xsXCIgc3R5bGU9XCJkaXNwbGF5Om5vbmU7XCI+PC9kaXY+JztcclxuXHRtZXNzYWdlID0gJzxkaXYgaWQ9XCInICsgdW5pcXVlX2Rpdl9pZCArICdcIiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlICcgKyBwYXJhbXNbJ2Nzc19jbGFzcyddICsgJ1wiIHN0eWxlPVwiJyArIHBhcmFtc1sgJ3N0eWxlJyBdICsgJ1wiPicgKyBtZXNzYWdlICsgJzwvZGl2Pic7XHJcblxyXG5cclxuXHR2YXIganFfZWxfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdHZhciBpc19zaG93X21lc3NhZ2UgPSB0cnVlO1xyXG5cclxuXHRpZiAoICdpbnNpZGUnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGlmICggcGFyYW1zWyAnaXNfYXBwZW5kJyBdICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFwcGVuZCggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYXBwZW5kKCBtZXNzYWdlICk7XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5odG1sKCBzY3JvbGxfdG9fZWxlbWVudCArIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ2JlZm9yZScgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLnNpYmxpbmdzKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ2FmdGVyJyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkubmV4dEFsbCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcdFx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGJlZm9yZShmb3IgaGFuZHkgc2Nyb2xsKVxyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hZnRlciggbWVzc2FnZSApO1xyXG5cdFx0fVxyXG5cclxuXHR9IGVsc2UgaWYgKCAncmlnaHQnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5uZXh0QWxsKCAnLndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9yaWdodCcgKS5maW5kKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1x0XHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYmVmb3JlKGZvciBoYW5keSBzY3JvbGwpXHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFmdGVyKCAnPGRpdiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9yaWdodFwiPicgKyBtZXNzYWdlICsgJzwvZGl2PicgKTtcclxuXHRcdH1cclxuXHR9IGVsc2UgaWYgKCAnbGVmdCcgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLnNpYmxpbmdzKCAnLndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9sZWZ0JyApLmZpbmQoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHRcdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBiZWZvcmUoZm9yIGhhbmR5IHNjcm9sbClcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCAnPGRpdiBjbGFzcz1cIndwYmNfZnJvbnRfZW5kX19tZXNzYWdlX2NvbnRhaW5lcl9sZWZ0XCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCAgICggaXNfc2hvd19tZXNzYWdlICkgICYmICAoIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApID4gMCApICAgKXtcclxuXHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRqUXVlcnkoICcjJyArIHVuaXF1ZV9kaXZfaWQgKS5mYWRlT3V0KCAxNTAwICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSAsIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApICAgKTtcclxuXHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyMiA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkudHJpZ2dlciggJ2hpZGUnICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSwgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSArIDE1MDEgKSApO1xyXG5cdH1cclxuXHJcblx0Ly8gQ2hlY2sgIGlmIHNob3dlZCBtZXNzYWdlIGluIHNvbWUgaGlkZGVuIHBhcmVudCBzZWN0aW9uIGFuZCBzaG93IGl0LiBCdXQgaXQgbXVzdCAgYmUgbG93ZXIgdGhhbiAnLndwYmNfY29udGFpbmVyJ1xyXG5cdHZhciBwYXJlbnRfZWxzID0galF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkucGFyZW50cygpLm1hcCggZnVuY3Rpb24gKCl7XHJcblx0XHRpZiAoICghalF1ZXJ5KCB0aGlzICkuaXMoICd2aXNpYmxlJyApKSAmJiAoalF1ZXJ5KCAnLndwYmNfY29udGFpbmVyJyApLmhhcyggdGhpcyApKSApe1xyXG5cdFx0XHRqUXVlcnkoIHRoaXMgKS5zaG93KCk7XHJcblx0XHR9XHJcblx0fSApO1xyXG5cclxuXHRpZiAoIHBhcmFtc1sgJ2lzX3Njcm9sbCcgXSApe1xyXG5cdFx0d3BiY19kb19zY3JvbGwoICcjJyArIHVuaXF1ZV9kaXZfaWQgKyAnX3Njcm9sbCcgKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiB1bmlxdWVfZGl2X2lkO1xyXG59XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlLiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcigganFfbm9kZSwgbWVzc2FnZSApe1xyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdyaWdodCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlIFVOREVSIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yX3VuZGVyX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UsIG1lc3NhZ2VfZGVsYXkgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKG1lc3NhZ2VfZGVsYXkpICl7XHJcblx0XHRcdG1lc3NhZ2VfZGVsYXkgPSAwXHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogbWVzc2FnZV9kZWxheSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYWZ0ZXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRXJyb3IgbWVzc2FnZSBVTkRFUiBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcl9hYm92ZV9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlLCBtZXNzYWdlX2RlbGF5ICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChtZXNzYWdlX2RlbGF5KSApe1xyXG5cdFx0XHRtZXNzYWdlX2RlbGF5ID0gMTAwMDBcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiBtZXNzYWdlX2RlbGF5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdiZWZvcmUnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogV2FybmluZyBtZXNzYWdlLiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nKCBqcV9ub2RlLCBtZXNzYWdlICl7XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAncmlnaHQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHR3cGJjX2hpZ2hsaWdodF9lcnJvcl9vbl9mb3JtX2ZpZWxkKCBqcV9ub2RlICk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogV2FybmluZyBtZXNzYWdlIFVOREVSIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfdW5kZXJfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSApe1xyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFdhcm5pbmcgbWVzc2FnZSBBQk9WRSBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nX2Fib3ZlX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UgKXtcclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdiZWZvcmUnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBIaWdobGlnaHQgRXJyb3IgaW4gc3BlY2lmaWMgZmllbGRcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBqcV9ub2RlXHRcdFx0XHRcdHN0cmluZyBvciBqUXVlcnkgZWxlbWVudCwgIHdoZXJlIHNjcm9sbCAgdG9cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2hpZ2hsaWdodF9lcnJvcl9vbl9mb3JtX2ZpZWxkKCBqcV9ub2RlICl7XHJcblxyXG5cdFx0aWYgKCAhalF1ZXJ5KCBqcV9ub2RlICkubGVuZ3RoICl7XHJcblx0XHRcdHJldHVybjtcclxuXHRcdH1cclxuXHRcdGlmICggISBqUXVlcnkoIGpxX25vZGUgKS5pcyggJzppbnB1dCcgKSApe1xyXG5cdFx0XHQvLyBTaXR1YXRpb24gd2l0aCAgY2hlY2tib3hlcyBvciByYWRpbyAgYnV0dG9uc1xyXG5cdFx0XHR2YXIganFfbm9kZV9hcnIgPSBqUXVlcnkoIGpxX25vZGUgKS5maW5kKCAnOmlucHV0JyApO1xyXG5cdFx0XHRpZiAoICFqcV9ub2RlX2Fyci5sZW5ndGggKXtcclxuXHRcdFx0XHRyZXR1cm5cclxuXHRcdFx0fVxyXG5cdFx0XHRqcV9ub2RlID0ganFfbm9kZV9hcnIuZ2V0KCAwICk7XHJcblx0XHR9XHJcblx0XHR2YXIgcGFyYW1zID0ge307XHJcblx0XHRwYXJhbXNbICdkZWxheScgXSA9IDEwMDAwO1xyXG5cclxuXHRcdGlmICggIWpRdWVyeSgganFfbm9kZSApLmhhc0NsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApICl7XHJcblxyXG5cdFx0XHRqUXVlcnkoIGpxX25vZGUgKS5hZGRDbGFzcyggJ3dwYmNfZm9ybV9maWVsZF9lcnJvcicgKVxyXG5cclxuXHRcdFx0aWYgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSA+IDAgKXtcclxuXHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCBqUXVlcnkoIGpxX25vZGUgKS5yZW1vdmVDbGFzcyggJ3dwYmNfZm9ybV9maWVsZF9lcnJvcicgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgLCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcbi8qKlxyXG4gKiBTY3JvbGwgdG8gc3BlY2lmaWMgZWxlbWVudFxyXG4gKlxyXG4gKiBAcGFyYW0ganFfbm9kZVx0XHRcdFx0XHRzdHJpbmcgb3IgalF1ZXJ5IGVsZW1lbnQsICB3aGVyZSBzY3JvbGwgIHRvXHJcbiAqIEBwYXJhbSBleHRyYV9zaGlmdF9vZmZzZXRcdFx0aW50IHNoaWZ0IG9mZnNldCBmcm9tICBqcV9ub2RlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RvX3Njcm9sbCgganFfbm9kZSAsIGV4dHJhX3NoaWZ0X29mZnNldCA9IDAgKXtcclxuXHJcblx0aWYgKCAhalF1ZXJ5KCBqcV9ub2RlICkubGVuZ3RoICl7XHJcblx0XHRyZXR1cm47XHJcblx0fVxyXG5cdHZhciB0YXJnZXRPZmZzZXQgPSBqUXVlcnkoIGpxX25vZGUgKS5vZmZzZXQoKS50b3A7XHJcblxyXG5cdGlmICggdGFyZ2V0T2Zmc2V0IDw9IDAgKXtcclxuXHRcdGlmICggMCAhPSBqUXVlcnkoIGpxX25vZGUgKS5uZXh0QWxsKCAnOnZpc2libGUnICkubGVuZ3RoICl7XHJcblx0XHRcdHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLm5leHRBbGwoICc6dmlzaWJsZScgKS5maXJzdCgpLm9mZnNldCgpLnRvcDtcclxuXHRcdH0gZWxzZSBpZiAoIDAgIT0galF1ZXJ5KCBqcV9ub2RlICkucGFyZW50KCkubmV4dEFsbCggJzp2aXNpYmxlJyApLmxlbmd0aCApe1xyXG5cdFx0XHR0YXJnZXRPZmZzZXQgPSBqUXVlcnkoIGpxX25vZGUgKS5wYXJlbnQoKS5uZXh0QWxsKCAnOnZpc2libGUnICkuZmlyc3QoKS5vZmZzZXQoKS50b3A7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoIGpRdWVyeSggJyN3cGFkbWluYmFyJyApLmxlbmd0aCA+IDAgKXtcclxuXHRcdHRhcmdldE9mZnNldCA9IHRhcmdldE9mZnNldCAtIDUwIC0gNTA7XHJcblx0fSBlbHNlIHtcclxuXHRcdHRhcmdldE9mZnNldCA9IHRhcmdldE9mZnNldCAtIDIwIC0gNTA7XHJcblx0fVxyXG5cdHRhcmdldE9mZnNldCArPSBleHRyYV9zaGlmdF9vZmZzZXQ7XHJcblxyXG5cdC8vIFNjcm9sbCBvbmx5ICBpZiB3ZSBkaWQgbm90IHNjcm9sbCBiZWZvcmVcclxuXHRpZiAoICEgalF1ZXJ5KCAnaHRtbCxib2R5JyApLmlzKCAnOmFuaW1hdGVkJyApICl7XHJcblx0XHRqUXVlcnkoICdodG1sLGJvZHknICkuYW5pbWF0ZSgge3Njcm9sbFRvcDogdGFyZ2V0T2Zmc2V0fSwgNTAwICk7XHJcblx0fVxyXG59XHJcblxyXG4iLCJcclxuLy8gRml4SW46IDEwLjIuMC40LlxyXG4vKipcclxuICogRGVmaW5lIFBvcG92ZXJzIGZvciBUaW1lbGluZXMgaW4gV1AgQm9va2luZyBDYWxlbmRhclxyXG4gKlxyXG4gKiBAcmV0dXJucyB7c3RyaW5nfGJvb2xlYW59XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RlZmluZV90aXBweV9wb3BvdmVyKCl7XHJcblx0aWYgKCAnZnVuY3Rpb24nICE9PSB0eXBlb2YgKHdwYmNfdGlwcHkpICl7XHJcblx0XHRjb25zb2xlLmxvZyggJ1dQQkMgRXJyb3IuIHdwYmNfdGlwcHkgd2FzIG5vdCBkZWZpbmVkLicgKTtcclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblx0d3BiY190aXBweSggJy5wb3BvdmVyX2JvdHRvbS5wb3BvdmVyX2NsaWNrJywge1xyXG5cdFx0Y29udGVudCggcmVmZXJlbmNlICl7XHJcblx0XHRcdHZhciBwb3BvdmVyX3RpdGxlID0gcmVmZXJlbmNlLmdldEF0dHJpYnV0ZSggJ2RhdGEtb3JpZ2luYWwtdGl0bGUnICk7XHJcblx0XHRcdHZhciBwb3BvdmVyX2NvbnRlbnQgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb250ZW50JyApO1xyXG5cdFx0XHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJwb3BvdmVyIHBvcG92ZXJfdGlwcHlcIj4nXHJcblx0XHRcdFx0KyAnPGRpdiBjbGFzcz1cInBvcG92ZXItY2xvc2VcIj48YSBocmVmPVwiamF2YXNjcmlwdDp2b2lkKDApXCIgb25jbGljaz1cImphdmFzY3JpcHQ6dGhpcy5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQuX3RpcHB5LmhpZGUoKTtcIiA+JnRpbWVzOzwvYT48L2Rpdj4nXHJcblx0XHRcdFx0KyBwb3BvdmVyX2NvbnRlbnRcclxuXHRcdFx0XHQrICc8L2Rpdj4nO1xyXG5cdFx0fSxcclxuXHRcdGFsbG93SFRNTCAgICAgICAgOiB0cnVlLFxyXG5cdFx0dHJpZ2dlciAgICAgICAgICA6ICdtYW51YWwnLFxyXG5cdFx0aW50ZXJhY3RpdmUgICAgICA6IHRydWUsXHJcblx0XHRoaWRlT25DbGljayAgICAgIDogZmFsc2UsXHJcblx0XHRpbnRlcmFjdGl2ZUJvcmRlcjogMTAsXHJcblx0XHRtYXhXaWR0aCAgICAgICAgIDogNTUwLFxyXG5cdFx0dGhlbWUgICAgICAgICAgICA6ICd3cGJjLXRpcHB5LXBvcG92ZXInLFxyXG5cdFx0cGxhY2VtZW50ICAgICAgICA6ICdib3R0b20tc3RhcnQnLFxyXG5cdFx0dG91Y2ggICAgICAgICAgICA6IFsnaG9sZCcsIDUwMF0sXHJcblx0fSApO1xyXG5cdGpRdWVyeSggJy5wb3BvdmVyX2JvdHRvbS5wb3BvdmVyX2NsaWNrJyApLm9uKCAnY2xpY2snLCBmdW5jdGlvbiAoKXtcclxuXHRcdGlmICggdGhpcy5fdGlwcHkuc3RhdGUuaXNWaXNpYmxlICl7XHJcblx0XHRcdHRoaXMuX3RpcHB5LmhpZGUoKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHRoaXMuX3RpcHB5LnNob3coKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblx0d3BiY19kZWZpbmVfaGlkZV90aXBweV9vbl9zY3JvbGwoKTtcclxufVxyXG5cclxuXHJcblxyXG5mdW5jdGlvbiB3cGJjX2RlZmluZV9oaWRlX3RpcHB5X29uX3Njcm9sbCgpe1xyXG5cdGpRdWVyeSggJy5mbGV4X3RsX19zY3JvbGxpbmdfc2VjdGlvbjIsLmZsZXhfdGxfX3Njcm9sbGluZ19zZWN0aW9ucycgKS5vbiggJ3Njcm9sbCcsIGZ1bmN0aW9uICggZXZlbnQgKXtcclxuXHRcdGlmICggJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mICh3cGJjX3RpcHB5KSApe1xyXG5cdFx0XHR3cGJjX3RpcHB5LmhpZGVBbGwoKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcbn1cclxuIl0sImZpbGUiOiJfZGlzdC9hbGwvX291dC93cGJjX2FsbC5qcyJ9

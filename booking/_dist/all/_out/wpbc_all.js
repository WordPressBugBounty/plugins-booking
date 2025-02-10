"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiX2Rpc3QvYWxsL19vdXQvd3BiY19hbGwuanMiLCJuYW1lcyI6WyJ3cGJjX3RyaW0iLCJzdHJpbmdfdG9fdHJpbSIsIkFycmF5IiwiaXNBcnJheSIsImpvaW4iLCJ0cmltIiwid3BiY19pbl9hcnJheSIsImFycmF5X2hlcmUiLCJwX3ZhbCIsImkiLCJsIiwibGVuZ3RoIiwid3BiY19jbG9uZV9vYmoiLCJvYmoiLCJKU09OIiwicGFyc2UiLCJzdHJpbmdpZnkiLCJfd3BiYyIsIiQiLCJwX3NlY3VyZSIsInNlY3VyaXR5X29iaiIsInVzZXJfaWQiLCJub25jZSIsImxvY2FsZSIsInNldF9zZWN1cmVfcGFyYW0iLCJwYXJhbV9rZXkiLCJwYXJhbV92YWwiLCJnZXRfc2VjdXJlX3BhcmFtIiwicF9jYWxlbmRhcnMiLCJjYWxlbmRhcnNfb2JqIiwiY2FsZW5kYXJfX2lzX2RlZmluZWQiLCJyZXNvdXJjZV9pZCIsImNhbGVuZGFyX19pbml0IiwiY2FsZW5kYXJfX2lzX3Byb3BfaW50IiwicHJvcGVydHlfbmFtZSIsInBfY2FsZW5kYXJfaW50X3Byb3BlcnRpZXMiLCJpc19pbmNsdWRlIiwiaW5jbHVkZXMiLCJjYWxlbmRhcnNfYWxsX19zZXQiLCJjYWxlbmRhcnNfYWxsX19nZXQiLCJjYWxlbmRhcl9fZ2V0X3BhcmFtZXRlcnMiLCJjYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMiLCJjYWxlbmRhcl9wcm9wZXJ0eV9vYmoiLCJpc19jb21wbGV0ZV9vdmVyd3JpdGUiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJwcm9wX25hbWUiLCJjYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlIiwicHJvcF92YWx1ZSIsImNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUiLCJwYXJzZUludCIsInBfYm9va2luZ3MiLCJib29raW5nc19vYmoiLCJib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCIsImJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXQiLCJib29raW5nc19pbl9jYWxlbmRhcl9fc2V0IiwiY2FsZW5kYXJfb2JqIiwiYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9kYXRlcyIsImJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMiLCJkYXRlc19vYmoiLCJib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlIiwic3FsX2NsYXNzX2RheSIsImJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSIsImJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSIsImJvb2tpbmdzX2luX2NhbGVuZGFyc19fc2V0X2FsbCIsImJvb2tpbmdzX2luX2NhbGVuZGFyc19fZ2V0X2FsbCIsInBfc2Vhc29ucyIsInNlYXNvbnNfb2JqIiwic2Vhc29uc19fc2V0Iiwic2Vhc29uX25hbWVfa2V5IiwicHVzaCIsInNlYXNvbnNfX2dldF9mb3JfZGF0ZSIsInBfb3RoZXIiLCJvdGhlcl9vYmoiLCJzZXRfb3RoZXJfcGFyYW0iLCJnZXRfb3RoZXJfcGFyYW0iLCJnZXRfb3RoZXJfcGFyYW1fX2FsbCIsInBfbWVzc2FnZXMiLCJtZXNzYWdlc19vYmoiLCJzZXRfbWVzc2FnZSIsImdldF9tZXNzYWdlIiwiZ2V0X21lc3NhZ2VzX19hbGwiLCJqUXVlcnkiLCJwX2JhbGFuY2VyIiwiYmFsYW5jZXJfb2JqIiwiYmFsYW5jZXJfX3NldF9tYXhfdGhyZWFkcyIsIm1heF90aHJlYWRzIiwiYmFsYW5jZXJfX2lzX2RlZmluZWQiLCJiYWxhbmNlcl9faW5pdCIsImZ1bmN0aW9uX25hbWUiLCJwYXJhbXMiLCJiYWxhbmNlX29iaiIsImJhbGFuY2VyX19pc19hbHJlYWR5X3J1biIsImJhbGFuY2VyX19pc19hbHJlYWR5X3dhaXQiLCJiYWxhbmNlcl9fY2FuX2lfcnVuIiwiYmFsYW5jZXJfX2FkZF90b19fcnVuIiwiYmFsYW5jZXJfX2FkZF90b19fd2FpdCIsImJhbGFuY2VyX19yZW1vdmVfZnJvbV9fd2FpdF9saXN0IiwicmVtb3ZlZF9lbCIsInNwbGljZSIsInBvcCIsImZpbHRlciIsInYiLCJiYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3J1bl9saXN0IiwiYmFsYW5jZXJfX3J1bl9uZXh0IiwiYmFsYW5jZXJfX3J1biIsIndwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4Iiwid3BiY19iYWxhbmNlcl9faXNfd2FpdCIsImJhbGFuY2VyX3N0YXR1cyIsIndwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCIsIndwYmNfY2FsZW5kYXJfc2hvdyIsImhhc0NsYXNzIiwibG9jYWxfX2lzX3JhbmdlX3NlbGVjdCIsImxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0iLCJsb2NhbF9fbWluX2RhdGUiLCJEYXRlIiwibG9jYWxfX21heF9kYXRlIiwibG9jYXRpb24iLCJocmVmIiwiaW5kZXhPZiIsImxvY2FsX19zdGFydF93ZWVrZGF5IiwibG9jYWxfX251bWJlcl9vZl9tb250aHMiLCJ0ZXh0IiwiZGF0ZXBpY2siLCJiZWZvcmVTaG93RGF5IiwianNfZGF0ZSIsIndwYmNfX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cyIsIm9uU2VsZWN0Iiwic3RyaW5nX2RhdGVzIiwianNfZGF0ZXNfYXJyIiwid3BiY19fY2FsZW5kYXJfX29uX3NlbGVjdF9kYXlzIiwib25Ib3ZlciIsInN0cmluZ19kYXRlIiwid3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMiLCJvbkNoYW5nZU1vbnRoWWVhciIsInllYXIiLCJyZWFsX21vbnRoIiwianNfZGF0ZV9fMXN0X2RheV9pbl9tb250aCIsInNob3dPbiIsIm51bWJlck9mTW9udGhzIiwic3RlcE1vbnRocyIsInByZXZUZXh0IiwibmV4dFRleHQiLCJkYXRlRm9ybWF0IiwiY2hhbmdlTW9udGgiLCJjaGFuZ2VZZWFyIiwibWluRGF0ZSIsIm1heERhdGUiLCJzaG93U3RhdHVzIiwibXVsdGlTZXBhcmF0b3IiLCJjbG9zZUF0VG9wIiwiZmlyc3REYXkiLCJnb3RvQ3VycmVudCIsImhpZGVJZk5vUHJldk5leHQiLCJtdWx0aVNlbGVjdCIsInJhbmdlU2VsZWN0IiwidXNlVGhlbWVSb2xsZXIiLCJzZXRUaW1lb3V0Iiwid3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nIiwic3RhcnRfYmtfbW9udGgiLCJ3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8iLCJkYXRlIiwiY2FsZW5kYXJfcGFyYW1zX2FyciIsImRhdGVwaWNrX3RoaXMiLCJ0b2RheV9kYXRlIiwiY2xhc3NfZGF5Iiwid3BiY19fZ2V0X190ZF9jbGFzc19kYXRlIiwid3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSIsInNlbGVjdGVkX2RhdGVzX3NxbCIsIndwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciIsImRhdGVfYm9va2luZ3Nfb2JqIiwiY3NzX2NsYXNzZXNfX2Zvcl9kYXRlIiwiZ2V0RGF5IiwiaXNfZGF5X3NlbGVjdGFibGUiLCJzZWFzb25fbmFtZXNfYXJyIiwic2Vhc29uX2tleSIsInRvU3RyaW5nIiwicmVwbGFjZSIsImlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZSIsImRhdGVfYm9va2luZ19vYmoiLCJ0b29sdGlwX3RleHQiLCJ3cGJjX3NldF90b29sdGlwX19fZm9yX19jYWxlbmRhcl9kYXRlIiwiaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyIiwiaXNfYm9va2luZ19mb3JtX2V4aXN0IiwiY3NzX29mX2NhbGVuZGFyIiwiY3NzIiwid3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X19icyIsIndwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyIsInJlbW92ZSIsInZhbCIsIndwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMiLCJ3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtIiwibW91c2VfY2xpY2tlZF9kYXRlcyIsImFsbF9zZWxlY3RlZF9kYXRlc19hcnIiLCJ0cmlnZ2VyIiwiZG9jdW1lbnQiLCJyZWFkeSIsIm9uIiwiZXZlbnQiLCJjbG9zZWRfdGltZXIiLCJtaWRkbGVfZGF5c19vcGFjaXR5Iiwibm90IiwidGltZV9maWVsZHNfb2JqX2FyciIsIndwYmNfZ2V0X190aW1lX2ZpZWxkc19faW5fYm9va2luZ19mb3JtX19hc19hcnIiLCJzZWxlY3RlZF9kYXRlc19hcnIiLCJjaGlsZF9yZXNvdXJjZXNfYXJyIiwic3FsX2RhdGUiLCJjaGlsZF9yZXNvdXJjZV9pZCIsIm1lcmdlZF9zZWNvbmRzIiwidGltZV9maWVsZHNfb2JqIiwiaXNfaW50ZXJzZWN0IiwiaXNfY2hlY2tfaW4iLCJ0b2RheV90aW1lX19yZWFsIiwidG9kYXlfdGltZV9fc2hpZnQiLCJmaWVsZF9rZXkiLCJkaXNhYmxlZCIsImlzX3RpbWVfaW5fcGFzdCIsIndwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0IiwiaG93X21hbnlfcmVzb3VyY2VzX2ludGVyc2VjdGVkIiwicmVzX2tleSIsImJvb2tlZF90aW1lX3Nsb3RzIiwidGltZXNfYXNfc2Vjb25kcyIsIndwYmNfaXNfaW50ZXJzZWN0X19yYW5nZV90aW1lX2ludGVydmFsIiwibmFtZSIsIndwYmNfaXNfaW50ZXJzZWN0X19vbmVfdGltZV9pbnRlcnZhbCIsIndwYmNfX2h0bWxfX3RpbWVfZmllbGRfb3B0aW9uc19fc2V0X2Rpc2FibGVkIiwianNfY3VycmVudF90aW1lX3RvX2NoZWNrIiwic3FsX2RhdGVfYXJyIiwic3BsaXQiLCJzcWxfZGF0ZV9fbWlkbmlnaHQiLCJzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMiLCJnZXRUaW1lIiwidGltZXNfYXNfc2Vjb25kc19jaGVjayIsInRpbWVfQSIsInRpbWVfaW50ZXJ2YWxfQiIsImoiLCJ0aW1lX2ludGVydmFsX0EiLCJ3cGJjX2ludGVydmFsc19faXNfaW50ZXJzZWN0ZWQiLCJ0aW1lX2ZpZWxkc19hcnIiLCJjdGYiLCJ0aW1lX2ZpZWxkIiwidGltZV9vcHRpb24iLCJqcXVlcnlfb3B0aW9uIiwidmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyIiwic3RhcnRfZW5kX3RpbWVzX2FyciIsInRpbWVfaW5fc2Vjb25kcyIsImF0dHIiLCJwcm9wIiwiYWRkQ2xhc3MiLCJwYXJlbnQiLCJmaW5kIiwicmVtb3ZlQ2xhc3MiLCJ3cGJjX2lzX3RoaXNfdGltZXNsb3RfX2Z1bGxfZGF5X2Jvb2tlZCIsInRpbWVzbG90X2Fycl9pbl9zZWNvbmRzIiwibiIsInNvcnQiLCJ3cGJjX2dldF9fc2VsZWN0ZWRfdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyIiwiaXNfb25seV9zZWxlY3RlZF90aW1lIiwidGV4dF90aW1lX2ZpZWxkc19hcnIiLCJ0ZiIsInRleHRfanF1ZXJ5IiwidGltZV9faF9tX19hcnIiLCJ0ZXh0X3RpbWVfaW5fc2Vjb25kcyIsInRleHRfdGltZXNfYXNfc2Vjb25kcyIsIndwYmNfY2FsZW5kYXJfX2dldF9pbnN0IiwiX2dldEluc3QiLCJnZXQiLCJpbnN0Iiwic3RheU9wZW4iLCJkYXRlcyIsIl91cGRhdGVEYXRlcGljayIsIm1vbnRoIiwiY3Vyc29yRGF0ZSIsInNldEZ1bGxZZWFyIiwic2V0TW9udGgiLCJzZXREYXRlIiwiZHJhd01vbnRoIiwiZ2V0TW9udGgiLCJkcmF3WWVhciIsImdldEZ1bGxZZWFyIiwiX25vdGlmeUNoYW5nZSIsIl9hZGp1c3RJbnN0RGF0ZSIsIl9zaG93RGF0ZSIsIndwYmNfaXNfdGhpc19kYXlfc2VsZWN0YWJsZSIsIndwYmNfaXNfdGhpc19kYXlfYW1vbmdfc2VsZWN0ZWRfZGF5cyIsImpzX2RhdGVfdG9fY2hlY2siLCJkYXRlX2luZGV4IiwiZ2V0RGF0ZSIsIndwYmNfX2dldF9fanNfZGF0ZSIsInNxbF9jbGFzc19kYXRlIiwic3FsX2NsYXNzX2RhdGVfYXJyIiwiZGF0ZV9qcyIsInNldEhvdXJzIiwic2V0TWludXRlcyIsInNldFNlY29uZHMiLCJzZXRNaWxsaXNlY29uZHMiLCJ0ZF9jbGFzc19kYXkiLCJ3cGJjX19nZXRfX2RhdGVfcGFyYW1zX19mcm9tX3N0cmluZ19kYXRlIiwic2VwYXJhdG9yIiwiZGF0ZV9hcnIiLCJkYXRlX29iaiIsIndwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0YXJ0IiwibmV4dCIsImFmdGVyIiwid3BiY19jYWxlbmRhcl9fYmx1cl9fc3RhcnQiLCJ3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdG9wIiwid3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCIsIndwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rIiwid3BiY19jYWxlbmRhcl9fdXBkYXRlX21vbnRoc19udW1iZXIiLCJtb250aHNfbnVtYmVyIiwic2V0dGluZ3MiLCJ3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4iLCJzZWxlY3RlZF9za2luX3VybCIsInN0eWxlc2hlZXQiLCJnZXRFbGVtZW50QnlJZCIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsImhlYWRJRCIsImdldEVsZW1lbnRzQnlUYWdOYW1lIiwiY3NzTm9kZSIsImNyZWF0ZUVsZW1lbnQiLCJ0eXBlIiwic2V0QXR0cmlidXRlIiwicmVsIiwibWVkaWEiLCJhcHBlbmRDaGlsZCIsIndwYmNfX2Nzc19fY2hhbmdlX3NraW4iLCJzdHlsZXNoZWV0X2lkIiwid3BiY19pbnRlcnZhbHNfX21lcmdlX2luZXJzZWN0ZWQiLCJpbnRlcnZhbHMiLCJtZXJnZWQiLCJhIiwiYiIsIm1lcmdlZEludGVydmFsIiwiaW50ZXJ2YWwiLCJNYXRoIiwibWF4IiwiaW50ZXJ2YWxfQSIsImludGVydmFsX0IiLCJpc19pbnRlcnNlY3RlZCIsIm1pbiIsIndwYmNfZ2V0X2Fic19jbG9zZXN0X3ZhbHVlX2luX2FyciIsIm15VmFsdWUiLCJteUFycmF5IiwiZGlmZiIsImFicyIsImNsb3NldFZhbHVlIiwidGRfY2xhc3MiLCJ0ZF9lbCIsIl90aXBweSIsIndwYmNfdGlwcHkiLCJjb250ZW50IiwicmVmZXJlbmNlIiwicG9wb3Zlcl9jb250ZW50IiwiZ2V0QXR0cmlidXRlIiwiYWxsb3dIVE1MIiwiaW50ZXJhY3RpdmUiLCJoaWRlT25DbGljayIsImludGVyYWN0aXZlQm9yZGVyIiwibWF4V2lkdGgiLCJ0aGVtZSIsInBsYWNlbWVudCIsImRlbGF5IiwiaWdub3JlQXR0cmlidXRlcyIsInRvdWNoIiwiYXBwZW5kVG8iLCJib2R5Iiwid3BiY19kYXRlc19fZGF5c19iZXR3ZWVuIiwiZGF0ZTEiLCJkYXRlMiIsIk9ORV9EQVkiLCJkYXRlMV9tcyIsImRhdGUyX21zIiwiZGlmZmVyZW5jZV9tcyIsInJvdW5kIiwid3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlIiwic3FsX2RhdGVzX2FyciIsInByZXZpb3NfZGF0ZSIsImN1cnJlbnRfZGF0ZSIsIndwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIiLCJjaGVja19pbl95bWQiLCJjaGVja19vdXRfeW1kIiwiY29uc29sZSIsImxvZyIsImRhdGVzX3RvX3NlbGVjdF9hcnIiLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUiLCJjaGVja19pbl9qcyIsInRkX2NlbGwiLCJ3cGJjX2dldF9jbGlja2VkX3RkIiwiaWQiLCJfc2VsZWN0RGF5IiwiY2hlY2tfb3V0X2pzIiwidGRfY2VsbF9vdXQiLCJkYXRlc19hcnIiLCJ3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9hcnIiLCJ3cGJjX2dldF9zZWxlY3Rpb25fZGF0ZXNfanNfc3RyX2Fycl9fZnJvbV9jaGVja19pbl9vdXQiLCJkYXRlc19qcyIsInN0cl9kYXRlIiwiZGF5X2F2YWlsYWJpbGl0eSIsImNoZWNrX291dF9kYXRlIiwiY2hlY2tvdXRfdGltZXN0YW1wIiwiY2FsZW5kYXJfaHRtbF9pZCIsIm9yaWdpbmFsX2FycmF5IiwiYmtfZGlzdGluY3RfZGF0ZXMiLCJjaGVja19pbl9kYXRlIiwib3JpZ2luYWxfY2hlY2tfaW5fZGF0ZSIsIl9yZXN0cmljdE1pbk1heCIsIl9kZXRlcm1pbmVEYXRlIiwiZGF0ZV9vdXQiLCJvcmlnaW5hbF9jaGVja19vdXRfZGF0ZSIsIm1ld0RhdGUiLCJvbmVfZGF0ZV9zdHIiLCJkIiwidXJsX3BhcmFtcyIsIlVSTFNlYXJjaFBhcmFtcyIsIndpbmRvdyIsInNlYXJjaCIsImhhcyIsInNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCIsImxvYWRlZF9yZXNvdXJjZV9pZCIsIndwYmNfYXV0b19maWxsX3ZhbHVlIiwicmVwbGFjZUFsbCIsIndwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzIiwiYXV0b19maWxsX3N0ciIsImZpZWxkc19hcnIiLCJ3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UiLCJkYXRhX3N0ciIsImZpbHRlcl9vcHRpb25zX2FyciIsImRhdGFfYXJyIiwibXlfZm9ybV9maWVsZCIsImZpbHRlcl9uYW1lIiwiZmlsdGVyX3ZhbHVlIiwid3BiY19hdXRvX2ZpbGxfc2VhcmNoX2ZpZWxkc19fcGFyc2UiLCJmaWx0ZXJfdHlwZSIsIndwYmNfY2FsZW5kYXJfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXJfX29uX3Jlc2l6ZSIsIndpZHRoIiwid3BiY19jYWxlbmRhcnNfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXIiLCJhbGxfY2FsZW5kYXJzX2FyciIsImNhbGVuZGFyX2lkIiwic2xpY2UiLCJ3cGJjX2NhbF9fcmVfaW5pdCIsIndwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0Iiwid3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX3NpbmdsZSIsIndwYmNfY2FsX2RheXNfc2VsZWN0X19zaW5nbGUiLCJ3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fbXVsdGlwbGUiLCJ3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fZml4ZWQiLCJkYXlzX251bWJlciIsIndlZWtfZGF5c19fc3RhcnQiLCJ3cGJjX2NhbF9kYXlzX3NlbGVjdF9fZml4ZWQiLCJ3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fcmFuZ2UiLCJkYXlzX21pbiIsImRheXNfbWF4IiwiZGF5c19zcGVjaWZpYyIsIndwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZSIsInRhcmdldF9lbG0iLCJncm91cENvbGxhcHNlZCIsInBvc3QiLCJ3cGJjX3VybF9hamF4IiwiYWN0aW9uIiwid3BiY19hanhfdXNlcl9pZCIsIndwYmNfYWp4X2xvY2FsZSIsImNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zIiwicmVzcG9uc2VfZGF0YSIsInRleHRTdGF0dXMiLCJqcVhIUiIsImdyb3VwRW5kIiwiYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQiLCJ3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCIsImRhdGEiLCJfdHlwZW9mIiwianFfbm9kZSIsIndwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMiLCJtZXNzYWdlX3R5cGUiLCJ3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlIiwiZmFpbCIsImVycm9yVGhyb3duIiwiZXJyb3JfbWVzc2FnZSIsInN0YXR1cyIsIm1lc3NhZ2Vfc2hvd19kZWxheSIsInJlc3BvbnNlVGV4dCIsImFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyIsImNhbGVuZGFyX3Jlc291cmNlX2lkIiwid3BiY19nZXRfdXJpX3BhcmFtX2J5X25hbWUiLCJ1cmwiLCJkZWNvZGVVUklDb21wb25lbnQiLCJyZWdleCIsIlJlZ0V4cCIsInJlc3VsdHMiLCJleGVjIiwibWVzc2FnZSIsInBhcmFtc19kZWZhdWx0IiwicF9rZXkiLCJ1bmlxdWVfZGl2X2lkIiwic2Nyb2xsX3RvX2VsZW1lbnQiLCJqcV9lbF9tZXNzYWdlIiwiaXNfc2hvd19tZXNzYWdlIiwiYXBwZW5kIiwiaHRtbCIsInNpYmxpbmdzIiwiaXMiLCJiZWZvcmUiLCJuZXh0QWxsIiwiZmFkZU91dCIsImNsb3NlZF90aW1lcjIiLCJwYXJlbnRfZWxzIiwicGFyZW50cyIsIm1hcCIsInNob3ciLCJ3cGJjX2RvX3Njcm9sbCIsIndwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yIiwibm90aWNlX21lc3NhZ2VfaWQiLCJ3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcl91bmRlcl9lbGVtZW50IiwibWVzc2FnZV9kZWxheSIsIndwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yX2Fib3ZlX2VsZW1lbnQiLCJ3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nIiwid3BiY19oaWdobGlnaHRfZXJyb3Jfb25fZm9ybV9maWVsZCIsIndwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfdW5kZXJfZWxlbWVudCIsIndwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfYWJvdmVfZWxlbWVudCIsImpxX25vZGVfYXJyIiwiZXh0cmFfc2hpZnRfb2Zmc2V0IiwidGFyZ2V0T2Zmc2V0Iiwib2Zmc2V0IiwidG9wIiwiZmlyc3QiLCJhbmltYXRlIiwic2Nyb2xsVG9wIiwid3BiY19kZWZpbmVfdGlwcHlfcG9wb3ZlciIsInBvcG92ZXJfdGl0bGUiLCJzdGF0ZSIsImlzVmlzaWJsZSIsImhpZGUiLCJ3cGJjX2RlZmluZV9oaWRlX3RpcHB5X29uX3Njcm9sbCIsImhpZGVBbGwiXSwic291cmNlcyI6WyJ3cGJjX3V0aWxzLmpzIiwid3BiYy5qcyIsImFqeF9sb2FkX2JhbGFuY2VyLmpzIiwid3BiY19jYWwuanMiLCJkYXlzX3NlbGVjdF9jdXN0b20uanMiLCJ3cGJjX2NhbF9hanguanMiLCJ3cGJjX2ZlX21lc3NhZ2VzLmpzIiwidGltZWxpbmVfcG9wb3Zlci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqIEphdmFTY3JpcHQgVXRpbCBGdW5jdGlvbnNcdFx0Li4vaW5jbHVkZXMvX19qcy91dGlscy93cGJjX3V0aWxzLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBUcmltICBzdHJpbmdzIGFuZCBhcnJheSBqb2luZWQgd2l0aCAgKCwpXHJcbiAqXHJcbiAqIEBwYXJhbSBzdHJpbmdfdG9fdHJpbSAgIHN0cmluZyAvIGFycmF5XHJcbiAqIEByZXR1cm5zIHN0cmluZ1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY190cmltKCBzdHJpbmdfdG9fdHJpbSApe1xyXG5cclxuICAgIGlmICggQXJyYXkuaXNBcnJheSggc3RyaW5nX3RvX3RyaW0gKSApe1xyXG4gICAgICAgIHN0cmluZ190b190cmltID0gc3RyaW5nX3RvX3RyaW0uam9pbiggJywnICk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCAnc3RyaW5nJyA9PSB0eXBlb2YgKHN0cmluZ190b190cmltKSApe1xyXG4gICAgICAgIHN0cmluZ190b190cmltID0gc3RyaW5nX3RvX3RyaW0udHJpbSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBzdHJpbmdfdG9fdHJpbTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIGVsZW1lbnQgaW4gYXJyYXlcclxuICpcclxuICogQHBhcmFtIGFycmF5X2hlcmVcdFx0YXJyYXlcclxuICogQHBhcmFtIHBfdmFsXHRcdFx0XHRlbGVtZW50IHRvICBjaGVja1xyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfaW5fYXJyYXkoIGFycmF5X2hlcmUsIHBfdmFsICl7XHJcblx0Zm9yICggdmFyIGkgPSAwLCBsID0gYXJyYXlfaGVyZS5sZW5ndGg7IGkgPCBsOyBpKysgKXtcclxuXHRcdGlmICggYXJyYXlfaGVyZVsgaSBdID09IHBfdmFsICl7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gZmFsc2U7XHJcbn1cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvd3BiYy93cGJjLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBEZWVwIENsb25lIG9mIG9iamVjdCBvciBhcnJheVxyXG4gKlxyXG4gKiBAcGFyYW0gb2JqXHJcbiAqIEByZXR1cm5zIHthbnl9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Nsb25lX29iaiggb2JqICl7XHJcblxyXG5cdHJldHVybiBKU09OLnBhcnNlKCBKU09OLnN0cmluZ2lmeSggb2JqICkgKTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogTWFpbiBfd3BiYyBKUyBvYmplY3RcclxuICovXHJcblxyXG52YXIgX3dwYmMgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gU2VjdXJlIHBhcmFtZXRlcnMgZm9yIEFqYXhcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlY3VyZSA9IG9iai5zZWN1cml0eV9vYmogPSBvYmouc2VjdXJpdHlfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcl9pZDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm9uY2UgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsZSA6ICcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH07XHJcblx0b2JqLnNldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9zZWN1cmVbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBDYWxlbmRhcnMgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfY2FsZW5kYXJzID0gb2JqLmNhbGVuZGFyc19vYmogPSBvYmouY2FsZW5kYXJzX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgY2FsZW5kYXIgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBDcmVhdGUgQ2FsZW5kYXIgaW5pdGlhbGl6aW5nXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pbml0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgXSA9IGZhbHNlO1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayAgaWYgdGhlIHR5cGUgb2YgdGhpcyBwcm9wZXJ0eSAgaXMgSU5UXHJcblx0ICogQHBhcmFtIHByb3BlcnR5X25hbWVcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2lzX3Byb3BfaW50ID0gZnVuY3Rpb24gKCBwcm9wZXJ0eV9uYW1lICkge1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOS4wLjI5LlxyXG5cclxuXHRcdHZhciBwX2NhbGVuZGFyX2ludF9wcm9wZXJ0aWVzID0gWydkeW5hbWljX19kYXlzX21pbicsICdkeW5hbWljX19kYXlzX21heCcsICdmaXhlZF9fZGF5c19udW0nXTtcclxuXHJcblx0XHR2YXIgaXNfaW5jbHVkZSA9IHBfY2FsZW5kYXJfaW50X3Byb3BlcnRpZXMuaW5jbHVkZXMoIHByb3BlcnR5X25hbWUgKTtcclxuXHJcblx0XHRyZXR1cm4gaXNfaW5jbHVkZTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHBhcmFtcyBmb3IgYWxsICBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcnNfb2JqXHRcdE9iamVjdCB7IGNhbGVuZGFyXzE6IHt9IH1cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgY2FsZW5kYXJfMzoge30sIC4uLiB9XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyc19hbGxfX3NldCA9IGZ1bmN0aW9uICggY2FsZW5kYXJzX29iaiApIHtcclxuXHRcdHBfY2FsZW5kYXJzID0gY2FsZW5kYXJzX29iajtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYm9va2luZ3MgaW4gYWxsIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJzX2FsbF9fZ2V0ID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfY2FsZW5kYXJzO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgaWQ6IDEsIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdFx0eyBpZDogMiAs4oCmIH1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2dldF9wYXJhbWV0ZXJzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRpZiAoIG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0cmV0dXJuIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBpZiBjYWxlbmRhciBvYmplY3QgIG5vdCBkZWZpbmVkLCB0aGVuICBpdCdzIHdpbGwgYmUgZGVmaW5lZCBhbmQgSUQgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gIHN5c3RlbSBzZXQgIGFzIG5ldyBvciBvdmVyd3JpdGUgb25seSBwcm9wZXJ0aWVzIGZyb20gY2FsZW5kYXJfcHJvcGVydHlfb2JqIHBhcmFtZXRlciwgIGJ1dCBvdGhlciBwcm9wZXJ0aWVzIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZSwgbGlrZSAnaWQnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcl9wcm9wZXJ0eV9vYmpcdFx0XHRcdFx0ICB7ICBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9ICB9XHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19jb21wbGV0ZV9vdmVyd3JpdGVcdFx0ICBpZiAndHJ1ZScgKGRlZmF1bHQ6ICdmYWxzZScpLCAgdGhlbiAgb25seSBvdmVyd3JpdGUgb3IgYWRkICBuZXcgcHJvcGVydGllcyBpbiAgY2FsZW5kYXJfcHJvcGVydHlfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5jYWxlbmRhcl9fc2V0KCAgXCIgLmludHZhbCggJHJlc291cmNlX2lkICkgLiBcIiwgeyAnZGF0ZXMnOiBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgfSApO1wiO1xyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBjYWxlbmRhcl9wcm9wZXJ0eV9vYmosIGlzX2NvbXBsZXRlX292ZXJ3cml0ZSA9IGZhbHNlICApIHtcclxuXHJcblx0XHRpZiAoICghb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApKSB8fCAodHJ1ZSA9PT0gaXNfY29tcGxldGVfb3ZlcndyaXRlKSApe1xyXG5cdFx0XHRvYmouY2FsZW5kYXJfX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBjYWxlbmRhcl9wcm9wZXJ0eV9vYmogKXtcclxuXHJcblx0XHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gY2FsZW5kYXJfcHJvcGVydHlfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgcHJvcGVydHkgIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XCIxXCJcclxuXHQgKiBAcGFyYW0gcHJvcF9uYW1lXHRcdG5hbWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcGFyYW0gcHJvcF92YWx1ZVx0dmFsdWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcmV0dXJucyB7Kn1cdFx0XHRjYWxlbmRhciBvYmplY3RcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSwgcHJvcF92YWx1ZSApIHtcclxuXHJcblx0XHRpZiAoICghb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApKSApe1xyXG5cdFx0XHRvYmouY2FsZW5kYXJfX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblxyXG5cdFx0cF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBwcm9wX3ZhbHVlO1xyXG5cclxuXHRcdHJldHVybiBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgY2FsZW5kYXIgcHJvcGVydHkgdmFsdWUgICBcdDo6ICAgbWl4ZWQgfCBudWxsXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9ICByZXNvdXJjZV9pZFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcHJvcF9uYW1lXHRcdFx0J3NlbGVjdGlvbl9tb2RlJ1xyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHRcdFx0XHRcdG1peGVkIHwgbnVsbFxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBwcm9wX25hbWUgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmNhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHQvLyBGaXhJbjogOS45LjAuMjkuXHJcblx0XHRcdGlmICggb2JqLmNhbGVuZGFyX19pc19wcm9wX2ludCggcHJvcF9uYW1lICkgKXtcclxuXHRcdFx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IHBhcnNlSW50KCBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSApO1xyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiAgcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG51bGw7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gbnVsbDtcclxuXHR9O1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHQvLyBCb29raW5ncyBcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9ib29raW5ncyA9IG9iai5ib29raW5nc19vYmogPSBvYmouYm9va2luZ3Nfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBjYWxlbmRhcl8xOiBPYmplY3Qge1xyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAgIGlkOiAgICAgMVxyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgYm9va2luZ3MgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSApICk7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBpZDogMSAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0XHR7IGlkOiAyICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0ID0gZnVuY3Rpb24oIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGNhbGVuZGFyIG9iamVjdCAgIDo6ICAgeyBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBpZiBjYWxlbmRhciBvYmplY3QgIG5vdCBkZWZpbmVkLCB0aGVuICBpdCdzIHdpbGwgYmUgZGVmaW5lZCBhbmQgSUQgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gIHN5c3RlbSBzZXQgIGFzIG5ldyBvciBvdmVyd3JpdGUgb25seSBwcm9wZXJ0aWVzIGZyb20gY2FsZW5kYXJfb2JqIHBhcmFtZXRlciwgIGJ1dCBvdGhlciBwcm9wZXJ0aWVzIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZSwgbGlrZSAnaWQnXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBjYWxlbmRhcl9vYmpcdFx0XHRcdFx0ICB7ICBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9ICB9XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0KCAgXCIgLmludHZhbCggJHJlc291cmNlX2lkICkgLiBcIiwgeyAnZGF0ZXMnOiBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgfSApO1wiO1xyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0ID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBjYWxlbmRhcl9vYmogKXtcclxuXHJcblx0XHRpZiAoICEgb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdpZCcgXSA9IHJlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gY2FsZW5kYXJfb2JqICl7XHJcblxyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gY2FsZW5kYXJfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cdC8vIERhdGVzXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3IgQUxMIERhdGVzIGluIGNhbGVuZGFyICAgOjogICBmYWxzZSB8IHsgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0JzEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0ZmFsc2UgfCBPYmplY3Qge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yNFwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJhdmFpbGFibGVcIiwgZGF5X2F2YWlsYWJpbGl0eTogMSwgbWF4X2NhcGFjaXR5OiAxLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yNlwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJmdWxsX2RheV9ib29raW5nXCIsIFsnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJ106IFwicGVuZGluZ1wiLCBkYXlfYXZhaWxhYmlsaXR5OiAwLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0yOVwiOiBPYmplY3QgeyBbJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknXTogXCJyZXNvdXJjZV9hdmFpbGFiaWxpdHlcIiwgZGF5X2F2YWlsYWJpbGl0eTogMCwgbWF4X2NhcGFjaXR5OiAxLCDigKYgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiMjAyMy0wNy0zMFwiOiB74oCmfSwgXCIyMDIzLTA3LTMxXCI6IHvigKZ9LCDigKZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2RhdGVzID0gZnVuY3Rpb24oIHJlc291cmNlX2lkKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBmYWxzZTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgYm9va2luZ3MgZGF0ZXMgaW4gY2FsZW5kYXIgb2JqZWN0ICAgOjogICAgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kICdpZCcsICdkYXRlcycgc2V0XHJcblx0ICogaWYgY2FsZW5kYXIgZXhpc3QsIHRoZW4gc3lzdGVtIGFkZCBhICBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgZGF0ZXMgZnJvbSBkYXRlc19vYmogcGFyYW1ldGVyLFxyXG5cdCAqIGJ1dCBvdGhlciBkYXRlcyBub3QgZnJvbSBwYXJhbWV0ZXIgZGF0ZXNfb2JqIHdpbGwgYmUgZXhpc3RlZCBhbmQgbm90IG92ZXJ3cml0ZS5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGRhdGVzX29ialx0XHRcdFx0XHQgIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKiBAcGFyYW0ge2Jvb2xlYW59IGlzX2NvbXBsZXRlX292ZXJ3cml0ZVx0XHQgIGlmIGZhbHNlLCAgdGhlbiAgb25seSBvdmVyd3JpdGUgb3IgYWRkICBkYXRlcyBmcm9tIFx0ZGF0ZXNfb2JqXHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICpcclxuXHQgKiBFeGFtcGxlczpcclxuXHQgKiAgIFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoIHJlc291cmNlX2lkLCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCDigKYgfSAgKTtcdFx0PC0gICBvdmVyd3JpdGUgQUxMIGRhdGVzXHJcblx0ICogICBcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjJcIjoge+KApn0gfSwgIGZhbHNlICApO1x0XHRcdFx0XHQ8LSAgIGFkZCBvciBvdmVyd3JpdGUgb25seSAgXHRcIjIwMjMtMDctMjJcIjoge31cclxuXHQgKlxyXG5cdCAqIENvbW1vbiB1c2FnZSBpbiBQSFA6XHJcblx0ICogICBcdFx0XHRlY2hvIFwiICBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzKCAgXCIgLiBpbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsICBcIiAuIHdwX2pzb25fZW5jb2RlKCAkYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FyciApIC4gXCIgICk7ICBcIjtcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgZGF0ZXNfb2JqICwgaXNfY29tcGxldGVfb3ZlcndyaXRlID0gdHJ1ZSApe1xyXG5cclxuXHRcdGlmICggIW9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cdFx0XHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldCggcmVzb3VyY2VfaWQsIHsgJ2RhdGVzJzoge30gfSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0pICl7XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdID0ge31cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoaXNfY29tcGxldGVfb3ZlcndyaXRlKXtcclxuXHJcblx0XHRcdC8vIENvbXBsZXRlIG92ZXJ3cml0ZSBhbGwgIGJvb2tpbmcgZGF0ZXNcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gPSBkYXRlc19vYmo7XHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0Ly8gQWRkIG9ubHkgIG5ldyBvciBvdmVyd3JpdGUgZXhpc3QgYm9va2luZyBkYXRlcyBmcm9tICBwYXJhbWV0ZXIuIEJvb2tpbmcgZGF0ZXMgbm90IGZyb20gIHBhcmFtZXRlciAgd2lsbCAgYmUgd2l0aG91dCBjaG5hbmdlc1xyXG5cdFx0XHRmb3IgKCB2YXIgcHJvcF9uYW1lIGluIGRhdGVzX29iaiApe1xyXG5cclxuXHRcdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bJ2RhdGVzJ11bIHByb3BfbmFtZSBdID0gZGF0ZXNfb2JqWyBwcm9wX25hbWUgXTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3Igc3BlY2lmaWMgZGF0ZSBpbiBjYWxlbmRhciAgIDo6ICAgZmFsc2UgfCB7IGRheV9hdmFpbGFiaWxpdHk6IDEsIC4uLiB9XHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXlcdFx0XHQnMjAyMy0wNy0yMSdcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRmYWxzZSB8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ZGF5X2F2YWlsYWJpbGl0eTogNFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtYXhfY2FwYWNpdHk6IDRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAgPj0gQnVzaW5lc3MgTGFyZ2VcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MjogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQxMDogT2JqZWN0IHsgaXNfZGF5X3VuYXZhaWxhYmxlOiBmYWxzZSwgX2RheV9zdGF0dXM6IFwiYXZhaWxhYmxlXCIgfVx0XHQvLyAgPj0gQnVzaW5lc3MgTGFyZ2UgLi4uXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDExOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDEyOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdWyBzcWxfY2xhc3NfZGF5IF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVzJyBdWyBzcWxfY2xhc3NfZGF5IF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIGZhbHNlO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBBbnkgIFBBUkFNUyAgIGluIGJvb2tpbmdzXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBwcm9wZXJ0eSAgdG8gIGJvb2tpbmdcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFwiMVwiXHJcblx0ICogQHBhcmFtIHByb3BfbmFtZVx0XHRuYW1lIG9mIHByb3BlcnR5XHJcblx0ICogQHBhcmFtIHByb3BfdmFsdWVcdHZhbHVlIG9mIHByb3BlcnR5XHJcblx0ICogQHJldHVybnMgeyp9XHRcdFx0Ym9va2luZyBvYmplY3RcclxuXHQgKi9cclxuXHRvYmouYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lLCBwcm9wX3ZhbHVlICkge1xyXG5cclxuXHRcdGlmICggISBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2lkJyBdID0gcmVzb3VyY2VfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IHByb3BfdmFsdWU7XHJcblxyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGJvb2tpbmcgcHJvcGVydHkgdmFsdWUgICBcdDo6ICAgbWl4ZWQgfCBudWxsXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9ICByZXNvdXJjZV9pZFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gcHJvcF9uYW1lXHRcdFx0J3NlbGVjdGlvbl9tb2RlJ1xyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHRcdFx0XHRcdG1peGVkIHwgbnVsbFxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIHByb3BfbmFtZSApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuICBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIG51bGw7XHJcblx0fTtcclxuXHJcblxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogU2V0IGJvb2tpbmdzIGZvciBhbGwgIGNhbGVuZGFyc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGNhbGVuZGFyc19vYmpcdFx0T2JqZWN0IHsgY2FsZW5kYXJfMTogeyBpZDogMSwgZGF0ZXM6IE9iamVjdCB7IFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCBcIjIwMjMtMDctMjRcIjoge+KApn0sIOKApiB9IH1cclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgY2FsZW5kYXJfMzoge30sIC4uLiB9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyc19fc2V0X2FsbCA9IGZ1bmN0aW9uICggY2FsZW5kYXJzX29iaiApIHtcclxuXHRcdHBfYm9va2luZ3MgPSBjYWxlbmRhcnNfb2JqO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBib29raW5ncyBpbiBhbGwgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcnNfX2dldF9hbGwgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9ib29raW5ncztcclxuXHR9O1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHJcblxyXG5cdC8vIFNlYXNvbnMgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfc2Vhc29ucyA9IG9iai5zZWFzb25zX29iaiA9IG9iai5zZWFzb25zX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gY2FsZW5kYXJfMTogT2JqZWN0IHtcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgICBpZDogICAgIDFcclxuIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9cdFx0XHRcdFx0XHQgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKAplxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogQWRkIHNlYXNvbiBuYW1lcyBmb3IgZGF0ZXMgaW4gY2FsZW5kYXIgb2JqZWN0ICAgOjogICAgeyBcIjIwMjMtMDctMjFcIjogWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF0sIFwiMjAyMy0wNy0yMlwiOiBbLi4uXSwgLi4uIH1cclxuXHQgKlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gZGF0ZXNfb2JqXHRcdFx0XHRcdCAgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgZmFsc2UsICB0aGVuICBvbmx5ICBhZGQgIGRhdGVzIGZyb20gXHRkYXRlc19vYmpcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGVzOlxyXG5cdCAqICAgXHRcdFx0X3dwYmMuc2Vhc29uc19fc2V0KCByZXNvdXJjZV9pZCwgeyBcIjIwMjMtMDctMjFcIjogWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF0sIFwiMjAyMy0wNy0yMlwiOiBbLi4uXSwgLi4uIH0gICk7XHJcblx0ICovXHJcblx0b2JqLnNlYXNvbnNfX3NldCA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgZGF0ZXNfb2JqICwgaXNfY29tcGxldGVfb3ZlcndyaXRlID0gZmFsc2UgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdKSApe1xyXG5cdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IHt9O1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggaXNfY29tcGxldGVfb3ZlcndyaXRlICl7XHJcblxyXG5cdFx0XHQvLyBDb21wbGV0ZSBvdmVyd3JpdGUgYWxsICBzZWFzb24gZGF0ZXNcclxuXHRcdFx0cF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSBkYXRlc19vYmo7XHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdC8vIEFkZCBvbmx5ICBuZXcgb3Igb3ZlcndyaXRlIGV4aXN0IGJvb2tpbmcgZGF0ZXMgZnJvbSAgcGFyYW1ldGVyLiBCb29raW5nIGRhdGVzIG5vdCBmcm9tICBwYXJhbWV0ZXIgIHdpbGwgIGJlIHdpdGhvdXQgY2huYW5nZXNcclxuXHRcdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBkYXRlc19vYmogKXtcclxuXHJcblx0XHRcdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0pICl7XHJcblx0XHRcdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBbXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0Zm9yICggdmFyIHNlYXNvbl9uYW1lX2tleSBpbiBkYXRlc19vYmpbIHByb3BfbmFtZSBdICl7XHJcblx0XHRcdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0ucHVzaCggZGF0ZXNfb2JqWyBwcm9wX25hbWUgXVsgc2Vhc29uX25hbWVfa2V5IF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZ3MgZGF0YSBmb3Igc3BlY2lmaWMgZGF0ZSBpbiBjYWxlbmRhciAgIDo6ICAgW10gfCBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdCcxJ1xyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBzcWxfY2xhc3NfZGF5XHRcdFx0JzIwMjMtMDctMjEnXHJcblx0ICogQHJldHVybnMge29iamVjdHxib29sZWFufVx0XHRcdFx0W10gIHwgIFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdXHJcblx0ICovXHJcblx0b2JqLnNlYXNvbnNfX2dldF9mb3JfZGF0ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBzcWxfY2xhc3NfZGF5IF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBzcWxfY2xhc3NfZGF5IF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFtdO1x0XHQvLyBJZiBub3QgZGVmaW5lZCwgdGhlbiBbXTtcclxuXHR9O1xyXG5cclxuXHJcblx0Ly8gT3RoZXIgcGFyYW1ldGVycyBcdFx0XHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9vdGhlciA9IG9iai5vdGhlcl9vYmogPSBvYmoub3RoZXJfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9vdGhlcl9wYXJhbSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlclsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFsbCBvdGhlciBwYXJhbXNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmdldF9vdGhlcl9wYXJhbV9fYWxsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXI7XHJcblx0fTtcclxuXHJcblx0Ly8gTWVzc2FnZXMgXHRcdFx0ICAgICAgICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9tZXNzYWdlcyA9IG9iai5tZXNzYWdlc19vYmogPSBvYmoubWVzc2FnZXNfb2JqIHx8IHsgfTtcclxuXHJcblx0b2JqLnNldF9tZXNzYWdlID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfbWVzc2FnZXNbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfbWVzc2FnZSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfbWVzc2FnZXNbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgb3RoZXIgcGFyYW1zXHJcblx0ICpcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fHt9fVxyXG5cdCAqL1xyXG5cdG9iai5nZXRfbWVzc2FnZXNfX2FsbCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX21lc3NhZ2VzO1xyXG5cdH07XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHJldHVybiBvYmo7XHJcblxyXG59KCBfd3BiYyB8fCB7fSwgalF1ZXJ5ICkpO1xyXG4iLCIvKipcclxuICogRXh0ZW5kIF93cGJjIHdpdGggIG5ldyBtZXRob2RzICAgICAgICAvLyBGaXhJbjogOS44LjYuMi5cclxuICpcclxuICogQHR5cGUgeyp8e319XHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG4gX3dwYmMgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gTG9hZCBCYWxhbmNlciBcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHZhciBwX2JhbGFuY2VyID0gb2JqLmJhbGFuY2VyX29iaiA9IG9iai5iYWxhbmNlcl9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdtYXhfdGhyZWFkcyc6IDIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2luX3Byb2Nlc3MnIDogW10sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3dhaXQnICAgICAgIDogW11cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0IC8qKlxyXG5cdCAgKiBTZXQgIG1heCBwYXJhbGxlbCByZXF1ZXN0ICB0byAgbG9hZFxyXG5cdCAgKlxyXG5cdCAgKiBAcGFyYW0gbWF4X3RocmVhZHNcclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19zZXRfbWF4X3RocmVhZHMgPSBmdW5jdGlvbiAoIG1heF90aHJlYWRzICl7XHJcblxyXG5cdFx0cF9iYWxhbmNlclsgJ21heF90aHJlYWRzJyBdID0gbWF4X3RocmVhZHM7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGJhbGFuY2VyIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5iYWxhbmNlcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2JhbGFuY2VyWyAnYmFsYW5jZXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgQ3JlYXRlIGJhbGFuY2VyIGluaXRpYWxpemluZ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdG9iai5iYWxhbmNlcl9faW5pdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgLCBwYXJhbXMgPXt9KSB7XHJcblxyXG5cdFx0dmFyIGJhbGFuY2Vfb2JqID0ge307XHJcblx0XHRiYWxhbmNlX29ialsgJ3Jlc291cmNlX2lkJyBdICAgPSByZXNvdXJjZV9pZDtcclxuXHRcdGJhbGFuY2Vfb2JqWyAncHJpb3JpdHknIF0gICAgICA9IDE7XHJcblx0XHRiYWxhbmNlX29ialsgJ2Z1bmN0aW9uX25hbWUnIF0gPSBmdW5jdGlvbl9uYW1lO1xyXG5cdFx0YmFsYW5jZV9vYmpbICdwYXJhbXMnIF0gICAgICAgID0gd3BiY19jbG9uZV9vYmooIHBhcmFtcyApO1xyXG5cclxuXHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV9ydW4oIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICkgKXtcclxuXHRcdFx0cmV0dXJuICdydW4nO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfd2FpdCggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKSApe1xyXG5cdFx0XHRyZXR1cm4gJ3dhaXQnO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9fY2FuX2lfcnVuKCkgKXtcclxuXHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biggYmFsYW5jZV9vYmogKTtcclxuXHRcdFx0cmV0dXJuICdydW4nO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3dhaXQoIGJhbGFuY2Vfb2JqICk7XHJcblx0XHRcdHJldHVybiAnd2FpdCc7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0IC8qKlxyXG5cdCAgKiBDYW4gSSBSdW4gP1xyXG5cdCAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19jYW5faV9ydW4gPSBmdW5jdGlvbiAoKXtcclxuXHRcdHJldHVybiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCA8IHBfYmFsYW5jZXJbICdtYXhfdGhyZWFkcycgXSApO1xyXG5cdH1cclxuXHJcblx0XHQgLyoqXHJcblx0XHQgICogQWRkIHRvIFdBSVRcclxuXHRcdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX193YWl0ID0gZnVuY3Rpb24gKCBiYWxhbmNlX29iaiApIHtcclxuXHRcdFx0cF9iYWxhbmNlclsnd2FpdCddLnB1c2goIGJhbGFuY2Vfb2JqICk7XHJcblx0XHR9XHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIFJlbW92ZSBmcm9tIFdhaXRcclxuXHRcdCAgKlxyXG5cdFx0ICAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICAqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQgICogQHJldHVybnMgeyp8Ym9vbGVhbn1cclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdHZhciByZW1vdmVkX2VsID0gZmFsc2U7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ3dhaXQnIF0gKXtcclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0KHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHJlbW92ZWRfZWwgPSBwX2JhbGFuY2VyWyAnd2FpdCcgXS5zcGxpY2UoIGksIDEgKTtcclxuXHRcdFx0XHRcdFx0cmVtb3ZlZF9lbCA9IHJlbW92ZWRfZWwucG9wKCk7XHJcblx0XHRcdFx0XHRcdHBfYmFsYW5jZXJbICd3YWl0JyBdID0gcF9iYWxhbmNlclsgJ3dhaXQnIF0uZmlsdGVyKCBmdW5jdGlvbiAoIHYgKXtcclxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdjtcclxuXHRcdFx0XHRcdFx0fSApO1x0XHRcdFx0XHQvLyBSZWluZGV4IGFycmF5XHJcblx0XHRcdFx0XHRcdHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCogSXMgYWxyZWFkeSBXQUlUXHJcblx0XHQqXHJcblx0XHQqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0KiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCovXHJcblx0XHRvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfd2FpdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdGlmICggcF9iYWxhbmNlclsgJ3dhaXQnIF0ubGVuZ3RoICl7XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ3dhaXQnIF0gKXtcclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0KHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdCAvKipcclxuXHRcdCAgKiBBZGQgdG8gUlVOXHJcblx0XHQgICogQHBhcmFtIGJhbGFuY2Vfb2JqXHJcblx0XHQgICovXHJcblx0XHRvYmouYmFsYW5jZXJfX2FkZF90b19fcnVuID0gZnVuY3Rpb24gKCBiYWxhbmNlX29iaiApIHtcclxuXHRcdFx0cF9iYWxhbmNlclsnaW5fcHJvY2VzcyddLnB1c2goIGJhbGFuY2Vfb2JqICk7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQqIFJlbW92ZSBmcm9tIFJVTiBsaXN0XHJcblx0XHQqXHJcblx0XHQqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0KiBAcGFyYW0gZnVuY3Rpb25fbmFtZVxyXG5cdFx0KiBAcmV0dXJucyB7Knxib29sZWFufVxyXG5cdFx0Ki9cclxuXHRcdG9iai5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3J1bl9saXN0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApe1xyXG5cclxuXHRcdFx0IHZhciByZW1vdmVkX2VsID0gZmFsc2U7XHJcblxyXG5cdFx0XHQgaWYgKCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXS5sZW5ndGggKXtcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHQgZm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gKXtcclxuXHRcdFx0XHRcdCBpZiAoXHJcblx0XHRcdFx0XHRcdCAocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0ICYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCApe1xyXG5cdFx0XHRcdFx0XHQgcmVtb3ZlZF9lbCA9IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLnNwbGljZSggaSwgMSApO1xyXG5cdFx0XHRcdFx0XHQgcmVtb3ZlZF9lbCA9IHJlbW92ZWRfZWwucG9wKCk7XHJcblx0XHRcdFx0XHRcdCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXSA9IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmZpbHRlciggZnVuY3Rpb24gKCB2ICl7XHJcblx0XHRcdFx0XHRcdFx0IHJldHVybiB2O1xyXG5cdFx0XHRcdFx0XHQgfSApO1x0XHQvLyBSZWluZGV4IGFycmF5XHJcblx0XHRcdFx0XHRcdCByZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdFx0XHRcdCB9XHJcblx0XHRcdFx0IH1cclxuXHRcdFx0IH1cclxuXHRcdFx0IHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0KiBJcyBhbHJlYWR5IFJVTlxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3J1biA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdGlmICggcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0ubGVuZ3RoICl7XHRcdFx0XHRcdC8vIEZpeEluOiA5LjguMTAuMS5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXSApe1xyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0JiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblxyXG5cclxuXHRvYmouYmFsYW5jZXJfX3J1bl9uZXh0ID0gZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0Ly8gR2V0IDFzdCBmcm9tICBXYWl0IGxpc3RcclxuXHRcdHZhciByZW1vdmVkX2VsID0gZmFsc2U7XHJcblx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICd3YWl0JyBdICl7XHJcblx0XHRcdFx0cmVtb3ZlZF9lbCA9IG9iai5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCggcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdLCBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSApO1xyXG5cdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBmYWxzZSAhPT0gcmVtb3ZlZF9lbCApe1xyXG5cclxuXHRcdFx0Ly8gUnVuXHJcblx0XHRcdG9iai5iYWxhbmNlcl9fcnVuKCByZW1vdmVkX2VsICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQgLyoqXHJcblx0ICAqIFJ1blxyXG5cdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19ydW4gPSBmdW5jdGlvbiAoIGJhbGFuY2Vfb2JqICl7XHJcblxyXG5cdFx0c3dpdGNoICggYmFsYW5jZV9vYmpbICdmdW5jdGlvbl9uYW1lJyBdICl7XHJcblxyXG5cdFx0XHRjYXNlICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCc6XHJcblxyXG5cdFx0XHRcdC8vIEFkZCB0byBydW4gbGlzdFxyXG5cdFx0XHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX19ydW4oIGJhbGFuY2Vfb2JqICk7XHJcblxyXG5cdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4KCBiYWxhbmNlX29ialsgJ3BhcmFtcycgXSApXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRkZWZhdWx0OlxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIG9iajtcclxuXHJcbn0oIF93cGJjIHx8IHt9LCBqUXVlcnkgKSk7XHJcblxyXG5cclxuIFx0LyoqXHJcbiBcdCAqIC0tIEhlbHAgZnVuY3Rpb25zIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKi9cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iYWxhbmNlcl9faXNfd2FpdCggcGFyYW1zLCBmdW5jdGlvbl9uYW1lICl7XHJcbi8vY29uc29sZS5sb2coJzo6d3BiY19iYWxhbmNlcl9faXNfd2FpdCcscGFyYW1zICwgZnVuY3Rpb25fbmFtZSApO1xyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSkgKXtcclxuXHJcblx0XHRcdHZhciBiYWxhbmNlcl9zdGF0dXMgPSBfd3BiYy5iYWxhbmNlcl9faW5pdCggcGFyYW1zWyAncmVzb3VyY2VfaWQnIF0sIGZ1bmN0aW9uX25hbWUsIHBhcmFtcyApO1xyXG5cclxuXHRcdFx0cmV0dXJuICggJ3dhaXQnID09PSBiYWxhbmNlcl9zdGF0dXMgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19iYWxhbmNlcl9fY29tcGxldGVkKCByZXNvdXJjZV9pZCAsIGZ1bmN0aW9uX25hbWUgKXtcclxuLy9jb25zb2xlLmxvZygnOjp3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQnLHJlc291cmNlX2lkICwgZnVuY3Rpb25fbmFtZSApO1xyXG5cdFx0X3dwYmMuYmFsYW5jZXJfX3JlbW92ZV9mcm9tX19ydW5fbGlzdCggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKTtcclxuXHRcdF93cGJjLmJhbGFuY2VyX19ydW5fbmV4dCgpO1xyXG5cdH0iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2NhbC93cGJjX2NhbC5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vKipcclxuICogT3JkZXIgb3IgY2hpbGQgYm9va2luZyByZXNvdXJjZXMgc2F2ZWQgaGVyZTogIFx0X3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyApXHRcdFsyLDEwLDEyLDExXVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBIb3cgdG8gY2hlY2sgIGJvb2tlZCB0aW1lcyBvbiAgc3BlY2lmaWMgZGF0ZTogP1xyXG4gKlxyXG5cdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKTtcclxuXHJcblx0XHRcdGNvbnNvbGUubG9nKFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcyxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTBdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMV0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHMsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1xyXG5cdFx0XHRcdFx0KTtcclxuICogIE9SXHJcblx0XHRcdGNvbnNvbGUubG9nKFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGUsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEwXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGUsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzExXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGUsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfcmVhZGFibGVcclxuXHRcdFx0XHRcdCk7XHJcbiAqXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIERheXMgc2VsZWN0aW9uOlxyXG4gKiBcdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApO1xyXG4gKlxyXG4gKlx0XHRcdFx0XHR2YXIgcmVzb3VyY2VfaWQgPSAxO1xyXG4gKiBcdEV4YW1wbGUgMTpcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqIFx0RXhhbXBsZSAyOlx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjUnXSApO1xyXG4gKlxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogQyBBIEwgRSBOIEQgQSBSICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqICBTaG93IFdQQkMgQ2FsZW5kYXJcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdFx0LSByZXNvdXJjZSBJRFxyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfc2hvdyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gSWYgbm8gY2FsZW5kYXIgSFRNTCB0YWcsICB0aGVuICBleGl0XHJcblx0aWYgKCAwID09PSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmxlbmd0aCApeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcblx0Ly8gSWYgdGhlIGNhbGVuZGFyIHdpdGggdGhlIHNhbWUgQm9va2luZyByZXNvdXJjZSBpcyBhY3RpdmF0ZWQgYWxyZWFkeSwgdGhlbiBleGl0LlxyXG5cdGlmICggdHJ1ZSA9PT0galF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5oYXNDbGFzcyggJ2hhc0RhdGVwaWNrJyApICl7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIERheXMgc2VsZWN0aW9uXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCA9IGZhbHNlO1xyXG5cdHZhciBsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtICAgPSAzNjU7XHRcdFx0XHRcdC8vIG11bHRpcGxlIHwgZml4ZWRcclxuXHRpZiAoICdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0ID0gdHJ1ZTtcclxuXHRcdGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gPSAwO1xyXG5cdH1cclxuXHRpZiAoICdzaW5nbGUnICA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblx0XHRsb2NhbF9fbXVsdGlfZGF5c19zZWxlY3RfbnVtID0gMDtcclxuXHR9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTWluIC0gTWF4IGRheXMgdG8gc2Nyb2xsL3Nob3dcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBsb2NhbF9fbWluX2RhdGUgPSAwO1xyXG4gXHRsb2NhbF9fbWluX2RhdGUgPSBuZXcgRGF0ZSggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAwIF0sIChwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAxIF0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDIgXSwgMCwgMCwgMCApO1x0XHRcdC8vIEZpeEluOiA5LjkuMC4xNy5cclxuLy9jb25zb2xlLmxvZyggbG9jYWxfX21pbl9kYXRlICk7XHJcblx0dmFyIGxvY2FsX19tYXhfZGF0ZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhcicgKTtcclxuXHQvL2xvY2FsX19tYXhfZGF0ZSA9IG5ldyBEYXRlKDIwMjQsIDUsIDI4KTsgIEl0IGlzIGhlcmUgaXNzdWUgb2Ygbm90IHNlbGVjdGFibGUgZGF0ZXMsIGJ1dCBzb21lIGRhdGVzIHNob3dpbmcgaW4gY2FsZW5kYXIgYXMgYXZhaWxhYmxlLCBidXQgd2UgY2FuIG5vdCBzZWxlY3QgaXQuXHJcblxyXG5cdC8vLy8gRGVmaW5lIGxhc3QgZGF5IGluIGNhbGVuZGFyIChhcyBhIGxhc3QgZGF5IG9mIG1vbnRoIChhbmQgbm90IGRhdGUsIHdoaWNoIGlzIHJlbGF0ZWQgdG8gYWN0dWFsICdUb2RheScgZGF0ZSkuXHJcblx0Ly8vLyBFLmcuIGlmIHRvZGF5IGlzIDIwMjMtMDktMjUsIGFuZCB3ZSBzZXQgJ051bWJlciBvZiBtb250aHMgdG8gc2Nyb2xsJyBhcyA1IG1vbnRocywgdGhlbiBsYXN0IGRheSB3aWxsIGJlIDIwMjQtMDItMjkgYW5kIG5vdCB0aGUgMjAyNC0wMi0yNS5cclxuXHQvLyB2YXIgY2FsX2xhc3RfZGF5X2luX21vbnRoID0galF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBudWxsLCBsb2NhbF9fbWF4X2RhdGUsIG5ldyBEYXRlKCkgKTtcclxuXHQvLyBjYWxfbGFzdF9kYXlfaW5fbW9udGggPSBuZXcgRGF0ZSggY2FsX2xhc3RfZGF5X2luX21vbnRoLmdldEZ1bGxZZWFyKCksIGNhbF9sYXN0X2RheV9pbl9tb250aC5nZXRNb250aCgpICsgMSwgMCApO1xyXG5cdC8vIGxvY2FsX19tYXhfZGF0ZSA9IGNhbF9sYXN0X2RheV9pbl9tb250aDtcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjI2LlxyXG5cclxuXHRpZiAoICAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoJ3BhZ2U9d3BiYy1uZXcnKSAhPSAtMSApXHJcblx0XHQmJiAoXHJcblx0XHRcdCAgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoJ2Jvb2tpbmdfaGFzaCcpICE9IC0xICkgICAgICAgICAgICAgICAgICAvLyBDb21tZW50IHRoaXMgbGluZSBmb3IgYWJpbGl0eSB0byBhZGQgIGJvb2tpbmcgaW4gcGFzdCBkYXlzIGF0ICBCb29raW5nID4gQWRkIGJvb2tpbmcgcGFnZS5cclxuXHRcdCAgIHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCdhbGxvd19wYXN0JykgIT0gLTEgKSAgICAgICAgICAgICAgICAvLyBGaXhJbjogMTAuNy4xLjIuXHJcblx0XHQpXHJcblx0KXtcclxuXHRcdGxvY2FsX19taW5fZGF0ZSA9IG51bGw7XHJcblx0XHRsb2NhbF9fbWF4X2RhdGUgPSBudWxsO1xyXG5cdH1cclxuXHJcblx0dmFyIGxvY2FsX19zdGFydF93ZWVrZGF5ICAgID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3N0YXJ0X2RheV93ZWVlaycgKTtcclxuXHR2YXIgbG9jYWxfX251bWJlcl9vZl9tb250aHMgPSBwYXJzZUludCggX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJyApICk7XHJcblxyXG5cdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkudGV4dCggJycgKTtcdFx0XHRcdFx0Ly8gUmVtb3ZlIGFsbCBIVE1MIGluIGNhbGVuZGFyIHRhZ1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2hvdyBjYWxlbmRhclxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0alF1ZXJ5KCcjY2FsZW5kYXJfYm9va2luZycrIHJlc291cmNlX2lkKS5kYXRlcGljayhcclxuXHRcdFx0e1xyXG5cdFx0XHRcdGJlZm9yZVNob3dEYXk6IGZ1bmN0aW9uICgganNfZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX2FwcGx5X2Nzc190b19kYXlzKCBqc19kYXRlLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uU2VsZWN0OiBmdW5jdGlvbiAoIHN0cmluZ19kYXRlcywganNfZGF0ZXNfYXJyICl7ICAvKipcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqXHRzdHJpbmdfZGF0ZXMgICA9ICAgJzIzLjA4LjIwMjMgLSAyNi4wOC4yMDIzJyAgICB8ICAgICcyMy4wOC4yMDIzIC0gMjMuMDguMjAyMycgICAgfCAgICAnMTkuMDkuMjAyMywgMjQuMDguMjAyMywgMzAuMDkuMjAyMydcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqICBqc19kYXRlc19hcnIgICA9ICAgcmFuZ2U6IFsgRGF0ZSAoQXVnIDIzIDIwMjMpLCBEYXRlIChBdWcgMjUgMjAyMyldICAgICB8ICAgICBtdWx0aXBsZTogWyBEYXRlKE9jdCAyNCAyMDIzKSwgRGF0ZShPY3QgMjAgMjAyMyksIERhdGUoT2N0IDE2IDIwMjMpIF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAqL1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX29uX3NlbGVjdF9kYXlzKCBzdHJpbmdfZGF0ZXMsIHsncmVzb3VyY2VfaWQnOiByZXNvdXJjZV9pZH0sIHRoaXMgKTtcclxuXHRcdFx0XHRcdFx0XHQgIH0sXHJcblx0XHRcdFx0b25Ib3ZlcjogZnVuY3Rpb24gKCBzdHJpbmdfZGF0ZSwganNfZGF0ZSApe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gd3BiY19fY2FsZW5kYXJfX29uX2hvdmVyX2RheXMoIHN0cmluZ19kYXRlLCBqc19kYXRlLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uQ2hhbmdlTW9udGhZZWFyOiBmdW5jdGlvbiAoIHllYXIsIHJlYWxfbW9udGgsIGpzX2RhdGVfXzFzdF9kYXlfaW5fbW9udGggKXsgfSxcclxuXHRcdFx0XHRzaG93T24gICAgICAgIDogJ2JvdGgnLFxyXG5cdFx0XHRcdG51bWJlck9mTW9udGhzOiBsb2NhbF9fbnVtYmVyX29mX21vbnRocyxcclxuXHRcdFx0XHRzdGVwTW9udGhzICAgIDogMSxcclxuXHRcdFx0XHQvLyBwcmV2VGV4dCAgICAgIDogJyZsYXF1bzsnLFxyXG5cdFx0XHRcdC8vIG5leHRUZXh0ICAgICAgOiAnJnJhcXVvOycsXHJcblx0XHRcdFx0cHJldlRleHQgICAgICA6ICcmbHNhcXVvOycsXHJcblx0XHRcdFx0bmV4dFRleHQgICAgICA6ICcmcnNhcXVvOycsXHJcblx0XHRcdFx0ZGF0ZUZvcm1hdCAgICA6ICdkZC5tbS55eScsXHJcblx0XHRcdFx0Y2hhbmdlTW9udGggICA6IGZhbHNlLFxyXG5cdFx0XHRcdGNoYW5nZVllYXIgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtaW5EYXRlICAgICAgIDogbG9jYWxfX21pbl9kYXRlLFxyXG5cdFx0XHRcdG1heERhdGUgICAgICAgOiBsb2NhbF9fbWF4X2RhdGUsIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMVknLFxyXG5cdFx0XHRcdC8vIG1pbkRhdGU6IG5ldyBEYXRlKDIwMjAsIDIsIDEpLCBtYXhEYXRlOiBuZXcgRGF0ZSgyMDIwLCA5LCAzMSksICAgICAgICAgICAgIFx0Ly8gQWJpbGl0eSB0byBzZXQgYW55ICBzdGFydCBhbmQgZW5kIGRhdGUgaW4gY2FsZW5kYXJcclxuXHRcdFx0XHRzaG93U3RhdHVzICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRtdWx0aVNlcGFyYXRvciAgOiAnLCAnLFxyXG5cdFx0XHRcdGNsb3NlQXRUb3AgICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdGZpcnN0RGF5ICAgICAgICA6IGxvY2FsX19zdGFydF93ZWVrZGF5LFxyXG5cdFx0XHRcdGdvdG9DdXJyZW50ICAgICA6IGZhbHNlLFxyXG5cdFx0XHRcdGhpZGVJZk5vUHJldk5leHQ6IHRydWUsXHJcblx0XHRcdFx0bXVsdGlTZWxlY3QgICAgIDogbG9jYWxfX211bHRpX2RheXNfc2VsZWN0X251bSxcclxuXHRcdFx0XHRyYW5nZVNlbGVjdCAgICAgOiBsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0LFxyXG5cdFx0XHRcdC8vIHNob3dXZWVrczogdHJ1ZSxcclxuXHRcdFx0XHR1c2VUaGVtZVJvbGxlcjogZmFsc2VcclxuXHRcdFx0fVxyXG5cdCk7XHJcblxyXG5cclxuXHRcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIENsZWFyIHRvZGF5IGRhdGUgaGlnaGxpZ2h0aW5nXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXsgIHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKTsgIH0sIDUwMCApOyAgICAgICAgICAgICAgICAgICAgXHQvLyBGaXhJbjogNy4xLjIuOC5cclxuXHRcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNjcm9sbCBjYWxlbmRhciB0byAgc3BlY2lmaWMgbW9udGhcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBzdGFydF9ia19tb250aCA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfc2Nyb2xsX3RvJyApO1xyXG5cdGlmICggZmFsc2UgIT09IHN0YXJ0X2JrX21vbnRoICl7XHJcblx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBzdGFydF9ia19tb250aFsgMCBdLCBzdGFydF9ia19tb250aFsgMSBdICk7XHJcblx0fVxyXG59XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBBcHBseSBDU1MgdG8gY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICogQHJldHVybnMgeygqfHN0cmluZylbXXwoYm9vbGVhbnxzdHJpbmcpW119XHRcdC0gWyB7dHJ1ZSAtYXZhaWxhYmxlIHwgZmFsc2UgLSB1bmF2YWlsYWJsZX0sICdDU1MgY2xhc3NlcyBmb3IgY2FsZW5kYXIgZGF5IGNlbGwnIF1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fYXBwbHlfY3NzX3RvX2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgdG9kYXlfZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDAgXSwgKHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDEgXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHRcdFx0XHRcdFx0XHRcdC8vIFRvZGF5IEpTX0RhdGVfT2JqLlxyXG5cdFx0dmFyIGNsYXNzX2RheSAgICAgPSB3cGJjX19nZXRfX3RkX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RheSA9IHdwYmNfX2dldF9fc3FsX2NsYXNzX2RhdGUoIGRhdGUgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMjAyMy0wMS0wOSdcclxuXHRcdHZhciByZXNvdXJjZV9pZCA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZihjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pICkgPyBjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0gOiAnMSc7IFx0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBHZXQgU2VsZWN0ZWQgZGF0ZXMgaW4gY2FsZW5kYXJcclxuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19zcWwgPSB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gR2V0IERhdGEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBkYXRlX2Jvb2tpbmdzX29iaiA9IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHJcblxyXG5cclxuXHRcdC8vIEFycmF5IHdpdGggQ1NTIGNsYXNzZXMgZm9yIGRhdGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgY3NzX2NsYXNzZXNfX2Zvcl9kYXRlID0gW107XHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NxbF9kYXRlXycgICAgICsgc3FsX2NsYXNzX2RheSApO1x0XHRcdFx0Ly8gICdzcWxfZGF0ZV8yMDIzLTA3LTIxJ1xyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjYWw0ZGF0ZS0nICAgICArIGNsYXNzX2RheSApO1x0XHRcdFx0XHQvLyAgJ2NhbDRkYXRlLTctMjEtMjAyMydcclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnd3BiY193ZWVrZGF5XycgKyBkYXRlLmdldERheSgpICk7XHRcdFx0XHQvLyAgJ3dwYmNfd2Vla2RheV80J1xyXG5cclxuXHRcdC8vIERlZmluZSBTZWxlY3RlZCBDaGVjayBJbi9PdXQgZGF0ZXMgaW4gVEQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoXHJcblx0XHRcdFx0KCBzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoICApXHJcblx0XHRcdC8vJiYgICggc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gIT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdIClcclxuXHRcdCl7XHJcblx0XHRcdGlmICggc3FsX2NsYXNzX2RheSA9PT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAwIF0gKXtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX2luJyApO1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfaW5fb3V0JyApO1xyXG5cdFx0XHR9XHJcblx0XHRcdGlmICggICggc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCA+IDEgKSAmJiAoIHNxbF9jbGFzc19kYXkgPT09IHNlbGVjdGVkX2RhdGVzX3NxbFsgKHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggLSAxKSBdICkgKSB7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19vdXQnICk7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19pbl9vdXQnICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblxyXG5cdFx0dmFyIGlzX2RheV9zZWxlY3RhYmxlID0gZmFsc2U7XHJcblxyXG5cdFx0Ly8gSWYgc29tZXRoaW5nIG5vdCBkZWZpbmVkLCAgdGhlbiAgdGhpcyBkYXRlIGNsb3NlZCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGlmICggZmFsc2UgPT09IGRhdGVfYm9va2luZ3Nfb2JqICl7XHJcblxyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScgKTtcclxuXHJcblx0XHRcdHJldHVybiBbIGlzX2RheV9zZWxlY3RhYmxlLCBjc3NfY2xhc3Nlc19fZm9yX2RhdGUuam9pbignICcpICBdO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gICBkYXRlX2Jvb2tpbmdzX29iaiAgLSBEZWZpbmVkLiAgICAgICAgICAgIERhdGVzIGNhbiBiZSBzZWxlY3RhYmxlLlxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gQWRkIHNlYXNvbiBuYW1lcyB0byB0aGUgZGF5IENTUyBjbGFzc2VzIC0tIGl0IGlzIHJlcXVpcmVkIGZvciBjb3JyZWN0ICB3b3JrICBvZiBjb25kaXRpb25hbCBmaWVsZHMgLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBzZWFzb25fbmFtZXNfYXJyID0gX3dwYmMuc2Vhc29uc19fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApO1xyXG5cclxuXHRcdGZvciAoIHZhciBzZWFzb25fa2V5IGluIHNlYXNvbl9uYW1lc19hcnIgKXtcclxuXHJcblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCBzZWFzb25fbmFtZXNfYXJyWyBzZWFzb25fa2V5IF0gKTtcdFx0XHRcdC8vICAnd3BkZXZia19zZWFzb25fc2VwdGVtYmVyXzIwMjMnXHJcblx0XHR9XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0XHQvLyBDb3N0IFJhdGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdyYXRlXycgKyBkYXRlX2Jvb2tpbmdzX29ialsgcmVzb3VyY2VfaWQgXVsgJ2RhdGVfY29zdF9yYXRlJyBdLnRvU3RyaW5nKCkucmVwbGFjZSggL1tcXC5cXHNdL2csICdfJyApICk7XHRcdFx0XHRcdFx0Ly8gICdyYXRlXzk5XzAwJyAtPiA5OS4wMFxyXG5cclxuXHJcblx0XHRpZiAoIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSA+IDAgKXtcclxuXHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSB0cnVlO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfYXZhaWxhYmxlJyApO1xyXG5cdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3Jlc2VydmVkX2RheXNfY291bnQnICsgcGFyc2VJbnQoIGRhdGVfYm9va2luZ3Nfb2JqWyAnbWF4X2NhcGFjaXR5JyBdIC0gZGF0ZV9ib29raW5nc19vYmpbICdkYXlfYXZhaWxhYmlsaXR5JyBdICkgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gZmFsc2U7XHJcblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRzd2l0Y2ggKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdGNhc2UgJ2F2YWlsYWJsZSc6XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICd0aW1lX3Nsb3RzX2Jvb2tpbmcnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAndGltZXNwYXJ0bHknLCAndGltZXNfY2xvY2snICk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdmdWxsX2RheV9ib29raW5nJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2Z1bGxfZGF5X2Jvb2tpbmcnICk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdzZWFzb25fZmlsdGVyJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdzZWFzb25fdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ3Jlc291cmNlX2F2YWlsYWJpbGl0eSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAncmVzb3VyY2VfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ3dlZWtkYXlfdW5hdmFpbGFibGUnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ3dlZWtkYXlfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2Zyb21fdG9kYXlfdW5hdmFpbGFibGUnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ2Zyb21fdG9kYXlfdW5hdmFpbGFibGUnICk7XHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gPSAnJztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gUmVzZXQgYm9va2luZyBzdGF0dXMgY29sb3IgZm9yIHBvc3NpYmxlIG9sZCBib29raW5ncyBvbiB0aGlzIGRhdGVcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdsaW1pdF9hdmFpbGFibGVfZnJvbV90b2RheScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnY2hhbmdlX292ZXInOlxyXG5cdFx0XHRcdC8qXHJcblx0XHRcdFx0ICpcclxuXHRcdFx0XHQvLyAgY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlIFx0IFx0Y2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmVcclxuXHRcdFx0XHQvLyAgY2hlY2tfb3V0X3RpbWVfZGF0ZTJhcHByb3ZlIFx0IFx0Y2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkXHJcblx0XHRcdFx0Ly8gIGNoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlIFx0XHQgXHRjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkXHJcblx0XHRcdFx0Ly8gIGNoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWQgXHQgXHRjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWRcclxuXHRcdFx0XHQgKi9cclxuXHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd0aW1lc3BhcnRseScsICdjaGVja19pbl90aW1lJywgJ2NoZWNrX291dF90aW1lJyApO1xyXG5cdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuMi5cclxuXHRcdFx0XHRpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ2FwcHJvdmVkX3BlbmRpbmcnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ3BlbmRpbmdfYXBwcm92ZWQnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2NoZWNrX2luJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX2luX3RpbWUnICk7XHJcblxyXG5cdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4zMy5cclxuXHRcdFx0XHRpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ3BlbmRpbmcnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdhcHByb3ZlZCcgKSA+IC0xICl7XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGVja19vdXQnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAndGltZXNwYXJ0bHknLCAnY2hlY2tfb3V0X3RpbWUnICk7XHJcblxyXG5cdFx0XHRcdC8vIEZpeEluOiA5LjkuMC4zMy5cclxuXHRcdFx0XHRpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ3BlbmRpbmcnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5ncycgXS5pbmRleE9mKCAnYXBwcm92ZWQnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdFx0Ly8gbWl4ZWQgc3RhdHVzZXM6ICdjaGFuZ2Vfb3ZlciBjaGVja19vdXQnIC4uLi4gdmFyaWF0aW9ucy4uLi4gY2hlY2sgbW9yZSBpbiBcdFx0ZnVuY3Rpb24gd3BiY19nZXRfYXZhaWxhYmlsaXR5X3Blcl9kYXlzX2FycigpXHJcblx0XHRcdFx0ZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdID0gJ2F2YWlsYWJsZSc7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0XHRpZiAoICdhdmFpbGFibGUnICE9IGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSApe1xyXG5cclxuXHRcdFx0dmFyIGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncGVuZGluZ19kYXlzX3NlbGVjdGFibGUnICk7XHQvLyBzZXQgcGVuZGluZyBkYXlzIHNlbGVjdGFibGUgICAgICAgICAgLy8gRml4SW46IDguNi4xLjE4LlxyXG5cclxuXHRcdFx0c3dpdGNoICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gKXtcclxuXHJcblx0XHRcdFx0Y2FzZSAnJzpcclxuXHRcdFx0XHRcdC8vIFVzdWFsbHkgIGl0J3MgbWVhbnMgdGhhdCBkYXkgIGlzIGF2YWlsYWJsZSBvciB1bmF2YWlsYWJsZSB3aXRob3V0IHRoZSBib29raW5nc1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmcnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IChpc19kYXlfc2VsZWN0YWJsZSkgPyB0cnVlIDogaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2FwcHJvdmVkJzpcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHQvLyBTaXR1YXRpb25zIGZvciBcImNoYW5nZS1vdmVyXCIgZGF5czogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmdfcGVuZGluZyc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScsICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAncGVuZGluZ19hcHByb3ZlZCc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScsICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IChpc19kYXlfc2VsZWN0YWJsZSkgPyB0cnVlIDogaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2FwcHJvdmVkX3BlbmRpbmcnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZF9hcHByb3ZlZCc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWQnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFsgaXNfZGF5X3NlbGVjdGFibGUsIGNzc19jbGFzc2VzX19mb3JfZGF0ZS5qb2luKCAnICcgKSBdO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIE1vdXNlb3ZlciBjYWxlbmRhciBkYXRlIGNlbGxzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gc3RyaW5nX2RhdGVcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHRcdFx0XHRcdFx0LSAgSmF2YVNjcmlwdCBEYXRlIE9iajogIFx0XHRNb24gRGVjIDExIDIwMjMgMDA6MDA6MDAgR01UKzAyMDAgKEVhc3Rlcm4gRXVyb3BlYW4gU3RhbmRhcmQgVGltZSlcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0XHRcdFx0XHRcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFx0XHRcdFx0XHRcdFwicmVzb3VyY2VfaWRcIjogNFxyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0XHRcdFx0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fb25faG92ZXJfZGF5cyggc3RyaW5nX2RhdGUsIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKSB7XHJcblxyXG5cdFx0aWYgKCBudWxsID09PSBkYXRlICkge1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChjYWxlbmRhcl9wYXJhbXNfYXJyWyAncmVzb3VyY2VfaWQnIF0pKSA/IGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSA6ICcxJyApO1x0XHQvLyBGaXhJbjogMTAuNS4yLjQuXHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgY2xhc3NfZGF5ICAgICA9IHdwYmNfX2dldF9fdGRfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcxLTktMjAyMydcclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcyMDIzLTAxLTA5J1xyXG5cdFx0dmFyIHJlc291cmNlX2lkID0gKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSkgKSA/IGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSA6ICcxJztcdFx0Ly8gJzEnXHJcblxyXG5cdFx0Ly8gR2V0IERhdGEgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBkYXRlX2Jvb2tpbmdfb2JqID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gey4uLn1cclxuXHJcblx0XHRpZiAoICEgZGF0ZV9ib29raW5nX29iaiApeyByZXR1cm4gZmFsc2U7IH1cclxuXHJcblxyXG5cdFx0Ly8gVCBvIG8gbCB0IGkgcCBzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciB0b29sdGlwX3RleHQgPSAnJztcclxuXHRcdGlmICggZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9hdmFpbGFiaWxpdHknIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYXZhaWxhYmlsaXR5JyBdO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2RheV9jb3N0JyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2RheV9jb3N0JyBdO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX3RpbWVzJyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX3RpbWVzJyBdO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2Jvb2tpbmdfZGV0YWlscycgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9ib29raW5nX2RldGFpbHMnIF07XHJcblx0XHR9XHJcblx0XHR3cGJjX3NldF90b29sdGlwX19fZm9yX19jYWxlbmRhcl9kYXRlKCB0b29sdGlwX3RleHQsIHJlc291cmNlX2lkLCBjbGFzc19kYXkgKTtcclxuXHJcblxyXG5cclxuXHRcdC8vICBVIG4gaCBvIHYgZSByIGkgbiBnICAgIGluICAgIFVOU0VMRUNUQUJMRV9DQUxFTkRBUiAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyID0gKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZ191bnNlbGVjdGFibGUnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwKTtcdFx0XHRcdC8vIEZpeEluOiA4LjAuMS4yLlxyXG5cdFx0dmFyIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCAgICA9ICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICk7XHJcblxyXG5cdFx0aWYgKCAoIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciApICYmICggISBpc19ib29raW5nX2Zvcm1fZXhpc3QgKSApe1xyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqICBVbiBIb3ZlciBhbGwgZGF0ZXMgaW4gY2FsZW5kYXIgKHdpdGhvdXQgdGhlIGJvb2tpbmcgZm9ybSksIGlmIG9ubHkgQXZhaWxhYmlsaXR5IENhbGVuZGFyIGhlcmUgYW5kIHdlIGRvIG5vdCBpbnNlcnQgQm9va2luZyBmb3JtIGJ5IG1pc3Rha2UuXHJcblx0XHRcdCAqL1xyXG5cclxuXHRcdFx0d3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCByZXNvdXJjZV9pZCApOyBcdFx0XHRcdFx0XHRcdC8vIENsZWFyIGRheXMgaGlnaGxpZ2h0aW5nXHJcblxyXG5cdFx0XHR2YXIgY3NzX29mX2NhbGVuZGFyID0gJy53cGJjX29ubHlfY2FsZW5kYXIgI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQ7XHJcblx0XHRcdGpRdWVyeSggY3NzX29mX2NhbGVuZGFyICsgJyAuZGF0ZXBpY2stZGF5cy1jZWxsLCAnXHJcblx0XHRcdFx0ICArIGNzc19vZl9jYWxlbmRhciArICcgLmRhdGVwaWNrLWRheXMtY2VsbCBhJyApLmNzcyggJ2N1cnNvcicsICdkZWZhdWx0JyApO1x0Ly8gU2V0IGN1cnNvciB0byBEZWZhdWx0XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblxyXG5cclxuXHRcdC8vICBEIGEgeSBzICAgIEggbyB2IGUgciBpIG4gZyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjJyApID09IC0xIClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtbmV3JyApID4gMCApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLXNldHVwJyApID4gMCApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLWF2YWlsYWJpbGl0eScgKSA+IDAgKVxyXG5cdFx0XHR8fCAoICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1zZXR0aW5ncycgKSA+IDAgKSAgJiZcclxuXHRcdFx0XHQgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAnJnRhYj1mb3JtJyApID4gMCApXHJcblx0XHRcdCAgIClcclxuXHRcdCl7XHJcblx0XHRcdC8vIFRoZSBzYW1lIGFzIGRhdGVzIHNlbGVjdGlvbiwgIGJ1dCBmb3IgZGF5cyBob3ZlcmluZ1xyXG5cclxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09IHR5cGVvZiggd3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X19icyApICl7XHJcblx0XHRcdFx0d3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X19icyggc3FsX2NsYXNzX2RheSwgZGF0ZSwgcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTZWxlY3QgY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fb25fc2VsZWN0X2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSApID8gY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdIDogJzEnO1x0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBTZXQgdW5zZWxlY3RhYmxlLCAgaWYgb25seSBBdmFpbGFiaWxpdHkgQ2FsZW5kYXIgIGhlcmUgKGFuZCB3ZSBkbyBub3QgaW5zZXJ0IEJvb2tpbmcgZm9ybSBieSBtaXN0YWtlKS5cclxuXHRcdHZhciBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgPSAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZScgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDApO1x0XHRcdFx0Ly8gRml4SW46IDguMC4xLjIuXHJcblx0XHR2YXIgaXNfYm9va2luZ19mb3JtX2V4aXN0ICAgID0gKCBqUXVlcnkoICcjYm9va2luZ19mb3JtX2RpdicgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDAgKTtcclxuXHRcdGlmICggKCBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgKSAmJiAoICEgaXNfYm9va2luZ19mb3JtX2V4aXN0ICkgKXtcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gVW5zZWxlY3QgRGF0ZXNcclxuXHRcdFx0alF1ZXJ5KCcud3BiY19vbmx5X2NhbGVuZGFyIC5wb3BvdmVyX2NhbGVuZGFyX2hvdmVyJykucmVtb3ZlKCk7ICAgICAgICAgICAgICAgICAgICAgIFx0XHRcdFx0XHRcdFx0Ly8gSGlkZSBhbGwgb3BlbmVkIHBvcG92ZXJzXHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHRqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBBZGQgc2VsZWN0ZWQgZGF0ZXMgdG8gIGhpZGRlbiB0ZXh0YXJlYVxyXG5cclxuXHJcblx0XHRpZiAoICdmdW5jdGlvbicgPT09IHR5cGVvZiAod3BiY19fY2FsZW5kYXJfX2RvX2RheXNfc2VsZWN0X19icykgKXsgd3BiY19fY2FsZW5kYXJfX2RvX2RheXNfc2VsZWN0X19icyggZGF0ZSwgcmVzb3VyY2VfaWQgKTsgfVxyXG5cclxuXHRcdHdwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gSG9vayAtLSB0cmlnZ2VyIGRheSBzZWxlY3Rpb24gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBtb3VzZV9jbGlja2VkX2RhdGVzID0gZGF0ZTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIENhbiBiZTogXCIwNS4xMC4yMDIzIC0gMDcuMTAuMjAyM1wiICB8ICBcIjEwLjEwLjIwMjMgLSAxMC4xMC4yMDIzXCIgIHxcclxuXHRcdHZhciBhbGxfc2VsZWN0ZWRfZGF0ZXNfYXJyID0gd3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCByZXNvdXJjZV9pZCApO1x0XHRcdFx0XHRcdFx0XHRcdC8vIENhbiBiZTogWyBcIjIwMjMtMTAtMDVcIiwgXCIyMDIzLTEwLTA2XCIsIFwiMjAyMy0xMC0wN1wiLCDigKYgXVxyXG5cdFx0alF1ZXJ5KCBcIi5ib29raW5nX2Zvcm1fZGl2XCIgKS50cmlnZ2VyKCBcImRhdGVfc2VsZWN0ZWRcIiwgWyByZXNvdXJjZV9pZCwgbW91c2VfY2xpY2tlZF9kYXRlcywgYWxsX3NlbGVjdGVkX2RhdGVzX2FyciBdICk7XHJcblx0fVxyXG5cclxuXHQvLyBNYXJrIG1pZGRsZSBzZWxlY3RlZCBkYXRlcyB3aXRoIDAuNSBvcGFjaXR5XHRcdC8vIEZpeEluOiAxMC4zLjAuOS5cclxuXHRqUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cdFx0alF1ZXJ5KCBcIi5ib29raW5nX2Zvcm1fZGl2XCIgKS5vbiggJ2RhdGVfc2VsZWN0ZWQnLCBmdW5jdGlvbiAoIGV2ZW50LCByZXNvdXJjZV9pZCwgZGF0ZSApe1xyXG5cdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdCAgICggICdmaXhlZCcgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSlcclxuXHRcdFx0XHRcdHx8ICgnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSlcclxuXHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHR2YXIgbWlkZGxlX2RheXNfb3BhY2l0eSA9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2NhbGVuZGFyc19fZGF5c19zZWxlY3Rpb25fX21pZGRsZV9kYXlzX29wYWNpdHknICk7XHJcblx0XHRcdFx0XHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyAuZGF0ZXBpY2stY3VycmVudC1kYXknICkubm90KCBcIi5zZWxlY3RlZF9jaGVja19pbl9vdXRcIiApLmNzcyggJ29wYWNpdHknLCBtaWRkbGVfZGF5c19vcGFjaXR5ICk7XHJcblx0XHRcdFx0XHR9LCAxMCApO1xyXG5cdFx0XHRcdH1cclxuXHRcdH0gKTtcclxuXHR9ICk7XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAtLSAgVCBpIG0gZSAgICBGIGkgZSBsIGQgcyAgICAgc3RhcnQgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0ICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIERpc2FibGUgdGltZSBzbG90cyBpbiBib29raW5nIGZvcm0gZGVwZW5kIG9uIHNlbGVjdGVkIGRhdGVzIGFuZCBib29rZWQgZGF0ZXMvdGltZXNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZGlzYWJsZV90aW1lX2ZpZWxkc19pbl9ib29raW5nX2Zvcm0oIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBcdDEuIEdldCBhbGwgdGltZSBmaWVsZHMgaW4gdGhlIGJvb2tpbmcgZm9ybSBhcyBhcnJheSAgb2Ygb2JqZWN0c1xyXG5cdFx0ICogXHRcdFx0XHRcdFtcclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwLCAyMzQwMCBdXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdCAqIFx0XHRcdFx0XHQgICAgIH1cclxuXHRcdCAqIFx0XHRcdFx0XHQgIC4uLlxyXG5cdFx0ICogXHRcdFx0XHRcdFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAnc3RhcnR0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCBdXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdCAqL1xyXG5cdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSB3cGJjX2dldF9fdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIDIuIEdldCBhbGwgc2VsZWN0ZWQgZGF0ZXMgaW4gIFNRTCBmb3JtYXQgIGxpa2UgdGhpcyBbIFwiMjAyMy0wOC0yM1wiLCBcIjIwMjMtMDgtMjRcIiwgXCIyMDIzLTA4LTI1XCIsIC4uLiBdXHJcblx0XHR2YXIgc2VsZWN0ZWRfZGF0ZXNfYXJyID0gd3BiY19nZXRfX3NlbGVjdGVkX2RhdGVzX3NxbF9fYXNfYXJyKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIDMuIEdldCBjaGlsZCBib29raW5nIHJlc291cmNlcyAgb3Igc2luZ2xlIGJvb2tpbmcgcmVzb3VyY2UgIHRoYXQgIGV4aXN0ICBpbiBkYXRlc1xyXG5cdFx0dmFyIGNoaWxkX3Jlc291cmNlc19hcnIgPSB3cGJjX2Nsb25lX29iaiggX3dwYmMuYm9va2luZ19fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyApICk7XHJcblxyXG5cdFx0dmFyIHNxbF9kYXRlO1xyXG5cdFx0dmFyIGNoaWxkX3Jlc291cmNlX2lkO1xyXG5cdFx0dmFyIG1lcmdlZF9zZWNvbmRzO1xyXG5cdFx0dmFyIHRpbWVfZmllbGRzX29iajtcclxuXHRcdHZhciBpc19pbnRlcnNlY3Q7XHJcblx0XHR2YXIgaXNfY2hlY2tfaW47XHJcblxyXG5cdFx0dmFyIHRvZGF5X3RpbWVfX3JlYWwgID0gbmV3IERhdGUoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzBdLCAoIHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVsxXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RpbWVfbG9jYWxfYXJyJyApWzJdLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0aW1lX2xvY2FsX2FycicgKVszXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndGltZV9sb2NhbF9hcnInIClbNF0sIDAgKTtcclxuXHRcdHZhciB0b2RheV90aW1lX19zaGlmdCA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVswXSwgKCBwYXJzZUludCggX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAgICAgICd0b2RheV9hcnInIClbMV0gKSAtIDEpLCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInICAgICAgKVsyXSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyAgICAgIClbM10sIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgICAgICApWzRdLCAwICk7XHJcblxyXG5cdFx0Ly8gNC4gTG9vcCAgYWxsICB0aW1lIEZpZWxkcyBvcHRpb25zXHRcdC8vIEZpeEluOiAxMC4zLjAuMi5cclxuXHRcdGZvciAoIGxldCBmaWVsZF9rZXkgPSAwOyBmaWVsZF9rZXkgPCB0aW1lX2ZpZWxkc19vYmpfYXJyLmxlbmd0aDsgZmllbGRfa2V5KysgKXtcclxuXHJcblx0XHRcdHRpbWVfZmllbGRzX29ial9hcnJbIGZpZWxkX2tleSBdLmRpc2FibGVkID0gMDsgICAgICAgICAgLy8gQnkgZGVmYXVsdCwgdGhpcyB0aW1lIGZpZWxkIGlzIG5vdCBkaXNhYmxlZC5cclxuXHJcblx0XHRcdHRpbWVfZmllbGRzX29iaiA9IHRpbWVfZmllbGRzX29ial9hcnJbIGZpZWxkX2tleSBdO1x0XHQvLyB7IHRpbWVzX2FzX3NlY29uZHM6IFsgMjE2MDAsIDIzNDAwIF0sIHZhbHVlX29wdGlvbl8yNGg6ICcwNjowMCAtIDA2OjMwJywgbmFtZTogJ3JhbmdldGltZTJbXScsIGpxdWVyeV9vcHRpb246IGpRdWVyeV9PYmplY3Qge319XHJcblxyXG5cdFx0XHQvLyBMb29wICBhbGwgIHNlbGVjdGVkIGRhdGVzLlxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKSB7XHJcblxyXG5cdFx0XHRcdC8vIEdldCBEYXRlOiAnMjAyMy0wOC0xOCcuXHJcblx0XHRcdFx0c3FsX2RhdGUgPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXTtcclxuXHJcblx0XHRcdFx0dmFyIGlzX3RpbWVfaW5fcGFzdCA9IHdwYmNfY2hlY2tfaXNfdGltZV9pbl9wYXN0KCB0b2RheV90aW1lX19zaGlmdCwgc3FsX2RhdGUsIHRpbWVfZmllbGRzX29iaiApO1xyXG5cdFx0XHRcdGlmICggaXNfdGltZV9pbl9wYXN0ICkge1xyXG5cdFx0XHRcdFx0Ly8gVGhpcyB0aW1lIGZvciBzZWxlY3RlZCBkYXRlIGFscmVhZHkgIGluIHRoZSBwYXN0LlxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2FycltmaWVsZF9rZXldLmRpc2FibGVkID0gMTtcclxuXHRcdFx0XHRcdGJyZWFrO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBleGlzdCAgZnJvbSAgIERhdGVzIExPT1AuXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBGaXhJbjogOS45LjAuMzEuXHJcblx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0ICAgKCAnT2ZmJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3JlY3VycmVudF90aW1lJyApIClcclxuXHRcdFx0XHRcdCYmICggc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aD4xIClcclxuXHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0Ly9UT0RPOiBza2lwIHNvbWUgZmllbGRzIGNoZWNraW5nIGlmIGl0J3Mgc3RhcnQgLyBlbmQgdGltZSBmb3IgbXVscGxlIGRhdGVzICBzZWxlY3Rpb24gIG1vZGUuXHJcblx0XHRcdFx0XHQvL1RPRE86IHdlIG5lZWQgdG8gZml4IHNpdHVhdGlvbiAgZm9yIGVudGltZXMsICB3aGVuICB1c2VyICBzZWxlY3QgIHNldmVyYWwgIGRhdGVzLCAgYW5kIGluIHN0YXJ0ICB0aW1lIGJvb2tlZCAwMDowMCAtIDE1OjAwICwgYnV0IHN5c3RzbWUgYmxvY2sgdW50aWxsIDE1OjAwIHRoZSBlbmQgdGltZSBhcyB3ZWxsLCAgd2hpY2ggIGlzIHdyb25nLCAgYmVjYXVzZSBpdCAyIG9yIDMgZGF0ZXMgc2VsZWN0aW9uICBhbmQgZW5kIGRhdGUgY2FuIGJlIGZ1bGx1ICBhdmFpbGFibGVcclxuXHJcblx0XHRcdFx0XHRpZiAoICgwID09IGkpICYmICh0aW1lX2ZpZWxkc19vYmpbICduYW1lJyBdLmluZGV4T2YoICdlbmR0aW1lJyApID49IDApICl7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCAoIChzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoLTEpID09IGkgKSAmJiAodGltZV9maWVsZHNfb2JqWyAnbmFtZScgXS5pbmRleE9mKCAnc3RhcnR0aW1lJyApID49IDApICl7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblxyXG5cclxuXHRcdFx0XHR2YXIgaG93X21hbnlfcmVzb3VyY2VzX2ludGVyc2VjdGVkID0gMDtcclxuXHRcdFx0XHQvLyBMb29wIGFsbCByZXNvdXJjZXMgSURcclxuXHRcdFx0XHRcdC8vIGZvciAoIHZhciByZXNfa2V5IGluIGNoaWxkX3Jlc291cmNlc19hcnIgKXtcdCBcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMy4wLjIuXHJcblx0XHRcdFx0Zm9yICggbGV0IHJlc19rZXkgPSAwOyByZXNfa2V5IDwgY2hpbGRfcmVzb3VyY2VzX2Fyci5sZW5ndGg7IHJlc19rZXkrKyApe1xyXG5cclxuXHRcdFx0XHRcdGNoaWxkX3Jlc291cmNlX2lkID0gY2hpbGRfcmVzb3VyY2VzX2FyclsgcmVzX2tleSBdO1xyXG5cclxuXHRcdFx0XHRcdC8vIF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzEyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1x0XHQ9IFsgXCIwNzowMDoxMSAtIDA3OjMwOjAyXCIsIFwiMTA6MDA6MTEgLSAwMDowMDowMFwiIF1cclxuXHRcdFx0XHRcdC8vIF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzXHRcdFx0PSBbICBbIDI1MjExLCAyNzAwMiBdLCBbIDM2MDExLCA4NjQwMCBdICBdXHJcblxyXG5cdFx0XHRcdFx0aWYgKCBmYWxzZSAhPT0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9kYXRlICkgKXtcclxuXHRcdFx0XHRcdFx0bWVyZ2VkX3NlY29uZHMgPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2RhdGUgKVsgY2hpbGRfcmVzb3VyY2VfaWQgXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcztcdFx0Ly8gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0bWVyZ2VkX3NlY29uZHMgPSBbXTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdGlmICggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMubGVuZ3RoID4gMSApe1xyXG5cdFx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2lzX2ludGVyc2VjdF9fcmFuZ2VfdGltZV9pbnRlcnZhbCggIFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0W1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCggcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzBdICkgKyAyMCApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCggcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzWzFdICkgLSAyMCApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdF1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCwgbWVyZ2VkX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGlzX2NoZWNrX2luID0gKC0xICE9PSB0aW1lX2ZpZWxkc19vYmoubmFtZS5pbmRleE9mKCAnc3RhcnQnICkpO1xyXG5cdFx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2lzX2ludGVyc2VjdF9fb25lX3RpbWVfaW50ZXJ2YWwoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoICggaXNfY2hlY2tfaW4gKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApICsgMjBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgOiBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSAtIDIwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIG1lcmdlZF9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoaXNfaW50ZXJzZWN0KXtcclxuXHRcdFx0XHRcdFx0aG93X21hbnlfcmVzb3VyY2VzX2ludGVyc2VjdGVkKys7XHRcdFx0Ly8gSW5jcmVhc2VcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRpZiAoIGNoaWxkX3Jlc291cmNlc19hcnIubGVuZ3RoID09IGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCApIHtcclxuXHRcdFx0XHRcdC8vIEFsbCByZXNvdXJjZXMgaW50ZXJzZWN0ZWQsICB0aGVuICBpdCdzIG1lYW5zIHRoYXQgdGhpcyB0aW1lLXNsb3Qgb3IgdGltZSBtdXN0ICBiZSAgRGlzYWJsZWQsIGFuZCB3ZSBjYW4gIGV4aXN0ICBmcm9tICAgc2VsZWN0ZWRfZGF0ZXNfYXJyIExPT1BcclxuXHJcblx0XHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyWyBmaWVsZF9rZXkgXS5kaXNhYmxlZCA9IDE7XHJcblx0XHRcdFx0XHRicmVhaztcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gZXhpc3QgIGZyb20gICBEYXRlcyBMT09QXHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vIDUuIE5vdyB3ZSBjYW4gZGlzYWJsZSB0aW1lIHNsb3QgaW4gSFRNTCBieSAgdXNpbmcgICggZmllbGQuZGlzYWJsZWQgPT0gMSApIHByb3BlcnR5XHJcblx0XHR3cGJjX19odG1sX190aW1lX2ZpZWxkX29wdGlvbnNfX3NldF9kaXNhYmxlZCggdGltZV9maWVsZHNfb2JqX2FyciApO1xyXG5cclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkudHJpZ2dlciggJ3dwYmNfaG9va190aW1lc2xvdHNfZGlzYWJsZWQnLCBbcmVzb3VyY2VfaWQsIHNlbGVjdGVkX2RhdGVzX2Fycl0gKTtcdFx0XHRcdFx0Ly8gVHJpZ2dlciBob29rIG9uIGRpc2FibGluZyB0aW1lc2xvdHMuXHRcdFVzYWdlOiBcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkub24oICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkJywgZnVuY3Rpb24gKCBldmVudCwgYmtfdHlwZSwgYWxsX2RhdGVzICl7IC4uLiB9ICk7XHRcdC8vIEZpeEluOiA4LjcuMTEuOS5cclxuXHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgaWYgc3BlY2lmaWMgdGltZSgtc2xvdCkgYWxyZWFkeSAgaW4gdGhlIHBhc3QgZm9yIHNlbGVjdGVkIGRhdGVcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ganNfY3VycmVudF90aW1lX3RvX2NoZWNrXHRcdC0gSlMgRGF0ZVxyXG5cdFx0ICogQHBhcmFtIHNxbF9kYXRlXHRcdFx0XHRcdFx0LSAnMjAyNS0wMS0yNidcclxuXHRcdCAqIEBwYXJhbSB0aW1lX2ZpZWxkc19vYmpcdFx0XHRcdC0gT2JqZWN0XHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19jaGVja19pc190aW1lX2luX3Bhc3QoIGpzX2N1cnJlbnRfdGltZV90b19jaGVjaywgc3FsX2RhdGUsIHRpbWVfZmllbGRzX29iaiApIHtcclxuXHJcblx0XHRcdC8vIEZpeEluOiAxMC45LjYuNFxyXG5cdFx0XHR2YXIgc3FsX2RhdGVfYXJyID0gc3FsX2RhdGUuc3BsaXQoICctJyApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGVfX21pZG5pZ2h0ID0gbmV3IERhdGUoIHBhcnNlSW50KCBzcWxfZGF0ZV9hcnJbMF0gKSwgKCBwYXJzZUludCggc3FsX2RhdGVfYXJyWzFdICkgLSAxICksIHBhcnNlSW50KCBzcWxfZGF0ZV9hcnJbMl0gKSwgMCwgMCwgMCApO1xyXG5cdFx0XHR2YXIgc3FsX2RhdGVfX21pZG5pZ2h0X21pbGlzZWNvbmRzID0gc3FsX2RhdGVfX21pZG5pZ2h0LmdldFRpbWUoKTtcclxuXHJcblx0XHRcdHZhciBpc19pbnRlcnNlY3QgPSBmYWxzZTtcclxuXHJcblx0XHRcdGlmICggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMubGVuZ3RoID4gMSApIHtcclxuXHJcblx0XHRcdFx0aWYgKCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2suZ2V0VGltZSgpID4gKHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyArIChwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHNbMF0gKSArIDIwKSAqIDEwMDApICkge1xyXG5cdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2suZ2V0VGltZSgpID4gKHNxbF9kYXRlX19taWRuaWdodF9taWxpc2Vjb25kcyArIChwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHNbMV0gKSAtIDIwKSAqIDEwMDApICkge1xyXG5cdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gdHJ1ZTtcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHZhciBpc19jaGVja19pbiA9ICgtMSAhPT0gdGltZV9maWVsZHNfb2JqLm5hbWUuaW5kZXhPZiggJ3N0YXJ0JyApKTtcclxuXHJcblx0XHRcdFx0dmFyIHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgPSAoaXNfY2hlY2tfaW4pID8gcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgKyAyMCA6IHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kcyApIC0gMjA7XHJcblxyXG5cdFx0XHRcdHRpbWVzX2FzX3NlY29uZHNfY2hlY2sgPSBzcWxfZGF0ZV9fbWlkbmlnaHRfbWlsaXNlY29uZHMgKyB0aW1lc19hc19zZWNvbmRzX2NoZWNrICogMTAwMDtcclxuXHJcblx0XHRcdFx0aWYgKCBqc19jdXJyZW50X3RpbWVfdG9fY2hlY2suZ2V0VGltZSgpID4gdGltZXNfYXNfc2Vjb25kc19jaGVjayApIHtcclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHRydWU7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gaXNfaW50ZXJzZWN0O1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSXMgbnVtYmVyIGluc2lkZSAvaW50ZXJzZWN0ICBvZiBhcnJheSBvZiBpbnRlcnZhbHMgP1xyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB0aW1lX0FcdFx0ICAgICBcdC0gMjU4MDBcclxuXHRcdCAqIEBwYXJhbSB0aW1lX2ludGVydmFsX0JcdFx0LSBbICBbIDI1MjExLCAyNzAwMiBdLCBbIDM2MDExLCA4NjQwMCBdICBdXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pc19pbnRlcnNlY3RfX29uZV90aW1lX2ludGVydmFsKCB0aW1lX0EsIHRpbWVfaW50ZXJ2YWxfQiApe1xyXG5cclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9pbnRlcnZhbF9CLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHRcdGlmICggKHBhcnNlSW50KCB0aW1lX0EgKSA+IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMCBdICkpICYmIChwYXJzZUludCggdGltZV9BICkgPCBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDEgXSApKSApe1xyXG5cdFx0XHRcdFx0cmV0dXJuIHRydWVcclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdC8vIGlmICggKCBwYXJzZUludCggdGltZV9BICkgPT0gcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAwIF0gKSApIHx8ICggcGFyc2VJbnQoIHRpbWVfQSApID09IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMSBdICkgKSApIHtcclxuXHRcdFx0XHQvLyBcdFx0XHQvLyBUaW1lIEEganVzdCAgYXQgIHRoZSBib3JkZXIgb2YgaW50ZXJ2YWxcclxuXHRcdFx0XHQvLyB9XHJcblx0XHRcdH1cclxuXHJcblx0XHQgICAgcmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSXMgdGhlc2UgYXJyYXkgb2YgaW50ZXJ2YWxzIGludGVyc2VjdGVkID9cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9BXHRcdC0gWyBbIDIxNjAwLCAyMzQwMCBdIF1cclxuXHRcdCAqIEBwYXJhbSB0aW1lX2ludGVydmFsX0JcdFx0LSBbICBbIDI1MjExLCAyNzAwMiBdLCBbIDM2MDExLCA4NjQwMCBdICBdXHJcblx0XHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pc19pbnRlcnNlY3RfX3JhbmdlX3RpbWVfaW50ZXJ2YWwoIHRpbWVfaW50ZXJ2YWxfQSwgdGltZV9pbnRlcnZhbF9CICl7XHJcblxyXG5cdFx0XHR2YXIgaXNfaW50ZXJzZWN0O1xyXG5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgdGltZV9pbnRlcnZhbF9BLmxlbmd0aDsgaSsrICl7XHJcblxyXG5cdFx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfaW50ZXJ2YWxfQi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRcdGlzX2ludGVyc2VjdCA9IHdwYmNfaW50ZXJ2YWxzX19pc19pbnRlcnNlY3RlZCggdGltZV9pbnRlcnZhbF9BWyBpIF0sIHRpbWVfaW50ZXJ2YWxfQlsgaiBdICk7XHJcblxyXG5cdFx0XHRcdFx0aWYgKCBpc19pbnRlcnNlY3QgKXtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBHZXQgYWxsIHRpbWUgZmllbGRzIGluIHRoZSBib29raW5nIGZvcm0gYXMgYXJyYXkgIG9mIG9iamVjdHNcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCAqIEByZXR1cm5zIFtdXHJcblx0XHQgKlxyXG5cdFx0ICogXHRcdEV4YW1wbGU6XHJcblx0XHQgKiBcdFx0XHRcdFx0W1xyXG5cdFx0ICogXHRcdFx0XHRcdCBcdCAgIHtcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCAtIDA2OjMwJ1xyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdCBcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0XHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIHtcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0ICAgXHRcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHRcdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2dldF9fdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCApe1xyXG5cdFx0ICAgIC8qKlxyXG5cdFx0XHQgKiBGaWVsZHMgd2l0aCAgW10gIGxpa2UgdGhpcyAgIHNlbGVjdFtuYW1lPVwicmFuZ2V0aW1lMVtdXCJdXHJcblx0XHRcdCAqIGl0J3Mgd2hlbiB3ZSBoYXZlICdtdWx0aXBsZScgaW4gc2hvcnRjb2RlOiAgIFtzZWxlY3QqIHJhbmdldGltZSBtdWx0aXBsZSAgXCIwNjowMCAtIDA2OjMwXCIgLi4uIF1cclxuXHRcdFx0ICovXHJcblx0XHRcdHZhciB0aW1lX2ZpZWxkc19hcnI9W1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXSdcclxuXHRcdFx0XHRcdFx0XHRcdF07XHJcblxyXG5cdFx0XHR2YXIgdGltZV9maWVsZHNfb2JqX2FyciA9IFtdO1xyXG5cclxuXHRcdFx0Ly8gTG9vcCBhbGwgVGltZSBGaWVsZHNcclxuXHRcdFx0Zm9yICggdmFyIGN0Zj0gMDsgY3RmIDwgdGltZV9maWVsZHNfYXJyLmxlbmd0aDsgY3RmKysgKXtcclxuXHJcblx0XHRcdFx0dmFyIHRpbWVfZmllbGQgPSB0aW1lX2ZpZWxkc19hcnJbIGN0ZiBdO1xyXG5cdFx0XHRcdHZhciB0aW1lX29wdGlvbiA9IGpRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uJyApO1xyXG5cclxuXHRcdFx0XHQvLyBMb29wIGFsbCBvcHRpb25zIGluIHRpbWUgZmllbGRcclxuXHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX29wdGlvbi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uID0galF1ZXJ5KCB0aW1lX2ZpZWxkICsgJyBvcHRpb246ZXEoJyArIGogKyAnKScgKTtcclxuXHRcdFx0XHRcdHZhciB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIgPSBqcXVlcnlfb3B0aW9uLnZhbCgpLnNwbGl0KCAnLScgKTtcclxuXHRcdFx0XHRcdHZhciB0aW1lc19hc19zZWNvbmRzID0gW107XHJcblxyXG5cdFx0XHRcdFx0Ly8gR2V0IHRpbWUgYXMgc2Vjb25kc1xyXG5cdFx0XHRcdFx0aWYgKCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoICl7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDkuOC4xMC4xLlxyXG5cdFx0XHRcdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0Ly8gRml4SW46IDEwLjAuMC41Ni5cclxuXHRcdFx0XHRcdFx0XHQvLyB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbaV0gPSAnMTQ6MDAgJyAgfCAnIDE2OjAwJyAgIChpZiBmcm9tICdyYW5nZXRpbWUnKSBhbmQgJzE2OjAwJyAgaWYgKHN0YXJ0L2VuZCB0aW1lKVxyXG5cclxuXHRcdFx0XHRcdFx0XHR2YXIgc3RhcnRfZW5kX3RpbWVzX2FyciA9IHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyclsgaSBdLnRyaW0oKS5zcGxpdCggJzonICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHZhciB0aW1lX2luX3NlY29uZHMgPSBwYXJzZUludCggc3RhcnRfZW5kX3RpbWVzX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDEgXSApICogNjA7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHMucHVzaCggdGltZV9pbl9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyLnB1c2goIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiBqUXVlcnkoIHRpbWVfZmllbGQgKS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiBqcXVlcnlfb3B0aW9uLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IGpxdWVyeV9vcHRpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0aW1lc19hc19zZWNvbmRzJzogdGltZXNfYXNfc2Vjb25kc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRpbWVfZmllbGRzX29ial9hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogRGlzYWJsZSBIVE1MIG9wdGlvbnMgYW5kIGFkZCBib29rZWQgQ1NTIGNsYXNzXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSB0aW1lX2ZpZWxkc19vYmpfYXJyICAgICAgLSB0aGlzIHZhbHVlIGlzIGZyb20gIHRoZSBmdW5jOiAgXHR3cGJjX2dldF9fdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCApXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRbXHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdFx0ICogXHQgIFx0XHRcdFx0XHRcdCAgICBkaXNhYmxlZCA9IDFcclxuXHRcdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHRcdCAqICAgXHRcdFx0XHRcdFx0XHRkaXNhYmxlZCA9IDBcclxuXHRcdFx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdFx0ICpcclxuXHRcdFx0ICovXHJcblx0XHRcdGZ1bmN0aW9uIHdwYmNfX2h0bWxfX3RpbWVfZmllbGRfb3B0aW9uc19fc2V0X2Rpc2FibGVkKCB0aW1lX2ZpZWxkc19vYmpfYXJyICl7XHJcblxyXG5cdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uO1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aW1lX2ZpZWxkc19vYmpfYXJyLmxlbmd0aDsgaSsrICl7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb24gPSB0aW1lX2ZpZWxkc19vYmpfYXJyWyBpIF0uanF1ZXJ5X29wdGlvbjtcclxuXHJcblx0XHRcdFx0XHRpZiAoIDEgPT0gdGltZV9maWVsZHNfb2JqX2FyclsgaSBdLmRpc2FibGVkICl7XHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApOyBcdFx0Ly8gTWFrZSBkaXNhYmxlIHNvbWUgb3B0aW9uc1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLmFkZENsYXNzKCAnYm9va2VkJyApOyAgICAgICAgICAgXHQvLyBBZGQgXCJib29rZWRcIiBDU1MgY2xhc3NcclxuXHJcblx0XHRcdFx0XHRcdC8vIGlmIHRoaXMgYm9va2VkIGVsZW1lbnQgc2VsZWN0ZWQgLS0+IHRoZW4gZGVzZWxlY3QgIGl0XHJcblx0XHRcdFx0XHRcdGlmICgganF1ZXJ5X29wdGlvbi5wcm9wKCAnc2VsZWN0ZWQnICkgKXtcclxuXHRcdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdzZWxlY3RlZCcsIGZhbHNlICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucGFyZW50KCkuZmluZCggJ29wdGlvbjpub3QoW2Rpc2FibGVkXSk6Zmlyc3QnICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucHJvcCggJ2Rpc2FibGVkJywgZmFsc2UgKTsgIFx0XHQvLyBNYWtlIGFjdGl2ZSBhbGwgdGltZXNcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5yZW1vdmVDbGFzcyggJ2Jvb2tlZCcgKTsgICBcdFx0Ly8gUmVtb3ZlIGNsYXNzIFwiYm9va2VkXCJcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrIGlmIHRoaXMgdGltZV9yYW5nZSB8IFRpbWVfU2xvdCBpcyBGdWxsIERheSAgYm9va2VkXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gdGltZXNsb3RfYXJyX2luX3NlY29uZHNcdFx0LSBbIDM2MDExLCA4NjQwMCBdXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX3RpbWVzbG90X19mdWxsX2RheV9ib29rZWQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHRcdCggdGltZXNsb3RfYXJyX2luX3NlY29uZHMubGVuZ3RoID4gMSApXHJcblx0XHRcdCYmICggcGFyc2VJbnQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzWyAwIF0gKSA8IDMwIClcclxuXHRcdFx0JiYgKCBwYXJzZUludCggdGltZXNsb3RfYXJyX2luX3NlY29uZHNbIDEgXSApID4gICggKDI0ICogNjAgKiA2MCkgLSAzMCkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyogID09ICBTIGUgbCBlIGMgdCBlIGQgICAgRCBhIHQgZSBzICAvICBUIGkgbSBlIC0gRiBpIGUgbCBkIHMgID09XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBhbGwgc2VsZWN0ZWQgZGF0ZXMgaW4gU1FMIGZvcm1hdCBsaWtlIHRoaXMgWyBcIjIwMjMtMDgtMjNcIiwgXCIyMDIzLTA4LTI0XCIgLCAuLi4gXVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge1tdfVx0XHRcdFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiLCBcIjIwMjMtMDgtMjVcIiwgXCIyMDIzLTA4LTI2XCIsIFwiMjAyMy0wOC0yN1wiLCBcIjIwMjMtMDgtMjhcIiwgXCIyMDIzLTA4LTI5XCIgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHR2YXIgc2VsZWN0ZWRfZGF0ZXNfYXJyID0gW107XHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIgPSBqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCkuc3BsaXQoJywnKTtcclxuXHJcblx0XHRpZiAoIHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGggKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGg7IGkrKyApe1x0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTYuXHJcblx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0gPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXS50cmltKCk7XHJcblx0XHRcdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF0gPSBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXS5zcGxpdCggJy4nICk7XHJcblx0XHRcdFx0aWYgKCBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXS5sZW5ndGggPiAxICl7XHJcblx0XHRcdFx0XHRzZWxlY3RlZF9kYXRlc19hcnJbIGkgXSA9IHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdWyAyIF0gKyAnLScgKyBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXVsgMSBdICsgJy0nICsgc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF1bIDAgXTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBSZW1vdmUgZW1wdHkgZWxlbWVudHMgZnJvbSBhbiBhcnJheVxyXG5cdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyID0gc2VsZWN0ZWRfZGF0ZXNfYXJyLmZpbHRlciggZnVuY3Rpb24gKCBuICl7IHJldHVybiBwYXJzZUludChuKTsgfSApO1xyXG5cclxuXHRcdHNlbGVjdGVkX2RhdGVzX2Fyci5zb3J0KCk7XHJcblxyXG5cdFx0cmV0dXJuIHNlbGVjdGVkX2RhdGVzX2FycjtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYWxsIHRpbWUgZmllbGRzIGluIHRoZSBib29raW5nIGZvcm0gYXMgYXJyYXkgIG9mIG9iamVjdHNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqIEBwYXJhbSBpc19vbmx5X3NlbGVjdGVkX3RpbWVcclxuXHQgKiBAcmV0dXJucyBbXVxyXG5cdCAqXHJcblx0ICogXHRcdEV4YW1wbGU6XHJcblx0ICogXHRcdFx0XHRcdFtcclxuXHQgKiBcdFx0XHRcdFx0IFx0ICAge1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCAtIDA2OjMwJ1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHQgKiBcdFx0XHRcdFx0IFx0ICAgXHRcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdyYW5nZXRpbWUyW10nXHJcblx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdCAqIFx0XHRcdFx0XHQgIC4uLlxyXG5cdCAqIFx0XHRcdFx0XHRcdCAgIHtcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCBdXHJcblx0ICogXHRcdFx0XHRcdFx0ICAgXHRcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdCAqIFx0XHRcdFx0XHQgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X19zZWxlY3RlZF90aW1lX2ZpZWxkc19faW5fYm9va2luZ19mb3JtX19hc19hcnIoIHJlc291cmNlX2lkLCBpc19vbmx5X3NlbGVjdGVkX3RpbWUgPSB0cnVlICl7XHJcblx0XHQvKipcclxuXHRcdCAqIEZpZWxkcyB3aXRoICBbXSAgbGlrZSB0aGlzICAgc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUxW11cIl1cclxuXHRcdCAqIGl0J3Mgd2hlbiB3ZSBoYXZlICdtdWx0aXBsZScgaW4gc2hvcnRjb2RlOiAgIFtzZWxlY3QqIHJhbmdldGltZSBtdWx0aXBsZSAgXCIwNjowMCAtIDA2OjMwXCIgLi4uIF1cclxuXHRcdCAqL1xyXG5cdFx0dmFyIHRpbWVfZmllbGRzX2Fycj1bXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJyYW5nZXRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImR1cmF0aW9udGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZHVyYXRpb250aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJ1xyXG5cdFx0XHRcdFx0XHRcdF07XHJcblxyXG5cdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSBbXTtcclxuXHJcblx0XHQvLyBMb29wIGFsbCBUaW1lIEZpZWxkc1xyXG5cdFx0Zm9yICggdmFyIGN0Zj0gMDsgY3RmIDwgdGltZV9maWVsZHNfYXJyLmxlbmd0aDsgY3RmKysgKXtcclxuXHJcblx0XHRcdHZhciB0aW1lX2ZpZWxkID0gdGltZV9maWVsZHNfYXJyWyBjdGYgXTtcclxuXHJcblx0XHRcdHZhciB0aW1lX29wdGlvbjtcclxuXHRcdFx0aWYgKCBpc19vbmx5X3NlbGVjdGVkX3RpbWUgKXtcclxuXHRcdFx0XHR0aW1lX29wdGlvbiA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0aW1lX2ZpZWxkICsgJyBvcHRpb246c2VsZWN0ZWQnICk7XHRcdFx0Ly8gRXhjbHVkZSBjb25kaXRpb25hbCAgZmllbGRzLCAgYmVjYXVzZSBvZiB1c2luZyAnI2Jvb2tpbmdfZm9ybTMgLi4uJ1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdHRpbWVfb3B0aW9uID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgJyArIHRpbWVfZmllbGQgKyAnIG9wdGlvbicgKTtcdFx0XHRcdC8vIEFsbCAgdGltZSBmaWVsZHNcclxuXHRcdFx0fVxyXG5cclxuXHJcblx0XHRcdC8vIExvb3AgYWxsIG9wdGlvbnMgaW4gdGltZSBmaWVsZFxyXG5cdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX29wdGlvbi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbiA9IGpRdWVyeSggdGltZV9vcHRpb25bIGogXSApO1x0XHQvLyBHZXQgb25seSAgc2VsZWN0ZWQgb3B0aW9ucyBcdC8valF1ZXJ5KCB0aW1lX2ZpZWxkICsgJyBvcHRpb246ZXEoJyArIGogKyAnKScgKTtcclxuXHRcdFx0XHR2YXIgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyID0ganF1ZXJ5X29wdGlvbi52YWwoKS5zcGxpdCggJy0nICk7XHJcblx0XHRcdFx0dmFyIHRpbWVzX2FzX3NlY29uZHMgPSBbXTtcclxuXHJcblx0XHRcdFx0Ly8gR2V0IHRpbWUgYXMgc2Vjb25kc1xyXG5cdFx0XHRcdGlmICggdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aCApe1x0XHRcdFx0IFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogOS44LjEwLjEuXHJcblx0XHRcdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC41Ni5cclxuXHRcdFx0XHRcdFx0Ly8gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyW2ldID0gJzE0OjAwICcgIHwgJyAxNjowMCcgICAoaWYgZnJvbSAncmFuZ2V0aW1lJykgYW5kICcxNjowMCcgIGlmIChzdGFydC9lbmQgdGltZSlcclxuXHJcblx0XHRcdFx0XHRcdHZhciBzdGFydF9lbmRfdGltZXNfYXJyID0gdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyWyBpIF0udHJpbSgpLnNwbGl0KCAnOicgKTtcclxuXHJcblx0XHRcdFx0XHRcdHZhciB0aW1lX2luX3NlY29uZHMgPSBwYXJzZUludCggc3RhcnRfZW5kX3RpbWVzX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDEgXSApICogNjA7XHJcblxyXG5cdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzLnB1c2goIHRpbWVfaW5fc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2Fyci5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgICAgICAgICAgICA6IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0aW1lX2ZpZWxkICkuYXR0ciggJ25hbWUnICksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWVfb3B0aW9uXzI0aCc6IGpxdWVyeV9vcHRpb24udmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IGpxdWVyeV9vcHRpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGltZXNfYXNfc2Vjb25kcyc6IHRpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvLyBUZXh0OiAgIFtzdGFydHRpbWVdIC0gW2VuZHRpbWVdIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0dmFyIHRleHRfdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2lucHV0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0J2lucHV0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRdO1xyXG5cdFx0Zm9yICggdmFyIHRmPSAwOyB0ZiA8IHRleHRfdGltZV9maWVsZHNfYXJyLmxlbmd0aDsgdGYrKyApe1xyXG5cclxuXHRcdFx0dmFyIHRleHRfanF1ZXJ5ID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgJyArIHRleHRfdGltZV9maWVsZHNfYXJyWyB0ZiBdICk7XHRcdFx0XHRcdFx0XHRcdC8vIEV4Y2x1ZGUgY29uZGl0aW9uYWwgIGZpZWxkcywgIGJlY2F1c2Ugb2YgdXNpbmcgJyNib29raW5nX2Zvcm0zIC4uLidcclxuXHRcdFx0aWYgKCB0ZXh0X2pxdWVyeS5sZW5ndGggPiAwICl7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lX19oX21fX2FyciA9IHRleHRfanF1ZXJ5LnZhbCgpLnRyaW0oKS5zcGxpdCggJzonICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcxNDowMCdcclxuXHRcdFx0XHRpZiAoIDAgPT0gdGltZV9faF9tX19hcnIubGVuZ3RoICl7XHJcblx0XHRcdFx0XHRjb250aW51ZTtcdFx0XHRcdFx0XHRcdFx0XHQvLyBOb3QgZW50ZXJlZCB0aW1lIHZhbHVlIGluIGEgZmllbGRcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0aWYgKCAxID09IHRpbWVfX2hfbV9fYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdFx0aWYgKCAnJyA9PT0gdGltZV9faF9tX19hcnJbIDAgXSApe1xyXG5cdFx0XHRcdFx0XHRjb250aW51ZTtcdFx0XHRcdFx0XHRcdFx0Ly8gTm90IGVudGVyZWQgdGltZSB2YWx1ZSBpbiBhIGZpZWxkXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHR0aW1lX19oX21fX2FyclsgMSBdID0gMDtcclxuXHRcdFx0XHR9XHJcblx0XHRcdFx0dmFyIHRleHRfdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHRpbWVfX2hfbV9fYXJyWyAwIF0gKSAqIDYwICogNjAgKyBwYXJzZUludCggdGltZV9faF9tX19hcnJbIDEgXSApICogNjA7XHJcblxyXG5cdFx0XHRcdHZhciB0ZXh0X3RpbWVzX2FzX3NlY29uZHMgPSBbXTtcclxuXHRcdFx0XHR0ZXh0X3RpbWVzX2FzX3NlY29uZHMucHVzaCggdGV4dF90aW1lX2luX3NlY29uZHMgKTtcclxuXHJcblx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2Fyci5wdXNoKCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgICAgICAgICAgICA6IHRleHRfanF1ZXJ5LmF0dHIoICduYW1lJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiB0ZXh0X2pxdWVyeS52YWwoKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcXVlcnlfb3B0aW9uJyAgIDogdGV4dF9qcXVlcnksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndGltZXNfYXNfc2Vjb25kcyc6IHRleHRfdGltZXNfYXNfc2Vjb25kc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiB0aW1lX2ZpZWxkc19vYmpfYXJyO1xyXG5cdH1cclxuXHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgUyBVIFAgUCBPIFIgVCAgICBmb3IgICAgQyBBIEwgRSBOIEQgQSBSICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IENhbGVuZGFyIGRhdGVwaWNrICBJbnN0YW5jZVxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZCAgb2YgYm9va2luZyByZXNvdXJjZVxyXG5cdCAqIEByZXR1cm5zIHsqfG51bGx9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXtcclxuXHRcdFx0cmVzb3VyY2VfaWQgPSAnMSc7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0cmV0dXJuIGpRdWVyeS5kYXRlcGljay5fZ2V0SW5zdCggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5nZXQoIDAgKSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBudWxsO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogVW5zZWxlY3QgIGFsbCBkYXRlcyBpbiBjYWxlbmRhciBhbmQgdmlzdWFsbHkgdXBkYXRlIHRoaXMgY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHRcdHRydWUgb24gc3VjY2VzcyB8IGZhbHNlLCAgaWYgbm8gc3VjaCAgY2FsZW5kYXJcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXtcclxuXHRcdFx0cmVzb3VyY2VfaWQgPSAnMSc7XHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKVxyXG5cclxuXHRcdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cclxuXHRcdFx0Ly8gVW5zZWxlY3QgYWxsIGRhdGVzIGFuZCBzZXQgIHByb3BlcnRpZXMgb2YgRGF0ZXBpY2tcclxuXHRcdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTsgICAgICAvL0ZpeEluOiA1LjQuM1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gZmFsc2U7XHJcblx0XHRcdGluc3QuZGF0ZXMgPSBbXTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl91cGRhdGVEYXRlcGljayggaW5zdCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWVcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQ2xlYXIgZGF5cyBoaWdobGlnaHRpbmcgaW4gQWxsIG9yIHNwZWNpZmljIENhbGVuZGFyc1xyXG5cdCAqXHJcbiAgICAgKiBAcGFyYW0gcmVzb3VyY2VfaWQgIC0gY2FuIGJlIHNraXBlZCB0byAgY2xlYXIgaGlnaGxpZ2h0aW5nIGluIGFsbCBjYWxlbmRhcnNcclxuICAgICAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJzX19jbGVhcl9kYXlzX2hpZ2hsaWdodGluZyggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCByZXNvdXJjZV9pZCApICl7XHJcblxyXG5cdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgLmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHRcdC8vIENsZWFyIGluIHNwZWNpZmljIGNhbGVuZGFyXHJcblxyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0alF1ZXJ5KCAnLmRhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApLnJlbW92ZUNsYXNzKCAnZGF0ZXBpY2stZGF5cy1jZWxsLW92ZXInICk7XHRcdFx0XHRcdFx0XHRcdC8vIENsZWFyIGluIGFsbCBjYWxlbmRhcnNcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNjcm9sbCB0byBzcGVjaWZpYyBtb250aCBpbiBjYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIHJlc291cmNlXHJcblx0ICogQHBhcmFtIHllYXJcdFx0XHRcdC0gcmVhbCB5ZWFyICAtIDIwMjNcclxuXHQgKiBAcGFyYW0gbW9udGhcdFx0XHRcdC0gcmVhbCBtb250aCAtIDEyXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fc2Nyb2xsX3RvKCByZXNvdXJjZV9pZCwgeWVhciwgbW9udGggKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHJlc291cmNlX2lkKSApeyByZXNvdXJjZV9pZCA9ICcxJzsgfVxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKVxyXG5cdFx0aWYgKCBudWxsICE9PSBpbnN0ICl7XHJcblxyXG5cdFx0XHR5ZWFyICA9IHBhcnNlSW50KCB5ZWFyICk7XHJcblx0XHRcdG1vbnRoID0gcGFyc2VJbnQoIG1vbnRoICkgLSAxO1x0XHQvLyBJbiBKUyBkYXRlLCAgbW9udGggLTFcclxuXHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZSA9IG5ldyBEYXRlKCk7XHJcblx0XHRcdC8vIEluIHNvbWUgY2FzZXMsICB0aGUgc2V0RnVsbFllYXIgY2FuICBzZXQgIG9ubHkgWWVhciwgIGFuZCBub3QgdGhlIE1vbnRoIGFuZCBkYXkgICAgICAvLyBGaXhJbjogNi4yLjMuNS5cclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlLnNldEZ1bGxZZWFyKCB5ZWFyLCBtb250aCwgMSApO1xyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUuc2V0TW9udGgoIG1vbnRoICk7XHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZS5zZXREYXRlKCAxICk7XHJcblxyXG5cdFx0XHRpbnN0LmRyYXdNb250aCA9IGluc3QuY3Vyc29yRGF0ZS5nZXRNb250aCgpO1xyXG5cdFx0XHRpbnN0LmRyYXdZZWFyID0gaW5zdC5jdXJzb3JEYXRlLmdldEZ1bGxZZWFyKCk7XHJcblxyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX25vdGlmeUNoYW5nZSggaW5zdCApO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX2FkanVzdEluc3REYXRlKCBpbnN0ICk7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fc2hvd0RhdGUoIGluc3QgKTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl91cGRhdGVEYXRlcGljayggaW5zdCApO1xyXG5cclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJcyB0aGlzIGRhdGUgc2VsZWN0YWJsZSBpbiBjYWxlbmRhciAobWFpbmx5IGl0J3MgbWVhbnMgQVZBSUxBQkxFIGRhdGUpXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2ludHxzdHJpbmd9IHJlc291cmNlX2lkXHRcdDFcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheVx0XHQnMjAyMy0wOC0xMSdcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0XHRcdFx0dHJ1ZSB8IGZhbHNlXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX2RheV9zZWxlY3RhYmxlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApe1xyXG5cclxuXHRcdC8vIEdldCBEYXRhIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgZGF0ZV9ib29raW5nc19vYmogPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApO1xyXG5cclxuXHRcdHZhciBpc19kYXlfc2VsZWN0YWJsZSA9ICggcGFyc2VJbnQoIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApID4gMCApO1xyXG5cclxuXHRcdGlmICggdHlwZW9mIChkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF0pID09PSAndW5kZWZpbmVkJyApe1xyXG5cdFx0XHRyZXR1cm4gaXNfZGF5X3NlbGVjdGFibGU7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAnYXZhaWxhYmxlJyAhPSBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gKXtcclxuXHJcblx0XHRcdHZhciBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGUgPSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlJyApO1x0XHQvLyBzZXQgcGVuZGluZyBkYXlzIHNlbGVjdGFibGUgICAgICAgICAgLy8gRml4SW46IDguNi4xLjE4LlxyXG5cclxuXHRcdFx0c3dpdGNoICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gKXtcclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nJzpcclxuXHRcdFx0XHQvLyBTaXR1YXRpb25zIGZvciBcImNoYW5nZS1vdmVyXCIgZGF5czpcclxuXHRcdFx0XHRjYXNlICdwZW5kaW5nX3BlbmRpbmcnOlxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmdfYXBwcm92ZWQnOlxyXG5cdFx0XHRcdGNhc2UgJ2FwcHJvdmVkX3BlbmRpbmcnOlxyXG5cdFx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gaXNfZGF5X3NlbGVjdGFibGU7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBJcyBkYXRlIHRvIGNoZWNrIElOIGFycmF5IG9mIHNlbGVjdGVkIGRhdGVzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge2RhdGV9anNfZGF0ZV90b19jaGVja1x0XHQtIEpTIERhdGVcdFx0XHQtIHNpbXBsZSAgSmF2YVNjcmlwdCBEYXRlIG9iamVjdFxyXG5cdCAqIEBwYXJhbSB7W119IGpzX2RhdGVzX2Fyclx0XHRcdC0gWyBKU0RhdGUsIC4uLiBdICAgLSBhcnJheSAgb2YgSlMgZGF0ZXNcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2lzX3RoaXNfZGF5X2Ftb25nX3NlbGVjdGVkX2RheXMoIGpzX2RhdGVfdG9fY2hlY2ssIGpzX2RhdGVzX2FyciApe1xyXG5cclxuXHRcdGZvciAoIHZhciBkYXRlX2luZGV4ID0gMDsgZGF0ZV9pbmRleCA8IGpzX2RhdGVzX2Fyci5sZW5ndGggOyBkYXRlX2luZGV4KysgKXsgICAgIFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA4LjQuNS4xNi5cclxuXHRcdFx0aWYgKCAoIGpzX2RhdGVzX2FyclsgZGF0ZV9pbmRleCBdLmdldEZ1bGxZZWFyKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RnVsbFllYXIoKSApICYmXHJcblx0XHRcdFx0ICgganNfZGF0ZXNfYXJyWyBkYXRlX2luZGV4IF0uZ2V0TW9udGgoKSA9PT0ganNfZGF0ZV90b19jaGVjay5nZXRNb250aCgpICkgJiZcclxuXHRcdFx0XHQgKCBqc19kYXRlc19hcnJbIGRhdGVfaW5kZXggXS5nZXREYXRlKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RGF0ZSgpICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAgZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgU1FMIENsYXNzIERhdGUgJzIwMjMtMDgtMDEnIGZyb20gIEpTIERhdGVcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRKUyBEYXRlXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cdFx0JzIwMjMtMDgtMTInXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApe1xyXG5cclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9ICggKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgPCAxMCApID8gJzAnIDogJyc7XHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLSdcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSAoIGRhdGUuZ2V0RGF0ZSgpIDwgMTAgKSA/ICcwJyA6ICcnO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9IGRhdGUuZ2V0RGF0ZSgpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHNxbF9jbGFzc19kYXk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgSlMgRGF0ZSBmcm9tICB0aGUgU1FMIGRhdGUgZm9ybWF0ICcyMDI0LTA1LTE0J1xyXG5cdCAqIEBwYXJhbSBzcWxfY2xhc3NfZGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtEYXRlfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2NsYXNzX2RhdGUgKXtcclxuXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RhdGVfYXJyID0gc3FsX2NsYXNzX2RhdGUuc3BsaXQoICctJyApO1xyXG5cclxuXHRcdHZhciBkYXRlX2pzID0gbmV3IERhdGUoKTtcclxuXHJcblx0XHRkYXRlX2pzLnNldEZ1bGxZZWFyKCBwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAwIF0gKSwgKHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDEgXSApIC0gMSksIHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDIgXSApICk7ICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cclxuXHRcdC8vIFdpdGhvdXQgdGhpcyB0aW1lIGFkanVzdCBEYXRlcyBzZWxlY3Rpb24gIGluIERhdGVwaWNrZXIgY2FuIG5vdCB3b3JrISEhXHJcblx0XHRkYXRlX2pzLnNldEhvdXJzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaW51dGVzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRTZWNvbmRzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaWxsaXNlY29uZHMoMCk7XHJcblxyXG5cdFx0cmV0dXJuIGRhdGVfanM7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgVEQgQ2xhc3MgRGF0ZSAnMS0zMS0yMDIzJyBmcm9tICBKUyBEYXRlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHRcdCcxLTMxLTIwMjMnXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICl7XHJcblxyXG5cdFx0dmFyIHRkX2NsYXNzX2RheSA9IChkYXRlLmdldE1vbnRoKCkgKyAxKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1x0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblxyXG5cdFx0cmV0dXJuIHRkX2NsYXNzX2RheTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBkYXRlIHBhcmFtcyBmcm9tICBzdHJpbmcgZGF0ZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRzdHJpbmcgZGF0ZSBsaWtlICczMS41LjIwMjMnXHJcblx0ICogQHBhcmFtIHNlcGFyYXRvclx0XHRkZWZhdWx0ICcuJyAgY2FuIGJlIHNraXBwZWQuXHJcblx0ICogQHJldHVybnMgeyAge2RhdGU6IG51bWJlciwgbW9udGg6IG51bWJlciwgeWVhcjogbnVtYmVyfSAgfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fZGF0ZV9wYXJhbXNfX2Zyb21fc3RyaW5nX2RhdGUoIGRhdGUgLCBzZXBhcmF0b3Ipe1xyXG5cclxuXHRcdHNlcGFyYXRvciA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoc2VwYXJhdG9yKSApID8gc2VwYXJhdG9yIDogJy4nO1xyXG5cclxuXHRcdHZhciBkYXRlX2FyciA9IGRhdGUuc3BsaXQoIHNlcGFyYXRvciApO1xyXG5cdFx0dmFyIGRhdGVfb2JqID0ge1xyXG5cdFx0XHQneWVhcicgOiAgcGFyc2VJbnQoIGRhdGVfYXJyWyAyIF0gKSxcclxuXHRcdFx0J21vbnRoJzogKHBhcnNlSW50KCBkYXRlX2FyclsgMSBdICkgLSAxKSxcclxuXHRcdFx0J2RhdGUnIDogIHBhcnNlSW50KCBkYXRlX2FyclsgMCBdIClcclxuXHRcdH07XHJcblx0XHRyZXR1cm4gZGF0ZV9vYmo7XHRcdC8vIGZvciBcdFx0ID0gbmV3IERhdGUoIGRhdGVfb2JqLnllYXIgLCBkYXRlX29iai5tb250aCAsIGRhdGVfb2JqLmRhdGUgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdGFydCggcmVzb3VyY2VfaWQgKXtcclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLm5leHQoKS5oYXNDbGFzcyggJ3dwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZnRlciggJzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGVyXCI+PC9kaXY+PC9kaXY+JyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZGRDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cl9zbWFsbCcgKTtcclxuXHRcdH1cclxuXHRcdHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0YXJ0KCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIFNwaW4gTG9hZGVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgKyAud3BiY19zcGluc19sb2FkZXJfd3JhcHBlcicgKS5yZW1vdmUoKTtcclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICk7XHJcblx0XHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdG9wKCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQWRkIEJsdXIgdG8gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fYmx1cl9fc3RhcnQoIHJlc291cmNlX2lkICl7XHJcblx0XHRpZiAoICEgalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5oYXNDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cicgKSApe1xyXG5cdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmFkZENsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIEJsdXIgaW4gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcmVzb3VyY2VfaWQgKXtcclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXInICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHQvKiAgPT0gIENhbGVuZGFyIFVwZGF0ZSAgLSBWaWV3ICA9PVxyXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZSBMb29rICBvZiBjYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdXBkYXRlX2xvb2soIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHRqUXVlcnkuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBpbnN0ICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlIGR5bmFtaWNhbGx5IE51bWJlciBvZiBNb250aHMgaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZCBpbnRcclxuXHQgKiBAcGFyYW0gbW9udGhzX251bWJlciBpbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIG1vbnRoc19udW1iZXIgKXtcclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHRcdFx0aW5zdC5zZXR0aW5nc1sgJ251bWJlck9mTW9udGhzJyBdID0gbW9udGhzX251bWJlcjtcclxuXHRcdFx0Ly9fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX251bWJlcl9vZl9tb250aHMnLCBtb250aHNfbnVtYmVyICk7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNob3cgY2FsZW5kYXIgaW4gIGRpZmZlcmVudCBTa2luXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gc2VsZWN0ZWRfc2tpbl91cmxcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4oIHNlbGVjdGVkX3NraW5fdXJsICl7XHJcblxyXG5cdC8vY29uc29sZS5sb2coICdTS0lOIFNFTEVDVElPTiA6OicsIHNlbGVjdGVkX3NraW5fdXJsICk7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIENTUyBza2luXHJcblx0XHR2YXIgc3R5bGVzaGVldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiYy1jYWxlbmRhci1za2luLWNzcycgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgXCJ3cGJjLWNhbGVuZGFyLXNraW4tY3NzXCIgKTtcclxuXHRcdGNzc05vZGUucmVsID0gJ3N0eWxlc2hlZXQnO1xyXG5cdFx0Y3NzTm9kZS5tZWRpYSA9ICdzY3JlZW4nO1xyXG5cdFx0Y3NzTm9kZS5ocmVmID0gc2VsZWN0ZWRfc2tpbl91cmw7XHQvL1wiaHR0cDovL2JldGEvd3AtY29udGVudC9wbHVnaW5zL2Jvb2tpbmcvY3NzL3NraW5zL2dyZWVuLTAxLmNzc1wiO1xyXG5cdFx0aGVhZElELmFwcGVuZENoaWxkKCBjc3NOb2RlICk7XHJcblx0fVxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggc2VsZWN0ZWRfc2tpbl91cmwsIHN0eWxlc2hlZXRfaWQgPSAnd3BiYy10aW1lX3BpY2tlci1za2luLWNzcycgKXtcclxuXHJcblx0XHQvLyBSZW1vdmUgQ1NTIHNraW5cclxuXHRcdHZhciBzdHlsZXNoZWV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHN0eWxlc2hlZXRfaWQgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgc3R5bGVzaGVldF9pZCApO1xyXG5cdFx0Y3NzTm9kZS5yZWwgPSAnc3R5bGVzaGVldCc7XHJcblx0XHRjc3NOb2RlLm1lZGlhID0gJ3NjcmVlbic7XHJcblx0XHRjc3NOb2RlLmhyZWYgPSBzZWxlY3RlZF9za2luX3VybDtcdC8vXCJodHRwOi8vYmV0YS93cC1jb250ZW50L3BsdWdpbnMvYm9va2luZy9jc3Mvc2tpbnMvZ3JlZW4tMDEuY3NzXCI7XHJcblx0XHRoZWFkSUQuYXBwZW5kQ2hpbGQoIGNzc05vZGUgKTtcclxuXHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgUyBVIFAgUCBPIFIgVCAgICBNIEEgVCBIICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1lcmdlIHNldmVyYWwgIGludGVyc2VjdGVkIGludGVydmFscyBvciByZXR1cm4gbm90IGludGVyc2VjdGVkOiAgICAgICAgICAgICAgICAgICAgICAgIFtbMSwzXSxbMiw2XSxbOCwxMF0sWzE1LDE4XV0gIC0+ICAgW1sxLDZdLFs4LDEwXSxbMTUsMThdXVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBbXSBpbnRlcnZhbHNcdFx0XHQgWyBbMSwzXSxbMiw0XSxbNiw4XSxbOSwxMF0sWzMsN10gXVxyXG5cdFx0ICogQHJldHVybnMgW11cdFx0XHRcdFx0IFsgWzEsOF0sWzksMTBdIF1cclxuXHRcdCAqXHJcblx0XHQgKiBFeG1hbXBsZTogd3BiY19pbnRlcnZhbHNfX21lcmdlX2luZXJzZWN0ZWQoICBbIFsxLDNdLFsyLDRdLFs2LDhdLFs5LDEwXSxbMyw3XSBdICApO1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2ludGVydmFsc19fbWVyZ2VfaW5lcnNlY3RlZCggaW50ZXJ2YWxzICl7XHJcblxyXG5cdFx0XHRpZiAoICEgaW50ZXJ2YWxzIHx8IGludGVydmFscy5sZW5ndGggPT09IDAgKXtcclxuXHRcdFx0XHRyZXR1cm4gW107XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBtZXJnZWQgPSBbXTtcclxuXHRcdFx0aW50ZXJ2YWxzLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApe1xyXG5cdFx0XHRcdHJldHVybiBhWyAwIF0gLSBiWyAwIF07XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHZhciBtZXJnZWRJbnRlcnZhbCA9IGludGVydmFsc1sgMCBdO1xyXG5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAxOyBpIDwgaW50ZXJ2YWxzLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0dmFyIGludGVydmFsID0gaW50ZXJ2YWxzWyBpIF07XHJcblxyXG5cdFx0XHRcdGlmICggaW50ZXJ2YWxbIDAgXSA8PSBtZXJnZWRJbnRlcnZhbFsgMSBdICl7XHJcblx0XHRcdFx0XHRtZXJnZWRJbnRlcnZhbFsgMSBdID0gTWF0aC5tYXgoIG1lcmdlZEludGVydmFsWyAxIF0sIGludGVydmFsWyAxIF0gKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0bWVyZ2VkLnB1c2goIG1lcmdlZEludGVydmFsICk7XHJcblx0XHRcdFx0XHRtZXJnZWRJbnRlcnZhbCA9IGludGVydmFsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWVyZ2VkLnB1c2goIG1lcmdlZEludGVydmFsICk7XHJcblx0XHRcdHJldHVybiBtZXJnZWQ7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSXMgMiBpbnRlcnZhbHMgaW50ZXJzZWN0ZWQ6ICAgICAgIFszNjAxMSwgODYzOTJdICAgIDw9PiAgICBbMSwgNDMxOTJdICA9PiAgdHJ1ZSAgICAgICggaW50ZXJzZWN0ZWQgKVxyXG5cdFx0ICpcclxuXHRcdCAqIEdvb2QgZXhwbGFuYXRpb24gIGhlcmUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzI2OTQzNC93aGF0cy10aGUtbW9zdC1lZmZpY2llbnQtd2F5LXRvLXRlc3QtaWYtdHdvLXJhbmdlcy1vdmVybGFwXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtICBpbnRlcnZhbF9BICAgLSBbIDM2MDExLCA4NjM5MiBdXHJcblx0XHQgKiBAcGFyYW0gIGludGVydmFsX0IgICAtIFsgICAgIDEsIDQzMTkyIF1cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIGJvb2xcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pbnRlcnZhbHNfX2lzX2ludGVyc2VjdGVkKCBpbnRlcnZhbF9BLCBpbnRlcnZhbF9CICkge1xyXG5cclxuXHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0KCAwID09IGludGVydmFsX0EubGVuZ3RoIClcclxuXHRcdFx0XHQgfHwgKCAwID09IGludGVydmFsX0IubGVuZ3RoIClcclxuXHRcdFx0KXtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGludGVydmFsX0FbIDAgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9BWyAwIF0gKTtcclxuXHRcdFx0aW50ZXJ2YWxfQVsgMSBdID0gcGFyc2VJbnQoIGludGVydmFsX0FbIDEgXSApO1xyXG5cdFx0XHRpbnRlcnZhbF9CWyAwIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQlsgMCBdICk7XHJcblx0XHRcdGludGVydmFsX0JbIDEgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9CWyAxIF0gKTtcclxuXHJcblx0XHRcdHZhciBpc19pbnRlcnNlY3RlZCA9IE1hdGgubWF4KCBpbnRlcnZhbF9BWyAwIF0sIGludGVydmFsX0JbIDAgXSApIC0gTWF0aC5taW4oIGludGVydmFsX0FbIDEgXSwgaW50ZXJ2YWxfQlsgMSBdICk7XHJcblxyXG5cdFx0XHQvLyBpZiAoIDAgPT0gaXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdC8vXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdWNoIHJhbmdlcyBnb2luZyBvbmUgYWZ0ZXIgb3RoZXIsIGUuZy46IFsgMTIsIDE1IF0gYW5kIFsgMTUsIDIxIF1cclxuXHRcdFx0Ly8gfVxyXG5cclxuXHRcdFx0aWYgKCBpc19pbnRlcnNlY3RlZCA8IDAgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7ICAgICAgICAgICAgICAgICAgICAgLy8gSU5URVJTRUNURURcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAgLy8gTm90IGludGVyc2VjdGVkXHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IHRoZSBjbG9zZXRzIEFCUyB2YWx1ZSBvZiBlbGVtZW50IGluIGFycmF5IHRvIHRoZSBjdXJyZW50IG15VmFsdWVcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gbXlWYWx1ZSBcdC0gaW50IGVsZW1lbnQgdG8gc2VhcmNoIGNsb3NldCBcdFx0XHQ0XHJcblx0XHQgKiBAcGFyYW0gbXlBcnJheVx0LSBhcnJheSBvZiBlbGVtZW50cyB3aGVyZSB0byBzZWFyY2ggXHRbNSw4LDEsN11cclxuXHRcdCAqIEByZXR1cm5zIGludFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDVcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfYWJzX2Nsb3Nlc3RfdmFsdWVfaW5fYXJyKCBteVZhbHVlLCBteUFycmF5ICl7XHJcblxyXG5cdFx0XHRpZiAoIG15QXJyYXkubGVuZ3RoID09IDAgKXsgXHRcdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBhcnJheSBpcyBlbXB0eSAtPiByZXR1cm4gIHRoZSBteVZhbHVlXHJcblx0XHRcdFx0cmV0dXJuIG15VmFsdWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBvYmogPSBteUFycmF5WyAwIF07XHJcblx0XHRcdHZhciBkaWZmID0gTWF0aC5hYnMoIG15VmFsdWUgLSBvYmogKTsgICAgICAgICAgICAgXHQvLyBHZXQgZGlzdGFuY2UgYmV0d2VlbiAgMXN0IGVsZW1lbnRcclxuXHRcdFx0dmFyIGNsb3NldFZhbHVlID0gbXlBcnJheVsgMCBdOyAgICAgICAgICAgICAgICAgICBcdFx0XHQvLyBTYXZlIDFzdCBlbGVtZW50XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBteUFycmF5Lmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0b2JqID0gbXlBcnJheVsgaSBdO1xyXG5cclxuXHRcdFx0XHRpZiAoIE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICkgPCBkaWZmICl7ICAgICBcdFx0XHQvLyB3ZSBmb3VuZCBjbG9zZXIgdmFsdWUgLT4gc2F2ZSBpdFxyXG5cdFx0XHRcdFx0ZGlmZiA9IE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICk7XHJcblx0XHRcdFx0XHRjbG9zZXRWYWx1ZSA9IG9iajtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBjbG9zZXRWYWx1ZTtcclxuXHRcdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBUIE8gTyBMIFQgSSBQIFMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdG9vbHRpcCB0byBzaG93LCAgd2hlbiAgbW91c2Ugb3ZlciBEYXRlIGluIENhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gIHRvb2x0aXBfdGV4dFx0XHRcdC0gVGV4dCB0byBzaG93XHRcdFx0XHQnQm9va2VkIHRpbWU6IDEyOjAwIC0gMTM6MDA8YnI+Q29zdDogJDIwLjAwJ1xyXG5cdCAqIEBwYXJhbSAgcmVzb3VyY2VfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcdCcxJ1xyXG5cdCAqIEBwYXJhbSAgdGRfY2xhc3NcdFx0XHRcdC0gU1FMIGNsYXNzXHRcdFx0XHRcdCcxLTktMjAyMydcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0XHRcdFx0LSBkZWZpbmVkIHRvIHNob3cgb3Igbm90XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgdGRfY2xhc3MgKXtcclxuXHJcblx0XHQvL1RPRE86IG1ha2UgZXNjYXBpbmcgb2YgdGV4dCBmb3IgcXVvdCBzeW1ib2xzLCAgYW5kIEpTL0hUTUwuLi5cclxuXHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICkuYXR0ciggJ2RhdGEtY29udGVudCcsIHRvb2x0aXBfdGV4dCApO1xyXG5cclxuXHRcdHZhciB0ZF9lbCA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKS5nZXQoIDAgKTtcdFx0XHRcdFx0Ly8gRml4SW46IDkuMC4xLjEuXHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YodGRfZWwpIClcclxuXHRcdFx0JiYgKCB1bmRlZmluZWQgPT0gdGRfZWwuX3RpcHB5IClcclxuXHRcdFx0JiYgKCAnJyAhPT0gdG9vbHRpcF90ZXh0IClcclxuXHRcdCl7XHJcblxyXG5cdFx0XHR3cGJjX3RpcHB5KCB0ZF9lbCAsIHtcclxuXHRcdFx0XHRcdGNvbnRlbnQoIHJlZmVyZW5jZSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gJzxkaXYgY2xhc3M9XCJwb3BvdmVyIHBvcG92ZXJfdGlwcHlcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzxkaXYgY2xhc3M9XCJwb3BvdmVyLWNvbnRlbnRcIj4nXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0KyBwb3BvdmVyX2NvbnRlbnRcclxuXHRcdFx0XHRcdFx0XHRcdFx0KyAnPC9kaXY+J1xyXG5cdFx0XHRcdFx0XHRcdCArICc8L2Rpdj4nO1xyXG5cdFx0XHRcdFx0fSxcclxuXHRcdFx0XHRcdGFsbG93SFRNTCAgICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dHJpZ2dlclx0XHRcdCA6ICdtb3VzZWVudGVyIGZvY3VzJyxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRcdGhpZGVPbkNsaWNrICAgICAgOiB0cnVlLFxyXG5cdFx0XHRcdFx0aW50ZXJhY3RpdmVCb3JkZXI6IDEwLFxyXG5cdFx0XHRcdFx0bWF4V2lkdGggICAgICAgICA6IDU1MCxcclxuXHRcdFx0XHRcdHRoZW1lICAgICAgICAgICAgOiAnd3BiYy10aXBweS10aW1lcycsXHJcblx0XHRcdFx0XHRwbGFjZW1lbnQgICAgICAgIDogJ3RvcCcsXHJcblx0XHRcdFx0XHRkZWxheVx0XHRcdCA6IFs0MDAsIDBdLFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIEZpeEluOiA5LjQuMi4yLlxyXG5cdFx0XHRcdFx0Ly9kZWxheVx0XHRcdCA6IFswLCA5OTk5OTk5OTk5XSxcdFx0XHRcdFx0XHQvLyBEZWJ1Z2UgIHRvb2x0aXBcclxuXHRcdFx0XHRcdGlnbm9yZUF0dHJpYnV0ZXMgOiB0cnVlLFxyXG5cdFx0XHRcdFx0dG91Y2hcdFx0XHQgOiB0cnVlLFx0XHRcdFx0XHRcdFx0XHQvL1snaG9sZCcsIDUwMF0sIC8vIDUwMG1zIGRlbGF5XHRcdFx0XHQvLyBGaXhJbjogOS4yLjEuNS5cclxuXHRcdFx0XHRcdGFwcGVuZFRvOiAoKSA9PiBkb2N1bWVudC5ib2R5LFxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybiAgdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBEYXRlcyBGdW5jdGlvbnMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEdldCBudW1iZXIgb2YgZGF0ZXMgYmV0d2VlbiAyIEpTIERhdGVzXHJcbiAqXHJcbiAqIEBwYXJhbSBkYXRlMVx0XHRKUyBEYXRlXHJcbiAqIEBwYXJhbSBkYXRlMlx0XHRKUyBEYXRlXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oZGF0ZTEsIGRhdGUyKSB7XHJcblxyXG4gICAgLy8gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgaW4gb25lIGRheVxyXG4gICAgdmFyIE9ORV9EQVkgPSAxMDAwICogNjAgKiA2MCAqIDI0O1xyXG5cclxuICAgIC8vIENvbnZlcnQgYm90aCBkYXRlcyB0byBtaWxsaXNlY29uZHNcclxuICAgIHZhciBkYXRlMV9tcyA9IGRhdGUxLmdldFRpbWUoKTtcclxuICAgIHZhciBkYXRlMl9tcyA9IGRhdGUyLmdldFRpbWUoKTtcclxuXHJcbiAgICAvLyBDYWxjdWxhdGUgdGhlIGRpZmZlcmVuY2UgaW4gbWlsbGlzZWNvbmRzXHJcbiAgICB2YXIgZGlmZmVyZW5jZV9tcyA9ICBkYXRlMV9tcyAtIGRhdGUyX21zO1xyXG5cclxuICAgIC8vIENvbnZlcnQgYmFjayB0byBkYXlzIGFuZCByZXR1cm5cclxuICAgIHJldHVybiBNYXRoLnJvdW5kKGRpZmZlcmVuY2VfbXMvT05FX0RBWSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2hlY2sgIGlmIHRoaXMgYXJyYXkgIG9mIGRhdGVzIGlzIGNvbnNlY3V0aXZlIGFycmF5ICBvZiBkYXRlcyBvciBub3QuXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddIC0+IGZhbHNlXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTEwJywnMjAyNC0wNS0xMSddIC0+IHRydWVcclxuICogQHBhcmFtIHNxbF9kYXRlc19hcnJcdCBhcnJheVx0XHRlLmcuOiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBzcWxfZGF0ZXNfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cclxuXHRpZiAoIHNxbF9kYXRlc19hcnIubGVuZ3RoID4gMSApe1xyXG5cdFx0dmFyIHByZXZpb3NfZGF0ZSA9IHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2RhdGVzX2FyclsgMCBdICk7XHJcblx0XHR2YXIgY3VycmVudF9kYXRlO1xyXG5cclxuXHRcdGZvciAoIHZhciBpID0gMTsgaSA8IHNxbF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKXtcclxuXHRcdFx0Y3VycmVudF9kYXRlID0gd3BiY19fZ2V0X19qc19kYXRlKCBzcWxfZGF0ZXNfYXJyW2ldICk7XHJcblxyXG5cdFx0XHRpZiAoIHdwYmNfZGF0ZXNfX2RheXNfYmV0d2VlbiggY3VycmVudF9kYXRlLCBwcmV2aW9zX2RhdGUgKSAhPSAxICl7XHJcblx0XHRcdFx0cmV0dXJuICBmYWxzZTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cHJldmlvc19kYXRlID0gY3VycmVudF9kYXRlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0cmV0dXJuIHRydWU7XHJcbn1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBBdXRvIERhdGVzIFNlbGVjdGlvbiAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG4vKipcclxuICogID09IEhvdyB0byAgdXNlID8gPT1cclxuICpcclxuICogIEZvciBEYXRlcyBzZWxlY3Rpb24sIHdlIG5lZWQgdG8gdXNlIHRoaXMgbG9naWMhICAgICBXZSBuZWVkIHNlbGVjdCB0aGUgZGF0ZXMgb25seSBhZnRlciBib29raW5nIGRhdGEgbG9hZGVkIVxyXG4gKlxyXG4gKiAgQ2hlY2sgZXhhbXBsZSBiZWxsb3cuXHJcbiAqXHJcbiAqXHQvLyBGaXJlIG9uIGFsbCBib29raW5nIGRhdGVzIGxvYWRlZFxyXG4gKlx0alF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uICggZXZlbnQsIGxvYWRlZF9yZXNvdXJjZV9pZCApe1xyXG4gKlxyXG4gKlx0XHRpZiAoIGxvYWRlZF9yZXNvdXJjZV9pZCA9PSBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQgKXtcclxuICpcdFx0XHR3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqXHRcdH1cclxuICpcdH0gKTtcclxuICpcclxuICovXHJcblxyXG5cclxuLyoqXHJcbiAqIFRyeSB0byBBdXRvIHNlbGVjdCBkYXRlcyBpbiBzcGVjaWZpYyBjYWxlbmRhciBieSBzaW11bGF0ZWQgY2xpY2tzIGluIGRhdGVwaWNrZXJcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdDFcclxuICogQHBhcmFtIGNoZWNrX2luX3ltZFx0XHQnMjAyNC0wNS0wOSdcdFx0T1IgIFx0WycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjAnXVxyXG4gKiBAcGFyYW0gY2hlY2tfb3V0X3ltZFx0XHQnMjAyNC0wNS0xNSdcdFx0T3B0aW9uYWxcclxuICpcclxuICogQHJldHVybnMge251bWJlcn1cdFx0bnVtYmVyIG9mIHNlbGVjdGVkIGRhdGVzXHJcbiAqXHJcbiAqIFx0RXhhbXBsZSAxOlx0XHRcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggMSwgJzIwMjQtMDUtMTUnLCAnMjAyNC0wNS0yNScgKTtcclxuICogXHRFeGFtcGxlIDI6XHRcdFx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCAxLCBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0yMCddICk7XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kID0gJycgKXtcdFx0XHRcdFx0XHRcdFx0Ly8gRml4SW46IDEwLjAuMC40Ny5cclxuXHJcblx0Y29uc29sZS5sb2coICdXUEJDX0FVVE9fU0VMRUNUX0RBVEVTX0lOX0NBTEVOREFSKCBSRVNPVVJDRV9JRCwgQ0hFQ0tfSU5fWU1ELCBDSEVDS19PVVRfWU1EICknLCByZXNvdXJjZV9pZCwgY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kICk7XHJcblxyXG5cdGlmIChcclxuXHRcdCAgICggJzIxMDAtMDEtMDEnID09IGNoZWNrX2luX3ltZCApXHJcblx0XHR8fCAoICcyMTAwLTAxLTAxJyA9PSBjaGVja19vdXRfeW1kIClcclxuXHRcdHx8ICggKCAnJyA9PSBjaGVja19pbl95bWQgKSAmJiAoICcnID09IGNoZWNrX291dF95bWQgKSApXHJcblx0KXtcclxuXHRcdHJldHVybiAwO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBJZiBcdGNoZWNrX2luX3ltZCAgPSAgWyAnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJyBdXHRcdFx0XHRBUlJBWSBvZiBEQVRFU1x0XHRcdFx0XHRcdC8vIEZpeEluOiAxMC4wLjAuNTAuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgZGF0ZXNfdG9fc2VsZWN0X2FyciA9IFtdO1xyXG5cdGlmICggQXJyYXkuaXNBcnJheSggY2hlY2tfaW5feW1kICkgKXtcclxuXHRcdGRhdGVzX3RvX3NlbGVjdF9hcnIgPSB3cGJjX2Nsb25lX29iaiggY2hlY2tfaW5feW1kICk7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRXhjZXB0aW9ucyB0byAgc2V0ICBcdE1VTFRJUExFIERBWVMgXHRtb2RlXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBpZiBkYXRlcyBhcyBOT1QgQ09OU0VDVVRJVkU6IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ10sIC0+IHNldCBNVUxUSVBMRSBEQVlTIG1vZGVcclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKVxyXG5cdFx0XHQmJiAoICcnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0XHQmJiAoICEgd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBkYXRlc190b19zZWxlY3RfYXJyICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0Ly8gaWYgbXVsdGlwbGUgZGF5cyB0byBzZWxlY3QsIGJ1dCBlbmFibGVkIFNJTkdMRSBkYXkgbW9kZSwgLT4gc2V0IE1VTFRJUExFIERBWVMgbW9kZVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoID4gMSApXHJcblx0XHRcdCYmICggJycgPT0gY2hlY2tfb3V0X3ltZCApXHJcblx0XHRcdCYmICggJ3NpbmdsZScgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApXHJcblx0XHQpe1xyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRjaGVja19pbl95bWQgPSBkYXRlc190b19zZWxlY3RfYXJyWyAwIF07XHJcblx0XHRpZiAoICcnID09IGNoZWNrX291dF95bWQgKXtcclxuXHRcdFx0Y2hlY2tfb3V0X3ltZCA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIChkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aC0xKSBdO1xyXG5cdFx0fVxyXG5cdH1cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0aWYgKCAnJyA9PSBjaGVja19pbl95bWQgKXtcclxuXHRcdGNoZWNrX2luX3ltZCA9IGNoZWNrX291dF95bWQ7XHJcblx0fVxyXG5cdGlmICggJycgPT0gY2hlY2tfb3V0X3ltZCApe1xyXG5cdFx0Y2hlY2tfb3V0X3ltZCA9IGNoZWNrX2luX3ltZDtcclxuXHR9XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRyZXNvdXJjZV9pZCA9ICcxJztcclxuXHR9XHJcblxyXG5cclxuXHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHQvLyBVbnNlbGVjdCBhbGwgZGF0ZXMgYW5kIHNldCAgcHJvcGVydGllcyBvZiBEYXRlcGlja1xyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTsgICAgICBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogNS40LjNcclxuXHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdGluc3QuZGF0ZXMgPSBbXTtcclxuXHRcdHZhciBjaGVja19pbl9qcyA9IHdwYmNfX2dldF9fanNfZGF0ZSggY2hlY2tfaW5feW1kICk7XHJcblx0XHR2YXIgdGRfY2VsbCAgICAgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19pbl9qcyApO1xyXG5cclxuXHRcdC8vIElzIG9tZSB0eXBlIG9mIGVycm9yLCB0aGVuIHNlbGVjdCBtdWx0aXBsZSBkYXlzIHNlbGVjdGlvbiAgbW9kZS5cclxuXHRcdGlmICggJycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApIHtcclxuIFx0XHRcdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScsICdtdWx0aXBsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRFlOQU1JQyA9PVxyXG5cdFx0aWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cdFx0XHQvLyAxLXN0IGNsaWNrXHJcblx0XHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0XHRpZiAoIDAgPT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdFx0cmV0dXJuIDA7ICBcdFx0XHRcdFx0XHRcdFx0Ly8gRmlyc3QgY2xpY2sgIHdhcyB1bnN1Y2Nlc3NmdWwsIHNvIHdlIG11c3Qgbm90IG1ha2Ugb3RoZXIgY2xpY2tcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gMi1uZCBjbGlja1xyXG5cdFx0XHR2YXIgY2hlY2tfb3V0X2pzID0gd3BiY19fZ2V0X19qc19kYXRlKCBjaGVja19vdXRfeW1kICk7XHJcblx0XHRcdHZhciB0ZF9jZWxsX291dCA9IHdwYmNfZ2V0X2NsaWNrZWRfdGQoIGluc3QuaWQsIGNoZWNrX291dF9qcyApO1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gdHJ1ZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGxfb3V0LCAnIycgKyBpbnN0LmlkLCBjaGVja19vdXRfanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRklYRUQgPT1cclxuXHRcdGlmICggICdmaXhlZCcgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSkge1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gU0lOR0xFID09XHJcblx0XHRpZiAoICdzaW5nbGUnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdFx0Ly9qUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGNoZWNrX2luX2pzLCBudWxsICkgKTtcdFx0Ly8gRG8gd2UgbmVlZCB0byBydW4gIHRoaXMgPyBQbGVhc2Ugbm90ZSwgY2hlY2tfaW5fanMgbXVzdCAgaGF2ZSB0aW1lLCAgbWluLCBzZWMgZGVmaW5lZCB0byAwIVxyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gTVVMVElQTEUgPT1cclxuXHRcdGlmICggJ211bHRpcGxlJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyO1xyXG5cclxuXHRcdFx0aWYgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0XHQvLyBTaXR1YXRpb24sIHdoZW4gd2UgaGF2ZSBkYXRlcyBhcnJheTogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXS4gIGFuZCBub3QgdGhlIENoZWNrIEluIC8gQ2hlY2sgIG91dCBkYXRlcyBhcyBwYXJhbWV0ZXIgaW4gdGhpcyBmdW5jdGlvblxyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2FyciggZGF0ZXNfdG9fc2VsZWN0X2FyciApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kLCBpbnN0ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggMCA9PT0gZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGb3IgQ2FsZW5kYXIgRGF5cyBzZWxlY3Rpb25cclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aDsgaisrICl7ICAgICAgIC8vIExvb3AgYXJyYXkgb2YgZGF0ZXNcclxuXHJcblx0XHRcdFx0dmFyIHN0cl9kYXRlID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHJcblx0XHRcdFx0Ly8gRGF0ZSB1bmF2YWlsYWJsZSAhXHJcblx0XHRcdFx0aWYgKCAwID09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzdHJfZGF0ZSApLmRheV9hdmFpbGFiaWxpdHkgKXtcclxuXHRcdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBkYXRlc19hcnIuZGF0ZXNfanNbIGogXSAhPSAtMSApIHtcclxuXHRcdFx0XHRcdGluc3QuZGF0ZXMucHVzaCggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBjaGVja19vdXRfZGF0ZSA9IGRhdGVzX2Fyci5kYXRlc19qc1sgKGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGggLSAxKSBdO1xyXG5cclxuXHRcdFx0aW5zdC5kYXRlcy5wdXNoKCBjaGVja19vdXRfZGF0ZSApOyBcdFx0XHQvLyBOZWVkIGFkZCBvbmUgYWRkaXRpb25hbCBTQU1FIGRhdGUgZm9yIGNvcnJlY3QgIHdvcmtzIG9mIGRhdGVzIHNlbGVjdGlvbiAhISEhIVxyXG5cclxuXHRcdFx0dmFyIGNoZWNrb3V0X3RpbWVzdGFtcCA9IGNoZWNrX291dF9kYXRlLmdldFRpbWUoKTtcclxuXHRcdFx0dmFyIHRkX2NlbGwgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19vdXRfZGF0ZSApO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrb3V0X3RpbWVzdGFtcCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRpZiAoIDAgIT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdC8vIFNjcm9sbCB0byBzcGVjaWZpYyBtb250aCwgaWYgd2Ugc2V0IGRhdGVzIGluIHNvbWUgZnV0dXJlIG1vbnRoc1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBpbnN0LmRhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSwgaW5zdC5kYXRlc1sgMCBdLmdldE1vbnRoKCkrMSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBpbnN0LmRhdGVzLmxlbmd0aDtcclxuXHR9XHJcblxyXG5cdHJldHVybiAwO1xyXG59XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBIVE1MIHRkIGVsZW1lbnQgKHdoZXJlIHdhcyBjbGljayBpbiBjYWxlbmRhciAgZGF5ICBjZWxsKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX2h0bWxfaWRcdFx0XHQnY2FsZW5kYXJfYm9va2luZzEnXHJcblx0ICogQHBhcmFtIGRhdGVfanNcdFx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHsqfGpRdWVyeX1cdFx0XHRcdERvbSBIVE1MIHRkIGVsZW1lbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9jbGlja2VkX3RkKCBjYWxlbmRhcl9odG1sX2lkLCBkYXRlX2pzICl7XHJcblxyXG5cdCAgICB2YXIgdGRfY2VsbCA9IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfaHRtbF9pZCArICcgLnNxbF9kYXRlXycgKyB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlX2pzICkgKS5nZXQoIDAgKTtcclxuXHJcblx0XHRyZXR1cm4gdGRfY2VsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNoZWNrX2luX3ltZFx0XHRcdFx0XHRcdFx0JzIwMjQtMDUtMTUnXHJcblx0ICogQHBhcmFtIGNoZWNrX291dF95bWRcdFx0XHRcdFx0XHRcdCcyMDI0LTA1LTI1J1xyXG5cdCAqIEBwYXJhbSBpbnN0XHRcdFx0XHRcdFx0XHRcdFx0RGF0ZXBpY2sgSW5zdC4gVXNlIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdCAqIEByZXR1cm5zIHt7ZGF0ZXNfanM6ICpbXSwgZGF0ZXNfc3RyOiAqW119fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kICwgaW5zdCApe1xyXG5cclxuXHRcdHZhciBvcmlnaW5hbF9hcnJheSA9IFtdO1xyXG5cdFx0dmFyIGRhdGU7XHJcblx0XHR2YXIgYmtfZGlzdGluY3RfZGF0ZXMgPSBbXTtcclxuXHJcblx0XHR2YXIgY2hlY2tfaW5fZGF0ZSA9IGNoZWNrX2luX3ltZC5zcGxpdCggJy0nICk7XHJcblx0XHR2YXIgY2hlY2tfb3V0X2RhdGUgPSBjaGVja19vdXRfeW1kLnNwbGl0KCAnLScgKTtcclxuXHJcblx0XHRkYXRlID0gbmV3IERhdGUoKTtcclxuXHRcdGRhdGUuc2V0RnVsbFllYXIoIGNoZWNrX2luX2RhdGVbIDAgXSwgKGNoZWNrX2luX2RhdGVbIDEgXSAtIDEpLCBjaGVja19pbl9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgPSBkYXRlO1xyXG5cdFx0b3JpZ2luYWxfYXJyYXkucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBkYXRlLCBudWxsICkgKSApOyAvL2FkZCBkYXRlXHJcblx0XHRpZiAoICEgd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChjaGVja19pbl9kYXRlWyAyIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAxIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0pICkgKXtcclxuXHRcdFx0YmtfZGlzdGluY3RfZGF0ZXMucHVzaCggcGFyc2VJbnQoY2hlY2tfaW5fZGF0ZVsgMiBdKSArICcuJyArIHBhcnNlSW50KGNoZWNrX2luX2RhdGVbIDEgXSkgKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0gKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZGF0ZV9vdXQgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0ZGF0ZV9vdXQuc2V0RnVsbFllYXIoIGNoZWNrX291dF9kYXRlWyAwIF0sIChjaGVja19vdXRfZGF0ZVsgMSBdIC0gMSksIGNoZWNrX291dF9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID0gZGF0ZV9vdXQ7XHJcblxyXG5cdFx0dmFyIG1ld0RhdGUgPSBuZXcgRGF0ZSggb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXRGdWxsWWVhcigpLCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldE1vbnRoKCksIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICk7XHJcblx0XHRtZXdEYXRlLnNldERhdGUoIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICsgMSApO1xyXG5cclxuXHRcdHdoaWxlIChcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID4gZGF0ZSkgJiZcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgIT0gb3JpZ2luYWxfY2hlY2tfb3V0X2RhdGUpICl7XHJcblx0XHRcdGRhdGUgPSBuZXcgRGF0ZSggbWV3RGF0ZS5nZXRGdWxsWWVhcigpLCBtZXdEYXRlLmdldE1vbnRoKCksIG1ld0RhdGUuZ2V0RGF0ZSgpICk7XHJcblxyXG5cdFx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCBqUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGRhdGUsIG51bGwgKSApICk7IC8vYWRkIGRhdGVcclxuXHRcdFx0aWYgKCAhd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChkYXRlLmdldERhdGUoKSArICcuJyArIHBhcnNlSW50KCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLicgKyBkYXRlLmdldEZ1bGxZZWFyKCkpICkgKXtcclxuXHRcdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCAocGFyc2VJbnQoZGF0ZS5nZXREYXRlKCkpICsgJy4nICsgcGFyc2VJbnQoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICcuJyArIGRhdGUuZ2V0RnVsbFllYXIoKSkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWV3RGF0ZSA9IG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKTtcclxuXHRcdFx0bWV3RGF0ZS5zZXREYXRlKCBtZXdEYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHRcdG9yaWdpbmFsX2FycmF5LnBvcCgpO1xyXG5cdFx0YmtfZGlzdGluY3RfZGF0ZXMucG9wKCk7XHJcblxyXG5cdFx0cmV0dXJuIHsnZGF0ZXNfanMnOiBvcmlnaW5hbF9hcnJheSwgJ2RhdGVzX3N0cic6IGJrX2Rpc3RpbmN0X2RhdGVzfTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVzX3RvX3NlbGVjdF9hcnJcdD0gWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXVxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3tkYXRlc19qczogKltdLCBkYXRlc19zdHI6ICpbXX19XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfc2VsZWN0aW9uX2RhdGVzX2pzX3N0cl9hcnJfX2Zyb21fYXJyKCBkYXRlc190b19zZWxlY3RfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjUwLlxyXG5cclxuXHRcdHZhciBvcmlnaW5hbF9hcnJheSAgICA9IFtdO1xyXG5cdFx0dmFyIGJrX2Rpc3RpbmN0X2RhdGVzID0gW107XHJcblx0XHR2YXIgb25lX2RhdGVfc3RyO1xyXG5cclxuXHRcdGZvciAoIHZhciBkID0gMDsgZCA8IGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoOyBkKysgKXtcclxuXHJcblx0XHRcdG9yaWdpbmFsX2FycmF5LnB1c2goIHdwYmNfX2dldF9fanNfZGF0ZSggZGF0ZXNfdG9fc2VsZWN0X2FyclsgZCBdICkgKTtcclxuXHJcblx0XHRcdG9uZV9kYXRlX3N0ciA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIGQgXS5zcGxpdCgnLScpXHJcblx0XHRcdGlmICggISB3cGJjX2luX2FycmF5KCBia19kaXN0aW5jdF9kYXRlcywgKG9uZV9kYXRlX3N0clsgMiBdICsgJy4nICsgb25lX2RhdGVfc3RyWyAxIF0gKyAnLicgKyBvbmVfZGF0ZV9zdHJbIDAgXSkgKSApe1xyXG5cdFx0XHRcdGJrX2Rpc3RpbmN0X2RhdGVzLnB1c2goIHBhcnNlSW50KG9uZV9kYXRlX3N0clsgMiBdKSArICcuJyArIHBhcnNlSW50KG9uZV9kYXRlX3N0clsgMSBdKSArICcuJyArIG9uZV9kYXRlX3N0clsgMCBdICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4geydkYXRlc19qcyc6IG9yaWdpbmFsX2FycmF5LCAnZGF0ZXNfc3RyJzogb3JpZ2luYWxfYXJyYXl9O1xyXG5cdH1cclxuXHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4vKiAgPT0gIEF1dG8gRmlsbCBGaWVsZHMgLyBBdXRvIFNlbGVjdCBEYXRlcyAgPT1cclxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXHJcblxyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHR2YXIgdXJsX3BhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoIHdpbmRvdy5sb2NhdGlvbi5zZWFyY2ggKTtcclxuXHJcblx0Ly8gRGlzYWJsZSBkYXlzIHNlbGVjdGlvbiAgaW4gY2FsZW5kYXIsICBhZnRlciAgcmVkaXJlY3Rpb24gIGZyb20gIHRoZSBcIlNlYXJjaCByZXN1bHRzIHBhZ2UsICBhZnRlciAgc2VhcmNoICBhdmFpbGFiaWxpdHlcIiBcdFx0XHQvLyBGaXhJbjogOC44LjIuMy5cclxuXHRpZiAgKCAnT24nICE9IF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ2lzX2VuYWJsZWRfYm9va2luZ19zZWFyY2hfcmVzdWx0c19kYXlzX3NlbGVjdCcgKSApIHtcclxuXHRcdGlmIChcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NoZWNrX2luJyApICkgJiZcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NoZWNrX291dCcgKSApICYmXHJcblx0XHRcdCggdXJsX3BhcmFtcy5oYXMoICd3cGJjX3NlbGVjdF9jYWxlbmRhcl9pZCcgKSApXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0dmFyIHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCA9IHBhcnNlSW50KCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NhbGVuZGFyX2lkJyApICk7XHJcblxyXG5cdFx0XHQvLyBGaXJlIG9uIGFsbCBib29raW5nIGRhdGVzIGxvYWRlZFxyXG5cdFx0XHRqUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhJywgZnVuY3Rpb24gKCBldmVudCwgbG9hZGVkX3Jlc291cmNlX2lkICl7XHJcblxyXG5cdFx0XHRcdGlmICggbG9hZGVkX3Jlc291cmNlX2lkID09IHNlbGVjdF9kYXRlc19pbl9jYWxlbmRhcl9pZCApe1xyXG5cdFx0XHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkLCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NoZWNrX2luJyApLCB1cmxfcGFyYW1zLmdldCggJ3dwYmNfc2VsZWN0X2NoZWNrX291dCcgKSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfYXV0b19maWxsJyApICl7XHJcblxyXG5cdFx0dmFyIHdwYmNfYXV0b19maWxsX3ZhbHVlID0gdXJsX3BhcmFtcy5nZXQoICd3cGJjX2F1dG9fZmlsbCcgKTtcclxuXHJcblx0XHQvLyBDb252ZXJ0IGJhY2suICAgICBTb21lIHN5c3RlbXMgZG8gbm90IGxpa2Ugc3ltYm9sICd+JyBpbiBVUkwsIHNvICB3ZSBuZWVkIHRvIHJlcGxhY2UgdG8gIHNvbWUgb3RoZXIgc3ltYm9sc1xyXG5cdFx0d3BiY19hdXRvX2ZpbGxfdmFsdWUgPSB3cGJjX2F1dG9fZmlsbF92YWx1ZS5yZXBsYWNlQWxsKCAnX15fJywgJ34nICk7XHJcblxyXG5cdFx0d3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHMoIHdwYmNfYXV0b19maWxsX3ZhbHVlICk7XHJcblx0fVxyXG5cclxufSApO1xyXG5cclxuLyoqXHJcbiAqIEF1dG9maWxsIC8gc2VsZWN0IGJvb2tpbmcgZm9ybSAgZmllbGRzIGJ5ICB2YWx1ZXMgZnJvbSAgdGhlIEdFVCByZXF1ZXN0ICBwYXJhbWV0ZXI6ID93cGJjX2F1dG9fZmlsbD1cclxuICpcclxuICogQHBhcmFtIGF1dG9fZmlsbF9zdHJcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfYXV0b19maWxsX2Jvb2tpbmdfZmllbGRzKCBhdXRvX2ZpbGxfc3RyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBGaXhJbjogMTAuMC4wLjQ4LlxyXG5cclxuXHRpZiAoICcnID09IGF1dG9fZmlsbF9zdHIgKXtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG4vLyBjb25zb2xlLmxvZyggJ1dQQkNfQVVUT19GSUxMX0JPT0tJTkdfRklFTERTKCBBVVRPX0ZJTExfU1RSICknLCBhdXRvX2ZpbGxfc3RyKTtcclxuXHJcblx0dmFyIGZpZWxkc19hcnIgPSB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UoIGF1dG9fZmlsbF9zdHIgKTtcclxuXHJcblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgZmllbGRzX2Fyci5sZW5ndGg7IGkrKyApe1xyXG5cdFx0alF1ZXJ5KCAnW25hbWU9XCInICsgZmllbGRzX2FyclsgaSBdWyAnbmFtZScgXSArICdcIl0nICkudmFsKCBmaWVsZHNfYXJyWyBpIF1bICd2YWx1ZScgXSApO1xyXG5cdH1cclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBkYXRhIGZyb20gIGdldCBwYXJhbWV0ZXI6XHQ/d3BiY19hdXRvX2ZpbGw9dmlzaXRvcnMyMzFeMn5tYXhfY2FwYWNpdHkyMzFeMlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGFfc3RyICAgICAgPSAgICd2aXNpdG9yczIzMV4yfm1heF9jYXBhY2l0eTIzMV4yJztcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UoIGRhdGFfc3RyICl7XHJcblxyXG5cdFx0dmFyIGZpbHRlcl9vcHRpb25zX2FyciA9IFtdO1xyXG5cclxuXHRcdHZhciBkYXRhX2FyciA9IGRhdGFfc3RyLnNwbGl0KCAnficgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBkYXRhX2Fyci5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0dmFyIG15X2Zvcm1fZmllbGQgPSBkYXRhX2FyclsgaiBdLnNwbGl0KCAnXicgKTtcclxuXHJcblx0XHRcdHZhciBmaWx0ZXJfbmFtZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMCBdKSkgPyBteV9mb3JtX2ZpZWxkWyAwIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl92YWx1ZSA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAxIF0pKSA/IG15X2Zvcm1fZmllbGRbIDEgXSA6ICcnO1xyXG5cclxuXHRcdFx0ZmlsdGVyX29wdGlvbnNfYXJyLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICA6IGZpbHRlcl9uYW1lLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlJyA6IGZpbHRlcl92YWx1ZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCAgICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmlsdGVyX29wdGlvbnNfYXJyO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgZGF0YSBmcm9tICBnZXQgcGFyYW1ldGVyOlx0P3NlYXJjaF9nZXRfX2N1c3RvbV9wYXJhbXM9Li4uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0YV9zdHIgICAgICA9ICAgJ3RleHRec2VhcmNoX2ZpZWxkX19kaXNwbGF5X2NoZWNrX2luXjIzLjA1LjIwMjR+dGV4dF5zZWFyY2hfZmllbGRfX2Rpc3BsYXlfY2hlY2tfb3V0XjI2LjA1LjIwMjR+c2VsZWN0Ym94LW9uZV5zZWFyY2hfcXVhbnRpdHleMn5zZWxlY3Rib3gtb25lXmxvY2F0aW9uXlNwYWlufnNlbGVjdGJveC1vbmVebWF4X2NhcGFjaXR5XjJ+c2VsZWN0Ym94LW9uZV5hbWVuaXR5XnBhcmtpbmd+Y2hlY2tib3hec2VhcmNoX2ZpZWxkX19leHRlbmRfc2VhcmNoX2RheXNeNX5zdWJtaXReXlNlYXJjaH5oaWRkZW5ec2VhcmNoX2dldF9fY2hlY2tfaW5feW1kXjIwMjQtMDUtMjN+aGlkZGVuXnNlYXJjaF9nZXRfX2NoZWNrX291dF95bWReMjAyNC0wNS0yNn5oaWRkZW5ec2VhcmNoX2dldF9fdGltZV5+aGlkZGVuXnNlYXJjaF9nZXRfX3F1YW50aXR5XjJ+aGlkZGVuXnNlYXJjaF9nZXRfX2V4dGVuZF41fmhpZGRlbl5zZWFyY2hfZ2V0X191c2Vyc19pZF5+aGlkZGVuXnNlYXJjaF9nZXRfX2N1c3RvbV9wYXJhbXNefic7XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdXRvX2ZpbGxfc2VhcmNoX2ZpZWxkc19fcGFyc2UoIGRhdGFfc3RyICl7XHJcblxyXG5cdFx0dmFyIGZpbHRlcl9vcHRpb25zX2FyciA9IFtdO1xyXG5cclxuXHRcdHZhciBkYXRhX2FyciA9IGRhdGFfc3RyLnNwbGl0KCAnficgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBkYXRhX2Fyci5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0dmFyIG15X2Zvcm1fZmllbGQgPSBkYXRhX2FyclsgaiBdLnNwbGl0KCAnXicgKTtcclxuXHJcblx0XHRcdHZhciBmaWx0ZXJfdHlwZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMCBdKSkgPyBteV9mb3JtX2ZpZWxkWyAwIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl9uYW1lICA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAxIF0pKSA/IG15X2Zvcm1fZmllbGRbIDEgXSA6ICcnO1xyXG5cdFx0XHR2YXIgZmlsdGVyX3ZhbHVlID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDIgXSkpID8gbXlfZm9ybV9maWVsZFsgMiBdIDogJyc7XHJcblxyXG5cdFx0XHRmaWx0ZXJfb3B0aW9uc19hcnIucHVzaChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgIDogZmlsdGVyX3R5cGUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgIDogZmlsdGVyX25hbWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWUnIDogZmlsdGVyX3ZhbHVlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0ICAgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBmaWx0ZXJfb3B0aW9uc19hcnI7XHJcblx0fVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIEF1dG8gVXBkYXRlIG51bWJlciBvZiBtb250aHMgaW4gY2FsZW5kYXJzIE9OIHNjcmVlbiBzaXplIGNoYW5nZWQgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEF1dG8gVXBkYXRlIE51bWJlciBvZiBNb250aHMgaW4gQ2FsZW5kYXIsIGUuZy46ICBcdFx0aWYgICAgKCBXSU5ET1dfV0lEVEggPD0gNzgycHggKSAgID4+PiBcdE1PTlRIU19OVU1CRVIgPSAxXHJcbiAqICAgRUxTRTogIG51bWJlciBvZiBtb250aHMgZGVmaW5lZCBpbiBzaG9ydGNvZGUuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCBpbnRcclxuICpcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXJfX29uX3Jlc2l6ZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0aWYgKCB0cnVlID09PSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19hbGxvd19zZXZlcmFsX21vbnRoc19vbl9tb2JpbGUnICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR2YXIgbG9jYWxfX251bWJlcl9vZl9tb250aHMgPSBwYXJzZUludCggX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJyApICk7XHJcblxyXG5cdGlmICggbG9jYWxfX251bWJlcl9vZl9tb250aHMgPiAxICl7XHJcblxyXG5cdFx0aWYgKCBqUXVlcnkoIHdpbmRvdyApLndpZHRoKCkgPD0gNzgyICl7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9tb250aHNfbnVtYmVyKCByZXNvdXJjZV9pZCwgMSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fdXBkYXRlX21vbnRoc19udW1iZXIoIHJlc291cmNlX2lkLCBsb2NhbF9fbnVtYmVyX29mX21vbnRocyApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdXRvIFVwZGF0ZSBOdW1iZXIgb2YgTW9udGhzIGluICAgQUxMICAgQ2FsZW5kYXJzXHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpe1xyXG5cclxuXHR2YXIgYWxsX2NhbGVuZGFyc19hcnIgPSBfd3BiYy5jYWxlbmRhcnNfYWxsX19nZXQoKTtcclxuXHJcblx0Ly8gVGhpcyBMT09QIFwiZm9yIGluXCIgaXMgR09PRCwgYmVjYXVzZSB3ZSBjaGVjayAgaGVyZSBrZXlzICAgICdjYWxlbmRhcl8nID09PSBjYWxlbmRhcl9pZC5zbGljZSggMCwgOSApXHJcblx0Zm9yICggdmFyIGNhbGVuZGFyX2lkIGluIGFsbF9jYWxlbmRhcnNfYXJyICl7XHJcblx0XHRpZiAoICdjYWxlbmRhcl8nID09PSBjYWxlbmRhcl9pZC5zbGljZSggMCwgOSApICl7XHJcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IHBhcnNlSW50KCBjYWxlbmRhcl9pZC5zbGljZSggOSApICk7XHRcdFx0Ly8gICdjYWxlbmRhcl8zJyAtPiAzXHJcblx0XHRcdGlmICggcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9fYXV0b191cGRhdGVfbW9udGhzX251bWJlcl9fb25fcmVzaXplKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogSWYgYnJvd3NlciB3aW5kb3cgY2hhbmdlZCwgIHRoZW4gIHVwZGF0ZSBudW1iZXIgb2YgbW9udGhzLlxyXG4gKi9cclxualF1ZXJ5KCB3aW5kb3cgKS5vbiggJ3Jlc2l6ZScsIGZ1bmN0aW9uICgpe1xyXG5cdHdwYmNfY2FsZW5kYXJzX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyKCk7XHJcbn0gKTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvIHVwZGF0ZSBjYWxlbmRhciBudW1iZXIgb2YgbW9udGhzIG9uIGluaXRpYWwgcGFnZSBsb2FkXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdHdwYmNfY2FsZW5kYXJzX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyKCk7XHJcblx0fSwgMTAwICk7XHJcbn0pOyIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9jYWwvZGF5c19zZWxlY3RfY3VzdG9tLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLy8gRml4SW46IDkuOC45LjIuXHJcblxyXG4vKipcclxuICogUmUtSW5pdCBDYWxlbmRhciBhbmQgUmUtUmVuZGVyIGl0LlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBSZW1vdmUgQ0xBU1MgIGZvciBhYmlsaXR5IHRvIHJlLXJlbmRlciBhbmQgcmVpbml0IGNhbGVuZGFyLlxyXG5cdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICdoYXNEYXRlcGljaycgKTtcclxuXHR3cGJjX2NhbGVuZGFyX3Nob3coIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogUmUtSW5pdCBwcmV2aW91c2x5ICBzYXZlZCBkYXlzIHNlbGVjdGlvbiAgdmFyaWFibGVzLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ3NhdmVkX3ZhcmlhYmxlX19fZGF5c19zZWxlY3RfaW5pdGlhbCdcclxuXHRcdCwge1xyXG5cdFx0XHQnZHluYW1pY19fZGF5c19taW4nICAgICAgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19taW4nICksXHJcblx0XHRcdCdkeW5hbWljX19kYXlzX21heCcgICAgICAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21heCcgKSxcclxuXHRcdFx0J2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnICksXHJcblx0XHRcdCdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JzogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JyApLFxyXG5cdFx0XHQnZml4ZWRfX2RheXNfbnVtJyAgICAgICAgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZml4ZWRfX2RheXNfbnVtJyApLFxyXG5cdFx0XHQnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZml4ZWRfX3dlZWtfZGF5c19fc3RhcnQnIClcclxuXHRcdH1cclxuXHQpO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgU2luZ2xlIERheSBzZWxlY3Rpb24gLSBhZnRlciBwYWdlIGxvYWRcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19zaW5nbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fc2luZ2xlKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG4vKipcclxuICogU2V0IFNpbmdsZSBEYXkgc2VsZWN0aW9uXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fc2luZ2xlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnc2luZ2xlJ30gKTtcclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNldCBNdWx0aXBsZSBEYXlzIHNlbGVjdGlvbiAgLSBhZnRlciBwYWdlIGxvYWRcclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZXQgTXVsdGlwbGUgRGF5cyBzZWxlY3Rpb25cclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHRcdElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19tdWx0aXBsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ211bHRpcGxlJ30gKTtcclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgRml4ZWQgRGF5cyBzZWxlY3Rpb24gd2l0aCAgMSBtb3VzZSBjbGljayAgLSBhZnRlciBwYWdlIGxvYWRcclxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKSAtXHJcbiAqIEBpbnRlZ2VyIGRheXNfbnVtYmVyXHRcdFx0LSAzXHRcdFx0XHQgICAtLSBudW1iZXIgb2YgZGF5cyB0byAgc2VsZWN0XHQtXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHQtIFstMV0gfCBbIDEsIDVdICAgLS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfcmVhZHlfZGF5c19zZWxlY3RfX2ZpeGVkKCByZXNvdXJjZV9pZCwgZGF5c19udW1iZXIsIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fZml4ZWQoIHJlc291cmNlX2lkLCBkYXlzX251bWJlciwgd2Vla19kYXlzX19zdGFydCApO1xyXG5cclxuXHRcdH0sIDEwMDApO1xyXG5cdH0pO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFNldCBGaXhlZCBEYXlzIHNlbGVjdGlvbiB3aXRoICAxIG1vdXNlIGNsaWNrXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICAtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcikgLVxyXG4gKiBAaW50ZWdlciBkYXlzX251bWJlclx0XHRcdC0gM1x0XHRcdFx0ICAgLS0gbnVtYmVyIG9mIGRheXMgdG8gIHNlbGVjdFx0LVxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0LSBbLTFdIHwgWyAxLCA1XSAgIC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19maXhlZCggcmVzb3VyY2VfaWQsIGRheXNfbnVtYmVyLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnZml4ZWQnfSApO1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2ZpeGVkX19kYXlzX251bSc6IHBhcnNlSW50KCBkYXlzX251bWJlciApfSApO1x0XHRcdC8vIE51bWJlciBvZiBkYXlzIHNlbGVjdGlvbiB3aXRoIDEgbW91c2UgY2xpY2tcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoIHJlc291cmNlX2lkLCB7J2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0Jzogd2Vla19kYXlzX19zdGFydH0gKTsgXHQvLyB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuXHJcblx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcblx0d3BiY19jYWxfX3JlX2luaXQoIHJlc291cmNlX2lkICk7XHJcbn1cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNldCBSYW5nZSBEYXlzIHNlbGVjdGlvbiAgd2l0aCAgMiBtb3VzZSBjbGlja3MgIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICBcdFx0LS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpXHJcbiAqIEBpbnRlZ2VyIGRheXNfbWluXHRcdFx0LSA3XHRcdFx0XHQgICBcdFx0LS0gTWluIG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAaW50ZWdlciBkYXlzX21heFx0XHRcdC0gMzBcdFx0XHQgICBcdFx0LS0gTWF4IG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAYXJyYXkgZGF5c19zcGVjaWZpY1x0XHRcdC0gW10gfCBbNywxNCwyMSwyOF1cdFx0LS0gUmVzdHJpY3Rpb24gZm9yIFNwZWNpZmljIG51bWJlciBvZiBkYXlzIHNlbGVjdGlvblxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0XHQtIFstMV0gfCBbIDEsIDVdICAgXHRcdC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYyA9IFtdLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlKCByZXNvdXJjZV9pZCwgZGF5c19taW4sIGRheXNfbWF4LCBkYXlzX3NwZWNpZmljLCB3ZWVrX2RheXNfX3N0YXJ0ICk7XHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCBSYW5nZSBEYXlzIHNlbGVjdGlvbiAgd2l0aCAgMiBtb3VzZSBjbGlja3NcclxuICogQ2FuIGJlIHJ1biBhdCBhbnkgIHRpbWUsICB3aGVuICBjYWxlbmRhciBkZWZpbmVkIC0gdXNlZnVsIGZvciBjb25zb2xlIHJ1bi5cclxuICpcclxuICogQGludGVnZXIgcmVzb3VyY2VfaWRcdFx0XHQtIDFcdFx0XHRcdCAgIFx0XHQtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcilcclxuICogQGludGVnZXIgZGF5c19taW5cdFx0XHQtIDdcdFx0XHRcdCAgIFx0XHQtLSBNaW4gbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBpbnRlZ2VyIGRheXNfbWF4XHRcdFx0LSAzMFx0XHRcdCAgIFx0XHQtLSBNYXggbnVtYmVyIG9mIGRheXMgdG8gc2VsZWN0XHJcbiAqIEBhcnJheSBkYXlzX3NwZWNpZmljXHRcdFx0LSBbXSB8IFs3LDE0LDIxLDI4XVx0XHQtLSBSZXN0cmljdGlvbiBmb3IgU3BlY2lmaWMgbnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uXHJcbiAqIEBhcnJheSB3ZWVrX2RheXNfX3N0YXJ0XHRcdC0gWy0xXSB8IFsgMSwgNV0gICBcdFx0LS0gIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3JhbmdlKCByZXNvdXJjZV9pZCwgZGF5c19taW4sIGRheXNfbWF4LCBkYXlzX3NwZWNpZmljID0gW10sIHdlZWtfZGF5c19fc3RhcnQgPSBbLTFdICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggIHJlc291cmNlX2lkLCB7J2RheXNfc2VsZWN0X21vZGUnOiAnZHluYW1pYyd9ICApO1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19taW4nICAgICAgICAgLCBwYXJzZUludCggZGF5c19taW4gKSAgKTsgICAgICAgICAgIFx0XHQvLyBNaW4uIE51bWJlciBvZiBkYXlzIHNlbGVjdGlvbiB3aXRoIDIgbW91c2UgY2xpY2tzXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX21heCcgICAgICAgICAsIHBhcnNlSW50KCBkYXlzX21heCApICApOyAgICAgICAgICBcdFx0Ly8gTWF4LiBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAyIG1vdXNlIGNsaWNrc1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19zcGVjaWZpYycgICAgLCBkYXlzX3NwZWNpZmljICApO1x0ICAgICAgXHRcdFx0XHQvLyBFeGFtcGxlIFs1LDddXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX193ZWVrX2RheXNfX3N0YXJ0JyAsIHdlZWtfZGF5c19fc3RhcnQgICk7ICBcdFx0XHRcdFx0Ly8geyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcbiIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9jYWxfYWp4X2xvYWQvd3BiY19jYWxfYWp4LmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8vICBBIGogYSB4ICAgIEwgbyBhIGQgICAgQyBhIGwgZSBuIGQgYSByICAgIEQgYSB0IGFcclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCggcGFyYW1zICl7XHJcblxyXG5cdC8vIEZpeEluOiA5LjguNi4yLlxyXG5cdHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0YXJ0KCBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKTtcclxuXHJcblx0Ly8gVHJpZ2dlciBldmVudCBmb3IgY2FsZW5kYXIgYmVmb3JlIGxvYWRpbmcgQm9va2luZyBkYXRhLCAgYnV0IGFmdGVyIHNob3dpbmcgQ2FsZW5kYXIuXHJcblx0aWYgKCBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyBwYXJhbXNbJ3Jlc291cmNlX2lkJ10gKS5sZW5ndGggPiAwICl7XHJcblx0XHR2YXIgdGFyZ2V0X2VsbSA9IGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggXCJ3cGJjX2NhbGVuZGFyX2FqeF9fYmVmb3JlX2xvYWRlZF9kYXRhXCIsIFtwYXJhbXNbJ3Jlc291cmNlX2lkJ11dICk7XHJcblx0XHQgLy9qUXVlcnkoICdib2R5JyApLm9uKCAnd3BiY19jYWxlbmRhcl9hanhfX2JlZm9yZV9sb2FkZWRfZGF0YScsIGZ1bmN0aW9uKCBldmVudCwgcmVzb3VyY2VfaWQgKSB7IC4uLiB9ICk7XHJcblx0fVxyXG5cclxuXHRpZiAoIHdwYmNfYmFsYW5jZXJfX2lzX3dhaXQoIHBhcmFtcyAsICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCcgKSApe1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0Ly8gRml4SW46IDkuOC42LjIuXHJcblx0d3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7XHJcblxyXG5cclxuLy8gY29uc29sZS5ncm91cEVuZCgpOyBjb25zb2xlLnRpbWUoJ3Jlc291cmNlX2lkXycgKyBwYXJhbXNbJ3Jlc291cmNlX2lkJ10pO1xyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfQ0FMRU5EQVJfTE9BRCcgKTsgY29uc29sZS5sb2coICcgPT0gQmVmb3JlIEFqYXggU2VuZCAtIGNhbGVuZGFyc19hbGxfX2dldCgpID09ICcgLCBfd3BiYy5jYWxlbmRhcnNfYWxsX19nZXQoKSApO1xyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbm9uY2UnICksXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGUgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zIDogcGFyYW1zIFx0XHRcdFx0XHRcdC8vIFVzdWFsbHkgbGlrZTogeyAncmVzb3VyY2VfaWQnOiAxLCAnbWF4X2RheXNfY291bnQnOiAzNjUgfVxyXG5cdFx0XHRcdH0sXHJcblxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNoLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuLy8gY29uc29sZS50aW1lRW5kKCdyZXNvdXJjZV9pZF8nICsgcmVzcG9uc2VfZGF0YVsncmVzb3VyY2VfaWQnXSk7XHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0NBTEVOREFSX0xPQUQgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gRml4SW46IDkuOC42LjIuXHJcblx0XHRcdFx0XHR2YXIgYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHR3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQoIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkICwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIFByb2JhYmx5IEVycm9yXHJcblx0XHRcdFx0XHRpZiAoICh0eXBlb2YgcmVzcG9uc2VfZGF0YSAhPT0gJ29iamVjdCcpIHx8IChyZXNwb25zZV9kYXRhID09PSBudWxsKSApe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHRcdHZhciBtZXNzYWdlX3R5cGUgPSAnaW5mbyc7XHJcblxyXG5cdFx0XHRcdFx0XHRpZiAoICcnID09PSByZXNwb25zZV9kYXRhICl7XHJcblx0XHRcdFx0XHRcdFx0cmVzcG9uc2VfZGF0YSA9ICdUaGUgc2VydmVyIHJlc3BvbmRzIHdpdGggYW4gZW1wdHkgc3RyaW5nLiBUaGUgc2VydmVyIHByb2JhYmx5IHN0b3BwZWQgd29ya2luZyB1bmV4cGVjdGVkbHkuIDxicj5QbGVhc2UgY2hlY2sgeW91ciA8c3Ryb25nPmVycm9yLmxvZzwvc3Ryb25nPiBpbiB5b3VyIHNlcnZlciBjb25maWd1cmF0aW9uIGZvciByZWxhdGl2ZSBlcnJvcnMuJztcclxuXHRcdFx0XHRcdFx0XHRtZXNzYWdlX3R5cGUgPSAnd2FybmluZyc7XHJcblx0XHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhICwgeyAndHlwZScgICAgIDogbWVzc2FnZV90eXBlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHRyZXR1cm47XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gU2hvdyBDYWxlbmRhclxyXG5cdFx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RvcCggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdFx0Ly8gQm9va2luZ3MgLSBEYXRlc1xyXG5cdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWydkYXRlcyddICApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEJvb2tpbmdzIC0gQ2hpbGQgb3Igb25seSBzaW5nbGUgYm9va2luZyByZXNvdXJjZSBpbiBkYXRlc1xyXG5cdFx0XHRcdFx0X3dwYmMuYm9va2luZ19fc2V0X3BhcmFtX3ZhbHVlKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ3Jlc291cmNlc19pZF9hcnJfX2luX2RhdGVzJyBdICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gQWdncmVnYXRlIGJvb2tpbmcgcmVzb3VyY2VzLCAgaWYgYW55ID9cclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAnYWdncmVnYXRlX3Jlc291cmNlX2lkX2FycicsIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInIF0gKTtcclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0XHRcdFx0XHQvLyBVcGRhdGUgY2FsZW5kYXJcclxuXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0gKTtcclxuXHJcblxyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHRcdCggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAocmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdKSApXHJcblx0XHRcdFx0XHRcdCAmJiAoICcnICE9IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSApXHJcblx0XHRcdFx0XHQpe1xyXG5cclxuXHRcdFx0XHRcdFx0dmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlJyBdLnJlcGxhY2UoIC9cXG4vZywgXCI8YnIgLz5cIiApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyAgICd0eXBlJyAgICAgOiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gKSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdIDogJ2luZm8nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMTAwMDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHQvLyBUcmlnZ2VyIGV2ZW50IHRoYXQgY2FsZW5kYXIgaGFzIGJlZW5cdFx0IC8vIEZpeEluOiAxMC4wLjAuNDQuXHJcblx0XHRcdFx0XHRpZiAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0XHRcdFx0dmFyIHRhcmdldF9lbG0gPSBqUXVlcnkoICdib2R5JyApLnRyaWdnZXIoIFwid3BiY19jYWxlbmRhcl9hanhfX2xvYWRlZF9kYXRhXCIsIFtyZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF1dICk7XHJcblx0XHRcdFx0XHRcdCAvL2pRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiggZXZlbnQsIHJlc291cmNlX2lkICkgeyAuLi4gfSApO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8valF1ZXJ5KCAnI2FqYXhfcmVzcG9uZCcgKS5odG1sKCByZXNwb25zZV9kYXRhICk7XHRcdC8vIEZvciBhYmlsaXR5IHRvIHNob3cgcmVzcG9uc2UsIGFkZCBzdWNoIERJViBlbGVtZW50IHRvIHBhZ2VcclxuXHRcdFx0XHR9XHJcblx0XHRcdCAgKS5mYWlsKCBmdW5jdGlvbiAoIGpxWEhSLCB0ZXh0U3RhdHVzLCBlcnJvclRocm93biApIHsgICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdBamF4X0Vycm9yJywganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICk7IH1cclxuXHJcblx0XHRcdFx0XHR2YXIgYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggdGhpcy5kYXRhICk7XHJcblx0XHRcdFx0XHR3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQoIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkICwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdldCBDb250ZW50IG9mIEVycm9yIE1lc3NhZ2VcclxuXHRcdFx0XHRcdHZhciBlcnJvcl9tZXNzYWdlID0gJzxzdHJvbmc+JyArICdFcnJvciEnICsgJzwvc3Ryb25nPiAnICsgZXJyb3JUaHJvd24gO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnICg8Yj4nICsganFYSFIuc3RhdHVzICsgJzwvYj4pJztcclxuXHRcdFx0XHRcdFx0aWYgKDQwMyA9PSBqcVhIUi5zdGF0dXMgKXtcclxuXHRcdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICc8YnI+IFByb2JhYmx5IG5vbmNlIGZvciB0aGlzIHBhZ2UgaGFzIGJlZW4gZXhwaXJlZC4gUGxlYXNlIDxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDpsb2NhdGlvbi5yZWxvYWQoKTtcIj5yZWxvYWQgdGhlIHBhZ2U8L2E+Lic7XHJcblx0XHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnPGJyPiBPdGhlcndpc2UsIHBsZWFzZSBjaGVjayB0aGlzIDxhIHN0eWxlPVwiZm9udC13ZWlnaHQ6IDYwMDtcIiBocmVmPVwiaHR0cHM6Ly93cGJvb2tpbmdjYWxlbmRhci5jb20vZmFxL3JlcXVlc3QtZG8tbm90LXBhc3Mtc2VjdXJpdHktY2hlY2svP2FmdGVyX3VwZGF0ZT0xMC4xLjFcIj50cm91Ymxlc2hvb3RpbmcgaW5zdHJ1Y3Rpb248L2E+Ljxicj4nXHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdHZhciBtZXNzYWdlX3Nob3dfZGVsYXkgPSAzMDAwO1xyXG5cdFx0XHRcdFx0aWYgKCBqcVhIUi5yZXNwb25zZVRleHQgKXtcclxuXHRcdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSArPSAnICcgKyBqcVhIUi5yZXNwb25zZVRleHQ7XHJcblx0XHRcdFx0XHRcdG1lc3NhZ2Vfc2hvd19kZWxheSA9IDEwO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0ZXJyb3JfbWVzc2FnZSA9IGVycm9yX21lc3NhZ2UucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICk7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblxyXG5cdFx0XHRcdFx0LyoqXHJcblx0XHRcdFx0XHQgKiBJZiB3ZSBtYWtlIGZhc3QgY2xpY2tpbmcgb24gZGlmZmVyZW50IHBhZ2VzLFxyXG5cdFx0XHRcdFx0ICogdGhlbiB1bmRlciBjYWxlbmRhciB3aWxsIHNob3cgZXJyb3IgbWVzc2FnZSB3aXRoICBlbXB0eSAgdGV4dCwgYmVjYXVzZSBhamF4IHdhcyBub3QgcmVjZWl2ZWQuXHJcblx0XHRcdFx0XHQgKiBUbyAgbm90IHNob3cgc3VjaCB3YXJuaW5ncyB3ZSBhcmUgc2V0IGRlbGF5ICBpbiAzIHNlY29uZHMuICB2YXIgbWVzc2FnZV9zaG93X2RlbGF5ID0gMzAwMDtcclxuXHRcdFx0XHRcdCAqL1xyXG5cdFx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBlcnJvcl9tZXNzYWdlICwgeyAndHlwZScgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJzogeydqcV9ub2RlJzoganFfbm9kZSwgJ3doZXJlJzogJ2FmdGVyJ30sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY3NzX2NsYXNzJzond3BiY19mZV9tZXNzYWdlX2FsdCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfSAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICBwYXJzZUludCggbWVzc2FnZV9zaG93X2RlbGF5ICkgICApO1xyXG5cclxuXHRcdFx0ICB9KVxyXG5cdCAgICAgICAgICAvLyAuZG9uZSggICBmdW5jdGlvbiAoIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnc2Vjb25kIHN1Y2Nlc3MnLCBkYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApOyB9ICAgIH0pXHJcblx0XHRcdCAgLy8gLmFsd2F5cyggZnVuY3Rpb24gKCBkYXRhX2pxWEhSLCB0ZXh0U3RhdHVzLCBqcVhIUl9lcnJvclRocm93biApIHsgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ2Fsd2F5cyBmaW5pc2hlZCcsIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICk7IH0gICAgIH0pXHJcblx0XHRcdCAgOyAgLy8gRW5kIEFqYXhcclxufVxyXG5cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gU3VwcG9ydFxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IENhbGVuZGFyIGpRdWVyeSBub2RlIGZvciBzaG93aW5nIG1lc3NhZ2VzIGR1cmluZyBBamF4XHJcblx0ICogVGhpcyBwYXJhbWV0ZXI6ICAgY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdICAgcGFyc2VkIGZyb20gdGhpcy5kYXRhIEFqYXggcG9zdCAgZGF0YVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtc1x0XHQgJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cdCcnI2NhbGVuZGFyX2Jvb2tpbmcxJyAgfCAgICcuYm9va2luZ19mb3JtX2RpdicgLi4uXHJcblx0ICpcclxuXHQgKiBFeGFtcGxlICAgIHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApe1xyXG5cclxuXHRcdHZhciBqcV9ub2RlID0gJy5ib29raW5nX2Zvcm1fZGl2JztcclxuXHJcblx0XHR2YXIgY2FsZW5kYXJfcmVzb3VyY2VfaWQgPSB3cGJjX2dldF9yZXNvdXJjZV9pZF9fZnJvbV9hanhfcG9zdF9kYXRhX3VybCggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICk7XHJcblxyXG5cdFx0aWYgKCBjYWxlbmRhcl9yZXNvdXJjZV9pZCA+IDAgKXtcclxuXHRcdFx0anFfbm9kZSA9ICcjY2FsZW5kYXJfYm9va2luZycgKyBjYWxlbmRhcl9yZXNvdXJjZV9pZDtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4ganFfbm9kZTtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgcmVzb3VyY2UgSUQgZnJvbSBhanggcG9zdCBkYXRhIHVybCAgIHVzdWFsbHkgIGZyb20gIHRoaXMuZGF0YSAgPSAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXNcdFx0ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdCAqIEByZXR1cm5zIHtpbnR9XHRcdFx0XHRcdFx0IDEgfCAwICAoaWYgZXJycm9yIHRoZW4gIDApXHJcblx0ICpcclxuXHQgKiBFeGFtcGxlICAgIHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKXtcclxuXHJcblx0XHQvLyBHZXQgYm9va2luZyByZXNvdXJjZSBJRCBmcm9tIEFqYXggUG9zdCBSZXF1ZXN0ICAtPiB0aGlzLmRhdGEgPSAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHRcdHZhciBjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3VyaV9wYXJhbV9ieV9uYW1lKCAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJywgYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICk7XHJcblx0XHRpZiAoIChudWxsICE9PSBjYWxlbmRhcl9yZXNvdXJjZV9pZCkgJiYgKCcnICE9PSBjYWxlbmRhcl9yZXNvdXJjZV9pZCkgKXtcclxuXHRcdFx0Y2FsZW5kYXJfcmVzb3VyY2VfaWQgPSBwYXJzZUludCggY2FsZW5kYXJfcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0aWYgKCBjYWxlbmRhcl9yZXNvdXJjZV9pZCA+IDAgKXtcclxuXHRcdFx0XHRyZXR1cm4gY2FsZW5kYXJfcmVzb3VyY2VfaWQ7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHRcdHJldHVybiAwO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBwYXJhbWV0ZXIgZnJvbSBVUkwgIC0gIHBhcnNlIFVSTCBwYXJhbWV0ZXJzLCAgbGlrZSB0aGlzOiBhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zXHJcblx0ICogQHBhcmFtIG5hbWUgIHBhcmFtZXRlciAgbmFtZSwgIGxpa2UgJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXSdcclxuXHQgKiBAcGFyYW0gdXJsXHQncGFyYW1ldGVyICBzdHJpbmcgVVJMJ1xyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd8bnVsbH0gICBwYXJhbWV0ZXIgdmFsdWVcclxuXHQgKlxyXG5cdCAqIEV4YW1wbGU6IFx0XHR3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggJ2NhbGVuZGFyX3JlcXVlc3RfcGFyYW1zW3Jlc291cmNlX2lkXScsIHRoaXMuZGF0YSApOyAgLT4gJzInXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfdXJpX3BhcmFtX2J5X25hbWUoIG5hbWUsIHVybCApe1xyXG5cclxuXHRcdHVybCA9IGRlY29kZVVSSUNvbXBvbmVudCggdXJsICk7XHJcblxyXG5cdFx0bmFtZSA9IG5hbWUucmVwbGFjZSggL1tcXFtcXF1dL2csICdcXFxcJCYnICk7XHJcblx0XHR2YXIgcmVnZXggPSBuZXcgUmVnRXhwKCAnWz8mXScgKyBuYW1lICsgJyg9KFteJiNdKil8JnwjfCQpJyApLFxyXG5cdFx0XHRyZXN1bHRzID0gcmVnZXguZXhlYyggdXJsICk7XHJcblx0XHRpZiAoICFyZXN1bHRzICkgcmV0dXJuIG51bGw7XHJcblx0XHRpZiAoICFyZXN1bHRzWyAyIF0gKSByZXR1cm4gJyc7XHJcblx0XHRyZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KCByZXN1bHRzWyAyIF0ucmVwbGFjZSggL1xcKy9nLCAnICcgKSApO1xyXG5cdH1cclxuIiwiLyoqXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9mcm9udF9lbmRfbWVzc2FnZXMvd3BiY19mZV9tZXNzYWdlcy5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICovXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLy8gU2hvdyBNZXNzYWdlcyBhdCBGcm9udC1FZG4gc2lkZVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTaG93IG1lc3NhZ2UgaW4gY29udGVudFxyXG4gKlxyXG4gKiBAcGFyYW0gbWVzc2FnZVx0XHRcdFx0TWVzc2FnZSBIVE1MXHJcbiAqIEBwYXJhbSBwYXJhbXMgPSB7XHJcbiAqXHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgOiAnd2FybmluZycsXHRcdFx0XHRcdFx0XHQvLyAnZXJyb3InIHwgJ3dhcm5pbmcnIHwgJ2luZm8nIHwgJ3N1Y2Nlc3MnXHJcbiAqXHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnIDoge1xyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnIDogJycsXHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgIDogJ2luc2lkZSdcdFx0Ly8gJ2luc2lkZScgfCAnYmVmb3JlJyB8ICdhZnRlcicgfCAncmlnaHQnIHwgJ2xlZnQnXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfSxcclxuICpcdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIEFwcGx5ICBvbmx5IGlmIFx0J3doZXJlJyAgIDogJ2luc2lkZSdcclxuICpcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcdFx0XHRcdC8vIHN0eWxlcywgaWYgbmVlZGVkXHJcbiAqXHRcdFx0XHRcdFx0XHQgICAgJ2Nzc19jbGFzcyc6ICcnLFx0XHRcdFx0XHRcdFx0XHQvLyBGb3IgZXhhbXBsZSBjYW4gIGJlOiAnd3BiY19mZV9tZXNzYWdlX2FsdCdcclxuICpcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHRcdFx0XHRcdFx0XHRcdFx0Ly8gaG93IG1hbnkgbWljcm9zZWNvbmQgdG8gIHNob3csICBpZiAwICB0aGVuICBzaG93IGZvcmV2ZXJcclxuICpcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiBmYWxzZVx0XHRcdFx0XHQvLyBpZiB0cnVlLCAgdGhlbiBkbyBub3Qgc2hvdyBtZXNzYWdlLCAgaWYgcHJldmlvcyBtZXNzYWdlIHdhcyBub3QgaGlkZWQgKG5vdCBhcHBseSBpZiAnd2hlcmUnICAgOiAnaW5zaWRlJyApXHJcbiAqXHRcdFx0XHR9O1xyXG4gKiBFeGFtcGxlczpcclxuICogXHRcdFx0dmFyIGh0bWxfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCAnWW91IGNhbiB0ZXN0IGRheXMgc2VsZWN0aW9uIGluIGNhbGVuZGFyJywge30gKTtcclxuICpcclxuICpcdFx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBfd3BiYy5nZXRfbWVzc2FnZSggJ21lc3NhZ2VfY2hlY2tfcmVxdWlyZWQnICksIHsgJ3R5cGUnOiAnd2FybmluZycsICdkZWxheSc6IDEwMDAwLCAnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICdzaG93X2hlcmUnOiB7J3doZXJlJzogJ3JpZ2h0JywgJ2pxX25vZGUnOiBlbCx9IH0gKTtcclxuICpcclxuICpcdFx0XHR3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICksXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHsgICAndHlwZScgICAgIDogKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdICkgKVxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdIDogJ2luZm8nLFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnY3NzX2NsYXNzJzond3BiY19mZV9tZXNzYWdlX2FsdCcsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDEwMDAwXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuICpcclxuICpcclxuICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggbWVzc2FnZSwgcGFyYW1zID0ge30gKXtcclxuXHJcblx0dmFyIHBhcmFtc19kZWZhdWx0ID0ge1xyXG5cdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICd3YXJuaW5nJyxcdFx0XHRcdFx0XHRcdC8vICdlcnJvcicgfCAnd2FybmluZycgfCAnaW5mbycgfCAnc3VjY2VzcydcclxuXHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJyA6ICcnLFx0XHRcdFx0Ly8gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICAgOiAnaW5zaWRlJ1x0XHQvLyAnaW5zaWRlJyB8ICdiZWZvcmUnIHwgJ2FmdGVyJyB8ICdyaWdodCcgfCAnbGVmdCdcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRcdFx0XHRcdCdpc19hcHBlbmQnOiB0cnVlLFx0XHRcdFx0XHRcdFx0XHQvLyBBcHBseSAgb25seSBpZiBcdCd3aGVyZScgICA6ICdpbnNpZGUnXHJcblx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFx0XHRcdFx0Ly8gc3R5bGVzLCBpZiBuZWVkZWRcclxuXHRcdFx0XHRcdFx0XHQgICAgJ2Nzc19jbGFzcyc6ICcnLFx0XHRcdFx0XHRcdFx0XHQvLyBGb3IgZXhhbXBsZSBjYW4gIGJlOiAnd3BiY19mZV9tZXNzYWdlX2FsdCdcclxuXHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgOiAwLFx0XHRcdFx0XHRcdFx0XHRcdC8vIGhvdyBtYW55IG1pY3Jvc2Vjb25kIHRvICBzaG93LCAgaWYgMCAgdGhlbiAgc2hvdyBmb3JldmVyXHJcblx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IGZhbHNlLFx0XHRcdFx0XHQvLyBpZiB0cnVlLCAgdGhlbiBkbyBub3Qgc2hvdyBtZXNzYWdlLCAgaWYgcHJldmlvcyBtZXNzYWdlIHdhcyBub3QgaGlkZWQgKG5vdCBhcHBseSBpZiAnd2hlcmUnICAgOiAnaW5zaWRlJyApXHJcblx0XHRcdFx0XHRcdFx0XHQnaXNfc2Nyb2xsJzogdHJ1ZVx0XHRcdFx0XHRcdFx0XHQvLyBpcyBzY3JvbGwgIHRvICB0aGlzIGVsZW1lbnRcclxuXHRcdFx0XHRcdFx0fTtcclxuXHRmb3IgKCB2YXIgcF9rZXkgaW4gcGFyYW1zICl7XHJcblx0XHRwYXJhbXNfZGVmYXVsdFsgcF9rZXkgXSA9IHBhcmFtc1sgcF9rZXkgXTtcclxuXHR9XHJcblx0cGFyYW1zID0gcGFyYW1zX2RlZmF1bHQ7XHJcblxyXG4gICAgdmFyIHVuaXF1ZV9kaXZfaWQgPSBuZXcgRGF0ZSgpO1xyXG4gICAgdW5pcXVlX2Rpdl9pZCA9ICd3cGJjX25vdGljZV8nICsgdW5pcXVlX2Rpdl9pZC5nZXRUaW1lKCk7XHJcblxyXG5cdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2UnO1xyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ2Vycm9yJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV9lcnJvcic7XHJcblx0XHRtZXNzYWdlID0gJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fcmVwb3J0X2dtYWlsZXJyb3JyZWRcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ3dhcm5pbmcnICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX3dhcm5pbmcnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX3dhcm5pbmdcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ2luZm8nICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX2luZm8nO1xyXG5cdH1cclxuXHRpZiAoIHBhcmFtc1sndHlwZSddID09ICdzdWNjZXNzJyApe1xyXG5cdFx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZV9zdWNjZXNzJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9kb25lX291dGxpbmVcIj48L2k+JyArIG1lc3NhZ2U7XHJcblx0fVxyXG5cclxuXHR2YXIgc2Nyb2xsX3RvX2VsZW1lbnQgPSAnPGRpdiBpZD1cIicgKyB1bmlxdWVfZGl2X2lkICsgJ19zY3JvbGxcIiBzdHlsZT1cImRpc3BsYXk6bm9uZTtcIj48L2Rpdj4nO1xyXG5cdG1lc3NhZ2UgPSAnPGRpdiBpZD1cIicgKyB1bmlxdWVfZGl2X2lkICsgJ1wiIGNsYXNzPVwid3BiY19mcm9udF9lbmRfX21lc3NhZ2UgJyArIHBhcmFtc1snY3NzX2NsYXNzJ10gKyAnXCIgc3R5bGU9XCInICsgcGFyYW1zWyAnc3R5bGUnIF0gKyAnXCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JztcclxuXHJcblxyXG5cdHZhciBqcV9lbF9tZXNzYWdlID0gZmFsc2U7XHJcblx0dmFyIGlzX3Nob3dfbWVzc2FnZSA9IHRydWU7XHJcblxyXG5cdGlmICggJ2luc2lkZScgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0aWYgKCBwYXJhbXNbICdpc19hcHBlbmQnIF0gKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYXBwZW5kKCBzY3JvbGxfdG9fZWxlbWVudCApO1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hcHBlbmQoIG1lc3NhZ2UgKTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmh0bWwoIHNjcm9sbF90b19lbGVtZW50ICsgbWVzc2FnZSApO1xyXG5cdFx0fVxyXG5cclxuXHR9IGVsc2UgaWYgKCAnYmVmb3JlJyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuc2libGluZ3MoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggbWVzc2FnZSApO1xyXG5cdFx0fVxyXG5cclxuXHR9IGVsc2UgaWYgKCAnYWZ0ZXInID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5uZXh0QWxsKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1x0XHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYmVmb3JlKGZvciBoYW5keSBzY3JvbGwpXHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFmdGVyKCBtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdH0gZWxzZSBpZiAoICdyaWdodCcgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLm5leHRBbGwoICcud3BiY19mcm9udF9lbmRfX21lc3NhZ2VfY29udGFpbmVyX3JpZ2h0JyApLmZpbmQoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHRcdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBiZWZvcmUoZm9yIGhhbmR5IHNjcm9sbClcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYWZ0ZXIoICc8ZGl2IGNsYXNzPVwid3BiY19mcm9udF9lbmRfX21lc3NhZ2VfY29udGFpbmVyX3JpZ2h0XCI+JyArIG1lc3NhZ2UgKyAnPC9kaXY+JyApO1xyXG5cdFx0fVxyXG5cdH0gZWxzZSBpZiAoICdsZWZ0JyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuc2libGluZ3MoICcud3BiY19mcm9udF9lbmRfX21lc3NhZ2VfY29udGFpbmVyX2xlZnQnICkuZmluZCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcdFx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGJlZm9yZShmb3IgaGFuZHkgc2Nyb2xsKVxyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoICc8ZGl2IGNsYXNzPVwid3BiY19mcm9udF9lbmRfX21lc3NhZ2VfY29udGFpbmVyX2xlZnRcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoICAgKCBpc19zaG93X21lc3NhZ2UgKSAgJiYgICggcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdICkgPiAwICkgICApe1xyXG5cdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLmZhZGVPdXQoIDE1MDAgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICwgcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdICkgICApO1xyXG5cclxuXHRcdHZhciBjbG9zZWRfdGltZXIyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRqUXVlcnkoICcjJyArIHVuaXF1ZV9kaXZfaWQgKS50cmlnZ2VyKCAnaGlkZScgKTtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LCAoIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApICsgMTUwMSApICk7XHJcblx0fVxyXG5cclxuXHQvLyBDaGVjayAgaWYgc2hvd2VkIG1lc3NhZ2UgaW4gc29tZSBoaWRkZW4gcGFyZW50IHNlY3Rpb24gYW5kIHNob3cgaXQuIEJ1dCBpdCBtdXN0ICBiZSBsb3dlciB0aGFuICcud3BiY19jb250YWluZXInXHJcblx0dmFyIHBhcmVudF9lbHMgPSBqUXVlcnkoICcjJyArIHVuaXF1ZV9kaXZfaWQgKS5wYXJlbnRzKCkubWFwKCBmdW5jdGlvbiAoKXtcclxuXHRcdGlmICggKCFqUXVlcnkoIHRoaXMgKS5pcyggJ3Zpc2libGUnICkpICYmIChqUXVlcnkoICcud3BiY19jb250YWluZXInICkuaGFzKCB0aGlzICkpICl7XHJcblx0XHRcdGpRdWVyeSggdGhpcyApLnNob3coKTtcclxuXHRcdH1cclxuXHR9ICk7XHJcblxyXG5cdGlmICggcGFyYW1zWyAnaXNfc2Nyb2xsJyBdICl7XHJcblx0XHR3cGJjX2RvX3Njcm9sbCggJyMnICsgdW5pcXVlX2Rpdl9pZCArICdfc2Nyb2xsJyApO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIHVuaXF1ZV9kaXZfaWQ7XHJcbn1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVycm9yIG1lc3NhZ2UuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yKCBqcV9ub2RlLCBtZXNzYWdlICl7XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ3JpZ2h0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVycm9yIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3JfdW5kZXJfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgbWVzc2FnZV9kZWxheSApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAobWVzc2FnZV9kZWxheSkgKXtcclxuXHRcdFx0bWVzc2FnZV9kZWxheSA9IDBcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiBtZXNzYWdlX2RlbGF5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBFcnJvciBtZXNzYWdlIFVOREVSIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX2Vycm9yX2Fib3ZlX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UsIG1lc3NhZ2VfZGVsYXkgKXtcclxuXHJcblx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKG1lc3NhZ2VfZGVsYXkpICl7XHJcblx0XHRcdG1lc3NhZ2VfZGVsYXkgPSAxMDAwMFxyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IG1lc3NhZ2VfZGVsYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2JlZm9yZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmcoIGpxX25vZGUsIG1lc3NhZ2UgKXtcclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdyaWdodCcsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHdwYmNfaGlnaGxpZ2h0X2Vycm9yX29uX2Zvcm1fZmllbGQoIGpxX25vZGUgKTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZ191bmRlcl9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlICl7XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYWZ0ZXInLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogV2FybmluZyBtZXNzYWdlIEFCT1ZFIGVsZW1lbnQuIFx0UHJlc2V0IG9mIHBhcmFtZXRlcnMgZm9yIHJlYWwgbWVzc2FnZSBmdW5jdGlvbi5cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBlbFx0XHQtIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcblx0ICogQHBhcmFtIG1lc3NhZ2VcdC0gTWVzc2FnZSBIVE1MXHJcblx0ICogQHJldHVybnMgc3RyaW5nICAtIEhUTUwgSURcdFx0b3IgMCBpZiBub3Qgc2hvd2luZyBkdXJpbmcgdGhpcyB0aW1lLlxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2VfX3dhcm5pbmdfYWJvdmVfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSApe1xyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2JlZm9yZScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEhpZ2hsaWdodCBFcnJvciBpbiBzcGVjaWZpYyBmaWVsZFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGpxX25vZGVcdFx0XHRcdFx0c3RyaW5nIG9yIGpRdWVyeSBlbGVtZW50LCAgd2hlcmUgc2Nyb2xsICB0b1xyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaGlnaGxpZ2h0X2Vycm9yX29uX2Zvcm1fZmllbGQoIGpxX25vZGUgKXtcclxuXHJcblx0XHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5sZW5ndGggKXtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIGpRdWVyeSgganFfbm9kZSApLmlzKCAnOmlucHV0JyApICl7XHJcblx0XHRcdC8vIFNpdHVhdGlvbiB3aXRoICBjaGVja2JveGVzIG9yIHJhZGlvICBidXR0b25zXHJcblx0XHRcdHZhciBqcV9ub2RlX2FyciA9IGpRdWVyeSgganFfbm9kZSApLmZpbmQoICc6aW5wdXQnICk7XHJcblx0XHRcdGlmICggIWpxX25vZGVfYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVyblxyXG5cdFx0XHR9XHJcblx0XHRcdGpxX25vZGUgPSBqcV9ub2RlX2Fyci5nZXQoIDAgKTtcclxuXHRcdH1cclxuXHRcdHZhciBwYXJhbXMgPSB7fTtcclxuXHRcdHBhcmFtc1sgJ2RlbGF5JyBdID0gMTAwMDA7XHJcblxyXG5cdFx0aWYgKCAhalF1ZXJ5KCBqcV9ub2RlICkuaGFzQ2xhc3MoICd3cGJjX2Zvcm1fZmllbGRfZXJyb3InICkgKXtcclxuXHJcblx0XHRcdGpRdWVyeSgganFfbm9kZSApLmFkZENsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApXHJcblxyXG5cdFx0XHRpZiAoIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApID4gMCApe1xyXG5cdFx0XHRcdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGpRdWVyeSgganFfbm9kZSApLnJlbW92ZUNsYXNzKCAnd3BiY19mb3JtX2ZpZWxkX2Vycm9yJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICAsIHBhcnNlSW50KCBwYXJhbXNbICdkZWxheScgXSApXHJcblx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG5cclxuLyoqXHJcbiAqIFNjcm9sbCB0byBzcGVjaWZpYyBlbGVtZW50XHJcbiAqXHJcbiAqIEBwYXJhbSBqcV9ub2RlXHRcdFx0XHRcdHN0cmluZyBvciBqUXVlcnkgZWxlbWVudCwgIHdoZXJlIHNjcm9sbCAgdG9cclxuICogQHBhcmFtIGV4dHJhX3NoaWZ0X29mZnNldFx0XHRpbnQgc2hpZnQgb2Zmc2V0IGZyb20gIGpxX25vZGVcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZG9fc2Nyb2xsKCBqcV9ub2RlICwgZXh0cmFfc2hpZnRfb2Zmc2V0ID0gMCApe1xyXG5cclxuXHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5sZW5ndGggKXtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblx0dmFyIHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLm9mZnNldCgpLnRvcDtcclxuXHJcblx0aWYgKCB0YXJnZXRPZmZzZXQgPD0gMCApe1xyXG5cdFx0aWYgKCAwICE9IGpRdWVyeSgganFfbm9kZSApLm5leHRBbGwoICc6dmlzaWJsZScgKS5sZW5ndGggKXtcclxuXHRcdFx0dGFyZ2V0T2Zmc2V0ID0galF1ZXJ5KCBqcV9ub2RlICkubmV4dEFsbCggJzp2aXNpYmxlJyApLmZpcnN0KCkub2Zmc2V0KCkudG9wO1xyXG5cdFx0fSBlbHNlIGlmICggMCAhPSBqUXVlcnkoIGpxX25vZGUgKS5wYXJlbnQoKS5uZXh0QWxsKCAnOnZpc2libGUnICkubGVuZ3RoICl7XHJcblx0XHRcdHRhcmdldE9mZnNldCA9IGpRdWVyeSgganFfbm9kZSApLnBhcmVudCgpLm5leHRBbGwoICc6dmlzaWJsZScgKS5maXJzdCgpLm9mZnNldCgpLnRvcDtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggalF1ZXJ5KCAnI3dwYWRtaW5iYXInICkubGVuZ3RoID4gMCApe1xyXG5cdFx0dGFyZ2V0T2Zmc2V0ID0gdGFyZ2V0T2Zmc2V0IC0gNTAgLSA1MDtcclxuXHR9IGVsc2Uge1xyXG5cdFx0dGFyZ2V0T2Zmc2V0ID0gdGFyZ2V0T2Zmc2V0IC0gMjAgLSA1MDtcclxuXHR9XHJcblx0dGFyZ2V0T2Zmc2V0ICs9IGV4dHJhX3NoaWZ0X29mZnNldDtcclxuXHJcblx0Ly8gU2Nyb2xsIG9ubHkgIGlmIHdlIGRpZCBub3Qgc2Nyb2xsIGJlZm9yZVxyXG5cdGlmICggISBqUXVlcnkoICdodG1sLGJvZHknICkuaXMoICc6YW5pbWF0ZWQnICkgKXtcclxuXHRcdGpRdWVyeSggJ2h0bWwsYm9keScgKS5hbmltYXRlKCB7c2Nyb2xsVG9wOiB0YXJnZXRPZmZzZXR9LCA1MDAgKTtcclxuXHR9XHJcbn1cclxuXHJcbiIsIlxyXG4vLyBGaXhJbjogMTAuMi4wLjQuXHJcbi8qKlxyXG4gKiBEZWZpbmUgUG9wb3ZlcnMgZm9yIFRpbWVsaW5lcyBpbiBXUCBCb29raW5nIENhbGVuZGFyXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd8Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX3RpcHB5X3BvcG92ZXIoKXtcclxuXHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdGNvbnNvbGUubG9nKCAnV1BCQyBFcnJvci4gd3BiY190aXBweSB3YXMgbm90IGRlZmluZWQuJyApO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHR3cGJjX3RpcHB5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snLCB7XHJcblx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHRcdFx0dmFyIHBvcG92ZXJfdGl0bGUgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKTtcclxuXHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cInBvcG92ZXIgcG9wb3Zlcl90aXBweVwiPidcclxuXHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jbG9zZVwiPjxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDp0aGlzLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5fdGlwcHkuaGlkZSgpO1wiID4mdGltZXM7PC9hPjwvZGl2PidcclxuXHRcdFx0XHQrIHBvcG92ZXJfY29udGVudFxyXG5cdFx0XHRcdCsgJzwvZGl2Pic7XHJcblx0XHR9LFxyXG5cdFx0YWxsb3dIVE1MICAgICAgICA6IHRydWUsXHJcblx0XHR0cmlnZ2VyICAgICAgICAgIDogJ21hbnVhbCcsXHJcblx0XHRpbnRlcmFjdGl2ZSAgICAgIDogdHJ1ZSxcclxuXHRcdGhpZGVPbkNsaWNrICAgICAgOiBmYWxzZSxcclxuXHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktcG9wb3ZlcicsXHJcblx0XHRwbGFjZW1lbnQgICAgICAgIDogJ2JvdHRvbS1zdGFydCcsXHJcblx0XHR0b3VjaCAgICAgICAgICAgIDogWydob2xkJywgNTAwXSxcclxuXHR9ICk7XHJcblx0alF1ZXJ5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snICkub24oICdjbGljaycsIGZ1bmN0aW9uICgpe1xyXG5cdFx0aWYgKCB0aGlzLl90aXBweS5zdGF0ZS5pc1Zpc2libGUgKXtcclxuXHRcdFx0dGhpcy5fdGlwcHkuaGlkZSgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5fdGlwcHkuc2hvdygpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHR3cGJjX2RlZmluZV9oaWRlX3RpcHB5X29uX3Njcm9sbCgpO1xyXG59XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX2hpZGVfdGlwcHlfb25fc2Nyb2xsKCl7XHJcblx0alF1ZXJ5KCAnLmZsZXhfdGxfX3Njcm9sbGluZ19zZWN0aW9uMiwuZmxleF90bF9fc2Nyb2xsaW5nX3NlY3Rpb25zJyApLm9uKCAnc2Nyb2xsJywgZnVuY3Rpb24gKCBldmVudCApe1xyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfdGlwcHkpICl7XHJcblx0XHRcdHdwYmNf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LGlCQUFBO0lBQ0FGLHFCQUFBLENBQUFyRyxJQUFBO0lBQ0FxRyxxQkFBQSxDQUFBckcsSUFBQSx5QkFBQXBCLFFBQUEsQ0FBQXdILGlCQUFBLG1CQUFBQSxpQkFBQTtFQUNBO0lBQ0FHLGlCQUFBO0lBQ0FGLHFCQUFBLENBQUFyRyxJQUFBO0VBQ0E7RUFHQSxRQUFBb0csaUJBQUE7SUFFQTtNQUNBO0lBRUE7TUFDQUMscUJBQUEsQ0FBQXJHLElBQUE7TUFDQTtJQUVBO01BQ0FxRyxxQkFBQSxDQUFBckcsSUFBQTtNQUNBO0lBRUE7TUFDQXFHLHFCQUFBLENBQUFyRyxJQUFBO01BQ0FvRyxpQkFBQTtNQUNBO0lBRUE7TUFDQUMscUJBQUEsQ0FBQXJHLElBQUE7TUFDQW9HLGlCQUFBO01BQ0E7SUFFQTtNQUNBQyxxQkFBQSxDQUFBckcsSUFBQTtNQUNBb0csaUJBQUE7TUFDQTtJQUVBO01BQ0FDLHFCQUFBLENBQUFyRyxJQUFBO01BQ0FvRyxpQkFBQTtNQUNBO0lBRUE7TUFDQUMscUJBQUEsQ0FBQXJHLElBQUE7TUFDQW9HLGlCQUFBO01BQ0E7SUFFQTtNQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztNQUVBQyxxQkFBQSxDQUFBckcsSUFBQTtNQUNBO01BQ0EsSUFBQW9HLGlCQUFBLG1DQUFBbkQsT0FBQTtRQUNBb0QscUJBQUEsQ0FBQXJHLElBQUE7TUFDQTtNQUNBLElBQUFvRyxpQkFBQSxtQ0FBQW5ELE9BQUE7UUFDQW9ELHFCQUFBLENBQUFyRyxJQUFBO01BQ0E7TUFDQTtJQUVBO01BQ0FxRyxxQkFBQSxDQUFBckcsSUFBQTs7TUFFQTtNQUNBLElBQUFvRyxpQkFBQSxtQ0FBQW5ELE9BQUE7UUFDQW9ELHFCQUFBLENBQUFyRyxJQUFBO01BQ0EsV0FBQW9HLGlCQUFBLG1DQUFBbkQsT0FBQTtRQUNBb0QscUJBQUEsQ0FBQXJHLElBQUE7TUFDQTtNQUNBO0lBRUE7TUFDQXFHLHFCQUFBLENBQUFyRyxJQUFBOztNQUVBO01BQ0EsSUFBQW9HLGlCQUFBLG1DQUFBbkQsT0FBQTtRQUNB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QUFBO01BQ0E2ZixZQUFBLEdBQUF0YixNQUFBLENBQUFvWSxPQUFBLEVBQUErQixPQUFBLGFBQUFzQixLQUFBLEdBQUFGLE1BQUEsR0FBQUMsR0FBQTtJQUNBLGdCQUFBeGIsTUFBQSxDQUFBb1ksT0FBQSxFQUFBN04sTUFBQSxHQUFBNFAsT0FBQSxhQUFBMWUsTUFBQTtNQUNBNmYsWUFBQSxHQUFBdGIsTUFBQSxDQUFBb1ksT0FBQSxFQUFBN04sTUFBQSxHQUFBNFAsT0FBQSxhQUFBc0IsS0FBQSxHQUFBRixNQUFBLEdBQUFDLEdBQUE7SUFDQTtFQUNBO0VBRUEsSUFBQXhiLE1BQUEsZ0JBQUF2RSxNQUFBO0lBQ0E2ZixZQUFBLEdBQUFBLFlBQUE7RUFDQTtJQUNBQSxZQUFBLEdBQUFBLFlBQUE7RUFDQTtFQUNBQSxZQUFBLElBQUFELGtCQUFBOztFQUVBO0VBQ0EsS0FBQXJiLE1BQUEsY0FBQWlhLEVBQUE7SUFDQWphLE1BQUEsY0FBQTBiLE9BQUE7TUFBQUMsU0FBQSxFQUFBTDtJQUFBO0VBQ0E7QUFDQTs7QUM3WUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQU0sMEJBQUE7RUFDQSwwQkFBQWhMLFVBQUE7SUFDQWdDLE9BQUEsQ0FBQUMsR0FBQTtJQUNBO0VBQ0E7RUFDQWpDLFVBQUE7SUFDQUMsT0FBQSxXQUFBQSxRQUFBQyxTQUFBO01BQ0EsSUFBQStLLGFBQUEsR0FBQS9LLFNBQUEsQ0FBQUUsWUFBQTtNQUNBLElBQUFELGVBQUEsR0FBQUQsU0FBQSxDQUFBRSxZQUFBO01BQ0EsK0NBQ0EsOExBQ0FELGVBQUEsR0FDQTtJQUNBO0lBQ0FFLFNBQUE7SUFDQWpLLE9BQUE7SUFDQWtLLFdBQUE7SUFDQUMsV0FBQTtJQUNBQyxpQkFBQTtJQUNBQyxRQUFBO0lBQ0FDLEtBQUE7SUFDQUMsU0FBQTtJQUNBRyxLQUFBO0VBQ0E7RUFDQTFSLE1BQUEsa0NBQUFtSCxFQUFBO0lBQ0EsU0FBQXdKLE1BQUEsQ0FBQW1MLEtBQUEsQ0FBQUMsU0FBQTtNQUNBLEtBQUFwTCxNQUFBLENBQUFxTCxJQUFBO0lBQ0E7TUFDQSxLQUFBckwsTUFBQSxDQUFBOEosSUFBQTtJQUNBO0VBQ0E7RUFDQXdCLGdDQUFBO0FBQ0E7QUFJQSxTQUFBQSxpQ0FBQTtFQUNBamMsTUFBQSw4REFBQW1ILEVBQUEscUJBQUFDLEtBQUE7SUFDQSwwQkFBQXdKLFVBQUE7TUFDQUEsVUFBQSxDQUFBc0wsT0FBQTtJQUNBO0VBQ0E7QUFDQSIsImlnbm9yZUxpc3QiOltdfQ==

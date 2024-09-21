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
    //FixIn: 9.9.0.29

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
      //FixIn: 9.9.0.29
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
 * Extend _wpbc with  new methods        //FixIn: 9.8.6.2
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
      //FixIn: 9.8.10.1
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
      //FixIn: 9.8.10.1
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
      //FixIn: 9.8.10.1
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
      //FixIn: 9.8.10.1
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
      //FixIn: 9.8.10.1
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
  local__min_date = new Date(_wpbc.get_other_param('today_arr')[0], parseInt(_wpbc.get_other_param('today_arr')[1]) - 1, _wpbc.get_other_param('today_arr')[2], 0, 0, 0); //FixIn: 9.9.0.17
  //console.log( local__min_date );
  var local__max_date = _wpbc.calendar__get_param_value(resource_id, 'booking_max_monthes_in_calendar');
  //local__max_date = new Date(2024, 5, 28);  It is here issue of not selectable dates, but some dates showing in calendar as available, but we can not select it.

  //// Define last day in calendar (as a last day of month (and not date, which is related to actual 'Today' date).
  //// E.g. if today is 2023-09-25, and we set 'Number of months to scroll' as 5 months, then last day will be 2024-02-29 and not the 2024-02-25.
  // var cal_last_day_in_month = jQuery.datepick._determineDate( null, local__max_date, new Date() );
  // cal_last_day_in_month = new Date( cal_last_day_in_month.getFullYear(), cal_last_day_in_month.getMonth() + 1, 0 );
  // local__max_date = cal_last_day_in_month;			//FixIn: 10.0.0.26

  if (location.href.indexOf('page=wpbc-new') != -1 && location.href.indexOf('booking_hash') != -1 // Comment this line for ability to add  booking in past days at  Booking > Add booking page.
  ) {
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
  }, 500); //FixIn: 7.1.2.8

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
      //FixIn: 10.0.0.2
      if (date_bookings_obj['summary']['status_for_bookings'].indexOf('approved_pending') > -1) {
        css_classes__for_date.push('check_out_time_date_approved', 'check_in_time_date2approve');
      }
      if (date_bookings_obj['summary']['status_for_bookings'].indexOf('pending_approved') > -1) {
        css_classes__for_date.push('check_out_time_date2approve', 'check_in_time_date_approved');
      }
      break;
    case 'check_in':
      css_classes__for_date.push('timespartly', 'check_in_time');

      //FixIn: 9.9.0.33
      if (date_bookings_obj['summary']['status_for_bookings'].indexOf('pending') > -1) {
        css_classes__for_date.push('check_in_time_date2approve');
      } else if (date_bookings_obj['summary']['status_for_bookings'].indexOf('approved') > -1) {
        css_classes__for_date.push('check_in_time_date_approved');
      }
      break;
    case 'check_out':
      css_classes__for_date.push('timespartly', 'check_out_time');

      //FixIn: 9.9.0.33
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
    var is_set_pending_days_selectable = _wpbc.calendar__get_param_value(resource_id, 'pending_days_selectable'); // set pending days selectable          //FixIn: 8.6.1.18

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
  var is_unselectable_calendar = jQuery('#calendar_booking_unselectable' + resource_id).length > 0; //FixIn: 8.0.1.2
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
  var is_unselectable_calendar = jQuery('#calendar_booking_unselectable' + resource_id).length > 0; //FixIn: 8.0.1.2
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

// Mark middle selected dates with 0.5 opacity		//FixIn: 10.3.0.9
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

  // 4. Loop  all  time Fields options		//FixIn: 10.3.0.2
  for (var field_key = 0; field_key < time_fields_obj_arr.length; field_key++) {
    time_fields_obj_arr[field_key].disabled = 0; // By default, this time field is not disabled

    time_fields_obj = time_fields_obj_arr[field_key]; // { times_as_seconds: [ 21600, 23400 ], value_option_24h: '06:00 - 06:30', name: 'rangetime2[]', jquery_option: jQuery_Object {}}

    // Loop  all  selected dates
    for (var i = 0; i < selected_dates_arr.length; i++) {
      //FixIn: 9.9.0.31
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

      // Get Date: '2023-08-18'
      sql_date = selected_dates_arr[i];
      var how_many_resources_intersected = 0;
      // Loop all resources ID
      // for ( var res_key in child_resources_arr ){	 						//FixIn: 10.3.0.2
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
  jQuery(".booking_form_div").trigger('wpbc_hook_timeslots_disabled', [resource_id, selected_dates_arr]); // Trigger hook on disabling timeslots.		Usage: 	jQuery( ".booking_form_div" ).on( 'wpbc_hook_timeslots_disabled', function ( event, bk_type, all_dates ){ ... } );		//FixIn: 8.7.11.9
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
        //FixIn: 9.8.10.1
        for (var i = 0; i < value_option_seconds_arr.length; i++) {
          //FixIn: 10.0.0.56
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
    //FixIn: 9.8.10.1
    for (var i = 0; i < selected_dates_arr.length; i++) {
      //FixIn: 10.0.0.56
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
        //FixIn: 9.8.10.1
        for (var i = 0; i < value_option_seconds_arr.length; i++) {
          //FixIn: 10.0.0.56
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
    // In some cases,  the setFullYear can  set  only Year,  and not the Month and day      //FixIn:6.2.3.5
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
    var is_set_pending_days_selectable = _wpbc.calendar__get_param_value(resource_id, 'pending_days_selectable'); // set pending days selectable          //FixIn: 8.6.1.18

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
    //FixIn: 8.4.5.16
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
  var td_el = jQuery('#calendar_booking' + resource_id + ' td.cal4date-' + td_class).get(0); //FixIn: 9.0.1.1

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
      //FixIn: 9.4.2.2
      //delay			 : [0, 9999999999],						// Debuge  tooltip
      ignoreAttributes: true,
      touch: true,
      //['hold', 500], // 500ms delay				//FixIn: 9.2.1.5
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
  //FixIn: 10.0.0.50

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
  //FixIn: 10.0.0.47

  console.log('WPBC_AUTO_SELECT_DATES_IN_CALENDAR( RESOURCE_ID, CHECK_IN_YMD, CHECK_OUT_YMD )', resource_id, check_in_ymd, check_out_ymd);
  if ('2100-01-01' == check_in_ymd || '2100-01-01' == check_out_ymd || '' == check_in_ymd && '' == check_out_ymd) {
    return 0;
  }

  // -----------------------------------------------------------------------------------------------------------------
  // If 	check_in_ymd  =  [ '2024-05-09','2024-05-19','2024-05-30' ]				ARRAY of DATES						//FixIn: 10.0.0.50
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
  //FixIn: 10.0.0.50

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

  // Disable days selection  in calendar,  after  redirection  from  the "Search results page,  after  search  availability" 			//FixIn: 8.8.2.3
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
  //FixIn: 10.0.0.48

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

//FixIn: 9.8.9.2

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
  //FixIn: 9.8.6.2
  wpbc_calendar__loading__start(params['resource_id']);
  if (wpbc_balancer__is_wait(params, 'wpbc_calendar__load_data__ajx')) {
    return false;
  }

  //FixIn: 9.8.6.2
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

    //FixIn: 9.8.6.2
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

    // Trigger event that calendar has been		 //FixIn: 10.0.0.44
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

//FixIn: 10.2.0.4
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
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIndwYmNfdXRpbHMuanMiLCJ3cGJjLmpzIiwiYWp4X2xvYWRfYmFsYW5jZXIuanMiLCJ3cGJjX2NhbC5qcyIsImRheXNfc2VsZWN0X2N1c3RvbS5qcyIsIndwYmNfY2FsX2FqeC5qcyIsIndwYmNfZmVfbWVzc2FnZXMuanMiLCJ0aW1lbGluZV9wb3BvdmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxTQUFBLENBQUEsY0FBQSxFQUFBO0VBRUEsSUFBQSxLQUFBLENBQUEsT0FBQSxDQUFBLGNBQUEsQ0FBQSxFQUFBO0lBQ0EsY0FBQSxHQUFBLGNBQUEsQ0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBO0VBQ0E7RUFFQSxJQUFBLFFBQUEsSUFBQSxPQUFBLGNBQUEsRUFBQTtJQUNBLGNBQUEsR0FBQSxjQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7RUFDQTtFQUVBLE9BQUEsY0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxhQUFBLENBQUEsVUFBQSxFQUFBLEtBQUEsRUFBQTtFQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFDQSxJQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxLQUFBLEVBQUE7TUFDQSxPQUFBLElBQUE7SUFDQTtFQUNBO0VBQ0EsT0FBQSxLQUFBO0FBQ0E7QUN2Q0EsWUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxjQUFBLENBQUEsR0FBQSxFQUFBO0VBRUEsT0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLElBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7QUFDQTs7QUFJQTtBQUNBO0FBQ0E7O0FBRUEsSUFBQSxLQUFBLEdBQUEsVUFBQSxHQUFBLEVBQUEsQ0FBQSxFQUFBO0VBRUE7RUFDQSxJQUFBLFFBQUEsR0FBQSxHQUFBLENBQUEsWUFBQSxHQUFBLEdBQUEsQ0FBQSxZQUFBLElBQUE7SUFDQSxPQUFBLEVBQUEsQ0FBQTtJQUNBLEtBQUEsRUFBQSxFQUFBO0lBQ0EsTUFBQSxFQUFBO0VBQ0EsQ0FBQTtFQUNBLEdBQUEsQ0FBQSxnQkFBQSxHQUFBLFVBQUEsU0FBQSxFQUFBLFNBQUEsRUFBQTtJQUNBLFFBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFBO0VBQ0EsQ0FBQTtFQUVBLEdBQUEsQ0FBQSxnQkFBQSxHQUFBLFVBQUEsU0FBQSxFQUFBO0lBQ0EsT0FBQSxRQUFBLENBQUEsU0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFHQTtFQUNBLElBQUEsV0FBQSxHQUFBLEdBQUEsQ0FBQSxhQUFBLEdBQUEsR0FBQSxDQUFBLGFBQUEsSUFBQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0VBQUEsQ0FDQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsb0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLE9BQUEsV0FBQSxLQUFBLE9BQUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsY0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7SUFDQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxHQUFBLFdBQUE7SUFDQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLHlCQUFBLENBQUEsR0FBQSxLQUFBO0VBRUEsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLHFCQUFBLEdBQUEsVUFBQSxhQUFBLEVBQUE7SUFBQTs7SUFFQSxJQUFBLHlCQUFBLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLG1CQUFBLEVBQUEsaUJBQUEsQ0FBQTtJQUVBLElBQUEsVUFBQSxHQUFBLHlCQUFBLENBQUEsUUFBQSxDQUFBLGFBQUEsQ0FBQTtJQUVBLE9BQUEsVUFBQTtFQUNBLENBQUE7O0VBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLGtCQUFBLEdBQUEsVUFBQSxhQUFBLEVBQUE7SUFDQSxXQUFBLEdBQUEsYUFBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxrQkFBQSxHQUFBLFlBQUE7SUFDQSxPQUFBLFdBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx3QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsSUFBQSxHQUFBLENBQUEsb0JBQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtNQUVBLE9BQUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7SUFDQSxDQUFBLE1BQUE7TUFDQSxPQUFBLEtBQUE7SUFDQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsd0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxxQkFBQSxFQUFBO0lBQUEsSUFBQSxxQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsS0FBQTtJQUVBLElBQUEsQ0FBQSxHQUFBLENBQUEsb0JBQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSxJQUFBLEtBQUEscUJBQUEsRUFBQTtNQUNBLEdBQUEsQ0FBQSxjQUFBLENBQUEsV0FBQSxDQUFBO0lBQ0E7SUFFQSxLQUFBLElBQUEsU0FBQSxJQUFBLHFCQUFBLEVBQUE7TUFFQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLHFCQUFBLENBQUEsU0FBQSxDQUFBO0lBQ0E7SUFFQSxPQUFBLFdBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx5QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLFNBQUEsRUFBQSxVQUFBLEVBQUE7SUFFQSxJQUFBLENBQUEsR0FBQSxDQUFBLG9CQUFBLENBQUEsV0FBQSxDQUFBLEVBQUE7TUFDQSxHQUFBLENBQUEsY0FBQSxDQUFBLFdBQUEsQ0FBQTtJQUNBO0lBRUEsV0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxVQUFBO0lBRUEsT0FBQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEseUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxTQUFBLEVBQUE7SUFFQSxJQUNBLEdBQUEsQ0FBQSxvQkFBQSxDQUFBLFdBQUEsQ0FBQSxJQUNBLFdBQUEsS0FBQSxPQUFBLFdBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLEVBQ0E7TUFDQTtNQUNBLElBQUEsR0FBQSxDQUFBLHFCQUFBLENBQUEsU0FBQSxDQUFBLEVBQUE7UUFDQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxXQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBO01BQ0E7TUFDQSxPQUFBLFdBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBO0lBQ0E7SUFFQSxPQUFBLElBQUEsQ0FBQSxDQUFBO0VBQ0EsQ0FBQTtFQUNBOztFQUdBO0VBQ0EsSUFBQSxVQUFBLEdBQUEsR0FBQSxDQUFBLFlBQUEsR0FBQSxHQUFBLENBQUEsWUFBQSxJQUFBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7RUFBQSxDQUNBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxnQ0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsT0FBQSxXQUFBLEtBQUEsT0FBQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLHlCQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUE7SUFFQSxJQUFBLEdBQUEsQ0FBQSxnQ0FBQSxDQUFBLFdBQUEsQ0FBQSxFQUFBO01BRUEsT0FBQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtJQUNBLENBQUEsTUFBQTtNQUNBLE9BQUEsS0FBQTtJQUNBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEseUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxZQUFBLEVBQUE7SUFFQSxJQUFBLENBQUEsR0FBQSxDQUFBLGdDQUFBLENBQUEsV0FBQSxDQUFBLEVBQUE7TUFDQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtNQUNBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLEdBQUEsV0FBQTtJQUNBO0lBRUEsS0FBQSxJQUFBLFNBQUEsSUFBQSxZQUFBLEVBQUE7TUFFQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFlBQUEsQ0FBQSxTQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsK0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLElBQ0EsR0FBQSxDQUFBLGdDQUFBLENBQUEsV0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsS0FBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLCtCQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsU0FBQSxFQUFBO0lBQUEsSUFBQSxxQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsSUFBQTtJQUVBLElBQUEsQ0FBQSxHQUFBLENBQUEsZ0NBQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtNQUNBLEdBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQTtRQUFBLE9BQUEsRUFBQSxDQUFBO01BQUEsQ0FBQSxDQUFBO0lBQ0E7SUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLEVBQUE7TUFDQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtJQUNBO0lBRUEsSUFBQSxxQkFBQSxFQUFBO01BRUE7TUFDQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLFNBQUE7SUFDQSxDQUFBLE1BQUE7TUFFQTtNQUNBLEtBQUEsSUFBQSxTQUFBLElBQUEsU0FBQSxFQUFBO1FBRUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFBLENBQUEsU0FBQSxDQUFBO01BQ0E7SUFDQTtJQUVBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsa0NBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxhQUFBLEVBQUE7SUFFQSxJQUNBLEdBQUEsQ0FBQSxnQ0FBQSxDQUFBLFdBQUEsQ0FBQSxJQUNBLFdBQUEsS0FBQSxPQUFBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxhQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxhQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsS0FBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLHdCQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsU0FBQSxFQUFBLFVBQUEsRUFBQTtJQUVBLElBQUEsQ0FBQSxHQUFBLENBQUEsZ0NBQUEsQ0FBQSxXQUFBLENBQUEsRUFBQTtNQUNBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO01BQ0EsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsR0FBQSxXQUFBO0lBQ0E7SUFFQSxVQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFVBQUE7SUFFQSxPQUFBLFVBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx3QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLFNBQUEsRUFBQTtJQUVBLElBQ0EsR0FBQSxDQUFBLGdDQUFBLENBQUEsV0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsSUFBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSw4QkFBQSxHQUFBLFVBQUEsYUFBQSxFQUFBO0lBQ0EsVUFBQSxHQUFBLGFBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsOEJBQUEsR0FBQSxZQUFBO0lBQ0EsT0FBQSxVQUFBO0VBQ0EsQ0FBQTtFQUNBOztFQUtBO0VBQ0EsSUFBQSxTQUFBLEdBQUEsR0FBQSxDQUFBLFdBQUEsR0FBQSxHQUFBLENBQUEsV0FBQSxJQUFBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7RUFBQSxDQUNBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxZQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsU0FBQSxFQUFBO0lBQUEsSUFBQSxxQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsS0FBQTtJQUVBLElBQUEsV0FBQSxLQUFBLE9BQUEsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsRUFBQTtNQUNBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0lBQ0E7SUFFQSxJQUFBLHFCQUFBLEVBQUE7TUFFQTtNQUNBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsU0FBQTtJQUVBLENBQUEsTUFBQTtNQUVBO01BQ0EsS0FBQSxJQUFBLFNBQUEsSUFBQSxTQUFBLEVBQUE7UUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLEVBQUE7VUFDQSxTQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLEVBQUE7UUFDQTtRQUNBLEtBQUEsSUFBQSxlQUFBLElBQUEsU0FBQSxDQUFBLFNBQUEsQ0FBQSxFQUFBO1VBQ0EsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsU0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGVBQUEsQ0FBQSxDQUFBO1FBQ0E7TUFDQTtJQUNBO0lBRUEsT0FBQSxTQUFBLENBQUEsV0FBQSxHQUFBLFdBQUEsQ0FBQTtFQUNBLENBQUE7O0VBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEscUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxhQUFBLEVBQUE7SUFFQSxJQUNBLFdBQUEsS0FBQSxPQUFBLFNBQUEsQ0FBQSxXQUFBLEdBQUEsV0FBQSxDQUFBLElBQ0EsV0FBQSxLQUFBLE9BQUEsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxhQUFBLENBQUEsRUFDQTtNQUNBLE9BQUEsU0FBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxhQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsRUFBQSxDQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBO0VBQ0EsSUFBQSxPQUFBLEdBQUEsR0FBQSxDQUFBLFNBQUEsR0FBQSxHQUFBLENBQUEsU0FBQSxJQUFBLENBQUEsQ0FBQTtFQUVBLEdBQUEsQ0FBQSxlQUFBLEdBQUEsVUFBQSxTQUFBLEVBQUEsU0FBQSxFQUFBO0lBQ0EsT0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFNBQUE7RUFDQSxDQUFBO0VBRUEsR0FBQSxDQUFBLGVBQUEsR0FBQSxVQUFBLFNBQUEsRUFBQTtJQUNBLE9BQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxvQkFBQSxHQUFBLFlBQUE7SUFDQSxPQUFBLE9BQUE7RUFDQSxDQUFBOztFQUVBO0VBQ0EsSUFBQSxVQUFBLEdBQUEsR0FBQSxDQUFBLFlBQUEsR0FBQSxHQUFBLENBQUEsWUFBQSxJQUFBLENBQUEsQ0FBQTtFQUVBLEdBQUEsQ0FBQSxXQUFBLEdBQUEsVUFBQSxTQUFBLEVBQUEsU0FBQSxFQUFBO0lBQ0EsVUFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFNBQUE7RUFDQSxDQUFBO0VBRUEsR0FBQSxDQUFBLFdBQUEsR0FBQSxVQUFBLFNBQUEsRUFBQTtJQUNBLE9BQUEsVUFBQSxDQUFBLFNBQUEsQ0FBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxpQkFBQSxHQUFBLFlBQUE7SUFDQSxPQUFBLFVBQUE7RUFDQSxDQUFBOztFQUVBOztFQUVBLE9BQUEsR0FBQTtBQUVBLENBQUEsQ0FBQSxLQUFBLElBQUEsQ0FBQSxDQUFBLEVBQUEsTUFBQSxDQUFBOztBQzloQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBQSxHQUFBLFVBQUEsR0FBQSxFQUFBLENBQUEsRUFBQTtFQUVBOztFQUVBLElBQUEsVUFBQSxHQUFBLEdBQUEsQ0FBQSxZQUFBLEdBQUEsR0FBQSxDQUFBLFlBQUEsSUFBQTtJQUNBLGFBQUEsRUFBQSxDQUFBO0lBQ0EsWUFBQSxFQUFBLEVBQUE7SUFDQSxNQUFBLEVBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEseUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLFVBQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxXQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsb0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUVBLE9BQUEsV0FBQSxLQUFBLE9BQUEsVUFBQSxDQUFBLFdBQUEsR0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsY0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtJQUFBLElBQUEsTUFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsQ0FBQSxDQUFBO0lBRUEsSUFBQSxXQUFBLEdBQUEsQ0FBQSxDQUFBO0lBQ0EsV0FBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLFdBQUE7SUFDQSxXQUFBLENBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQTtJQUNBLFdBQUEsQ0FBQSxlQUFBLENBQUEsR0FBQSxhQUFBO0lBQ0EsV0FBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLGNBQUEsQ0FBQSxNQUFBLENBQUE7SUFHQSxJQUFBLEdBQUEsQ0FBQSx3QkFBQSxDQUFBLFdBQUEsRUFBQSxhQUFBLENBQUEsRUFBQTtNQUNBLE9BQUEsS0FBQTtJQUNBO0lBQ0EsSUFBQSxHQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxDQUFBLEVBQUE7TUFDQSxPQUFBLE1BQUE7SUFDQTtJQUdBLElBQUEsR0FBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EsR0FBQSxDQUFBLHFCQUFBLENBQUEsV0FBQSxDQUFBO01BQ0EsT0FBQSxLQUFBO0lBQ0EsQ0FBQSxNQUFBO01BQ0EsR0FBQSxDQUFBLHNCQUFBLENBQUEsV0FBQSxDQUFBO01BQ0EsT0FBQSxNQUFBO0lBQ0E7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLG1CQUFBLEdBQUEsWUFBQTtJQUNBLE9BQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxVQUFBLENBQUEsYUFBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSxzQkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBQ0EsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxXQUFBLENBQUE7RUFDQSxDQUFBOztFQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0EsR0FBQSxDQUFBLGdDQUFBLEdBQUEsVUFBQSxXQUFBLEVBQUEsYUFBQSxFQUFBO0lBRUEsSUFBQSxVQUFBLEdBQUEsS0FBQTtJQUVBLElBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtNQUFBO01BQ0EsS0FBQSxJQUFBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxDQUFBLEVBQUE7UUFDQSxJQUNBLFdBQUEsS0FBQSxVQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsYUFBQSxDQUFBLElBQ0EsYUFBQSxLQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsRUFDQTtVQUNBLFVBQUEsR0FBQSxVQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUE7VUFDQSxVQUFBLEdBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO1VBQ0EsVUFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsVUFBQSxDQUFBLEVBQUE7WUFDQSxPQUFBLENBQUE7VUFDQSxDQUFBLENBQUEsQ0FBQSxDQUFBO1VBQ0EsT0FBQSxVQUFBO1FBQ0E7TUFDQTtJQUNBO0lBQ0EsT0FBQSxVQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSx5QkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtJQUVBLElBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtNQUFBO01BQ0EsS0FBQSxJQUFBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxDQUFBLEVBQUE7UUFDQSxJQUNBLFdBQUEsS0FBQSxVQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsYUFBQSxDQUFBLElBQ0EsYUFBQSxLQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsRUFDQTtVQUNBLE9BQUEsSUFBQTtRQUNBO01BQ0E7SUFDQTtJQUNBLE9BQUEsS0FBQTtFQUNBLENBQUE7O0VBR0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEscUJBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQTtJQUNBLFVBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsQ0FBQTs7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLEdBQUEsQ0FBQSwrQkFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtJQUVBLElBQUEsVUFBQSxHQUFBLEtBQUE7SUFFQSxJQUFBLFVBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7TUFBQTtNQUNBLEtBQUEsSUFBQSxDQUFBLElBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxFQUFBO1FBQ0EsSUFDQSxXQUFBLEtBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLGFBQUEsQ0FBQSxJQUNBLGFBQUEsS0FBQSxVQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsZUFBQSxDQUFBLEVBQ0E7VUFDQSxVQUFBLEdBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBO1VBQ0EsVUFBQSxHQUFBLFVBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtVQUNBLFVBQUEsQ0FBQSxZQUFBLENBQUEsR0FBQSxVQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsTUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO1lBQ0EsT0FBQSxDQUFBO1VBQ0EsQ0FBQSxDQUFBLENBQUEsQ0FBQTtVQUNBLE9BQUEsVUFBQTtRQUNBO01BQ0E7SUFDQTtJQUNBLE9BQUEsVUFBQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsd0JBQUEsR0FBQSxVQUFBLFdBQUEsRUFBQSxhQUFBLEVBQUE7SUFFQSxJQUFBLFVBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7TUFBQTtNQUNBLEtBQUEsSUFBQSxDQUFBLElBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxFQUFBO1FBQ0EsSUFDQSxXQUFBLEtBQUEsVUFBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLGFBQUEsQ0FBQSxJQUNBLGFBQUEsS0FBQSxVQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsZUFBQSxDQUFBLEVBQ0E7VUFDQSxPQUFBLElBQUE7UUFDQTtNQUNBO0lBQ0E7SUFDQSxPQUFBLEtBQUE7RUFDQSxDQUFBO0VBSUEsR0FBQSxDQUFBLGtCQUFBLEdBQUEsWUFBQTtJQUVBO0lBQ0EsSUFBQSxVQUFBLEdBQUEsS0FBQTtJQUNBLElBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtNQUFBO01BQ0EsS0FBQSxJQUFBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxDQUFBLEVBQUE7UUFDQSxVQUFBLEdBQUEsR0FBQSxDQUFBLGdDQUFBLENBQUEsVUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLGFBQUEsQ0FBQSxFQUFBLFVBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxlQUFBLENBQUEsQ0FBQTtRQUNBO01BQ0E7SUFDQTtJQUVBLElBQUEsS0FBQSxLQUFBLFVBQUEsRUFBQTtNQUVBO01BQ0EsR0FBQSxDQUFBLGFBQUEsQ0FBQSxVQUFBLENBQUE7SUFDQTtFQUNBLENBQUE7O0VBRUE7QUFDQTtBQUNBO0FBQ0E7RUFDQSxHQUFBLENBQUEsYUFBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0lBRUEsUUFBQSxXQUFBLENBQUEsZUFBQSxDQUFBO01BRUEsS0FBQSwrQkFBQTtRQUVBO1FBQ0EsR0FBQSxDQUFBLHFCQUFBLENBQUEsV0FBQSxDQUFBO1FBRUEsNkJBQUEsQ0FBQSxXQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7UUFDQTtNQUVBO0lBQ0E7RUFDQSxDQUFBO0VBRUEsT0FBQSxHQUFBO0FBRUEsQ0FBQSxDQUFBLEtBQUEsSUFBQSxDQUFBLENBQUEsRUFBQSxNQUFBLENBQUE7O0FBR0E7QUFDQTtBQUNBOztBQUVBLFNBQUEsc0JBQUEsQ0FBQSxNQUFBLEVBQUEsYUFBQSxFQUFBO0VBQ0E7RUFDQSxJQUFBLFdBQUEsS0FBQSxPQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsZUFBQSxHQUFBLEtBQUEsQ0FBQSxjQUFBLENBQUEsTUFBQSxDQUFBLGFBQUEsQ0FBQSxFQUFBLGFBQUEsRUFBQSxNQUFBLENBQUE7SUFFQSxPQUFBLE1BQUEsS0FBQSxlQUFBO0VBQ0E7RUFFQSxPQUFBLEtBQUE7QUFDQTtBQUdBLFNBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxFQUFBO0VBQ0E7RUFDQSxLQUFBLENBQUEsK0JBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxDQUFBO0VBQ0EsS0FBQSxDQUFBLGtCQUFBLENBQUEsQ0FBQTtBQUNBO0FDdFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGtCQUFBLENBQUEsV0FBQSxFQUFBO0VBRUE7RUFDQSxJQUFBLENBQUEsS0FBQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7SUFBQSxPQUFBLEtBQUE7RUFBQTs7RUFFQTtFQUNBLElBQUEsSUFBQSxLQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSxhQUFBLENBQUEsRUFBQTtJQUFBLE9BQUEsS0FBQTtFQUFBOztFQUVBO0VBQ0E7RUFDQTtFQUNBLElBQUEsc0JBQUEsR0FBQSxLQUFBO0VBQ0EsSUFBQSw0QkFBQSxHQUFBLEdBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxTQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtJQUNBLHNCQUFBLEdBQUEsSUFBQTtJQUNBLDRCQUFBLEdBQUEsQ0FBQTtFQUNBO0VBQ0EsSUFBQSxRQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtJQUNBLDRCQUFBLEdBQUEsQ0FBQTtFQUNBOztFQUVBO0VBQ0E7RUFDQTtFQUNBLElBQUEsZUFBQSxHQUFBLENBQUE7RUFDQSxlQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxRQUFBLENBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsZUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBO0VBQ0EsSUFBQSxlQUFBLEdBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGlDQUFBLENBQUE7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQTtFQUNBOztFQUVBLElBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsZUFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLElBQ0EsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsY0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7RUFBQSxFQUNBO0lBQ0EsZUFBQSxHQUFBLElBQUE7SUFDQSxlQUFBLEdBQUEsSUFBQTtFQUNBO0VBRUEsSUFBQSxvQkFBQSxHQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSx5QkFBQSxDQUFBO0VBQ0EsSUFBQSx1QkFBQSxHQUFBLFFBQUEsQ0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsMkJBQUEsQ0FBQSxDQUFBO0VBRUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQTtFQUNBO0VBQ0E7RUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxRQUFBLENBQ0E7SUFDQSxhQUFBLEVBQUEsU0FBQSxjQUFBLE9BQUEsRUFBQTtNQUNBLE9BQUEsaUNBQUEsQ0FBQSxPQUFBLEVBQUE7UUFBQSxhQUFBLEVBQUE7TUFBQSxDQUFBLEVBQUEsSUFBQSxDQUFBO0lBQ0EsQ0FBQTtJQUNBLFFBQUEsRUFBQSxTQUFBLFNBQUEsWUFBQSxFQUFBLFlBQUEsRUFBQTtNQUFBO0FBQ0E7QUFDQTtBQUNBO01BQ0EsT0FBQSw4QkFBQSxDQUFBLFlBQUEsRUFBQTtRQUFBLGFBQUEsRUFBQTtNQUFBLENBQUEsRUFBQSxJQUFBLENBQUE7SUFDQSxDQUFBO0lBQ0EsT0FBQSxFQUFBLFNBQUEsUUFBQSxXQUFBLEVBQUEsT0FBQSxFQUFBO01BQ0EsT0FBQSw2QkFBQSxDQUFBLFdBQUEsRUFBQSxPQUFBLEVBQUE7UUFBQSxhQUFBLEVBQUE7TUFBQSxDQUFBLEVBQUEsSUFBQSxDQUFBO0lBQ0EsQ0FBQTtJQUNBLGlCQUFBLEVBQUEsU0FBQSxrQkFBQSxJQUFBLEVBQUEsVUFBQSxFQUFBLHlCQUFBLEVBQUEsQ0FBQSxDQUFBO0lBQ0EsTUFBQSxFQUFBLE1BQUE7SUFDQSxjQUFBLEVBQUEsdUJBQUE7SUFDQSxVQUFBLEVBQUEsQ0FBQTtJQUNBO0lBQ0E7SUFDQSxRQUFBLEVBQUEsVUFBQTtJQUNBLFFBQUEsRUFBQSxVQUFBO0lBQ0EsVUFBQSxFQUFBLFVBQUE7SUFDQSxXQUFBLEVBQUEsS0FBQTtJQUNBLFVBQUEsRUFBQSxLQUFBO0lBQ0EsT0FBQSxFQUFBLGVBQUE7SUFDQSxPQUFBLEVBQUEsZUFBQTtJQUFBO0lBQ0E7SUFDQSxVQUFBLEVBQUEsS0FBQTtJQUNBLGNBQUEsRUFBQSxJQUFBO0lBQ0EsVUFBQSxFQUFBLEtBQUE7SUFDQSxRQUFBLEVBQUEsb0JBQUE7SUFDQSxXQUFBLEVBQUEsS0FBQTtJQUNBLGdCQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQSw0QkFBQTtJQUNBLFdBQUEsRUFBQSxzQkFBQTtJQUNBO0lBQ0EsY0FBQSxFQUFBO0VBQ0EsQ0FDQSxDQUFBOztFQUlBO0VBQ0E7RUFDQTtFQUNBLFVBQUEsQ0FBQSxZQUFBO0lBQUEsdUNBQUEsQ0FBQSxXQUFBLENBQUE7RUFBQSxDQUFBLEVBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQSxJQUFBLGNBQUEsR0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsb0JBQUEsQ0FBQTtFQUNBLElBQUEsS0FBQSxLQUFBLGNBQUEsRUFBQTtJQUNBLHdCQUFBLENBQUEsV0FBQSxFQUFBLGNBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxjQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxpQ0FBQSxDQUFBLElBQUEsRUFBQSxtQkFBQSxFQUFBLGFBQUEsRUFBQTtFQUVBLElBQUEsVUFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLGVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLFNBQUEsR0FBQSx3QkFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLGFBQUEsR0FBQSx5QkFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLFdBQUEsR0FBQSxXQUFBLEtBQUEsT0FBQSxtQkFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLG1CQUFBLENBQUEsYUFBQSxDQUFBLEdBQUEsR0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLGtCQUFBLEdBQUEsb0NBQUEsQ0FBQSxXQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLGlCQUFBLEdBQUEsS0FBQSxDQUFBLGtDQUFBLENBQUEsV0FBQSxFQUFBLGFBQUEsQ0FBQTs7RUFHQTtFQUNBLElBQUEscUJBQUEsR0FBQSxFQUFBO0VBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsV0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSxXQUFBLEdBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGVBQUEsR0FBQSxJQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxJQUNBLGtCQUFBLENBQUE7RUFDQTtFQUFBLEVBQ0E7SUFDQSxJQUFBLGFBQUEsS0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsbUJBQUEsQ0FBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLENBQUE7SUFDQTtJQUNBLElBQUEsa0JBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxJQUFBLGFBQUEsS0FBQSxrQkFBQSxDQUFBLGtCQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsb0JBQUEsQ0FBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLENBQUE7SUFDQTtFQUNBO0VBR0EsSUFBQSxpQkFBQSxHQUFBLEtBQUE7O0VBRUE7RUFDQSxJQUFBLEtBQUEsS0FBQSxpQkFBQSxFQUFBO0lBRUEscUJBQUEsQ0FBQSxJQUFBLENBQUEsdUJBQUEsQ0FBQTtJQUVBLE9BQUEsQ0FBQSxpQkFBQSxFQUFBLHFCQUFBLENBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0VBQ0E7O0VBR0E7RUFDQTtFQUNBOztFQUVBO0VBQ0E7RUFDQSxJQUFBLGdCQUFBLEdBQUEsS0FBQSxDQUFBLHFCQUFBLENBQUEsV0FBQSxFQUFBLGFBQUEsQ0FBQTtFQUVBLEtBQUEsSUFBQSxVQUFBLElBQUEsZ0JBQUEsRUFBQTtJQUVBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGdCQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0E7RUFDQTs7RUFHQTtFQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLE9BQUEsR0FBQSxpQkFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLGdCQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLEVBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBOztFQUdBLElBQUEsUUFBQSxDQUFBLGlCQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsaUJBQUEsR0FBQSxJQUFBO0lBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsZ0JBQUEsQ0FBQTtJQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHFCQUFBLEdBQUEsUUFBQSxDQUFBLGlCQUFBLENBQUEsY0FBQSxDQUFBLEdBQUEsaUJBQUEsQ0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLENBQUEsTUFBQTtJQUNBLGlCQUFBLEdBQUEsS0FBQTtJQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLENBQUE7RUFDQTtFQUdBLFFBQUEsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxnQkFBQSxDQUFBO0lBRUEsS0FBQSxXQUFBO01BQ0E7SUFFQSxLQUFBLG9CQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsYUFBQSxFQUFBLGFBQUEsQ0FBQTtNQUNBO0lBRUEsS0FBQSxrQkFBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGtCQUFBLENBQUE7TUFDQTtJQUVBLEtBQUEsZUFBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLEVBQUEsb0JBQUEsQ0FBQTtNQUNBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBO01BQ0E7SUFFQSxLQUFBLHVCQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsdUJBQUEsRUFBQSxzQkFBQSxDQUFBO01BQ0EsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxxQkFBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLENBQUE7TUFDQTtJQUVBLEtBQUEscUJBQUE7TUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSx1QkFBQSxFQUFBLHFCQUFBLENBQUE7TUFDQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsQ0FBQTtNQUNBO0lBRUEsS0FBQSx3QkFBQTtNQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLHVCQUFBLEVBQUEsd0JBQUEsQ0FBQTtNQUNBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBO01BQ0E7SUFFQSxLQUFBLDRCQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsdUJBQUEsRUFBQSw0QkFBQSxDQUFBO01BQ0EsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxxQkFBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLENBQUE7TUFDQTtJQUVBLEtBQUEsYUFBQTtNQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztNQUVBLHFCQUFBLENBQUEsSUFBQSxDQUFBLGFBQUEsRUFBQSxlQUFBLEVBQUEsZ0JBQUEsQ0FBQTtNQUNBO01BQ0EsSUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsa0JBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsOEJBQUEsRUFBQSw0QkFBQSxDQUFBO01BQ0E7TUFDQSxJQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxrQkFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUE7UUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSw2QkFBQSxFQUFBLDZCQUFBLENBQUE7TUFDQTtNQUNBO0lBRUEsS0FBQSxVQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsYUFBQSxFQUFBLGVBQUEsQ0FBQTs7TUFFQTtNQUNBLElBQUEsaUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxxQkFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsNEJBQUEsQ0FBQTtNQUNBLENBQUEsTUFBQSxJQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQTtRQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLDZCQUFBLENBQUE7TUFDQTtNQUNBO0lBRUEsS0FBQSxXQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsYUFBQSxFQUFBLGdCQUFBLENBQUE7O01BRUE7TUFDQSxJQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsRUFBQTtRQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLDZCQUFBLENBQUE7TUFDQSxDQUFBLE1BQUEsSUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUE7UUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSw4QkFBQSxDQUFBO01BQ0E7TUFDQTtJQUVBO01BQ0E7TUFDQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGdCQUFBLENBQUEsR0FBQSxXQUFBO0VBQ0E7RUFJQSxJQUFBLFdBQUEsSUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGdCQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsOEJBQUEsR0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEseUJBQUEsQ0FBQSxDQUFBLENBQUE7O0lBRUEsUUFBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHFCQUFBLENBQUE7TUFFQSxLQUFBLEVBQUE7UUFDQTtRQUNBO01BRUEsS0FBQSxTQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsY0FBQSxDQUFBO1FBQ0EsaUJBQUEsR0FBQSxpQkFBQSxHQUFBLElBQUEsR0FBQSw4QkFBQTtRQUNBO01BRUEsS0FBQSxVQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsZUFBQSxDQUFBO1FBQ0E7O01BRUE7TUFDQSxLQUFBLGlCQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsNkJBQUEsRUFBQSw0QkFBQSxDQUFBO1FBQ0EsaUJBQUEsR0FBQSxpQkFBQSxHQUFBLElBQUEsR0FBQSw4QkFBQTtRQUNBO01BRUEsS0FBQSxrQkFBQTtRQUNBLHFCQUFBLENBQUEsSUFBQSxDQUFBLDZCQUFBLEVBQUEsNkJBQUEsQ0FBQTtRQUNBLGlCQUFBLEdBQUEsaUJBQUEsR0FBQSxJQUFBLEdBQUEsOEJBQUE7UUFDQTtNQUVBLEtBQUEsa0JBQUE7UUFDQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSw4QkFBQSxFQUFBLDRCQUFBLENBQUE7UUFDQSxpQkFBQSxHQUFBLGlCQUFBLEdBQUEsSUFBQSxHQUFBLDhCQUFBO1FBQ0E7TUFFQSxLQUFBLG1CQUFBO1FBQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsOEJBQUEsRUFBQSw2QkFBQSxDQUFBO1FBQ0E7TUFFQTtJQUVBO0VBQ0E7RUFFQSxPQUFBLENBQUEsaUJBQUEsRUFBQSxxQkFBQSxDQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDZCQUFBLENBQUEsV0FBQSxFQUFBLElBQUEsRUFBQSxtQkFBQSxFQUFBLGFBQUEsRUFBQTtFQUVBLElBQUEsSUFBQSxLQUFBLElBQUEsRUFBQTtJQUFBLE9BQUEsS0FBQTtFQUFBO0VBRUEsSUFBQSxTQUFBLEdBQUEsd0JBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxhQUFBLEdBQUEseUJBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxXQUFBLEdBQUEsV0FBQSxLQUFBLE9BQUEsbUJBQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxtQkFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLEdBQUEsQ0FBQSxDQUFBOztFQUVBO0VBQ0EsSUFBQSxnQkFBQSxHQUFBLEtBQUEsQ0FBQSxrQ0FBQSxDQUFBLFdBQUEsRUFBQSxhQUFBLENBQUEsQ0FBQSxDQUFBOztFQUVBLElBQUEsQ0FBQSxnQkFBQSxFQUFBO0lBQUEsT0FBQSxLQUFBO0VBQUE7O0VBR0E7RUFDQSxJQUFBLFlBQUEsR0FBQSxFQUFBO0VBQ0EsSUFBQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHNCQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsWUFBQSxJQUFBLGdCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsc0JBQUEsQ0FBQTtFQUNBO0VBQ0EsSUFBQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGtCQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsWUFBQSxJQUFBLGdCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsa0JBQUEsQ0FBQTtFQUNBO0VBQ0EsSUFBQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLGVBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQUE7SUFDQSxZQUFBLElBQUEsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxlQUFBLENBQUE7RUFDQTtFQUNBLElBQUEsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSx5QkFBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtJQUNBLFlBQUEsSUFBQSxnQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLHlCQUFBLENBQUE7RUFDQTtFQUNBLHFDQUFBLENBQUEsWUFBQSxFQUFBLFdBQUEsRUFBQSxTQUFBLENBQUE7O0VBSUE7RUFDQSxJQUFBLHdCQUFBLEdBQUEsTUFBQSxDQUFBLGdDQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxxQkFBQSxHQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBO0VBRUEsSUFBQSx3QkFBQSxJQUFBLENBQUEscUJBQUEsRUFBQTtJQUVBO0FBQ0E7QUFDQTs7SUFFQSx1Q0FBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUE7O0lBRUEsSUFBQSxlQUFBLEdBQUEsdUNBQUEsR0FBQSxXQUFBO0lBQ0EsTUFBQSxDQUFBLGVBQUEsR0FBQSx3QkFBQSxHQUNBLGVBQUEsR0FBQSx3QkFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLFFBQUEsRUFBQSxTQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsT0FBQSxLQUFBO0VBQ0E7O0VBSUE7RUFDQSxJQUNBLFFBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLFdBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxJQUNBLFFBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLGVBQUEsQ0FBQSxHQUFBLENBQUEsSUFDQSxRQUFBLENBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxpQkFBQSxDQUFBLEdBQUEsQ0FBQSxJQUNBLFFBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLHdCQUFBLENBQUEsR0FBQSxDQUFBLElBQ0EsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsb0JBQUEsQ0FBQSxHQUFBLENBQUEsSUFDQSxRQUFBLENBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxXQUFBLENBQUEsR0FBQSxDQUNBLEVBQ0E7SUFDQTs7SUFFQSxJQUFBLFVBQUEsSUFBQSxPQUFBLHFDQUFBLEVBQUE7TUFDQSxxQ0FBQSxDQUFBLGFBQUEsRUFBQSxJQUFBLEVBQUEsV0FBQSxDQUFBO0lBQ0E7RUFDQTtBQUVBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw4QkFBQSxDQUFBLElBQUEsRUFBQSxtQkFBQSxFQUFBLGFBQUEsRUFBQTtFQUVBLElBQUEsV0FBQSxHQUFBLFdBQUEsS0FBQSxPQUFBLG1CQUFBLENBQUEsYUFBQSxDQUFBLEdBQUEsbUJBQUEsQ0FBQSxhQUFBLENBQUEsR0FBQSxHQUFBLENBQUEsQ0FBQTs7RUFFQTtFQUNBLElBQUEsd0JBQUEsR0FBQSxNQUFBLENBQUEsZ0NBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLHFCQUFBLEdBQUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUE7RUFDQSxJQUFBLHdCQUFBLElBQUEsQ0FBQSxxQkFBQSxFQUFBO0lBQ0EsaUNBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsTUFBQSxDQUFBLDZDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxPQUFBLEtBQUE7RUFDQTtFQUVBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUE7O0VBR0EsSUFBQSxVQUFBLEtBQUEsT0FBQSxrQ0FBQSxFQUFBO0lBQUEsa0NBQUEsQ0FBQSxJQUFBLEVBQUEsV0FBQSxDQUFBO0VBQUE7RUFFQSx3Q0FBQSxDQUFBLFdBQUEsQ0FBQTs7RUFFQTtFQUNBLElBQUEsbUJBQUEsR0FBQSxJQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsc0JBQUEsR0FBQSxvQ0FBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxNQUFBLENBQUEsbUJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxlQUFBLEVBQUEsQ0FBQSxXQUFBLEVBQUEsbUJBQUEsRUFBQSxzQkFBQSxDQUFBLENBQUE7QUFDQTs7QUFFQTtBQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsWUFBQTtFQUNBLE1BQUEsQ0FBQSxtQkFBQSxDQUFBLENBQUEsRUFBQSxDQUFBLGVBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxXQUFBLEVBQUEsSUFBQSxFQUFBO0lBQ0EsSUFDQSxPQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsSUFDQSxTQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFDQTtNQUNBLElBQUEsWUFBQSxHQUFBLFVBQUEsQ0FBQSxZQUFBO1FBQ0EsSUFBQSxtQkFBQSxHQUFBLEtBQUEsQ0FBQSxlQUFBLENBQUEsZ0RBQUEsQ0FBQTtRQUNBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsR0FBQSx3QkFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLHdCQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsU0FBQSxFQUFBLG1CQUFBLENBQUE7TUFDQSxDQUFBLEVBQUEsRUFBQSxDQUFBO0lBQ0E7RUFDQSxDQUFBLENBQUE7QUFDQSxDQUFBLENBQUE7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHdDQUFBLENBQUEsV0FBQSxFQUFBO0VBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxJQUFBLG1CQUFBLEdBQUEsOENBQUEsQ0FBQSxXQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLGtCQUFBLEdBQUEsb0NBQUEsQ0FBQSxXQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLG1CQUFBLEdBQUEsY0FBQSxDQUFBLEtBQUEsQ0FBQSx3QkFBQSxDQUFBLFdBQUEsRUFBQSw0QkFBQSxDQUFBLENBQUE7RUFFQSxJQUFBLFFBQUE7RUFDQSxJQUFBLGlCQUFBO0VBQ0EsSUFBQSxjQUFBO0VBQ0EsSUFBQSxlQUFBO0VBQ0EsSUFBQSxZQUFBO0VBQ0EsSUFBQSxXQUFBOztFQUVBO0VBQ0EsS0FBQSxJQUFBLFNBQUEsR0FBQSxDQUFBLEVBQUEsU0FBQSxHQUFBLG1CQUFBLENBQUEsTUFBQSxFQUFBLFNBQUEsRUFBQSxFQUFBO0lBRUEsbUJBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxRQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7O0lBRUEsZUFBQSxHQUFBLG1CQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTs7SUFFQTtJQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxrQkFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtNQUVBO01BQ0EsSUFDQSxLQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLHdCQUFBLENBQUEsSUFDQSxrQkFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQ0E7UUFDQTtRQUNBOztRQUVBLElBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxlQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxJQUFBLENBQUEsRUFBQTtVQUNBO1FBQ0E7UUFDQSxJQUFBLGtCQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsZUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSxDQUFBLEVBQUE7VUFDQTtRQUNBO01BQ0E7O01BRUE7TUFDQSxRQUFBLEdBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUE7TUFHQSxJQUFBLDhCQUFBLEdBQUEsQ0FBQTtNQUNBO01BQ0E7TUFDQSxLQUFBLElBQUEsT0FBQSxHQUFBLENBQUEsRUFBQSxPQUFBLEdBQUEsbUJBQUEsQ0FBQSxNQUFBLEVBQUEsT0FBQSxFQUFBLEVBQUE7UUFFQSxpQkFBQSxHQUFBLG1CQUFBLENBQUEsT0FBQSxDQUFBOztRQUVBO1FBQ0E7O1FBRUEsSUFBQSxLQUFBLEtBQUEsS0FBQSxDQUFBLGtDQUFBLENBQUEsV0FBQSxFQUFBLFFBQUEsQ0FBQSxFQUFBO1VBQ0EsY0FBQSxHQUFBLEtBQUEsQ0FBQSxrQ0FBQSxDQUFBLFdBQUEsRUFBQSxRQUFBLENBQUEsQ0FBQSxpQkFBQSxDQUFBLENBQUEsaUJBQUEsQ0FBQSxjQUFBLENBQUEsQ0FBQTtRQUNBLENBQUEsTUFBQTtVQUNBLGNBQUEsR0FBQSxFQUFBO1FBQ0E7UUFDQSxJQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQUE7VUFDQSxZQUFBLEdBQUEsc0NBQUEsQ0FBQSxDQUNBLENBQ0EsUUFBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxFQUNBLFFBQUEsQ0FBQSxlQUFBLENBQUEsZ0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FDQSxDQUNBLEVBQ0EsY0FBQSxDQUFBO1FBQ0EsQ0FBQSxNQUFBO1VBQ0EsV0FBQSxHQUFBLENBQUEsQ0FBQSxLQUFBLGVBQUEsQ0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLE9BQUEsQ0FBQTtVQUNBLFlBQUEsR0FBQSxvQ0FBQSxDQUNBLFdBQUEsR0FDQSxRQUFBLENBQUEsZUFBQSxDQUFBLGdCQUFBLENBQUEsR0FBQSxFQUFBLEdBQ0EsUUFBQSxDQUFBLGVBQUEsQ0FBQSxnQkFBQSxDQUFBLEdBQUEsRUFBQSxFQUVBLGNBQUEsQ0FBQTtRQUNBO1FBQ0EsSUFBQSxZQUFBLEVBQUE7VUFDQSw4QkFBQSxFQUFBLENBQUEsQ0FBQTtRQUNBO01BRUE7TUFFQSxJQUFBLG1CQUFBLENBQUEsTUFBQSxJQUFBLDhCQUFBLEVBQUE7UUFDQTs7UUFFQSxtQkFBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLFFBQUEsR0FBQSxDQUFBO1FBQ0EsTUFBQSxDQUFBO01BQ0E7SUFDQTtFQUNBOztFQUdBO0VBQ0EsNENBQUEsQ0FBQSxtQkFBQSxDQUFBO0VBRUEsTUFBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsOEJBQUEsRUFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG9DQUFBLENBQUEsTUFBQSxFQUFBLGVBQUEsRUFBQTtFQUVBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxlQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO0lBRUEsSUFBQSxRQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLFFBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxRQUFBLENBQUEsZUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7TUFDQSxPQUFBLElBQUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsS0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxzQ0FBQSxDQUFBLGVBQUEsRUFBQSxlQUFBLEVBQUE7RUFFQSxJQUFBLFlBQUE7RUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsZUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtJQUVBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxlQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO01BRUEsWUFBQSxHQUFBLDhCQUFBLENBQUEsZUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLGVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtNQUVBLElBQUEsWUFBQSxFQUFBO1FBQ0EsT0FBQSxJQUFBO01BQ0E7SUFDQTtFQUNBO0VBRUEsT0FBQSxLQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsOENBQUEsQ0FBQSxXQUFBLEVBQUE7RUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLElBQUEsZUFBQSxHQUFBLENBQ0Esd0JBQUEsR0FBQSxXQUFBLEdBQUEsSUFBQSxFQUNBLHdCQUFBLEdBQUEsV0FBQSxHQUFBLE1BQUEsRUFDQSx3QkFBQSxHQUFBLFdBQUEsR0FBQSxJQUFBLEVBQ0Esd0JBQUEsR0FBQSxXQUFBLEdBQUEsTUFBQSxFQUNBLHNCQUFBLEdBQUEsV0FBQSxHQUFBLElBQUEsRUFDQSxzQkFBQSxHQUFBLFdBQUEsR0FBQSxNQUFBLENBQ0E7RUFFQSxJQUFBLG1CQUFBLEdBQUEsRUFBQTs7RUFFQTtFQUNBLEtBQUEsSUFBQSxHQUFBLEdBQUEsQ0FBQSxFQUFBLEdBQUEsR0FBQSxlQUFBLENBQUEsTUFBQSxFQUFBLEdBQUEsRUFBQSxFQUFBO0lBRUEsSUFBQSxVQUFBLEdBQUEsZUFBQSxDQUFBLEdBQUEsQ0FBQTtJQUNBLElBQUEsV0FBQSxHQUFBLE1BQUEsQ0FBQSxVQUFBLEdBQUEsU0FBQSxDQUFBOztJQUVBO0lBQ0EsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLFdBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7TUFFQSxJQUFBLGFBQUEsR0FBQSxNQUFBLENBQUEsVUFBQSxHQUFBLGFBQUEsR0FBQSxDQUFBLEdBQUEsR0FBQSxDQUFBO01BQ0EsSUFBQSx3QkFBQSxHQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7TUFDQSxJQUFBLGdCQUFBLEdBQUEsRUFBQTs7TUFFQTtNQUNBLElBQUEsd0JBQUEsQ0FBQSxNQUFBLEVBQUE7UUFBQTtRQUNBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSx3QkFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtVQUFBO1VBQ0E7O1VBRUEsSUFBQSxtQkFBQSxHQUFBLHdCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO1VBRUEsSUFBQSxlQUFBLEdBQUEsUUFBQSxDQUFBLG1CQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQSxHQUFBLFFBQUEsQ0FBQSxtQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQTtVQUVBLGdCQUFBLENBQUEsSUFBQSxDQUFBLGVBQUEsQ0FBQTtRQUNBO01BQ0E7TUFFQSxtQkFBQSxDQUFBLElBQUEsQ0FBQTtRQUNBLE1BQUEsRUFBQSxNQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsSUFBQSxDQUFBLE1BQUEsQ0FBQTtRQUNBLGtCQUFBLEVBQUEsYUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO1FBQ0EsZUFBQSxFQUFBLGFBQUE7UUFDQSxrQkFBQSxFQUFBO01BQ0EsQ0FBQSxDQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUEsbUJBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDRDQUFBLENBQUEsbUJBQUEsRUFBQTtFQUVBLElBQUEsYUFBQTtFQUVBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxtQkFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtJQUVBLElBQUEsYUFBQSxHQUFBLG1CQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsYUFBQTtJQUVBLElBQUEsQ0FBQSxJQUFBLG1CQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsUUFBQSxFQUFBO01BQ0EsYUFBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLEVBQUEsSUFBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLGFBQUEsQ0FBQSxRQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQTs7TUFFQTtNQUNBLElBQUEsYUFBQSxDQUFBLElBQUEsQ0FBQSxVQUFBLENBQUEsRUFBQTtRQUNBLGFBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxFQUFBLEtBQUEsQ0FBQTtRQUVBLGFBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSw4QkFBQSxDQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsRUFBQSxJQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsUUFBQSxDQUFBO01BQ0E7SUFFQSxDQUFBLE1BQUE7TUFDQSxhQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsRUFBQSxLQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0EsYUFBQSxDQUFBLFdBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0E7RUFDQTtBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsc0NBQUEsQ0FBQSx1QkFBQSxFQUFBO0VBRUEsSUFDQSx1QkFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLElBQ0EsUUFBQSxDQUFBLHVCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBLElBQ0EsUUFBQSxDQUFBLHVCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxFQUFBLEVBQ0E7SUFDQSxPQUFBLElBQUE7RUFDQTtFQUVBLE9BQUEsS0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG9DQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsSUFBQSxrQkFBQSxHQUFBLEVBQUE7RUFDQSxrQkFBQSxHQUFBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0VBRUEsSUFBQSxrQkFBQSxDQUFBLE1BQUEsRUFBQTtJQUFBO0lBQ0EsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLGtCQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO01BQUE7TUFDQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLGtCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7TUFDQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLGtCQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtNQUNBLElBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO1FBQ0Esa0JBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBO0lBQ0E7RUFDQTs7RUFFQTtFQUNBLGtCQUFBLEdBQUEsa0JBQUEsQ0FBQSxNQUFBLENBQUEsVUFBQSxDQUFBLEVBQUE7SUFBQSxPQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUE7RUFBQSxDQUFBLENBQUE7RUFFQSxrQkFBQSxDQUFBLElBQUEsQ0FBQSxDQUFBO0VBRUEsT0FBQSxrQkFBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsdURBQUEsQ0FBQSxXQUFBLEVBQUE7RUFBQSxJQUFBLHFCQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsUUFBQSxTQUFBLFFBQUEsU0FBQSxHQUFBLFNBQUEsTUFBQSxJQUFBO0VBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDQSxJQUFBLGVBQUEsR0FBQSxDQUNBLHdCQUFBLEdBQUEsV0FBQSxHQUFBLElBQUEsRUFDQSx3QkFBQSxHQUFBLFdBQUEsR0FBQSxNQUFBLEVBQ0Esd0JBQUEsR0FBQSxXQUFBLEdBQUEsSUFBQSxFQUNBLHdCQUFBLEdBQUEsV0FBQSxHQUFBLE1BQUEsRUFDQSxzQkFBQSxHQUFBLFdBQUEsR0FBQSxJQUFBLEVBQ0Esc0JBQUEsR0FBQSxXQUFBLEdBQUEsTUFBQSxFQUNBLDJCQUFBLEdBQUEsV0FBQSxHQUFBLElBQUEsRUFDQSwyQkFBQSxHQUFBLFdBQUEsR0FBQSxNQUFBLENBQ0E7RUFFQSxJQUFBLG1CQUFBLEdBQUEsRUFBQTs7RUFFQTtFQUNBLEtBQUEsSUFBQSxHQUFBLEdBQUEsQ0FBQSxFQUFBLEdBQUEsR0FBQSxlQUFBLENBQUEsTUFBQSxFQUFBLEdBQUEsRUFBQSxFQUFBO0lBRUEsSUFBQSxVQUFBLEdBQUEsZUFBQSxDQUFBLEdBQUEsQ0FBQTtJQUVBLElBQUEsV0FBQTtJQUNBLElBQUEscUJBQUEsRUFBQTtNQUNBLFdBQUEsR0FBQSxNQUFBLENBQUEsZUFBQSxHQUFBLFdBQUEsR0FBQSxHQUFBLEdBQUEsVUFBQSxHQUFBLGtCQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsQ0FBQSxNQUFBO01BQ0EsV0FBQSxHQUFBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsV0FBQSxHQUFBLEdBQUEsR0FBQSxVQUFBLEdBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBOztJQUdBO0lBQ0EsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLFdBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7TUFFQSxJQUFBLGFBQUEsR0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLElBQUEsd0JBQUEsR0FBQSxhQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO01BQ0EsSUFBQSxnQkFBQSxHQUFBLEVBQUE7O01BRUE7TUFDQSxJQUFBLHdCQUFBLENBQUEsTUFBQSxFQUFBO1FBQUE7UUFDQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsd0JBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7VUFBQTtVQUNBOztVQUVBLElBQUEsbUJBQUEsR0FBQSx3QkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtVQUVBLElBQUEsZUFBQSxHQUFBLFFBQUEsQ0FBQSxtQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxRQUFBLENBQUEsbUJBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUE7VUFFQSxnQkFBQSxDQUFBLElBQUEsQ0FBQSxlQUFBLENBQUE7UUFDQTtNQUNBO01BRUEsbUJBQUEsQ0FBQSxJQUFBLENBQUE7UUFDQSxNQUFBLEVBQUEsTUFBQSxDQUFBLGVBQUEsR0FBQSxXQUFBLEdBQUEsR0FBQSxHQUFBLFVBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxNQUFBLENBQUE7UUFDQSxrQkFBQSxFQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtRQUNBLGVBQUEsRUFBQSxhQUFBO1FBQ0Esa0JBQUEsRUFBQTtNQUNBLENBQUEsQ0FBQTtJQUNBO0VBQ0E7O0VBRUE7O0VBRUEsSUFBQSxvQkFBQSxHQUFBLENBQ0EsdUJBQUEsR0FBQSxXQUFBLEdBQUEsSUFBQSxFQUNBLHFCQUFBLEdBQUEsV0FBQSxHQUFBLElBQUEsQ0FDQTtFQUNBLEtBQUEsSUFBQSxFQUFBLEdBQUEsQ0FBQSxFQUFBLEVBQUEsR0FBQSxvQkFBQSxDQUFBLE1BQUEsRUFBQSxFQUFBLEVBQUEsRUFBQTtJQUVBLElBQUEsV0FBQSxHQUFBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsV0FBQSxHQUFBLEdBQUEsR0FBQSxvQkFBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLElBQUEsV0FBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLEVBQUE7TUFFQSxJQUFBLGNBQUEsR0FBQSxXQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0EsSUFBQSxDQUFBLElBQUEsY0FBQSxDQUFBLE1BQUEsRUFBQTtRQUNBLFNBQUEsQ0FBQTtNQUNBO01BQ0EsSUFBQSxDQUFBLElBQUEsY0FBQSxDQUFBLE1BQUEsRUFBQTtRQUNBLElBQUEsRUFBQSxLQUFBLGNBQUEsQ0FBQSxDQUFBLENBQUEsRUFBQTtVQUNBLFNBQUEsQ0FBQTtRQUNBO1FBQ0EsY0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUE7TUFDQTtNQUNBLElBQUEsb0JBQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsRUFBQTtNQUVBLElBQUEscUJBQUEsR0FBQSxFQUFBO01BQ0EscUJBQUEsQ0FBQSxJQUFBLENBQUEsb0JBQUEsQ0FBQTtNQUVBLG1CQUFBLENBQUEsSUFBQSxDQUFBO1FBQ0EsTUFBQSxFQUFBLFdBQUEsQ0FBQSxJQUFBLENBQUEsTUFBQSxDQUFBO1FBQ0Esa0JBQUEsRUFBQSxXQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7UUFDQSxlQUFBLEVBQUEsV0FBQTtRQUNBLGtCQUFBLEVBQUE7TUFDQSxDQUFBLENBQUE7SUFDQTtFQUNBO0VBRUEsT0FBQSxtQkFBQTtBQUNBOztBQUlBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx1QkFBQSxDQUFBLFdBQUEsRUFBQTtFQUVBLElBQUEsV0FBQSxLQUFBLE9BQUEsV0FBQSxFQUFBO0lBQ0EsV0FBQSxHQUFBLEdBQUE7RUFDQTtFQUVBLElBQUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsRUFBQTtJQUNBLE9BQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxRQUFBLENBQUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0E7RUFFQSxPQUFBLElBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGlDQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsSUFBQSxXQUFBLEtBQUEsT0FBQSxXQUFBLEVBQUE7SUFDQSxXQUFBLEdBQUEsR0FBQTtFQUNBO0VBRUEsSUFBQSxJQUFBLEdBQUEsdUJBQUEsQ0FBQSxXQUFBLENBQUE7RUFFQSxJQUFBLElBQUEsS0FBQSxJQUFBLEVBQUE7SUFFQTtJQUNBLE1BQUEsQ0FBQSxlQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsUUFBQSxHQUFBLEtBQUE7SUFDQSxJQUFBLENBQUEsS0FBQSxHQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxJQUFBLENBQUE7SUFFQSxPQUFBLElBQUE7RUFDQTtFQUVBLE9BQUEsS0FBQTtBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHVDQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsSUFBQSxXQUFBLEtBQUEsT0FBQSxXQUFBLEVBQUE7SUFFQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLEdBQUEsMkJBQUEsQ0FBQSxDQUFBLFdBQUEsQ0FBQSx5QkFBQSxDQUFBLENBQUEsQ0FBQTtFQUVBLENBQUEsTUFBQTtJQUNBLE1BQUEsQ0FBQSwwQkFBQSxDQUFBLENBQUEsV0FBQSxDQUFBLHlCQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx3QkFBQSxDQUFBLFdBQUEsRUFBQSxJQUFBLEVBQUEsS0FBQSxFQUFBO0VBRUEsSUFBQSxXQUFBLEtBQUEsT0FBQSxXQUFBLEVBQUE7SUFBQSxXQUFBLEdBQUEsR0FBQTtFQUFBO0VBQ0EsSUFBQSxJQUFBLEdBQUEsdUJBQUEsQ0FBQSxXQUFBLENBQUE7RUFDQSxJQUFBLElBQUEsS0FBQSxJQUFBLEVBQUE7SUFFQSxJQUFBLEdBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBLEtBQUEsR0FBQSxRQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7O0lBRUEsSUFBQSxDQUFBLFVBQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxDQUFBO0lBQ0E7SUFDQSxJQUFBLENBQUEsVUFBQSxDQUFBLFdBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxFQUFBLENBQUEsQ0FBQTtJQUNBLElBQUEsQ0FBQSxVQUFBLENBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQTtJQUNBLElBQUEsQ0FBQSxVQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtJQUVBLElBQUEsQ0FBQSxTQUFBLEdBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQTtJQUNBLElBQUEsQ0FBQSxRQUFBLEdBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQTtJQUVBLE1BQUEsQ0FBQSxRQUFBLENBQUEsYUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsZUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsU0FBQSxDQUFBLElBQUEsQ0FBQTtJQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsZUFBQSxDQUFBLElBQUEsQ0FBQTtJQUVBLE9BQUEsSUFBQTtFQUNBO0VBQ0EsT0FBQSxLQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDJCQUFBLENBQUEsV0FBQSxFQUFBLGFBQUEsRUFBQTtFQUVBO0VBQ0EsSUFBQSxpQkFBQSxHQUFBLEtBQUEsQ0FBQSxrQ0FBQSxDQUFBLFdBQUEsRUFBQSxhQUFBLENBQUE7RUFFQSxJQUFBLGlCQUFBLEdBQUEsUUFBQSxDQUFBLGlCQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQTtFQUVBLElBQUEsT0FBQSxpQkFBQSxDQUFBLFNBQUEsQ0FBQSxLQUFBLFdBQUEsRUFBQTtJQUNBLE9BQUEsaUJBQUE7RUFDQTtFQUVBLElBQUEsV0FBQSxJQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsZ0JBQUEsQ0FBQSxFQUFBO0lBRUEsSUFBQSw4QkFBQSxHQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSx5QkFBQSxDQUFBLENBQUEsQ0FBQTs7SUFFQSxRQUFBLGlCQUFBLENBQUEsU0FBQSxDQUFBLENBQUEscUJBQUEsQ0FBQTtNQUNBLEtBQUEsU0FBQTtNQUNBO01BQ0EsS0FBQSxpQkFBQTtNQUNBLEtBQUEsa0JBQUE7TUFDQSxLQUFBLGtCQUFBO1FBQ0EsaUJBQUEsR0FBQSxpQkFBQSxHQUFBLElBQUEsR0FBQSw4QkFBQTtRQUNBO01BQ0E7SUFDQTtFQUNBO0VBRUEsT0FBQSxpQkFBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxvQ0FBQSxDQUFBLGdCQUFBLEVBQUEsWUFBQSxFQUFBO0VBRUEsS0FBQSxJQUFBLFVBQUEsR0FBQSxDQUFBLEVBQUEsVUFBQSxHQUFBLFlBQUEsQ0FBQSxNQUFBLEVBQUEsVUFBQSxFQUFBLEVBQUE7SUFBQTtJQUNBLElBQUEsWUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLEtBQUEsZ0JBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxJQUNBLFlBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxLQUFBLGdCQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsSUFDQSxZQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsS0FBQSxnQkFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEVBQUE7TUFDQSxPQUFBLElBQUE7SUFDQTtFQUNBO0VBRUEsT0FBQSxLQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSx5QkFBQSxDQUFBLElBQUEsRUFBQTtFQUVBLElBQUEsYUFBQSxHQUFBLElBQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUE7RUFDQSxhQUFBLElBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxHQUFBLEdBQUEsRUFBQTtFQUNBLGFBQUEsSUFBQSxJQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEdBQUEsR0FBQTtFQUNBLGFBQUEsSUFBQSxJQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsR0FBQSxHQUFBLEVBQUE7RUFDQSxhQUFBLElBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBO0VBRUEsT0FBQSxhQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsa0JBQUEsQ0FBQSxjQUFBLEVBQUE7RUFFQSxJQUFBLGtCQUFBLEdBQUEsY0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7RUFFQSxJQUFBLE9BQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxDQUFBO0VBRUEsT0FBQSxDQUFBLFdBQUEsQ0FBQSxRQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLFFBQUEsQ0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLFFBQUEsQ0FBQSxrQkFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBOztFQUVBO0VBQ0EsT0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLE9BQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsT0FBQSxDQUFBLGVBQUEsQ0FBQSxDQUFBLENBQUE7RUFFQSxPQUFBLE9BQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHdCQUFBLENBQUEsSUFBQSxFQUFBO0VBRUEsSUFBQSxZQUFBLEdBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxJQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQSxPQUFBLFlBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsd0NBQUEsQ0FBQSxJQUFBLEVBQUEsU0FBQSxFQUFBO0VBRUEsU0FBQSxHQUFBLFdBQUEsS0FBQSxPQUFBLFNBQUEsR0FBQSxTQUFBLEdBQUEsR0FBQTtFQUVBLElBQUEsUUFBQSxHQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsU0FBQSxDQUFBO0VBQ0EsSUFBQSxRQUFBLEdBQUE7SUFDQSxNQUFBLEVBQUEsUUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLE9BQUEsRUFBQSxRQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQTtJQUNBLE1BQUEsRUFBQSxRQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLENBQUE7RUFDQSxPQUFBLFFBQUEsQ0FBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDZCQUFBLENBQUEsV0FBQSxFQUFBO0VBQ0EsSUFBQSxDQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxDQUFBLENBQUEsUUFBQSxDQUFBLDJCQUFBLENBQUEsRUFBQTtJQUNBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxvRkFBQSxDQUFBO0VBQ0E7RUFDQSxJQUFBLENBQUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsUUFBQSxDQUFBLDBCQUFBLENBQUEsRUFBQTtJQUNBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSwwQkFBQSxDQUFBO0VBQ0E7RUFDQSwwQkFBQSxDQUFBLFdBQUEsQ0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw0QkFBQSxDQUFBLFdBQUEsRUFBQTtFQUNBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsR0FBQSwrQkFBQSxDQUFBLENBQUEsTUFBQSxDQUFBLENBQUE7RUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxXQUFBLENBQUEsMEJBQUEsQ0FBQTtFQUNBLHlCQUFBLENBQUEsV0FBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDBCQUFBLENBQUEsV0FBQSxFQUFBO0VBQ0EsSUFBQSxDQUFBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSxvQkFBQSxDQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsb0JBQUEsQ0FBQTtFQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBO0VBQ0EsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxDQUFBLENBQUEsV0FBQSxDQUFBLG9CQUFBLENBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsMEJBQUEsQ0FBQSxXQUFBLEVBQUE7RUFFQSxJQUFBLElBQUEsR0FBQSx1QkFBQSxDQUFBLFdBQUEsQ0FBQTtFQUVBLE1BQUEsQ0FBQSxRQUFBLENBQUEsZUFBQSxDQUFBLElBQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsbUNBQUEsQ0FBQSxXQUFBLEVBQUEsYUFBQSxFQUFBO0VBQ0EsSUFBQSxJQUFBLEdBQUEsdUJBQUEsQ0FBQSxXQUFBLENBQUE7RUFDQSxJQUFBLElBQUEsS0FBQSxJQUFBLEVBQUE7SUFDQSxJQUFBLENBQUEsUUFBQSxDQUFBLGdCQUFBLENBQUEsR0FBQSxhQUFBO0lBQ0E7SUFDQSwwQkFBQSxDQUFBLFdBQUEsQ0FBQTtFQUNBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsMkJBQUEsQ0FBQSxpQkFBQSxFQUFBO0VBRUE7O0VBRUE7RUFDQSxJQUFBLFVBQUEsR0FBQSxRQUFBLENBQUEsY0FBQSxDQUFBLHdCQUFBLENBQUE7RUFDQSxVQUFBLENBQUEsVUFBQSxDQUFBLFdBQUEsQ0FBQSxVQUFBLENBQUE7O0VBR0E7RUFDQSxJQUFBLE1BQUEsR0FBQSxRQUFBLENBQUEsb0JBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLE9BQUEsR0FBQSxRQUFBLENBQUEsYUFBQSxDQUFBLE1BQUEsQ0FBQTtFQUNBLE9BQUEsQ0FBQSxJQUFBLEdBQUEsVUFBQTtFQUNBLE9BQUEsQ0FBQSxZQUFBLENBQUEsSUFBQSxFQUFBLHdCQUFBLENBQUE7RUFDQSxPQUFBLENBQUEsR0FBQSxHQUFBLFlBQUE7RUFDQSxPQUFBLENBQUEsS0FBQSxHQUFBLFFBQUE7RUFDQSxPQUFBLENBQUEsSUFBQSxHQUFBLGlCQUFBLENBQUEsQ0FBQTtFQUNBLE1BQUEsQ0FBQSxXQUFBLENBQUEsT0FBQSxDQUFBO0FBQ0E7QUFHQSxTQUFBLHNCQUFBLENBQUEsaUJBQUEsRUFBQTtFQUFBLElBQUEsYUFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsMkJBQUE7RUFFQTtFQUNBLElBQUEsVUFBQSxHQUFBLFFBQUEsQ0FBQSxjQUFBLENBQUEsYUFBQSxDQUFBO0VBQ0EsVUFBQSxDQUFBLFVBQUEsQ0FBQSxXQUFBLENBQUEsVUFBQSxDQUFBOztFQUdBO0VBQ0EsSUFBQSxNQUFBLEdBQUEsUUFBQSxDQUFBLG9CQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxPQUFBLEdBQUEsUUFBQSxDQUFBLGFBQUEsQ0FBQSxNQUFBLENBQUE7RUFDQSxPQUFBLENBQUEsSUFBQSxHQUFBLFVBQUE7RUFDQSxPQUFBLENBQUEsWUFBQSxDQUFBLElBQUEsRUFBQSxhQUFBLENBQUE7RUFDQSxPQUFBLENBQUEsR0FBQSxHQUFBLFlBQUE7RUFDQSxPQUFBLENBQUEsS0FBQSxHQUFBLFFBQUE7RUFDQSxPQUFBLENBQUEsSUFBQSxHQUFBLGlCQUFBLENBQUEsQ0FBQTtFQUNBLE1BQUEsQ0FBQSxXQUFBLENBQUEsT0FBQSxDQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGdDQUFBLENBQUEsU0FBQSxFQUFBO0VBRUEsSUFBQSxDQUFBLFNBQUEsSUFBQSxTQUFBLENBQUEsTUFBQSxLQUFBLENBQUEsRUFBQTtJQUNBLE9BQUEsRUFBQTtFQUNBO0VBRUEsSUFBQSxNQUFBLEdBQUEsRUFBQTtFQUNBLFNBQUEsQ0FBQSxJQUFBLENBQUEsVUFBQSxDQUFBLEVBQUEsQ0FBQSxFQUFBO0lBQ0EsT0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLENBQUEsQ0FBQTtFQUVBLElBQUEsY0FBQSxHQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUE7RUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtJQUNBLElBQUEsUUFBQSxHQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUE7SUFFQSxJQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxjQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7TUFDQSxjQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxjQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0EsQ0FBQSxNQUFBO01BQ0EsTUFBQSxDQUFBLElBQUEsQ0FBQSxjQUFBLENBQUE7TUFDQSxjQUFBLEdBQUEsUUFBQTtJQUNBO0VBQ0E7RUFFQSxNQUFBLENBQUEsSUFBQSxDQUFBLGNBQUEsQ0FBQTtFQUNBLE9BQUEsTUFBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw4QkFBQSxDQUFBLFVBQUEsRUFBQSxVQUFBLEVBQUE7RUFFQSxJQUNBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxJQUNBLENBQUEsSUFBQSxVQUFBLENBQUEsTUFBQSxFQUNBO0lBQ0EsT0FBQSxLQUFBO0VBQ0E7RUFFQSxVQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLFVBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxRQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsVUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxVQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUVBLElBQUEsY0FBQSxHQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQTtFQUNBO0VBQ0E7O0VBRUEsSUFBQSxjQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsT0FBQSxJQUFBLENBQUEsQ0FBQTtFQUNBO0VBRUEsT0FBQSxLQUFBLENBQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxpQ0FBQSxDQUFBLE9BQUEsRUFBQSxPQUFBLEVBQUE7RUFFQSxJQUFBLE9BQUEsQ0FBQSxNQUFBLElBQUEsQ0FBQSxFQUFBO0lBQUE7SUFDQSxPQUFBLE9BQUE7RUFDQTtFQUVBLElBQUEsR0FBQSxHQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxJQUFBLElBQUEsR0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLE9BQUEsR0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSxXQUFBLEdBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUEsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLE9BQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFDQSxHQUFBLEdBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtJQUVBLElBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxPQUFBLEdBQUEsR0FBQSxDQUFBLEdBQUEsSUFBQSxFQUFBO01BQUE7TUFDQSxJQUFBLEdBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxPQUFBLEdBQUEsR0FBQSxDQUFBO01BQ0EsV0FBQSxHQUFBLEdBQUE7SUFDQTtFQUNBO0VBRUEsT0FBQSxXQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHFDQUFBLENBQUEsWUFBQSxFQUFBLFdBQUEsRUFBQSxRQUFBLEVBQUE7RUFFQTs7RUFFQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxXQUFBLEdBQUEsZUFBQSxHQUFBLFFBQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxjQUFBLEVBQUEsWUFBQSxDQUFBO0VBRUEsSUFBQSxLQUFBLEdBQUEsTUFBQSxDQUFBLG1CQUFBLEdBQUEsV0FBQSxHQUFBLGVBQUEsR0FBQSxRQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTs7RUFFQSxJQUNBLFdBQUEsS0FBQSxPQUFBLEtBQUEsSUFDQSxTQUFBLElBQUEsS0FBQSxDQUFBLE1BQUEsSUFDQSxFQUFBLEtBQUEsWUFBQSxFQUNBO0lBRUEsVUFBQSxDQUFBLEtBQUEsRUFBQTtNQUNBLE9BQUEsV0FBQSxRQUFBLFNBQUEsRUFBQTtRQUVBLElBQUEsZUFBQSxHQUFBLFNBQUEsQ0FBQSxZQUFBLENBQUEsY0FBQSxDQUFBO1FBRUEsT0FBQSxxQ0FBQSxHQUNBLCtCQUFBLEdBQ0EsZUFBQSxHQUNBLFFBQUEsR0FDQSxRQUFBO01BQ0EsQ0FBQTtNQUNBLFNBQUEsRUFBQSxJQUFBO01BQ0EsT0FBQSxFQUFBLGtCQUFBO01BQ0EsV0FBQSxFQUFBLEtBQUE7TUFDQSxXQUFBLEVBQUEsSUFBQTtNQUNBLGlCQUFBLEVBQUEsRUFBQTtNQUNBLFFBQUEsRUFBQSxHQUFBO01BQ0EsS0FBQSxFQUFBLGtCQUFBO01BQ0EsU0FBQSxFQUFBLEtBQUE7TUFDQSxLQUFBLEVBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxDQUFBO01BQUE7TUFDQTtNQUNBLGdCQUFBLEVBQUEsSUFBQTtNQUNBLEtBQUEsRUFBQSxJQUFBO01BQUE7TUFDQSxRQUFBLEVBQUEsU0FBQSxTQUFBO1FBQUEsT0FBQSxRQUFBLENBQUEsSUFBQTtNQUFBO0lBQ0EsQ0FBQSxDQUFBO0lBRUEsT0FBQSxJQUFBO0VBQ0E7RUFFQSxPQUFBLEtBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHdCQUFBLENBQUEsS0FBQSxFQUFBLEtBQUEsRUFBQTtFQUVBO0VBQ0EsSUFBQSxPQUFBLEdBQUEsSUFBQSxHQUFBLEVBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQTs7RUFFQTtFQUNBLElBQUEsUUFBQSxHQUFBLEtBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsUUFBQSxHQUFBLEtBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTs7RUFFQTtFQUNBLElBQUEsYUFBQSxHQUFBLFFBQUEsR0FBQSxRQUFBOztFQUVBO0VBQ0EsT0FBQSxJQUFBLENBQUEsS0FBQSxDQUFBLGFBQUEsR0FBQSxPQUFBLENBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsMENBQUEsQ0FBQSxhQUFBLEVBQUE7RUFBQTs7RUFFQSxJQUFBLGFBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsSUFBQSxZQUFBLEdBQUEsa0JBQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxJQUFBLFlBQUE7SUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsYUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtNQUNBLFlBQUEsR0FBQSxrQkFBQSxDQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtNQUVBLElBQUEsd0JBQUEsQ0FBQSxZQUFBLEVBQUEsWUFBQSxDQUFBLElBQUEsQ0FBQSxFQUFBO1FBQ0EsT0FBQSxLQUFBO01BQ0E7TUFFQSxZQUFBLEdBQUEsWUFBQTtJQUNBO0VBQ0E7RUFFQSxPQUFBLElBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxrQ0FBQSxDQUFBLFdBQUEsRUFBQSxZQUFBLEVBQUE7RUFBQSxJQUFBLGFBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLEVBQUE7RUFBQTs7RUFFQSxPQUFBLENBQUEsR0FBQSxDQUFBLGdGQUFBLEVBQUEsV0FBQSxFQUFBLFlBQUEsRUFBQSxhQUFBLENBQUE7RUFFQSxJQUNBLFlBQUEsSUFBQSxZQUFBLElBQ0EsWUFBQSxJQUFBLGFBQUEsSUFDQSxFQUFBLElBQUEsWUFBQSxJQUFBLEVBQUEsSUFBQSxhQUFBLEVBQ0E7SUFDQSxPQUFBLENBQUE7RUFDQTs7RUFFQTtFQUNBO0VBQ0E7RUFDQSxJQUFBLG1CQUFBLEdBQUEsRUFBQTtFQUNBLElBQUEsS0FBQSxDQUFBLE9BQUEsQ0FBQSxZQUFBLENBQUEsRUFBQTtJQUNBLG1CQUFBLEdBQUEsY0FBQSxDQUFBLFlBQUEsQ0FBQTs7SUFFQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLElBQ0EsbUJBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxJQUNBLEVBQUEsSUFBQSxhQUFBLElBQ0EsQ0FBQSwwQ0FBQSxDQUFBLG1CQUFBLENBQUEsRUFDQTtNQUNBLDhCQUFBLENBQUEsV0FBQSxDQUFBO0lBQ0E7SUFDQTtJQUNBLElBQ0EsbUJBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxJQUNBLEVBQUEsSUFBQSxhQUFBLElBQ0EsUUFBQSxLQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLEVBQ0E7TUFDQSw4QkFBQSxDQUFBLFdBQUEsQ0FBQTtJQUNBO0lBQ0E7SUFDQSxZQUFBLEdBQUEsbUJBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQSxJQUFBLEVBQUEsSUFBQSxhQUFBLEVBQUE7TUFDQSxhQUFBLEdBQUEsbUJBQUEsQ0FBQSxtQkFBQSxDQUFBLE1BQUEsR0FBQSxDQUFBLENBQUE7SUFDQTtFQUNBO0VBQ0E7O0VBR0EsSUFBQSxFQUFBLElBQUEsWUFBQSxFQUFBO0lBQ0EsWUFBQSxHQUFBLGFBQUE7RUFDQTtFQUNBLElBQUEsRUFBQSxJQUFBLGFBQUEsRUFBQTtJQUNBLGFBQUEsR0FBQSxZQUFBO0VBQ0E7RUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLFdBQUEsRUFBQTtJQUNBLFdBQUEsR0FBQSxHQUFBO0VBQ0E7RUFHQSxJQUFBLElBQUEsR0FBQSx1QkFBQSxDQUFBLFdBQUEsQ0FBQTtFQUVBLElBQUEsSUFBQSxLQUFBLElBQUEsRUFBQTtJQUVBO0lBQ0EsTUFBQSxDQUFBLGVBQUEsR0FBQSxXQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLElBQUEsQ0FBQSxRQUFBLEdBQUEsS0FBQTtJQUNBLElBQUEsQ0FBQSxLQUFBLEdBQUEsRUFBQTtJQUNBLElBQUEsV0FBQSxHQUFBLGtCQUFBLENBQUEsWUFBQSxDQUFBO0lBQ0EsSUFBQSxPQUFBLEdBQUEsbUJBQUEsQ0FBQSxJQUFBLENBQUEsRUFBQSxFQUFBLFdBQUEsQ0FBQTs7SUFFQTtJQUNBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxrQkFBQSxDQUFBLEVBQUE7TUFDQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsa0JBQUEsRUFBQSxVQUFBLENBQUE7SUFDQTs7SUFHQTtJQUNBO0lBQ0EsSUFBQSxTQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtNQUNBO01BQ0EsSUFBQSxDQUFBLFFBQUEsR0FBQSxLQUFBO01BQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxVQUFBLENBQUEsT0FBQSxFQUFBLEdBQUEsR0FBQSxJQUFBLENBQUEsRUFBQSxFQUFBLFdBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0EsSUFBQSxDQUFBLEtBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7UUFDQSxPQUFBLENBQUEsQ0FBQSxDQUFBO01BQ0E7O01BRUE7TUFDQSxJQUFBLFlBQUEsR0FBQSxrQkFBQSxDQUFBLGFBQUEsQ0FBQTtNQUNBLElBQUEsV0FBQSxHQUFBLG1CQUFBLENBQUEsSUFBQSxDQUFBLEVBQUEsRUFBQSxZQUFBLENBQUE7TUFDQSxJQUFBLENBQUEsUUFBQSxHQUFBLElBQUE7TUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxXQUFBLEVBQUEsR0FBQSxHQUFBLElBQUEsQ0FBQSxFQUFBLEVBQUEsWUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0EsSUFBQSxPQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtNQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsVUFBQSxDQUFBLE9BQUEsRUFBQSxHQUFBLEdBQUEsSUFBQSxDQUFBLEVBQUEsRUFBQSxXQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBOztJQUVBO0lBQ0E7SUFDQSxJQUFBLFFBQUEsS0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsa0JBQUEsQ0FBQSxFQUFBO01BQ0E7TUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxPQUFBLEVBQUEsR0FBQSxHQUFBLElBQUEsQ0FBQSxFQUFBLEVBQUEsV0FBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUE7SUFDQTs7SUFFQTtJQUNBO0lBQ0EsSUFBQSxVQUFBLEtBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLGtCQUFBLENBQUEsRUFBQTtNQUVBLElBQUEsU0FBQTtNQUVBLElBQUEsbUJBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO1FBQ0E7UUFDQSxTQUFBLEdBQUEsNkNBQUEsQ0FBQSxtQkFBQSxDQUFBO01BQ0EsQ0FBQSxNQUFBO1FBQ0EsU0FBQSxHQUFBLHNEQUFBLENBQUEsWUFBQSxFQUFBLGFBQUEsRUFBQSxJQUFBLENBQUE7TUFDQTtNQUVBLElBQUEsQ0FBQSxLQUFBLFNBQUEsQ0FBQSxRQUFBLENBQUEsTUFBQSxFQUFBO1FBQ0EsT0FBQSxDQUFBO01BQ0E7O01BRUE7TUFDQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsU0FBQSxDQUFBLFFBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7UUFBQTs7UUFFQSxJQUFBLFFBQUEsR0FBQSx5QkFBQSxDQUFBLFNBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7O1FBRUE7UUFDQSxJQUFBLENBQUEsSUFBQSxLQUFBLENBQUEsa0NBQUEsQ0FBQSxXQUFBLEVBQUEsUUFBQSxDQUFBLENBQUEsZ0JBQUEsRUFBQTtVQUNBLE9BQUEsQ0FBQTtRQUNBO1FBRUEsSUFBQSxTQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxFQUFBO1VBQ0EsSUFBQSxDQUFBLEtBQUEsQ0FBQSxJQUFBLENBQUEsU0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtRQUNBO01BQ0E7TUFFQSxJQUFBLGNBQUEsR0FBQSxTQUFBLENBQUEsUUFBQSxDQUFBLFNBQUEsQ0FBQSxRQUFBLENBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQTtNQUVBLElBQUEsQ0FBQSxLQUFBLENBQUEsSUFBQSxDQUFBLGNBQUEsQ0FBQSxDQUFBLENBQUE7O01BRUEsSUFBQSxrQkFBQSxHQUFBLGNBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtNQUNBLElBQUEsT0FBQSxHQUFBLG1CQUFBLENBQUEsSUFBQSxDQUFBLEVBQUEsRUFBQSxjQUFBLENBQUE7TUFFQSxNQUFBLENBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxPQUFBLEVBQUEsR0FBQSxHQUFBLElBQUEsQ0FBQSxFQUFBLEVBQUEsa0JBQUEsQ0FBQTtJQUNBO0lBR0EsSUFBQSxDQUFBLEtBQUEsSUFBQSxDQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7TUFDQTtNQUNBLHdCQUFBLENBQUEsV0FBQSxFQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsRUFBQSxJQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0lBQ0E7SUFFQSxPQUFBLElBQUEsQ0FBQSxLQUFBLENBQUEsTUFBQTtFQUNBO0VBRUEsT0FBQSxDQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG1CQUFBLENBQUEsZ0JBQUEsRUFBQSxPQUFBLEVBQUE7RUFFQSxJQUFBLE9BQUEsR0FBQSxNQUFBLENBQUEsR0FBQSxHQUFBLGdCQUFBLEdBQUEsYUFBQSxHQUFBLHlCQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBO0VBRUEsT0FBQSxPQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsc0RBQUEsQ0FBQSxZQUFBLEVBQUEsYUFBQSxFQUFBLElBQUEsRUFBQTtFQUVBLElBQUEsY0FBQSxHQUFBLEVBQUE7RUFDQSxJQUFBLElBQUE7RUFDQSxJQUFBLGlCQUFBLEdBQUEsRUFBQTtFQUVBLElBQUEsYUFBQSxHQUFBLFlBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0VBQ0EsSUFBQSxjQUFBLEdBQUEsYUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7RUFFQSxJQUFBLEdBQUEsSUFBQSxJQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsQ0FBQSxXQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxFQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsc0JBQUEsR0FBQSxJQUFBO0VBQ0EsY0FBQSxDQUFBLElBQUEsQ0FBQSxNQUFBLENBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxJQUFBLEVBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxjQUFBLENBQUEsSUFBQSxFQUFBLElBQUEsRUFBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsQ0FBQSxhQUFBLENBQUEsaUJBQUEsRUFBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7SUFDQSxpQkFBQSxDQUFBLElBQUEsQ0FBQSxRQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLFFBQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0E7RUFFQSxJQUFBLFFBQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxDQUFBO0VBQ0EsUUFBQSxDQUFBLFdBQUEsQ0FBQSxjQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUEsY0FBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxjQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsSUFBQSx1QkFBQSxHQUFBLFFBQUE7RUFFQSxJQUFBLE9BQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxzQkFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLEVBQUEsc0JBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxFQUFBLHNCQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLE9BQUEsQ0FBQSxPQUFBLENBQUEsc0JBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQTtFQUVBLE9BQ0EsdUJBQUEsR0FBQSxJQUFBLElBQ0Esc0JBQUEsSUFBQSx1QkFBQSxFQUFBO0lBQ0EsSUFBQSxHQUFBLElBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxFQUFBLE9BQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxFQUFBLE9BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBO0lBRUEsY0FBQSxDQUFBLElBQUEsQ0FBQSxNQUFBLENBQUEsUUFBQSxDQUFBLGVBQUEsQ0FBQSxJQUFBLEVBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxjQUFBLENBQUEsSUFBQSxFQUFBLElBQUEsRUFBQSxJQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLElBQUEsQ0FBQSxhQUFBLENBQUEsaUJBQUEsRUFBQSxJQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLEdBQUEsR0FBQSxJQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsQ0FBQSxFQUFBO01BQ0EsaUJBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxDQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLFFBQUEsQ0FBQSxJQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLENBQUE7SUFDQTtJQUVBLE9BQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxJQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsRUFBQSxJQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsRUFBQSxJQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQTtJQUNBLE9BQUEsQ0FBQSxPQUFBLENBQUEsT0FBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0VBQ0E7RUFDQSxjQUFBLENBQUEsR0FBQSxDQUFBLENBQUE7RUFDQSxpQkFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBO0VBRUEsT0FBQTtJQUFBLFVBQUEsRUFBQSxjQUFBO0lBQUEsV0FBQSxFQUFBO0VBQUEsQ0FBQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw2Q0FBQSxDQUFBLG1CQUFBLEVBQUE7RUFBQTs7RUFFQSxJQUFBLGNBQUEsR0FBQSxFQUFBO0VBQ0EsSUFBQSxpQkFBQSxHQUFBLEVBQUE7RUFDQSxJQUFBLFlBQUE7RUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsbUJBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFFQSxjQUFBLENBQUEsSUFBQSxDQUFBLGtCQUFBLENBQUEsbUJBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0lBRUEsWUFBQSxHQUFBLG1CQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtJQUNBLElBQUEsQ0FBQSxhQUFBLENBQUEsaUJBQUEsRUFBQSxZQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLFlBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUE7TUFDQSxpQkFBQSxDQUFBLElBQUEsQ0FBQSxRQUFBLENBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsR0FBQSxHQUFBLFFBQUEsQ0FBQSxZQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxHQUFBLEdBQUEsWUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0lBQ0E7RUFDQTtFQUVBLE9BQUE7SUFBQSxVQUFBLEVBQUEsY0FBQTtJQUFBLFdBQUEsRUFBQTtFQUFBLENBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxZQUFBO0VBRUEsSUFBQSxVQUFBLEdBQUEsSUFBQSxlQUFBLENBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxNQUFBLENBQUE7O0VBRUE7RUFDQSxJQUFBLElBQUEsSUFBQSxLQUFBLENBQUEsZUFBQSxDQUFBLCtDQUFBLENBQUEsRUFBQTtJQUNBLElBQ0EsVUFBQSxDQUFBLEdBQUEsQ0FBQSxzQkFBQSxDQUFBLElBQ0EsVUFBQSxDQUFBLEdBQUEsQ0FBQSx1QkFBQSxDQUFBLElBQ0EsVUFBQSxDQUFBLEdBQUEsQ0FBQSx5QkFBQSxDQUFBLEVBQ0E7TUFFQSxJQUFBLDJCQUFBLEdBQUEsUUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLENBQUEseUJBQUEsQ0FBQSxDQUFBOztNQUVBO01BQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxnQ0FBQSxFQUFBLFVBQUEsS0FBQSxFQUFBLGtCQUFBLEVBQUE7UUFFQSxJQUFBLGtCQUFBLElBQUEsMkJBQUEsRUFBQTtVQUNBLGtDQUFBLENBQUEsMkJBQUEsRUFBQSxVQUFBLENBQUEsR0FBQSxDQUFBLHNCQUFBLENBQUEsRUFBQSxVQUFBLENBQUEsR0FBQSxDQUFBLHVCQUFBLENBQUEsQ0FBQTtRQUNBO01BQ0EsQ0FBQSxDQUFBO0lBQ0E7RUFDQTtFQUVBLElBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSxnQkFBQSxDQUFBLEVBQUE7SUFFQSxJQUFBLG9CQUFBLEdBQUEsVUFBQSxDQUFBLEdBQUEsQ0FBQSxnQkFBQSxDQUFBOztJQUVBO0lBQ0Esb0JBQUEsR0FBQSxvQkFBQSxDQUFBLFVBQUEsQ0FBQSxLQUFBLEVBQUEsR0FBQSxDQUFBO0lBRUEsNkJBQUEsQ0FBQSxvQkFBQSxDQUFBO0VBQ0E7QUFFQSxDQUFBLENBQUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsNkJBQUEsQ0FBQSxhQUFBLEVBQUE7RUFBQTs7RUFFQSxJQUFBLEVBQUEsSUFBQSxhQUFBLEVBQUE7SUFDQTtFQUNBOztFQUVBOztFQUVBLElBQUEsVUFBQSxHQUFBLG9DQUFBLENBQUEsYUFBQSxDQUFBO0VBRUEsS0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLEVBQUEsQ0FBQSxHQUFBLFVBQUEsQ0FBQSxNQUFBLEVBQUEsQ0FBQSxFQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsU0FBQSxHQUFBLFVBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxJQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBO0VBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLG9DQUFBLENBQUEsUUFBQSxFQUFBO0VBRUEsSUFBQSxrQkFBQSxHQUFBLEVBQUE7RUFFQSxJQUFBLFFBQUEsR0FBQSxRQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQTtFQUVBLEtBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxRQUFBLENBQUEsTUFBQSxFQUFBLENBQUEsRUFBQSxFQUFBO0lBRUEsSUFBQSxhQUFBLEdBQUEsUUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7SUFFQSxJQUFBLFdBQUEsR0FBQSxXQUFBLEtBQUEsT0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUE7SUFDQSxJQUFBLFlBQUEsR0FBQSxXQUFBLEtBQUEsT0FBQSxhQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLEVBQUE7SUFFQSxrQkFBQSxDQUFBLElBQUEsQ0FDQTtNQUNBLE1BQUEsRUFBQSxXQUFBO01BQ0EsT0FBQSxFQUFBO0lBQ0EsQ0FDQSxDQUFBO0VBQ0E7RUFDQSxPQUFBLGtCQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxtQ0FBQSxDQUFBLFFBQUEsRUFBQTtFQUVBLElBQUEsa0JBQUEsR0FBQSxFQUFBO0VBRUEsSUFBQSxRQUFBLEdBQUEsUUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUE7RUFFQSxLQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsRUFBQSxDQUFBLEdBQUEsUUFBQSxDQUFBLE1BQUEsRUFBQSxDQUFBLEVBQUEsRUFBQTtJQUVBLElBQUEsYUFBQSxHQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxDQUFBO0lBRUEsSUFBQSxXQUFBLEdBQUEsV0FBQSxLQUFBLE9BQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBO0lBQ0EsSUFBQSxXQUFBLEdBQUEsV0FBQSxLQUFBLE9BQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBO0lBQ0EsSUFBQSxZQUFBLEdBQUEsV0FBQSxLQUFBLE9BQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUEsR0FBQSxFQUFBO0lBRUEsa0JBQUEsQ0FBQSxJQUFBLENBQ0E7TUFDQSxNQUFBLEVBQUEsV0FBQTtNQUNBLE1BQUEsRUFBQSxXQUFBO01BQ0EsT0FBQSxFQUFBO0lBQ0EsQ0FDQSxDQUFBO0VBQ0E7RUFDQSxPQUFBLGtCQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsbURBQUEsQ0FBQSxXQUFBLEVBQUE7RUFFQSxJQUFBLElBQUEsS0FBQSxLQUFBLENBQUEsZUFBQSxDQUFBLG1DQUFBLENBQUEsRUFBQTtJQUNBLE9BQUEsS0FBQTtFQUNBO0VBRUEsSUFBQSx1QkFBQSxHQUFBLFFBQUEsQ0FBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsMkJBQUEsQ0FBQSxDQUFBO0VBRUEsSUFBQSx1QkFBQSxHQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxDQUFBLElBQUEsR0FBQSxFQUFBO01BQ0EsbUNBQUEsQ0FBQSxXQUFBLEVBQUEsQ0FBQSxDQUFBO0lBQ0EsQ0FBQSxNQUFBO01BQ0EsbUNBQUEsQ0FBQSxXQUFBLEVBQUEsdUJBQUEsQ0FBQTtJQUNBO0VBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEseUNBQUEsQ0FBQSxFQUFBO0VBRUEsSUFBQSxpQkFBQSxHQUFBLEtBQUEsQ0FBQSxrQkFBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxLQUFBLElBQUEsV0FBQSxJQUFBLGlCQUFBLEVBQUE7SUFDQSxJQUFBLFdBQUEsS0FBQSxXQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsRUFBQTtNQUNBLElBQUEsV0FBQSxHQUFBLFFBQUEsQ0FBQSxXQUFBLENBQUEsS0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtNQUNBLElBQUEsV0FBQSxHQUFBLENBQUEsRUFBQTtRQUNBLG1EQUFBLENBQUEsV0FBQSxDQUFBO01BQ0E7SUFDQTtFQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxRQUFBLEVBQUEsWUFBQTtFQUNBLHlDQUFBLENBQUEsQ0FBQTtBQUNBLENBQUEsQ0FBQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLFlBQUE7RUFDQSxJQUFBLFlBQUEsR0FBQSxVQUFBLENBQUEsWUFBQTtJQUNBLHlDQUFBLENBQUEsQ0FBQTtFQUNBLENBQUEsRUFBQSxHQUFBLENBQUE7QUFDQSxDQUFBLENBQUE7QUN2L0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsaUJBQUEsQ0FBQSxXQUFBLEVBQUE7RUFFQTtFQUNBLE1BQUEsQ0FBQSxtQkFBQSxHQUFBLFdBQUEsQ0FBQSxDQUFBLFdBQUEsQ0FBQSxhQUFBLENBQUE7RUFDQSxrQkFBQSxDQUFBLFdBQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDZCQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLHNDQUFBLEVBQ0E7SUFDQSxtQkFBQSxFQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxtQkFBQSxDQUFBO0lBQ0EsbUJBQUEsRUFBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsbUJBQUEsQ0FBQTtJQUNBLHdCQUFBLEVBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLHdCQUFBLENBQUE7SUFDQSwyQkFBQSxFQUFBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSwyQkFBQSxDQUFBO0lBQ0EsaUJBQUEsRUFBQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsaUJBQUEsQ0FBQTtJQUNBLHlCQUFBLEVBQUEsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLHlCQUFBO0VBQ0EsQ0FDQSxDQUFBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsa0NBQUEsQ0FBQSxXQUFBLEVBQUE7RUFFQTtFQUNBLE1BQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsWUFBQTtJQUVBO0lBQ0EsVUFBQSxDQUFBLFlBQUE7TUFFQSw0QkFBQSxDQUFBLFdBQUEsQ0FBQTtJQUVBLENBQUEsRUFBQSxJQUFBLENBQUE7RUFDQSxDQUFBLENBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLDRCQUFBLENBQUEsV0FBQSxFQUFBO0VBRUEsS0FBQSxDQUFBLHdCQUFBLENBQUEsV0FBQSxFQUFBO0lBQUEsa0JBQUEsRUFBQTtFQUFBLENBQUEsQ0FBQTtFQUVBLDZCQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsaUJBQUEsQ0FBQSxXQUFBLENBQUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxvQ0FBQSxDQUFBLFdBQUEsRUFBQTtFQUVBO0VBQ0EsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLEtBQUEsQ0FBQSxZQUFBO0lBRUE7SUFDQSxVQUFBLENBQUEsWUFBQTtNQUVBLDhCQUFBLENBQUEsV0FBQSxDQUFBO0lBRUEsQ0FBQSxFQUFBLElBQUEsQ0FBQTtFQUNBLENBQUEsQ0FBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsOEJBQUEsQ0FBQSxXQUFBLEVBQUE7RUFFQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUE7SUFBQSxrQkFBQSxFQUFBO0VBQUEsQ0FBQSxDQUFBO0VBRUEsNkJBQUEsQ0FBQSxXQUFBLENBQUE7RUFDQSxpQkFBQSxDQUFBLFdBQUEsQ0FBQTtBQUNBOztBQUdBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxpQ0FBQSxDQUFBLFdBQUEsRUFBQSxXQUFBLEVBQUE7RUFBQSxJQUFBLGdCQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsUUFBQSxTQUFBLFFBQUEsU0FBQSxHQUFBLFNBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBRUE7RUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLFlBQUE7SUFFQTtJQUNBLFVBQUEsQ0FBQSxZQUFBO01BRUEsMkJBQUEsQ0FBQSxXQUFBLEVBQUEsV0FBQSxFQUFBLGdCQUFBLENBQUE7SUFFQSxDQUFBLEVBQUEsSUFBQSxDQUFBO0VBQ0EsQ0FBQSxDQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsMkJBQUEsQ0FBQSxXQUFBLEVBQUEsV0FBQSxFQUFBO0VBQUEsSUFBQSxnQkFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUVBLEtBQUEsQ0FBQSx3QkFBQSxDQUFBLFdBQUEsRUFBQTtJQUFBLGtCQUFBLEVBQUE7RUFBQSxDQUFBLENBQUE7RUFFQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUE7SUFBQSxpQkFBQSxFQUFBLFFBQUEsQ0FBQSxXQUFBO0VBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLEtBQUEsQ0FBQSx3QkFBQSxDQUFBLFdBQUEsRUFBQTtJQUFBLHlCQUFBLEVBQUE7RUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBOztFQUVBLDZCQUFBLENBQUEsV0FBQSxDQUFBO0VBQ0EsaUJBQUEsQ0FBQSxXQUFBLENBQUE7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGlDQUFBLENBQUEsV0FBQSxFQUFBLFFBQUEsRUFBQSxRQUFBLEVBQUE7RUFBQSxJQUFBLGFBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLEVBQUE7RUFBQSxJQUFBLGdCQUFBLEdBQUEsU0FBQSxDQUFBLE1BQUEsUUFBQSxTQUFBLFFBQUEsU0FBQSxHQUFBLFNBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxDQUFBO0VBRUE7RUFDQSxNQUFBLENBQUEsUUFBQSxDQUFBLENBQUEsS0FBQSxDQUFBLFlBQUE7SUFFQTtJQUNBLFVBQUEsQ0FBQSxZQUFBO01BRUEsMkJBQUEsQ0FBQSxXQUFBLEVBQUEsUUFBQSxFQUFBLFFBQUEsRUFBQSxhQUFBLEVBQUEsZ0JBQUEsQ0FBQTtJQUNBLENBQUEsRUFBQSxJQUFBLENBQUE7RUFDQSxDQUFBLENBQUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsMkJBQUEsQ0FBQSxXQUFBLEVBQUEsUUFBQSxFQUFBLFFBQUEsRUFBQTtFQUFBLElBQUEsYUFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsRUFBQTtFQUFBLElBQUEsZ0JBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFFQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxXQUFBLEVBQUE7SUFBQSxrQkFBQSxFQUFBO0VBQUEsQ0FBQSxDQUFBO0VBQ0EsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLG1CQUFBLEVBQUEsUUFBQSxDQUFBLFFBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQTtFQUNBLEtBQUEsQ0FBQSx5QkFBQSxDQUFBLFdBQUEsRUFBQSxtQkFBQSxFQUFBLFFBQUEsQ0FBQSxRQUFBLENBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQSxLQUFBLENBQUEseUJBQUEsQ0FBQSxXQUFBLEVBQUEsd0JBQUEsRUFBQSxhQUFBLENBQUEsQ0FBQSxDQUFBO0VBQ0EsS0FBQSxDQUFBLHlCQUFBLENBQUEsV0FBQSxFQUFBLDJCQUFBLEVBQUEsZ0JBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUEsNkJBQUEsQ0FBQSxXQUFBLENBQUE7RUFDQSxpQkFBQSxDQUFBLFdBQUEsQ0FBQTtBQUNBOztBQ3ZNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQSxTQUFBLDZCQUFBLENBQUEsTUFBQSxFQUFBO0VBRUE7RUFDQSw2QkFBQSxDQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQTtFQUNBLElBQUEsc0JBQUEsQ0FBQSxNQUFBLEVBQUEsK0JBQUEsQ0FBQSxFQUFBO0lBQ0EsT0FBQSxLQUFBO0VBQ0E7O0VBRUE7RUFDQSx5QkFBQSxDQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQTs7RUFHQTtFQUNBLE9BQUEsQ0FBQSxjQUFBLENBQUEsd0JBQUEsQ0FBQTtFQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUEsaURBQUEsRUFBQSxLQUFBLENBQUEsa0JBQUEsQ0FBQSxDQUFBLENBQUE7O0VBRUE7RUFDQSxNQUFBLENBQUEsSUFBQSxDQUFBLGFBQUEsRUFDQTtJQUNBLE1BQUEsRUFBQSx3QkFBQTtJQUNBLGdCQUFBLEVBQUEsS0FBQSxDQUFBLGdCQUFBLENBQUEsU0FBQSxDQUFBO0lBQ0EsS0FBQSxFQUFBLEtBQUEsQ0FBQSxnQkFBQSxDQUFBLE9BQUEsQ0FBQTtJQUNBLGVBQUEsRUFBQSxLQUFBLENBQUEsZ0JBQUEsQ0FBQSxRQUFBLENBQUE7SUFFQSx1QkFBQSxFQUFBLE1BQUEsQ0FBQTtFQUNBLENBQUE7RUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNBLFVBQUEsYUFBQSxFQUFBLFVBQUEsRUFBQSxLQUFBLEVBQUE7SUFDQTtJQUNBLE9BQUEsQ0FBQSxHQUFBLENBQUEseUNBQUEsRUFBQSxhQUFBLENBQUE7SUFBQSxPQUFBLENBQUEsUUFBQSxDQUFBLENBQUE7O0lBRUE7SUFDQSxJQUFBLDBCQUFBLEdBQUEsNENBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBO0lBQ0Esd0JBQUEsQ0FBQSwwQkFBQSxFQUFBLCtCQUFBLENBQUE7O0lBRUE7SUFDQSxJQUFBLE9BQUEsQ0FBQSxhQUFBLE1BQUEsUUFBQSxJQUFBLGFBQUEsS0FBQSxJQUFBLEVBQUE7TUFFQSxJQUFBLE9BQUEsR0FBQSx3Q0FBQSxDQUFBLElBQUEsQ0FBQSxJQUFBLENBQUE7TUFDQSxJQUFBLFlBQUEsR0FBQSxNQUFBO01BRUEsSUFBQSxFQUFBLEtBQUEsYUFBQSxFQUFBO1FBQ0EsYUFBQSxHQUFBLGdNQUFBO1FBQ0EsWUFBQSxHQUFBLFNBQUE7TUFDQTs7TUFFQTtNQUNBLDRCQUFBLENBQUEsYUFBQSxFQUFBO1FBQUEsTUFBQSxFQUFBLFlBQUE7UUFDQSxXQUFBLEVBQUE7VUFBQSxTQUFBLEVBQUEsT0FBQTtVQUFBLE9BQUEsRUFBQTtRQUFBLENBQUE7UUFDQSxXQUFBLEVBQUEsSUFBQTtRQUNBLE9BQUEsRUFBQSxrQkFBQTtRQUNBLE9BQUEsRUFBQTtNQUNBLENBQUEsQ0FBQTtNQUNBO0lBQ0E7O0lBRUE7SUFDQSw0QkFBQSxDQUFBLGFBQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQTs7SUFFQTtJQUNBO0lBQ0EsS0FBQSxDQUFBLCtCQUFBLENBQUEsYUFBQSxDQUFBLGFBQUEsQ0FBQSxFQUFBLGFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTs7SUFFQTtJQUNBLEtBQUEsQ0FBQSx3QkFBQSxDQUFBLGFBQUEsQ0FBQSxhQUFBLENBQUEsRUFBQSw0QkFBQSxFQUFBLGFBQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSw0QkFBQSxDQUFBLENBQUE7O0lBRUE7SUFDQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxhQUFBLENBQUEsYUFBQSxDQUFBLEVBQUEsMkJBQUEsRUFBQSxhQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsMkJBQUEsQ0FBQSxDQUFBO0lBQ0E7O0lBRUE7SUFDQSwwQkFBQSxDQUFBLGFBQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQTtJQUdBLElBQ0EsV0FBQSxLQUFBLE9BQUEsYUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLDBCQUFBLENBQUEsSUFDQSxFQUFBLElBQUEsYUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLDBCQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsS0FBQSxFQUFBLFFBQUEsQ0FBQSxFQUNBO01BRUEsSUFBQSxPQUFBLEdBQUEsd0NBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBOztNQUVBO01BQ0EsNEJBQUEsQ0FBQSxhQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsMEJBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxLQUFBLEVBQUEsUUFBQSxDQUFBLEVBQ0E7UUFBQSxNQUFBLEVBQUEsV0FBQSxLQUFBLE9BQUEsYUFBQSxDQUFBLFVBQUEsQ0FBQSxDQUFBLGlDQUFBLENBQUEsR0FDQSxhQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsaUNBQUEsQ0FBQSxHQUFBLE1BQUE7UUFDQSxXQUFBLEVBQUE7VUFBQSxTQUFBLEVBQUEsT0FBQTtVQUFBLE9BQUEsRUFBQTtRQUFBLENBQUE7UUFDQSxXQUFBLEVBQUEsSUFBQTtRQUNBLE9BQUEsRUFBQSxrQkFBQTtRQUNBLE9BQUEsRUFBQTtNQUNBLENBQUEsQ0FBQTtJQUNBOztJQUVBO0lBQ0EsSUFBQSxNQUFBLENBQUEsbUJBQUEsR0FBQSxhQUFBLENBQUEsYUFBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO01BQ0EsSUFBQSxVQUFBLEdBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxnQ0FBQSxFQUFBLENBQUEsYUFBQSxDQUFBLGFBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQTtJQUNBOztJQUVBO0VBQ0EsQ0FDQSxDQUFBLENBQUEsSUFBQSxDQUFBLFVBQUEsS0FBQSxFQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUE7SUFBQSxJQUFBLE1BQUEsQ0FBQSxPQUFBLElBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLEVBQUE7TUFBQSxPQUFBLENBQUEsR0FBQSxDQUFBLFlBQUEsRUFBQSxLQUFBLEVBQUEsVUFBQSxFQUFBLFdBQUEsQ0FBQTtJQUFBO0lBRUEsSUFBQSwwQkFBQSxHQUFBLDRDQUFBLENBQUEsSUFBQSxDQUFBLElBQUEsQ0FBQTtJQUNBLHdCQUFBLENBQUEsMEJBQUEsRUFBQSwrQkFBQSxDQUFBOztJQUVBO0lBQ0EsSUFBQSxhQUFBLEdBQUEsVUFBQSxHQUFBLFFBQUEsR0FBQSxZQUFBLEdBQUEsV0FBQTtJQUNBLElBQUEsS0FBQSxDQUFBLE1BQUEsRUFBQTtNQUNBLGFBQUEsSUFBQSxPQUFBLEdBQUEsS0FBQSxDQUFBLE1BQUEsR0FBQSxPQUFBO01BQ0EsSUFBQSxHQUFBLElBQUEsS0FBQSxDQUFBLE1BQUEsRUFBQTtRQUNBLGFBQUEsSUFBQSxzSkFBQTtRQUNBLGFBQUEsSUFBQSxzTUFBQTtNQUNBO0lBQ0E7SUFDQSxJQUFBLGtCQUFBLEdBQUEsSUFBQTtJQUNBLElBQUEsS0FBQSxDQUFBLFlBQUEsRUFBQTtNQUNBLGFBQUEsSUFBQSxHQUFBLEdBQUEsS0FBQSxDQUFBLFlBQUE7TUFDQSxrQkFBQSxHQUFBLEVBQUE7SUFDQTtJQUNBLGFBQUEsR0FBQSxhQUFBLENBQUEsT0FBQSxDQUFBLEtBQUEsRUFBQSxRQUFBLENBQUE7SUFFQSxJQUFBLE9BQUEsR0FBQSx3Q0FBQSxDQUFBLElBQUEsQ0FBQSxJQUFBLENBQUE7O0lBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtJQUNBLElBQUEsWUFBQSxHQUFBLFVBQUEsQ0FBQSxZQUFBO01BRUE7TUFDQSw0QkFBQSxDQUFBLGFBQUEsRUFBQTtRQUFBLE1BQUEsRUFBQSxPQUFBO1FBQ0EsV0FBQSxFQUFBO1VBQUEsU0FBQSxFQUFBLE9BQUE7VUFBQSxPQUFBLEVBQUE7UUFBQSxDQUFBO1FBQ0EsV0FBQSxFQUFBLElBQUE7UUFDQSxPQUFBLEVBQUEsa0JBQUE7UUFDQSxXQUFBLEVBQUEscUJBQUE7UUFDQSxPQUFBLEVBQUE7TUFDQSxDQUFBLENBQUE7SUFDQSxDQUFBLEVBQ0EsUUFBQSxDQUFBLGtCQUFBLENBQUEsQ0FBQTtFQUVBLENBQUE7RUFDQTtFQUNBO0VBQUEsQ0FDQSxDQUFBO0FBQ0E7O0FBSUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsd0NBQUEsQ0FBQSx3QkFBQSxFQUFBO0VBRUEsSUFBQSxPQUFBLEdBQUEsbUJBQUE7RUFFQSxJQUFBLG9CQUFBLEdBQUEsNENBQUEsQ0FBQSx3QkFBQSxDQUFBO0VBRUEsSUFBQSxvQkFBQSxHQUFBLENBQUEsRUFBQTtJQUNBLE9BQUEsR0FBQSxtQkFBQSxHQUFBLG9CQUFBO0VBQ0E7RUFFQSxPQUFBLE9BQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw0Q0FBQSxDQUFBLHdCQUFBLEVBQUE7RUFFQTtFQUNBLElBQUEsb0JBQUEsR0FBQSwwQkFBQSxDQUFBLHNDQUFBLEVBQUEsd0JBQUEsQ0FBQTtFQUNBLElBQUEsSUFBQSxLQUFBLG9CQUFBLElBQUEsRUFBQSxLQUFBLG9CQUFBLEVBQUE7SUFDQSxvQkFBQSxHQUFBLFFBQUEsQ0FBQSxvQkFBQSxDQUFBO0lBQ0EsSUFBQSxvQkFBQSxHQUFBLENBQUEsRUFBQTtNQUNBLE9BQUEsb0JBQUE7SUFDQTtFQUNBO0VBQ0EsT0FBQSxDQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsMEJBQUEsQ0FBQSxJQUFBLEVBQUEsR0FBQSxFQUFBO0VBRUEsR0FBQSxHQUFBLGtCQUFBLENBQUEsR0FBQSxDQUFBO0VBRUEsSUFBQSxHQUFBLElBQUEsQ0FBQSxPQUFBLENBQUEsU0FBQSxFQUFBLE1BQUEsQ0FBQTtFQUNBLElBQUEsS0FBQSxHQUFBLElBQUEsTUFBQSxDQUFBLE1BQUEsR0FBQSxJQUFBLEdBQUEsbUJBQUEsQ0FBQTtJQUNBLE9BQUEsR0FBQSxLQUFBLENBQUEsSUFBQSxDQUFBLEdBQUEsQ0FBQTtFQUNBLElBQUEsQ0FBQSxPQUFBLEVBQUEsT0FBQSxJQUFBO0VBQ0EsSUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLENBQUEsRUFBQSxPQUFBLEVBQUE7RUFDQSxPQUFBLGtCQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxLQUFBLEVBQUEsR0FBQSxDQUFBLENBQUE7QUFDQTs7QUN4T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSw0QkFBQSxDQUFBLE9BQUEsRUFBQTtFQUFBLElBQUEsTUFBQSxHQUFBLFNBQUEsQ0FBQSxNQUFBLFFBQUEsU0FBQSxRQUFBLFNBQUEsR0FBQSxTQUFBLE1BQUEsQ0FBQSxDQUFBO0VBRUEsSUFBQSxjQUFBLEdBQUE7SUFDQSxNQUFBLEVBQUEsU0FBQTtJQUFBO0lBQ0EsV0FBQSxFQUFBO01BQ0EsU0FBQSxFQUFBLEVBQUE7TUFBQTtNQUNBLE9BQUEsRUFBQSxRQUFBLENBQUE7SUFDQSxDQUFBO0lBQ0EsV0FBQSxFQUFBLElBQUE7SUFBQTtJQUNBLE9BQUEsRUFBQSxrQkFBQTtJQUFBO0lBQ0EsV0FBQSxFQUFBLEVBQUE7SUFBQTtJQUNBLE9BQUEsRUFBQSxDQUFBO0lBQUE7SUFDQSxxQkFBQSxFQUFBLEtBQUE7SUFBQTtJQUNBLFdBQUEsRUFBQSxJQUFBLENBQUE7RUFDQSxDQUFBO0VBQ0EsS0FBQSxJQUFBLEtBQUEsSUFBQSxNQUFBLEVBQUE7SUFDQSxjQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQTtFQUNBO0VBQ0EsTUFBQSxHQUFBLGNBQUE7RUFFQSxJQUFBLGFBQUEsR0FBQSxJQUFBLElBQUEsQ0FBQSxDQUFBO0VBQ0EsYUFBQSxHQUFBLGNBQUEsR0FBQSxhQUFBLENBQUEsT0FBQSxDQUFBLENBQUE7RUFFQSxNQUFBLENBQUEsV0FBQSxDQUFBLElBQUEsa0JBQUE7RUFDQSxJQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxPQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsV0FBQSxDQUFBLElBQUEsd0JBQUE7SUFDQSxPQUFBLEdBQUEsaUVBQUEsR0FBQSxPQUFBO0VBQ0E7RUFDQSxJQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxTQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsV0FBQSxDQUFBLElBQUEsMEJBQUE7SUFDQSxPQUFBLEdBQUEsb0RBQUEsR0FBQSxPQUFBO0VBQ0E7RUFDQSxJQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxNQUFBLEVBQUE7SUFDQSxNQUFBLENBQUEsV0FBQSxDQUFBLElBQUEsdUJBQUE7RUFDQTtFQUNBLElBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLFNBQUEsRUFBQTtJQUNBLE1BQUEsQ0FBQSxXQUFBLENBQUEsSUFBQSwwQkFBQTtJQUNBLE9BQUEsR0FBQSx5REFBQSxHQUFBLE9BQUE7RUFDQTtFQUVBLElBQUEsaUJBQUEsR0FBQSxXQUFBLEdBQUEsYUFBQSxHQUFBLHVDQUFBO0VBQ0EsT0FBQSxHQUFBLFdBQUEsR0FBQSxhQUFBLEdBQUEsbUNBQUEsR0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLEdBQUEsV0FBQSxHQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxJQUFBLEdBQUEsT0FBQSxHQUFBLFFBQUE7RUFHQSxJQUFBLGFBQUEsR0FBQSxLQUFBO0VBQ0EsSUFBQSxlQUFBLEdBQUEsSUFBQTtFQUVBLElBQUEsUUFBQSxLQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsRUFBQTtJQUVBLElBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxFQUFBO01BQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxpQkFBQSxDQUFBO01BQ0EsTUFBQSxDQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxTQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUE7SUFDQSxDQUFBLE1BQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsSUFBQSxDQUFBLGlCQUFBLEdBQUEsT0FBQSxDQUFBO0lBQ0E7RUFFQSxDQUFBLE1BQUEsSUFBQSxRQUFBLEtBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxFQUFBO0lBRUEsYUFBQSxHQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsc0JBQUEsQ0FBQTtJQUNBLElBQUEsTUFBQSxDQUFBLHFCQUFBLENBQUEsSUFBQSxhQUFBLENBQUEsRUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO01BQ0EsZUFBQSxHQUFBLEtBQUE7TUFDQSxhQUFBLEdBQUEsTUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBO0lBQ0E7SUFDQSxJQUFBLGVBQUEsRUFBQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsaUJBQUEsQ0FBQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBO0lBQ0E7RUFFQSxDQUFBLE1BQUEsSUFBQSxPQUFBLEtBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxFQUFBO0lBRUEsYUFBQSxHQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsc0JBQUEsQ0FBQTtJQUNBLElBQUEsTUFBQSxDQUFBLHFCQUFBLENBQUEsSUFBQSxhQUFBLENBQUEsRUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO01BQ0EsZUFBQSxHQUFBLEtBQUE7TUFDQSxhQUFBLEdBQUEsTUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBO0lBQ0E7SUFDQSxJQUFBLGVBQUEsRUFBQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsaUJBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLE9BQUEsQ0FBQTtJQUNBO0VBRUEsQ0FBQSxNQUFBLElBQUEsT0FBQSxLQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsRUFBQTtJQUVBLGFBQUEsR0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsT0FBQSxDQUFBLDBDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsc0JBQUEsQ0FBQTtJQUNBLElBQUEsTUFBQSxDQUFBLHFCQUFBLENBQUEsSUFBQSxhQUFBLENBQUEsRUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO01BQ0EsZUFBQSxHQUFBLEtBQUE7TUFDQSxhQUFBLEdBQUEsTUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBO0lBQ0E7SUFDQSxJQUFBLGVBQUEsRUFBQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsaUJBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsS0FBQSxDQUFBLHVEQUFBLEdBQUEsT0FBQSxHQUFBLFFBQUEsQ0FBQTtJQUNBO0VBQ0EsQ0FBQSxNQUFBLElBQUEsTUFBQSxLQUFBLE1BQUEsQ0FBQSxXQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsRUFBQTtJQUVBLGFBQUEsR0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsUUFBQSxDQUFBLHlDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsc0JBQUEsQ0FBQTtJQUNBLElBQUEsTUFBQSxDQUFBLHFCQUFBLENBQUEsSUFBQSxhQUFBLENBQUEsRUFBQSxDQUFBLFVBQUEsQ0FBQSxFQUFBO01BQ0EsZUFBQSxHQUFBLEtBQUE7TUFDQSxhQUFBLEdBQUEsTUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxDQUFBLENBQUEsQ0FBQSxJQUFBLENBQUEsSUFBQSxDQUFBO0lBQ0E7SUFDQSxJQUFBLGVBQUEsRUFBQTtNQUNBLE1BQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsU0FBQSxDQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsaUJBQUEsQ0FBQSxDQUFBLENBQUE7TUFDQSxNQUFBLENBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLFNBQUEsQ0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLHNEQUFBLEdBQUEsT0FBQSxHQUFBLFFBQUEsQ0FBQTtJQUNBO0VBQ0E7RUFFQSxJQUFBLGVBQUEsSUFBQSxRQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsSUFBQSxZQUFBLEdBQUEsVUFBQSxDQUFBLFlBQUE7TUFDQSxNQUFBLENBQUEsR0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxJQUFBLENBQUE7SUFDQSxDQUFBLEVBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBO0lBRUEsSUFBQSxhQUFBLEdBQUEsVUFBQSxDQUFBLFlBQUE7TUFDQSxNQUFBLENBQUEsR0FBQSxHQUFBLGFBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxNQUFBLENBQUE7SUFDQSxDQUFBLEVBQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxHQUFBLElBQUEsQ0FBQTtFQUNBOztFQUVBO0VBQ0EsSUFBQSxVQUFBLEdBQUEsTUFBQSxDQUFBLEdBQUEsR0FBQSxhQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxZQUFBO0lBQ0EsSUFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsU0FBQSxDQUFBLElBQUEsTUFBQSxDQUFBLGlCQUFBLENBQUEsQ0FBQSxHQUFBLENBQUEsSUFBQSxDQUFBLEVBQUE7TUFDQSxNQUFBLENBQUEsSUFBQSxDQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7SUFDQTtFQUNBLENBQUEsQ0FBQTtFQUVBLElBQUEsTUFBQSxDQUFBLFdBQUEsQ0FBQSxFQUFBO0lBQ0EsY0FBQSxDQUFBLEdBQUEsR0FBQSxhQUFBLEdBQUEsU0FBQSxDQUFBO0VBQ0E7RUFFQSxPQUFBLGFBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsbUNBQUEsQ0FBQSxPQUFBLEVBQUEsT0FBQSxFQUFBO0VBRUEsSUFBQSxpQkFBQSxHQUFBLDRCQUFBLENBQ0EsT0FBQSxFQUNBO0lBQ0EsTUFBQSxFQUFBLE9BQUE7SUFDQSxPQUFBLEVBQUEsS0FBQTtJQUNBLHFCQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQTtNQUNBLE9BQUEsRUFBQSxPQUFBO01BQ0EsU0FBQSxFQUFBO0lBQ0E7RUFDQSxDQUNBLENBQUE7RUFDQSxPQUFBLGlCQUFBO0FBQ0E7O0FBR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLGlEQUFBLENBQUEsT0FBQSxFQUFBLE9BQUEsRUFBQSxhQUFBLEVBQUE7RUFFQSxJQUFBLFdBQUEsS0FBQSxPQUFBLGFBQUEsRUFBQTtJQUNBLGFBQUEsR0FBQSxDQUFBO0VBQ0E7RUFFQSxJQUFBLGlCQUFBLEdBQUEsNEJBQUEsQ0FDQSxPQUFBLEVBQ0E7SUFDQSxNQUFBLEVBQUEsT0FBQTtJQUNBLE9BQUEsRUFBQSxhQUFBO0lBQ0EscUJBQUEsRUFBQSxJQUFBO0lBQ0EsV0FBQSxFQUFBO01BQ0EsT0FBQSxFQUFBLE9BQUE7TUFDQSxTQUFBLEVBQUE7SUFDQTtFQUNBLENBQ0EsQ0FBQTtFQUNBLE9BQUEsaUJBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsaURBQUEsQ0FBQSxPQUFBLEVBQUEsT0FBQSxFQUFBLGFBQUEsRUFBQTtFQUVBLElBQUEsV0FBQSxLQUFBLE9BQUEsYUFBQSxFQUFBO0lBQ0EsYUFBQSxHQUFBLEtBQUE7RUFDQTtFQUVBLElBQUEsaUJBQUEsR0FBQSw0QkFBQSxDQUNBLE9BQUEsRUFDQTtJQUNBLE1BQUEsRUFBQSxPQUFBO0lBQ0EsT0FBQSxFQUFBLGFBQUE7SUFDQSxxQkFBQSxFQUFBLElBQUE7SUFDQSxXQUFBLEVBQUE7TUFDQSxPQUFBLEVBQUEsUUFBQTtNQUNBLFNBQUEsRUFBQTtJQUNBO0VBQ0EsQ0FDQSxDQUFBO0VBQ0EsT0FBQSxpQkFBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxxQ0FBQSxDQUFBLE9BQUEsRUFBQSxPQUFBLEVBQUE7RUFFQSxJQUFBLGlCQUFBLEdBQUEsNEJBQUEsQ0FDQSxPQUFBLEVBQ0E7SUFDQSxNQUFBLEVBQUEsU0FBQTtJQUNBLE9BQUEsRUFBQSxLQUFBO0lBQ0EscUJBQUEsRUFBQSxJQUFBO0lBQ0EsV0FBQSxFQUFBO01BQ0EsT0FBQSxFQUFBLE9BQUE7TUFDQSxTQUFBLEVBQUE7SUFDQTtFQUNBLENBQ0EsQ0FBQTtFQUNBLGtDQUFBLENBQUEsT0FBQSxDQUFBO0VBQ0EsT0FBQSxpQkFBQTtBQUNBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBQSxtREFBQSxDQUFBLE9BQUEsRUFBQSxPQUFBLEVBQUE7RUFFQSxJQUFBLGlCQUFBLEdBQUEsNEJBQUEsQ0FDQSxPQUFBLEVBQ0E7SUFDQSxNQUFBLEVBQUEsU0FBQTtJQUNBLE9BQUEsRUFBQSxLQUFBO0lBQ0EscUJBQUEsRUFBQSxJQUFBO0lBQ0EsV0FBQSxFQUFBO01BQ0EsT0FBQSxFQUFBLE9BQUE7TUFDQSxTQUFBLEVBQUE7SUFDQTtFQUNBLENBQ0EsQ0FBQTtFQUNBLE9BQUEsaUJBQUE7QUFDQTs7QUFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsbURBQUEsQ0FBQSxPQUFBLEVBQUEsT0FBQSxFQUFBO0VBRUEsSUFBQSxpQkFBQSxHQUFBLDRCQUFBLENBQ0EsT0FBQSxFQUNBO0lBQ0EsTUFBQSxFQUFBLFNBQUE7SUFDQSxPQUFBLEVBQUEsS0FBQTtJQUNBLHFCQUFBLEVBQUEsSUFBQTtJQUNBLFdBQUEsRUFBQTtNQUNBLE9BQUEsRUFBQSxRQUFBO01BQ0EsU0FBQSxFQUFBO0lBQ0E7RUFDQSxDQUNBLENBQUE7RUFDQSxPQUFBLGlCQUFBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsa0NBQUEsQ0FBQSxPQUFBLEVBQUE7RUFFQSxJQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtJQUNBO0VBQ0E7RUFDQSxJQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxRQUFBLENBQUEsRUFBQTtJQUNBO0lBQ0EsSUFBQSxXQUFBLEdBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLElBQUEsQ0FBQSxRQUFBLENBQUE7SUFDQSxJQUFBLENBQUEsV0FBQSxDQUFBLE1BQUEsRUFBQTtNQUNBO0lBQ0E7SUFDQSxPQUFBLEdBQUEsV0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLENBQUE7RUFDQTtFQUNBLElBQUEsTUFBQSxHQUFBLENBQUEsQ0FBQTtFQUNBLE1BQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxLQUFBO0VBRUEsSUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxRQUFBLENBQUEsdUJBQUEsQ0FBQSxFQUFBO0lBRUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLFFBQUEsQ0FBQSx1QkFBQSxDQUFBO0lBRUEsSUFBQSxRQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLEdBQUEsQ0FBQSxFQUFBO01BQ0EsSUFBQSxZQUFBLEdBQUEsVUFBQSxDQUFBLFlBQUE7UUFDQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsV0FBQSxDQUFBLHVCQUFBLENBQUE7TUFDQSxDQUFBLEVBQ0EsUUFBQSxDQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FDQSxDQUFBO0lBRUE7RUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQUEsY0FBQSxDQUFBLE9BQUEsRUFBQTtFQUFBLElBQUEsa0JBQUEsR0FBQSxTQUFBLENBQUEsTUFBQSxRQUFBLFNBQUEsUUFBQSxTQUFBLEdBQUEsU0FBQSxNQUFBLENBQUE7RUFFQSxJQUFBLENBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLE1BQUEsRUFBQTtJQUNBO0VBQ0E7RUFDQSxJQUFBLFlBQUEsR0FBQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxHQUFBO0VBRUEsSUFBQSxZQUFBLElBQUEsQ0FBQSxFQUFBO0lBQ0EsSUFBQSxDQUFBLElBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxNQUFBLEVBQUE7TUFDQSxZQUFBLEdBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsR0FBQTtJQUNBLENBQUEsTUFBQSxJQUFBLENBQUEsSUFBQSxNQUFBLENBQUEsT0FBQSxDQUFBLENBQUEsTUFBQSxDQUFBLENBQUEsQ0FBQSxPQUFBLENBQUEsVUFBQSxDQUFBLENBQUEsTUFBQSxFQUFBO01BQ0EsWUFBQSxHQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQSxNQUFBLENBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQSxVQUFBLENBQUEsQ0FBQSxLQUFBLENBQUEsQ0FBQSxDQUFBLE1BQUEsQ0FBQSxDQUFBLENBQUEsR0FBQTtJQUNBO0VBQ0E7RUFFQSxJQUFBLE1BQUEsQ0FBQSxhQUFBLENBQUEsQ0FBQSxNQUFBLEdBQUEsQ0FBQSxFQUFBO0lBQ0EsWUFBQSxHQUFBLFlBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQTtFQUNBLENBQUEsTUFBQTtJQUNBLFlBQUEsR0FBQSxZQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUE7RUFDQTtFQUNBLFlBQUEsSUFBQSxrQkFBQTs7RUFFQTtFQUNBLElBQUEsQ0FBQSxNQUFBLENBQUEsV0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLFdBQUEsQ0FBQSxFQUFBO0lBQ0EsTUFBQSxDQUFBLFdBQUEsQ0FBQSxDQUFBLE9BQUEsQ0FBQTtNQUFBLFNBQUEsRUFBQTtJQUFBLENBQUEsRUFBQSxHQUFBLENBQUE7RUFDQTtBQUNBOztBQzdZQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFBLHlCQUFBLENBQUEsRUFBQTtFQUNBLElBQUEsVUFBQSxLQUFBLE9BQUEsVUFBQSxFQUFBO0lBQ0EsT0FBQSxDQUFBLEdBQUEsQ0FBQSx5Q0FBQSxDQUFBO0lBQ0EsT0FBQSxLQUFBO0VBQ0E7RUFDQSxVQUFBLENBQUEsK0JBQUEsRUFBQTtJQUNBLE9BQUEsV0FBQSxRQUFBLFNBQUEsRUFBQTtNQUNBLElBQUEsYUFBQSxHQUFBLFNBQUEsQ0FBQSxZQUFBLENBQUEscUJBQUEsQ0FBQTtNQUNBLElBQUEsZUFBQSxHQUFBLFNBQUEsQ0FBQSxZQUFBLENBQUEsY0FBQSxDQUFBO01BQ0EsT0FBQSxxQ0FBQSxHQUNBLDJMQUFBLEdBQ0EsZUFBQSxHQUNBLFFBQUE7SUFDQSxDQUFBO0lBQ0EsU0FBQSxFQUFBLElBQUE7SUFDQSxPQUFBLEVBQUEsUUFBQTtJQUNBLFdBQUEsRUFBQSxJQUFBO0lBQ0EsV0FBQSxFQUFBLEtBQUE7SUFDQSxpQkFBQSxFQUFBLEVBQUE7SUFDQSxRQUFBLEVBQUEsR0FBQTtJQUNBLEtBQUEsRUFBQSxvQkFBQTtJQUNBLFNBQUEsRUFBQSxjQUFBO0lBQ0EsS0FBQSxFQUFBLENBQUEsTUFBQSxFQUFBLEdBQUE7RUFDQSxDQUFBLENBQUE7RUFDQSxNQUFBLENBQUEsK0JBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxPQUFBLEVBQUEsWUFBQTtJQUNBLElBQUEsSUFBQSxDQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsU0FBQSxFQUFBO01BQ0EsSUFBQSxDQUFBLE1BQUEsQ0FBQSxJQUFBLENBQUEsQ0FBQTtJQUNBLENBQUEsTUFBQTtNQUNBLElBQUEsQ0FBQSxNQUFBLENBQUEsSUFBQSxDQUFBLENBQUE7SUFDQTtFQUNBLENBQUEsQ0FBQTtFQUNBLGdDQUFBLENBQUEsQ0FBQTtBQUNBO0FBSUEsU0FBQSxnQ0FBQSxDQUFBLEVBQUE7RUFDQSxNQUFBLENBQUEsMkRBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxRQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUE7SUFDQSxJQUFBLFVBQUEsS0FBQSxPQUFBLFVBQUEsRUFBQTtNQUNBLFVBQUEsQ0FBQSxPQUFBLENBQUEsQ0FBQTtJQUNBO0VBQ0EsQ0FBQSxDQUFBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqIEphdmFTY3JpcHQgVXRpbCBGdW5jdGlvbnNcdFx0Li4vaW5jbHVkZXMvX19qcy91dGlscy93cGJjX3V0aWxzLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBUcmltICBzdHJpbmdzIGFuZCBhcnJheSBqb2luZWQgd2l0aCAgKCwpXHJcbiAqXHJcbiAqIEBwYXJhbSBzdHJpbmdfdG9fdHJpbSAgIHN0cmluZyAvIGFycmF5XHJcbiAqIEByZXR1cm5zIHN0cmluZ1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY190cmltKCBzdHJpbmdfdG9fdHJpbSApe1xyXG5cclxuICAgIGlmICggQXJyYXkuaXNBcnJheSggc3RyaW5nX3RvX3RyaW0gKSApe1xyXG4gICAgICAgIHN0cmluZ190b190cmltID0gc3RyaW5nX3RvX3RyaW0uam9pbiggJywnICk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCAnc3RyaW5nJyA9PSB0eXBlb2YgKHN0cmluZ190b190cmltKSApe1xyXG4gICAgICAgIHN0cmluZ190b190cmltID0gc3RyaW5nX3RvX3RyaW0udHJpbSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBzdHJpbmdfdG9fdHJpbTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIGVsZW1lbnQgaW4gYXJyYXlcclxuICpcclxuICogQHBhcmFtIGFycmF5X2hlcmVcdFx0YXJyYXlcclxuICogQHBhcmFtIHBfdmFsXHRcdFx0XHRlbGVtZW50IHRvICBjaGVja1xyXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfaW5fYXJyYXkoIGFycmF5X2hlcmUsIHBfdmFsICl7XHJcblx0Zm9yICggdmFyIGkgPSAwLCBsID0gYXJyYXlfaGVyZS5sZW5ndGg7IGkgPCBsOyBpKysgKXtcclxuXHRcdGlmICggYXJyYXlfaGVyZVsgaSBdID09IHBfdmFsICl7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gZmFsc2U7XHJcbn1cclxuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcbi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvd3BiYy93cGJjLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBEZWVwIENsb25lIG9mIG9iamVjdCBvciBhcnJheVxyXG4gKlxyXG4gKiBAcGFyYW0gb2JqXHJcbiAqIEByZXR1cm5zIHthbnl9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Nsb25lX29iaiggb2JqICl7XHJcblxyXG5cdHJldHVybiBKU09OLnBhcnNlKCBKU09OLnN0cmluZ2lmeSggb2JqICkgKTtcclxufVxyXG5cclxuXHJcblxyXG4vKipcclxuICogTWFpbiBfd3BiYyBKUyBvYmplY3RcclxuICovXHJcblxyXG52YXIgX3dwYmMgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gU2VjdXJlIHBhcmFtZXRlcnMgZm9yIEFqYXhcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX3NlY3VyZSA9IG9iai5zZWN1cml0eV9vYmogPSBvYmouc2VjdXJpdHlfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0dXNlcl9pZDogMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bm9uY2UgIDogJycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsZSA6ICcnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH07XHJcblx0b2JqLnNldF9zZWN1cmVfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9zZWN1cmVbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfc2VjdXJlX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBDYWxlbmRhcnMgXHQtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHBfY2FsZW5kYXJzID0gb2JqLmNhbGVuZGFyc19vYmogPSBvYmouY2FsZW5kYXJzX29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvcnQgICAgICAgICAgICA6IFwiYm9va2luZ19pZFwiLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9udW0gICAgICAgIDogMSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gcGFnZV9pdGVtc19jb3VudDogMTAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGtleXdvcmQgICAgICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHNvdXJjZSAgICAgICAgICA6IFwiXCJcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgQ2hlY2sgaWYgY2FsZW5kYXIgZm9yIHNwZWNpZmljIGJvb2tpbmcgcmVzb3VyY2UgZGVmaW5lZCAgIDo6ICAgdHJ1ZSB8IGZhbHNlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pc19kZWZpbmVkID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRyZXR1cm4gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBDcmVhdGUgQ2FsZW5kYXIgaW5pdGlhbGl6aW5nXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19pbml0ID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCApIHtcclxuXHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgXSA9IGZhbHNlO1xyXG5cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBDaGVjayAgaWYgdGhlIHR5cGUgb2YgdGhpcyBwcm9wZXJ0eSAgaXMgSU5UXHJcblx0ICogQHBhcmFtIHByb3BlcnR5X25hbWVcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2lzX3Byb3BfaW50ID0gZnVuY3Rpb24gKCBwcm9wZXJ0eV9uYW1lICkge1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogOS45LjAuMjlcclxuXHJcblx0XHR2YXIgcF9jYWxlbmRhcl9pbnRfcHJvcGVydGllcyA9IFsnZHluYW1pY19fZGF5c19taW4nLCAnZHluYW1pY19fZGF5c19tYXgnLCAnZml4ZWRfX2RheXNfbnVtJ107XHJcblxyXG5cdFx0dmFyIGlzX2luY2x1ZGUgPSBwX2NhbGVuZGFyX2ludF9wcm9wZXJ0aWVzLmluY2x1ZGVzKCBwcm9wZXJ0eV9uYW1lICk7XHJcblxyXG5cdFx0cmV0dXJuIGlzX2luY2x1ZGU7XHJcblx0fTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBwYXJhbXMgZm9yIGFsbCAgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJzX29ialx0XHRPYmplY3QgeyBjYWxlbmRhcl8xOiB7fSB9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0IGNhbGVuZGFyXzM6IHt9LCAuLi4gfVxyXG5cdCAqL1xyXG5cdG9iai5jYWxlbmRhcnNfYWxsX19zZXQgPSBmdW5jdGlvbiAoIGNhbGVuZGFyc19vYmogKSB7XHJcblx0XHRwX2NhbGVuZGFycyA9IGNhbGVuZGFyc19vYmo7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGluIGFsbCBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyc19hbGxfX2dldCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2NhbGVuZGFycztcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgY2FsZW5kYXIgb2JqZWN0ICAgOjogICB7IGlkOiAxLCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRcdHsgaWQ6IDIgLOKApiB9XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19nZXRfcGFyYW1ldGVycyA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0aWYgKCBvYmouY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHJcblx0XHRcdHJldHVybiBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBjYWxlbmRhciBvYmplY3QgICA6OiAgIHsgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogaWYgY2FsZW5kYXIgb2JqZWN0ICBub3QgZGVmaW5lZCwgdGhlbiAgaXQncyB3aWxsIGJlIGRlZmluZWQgYW5kIElEIHNldFxyXG5cdCAqIGlmIGNhbGVuZGFyIGV4aXN0LCB0aGVuICBzeXN0ZW0gc2V0ICBhcyBuZXcgb3Igb3ZlcndyaXRlIG9ubHkgcHJvcGVydGllcyBmcm9tIGNhbGVuZGFyX3Byb3BlcnR5X29iaiBwYXJhbWV0ZXIsICBidXQgb3RoZXIgcHJvcGVydGllcyB3aWxsIGJlIGV4aXN0ZWQgYW5kIG5vdCBvdmVyd3JpdGUsIGxpa2UgJ2lkJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJfcHJvcGVydHlfb2JqXHRcdFx0XHRcdCAgeyAgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfSAgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgJ3RydWUnIChkZWZhdWx0OiAnZmFsc2UnKSwgIHRoZW4gIG9ubHkgb3ZlcndyaXRlIG9yIGFkZCAgbmV3IHByb3BlcnRpZXMgaW4gIGNhbGVuZGFyX3Byb3BlcnR5X29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICpcclxuXHQgKiBDb21tb24gdXNhZ2UgaW4gUEhQOlxyXG5cdCAqICAgXHRcdFx0ZWNobyBcIiAgX3dwYmMuY2FsZW5kYXJfX3NldCggIFwiIC5pbnR2YWwoICRyZXNvdXJjZV9pZCApIC4gXCIsIHsgJ2RhdGVzJzogXCIgLiB3cF9qc29uX2VuY29kZSggJGF2YWlsYWJpbGl0eV9wZXJfZGF5c19hcnIgKSAuIFwiIH0gKTtcIjtcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzID0gZnVuY3Rpb24gKCByZXNvdXJjZV9pZCwgY2FsZW5kYXJfcHJvcGVydHlfb2JqLCBpc19jb21wbGV0ZV9vdmVyd3JpdGUgPSBmYWxzZSAgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgfHwgKHRydWUgPT09IGlzX2NvbXBsZXRlX292ZXJ3cml0ZSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gY2FsZW5kYXJfcHJvcGVydHlfb2JqICl7XHJcblxyXG5cdFx0XHRwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IGNhbGVuZGFyX3Byb3BlcnR5X29ialsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHByb3BlcnR5ICB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFwiMVwiXHJcblx0ICogQHBhcmFtIHByb3BfbmFtZVx0XHRuYW1lIG9mIHByb3BlcnR5XHJcblx0ICogQHBhcmFtIHByb3BfdmFsdWVcdHZhbHVlIG9mIHByb3BlcnR5XHJcblx0ICogQHJldHVybnMgeyp9XHRcdFx0Y2FsZW5kYXIgb2JqZWN0XHJcblx0ICovXHJcblx0b2JqLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBwcm9wX25hbWUsIHByb3BfdmFsdWUgKSB7XHJcblxyXG5cdFx0aWYgKCAoIW9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSkgKXtcclxuXHRcdFx0b2JqLmNhbGVuZGFyX19pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gcHJvcF92YWx1ZTtcclxuXHJcblx0XHRyZXR1cm4gcF9jYWxlbmRhcnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiAgR2V0IGNhbGVuZGFyIHByb3BlcnR5IHZhbHVlICAgXHQ6OiAgIG1peGVkIHwgbnVsbFxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSAgcmVzb3VyY2VfaWRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHByb3BfbmFtZVx0XHRcdCdzZWxlY3Rpb25fbW9kZSdcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVx0XHRcdFx0XHRtaXhlZCB8IG51bGxcclxuXHQgKi9cclxuXHRvYmouY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0Ly9GaXhJbjogOS45LjAuMjlcclxuXHRcdFx0aWYgKCBvYmouY2FsZW5kYXJfX2lzX3Byb3BfaW50KCBwcm9wX25hbWUgKSApe1xyXG5cdFx0XHRcdHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gcGFyc2VJbnQoIHBfY2FsZW5kYXJzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdICk7XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuICBwX2NhbGVuZGFyc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcdFx0Ly8gSWYgc29tZSBwcm9wZXJ0eSBub3QgZGVmaW5lZCwgdGhlbiBudWxsO1xyXG5cdH07XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cdC8vIEJvb2tpbmdzIFx0LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX2Jvb2tpbmdzID0gb2JqLmJvb2tpbmdzX29iaiA9IG9iai5ib29raW5nc19vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNhbGVuZGFyXzE6IE9iamVjdCB7XHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICAgaWQ6ICAgICAxXHJcbiBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vXHRcdFx0XHRcdFx0ICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKZcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBDaGVjayBpZiBib29raW5ncyBmb3Igc3BlY2lmaWMgYm9va2luZyByZXNvdXJjZSBkZWZpbmVkICAgOjogICB0cnVlIHwgZmFsc2VcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkICkge1xyXG5cclxuXHRcdHJldHVybiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdICkgKTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYm9va2luZ3MgY2FsZW5kYXIgb2JqZWN0ICAgOjogICB7IGlkOiAxICwgZGF0ZXM6ICBPYmplY3QgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRcdHsgaWQ6IDIgLCBkYXRlczogIE9iamVjdCB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXQgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRpZiAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgYm9va2luZ3MgY2FsZW5kYXIgb2JqZWN0ICAgOjogICB7IGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIGlmIGNhbGVuZGFyIG9iamVjdCAgbm90IGRlZmluZWQsIHRoZW4gIGl0J3Mgd2lsbCBiZSBkZWZpbmVkIGFuZCBJRCBzZXRcclxuXHQgKiBpZiBjYWxlbmRhciBleGlzdCwgdGhlbiAgc3lzdGVtIHNldCAgYXMgbmV3IG9yIG92ZXJ3cml0ZSBvbmx5IHByb3BlcnRpZXMgZnJvbSBjYWxlbmRhcl9vYmogcGFyYW1ldGVyLCAgYnV0IG90aGVyIHByb3BlcnRpZXMgd2lsbCBiZSBleGlzdGVkIGFuZCBub3Qgb3ZlcndyaXRlLCBsaWtlICdpZCdcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHRcdCAgJzInXHJcblx0ICogQHBhcmFtIHtvYmplY3R9IGNhbGVuZGFyX29ialx0XHRcdFx0XHQgIHsgIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH0gIH1cclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGVzOlxyXG5cdCAqXHJcblx0ICogQ29tbW9uIHVzYWdlIGluIFBIUDpcclxuXHQgKiAgIFx0XHRcdGVjaG8gXCIgIF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXQoICBcIiAuaW50dmFsKCAkcmVzb3VyY2VfaWQgKSAuIFwiLCB7ICdkYXRlcyc6IFwiIC4gd3BfanNvbl9lbmNvZGUoICRhdmFpbGFiaWxpdHlfcGVyX2RheXNfYXJyICkgLiBcIiB9ICk7XCI7XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXQgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQsIGNhbGVuZGFyX29iaiApe1xyXG5cclxuXHRcdGlmICggISBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKXtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgJ2lkJyBdID0gcmVzb3VyY2VfaWQ7XHJcblx0XHR9XHJcblxyXG5cdFx0Zm9yICggdmFyIHByb3BfbmFtZSBpbiBjYWxlbmRhcl9vYmogKXtcclxuXHJcblx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gPSBjYWxlbmRhcl9vYmpbIHByb3BfbmFtZSBdO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF07XHJcblx0fTtcclxuXHJcblx0Ly8gRGF0ZXNcclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBib29raW5ncyBkYXRhIGZvciBBTEwgRGF0ZXMgaW4gY2FsZW5kYXIgICA6OiAgIGZhbHNlIHwgeyBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmIH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHQnMSdcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRmYWxzZSB8IE9iamVjdCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTA3LTI0XCI6IE9iamVjdCB7IFsnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheSddOiBcImF2YWlsYWJsZVwiLCBkYXlfYXZhaWxhYmlsaXR5OiAxLCBtYXhfY2FwYWNpdHk6IDEsIOKApiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTA3LTI2XCI6IE9iamVjdCB7IFsnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheSddOiBcImZ1bGxfZGF5X2Jvb2tpbmdcIiwgWydzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnXTogXCJwZW5kaW5nXCIsIGRheV9hdmFpbGFiaWxpdHk6IDAsIOKApiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTA3LTI5XCI6IE9iamVjdCB7IFsnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheSddOiBcInJlc291cmNlX2F2YWlsYWJpbGl0eVwiLCBkYXlfYXZhaWxhYmlsaXR5OiAwLCBtYXhfY2FwYWNpdHk6IDEsIOKApiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XCIyMDIzLTA3LTMwXCI6IHvigKZ9LCBcIjIwMjMtMDctMzFcIjoge+KApn0sIOKAplxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZGF0ZXMgPSBmdW5jdGlvbiggcmVzb3VyY2VfaWQpe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXSApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiAgcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1x0XHQvLyBJZiBzb21lIHByb3BlcnR5IG5vdCBkZWZpbmVkLCB0aGVuIGZhbHNlO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIFNldCBib29raW5ncyBkYXRlcyBpbiBjYWxlbmRhciBvYmplY3QgICA6OiAgICB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICpcclxuXHQgKiBpZiBjYWxlbmRhciBvYmplY3QgIG5vdCBkZWZpbmVkLCB0aGVuICBpdCdzIHdpbGwgYmUgZGVmaW5lZCBhbmQgJ2lkJywgJ2RhdGVzJyBzZXRcclxuXHQgKiBpZiBjYWxlbmRhciBleGlzdCwgdGhlbiBzeXN0ZW0gYWRkIGEgIG5ldyBvciBvdmVyd3JpdGUgb25seSBkYXRlcyBmcm9tIGRhdGVzX29iaiBwYXJhbWV0ZXIsXHJcblx0ICogYnV0IG90aGVyIGRhdGVzIG5vdCBmcm9tIHBhcmFtZXRlciBkYXRlc19vYmogd2lsbCBiZSBleGlzdGVkIGFuZCBub3Qgb3ZlcndyaXRlLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFx0XHRcdFx0ICAnMidcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gZGF0ZXNfb2JqXHRcdFx0XHRcdCAgeyBcIjIwMjMtMDctMjFcIjoge+KApn0sIFwiMjAyMy0wNy0yMlwiOiB74oCmfSwgXCIyMDIzLTA3LTIzXCI6IHvigKZ9LCDigKYgfVxyXG5cdCAqIEBwYXJhbSB7Ym9vbGVhbn0gaXNfY29tcGxldGVfb3ZlcndyaXRlXHRcdCAgaWYgZmFsc2UsICB0aGVuICBvbmx5IG92ZXJ3cml0ZSBvciBhZGQgIGRhdGVzIGZyb20gXHRkYXRlc19vYmpcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGVzOlxyXG5cdCAqICAgXHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX3NldF9kYXRlcyggcmVzb3VyY2VfaWQsIHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIOKApiB9ICApO1x0XHQ8LSAgIG92ZXJ3cml0ZSBBTEwgZGF0ZXNcclxuXHQgKiAgIFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoIHJlc291cmNlX2lkLCB7IFwiMjAyMy0wNy0yMlwiOiB74oCmfSB9LCAgZmFsc2UgICk7XHRcdFx0XHRcdDwtICAgYWRkIG9yIG92ZXJ3cml0ZSBvbmx5ICBcdFwiMjAyMy0wNy0yMlwiOiB7fVxyXG5cdCAqXHJcblx0ICogQ29tbW9uIHVzYWdlIGluIFBIUDpcclxuXHQgKiAgIFx0XHRcdGVjaG8gXCIgIF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoICBcIiAuIGludHZhbCggJHJlc291cmNlX2lkICkgLiBcIiwgIFwiIC4gd3BfanNvbl9lbmNvZGUoICRhdmFpbGFiaWxpdHlfcGVyX2RheXNfYXJyICkgLiBcIiAgKTsgIFwiO1xyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0X2RhdGVzID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBkYXRlc19vYmogLCBpc19jb21wbGV0ZV9vdmVyd3JpdGUgPSB0cnVlICl7XHJcblxyXG5cdFx0aWYgKCAhb2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyX19pc19kZWZpbmVkKCByZXNvdXJjZV9pZCApICl7XHJcblx0XHRcdG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9fc2V0KCByZXNvdXJjZV9pZCwgeyAnZGF0ZXMnOiB7fSB9ICk7XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXSkgKXtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF0gPSB7fVxyXG5cdFx0fVxyXG5cclxuXHRcdGlmIChpc19jb21wbGV0ZV9vdmVyd3JpdGUpe1xyXG5cclxuXHRcdFx0Ly8gQ29tcGxldGUgb3ZlcndyaXRlIGFsbCAgYm9va2luZyBkYXRlc1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXSA9IGRhdGVzX29iajtcclxuXHRcdH0gZWxzZSB7XHJcblxyXG5cdFx0XHQvLyBBZGQgb25seSAgbmV3IG9yIG92ZXJ3cml0ZSBleGlzdCBib29raW5nIGRhdGVzIGZyb20gIHBhcmFtZXRlci4gQm9va2luZyBkYXRlcyBub3QgZnJvbSAgcGFyYW1ldGVyICB3aWxsICBiZSB3aXRob3V0IGNobmFuZ2VzXHJcblx0XHRcdGZvciAoIHZhciBwcm9wX25hbWUgaW4gZGF0ZXNfb2JqICl7XHJcblxyXG5cdFx0XHRcdHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsnZGF0ZXMnXVsgcHJvcF9uYW1lIF0gPSBkYXRlc19vYmpbIHByb3BfbmFtZSBdO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBib29raW5ncyBkYXRhIGZvciBzcGVjaWZpYyBkYXRlIGluIGNhbGVuZGFyICAgOjogICBmYWxzZSB8IHsgZGF5X2F2YWlsYWJpbGl0eTogMSwgLi4uIH1cclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gcmVzb3VyY2VfaWRcdFx0XHQnMSdcclxuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3FsX2NsYXNzX2RheVx0XHRcdCcyMDIzLTA3LTIxJ1xyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8Ym9vbGVhbn1cdFx0XHRcdGZhbHNlIHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRkYXlfYXZhaWxhYmlsaXR5OiA0XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1heF9jYXBhY2l0eTogNFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICA+PSBCdXNpbmVzcyBMYXJnZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQyOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDEwOiBPYmplY3QgeyBpc19kYXlfdW5hdmFpbGFibGU6IGZhbHNlLCBfZGF5X3N0YXR1czogXCJhdmFpbGFibGVcIiB9XHRcdC8vICA+PSBCdXNpbmVzcyBMYXJnZSAuLi5cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MTE6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0MTI6IE9iamVjdCB7IGlzX2RheV91bmF2YWlsYWJsZTogZmFsc2UsIF9kYXlfc3RhdHVzOiBcImF2YWlsYWJsZVwiIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApe1xyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJfX2lzX2RlZmluZWQoIHJlc291cmNlX2lkICkgKVxyXG5cdFx0XHQmJiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bICdkYXRlcycgXSApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF1bIHNxbF9jbGFzc19kYXkgXSApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiAgcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnZGF0ZXMnIF1bIHNxbF9jbGFzc19kYXkgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gZmFsc2U7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gZmFsc2U7XHJcblx0fTtcclxuXHJcblxyXG5cdC8vIEFueSAgUEFSQU1TICAgaW4gYm9va2luZ3NcclxuXHJcblx0LyoqXHJcblx0ICogU2V0IHByb3BlcnR5ICB0byAgYm9va2luZ1xyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XCIxXCJcclxuXHQgKiBAcGFyYW0gcHJvcF9uYW1lXHRcdG5hbWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcGFyYW0gcHJvcF92YWx1ZVx0dmFsdWUgb2YgcHJvcGVydHlcclxuXHQgKiBAcmV0dXJucyB7Kn1cdFx0XHRib29raW5nIG9iamVjdFxyXG5cdCAqL1xyXG5cdG9iai5ib29raW5nX19zZXRfcGFyYW1fdmFsdWUgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBwcm9wX25hbWUsIHByb3BfdmFsdWUgKSB7XHJcblxyXG5cdFx0aWYgKCAhIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApe1xyXG5cdFx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0gPSB7fTtcclxuXHRcdFx0cF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyAnaWQnIF0gPSByZXNvdXJjZV9pZDtcclxuXHRcdH1cclxuXHJcblx0XHRwX2Jvb2tpbmdzWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHByb3BfbmFtZSBdID0gcHJvcF92YWx1ZTtcclxuXHJcblx0XHRyZXR1cm4gcF9ib29raW5nc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdO1xyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqICBHZXQgYm9va2luZyBwcm9wZXJ0eSB2YWx1ZSAgIFx0OjogICBtaXhlZCB8IG51bGxcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfGludH0gIHJlc291cmNlX2lkXHRcdCcxJ1xyXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wX25hbWVcdFx0XHQnc2VsZWN0aW9uX21vZGUnXHJcblx0ICogQHJldHVybnMgeyp8bnVsbH1cdFx0XHRcdFx0bWl4ZWQgfCBudWxsXHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdfX2dldF9wYXJhbV92YWx1ZSA9IGZ1bmN0aW9uKCByZXNvdXJjZV9pZCwgcHJvcF9uYW1lICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIG9iai5ib29raW5nc19pbl9jYWxlbmRhcl9faXNfZGVmaW5lZCggcmVzb3VyY2VfaWQgKSApXHJcblx0XHRcdCYmICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF0gKSApXHJcblx0XHQpe1xyXG5cdFx0XHRyZXR1cm4gIHBfYm9va2luZ3NbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXVsgcHJvcF9uYW1lIF07XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG51bGw7XHRcdC8vIElmIHNvbWUgcHJvcGVydHkgbm90IGRlZmluZWQsIHRoZW4gbnVsbDtcclxuXHR9O1xyXG5cclxuXHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTZXQgYm9va2luZ3MgZm9yIGFsbCAgY2FsZW5kYXJzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge29iamVjdH0gY2FsZW5kYXJzX29ialx0XHRPYmplY3QgeyBjYWxlbmRhcl8xOiB7IGlkOiAxLCBkYXRlczogT2JqZWN0IHsgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIFwiMjAyMy0wNy0yNFwiOiB74oCmfSwg4oCmIH0gfVxyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCBjYWxlbmRhcl8zOiB7fSwgLi4uIH1cclxuXHQgKi9cclxuXHRvYmouYm9va2luZ3NfaW5fY2FsZW5kYXJzX19zZXRfYWxsID0gZnVuY3Rpb24gKCBjYWxlbmRhcnNfb2JqICkge1xyXG5cdFx0cF9ib29raW5ncyA9IGNhbGVuZGFyc19vYmo7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGJvb2tpbmdzIGluIGFsbCBjYWxlbmRhcnNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmJvb2tpbmdzX2luX2NhbGVuZGFyc19fZ2V0X2FsbCA9IGZ1bmN0aW9uICgpIHtcclxuXHRcdHJldHVybiBwX2Jvb2tpbmdzO1xyXG5cdH07XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblxyXG5cclxuXHJcblx0Ly8gU2Vhc29ucyBcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWFzb25zID0gb2JqLnNlYXNvbnNfb2JqID0gb2JqLnNlYXNvbnNfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBjYWxlbmRhcl8xOiBPYmplY3Qge1xyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAgIGlkOiAgICAgMVxyXG4gXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL1x0XHRcdFx0XHRcdCAsIGRhdGVzOiAgT2JqZWN0IHsgXCIyMDIzLTA3LTIxXCI6IHvigKZ9LCBcIjIwMjMtMDctMjJcIjoge+KApn0sIFwiMjAyMy0wNy0yM1wiOiB74oCmfSwg4oCmXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBBZGQgc2Vhc29uIG5hbWVzIGZvciBkYXRlcyBpbiBjYWxlbmRhciBvYmplY3QgICA6OiAgICB7IFwiMjAyMy0wNy0yMVwiOiBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXSwgXCIyMDIzLTA3LTIyXCI6IFsuLi5dLCAuLi4gfVxyXG5cdCAqXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0XHQgICcyJ1xyXG5cdCAqIEBwYXJhbSB7b2JqZWN0fSBkYXRlc19vYmpcdFx0XHRcdFx0ICB7IFwiMjAyMy0wNy0yMVwiOiB74oCmfSwgXCIyMDIzLTA3LTIyXCI6IHvigKZ9LCBcIjIwMjMtMDctMjNcIjoge+KApn0sIOKApiB9XHJcblx0ICogQHBhcmFtIHtib29sZWFufSBpc19jb21wbGV0ZV9vdmVyd3JpdGVcdFx0ICBpZiBmYWxzZSwgIHRoZW4gIG9ubHkgIGFkZCAgZGF0ZXMgZnJvbSBcdGRhdGVzX29ialxyXG5cdCAqIEByZXR1cm5zIHsqfVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZXM6XHJcblx0ICogICBcdFx0XHRfd3BiYy5zZWFzb25zX19zZXQoIHJlc291cmNlX2lkLCB7IFwiMjAyMy0wNy0yMVwiOiBbICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMycsICd3cGJjX3NlYXNvbl9zZXB0ZW1iZXJfMjAyNCcgXSwgXCIyMDIzLTA3LTIyXCI6IFsuLi5dLCAuLi4gfSAgKTtcclxuXHQgKi9cclxuXHRvYmouc2Vhc29uc19fc2V0ID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBkYXRlc19vYmogLCBpc19jb21wbGV0ZV9vdmVyd3JpdGUgPSBmYWxzZSApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF0pICl7XHJcblx0XHRcdHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdID0ge307XHJcblx0XHR9XHJcblxyXG5cdFx0aWYgKCBpc19jb21wbGV0ZV9vdmVyd3JpdGUgKXtcclxuXHJcblx0XHRcdC8vIENvbXBsZXRlIG92ZXJ3cml0ZSBhbGwgIHNlYXNvbiBkYXRlc1xyXG5cdFx0XHRwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSA9IGRhdGVzX29iajtcclxuXHJcblx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0Ly8gQWRkIG9ubHkgIG5ldyBvciBvdmVyd3JpdGUgZXhpc3QgYm9va2luZyBkYXRlcyBmcm9tICBwYXJhbWV0ZXIuIEJvb2tpbmcgZGF0ZXMgbm90IGZyb20gIHBhcmFtZXRlciAgd2lsbCAgYmUgd2l0aG91dCBjaG5hbmdlc1xyXG5cdFx0XHRmb3IgKCB2YXIgcHJvcF9uYW1lIGluIGRhdGVzX29iaiApe1xyXG5cclxuXHRcdFx0XHRpZiAoICd1bmRlZmluZWQnID09PSB0eXBlb2YgKHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSkgKXtcclxuXHRcdFx0XHRcdHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXSA9IFtdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRmb3IgKCB2YXIgc2Vhc29uX25hbWVfa2V5IGluIGRhdGVzX29ialsgcHJvcF9uYW1lIF0gKXtcclxuXHRcdFx0XHRcdHBfc2Vhc29uc1sgJ2NhbGVuZGFyXycgKyByZXNvdXJjZV9pZCBdWyBwcm9wX25hbWUgXS5wdXNoKCBkYXRlc19vYmpbIHByb3BfbmFtZSBdWyBzZWFzb25fbmFtZV9rZXkgXSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXTtcclxuXHR9O1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBib29raW5ncyBkYXRhIGZvciBzcGVjaWZpYyBkYXRlIGluIGNhbGVuZGFyICAgOjogICBbXSB8IFsgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDIzJywgJ3dwYmNfc2Vhc29uX3NlcHRlbWJlcl8yMDI0JyBdXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ge3N0cmluZ3xpbnR9IHJlc291cmNlX2lkXHRcdFx0JzEnXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXlcdFx0XHQnMjAyMy0wNy0yMSdcclxuXHQgKiBAcmV0dXJucyB7b2JqZWN0fGJvb2xlYW59XHRcdFx0XHRbXSAgfCAgWyAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjMnLCAnd3BiY19zZWFzb25fc2VwdGVtYmVyXzIwMjQnIF1cclxuXHQgKi9cclxuXHRvYmouc2Vhc29uc19fZ2V0X2Zvcl9kYXRlID0gZnVuY3Rpb24oIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKCBwX3NlYXNvbnNbICdjYWxlbmRhcl8nICsgcmVzb3VyY2VfaWQgXSApIClcclxuXHRcdFx0JiYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHNxbF9jbGFzc19kYXkgXSApIClcclxuXHRcdCl7XHJcblx0XHRcdHJldHVybiAgcF9zZWFzb25zWyAnY2FsZW5kYXJfJyArIHJlc291cmNlX2lkIF1bIHNxbF9jbGFzc19kYXkgXTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gW107XHRcdC8vIElmIG5vdCBkZWZpbmVkLCB0aGVuIFtdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyBPdGhlciBwYXJhbWV0ZXJzIFx0XHRcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX290aGVyID0gb2JqLm90aGVyX29iaiA9IG9iai5vdGhlcl9vYmogfHwgeyB9O1xyXG5cclxuXHRvYmouc2V0X290aGVyX3BhcmFtID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfb3RoZXJbIHBhcmFtX2tleSBdID0gcGFyYW1fdmFsO1xyXG5cdH07XHJcblxyXG5cdG9iai5nZXRfb3RoZXJfcGFyYW0gPSBmdW5jdGlvbiAoIHBhcmFtX2tleSApIHtcclxuXHRcdHJldHVybiBwX290aGVyWyBwYXJhbV9rZXkgXTtcclxuXHR9O1xyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgYWxsIG90aGVyIHBhcmFtc1xyXG5cdCAqXHJcblx0ICogQHJldHVybnMge29iamVjdHx7fX1cclxuXHQgKi9cclxuXHRvYmouZ2V0X290aGVyX3BhcmFtX19hbGwgPSBmdW5jdGlvbiAoKSB7XHJcblx0XHRyZXR1cm4gcF9vdGhlcjtcclxuXHR9O1xyXG5cclxuXHQvLyBNZXNzYWdlcyBcdFx0XHQgICAgICAgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX21lc3NhZ2VzID0gb2JqLm1lc3NhZ2VzX29iaiA9IG9iai5tZXNzYWdlc19vYmogfHwgeyB9O1xyXG5cclxuXHRvYmouc2V0X21lc3NhZ2UgPSBmdW5jdGlvbiAoIHBhcmFtX2tleSwgcGFyYW1fdmFsICkge1xyXG5cdFx0cF9tZXNzYWdlc1sgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9tZXNzYWdlID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9tZXNzYWdlc1sgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogR2V0IGFsbCBvdGhlciBwYXJhbXNcclxuXHQgKlxyXG5cdCAqIEByZXR1cm5zIHtvYmplY3R8e319XHJcblx0ICovXHJcblx0b2JqLmdldF9tZXNzYWdlc19fYWxsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfbWVzc2FnZXM7XHJcblx0fTtcclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcblx0cmV0dXJuIG9iajtcclxuXHJcbn0oIF93cGJjIHx8IHt9LCBqUXVlcnkgKSk7XHJcbiIsIi8qKlxyXG4gKiBFeHRlbmQgX3dwYmMgd2l0aCAgbmV3IG1ldGhvZHMgICAgICAgIC8vRml4SW46IDkuOC42LjJcclxuICpcclxuICogQHR5cGUgeyp8e319XHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG4gX3dwYmMgPSAoZnVuY3Rpb24gKCBvYmosICQpIHtcclxuXHJcblx0Ly8gTG9hZCBCYWxhbmNlciBcdC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdHZhciBwX2JhbGFuY2VyID0gb2JqLmJhbGFuY2VyX29iaiA9IG9iai5iYWxhbmNlcl9vYmogfHwge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdtYXhfdGhyZWFkcyc6IDIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2luX3Byb2Nlc3MnIDogW10sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3dhaXQnICAgICAgIDogW11cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fTtcclxuXHJcblx0IC8qKlxyXG5cdCAgKiBTZXQgIG1heCBwYXJhbGxlbCByZXF1ZXN0ICB0byAgbG9hZFxyXG5cdCAgKlxyXG5cdCAgKiBAcGFyYW0gbWF4X3RocmVhZHNcclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19zZXRfbWF4X3RocmVhZHMgPSBmdW5jdGlvbiAoIG1heF90aHJlYWRzICl7XHJcblxyXG5cdFx0cF9iYWxhbmNlclsgJ21heF90aHJlYWRzJyBdID0gbWF4X3RocmVhZHM7XHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogIENoZWNrIGlmIGJhbGFuY2VyIGZvciBzcGVjaWZpYyBib29raW5nIHJlc291cmNlIGRlZmluZWQgICA6OiAgIHRydWUgfCBmYWxzZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdG9iai5iYWxhbmNlcl9faXNfZGVmaW5lZCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQgKSB7XHJcblxyXG5cdFx0cmV0dXJuICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCBwX2JhbGFuY2VyWyAnYmFsYW5jZXJfJyArIHJlc291cmNlX2lkIF0gKSApO1xyXG5cdH07XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiAgQ3JlYXRlIGJhbGFuY2VyIGluaXRpYWxpemluZ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtzdHJpbmd8aW50fSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdG9iai5iYWxhbmNlcl9faW5pdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgLCBwYXJhbXMgPXt9KSB7XHJcblxyXG5cdFx0dmFyIGJhbGFuY2Vfb2JqID0ge307XHJcblx0XHRiYWxhbmNlX29ialsgJ3Jlc291cmNlX2lkJyBdICAgPSByZXNvdXJjZV9pZDtcclxuXHRcdGJhbGFuY2Vfb2JqWyAncHJpb3JpdHknIF0gICAgICA9IDE7XHJcblx0XHRiYWxhbmNlX29ialsgJ2Z1bmN0aW9uX25hbWUnIF0gPSBmdW5jdGlvbl9uYW1lO1xyXG5cdFx0YmFsYW5jZV9vYmpbICdwYXJhbXMnIF0gICAgICAgID0gd3BiY19jbG9uZV9vYmooIHBhcmFtcyApO1xyXG5cclxuXHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9faXNfYWxyZWFkeV9ydW4oIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICkgKXtcclxuXHRcdFx0cmV0dXJuICdydW4nO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBvYmouYmFsYW5jZXJfX2lzX2FscmVhZHlfd2FpdCggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKSApe1xyXG5cdFx0XHRyZXR1cm4gJ3dhaXQnO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRpZiAoIG9iai5iYWxhbmNlcl9fY2FuX2lfcnVuKCkgKXtcclxuXHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biggYmFsYW5jZV9vYmogKTtcclxuXHRcdFx0cmV0dXJuICdydW4nO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3dhaXQoIGJhbGFuY2Vfb2JqICk7XHJcblx0XHRcdHJldHVybiAnd2FpdCc7XHJcblx0XHR9XHJcblx0fTtcclxuXHJcblx0IC8qKlxyXG5cdCAgKiBDYW4gSSBSdW4gP1xyXG5cdCAgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgICovXHJcblx0b2JqLmJhbGFuY2VyX19jYW5faV9ydW4gPSBmdW5jdGlvbiAoKXtcclxuXHRcdHJldHVybiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCA8IHBfYmFsYW5jZXJbICdtYXhfdGhyZWFkcycgXSApO1xyXG5cdH1cclxuXHJcblx0XHQgLyoqXHJcblx0XHQgICogQWRkIHRvIFdBSVRcclxuXHRcdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX193YWl0ID0gZnVuY3Rpb24gKCBiYWxhbmNlX29iaiApIHtcclxuXHRcdFx0cF9iYWxhbmNlclsnd2FpdCddLnB1c2goIGJhbGFuY2Vfb2JqICk7XHJcblx0XHR9XHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIFJlbW92ZSBmcm9tIFdhaXRcclxuXHRcdCAgKlxyXG5cdFx0ICAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdFx0ICAqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQgICogQHJldHVybnMgeyp8Ym9vbGVhbn1cclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3dhaXRfbGlzdCA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdHZhciByZW1vdmVkX2VsID0gZmFsc2U7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0XHQvL0ZpeEluOiA5LjguMTAuMVxyXG5cdFx0XHRcdGZvciAoIHZhciBpIGluIHBfYmFsYW5jZXJbICd3YWl0JyBdICl7XHJcblx0XHRcdFx0XHRpZiAoXHJcblx0XHRcdFx0XHRcdChyZXNvdXJjZV9pZCA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ3Jlc291cmNlX2lkJyBdKVxyXG5cdFx0XHRcdFx0XHQmJiAoZnVuY3Rpb25fbmFtZSA9PT0gcF9iYWxhbmNlclsgJ3dhaXQnIF1bIGkgXVsgJ2Z1bmN0aW9uX25hbWUnIF0pXHJcblx0XHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0XHRyZW1vdmVkX2VsID0gcF9iYWxhbmNlclsgJ3dhaXQnIF0uc3BsaWNlKCBpLCAxICk7XHJcblx0XHRcdFx0XHRcdHJlbW92ZWRfZWwgPSByZW1vdmVkX2VsLnBvcCgpO1xyXG5cdFx0XHRcdFx0XHRwX2JhbGFuY2VyWyAnd2FpdCcgXSA9IHBfYmFsYW5jZXJbICd3YWl0JyBdLmZpbHRlciggZnVuY3Rpb24gKCB2ICl7XHJcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHY7XHJcblx0XHRcdFx0XHRcdH0gKTtcdFx0XHRcdFx0Ly8gUmVpbmRleCBhcnJheVxyXG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHRcdFx0cmV0dXJuIHJlbW92ZWRfZWw7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQqIElzIGFscmVhZHkgV0FJVFxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3dhaXQgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHRpZiAoIHBfYmFsYW5jZXJbICd3YWl0JyBdLmxlbmd0aCApe1x0XHRcdFx0Ly9GaXhJbjogOS44LjEwLjFcclxuXHRcdFx0XHRmb3IgKCB2YXIgaSBpbiBwX2JhbGFuY2VyWyAnd2FpdCcgXSApe1xyXG5cdFx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0XHQocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0JiYgKGZ1bmN0aW9uX25hbWUgPT09IHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdKVxyXG5cdFx0XHRcdFx0KXtcclxuXHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0IC8qKlxyXG5cdFx0ICAqIEFkZCB0byBSVU5cclxuXHRcdCAgKiBAcGFyYW0gYmFsYW5jZV9vYmpcclxuXHRcdCAgKi9cclxuXHRcdG9iai5iYWxhbmNlcl9fYWRkX3RvX19ydW4gPSBmdW5jdGlvbiAoIGJhbGFuY2Vfb2JqICkge1xyXG5cdFx0XHRwX2JhbGFuY2VyWydpbl9wcm9jZXNzJ10ucHVzaCggYmFsYW5jZV9vYmogKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCogUmVtb3ZlIGZyb20gUlVOIGxpc3RcclxuXHRcdCpcclxuXHRcdCogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQqIEBwYXJhbSBmdW5jdGlvbl9uYW1lXHJcblx0XHQqIEByZXR1cm5zIHsqfGJvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fcnVuX2xpc3QgPSBmdW5jdGlvbiAoIHJlc291cmNlX2lkLCBmdW5jdGlvbl9uYW1lICl7XHJcblxyXG5cdFx0XHQgdmFyIHJlbW92ZWRfZWwgPSBmYWxzZTtcclxuXHJcblx0XHRcdCBpZiAoIHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmxlbmd0aCApe1x0XHRcdFx0Ly9GaXhJbjogOS44LjEwLjFcclxuXHRcdFx0XHQgZm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gKXtcclxuXHRcdFx0XHRcdCBpZiAoXHJcblx0XHRcdFx0XHRcdCAocmVzb3VyY2VfaWQgPT09IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdWyBpIF1bICdyZXNvdXJjZV9pZCcgXSlcclxuXHRcdFx0XHRcdFx0ICYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCApe1xyXG5cdFx0XHRcdFx0XHQgcmVtb3ZlZF9lbCA9IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLnNwbGljZSggaSwgMSApO1xyXG5cdFx0XHRcdFx0XHQgcmVtb3ZlZF9lbCA9IHJlbW92ZWRfZWwucG9wKCk7XHJcblx0XHRcdFx0XHRcdCBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXSA9IHBfYmFsYW5jZXJbICdpbl9wcm9jZXNzJyBdLmZpbHRlciggZnVuY3Rpb24gKCB2ICl7XHJcblx0XHRcdFx0XHRcdFx0IHJldHVybiB2O1xyXG5cdFx0XHRcdFx0XHQgfSApO1x0XHQvLyBSZWluZGV4IGFycmF5XHJcblx0XHRcdFx0XHRcdCByZXR1cm4gcmVtb3ZlZF9lbDtcclxuXHRcdFx0XHRcdCB9XHJcblx0XHRcdFx0IH1cclxuXHRcdFx0IH1cclxuXHRcdFx0IHJldHVybiByZW1vdmVkX2VsO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0KiBJcyBhbHJlYWR5IFJVTlxyXG5cdFx0KlxyXG5cdFx0KiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHRcdCogQHBhcmFtIGZ1bmN0aW9uX25hbWVcclxuXHRcdCogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQqL1xyXG5cdFx0b2JqLmJhbGFuY2VyX19pc19hbHJlYWR5X3J1biA9IGZ1bmN0aW9uICggcmVzb3VyY2VfaWQsIGZ1bmN0aW9uX25hbWUgKXtcclxuXHJcblx0XHRcdGlmICggcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0ubGVuZ3RoICl7XHRcdFx0XHRcdC8vRml4SW46IDkuOC4xMC4xXHJcblx0XHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ2luX3Byb2Nlc3MnIF0gKXtcclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0KHJlc291cmNlX2lkID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0pXHJcblx0XHRcdFx0XHRcdCYmIChmdW5jdGlvbl9uYW1lID09PSBwX2JhbGFuY2VyWyAnaW5fcHJvY2VzcycgXVsgaSBdWyAnZnVuY3Rpb25fbmFtZScgXSlcclxuXHRcdFx0XHRcdCl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cclxuXHJcblx0b2JqLmJhbGFuY2VyX19ydW5fbmV4dCA9IGZ1bmN0aW9uICgpe1xyXG5cclxuXHRcdC8vIEdldCAxc3QgZnJvbSAgV2FpdCBsaXN0XHJcblx0XHR2YXIgcmVtb3ZlZF9lbCA9IGZhbHNlO1xyXG5cdFx0aWYgKCBwX2JhbGFuY2VyWyAnd2FpdCcgXS5sZW5ndGggKXtcdFx0XHRcdFx0Ly9GaXhJbjogOS44LjEwLjFcclxuXHRcdFx0Zm9yICggdmFyIGkgaW4gcF9iYWxhbmNlclsgJ3dhaXQnIF0gKXtcclxuXHRcdFx0XHRyZW1vdmVkX2VsID0gb2JqLmJhbGFuY2VyX19yZW1vdmVfZnJvbV9fd2FpdF9saXN0KCBwX2JhbGFuY2VyWyAnd2FpdCcgXVsgaSBdWyAncmVzb3VyY2VfaWQnIF0sIHBfYmFsYW5jZXJbICd3YWl0JyBdWyBpIF1bICdmdW5jdGlvbl9uYW1lJyBdICk7XHJcblx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRpZiAoIGZhbHNlICE9PSByZW1vdmVkX2VsICl7XHJcblxyXG5cdFx0XHQvLyBSdW5cclxuXHRcdFx0b2JqLmJhbGFuY2VyX19ydW4oIHJlbW92ZWRfZWwgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdCAvKipcclxuXHQgICogUnVuXHJcblx0ICAqIEBwYXJhbSBiYWxhbmNlX29ialxyXG5cdCAgKi9cclxuXHRvYmouYmFsYW5jZXJfX3J1biA9IGZ1bmN0aW9uICggYmFsYW5jZV9vYmogKXtcclxuXHJcblx0XHRzd2l0Y2ggKCBiYWxhbmNlX29ialsgJ2Z1bmN0aW9uX25hbWUnIF0gKXtcclxuXHJcblx0XHRcdGNhc2UgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JzpcclxuXHJcblx0XHRcdFx0Ly8gQWRkIHRvIHJ1biBsaXN0XHJcblx0XHRcdFx0b2JqLmJhbGFuY2VyX19hZGRfdG9fX3J1biggYmFsYW5jZV9vYmogKTtcclxuXHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIGJhbGFuY2Vfb2JqWyAncGFyYW1zJyBdIClcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGRlZmF1bHQ6XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gb2JqO1xyXG5cclxufSggX3dwYmMgfHwge30sIGpRdWVyeSApKTtcclxuXHJcblxyXG4gXHQvKipcclxuIFx0ICogLS0gSGVscCBmdW5jdGlvbnMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JhbGFuY2VyX19pc193YWl0KCBwYXJhbXMsIGZ1bmN0aW9uX25hbWUgKXtcclxuLy9jb25zb2xlLmxvZygnOjp3cGJjX2JhbGFuY2VyX19pc193YWl0JyxwYXJhbXMgLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRpZiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHBhcmFtc1sgJ3Jlc291cmNlX2lkJyBdKSApe1xyXG5cclxuXHRcdFx0dmFyIGJhbGFuY2VyX3N0YXR1cyA9IF93cGJjLmJhbGFuY2VyX19pbml0KCBwYXJhbXNbICdyZXNvdXJjZV9pZCcgXSwgZnVuY3Rpb25fbmFtZSwgcGFyYW1zICk7XHJcblxyXG5cdFx0XHRyZXR1cm4gKCAnd2FpdCcgPT09IGJhbGFuY2VyX3N0YXR1cyApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBmYWxzZTtcclxuXHR9XHJcblxyXG5cclxuXHRmdW5jdGlvbiB3cGJjX2JhbGFuY2VyX19jb21wbGV0ZWQoIHJlc291cmNlX2lkICwgZnVuY3Rpb25fbmFtZSApe1xyXG4vL2NvbnNvbGUubG9nKCc6OndwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCcscmVzb3VyY2VfaWQgLCBmdW5jdGlvbl9uYW1lICk7XHJcblx0XHRfd3BiYy5iYWxhbmNlcl9fcmVtb3ZlX2Zyb21fX3J1bl9saXN0KCByZXNvdXJjZV9pZCwgZnVuY3Rpb25fbmFtZSApO1xyXG5cdFx0X3dwYmMuYmFsYW5jZXJfX3J1bl9uZXh0KCk7XHJcblx0fSIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsL3dwYmNfY2FsLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBPcmRlciBvciBjaGlsZCBib29raW5nIHJlc291cmNlcyBzYXZlZCBoZXJlOiAgXHRfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnIClcdFx0WzIsMTAsMTIsMTFdXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEhvdyB0byBjaGVjayAgYm9va2VkIHRpbWVzIG9uICBzcGVjaWZpYyBkYXRlOiA/XHJcbiAqXHJcblx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpO1xyXG5cclxuXHRcdFx0Y29uc29sZS5sb2coXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzLFxyXG5cdFx0XHRcdFx0XHRfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHMsXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzExXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kcyxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9zZWNvbmRzXHJcblx0XHRcdFx0XHQpO1xyXG4gKiAgT1JcclxuXHRcdFx0Y29uc29sZS5sb2coXHJcblx0XHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoMiwnMjAyMy0wOC0yMScpWzJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTBdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTFdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZSxcclxuXHRcdFx0XHRcdFx0X3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSgyLCcyMDIzLTA4LTIxJylbMTJdLmJvb2tlZF90aW1lX3Nsb3RzLm1lcmdlZF9yZWFkYWJsZVxyXG5cdFx0XHRcdFx0KTtcclxuICpcclxuICovXHJcblxyXG4vKipcclxuICogRGF5cyBzZWxlY3Rpb246XHJcbiAqIFx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX191bnNlbGVjdF9hbGxfZGF0ZXMoIHJlc291cmNlX2lkICk7XHJcbiAqXHJcbiAqXHRcdFx0XHRcdHZhciByZXNvdXJjZV9pZCA9IDE7XHJcbiAqIFx0RXhhbXBsZSAxOlx0XHR2YXIgbnVtX3NlbGVjdGVkX2RheXMgPSB3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCByZXNvdXJjZV9pZCwgJzIwMjQtMDUtMTUnLCAnMjAyNC0wNS0yNScgKTtcclxuICogXHRFeGFtcGxlIDI6XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIHJlc291cmNlX2lkLCBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0yNSddICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuXHJcbi8qKlxyXG4gKiBDIEEgTCBFIE4gRCBBIFIgIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gKi9cclxuXHJcblxyXG4vKipcclxuICogIFNob3cgV1BCQyBDYWxlbmRhclxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0XHQtIHJlc291cmNlIElEXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBJZiBubyBjYWxlbmRhciBIVE1MIHRhZywgIHRoZW4gIGV4aXRcclxuXHRpZiAoIDAgPT09IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkubGVuZ3RoICl7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHQvLyBJZiB0aGUgY2FsZW5kYXIgd2l0aCB0aGUgc2FtZSBCb29raW5nIHJlc291cmNlIGlzIGFjdGl2YXRlZCBhbHJlYWR5LCB0aGVuIGV4aXQuXHJcblx0aWYgKCB0cnVlID09PSBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmhhc0NsYXNzKCAnaGFzRGF0ZXBpY2snICkgKXsgcmV0dXJuIGZhbHNlOyB9XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRGF5cyBzZWxlY3Rpb25cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBsb2NhbF9faXNfcmFuZ2Vfc2VsZWN0ID0gZmFsc2U7XHJcblx0dmFyIGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gICA9IDM2NTtcdFx0XHRcdFx0Ly8gbXVsdGlwbGUgfCBmaXhlZFxyXG5cdGlmICggJ2R5bmFtaWMnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdGxvY2FsX19pc19yYW5nZV9zZWxlY3QgPSB0cnVlO1xyXG5cdFx0bG9jYWxfX211bHRpX2RheXNfc2VsZWN0X251bSA9IDA7XHJcblx0fVxyXG5cdGlmICggJ3NpbmdsZScgID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0gPSAwO1xyXG5cdH1cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBNaW4gLSBNYXggZGF5cyB0byBzY3JvbGwvc2hvd1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIGxvY2FsX19taW5fZGF0ZSA9IDA7XHJcbiBcdGxvY2FsX19taW5fZGF0ZSA9IG5ldyBEYXRlKCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDAgXSwgKHBhcnNlSW50KCBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICd0b2RheV9hcnInIClbIDEgXSApIC0gMSksIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMiBdLCAwLCAwLCAwICk7XHRcdFx0Ly9GaXhJbjogOS45LjAuMTdcclxuLy9jb25zb2xlLmxvZyggbG9jYWxfX21pbl9kYXRlICk7XHJcblx0dmFyIGxvY2FsX19tYXhfZGF0ZSA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19tYXhfbW9udGhlc19pbl9jYWxlbmRhcicgKTtcclxuXHQvL2xvY2FsX19tYXhfZGF0ZSA9IG5ldyBEYXRlKDIwMjQsIDUsIDI4KTsgIEl0IGlzIGhlcmUgaXNzdWUgb2Ygbm90IHNlbGVjdGFibGUgZGF0ZXMsIGJ1dCBzb21lIGRhdGVzIHNob3dpbmcgaW4gY2FsZW5kYXIgYXMgYXZhaWxhYmxlLCBidXQgd2UgY2FuIG5vdCBzZWxlY3QgaXQuXHJcblxyXG5cdC8vLy8gRGVmaW5lIGxhc3QgZGF5IGluIGNhbGVuZGFyIChhcyBhIGxhc3QgZGF5IG9mIG1vbnRoIChhbmQgbm90IGRhdGUsIHdoaWNoIGlzIHJlbGF0ZWQgdG8gYWN0dWFsICdUb2RheScgZGF0ZSkuXHJcblx0Ly8vLyBFLmcuIGlmIHRvZGF5IGlzIDIwMjMtMDktMjUsIGFuZCB3ZSBzZXQgJ051bWJlciBvZiBtb250aHMgdG8gc2Nyb2xsJyBhcyA1IG1vbnRocywgdGhlbiBsYXN0IGRheSB3aWxsIGJlIDIwMjQtMDItMjkgYW5kIG5vdCB0aGUgMjAyNC0wMi0yNS5cclxuXHQvLyB2YXIgY2FsX2xhc3RfZGF5X2luX21vbnRoID0galF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBudWxsLCBsb2NhbF9fbWF4X2RhdGUsIG5ldyBEYXRlKCkgKTtcclxuXHQvLyBjYWxfbGFzdF9kYXlfaW5fbW9udGggPSBuZXcgRGF0ZSggY2FsX2xhc3RfZGF5X2luX21vbnRoLmdldEZ1bGxZZWFyKCksIGNhbF9sYXN0X2RheV9pbl9tb250aC5nZXRNb250aCgpICsgMSwgMCApO1xyXG5cdC8vIGxvY2FsX19tYXhfZGF0ZSA9IGNhbF9sYXN0X2RheV9pbl9tb250aDtcdFx0XHQvL0ZpeEluOiAxMC4wLjAuMjZcclxuXHJcblx0aWYgKCAgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCdwYWdlPXdwYmMtbmV3JykgIT0gLTEgKVxyXG5cdFx0JiYgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoJ2Jvb2tpbmdfaGFzaCcpICE9IC0xICkgICAgICAgICAgICAgICAgICAvLyBDb21tZW50IHRoaXMgbGluZSBmb3IgYWJpbGl0eSB0byBhZGQgIGJvb2tpbmcgaW4gcGFzdCBkYXlzIGF0ICBCb29raW5nID4gQWRkIGJvb2tpbmcgcGFnZS5cclxuXHRcdCl7XHJcblx0XHRsb2NhbF9fbWluX2RhdGUgPSBudWxsO1xyXG5cdFx0bG9jYWxfX21heF9kYXRlID0gbnVsbDtcclxuXHR9XHJcblxyXG5cdHZhciBsb2NhbF9fc3RhcnRfd2Vla2RheSAgICA9IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnYm9va2luZ19zdGFydF9kYXlfd2VlZWsnICk7XHJcblx0dmFyIGxvY2FsX19udW1iZXJfb2ZfbW9udGhzID0gcGFyc2VJbnQoIF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnY2FsZW5kYXJfbnVtYmVyX29mX21vbnRocycgKSApO1xyXG5cclxuXHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnRleHQoICcnICk7XHRcdFx0XHRcdC8vIFJlbW92ZSBhbGwgSFRNTCBpbiBjYWxlbmRhciB0YWdcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNob3cgY2FsZW5kYXJcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdGpRdWVyeSgnI2NhbGVuZGFyX2Jvb2tpbmcnKyByZXNvdXJjZV9pZCkuZGF0ZXBpY2soXHJcblx0XHRcdHtcclxuXHRcdFx0XHRiZWZvcmVTaG93RGF5OiBmdW5jdGlvbiAoIGpzX2RhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cygganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvblNlbGVjdDogZnVuY3Rpb24gKCBzdHJpbmdfZGF0ZXMsIGpzX2RhdGVzX2FyciApeyAgLyoqXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKlx0c3RyaW5nX2RhdGVzICAgPSAgICcyMy4wOC4yMDIzIC0gMjYuMDguMjAyMycgICAgfCAgICAnMjMuMDguMjAyMyAtIDIzLjA4LjIwMjMnICAgIHwgICAgJzE5LjA5LjIwMjMsIDI0LjA4LjIwMjMsIDMwLjA5LjIwMjMnXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKiAganNfZGF0ZXNfYXJyICAgPSAgIHJhbmdlOiBbIERhdGUgKEF1ZyAyMyAyMDIzKSwgRGF0ZSAoQXVnIDI1IDIwMjMpXSAgICAgfCAgICAgbXVsdGlwbGU6IFsgRGF0ZShPY3QgMjQgMjAyMyksIERhdGUoT2N0IDIwIDIwMjMpLCBEYXRlKE9jdCAxNiAyMDIzKSBdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgKi9cclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9zZWxlY3RfZGF5cyggc3RyaW5nX2RhdGVzLCB7J3Jlc291cmNlX2lkJzogcmVzb3VyY2VfaWR9LCB0aGlzICk7XHJcblx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdG9uSG92ZXI6IGZ1bmN0aW9uICggc3RyaW5nX2RhdGUsIGpzX2RhdGUgKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHdwYmNfX2NhbGVuZGFyX19vbl9ob3Zlcl9kYXlzKCBzdHJpbmdfZGF0ZSwganNfZGF0ZSwgeydyZXNvdXJjZV9pZCc6IHJlc291cmNlX2lkfSwgdGhpcyApO1xyXG5cdFx0XHRcdFx0XHRcdCAgfSxcclxuXHRcdFx0XHRvbkNoYW5nZU1vbnRoWWVhcjogZnVuY3Rpb24gKCB5ZWFyLCByZWFsX21vbnRoLCBqc19kYXRlX18xc3RfZGF5X2luX21vbnRoICl7IH0sXHJcblx0XHRcdFx0c2hvd09uICAgICAgICA6ICdib3RoJyxcclxuXHRcdFx0XHRudW1iZXJPZk1vbnRoczogbG9jYWxfX251bWJlcl9vZl9tb250aHMsXHJcblx0XHRcdFx0c3RlcE1vbnRocyAgICA6IDEsXHJcblx0XHRcdFx0Ly8gcHJldlRleHQgICAgICA6ICcmbGFxdW87JyxcclxuXHRcdFx0XHQvLyBuZXh0VGV4dCAgICAgIDogJyZyYXF1bzsnLFxyXG5cdFx0XHRcdHByZXZUZXh0ICAgICAgOiAnJmxzYXF1bzsnLFxyXG5cdFx0XHRcdG5leHRUZXh0ICAgICAgOiAnJnJzYXF1bzsnLFxyXG5cdFx0XHRcdGRhdGVGb3JtYXQgICAgOiAnZGQubW0ueXknLFxyXG5cdFx0XHRcdGNoYW5nZU1vbnRoICAgOiBmYWxzZSxcclxuXHRcdFx0XHRjaGFuZ2VZZWFyICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bWluRGF0ZSAgICAgICA6IGxvY2FsX19taW5fZGF0ZSxcclxuXHRcdFx0XHRtYXhEYXRlICAgICAgIDogbG9jYWxfX21heF9kYXRlLCBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzFZJyxcclxuXHRcdFx0XHQvLyBtaW5EYXRlOiBuZXcgRGF0ZSgyMDIwLCAyLCAxKSwgbWF4RGF0ZTogbmV3IERhdGUoMjAyMCwgOSwgMzEpLCAgICAgICAgICAgICBcdC8vIEFiaWxpdHkgdG8gc2V0IGFueSAgc3RhcnQgYW5kIGVuZCBkYXRlIGluIGNhbGVuZGFyXHJcblx0XHRcdFx0c2hvd1N0YXR1cyAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0bXVsdGlTZXBhcmF0b3IgIDogJywgJyxcclxuXHRcdFx0XHRjbG9zZUF0VG9wICAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRmaXJzdERheSAgICAgICAgOiBsb2NhbF9fc3RhcnRfd2Vla2RheSxcclxuXHRcdFx0XHRnb3RvQ3VycmVudCAgICAgOiBmYWxzZSxcclxuXHRcdFx0XHRoaWRlSWZOb1ByZXZOZXh0OiB0cnVlLFxyXG5cdFx0XHRcdG11bHRpU2VsZWN0ICAgICA6IGxvY2FsX19tdWx0aV9kYXlzX3NlbGVjdF9udW0sXHJcblx0XHRcdFx0cmFuZ2VTZWxlY3QgICAgIDogbG9jYWxfX2lzX3JhbmdlX3NlbGVjdCxcclxuXHRcdFx0XHQvLyBzaG93V2Vla3M6IHRydWUsXHJcblx0XHRcdFx0dXNlVGhlbWVSb2xsZXI6IGZhbHNlXHJcblx0XHRcdH1cclxuXHQpO1xyXG5cclxuXHJcblx0XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBDbGVhciB0b2RheSBkYXRlIGhpZ2hsaWdodGluZ1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0c2V0VGltZW91dCggZnVuY3Rpb24gKCl7ICB3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICk7ICB9LCA1MDAgKTsgICAgICAgICAgICAgICAgICAgIFx0Ly9GaXhJbjogNy4xLjIuOFxyXG5cdFxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gU2Nyb2xsIGNhbGVuZGFyIHRvICBzcGVjaWZpYyBtb250aFxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0dmFyIHN0YXJ0X2JrX21vbnRoID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9zY3JvbGxfdG8nICk7XHJcblx0aWYgKCBmYWxzZSAhPT0gc3RhcnRfYmtfbW9udGggKXtcclxuXHRcdHdwYmNfY2FsZW5kYXJfX3Njcm9sbF90byggcmVzb3VyY2VfaWQsIHN0YXJ0X2JrX21vbnRoWyAwIF0sIHN0YXJ0X2JrX21vbnRoWyAxIF0gKTtcclxuXHR9XHJcbn1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEFwcGx5IENTUyB0byBjYWxlbmRhciBkYXRlIGNlbGxzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHRcdFx0XHRcdFx0LSAgSmF2YVNjcmlwdCBEYXRlIE9iajogIFx0XHRNb24gRGVjIDExIDIwMjMgMDA6MDA6MDAgR01UKzAyMDAgKEVhc3Rlcm4gRXVyb3BlYW4gU3RhbmRhcmQgVGltZSlcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0XHRcdFx0XHRcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFx0XHRcdFx0XHRcdFwicmVzb3VyY2VfaWRcIjogNFxyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0XHRcdFx0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKiBAcmV0dXJucyB7KCp8c3RyaW5nKVtdfChib29sZWFufHN0cmluZylbXX1cdFx0LSBbIHt0cnVlIC1hdmFpbGFibGUgfCBmYWxzZSAtIHVuYXZhaWxhYmxlfSwgJ0NTUyBjbGFzc2VzIGZvciBjYWxlbmRhciBkYXkgY2VsbCcgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2NhbGVuZGFyX19hcHBseV9jc3NfdG9fZGF5cyggZGF0ZSwgY2FsZW5kYXJfcGFyYW1zX2FyciwgZGF0ZXBpY2tfdGhpcyApe1xyXG5cclxuXHRcdHZhciB0b2RheV9kYXRlID0gbmV3IERhdGUoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMCBdLCAocGFyc2VJbnQoIF93cGJjLmdldF9vdGhlcl9wYXJhbSggJ3RvZGF5X2FycicgKVsgMSBdICkgLSAxKSwgX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAndG9kYXlfYXJyJyApWyAyIF0sIDAsIDAsIDAgKTtcdFx0XHRcdFx0XHRcdFx0Ly8gVG9kYXkgSlNfRGF0ZV9PYmouXHJcblx0XHR2YXIgY2xhc3NfZGF5ICAgICA9IHdwYmNfX2dldF9fdGRfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcxLTktMjAyMydcclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vICcyMDIzLTAxLTA5J1xyXG5cdFx0dmFyIHJlc291cmNlX2lkID0gKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSkgKSA/IGNhbGVuZGFyX3BhcmFtc19hcnJbICdyZXNvdXJjZV9pZCcgXSA6ICcxJzsgXHRcdC8vICcxJ1xyXG5cclxuXHRcdC8vIEdldCBTZWxlY3RlZCBkYXRlcyBpbiBjYWxlbmRhclxyXG5cdFx0dmFyIHNlbGVjdGVkX2RhdGVzX3NxbCA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHQvLyBHZXQgRGF0YSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGRhdGVfYm9va2luZ3Nfb2JqID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblxyXG5cdFx0Ly8gQXJyYXkgd2l0aCBDU1MgY2xhc3NlcyBmb3IgZGF0ZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBjc3NfY2xhc3Nlc19fZm9yX2RhdGUgPSBbXTtcclxuXHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc3FsX2RhdGVfJyAgICAgKyBzcWxfY2xhc3NfZGF5ICk7XHRcdFx0XHQvLyAgJ3NxbF9kYXRlXzIwMjMtMDctMjEnXHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NhbDRkYXRlLScgICAgICsgY2xhc3NfZGF5ICk7XHRcdFx0XHRcdC8vICAnY2FsNGRhdGUtNy0yMS0yMDIzJ1xyXG5cdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd3cGJjX3dlZWtkYXlfJyArIGRhdGUuZ2V0RGF5KCkgKTtcdFx0XHRcdC8vICAnd3BiY193ZWVrZGF5XzQnXHJcblxyXG5cdFx0Ly8gRGVmaW5lIFNlbGVjdGVkIENoZWNrIEluL091dCBkYXRlcyBpbiBURCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdGlmIChcclxuXHRcdFx0XHQoIHNlbGVjdGVkX2RhdGVzX3NxbC5sZW5ndGggIClcclxuXHRcdFx0Ly8mJiAgKCBzZWxlY3RlZF9kYXRlc19zcWxbIDAgXSAhPT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAoc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCAtIDEpIF0gKVxyXG5cdFx0KXtcclxuXHRcdFx0aWYgKCBzcWxfY2xhc3NfZGF5ID09PSBzZWxlY3RlZF9kYXRlc19zcWxbIDAgXSApe1xyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnc2VsZWN0ZWRfY2hlY2tfaW4nICk7XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdzZWxlY3RlZF9jaGVja19pbl9vdXQnICk7XHJcblx0XHRcdH1cclxuXHRcdFx0aWYgKCAgKCBzZWxlY3RlZF9kYXRlc19zcWwubGVuZ3RoID4gMSApICYmICggc3FsX2NsYXNzX2RheSA9PT0gc2VsZWN0ZWRfZGF0ZXNfc3FsWyAoc2VsZWN0ZWRfZGF0ZXNfc3FsLmxlbmd0aCAtIDEpIF0gKSApIHtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX291dCcgKTtcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3NlbGVjdGVkX2NoZWNrX2luX291dCcgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHR2YXIgaXNfZGF5X3NlbGVjdGFibGUgPSBmYWxzZTtcclxuXHJcblx0XHQvLyBJZiBzb21ldGhpbmcgbm90IGRlZmluZWQsICB0aGVuICB0aGlzIGRhdGUgY2xvc2VkIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0aWYgKCBmYWxzZSA9PT0gZGF0ZV9ib29raW5nc19vYmogKXtcclxuXHJcblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJyApO1xyXG5cclxuXHRcdFx0cmV0dXJuIFsgaXNfZGF5X3NlbGVjdGFibGUsIGNzc19jbGFzc2VzX19mb3JfZGF0ZS5qb2luKCcgJykgIF07XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgIGRhdGVfYm9va2luZ3Nfb2JqICAtIERlZmluZWQuICAgICAgICAgICAgRGF0ZXMgY2FuIGJlIHNlbGVjdGFibGUuXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBBZGQgc2Vhc29uIG5hbWVzIHRvIHRoZSBkYXkgQ1NTIGNsYXNzZXMgLS0gaXQgaXMgcmVxdWlyZWQgZm9yIGNvcnJlY3QgIHdvcmsgIG9mIGNvbmRpdGlvbmFsIGZpZWxkcyAtLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIHNlYXNvbl9uYW1lc19hcnIgPSBfd3BiYy5zZWFzb25zX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfY2xhc3NfZGF5ICk7XHJcblxyXG5cdFx0Zm9yICggdmFyIHNlYXNvbl9rZXkgaW4gc2Vhc29uX25hbWVzX2FyciApe1xyXG5cclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goIHNlYXNvbl9uYW1lc19hcnJbIHNlYXNvbl9rZXkgXSApO1x0XHRcdFx0Ly8gICd3cGRldmJrX3NlYXNvbl9zZXB0ZW1iZXJfMjAyMydcclxuXHRcdH1cclxuXHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cclxuXHRcdC8vIENvc3QgUmF0ZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3JhdGVfJyArIGRhdGVfYm9va2luZ3Nfb2JqWyByZXNvdXJjZV9pZCBdWyAnZGF0ZV9jb3N0X3JhdGUnIF0udG9TdHJpbmcoKS5yZXBsYWNlKCAvW1xcLlxcc10vZywgJ18nICkgKTtcdFx0XHRcdFx0XHQvLyAgJ3JhdGVfOTlfMDAnIC0+IDk5LjAwXHJcblxyXG5cclxuXHRcdGlmICggcGFyc2VJbnQoIGRhdGVfYm9va2luZ3Nfb2JqWyAnZGF5X2F2YWlsYWJpbGl0eScgXSApID4gMCApe1xyXG5cdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IHRydWU7XHJcblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV9hdmFpbGFibGUnICk7XHJcblx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAncmVzZXJ2ZWRfZGF5c19jb3VudCcgKyBwYXJzZUludCggZGF0ZV9ib29raW5nc19vYmpbICdtYXhfY2FwYWNpdHknIF0gLSBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSBmYWxzZTtcclxuXHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnICk7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdHN3aXRjaCAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2RheScgXSApe1xyXG5cclxuXHRcdFx0Y2FzZSAnYXZhaWxhYmxlJzpcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ3RpbWVfc2xvdHNfYm9va2luZyc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICd0aW1lc3BhcnRseScsICd0aW1lc19jbG9jaycgKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2Z1bGxfZGF5X2Jvb2tpbmcnOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZnVsbF9kYXlfYm9va2luZycgKTtcclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ3NlYXNvbl9maWx0ZXInOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ3NlYXNvbl91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAncmVzb3VyY2VfYXZhaWxhYmlsaXR5JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2RhdGVfdXNlcl91bmF2YWlsYWJsZScsICdyZXNvdXJjZV91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnd2Vla2RheV91bmF2YWlsYWJsZSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnd2Vla2RheV91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnZnJvbV90b2RheV91bmF2YWlsYWJsZSc6XHJcblx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlX3VzZXJfdW5hdmFpbGFibGUnLCAnZnJvbV90b2RheV91bmF2YWlsYWJsZScgKTtcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSA9ICcnO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBSZXNldCBib29raW5nIHN0YXR1cyBjb2xvciBmb3IgcG9zc2libGUgb2xkIGJvb2tpbmdzIG9uIHRoaXMgZGF0ZVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnbGltaXRfYXZhaWxhYmxlX2Zyb21fdG9kYXknOlxyXG5cdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV91c2VyX3VuYXZhaWxhYmxlJywgJ2xpbWl0X2F2YWlsYWJsZV9mcm9tX3RvZGF5JyApO1xyXG5cdFx0XHRcdGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeSddWydzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdID0gJyc7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFJlc2V0IGJvb2tpbmcgc3RhdHVzIGNvbG9yIGZvciBwb3NzaWJsZSBvbGQgYm9va2luZ3Mgb24gdGhpcyBkYXRlXHJcblx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRjYXNlICdjaGFuZ2Vfb3Zlcic6XHJcblx0XHRcdFx0LypcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUgXHQgXHRjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZVxyXG5cdFx0XHRcdC8vICBjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUgXHQgXHRjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWRcclxuXHRcdFx0XHQvLyAgY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUgXHRcdCBcdGNoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWRcclxuXHRcdFx0XHQvLyAgY2hlY2tfb3V0X3RpbWVfZGF0ZV9hcHByb3ZlZCBcdCBcdGNoZWNrX2luX3RpbWVfZGF0ZV9hcHByb3ZlZFxyXG5cdFx0XHRcdCAqL1xyXG5cclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX2luX3RpbWUnLCAnY2hlY2tfb3V0X3RpbWUnICk7XHJcblx0XHRcdFx0Ly9GaXhJbjogMTAuMC4wLjJcclxuXHRcdFx0XHRpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ2FwcHJvdmVkX3BlbmRpbmcnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRpZiAoIGRhdGVfYm9va2luZ3Nfb2JqWyAnc3VtbWFyeScgXVsgJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0uaW5kZXhPZiggJ3BlbmRpbmdfYXBwcm92ZWQnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlMmFwcHJvdmUnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdGNhc2UgJ2NoZWNrX2luJzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX2luX3RpbWUnICk7XHJcblxyXG5cdFx0XHRcdC8vRml4SW46IDkuOS4wLjMzXHJcblx0XHRcdFx0aWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdwZW5kaW5nJyApID4gLTEgKXtcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnY2hlY2tfaW5fdGltZV9kYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0fSBlbHNlIGlmICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5ncycgXS5pbmRleE9mKCAnYXBwcm92ZWQnICkgPiAtMSApe1xyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0Y2FzZSAnY2hlY2tfb3V0JzpcclxuXHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ3RpbWVzcGFydGx5JywgJ2NoZWNrX291dF90aW1lJyApO1xyXG5cclxuXHRcdFx0XHQvL0ZpeEluOiA5LjkuMC4zM1xyXG5cdFx0XHRcdGlmICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdWyAnc3RhdHVzX2Zvcl9ib29raW5ncycgXS5pbmRleE9mKCAncGVuZGluZycgKSA+IC0xICl7XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHR9IGVsc2UgaWYgKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknIF1bICdzdGF0dXNfZm9yX2Jvb2tpbmdzJyBdLmluZGV4T2YoICdhcHByb3ZlZCcgKSA+IC0xICl7XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0XHQvLyBtaXhlZCBzdGF0dXNlczogJ2NoYW5nZV9vdmVyIGNoZWNrX291dCcgLi4uLiB2YXJpYXRpb25zLi4uLiBjaGVjayBtb3JlIGluIFx0XHRmdW5jdGlvbiB3cGJjX2dldF9hdmFpbGFiaWxpdHlfcGVyX2RheXNfYXJyKClcclxuXHRcdFx0XHRkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9kYXknIF0gPSAnYXZhaWxhYmxlJztcclxuXHRcdH1cclxuXHJcblxyXG5cclxuXHRcdGlmICggJ2F2YWlsYWJsZScgIT0gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHR2YXIgaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgKTtcdC8vIHNldCBwZW5kaW5nIGRheXMgc2VsZWN0YWJsZSAgICAgICAgICAvL0ZpeEluOiA4LjYuMS4xOFxyXG5cclxuXHRcdFx0c3dpdGNoICggZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfYm9va2luZ3MnIF0gKXtcclxuXHJcblx0XHRcdFx0Y2FzZSAnJzpcclxuXHRcdFx0XHRcdC8vIFVzdWFsbHkgIGl0J3MgbWVhbnMgdGhhdCBkYXkgIGlzIGF2YWlsYWJsZSBvciB1bmF2YWlsYWJsZSB3aXRob3V0IHRoZSBib29raW5nc1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmcnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdkYXRlMmFwcHJvdmUnICk7XHJcblx0XHRcdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IChpc19kYXlfc2VsZWN0YWJsZSkgPyB0cnVlIDogaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2FwcHJvdmVkJzpcclxuXHRcdFx0XHRcdGNzc19jbGFzc2VzX19mb3JfZGF0ZS5wdXNoKCAnZGF0ZV9hcHByb3ZlZCcgKTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHQvLyBTaXR1YXRpb25zIGZvciBcImNoYW5nZS1vdmVyXCIgZGF5czogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmdfcGVuZGluZyc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScsICdjaGVja19pbl90aW1lX2RhdGUyYXBwcm92ZScgKTtcclxuXHRcdFx0XHRcdGlzX2RheV9zZWxlY3RhYmxlID0gKGlzX2RheV9zZWxlY3RhYmxlKSA/IHRydWUgOiBpc19zZXRfcGVuZGluZ19kYXlzX3NlbGVjdGFibGU7XHJcblx0XHRcdFx0XHRicmVhaztcclxuXHJcblx0XHRcdFx0Y2FzZSAncGVuZGluZ19hcHByb3ZlZCc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGUyYXBwcm92ZScsICdjaGVja19pbl90aW1lX2RhdGVfYXBwcm92ZWQnICk7XHJcblx0XHRcdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IChpc19kYXlfc2VsZWN0YWJsZSkgPyB0cnVlIDogaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGNhc2UgJ2FwcHJvdmVkX3BlbmRpbmcnOlxyXG5cdFx0XHRcdFx0Y3NzX2NsYXNzZXNfX2Zvcl9kYXRlLnB1c2goICdjaGVja19vdXRfdGltZV9kYXRlX2FwcHJvdmVkJywgJ2NoZWNrX2luX3RpbWVfZGF0ZTJhcHByb3ZlJyApO1xyXG5cdFx0XHRcdFx0aXNfZGF5X3NlbGVjdGFibGUgPSAoaXNfZGF5X3NlbGVjdGFibGUpID8gdHJ1ZSA6IGlzX3NldF9wZW5kaW5nX2RheXNfc2VsZWN0YWJsZTtcclxuXHRcdFx0XHRcdGJyZWFrO1xyXG5cclxuXHRcdFx0XHRjYXNlICdhcHByb3ZlZF9hcHByb3ZlZCc6XHJcblx0XHRcdFx0XHRjc3NfY2xhc3Nlc19fZm9yX2RhdGUucHVzaCggJ2NoZWNrX291dF90aW1lX2RhdGVfYXBwcm92ZWQnLCAnY2hlY2tfaW5fdGltZV9kYXRlX2FwcHJvdmVkJyApO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblxyXG5cdFx0XHRcdGRlZmF1bHQ6XHJcblxyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIFsgaXNfZGF5X3NlbGVjdGFibGUsIGNzc19jbGFzc2VzX19mb3JfZGF0ZS5qb2luKCAnICcgKSBdO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIE1vdXNlb3ZlciBjYWxlbmRhciBkYXRlIGNlbGxzXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gc3RyaW5nX2RhdGVcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0XHRcdFx0XHRcdFx0LSAgSmF2YVNjcmlwdCBEYXRlIE9iajogIFx0XHRNb24gRGVjIDExIDIwMjMgMDA6MDA6MDAgR01UKzAyMDAgKEVhc3Rlcm4gRXVyb3BlYW4gU3RhbmRhcmQgVGltZSlcclxuXHQgKiBAcGFyYW0gY2FsZW5kYXJfcGFyYW1zX2Fyclx0XHRcdFx0XHRcdC0gIENhbGVuZGFyIFNldHRpbmdzIE9iamVjdDogIFx0e1xyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIFx0XHRcdFx0XHRcdFwicmVzb3VyY2VfaWRcIjogNFxyXG5cdCAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdCAqIEBwYXJhbSBkYXRlcGlja190aGlzXHRcdFx0XHRcdFx0XHRcdC0gdGhpcyBvZiBkYXRlcGljayBPYmpcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fb25faG92ZXJfZGF5cyggc3RyaW5nX2RhdGUsIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKSB7XHJcblxyXG5cdFx0aWYgKCBudWxsID09PSBkYXRlICl7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHRcdHZhciBjbGFzc19kYXkgICAgID0gd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzEtOS0yMDIzJ1xyXG5cdFx0dmFyIHNxbF9jbGFzc19kYXkgPSB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlICk7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gJzIwMjMtMDEtMDknXHJcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSApID8gY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdIDogJzEnO1x0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBHZXQgRGF0YSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGRhdGVfYm9va2luZ19vYmogPSBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKCByZXNvdXJjZV9pZCwgc3FsX2NsYXNzX2RheSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyB7Li4ufVxyXG5cclxuXHRcdGlmICggISBkYXRlX2Jvb2tpbmdfb2JqICl7IHJldHVybiBmYWxzZTsgfVxyXG5cclxuXHJcblx0XHQvLyBUIG8gbyBsIHQgaSBwIHMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIHRvb2x0aXBfdGV4dCA9ICcnO1xyXG5cdFx0aWYgKCBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2F2YWlsYWJpbGl0eScgXS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHRvb2x0aXBfdGV4dCArPSAgZGF0ZV9ib29raW5nX29ialsgJ3N1bW1hcnknXVsndG9vbHRpcF9hdmFpbGFiaWxpdHknIF07XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfZGF5X2Nvc3QnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfZGF5X2Nvc3QnIF07XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfdGltZXMnIF0ubGVuZ3RoID4gMCApe1xyXG5cdFx0XHR0b29sdGlwX3RleHQgKz0gIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfdGltZXMnIF07XHJcblx0XHR9XHJcblx0XHRpZiAoIGRhdGVfYm9va2luZ19vYmpbICdzdW1tYXJ5J11bJ3Rvb2x0aXBfYm9va2luZ19kZXRhaWxzJyBdLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0dG9vbHRpcF90ZXh0ICs9ICBkYXRlX2Jvb2tpbmdfb2JqWyAnc3VtbWFyeSddWyd0b29sdGlwX2Jvb2tpbmdfZGV0YWlscycgXTtcclxuXHRcdH1cclxuXHRcdHdwYmNfc2V0X3Rvb2x0aXBfX19mb3JfX2NhbGVuZGFyX2RhdGUoIHRvb2x0aXBfdGV4dCwgcmVzb3VyY2VfaWQsIGNsYXNzX2RheSApO1xyXG5cclxuXHJcblxyXG5cdFx0Ly8gIFUgbiBoIG8gdiBlIHIgaSBuIGcgICAgaW4gICAgVU5TRUxFQ1RBQkxFX0NBTEVOREFSICAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdHZhciBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgPSAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZScgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDApO1x0XHRcdFx0Ly9GaXhJbjogOC4wLjEuMlxyXG5cdFx0dmFyIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCAgICA9ICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICk7XHJcblxyXG5cdFx0aWYgKCAoIGlzX3Vuc2VsZWN0YWJsZV9jYWxlbmRhciApICYmICggISBpc19ib29raW5nX2Zvcm1fZXhpc3QgKSApe1xyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqICBVbiBIb3ZlciBhbGwgZGF0ZXMgaW4gY2FsZW5kYXIgKHdpdGhvdXQgdGhlIGJvb2tpbmcgZm9ybSksIGlmIG9ubHkgQXZhaWxhYmlsaXR5IENhbGVuZGFyIGhlcmUgYW5kIHdlIGRvIG5vdCBpbnNlcnQgQm9va2luZyBmb3JtIGJ5IG1pc3Rha2UuXHJcblx0XHRcdCAqL1xyXG5cclxuXHRcdFx0d3BiY19jYWxlbmRhcnNfX2NsZWFyX2RheXNfaGlnaGxpZ2h0aW5nKCByZXNvdXJjZV9pZCApOyBcdFx0XHRcdFx0XHRcdC8vIENsZWFyIGRheXMgaGlnaGxpZ2h0aW5nXHJcblxyXG5cdFx0XHR2YXIgY3NzX29mX2NhbGVuZGFyID0gJy53cGJjX29ubHlfY2FsZW5kYXIgI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQ7XHJcblx0XHRcdGpRdWVyeSggY3NzX29mX2NhbGVuZGFyICsgJyAuZGF0ZXBpY2stZGF5cy1jZWxsLCAnXHJcblx0XHRcdFx0ICArIGNzc19vZl9jYWxlbmRhciArICcgLmRhdGVwaWNrLWRheXMtY2VsbCBhJyApLmNzcyggJ2N1cnNvcicsICdkZWZhdWx0JyApO1x0Ly8gU2V0IGN1cnNvciB0byBEZWZhdWx0XHJcblx0XHRcdHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblxyXG5cclxuXHRcdC8vICBEIGEgeSBzICAgIEggbyB2IGUgciBpIG4gZyAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRpZiAoXHJcblx0XHRcdCAgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjJyApID09IC0xIClcclxuXHRcdFx0fHwgKCBsb2NhdGlvbi5ocmVmLmluZGV4T2YoICdwYWdlPXdwYmMtbmV3JyApID4gMCApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLXNldHVwJyApID4gMCApXHJcblx0XHRcdHx8ICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAncGFnZT13cGJjLWF2YWlsYWJpbGl0eScgKSA+IDAgKVxyXG5cdFx0XHR8fCAoICAoIGxvY2F0aW9uLmhyZWYuaW5kZXhPZiggJ3BhZ2U9d3BiYy1zZXR0aW5ncycgKSA+IDAgKSAgJiZcclxuXHRcdFx0XHQgICggbG9jYXRpb24uaHJlZi5pbmRleE9mKCAnJnRhYj1mb3JtJyApID4gMCApXHJcblx0XHRcdCAgIClcclxuXHRcdCl7XHJcblx0XHRcdC8vIFRoZSBzYW1lIGFzIGRhdGVzIHNlbGVjdGlvbiwgIGJ1dCBmb3IgZGF5cyBob3ZlcmluZ1xyXG5cclxuXHRcdFx0aWYgKCAnZnVuY3Rpb24nID09IHR5cGVvZiggd3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X19icyApICl7XHJcblx0XHRcdFx0d3BiY19fY2FsZW5kYXJfX2RvX2RheXNfaGlnaGxpZ2h0X19icyggc3FsX2NsYXNzX2RheSwgZGF0ZSwgcmVzb3VyY2VfaWQgKTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBTZWxlY3QgY2FsZW5kYXIgZGF0ZSBjZWxsc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRcdFx0XHRcdFx0XHRcdC0gIEphdmFTY3JpcHQgRGF0ZSBPYmo6ICBcdFx0TW9uIERlYyAxMSAyMDIzIDAwOjAwOjAwIEdNVCswMjAwIChFYXN0ZXJuIEV1cm9wZWFuIFN0YW5kYXJkIFRpbWUpXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX3BhcmFtc19hcnJcdFx0XHRcdFx0XHQtICBDYWxlbmRhciBTZXR0aW5ncyBPYmplY3Q6ICBcdHtcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICBcdFx0XHRcdFx0XHRcInJlc291cmNlX2lkXCI6IDRcclxuXHQgKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHQgKiBAcGFyYW0gZGF0ZXBpY2tfdGhpc1x0XHRcdFx0XHRcdFx0XHQtIHRoaXMgb2YgZGF0ZXBpY2sgT2JqXHJcblx0ICpcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fb25fc2VsZWN0X2RheXMoIGRhdGUsIGNhbGVuZGFyX3BhcmFtc19hcnIsIGRhdGVwaWNrX3RoaXMgKXtcclxuXHJcblx0XHR2YXIgcmVzb3VyY2VfaWQgPSAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdKSApID8gY2FsZW5kYXJfcGFyYW1zX2FyclsgJ3Jlc291cmNlX2lkJyBdIDogJzEnO1x0XHQvLyAnMSdcclxuXHJcblx0XHQvLyBTZXQgdW5zZWxlY3RhYmxlLCAgaWYgb25seSBBdmFpbGFiaWxpdHkgQ2FsZW5kYXIgIGhlcmUgKGFuZCB3ZSBkbyBub3QgaW5zZXJ0IEJvb2tpbmcgZm9ybSBieSBtaXN0YWtlKS5cclxuXHRcdHZhciBpc191bnNlbGVjdGFibGVfY2FsZW5kYXIgPSAoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nX3Vuc2VsZWN0YWJsZScgKyByZXNvdXJjZV9pZCApLmxlbmd0aCA+IDApO1x0XHRcdFx0Ly9GaXhJbjogOC4wLjEuMlxyXG5cdFx0dmFyIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCAgICA9ICggalF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybV9kaXYnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICk7XHJcblx0XHRpZiAoICggaXNfdW5zZWxlY3RhYmxlX2NhbGVuZGFyICkgJiYgKCAhIGlzX2Jvb2tpbmdfZm9ybV9leGlzdCApICl7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3Vuc2VsZWN0X2FsbF9kYXRlcyggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFVuc2VsZWN0IERhdGVzXHJcblx0XHRcdGpRdWVyeSgnLndwYmNfb25seV9jYWxlbmRhciAucG9wb3Zlcl9jYWxlbmRhcl9ob3ZlcicpLnJlbW92ZSgpOyAgICAgICAgICAgICAgICAgICAgICBcdFx0XHRcdFx0XHRcdC8vIEhpZGUgYWxsIG9wZW5lZCBwb3BvdmVyc1xyXG5cdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHR9XHJcblxyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggZGF0ZSApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gQWRkIHNlbGVjdGVkIGRhdGVzIHRvICBoaWRkZW4gdGV4dGFyZWFcclxuXHJcblxyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMpICl7IHdwYmNfX2NhbGVuZGFyX19kb19kYXlzX3NlbGVjdF9fYnMoIGRhdGUsIHJlc291cmNlX2lkICk7IH1cclxuXHJcblx0XHR3cGJjX2Rpc2FibGVfdGltZV9maWVsZHNfaW5fYm9va2luZ19mb3JtKCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRcdC8vIEhvb2sgLS0gdHJpZ2dlciBkYXkgc2VsZWN0aW9uIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHR2YXIgbW91c2VfY2xpY2tlZF9kYXRlcyA9IGRhdGU7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFwiMDUuMTAuMjAyMyAtIDA3LjEwLjIwMjNcIiAgfCAgXCIxMC4xMC4yMDIzIC0gMTAuMTAuMjAyM1wiICB8XHJcblx0XHR2YXIgYWxsX3NlbGVjdGVkX2RhdGVzX2FyciA9IHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKTtcdFx0XHRcdFx0XHRcdFx0XHQvLyBDYW4gYmU6IFsgXCIyMDIzLTEwLTA1XCIsIFwiMjAyMy0xMC0wNlwiLCBcIjIwMjMtMTAtMDdcIiwg4oCmIF1cclxuXHRcdGpRdWVyeSggXCIuYm9va2luZ19mb3JtX2RpdlwiICkudHJpZ2dlciggXCJkYXRlX3NlbGVjdGVkXCIsIFsgcmVzb3VyY2VfaWQsIG1vdXNlX2NsaWNrZWRfZGF0ZXMsIGFsbF9zZWxlY3RlZF9kYXRlc19hcnIgXSApO1xyXG5cdH1cclxuXHJcblx0Ly8gTWFyayBtaWRkbGUgc2VsZWN0ZWQgZGF0ZXMgd2l0aCAwLjUgb3BhY2l0eVx0XHQvL0ZpeEluOiAxMC4zLjAuOVxyXG5cdGpRdWVyeSggZG9jdW1lbnQgKS5yZWFkeSggZnVuY3Rpb24gKCl7XHJcblx0XHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLm9uKCAnZGF0ZV9zZWxlY3RlZCcsIGZ1bmN0aW9uICggZXZlbnQsIHJlc291cmNlX2lkLCBkYXRlICl7XHJcblx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0ICAgKCAgJ2ZpeGVkJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApKVxyXG5cdFx0XHRcdFx0fHwgKCdkeW5hbWljJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApKVxyXG5cdFx0XHRcdCl7XHJcblx0XHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdHZhciBtaWRkbGVfZGF5c19vcGFjaXR5ID0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnY2FsZW5kYXJzX19kYXlzX3NlbGVjdGlvbl9fbWlkZGxlX2RheXNfb3BhY2l0eScgKTtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5kYXRlcGljay1jdXJyZW50LWRheScgKS5ub3QoIFwiLnNlbGVjdGVkX2NoZWNrX2luX291dFwiICkuY3NzKCAnb3BhY2l0eScsIG1pZGRsZV9kYXlzX29wYWNpdHkgKTtcclxuXHRcdFx0XHRcdH0sIDEwICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0fSApO1xyXG5cdH0gKTtcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIC0tICBUIGkgbSBlICAgIEYgaSBlIGwgZCBzICAgICBzdGFydCAgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQgKi9cclxuXHJcblx0LyoqXHJcblx0ICogRGlzYWJsZSB0aW1lIHNsb3RzIGluIGJvb2tpbmcgZm9ybSBkZXBlbmQgb24gc2VsZWN0ZWQgZGF0ZXMgYW5kIGJvb2tlZCBkYXRlcy90aW1lc1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19kaXNhYmxlX3RpbWVfZmllbGRzX2luX2Jvb2tpbmdfZm9ybSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFx0MS4gR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0XHQgKiBcdFx0XHRcdFx0W1xyXG5cdFx0ICogXHRcdFx0XHRcdCBcdCAgIHtcdGpxdWVyeV9vcHRpb246ICAgICAgalF1ZXJ5X09iamVjdCB7fVxyXG5cdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCAtIDA2OjMwJ1xyXG5cdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHQgKiBcdFx0XHRcdFx0XHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCdcclxuXHRcdCAqICBcdFx0XHRcdFx0ICAgIH1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXVxyXG5cdFx0ICovXHJcblx0XHR2YXIgdGltZV9maWVsZHNfb2JqX2FyciA9IHdwYmNfZ2V0X190aW1lX2ZpZWxkc19faW5fYm9va2luZ19mb3JtX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gMi4gR2V0IGFsbCBzZWxlY3RlZCBkYXRlcyBpbiAgU1FMIGZvcm1hdCAgbGlrZSB0aGlzIFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiLCBcIjIwMjMtMDgtMjVcIiwgLi4uIF1cclxuXHRcdHZhciBzZWxlY3RlZF9kYXRlc19hcnIgPSB3cGJjX2dldF9fc2VsZWN0ZWRfZGF0ZXNfc3FsX19hc19hcnIoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0Ly8gMy4gR2V0IGNoaWxkIGJvb2tpbmcgcmVzb3VyY2VzICBvciBzaW5nbGUgYm9va2luZyByZXNvdXJjZSAgdGhhdCAgZXhpc3QgIGluIGRhdGVzXHJcblx0XHR2YXIgY2hpbGRfcmVzb3VyY2VzX2FyciA9IHdwYmNfY2xvbmVfb2JqKCBfd3BiYy5ib29raW5nX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnICkgKTtcclxuXHJcblx0XHR2YXIgc3FsX2RhdGU7XHJcblx0XHR2YXIgY2hpbGRfcmVzb3VyY2VfaWQ7XHJcblx0XHR2YXIgbWVyZ2VkX3NlY29uZHM7XHJcblx0XHR2YXIgdGltZV9maWVsZHNfb2JqO1xyXG5cdFx0dmFyIGlzX2ludGVyc2VjdDtcclxuXHRcdHZhciBpc19jaGVja19pbjtcclxuXHJcblx0XHQvLyA0LiBMb29wICBhbGwgIHRpbWUgRmllbGRzIG9wdGlvbnNcdFx0Ly9GaXhJbjogMTAuMy4wLjJcclxuXHRcdGZvciAoIGxldCBmaWVsZF9rZXkgPSAwOyBmaWVsZF9rZXkgPCB0aW1lX2ZpZWxkc19vYmpfYXJyLmxlbmd0aDsgZmllbGRfa2V5KysgKXtcclxuXHJcblx0XHRcdHRpbWVfZmllbGRzX29ial9hcnJbIGZpZWxkX2tleSBdLmRpc2FibGVkID0gMDsgICAgICAgICAgLy8gQnkgZGVmYXVsdCwgdGhpcyB0aW1lIGZpZWxkIGlzIG5vdCBkaXNhYmxlZFxyXG5cclxuXHRcdFx0dGltZV9maWVsZHNfb2JqID0gdGltZV9maWVsZHNfb2JqX2FyclsgZmllbGRfa2V5IF07XHRcdC8vIHsgdGltZXNfYXNfc2Vjb25kczogWyAyMTYwMCwgMjM0MDAgXSwgdmFsdWVfb3B0aW9uXzI0aDogJzA2OjAwIC0gMDY6MzAnLCBuYW1lOiAncmFuZ2V0aW1lMltdJywganF1ZXJ5X29wdGlvbjogalF1ZXJ5X09iamVjdCB7fX1cclxuXHJcblx0XHRcdC8vIExvb3AgIGFsbCAgc2VsZWN0ZWQgZGF0ZXNcclxuXHRcdFx0Zm9yICggdmFyIGkgPSAwOyBpIDwgc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICl7XHJcblxyXG5cdFx0XHRcdC8vRml4SW46IDkuOS4wLjMxXHJcblx0XHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0ICAgKCAnT2ZmJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdib29raW5nX3JlY3VycmVudF90aW1lJyApIClcclxuXHRcdFx0XHRcdCYmICggc2VsZWN0ZWRfZGF0ZXNfYXJyLmxlbmd0aD4xIClcclxuXHRcdFx0XHQpe1xyXG5cdFx0XHRcdFx0Ly9UT0RPOiBza2lwIHNvbWUgZmllbGRzIGNoZWNraW5nIGlmIGl0J3Mgc3RhcnQgLyBlbmQgdGltZSBmb3IgbXVscGxlIGRhdGVzICBzZWxlY3Rpb24gIG1vZGUuXHJcblx0XHRcdFx0XHQvL1RPRE86IHdlIG5lZWQgdG8gZml4IHNpdHVhdGlvbiAgZm9yIGVudGltZXMsICB3aGVuICB1c2VyICBzZWxlY3QgIHNldmVyYWwgIGRhdGVzLCAgYW5kIGluIHN0YXJ0ICB0aW1lIGJvb2tlZCAwMDowMCAtIDE1OjAwICwgYnV0IHN5c3RzbWUgYmxvY2sgdW50aWxsIDE1OjAwIHRoZSBlbmQgdGltZSBhcyB3ZWxsLCAgd2hpY2ggIGlzIHdyb25nLCAgYmVjYXVzZSBpdCAyIG9yIDMgZGF0ZXMgc2VsZWN0aW9uICBhbmQgZW5kIGRhdGUgY2FuIGJlIGZ1bGx1ICBhdmFpbGFibGVcclxuXHJcblx0XHRcdFx0XHRpZiAoICgwID09IGkpICYmICh0aW1lX2ZpZWxkc19vYmpbICduYW1lJyBdLmluZGV4T2YoICdlbmR0aW1lJyApID49IDApICl7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKCAoIChzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoLTEpID09IGkgKSAmJiAodGltZV9maWVsZHNfb2JqWyAnbmFtZScgXS5pbmRleE9mKCAnc3RhcnR0aW1lJyApID49IDApICl7XHJcblx0XHRcdFx0XHRcdGJyZWFrO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0Ly8gR2V0IERhdGU6ICcyMDIzLTA4LTE4J1xyXG5cdFx0XHRcdHNxbF9kYXRlID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF07XHJcblxyXG5cclxuXHRcdFx0XHR2YXIgaG93X21hbnlfcmVzb3VyY2VzX2ludGVyc2VjdGVkID0gMDtcclxuXHRcdFx0XHQvLyBMb29wIGFsbCByZXNvdXJjZXMgSURcclxuXHRcdFx0XHRcdC8vIGZvciAoIHZhciByZXNfa2V5IGluIGNoaWxkX3Jlc291cmNlc19hcnIgKXtcdCBcdFx0XHRcdFx0XHQvL0ZpeEluOiAxMC4zLjAuMlxyXG5cdFx0XHRcdGZvciAoIGxldCByZXNfa2V5ID0gMDsgcmVzX2tleSA8IGNoaWxkX3Jlc291cmNlc19hcnIubGVuZ3RoOyByZXNfa2V5KysgKXtcclxuXHJcblx0XHRcdFx0XHRjaGlsZF9yZXNvdXJjZV9pZCA9IGNoaWxkX3Jlc291cmNlc19hcnJbIHJlc19rZXkgXTtcclxuXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsxMl0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHNcdFx0PSBbIFwiMDc6MDA6MTEgLSAwNzozMDowMlwiLCBcIjEwOjAwOjExIC0gMDA6MDA6MDBcIiBdXHJcblx0XHRcdFx0XHQvLyBfd3BiYy5ib29raW5nc19pbl9jYWxlbmRhcl9fZ2V0X2Zvcl9kYXRlKDIsJzIwMjMtMDgtMjEnKVsyXS5ib29rZWRfdGltZV9zbG90cy5tZXJnZWRfc2Vjb25kc1x0XHRcdD0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cclxuXHRcdFx0XHRcdGlmICggZmFsc2UgIT09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzcWxfZGF0ZSApICl7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9kYXRlIClbIGNoaWxkX3Jlc291cmNlX2lkIF0uYm9va2VkX3RpbWVfc2xvdHMubWVyZ2VkX3NlY29uZHM7XHRcdC8vIFsgIFsgMjUyMTEsIDI3MDAyIF0sIFsgMzYwMTEsIDg2NDAwIF0gIF1cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdG1lcmdlZF9zZWNvbmRzID0gW107XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRpZiAoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzLmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX3JhbmdlX3RpbWVfaW50ZXJ2YWwoICBbXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1swXSApICsgMjAgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQoIHBhcnNlSW50KCB0aW1lX2ZpZWxkc19vYmoudGltZXNfYXNfc2Vjb25kc1sxXSApIC0gMjAgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRdXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQsIG1lcmdlZF9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRpc19jaGVja19pbiA9ICgtMSAhPT0gdGltZV9maWVsZHNfb2JqLm5hbWUuaW5kZXhPZiggJ3N0YXJ0JyApKTtcclxuXHRcdFx0XHRcdFx0aXNfaW50ZXJzZWN0ID0gd3BiY19pc19pbnRlcnNlY3RfX29uZV90aW1lX2ludGVydmFsKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KCAoIGlzX2NoZWNrX2luIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgPyBwYXJzZUludCggdGltZV9maWVsZHNfb2JqLnRpbWVzX2FzX3NlY29uZHMgKSArIDIwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIDogcGFyc2VJbnQoIHRpbWVfZmllbGRzX29iai50aW1lc19hc19zZWNvbmRzICkgLSAyMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0LCBtZXJnZWRfc2Vjb25kcyApO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0aWYgKGlzX2ludGVyc2VjdCl7XHJcblx0XHRcdFx0XHRcdGhvd19tYW55X3Jlc291cmNlc19pbnRlcnNlY3RlZCsrO1x0XHRcdC8vIEluY3JlYXNlXHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBjaGlsZF9yZXNvdXJjZXNfYXJyLmxlbmd0aCA9PSBob3dfbWFueV9yZXNvdXJjZXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdFx0XHQvLyBBbGwgcmVzb3VyY2VzIGludGVyc2VjdGVkLCAgdGhlbiAgaXQncyBtZWFucyB0aGF0IHRoaXMgdGltZS1zbG90IG9yIHRpbWUgbXVzdCAgYmUgIERpc2FibGVkLCBhbmQgd2UgY2FuICBleGlzdCAgZnJvbSAgIHNlbGVjdGVkX2RhdGVzX2FyciBMT09QXHJcblxyXG5cdFx0XHRcdFx0dGltZV9maWVsZHNfb2JqX2FyclsgZmllbGRfa2V5IF0uZGlzYWJsZWQgPSAxO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGV4aXN0ICBmcm9tICAgRGF0ZXMgTE9PUFxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHJcblx0XHQvLyA1LiBOb3cgd2UgY2FuIGRpc2FibGUgdGltZSBzbG90IGluIEhUTUwgYnkgIHVzaW5nICAoIGZpZWxkLmRpc2FibGVkID09IDEgKSBwcm9wZXJ0eVxyXG5cdFx0d3BiY19faHRtbF9fdGltZV9maWVsZF9vcHRpb25zX19zZXRfZGlzYWJsZWQoIHRpbWVfZmllbGRzX29ial9hcnIgKTtcclxuXHJcblx0XHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLnRyaWdnZXIoICd3cGJjX2hvb2tfdGltZXNsb3RzX2Rpc2FibGVkJywgW3Jlc291cmNlX2lkLCBzZWxlY3RlZF9kYXRlc19hcnJdICk7XHRcdFx0XHRcdC8vIFRyaWdnZXIgaG9vayBvbiBkaXNhYmxpbmcgdGltZXNsb3RzLlx0XHRVc2FnZTogXHRqUXVlcnkoIFwiLmJvb2tpbmdfZm9ybV9kaXZcIiApLm9uKCAnd3BiY19ob29rX3RpbWVzbG90c19kaXNhYmxlZCcsIGZ1bmN0aW9uICggZXZlbnQsIGJrX3R5cGUsIGFsbF9kYXRlcyApeyAuLi4gfSApO1x0XHQvL0ZpeEluOiA4LjcuMTEuOVxyXG5cdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIG51bWJlciBpbnNpZGUgL2ludGVyc2VjdCAgb2YgYXJyYXkgb2YgaW50ZXJ2YWxzID9cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gdGltZV9BXHRcdCAgICAgXHQtIDI1ODAwXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19vbmVfdGltZV9pbnRlcnZhbCggdGltZV9BLCB0aW1lX2ludGVydmFsX0IgKXtcclxuXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfaW50ZXJ2YWxfQi5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0XHRpZiAoIChwYXJzZUludCggdGltZV9BICkgPiBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDAgXSApKSAmJiAocGFyc2VJbnQoIHRpbWVfQSApIDwgcGFyc2VJbnQoIHRpbWVfaW50ZXJ2YWxfQlsgaiBdWyAxIF0gKSkgKXtcclxuXHRcdFx0XHRcdHJldHVybiB0cnVlXHJcblx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHQvLyBpZiAoICggcGFyc2VJbnQoIHRpbWVfQSApID09IHBhcnNlSW50KCB0aW1lX2ludGVydmFsX0JbIGogXVsgMCBdICkgKSB8fCAoIHBhcnNlSW50KCB0aW1lX0EgKSA9PSBwYXJzZUludCggdGltZV9pbnRlcnZhbF9CWyBqIF1bIDEgXSApICkgKSB7XHJcblx0XHRcdFx0Ly8gXHRcdFx0Ly8gVGltZSBBIGp1c3QgIGF0ICB0aGUgYm9yZGVyIG9mIGludGVydmFsXHJcblx0XHRcdFx0Ly8gfVxyXG5cdFx0XHR9XHJcblxyXG5cdFx0ICAgIHJldHVybiBmYWxzZTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIElzIHRoZXNlIGFycmF5IG9mIGludGVydmFscyBpbnRlcnNlY3RlZCA/XHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHRpbWVfaW50ZXJ2YWxfQVx0XHQtIFsgWyAyMTYwMCwgMjM0MDAgXSBdXHJcblx0XHQgKiBAcGFyYW0gdGltZV9pbnRlcnZhbF9CXHRcdC0gWyAgWyAyNTIxMSwgMjcwMDIgXSwgWyAzNjAxMSwgODY0MDAgXSAgXVxyXG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0XHQgKi9cclxuXHRcdGZ1bmN0aW9uIHdwYmNfaXNfaW50ZXJzZWN0X19yYW5nZV90aW1lX2ludGVydmFsKCB0aW1lX2ludGVydmFsX0EsIHRpbWVfaW50ZXJ2YWxfQiApe1xyXG5cclxuXHRcdFx0dmFyIGlzX2ludGVyc2VjdDtcclxuXHJcblx0XHRcdGZvciAoIHZhciBpID0gMDsgaSA8IHRpbWVfaW50ZXJ2YWxfQS5sZW5ndGg7IGkrKyApe1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCB0aW1lX2ludGVydmFsX0IubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHRpc19pbnRlcnNlY3QgPSB3cGJjX2ludGVydmFsc19faXNfaW50ZXJzZWN0ZWQoIHRpbWVfaW50ZXJ2YWxfQVsgaSBdLCB0aW1lX2ludGVydmFsX0JbIGogXSApO1xyXG5cclxuXHRcdFx0XHRcdGlmICggaXNfaW50ZXJzZWN0ICl7XHJcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IGFsbCB0aW1lIGZpZWxkcyBpbiB0aGUgYm9va2luZyBmb3JtIGFzIGFycmF5ICBvZiBvYmplY3RzXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0XHQgKiBAcmV0dXJucyBbXVxyXG5cdFx0ICpcclxuXHRcdCAqIFx0XHRFeGFtcGxlOlxyXG5cdFx0ICogXHRcdFx0XHRcdFtcclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAsIDIzNDAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHQgXHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0bmFtZTogICAgICAgICAgICAgICAncmFuZ2V0aW1lMltdJ1xyXG5cdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0XHQgKiBcdFx0XHRcdFx0XHQgICB7XHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHRcdCAqIFx0XHRcdFx0XHRcdCAgIFx0XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQgKXtcclxuXHRcdCAgICAvKipcclxuXHRcdFx0ICogRmllbGRzIHdpdGggIFtdICBsaWtlIHRoaXMgICBzZWxlY3RbbmFtZT1cInJhbmdldGltZTFbXVwiXVxyXG5cdFx0XHQgKiBpdCdzIHdoZW4gd2UgaGF2ZSAnbXVsdGlwbGUnIGluIHNob3J0Y29kZTogICBbc2VsZWN0KiByYW5nZXRpbWUgbXVsdGlwbGUgIFwiMDY6MDAgLSAwNjozMFwiIC4uLiBdXHJcblx0XHRcdCAqL1xyXG5cdFx0XHR2YXIgdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdbXVwiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJzdGFydHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJlbmR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nXHJcblx0XHRcdFx0XHRcdFx0XHRdO1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfZmllbGRzX29ial9hcnIgPSBbXTtcclxuXHJcblx0XHRcdC8vIExvb3AgYWxsIFRpbWUgRmllbGRzXHJcblx0XHRcdGZvciAoIHZhciBjdGY9IDA7IGN0ZiA8IHRpbWVfZmllbGRzX2Fyci5sZW5ndGg7IGN0ZisrICl7XHJcblxyXG5cdFx0XHRcdHZhciB0aW1lX2ZpZWxkID0gdGltZV9maWVsZHNfYXJyWyBjdGYgXTtcclxuXHRcdFx0XHR2YXIgdGltZV9vcHRpb24gPSBqUXVlcnkoIHRpbWVfZmllbGQgKyAnIG9wdGlvbicgKTtcclxuXHJcblx0XHRcdFx0Ly8gTG9vcCBhbGwgb3B0aW9ucyBpbiB0aW1lIGZpZWxkXHJcblx0XHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgdGltZV9vcHRpb24ubGVuZ3RoOyBqKysgKXtcclxuXHJcblx0XHRcdFx0XHR2YXIganF1ZXJ5X29wdGlvbiA9IGpRdWVyeSggdGltZV9maWVsZCArICcgb3B0aW9uOmVxKCcgKyBqICsgJyknICk7XHJcblx0XHRcdFx0XHR2YXIgdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyID0ganF1ZXJ5X29wdGlvbi52YWwoKS5zcGxpdCggJy0nICk7XHJcblx0XHRcdFx0XHR2YXIgdGltZXNfYXNfc2Vjb25kcyA9IFtdO1xyXG5cclxuXHRcdFx0XHRcdC8vIEdldCB0aW1lIGFzIHNlY29uZHNcclxuXHRcdFx0XHRcdGlmICggdmFsdWVfb3B0aW9uX3NlY29uZHNfYXJyLmxlbmd0aCApe1x0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDkuOC4xMC4xXHJcblx0XHRcdFx0XHRcdGZvciAoIGxldCBpID0gMDsgaSA8IHZhbHVlX29wdGlvbl9zZWNvbmRzX2Fyci5sZW5ndGg7IGkrKyApe1x0XHQvL0ZpeEluOiAxMC4wLjAuNTZcclxuXHRcdFx0XHRcdFx0XHQvLyB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnJbaV0gPSAnMTQ6MDAgJyAgfCAnIDE2OjAwJyAgIChpZiBmcm9tICdyYW5nZXRpbWUnKSBhbmQgJzE2OjAwJyAgaWYgKHN0YXJ0L2VuZCB0aW1lKVxyXG5cclxuXHRcdFx0XHRcdFx0XHR2YXIgc3RhcnRfZW5kX3RpbWVzX2FyciA9IHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyclsgaSBdLnRyaW0oKS5zcGxpdCggJzonICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHZhciB0aW1lX2luX3NlY29uZHMgPSBwYXJzZUludCggc3RhcnRfZW5kX3RpbWVzX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDEgXSApICogNjA7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHMucHVzaCggdGltZV9pbl9zZWNvbmRzICk7XHJcblx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0XHR0aW1lX2ZpZWxkc19vYmpfYXJyLnB1c2goIHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiBqUXVlcnkoIHRpbWVfZmllbGQgKS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiBqcXVlcnlfb3B0aW9uLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IGpxdWVyeV9vcHRpb24sXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0aW1lc19hc19zZWNvbmRzJzogdGltZXNfYXNfc2Vjb25kc1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIHRpbWVfZmllbGRzX29ial9hcnI7XHJcblx0XHR9XHJcblxyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogRGlzYWJsZSBIVE1MIG9wdGlvbnMgYW5kIGFkZCBib29rZWQgQ1NTIGNsYXNzXHJcblx0XHRcdCAqXHJcblx0XHRcdCAqIEBwYXJhbSB0aW1lX2ZpZWxkc19vYmpfYXJyICAgICAgLSB0aGlzIHZhbHVlIGlzIGZyb20gIHRoZSBmdW5jOiAgXHR3cGJjX2dldF9fdGltZV9maWVsZHNfX2luX2Jvb2tpbmdfZm9ybV9fYXNfYXJyKCByZXNvdXJjZV9pZCApXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRbXHJcblx0XHRcdCAqIFx0XHRcdFx0XHQgXHQgICB7XHRqcXVlcnlfb3B0aW9uOiAgICAgIGpRdWVyeV9PYmplY3Qge31cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAgLSAwNjozMCdcclxuXHRcdFx0ICogXHQgIFx0XHRcdFx0XHRcdCAgICBkaXNhYmxlZCA9IDFcclxuXHRcdFx0ICogXHRcdFx0XHRcdCAgICAgfVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0ICAuLi5cclxuXHRcdFx0ICogXHRcdFx0XHRcdFx0ICAge1x0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAgICAgICAgICAgICAgICdzdGFydHRpbWUyW10nXHJcblx0XHRcdCAqIFx0XHRcdFx0XHRcdFx0XHR0aW1lc19hc19zZWNvbmRzOiAgIFsgMjE2MDAgXVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0XHRcdFx0dmFsdWVfb3B0aW9uXzI0aDogICAnMDY6MDAnXHJcblx0XHRcdCAqICAgXHRcdFx0XHRcdFx0XHRkaXNhYmxlZCA9IDBcclxuXHRcdFx0ICogIFx0XHRcdFx0XHQgICAgfVxyXG5cdFx0XHQgKiBcdFx0XHRcdFx0IF1cclxuXHRcdFx0ICpcclxuXHRcdFx0ICovXHJcblx0XHRcdGZ1bmN0aW9uIHdwYmNfX2h0bWxfX3RpbWVfZmllbGRfb3B0aW9uc19fc2V0X2Rpc2FibGVkKCB0aW1lX2ZpZWxkc19vYmpfYXJyICl7XHJcblxyXG5cdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uO1xyXG5cclxuXHRcdFx0XHRmb3IgKCB2YXIgaSA9IDA7IGkgPCB0aW1lX2ZpZWxkc19vYmpfYXJyLmxlbmd0aDsgaSsrICl7XHJcblxyXG5cdFx0XHRcdFx0dmFyIGpxdWVyeV9vcHRpb24gPSB0aW1lX2ZpZWxkc19vYmpfYXJyWyBpIF0uanF1ZXJ5X29wdGlvbjtcclxuXHJcblx0XHRcdFx0XHRpZiAoIDEgPT0gdGltZV9maWVsZHNfb2JqX2FyclsgaSBdLmRpc2FibGVkICl7XHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucHJvcCggJ2Rpc2FibGVkJywgdHJ1ZSApOyBcdFx0Ly8gTWFrZSBkaXNhYmxlIHNvbWUgb3B0aW9uc1xyXG5cdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLmFkZENsYXNzKCAnYm9va2VkJyApOyAgICAgICAgICAgXHQvLyBBZGQgXCJib29rZWRcIiBDU1MgY2xhc3NcclxuXHJcblx0XHRcdFx0XHRcdC8vIGlmIHRoaXMgYm9va2VkIGVsZW1lbnQgc2VsZWN0ZWQgLS0+IHRoZW4gZGVzZWxlY3QgIGl0XHJcblx0XHRcdFx0XHRcdGlmICgganF1ZXJ5X29wdGlvbi5wcm9wKCAnc2VsZWN0ZWQnICkgKXtcclxuXHRcdFx0XHRcdFx0XHRqcXVlcnlfb3B0aW9uLnByb3AoICdzZWxlY3RlZCcsIGZhbHNlICk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucGFyZW50KCkuZmluZCggJ29wdGlvbjpub3QoW2Rpc2FibGVkXSk6Zmlyc3QnICkucHJvcCggJ3NlbGVjdGVkJywgdHJ1ZSApLnRyaWdnZXIoIFwiY2hhbmdlXCIgKTtcclxuXHRcdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGpxdWVyeV9vcHRpb24ucHJvcCggJ2Rpc2FibGVkJywgZmFsc2UgKTsgIFx0XHQvLyBNYWtlIGFjdGl2ZSBhbGwgdGltZXNcclxuXHRcdFx0XHRcdFx0anF1ZXJ5X29wdGlvbi5yZW1vdmVDbGFzcyggJ2Jvb2tlZCcgKTsgICBcdFx0Ly8gUmVtb3ZlIGNsYXNzIFwiYm9va2VkXCJcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENoZWNrIGlmIHRoaXMgdGltZV9yYW5nZSB8IFRpbWVfU2xvdCBpcyBGdWxsIERheSAgYm9va2VkXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gdGltZXNsb3RfYXJyX2luX3NlY29uZHNcdFx0LSBbIDM2MDExLCA4NjQwMCBdXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19pc190aGlzX3RpbWVzbG90X19mdWxsX2RheV9ib29rZWQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzICl7XHJcblxyXG5cdFx0aWYgKFxyXG5cdFx0XHRcdCggdGltZXNsb3RfYXJyX2luX3NlY29uZHMubGVuZ3RoID4gMSApXHJcblx0XHRcdCYmICggcGFyc2VJbnQoIHRpbWVzbG90X2Fycl9pbl9zZWNvbmRzWyAwIF0gKSA8IDMwIClcclxuXHRcdFx0JiYgKCBwYXJzZUludCggdGltZXNsb3RfYXJyX2luX3NlY29uZHNbIDEgXSApID4gICggKDI0ICogNjAgKiA2MCkgLSAzMCkgKVxyXG5cdFx0KXtcclxuXHRcdFx0cmV0dXJuIHRydWU7XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0LyogID09ICBTIGUgbCBlIGMgdCBlIGQgICAgRCBhIHQgZSBzICAvICBUIGkgbSBlIC0gRiBpIGUgbCBkIHMgID09XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0LyoqXHJcblx0ICogIEdldCBhbGwgc2VsZWN0ZWQgZGF0ZXMgaW4gU1FMIGZvcm1hdCBsaWtlIHRoaXMgWyBcIjIwMjMtMDgtMjNcIiwgXCIyMDIzLTA4LTI0XCIgLCAuLi4gXVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICogQHJldHVybnMge1tdfVx0XHRcdFsgXCIyMDIzLTA4LTIzXCIsIFwiMjAyMy0wOC0yNFwiLCBcIjIwMjMtMDgtMjVcIiwgXCIyMDIzLTA4LTI2XCIsIFwiMjAyMy0wOC0yN1wiLCBcIjIwMjMtMDgtMjhcIiwgXCIyMDIzLTA4LTI5XCIgXVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X19zZWxlY3RlZF9kYXRlc19zcWxfX2FzX2FyciggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHR2YXIgc2VsZWN0ZWRfZGF0ZXNfYXJyID0gW107XHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIgPSBqUXVlcnkoICcjZGF0ZV9ib29raW5nJyArIHJlc291cmNlX2lkICkudmFsKCkuc3BsaXQoJywnKTtcclxuXHJcblx0XHRpZiAoIHNlbGVjdGVkX2RhdGVzX2Fyci5sZW5ndGggKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA5LjguMTAuMVxyXG5cdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZF9kYXRlc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0XHRcdFx0XHQvL0ZpeEluOiAxMC4wLjAuNTZcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlc19hcnJbIGkgXSA9IHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdLnRyaW0oKTtcclxuXHRcdFx0XHRzZWxlY3RlZF9kYXRlc19hcnJbIGkgXSA9IHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdLnNwbGl0KCAnLicgKTtcclxuXHRcdFx0XHRpZiAoIHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdLmxlbmd0aCA+IDEgKXtcclxuXHRcdFx0XHRcdHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdID0gc2VsZWN0ZWRfZGF0ZXNfYXJyWyBpIF1bIDIgXSArICctJyArIHNlbGVjdGVkX2RhdGVzX2FyclsgaSBdWyAxIF0gKyAnLScgKyBzZWxlY3RlZF9kYXRlc19hcnJbIGkgXVsgMCBdO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFJlbW92ZSBlbXB0eSBlbGVtZW50cyBmcm9tIGFuIGFycmF5XHJcblx0XHRzZWxlY3RlZF9kYXRlc19hcnIgPSBzZWxlY3RlZF9kYXRlc19hcnIuZmlsdGVyKCBmdW5jdGlvbiAoIG4gKXsgcmV0dXJuIHBhcnNlSW50KG4pOyB9ICk7XHJcblxyXG5cdFx0c2VsZWN0ZWRfZGF0ZXNfYXJyLnNvcnQoKTtcclxuXHJcblx0XHRyZXR1cm4gc2VsZWN0ZWRfZGF0ZXNfYXJyO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhbGwgdGltZSBmaWVsZHMgaW4gdGhlIGJvb2tpbmcgZm9ybSBhcyBhcnJheSAgb2Ygb2JqZWN0c1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICogQHBhcmFtIGlzX29ubHlfc2VsZWN0ZWRfdGltZVxyXG5cdCAqIEByZXR1cm5zIFtdXHJcblx0ICpcclxuXHQgKiBcdFx0RXhhbXBsZTpcclxuXHQgKiBcdFx0XHRcdFx0W1xyXG5cdCAqIFx0XHRcdFx0XHQgXHQgICB7XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHZhbHVlX29wdGlvbl8yNGg6ICAgJzA2OjAwIC0gMDY6MzAnXHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdHRpbWVzX2FzX3NlY29uZHM6ICAgWyAyMTYwMCwgMjM0MDAgXVxyXG5cdCAqIFx0XHRcdFx0XHQgXHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3JhbmdldGltZTJbXSdcclxuXHQgKiBcdFx0XHRcdFx0ICAgICB9XHJcblx0ICogXHRcdFx0XHRcdCAgLi4uXHJcblx0ICogXHRcdFx0XHRcdFx0ICAge1xyXG5cdCAqIFx0XHRcdFx0XHRcdFx0XHR2YWx1ZV9vcHRpb25fMjRoOiAgICcwNjowMCdcclxuXHQgKiBcdFx0XHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kczogICBbIDIxNjAwIF1cclxuXHQgKiBcdFx0XHRcdFx0XHQgICBcdFx0anF1ZXJ5X29wdGlvbjogICAgICBqUXVlcnlfT2JqZWN0IHt9XHJcblx0ICogXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICAgICAgICAgICAgICAgJ3N0YXJ0dGltZTJbXSdcclxuXHQgKiAgXHRcdFx0XHRcdCAgICB9XHJcblx0ICogXHRcdFx0XHRcdCBdXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfX3NlbGVjdGVkX3RpbWVfZmllbGRzX19pbl9ib29raW5nX2Zvcm1fX2FzX2FyciggcmVzb3VyY2VfaWQsIGlzX29ubHlfc2VsZWN0ZWRfdGltZSA9IHRydWUgKXtcclxuXHRcdC8qKlxyXG5cdFx0ICogRmllbGRzIHdpdGggIFtdICBsaWtlIHRoaXMgICBzZWxlY3RbbmFtZT1cInJhbmdldGltZTFbXVwiXVxyXG5cdFx0ICogaXQncyB3aGVuIHdlIGhhdmUgJ211bHRpcGxlJyBpbiBzaG9ydGNvZGU6ICAgW3NlbGVjdCogcmFuZ2V0aW1lIG11bHRpcGxlICBcIjA2OjAwIC0gMDY6MzBcIiAuLi4gXVxyXG5cdFx0ICovXHJcblx0XHR2YXIgdGltZV9maWVsZHNfYXJyPVtcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInJhbmdldGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwicmFuZ2V0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cInN0YXJ0dGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1tdXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnXCJdJyxcclxuXHRcdFx0XHRcdFx0XHRcdCdzZWxlY3RbbmFtZT1cImVuZHRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0J3NlbGVjdFtuYW1lPVwiZHVyYXRpb250aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHQnc2VsZWN0W25hbWU9XCJkdXJhdGlvbnRpbWUnICsgcmVzb3VyY2VfaWQgKyAnW11cIl0nXHJcblx0XHRcdFx0XHRcdFx0XTtcclxuXHJcblx0XHR2YXIgdGltZV9maWVsZHNfb2JqX2FyciA9IFtdO1xyXG5cclxuXHRcdC8vIExvb3AgYWxsIFRpbWUgRmllbGRzXHJcblx0XHRmb3IgKCB2YXIgY3RmPSAwOyBjdGYgPCB0aW1lX2ZpZWxkc19hcnIubGVuZ3RoOyBjdGYrKyApe1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfZmllbGQgPSB0aW1lX2ZpZWxkc19hcnJbIGN0ZiBdO1xyXG5cclxuXHRcdFx0dmFyIHRpbWVfb3B0aW9uO1xyXG5cdFx0XHRpZiAoIGlzX29ubHlfc2VsZWN0ZWRfdGltZSApe1xyXG5cdFx0XHRcdHRpbWVfb3B0aW9uID0galF1ZXJ5KCAnI2Jvb2tpbmdfZm9ybScgKyByZXNvdXJjZV9pZCArICcgJyArIHRpbWVfZmllbGQgKyAnIG9wdGlvbjpzZWxlY3RlZCcgKTtcdFx0XHQvLyBFeGNsdWRlIGNvbmRpdGlvbmFsICBmaWVsZHMsICBiZWNhdXNlIG9mIHVzaW5nICcjYm9va2luZ19mb3JtMyAuLi4nXHJcblx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0dGltZV9vcHRpb24gPSBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCArICcgb3B0aW9uJyApO1x0XHRcdFx0Ly8gQWxsICB0aW1lIGZpZWxkc1xyXG5cdFx0XHR9XHJcblxyXG5cclxuXHRcdFx0Ly8gTG9vcCBhbGwgb3B0aW9ucyBpbiB0aW1lIGZpZWxkXHJcblx0XHRcdGZvciAoIHZhciBqID0gMDsgaiA8IHRpbWVfb3B0aW9uLmxlbmd0aDsgaisrICl7XHJcblxyXG5cdFx0XHRcdHZhciBqcXVlcnlfb3B0aW9uID0galF1ZXJ5KCB0aW1lX29wdGlvblsgaiBdICk7XHRcdC8vIEdldCBvbmx5ICBzZWxlY3RlZCBvcHRpb25zIFx0Ly9qUXVlcnkoIHRpbWVfZmllbGQgKyAnIG9wdGlvbjplcSgnICsgaiArICcpJyApO1xyXG5cdFx0XHRcdHZhciB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIgPSBqcXVlcnlfb3B0aW9uLnZhbCgpLnNwbGl0KCAnLScgKTtcclxuXHRcdFx0XHR2YXIgdGltZXNfYXNfc2Vjb25kcyA9IFtdO1xyXG5cclxuXHRcdFx0XHQvLyBHZXQgdGltZSBhcyBzZWNvbmRzXHJcblx0XHRcdFx0aWYgKCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoICl7XHRcdFx0XHQgXHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDkuOC4xMC4xXHJcblx0XHRcdFx0XHRmb3IgKCBsZXQgaSA9IDA7IGkgPCB2YWx1ZV9vcHRpb25fc2Vjb25kc19hcnIubGVuZ3RoOyBpKysgKXtcdFx0XHRcdFx0Ly9GaXhJbjogMTAuMC4wLjU2XHJcblx0XHRcdFx0XHRcdC8vIHZhbHVlX29wdGlvbl9zZWNvbmRzX2FycltpXSA9ICcxNDowMCAnICB8ICcgMTY6MDAnICAgKGlmIGZyb20gJ3JhbmdldGltZScpIGFuZCAnMTY6MDAnICBpZiAoc3RhcnQvZW5kIHRpbWUpXHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgc3RhcnRfZW5kX3RpbWVzX2FyciA9IHZhbHVlX29wdGlvbl9zZWNvbmRzX2FyclsgaSBdLnRyaW0oKS5zcGxpdCggJzonICk7XHJcblxyXG5cdFx0XHRcdFx0XHR2YXIgdGltZV9pbl9zZWNvbmRzID0gcGFyc2VJbnQoIHN0YXJ0X2VuZF90aW1lc19hcnJbIDAgXSApICogNjAgKiA2MCArIHBhcnNlSW50KCBzdGFydF9lbmRfdGltZXNfYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHRcdFx0dGltZXNfYXNfc2Vjb25kcy5wdXNoKCB0aW1lX2luX3NlY29uZHMgKTtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiBqUXVlcnkoICcjYm9va2luZ19mb3JtJyArIHJlc291cmNlX2lkICsgJyAnICsgdGltZV9maWVsZCApLmF0dHIoICduYW1lJyApLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlX29wdGlvbl8yNGgnOiBqcXVlcnlfb3B0aW9uLnZhbCgpLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxdWVyeV9vcHRpb24nICAgOiBqcXVlcnlfb3B0aW9uLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0aW1lc19hc19zZWNvbmRzXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gVGV4dDogICBbc3RhcnR0aW1lXSAtIFtlbmR0aW1lXSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHRcdHZhciB0ZXh0X3RpbWVfZmllbGRzX2Fycj1bXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwic3RhcnR0aW1lJyArIHJlc291cmNlX2lkICsgJ1wiXScsXHJcblx0XHRcdFx0XHRcdFx0XHRcdCdpbnB1dFtuYW1lPVwiZW5kdGltZScgKyByZXNvdXJjZV9pZCArICdcIl0nLFxyXG5cdFx0XHRcdFx0XHRcdFx0XTtcclxuXHRcdGZvciAoIHZhciB0Zj0gMDsgdGYgPCB0ZXh0X3RpbWVfZmllbGRzX2Fyci5sZW5ndGg7IHRmKysgKXtcclxuXHJcblx0XHRcdHZhciB0ZXh0X2pxdWVyeSA9IGpRdWVyeSggJyNib29raW5nX2Zvcm0nICsgcmVzb3VyY2VfaWQgKyAnICcgKyB0ZXh0X3RpbWVfZmllbGRzX2FyclsgdGYgXSApO1x0XHRcdFx0XHRcdFx0XHQvLyBFeGNsdWRlIGNvbmRpdGlvbmFsICBmaWVsZHMsICBiZWNhdXNlIG9mIHVzaW5nICcjYm9va2luZ19mb3JtMyAuLi4nXHJcblx0XHRcdGlmICggdGV4dF9qcXVlcnkubGVuZ3RoID4gMCApe1xyXG5cclxuXHRcdFx0XHR2YXIgdGltZV9faF9tX19hcnIgPSB0ZXh0X2pxdWVyeS52YWwoKS50cmltKCkuc3BsaXQoICc6JyApO1x0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyAnMTQ6MDAnXHJcblx0XHRcdFx0aWYgKCAwID09IHRpbWVfX2hfbV9fYXJyLmxlbmd0aCApe1xyXG5cdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdFx0Ly8gTm90IGVudGVyZWQgdGltZSB2YWx1ZSBpbiBhIGZpZWxkXHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdGlmICggMSA9PSB0aW1lX19oX21fX2Fyci5sZW5ndGggKXtcclxuXHRcdFx0XHRcdGlmICggJycgPT09IHRpbWVfX2hfbV9fYXJyWyAwIF0gKXtcclxuXHRcdFx0XHRcdFx0Y29udGludWU7XHRcdFx0XHRcdFx0XHRcdC8vIE5vdCBlbnRlcmVkIHRpbWUgdmFsdWUgaW4gYSBmaWVsZFxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dGltZV9faF9tX19hcnJbIDEgXSA9IDA7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdHZhciB0ZXh0X3RpbWVfaW5fc2Vjb25kcyA9IHBhcnNlSW50KCB0aW1lX19oX21fX2FyclsgMCBdICkgKiA2MCAqIDYwICsgcGFyc2VJbnQoIHRpbWVfX2hfbV9fYXJyWyAxIF0gKSAqIDYwO1xyXG5cclxuXHRcdFx0XHR2YXIgdGV4dF90aW1lc19hc19zZWNvbmRzID0gW107XHJcblx0XHRcdFx0dGV4dF90aW1lc19hc19zZWNvbmRzLnB1c2goIHRleHRfdGltZV9pbl9zZWNvbmRzICk7XHJcblxyXG5cdFx0XHRcdHRpbWVfZmllbGRzX29ial9hcnIucHVzaCgge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICAgICAgICAgICAgOiB0ZXh0X2pxdWVyeS5hdHRyKCAnbmFtZScgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd2YWx1ZV9vcHRpb25fMjRoJzogdGV4dF9qcXVlcnkudmFsKCksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanF1ZXJ5X29wdGlvbicgICA6IHRleHRfanF1ZXJ5LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3RpbWVzX2FzX3NlY29uZHMnOiB0ZXh0X3RpbWVzX2FzX3NlY29uZHNcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gdGltZV9maWVsZHNfb2JqX2FycjtcclxuXHR9XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIFMgVSBQIFAgTyBSIFQgICAgZm9yICAgIEMgQSBMIEUgTiBEIEEgUiAgPT1cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBDYWxlbmRhciBkYXRlcGljayAgSW5zdGFuY2VcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWQgIG9mIGJvb2tpbmcgcmVzb3VyY2VcclxuXHQgKiBAcmV0dXJucyB7KnxudWxsfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5sZW5ndGggPiAwICl7XHJcblx0XHRcdHJldHVybiBqUXVlcnkuZGF0ZXBpY2suX2dldEluc3QoIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuZ2V0KCAwICkgKTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gbnVsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFVuc2VsZWN0ICBhbGwgZGF0ZXMgaW4gY2FsZW5kYXIgYW5kIHZpc3VhbGx5IHVwZGF0ZSB0aGlzIGNhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVx0XHR0cnVlIG9uIHN1Y2Nlc3MgfCBmYWxzZSwgIGlmIG5vIHN1Y2ggIGNhbGVuZGFyXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdW5zZWxlY3RfYWxsX2RhdGVzKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRcdHJlc291cmNlX2lkID0gJzEnO1xyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHRcdC8vIFVuc2VsZWN0IGFsbCBkYXRlcyBhbmQgc2V0ICBwcm9wZXJ0aWVzIG9mIERhdGVwaWNrXHJcblx0XHRcdGpRdWVyeSggJyNkYXRlX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS52YWwoICcnICk7ICAgICAgLy9GaXhJbjogNS40LjNcclxuXHRcdFx0aW5zdC5zdGF5T3BlbiA9IGZhbHNlO1xyXG5cdFx0XHRpbnN0LmRhdGVzID0gW107XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIENsZWFyIGRheXMgaGlnaGxpZ2h0aW5nIGluIEFsbCBvciBzcGVjaWZpYyBDYWxlbmRhcnNcclxuXHQgKlxyXG4gICAgICogQHBhcmFtIHJlc291cmNlX2lkICAtIGNhbiBiZSBza2lwZWQgdG8gIGNsZWFyIGhpZ2hsaWdodGluZyBpbiBhbGwgY2FsZW5kYXJzXHJcbiAgICAgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyc19fY2xlYXJfZGF5c19oaWdobGlnaHRpbmcoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mICggcmVzb3VyY2VfaWQgKSApe1xyXG5cclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKyAnIC5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHQvLyBDbGVhciBpbiBzcGVjaWZpYyBjYWxlbmRhclxyXG5cclxuXHRcdH0gZWxzZSB7XHJcblx0XHRcdGpRdWVyeSggJy5kYXRlcGljay1kYXlzLWNlbGwtb3ZlcicgKS5yZW1vdmVDbGFzcyggJ2RhdGVwaWNrLWRheXMtY2VsbC1vdmVyJyApO1x0XHRcdFx0XHRcdFx0XHQvLyBDbGVhciBpbiBhbGwgY2FsZW5kYXJzXHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBTY3JvbGwgdG8gc3BlY2lmaWMgbW9udGggaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiByZXNvdXJjZVxyXG5cdCAqIEBwYXJhbSB5ZWFyXHRcdFx0XHQtIHJlYWwgeWVhciAgLSAyMDIzXHJcblx0ICogQHBhcmFtIG1vbnRoXHRcdFx0XHQtIHJlYWwgbW9udGggLSAxMlxyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX3Njcm9sbF90byggcmVzb3VyY2VfaWQsIHllYXIsIG1vbnRoICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChyZXNvdXJjZV9pZCkgKXsgcmVzb3VyY2VfaWQgPSAnMSc7IH1cclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkIClcclxuXHRcdGlmICggbnVsbCAhPT0gaW5zdCApe1xyXG5cclxuXHRcdFx0eWVhciAgPSBwYXJzZUludCggeWVhciApO1xyXG5cdFx0XHRtb250aCA9IHBhcnNlSW50KCBtb250aCApIC0gMTtcdFx0Ly8gSW4gSlMgZGF0ZSwgIG1vbnRoIC0xXHJcblxyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0XHQvLyBJbiBzb21lIGNhc2VzLCAgdGhlIHNldEZ1bGxZZWFyIGNhbiAgc2V0ICBvbmx5IFllYXIsICBhbmQgbm90IHRoZSBNb250aCBhbmQgZGF5ICAgICAgLy9GaXhJbjo2LjIuMy41XHJcblx0XHRcdGluc3QuY3Vyc29yRGF0ZS5zZXRGdWxsWWVhciggeWVhciwgbW9udGgsIDEgKTtcclxuXHRcdFx0aW5zdC5jdXJzb3JEYXRlLnNldE1vbnRoKCBtb250aCApO1xyXG5cdFx0XHRpbnN0LmN1cnNvckRhdGUuc2V0RGF0ZSggMSApO1xyXG5cclxuXHRcdFx0aW5zdC5kcmF3TW9udGggPSBpbnN0LmN1cnNvckRhdGUuZ2V0TW9udGgoKTtcclxuXHRcdFx0aW5zdC5kcmF3WWVhciA9IGluc3QuY3Vyc29yRGF0ZS5nZXRGdWxsWWVhcigpO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9ub3RpZnlDaGFuZ2UoIGluc3QgKTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9hZGp1c3RJbnN0RGF0ZSggaW5zdCApO1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3Nob3dEYXRlKCBpbnN0ICk7XHJcblx0XHRcdGpRdWVyeS5kYXRlcGljay5fdXBkYXRlRGF0ZXBpY2soIGluc3QgKTtcclxuXHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSXMgdGhpcyBkYXRlIHNlbGVjdGFibGUgaW4gY2FsZW5kYXIgKG1haW5seSBpdCdzIG1lYW5zIEFWQUlMQUJMRSBkYXRlKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHtpbnR8c3RyaW5nfSByZXNvdXJjZV9pZFx0XHQxXHJcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNxbF9jbGFzc19kYXlcdFx0JzIwMjMtMDgtMTEnXHJcblx0ICogQHJldHVybnMge2Jvb2xlYW59XHRcdFx0XHRcdHRydWUgfCBmYWxzZVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc19kYXlfc2VsZWN0YWJsZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKXtcclxuXHJcblx0XHQvLyBHZXQgRGF0YSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0dmFyIGRhdGVfYm9va2luZ3Nfb2JqID0gX3dwYmMuYm9va2luZ3NfaW5fY2FsZW5kYXJfX2dldF9mb3JfZGF0ZSggcmVzb3VyY2VfaWQsIHNxbF9jbGFzc19kYXkgKTtcclxuXHJcblx0XHR2YXIgaXNfZGF5X3NlbGVjdGFibGUgPSAoIHBhcnNlSW50KCBkYXRlX2Jvb2tpbmdzX29ialsgJ2RheV9hdmFpbGFiaWxpdHknIF0gKSA+IDAgKTtcclxuXHJcblx0XHRpZiAoIHR5cGVvZiAoZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5JyBdKSA9PT0gJ3VuZGVmaW5lZCcgKXtcclxuXHRcdFx0cmV0dXJuIGlzX2RheV9zZWxlY3RhYmxlO1xyXG5cdFx0fVxyXG5cclxuXHRcdGlmICggJ2F2YWlsYWJsZScgIT0gZGF0ZV9ib29raW5nc19vYmpbICdzdW1tYXJ5J11bJ3N0YXR1c19mb3JfZGF5JyBdICl7XHJcblxyXG5cdFx0XHR2YXIgaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlID0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdwZW5kaW5nX2RheXNfc2VsZWN0YWJsZScgKTtcdFx0Ly8gc2V0IHBlbmRpbmcgZGF5cyBzZWxlY3RhYmxlICAgICAgICAgIC8vRml4SW46IDguNi4xLjE4XHJcblxyXG5cdFx0XHRzd2l0Y2ggKCBkYXRlX2Jvb2tpbmdzX29ialsgJ3N1bW1hcnknXVsnc3RhdHVzX2Zvcl9ib29raW5ncycgXSApe1xyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmcnOlxyXG5cdFx0XHRcdC8vIFNpdHVhdGlvbnMgZm9yIFwiY2hhbmdlLW92ZXJcIiBkYXlzOlxyXG5cdFx0XHRcdGNhc2UgJ3BlbmRpbmdfcGVuZGluZyc6XHJcblx0XHRcdFx0Y2FzZSAncGVuZGluZ19hcHByb3ZlZCc6XHJcblx0XHRcdFx0Y2FzZSAnYXBwcm92ZWRfcGVuZGluZyc6XHJcblx0XHRcdFx0XHRpc19kYXlfc2VsZWN0YWJsZSA9IChpc19kYXlfc2VsZWN0YWJsZSkgPyB0cnVlIDogaXNfc2V0X3BlbmRpbmdfZGF5c19zZWxlY3RhYmxlO1xyXG5cdFx0XHRcdFx0YnJlYWs7XHJcblx0XHRcdFx0ZGVmYXVsdDpcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBpc19kYXlfc2VsZWN0YWJsZTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIElzIGRhdGUgdG8gY2hlY2sgSU4gYXJyYXkgb2Ygc2VsZWN0ZWQgZGF0ZXNcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSB7ZGF0ZX1qc19kYXRlX3RvX2NoZWNrXHRcdC0gSlMgRGF0ZVx0XHRcdC0gc2ltcGxlICBKYXZhU2NyaXB0IERhdGUgb2JqZWN0XHJcblx0ICogQHBhcmFtIHtbXX0ganNfZGF0ZXNfYXJyXHRcdFx0LSBbIEpTRGF0ZSwgLi4uIF0gICAtIGFycmF5ICBvZiBKUyBkYXRlc1xyXG5cdCAqIEByZXR1cm5zIHtib29sZWFufVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfaXNfdGhpc19kYXlfYW1vbmdfc2VsZWN0ZWRfZGF5cygganNfZGF0ZV90b19jaGVjaywganNfZGF0ZXNfYXJyICl7XHJcblxyXG5cdFx0Zm9yICggdmFyIGRhdGVfaW5kZXggPSAwOyBkYXRlX2luZGV4IDwganNfZGF0ZXNfYXJyLmxlbmd0aCA7IGRhdGVfaW5kZXgrKyApeyAgICAgXHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogOC40LjUuMTZcclxuXHRcdFx0aWYgKCAoIGpzX2RhdGVzX2FyclsgZGF0ZV9pbmRleCBdLmdldEZ1bGxZZWFyKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RnVsbFllYXIoKSApICYmXHJcblx0XHRcdFx0ICgganNfZGF0ZXNfYXJyWyBkYXRlX2luZGV4IF0uZ2V0TW9udGgoKSA9PT0ganNfZGF0ZV90b19jaGVjay5nZXRNb250aCgpICkgJiZcclxuXHRcdFx0XHQgKCBqc19kYXRlc19hcnJbIGRhdGVfaW5kZXggXS5nZXREYXRlKCkgPT09IGpzX2RhdGVfdG9fY2hlY2suZ2V0RGF0ZSgpICkgKSB7XHJcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiAgZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgU1FMIENsYXNzIERhdGUgJzIwMjMtMDgtMDEnIGZyb20gIEpTIERhdGVcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSBkYXRlXHRcdFx0XHRKUyBEYXRlXHJcblx0ICogQHJldHVybnMge3N0cmluZ31cdFx0JzIwMjMtMDgtMTInXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZSApe1xyXG5cclxuXHRcdHZhciBzcWxfY2xhc3NfZGF5ID0gZGF0ZS5nZXRGdWxsWWVhcigpICsgJy0nO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9ICggKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgPCAxMCApID8gJzAnIDogJyc7XHJcblx0XHRcdHNxbF9jbGFzc19kYXkgKz0gKCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLSdcclxuXHRcdFx0c3FsX2NsYXNzX2RheSArPSAoIGRhdGUuZ2V0RGF0ZSgpIDwgMTAgKSA/ICcwJyA6ICcnO1xyXG5cdFx0XHRzcWxfY2xhc3NfZGF5ICs9IGRhdGUuZ2V0RGF0ZSgpO1xyXG5cclxuXHRcdFx0cmV0dXJuIHNxbF9jbGFzc19kYXk7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgSlMgRGF0ZSBmcm9tICB0aGUgU1FMIGRhdGUgZm9ybWF0ICcyMDI0LTA1LTE0J1xyXG5cdCAqIEBwYXJhbSBzcWxfY2xhc3NfZGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtEYXRlfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2NsYXNzX2RhdGUgKXtcclxuXHJcblx0XHR2YXIgc3FsX2NsYXNzX2RhdGVfYXJyID0gc3FsX2NsYXNzX2RhdGUuc3BsaXQoICctJyApO1xyXG5cclxuXHRcdHZhciBkYXRlX2pzID0gbmV3IERhdGUoKTtcclxuXHJcblx0XHRkYXRlX2pzLnNldEZ1bGxZZWFyKCBwYXJzZUludCggc3FsX2NsYXNzX2RhdGVfYXJyWyAwIF0gKSwgKHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDEgXSApIC0gMSksIHBhcnNlSW50KCBzcWxfY2xhc3NfZGF0ZV9hcnJbIDIgXSApICk7ICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cclxuXHRcdC8vIFdpdGhvdXQgdGhpcyB0aW1lIGFkanVzdCBEYXRlcyBzZWxlY3Rpb24gIGluIERhdGVwaWNrZXIgY2FuIG5vdCB3b3JrISEhXHJcblx0XHRkYXRlX2pzLnNldEhvdXJzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaW51dGVzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRTZWNvbmRzKDApO1xyXG5cdFx0ZGF0ZV9qcy5zZXRNaWxsaXNlY29uZHMoMCk7XHJcblxyXG5cdFx0cmV0dXJuIGRhdGVfanM7XHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgVEQgQ2xhc3MgRGF0ZSAnMS0zMS0yMDIzJyBmcm9tICBKUyBEYXRlXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0ZVx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHtzdHJpbmd9XHRcdCcxLTMxLTIwMjMnXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19fZ2V0X190ZF9jbGFzc19kYXRlKCBkYXRlICl7XHJcblxyXG5cdFx0dmFyIHRkX2NsYXNzX2RheSA9IChkYXRlLmdldE1vbnRoKCkgKyAxKSArICctJyArIGRhdGUuZ2V0RGF0ZSgpICsgJy0nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1x0XHRcdFx0XHRcdFx0XHQvLyAnMS05LTIwMjMnXHJcblxyXG5cdFx0cmV0dXJuIHRkX2NsYXNzX2RheTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBkYXRlIHBhcmFtcyBmcm9tICBzdHJpbmcgZGF0ZVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVcdFx0XHRzdHJpbmcgZGF0ZSBsaWtlICczMS41LjIwMjMnXHJcblx0ICogQHBhcmFtIHNlcGFyYXRvclx0XHRkZWZhdWx0ICcuJyAgY2FuIGJlIHNraXBwZWQuXHJcblx0ICogQHJldHVybnMgeyAge2RhdGU6IG51bWJlciwgbW9udGg6IG51bWJlciwgeWVhcjogbnVtYmVyfSAgfVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfX2dldF9fZGF0ZV9wYXJhbXNfX2Zyb21fc3RyaW5nX2RhdGUoIGRhdGUgLCBzZXBhcmF0b3Ipe1xyXG5cclxuXHRcdHNlcGFyYXRvciA9ICggJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAoc2VwYXJhdG9yKSApID8gc2VwYXJhdG9yIDogJy4nO1xyXG5cclxuXHRcdHZhciBkYXRlX2FyciA9IGRhdGUuc3BsaXQoIHNlcGFyYXRvciApO1xyXG5cdFx0dmFyIGRhdGVfb2JqID0ge1xyXG5cdFx0XHQneWVhcicgOiAgcGFyc2VJbnQoIGRhdGVfYXJyWyAyIF0gKSxcclxuXHRcdFx0J21vbnRoJzogKHBhcnNlSW50KCBkYXRlX2FyclsgMSBdICkgLSAxKSxcclxuXHRcdFx0J2RhdGUnIDogIHBhcnNlSW50KCBkYXRlX2FyclsgMCBdIClcclxuXHRcdH07XHJcblx0XHRyZXR1cm4gZGF0ZV9vYmo7XHRcdC8vIGZvciBcdFx0ID0gbmV3IERhdGUoIGRhdGVfb2JqLnllYXIgLCBkYXRlX29iai5tb250aCAsIGRhdGVfb2JqLmRhdGUgKTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEFkZCBTcGluIExvYWRlciB0byAgY2FsZW5kYXJcclxuXHQgKiBAcGFyYW0gcmVzb3VyY2VfaWRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX19sb2FkaW5nX19zdGFydCggcmVzb3VyY2VfaWQgKXtcclxuXHRcdGlmICggISBqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLm5leHQoKS5oYXNDbGFzcyggJ3dwYmNfc3BpbnNfbG9hZGVyX3dyYXBwZXInICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZnRlciggJzxkaXYgY2xhc3M9XCJ3cGJjX3NwaW5zX2xvYWRlcl93cmFwcGVyXCI+PGRpdiBjbGFzcz1cIndwYmNfc3BpbnNfbG9hZGVyXCI+PC9kaXY+PC9kaXY+JyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCAhIGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkuaGFzQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICkgKXtcclxuXHRcdFx0alF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5hZGRDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cl9zbWFsbCcgKTtcclxuXHRcdH1cclxuXHRcdHdwYmNfY2FsZW5kYXJfX2JsdXJfX3N0YXJ0KCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIFNwaW4gTG9hZGVyIHRvICBjYWxlbmRhclxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZFxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc291cmNlX2lkICl7XHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgKyAud3BiY19zcGluc19sb2FkZXJfd3JhcHBlcicgKS5yZW1vdmUoKTtcclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXJfc21hbGwnICk7XHJcblx0XHR3cGJjX2NhbGVuZGFyX19ibHVyX19zdG9wKCByZXNvdXJjZV9pZCApO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogQWRkIEJsdXIgdG8gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fYmx1cl9fc3RhcnQoIHJlc291cmNlX2lkICl7XHJcblx0XHRpZiAoICEgalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzb3VyY2VfaWQgKS5oYXNDbGFzcyggJ3dwYmNfY2FsZW5kYXJfYmx1cicgKSApe1xyXG5cdFx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLmFkZENsYXNzKCAnd3BiY19jYWxlbmRhcl9ibHVyJyApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVtb3ZlIEJsdXIgaW4gIGNhbGVuZGFyXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcmVzb3VyY2VfaWQgKXtcclxuXHRcdGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICkucmVtb3ZlQ2xhc3MoICd3cGJjX2NhbGVuZGFyX2JsdXInICk7XHJcblx0fVxyXG5cclxuXHJcblx0Ly8gLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi5cclxuXHQvKiAgPT0gIENhbGVuZGFyIFVwZGF0ZSAgLSBWaWV3ICA9PVxyXG5cdC8vIC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uICovXHJcblxyXG5cdC8qKlxyXG5cdCAqIFVwZGF0ZSBMb29rICBvZiBjYWxlbmRhclxyXG5cdCAqXHJcblx0ICogQHBhcmFtIHJlc291cmNlX2lkXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fdXBkYXRlX2xvb2soIHJlc291cmNlX2lkICl7XHJcblxyXG5cdFx0dmFyIGluc3QgPSB3cGJjX2NhbGVuZGFyX19nZXRfaW5zdCggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHRqUXVlcnkuZGF0ZXBpY2suX3VwZGF0ZURhdGVwaWNrKCBpbnN0ICk7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogVXBkYXRlIGR5bmFtaWNhbGx5IE51bWJlciBvZiBNb250aHMgaW4gY2FsZW5kYXJcclxuXHQgKlxyXG5cdCAqIEBwYXJhbSByZXNvdXJjZV9pZCBpbnRcclxuXHQgKiBAcGFyYW0gbW9udGhzX251bWJlciBpbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2NhbGVuZGFyX191cGRhdGVfbW9udGhzX251bWJlciggcmVzb3VyY2VfaWQsIG1vbnRoc19udW1iZXIgKXtcclxuXHRcdHZhciBpbnN0ID0gd3BiY19jYWxlbmRhcl9fZ2V0X2luc3QoIHJlc291cmNlX2lkICk7XHJcblx0XHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHRcdFx0aW5zdC5zZXR0aW5nc1sgJ251bWJlck9mTW9udGhzJyBdID0gbW9udGhzX251bWJlcjtcclxuXHRcdFx0Ly9fd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2NhbGVuZGFyX251bWJlcl9vZl9tb250aHMnLCBtb250aHNfbnVtYmVyICk7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9sb29rKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFNob3cgY2FsZW5kYXIgaW4gIGRpZmZlcmVudCBTa2luXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gc2VsZWN0ZWRfc2tpbl91cmxcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX19jYWxlbmRhcl9fY2hhbmdlX3NraW4oIHNlbGVjdGVkX3NraW5fdXJsICl7XHJcblxyXG5cdC8vY29uc29sZS5sb2coICdTS0lOIFNFTEVDVElPTiA6OicsIHNlbGVjdGVkX3NraW5fdXJsICk7XHJcblxyXG5cdFx0Ly8gUmVtb3ZlIENTUyBza2luXHJcblx0XHR2YXIgc3R5bGVzaGVldCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCAnd3BiYy1jYWxlbmRhci1za2luLWNzcycgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgXCJ3cGJjLWNhbGVuZGFyLXNraW4tY3NzXCIgKTtcclxuXHRcdGNzc05vZGUucmVsID0gJ3N0eWxlc2hlZXQnO1xyXG5cdFx0Y3NzTm9kZS5tZWRpYSA9ICdzY3JlZW4nO1xyXG5cdFx0Y3NzTm9kZS5ocmVmID0gc2VsZWN0ZWRfc2tpbl91cmw7XHQvL1wiaHR0cDovL2JldGEvd3AtY29udGVudC9wbHVnaW5zL2Jvb2tpbmcvY3NzL3NraW5zL2dyZWVuLTAxLmNzc1wiO1xyXG5cdFx0aGVhZElELmFwcGVuZENoaWxkKCBjc3NOb2RlICk7XHJcblx0fVxyXG5cclxuXHJcblx0ZnVuY3Rpb24gd3BiY19fY3NzX19jaGFuZ2Vfc2tpbiggc2VsZWN0ZWRfc2tpbl91cmwsIHN0eWxlc2hlZXRfaWQgPSAnd3BiYy10aW1lX3BpY2tlci1za2luLWNzcycgKXtcclxuXHJcblx0XHQvLyBSZW1vdmUgQ1NTIHNraW5cclxuXHRcdHZhciBzdHlsZXNoZWV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIHN0eWxlc2hlZXRfaWQgKTtcclxuXHRcdHN0eWxlc2hlZXQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc3R5bGVzaGVldCApO1xyXG5cclxuXHJcblx0XHQvLyBBZGQgbmV3IENTUyBza2luXHJcblx0XHR2YXIgaGVhZElEID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoIFwiaGVhZFwiIClbIDAgXTtcclxuXHRcdHZhciBjc3NOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2xpbmsnICk7XHJcblx0XHRjc3NOb2RlLnR5cGUgPSAndGV4dC9jc3MnO1xyXG5cdFx0Y3NzTm9kZS5zZXRBdHRyaWJ1dGUoIFwiaWRcIiwgc3R5bGVzaGVldF9pZCApO1xyXG5cdFx0Y3NzTm9kZS5yZWwgPSAnc3R5bGVzaGVldCc7XHJcblx0XHRjc3NOb2RlLm1lZGlhID0gJ3NjcmVlbic7XHJcblx0XHRjc3NOb2RlLmhyZWYgPSBzZWxlY3RlZF9za2luX3VybDtcdC8vXCJodHRwOi8vYmV0YS93cC1jb250ZW50L3BsdWdpbnMvYm9va2luZy9jc3Mvc2tpbnMvZ3JlZW4tMDEuY3NzXCI7XHJcblx0XHRoZWFkSUQuYXBwZW5kQ2hpbGQoIGNzc05vZGUgKTtcclxuXHR9XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgUyBVIFAgUCBPIFIgVCAgICBNIEEgVCBIICA9PVxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIE1lcmdlIHNldmVyYWwgIGludGVyc2VjdGVkIGludGVydmFscyBvciByZXR1cm4gbm90IGludGVyc2VjdGVkOiAgICAgICAgICAgICAgICAgICAgICAgIFtbMSwzXSxbMiw2XSxbOCwxMF0sWzE1LDE4XV0gIC0+ICAgW1sxLDZdLFs4LDEwXSxbMTUsMThdXVxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBbXSBpbnRlcnZhbHNcdFx0XHQgWyBbMSwzXSxbMiw0XSxbNiw4XSxbOSwxMF0sWzMsN10gXVxyXG5cdFx0ICogQHJldHVybnMgW11cdFx0XHRcdFx0IFsgWzEsOF0sWzksMTBdIF1cclxuXHRcdCAqXHJcblx0XHQgKiBFeG1hbXBsZTogd3BiY19pbnRlcnZhbHNfX21lcmdlX2luZXJzZWN0ZWQoICBbIFsxLDNdLFsyLDRdLFs2LDhdLFs5LDEwXSxbMyw3XSBdICApO1xyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiB3cGJjX2ludGVydmFsc19fbWVyZ2VfaW5lcnNlY3RlZCggaW50ZXJ2YWxzICl7XHJcblxyXG5cdFx0XHRpZiAoICEgaW50ZXJ2YWxzIHx8IGludGVydmFscy5sZW5ndGggPT09IDAgKXtcclxuXHRcdFx0XHRyZXR1cm4gW107XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBtZXJnZWQgPSBbXTtcclxuXHRcdFx0aW50ZXJ2YWxzLnNvcnQoIGZ1bmN0aW9uICggYSwgYiApe1xyXG5cdFx0XHRcdHJldHVybiBhWyAwIF0gLSBiWyAwIF07XHJcblx0XHRcdH0gKTtcclxuXHJcblx0XHRcdHZhciBtZXJnZWRJbnRlcnZhbCA9IGludGVydmFsc1sgMCBdO1xyXG5cclxuXHRcdFx0Zm9yICggdmFyIGkgPSAxOyBpIDwgaW50ZXJ2YWxzLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0dmFyIGludGVydmFsID0gaW50ZXJ2YWxzWyBpIF07XHJcblxyXG5cdFx0XHRcdGlmICggaW50ZXJ2YWxbIDAgXSA8PSBtZXJnZWRJbnRlcnZhbFsgMSBdICl7XHJcblx0XHRcdFx0XHRtZXJnZWRJbnRlcnZhbFsgMSBdID0gTWF0aC5tYXgoIG1lcmdlZEludGVydmFsWyAxIF0sIGludGVydmFsWyAxIF0gKTtcclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0bWVyZ2VkLnB1c2goIG1lcmdlZEludGVydmFsICk7XHJcblx0XHRcdFx0XHRtZXJnZWRJbnRlcnZhbCA9IGludGVydmFsO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWVyZ2VkLnB1c2goIG1lcmdlZEludGVydmFsICk7XHJcblx0XHRcdHJldHVybiBtZXJnZWQ7XHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogSXMgMiBpbnRlcnZhbHMgaW50ZXJzZWN0ZWQ6ICAgICAgIFszNjAxMSwgODYzOTJdICAgIDw9PiAgICBbMSwgNDMxOTJdICA9PiAgdHJ1ZSAgICAgICggaW50ZXJzZWN0ZWQgKVxyXG5cdFx0ICpcclxuXHRcdCAqIEdvb2QgZXhwbGFuYXRpb24gIGhlcmUgaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzI2OTQzNC93aGF0cy10aGUtbW9zdC1lZmZpY2llbnQtd2F5LXRvLXRlc3QtaWYtdHdvLXJhbmdlcy1vdmVybGFwXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtICBpbnRlcnZhbF9BICAgLSBbIDM2MDExLCA4NjM5MiBdXHJcblx0XHQgKiBAcGFyYW0gIGludGVydmFsX0IgICAtIFsgICAgIDEsIDQzMTkyIF1cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJuIGJvb2xcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19pbnRlcnZhbHNfX2lzX2ludGVyc2VjdGVkKCBpbnRlcnZhbF9BLCBpbnRlcnZhbF9CICkge1xyXG5cclxuXHRcdFx0aWYgKFxyXG5cdFx0XHRcdFx0KCAwID09IGludGVydmFsX0EubGVuZ3RoIClcclxuXHRcdFx0XHQgfHwgKCAwID09IGludGVydmFsX0IubGVuZ3RoIClcclxuXHRcdFx0KXtcclxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGludGVydmFsX0FbIDAgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9BWyAwIF0gKTtcclxuXHRcdFx0aW50ZXJ2YWxfQVsgMSBdID0gcGFyc2VJbnQoIGludGVydmFsX0FbIDEgXSApO1xyXG5cdFx0XHRpbnRlcnZhbF9CWyAwIF0gPSBwYXJzZUludCggaW50ZXJ2YWxfQlsgMCBdICk7XHJcblx0XHRcdGludGVydmFsX0JbIDEgXSA9IHBhcnNlSW50KCBpbnRlcnZhbF9CWyAxIF0gKTtcclxuXHJcblx0XHRcdHZhciBpc19pbnRlcnNlY3RlZCA9IE1hdGgubWF4KCBpbnRlcnZhbF9BWyAwIF0sIGludGVydmFsX0JbIDAgXSApIC0gTWF0aC5taW4oIGludGVydmFsX0FbIDEgXSwgaW50ZXJ2YWxfQlsgMSBdICk7XHJcblxyXG5cdFx0XHQvLyBpZiAoIDAgPT0gaXNfaW50ZXJzZWN0ZWQgKSB7XHJcblx0XHRcdC8vXHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdWNoIHJhbmdlcyBnb2luZyBvbmUgYWZ0ZXIgb3RoZXIsIGUuZy46IFsgMTIsIDE1IF0gYW5kIFsgMTUsIDIxIF1cclxuXHRcdFx0Ly8gfVxyXG5cclxuXHRcdFx0aWYgKCBpc19pbnRlcnNlY3RlZCA8IDAgKSB7XHJcblx0XHRcdFx0cmV0dXJuIHRydWU7ICAgICAgICAgICAgICAgICAgICAgLy8gSU5URVJTRUNURURcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0cmV0dXJuIGZhbHNlOyAgICAgICAgICAgICAgICAgICAgICAgLy8gTm90IGludGVyc2VjdGVkXHJcblx0XHR9XHJcblxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogR2V0IHRoZSBjbG9zZXRzIEFCUyB2YWx1ZSBvZiBlbGVtZW50IGluIGFycmF5IHRvIHRoZSBjdXJyZW50IG15VmFsdWVcclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0gbXlWYWx1ZSBcdC0gaW50IGVsZW1lbnQgdG8gc2VhcmNoIGNsb3NldCBcdFx0XHQ0XHJcblx0XHQgKiBAcGFyYW0gbXlBcnJheVx0LSBhcnJheSBvZiBlbGVtZW50cyB3aGVyZSB0byBzZWFyY2ggXHRbNSw4LDEsN11cclxuXHRcdCAqIEByZXR1cm5zIGludFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdDVcclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gd3BiY19nZXRfYWJzX2Nsb3Nlc3RfdmFsdWVfaW5fYXJyKCBteVZhbHVlLCBteUFycmF5ICl7XHJcblxyXG5cdFx0XHRpZiAoIG15QXJyYXkubGVuZ3RoID09IDAgKXsgXHRcdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBhcnJheSBpcyBlbXB0eSAtPiByZXR1cm4gIHRoZSBteVZhbHVlXHJcblx0XHRcdFx0cmV0dXJuIG15VmFsdWU7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBvYmogPSBteUFycmF5WyAwIF07XHJcblx0XHRcdHZhciBkaWZmID0gTWF0aC5hYnMoIG15VmFsdWUgLSBvYmogKTsgICAgICAgICAgICAgXHQvLyBHZXQgZGlzdGFuY2UgYmV0d2VlbiAgMXN0IGVsZW1lbnRcclxuXHRcdFx0dmFyIGNsb3NldFZhbHVlID0gbXlBcnJheVsgMCBdOyAgICAgICAgICAgICAgICAgICBcdFx0XHQvLyBTYXZlIDFzdCBlbGVtZW50XHJcblxyXG5cdFx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBteUFycmF5Lmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdFx0b2JqID0gbXlBcnJheVsgaSBdO1xyXG5cclxuXHRcdFx0XHRpZiAoIE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICkgPCBkaWZmICl7ICAgICBcdFx0XHQvLyB3ZSBmb3VuZCBjbG9zZXIgdmFsdWUgLT4gc2F2ZSBpdFxyXG5cdFx0XHRcdFx0ZGlmZiA9IE1hdGguYWJzKCBteVZhbHVlIC0gb2JqICk7XHJcblx0XHRcdFx0XHRjbG9zZXRWYWx1ZSA9IG9iajtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHJldHVybiBjbG9zZXRWYWx1ZTtcclxuXHRcdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBUIE8gTyBMIFQgSSBQIFMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuXHQvKipcclxuXHQgKiBEZWZpbmUgdG9vbHRpcCB0byBzaG93LCAgd2hlbiAgbW91c2Ugb3ZlciBEYXRlIGluIENhbGVuZGFyXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gIHRvb2x0aXBfdGV4dFx0XHRcdC0gVGV4dCB0byBzaG93XHRcdFx0XHQnQm9va2VkIHRpbWU6IDEyOjAwIC0gMTM6MDA8YnI+Q29zdDogJDIwLjAwJ1xyXG5cdCAqIEBwYXJhbSAgcmVzb3VyY2VfaWRcdFx0XHQtIElEIG9mIGJvb2tpbmcgcmVzb3VyY2VcdCcxJ1xyXG5cdCAqIEBwYXJhbSAgdGRfY2xhc3NcdFx0XHRcdC0gU1FMIGNsYXNzXHRcdFx0XHRcdCcxLTktMjAyMydcclxuXHQgKiBAcmV0dXJucyB7Ym9vbGVhbn1cdFx0XHRcdFx0LSBkZWZpbmVkIHRvIHNob3cgb3Igbm90XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19zZXRfdG9vbHRpcF9fX2Zvcl9fY2FsZW5kYXJfZGF0ZSggdG9vbHRpcF90ZXh0LCByZXNvdXJjZV9pZCwgdGRfY2xhc3MgKXtcclxuXHJcblx0XHQvL1RPRE86IG1ha2UgZXNjYXBpbmcgb2YgdGV4dCBmb3IgcXVvdCBzeW1ib2xzLCAgYW5kIEpTL0hUTUwuLi5cclxuXHJcblx0XHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCArICcgdGQuY2FsNGRhdGUtJyArIHRkX2NsYXNzICkuYXR0ciggJ2RhdGEtY29udGVudCcsIHRvb2x0aXBfdGV4dCApO1xyXG5cclxuXHRcdHZhciB0ZF9lbCA9IGpRdWVyeSggJyNjYWxlbmRhcl9ib29raW5nJyArIHJlc291cmNlX2lkICsgJyB0ZC5jYWw0ZGF0ZS0nICsgdGRfY2xhc3MgKS5nZXQoIDAgKTtcdFx0XHRcdFx0Ly9GaXhJbjogOS4wLjEuMVxyXG5cclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKHRkX2VsKSApXHJcblx0XHRcdCYmICggdW5kZWZpbmVkID09IHRkX2VsLl90aXBweSApXHJcblx0XHRcdCYmICggJycgIT09IHRvb2x0aXBfdGV4dCApXHJcblx0XHQpe1xyXG5cclxuXHRcdFx0d3BiY190aXBweSggdGRfZWwgLCB7XHJcblx0XHRcdFx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBwb3BvdmVyX2NvbnRlbnQgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1jb250ZW50JyApO1xyXG5cclxuXHRcdFx0XHRcdFx0cmV0dXJuICc8ZGl2IGNsYXNzPVwicG9wb3ZlciBwb3BvdmVyX3RpcHB5XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jb250ZW50XCI+J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdCsgcG9wb3Zlcl9jb250ZW50XHJcblx0XHRcdFx0XHRcdFx0XHRcdCsgJzwvZGl2PidcclxuXHRcdFx0XHRcdFx0XHQgKyAnPC9kaXY+JztcclxuXHRcdFx0XHRcdH0sXHJcblx0XHRcdFx0XHRhbGxvd0hUTUwgICAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdHRyaWdnZXJcdFx0XHQgOiAnbW91c2VlbnRlciBmb2N1cycsXHJcblx0XHRcdFx0XHRpbnRlcmFjdGl2ZSAgICAgIDogZmFsc2UsXHJcblx0XHRcdFx0XHRoaWRlT25DbGljayAgICAgIDogdHJ1ZSxcclxuXHRcdFx0XHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdFx0XHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHRcdFx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktdGltZXMnLFxyXG5cdFx0XHRcdFx0cGxhY2VtZW50ICAgICAgICA6ICd0b3AnLFxyXG5cdFx0XHRcdFx0ZGVsYXlcdFx0XHQgOiBbNDAwLCAwXSxcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiA5LjQuMi4yXHJcblx0XHRcdFx0XHQvL2RlbGF5XHRcdFx0IDogWzAsIDk5OTk5OTk5OTldLFx0XHRcdFx0XHRcdC8vIERlYnVnZSAgdG9vbHRpcFxyXG5cdFx0XHRcdFx0aWdub3JlQXR0cmlidXRlcyA6IHRydWUsXHJcblx0XHRcdFx0XHR0b3VjaFx0XHRcdCA6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vWydob2xkJywgNTAwXSwgLy8gNTAwbXMgZGVsYXlcdFx0XHRcdC8vRml4SW46IDkuMi4xLjVcclxuXHRcdFx0XHRcdGFwcGVuZFRvOiAoKSA9PiBkb2N1bWVudC5ib2R5LFxyXG5cdFx0XHR9KTtcclxuXHJcblx0XHRcdHJldHVybiAgdHJ1ZTtcclxuXHRcdH1cclxuXHJcblx0XHRyZXR1cm4gIGZhbHNlO1xyXG5cdH1cclxuXHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuLyogID09ICBEYXRlcyBGdW5jdGlvbnMgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEdldCBudW1iZXIgb2YgZGF0ZXMgYmV0d2VlbiAyIEpTIERhdGVzXHJcbiAqXHJcbiAqIEBwYXJhbSBkYXRlMVx0XHRKUyBEYXRlXHJcbiAqIEBwYXJhbSBkYXRlMlx0XHRKUyBEYXRlXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oZGF0ZTEsIGRhdGUyKSB7XHJcblxyXG4gICAgLy8gVGhlIG51bWJlciBvZiBtaWxsaXNlY29uZHMgaW4gb25lIGRheVxyXG4gICAgdmFyIE9ORV9EQVkgPSAxMDAwICogNjAgKiA2MCAqIDI0O1xyXG5cclxuICAgIC8vIENvbnZlcnQgYm90aCBkYXRlcyB0byBtaWxsaXNlY29uZHNcclxuICAgIHZhciBkYXRlMV9tcyA9IGRhdGUxLmdldFRpbWUoKTtcclxuICAgIHZhciBkYXRlMl9tcyA9IGRhdGUyLmdldFRpbWUoKTtcclxuXHJcbiAgICAvLyBDYWxjdWxhdGUgdGhlIGRpZmZlcmVuY2UgaW4gbWlsbGlzZWNvbmRzXHJcbiAgICB2YXIgZGlmZmVyZW5jZV9tcyA9ICBkYXRlMV9tcyAtIGRhdGUyX21zO1xyXG5cclxuICAgIC8vIENvbnZlcnQgYmFjayB0byBkYXlzIGFuZCByZXR1cm5cclxuICAgIHJldHVybiBNYXRoLnJvdW5kKGRpZmZlcmVuY2VfbXMvT05FX0RBWSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogQ2hlY2sgIGlmIHRoaXMgYXJyYXkgIG9mIGRhdGVzIGlzIGNvbnNlY3V0aXZlIGFycmF5ICBvZiBkYXRlcyBvciBub3QuXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddIC0+IGZhbHNlXHJcbiAqIFx0XHRlLmcuICBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTEwJywnMjAyNC0wNS0xMSddIC0+IHRydWVcclxuICogQHBhcmFtIHNxbF9kYXRlc19hcnJcdCBhcnJheVx0XHRlLmcuOiBbJzIwMjQtMDUtMDknLCcyMDI0LTA1LTE5JywnMjAyNC0wNS0zMCddXHJcbiAqIEByZXR1cm5zIHtib29sZWFufVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBzcWxfZGF0ZXNfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiAxMC4wLjAuNTBcclxuXHJcblx0aWYgKCBzcWxfZGF0ZXNfYXJyLmxlbmd0aCA+IDEgKXtcclxuXHRcdHZhciBwcmV2aW9zX2RhdGUgPSB3cGJjX19nZXRfX2pzX2RhdGUoIHNxbF9kYXRlc19hcnJbIDAgXSApO1xyXG5cdFx0dmFyIGN1cnJlbnRfZGF0ZTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaSA9IDE7IGkgPCBzcWxfZGF0ZXNfYXJyLmxlbmd0aDsgaSsrICl7XHJcblx0XHRcdGN1cnJlbnRfZGF0ZSA9IHdwYmNfX2dldF9fanNfZGF0ZSggc3FsX2RhdGVzX2FycltpXSApO1xyXG5cclxuXHRcdFx0aWYgKCB3cGJjX2RhdGVzX19kYXlzX2JldHdlZW4oIGN1cnJlbnRfZGF0ZSwgcHJldmlvc19kYXRlICkgIT0gMSApe1xyXG5cdFx0XHRcdHJldHVybiAgZmFsc2U7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHByZXZpb3NfZGF0ZSA9IGN1cnJlbnRfZGF0ZTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbi8qICA9PSAgQXV0byBEYXRlcyBTZWxlY3Rpb24gID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqICA9PSBIb3cgdG8gIHVzZSA/ID09XHJcbiAqXHJcbiAqICBGb3IgRGF0ZXMgc2VsZWN0aW9uLCB3ZSBuZWVkIHRvIHVzZSB0aGlzIGxvZ2ljISAgICAgV2UgbmVlZCBzZWxlY3QgdGhlIGRhdGVzIG9ubHkgYWZ0ZXIgYm9va2luZyBkYXRhIGxvYWRlZCFcclxuICpcclxuICogIENoZWNrIGV4YW1wbGUgYmVsbG93LlxyXG4gKlxyXG4gKlx0Ly8gRmlyZSBvbiBhbGwgYm9va2luZyBkYXRlcyBsb2FkZWRcclxuICpcdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiAoIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKXtcclxuICpcclxuICpcdFx0aWYgKCBsb2FkZWRfcmVzb3VyY2VfaWQgPT0gc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkICl7XHJcbiAqXHRcdFx0d3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkLCAnMjAyNC0wNS0xNScsICcyMDI0LTA1LTI1JyApO1xyXG4gKlx0XHR9XHJcbiAqXHR9ICk7XHJcbiAqXHJcbiAqL1xyXG5cclxuXHJcbi8qKlxyXG4gKiBUcnkgdG8gQXV0byBzZWxlY3QgZGF0ZXMgaW4gc3BlY2lmaWMgY2FsZW5kYXIgYnkgc2ltdWxhdGVkIGNsaWNrcyBpbiBkYXRlcGlja2VyXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHQxXHJcbiAqIEBwYXJhbSBjaGVja19pbl95bWRcdFx0JzIwMjQtMDUtMDknXHRcdE9SICBcdFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTIwJ11cclxuICogQHBhcmFtIGNoZWNrX291dF95bWRcdFx0JzIwMjQtMDUtMTUnXHRcdE9wdGlvbmFsXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtudW1iZXJ9XHRcdG51bWJlciBvZiBzZWxlY3RlZCBkYXRlc1xyXG4gKlxyXG4gKiBcdEV4YW1wbGUgMTpcdFx0XHRcdHZhciBudW1fc2VsZWN0ZWRfZGF5cyA9IHdwYmNfYXV0b19zZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXIoIDEsICcyMDI0LTA1LTE1JywgJzIwMjQtMDUtMjUnICk7XHJcbiAqIFx0RXhhbXBsZSAyOlx0XHRcdFx0dmFyIG51bV9zZWxlY3RlZF9kYXlzID0gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggMSwgWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMjAnXSApO1xyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdXRvX3NlbGVjdF9kYXRlc19pbl9jYWxlbmRhciggcmVzb3VyY2VfaWQsIGNoZWNrX2luX3ltZCwgY2hlY2tfb3V0X3ltZCA9ICcnICl7XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDEwLjAuMC40N1xyXG5cclxuXHRjb25zb2xlLmxvZyggJ1dQQkNfQVVUT19TRUxFQ1RfREFURVNfSU5fQ0FMRU5EQVIoIFJFU09VUkNFX0lELCBDSEVDS19JTl9ZTUQsIENIRUNLX09VVF9ZTUQgKScsIHJlc291cmNlX2lkLCBjaGVja19pbl95bWQsIGNoZWNrX291dF95bWQgKTtcclxuXHJcblx0aWYgKFxyXG5cdFx0ICAgKCAnMjEwMC0wMS0wMScgPT0gY2hlY2tfaW5feW1kIClcclxuXHRcdHx8ICggJzIxMDAtMDEtMDEnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0fHwgKCAoICcnID09IGNoZWNrX2luX3ltZCApICYmICggJycgPT0gY2hlY2tfb3V0X3ltZCApIClcclxuXHQpe1xyXG5cdFx0cmV0dXJuIDA7XHJcblx0fVxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIElmIFx0Y2hlY2tfaW5feW1kICA9ICBbICcyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnIF1cdFx0XHRcdEFSUkFZIG9mIERBVEVTXHRcdFx0XHRcdFx0Ly9GaXhJbjogMTAuMC4wLjUwXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgZGF0ZXNfdG9fc2VsZWN0X2FyciA9IFtdO1xyXG5cdGlmICggQXJyYXkuaXNBcnJheSggY2hlY2tfaW5feW1kICkgKXtcclxuXHRcdGRhdGVzX3RvX3NlbGVjdF9hcnIgPSB3cGJjX2Nsb25lX29iaiggY2hlY2tfaW5feW1kICk7XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdFx0Ly8gRXhjZXB0aW9ucyB0byAgc2V0ICBcdE1VTFRJUExFIERBWVMgXHRtb2RlXHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyBpZiBkYXRlcyBhcyBOT1QgQ09OU0VDVVRJVkU6IFsnMjAyNC0wNS0wOScsJzIwMjQtMDUtMTknLCcyMDI0LTA1LTMwJ10sIC0+IHNldCBNVUxUSVBMRSBEQVlTIG1vZGVcclxuXHRcdGlmIChcclxuXHRcdFx0ICAgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKVxyXG5cdFx0XHQmJiAoICcnID09IGNoZWNrX291dF95bWQgKVxyXG5cdFx0XHQmJiAoICEgd3BiY19kYXRlc19faXNfY29uc2VjdXRpdmVfZGF0ZXNfYXJyX3JhbmdlKCBkYXRlc190b19zZWxlY3RfYXJyICkgKVxyXG5cdFx0KXtcclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX211bHRpcGxlKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0fVxyXG5cdFx0Ly8gaWYgbXVsdGlwbGUgZGF5cyB0byBzZWxlY3QsIGJ1dCBlbmFibGVkIFNJTkdMRSBkYXkgbW9kZSwgLT4gc2V0IE1VTFRJUExFIERBWVMgbW9kZVxyXG5cdFx0aWYgKFxyXG5cdFx0XHQgICAoIGRhdGVzX3RvX3NlbGVjdF9hcnIubGVuZ3RoID4gMSApXHJcblx0XHRcdCYmICggJycgPT0gY2hlY2tfb3V0X3ltZCApXHJcblx0XHRcdCYmICggJ3NpbmdsZScgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApXHJcblx0XHQpe1xyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblx0XHR9XHJcblx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHRjaGVja19pbl95bWQgPSBkYXRlc190b19zZWxlY3RfYXJyWyAwIF07XHJcblx0XHRpZiAoICcnID09IGNoZWNrX291dF95bWQgKXtcclxuXHRcdFx0Y2hlY2tfb3V0X3ltZCA9IGRhdGVzX3RvX3NlbGVjdF9hcnJbIChkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aC0xKSBdO1xyXG5cdFx0fVxyXG5cdH1cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHJcblx0aWYgKCAnJyA9PSBjaGVja19pbl95bWQgKXtcclxuXHRcdGNoZWNrX2luX3ltZCA9IGNoZWNrX291dF95bWQ7XHJcblx0fVxyXG5cdGlmICggJycgPT0gY2hlY2tfb3V0X3ltZCApe1xyXG5cdFx0Y2hlY2tfb3V0X3ltZCA9IGNoZWNrX2luX3ltZDtcclxuXHR9XHJcblxyXG5cdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAocmVzb3VyY2VfaWQpICl7XHJcblx0XHRyZXNvdXJjZV9pZCA9ICcxJztcclxuXHR9XHJcblxyXG5cclxuXHR2YXIgaW5zdCA9IHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cclxuXHRpZiAoIG51bGwgIT09IGluc3QgKXtcclxuXHJcblx0XHQvLyBVbnNlbGVjdCBhbGwgZGF0ZXMgYW5kIHNldCAgcHJvcGVydGllcyBvZiBEYXRlcGlja1xyXG5cdFx0alF1ZXJ5KCAnI2RhdGVfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnZhbCggJycgKTsgICAgICBcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly9GaXhJbjogNS40LjNcclxuXHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdGluc3QuZGF0ZXMgPSBbXTtcclxuXHRcdHZhciBjaGVja19pbl9qcyA9IHdwYmNfX2dldF9fanNfZGF0ZSggY2hlY2tfaW5feW1kICk7XHJcblx0XHR2YXIgdGRfY2VsbCAgICAgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19pbl9qcyApO1xyXG5cclxuXHRcdC8vIElzIG9tZSB0eXBlIG9mIGVycm9yLCB0aGVuIHNlbGVjdCBtdWx0aXBsZSBkYXlzIHNlbGVjdGlvbiAgbW9kZS5cclxuXHRcdGlmICggJycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApIHtcclxuIFx0XHRcdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScsICdtdWx0aXBsZScgKTtcclxuXHRcdH1cclxuXHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRFlOQU1JQyA9PVxyXG5cdFx0aWYgKCAnZHluYW1pYycgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSApe1xyXG5cdFx0XHQvLyAxLXN0IGNsaWNrXHJcblx0XHRcdGluc3Quc3RheU9wZW4gPSBmYWxzZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrX2luX2pzLmdldFRpbWUoKSApO1xyXG5cdFx0XHRpZiAoIDAgPT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdFx0cmV0dXJuIDA7ICBcdFx0XHRcdFx0XHRcdFx0Ly8gRmlyc3QgY2xpY2sgIHdhcyB1bnN1Y2Nlc3NmdWwsIHNvIHdlIG11c3Qgbm90IG1ha2Ugb3RoZXIgY2xpY2tcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gMi1uZCBjbGlja1xyXG5cdFx0XHR2YXIgY2hlY2tfb3V0X2pzID0gd3BiY19fZ2V0X19qc19kYXRlKCBjaGVja19vdXRfeW1kICk7XHJcblx0XHRcdHZhciB0ZF9jZWxsX291dCA9IHdwYmNfZ2V0X2NsaWNrZWRfdGQoIGluc3QuaWQsIGNoZWNrX291dF9qcyApO1xyXG5cdFx0XHRpbnN0LnN0YXlPcGVuID0gdHJ1ZTtcclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGxfb3V0LCAnIycgKyBpbnN0LmlkLCBjaGVja19vdXRfanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gRklYRUQgPT1cclxuXHRcdGlmICggICdmaXhlZCcgPT09IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZGF5c19zZWxlY3RfbW9kZScgKSkge1xyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gU0lOR0xFID09XHJcblx0XHRpZiAoICdzaW5nbGUnID09PSBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2RheXNfc2VsZWN0X21vZGUnICkgKXtcclxuXHRcdFx0Ly9qUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGNoZWNrX2luX2pzLCBudWxsICkgKTtcdFx0Ly8gRG8gd2UgbmVlZCB0byBydW4gIHRoaXMgPyBQbGVhc2Ugbm90ZSwgY2hlY2tfaW5fanMgbXVzdCAgaGF2ZSB0aW1lLCAgbWluLCBzZWMgZGVmaW5lZCB0byAwIVxyXG5cdFx0XHRqUXVlcnkuZGF0ZXBpY2suX3NlbGVjdERheSggdGRfY2VsbCwgJyMnICsgaW5zdC5pZCwgY2hlY2tfaW5fanMuZ2V0VGltZSgpICk7XHJcblx0XHR9XHJcblxyXG5cdFx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0XHQvLyAgPT0gTVVMVElQTEUgPT1cclxuXHRcdGlmICggJ211bHRpcGxlJyA9PT0gX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkYXlzX3NlbGVjdF9tb2RlJyApICl7XHJcblxyXG5cdFx0XHR2YXIgZGF0ZXNfYXJyO1xyXG5cclxuXHRcdFx0aWYgKCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aCA+IDAgKXtcclxuXHRcdFx0XHQvLyBTaXR1YXRpb24sIHdoZW4gd2UgaGF2ZSBkYXRlcyBhcnJheTogWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXS4gIGFuZCBub3QgdGhlIENoZWNrIEluIC8gQ2hlY2sgIG91dCBkYXRlcyBhcyBwYXJhbWV0ZXIgaW4gdGhpcyBmdW5jdGlvblxyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2FyciggZGF0ZXNfdG9fc2VsZWN0X2FyciApO1xyXG5cdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdGRhdGVzX2FyciA9IHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kLCBpbnN0ICk7XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdGlmICggMCA9PT0gZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aCApe1xyXG5cdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBGb3IgQ2FsZW5kYXIgRGF5cyBzZWxlY3Rpb25cclxuXHRcdFx0Zm9yICggdmFyIGogPSAwOyBqIDwgZGF0ZXNfYXJyLmRhdGVzX2pzLmxlbmd0aDsgaisrICl7ICAgICAgIC8vIExvb3AgYXJyYXkgb2YgZGF0ZXNcclxuXHJcblx0XHRcdFx0dmFyIHN0cl9kYXRlID0gd3BiY19fZ2V0X19zcWxfY2xhc3NfZGF0ZSggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHJcblx0XHRcdFx0Ly8gRGF0ZSB1bmF2YWlsYWJsZSAhXHJcblx0XHRcdFx0aWYgKCAwID09IF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19nZXRfZm9yX2RhdGUoIHJlc291cmNlX2lkLCBzdHJfZGF0ZSApLmRheV9hdmFpbGFiaWxpdHkgKXtcclxuXHRcdFx0XHRcdHJldHVybiAwO1xyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdFx0aWYgKCBkYXRlc19hcnIuZGF0ZXNfanNbIGogXSAhPSAtMSApIHtcclxuXHRcdFx0XHRcdGluc3QuZGF0ZXMucHVzaCggZGF0ZXNfYXJyLmRhdGVzX2pzWyBqIF0gKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH1cclxuXHJcblx0XHRcdHZhciBjaGVja19vdXRfZGF0ZSA9IGRhdGVzX2Fyci5kYXRlc19qc1sgKGRhdGVzX2Fyci5kYXRlc19qcy5sZW5ndGggLSAxKSBdO1xyXG5cclxuXHRcdFx0aW5zdC5kYXRlcy5wdXNoKCBjaGVja19vdXRfZGF0ZSApOyBcdFx0XHQvLyBOZWVkIGFkZCBvbmUgYWRkaXRpb25hbCBTQU1FIGRhdGUgZm9yIGNvcnJlY3QgIHdvcmtzIG9mIGRhdGVzIHNlbGVjdGlvbiAhISEhIVxyXG5cclxuXHRcdFx0dmFyIGNoZWNrb3V0X3RpbWVzdGFtcCA9IGNoZWNrX291dF9kYXRlLmdldFRpbWUoKTtcclxuXHRcdFx0dmFyIHRkX2NlbGwgPSB3cGJjX2dldF9jbGlja2VkX3RkKCBpbnN0LmlkLCBjaGVja19vdXRfZGF0ZSApO1xyXG5cclxuXHRcdFx0alF1ZXJ5LmRhdGVwaWNrLl9zZWxlY3REYXkoIHRkX2NlbGwsICcjJyArIGluc3QuaWQsIGNoZWNrb3V0X3RpbWVzdGFtcCApO1xyXG5cdFx0fVxyXG5cclxuXHJcblx0XHRpZiAoIDAgIT09IGluc3QuZGF0ZXMubGVuZ3RoICl7XHJcblx0XHRcdC8vIFNjcm9sbCB0byBzcGVjaWZpYyBtb250aCwgaWYgd2Ugc2V0IGRhdGVzIGluIHNvbWUgZnV0dXJlIG1vbnRoc1xyXG5cdFx0XHR3cGJjX2NhbGVuZGFyX19zY3JvbGxfdG8oIHJlc291cmNlX2lkLCBpbnN0LmRhdGVzWyAwIF0uZ2V0RnVsbFllYXIoKSwgaW5zdC5kYXRlc1sgMCBdLmdldE1vbnRoKCkrMSApO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBpbnN0LmRhdGVzLmxlbmd0aDtcclxuXHR9XHJcblxyXG5cdHJldHVybiAwO1xyXG59XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBIVE1MIHRkIGVsZW1lbnQgKHdoZXJlIHdhcyBjbGljayBpbiBjYWxlbmRhciAgZGF5ICBjZWxsKVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNhbGVuZGFyX2h0bWxfaWRcdFx0XHQnY2FsZW5kYXJfYm9va2luZzEnXHJcblx0ICogQHBhcmFtIGRhdGVfanNcdFx0XHRcdFx0SlMgRGF0ZVxyXG5cdCAqIEByZXR1cm5zIHsqfGpRdWVyeX1cdFx0XHRcdERvbSBIVE1MIHRkIGVsZW1lbnRcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF9jbGlja2VkX3RkKCBjYWxlbmRhcl9odG1sX2lkLCBkYXRlX2pzICl7XHJcblxyXG5cdCAgICB2YXIgdGRfY2VsbCA9IGpRdWVyeSggJyMnICsgY2FsZW5kYXJfaHRtbF9pZCArICcgLnNxbF9kYXRlXycgKyB3cGJjX19nZXRfX3NxbF9jbGFzc19kYXRlKCBkYXRlX2pzICkgKS5nZXQoIDAgKTtcclxuXHJcblx0XHRyZXR1cm4gdGRfY2VsbDtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGNoZWNrX2luX3ltZFx0XHRcdFx0XHRcdFx0JzIwMjQtMDUtMTUnXHJcblx0ICogQHBhcmFtIGNoZWNrX291dF95bWRcdFx0XHRcdFx0XHRcdCcyMDI0LTA1LTI1J1xyXG5cdCAqIEBwYXJhbSBpbnN0XHRcdFx0XHRcdFx0XHRcdFx0RGF0ZXBpY2sgSW5zdC4gVXNlIHdwYmNfY2FsZW5kYXJfX2dldF9pbnN0KCByZXNvdXJjZV9pZCApO1xyXG5cdCAqIEByZXR1cm5zIHt7ZGF0ZXNfanM6ICpbXSwgZGF0ZXNfc3RyOiAqW119fVxyXG5cdCAqL1xyXG5cdGZ1bmN0aW9uIHdwYmNfZ2V0X3NlbGVjdGlvbl9kYXRlc19qc19zdHJfYXJyX19mcm9tX2NoZWNrX2luX291dCggY2hlY2tfaW5feW1kLCBjaGVja19vdXRfeW1kICwgaW5zdCApe1xyXG5cclxuXHRcdHZhciBvcmlnaW5hbF9hcnJheSA9IFtdO1xyXG5cdFx0dmFyIGRhdGU7XHJcblx0XHR2YXIgYmtfZGlzdGluY3RfZGF0ZXMgPSBbXTtcclxuXHJcblx0XHR2YXIgY2hlY2tfaW5fZGF0ZSA9IGNoZWNrX2luX3ltZC5zcGxpdCggJy0nICk7XHJcblx0XHR2YXIgY2hlY2tfb3V0X2RhdGUgPSBjaGVja19vdXRfeW1kLnNwbGl0KCAnLScgKTtcclxuXHJcblx0XHRkYXRlID0gbmV3IERhdGUoKTtcclxuXHRcdGRhdGUuc2V0RnVsbFllYXIoIGNoZWNrX2luX2RhdGVbIDAgXSwgKGNoZWNrX2luX2RhdGVbIDEgXSAtIDEpLCBjaGVja19pbl9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgPSBkYXRlO1xyXG5cdFx0b3JpZ2luYWxfYXJyYXkucHVzaCggalF1ZXJ5LmRhdGVwaWNrLl9yZXN0cmljdE1pbk1heCggaW5zdCwgalF1ZXJ5LmRhdGVwaWNrLl9kZXRlcm1pbmVEYXRlKCBpbnN0LCBkYXRlLCBudWxsICkgKSApOyAvL2FkZCBkYXRlXHJcblx0XHRpZiAoICEgd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChjaGVja19pbl9kYXRlWyAyIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAxIF0gKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0pICkgKXtcclxuXHRcdFx0YmtfZGlzdGluY3RfZGF0ZXMucHVzaCggcGFyc2VJbnQoY2hlY2tfaW5fZGF0ZVsgMiBdKSArICcuJyArIHBhcnNlSW50KGNoZWNrX2luX2RhdGVbIDEgXSkgKyAnLicgKyBjaGVja19pbl9kYXRlWyAwIF0gKTtcclxuXHRcdH1cclxuXHJcblx0XHR2YXIgZGF0ZV9vdXQgPSBuZXcgRGF0ZSgpO1xyXG5cdFx0ZGF0ZV9vdXQuc2V0RnVsbFllYXIoIGNoZWNrX291dF9kYXRlWyAwIF0sIChjaGVja19vdXRfZGF0ZVsgMSBdIC0gMSksIGNoZWNrX291dF9kYXRlWyAyIF0gKTsgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB5ZWFyLCBtb250aCwgZGF0ZVxyXG5cdFx0dmFyIG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID0gZGF0ZV9vdXQ7XHJcblxyXG5cdFx0dmFyIG1ld0RhdGUgPSBuZXcgRGF0ZSggb3JpZ2luYWxfY2hlY2tfaW5fZGF0ZS5nZXRGdWxsWWVhcigpLCBvcmlnaW5hbF9jaGVja19pbl9kYXRlLmdldE1vbnRoKCksIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICk7XHJcblx0XHRtZXdEYXRlLnNldERhdGUoIG9yaWdpbmFsX2NoZWNrX2luX2RhdGUuZ2V0RGF0ZSgpICsgMSApO1xyXG5cclxuXHRcdHdoaWxlIChcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX291dF9kYXRlID4gZGF0ZSkgJiZcclxuXHRcdFx0KG9yaWdpbmFsX2NoZWNrX2luX2RhdGUgIT0gb3JpZ2luYWxfY2hlY2tfb3V0X2RhdGUpICl7XHJcblx0XHRcdGRhdGUgPSBuZXcgRGF0ZSggbWV3RGF0ZS5nZXRGdWxsWWVhcigpLCBtZXdEYXRlLmdldE1vbnRoKCksIG1ld0RhdGUuZ2V0RGF0ZSgpICk7XHJcblxyXG5cdFx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCBqUXVlcnkuZGF0ZXBpY2suX3Jlc3RyaWN0TWluTWF4KCBpbnN0LCBqUXVlcnkuZGF0ZXBpY2suX2RldGVybWluZURhdGUoIGluc3QsIGRhdGUsIG51bGwgKSApICk7IC8vYWRkIGRhdGVcclxuXHRcdFx0aWYgKCAhd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChkYXRlLmdldERhdGUoKSArICcuJyArIHBhcnNlSW50KCBkYXRlLmdldE1vbnRoKCkgKyAxICkgKyAnLicgKyBkYXRlLmdldEZ1bGxZZWFyKCkpICkgKXtcclxuXHRcdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCAocGFyc2VJbnQoZGF0ZS5nZXREYXRlKCkpICsgJy4nICsgcGFyc2VJbnQoIGRhdGUuZ2V0TW9udGgoKSArIDEgKSArICcuJyArIGRhdGUuZ2V0RnVsbFllYXIoKSkgKTtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0bWV3RGF0ZSA9IG5ldyBEYXRlKCBkYXRlLmdldEZ1bGxZZWFyKCksIGRhdGUuZ2V0TW9udGgoKSwgZGF0ZS5nZXREYXRlKCkgKTtcclxuXHRcdFx0bWV3RGF0ZS5zZXREYXRlKCBtZXdEYXRlLmdldERhdGUoKSArIDEgKTtcclxuXHRcdH1cclxuXHRcdG9yaWdpbmFsX2FycmF5LnBvcCgpO1xyXG5cdFx0YmtfZGlzdGluY3RfZGF0ZXMucG9wKCk7XHJcblxyXG5cdFx0cmV0dXJuIHsnZGF0ZXNfanMnOiBvcmlnaW5hbF9hcnJheSwgJ2RhdGVzX3N0cic6IGJrX2Rpc3RpbmN0X2RhdGVzfTtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCBhcnJheXMgb2YgSlMgYW5kIFNRTCBkYXRlcyBhcyBkYXRlcyBhcnJheVxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGVzX3RvX3NlbGVjdF9hcnJcdD0gWycyMDI0LTA1LTA5JywnMjAyNC0wNS0xOScsJzIwMjQtMDUtMzAnXVxyXG5cdCAqXHJcblx0ICogQHJldHVybnMge3tkYXRlc19qczogKltdLCBkYXRlc19zdHI6ICpbXX19XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfc2VsZWN0aW9uX2RhdGVzX2pzX3N0cl9hcnJfX2Zyb21fYXJyKCBkYXRlc190b19zZWxlY3RfYXJyICl7XHRcdFx0XHRcdFx0XHRcdFx0XHQvL0ZpeEluOiAxMC4wLjAuNTBcclxuXHJcblx0XHR2YXIgb3JpZ2luYWxfYXJyYXkgICAgPSBbXTtcclxuXHRcdHZhciBia19kaXN0aW5jdF9kYXRlcyA9IFtdO1xyXG5cdFx0dmFyIG9uZV9kYXRlX3N0cjtcclxuXHJcblx0XHRmb3IgKCB2YXIgZCA9IDA7IGQgPCBkYXRlc190b19zZWxlY3RfYXJyLmxlbmd0aDsgZCsrICl7XHJcblxyXG5cdFx0XHRvcmlnaW5hbF9hcnJheS5wdXNoKCB3cGJjX19nZXRfX2pzX2RhdGUoIGRhdGVzX3RvX3NlbGVjdF9hcnJbIGQgXSApICk7XHJcblxyXG5cdFx0XHRvbmVfZGF0ZV9zdHIgPSBkYXRlc190b19zZWxlY3RfYXJyWyBkIF0uc3BsaXQoJy0nKVxyXG5cdFx0XHRpZiAoICEgd3BiY19pbl9hcnJheSggYmtfZGlzdGluY3RfZGF0ZXMsIChvbmVfZGF0ZV9zdHJbIDIgXSArICcuJyArIG9uZV9kYXRlX3N0clsgMSBdICsgJy4nICsgb25lX2RhdGVfc3RyWyAwIF0pICkgKXtcclxuXHRcdFx0XHRia19kaXN0aW5jdF9kYXRlcy5wdXNoKCBwYXJzZUludChvbmVfZGF0ZV9zdHJbIDIgXSkgKyAnLicgKyBwYXJzZUludChvbmVfZGF0ZV9zdHJbIDEgXSkgKyAnLicgKyBvbmVfZGF0ZV9zdHJbIDAgXSApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHsnZGF0ZXNfanMnOiBvcmlnaW5hbF9hcnJheSwgJ2RhdGVzX3N0cic6IG9yaWdpbmFsX2FycmF5fTtcclxuXHR9XHJcblxyXG4vLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuLyogID09ICBBdXRvIEZpbGwgRmllbGRzIC8gQXV0byBTZWxlY3QgRGF0ZXMgID09XHJcbi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xyXG5cclxualF1ZXJ5KCBkb2N1bWVudCApLnJlYWR5KCBmdW5jdGlvbiAoKXtcclxuXHJcblx0dmFyIHVybF9wYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCB3aW5kb3cubG9jYXRpb24uc2VhcmNoICk7XHJcblxyXG5cdC8vIERpc2FibGUgZGF5cyBzZWxlY3Rpb24gIGluIGNhbGVuZGFyLCAgYWZ0ZXIgIHJlZGlyZWN0aW9uICBmcm9tICB0aGUgXCJTZWFyY2ggcmVzdWx0cyBwYWdlLCAgYWZ0ZXIgIHNlYXJjaCAgYXZhaWxhYmlsaXR5XCIgXHRcdFx0Ly9GaXhJbjogOC44LjIuM1xyXG5cdGlmICAoICdPbicgIT0gX3dwYmMuZ2V0X290aGVyX3BhcmFtKCAnaXNfZW5hYmxlZF9ib29raW5nX3NlYXJjaF9yZXN1bHRzX2RheXNfc2VsZWN0JyApICkge1xyXG5cdFx0aWYgKFxyXG5cdFx0XHQoIHVybF9wYXJhbXMuaGFzKCAnd3BiY19zZWxlY3RfY2hlY2tfaW4nICkgKSAmJlxyXG5cdFx0XHQoIHVybF9wYXJhbXMuaGFzKCAnd3BiY19zZWxlY3RfY2hlY2tfb3V0JyApICkgJiZcclxuXHRcdFx0KCB1cmxfcGFyYW1zLmhhcyggJ3dwYmNfc2VsZWN0X2NhbGVuZGFyX2lkJyApIClcclxuXHRcdCl7XHJcblxyXG5cdFx0XHR2YXIgc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkID0gcGFyc2VJbnQoIHVybF9wYXJhbXMuZ2V0KCAnd3BiY19zZWxlY3RfY2FsZW5kYXJfaWQnICkgKTtcclxuXHJcblx0XHRcdC8vIEZpcmUgb24gYWxsIGJvb2tpbmcgZGF0ZXMgbG9hZGVkXHJcblx0XHRcdGpRdWVyeSggJ2JvZHknICkub24oICd3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGEnLCBmdW5jdGlvbiAoIGV2ZW50LCBsb2FkZWRfcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0XHRcdFx0aWYgKCBsb2FkZWRfcmVzb3VyY2VfaWQgPT0gc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyX2lkICl7XHJcblx0XHRcdFx0XHR3cGJjX2F1dG9fc2VsZWN0X2RhdGVzX2luX2NhbGVuZGFyKCBzZWxlY3RfZGF0ZXNfaW5fY2FsZW5kYXJfaWQsIHVybF9wYXJhbXMuZ2V0KCAnd3BiY19zZWxlY3RfY2hlY2tfaW4nICksIHVybF9wYXJhbXMuZ2V0KCAnd3BiY19zZWxlY3RfY2hlY2tfb3V0JyApICk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9ICk7XHJcblx0XHR9XHJcblx0fVxyXG5cclxuXHRpZiAoIHVybF9wYXJhbXMuaGFzKCAnd3BiY19hdXRvX2ZpbGwnICkgKXtcclxuXHJcblx0XHR2YXIgd3BiY19hdXRvX2ZpbGxfdmFsdWUgPSB1cmxfcGFyYW1zLmdldCggJ3dwYmNfYXV0b19maWxsJyApO1xyXG5cclxuXHRcdC8vIENvbnZlcnQgYmFjay4gICAgIFNvbWUgc3lzdGVtcyBkbyBub3QgbGlrZSBzeW1ib2wgJ34nIGluIFVSTCwgc28gIHdlIG5lZWQgdG8gcmVwbGFjZSB0byAgc29tZSBvdGhlciBzeW1ib2xzXHJcblx0XHR3cGJjX2F1dG9fZmlsbF92YWx1ZSA9IHdwYmNfYXV0b19maWxsX3ZhbHVlLnJlcGxhY2VBbGwoICdfXl8nLCAnficgKTtcclxuXHJcblx0XHR3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkcyggd3BiY19hdXRvX2ZpbGxfdmFsdWUgKTtcclxuXHR9XHJcblxyXG59ICk7XHJcblxyXG4vKipcclxuICogQXV0b2ZpbGwgLyBzZWxlY3QgYm9va2luZyBmb3JtICBmaWVsZHMgYnkgIHZhbHVlcyBmcm9tICB0aGUgR0VUIHJlcXVlc3QgIHBhcmFtZXRlcjogP3dwYmNfYXV0b19maWxsPVxyXG4gKlxyXG4gKiBAcGFyYW0gYXV0b19maWxsX3N0clxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19hdXRvX2ZpbGxfYm9va2luZ19maWVsZHMoIGF1dG9fZmlsbF9zdHIgKXtcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vRml4SW46IDEwLjAuMC40OFxyXG5cclxuXHRpZiAoICcnID09IGF1dG9fZmlsbF9zdHIgKXtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG4vLyBjb25zb2xlLmxvZyggJ1dQQkNfQVVUT19GSUxMX0JPT0tJTkdfRklFTERTKCBBVVRPX0ZJTExfU1RSICknLCBhdXRvX2ZpbGxfc3RyKTtcclxuXHJcblx0dmFyIGZpZWxkc19hcnIgPSB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UoIGF1dG9fZmlsbF9zdHIgKTtcclxuXHJcblx0Zm9yICggbGV0IGkgPSAwOyBpIDwgZmllbGRzX2Fyci5sZW5ndGg7IGkrKyApe1xyXG5cdFx0alF1ZXJ5KCAnW25hbWU9XCInICsgZmllbGRzX2FyclsgaSBdWyAnbmFtZScgXSArICdcIl0nICkudmFsKCBmaWVsZHNfYXJyWyBpIF1bICd2YWx1ZScgXSApO1xyXG5cdH1cclxufVxyXG5cclxuXHQvKipcclxuXHQgKiBQYXJzZSBkYXRhIGZyb20gIGdldCBwYXJhbWV0ZXI6XHQ/d3BiY19hdXRvX2ZpbGw9dmlzaXRvcnMyMzFeMn5tYXhfY2FwYWNpdHkyMzFeMlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGRhdGFfc3RyICAgICAgPSAgICd2aXNpdG9yczIzMV4yfm1heF9jYXBhY2l0eTIzMV4yJztcclxuXHQgKiBAcmV0dXJucyB7Kn1cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2F1dG9fZmlsbF9ib29raW5nX2ZpZWxkc19fcGFyc2UoIGRhdGFfc3RyICl7XHJcblxyXG5cdFx0dmFyIGZpbHRlcl9vcHRpb25zX2FyciA9IFtdO1xyXG5cclxuXHRcdHZhciBkYXRhX2FyciA9IGRhdGFfc3RyLnNwbGl0KCAnficgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBkYXRhX2Fyci5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0dmFyIG15X2Zvcm1fZmllbGQgPSBkYXRhX2FyclsgaiBdLnNwbGl0KCAnXicgKTtcclxuXHJcblx0XHRcdHZhciBmaWx0ZXJfbmFtZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMCBdKSkgPyBteV9mb3JtX2ZpZWxkWyAwIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl92YWx1ZSA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAxIF0pKSA/IG15X2Zvcm1fZmllbGRbIDEgXSA6ICcnO1xyXG5cclxuXHRcdFx0ZmlsdGVyX29wdGlvbnNfYXJyLnB1c2goXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J25hbWUnICA6IGZpbHRlcl9uYW1lLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3ZhbHVlJyA6IGZpbHRlcl92YWx1ZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdCAgICk7XHJcblx0XHR9XHJcblx0XHRyZXR1cm4gZmlsdGVyX29wdGlvbnNfYXJyO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUGFyc2UgZGF0YSBmcm9tICBnZXQgcGFyYW1ldGVyOlx0P3NlYXJjaF9nZXRfX2N1c3RvbV9wYXJhbXM9Li4uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZGF0YV9zdHIgICAgICA9ICAgJ3RleHRec2VhcmNoX2ZpZWxkX19kaXNwbGF5X2NoZWNrX2luXjIzLjA1LjIwMjR+dGV4dF5zZWFyY2hfZmllbGRfX2Rpc3BsYXlfY2hlY2tfb3V0XjI2LjA1LjIwMjR+c2VsZWN0Ym94LW9uZV5zZWFyY2hfcXVhbnRpdHleMn5zZWxlY3Rib3gtb25lXmxvY2F0aW9uXlNwYWlufnNlbGVjdGJveC1vbmVebWF4X2NhcGFjaXR5XjJ+c2VsZWN0Ym94LW9uZV5hbWVuaXR5XnBhcmtpbmd+Y2hlY2tib3hec2VhcmNoX2ZpZWxkX19leHRlbmRfc2VhcmNoX2RheXNeNX5zdWJtaXReXlNlYXJjaH5oaWRkZW5ec2VhcmNoX2dldF9fY2hlY2tfaW5feW1kXjIwMjQtMDUtMjN+aGlkZGVuXnNlYXJjaF9nZXRfX2NoZWNrX291dF95bWReMjAyNC0wNS0yNn5oaWRkZW5ec2VhcmNoX2dldF9fdGltZV5+aGlkZGVuXnNlYXJjaF9nZXRfX3F1YW50aXR5XjJ+aGlkZGVuXnNlYXJjaF9nZXRfX2V4dGVuZF41fmhpZGRlbl5zZWFyY2hfZ2V0X191c2Vyc19pZF5+aGlkZGVuXnNlYXJjaF9nZXRfX2N1c3RvbV9wYXJhbXNefic7XHJcblx0ICogQHJldHVybnMgeyp9XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19hdXRvX2ZpbGxfc2VhcmNoX2ZpZWxkc19fcGFyc2UoIGRhdGFfc3RyICl7XHJcblxyXG5cdFx0dmFyIGZpbHRlcl9vcHRpb25zX2FyciA9IFtdO1xyXG5cclxuXHRcdHZhciBkYXRhX2FyciA9IGRhdGFfc3RyLnNwbGl0KCAnficgKTtcclxuXHJcblx0XHRmb3IgKCB2YXIgaiA9IDA7IGogPCBkYXRhX2Fyci5sZW5ndGg7IGorKyApe1xyXG5cclxuXHRcdFx0dmFyIG15X2Zvcm1fZmllbGQgPSBkYXRhX2FyclsgaiBdLnNwbGl0KCAnXicgKTtcclxuXHJcblx0XHRcdHZhciBmaWx0ZXJfdHlwZSAgPSAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiAobXlfZm9ybV9maWVsZFsgMCBdKSkgPyBteV9mb3JtX2ZpZWxkWyAwIF0gOiAnJztcclxuXHRcdFx0dmFyIGZpbHRlcl9uYW1lICA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIChteV9mb3JtX2ZpZWxkWyAxIF0pKSA/IG15X2Zvcm1fZmllbGRbIDEgXSA6ICcnO1xyXG5cdFx0XHR2YXIgZmlsdGVyX3ZhbHVlID0gKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgKG15X2Zvcm1fZmllbGRbIDIgXSkpID8gbXlfZm9ybV9maWVsZFsgMiBdIDogJyc7XHJcblxyXG5cdFx0XHRmaWx0ZXJfb3B0aW9uc19hcnIucHVzaChcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgIDogZmlsdGVyX3R5cGUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnbmFtZScgIDogZmlsdGVyX25hbWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndmFsdWUnIDogZmlsdGVyX3ZhbHVlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0ICAgKTtcclxuXHRcdH1cclxuXHRcdHJldHVybiBmaWx0ZXJfb3B0aW9uc19hcnI7XHJcblx0fVxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vKiAgPT0gIEF1dG8gVXBkYXRlIG51bWJlciBvZiBtb250aHMgaW4gY2FsZW5kYXJzIE9OIHNjcmVlbiBzaXplIGNoYW5nZWQgID09XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xyXG5cclxuLyoqXHJcbiAqIEF1dG8gVXBkYXRlIE51bWJlciBvZiBNb250aHMgaW4gQ2FsZW5kYXIsIGUuZy46ICBcdFx0aWYgICAgKCBXSU5ET1dfV0lEVEggPD0gNzgycHggKSAgID4+PiBcdE1PTlRIU19OVU1CRVIgPSAxXHJcbiAqICAgRUxTRTogIG51bWJlciBvZiBtb250aHMgZGVmaW5lZCBpbiBzaG9ydGNvZGUuXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZCBpbnRcclxuICpcclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsZW5kYXJfX2F1dG9fdXBkYXRlX21vbnRoc19udW1iZXJfX29uX3Jlc2l6ZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0aWYgKCB0cnVlID09PSBfd3BiYy5nZXRfb3RoZXJfcGFyYW0oICdpc19hbGxvd19zZXZlcmFsX21vbnRoc19vbl9tb2JpbGUnICkgKSB7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHR2YXIgbG9jYWxfX251bWJlcl9vZl9tb250aHMgPSBwYXJzZUludCggX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdjYWxlbmRhcl9udW1iZXJfb2ZfbW9udGhzJyApICk7XHJcblxyXG5cdGlmICggbG9jYWxfX251bWJlcl9vZl9tb250aHMgPiAxICl7XHJcblxyXG5cdFx0aWYgKCBqUXVlcnkoIHdpbmRvdyApLndpZHRoKCkgPD0gNzgyICl7XHJcblx0XHRcdHdwYmNfY2FsZW5kYXJfX3VwZGF0ZV9tb250aHNfbnVtYmVyKCByZXNvdXJjZV9pZCwgMSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0d3BiY19jYWxlbmRhcl9fdXBkYXRlX21vbnRoc19udW1iZXIoIHJlc291cmNlX2lkLCBsb2NhbF9fbnVtYmVyX29mX21vbnRocyApO1xyXG5cdFx0fVxyXG5cclxuXHR9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdXRvIFVwZGF0ZSBOdW1iZXIgb2YgTW9udGhzIGluICAgQUxMICAgQ2FsZW5kYXJzXHJcbiAqXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbGVuZGFyc19fYXV0b191cGRhdGVfbW9udGhzX251bWJlcigpe1xyXG5cclxuXHR2YXIgYWxsX2NhbGVuZGFyc19hcnIgPSBfd3BiYy5jYWxlbmRhcnNfYWxsX19nZXQoKTtcclxuXHJcblx0Ly8gVGhpcyBMT09QIFwiZm9yIGluXCIgaXMgR09PRCwgYmVjYXVzZSB3ZSBjaGVjayAgaGVyZSBrZXlzICAgICdjYWxlbmRhcl8nID09PSBjYWxlbmRhcl9pZC5zbGljZSggMCwgOSApXHJcblx0Zm9yICggdmFyIGNhbGVuZGFyX2lkIGluIGFsbF9jYWxlbmRhcnNfYXJyICl7XHJcblx0XHRpZiAoICdjYWxlbmRhcl8nID09PSBjYWxlbmRhcl9pZC5zbGljZSggMCwgOSApICl7XHJcblx0XHRcdHZhciByZXNvdXJjZV9pZCA9IHBhcnNlSW50KCBjYWxlbmRhcl9pZC5zbGljZSggOSApICk7XHRcdFx0Ly8gICdjYWxlbmRhcl8zJyAtPiAzXHJcblx0XHRcdGlmICggcmVzb3VyY2VfaWQgPiAwICl7XHJcblx0XHRcdFx0d3BiY19jYWxlbmRhcl9fYXV0b191cGRhdGVfbW9udGhzX251bWJlcl9fb25fcmVzaXplKCByZXNvdXJjZV9pZCApO1xyXG5cdFx0XHR9XHJcblx0XHR9XHJcblx0fVxyXG59XHJcblxyXG4vKipcclxuICogSWYgYnJvd3NlciB3aW5kb3cgY2hhbmdlZCwgIHRoZW4gIHVwZGF0ZSBudW1iZXIgb2YgbW9udGhzLlxyXG4gKi9cclxualF1ZXJ5KCB3aW5kb3cgKS5vbiggJ3Jlc2l6ZScsIGZ1bmN0aW9uICgpe1xyXG5cdHdwYmNfY2FsZW5kYXJzX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyKCk7XHJcbn0gKTtcclxuXHJcbi8qKlxyXG4gKiBBdXRvIHVwZGF0ZSBjYWxlbmRhciBudW1iZXIgb2YgbW9udGhzIG9uIGluaXRpYWwgcGFnZSBsb2FkXHJcbiAqL1xyXG5qUXVlcnkoIGRvY3VtZW50ICkucmVhZHkoIGZ1bmN0aW9uICgpe1xyXG5cdHZhciBjbG9zZWRfdGltZXIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdHdwYmNfY2FsZW5kYXJzX19hdXRvX3VwZGF0ZV9tb250aHNfbnVtYmVyKCk7XHJcblx0fSwgMTAwICk7XHJcbn0pOyIsIi8qKlxyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKlx0aW5jbHVkZXMvX19qcy9jYWwvZGF5c19zZWxlY3RfY3VzdG9tLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqL1xyXG5cclxuLy9GaXhJbjogOS44LjkuMlxyXG5cclxuLyoqXHJcbiAqIFJlLUluaXQgQ2FsZW5kYXIgYW5kIFJlLVJlbmRlciBpdC5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0Ly8gUmVtb3ZlIENMQVNTICBmb3IgYWJpbGl0eSB0byByZS1yZW5kZXIgYW5kIHJlaW5pdCBjYWxlbmRhci5cclxuXHRqUXVlcnkoICcjY2FsZW5kYXJfYm9va2luZycgKyByZXNvdXJjZV9pZCApLnJlbW92ZUNsYXNzKCAnaGFzRGF0ZXBpY2snICk7XHJcblx0d3BiY19jYWxlbmRhcl9zaG93KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG5cclxuLyoqXHJcbiAqIFJlLUluaXQgcHJldmlvdXNseSAgc2F2ZWQgZGF5cyBzZWxlY3Rpb24gIHZhcmlhYmxlcy5cclxuICpcclxuICogQHBhcmFtIHJlc291cmNlX2lkXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdzYXZlZF92YXJpYWJsZV9fX2RheXNfc2VsZWN0X2luaXRpYWwnXHJcblx0XHQsIHtcclxuXHRcdFx0J2R5bmFtaWNfX2RheXNfbWluJyAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJyApLFxyXG5cdFx0XHQnZHluYW1pY19fZGF5c19tYXgnICAgICAgICA6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnICksXHJcblx0XHRcdCdkeW5hbWljX19kYXlzX3NwZWNpZmljJyAgIDogX3dwYmMuY2FsZW5kYXJfX2dldF9wYXJhbV92YWx1ZSggcmVzb3VyY2VfaWQsICdkeW5hbWljX19kYXlzX3NwZWNpZmljJyApLFxyXG5cdFx0XHQnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCc6IF93cGJjLmNhbGVuZGFyX19nZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcgKSxcclxuXHRcdFx0J2ZpeGVkX19kYXlzX251bScgICAgICAgICAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2ZpeGVkX19kYXlzX251bScgKSxcclxuXHRcdFx0J2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JyAgOiBfd3BiYy5jYWxlbmRhcl9fZ2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2ZpeGVkX193ZWVrX2RheXNfX3N0YXJ0JyApXHJcblx0XHR9XHJcblx0KTtcclxufVxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IFNpbmdsZSBEYXkgc2VsZWN0aW9uIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fc2luZ2xlKCByZXNvdXJjZV9pZCApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFNldCBTaW5nbGUgRGF5IHNlbGVjdGlvblxyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAcGFyYW0gcmVzb3VyY2VfaWRcdFx0SUQgb2YgYm9va2luZyByZXNvdXJjZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19jYWxfZGF5c19zZWxlY3RfX3NpbmdsZSggcmVzb3VyY2VfaWQgKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ3NpbmdsZSd9ICk7XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgTXVsdGlwbGUgRGF5cyBzZWxlY3Rpb24gIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdC8vIFJlLWRlZmluZSBzZWxlY3Rpb24sIG9ubHkgYWZ0ZXIgcGFnZSBsb2FkZWQgd2l0aCBhbGwgaW5pdCB2YXJzXHJcblx0alF1ZXJ5KGRvY3VtZW50KS5yZWFkeShmdW5jdGlvbigpe1xyXG5cclxuXHRcdC8vIFdhaXQgMSBzZWNvbmQsIGp1c3QgdG8gIGJlIHN1cmUsIHRoYXQgYWxsIGluaXQgdmFycyBkZWZpbmVkXHJcblx0XHRzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0XHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICk7XHJcblxyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcblxyXG4vKipcclxuICogU2V0IE11bHRpcGxlIERheXMgc2VsZWN0aW9uXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBwYXJhbSByZXNvdXJjZV9pZFx0XHRJRCBvZiBib29raW5nIHJlc291cmNlXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fbXVsdGlwbGUoIHJlc291cmNlX2lkICl7XHJcblxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1ldGVycyggcmVzb3VyY2VfaWQsIHsnZGF5c19zZWxlY3RfbW9kZSc6ICdtdWx0aXBsZSd9ICk7XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG5cclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4vKipcclxuICogU2V0IEZpeGVkIERheXMgc2VsZWN0aW9uIHdpdGggIDEgbW91c2UgY2xpY2sgIC0gYWZ0ZXIgcGFnZSBsb2FkXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICAtLSBJRCBvZiBib29raW5nIHJlc291cmNlIChjYWxlbmRhcikgLVxyXG4gKiBAaW50ZWdlciBkYXlzX251bWJlclx0XHRcdC0gM1x0XHRcdFx0ICAgLS0gbnVtYmVyIG9mIGRheXMgdG8gIHNlbGVjdFx0LVxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0LSBbLTFdIHwgWyAxLCA1XSAgIC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX3JlYWR5X2RheXNfc2VsZWN0X19maXhlZCggcmVzb3VyY2VfaWQsIGRheXNfbnVtYmVyLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHQvLyBSZS1kZWZpbmUgc2VsZWN0aW9uLCBvbmx5IGFmdGVyIHBhZ2UgbG9hZGVkIHdpdGggYWxsIGluaXQgdmFyc1xyXG5cdGpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0XHQvLyBXYWl0IDEgc2Vjb25kLCBqdXN0IHRvICBiZSBzdXJlLCB0aGF0IGFsbCBpbml0IHZhcnMgZGVmaW5lZFxyXG5cdFx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cclxuXHRcdFx0d3BiY19jYWxfZGF5c19zZWxlY3RfX2ZpeGVkKCByZXNvdXJjZV9pZCwgZGF5c19udW1iZXIsIHdlZWtfZGF5c19fc3RhcnQgKTtcclxuXHJcblx0XHR9LCAxMDAwKTtcclxuXHR9KTtcclxufVxyXG5cclxuXHJcbi8qKlxyXG4gKiBTZXQgRml4ZWQgRGF5cyBzZWxlY3Rpb24gd2l0aCAgMSBtb3VzZSBjbGlja1xyXG4gKiBDYW4gYmUgcnVuIGF0IGFueSAgdGltZSwgIHdoZW4gIGNhbGVuZGFyIGRlZmluZWQgLSB1c2VmdWwgZm9yIGNvbnNvbGUgcnVuLlxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgLS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpIC1cclxuICogQGludGVnZXIgZGF5c19udW1iZXJcdFx0XHQtIDNcdFx0XHRcdCAgIC0tIG51bWJlciBvZiBkYXlzIHRvICBzZWxlY3RcdC1cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdC0gWy0xXSB8IFsgMSwgNV0gICAtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9kYXlzX3NlbGVjdF9fZml4ZWQoIHJlc291cmNlX2lkLCBkYXlzX251bWJlciwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ2ZpeGVkJ30gKTtcclxuXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydmaXhlZF9fZGF5c19udW0nOiBwYXJzZUludCggZGF5c19udW1iZXIgKX0gKTtcdFx0XHQvLyBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAxIG1vdXNlIGNsaWNrXHJcblx0X3dwYmMuY2FsZW5kYXJfX3NldF9wYXJhbWV0ZXJzKCByZXNvdXJjZV9pZCwgeydmaXhlZF9fd2Vla19kYXlzX19zdGFydCc6IHdlZWtfZGF5c19fc3RhcnR9ICk7IFx0Ly8geyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcblxyXG5cdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG5cdHdwYmNfY2FsX19yZV9pbml0KCByZXNvdXJjZV9pZCApO1xyXG59XHJcblxyXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHJcbi8qKlxyXG4gKiBTZXQgUmFuZ2UgRGF5cyBzZWxlY3Rpb24gIHdpdGggIDIgbW91c2UgY2xpY2tzICAtIGFmdGVyIHBhZ2UgbG9hZFxyXG4gKlxyXG4gKiBAaW50ZWdlciByZXNvdXJjZV9pZFx0XHRcdC0gMVx0XHRcdFx0ICAgXHRcdC0tIElEIG9mIGJvb2tpbmcgcmVzb3VyY2UgKGNhbGVuZGFyKVxyXG4gKiBAaW50ZWdlciBkYXlzX21pblx0XHRcdC0gN1x0XHRcdFx0ICAgXHRcdC0tIE1pbiBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGludGVnZXIgZGF5c19tYXhcdFx0XHQtIDMwXHRcdFx0ICAgXHRcdC0tIE1heCBudW1iZXIgb2YgZGF5cyB0byBzZWxlY3RcclxuICogQGFycmF5IGRheXNfc3BlY2lmaWNcdFx0XHQtIFtdIHwgWzcsMTQsMjEsMjhdXHRcdC0tIFJlc3RyaWN0aW9uIGZvciBTcGVjaWZpYyBudW1iZXIgb2YgZGF5cyBzZWxlY3Rpb25cclxuICogQGFycmF5IHdlZWtfZGF5c19fc3RhcnRcdFx0LSBbLTFdIHwgWyAxLCA1XSAgIFx0XHQtLSAgeyAtMSAtIEFueSB8IDAgLSBTdSwgIDEgLSBNbywgIDIgLSBUdSwgMyAtIFdlLCA0IC0gVGgsIDUgLSBGciwgNiAtIFNhdCB9XHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2NhbF9yZWFkeV9kYXlzX3NlbGVjdF9fcmFuZ2UoIHJlc291cmNlX2lkLCBkYXlzX21pbiwgZGF5c19tYXgsIGRheXNfc3BlY2lmaWMgPSBbXSwgd2Vla19kYXlzX19zdGFydCA9IFstMV0gKXtcclxuXHJcblx0Ly8gUmUtZGVmaW5lIHNlbGVjdGlvbiwgb25seSBhZnRlciBwYWdlIGxvYWRlZCB3aXRoIGFsbCBpbml0IHZhcnNcclxuXHRqUXVlcnkoZG9jdW1lbnQpLnJlYWR5KGZ1bmN0aW9uKCl7XHJcblxyXG5cdFx0Ly8gV2FpdCAxIHNlY29uZCwganVzdCB0byAgYmUgc3VyZSwgdGhhdCBhbGwgaW5pdCB2YXJzIGRlZmluZWRcclxuXHRcdHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcclxuXHJcblx0XHRcdHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYywgd2Vla19kYXlzX19zdGFydCApO1xyXG5cdFx0fSwgMTAwMCk7XHJcblx0fSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZXQgUmFuZ2UgRGF5cyBzZWxlY3Rpb24gIHdpdGggIDIgbW91c2UgY2xpY2tzXHJcbiAqIENhbiBiZSBydW4gYXQgYW55ICB0aW1lLCAgd2hlbiAgY2FsZW5kYXIgZGVmaW5lZCAtIHVzZWZ1bCBmb3IgY29uc29sZSBydW4uXHJcbiAqXHJcbiAqIEBpbnRlZ2VyIHJlc291cmNlX2lkXHRcdFx0LSAxXHRcdFx0XHQgICBcdFx0LS0gSUQgb2YgYm9va2luZyByZXNvdXJjZSAoY2FsZW5kYXIpXHJcbiAqIEBpbnRlZ2VyIGRheXNfbWluXHRcdFx0LSA3XHRcdFx0XHQgICBcdFx0LS0gTWluIG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAaW50ZWdlciBkYXlzX21heFx0XHRcdC0gMzBcdFx0XHQgICBcdFx0LS0gTWF4IG51bWJlciBvZiBkYXlzIHRvIHNlbGVjdFxyXG4gKiBAYXJyYXkgZGF5c19zcGVjaWZpY1x0XHRcdC0gW10gfCBbNywxNCwyMSwyOF1cdFx0LS0gUmVzdHJpY3Rpb24gZm9yIFNwZWNpZmljIG51bWJlciBvZiBkYXlzIHNlbGVjdGlvblxyXG4gKiBAYXJyYXkgd2Vla19kYXlzX19zdGFydFx0XHQtIFstMV0gfCBbIDEsIDVdICAgXHRcdC0tICB7IC0xIC0gQW55IHwgMCAtIFN1LCAgMSAtIE1vLCAgMiAtIFR1LCAzIC0gV2UsIDQgLSBUaCwgNSAtIEZyLCA2IC0gU2F0IH1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfY2FsX2RheXNfc2VsZWN0X19yYW5nZSggcmVzb3VyY2VfaWQsIGRheXNfbWluLCBkYXlzX21heCwgZGF5c19zcGVjaWZpYyA9IFtdLCB3ZWVrX2RheXNfX3N0YXJ0ID0gWy0xXSApe1xyXG5cclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtZXRlcnMoICByZXNvdXJjZV9pZCwgeydkYXlzX3NlbGVjdF9tb2RlJzogJ2R5bmFtaWMnfSAgKTtcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfbWluJyAgICAgICAgICwgcGFyc2VJbnQoIGRheXNfbWluICkgICk7ICAgICAgICAgICBcdFx0Ly8gTWluLiBOdW1iZXIgb2YgZGF5cyBzZWxlY3Rpb24gd2l0aCAyIG1vdXNlIGNsaWNrc1xyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fZGF5c19tYXgnICAgICAgICAgLCBwYXJzZUludCggZGF5c19tYXggKSAgKTsgICAgICAgICAgXHRcdC8vIE1heC4gTnVtYmVyIG9mIGRheXMgc2VsZWN0aW9uIHdpdGggMiBtb3VzZSBjbGlja3NcclxuXHRfd3BiYy5jYWxlbmRhcl9fc2V0X3BhcmFtX3ZhbHVlKCByZXNvdXJjZV9pZCwgJ2R5bmFtaWNfX2RheXNfc3BlY2lmaWMnICAgICwgZGF5c19zcGVjaWZpYyAgKTtcdCAgICAgIFx0XHRcdFx0Ly8gRXhhbXBsZSBbNSw3XVxyXG5cdF93cGJjLmNhbGVuZGFyX19zZXRfcGFyYW1fdmFsdWUoIHJlc291cmNlX2lkLCAnZHluYW1pY19fd2Vla19kYXlzX19zdGFydCcgLCB3ZWVrX2RheXNfX3N0YXJ0ICApOyAgXHRcdFx0XHRcdC8vIHsgLTEgLSBBbnkgfCAwIC0gU3UsICAxIC0gTW8sICAyIC0gVHUsIDMgLSBXZSwgNCAtIFRoLCA1IC0gRnIsIDYgLSBTYXQgfVxyXG5cclxuXHR3cGJjX2NhbF9kYXlzX3NlbGVjdF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxuXHR3cGJjX2NhbF9fcmVfaW5pdCggcmVzb3VyY2VfaWQgKTtcclxufVxyXG4iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICpcdGluY2x1ZGVzL19fanMvY2FsX2FqeF9sb2FkL3dwYmNfY2FsX2FqeC5qc1xyXG4gKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyAgQSBqIGEgeCAgICBMIG8gYSBkICAgIEMgYSBsIGUgbiBkIGEgciAgICBEIGEgdCBhXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuZnVuY3Rpb24gd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangoIHBhcmFtcyApe1xyXG5cclxuXHQvL0ZpeEluOiA5LjguNi4yXHJcblx0d3BiY19jYWxlbmRhcl9fbG9hZGluZ19fc3RhcnQoIHBhcmFtc1sncmVzb3VyY2VfaWQnXSApO1xyXG5cdGlmICggd3BiY19iYWxhbmNlcl9faXNfd2FpdCggcGFyYW1zICwgJ3dwYmNfY2FsZW5kYXJfX2xvYWRfZGF0YV9fYWp4JyApICl7XHJcblx0XHRyZXR1cm4gZmFsc2U7XHJcblx0fVxyXG5cclxuXHQvL0ZpeEluOiA5LjguNi4yXHJcblx0d3BiY19jYWxlbmRhcl9fYmx1cl9fc3RvcCggcGFyYW1zWydyZXNvdXJjZV9pZCddICk7XHJcblxyXG5cclxuLy8gY29uc29sZS5ncm91cEVuZCgpOyBjb25zb2xlLnRpbWUoJ3Jlc291cmNlX2lkXycgKyBwYXJhbXNbJ3Jlc291cmNlX2lkJ10pO1xyXG5jb25zb2xlLmdyb3VwQ29sbGFwc2VkKCAnV1BCQ19BSlhfQ0FMRU5EQVJfTE9BRCcgKTsgY29uc29sZS5sb2coICcgPT0gQmVmb3JlIEFqYXggU2VuZCAtIGNhbGVuZGFyc19hbGxfX2dldCgpID09ICcgLCBfd3BiYy5jYWxlbmRhcnNfYWxsX19nZXQoKSApO1xyXG5cclxuXHQvLyBTdGFydCBBamF4XHJcblx0alF1ZXJ5LnBvc3QoIHdwYmNfdXJsX2FqYXgsXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0YWN0aW9uICAgICAgICAgIDogJ1dQQkNfQUpYX0NBTEVOREFSX0xPQUQnLFxyXG5cdFx0XHRcdFx0d3BiY19hanhfdXNlcl9pZDogX3dwYmMuZ2V0X3NlY3VyZV9wYXJhbSggJ3VzZXJfaWQnICksXHJcblx0XHRcdFx0XHRub25jZSAgICAgICAgICAgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbm9uY2UnICksXHJcblx0XHRcdFx0XHR3cGJjX2FqeF9sb2NhbGUgOiBfd3BiYy5nZXRfc2VjdXJlX3BhcmFtKCAnbG9jYWxlJyApLFxyXG5cclxuXHRcdFx0XHRcdGNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zIDogcGFyYW1zIFx0XHRcdFx0XHRcdC8vIFVzdWFsbHkgbGlrZTogeyAncmVzb3VyY2VfaWQnOiAxLCAnbWF4X2RheXNfY291bnQnOiAzNjUgfVxyXG5cdFx0XHRcdH0sXHJcblxyXG5cdFx0XHRcdC8qKlxyXG5cdFx0XHRcdCAqIFMgdSBjIGMgZSBzIHNcclxuXHRcdFx0XHQgKlxyXG5cdFx0XHRcdCAqIEBwYXJhbSByZXNwb25zZV9kYXRhXHRcdC1cdGl0cyBvYmplY3QgcmV0dXJuZWQgZnJvbSAgQWpheCAtIGNsYXNzLWxpdmUtc2VhcmNoLnBocFxyXG5cdFx0XHRcdCAqIEBwYXJhbSB0ZXh0U3RhdHVzXHRcdC1cdCdzdWNjZXNzJ1xyXG5cdFx0XHRcdCAqIEBwYXJhbSBqcVhIUlx0XHRcdFx0LVx0T2JqZWN0XHJcblx0XHRcdFx0ICovXHJcblx0XHRcdFx0ZnVuY3Rpb24gKCByZXNwb25zZV9kYXRhLCB0ZXh0U3RhdHVzLCBqcVhIUiApIHtcclxuLy8gY29uc29sZS50aW1lRW5kKCdyZXNvdXJjZV9pZF8nICsgcmVzcG9uc2VfZGF0YVsncmVzb3VyY2VfaWQnXSk7XHJcbmNvbnNvbGUubG9nKCAnID09IFJlc3BvbnNlIFdQQkNfQUpYX0NBTEVOREFSX0xPQUQgPT0gJywgcmVzcG9uc2VfZGF0YSApOyBjb25zb2xlLmdyb3VwRW5kKCk7XHJcblxyXG5cdFx0XHRcdFx0Ly9GaXhJbjogOS44LjYuMlxyXG5cdFx0XHRcdFx0dmFyIGFqeF9wb3N0X2RhdGFfX3Jlc291cmNlX2lkID0gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0d3BiY19iYWxhbmNlcl9fY29tcGxldGVkKCBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCAsICd3cGJjX2NhbGVuZGFyX19sb2FkX2RhdGFfX2FqeCcgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBQcm9iYWJseSBFcnJvclxyXG5cdFx0XHRcdFx0aWYgKCAodHlwZW9mIHJlc3BvbnNlX2RhdGEgIT09ICdvYmplY3QnKSB8fCAocmVzcG9uc2VfZGF0YSA9PT0gbnVsbCkgKXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cdFx0XHRcdFx0XHR2YXIgbWVzc2FnZV90eXBlID0gJ2luZm8nO1xyXG5cclxuXHRcdFx0XHRcdFx0aWYgKCAnJyA9PT0gcmVzcG9uc2VfZGF0YSApe1xyXG5cdFx0XHRcdFx0XHRcdHJlc3BvbnNlX2RhdGEgPSAnVGhlIHNlcnZlciByZXNwb25kcyB3aXRoIGFuIGVtcHR5IHN0cmluZy4gVGhlIHNlcnZlciBwcm9iYWJseSBzdG9wcGVkIHdvcmtpbmcgdW5leHBlY3RlZGx5LiA8YnI+UGxlYXNlIGNoZWNrIHlvdXIgPHN0cm9uZz5lcnJvci5sb2c8L3N0cm9uZz4gaW4geW91ciBzZXJ2ZXIgY29uZmlndXJhdGlvbiBmb3IgcmVsYXRpdmUgZXJyb3JzLic7XHJcblx0XHRcdFx0XHRcdFx0bWVzc2FnZV90eXBlID0gJ3dhcm5pbmcnO1xyXG5cdFx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0XHQvLyBTaG93IE1lc3NhZ2VcclxuXHRcdFx0XHRcdFx0d3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZSggcmVzcG9uc2VfZGF0YSAsIHsgJ3R5cGUnICAgICA6IG1lc3NhZ2VfdHlwZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDBcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0gKTtcclxuXHRcdFx0XHRcdFx0cmV0dXJuO1xyXG5cdFx0XHRcdFx0fVxyXG5cclxuXHRcdFx0XHRcdC8vIFNob3cgQ2FsZW5kYXJcclxuXHRcdFx0XHRcdHdwYmNfY2FsZW5kYXJfX2xvYWRpbmdfX3N0b3AoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRcdFx0XHRcdC8vIEJvb2tpbmdzIC0gRGF0ZXNcclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdzX2luX2NhbGVuZGFyX19zZXRfZGF0ZXMoICByZXNwb25zZV9kYXRhWyAncmVzb3VyY2VfaWQnIF0sIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsnZGF0ZXMnXSAgKTtcclxuXHJcblx0XHRcdFx0XHQvLyBCb29raW5ncyAtIENoaWxkIG9yIG9ubHkgc2luZ2xlIGJvb2tpbmcgcmVzb3VyY2UgaW4gZGF0ZXNcclxuXHRcdFx0XHRcdF93cGJjLmJvb2tpbmdfX3NldF9wYXJhbV92YWx1ZSggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdLCAncmVzb3VyY2VzX2lkX2Fycl9faW5fZGF0ZXMnLCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdyZXNvdXJjZXNfaWRfYXJyX19pbl9kYXRlcycgXSApO1xyXG5cclxuXHRcdFx0XHRcdC8vIEFnZ3JlZ2F0ZSBib29raW5nIHJlc291cmNlcywgIGlmIGFueSA/XHJcblx0XHRcdFx0XHRfd3BiYy5ib29raW5nX19zZXRfcGFyYW1fdmFsdWUoIHJlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXSwgJ2FnZ3JlZ2F0ZV9yZXNvdXJjZV9pZF9hcnInLCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhZ2dyZWdhdGVfcmVzb3VyY2VfaWRfYXJyJyBdICk7XHJcblx0XHRcdFx0XHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG5cdFx0XHRcdFx0Ly8gVXBkYXRlIGNhbGVuZGFyXHJcblx0XHRcdFx0XHR3cGJjX2NhbGVuZGFyX191cGRhdGVfbG9vayggcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICk7XHJcblxyXG5cclxuXHRcdFx0XHRcdGlmIChcclxuXHRcdFx0XHRcdFx0XHQoICd1bmRlZmluZWQnICE9PSB0eXBlb2YgKHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXSkgKVxyXG5cdFx0XHRcdFx0XHQgJiYgKCAnJyAhPSByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2UnIF0ucmVwbGFjZSggL1xcbi9nLCBcIjxiciAvPlwiICkgKVxyXG5cdFx0XHRcdFx0KXtcclxuXHJcblx0XHRcdFx0XHRcdHZhciBqcV9ub2RlICA9IHdwYmNfZ2V0X2NhbGVuZGFyX19qcV9ub2RlX19mb3JfbWVzc2FnZXMoIHRoaXMuZGF0YSApO1xyXG5cclxuXHRcdFx0XHRcdFx0Ly8gU2hvdyBNZXNzYWdlXHJcblx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHsgICAndHlwZScgICAgIDogKCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mKCByZXNwb25zZV9kYXRhWyAnYWp4X2RhdGEnIF1bICdhanhfYWZ0ZXJfYWN0aW9uX21lc3NhZ2Vfc3RhdHVzJyBdICkgKVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgID8gcmVzcG9uc2VfZGF0YVsgJ2FqeF9kYXRhJyBdWyAnYWp4X2FmdGVyX2FjdGlvbl9tZXNzYWdlX3N0YXR1cycgXSA6ICdpbmZvJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3N0eWxlJyAgICA6ICd0ZXh0LWFsaWduOmxlZnQ7JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDEwMDAwXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly8gVHJpZ2dlciBldmVudCB0aGF0IGNhbGVuZGFyIGhhcyBiZWVuXHRcdCAvL0ZpeEluOiAxMC4wLjAuNDRcclxuXHRcdFx0XHRcdGlmICggalF1ZXJ5KCAnI2NhbGVuZGFyX2Jvb2tpbmcnICsgcmVzcG9uc2VfZGF0YVsgJ3Jlc291cmNlX2lkJyBdICkubGVuZ3RoID4gMCApe1xyXG5cdFx0XHRcdFx0XHR2YXIgdGFyZ2V0X2VsbSA9IGpRdWVyeSggJ2JvZHknICkudHJpZ2dlciggXCJ3cGJjX2NhbGVuZGFyX2FqeF9fbG9hZGVkX2RhdGFcIiwgW3Jlc3BvbnNlX2RhdGFbICdyZXNvdXJjZV9pZCcgXV0gKTtcclxuXHRcdFx0XHRcdFx0IC8valF1ZXJ5KCAnYm9keScgKS5vbiggJ3dwYmNfY2FsZW5kYXJfYWp4X19sb2FkZWRfZGF0YScsIGZ1bmN0aW9uKCBldmVudCwgcmVzb3VyY2VfaWQgKSB7IC4uLiB9ICk7XHJcblx0XHRcdFx0XHR9XHJcblxyXG5cdFx0XHRcdFx0Ly9qUXVlcnkoICcjYWpheF9yZXNwb25kJyApLmh0bWwoIHJlc3BvbnNlX2RhdGEgKTtcdFx0Ly8gRm9yIGFiaWxpdHkgdG8gc2hvdyByZXNwb25zZSwgYWRkIHN1Y2ggRElWIGVsZW1lbnQgdG8gcGFnZVxyXG5cdFx0XHRcdH1cclxuXHRcdFx0ICApLmZhaWwoIGZ1bmN0aW9uICgganFYSFIsIHRleHRTdGF0dXMsIGVycm9yVGhyb3duICkgeyAgICBpZiAoIHdpbmRvdy5jb25zb2xlICYmIHdpbmRvdy5jb25zb2xlLmxvZyApeyBjb25zb2xlLmxvZyggJ0FqYXhfRXJyb3InLCBqcVhIUiwgdGV4dFN0YXR1cywgZXJyb3JUaHJvd24gKTsgfVxyXG5cclxuXHRcdFx0XHRcdHZhciBhanhfcG9zdF9kYXRhX19yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCB0aGlzLmRhdGEgKTtcclxuXHRcdFx0XHRcdHdwYmNfYmFsYW5jZXJfX2NvbXBsZXRlZCggYWp4X3Bvc3RfZGF0YV9fcmVzb3VyY2VfaWQgLCAnd3BiY19jYWxlbmRhcl9fbG9hZF9kYXRhX19hangnICk7XHJcblxyXG5cdFx0XHRcdFx0Ly8gR2V0IENvbnRlbnQgb2YgRXJyb3IgTWVzc2FnZVxyXG5cdFx0XHRcdFx0dmFyIGVycm9yX21lc3NhZ2UgPSAnPHN0cm9uZz4nICsgJ0Vycm9yIScgKyAnPC9zdHJvbmc+ICcgKyBlcnJvclRocm93biA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgKDxiPicgKyBqcVhIUi5zdGF0dXMgKyAnPC9iPiknO1xyXG5cdFx0XHRcdFx0XHRpZiAoNDAzID09IGpxWEhSLnN0YXR1cyApe1xyXG5cdFx0XHRcdFx0XHRcdGVycm9yX21lc3NhZ2UgKz0gJzxicj4gUHJvYmFibHkgbm9uY2UgZm9yIHRoaXMgcGFnZSBoYXMgYmVlbiBleHBpcmVkLiBQbGVhc2UgPGEgaHJlZj1cImphdmFzY3JpcHQ6dm9pZCgwKVwiIG9uY2xpY2s9XCJqYXZhc2NyaXB0OmxvY2F0aW9uLnJlbG9hZCgpO1wiPnJlbG9hZCB0aGUgcGFnZTwvYT4uJztcclxuXHRcdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICc8YnI+IE90aGVyd2lzZSwgcGxlYXNlIGNoZWNrIHRoaXMgPGEgc3R5bGU9XCJmb250LXdlaWdodDogNjAwO1wiIGhyZWY9XCJodHRwczovL3dwYm9va2luZ2NhbGVuZGFyLmNvbS9mYXEvcmVxdWVzdC1kby1ub3QtcGFzcy1zZWN1cml0eS1jaGVjay8/YWZ0ZXJfdXBkYXRlPTEwLjEuMVwiPnRyb3VibGVzaG9vdGluZyBpbnN0cnVjdGlvbjwvYT4uPGJyPidcclxuXHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0dmFyIG1lc3NhZ2Vfc2hvd19kZWxheSA9IDMwMDA7XHJcblx0XHRcdFx0XHRpZiAoIGpxWEhSLnJlc3BvbnNlVGV4dCApe1xyXG5cdFx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlICs9ICcgJyArIGpxWEhSLnJlc3BvbnNlVGV4dDtcclxuXHRcdFx0XHRcdFx0bWVzc2FnZV9zaG93X2RlbGF5ID0gMTA7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRlcnJvcl9tZXNzYWdlID0gZXJyb3JfbWVzc2FnZS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKTtcclxuXHJcblx0XHRcdFx0XHR2YXIganFfbm9kZSAgPSB3cGJjX2dldF9jYWxlbmRhcl9fanFfbm9kZV9fZm9yX21lc3NhZ2VzKCB0aGlzLmRhdGEgKTtcclxuXHJcblx0XHRcdFx0XHQvKipcclxuXHRcdFx0XHRcdCAqIElmIHdlIG1ha2UgZmFzdCBjbGlja2luZyBvbiBkaWZmZXJlbnQgcGFnZXMsXHJcblx0XHRcdFx0XHQgKiB0aGVuIHVuZGVyIGNhbGVuZGFyIHdpbGwgc2hvdyBlcnJvciBtZXNzYWdlIHdpdGggIGVtcHR5ICB0ZXh0LCBiZWNhdXNlIGFqYXggd2FzIG5vdCByZWNlaXZlZC5cclxuXHRcdFx0XHRcdCAqIFRvICBub3Qgc2hvdyBzdWNoIHdhcm5pbmdzIHdlIGFyZSBzZXQgZGVsYXkgIGluIDMgc2Vjb25kcy4gIHZhciBtZXNzYWdlX3Nob3dfZGVsYXkgPSAzMDAwO1xyXG5cdFx0XHRcdFx0ICovXHJcblx0XHRcdFx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIFNob3cgTWVzc2FnZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIGVycm9yX21lc3NhZ2UgLCB7ICd0eXBlJyAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnOiB7J2pxX25vZGUnOiBqcV9ub2RlLCAnd2hlcmUnOiAnYWZ0ZXInfSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9ICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9ICxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIHBhcnNlSW50KCBtZXNzYWdlX3Nob3dfZGVsYXkgKSAgICk7XHJcblxyXG5cdFx0XHQgIH0pXHJcblx0ICAgICAgICAgIC8vIC5kb25lKCAgIGZ1bmN0aW9uICggZGF0YSwgdGV4dFN0YXR1cywganFYSFIgKSB7ICAgaWYgKCB3aW5kb3cuY29uc29sZSAmJiB3aW5kb3cuY29uc29sZS5sb2cgKXsgY29uc29sZS5sb2coICdzZWNvbmQgc3VjY2VzcycsIGRhdGEsIHRleHRTdGF0dXMsIGpxWEhSICk7IH0gICAgfSlcclxuXHRcdFx0ICAvLyAuYWx3YXlzKCBmdW5jdGlvbiAoIGRhdGFfanFYSFIsIHRleHRTdGF0dXMsIGpxWEhSX2Vycm9yVGhyb3duICkgeyAgIGlmICggd2luZG93LmNvbnNvbGUgJiYgd2luZG93LmNvbnNvbGUubG9nICl7IGNvbnNvbGUubG9nKCAnYWx3YXlzIGZpbmlzaGVkJywgZGF0YV9qcVhIUiwgdGV4dFN0YXR1cywganFYSFJfZXJyb3JUaHJvd24gKTsgfSAgICAgfSlcclxuXHRcdFx0ICA7ICAvLyBFbmQgQWpheFxyXG59XHJcblxyXG5cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBTdXBwb3J0XHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgQ2FsZW5kYXIgalF1ZXJ5IG5vZGUgZm9yIHNob3dpbmcgbWVzc2FnZXMgZHVyaW5nIEFqYXhcclxuXHQgKiBUaGlzIHBhcmFtZXRlcjogICBjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0gICBwYXJzZWQgZnJvbSB0aGlzLmRhdGEgQWpheCBwb3N0ICBkYXRhXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zXHRcdCAnYWN0aW9uPVdQQkNfQUpYX0NBTEVOREFSX0xPQUQuLi4mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJyZXNvdXJjZV9pZCU1RD0yJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCYm9va2luZ19oYXNoJTVEPSZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcydcclxuXHQgKiBAcmV0dXJucyB7c3RyaW5nfVx0JycjY2FsZW5kYXJfYm9va2luZzEnICB8ICAgJy5ib29raW5nX2Zvcm1fZGl2JyAuLi5cclxuXHQgKlxyXG5cdCAqIEV4YW1wbGUgICAgdmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggYWp4X3Bvc3RfZGF0YV91cmxfcGFyYW1zICl7XHJcblxyXG5cdFx0dmFyIGpxX25vZGUgPSAnLmJvb2tpbmdfZm9ybV9kaXYnO1xyXG5cclxuXHRcdHZhciBjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHdwYmNfZ2V0X3Jlc291cmNlX2lkX19mcm9tX2FqeF9wb3N0X2RhdGFfdXJsKCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKTtcclxuXHJcblx0XHRpZiAoIGNhbGVuZGFyX3Jlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRqcV9ub2RlID0gJyNjYWxlbmRhcl9ib29raW5nJyArIGNhbGVuZGFyX3Jlc291cmNlX2lkO1xyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBqcV9ub2RlO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEdldCByZXNvdXJjZSBJRCBmcm9tIGFqeCBwb3N0IGRhdGEgdXJsICAgdXN1YWxseSAgZnJvbSAgdGhpcy5kYXRhICA9ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdCAqXHJcblx0ICogQHBhcmFtIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtc1x0XHQgJ2FjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMnXHJcblx0ICogQHJldHVybnMge2ludH1cdFx0XHRcdFx0XHQgMSB8IDAgIChpZiBlcnJyb3IgdGhlbiAgMClcclxuXHQgKlxyXG5cdCAqIEV4YW1wbGUgICAgdmFyIGpxX25vZGUgID0gd3BiY19nZXRfY2FsZW5kYXJfX2pxX25vZGVfX2Zvcl9tZXNzYWdlcyggdGhpcy5kYXRhICk7XHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19nZXRfcmVzb3VyY2VfaWRfX2Zyb21fYWp4X3Bvc3RfZGF0YV91cmwoIGFqeF9wb3N0X2RhdGFfdXJsX3BhcmFtcyApe1xyXG5cclxuXHRcdC8vIEdldCBib29raW5nIHJlc291cmNlIElEIGZyb20gQWpheCBQb3N0IFJlcXVlc3QgIC0+IHRoaXMuZGF0YSA9ICdhY3Rpb249V1BCQ19BSlhfQ0FMRU5EQVJfTE9BRC4uLiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QnJlc291cmNlX2lkJTVEPTImY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXMlNUJib29raW5nX2hhc2glNUQ9JmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJ1xyXG5cdFx0dmFyIGNhbGVuZGFyX3Jlc291cmNlX2lkID0gd3BiY19nZXRfdXJpX3BhcmFtX2J5X25hbWUoICdjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtc1tyZXNvdXJjZV9pZF0nLCBhanhfcG9zdF9kYXRhX3VybF9wYXJhbXMgKTtcclxuXHRcdGlmICggKG51bGwgIT09IGNhbGVuZGFyX3Jlc291cmNlX2lkKSAmJiAoJycgIT09IGNhbGVuZGFyX3Jlc291cmNlX2lkKSApe1xyXG5cdFx0XHRjYWxlbmRhcl9yZXNvdXJjZV9pZCA9IHBhcnNlSW50KCBjYWxlbmRhcl9yZXNvdXJjZV9pZCApO1xyXG5cdFx0XHRpZiAoIGNhbGVuZGFyX3Jlc291cmNlX2lkID4gMCApe1xyXG5cdFx0XHRcdHJldHVybiBjYWxlbmRhcl9yZXNvdXJjZV9pZDtcclxuXHRcdFx0fVxyXG5cdFx0fVxyXG5cdFx0cmV0dXJuIDA7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogR2V0IHBhcmFtZXRlciBmcm9tIFVSTCAgLSAgcGFyc2UgVVJMIHBhcmFtZXRlcnMsICBsaWtlIHRoaXM6IGFjdGlvbj1XUEJDX0FKWF9DQUxFTkRBUl9MT0FELi4uJmNhbGVuZGFyX3JlcXVlc3RfcGFyYW1zJTVCcmVzb3VyY2VfaWQlNUQ9MiZjYWxlbmRhcl9yZXF1ZXN0X3BhcmFtcyU1QmJvb2tpbmdfaGFzaCU1RD0mY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNcclxuXHQgKiBAcGFyYW0gbmFtZSAgcGFyYW1ldGVyICBuYW1lLCAgbGlrZSAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJ1xyXG5cdCAqIEBwYXJhbSB1cmxcdCdwYXJhbWV0ZXIgIHN0cmluZyBVUkwnXHJcblx0ICogQHJldHVybnMge3N0cmluZ3xudWxsfSAgIHBhcmFtZXRlciB2YWx1ZVxyXG5cdCAqXHJcblx0ICogRXhhbXBsZTogXHRcdHdwYmNfZ2V0X3VyaV9wYXJhbV9ieV9uYW1lKCAnY2FsZW5kYXJfcmVxdWVzdF9wYXJhbXNbcmVzb3VyY2VfaWRdJywgdGhpcy5kYXRhICk7ICAtPiAnMidcclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2dldF91cmlfcGFyYW1fYnlfbmFtZSggbmFtZSwgdXJsICl7XHJcblxyXG5cdFx0dXJsID0gZGVjb2RlVVJJQ29tcG9uZW50KCB1cmwgKTtcclxuXHJcblx0XHRuYW1lID0gbmFtZS5yZXBsYWNlKCAvW1xcW1xcXV0vZywgJ1xcXFwkJicgKTtcclxuXHRcdHZhciByZWdleCA9IG5ldyBSZWdFeHAoICdbPyZdJyArIG5hbWUgKyAnKD0oW14mI10qKXwmfCN8JCknICksXHJcblx0XHRcdHJlc3VsdHMgPSByZWdleC5leGVjKCB1cmwgKTtcclxuXHRcdGlmICggIXJlc3VsdHMgKSByZXR1cm4gbnVsbDtcclxuXHRcdGlmICggIXJlc3VsdHNbIDIgXSApIHJldHVybiAnJztcclxuXHRcdHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoIHJlc3VsdHNbIDIgXS5yZXBsYWNlKCAvXFwrL2csICcgJyApICk7XHJcblx0fVxyXG4iLCIvKipcclxuICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAqXHRpbmNsdWRlcy9fX2pzL2Zyb250X2VuZF9tZXNzYWdlcy93cGJjX2ZlX21lc3NhZ2VzLmpzXHJcbiAqID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gKi9cclxuXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4vLyBTaG93IE1lc3NhZ2VzIGF0IEZyb250LUVkbiBzaWRlXHJcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuLyoqXHJcbiAqIFNob3cgbWVzc2FnZSBpbiBjb250ZW50XHJcbiAqXHJcbiAqIEBwYXJhbSBtZXNzYWdlXHRcdFx0XHRNZXNzYWdlIEhUTUxcclxuICogQHBhcmFtIHBhcmFtcyA9IHtcclxuICpcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICA6ICd3YXJuaW5nJyxcdFx0XHRcdFx0XHRcdC8vICdlcnJvcicgfCAnd2FybmluZycgfCAnaW5mbycgfCAnc3VjY2VzcydcclxuICpcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZScgOiAnJyxcdFx0XHRcdC8vIGFueSBqUXVlcnkgbm9kZSBkZWZpbml0aW9uXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICAgOiAnaW5zaWRlJ1x0XHQvLyAnaW5zaWRlJyB8ICdiZWZvcmUnIHwgJ2FmdGVyJyB8ICdyaWdodCcgfCAnbGVmdCdcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaXNfYXBwZW5kJzogdHJ1ZSxcdFx0XHRcdFx0XHRcdFx0Ly8gQXBwbHkgIG9ubHkgaWYgXHQnd2hlcmUnICAgOiAnaW5zaWRlJ1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnc3R5bGUnICAgIDogJ3RleHQtYWxpZ246bGVmdDsnLFx0XHRcdFx0Ly8gc3R5bGVzLCBpZiBuZWVkZWRcclxuICpcdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG4gKlx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMCxcdFx0XHRcdFx0XHRcdFx0XHQvLyBob3cgbWFueSBtaWNyb3NlY29uZCB0byAgc2hvdywgIGlmIDAgIHRoZW4gIHNob3cgZm9yZXZlclxyXG4gKlx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IGZhbHNlXHRcdFx0XHRcdC8vIGlmIHRydWUsICB0aGVuIGRvIG5vdCBzaG93IG1lc3NhZ2UsICBpZiBwcmV2aW9zIG1lc3NhZ2Ugd2FzIG5vdCBoaWRlZCAobm90IGFwcGx5IGlmICd3aGVyZScgICA6ICdpbnNpZGUnIClcclxuICpcdFx0XHRcdH07XHJcbiAqIEV4YW1wbGVzOlxyXG4gKiBcdFx0XHR2YXIgaHRtbF9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoICdZb3UgY2FuIHRlc3QgZGF5cyBzZWxlY3Rpb24gaW4gY2FsZW5kYXInLCB7fSApO1xyXG4gKlxyXG4gKlx0XHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIF93cGJjLmdldF9tZXNzYWdlKCAnbWVzc2FnZV9jaGVja19yZXF1aXJlZCcgKSwgeyAndHlwZSc6ICd3YXJuaW5nJywgJ2RlbGF5JzogMTAwMDAsICdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgJ3Nob3dfaGVyZSc6IHsnd2hlcmUnOiAncmlnaHQnLCAnanFfbm9kZSc6IGVsLH0gfSApO1xyXG4gKlxyXG4gKlx0XHRcdHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZScgXS5yZXBsYWNlKCAvXFxuL2csIFwiPGJyIC8+XCIgKSxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0eyAgICd0eXBlJyAgICAgOiAoICd1bmRlZmluZWQnICE9PSB0eXBlb2YoIHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gKSApXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICA/IHJlc3BvbnNlX2RhdGFbICdhanhfZGF0YScgXVsgJ2FqeF9hZnRlcl9hY3Rpb25fbWVzc2FnZV9zdGF0dXMnIF0gOiAnaW5mbycsXHJcbiAqXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZSc6IHsnanFfbm9kZSc6IGpxX25vZGUsICd3aGVyZSc6ICdhZnRlcid9LFxyXG4gKlx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdjc3NfY2xhc3MnOid3cGJjX2ZlX21lc3NhZ2VfYWx0JyxcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgIDogMTAwMDBcclxuICpcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSApO1xyXG4gKlxyXG4gKlxyXG4gKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcbiAqL1xyXG5mdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKCBtZXNzYWdlLCBwYXJhbXMgPSB7fSApe1xyXG5cclxuXHR2YXIgcGFyYW1zX2RlZmF1bHQgPSB7XHJcblx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgIDogJ3dhcm5pbmcnLFx0XHRcdFx0XHRcdFx0Ly8gJ2Vycm9yJyB8ICd3YXJuaW5nJyB8ICdpbmZvJyB8ICdzdWNjZXNzJ1xyXG5cdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnIDogJycsXHRcdFx0XHQvLyBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgICA6ICdpbnNpZGUnXHRcdC8vICdpbnNpZGUnIHwgJ2JlZm9yZScgfCAnYWZ0ZXInIHwgJ3JpZ2h0JyB8ICdsZWZ0J1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9LFxyXG5cdFx0XHRcdFx0XHRcdFx0J2lzX2FwcGVuZCc6IHRydWUsXHRcdFx0XHRcdFx0XHRcdC8vIEFwcGx5ICBvbmx5IGlmIFx0J3doZXJlJyAgIDogJ2luc2lkZSdcclxuXHRcdFx0XHRcdFx0XHRcdCdzdHlsZScgICAgOiAndGV4dC1hbGlnbjpsZWZ0OycsXHRcdFx0XHQvLyBzdHlsZXMsIGlmIG5lZWRlZFxyXG5cdFx0XHRcdFx0XHRcdCAgICAnY3NzX2NsYXNzJzogJycsXHRcdFx0XHRcdFx0XHRcdC8vIEZvciBleGFtcGxlIGNhbiAgYmU6ICd3cGJjX2ZlX21lc3NhZ2VfYWx0J1xyXG5cdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICA6IDAsXHRcdFx0XHRcdFx0XHRcdFx0Ly8gaG93IG1hbnkgbWljcm9zZWNvbmQgdG8gIHNob3csICBpZiAwICB0aGVuICBzaG93IGZvcmV2ZXJcclxuXHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogZmFsc2UsXHRcdFx0XHRcdC8vIGlmIHRydWUsICB0aGVuIGRvIG5vdCBzaG93IG1lc3NhZ2UsICBpZiBwcmV2aW9zIG1lc3NhZ2Ugd2FzIG5vdCBoaWRlZCAobm90IGFwcGx5IGlmICd3aGVyZScgICA6ICdpbnNpZGUnIClcclxuXHRcdFx0XHRcdFx0XHRcdCdpc19zY3JvbGwnOiB0cnVlXHRcdFx0XHRcdFx0XHRcdC8vIGlzIHNjcm9sbCAgdG8gIHRoaXMgZWxlbWVudFxyXG5cdFx0XHRcdFx0XHR9O1xyXG5cdGZvciAoIHZhciBwX2tleSBpbiBwYXJhbXMgKXtcclxuXHRcdHBhcmFtc19kZWZhdWx0WyBwX2tleSBdID0gcGFyYW1zWyBwX2tleSBdO1xyXG5cdH1cclxuXHRwYXJhbXMgPSBwYXJhbXNfZGVmYXVsdDtcclxuXHJcbiAgICB2YXIgdW5pcXVlX2Rpdl9pZCA9IG5ldyBEYXRlKCk7XHJcbiAgICB1bmlxdWVfZGl2X2lkID0gJ3dwYmNfbm90aWNlXycgKyB1bmlxdWVfZGl2X2lkLmdldFRpbWUoKTtcclxuXHJcblx0cGFyYW1zWydjc3NfY2xhc3MnXSArPSAnIHdwYmNfZmVfbWVzc2FnZSc7XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnZXJyb3InICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX2Vycm9yJztcclxuXHRcdG1lc3NhZ2UgPSAnPGkgY2xhc3M9XCJtZW51X2ljb24gaWNvbi0xeCB3cGJjX2ljbl9yZXBvcnRfZ21haWxlcnJvcnJlZFwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnd2FybmluZycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2Vfd2FybmluZyc7XHJcblx0XHRtZXNzYWdlID0gJzxpIGNsYXNzPVwibWVudV9pY29uIGljb24tMXggd3BiY19pY25fd2FybmluZ1wiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblx0aWYgKCBwYXJhbXNbJ3R5cGUnXSA9PSAnaW5mbycgKXtcclxuXHRcdHBhcmFtc1snY3NzX2NsYXNzJ10gKz0gJyB3cGJjX2ZlX21lc3NhZ2VfaW5mbyc7XHJcblx0fVxyXG5cdGlmICggcGFyYW1zWyd0eXBlJ10gPT0gJ3N1Y2Nlc3MnICl7XHJcblx0XHRwYXJhbXNbJ2Nzc19jbGFzcyddICs9ICcgd3BiY19mZV9tZXNzYWdlX3N1Y2Nlc3MnO1xyXG5cdFx0bWVzc2FnZSA9ICc8aSBjbGFzcz1cIm1lbnVfaWNvbiBpY29uLTF4IHdwYmNfaWNuX2RvbmVfb3V0bGluZVwiPjwvaT4nICsgbWVzc2FnZTtcclxuXHR9XHJcblxyXG5cdHZhciBzY3JvbGxfdG9fZWxlbWVudCA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnX3Njcm9sbFwiIHN0eWxlPVwiZGlzcGxheTpub25lO1wiPjwvZGl2Pic7XHJcblx0bWVzc2FnZSA9ICc8ZGl2IGlkPVwiJyArIHVuaXF1ZV9kaXZfaWQgKyAnXCIgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZSAnICsgcGFyYW1zWydjc3NfY2xhc3MnXSArICdcIiBzdHlsZT1cIicgKyBwYXJhbXNbICdzdHlsZScgXSArICdcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nO1xyXG5cclxuXHJcblx0dmFyIGpxX2VsX21lc3NhZ2UgPSBmYWxzZTtcclxuXHR2YXIgaXNfc2hvd19tZXNzYWdlID0gdHJ1ZTtcclxuXHJcblx0aWYgKCAnaW5zaWRlJyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRpZiAoIHBhcmFtc1sgJ2lzX2FwcGVuZCcgXSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hcHBlbmQoIHNjcm9sbF90b19lbGVtZW50ICk7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmFwcGVuZCggbWVzc2FnZSApO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuaHRtbCggc2Nyb2xsX3RvX2VsZW1lbnQgKyBtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdH0gZWxzZSBpZiAoICdiZWZvcmUnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5zaWJsaW5ncyggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBtZXNzYWdlICk7XHJcblx0XHR9XHJcblxyXG5cdH0gZWxzZSBpZiAoICdhZnRlcicgPT09IHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ3doZXJlJyBdICl7XHJcblxyXG5cdFx0anFfZWxfbWVzc2FnZSA9IGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLm5leHRBbGwoICdbaWRePVwid3BiY19ub3RpY2VfXCJdJyApO1xyXG5cdFx0aWYgKCAocGFyYW1zWyAnaWZfdmlzaWJsZV9ub3Rfc2hvdycgXSkgJiYgKGpxX2VsX21lc3NhZ2UuaXMoICc6dmlzaWJsZScgKSkgKXtcclxuXHRcdFx0aXNfc2hvd19tZXNzYWdlID0gZmFsc2U7XHJcblx0XHRcdHVuaXF1ZV9kaXZfaWQgPSBqUXVlcnkoIGpxX2VsX21lc3NhZ2UuZ2V0KCAwICkgKS5hdHRyKCAnaWQnICk7XHJcblx0XHR9XHJcblx0XHRpZiAoIGlzX3Nob3dfbWVzc2FnZSApe1xyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5iZWZvcmUoIHNjcm9sbF90b19lbGVtZW50ICk7XHRcdC8vIFdlIG5lZWQgdG8gIHNldCAgaGVyZSBiZWZvcmUoZm9yIGhhbmR5IHNjcm9sbClcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYWZ0ZXIoIG1lc3NhZ2UgKTtcclxuXHRcdH1cclxuXHJcblx0fSBlbHNlIGlmICggJ3JpZ2h0JyA9PT0gcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnd2hlcmUnIF0gKXtcclxuXHJcblx0XHRqcV9lbF9tZXNzYWdlID0galF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkubmV4dEFsbCggJy53cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfcmlnaHQnICkuZmluZCggJ1tpZF49XCJ3cGJjX25vdGljZV9cIl0nICk7XHJcblx0XHRpZiAoIChwYXJhbXNbICdpZl92aXNpYmxlX25vdF9zaG93JyBdKSAmJiAoanFfZWxfbWVzc2FnZS5pcyggJzp2aXNpYmxlJyApKSApe1xyXG5cdFx0XHRpc19zaG93X21lc3NhZ2UgPSBmYWxzZTtcclxuXHRcdFx0dW5pcXVlX2Rpdl9pZCA9IGpRdWVyeSgganFfZWxfbWVzc2FnZS5nZXQoIDAgKSApLmF0dHIoICdpZCcgKTtcclxuXHRcdH1cclxuXHRcdGlmICggaXNfc2hvd19tZXNzYWdlICl7XHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggc2Nyb2xsX3RvX2VsZW1lbnQgKTtcdFx0Ly8gV2UgbmVlZCB0byAgc2V0ICBoZXJlIGJlZm9yZShmb3IgaGFuZHkgc2Nyb2xsKVxyXG5cdFx0XHRqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5hZnRlciggJzxkaXYgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfcmlnaHRcIj4nICsgbWVzc2FnZSArICc8L2Rpdj4nICk7XHJcblx0XHR9XHJcblx0fSBlbHNlIGlmICggJ2xlZnQnID09PSBwYXJhbXNbICdzaG93X2hlcmUnIF1bICd3aGVyZScgXSApe1xyXG5cclxuXHRcdGpxX2VsX21lc3NhZ2UgPSBqUXVlcnkoIHBhcmFtc1sgJ3Nob3dfaGVyZScgXVsgJ2pxX25vZGUnIF0gKS5zaWJsaW5ncyggJy53cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfbGVmdCcgKS5maW5kKCAnW2lkXj1cIndwYmNfbm90aWNlX1wiXScgKTtcclxuXHRcdGlmICggKHBhcmFtc1sgJ2lmX3Zpc2libGVfbm90X3Nob3cnIF0pICYmIChqcV9lbF9tZXNzYWdlLmlzKCAnOnZpc2libGUnICkpICl7XHJcblx0XHRcdGlzX3Nob3dfbWVzc2FnZSA9IGZhbHNlO1xyXG5cdFx0XHR1bmlxdWVfZGl2X2lkID0galF1ZXJ5KCBqcV9lbF9tZXNzYWdlLmdldCggMCApICkuYXR0ciggJ2lkJyApO1xyXG5cdFx0fVxyXG5cdFx0aWYgKCBpc19zaG93X21lc3NhZ2UgKXtcclxuXHRcdFx0alF1ZXJ5KCBwYXJhbXNbICdzaG93X2hlcmUnIF1bICdqcV9ub2RlJyBdICkuYmVmb3JlKCBzY3JvbGxfdG9fZWxlbWVudCApO1x0XHQvLyBXZSBuZWVkIHRvICBzZXQgIGhlcmUgYmVmb3JlKGZvciBoYW5keSBzY3JvbGwpXHJcblx0XHRcdGpRdWVyeSggcGFyYW1zWyAnc2hvd19oZXJlJyBdWyAnanFfbm9kZScgXSApLmJlZm9yZSggJzxkaXYgY2xhc3M9XCJ3cGJjX2Zyb250X2VuZF9fbWVzc2FnZV9jb250YWluZXJfbGVmdFwiPicgKyBtZXNzYWdlICsgJzwvZGl2PicgKTtcclxuXHRcdH1cclxuXHR9XHJcblxyXG5cdGlmICggICAoIGlzX3Nob3dfbWVzc2FnZSApICAmJiAgKCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSA+IDAgKSAgICl7XHJcblx0XHR2YXIgY2xvc2VkX3RpbWVyID0gc2V0VGltZW91dCggZnVuY3Rpb24gKCl7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0alF1ZXJ5KCAnIycgKyB1bmlxdWVfZGl2X2lkICkuZmFkZU91dCggMTUwMCApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0gLCBwYXJzZUludCggcGFyYW1zWyAnZGVsYXknIF0gKSAgICk7XHJcblxyXG5cdFx0dmFyIGNsb3NlZF90aW1lcjIgPSBzZXRUaW1lb3V0KCBmdW5jdGlvbiAoKXtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLnRyaWdnZXIoICdoaWRlJyApO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0sICggcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdICkgKyAxNTAxICkgKTtcclxuXHR9XHJcblxyXG5cdC8vIENoZWNrICBpZiBzaG93ZWQgbWVzc2FnZSBpbiBzb21lIGhpZGRlbiBwYXJlbnQgc2VjdGlvbiBhbmQgc2hvdyBpdC4gQnV0IGl0IG11c3QgIGJlIGxvd2VyIHRoYW4gJy53cGJjX2NvbnRhaW5lcidcclxuXHR2YXIgcGFyZW50X2VscyA9IGpRdWVyeSggJyMnICsgdW5pcXVlX2Rpdl9pZCApLnBhcmVudHMoKS5tYXAoIGZ1bmN0aW9uICgpe1xyXG5cdFx0aWYgKCAoIWpRdWVyeSggdGhpcyApLmlzKCAndmlzaWJsZScgKSkgJiYgKGpRdWVyeSggJy53cGJjX2NvbnRhaW5lcicgKS5oYXMoIHRoaXMgKSkgKXtcclxuXHRcdFx0alF1ZXJ5KCB0aGlzICkuc2hvdygpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHJcblx0aWYgKCBwYXJhbXNbICdpc19zY3JvbGwnIF0gKXtcclxuXHRcdHdwYmNfZG9fc2Nyb2xsKCAnIycgKyB1bmlxdWVfZGl2X2lkICsgJ19zY3JvbGwnICk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gdW5pcXVlX2Rpdl9pZDtcclxufVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRXJyb3IgbWVzc2FnZS4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3IoIGpxX25vZGUsIG1lc3NhZ2UgKXtcclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnZXJyb3InLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAncmlnaHQnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2pxX25vZGUnOiBqcV9ub2RlXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICAgfVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCk7XHJcblx0XHRyZXR1cm4gbm90aWNlX21lc3NhZ2VfaWQ7XHJcblx0fVxyXG5cclxuXHJcblx0LyoqXHJcblx0ICogRXJyb3IgbWVzc2FnZSBVTkRFUiBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX19lcnJvcl91bmRlcl9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlLCBtZXNzYWdlX2RlbGF5ICl7XHJcblxyXG5cdFx0aWYgKCAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIChtZXNzYWdlX2RlbGF5KSApe1xyXG5cdFx0XHRtZXNzYWdlX2RlbGF5ID0gMFxyXG5cdFx0fVxyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICdlcnJvcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IG1lc3NhZ2VfZGVsYXksXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ2FmdGVyJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIEVycm9yIG1lc3NhZ2UgVU5ERVIgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fZXJyb3JfYWJvdmVfZWxlbWVudCgganFfbm9kZSwgbWVzc2FnZSwgbWVzc2FnZV9kZWxheSApe1xyXG5cclxuXHRcdGlmICggJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiAobWVzc2FnZV9kZWxheSkgKXtcclxuXHRcdFx0bWVzc2FnZV9kZWxheSA9IDEwMDAwXHJcblx0XHR9XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ2Vycm9yJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogbWVzc2FnZV9kZWxheSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYmVmb3JlJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFdhcm5pbmcgbWVzc2FnZS4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZygganFfbm9kZSwgbWVzc2FnZSApe1xyXG5cclxuXHRcdHZhciBub3RpY2VfbWVzc2FnZV9pZCA9IHdwYmNfZnJvbnRfZW5kX19zaG93X21lc3NhZ2UoXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bWVzc2FnZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQndHlwZScgICAgICAgICAgICAgICA6ICd3YXJuaW5nJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdkZWxheScgICAgICAgICAgICAgIDogMTAwMDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnaWZfdmlzaWJsZV9ub3Rfc2hvdyc6IHRydWUsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnc2hvd19oZXJlJyAgICAgICAgICA6IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd3aGVyZScgIDogJ3JpZ2h0JyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0d3BiY19oaWdobGlnaHRfZXJyb3Jfb25fZm9ybV9maWVsZCgganFfbm9kZSApO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqIFdhcm5pbmcgbWVzc2FnZSBVTkRFUiBlbGVtZW50LiBcdFByZXNldCBvZiBwYXJhbWV0ZXJzIGZvciByZWFsIG1lc3NhZ2UgZnVuY3Rpb24uXHJcblx0ICpcclxuXHQgKiBAcGFyYW0gZWxcdFx0LSBhbnkgalF1ZXJ5IG5vZGUgZGVmaW5pdGlvblxyXG5cdCAqIEBwYXJhbSBtZXNzYWdlXHQtIE1lc3NhZ2UgSFRNTFxyXG5cdCAqIEByZXR1cm5zIHN0cmluZyAgLSBIVE1MIElEXHRcdG9yIDAgaWYgbm90IHNob3dpbmcgZHVyaW5nIHRoaXMgdGltZS5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlX193YXJuaW5nX3VuZGVyX2VsZW1lbnQoIGpxX25vZGUsIG1lc3NhZ2UgKXtcclxuXHJcblx0XHR2YXIgbm90aWNlX21lc3NhZ2VfaWQgPSB3cGJjX2Zyb250X2VuZF9fc2hvd19tZXNzYWdlKFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3R5cGUnICAgICAgICAgICAgICAgOiAnd2FybmluZycsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnZGVsYXknICAgICAgICAgICAgICA6IDEwMDAwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2lmX3Zpc2libGVfbm90X3Nob3cnOiB0cnVlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3Nob3dfaGVyZScgICAgICAgICAgOiB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnd2hlcmUnICA6ICdhZnRlcicsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQnanFfbm9kZSc6IGpxX25vZGVcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgICB9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHRcdHJldHVybiBub3RpY2VfbWVzc2FnZV9pZDtcclxuXHR9XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBXYXJuaW5nIG1lc3NhZ2UgQUJPVkUgZWxlbWVudC4gXHRQcmVzZXQgb2YgcGFyYW1ldGVycyBmb3IgcmVhbCBtZXNzYWdlIGZ1bmN0aW9uLlxyXG5cdCAqXHJcblx0ICogQHBhcmFtIGVsXHRcdC0gYW55IGpRdWVyeSBub2RlIGRlZmluaXRpb25cclxuXHQgKiBAcGFyYW0gbWVzc2FnZVx0LSBNZXNzYWdlIEhUTUxcclxuXHQgKiBAcmV0dXJucyBzdHJpbmcgIC0gSFRNTCBJRFx0XHRvciAwIGlmIG5vdCBzaG93aW5nIGR1cmluZyB0aGlzIHRpbWUuXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZV9fd2FybmluZ19hYm92ZV9lbGVtZW50KCBqcV9ub2RlLCBtZXNzYWdlICl7XHJcblxyXG5cdFx0dmFyIG5vdGljZV9tZXNzYWdlX2lkID0gd3BiY19mcm9udF9lbmRfX3Nob3dfbWVzc2FnZShcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCd0eXBlJyAgICAgICAgICAgICAgIDogJ3dhcm5pbmcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J2RlbGF5JyAgICAgICAgICAgICAgOiAxMDAwMCxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdpZl92aXNpYmxlX25vdF9zaG93JzogdHJ1ZSxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdzaG93X2hlcmUnICAgICAgICAgIDoge1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0J3doZXJlJyAgOiAnYmVmb3JlJyxcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCdqcV9ub2RlJzoganFfbm9kZVxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQpO1xyXG5cdFx0cmV0dXJuIG5vdGljZV9tZXNzYWdlX2lkO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogSGlnaGxpZ2h0IEVycm9yIGluIHNwZWNpZmljIGZpZWxkXHJcblx0ICpcclxuXHQgKiBAcGFyYW0ganFfbm9kZVx0XHRcdFx0XHRzdHJpbmcgb3IgalF1ZXJ5IGVsZW1lbnQsICB3aGVyZSBzY3JvbGwgIHRvXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gd3BiY19oaWdobGlnaHRfZXJyb3Jfb25fZm9ybV9maWVsZCgganFfbm9kZSApe1xyXG5cclxuXHRcdGlmICggIWpRdWVyeSgganFfbm9kZSApLmxlbmd0aCApe1xyXG5cdFx0XHRyZXR1cm47XHJcblx0XHR9XHJcblx0XHRpZiAoICEgalF1ZXJ5KCBqcV9ub2RlICkuaXMoICc6aW5wdXQnICkgKXtcclxuXHRcdFx0Ly8gU2l0dWF0aW9uIHdpdGggIGNoZWNrYm94ZXMgb3IgcmFkaW8gIGJ1dHRvbnNcclxuXHRcdFx0dmFyIGpxX25vZGVfYXJyID0galF1ZXJ5KCBqcV9ub2RlICkuZmluZCggJzppbnB1dCcgKTtcclxuXHRcdFx0aWYgKCAhanFfbm9kZV9hcnIubGVuZ3RoICl7XHJcblx0XHRcdFx0cmV0dXJuXHJcblx0XHRcdH1cclxuXHRcdFx0anFfbm9kZSA9IGpxX25vZGVfYXJyLmdldCggMCApO1xyXG5cdFx0fVxyXG5cdFx0dmFyIHBhcmFtcyA9IHt9O1xyXG5cdFx0cGFyYW1zWyAnZGVsYXknIF0gPSAxMDAwMDtcclxuXHJcblx0XHRpZiAoICFqUXVlcnkoIGpxX25vZGUgKS5oYXNDbGFzcyggJ3dwYmNfZm9ybV9maWVsZF9lcnJvcicgKSApe1xyXG5cclxuXHRcdFx0alF1ZXJ5KCBqcV9ub2RlICkuYWRkQ2xhc3MoICd3cGJjX2Zvcm1fZmllbGRfZXJyb3InIClcclxuXHJcblx0XHRcdGlmICggcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdICkgPiAwICl7XHJcblx0XHRcdFx0dmFyIGNsb3NlZF90aW1lciA9IHNldFRpbWVvdXQoIGZ1bmN0aW9uICgpe1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgalF1ZXJ5KCBqcV9ub2RlICkucmVtb3ZlQ2xhc3MoICd3cGJjX2Zvcm1fZmllbGRfZXJyb3InICk7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQgIH1cclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCAgICwgcGFyc2VJbnQoIHBhcmFtc1sgJ2RlbGF5JyBdIClcclxuXHRcdFx0XHRcdFx0XHRcdFx0KTtcclxuXHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHR9XHJcblxyXG4vKipcclxuICogU2Nyb2xsIHRvIHNwZWNpZmljIGVsZW1lbnRcclxuICpcclxuICogQHBhcmFtIGpxX25vZGVcdFx0XHRcdFx0c3RyaW5nIG9yIGpRdWVyeSBlbGVtZW50LCAgd2hlcmUgc2Nyb2xsICB0b1xyXG4gKiBAcGFyYW0gZXh0cmFfc2hpZnRfb2Zmc2V0XHRcdGludCBzaGlmdCBvZmZzZXQgZnJvbSAganFfbm9kZVxyXG4gKi9cclxuZnVuY3Rpb24gd3BiY19kb19zY3JvbGwoIGpxX25vZGUgLCBleHRyYV9zaGlmdF9vZmZzZXQgPSAwICl7XHJcblxyXG5cdGlmICggIWpRdWVyeSgganFfbm9kZSApLmxlbmd0aCApe1xyXG5cdFx0cmV0dXJuO1xyXG5cdH1cclxuXHR2YXIgdGFyZ2V0T2Zmc2V0ID0galF1ZXJ5KCBqcV9ub2RlICkub2Zmc2V0KCkudG9wO1xyXG5cclxuXHRpZiAoIHRhcmdldE9mZnNldCA8PSAwICl7XHJcblx0XHRpZiAoIDAgIT0galF1ZXJ5KCBqcV9ub2RlICkubmV4dEFsbCggJzp2aXNpYmxlJyApLmxlbmd0aCApe1xyXG5cdFx0XHR0YXJnZXRPZmZzZXQgPSBqUXVlcnkoIGpxX25vZGUgKS5uZXh0QWxsKCAnOnZpc2libGUnICkuZmlyc3QoKS5vZmZzZXQoKS50b3A7XHJcblx0XHR9IGVsc2UgaWYgKCAwICE9IGpRdWVyeSgganFfbm9kZSApLnBhcmVudCgpLm5leHRBbGwoICc6dmlzaWJsZScgKS5sZW5ndGggKXtcclxuXHRcdFx0dGFyZ2V0T2Zmc2V0ID0galF1ZXJ5KCBqcV9ub2RlICkucGFyZW50KCkubmV4dEFsbCggJzp2aXNpYmxlJyApLmZpcnN0KCkub2Zmc2V0KCkudG9wO1xyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0aWYgKCBqUXVlcnkoICcjd3BhZG1pbmJhcicgKS5sZW5ndGggPiAwICl7XHJcblx0XHR0YXJnZXRPZmZzZXQgPSB0YXJnZXRPZmZzZXQgLSA1MCAtIDUwO1xyXG5cdH0gZWxzZSB7XHJcblx0XHR0YXJnZXRPZmZzZXQgPSB0YXJnZXRPZmZzZXQgLSAyMCAtIDUwO1xyXG5cdH1cclxuXHR0YXJnZXRPZmZzZXQgKz0gZXh0cmFfc2hpZnRfb2Zmc2V0O1xyXG5cclxuXHQvLyBTY3JvbGwgb25seSAgaWYgd2UgZGlkIG5vdCBzY3JvbGwgYmVmb3JlXHJcblx0aWYgKCAhIGpRdWVyeSggJ2h0bWwsYm9keScgKS5pcyggJzphbmltYXRlZCcgKSApe1xyXG5cdFx0alF1ZXJ5KCAnaHRtbCxib2R5JyApLmFuaW1hdGUoIHtzY3JvbGxUb3A6IHRhcmdldE9mZnNldH0sIDUwMCApO1xyXG5cdH1cclxufVxyXG5cclxuIiwiXHJcbi8vRml4SW46IDEwLjIuMC40XHJcbi8qKlxyXG4gKiBEZWZpbmUgUG9wb3ZlcnMgZm9yIFRpbWVsaW5lcyBpbiBXUCBCb29raW5nIENhbGVuZGFyXHJcbiAqXHJcbiAqIEByZXR1cm5zIHtzdHJpbmd8Ym9vbGVhbn1cclxuICovXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX3RpcHB5X3BvcG92ZXIoKXtcclxuXHRpZiAoICdmdW5jdGlvbicgIT09IHR5cGVvZiAod3BiY190aXBweSkgKXtcclxuXHRcdGNvbnNvbGUubG9nKCAnV1BCQyBFcnJvci4gd3BiY190aXBweSB3YXMgbm90IGRlZmluZWQuJyApO1xyXG5cdFx0cmV0dXJuIGZhbHNlO1xyXG5cdH1cclxuXHR3cGJjX3RpcHB5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snLCB7XHJcblx0XHRjb250ZW50KCByZWZlcmVuY2UgKXtcclxuXHRcdFx0dmFyIHBvcG92ZXJfdGl0bGUgPSByZWZlcmVuY2UuZ2V0QXR0cmlidXRlKCAnZGF0YS1vcmlnaW5hbC10aXRsZScgKTtcclxuXHRcdFx0dmFyIHBvcG92ZXJfY29udGVudCA9IHJlZmVyZW5jZS5nZXRBdHRyaWJ1dGUoICdkYXRhLWNvbnRlbnQnICk7XHJcblx0XHRcdHJldHVybiAnPGRpdiBjbGFzcz1cInBvcG92ZXIgcG9wb3Zlcl90aXBweVwiPidcclxuXHRcdFx0XHQrICc8ZGl2IGNsYXNzPVwicG9wb3Zlci1jbG9zZVwiPjxhIGhyZWY9XCJqYXZhc2NyaXB0OnZvaWQoMClcIiBvbmNsaWNrPVwiamF2YXNjcmlwdDp0aGlzLnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5wYXJlbnRFbGVtZW50LnBhcmVudEVsZW1lbnQucGFyZW50RWxlbWVudC5fdGlwcHkuaGlkZSgpO1wiID4mdGltZXM7PC9hPjwvZGl2PidcclxuXHRcdFx0XHQrIHBvcG92ZXJfY29udGVudFxyXG5cdFx0XHRcdCsgJzwvZGl2Pic7XHJcblx0XHR9LFxyXG5cdFx0YWxsb3dIVE1MICAgICAgICA6IHRydWUsXHJcblx0XHR0cmlnZ2VyICAgICAgICAgIDogJ21hbnVhbCcsXHJcblx0XHRpbnRlcmFjdGl2ZSAgICAgIDogdHJ1ZSxcclxuXHRcdGhpZGVPbkNsaWNrICAgICAgOiBmYWxzZSxcclxuXHRcdGludGVyYWN0aXZlQm9yZGVyOiAxMCxcclxuXHRcdG1heFdpZHRoICAgICAgICAgOiA1NTAsXHJcblx0XHR0aGVtZSAgICAgICAgICAgIDogJ3dwYmMtdGlwcHktcG9wb3ZlcicsXHJcblx0XHRwbGFjZW1lbnQgICAgICAgIDogJ2JvdHRvbS1zdGFydCcsXHJcblx0XHR0b3VjaCAgICAgICAgICAgIDogWydob2xkJywgNTAwXSxcclxuXHR9ICk7XHJcblx0alF1ZXJ5KCAnLnBvcG92ZXJfYm90dG9tLnBvcG92ZXJfY2xpY2snICkub24oICdjbGljaycsIGZ1bmN0aW9uICgpe1xyXG5cdFx0aWYgKCB0aGlzLl90aXBweS5zdGF0ZS5pc1Zpc2libGUgKXtcclxuXHRcdFx0dGhpcy5fdGlwcHkuaGlkZSgpO1xyXG5cdFx0fSBlbHNlIHtcclxuXHRcdFx0dGhpcy5fdGlwcHkuc2hvdygpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxuXHR3cGJjX2RlZmluZV9oaWRlX3RpcHB5X29uX3Njcm9sbCgpO1xyXG59XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfZGVmaW5lX2hpZGVfdGlwcHlfb25fc2Nyb2xsKCl7XHJcblx0alF1ZXJ5KCAnLmZsZXhfdGxfX3Njcm9sbGluZ19zZWN0aW9uMiwuZmxleF90bF9fc2Nyb2xsaW5nX3NlY3Rpb25zJyApLm9uKCAnc2Nyb2xsJywgZnVuY3Rpb24gKCBldmVudCApe1xyXG5cdFx0aWYgKCAnZnVuY3Rpb24nID09PSB0eXBlb2YgKHdwYmNfdGlwcHkpICl7XHJcblx0XHRcdHdwYmNfdGlwcHkuaGlkZUFsbCgpO1xyXG5cdFx0fVxyXG5cdH0gKTtcclxufVxyXG4iXSwiZmlsZSI6Il9kaXN0L2FsbC9fb3V0L3dwYmNfYWxsLmpzIn0=

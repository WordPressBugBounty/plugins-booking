"use strict";

/**
 * Request Object
 * Here we can  define parameters and Update it later,  when  some parameter was changed
 *
 */
var _wpbc_settings = (function ( obj, $) {

	// -----------------------------------------------------------------------------------------------------------------
	// Main Parameters
	// -----------------------------------------------------------------------------------------------------------------
	var p_general = obj.general_obj = obj.general_obj || {
													// sort            : "booking_id",
													// sort_type       : "DESC",
													// page_num        : 1,
													// page_items_count: 10,
													// create_date     : "",
													// keyword         : "",
													// source          : ""
												};
	obj.get_param__general = function ( param_key ) {
		return p_general[ param_key ];
	};
	obj.set_param__general = function ( param_key, param_val ) {
		p_general[ param_key ] = param_val;
	};
	// -------------------------------------------------------------
	obj.set_all_params__general = function ( request_param_obj ) {
		p_general = request_param_obj;
	};
	obj.get_all_params__general = function () {
		return p_general;
	};
	// -------------------------------------------------------------
	obj.set_params_arr__general = function( params_arr ){
		_.each( params_arr, function ( p_val, p_key, p_data ){
			this.set_param__general( p_key, p_val );
		} );
	}


	// -----------------------------------------------------------------------------------------------------------------
	// Secure parameters for Ajax
	// -----------------------------------------------------------------------------------------------------------------
	var p_secure = obj.security_obj = obj.security_obj || {
															user_id: 0,
															nonce  : '',
															locale : ''
														  };
	obj.set_param__secure = function ( param_key, param_val ) {
		p_secure[ param_key ] = param_val;
	};

	obj.get_param__secure = function ( param_key ) {
		return p_secure[ param_key ];
	};


	// -----------------------------------------------------------------------------------------------------------------
	// Other parameters
	// -----------------------------------------------------------------------------------------------------------------
	var p_other = obj.other_obj = obj.other_obj || { };

	obj.set_param__other = function ( param_key, param_val ) {
		p_other[ param_key ] = param_val;
	};

	obj.get_param__other = function ( param_key ) {
		return p_other[ param_key ];
	};

	return obj;
}( _wpbc_settings || {}, jQuery ));



function wpbc_setup_page__show_content( params_obj = {} ){
console.log( params_obj );
	var template = wp.template( 'wpbc_main_page_content' );

	jQuery( _wpbc_settings.get_param__other( 'listing_container' ) ).html( template( params_obj ) );
}

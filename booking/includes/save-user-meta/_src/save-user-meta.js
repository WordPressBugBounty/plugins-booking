function wpbc_user_data_saver__read_attr_or_data( $el, attr_name, data_name ) {
	var attr_value = $el.attr( attr_name );

	if ( attr_value !== undefined ) {
		return attr_value;
	}

	return $el.data( data_name );
}

function wpbc_save_custom_user_data_from_element(el) {

	if ( typeof WPBC_UserDataSaver === 'undefined' ) {
		console.error( 'WPBC | Global AJAX object is missing.' );
		return false;
	}

	const $el = jQuery( el );

	const user_id      = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-user-id', 'wpbc-u-save-user-id' );
	const nonce        = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-nonce', 'wpbc-u-save-nonce' );
	const nonce_action = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-action', 'wpbc-u-save-action' );
	const data_name    = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-name', 'wpbc-u-save-name' );
	const fields_raw   = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-fields', 'wpbc-u-save-fields' ) || '';
	const inline_value = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-value', 'wpbc-u-save-value' );
	const json         = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-value-json', 'wpbc-u-save-value-json' );

	const callbackFnName = wpbc_user_data_saver__read_attr_or_data( $el, 'data-wpbc-u-save-callback', 'wpbc-u-save-callback' );
	const callbackFn     = typeof window[callbackFnName] === 'function' ? window[callbackFnName] : null;
	if ( callbackFnName && !callbackFn ) {
		console.warn( 'WPBC | Callback not found:', callbackFnName );
	}

	if ( !user_id || !nonce || !nonce_action || !data_name ) {
		console.error( 'WPBC | Missing required data attributes.' );
		return false;
	}

	let serialized = '';

	if ( typeof json === 'string' && json.trim() !== '' ) {
		try {
			serialized = jQuery.param( JSON.parse( json ) );
		} catch ( e ) {
			console.error( 'WPBC | Invalid JSON in data-wpbc-u-save-value-json' );
			return false;
		}
	} else if ( inline_value !== undefined ) {
		// Save simple direct value as single param.
		serialized = jQuery.param( { value: inline_value } );
	} else if ( fields_raw ) {
		const fields = fields_raw.split( ',' ).map( s => s.trim() ).filter( Boolean );
		const data   = {};

		fields.forEach( function (selector) {
			const $field = jQuery( selector );
			if ( $field.length ) {
				const key = $field.attr( 'name' ) || $field.attr( 'id' );
				if ( key ) {
					data[key] = $field.val();
				} else {
					console.warn( 'WPBC | Field missing name/id:', $field );
				}
			}
		} );

		serialized = jQuery.param( data );
	} else {
		console.error( 'WPBC | Missing data-wpbc-u-save-fields or data-wpbc-u-save-value.' );
		return false;
	}

	jQuery( document ).trigger( 'wpbc:userdata:beforeSave', [ $el, serialized ] );

	return jQuery.ajax( {
		url    : WPBC_UserDataSaver.ajax_url,
		type   : 'POST',
		data   : {
			action      : WPBC_UserDataSaver.action,
			user_id     : user_id,
			nonce       : nonce,
			nonce_action: nonce_action,
			data_name   : data_name,
			data_value  : serialized
		},
		success: function (response) {

			jQuery( document ).trigger( 'wpbc:userdata:afterSave', [ response ] );

			if ( response.success ) {
				// console.log( 'WPBC | ' + (response.data.message || 'Saved successfully.') );
				if ( callbackFn ) {
					callbackFn( response );
				}
			} else {
				console.error( 'WPBC | ' + ( response.data.message || 'Save error.' ) );
			}
		},
		error  : function ( xhr ) {
			console.error( 'WPBC | AJAX error: ' + xhr.status + ' ' + xhr.statusText );
		}
	} );
}

/**
 * Note:
 // This binds a handler *to event 'click'*, labeled 'myFeature'
$(document).on('click.myFeature', function () { ... });

// This binds another *to 'click'*, labeled 'debug'
$(document).on('click.debug', function () { ... });

// This fires the event 'click' — both will run:
$(document).trigger('click');

// This removes only handlers with .myFeature
$(document).off('click.myFeature');
 */


// jQuery( document ).on( 'wpbc:userdata:beforeSave.customLogger', function (e, $el, data) {
// 	// $el.prop('disabled', true);  // Example: disable the clicked element
// } );

// jQuery( document ).on( 'wpbc:userdata:afterSave.customLogger', function (e, response) {
//
// 	console.log( 'Save finished. Server responded with:', response );
//
// 	if ( response.success ) {
// 		console.log( 'Saved!' );
// 	} else {
// 		console.log( 'Error: ' + ( response.data?.message || 'Unknown error' ) );
// 	}
//
// 	// Optional: re-enable all save buttons
// 	// jQuery('[data-wpbc-u-save-name]').prop('disabled', false);
// } );

// To remove it:
// jQuery(document).off('wpbc:userdata:afterSave.customLogger');

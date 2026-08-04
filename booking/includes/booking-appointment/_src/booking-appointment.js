( function ( window, $ ) {
	'use strict';

	var config = window.wpbc_booking_appointment_config || {};
	var active_native_contexts = {};
	var loaded_script_urls = {};

	$( 'script[src]' ).each( function () {
		loaded_script_urls[ String( this.src || '' ) ] = true;
	} );

	/** Return a normalized integer from a selector field. */
	function get_selected_id( $form, name ) {
		return Number( $form.find( '[name="' + name + '"]:checked, [name="' + name + '"][type="hidden"]' ).first().val() || 0 );
	}

	/** Toggle one component loading state without clearing its current stage. */
	function set_loading( $root, is_loading ) {
		$root.toggleClass( 'is-loading', is_loading ).attr( 'aria-busy', is_loading ? 'true' : 'false' );
		$root.find( '> .wpbc_booking_appointment__stage' ).attr( 'aria-busy', is_loading ? 'true' : 'false' );
		$root.find( '> .wpbc_booking_appointment__loading' ).prop( 'hidden', ! is_loading ).attr( 'aria-hidden', is_loading ? 'false' : 'true' );
		$root.find( '.wpbc_booking_appointment__selection_form :input' ).prop( 'disabled', is_loading );
	}

	/**
	 * Display and focus an AJAX or initialization error in one component.
	 *
	 * @param {jQuery} $root        Appointment component root.
	 * @param {string} message      Error message.
	 * @param {string} action_url   Optional trusted administration action URL.
	 * @param {string} action_label Optional action link label.
	 * @return {void}
	 */
	function show_error( $root, message, action_url, action_label ) {
		var $notice = $root.find( '> .wpbc_booking_appointment__ajax_notice' );
		$notice.empty().append( $( '<span>' ).text( message || config.error || 'Unable to load the Appointment form.' ) );
		if ( action_url && action_label ) {
			$notice.append( ' ', $( '<a>', { 'class': 'wpbc_booking_appointment__notice_action', href: action_url, text: action_label } ) );
		}
		$notice.prop( 'hidden', false );
		if ( $notice.get( 0 ) && typeof $notice.get( 0 ).focus === 'function' ) {
			$notice.trigger( 'focus' );
		}
	}

	/** Clear the component AJAX error. */
	function clear_error( $root ) {
		$root.find( '> .wpbc_booking_appointment__ajax_notice' ).empty().prop( 'hidden', true );
	}

	/** Return a registered native context only while its DOM element is live. */
	function get_native_context( provider_id ) {
		provider_id = Number( provider_id || 0 );
		var context = active_native_contexts[ provider_id ];
		if ( ! context || ! context.element || ! document.documentElement.contains( context.element ) ) {
			delete active_native_contexts[ provider_id ];
			return null;
		}
		return context;
	}

	/** Detect another live native Booking Calendar form for the same Provider. */
	function has_duplicate_provider_form( $root, provider_id ) {
		provider_id = Number( provider_id || 0 );
		if ( ! provider_id ) {
			return false;
		}

		var context = get_native_context( provider_id );
		if ( context && ! $.contains( $root.get( 0 ), context.element ) ) {
			return true;
		}

		return $( '[id="booking_form' + provider_id + '"]' ).filter( function () {
			return ! $.contains( $root.get( 0 ), this );
		} ).length > 0;
	}

	/** Register the exact signed native form context used by booking submission. */
	function register_native_form( $native ) {
		var provider_id = Number( $native.data( 'provider-id' ) || 0 );
		var service_id = Number( $native.data( 'service-id' ) || 0 );
		var context_token = String( $native.attr( 'data-appointment-context-token' ) || '' );
		var allow_past = ( '1' === String( $native.attr( 'data-allow-past' ) || '0' ) ) ? 1 : 0;
		var existing = get_native_context( provider_id );

		if ( ! provider_id || ! service_id || ! context_token ) {
			return false;
		}
		if ( existing && existing.element !== $native.get( 0 ) ) {
			return false;
		}

		active_native_contexts[ provider_id ] = {
			element: $native.get( 0 ),
			service_id: service_id,
			provider_id: provider_id,
			context_token: context_token,
			allow_past: allow_past
		};
		return true;
	}

	/** Remove a native form from the local submission-context registry. */
	function unregister_native_form( $native ) {
		var provider_id = Number( $native.data( 'provider-id' ) || 0 );
		var context = get_native_context( provider_id );
		if ( context && context.element === $native.get( 0 ) ) {
			delete active_native_contexts[ provider_id ];
		}
	}

	/** Return the native Start Time field used by the fixed Service duration. */
	function get_start_time_field( $native ) {
		var provider_id = Number( $native.data( 'provider-id' ) || 0 );
		return $native.find( '[name="starttime' + provider_id + '"], [name="starttime' + provider_id + '[]"]' ).not( '[data-wpbc-booking-submit-ignore="1"]' ).first();
	}

	/** Return selected calendar dates in the server's strict SQL-date format. */
	function get_selected_dates( $native ) {
		var provider_id = Number( $native.data( 'provider-id' ) || 0 );
		if ( provider_id && typeof window.wpbc_get__selected_dates_sql__as_arr === 'function' ) {
			return window.wpbc_get__selected_dates_sql__as_arr( provider_id );
		}

		var value = String( $native.find( '#date_booking' + provider_id ).val() || '' );
		return value.split( ',' ).map( function ( date_value ) {
			var parts = $.trim( date_value ).split( '.' );
			return 3 === parts.length ? parts[ 2 ] + '-' + parts[ 1 ] + '-' + parts[ 0 ] : '';
		} ).filter( function ( date_value ) {
			return /^\d{4}-\d{2}-\d{2}$/.test( date_value );
		} );
	}

	/** Read the current date/start selection and its stable request signature. */
	function get_time_selection( $native ) {
		var $start = get_start_time_field( $native );
		var dates = get_selected_dates( $native );
		var start_time = $start.length ? String( $start.val() || '' ) : '';
		return {
			$start: $start,
			dates: dates,
			start_time: start_time,
			complete: !! ( dates.length && /^\d{1,2}:\d{2}(?::\d{2})?$/.test( start_time ) ),
			signature: dates.join( ',' ) + '|' + start_time
		};
	}

	/** Determine whether the Start Time field belongs to the visible wizard step. */
	function is_time_selection_stage_active( selection ) {
		var $step = selection.$start.closest( '.wpbc_wizard_step' );
		return ! $step.length || ( $step.is( ':visible' ) && ! $step.hasClass( 'wpbc_wizard_step_hidden' ) );
	}

	/** Find the visible Start Time UI beneath which validation is explained. */
	function get_time_notice_anchor( selection ) {
		var $picker = selection.$start.nextAll( '.wpbc_times_selector' ).first();
		return $picker.length ? $picker : selection.$start;
	}

	/** Remove the Appointment buffer warning and invalid field semantics. */
	function clear_time_notice( $native ) {
		$native.find( '.wpbc_booking_appointment__time_notice' ).remove();
		get_start_time_field( $native ).removeAttr( 'aria-invalid' ).nextAll( '.wpbc_times_selector' ).first().removeAttr( 'aria-invalid' );
	}

	/** Show a persistent warning using Booking Calendar's frontend message UI. */
	function show_time_notice( $native, selection, message ) {
		clear_time_notice( $native );
		var $anchor = get_time_notice_anchor( selection );
		if ( ! $anchor.length ) {
			$anchor = $native.find( '.bk_calendar_frame' ).first();
		}
		if ( ! $anchor.length ) {
			return;
		}

		selection.$start.attr( 'aria-invalid', 'true' ).nextAll( '.wpbc_times_selector' ).first().attr( 'aria-invalid', 'true' );
		$( '<div>', {
			'class': 'wpbc_booking_appointment__time_notice wpbc_front_end__message wpbc_fe_message wpbc_fe_message_warning',
			role: 'alert'
		} ).append( $( '<i>', { 'class': 'menu_icon icon-1x wpbc_icn_warning', 'aria-hidden': 'true' } ) )
			.append( $( '<span>' ).text( message || config.validation_error || config.error ) )
			.insertAfter( $anchor );
	}

	/** Return or initialize the validation state owned by one native form. */
	function get_time_validation_state( $native ) {
		var state = $native.data( 'wpbc-appointment-time-validation' );
		if ( ! state ) {
			state = {
				sequence: 0,
				signature: '',
				status: 'incomplete',
				request: null,
				promise: null,
				timer: null,
				availability_sequence: 0,
				availability_request: null,
				availability_timer: null,
				available_slots: {}
			};
			$native.data( 'wpbc-appointment-time-validation', state );
		}
		return state;
	}

	/** Restore only option state previously owned by the Appointment filter. */
	function clear_appointment_disabled_times( $start ) {
		$start.find( 'option[data-wpbc-appointment-unavailable="1"]' ).each( function () {
			var $option = $( this );
			if ( ! $option.hasClass( 'booked' ) ) {
				$option.prop( 'disabled', false );
			}
			$option.removeAttr( 'data-wpbc-appointment-unavailable' );
		} );
	}

	/** Rebuild the optional plate-style picker from the filtered native select. */
	function refresh_start_time_picker( $start ) {
		if ( $start.length && typeof $start.wpbc_timeselector === 'function' && $start.nextAll( '.wpbc_times_selector' ).length ) {
			$start.wpbc_timeselector();
		}
	}

	/** Read all options still allowed by the ordinary Booking Calendar engine. */
	function get_core_available_start_times( $start ) {
		var values = [];
		$start.find( 'option' ).each( function () {
			var $option = $( this );
			var value = String( $option.val() || '' );
			var appointment_disabled = '1' === String( $option.attr( 'data-wpbc-appointment-unavailable' ) || '' );
			if ( /^\d{1,2}:\d{2}(?::\d{2})?$/.test( value ) && ( ! $option.prop( 'disabled' ) || ( appointment_disabled && ! $option.hasClass( 'booked' ) ) ) ) {
				values.push( value );
			}
		} );
		return values;
	}

	/** Convert a browser time string to minutes from the start of its day. */
	function debug_time_to_minutes( time_value ) {
		var parts = String( time_value || '' ).split( ':' );
		if ( parts.length < 2 ) {
			return null;
		}
		return ( Number( parts[ 0 ] ) * 60 ) + Number( parts[ 1 ] );
	}

	/** Format debug time while retaining a previous/next-day boundary. */
	function debug_format_minutes( total_minutes ) {
		var day_offset = 0;
		while ( total_minutes < 0 ) {
			total_minutes += 1440;
			day_offset--;
		}
		while ( total_minutes >= 1440 ) {
			total_minutes -= 1440;
			day_offset++;
		}
		var hours = ( '0' + Math.floor( total_minutes / 60 ) ).slice( -2 );
		var minutes = ( '0' + ( total_minutes % 60 ) ).slice( -2 );
		return hours + ':' + minutes + ( day_offset ? ' (' + ( day_offset > 0 ? '+' : '' ) + day_offset + ' day)' : '' );
	}

	/** Explain the asynchronous Service-aware availability pass in the console. */
	function log_start_time_filter_request( $native, dates, start_times ) {
		if ( ! window.console || typeof window.console.info !== 'function' ) {
			return;
		}
		window.console.info(
			'[Booking Calendar Appointment] Rechecking Start Times with Service duration and buffers. The initial list comes from Provider calendar availability and may now be reduced.',
			{
				service_id: Number( $native.data( 'service-id' ) || 0 ),
				provider_id: Number( $native.data( 'provider-id' ) || 0 ),
				dates: dates.slice( 0 ),
				initial_start_times: start_times.slice( 0 )
			}
		);
	}

	/** Log only scheduling data needed to understand removed Start Times. */
	function log_start_time_filter_result( $native, dates, data ) {
		if ( ! window.console || typeof window.console.info !== 'function' ) {
			return;
		}
		var buffer_before = Number( data.buffer_before || 0 );
		var buffer_after = Number( data.buffer_after || 0 );
		var blocked = [];
		Object.keys( data.slots || {} ).forEach( function ( start_time ) {
			var result = data.slots[ start_time ];
			if ( ! result || false !== result.valid ) {
				return;
			}
			var end_time = String( result.end_time || '' );
			var start_minutes = debug_time_to_minutes( start_time );
			var end_minutes = debug_time_to_minutes( end_time );
			blocked.push( {
				start_time: start_time,
				appointment_time: end_time ? start_time + ' - ' + end_time : start_time,
				provider_reserved: null !== start_minutes && null !== end_minutes
					? debug_format_minutes( start_minutes - buffer_before ) + ' - ' + debug_format_minutes( end_minutes + buffer_after )
					: '',
				reason: result.message || result.code || config.validation_error
			} );
		} );

		window.console.info(
			'[Booking Calendar Appointment] Service-aware Start Time check completed.',
			{
				service_id: Number( $native.data( 'service-id' ) || 0 ),
				provider_id: Number( $native.data( 'provider-id' ) || 0 ),
				dates: dates.slice( 0 ),
				duration_minutes: Number( data.duration || 0 ),
				buffer_before_minutes: buffer_before,
				buffer_after_minutes: buffer_after,
				blocked_start_times: blocked.map( function ( item ) { return item.start_time; } )
			}
		);
		if ( blocked.length && typeof window.console.table === 'function' ) {
			window.console.table( blocked );
		}
	}

	/** Apply one server response without exposing another customer's booking. */
	function apply_available_start_times( $native, slots ) {
		var selection = get_time_selection( $native );
		var $start = selection.$start;
		var selected_value = selection.start_time;
		var selected_message = '';
		clear_appointment_disabled_times( $start );

		$start.find( 'option' ).each( function () {
			var $option = $( this );
			var value = String( $option.val() || '' );
			var result = slots && slots[ value ] ? slots[ value ] : null;
			if ( result && false === result.valid && ! $option.hasClass( 'booked' ) ) {
				$option.prop( 'disabled', true ).attr( 'data-wpbc-appointment-unavailable', '1' );
				if ( selected_value === value ) {
					selected_message = result.message || config.validation_error;
				}
			}
		} );

		if ( selected_message ) {
			$start.val( '' );
			show_time_notice( $native, selection, selected_message );
		}
		refresh_start_time_picker( $start );
	}

	/** Filter the complete Start Time list with one bounded server request. */
	function load_available_start_times( $native ) {
		var state = get_time_validation_state( $native );
		var $start = get_start_time_field( $native );
		var dates = get_selected_dates( $native );
		var start_times = get_core_available_start_times( $start );
		var sequence = ++state.availability_sequence;

		if ( state.availability_request && 4 !== state.availability_request.readyState ) {
			state.availability_request.abort();
		}
		if ( ! $start.length || ! dates.length || ! start_times.length ) {
			clear_appointment_disabled_times( $start );
			refresh_start_time_picker( $start );
			state.available_slots = {};
			return;
		}
		log_start_time_filter_request( $native, dates, start_times );

		state.availability_request = $.post( config.ajax_url, {
			action: config.validate_action,
			nonce: config.nonce,
			service_id: Number( $native.data( 'service-id' ) || 0 ),
			provider_id: Number( $native.data( 'provider-id' ) || 0 ),
			context_token: String( $native.attr( 'data-appointment-context-token' ) || '' ),
			dates: dates,
			start_times: start_times
		} );
		state.availability_request.done( function ( response ) {
			if ( sequence !== state.availability_sequence ) {
				return;
			}
			var data = response && response.data ? response.data : {};
			if ( ! response || ! response.success || ! data.slots ) {
				return;
			}
			state.available_slots = data.slots;
			log_start_time_filter_result( $native, dates, data );
			apply_available_start_times( $native, data.slots );
		} ).fail( function ( xhr, status ) {
			if ( 'abort' === status || sequence !== state.availability_sequence ) {
				return;
			}
			clear_appointment_disabled_times( $start );
			refresh_start_time_picker( $start );
			state.available_slots = {};
		} );
	}

	/** Debounce the whole-list filter after core availability has refreshed. */
	function schedule_available_start_times( $native ) {
		var state = get_time_validation_state( $native );
		window.clearTimeout( state.availability_timer );
		state.availability_timer = window.setTimeout( function () {
			load_available_start_times( $native );
		}, 30 );
	}

	/** Validate current Service duration/buffers through the authoritative server. */
	function validate_time_selection( $native ) {
		var selection = get_time_selection( $native );
		var state = get_time_validation_state( $native );
		if ( ! selection.complete ) {
			if ( state.request && 4 !== state.request.readyState ) {
				state.request.abort();
			}
			state.signature = selection.signature;
			state.status = 'incomplete';
			state.promise = null;
			clear_time_notice( $native );
			return $.Deferred().resolve( false, 'incomplete' ).promise();
		}
		if ( selection.signature === state.signature && 'valid' === state.status ) {
			return $.Deferred().resolve( true, 'valid' ).promise();
		}
		if ( selection.signature === state.signature && 'invalid' === state.status ) {
			return $.Deferred().resolve( false, 'invalid' ).promise();
		}
		if ( selection.signature === state.signature && 'pending' === state.status && state.promise ) {
			return state.promise;
		}
		if ( state.request && 4 !== state.request.readyState ) {
			state.request.abort();
		}

		var deferred = $.Deferred();
		var sequence = ++state.sequence;
		state.signature = selection.signature;
		state.status = 'pending';
		state.promise = deferred.promise();
		clear_time_notice( $native );
		state.request = $.post( config.ajax_url, {
			action: config.validate_action,
			nonce: config.nonce,
			service_id: Number( $native.data( 'service-id' ) || 0 ),
			provider_id: Number( $native.data( 'provider-id' ) || 0 ),
			context_token: String( $native.attr( 'data-appointment-context-token' ) || '' ),
			dates: selection.dates,
			start_time: selection.start_time
		} );
		state.request.done( function ( response ) {
			if ( sequence !== state.sequence || selection.signature !== get_time_selection( $native ).signature ) {
				deferred.reject( 'stale' );
				return;
			}
			var data = response && response.data ? response.data : {};
			if ( response && response.success && true === data.valid ) {
				state.status = 'valid';
				clear_time_notice( $native );
				deferred.resolve( true, 'valid' );
				return;
			}
			state.status = 'invalid';
			show_time_notice( $native, selection, data.message || config.validation_error );
			deferred.resolve( false, 'invalid' );
		} ).fail( function ( xhr, status ) {
			if ( 'abort' === status || sequence !== state.sequence ) {
				deferred.reject( 'stale' );
				return;
			}
			var response = xhr.responseJSON;
			var message = response && response.data && response.data.message ? response.data.message : config.validation_error;
			state.status = 'invalid';
			show_time_notice( $native, selection, message );
			deferred.resolve( false, 'invalid' );
		} );

		return state.promise;
	}

	/** Debounce validation after calendar or Start Time changes. */
	function schedule_time_validation( $native ) {
		var state = get_time_validation_state( $native );
		window.clearTimeout( state.timer );
		state.status = 'changed';
		clear_time_notice( $native );
		if ( ! is_time_selection_stage_active( get_time_selection( $native ) ) ) {
			return;
		}
		state.timer = window.setTimeout( function () {
			validate_time_selection( $native );
		}, 120 );
	}

	/** Block forward wizard navigation until the current time preflight passes. */
	function capture_wizard_navigation( event, $native ) {
		var $button = $( event.target ).closest( '.wpbc_wizard_step_button' );
		if ( ! $button.length || ! $.contains( $native.get( 0 ), $button.get( 0 ) ) ) {
			return;
		}
		if ( $button.get( 0 ).wpbc_appointment_preflight_bypass ) {
			$button.get( 0 ).wpbc_appointment_preflight_bypass = false;
			return;
		}

		var target_match = String( $button.attr( 'class' ) || '' ).match( /wpbc_wizard_step_(\d+)/ );
		var current_match = String( $button.closest( '.wpbc_wizard_step' ).attr( 'class' ) || '' ).match( /wpbc_wizard_step(\d+)/ );
		if ( ! target_match || ( current_match && Number( target_match[1] ) <= Number( current_match[1] ) ) ) {
			return;
		}

		var selection = get_time_selection( $native );
		var $current_step = $button.closest( '.wpbc_wizard_step' );
		var $time_step = selection.$start.closest( '.wpbc_wizard_step' );
		if ( $time_step.length && $current_step.length && $time_step.get( 0 ) !== $current_step.get( 0 ) ) {
			return;
		}
		if ( ! selection.complete ) {
			return;
		}
		var state = get_time_validation_state( $native );
		if ( selection.signature === state.signature && 'valid' === state.status ) {
			return;
		}

		event.preventDefault();
		event.stopImmediatePropagation();
		validate_time_selection( $native ).done( function ( valid ) {
			if ( valid && document.documentElement.contains( $button.get( 0 ) ) ) {
				$button.get( 0 ).wpbc_appointment_preflight_bypass = true;
				$button.get( 0 ).click();
			}
		} );
	}

	/** Attach isolated buffer preflight behavior to one native Appointment form. */
	function initialize_time_preflight( $native ) {
		if ( ! config.ajax_url || ! config.validate_action || ! $native.length ) {
			return;
		}
		var native_element = $native.get( 0 );
		if ( native_element.wpbc_appointment_time_preflight_ready ) {
			return;
		}
		native_element.wpbc_appointment_time_preflight_ready = true;
		native_element.addEventListener( 'click', function ( event ) {
			capture_wizard_navigation( event, $native );
		}, true );
		$native.on( 'change.wpbc_appointment_time_preflight', '[name^="starttime"]', function () {
			schedule_time_validation( $native );
		} );
		$native.on( 'date_selected.wpbc_appointment_time_preflight wpbc_hook_timeslots_disabled.wpbc_appointment_time_preflight', function ( event, provider_id ) {
			if ( Number( provider_id || 0 ) === Number( $native.data( 'provider-id' ) || 0 ) ) {
				schedule_available_start_times( $native );
				schedule_time_validation( $native );
			}
		} );
		schedule_available_start_times( $native );
	}

	/**
	 * Lock a native duration field to the selected Service duration.
	 *
	 * The core save handler independently derives duration from the Service row;
	 * this client step only keeps the visible form and serialized data aligned.
	 */
	function prepare_native_form( $scope ) {
		var $native = $scope.find( '.wpbc_booking_appointment__native_form' ).first();
		if ( ! $native.length ) {
			return true;
		}
		if ( ! register_native_form( $native ) ) {
			return false;
		}

		var resource_id = Number( $native.data( 'provider-id' ) || 0 );
		var duration = String( $native.data( 'duration' ) || '' );
		var field_name = 'durationtime' + resource_id;
		var $form = $native.find( '#booking_form' + resource_id );
		$form.find( '.wpbc_booking_appointment__duration_proxy' ).remove();
		var $duration_fields = $form.find( '[name="' + field_name + '"], [name="' + field_name + '[]"]' );
		var $derived_time_fields = $form.find( '[name="endtime' + resource_id + '"], [name="endtime' + resource_id + '[]"], [name="rangetime' + resource_id + '"], [name="rangetime' + resource_id + '[]"]' );

		$duration_fields.each( function () {
			var $field = $( this );
			if ( $field.is( 'select' ) && ! $field.find( 'option[value="' + duration.replace( /"/g, '\\"' ) + '"]' ).length ) {
				$field.append( $( '<option>', { value: duration, text: duration } ) );
			}
			$field.val( duration ).prop( 'disabled', true ).attr( 'aria-disabled', 'true' );
			$field.closest( '.wpdev-form-control-wrap' ).addClass( 'wpbc_booking_appointment__fixed_duration_field' );
		} );
		$derived_time_fields.each( function () {
			var $field = $( this );
			$field.prop( 'disabled', true ).attr( 'aria-disabled', 'true' );
			$field.closest( '.wpdev-form-control-wrap' ).addClass( 'wpbc_booking_appointment__fixed_duration_field' );
		} );

		if ( ! $duration_fields.length ) {
			var $duration_proxy = $( '<select>', {
				name: field_name,
				'class': 'wpbc_booking_appointment__duration_value',
				'aria-hidden': 'true',
				tabindex: '-1',
				'data-wpbc-appointment-generated': '1'
			} ).append( $( '<option>', { value: duration, text: duration, selected: true } ) );
			$form.append(
				$( '<span>', {
					'class': 'wpdev-form-control-wrap wpbc_booking_appointment__fixed_duration_field wpbc_booking_appointment__duration_proxy',
					'aria-hidden': 'true'
				} ).append( $duration_proxy )
			);
		}

		initialize_time_preflight( $native );

		return true;
	}

	/** Convert a script URL to the same absolute representation as DOM script.src. */
	function get_absolute_script_url( url ) {
		var anchor = document.createElement( 'a' );
		anchor.href = String( url || '' );
		return anchor.href;
	}

	/** Execute renderer scripts sequentially while the request still owns the stage. */
	function execute_scripts( scripts, owns_stage ) {
		var sequence = $.Deferred().resolve().promise();

		$.each( scripts, function ( index, script ) {
			sequence = sequence.then( function () {
				if ( ! owns_stage() ) {
					return rejected_stage( '' );
				}
				if ( script.src ) {
					var absolute_url = get_absolute_script_url( script.src );
					if ( loaded_script_urls[ absolute_url ] ) {
						return undefined;
					}
					return $.ajax( { url: absolute_url, dataType: 'script', cache: true } ).then( function () {
						loaded_script_urls[ absolute_url ] = true;
					} );
				}
				if ( script.code ) {
					$.globalEval( script.code );
				}
				return undefined;
			} );
		} );

		return sequence;
	}

	/** Initialize controls whose core handlers normally bind on document ready. */
	function initialize_ajax_form_controls() {
		if ( typeof window.wpbc_hook__init_booking_form_wizard_buttons === 'function' ) {
			window.wpbc_hook__init_booking_form_wizard_buttons();
		}
	}

	/** Destroy native calendar instances and unregister context before removal. */
	function cleanup_native_form( $root ) {
		$root.find( '.wpbc_booking_appointment__native_form' ).each( function () {
			var $native = $( this );
			var resource_id = Number( $native.data( 'provider-id' ) || 0 );
			var $calendar = $native.find( '#calendar_booking' + resource_id );

			unregister_native_form( $native );
			if ( ! resource_id || ! $calendar.length || ! $.datepick || typeof $calendar.datepick !== 'function' ) {
				return;
			}

			try {
				var instance = typeof $.datepick._getInst === 'function' ? $.datepick._getInst( $calendar.get( 0 ) ) : null;
				if ( instance ) {
					$calendar.datepick( 'destroy' );
				}
			} catch ( error ) {
				$calendar.removeClass( 'hasDatepick' );
			}
		} );
	}

	/** Restore the previously selected Service when navigating back one stage. */
	function restore_service_selection( $root ) {
		var service_id = Number( $root.attr( 'data-selected-service-id' ) || 0 );
		if ( ! service_id ) {
			return;
		}
		var $input = $root.find( '.wpbc_booking_appointment__selection_form [name="wpbc_appointment_service"][value="' + service_id + '"]' ).first();
		if ( $input.length ) {
			$input.prop( 'checked', true ).closest( '.wpbc_booking_appointment__choice' ).addClass( 'is-selected' );
		}
	}

	/** Focus the new stage heading without forcing motion for reduced-motion users. */
	function focus_stage( $root ) {
		var $target = $root.find( '> .wpbc_booking_appointment__stage .wpbc_booking_appointment__heading h3, > .wpbc_booking_appointment__stage .wpbc_booking_appointment__notice' ).first();
		if ( $target.length ) {
			$target.attr( 'tabindex', '-1' );
			try {
				$target.get( 0 ).focus( { preventScroll: true } );
			} catch ( error ) {
				$target.trigger( 'focus' );
			}
		}

		if ( $root.get( 0 ) && typeof $root.get( 0 ).scrollIntoView === 'function' ) {
			var reduce_motion = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
			$root.get( 0 ).scrollIntoView( { behavior: reduce_motion ? 'auto' : 'smooth', block: 'nearest' } );
		}
	}

	/** Return a rejected promise carrying one controlled initialization message. */
	function rejected_stage( message ) {
		var deferred = $.Deferred();
		deferred.reject( { wpbc_message: message } );
		return deferred.promise();
	}

	/** Replace a stage while guaranteeing DOM-before-script initialization order. */
	function replace_stage( $root, html, stage, provider_id, request_id ) {
		if ( ! is_current_request( $root, request_id ) ) {
			return rejected_stage( '' );
		}
		if ( 'booking' === stage && has_duplicate_provider_form( $root, provider_id ) ) {
			return rejected_stage( config.duplicate_provider );
		}

		var parsed = $.parseHTML( String( html || '' ), document, true ) || [];
		var scripts = [];
		var $container = $( '<div>' ).append( parsed );

		$container.find( 'script' ).addBack( 'script' ).each( function () {
			scripts.push( { src: this.src || '', code: this.src ? '' : ( this.text || this.textContent || '' ) } );
			$( this ).remove();
		} );

		cleanup_native_form( $root );
		$root.attr( 'data-appointment-stage', stage );
		$root.find( '> .wpbc_booking_appointment__stage' ).empty().append( $container.contents() );

		if ( ! prepare_native_form( $root ) ) {
			cleanup_native_form( $root );
			$root.find( '.wpbc_booking_appointment__native_form :input' ).prop( 'disabled', true );
			return rejected_stage( config.initialization_error || config.error );
		}

		return execute_scripts( scripts, function () {
			return is_current_request( $root, request_id );
		} ).then( function () {
			if ( ! is_current_request( $root, request_id ) ) {
				return rejected_stage( '' );
			}
			initialize_ajax_form_controls();
			if ( 'service' === stage ) {
				restore_service_selection( $root );
			}
		} );
	}

	/** Determine whether an AJAX callback still owns the component state. */
	function is_current_request( $root, request_id ) {
		return Number( $root.data( 'wpbc-appointment-request-id' ) || 0 ) === Number( request_id );
	}

	/** Finish only the current request so stale callbacks cannot alter the UI. */
	function finish_request( $root, request_id ) {
		if ( ! is_current_request( $root, request_id ) ) {
			return;
		}
		$root.removeData( 'wpbc-appointment-request' );
		set_loading( $root, false );
	}

	/** Request and render the next Appointment workflow stage. */
	function resolve_stage( $root, service_id, provider_id ) {
		if ( ! $root || ! $root.length ) {
			return;
		}

		service_id = Number( service_id || 0 );
		provider_id = Number( provider_id || 0 );
		if ( service_id ) {
			$root.attr( 'data-selected-service-id', service_id );
		}
		if ( provider_id ) {
			$root.attr( 'data-selected-provider-id', provider_id );
		}

		var previous_request = $root.data( 'wpbc-appointment-request' );
		var request_id = Number( $root.data( 'wpbc-appointment-request-id' ) || 0 ) + 1;
		$root.data( 'wpbc-appointment-request-id', request_id );
		if ( previous_request && previous_request.readyState !== 4 ) {
			previous_request.abort();
		}

		clear_error( $root );
		set_loading( $root, true );
		var request = $.post( config.ajax_url, {
			action: config.action,
			nonce: config.nonce,
			config_token: $root.attr( 'data-config-token' ) || '',
			service_id: service_id,
			provider_id: provider_id
		} );
		$root.data( 'wpbc-appointment-request', request );

		request.done( function ( response ) {
			if ( ! is_current_request( $root, request_id ) ) {
				return;
			}
			if ( ! response || ! response.success || ! response.data ) {
				show_error(
					$root,
					response && response.data && response.data.message ? response.data.message : config.error,
					response && response.data ? response.data.action_url : '',
					response && response.data ? response.data.action_label : ''
				);
				finish_request( $root, request_id );
				return;
			}

			var stage = response.data.stage || '';
			var replacement = replace_stage( $root, response.data.html, stage, response.data.provider_id, request_id );
			replacement.done( function () {
				if ( ! is_current_request( $root, request_id ) ) {
					return;
				}
				if ( Number( response.data.service_id || 0 ) ) {
					$root.attr( 'data-selected-service-id', Number( response.data.service_id ) );
				}
				if ( Number( response.data.provider_id || 0 ) ) {
					$root.attr( 'data-selected-provider-id', Number( response.data.provider_id ) );
				}
				finish_request( $root, request_id );
				focus_stage( $root );
			} ).fail( function ( error ) {
				if ( ! is_current_request( $root, request_id ) ) {
					return;
				}
				var message = error && error.wpbc_message ? error.wpbc_message : ( config.initialization_error || config.error );
				show_error( $root, message );
				finish_request( $root, request_id );
			} );
		} ).fail( function ( xhr, status ) {
			if ( 'abort' === status || ! is_current_request( $root, request_id ) ) {
				return;
			}
			var response = xhr.responseJSON;
			show_error(
				$root,
				response && response.data && response.data.message ? response.data.message : config.error,
				response && response.data ? response.data.action_url : '',
				response && response.data ? response.data.action_label : ''
			);
			finish_request( $root, request_id );
		} );
	}

	/** Handle Service and Provider fallback forms through AJAX. */
	$( document ).on( 'submit', '.wpbc_booking_appointment__selection_form', function ( event ) {
		if ( ! config.ajax_url || ! config.action ) {
			return;
		}
		event.preventDefault();
		var $form = $( this );
		var $root = $form.closest( '.wpbc_booking_appointment' );
		resolve_stage( $root, get_selected_id( $form, 'wpbc_appointment_service' ), get_selected_id( $form, 'wpbc_appointment_provider' ) );
	} );

	/** Keep plate selection styling independent from CSS :has() support. */
	$( document ).on( 'change', '.wpbc_booking_appointment__choice > input', function () {
		var $input = $( this );
		$input.closest( '.wpbc_booking_appointment__choices' ).find( '.wpbc_booking_appointment__choice' ).removeClass( 'is-selected' );
		$input.closest( '.wpbc_booking_appointment__choice' ).addClass( 'is-selected' );
	} );

	/** Return to Service selection while preserving the last valid Service. */
	$( document ).on( 'click', '.wpbc_booking_appointment [data-appointment-back="service"]', function () {
		var $root = $( this ).closest( '.wpbc_booking_appointment' );
		if ( $root.hasClass( 'is-loading' ) ) {
			return;
		}
		resolve_stage( $root, 0, 0 );
	} );

	/** Return to the first selectable Appointment stage without reloading the page. */
	$( document ).on( 'click', '.wpbc_booking_appointment [data-wpbc-appointment-action="start-over"], .wpbc_booking_appointment .wpbc_booking_appointment__change', function ( event ) {
		if ( ! config.ajax_url || ! config.action ) {
			return;
		}
		event.preventDefault();
		var $root = $( this ).closest( '.wpbc_booking_appointment' );
		if ( $root.hasClass( 'is-loading' ) ) {
			return;
		}
		$root.removeAttr( 'data-selected-service-id data-selected-provider-id' );
		resolve_stage( $root, 0, 0 );
	} );

	/** Add the registered signed and server-authorized context to the core booking request. */
	$( 'body' ).on( 'wpbc_before_booking_create.wpbc_booking_appointment', function ( event, resource_id, params ) {
		var context = get_native_context( resource_id );
		if ( ! context ) {
			return;
		}
		params.service_id = context.service_id;
		params.appointment_service_required = 1;
		params.appointment_context_token = context.context_token;
		params.allow_past = context.allow_past;
	} );

	/** Add the signed Appointment pair to the existing live-cost request. */
	$( document ).on( 'wpbc_before_cost_request.wpbc_booking_appointment', function ( event, resource_id, params ) {
		var context = get_native_context( resource_id );
		if ( ! context || ! params ) {
			return;
		}
		params.appointment_service_id = context.service_id;
		params.appointment_context_token = context.context_token;
	} );

	$( function () {
		$( '.wpbc_booking_appointment' ).each( function () {
			var $root = $( this );
			var $native = $root.find( '.wpbc_booking_appointment__native_form' ).first();
			if ( $native.length ) {
				$root.attr( 'data-selected-service-id', Number( $native.data( 'service-id' ) || 0 ) );
				$root.attr( 'data-selected-provider-id', Number( $native.data( 'provider-id' ) || 0 ) );
			}
			if ( ! prepare_native_form( $root ) ) {
				var duplicate = $native.length && has_duplicate_provider_form( $root, Number( $native.data( 'provider-id' ) || 0 ) );
				cleanup_native_form( $root );
				$root.find( '.wpbc_booking_appointment__native_form :input' ).prop( 'disabled', true );
				show_error( $root, duplicate ? config.duplicate_provider : config.initialization_error );
			}
		} );
	} );
} )( window, jQuery );

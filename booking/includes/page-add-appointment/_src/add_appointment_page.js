/** Add Appointment administrator inspector and non-submitting helper tools. */
( function ( $ ) {
	'use strict';

	var summary_timer = 0;
	var labels = window.wpbc_add_appointment_page_config || {};

	/** Apply the administrator page context before any Provider calendar loads. */
	function apply_booking_context() {
		if ( 'undefined' === typeof window._wpbc ) {
			return;
		}

		window._wpbc.set_other_param( 'this_page_booking_hash', '' );
		window._wpbc.set_other_param( 'this_page_allow_past', labels.allowPast ? 1 : 0 );
		window._wpbc.set_other_param( 'this_page_allow_past_arr', labels.allowPastDateArr || [] );
	}

	/** Switch one shared right-sidebar panel. */
	function switch_right_panel( $tab ) {
		var panel_id = $tab.attr( 'aria-controls' );
		var $tabs = $tab.closest( '.wpbc_add_appointment__rightbar_tabs' ).find( '[role="tab"]' );
		var $panels = $( '.wpbc_add_appointment__rightbar' ).find( '[role="tabpanel"]' );

		$tabs.attr( 'aria-selected', 'false' );
		$tab.attr( 'aria-selected', 'true' );
		$panels.attr( { hidden: true, 'aria-hidden': 'true' } );
		$( '#' + panel_id ).removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
	}

	/** Return trimmed visible text from the first matching element. */
	function get_text( $root, selector ) {
		return String( $root.find( selector ).first().text() || '' ).replace( /\s+/g, ' ' ).trim();
	}

	/** Return the display value of one native Booking Form field. */
	function get_field_value( $field ) {
		var value;

		if ( ! $field.length ) {
			return '';
		}
		if ( $field.is( 'select' ) ) {
			value = $field.find( 'option:selected' ).text();
		} else {
			value = $field.val();
		}

		return String( value || '' ).replace( /\s+/g, ' ' ).trim();
	}

	/** Update one summary value and its empty-state presentation. */
	function set_summary_value( key, value ) {
		var $target = $( '[data-wpbc-add-appointment-summary="' + key + '"]' );
		var is_empty = '' === String( value || '' ).trim();

		$target.text( is_empty ? ( labels.emptyLabel || 'Not selected' ) : value );
		$target.toggleClass( 'is-empty', is_empty );
	}

	/**
	 * Expand one Settings inspector group through the shared collapsible API.
	 *
	 * @param {string} group_name Group data key.
	 * @param {string} focus_selector Optional control to focus after expansion.
	 * @return {void}
	 */
	function open_inspector_group( group_name, focus_selector ) {
		var $group = $( '.wpbc_add_appointment__inspector_overview .wpbc_ui__collapsible_group[data-group="' + group_name + '"]' ).first();
		var root;
		var api;

		if ( ! $group.length ) {
			return;
		}

		root = $group.closest( '.wpbc_collapsible' ).get( 0 );
		api = root && root.__wpbc_collapsible_instance;

		if ( api && 'function' === typeof api.expand ) {
			api.expand( $group.get( 0 ) );
		} else {
			$group.siblings( '.wpbc_ui__collapsible_group' ).each( function () {
				var $sibling = $( this );
				$sibling.removeClass( 'is-open' );
				$sibling.children( '.group__header' ).attr( 'aria-expanded', 'false' );
				$sibling.children( '.group__fields' ).attr( { hidden: true, 'aria-hidden': 'true' } );
			} );
			$group.addClass( 'is-open' );
			$group.children( '.group__header' ).attr( 'aria-expanded', 'true' );
			$group.children( '.group__fields' ).removeAttr( 'hidden' ).attr( 'aria-hidden', 'false' );
		}

		window.requestAnimationFrame( function () {
			$group.get( 0 ).scrollIntoView( { behavior: 'smooth', block: 'start' } );
			if ( focus_selector ) {
				window.setTimeout( function () {
					$( focus_selector ).first().trigger( 'focus' );
				}, 250 );
			}
		} );
	}

	/** Format the effective before/after Service buffers. */
	function get_buffer_summary( $source ) {
		var before = $source.attr( 'data-buffer-before' );
		var after = $source.attr( 'data-buffer-after' );

		if ( 'undefined' === typeof before ) {
			before = $source.attr( 'data-summary-buffer-before' );
			after = $source.attr( 'data-summary-buffer-after' );
		}
		if ( 'undefined' === typeof before || 'undefined' === typeof after ) {
			return '';
		}

		return String( before ) + ' / ' + String( after ) + ' ' + ( labels.minutesLabel || 'min' );
	}

	/** Read the most useful customer identity from the loaded Booking Form. */
	function get_customer_summary( $form ) {
		var first = get_field_value( $form.find( '[name^="firstname"]' ).first() );
		var last = get_field_value( $form.find( '[name^="secondname"], [name^="lastname"]' ).first() );
		var email = get_field_value( $form.find( '[name^="email"]' ).first() );
		var name = String( first + ' ' + last ).trim();

		return name || email;
	}

	/** Mirror live Appointment and native Booking Form values into the inspector. */
	function refresh_summary() {
		var $root = $( '.wpbc_add_appointment__canvas .wpbc_booking_appointment' ).first();
		var $native = $root.find( '.wpbc_booking_appointment__native_form' ).first();
		var $form = $native.find( 'form' ).first();
		var $service = $root.find( 'input[name="wpbc_appointment_service"]:checked' ).closest( '.wpbc_booking_appointment__choice' );
		var $provider = $root.find( 'input[name="wpbc_appointment_provider"]:checked' ).closest( '.wpbc_booking_appointment__choice' );
		var $selected = $root.find( '.wpbc_booking_appointment__selected' ).first();
		var $detail_source = $provider.length ? $provider : ( $service.length ? $service : $selected );
		var stage = $root.attr( 'data-appointment-stage' ) || 'service';
		var step = get_text( $root, '.wpbc_booking_appointment__progress_step.is-active .wpbc_booking_appointment__progress_label' );
		var service = $service.attr( 'data-summary-service' ) || $selected.attr( 'data-summary-service' ) || '';
		var provider = $provider.attr( 'data-summary-provider' ) || '';
		var duration = $detail_source.attr( 'data-summary-duration' ) || '';
		var price = $detail_source.attr( 'data-summary-price' ) || '';

		if ( $native.length ) {
			service = $native.attr( 'data-service-title' ) || service;
			provider = $native.attr( 'data-provider-title' ) || provider;
			duration = $native.attr( 'data-duration-label' ) || duration;
			price = $native.attr( 'data-service-cost-label' ) || price;
			$detail_source = $native;
		}

		set_summary_value( 'step', step || stage );
		set_summary_value( 'service', service );
		set_summary_value( 'provider', provider );
		set_summary_value( 'duration', duration );
		set_summary_value( 'buffers', get_buffer_summary( $detail_source ) );
		set_summary_value( 'price', price );
		set_summary_value( 'date', get_field_value( $form.find( '[id^="date_booking"]' ).first() ) );
		set_summary_value( 'time', get_field_value( $form.find( '[name^="starttime"]' ).first() ) );
		set_summary_value( 'customer', get_customer_summary( $form ) );
		set_summary_value( 'form', $native.attr( 'data-form-slug' ) || '' );
		set_summary_value( 'emails', $( '#is_send_email_for_pending' ).is( ':checked' ) ? ( labels.enabledLabel || 'Enabled' ) : ( labels.disabledLabel || 'Disabled' ) );
		$( '[data-wpbc-add-appointment-start-over]' ).prop( 'hidden', 'service' === stage );
		$( '[data-wpbc-add-appointment-autofill]' ).prop( 'disabled', ! $form.length );
	}

	/** Debounce summary work during large AJAX Booking Form DOM insertions. */
	function schedule_summary_refresh() {
		window.clearTimeout( summary_timer );
		summary_timer = window.setTimeout( refresh_summary, 20 );
	}

	/** Fill sample customer fields in the current form without submitting it. */
	function auto_fill_booking_form() {
		var $form = $( '.wpbc_add_appointment__canvas .wpbc_booking_appointment__native_form form' ).first();

		if ( ! $form.length ) {
			return;
		}

		$form.find( 'input, textarea, select' ).each( function () {
			var $field = $( this );
			var name = String( $field.attr( 'name' ) || '' ).toLowerCase();
			var type = String( $field.attr( 'type' ) || '' ).toLowerCase();
			var ignored = /date_booking|starttime|endtime|durationtime|rangetime|captcha|coupon|service_id|appointment_/.test( name );
			var value = '';

			if ( ignored || $field.is( ':disabled' ) || 'hidden' === type || 'button' === type || 'submit' === type || 'radio' === type ) {
				return;
			}
			if ( 'checkbox' === type ) {
				if ( $field.prop( 'required' ) ) {
					$field.prop( 'checked', true ).trigger( 'change' );
				}
				return;
			}
			if ( $field.is( 'select' ) ) {
				if ( ! $field.val() ) {
					var $option = $field.find( 'option:not(:disabled)' ).filter( function () {
						return '' !== String( $( this ).val() || '' );
					} ).first();
					if ( $option.length ) {
						$field.val( $option.val() ).trigger( 'change' );
					}
				}
				return;
			}
			if ( /^firstname/.test( name ) ) {
				value = 'John';
			} else if ( /^(secondname|lastname)/.test( name ) ) {
				value = 'Smith';
			} else if ( /^email/.test( name ) || 'email' === type ) {
				value = 'blank@wpbookingmanager.com';
			} else if ( /^phone/.test( name ) || 'tel' === type ) {
				value = '0000000000';
			} else if ( $field.is( 'textarea' ) ) {
				value = '---';
			}

			if ( value && ! $field.val() ) {
				$field.val( value ).trigger( 'input' ).trigger( 'change' );
			}
		} );

		schedule_summary_refresh();
	}

	/** Copy the authoritative Appointment correction into its convenience slider. */
	function synchronize_cost_correction_range() {
		var $number_field = $( '#wpbc_add_appointment_cost_correction' );
		var $range = $( '[data-wpbc-admin-cost-correction-range="1"]' ).first();
		var number_value;

		if ( ! $number_field.length || ! $range.length ) {
			return;
		}

		number_value = Number( $number_field.val() );
		if ( '' === String( $number_field.val() || '' ).trim() || ! isFinite( number_value ) ) {
			$range.val( '0' );
			return;
		}

		$range.val( String( number_value ) );
	}

	/** Copy the convenience slider into the authoritative Appointment number input. */
	function synchronize_cost_correction_number() {
		var $number_field = $( '#wpbc_add_appointment_cost_correction' );
		var $range = $( '[data-wpbc-admin-cost-correction-range="1"]' ).first();

		if ( ! $number_field.length || ! $range.length ) {
			return;
		}

		$number_field.val( $range.val() ).trigger( 'input' );
	}

	/** Clear an unsaved or successfully submitted Appointment correction draft. */
	function clear_cost_correction() {
		var $number_field = $( '#wpbc_add_appointment_cost_correction' );

		if ( ! $number_field.length ) {
			return;
		}

		$number_field.val( '' );
		synchronize_cost_correction_range();
	}

	/**
	 * Add an explicitly entered correction to the active Appointment request.
	 *
	 * The inspector is outside the AJAX-inserted native Booking Form. Requiring
	 * the submitted Provider to match the active Appointment form prevents this
	 * page-only draft from affecting an unrelated booking-create event.
	 *
	 * @param {Event} event jQuery event.
	 * @param {number} resource_id Submitted Provider resource ID.
	 * @param {Object} params Mutable booking-create request parameters.
	 * @return {void}
	 */
	function add_cost_correction_to_appointment_request( event, resource_id, params ) {
		var number_field = document.getElementById( 'wpbc_add_appointment_cost_correction' );
		var $native_form = $( '.wpbc_add_appointment__canvas .wpbc_booking_appointment__native_form[data-provider-id="' + Number( resource_id || 0 ) + '"]' ).first();
		var raw_cost;

		if ( ! params || ! number_field || ! $native_form.length ) {
			return;
		}

		delete params.wpbc_admin_cost_correction;
		raw_cost = String( number_field.value || '' ).trim();
		if ( '' === raw_cost || ! number_field.checkValidity() ) {
			return;
		}

		params.wpbc_admin_cost_correction = raw_cost;
	}

	$( document ).on( 'click', '.wpbc_add_appointment__rightbar_tabs [role="tab"]', function ( event ) {
		event.preventDefault();
		switch_right_panel( $( this ) );
	} );

	$( document ).on( 'click', '[data-wpbc-add-appointment-start-over]', function () {
		clear_cost_correction();
		var $action = $( '.wpbc_add_appointment__canvas [data-wpbc-appointment-action="start-over"]' ).first();
		if ( ! $action.length ) {
			$action = $( '.wpbc_add_appointment__canvas [data-appointment-back="service"]' ).first();
		}
		if ( $action.length ) {
			$action.trigger( 'click' );
		}
	} );
	$( document ).on( 'click', '.wpbc_add_appointment__canvas [data-wpbc-appointment-action="start-over"]', clear_cost_correction );

	$( document ).on( 'click', '[data-wpbc-add-appointment-open-group]', function ( event ) {
		event.preventDefault();
		open_inspector_group( $( this ).attr( 'data-wpbc-add-appointment-open-group' ), $( this ).attr( 'data-wpbc-add-appointment-focus' ) || '' );
	} );

	$( document ).on( 'click', '[data-wpbc-add-appointment-autofill]', auto_fill_booking_form );
	$( document ).on( 'input change wpbc_booking_date_or_option_selected', '.wpbc_add_appointment__canvas, #is_send_email_for_pending', schedule_summary_refresh );
	$( document ).on( 'input', '#wpbc_add_appointment_cost_correction', synchronize_cost_correction_range );
	$( document ).on( 'input', '.wpbc_add_appointment__cost_correction [data-wpbc-admin-cost-correction-range="1"]', synchronize_cost_correction_number );
	$( 'body' ).on( 'wpbc_before_booking_create.wpbc_add_appointment_cost_correction', add_cost_correction_to_appointment_request );
	$( 'body' ).on( 'wpbc_booking_form_submit_success.wpbc_add_appointment_cost_correction', clear_cost_correction );

	$( function () {
		var stage = document.querySelector( '.wpbc_add_appointment__canvas .wpbc_booking_appointment__stage' );
		apply_booking_context();
		refresh_summary();
		synchronize_cost_correction_range();
		if ( stage && window.MutationObserver ) {
			new MutationObserver( schedule_summary_refresh ).observe( stage, { childList: true, subtree: true } );
		}
	} );
} )( jQuery );

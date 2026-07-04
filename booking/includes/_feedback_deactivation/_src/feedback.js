/**
 * global wpbc_plugins_params
 */
jQuery(
	function ($) {
		var wpbc_deactivation_feedback = {
			init: function () {
				this.event_init();
			},
			event_init: function () {
				var _that = this;

				$( document.body ).on(
					"click",
					'tr[data-plugin="booking/wpdev-booking.php"] span.deactivate a',
					function (e) {
						e.preventDefault();
						$( "#wpbc_deactivate-feedback-popup-wrapper" ).addClass( 'active' );
					}
				);

				$( document.body ).on(
					"click",
					'tr[data-plugin="booking-calendar-com/booking-calendar-com.php"] span.deactivate a',
					function (e) {
						e.preventDefault();
						$( '#wpbc_deactivate-feedback-popup-wrapper' ).addClass( 'active' );
					}
				);

				$( "#wpbc_deactivate-feedback-popup-wrapper" ).click(
					function (event) {
						var $target = $( event.target );
						if ( ! $target.closest( ".wpbc_deactivate-feedback-popup-inner" ).length ) {
							$( "#wpbc_deactivate-feedback-popup-wrapper" ).removeClass(
								"active"
							);
						}
					}
				);

				$( "form.wpbc_deactivate-feedback-form" ).on(
					'submit',
					function (e) {
						e.preventDefault();
						_that.send_data( $( this ) );
					}
				);

				$( '#wpbc_deactivate-feedback-popup-wrapper' ).on(
					'click',
					'.close-deactivate-feedback-popup',
					function () {
						$( '#wpbc_deactivate-feedback-popup-wrapper' ).removeClass( 'active' );
					}
				);

				$( 'input.wpbc_deactivate-feedback-input' ).on(
					'click',
					function () {
						_that.set_more_details_state( jQuery( "form.wpbc_deactivate-feedback-form" ) );
					}
				);

				$( '#wpbc_deactivate-feedback-popup-wrapper' ).on(
					'input',
					'.feedback-textarea',
					function () {
						if ( '' !== jQuery.trim( jQuery( this ).val() ) ) {
							_that.clear_more_details_error( jQuery( this ).closest( 'form.wpbc_deactivate-feedback-form' ) );
						}
					}
				);
			},
			set_more_details_state: function (form) {
				var has_selected_reason = form.find( 'input[name="reason_slug"]:checked' ).length > 0;
				var details_wrap        = form.find( '.wpbc_deactivate-feedback-popup-form-more-details' );
				var details_field       = details_wrap.find( '.feedback-textarea' );

				if ( has_selected_reason ) {
					details_wrap.show();
					details_field.prop( 'required', true );
					form.find( '.wpbc_deactivate-feedback-popup-form-footer .skip' ).hide();
				} else {
					details_wrap.hide();
					details_field.prop( 'required', false ).val( '' );
					form.find( '.wpbc_deactivate-feedback-popup-form-footer .skip' ).show();
					this.clear_more_details_error( form );
				}
			},
			clear_more_details_error: function (form) {
				form.find( '.feedback-textarea' ).attr( 'aria-invalid', 'false' );
				form.find( '.wpbc_deactivate-feedback-more-details-error' ).hide();
			},
			show_more_details_error: function (form, message) {
				var details_field = form.find( '.feedback-textarea' );
				form.find( '.wpbc_deactivate-feedback-more-details-error' ).text( message ).show();
				details_field.attr( 'aria-invalid', 'true' ).trigger( 'focus' );
			},
			validate_more_details: function (form) {
				var details_wrap  = form.find( '.wpbc_deactivate-feedback-popup-form-more-details' );
				var details_field = details_wrap.find( '.feedback-textarea' );
				var message       = (
					'undefined' !== typeof wpbc_plugins_params &&
					'undefined' !== typeof wpbc_plugins_params.more_details_required_text
					) ? wpbc_plugins_params.more_details_required_text : 'Please share more details before submitting.';

				if ( details_wrap.is( ':visible' ) && '' === jQuery.trim( details_field.val() ) ) {
					this.show_more_details_error( form, message );
					return false;
				}

				this.clear_more_details_error( form );
				return true;
			},
			enable_submit: function (form) {
				form.find( "button.submit" ).removeClass( "button-disabled button updating-message" );
			},
			send_data: function (form) {
				var reason_slug = form.find( 'input[name="reason_slug"]:checked' ).map(
					function () {
						return jQuery( this ).val();
					}
				).get().join( ' | ' );

				if ( 0 === jQuery( "form.wpbc_deactivate-feedback-form" ).find( 'input[name="reason_slug"]:checked' ).length ) {
					alert( "Please select at least one option from the list" );
					return;
				}

				if ( ! this.validate_more_details( form ) ) {
					return;
				}

				if ( form.find( "button.submit" ).hasClass( "button-disabled" ) ) {
					return;
				}

				var reason_text    = '';
				var reason_text_el = form.find(
					'input[name="reason_' + reason_slug + '"]'
				);

				if (reason_text_el.length > 0) {
					reason_text = reason_text_el.val();
				}

				var data = {
					reason_slug: "user_registration_deactivation_notice",
				};

				data["reason_" + reason_slug] = reason_text;

				var values_arr = {};
				jQuery.each(
					form.serializeArray(),
					function (i, field) {
						if ( 'undefined' === typeof (values_arr[field.name]) ) {
							values_arr[field.name] = field.value;
						} else {
							values_arr[field.name] += ' | ' + field.value;
						}
					}
				);

				$.ajax(
					{
						url       : wpbc_plugins_params.ajax_url,
						data      : values_arr,
						type      : "post",
						beforeSend: function () {
							form.find( "button.submit" ).addClass(
								"button-disabled button updating-message"
							);
						},
					}
				).done(
					function (response) {
						if ( response && response.success ) {
							window.location = form.find( "a.skip" ).attr( "href" );
							return;
						}

						_that.enable_submit( form );
						_that.show_more_details_error(
							form,
							response && response.data && response.data.message ? response.data.message : 'Please share more details before submitting.'
						);
					}
				).fail(
					function () {
						_that.enable_submit( form );
					}
				);
			},
		};

		wpbc_deactivation_feedback.init();
	}
);

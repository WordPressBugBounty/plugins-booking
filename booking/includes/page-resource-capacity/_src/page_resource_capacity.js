/**
 * Capacity Rules page behavior.
 *
 * @package Booking Calendar
 */

( function ( $ ) {
	'use strict';

	$( function () {
		var i18n = ( window.wpbc_resource_capacity_page && window.wpbc_resource_capacity_page.i18n ) || {};
		var $pendingDays = $( '#set_gen_booking_is_show_pending_days_as_available' );
		var $autoCancel = $( '#set_gen_booking_auto_cancel_pending_bookings_for_approved_date' );
		var $alwaysAvailable = $( '#set_gen_booking_is_days_always_available' );
		var $quantityControl = $( '#set_gen_booking_quantity_control' );

		function syncPendingDaysSubSettings() {
			$( '.wpbc_pending_days_as_available_sub_settings' ).toggleClass( 'hidden_items', ! $pendingDays.is( ':checked' ) );
		}

		function syncCapacityFieldSettings() {
			$( '.wpbc_booking_capacity_field_settings' ).toggleClass( 'hidden_items', ! $quantityControl.is( ':checked' ) );
		}

		syncPendingDaysSubSettings();
		syncCapacityFieldSettings();

		$pendingDays.on( 'change', function () {
			if ( this.checked ) {
				$alwaysAvailable.prop( 'checked', false );
			}
			syncPendingDaysSubSettings();
		} );

		$autoCancel.on( 'change', function () {
			if ( this.checked && ! window.confirm( i18n.auto_cancel_warning || '' ) ) {
				this.checked = false;
			}
		} );

		$quantityControl.on( 'change', function () {
			if ( this.checked ) {
				$alwaysAvailable.prop( 'checked', false );
			}
			syncCapacityFieldSettings();
		} );

		$alwaysAvailable.on( 'change', function () {
			if ( ! this.checked ) {
				return;
			}

			if ( ! window.confirm( i18n.always_available_warning || '' ) ) {
				this.checked = false;
				return;
			}

			$quantityControl.prop( 'checked', false );
			$pendingDays.prop( 'checked', false );
			syncCapacityFieldSettings();
			syncPendingDaysSubSettings();
		} );
	} );
}( jQuery ) );

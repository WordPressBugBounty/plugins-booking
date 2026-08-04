/**
 * Reusable Chosen filter behavior for Booking Calendar administration pages.
 *
 * @package Booking Calendar
 */
( function ( $, window, document ) {
	'use strict';

	/**
	 * Decode a JSON data attribute without allowing malformed configuration to stop the page.
	 *
	 * @param {string|null} encoded_value JSON attribute value.
	 * @param {*}           fallback_value Value returned when parsing fails.
	 * @return {*} Parsed value or the supplied fallback.
	 */
	function wpbc_ui_chosen_filter_parse_json( encoded_value, fallback_value ) {
		if ( null === encoded_value || '' === encoded_value ) {
			return fallback_value;
		}

		try {
			return JSON.parse( encoded_value );
		} catch ( error ) {
			return fallback_value;
		}
	}

	/**
	 * Return the current select values as an array of strings.
	 *
	 * @param {jQuery} $select Chosen source select.
	 * @return {Array<string>} Selected values.
	 */
	function wpbc_ui_chosen_filter_get_values( $select ) {
		var selected_value = $select.val();

		if ( null === selected_value || '' === selected_value ) {
			return [];
		}

		return Array.isArray( selected_value ) ? selected_value.map( String ) : [ String( selected_value ) ];
	}

	/**
	 * Select only the supplied values in the native select and refresh Chosen.
	 *
	 * @param {jQuery}        $select         Chosen source select.
	 * @param {Array<string>} selected_values Values that should remain selected.
	 * @return {void}
	 */
	function wpbc_ui_chosen_filter_set_values( $select, selected_values ) {
		$select.find( 'option' ).prop( 'selected', false );
		$select.find( 'option' ).each( function () {
			if ( -1 !== selected_values.indexOf( String( this.value ) ) ) {
				jQuery( this ).prop( 'selected', true );
			}
		} );
		$select.trigger( 'chosen:updated' );
	}

	/**
	 * Enforce values such as "All Providers" that cannot coexist with other choices.
	 *
	 * @param {jQuery} $select Chosen source select.
	 * @return {void}
	 */
	function wpbc_ui_chosen_filter_enforce_exclusive_value( $select ) {
		var selected_values  = wpbc_ui_chosen_filter_get_values( $select );
		var exclusive_values = wpbc_ui_chosen_filter_parse_json( $select.attr( 'data-wpbc-chosen-exclusive-values' ), [] );
		var retained_value    = '';

		exclusive_values = Array.isArray( exclusive_values ) ? exclusive_values.map( String ) : [];

		if ( selected_values.length < 2 || ! exclusive_values.length ) {
			return;
		}

		$.each( exclusive_values, function ( index, exclusive_value ) {
			if ( '' === retained_value && -1 !== selected_values.indexOf( exclusive_value ) ) {
				retained_value = exclusive_value;
			}
		} );
		if ( '' === retained_value ) {
			return;
		}

		wpbc_ui_chosen_filter_set_values( $select, [ retained_value ] );
		if ( 'function' === typeof window.wpbc_admin_show_message ) {
			var warning_message = $select.attr( 'data-wpbc-chosen-exclusive-message' ) || '';
			if ( warning_message ) {
				window.wpbc_admin_show_message( warning_message, 'warning', 10000 );
			}
		}
	}

	/**
	 * Initialize every uninitialized Chosen filter in a DOM scope.
	 *
	 * @param {Document|Element|jQuery} scope DOM scope containing filters.
	 * @return {void}
	 */
	function wpbc_ui_chosen_filters_init( scope ) {
		var $scope   = $( scope || document );
		var $selects = $scope.find( 'select[data-wpbc-chosen-filter="1"]' );

		if ( $scope.is( 'select[data-wpbc-chosen-filter="1"]' ) ) {
			$selects = $selects.add( $scope );
		}

		$selects.each( function () {
			var $select = $( this );
			if ( $select.data( 'wpbc-chosen-filter-ready' ) ) {
				return;
			}

			$select.data( 'wpbc-chosen-filter-ready', true );
			$select.on( 'change.wpbcUiChosenFilter', function () {
				wpbc_ui_chosen_filter_enforce_exclusive_value( $select );
			} );

			if ( 'function' === typeof $select.chosen ) {
				$select.chosen( {
					no_results_text: $select.attr( 'data-wpbc-chosen-no-results-text' ) || 'No results matched'
				} );
				$select.next( '.chzn-container' ).attr( 'tabindex', '0' );
				if ( ! $select.prop( 'disabled' ) ) {
					$select.closest( '[data-wpbc-chosen-filter-container]' ).find( '.wpbc_ui_el__choosen_reset_buttons' ).css( 'display', 'flex' );
				}
			}
		} );
	}

	/**
	 * Clear one Chosen filter and notify its owning page through the native change event.
	 *
	 * @param {string|Element|jQuery} select_reference Select selector, element, or jQuery object.
	 * @return {void}
	 */
	function wpbc_ui_chosen_filter_clear( select_reference ) {
		var $select             = $( select_reference );
		var clear_selected_values;

		if ( ! $select.length ) {
			return;
		}

		clear_selected_values = wpbc_ui_chosen_filter_parse_json( $select.attr( 'data-wpbc-chosen-clear-values' ), [] );
		clear_selected_values = Array.isArray( clear_selected_values ) ? clear_selected_values.map( String ) : [];
		wpbc_ui_chosen_filter_set_values( $select, clear_selected_values );
		$select.trigger( 'change' );
	}

	/**
	 * Normalize a Chosen filter value for the Booking Listing request object.
	 *
	 * @param {Element|jQuery} select_reference Select element or jQuery object.
	 * @return {*} Scalar or array expected by the configured listing request rule.
	 */
	function wpbc_ui_chosen_filter_get_request_value( select_reference ) {
		var $select         = $( select_reference );
		var selected_values = wpbc_ui_chosen_filter_get_values( $select );
		var value_type      = $select.attr( 'data-wpbc-listing-filter-value-type' ) || 'string';
		var empty_value;

		if ( ! selected_values.length ) {
			empty_value = wpbc_ui_chosen_filter_parse_json( $select.attr( 'data-wpbc-listing-filter-empty-value' ), '' );
			return empty_value;
		}

		if ( 'integer' === value_type ) {
			return parseInt( selected_values[ 0 ], 10 ) || 0;
		}
		if ( 'integer_array' === value_type ) {
			return selected_values.map( function ( selected_value ) {
				return parseInt( selected_value, 10 ) || 0;
			} ).filter( function ( selected_value ) {
				return selected_value > 0;
			} );
		}
		if ( 'digit_or_csd_array' === value_type ) {
			return selected_values;
		}

		return $select.prop( 'multiple' ) ? selected_values : selected_values[ 0 ];
	}

	$( document ).on( 'click.wpbcUiChosenFilter', '[data-wpbc-chosen-clear]', function () {
		wpbc_ui_chosen_filter_clear( '#' + $( this ).attr( 'data-wpbc-chosen-clear' ) );
	} );

	$( function () {
		wpbc_ui_chosen_filters_init( document );
	} );

	// Public APIs support dynamically rendered filters and the existing resource-clear callback.
	window.wpbc_ui_chosen_filters_init             = wpbc_ui_chosen_filters_init;
	window.wpbc_ui_chosen_filter_clear             = wpbc_ui_chosen_filter_clear;
	window.wpbc_ui_chosen_filter_get_request_value = wpbc_ui_chosen_filter_get_request_value;
	window.wpbc_bo_listing__choozen__remove_all_options = wpbc_ui_chosen_filter_clear;
}( jQuery, window, document ) );

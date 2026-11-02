
/**
 * Blink specific HTML element to set attention to this element.
 *
 * @param {string} element_to_blink		  - class or id of element: '.wpbc_widget_available_unavailable'
 * @param {int} how_many_times			  - 4
 * @param {int} how_long_to_blink		  - 350
 */
function wpbc_blink_element( element_to_blink, how_many_times = 4, how_long_to_blink = 350 ){

	for ( let i = 0; i < how_many_times; i++ ){
		jQuery( element_to_blink ).fadeOut( how_long_to_blink ).fadeIn( how_long_to_blink );
	}
    jQuery( element_to_blink ).animate( {opacity: 1}, 500 );
}


/**
 * Keep the current shared horizontal-navigation item visible in its scrollport.
 *
 * The navigation remains fully server rendered. This domain-neutral helper
 * only corrects presentation when a narrow viewport places the active link
 * outside the visible inline range.
 *
 * @param {Window}   window   Browser window.
 * @param {Document} document Browser document.
 *
 * @return {void}
 */
( function ( window, document ) {
	'use strict';

	var reveal_frame = 0;

	/**
	 * Reveal one active link only when it is clipped by its navigation scrollport.
	 *
	 * @param {HTMLElement} navigation Horizontal navigation scrollport.
	 *
	 * @return {void}
	 */
	function wpbc_ui_horizontal_navigation_reveal_active( navigation ) {
		var active_link;
		var active_rect;
		var navigation_rect;

		if ( ! navigation || ! navigation.querySelector || ! navigation.getBoundingClientRect ) {
			return;
		}

		active_link = navigation.querySelector( 'a[aria-current="page"]' );
		if ( ! active_link || ! active_link.getBoundingClientRect ) {
			return;
		}

		navigation_rect = navigation.getBoundingClientRect();
		active_rect     = active_link.getBoundingClientRect();

		if ( active_rect.left >= navigation_rect.left && active_rect.right <= navigation_rect.right ) {
			return;
		}

		if ( 'function' === typeof active_link.scrollIntoView ) {
			active_link.scrollIntoView(
				{
					behavior : 'auto',
					block    : 'nearest',
					inline   : 'nearest'
				}
			);
		}
	}

	/**
	 * Reveal the active item in every shared horizontal navigation instance.
	 *
	 * @return {void}
	 */
	function wpbc_ui_horizontal_navigation_reveal_all() {
		var navigation_elements = document.querySelectorAll( '.wpbc_ui_el__horis_top_bar__navigation' );
		var navigation_index;

		for ( navigation_index = 0; navigation_index < navigation_elements.length; navigation_index++ ) {
			wpbc_ui_horizontal_navigation_reveal_active( navigation_elements[ navigation_index ] );
		}
	}

	/**
	 * Coalesce initial and resize-driven active-item reveal work to one frame.
	 *
	 * @return {void}
	 */
	function wpbc_ui_horizontal_navigation_schedule_reveal() {
		if ( reveal_frame ) {
			return;
		}

		if ( 'function' === typeof window.requestAnimationFrame ) {
			reveal_frame = window.requestAnimationFrame(
				function () {
					reveal_frame = 0;
					wpbc_ui_horizontal_navigation_reveal_all();
				}
			);
			return;
		}

		reveal_frame = window.setTimeout(
			function () {
				reveal_frame = 0;
				wpbc_ui_horizontal_navigation_reveal_all();
			},
			0
		);
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', wpbc_ui_horizontal_navigation_schedule_reveal, { once: true } );
	} else {
		wpbc_ui_horizontal_navigation_schedule_reveal();
	}

	window.addEventListener( 'resize', wpbc_ui_horizontal_navigation_schedule_reveal );
}( window, document ) );

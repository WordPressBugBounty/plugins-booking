<?php
/**
 * @version 1.0
 * @package Booking Calendar
 * @subpackage  Calendar Scripts
 * @category    Functions
 *
 * @author wpdevelop
 * @link https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2025-07-19
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;  // Exit if accessed directly.
}

// =====================================================================================================================
// ==  Calendar  functions  ==
// =====================================================================================================================

/**
 * Get calendar Loader animation (cache/minify/deferral safe).
 *
 * Shows "Loading..." immediately. After 8 seconds:
 *  - If the loader was replaced by the real calendar, shows nothing (as intended).
 *  - If not replaced:
 *      - If jQuery/_wpbc/datepick are missing -> shows relevant help message.
 *      - Else -> shows "duplicate calendar" message.
 *
 * @param int $resource_id   Booking resource ID.
 * @param int $months_number Number of months in calendar view.
 *
 * @return string
 */
function wpbc_get_calendar_loader_animation( $resource_id = 1, $months_number = 1 ) {

	// FixIn: 10.14.4.2. (loader cache-proof; duplicate shown only after 8s if not replaced; logging added).

	ob_start();

	$rid  = (int) $resource_id;
	$cols = (int) $months_number;

	// Messages (encode once for safe JS embedding).
	$msg_duplicate = sprintf( 'You have added the same calendar (ID = %d) more than once on this page. Please keep only one calendar with the same ID on a page to avoid conflicts.', $rid );
	$msg_support   = 'Contact support@wpbookingcalendar.com if you have any questions.';
	$msg_lib_wpbc  = sprintf( __( 'It appears that the %s library is not loading correctly.', 'booking' ), '"_wpbc"' ) . "\n" .
					 sprintf( __( 'Please enable the loading of JS/CSS files for this page on the %s page', 'booking' ), '"WP Booking Calendar" - "Settings General" - "Advanced"' ) . "\n" .
					 __( 'For more information, please refer to this page: ', 'booking' ) . 'https://wpbookingcalendar.com/faq/';
	$msg_lib_dp    = sprintf( __( 'It appears that the %s library is not loading correctly.', 'booking' ), '"jQuery.datepick"' ) . "\n" .
					 __( 'For more information, please refer to this page: ', 'booking' ) . 'https://wpbookingcalendar.com/faq/';
	$msg_lib_jq    = sprintf( __( 'It appears that the %s library is not loading correctly.', 'booking' ), '"jQuery"' ) . "\n" .
					 __( 'For more information, please refer to this page: ', 'booking' ) . 'https://wpbookingcalendar.com/faq/';

	?>
	<style type="text/css">
		/* Loader frame */
		#calendar_booking<?php echo intval( $rid ); ?> .calendar_loader_frame {
			width: calc(341px * <?php echo intval( $cols ); ?>);
			max-width: 100%;
			height: 307px;
			display: flex;
			flex-flow: column nowrap;
			align-items: center;
			justify-content: center;
			border-radius: 5px;
			box-shadow: 0 0 2px #ccc;
			gap: 15px;
			/* Calendar variables (safe fallbacks) */
			color: var(--wpbc_cal-available-text-color, #2c3e50);
			background: rgb(from var(--wpbc_cal-available-day-color, #e6f2ff) r g b / var(--wpbc_cal-day-bg-color-opacity, 1));
			border: var(--wpbc_cal-day-cell-border-width, 1px) solid var(--wpbc_cal-available-day-color, #aacbeb);
			/* aspect-ratio: 1 / 1; */
		}
		#calendar_booking<?php echo intval( $rid ); ?> .calendar_loader_frame .calendar_loader_text {
			font-size: 18px;
			text-align: center;
		}
		.calendar_loader_frame__progress_line_container {
			width: 50%;
			height: 3px;
			margin: 7px 0 0 0;
			overflow: hidden;
			background: #202020;
			border-radius: 30px;
		}
		.calendar_loader_frame__progress_line {
			width: 0%;
			height: 3px;
			background: #8ECE01;
			border-radius: 30px;
			animation: calendar_loader_bar_progress_line_animation 3s infinite;
		}
		@keyframes calendar_loader_bar_progress_line_animation {
			100% {
				width: 100%;
			}
		}
	</style>
	<div class="calendar_loader_frame calendar_loader_frame<?php echo intval( $rid ); ?>">
		<div class="calendar_loader_text"><?php esc_html_e( 'Loading', 'booking' ); ?>...</div>
		<div class="calendar_loader_frame__progress_line_container">
			<div class="calendar_loader_frame__progress_line"></div>
		</div>
	</div>
	<script type="text/javascript">
		(function () {
			"use strict";
			var rid          = <?php echo intval( $rid ); ?>;
			var container_id = 'calendar_booking' + rid;
			var loader_sel   = '.calendar_loader_frame' + rid;
			var text_sel     = loader_sel + ' .calendar_loader_text';
			var duplicate_message = <?php echo wp_json_encode( $msg_duplicate ); ?>;
			var support_message   = <?php echo wp_json_encode( $msg_support ); ?>;
			var lib_msg_wpbc      = <?php echo wp_json_encode( $msg_lib_wpbc ); ?>;
			var lib_msg_dp        = <?php echo wp_json_encode( $msg_lib_dp ); ?>;
			var lib_msg_jq        = <?php echo wp_json_encode( $msg_lib_jq ); ?>;
			// Logging helpers (safe across old consoles).
			function log_error(ctx, err) {
				try {
					if ( window.console && console.error ) console.error( 'WPBC loader[' + rid + '] ' + ctx + ':', err );
				} catch ( _ ) {
				}
			}
			function log_info(ctx, data) {
				try {
					if ( window.console && console.log ) console.log( 'WPBC loader[' + rid + '] ' + ctx + ':', data );
				} catch ( _ ) {
				}
			}
			// One-shot guard for this resource ID (prevents duplicate inlines from acting twice).
			if ( window['__wpbc_loader_finalized__' + rid] === true ) {
				return;
			}
			function html_wrap(msg) {
				return '<div style="font-size:13px;margin:10px;">' + String( msg ).replace( /\n/g, '<br>' ) + '</div>';
			}
			function has_jquery() {
				return !!(window.jQuery && jQuery.fn && typeof jQuery.fn.on === 'function');
			}
			function has_datepick() {
				return !!(window.jQuery && jQuery.datepick);
			}
			function has_wpbc() {
				return !!(window._wpbc && typeof window._wpbc.set_other_param === 'function');
			}
			// Detect whether the loader has been replaced by the real calendar.
			function is_replaced() {
				var loader_exists   = !!document.querySelector( loader_sel );
				var calendar_exists = !!document.querySelector( '.wpbc_calendar_id_' + rid );
				return (!loader_exists) || calendar_exists;
			}
			// Watcher that just updates a flag; it does NOT show any message.
			var replaced = is_replaced();
			// Poll watcher (cheap)
			var watch = setInterval( function () {
				replaced = is_replaced();
				if ( replaced ) {
					clearInterval( watch );
					if ( observer ) {
						try {
							observer.disconnect();
						} catch ( e ) {
							log_error( 'observer.disconnect (poll watcher)', e );
						}
					}
				}
			}, 250 );
			// MutationObserver watcher (fast reaction, low cost).
			var observer = null;
			(function () {
				var container = document.getElementById( container_id );
				if ( !container || !('MutationObserver' in window) ) return;
				observer = new MutationObserver( function () {
					replaced = is_replaced();
					if ( replaced ) {
						if ( watch ) {
							try {
								clearInterval( watch );
							} catch ( e ) {
								log_error( 'clearInterval(watch) in MutationObserver', e );
							}
						}
						try {
							observer.disconnect();
						} catch ( e ) {
							log_error( 'observer.disconnect in MutationObserver', e );
						}
					}
				} );
				try {
					observer.observe( container, { childList: true, subtree: true } );
				} catch ( e ) {
					log_error( 'observer.observe', e );
				}
			})();
			// Final decision happens ONLY after the grace period.
			var grace_ms = 8000;
			setTimeout( function finalize_after_grace() {
				if ( window['__wpbc_loader_finalized__' + rid] === true ) {
					return;
				}
				window['__wpbc_loader_finalized__' + rid] = true;

				// If loader was replaced by real calendar, do nothing.
				if ( replaced ) {
					return;
				}
				// Decide which message to show (no jQuery, no _wpbc, no datepick, or duplicate).
				var msg;
				if ( !has_jquery() ) {
					msg = lib_msg_jq;
				} else if ( !has_wpbc() ) {
					msg = lib_msg_wpbc;
				} else if ( !has_datepick() ) {
					msg = lib_msg_dp;
				} else {
					msg = duplicate_message + '\n\n' + support_message;
				}
				// Inject message via DOM (no jQuery dependency).
				try {
					var el = document.querySelector( text_sel );
					if ( el ) el.innerHTML = html_wrap( msg );
				} catch ( e ) {
					log_error( 'inject message into loader text', e );
				}
				// Optional logging for duplicate case.
				if ( msg === (duplicate_message + '\n\n' + support_message) ) {
					try {
						log_info( 'Duplicate calendar detected', document.querySelector( '.wpbc_calendar_id_' + rid ) );
					} catch ( e ) {
						log_error( 'duplicate log', e );
					}
				}
				// Cleanup watchers.
				try {
					clearInterval( watch );
				} catch ( e ) {
					log_error( 'clearInterval(watch) at finalize', e );
				}
				if ( observer ) {
					try {
						observer.disconnect();
					} catch ( e ) {
						log_error( 'observer.disconnect at finalize', e );
					}
				}
			}, grace_ms );
		})();
	</script>
	<?php

	return ob_get_clean();
}


/**
 * Get HTML for the initilizing inline calendars
 *
 * @param integer $resource_id  - ID of booking resource.
 * @param integer $cal_count    - Number of months.
 * @param array   $bk_otions    - Options.
 *
 * @return string
 */
function wpbc_pre_get_calendar_html( $resource_id = 1, $cal_count = 1, $bk_otions = array() ) {

	/**
	 * SHORTCODE: [booking type=56 form_type='standard' nummonths=4 options='{calendar months_num_in_row=2 width=682px cell_height=48px}'] .
	 * OPTIONS:
	 * [months_num_in_row] => 2
	 * [width] => 341px                define: width: 100%; max-width:341px;
	 * [strong_width] => 341px     define: width:341px;
	 * [cell_height] => 48px
	 */
	$bk_otions = wpbc_parse_calendar_options( $bk_otions );

	$width             = '';
	$months_num_in_row = '';
	$cell_height       = '';

	if ( ! empty( $bk_otions ) ) {

		if ( isset( $bk_otions['months_num_in_row'] ) ) {
			$months_num_in_row = $bk_otions['months_num_in_row'];
		}

		if ( isset( $bk_otions['width'] ) ) {
			$width = 'width:100%;max-width:' . $bk_otions['width'] . ';';                                           // FixIn: 9.3.1.5.
		}
		if ( isset( $bk_otions['strong_width'] ) ) {
			$width .= 'width:' . $bk_otions['strong_width'] . ';';                                                  // FixIn: 9.3.1.6.
		}

		if ( isset( $bk_otions['cell_height'] ) ) {
			$cell_height = $bk_otions['cell_height'];
		}
		if ( isset( $bk_otions['strong_cell_height'] ) ) {                                                          // FixIn: 9.7.3.3.
			$cell_height = $bk_otions['strong_cell_height'] . '!important;';
		}
	}
	/* FixIn: 9.7.3.4 */

	if ( ! empty( $cell_height ) ) {
		// FixIn: 10.13.1.3.
		// phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet
		$style = '<style type="text/css" rel="stylesheet" >.hasDatepick .datepick-inline .datepick-title-row th,.hasDatepick .datepick-inline .datepick-days-cell,.hasDatepick .datepick-inline .wpbc-cell-box{ max-height: ' . $cell_height . '; }</style>';  // FixIn: 10.12.4.2.
	} else {
		$style = '';
	}

	$booking_timeslot_day_bg_as_available = get_bk_option( 'booking_timeslot_day_bg_as_available' );

	$booking_timeslot_day_bg_as_available = ( 'On' === $booking_timeslot_day_bg_as_available ) ? ' wpbc_timeslot_day_bg_as_available' : '';

	$is_custom_width_css = ( empty( $width ) ) ? ' wpbc_no_custom_width ' : '';

	$calendar = $style .
				'<div class="wpbc_cal_container bk_calendar_frame' . $is_custom_width_css . ' months_num_in_row_' . $months_num_in_row . ' cal_month_num_' . $cal_count . $booking_timeslot_day_bg_as_available . '" style="' . $width . '">' .
				'<div id="calendar_booking' . $resource_id . '"  class="wpbc_calendar_id_' . $resource_id . '" >' .
				wpbc_get_calendar_loader_animation( $resource_id, $cal_count ) .
				'</div>' .
				'</div>';

	$booking_is_show_powered_by_notice = get_bk_option( 'booking_is_show_powered_by_notice' );
	if ( ( ! class_exists( 'wpdev_bk_personal' ) ) && ( 'On' === $booking_is_show_powered_by_notice ) ) {
		$calendar .= '<div style="font-size:7px;text-align:left;margin:0 0 10px;text-shadow: none;">Powered by <a href="https://wpbookingcalendar.com" style="font-size:7px;" target="_blank" title="Booking Calendar plugin for WordPress">Booking Calendar</a></div>';
	}

	$calendar .= '<textarea id="date_booking' . $resource_id . '" name="date_booking' . $resource_id . '" autocomplete="off" style="display:none;"></textarea>';   // Calendar code.

	$calendar .= wpbc_get_calendar_legend();                                                                            // FixIn: 9.4.3.6.

	$calendar_css_class_outer = 'wpbc_calendar_wraper';

	// FixIn: 7.0.1.24.
	$is_booking_change_over_days_triangles = get_bk_option( 'booking_change_over_days_triangles' );
	if ( 'Off' !== $is_booking_change_over_days_triangles ) {
		$calendar_css_class_outer .= ' wpbc_change_over_triangle';
	}

	// filenames,  such  as 'multidays.css'.
	$calendar_skin_name = basename( get_bk_option( 'booking_skin' ) );
	if ( wpbc_is_calendar_skin_legacy( $calendar_skin_name ) ) {
		$calendar_css_class_outer .= ' wpbc_calendar_skin_legacy';
	}

	$calendar = '<div class="' . esc_attr( $calendar_css_class_outer ) . '">' . $calendar . '</div>';

	return $calendar;
}

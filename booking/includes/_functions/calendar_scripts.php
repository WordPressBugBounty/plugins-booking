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

// FixIn: 10.12.4.3.
/**
 * Get calendar Loader animation.
 * More loader aninmations here https://css-loaders.com/classic/
 *
 * @param integer $resource_id - ID of booking resource.
 * @param integer $months_number - Number of months.
 *
 * @return string
 */
function wpbc_get_calendar_loader_animation( $resource_id = 1, $months_number = 1 ) {

	ob_start();

	?><style type="text/css" rel="stylesheet" >
		#calendar_booking<?php echo intval( $resource_id ); ?> .calendar_loader_frame {
			width: calc(341px * '. intval( $months_number ) . ');
			max-width: 100%;
			height: 307px;
			border: 0px solid #ccc;
			display: flex;
			flex-flow: column nowrap;
			align-items: center;
			justify-content: center;
			border-radius: 5px;
			box-shadow: 0 0 2px #ccc;
			aspect-ratio0: 1 / 1;
			gap: 15px;
			color: var(--wpbc_cal-selected-day-color, #4b74aa);
			background: var(--wpbc_cal-main-background-color, #fff);
			color: var(--wpbc_cal-available-text-color);
			background: rgb(from var(--wpbc_cal-available-day-color) r g b / var(--wpbc_cal-day-bg-color-opacity));
			border: var(--wpbc_cal-day-cell-border-width) solid var(--wpbc_cal-available-day-color);
		}
		#calendar_booking<?php echo intval( $resource_id ); ?> .calendar_loader_frame .calendar_loader_text {
			font-size: 18px;
			text-align: center;
		}
		.calendar_loader_frame__progress_line_container {
			width: 50%;
			border: 0px solid #757575;
			height: 3px;
			border-radius: 6px;
			margin: 7px 0 0 0;
			overflow: hidden;
			background: #202020;
			border-radius: 30px;
		}
		.calendar_loader_frame__progress_line {
			font-size: 6px;
			font-weight: 600;
			border-radius: 6px;
			word-wrap: normal;
			white-space: nowrap;
			background: #8ECE01;
			width: 0%;
			height: 3px;
			border-radius: 30px;
			animation: calendar_loader_bar_progress_line_animation 3s infinite;
		}
		@keyframes calendar_loader_bar_progress_line_animation {
			100% {
				width: 100%;
			}
		}
	</style>
	<div class="calendar_loader_frame calendar_loader_frame<?php echo intval( $resource_id ); ?>">
		<div class="calendar_loader_text"><?php esc_html_e( 'Loading', 'booking' ); ?>...</div>
		<div class="calendar_loader_frame__progress_line_container"><div class="calendar_loader_frame__progress_line"></div></div>
	</div>
	<?php
		$message1 = 'You have added the same calendar (ID = ' . intval( $resource_id ) . ') more than once on this page. Please keep only one calendar with the same ID on a page to avoid conflicts.';
		$message2 = 'Contact support@wpbookingcalendar.com if you have any questions.';
	?>
	<script type="text/javascript">
			setTimeout(
			function () {
				(function() { var a = setInterval( function() {  if ( ( 'undefined' === typeof jQuery ) || ! window.jQuery ) { return; } clearInterval( a ); jQuery( document ).ready( function () {
					jQuery( '.calendar_loader_frame<?php echo intval( $resource_id ); ?> .calendar_loader_text').html( '<div style="font-size: 13px;margin: 10px;"><?php echo esc_js( $message1 ); ?><br><br><?php echo esc_js( $message2 ); ?></div>' );
					if ( jQuery( '.calendar_loader_frame<?php echo intval( $resource_id ); ?>').length ){
						console.log( 'WPBC Error! Duplicate calendar detected. ' , jQuery( '.wpbc_calendar_id_<?php echo intval( $resource_id ); ?>') );
					}
				} ); }, 500 ); })();
			},
			8000
		);
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

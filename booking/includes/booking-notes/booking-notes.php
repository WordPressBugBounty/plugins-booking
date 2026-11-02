<?php
/**
 * Reusable Booking Notes domain bootstrap.
 *
 * The domain owns canonical note reads and note-state normalization. It does
 * not decide where a public note is displayed or sent.
 *
 * @package Booking Calendar
 * @since   12.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/booking-notes__activate.php';
require_once __DIR__ . '/class-wpbc-booking-notes-repository.php';
require_once __DIR__ . '/class-wpbc-booking-notes-service.php';
require_once __DIR__ . '/booking-notes__email.php';

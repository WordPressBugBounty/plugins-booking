<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/demo-template-factory.php';
return wpbc_bfb_demo_template__build(
	__DIR__ . '/dates_advanced_form_with_hints.php',
	array(
		'template_key' => 'demo_business_large',
		'title'        => 'Live Demo / Business Large',
		'description'  => 'Advanced full-day form with availability, date, cost and guest details used by the Booking Calendar Business Large live demo.',
		'remove_review_summary' => true,
		'use_large_demo_layout'  => true,
	)
);

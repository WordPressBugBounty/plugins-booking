<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/demo-template-factory.php';
return wpbc_bfb_demo_template__build(
	__DIR__ . '/dates_form_with_vertical_layout.php',
	array(
		'template_key' => 'demo_personal',
		'title'        => 'Live Demo / Personal',
		'description'  => 'Full-day booking form with customer fields arranged in two rows for the Booking Calendar Personal live demo.',
	)
);

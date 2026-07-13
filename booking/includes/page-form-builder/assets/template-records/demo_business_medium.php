<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/demo-template-factory.php';
return wpbc_bfb_demo_template__build(
	__DIR__ . '/dates_advanced_2_steps_wizard_with_hints.php',
	array(
		'template_key' => 'demo_business_medium',
		'title'        => 'Live Demo / Business Medium',
		'description'  => 'Two-step date-range form with date and cost hints used by the Booking Calendar Business Medium live demo.',
		'remove_field_types' => array( 'capacity_hint' ),
		'use_medium_demo_layout' => true,
	)
);

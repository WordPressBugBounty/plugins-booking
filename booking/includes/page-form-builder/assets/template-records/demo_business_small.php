<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/demo-template-factory.php';
return wpbc_bfb_demo_template__build(
	__DIR__ . '/time_appointments_2_steps_wizard.php',
	array(
		'template_key' => 'demo_business_small',
		'title'        => 'Live Demo / Business Small',
		'description'  => 'Two-step service appointment form used by the Booking Calendar Business Small live demo.',
	)
);

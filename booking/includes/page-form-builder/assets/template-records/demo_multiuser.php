<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/demo-template-factory.php';
return wpbc_bfb_demo_template__build(
	__DIR__ . '/time_appointments_2_steps_wizard.php',
	array(
		'template_key' => 'demo_multiuser',
		'title'        => 'Live Demo / MultiUser',
		'description'  => 'Default service appointment form used by the Booking Calendar MultiUser live demo.',
	)
);

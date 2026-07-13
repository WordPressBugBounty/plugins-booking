<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/demo-template-factory.php';
return wpbc_bfb_demo_template__build(
	__DIR__ . '/time_appointments_2_steps_wizard.php',
	array(
		'template_key'    => 'demo_multiuser_owner_1',
		'title'           => 'Live Demo / MultiUser / Owner 1',
		'description'     => 'Owner 1 personalized service appointment form for the MultiUser live demo.',
		'heading'         => 'Personalized Unique Booking Form for User "Owner 1"',
		'service_options' => array(
			array( 'label' => 'Service A (20 min)', 'value' => '00:20', 'selected' => false ),
			array( 'label' => 'Service C (45 min)', 'value' => '00:45', 'selected' => false ),
		),
	)
);

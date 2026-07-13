<?php
if ( ! defined( 'ABSPATH' ) ) { exit; }
require_once __DIR__ . '/demo-template-factory.php';
return wpbc_bfb_demo_template__build(
	__DIR__ . '/time_appointments_2_steps_wizard.php',
	array(
		'template_key'    => 'demo_multiuser_owner_2',
		'title'           => 'Live Demo / MultiUser / Owner 2',
		'description'     => 'Owner 2 personalized service appointment form for the MultiUser live demo.',
		'heading'         => 'Personalized Unique Booking Form for User "Owner 2"',
		'service_options' => array(
			array( 'label' => 'Service B (30 min)', 'value' => '00:30', 'selected' => false ),
			array( 'label' => 'Service C (45 min)', 'value' => '00:45', 'selected' => false ),
		),
	)
);

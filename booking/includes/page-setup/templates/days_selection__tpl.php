<?php /**
 * @version 1.0
 * @description Template   for Setup pages
 * @category    Setup Templates
 * @author wpdevelop
 *
 * @web-site http://oplugins.com/
 * @email info@oplugins.com
 *
 * @modified 2024-09-09
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


// -------------------------------------------------------------------------------------------------------------
// == Main - Days Selection  ==
// -------------------------------------------------------------------------------------------------------------

/**
 * Template - Calendar - Days Selection ?
 *
 * 	Help Tips:
 *
 *		<script type="text/html" id="tmpl-template_name_a">
 * 			Escaped:  	 {{data.test_key}}
 * 			HTML:  		{{{data.test_key}}}
 * 			JS: 	  	<# if (true) { alert( 1 ); } #>
 * 		</script>
 *
 * 		var template__var = wp.template( 'template_name_a' );
 *
 * 		jQuery( '.content' ).html( template__var( { 'test_key' => '<strong>Data</strong>' } ) );
 *
 * @return void
 */
function wpbc_template__stp_wiz__days_selection(){

	?><script type="text/html" id="tmpl-wpbc_template__stp_wiz__days_selection"><?php
		ob_start();
		wpbc_ui_settings__panel__all_settings_panels();
		$result = ob_get_clean();

		// Replace <script> tags to <#
		$pattern = '/<script\s*(type=[\'"]+text\/javascript[\'"]+)?\s*>/i';
		$result = preg_replace($pattern, '<#', $result);

		// Replace </script> tags to #>
		$pattern = '/<\/script>/i';
		$result = preg_replace($pattern, '#>', $result);

		echo $result;
		// {{{data.calendar_force_load}}}

	?></script><?php
}

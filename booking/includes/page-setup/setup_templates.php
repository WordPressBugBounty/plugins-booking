<?php /**
 * @version 1.0
 * @description  Templates for Setup pages
 * @category  Setup Templates
 * @author wpdevelop
 *
 * @web-site http://oplugins.com/
 * @email info@oplugins.com
 *
 * @modified 2024-08-27
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly


class WPBC_AJX__Setup_Wizard__Templates {

	// <editor-fold     defaultstate="collapsed"                        desc=" ///  JS | CSS files | Tpl loading  /// "  >

	/**
	 * Define HOOKs for loading CSS and  JavaScript files
	 */
	public function init_load_css_js_tpl() {

		// Load only  at  specific  Page
		if ( wpbc_is_setup_wizard_page() ) {

			add_action( 'wpbc_enqueue_js_files',  array( $this, 'js_load_files' ),     50 );
			add_action( 'wpbc_enqueue_css_files', array( $this, 'enqueue_css_files' ), 50 );

			add_action( 'wpbc_hook_settings_page_footer', array( $this, 'hook__load_templates_at_footer' ) );
		}
	}


	/** JS */
	public function js_load_files( $where_to_load ) {

		$in_footer = true;

		if ( wpbc_is_setup_wizard_page() ){

			wp_enqueue_script( 'wpbc_all', 			wpbc_plugin_url( '/_dist/all/_out/wpbc_all.js' ), 	array( 'jquery' ), 			 WP_BK_VERSION_NUM );
			wp_enqueue_script( 'wpbc-main-client', 	wpbc_plugin_url( '/js/client.js' ), 				array( 'wpbc-datepick' ), 	 WP_BK_VERSION_NUM );
			wp_enqueue_script( 'wpbc-times', 		wpbc_plugin_url( '/js/wpbc_times.js' ), 			array( 'wpbc-main-client' ), WP_BK_VERSION_NUM );

			wp_enqueue_script( 'wpbc-setup_wizard__page', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/setup__page.js', 		array( 'wpbc_all' ), WP_BK_VERSION_NUM, $in_footer );
			wp_enqueue_script( 'wpbc-general_ui_js_css',  wpbc_plugin_url( '/includes/_general_ui_js_css/_out/wpbc_main_ui_funcs.js' ), array( 'wpbc_all' ), WP_BK_VERSION_NUM, $in_footer );
		}
	}


	/** CSS */
	public function enqueue_css_files( $where_to_load ) {

		if ( wpbc_is_setup_wizard_page() ){

			wp_enqueue_style( 'wpbc-setup_wizard__page', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/setup__page.css', array(), WP_BK_VERSION_NUM );
		}
	}

	// </editor-fold>


	// <editor-fold     defaultstate="collapsed"                        desc=" ///  Templates  /// "  >


		/**
		 * Load Templates at footer of page
		 *
		 * @param $page string
		 */
		public function hook__load_templates_at_footer( $page ){

			// Hook  from ../includes/page-setup/setup__page.php
			if ( 'wpbc-ajx_booking_setup_wizard'  === $page ) {

				$this->template__main_page_content();
			}
		}


		// -------------------------------------------------------------------------------------------------------------
		// == Templates ==
		// -------------------------------------------------------------------------------------------------------------

		/**
		 * Template - Main
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
		private function template__main_page_content() {
			?><script type="text/html" id="tmpl-wpbc_main_page_content">
				<div class="wpbc_main_page_content__container wpbc_ajx_cstm__container">
					<div class="wpbc_main_page_content__section_left wpbc_ajx_cstm__section_left">{{{data.calendar_force_load}}}</div>
					<div class="wpbc_main_page_content__section_right wpbc_ajx_cstm__section_right"><?php $this->test(); ?>
					</div>
				</div>
			</script><?php
		}


		private function test(){
			?>
					<div class="wpbc_widgets">
						<div class="wpbc_widget wpbc_widget_change_calendar_skin">
							<div class="wpbc_widget_header">
								<span class="wpbc_widget_header_text">Calendar Skin</span>
								<a href="/" class="wpbc_widget_header_settings_link"><i class="menu_icon icon-1x wpbc_icn_settings"></i></a>
							</div>
							<div class="wpbc_widget_content wpbc_ajx_toolbar" style="margin:0 0 20px;">
								<div class="ui_container">
									<div class="ui_group    ui_group__change_calendar_skin">
										<div class="ui_element ui_nowrap0"><label for="ui_btn_cstm__set_calendar_skin"
																				  class="wpbc_ui_control_label "
																				  style=""><span class=""
																								 style="font-weight:600">Select the skin of the booking calendar:</span></label>
										</div>
										<div class="ui_element ui_nowrap"><select id="ui_btn_cstm__set_calendar_skin"
																				  name="set_calendar_skin"
																				  class="wpbc_ui_control wpbc_ui_select wpbc_radio__set_days_customize_plugin"
																				  style=""
																				  onfocus="javascript:console.log( 'ON FOCUS:', jQuery( this ).val(), 'in element:' , jQuery( this ) );"
																				  onchange="javascript:wpbc_ajx_customize_plugin.search_set_param('customize_plugin__booking_skin', jQuery(this).val().replace( 'http://beta/wp-content/plugins/booking', '') );"
																				  autocomplete="off">
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/24_9__dark_1.css">
													24_9__dark_1
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/24_9__dark_2.css">
													24_9__dark_2
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/24_9__light.css">
													24_9__light
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/24_9__light_2.css">
													24_9__light_2
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/24_9__light_simple_1.css">
													24_9__light_simple_1
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/24_9__light_square_1.css">
													24_9__light_square_1
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/24_9__light_traditional_1.css">
													24_9__light_traditional_1
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/black-2.css">
													Black-2
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/black.css">
													Black
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/green-01.css">
													Green-01
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light-01.css">
													Light-01
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8.css">
													Light__24_8
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_blue_1.css">
													Light__24_8_blue_1
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_blue_2.css">
													Light__24_8_blue_2
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_blue_3.css">
													Light__24_8_blue_3
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_blue_4.css">
													Light__24_8_blue_4
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_green_1.css">
													Light__24_8_green_1
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_green_2.css">
													Light__24_8_green_2
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_red_1.css">
													Light__24_8_red_1
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_red_2.css">
													Light__24_8_red_2
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/light__24_8_red_3.css">
													Light__24_8_red_3
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/multidays.css">
													Multidays
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/premium-black.css">
													Premium-black
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/premium-light-noborder.css">
													Premium-light-noborder
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/premium-light.css">
													Premium-light
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/premium-marine.css">
													Premium-marine
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/premium-steel-noborder.css">
													Premium-steel-noborder
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/premium-steel.css">
													Premium-steel
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/standard.css">
													Standard
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/traditional-light.css">
													Traditional-light
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/traditional-times.css">
													Traditional-times
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/css/skins/traditional.css">
													Traditional
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/wpbc_skins/newspaper-skin.css">
													Newspaper-skin
												</option>
												<option
													value="http://beta/wp-content/plugins/booking/wpbc_skins/round-dates-01.css">
													Round-dates-01
												</option>
											</select><a class="wpbc_ui_control wpbc_ui_button wpbc_ui_button" style=""
														href="javascript:void(0)"
														onclick="javascript: var is_selected = jQuery( '#ui_btn_cstm__set_calendar_skin option:selected' ).prop('selected', false).prev();  if ( is_selected.length == 0 ){     is_selected = jQuery( '#ui_btn_cstm__set_calendar_skin option' ).last();  }  if ( is_selected.length > 0 ){     is_selected.prop('selected', true).trigger('change');  } else {     jQuery( this ).addClass( 'disabled' );  } "><i
													class="menu_icon icon-1x wpbc_icn_arrow_back_ios"></i><span
													class="in-button-text"></span></a><a
												class="wpbc_ui_control wpbc_ui_button wpbc_ui_button" style=""
												href="javascript:void(0)"
												onclick="javascript: var is_selected = jQuery( '#ui_btn_cstm__set_calendar_skin option:selected' ).prop('selected', false).next();  if ( is_selected.length == 0 ){     is_selected = jQuery( '#ui_btn_cstm__set_calendar_skin option' ).first();  }  if ( is_selected.length > 0 ){     is_selected.prop('selected', true).trigger('change');  } else {     jQuery( this ).addClass( 'disabled' );  } "><span
													class="in-button-text">&nbsp;</span><i
													class="menu_icon icon-1x wpbc_icn_arrow_forward_ios"></i></a></div>
										<div class="ui_element ui_nowrap0"><label
												for="ui_btn_cstm__set_calendar_visible_months"
												class="wpbc_ui_control_label " style=""><span class=""
																							  style="font-weight:600">Number of visible months:</span></label>
										</div>
										<div class="ui_element ui_nowrap"><select
												id="ui_btn_cstm__set_calendar_visible_months"
												name="set_calendar_visible_months"
												class="wpbc_ui_control wpbc_ui_select " style=""
												onchange="javascript:wpbc_ajx_customize_plugin.search_set_param( 'calendar__view__visible_months', jQuery(this).val() );									var t_visible_months = parseInt( wpbc_ajx_customize_plugin.search_get_param( 'calendar__view__visible_months' ) );									/* var t_months_in_row = (  3 > t_visible_months ) ? '' : 2 ; 								   		wpbc_ajx_customize_plugin.search_set_param( 'calendar__view__months_in_row', t_months_in_row );							   		*/							   											wpbc_ajx_customize_plugin__send_request_with_params( {} );									wpbc_admin_show_message_processing( '' );																		"
												autocomplete="off">
												<option value="1">1</option>
												<option value="2">2</option>
												<option value="3">3</option>
												<option value="4">4</option>
												<option value="5">5</option>
												<option value="6">6</option>
												<option value="7">7</option>
												<option value="8">8</option>
												<option value="9">9</option>
												<option value="10">10</option>
												<option value="11">11</option>
												<option value="12">12</option>
											</select><a class="wpbc_ui_control wpbc_ui_button wpbc_ui_button" style=""
														href="javascript:void(0)"
														onclick="javascript: var is_selected = jQuery( '#ui_btn_cstm__set_calendar_visible_months option:selected' ).prop('selected', false).prev();  if ( is_selected.length == 0 ){     is_selected = jQuery( '#ui_btn_cstm__set_calendar_visible_months option' ).last();  }  if ( is_selected.length > 0 ){     is_selected.prop('selected', true).trigger('change'); 		wpbc_button_enable_loading_icon( this );  } else {     jQuery( this ).addClass( 'disabled' );  } "><i
													class="menu_icon icon-1x wpbc_icn_arrow_back_ios"></i><span
													class="in-button-text"></span></a><a
												class="wpbc_ui_control wpbc_ui_button wpbc_ui_button" style=""
												href="javascript:void(0)"
												onclick="javascript: var is_selected = jQuery( '#ui_btn_cstm__set_calendar_visible_months option:selected' ).prop('selected', false).next();  if ( is_selected.length == 0 ){     is_selected = jQuery( '#ui_btn_cstm__set_calendar_visible_months option' ).first();  }  if ( is_selected.length > 0 ){     is_selected.prop('selected', true).trigger('change'); 		wpbc_button_enable_loading_icon( this );  } else {     jQuery( this ).addClass( 'disabled' );  } "><span
													class="in-button-text">&nbsp;</span><i
													class="menu_icon icon-1x wpbc_icn_arrow_forward_ios"></i></a></div>
									</div>
								</div>
							</div>
						</div>
					</div>
			<?php
		}

	// </editor-fold>

}


/**
 * Just for loading CSS and  JavaScript files
 */
if ( true ) {
	$ajx_setup_wizard_loading = new WPBC_AJX__Setup_Wizard__Templates;
	$ajx_setup_wizard_loading->init_load_css_js_tpl();
}

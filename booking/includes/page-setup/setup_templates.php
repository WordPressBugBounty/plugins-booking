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

			wp_enqueue_script( 'wpbc-general_ui_js_css',  wpbc_plugin_url( '/includes/_general_ui_js_css/_out/wpbc_main_ui_funcs.js' ), array( 'wpbc_all' ), WP_BK_VERSION_NUM, $in_footer );

			wp_enqueue_script( 'wpbc-settings_obj',  	 trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/settings_obj.js',	array( 'wpbc_all' ), WP_BK_VERSION_NUM, $in_footer );
			wp_enqueue_script( 'wpbc-setup_wizard_obj',  trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/setup_obj.js', 		array( 'wpbc-settings_obj' ), WP_BK_VERSION_NUM, $in_footer );
			wp_enqueue_script( 'wpbc-setup_wizard_show', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/setup_show.js',		array( 'wpbc-setup_wizard_obj' ), WP_BK_VERSION_NUM, $in_footer );
			wp_enqueue_script( 'wpbc-setup_wizard_ajax', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/setup_ajax.js',		array( 'wpbc-setup_wizard_obj' ), WP_BK_VERSION_NUM, $in_footer );
		}
	}


	/** CSS */
	public function enqueue_css_files( $where_to_load ) {

		if ( wpbc_is_setup_wizard_page() ){

			wp_enqueue_style( 'wpbc-setup_wizard_page', trailingslashit( plugins_url( '', __FILE__ ) ) . '_out/setup_page.css', array(), WP_BK_VERSION_NUM );
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

				$this->wpbc_template__stp_wiz__main_content();

				wpbc_stp_wiz__template__welcome();
				wpbc_stp_wiz__template__general_info();
				wpbc_stp_wiz__template__date_time_formats();
				wpbc_stp_wiz__template__bookings_types();
				wpbc_stp_wiz__template__form_structure();
				wpbc_stp_wiz__template__cal_availability();
				wpbc_stp_wiz__template__color_theme();


					wpbc_template__stp_wiz__days_selection();

				$this->wpbc_template__stp_wiz__left_navigation();
				$this->wpbc_template__stp_wiz__left_navigation_item();

				$this->wpbc_template__timeline_steps();
				$this->wpbc_template__timeline_steps_icons();

				$this->wpbc_template__stp_wiz__footer_buttons();
			}
		}


		// =============================================================================================================
		// == Templates ==
		// =============================================================================================================
		/**
		 * Template - Page Container
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
		private function wpbc_template__stp_wiz__main_content() {
			?><script type="text/html" id="tmpl-wpbc_template__stp_wiz__main_content">
				<#
					var wpbc_template__timeline_steps = wp.template( 'wpbc_template__timeline_steps' );

					jQuery( '.wpbc__container_place__steps_for_timeline' ).html(  wpbc_template__timeline_steps( data.steps_is_done ) );
				#>
				<div class="wpbc__container_place__steps_for_timeline">{{{  wpbc_template__timeline_steps( data.steps_is_done )  }}}</div>
				<div class="wpbc_setup_wizard_page__container 		wpbc_ajx_page__container">

				<# if ( false !== data.steps[ data.current_step ][ 'show_section_left' ] ) {  #>

					<div class="wpbc_ajx_page__section wpbc_setup_wizard_page__section_left 	wpbc_ajx_page__section_left">
						<# var wpbc_template__stp_wiz__left_navigation = wp.template( 'wpbc_template__stp_wiz__left_navigation' ); #>{{{

							wpbc_template__stp_wiz__left_navigation({
																			'left_navigation'   : data.left_navigation,
																			'ajx_cleaned_params': data.ajx_cleaned_params
																		})
						}}}
					</div>

				<# } #>

					<div class="wpbc_ajx_page__section wpbc_setup_wizard_page__section_main 	wpbc_ajx_page__section_main">
							<?php if(0){ ?><script><?php } echo '<#'; ?>

								var template__main_section;

								switch ( data.current_step ) {

									case 'welcome':
										template__main_section = wp.template( 'wpbc_stp_wiz__template__welcome' );
										break;

									case 'general_info':
										template__main_section = wp.template( 'wpbc_stp_wiz__template__general_info' );
										break;

									case 'date_time_formats':
										template__main_section = wp.template( 'wpbc_stp_wiz__template__date_time_formats' );
										break;

									case 'bookings_types':
										template__main_section = wp.template( 'wpbc_stp_wiz__template__bookings_types' );
										break;

									case 'form_structure':
										template__main_section = wp.template( 'wpbc_stp_wiz__template__form_structure' );
										break;

									case 'cal_availability':
										template__main_section = wp.template( 'wpbc_stp_wiz__template__cal_availability' );
										break;

									case 'color_theme':
										template__main_section = wp.template( 'wpbc_stp_wiz__template__color_theme' );
										break;


									case 'calendar_days_selection':
										template__main_section = wp.template( 'wpbc_template__stp_wiz__days_selection' );
										break;
									default:
									   // Default
									   template__main_section = wp.template( 'wpbc_stp_wiz__template__general_info' );
								}

							<?php if(0){ ?></script><?php } echo '#>'; ?>
							{{{
									template__main_section( data )
							}}}
					</div>

					<# if ( false !== data.steps[ data.current_step ][ 'show_section_right' ] ) { #>

						<div class="wpbc_ajx_page__section wpbc_setup_wizard_page__section_right 	wpbc_ajx_page__section_right">
							<?php $this->test_right_widget(); ?>
						</div>
					<# } #>

					<#
						var wpbc_template__stp_wiz__footer_buttons = wp.template( 'wpbc_template__stp_wiz__footer_buttons' );
					#>
					<div class="wpbc_ajx_page__section wpbc_setup_wizard_page__section_footer		wpbc_ajx_page__section_footer">
						<div class="wpbc__container_place__footer_buttons 		wpbc_container    wpbc_form    wpbc_container_booking_form">{{{
							wpbc_template__stp_wiz__footer_buttons( data )
						}}}</div>
					</div>
				</div>
			</script><?php
		}


		// -------------------------------------------------------------------------------------------------------------
		// == Timeline Steps  -  Line with Checked Dots  ==
		// -------------------------------------------------------------------------------------------------------------
		private function wpbc_template__timeline_steps(){

			?><script type="text/html" id="tmpl-wpbc_template__timeline_steps">
			<# var wpbc_template__timeline_steps_icons = wp.template( 'wpbc_template__timeline_steps_icons' ); #>
			<div class="wpbc_steps_for_timeline_container">
				<div class="wpbc_steps_for_timeline">
					<#

						var steps_count 	   = wpbc_setup_wizard_page__get_steps_count();
						var actual_step_number = wpbc_setup_wizard_page__get_actual_step_number();

						var css_class_for_step = '';
						var css_class_for_line = '';
						var is_line_exist 	   = false;

						for ( var i = 1; i <= steps_count ; i++ ) {

							is_line_exist = ( i > 1 );

							if ( actual_step_number > i ) {
								css_class_for_step = ' wpbc_steps_for_timeline_step_completed';
								css_class_for_line = 'wpbc_steps_for_timeline_line_active';
					        } else if ( actual_step_number == i ) {
								css_class_for_step = ' wpbc_steps_for_timeline_step_active'
								css_class_for_line = 'wpbc_steps_for_timeline_line_active';
							} else {
								css_class_for_step = '';
								css_class_for_line = '';
							}


					if ( is_line_exist ) { #>
						<div class="wpbc_steps_for_timeline_step_line {{css_class_for_line}}"></div>
					<# } #>
					<div class="wpbc_steps_for_timeline_step {{css_class_for_step}}">
						{{{ wpbc_template__timeline_steps_icons({ }) }}}
					</div>
					<# } #>
				</div>
			</div>
			</script><?php
		}

				//TODO: update icons
				private function wpbc_template__timeline_steps_icons(){
					?><script type="text/html" id="tmpl-wpbc_template__timeline_steps_icons">
							<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img"
								 class="icon icon-success" data-icon="check" data-prefix="fas" focusable="false"
								 aria-hidden="true" width="10" height="10">
								<path xmlns="http://www.w3.org/2000/svg" fill="currentColor"
									  d="M173.898 439.404l-166.4-166.4c-9.997-9.997-9.997-26.206 0-36.204l36.203-36.204c9.997-9.998 26.207-9.998 36.204 0L192 312.69 432.095 72.596c9.997-9.997 26.207-9.997 36.204 0l36.203 36.204c9.997 9.997 9.997 26.206 0 36.204l-294.4 294.401c-9.998 9.997-26.207 9.997-36.204-.001z"></path>
							</svg>
							<svg viewBox="0 0 352 512" xmlns="http://www.w3.org/2000/svg" role="img"
								 class="icon icon-failed" data-icon="times" data-prefix="fas" focusable="false"
								 aria-hidden="true" width="8" height="11">
								<path xmlns="http://www.w3.org/2000/svg" fill="currentColor"
									  d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.2 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.2 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path>
							</svg>
					</script><?php
				}


		// -------------------------------------------------------------------------------------------------------------
		// == Footer Action Buttons ==
		// -------------------------------------------------------------------------------------------------------------
		private function wpbc_template__stp_wiz__footer_buttons(){

			?><script type="text/html" id="tmpl-wpbc_template__stp_wiz__footer_buttons">
				<div class="wpbc__form__div">
					<hr>
					<div class="wpbc__row">
						<?php /* ?>
						<div class="wpbc__field">
							<input type="button" value="<?php esc_attr_e('Reset Wizard and Start from Beginning','booking'); ?>"
								   class="wpbc_button_light wpbc_button_danger tooltip_top "  style=""
								   onclick=" wpbc_ajx__setup_wizard_page__send_request_with_params(  { 'do_action': 'make_reset' }  ); ">
						</div>
 						<?php */ ?>
						<div class="wpbc__field">
							<#  if ( '' != data['steps'][ data['current_step'] ]['prior'] ) { #>
							<a     class="wpbc_button_light"  style="margin-left:auto;margin-right:10px;" tabindex="0"
								   id="btn__toolbar__buttons_prior"
								   onclick=" wpbc_ajx__setup_wizard_page__send_request_with_params( {
								   																		'current_step': '{{data.steps[ data.current_step ].prior}}',
								   																		'do_action': 'none',
								   																		'ui_clicked_element_id': 'btn__toolbar__buttons_prior'
								   																	} );
								   			wpbc_button_enable_loading_icon( this );
											wpbc_admin_show_message_processing( '' );" ><i class="menu_icon icon-1x wpbc_icn_arrow_back_ios"></i><span>&nbsp;&nbsp;&nbsp;<?php _e('Go Back','booking'); ?></span></a>

							<# } else { #>
								<span style="margin-left:auto;"></span>
							<# } #>
							<a	   class="wpbc_button_light button-primary" tabindex="0"
								   id="btn__toolbar__buttons_next"
								   onclick=" wpbc_ajx__setup_wizard_page__send_request_with_params( {
								   																		'current_step': '{{data.steps[ data.current_step ].next}}',
								   																		   'do_action': '{{data.steps[ data.current_step ].do_action}}',
								   																		'ui_clicked_element_id': 'btn__toolbar__buttons_next'
								   																	} );
								   			wpbc_button_enable_loading_icon( this );
											wpbc_admin_show_message_processing( '' );" ><span><?php _e('Save and Continue','booking'); ?>&nbsp;&nbsp;&nbsp;</span><i class="menu_icon icon-1x wpbc_icn_arrow_forward_ios"></i></a>
						</div>
					</div>
					<div class="wpbc__row">
						<div class="wpbc__field">
							<p class="wpbc_exit_link_small">
								<a href="javascript:void(0)" tabindex="-1"
								   onclick=" wpbc_ajx__setup_wizard_page__send_request_with_params( { 'do_action': 'skip_wizard' } ); "
								   title="<?php esc_attr_e('Exit and skip the setup wizard','booking'); ?>"
								><?php
									_e('Exit and skip the setup wizard','booking');
								?></a>
								<?php  ?>
								<a href="javascript:void(0)" class="wpbc_button_danger" style="margin: 25px 0 0;  font-size: 12px;" tabindex="-1"
								   onclick=" wpbc_ajx__setup_wizard_page__send_request_with_params( { 'do_action': 'make_reset' } ); "
								   title="<?php esc_attr_e('Start Setup from Beginning','booking'); ?>"
								><?php
									_e('Reset Wizard','booking');
								?></a>
 								<?php /**/ ?>
							</p>
						</div>
					</div>
				</div>
			</script><?php
		}



		// -------------------------------------------------------------------------------------------------------------
		// == Left Navigation ==
		// -------------------------------------------------------------------------------------------------------------
		/**
		 * Template - Left Navigation
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
		private function wpbc_template__stp_wiz__left_navigation() {
			?><script type="text/html" id="tmpl-wpbc_template__stp_wiz__left_navigation">
				<div class="wpbc_navigation_menu_left">
					<#
						var wpbc_template__stp_wiz__left_navigation_item = wp.template( 'wpbc_template__stp_wiz__left_navigation_item' );
						_.each( data.left_navigation, function ( p_val, p_id, p_data_arr ){
							if ( undefined === p_val.a_style){ p_val.a_style = ''; }
							if ( undefined === p_val.style){   p_val.style = ''; }
					#>{{{
							wpbc_template__stp_wiz__left_navigation_item({
																			'id'      : p_id,
																			'data_arr': p_val
																		})
						}}}
					<# } ); #>
				</div>
			</script><?php
		}

		
		/**
		 * Template - Left Navigation Item
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
		private function wpbc_template__stp_wiz__left_navigation_item() {
			?><script type="text/html" id="tmpl-wpbc_template__stp_wiz__left_navigation_item">
				<div id="{{data.id}}"
					 class="wpbc_navigation_menu_left_item {{data.data_arr.class}}" style="{{data.data_arr.style}}">
					<div class="wpbc_navigation_menu_left_item_container">
						<a class="wpbc_navigation_menu_left_item_a" style="{{data.data_arr.a_style}}" onclick="javascript:{{{data.data_arr.action}}}" href="javascript:void(0);">
							<i class="wpbc_navigation_menu_left_item_icon	menu_icon icon-1x {{data.data_arr.icon}}"></i>
							<div class="wpbc_navigation_menu_left_item_text">{{{data.data_arr.title}}}</div>
						</a>
						<# if ( undefined != data.data_arr.right_icon ) { #>
						<a class="wpbc_navigation_menu_left_item_icon_right" onclick="javascript:{{{data.data_arr.right_icon.action}}}" href="javascript:void(0);"
							><i class="menu_icon icon-1x {{data.data_arr.right_icon.icon}}"></i>
							<# if ( undefined != data.data_arr.right_icon.text ) { #>
								<div class="wpbc_navigation_menu_left_small_text_right">{{{data.data_arr.right_icon.text}}}</div>
							<# } #>
						</a>
						<# } #>
					</div>
				</div>
			</script><?php
		}



		// TODO: Update this
		private function test_right_widget(){
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
	$setup_wizard_page_loading = new WPBC_AJX__Setup_Wizard__Templates;
	$setup_wizard_page_loading->init_load_css_js_tpl();
}

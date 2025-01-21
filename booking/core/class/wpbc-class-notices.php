<?php
/**
 * @version 1.0
 * @package Booking Calendar 
 * @subpackage Notices
 * @category Alerts
 * 
 * @author wpdevelop
 * @link https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2014.10.17
 */

if ( ! defined( 'ABSPATH' ) ) exit;                                             // Exit if accessed directly



class WPBC_Notices {

    private $messages = array();
    
    function __construct() {
        $this->hooks();
    }


    private function hooks(){
		add_action( 'init', array( $this, 'set_messages' ) );              												// FixIn: 10.6.5.1.

        add_action('wpbc_hook_booking_page_header',     array( $this, 'show_system_messages') );
        add_action('wpbc_hook_add_booking_page_header', array( $this, 'show_system_messages') );

        add_action('wpbc_hook_settings_page_header',    array( $this, 'show_system_messages') );
    }

  	// FixIn: 10.6.5.1.
    public function set_messages(){

        $this->messages['updated_paid_to_free'] = '<strong>' . esc_html__('Warning!' ,'booking') . '</strong> '
                                                /* translators: 1: ... */
                                                . sprintf( __( 'Probably you updated your paid version of Booking Calendar by free version or update process failed. You can request the new update of your paid version at %1$sthis page%2$s.', 'booking')
                                                           , '<a href="https://wpbookingcalendar.com/request-update/" target="_blank">', '</a>' );
    }


    /**
     * Define secion for the system messages at the admin panel  and show System Messages.
     * 
     * @param type $my_page
     */
    public function show_system_messages($my_page) {


		if (! empty($this->messages['updated_paid_to_free'])){
			?><div class="wpbc_admin_system_message wpbc_page_<?php echo esc_attr( $my_page ); ?>"><?php

				/** Static messages - user  need to click  for closing these messages */

			if ( wpbc_is_updated_paid_to_free() ) {
				// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
				echo $this->get_formated_message( $this->messages['updated_paid_to_free'], 'updated error' );
			}

			?></div><?php
		}
       /** Dynamic messages - auto-hide,  after  specific number of seconds */
        
//       if ( wpbc_is_updated_paid_to_free() ) 
//            $this->show_message( $this->messages['updated_paid_to_free'] , 20 );    
        
    }
    
    
    /**
     * Show System Message(s) at the top of the admin page. 
     * 
     * @param string $message 
     * @param int $time_to_show -in seconds  if 0 then do not hide message
     * @param string $message_type : 'updated' | 'error'
     */
    public function show_message ( $message, $time_to_show , $message_type = 'updated') {
        
        // Generate unique HTML ID  for the message
        $inner_message_id =  intval( time() * wp_rand(10, 100) );
        
        // Get formated HTML message
        $notice = $this->get_formated_message( $message, $message_type, $inner_message_id );
        
        // Get the time of message showing
        $time_to_show = intval($time_to_show)*1000;
        
        // Show this Message
        ?> <script type="text/javascript">                              
            if ( jQuery('.wpbc_admin_message').length ) {
                    jQuery('.wpbc_admin_message').append( '<?php
						// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
						echo $notice ; ?>' );
                <?php if ( $time_to_show > 0 ) { ?>
                    jQuery('#wpbc_inner_message_<?php echo esc_attr( $inner_message_id ); ?>').animate({opacity: 1},<?php echo esc_attr( $time_to_show ); ?>).fadeOut( 2000 );
                <?php } ?>
            }
        </script> <?php
    }
    
    
    private function get_formated_message ( $message, $message_type = 'updated', $inner_message_id = '') {
        

        // Recheck  for any "lang" shortcodes for replacing to correct language
        $message =  wpbc_lang( $message );
        
        // Escape any JavaScript from  message
        $notice =   html_entity_decode( esc_js( $message ) ,ENT_QUOTES) ;
        
        $notice .= '<a class="close tooltip_left" rel="tooltip" title="'. esc_js(__("Hide" ,'booking')). '" data-dismiss="alert" href="javascript:void(0)" onclick="javascript:jQuery(this).parent().hide();">&times;</a>';

        // $my_close_open_alert_id = 'wpbc_system_message_id_';
        // $notice .= '<a class="close tooltip_left" rel="tooltip" title="'. esc_js(__("Don't show the message anymore" ,'booking')). '" data-dismiss="alert" href="javascript:void(0)" onclick="javascript:wpbc_verify_window_opening('. wpbc_get_current_user_id() .', \''. $my_close_open_alert_id .'\');">&times;</a>';
        if (! empty( $inner_message_id ))
            $inner_message_id = 'id="wpbc_inner_message_'. $inner_message_id .'"';
        
        $notice = '<div '.$inner_message_id.' class="wpbc_inner_message '. $message_type . '">' . $notice . '</div>';
        
        return  $notice;
    }
    
    /*
    function show_alert($message) {
        
        $alert_head = __('Note' ,'booking');
        
        $my_close_open_alert_id = 'bk_alert_settings_form_in_free';
        
        ?>
        <div  class="alert alert-warning alert-block alert-info <?php if ( '1' == get_user_option( 'booking_win_' . $my_close_open_alert_id ) ) echo 'closed'; ?>"                             
              id="<?php echo esc_attr( $my_close_open_alert_id ); ?>">
            <a class="close tooltip_left" rel="tooltip" title="<?php esc_attr_e("Don't show the message anymore" ,'booking');?>" data-dismiss="alert"
               href="javascript:void(0)"
               onclick="javascript:wpbc_verify_window_opening(<?php echo esc_attr( wpbc_get_current_user_id() ); ?>, '<?php echo esc_attr( $my_close_open_alert_id ); ?>');"
               >&times;</a>
            <strong class="alert-heading"><?php echo esc_html( $alert_head ); ?></strong><?php echo esc_attr( $message ); ?>
        </div>
        <?php
    }*/
            
}


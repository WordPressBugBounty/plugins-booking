/**
 * @version 1.0
 * @package Booking Calendar
 * @subpackage Getenberg integration
 * @category inserting into posts
 *
 * @author wpdevelop
 * @link https://wpbookingcalendar.com/
 * @email info@wpbookingcalendar.com
 *
 * @modified 2018-08-23Probably you updated your paid version of Booking Calendar
 */

// FixIn: 8.3.3.99.

var wpbc_gutenberg_active_block_target = {
	block_id: '',
	set_attributes: null
};

/*
		window.wp.blocks,
		window.wp.components,
		window.wp.element

 */
	//( function( blocks, components, element ) {

/**
 * Open the Booking Calendar block configurator for a specific block.
 *
 * This helper receives the clicked element directly because WordPress 7.1 renders
 * the editor canvas in an iframe whose events and DOM are not available through
 * the parent admin document.
 *
 * @param {string}      block_id          Gutenberg client ID for the block.
 * @param {string|number} popup_tab_index Legacy configurator tab index.
 * @param {string}      popup_shortcode_id Modern configurator section ID.
 * @param {Element|null} trigger_element   Element that opened the configurator.
 * @param {Function|null} set_attributes   Attribute updater from the live block edit instance.
 * @return {boolean} Whether the configurator was opened.
 */
function wpbc_gutenberg_open_configurator( block_id, popup_tab_index, popup_shortcode_id, trigger_element, set_attributes ) {
	var block_wrapper;
	var normalized_tab_index = parseInt( popup_tab_index, 10 );

	if ( ! block_id || ( 'function' !== typeof wpbc_tiny_btn_click ) ) {
		return false;
	}

	if ( isNaN( normalized_tab_index ) ) {
		normalized_tab_index = 0;
	}

	if ( trigger_element && ( 'function' === typeof trigger_element.closest ) ) {
		block_wrapper = trigger_element.closest( 'div[data-block]' );
		if ( block_wrapper ) {
			block_wrapper.classList.remove( 'is-selected' );
		}
	}

	wpbc_tiny_btn_click( '' );
	jQuery( '#wpbc_text_gettenberg_section_id' ).val( block_id );
	wpbc_gutenberg_active_block_target = {
		block_id: block_id,
		set_attributes: ( 'function' === typeof set_attributes ) ? set_attributes : null
	};

	if ( popup_shortcode_id && jQuery( '#wpbc_shortcode_config__nav_tab__' + popup_shortcode_id + ' a' ).length ) {
		jQuery( '#wpbc_shortcode_config__nav_tab__' + popup_shortcode_id + ' a' ).first().trigger( 'click' );
	} else {
		jQuery( '#wpbc_tiny_modal .wpdvlp-top-tabs a.nav-tab' ).eq( normalized_tab_index ).trigger( 'click' );
	}

	return true;
}

/**
 * Handle the React click event for the block configuration control.
 *
 * @param {Event}    event          React synthetic click event from the editor iframe.
 * @param {Function} set_attributes Attribute updater from the live block edit instance.
 * @return {boolean} Whether the configurator was opened.
 */
function wpbc_gutenberg_handle_configure_click( event, set_attributes ) {
	var trigger_element = event.currentTarget;

	event.preventDefault();
	event.stopPropagation();

	return wpbc_gutenberg_open_configurator(
		trigger_element.getAttribute( 'data_block_id' ),
		trigger_element.getAttribute( 'popup_tab_index' ),
		trigger_element.getAttribute( 'popup_shortcode_id' ),
		trigger_element,
		set_attributes
	);
}

/**
 * Handle the React click event for the preview's edit control.
 *
 * @param {Event} event React synthetic click event from the editor iframe.
 * @return {boolean} Whether a matching configuration control was activated.
 */
function wpbc_gutenberg_handle_preview_edit_click( event ) {
	var preview_wrapper;
	var configure_button;

	event.preventDefault();
	event.stopPropagation();

	preview_wrapper = event.currentTarget.closest( '.wpbc_gb_div_block' );
	configure_button = preview_wrapper ? preview_wrapper.querySelector( '.wpbc-gutenberg-open-btn' ) : null;

	if ( ! configure_button ) {
		return false;
	}

	configure_button.click();
	return true;
}

	( function( wp ) {
		/**
		 * Registers a new block provided a unique name and an object defining its behavior.
		 * @see https://github.com/WordPress/gutenberg/tree/master/blocks#api
		 */
		var registerBlockType = wp.blocks.registerBlockType;

		/**
		 * Returns a new element of given type. Element is an abstraction layer atop React.
		 * @see https://github.com/WordPress/gutenberg/tree/master/packages/element#element
		 */
		var el = wp.element.createElement;

		/**
		 * Retrieves the translation of text.
		 * @see https://github.com/WordPress/gutenberg/tree/master/i18n#api
		 */
		var __ = wp.i18n.__;

		// FixIn: 8.4.3.1.
		/*
		var source = wp.blocks.source,
		    RichText = wp.editor.RichText,
			BlockControls = wp.editor.BlockControls,
			AlignmentToolbar = wp.editor.AlignmentToolbar;*/

		/**
		 * Custom SVG path for Booking Calendar icon
		 */
		// var wpbc_icon = el('svg', { width: 16, height: 16, fill: "currentColor", className: "bi bi-calendar3-range", viewBox: "-2 -1 20 20"  },
		//   el('path', { d: "M14 0H2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zM1 3.857C1 3.384 1.448 3 2 3h12c.552 0 1 .384 1 .857v10.286c0 .473-.448.857-1 .857H2c-.552 0-1-.384-1-.857V3.857z" } ),
		//   el('path', { d: "M7 10a1 1 0 0 0 0-2H1v2h6zm2-3h6V5H9a1 1 0 0 0 0 2z" } )
		// );

		// FixIn: 10.11.3.3.
		var wpbc_icon = el('svg', { width: 16, height: 16, fill: "currentColor", className: "bi bi-calendar3-range", viewBox: "0 0 550 550"  },
		  el('path', { d: "M275 162.36c-92.32 0-167.15 77.82-167.15 173.81S182.69 509.99 275 509.99s167.15-77.82 167.15-173.82S367.31 162.36 275 162.36Zm0 264.53c-50.1 0-90.71-40.61-90.71-90.71s40.61-90.71 90.71-90.71 90.71 40.61 90.71 90.71-40.61 90.71-90.71 90.71Z", fill: "#eee" } ),
		  el('path', { d: "M340.53 398.91c-14.85 15.51-35.16 25.76-57.84 27.66-54.87 4.6-101.64-41.14-98.23-96.1 2.94-47.44 42.35-85.01 90.54-85.01 24.84 0 47.34 9.98 63.72 26.16 5.86 5.78 15.29 5.73 21.11-.09l35.14-35.14c5.69-5.69 5.9-14.87.43-20.77-30.41-32.83-73.1-53.26-120.4-53.26-92.32 0-167.15 77.82-167.15 173.81S182.69 509.99 275 509.99c48.49 0 92.15-21.47 122.68-55.76 5.29-5.94 5.02-14.97-.6-20.59l-35.05-35.05c-5.98-5.98-15.67-5.79-21.51.32Z", fill: "#000" } ),
		  el('path', { d: "M112.53 261.27c12.34-39.07 38.32-70.02 77.79-97.04.92-.63 1.48-1.67 1.48-2.79V14.76c0-4.28-3.68-7.76-8.22-7.76h-3.76c-18.56 0-73.17 40.3-71.79 60.62l-.17 192.91c0 2.74 3.86 3.34 4.68.73Z", fill: "#000" } )
		);

		registerBlockType( 'booking/booking', {

			title: 'Booking Calendar',

			description: __( 'Show a booking form, availability calendar or other elements from Booking Calendar plugin.' ),

			icon: wpbc_icon,			// FixIn: 9.5.2.1.

			// icon:  {
			// 			// Specifying a background color to appear with the icon e.g.: in the inserter.
			// 			background: 'rgb(129, 142, 160)',
			// 			// Specifying a color for the icon (optional: if not set, a readable color will be automatically defined)
			// 			foreground: '#fff',
			// 			// Specifying a dashicon for the block
			// 			src: 'calendar-alt'
			// 		},

			category: 'common',					// common | formatting | layout | widgets | embed

			/*
			// Use the block just once per post 	// its possible to use several Booking Calendar forms for different booking resources
			multiple: false,
			*/

			// // Add the support for block's alignment (left, center, right, wide, full).
			// align: true,
			//
			// // Pick which alignment options to display.
			// align: [ 'left', 'right', 'full' ],

			keywords: [ 'wpbc' , 'oplugins', 'form' ],

			// // Specifying my block attributes
			attributes: {
							/*content: {
											type: 'string',
											source: 'children',
											selector: 'p',
										},*/

							wpbc_shortcode: {
												type: 'string',
												default: ''
											}
			},

			deprecated: [
				{
					supports: {},
					attributes: {
						wpbc_shortcode: {
							type: 'string',
							source: 'text',
							selector: 'div',
							default: ''
						}
					},

					/**
					 * Migrate a shortcode recovered from historical saved block markup.
					 *
					 * Some released posts contain a missing or stale comment attribute while
					 * retaining the complete shortcode inside the saved div. The deprecated
					 * parser makes that visible text authoritative only during recovery.
					 *
					 * @param {Object} attributes Parsed deprecated block attributes.
					 * @return {Object} Current block attributes containing the recovered shortcode.
					 */
					migrate: function( attributes ) {
						return {
							wpbc_shortcode: attributes.wpbc_shortcode || ''
						};
					},

					/**
					 * Reproduce the historical wrapper while WordPress validates old content.
					 *
					 * @param {Object} props Deprecated block properties.
					 * @return {Object} WordPress element for the historical saved markup.
					 */
					save: function( props ) {
						return el( 'div', null, props.attributes.wpbc_shortcode );
					}
				}
			],


			edit: function( props ) {

//console.log( 'WPBC-Gb :: Edit :', props );

					jQuery( '.wpbc-gutenberg-update-view').remove();

					var children = [],
					cid =  props.clientId;	// its reference to unique 'data-block' attribute in section: <div class="editor-block-list__block-edit" data-block="8a1b713a-6981-43d3-a1f5-ce98b0e611d4"> ...

					var btnClassName = 'button wpbc-gutenberg-open-btn';


					////////////////////////////////////////////////////////////////////////////////////////////////////
					////////////////////////////////////////////////////////////////////////////////////////////////////

					// The block attribute is the only authoritative editor value. Reading the
					// mounted input here races React's next commit: after the configurator
					// calls setAttributes(), the old input still contains the previous value
					// and would immediately overwrite the new shortcode during this render.
					var _val = props.attributes.wpbc_shortcode;

					if ( typeof _val == typeof undefined ) {
						_val = '';
					}

					////////////////////////////////////////////////////////////////////////////////////////////////////
					////////////////////////////////////////////////////////////////////////////////////////////////////


					children.push(
						el( 'a',
						   {
								className : btnClassName,
								// href      : 'javascript:void(0)',													//FixIn: 8.7.3.17	href: '#!'
							    href         : '#!',
								data_block_id: cid,
							    popup_tab_index: 0,						// Will be index for active tab in popup dialog
							    popup_shortcode_id: '',
								onClick: function( event ) {
									return wpbc_gutenberg_handle_configure_click( event, props.setAttributes );
								},
							    key: 'configure_' + cid																// FixIn: 8.7.3.18.
							},
						__( 'Configure Booking Calendar Block' )
						)
					);

					// Visual Preview of Block
					children = wpbc_gt_parse_shortcode( props.attributes.wpbc_shortcode, children , cid );				// FixIn: 8.7.3.18.

//console.log( 'WPBC children', children) ;

					children.push(

						el(
							'input',
							{
								key: 'onchangewpbcinput_' + cid,														// FixIn: 8.7.3.18.
								value	  : _val, //props.attributes.wpbc_shortcode,
								onChange  : function ( event ) {
												props.setAttributes( {wpbc_shortcode: event.target.value } );
//console.log( '%cWPBC-Gb :: o n C h a n  g e  !!!! Y E S  !!! event for onChangeWPBCinputShortcode', 'color: orange; font-weight: bold;', event );
											},
								onClick: function (event) {																// FixIn: 8.8.2.10.
										props.setAttributes( {wpbc_shortcode: event.target.value } );
								},
								className: 'wpbc_gb_text_shortcode',
								type     : 'text',
								//readOnly : 'readonly',																// FixIn: 8.8.2.10.
								//disabled : 'disabled',																// FixIn: 8.8.2.10.
								// onFocus  : function ( event ){
								// 								event.target.select();
								// 		}
							}
						)

					);


					// Show Hided Block (after configuration) -- React  update Block preview
					jQuery( '.wpbc_gb_div_block' ).parent().removeClass( 'hidden' );


					var wpbc_gb_div_block_css = 'wpbc_gb_div_block';
					if ( '' == props.attributes.wpbc_shortcode ) {
						// If no shortcode at all,  then  do not hide configure button
						wpbc_gb_div_block_css += ' wpbc_gb_div_block_no_shortcode';
					}

					return el( 'div', { className: wpbc_gb_div_block_css }, children );
			},


			save: function( props ) {

//console.log( 'WPBC-Gb :: Saving ', props );

				return el( 'div', null, props.attributes.wpbc_shortcode );
			}


		} );


	} )(
		window.wp
	);


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


	( function( $ ) {

		$( document ).on( 'click', '.wpbc_gb_block_preview_inner_title_edit', function( e ) {
//jQuery( '.wpbc-gutenberg-open-btn' ).hide();
			$( this ).closest( '.wpbc_gb_div_block' ).find( '.wpbc-gutenberg-open-btn' ).trigger( 'click' );			// FixIn: 8.7.11.12.

		});

		/**
		 *  Open popup window for configuration Booking Calendar shortcode
		 */
		$( document ).on( 'click', '.wpbc-gutenberg-open-btn', function( e ) {

			e.preventDefault();
			wpbc_gutenberg_open_configurator(
				$( this ).attr( 'data_block_id' ),
				$( this ).attr( 'popup_tab_index' ),
				$( this ).attr( 'popup_shortcode_id' ),
				this
			);

		});


		/**
		 *  Remove Update view button  after clicking on it.
		 */
		$( document ).on( 'click', '.wpbc-gutenberg-update-preview-btn', function( e ) {

			e.preventDefault();

			jQuery( '.wpbc-gutenberg-update-view').remove();

//console.log( 'WPBC-Gb :: Preview button clicked. Section #' );

		});


	} ) ( jQuery );


	/**
	 * Send shortcode from popup dialog into the gutenberg sections.
	 *
	 * @param shortcode_text
	 * @returns {boolean}
	 */
	function wpbc_send_text_to_gutenberg( shortcode_text ){

		// Get ID of section, where to  insert  shortcode configuraiton
		var block_section_id = jQuery( "#wpbc_text_gettenberg_section_id" ).val();
		var block_editor_select;
		var block_editor_dispatch;
		var target_block;
		var shortcode_input;
		var active_set_attributes;

//console.log( 'WPBC-Gb :: wpbc_send_text_to_gutenberg' , shortcode_text, block_section_id );

		if ( '' == block_section_id ) {

			return false;		// if no such  block then just return  false, its means tha inserting in Classic block - TinyMCE
		}

		// Use the updater from this exact block edit instance. Unlike the global
		// data registry, this callback remains bound to a scoped BlockEditorProvider.
		if (
			block_section_id === wpbc_gutenberg_active_block_target.block_id &&
			'function' === typeof wpbc_gutenberg_active_block_target.set_attributes
		) {
			active_set_attributes = wpbc_gutenberg_active_block_target.set_attributes;
			wpbc_gutenberg_active_block_target = {
				block_id: '',
				set_attributes: null
			};
			active_set_attributes(
				{ wpbc_shortcode: shortcode_text }
			);
			return true;
		}

		// Retain a verified fallback for editors that expose their block store in
		// the global registry. Do not report success unless that registry owns the
		// exact Booking Calendar block targeted by the configurator.
		if (
			wp.data &&
			( 'function' === typeof wp.data.select ) &&
			( 'function' === typeof wp.data.dispatch )
		) {
			block_editor_select = wp.data.select( 'core/block-editor' );
			target_block = block_editor_select && ( 'function' === typeof block_editor_select.getBlock )
				? block_editor_select.getBlock( block_section_id )
				: null;

			if ( target_block && ( 'booking/booking' === target_block.name ) ) {
				block_editor_dispatch = wp.data.dispatch( 'core/block-editor' );
			}

			if ( block_editor_dispatch && ( 'function' === typeof block_editor_dispatch.updateBlockAttributes ) ) {
				block_editor_dispatch.updateBlockAttributes(
					block_section_id,
					{ wpbc_shortcode: shortcode_text }
				);
				return true;
			}
		}


		// Code to  insert into Gutenberg section in our text field
		shortcode_input = jQuery( 'div[data-block="' + block_section_id + '"] .wpbc_gb_text_shortcode' );
		if ( ! shortcode_input.length ) {
			return false;
		}
		shortcode_input.val( shortcode_text );

		//Its does not work for automatic generating "Edit" event :((( , so we make some workarround in Edit block event
		shortcode_input.trigger( 'focus' ).trigger('mousedown').trigger( 'click' ).trigger('mouseup').trigger('change');

		// FixIn: 8.4.2.10.
		//FixIn: 8.7.3.17	href: '#!'
		//FixIn: 8.7.3.19		- chnaged <a href="#!" to '<div href="#!"	- its make update of block  after  clicking on DIV (and not A) element

//FixIn: 8.8.2.10	- commenting these 2 blocks
// jQuery( 'div[data-block="' + block_section_id + '"]' ).parent().parent().before(
// 	'<div class="editor-block-list__block wpbc-gutenberg-update-view" style="cursor: pointer;text-align: center;">' +
// 	'<div href="#!" class="button wpbc-gutenberg-update-preview-btn" ' +
// 	'>' + wp.i18n.__( 'Click to Preview Block' ) + '</div></div>'
// );
// 			// FixIn: 8.7.6.11.
// jQuery( 'div[data-block="' + block_section_id + '"]' ).before(
// 	'<div class="editor-block-list__block wpbc-gutenberg-update-view" style="cursor: pointer;text-align: center;">' +
// 	'<div href="#!" class="button wpbc-gutenberg-update-preview-btn" ' +
// 	'>' + wp.i18n.__( 'Click to Preview Block' ) + '</div></div>'
// );



		// Hide entire Block -- until React does not update Block preview
		//jQuery( 'div[data-block="' + block_section_id + '"]' ).addClass( 'hidden' );									//FixIn: 8.8.2.10		- commenting

		// Neet to return true, to prevent insertion into some other TinyMCE block, if exist, because we have inserted it into Gutenberg
		return true;
	}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

	/**
	 * Parse shortcode in text  field and show Visual Preview of element
	 *
	 * @param shortcode_in_text	- shortcode from  text field
	 * @param children			- array of el for gnerating preview
	 * @returns 				- array of el
	 */
	function wpbc_gt_parse_shortcode( shortcode_in_text, children, cid ){												// FixIn: 8.7.3.18.

//console.log( 'wpbc_gt_parse_shortcode cid', cid );

		var   wpbc_shortcode_type
			, shortcode_obj
			, block_preview_el = ''
			, el = wp.element.createElement;

		var block_header_txt, block_text_txt;

		var wpbc_shortcode_type_arr = [   'booking'
										, 'bookingcalendar'
										, 'booking_appointment'
										, 'booking_resource_selector'
										, 'bookingtimeline'
										, 'bookingselect'
										, 'bookingform'
										, 'bookingsearch'
										, 'bookingsearchresults'
										, 'bookingedit'
										, 'bookingcustomerlisting'
										, 'bookingresource'
										, 'booking_confirm'
										, 'booking-manager-import'
										, 'booking-manager-listing'
									  ];
		var wpbc_shortcode_type_arr_length = wpbc_shortcode_type_arr.length;

		for ( var i = 0; i < wpbc_shortcode_type_arr_length ; i++ ){

			wpbc_shortcode_type = wpbc_shortcode_type_arr[ i ];

			shortcode_obj = wp.shortcode.next( wpbc_shortcode_type, shortcode_in_text, 0 );				// Parse shortcode

			if ( undefined != shortcode_obj ){

				block_preview_el = '';
//console.log( 'wpbc_shortcode_type' , wpbc_shortcode_type);
				// Get Preview
				switch ( wpbc_shortcode_type ){

					case 'booking':
						block_preview_el = wpbc_gt_get_visual_block_for_booking( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid		// FixIn: 8.7.3.18.
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = 0;									// Set index of Active tab in popup dialog
						break;

					case 'bookingcalendar':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingcalendar( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = 2;									// Set index of Active tab in popup dialog
						break;

					case 'booking_appointment':
						block_preview_el = wpbc_gt_get_visual_block_for_booking_appointment( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_shortcode_id = 'booking_appointment';
						break;

					case 'booking_resource_selector':
						block_preview_el = wpbc_gt_get_visual_block_for_booking_resource_selector( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_shortcode_id = 'booking_resource_selector';
						break;

					case 'bookingtimeline':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingtimeline( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = 1;									// Set index of Active tab in popup dialog
						break;

					case 'bookingselect':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingselect( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = 3;									// Set index of Active tab in popup dialog
						break;

					case 'bookingform':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingform( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = 5;									// Set index of Active tab in popup dialog
						break;

					case 'bookingsearch':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingsearch( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = 4;									// Set index of Active tab in popup dialog
						break;

					case 'bookingsearchresults':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingsearchresults( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = 4;									// Set index of Active tab in popup dialog
						break;

					case 'bookingedit':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingedit( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = -1;									// Set index of Active tab in popup dialog
						break;

					case 'bookingcustomerlisting':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingcustomerlisting( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = -1;									// Set index of Active tab in popup dialog
						break;

					case 'bookingresource':
						block_preview_el = wpbc_gt_get_visual_block_for_bookingresource( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = -1;									// Set index of Active tab in popup dialog
						break;

					case 'booking_confirm':
						block_preview_el = wpbc_gt_get_visual_block_for_booking_confirm( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						children[ (children.length - 1) ].props.popup_tab_index = -1;									// Set index of Active tab in popup dialog
						break;

					case 'booking-manager-import':
						block_preview_el = wpbc_gt_get_visual_block_for_booking_manager_import( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						//block_preview_el = el( 'div', { className: 'test' }, 'Test Import 1' );
						children[ (children.length - 1) ].props.popup_tab_index = -1;									// Set index of Active tab in popup dialog
						break;

					case 'booking-manager-listing':
						block_preview_el = wpbc_gt_get_visual_block_for_booking_manager_listing( shortcode_obj.shortcode, {
																									'shortcode_in_text': shortcode_in_text
																									, 'cid_key': wpbc_shortcode_type+ '_' + cid
																						} );
						//block_preview_el = el( 'div', { className: 'test' }, 'Test 2' );
						children[ (children.length - 1) ].props.popup_tab_index = -1;									// Set index of Active tab in popup dialog
						break;

					default:
						block_preview_el = wpbc_gt_get_visual_block_for_default( shortcode_obj.shortcode
												, {
													'shortcode_in_text': shortcode_in_text,
													'block_header'     : block_header_txt,
													'block_text'       : block_text_txt
													, 'cid_key': wpbc_shortcode_type+ '_' + cid
												}
						);

				}

//console.log( 'WPBC-Gb :: block_preview_el', block_preview_el);

				if ( '' != block_preview_el ){
					children.push( block_preview_el );
				}
			}

		}

		return children;
	}


	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


	/**
	 *  Generate Visual Preview Block  - just general Shortcode
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_default( shortcode_obj, params ){

		// Booking Form Parameters		// FixIn: 10.0.0.16.
		var shortcode_defaults = {
			type      	: 1,
			resource_id : 1,
			nummonths : 1,
			form_type : 'standard',
			aggregate : null,
			startmonth: null,
			options   : null
		};

		// // Calendar Parameters
		// var shortcode_defaults = {
		// 	type      : 1,
		//  resource_id : 1,
		// 	nummonths : 1,
		// 	aggregate : null,
		// 	startmonth: null,
		// 	options   : null
		// };

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: params[ 'block_header' ], cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters(
											[
												  { block_text: params[ 'block_text' ] }
												, { name: 'Booking form', value: 'super-booking-admin'}
												, { name: 'Number of months to show', value: '2'}
											]
											, { cid_key: 'body_' + params[ 'cid_key' ] }
									  )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_default' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End
	}


	/**
	 * Generate one configuration-box preview for a workflow shortcode.
	 *
	 * @param shortcode_obj Parsed WordPress shortcode object.
	 * @param params        Preview instance parameters.
	 * @param configuration Header, description, CSS class, and parameter labels.
	 * @returns React preview element.
	 */
	function wpbc_gt_get_visual_block_for_workflow( shortcode_obj, params, configuration ){

		var props = shortcode_obj.attrs && shortcode_obj.attrs.named ? shortcode_obj.attrs.named : {};
		var rows_in_content = [
			{ block_text: configuration.description }
		];

		for ( var parameter_index = 0; parameter_index < configuration.parameters.length; parameter_index++ ) {
			var parameter = configuration.parameters[ parameter_index ];
			if ( ! Object.prototype.hasOwnProperty.call( props, parameter.key ) ) {
				continue;
			}

			var parameter_value = props[ parameter.key ];
			if ( '' === parameter_value ) {
				parameter_value = wp.i18n.__( '(empty)' );
			} else if ( parameter.prefix ) {
				parameter_value = parameter.prefix + parameter_value;
			}
			rows_in_content.push( { name: parameter.label, value: parameter_value } );
		}

		var el = wp.element.createElement;
		var inner_header = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_header',
										key: 'header_' + params[ 'cid_key' ]
									},
									wpbc_gb_tpl_header( { header: configuration.header, cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_body',
										key: 'body_' + params[ 'cid_key' ]
									},
									wpbc_gb_tpl_shortcode_parameters( rows_in_content, { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_footer',
										key: 'footer_' + params[ 'cid_key' ]
									},
									wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return el( 'div', {
								className: 'wpbc_gb_block_shortcode_preview_wrapper ' + configuration.class_name,
								key: 'preview_wrapper_' + params[ 'cid_key' ]
							},
						el( 'div', {
											className: 'wpbc_gb_block_shortcode_preview_content',
											key: 'preview_content_' + params[ 'cid_key' ]
										},
									[ inner_header, inner_body ]
							),
						inner_footer
				);
	}


	/**
	 * Generate the [booking_appointment] Gutenberg configuration preview.
	 *
	 * @param shortcode_obj Parsed shortcode.
	 * @param params        Preview instance parameters.
	 * @returns React preview element.
	 */
	function wpbc_gt_get_visual_block_for_booking_appointment( shortcode_obj, params ){

		return wpbc_gt_get_visual_block_for_workflow(
			shortcode_obj,
			params,
			{
				header: wp.i18n.__( 'Appointment Booking' ),
				description: wp.i18n.__( 'Service-first appointment booking: visitors choose a Service and compatible Provider before selecting dates and entering booking details.' ),
				class_name: 'wpbc_gb_block_preview_booking_appointment',
				parameters: [
					{ key: 'service_id', label: wp.i18n.__( 'Preselected Service' ), prefix: 'ID = ' },
					{ key: 'provider_id', label: wp.i18n.__( 'Preselected Provider' ), prefix: 'ID = ' },
					{ key: 'services', label: wp.i18n.__( 'Allowed Services' ), prefix: 'ID = ' },
					{ key: 'providers', label: wp.i18n.__( 'Allowed Providers' ), prefix: 'ID = ' },
					{ key: 'auto_select_provider', label: wp.i18n.__( 'Auto-select the only Provider' ) },
					{ key: 'catalog_layout', label: wp.i18n.__( 'Catalog layout' ) },
					{ key: 'show_resource_filters', label: wp.i18n.__( 'Show catalog search' ) },
					{ key: 'show_resource_image', label: wp.i18n.__( 'Show images' ) },
					{ key: 'show_resource_title', label: wp.i18n.__( 'Show titles' ) },
					{ key: 'show_resource_description', label: wp.i18n.__( 'Show Service descriptions' ) },
					{ key: 'catalog_item_width', label: wp.i18n.__( 'Catalog item width' ) },
					{ key: 'catalog_item_max_width', label: wp.i18n.__( 'Maximum catalog item width (px)' ) },
					{ key: 'catalog_grid_items_per_row', label: wp.i18n.__( 'Grid items per row' ) },
					{ key: 'catalog_list_items_per_row', label: wp.i18n.__( 'List items per row' ) },
					{ key: 'show_resource_hierarchy', label: wp.i18n.__( 'Show Service relationship' ) },
					{ key: 'show_availability', label: wp.i18n.__( 'Show availability summary' ) },
					{ key: 'show_starting_price', label: wp.i18n.__( 'Show starting price' ) },
					{ key: 'form_type', label: wp.i18n.__( 'Booking Form' ) },
					{ key: 'nummonths', label: wp.i18n.__( 'Visible months number' ) },
					{ key: 'startmonth', label: wp.i18n.__( 'Start month' ) },
					{ key: 'calendar_dates_start', label: wp.i18n.__( 'First calendar date' ) },
					{ key: 'calendar_dates_end', label: wp.i18n.__( 'Last calendar date' ) },
					{ key: 'allow_past', label: wp.i18n.__( 'Allow past bookings' ) },
					{ key: 'show_progress', label: wp.i18n.__( 'Show progress' ) },
					{ key: 'progress_item_1_number', label: wp.i18n.__( 'Step 1 number' ) },
					{ key: 'progress_item_1_title', label: wp.i18n.__( 'Step 1 title' ) },
					{ key: 'progress_item_2_number', label: wp.i18n.__( 'Step 2 number' ) },
					{ key: 'progress_item_2_title', label: wp.i18n.__( 'Step 2 title' ) },
					{ key: 'progress_item_3_number', label: wp.i18n.__( 'Step 3 number' ) },
					{ key: 'progress_item_3_title', label: wp.i18n.__( 'Step 3 title' ) },
					{ key: 'progress_service_number', label: wp.i18n.__( 'Step 1 number (compatibility)' ) },
					{ key: 'progress_service_title', label: wp.i18n.__( 'Step 1 title (compatibility)' ) },
					{ key: 'progress_provider_number', label: wp.i18n.__( 'Step 2 number (compatibility)' ) },
					{ key: 'progress_provider_title', label: wp.i18n.__( 'Step 2 title (compatibility)' ) },
					{ key: 'progress_details_number', label: wp.i18n.__( 'Step 3 number (compatibility)' ) },
					{ key: 'progress_details_title', label: wp.i18n.__( 'Step 3 title (compatibility)' ) },
					{ key: 'screen_1_title', label: wp.i18n.__( 'Service screen title' ) },
					{ key: 'screen_1_description', label: wp.i18n.__( 'Service screen description' ) },
					{ key: 'screen_2_title', label: wp.i18n.__( 'Provider screen title' ) },
					{ key: 'screen_2_description', label: wp.i18n.__( 'Provider screen description' ) },
					{ key: 'options', label: wp.i18n.__( 'Options' ) }
				]
			}
		);
	}


	/**
	 * Generate the [booking_resource_selector] Gutenberg configuration preview.
	 *
	 * @param shortcode_obj Parsed shortcode.
	 * @param params        Preview instance parameters.
	 * @returns React preview element.
	 */
	function wpbc_gt_get_visual_block_for_booking_resource_selector( shortcode_obj, params ){

		return wpbc_gt_get_visual_block_for_workflow(
			shortcode_obj,
			params,
			{
				header: wp.i18n.__( 'Booking Resource Selector' ),
				description: wp.i18n.__( 'Resource-first booking: visitors choose a Booking Resource before selecting dates and completing its Booking Form.' ),
				class_name: 'wpbc_gb_block_preview_booking_resource_selector',
				parameters: [
					{ key: 'resource_id', label: wp.i18n.__( 'Preselected Booking Resource' ), prefix: 'ID = ' },
					{ key: 'resources', label: wp.i18n.__( 'Allowed Booking Resources' ), prefix: 'ID = ' },
					{ key: 'type', label: wp.i18n.__( 'Allowed Booking Resources (compatibility)' ), prefix: 'ID = ' },
					{ key: 'selected_resource_id', label: wp.i18n.__( 'Preselected Booking Resource (compatibility)' ), prefix: 'ID = ' },
					{ key: 'selected_type', label: wp.i18n.__( 'Preselected Booking Resource (legacy)' ), prefix: 'ID = ' },
					{ key: 'aggregate', label: wp.i18n.__( 'Aggregate Booking Resources' ), prefix: 'ID = ' },
					{ key: 'auto_select_resource', label: wp.i18n.__( 'Auto-select Booking Resource' ) },
					{ key: 'catalog_layout', label: wp.i18n.__( 'Resource layout' ) },
					{ key: 'show_resource_filters', label: wp.i18n.__( 'Show Resource search' ) },
					{ key: 'show_resource_image', label: wp.i18n.__( 'Show Resource image' ) },
					{ key: 'show_resource_title', label: wp.i18n.__( 'Show Resource title' ) },
					{ key: 'show_resource_description', label: wp.i18n.__( 'Show Resource description' ) },
					{ key: 'catalog_item_width', label: wp.i18n.__( 'Resource item width' ) },
					{ key: 'catalog_item_max_width', label: wp.i18n.__( 'Maximum Resource item width (px)' ) },
					{ key: 'catalog_grid_items_per_row', label: wp.i18n.__( 'Grid items per row' ) },
					{ key: 'catalog_list_items_per_row', label: wp.i18n.__( 'List items per row' ) },
					{ key: 'show_resource_hierarchy', label: wp.i18n.__( 'Show Resource hierarchy' ) },
					{ key: 'show_availability', label: wp.i18n.__( 'Show availability summary' ) },
					{ key: 'show_starting_price', label: wp.i18n.__( 'Show starting price' ) },
					{ key: 'form_type', label: wp.i18n.__( 'Booking Form' ) },
					{ key: 'nummonths', label: wp.i18n.__( 'Visible months number' ) },
					{ key: 'startmonth', label: wp.i18n.__( 'Start month' ) },
					{ key: 'calendar_dates_start', label: wp.i18n.__( 'First calendar date' ) },
					{ key: 'calendar_dates_end', label: wp.i18n.__( 'Last calendar date' ) },
					{ key: 'selected_dates', label: wp.i18n.__( 'Preselected dates' ) },
					{ key: 'allow_past', label: wp.i18n.__( 'Allow past bookings' ) },
					{ key: 'show_progress', label: wp.i18n.__( 'Show progress' ) },
					{ key: 'progress_item_1_number', label: wp.i18n.__( 'Step 1 number' ) },
					{ key: 'progress_item_1_title', label: wp.i18n.__( 'Step 1 title' ) },
					{ key: 'progress_item_2_number', label: wp.i18n.__( 'Step 2 number' ) },
					{ key: 'progress_item_2_title', label: wp.i18n.__( 'Step 2 title' ) },
					{ key: 'screen_1_title', label: wp.i18n.__( 'Resource screen title' ) },
					{ key: 'screen_1_description', label: wp.i18n.__( 'Resource screen description' ) },
					{ key: 'label', label: wp.i18n.__( 'Resource screen title (compatibility)' ) },
					{ key: 'options', label: wp.i18n.__( 'Options' ) }
				]
			}
		);
	}


	/**
	 *  Generate Visual Preview Block of Booking form
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_booking( shortcode_obj, params ){

		// Booking Form Parameters		// FixIn: 10.0.0.16.
		var shortcode_defaults = {
			type      : 1,
			resource_id : 1,
			nummonths : 1,
			form_type : 'standard',
			aggregate : null,
			startmonth: null,
			options   : null
		};


		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		var inner_header = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_header'
										, key: 'header_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Booking Form' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_body'
										, key: 'body_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_booking( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_footer'
										, key: 'footer_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);


		return  el( 'div', {
							className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_booking'
							, key: 'preview_wrapper_' + params[ 'cid_key' ]												// FixIn: 8.7.3.18.
						}
					, el( 'div', {
									className: 'wpbc_gb_block_shortcode_preview_content'
									, key: 'preview_content_' + params[ 'cid_key' ]										// FixIn: 8.7.3.18.
								}
								, [ inner_header, inner_body ]
						)
					, inner_footer
				);
	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_booking( props ){
			//console.log( 'WPBC::props', props, props[ 'type' ], props[ 'resource_id' ]);
			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			if ( (undefined != props[ 'type' ]) && ( 1 != props[ 'type' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'type' ]} );
			}
			// FixIn: 10.0.0.16.
			if ( (undefined != props[ 'resource_id' ]) && ( 1 != props[ 'resource_id' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'resource_id' ]} );
			}
			if ( undefined != props[ 'nummonths' ] ){
				rows_in_content.push( {name: wp.i18n.__( 'Visible months number' ), value: props[ 'nummonths' ]} );
			}
			if ( undefined != props[ 'startmonth' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Start month' ), value: props[ 'startmonth' ] } );
			}
			if ( ( undefined != props[ 'form_type' ] ) && ( 'standard' != props[ 'form_type' ] )  ){
				rows_in_content.push( { name: wp.i18n.__( 'Custom booking form' ), value: props[ 'form_type' ] } );
			}
			if ( undefined != props[ 'aggregate' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Unavailable dates from other booking resources' ), value: 'ID = ' + props[ 'aggregate' ] } );
			}
			if ( undefined != props[ 'options' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Options' ), value: props[ 'options' ] } );
			}

			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of Booking form
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingcalendar( shortcode_obj, params ){

		// Booking Form Parameters		// FixIn: 10.0.0.16.
		var shortcode_defaults = {
			type      : 1,
			resource_id : 1,
			nummonths : 1,
			aggregate : null,
			startmonth: null,
			options   : null
		};


		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		var inner_header = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_header'
										, key: 'header_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Availability Calendar' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_body'
										, key: 'body_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingcalendar( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_footer'
										, key: 'footer_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);


		return  el( 'div', {
							  className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingcalendar'
							, key: 'preview_wrapper_' + params[ 'cid_key' ]												// FixIn: 8.7.3.18.
						   }

						, el( 'div', {
										  className: 'wpbc_gb_block_shortcode_preview_content'
										, key: 'preview_content_' + params[ 'cid_key' ]										// FixIn: 8.7.3.18.
									 }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingcalendar( props ){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			if ( (undefined != props[ 'type' ]) && ( 1 != props[ 'type' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'type' ]} );
			}
			// FixIn: 10.0.0.16.
			if ( (undefined != props[ 'resource_id' ]) && ( 1 != props[ 'resource_id' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'resource_id' ]} );
			}
			if ( undefined != props[ 'nummonths' ] ){
				rows_in_content.push( {name: wp.i18n.__( 'Visible months number' ), value: props[ 'nummonths' ]} );
			}
			if ( undefined != props[ 'startmonth' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Start month' ), value: props[ 'startmonth' ] } );
			}
			if ( undefined != props[ 'aggregate' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Unavailable dates from other booking resources' ), value: 'ID = ' + props[ 'aggregate' ] } );
			}
			if ( undefined != props[ 'options' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Options' ), value: props[ 'options' ] } );
			}

			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of TimeLine
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingtimeline( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {
			type      		: 'Default',		// 1,
			view_days_num 	: 30,		// 30,

			scroll_start_date : null,		// '',
			scroll_day		: null,		// 0,
			scroll_month   	: null,		// 0,
			header_title   	: null,		// '',
			limit_hours		: null,		// '0,24'
		};
		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;


		var inner_header = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_header'
										, key: 'header_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Timeline' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_body'
										, key: 'body_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingtimeline( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {
										className: 'wpbc_gb_block_preview_inner_footer'
										, key: 'footer_' + params[ 'cid_key' ]											// FixIn: 8.7.3.18.
									}
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingtimeline' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingtimeline( props ){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			if ( undefined != props[ 'type' ] ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource(s)' ), value: 'ID = ' + props[ 'type' ]} );
			}
			if ( undefined != props[ 'view_days_num' ] ){

				if ( '1' == props[ 'view_days_num' ] ) {
					props[ 'view_days_num' ] = 'Day';
				}
				if ( '7' == props[ 'view_days_num' ] ) {
					props[ 'view_days_num' ] = 'Week';
				}
				if ( '30' == props[ 'view_days_num' ] ) {
					props[ 'view_days_num' ] = 'Month';
				}
				if ( '60' == props[ 'view_days_num' ] ) {
					props[ 'view_days_num' ] = '2 Months';
				}
				if ( '90' == props[ 'view_days_num' ] ) {
					props[ 'view_days_num' ] = '3 Months';
				}
				if ( '365' == props[ 'view_days_num' ] ){
					props[ 'view_days_num' ] = 'Year';
				}
				rows_in_content.push( {name: wp.i18n.__( 'View mode' ), value: props[ 'view_days_num' ]} );
			}
			if ( undefined != props[ 'header_title' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Title' ), value: props[ 'header_title' ] } );
			}
			if ( undefined != props[ 'scroll_day' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Number of days to scroll' ), value:  props[ 'scroll_day' ] } );
			}
			if ( undefined != props[ 'scroll_month' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Number of months to scroll' ), value: props[ 'scroll_month' ] } );
			}
			if ( undefined != props[ 'scroll_start_date' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Start Date' ), value: props[ 'scroll_start_date' ] } );
			}
			if ( undefined != props[ 'limit_hours' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Show from/to' ), value: props[ 'limit_hours' ] } );
			}

			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of Booking form
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingselect( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {
			type              : wp.i18n.__( 'All booking resources' ),
			nummonths         : 1,
			form_type         : null,		// : 'standard',
			selected_type     : null,		// : '',
			label             : null,		// : '',
			first_option_title: wp.i18n.__( 'Please Select' ),
			startmonth        : null,
			options           : null
		};


		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Selection of Resources' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingselect( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingselect' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End

	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingselect( props ){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			if ( undefined != props[ 'type' ] ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource(s)' ), value: props[ 'type' ]} );
			}
			if ( undefined != props[ 'label' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Label' ), value: props[ 'label' ] } );
			}
			if ( undefined != props[ 'selected_type' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Selected booking resource (by default)' ), value: 'ID = ' + props[ 'selected_type' ] } );
			}
			if ( undefined != props[ 'first_option_title' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Title of first option in list' ), value: props[ 'first_option_title' ] } );
			}
			if ( undefined != props[ 'nummonths' ] ){
				rows_in_content.push( {name: wp.i18n.__( 'Visible months number' ), value: props[ 'nummonths' ]} );
			}
			if ( undefined != props[ 'startmonth' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Start month' ), value: props[ 'startmonth' ] } );
			}
			if ( ( undefined != props[ 'form_type' ] ) && ( 'standard' != props[ 'form_type' ] )  ){
				rows_in_content.push( { name: wp.i18n.__( 'Custom booking form for all booking resources' ), value: props[ 'form_type' ] } );
			}
			if ( undefined != props[ 'aggregate' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Unavailable dates from other booking resources' ), value: 'ID = ' + props[ 'aggregate' ] } );
			}
			if ( undefined != props[ 'options' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Options' ), value: props[ 'options' ] } );
			}

			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of Booking form
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingform( shortcode_obj, params ){

		// Booking Form Parameters		// FixIn: 10.0.0.16.
		var shortcode_defaults = {
			type      : 1,
			resource_id : 1,
			selected_dates : null,
			form_type : 'standard'
		};


		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Booking Form (without calendar)' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingform( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingform' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End
	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingform( props ){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			if ( (undefined != props[ 'type' ]) && ( 1 != props[ 'type' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'type' ]} );
			}
			// FixIn: 10.0.0.16.
			if ( (undefined != props[ 'resource_id' ]) && ( 1 != props[ 'resource_id' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'resource_id' ]} );
			}

			if ( undefined != props[ 'selected_dates' ] ){
				rows_in_content.push( {name: wp.i18n.__( 'Date for submit booking' ), value: props[ 'selected_dates' ]} );
			}
			if ( ( undefined != props[ 'form_type' ] ) && ( 'standard' != props[ 'form_type' ] )  ){
				rows_in_content.push( { name: wp.i18n.__( 'Custom booking form' ), value: props[ 'form_type' ] } );
			}

			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of Search Availability Form
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingsearch( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {
			searchresultstitle 	: '',		// searchresultstitle='{searchresults} Result(s) Found'
			noresultstitle 		: '',		// noresultstitle='Nothing Found'
			users 				: null,		// users='3,55'
			searchresults 		: null		// searchresults='http://test.com/search-results'
		};

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Search Availability form' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingsearch( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingsearch' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End

	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingsearch( props ){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			if ( undefined != props[ 'searchresults' ] ){
				rows_in_content.push( {	  name:  wp.i18n.__( 'Show search results on other page' )
										, value: wp.element.createElement( 'a', { href: props[ 'searchresults' ] }, props[ 'searchresults' ] )
									} );
				rows_in_content.push( {name: wp.i18n.__( 'Note' ), value: wp.i18n.__( 'Search results page must have this shortcode' ) +  ' [bookingsearchresults]' } );
				rows_in_content.push( { block_text: '---' } );
			} else {
				rows_in_content.push( { block_text: wp.i18n.__( 'Show search results in the same page' ) } );
			}
			if ( undefined != props[ 'searchresultstitle' ] ){
				//rows_in_content.push( {name: wp.i18n.__( 'Search Results Title' ), value: props[ 'searchresultstitle' ]} );
			}
			if ( undefined != props[ 'noresultstitle' ] ){
				//rows_in_content.push( {name: wp.i18n.__( 'Title, if no search results' ), value: props[ 'noresultstitle' ]} );
			}
			if ( undefined != props[ 'users' ] ){
				rows_in_content.push( {name: wp.i18n.__( 'Search in booking resources of WP users' ), value: 'ID = ' + props[ 'users' ]} );
			}

			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of Search Results
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingsearchresults( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {
		};

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Search Results' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingsearchresults( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingsearch' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End
	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingsearchresults( props ){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			rows_in_content.push( { block_text: wp.i18n.__( 'Show search results on this page, after redirection from search form at other page.' ) } );

			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of Booking Confirm - system shortcode
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_booking_confirm( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {
		};

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: 'WP Booking Calendar - ' + wp.i18n.__( 'System Block' ) , cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_booking_confirm( props ,'body_' + params[ 'cid_key' ] ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_booking_confirm' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End
	}


	/**
	 *  Generate Visual Preview Block of "Booking Manager" == Import ==
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_booking_manager_import( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {};

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: 'Booking Manager - ' + wp.i18n.__( 'Import Events from .ics feed into WP Booking Calendar - Block' ) , cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters(
											[
											  { block_text: wp.i18n.__( 'This shortcode [ booking-manager-import ] is used for import bookings from .ics feed URL into the WP Booking Calendar plugin' ) }
											]
											, { cid_key: 'body_' + params[ 'cid_key' ] }
									 )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_booking_import' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
	}


	/**
	 *  Generate Visual Preview Block of "Booking Manager" == Import ==
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_booking_manager_listing( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {};

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: 'Booking Manager - ' + wp.i18n.__( 'Show Events Listing from .ics feed - Block' ) , cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters(
											[
											  { block_text: wp.i18n.__( 'This shortcode [ booking-manager-listing ] used for show events listing from .ics feed URL.' ) }
											]
											, { cid_key: 'body_' + params[ 'cid_key' ] }
									 )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_booking_import' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
	}


	/**
	 *  Generate Visual Preview Block of Booking Edit - system shortcode
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingedit( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {
		};

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'System Block' ) + ' (' + wp.i18n.__( 'Booking Calendar Editing' ) + ')', cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingedit( props ,'body_' + params[ 'cid_key' ] ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingedit' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End
	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_booking_confirm( props , cid_key){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			rows_in_content.push( { block_text: wp.i18n.__( 'This shortcode [booking_confirm] is used on a confirmation booking page to display booking details and confirmation after a successful booking.' ) } );

			return rows_in_content;
		}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingedit( props, cid_key ){

			var el = wp.element.createElement;

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			rows_in_content.push( { block_text: wp.i18n.__( 'This block required for ability to edit, cancel the booking by visitor, who made the booking, or for ability to show payment form, after sending payment request.' ) } );

			rows_in_content.push( {	block_text:

										el( 'div', { key: 'wpbc_be1_' + cid_key }
												, el( 'span', { key: 'wpbc_be2_' + cid_key }, wp.i18n.__( 'Link to this page must be defined' ) )
												, ' '
												, el( 'a', { href: 'admin.php?page=wpbc-settings#wpbc_general_settings_advanced_metabox', key: 'wpbc_be3_' + cid_key }, 'on this page' )
												, ', '
												, el( 'span', { key: 'wpbc_be4_' + cid_key }, wp.i18n.__( 'at this option' ) )
												, ': "'
												, el( 'strong', { key: 'wpbc_be5_' + cid_key }, wp.i18n.__( 'URL to edit bookings' ) )
												, '".'
											)
							  	 } );
			rows_in_content.push( { block_text:
										el( 'div', { style: { marginTop: '20px' }, key: 'wpbc_be6_' + cid_key }
												, el( 'strong', { key: 'wpbc_be7_' + cid_key }, wp.i18n.__( 'Important!' ) )
												, ' '
												, el( 'span', { key: 'wpbc_be8_' + cid_key }, wp.i18n.__( 'You can not open this page directly. Please, use links in ' ) )
												, ' '
												, el( 'a', { href: 'admin.php?page=wpbc-settings&tab=email' , key: 'wpbc_be9_' + cid_key }, 'email' )
												, '.'
											)
							  	 } );
			rows_in_content.push( { block_text:
										el( 'div', { key: 'wpbc_be10_' + cid_key }
												, el( 'span', { key: 'wpbc_be11_' + cid_key }, wp.i18n.__( 'If you open this page directly, then you will see this error' ) )
												, ': "'
												, el( 'strong', { key: 'wpbc_be12_' + cid_key }, wp.i18n.__( 'You do not set any parameters for booking editing' ) )
												, '".'
											)
							  	 } );
			return rows_in_content;
		}


	/**
	 *  Generate Visual Preview Block of Customer Bookings Listing - system shortcode
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingcustomerlisting( shortcode_obj, params ){

		// Booking Form Parameters
		var shortcode_defaults = {
		};

		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Customer Bookings Listing' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingcustomerlisting( props, 'body_' + params[ 'cid_key' ] ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingcustomerlisting' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End
	}


		/**
		 * Parse parameters into array of rows objects for showing in conetnt of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingcustomerlisting( props, cid_key ){

			var el = wp.element.createElement;

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			rows_in_content.push( { block_text: wp.i18n.__( 'Visitors of your website, can view previous (own) bookings, by clicking on secret link in email, which is sending after booking created.' ) } );

			rows_in_content.push( {	block_text:

										el( 'div', { key: 'wpbc_bcl1_' + cid_key }
												, el( 'span', { key: 'wpbc_bcl2_' + cid_key }, wp.i18n.__( 'Link to this page must be defined' ) )
												, ' '
												, el( 'a', { href: 'admin.php?page=wpbc-settings#wpbc_general_settings_advanced_metabox' , key: 'wpbc_bcl2_2_' + cid_key }, 'on this page' )
												, ', '
												, el( 'span', { key: 'wpbc_bcl3_' + cid_key }, wp.i18n.__( 'at this option' ) )
												, ': "'
												, el( 'strong', { key: 'wpbc_bcl4_' + cid_key }, wp.i18n.__( 'URL of page for customer bookings listing' ) )
												, '".'
											)
							  	 } );
			rows_in_content.push( { block_text:
										el( 'div', { style: { marginTop: '20px' }, key: 'wpbc_bcl5_' + cid_key }
												, el( 'strong', { key: 'wpbc_bcl6_' + cid_key }, wp.i18n.__( 'Important!' ) )
												, ' '
												, el( 'span', { key: 'wpbc_bcl7_' + cid_key }, wp.i18n.__( 'You can not open this page directly. Please, use links in ' ) )
												, ' '
												, el( 'a', { href: 'admin.php?page=wpbc-settings&tab=email' , key: 'wpbc_bcl8_' + cid_key }, 'email' )
												, '.'
											)
							  	 } );
			rows_in_content.push( { block_text:
										el( 'div', { key: 'wpbc_bcl9_' + cid_key }
												, el( 'span', { key: 'wpbc_bcl10_' + cid_key }, wp.i18n.__( 'If you open this page directly, then you will see this error' ) )
												, ': "'
												, el( 'strong', { key: 'wpbc_bcl11_' + cid_key }, wp.i18n.__( 'You do not set any parameters for booking editing' ) )
												, '".'
											)
							  	 } );
			return rows_in_content;
		}




	/**
	 *  Generate Visual Preview Block of Showing booking resource Info
	 *
	 * @param shortcode_obj	- shortcode  JavaScript obj.
	 * @returns
	 */
	function wpbc_gt_get_visual_block_for_bookingresource( shortcode_obj, params ){

		// Booking Form Parameters			// FixIn: 10.0.0.16.
		var shortcode_defaults = {
			type              : 1,
			resource_id       : 1,
			show         	  : 'title'
		};


		var props = _.defaults( shortcode_obj.attrs.named, shortcode_defaults );

		var el = wp.element.createElement;

		//FixIn: 8.7.3.18 Start
		var inner_header = el( 'div', {className: 'wpbc_gb_block_preview_inner_header', key: 'header_' + params[ 'cid_key' ]}
									, wpbc_gb_tpl_header( { header: wp.i18n.__( 'Show Info of Booking Resource' ), cid_key: 'header_' + params[ 'cid_key' ] } )
							);
		var inner_body   = el( 'div', {className: 'wpbc_gb_block_preview_inner_body', key: 'body_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_shortcode_parameters( wpbc_parse_params_into_rows_arr_for_bookingresource( props ), { cid_key: 'body_' + params[ 'cid_key' ] } )
							);
		var inner_footer = el( 'div', {className: 'wpbc_gb_block_preview_inner_footer' , key: 'footer_' + params[ 'cid_key' ] }
									, wpbc_gb_tpl_footer( { shortcode_in_text: params[ 'shortcode_in_text' ], cid_key: 'footer_' + params[ 'cid_key' ] } )
							);

		return  el( 'div', { className: 'wpbc_gb_block_shortcode_preview_wrapper wpbc_gb_block_preview_bookingresource' , key: 'preview_wrapper_' + params[ 'cid_key' ] }

						, el( 'div', { className: 'wpbc_gb_block_shortcode_preview_content' , key: 'preview_content_' + params[ 'cid_key' ] }
								, [ inner_header, inner_body ]
							)
						, inner_footer
				);
		//FixIn: 8.7.3.18 End
	}


		/**
		 * Parse parameters into array of rows objects for showing in content of block
		 *
		 * @param props
		 */
		function wpbc_parse_params_into_rows_arr_for_bookingresource( props ){

			// Parameters Description /////////////////////////////////
			var rows_in_content = [];
			if ( (undefined != props[ 'type' ]) && ( 1 != props[ 'type' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'type' ]} );
			}
			// FixIn: 10.0.0.16.
			if ( (undefined != props[ 'resource_id' ]) && ( 1 != props[ 'resource_id' ]) ){
				rows_in_content.push( {name: wp.i18n.__( 'Booking resource' ), value: 'ID = ' + props[ 'resource_id' ]} );
			}

			if ( undefined != props[ 'show' ] ) {
				rows_in_content.push( { name: wp.i18n.__( 'Show' ), value: props[ 'show' ] } );
				/*
				if ( 'title' == props[ 'show' ] ) {
					rows_in_content.push( { name: wp.i18n.__( 'Show' ), value: props[ 'show' ] } );
				}
				if ( 'cost' == props[ 'show' ] ) {
					rows_in_content.push( { name: wp.i18n.__( 'Show' ), value: props[ 'show' ] } );
				}
				if ( 'capacity' == props[ 'show' ] ) {
					rows_in_content.push( { name: wp.i18n.__( 'Show' ), value: props[ 'show' ] } );
				}
				*/
			}
			return rows_in_content;
		}



// Templates ///////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Header template for Block Preview
 *
 * @param props - object of parameters
 * @returns array of createElements - react elements
 */
function wpbc_gb_tpl_header( props ){

	var el = wp.element.createElement;
																		// FixIn: 8.7.3.18.
	return [
		el( 'h3',  {className: 'wpbc_gb_block_preview_inner_title_text', key: 'h3header_' + props[ 'cid_key' ] }, props.header  ),

		el( 'a',   {
			className: 'wpbc_gb_block_preview_inner_title_edit',
			href: '#!',
			onClick: wpbc_gutenberg_handle_preview_edit_click,
			key: 'a_clickedit_' + props[ 'cid_key' ]
		}, wp.i18n.__( 'Click to edit' ) ),

		el( 'div', {className: 'wpbc_gb_block_preview_inner_title_desc', key: 'div_notreal_' + props[ 'cid_key' ] }, wp.i18n.__( 'This is not real preview. Its configuration block of "Booking Calendar".' ) )
	];
}


/**
 * Parameters template for shortcode params in Body of Block Preview
 *
 * @param props - array of objects of parameters [ {name: 'title', value: 'data'}, ... ]
 * @returns array of createElements - react elements
 */
function wpbc_gb_tpl_shortcode_parameters( props , params ){			// FixIn: 8.7.3.18.

	var el = wp.element.createElement;

	var shortcode_parameters_arr = [];

	var propsLength = props.length;

	var cid_key = params[ 'cid_key' ];	// FixIn: 8.7.3.18.
	for ( var i = 0; i < propsLength; i++ ){

		cid_key = 'internal' + i + params[ 'cid_key' ];

		if ( undefined != props[i]['block_text'] ) {

			shortcode_parameters_arr.push(
				el( 'div', {className: 'wpbc_gb_block_preview_inner_params_row', key: 'div_text' + cid_key }
					, el( 'span', { key: 'inner_params_row_span' + cid_key }, props[ i ]['block_text'] )
				)
			);

		}

		if ( ( undefined != props[i]['name'] ) && ( undefined != props[i]['value'] )  ) {

			shortcode_parameters_arr.push(
				el( 'div', {className: 'wpbc_gb_block_preview_inner_params_row', key: 'div_name' + cid_key }
					, el( 'strong', { key: 'strong_name' + cid_key }, 	props[ i ].name )
					, el( 'span', 	{ key: 'span_name' + cid_key }, 	': ' )
					, el( 'em', 	{ key: 'em_value' + cid_key }, 		props[ i ].value )
				)
			);
		}
	}

	return shortcode_parameters_arr;
}


/**
 * Header template for Block Preview
 *
 * @param props - object of parameters
 * @returns array of createElements - react elements
 */
function wpbc_gb_tpl_footer( props ){

	var el = wp.element.createElement;
																				// FixIn: 8.7.3.18.
	return [
				el( 'div', { className: 'wpbc_gb_block_preview_inner_shortcode', key: 'div_foot_' + props[ 'cid_key' ] }, props.shortcode_in_text )
	       ];
}

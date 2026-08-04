// File: /includes/page-form-builder/field-packs/appointment-start-over/_src/appointment-start-over.js
( function ( window ) {
	'use strict';

	var Core     = window.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if ( ! registry || typeof registry.register !== 'function' || ! Base ) {
		window._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Appointment_Start_Over', 'Core registry/base missing' );
		return;
	}

	/** Render the declarative Appointment Start Over control in Form Builder. */
	class WPBC_BFB_Field_Appointment_Start_Over extends Base {

		/** Return defaults kept in sync with the PHP schema. */
		static get_defaults() {
			return {
				type           : 'appointment_start_over',
				label          : 'Start over',
				cssclass_extra : '',
				html_id        : '',
				help           : '',
				usage_key      : 'appointment_start_over'
			};
		}

		/**
		 * Render an inert preview; runtime behavior belongs to [booking_appointment].
		 *
		 * @param {HTMLElement} el   Builder field element.
		 * @param {Object}      data Field properties.
		 * @param {Object}      ctx  Builder context.
		 * @returns {void}
		 */
		static render( el, data, ctx ) {
			if ( ! el ) {
				return;
			}

			const d          = this.normalize_data( data );
			const escape_html = ( value ) => Core.WPBC_BFB_Sanitize.escape_html( value );
			const sanitize_id = ( value ) => Core.WPBC_BFB_Sanitize.sanitize_html_id( value );
			const sanitize_classes = ( value ) => Core.WPBC_BFB_Sanitize.sanitize_css_classlist( value );
			const html_id    = d.html_id ? sanitize_id( String( d.html_id ) ) : '';
			const extra_class = sanitize_classes( String( d.cssclass_extra || '' ) );
			const label      = ( typeof d.label === 'string' && d.label.trim() ) ? d.label.trim() : 'Start over';

			if ( 'cssclass_extra' in d ) {
				el.dataset.cssclass_extra = extra_class;
			}
			if ( 'html_id' in d ) {
				el.dataset.html_id = html_id;
			}

			const id_attribute = html_id ? ` id="${escape_html( html_id )}"` : '';
			const classes = 'wpbc_button wpbc_button_secondary wpbc_button_light wpbc_booking_appointment__change wpbc_booking_appointment__restart' + ( extra_class ? ' ' + escape_html( extra_class ) : '' );
			const help_html = d.help ? `<div class="wpbc_bfb__help">${escape_html( d.help )}</div>` : '';

			el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					<div class="wpbc_bfb__field-preview">
						<button type="button" class="${classes}"${id_attribute} data-wpbc-appointment-action="start-over">${escape_html( label )}</button>
					</div>
					${help_html}
				</span>
			`;

			Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
		}

		/** Preserve the standard Builder post-drop behavior. */
		static on_field_drop( data, el, ctx ) {
			super.on_field_drop?.( data, el, ctx );
		}
	}

	try {
		registry.register( 'appointment_start_over', WPBC_BFB_Field_Appointment_Start_Over );
	} catch ( error ) {
		window._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Appointment_Start_Over.register', error );
	}

	/** Register the Advanced Booking Form HTML exporter. */
	function register_appointment_start_over_booking_form_exporter() {
		var Exporter = window.WPBC_BFB_Exporter;
		if ( ! Exporter || typeof Exporter.register !== 'function' ) {
			return;
		}
		if ( typeof Exporter.has_exporter === 'function' && Exporter.has_exporter( 'appointment_start_over' ) ) {
			return;
		}

		var Sanitizer = Core.WPBC_BFB_Sanitize || {};
		var escape_html = Sanitizer.escape_html || function ( value ) { return String( value ); };
		var sanitize_id = Sanitizer.sanitize_html_id || function ( value ) { return String( value ).trim(); };
		var sanitize_classes = Sanitizer.sanitize_css_classlist || function ( value ) { return String( value ).trim(); };

		Exporter.register( 'appointment_start_over', function ( field, emit, extras ) {
			var defaults = WPBC_BFB_Field_Appointment_Start_Over.get_defaults();
			var data = Object.assign( {}, defaults, field || {} );
			var label = ( typeof data.label === 'string' && data.label.trim() ) ? data.label.trim() : defaults.label;
			var html_id = data.html_id ? sanitize_id( String( data.html_id ) ) : '';
			var extra_class = sanitize_classes( String( data.cssclass_extra || '' ) );
			var used_ids = extras && extras.ctx && extras.ctx.usedIds;

			if ( html_id && used_ids instanceof Set ) {
				var base_id = html_id;
				var unique_id = base_id;
				var suffix = 2;
				while ( used_ids.has( unique_id ) ) {
					unique_id = base_id + '_' + suffix++;
				}
				used_ids.add( unique_id );
				html_id = unique_id;
			}

			var required_classes = 'wpbc_button wpbc_button_secondary wpbc_button_light wpbc_booking_appointment__change wpbc_booking_appointment__restart';
			var full_classes = required_classes + ( extra_class ? ' ' + extra_class : '' );
			var id_attribute = html_id ? ' id="' + escape_html( html_id ) + '"' : '';

			emit(
				'<button type="button" class="' + escape_html( full_classes ) + '"' + id_attribute +
				' data-wpbc-appointment-action="start-over">' + escape_html( label ) + '</button>'
			);
		} );
	}

	if ( window.WPBC_BFB_Exporter && typeof window.WPBC_BFB_Exporter.register === 'function' ) {
		register_appointment_start_over_booking_form_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:exporter-ready', register_appointment_start_over_booking_form_exporter, { once: true } );
	}

	/** Omit this control from the Booking Data template. */
	function register_appointment_start_over_booking_data_exporter() {
		var Exporter = window.WPBC_BFB_ContentExporter;
		if ( ! Exporter || typeof Exporter.register !== 'function' ) {
			return;
		}
		if ( typeof Exporter.has_exporter === 'function' && Exporter.has_exporter( 'appointment_start_over' ) ) {
			return;
		}

		Exporter.register( 'appointment_start_over', function () {
			return;
		} );
	}

	if ( window.WPBC_BFB_ContentExporter && typeof window.WPBC_BFB_ContentExporter.register === 'function' ) {
		register_appointment_start_over_booking_data_exporter();
	} else if ( typeof document !== 'undefined' ) {
		document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_appointment_start_over_booking_data_exporter, { once: true } );
	}
} )( window );

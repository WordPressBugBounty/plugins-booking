/**
 * Booking Calendar — Apply Template modal helper (BFB Admin)
 *
 * UI.Modal_Apply_Template.open(on_confirm, on_open)
 *
 * on_confirm(payload):
 *  payload = {
 *    template_form_slug : string // '__blank__' or '' => blank/reset
 *  }
 *
 * Applies template by:
 * - Loading template FormConfig (status=template) via AJAX load endpoint
 * - Applying returned structure + settings + advanced/content form texts into current editor
 * - Does NOT auto-save (user clicks "Save Form")
 *
 * Depends on:
 * - UI.Templates.ensure_dom_ref_from_wp_template
 * - UI.Modals.show/hide
 * - wpbc_bfb__ajax_list_user_forms()
 * - window.jQuery
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_apply_template.js
 */

/* globals window, document */
(function (w, d) {
	'use strict';

	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	UI.Modal_Apply_Template = UI.Modal_Apply_Template || {};

	// Idempotency guard.
	if ( UI.Modal_Apply_Template.__bound ) {
		return;
	}
	UI.Modal_Apply_Template.__bound = true;

	const MODAL_DOM_ID = 'wpbc_bfb_modal__apply_template';
	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-apply_template';

	const ID_TPL_SEARCH = 'wpbc_bfb_popup_modal__apply_template__tpl_search';

	const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
	const SEL_CANCEL  = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
	const SEL_ERROR   = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';

	const BLANK_TEMPLATE_SLUG = '__blank__';

	function wpbc_bfb__i18n(key, fallback) {
		if ( typeof w.wpbc_bfb__i18n === 'function' ) {
			return w.wpbc_bfb__i18n( key, fallback );
		}
		return String( fallback || '' );
	}


	function wpbc_bfb__has_text(value) {
		return !! ( value && String( value ).trim() );
	}

	function wpbc_bfb__get_el(id) {
		return d.getElementById( id );
	}

	function wpbc_bfb__get_modal_el() {
		return d.getElementById( MODAL_DOM_ID );
	}

	function wpbc_bfb__set_error(msg) {
		const el = d.querySelector( SEL_ERROR );
		if ( ! el ) {
			return;
		}
		if ( wpbc_bfb__has_text( msg ) ) {
			// Safer: do not inject HTML here.
			el.textContent = String( msg );
			el.style.display = '';
		} else {
			el.textContent = '';
			el.style.display = 'none';
		}
	}

	function wpbc_bfb__collect_payload(modal_el) {
		return {
			template_form_slug: wpbc_bfb__get_selected_template_slug( modal_el )
		};
	}

	// -- Helpers ------------------------------------------------------------------------------------------------------

	function wpbc_bfb__get_selected_template_slug(modal_el) {
		if ( ! modal_el ) {
			return BLANK_TEMPLATE_SLUG;
		}
		const picker = modal_el.__wpbc_bfb_template_picker || null;
		if ( picker && typeof picker.get_selected_template_slug === 'function' ) {
			return picker.get_selected_template_slug();
		}
		const v = String( modal_el.__wpbc_bfb_selected_template_slug || '' );
		return v ? v : BLANK_TEMPLATE_SLUG;
	}

	function wpbc_bfb__get_template_picker(modal_el) {
		if ( ! modal_el ) {
			return null;
		}

		if ( ! UI.Template_Picker || typeof UI.Template_Picker.create !== 'function' ) {
			if ( typeof w.wpbc_admin_show_message === 'function' ) {
				w.wpbc_admin_show_message( 'WPBC BFB: Template Picker helper is not available.', 'error', 10000 );
			}
			return null;
		}

		if ( ! modal_el.__wpbc_bfb_template_picker ) {
			modal_el.__wpbc_bfb_template_picker = UI.Template_Picker.create(
				{
					modal_el                : modal_el,
					search_input_id         : ID_TPL_SEARCH,
					blank_template_slug     : BLANK_TEMPLATE_SLUG,
					allow_delete            : true,
					allow_presets           : true,
					allow_same_click_blank  : false,
					blank_desc              : wpbc_bfb__i18n( 'text_apply_template_blank_desc', 'Reset to an empty Builder layout.' ),
					empty_text              : wpbc_bfb__i18n( 'text_apply_template_empty_templates', 'No templates found.' ),
					list_helper_missing_text: wpbc_bfb__i18n( 'text_apply_template_list_helper_missing', 'WPBC BFB: list forms helper missing.' ),
					load_failed_text        : wpbc_bfb__i18n( 'text_apply_template_load_failed', 'Failed to load templates list.' ),
					on_set_error            : wpbc_bfb__set_error
				}
			);
		}

		return modal_el.__wpbc_bfb_template_picker;
	}






	UI.Modal_Apply_Template.open = function (on_confirm, on_open, opts) {

		const ref = UI.Templates.ensure_dom_ref_from_wp_template( TPL_MODAL_ID, MODAL_DOM_ID );
		if ( ! ref || ! ref.el ) {
			return;
		}

		let modal_el = ref.el;

		// If template root is a wrapper (like <span>), find the actual modal inside it.
		if ( modal_el && modal_el.id !== MODAL_DOM_ID ) {
			const inside = modal_el.querySelector ? modal_el.querySelector( '#' + MODAL_DOM_ID ) : null;
			if ( inside ) {
				modal_el = inside;
			}
		}
		if ( ! modal_el ) {
			return;
		}

		modal_el.__wpbc_bfb_apply_template_cb = (typeof on_confirm === 'function') ? on_confirm : null;

		const picker = wpbc_bfb__get_template_picker( modal_el );
		if ( ! picker ) {
			if ( typeof w.wpbc_admin_show_message === 'function' ) {
				w.wpbc_admin_show_message( 'WPBC BFB: Template Picker helper is not available.', 'error', 10000 );
			}
			return;
		}
		picker.bind_handlers();
		picker.reset_state();

		UI.Modals.show( modal_el );

		// Optional initial search (prefill + auto-load).
		let initial_search = '';
		try {
			if ( opts && typeof opts === 'object' && opts.initial_search ) {
				initial_search = String( opts.initial_search || '' ).trim();
			}
		} catch ( _e0 ) {}

		// Accept URL separator "^" in initial_search and show the UI separator "|" in the input.
		initial_search = w.wpbc_bfb__normalize_template_search( initial_search );

		picker.set_pager( 1, false );
		picker.apply_search_value( initial_search, function () { } );

		// Focus search input.
		w.setTimeout( function () {
			const s_el = wpbc_bfb__get_el( ID_TPL_SEARCH );
			if ( s_el && s_el.focus ) {
				try { s_el.focus(); } catch ( _e1 ) {}
				try { s_el.select(); } catch ( _e2 ) {}
			}
		}, 0 );

		if ( on_open ) {
			try { on_open( modal_el ); } catch ( _e3 ) {}
		}
	};

	// Confirm / Cancel (single delegated listener).
	d.addEventListener( 'click', function (e) {

		const modal_el = wpbc_bfb__get_modal_el();
		if ( ! modal_el || ! e || ! e.target || ! e.target.closest ) {
			return;
		}

		const is_confirm = e.target.closest( SEL_CONFIRM );
		if ( is_confirm ) {
			e.preventDefault();

			const payload = wpbc_bfb__collect_payload( modal_el );

			wpbc_bfb__set_error( '' );

			const cb = modal_el.__wpbc_bfb_apply_template_cb || null;
			modal_el.__wpbc_bfb_apply_template_cb = null;

			UI.Modals.hide( modal_el );

			if ( cb ) {
				try { cb( payload ); } catch ( _e3 ) {}
			}
			return;
		}

		const is_cancel = e.target.closest( SEL_CANCEL );
		if ( is_cancel ) {
			e.preventDefault();
			modal_el.__wpbc_bfb_apply_template_cb = null;
			UI.Modals.hide( modal_el );
		}

	}, true );

}( window, document ));


/**
 * Apply selected template (payload) into current form editor.
 *
 * @param {Object} payload
 * @param {HTMLElement|null} menu_option_this Optional menu button (busy UI). Can be null.
 */
function wpbc_bfb__apply_template_from_payload(payload, menu_option_this) {

	var template_form_key = '';

	if ( payload && payload.template_form_slug && payload.template_form_slug !== '__blank__' ) {
		template_form_key = String( payload.template_form_slug );
	} else {
		template_form_key = '';
	}

	var $btn = ( window.jQuery && menu_option_this ) ? window.jQuery( menu_option_this ) : null;
	var original_busy_text = '';

	if ( $btn && $btn.length ) {
		original_busy_text = $btn.data( 'wpbc-u-busy-text' ) || '';
		$btn.data( 'wpbc-u-busy-text', wpbc_bfb__i18n( 'text_apply_template_applying', 'Applying...' ) );
		if ( typeof window.wpbc_bfb__button_busy_start === 'function' ) {
			window.wpbc_bfb__button_busy_start( $btn );
		}
	}

	function wpbc_bfb__busy_end() {
		if ( $btn && $btn.length ) {
			if ( typeof window.wpbc_bfb__button_busy_end === 'function' ) {
				window.wpbc_bfb__button_busy_end( $btn );
			}
			$btn.data( 'wpbc-u-busy-text', original_busy_text );
		}
	}

	// Apply blank (no AJAX).
	if ( ! template_form_key ) {

		wpbc_bfb__apply_template_to_current_form(
			{
				structure     : [ { page: 1, content: [] } ],
				settings      : { options: {}, css_vars: [], bfb_options: { advanced_mode_source: 'builder' } },
				advanced_form : '',
				content_form  : ''
			}
		);

		wpbc_bfb__busy_end();

		if ( typeof window.wpbc_admin_show_message === 'function' ) {
			window.wpbc_admin_show_message( wpbc_bfb__i18n( 'text_apply_template_blank_applied', 'Blank layout applied. Click “Save Form” to keep changes.' ), 'info', 4000, false );
		}

		return;
	}

	// Load template config (status=template) and apply.
	wpbc_bfb__load_template_form_config( template_form_key, function (ok, data) {

		if ( ! ok || ! data ) {
			wpbc_bfb__busy_end();
			if ( typeof window.wpbc_admin_show_message === 'function' ) {
				window.wpbc_admin_show_message( wpbc_bfb__i18n( 'text_apply_template_form_load_failed', 'Failed to load template.' ), 'error', 10000 );
			}
			return;
		}

		wpbc_bfb__apply_template_to_current_form( data );

		wpbc_bfb__busy_end();

		if ( typeof window.wpbc_admin_show_message === 'function' ) {
			window.wpbc_admin_show_message( wpbc_bfb__i18n( 'text_apply_template_applied', 'Template applied. Click “Save Form” to keep changes.' ), 'success', 4000, false );
		}
	} );
}


/**
 * Menu action: open modal and apply selected template into current form editor.
 *
 * Usage in menu:
 * onclick="wpbc_bfb__menu_forms__apply_template(this);"
 *
 * @param {HTMLElement|null} menu_option_this
 * @param {Object} [opts]
 * @param {string} [opts.initial_search] Optional prefilled template search string.
 */
function wpbc_bfb__menu_forms__apply_template(menu_option_this, opts) {

	if ( ! window.WPBC_BFB_Core || ! window.WPBC_BFB_Core.UI || ! window.WPBC_BFB_Core.UI.Modal_Apply_Template ) {
		if ( typeof window.wpbc_admin_show_message === 'function' ) {
			window.wpbc_admin_show_message( 'WPBC BFB: Apply Template modal is not available.', 'error', 10000 );
		}
		return;
	}

	// Ensure opts is a plain object.
	if ( ! opts || typeof opts !== 'object' ) {
		opts = {};
	}

	window.WPBC_BFB_Core.UI.Modal_Apply_Template.open(
		function (payload) {
			// IMPORTANT: apply directly from payload (DO NOT reopen the modal).
			wpbc_bfb__apply_template_from_payload( payload, menu_option_this || null );
		},
		null,
		opts
	);
}


/**
 * Open "Apply Template" modal with prefilled search and auto-search.
 *
 * Example:
 *   wpbc_bfb__menu_forms__apply_template_search( 'time', null );
 *   wpbc_bfb__menu_forms__apply_template_search( 'full day', null );
 *
 * @param {string} search_key
 * @param {HTMLElement|null} menu_option_this Optional menu button (busy UI). Can be null.
 */
function wpbc_bfb__menu_forms__apply_template_search(search_key, menu_option_this) {

	search_key = String( search_key || '' )
		.replace( /[\u0000-\u001F\u007F]/g, ' ' )
		.replace( /\s+/g, ' ' )
		.trim();

	// Normalize configured OR separator (default "|") so server can split reliably.
	search_key = window.wpbc_bfb__normalize_template_search( search_key );

	// Open the same modal, but pass initial_search.
	wpbc_bfb__menu_forms__apply_template( menu_option_this || null, { initial_search: search_key } );
}

/**
 * Load template FormConfig via existing AJAX endpoint.
 *
 * @param {string} template_form_slug
 * @param {Function} done_cb function(ok:boolean, data:Object|null)
 */
function wpbc_bfb__load_template_form_config(template_form_slug, done_cb) {

	try {
		var cfg = window.WPBC_BFB_Ajax || {};
		var $   = window.jQuery || null;

		template_form_slug = String( template_form_slug || '' ).trim();

		if ( ! template_form_slug ) {
			if ( typeof done_cb === 'function' ) {
				done_cb( false, null );
			}
			return;
		}

		if ( ! cfg.url || ! cfg.nonce_load ) {
			if ( typeof window.wpbc_admin_show_message === 'function' ) {
				window.wpbc_admin_show_message( 'WPBC BFB: ajax load config is missing.', 'error', 10000 );
			}
			if ( typeof done_cb === 'function' ) {
				done_cb( false, null );
			}
			return;
		}

		if ( ! $ || ! $.ajax ) {
			if ( typeof window.wpbc_admin_show_message === 'function' ) {
				window.wpbc_admin_show_message( 'WPBC BFB: jQuery is not available.', 'error', 10000 );
			}
			if ( typeof done_cb === 'function' ) {
				done_cb( false, null );
			}
			return;
		}

		$.ajax( {
			url      : cfg.url,
			type     : 'POST',
			dataType : 'text',
			data     : {
				action   : 'WPBC_AJX_BFB_LOAD_FORM_CONFIG',
				nonce    : cfg.nonce_load,
				form_name: template_form_slug,
				status   : 'template'
			}
		} )
			.done( function (response_text, _text_status, jqxhr) {

				if ( ! jqxhr || jqxhr.status !== 200 ) {
					if ( typeof done_cb === 'function' ) {
						done_cb( false, null );
					}
					return;
				}

				var resp = null;
				try {
					resp = JSON.parse( response_text );
				} catch ( _e1 ) {
					resp = null;
				}

				if ( ! resp || ! resp.success || ! resp.data ) {
					if ( typeof done_cb === 'function' ) {
						done_cb( false, resp );
					}
					return;
				}

				if ( typeof done_cb === 'function' ) {
					done_cb( true, resp.data );
				}
			} )
			.fail( function (jqXHR, textStatus, errorThrown) {
				if ( typeof done_cb === 'function' ) {
					done_cb( false, ( (jqXHR.responseText) ? jqXHR.responseText : null ) );
				}
			} );

	} catch ( _e2 ) {
		if ( typeof done_cb === 'function' ) {
			done_cb( false, null );
		}
	}
}

/**
 * Apply template data to current form editor.
 *
 * Expected data:
 * - structure (array)
 * - settings (array|object)
 * - advanced_form (string)
 * - content_form (string)
 *
 * @param {Object} data
 */
function wpbc_bfb__apply_template_to_current_form(data) {

	var builder = window.wpbc_bfb || null;

	var structure = ( data && data.structure ) ? data.structure : [];
	var settings  = ( data && data.settings ) ? data.settings : null;

	// 1) Apply structure into Builder.
	if ( builder && typeof builder.load_saved_structure === 'function' ) {
		builder.load_saved_structure( structure || [] );
	} else if ( builder && typeof builder.load_structure === 'function' ) {
		builder.load_structure( structure || [] );
	} else if ( typeof window.wpbc_bfb__on_structure_loaded === 'function' ) {
		window.wpbc_bfb__on_structure_loaded( structure || [] );
	}

	// 2) Apply settings into Settings Options UI (and other listeners).
	if ( settings ) {
		try {
			// Some call-sites may return JSON string, be defensive.
			if ( typeof settings === 'string' ) {
				settings = JSON.parse( settings );
			}
		} catch ( _e0 ) {}

		if ( settings ) {
			if ( typeof window.wpbc_bfb__dispatch_event_safe === 'function' ) {
				window.wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form_settings:apply', {
					settings : settings,
					form_name: ( window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.form_name ) ? window.WPBC_BFB_Ajax.form_name : 'standard'
				} );
			} else {
				try {
					document.dispatchEvent( new CustomEvent( 'wpbc:bfb:form_settings:apply', { detail: { settings: settings } } ) );
				} catch ( _e1 ) {}
			}
		}
	}

	// 3) Apply Advanced/Content texts (updates textarea + notifies Advanced Mode module).
	wpbc_bfb__apply_advanced_mode_texts(
		( data && typeof data.advanced_form !== 'undefined' ) ? data.advanced_form : '',
		( data && typeof data.content_form !== 'undefined' ) ? data.content_form : '',
		( settings && settings.bfb_options && settings.bfb_options.advanced_mode_source ) ? settings.bfb_options.advanced_mode_source : 'builder'
	);

	// 4) Notify: template applied (optional hooks).
	if ( typeof window.wpbc_bfb__dispatch_event_safe === 'function' ) {
		window.wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form:template_applied', {
			template_form_slug: ( data && data.form_name ) ? data.form_name : '',
			form_name         : ( window.WPBC_BFB_Ajax && window.WPBC_BFB_Ajax.form_name ) ? window.WPBC_BFB_Ajax.form_name : 'standard'
		} );
	}
}

/**
 * Apply advanced/content texts into editor UI safely.
 *
 * @param {string} advanced_form
 * @param {string} content_form
 * @param {string} advanced_mode_source
 */
function wpbc_bfb__apply_advanced_mode_texts(advanced_form, content_form, advanced_mode_source) {

	var af = ( advanced_form == null ) ? '' : String( advanced_form );
	var cf = ( content_form == null ) ? '' : String( content_form );

	var ta_form    = document.getElementById( 'wpbc_bfb__advanced_form_editor' );
	var ta_content = document.getElementById( 'wpbc_bfb__content_form_editor' );

	if ( ta_form ) {
		ta_form.value = af;
	}
	if ( ta_content ) {
		ta_content.value = cf;
	}

	if ( typeof window.wpbc_bfb__dispatch_event_safe === 'function' ) {
		window.wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:advanced_text:apply', {
			advanced_form       : af,
			content_form        : cf,
			advanced_mode_source: advanced_mode_source
		} );
	}
}
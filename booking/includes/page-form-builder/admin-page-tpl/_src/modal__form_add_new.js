/**
 * Booking Calendar — Add New Form modal helper (BFB Admin)
 *
 * UI.Modal_Add_New_Form.open(on_confirm, on_open)
 *
 * on_confirm(payload):
 *  payload = {
 *    template_form_slug : string, // '' or '__blank__' -> blank form
 *    form_title         : string,
 *    form_slug          : string,
 *    form_image_url     : string,
 *    form_description   : string
 *  }
 *
 * Depends on:
 * - UI.Templates.ensure_dom_ref_from_wp_template
 * - UI.Modals.show/hide
 * - wpbc_bfb__ajax_list_user_forms()
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_add_new.js
 */

(function (w, d) {
	'use strict';

	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	UI.Modal_Add_New_Form = UI.Modal_Add_New_Form || {};

	// Idempotency guard.
	if ( UI.Modal_Add_New_Form.__bound ) {
		return;
	}
	UI.Modal_Add_New_Form.__bound = true;

	const MODAL_DOM_ID = 'wpbc_bfb_modal__add_new_form';
	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-add_new_form';

	const ID_TITLE       = 'wpbc_bfb_popup_modal__add_new_form__title';
	const ID_SLUG        = 'wpbc_bfb_popup_modal__add_new_form__slug';
	const ID_IMAGE_URL   = 'wpbc_bfb_popup_modal__add_new_form__image_url';
	const ID_DESCRIPTION = 'wpbc_bfb_popup_modal__add_new_form__description';

	const ID_TPL_SEARCH  = 'wpbc_bfb_popup_modal__add_new_form__tpl_search';

	const SEL_CONFIRM = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
	const SEL_CANCEL  = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
	const SEL_ERROR   = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';
	const SEL_CLEAR_IMAGE = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-clear-image="1"]';

	const BLANK_TEMPLATE_SLUG = '__blank__';

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
			el.textContent = String( msg );
			el.style.display = '';
		} else {
			el.textContent = '';
			el.style.display = 'none';
		}
	}

	function wpbc_bfb__set_confirm_enabled(is_enabled) {
		const btn = d.querySelector( SEL_CONFIRM );
		if ( ! btn ) {
			return;
		}

		if ( is_enabled ) {
			btn.classList.remove( 'disabled' );
			btn.setAttribute( 'aria-disabled', 'false' );
		} else {
			btn.classList.add( 'disabled' );
			btn.setAttribute( 'aria-disabled', 'true' );
		}
	}

	/**
	 * Create a "slug/key" from title (underscore style).
	 *
	 * @param {string} value
	 * @return {string}
	 */
	function wpbc_bfb__slugify_to_key(value) {
		let v = String( value || '' ).trim().toLowerCase();

		// Remove accents when possible.
		try {
			if ( v && v.normalize ) {
				v = v.normalize( 'NFD' ).replace( /[\u0300-\u036f]/g, '' );
			}
		} catch ( _e ) {}

		// Replace quotes, then keep only a-z0-9 _ - space.
		v = v.replace( /['"]/g, '' );
		v = v.replace( /[^a-z0-9_\-\s]+/g, '' );

		// Convert spaces/dashes to underscores.
		v = v.replace( /[\s\-]+/g, '_' );

		// Collapse underscores, trim.
		v = v.replace( /_+/g, '_' ); // .replace( /^_+|_+$/g, '' );

		// Safety: must start with a letter if possible.
		if ( v && /^[0-9]/.test( v ) ) {
			v = 'form_' + v;
		}

		return v;
	}

	/**
	 * Sanitize user-entered slug/key.
	 *
	 * @param {string} value
	 * @return {string}
	 */
	function wpbc_bfb__sanitize_key(value) {
		let v = String( value || '' ).trim().toLowerCase();
		v = v.replace( /[^a-z0-9_]+/g, '_' );
		v = v.replace( /_+/g, '_' ); // .replace( /^_+|_+$/g, '' );
		if ( v && /^[0-9]/.test( v ) ) {
			v = 'form_' + v;
		}
		return v;
	}

	function wpbc_bfb__render_thumb(modal_el, url) {
		if ( ! modal_el || ! modal_el.querySelector ) {
			return;
		}

		const thumb = modal_el.querySelector( '[data-wpbc-bfb-thumb="1"]' );
		if ( ! thumb ) {
			return;
		}

		const safe_url = String( url || '' ).trim();

		if ( safe_url ) {
			thumb.innerHTML = '<img src="' + safe_url.replace( /"/g, '&quot;' ) + '" style="width:100%;height:100%;object-fit:cover;" alt="" />';
		} else {
			thumb.innerHTML = '';

			const span = d.createElement( 'span' );
			span.className = 'description';
			span.style.padding = '6px';
			span.style.textAlign = 'center';
			span.textContent = wpbc_bfb__i18n( 'text_no_image', 'No Image' );

			thumb.appendChild( span );
		}
	}

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

		if (
			! UI.Template_Picker ||
			typeof UI.Template_Picker.create !== 'function'
		) {
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
					allow_same_click_blank  : true,
					blank_desc              : wpbc_bfb__i18n( 'text_add_new_blank_desc', 'Start with an empty layout.' ),
					empty_text              : wpbc_bfb__i18n( 'text_add_new_empty_templates', 'No templates found. You can still create a blank form.' ),
					list_helper_missing_text: wpbc_bfb__i18n( 'text_add_new_list_helper_missing', 'WPBC BFB: list forms helper missing.' ),
					load_failed_text        : wpbc_bfb__i18n( 'text_add_new_load_failed', 'Failed to load templates list. You can still create a blank form.' ),
					on_set_error            : wpbc_bfb__set_error,
					on_selection_change     : function () {
						if ( typeof modal_el.__wpbc_bfb_add_new_update_confirm_state === 'function' ) {
							modal_el.__wpbc_bfb_add_new_update_confirm_state();
						}
					}
				}
			);
		}

		return modal_el.__wpbc_bfb_template_picker;
	}

	function wpbc_bfb__collect_payload(modal_el) {
		const title_el = wpbc_bfb__get_el( ID_TITLE );
		const slug_el  = wpbc_bfb__get_el( ID_SLUG );

		const img_el   = wpbc_bfb__get_el( ID_IMAGE_URL );
		const desc_el  = wpbc_bfb__get_el( ID_DESCRIPTION );

		const title_raw = title_el ? String( title_el.value || '' ).trim() : '';
		let slug_raw    = slug_el  ? String( slug_el.value  || '' ).trim() : '';

		slug_raw = wpbc_bfb__sanitize_key( slug_raw );

		const payload = {
			template_form_slug : wpbc_bfb__get_selected_template_slug( modal_el ),
			form_title         : title_raw,
			form_slug          : slug_raw,
			form_image_url     : img_el  ? String( img_el.value  || '' ).trim() : '',
			form_description   : desc_el ? String( desc_el.value || '' ).trim() : ''
		};

		return payload;
	}

	/**
	 * Template is optional. Only title + slug are required.
	 *
	 * @param {Object} payload
	 * @return {string} error message or ''
	 */
	function wpbc_bfb__validate_payload(payload) {
		if ( ! wpbc_bfb__has_text( payload.form_title ) ) {
			return wpbc_bfb__i18n( 'text_add_new_validation_title', 'Please enter a form title.' );
		}
		if ( ! wpbc_bfb__has_text( payload.form_slug ) ) {
			return wpbc_bfb__i18n( 'text_add_new_validation_slug', 'Please enter a valid form key (slug).' );
		}
		return '';
	}


	// ------------------------------------------------------------------------------------
	// Modal state/bind
	// ------------------------------------------------------------------------------------

	function wpbc_bfb__reset_modal_state(modal_el) {

		const title_el   = wpbc_bfb__get_el( ID_TITLE );
		const slug_el    = wpbc_bfb__get_el( ID_SLUG );
		const img_el     = wpbc_bfb__get_el( ID_IMAGE_URL );
		const desc_el    = wpbc_bfb__get_el( ID_DESCRIPTION );


		if ( title_el ) title_el.value = '';
		if ( slug_el )  slug_el.value  = '';
		if ( img_el )   img_el.value   = '';
		if ( desc_el )  desc_el.value  = '';


		// Auto-slug mode by default.
		if ( modal_el ) {
			modal_el.__wpbc_bfb_manual_slug = false;
		}

		const picker = wpbc_bfb__get_template_picker( modal_el );
		if ( picker ) {
			picker.reset_state();
		} else if ( modal_el ) {
			modal_el.__wpbc_bfb_selected_template_slug = BLANK_TEMPLATE_SLUG;
			modal_el.__wpbc_bfb_templates_cache   = [];
			modal_el.__wpbc_bfb_tpl_page          = 1;
			modal_el.__wpbc_bfb_tpl_has_more      = false;
			modal_el.__wpbc_bfb_tpl_search        = '';
			modal_el.__wpbc_bfb_tpl_search_timer  = 0;
		}
		wpbc_bfb__render_thumb( modal_el, '' );
		wpbc_bfb__set_error( '' );
		wpbc_bfb__set_confirm_enabled( false );
	}

	function wpbc_bfb__bind_modal_handlers(modal_el) {
		if ( ! modal_el || modal_el.__wpbc_bfb_handlers_bound ) {
			return;
		}
		modal_el.__wpbc_bfb_handlers_bound = true;

		const title_el  = wpbc_bfb__get_el( ID_TITLE );
		const slug_el   = wpbc_bfb__get_el( ID_SLUG );
		const img_el    = wpbc_bfb__get_el( ID_IMAGE_URL );

		function wpbc_bfb__update_confirm_state() {
			const payload = wpbc_bfb__collect_payload( modal_el );
			const err     = wpbc_bfb__validate_payload( payload );
			wpbc_bfb__set_error( '' );
			wpbc_bfb__set_confirm_enabled( ! err );
		}

		modal_el.__wpbc_bfb_add_new_update_confirm_state = wpbc_bfb__update_confirm_state;

		// Title -> auto slug (if not manual).
		if ( title_el ) {
			title_el.addEventListener( 'input', function () {

				const is_manual = !! modal_el.__wpbc_bfb_manual_slug;
				if ( ! is_manual && slug_el ) {
					const auto_slug = wpbc_bfb__slugify_to_key( title_el.value || '' );
					slug_el.value = auto_slug;
				}

				wpbc_bfb__update_confirm_state();
			}, true );
		}

		// Slug manual.
		if ( slug_el ) {
			slug_el.addEventListener( 'input', function () {
				modal_el.__wpbc_bfb_manual_slug = true;

				const sanitized = wpbc_bfb__sanitize_key( slug_el.value || '' );
				if ( sanitized !== slug_el.value ) {
					slug_el.value = sanitized;
				}

				wpbc_bfb__update_confirm_state();
			}, true );
		}

		// Image url -> thumbnail.
		if ( img_el ) {

			const update_thumb = function () {
				wpbc_bfb__render_thumb( modal_el, img_el.value || '' );
			};

			// wpbc_media_upload_button triggers via jQuery(.trigger) -> listen via jQuery(.on)
			if ( w.jQuery ) {
				w.jQuery( img_el )
					.off( 'wpbc_media_upload_url_set.wpbcBfbAddNewForm' )
					.on( 'wpbc_media_upload_url_set.wpbcBfbAddNewForm', update_thumb );
			}

			// Native fallback.
			img_el.addEventListener( 'wpbc_media_upload_url_set', update_thumb, true );
			img_el.addEventListener( 'input', update_thumb, true );
			img_el.addEventListener( 'change', update_thumb, true );
		}

		// Clear image.
		modal_el.addEventListener( 'click', function (e) {
			if ( ! e || ! e.target || ! e.target.closest ) {
				return;
			}
			const clear_btn = e.target.closest( SEL_CLEAR_IMAGE );
			if ( ! clear_btn ) {
				return;
			}
			e.preventDefault();

			const img = wpbc_bfb__get_el( ID_IMAGE_URL );
			if ( img ) {
				img.value = '';
				try {
					const ev = new Event( 'wpbc_media_upload_url_set' );
					img.dispatchEvent( ev );
				} catch ( _e ) {
					wpbc_bfb__render_thumb( modal_el, '' );
				}
			}
		}, true );

		// Any input that can affect validation -> update confirm state.
		modal_el.addEventListener( 'input', function (e) {
			if ( ! e || ! e.target ) {
				return;
			}
			if ( e.target.id === ID_DESCRIPTION ) {
				wpbc_bfb__update_confirm_state();
			}
		}, true );

		const picker = wpbc_bfb__get_template_picker( modal_el );
		if ( picker ) {
			picker.bind_handlers();
		}
	}

	UI.Modal_Add_New_Form.open = function (on_confirm, on_open) {

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

		// Store callback on modal instance (single modal, single active confirm).
		modal_el.__wpbc_bfb_add_new_form_cb = ( typeof on_confirm === 'function' ) ? on_confirm : null;

		wpbc_bfb__bind_modal_handlers( modal_el );
		wpbc_bfb__reset_modal_state( modal_el );

		UI.Modals.show( modal_el );

		const picker = wpbc_bfb__get_template_picker( modal_el );
		if ( picker ) {
			picker.set_pager( 1, false );
			picker.apply_search_value( '', function () {
				const payload = wpbc_bfb__collect_payload( modal_el );
				const err     = wpbc_bfb__validate_payload( payload );
				wpbc_bfb__set_confirm_enabled( ! err );
			} );
		} else {
			wpbc_bfb__set_error( 'WPBC BFB: Template Picker helper is not available. You can still create a blank form.' );
		}

		// Focus title input.
		w.setTimeout( function () {
			const title_el = wpbc_bfb__get_el( ID_TITLE );
			if ( title_el && title_el.focus ) {
				try { title_el.focus(); } catch ( _e ) {}
				try { title_el.select(); } catch ( _e2 ) {}
			}
		}, 0 );

		if ( on_open ) {
			try { on_open( modal_el ); } catch ( _e3 ) {}
		}

		// Bind WP Media uploader buttons inside modal.
		if ( w.jQuery ) {
			w.jQuery( modal_el )
				.off( 'click.wpbcMedia', '.wpbc_media_upload_button' )
				.on( 'click.wpbcMedia', '.wpbc_media_upload_button', function (event) {

					// Use safe typeof check (avoids ReferenceError).
					if ( typeof w.wpbc_media_upload_button_clicked === 'function' ) {
						w.wpbc_media_upload_button_clicked( this, event );
					} else if ( typeof wpbc_media_upload_button_clicked === 'function' ) {
						wpbc_media_upload_button_clicked( this, event );
					} else {
						alert(
							wpbc_bfb__i18n(
								'text_add_new_media_demo_restricted',
								'Warning! This feature is restricted in the public live demo.'
							)
						);
					}

				} );
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

			// Prevent confirm if disabled.
			if ( is_confirm.classList.contains( 'disabled' ) || is_confirm.getAttribute( 'aria-disabled' ) === 'true' ) {
				const payload0 = wpbc_bfb__collect_payload( modal_el );
				const err0     = wpbc_bfb__validate_payload( payload0 );
				if ( err0 ) {
					wpbc_bfb__set_error( err0 );
				}
				return;
			}

			const payload = wpbc_bfb__collect_payload( modal_el );
			const err     = wpbc_bfb__validate_payload( payload );
			if ( err ) {
				wpbc_bfb__set_error( err );
				wpbc_bfb__set_confirm_enabled( false );
				return;
			}

			wpbc_bfb__set_error( '' );

			const cb = modal_el.__wpbc_bfb_add_new_form_cb || null;
			modal_el.__wpbc_bfb_add_new_form_cb = null;

			UI.Modals.hide( modal_el );

			if ( cb ) {
				try { cb( payload ); } catch ( _e4 ) {}
			}
			return;
		}

		const is_cancel = e.target.closest( SEL_CANCEL );
		if ( is_cancel ) {
			e.preventDefault();
			modal_el.__wpbc_bfb_add_new_form_cb = null;
			UI.Modals.hide( modal_el );
		}

	}, true );

}( window, document ));


function wpbc_bfb__menu_forms__new(menu_option_this) {

	WPBC_BFB_Core.UI.Modal_Add_New_Form.open( function (payload) {

		var template_form_key = '';

		// Blank when:
		// - '__blank__' selected
		// - empty value (defensive)
		if ( payload && payload.template_form_slug && payload.template_form_slug !== '__blank__' ) {
			template_form_key = String( payload.template_form_slug );
		} else {
			template_form_key = '';
		}

		var $btn = ( window.jQuery && menu_option_this ) ? window.jQuery( menu_option_this ) : null;
		var original_busy_text = '';
		if ( $btn && $btn.length ) {
			original_busy_text = $btn.data( 'wpbc-u-busy-text' ) || '';
			$btn.data( 'wpbc-u-busy-text', wpbc_bfb__i18n( 'text_add_new_creating', 'Creating...' ) );
		}

		// 1) Create form in DB (clone template).
		if ( typeof window.wpbc_bfb__ajax_create_form !== 'function' ) {
			wpbc_admin_show_message( 'WPBC BFB: create helper missing.', 'error', 10000 );
			return;
		}

		window.wpbc_bfb__ajax_create_form( menu_option_this, payload, template_form_key, function (is_created, resp) {

			if ( $btn && $btn.length ) {
				$btn.data( 'wpbc-u-busy-text', original_busy_text );
			}

			if ( ! is_created ) {
				return;
			}

			// 2) Load the created form into Builder UI.
			if ( typeof window.wpbc_bfb__ajax_load_current_form === 'function' ) {
				window.wpbc_bfb__ajax_load_current_form( menu_option_this );
			}

			if ( typeof window.wpbc_admin_show_message === 'function' ) {
				window.wpbc_admin_show_message( wpbc_bfb__i18n( 'text_add_new_form_created', 'Form created' ), 'success', 2000, false );
			}
		} );

	} );
}
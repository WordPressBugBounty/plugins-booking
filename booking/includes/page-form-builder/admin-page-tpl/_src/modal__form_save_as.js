/**
 * Booking Calendar — "Save As" modal helper (BFB Admin)
 *
 * - Saves as Regular Form (published) or Template (template).
 * - Forces payload.form_details to JSON built from modal fields:
 *     { title, description, picture_url }
 * - NEVER sends form_details.form_name (prevents reserved/rename path).
 * - Updates thumbnail preview on image select / typing / remove.
 *
 * @file: ../includes/page-form-builder/admin-page-tpl/_out/modal__form_save_as.js
 */

/* global wpbc_admin_show_message */
(function (w, d) {
	'use strict';

	// Shared tiny namespace.
	w.WPBC_BFB_Save_As = w.WPBC_BFB_Save_As || {};
	if ( ! w.WPBC_BFB_Save_As.LOCK_MAX_MS ) {
		w.WPBC_BFB_Save_As.LOCK_MAX_MS = 20000;
	}

	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});
	UI.Modal_Save_As_Form = UI.Modal_Save_As_Form || {};

	if ( UI.Modal_Save_As_Form.__bound ) {
		return;
	}
	UI.Modal_Save_As_Form.__bound = true;

	const MODAL_DOM_ID = 'wpbc_bfb_modal__save_as_form';
	const TPL_MODAL_ID = 'wpbc-bfb-tpl-modal-save_as_form';

	const ID_TITLE       = 'wpbc_bfb_popup_modal__save_as_form__title';
	const ID_SLUG        = 'wpbc_bfb_popup_modal__save_as_form__slug';
	const ID_IMAGE_URL   = 'wpbc_bfb_popup_modal__save_as_form__image_url';
	const ID_DESCRIPTION = 'wpbc_bfb_popup_modal__save_as_form__description';

	const NAME_SAVE_TYPE = 'wpbc_bfb_save_as_form__save_type';

	const SEL_CONFIRM     = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-confirm="1"]';
	const SEL_CANCEL      = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-cancel="1"]';
	const SEL_ERROR       = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-error="1"]';
	const SEL_THUMB       = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-thumb="1"]';
	const SEL_CLEAR_IMAGE = '#' + MODAL_DOM_ID + ' [data-wpbc-bfb-clear-image="1"]';

	const ACTION_SAVE_PUBLISHED = 'WPBC_AJX_BFB_SAVE_FORM_CONFIG';
	const ACTION_SAVE_TEMPLATE  = 'WPBC_AJX_BFB_SAVE_FORM_CONFIG_TEMPLATE';

	// -----------------------------------------------------------------------------------------------------------------
	// Small helpers
	// -----------------------------------------------------------------------------------------------------------------

	function has_text( v ) {
		return !! ( v && String( v ).trim() );
	}

	function get_cfg() {
		return ( w.WPBC_BFB_Ajax || {} );
	}

	function get_el( id ) {
		return d.getElementById( id );
	}

	function get_state() {
		const cfg = get_cfg();
		cfg.__wpbc_bfb_save_as_state = cfg.__wpbc_bfb_save_as_state || {
			is_active         : false,
			lock_time         : 0,
			original_form_name: '',
			target_form_name  : '',
			save_type         : 'published',
			form_title        : '',
			form_description  : '',
			form_picture_url  : ''
		};
		return cfg.__wpbc_bfb_save_as_state;
	}

	function get_cached_meta() {
		const cfg = get_cfg();
		cfg.__wpbc_bfb_form_meta_cache = cfg.__wpbc_bfb_form_meta_cache || {
			title      : '',
			description: '',
			picture_url: ''
		};
		return cfg.__wpbc_bfb_form_meta_cache;
	}

	function set_error( msg ) {
		const el = d.querySelector( SEL_ERROR );
		if ( ! el ) {
			return;
		}
		if ( has_text( msg ) ) {
			el.innerHTML = String( msg );
			el.style.display = '';
		} else {
			el.innerHTML = '';
			el.style.display = 'none';
		}
	}

	function set_confirm_enabled( is_enabled ) {
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

	function show_modal( modal_el ) {
		if ( UI.Modals && typeof UI.Modals.show === 'function' ) {
			try { UI.Modals.show( modal_el ); return; } catch ( _e ) {}
		}
		if ( w.jQuery && w.jQuery.fn && typeof w.jQuery.fn.modal === 'function' ) {
			try { w.jQuery( modal_el ).modal( 'show' ); return; } catch ( _e2 ) {}
		}
	}

	function hide_modal( modal_el ) {
		if ( UI.Modals && typeof UI.Modals.hide === 'function' ) {
			try { UI.Modals.hide( modal_el ); } catch ( _e ) {}
		} else if ( w.jQuery && w.jQuery.fn && typeof w.jQuery.fn.modal === 'function' ) {
			try { w.jQuery( modal_el ).modal( 'hide' ); } catch ( _e2 ) {}
		}

		// safety cleanup for stuck backdrop
		try {
			const backdrops = d.querySelectorAll( '.modal-backdrop' );
			for ( let i = 0; i < backdrops.length; i++ ) {
				backdrops[i].parentNode && backdrops[i].parentNode.removeChild( backdrops[i] );
			}
			if ( d.body ) {
				d.body.classList.remove( 'modal-open' );
				d.body.style.paddingRight = '';
			}
		} catch ( _e3 ) {}
	}

	function sanitize_key( value ) {
		let v = String( value || '' ).trim().toLowerCase();
		v = v.replace( /[^a-z0-9_]+/g, '_' );
		v = v.replace( /_+/g, '_' ); // .replace( /^_+|_+$/g, '' );
		if ( v && /^[0-9]/.test( v ) ) {
			v = 'form_' + v;
		}
		return v;
	}

	function slugify_to_key( value ) {
		let v = String( value || '' ).trim().toLowerCase();
		try {
			if ( v && v.normalize ) {
				v = v.normalize( 'NFD' ).replace( /[\u0300-\u036f]/g, '' );
			}
		} catch ( _e ) {}
		v = v.replace( /['"]/g, '' );
		v = v.replace( /[^a-z0-9_\-\s]+/g, '' );
		v = v.replace( /[\s\-]+/g, '_' );
		v = v.replace( /_+/g, '_' ); // .replace( /^_+|_+$/g, '' );
		if ( v && /^[0-9]/.test( v ) ) {
			v = 'form_' + v;
		}
		return v;
	}

	function get_save_type() {
		const el = d.querySelector( 'input[name="' + NAME_SAVE_TYPE + '"]:checked' );
		const v  = el ? String( el.value || '' ).toLowerCase() : 'published';
		return ( v === 'template' ) ? 'template' : 'published';
	}

	function render_thumb( url ) {
		const thumb = d.querySelector( SEL_THUMB );
		if ( ! thumb ) {
			return;
		}
		const safe_url = String( url || '' ).trim();
		if ( safe_url ) {
			thumb.innerHTML = '<img src="' + safe_url.replace( /"/g, '&quot;' ) + '" style="width:100%;height:100%;object-fit:cover;" alt="" />';
		} else {
			thumb.innerHTML = '<span class="description" style="padding:6px;text-align:center;">No Image</span>';
		}
	}

	function collect_payload() {
		const title_el = get_el( ID_TITLE );
		const slug_el  = get_el( ID_SLUG );
		const img_el   = get_el( ID_IMAGE_URL );
		const desc_el  = get_el( ID_DESCRIPTION );

		const title_raw = title_el ? String( title_el.value || '' ) : '';
		let slug_raw    = slug_el ? String( slug_el.value || '' ) : '';
		slug_raw = sanitize_key( slug_raw );

		return {
			form_title      : String( title_raw ).trim(),
			form_slug       : slug_raw,
			save_type       : get_save_type(),
			form_picture_url: img_el ? String( img_el.value || '' ).trim() : '',
			form_description: desc_el ? String( desc_el.value || '' ) : ''
		};
	}

	function validate_payload( payload ) {
		if ( ! has_text( payload.form_slug ) ) {
			return 'Please enter a valid form key (slug).';
		}
		if ( 'standard' === String( payload.form_slug ) ) {
			return 'This form key is reserved. Please choose another.';
		}
		return '';
	}

	function build_form_details_json( st ) {
		// IMPORTANT: do NOT include form_name here.
		const details = {
			title      : String( st.form_title || '' ),
			description: String( st.form_description || '' ),
			picture_url: String( st.form_picture_url || '' )
		};
		try {
			return JSON.stringify( details );
		} catch ( _e ) {
			return '{"title":"","description":"","picture_url":""}';
		}
	}

	function set_payload_for_save_as( payload, st ) {
		const save_type = ( st.save_type === 'template' ) ? 'template' : 'published';

		payload.form_name = String( st.target_form_name );

		payload.action = ( save_type === 'template' ) ? ACTION_SAVE_TEMPLATE : ACTION_SAVE_PUBLISHED;
		payload.status = ( save_type === 'template' ) ? 'template' : 'published';

		// Force meta from modal (always JSON string).
		payload.form_details = build_form_details_json( st );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Cache current form meta on load (so modal can prefill image/desc).
	// -----------------------------------------------------------------------------------------------------------------
	if ( ! d.__wpbc_bfb_save_as_meta_cache_bound ) {
		d.__wpbc_bfb_save_as_meta_cache_bound = true;

		d.addEventListener( 'wpbc:bfb:form:ajax_loaded', function ( e ) {
			try {
				const cfg = get_cfg();
				const detail = e && e.detail ? e.detail : null;
				const data = detail && detail.loaded_data ? detail.loaded_data : null;
				if ( ! data ) {
					return;
				}
				cfg.__wpbc_bfb_form_meta_cache = cfg.__wpbc_bfb_form_meta_cache || {};
				cfg.__wpbc_bfb_form_meta_cache.title       = data.title ? String( data.title ) : '';
				cfg.__wpbc_bfb_form_meta_cache.description = data.description ? String( data.description ) : '';
				cfg.__wpbc_bfb_form_meta_cache.picture_url = data.picture_url ? String( data.picture_url ) : '';
			} catch ( _e0 ) {}
		}, true );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Patch outgoing save payload (hook + last-chance prefilter)
	// -----------------------------------------------------------------------------------------------------------------
	if ( ! d.__wpbc_bfb_save_as_before_save_bound ) {
		d.__wpbc_bfb_save_as_before_save_bound = true;

		d.addEventListener( 'wpbc:bfb:form:before_save_payload', function ( e ) {

			const st = get_state();
			if ( ! st.is_active || ! st.target_form_name ) {
				return;
			}

			const detail = e && e.detail ? e.detail : null;
			if ( ! detail || ! detail.payload ) {
				return;
			}

			set_payload_for_save_as( detail.payload, st );

		}, true );
	}

	if ( w.jQuery && ! w.WPBC_BFB_Save_As.__ajax_prefilter_bound ) {
		w.WPBC_BFB_Save_As.__ajax_prefilter_bound = true;

		function strip_name_params_from_urlsearchparams(p) {
			// Remove potential nested array serialization variants:
			// form_details[form_name]=standard etc.
			const keys_to_delete = [
				'form_details[form_name]',
				'form_details[form_slug]',
				'form_details[slug]',
				'form_details[key]',
				'form_name_in_details',
				'form_details_form_name'
			];
			for ( let i = 0; i < keys_to_delete.length; i++ ) {
				try { p.delete( keys_to_delete[i] ); } catch ( _e ) {}
			}
		}

		function strip_name_fields_from_formdata(fd) {
			const keys_to_delete = [
				'form_details[form_name]',
				'form_details[form_slug]',
				'form_details[slug]',
				'form_details[key]',
				'form_name_in_details',
				'form_details_form_name'
			];
			for ( let i = 0; i < keys_to_delete.length; i++ ) {
				try { fd.delete( keys_to_delete[i] ); } catch ( _e ) {}
			}
		}

		w.jQuery.ajaxPrefilter( function ( options, original_options ) {

			try {
				const st = get_state();
				if ( ! st || ! st.is_active || ! st.target_form_name ) {
					return;
				}

				const data = ( options && options.data !== undefined )
					? options.data
					: ( original_options ? original_options.data : null );

				if ( ! data ) {
					return;
				}

				const action = ( st.save_type === 'template' ) ? ACTION_SAVE_TEMPLATE : ACTION_SAVE_PUBLISHED;
				const status = ( st.save_type === 'template' ) ? 'template' : 'published';
				const target = String( st.target_form_name );

				// ---------------------------------------------------------------------------------
				// 1) Object payload (classic jQuery style)
				// ---------------------------------------------------------------------------------
				if ( typeof data === 'object' && ! ( w.FormData && data instanceof w.FormData ) ) {

					const a = String( data.action || '' );
					if ( a !== ACTION_SAVE_PUBLISHED && a !== ACTION_SAVE_TEMPLATE ) {
						return; // do not touch unrelated requests
					}

					data.action    = action;
					data.status    = status;
					data.form_name = target;

					// IMPORTANT: force JSON string; do NOT allow nested form_details[...] keys.
					data.form_details = build_form_details_json( st );

					// Also wipe any possible helper keys if some module adds them.
					try { delete data.form_details_form_name; } catch ( _e1 ) {}
					try { delete data.form_name_in_details; } catch ( _e2 ) {}

					options.data = data;
					return;
				}

				// ---------------------------------------------------------------------------------
				// 2) FormData payload (some save helpers use it)
				// ---------------------------------------------------------------------------------
				if ( w.FormData && data instanceof w.FormData ) {

					// best effort: only if it's a save request
					const a = String( data.get ? (data.get('action') || '') : '' );
					if ( a !== ACTION_SAVE_PUBLISHED && a !== ACTION_SAVE_TEMPLATE ) {
						return;
					}

					strip_name_fields_from_formdata( data );

					if ( data.set ) {
						data.set( 'action', action );
						data.set( 'status', status );
						data.set( 'form_name', target );
						data.set( 'form_details', build_form_details_json( st ) );
					} else {
						// fallback if no .set()
						data.append( 'action', action );
						data.append( 'status', status );
						data.append( 'form_name', target );
						data.append( 'form_details', build_form_details_json( st ) );
					}

					options.data = data;
					return;
				}

				// ---------------------------------------------------------------------------------
				// 3) String payload (URL-encoded)  <<< THIS was missing in your current code
				// ---------------------------------------------------------------------------------
				if ( typeof data === 'string' && w.URLSearchParams ) {

					const p = new URLSearchParams( data );
					const a = String( p.get( 'action' ) || '' );

					if ( a !== ACTION_SAVE_PUBLISHED && a !== ACTION_SAVE_TEMPLATE ) {
						return;
					}

					// Kill any nested name keys that PHP would interpret as form_details['form_name'].
					strip_name_params_from_urlsearchparams( p );

					p.set( 'action', action );
					p.set( 'status', status );
					p.set( 'form_name', target );

					// Force JSON string (NO form_name inside).
					p.set( 'form_details', build_form_details_json( st ) );

					options.data = p.toString();
				}

			} catch ( _e ) {}
		} );
	}

	// -----------------------------------------------------------------------------------------------------------------
	// Modal: open + bind
	// -----------------------------------------------------------------------------------------------------------------

	function bind_modal_handlers_once( modal_el ) {
		if ( ! modal_el || modal_el.__wpbc_bfb_handlers_bound ) {
			return;
		}
		modal_el.__wpbc_bfb_handlers_bound = true;

		const title_el = get_el( ID_TITLE );
		const slug_el  = get_el( ID_SLUG );
		const img_el   = get_el( ID_IMAGE_URL );

		function update_confirm_state() {
			const p = collect_payload();
			const err = validate_payload( p );
			set_error( '' );
			set_confirm_enabled( ! err );
		}

		if ( title_el ) {
			title_el.addEventListener( 'input', function () {
				// only auto-suggest slug if user did not touch slug manually.
				if ( slug_el && ! modal_el.__wpbc_bfb_manual_slug ) {
					const auto_slug = slugify_to_key( title_el.value || '' );
					if ( auto_slug ) {
						slug_el.value = auto_slug;
					}
				}
				update_confirm_state();
			}, true );
		}

		if ( slug_el ) {
			slug_el.addEventListener( 'input', function () {
				modal_el.__wpbc_bfb_manual_slug = true;

				const sanitized = sanitize_key( slug_el.value || '' );
				if ( sanitized !== slug_el.value ) {
					slug_el.value = sanitized;
				}
				update_confirm_state();
			}, true );
		}

		// Save type change: does not affect validation, but keep UI consistent.
		modal_el.addEventListener( 'change', function ( e ) {
			if ( e && e.target && e.target.name === NAME_SAVE_TYPE ) {
				update_confirm_state();
			}
		}, true );

		// Image thumb updates (same approach as Add New Form).
		if ( img_el ) {
			const update_thumb = function () {
				render_thumb( img_el.value || '' );
			};

			if ( w.jQuery ) {
				w.jQuery( img_el )
					.off( 'wpbc_media_upload_url_set.wpbcBfbSaveAsForm' )
					.on( 'wpbc_media_upload_url_set.wpbcBfbSaveAsForm', update_thumb );
			}

			img_el.addEventListener( 'wpbc_media_upload_url_set', update_thumb, true );
			img_el.addEventListener( 'input', update_thumb, true );
			img_el.addEventListener( 'change', update_thumb, true );
		}

		// Clear image.
		modal_el.addEventListener( 'click', function ( e ) {
			if ( ! e || ! e.target || ! e.target.closest ) {
				return;
			}
			const btn = e.target.closest( SEL_CLEAR_IMAGE );
			if ( ! btn ) {
				return;
			}
			e.preventDefault();

			const img = get_el( ID_IMAGE_URL );
			if ( img ) {
				img.value = '';
				render_thumb( '' );

				// keep behavior consistent with uploader listeners
				try {
					const ev = new Event( 'wpbc_media_upload_url_set' );
					img.dispatchEvent( ev );
				} catch ( _e0 ) {}
			}
		}, true );
	}

	function reset_modal_state( modal_el ) {

		const title_el = get_el( ID_TITLE );
		const slug_el  = get_el( ID_SLUG );
		const img_el   = get_el( ID_IMAGE_URL );
		const desc_el  = get_el( ID_DESCRIPTION );

		if ( title_el ) title_el.value = '';
		if ( slug_el )  slug_el.value  = '';
		if ( img_el )   img_el.value   = '';
		if ( desc_el )  desc_el.value  = '';

		const published_radio = d.querySelector( 'input[name="' + NAME_SAVE_TYPE + '"][value="published"]' );
		if ( published_radio ) {
			published_radio.checked = true;
		}

		if ( modal_el ) {
			modal_el.__wpbc_bfb_manual_slug = false;
		}

		render_thumb( '' );
		set_error( '' );
		set_confirm_enabled( false );
	}

	function prefill_from_cache() {
		const meta = get_cached_meta();

		const title_el = get_el( ID_TITLE );
		const img_el   = get_el( ID_IMAGE_URL );
		const desc_el  = get_el( ID_DESCRIPTION );

		// Fill only if empty (so re-open after cancel keeps latest cache).
		if ( title_el && ! has_text( title_el.value ) && has_text( meta.title ) ) {
			title_el.value = String( meta.title );
		}
		if ( img_el && ! has_text( img_el.value ) && has_text( meta.picture_url ) ) {
			img_el.value = String( meta.picture_url );
		}
		if ( desc_el && ! has_text( desc_el.value ) && has_text( meta.description ) ) {
			desc_el.value = String( meta.description );
		}

		render_thumb( img_el ? img_el.value : '' );
	}

	UI.Modal_Save_As_Form.open = function ( on_confirm, on_open ) {

		const ref = UI.Templates.ensure_dom_ref_from_wp_template( TPL_MODAL_ID, MODAL_DOM_ID );
		if ( ! ref || ! ref.el ) {
			return;
		}

		let modal_el = ref.el;

		if ( modal_el && modal_el.id !== MODAL_DOM_ID ) {
			const inside = modal_el.querySelector ? modal_el.querySelector( '#' + MODAL_DOM_ID ) : null;
			if ( inside ) {
				modal_el = inside;
			}
		}
		if ( ! modal_el ) {
			return;
		}

		if ( ! d.body.contains( modal_el ) ) {
			try { d.body.appendChild( modal_el ); } catch ( _e0 ) {}
		}

		modal_el.__wpbc_bfb_save_as_cb = ( typeof on_confirm === 'function' ) ? on_confirm : null;

		bind_modal_handlers_once( modal_el );
		reset_modal_state( modal_el );
		prefill_from_cache();

		show_modal( modal_el );

		// Bind media upload button click inside this modal (same as Add New Form).
		if ( w.jQuery ) {
			w.jQuery( modal_el )
				.off( 'click.wpbcMediaSaveAs', '.wpbc_media_upload_button' )
				.on( 'click.wpbcMediaSaveAs', '.wpbc_media_upload_button', function ( event ) {

					// Use safe typeof check (avoids ReferenceError).
					if ( typeof w.wpbc_media_upload_button_clicked === 'function' ) {
						w.wpbc_media_upload_button_clicked( this, event );
					} else if ( typeof wpbc_media_upload_button_clicked === 'function' ) {
						wpbc_media_upload_button_clicked( this, event );
					} else {
					   alert('Warning! This feature is restricted in the public live demo.' );
					}
				} );
		}
		// Also open media modal when clicking on the thumbnail preview.
		if ( w.jQuery ) {
			w.jQuery( modal_el )
			 .off( 'click.wpbcMediaSaveAsThumb', '[data-wpbc-bfb-open-media="1"]' )
			 .on( 'click.wpbcMediaSaveAsThumb', '[data-wpbc-bfb-open-media="1"]', function (event) {

				 // Find the "Select Image" button inside the same modal and trigger uploader on it.
				 const btn = modal_el.querySelector ? modal_el.querySelector( '.wpbc_media_upload_button' ) : null;
				 if ( ! btn ) {
					 return;
				 }

				 // Use safe typeof check (avoids ReferenceError).
				 if ( typeof w.wpbc_media_upload_button_clicked === 'function' ) {
					 w.wpbc_media_upload_button_clicked( btn, event );
				 } else if ( typeof wpbc_media_upload_button_clicked === 'function' ) {
					 wpbc_media_upload_button_clicked( btn, event );
				 } else {
				   alert('Warning! This feature is restricted in the public live demo.' );
				}
			 } );
		}
		// Focus slug input.
		w.setTimeout( function () {
			const slug_el = get_el( ID_SLUG );
			if ( slug_el && slug_el.focus ) {
				try { slug_el.focus(); } catch ( _e1 ) {}
				try { slug_el.select(); } catch ( _e2 ) {}
			}
		}, 0 );

		if ( typeof on_open === 'function' ) {
			try { on_open( modal_el ); } catch ( _e3 ) {}
		}
	};

	// Confirm / Cancel (delegated).
	d.addEventListener( 'click', function ( e ) {

		const modal_el = d.getElementById( MODAL_DOM_ID );
		if ( ! modal_el || ! e || ! e.target || ! e.target.closest ) {
			return;
		}

		const is_confirm = e.target.closest( SEL_CONFIRM );
		if ( is_confirm ) {
			e.preventDefault();

			if ( is_confirm.classList.contains( 'disabled' ) || is_confirm.getAttribute( 'aria-disabled' ) === 'true' ) {
				const p0 = collect_payload();
				const err0 = validate_payload( p0 );
				if ( err0 ) {
					set_error( err0 );
				}
				return;
			}

			const payload = collect_payload();
			const err = validate_payload( payload );
			if ( err ) {
				set_error( err );
				set_confirm_enabled( false );
				return;
			}

			set_error( '' );

			const cb = modal_el.__wpbc_bfb_save_as_cb || null;
			modal_el.__wpbc_bfb_save_as_cb = null;

			hide_modal( modal_el );

			if ( cb ) {
				try { cb( payload ); } catch ( _e4 ) {}
			}
			return;
		}

		const is_cancel = e.target.closest( SEL_CANCEL );
		if ( is_cancel ) {
			e.preventDefault();
			modal_el.__wpbc_bfb_save_as_cb = null;
			hide_modal( modal_el );
		}

	}, true );

}( window, document ));


/**
 * Menu handler: "Save As..."
 *
 * @param {HTMLElement} menu_option_this
 */
function wpbc_bfb__menu_forms__save_as( menu_option_this ) {

	var cfg = window.WPBC_BFB_Ajax || {};
	var lock_ms = ( window.WPBC_BFB_Save_As && window.WPBC_BFB_Save_As.LOCK_MAX_MS ) ? parseInt( window.WPBC_BFB_Save_As.LOCK_MAX_MS, 10 ) : 20000;

	if ( ! window.WPBC_BFB_Core || ! window.WPBC_BFB_Core.UI || ! window.WPBC_BFB_Core.UI.Modal_Save_As_Form ) {
		wpbc_admin_show_message( 'WPBC BFB: Save As modal is not loaded.', 'error', 8000 );
		return;
	}

	window.WPBC_BFB_Core.UI.Modal_Save_As_Form.open(
		function ( payload ) {

			if ( ! payload || ! payload.form_slug ) {
				return;
			}
			if ( typeof window.wpbc_bfb__ajax_save_current_form !== 'function' ) {
				wpbc_admin_show_message( 'WPBC BFB: save helper missing.', 'error', 10000 );
				return;
			}

			var st = ( cfg.__wpbc_bfb_save_as_state = cfg.__wpbc_bfb_save_as_state || {} );

			// Simple lock.
			if ( st.is_active ) {
				var age = Date.now() - ( parseInt( st.lock_time || 0, 10 ) || 0 );
				if ( age < lock_ms ) {
					wpbc_admin_show_message( 'Save As is still in progress...', 'warning', 2000, false );
					return;
				}
				st.is_active = false;
			}

			var original_form_name = String( cfg.form_name || 'standard' );
			var target_form_name   = String( payload.form_slug );
			var save_type          = ( payload.save_type === 'template' ) ? 'template' : 'published';

			// Activate state used by hook + prefilter.
			st.is_active          = true;
			st.lock_time          = Date.now();
			st.original_form_name = original_form_name;
			st.target_form_name   = target_form_name;
			st.save_type          = save_type;

			// Meta (always taken from modal).
			st.form_title         = String( payload.form_title || '' );
			st.form_description   = String( payload.form_description || '' );
			st.form_picture_url   = String( payload.form_picture_url || '' );

			// Switch context so saving targets the new slug.
			cfg.form_name = target_form_name;

			var watchdog_id = setTimeout( function () {
				st.is_active = false;
			}, lock_ms );

			window.wpbc_bfb__ajax_save_current_form( menu_option_this, function ( is_saved ) {

				try { clearTimeout( watchdog_id ); } catch ( _e0 ) {}

				if ( ! is_saved ) {
					cfg.form_name = original_form_name;
					st.is_active = false;
					return;
				}

				if ( save_type === 'template' ) {
					// keep working on the original
					cfg.form_name = original_form_name;
					wpbc_admin_show_message( 'Template saved: ' + target_form_name, 'success', 2000, false );
				} else {
					wpbc_admin_show_message( 'Saved As: ' + target_form_name, 'success', 2000, false );
				}

				st.is_active = false;
			} );
		},
		function () {
			// Suggest slug based on current form.
			var slug_el = document.getElementById( 'wpbc_bfb_popup_modal__save_as_form__slug' );
			if ( ! slug_el ) {
				return;
			}

			var base = String( cfg.form_name || 'standard' );
			var suggested = /_copy(\d+)?$/.test( base )
				? base.replace( /_copy(\d+)?$/, function ( _m, n ) {
					var num = n ? parseInt( n, 10 ) : 1;
					num = ( ! num || num < 1 ) ? 1 : num;
					return '_copy' + ( num + 1 );
				} )
				: ( base + '_copy' );

			if ( 'standard' === suggested ) {
				suggested = 'standard_copy';
			}

			slug_el.value = suggested;

			// Trigger sanitization + enable confirm.
			try { slug_el.dispatchEvent( new Event( 'input' ) ); } catch ( _e ) {}
		}
	);
}
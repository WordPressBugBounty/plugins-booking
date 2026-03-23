/* globals window, document */
(function (w, d) {
	'use strict';

	var api = w.WPBC_BFB_Form_Details = w.WPBC_BFB_Form_Details || {};

	var is_ready = false;

	function get_input_el(setting_key) {
		var id = 'wpbc_bfb_setting__' + setting_key;
		return d.getElementById(id);
	}

	function get_picture_url_el() {
		return get_input_el('bfb_form_details__picture_url');
	}

	function get_preview_img_el() {
		var root = d.querySelector('[data-wpbc-bfb-form-details-media="1"]');
		return root ? root.querySelector('.wpbc_bfb__form_details_media__img') : null;
	}

	function get_preview_placeholder_el() {
		var root = d.querySelector('[data-wpbc-bfb-form-details-media="1"]');
		return root ? root.querySelector('.wpbc_bfb__form_details_media__placeholder') : null;
	}

	function get_preview_img_el__at_top_toolbar() {
		var el = d.querySelector( '.wpbc_bfb__hint__top_bar .wpbc_bfb__form_details_media__img' );
		return el ? el : null;
	}

	function get_preview_placeholder_el__at_top_toolbar() {
		var el = d.querySelector( '.wpbc_bfb__hint__top_bar .wpbc_bfb__form_details_media__placeholder' );
		return el ? el : null;
	}

	function show_hide_preview_image(url, img, ph) {

		if ( ! img || ! ph ) {
			return;
		}

		if ( typeof url === 'string' && url.trim() ) {
			img.src = url;
			img.style.display = 'block';
			ph.style.display = 'none';
		} else {
			img.src = '';
			img.style.display = 'none';
			ph.style.display = 'block';
		}
	}

	function set_preview_image(url) {

		var img = get_preview_img_el();
		var ph  = get_preview_placeholder_el();
		show_hide_preview_image( url, img, ph );

		img = get_preview_img_el__at_top_toolbar();
		ph  = get_preview_placeholder_el__at_top_toolbar();
		show_hide_preview_image( url, img, ph );
	}

	function sanitize_form_name(raw_value) {
		var val = (typeof raw_value === 'string') ? raw_value : '';
		val = val.trim();

		// Prefer core sanitize if available.
		if ( w.WPBC_BFB_Core && w.WPBC_BFB_Core.Sanitize && typeof w.WPBC_BFB_Core.Sanitize.to_token === 'function' ) {
			return w.WPBC_BFB_Core.Sanitize.to_token(val);
		}

		// Fallback: allow a-z 0-9 _ only.
		val = val.toLowerCase();
		val = val.replace(/[^a-z0-9_]+/g, '_');
		val = val.replace(/^_+|_+$/g, '');
		return val;
	}

	function apply_loaded_data(detail) {
		if ( ! w.jQuery ) {
			return;
		}

		var loaded = (detail && typeof detail.loaded_data === 'object' && detail.loaded_data) ? detail.loaded_data : {};

		var form_name_el   = get_input_el('bfb_form_details__form_name');
		var title_el       = get_input_el('bfb_form_details__title');
		var picture_url_el = get_picture_url_el();
		var desc_el        = get_input_el('bfb_form_details__description');

		var form_name   = loaded.form_name || detail.form_name || 'standard';
		var title       = (typeof loaded.title === 'string' && loaded.title.trim()) ? loaded.title.trim() : form_name;
		var picture_url = (typeof loaded.picture_url === 'string' && loaded.picture_url.trim()) ? loaded.picture_url.trim() : '';
		var description = (typeof loaded.description === 'string' && loaded.description.trim()) ? loaded.description.trim() : '';

		if ( form_name_el ) { form_name_el.value = form_name; }
		if ( title_el ) { title_el.value = title; }
		if ( picture_url_el ) { picture_url_el.value = picture_url; }
		if ( desc_el ) { desc_el.value = description; }

		set_preview_image(picture_url);

		// Optional: update the existing hint title, if present.
		var $hint_title = w.jQuery('.wpbc_bfb__hint__form_name .wpbc_bfb__hint__form_name__title a.value');
		var $hint_pic = w.jQuery('.wpbc_bfb__hint__form_name .wpbc_bfb__form_details_media__img');
		var $hint_slug = w.jQuery('.wpbc_bfb__hint__form_name .wpbc_bfb__hint__form_name__slug span.value');
		var $hint_title_i = w.jQuery('.wpbc_bfb__hint__form_name .wpbc_bfb__hint__form_name__title i');
		if ( $hint_title.length ) { $hint_title.text(title); }
		if ( $hint_title.length ) { $hint_title.attr("title", description); }
		if ( $hint_pic.length ) { $hint_pic.attr("src", picture_url); }
		if ( $hint_slug.length ) { $hint_slug.text( form_name ); }
		w.jQuery( '.wpbc_bfb__hint__form_name__label' ).css( 'display', 'flex' );
		if (picture_url){
			w.jQuery( '.wpbc_bfb__hint__top_bar.wpbc_bfb__hint__form_name .wpbc_bfb__form_details_media__preview img' ).css( 'display', 'block' );
			w.jQuery( '.wpbc_bfb__hint__top_bar.wpbc_bfb__hint__form_name .wpbc_bfb__form_details_media__preview .wpbc_bfb__form_details_media__placeholder' ).css( 'display', 'none' );
		}
	}


	/**
	 * Sync UI after picture URL change.
	 *
	 * @return void
	 */
	function on_picture_url_changed() {

		var picture_url_el = get_picture_url_el();
		var url = ( picture_url_el && typeof picture_url_el.value === 'string' ) ? picture_url_el.value : '';

		set_preview_image( url );

		// Keep existing hint image in sync (if present).
		if ( w.jQuery ) {
			var $hint_pic = w.jQuery( '.wpbc_bfb__hint__form_name .wpbc_bfb__form_details_media__img' );
			if ( $hint_pic.length ) {
				$hint_pic.attr( 'src', url );
			}
		}
	}

	function remove_selected_image() {

		var picture_url_el = get_picture_url_el();

		if ( picture_url_el ) {
			picture_url_el.value = '';
		}

		on_picture_url_changed();
	}

	function bind_ui() {

		if ( is_ready ) {
			return;
		}
		is_ready = true;

		// Load values when current form is loaded/saved via AJAX.
		d.addEventListener( 'wpbc:bfb:form:ajax_loaded', function ( e ) {
			apply_loaded_data( e && e.detail ? e.detail : null );
		}, { passive: true } );

		d.addEventListener( 'wpbc:bfb:form:ajax_saved', function ( e ) {
			apply_loaded_data( e && e.detail ? e.detail : null );
		}, { passive: true } );

		// React to URL changes (manual edits + programmatic set from uploader).
		var picture_url_el = get_picture_url_el();
		if ( picture_url_el ) {

			picture_url_el.addEventListener( 'input', on_picture_url_changed, { passive: true } );
			picture_url_el.addEventListener( 'change', on_picture_url_changed, { passive: true } );

			// Your custom uploader hook (jQuery event).
			if ( w.jQuery ) {
				w.jQuery( picture_url_el ).on( 'wpbc_media_upload_url_set', function () {
					on_picture_url_changed();
				} );
			}
		}

		// Remove button stays native.
		var btn_remove = d.getElementById( 'wpbc_bfb__form_details_remove_image' );
		if ( btn_remove ) {
			btn_remove.addEventListener( 'click', function ( evt ) {
				evt.preventDefault();
				remove_selected_image();
			} );
		}

		// Optional: keyboard support for clickable preview (if it’s a DIV).
		var btn_img = d.querySelector( '.wpbc_bfb__form_details_media__preview' );
		if ( btn_img ) {
			btn_img.addEventListener( 'keydown', function ( evt ) {
				if ( 'Enter' === evt.key || ' ' === evt.key ) {
					evt.preventDefault();
					btn_img.click();
				}
			} );
		}

		// Sanitize slug on blur (keep your existing code).
		var form_name_el = get_input_el( 'bfb_form_details__form_name' );
		if ( form_name_el ) {
			form_name_el.addEventListener( 'blur', function () {
				form_name_el.value = sanitize_form_name( form_name_el.value );
			} );
		}
	}

	function boot() {
		bind_ui();
		bind_events();
	}

	if ( d.readyState === 'loading' ) {
		d.addEventListener('DOMContentLoaded', boot, { once: true });
	} else {
		boot();
	}

	// Public helpers.
	api.apply_loaded_data = apply_loaded_data;

	// == Top Toolbar Form Name  and Picture tumb ======================================================================
	function bind_events() {
		// On click on Booking form Title in  top  toolbar.
		d.addEventListener( 'click', function (ev) {
			var btn = ev.target && ev.target.closest( '.wpbc_bfb__hint__top_bar .wpbc_bfb__hint__form_name__title .value' );
			if ( ! btn ) { return; }
			ev.preventDefault();
			// Open "From Details" inspector sidebar.
			d.querySelector( '[role="tab"][aria-controls="wpbc_bfb__inspector_form_details"]' ).click();
		} );
	}

})(window, document);

/**
 * @file: ../includes/page-form-builder/admin-page-tpl/_src/modal__form_templates.js
 */
(function (w, d) {
	'use strict';

	const Core = (w.WPBC_BFB_Core = w.WPBC_BFB_Core || {});
	const UI   = (Core.UI = Core.UI || {});

	UI.Template_Picker = UI.Template_Picker || {};

	function wpbc_bfb__i18n(key, fallback) {
		try {
			const cfg = w.WPBC_BFB_Ajax || {};
			const val = (cfg && typeof cfg[key] !== 'undefined') ? String( cfg[key] ) : '';
			return val ? val : String( fallback || '' );
		} catch ( _e ) {
			return String( fallback || '' );
		}
	}

	/**
	 * Get configured OR separator for multi-keyword search.
	 *
	 * @returns {string}
	 */
	function wpbc_bfb__get_template_search_or_sep() {
		try {
			const cfg = w.WPBC_BFB_Ajax || {};
			const v = ( cfg && cfg.template_search_or_sep ) ? String( cfg.template_search_or_sep ) : '';
			return v ? v : '|';
		} catch ( _e ) {
			return '|';
		}
	}

	/**
	 * Get URL OR separator.
	 *
	 * @returns {string}
	 */
	function wpbc_bfb__get_template_search_or_sep_url() {
		try {
			const cfg = w.WPBC_BFB_Ajax || {};
			const v = ( cfg && cfg.template_search_or_sep_url ) ? String( cfg.template_search_or_sep_url ) : '';
			return v ? v : '^';
		} catch ( _e ) {
			return '^';
		}
	}

	/**
	 * Escape a string for use in RegExp constructor.
	 *
	 * @param {string} s
	 * @returns {string}
	 */
	function wpbc_bfb__escape_regex(s) {
		return String( s || '' ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	}

	/**
	 * Normalize a search string so server-side split works.
	 *
	 * @param {string} raw
	 * @returns {string}
	 */
	function wpbc_bfb__normalize_template_search(raw) {
		let s = String( raw || '' )
			.replace( /[\u0000-\u001F\u007F]/g, ' ' )
			.replace( /\s+/g, ' ' )
			.trim();

		const sep    = wpbc_bfb__get_template_search_or_sep();
		const url_sep = wpbc_bfb__get_template_search_or_sep_url();

		if ( url_sep && url_sep !== sep ) {
			const esc_url = wpbc_bfb__escape_regex( url_sep );
			s = s.replace( new RegExp( '\\s*' + esc_url + '\\s*', 'g' ), sep );
		}

		s = s.replace( /\s*\|\s*/g, sep );

		const esc = wpbc_bfb__escape_regex( sep );
		s = s.replace( new RegExp( '\\s*' + esc + '\\s*', 'g' ), sep );
		s = s.replace( new RegExp( esc + '{2,}', 'g' ), sep );
		s = s.replace( new RegExp( '^' + esc + '+|' + esc + '+$', 'g' ), '' ).trim();

		if ( s.length > 80 ) {
			s = s.slice( 0, 80 ).trim();
		}

		return s;
	}

	/**
	 * Escape HTML.
	 *
	 * @param {*} s
	 * @returns {string}
	 */
	function wpbc_bfb__escape_html(s) {
		return String( s == null ? '' : s )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#039;' );
	}

	/**
	 * Get config text.
	 *
	 * @param {string} key
	 * @param {string} fallback
	 * @returns {string}
	 */
	function wpbc_bfb__get_cfg_text(key, fallback) {
		try {
			const cfg = w.WPBC_BFB_Ajax || {};
			const val = ( cfg && cfg[ key ] ) ? String( cfg[ key ] ) : '';
			return val ? val : String( fallback || '' );
		} catch ( _e ) {
			return String( fallback || '' );
		}
	}


	/**
	 * Toggle busy state for template delete button.
	 *
	 * @param {HTMLElement|null} delete_btn
	 * @param {boolean} is_busy
	 * @returns {void}
	 */
	function wpbc_bfb__set_tpl_delete_busy(delete_btn, is_busy) {
		if ( ! delete_btn ) {
			return;
		}

		if ( is_busy ) {
			delete_btn.setAttribute( 'aria-disabled', 'true' );
			delete_btn.style.pointerEvents = 'none';
			delete_btn.style.opacity = '0.5';
		} else {
			delete_btn.setAttribute( 'aria-disabled', 'false' );
			delete_btn.style.pointerEvents = '';
			delete_btn.style.opacity = '';
		}
	}

	UI.Template_Picker.create = function (args) {

		args = args || {};

		const api = {};

		api.modal_el               = args.modal_el || null;
		api.search_input_id        = args.search_input_id || '';
		api.blank_template_slug    = args.blank_template_slug || '__blank__';
		api.allow_delete           = !! args.allow_delete;
		api.allow_presets          = !! args.allow_presets;
		api.allow_same_click_blank = !! args.allow_same_click_blank;
		api.empty_text             = String( args.empty_text || 'No templates found.' );
		api.blank_desc             = String( args.blank_desc || 'Start with an empty layout.' );
		api.list_helper_missing_text = String( args.list_helper_missing_text || 'WPBC BFB: list forms helper missing.' );
		api.load_failed_text       = String( args.load_failed_text || 'Failed to load templates list.' );
		api.on_selection_change    = ( typeof args.on_selection_change === 'function' ) ? args.on_selection_change : function () {};
		api.on_delete_click        = ( typeof args.on_delete_click === 'function' ) ? args.on_delete_click : null;
		api.on_set_error           = ( typeof args.on_set_error === 'function' ) ? args.on_set_error : function () {};

		api.get_search_input = function () {
			return api.search_input_id ? d.getElementById( api.search_input_id ) : null;
		};

		api.get_list_root = function () {
			return api.modal_el ? api.modal_el.querySelector( '[data-wpbc-bfb-tpl-list="1"]' ) : null;
		};

		api.get_pager_root = function () {
			return api.modal_el ? api.modal_el.querySelector( '[data-wpbc-bfb-tpl-pager="1"]' ) : null;
		};

		api.get_selected_template_slug = function () {
			if ( ! api.modal_el ) {
				return api.blank_template_slug;
			}
			const v = String( api.modal_el.__wpbc_bfb_selected_template_slug || '' );
			return v ? v : api.blank_template_slug;
		};

		api.set_selected_template_slug = function (slug) {
			if ( ! api.modal_el ) {
				return;
			}
			slug = String( slug || '' ).trim();
			api.modal_el.__wpbc_bfb_selected_template_slug = slug ? slug : api.blank_template_slug;
		};

		api.count_real_templates = function (forms) {
			let count = 0;

			for ( let i = 0; i < ( forms || [] ).length; i++ ) {
				const item = forms[ i ] || {};
				const slug = String( item.form_slug || '' );

				if ( slug && slug !== api.blank_template_slug ) {
					count++;
				}
			}

			return count;
		};

		/**
		 * Delete template by delete button element and refresh current picker list.
		 *
		 * @param {HTMLElement} delete_btn
		 * @param {Function} done Optional callback function(ok:boolean, resp:Object|null)
		 * @returns {void}
		 */
		api.delete_template = function (delete_btn, done) {

			if ( ! delete_btn ) {
				if ( typeof done === 'function' ) {
					done( false, null );
				}
				return;
			}

			if ( delete_btn.getAttribute( 'aria-disabled' ) === 'true' ) {
				return;
			}

			const template_slug  = String( delete_btn.getAttribute( 'data-template-slug' ) || '' ).trim();
			const template_title = String( delete_btn.getAttribute( 'data-template-title' ) || template_slug ).trim();

			if ( ! template_slug || template_slug === api.blank_template_slug ) {
				if ( typeof done === 'function' ) {
					done( false, null );
				}
				return;
			}

			if ( typeof w.wpbc_bfb__ajax_delete_template_by_slug !== 'function' ) {
				const missing_msg = wpbc_bfb__get_cfg_text(
					'template_delete_missing_helper',
					'WPBC BFB: template delete helper is not available.'
				);

				api.on_set_error( missing_msg );

				if ( typeof w.wpbc_admin_show_message === 'function' ) {
					w.wpbc_admin_show_message( missing_msg, 'error', 10000 );
				}

				if ( typeof done === 'function' ) {
					done( false, null );
				}
				return;
			}

			const confirm_text = wpbc_bfb__get_cfg_text(
				'template_delete_confirm',
				'Delete template "%s"? This action cannot be undone.'
			).replace( '%s', template_title || template_slug );

			if ( ! w.confirm( confirm_text ) ) {
				return;
			}

			api.on_set_error( '' );
			wpbc_bfb__set_tpl_delete_busy( delete_btn, true );

			w.wpbc_bfb__ajax_delete_template_by_slug( template_slug, function (ok, resp) {

				wpbc_bfb__set_tpl_delete_busy( delete_btn, false );

				if ( ! ok || ! resp || ! resp.success ) {

					let error_message = '';

					try {
						error_message = ( resp && resp.data && resp.data.message ) ? String( resp.data.message ) : '';
					} catch ( _e0 ) {
						error_message = '';
					}

					if ( ! error_message ) {
						error_message = wpbc_bfb__get_cfg_text(
							'template_delete_failed',
							'Failed to delete template.'
						);
					}

					api.on_set_error( error_message );

					if ( typeof w.wpbc_admin_show_message === 'function' ) {
						w.wpbc_admin_show_message( error_message, 'error', 10000 );
					}

					if ( typeof done === 'function' ) {
						done( false, resp );
					}
					return;
				}

				if ( api.get_selected_template_slug() === template_slug ) {
					api.set_selected_template_slug( api.blank_template_slug );
				}

				const current_page   = parseInt( ( api.modal_el && api.modal_el.__wpbc_bfb_tpl_page ) || 1, 10 ) || 1;
				const current_search = String( ( api.modal_el && api.modal_el.__wpbc_bfb_tpl_search ) || '' );

				const finish_success = function () {
					api.on_selection_change( api.get_selected_template_slug(), api );

					if ( typeof w.wpbc_admin_show_message === 'function' ) {
						const success_message = ( resp && resp.data && resp.data.message )
							? String( resp.data.message )
							: wpbc_bfb__get_cfg_text( 'template_delete_success', 'Template deleted.' );

						w.wpbc_admin_show_message( success_message, 'success', 4000, false );
					}

					if ( typeof done === 'function' ) {
						done( true, resp );
					}
				};

				api.load_templates( current_page, current_search, function (load_ok) {

					if (
						load_ok &&
						current_page > 1 &&
						api.count_real_templates( ( api.modal_el && api.modal_el.__wpbc_bfb_templates_cache ) || [] ) < 1
					) {
						api.load_templates( current_page - 1, current_search, function () {
							finish_success();
						} );
						return;
					}

					finish_success();
				} );
			} );
		};


		api.sync_template_search_presets = function (current_search) {
			if ( ! api.modal_el || ! api.allow_presets ) {
				return;
			}

			const root = api.modal_el.querySelector( '[data-wpbc-bfb-tpl-search-presets="1"]' );
			if ( ! root ) {
				return;
			}

			current_search = wpbc_bfb__normalize_template_search( current_search );

			root.querySelectorAll( '[data-wpbc-bfb-tpl-search-key]' ).forEach( function (btn) {
				const preset_search = wpbc_bfb__normalize_template_search(
					btn.getAttribute( 'data-wpbc-bfb-tpl-search-key' ) || ''
				);

				const is_active = ( preset_search === current_search );

				btn.setAttribute( 'aria-pressed', is_active ? 'true' : 'false' );
				btn.classList.toggle( 'is-active', is_active );
			} );
		};

		api.set_loading = function (is_loading) {
			const root = api.get_list_root();
			if ( ! root ) {
				return;
			}

			if ( is_loading ) {
				let spin = '';

				try {
					const src = d.querySelector( '.wpbc_bfb_popup_modal__forms_loading_spin_container' );
					if ( src ) {
						spin = src.outerHTML;
					}
				} catch ( _e ) {}

				root.innerHTML = spin || '<div style="padding:10px;color:#656565;">' + wpbc_bfb__escape_html( wpbc_bfb__i18n( 'text_loading', 'Loading...' ) ) + '</div>';
			}
		};

		api.set_pager = function (page, has_more) {
			const pager = api.get_pager_root();
			if ( ! pager ) {
				return;
			}

			const prev = pager.querySelector( '[data-wpbc-bfb-tpl-page-prev="1"]' );
			const next = pager.querySelector( '[data-wpbc-bfb-tpl-page-next="1"]' );
			const lab  = pager.querySelector( '[data-wpbc-bfb-tpl-page-label="1"]' );

			page = parseInt( page || 1, 10 );
			if ( ! page || page < 1 ) {
				page = 1;
			}

			if ( lab ) {
				lab.textContent = wpbc_bfb__escape_html( wpbc_bfb__i18n( 'text_page', 'Page' ) ) + ' ' + page;
			}

			function set_btn(btn, enabled) {
				if ( ! btn ) {
					return;
				}
				if ( enabled ) {
					btn.classList.remove( 'disabled' );
					btn.setAttribute( 'aria-disabled', 'false' );
				} else {
					btn.classList.add( 'disabled' );
					btn.setAttribute( 'aria-disabled', 'true' );
				}
			}

			set_btn( prev, page > 1 );
			set_btn( next, !! has_more );
		};

		api.refresh_selection_highlight = function () {
			const root = api.get_list_root();
			if ( ! root ) {
				return;
			}

			const sel = api.get_selected_template_slug();
			let found = null;

			root.querySelectorAll( '.wpbc_bfb__load_form_item' ).forEach( function (el) {
				el.classList.remove( 'wpbc_bfb__load_form_item_selected' );
			} );

			try {
				found = root.querySelector( '[data-template-slug="' + CSS.escape( sel ) + '"]' );
			} catch ( _e ) {
				found = null;
			}

			if ( found ) {
				found.classList.add( 'wpbc_bfb__load_form_item_selected' );
			}
		};

		api.render_list = function (forms) {
			const root = api.get_list_root();
			if ( ! root ) {
				return;
			}

			let html = '';

			html += ''
				+ '<div class="wpbc_bfb__load_form_item" data-wpbc-bfb-tpl-item="1" data-template-slug="' + wpbc_bfb__escape_html( api.blank_template_slug ) + '">'
				+ '  <div class="wpbc_bfb__load_form_item_thumb">'
				+ '    <div class="wpbc_bfb__load_form_item_thumb_blank_img">' + wpbc_bfb__escape_html( wpbc_bfb__i18n( 'text_blank_thumb', 'Blank' ) ) + '</div>'
				+ '  </div>'
				+ '  <div class="wpbc_bfb__load_form_item_text">'
				+ '    <div class="form_item_text_title">' + wpbc_bfb__escape_html( wpbc_bfb__i18n( 'text_blank_form_title', 'Blank Form' ) ) + '</div>'
				+ '    <div class="form_item_text_slug">' + wpbc_bfb__escape_html( api.blank_template_slug ) + '</div>'
				+ '    <div class="form_item_text_desc">' + wpbc_bfb__escape_html( api.blank_desc ) + '</div>'
				+ '  </div>'
				+ '</div>';

			let any_templates = false;
			const delete_label = wpbc_bfb__get_cfg_text( 'template_delete_label', 'Delete template' );

			for ( let i = 0; i < ( forms || [] ).length; i++ ) {
				const item = forms[ i ] || {};
				const slug = String( item.form_slug || '' );

				if ( ! slug || slug === api.blank_template_slug ) {
					continue;
				}

				any_templates = true;

				const title = String( item.title || slug || '' );
				const desc  = String( item.description || '' );
				const pic   = String( item.picture_url || item.image_url || '' );

				const thumb = pic
					? '<img src="' + wpbc_bfb__escape_html( pic ) + '" alt="" />'
					: '<div class="wpbc_bfb__load_form_item_thumb_blank_img">' + wpbc_bfb__escape_html( wpbc_bfb__i18n( 'text_no_image_thumb', 'No image' ) ) + '</div>';

				let delete_btn = '';

				if ( api.allow_delete && parseInt( item.can_delete || 0, 10 ) === 1 ) {
					delete_btn = ''
						+ '<a href="#"'
						+ ' class="button-link-delete"'
						+ ' data-wpbc-bfb-tpl-delete="1"'
						+ ' data-template-slug="' + wpbc_bfb__escape_html( slug ) + '"'
						+ ' data-template-title="' + wpbc_bfb__escape_html( title ) + '"'
						+ ' aria-label="' + wpbc_bfb__escape_html( delete_label ) + '"'
						+ ' title="' + wpbc_bfb__escape_html( delete_label ) + '"'
						+ ' style="margin-left:auto;color:#b32d2e;text-decoration:none;line-height:1;">'
						+ '   <span class="dashicons dashicons-trash" aria-hidden="true"></span>'
						+ '</a>';
				}

				const meta = '<div class="form_item_text_slug" title="' + wpbc_bfb__escape_html( slug ) + '">' + wpbc_bfb__escape_html( slug ) + '</div>';

				const line2 = desc
					? '<div class="form_item_text_desc" title="' + wpbc_bfb__escape_html( desc ) + '">'
							+ '<span class="form_item_text_desc__text">'
								+ wpbc_bfb__escape_html( desc )
							+ '</span>'
							+ delete_btn
						+ '</div>'
					: ( delete_btn ? '<div class="form_item_text_desc">' + delete_btn + '</div>' : '' );

				html += ''
					+ '<div class="wpbc_bfb__load_form_item" data-wpbc-bfb-tpl-item="1" data-template-slug="' + wpbc_bfb__escape_html( slug ) + '">'
					+ '  <div class="wpbc_bfb__load_form_item_thumb">' + thumb + '</div>'
					+ '  <div class="wpbc_bfb__load_form_item_text">'
					+ '    <div style="display:flex;align-items:flex-start;gap:8px;">'
					+ '      <div class="form_item_text_title" style="flex:1 1 auto;">' + wpbc_bfb__escape_html( title ) + '</div>'
					+ '    </div>'
					+      meta
					+      line2
					+ '  </div>'
					+ '</div>';
			}

			if ( ! any_templates ) {
				html += '<div style="padding:10px;color:#666;">' + wpbc_bfb__escape_html( api.empty_text ) + '</div>';
			}

			root.innerHTML = html;
			api.refresh_selection_highlight();
		};

		api.load_templates = function (page, search, done) {
			if ( typeof w.wpbc_bfb__ajax_list_user_forms !== 'function' ) {
				api.on_set_error( api.list_helper_missing_text );
				api.set_loading( false );
				api.set_pager( 1, false );
				api.render_list( [] );

				if ( typeof done === 'function' ) {
					done( false, null );
				}
				return;
			}

			page   = parseInt( page || 1, 10 );
			search = wpbc_bfb__normalize_template_search( search );

			if ( ! page || page < 1 ) {
				page = 1;
			}

			api.on_set_error( '' );
			api.set_loading( true );

			w.wpbc_bfb__ajax_list_user_forms(
				null,
				{
					include_global : 1,
					status         : 'template',
					page           : page,
					limit          : 20,
					search         : search
				},
				function (ok, data) {

					if ( ! ok || ! data || ! data.forms ) {
						api.set_loading( false );
						api.on_set_error( api.load_failed_text );
						api.set_pager( 1, false );
						api.render_list( [] );

						if ( typeof done === 'function' ) {
							done( false, null );
						}
						return;
					}

					api.modal_el.__wpbc_bfb_templates_cache = data.forms || [];
					api.modal_el.__wpbc_bfb_tpl_page        = data.page || page;
					api.modal_el.__wpbc_bfb_tpl_has_more    = !! data.has_more;
					api.modal_el.__wpbc_bfb_tpl_search      = search;

					api.sync_template_search_presets( search );
					api.render_list( api.modal_el.__wpbc_bfb_templates_cache );
					api.set_pager( api.modal_el.__wpbc_bfb_tpl_page, api.modal_el.__wpbc_bfb_tpl_has_more );

					if ( typeof done === 'function' ) {
						done( true, data );
					}
				}
			);
		};

		api.apply_search_value = function (search_value, done) {
			const search_el = api.get_search_input();
			const normalized_search = wpbc_bfb__normalize_template_search( search_value );

			if ( search_el ) {
				search_el.value = normalized_search;
			}

			if ( api.modal_el ) {
				api.modal_el.__wpbc_bfb_tpl_search = normalized_search;
			}

			api.sync_template_search_presets( normalized_search );
			api.load_templates( 1, normalized_search, done );
		};

		api.reset_state = function () {
			const search_el = api.get_search_input();

			if ( search_el ) {
				search_el.value = '';
			}

			if ( api.modal_el ) {
				api.modal_el.__wpbc_bfb_selected_template_slug = api.blank_template_slug;
				api.modal_el.__wpbc_bfb_templates_cache = [];
				api.modal_el.__wpbc_bfb_tpl_page        = 1;
				api.modal_el.__wpbc_bfb_tpl_has_more    = false;
				api.modal_el.__wpbc_bfb_tpl_search      = '';

				if ( api.modal_el.__wpbc_bfb_tpl_search_timer ) {
					try {
						clearTimeout( api.modal_el.__wpbc_bfb_tpl_search_timer );
					} catch ( _e ) {}
				}
				api.modal_el.__wpbc_bfb_tpl_search_timer = 0;
			}

			api.sync_template_search_presets( '' );
			api.on_set_error( '' );
		};

		api.bind_handlers = function () {
			if ( ! api.modal_el || api.modal_el.__wpbc_bfb_template_picker_handlers_bound ) {
				return;
			}
			api.modal_el.__wpbc_bfb_template_picker_handlers_bound = true;

			const search_el = api.get_search_input();

			api.modal_el.addEventListener( 'click', function (e) {
				if ( ! e || ! e.target || ! e.target.closest ) {
					return;
				}

				const delete_btn = e.target.closest( '[data-wpbc-bfb-tpl-delete="1"]' );
				if ( delete_btn ) {
					if ( ! api.allow_delete ) {
						return;
					}
					e.preventDefault();
					e.stopPropagation();
					if ( api.on_delete_click ) {
						api.on_delete_click( delete_btn, api );
					} else if ( typeof api.delete_template === 'function' ) {
						api.delete_template( delete_btn );
					}
					return;
				}

				const preset_btn = e.target.closest( '[data-wpbc-bfb-tpl-search-key]' );
				if ( preset_btn ) {
					e.preventDefault();
					e.stopPropagation();
					api.apply_search_value(
						preset_btn.getAttribute( 'data-wpbc-bfb-tpl-search-key' ) || '',
						function () {
							api.on_selection_change( api.get_selected_template_slug(), api );
						}
					);
					return;
				}

				const pager = e.target.closest( '[data-wpbc-bfb-tpl-pager="1"]' );
				if ( pager ) {
					const prev = e.target.closest( '[data-wpbc-bfb-tpl-page-prev="1"]' );
					const next = e.target.closest( '[data-wpbc-bfb-tpl-page-next="1"]' );

					if ( ! prev && ! next ) {
						return;
					}

					e.preventDefault();

					if (
						( prev && ( prev.classList.contains( 'disabled' ) || prev.getAttribute( 'aria-disabled' ) === 'true' ) ) ||
						( next && ( next.classList.contains( 'disabled' ) || next.getAttribute( 'aria-disabled' ) === 'true' ) )
					) {
						return;
					}

					const page   = parseInt( api.modal_el.__wpbc_bfb_tpl_page || 1, 10 ) || 1;
					const search = String( api.modal_el.__wpbc_bfb_tpl_search || '' );

					if ( prev ) {
						api.load_templates( Math.max( 1, page - 1 ), search, function () {} );
					}
					if ( next ) {
						api.load_templates( page + 1, search, function () {} );
					}
					return;
				}

				const item = e.target.closest( '[data-wpbc-bfb-tpl-item="1"]' );
				if ( ! item ) {
					return;
				}

				e.preventDefault();

				const clicked = item.getAttribute( 'data-template-slug' ) || '';
				const current = api.get_selected_template_slug();

				if ( clicked && clicked === current && clicked !== api.blank_template_slug && api.allow_same_click_blank ) {
					api.set_selected_template_slug( api.blank_template_slug );
				} else if ( clicked ) {
					api.set_selected_template_slug( clicked );
				} else {
					api.set_selected_template_slug( api.blank_template_slug );
				}

				api.refresh_selection_highlight();
				api.on_selection_change( api.get_selected_template_slug(), api );
			}, true );

			if ( search_el ) {
				search_el.addEventListener( 'input', function () {
					const v = String( search_el.value || '' );

					if ( api.modal_el.__wpbc_bfb_tpl_search_timer ) {
						clearTimeout( api.modal_el.__wpbc_bfb_tpl_search_timer );
					}

					api.modal_el.__wpbc_bfb_tpl_search_timer = setTimeout( function () {
						api.apply_search_value( v, function () {
							api.on_selection_change( api.get_selected_template_slug(), api );
						} );
					}, 300 );
				}, true );
			}
		};

		return api;
	};

	w.wpbc_bfb__get_template_search_or_sep     = wpbc_bfb__get_template_search_or_sep;
	w.wpbc_bfb__get_template_search_or_sep_url = wpbc_bfb__get_template_search_or_sep_url;
	w.wpbc_bfb__escape_regex                   = wpbc_bfb__escape_regex;
	w.wpbc_bfb__normalize_template_search      = wpbc_bfb__normalize_template_search;
	w.wpbc_bfb__i18n                           = wpbc_bfb__i18n;

}( window, document ));


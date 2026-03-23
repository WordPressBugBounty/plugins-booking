// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/preview/_out/bfb-preview.js
// == BFB Preview Client — sends current structure via AJAX and loads preview URL into iframe
// ---------------------------------------------------------------------------------------------------------------------
(function (w, d) {
	'use strict';

	/**
	 * Simple logger alias (optional).
	 *
	 * @type {{log:Function, error:Function}}
	 */
	var dev = (w._wpbc && w._wpbc.dev) ? w._wpbc.dev : {
		log: function () {},
		error: function () {}
	};

	/**
	 * Preview client class.
	 * Binds to a preview panel root that contains button + iframe.
	 */
	class wpbc_bfb_preview_client {

		/**
		 * @param {HTMLElement} root_el Root element of the preview panel.
		 */
		constructor(root_el) {
			this.root_el = root_el;
			this.iframe  = root_el.querySelector( '[data-wpbc-bfb-preview-iframe="1"]' );
			this.loader  = root_el.querySelector( '[data-wpbc-bfb-preview-loader="1"]' ); // NEW
			this.button  = null; // No local "Update Preview" button in panel anymore.

			this.nonce   = root_el.getAttribute( 'data-preview-nonce' ) || '';
			this.is_busy = false;

			if ( !this.iframe ) {
				dev.error( 'wpbc_bfb_preview_client', 'Missing iframe element' );
				return;
			}

			this.bind_events();
		}


		/**
		 * Show/hide the overlay loader over the iframe.
		 *
		 * @param {boolean} is_visible
		 */
		set_loader_visible(is_visible) {
			if ( !this.loader ) {
				return;
			}
			if ( is_visible ) {
				this.loader.classList.add( 'is-visible' );
			} else {
				this.loader.classList.remove( 'is-visible' );
			}
		}

		/**
		 * Bind UI events (panel-local button, if present).
		 */
		bind_events() {
			var self = this;

			if ( ! this.button ) {
				return;
			}

			this.button.addEventListener( 'click', function () {
				self.update_preview();
			} );
		}

		/**
		 * Get current BFB structure from global builder.
		 *
		 * @returns {Object|null}
		 */
		get_current_structure() {
			if ( ! w.wpbc_bfb || typeof w.wpbc_bfb.get_structure !== 'function' ) {
				dev.error( 'wpbc_bfb_preview_client', 'wpbc_bfb.get_structure() is not available' );
				return null;
			}

			try {
				return w.wpbc_bfb.get_structure();
			} catch (e) {
				dev.error( 'wpbc_bfb_preview_client.get_current_structure', e );
				return null;
			}
		}

		/**
		 * Parse combined length value like "100%", "320px", "12.5rem".
		 *
		 * @param {string} value
		 * @return {{num:string, unit:string}}
		 */
		parse_length_value(value) {
			var raw = String(value == null ? '' : value).trim();
			var m = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*([a-z%]*)\s*$/i);
			if (!m) {
				return { num: raw, unit: '' };
			}
			return { num: (m[1] || ''), unit: (m[2] || '') };
		}

		/**
		 * Build current form settings payload (same structure as real Save):
		 * {
		 *   options: { ...source-of-truth... },
		 *   css_vars: { ...compiled... }
		 * }
		 *
		 * @param {string} form_name
		 * @returns {{options:Object, css_vars:Object}}
		 */
		get_current_form_settings(form_name) {

			var form_settings = {
				options : {},
				css_vars: {}
			};

			// --- same event contract as ajax/_out/bfb-ajax.js ----------------------------------------------
			wpbc_bfb__dispatch_event_safe( 'wpbc:bfb:form_settings:collect', {
				settings : form_settings,
				form_name: form_name || 'standard'
			} );

			// Strict: require correct shape.
			if ( !form_settings || typeof form_settings !== 'object' ) {
				form_settings = { options: {}, css_vars: {} };
			}
			if ( !form_settings.options || typeof form_settings.options !== 'object' ) {
				form_settings.options = {};
			}
			if ( !form_settings.css_vars || typeof form_settings.css_vars !== 'object' ) {
				form_settings.css_vars = {};
			}

			return form_settings;
		}


		/**
		 * Send snapshot to server and update iframe src with returned preview URL.
		 *
		 * @param {{source_button?:HTMLElement}} [opts]
		 */
		update_preview( opts ) {
			if ( this.is_busy ) {
				return;
			}

			var structure = this.get_current_structure();
			if ( ! structure ) {
				return;
			}

			this.set_loader_visible( true );

			var options    = opts || {};
			var source_btn = options.source_button || null;

			var $source_btn = null;
			if ( source_btn && w.jQuery && typeof w.wpbc_bfb__button_busy_start === 'function' ) {
				$source_btn = w.jQuery( source_btn );
				if ( $source_btn && $source_btn.length ) {
					w.wpbc_bfb__button_busy_start( $source_btn );
				}
			}

			this.is_busy = true;
			this.set_button_busy( true ); // local "Update Preview" button in the panel

			var payload = new w.FormData();
			var cfg     = w.WPBC_BFB_Ajax || {};

			// Build settings payload (same as real saving).
			var form_settings = this.get_current_form_settings( cfg.form_name || 'standard' );

			payload.append( 'action', 'WPBC_AJX_BFB_SAVE_FORM_CONFIG' );
			payload.append( 'nonce', ( cfg.nonce_save || this.nonce || '' ) );

			// IMPORTANT:
			// - form_name is the logical form key (usually 'standard' or selected form)
			payload.append( 'form_name', ( cfg.form_name || 'standard' ) );
			payload.append( 'status', 'preview' );
			payload.append( 'return_preview_url', '1' );

			payload.append( 'engine', ( cfg.engine || 'bfb' ) );
			payload.append( 'engine_version', ( cfg.engine_version || '1.0' ) );

			payload.append( 'structure', JSON.stringify( structure ) );

			// Send real settings (options + compiled css_vars).
			payload.append( 'settings', JSON.stringify( form_settings ) );

			// ----------------------------------------------------------------------------
			// Choose where advanced_form + content_form are taken from (auto|builder|advanced)
			// ----------------------------------------------------------------------------
			var preview_source = wpbc_bfb_preview__get_source( cfg, source_btn );
			payload.append( 'preview_source', preview_source );

			var adv = null;

			// 1) Try Advanced Mode text (if selected / auto+dirty)
			if ( preview_source === 'advanced' || preview_source === 'auto' ) {

				adv = wpbc_bfb_preview__read_advanced_mode_payload( d, w );

				var can_use_advanced =
						(preview_source === 'advanced') ||
						(preview_source === 'auto' && adv && adv.is_dirty);

				if ( can_use_advanced ) {

					// Forced "advanced" but empty -> fallback to builder export.
					if ( ! wpbc_bfb_preview__has_text( adv.advanced_form ) && ! wpbc_bfb_preview__has_text( adv.content_form ) ) {

						if ( typeof w.wpbc_admin_show_message === 'function' ) {
							w.wpbc_admin_show_message(
								'Advanced Mode is selected, but editors are empty. Using Builder export.',
								'warning',
								6000
							);
						}

					} else {

						if ( wpbc_bfb_preview__has_text( adv.advanced_form ) ) {
							payload.append( 'advanced_form', adv.advanced_form );
						}
						if ( wpbc_bfb_preview__has_text( adv.content_form ) ) {
							payload.append( 'content_form', adv.content_form );
						}

					}
				}
			}

			// 2) If not taken from Advanced Mode -> export from Builder structure (current behavior)
			var already_has_adv =
					payload.has && (payload.has( 'advanced_form' ) || payload.has( 'content_form' )); // some browsers
																									  // support
																									  // FormData.has

			// Fallback for old browsers (no FormData.has)
			if ( typeof payload.has !== 'function' ) {
				already_has_adv = false; // just try exporter if needed
			}

			if ( ! already_has_adv ) {

				if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.export_all === 'function' ) {
					try {

						var width_combined = form_settings.options.booking_form_layout_width || '';
						var parsed_width   = this.parse_length_value( width_combined );
						var width_unit     = parsed_width.unit ? parsed_width.unit : '%';

						var export_options = {
							gapPercent      : 3,
							form_slug       : (cfg.form_name || 'standard'),
							form_width_value: parsed_width.num,
							form_width_unit : width_unit
						};

						var export_result = w.WPBC_BFB_Exporter.export_all( structure || [], export_options );

						if ( export_result ) {
							if ( export_result.advanced_form ) {
								payload.append( 'advanced_form', export_result.advanced_form );
							}
							if ( export_result.fields_data ) {
								payload.append( 'content_form', export_result.fields_data );
							}
						}

					} catch ( e ) {
						console.error( 'WPBC BFB: export_all error', e );
					}
				}
			}


			// Use shared helper if available; fallback to ajaxurl.
			var ajax_url = '';
			if ( typeof w.wpbc_bfb__get_ajax_url === 'function' ) {
				ajax_url = w.wpbc_bfb__get_ajax_url();
			} else if ( typeof w.ajaxurl !== 'undefined' && w.ajaxurl ) {
				ajax_url = w.ajaxurl;
			}

			var self = this;

			function end_busy_now() {
				self._end_busy( $source_btn );
			}

			if ( ! ajax_url ) {
				dev.error( 'wpbc_bfb_preview_client', 'ajax URL is not defined' );
				end_busy_now();
				return;
			}

			w.fetch( ajax_url, {
				method: 'POST',
				body:   payload
			} )
			.then( function (response) {
				return response.json();
			} )
			.then( function (data) {
				if ( ! data || ! data.success || ! data.data || ! data.data.preview_url ) {
					dev.error( 'wpbc_bfb_preview_client', 'Preview AJAX error', data );
					end_busy_now();
					return;
				}

				if ( ! self.iframe ) {
					dev.error( 'wpbc_bfb_preview_client', 'Missing iframe element' );
					end_busy_now();
					return;
				}

				// Wait until iframe has really loaded the preview URL.
				var on_load = function () {
					self.iframe.removeEventListener( 'load', on_load );
					end_busy_now();
				};

				self.iframe.addEventListener( 'load', on_load );
				self.iframe.setAttribute( 'src', data.data.preview_url );
			} )
			.catch( function (err) {
				dev.error( 'wpbc_bfb_preview_client', 'Preview AJAX failed', err );
				end_busy_now();
			} );
		}

		/**
		 * Internal helper: stop busy state on panel button + optional top toolbar button.
		 *
		 * @param {jQuery|null} $source_btn
		 * @private
		 */
		_end_busy($source_btn) {
			this.is_busy = false;
			this.set_button_busy( false );
			this.set_loader_visible( false ); // NEW

			if ( $source_btn && typeof w.wpbc_bfb__button_busy_end === 'function' ) {
				w.wpbc_bfb__button_busy_end( $source_btn );
			}
		}

		/**
		 * Force-reset any busy states related to preview.
		 * This is called when switching back to Builder mode (soft-cancel UX).
		 */
		reset_busy_state() {
			this.is_busy = false;
			this.set_button_busy( false ); // panel button, if any
			this.set_loader_visible( false ); // NEW

			if ( w.jQuery && typeof w.wpbc_bfb__button_busy_end === 'function' ) {
				// Top toolbar buttons that may show "Loading preview..."
				var $btns = w.jQuery(
					'[data-wpbc-bfb-top-preview-btn="1"],' +
					'[data-wpbc-bfb-top-refresh-btn="1"]'
				);

				$btns.each( function () {
					var $b = w.jQuery( this );
					if ( $b.hasClass( 'wpbc-is-busy' ) ) {
						w.wpbc_bfb__button_busy_end( $b );
					}
				} );
			}
		}

		/**
		 * Simple busy indicator for the panel "Update Preview" button.
		 * Reuses global WPBC busy helpers if available, so the spinner matches Save/Load buttons.
		 *
		 * @param {boolean} is_busy
		 */
		set_button_busy( is_busy ) {
			if ( ! this.button ) {
				return;
			}

			// If jQuery + global helpers exist, use same spinner as other toolbar buttons.
			if ( w.jQuery && typeof w.wpbc_bfb__button_busy_start === 'function' && typeof w.wpbc_bfb__button_busy_end === 'function' ) {
				var $btn = w.jQuery( this.button );

				if ( is_busy ) {
					w.wpbc_bfb__button_busy_start( $btn );
				} else {
					w.wpbc_bfb__button_busy_end( $btn );
				}

				return;
			}

			// Fallback: simple disabled state without spinner.
			if ( is_busy ) {
				this.button.setAttribute( 'disabled', 'disabled' );
				this.button.classList.add( 'wpbc_bfb__preview_btn_busy' );
			} else {
				this.button.removeAttribute( 'disabled' );
				this.button.classList.remove( 'wpbc_bfb__preview_btn_busy' );
			}
		}

		/**
		 * Set current view mode: "builder" or "preview".
		 * Applies/removes CSS class on <body>.
		 *
		 * @param {('builder'|'preview')} mode
		 */
		set_mode( mode ) {
			var body = d.body;
			if ( ! body ) {
				return;
			}

			if ( mode === 'preview' ) {
				body.classList.add( 'wpbc_bfb__mode_preview' );
			} else {
				body.classList.remove( 'wpbc_bfb__mode_preview' );
			}
		}

	}

	// -- Helpers ------------------------------------------------------------------------------------------------------
	/**
	 * Is Preview mode currently active?
	 * We prefer body class (set by client.set_mode), fallback to active tab id.
	 *
	 * @return {boolean}
	 */
	function wpbc_bfb_preview__is_preview_mode_active() {
		var body = d.body;
		if ( body && body.classList && body.classList.contains( 'wpbc_bfb__mode_preview' ) ) {
			return true;
		}
		return (wpbc_bfb_preview__get_active_top_tab_id() === 'preview_tab');
	}

	/**
	 * When a form is loaded via AJAX while Preview tab is active,
	 * refresh the iframe so it shows the newly loaded form.
	 *
	 * @param {wpbc_bfb_preview_client} client
	 */
	function wpbc_bfb_preview__bind_form_ajax_loaded_events(client) {

		if ( ! client ) {
			return;
		}

		// Prevent double binding if this script is injected twice.
		if ( w.__wpbc_bfb_preview__form_ajax_loaded_bound === '1' ) {
			return;
		}
		w.__wpbc_bfb_preview__form_ajax_loaded_bound = '1';

		var debounce_id = null;

		d.addEventListener(
			'wpbc:bfb:form:ajax_loaded',
			function (ev) {

				// Only do anything if Preview is currently active.
				if ( ! wpbc_bfb_preview__is_preview_mode_active() ) {
					return;
				}

				var det = (ev && ev.detail) ? ev.detail : {};
				var fn  = det.form_name ? String( det.form_name ) : '';

				// Best-effort: keep cfg.form_name in sync for payload building.
				if ( fn ) {
					w.WPBC_BFB_Ajax           = w.WPBC_BFB_Ajax || {};
					w.WPBC_BFB_Ajax.form_name = fn;
				}

				// Debounce multiple rapid loads (or secondary events).
				if ( debounce_id ) {
					clearTimeout( debounce_id );
				}

				debounce_id = setTimeout( function () {
					debounce_id = null;

					// Preview might have been left while waiting.
					if ( ! wpbc_bfb_preview__is_preview_mode_active() ) {
						return;
					}

					// If we are already sending preview, don't stack another request.
					if ( client.is_busy ) {
						// Try once more shortly (safe).
						setTimeout( function () {
							if ( wpbc_bfb_preview__is_preview_mode_active() && ! client.is_busy ) {
								client.update_preview( { source_button: null } );
							}
						}, 250 );
						return;
					}

					// Wait until builder API is present (form load can be async).
					var tries = 0;
					(function wait_for_builder() {

						if ( ! wpbc_bfb_preview__is_preview_mode_active() ) {
							return;
						}

						if ( w.wpbc_bfb && typeof w.wpbc_bfb.get_structure === 'function' ) {
							client.update_preview( { source_button: null } );
							return;
						}

						tries++;
						if ( tries < 15 ) {
							setTimeout( wait_for_builder, 200 );
						}
					})();
				}, 180 );

			},
			{ passive: true }
		);
	}

	function wpbc_bfb_preview__get_source(cfg, btn) {

		// priority: button attr -> global cfg -> default
		var v = '';
		try {
			if ( btn && btn.getAttribute ) {
				v = btn.getAttribute( 'data-wpbc-bfb-preview-source' ) || btn.getAttribute( 'data-wpbc-bfb-save-source' ) || '';
			}
		} catch ( e ) {}

		if ( ! v && cfg && (cfg.preview_source || cfg.save_source) ) {
			v = cfg.preview_source || cfg.save_source;
		}

		v = String( v || 'auto' ).toLowerCase();
		if ( [ 'builder', 'advanced', 'auto' ].indexOf( v ) === -1 ) {
			v = 'builder';
		}
		return v;
	}

	function wpbc_bfb_preview__has_text(v) {
		return !! (v && String( v ).trim());
	}

	function wpbc_bfb_preview__read_advanced_mode_payload(d, w) {

		// best: API (syncs CodeMirror -> textarea)
		if ( w.wpbc_bfb_advanced_editor_api && typeof w.wpbc_bfb_advanced_editor_api.get_values === 'function' ) {
			try {
				return w.wpbc_bfb_advanced_editor_api.get_values();
			} catch ( e ) {}
		}

		// fallback: read textareas directly
		var ta_form    = d.getElementById( 'wpbc_bfb__advanced_form_editor' );
		var ta_content = d.getElementById( 'wpbc_bfb__content_form_editor' );

		return {
			advanced_form: ta_form ? String( ta_form.value || '' ) : '',
			content_form : ta_content ? String( ta_content.value || '' ) : '',
			is_dirty     : false
		};
	}

	/**
	 * Is this element the Preview TAB link in top tabs nav?
	 *
	 * @param {HTMLElement|null} el
	 * @return {boolean}
	 */
	function wpbc_bfb_preview__is_preview_tab_link(el) {
		if ( !el || !el.getAttribute ) {
			return false;
		}
		return (
			el.getAttribute( 'data-wpbc-bfb-action' ) === 'panel' &&
			el.getAttribute( 'data-wpbc-bfb-tab' ) === 'preview_tab'
		);
	}

	/**
	 * Is this element the Builder TAB link in top tabs nav?
	 *
	 * @param {HTMLElement|null} el
	 * @return {boolean}
	 */
	function wpbc_bfb_preview__is_builder_tab_link(el) {
		if ( !el || !el.getAttribute ) {
			return false;
		}
		return (
			el.getAttribute( 'data-wpbc-bfb-action' ) === 'panel' &&
			el.getAttribute( 'data-wpbc-bfb-tab' ) === 'builder_tab'
		);
	}

	/**
	 * Activate a "panel" tab and show its panel section (scoped).
	 *
	 * Strategy:
	 * 1) Try to click the real top-tab link (best).
	 * 2) If link does not exist (e.g. Preview tab removed from nav), do a scoped manual switch:
	 *    - use nav's data-wpbc-bfb-panels-root + data-wpbc-bfb-panel-class
	 *    - hide/show ONLY those outer panels
	 *    - DO NOT touch inner panels
	 *
	 * @param {string} tab_id
	 * @return {boolean}
	 */
	function wpbc_bfb__activate_panel_tab(tab_id) {

		tab_id = String( tab_id || '' ).trim();
		if ( ! tab_id ) {
			return false;
		}

		// 1) Best: trigger existing top-tabs switching by clicking the tab link (if it exists).
		var tab_link = d.querySelector( '[data-wpbc-bfb-action="panel"][data-wpbc-bfb-tab="' + tab_id + '"]' );
		if ( tab_link && typeof tab_link.click === 'function' ) {
			try {
				tab_link.click();
				return true;
			} catch ( _e ) {}
		}

		// 2) Fallback: scoped manual toggle (outer panels only).
		var nav = d.getElementById( 'wpbc_bfb__top_horisontal_nav' );

		// Determine outer panels root.
		var panels_root          = d;
		var panels_root_selector = '';

		if ( nav ) {
			panels_root_selector = nav.getAttribute( 'data-wpbc-bfb-panels-root' ) || '';
			panels_root_selector = String( panels_root_selector || '' ).trim();
		}

		// Fallback if attribute missing: prefer #wpbc_bfb__top_panels if present.
		if ( ! panels_root_selector ) {
			panels_root_selector = '#wpbc_bfb__top_panels';
		}

		if ( panels_root_selector ) {
			try {
				var root_el = d.querySelector( panels_root_selector );
				if ( root_el ) {
					panels_root = root_el;
				}
			} catch ( _e2 ) {}
		}

		// Determine outer base class (IMPORTANT: must be the OUTER base, not wpbc_bfb__tab_section).
		var panel_base_class = 'wpbc_bfb__top_tab_section';
		if ( nav ) {
			var from_nav = nav.getAttribute( 'data-wpbc-bfb-panel-class' ) || '';
			from_nav     = String( from_nav || '' ).trim();
			if ( from_nav ) {
				panel_base_class = from_nav;
			}
		}

		// Update active tab on nav (source of truth).
		if ( nav ) {
			nav.setAttribute( 'data-active-tab', tab_id );
		}

		// Hide ONLY outer panels (scoped by base class).
		var selector_all = '.' + panel_base_class;
		var panel_nodes  = panels_root.querySelectorAll( selector_all );

		for ( var i = 0; i < panel_nodes.length; i++ ) {
			panel_nodes[i].style.display = 'none';
		}

		// Show requested outer panel.
		var selector_active = '.' + panel_base_class + '__' + tab_id;
		var active_panel    = panels_root.querySelector( selector_active );

		if ( ! active_panel ) {
			// Backward-compatible fallback (if someone forgot to add outer classes).
			active_panel = panels_root.querySelector( '.wpbc_bfb__tab_section__' + tab_id );
		}

		if ( active_panel ) {
			active_panel.style.display = '';
		}

		// Mark active item in outer nav if it exists (Preview can be missing).
		if ( nav ) {
			var items = nav.querySelectorAll( '.wpbc_ui_el__horis_nav_item' );
			for ( var j = 0; j < items.length; j++ ) {
				items[j].classList.remove( 'active' );
			}

			var active_item = nav.querySelector( '.wpbc_ui_el__horis_nav_item__' + tab_id );
			if ( active_item ) {
				active_item.classList.add( 'active' );
			}
		}

		// Emit same event as bfb-top-tabs.js so other modules stay in sync.
		try {
			d.dispatchEvent(
				new CustomEvent( 'wpbc:bfb:top-tab', {
					detail: {
						tab   : tab_id,
						nav_id: (nav && nav.id) ? String( nav.id ) : ''
					}
				} )
			);
		} catch ( _e3 ) {}

		return true;
	}


	/**
	 * Get currently active top tab id from the nav container.
	 *
	 * @return {string}
	 */
	function wpbc_bfb_preview__get_active_top_tab_id() {
		var nav = d.getElementById( 'wpbc_bfb__top_horisontal_nav' );
		if ( !nav ) {
			return '';
		}
		return nav.getAttribute( 'data-active-tab' ) || '';
	}

	/**
	 * Sync preview "mode" with currently active top tab.
	 *
	 * Rules:
	 * - preview_tab => enable preview mode (buttons make sense)
	 * - any other tab => disable preview mode + reset busy states
	 *
	 * IMPORTANT:
	 * - We do NOT change the active top tab here (no panel switching).
	 *   We only sync preview UI mode.
	 *
	 * @param {string} tab_id
	 * @param {wpbc_bfb_preview_client} client
	 */
	function wpbc_bfb_preview__sync_mode_to_tab(tab_id, client) {

		tab_id = String( tab_id || '' );

		if ( !client ) {
			return;
		}

		if ( 'preview_tab' === tab_id ) {
			client.set_mode( 'preview' );
			return;
		}

		// Leaving preview -> soft-cancel busy state and hide preview-specific toolbar.
		if ( typeof client.reset_busy_state === 'function' ) {
			client.reset_busy_state();
		}
		client.set_mode( 'builder' );
	}

	/**
	 * Bind to top-tab switch event emitted by bfb-top-tabs.js.
	 *
	 * @param {wpbc_bfb_preview_client} client
	 */
	function wpbc_bfb_preview__bind_top_tab_events(client) {

		// Sync immediately (in case event already fired before this script init).
		wpbc_bfb_preview__sync_mode_to_tab( wpbc_bfb_preview__get_active_top_tab_id(), client );

		// React to future tab changes.
		d.addEventListener( 'wpbc:bfb:top-tab', function (ev) {
			var det     = (ev && ev.detail) ? ev.detail : {};
			var tab_id  = det.tab ? String( det.tab ) : '';
			var nav_id  = det.nav_id ? String( det.nav_id ) : '';
			var prev_id = det.prev_tab ? String( det.prev_tab ) : '';

			// If user switched to preview_tab in the MAIN top nav,
			// remember what tab they came from.
			if ( nav_id === TOP_NAV_ID && tab_id === 'preview_tab' && prev_id && prev_id !== 'preview_tab' ) {
				return_tab_id = prev_id;
			}

			wpbc_bfb_preview__sync_mode_to_tab( tab_id, client );
		} );

	}


	// -- Bind | Init on Load ------------------------------------------------------------------------------------------
	var TOP_NAV_ID = 'wpbc_bfb__top_horisontal_nav';
	var return_tab_id = 'builder_tab';

	function remember_return_tab_from_dom() {
		var cur = wpbc_bfb_preview__get_active_top_tab_id();
		if (cur && cur !== 'preview_tab') {
			return_tab_id = cur;
		}
	}

	function get_return_tab_id() {
		var t = String(return_tab_id || '').trim();
		if (!t || t === 'preview_tab') t = 'builder_tab';
		return t;
	}

	/**
	 * Auto-init preview client on Builder page and wire top toolbar buttons.
	 */
	function wpbc_bfb_init_preview_client() {
		var root = d.querySelector( '[data-wpbc-bfb-preview-root="1"]' );

		if ( !root ) {
			return;
		}

		var client = new wpbc_bfb_preview_client( root );

		if ( !w.WPBC_BFB_Preview ) {
			w.WPBC_BFB_Preview = {
				client: client,

				show_preview: function (opts) {
					var opt = opts || {};
					var src = opt.source_button || null;

					// Remember where we were BEFORE switching to preview.
					remember_return_tab_from_dom();

					if ( ! wpbc_bfb_preview__is_preview_tab_link( src ) ) {
						wpbc_bfb__activate_panel_tab( 'preview_tab' );
					}

					// Enable preview mode UI (shows refresh/back buttons etc).
					client.set_mode( 'preview' );

					// IMPORTANT: Always regenerate when show_preview() is called (Preview tab click included).
					client.update_preview( { source_button: src } );
				},


				show_builder: function (opts) {
					var opt = opts || {};
					var src = opt.source_button || null;

					if ( client && typeof client.reset_busy_state === 'function' ) {
						client.reset_busy_state();
					}

					var back_to = get_return_tab_id();

					// If Back button itself is not a real tab link -> just activate remembered tab.
					// If activation fails (tab removed), fallback to builder_tab.
					if ( ! wpbc_bfb_preview__is_builder_tab_link( src ) ) {
						if ( ! wpbc_bfb__activate_panel_tab( back_to ) ) {
							wpbc_bfb__activate_panel_tab( 'builder_tab' );
						}
					}

					client.set_mode( 'builder' );
				},

				show_advanced_tab: function (opts) {
					var opt = opts || {};

					if ( client && typeof client.reset_busy_state === 'function' ) {
						client.reset_busy_state();
					}
					wpbc_bfb__activate_panel_tab( 'advanced_tab' );
					client.set_mode( 'builder' );
				}


			};
		}

		// Listen for top-tab changes and sync preview mode automatically.
		wpbc_bfb_preview__bind_top_tab_events( client );

		// When a form is loaded via AJAX, refresh preview (only if preview mode is active).
		wpbc_bfb_preview__bind_form_ajax_loaded_events( client );

		wpbc_bfb_bind_top_toolbar_buttons( client );
	}


	/**
	 * Bind top toolbar Builder / Preview / Refresh buttons.
	 * Supports multiple elements for each action (toolbar buttons, top tabs, etc.)
	 * via data-wpbc-bfb-top-*-btn="1".
	 */
	function wpbc_bfb_bind_top_toolbar_buttons(client) {

		var btn_preview_list = d.querySelectorAll( '[data-wpbc-bfb-top-preview-btn="1"]' );
		var btn_builder_list = d.querySelectorAll( '[data-wpbc-bfb-top-builder-btn="1"]' );
		var btn_refresh_list = d.querySelectorAll( '[data-wpbc-bfb-top-refresh-btn="1"]' );

		function for_each_node(list, cb) {
			if ( !list || !list.length ) {
				return;
			}
			Array.prototype.forEach.call( list, function (el) {
				if ( el && typeof cb === 'function' ) {
					cb( el );
				}
			} );
		}

		for_each_node( btn_preview_list, function (btn_preview) {

			// Prevent double binding if this script runs twice.
			if ( btn_preview.getAttribute( 'data-wpbc-bfb-bound' ) === '1' ) {
				return;
			}
			btn_preview.setAttribute( 'data-wpbc-bfb-bound', '1' );

			btn_preview.addEventListener( 'click', function (e) {
				e.preventDefault();

				if ( w.WPBC_BFB_Preview && typeof w.WPBC_BFB_Preview.show_preview === 'function' ) {
					w.WPBC_BFB_Preview.show_preview( {
						source_button: btn_preview
					} );
				}
			} );
		} );

		for_each_node( btn_refresh_list, function (btn_refresh) {

			if ( btn_refresh.getAttribute( 'data-wpbc-bfb-bound' ) === '1' ) {
				return;
			}
			btn_refresh.setAttribute( 'data-wpbc-bfb-bound', '1' );

			btn_refresh.addEventListener( 'click', function (e) {
				e.preventDefault();

				if ( w.WPBC_BFB_Preview && typeof w.WPBC_BFB_Preview.show_preview === 'function' ) {
					w.WPBC_BFB_Preview.show_preview( {
						update       : true,
						source_button: btn_refresh
					} );
				}
			} );
		} );

		for_each_node( btn_builder_list, function (btn_builder) {

			if ( btn_builder.getAttribute( 'data-wpbc-bfb-bound' ) === '1' ) {
				return;
			}
			btn_builder.setAttribute( 'data-wpbc-bfb-bound', '1' );

			btn_builder.addEventListener( 'click', function (e) {
				e.preventDefault();

				if ( w.WPBC_BFB_Preview && typeof w.WPBC_BFB_Preview.show_builder === 'function' ) {
					w.WPBC_BFB_Preview.show_builder( { source_button: btn_builder } );
				}
			} );
		} );
	}


	if ( d.readyState === 'complete' || d.readyState === 'interactive' ) {
		setTimeout( wpbc_bfb_init_preview_client, 0 );
	} else {
		d.addEventListener( 'DOMContentLoaded', wpbc_bfb_init_preview_client );
	}

})( window, document );

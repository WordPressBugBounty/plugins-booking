/**
 * WPBC BFB: Field Renderer for "checkbox" (WP-template–driven Reference, no fallback)
 * =========================================================================
 * - Uses wp.template('...') for preview
 * - Inspector UI is produced by wp.template('...')
 * - Extends Select_Base for shared options editor wiring
 *
 * Contracts:
 * - Registry:  WPBC_BFB_Field_Renderer_Registry.register('checkbox', Class)
 * - Class API: static get_defaults(), static render(el, data, ctx), static on_field_drop(data, el, ctx?) [optional]
 *
 * File:  ../includes/page-form-builder/field-packs/checkbox/_out/field-checkbox-wptpl.js
 *
 * @since    11.0.0
 * @modified 2025-09-13 11:40
 * @version  1.0.0
 */
(function (w) {
	'use strict';

	var Core        = w.WPBC_BFB_Core || {};
	var Registry    = Core.WPBC_BFB_Field_Renderer_Registry;
	var Select_Base = Core.WPBC_BFB_Select_Base;
	// Polyfill inline helpers on the base (static) so other packs can call them safely
	if ( !Select_Base.apply_inline_toggle_to_css ) {
		Select_Base.apply_inline_toggle_to_css = function () { /* no-op; Checkbox overrides */
		};
	}
	if ( !Select_Base.sync_inline_toggle_from_css ) {
		Select_Base.sync_inline_toggle_from_css = function () { /* no-op; Checkbox overrides */
		};
	}

	if ( ! Registry?.register || ! Select_Base ) {
		w._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Checkbox', 'Registry or Select_Base missing' );
		return;
	}

	class WPBC_BFB_Field_Checkbox extends Select_Base {

		static template_id            = 'wpbc-bfb-field-checkbox';
		static option_row_template_id = 'wpbc-bfb-inspector-checkbox-option-row';
		static kind                   = 'checkbox';

		static ui = Object.assign( {}, Select_Base.ui, {
			cssclass_input: '.inspector__input[data-inspector-key="cssclass"]',
			inline_toggle : '.inspector__checkbox.inspector__input[data-inspector-key="layout_inline"]'
		} );

		// ---- Inline layout helpers used by wire_once_checkbox ----
		static get_cssclass_input(panel) {
			return panel ? panel.querySelector( this.ui.cssclass_input ) : null;
		}

		static get_inline_toggle(panel) {
			return panel ? panel.querySelector( this.ui.inline_toggle ) : null;
		}

		static has_inline_class(s) {
			s = String( s || '' ).trim();
			return s ? (' ' + s.replace( /\s+/g, ' ' ) + ' ').indexOf( ' group_inline ' ) !== -1 : false;
		}

		static add_inline_class(s) {
			const t = String( s || '' ).trim().split( /\s+/ ).filter( Boolean );
			if ( !t.includes( 'group_inline' ) ) t.push( 'group_inline' );
			return t.join( ' ' ).trim();
		}

		static remove_inline_class(s) {
			const t = String( s || '' ).trim().split( /\s+/ ).filter( Boolean );
			return t.filter( x => x !== 'group_inline' ).join( ' ' ).trim();
		}

		static sync_inline_toggle_from_css(panel) {
			const inp = this.get_cssclass_input( panel ), tog = this.get_inline_toggle( panel );
			if ( !inp || !tog ) return;
			const has   = this.has_inline_class( inp.value );
			tog.checked = !!has;
			tog.setAttribute( 'aria-checked', has ? 'true' : 'false' );
		}

		static apply_inline_toggle_to_css(panel, on) {
			const inp = this.get_cssclass_input( panel ), tog = this.get_inline_toggle( panel );
			if ( !inp || !tog ) return;
			const prev = String( inp.value || '' );
			const next = on ? this.add_inline_class( prev ) : this.remove_inline_class( prev );
			if ( next !== prev ) {
				inp.value = next;
				try {
					inp.dispatchEvent( new Event( 'input', { bubbles: true } ) );
					inp.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				} catch ( _ ) {
				}
				try {
					const Core  = window.WPBC_BFB_Core || {};
					const field = panel.__selectbase_field
						|| document.querySelector( '.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected' );
					if ( field ) {
						field.dataset.cssclass = next;
						field.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', {
							bubbles: true, detail: { key: 'cssclass', value: next }
						} ) );
						Core.Structure?.update_field_prop?.( field, 'cssclass', next );
					}
				} catch ( _ ) {
				}
			}
			tog.setAttribute( 'aria-checked', on ? 'true' : 'false' );
		}

		/* --------------------------------------------------------------------------------------------------------- */

		static get_defaults() {
			return {
				type         : 'checkbox',
				label        : 'Checkbox',
				name         : '',
				html_id      : '',
				required     : false,
				cssclass     : '',
				help         : '',
				default_value: '',
				value_differs: true,
				multiple     : true,
				options      : [
					{ label: 'Option 1', value: 'Option 1', selected: false },
					{ label: 'Option 2', value: 'Option 2', selected: false },
					{ label: 'Option 3', value: 'Option 3', selected: false }
				],
				min_width    : '240px'
			};
		}

		/**
		 * Ensure "multiple" is set and persisted at the moment of drop.
		 * This prevents the first Inspector hydration from unchecking the hidden toggle.
		 */
		static on_field_drop(data, el, meta) {
			try { super.on_field_drop?.( data, el, meta ); } catch ( _ ) {}
			if ( meta?.context !== 'drop' ) { return; }

			// If not explicitly set, force it ON and persist to builder state.
			if ( ! Object.prototype.hasOwnProperty.call( data, 'multiple' ) ) {
				data.multiple = true;
			}
			try {
				// Mirror to the canvas element & model so future hydrations read TRUE.
				el.dataset.multiple = '1';
				el.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', {
					bubbles: true, detail: { key: 'multiple', value: true }
				} ) );
				WPBC_BFB_Core.Structure?.update_field_prop?.( el, 'multiple', true );
			} catch ( _ ) {}
		}

		/* =========================
		 * NEW: checkbox-only helpers
		 * ========================= */

		/** Ensure we act only for a Checkbox inspector panel. */
		static is_checkbox_panel( panel ) {
			const f = panel?.__selectbase_field
				|| document.querySelector( '.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected' );
			const t = (f?.dataset?.type || f?.getAttribute?.('data-type') || '').toLowerCase();
			return t === 'checkbox';
		}

		/** Convert any fallback radio icons → checkbox icons inside the options list. */
		static fix_option_toggle_icons( panel ) {
			if ( ! panel || ! this.is_checkbox_panel( panel ) ) { return; }
			const list = panel.querySelector( this.ui.list );
			if ( ! list ) { return; }
			const wrong = list.querySelectorAll( '.wpbc_ui__toggle_icon_radio' );
			for ( var i = 0; i < wrong.length; i++ ) {
				wrong[i].classList.remove( 'wpbc_ui__toggle_icon_radio' );
				wrong[i].classList.add( 'wpbc_ui__toggle_icon_checkbox' );
			}
		}

		/**
		 * Force “multiple mode” for the Select_Base logic (so defaults are NOT exclusive).
		 * We add a hidden, checked control that Select_Base checks via .js-opt-multiple[data-inspector-key="multiple"].
		 */
		static ensure_multiple_mode_marker( panel ) {
			if ( ! panel || ! this.is_checkbox_panel( panel ) ) { return; }

			let mult = panel.querySelector( '.js-opt-multiple[data-inspector-key="multiple"]' );
			if ( ! mult ) {
				mult = document.createElement( 'input' );
				mult.type = 'checkbox';
				mult.className = 'js-opt-multiple inspector__input';
				mult.setAttribute( 'data-inspector-key', 'multiple' );
				mult.checked = true;
				mult.hidden = true;
				// hide from layout & a11y tree, but keep it discoverable by querySelector
				mult.style.display = 'none';
				mult.setAttribute( 'aria-hidden', 'true' );
				mult.setAttribute( 'tabindex', '-1' );

				const group = panel.querySelector( '.wpbc_bfb__inspector__group[data-group="options"] .group__fields' )
					|| panel.querySelector( '.wpbc_bfb__inspector__body' ) || panel;

				group.appendChild( mult );
			} else if ( ! mult.checked ) {
				mult.checked = true;
			}
		}

		/**
		 * Observe the options list so any rows appended by the parent (fallback path)
		 * are auto-corrected to use checkbox icons.
		 */
		static observe_options_list( panel ) {
			if ( ! panel || panel.__wpbc_cb_obs ) { return; }
			const list = panel.querySelector( this.ui.list );
			if ( ! list ) { return; }

			const obs = new MutationObserver( (mutations) => {
				for ( var i = 0; i < mutations.length; i++ ) {
					if ( mutations[i].type !== 'childList' || !mutations[i].addedNodes?.length ) { continue; }
					// Any new rows → fix icons immediately.
					this.fix_option_toggle_icons( panel );
				}
			} );

			try {
				obs.observe( list, { childList: true } );
				panel.__wpbc_cb_obs = obs;
			} catch ( _ ) {}
		}

		static wire_once_checkbox() {
			if ( this.__checkbox_wired ) { return; }
			this.__checkbox_wired = true;

			const on_ready_or_render = ( ev ) => {
				const panel = ev?.detail?.panel;
				if ( ! panel ) { return; }

				// Let Select_Base wire itself.
				this.bootstrap_panel( panel );

				// 1) Multiple defaults ON for Checkbox (prevents exclusivity).
				this.ensure_multiple_mode_marker( panel );

				// 2) Correct any existing fallback icons (initial render).
				this.fix_option_toggle_icons( panel );

				// 3) Keep fixing icons for any newly added/duplicated rows.
				this.observe_options_list( panel );

				// Reflect cssclass → inline toggle (existing behavior).
				this.sync_inline_toggle_from_css( panel );
			};

			document.addEventListener( 'wpbc_bfb_inspector_ready',  on_ready_or_render );
			document.addEventListener( 'wpbc_bfb_inspector_render', on_ready_or_render );

			const root = document.getElementById( 'wpbc_bfb__inspector' );
			if ( ! root ) { return; }

			const get_panel = ( t ) => t?.closest?.( '.wpbc_bfb__inspector__body' ) || root.querySelector( '.wpbc_bfb__inspector__body' ) || null;

			// Keep multiple-mode and icons correct AFTER parent handles clicks (add/duplicate)
			// NOTE: parent stops propagation in its click handler; we schedule our fix in CAPTURE,
			// then run it async (setTimeout 0) so DOM is already updated.
			root.addEventListener( 'click', ( e ) => {
				const panel = get_panel( e.target );
				if ( ! panel || ! this.is_checkbox_panel( panel ) ) { return; }
				const is_add_btn     = e.target.closest?.( this.ui.add_btn );
				const is_menu_action = e.target.closest?.( this.ui.menu_action );
				if ( is_add_btn || is_menu_action ) {
					setTimeout( () => {
						this.ensure_multiple_mode_marker( panel );  // ensures non-exclusive
						this.fix_option_toggle_icons( panel );      // fixes icon class
					}, 0 );
				}
			}, true ); // CAPTURE phase

			// Inline layout toggle & manual cssclass edits (unchanged)
			root.addEventListener( 'change', ( e ) => {
				const panel = get_panel( e.target );
				if ( ! panel || ! this.is_checkbox_panel( panel ) ) { return; }
				if ( e.target.matches?.( this.ui.inline_toggle ) ) {
					e.target.setAttribute( 'aria-checked', e.target.checked ? 'true' : 'false' );
					this.apply_inline_toggle_to_css( panel, !! e.target.checked );
				}
			}, true );

			root.addEventListener( 'input', ( e ) => {
				const panel = get_panel( e.target );
				if ( ! panel || ! this.is_checkbox_panel( panel ) ) { return; }
				if ( e.target.matches?.( this.ui.cssclass_input ) ) {
					this.sync_inline_toggle_from_css( panel );
				}
			}, true );

			// Optional: bootstrap immediately if inspector is already on screen
			setTimeout( () => {
				const panel = document.querySelector( '#wpbc_bfb__inspector .wpbc_bfb__inspector__body' );
				if ( panel && this.is_checkbox_panel( panel ) ) {
					this.bootstrap_panel( panel );
					this.ensure_multiple_mode_marker( panel );
					this.fix_option_toggle_icons( panel );
					this.observe_options_list( panel );
					this.sync_inline_toggle_from_css( panel );
				}
			}, 0 );
		}
	}

	try { Registry.register( 'checkbox', WPBC_BFB_Field_Checkbox ); } catch ( e ) { w._wpbc?.dev?.error?.( 'WPBC_BFB_Field_Checkbox.register', e ); }
	w.WPBC_BFB_Field_Checkbox = WPBC_BFB_Field_Checkbox;
	try { WPBC_BFB_Field_Checkbox.wire_once_checkbox(); } catch ( _ ) {}


		// -----------------------------------------------------------------------------------------------------------------
		// Export for "Booking Form" (Advanced Form shortcode)
		// -----------------------------------------------------------------------------------------------------------------
		/**
		 * Booking Form exporter callback (Advanced Form shortcode) for "checkbox".
		 *
		 * This callback is registered per field type via:
		 *   WPBC_BFB_Exporter.register( 'checkbox', callback )
		 *
		 * Core call site (builder-exporter.js):
		 *   WPBC_BFB_Exporter.run_registered_exporter( field, io, cfg, once, ctx )
		 *     → callback( field, emit, { io, cfg, once, ctx, core } );
		 *
		 * @callback WPBC_BFB_ExporterCallback
		 * @param {Object}  field
		 *   Normalized field data coming from the Builder structure.
		 *   - field.type          {string}   Field type, here "checkbox".
		 *   - field.label         {string}   Visible label in the form (may be empty).
		 *   - field.name          {string}   Name as stored on the canvas (already validated).
		 *   - field.html_id       {string}   Optional HTML id / user-visible id.
		 *   - field.cssclass      {string}   Extra CSS classes entered in Inspector.
		 *   - field.options       {Array}    Options for checkbox group (label/value/selected).
		 *   - field.option_label  {string}   Optional single-checkbox label (used when no options[]).
		 *   - field.placeholder   {string}   Optional placeholder (used as fallback label).
		 *   - ...                 (Any other pack-specific props are also present.)
		 *
		 * @param {function(string):void} emit
		 *   Emits one line/fragment into the export buffer.
		 *
		 * @param {Object} [extras]
		 *   Extra context passed by the core exporter.
		 */
		function register_checkbox_booking_form_exporter() {

			const Exp = w.WPBC_BFB_Exporter;
			if ( ! Exp || typeof Exp.register !== 'function' ) { return; }
			if ( typeof Exp.has_exporter === 'function' && Exp.has_exporter( 'checkbox' ) ) { return; }

			const S        = Core.WPBC_BFB_Sanitize || (w.WPBC_BFB_Core && w.WPBC_BFB_Core.WPBC_BFB_Sanitize) || {};
			const esc_html = S.escape_html || (v => String( v ));
			const esc_sc   = S.escape_for_shortcode || (v => String( v ));

			/**
			 * @type {WPBC_BFB_ExporterCallback}
			 */
			Exp.register( 'checkbox', (field, emit, extras = {}) => {

				const cfg       = extras.cfg || {};
				const ctx       = extras.ctx;
				const addLabels = cfg.addLabels !== false;

				// Required marker (same semantics as other text-like fields).
				const is_req   = Exp.is_required( field );
				const req_mark = is_req ? '*' : '';

				// Name / id / classes come from shared helpers so they stay in sync with other packs.
				const name     = Exp.compute_name( 'checkbox', field );
				const id_opt   = Exp.id_option( field, ctx );
				const cls_opts = Exp.class_options( field );

				// Options + default (same helpers as legacy path).
				const tokens = Exp.option_tokens( field );
				const def    = Exp.default_option_suffix( field, tokens );

				// Always add bare `use_label_element` (no value/quotes) for checkbox shortcodes.
				const use_label_element_token = ' use_label_element';

				const raw_label = (field && typeof field.label === 'string') ? field.label : '';
				const label     = raw_label.trim();

				let body;

				if ( ! tokens.trim() ) {
					// Single checkbox (no options array) — keep label in quotes at the end.
					const single_label = field.option_label || field.placeholder || label || 'I agree';

					// ORDER: name id cls  use_label_element  "label".
					body = `[checkbox${req_mark} ${name}${id_opt}${cls_opts}${use_label_element_token} "${esc_sc( single_label )}"]`;
				} else {
					// Multiple checkboxes (options array) — keep default BEFORE tokens.
					// ORDER: name id cls  use_label_element  default  tokens
					body = `[checkbox${req_mark} ${name}${id_opt}${cls_opts}${use_label_element_token}${def}${tokens}]`;
				}

				// Label behavior mirrors legacy emit_checkbox_singles().
				if ( label && addLabels ) {
					emit( `<l>${esc_html( label )}${req_mark}</l>` );
					emit( `<br>${body}` );
				} else {
					emit( body );
				}
				// Help text is appended centrally by WPBC_BFB_Exporter.render_field_node().
			} );
		}

		// Try immediate registration; if core isn’t ready, wait for the event.
		if ( w.WPBC_BFB_Exporter && typeof w.WPBC_BFB_Exporter.register === 'function' ) {
			register_checkbox_booking_form_exporter();
		} else {
			document.addEventListener( 'wpbc:bfb:exporter-ready', register_checkbox_booking_form_exporter, { once: true } );
		}


		// -----------------------------------------------------------------------------------------------------------------
		// Export for "Booking Data" (Content of booking fields data)
		// -----------------------------------------------------------------------------------------------------------------
		/**
		 * Booking Data exporter callback ("Content of booking fields data") for "checkbox".
		 *
		 * Default behavior:
		 *   <b>Label</b>: <f>[field_name]</f><br>
		 *
		 * Registered per field type via:
		 *   WPBC_BFB_ContentExporter.register( 'checkbox', callback )
		 */
		function register_checkbox_booking_data_exporter() {

			const C = w.WPBC_BFB_ContentExporter;
			if ( ! C || typeof C.register !== 'function' ) { return; }
			if ( typeof C.has_exporter === 'function' && C.has_exporter( 'checkbox' ) ) { return; }

			C.register( 'checkbox', function (field, emit, extras) {

				extras = extras || {};
				const cfg = extras.cfg || {};

				const Exp = w.WPBC_BFB_Exporter;
				if ( ! Exp || typeof Exp.compute_name !== 'function' ) { return; }

				const name = Exp.compute_name( 'checkbox', field );
				if ( ! name ) { return; }

				const label = (typeof field.label === 'string' && field.label.trim()) ? field.label.trim() : name;

				// Shared formatter keeps all packs consistent.
				C.emit_line_bold_field( emit, label, name, cfg );
			} );
		}

		if ( w.WPBC_BFB_ContentExporter && typeof w.WPBC_BFB_ContentExporter.register === 'function' ) {
			register_checkbox_booking_data_exporter();
		} else {
			document.addEventListener( 'wpbc:bfb:content-exporter-ready', register_checkbox_booking_data_exporter, { once: true } );
		}

})( window );

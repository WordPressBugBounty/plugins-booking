// ---------------------------------------------------------------------------------------------------------------------
// == File  /includes/page-form-builder/_out/core/bfb-fields.js == | 2025-09-10 15:47
// ---------------------------------------------------------------------------------------------------------------------
(function ( w ) {
	'use strict';

	// Single global namespace (idempotent & load-order safe).
	const Core = ( w.WPBC_BFB_Core = w.WPBC_BFB_Core || {} );
	const UI   = ( Core.UI = Core.UI || {} );

	/**
	 * Base class for field renderers (static-only contract).
	 * ================================================================================================================
	 * Contract exposed to the builder (static methods on the CLASS itself):
	 *   - render(el, data, ctx)              // REQUIRED
	 *   - on_field_drop(data, el, meta)      // OPTIONAL (default provided)
	 *
	 * Helpers for subclasses:
	 *   - get_defaults()     -> per-field defaults (MUST override in subclass to set type/label)
	 *   - normalize_data(d)  -> shallow merge with defaults
	 *   - get_template(id)   -> per-id cached wp.template compiler
	 *
	 * Subclass usage:
	 *   class WPBC_BFB_Field_Text extends Core.WPBC_BFB_Field_Base { static get_defaults(){ ... } }
	 *   WPBC_BFB_Field_Text.template_id = 'wpbc-bfb-field-text';
	 * ================================================================================================================
	 */
	Core.WPBC_BFB_Field_Base = class {

		/**
		 * Default field data (generic baseline).
		 * Subclasses MUST override to provide { type, label } appropriate for the field.
		 * @returns {Object}
		 */
		static get_defaults() {
			return {
				type        : 'field',
				label       : 'Field',
				name        : 'field',
				html_id     : '',
				placeholder : '',
				required    : false,
				minlength   : '',
				maxlength   : '',
				pattern     : '',
				cssclass    : '',
				help        : ''
			};
		}

		/**
		 * Shallow-merge incoming data with defaults.
		 * @param {Object} data
		 * @returns {Object}
		 */
		static normalize_data( data ) {
			var d        = data || {};
			var defaults = this.get_defaults();
			var out      = {};
			var k;

			for ( k in defaults ) {
				if ( Object.prototype.hasOwnProperty.call( defaults, k ) ) {
					out[k] = defaults[k];
				}
			}
			for ( k in d ) {
				if ( Object.prototype.hasOwnProperty.call( d, k ) ) {
					out[k] = d[k];
				}
			}
			return out;
		}

		/**
		 * Compile and cache a wp.template by id (per-id cache).
		 * @param {string} template_id
		 * @returns {Function|null}
		 */
		static get_template(template_id) {

			// Accept either "wpbc-bfb-field-text" or "tmpl-wpbc-bfb-field-text".
			if ( ! template_id || ! window.wp || ! wp.template ) {
				return null;
			}
			const domId = template_id.startsWith( 'tmpl-' ) ? template_id : ('tmpl-' + template_id);
			if ( ! document.getElementById( domId ) ) {
				return null;
			}

			if ( ! Core.__bfb_tpl_cache_map ) {
				Core.__bfb_tpl_cache_map = {};
			}

			// Normalize id for the compiler & cache. // wp.template expects id WITHOUT the "tmpl-" prefix !
			const key = template_id.replace( /^tmpl-/, '' );
			if ( Core.__bfb_tpl_cache_map[key] ) {
				return Core.__bfb_tpl_cache_map[key];
			}

			const compiler = wp.template( key );     // <-- normalized id here
			if ( compiler ) {
				Core.__bfb_tpl_cache_map[key] = compiler;
			}

			return compiler;
		}

		/**
		 * REQUIRED: render preview into host element (full redraw; idempotent).
		 * Subclasses should set static `template_id` to a valid wp.template id.
		 * @param {HTMLElement} el
		 * @param {Object}      data
		 * @param {{mode?:string,builder?:any,tpl?:Function,sanit?:any}} ctx
		 * @returns {void}
		 */
		static render( el, data, ctx ) {
			if ( ! el ) {
				return;
			}

			var compile = this.get_template( this.template_id );
			var d       = this.normalize_data( data );

			var s = (ctx && ctx.sanit) ? ctx.sanit : Core.WPBC_BFB_Sanitize;

			// Sanitize critical attributes before templating.
			if ( s ) {
				d.html_id = d.html_id ? s.sanitize_html_id( String( d.html_id ) ) : '';
				d.name    = s.sanitize_html_name( String( d.name || d.id || 'field' ) );
			} else {
				d.html_id = d.html_id ? String( d.html_id ) : '';
				d.name    = String( d.name || d.id || 'field' );
			}

			// Fall back to generic preview if template not available.
			if ( compile ) {
				el.innerHTML = compile( d );

				// After render, set attribute values via DOM so quotes/newlines are handled correctly.
				const input = el.querySelector( 'input, textarea, select' );
				if ( input ) {
					if ( d.placeholder != null ) input.setAttribute( 'placeholder', String( d.placeholder ) );
					if ( d.title != null ) input.setAttribute( 'title', String( d.title ) );
				}

			} else {
				el.innerHTML = Core.WPBC_Form_Builder_Helper.render_field_inner_html( d );
			}

			el.dataset.type = d.type || 'field';
			el.setAttribute( 'data-label', (d.label != null ? String( d.label ) : '') ); // allow "".
		}


		/**
		 * OPTIONAL hook executed after field is dropped/loaded/preview.
		 * Default extended:
		 * - On first drop: stamp default label (existing behavior) and mark field as "fresh" for auto-name.
		 * - On load: mark as loaded so later label edits do not rename the saved name.
		 */
		static on_field_drop(data, el, meta) {

			const context = (meta && meta.context) ? String( meta.context ) : '';

			// -----------------------------------------------------------------------------------------
			// NEW: Seed default "help" (and keep it in Structure) for all field packs that define it.
			// This fixes the mismatch where:
			//   - UI shows default help via normalize_data() / templates
			//   - but get_structure() / exporters see `help` as undefined/empty.
			//
			// Behavior:
			//   - Runs ONLY on initial drop (context === 'drop').
			//   - If get_defaults() exposes a non-empty "help", and data.help is
			//     missing / null / empty string -> we persist the default into `data`
			//     and notify Structure so exports see it.
			//   - On "load" we do nothing, so existing forms where user *cleared*
			//     help will not be overridden.
			// -----------------------------------------------------------------------------------------
			if ( context === 'drop' && data ) {
				try {
					const defs = (typeof this.get_defaults === 'function') ? this.get_defaults() : null;
					if ( defs && Object.prototype.hasOwnProperty.call( defs, 'help' ) ) {
						const current    = Object.prototype.hasOwnProperty.call( data, 'help' ) ? data.help : undefined;
						const hasValue   = (current !== undefined && current !== null && String( current ) !== '');
						const defaultVal = defs.help;

						if ( ! hasValue && defaultVal != null && String( defaultVal ) !== '' ) {
							// 1) persist into data object (used by Structure).
							data.help = defaultVal;

							// 2) mirror into dataset (for any DOM-based consumers).
							if ( el ) {
								el.dataset.help = String( defaultVal );

								// 3) notify Structure / listeners (if available).
								try {
									Core.Structure?.update_field_prop?.( el, 'help', defaultVal );
									el.dispatchEvent(
										new CustomEvent( 'wpbc_bfb_field_data_changed', { bubbles: true, detail : { key: 'help', value: defaultVal } } )
									);
								} catch ( _inner ) {}
							}
						}
					}
				} catch ( _e ) {}
			}
			// -----------------------------------------------------------------------------------------

			if ( context === 'drop' && !Object.prototype.hasOwnProperty.call( data, 'label' ) ) {
				const defs = this.get_defaults();
				data.label = defs.label || 'Field';
				el.setAttribute( 'data-label', data.label );
			}
			// Mark provenance flags.
			if ( context === 'drop' ) {
				el.dataset.fresh      = '1';   // can auto-name on first label edit.
				el.dataset.autoname   = '1';
				el.dataset.was_loaded = '0';
				// Seed a provisional unique name immediately.
				try {
					const b = meta?.builder;
					if ( b?.id && (!el.hasAttribute( 'data-name' ) || !el.getAttribute( 'data-name' )) ) {
						const S    = Core.WPBC_BFB_Sanitize;
						const base = S.sanitize_html_name( el.getAttribute( 'data-id' ) || data?.id || data?.type || 'field' );
						const uniq = b.id.ensure_unique_field_name( base, el );
						el.setAttribute( 'data-name', uniq );
						el.dataset.name_user_touched = '0';
					}
				} catch ( _ ) {}

			} else if ( context === 'load' ) {
				el.dataset.fresh      = '0';
				el.dataset.autoname   = '0';
				el.dataset.was_loaded = '1';   // never rename names for loaded fields.
			}
		}

		// --- Auto Rename "Fresh" field,  on entering the new Label ---

		/**
		 * Create a conservative field "name" from a human label.
		 * Uses the same constraints as sanitize_html_name (letters/digits/_- and leading letter).
		 */
		static name_from_label(label) {
			const s = Core.WPBC_BFB_Sanitize.sanitize_html_name( String( label ?? '' ) );
			return s.toLowerCase() || 'field';
		}

		/**
		 * Auto-fill data-name from label ONLY for freshly dropped fields that were not edited yet.
		 * - Never runs for sections.
		 * - Never runs for loaded/existing fields.
		 * - Stops as soon as user edits the Name manually.
		 *
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} el  - .wpbc_bfb__field element
		 * @param {string} labelVal
		 */
		static maybe_autoname_from_label(builder, el, labelVal) {
			if ( !builder || !el ) return;
			if ( el.classList.contains( 'wpbc_bfb__section' ) ) return;

			const allowAuto = el.dataset.autoname === '1';

			const userTouched = el.dataset.name_user_touched === '1';
			const isLoaded    = el.dataset.was_loaded === '1';

			if ( !allowAuto || userTouched || isLoaded ) return;

			// Only override placeholder-y names
			const S = Core.WPBC_BFB_Sanitize;

			const base   = this.name_from_label( labelVal );
			const unique = builder.id.ensure_unique_field_name( base, el );
			el.setAttribute( 'data-name', unique );

			const ins      = document.getElementById( 'wpbc_bfb__inspector' );
			const nameCtrl = ins?.querySelector( '[data-inspector-key="name"]' );
			if ( nameCtrl && 'value' in nameCtrl && nameCtrl.value !== unique ) nameCtrl.value = unique;
		}


	};

	/**
	 * Select_Base (shared base for select-like packs)
	 *
	 * @type {Core.WPBC_BFB_Select_Base}
	 */
	Core.WPBC_BFB_Select_Base = class extends Core.WPBC_BFB_Field_Base {

		static template_id            = null;                 // main preview template id
		static option_row_template_id = 'wpbc-bfb-inspector-select-option-row'; // row tpl id
		static kind                   = 'select';
		static __root_wired           = false;
		static __root_node            = null;

		// Single source of selectors used by the inspector UI.
		static ui = {
			list   : '.wpbc_bfb__options_list',
			holder : '.wpbc_bfb__options_state[data-inspector-key="options"]',
			row    : '.wpbc_bfb__options_row',
			label  : '.wpbc_bfb__opt-label',
			value  : '.wpbc_bfb__opt-value',
			toggle : '.wpbc_bfb__opt-selected-chk',
			add_btn: '.js-add-option',

			drag_handle      : '.wpbc_bfb__drag-handle',
			multiple_chk     : '.js-opt-multiple[data-inspector-key="multiple"]',
			default_text     : '.js-default-value[data-inspector-key="default_value"]',
			placeholder_input: '.js-placeholder[data-inspector-key="placeholder"]',
			placeholder_note : '.js-placeholder-note',
			size_input       : '.inspector__input[data-inspector-key="size"]',

			// Dropdown menu integration.
			menu_root  : '.wpbc_ui_el__dropdown',
			menu_toggle: '[data-toggle="wpbc_dropdown"]',
			menu_action: '.ul_dropdown_menu_li_action[data-action]',
			// Value-differs toggle.
			value_differs_chk: '.js-value-differs[data-inspector-key="value_differs"]',
		};

		/**
		 * Build option value from label.
		 * - If `differs === true` -> generate token (slug-like machine value).
		 * - If `differs === false` -> keep human text; escape only dangerous chars.
		 * @param {string} label
		 * @param {boolean} differs
		 * @returns {string}
		 */
		static build_value_from_label(label, differs) {
			const S = Core.WPBC_BFB_Sanitize;
			if ( differs ) {
				return (S && typeof S.to_token === 'function')
					? S.to_token( String( label || '' ) )
					: String( label || '' ).trim().toLowerCase().replace( /\s+/g, '_' ).replace( /[^\w-]/g, '' );
			}
			// single-input mode: keep human text; template will escape safely.
			return String( label == null ? '' : label );
		}

		/**
		 * Is the “value differs from label” toggle enabled?
		 * @param {HTMLElement} panel
		 * @returns {boolean}
		 */
		static is_value_differs_enabled(panel) {
			const chk = panel?.querySelector( this.ui.value_differs_chk );
			return !!(chk && chk.checked);
		}

		/**
		 * Ensure visibility/enabled state of Value inputs based on the toggle.
		 * When disabled -> hide Value inputs and keep them mirrored from Label.
		 * @param {HTMLElement} panel
		 * @returns {void}
		 */
		static sync_value_inputs_visibility(panel) {
			const differs = this.is_value_differs_enabled( panel );
			const rows    = panel?.querySelectorAll( this.ui.row ) || [];

			for ( let i = 0; i < rows.length; i++ ) {
				const r      = rows[i];
				const lbl_in = r.querySelector( this.ui.label );
				const val_in = r.querySelector( this.ui.value );
				if ( !val_in ) continue;

				if ( differs ) {
					// Re-enable & show value input
					val_in.removeAttribute( 'disabled' );
					val_in.style.display = '';

					// If we have a cached custom value and the row wasn't edited while OFF, restore it
					const hasCache   = !!val_in.dataset.cached_value;
					const userEdited = r.dataset.value_user_touched === '1';

					if ( hasCache && !userEdited ) {
						val_in.value = val_in.dataset.cached_value;
					} else if ( !hasCache ) {
						// No cache: if value is just a mirrored label, offer a tokenized default
						const lbl      = lbl_in ? lbl_in.value : '';
						const mirrored = this.build_value_from_label( lbl, /*differs=*/false );
						if ( val_in.value === mirrored ) {
							val_in.value = this.build_value_from_label( lbl, /*differs=*/true );
						}
					}
				} else {
					// ON -> OFF: cache once, then mirror
					if ( !val_in.dataset.cached_value ) {
						val_in.dataset.cached_value = val_in.value || '';
					}
					const lbl    = lbl_in ? lbl_in.value : '';
					val_in.value = this.build_value_from_label( lbl, /*differs=*/false );

					val_in.setAttribute( 'disabled', 'disabled' );
					val_in.style.display = 'none';
					// NOTE: do NOT mark as user_touched here
				}
			}
		}


		/**
		 * Return whether this row’s value has been edited by user.
		 * @param {HTMLElement} row
		 * @returns {boolean}
		 */
		static is_row_value_user_touched(row) {
			return row?.dataset?.value_user_touched === '1';
		}

		/**
		 * Mark this row’s value as edited by user.
		 * @param {HTMLElement} row
		 */
		static mark_row_value_user_touched(row) {
			if ( row ) row.dataset.value_user_touched = '1';
		}

		/**
		 * Initialize “freshness” flags on a row (value untouched).
		 * Call on creation/append of rows.
		 * @param {HTMLElement} row
		 */
		static init_row_fresh_flags(row) {
			if ( row ) {
				if ( !row.dataset.value_user_touched ) {
					row.dataset.value_user_touched = '0';
				}
			}
		}

		// ---- defaults (packs can override) ----
		static get_defaults() {
			return {
				type         : this.kind,
				label        : 'Select',
				name         : '',
				html_id      : '',
				placeholder  : '--- Select ---',
				required     : false,
				multiple     : false,
				size         : null,
				cssclass     : '',
				help         : '',
				default_value: '',
				options      : [
					{ label: 'Option 1', value: 'Option 1', selected: false },
					{ label: 'Option 2', value: 'Option 2', selected: false },
					{ label: 'Option 3', value: 'Option 3', selected: false },
					{ label: 'Option 4', value: 'Option 4', selected: false }
				],
				min_width    : '240px'
			};
		}

		// ---- preview render (idempotent) ----
		static render(el, data, ctx) {
			if ( !el ) return;

			const d = this.normalize_data( data );

			if ( d.min_width != null ) {
				el.dataset.min_width = String( d.min_width );
				try {
					el.style.setProperty( '--wpbc-col-min', String( d.min_width ) );
				} catch ( _ ) {
				}
			}
			if ( d.html_id != null ) el.dataset.html_id = String( d.html_id || '' );
			if ( d.cssclass != null ) el.dataset.cssclass = String( d.cssclass || '' );
			if ( d.placeholder != null ) el.dataset.placeholder = String( d.placeholder || '' );

			const tpl = this.get_template( this.template_id );
			if ( typeof tpl !== 'function' ) {
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Template not found: ' + this.template_id + '.</div>';
				return;
			}

			try {
				el.innerHTML = tpl( d );
			} catch ( e ) {
				window._wpbc?.dev?.error?.( 'Select_Base.render', e );
				el.innerHTML = '<div class="wpbc_bfb__error" role="alert">Error rendering field preview.</div>';
				return;
			}

			el.dataset.type = d.type || this.kind;
			el.setAttribute( 'data-label', (d.label != null ? String( d.label ) : '') );

			try {
				Core.UI?.WPBC_BFB_Overlay?.ensure?.( ctx?.builder, el );
			} catch ( _ ) {
			}

			if ( !el.dataset.options && Array.isArray( d.options ) && d.options.length ) {
				try {
					el.dataset.options = JSON.stringify( d.options );
				} catch ( _ ) {
				}
			}
		}

		// ---- drop seeding (options + placeholder) ----
		static on_field_drop(data, el, meta) {
			try {
				super.on_field_drop?.( data, el, meta );
			} catch ( _ ) {
			}

			const is_drop = (meta && meta.context === 'drop');

			if ( is_drop ) {
				if ( !Array.isArray( data.options ) || !data.options.length ) {
					const opts   = (this.get_defaults().options || []).map( (o) => ({
						label   : o.label,
						value   : o.value,
						selected: !!o.selected
					}) );
					data.options = opts;
					try {
						el.dataset.options = JSON.stringify( opts );
						el.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', { bubbles: true,
							detail                                                                 : {
								key  : 'options',
								value: opts
							}
						} ) );
						Core.Structure?.update_field_prop?.( el, 'options', opts );
					} catch ( _ ) {
					}
				}

				const ph = (data.placeholder ?? '').toString().trim();
				if ( !ph ) {
					const dflt       = this.get_defaults().placeholder || '--- Select ---';
					data.placeholder = dflt;
					try {
						el.dataset.placeholder = String( dflt );
						el.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', { bubbles: true,
							detail                                                                 : {
								key  : 'placeholder',
								value: dflt
							}
						} ) );
						Core.Structure?.update_field_prop?.( el, 'placeholder', dflt );
					} catch ( _ ) {
					}
				}
			}
		}

		// ==============================
		// Inspector helpers (snake_case)
		// ==============================
		static get_panel_root(el) {
			return el?.closest?.( '.wpbc_bfb__inspector__body' ) || el?.closest?.( '.wpbc_bfb__inspector' ) || null;
		}

		static get_list(panel) {
			return panel ? panel.querySelector( this.ui.list ) : null;
		}

		static get_holder(panel) {
			return panel ? panel.querySelector( this.ui.holder ) : null;
		}

		static make_uid() {
			return 'wpbc_ins_auto_opt_' + Math.random().toString( 36 ).slice( 2, 10 );
		}

		static append_row(panel, data) {
			const list = this.get_list( panel );
			if ( !list ) return;

			const idx  = list.children.length;
			const rowd = Object.assign( { label: '', value: '', selected: false, index: idx }, (data || {}) );
			if ( !rowd.uid ) rowd.uid = this.make_uid();

			const tpl_id = this.option_row_template_id;
			const tpl    = (window.wp && wp.template) ? wp.template( tpl_id ) : null;
			const html   = tpl ? tpl( rowd ) : null;

			// In append_row() -> fallback HTML.
			const wrap     = document.createElement( 'div' );
			wrap.innerHTML = html || (
				'<div class="wpbc_bfb__options_row" data-index="' + (rowd.index || 0) + '">' +
					'<span class="wpbc_bfb__drag-handle"><span class="wpbc_icn_drag_indicator"></span></span>' +
					'<input type="text" class="wpbc_bfb__opt-label" placeholder="Label" value="' + (rowd.label || '') + '">' +
					'<input type="text" class="wpbc_bfb__opt-value" placeholder="Value" value="' + (rowd.value || '') + '">' +
					'<div class="wpbc_bfb__opt-selected">' +
						'<div class="inspector__control wpbc_ui__toggle">' +
							'<input type="checkbox" class="wpbc_bfb__opt-selected-chk inspector__input" id="' + rowd.uid + '" role="switch" ' + (rowd.selected ? 'checked aria-checked="true"' : 'aria-checked="false"') + '>' +
							'<label class="wpbc_ui__toggle_icon_radio" for="' + rowd.uid + '"></label>' +
							'<label class="wpbc_ui__toggle_label" for="' + rowd.uid + '">Default</label>' +
						'</div>' +
					'</div>' +
					// 3-dot dropdown (uses existing plugin dropdown JS).
					'<div class="wpbc_ui_el wpbc_ui_el_container wpbc_ui_el__dropdown">' +
						'<a href="javascript:void(0)" data-toggle="wpbc_dropdown" aria-expanded="false" class="ul_dropdown_menu_toggle">' +
							'<i class="menu_icon icon-1x wpbc_icn_more_vert"></i>' +
						'</a>' +
						'<ul class="ul_dropdown_menu" role="menu" style="right:0px; left:auto;">' +
							'<li>' +
								'<a class="ul_dropdown_menu_li_action" data-action="add_after" href="javascript:void(0)">' +
									'Add New' +
									'<i class="menu_icon icon-1x wpbc_icn_add_circle"></i>' +
								'</a>' +
							'</li>' +
							'<li>' +
								'<a class="ul_dropdown_menu_li_action" data-action="duplicate" href="javascript:void(0)">' +
									'Duplicate' +
									'<i class="menu_icon icon-1x wpbc_icn_content_copy"></i>' +
								'</a>' +
							'</li>' +
							'<li class="divider"></li>' +
							'<li>' +
								'<a class="ul_dropdown_menu_li_action" data-action="remove" href="javascript:void(0)">' +
									'Remove' +
									'<i class="menu_icon icon-1x wpbc_icn_delete_outline"></i>' +
								'</a>' +
							'</li>' +
						'</ul>' +
					'</div>' +
				'</div>'
			);

			const node = wrap.firstElementChild;
			 if (! node) {
				 return;
			 }
			// pre-hide Value input if toggle is OFF **before** appending.
			const differs = this.is_value_differs_enabled( panel );
			const valIn   = node.querySelector( this.ui.value );
			const lblIn   = node.querySelector( this.ui.label );

			if ( !differs && valIn ) {
				if ( !valIn.dataset.cached_value ) {
					valIn.dataset.cached_value = valIn.value || '';
				}
				if ( lblIn ) valIn.value = this.build_value_from_label( lblIn.value, false );
				valIn.setAttribute( 'disabled', 'disabled' );
				valIn.style.display = 'none';
			}


			this.init_row_fresh_flags( node );
			list.appendChild( node );

			// Keep your existing post-append sync as a safety net
			this.sync_value_inputs_visibility( panel );
		}

		static close_dropdown(anchor_el) {
			try {
				var root = anchor_el?.closest?.( this.ui.menu_root );
				if ( root ) {
					// If your dropdown toggler toggles a class like 'open', close it.
					root.classList.remove( 'open' );
					// Or if it relies on aria-expanded on the toggle.
					var t = root.querySelector( this.ui.menu_toggle );
					if ( t ) {
						t.setAttribute( 'aria-expanded', 'false' );
					}
				}
			} catch ( _ ) { }
		}

		static insert_after(new_node, ref_node) {
			if ( ref_node?.parentNode ) {
				if ( ref_node.nextSibling ) {
					ref_node.parentNode.insertBefore( new_node, ref_node.nextSibling );
				} else {
					ref_node.parentNode.appendChild( new_node );
				}
			}
		}

		static commit_options(panel) {
			const list   = this.get_list( panel );
			const holder = this.get_holder( panel );
			if ( !list || !holder ) return;

			const differs = this.is_value_differs_enabled( panel );

			const rows    = list.querySelectorAll( this.ui.row );
			const options = [];
			for ( let i = 0; i < rows.length; i++ ) {
				const r      = rows[i];
				const lbl_in = r.querySelector( this.ui.label );
				const val_in = r.querySelector( this.ui.value );
				const chk    = r.querySelector( this.ui.toggle );

				const lbl = (lbl_in && lbl_in.value) || '';
				let val   = (val_in && val_in.value) || '';

				// If single-input mode -> hard mirror to label.
				if ( ! differs ) {
					// single-input mode: mirror Label, minimal escaping (no slug).
					val = this.build_value_from_label( lbl, /*differs=*/false );
					if ( val_in ) {
						val_in.value = val;   // keep hidden input in sync for any previews/debug.
					}
				}

				const sel = !!(chk && chk.checked);
				options.push( { label: lbl, value: val, selected: sel } );
			}

			try {
				holder.value = JSON.stringify( options );
				holder.dispatchEvent( new Event( 'input', { bubbles: true } ) );
				holder.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				panel.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', {
					bubbles: true, detail: {
						key: 'options', value: options
					}
				} ) );
			} catch ( _ ) {
			}

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );

			// Mirror to the selected field element so canvas/export sees current options immediately.
			const field = panel.__selectbase_field
				|| document.querySelector( '.wpbc_bfb__field.is-selected, .wpbc_bfb__field--selected' );
			if ( field ) {
				try {
					field.dataset.options = JSON.stringify( options );
				} catch ( _ ) {
				}
				Core.Structure?.update_field_prop?.( field, 'options', options );
				field.dispatchEvent( new CustomEvent( 'wpbc_bfb_field_data_changed', {
					bubbles: true, detail: { key: 'options', value: options }
				} ) );
			}
		}


		static ensure_sortable(panel) {

			const list = this.get_list( panel );
			if ( ! list ) {
				return;
			}

			try {
				const existing = window.Sortable?.get?.( list );
				if ( existing ) {
					return;
				}

				const builder = window.wpbc_bfb_api?.get_builder?.() || window.wpbc_bfb || null;

				// Prefer the shared Sortable manager so the sidebar list uses
				// the dedicated "simple_list" config instead of the canvas config.
				if ( builder && builder.sortable && typeof builder.sortable.ensure === 'function' ) {

					builder.sortable.ensure(
						list,
						'canvas',
						{
							sortable_kind     : 'simple_list',
							handle_selector   : this.ui.drag_handle,
							draggable_selector: this.ui.row,
							onUpdate          : () => {
								this.commit_options( panel );
							}
						}
					);

				} else if ( window.Sortable?.create ) {
					// Fallback if builder is not ready for some reason.
					window.Sortable.create(
						list,
						{
							handle           : this.ui.drag_handle,
							draggable        : this.ui.row,
							animation        : 120,
							forceFallback    : true,
							fallbackOnBody   : false,
							fallbackTolerance: 8,
							removeCloneOnHide: true,
							onUpdate         : () => {
								this.commit_options( panel );
							}
						}
					);
				}

				list.dataset.sortable_init = '1';

			} catch ( e ) {
				window._wpbc?.dev?.error?.( 'Select_Base.ensure_sortable', e );
			}
		}

		static rebuild_if_empty(panel) {
			const list   = this.get_list( panel );
			const holder = this.get_holder( panel );
			if ( !list || !holder || list.children.length ) return;

			let data = [];
			try {
				data = JSON.parse( holder.value || '[]' );
			} catch ( _ ) {
				data = [];
			}

			if ( !Array.isArray( data ) || !data.length ) {
				data = (this.get_defaults().options || []).slice( 0 );
				try {
					holder.value = JSON.stringify( data );
					holder.dispatchEvent( new Event( 'input', { bubbles: true } ) );
					holder.dispatchEvent( new Event( 'change', { bubbles: true } ) );
				} catch ( _ ) {
				}
			}

			for ( let i = 0; i < data.length; i++ ) {
				this.append_row( panel, {
					label   : data[i]?.label || '',
					value   : data[i]?.value || '',
					selected: !!data[i]?.selected,
					index   : i,
					uid     : this.make_uid()
				} );
			}

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );
			this.sync_value_inputs_visibility( panel );
		}

		static has_row_defaults(panel) {
			const checks = panel?.querySelectorAll( this.ui.toggle );
			if ( !checks?.length ) return false;
			for ( let i = 0; i < checks.length; i++ ) if ( checks[i].checked ) return true;
			return false;
		}

		static is_multiple_enabled(panel) {
			const chk = panel?.querySelector( this.ui.multiple_chk );
			return !!(chk && chk.checked);
		}

		static has_text_default_value(panel) {
			const dv = panel?.querySelector( this.ui.default_text );
			return !!(dv && String( dv.value || '' ).trim().length);
		}

		static sync_default_value_lock(panel) {
			const input = panel?.querySelector( this.ui.default_text );
			const note  = panel?.querySelector( '.js-default-value-note' );
			if ( !input ) return;

			const lock     = this.has_row_defaults( panel );
			input.disabled = !!lock;
			if ( lock ) {
				input.setAttribute( 'aria-disabled', 'true' );
				if ( note ) note.style.display = '';
			} else {
				input.removeAttribute( 'aria-disabled' );
				if ( note ) note.style.display = 'none';
			}
		}

		static sync_placeholder_lock(panel) {
			const input = panel?.querySelector( this.ui.placeholder_input );
			const note  = panel?.querySelector( this.ui.placeholder_note );

			// NEW: compute multiple and toggle row visibility
			const isMultiple     = this.is_multiple_enabled( panel );
			const placeholderRow = input?.closest( '.inspector__row' ) || null;
			const sizeInput      = panel?.querySelector( this.ui.size_input ) || null;
			const sizeRow        = sizeInput?.closest( '.inspector__row' ) || null;

			// Show placeholder only for single-select; show size only for multiple
			if ( placeholderRow ) placeholderRow.style.display = isMultiple ? 'none' : '';
			if ( sizeRow ) sizeRow.style.display = isMultiple ? '' : 'none';

			// Existing behavior (keep as-is)
			if ( !input ) return;

			const lock = isMultiple || this.has_row_defaults( panel ) || this.has_text_default_value( panel );
			if ( note && !note.id ) note.id = 'wpbc_placeholder_note_' + Math.random().toString( 36 ).slice( 2, 10 );

			input.disabled = !!lock;
			if ( lock ) {
				input.setAttribute( 'aria-disabled', 'true' );
				if ( note ) {
					note.style.display = '';
					input.setAttribute( 'aria-describedby', note.id );
				}
			} else {
				input.removeAttribute( 'aria-disabled' );
				input.removeAttribute( 'aria-describedby' );
				if ( note ) note.style.display = 'none';
			}
		}

		static enforce_single_default(panel, clicked) {
			if ( this.is_multiple_enabled( panel ) ) return;

			const checks = panel?.querySelectorAll( this.ui.toggle );
			if ( !checks?.length ) return;

			if ( clicked && clicked.checked ) {
				for ( let i = 0; i < checks.length; i++ ) if ( checks[i] !== clicked ) {
					checks[i].checked = false;
					checks[i].setAttribute( 'aria-checked', 'false' );
				}
				clicked.setAttribute( 'aria-checked', 'true' );
				return;
			}

			let kept = false;
			for ( let j = 0; j < checks.length; j++ ) if ( checks[j].checked ) {
				if ( !kept ) {
					kept = true;
				} else {
					checks[j].checked = false;
					checks[j].setAttribute( 'aria-checked', 'false' );
				}
			}

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );
		}

		// ---- one-time bootstrap of a panel ----
		static bootstrap_panel(panel) {
			if ( !panel ) return;
			if ( !panel.querySelector( '.wpbc_bfb__options_editor' ) ) return; // only select-like UIs
			if ( panel.dataset.selectbase_bootstrapped === '1' ) {
				this.ensure_sortable( panel );
				return;
			}

			this.rebuild_if_empty( panel );
			this.ensure_sortable( panel );
			panel.dataset.selectbase_bootstrapped = '1';

			this.sync_default_value_lock( panel );
			this.sync_placeholder_lock( panel );
			this.sync_value_inputs_visibility( panel );
		}

		// ---- hook into inspector lifecycle (fires ONCE) ----
		static wire_once() {
			if ( Core.__selectbase_wired ) return;
			Core.__selectbase_wired = true;

			const on_ready_or_render = (ev) => {
				const panel = ev?.detail?.panel;
				const field = ev?.detail?.el || ev?.detail?.field || null;
				if ( !panel ) return;
				if ( field ) panel.__selectbase_field = field;
				this.bootstrap_panel( panel );
				// If the inspector root was remounted, ensure root listeners are (re)bound.
				this.wire_root_listeners();
			};

			document.addEventListener( 'wpbc_bfb_inspector_ready', on_ready_or_render );
			document.addEventListener( 'wpbc_bfb_inspector_render', on_ready_or_render );

			this.wire_root_listeners();
		}

		static wire_root_listeners() {

			// If already wired AND the stored root is still in the DOM, bail out.
			if ( this.__root_wired && this.__root_node?.isConnected ) return;

			const root = document.getElementById( 'wpbc_bfb__inspector' );
			if ( !root ) {
				// Root missing (e.g., SPA re-render) — clear flags so we can wire later.
				this.__root_wired = false;
				this.__root_node  = null;
				return;
			}

			this.__root_node                   = root;
			this.__root_wired                  = true;
			root.dataset.selectbase_root_wired = '1';

			const get_panel = (target) =>
				target?.closest?.( '.wpbc_bfb__inspector__body' ) ||
				root.querySelector( '.wpbc_bfb__inspector__body' ) || null;

			// Click handlers: add / delete / duplicate
			root.addEventListener( 'click', (e) => {
				const panel = get_panel( e.target );
				if ( !panel ) return;

				this.bootstrap_panel( panel );

				const ui = this.ui;

				// Existing "Add option" button (top toolbar)
				const add = e.target.closest?.( ui.add_btn );
				if ( add ) {
					this.append_row( panel, { label: '', value: '', selected: false } );
					this.commit_options( panel );
					this.sync_value_inputs_visibility( panel );
					return;
				}

				// Dropdown menu actions.
				const menu_action = e.target.closest?.( ui.menu_action );
				if ( menu_action ) {
					e.preventDefault();
					e.stopPropagation();

					const action = (menu_action.getAttribute( 'data-action' ) || '').toLowerCase();
					const row    = menu_action.closest?.( ui.row );

					if ( !row ) {
						this.close_dropdown( menu_action );
						return;
					}

					if ( 'add_after' === action ) {
						// Add empty row after current
						const prev_count = this.get_list( panel )?.children.length || 0;
						this.append_row( panel, { label: '', value: '', selected: false } );
						// Move the newly added last row just after current row to preserve "add after"
						const list = this.get_list( panel );
						if ( list && list.lastElementChild && list.lastElementChild !== row ) {
							this.insert_after( list.lastElementChild, row );
						}
						this.commit_options( panel );
						this.sync_value_inputs_visibility( panel );
					} else if ( 'duplicate' === action ) {
						const lbl = (row.querySelector( ui.label ) || {}).value || '';
						const val = (row.querySelector( ui.value ) || {}).value || '';
						const sel = !!((row.querySelector( ui.toggle ) || {}).checked);
						this.append_row( panel, { label: lbl, value: val, selected: sel, uid: this.make_uid() } );
						// Place the new row right after the current.
						const list = this.get_list( panel );

						if ( list && list.lastElementChild && list.lastElementChild !== row ) {
							this.insert_after( list.lastElementChild, row );
						}
						this.enforce_single_default( panel, null );
						this.commit_options( panel );
						this.sync_value_inputs_visibility( panel );
					} else if ( 'remove' === action ) {
						if ( row && row.parentNode ) row.parentNode.removeChild( row );
						this.commit_options( panel );
						this.sync_value_inputs_visibility( panel );
					}

					this.close_dropdown( menu_action );
					return;
				}

			}, true );


			// Input delegation.
			root.addEventListener( 'input', (e) => {
				const panel = get_panel( e.target );
				if ( ! panel ) {
					return;
				}
				const ui                = this.ui;
				const is_label_or_value = e.target.classList?.contains( 'wpbc_bfb__opt-label' ) || e.target.classList?.contains( 'wpbc_bfb__opt-value' );
				const is_toggle         = e.target.classList?.contains( 'wpbc_bfb__opt-selected-chk' );
				const is_multiple       = e.target.matches?.( ui.multiple_chk );
				const is_default_text   = e.target.matches?.( ui.default_text );
				const is_value_differs  = e.target.matches?.( ui.value_differs_chk );

				// Handle "value differs" toggle live
				if ( is_value_differs ) {
					this.sync_value_inputs_visibility( panel );
					this.commit_options( panel );
					return;
				}

				// Track when the user edits VALUE explicitly
				if ( e.target.classList?.contains( 'wpbc_bfb__opt-value' ) ) {
					const row = e.target.closest( this.ui.row );
					this.mark_row_value_user_touched( row );
					// Keep the cache updated so toggling OFF/ON later restores the latest custom value
					e.target.dataset.cached_value = e.target.value || '';
				}

				// Auto-fill VALUE from LABEL if value is fresh (and differs is ON); if differs is OFF, we mirror anyway in commit
				if ( e.target.classList?.contains( 'wpbc_bfb__opt-label' ) ) {
					const row     = e.target.closest( ui.row );
					const val_in  = row?.querySelector( ui.value );
					const differs = this.is_value_differs_enabled( panel );

					if ( val_in ) {
						if ( !differs ) {
							// single-input mode: mirror human label with minimal escaping
							val_in.value = this.build_value_from_label( e.target.value, false );
						} else if ( !this.is_row_value_user_touched( row ) ) {
							// separate-value mode, only while fresh
							val_in.value = this.build_value_from_label( e.target.value, true );
						}
					}
				}


				if ( is_label_or_value || is_toggle || is_multiple ) {
					if ( is_toggle ) e.target.setAttribute( 'aria-checked', e.target.checked ? 'true' : 'false' );
					if ( is_toggle || is_multiple ) this.enforce_single_default( panel, is_toggle ? e.target : null );
					this.commit_options( panel );
				}

				if ( is_default_text ) {
					this.sync_default_value_lock( panel );
					this.sync_placeholder_lock( panel );
					const holder = this.get_holder( panel );
					if ( holder ) {
						holder.dispatchEvent( new Event( 'input', { bubbles: true } ) );
						holder.dispatchEvent( new Event( 'change', { bubbles: true } ) );
					}
				}
			}, true );


			// Change delegation
			root.addEventListener( 'change', (e) => {
				const panel = get_panel( e.target );
				if ( !panel ) return;

				const ui        = this.ui;
				const is_toggle = e.target.classList?.contains( 'wpbc_bfb__opt-selected-chk' );
				const is_multi  = e.target.matches?.( ui.multiple_chk );
				if ( !is_toggle && !is_multi ) return;

				if ( is_toggle ) e.target.setAttribute( 'aria-checked', e.target.checked ? 'true' : 'false' );
				this.enforce_single_default( panel, is_toggle ? e.target : null );
				this.commit_options( panel );
			}, true );

			// Lazy bootstrap
			root.addEventListener( 'mouseenter', (e) => {
				const panel = get_panel( e.target );
				if ( panel && e.target?.closest?.( this.ui.list ) ) this.bootstrap_panel( panel );
			}, true );

			root.addEventListener( 'mousedown', (e) => {
				const panel = get_panel( e.target );
				if ( panel && e.target?.closest?.( this.ui.drag_handle ) ) this.bootstrap_panel( panel );
			}, true );
		}

	};

	try { Core.WPBC_BFB_Select_Base.wire_once(); } catch (_) {}
	// Try immediately (if root is already in DOM), then again on DOMContentLoaded.
	Core.WPBC_BFB_Select_Base.wire_root_listeners();

	document.addEventListener('DOMContentLoaded', () => { Core.WPBC_BFB_Select_Base.wire_root_listeners();  });

}( window ));
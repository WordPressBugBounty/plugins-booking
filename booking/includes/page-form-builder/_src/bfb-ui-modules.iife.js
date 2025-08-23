// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/bfb-ui-modules.iife.js == Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
( function ( w ) {
	'use strict';

	const { WPBC_BFB_DOM, WPBC_Form_Builder_Helper, WPBC_BFB_Events, WPBC_BFB_Sanitize } = w.WPBC_BFB_Core;

	const UI = {};

	/**
	 * Base class for BFB modules.
	 */
	UI.WPBC_BFB_Module = class {
		/** @param {WPBC_Form_Builder} builder */
		constructor(builder) {
			this.builder = builder;
		}

		/** Initialize the module. */
		init() {
		}

		/** Cleanup the module. */
		destroy() {
		}
	};

	/**
	 * Central overlay/controls manager for fields/sections.
	 * Pure UI composition; all actions route back into the builder instance.
	 */
	UI.WPBC_BFB_Overlay = class {

		/**
		 * Ensure an overlay exists and is wired up on the element.
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} el - field or section element
		 */
		static ensure( builder, el ) {

			if ( ! el ) {
				return;
			}
			const isSection = el.classList.contains( 'wpbc_bfb__section' );

			let overlay = el.querySelector( WPBC_BFB_DOM.SELECTORS.overlay );
			if ( ! overlay ) {
				overlay = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__overlay-controls' );
				el.prepend( overlay );
			}

			// Drag handle.
			if ( ! overlay.querySelector( '.wpbc_bfb__drag-handle' ) ) {
				const dragClass = isSection ? 'wpbc_bfb__drag-handle section-drag-handle' : 'wpbc_bfb__drag-handle';
				overlay.appendChild(
					WPBC_Form_Builder_Helper.create_element( 'span', dragClass, '<span class="wpbc_icn_drag_indicator"></span>' )
				);
			}

			// SETTINGS button (shown for both fields & sections).
			if ( ! overlay.querySelector( '.wpbc_bfb__settings-btn' ) ) {
				const settings_btn   = WPBC_Form_Builder_Helper.create_element( 'button', 'wpbc_bfb__settings-btn', '<i class="menu_icon icon-1x wpbc_icn_settings"></i>' );
				settings_btn.type    = 'button';
				settings_btn.title   = 'Open settings';
				settings_btn.onclick = (e) => {
					e.preventDefault();
					// Select THIS element and scroll it into view.
					builder.select_field( el, { scrollIntoView: true } );

					// Try to bring the inspector into view / focus first input.
					const ins = document.getElementById( 'wpbc_bfb__inspector' );
					if ( ins ) {
						ins.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
						// Focus first interactive control (best-effort).
						setTimeout( () => {
							const focusable = ins.querySelector( 'input,select,textarea,button,[contenteditable],[tabindex]:not([tabindex="-1"])' );
							focusable?.focus?.();
						}, 260 );
					}
				};

				overlay.appendChild( settings_btn );
			}

			overlay.setAttribute( 'role', 'toolbar' );
			overlay.setAttribute( 'aria-label', el.classList.contains( 'wpbc_bfb__section' ) ? 'Section tools' : 'Field tools' );

			return overlay;
		}
	};

	/**
	 * WPBC Layout Chips helper - visual layout picker (chips), e.g., "50%/50%", to a section overlay.
	 *
	 * Renders Equal/Presets/Custom chips into a host container and wires them to apply the layout.
	 */
	UI.WPBC_BFB_Layout_Chips = class {

		/** Read per-column min (px) from CSS var set by the guard. */
		static _get_col_min_px(col) {
			const v = getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0';
			const n = parseFloat( v );
			return Number.isFinite( n ) ? Math.max( 0, n ) : 0;
		}

		/**
		 * Turn raw weights (e.g. [1,1], [2,1,1]) into effective "available-%" bases that
		 * (a) sum to the row's available %, and (b) meet every column's min px.
		 * Returns an array of bases (numbers) or null if impossible to satisfy mins.
		 */
		static _fit_weights_respecting_min(builder, row, weights) {
			const cols = Array.from( row.querySelectorAll( ':scope > .wpbc_bfb__column' ) );
			const n    = cols.length;
			if ( !n ) return null;
			if ( !Array.isArray( weights ) || weights.length !== n ) return null;

			// available % after gaps (from LayoutService)
			const gp       = builder.col_gap_percent;
			const eff      = builder.layout.compute_effective_bases_from_row( row, gp );
			const availPct = eff.available;               // e.g. 94 if 2 cols and 3% gap
			const rowPx    = row.getBoundingClientRect().width;
			const availPx  = rowPx * (availPct / 100);

			// collect minima in % of "available"
			const minPct = cols.map( (c) => {
				const minPx = UI.WPBC_BFB_Layout_Chips._get_col_min_px( c );
				if ( availPx <= 0 ) return 0;
				return (minPx / availPx) * availPct;
			} );

			// If mins alone don't fit, bail.
			const sumMin = minPct.reduce( (a, b) => a + b, 0 );
			if ( sumMin > availPct - 1e-6 ) {
				return null; // impossible to respect mins; don't apply preset
			}

			// Target percentages from weights, normalized to availPct.
			const wSum      = weights.reduce( (a, w) => a + (Number( w ) || 0), 0 ) || n;
			const targetPct = weights.map( (w) => ((Number( w ) || 0) / wSum) * availPct );

			// Lock columns that would be below min, then distribute the remainder
			// across the remaining columns proportionally to their targetPct.
			const locked  = new Array( n ).fill( false );
			let lockedSum = 0;
			for ( let i = 0; i < n; i++ ) {
				if ( targetPct[i] < minPct[i] ) {
					locked[i] = true;
					lockedSum += minPct[i];
				}
			}

			let remaining     = availPct - lockedSum;
			const freeIdx     = [];
			let freeTargetSum = 0;
			for ( let i = 0; i < n; i++ ) {
				if ( !locked[i] ) {
					freeIdx.push( i );
					freeTargetSum += targetPct[i];
				}
			}

			const result = new Array( n ).fill( 0 );
			// Seed locked with their minima.
			for ( let i = 0; i < n; i++ ) {
				if ( locked[i] ) result[i] = minPct[i];
			}

			if ( freeIdx.length === 0 ) {
				// everything locked exactly at min; any leftover (shouldn't happen)
				// would be ignored to keep simplicity and stability.
				return result;
			}

			if ( remaining <= 0 ) {
				// nothing left to distribute; keep exactly mins on locked,
				// nothing for free (degenerate but consistent)
				return result;
			}

			if ( freeTargetSum <= 0 ) {
				// distribute equally among free columns
				const each = remaining / freeIdx.length;
				freeIdx.forEach( (i) => (result[i] = each) );
				return result;
			}

			// Distribute remaining proportionally to free columns' targetPct
			freeIdx.forEach( (i) => {
				result[i] = remaining * (targetPct[i] / freeTargetSum);
			} );
			return result;
		}

		/** Apply a preset but guard it by minima; returns true if applied, false if skipped. */
		static _apply_preset_with_min_guard(builder, section_el, weights) {
			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( !row ) return false;

			const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min( builder, row, weights );
			if ( !fitted ) {
				builder?._announce?.( 'Not enough space for this layout because of fields’ minimum widths.' );
				return false;
			}

			// `fitted` already sums to the row’s available %, so we can apply bases directly.
			builder.layout.apply_bases_to_row( row, fitted );
			return true;
		}


		/**
		 * Build and append layout chips for a section.
		 *
		 * @param {WPBC_Form_Builder} builder - The form builder instance.
		 * @param {HTMLElement} section_el - The .wpbc_bfb__section element.
		 * @param {HTMLElement} host_el - Container where chips should be rendered.
		 * @returns {void}
		 */
		static render_for_section(builder, section_el, host_el) {

			if ( ! builder || ! section_el || ! host_el ) {
				return;
			}

			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( ! row ) {
				return;
			}

			const cols = row.querySelectorAll( ':scope > .wpbc_bfb__column' ).length || 1;

			// Clear host.
			host_el.innerHTML = '';

			// Equal chip.
			host_el.appendChild(
				UI.WPBC_BFB_Layout_Chips._make_chip( builder, section_el, Array( cols ).fill( 1 ), 'Equal' )
			);

			// Presets based on column count.
			const presets = builder.layout.build_presets_for_columns( cols );
			presets.forEach( (weights) => {
				host_el.appendChild(
					UI.WPBC_BFB_Layout_Chips._make_chip( builder, section_el, weights, null )
				);
			} );

			// Custom chip.
			const customBtn       = document.createElement( 'button' );
			customBtn.type        = 'button';
			customBtn.className   = 'wpbc_bfb__layout_chip';
			customBtn.textContent = 'Custom…';
			customBtn.title       = `Enter ${cols} percentages`;
			customBtn.addEventListener( 'click', () => {
				const example = (cols === 2) ? '50,50' : (cols === 3 ? '20,60,20' : '25,25,25,25');
				const text    = prompt( `Enter ${cols} percentages (comma or space separated):`, example );
				if ( text == null ) return;
				const weights = builder.layout.parse_weights( text );
				if ( weights.length !== cols ) {
					alert( `Please enter exactly ${cols} numbers.` );
					return;
				}
				// OLD:
				// builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );
				// Guarded apply:.
				if ( ! UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard( builder, section_el, weights ) ) {
					return;
				}
				host_el.querySelectorAll( '.wpbc_bfb__layout_chip' ).forEach( c => c.classList.remove( 'is-active' ) );
				customBtn.classList.add( 'is-active' );
			} );
			host_el.appendChild( customBtn );
		}

		/**
		 * Create a single layout chip button.
		 *
		 * @private
		 * @param {WPBC_Form_Builder} builder
		 * @param {HTMLElement} section_el
		 * @param {number[]} weights
		 * @param {string|null} label
		 * @returns {HTMLButtonElement}
		 */
		static _make_chip(builder, section_el, weights, label = null) {

			const btn     = document.createElement( 'button' );
			btn.type      = 'button';
			btn.className = 'wpbc_bfb__layout_chip';

			const title = label || builder.layout.format_preset_label( weights );
			btn.title   = title;

			// Visual miniature.
			const vis     = document.createElement( 'div' );
			vis.className = 'wpbc_bfb__layout_chip-vis';
			const sum     = weights.reduce( (a, b) => a + (Number( b ) || 0), 0 ) || 1;
			weights.forEach( (w) => {
				const bar      = document.createElement( 'span' );
				bar.style.flex = `0 0 calc( ${((Number( w ) || 0) / sum * 100).toFixed( 3 )}% - 1.5px )`;
				vis.appendChild( bar );
			} );
			btn.appendChild( vis );

			const txt       = document.createElement( 'span' );
			txt.className   = 'wpbc_bfb__layout_chip-label';
			txt.textContent = label || builder.layout.format_preset_label( weights );
			btn.appendChild( txt );

			btn.addEventListener( 'click', () => {
				// OLD:
				// builder.layout.apply_layout_preset( section_el, weights, builder.col_gap_percent );

				// NEW:
				if ( !UI.WPBC_BFB_Layout_Chips._apply_preset_with_min_guard( builder, section_el, weights ) ) {
					return; // do not toggle active if we didn't change layout
				}

				btn.parentElement?.querySelectorAll( '.wpbc_bfb__layout_chip' ).forEach( c => c.classList.remove( 'is-active' ) );
				btn.classList.add( 'is-active' );
			} );

			return btn;
		}
	};

	/**
	 * Selection controller for fields and announcements.
	 */
	UI.WPBC_BFB_Selection_Controller = class extends UI.WPBC_BFB_Module {

		init() {

			this._selected_uid              = null;
			this.builder.select_field       = this.select_field.bind( this );
			this.builder.get_selected_field = this.get_selected_field.bind( this );
			this._on_clear                  = this.on_clear.bind( this );
			this.builder.bus.on( WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear );
			// delegated click selection (capture ensures we win before bubbling to containers).
			this._on_canvas_click = this._handle_canvas_click.bind( this );
			this.builder.pages_container.addEventListener( 'click', this._on_canvas_click, true );
		}

		destroy() {
			this.builder.bus.off( WPBC_BFB_Events.CLEAR_SELECTION, this._on_clear );

			if ( this._on_canvas_click ) {
				this.builder.pages_container.removeEventListener( 'click', this._on_canvas_click, true );
				this._on_canvas_click = null;
			}
		}

		/**
		 * Delegated canvas click -> select closest field/section (inner beats outer).
		 * @private
		 * @param {MouseEvent} e
		 */
		_handle_canvas_click(e) {
			const root = this.builder.pages_container;
			if ( !root ) return;

			// Ignore clicks on controls/handles/resizers, etc.
			const IGNORE = [
				'.wpbc_bfb__overlay-controls',
				'.wpbc_bfb__layout_picker',
				'.wpbc_bfb__drag-handle',
				'.wpbc_bfb__field-remove-btn',
				'.wpbc_bfb__field-move-up',
				'.wpbc_bfb__field-move-down',
				'.wpbc_bfb__column-resizer'
			].join( ',' );

			if ( e.target.closest( IGNORE ) ) {
				return; // let those controls do their own thing.
			}

			// Find the closest selectable (field OR section) from the click target.
			const hit = e.target.closest?.(
				`${WPBC_BFB_DOM.SELECTORS.validField}, ${WPBC_BFB_DOM.SELECTORS.section}`
			);

			if ( ! hit || ! root.contains( hit ) ) {
				return; // empty space is handled elsewhere.
			}

			// Select and stop bubbling so outer containers don’t reselect a parent.
			this.select_field( hit );
			e.stopPropagation();
		}


		/**
		 * Select a field element or clear selection.
		 *
		 * @param {HTMLElement|null} field_el
		 * @param {{scrollIntoView?: boolean}} [opts = {}]
		 */
		select_field( field_el, { scrollIntoView = false } = {} ) {
			const root = this.builder.pages_container;
			// Ignore elements not in the canvas.
			if ( field_el && ! root.contains( field_el ) ) {
				field_el = null; // treat as "no selection".
			}
			root.querySelectorAll( '.is-selected' ).forEach( ( n ) => {
				n.classList.remove( 'is-selected' );
			} );
			if ( ! field_el ) {
				const prev = this._selected_uid || null;
				this._selected_uid = null;
				this.builder.inspector?.clear?.();
				root.classList.remove( 'has-selection' );
				this.builder.bus.emit( WPBC_BFB_Events.CLEAR_SELECTION, { prev_uid: prev, source: 'builder' } );
				return;
			}
			field_el.classList.add( 'is-selected' );
			this._selected_uid = field_el.getAttribute( 'data-uid' ) || null;
			if ( scrollIntoView ) {
				field_el.scrollIntoView( { behavior: 'smooth', block: 'center' } );
			}
			this.builder.inspector?.bind_to_field?.( field_el );
			root.classList.add( 'has-selection' );
			this.builder.bus.emit( WPBC_BFB_Events.SELECT, { uid: this._selected_uid, el: field_el } );
			const label = field_el?.querySelector( '.wpbc_bfb__field-label' )?.textContent || (field_el.classList.contains( 'wpbc_bfb__section' ) ? 'section' : '') || field_el?.dataset?.id || 'item';
			this.builder._announce( 'Selected ' + label + '.' );
		}
		/** @returns {HTMLElement|null} */
		get_selected_field() {
			if ( !this._selected_uid ) {
				return null;
			}
			const esc_attr = WPBC_BFB_Sanitize.esc_attr_value_for_selector( this._selected_uid );
			return this.builder.pages_container.querySelector( `.wpbc_bfb__field[data-uid="${esc_attr}"], .wpbc_bfb__section[data-uid="${esc_attr}"]` );
		}

		/** @param {CustomEvent} ev */
		on_clear( ev ) {
			const src = ev?.detail?.source;
			if ( src !== 'builder' ) {
				this.select_field( null );
			}
		}
	};

	/**
	 * Bridges the builder with the Inspector and sanitizes id/name edits.
	 */
	UI.WPBC_BFB_Inspector_Bridge = class extends UI.WPBC_BFB_Module {
		init() {
			this._attach_inspector();
			this._bind_id_sanitizer();
		}
		_attach_inspector() {
			const b      = this.builder;
			const attach = () => {
				if ( typeof window.WPBC_BFB_Inspector === 'function' ) {
					b.inspector = new WPBC_BFB_Inspector( document.getElementById( 'wpbc_bfb__inspector' ), b );
					this._bind_id_sanitizer();
					document.removeEventListener( 'wpbc_bfb_inspector_ready', attach );
				}
			};
			// Ensure we bind after late ready as well.
			if ( typeof window.WPBC_BFB_Inspector === 'function' ) {
				attach();
			} else {
				b.inspector = { bind_to_field() {}, clear() {} };
				document.addEventListener( 'wpbc_bfb_inspector_ready', attach );
				setTimeout( attach, 0 );
			}
		}
		_bind_id_sanitizer() {
			const b   = this.builder;
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			if ( ! ins ) {
				return;
			}
			/** @param {Event} e */
			const handler = ( e ) => {

				const t = e.target;
				if ( ! t || ! ( 'value' in t ) ) {
					return;
				}
				const key = ( t.dataset?.inspectorKey || '' ).toLowerCase();
				if ( key !== 'name' && key !== 'html_id' && key !== 'id' ) {
					return;
				}
				const sel = b.get_selected_field?.();
				if ( ! sel ) {
					return;
				}
				if ( key === 'name' ) {
					const unique = b.id.set_field_name( sel, t.value );
					if ( b.preview_mode ) {
						b.render_preview( sel );
					}
					if ( t.value !== unique ) {
						t.value = unique;
					}
					return;
				}
				if ( key === 'id' ) {
					const unique = b.id.set_field_id( sel, t.value );
					if ( b.preview_mode ) {
						b.render_preview( sel );
					}
					if ( t.value !== unique ) {
						t.value = unique;
					}
					return;
				}
				if ( key === 'html_id' ) {
					const applied = b.id.set_field_html_id( sel, t.value );
					if ( b.preview_mode ) {
						b.render_preview( sel );
					}
					if ( t.value !== applied ) {
						t.value = applied;
					}
					return;
				}
			};
			ins.addEventListener( 'change', handler, true );
		}
	};

	/**
	 * Keyboard shortcuts for selection, deletion, and movement.
	 */
	UI.WPBC_BFB_Keyboard_Controller = class extends UI.WPBC_BFB_Module {
		init() {
			this._on_key = this.on_key.bind( this );
			document.addEventListener( 'keydown', this._on_key, true );
		}
		destroy() {
			document.removeEventListener( 'keydown', this._on_key, true );
		}
		/** @param {KeyboardEvent} e */
		on_key( e ) {
			const b = this.builder;
			const is_typing = this._is_typing_anywhere();
			if ( e.key === 'Escape' ) {
				if ( is_typing ) {
					return;
				}
				document.dispatchEvent(
					new CustomEvent( WPBC_BFB_Events.CLEAR_SELECTION, { detail: { source: 'esc' }, bubbles: true } )
				);
				return;
			}
			const selected = b.get_selected_field?.();
			if ( ! selected || is_typing ) {
				return;
			}
			if ( e.key === 'Delete' || e.key === 'Backspace' ) {
				e.preventDefault();
				const neighbor = b._find_neighbor_selectable?.( selected );
				selected.remove();
				b.bus.emit( WPBC_BFB_Events.FIELD_REMOVE, { id: selected?.dataset?.id, uid: selected?.dataset?.uid } );
				b.usage.update_palette_ui();
				b.select_field( neighbor || null );
				return;
			}
			if ( ( e.altKey || e.ctrlKey || e.metaKey ) && ( e.key === 'ArrowUp' || e.key === 'ArrowDown' ) && ! e.shiftKey ) {
				e.preventDefault();
				const dir = ( e.key === 'ArrowUp' ) ? 'up' : 'down';
				b.move_item?.( selected, dir );
				return;
			}
			if ( e.key === 'Enter' ) {
				e.preventDefault();
				b.select_field( selected, { scrollIntoView: true } );
			}
		}
		/** @returns {boolean} */
		_is_typing_anywhere() {
			const a = document.activeElement;
			const tag = a?.tagName;
			if ( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || ( a?.isContentEditable === true ) ) {
				return true;
			}
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			return !!( ins && a && ins.contains( a ) );
		}
	};

	/**
	 * Column resize logic for section rows.
	 */
	UI.WPBC_BFB_Resize_Controller = class extends UI.WPBC_BFB_Module {
		init() {
			this.builder.init_resize_handler = this.handle_resize.bind( this );
		}

		/**
		 * read the CSS var (kept local so it doesn’t depend on the Min-Width module)
		 *
		 * @param col
		 * @returns {number|number}
		 * @private
		 */
		_get_col_min_px(col) {
			const v = getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0';
			const n = parseFloat( v );
			return Number.isFinite( n ) ? Math.max( 0, n ) : 0;
		}

		/** @param {MouseEvent} e */
		handle_resize(e) {
			const b = this.builder;
			e.preventDefault();
			if ( e.button !== 0 ) return;

			const resizer   = e.currentTarget;
			const row_el    = resizer.parentElement;
			const cols      = Array.from( row_el.querySelectorAll( ':scope > .wpbc_bfb__column' ) );
			const left_col  = resizer?.previousElementSibling;
			const right_col = resizer?.nextElementSibling;
			if ( !left_col || !right_col || !left_col.classList.contains( 'wpbc_bfb__column' ) || !right_col.classList.contains( 'wpbc_bfb__column' ) ) return;

			const left_index  = cols.indexOf( left_col );
			const right_index = cols.indexOf( right_col );
			if ( left_index === -1 || right_index !== left_index + 1 ) return;

			const start_x        = e.clientX;
			const left_start_px  = left_col.getBoundingClientRect().width;
			const right_start_px = right_col.getBoundingClientRect().width;
			const pair_px        = Math.max( 0, left_start_px + right_start_px );

			const gp         = b.col_gap_percent;
			const computed   = b.layout.compute_effective_bases_from_row( row_el, gp );
			const available  = computed.available;                 // % of the “full 100” after gaps
			const bases      = computed.bases.slice( 0 );            // current effective %
			const pair_avail = bases[left_index] + bases[right_index];

			// --- MIN CLAMPS (pixels) -------------------------------------------------
			const pctToPx       = (pct) => (pair_px * (pct / pair_avail)); // pair-local percent → px
			const genericMinPct = Math.min( 5, available );                  // original 5% floor (in “available %” space)
			const genericMinPx  = pctToPx( genericMinPct );

			const leftMinPx  = Math.max( this._get_col_min_px( left_col ), genericMinPx );
			const rightMinPx = Math.max( this._get_col_min_px( right_col ), genericMinPx );

			// freeze text selection + cursor
			const prev_user_select         = document.body.style.userSelect;
			document.body.style.userSelect = 'none';
			row_el.style.cursor            = 'col-resize';

			const on_mouse_move = (ev) => {
				if ( !pair_px ) return;

				// work in pixels, clamp by each side’s min
				const delta_px   = ev.clientX - start_x;
				let newLeftPx    = left_start_px + delta_px;
				newLeftPx        = Math.max( leftMinPx, Math.min( pair_px - rightMinPx, newLeftPx ) );
				const newRightPx = pair_px - newLeftPx;

				// translate back to pair-local percentages
				const newLeftPct      = (newLeftPx / pair_px) * pair_avail;
				const newBases        = bases.slice( 0 );
				newBases[left_index]  = newLeftPct;
				newBases[right_index] = pair_avail - newLeftPct;

				b.layout.apply_bases_to_row( row_el, newBases );
			};

			const on_mouse_up = () => {
				document.removeEventListener( 'mousemove', on_mouse_move );
				document.removeEventListener( 'mouseup', on_mouse_up );
				window.removeEventListener( 'mouseup', on_mouse_up );
				document.removeEventListener( 'mouseleave', on_mouse_up );
				document.body.style.userSelect = prev_user_select || '';
				row_el.style.cursor            = '';

				// normalize to the row’s available % again
				const normalized = b.layout.compute_effective_bases_from_row( row_el, gp );
				b.layout.apply_bases_to_row( row_el, normalized.bases );
			};

			document.addEventListener( 'mousemove', on_mouse_move );
			document.addEventListener( 'mouseup', on_mouse_up );
			window.addEventListener( 'mouseup', on_mouse_up );
			document.addEventListener( 'mouseleave', on_mouse_up );
		}

	};

	/**
	 * Page and section creation, rebuilding, and nested Sortable setup.
	 */
	UI.WPBC_BFB_Pages_Sections = class extends UI.WPBC_BFB_Module {
		init() {
			this.builder.add_page = ( opts ) => this.add_page( opts );
			this.builder.add_section = ( container, cols ) => this.add_section( container, cols );
			this.builder.rebuild_section = ( section_data, container ) => this.rebuild_section( section_data, container );
			this.builder.init_all_nested_sortables = ( el ) => this.init_all_nested_sortables( el );
			this.builder.init_section_sortable = ( el ) => this.init_section_sortable( el );
			this.builder.pages_sections = this;
		}

		_make_add_columns_control(page_el, section_container) {

			const tpl = document.getElementById( 'wpbc_bfb__add_columns_template' );
			if ( ! tpl ) { return null; }

			// Clone *contents* (not the id), unhide, and add a page-scoped class.
			const src  = (tpl.content && tpl.content.firstElementChild) ? tpl.content.firstElementChild : tpl.firstElementChild;
			if ( ! src ) { return null; }
			const clone = src.cloneNode( true );
			clone.removeAttribute( 'hidden' );

			// If any inline onclick snuck in, strip it (defensive).
			clone.querySelectorAll( '[onclick]' ).forEach( n => n.removeAttribute( 'onclick' ) );

			// Click on options - add section with N columns.
			clone.addEventListener( 'click', (e) => {
				const a = e.target.closest( '.ul_dropdown_menu_li_action_add_sections' );
				if ( ! a ) {
					return;
				}
				e.preventDefault();

				// Read N either from data-cols or fallback to parsing text like "3 Columns".
				let cols = parseInt( a.dataset.cols || (a.textContent.match( /\b(\d+)\s*Column/i )?.[1] ?? '1'), 10 );
				cols     = Math.max( 1, Math.min( 4, cols ) );

				this.add_section( section_container, cols );

				// Optional: reflect last choice.
				const val = clone.querySelector( '.selected_value' );
				if ( val ) {
					val.textContent = `(${cols})`;
				}
			} );

			return clone;
		}

		/**
		 * @param {{scroll?: boolean}} [opts = {}]
		 * @returns {HTMLElement}
		 */
		add_page( { scroll = true } = {} ) {
			const b = this.builder;
			const page_el = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__panel wpbc_bfb__panel--preview  wpbc_container wpbc_form wpbc_container_booking_form' );
			page_el.setAttribute( 'data-page', ++b.page_counter );

			// Keep only the title and the section container placeholders here.
			page_el.innerHTML = `
				<div class="wpbc_bfb__controls"><h3>Page ${b.page_counter}</h3></div>
				<div class="wpbc_bfb__form_preview_section_container wpbc_wizard__border_container"></div>
			  `;

			const delete_btn = WPBC_Form_Builder_Helper.create_element( 'button', 'wpbc_bfb__field-remove-btn', '<i class="menu_icon icon-1x wpbc_icn_close"></i>' );
			delete_btn.type = 'button';
			delete_btn.title = 'Remove page';
			delete_btn.setAttribute( 'aria-label', 'Remove page' );
			delete_btn.onclick = () => {
				const selected = b.get_selected_field?.();
				let neighbor = null;
				if ( selected && page_el.contains( selected ) ) {
					neighbor = b.pages_container.querySelector( '.wpbc_bfb__panel--preview:not([data-page="' + page_el.getAttribute( 'data-page' ) + '"]) .wpbc_bfb__field:not(.is-invalid)' );
				}
				page_el.remove();
				b.usage.update_palette_ui();
				b.select_field( neighbor || null );
			};
			page_el.querySelector( 'h3' ).appendChild( delete_btn );

			b.pages_container.appendChild( page_el );
			if ( scroll ) {
				page_el.scrollIntoView( { behavior: 'smooth', block: 'start' } );
			}

			const section_container          = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
			const section_coount_on_add_page = 2;
			this.init_section_sortable( section_container );
			this.add_section( section_container, section_coount_on_add_page );

			// dropdown control cloned from the hidden template.
			const controlsHost  = page_el.querySelector( '.wpbc_bfb__controls' );
			const customControl = this._make_add_columns_control( page_el, section_container );
			if ( customControl ) {
				controlsHost.appendChild( customControl );
			}
			return page_el;
		}
		/**
		 * @param {HTMLElement} container
		 * @param {number} cols
		 */
		add_section( container, cols ) {
			const b = this.builder;
			cols = Math.max( 1, parseInt( cols, 10 ) || 1 );
			const section = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__section' );
			section.setAttribute( 'data-id', `section-${ ++b.section_counter }-${ Date.now() }` );
			section.setAttribute( 'data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}` );
			const row = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__row wpbc__row' );
			for ( let i = 0; i < cols; i++ ) {
				const col = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column wpbc__field' );
				col.style.flexBasis = ( 100 / cols ) + '%';
				b.init_sortable?.( col );
				row.appendChild( col );
				if ( i < cols - 1 ) {
					const resizer = WPBC_Form_Builder_Helper.create_element( 'div', 'wpbc_bfb__column-resizer' );
					resizer.addEventListener( 'mousedown', b.init_resize_handler );
					row.appendChild( resizer );
				}
			}
			section.appendChild( row );
			b.layout.set_equal_bases( row, b.col_gap_percent );
			b.add_overlay_toolbar( section );
			container.appendChild( section );
			section.setAttribute( 'tabindex', '0' ); // optional: keyboard focusability.
			this.init_all_nested_sortables( section );
		}
		/**
		 * @param {Object} section_data
		 * @param {HTMLElement} container
		 */
		rebuild_section( section_data, container ) {
			const b = this.builder;
			const cols_data = Array.isArray( section_data?.columns ) ? section_data.columns : [];
			this.add_section( container, cols_data.length || 1 );
			const section = container.lastElementChild;
			if ( ! section.dataset.uid ) {
				section.setAttribute( 'data-uid', `s-${++b._uid_counter}-${Date.now()}-${Math.random().toString( 36 ).slice( 2, 7 )}` );
			}
			section.setAttribute( 'data-id', section_data?.id || `section-${ ++b.section_counter }-${ Date.now() }` );
			const row = section.querySelector( '.wpbc_bfb__row' );
			cols_data.forEach( ( col_data, index ) => {
				const columns_only = row.querySelectorAll( ':scope > .wpbc_bfb__column' );
				const col = columns_only[ index ];
				col.style.flexBasis = col_data.width || '100%';
				( col_data.items || [] ).forEach( ( item ) => {
					if ( ! item || ! item.type ) {
						return;
					}
					if ( item.type === 'field' ) {
						const el = b.build_field( item.data );
						if ( el ) {
							col.appendChild( el );
							b.trigger_field_drop_callback( el, 'load' );
						}
						return;
					}
					if ( item.type === 'section' ) {
						this.rebuild_section( item.data, col );
					}
				} );
			} );
			const computed = b.layout.compute_effective_bases_from_row( row, b.col_gap_percent );
			b.layout.apply_bases_to_row( row, computed.bases );
			this.init_all_nested_sortables( section );
		}
		/** @param {HTMLElement} container */
		init_all_nested_sortables( container ) {
			const b = this.builder;
			if ( container.classList.contains( 'wpbc_bfb__form_preview_section_container' ) ) {
				this.init_section_sortable( container );
			}
			container.querySelectorAll( '.wpbc_bfb__section' ).forEach( ( section ) => {
				section.querySelectorAll( '.wpbc_bfb__column' ).forEach( ( col ) => {
					this.init_section_sortable( col );
				} );
			} );
		}
		/** @param {HTMLElement} container */
		init_section_sortable( container ) {
			const b = this.builder;
			if ( ! container ) {
				return;
			}
			const is_column = container.classList.contains( 'wpbc_bfb__column' );
			const is_top_level = container.classList.contains( 'wpbc_bfb__form_preview_section_container' );
			if ( ! is_column && ! is_top_level ) {
				return;
			}
			b.init_sortable?.( container );
		}
	};

	/**
	 * Serialization and deserialization of pages/sections/fields.
	 */
	UI.WPBC_BFB_Structure_IO = class extends UI.WPBC_BFB_Module {
		init() {
			this.builder.get_structure = () => this.serialize();
			this.builder.load_saved_structure = ( s, opts ) => this.deserialize( s, opts );
		}
		/** @returns {Array} */
		serialize() {
			const b = this.builder;
			this._normalize_ids();
			this._normalize_names();
			const pages = [];
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview' ).forEach( ( page_el, page_index ) => {
				const container = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
				const content = [];
				if ( ! container ) {
					pages.push( { page: page_index + 1, content } );
					return;
				}
				container.querySelectorAll( ':scope > *' ).forEach( ( child ) => {
					if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
						content.push( { type: 'section', data: this.serialize_section( child ) } );
						return;
					}
					if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
						if ( child.classList.contains( 'is-invalid' ) ) {
							return;
						}
						const f_data = WPBC_Form_Builder_Helper.get_all_data_attributes( child );
						delete f_data.uid;
						content.push( { type: 'field', data: f_data } );
					}
				} );
				pages.push( { page: page_index + 1, content } );
			} );
			return pages;
		}
		/**
		 * @param {HTMLElement} section_el
		 * @returns {{id:string, columns:Array}}
		 */
		serialize_section( section_el ) {
			const row = section_el.querySelector( ':scope > .wpbc_bfb__row' );
			if ( ! row ) {
				return { id: section_el.dataset.id, columns: [] };
			}
			const columns = [];
			row.querySelectorAll( ':scope > .wpbc_bfb__column' ).forEach( ( col ) => {
				const width = col.style.flexBasis || '100%';
				const items = [];
				Array.from( col.children ).forEach( ( child ) => {
					if ( child.classList.contains( 'wpbc_bfb__section' ) ) {
						items.push( { type: 'section', data: this.serialize_section( child ) } );
						return;
					}
					if ( child.classList.contains( 'wpbc_bfb__field' ) ) {
						if ( child.classList.contains( 'is-invalid' ) ) {
							return;
						}
						const f_data = WPBC_Form_Builder_Helper.get_all_data_attributes( child );
						delete f_data.uid;
						items.push( { type: 'field', data: f_data } );
					}
				} );
				columns.push( { width, items } );
			} );
			return { id: section_el.dataset.id, columns };
		}
		/**
		 * @param {Array} structure
		 * @param {{deferIfTyping?: boolean}} [opts = {}]
		 */
		deserialize( structure, { deferIfTyping = true } = {} ) {
			const b = this.builder;
			if ( deferIfTyping && this._is_typing_in_inspector() ) {
				clearTimeout( this._defer_timer );
				this._defer_timer = setTimeout( () => {
					this.deserialize( structure, { deferIfTyping: false } );
				}, 150 );
				return;
			}
			b.pages_container.innerHTML = '';
			b.page_counter = 0;
			( structure || [] ).forEach( ( page_data ) => {
				const page_el = b.pages_sections.add_page( { scroll: false } );
				const section_container = page_el.querySelector( '.wpbc_bfb__form_preview_section_container' );
				section_container.innerHTML = '';
				b.init_section_sortable?.( section_container );
				( page_data.content || [] ).forEach( ( item ) => {
					if ( item.type === 'section' ) {
						b.pages_sections.rebuild_section( item.data, section_container );
						return;
					}
					if ( item.type === 'field' ) {
						const el = b.build_field( item.data );
						if ( el ) {
							section_container.appendChild( el );
							b.trigger_field_drop_callback( el, 'load' );
						}
					}
				} );
			} );
			b.usage.update_palette_ui();
			b.bus.emit( WPBC_BFB_Events.STRUCTURE_LOADED, { structure } );
		}
		_normalize_ids() {
			const b = this.builder;
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)' ).forEach( ( el ) => {
				const data = WPBC_Form_Builder_Helper.get_all_data_attributes( el );
				const want = WPBC_BFB_Sanitize.sanitize_html_id( data.id || '' ) || 'field';
				const uniq = b.id.ensure_unique_field_id( want, el );
				if ( data.id !== uniq ) {
					el.setAttribute( 'data-id', uniq );
					if ( b.preview_mode ) {
						b.render_preview( el );
					}
				}
			} );
		}
		_normalize_names() {
			const b = this.builder;
			b.pages_container.querySelectorAll( '.wpbc_bfb__panel--preview .wpbc_bfb__field:not(.is-invalid)' ).forEach( ( el ) => {
				const data = WPBC_Form_Builder_Helper.get_all_data_attributes( el );
				const base = WPBC_BFB_Sanitize.sanitize_html_name( ( data.name != null ) ? data.name : data.id ) || 'field';
				const uniq = b.id.ensure_unique_field_name( base, el );
				if ( data.name !== uniq ) {
					el.setAttribute( 'data-name', uniq );
					if ( b.preview_mode ) {
						b.render_preview( el );
					}
				}
			} );
		}
		/** @returns {boolean} */
		_is_typing_in_inspector() {
			const ins = document.getElementById( 'wpbc_bfb__inspector' );
			return !!( ins && document.activeElement && ins.contains( document.activeElement ) );
		}
	};


	/**
	 * Minimal, standalone guard that enforces per-column min widths based on fields' data-min_width.
	 *
	 * @type {UI.WPBC_BFB_Min_Width_Guard}
	 */
	UI.WPBC_BFB_Min_Width_Guard = class extends UI.WPBC_BFB_Module {

		constructor(builder) {
			super( builder );
			this._on_field_add        = this._on_field_add.bind( this );
			this._on_field_remove     = this._on_field_remove.bind( this );
			this._on_structure_loaded = this._on_structure_loaded.bind( this );
			this._on_window_resize    = this._on_window_resize.bind( this );
		}

		init() {
			const EV = WPBC_BFB_Events;
			this.builder?.bus?.on?.( EV.FIELD_ADD, this._on_field_add );
			this.builder?.bus?.on?.( EV.FIELD_REMOVE, this._on_field_remove );
			this.builder?.bus?.on?.( EV.STRUCTURE_LOADED, this._on_structure_loaded );
			window.addEventListener( 'resize', this._on_window_resize, { passive: true } );
			this.refresh_all();
		}

		destroy() {
			const EV = WPBC_BFB_Events;
			this.builder?.bus?.off?.( EV.FIELD_ADD, this._on_field_add );
			this.builder?.bus?.off?.( EV.FIELD_REMOVE, this._on_field_remove );
			this.builder?.bus?.off?.( EV.STRUCTURE_LOADED, this._on_structure_loaded );
			window.removeEventListener( 'resize', this._on_window_resize );
		}

		_on_field_add(e) {
			// safe + simple: moving between columns updates both rows
			this.refresh_all();
			// if you really want to be minimal work here, keep your row-only version.
		}

		_on_field_remove(e) {
			const src_el = e?.detail?.el || null;
			const row    = (src_el && src_el.closest) ? src_el.closest( '.wpbc_bfb__row' ) : null;
			if ( row ) this.refresh_row( row ); else this.refresh_all();
		}

		_on_structure_loaded() {
			this.refresh_all();
		}

		_on_window_resize() {
			this.refresh_all();
		}

		refresh_all() {
			this.builder?.pages_container
				?.querySelectorAll?.( '.wpbc_bfb__row' )
				?.forEach?.( (row) => this.refresh_row( row ) );
		}

		refresh_row(row_el) {
			if ( !row_el ) return;

			const cols = row_el.querySelectorAll( ':scope > .wpbc_bfb__column' );

			// 1) Recalculate each column’s required min px and write it to the CSS var.
			cols.forEach( (col) => this.apply_col_min( col ) );

			// 2) Enforce it at the CSS level right away so layout can’t render narrower.
			cols.forEach( (col) => {
				const px = parseFloat( getComputedStyle( col ).getPropertyValue( '--wpbc-col-min' ) || '0' ) || 0;
				col.style.minWidth = px > 0 ? Math.round( px ) + 'px' : '';
			} );

			// 3) Normalize current bases so the row respects all mins without overflow.
			try {
				const b   = this.builder;
				const gp  = b.col_gap_percent;
				const eff = b.layout.compute_effective_bases_from_row( row_el, gp );  // { bases, available }
				// Re-fit *current* bases against mins (same algorithm layout chips use).
				const fitted = UI.WPBC_BFB_Layout_Chips._fit_weights_respecting_min( b, row_el, eff.bases );
				if ( Array.isArray( fitted ) ) {
					const changed = fitted.some( (v, i) => Math.abs( v - eff.bases[i] ) > 0.01 );
					if ( changed ) {
						b.layout.apply_bases_to_row( row_el, fitted );
					}
				}
			} catch (_) { /* non-fatal */ }
		}

		apply_col_min(col_el) {
			if ( !col_el ) return;
			let max_px = 0;
			col_el.querySelectorAll( ':scope > .wpbc_bfb__field' ).forEach( (field) => {
				const raw = field.getAttribute( 'data-min_width' );
				let px    = 0;
				if ( raw ) {
					px = this.parse_len_px( raw );
				} else {
					const cs = getComputedStyle( field );
					px       = parseFloat( cs.minWidth || '0' ) || 0;
				}
				if ( px > max_px ) max_px = px;
			} );
			col_el.style.setProperty( '--wpbc-col-min', max_px > 0 ? Math.round( max_px ) + 'px' : '0px' );
		}

		parse_len_px(value) {
			if ( value == null ) return 0;
			const s = String( value ).trim().toLowerCase();
			if ( s === '' ) return 0;
			if ( s.endsWith( 'px' ) ) {
				const n = parseFloat( s );
				return Number.isFinite( n ) ? n : 0;
			}
			if ( s.endsWith( 'rem' ) || s.endsWith( 'em' ) ) {
				const n    = parseFloat( s );
				const base = parseFloat( getComputedStyle( document.documentElement ).fontSize ) || 16;
				return Number.isFinite( n ) ? n * base : 0;
			}
			const n = parseFloat( s );
			return Number.isFinite( n ) ? n : 0;
		}
	};


	w.WPBC_BFB_UI = UI;

} )( window );

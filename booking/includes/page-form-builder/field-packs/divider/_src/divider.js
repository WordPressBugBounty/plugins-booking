// File: /includes/page-form-builder/field-packs/divider/_out/divider.js
(function (w) {
	'use strict';

	/** @type {any} */
	var Core     = w.WPBC_BFB_Core || {};
	var registry = Core.WPBC_BFB_Field_Renderer_Registry;
	var Base     = Core.WPBC_BFB_Field_Base;

	if (!registry || typeof registry.register !== 'function' || !Base) {
		_wpbc?.dev?.error?.('wpbc_bfb_field_divider', 'Core registry/base missing');
		return;
	}

	/**
	 * WPBC BFB: Field Renderer for "divider" (Schema-driven)
	 * - Inspector is rendered by Factory (from PHP schema).
	 * - No wp.template usage for preview.
	 * - Renders either a horizontal <hr> or a vertical <div> with border-left.
	 */
	class wpbc_bfb_field_divider extends Base {

		/**
		 * Return default props for "divider" field.
		 * Must stay in sync with PHP schema defaults.
		 *
		 * @returns {{type:string,orientation:'horizontal'|'vertical',line_style:'solid'|'dashed'|'dotted',thickness_px:number,length:string,align:string,color:string,margin_top_px:number,margin_bottom_px:number,margin_left_px:number,margin_right_px:number,cssclass_extra:string,name:string,html_id:string,help:string,usage_key:string}}
		 */
		static get_defaults() {
			return {
				type            : 'divider',
				orientation     : 'horizontal', // 'horizontal' | 'vertical'
				line_style      : 'solid',      // 'solid' | 'dashed' | 'dotted'
				thickness_px    : 1,
				length          : '100%',       // width for horizontal, height for vertical
				align           : 'center',     // 'left' | 'center' | 'right' (or vertical equivalents; normalized later)
				color           : '#e0e0e0',
				margin_top_px   : 2,
				margin_bottom_px: 2,
				margin_left_px  : 2,
				margin_right_px : 2,
				cssclass_extra  : '',
				name            : '',
				html_id         : '',
				help            : '',
				usage_key       : 'divider'
			};
		}

		/**
		 * Normalize align tokens for the current orientation.
		 * - For horizontal: accepts left|center|right or top|middle|bottom → maps to left|center|right.
		 * - For vertical  : accepts top|middle|bottom or left|center|right → maps to top|middle|bottom.
		 *
		 * @param {'horizontal'|'vertical'} orientation
		 * @param {string|undefined|null} align_raw
		 * @returns {'left'|'center'|'right'|'top'|'middle'|'bottom'}
		 */
		static normalize_align(orientation, align_raw) {
			const a   = String(align_raw ?? '').toLowerCase();
			const H   = { top: 'left', middle: 'center', bottom: 'right' };
			const V   = { left: 'top', center: 'middle', right: 'bottom' };
			const isV = orientation === 'vertical';
			if (isV)  return (a in V) ? /** @type any */(V)[a] : (['top','middle','bottom'].includes(a) ? /** @type any */(a) : 'middle');
			return (a in H) ? /** @type any */(H)[a] : (['left','center','right'].includes(a) ? /** @type any */(a) : 'center');
		}

		/**
		 * Render the preview markup into the field element.
		 *
		 * @param {HTMLElement} el   Field root element inside the canvas.
		 * @param {Object}      data Field props (already normalized by schema).
		 * @param {{builder?:any, sanit?:any}} [ctx]  Context object.
		 * @returns {void}
		 */
		static render(el, data, ctx) {
			if (!el) return;

			// Normalize against defaults first.
			const d = this.normalize_data(data);

			// ----- Core sanitize helpers (static) -----
			const eh     = (v) => Core.WPBC_BFB_Sanitize.escape_html(v);
			const sid    = (v) => Core.WPBC_BFB_Sanitize.sanitize_html_id(v);
			const sname  = (v) => Core.WPBC_BFB_Sanitize.sanitize_html_name(v);
			const sclass = (v) => Core.WPBC_BFB_Sanitize.sanitize_css_classlist(v);

			/**
			 * @param {any} v
			 * @param {number} def
			 * @param {number} [min]
			 * @param {number} [max]
			 * @returns {number}
			 */
			const to_int = (v, def, min, max) => {
				let n = parseInt(v, 10);
				if (isNaN(n)) n = def;
				if (typeof min === 'number' && n < min) n = min;
				if (typeof max === 'number' && n > max) n = max;
				return n;
			};

			/**
			 * @param {any} v
			 * @param {string} def
			 * @returns {string}
			 */
			const to_str = (v, def) => (v === undefined || v === null) ? def : String(v);

			// Coerce props.
			/** @type {'horizontal'|'vertical'} */
			const orientation = (to_str(d.orientation, 'horizontal') === 'vertical') ? 'vertical' : 'horizontal';
			/** @type {'solid'|'dashed'|'dotted'} */
			const line_style  = ({ solid:1, dashed:1, dotted:1 }[ to_str(d.line_style, 'solid') ]) ? d.line_style : 'solid';
			const align_norm  = wpbc_bfb_field_divider.normalize_align(orientation, to_str(d.align, orientation === 'vertical' ? 'middle' : 'center')); // accept both sets, then normalize to the active orientation.
			const thickness_px = to_int(d.thickness_px, 1, 1, 20);
			const length_val   = Core.WPBC_BFB_Sanitize.sanitize_css_len(d.length, '100%');
			const color_val    = Core.WPBC_BFB_Sanitize.sanitize_hex_color(d.color, '#e0e0e0');

			const m_top    = to_int(d.margin_top_px, 8, 0, 200);
			const m_bottom = to_int(d.margin_bottom_px, 8, 0, 200);
			const m_left   = to_int(d.margin_left_px, 8, 0, 200);
			const m_right  = to_int(d.margin_right_px, 8, 0, 200);

			const html_id   = d.html_id ? sid(String(d.html_id)) : '';
			const name_val  = d.name    ? sname(String(d.name))  : '';
			const cls_extra = sclass(String(d.cssclass_extra || ''));

			// Persist useful props on dataset (do not mutate wrapper classes directly).
			if (el.dataset.orientation   !== orientation)   el.dataset.orientation   = orientation;
			if (el.dataset.line_style    !== line_style)    el.dataset.line_style    = line_style;
			if (String(el.dataset.thickness_px) !== String(thickness_px)) el.dataset.thickness_px = String(thickness_px);
			if (el.dataset.length        !== length_val)    el.dataset.length        = length_val;
			if (el.dataset.align         !== align_norm)    el.dataset.align         = align_norm;
			if (el.dataset.color         !== color_val)     el.dataset.color         = color_val;

			if (String(el.dataset.margin_top_px)    !== String(m_top))    el.dataset.margin_top_px    = String(m_top);
			if (String(el.dataset.margin_bottom_px) !== String(m_bottom)) el.dataset.margin_bottom_px = String(m_bottom);
			if (String(el.dataset.margin_left_px)   !== String(m_left))   el.dataset.margin_left_px   = String(m_left);
			if (String(el.dataset.margin_right_px)  !== String(m_right))  el.dataset.margin_right_px  = String(m_right);

			if (el.dataset.cssclass_extra !== cls_extra) el.dataset.cssclass_extra = cls_extra;
			if (el.dataset.html_id        !== html_id)   el.dataset.html_id        = html_id;
			if (el.dataset.name           !== name_val)  el.dataset.name           = name_val;

			// Attribute fragments for the line element.
			const id_attr   = html_id ? ` id="${eh(html_id)}"`   : '';
			const name_attr = name_val ? ` name="${eh(name_val)}"` : '';
			const cls_attr  = cls_extra ? ` class="${eh(cls_extra)}"` : '';

			// Compute style for margins (outer wrapper).
			const outer_style_attr = ` style="margin:${m_top}px ${m_right}px ${m_bottom}px ${m_left}px;"`;

			// Build inner line markup based on orientation.
			let line_html = '';
			if (orientation === 'horizontal') {
				// Horizontal: <hr> using border-top.
				const ml = (align_norm === 'left')  ? '0'   : 'auto';
				const mr = (align_norm === 'right') ? '0'   : 'auto';
				const hr_style = [
					'border:none',
					'height:0',
					`border-top:${thickness_px}px ${line_style} ${color_val}`,
					`width:${length_val}`,
					`margin-left:${ml}`,
					`margin-right:${mr}`
				].join(';');
				line_html = `<hr${cls_attr}${id_attr}${name_attr} style="${hr_style}">`;
			} else {
				// Vertical: <div> using border-left and height.
				let v_align = '';
				v_align = (align_norm === 'top')    ? 'position:absolute;top:0;' : v_align;
				v_align = (align_norm === 'middle') ? 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' : v_align;
				v_align = (align_norm === 'bottom') ? 'position:absolute;bottom:0;' : v_align;

				const vr_style = [
					`border-left:${thickness_px}px ${line_style} ${color_val}`,
					`height:${length_val}`,
					`${v_align}`,
					'padding-left:0'
				].join(';');
				line_html = `<div${cls_attr}${id_attr}${name_attr} role="separator" aria-orientation="vertical" style="${vr_style}"></div>`;
			}

			// Optional help text below the line.
			const help_html = d.help ? `<div class="wpbc_bfb__help">${eh(String(d.help))}</div>` : '';

			// Render preview HTML.
			el.innerHTML = `
				<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert="">
					<div class="wpbc_bfb__field-preview"${outer_style_attr}>
						${line_html}
					</div>
					${help_html}
				</span>
			`;

			// Overlay (handles/toolbars).
			Core.UI?.WPBC_BFB_Overlay?.ensure?.(ctx?.builder, el);
		}

		/**
		 * Optional hook executed after field is dropped from the palette.
		 *
		 * @param {Object}      data
		 * @param {HTMLElement} el
		 * @param {{palette_item?: HTMLElement}} [ctx]
		 * @returns {void}
		 */
		static on_field_drop(data, el, ctx) {
			// Keep base behavior (auto-name, etc.).
			super.on_field_drop?.(data, el, ctx);

			// Apply orientation from palette hint (data-orientation) once on drop.
			try {
				const src = ctx?.palette_item;
				if (src) {
					const ori = src.getAttribute('data-orientation');
					if (ori === 'horizontal' || ori === 'vertical') {
						el.dataset.orientation = ori;
					}
				}
			} catch (e) {}
		}
	}

	try {
		registry.register('divider', wpbc_bfb_field_divider);
	} catch (e) { _wpbc?.dev?.error?.('wpbc_bfb_field_divider.register', e); }


	// -----------------------------------------------------------------------------
	// Exporters – booking form + “Content of booking fields data”
	// -----------------------------------------------------------------------------

	/**
	 * Register booking form exporter for "divider".
	 * Mirrors the previous legacy export logic but now kept inside the pack.
	 */
	function register_divider_form_exporter() {
		if (!w.WPBC_BFB_Exporter || typeof w.WPBC_BFB_Exporter.register !== 'function') {
			return;
		}

		w.WPBC_BFB_Exporter.register('divider', function (field, emit, extras) {
			if (!field || typeof emit !== 'function') return;

			const core   = (extras && extras.core) || w.WPBC_BFB_Core || {};
			const Sanit  = core.WPBC_BFB_Sanitize || {};

			const esc_html  = Sanit.escape_html       ? Sanit.escape_html.bind(Sanit)       : (s) => String(s);
			const cls_sanit = Sanit.sanitize_css_classlist ? Sanit.sanitize_css_classlist.bind(Sanit) : (s) => String(s);
			const sid       = Sanit.sanitize_html_id  ? Sanit.sanitize_html_id.bind(Sanit)  : (s) => String(s);
			const sname     = Sanit.sanitize_html_name ? Sanit.sanitize_html_name.bind(Sanit) : (s) => String(s);

			/**
			 * @param {any} v
			 * @param {number} def
			 * @param {number} [min]
			 * @param {number} [max]
			 * @returns {number}
			 */
			const to_int = (v, def, min, max) => {
				let n = parseInt(v, 10);
				if (isNaN(n)) n = def;
				if (typeof min === 'number' && n < min) n = min;
				if (typeof max === 'number' && n > max) n = max;
				return n;
			};

			/**
			 * @param {any} v
			 * @param {string} def
			 * @returns {string}
			 */
			const to_str = (v, def) => (v == null || v === '') ? def : String(v);

			// Normalize against defaults (schema-driven).
			const d = wpbc_bfb_field_divider.normalize_data(field);

			// ---- read & sanitize props (keep in sync with preview/schema) ----
			/** @type {'horizontal'|'vertical'} */
			const orientation   = (to_str(d.orientation, 'horizontal') === 'vertical') ? 'vertical' : 'horizontal';
			const line_style_in = to_str(d.line_style, 'solid');
			/** @type {'solid'|'dashed'|'dotted'} */
			const line_style    = ({ solid:1, dashed:1, dotted:1 })[ line_style_in ] ? line_style_in : 'solid';

			const thickness_px  = to_int(d.thickness_px, 1, 1, 20);
			const length_val    = to_str(d.length, '100%');
			const align_norm    = wpbc_bfb_field_divider.normalize_align(
				orientation,
				to_str(d.align, orientation === 'vertical' ? 'middle' : 'center')
			);  // accept both sets; normalize to orientation-appropriate token.
			const color_val     = to_str(d.color, '#e0e0e0');

			const mt = to_int(d.margin_top_px,    8, 0, 200);
			const mb = to_int(d.margin_bottom_px, 8, 0, 200);
			const ml = to_int(d.margin_left_px,   8, 0, 200);
			const mr = to_int(d.margin_right_px,  8, 0, 200);

			const html_id   = d.html_id ? sid(String(d.html_id)) : '';
			const name_val  = d.name    ? sname(String(d.name))  : '';
			const cls_extra = cls_sanit(String(d.cssclass_extra || d.cssclass || d.class || ''));

			const id_attr   = html_id ? ` id="${esc_html(html_id)}"` : '';
			const name_attr = name_val ? ` name="${esc_html(name_val)}"` : '';

			// Wrap styles (margins applied on the wrapper, not the line itself).
			// In vertical mode we also make the wrapper flex and stretch so height:100% resolves.
			const wrapper_styles = [
				`margin:${mt}px ${mr}px ${mb}px ${ml}px`,
				(orientation === 'vertical') ? 'display:flex' : '',
				(orientation === 'vertical') ? 'align-self:stretch' : ''
			].filter(Boolean).join('; ');
			const wrapper_attr = wrapper_styles ? ` style="${esc_html(wrapper_styles)}"` : '';

			let line_html = '';
			if (orientation === 'horizontal') {
				// Horizontal divider via <hr> with border-top
				const ml_auto   = (align_norm === 'left')  ? '0' : 'auto';
				const mr_auto   = (align_norm === 'right') ? '0' : 'auto';
				const hr_styles = [
					'border:none',
					'height:0',
					`border-top:${thickness_px}px ${line_style} ${color_val}`,
					`width:${length_val}`,
					`margin-left:${ml_auto}`,
					`margin-right:${mr_auto}`
				].join('; ');
				line_html = `<hr${id_attr}${name_attr} class="wpbc_bfb_divider wpbc_bfb_divider--h${cls_extra ? ' ' + esc_html(cls_extra) : ''}" style="${esc_html(hr_styles)}">`;
			} else {
				// Vertical divider via <div> with border-left; height = length
				// (positioning handled client-side; export keeps the same inline style set)
				// align_norm is 'top'|'middle'|'bottom' here.
				let vr_styles_align = '';
				vr_styles_align = (align_norm === 'top')    ? 'position: absolute;top: 0;' : vr_styles_align;
				vr_styles_align = (align_norm === 'middle') ? 'position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);' : vr_styles_align;
				vr_styles_align = (align_norm === 'bottom') ? 'position: absolute;bottom:0;' : vr_styles_align;

				const vr_styles = [
					`border-left:${thickness_px}px ${line_style} ${color_val}`,
					`height:${length_val}`,
					'padding-left:0',
					vr_styles_align
				].join('; ');

				line_html = `<div${id_attr}${name_attr} class="wpbc_bfb_divider wpbc_bfb_divider--v${cls_extra ? ' ' + esc_html(cls_extra) : ''}" role="separator" aria-orientation="vertical" style="${esc_html(vr_styles)}"></div>`;
			}

			// Output: a small wrapper so CSS can target export safely (no builder-only classes).
			emit(
				`<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="${orientation}"${wrapper_attr}>${line_html}</div>`
			);

			// NOTE: Help text is appended by WPBC_BFB_Exporter.render_field_node() after this exporter runs.
		});
	}

	/**
	 * Register empty content exporter for "divider" so it explicitly outputs nothing
	 * in “Content of booking fields data”.
	 */
	function register_divider_content_exporter() {
		if (!w.WPBC_BFB_ContentExporter || typeof w.WPBC_BFB_ContentExporter.register !== 'function') {
			return;
		}

		// Divider is purely visual; nothing to show in content template.
		w.WPBC_BFB_ContentExporter.register('divider', function (_field, _emit, _ctx) {
			// Intentionally empty – explicit no-op for content export.
		});
	}

	// Immediate registration if exporters are already loaded.
	try {
		register_divider_form_exporter();
	} catch (e) { _wpbc?.dev?.error?.('wpbc_bfb_field_divider.exporter', e); }

	try {
		register_divider_content_exporter();
	} catch (e) { _wpbc?.dev?.error?.('wpbc_bfb_field_divider.content_exporter', e); }

	// Deferred registration when builder-exporter.js fires its ready events.
	document.addEventListener('wpbc:bfb:exporter-ready', register_divider_form_exporter);
	document.addEventListener('wpbc:bfb:content-exporter-ready', register_divider_content_exporter);


	// -----------------------------------------------------------------------------
	// Inspector UX: enable/disable align options depending on orientation
	// -----------------------------------------------------------------------------
	/**
	 * Attach inspector logic to enable/disable align options based on orientation.
	 * Uses data-inspector-key selectors produced by the Factory inspector.
	 */
	(function attach_align_toggle() {

		/**
		 * Find a <select> for a given inspector key within a root.
		 * @param {ParentNode} root
		 * @param {string} key
		 * @returns {HTMLSelectElement|null}
		 */
		function get_sel(root, key) {
			return /** @type {HTMLSelectElement|null} */ (root.querySelector(`select[data-inspector-key="${key}"]`));
		}

		/**
		 * Locate the inspector root (falls back to document).
		 * @returns {ParentNode}
		 */
		function find_inspector_root() {
			return document.querySelector('.wpbc_bfb__inspector') || document;
		}

		/**
		 * Enable/disable align options depending on orientation.
		 * If the current value becomes invalid, remap to a valid counterpart.
		 *
		 * @param {HTMLSelectElement} oriSel
		 * @param {HTMLSelectElement} alignSel
		 * @returns {void}
		 */
		function set_disabled_options(oriSel, alignSel) {
			if (!oriSel || !alignSel) return;
			const ori = String(oriSel.value) === 'vertical' ? 'vertical' : 'horizontal';
			const H   = new Set(['left', 'center', 'right']);
			const V   = new Set(['top', 'middle', 'bottom']);

			Array.from(alignSel.options).forEach((opt) => {
				const v       = String(opt.value);
				const disable = (ori === 'vertical' && H.has(v)) || (ori === 'horizontal' && V.has(v));
				opt.disabled  = disable;
				opt.hidden    = disable; // hide visually as well
			});

			// If current value is disabled, remap to a valid counterpart.
			const cur = String(alignSel.value);
			if ((ori === 'vertical' && H.has(cur)) || (ori === 'horizontal' && V.has(cur))) {
				const mapH     = { top: 'left', middle: 'center', bottom: 'right' };
				const mapV     = { left: 'top', center: 'middle', right: 'bottom' };
				alignSel.value = (ori === 'vertical') ? (mapV[/** @type keyof typeof mapV */(cur)] || 'middle')
				                                       : (mapH[/** @type keyof typeof mapH */(cur)] || 'center');
				// Trigger change so data binding updates.
				alignSel.dispatchEvent(new Event('change', { bubbles: true }));
			}
		}

		/**
		 * Refresh orientation/align coupling for the current inspector.
		 * @returns {void}
		 */
		function refresh() {
			const root     = find_inspector_root();
			const oriSel   = get_sel(root, 'orientation');
			const alignSel = get_sel(root, 'align');
			if (oriSel && alignSel) set_disabled_options(oriSel, alignSel);
		}

		// React to changes of the Orientation control.
		document.addEventListener('change', (e) => {
			const t = /** @type {Element|null} */ (e.target);
			if (!t) return;
			if (t.matches('select[data-inspector-key="orientation"]')) {
				requestAnimationFrame(refresh);
			}
		}, true);

		// Also react to inspector re-renders.
		const mo = new MutationObserver(() => requestAnimationFrame(refresh));
		mo.observe(document.body, { childList: true, subtree: true });

		// Initial pass.
		requestAnimationFrame(refresh);
	})();

})(window);

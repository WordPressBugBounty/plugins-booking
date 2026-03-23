"use strict";

// File: /includes/page-form-builder/field-packs/divider/_out/divider.js
(function (w) {
  'use strict';

  /** @type {any} */
  var Core = w.WPBC_BFB_Core || {};
  var registry = Core.WPBC_BFB_Field_Renderer_Registry;
  var Base = Core.WPBC_BFB_Field_Base;
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
        type: 'divider',
        orientation: 'horizontal',
        // 'horizontal' | 'vertical'
        line_style: 'solid',
        // 'solid' | 'dashed' | 'dotted'
        thickness_px: 1,
        length: '100%',
        // width for horizontal, height for vertical
        align: 'center',
        // 'left' | 'center' | 'right' (or vertical equivalents; normalized later)
        color: '#e0e0e0',
        margin_top_px: 2,
        margin_bottom_px: 2,
        margin_left_px: 2,
        margin_right_px: 2,
        cssclass_extra: '',
        name: '',
        html_id: '',
        help: '',
        usage_key: 'divider'
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
      const a = String(align_raw ?? '').toLowerCase();
      const H = {
        top: 'left',
        middle: 'center',
        bottom: 'right'
      };
      const V = {
        left: 'top',
        center: 'middle',
        right: 'bottom'
      };
      const isV = orientation === 'vertical';
      if (isV) return a in V ? /** @type any */V[a] : ['top', 'middle', 'bottom'].includes(a) ? (/** @type any */a) : 'middle';
      return a in H ? /** @type any */H[a] : ['left', 'center', 'right'].includes(a) ? (/** @type any */a) : 'center';
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
      const eh = v => Core.WPBC_BFB_Sanitize.escape_html(v);
      const sid = v => Core.WPBC_BFB_Sanitize.sanitize_html_id(v);
      const sname = v => Core.WPBC_BFB_Sanitize.sanitize_html_name(v);
      const sclass = v => Core.WPBC_BFB_Sanitize.sanitize_css_classlist(v);

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
      const to_str = (v, def) => v === undefined || v === null ? def : String(v);

      // Coerce props.
      /** @type {'horizontal'|'vertical'} */
      const orientation = to_str(d.orientation, 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
      /** @type {'solid'|'dashed'|'dotted'} */
      const line_style = {
        solid: 1,
        dashed: 1,
        dotted: 1
      }[to_str(d.line_style, 'solid')] ? d.line_style : 'solid';
      const align_norm = wpbc_bfb_field_divider.normalize_align(orientation, to_str(d.align, orientation === 'vertical' ? 'middle' : 'center')); // accept both sets, then normalize to the active orientation.
      const thickness_px = to_int(d.thickness_px, 1, 1, 20);
      const length_val = Core.WPBC_BFB_Sanitize.sanitize_css_len(d.length, '100%');
      const color_val = Core.WPBC_BFB_Sanitize.sanitize_hex_color(d.color, '#e0e0e0');
      const m_top = to_int(d.margin_top_px, 8, 0, 200);
      const m_bottom = to_int(d.margin_bottom_px, 8, 0, 200);
      const m_left = to_int(d.margin_left_px, 8, 0, 200);
      const m_right = to_int(d.margin_right_px, 8, 0, 200);
      const html_id = d.html_id ? sid(String(d.html_id)) : '';
      const name_val = d.name ? sname(String(d.name)) : '';
      const cls_extra = sclass(String(d.cssclass_extra || ''));

      // Persist useful props on dataset (do not mutate wrapper classes directly).
      if (el.dataset.orientation !== orientation) el.dataset.orientation = orientation;
      if (el.dataset.line_style !== line_style) el.dataset.line_style = line_style;
      if (String(el.dataset.thickness_px) !== String(thickness_px)) el.dataset.thickness_px = String(thickness_px);
      if (el.dataset.length !== length_val) el.dataset.length = length_val;
      if (el.dataset.align !== align_norm) el.dataset.align = align_norm;
      if (el.dataset.color !== color_val) el.dataset.color = color_val;
      if (String(el.dataset.margin_top_px) !== String(m_top)) el.dataset.margin_top_px = String(m_top);
      if (String(el.dataset.margin_bottom_px) !== String(m_bottom)) el.dataset.margin_bottom_px = String(m_bottom);
      if (String(el.dataset.margin_left_px) !== String(m_left)) el.dataset.margin_left_px = String(m_left);
      if (String(el.dataset.margin_right_px) !== String(m_right)) el.dataset.margin_right_px = String(m_right);
      if (el.dataset.cssclass_extra !== cls_extra) el.dataset.cssclass_extra = cls_extra;
      if (el.dataset.html_id !== html_id) el.dataset.html_id = html_id;
      if (el.dataset.name !== name_val) el.dataset.name = name_val;

      // Attribute fragments for the line element.
      const id_attr = html_id ? ` id="${eh(html_id)}"` : '';
      const name_attr = name_val ? ` name="${eh(name_val)}"` : '';
      const cls_attr = cls_extra ? ` class="${eh(cls_extra)}"` : '';

      // Compute style for margins (outer wrapper).
      const outer_style_attr = ` style="margin:${m_top}px ${m_right}px ${m_bottom}px ${m_left}px;"`;

      // Build inner line markup based on orientation.
      let line_html = '';
      if (orientation === 'horizontal') {
        // Horizontal: <hr> using border-top.
        const ml = align_norm === 'left' ? '0' : 'auto';
        const mr = align_norm === 'right' ? '0' : 'auto';
        const hr_style = ['border:none', 'height:0', `border-top:${thickness_px}px ${line_style} ${color_val}`, `width:${length_val}`, `margin-left:${ml}`, `margin-right:${mr}`].join(';');
        line_html = `<hr${cls_attr}${id_attr}${name_attr} style="${hr_style}">`;
      } else {
        // Vertical: <div> using border-left and height.
        let v_align = '';
        v_align = align_norm === 'top' ? 'position:absolute;top:0;' : v_align;
        v_align = align_norm === 'middle' ? 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' : v_align;
        v_align = align_norm === 'bottom' ? 'position:absolute;bottom:0;' : v_align;
        const vr_style = [`border-left:${thickness_px}px ${line_style} ${color_val}`, `height:${length_val}`, `${v_align}`, 'padding-left:0'].join(';');
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
  } catch (e) {
    _wpbc?.dev?.error?.('wpbc_bfb_field_divider.register', e);
  }

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
      const core = extras && extras.core || w.WPBC_BFB_Core || {};
      const Sanit = core.WPBC_BFB_Sanitize || {};
      const esc_html = Sanit.escape_html ? Sanit.escape_html.bind(Sanit) : s => String(s);
      const cls_sanit = Sanit.sanitize_css_classlist ? Sanit.sanitize_css_classlist.bind(Sanit) : s => String(s);
      const sid = Sanit.sanitize_html_id ? Sanit.sanitize_html_id.bind(Sanit) : s => String(s);
      const sname = Sanit.sanitize_html_name ? Sanit.sanitize_html_name.bind(Sanit) : s => String(s);

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
      const to_str = (v, def) => v == null || v === '' ? def : String(v);

      // Normalize against defaults (schema-driven).
      const d = wpbc_bfb_field_divider.normalize_data(field);

      // ---- read & sanitize props (keep in sync with preview/schema) ----
      /** @type {'horizontal'|'vertical'} */
      const orientation = to_str(d.orientation, 'horizontal') === 'vertical' ? 'vertical' : 'horizontal';
      const line_style_in = to_str(d.line_style, 'solid');
      /** @type {'solid'|'dashed'|'dotted'} */
      const line_style = {
        solid: 1,
        dashed: 1,
        dotted: 1
      }[line_style_in] ? line_style_in : 'solid';
      const thickness_px = to_int(d.thickness_px, 1, 1, 20);
      const length_val = to_str(d.length, '100%');
      const align_norm = wpbc_bfb_field_divider.normalize_align(orientation, to_str(d.align, orientation === 'vertical' ? 'middle' : 'center')); // accept both sets; normalize to orientation-appropriate token.
      const color_val = to_str(d.color, '#e0e0e0');
      const mt = to_int(d.margin_top_px, 8, 0, 200);
      const mb = to_int(d.margin_bottom_px, 8, 0, 200);
      const ml = to_int(d.margin_left_px, 8, 0, 200);
      const mr = to_int(d.margin_right_px, 8, 0, 200);
      const html_id = d.html_id ? sid(String(d.html_id)) : '';
      const name_val = d.name ? sname(String(d.name)) : '';
      const cls_extra = cls_sanit(String(d.cssclass_extra || d.cssclass || d.class || ''));
      const id_attr = html_id ? ` id="${esc_html(html_id)}"` : '';
      const name_attr = name_val ? ` name="${esc_html(name_val)}"` : '';

      // Wrap styles (margins applied on the wrapper, not the line itself).
      // In vertical mode we also make the wrapper flex and stretch so height:100% resolves.
      const wrapper_styles = [`margin:${mt}px ${mr}px ${mb}px ${ml}px`, orientation === 'vertical' ? 'display:flex' : '', orientation === 'vertical' ? 'align-self:stretch' : ''].filter(Boolean).join('; ');
      const wrapper_attr = wrapper_styles ? ` style="${esc_html(wrapper_styles)}"` : '';
      let line_html = '';
      if (orientation === 'horizontal') {
        // Horizontal divider via <hr> with border-top
        const ml_auto = align_norm === 'left' ? '0' : 'auto';
        const mr_auto = align_norm === 'right' ? '0' : 'auto';
        const hr_styles = ['border:none', 'height:0', `border-top:${thickness_px}px ${line_style} ${color_val}`, `width:${length_val}`, `margin-left:${ml_auto}`, `margin-right:${mr_auto}`].join('; ');
        line_html = `<hr${id_attr}${name_attr} class="wpbc_bfb_divider wpbc_bfb_divider--h${cls_extra ? ' ' + esc_html(cls_extra) : ''}" style="${esc_html(hr_styles)}">`;
      } else {
        // Vertical divider via <div> with border-left; height = length
        // (positioning handled client-side; export keeps the same inline style set)
        // align_norm is 'top'|'middle'|'bottom' here.
        let vr_styles_align = '';
        vr_styles_align = align_norm === 'top' ? 'position: absolute;top: 0;' : vr_styles_align;
        vr_styles_align = align_norm === 'middle' ? 'position: absolute;top: 50%;left: 50%;transform: translate(-50%, -50%);' : vr_styles_align;
        vr_styles_align = align_norm === 'bottom' ? 'position: absolute;bottom:0;' : vr_styles_align;
        const vr_styles = [`border-left:${thickness_px}px ${line_style} ${color_val}`, `height:${length_val}`, 'padding-left:0', vr_styles_align].join('; ');
        line_html = `<div${id_attr}${name_attr} class="wpbc_bfb_divider wpbc_bfb_divider--v${cls_extra ? ' ' + esc_html(cls_extra) : ''}" role="separator" aria-orientation="vertical" style="${esc_html(vr_styles)}"></div>`;
      }

      // Output: a small wrapper so CSS can target export safely (no builder-only classes).
      emit(`<div class="wpbc_bfb_divider_wrap" data-bfb-type="divider" data-orientation="${orientation}"${wrapper_attr}>${line_html}</div>`);

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
  } catch (e) {
    _wpbc?.dev?.error?.('wpbc_bfb_field_divider.exporter', e);
  }
  try {
    register_divider_content_exporter();
  } catch (e) {
    _wpbc?.dev?.error?.('wpbc_bfb_field_divider.content_exporter', e);
  }

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
      return /** @type {HTMLSelectElement|null} */root.querySelector(`select[data-inspector-key="${key}"]`);
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
      const H = new Set(['left', 'center', 'right']);
      const V = new Set(['top', 'middle', 'bottom']);
      Array.from(alignSel.options).forEach(opt => {
        const v = String(opt.value);
        const disable = ori === 'vertical' && H.has(v) || ori === 'horizontal' && V.has(v);
        opt.disabled = disable;
        opt.hidden = disable; // hide visually as well
      });

      // If current value is disabled, remap to a valid counterpart.
      const cur = String(alignSel.value);
      if (ori === 'vertical' && H.has(cur) || ori === 'horizontal' && V.has(cur)) {
        const mapH = {
          top: 'left',
          middle: 'center',
          bottom: 'right'
        };
        const mapV = {
          left: 'top',
          center: 'middle',
          right: 'bottom'
        };
        alignSel.value = ori === 'vertical' ? mapV[(/** @type keyof typeof mapV */cur)] || 'middle' : mapH[(/** @type keyof typeof mapH */cur)] || 'center';
        // Trigger change so data binding updates.
        alignSel.dispatchEvent(new Event('change', {
          bubbles: true
        }));
      }
    }

    /**
     * Refresh orientation/align coupling for the current inspector.
     * @returns {void}
     */
    function refresh() {
      const root = find_inspector_root();
      const oriSel = get_sel(root, 'orientation');
      const alignSel = get_sel(root, 'align');
      if (oriSel && alignSel) set_disabled_options(oriSel, alignSel);
    }

    // React to changes of the Orientation control.
    document.addEventListener('change', e => {
      const t = /** @type {Element|null} */e.target;
      if (!t) return;
      if (t.matches('select[data-inspector-key="orientation"]')) {
        requestAnimationFrame(refresh);
      }
    }, true);

    // Also react to inspector re-renders.
    const mo = new MutationObserver(() => requestAnimationFrame(refresh));
    mo.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial pass.
    requestAnimationFrame(refresh);
  })();
})(window);
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1mb3JtLWJ1aWxkZXIvZmllbGQtcGFja3MvZGl2aWRlci9fb3V0L2RpdmlkZXIuanMiLCJuYW1lcyI6WyJ3IiwiQ29yZSIsIldQQkNfQkZCX0NvcmUiLCJyZWdpc3RyeSIsIldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5IiwiQmFzZSIsIldQQkNfQkZCX0ZpZWxkX0Jhc2UiLCJyZWdpc3RlciIsIl93cGJjIiwiZGV2IiwiZXJyb3IiLCJ3cGJjX2JmYl9maWVsZF9kaXZpZGVyIiwiZ2V0X2RlZmF1bHRzIiwidHlwZSIsIm9yaWVudGF0aW9uIiwibGluZV9zdHlsZSIsInRoaWNrbmVzc19weCIsImxlbmd0aCIsImFsaWduIiwiY29sb3IiLCJtYXJnaW5fdG9wX3B4IiwibWFyZ2luX2JvdHRvbV9weCIsIm1hcmdpbl9sZWZ0X3B4IiwibWFyZ2luX3JpZ2h0X3B4IiwiY3NzY2xhc3NfZXh0cmEiLCJuYW1lIiwiaHRtbF9pZCIsImhlbHAiLCJ1c2FnZV9rZXkiLCJub3JtYWxpemVfYWxpZ24iLCJhbGlnbl9yYXciLCJhIiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJIIiwidG9wIiwibWlkZGxlIiwiYm90dG9tIiwiViIsImxlZnQiLCJjZW50ZXIiLCJyaWdodCIsImlzViIsImluY2x1ZGVzIiwicmVuZGVyIiwiZWwiLCJkYXRhIiwiY3R4IiwiZCIsIm5vcm1hbGl6ZV9kYXRhIiwiZWgiLCJ2IiwiV1BCQ19CRkJfU2FuaXRpemUiLCJlc2NhcGVfaHRtbCIsInNpZCIsInNhbml0aXplX2h0bWxfaWQiLCJzbmFtZSIsInNhbml0aXplX2h0bWxfbmFtZSIsInNjbGFzcyIsInNhbml0aXplX2Nzc19jbGFzc2xpc3QiLCJ0b19pbnQiLCJkZWYiLCJtaW4iLCJtYXgiLCJuIiwicGFyc2VJbnQiLCJpc05hTiIsInRvX3N0ciIsInVuZGVmaW5lZCIsInNvbGlkIiwiZGFzaGVkIiwiZG90dGVkIiwiYWxpZ25fbm9ybSIsImxlbmd0aF92YWwiLCJzYW5pdGl6ZV9jc3NfbGVuIiwiY29sb3JfdmFsIiwic2FuaXRpemVfaGV4X2NvbG9yIiwibV90b3AiLCJtX2JvdHRvbSIsIm1fbGVmdCIsIm1fcmlnaHQiLCJuYW1lX3ZhbCIsImNsc19leHRyYSIsImRhdGFzZXQiLCJpZF9hdHRyIiwibmFtZV9hdHRyIiwiY2xzX2F0dHIiLCJvdXRlcl9zdHlsZV9hdHRyIiwibGluZV9odG1sIiwibWwiLCJtciIsImhyX3N0eWxlIiwiam9pbiIsInZfYWxpZ24iLCJ2cl9zdHlsZSIsImhlbHBfaHRtbCIsImlubmVySFRNTCIsIlVJIiwiV1BCQ19CRkJfT3ZlcmxheSIsImVuc3VyZSIsImJ1aWxkZXIiLCJvbl9maWVsZF9kcm9wIiwic3JjIiwicGFsZXR0ZV9pdGVtIiwib3JpIiwiZ2V0QXR0cmlidXRlIiwiZSIsInJlZ2lzdGVyX2RpdmlkZXJfZm9ybV9leHBvcnRlciIsIldQQkNfQkZCX0V4cG9ydGVyIiwiZmllbGQiLCJlbWl0IiwiZXh0cmFzIiwiY29yZSIsIlNhbml0IiwiZXNjX2h0bWwiLCJiaW5kIiwicyIsImNsc19zYW5pdCIsImxpbmVfc3R5bGVfaW4iLCJtdCIsIm1iIiwiY3NzY2xhc3MiLCJjbGFzcyIsIndyYXBwZXJfc3R5bGVzIiwiZmlsdGVyIiwiQm9vbGVhbiIsIndyYXBwZXJfYXR0ciIsIm1sX2F1dG8iLCJtcl9hdXRvIiwiaHJfc3R5bGVzIiwidnJfc3R5bGVzX2FsaWduIiwidnJfc3R5bGVzIiwicmVnaXN0ZXJfZGl2aWRlcl9jb250ZW50X2V4cG9ydGVyIiwiV1BCQ19CRkJfQ29udGVudEV4cG9ydGVyIiwiX2ZpZWxkIiwiX2VtaXQiLCJfY3R4IiwiZG9jdW1lbnQiLCJhZGRFdmVudExpc3RlbmVyIiwiYXR0YWNoX2FsaWduX3RvZ2dsZSIsImdldF9zZWwiLCJyb290Iiwia2V5IiwicXVlcnlTZWxlY3RvciIsImZpbmRfaW5zcGVjdG9yX3Jvb3QiLCJzZXRfZGlzYWJsZWRfb3B0aW9ucyIsIm9yaVNlbCIsImFsaWduU2VsIiwidmFsdWUiLCJTZXQiLCJBcnJheSIsImZyb20iLCJvcHRpb25zIiwiZm9yRWFjaCIsIm9wdCIsImRpc2FibGUiLCJoYXMiLCJkaXNhYmxlZCIsImhpZGRlbiIsImN1ciIsIm1hcEgiLCJtYXBWIiwiZGlzcGF0Y2hFdmVudCIsIkV2ZW50IiwiYnViYmxlcyIsInJlZnJlc2giLCJ0IiwidGFyZ2V0IiwibWF0Y2hlcyIsInJlcXVlc3RBbmltYXRpb25GcmFtZSIsIm1vIiwiTXV0YXRpb25PYnNlcnZlciIsIm9ic2VydmUiLCJib2R5IiwiY2hpbGRMaXN0Iiwic3VidHJlZSIsIndpbmRvdyJdLCJzb3VyY2VzIjpbImluY2x1ZGVzL3BhZ2UtZm9ybS1idWlsZGVyL2ZpZWxkLXBhY2tzL2RpdmlkZXIvX3NyYy9kaXZpZGVyLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIEZpbGU6IC9pbmNsdWRlcy9wYWdlLWZvcm0tYnVpbGRlci9maWVsZC1wYWNrcy9kaXZpZGVyL19vdXQvZGl2aWRlci5qc1xyXG4oZnVuY3Rpb24gKHcpIHtcclxuXHQndXNlIHN0cmljdCc7XHJcblxyXG5cdC8qKiBAdHlwZSB7YW55fSAqL1xyXG5cdHZhciBDb3JlICAgICA9IHcuV1BCQ19CRkJfQ29yZSB8fCB7fTtcclxuXHR2YXIgcmVnaXN0cnkgPSBDb3JlLldQQkNfQkZCX0ZpZWxkX1JlbmRlcmVyX1JlZ2lzdHJ5O1xyXG5cdHZhciBCYXNlICAgICA9IENvcmUuV1BCQ19CRkJfRmllbGRfQmFzZTtcclxuXHJcblx0aWYgKCFyZWdpc3RyeSB8fCB0eXBlb2YgcmVnaXN0cnkucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicgfHwgIUJhc2UpIHtcclxuXHRcdF93cGJjPy5kZXY/LmVycm9yPy4oJ3dwYmNfYmZiX2ZpZWxkX2RpdmlkZXInLCAnQ29yZSByZWdpc3RyeS9iYXNlIG1pc3NpbmcnKTtcclxuXHRcdHJldHVybjtcclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIFdQQkMgQkZCOiBGaWVsZCBSZW5kZXJlciBmb3IgXCJkaXZpZGVyXCIgKFNjaGVtYS1kcml2ZW4pXHJcblx0ICogLSBJbnNwZWN0b3IgaXMgcmVuZGVyZWQgYnkgRmFjdG9yeSAoZnJvbSBQSFAgc2NoZW1hKS5cclxuXHQgKiAtIE5vIHdwLnRlbXBsYXRlIHVzYWdlIGZvciBwcmV2aWV3LlxyXG5cdCAqIC0gUmVuZGVycyBlaXRoZXIgYSBob3Jpem9udGFsIDxocj4gb3IgYSB2ZXJ0aWNhbCA8ZGl2PiB3aXRoIGJvcmRlci1sZWZ0LlxyXG5cdCAqL1xyXG5cdGNsYXNzIHdwYmNfYmZiX2ZpZWxkX2RpdmlkZXIgZXh0ZW5kcyBCYXNlIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJldHVybiBkZWZhdWx0IHByb3BzIGZvciBcImRpdmlkZXJcIiBmaWVsZC5cclxuXHRcdCAqIE11c3Qgc3RheSBpbiBzeW5jIHdpdGggUEhQIHNjaGVtYSBkZWZhdWx0cy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcmV0dXJucyB7e3R5cGU6c3RyaW5nLG9yaWVudGF0aW9uOidob3Jpem9udGFsJ3wndmVydGljYWwnLGxpbmVfc3R5bGU6J3NvbGlkJ3wnZGFzaGVkJ3wnZG90dGVkJyx0aGlja25lc3NfcHg6bnVtYmVyLGxlbmd0aDpzdHJpbmcsYWxpZ246c3RyaW5nLGNvbG9yOnN0cmluZyxtYXJnaW5fdG9wX3B4Om51bWJlcixtYXJnaW5fYm90dG9tX3B4Om51bWJlcixtYXJnaW5fbGVmdF9weDpudW1iZXIsbWFyZ2luX3JpZ2h0X3B4Om51bWJlcixjc3NjbGFzc19leHRyYTpzdHJpbmcsbmFtZTpzdHJpbmcsaHRtbF9pZDpzdHJpbmcsaGVscDpzdHJpbmcsdXNhZ2Vfa2V5OnN0cmluZ319XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBnZXRfZGVmYXVsdHMoKSB7XHJcblx0XHRcdHJldHVybiB7XHJcblx0XHRcdFx0dHlwZSAgICAgICAgICAgIDogJ2RpdmlkZXInLFxyXG5cdFx0XHRcdG9yaWVudGF0aW9uICAgICA6ICdob3Jpem9udGFsJywgLy8gJ2hvcml6b250YWwnIHwgJ3ZlcnRpY2FsJ1xyXG5cdFx0XHRcdGxpbmVfc3R5bGUgICAgICA6ICdzb2xpZCcsICAgICAgLy8gJ3NvbGlkJyB8ICdkYXNoZWQnIHwgJ2RvdHRlZCdcclxuXHRcdFx0XHR0aGlja25lc3NfcHggICAgOiAxLFxyXG5cdFx0XHRcdGxlbmd0aCAgICAgICAgICA6ICcxMDAlJywgICAgICAgLy8gd2lkdGggZm9yIGhvcml6b250YWwsIGhlaWdodCBmb3IgdmVydGljYWxcclxuXHRcdFx0XHRhbGlnbiAgICAgICAgICAgOiAnY2VudGVyJywgICAgIC8vICdsZWZ0JyB8ICdjZW50ZXInIHwgJ3JpZ2h0JyAob3IgdmVydGljYWwgZXF1aXZhbGVudHM7IG5vcm1hbGl6ZWQgbGF0ZXIpXHJcblx0XHRcdFx0Y29sb3IgICAgICAgICAgIDogJyNlMGUwZTAnLFxyXG5cdFx0XHRcdG1hcmdpbl90b3BfcHggICA6IDIsXHJcblx0XHRcdFx0bWFyZ2luX2JvdHRvbV9weDogMixcclxuXHRcdFx0XHRtYXJnaW5fbGVmdF9weCAgOiAyLFxyXG5cdFx0XHRcdG1hcmdpbl9yaWdodF9weCA6IDIsXHJcblx0XHRcdFx0Y3NzY2xhc3NfZXh0cmEgIDogJycsXHJcblx0XHRcdFx0bmFtZSAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0aHRtbF9pZCAgICAgICAgIDogJycsXHJcblx0XHRcdFx0aGVscCAgICAgICAgICAgIDogJycsXHJcblx0XHRcdFx0dXNhZ2Vfa2V5ICAgICAgIDogJ2RpdmlkZXInXHJcblx0XHRcdH07XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBOb3JtYWxpemUgYWxpZ24gdG9rZW5zIGZvciB0aGUgY3VycmVudCBvcmllbnRhdGlvbi5cclxuXHRcdCAqIC0gRm9yIGhvcml6b250YWw6IGFjY2VwdHMgbGVmdHxjZW50ZXJ8cmlnaHQgb3IgdG9wfG1pZGRsZXxib3R0b20g4oaSIG1hcHMgdG8gbGVmdHxjZW50ZXJ8cmlnaHQuXHJcblx0XHQgKiAtIEZvciB2ZXJ0aWNhbCAgOiBhY2NlcHRzIHRvcHxtaWRkbGV8Ym90dG9tIG9yIGxlZnR8Y2VudGVyfHJpZ2h0IOKGkiBtYXBzIHRvIHRvcHxtaWRkbGV8Ym90dG9tLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7J2hvcml6b250YWwnfCd2ZXJ0aWNhbCd9IG9yaWVudGF0aW9uXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ3x1bmRlZmluZWR8bnVsbH0gYWxpZ25fcmF3XHJcblx0XHQgKiBAcmV0dXJucyB7J2xlZnQnfCdjZW50ZXInfCdyaWdodCd8J3RvcCd8J21pZGRsZSd8J2JvdHRvbSd9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyBub3JtYWxpemVfYWxpZ24ob3JpZW50YXRpb24sIGFsaWduX3Jhdykge1xyXG5cdFx0XHRjb25zdCBhICAgPSBTdHJpbmcoYWxpZ25fcmF3ID8/ICcnKS50b0xvd2VyQ2FzZSgpO1xyXG5cdFx0XHRjb25zdCBIICAgPSB7IHRvcDogJ2xlZnQnLCBtaWRkbGU6ICdjZW50ZXInLCBib3R0b206ICdyaWdodCcgfTtcclxuXHRcdFx0Y29uc3QgViAgID0geyBsZWZ0OiAndG9wJywgY2VudGVyOiAnbWlkZGxlJywgcmlnaHQ6ICdib3R0b20nIH07XHJcblx0XHRcdGNvbnN0IGlzViA9IG9yaWVudGF0aW9uID09PSAndmVydGljYWwnO1xyXG5cdFx0XHRpZiAoaXNWKSAgcmV0dXJuIChhIGluIFYpID8gLyoqIEB0eXBlIGFueSAqLyhWKVthXSA6IChbJ3RvcCcsJ21pZGRsZScsJ2JvdHRvbSddLmluY2x1ZGVzKGEpID8gLyoqIEB0eXBlIGFueSAqLyhhKSA6ICdtaWRkbGUnKTtcclxuXHRcdFx0cmV0dXJuIChhIGluIEgpID8gLyoqIEB0eXBlIGFueSAqLyhIKVthXSA6IChbJ2xlZnQnLCdjZW50ZXInLCdyaWdodCddLmluY2x1ZGVzKGEpID8gLyoqIEB0eXBlIGFueSAqLyhhKSA6ICdjZW50ZXInKTtcclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlbmRlciB0aGUgcHJldmlldyBtYXJrdXAgaW50byB0aGUgZmllbGQgZWxlbWVudC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbCAgIEZpZWxkIHJvb3QgZWxlbWVudCBpbnNpZGUgdGhlIGNhbnZhcy5cclxuXHRcdCAqIEBwYXJhbSB7T2JqZWN0fSAgICAgIGRhdGEgRmllbGQgcHJvcHMgKGFscmVhZHkgbm9ybWFsaXplZCBieSBzY2hlbWEpLlxyXG5cdFx0ICogQHBhcmFtIHt7YnVpbGRlcj86YW55LCBzYW5pdD86YW55fX0gW2N0eF0gIENvbnRleHQgb2JqZWN0LlxyXG5cdFx0ICogQHJldHVybnMge3ZvaWR9XHJcblx0XHQgKi9cclxuXHRcdHN0YXRpYyByZW5kZXIoZWwsIGRhdGEsIGN0eCkge1xyXG5cdFx0XHRpZiAoIWVsKSByZXR1cm47XHJcblxyXG5cdFx0XHQvLyBOb3JtYWxpemUgYWdhaW5zdCBkZWZhdWx0cyBmaXJzdC5cclxuXHRcdFx0Y29uc3QgZCA9IHRoaXMubm9ybWFsaXplX2RhdGEoZGF0YSk7XHJcblxyXG5cdFx0XHQvLyAtLS0tLSBDb3JlIHNhbml0aXplIGhlbHBlcnMgKHN0YXRpYykgLS0tLS1cclxuXHRcdFx0Y29uc3QgZWggICAgID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuZXNjYXBlX2h0bWwodik7XHJcblx0XHRcdGNvbnN0IHNpZCAgICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfaWQodik7XHJcblx0XHRcdGNvbnN0IHNuYW1lICA9ICh2KSA9PiBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2h0bWxfbmFtZSh2KTtcclxuXHRcdFx0Y29uc3Qgc2NsYXNzID0gKHYpID0+IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfY3NzX2NsYXNzbGlzdCh2KTtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBAcGFyYW0ge2FueX0gdlxyXG5cdFx0XHQgKiBAcGFyYW0ge251bWJlcn0gZGVmXHJcblx0XHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbbWluXVxyXG5cdFx0XHQgKiBAcGFyYW0ge251bWJlcn0gW21heF1cclxuXHRcdFx0ICogQHJldHVybnMge251bWJlcn1cclxuXHRcdFx0ICovXHJcblx0XHRcdGNvbnN0IHRvX2ludCA9ICh2LCBkZWYsIG1pbiwgbWF4KSA9PiB7XHJcblx0XHRcdFx0bGV0IG4gPSBwYXJzZUludCh2LCAxMCk7XHJcblx0XHRcdFx0aWYgKGlzTmFOKG4pKSBuID0gZGVmO1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgbWluID09PSAnbnVtYmVyJyAmJiBuIDwgbWluKSBuID0gbWluO1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgbWF4ID09PSAnbnVtYmVyJyAmJiBuID4gbWF4KSBuID0gbWF4O1xyXG5cdFx0XHRcdHJldHVybiBuO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkZWZcclxuXHRcdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdFx0ICovXHJcblx0XHRcdGNvbnN0IHRvX3N0ciA9ICh2LCBkZWYpID0+ICh2ID09PSB1bmRlZmluZWQgfHwgdiA9PT0gbnVsbCkgPyBkZWYgOiBTdHJpbmcodik7XHJcblxyXG5cdFx0XHQvLyBDb2VyY2UgcHJvcHMuXHJcblx0XHRcdC8qKiBAdHlwZSB7J2hvcml6b250YWwnfCd2ZXJ0aWNhbCd9ICovXHJcblx0XHRcdGNvbnN0IG9yaWVudGF0aW9uID0gKHRvX3N0cihkLm9yaWVudGF0aW9uLCAnaG9yaXpvbnRhbCcpID09PSAndmVydGljYWwnKSA/ICd2ZXJ0aWNhbCcgOiAnaG9yaXpvbnRhbCc7XHJcblx0XHRcdC8qKiBAdHlwZSB7J3NvbGlkJ3wnZGFzaGVkJ3wnZG90dGVkJ30gKi9cclxuXHRcdFx0Y29uc3QgbGluZV9zdHlsZSAgPSAoeyBzb2xpZDoxLCBkYXNoZWQ6MSwgZG90dGVkOjEgfVsgdG9fc3RyKGQubGluZV9zdHlsZSwgJ3NvbGlkJykgXSkgPyBkLmxpbmVfc3R5bGUgOiAnc29saWQnO1xyXG5cdFx0XHRjb25zdCBhbGlnbl9ub3JtICA9IHdwYmNfYmZiX2ZpZWxkX2RpdmlkZXIubm9ybWFsaXplX2FsaWduKG9yaWVudGF0aW9uLCB0b19zdHIoZC5hbGlnbiwgb3JpZW50YXRpb24gPT09ICd2ZXJ0aWNhbCcgPyAnbWlkZGxlJyA6ICdjZW50ZXInKSk7IC8vIGFjY2VwdCBib3RoIHNldHMsIHRoZW4gbm9ybWFsaXplIHRvIHRoZSBhY3RpdmUgb3JpZW50YXRpb24uXHJcblx0XHRcdGNvbnN0IHRoaWNrbmVzc19weCA9IHRvX2ludChkLnRoaWNrbmVzc19weCwgMSwgMSwgMjApO1xyXG5cdFx0XHRjb25zdCBsZW5ndGhfdmFsICAgPSBDb3JlLldQQkNfQkZCX1Nhbml0aXplLnNhbml0aXplX2Nzc19sZW4oZC5sZW5ndGgsICcxMDAlJyk7XHJcblx0XHRcdGNvbnN0IGNvbG9yX3ZhbCAgICA9IENvcmUuV1BCQ19CRkJfU2FuaXRpemUuc2FuaXRpemVfaGV4X2NvbG9yKGQuY29sb3IsICcjZTBlMGUwJyk7XHJcblxyXG5cdFx0XHRjb25zdCBtX3RvcCAgICA9IHRvX2ludChkLm1hcmdpbl90b3BfcHgsIDgsIDAsIDIwMCk7XHJcblx0XHRcdGNvbnN0IG1fYm90dG9tID0gdG9faW50KGQubWFyZ2luX2JvdHRvbV9weCwgOCwgMCwgMjAwKTtcclxuXHRcdFx0Y29uc3QgbV9sZWZ0ICAgPSB0b19pbnQoZC5tYXJnaW5fbGVmdF9weCwgOCwgMCwgMjAwKTtcclxuXHRcdFx0Y29uc3QgbV9yaWdodCAgPSB0b19pbnQoZC5tYXJnaW5fcmlnaHRfcHgsIDgsIDAsIDIwMCk7XHJcblxyXG5cdFx0XHRjb25zdCBodG1sX2lkICAgPSBkLmh0bWxfaWQgPyBzaWQoU3RyaW5nKGQuaHRtbF9pZCkpIDogJyc7XHJcblx0XHRcdGNvbnN0IG5hbWVfdmFsICA9IGQubmFtZSAgICA/IHNuYW1lKFN0cmluZyhkLm5hbWUpKSAgOiAnJztcclxuXHRcdFx0Y29uc3QgY2xzX2V4dHJhID0gc2NsYXNzKFN0cmluZyhkLmNzc2NsYXNzX2V4dHJhIHx8ICcnKSk7XHJcblxyXG5cdFx0XHQvLyBQZXJzaXN0IHVzZWZ1bCBwcm9wcyBvbiBkYXRhc2V0IChkbyBub3QgbXV0YXRlIHdyYXBwZXIgY2xhc3NlcyBkaXJlY3RseSkuXHJcblx0XHRcdGlmIChlbC5kYXRhc2V0Lm9yaWVudGF0aW9uICAgIT09IG9yaWVudGF0aW9uKSAgIGVsLmRhdGFzZXQub3JpZW50YXRpb24gICA9IG9yaWVudGF0aW9uO1xyXG5cdFx0XHRpZiAoZWwuZGF0YXNldC5saW5lX3N0eWxlICAgICE9PSBsaW5lX3N0eWxlKSAgICBlbC5kYXRhc2V0LmxpbmVfc3R5bGUgICAgPSBsaW5lX3N0eWxlO1xyXG5cdFx0XHRpZiAoU3RyaW5nKGVsLmRhdGFzZXQudGhpY2tuZXNzX3B4KSAhPT0gU3RyaW5nKHRoaWNrbmVzc19weCkpIGVsLmRhdGFzZXQudGhpY2tuZXNzX3B4ID0gU3RyaW5nKHRoaWNrbmVzc19weCk7XHJcblx0XHRcdGlmIChlbC5kYXRhc2V0Lmxlbmd0aCAgICAgICAgIT09IGxlbmd0aF92YWwpICAgIGVsLmRhdGFzZXQubGVuZ3RoICAgICAgICA9IGxlbmd0aF92YWw7XHJcblx0XHRcdGlmIChlbC5kYXRhc2V0LmFsaWduICAgICAgICAgIT09IGFsaWduX25vcm0pICAgIGVsLmRhdGFzZXQuYWxpZ24gICAgICAgICA9IGFsaWduX25vcm07XHJcblx0XHRcdGlmIChlbC5kYXRhc2V0LmNvbG9yICAgICAgICAgIT09IGNvbG9yX3ZhbCkgICAgIGVsLmRhdGFzZXQuY29sb3IgICAgICAgICA9IGNvbG9yX3ZhbDtcclxuXHJcblx0XHRcdGlmIChTdHJpbmcoZWwuZGF0YXNldC5tYXJnaW5fdG9wX3B4KSAgICAhPT0gU3RyaW5nKG1fdG9wKSkgICAgZWwuZGF0YXNldC5tYXJnaW5fdG9wX3B4ICAgID0gU3RyaW5nKG1fdG9wKTtcclxuXHRcdFx0aWYgKFN0cmluZyhlbC5kYXRhc2V0Lm1hcmdpbl9ib3R0b21fcHgpICE9PSBTdHJpbmcobV9ib3R0b20pKSBlbC5kYXRhc2V0Lm1hcmdpbl9ib3R0b21fcHggPSBTdHJpbmcobV9ib3R0b20pO1xyXG5cdFx0XHRpZiAoU3RyaW5nKGVsLmRhdGFzZXQubWFyZ2luX2xlZnRfcHgpICAgIT09IFN0cmluZyhtX2xlZnQpKSAgIGVsLmRhdGFzZXQubWFyZ2luX2xlZnRfcHggICA9IFN0cmluZyhtX2xlZnQpO1xyXG5cdFx0XHRpZiAoU3RyaW5nKGVsLmRhdGFzZXQubWFyZ2luX3JpZ2h0X3B4KSAgIT09IFN0cmluZyhtX3JpZ2h0KSkgIGVsLmRhdGFzZXQubWFyZ2luX3JpZ2h0X3B4ICA9IFN0cmluZyhtX3JpZ2h0KTtcclxuXHJcblx0XHRcdGlmIChlbC5kYXRhc2V0LmNzc2NsYXNzX2V4dHJhICE9PSBjbHNfZXh0cmEpIGVsLmRhdGFzZXQuY3NzY2xhc3NfZXh0cmEgPSBjbHNfZXh0cmE7XHJcblx0XHRcdGlmIChlbC5kYXRhc2V0Lmh0bWxfaWQgICAgICAgICE9PSBodG1sX2lkKSAgIGVsLmRhdGFzZXQuaHRtbF9pZCAgICAgICAgPSBodG1sX2lkO1xyXG5cdFx0XHRpZiAoZWwuZGF0YXNldC5uYW1lICAgICAgICAgICAhPT0gbmFtZV92YWwpICBlbC5kYXRhc2V0Lm5hbWUgICAgICAgICAgID0gbmFtZV92YWw7XHJcblxyXG5cdFx0XHQvLyBBdHRyaWJ1dGUgZnJhZ21lbnRzIGZvciB0aGUgbGluZSBlbGVtZW50LlxyXG5cdFx0XHRjb25zdCBpZF9hdHRyICAgPSBodG1sX2lkID8gYCBpZD1cIiR7ZWgoaHRtbF9pZCl9XCJgICAgOiAnJztcclxuXHRcdFx0Y29uc3QgbmFtZV9hdHRyID0gbmFtZV92YWwgPyBgIG5hbWU9XCIke2VoKG5hbWVfdmFsKX1cImAgOiAnJztcclxuXHRcdFx0Y29uc3QgY2xzX2F0dHIgID0gY2xzX2V4dHJhID8gYCBjbGFzcz1cIiR7ZWgoY2xzX2V4dHJhKX1cImAgOiAnJztcclxuXHJcblx0XHRcdC8vIENvbXB1dGUgc3R5bGUgZm9yIG1hcmdpbnMgKG91dGVyIHdyYXBwZXIpLlxyXG5cdFx0XHRjb25zdCBvdXRlcl9zdHlsZV9hdHRyID0gYCBzdHlsZT1cIm1hcmdpbjoke21fdG9wfXB4ICR7bV9yaWdodH1weCAke21fYm90dG9tfXB4ICR7bV9sZWZ0fXB4O1wiYDtcclxuXHJcblx0XHRcdC8vIEJ1aWxkIGlubmVyIGxpbmUgbWFya3VwIGJhc2VkIG9uIG9yaWVudGF0aW9uLlxyXG5cdFx0XHRsZXQgbGluZV9odG1sID0gJyc7XHJcblx0XHRcdGlmIChvcmllbnRhdGlvbiA9PT0gJ2hvcml6b250YWwnKSB7XHJcblx0XHRcdFx0Ly8gSG9yaXpvbnRhbDogPGhyPiB1c2luZyBib3JkZXItdG9wLlxyXG5cdFx0XHRcdGNvbnN0IG1sID0gKGFsaWduX25vcm0gPT09ICdsZWZ0JykgID8gJzAnICAgOiAnYXV0byc7XHJcblx0XHRcdFx0Y29uc3QgbXIgPSAoYWxpZ25fbm9ybSA9PT0gJ3JpZ2h0JykgPyAnMCcgICA6ICdhdXRvJztcclxuXHRcdFx0XHRjb25zdCBocl9zdHlsZSA9IFtcclxuXHRcdFx0XHRcdCdib3JkZXI6bm9uZScsXHJcblx0XHRcdFx0XHQnaGVpZ2h0OjAnLFxyXG5cdFx0XHRcdFx0YGJvcmRlci10b3A6JHt0aGlja25lc3NfcHh9cHggJHtsaW5lX3N0eWxlfSAke2NvbG9yX3ZhbH1gLFxyXG5cdFx0XHRcdFx0YHdpZHRoOiR7bGVuZ3RoX3ZhbH1gLFxyXG5cdFx0XHRcdFx0YG1hcmdpbi1sZWZ0OiR7bWx9YCxcclxuXHRcdFx0XHRcdGBtYXJnaW4tcmlnaHQ6JHttcn1gXHJcblx0XHRcdFx0XS5qb2luKCc7Jyk7XHJcblx0XHRcdFx0bGluZV9odG1sID0gYDxociR7Y2xzX2F0dHJ9JHtpZF9hdHRyfSR7bmFtZV9hdHRyfSBzdHlsZT1cIiR7aHJfc3R5bGV9XCI+YDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyBWZXJ0aWNhbDogPGRpdj4gdXNpbmcgYm9yZGVyLWxlZnQgYW5kIGhlaWdodC5cclxuXHRcdFx0XHRsZXQgdl9hbGlnbiA9ICcnO1xyXG5cdFx0XHRcdHZfYWxpZ24gPSAoYWxpZ25fbm9ybSA9PT0gJ3RvcCcpICAgID8gJ3Bvc2l0aW9uOmFic29sdXRlO3RvcDowOycgOiB2X2FsaWduO1xyXG5cdFx0XHRcdHZfYWxpZ24gPSAoYWxpZ25fbm9ybSA9PT0gJ21pZGRsZScpID8gJ3Bvc2l0aW9uOmFic29sdXRlO3RvcDo1MCU7bGVmdDo1MCU7dHJhbnNmb3JtOnRyYW5zbGF0ZSgtNTAlLC01MCUpOycgOiB2X2FsaWduO1xyXG5cdFx0XHRcdHZfYWxpZ24gPSAoYWxpZ25fbm9ybSA9PT0gJ2JvdHRvbScpID8gJ3Bvc2l0aW9uOmFic29sdXRlO2JvdHRvbTowOycgOiB2X2FsaWduO1xyXG5cclxuXHRcdFx0XHRjb25zdCB2cl9zdHlsZSA9IFtcclxuXHRcdFx0XHRcdGBib3JkZXItbGVmdDoke3RoaWNrbmVzc19weH1weCAke2xpbmVfc3R5bGV9ICR7Y29sb3JfdmFsfWAsXHJcblx0XHRcdFx0XHRgaGVpZ2h0OiR7bGVuZ3RoX3ZhbH1gLFxyXG5cdFx0XHRcdFx0YCR7dl9hbGlnbn1gLFxyXG5cdFx0XHRcdFx0J3BhZGRpbmctbGVmdDowJ1xyXG5cdFx0XHRcdF0uam9pbignOycpO1xyXG5cdFx0XHRcdGxpbmVfaHRtbCA9IGA8ZGl2JHtjbHNfYXR0cn0ke2lkX2F0dHJ9JHtuYW1lX2F0dHJ9IHJvbGU9XCJzZXBhcmF0b3JcIiBhcmlhLW9yaWVudGF0aW9uPVwidmVydGljYWxcIiBzdHlsZT1cIiR7dnJfc3R5bGV9XCI+PC9kaXY+YDtcclxuXHRcdFx0fVxyXG5cclxuXHRcdFx0Ly8gT3B0aW9uYWwgaGVscCB0ZXh0IGJlbG93IHRoZSBsaW5lLlxyXG5cdFx0XHRjb25zdCBoZWxwX2h0bWwgPSBkLmhlbHAgPyBgPGRpdiBjbGFzcz1cIndwYmNfYmZiX19oZWxwXCI+JHtlaChTdHJpbmcoZC5oZWxwKSl9PC9kaXY+YCA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gUmVuZGVyIHByZXZpZXcgSFRNTC5cclxuXHRcdFx0ZWwuaW5uZXJIVE1MID0gYFxyXG5cdFx0XHRcdDxzcGFuIGNsYXNzPVwid3BiY19iZmJfX25vYWN0aW9uIHdwYmNfYmZiX19uby1kcmFnLXpvbmVcIiBpbmVydD1cIlwiPlxyXG5cdFx0XHRcdFx0PGRpdiBjbGFzcz1cIndwYmNfYmZiX19maWVsZC1wcmV2aWV3XCIke291dGVyX3N0eWxlX2F0dHJ9PlxyXG5cdFx0XHRcdFx0XHQke2xpbmVfaHRtbH1cclxuXHRcdFx0XHRcdDwvZGl2PlxyXG5cdFx0XHRcdFx0JHtoZWxwX2h0bWx9XHJcblx0XHRcdFx0PC9zcGFuPlxyXG5cdFx0XHRgO1xyXG5cclxuXHRcdFx0Ly8gT3ZlcmxheSAoaGFuZGxlcy90b29sYmFycykuXHJcblx0XHRcdENvcmUuVUk/LldQQkNfQkZCX092ZXJsYXk/LmVuc3VyZT8uKGN0eD8uYnVpbGRlciwgZWwpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogT3B0aW9uYWwgaG9vayBleGVjdXRlZCBhZnRlciBmaWVsZCBpcyBkcm9wcGVkIGZyb20gdGhlIHBhbGV0dGUuXHJcblx0XHQgKlxyXG5cdFx0ICogQHBhcmFtIHtPYmplY3R9ICAgICAgZGF0YVxyXG5cdFx0ICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxcclxuXHRcdCAqIEBwYXJhbSB7e3BhbGV0dGVfaXRlbT86IEhUTUxFbGVtZW50fX0gW2N0eF1cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRzdGF0aWMgb25fZmllbGRfZHJvcChkYXRhLCBlbCwgY3R4KSB7XHJcblx0XHRcdC8vIEtlZXAgYmFzZSBiZWhhdmlvciAoYXV0by1uYW1lLCBldGMuKS5cclxuXHRcdFx0c3VwZXIub25fZmllbGRfZHJvcD8uKGRhdGEsIGVsLCBjdHgpO1xyXG5cclxuXHRcdFx0Ly8gQXBwbHkgb3JpZW50YXRpb24gZnJvbSBwYWxldHRlIGhpbnQgKGRhdGEtb3JpZW50YXRpb24pIG9uY2Ugb24gZHJvcC5cclxuXHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRjb25zdCBzcmMgPSBjdHg/LnBhbGV0dGVfaXRlbTtcclxuXHRcdFx0XHRpZiAoc3JjKSB7XHJcblx0XHRcdFx0XHRjb25zdCBvcmkgPSBzcmMuZ2V0QXR0cmlidXRlKCdkYXRhLW9yaWVudGF0aW9uJyk7XHJcblx0XHRcdFx0XHRpZiAob3JpID09PSAnaG9yaXpvbnRhbCcgfHwgb3JpID09PSAndmVydGljYWwnKSB7XHJcblx0XHRcdFx0XHRcdGVsLmRhdGFzZXQub3JpZW50YXRpb24gPSBvcmk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9IGNhdGNoIChlKSB7fVxyXG5cdFx0fVxyXG5cdH1cclxuXHJcblx0dHJ5IHtcclxuXHRcdHJlZ2lzdHJ5LnJlZ2lzdGVyKCdkaXZpZGVyJywgd3BiY19iZmJfZmllbGRfZGl2aWRlcik7XHJcblx0fSBjYXRjaCAoZSkgeyBfd3BiYz8uZGV2Py5lcnJvcj8uKCd3cGJjX2JmYl9maWVsZF9kaXZpZGVyLnJlZ2lzdGVyJywgZSk7IH1cclxuXHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gRXhwb3J0ZXJzIOKAkyBib29raW5nIGZvcm0gKyDigJxDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGHigJ1cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuXHQvKipcclxuXHQgKiBSZWdpc3RlciBib29raW5nIGZvcm0gZXhwb3J0ZXIgZm9yIFwiZGl2aWRlclwiLlxyXG5cdCAqIE1pcnJvcnMgdGhlIHByZXZpb3VzIGxlZ2FjeSBleHBvcnQgbG9naWMgYnV0IG5vdyBrZXB0IGluc2lkZSB0aGUgcGFjay5cclxuXHQgKi9cclxuXHRmdW5jdGlvbiByZWdpc3Rlcl9kaXZpZGVyX2Zvcm1fZXhwb3J0ZXIoKSB7XHJcblx0XHRpZiAoIXcuV1BCQ19CRkJfRXhwb3J0ZXIgfHwgdHlwZW9mIHcuV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdHcuV1BCQ19CRkJfRXhwb3J0ZXIucmVnaXN0ZXIoJ2RpdmlkZXInLCBmdW5jdGlvbiAoZmllbGQsIGVtaXQsIGV4dHJhcykge1xyXG5cdFx0XHRpZiAoIWZpZWxkIHx8IHR5cGVvZiBlbWl0ICE9PSAnZnVuY3Rpb24nKSByZXR1cm47XHJcblxyXG5cdFx0XHRjb25zdCBjb3JlICAgPSAoZXh0cmFzICYmIGV4dHJhcy5jb3JlKSB8fCB3LldQQkNfQkZCX0NvcmUgfHwge307XHJcblx0XHRcdGNvbnN0IFNhbml0ICA9IGNvcmUuV1BCQ19CRkJfU2FuaXRpemUgfHwge307XHJcblxyXG5cdFx0XHRjb25zdCBlc2NfaHRtbCAgPSBTYW5pdC5lc2NhcGVfaHRtbCAgICAgICA/IFNhbml0LmVzY2FwZV9odG1sLmJpbmQoU2FuaXQpICAgICAgIDogKHMpID0+IFN0cmluZyhzKTtcclxuXHRcdFx0Y29uc3QgY2xzX3Nhbml0ID0gU2FuaXQuc2FuaXRpemVfY3NzX2NsYXNzbGlzdCA/IFNhbml0LnNhbml0aXplX2Nzc19jbGFzc2xpc3QuYmluZChTYW5pdCkgOiAocykgPT4gU3RyaW5nKHMpO1xyXG5cdFx0XHRjb25zdCBzaWQgICAgICAgPSBTYW5pdC5zYW5pdGl6ZV9odG1sX2lkICA/IFNhbml0LnNhbml0aXplX2h0bWxfaWQuYmluZChTYW5pdCkgIDogKHMpID0+IFN0cmluZyhzKTtcclxuXHRcdFx0Y29uc3Qgc25hbWUgICAgID0gU2FuaXQuc2FuaXRpemVfaHRtbF9uYW1lID8gU2FuaXQuc2FuaXRpemVfaHRtbF9uYW1lLmJpbmQoU2FuaXQpIDogKHMpID0+IFN0cmluZyhzKTtcclxuXHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBAcGFyYW0ge2FueX0gdlxyXG5cdFx0XHQgKiBAcGFyYW0ge251bWJlcn0gZGVmXHJcblx0XHRcdCAqIEBwYXJhbSB7bnVtYmVyfSBbbWluXVxyXG5cdFx0XHQgKiBAcGFyYW0ge251bWJlcn0gW21heF1cclxuXHRcdFx0ICogQHJldHVybnMge251bWJlcn1cclxuXHRcdFx0ICovXHJcblx0XHRcdGNvbnN0IHRvX2ludCA9ICh2LCBkZWYsIG1pbiwgbWF4KSA9PiB7XHJcblx0XHRcdFx0bGV0IG4gPSBwYXJzZUludCh2LCAxMCk7XHJcblx0XHRcdFx0aWYgKGlzTmFOKG4pKSBuID0gZGVmO1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgbWluID09PSAnbnVtYmVyJyAmJiBuIDwgbWluKSBuID0gbWluO1xyXG5cdFx0XHRcdGlmICh0eXBlb2YgbWF4ID09PSAnbnVtYmVyJyAmJiBuID4gbWF4KSBuID0gbWF4O1xyXG5cdFx0XHRcdHJldHVybiBuO1xyXG5cdFx0XHR9O1xyXG5cclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIEBwYXJhbSB7YW55fSB2XHJcblx0XHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBkZWZcclxuXHRcdFx0ICogQHJldHVybnMge3N0cmluZ31cclxuXHRcdFx0ICovXHJcblx0XHRcdGNvbnN0IHRvX3N0ciA9ICh2LCBkZWYpID0+ICh2ID09IG51bGwgfHwgdiA9PT0gJycpID8gZGVmIDogU3RyaW5nKHYpO1xyXG5cclxuXHRcdFx0Ly8gTm9ybWFsaXplIGFnYWluc3QgZGVmYXVsdHMgKHNjaGVtYS1kcml2ZW4pLlxyXG5cdFx0XHRjb25zdCBkID0gd3BiY19iZmJfZmllbGRfZGl2aWRlci5ub3JtYWxpemVfZGF0YShmaWVsZCk7XHJcblxyXG5cdFx0XHQvLyAtLS0tIHJlYWQgJiBzYW5pdGl6ZSBwcm9wcyAoa2VlcCBpbiBzeW5jIHdpdGggcHJldmlldy9zY2hlbWEpIC0tLS1cclxuXHRcdFx0LyoqIEB0eXBlIHsnaG9yaXpvbnRhbCd8J3ZlcnRpY2FsJ30gKi9cclxuXHRcdFx0Y29uc3Qgb3JpZW50YXRpb24gICA9ICh0b19zdHIoZC5vcmllbnRhdGlvbiwgJ2hvcml6b250YWwnKSA9PT0gJ3ZlcnRpY2FsJykgPyAndmVydGljYWwnIDogJ2hvcml6b250YWwnO1xyXG5cdFx0XHRjb25zdCBsaW5lX3N0eWxlX2luID0gdG9fc3RyKGQubGluZV9zdHlsZSwgJ3NvbGlkJyk7XHJcblx0XHRcdC8qKiBAdHlwZSB7J3NvbGlkJ3wnZGFzaGVkJ3wnZG90dGVkJ30gKi9cclxuXHRcdFx0Y29uc3QgbGluZV9zdHlsZSAgICA9ICh7IHNvbGlkOjEsIGRhc2hlZDoxLCBkb3R0ZWQ6MSB9KVsgbGluZV9zdHlsZV9pbiBdID8gbGluZV9zdHlsZV9pbiA6ICdzb2xpZCc7XHJcblxyXG5cdFx0XHRjb25zdCB0aGlja25lc3NfcHggID0gdG9faW50KGQudGhpY2tuZXNzX3B4LCAxLCAxLCAyMCk7XHJcblx0XHRcdGNvbnN0IGxlbmd0aF92YWwgICAgPSB0b19zdHIoZC5sZW5ndGgsICcxMDAlJyk7XHJcblx0XHRcdGNvbnN0IGFsaWduX25vcm0gICAgPSB3cGJjX2JmYl9maWVsZF9kaXZpZGVyLm5vcm1hbGl6ZV9hbGlnbihcclxuXHRcdFx0XHRvcmllbnRhdGlvbixcclxuXHRcdFx0XHR0b19zdHIoZC5hbGlnbiwgb3JpZW50YXRpb24gPT09ICd2ZXJ0aWNhbCcgPyAnbWlkZGxlJyA6ICdjZW50ZXInKVxyXG5cdFx0XHQpOyAgLy8gYWNjZXB0IGJvdGggc2V0czsgbm9ybWFsaXplIHRvIG9yaWVudGF0aW9uLWFwcHJvcHJpYXRlIHRva2VuLlxyXG5cdFx0XHRjb25zdCBjb2xvcl92YWwgICAgID0gdG9fc3RyKGQuY29sb3IsICcjZTBlMGUwJyk7XHJcblxyXG5cdFx0XHRjb25zdCBtdCA9IHRvX2ludChkLm1hcmdpbl90b3BfcHgsICAgIDgsIDAsIDIwMCk7XHJcblx0XHRcdGNvbnN0IG1iID0gdG9faW50KGQubWFyZ2luX2JvdHRvbV9weCwgOCwgMCwgMjAwKTtcclxuXHRcdFx0Y29uc3QgbWwgPSB0b19pbnQoZC5tYXJnaW5fbGVmdF9weCwgICA4LCAwLCAyMDApO1xyXG5cdFx0XHRjb25zdCBtciA9IHRvX2ludChkLm1hcmdpbl9yaWdodF9weCwgIDgsIDAsIDIwMCk7XHJcblxyXG5cdFx0XHRjb25zdCBodG1sX2lkICAgPSBkLmh0bWxfaWQgPyBzaWQoU3RyaW5nKGQuaHRtbF9pZCkpIDogJyc7XHJcblx0XHRcdGNvbnN0IG5hbWVfdmFsICA9IGQubmFtZSAgICA/IHNuYW1lKFN0cmluZyhkLm5hbWUpKSAgOiAnJztcclxuXHRcdFx0Y29uc3QgY2xzX2V4dHJhID0gY2xzX3Nhbml0KFN0cmluZyhkLmNzc2NsYXNzX2V4dHJhIHx8IGQuY3NzY2xhc3MgfHwgZC5jbGFzcyB8fCAnJykpO1xyXG5cclxuXHRcdFx0Y29uc3QgaWRfYXR0ciAgID0gaHRtbF9pZCA/IGAgaWQ9XCIke2VzY19odG1sKGh0bWxfaWQpfVwiYCA6ICcnO1xyXG5cdFx0XHRjb25zdCBuYW1lX2F0dHIgPSBuYW1lX3ZhbCA/IGAgbmFtZT1cIiR7ZXNjX2h0bWwobmFtZV92YWwpfVwiYCA6ICcnO1xyXG5cclxuXHRcdFx0Ly8gV3JhcCBzdHlsZXMgKG1hcmdpbnMgYXBwbGllZCBvbiB0aGUgd3JhcHBlciwgbm90IHRoZSBsaW5lIGl0c2VsZikuXHJcblx0XHRcdC8vIEluIHZlcnRpY2FsIG1vZGUgd2UgYWxzbyBtYWtlIHRoZSB3cmFwcGVyIGZsZXggYW5kIHN0cmV0Y2ggc28gaGVpZ2h0OjEwMCUgcmVzb2x2ZXMuXHJcblx0XHRcdGNvbnN0IHdyYXBwZXJfc3R5bGVzID0gW1xyXG5cdFx0XHRcdGBtYXJnaW46JHttdH1weCAke21yfXB4ICR7bWJ9cHggJHttbH1weGAsXHJcblx0XHRcdFx0KG9yaWVudGF0aW9uID09PSAndmVydGljYWwnKSA/ICdkaXNwbGF5OmZsZXgnIDogJycsXHJcblx0XHRcdFx0KG9yaWVudGF0aW9uID09PSAndmVydGljYWwnKSA/ICdhbGlnbi1zZWxmOnN0cmV0Y2gnIDogJydcclxuXHRcdFx0XS5maWx0ZXIoQm9vbGVhbikuam9pbignOyAnKTtcclxuXHRcdFx0Y29uc3Qgd3JhcHBlcl9hdHRyID0gd3JhcHBlcl9zdHlsZXMgPyBgIHN0eWxlPVwiJHtlc2NfaHRtbCh3cmFwcGVyX3N0eWxlcyl9XCJgIDogJyc7XHJcblxyXG5cdFx0XHRsZXQgbGluZV9odG1sID0gJyc7XHJcblx0XHRcdGlmIChvcmllbnRhdGlvbiA9PT0gJ2hvcml6b250YWwnKSB7XHJcblx0XHRcdFx0Ly8gSG9yaXpvbnRhbCBkaXZpZGVyIHZpYSA8aHI+IHdpdGggYm9yZGVyLXRvcFxyXG5cdFx0XHRcdGNvbnN0IG1sX2F1dG8gICA9IChhbGlnbl9ub3JtID09PSAnbGVmdCcpICA/ICcwJyA6ICdhdXRvJztcclxuXHRcdFx0XHRjb25zdCBtcl9hdXRvICAgPSAoYWxpZ25fbm9ybSA9PT0gJ3JpZ2h0JykgPyAnMCcgOiAnYXV0byc7XHJcblx0XHRcdFx0Y29uc3QgaHJfc3R5bGVzID0gW1xyXG5cdFx0XHRcdFx0J2JvcmRlcjpub25lJyxcclxuXHRcdFx0XHRcdCdoZWlnaHQ6MCcsXHJcblx0XHRcdFx0XHRgYm9yZGVyLXRvcDoke3RoaWNrbmVzc19weH1weCAke2xpbmVfc3R5bGV9ICR7Y29sb3JfdmFsfWAsXHJcblx0XHRcdFx0XHRgd2lkdGg6JHtsZW5ndGhfdmFsfWAsXHJcblx0XHRcdFx0XHRgbWFyZ2luLWxlZnQ6JHttbF9hdXRvfWAsXHJcblx0XHRcdFx0XHRgbWFyZ2luLXJpZ2h0OiR7bXJfYXV0b31gXHJcblx0XHRcdFx0XS5qb2luKCc7ICcpO1xyXG5cdFx0XHRcdGxpbmVfaHRtbCA9IGA8aHIke2lkX2F0dHJ9JHtuYW1lX2F0dHJ9IGNsYXNzPVwid3BiY19iZmJfZGl2aWRlciB3cGJjX2JmYl9kaXZpZGVyLS1oJHtjbHNfZXh0cmEgPyAnICcgKyBlc2NfaHRtbChjbHNfZXh0cmEpIDogJyd9XCIgc3R5bGU9XCIke2VzY19odG1sKGhyX3N0eWxlcyl9XCI+YDtcclxuXHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHQvLyBWZXJ0aWNhbCBkaXZpZGVyIHZpYSA8ZGl2PiB3aXRoIGJvcmRlci1sZWZ0OyBoZWlnaHQgPSBsZW5ndGhcclxuXHRcdFx0XHQvLyAocG9zaXRpb25pbmcgaGFuZGxlZCBjbGllbnQtc2lkZTsgZXhwb3J0IGtlZXBzIHRoZSBzYW1lIGlubGluZSBzdHlsZSBzZXQpXHJcblx0XHRcdFx0Ly8gYWxpZ25fbm9ybSBpcyAndG9wJ3wnbWlkZGxlJ3wnYm90dG9tJyBoZXJlLlxyXG5cdFx0XHRcdGxldCB2cl9zdHlsZXNfYWxpZ24gPSAnJztcclxuXHRcdFx0XHR2cl9zdHlsZXNfYWxpZ24gPSAoYWxpZ25fbm9ybSA9PT0gJ3RvcCcpICAgID8gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTt0b3A6IDA7JyA6IHZyX3N0eWxlc19hbGlnbjtcclxuXHRcdFx0XHR2cl9zdHlsZXNfYWxpZ24gPSAoYWxpZ25fbm9ybSA9PT0gJ21pZGRsZScpID8gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTt0b3A6IDUwJTtsZWZ0OiA1MCU7dHJhbnNmb3JtOiB0cmFuc2xhdGUoLTUwJSwgLTUwJSk7JyA6IHZyX3N0eWxlc19hbGlnbjtcclxuXHRcdFx0XHR2cl9zdHlsZXNfYWxpZ24gPSAoYWxpZ25fbm9ybSA9PT0gJ2JvdHRvbScpID8gJ3Bvc2l0aW9uOiBhYnNvbHV0ZTtib3R0b206MDsnIDogdnJfc3R5bGVzX2FsaWduO1xyXG5cclxuXHRcdFx0XHRjb25zdCB2cl9zdHlsZXMgPSBbXHJcblx0XHRcdFx0XHRgYm9yZGVyLWxlZnQ6JHt0aGlja25lc3NfcHh9cHggJHtsaW5lX3N0eWxlfSAke2NvbG9yX3ZhbH1gLFxyXG5cdFx0XHRcdFx0YGhlaWdodDoke2xlbmd0aF92YWx9YCxcclxuXHRcdFx0XHRcdCdwYWRkaW5nLWxlZnQ6MCcsXHJcblx0XHRcdFx0XHR2cl9zdHlsZXNfYWxpZ25cclxuXHRcdFx0XHRdLmpvaW4oJzsgJyk7XHJcblxyXG5cdFx0XHRcdGxpbmVfaHRtbCA9IGA8ZGl2JHtpZF9hdHRyfSR7bmFtZV9hdHRyfSBjbGFzcz1cIndwYmNfYmZiX2RpdmlkZXIgd3BiY19iZmJfZGl2aWRlci0tdiR7Y2xzX2V4dHJhID8gJyAnICsgZXNjX2h0bWwoY2xzX2V4dHJhKSA6ICcnfVwiIHJvbGU9XCJzZXBhcmF0b3JcIiBhcmlhLW9yaWVudGF0aW9uPVwidmVydGljYWxcIiBzdHlsZT1cIiR7ZXNjX2h0bWwodnJfc3R5bGVzKX1cIj48L2Rpdj5gO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHQvLyBPdXRwdXQ6IGEgc21hbGwgd3JhcHBlciBzbyBDU1MgY2FuIHRhcmdldCBleHBvcnQgc2FmZWx5IChubyBidWlsZGVyLW9ubHkgY2xhc3NlcykuXHJcblx0XHRcdGVtaXQoXHJcblx0XHRcdFx0YDxkaXYgY2xhc3M9XCJ3cGJjX2JmYl9kaXZpZGVyX3dyYXBcIiBkYXRhLWJmYi10eXBlPVwiZGl2aWRlclwiIGRhdGEtb3JpZW50YXRpb249XCIke29yaWVudGF0aW9ufVwiJHt3cmFwcGVyX2F0dHJ9PiR7bGluZV9odG1sfTwvZGl2PmBcclxuXHRcdFx0KTtcclxuXHJcblx0XHRcdC8vIE5PVEU6IEhlbHAgdGV4dCBpcyBhcHBlbmRlZCBieSBXUEJDX0JGQl9FeHBvcnRlci5yZW5kZXJfZmllbGRfbm9kZSgpIGFmdGVyIHRoaXMgZXhwb3J0ZXIgcnVucy5cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0LyoqXHJcblx0ICogUmVnaXN0ZXIgZW1wdHkgY29udGVudCBleHBvcnRlciBmb3IgXCJkaXZpZGVyXCIgc28gaXQgZXhwbGljaXRseSBvdXRwdXRzIG5vdGhpbmdcclxuXHQgKiBpbiDigJxDb250ZW50IG9mIGJvb2tpbmcgZmllbGRzIGRhdGHigJ0uXHJcblx0ICovXHJcblx0ZnVuY3Rpb24gcmVnaXN0ZXJfZGl2aWRlcl9jb250ZW50X2V4cG9ydGVyKCkge1xyXG5cdFx0aWYgKCF3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlciB8fCB0eXBlb2Ygdy5XUEJDX0JGQl9Db250ZW50RXhwb3J0ZXIucmVnaXN0ZXIgIT09ICdmdW5jdGlvbicpIHtcclxuXHRcdFx0cmV0dXJuO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIERpdmlkZXIgaXMgcHVyZWx5IHZpc3VhbDsgbm90aGluZyB0byBzaG93IGluIGNvbnRlbnQgdGVtcGxhdGUuXHJcblx0XHR3LldQQkNfQkZCX0NvbnRlbnRFeHBvcnRlci5yZWdpc3RlcignZGl2aWRlcicsIGZ1bmN0aW9uIChfZmllbGQsIF9lbWl0LCBfY3R4KSB7XHJcblx0XHRcdC8vIEludGVudGlvbmFsbHkgZW1wdHkg4oCTIGV4cGxpY2l0IG5vLW9wIGZvciBjb250ZW50IGV4cG9ydC5cclxuXHRcdH0pO1xyXG5cdH1cclxuXHJcblx0Ly8gSW1tZWRpYXRlIHJlZ2lzdHJhdGlvbiBpZiBleHBvcnRlcnMgYXJlIGFscmVhZHkgbG9hZGVkLlxyXG5cdHRyeSB7XHJcblx0XHRyZWdpc3Rlcl9kaXZpZGVyX2Zvcm1fZXhwb3J0ZXIoKTtcclxuXHR9IGNhdGNoIChlKSB7IF93cGJjPy5kZXY/LmVycm9yPy4oJ3dwYmNfYmZiX2ZpZWxkX2RpdmlkZXIuZXhwb3J0ZXInLCBlKTsgfVxyXG5cclxuXHR0cnkge1xyXG5cdFx0cmVnaXN0ZXJfZGl2aWRlcl9jb250ZW50X2V4cG9ydGVyKCk7XHJcblx0fSBjYXRjaCAoZSkgeyBfd3BiYz8uZGV2Py5lcnJvcj8uKCd3cGJjX2JmYl9maWVsZF9kaXZpZGVyLmNvbnRlbnRfZXhwb3J0ZXInLCBlKTsgfVxyXG5cclxuXHQvLyBEZWZlcnJlZCByZWdpc3RyYXRpb24gd2hlbiBidWlsZGVyLWV4cG9ydGVyLmpzIGZpcmVzIGl0cyByZWFkeSBldmVudHMuXHJcblx0ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignd3BiYzpiZmI6ZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9kaXZpZGVyX2Zvcm1fZXhwb3J0ZXIpO1xyXG5cdGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3dwYmM6YmZiOmNvbnRlbnQtZXhwb3J0ZXItcmVhZHknLCByZWdpc3Rlcl9kaXZpZGVyX2NvbnRlbnRfZXhwb3J0ZXIpO1xyXG5cclxuXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvLyBJbnNwZWN0b3IgVVg6IGVuYWJsZS9kaXNhYmxlIGFsaWduIG9wdGlvbnMgZGVwZW5kaW5nIG9uIG9yaWVudGF0aW9uXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHQvKipcclxuXHQgKiBBdHRhY2ggaW5zcGVjdG9yIGxvZ2ljIHRvIGVuYWJsZS9kaXNhYmxlIGFsaWduIG9wdGlvbnMgYmFzZWQgb24gb3JpZW50YXRpb24uXHJcblx0ICogVXNlcyBkYXRhLWluc3BlY3Rvci1rZXkgc2VsZWN0b3JzIHByb2R1Y2VkIGJ5IHRoZSBGYWN0b3J5IGluc3BlY3Rvci5cclxuXHQgKi9cclxuXHQoZnVuY3Rpb24gYXR0YWNoX2FsaWduX3RvZ2dsZSgpIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEZpbmQgYSA8c2VsZWN0PiBmb3IgYSBnaXZlbiBpbnNwZWN0b3Iga2V5IHdpdGhpbiBhIHJvb3QuXHJcblx0XHQgKiBAcGFyYW0ge1BhcmVudE5vZGV9IHJvb3RcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuXHRcdCAqIEByZXR1cm5zIHtIVE1MU2VsZWN0RWxlbWVudHxudWxsfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiBnZXRfc2VsKHJvb3QsIGtleSkge1xyXG5cdFx0XHRyZXR1cm4gLyoqIEB0eXBlIHtIVE1MU2VsZWN0RWxlbWVudHxudWxsfSAqLyAocm9vdC5xdWVyeVNlbGVjdG9yKGBzZWxlY3RbZGF0YS1pbnNwZWN0b3Ita2V5PVwiJHtrZXl9XCJdYCkpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogTG9jYXRlIHRoZSBpbnNwZWN0b3Igcm9vdCAoZmFsbHMgYmFjayB0byBkb2N1bWVudCkuXHJcblx0XHQgKiBAcmV0dXJucyB7UGFyZW50Tm9kZX1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gZmluZF9pbnNwZWN0b3Jfcm9vdCgpIHtcclxuXHRcdFx0cmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy53cGJjX2JmYl9faW5zcGVjdG9yJykgfHwgZG9jdW1lbnQ7XHJcblx0XHR9XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBFbmFibGUvZGlzYWJsZSBhbGlnbiBvcHRpb25zIGRlcGVuZGluZyBvbiBvcmllbnRhdGlvbi5cclxuXHRcdCAqIElmIHRoZSBjdXJyZW50IHZhbHVlIGJlY29tZXMgaW52YWxpZCwgcmVtYXAgdG8gYSB2YWxpZCBjb3VudGVycGFydC5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge0hUTUxTZWxlY3RFbGVtZW50fSBvcmlTZWxcclxuXHRcdCAqIEBwYXJhbSB7SFRNTFNlbGVjdEVsZW1lbnR9IGFsaWduU2VsXHJcblx0XHQgKiBAcmV0dXJucyB7dm9pZH1cclxuXHRcdCAqL1xyXG5cdFx0ZnVuY3Rpb24gc2V0X2Rpc2FibGVkX29wdGlvbnMob3JpU2VsLCBhbGlnblNlbCkge1xyXG5cdFx0XHRpZiAoIW9yaVNlbCB8fCAhYWxpZ25TZWwpIHJldHVybjtcclxuXHRcdFx0Y29uc3Qgb3JpID0gU3RyaW5nKG9yaVNlbC52YWx1ZSkgPT09ICd2ZXJ0aWNhbCcgPyAndmVydGljYWwnIDogJ2hvcml6b250YWwnO1xyXG5cdFx0XHRjb25zdCBIICAgPSBuZXcgU2V0KFsnbGVmdCcsICdjZW50ZXInLCAncmlnaHQnXSk7XHJcblx0XHRcdGNvbnN0IFYgICA9IG5ldyBTZXQoWyd0b3AnLCAnbWlkZGxlJywgJ2JvdHRvbSddKTtcclxuXHJcblx0XHRcdEFycmF5LmZyb20oYWxpZ25TZWwub3B0aW9ucykuZm9yRWFjaCgob3B0KSA9PiB7XHJcblx0XHRcdFx0Y29uc3QgdiAgICAgICA9IFN0cmluZyhvcHQudmFsdWUpO1xyXG5cdFx0XHRcdGNvbnN0IGRpc2FibGUgPSAob3JpID09PSAndmVydGljYWwnICYmIEguaGFzKHYpKSB8fCAob3JpID09PSAnaG9yaXpvbnRhbCcgJiYgVi5oYXModikpO1xyXG5cdFx0XHRcdG9wdC5kaXNhYmxlZCAgPSBkaXNhYmxlO1xyXG5cdFx0XHRcdG9wdC5oaWRkZW4gICAgPSBkaXNhYmxlOyAvLyBoaWRlIHZpc3VhbGx5IGFzIHdlbGxcclxuXHRcdFx0fSk7XHJcblxyXG5cdFx0XHQvLyBJZiBjdXJyZW50IHZhbHVlIGlzIGRpc2FibGVkLCByZW1hcCB0byBhIHZhbGlkIGNvdW50ZXJwYXJ0LlxyXG5cdFx0XHRjb25zdCBjdXIgPSBTdHJpbmcoYWxpZ25TZWwudmFsdWUpO1xyXG5cdFx0XHRpZiAoKG9yaSA9PT0gJ3ZlcnRpY2FsJyAmJiBILmhhcyhjdXIpKSB8fCAob3JpID09PSAnaG9yaXpvbnRhbCcgJiYgVi5oYXMoY3VyKSkpIHtcclxuXHRcdFx0XHRjb25zdCBtYXBIICAgICA9IHsgdG9wOiAnbGVmdCcsIG1pZGRsZTogJ2NlbnRlcicsIGJvdHRvbTogJ3JpZ2h0JyB9O1xyXG5cdFx0XHRcdGNvbnN0IG1hcFYgICAgID0geyBsZWZ0OiAndG9wJywgY2VudGVyOiAnbWlkZGxlJywgcmlnaHQ6ICdib3R0b20nIH07XHJcblx0XHRcdFx0YWxpZ25TZWwudmFsdWUgPSAob3JpID09PSAndmVydGljYWwnKSA/IChtYXBWWy8qKiBAdHlwZSBrZXlvZiB0eXBlb2YgbWFwViAqLyhjdXIpXSB8fCAnbWlkZGxlJylcclxuXHRcdFx0XHQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IChtYXBIWy8qKiBAdHlwZSBrZXlvZiB0eXBlb2YgbWFwSCAqLyhjdXIpXSB8fCAnY2VudGVyJyk7XHJcblx0XHRcdFx0Ly8gVHJpZ2dlciBjaGFuZ2Ugc28gZGF0YSBiaW5kaW5nIHVwZGF0ZXMuXHJcblx0XHRcdFx0YWxpZ25TZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XHJcblx0XHRcdH1cclxuXHRcdH1cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFJlZnJlc2ggb3JpZW50YXRpb24vYWxpZ24gY291cGxpbmcgZm9yIHRoZSBjdXJyZW50IGluc3BlY3Rvci5cclxuXHRcdCAqIEByZXR1cm5zIHt2b2lkfVxyXG5cdFx0ICovXHJcblx0XHRmdW5jdGlvbiByZWZyZXNoKCkge1xyXG5cdFx0XHRjb25zdCByb290ICAgICA9IGZpbmRfaW5zcGVjdG9yX3Jvb3QoKTtcclxuXHRcdFx0Y29uc3Qgb3JpU2VsICAgPSBnZXRfc2VsKHJvb3QsICdvcmllbnRhdGlvbicpO1xyXG5cdFx0XHRjb25zdCBhbGlnblNlbCA9IGdldF9zZWwocm9vdCwgJ2FsaWduJyk7XHJcblx0XHRcdGlmIChvcmlTZWwgJiYgYWxpZ25TZWwpIHNldF9kaXNhYmxlZF9vcHRpb25zKG9yaVNlbCwgYWxpZ25TZWwpO1xyXG5cdFx0fVxyXG5cclxuXHRcdC8vIFJlYWN0IHRvIGNoYW5nZXMgb2YgdGhlIE9yaWVudGF0aW9uIGNvbnRyb2wuXHJcblx0XHRkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoZSkgPT4ge1xyXG5cdFx0XHRjb25zdCB0ID0gLyoqIEB0eXBlIHtFbGVtZW50fG51bGx9ICovIChlLnRhcmdldCk7XHJcblx0XHRcdGlmICghdCkgcmV0dXJuO1xyXG5cdFx0XHRpZiAodC5tYXRjaGVzKCdzZWxlY3RbZGF0YS1pbnNwZWN0b3Ita2V5PVwib3JpZW50YXRpb25cIl0nKSkge1xyXG5cdFx0XHRcdHJlcXVlc3RBbmltYXRpb25GcmFtZShyZWZyZXNoKTtcclxuXHRcdFx0fVxyXG5cdFx0fSwgdHJ1ZSk7XHJcblxyXG5cdFx0Ly8gQWxzbyByZWFjdCB0byBpbnNwZWN0b3IgcmUtcmVuZGVycy5cclxuXHRcdGNvbnN0IG1vID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlZnJlc2gpKTtcclxuXHRcdG1vLm9ic2VydmUoZG9jdW1lbnQuYm9keSwgeyBjaGlsZExpc3Q6IHRydWUsIHN1YnRyZWU6IHRydWUgfSk7XHJcblxyXG5cdFx0Ly8gSW5pdGlhbCBwYXNzLlxyXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKHJlZnJlc2gpO1xyXG5cdH0pKCk7XHJcblxyXG59KSh3aW5kb3cpO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQSxDQUFDLFVBQVVBLENBQUMsRUFBRTtFQUNiLFlBQVk7O0VBRVo7RUFDQSxJQUFJQyxJQUFJLEdBQU9ELENBQUMsQ0FBQ0UsYUFBYSxJQUFJLENBQUMsQ0FBQztFQUNwQyxJQUFJQyxRQUFRLEdBQUdGLElBQUksQ0FBQ0csZ0NBQWdDO0VBQ3BELElBQUlDLElBQUksR0FBT0osSUFBSSxDQUFDSyxtQkFBbUI7RUFFdkMsSUFBSSxDQUFDSCxRQUFRLElBQUksT0FBT0EsUUFBUSxDQUFDSSxRQUFRLEtBQUssVUFBVSxJQUFJLENBQUNGLElBQUksRUFBRTtJQUNsRUcsS0FBSyxFQUFFQyxHQUFHLEVBQUVDLEtBQUssR0FBRyx3QkFBd0IsRUFBRSw0QkFBNEIsQ0FBQztJQUMzRTtFQUNEOztFQUVBO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNDLE1BQU1DLHNCQUFzQixTQUFTTixJQUFJLENBQUM7SUFFekM7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0lBQ0UsT0FBT08sWUFBWUEsQ0FBQSxFQUFHO01BQ3JCLE9BQU87UUFDTkMsSUFBSSxFQUFjLFNBQVM7UUFDM0JDLFdBQVcsRUFBTyxZQUFZO1FBQUU7UUFDaENDLFVBQVUsRUFBUSxPQUFPO1FBQU87UUFDaENDLFlBQVksRUFBTSxDQUFDO1FBQ25CQyxNQUFNLEVBQVksTUFBTTtRQUFRO1FBQ2hDQyxLQUFLLEVBQWEsUUFBUTtRQUFNO1FBQ2hDQyxLQUFLLEVBQWEsU0FBUztRQUMzQkMsYUFBYSxFQUFLLENBQUM7UUFDbkJDLGdCQUFnQixFQUFFLENBQUM7UUFDbkJDLGNBQWMsRUFBSSxDQUFDO1FBQ25CQyxlQUFlLEVBQUcsQ0FB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

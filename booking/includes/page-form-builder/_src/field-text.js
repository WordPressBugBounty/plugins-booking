// ---------------------------------------------------------------------------------------------------------------------
// == File  /_out/field-text.js ==  Time point: 2025-08-21 17:39
// ---------------------------------------------------------------------------------------------------------------------
(function () {
	"use strict";

	const Core     = window.WPBC_BFB_Core || {};
	const Registry = Core.WPBC_BFB_Field_Renderer_Registry;
	const Sanit    = Core.WPBC_BFB_Sanitize;

	if ( ! Registry || ! Sanit ) {
		console.error( "[WPBC] Core not ready: load bfb-core.iife.js before field-text.js" );
		return;
	}

	class WPBC_BFB_Field_Text {

		/**
		 * @param {Object} data
		 * @param {string} [label='']
		 * @param {string} [id='']
		 */
		constructor(data, label = "", id = "") {
			this.data  = data || {};
			this.label = (label != null ? String( label ) : (this.data.label || ""));
			this.id    = (id != null ? String( id ) : (this.data.id || ""));
		}

		/** @returns {string} HTML for the preview canvas */
		render() {
			const d    = this.data || {};
			const type = d.type || "text";

			const htmlId  = d.html_id ? Sanit.sanitize_html_id( String( d.html_id ) ) : "";
			const rawName = (d.name != null && d.name !== "") ? d.name : (this.id || d.id || "field");
			const nameVal = Sanit.sanitize_html_name( String( rawName ) );

			const lbl     = this.label;
			const isReq   = (d.required === true || d.required === "true" || d.required === 1 || d.required === "1");
			const reqAttr = isReq ? ' required aria-required="true"' : "";

			const labelHTML = (lbl !== "")
				? `<label class="wpbc_bfb__field-label"${htmlId ? ` for="${Sanit.escape_html( htmlId )}"` : ""}>${Sanit.escape_html( lbl )}${isReq ? ' <span aria-hidden="true">*</span>' : ""}</label>`
				: "";

			const ph       = (d.placeholder != null) ? String( d.placeholder ) : lbl;
			const cls      = d.cssclass ? ` ${Sanit.sanitize_css_classlist( String( d.cssclass ) )}` : "";
			const minNum   = Number( d.minlength );
			const maxNum   = Number( d.maxlength );
			const minAttr  = Number.isFinite( minNum ) ? ` minlength="${minNum}"` : "";
			const maxAttr  = Number.isFinite( maxNum ) ? ` maxlength="${maxNum}"` : "";
			const patAttr  = d.pattern ? ` pattern="${Sanit.escape_html( String( d.pattern ) )}"` : "";
			const idAttr   = htmlId ? ` id="${Sanit.escape_html( htmlId )}"` : "";
			const nameAttr = ` name="${Sanit.escape_html( nameVal )}"`;

			return `
					<span class="wpbc_bfb__noaction wpbc_bfb__no-drag-zone" inert>
						${labelHTML}
						<span class="wpbc_wrap_text wpdev-form-control-wrap">
							<input type="${Sanit.escape_html( type )}" class="wpbc_bfb__preview-input${cls}"
								placeholder="${Sanit.escape_html( ph )}"${idAttr}${nameAttr}${reqAttr}${minAttr}${maxAttr}${patAttr}
								autocomplete="off"
								tabindex="-1"
								aria-disabled="true"
								 />
						</span>
						${d.help ? `<div class="wpbc_bfb__help">${Sanit.escape_html( String( d.help ) )}</div>` : ""}
					</span>
				  `;
		}

		// Keep just the essentials for flexibility:
		static get_default_data() {
			return {
				type       : "text",
				label      : "Text",
				name       : "text",
				placeholder: "",
				required   : false,
				minlength  : "",
				maxlength  : "",
				pattern    : "",
				cssclass   : "",
				help       : ""
			};
		}

		static on_field_drop(data, el, { context }) {
			if ( context === "drop" && ! Object.prototype.hasOwnProperty.call( data, "label" ) ) {
				data.label = "Text";
				el.setAttribute( "data-label", "Text" );
			}
		}

		static after_render(){/* optional */}
	}

	// Register with the central registry.
	Registry.register( "text", WPBC_BFB_Field_Text );
})();

var WPBC_BFB_Field_Renderers = (function (obj) {

	class WPBC_BFB_Field_Textarea {
		constructor(data, label = '', id = '') {
			this.data  = data;
			this.label = label;
			this.id    = id;
		}

		render() {
			return `<textarea placeholder="${this.label}" class="wpbc_bfb__preview-textarea"></textarea>`;
		}

		get_supported_attributes() {
			return [ 'label', 'placeholder', 'required', 'maxlength', 'rows' ];
		}

		static get_default_data() {
			return {
				type       : 'textarea',
				label      : 'Textarea Field',
				placeholder: 'Enter message'
			};
		}
	}

	obj.textarea = WPBC_BFB_Field_Textarea;

	return obj;

})( WPBC_BFB_Field_Renderers || {} );

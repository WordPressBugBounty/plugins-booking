var WPBC_BFB_Field_Renderers = (function (obj) {

	class WPBC_BFB_Field_Checkbox {
		constructor(data, label = '', id = '') {
			this.data  = data;
			this.label = label;
			this.id    = id;
		}

		render() {
			return `<label><input type="checkbox" /> ${this.label}</label>`;
		}

		get_supported_attributes() {
			return [ 'label', 'checked', 'required' ];
		}

		static get_default_data() {
			return {
				type : 'checkbox',
				label: 'I agree'
			};
		}
	}

	obj.checkbox = WPBC_BFB_Field_Checkbox;

	return obj;

})( WPBC_BFB_Field_Renderers || {} );

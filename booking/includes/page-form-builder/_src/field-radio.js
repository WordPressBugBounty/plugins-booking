var WPBC_BFB_Field_Renderers = (function (obj) {

	class WPBC_BFB_Field_Radio {
		constructor(data, label = '', id = '') {
			this.data  = data;
			this.label = label;
			this.id    = id;
		}

		render() {
			return `
				<label><input type="radio" name="${this.id}" /> Option 1</label><br>
				<label><input type="radio" name="${this.id}" /> Option 2</label>
			`;
		}

		get_supported_attributes() {
			return [ 'label', 'options', 'required' ];
		}

		static get_default_data() {
			return {
				type   : 'radio',
				label  : 'Choose Option',
				options: [ 'Option 1', 'Option 2' ]
			};
		}
	}

	obj.radio = WPBC_BFB_Field_Radio;

	return obj;

})( WPBC_BFB_Field_Renderers || {} );

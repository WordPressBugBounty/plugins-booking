var WPBC_BFB_Field_Renderers = (function (obj) {

	class WPBC_BFB_Field_Select {
		constructor(data, label = '', id = '') {
			this.data  = data;
			this.label = label;
			this.id    = id;
		}

		render() {
			return `
				<select class="wpbc_bfb__preview-select">
					<option>${this.label} 1</option>
					<option>${this.label} 2</option>
					<option>${this.label} D</option>
				</select>
			`;
		}

		get_supported_attributes() {
			return [ 'label', 'options', 'required' ];
		}

		static get_default_data() {
			return {
				type   : 'selectbox',
				label  : 'Select Field',
				options: [ 'Option 1', 'Option 2', 'Option D' ]
			};
		}
	}

	obj.selectbox = WPBC_BFB_Field_Select;

	return obj;

})( WPBC_BFB_Field_Renderers || {} );

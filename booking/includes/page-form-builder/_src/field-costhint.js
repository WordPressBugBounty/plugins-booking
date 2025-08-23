var WPBC_BFB_Field_Renderers = (function (obj) {

	class WPBC_BFB_Field_Costhint {
		constructor(data, label = '', id = '') {
			this.data  = data;
			this.label = label;
			this.id    = id;
		}

		render() {
			return `<span class="wpbc_bfb__preview-costhint">${WPBC_BFB_Field_Costhint.get_default_data().currency} ${WPBC_BFB_Field_Costhint.get_default_data().amount}</span>`;
		}

		get_supported_attributes() {
			return [ 'label', 'amount', 'currency' ];
		}

		static get_default_data() {
			return {
				type    : 'costhint',
				label   : 'Estimated Cost',
				amount  : 500.00,
				currency: '€'
			};
		}
	}

	obj.costhint = WPBC_BFB_Field_Costhint;

	return obj;

})( WPBC_BFB_Field_Renderers || {} );

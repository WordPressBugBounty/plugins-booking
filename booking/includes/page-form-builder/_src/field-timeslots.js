var WPBC_BFB_Field_Renderers = (function (obj) {

	class WPBC_BFB_Field_Timeslots {
		constructor(data, label = '', id = '') {
			this.data  = data;
			this.label = label;
			this.id    = id;
		}

		render() {
			return `<select class="wpbc_bfb__preview-select">
				<option>09:00 – 10:00</option>
				<option>10:00 – 11:00</option>
			</select>`;
		}

		get_supported_attributes() {
			return [ 'label', 'time_slots', 'required' ];
		}

		static get_default_data() {
			return {
				type      : 'timeslots',
				label     : 'Time',
				time_slots: [ '09:00 – 10:00', '10:00 – 11:00' ]
			};
		}
	}

	obj.timeslots = WPBC_BFB_Field_Timeslots;

	return obj;

})( WPBC_BFB_Field_Renderers || {} );

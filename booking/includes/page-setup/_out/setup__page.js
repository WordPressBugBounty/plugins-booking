"use strict";

/**
 * Request Object
 * Here we can  define parameters and Update it later,  when  some parameter was changed
 *
 */
var _wpbc_settings = function (obj, $) {
  // -----------------------------------------------------------------------------------------------------------------
  // Main Parameters
  // -----------------------------------------------------------------------------------------------------------------
  var p_general = obj.general_obj = obj.general_obj || {
    // sort            : "booking_id",
    // sort_type       : "DESC",
    // page_num        : 1,
    // page_items_count: 10,
    // create_date     : "",
    // keyword         : "",
    // source          : ""
  };
  obj.get_param__general = function (param_key) {
    return p_general[param_key];
  };
  obj.set_param__general = function (param_key, param_val) {
    p_general[param_key] = param_val;
  };
  // -------------------------------------------------------------
  obj.set_all_params__general = function (request_param_obj) {
    p_general = request_param_obj;
  };
  obj.get_all_params__general = function () {
    return p_general;
  };
  // -------------------------------------------------------------
  obj.set_params_arr__general = function (params_arr) {
    _.each(params_arr, function (p_val, p_key, p_data) {
      this.set_param__general(p_key, p_val);
    });
  };

  // -----------------------------------------------------------------------------------------------------------------
  // Secure parameters for Ajax
  // -----------------------------------------------------------------------------------------------------------------
  var p_secure = obj.security_obj = obj.security_obj || {
    user_id: 0,
    nonce: '',
    locale: ''
  };
  obj.set_param__secure = function (param_key, param_val) {
    p_secure[param_key] = param_val;
  };
  obj.get_param__secure = function (param_key) {
    return p_secure[param_key];
  };

  // -----------------------------------------------------------------------------------------------------------------
  // Other parameters
  // -----------------------------------------------------------------------------------------------------------------
  var p_other = obj.other_obj = obj.other_obj || {};
  obj.set_param__other = function (param_key, param_val) {
    p_other[param_key] = param_val;
  };
  obj.get_param__other = function (param_key) {
    return p_other[param_key];
  };
  return obj;
}(_wpbc_settings || {}, jQuery);
function wpbc_setup_page__show_content() {
  var params_obj = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  console.log(params_obj);
  var template = wp.template('wpbc_main_page_content');
  jQuery(_wpbc_settings.get_param__other('listing_container')).html(template(params_obj));
}
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvcGFnZS1zZXR1cC9fb3V0L3NldHVwX19wYWdlLmpzIiwibmFtZXMiOlsiX3dwYmNfc2V0dGluZ3MiLCJvYmoiLCIkIiwicF9nZW5lcmFsIiwiZ2VuZXJhbF9vYmoiLCJnZXRfcGFyYW1fX2dlbmVyYWwiLCJwYXJhbV9rZXkiLCJzZXRfcGFyYW1fX2dlbmVyYWwiLCJwYXJhbV92YWwiLCJzZXRfYWxsX3BhcmFtc19fZ2VuZXJhbCIsInJlcXVlc3RfcGFyYW1fb2JqIiwiZ2V0X2FsbF9wYXJhbXNfX2dlbmVyYWwiLCJzZXRfcGFyYW1zX2Fycl9fZ2VuZXJhbCIsInBhcmFtc19hcnIiLCJfIiwiZWFjaCIsInBfdmFsIiwicF9rZXkiLCJwX2RhdGEiLCJwX3NlY3VyZSIsInNlY3VyaXR5X29iaiIsInVzZXJfaWQiLCJub25jZSIsImxvY2FsZSIsInNldF9wYXJhbV9fc2VjdXJlIiwiZ2V0X3BhcmFtX19zZWN1cmUiLCJwX290aGVyIiwib3RoZXJfb2JqIiwic2V0X3BhcmFtX19vdGhlciIsImdldF9wYXJhbV9fb3RoZXIiLCJqUXVlcnkiLCJ3cGJjX3NldHVwX3BhZ2VfX3Nob3dfY29udGVudCIsInBhcmFtc19vYmoiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJ1bmRlZmluZWQiLCJjb25zb2xlIiwibG9nIiwidGVtcGxhdGUiLCJ3cCIsImh0bWwiXSwic291cmNlcyI6WyJpbmNsdWRlcy9wYWdlLXNldHVwL19zcmMvc2V0dXBfX3BhZ2UuanMiXSwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG4vKipcclxuICogUmVxdWVzdCBPYmplY3RcclxuICogSGVyZSB3ZSBjYW4gIGRlZmluZSBwYXJhbWV0ZXJzIGFuZCBVcGRhdGUgaXQgbGF0ZXIsICB3aGVuICBzb21lIHBhcmFtZXRlciB3YXMgY2hhbmdlZFxyXG4gKlxyXG4gKi9cclxudmFyIF93cGJjX3NldHRpbmdzID0gKGZ1bmN0aW9uICggb2JqLCAkKSB7XHJcblxyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0Ly8gTWFpbiBQYXJhbWV0ZXJzXHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9nZW5lcmFsID0gb2JqLmdlbmVyYWxfb2JqID0gb2JqLmdlbmVyYWxfb2JqIHx8IHtcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0ICAgICAgICAgICAgOiBcImJvb2tpbmdfaWRcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3J0X3R5cGUgICAgICAgOiBcIkRFU0NcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBwYWdlX251bSAgICAgICAgOiAxLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIHBhZ2VfaXRlbXNfY291bnQ6IDEwLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdC8vIGNyZWF0ZV9kYXRlICAgICA6IFwiXCIsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8ga2V5d29yZCAgICAgICAgIDogXCJcIixcclxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQvLyBzb3VyY2UgICAgICAgICAgOiBcIlwiXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdH07XHJcblx0b2JqLmdldF9wYXJhbV9fZ2VuZXJhbCA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfZ2VuZXJhbFsgcGFyYW1fa2V5IF07XHJcblx0fTtcclxuXHRvYmouc2V0X3BhcmFtX19nZW5lcmFsID0gZnVuY3Rpb24gKCBwYXJhbV9rZXksIHBhcmFtX3ZhbCApIHtcclxuXHRcdHBfZ2VuZXJhbFsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblx0b2JqLnNldF9hbGxfcGFyYW1zX19nZW5lcmFsID0gZnVuY3Rpb24gKCByZXF1ZXN0X3BhcmFtX29iaiApIHtcclxuXHRcdHBfZ2VuZXJhbCA9IHJlcXVlc3RfcGFyYW1fb2JqO1xyXG5cdH07XHJcblx0b2JqLmdldF9hbGxfcGFyYW1zX19nZW5lcmFsID0gZnVuY3Rpb24gKCkge1xyXG5cdFx0cmV0dXJuIHBfZ2VuZXJhbDtcclxuXHR9O1xyXG5cdC8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHRvYmouc2V0X3BhcmFtc19hcnJfX2dlbmVyYWwgPSBmdW5jdGlvbiggcGFyYW1zX2FyciApe1xyXG5cdFx0Xy5lYWNoKCBwYXJhbXNfYXJyLCBmdW5jdGlvbiAoIHBfdmFsLCBwX2tleSwgcF9kYXRhICl7XHJcblx0XHRcdHRoaXMuc2V0X3BhcmFtX19nZW5lcmFsKCBwX2tleSwgcF92YWwgKTtcclxuXHRcdH0gKTtcclxuXHR9XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIFNlY3VyZSBwYXJhbWV0ZXJzIGZvciBBamF4XHJcblx0Ly8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuXHR2YXIgcF9zZWN1cmUgPSBvYmouc2VjdXJpdHlfb2JqID0gb2JqLnNlY3VyaXR5X29iaiB8fCB7XHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHVzZXJfaWQ6IDAsXHJcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5vbmNlICA6ICcnLFxyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGUgOiAnJ1xyXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0ICB9O1xyXG5cdG9iai5zZXRfcGFyYW1fX3NlY3VyZSA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX3NlY3VyZVsgcGFyYW1fa2V5IF0gPSBwYXJhbV92YWw7XHJcblx0fTtcclxuXHJcblx0b2JqLmdldF9wYXJhbV9fc2VjdXJlID0gZnVuY3Rpb24gKCBwYXJhbV9rZXkgKSB7XHJcblx0XHRyZXR1cm4gcF9zZWN1cmVbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdC8vIE90aGVyIHBhcmFtZXRlcnNcclxuXHQvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cdHZhciBwX290aGVyID0gb2JqLm90aGVyX29iaiA9IG9iai5vdGhlcl9vYmogfHwgeyB9O1xyXG5cclxuXHRvYmouc2V0X3BhcmFtX19vdGhlciA9IGZ1bmN0aW9uICggcGFyYW1fa2V5LCBwYXJhbV92YWwgKSB7XHJcblx0XHRwX290aGVyWyBwYXJhbV9rZXkgXSA9IHBhcmFtX3ZhbDtcclxuXHR9O1xyXG5cclxuXHRvYmouZ2V0X3BhcmFtX19vdGhlciA9IGZ1bmN0aW9uICggcGFyYW1fa2V5ICkge1xyXG5cdFx0cmV0dXJuIHBfb3RoZXJbIHBhcmFtX2tleSBdO1xyXG5cdH07XHJcblxyXG5cdHJldHVybiBvYmo7XHJcbn0oIF93cGJjX3NldHRpbmdzIHx8IHt9LCBqUXVlcnkgKSk7XHJcblxyXG5cclxuXHJcbmZ1bmN0aW9uIHdwYmNfc2V0dXBfcGFnZV9fc2hvd19jb250ZW50KCBwYXJhbXNfb2JqID0ge30gKXtcclxuY29uc29sZS5sb2coIHBhcmFtc19vYmogKTtcclxuXHR2YXIgdGVtcGxhdGUgPSB3cC50ZW1wbGF0ZSggJ3dwYmNfbWFpbl9wYWdlX2NvbnRlbnQnICk7XHJcblxyXG5cdGpRdWVyeSggX3dwYmNfc2V0dGluZ3MuZ2V0X3BhcmFtX19vdGhlciggJ2xpc3RpbmdfY29udGFpbmVyJyApICkuaHRtbCggdGVtcGxhdGUoIHBhcmFtc19vYmogKSApO1xyXG59XHJcbiJdLCJtYXBwaW5ncyI6IkFBQUEsWUFBWTs7QUFFWjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSUEsY0FBYyxHQUFJLFVBQVdDLEdBQUcsRUFBRUMsQ0FBQyxFQUFFO0VBRXhDO0VBQ0E7RUFDQTtFQUNBLElBQUlDLFNBQVMsR0FBR0YsR0FBRyxDQUFDRyxXQUFXLEdBQUdILEdBQUcsQ0FBQ0csV0FBVyxJQUFJO0lBQ3pDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0VBQUEsQ0FDQTtFQUNaSCxHQUFHLENBQUNJLGtCQUFrQixHQUFHLFVBQVdDLFNBQVMsRUFBRztJQUMvQyxPQUFPSCxTQUFTLENBQUVHLFNBQVMsQ0FBRTtFQUM5QixDQUFDO0VBQ0RMLEdBQUcsQ0FBQ00sa0JBQWtCLEdBQUcsVUFBV0QsU0FBUyxFQUFFRSxTQUFTLEVBQUc7SUFDMURMLFNBQVMsQ0FBRUcsU0FBUyxDQUFFLEdBQUdFLFNBQVM7RUFDbkMsQ0FBQztFQUNEO0VBQ0FQLEdBQUcsQ0FBQ1EsdUJBQXVCLEdBQUcsVUFBV0MsaUJBQWlCLEVBQUc7SUFDNURQLFNBQVMsR0FBR08saUJBQWlCO0VBQzlCLENBQUM7RUFDRFQsR0FBRyxDQUFDVSx1QkFBdUIsR0FBRyxZQUFZO0lBQ3pDLE9BQU9SLFNBQVM7RUFDakIsQ0FBQztFQUNEO0VBQ0FGLEdBQUcsQ0FBQ1csdUJBQXVCLEdBQUcsVUFBVUMsVUFBVSxFQUFFO0lBQ25EQyxDQUFDLENBQUNDLElBQUksQ0FBRUYsVUFBVSxFQUFFLFVBQVdHLEtBQUssRUFBRUMsS0FBSyxFQUFFQyxNQUFNLEVBQUU7TUFDcEQsSUFBSSxDQUFDWCxrQkFBa0IsQ0FBRVUsS0FBSyxFQUFFRCxLQUFNLENBQUM7SUFDeEMsQ0FBRSxDQUFDO0VBQ0osQ0FBQzs7RUFHRDtFQUNBO0VBQ0E7RUFDQSxJQUFJRyxRQUFRLEdBQUdsQixHQUFHLENBQUNtQixZQUFZLEdBQUduQixHQUFHLENBQUNtQixZQUFZLElBQUk7SUFDeENDLE9BQU8sRUFBRSxDQUFDO0lBQ1ZDLEtBQUssRUFBSSxFQUFFO0lBQ1hDLE1BQU0sRUFBRztFQUNSLENBQUM7RUFDaEJ0QixHQUFHLENBQUN1QixpQkFBaUIsR0FBRyxVQUFXbEIsU0FBUyxFQUFFRSxTQUFTLEVBQUc7SUFDekRXLFFBQVEsQ0FBRWIsU0FBUyxDQUFFLEdBQUdFLFNBQVM7RUFDbEMsQ0FBQztFQUVEUCxHQUFHLENBQUN3QixpQkFBaUIsR0FBRyxVQUFXbkIsU0FBUyxFQUFHO0lBQzlDLE9BQU9hLFFBQVEsQ0FBRWIsU0FBUyxDQUFFO0VBQzdCLENBQUM7O0VBR0Q7RUFDQTtFQUNBO0VBQ0EsSUFBSW9CLE9BQU8sR0FBR3pCLEdBQUcsQ0FBQzBCLFNBQVMsR0FBRzFCLEdBQUcsQ0FBQzBCLFNBQVMsSUFBSSxDQUFFLENBQUM7RUFFbEQxQixHQUFHLENBQUMyQixnQkFBZ0IsR0FBRyxVQUFXdEIsU0FBUyxFQUFFRSxTQUFTLEVBQUc7SUFDeERrQixPQUFPLENBQUVwQixTQUFTLENBQUUsR0FBR0UsU0FBUztFQUNqQyxDQUFDO0VBRURQLEdBQUcsQ0FBQzRCLGdCQUFnQixHQUFHLFVBQVd2QixTQUFTLEVBQUc7SUFDN0MsT0FBT29CLE9BQU8sQ0FBRXBCLFNBQVMsQ0FBRTtFQUM1QixDQUFDO0VBRUQsT0FBT0wsR0FBRztBQUNYLENBQUMsQ0FBRUQsY0FBYyxJQUFJLENBQUMsQ0FBQyxFQUFFOEIsTUFBTyxDQUFFO0FBSWxDLFNBQVNDLDZCQUE2QkEsQ0FBQSxFQUFtQjtFQUFBLElBQWpCQyxVQUFVLEdBQUFDLFNBQUEsQ0FBQUMsTUFBQSxRQUFBRCxTQUFBLFFBQUFFLFNBQUEsR0FBQUYsU0FBQSxNQUFHLENBQUMsQ0FBQztFQUN2REcsT0FBTyxDQUFDQyxHQUFHLENBQUVMLFVBQVcsQ0FBQztFQUN4QixJQUFJTSxRQUFRLEdBQUdDLEVBQUUsQ0FBQ0QsUUFBUSxDQUFFLHdCQUF5QixDQUFDO0VBRXREUixNQUFNLENBQUU5QixjQUFjLENBQUM2QixnQkFBZ0IsQ0FBRSxtQkFBb0IsQ0FBRSxDQUFDLENBQUNXLElBQUksQ0FBRUYsUUFBUSxDQUFFTixVQUFXLENBQUUsQ0FBQztBQUNoRyIsImlnbm9yZUxpc3QiOltdfQ==

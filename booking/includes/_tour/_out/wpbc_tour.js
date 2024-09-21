"use strict";

(function ($) {
  $(function () {
    // if Shepherd is undefined, exit.
    if (!window.Shepherd) return;
    var button_classes = 'button button-primary';
    var plugins_page_tour = window.wpbc_plugins_page_tour = new Shepherd.Tour();
    var main_tour = window.wpbc_main_tour = new Shepherd.Tour();

    // Set up the defaults for each step
    main_tour.options.defaults = plugins_page_tour.options.defaults = {
      classes: 'wpbc_tour_theme202408 wpbc_tour_main',
      showCancelLink: true,
      scrollTo: false,
      tetherOptions: {
        constraints: [{
          to: 'scrollParent',
          attachment: 'together',
          pin: false
        }]
      }
    };

    /*
    	Plugins page
    */

    main_tour.addStep('intro', {
      title: wpbc_tour_i18n.plugins_page.title,
      text: wpbc_tour_i18n.plugins_page.text,
      attachTo: '.wpbc_plugins_links__start_tour top',
      buttons: [{
        classes: button_classes,
        text: wpbc_tour_i18n.plugins_page.button.text,
        action: function action() {
          window.location = wpbc_tour_i18n.plugins_page.button.url;
        }
      }],
      tetherOptions: {
        constraints: [{
          to: 'scrollParent',
          attachment: 'together',
          pin: false
        }],
        offset: '20px 0'
      },
      when: {
        show: function show() {
          $('body').addClass('plugins_page_highlight_wpbc');
          var popup = $(this.el);
          var target = $(this.tether.target);
          $('body, html').animate({
            scrollTop: popup.offset().top - 50
          }, 500, function () {
            window.scrollTo(0, popup.offset().top - 50);
          });
        },
        hide: function hide() {
          $('body').removeClass('plugins_page_highlight_wpbc');
        }
      }
    });

    /*
    	Main Tour steps
    */

    // 1. Your first backup
    main_tour.addStep('main_tour_start', {
      title: wpbc_tour_i18n.setup_page.title,
      text: wpbc_tour_i18n.setup_page.text,
      //attachTo: '.wpbc_page_top__wizard_button_content bottom',
      attachTo: {
        element: jQuery('#toplevel_page_wpbc ul li:nth-last-child(2)').get(0),
        on: 'right'
      },
      buttons: [{
        classes: 'wpbc_tour_end',
        text: wpbc_tour_i18n.button_end_tour.text,
        action: main_tour.cancel
      }, {
        classes: button_classes,
        text: wpbc_tour_i18n.button_next.text,
        action: function action() {
          //jQuery('.wpbc_page_top__wizard_button_content .button').trigger('click');
          jQuery('#toplevel_page_wpbc ul li:nth-last-child(2) a').get(0).click();
        }
      }],
      tetherOptions: {
        constraints: [{
          to: 'window',
          attachment: 'together'
        }],
        offset: '0 0'
      }
    });
  });
})(jQuery);
jQuery(document).ready(function () {
  setTimeout(function () {
    if (jQuery('.wpbc_plugins_links__start_tour').length) {
      wpbc_main_tour.start();
    }
    if (jQuery('.wpbc_page_top__wizard_button_content').length) {
      wpbc_main_tour.show('main_tour_start');
    }
  }, 1000);
});
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5jbHVkZXMvX3RvdXIvX291dC93cGJjX3RvdXIuanMiLCJuYW1lcyI6WyIkIiwid2luZG93IiwiU2hlcGhlcmQiLCJidXR0b25fY2xhc3NlcyIsInBsdWdpbnNfcGFnZV90b3VyIiwid3BiY19wbHVnaW5zX3BhZ2VfdG91ciIsIlRvdXIiLCJtYWluX3RvdXIiLCJ3cGJjX21haW5fdG91ciIsIm9wdGlvbnMiLCJkZWZhdWx0cyIsImNsYXNzZXMiLCJzaG93Q2FuY2VsTGluayIsInNjcm9sbFRvIiwidGV0aGVyT3B0aW9ucyIsImNvbnN0cmFpbnRzIiwidG8iLCJhdHRhY2htZW50IiwicGluIiwiYWRkU3RlcCIsInRpdGxlIiwid3BiY190b3VyX2kxOG4iLCJwbHVnaW5zX3BhZ2UiLCJ0ZXh0IiwiYXR0YWNoVG8iLCJidXR0b25zIiwiYnV0dG9uIiwiYWN0aW9uIiwibG9jYXRpb24iLCJ1cmwiLCJvZmZzZXQiLCJ3aGVuIiwic2hvdyIsImFkZENsYXNzIiwicG9wdXAiLCJlbCIsInRhcmdldCIsInRldGhlciIsImFuaW1hdGUiLCJzY3JvbGxUb3AiLCJ0b3AiLCJoaWRlIiwicmVtb3ZlQ2xhc3MiLCJzZXR1cF9wYWdlIiwiZWxlbWVudCIsImpRdWVyeSIsImdldCIsIm9uIiwiYnV0dG9uX2VuZF90b3VyIiwiY2FuY2VsIiwiYnV0dG9uX25leHQiLCJjbGljayIsImRvY3VtZW50IiwicmVhZHkiLCJzZXRUaW1lb3V0IiwibGVuZ3RoIiwic3RhcnQiXSwic291cmNlcyI6WyJpbmNsdWRlcy9fdG91ci9fc3JjL3dwYmNfdG91ci5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gKCQpIHtcclxuXHJcblx0JChmdW5jdGlvbigpIHtcclxuXHJcblx0XHQvLyBpZiBTaGVwaGVyZCBpcyB1bmRlZmluZWQsIGV4aXQuXHJcblx0XHRpZiAoIXdpbmRvdy5TaGVwaGVyZCkgcmV0dXJuO1xyXG5cclxuXHRcdHZhciBidXR0b25fY2xhc3NlcyA9ICdidXR0b24gYnV0dG9uLXByaW1hcnknO1xyXG5cdFx0dmFyIHBsdWdpbnNfcGFnZV90b3VyID0gd2luZG93LndwYmNfcGx1Z2luc19wYWdlX3RvdXIgPSBuZXcgU2hlcGhlcmQuVG91cigpO1xyXG5cdFx0dmFyIG1haW5fdG91ciA9IHdpbmRvdy53cGJjX21haW5fdG91ciA9IG5ldyBTaGVwaGVyZC5Ub3VyKCk7XHJcblxyXG5cdFx0Ly8gU2V0IHVwIHRoZSBkZWZhdWx0cyBmb3IgZWFjaCBzdGVwXHJcblx0XHRtYWluX3RvdXIub3B0aW9ucy5kZWZhdWx0cyA9IHBsdWdpbnNfcGFnZV90b3VyLm9wdGlvbnMuZGVmYXVsdHMgPSB7XHJcblx0XHRcdGNsYXNzZXM6ICd3cGJjX3RvdXJfdGhlbWUyMDI0MDggd3BiY190b3VyX21haW4nLFxyXG5cdFx0XHRzaG93Q2FuY2VsTGluazogdHJ1ZSxcclxuXHRcdFx0c2Nyb2xsVG86IGZhbHNlLFxyXG5cdFx0XHR0ZXRoZXJPcHRpb25zOiB7XHJcblx0XHRcdFx0Y29uc3RyYWludHM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0dG86ICdzY3JvbGxQYXJlbnQnLFxyXG5cdFx0XHRcdFx0XHRhdHRhY2htZW50OiAndG9nZXRoZXInLFxyXG5cdFx0XHRcdFx0XHRwaW46IGZhbHNlXHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0XVxyXG5cdFx0XHR9XHJcblx0XHR9O1xyXG5cdFx0XHJcblx0XHQvKlxyXG5cdFx0XHRQbHVnaW5zIHBhZ2VcclxuXHRcdCovXHJcblxyXG5cdFx0bWFpbl90b3VyLmFkZFN0ZXAoICdpbnRybycsIHtcclxuXHRcdFx0dGl0bGU6IHdwYmNfdG91cl9pMThuLnBsdWdpbnNfcGFnZS50aXRsZSxcclxuXHRcdFx0dGV4dDogd3BiY190b3VyX2kxOG4ucGx1Z2luc19wYWdlLnRleHQsXHJcblx0XHRcdGF0dGFjaFRvOiAnLndwYmNfcGx1Z2luc19saW5rc19fc3RhcnRfdG91ciB0b3AnLFxyXG5cdFx0XHRidXR0b25zOiBbXHJcblx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0Y2xhc3NlczogYnV0dG9uX2NsYXNzZXMsXHJcblx0XHRcdFx0XHR0ZXh0OiB3cGJjX3RvdXJfaTE4bi5wbHVnaW5zX3BhZ2UuYnV0dG9uLnRleHQsXHJcblx0XHRcdFx0XHRhY3Rpb246IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHR3aW5kb3cubG9jYXRpb24gPSB3cGJjX3RvdXJfaTE4bi5wbHVnaW5zX3BhZ2UuYnV0dG9uLnVybDtcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHR9XHJcblx0XHRcdF0sXHJcblx0XHRcdHRldGhlck9wdGlvbnM6IHtcclxuXHRcdFx0XHRjb25zdHJhaW50czogW1xyXG5cdFx0XHRcdFx0e1xyXG5cdFx0XHRcdFx0XHR0bzogJ3Njcm9sbFBhcmVudCcsXHJcblx0XHRcdFx0XHRcdGF0dGFjaG1lbnQ6ICd0b2dldGhlcicsXHJcblx0XHRcdFx0XHRcdHBpbjogZmFsc2VcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRdLFxyXG5cdFx0XHRcdG9mZnNldDogJzIwcHggMCdcclxuXHRcdFx0fSxcclxuXHRcdFx0d2hlbjoge1xyXG5cdFx0XHRcdHNob3c6IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0JCgnYm9keScpLmFkZENsYXNzKCdwbHVnaW5zX3BhZ2VfaGlnaGxpZ2h0X3dwYmMnKTtcclxuXHRcdFx0XHRcdHZhciBwb3B1cCA9ICQodGhpcy5lbCk7XHJcblx0XHRcdFx0XHR2YXIgdGFyZ2V0ID0gJCh0aGlzLnRldGhlci50YXJnZXQpO1xyXG5cdFx0XHRcdFx0JCgnYm9keSwgaHRtbCcpLmFuaW1hdGUoe1xyXG5cdFx0XHRcdFx0XHRzY3JvbGxUb3A6IHBvcHVwLm9mZnNldCgpLnRvcCAtIDUwXHJcblx0XHRcdFx0XHR9LCA1MDAsIGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHR3aW5kb3cuc2Nyb2xsVG8oMCwgcG9wdXAub2Zmc2V0KCkudG9wIC0gNTApO1xyXG5cdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHRoaWRlOiBmdW5jdGlvbigpIHtcclxuXHRcdFx0XHRcdCQoJ2JvZHknKS5yZW1vdmVDbGFzcygncGx1Z2luc19wYWdlX2hpZ2hsaWdodF93cGJjJyk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHR9XHJcblx0XHR9KTtcclxuXHJcblxyXG5cdFx0LypcclxuXHRcdFx0TWFpbiBUb3VyIHN0ZXBzXHJcblx0XHQqL1xyXG5cclxuXHRcdC8vIDEuIFlvdXIgZmlyc3QgYmFja3VwXHJcblx0XHRtYWluX3RvdXIuYWRkU3RlcCggJ21haW5fdG91cl9zdGFydCcsIHtcclxuXHRcdFx0dGl0bGU6IHdwYmNfdG91cl9pMThuLnNldHVwX3BhZ2UudGl0bGUsXHJcblx0XHRcdHRleHQ6ICB3cGJjX3RvdXJfaTE4bi5zZXR1cF9wYWdlLnRleHQsXHJcblx0XHRcdC8vYXR0YWNoVG86ICcud3BiY19wYWdlX3RvcF9fd2l6YXJkX2J1dHRvbl9jb250ZW50IGJvdHRvbScsXHJcblx0XHRcdGF0dGFjaFRvOiB7IGVsZW1lbnQ6IGpRdWVyeSggJyN0b3BsZXZlbF9wYWdlX3dwYmMgdWwgbGk6bnRoLWxhc3QtY2hpbGQoMiknKS5nZXQoMCksIG9uOiAncmlnaHQnfSxcclxuXHRcdFx0YnV0dG9uczogW1xyXG5cdFx0XHRcdHtcclxuXHRcdFx0XHRcdGNsYXNzZXM6ICd3cGJjX3RvdXJfZW5kJyxcclxuXHRcdFx0XHRcdHRleHQ6IHdwYmNfdG91cl9pMThuLmJ1dHRvbl9lbmRfdG91ci50ZXh0LFxyXG5cdFx0XHRcdFx0YWN0aW9uOiBtYWluX3RvdXIuY2FuY2VsXHJcblx0XHRcdFx0fSxcclxuXHRcdFx0XHR7XHJcblx0XHRcdFx0XHRjbGFzc2VzOiBidXR0b25fY2xhc3NlcyxcclxuXHRcdFx0XHRcdHRleHQ6IHdwYmNfdG91cl9pMThuLmJ1dHRvbl9uZXh0LnRleHQsXHJcblx0XHRcdFx0XHRhY3Rpb246IGZ1bmN0aW9uKCkge1xyXG5cdFx0XHRcdFx0XHQvL2pRdWVyeSgnLndwYmNfcGFnZV90b3BfX3dpemFyZF9idXR0b25fY29udGVudCAuYnV0dG9uJykudHJpZ2dlcignY2xpY2snKTtcclxuXHRcdFx0XHRcdFx0alF1ZXJ5KCAnI3RvcGxldmVsX3BhZ2Vfd3BiYyB1bCBsaTpudGgtbGFzdC1jaGlsZCgyKSBhJykuZ2V0KDApLmNsaWNrKCk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRdLFxyXG5cdFx0XHR0ZXRoZXJPcHRpb25zOiB7XHJcblx0XHRcdFx0Y29uc3RyYWludHM6IFtcclxuXHRcdFx0XHRcdHtcclxuXHRcdFx0XHRcdFx0ICB0bzogJ3dpbmRvdycsXHJcbiAgICAgIFx0XHRcdFx0XHQgIGF0dGFjaG1lbnQ6ICd0b2dldGhlcidcclxuXHRcdFx0XHRcdH1cclxuXHRcdFx0XHRdLFxyXG5cdFx0XHRcdG9mZnNldDogJzAgMCdcclxuXHRcdFx0fVxyXG5cdFx0fSk7XHJcblxyXG5cdH0pO1xyXG5cclxufSkoalF1ZXJ5KTtcclxuXHJcbmpRdWVyeShkb2N1bWVudCkucmVhZHkoZnVuY3Rpb24oKXtcclxuXHJcblx0c2V0VGltZW91dChmdW5jdGlvbigpe1xyXG5cdFx0aWYgKGpRdWVyeSgnLndwYmNfcGx1Z2luc19saW5rc19fc3RhcnRfdG91cicpLmxlbmd0aCl7XHJcblx0XHRcdHdwYmNfbWFpbl90b3VyLnN0YXJ0KCk7XHJcblx0XHR9XHJcblx0XHRpZiAoalF1ZXJ5KCcud3BiY19wYWdlX3RvcF9fd2l6YXJkX2J1dHRvbl9jb250ZW50JykubGVuZ3RoKXtcclxuXHRcdFx0d3BiY19tYWluX3RvdXIuc2hvdygnbWFpbl90b3VyX3N0YXJ0Jyk7XHJcblx0XHR9XHJcblx0fSwxMDAwKVxyXG59KTtcclxuIl0sIm1hcHBpbmdzIjoiOztBQUFBLENBQUMsVUFBVUEsQ0FBQyxFQUFFO0VBRWJBLENBQUMsQ0FBQyxZQUFXO0lBRVo7SUFDQSxJQUFJLENBQUNDLE1BQU0sQ0FBQ0MsUUFBUSxFQUFFO0lBRXRCLElBQUlDLGNBQWMsR0FBRyx1QkFBdUI7SUFDNUMsSUFBSUMsaUJBQWlC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

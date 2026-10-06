/* SlicePay — app.js: bootstrap */
(function () {
  'use strict';
  var SP = window.SlicePay;
  function boot() { SP.start(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

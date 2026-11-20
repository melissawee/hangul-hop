// Fills in the contact address from config.js (no inline scripts allowed by the site's CSP).
(function () {
  var el = document.getElementById('contact');
  if (!el || typeof CONTACT_EMAIL !== 'string' || !/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(CONTACT_EMAIL)) return;
  var a = document.createElement('a');
  a.href = 'mailto:' + CONTACT_EMAIL;
  a.textContent = CONTACT_EMAIL;
  el.textContent = 'email ';
  el.appendChild(a);
})();

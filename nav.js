/* ============================================================
   DSM Photography — Nav Loader
   nav.js | Linked from every page, just before </body>
   ============================================================ */

(function () {
  const placeholder = document.getElementById('nav-placeholder');
  if (!placeholder) return;

  fetch('/nav.html')
    .then(function (r) { return r.text(); })
    .then(function (html) {
      placeholder.innerHTML = html;
      initNav();
    })
    .catch(function () {
      // If fetch fails (e.g. opening file:// locally), fail silently
      console.warn('DSM nav: could not load nav.html');
    });

  function initNav() {
    // Hamburger toggle
    const hamburger = document.getElementById('hamburger-btn');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeBtn = document.getElementById('mobile-close-btn');

    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', function () {
        mobileMenu.classList.toggle('open');
      });
    }

    if (closeBtn && mobileMenu) {
      closeBtn.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
      });
    }

    // Close mobile menu on link click
    if (mobileMenu) {
      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobileMenu.classList.remove('open');
        });
      });
    }

    // Mark active nav link based on current page
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav .nav-links a').forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const linkPage = href.split('/').pop().split('#')[0];
      if (linkPage === current) {
        link.classList.add('active');
      }
    });

    // Per-page Inquire CTA target
    // Pages with their own #inquire section point there; others go to home contact
    const inquireBtn = document.getElementById('nav-inquire-btn');
    if (inquireBtn) {
      const pageInquire = document.getElementById('inquire');
      if (pageInquire) {
        inquireBtn.setAttribute('href', '#inquire');
      }
    }
  }
})();

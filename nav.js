/* ============================================================
   DSM Photography — Nav Loader
   nav.js | Linked from every page, just before </body>

   DARK VARIANT:
   Add class="nav-dark" to the <body> tag on any page
   that needs the dark charcoal nav (currently: events.html).
   nav.js will automatically apply .dark to <nav>
   and .dark-menu to .mobile-menu after loading.
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
      console.warn('DSM nav: could not load nav.html');
    });

  function initNav() {
    const navEl = document.querySelector('nav');
    const mobileMenu = document.getElementById('mobileMenu');

    // Apply dark variant if body has nav-dark class
    if (document.body.classList.contains('nav-dark')) {
      if (navEl) navEl.classList.add('dark');
      if (mobileMenu) mobileMenu.classList.add('dark-menu');
    }

    // Hamburger toggle
    const hamburger = document.getElementById('hamburger-btn');
    const closeBtn = document.getElementById('mobile-close-btn');

    if (hamburger && mobileMenu) {
      hamburger.addEventListener('click', function () {
        mobileMenu.classList.toggle('open');
        hamburger.classList.toggle('open');
      });
    }

    if (closeBtn && mobileMenu) {
      closeBtn.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        if (hamburger) hamburger.classList.remove('open');
      });
    }

    // Close mobile menu on any link click
    if (mobileMenu) {
      mobileMenu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          mobileMenu.classList.remove('open');
          if (hamburger) hamburger.classList.remove('open');
        });
      });
    }

    // Mark active nav link based on current page
    const current = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('nav .nav-links a').forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const linkPage = href.split('/').pop().split('#')[0];
      if (linkPage && linkPage === current) {
        link.classList.add('active');
      }
    });

    // Per-page Inquire CTA — point to #inquire if it exists on this page
    const inquireBtn = document.getElementById('nav-inquire-btn');
    if (inquireBtn) {
      const pageInquire = document.getElementById('inquire');
      if (pageInquire) {
        inquireBtn.setAttribute('href', '#inquire');
      }
    }
  }
})();

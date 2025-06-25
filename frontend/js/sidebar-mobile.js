document.addEventListener('DOMContentLoaded', function() {
    //buton meniu mobile
    const mobileToggle = document.createElement('button');
    mobileToggle.className = 'mobile-menu-toggle';
    mobileToggle.innerHTML = '☰';
    mobileToggle.setAttribute('aria-label', 'Toggle navigation menu');
    document.body.appendChild(mobileToggle);

    //close btn
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sidebar-close-btn';
    closeBtn.setAttribute('aria-label', 'Close navigation menu');

    //overlay pt cand e sidebaul deschis
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    const sidebar = document.querySelector('.sidebar');
    sidebar.appendChild(closeBtn);

    function openSidebar() {
        sidebar.classList.add('show');
        overlay.classList.add('show');
        mobileToggle.classList.add('active');
        document.body.classList.add('sidebar-open');
    }

    function closeSidebar() {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        mobileToggle.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    }

    function toggleSidebar() {
        const isOpen = sidebar.classList.contains('show');
        if (isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    mobileToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleSidebar();
    });

    closeBtn.addEventListener('click', closeSidebar);
    overlay.addEventListener('click', closeSidebar);

    //cand apas pe un link din sidebar se inchide
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });

    sidebar.addEventListener('click', function(e) {
        e.stopPropagation();
    });
});
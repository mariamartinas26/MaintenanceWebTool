window.addEventListener('scroll', function () {
    const details = document.querySelector('.service-details');
    const btn = document.querySelector('.appointment-btn');
    const triggerPoint = 150;

    if (window.scrollY > triggerPoint) {
        details.classList.remove('hidden');
        btn.classList.remove('hidden');
    } else {
        details.classList.add('hidden');
        btn.classList.add('hidden');
    }
});
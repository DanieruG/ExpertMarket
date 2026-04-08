async function loadPartial(containerId, filePath) {
  const container = document.getElementById(containerId);
  if (!container) return false;

  try {
    const response = await fetch(filePath);

    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}: ${response.status}`);
    }

    const html = await response.text();
    container.innerHTML = html;
    return true;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return false;
  }
}

function highlightActiveNav() {
  const currentPage = document.body.dataset.page;
  if (!currentPage) return;

  document.querySelectorAll('#navbar-container .nav-item').forEach(item => {
    item.classList.remove('active');

    if (item.dataset.page === currentPage) {
      item.classList.add('active');
    }
  });
}

function initTicker() {
  const currentPage = document.body.dataset.page;
  const ticker = document.getElementById('ticker');
  if (!ticker) return;

  ticker.style.display = currentPage === 'landing' ? 'none' : 'block';
}

async function initSharedLayout() {
  const navbarLoaded = await loadPartial('navbar-container', 'navbar.html');
  const tickerLoaded = await loadPartial('ticker-container', 'ticker.html');

  if (navbarLoaded) {
    highlightActiveNav();
  }

  if (tickerLoaded) {
    initTicker();
  }
}

document.addEventListener('DOMContentLoaded', initSharedLayout);
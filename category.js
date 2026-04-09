const INDEXES_SOURCE = 'indexes.json';
const INVESTED_STATE_KEY = 'emIndexInvestedState';

let indexesData = [];
let activeIndex = null;

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function readInvestedState() {
  try {
    const raw = localStorage.getItem(INVESTED_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error('Failed to read invested state', error);
    return {};
  }
}

function writeInvestedState(state) {
  localStorage.setItem(INVESTED_STATE_KEY, JSON.stringify(state));
}

function mergeInvestedState(indexes) {
  const state = readInvestedState();
  return indexes.map(index => {
    const hasOverride = Object.prototype.hasOwnProperty.call(state, index.id);
    return { ...index, isInvested: hasOverride ? !!state[index.id] : !!index.isInvested };
  });
}

async function loadIndexes() {
  const response = await fetch(INDEXES_SOURCE);
  if (!response.ok) throw new Error('Failed to load indexes.json');

  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid indexes data');

  indexesData = mergeInvestedState(data);
}

async function ensureSharedModal() {
  const existing = document.getElementById('reviewModal');
  if (existing) return existing;

  const response = await fetch('profile.html');
  if (!response.ok) throw new Error('Failed to load modal source from profile.html');

  const profileMarkup = await response.text();
  const parser = new DOMParser();
  const profileDoc = parser.parseFromString(profileMarkup, 'text/html');
  const sourceModal = profileDoc.getElementById('reviewModal');
  if (!sourceModal) throw new Error('Modal not found in profile.html');

  const modal = document.importNode(sourceModal, true);
  document.body.appendChild(modal);
  return modal;
}

function ensureModalInvestControls(modal) {
  const modalCard = modal.querySelector('.modal-card');
  if (!modalCard) return;

  if (modalCard.querySelector('[data-role="index-invest-action"]')) return;

  const wrap = document.createElement('div');
  wrap.setAttribute('data-role', 'index-invest-action');
  wrap.style.marginTop = '14px';

  const button = document.createElement('button');
  button.className = 'btn btn-primary';
  button.style.width = '100%';
  button.id = 'modalInvestAction';
  button.textContent = 'Invest in Index';
  button.addEventListener('click', handleModalInvestClick);

  wrap.appendChild(button);
  modalCard.appendChild(wrap);
}

function getIndexForCard(card) {
  const explicitId = card.dataset.indexId || card.querySelector('button[data-index-id]')?.dataset.indexId;
  if (explicitId) {
    return indexesData.find(index => index.id === explicitId) || null;
  }

  const name = card.querySelector('.cat-name')?.textContent?.trim();
  if (!name) return null;

  const idGuess = slugify(name);
  return indexesData.find(index => index.id === idGuess || slugify(index.name) === idGuess) || null;
}

function updateCardInvestedUI(card, index) {
  const button = card.querySelector('button[data-index-id], .btn');
  if (!button) return;

  if (index.isInvested) {
    button.textContent = 'Invested';
    button.classList.remove('btn-outline');
    button.classList.add('btn-primary');
  } else {
    button.textContent = 'Invest in Index';
    if (!button.classList.contains('btn-primary') && !button.classList.contains('btn-outline')) {
      button.classList.add('btn-outline');
    }
  }

  let badge = card.querySelector('.index-invested-badge');
  if (index.isInvested) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge badge-green index-invested-badge';
      badge.style.marginTop = '8px';
      badge.textContent = 'Invested';
      const catCount = card.querySelector('.cat-count');
      if (catCount) {
        catCount.insertAdjacentElement('afterend', badge);
      } else {
        card.appendChild(badge);
      }
    }
  } else if (badge) {
    badge.remove();
  }
}

function refreshCategoryCards() {
  const cards = document.querySelectorAll('#category .cat-card');
  cards.forEach(card => {
    const index = getIndexForCard(card);
    if (!index) return;

    updateCardInvestedUI(card, index);
  });
}

function renderIndexInModal(index) {
  const modal = document.getElementById('reviewModal');
  if (!modal) return;

  const titleEl = modal.querySelector('.card-title');
  const nameEl = document.getElementById('modalRestaurant');
  const verdictLabel = modal.querySelector('.metric-row:first-of-type .text-muted');
  const verdictValue = document.getElementById('modalVerdict');
  const scoreLabel = modal.querySelector('.metric-row:nth-of-type(2) .text-muted');
  const scoreValue = document.getElementById('modalScore');
  const commentEl = document.getElementById('modalComment');
  const actionButton = document.getElementById('modalInvestAction');

  if (titleEl) titleEl.textContent = 'Index Details';
  if (nameEl) nameEl.textContent = index.name;
  if (verdictLabel) verdictLabel.textContent = 'Risk';
  if (verdictValue) verdictValue.textContent = index.riskLevel;
  if (scoreLabel) scoreLabel.textContent = '30D Return';
  if (scoreValue) {
    const sign = index.performance30d >= 0 ? '+' : '';
    scoreValue.textContent = sign + index.performance30d + '%';
    scoreValue.classList.remove('up', 'down');
    scoreValue.classList.add(index.performance30d >= 0 ? 'up' : 'down');
  }

  if (commentEl) {
    const expertsLine = 'Experts: ' + index.experts.join(', ');
    commentEl.textContent =
      index.description +
      ' Category: ' + index.category +
      '. ' + expertsLine;
  }

  if (actionButton) {
    actionButton.textContent = index.isInvested ? 'Invested' : 'Invest in Index';
    actionButton.classList.toggle('btn-outline', index.isInvested);
    actionButton.classList.toggle('btn-primary', !index.isInvested);
  }
}

function closeReviewModal(event) {
  if (event && event.target.id && event.target.id !== 'reviewModal') return;
  document.getElementById('reviewModal')?.classList.remove('open');
}

function openIndexModal(indexId) {
  const found = indexesData.find(index => index.id === indexId);
  if (!found) return;

  activeIndex = found;
  renderIndexInModal(found);
  document.getElementById('reviewModal')?.classList.add('open');
}

function handleModalInvestClick() {
  if (!activeIndex) return;

  activeIndex.isInvested = true;
  const state = readInvestedState();
  state[activeIndex.id] = true;
  writeInvestedState(state);

  renderIndexInModal(activeIndex);
  refreshCategoryCards();
}

function setupCategoryButtons() {
  const cards = document.querySelectorAll('#category .cat-card');
  cards.forEach(card => {
    const index = getIndexForCard(card);
    if (!index) return;

    const button = card.querySelector('button[data-index-id], .btn');
    if (!button) return;

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openIndexModal(index.id);
    });
  });
}

async function initCategoryIndexes() {
  try {
    await loadIndexes();
    const modal = await ensureSharedModal();
    ensureModalInvestControls(modal);
    setupCategoryButtons();
    refreshCategoryCards();
  } catch (error) {
    console.error(error);
  }
}

window.closeReviewModal = closeReviewModal;
document.addEventListener('DOMContentLoaded', initCategoryIndexes);

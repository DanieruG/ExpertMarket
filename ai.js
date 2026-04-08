const pageFiles = {
  landing: 'expertmarket.html',
  dashboard: 'dashboard.html',
  profile: 'profile.html',
  stock: 'stock.html',
  category: 'category.html',
  review: 'review.html',
  ai: 'ai.html',
  portfolio: 'portfolio.html',
  ipo: 'ipo.html',
  trust: 'trust.html'
};

let expertDataCache = [];

function togglePill(el) {
  el.classList.toggle('selected');
}

function normalise(str) {
  return (str || '').trim().toLowerCase();
}

function getSelectedInterests() {
  return [...document.querySelectorAll('.pill-opt.selected')]
    .map(el => el.textContent.trim());
}

function setStatus(message, isError = false) {
  const statusEl = document.getElementById('aiStatusMessage');
  if (!statusEl) return;
  statusEl.style.display = message ? 'block' : 'none';
  statusEl.textContent = message || '';
  statusEl.style.color = isError ? '#ff7b7b' : '';
}

async function loadExperts() {
  if (expertDataCache.length) return expertDataCache;

  const response = await fetch('experts.json');
  if (!response.ok) {
    throw new Error(`Failed to load experts.json (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('experts.json must contain an array of experts.');
  }

  expertDataCache = data;
  return expertDataCache;
}

function getUserLabels(userType, goal) {
  const userTypeLabelMap = {
    beginner: 'Beginner Investor',
    trader: 'Experienced Trader',
    expert: 'Industry Expert'
  };

  const goalLabelMap = {
    steady: 'low-risk and steady growth',
    momentum: 'momentum and trend exposure',
    longterm: 'long-term conviction',
    niche: 'discovering niche experts',
    local: 'local expertise only'
  };

  return {
    userTypeLabel: userTypeLabelMap[userType] || 'User',
    goalLabel: goalLabelMap[goal] || 'general investing'
  };
}

function getGoalPreferredRisk(goal) {
  switch (goal) {
    case 'steady':
    case 'longterm':
    case 'local':
      return ['Low', 'Medium'];
    case 'momentum':
    case 'niche':
      return ['Medium', 'High'];
    default:
      return ['Low', 'Medium', 'High'];
  }
}

function calculateExpertMatch(expert, profile) {
  let score = 0;
  const reasons = [];

  const expertCity = normalise(expert.city);
  const userCity = normalise(profile.city);

  const expertCategories = (expert.categories || []).map(normalise);
  const selectedInterests = profile.selectedPills.map(normalise);

  const interestMatches = selectedInterests.filter(interest =>
    expertCategories.includes(interest)
  );

  if (interestMatches.length > 0) {
    score += Math.min(36, interestMatches.length * 18);
    reasons.push(`strong category overlap in ${interestMatches.join(', ')}`);
  }

  if (expertCity === userCity) {
    score += 20;
    reasons.push('same-city relevance');
  } else if (profile.goal !== 'local') {
    score += 6;
  }

  if ((expert.experienceFit || []).includes(profile.userType)) {
    score += 14;
    reasons.push('good experience-level fit');
  }

  if ((expert.goalsFit || []).includes(profile.goal)) {
    score += 14;
    reasons.push('goal alignment');
  }

  if (getGoalPreferredRisk(profile.goal).includes(expert.risk)) {
    score += 8;
    reasons.push(`risk aligned to a ${profile.goal} strategy`);
  }

  const confidenceValue = Number(expert.confidence || 0);
  score += Math.round(confidenceValue * 0.12);

  score = Math.min(100, score);

  return {
    ...expert,
    score,
    matchReasons: reasons
  };
}

function buildAISummary(profile, rankedExperts) {
  const { userTypeLabel, goalLabel } = getUserLabels(profile.userType, profile.goal);
  const topExpert = rankedExperts[0];

  let aiTone = '';
  if (profile.userType === 'beginner') {
    aiTone = 'The ranking prioritises clarity, accessibility, and easier-to-understand expert opportunities.';
  } else if (profile.userType === 'trader') {
    aiTone = 'The ranking balances conviction, momentum, and portfolio structure for a more active trading approach.';
  } else {
    aiTone = 'The ranking emphasises specialist signals, category positioning, and broader market interpretation.';
  }

  let goalTone = '';
  if (profile.goal === 'steady') {
    goalTone = ' Safer and more established experts are weighted more heavily.';
  } else if (profile.goal === 'momentum') {
    goalTone = ' Faster-moving and trend-driven opportunities are prioritised.';
  } else if (profile.goal === 'longterm') {
    goalTone = ' Picks are biased toward durable credibility and long-term positioning.';
  } else if (profile.goal === 'niche') {
    goalTone = ' More specialist and under-the-radar experts are surfaced.';
  } else if (profile.goal === 'local') {
    goalTone = ' Local relevance and city fit are emphasised more strongly.';
  }

  const avgScore =
    rankedExperts.length > 0
      ? Math.round(rankedExperts.reduce((sum, expert) => sum + expert.score, 0) / rankedExperts.length)
      : 0;

  const article = /^[aeiou]/i.test(userTypeLabel) ? 'an' : 'a';

  if (!topExpert) {
    return `You are using the platform as ${article} ${userTypeLabel.toLowerCase()} in ${profile.city}, with a focus on ${profile.selectedPills.join(', ')}. The AI analysed experts using category overlap, city fit, experience fit, goal fit, and risk compatibility, but it could not find any strong matches in the current pool.`;
  }

  return `You are using the platform as ${article} ${userTypeLabel.toLowerCase()} in ${profile.city}, with a focus on ${profile.selectedPills.join(', ')}. The AI ranked experts using category overlap, city fit, experience fit, goal fit, and risk compatibility. Your strongest current match is ${topExpert.name} with a ${topExpert.score}% compatibility score for your goal of ${goalLabel}. ${aiTone}${goalTone} The current candidate pool has an average compatibility score of ${avgScore}%.`;
}

function truncateText(text, maxLength = 110) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}…` : text;
}

function openExpertProfile(expertId) {
  const expert = expertDataCache.find(item => String(item.id) === String(expertId));
  if (!expert) {
    window.location.href = 'profile.html';
    return;
  }

  localStorage.setItem('selectedExpert', JSON.stringify(expert));
  localStorage.setItem('lastSeenExpertId', String(expert.id));
  window.location.href = `profile.html?expert=${expert.id}`;
}

function renderExperts(rankedExperts, city) {
  const expertRecommendations = document.getElementById('expertRecommendations');

  if (!rankedExperts.length) {
    expertRecommendations.innerHTML = `
      <div class="card">
        <div class="ai-text">
          No experts matched your current filters. Try adding more interests or broadening the goal.
        </div>
      </div>
    `;
    return;
  }

  const performanceByRisk = {
    Low: '▲ 1.1%',
    Medium: '▲ 2.4%',
    High: '▲ 3.7%'
  };

  const signalByScore = score => {
    if (score >= 92) return 'Strong Buy Signal';
    if (score >= 86) return 'Active Growth Phase';
    if (score >= 78) return 'Undervalued Pick';
    return 'Watchlist Candidate';
  };

  expertRecommendations.innerHTML = rankedExperts
    .slice(0, 3)
    .map(expert => `
      <div class="ai-expert-card-compact" onclick="openExpertProfile(${expert.id})">
        <div class="ai-expert-card-head">
          <div class="expert-av ${expert.avClass || 'a1'}">${expert.initials}</div>
          <div>
            <div class="ai-expert-card-name">${expert.name}</div>
            <div class="ai-expert-card-meta">
              ${expert.niche || ((expert.categories && expert.categories[0]) || 'Specialist')} · ${expert.city || city}
            </div>
          </div>
        </div>

        <div class="ai-expert-badge-row">
          <span class="badge badge-purple">${expert.badge || 'Recommended'}</span>
        </div>

        <div class="ai-expert-card-bio">
          ${truncateText(expert.bio)}
        </div>

        <div class="ai-expert-card-price-row">
          <div class="ai-expert-card-price">${expert.price}</div>
          <span class="badge badge-green">${performanceByRisk[expert.risk] || '▲ 2.0%'}</span>
        </div>

        <div class="ai-expert-card-match">
          AI Match Score: <strong>${expert.score}%</strong> · ${signalByScore(expert.score)}
        </div>

        <div class="ai-expert-card-footnote">
          Confidence ${expert.confidence}% · Risk ${expert.risk}
        </div>

        <button class="btn btn-primary btn-sm ai-expert-card-btn" onclick="event.stopPropagation(); openExpertProfile(${expert.id})">
          View Profile
        </button>
      </div>
    `)
    .join('');
}

function renderStarterPortfolio(profile, rankedExperts, suggestedIndices) {
  const starterPortfolio = document.getElementById('starterPortfolio');
  const starterPortfolioIntro = document.getElementById('starterPortfolioIntro');
  const starterPortfolioReason = document.getElementById('starterPortfolioReason');

  if (!starterPortfolio || !starterPortfolioIntro || !starterPortfolioReason) return;

  if (!rankedExperts.length) {
    starterPortfolioIntro.textContent = 'No starter allocation could be created because there were no strong expert matches.';
    starterPortfolio.innerHTML = '';
    starterPortfolioReason.innerHTML = '';
    return;
  }

  const topExpert = rankedExperts[0];
  const secondExpert = rankedExperts[1] || null;
  const topIndex = suggestedIndices[0] || {
    name: 'Balanced Expert Composite',
    description: 'A broad basket combining credibility, momentum, and niche exposure.'
  };

  let allocationPlan = [];

  if (profile.userType === 'beginner') {
    if (profile.goal === 'steady' || profile.goal === 'longterm' || profile.goal === 'local') {
      allocationPlan = [
        {
          label: topExpert.name,
          percent: 40,
          note: `Top match with ${topExpert.score}% compatibility and a ${topExpert.risk.toLowerCase()} to medium risk fit.`
        },
        {
          label: topIndex.name,
          percent: 35,
          note: 'Adds broader diversification so the portfolio is not over-dependent on one expert.'
        },
        {
          label: secondExpert ? secondExpert.name : 'Secondary Expert',
          percent: 15,
          note: secondExpert
            ? 'Secondary position to reduce concentration while keeping relevance to your chosen interests.'
            : 'Smaller second position to keep the allocation balanced.'
        },
        {
          label: 'Reserve Cash',
          percent: 10,
          note: 'Keeps flexibility for future buys and reduces overcommitting too early.'
        }
      ];
    } else {
      allocationPlan = [
        {
          label: topExpert.name,
          percent: 35,
          note: 'Main starter position based on strongest AI compatibility.'
        },
        {
          label: secondExpert ? secondExpert.name : topIndex.name,
          percent: 25,
          note: 'Adds another source of exposure without becoming too concentrated.'
        },
        {
          label: topIndex.name,
          percent: 25,
          note: 'Helps diversify category and signal exposure.'
        },
        {
          label: 'Reserve Cash',
          percent: 15,
          note: 'Leaves room for follow-up entries once more signals appear.'
        }
      ];
    }
  } else if (profile.userType === 'trader') {
    if (profile.goal === 'momentum' || profile.goal === 'niche') {
      allocationPlan = [
        {
          label: topExpert.name,
          percent: 40,
          note: 'Highest-conviction match with strong alignment to your more active strategy.'
        },
        {
          label: secondExpert ? secondExpert.name : topIndex.name,
          percent: 25,
          note: secondExpert
            ? 'Second expert position adds upside while spreading individual-expert risk.'
            : 'Secondary thematic exposure for a broader opportunity set.'
        },
        {
          label: topIndex.name,
          percent: 20,
          note: 'Maintains some diversification alongside your top expert picks.'
        },
        {
          label: 'Reserve Cash',
          percent: 15,
          note: 'Useful for reacting quickly to new momentum signals.'
        }
      ];
    } else {
      allocationPlan = [
        {
          label: topExpert.name,
          percent: 35,
          note: 'Core position anchored around your strongest AI-ranked expert.'
        },
        {
          label: topIndex.name,
          percent: 30,
          note: 'Provides a diversified layer under the core expert position.'
        },
        {
          label: secondExpert ? secondExpert.name : 'Secondary Expert',
          percent: 20,
          note: secondExpert
            ? 'Adds another expert with strong overlap to your chosen categories.'
            : 'Adds a second smaller position to reduce single-name concentration.'
        },
        {
          label: 'Reserve Cash',
          percent: 15,
          note: 'Preserves optionality while keeping the overall mix balanced.'
        }
      ];
    }
  } else {
    if (profile.goal === 'niche' || profile.goal === 'momentum') {
      allocationPlan = [
        {
          label: topExpert.name,
          percent: 45,
          note: 'Largest position goes to the strongest specialist match on the page.'
        },
        {
          label: secondExpert ? secondExpert.name : topIndex.name,
          percent: 25,
          note: 'Supports the main idea with another high-relevance position.'
        },
        {
          label: topIndex.name,
          percent: 15,
          note: 'Provides some diversification without diluting conviction too heavily.'
        },
        {
          label: 'Reserve Cash',
          percent: 15,
          note: 'Keeps room for tactical adds or new opportunities.'
        }
      ];
    } else {
      allocationPlan = [
        {
          label: topExpert.name,
          percent: 40,
          note: 'Core high-conviction position based on strongest compatibility score.'
        },
        {
          label: topIndex.name,
          percent: 25,
          note: 'Adds broader thematic balance to a more concentrated portfolio.'
        },
        {
          label: secondExpert ? secondExpert.name : 'Secondary Expert',
          percent: 20,
          note: secondExpert
            ? 'Complements the core position with another aligned expert.'
            : 'Adds another smaller allocation to reduce reliance on one name.'
        },
        {
          label: 'Reserve Cash',
          percent: 15,
          note: 'Preserves optionality and entry flexibility.'
        }
      ];
    }
  }

  starterPortfolioIntro.textContent =
    `This is a sample starter allocation based on your ${profile.userType} profile, your goal of ${getUserLabels(profile.userType, profile.goal).goalLabel}, and the risk profile of your top-matched recommendations above.`;

  starterPortfolio.innerHTML = allocationPlan
    .map(item => `
      <div class="ai-allocation-item">
        <div class="ai-portfolio-line">
          <span>${item.label}</span>
          <span>${item.percent}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${item.percent}%"></div>
        </div>
        <div class="ai-allocation-note">${item.note}</div>
      </div>
    `)
    .join('');

  starterPortfolioReason.innerHTML = `
    <div class="ai-why-list">
      <div class="ai-why-item">The largest allocation goes to <strong>${topExpert.name}</strong> because they are the strongest match in your current recommendation set.</div>
      <div class="ai-why-item">The allocation includes <strong>${topIndex.name}</strong> to reduce overexposure to a single expert while keeping category relevance.</div>
      <div class="ai-why-item">A <strong>Reserve Cash</strong> allocation is included to keep flexibility for future signals, price moves, or additional expert entries.</div>
    </div>
  `;
}

function buildIndexSuggestions(profile, rankedExperts) {
  const indices = [];
  const topCategories = [...new Set(rankedExperts.flatMap(expert => expert.categories || []))];

  if (profile.selectedPills.includes('Japanese') || topCategories.includes('Japanese')) {
    indices.push({
      name: 'Tokyo Tastes Index',
      description: 'Tracks trusted Japanese dining experts and premium East Asian food trends.',
      allocation: '30%'
    });
  }

  if (profile.selectedPills.includes('Street Food') || profile.goal === 'momentum') {
    indices.push({
      name: 'Urban Momentum Basket',
      description: 'Higher-beta basket focused on fast-moving food signals and discovery trends.',
      allocation: '25%'
    });
  }

  if (profile.selectedPills.includes('Fine Dining') || profile.goal === 'longterm') {
    indices.push({
      name: 'Premium Credibility Index',
      description: 'Weights established experts with stronger reputational durability and lower volatility.',
      allocation: '25%'
    });
  }

  if (profile.selectedPills.includes('Fusion') || profile.goal === 'niche') {
    indices.push({
      name: 'Fusion Discovery Basket',
      description: 'A niche-growth basket for cross-category experts with stronger upside.',
      allocation: '20%'
    });
  }

  if (indices.length === 0) {
    indices.push({
      name: 'Balanced Expert Composite',
      description: 'A broad basket combining credibility, momentum, and niche exposure across your selected sectors.',
      allocation: '100%'
    });
  }

  return indices.slice(0, 3);
}

function renderIndices(indices) {
  const suggestedIndices = document.getElementById('suggestedIndices');

  suggestedIndices.innerHTML = indices
    .map(index => `
      <div class="card" style="margin-bottom:14px;">
        <div class="card-title">${index.name}</div>
        <div class="ai-text">${index.description}</div>
        <div class="ai-expert-note" style="margin-top:10px;">Suggested allocation: ${index.allocation}</div>
      </div>
    `)
    .join('');
}

function renderDiversification(profile) {
  const diversificationText = document.getElementById('diversificationText');

  if (profile.selectedPills.length === 1) {
    diversificationText.textContent =
      `Your current preference set is concentrated in ${profile.selectedPills[0]} within ${profile.city}. To reduce concentration risk, consider adding adjacent categories such as Fusion, Street Food, or Fine Dining.`;
  } else if (profile.selectedPills.length === 2) {
    diversificationText.textContent =
      `Your interests are moderately diversified across ${profile.selectedPills.join(' and ')} in ${profile.city}. A sensible next step is to combine one established expert, one emerging expert, and one broader basket position.`;
  } else {
    diversificationText.textContent =
      `Your interests are already well diversified across ${profile.selectedPills.join(', ')} in ${profile.city}. The AI suggests maintaining a blend of established experts, specialist positions, and a small discovery allocation.`;
  }
}

function renderWhyPicks(profile, rankedExperts) {
  const whyPicksText = document.getElementById('whyPicksText');
  const topExpert = rankedExperts[0];
  const labels = getUserLabels(profile.userType, profile.goal);

  whyPicksText.innerHTML = `
    <div class="ai-why-list">
      <div class="ai-why-item">These experts align closely with your selected categories: <strong>${profile.selectedPills.join(', ')}</strong>.</div>
      <div class="ai-why-item">The picks are adapted for a <strong>${labels.userTypeLabel.toLowerCase()}</strong>.</div>
      <div class="ai-why-item">Your chosen goal of <strong>${labels.goalLabel}</strong> changes the weighting for risk, locality, and conviction.</div>
      <div class="ai-why-item">${topExpert ? `The current top expert is <strong>${topExpert.name}</strong> because they scored highest across relevance, fit, and confidence.` : 'No expert currently scored high enough to become a top recommendation.'}</div>
    </div>
  `;
}

function renderTopMatchSummary(rankedExperts) {
  const topMatchSummary = document.getElementById('topMatchSummary');

  if (!rankedExperts.length) {
    topMatchSummary.textContent = 'No top match could be generated from the current input set.';
    return;
  }

  const topExpert = rankedExperts[0];
  topMatchSummary.innerHTML = `
    <strong>${topExpert.name}</strong> is currently your strongest fit at <strong>${topExpert.score}% compatibility</strong>.
    Their profile stands out because of ${topExpert.matchReasons.slice(0, 3).join(', ')}.
    They are priced at <strong>${topExpert.price}</strong> with an AI confidence score of <strong>${topExpert.confidence}%</strong>.
  `;
}

async function generateAIPicks() {
  const userType = document.getElementById('userType').value;
  const city = document.getElementById('cityInput').value.trim();
  const goal = document.getElementById('investmentGoal').value;
  const selectedPills = getSelectedInterests();

  if (!userType || !city || selectedPills.length === 0) {
    alert('Please select a user type, enter a city, and choose at least one interest.');
    return;
  }

  const generateBtn = document.getElementById('generateBtn');
  const aiResults = document.getElementById('aiResults');
  const aiSummaryText = document.getElementById('aiSummaryText');

  try {
    generateBtn.disabled = true;
    setStatus('Loading expert profiles...');

    const experts = await loadExperts();

    const profile = { userType, city, goal, selectedPills };

    const relevantExperts = experts.filter(expert => {
      const expertCategories = (expert.categories || []).map(normalise);
      return selectedPills.some(interest => expertCategories.includes(normalise(interest)));
    });

    const rankedExperts = relevantExperts
      .map(expert => calculateExpertMatch(expert, profile))
      .sort((a, b) => b.score - a.score || Number(b.confidence) - Number(a.confidence));

    aiSummaryText.textContent = buildAISummary(profile, rankedExperts);

    renderExperts(rankedExperts, city);

    const suggestedIndices = buildIndexSuggestions(profile, rankedExperts);
    renderStarterPortfolio(profile, rankedExperts, suggestedIndices);
    renderIndices(suggestedIndices);

    renderDiversification(profile);
    renderWhyPicks(profile, rankedExperts);
    renderTopMatchSummary(rankedExperts);

    aiResults.classList.remove('ai-results-hidden');
    aiResults.classList.add('ai-results-visible');

    setStatus('AI recommendations generated successfully below.');
  } catch (error) {
    console.error(error);
    setStatus(`Could not load expert data. ${error.message}`, true);
    alert('Could not load expert recommendations. Make sure experts.json exists and you are running the site through a local server.');
  } finally {
    generateBtn.disabled = false;
  }
}

(function initPage() {
  const id = document.body.dataset.page;
  const ticker = document.getElementById('ticker');
  if (ticker) ticker.style.display = id === 'landing' ? 'none' : 'block';

  const navMap = {
    landing: 0,
    dashboard: 1,
    profile: 2,
    stock: 3,
    category: 4,
    review: 5,
    ai: 6,
    portfolio: 7,
    ipo: 8,
    trust: 9
  };

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.nav-item')[navMap[id]]?.classList.add('active');
})();
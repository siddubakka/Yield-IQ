// ============================================================
// YieldIQ — Full Application JavaScript
// ============================================================

// ---- PAGE NAVIGATION ----
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
    if (pageId === 'dashboard-page') {
        const user = getUser();
        const fallbackName = user.name || 'Farmer';
        
        // Update topbar avatar
        const userAvatarImg = document.getElementById('userAvatarImg');
        const userName = document.getElementById('userName');
        if (userAvatarImg) userAvatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=00f0ff&color=050814&bold=true`;
        if (userName) userName.textContent = fallbackName;
        
        // Update welcome message
        const welcomeHeader = document.querySelector('#dashboard-home .view-header h2');
        if (welcomeHeader) welcomeHeader.textContent = `Welcome back, ${fallbackName}! 👋`;

        initDashboardChart();
        fetchWeatherData();
        populateMarketTable();
        populateBuyers();
        loadDashboardStats();
    }
}

// ---- REAL-TIME DASHBOARD STATS ----
async function loadDashboardStats() {
    const user = getUser();

    // 1. Portfolio Value & My Listings (from real listings data)
    try {
        const res = await fetch('http://127.0.0.1:5000/api/listings');
        const allListings = await res.json();
        const myListings = allListings.filter(l => l.seller_email === user.email);
        
        // Portfolio = sum of (price * quantity) for all my listings
        const portfolioValue = myListings.reduce((sum, l) => sum + (l.price * l.quantity), 0);
        
        const statPortfolio = document.getElementById('statPortfolio');
        const statPortfolioSub = document.getElementById('statPortfolioSub');
        const statListings = document.getElementById('statListings');
        const statListingsSub = document.getElementById('statListingsSub');
        
        if (statPortfolio) {
            if (portfolioValue > 0) {
                statPortfolio.textContent = `₹${portfolioValue.toLocaleString('en-IN')}`;
                statPortfolioSub.innerHTML = `<i class="ph ph-trend-up"></i> ${myListings.length} active crop${myListings.length !== 1 ? 's' : ''} listed`;
                statPortfolioSub.className = 'stat-badge positive';
            } else {
                statPortfolio.textContent = '₹0';
                statPortfolioSub.textContent = 'List crops to build portfolio';
                statPortfolioSub.className = 'stat-badge text-cyan';
            }
        }
        
        if (statListings) {
            statListings.textContent = `${myListings.length} Crops`;
            statListingsSub.textContent = `${allListings.length} total in marketplace`;
            statListingsSub.className = 'stat-badge text-cyan';
        }
    } catch(e) {
        const sp = document.getElementById('statPortfolio');
        if (sp) sp.textContent = '—';
        const sl = document.getElementById('statListings');
        if (sl) sl.textContent = '—';
    }

    // 2. Active Offers (from real offers data)
    try {
        if (user.email) {
            const res = await fetch(`http://127.0.0.1:5000/api/offers/user/${user.email}`);
            const offers = await res.json();
            const incoming = offers.as_seller || [];
            const outgoing = offers.as_buyer || [];
            const totalOffers = incoming.length + outgoing.length;
            const pendingCount = [...incoming, ...outgoing].filter(o => o.status === 'pending').length;
            
            const statOffers = document.getElementById('statOffers');
            const statOffersSub = document.getElementById('statOffersSub');
            
            if (statOffers) {
                statOffers.textContent = `${totalOffers} Offer${totalOffers !== 1 ? 's' : ''}`;
                if (pendingCount > 0) {
                    statOffersSub.innerHTML = `<i class="ph ph-warning"></i> ${pendingCount} pending action`;
                    statOffersSub.className = 'stat-badge text-yellow';
                } else {
                    statOffersSub.textContent = 'All up to date';
                    statOffersSub.className = 'stat-badge positive';
                }
            }
        } else {
            const so = document.getElementById('statOffers');
            if (so) so.textContent = '0 Offers';
        }
    } catch(e) {
        const so = document.getElementById('statOffers');
        if (so) so.textContent = '—';
    }

    // 3. AI Recommendations (from real market data)
    loadAIRecommendations();
}

async function loadAIRecommendations() {
    const recsList = document.getElementById('aiRecsList');
    if (!recsList) return;

    try {
        const res = await fetch('http://127.0.0.1:5000/api/markets');
        const markets = await res.json();
        
        if (!markets || markets.length === 0) {
            recsList.innerHTML = '<li><div class="rec-icon bg-yellow"><i class="ph ph-warning"></i></div><div class="rec-info"><h4>No Market Data</h4><p>Market data unavailable right now.</p></div></li>';
            return;
        }

        // Analyze real market data to generate recommendations
        const recs = [];
        
        // Find crops with highest positive change → SELL
        const risers = markets.filter(m => m.change > 2).sort((a, b) => b.change - a.change);
        if (risers.length > 0) {
            const top = risers[0];
            recs.push(`<li>
                <div class="rec-icon bg-green"><i class="ph ph-arrow-up-right"></i></div>
                <div class="rec-info"><h4>SELL: ${top.crop}</h4><p>Up ${top.change}% at ${top.mandi} — ₹${top.price.toLocaleString('en-IN')}/qtl</p></div>
                <button class="btn btn-sm btn-primary" onclick="switchView(document.querySelector('[data-view=negotiate-view]'),'negotiate-view')">Trade</button>
            </li>`);
        }

        // Find crops with negative change → BUY opportunity
        const fallers = markets.filter(m => m.change < -1).sort((a, b) => a.change - b.change);
        if (fallers.length > 0) {
            const bottom = fallers[0];
            recs.push(`<li>
                <div class="rec-icon bg-blue"><i class="ph ph-shopping-cart"></i></div>
                <div class="rec-info"><h4>BUY: ${bottom.crop}</h4><p>Down ${Math.abs(bottom.change)}% — good entry at ₹${bottom.price.toLocaleString('en-IN')}/qtl</p></div>
                <button class="btn btn-sm btn-outline" onclick="switchView(document.querySelector('[data-view=marketplace-view]'),'marketplace-view')">Browse</button>
            </li>`);
        }

        // Find stable crops → HOLD
        const stable = markets.filter(m => Math.abs(m.change) <= 2 && Math.abs(m.change) > 0).slice(0, 1);
        if (stable.length > 0) {
            const s = stable[0];
            recs.push(`<li>
                <div class="rec-icon bg-yellow"><i class="ph ph-clock"></i></div>
                <div class="rec-info"><h4>HOLD: ${s.crop}</h4><p>Steady at ₹${s.price.toLocaleString('en-IN')}/qtl (${s.change > 0 ? '+' : ''}${s.change}%) — wait for better price</p></div>
            </li>`);
        }

        // Highest price crop
        const highest = [...markets].sort((a, b) => b.price - a.price)[0];
        if (highest && !risers.find(r => r.crop === highest.crop)) {
            recs.push(`<li>
                <div class="rec-icon bg-green"><i class="ph ph-crown"></i></div>
                <div class="rec-info"><h4>TOP: ${highest.crop}</h4><p>Highest price ₹${highest.price.toLocaleString('en-IN')}/qtl at ${highest.mandi}</p></div>
                <button class="btn btn-sm btn-primary" onclick="switchView(document.querySelector('[data-view=markets-view]'),'markets-view')">Markets</button>
            </li>`);
        }

        recsList.innerHTML = recs.length > 0 ? recs.join('') : '<li><div class="rec-icon bg-blue"><i class="ph ph-check"></i></div><div class="rec-info"><h4>All Stable</h4><p>Markets are stable today. No urgent actions needed.</p></div></li>';
    } catch(e) {
        recsList.innerHTML = '<li><div class="rec-icon bg-yellow"><i class="ph ph-warning"></i></div><div class="rec-info"><h4>Offline</h4><p>Could not load market data for recommendations.</p></div></li>';
    }
}

let isSignUpMode = false;

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    const nameGrp = document.getElementById('nameGroup');
    const phoneGrp = document.getElementById('phoneGroup');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleTxt = document.getElementById('authToggleText');
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    
    if (isSignUpMode) {
        nameGrp.style.display = 'block';
        phoneGrp.style.display = 'block';
        submitBtn.innerHTML = '<i class="ph ph-user-plus"></i> Create Account';
        toggleTxt.innerHTML = 'Already have an account? <strong>Login</strong>';
    } else {
        nameGrp.style.display = 'none';
        phoneGrp.style.display = 'none';
        submitBtn.innerHTML = '<i class="ph ph-sign-in"></i> Login to Dashboard';
        toggleTxt.innerHTML = "Don't have an account? <strong>Sign Up</strong>";
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');

    const endpoint = isSignUpMode ? '/api/auth/register' : '/api/auth/login';
    const payload = { email, password: pass };
    
    if (isSignUpMode) {
        payload.name = document.getElementById('loginName').value || 'Farmer';
        payload.phone = document.getElementById('loginPhone').value || '';
    }

    try {
        const res = await fetch(`http://127.0.0.1:5000${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            if (isSignUpMode) {
                // If signed up, immediately login
                toggleAuthMode();
                document.getElementById('loginPassword').value = pass;
                errEl.textContent = '✅ Sign up successful! Logging you in...';
                errEl.style.color = 'var(--primary)';
                setTimeout(() => handleAuth(new Event('submit', { cancelable: true })), 1000);
            } else {
                errEl.textContent = '';
                errEl.style.color = 'var(--danger)';
                localStorage.setItem('yieldiq_user', JSON.stringify(data.user));
                localStorage.setItem('yieldiq_token', data.token);
                showPage('dashboard-page');
            }
        } else {
            errEl.textContent = '❌ ' + data.message;
            errEl.style.color = 'var(--danger)';
        }
    } catch(err) {
        errEl.textContent = '❌ Could not connect to API server.';
        errEl.style.color = 'var(--danger)';
    }
    return false;
}

async function socialLogin(provider) {
    const errEl = document.getElementById('loginError');
    errEl.textContent = `⏳ Connecting to ${provider}...`;
    errEl.style.color = 'var(--primary)';
    
    // Realistic simulated OAuth popup
    const simulatedAccount = await new Promise((resolve) => {
        const popup = document.createElement('div');
        popup.style.position = 'fixed';
        popup.style.top = '0';
        popup.style.left = '0';
        popup.style.width = '100vw';
        popup.style.height = '100vh';
        popup.style.backgroundColor = 'rgba(0,0,0,0.6)';
        popup.style.zIndex = '9999';
        popup.style.display = 'flex';
        popup.style.alignItems = 'center';
        popup.style.justifyContent = 'center';
        popup.style.backdropFilter = 'blur(5px)';
        
        const card = document.createElement('div');
        card.style.background = '#fff';
        card.style.color = '#333';
        card.style.borderRadius = '12px';
        card.style.padding = '2rem';
        card.style.width = '350px';
        card.style.textAlign = 'center';
        card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        card.style.fontFamily = "'Outfit', sans-serif";
        
        const isGoogle = provider === 'google';
        const color = isGoogle ? '#4285F4' : '#1877F2';
        const logo = isGoogle ? 'Google' : 'Facebook';
        
        card.innerHTML = `
            <div style="font-size:24px; font-weight:bold; color:${color}; margin-bottom: 20px;">${logo}</div>
            <h3 style="margin-bottom: 10px;">Sign in</h3>
            <p style="color:#666; font-size:14px; margin-bottom:20px;">to continue to YieldIQ</p>
            <input type="email" id="socialMockEmail" placeholder="Email or phone" style="width:100%; padding:10px; margin-bottom:15px; border:1px solid #ccc; border-radius:4px; font-size:14px; color:#333; background:#fff">
            <input type="text" id="socialMockName" placeholder="Full Name" style="width:100%; padding:10px; margin-bottom:20px; border:1px solid #ccc; border-radius:4px; font-size:14px; color:#333; background:#fff">
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button id="socialCancelBtn" style="padding:10px 15px; border:none; background:transparent; color:#666; font-weight:bold; cursor:pointer;">Cancel</button>
                <button id="socialNextBtn" style="padding:10px 20px; border:none; background:${color}; color:#fff; border-radius:4px; font-weight:bold; cursor:pointer;">Next</button>
            </div>
        `;
        
        popup.appendChild(card);
        document.body.appendChild(popup);
        
        document.getElementById('socialCancelBtn').onclick = () => {
            document.body.removeChild(popup);
            resolve(null);
        };
        
        document.getElementById('socialNextBtn').onclick = () => {
            const email = document.getElementById('socialMockEmail').value.trim();
            const name = document.getElementById('socialMockName').value.trim();
            if (email && name) {
                document.body.removeChild(popup);
                resolve({ email, name });
            } else {
                alert('Please fill in both fields.');
            }
        };
    });

    if (!simulatedAccount) {
        errEl.textContent = '❌ Login cancelled.';
        errEl.style.color = 'var(--danger)';
        return;
    }

    try {
        const res = await fetch('http://127.0.0.1:5000/api/auth/social', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, email: simulatedAccount.email, name: simulatedAccount.name })
        });
        const data = await res.json();
        
        if (data.success) {
            errEl.textContent = `✅ Logged in with ${provider}!`;
            errEl.style.color = 'var(--secondary)';
            localStorage.setItem('yieldiq_user', JSON.stringify(data.user));
            localStorage.setItem('yieldiq_token', data.token);
            setTimeout(() => {
                showPage('dashboard-page');
            }, 800);
        } else {
            errEl.textContent = '❌ ' + data.message;
            errEl.style.color = 'var(--danger)';
        }
    } catch(err) {
        errEl.textContent = '❌ Could not connect to API server.';
        errEl.style.color = 'var(--danger)';
    }
}

function toggleNotifPanel() {
    const p = document.getElementById('notifPanel');
    const profileP = document.getElementById('profilePanel');
    if (profileP) profileP.style.display = 'none'; // Close profile if open
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function toggleProfilePanel() {
    const p = document.getElementById('profilePanel');
    const notifP = document.getElementById('notifPanel');
    if (notifP) notifP.style.display = 'none'; // Close notif if open
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
    if (p.style.display === 'block') {
        const user = getUser();
        const fallbackName = user.name || 'Farmer';
        const phone = user.phone || '—';
        document.getElementById('profileName').textContent = fallbackName;
        document.getElementById('profileEmail').textContent = user.email || '—';
        document.getElementById('profilePhone').textContent = phone;
        const pAvatar = document.getElementById('profileAvatar');
        if (pAvatar) {
            pAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fallbackName)}&background=00f0ff&color=050814&bold=true&size=80`;
        }
    }
}

function handleLogout() {
    localStorage.removeItem('yieldiq_user');
    showPage('landing-page');
}

// Check if already logged in
(function checkSession() {
    const user = localStorage.getItem('yieldiq_user');
    if (user) {
        // Show landing by default even if logged in
    }
    showPage('landing-page');
})();

// ---- SIDEBAR VIEW SWITCHING ----
function switchView(el, viewId) {
    document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');
    document.querySelectorAll('.dash-view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');

    if (viewId === 'crop-health-view') fetchWeatherData();
    if (viewId === 'markets-view') populateMarketTable();
    if (viewId === 'sell-crop-view') loadMyListings();
    if (viewId === 'marketplace-view') loadMarketplace();
    if (viewId === 'my-deals-view') loadMyDeals();
    if (viewId === 'negotiate-view') loadNegotiationBoard();
    if (viewId === 'buyers-view') populateBuyers();

    // Update mobile bottom nav active state
    document.querySelectorAll('.mob-nav-item').forEach(a => a.classList.remove('active'));
    const mobNav = document.querySelector(`.mob-nav-item[onclick*="${viewId}"]`);
    if (mobNav) mobNav.classList.add('active');
}

// ---- TICKER ----
async function initTicker() {
    const track = document.getElementById('ticker-track');
    let tickerData = [];
    try {
        const res = await fetch('http://127.0.0.1:5000/api/markets');
        const markets = await res.json();
        tickerData = markets.slice(0, 8).map(m => ({
            name: `${m.crop} (${m.mandi.split(',')[1]?.trim() || m.mandi})`,
            price: `₹${m.price.toLocaleString('en-IN')}/qtl`,
            change: `${m.change >= 0 ? '+' : ''}${m.change}%`,
            up: m.change >= 0
        }));
    } catch(e) {
        tickerData = [
            { name: 'Wheat (Punjab)', price: '₹2,840/qtl', change: '+2.4%', up: true },
            { name: 'Rice (UP)', price: '₹3,120/qtl', change: '+1.1%', up: true },
        ];
    }
    const items = [...tickerData, ...tickerData, ...tickerData];
    track.innerHTML = items.map(d => {
        const icon = d.up ? '<i class="ph ph-trend-up"></i>' : '<i class="ph ph-trend-down"></i>';
        const cls = d.up ? 'up' : 'down';
        return `<div class="ticker-item"><span style="color:var(--text-muted)">${d.name}</span> <span>${d.price}</span> <span class="${cls}">${icon} ${d.change}</span></div>`;
    }).join('<span style="opacity:0.15;margin:0 0.5rem">|</span>');
}

// ---- CHARTS ----
Chart.defaults.color = '#7a8ba8';
Chart.defaults.font.family = "'Outfit', sans-serif";

function initHeroChart() {
    const ctx = document.getElementById('heroChart');
    if (!ctx) return;
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, 'rgba(0,255,136,0.5)');
    gradient.addColorStop(1, 'rgba(0,255,136,0)');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{ data: [2700, 2750, 2720, 2800, 2780, 2830, 2840], borderColor: '#00ff88', backgroundColor: gradient, borderWidth: 3, tension: 0.4, fill: true, pointRadius: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, min: 2650 } }, animation: { duration: 2000 } }
    });
}

const cropChartData = {
    wheat: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [2700, 2720, 2680, 2760, 2800, 2790, 2840], color: '#00f0ff' },
    rice: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [3000, 3020, 3050, 3080, 3060, 3100, 3120], color: '#00ff88' },
    corn: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [2000, 1980, 1960, 1990, 1970, 1940, 1950], color: '#ffc107' },
    soybean: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [4200, 4280, 4350, 4300, 4400, 4450, 4510], color: '#ff6b9d' },
    cotton: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [6000, 6100, 6080, 6150, 6200, 6180, 6250], color: '#bd93f9' },
    mustard: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [5000, 5050, 4950, 5100, 5080, 5120, 5150], color: '#f1fa8c' },
    onion: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [1500, 1550, 1600, 1750, 1800, 1850, 1780], color: '#ffb86c' },
    potato: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [1100, 1150, 1200, 1220, 1250, 1240, 1280], color: '#8be9fd' },
    tomato: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [2200, 2350, 2400, 2550, 2600, 2580, 2700], color: '#ff5555' },
    sugarcane: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [300, 305, 310, 308, 315, 320, 318], color: '#50fa7b' },
    chilli: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [14000, 14200, 14500, 15000, 15200, 15500, 15600], color: '#ff0000' },
    garlic: { labels: ['Jan 1', 'Jan 5', 'Jan 10', 'Jan 15', 'Jan 20', 'Jan 25', 'Jan 30'], data: [10000, 10500, 11000, 11500, 12000, 12200, 12400], color: '#f8f8f2' }
};

let dashChart = null;
function initDashboardChart() {
    const canvas = document.getElementById('marketChart');
    if (!canvas) return;
    if (dashChart) dashChart.destroy();
    const crop = document.getElementById('cropSelect').value;
    const d = cropChartData[crop];
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 280);
    gradient.addColorStop(0, d.color + '66');
    gradient.addColorStop(1, d.color + '00');
    dashChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: d.labels,
            datasets: [{ label: 'Price (₹/Qtl)', data: d.data, borderColor: d.color, backgroundColor: gradient, borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#050814', pointBorderColor: d.color, pointBorderWidth: 2, pointRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15,20,40,0.95)', titleColor: '#00f0ff', padding: 10, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 } },
            scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' } } }
        }
    });
}
function updateMarketChart() { initDashboardChart(); }

// ---- WEATHER / CROP HEALTH (Multiple Open-Meteo APIs) ----
let currentWeatherCoords = { lat: 28.61, lon: 77.23, name: 'Delhi, India' };
let lastWeatherData = null; // Store for chatbot access

async function fetchWeatherData() {
    try {
        const { lat, lon } = currentWeatherCoords;
        
        // ===== API 1: Open-Meteo Current + 7-Day Forecast =====
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature,precipitation,uv_index,surface_pressure&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,uv_index_max,sunrise,sunset,weather_code&timezone=Asia/Kolkata&forecast_days=7`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();
        const c = weatherData.current;
        lastWeatherData = weatherData; // Save for chatbot

        // Dashboard stat card
        const tempEl = document.getElementById('weatherTemp');
        const descEl = document.getElementById('weatherDesc');
        if (tempEl) tempEl.textContent = `${c.temperature_2m}°C`;
        if (descEl) descEl.textContent = getWeatherDescription(c.weather_code);

        // Crop Health — Current Weather
        const weatherDetails = document.getElementById('weatherDetails');
        if (weatherDetails) {
            weatherDetails.innerHTML = `
                <div class="weather-row"><span class="weather-label">🌡️ Temperature</span><strong>${c.temperature_2m}°C</strong></div>
                <div class="weather-row"><span class="weather-label">🤒 Feels Like</span><strong>${c.apparent_temperature}°C</strong></div>
                <div class="weather-row"><span class="weather-label">💧 Humidity</span><strong>${c.relative_humidity_2m}%</strong></div>
                <div class="weather-row"><span class="weather-label">💨 Wind Speed</span><strong>${c.wind_speed_10m} km/h</strong></div>
                <div class="weather-row"><span class="weather-label">🌧️ Precipitation</span><strong>${c.precipitation} mm</strong></div>
                <div class="weather-row"><span class="weather-label">📊 Pressure</span><strong>${c.surface_pressure} hPa</strong></div>
                <div class="weather-row"><span class="weather-label">☀️ Condition</span><strong>${getWeatherDescription(c.weather_code)}</strong></div>
            `;
        }

        // ===== API 2: Open-Meteo Soil Data =====
        const soilUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_temperature_0cm,soil_moisture_0_to_1cm&timezone=Asia/Kolkata&forecast_days=1`;
        const soilRes = await fetch(soilUrl);
        const soilData = await soilRes.json();
        const soilDetails = document.getElementById('soilDetails');
        if (soilDetails && soilData.hourly) {
            const latestIdx = new Date().getHours();
            const soilTemp = soilData.hourly.soil_temperature_0cm?.[latestIdx] || (c.temperature_2m - 2).toFixed(1);
            const soilMoist = soilData.hourly.soil_moisture_0_to_1cm?.[latestIdx] || (c.relative_humidity_2m * 0.4).toFixed(1);
            const soilMoistPct = (soilMoist * 100).toFixed(1);
            soilDetails.innerHTML = `
                <div class="weather-row"><span class="weather-label">🌡️ Soil Temperature</span><strong>${soilTemp}°C</strong></div>
                <div class="weather-row"><span class="weather-label">💧 Soil Moisture</span><strong>${soilMoistPct}%</strong></div>
                <div class="weather-row"><span class="weather-label">⚗️ pH Level (est.)</span><strong>${(6.2 + Math.random() * 0.8).toFixed(1)}</strong></div>
                <div class="weather-row"><span class="weather-label">🧪 Nitrogen (est.)</span><strong>${(180 + Math.random() * 40).toFixed(0)} kg/ha</strong></div>
                <div class="weather-row"><span class="weather-label">🌱 Organic Carbon</span><strong>${(0.3 + Math.random() * 0.4).toFixed(2)}%</strong></div>
            `;
        }

        // Pest Alerts & Irrigation
        generatePestAlerts(c.temperature_2m, c.relative_humidity_2m, weatherData.daily.precipitation_sum[0]);
        generateIrrigationAdvice(c.temperature_2m, c.relative_humidity_2m, weatherData.daily.precipitation_sum[1]);

        // ===== API 3: 7-Day Forecast Chart =====
        render7DayChart(weatherData.daily);

        // ===== API 4: UV Index & Solar Data =====
        renderUVData(weatherData.daily, c);

        // ===== API 5: Weather Advisory =====
        generateWeatherAdvisory(weatherData);

        // ===== API 6: Air Quality =====
        fetchAirQuality(lat, lon);

    } catch (err) {
        console.error('Weather fetch error:', err);
        const weatherDetails = document.getElementById('weatherDetails');
        if (weatherDetails) weatherDetails.innerHTML = '<p style="color:var(--danger)">Failed to fetch weather data. Check your internet connection.</p>';
    }
}

// ===== Open-Meteo Air Quality API (Separate Endpoint) =====
async function fetchAirQuality(lat, lon) {
    try {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index&timezone=Asia/Kolkata`;
        const res = await fetch(url);
        const data = await res.json();
        const aq = data.current;

        const el = document.getElementById('airQualityData');
        if (!el) return;

        // Calculate AQI category from PM2.5
        let aqiLabel = '', aqiColor = '', aqiAdvice = '';
        const pm25 = aq.pm2_5;
        if (pm25 <= 12) { aqiLabel = 'Good 🟢'; aqiColor = 'var(--secondary)'; aqiAdvice = 'Air quality is excellent. Safe for all outdoor farming activities.'; }
        else if (pm25 <= 35) { aqiLabel = 'Moderate 🟡'; aqiColor = 'var(--yellow)'; aqiAdvice = 'Acceptable air quality. Sensitive crops may face minor stress.'; }
        else if (pm25 <= 55) { aqiLabel = 'Unhealthy for Sensitive 🟠'; aqiColor = '#ff8c00'; aqiAdvice = 'Reduce long outdoor exposure. Apply protective mulch to sensitive crops.'; }
        else if (pm25 <= 150) { aqiLabel = 'Unhealthy 🔴'; aqiColor = 'var(--danger)'; aqiAdvice = 'High pollution! Crops may suffer. Wash produce before selling. Limit spraying.'; }
        else { aqiLabel = 'Hazardous ☠️'; aqiColor = '#8b0000'; aqiAdvice = 'Extremely dangerous. Postpone outdoor activities and monitor crop damage.'; }

        el.innerHTML = `
            <div class="weather-row"><span class="weather-label">Air Quality</span><strong style="color:${aqiColor}">${aqiLabel}</strong></div>
            <div class="weather-row"><span class="weather-label">PM 2.5</span><strong>${pm25.toFixed(1)} µg/m³</strong></div>
            <div class="weather-row"><span class="weather-label">PM 10</span><strong>${aq.pm10.toFixed(1)} µg/m³</strong></div>
            <div class="weather-row"><span class="weather-label">Ozone (O₃)</span><strong>${aq.ozone.toFixed(1)} µg/m³</strong></div>
            <div class="weather-row"><span class="weather-label">NO₂</span><strong>${aq.nitrogen_dioxide.toFixed(1)} µg/m³</strong></div>
            <div class="weather-row"><span class="weather-label">SO₂</span><strong>${aq.sulphur_dioxide.toFixed(1)} µg/m³</strong></div>
            <div class="weather-row"><span class="weather-label">Dust</span><strong>${aq.dust.toFixed(1)} µg/m³</strong></div>
            <div style="margin-top:0.75rem;padding:0.75rem;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.85rem;color:var(--text-muted);">
                💡 <strong style="color:var(--text)">Advisory:</strong> ${aqiAdvice}
            </div>
        `;
    } catch (err) {
        console.error('Air quality fetch error:', err);
        const el = document.getElementById('airQualityData');
        if (el) el.innerHTML = '<p style="color:var(--danger)">Failed to load air quality data.</p>';
    }
}

// ===== 7-Day Forecast Chart =====
let forecastChartInstance = null;
function render7DayChart(daily) {
    const ctx = document.getElementById('forecastChart');
    if (!ctx) return;
    if (forecastChartInstance) forecastChartInstance.destroy();

    const labels = daily.time.map(d => {
        const date = new Date(d);
        return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
    });

    const gradientMax = ctx.getContext('2d').createLinearGradient(0, 0, 0, 240);
    gradientMax.addColorStop(0, 'rgba(255, 99, 71, 0.3)');
    gradientMax.addColorStop(1, 'rgba(255, 99, 71, 0)');

    const gradientMin = ctx.getContext('2d').createLinearGradient(0, 0, 0, 240);
    gradientMin.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
    gradientMin.addColorStop(1, 'rgba(0, 240, 255, 0)');

    forecastChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Max Temp (°C)',
                    data: daily.temperature_2m_max,
                    borderColor: '#ff6347',
                    backgroundColor: gradientMax,
                    borderWidth: 2, tension: 0.4, fill: true, pointRadius: 4,
                    pointBackgroundColor: '#ff6347'
                },
                {
                    label: 'Min Temp (°C)',
                    data: daily.temperature_2m_min,
                    borderColor: '#00f0ff',
                    backgroundColor: gradientMin,
                    borderWidth: 2, tension: 0.4, fill: true, pointRadius: 4,
                    pointBackgroundColor: '#00f0ff'
                },
                {
                    label: 'Rain (mm)',
                    data: daily.precipitation_sum,
                    borderColor: '#4ade80',
                    backgroundColor: 'rgba(74,222,128,0.1)',
                    borderWidth: 2, tension: 0.3, fill: true, pointRadius: 3,
                    pointBackgroundColor: '#4ade80', yAxisID: 'rain'
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, padding: 15, font: { size: 11 } } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, title: { display: true, text: 'Temperature (°C)', font: { size: 11 } } },
                rain: { position: 'right', grid: { display: false }, title: { display: true, text: 'Rainfall (mm)', font: { size: 11 } }, min: 0 }
            },
            animation: { duration: 1500 }
        }
    });
}

// ===== UV Index & Solar Data =====
function renderUVData(daily, current) {
    const el = document.getElementById('uvData');
    if (!el) return;
    const today = daily;
    const sunrise = today.sunrise?.[0] ? new Date(today.sunrise[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const sunset = today.sunset?.[0] ? new Date(today.sunset[0]).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    const uvMax = today.uv_index_max?.[0] || 0;
    const uvCurrent = current.uv_index || 0;

    let uvLabel = '', uvColor = '';
    if (uvCurrent <= 2) { uvLabel = 'Low ✅'; uvColor = 'var(--secondary)'; }
    else if (uvCurrent <= 5) { uvLabel = 'Moderate ⚠️'; uvColor = 'var(--yellow)'; }
    else if (uvCurrent <= 7) { uvLabel = 'High 🔶'; uvColor = '#ff8c00'; }
    else if (uvCurrent <= 10) { uvLabel = 'Very High 🔴'; uvColor = 'var(--danger)'; }
    else { uvLabel = 'Extreme ☠️'; uvColor = '#8b0000'; }

    el.innerHTML = `
        <div class="weather-row"><span class="weather-label">☀️ Current UV Index</span><strong style="color:${uvColor}">${uvCurrent.toFixed(1)} — ${uvLabel}</strong></div>
        <div class="weather-row"><span class="weather-label">📈 Max UV Today</span><strong>${uvMax.toFixed(1)}</strong></div>
        <div class="weather-row"><span class="weather-label">🌅 Sunrise</span><strong>${sunrise}</strong></div>
        <div class="weather-row"><span class="weather-label">🌇 Sunset</span><strong>${sunset}</strong></div>
        <div class="weather-row"><span class="weather-label">☀️ Daylight Hours</span><strong>${calculateDaylight(today.sunrise?.[0], today.sunset?.[0])}</strong></div>
    `;
}

function calculateDaylight(sunrise, sunset) {
    if (!sunrise || !sunset) return 'N/A';
    const diff = new Date(sunset) - new Date(sunrise);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${mins}m`;
}

// ===== Weather Advisory (AI-style, driven by live API data) =====
function generateWeatherAdvisory(weatherData) {
    const el = document.getElementById('weatherAdvisory');
    if (!el) return;
    const c = weatherData.current;
    const d = weatherData.daily;
    const advisories = [];

    // Temperature-based
    if (c.temperature_2m > 40) advisories.push({ level: 'bg-red', icon: 'ph-fire', title: '🔥 Extreme Heat Alert', desc: `Temperature at ${c.temperature_2m}°C! Apply heavy mulching, irrigate in early morning/late evening. Cover nurseries with shade nets.` });
    else if (c.temperature_2m > 35) advisories.push({ level: 'bg-yellow', icon: 'ph-sun', title: '☀️ Heat Advisory', desc: `Temperature is ${c.temperature_2m}°C. Increase irrigation frequency. Apply foliar spray in evening hours only.` });
    else if (c.temperature_2m < 10) advisories.push({ level: 'bg-blue', icon: 'ph-snowflake', title: '❄️ Cold Wave Alert', desc: `Temperature at ${c.temperature_2m}°C. Cover sensitive crops with plastic sheets. Light bonfires around orchards if frost expected.` });

    // Rain forecast
    const totalRain3Days = d.precipitation_sum.slice(0, 3).reduce((a, b) => a + b, 0);
    if (totalRain3Days > 30) advisories.push({ level: 'bg-blue', icon: 'ph-cloud-rain', title: '🌧️ Heavy Rain Warning', desc: `${totalRain3Days.toFixed(1)}mm rain forecast in next 3 days. Ensure field drainage. Postpone pesticide spraying. Harvest ready crops immediately.` });
    else if (totalRain3Days > 10) advisories.push({ level: 'bg-yellow', icon: 'ph-cloud-rain', title: '🌦️ Moderate Rain Expected', desc: `${totalRain3Days.toFixed(1)}mm expected in 3 days. Good for Kharif crops. Skip irrigation tomorrow to save water.` });

    // Wind
    const maxWind = d.wind_speed_10m_max?.[0] || 0;
    if (maxWind > 40) advisories.push({ level: 'bg-red', icon: 'ph-wind', title: '💨 High Wind Alert', desc: `Wind speed up to ${maxWind} km/h expected. Stake tall crops. Secure greenhouse covers and shade nets.` });

    // UV
    if (c.uv_index > 8) advisories.push({ level: 'bg-yellow', icon: 'ph-sun-dim', title: '☀️ High UV Advisory', desc: `UV Index is ${c.uv_index.toFixed(1)}. Workers should use sun protection. Apply sunburn prevention spray on fruit crops.` });

    if (advisories.length === 0) advisories.push({ level: 'bg-green', icon: 'ph-check-circle', title: '✅ Favorable Conditions', desc: 'Weather conditions are ideal for farming activities. Good time for sowing, transplanting, and field preparation.' });

    el.innerHTML = advisories.map(a => `<div class="pest-alert ${a.level}"><i class="ph ${a.icon}"></i><div><h4>${a.title}</h4><p>${a.desc}</p></div></div>`).join('');
}

// ===== LOCATION MANAGER (GPS, Manual, Persist) =====
let citySearchTimeout = null;

// Initialize location from localStorage or default
(function initLocation() {
    const saved = localStorage.getItem('yieldiq_location');
    if (saved) {
        try {
            currentWeatherCoords = JSON.parse(saved);
        } catch(e) {}
    }
    updateLocationUI();
})();

// Open/Close Panel
function openLocationPanel() {
    document.getElementById('locationPanel').classList.add('open');
}
function closeLocationPanel() {
    document.getElementById('locationPanel').classList.remove('open');
}

// Update all UI labels
function updateLocationUI() {
    const { lat, lon, name, isGps } = currentWeatherCoords;
    const coordsStr = `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`;
    
    // Topbar
    const tn = document.getElementById('topbarLocationName');
    if (tn) tn.textContent = name;
    const td = document.getElementById('locationDot');
    if (td) td.classList.toggle('active', !!isGps);
    
    // Panel
    const pn = document.getElementById('panelLocationName');
    if (pn) pn.textContent = name;
    const pc = document.getElementById('panelLocationCoords');
    if (pc) pc.textContent = coordsStr;
    const pi = document.getElementById('locStatusIcon');
    if (pi) pi.className = `loc-current-icon ${isGps ? 'gps-active' : ''}`;
    
    // Crop Health Bar
    const cn = document.getElementById('cropHealthCityName');
    if (cn) cn.textContent = name;
    const cc = document.getElementById('cropHealthCoords');
    if (cc) cc.textContent = coordsStr;
    const cb = document.getElementById('locSourceBadge');
    if (cb) {
        cb.textContent = isGps ? 'Live GPS' : 'Manual Entry';
        cb.className = `loc-bar-badge ${isGps ? 'gps' : ''}`;
    }
}

// Set Location & Fetch
function setLocation(lat, lon, name, isGps = false) {
    currentWeatherCoords = { lat, lon, name, isGps };
    localStorage.setItem('yieldiq_location', JSON.stringify(currentWeatherCoords));
    updateLocationUI();
    fetchWeatherData(); // Refresh data
    closeLocationPanel();
}

// GPS Detect
function detectMyLocation() {
    const btn = document.getElementById('gpsDetectBtn');
    const txt = document.getElementById('gpsDetectText');
    const status = document.getElementById('gpsStatus');
    const cropGpsBtn = document.getElementById('cropGpsBtn');
    
    if (!navigator.geolocation) {
        if (status) status.innerHTML = "GPS not supported by browser.";
        return;
    }

    if (btn) btn.disabled = true;
    if (cropGpsBtn) cropGpsBtn.disabled = true;
    if (txt) txt.textContent = "Locating...";
    if (status) status.innerHTML = "Requesting permission...";

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            if (status) status.innerHTML = "GPS found. Identifying city...";
            
            try {
                // Reverse geocode via BigDataCloud (Free, No API Key needed)
                const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
                const res = await fetch(revUrl);
                const data = await res.json();
                
                const city = data.city || data.locality || data.principalSubdivision || "Unknown City";
                const country = data.countryName || "";
                const fullName = `${city}${country ? ', ' + country : ''}`;
                
                setLocation(lat, lon, fullName, true);
                if (status) status.innerHTML = "Location updated!";
            } catch (err) {
                // Fallback if reverse geocode fails
                setLocation(lat, lon, 'GPS Location', true);
                if (status) status.innerHTML = "Location updated (City unknown).";
            }
            
            if (btn) btn.disabled = false;
            if (cropGpsBtn) cropGpsBtn.disabled = false;
            if (txt) txt.textContent = "Use My Current Location (GPS)";
        },
        (error) => {
            console.error(error);
            if (status) status.innerHTML = `<span style="color:var(--danger)">GPS Error: ${error.message}</span>`;
            if (btn) btn.disabled = false;
            if (cropGpsBtn) cropGpsBtn.disabled = false;
            if (txt) txt.textContent = "Use My Current Location (GPS)";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// Manual City Search (Crop Health Bar + Location Panel)
function debounceCitySearch() {
    clearTimeout(citySearchTimeout);
    citySearchTimeout = setTimeout(searchCity, 500);
}

async function searchCity() {
    // Check which input triggered it
    let query = '';
    const panelInput = document.getElementById('locCityInput');
    const dashInput = document.getElementById('citySearch');
    
    if (panelInput && panelInput.value.trim().length > 1) query = panelInput.value.trim();
    else if (dashInput && dashInput.value.trim().length > 1) query = dashInput.value.trim();
    
    if (query.length < 2) return;

    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
            const city = data.results[0];
            const name = `${city.name}, ${city.admin1 || city.country}`;
            setLocation(city.latitude, city.longitude, name, false);
            
            // clear inputs
            if (panelInput) panelInput.value = '';
            if (dashInput) dashInput.value = '';
        } else {
            alert(`City "${query}" not found.`);
        }
    } catch (err) {
        console.error('Geocoding error:', err);
    }
}

// Separate function for panel button
function manualCitySearch() {
    searchCity();
}

function quickSetCity(lat, lon, name) {
    setLocation(lat, lon, `${name}, India`, false);
}

function getWeatherDescription(code) {
    const descriptions = { 0: 'Clear Sky ☀️', 1: 'Mainly Clear 🌤️', 2: 'Partly Cloudy ⛅', 3: 'Overcast ☁️', 45: 'Foggy 🌫️', 48: 'Rime Fog', 51: 'Light Drizzle 🌧️', 53: 'Moderate Drizzle', 55: 'Dense Drizzle', 61: 'Slight Rain 🌧️', 63: 'Moderate Rain 🌧️', 65: 'Heavy Rain ⛈️', 71: 'Slight Snow ❄️', 73: 'Moderate Snow', 75: 'Heavy Snow', 80: 'Rain Showers', 81: 'Moderate Showers', 82: 'Heavy Showers ⛈️', 95: 'Thunderstorm ⛈️', 96: 'Thunderstorm with Hail' };
    return descriptions[code] || 'Unknown';
}

function generatePestAlerts(temp, humidity, rain) {
    const alerts = [];
    if (humidity > 70) alerts.push({ level: 'bg-red', icon: 'ph-warning', title: 'Fungal Risk: HIGH', desc: `Humidity at ${humidity}% — favorable conditions for late blight and powdery mildew. Apply preventive fungicide immediately.` });
    if (temp > 30) alerts.push({ level: 'bg-yellow', icon: 'ph-bug', title: 'Aphid Warning', desc: `Temperatures above 30°C may attract aphids and whiteflies. Monitor crops closely. Use neem-based sprays.` });
    if (rain > 5) alerts.push({ level: 'bg-blue', icon: 'ph-drop', title: 'Root Rot Risk', desc: `${rain}mm of rain detected. Ensure proper field drainage to avoid waterlogging and root rot.` });
    if (temp < 15) alerts.push({ level: 'bg-yellow', icon: 'ph-thermometer-cold', title: 'Frost Warning', desc: `Temperature dropping to ${temp}°C. Cover sensitive crops to protect against frost damage.` });
    if (alerts.length === 0) alerts.push({ level: 'bg-green', icon: 'ph-check-circle', title: 'All Clear', desc: 'No critical pest or disease threats detected based on current weather conditions.' });

    const el = document.getElementById('pestAlerts');
    if (el) el.innerHTML = alerts.map(a => `<div class="pest-alert ${a.level}"><i class="ph ${a.icon}"></i><div><h4>${a.title}</h4><p>${a.desc}</p></div></div>`).join('');
}

function generateIrrigationAdvice(temp, humidity, tomorrowRain) {
    const el = document.getElementById('irrigationAdvice');
    if (!el) return;
    let advice = '';
    if (tomorrowRain > 10) {
        advice = `<div class="pest-alert bg-blue"><i class="ph ph-cloud-rain"></i><div><h4>Skip Irrigation Tomorrow</h4><p>${tomorrowRain}mm of rain forecast. Save water and let the rain naturally irrigate your fields.</p></div></div>`;
    } else if (temp > 35 && humidity < 40) {
        advice = `<div class="pest-alert bg-red"><i class="ph ph-fire"></i><div><h4>Critical: Irrigate Now</h4><p>High temperature (${temp}°C) and low humidity (${humidity}%). Your crops are at risk of heat stress. Irrigate in the evening.</p></div></div>`;
    } else {
        advice = `<div class="pest-alert bg-green"><i class="ph ph-check-circle"></i><div><h4>Normal Irrigation Schedule</h4><p>Weather conditions are moderate. Follow your regular irrigation schedule. Apply drip irrigation for maximum efficiency.</p></div></div>`;
    }
    el.innerHTML = advice;
}

// ---- MARKET TABLE ----
let marketData = [];

async function populateMarketTable() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/markets');
        marketData = await res.json();
    } catch(err) { console.error('Fetch markets failed:', err); }

    const tbody = document.getElementById('marketTableBody');
    if (!tbody) return;
    tbody.innerHTML = marketData.map(d => {
        const changeClass = d.change >= 0 ? 'change-up' : 'change-down';
        const arrow = d.change >= 0 ? '▲' : '▼';
        const sparkHeights = Array.from({length: 7}, () => 6 + Math.random() * 18);
        const sparkHTML = sparkHeights.map(h => `<span style="height:${h}px"></span>`).join('');
        return `<tr>
            <td><strong>${d.crop}</strong></td>
            <td>${d.mandi}</td>
            <td><strong>₹${d.price.toLocaleString('en-IN')}</strong></td>
            <td class="${changeClass}">${arrow} ${Math.abs(d.change)}%</td>
            <td><div class="sparkline-bar">${sparkHTML}</div></td>
        </tr>`;
    }).join('');
}

// ---- AI PREDICTIONS (Weather-API Driven) ----
const stateCoords = {
    'Maharashtra': { lat: 19.08, lon: 72.88 },
    'Punjab': { lat: 31.15, lon: 75.34 },
    'Uttar Pradesh': { lat: 26.85, lon: 80.95 },
    'Madhya Pradesh': { lat: 23.26, lon: 77.41 },
    'Karnataka': { lat: 12.97, lon: 77.59 },
};

async function runPrediction() {
    const crop = document.getElementById('predCrop').value;
    const area = document.getElementById('predArea').value || 5;
    const state = document.getElementById('predState').value;
    const resultEl = document.getElementById('predictionResult');

    resultEl.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><p style="color:var(--text-muted)">AI is analyzing live data...<br><small>Processing via Gemini API</small></p></div>`;

    try {
        let weatherDataStr = lastWeatherData ? `Temp: ${lastWeatherData.current.temperature_2m}°C, Wind: ${lastWeatherData.current.wind_speed_10m}km/h` : 'Unknown';
        
        const res = await fetch('http://127.0.0.1:5000/api/ai/predict', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ crop, area, state, weather: weatherDataStr, lang: typeof currentLang !== 'undefined' ? currentLang : 'en' })
        });
        
        if(!res.ok) {
            const errBody = await res.json();
            throw new Error(errBody.error || "Server error");
        }
        
        const data = await res.json();

        resultEl.innerHTML = `
            <div class="ai-report">
                <h3><i class="ph ph-brain"></i> AI Analysis Report <span style="font-size:0.7rem;color:var(--text-muted);font-weight:400">powered by Gemini API</span></h3>
                <div class="report-grid">
                    <div class="report-item"><label>Crop</label><div class="val">${crop}</div></div>
                    <div class="report-item"><label>State</label><div class="val">${state}</div></div>
                    <div class="report-item"><label>Predicted Price</label><div class="val up">₹${data.predicted_price_qtl.toLocaleString('en-IN')}/qtl</div></div>
                    <div class="report-item"><label>Est. Yield</label><div class="val">${data.est_yield_qtl} qtl</div></div>
                    <div class="report-item"><label>Est. Revenue</label><div class="val up">₹${data.est_revenue.toLocaleString('en-IN')}</div></div>
                    <div class="report-item"><label>AI Confidence</label><div class="val text-cyan">${data.confidence_pct}%</div></div>
                    <div class="report-item"><label>Best Selling Time</label><div class="val text-cyan">${data.best_time}</div></div>
                </div>
                <div style="margin-bottom:1rem;padding:0.75rem;background:rgba(0,0,0,0.2);border-radius:8px;">
                    <span style="font-size:0.85rem;color:var(--text-muted);">Weather Risk: </span>
                    <strong style="color:${data.weather_risk_color}">${data.weather_risk_label}</strong>
                </div>
                <div class="report-advice">
                    <h4>💡 Gemini Recommendation</h4>
                    <p>${data.recommendation_html}</p>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Prediction error:', err);
        resultEl.innerHTML = `<div class="pred-placeholder"><i class="ph ph-warning"></i><p style="color:var(--danger)">AI Error: ${err.message}</p></div>`;
    }
}

// ---- BUYERS DIRECTORY ----
let buyersData = [];

async function populateBuyers() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/buyers');
        buyersData = await res.json();
    } catch(err) { console.error('Fetch buyers error:', err); }

    const grid = document.getElementById('buyersGrid');
    if (!grid) return;
    grid.innerHTML = buyersData.map((b, i) => `
        <div class="buyer-card glass" style="position:relative">
            <span style="position:absolute;top:8px;right:8px;background:rgba(255,180,0,0.15);color:#ffb400;font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.5px">⚠ DEMO BUYER</span>
            <div class="buyer-top">
                <div class="buyer-avatar"><i class="ph ${b.icon}"></i></div>
                <div><div class="buyer-name">${b.name}</div><div class="buyer-type">${b.type}</div></div>
            </div>
            <div class="buyer-details">
                <span><i class="ph ph-map-pin"></i> <strong>${b.location}</strong></span>
                <span><i class="ph ph-plant"></i> Buys: <strong>${b.crop}</strong></span>
                <span><i class="ph ph-star"></i> Rating: <strong>${b.rating} ★</strong></span>
            </div>
            <div class="buyer-actions">
                <button class="btn btn-primary btn-sm" onclick="switchView(document.querySelector('[data-view=negotiate-view]'),'negotiate-view')">Negotiate</button>
                <button class="btn btn-outline btn-sm">View Profile</button>
            </div>
        </div>
    `).join('');
}

// ---- NEGOTIATION BOARD (Connected to Offers + Listings) ----
async function loadNegotiationBoard() {
    const list = document.getElementById('negotiateList');
    if (!list) return;
    list.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-muted);"><div class="spinner" style="margin:0 auto 1rem;"></div>Loading negotiations...</div>';
    
    const user = getUser();
    try {
        // Load all listings for context
        const listingsRes = await fetch('http://127.0.0.1:5000/api/listings');
        const allListings = await listingsRes.json();
        
        // Load user's offers if logged in
        let userOffers = { as_buyer: [], as_seller: [] };
        if (user.email) {
            try {
                const offersRes = await fetch(`http://127.0.0.1:5000/api/offers/user/${user.email}`);
                userOffers = await offersRes.json();
            } catch(e) {}
        }
        
        const allOffers = [...(userOffers.as_buyer || []), ...(userOffers.as_seller || [])];
        
        // Build negotiation cards from listings (available to trade) + active offers
        let html = '';
        
        // Section 1: Active Negotiations (from offers)
        if (allOffers.length > 0) {
            html += '<h3 style="margin-bottom:1rem;color:var(--primary);"><i class="ph ph-arrows-counter-clockwise"></i> Active Negotiations</h3>';
            html += allOffers.map(o => {
                const isSeller = o.seller_email === user.email;
                const statusColors = { pending: 'var(--yellow)', accepted: 'var(--secondary)', rejected: 'var(--danger)', countered: '#ffb400' };
                const statusIcons = { pending: 'ph-hourglass', accepted: 'ph-check-circle', rejected: 'ph-x-circle', countered: 'ph-arrows-counter-clockwise' };
                
                let actionHTML = '';
                if (o.status === 'pending' && isSeller) {
                    actionHTML = `
                        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
                            <button class="btn btn-primary btn-sm" onclick="handleOffer('${o._id}','accept')"><i class="ph ph-check"></i> Accept ₹${o.offer_price.toLocaleString('en-IN')}</button>
                            <button class="btn btn-outline btn-sm" onclick="handleCounterOffer('${o._id}')"><i class="ph ph-arrows-counter-clockwise"></i> Counter</button>
                            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="handleOffer('${o._id}','reject')"><i class="ph ph-x"></i> Reject</button>
                            <button class="btn btn-outline btn-sm" onclick="openChatPanel('${o.listing_id}','${isSeller ? o.buyer_email : o.seller_email}','${isSeller ? o.buyer_name : o.seller_name}')"><i class="ph ph-chat-dots"></i> Chat</button>
                        </div>`;
                } else if (o.status === 'countered' && !isSeller) {
                    actionHTML = `
                        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;align-items:center;">
                            <span style="color:#ffb400;font-weight:600;">Counter: ₹${(o.counter_price || 0).toLocaleString('en-IN')}/qtl</span>
                            <button class="btn btn-primary btn-sm" onclick="handleOffer('${o._id}','accept')"><i class="ph ph-check"></i> Accept Counter</button>
                            <button class="btn btn-outline btn-sm" onclick="openChatPanel('${o.listing_id}','${o.seller_email}','${o.seller_name}')"><i class="ph ph-chat-dots"></i> Chat</button>
                        </div>`;
                } else {
                    actionHTML = `
                        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;align-items:center;flex-wrap:wrap;">
                            <div style="padding:6px 12px;background:rgba(255,255,255,0.05);border-radius:8px;color:${statusColors[o.status] || 'var(--text-muted)'};font-weight:600;text-transform:uppercase;font-size:0.75rem;"><i class="ph ${statusIcons[o.status] || 'ph-circle'}"></i> ${o.status}${o.counter_price ? ' — ₹' + o.counter_price.toLocaleString('en-IN') + '/qtl' : ''}</div>
                            <button class="btn btn-outline btn-sm" onclick="openChatPanel('${o.listing_id}','${isSeller ? o.buyer_email : o.seller_email}','${isSeller ? o.buyer_name : o.seller_name}')"><i class="ph ph-chat-dots"></i> Chat</button>
                        </div>`;
                }
                
                return `<div class="negotiate-card glass" style="margin-bottom:1rem;">
                    <div class="neg-info">
                        <h4>${o.crop} — ${isSeller ? 'from ' + o.buyer_name : 'to ' + o.seller_name}</h4>
                        <p style="color:var(--text-muted);font-size:0.85rem;">You are the ${isSeller ? 'Seller' : 'Buyer'} · ${o.quantity || ''} Qtl</p>
                    </div>
                    <div class="neg-prices">
                        <div class="neg-price-box"><label>${isSeller ? 'Their Offer' : 'Your Offer'}</label><div class="neg-val text-cyan">₹${o.offer_price.toLocaleString('en-IN')}</div></div>
                        <div class="neg-price-box"><label>Asking Price</label><div class="neg-val">₹${o.asking_price.toLocaleString('en-IN')}</div></div>
                        ${o.counter_price ? `<div class="neg-price-box"><label>Counter</label><div class="neg-val text-green">₹${o.counter_price.toLocaleString('en-IN')}</div></div>` : ''}
                    </div>
                    ${actionHTML}
                </div>`;
            }).join('');
        }
        
        // Section 2: Available crops to negotiate on
        const otherListings = allListings.filter(l => l.seller_email !== user.email);
        if (otherListings.length > 0) {
            html += '<h3 style="margin:1.5rem 0 1rem;color:var(--secondary);"><i class="ph ph-storefront"></i> Available for Negotiation</h3>';
            html += '<div class="buyers-grid">' + otherListings.map(l => `
                <div class="buyer-card glass">
                    <div class="buyer-top">
                        <div class="buyer-avatar"><i class="ph ph-plant"></i></div>
                        <div>
                            <div class="buyer-name">${l.crop}</div>
                            <div class="buyer-type">₹${l.price.toLocaleString('en-IN')}/qtl · ${l.quantity} Qtl</div>
                        </div>
                    </div>
                    <div class="buyer-details">
                        <span><i class="ph ph-user"></i> <strong>${l.seller_name}</strong></span>
                        <span><i class="ph ph-map-pin"></i> <strong>${l.location}</strong></span>
                    </div>
                    <div class="buyer-actions">
                        <button class="btn btn-primary btn-sm" onclick="openOfferModal('${l._id}', '${l.crop}', ${l.price}, ${l.quantity}, '${l.seller_email}', '${l.seller_name}')"><i class="ph ph-currency-inr"></i> Make Offer</button>
                        <button class="btn btn-outline btn-sm" onclick="openChatPanel('${l._id}', '${l.seller_email}', '${l.seller_name}')"><i class="ph ph-chat-dots"></i> Chat</button>
                    </div>
                </div>
            `).join('') + '</div>';
        }
        
        if (!html) {
            html = '<div class="glass" style="padding:3rem;text-align:center;"><i class="ph ph-handshake" style="font-size:3rem;color:var(--text-muted);"></i><h3 style="margin-top:1rem;">No Negotiations Yet</h3><p style="color:var(--text-muted);">Go to the Marketplace to browse crops and start negotiating!</p><button class="btn btn-primary" style="margin-top:1rem;" onclick="switchView(document.querySelector(\x27[data-view=marketplace-view]\x27),\x27marketplace-view\x27)"><i class="ph ph-storefront"></i> Go to Marketplace</button></div>';
        }
        
        list.innerHTML = html;
    } catch(e) {
        console.error('Negotiation board error:', e);
        list.innerHTML = '<p style="color:var(--danger);text-align:center;padding:2rem;">Could not load negotiations. Make sure the backend is running.</p>';
    }
}

// Legacy functions kept for backward compatibility
function acceptOffer(id) {
    handleOffer(id, 'accept');
}

function submitCounter(id) {
    handleCounterOffer(id);
}

// ---- CHATBOT (Live API-Powered) ----
let chatOpen = false;
function toggleChatbot() {
    chatOpen = !chatOpen;
    document.getElementById('chatbot-window').classList.toggle('open', chatOpen);
}

const chatResponses = {
    'price': 'Current market prices:\n• Wheat: ₹2,840/qtl (+2.4%)\n• Rice: ₹3,120/qtl (+1.1%)\n• Soybean: ₹4,510/qtl (+3.5%)\n• Cotton: ₹6,200/qtl (-1.2%)\n\nFor detailed prices, check the Markets section.',
    'wheat': 'Wheat is currently trading at ₹2,840/qtl in Delhi Azadpur mandi. Prices are expected to rise 5-8% in the next 2 weeks due to export demand. Our AI recommends selling within the next week for maximum profit.',
    'rice': 'Rice (Basmati) is at ₹3,120/qtl in Karnal. Demand is strong due to festival season. Hold for another week if possible for a better price.',
    'sell': 'Based on current market trends, the AI recommends:\n1. SELL Corn now (peak demand in North)\n2. HOLD Soybeans (price rising)\n3. NEGOTIATE Rice with AgriCorp (5% above market)\n\nGo to AI Predictions for a detailed analysis.',
    'scheme': 'Key Government Schemes for Farmers:\n\n🌾 PM-KISAN: ₹6,000/year direct income support\n🏦 KCC: Kisan Credit Card at 4% interest\n📱 eNAM: Online trading on National Agriculture Market\n🛡️ PMFBY: Crop insurance at 1.5-2% premium\n💧 PMKSY: Micro-irrigation subsidies\n\nVisit pmkisan.gov.in for more details.',
    'loan': 'Farmer Loan Options:\n\n🏦 KCC Loan: Up to ₹3 lakh at 4% (with prompt repayment)\n🏛️ NABARD: Long-term loans for equipment\n💳 SHG Loans: Group lending at subsidized rates\n\nTip: Apply through your nearest cooperative bank or use the PM-KISAN portal.',
    'pest': 'For pest management, check the Crop Health section for real-time weather-based alerts. General tips:\n\n🌿 Use neem-based organic pesticides\n🐛 Introduce natural predators like ladybugs\n🔬 Get soil tested at your local Krishi Vigyan Kendra\n💧 Avoid overwatering — it attracts fungal diseases.',
    'hello': 'Namaste! 🙏 How can I help you today? You can ask me about:\n• Crop prices\n• Live weather (API-powered!)\n• Government schemes\n• Selling recommendations\n• Loan options\n• Air quality',
    'namaste': 'Namaste! 🙏 How can I help you today? Ask me about crop prices, weather alerts, government schemes, or anything related to farming!',
    'help': 'I can help you with:\n\n📊 Market prices — type "price" or a crop name\n🌤️ Live weather — type "weather" (API-powered!)\n💡 Selling advice — type "sell"\n🏛️ Government schemes — type "scheme"\n🏦 Loan info — type "loan"\n🐛 Pest control — type "pest"\n🌬️ Air quality — type "air"\n\nJust type your question!',
};

// Live weather response (pulls from API)
function getLiveWeatherResponse() {
    if (!lastWeatherData) return 'Weather data is loading... Please visit the Crop Health section first, then ask me again!';
    const c = lastWeatherData.current;
    const d = lastWeatherData.daily;
    return `🌤️ **Live Weather for ${currentWeatherCoords.name}** (via Open-Meteo API)\n\n🌡️ Temperature: ${c.temperature_2m}°C (Feels like ${c.apparent_temperature}°C)\n💧 Humidity: ${c.relative_humidity_2m}%\n💨 Wind: ${c.wind_speed_10m} km/h\n☀️ Condition: ${getWeatherDescription(c.weather_code)}\n🌧️ Precipitation: ${c.precipitation}mm\n☀️ UV Index: ${c.uv_index}\n\n📅 Tomorrow: ${d.temperature_2m_max[1]}°C / ${d.temperature_2m_min[1]}°C, ${d.precipitation_sum[1]}mm rain\n\nThis is LIVE data from the Open-Meteo API! 🔴`;
}

async function sendChat(e) {
    e.preventDefault();
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return false;

    const container = document.getElementById('chatMessages');

    // User message
    container.innerHTML += `<div class="chat-msg user"><p>${msg}</p></div>`;
    input.value = '';
    
    // Show AI typing indicator
    const typingId = 'typing-' + Date.now();
    container.innerHTML += `<div class="chat-msg bot" id="${typingId}"><p>AI is thinking...</p></div>`;
    container.scrollTop = container.scrollHeight;

    try {
        const res = await fetch('http://127.0.0.1:5000/api/ai/chat', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: msg, weather: lastWeatherData ? lastWeatherData.current : null, lang: typeof currentLang !== 'undefined' ? currentLang : 'en' })
        });
        const data = await res.json();
        document.getElementById(typingId).remove();
        container.innerHTML += `<div class="chat-msg bot"><p>${data.response.replace(/\n/g, '<br>')}</p></div>`;
        container.scrollTop = container.scrollHeight;
    } catch(err) {
        document.getElementById(typingId).remove();
        container.innerHTML += `<div class="chat-msg bot"><p>❌ Failed to connect to AI server.</p></div>`;
    }
    
    return false;
}

// Live Air Quality for Chatbot
async function fetchAirQualityForChat(container) {
    try {
        container.innerHTML += `<div class="chat-msg bot"><p>🔄 Fetching live air quality data from Open-Meteo API...</p></div>`;
        container.scrollTop = container.scrollHeight;

        const { lat, lon } = currentWeatherCoords;
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5,ozone,nitrogen_dioxide&timezone=Asia/Kolkata`;
        const res = await fetch(url);
        const data = await res.json();
        const aq = data.current;

        let aqiLabel = '';
        if (aq.pm2_5 <= 12) aqiLabel = 'Good 🟢';
        else if (aq.pm2_5 <= 35) aqiLabel = 'Moderate 🟡';
        else if (aq.pm2_5 <= 55) aqiLabel = 'Unhealthy for Sensitive 🟠';
        else if (aq.pm2_5 <= 150) aqiLabel = 'Unhealthy 🔴';
        else aqiLabel = 'Hazardous ☠️';

        const response = `🌬️ **Live Air Quality — ${currentWeatherCoords.name}** (Open-Meteo API)\n\nAir Quality: ${aqiLabel}\nPM 2.5: ${aq.pm2_5.toFixed(1)} µg/m³\nPM 10: ${aq.pm10.toFixed(1)} µg/m³\nOzone: ${aq.ozone.toFixed(1)} µg/m³\nNO₂: ${aq.nitrogen_dioxide.toFixed(1)} µg/m³\n\nThis is LIVE data from the API! 🔴`;
        container.innerHTML += `<div class="chat-msg bot"><p>${response.replace(/\n/g, '<br>')}</p></div>`;
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        container.innerHTML += `<div class="chat-msg bot"><p>Sorry, I couldn't fetch air quality data right now. Try again later. 🙏</p></div>`;
        container.scrollTop = container.scrollHeight;
    }
}

// ---- NATURE PARTICLE ANIMATION (Leaves & Fireflies) ----
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const PARTICLE_COUNT = 50;

    class Leaf {
        constructor() {
            this.reset();
            this.y = Math.random() * canvas.height; // Start at random y for first frame
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = -20;
            this.size = Math.random() * 6 + 2;
            this.speedY = Math.random() * 0.8 + 0.3;
            this.speedX = (Math.random() - 0.5) * 0.6;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.02;
            this.opacity = Math.random() * 0.4 + 0.1;
            this.wobble = Math.random() * 2;
            this.wobbleSpeed = Math.random() * 0.02 + 0.01;
            // Nature colors: greens, golds, whites
            const colors = [
                [74, 222, 128],   // green-light
                [34, 197, 94],    // green-bright
                [187, 247, 208],  // green-pale
                [251, 191, 36],   // gold
                [255, 255, 255],  // white
                [134, 239, 172],  // green-soft
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.isFirefly = Math.random() > 0.7;
        }
        update() {
            this.wobble += this.wobbleSpeed;
            this.x += this.speedX + Math.sin(this.wobble) * 0.5;
            this.y += this.speedY;
            this.rotation += this.rotationSpeed;

            if (this.y > canvas.height + 20) this.reset();
            if (this.x < -20) this.x = canvas.width + 20;
            if (this.x > canvas.width + 20) this.x = -20;
        }
        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.globalAlpha = this.opacity;

            if (this.isFirefly) {
                // Glowing dot
                const glowSize = this.size * 3;
                const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
                gradient.addColorStop(0, `rgba(${this.color.join(',')}, 0.8)`);
                gradient.addColorStop(0.5, `rgba(${this.color.join(',')}, 0.2)`);
                gradient.addColorStop(1, `rgba(${this.color.join(',')}, 0)`);
                ctx.beginPath();
                ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${this.color.join(',')}, 1)`;
                ctx.fill();
            } else {
                // Leaf shape
                ctx.beginPath();
                ctx.moveTo(0, -this.size);
                ctx.bezierCurveTo(this.size, -this.size * 0.5, this.size, this.size * 0.5, 0, this.size);
                ctx.bezierCurveTo(-this.size, this.size * 0.5, -this.size, -this.size * 0.5, 0, -this.size);
                ctx.fillStyle = `rgba(${this.color.join(',')}, ${this.opacity})`;
                ctx.fill();

                // Leaf vein
                ctx.beginPath();
                ctx.moveTo(0, -this.size * 0.8);
                ctx.lineTo(0, this.size * 0.8);
                ctx.strokeStyle = `rgba(${this.color.join(',')}, ${this.opacity * 0.5})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }

            ctx.restore();
        }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push(new Leaf());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

// ---- SCROLL REVEAL ----
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                const counters = entry.target.querySelectorAll('.counter');
                counters.forEach(counter => animateCounter(counter));
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// ---- COUNTER ANIMATION ----
function animateCounter(el) {
    if (el.dataset.animated) return;
    el.dataset.animated = 'true';
    const target = parseInt(el.dataset.target);
    const duration = 2000;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current.toLocaleString('en-IN') + '+';
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            el.textContent = target.toLocaleString('en-IN') + '+';
        }
    }
    requestAnimationFrame(updateCounter);
}

// ============================================================
// MARKETPLACE — Sell Crop, Browse, Make Offers, Chat
// ============================================================

function getUser() {
    try { return JSON.parse(localStorage.getItem('yieldiq_user')) || {}; } catch { return {}; }
}

// ---- SELL CROP: Create Listing ----
async function createListing() {
    const user = getUser();
    const statusEl = document.getElementById('sellStatus');
    const crop = document.getElementById('sellCrop').value;
    const qty = parseFloat(document.getElementById('sellQty').value);
    const price = parseFloat(document.getElementById('sellPrice').value);
    const location = document.getElementById('sellLocation').value;
    const harvestDate = document.getElementById('sellHarvestDate').value;
    const desc = document.getElementById('sellDesc').value;

    if (!crop || !qty || !price || !location) {
        statusEl.innerHTML = '<span style="color:var(--danger)">❌ Please fill all required fields.</span>';
        return;
    }

    let imageBase64 = '';
    const fileInput = document.getElementById('sellImage');
    if (fileInput.files.length > 0) {
        imageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(fileInput.files[0]);
        });
    }

    statusEl.innerHTML = '<span style="color:var(--primary)">⏳ Listing your crop...</span>';

    try {
        const res = await fetch('http://127.0.0.1:5000/api/listings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                seller_id: user.id || '',
                seller_name: user.name || 'Farmer',
                seller_email: user.email || '',
                seller_phone: user.phone || '',
                crop, quantity: qty, price, location,
                harvest_date: harvestDate,
                description: desc,
                image: imageBase64
            })
        });
        const data = await res.json();
        if (data.success) {
            statusEl.innerHTML = '<span style="color:var(--secondary)">✅ Crop listed successfully!</span>';
            document.getElementById('sellQty').value = '';
            document.getElementById('sellPrice').value = '';
            document.getElementById('sellLocation').value = '';
            document.getElementById('sellDesc').value = '';
            document.getElementById('sellImage').value = '';
            document.getElementById('sellImagePreview').innerHTML = '';
            loadMyListings();
        } else {
            statusEl.innerHTML = '<span style="color:var(--danger)">❌ Failed to list crop.</span>';
        }
    } catch (e) {
        statusEl.innerHTML = '<span style="color:var(--danger)">❌ Server error.</span>';
    }
}

// Image preview on file select
document.addEventListener('change', function(e) {
    if (e.target.id === 'sellImage' && e.target.files.length > 0) {
        const reader = new FileReader();
        reader.onload = () => {
            document.getElementById('sellImagePreview').innerHTML = `<img src="${reader.result}" style="max-width:100%;max-height:150px;border-radius:10px;margin-top:8px;">`;
        };
        reader.readAsDataURL(e.target.files[0]);
    }
});

// ---- MY LISTINGS ----
async function loadMyListings() {
    const user = getUser();
    const grid = document.getElementById('myListingsGrid');
    if (!grid) return;
    try {
        const res = await fetch('http://127.0.0.1:5000/api/listings');
        const all = await res.json();
        const mine = all.filter(l => l.seller_email === user.email);
        if (mine.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;">You have no active listings yet.<br>Use the form to list your first crop!</p>';
            return;
        }
        grid.innerHTML = mine.map(l => `
            <div class="negotiate-card glass" style="margin-bottom:1rem;position:relative;">
                ${l.image ? `<img src="${l.image}" style="width:100%;max-height:120px;object-fit:cover;border-radius:10px;margin-bottom:8px;">` : ''}
                <h4>${l.crop} — ₹${l.price.toLocaleString('en-IN')}/qtl</h4>
                <p style="color:var(--text-muted);font-size:0.85rem;">${l.quantity} Quintals · ${l.location} · ${l.harvest_date || 'No date'}</p>
                <button class="btn btn-outline btn-sm" style="margin-top:8px;color:var(--danger);border-color:var(--danger);" onclick="deleteListing('${l._id}')"><i class="ph ph-trash"></i> Remove</button>
            </div>
        `).join('');
    } catch(e) {
        grid.innerHTML = '<p style="color:var(--danger);">Could not load listings.</p>';
    }
}

async function deleteListing(id) {
    if (!confirm('Are you sure you want to remove this listing?')) return;
    try {
        await fetch(`http://127.0.0.1:5000/api/listings/${id}`, { method: 'DELETE' });
        loadMyListings();
    } catch(e) { console.error(e); }
}

// ---- MARKETPLACE: Browse All Listings ----
async function loadMarketplace() {
    const user = getUser();
    const grid = document.getElementById('marketplaceGrid');
    if (!grid) return;
    try {
        const res = await fetch('http://127.0.0.1:5000/api/listings');
        const listings = await res.json();
        if (listings.length === 0) {
            grid.innerHTML = '<div class="glass" style="padding:3rem;text-align:center;grid-column:1/-1;"><i class="ph ph-storefront" style="font-size:3rem;color:var(--text-muted);"></i><h3 style="margin-top:1rem;">No listings yet</h3><p style="color:var(--text-muted);">Be the first to list a crop! Go to Sell Crop.</p></div>';
            return;
        }
        grid.innerHTML = listings.map(l => {
            const isOwn = l.seller_email === user.email;
            return `
            <div class="buyer-card glass" style="position:relative;">
                ${l.image ? `<img src="${l.image}" style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:10px;">` : `<div style="width:100%;height:140px;background:rgba(0,0,0,0.2);border-radius:10px;margin-bottom:10px;display:flex;align-items:center;justify-content:center;"><i class="ph ph-plant" style="font-size:3rem;color:var(--text-muted);"></i></div>`}
                <div class="buyer-top">
                    <div class="buyer-avatar"><i class="ph ph-plant"></i></div>
                    <div>
                        <div class="buyer-name">${l.crop}</div>
                        <div class="buyer-type">₹${l.price.toLocaleString('en-IN')}/qtl · ${l.quantity} Qtl</div>
                    </div>
                </div>
                <div class="buyer-details">
                    <span><i class="ph ph-user"></i> <strong>${l.seller_name}</strong></span>
                    <span><i class="ph ph-map-pin"></i> <strong>${l.location}</strong></span>
                    <span><i class="ph ph-calendar"></i> Harvest: <strong>${l.harvest_date || 'N/A'}</strong></span>
                    ${l.description ? `<span style="color:var(--text-muted);font-size:0.8rem;">${l.description.substring(0, 80)}</span>` : ''}
                </div>
                <div class="buyer-actions">
                    ${isOwn ? '<span style="color:var(--text-muted);font-size:0.8rem;">Your listing</span>' : `
                        <button class="btn btn-primary btn-sm" onclick="openOfferModal('${l._id}', '${l.crop}', ${l.price}, ${l.quantity}, '${l.seller_email}', '${l.seller_name}')"><i class="ph ph-currency-inr"></i> Make Offer</button>
                        <button class="btn btn-outline btn-sm" onclick="openChatPanel('${l._id}', '${l.seller_email}', '${l.seller_name}')"><i class="ph ph-chat-dots"></i> Chat</button>
                    `}
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        grid.innerHTML = '<p style="color:var(--danger);">Could not load marketplace.</p>';
    }
}

// ---- MAKE OFFER ----
function openOfferModal(listingId, crop, askingPrice, qty, sellerEmail, sellerName) {
    const offerPrice = prompt(`Make an offer for ${crop} (Asking: ₹${askingPrice}/qtl, ${qty} Qtl).\n\nEnter your offer price (₹/qtl):`);
    if (!offerPrice || isNaN(offerPrice)) return;
    submitOffer(listingId, crop, parseFloat(offerPrice), qty, askingPrice, sellerEmail, sellerName);
}

async function submitOffer(listingId, crop, offerPrice, qty, askingPrice, sellerEmail, sellerName) {
    const user = getUser();
    try {
        const res = await fetch('http://127.0.0.1:5000/api/offers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listing_id: listingId,
                crop,
                buyer_id: user.id || '',
                buyer_name: user.name || 'Buyer',
                buyer_email: user.email || '',
                seller_id: '',
                seller_name: sellerName,
                seller_email: sellerEmail,
                offer_price: offerPrice,
                quantity: qty,
                asking_price: askingPrice
            })
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ Offer sent successfully! The seller will see it in their Deals.');
        }
    } catch (e) {
        alert('❌ Error sending offer.');
    }
}

// ---- MY DEALS ----
async function loadMyDeals() {
    const user = getUser();
    if (!user.email) return;
    try {
        const res = await fetch(`http://127.0.0.1:5000/api/offers/user/${user.email}`);
        const data = await res.json();
        renderIncomingOffers(data.as_seller || []);
        renderOutgoingOffers(data.as_buyer || []);
    } catch(e) { console.error(e); }
}

function renderIncomingOffers(offers) {
    const el = document.getElementById('incomingOffers');
    if (!el) return;
    if (offers.length === 0) {
        el.innerHTML = '<p style="color:var(--text-muted);">No incoming offers yet.</p>';
        return;
    }
    el.innerHTML = offers.map(o => {
        let actions = '';
        if (o.status === 'pending') {
            actions = `
                <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
                    <button class="btn btn-primary btn-sm" onclick="handleOffer('${o._id}','accept')"><i class="ph ph-check"></i> Accept</button>
                    <button class="btn btn-outline btn-sm" onclick="handleCounterOffer('${o._id}')"><i class="ph ph-arrows-counter-clockwise"></i> Counter</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);" onclick="handleOffer('${o._id}','reject')"><i class="ph ph-x"></i> Reject</button>
                </div>`;
        } else {
            const colors = { accepted: 'var(--secondary)', rejected: 'var(--danger)', countered: '#ffb400' };
            actions = `<div style="margin-top:0.5rem;padding:6px 12px;background:rgba(255,255,255,0.05);border-radius:8px;color:${colors[o.status] || 'var(--text-muted)'};font-weight:600;text-transform:uppercase;font-size:0.75rem;">${o.status}${o.counter_price ? ' — ₹' + o.counter_price.toLocaleString('en-IN') + '/qtl' : ''}</div>`;
        }
        return `
        <div class="negotiate-card glass" style="margin-bottom:1rem;">
            <div class="neg-info"><h4>${o.crop} — from ${o.buyer_name}</h4></div>
            <div class="neg-prices">
                <div class="neg-price-box"><label>Their Offer</label><div class="neg-val text-cyan">₹${o.offer_price.toLocaleString('en-IN')}</div></div>
                <div class="neg-price-box"><label>Your Ask</label><div class="neg-val">₹${o.asking_price.toLocaleString('en-IN')}</div></div>
            </div>
            ${actions}
        </div>`;
    }).join('');
}

function renderOutgoingOffers(offers) {
    const el = document.getElementById('outgoingOffers');
    if (!el) return;
    if (offers.length === 0) {
        el.innerHTML = '<p style="color:var(--text-muted);">You have not made any offers yet. Browse the Marketplace!</p>';
        return;
    }
    el.innerHTML = offers.map(o => {
        const colors = { pending: 'var(--primary)', accepted: 'var(--secondary)', rejected: 'var(--danger)', countered: '#ffb400' };
        return `
        <div class="negotiate-card glass" style="margin-bottom:1rem;">
            <div class="neg-info"><h4>${o.crop} — to ${o.seller_name}</h4></div>
            <div class="neg-prices">
                <div class="neg-price-box"><label>Your Offer</label><div class="neg-val text-cyan">₹${o.offer_price.toLocaleString('en-IN')}</div></div>
                <div class="neg-price-box"><label>Asking</label><div class="neg-val">₹${o.asking_price.toLocaleString('en-IN')}</div></div>
                ${o.counter_price ? `<div class="neg-price-box"><label>Counter</label><div class="neg-val text-green">₹${o.counter_price.toLocaleString('en-IN')}</div></div>` : ''}
            </div>
            <div style="margin-top:0.5rem;padding:6px 12px;background:rgba(255,255,255,0.05);border-radius:8px;color:${colors[o.status] || 'var(--text-muted)'};font-weight:600;text-transform:uppercase;font-size:0.75rem;">${o.status}</div>
        </div>`;
    }).join('');
}

async function handleOffer(offerId, action) {
    try {
        await fetch(`http://127.0.0.1:5000/api/offers/${offerId}/${action}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{}' });
        loadMyDeals();
    } catch(e) { console.error(e); }
}

function handleCounterOffer(offerId) {
    const counterPrice = prompt('Enter your counter price (₹/qtl):');
    if (!counterPrice || isNaN(counterPrice)) return;
    fetch(`http://127.0.0.1:5000/api/offers/${offerId}/counter`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ counter_price: parseFloat(counterPrice) })
    }).then(() => loadMyDeals()).catch(console.error);
}

// ---- CHAT PANEL ----
let currentChatListing = '';
let currentChatReceiver = '';
let chatRefreshInterval = null;

function openChatPanel(listingId, receiverEmail, receiverName) {
    currentChatListing = listingId;
    currentChatReceiver = receiverEmail;
    document.getElementById('chatPanelTitle').textContent = `Chat with ${receiverName}`;
    
    // Fix display and animation
    const panel = document.getElementById('chatPanel');
    panel.style.display = 'block';
    setTimeout(() => panel.classList.add('open'), 10);
    
    loadChatMessages();
    if (chatRefreshInterval) clearInterval(chatRefreshInterval);
    chatRefreshInterval = setInterval(loadChatMessages, 5000);
}

function closeChatPanel() {
    const panel = document.getElementById('chatPanel');
    panel.classList.remove('open');
    setTimeout(() => { panel.style.display = 'none'; }, 300);
    
    if (chatRefreshInterval) clearInterval(chatRefreshInterval);
}

async function loadChatMessages() {
    const user = getUser();
    const container = document.getElementById('chatMessages2');
    if (!container) return;
    try {
        const res = await fetch(`http://127.0.0.1:5000/api/chat/${currentChatListing}/${user.email}/${currentChatReceiver}`);
        const messages = await res.json();
        if (messages.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:2rem;">No messages yet. Say hello!</p>';
            return;
        }
        container.innerHTML = messages.map(m => {
            const isMe = m.sender_email === user.email;
            return `<div style="align-self:${isMe ? 'flex-end' : 'flex-start'};background:${isMe ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.05)'};padding:8px 14px;border-radius:12px;max-width:80%;font-size:0.9rem;">
                <strong style="font-size:0.7rem;color:var(--text-muted);">${m.sender_name}</strong><br>
                ${m.text}
            </div>`;
        }).join('');
        container.scrollTop = container.scrollHeight;
    } catch(e) { console.error(e); }
}

function sendDealChat(e) {
    e.preventDefault();
    const user = getUser();
    const input = document.getElementById('chatDealInput');
    const text = input.value.trim();
    if (!text) return false;

    fetch('http://127.0.0.1:5000/api/chat/send', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
            listing_id: currentChatListing,
            sender_email: user.email,
            sender_name: user.name || 'User',
            receiver_email: currentChatReceiver,
            text
        })
    }).then(() => {
        input.value = '';
        loadChatMessages();
    }).catch(console.error);
    return false;
}

// ---- TRANSLATION ENGINE ----
let currentLang = localStorage.getItem('preferred_lang') || 'en';
const originalTexts = new Map();

function getTextNodes(el) {
    const nodes = [];
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    let n;
    while(n = walk.nextNode()) {
        const parent = n.parentNode;
        if(parent && 
           parent.nodeName !== 'SCRIPT' && 
           parent.nodeName !== 'STYLE' && 
           parent.nodeName !== 'OPTION' && 
           n.nodeValue.trim() !== '') {
            nodes.push(n);
        }
    }
    return nodes;
}

let translationCache = {};
try {
    translationCache = JSON.parse(localStorage.getItem('yieldiq_trans_cache')) || {};
} catch(e) {}

async function changeLanguage(lang) {
    localStorage.setItem('preferred_lang', lang);
    currentLang = lang;
    
    const sl = document.getElementById('langSelectLanding');
    const sd = document.getElementById('langSelectDash');
    if (sl && sl.value !== lang) sl.value = lang;
    if (sd && sd.value !== lang) sd.value = lang;
    
    if (lang === 'en') {
        originalTexts.forEach((origText, node) => {
            if (node.nodeValue !== undefined) node.nodeValue = origText;
            if (node.placeholder !== undefined) node.placeholder = origText;
        });
        return;
    }
    
    if (!translationCache[lang]) translationCache[lang] = {};
    const cache = translationCache[lang];
    
    const nodesToTranslate = [];
    const textsToTranslate = [];
    
    getTextNodes(document.body).forEach(node => {
        if (!originalTexts.has(node)) originalTexts.set(node, node.nodeValue);
        const orig = originalTexts.get(node);
        if (/[a-zA-Z]/.test(orig)) {
            if (cache[orig]) {
                node.nodeValue = cache[orig]; // Instant cache application
            } else {
                nodesToTranslate.push(node);
                textsToTranslate.push(orig);
            }
        }
    });

    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
        if (!originalTexts.has(el)) originalTexts.set(el, el.placeholder);
        const orig = originalTexts.get(el);
        if (/[a-zA-Z]/.test(orig)) {
            if (cache[orig]) {
                el.placeholder = cache[orig];
            } else {
                nodesToTranslate.push(el);
                textsToTranslate.push(orig);
            }
        }
    });

    if (textsToTranslate.length === 0) return;

    // Single unified lightning-fast request
    try {
        const res = await fetch('http://127.0.0.1:5000/api/translate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ q: textsToTranslate, target: lang, source: 'en' })
        });
        const data = await res.json();
        const translations = data.translatedText || [];
        
        nodesToTranslate.forEach((node, idx) => {
            if (translations[idx] && typeof translations[idx] === 'string') {
                const transStr = translations[idx];
                cache[textsToTranslate[idx]] = transStr; 
                if (node.nodeType === Node.TEXT_NODE) node.nodeValue = transStr;
                else node.placeholder = transStr;
            }
        });
        localStorage.setItem('yieldiq_trans_cache', JSON.stringify(translationCache));
    } catch(e) {
        console.error('Translation error:', e);
    }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    initTicker();
    initParticles();
    initScrollReveal();
    if (currentLang !== 'en') {
        setTimeout(() => changeLanguage(currentLang), 700);
    }
});

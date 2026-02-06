// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Парсим параметры из URL
const urlParams = new URLSearchParams(window.location.search);

// Данные пользователя из URL
let userData = {
    userId: urlParams.get('user_id') || tg.initDataUnsafe?.user?.id || null,
    firstName: tg.initDataUnsafe?.user?.first_name || 'Player',
    username: tg.initDataUnsafe?.user?.username || 'player',
    playerTag: urlParams.get('player_tag') || null,
    currentMonthPoints: parseInt(urlParams.get('points')) || 0,
    totalPoints: parseInt(urlParams.get('total_points')) || 0,
    gamesPlayed: parseInt(urlParams.get('games')) || 0,
    wins: parseInt(urlParams.get('wins')) || 0,
    losses: parseInt(urlParams.get('losses')) || 0,
    position: urlParams.get('position') || '-',
    registered: urlParams.get('registered') === '1'
};

let selectedMode = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    loadUserData();
    updateCountdown();
    setInterval(updateCountdown, 60000);
});

function initApp() {
    document.body.style.backgroundColor = '#1a1a1a';
    tg.BackButton.show();
    tg.BackButton.onClick(() => tg.close());
    
    // Проверяем регистрацию
    if (!userData.registered) {
        document.getElementById('notRegistered').style.display = 'block';
    }
}

function setupEventListeners() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!userData.registered) {
                tg.showAlert('Сначала зарегистрируйся через команду /register');
                return;
            }
            selectMode(btn.dataset.mode);
        });
    });
    
    document.getElementById('verifyBtn').addEventListener('click', verifyGame);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'leaderboard') {
        loadLeaderboard();
    } else if (tabName === 'history') {
        loadHistory();
    }
    
    tg.HapticFeedback.impactOccurred('soft');
}

function selectMode(mode) {
    selectedMode = mode;
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('selected');
    
    document.getElementById('verificationSection').style.display = 'block';
    document.getElementById('selectedMode').textContent = mode.toUpperCase();
    
    tg.HapticFeedback.impactOccurred('light');
}

async function verifyGame() {
    if (!selectedMode) {
        tg.showAlert('Выбери режим игры!');
        return;
    }
    
    if (!userData.registered) {
        tg.showAlert('Сначала зарегистрируйся через /register');
        return;
    }
    
    const btn = document.getElementById('verifyBtn');
    btn.textContent = '⏳ Проверяем...';
    btn.disabled = true;
    
    tg.HapticFeedback.impactOccurred('medium');
    
    // Отправляем команду боту
    tg.sendData(JSON.stringify({
        action: 'verify',
        mode: selectedMode,
        userId: userData.userId
    }));
    
    tg.showAlert('Команда отправлена! Используй /verify в боте для проверки игры');
    
    setTimeout(() => {
        btn.textContent = '✅ Проверить игру';
        btn.disabled = false;
        selectedMode = null;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('verificationSection').style.display = 'none';
    }, 2000);
}

function loadUserData() {
    updateUserInfo();
    updateStats();
}

function updateUserInfo() {
    document.getElementById('userName').textContent = userData.firstName;
    
    if (userData.playerTag) {
        document.getElementById('playerTag').textContent = userData.playerTag;
    } else {
        document.getElementById('playerTag').textContent = 'Не зарегистрирован';
    }
    
    document.getElementById('userPoints').textContent = userData.currentMonthPoints;
    document.getElementById('userAvatar').textContent = userData.firstName.charAt(0).toUpperCase();
    document.getElementById('userPosition').textContent = userData.position;
}

function updateStats() {
    document.getElementById('gamesPlayed').textContent = userData.gamesPlayed;
    document.getElementById('wins').textContent = userData.wins;
    
    const winrate = userData.gamesPlayed > 0 
        ? ((userData.wins / userData.gamesPlayed) * 100).toFixed(1) 
        : 0;
    document.getElementById('winrate').textContent = winrate + '%';
}

function loadLeaderboard() {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '<div class="hint" style="text-align: center; padding: 2rem;">Используй команду /leaderboard в боте для просмотра полной таблицы лидеров</div>';
}

function loadHistory() {
    const list = document.getElementById('historyList');
    
    if (!userData.registered) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Зарегистрируйся через /register</p>
            </div>
        `;
        return;
    }
    
    if (userData.gamesPlayed === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎮</div>
                <p>Пока нет игр</p>
                <p class="hint">Сыграй свою первую игру!</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '<div class="hint" style="text-align: center; padding: 2rem;">Используй команду /stats в боте для просмотра детальной истории</div>';
}

function updateCountdown() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = nextMonth - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    document.getElementById('countdown').textContent = `${days}д ${hours}ч`;
}

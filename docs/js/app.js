// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// === ПОЛУЧЕНИЕ ДАННЫХ ===

function parseDataFromHash() {
    // Получаем hash (всё после #)
    const hash = window.location.hash;
    
    console.log('Full hash:', hash);
    
    if (hash && hash.includes('sync=')) {
        try {
            // Удаляем # и получаем часть после sync=
            const hashPart = hash.substring(1); // убираем #
            const syncPart = hashPart.split('sync=')[1];
            
            console.log('Sync part:', syncPart);
            
            // Декодируем из base64
            const jsonData = atob(syncPart);
            console.log('Decoded JSON:', jsonData);
            
            const data = JSON.parse(jsonData);
            console.log('Parsed data:', data);
            
            return data;
        } catch (e) {
            console.error('Parse hash error:', e);
        }
    }
    
    return null;
}

function loadUserData() {
    // 1. Проверяем hash (приоритет)
    const hashData = parseDataFromHash();
    if (hashData) {
        console.log('Found data in hash!');
        // Сохраняем в localStorage
        localStorage.setItem('userData', JSON.stringify(hashData));
        return hashData;
    }
    
    // 2. Проверяем localStorage
    const savedData = localStorage.getItem('userData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            console.log('Found data in localStorage:', data);
            return data;
        } catch (e) {
            console.error('Parse localStorage error:', e);
        }
    }
    
    // 3. Данные не найдены
    console.log('No data found!');
    return null;
}

// Загружаем данные
const loadedData = loadUserData();

// Базовые данные из Telegram
let userData = {
    userId: tg.initDataUnsafe?.user?.id || null,
    firstName: tg.initDataUnsafe?.user?.first_name || 'Player',
    username: tg.initDataUnsafe?.user?.username || 'player',
    playerTag: null,
    currentMonthPoints: 0,
    totalPoints: 0,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    position: '-',
    registered: false
};

// Применяем загруженные данные
if (loadedData) {
    console.log('Applying loaded data...');
    userData = {
        userId: loadedData.user_id || userData.userId,
        firstName: loadedData.first_name || userData.firstName,
        username: userData.username,
        playerTag: loadedData.player_tag || null,
        currentMonthPoints: loadedData.points || 0,
        totalPoints: loadedData.total_points || 0,
        gamesPlayed: loadedData.games || 0,
        wins: loadedData.wins || 0,
        losses: loadedData.losses || 0,
        position: loadedData.position || '-',
        registered: loadedData.registered === true || loadedData.registered === 'true'
    };
}

console.log('=== FINAL USER DATA ===');
console.log(userData);
console.log('Is registered:', userData.registered);

let selectedMode = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    updateUserInfo();
    updateStats();
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
                tg.showAlert('Сначала зарегистрируйся через /register, затем используй /sync');
                return;
            }
            selectMode(btn.dataset.mode);
        });
    });
    
    document.getElementById('verifyBtn').addEventListener('click', verifyGame);
    
    // Match finding
    document.getElementById('findMatchBtn').addEventListener('click', startMatchSearch);
    document.getElementById('cancelSearchBtn').addEventListener('click', cancelMatchSearch);
    document.getElementById('verifyMatchBtn').addEventListener('click', verifyMatch);
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
    
    tg.showAlert('Сыграй бой в Clash Royale, затем используй команду /verify в боте');
    
    setTimeout(() => {
        btn.textContent = '✅ Проверить игру';
        btn.disabled = false;
        selectedMode = null;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('verificationSection').style.display = 'none';
    }, 2000);
}

function updateUserInfo() {
    document.getElementById('userName').textContent = userData.firstName;
    
    if (userData.registered && userData.playerTag) {
        document.getElementById('playerTag').textContent = userData.playerTag;
    } else {
        // Показываем статус для отладки
        document.getElementById('playerTag').textContent = `registered=${userData.registered}, userId=${userData.userId}`;
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
                <p class="hint">Затем используй /sync для синхронизации</p>
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

// === MATCH FINDING SYSTEM ===

let matchSearching = false;
let matchFound = false;
let currentOpponent = null;

function startMatchSearch() {
    if (!userData.registered) {
        tg.showAlert('Сначала зарегистрируйся через /register, затем используй /sync');
        return;
    }
    
    matchSearching = true;
    
    document.getElementById('findMatchBtn').style.display = 'none';
    document.getElementById('searchingSection').style.display = 'block';
    
    tg.HapticFeedback.impactOccurred('medium');
    
    const searchTime = Math.random() * 4000 + 3000;
    
    setTimeout(() => {
        if (matchSearching) {
            findMatch();
        }
    }, searchTime);
}

function cancelMatchSearch() {
    matchSearching = false;
    
    document.getElementById('searchingSection').style.display = 'none';
    document.getElementById('findMatchBtn').style.display = 'block';
    
    tg.HapticFeedback.impactOccurred('soft');
}

function findMatch() {
    matchSearching = false;
    matchFound = true;
    
    currentOpponent = generateOpponent();
    
    document.getElementById('searchingSection').style.display = 'none';
    
    showMatchFound(currentOpponent);
    
    tg.HapticFeedback.notificationOccurred('success');
}

function generateOpponent() {
    const names = [
        'ProGamer', 'CrownKing', 'Arena15', 'Challenger', 'Winner',
        'Champion', 'Gladiator', 'Warrior', 'Conqueror', 'Master',
        'Legend', 'Titan', 'Phoenix', 'Dragon', 'Shadow'
    ];
    
    const name = names[Math.floor(Math.random() * names.length)];
    const trophies = Math.floor(Math.random() * 3000) + 4000;
    const tag = '#' + Math.random().toString(36).substr(2, 8).toUpperCase();
    
    return {
        name: name,
        trophies: trophies,
        tag: tag,
        avatar: name.charAt(0)
    };
}

function showMatchFound(opponent) {
    document.getElementById('yourAvatar').textContent = userData.firstName.charAt(0).toUpperCase();
    document.getElementById('yourName').textContent = userData.firstName;
    document.getElementById('yourTrophies').textContent = '🏆 ' + (userData.currentMonthPoints * 10 || 5000);
    
    document.getElementById('opponentAvatar').textContent = opponent.avatar;
    document.getElementById('opponentName').textContent = opponent.name;
    document.getElementById('opponentTrophies').textContent = '🏆 ' + opponent.trophies;
    document.getElementById('opponentNameStrong').textContent = opponent.name;
    
    document.getElementById('matchFoundSection').style.display = 'block';
}

function verifyMatch() {
    if (!currentOpponent) {
        tg.showAlert('Ошибка: соперник не найден');
        return;
    }
    
    const btn = document.getElementById('verifyMatchBtn');
    btn.textContent = '⏳ Проверяем...';
    btn.disabled = true;
    
    tg.HapticFeedback.impactOccurred('medium');
    
    tg.showAlert('Сыграй против соперника, затем используй /verify в боте');
    
    setTimeout(() => {
        resetMatchFinding();
    }, 2000);
}

function resetMatchFinding() {
    matchFound = false;
    currentOpponent = null;
    
    document.getElementById('matchFoundSection').style.display = 'none';
    document.getElementById('searchingSection').style.display = 'none';
    document.getElementById('findMatchBtn').style.display = 'block';
    
    const btn = document.getElementById('verifyMatchBtn');
    btn.textContent = '✅ Проверить игру';
    btn.disabled = false;
}

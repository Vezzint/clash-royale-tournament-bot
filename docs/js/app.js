// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// === ЗАГРУЗКА ДАННЫХ ИЗ LOCALSTORAGE ===

function loadSavedData() {
    const saved = localStorage.getItem('userData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            console.log('Loaded from localStorage:', data);
            return data;
        } catch (e) {
            console.error('Parse error:', e);
        }
    }
    return null;
}

const savedData = loadSavedData();

// Базовые данные
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

// Применяем сохраненные данные
if (savedData) {
    userData = {
        userId: savedData.user_id || userData.userId,
        firstName: savedData.first_name || userData.firstName,
        username: userData.username,
        playerTag: savedData.player_tag || null,
        currentMonthPoints: savedData.points || 0,
        totalPoints: savedData.total_points || 0,
        gamesPlayed: savedData.games || 0,
        wins: savedData.wins || 0,
        losses: savedData.losses || 0,
        position: savedData.position || '-',
        registered: savedData.registered === true
    };
    console.log('User is registered!', userData);
}

console.log('Final userData:', userData);

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
    
    // Показываем предупреждение или кнопку синхронизации
    if (!userData.registered) {
        document.getElementById('notRegistered').style.display = 'block';
        document.getElementById('syncCard').style.display = 'block';
    }
}

function setupEventListeners() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!userData.registered) {
                tg.showAlert('Сначала зарегистрируйся через /register и /sync');
                return;
            }
            selectMode(btn.dataset.mode);
        });
    });
    
    document.getElementById('verifyBtn').addEventListener('click', verifyGame);
    document.getElementById('syncDataBtn').addEventListener('click', syncData);
    
    // Match finding
    document.getElementById('findMatchBtn').addEventListener('click', startMatchSearch);
    document.getElementById('cancelSearchBtn').addEventListener('click', cancelMatchSearch);
    document.getElementById('verifyMatchBtn').addEventListener('click', verifyMatch);
}

// === СИНХРОНИЗАЦИЯ ДАННЫХ ===
function syncData() {
    const input = document.getElementById('syncInput').value.trim();
    
    if (!input) {
        tg.showAlert('Вставь данные из команды /sync');
        return;
    }
    
    try {
        const data = JSON.parse(input);
        
        // Проверяем обязательные поля
        if (!data.player_tag || !data.user_id) {
            tg.showAlert('Неверный формат данных!');
            return;
        }
        
        // Сохраняем в localStorage
        localStorage.setItem('userData', JSON.stringify(data));
        
        // Применяем данные
        userData = {
            userId: data.user_id,
            firstName: data.first_name || userData.firstName,
            username: userData.username,
            playerTag: data.player_tag,
            currentMonthPoints: data.points || 0,
            totalPoints: data.total_points || 0,
            gamesPlayed: data.games || 0,
            wins: data.wins || 0,
            losses: data.losses || 0,
            position: data.position || '-',
            registered: true
        };
        
        // Обновляем интерфейс
        updateUserInfo();
        updateStats();
        
        // Скрываем предупреждение и карточку синхронизации
        document.getElementById('notRegistered').style.display = 'none';
        document.getElementById('syncCard').style.display = 'none';
        
        // Очищаем поле ввода
        document.getElementById('syncInput').value = '';
        
        tg.showAlert('✅ Данные успешно синхронизированы!');
        tg.HapticFeedback.notificationOccurred('success');
        
    } catch (e) {
        console.error('Sync error:', e);
        tg.showAlert('❌ Ошибка! Проверь формат данных');
        tg.HapticFeedback.notificationOccurred('error');
    }
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
    
    tg.showAlert('Сыграй бой в Clash Royale, затем используй /verify в боте. После этого снова /sync для обновления очков');
    
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
    list.innerHTML = '<div class="hint" style="text-align: center; padding: 2rem;">Используй команду /leaderboard в боте</div>';
}

function loadHistory() {
    const list = document.getElementById('historyList');
    
    if (!userData.registered) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <p>Зарегистрируйся через /register</p>
                <p class="hint">Затем используй /sync</p>
            </div>
        `;
        return;
    }
    
    if (userData.gamesPlayed === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎮</div>
                <p>Пока нет игр</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '<div class="hint" style="text-align: center; padding: 2rem;">Используй /stats в боте</div>';
}

function updateCountdown() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = nextMonth - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    document.getElementById('countdown').textContent = `${days}д ${hours}ч`;
}

// === MATCH FINDING (остальное без изменений) ===
let matchSearching = false;
let matchFound = false;
let currentOpponent = null;

function startMatchSearch() {
    if (!userData.registered) {
        tg.showAlert('Сначала зарегистрируйся через /register и /sync');
        return;
    }
    
    matchSearching = true;
    document.getElementById('findMatchBtn').style.display = 'none';
    document.getElementById('searchingSection').style.display = 'block';
    tg.HapticFeedback.impactOccurred('medium');
    
    setTimeout(() => {
        if (matchSearching) findMatch();
    }, Math.random() * 4000 + 3000);
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
    const names = ['ProGamer', 'CrownKing', 'Arena15', 'Challenger', 'Winner', 'Champion', 'Gladiator'];
    return {
        name: names[Math.floor(Math.random() * names.length)],
        trophies: Math.floor(Math.random() * 3000) + 4000,
        tag: '#' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        avatar: names[0].charAt(0)
    };
}

function showMatchFound(opponent) {
    document.getElementById('yourAvatar').textContent = userData.firstName.charAt(0).toUpperCase();
    document.getElementById('yourName').textContent = userData.firstName;
    document.getElementById('yourTrophies').textContent = '🏆 ' + (userData.currentMonthPoints * 10 || 5000);
    document.getElementById('opponentAvatar').textContent = opponent.name.charAt(0);
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
    tg.showAlert('Используй /verify в боте, затем /sync для обновления');
    setTimeout(() => resetMatchFinding(), 2000);
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

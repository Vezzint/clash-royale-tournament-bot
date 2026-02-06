// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Данные пользователя
let userData = {
    userId: tg.initDataUnsafe?.user?.id || null,
    firstName: tg.initDataUnsafe?.user?.first_name || 'Player',
    username: tg.initDataUnsafe?.user?.username || 'player',
    playerTag: null,
    currentMonthPoints: 0,
    totalPoints: 0,
    gamesPlayed: 0,
    wins: 0
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
    // Применяем темную тему
    document.body.style.backgroundColor = '#1a1a1a';
    
    // Настраиваем главную кнопку
    tg.MainButton.hide();
    
    // Показываем кнопку "Назад" в Telegram
    tg.BackButton.show();
    tg.BackButton.onClick(() => tg.close());
}

function setupEventListeners() {
    // Переключение табов
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // Выбор режима игры
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectMode(btn.dataset.mode);
        });
    });
    
    // Кнопка проверки игры
    document.getElementById('verifyBtn').addEventListener('click', verifyGame);
}

function switchTab(tabName) {
    // Убираем active со всех табов и контента
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    
    // Добавляем active к выбранному
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // Загружаем данные для таба
    if (tabName === 'leaderboard') {
        loadLeaderboard();
    } else if (tabName === 'history') {
        loadHistory();
    } else if (tabName === 'rewards') {
        loadUserPosition();
    }
    
    tg.HapticFeedback.impactOccurred('soft');
}

function selectMode(mode) {
    selectedMode = mode;
    
    // Убираем selected со всех кнопок
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Добавляем selected к выбранной
    document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('selected');
    
    // Показываем секцию верификации
    document.getElementById('verificationSection').style.display = 'block';
    document.getElementById('selectedMode').textContent = mode.toUpperCase();
    
    tg.HapticFeedback.impactOccurred('light');
}

async function verifyGame() {
    if (!selectedMode) {
        showError('Выбери режим игры!');
        return;
    }
    
    const btn = document.getElementById('verifyBtn');
    btn.textContent = '⏳ Проверяем...';
    btn.disabled = true;
    
    tg.HapticFeedback.impactOccurred('medium');
    
    // Отправляем команду боту
    sendVerifyCommand(selectedMode);
    
    // Таймаут для проверки
    setTimeout(() => {
        btn.textContent = '✅ Проверить игру';
        btn.disabled = false;
        
        // Сбрасываем выбор
        selectedMode = null;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('verificationSection').style.display = 'none';
        
        // Обновляем данные
        setTimeout(() => {
            loadUserData();
        }, 2000);
    }, 3000);
}

function sendVerifyCommand(mode) {
    // Отправляем данные боту
    const data = {
        action: 'verify',
        mode: mode,
        userId: userData.userId,
        timestamp: Date.now()
    };
    
    tg.sendData(JSON.stringify(data));
}

function loadUserData() {
    // Обновляем информацию о пользователе
    updateUserInfo();
    
    // Загружаем статистику из localStorage (временно)
    const stats = getLocalStats();
    updateStats(stats);
}

function getLocalStats() {
    const saved = localStorage.getItem('userStats');
    if (saved) {
        return JSON.parse(saved);
    }
    return {
        gamesPlayed: 0,
        wins: 0,
        losses: 0
    };
}

function saveLocalStats(stats) {
    localStorage.setItem('userStats', JSON.stringify(stats));
}

function updateUserInfo() {
    document.getElementById('userName').textContent = userData.firstName;
    
    // Получаем player tag из URL параметров если есть
    const urlParams = new URLSearchParams(window.location.search);
    const playerTag = urlParams.get('player_tag');
    
    if (playerTag) {
        userData.playerTag = playerTag;
        document.getElementById('playerTag').textContent = playerTag;
    } else {
        document.getElementById('playerTag').textContent = 'Не зарегистрирован';
    }
    
    // Получаем очки из URL если есть
    const points = urlParams.get('points');
    if (points) {
        userData.currentMonthPoints = parseInt(points);
        document.getElementById('userPoints').textContent = points;
    } else {
        document.getElementById('userPoints').textContent = '0';
    }
    
    // Устанавливаем аватар
    const avatar = document.getElementById('userAvatar');
    avatar.textContent = userData.firstName.charAt(0).toUpperCase();
}

function updateStats(stats) {
    document.getElementById('gamesPlayed').textContent = stats.gamesPlayed || 0;
    document.getElementById('wins').textContent = stats.wins || 0;
    
    const winrate = stats.gamesPlayed > 0 
        ? ((stats.wins / stats.gamesPlayed) * 100).toFixed(1) 
        : 0;
    document.getElementById('winrate').textContent = winrate + '%';
}

function loadLeaderboard() {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '<div class="loading">Загрузка...</div>';
    
    // Запрашиваем данные у бота
    requestLeaderboard();
    
    // Временно показываем пример
    setTimeout(() => {
        const mockLeaderboard = [
            { rank: 1, name: 'Loading...', tag: '#----', points: 0 }
        ];
        
        list.innerHTML = mockLeaderboard.map(player => `
            <div class="leaderboard-item">
                <div class="leaderboard-rank">${player.rank}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${player.name}</div>
                    <div class="leaderboard-tag">${player.tag}</div>
                </div>
                <div class="leaderboard-points">⭐ ${player.points}</div>
            </div>
        `).join('');
        
        // Добавляем сообщение
        list.innerHTML += '<div class="hint" style="text-align: center; margin-top: 1rem;">Используй команды бота для просмотра полной таблицы</div>';
    }, 500);
}

function requestLeaderboard() {
    const data = {
        action: 'get_leaderboard',
        userId: userData.userId
    };
    // В будущем можно отправить боту
    // tg.sendData(JSON.stringify(data));
}

function loadHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div class="loading">Загрузка...</div>';
    
    setTimeout(() => {
        const history = getLocalHistory();
        
        if (history.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎮</div>
                    <p>Пока нет игр</p>
                    <p class="hint">Сыграй свою первую игру!</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = history.map(game => `
            <div class="history-item ${game.result}">
                <div class="history-header">
                    <div class="history-result">
                        ${game.result === 'win' ? '🏆 Победа' : '💔 Поражение'}
                    </div>
                    <div class="history-points">+${game.points}</div>
                </div>
                <div class="history-details">
                    👑 ${game.crowns} - ${game.opponentCrowns} | 🎮 ${game.mode}
                </div>
                <div class="history-time">🕐 ${game.time}</div>
            </div>
        `).join('');
    }, 500);
}

function getLocalHistory() {
    const saved = localStorage.getItem('gameHistory');
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
}

function addToHistory(game) {
    const history = getLocalHistory();
    history.unshift(game);
    
    // Храним только последние 20 игр
    if (history.length > 20) {
        history.pop();
    }
    
    localStorage.setItem('gameHistory', JSON.stringify(history));
}

function loadUserPosition() {
    // Запрашиваем позицию у бота
    const urlParams = new URLSearchParams(window.location.search);
    const position = urlParams.get('position');
    
    if (position) {
        document.getElementById('userPosition').textContent = position;
    } else {
        document.getElementById('userPosition').textContent = '-';
    }
}

function updateCountdown() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = nextMonth - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    document.getElementById('countdown').textContent = `${days}д ${hours}ч`;
}

// Утилиты
function showError(message) {
    tg.showAlert(message);
    tg.HapticFeedback.notificationOccurred('error');
}

function showSuccess(message) {
    tg.showAlert(message);
    tg.HapticFeedback.notificationOccurred('success');
}

// Слушаем события от Telegram
window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'game_verified') {
        // Обновляем данные после верификации
        const gameData = event.data.data;
        
        // Обновляем статистику
        const stats = getLocalStats();
        stats.gamesPlayed++;
        if (gameData.result === 'win') stats.wins++;
        else if (gameData.result === 'loss') stats.losses++;
        saveLocalStats(stats);
        updateStats(stats);
        
        // Добавляем в историю
        addToHistory({
            result: gameData.result,
            crowns: gameData.crowns,
            opponentCrowns: gameData.opponentCrowns,
            mode: gameData.mode,
            points: gameData.points,
            time: 'Только что'
        });
        
        // Обновляем очки
        userData.currentMonthPoints += gameData.points;
        document.getElementById('userPoints').textContent = userData.currentMonthPoints;
        
        showSuccess(`Игра засчитана! +${gameData.points} очков`);
    }
});

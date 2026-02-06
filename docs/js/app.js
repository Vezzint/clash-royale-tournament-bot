// Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

// Mock data (в реальном приложении данные будут с сервера)
let userData = {
    userId: tg.initDataUnsafe?.user?.id || 123456,
    firstName: tg.initDataUnsafe?.user?.first_name || 'Player',
    username: tg.initDataUnsafe?.user?.username || 'player',
    playerTag: '#ABC123',
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
    setInterval(updateCountdown, 60000); // Обновляем каждую минуту
});

function initApp() {
    // Применяем тему Telegram
    document.body.style.backgroundColor = tg.backgroundColor || '#ffffff';
    document.body.style.color = tg.textColor || '#000000';
    
    // Устанавливаем главную кнопку
    tg.MainButton.setText('Закрыть');
    tg.MainButton.onClick(() => tg.close());
    tg.MainButton.hide();
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
        tg.showAlert('Выбери режим игры!');
        return;
    }
    
    const btn = document.getElementById('verifyBtn');
    btn.textContent = '⏳ Проверяем...';
    btn.disabled = true;
    
    tg.HapticFeedback.impactOccurred('medium');
    
    // В реальном приложении здесь будет запрос к боту
    // Для демо используем setTimeout
    setTimeout(() => {
        // Симулируем успешную проверку
        const mockResult = {
            result: Math.random() > 0.5 ? 'win' : 'loss',
            crowns: Math.floor(Math.random() * 4),
            opponentCrowns: Math.floor(Math.random() * 4),
            points: Math.floor(Math.random() * 30) + 10
        };
        
        userData.gamesPlayed++;
        userData.currentMonthPoints += mockResult.points;
        userData.totalPoints += mockResult.points;
        
        if (mockResult.result === 'win') {
            userData.wins++;
        }
        
        updateUserInfo();
        updateStats();
        
        const resultEmoji = mockResult.result === 'win' ? '🏆' : '💔';
        const resultText = mockResult.result === 'win' ? 'Победа' : 'Поражение';
        
        tg.showPopup({
            title: `${resultEmoji} ${resultText}!`,
            message: `Короны: ${mockResult.crowns} - ${mockResult.opponentCrowns}\nПолучено очков: +${mockResult.points}`,
            buttons: [{type: 'ok'}]
        });
        
        tg.HapticFeedback.notificationOccurred('success');
        
        btn.textContent = '✅ Проверить игру';
        btn.disabled = false;
        
        // Сбрасываем выбор режима
        selectedMode = null;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('verificationSection').style.display = 'none';
    }, 2000);
}

function loadUserData() {
    // В реальном приложении загрузка с сервера через Telegram.WebApp.initData
    updateUserInfo();
    updateStats();
}

function updateUserInfo() {
    document.getElementById('userName').textContent = userData.firstName;
    document.getElementById('playerTag').textContent = userData.playerTag;
    document.getElementById('userPoints').textContent = userData.currentMonthPoints;
    document.getElementById('userAvatar').textContent = userData.firstName[0];
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
    
    // Mock данные
    const mockLeaderboard = [
        { rank: 1, name: 'ProGamer', tag: '#PRO123', points: 1250 },
        { rank: 2, name: 'CrownKing', tag: '#KING99', points: 1100 },
        { rank: 3, name: 'Arena15', tag: '#AR15', points: 980 },
        { rank: 4, name: 'Challenger', tag: '#CH777', points: 850 },
        { rank: 5, name: 'Winner', tag: '#WIN01', points: 720 },
    ];
    
    list.innerHTML = mockLeaderboard.map(player => `
        <div class="leaderboard-item ${player.rank <= 3 ? 'top-3' : ''}">
            <div class="leaderboard-rank">
                ${player.rank <= 3 ? ['🥇', '🥈', '🥉'][player.rank - 1] : player.rank}
            </div>
            <div class="leaderboard-info">
                <div class="leaderboard-name">${player.name}</div>
                <div class="leaderboard-tag">${player.tag}</div>
            </div>
            <div class="leaderboard-points">⭐ ${player.points}</div>
        </div>
    `).join('');
}

function loadHistory() {
    const list = document.getElementById('historyList');
    
    // Mock данные
    const mockHistory = [
        { 
            result: 'win', 
            crowns: 3, 
            opponentCrowns: 1, 
            mode: 'Ladder', 
            points: 25,
            time: '2 часа назад'
        },
        { 
            result: 'loss', 
            crowns: 0, 
            opponentCrowns: 2, 
            mode: '1v1', 
            points: 5,
            time: '5 часов назад'
        },
        { 
            result: 'win', 
            crowns: 2, 
            opponentCrowns: 1, 
            mode: 'Challenge', 
            points: 30,
            time: 'Вчера'
        },
    ];
    
    if (mockHistory.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎮</div>
                <p>Пока нет игр</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = mockHistory.map(game => `
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
}

function loadUserPosition() {
    // Mock позиция
    const position = Math.floor(Math.random() * 50) + 1;
    document.getElementById('userPosition').textContent = position;
}

function updateCountdown() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diff = nextMonth - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    document.getElementById('countdown').textContent = `${days}д ${hours}ч`;
}

// Отправка данных боту
function sendDataToBot(data) {
    tg.sendData(JSON.stringify(data));
}

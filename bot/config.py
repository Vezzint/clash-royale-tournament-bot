import os
from dotenv import load_dotenv

load_dotenv()

# Telegram Bot Token от @BotFather
BOT_TOKEN = os.getenv('BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE')

# Clash Royale API Token от https://developer.clashroyale.com
CLASH_ROYALE_API_TOKEN = os.getenv('CLASH_ROYALE_API_TOKEN', 'YOUR_API_TOKEN_HERE')

# URL твоего Mini App (после деплоя на GitHub Pages)
MINI_APP_URL = os.getenv('MINI_APP_URL', 'https://yourusername.github.io/clash-royale-tournament-bot')

# База данных
DATABASE_PATH = 'tournament.db'

# Режимы игры Clash Royale
GAME_MODES = {
    'ladder': 'Ladder',
    '1v1': '1v1 Battle',
    '2v2': '2v2 Battle',
    'challenge': 'Challenge',
    'tournament': 'Tournament'
}

# Награды по местам
REWARDS = {
    1: {'gems': 1000, 'gold': 50000, 'title': '🥇 Champion'},
    2: {'gems': 500, 'gold': 25000, 'title': '🥈 Runner-up'},
    3: {'gems': 250, 'gold': 10000, 'title': '🥉 Third Place'},
    'top10': {'gems': 100, 'gold': 5000, 'title': '⭐ Top 10'}
}

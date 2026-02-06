from aiogram import Router, F
from aiogram.types import CallbackQuery, Message
from aiogram.filters import Command
from datetime import datetime

router = Router()

@router.callback_query(F.data == "my_rank")
async def show_rank(callback: CallbackQuery):
    """Показать позицию в рейтинге"""
    from bot import db  # Импортируем из основного файла
    
    user = db.get_user(callback.from_user.id)
    
    if not user:
        await callback.answer("Зарегистрируйся сначала!", show_alert=True)
        return
    
    leaderboard = db.get_leaderboard(limit=1000)
    
    user_position = None
    for idx, player in enumerate(leaderboard, 1):
        if player['user_id'] == callback.from_user.id:
            user_position = idx
            break
    
    if user_position:
        await callback.answer(
            f"🏆 Твоя позиция: {user_position} место\n"
            f"⭐ Очки: {user['current_month_points']}",
            show_alert=True
        )
    else:
        await callback.answer("Сыграй хотя бы одну игру!", show_alert=True)

@router.callback_query(F.data.startswith("mode_"))
async def select_mode(callback: CallbackQuery):
    """Выбор режима игры через callback"""
    from config import GAME_MODES
    
    mode = callback.data.split("_")[1]
    
    await callback.message.answer(
        f"✅ Выбран режим: {GAME_MODES.get(mode, mode)}\n\n"
        f"Теперь сыграй бой в этом режиме и используй /verify для проверки"
    )
    await callback.answer()

@router.message(Command("help"))
async def cmd_help(message: Message):
    """Помощь"""
    help_text = """
📖 <b>Помощь по боту</b>

<b>Основные команды:</b>
/start - Главное меню
/register - Регистрация по Player Tag
/verify - Проверить последнюю игру
/stats - Твоя статистика
/leaderboard - Топ игроков
/profile - Подробный профиль
/top - Топ-25 игроков
/rules - Правила турнира
/help - Эта справка

<b>Как играть:</b>
1️⃣ Зарегистрируйся с помощью /register
2️⃣ Открой Mini App и выбери режим игры
3️⃣ Сыграй бой в Clash Royale
4️⃣ Нажми "Проверить игру" или используй /verify
5️⃣ Получай очки и соревнуйся!

<b>Система очков:</b>
🏆 Победа: 10 очков
🤝 Ничья: 5 очков
💔 Поражение: 2 очка
👑 За каждую корону: +2 очка
🔥 За 3-коронку: +10 бонус

<b>Награды:</b>
В конце каждого месяца топ-10 игроков получают награды!

🥇 1 место: 💎 1000 Gems + 🪙 50000 Gold
🥈 2 место: 💎 500 Gems + 🪙 25000 Gold
🥉 3 место: 💎 250 Gems + 🪙 10000 Gold
⭐ 4-10 место: 💎 100 Gems + 🪙 5000 Gold
"""
    await message.answer(help_text, parse_mode="HTML")

@router.message(Command("profile"))
async def cmd_profile(message: Message):
    """Подробный профиль игрока"""
    from bot import db, cr_api  # Импортируем из основного файла
    
    user = db.get_user(message.from_user.id)
    
    if not user:
        await message.answer("❌ Сначала зарегистрируйся: /register")
        return
    
    msg = await message.answer("⏳ Загружаю профиль...")
    
    # Получаем данные из Clash Royale API
    player_data = cr_api.get_player(user['player_tag'])
    
    if not player_data:
        await msg.edit_text("❌ Не удалось загрузить профиль из Clash Royale")
        return
    
    games = db.get_user_games(message.from_user.id, limit=100)
    wins = sum(1 for g in games if g['result'] == 'win')
    losses = sum(1 for g in games if g['result'] == 'loss')
    draws = sum(1 for g in games if g['result'] == 'draw')
    
    profile_text = f"""
👤 <b>Профиль игрока</b>

🎮 <b>Clash Royale:</b>
Имя: {player_data.get('name', 'Unknown')}
Тег: <code>{user['player_tag']}</code>
🏆 Трофеи: {player_data.get('trophies', 0)}
🏅 Лучший результат: {player_data.get('bestTrophies', 0)}
🎖 Уровень: {player_data.get('expLevel', 0)}

📊 <b>Статистика в турнире:</b>
Всего игр: {len(games)}
✅ Побед: {wins}
❌ Поражений: {losses}
🤝 Ничьих: {draws}
📈 Винрейт: {(wins / len(games) * 100) if games else 0:.1f}%

💰 <b>Очки:</b>
⭐ В этом месяце: {user['current_month_points']}
🏅 Всего: {user['total_points']}

📅 Зарегистрирован: {user['registered_at'][:10] if user.get('registered_at') else 'Неизвестно'}
"""
    
    await msg.edit_text(profile_text, parse_mode="HTML")

@router.message(Command("top"))
async def cmd_top(message: Message):
    """Расширенная таблица лидеров"""
    from bot import db
    
    leaderboard = db.get_leaderboard(limit=25)
    
    if not leaderboard:
        await message.answer("📊 Таблица лидеров пока пуста")
        return
    
    text = "🏆 <b>Топ-25 игроков месяца</b>\n\n"
    
    medals = {1: '🥇', 2: '🥈', 3: '🥉'}
    
    for idx, player in enumerate(leaderboard, 1):
        medal = medals.get(idx, f"<b>{idx}.</b>")
        name = player['first_name'] or player['username'] or 'Аноним'
        
        # Обрезаем длинные имена
        if len(name) > 15:
            name = name[:12] + "..."
        
        text += f"{medal} {name} — ⭐ {player['current_month_points']}\n"
    
    await message.answer(text, parse_mode="HTML")

@router.message(Command("rules"))
async def cmd_rules(message: Message):
    """Правила турнира"""
    rules_text = """
📜 <b>Правила турнира</b>

<b>Система очков:</b>

🏆 <b>Победа:</b> 10 базовых очков
🤝 <b>Ничья:</b> 5 базовых очков  
💔 <b>Поражение:</b> 2 очка (утешительные)

<b>Бонусы:</b>
👑 За каждую взятую корону: +2 очка
🔥 За 3-коронку: дополнительно +10 очков

<b>Множители режимов:</b>
⚔️ Ladder / 1v1: x1.0
🎯 Challenge: x1.5
🏅 Tournament: x2.0
💎 Grand Challenge: x3.0

<b>Пример расчета:</b>
Победа 3-1 в Challenge:
• База: 10 очков (победа)
• Короны: 3 × 2 = 6 очков
• Бонус 3-коронки: 10 очков
• Итого: 26 × 1.5 = 39 очков

<b>Верификация:</b>
✅ Игра должна быть сыграна не более 30 минут назад
✅ Автоматическая проверка через Clash Royale API
✅ Засчитываются только проверенные бои

<b>Награды:</b>
🎁 Выдаются автоматически в конце месяца
🔄 Очки обнуляются 1-го числа каждого месяца

<b>Нечестная игра:</b>
❌ Попытки обмана системы ведут к бану
❌ Использование чужих аккаунтов запрещено
"""
    await message.answer(rules_text, parse_mode="HTML")

@router.message(Command("rewards"))
async def cmd_rewards(message: Message):
    """История наград пользователя"""
    from bot import db
    
    user = db.get_user(message.from_user.id)
    
    if not user:
        await message.answer("❌ Сначала зарегистрируйся: /register")
        return
    
    rewards = db.get_user_rewards(message.from_user.id)
    
    if not rewards:
        await message.answer(
            "🎁 У тебя пока нет полученных наград.\n\n"
            "Попади в топ-10 в конце месяца чтобы получить награды!"
        )
        return
    
    text = "🏆 <b>Твои награды:</b>\n\n"
    
    for reward in rewards:
        import json
        reward_data = json.loads(reward['reward_data'])
        
        text += f"📅 {reward['month']}\n"
        text += f"🏅 Место: {reward['place']}\n"
        text += f"⭐ Очки: {reward['points']}\n"
        text += f"💎 Gems: {reward_data['gems']}\n"
        text += f"🪙 Gold: {reward_data['gold']}\n"
        text += f"━━━━━━━━━━━━━━━\n\n"
    
    await message.answer(text, parse_mode="HTML")

@router.message(Command("mystats"))
async def cmd_mystats(message: Message):
    """Детальная статистика"""
    from bot import db
    
    user = db.get_user(message.from_user.id)
    
    if not user:
        await message.answer("❌ Сначала зарегистрируйся: /register")
        return
    
    games = db.get_user_games(message.from_user.id, limit=1000)
    
    if not games:
        await message.answer("📊 У тебя пока нет сыгранных игр")
        return
    
    # Подсчет статистики
    total_games = len(games)
    wins = sum(1 for g in games if g['result'] == 'win')
    losses = sum(1 for g in games if g['result'] == 'loss')
    draws = sum(1 for g in games if g['result'] == 'draw')
    
    total_crowns = sum(g['crowns'] for g in games)
    three_crowns = sum(1 for g in games if g['crowns'] == 3)
    
    total_points = sum(g['points_earned'] for g in games)
    avg_points = total_points / total_games if total_games > 0 else 0
    
    # Статистика по режимам
    modes = {}
    for game in games:
        mode = game['game_mode']
        if mode not in modes:
            modes[mode] = {'games': 0, 'wins': 0}
        modes[mode]['games'] += 1
        if game['result'] == 'win':
            modes[mode]['wins'] += 1
    
    stats_text = f"""
📊 <b>Детальная статистика</b>

<b>Общее:</b>
🎮 Всего игр: {total_games}
✅ Побед: {wins} ({wins/total_games*100:.1f}%)
❌ Поражений: {losses} ({losses/total_games*100:.1f}%)
🤝 Ничьих: {draws} ({draws/total_games*100:.1f}%)

<b>Короны:</b>
👑 Всего взято: {total_crowns}
🔥 3-коронок: {three_crowns}
📊 Средняя: {total_crowns/total_games:.1f} за игру

<b>Очки:</b>
⭐ Всего заработано: {total_points}
📈 Среднее за игру: {avg_points:.1f}

<b>По режимам:</b>
"""
    
    for mode, data in modes.items():
        winrate = (data['wins'] / data['games'] * 100) if data['games'] > 0 else 0
        stats_text += f"• {mode}: {data['games']} игр (WR: {winrate:.1f}%)\n"
    
    await message.answer(stats_text, parse_mode="HTML")

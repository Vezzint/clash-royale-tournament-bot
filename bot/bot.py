import asyncio
import logging
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo, CallbackQuery
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from datetime import datetime
import json
import base64

import config
from database import Database
from royale_api import ClashRoyaleAPI

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация
bot = Bot(token=config.BOT_TOKEN)
dp = Dispatcher()
router = Router()

db = Database(config.DATABASE_PATH)
cr_api = ClashRoyaleAPI(config.CLASH_ROYALE_API_TOKEN)

# FSM States
class Registration(StatesGroup):
    waiting_for_tag = State()

# Команды
@router.message(CommandStart())
async def cmd_start(message: Message):
    """Обработка /start"""
    logger.info(f"User {message.from_user.id} started bot")
    
    user = db.get_user(message.from_user.id)
    
    # Базовый URL Mini App
    mini_app_url = config.MINI_APP_URL
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🎮 Открыть Mini App",
            web_app=WebAppInfo(url=mini_app_url)
        )],
        [
            InlineKeyboardButton(text="📊 Статистика", callback_data="stats"),
            InlineKeyboardButton(text="🏆 Топ", callback_data="leaderboard")
        ]
    ])
    
    if user:
        # Получаем позицию в рейтинге
        leaderboard = db.get_leaderboard(limit=1000)
        position = next((i for i, p in enumerate(leaderboard, 1) if p['user_id'] == message.from_user.id), None)
        if position is None:
            position = '-'
        
        # Получаем статистику
        games = db.get_user_games(message.from_user.id, limit=1000)
        
        await message.answer(
            f"👋 Привет, {message.from_user.first_name}!\n\n"
            f"✅ ТЫ ЗАРЕГИСТРИРОВАН!\n"
            f"🎮 Твой тег: <code>{user['player_tag']}</code>\n"
            f"⭐ Очки в этом месяце: {user['current_month_points']}\n"
            f"🏅 Всего очков: {user['total_points']}\n"
            f"📊 Позиция: {position} место\n"
            f"🎯 Игр сыграно: {len(games)}\n\n"
            f"💡 Используй /sync чтобы синхронизировать данные с Mini App!",
            reply_markup=keyboard,
            parse_mode="HTML"
        )
    else:
        await message.answer(
            "👋 Привет! Добро пожаловать в турнирный бот Clash Royale!\n\n"
            f"⚠️ ТЫ НЕ ЗАРЕГИСТРИРОВАН!\n\n"
            "🎮 Участвуй в соревнованиях и получай награды в конце месяца!\n\n"
            "Для начала зарегистрируйся командой /register",
            reply_markup=keyboard
        )

@router.message(Command("sync"))
async def cmd_sync(message: Message):
    """Синхронизация данных с Mini App"""
    user = db.get_user(message.from_user.id)
    
    if not user:
        await message.answer(
            "❌ Сначала зарегистрируйся: /register\n\n"
            "После регистрации используй /sync для синхронизации с Mini App"
        )
        return
    
    # Получаем статистику
    leaderboard = db.get_leaderboard(limit=1000)
    position = next((i for i, p in enumerate(leaderboard, 1) if p['user_id'] == message.from_user.id), None)
    
    games = db.get_user_games(message.from_user.id, limit=1000)
    wins = sum(1 for g in games if g['result'] == 'win')
    losses = sum(1 for g in games if g['result'] == 'loss')
    
    # Формируем JSON для Mini App
    sync_data = {
        'user_id': message.from_user.id,
        'player_tag': user['player_tag'],
        'points': user['current_month_points'],
        'total_points': user['total_points'],
        'position': str(position) if position else '-',
        'games': len(games),
        'wins': wins,
        'losses': losses,
        'registered': True,
        'first_name': message.from_user.first_name
    }
    
    # Кодируем данные в base64
    data_json = json.dumps(sync_data)
    data_encoded = base64.b64encode(data_json.encode()).decode()
    
    # Создаем URL с данными в hash
    sync_url = f"{config.MINI_APP_URL}#sync={data_encoded}"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🔄 Открыть Mini App",
            web_app=WebAppInfo(url=sync_url)
        )]
    ])
    
    await message.answer(
        "✅ Данные синхронизированы!\n\n"
        f"🎮 Тег: <code>{user['player_tag']}</code>\n"
        f"⭐ Очки: {user['current_month_points']}\n"
        f"📊 Игр: {len(games)} (побед: {wins})\n"
        f"🏆 Позиция: {position if position else '-'} место\n\n"
        "Открой Mini App через кнопку ниже:",
        reply_markup=keyboard,
        parse_mode="HTML"
    )

@router.message(Command("register"))
async def cmd_register(message: Message, state: FSMContext):
    """Регистрация пользователя"""
    user = db.get_user(message.from_user.id)
    
    if user:
        await message.answer(
            f"✅ Ты уже зарегистрирован!\n"
            f"Твой тег: <code>{user['player_tag']}</code>\n"
            f"Очки: {user['current_month_points']}\n\n"
            f"Используй /sync для синхронизации с Mini App",
            parse_mode="HTML"
        )
        return
    
    await message.answer(
        "📝 Отправь свой Player Tag из Clash Royale\n\n"
        "Формат: #ABC123 или ABC123\n"
        "Найти тег можно в профиле игры\n\n"
        "⚠️ Если у тебя нет Clash Royale, отправь любой тег для теста, например: #TEST123"
    )
    await state.set_state(Registration.waiting_for_tag)

@router.message(Registration.waiting_for_tag)
async def process_registration(message: Message, state: FSMContext):
    """Обработка регистрации"""
    player_tag = message.text.strip().upper()
    
    # Проверяем формат тега
    if not player_tag.startswith('#'):
        player_tag = '#' + player_tag
    
    # Проверяем, не занят ли тег
    existing_user = db.get_user_by_tag(player_tag)
    if existing_user:
        await message.answer(
            "❌ Этот тег уже зарегистрирован другим пользователем!\n"
            "Попробуй другой тег."
        )
        return
    
    # Проверяем через API (если тег не TEST)
    if not player_tag.startswith('#TEST'):
        msg = await message.answer("⏳ Проверяю тег через Clash Royale API...")
        
        player_data = cr_api.get_player(player_tag)
        
        if not player_data:
            await msg.edit_text(
                "❌ Не удалось найти игрока с таким тегом в Clash Royale API.\n\n"
                "Возможно:\n"
                "- Тег неправильный\n"
                "- API недоступен\n\n"
                "Попробуй еще раз или отправь #TEST123 для тестовой регистрации"
            )
            return
    else:
        # Тестовая регистрация
        player_data = {
            'name': message.from_user.first_name,
            'trophies': 5000,
            'expLevel': 13
        }
        msg = await message.answer("🧪 Тестовая регистрация...")
    
    # Регистрируем
    success = db.register_user(
        message.from_user.id,
        message.from_user.username,
        message.from_user.first_name,
        player_tag
    )
    
    if success:
        await msg.edit_text(
            f"✅ Регистрация успешна!\n\n"
            f"👤 Имя: {player_data.get('name', 'Unknown')}\n"
            f"🏆 Трофеи: {player_data.get('trophies', 0)}\n"
            f"🎖 Уровень: {player_data.get('expLevel', 0)}\n"
            f"🎮 Тег: <code>{player_tag}</code>\n\n"
            f"Теперь используй /sync чтобы синхронизировать данные с Mini App!",
            parse_mode="HTML"
        )
        
        logger.info(f"User {message.from_user.id} registered with tag {player_tag}")
    else:
        await msg.edit_text("❌ Ошибка регистрации. Попробуй позже.")
    
    await state.clear()

@router.message(Command("verify"))
async def cmd_verify(message: Message):
    """Проверка последней игры"""
    user = db.get_user(message.from_user.id)
    
    if not user:
        await message.answer("❌ Сначала зарегистрируйся: /register")
        return
    
    msg = await message.answer("⏳ Проверяю последнюю игру...")
    
    battle_data = cr_api.verify_battle(user['player_tag'])
    
    if not battle_data:
        await msg.edit_text("❌ Не найдено недавних боев (последние 30 минут)")
        return
    
    if 'error' in battle_data:
        await msg.edit_text(f"❌ {battle_data['error']}")
        return
    
    # Подсчитываем очки
    points = cr_api.calculate_points(battle_data)
    
    # Сохраняем игру
    db.add_game(message.from_user.id, battle_data, points)
    
    result_emoji = {
        'win': '🏆 Победа',
        'loss': '💔 Поражение',
        'draw': '🤝 Ничья'
    }
    
    # Обновляем данные пользователя
    user = db.get_user(message.from_user.id)
    
    await msg.edit_text(
        f"✅ Игра засчитана!\n\n"
        f"{result_emoji[battle_data['result']]}\n"
        f"👑 Короны: {battle_data['crowns']} - {battle_data['opponent_crowns']}\n"
        f"🎮 Режим: {battle_data['game_mode']}\n"
        f"🏟 Арена: {battle_data['arena']}\n"
        f"⭐ Получено очков: +{points}\n\n"
        f"💰 Всего очков в этом месяце: {user['current_month_points']}\n\n"
        f"💡 Используй /sync чтобы обновить данные в Mini App!"
    )

@router.message(Command("stats"))
async def cmd_stats(message: Message):
    """Статистика пользователя"""
    user = db.get_user(message.from_user.id)
    
    if not user:
        await message.answer("❌ Сначала зарегистрируйся: /register")
        return
    
    games = db.get_user_games(message.from_user.id, limit=1000)
    
    wins = sum(1 for g in games if g['result'] == 'win')
    losses = sum(1 for g in games if g['result'] == 'loss')
    draws = sum(1 for g in games if g['result'] == 'draw')
    
    stats_text = (
        f"📊 Твоя статистика\n\n"
        f"🎮 Player Tag: <code>{user['player_tag']}</code>\n"
        f"⭐ Очки в этом месяце: {user['current_month_points']}\n"
        f"🏅 Всего очков: {user['total_points']}\n\n"
        f"📈 Всего игр: {len(games)}\n"
        f"✅ Побед: {wins}\n"
        f"❌ Поражений: {losses}\n"
        f"🤝 Ничьих: {draws}\n"
        f"📊 Винрейт: {wins / len(games) * 100 if games else 0:.1f}%"
    )
    
    await message.answer(stats_text, parse_mode="HTML")

@router.message(Command("leaderboard"))
async def cmd_leaderboard(message: Message):
    """Таблица лидеров"""
    leaderboard = db.get_leaderboard(limit=10)
    
    if not leaderboard:
        await message.answer("📊 Таблица лидеров пока пуста")
        return
    
    text = "🏆 Топ-10 игроков месяца:\n\n"
    
    medals = ['🥇', '🥈', '🥉']
    
    for i, player in enumerate(leaderboard, 1):
        medal = medals[i-1] if i <= 3 else f"{i}."
        name = player['first_name'] or player['username'] or 'Аноним'
        text += f"{medal} {name} — ⭐ {player['current_month_points']}\n"
    
    await message.answer(text)

@router.message(Command("help"))
async def cmd_help(message: Message):
    """Помощь"""
    help_text = """
📖 <b>Команды бота:</b>

/start - Главное меню
/register - Регистрация по Player Tag
/sync - Синхронизация с Mini App
/verify - Проверить последнюю игру
/stats - Твоя статистика
/leaderboard - Топ-10 игроков
/help - Эта справка

<b>Как начать:</b>
1️⃣ /register - зарегистрируйся
2️⃣ /sync - открой Mini App
3️⃣ Сыграй в Clash Royale
4️⃣ /verify - проверь игру
5️⃣ /sync - обнови данные в Mini App

<b>Система очков:</b>
🏆 Победа: 10 очков
🤝 Ничья: 5 очков
💔 Поражение: 2 очка
👑 За корону: +2 очка
🔥 3-коронка: +10 бонус

<b>Множители режимов:</b>
⚔️ Ladder: x1.0
🎯 Challenge: x1.5
🏅 Tournament: x2.0
💎 Grand Challenge: x3.0
"""
    await message.answer(help_text, parse_mode="HTML")

# Callback handlers
@router.callback_query(F.data == "stats")
async def callback_stats(callback: CallbackQuery):
    await callback.answer()
    user = db.get_user(callback.from_user.id)
    
    if not user:
        await callback.message.answer("❌ Сначала зарегистрируйся: /register")
        return
    
    await cmd_stats(callback.message)

@router.callback_query(F.data == "leaderboard")
async def callback_leaderboard(callback: CallbackQuery):
    await callback.answer()
    await cmd_leaderboard(callback.message)

async def main():
    """Запуск бота"""
    dp.include_router(router)
    
    logger.info("✅ Bot started successfully!")
    logger.info(f"Mini App URL: {config.MINI_APP_URL}")
    await dp.start_polling(bot)

if __name__ == '__main__':
    asyncio.run(main())

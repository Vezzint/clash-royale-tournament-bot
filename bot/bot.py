import asyncio
import logging
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from datetime import datetime

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

class GameSubmission(StatesGroup):
    waiting_for_verification = State()

# Команды
@router.message(CommandStart())
async def cmd_start(message: Message):
    """Обработка /start"""
    user = db.get_user(message.from_user.id)
    
    # Формируем URL с параметрами
    mini_app_url = config.MINI_APP_URL
    if user:
        mini_app_url += f"?player_tag={user['player_tag']}&points={user['current_month_points']}&user_id={message.from_user.id}"
    
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🎮 Открыть Mini App",
            web_app=WebAppInfo(url=mini_app_url)
        )],
        [InlineKeyboardButton(text="📊 Статистика", callback_data="stats")],
        [InlineKeyboardButton(text="🏆 Таблица лидеров", callback_data="leaderboard")]
    ])
    
    if user:
        # Получаем позицию в рейтинге
        leaderboard = db.get_leaderboard(limit=1000)
        position = next((i for i, p in enumerate(leaderboard, 1) if p['user_id'] == message.from_user.id), None)
        
        await message.answer(
            f"👋 Привет, {message.from_user.first_name}!\n\n"
            f"🎮 Твой тег: <code>{user['player_tag']}</code>\n"
            f"⭐ Очки в этом месяце: {user['current_month_points']}\n"
            f"🏅 Всего очков: {user['total_points']}\n"
            f"📊 Позиция в рейтинге: {position if position else '-'}\n\n"
            f"Открывай Mini App для участия в турнирах!",
            reply_markup=keyboard,
            parse_mode="HTML"
        )
    else:
        await message.answer(
            "👋 Привет! Добро пожаловать в турнирный бот Clash Royale!\n\n"
            "🎮 Участвуй в соревнованиях и получай награды в конце месяца!\n\n"
            "Для начала зарегистрируйся командой /register",
            reply_markup=keyboard
        )


@router.message(Command("register"))
async def cmd_register(message: Message, state: FSMContext):
    """Регистрация пользователя"""
    user = db.get_user(message.from_user.id)
    
    if user:
        await message.answer(
            f"✅ Ты уже зарегистрирован!\n"
            f"Твой тег: <code>{user['player_tag']}</code>",
            parse_mode="HTML"
        )
        return
    
    await message.answer(
        "📝 Отправь свой Player Tag из Clash Royale\n\n"
        "Формат: #ABC123 или ABC123\n"
        "Найти тег можно в профиле игры"
    )
    await state.set_state(Registration.waiting_for_tag)

@router.message(Registration.waiting_for_tag)
async def process_registration(message: Message, state: FSMContext):
    """Обработка регистрации"""
    player_tag = message.text.strip().upper()
    
    # Проверяем формат тега
    if not player_tag.startswith('#'):
        player_tag = '#' + player_tag
    
    # Проверяем через API
    msg = await message.answer("⏳ Проверяю тег...")
    
    player_data = cr_api.get_player(player_tag)
    
    if not player_data:
        await msg.edit_text(
            "❌ Не удалось найти игрока с таким тегом.\n"
            "Проверь правильность и попробуй снова."
        )
        return
    
    # Проверяем, не занят ли тег
    existing_user = db.get_user_by_tag(player_tag)
    if existing_user:
        await msg.edit_text(
            "❌ Этот тег уже зарегистрирован другим пользователем!"
        )
        await state.clear()
        return
    
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
            f"🎖 Уровень: {player_data.get('expLevel', 0)}\n\n"
            f"Теперь открой Mini App чтобы начать играть!"
        )
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
    
    await msg.edit_text(
        f"✅ Игра засчитана!\n\n"
        f"{result_emoji[battle_data['result']]}\n"
        f"👑 Короны: {battle_data['crowns']} - {battle_data['opponent_crowns']}\n"
        f"🎮 Режим: {battle_data['game_mode']}\n"
        f"🏟 Арена: {battle_data['arena']}\n"
        f"⭐ Получено очков: +{points}\n\n"
        f"💰 Всего очков в этом месяце: {user['current_month_points'] + points}"
    )

@router.message(Command("stats"))
async def cmd_stats(message: Message):
    """Статистика пользователя"""
    user = db.get_user(message.from_user.id)
    
    if not user:
        await message.answer("❌ Сначала зарегистрируйся: /register")
        return
    
    games = db.get_user_games(message.from_user.id, limit=10)
    
    wins = sum(1 for g in games if g['result'] == 'win')
    losses = sum(1 for g in games if g['result'] == 'loss')
    
    stats_text = (
        f"📊 Твоя статистика\n\n"
        f"🎮 Player Tag: <code>{user['player_tag']}</code>\n"
        f"⭐ Очки в этом месяце: {user['current_month_points']}\n"
        f"🏅 Всего очков: {user['total_points']}\n\n"
        f"📈 Последние 10 игр:\n"
        f"✅ Побед: {wins}\n"
        f"❌ Поражений: {losses}\n"
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

# Callback handlers
@router.callback_query(F.data == "stats")
async def callback_stats(callback):
    await callback.answer()
    await cmd_stats(callback.message)

@router.callback_query(F.data == "leaderboard")
async def callback_leaderboard(callback):
    await callback.answer()
    await cmd_leaderboard(callback.message)

# Периодическая задача для сброса очков
async def monthly_reset_task():
    """Сброс очков в начале месяца"""
    while True:
        now = datetime.now()
        
        # Проверяем, первый ли день месяца и 00:00
        if now.day == 1 and now.hour == 0 and now.minute == 0:
            logger.info("Running monthly reset...")
            db.reset_monthly_points()
            await asyncio.sleep(60)  # Спим минуту чтобы не повторять
        
        await asyncio.sleep(60)  # Проверяем каждую минуту

async def main():
    """Запуск бота"""
    dp.include_router(router)
    
    # Запускаем фоновую задачу
    asyncio.create_task(monthly_reset_task())
    
    logger.info("Bot started!")
    await dp.start_polling(bot)

if __name__ == '__main__':
    asyncio.run(main())

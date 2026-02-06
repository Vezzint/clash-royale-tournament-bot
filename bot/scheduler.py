import asyncio
import logging
from datetime import datetime, timedelta
from database import Database
import config

logger = logging.getLogger(__name__)

class Scheduler:
    def __init__(self, db: Database, bot):
        self.db = db
        self.bot = bot
    
    async def start(self):
        """Запуск всех фоновых задач"""
        tasks = [
            self.monthly_reset_task(),
            self.monthly_rewards_task(),
            self.daily_stats_task()
        ]
        await asyncio.gather(*tasks)
    
    async def monthly_reset_task(self):
        """Сброс очков в начале месяца"""
        while True:
            now = datetime.now()
            
            # Проверяем первый день месяца в 00:00
            if now.day == 1 and now.hour == 0 and now.minute < 5:
                logger.info("🔄 Monthly reset started")
                self.db.reset_monthly_points()
                logger.info("✅ Monthly reset completed")
                await asyncio.sleep(300)  # 5 минут чтобы не повторять
            
            await asyncio.sleep(60)  # Проверка каждую минуту
    
    async def monthly_rewards_task(self):
        """Выдача наград в конце месяца"""
        while True:
            now = datetime.now()
            
            # Последний день месяца в 23:00
            if now.month == 12:
                next_month = datetime(now.year + 1, 1, 1)
            else:
                next_month = datetime(now.year, now.month + 1, 1)
            
            last_day = (next_month - timedelta(days=1)).day
            
            if now.day == last_day and now.hour == 23 and now.minute < 5:
                logger.info("🎁 Distributing monthly rewards")
                await self.distribute_rewards()
                await asyncio.sleep(300)
            
            await asyncio.sleep(60)
    
    async def distribute_rewards(self):
        """Распределение наград игрокам"""
        leaderboard = self.db.get_leaderboard(limit=100)
        current_month = datetime.now().strftime('%Y-%m')
        
        for idx, player in enumerate(leaderboard, 1):
            reward = None
            
            if idx == 1:
                reward = config.REWARDS[1]
            elif idx == 2:
                reward = config.REWARDS[2]
            elif idx == 3:
                reward = config.REWARDS[3]
            elif idx <= 10:
                reward = config.REWARDS['top10']
            
            if reward:
                # Сохраняем награду в БД
                self.db.save_reward(
                    player['user_id'],
                    current_month,
                    idx,
                    player['current_month_points'],
                    reward
                )
                
                # Отправляем уведомление
                try:
                    await self.bot.send_message(
                        player['user_id'],
                        f"🎉 Поздравляем!\n\n"
                        f"Ты занял {idx} место в турнире!\n"
                        f"🏆 {reward['title']}\n\n"
                        f"Награды:\n"
                        f"💎 {reward['gems']} Gems\n"
                        f"🪙 {reward['gold']} Gold\n\n"
                        f"⭐ Твои очки: {player['current_month_points']}"
                    )
                    logger.info(f"Reward sent to user {player['user_id']}")
                except Exception as e:
                    logger.error(f"Failed to send reward to {player['user_id']}: {e}")
    
    async def daily_stats_task(self):
        """Ежедневная статистика (опционально)"""
        while True:
            now = datetime.now()
            
            # Каждый день в полдень
            if now.hour == 12 and now.minute < 5:
                logger.info("📊 Generating daily stats")
                # Здесь можно добавить отправку статистики в канал
                await asyncio.sleep(300)
            
            await asyncio.sleep(60)

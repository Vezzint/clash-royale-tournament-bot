import sqlite3
from datetime import datetime, timedelta
import json

class Database:
    def __init__(self, db_path):
        self.db_path = db_path
        self.init_db()
    
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_db(self):
        """Инициализация базы данных"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Таблица пользователей
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                first_name TEXT,
                player_tag TEXT UNIQUE,
                registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_points INTEGER DEFAULT 0,
                current_month_points INTEGER DEFAULT 0,
                last_reset_month TEXT
            )
        ''')
        
        # Таблица игр
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                battle_time TIMESTAMP,
                game_mode TEXT,
                result TEXT,
                crowns INTEGER,
                opponent_crowns INTEGER,
                trophies_change INTEGER,
                verified BOOLEAN DEFAULT 0,
                points_earned INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        
        # Таблица месячных наград
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS monthly_rewards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                month TEXT,
                place INTEGER,
                points INTEGER,
                reward_data TEXT,
                claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        ''')
        
        # Таблица активных режимов
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS active_modes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mode_name TEXT,
                points_multiplier FLOAT DEFAULT 1.0,
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def register_user(self, user_id, username, first_name, player_tag):
        """Регистрация пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO users (user_id, username, first_name, player_tag, last_reset_month)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, username, first_name, player_tag, datetime.now().strftime('%Y-%m')))
            conn.commit()
            return True
        except sqlite3.IntegrityError:
            return False
        finally:
            conn.close()
    
    def get_user(self, user_id):
        """Получить данные пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
        user = cursor.fetchone()
        conn.close()
        return dict(user) if user else None
    
    def get_user_by_tag(self, player_tag):
        """Получить пользователя по тегу"""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM users WHERE player_tag = ?', (player_tag,))
        user = cursor.fetchone()
        conn.close()
        return dict(user) if user else None
    
    def add_game(self, user_id, battle_data, points_earned):
        """Добавить игру"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO games (user_id, battle_time, game_mode, result, crowns, 
                             opponent_crowns, trophies_change, verified, points_earned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            battle_data['battle_time'],
            battle_data['game_mode'],
            battle_data['result'],
            battle_data['crowns'],
            battle_data['opponent_crowns'],
            battle_data.get('trophies_change', 0),
            True,
            points_earned
        ))
        
        # Обновить очки пользователя
        cursor.execute('''
            UPDATE users 
            SET current_month_points = current_month_points + ?,
                total_points = total_points + ?
            WHERE user_id = ?
        ''', (points_earned, points_earned, user_id))
        
        conn.commit()
        conn.close()
    
    def get_leaderboard(self, limit=100):
        """Получить таблицу лидеров"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        current_month = datetime.now().strftime('%Y-%m')
        
        cursor.execute('''
            SELECT user_id, username, first_name, player_tag, 
                   current_month_points, total_points
            FROM users
            WHERE last_reset_month = ?
            ORDER BY current_month_points DESC
            LIMIT ?
        ''', (current_month, limit))
        
        leaderboard = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return leaderboard
    
    def reset_monthly_points(self):
        """Сброс очков в начале месяца"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        current_month = datetime.now().strftime('%Y-%m')
        
        cursor.execute('''
            UPDATE users 
            SET current_month_points = 0,
                last_reset_month = ?
            WHERE last_reset_month != ?
        ''', (current_month, current_month))
        
        conn.commit()
        conn.close()
    
    def get_user_games(self, user_id, limit=10):
        """Получить последние игры пользователя"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM games
            WHERE user_id = ?
            ORDER BY battle_time DESC
            LIMIT ?
        ''', (user_id, limit))
        
        games = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return games

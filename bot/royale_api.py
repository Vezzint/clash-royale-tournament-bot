import requests
from datetime import datetime, timedelta
import config

class ClashRoyaleAPI:
    def __init__(self, api_token):
        self.api_token = api_token
        self.base_url = 'https://api.clashroyale.com/v1'
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Accept': 'application/json'
        }
    
    def get_player(self, player_tag):
        """Получить информацию об игроке"""
        # Убираем # из тега если есть
        player_tag = player_tag.replace('#', '')
        player_tag = '%23' + player_tag
        
        url = f'{self.base_url}/players/{player_tag}'
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching player: {e}")
            return None
    
    def get_battle_log(self, player_tag):
        """Получить историю боев игрока"""
        player_tag = player_tag.replace('#', '')
        player_tag = '%23' + player_tag
        
        url = f'{self.base_url}/players/{player_tag}/battlelog'
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching battle log: {e}")
            return None
    
    def verify_battle(self, player_tag, expected_mode=None, time_window_minutes=30):
        """
        Проверить последнюю игру игрока
        Returns: dict с информацией о бое или None
        """
        battles = self.get_battle_log(player_tag)
        
        if not battles or len(battles) == 0:
            return None
        
        # Берем последний бой
        last_battle = battles[0]
        
        # Проверяем время боя (должен быть в пределах time_window_minutes)
        battle_time = datetime.strptime(last_battle['battleTime'], '%Y%m%dT%H%M%S.%fZ')
        now = datetime.utcnow()
        
        if now - battle_time > timedelta(minutes=time_window_minutes):
            return {'error': 'Battle too old', 'time_diff': (now - battle_time).seconds // 60}
        
        # Определяем результат и короны
        team = last_battle.get('team', [])
        opponent = last_battle.get('opponent', [])
        
        if not team or not opponent:
            return None
        
        player_data = team[0]
        opponent_data = opponent[0]
        
        player_crowns = player_data.get('crowns', 0)
        opponent_crowns = opponent_data.get('crowns', 0)
        
        if player_crowns > opponent_crowns:
            result = 'win'
        elif player_crowns < opponent_crowns:
            result = 'loss'
        else:
            result = 'draw'
        
        battle_data = {
            'battle_time': battle_time,
            'game_mode': last_battle.get('type', 'unknown'),
            'result': result,
            'crowns': player_crowns,
            'opponent_crowns': opponent_crowns,
            'trophies_change': player_data.get('trophyChange', 0),
            'arena': last_battle.get('arena', {}).get('name', 'Unknown'),
            'deck': [card.get('name') for card in player_data.get('cards', [])]
        }
        
        # Проверка режима если указан
        if expected_mode and battle_data['game_mode'] != expected_mode:
            battle_data['error'] = f"Wrong mode. Expected: {expected_mode}, Got: {battle_data['game_mode']}"
        
        return battle_data
    
    def calculate_points(self, battle_data):
        """Подсчет очков за бой"""
        points = 0
        
        # Базовые очки за результат
        if battle_data['result'] == 'win':
            points += 10
        elif battle_data['result'] == 'draw':
            points += 5
        else:
            points += 2  # Даже за поражение даем очки
        
        # Бонус за короны
        points += battle_data['crowns'] * 2
        
        # Бонус за трехкоронку
        if battle_data['crowns'] == 3:
            points += 10
        
        # Множитель за режим (можно настроить)
        mode_multipliers = {
            'PvP': 1.0,
            'challenge': 1.5,
            'tournament': 2.0,
            'grandChallenge': 3.0
        }
        
        multiplier = mode_multipliers.get(battle_data['game_mode'], 1.0)
        points = int(points * multiplier)
        
        return points

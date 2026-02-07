"""Assign ball possession to the nearest player in a frame."""

import sys 
sys.path.append('../')
from utils import get_center_of_bbox, measure_distance

class PlayerBallAssigner():
    def __init__(self):
        # Max distance (pixels) to consider a player as possessing the ball.
        self.max_player_ball_distance = 70
    
    def assign_ball_to_player(self,players,ball_bbox):
        # Choose the closest player to the ball center at this frame.
        ball_position = get_center_of_bbox(ball_bbox)

        miniumum_distance = 99999
        assigned_player=-1

        for player_id, player in players.items():
            player_bbox = player['bbox']

            # Compare ball distance to left/right foot positions.
            distance_left = measure_distance((player_bbox[0],player_bbox[-1]),ball_position)
            distance_right = measure_distance((player_bbox[2],player_bbox[-1]),ball_position)
            distance = min(distance_left,distance_right)

            if distance < self.max_player_ball_distance:
                if distance < miniumum_distance:
                    miniumum_distance = distance
                    assigned_player = player_id

        return assigned_player

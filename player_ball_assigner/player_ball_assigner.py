import numpy as np


class PlayerBallAssigner:
    def __init__(self):
        self.max_player_ball_distance = 70

    def get_center(self, bbox):
        """Get center point of bounding box."""
        return (int((bbox[0] + bbox[2]) / 2), int((bbox[1] + bbox[3]) / 2))

    def get_foot_position(self, bbox):
        """Get position of player's feet (bottom center of bbox)."""
        return (int((bbox[0] + bbox[2]) / 2), int(bbox[3]))

    def calculate_distance(self, p1, p2):
        """Calculate Euclidean distance between two points."""
        return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

    def assign_ball_to_player(self, players, ball_bbox):
        """Find which player has the ball."""
        if not ball_bbox:
            return -1

        ball_center = self.get_center(ball_bbox)

        min_distance = float('inf')
        assigned_player = -1

        for player_id, player in players.items():
            player_bbox = player["bbox"]
            foot_position = self.get_foot_position(player_bbox)

            distance = self.calculate_distance(ball_center, foot_position)

            if distance < self.max_player_ball_distance and distance < min_distance:
                min_distance = distance
                assigned_player = player_id

        return assigned_player

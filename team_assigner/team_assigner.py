from sklearn.cluster import KMeans
import numpy as np


class TeamAssigner:
    def __init__(self):
        self.team_colors = {}
        self.player_team_dict = {}
        self.kmeans = None

    def get_clustering_model(self, image):
        """Create KMeans model from image pixels."""
        # Reshape to 2D array of pixels
        image_2d = image.reshape(-1, 3)

        # Perform KMeans with 2 clusters (2 teams)
        kmeans = KMeans(n_clusters=2, init='k-means++', n_init=1)
        kmeans.fit(image_2d)

        return kmeans

    def get_player_color(self, frame, bbox):
        """Extract dominant color from player's jersey area."""
        # Crop player from frame
        x1, y1, x2, y2 = map(int, bbox)
        player_img = frame[y1:y2, x1:x2]

        # Get top half (jersey area)
        height = player_img.shape[0]
        top_half = player_img[0:int(height / 2), :]

        # Get clustering model
        kmeans = self.get_clustering_model(top_half)

        # Get cluster labels for each pixel
        labels = kmeans.labels_

        # Reshape labels to image shape
        clustered_image = labels.reshape(top_half.shape[0], top_half.shape[1])

        # Get corner clusters (background)
        corner_clusters = [
            clustered_image[0, 0],
            clustered_image[0, -1],
            clustered_image[-1, 0],
            clustered_image[-1, -1]
        ]
        non_player_cluster = max(set(corner_clusters), key=corner_clusters.count)
        player_cluster = 1 - non_player_cluster

        # Get player color
        player_color = kmeans.cluster_centers_[player_cluster]

        return player_color

    def assign_team_color(self, frame, player_detections):
        """Assign team colors based on clustering all player colors."""
        player_colors = []

        for _, player_detection in player_detections.items():
            bbox = player_detection["bbox"]
            try:
                player_color = self.get_player_color(frame, bbox)
                player_colors.append(player_color)
            except:
                continue

        if len(player_colors) < 2:
            return

        # Cluster player colors into 2 teams
        kmeans = KMeans(n_clusters=2, init='k-means++', n_init=10)
        kmeans.fit(player_colors)

        self.kmeans = kmeans
        self.team_colors[1] = kmeans.cluster_centers_[0]
        self.team_colors[2] = kmeans.cluster_centers_[1]

    def get_player_team(self, frame, player_bbox, player_id):
        """Determine which team a player belongs to."""
        if player_id in self.player_team_dict:
            return self.player_team_dict[player_id]

        try:
            player_color = self.get_player_color(frame, player_bbox)
            team_id = self.kmeans.predict(player_color.reshape(1, -1))[0]
            team_id += 1  # Teams are 1 and 2, not 0 and 1

            self.player_team_dict[player_id] = team_id
            return team_id
        except:
            return 1  # Default to team 1 on error

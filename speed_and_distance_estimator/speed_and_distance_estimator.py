import cv2
import numpy as np


class SpeedAndDistanceEstimator:
    def __init__(self, fps=24):
        self.fps = fps
        self.frame_window = 5  # Calculate speed over this many frames

    def calculate_distance(self, p1, p2):
        """Calculate Euclidean distance between two points in meters."""
        if p1 is None or p2 is None:
            return 0
        return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

    def add_speed_and_distance_to_tracks(self, tracks):
        """Calculate and add speed/distance to all tracked objects."""
        total_distance = {}

        for object_type, object_tracks in tracks.items():
            if object_type == "ball" or object_type == "referees":
                continue

            num_frames = len(object_tracks)

            for frame_num in range(0, num_frames, self.frame_window):
                last_frame = min(frame_num + self.frame_window, num_frames - 1)

                for track_id in object_tracks[frame_num].keys():
                    if track_id not in object_tracks[last_frame]:
                        continue

                    start_position = object_tracks[frame_num][track_id].get("position")
                    end_position = object_tracks[last_frame][track_id].get("position")

                    if start_position is None or end_position is None:
                        continue

                    distance = self.calculate_distance(start_position, end_position)
                    time_elapsed = (last_frame - frame_num) / self.fps
                    speed = distance / time_elapsed if time_elapsed > 0 else 0
                    speed_kmh = speed * 3.6  # Convert m/s to km/h

                    # Update total distance
                    if object_type not in total_distance:
                        total_distance[object_type] = {}
                    if track_id not in total_distance[object_type]:
                        total_distance[object_type][track_id] = 0
                    total_distance[object_type][track_id] += distance

                    # Add to tracks
                    for frame_idx in range(frame_num, last_frame + 1):
                        if track_id in tracks[object_type][frame_idx]:
                            tracks[object_type][frame_idx][track_id]["speed"] = speed_kmh
                            tracks[object_type][frame_idx][track_id]["distance"] = \
                                total_distance[object_type][track_id]

        return tracks

    def draw_speed_and_distance(self, frame, tracks, frame_num):
        """Draw speed and distance annotations on frame."""
        for track_id, track_info in tracks["players"][frame_num].items():
            speed = track_info.get("speed")
            distance = track_info.get("distance")

            if speed is None or distance is None:
                continue

            bbox = track_info["bbox"]
            x = int(bbox[0])
            y = int(bbox[1]) - 10

            cv2.putText(frame, f"{speed:.1f}km/h", (x, y - 20),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            cv2.putText(frame, f"{distance:.1f}m", (x, y),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        return frame

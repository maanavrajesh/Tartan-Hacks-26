import cv2
import numpy as np
import pickle
import os


class CameraMovementEstimator:
    def __init__(self, frame):
        self.minimum_distance = 5
        self.lk_params = dict(
            winSize=(15, 15),
            maxLevel=2,
            criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 10, 0.03)
        )

        # Create mask for feature detection (edges of frame)
        first_frame_grayscale = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mask_features = np.zeros_like(first_frame_grayscale)
        mask_features[:, 0:20] = 1  # Left edge
        mask_features[:, -20:] = 1  # Right edge

        self.features = dict(
            maxCorners=100,
            qualityLevel=0.3,
            minDistance=3,
            blockSize=7,
            mask=mask_features
        )

    def get_camera_movement(self, frames, read_from_stub=False, stub_path=None):
        """Estimate camera movement between consecutive frames using optical flow."""
        if read_from_stub and stub_path and os.path.exists(stub_path):
            with open(stub_path, 'rb') as f:
                return pickle.load(f)

        camera_movement = [[0, 0]] * len(frames)

        old_gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
        old_features = cv2.goodFeaturesToTrack(old_gray, **self.features)

        for frame_num in range(1, len(frames)):
            frame_gray = cv2.cvtColor(frames[frame_num], cv2.COLOR_BGR2GRAY)

            if old_features is None or len(old_features) == 0:
                old_features = cv2.goodFeaturesToTrack(old_gray, **self.features)
                if old_features is None:
                    continue

            new_features, status, _ = cv2.calcOpticalFlowPyrLK(
                old_gray, frame_gray, old_features, None, **self.lk_params
            )

            if new_features is None:
                continue

            max_distance = 0
            camera_movement_x, camera_movement_y = 0, 0

            for i, (new, old) in enumerate(zip(new_features, old_features)):
                if status[i]:
                    new_point = new.ravel()
                    old_point = old.ravel()

                    distance = np.sqrt((new_point[0] - old_point[0])**2 +
                                      (new_point[1] - old_point[1])**2)

                    if distance > max_distance:
                        max_distance = distance
                        camera_movement_x = new_point[0] - old_point[0]
                        camera_movement_y = new_point[1] - old_point[1]

            if max_distance > self.minimum_distance:
                camera_movement[frame_num] = [camera_movement_x, camera_movement_y]

            old_gray = frame_gray.copy()
            old_features = cv2.goodFeaturesToTrack(old_gray, **self.features)

        if stub_path:
            with open(stub_path, 'wb') as f:
                pickle.dump(camera_movement, f)

        return camera_movement

    def adjust_positions_for_camera_movement(self, tracks, camera_movement):
        """Adjust tracked positions to compensate for camera movement."""
        for object_type, object_tracks in tracks.items():
            for frame_num, track in enumerate(object_tracks):
                for track_id, track_info in track.items():
                    bbox = track_info["bbox"]
                    adjusted_bbox = [
                        bbox[0] - camera_movement[frame_num][0],
                        bbox[1] - camera_movement[frame_num][1],
                        bbox[2] - camera_movement[frame_num][0],
                        bbox[3] - camera_movement[frame_num][1]
                    ]
                    tracks[object_type][frame_num][track_id]["adjusted_bbox"] = adjusted_bbox

        return tracks

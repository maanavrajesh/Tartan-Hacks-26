import torch
# Fix for PyTorch 2.6+ - patch torch.load before importing YOLO
_original_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _patched_load

from ultralytics import YOLO
import supervision as sv
import pickle
import os
import cv2
import numpy as np
import pandas as pd
from tqdm import tqdm


class Tracker:
    def __init__(self, model_path):
        self.model = YOLO(model_path)
<<<<<<< Updated upstream
        # Tune ByteTrack for more stable track IDs
        self.tracker = sv.ByteTrack(
            lost_track_buffer=60,        # Keep lost tracks for 60 frames (was 30)
            track_activation_threshold=0.2,  # Lower threshold to keep tracks
            minimum_matching_threshold=0.7,  # Lower IOU threshold for matching
            frame_rate=30                 # Assume 30 fps
        )
=======
        self.tracker = sv.ByteTrack()
>>>>>>> Stashed changes

    def detect_frames(self, frames):
        """Run detection on all frames."""
        batch_size = 20
        detections = []
        total_batches = (len(frames) + batch_size - 1) // batch_size

        for i in tqdm(range(0, len(frames), batch_size), total=total_batches, desc="Detecting"):
            batch = frames[i:i + batch_size]
            detections_batch = self.model.predict(batch, conf=0.1, verbose=False)
            detections.extend(detections_batch)
        return detections

<<<<<<< Updated upstream
    def get_object_tracks(self, frames, read_from_stub=False, stub_path=None):
        """Get tracked objects across all frames."""
=======

    def get_object_tracks(self, frames, read_from_stub=False, stub_path=None):
        """Get tracked objects across all frames using YOLO's built-in tracker."""
>>>>>>> Stashed changes
        if read_from_stub and stub_path and os.path.exists(stub_path):
            with open(stub_path, 'rb') as f:
                return pickle.load(f)

<<<<<<< Updated upstream
        detections = self.detect_frames(frames)

=======
>>>>>>> Stashed changes
        tracks = {
            "players": [],
            "referees": [],
            "ball": []
        }

<<<<<<< Updated upstream
        for frame_num, detection in enumerate(detections):
            cls_names = detection.names
            cls_names_inv = {v: k for k, v in cls_names.items()}

            # Convert to supervision Detection
            detection_sv = sv.Detections.from_ultralytics(detection)

            # Track objects
            detection_with_tracks = self.tracker.update_with_detections(detection_sv)
=======
        # Use YOLO's built-in tracking (BoT-SORT by default)
        for frame_num, frame in tqdm(enumerate(frames), total=len(frames), desc="Tracking"):
            # Use .track() for built-in tracking with persistent IDs
            results = self.model.track(frame, conf=0.2, persist=True, verbose=False)
>>>>>>> Stashed changes

            tracks["players"].append({})
            tracks["referees"].append({})
            tracks["ball"].append({})

<<<<<<< Updated upstream
            for frame_detection in detection_with_tracks:
                bbox = frame_detection[0].tolist()
                cls_id = frame_detection[3]
                track_id = frame_detection[4]

                # Support both custom model (player) and COCO model (person)
                player_cls = cls_names_inv.get('player', cls_names_inv.get('person', -1))
                if cls_id == player_cls:
                    tracks["players"][frame_num][track_id] = {"bbox": bbox}

                if cls_id == cls_names_inv.get('referee', -1):
                    tracks["referees"][frame_num][track_id] = {"bbox": bbox}

            for frame_detection in detection_sv:
                bbox = frame_detection[0].tolist()
                cls_id = frame_detection[3]

                # Support both custom model (ball) and COCO model (sports ball)
                ball_cls = cls_names_inv.get('ball', cls_names_inv.get('sports ball', -1))
                if cls_id == ball_cls:
                    tracks["ball"][frame_num][1] = {"bbox": bbox}

        if stub_path:
=======
            if results and len(results) > 0:
                result = results[0]
                cls_names = result.names
                cls_names_inv = {v: k for k, v in cls_names.items()}

                if result.boxes is not None and result.boxes.id is not None:
                    boxes = result.boxes.xyxy.cpu().numpy()
                    class_ids = result.boxes.cls.cpu().numpy().astype(int)
                    track_ids = result.boxes.id.cpu().numpy().astype(int)

                    for bbox, cls_id, track_id in zip(boxes, class_ids, track_ids):
                        bbox_list = bbox.tolist()

                        # Support both custom model (player) and COCO model (person)
                        player_cls = cls_names_inv.get('player', cls_names_inv.get('person', -1))
                        if cls_id == player_cls:
                            tracks["players"][frame_num][track_id] = {"bbox": bbox_list}

                        if cls_id == cls_names_inv.get('referee', -1):
                            tracks["referees"][frame_num][track_id] = {"bbox": bbox_list}

                        # Support both custom model (ball) and COCO model (sports ball)
                        ball_cls = cls_names_inv.get('ball', cls_names_inv.get('sports ball', -1))
                        if cls_id == ball_cls:
                            tracks["ball"][frame_num][track_id] = {"bbox": bbox_list}

        if stub_path:
            os.makedirs(os.path.dirname(stub_path), exist_ok=True)
>>>>>>> Stashed changes
            with open(stub_path, 'wb') as f:
                pickle.dump(tracks, f)

        return tracks

    def draw_ellipse(self, frame, bbox, color, track_id=None):
        """Draw ellipse under detected object."""
        y2 = int(bbox[3])
        x_center = int((bbox[0] + bbox[2]) / 2)
        width = int(bbox[2] - bbox[0])

        cv2.ellipse(
            frame,
            center=(x_center, y2),
            axes=(int(width / 2), int(0.35 * width / 2)),
            angle=0.0,
            startAngle=-45,
            endAngle=235,
            color=color,
            thickness=2,
            lineType=cv2.LINE_4
        )

        if track_id is not None:
            rect_width = 40
            rect_height = 20
            x1_rect = x_center - rect_width // 2
            x2_rect = x_center + rect_width // 2
            y1_rect = y2 - rect_height // 2 + 15
            y2_rect = y2 + rect_height // 2 + 15

            cv2.rectangle(frame, (x1_rect, y1_rect), (x2_rect, y2_rect), color, cv2.FILLED)
            cv2.putText(frame, str(track_id), (x1_rect + 10, y1_rect + 15),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)

        return frame

    def draw_triangle(self, frame, bbox, color):
        """Draw triangle marker for ball."""
        y = int(bbox[1])
        x = int((bbox[0] + bbox[2]) / 2)

        triangle_points = np.array([
            [x, y],
            [x - 10, y - 20],
            [x + 10, y - 20]
        ])

        cv2.drawContours(frame, [triangle_points], 0, color, cv2.FILLED)
        cv2.drawContours(frame, [triangle_points], 0, (0, 0, 0), 2)

        return frame

    def draw_annotations(self, video_frames, tracks, team_ball_control=None):
        """Draw all tracking annotations on frames."""
        output_frames = []

        for frame_num, frame in tqdm(enumerate(video_frames), total=len(video_frames), desc="Drawing"):
            frame = frame.copy()

            player_dict = tracks["players"][frame_num]
            referee_dict = tracks["referees"][frame_num]
            ball_dict = tracks["ball"][frame_num]

            # Draw players
            for track_id, player in player_dict.items():
                color = player.get("team_color", (0, 0, 255))
                frame = self.draw_ellipse(frame, player["bbox"], color, track_id)

                if player.get("has_ball", False):
                    frame = self.draw_triangle(frame, player["bbox"], (0, 255, 255))

            # Draw referees
            for track_id, referee in referee_dict.items():
                frame = self.draw_ellipse(frame, referee["bbox"], (0, 255, 255))

            # Draw ball
            for track_id, ball in ball_dict.items():
                frame = self.draw_triangle(frame, ball["bbox"], (0, 255, 0))

            # Draw team ball control stats
            if team_ball_control is not None and frame_num < len(team_ball_control):
                frame = self.draw_team_ball_control(frame, frame_num, team_ball_control)

            output_frames.append(frame)

        return output_frames

    def draw_team_ball_control(self, frame, frame_num, team_ball_control):
        """Draw ball control statistics overlay."""
        overlay = frame.copy()
        cv2.rectangle(overlay, (1350, 850), (1900, 970), (255, 255, 255), cv2.FILLED)
        alpha = 0.4
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)

        team_control_till_frame = team_ball_control[:frame_num + 1]
        team_1_num = team_control_till_frame[team_control_till_frame == 1].shape[0]
        team_2_num = team_control_till_frame[team_control_till_frame == 2].shape[0]

        total = team_1_num + team_2_num
        if total > 0:
            team_1_pct = team_1_num / total
            team_2_pct = team_2_num / total
        else:
            team_1_pct = team_2_pct = 0.5

        cv2.putText(frame, f"Team 1 Ball Control: {team_1_pct * 100:.1f}%",
                   (1400, 900), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 3)
        cv2.putText(frame, f"Team 2 Ball Control: {team_2_pct * 100:.1f}%",
                   (1400, 950), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 3)

        return frame

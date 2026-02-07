"""
Football Analysis System
Detects and tracks players, referees, and ball in football match videos.
Calculates team ball possession, player speeds, and distances covered.
"""

import os
# Fix for PyTorch 2.6+ weights_only default change
os.environ["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "0"

import argparse
import numpy as np

from utils import read_video, save_video
from trackers import Tracker
from team_assigner import TeamAssigner
from player_ball_assigner import PlayerBallAssigner
from camera_movement_estimator import CameraMovementEstimator
from view_transformer import ViewTransformer
from speed_and_distance_estimator import SpeedAndDistanceEstimator


def main():
    parser = argparse.ArgumentParser(description="Football Match Analysis")
    parser.add_argument("video", help="Path to input video file")
    parser.add_argument("--model", default="yolov8n.pt",
                        help="Path to YOLO model (default: yolov8n.pt)")
    # Default output to Downloads folder
    default_output = os.path.join(os.path.expanduser("~"), "Downloads", "analyzed_video.avi")
    parser.add_argument("--output", default=default_output,
                        help=f"Path to output video (default: {default_output})")
    parser.add_argument("--use-stubs", action="store_true",
                        help="Use cached tracking data if available")
    args = parser.parse_args()

    # Read video frames
    print(f"Reading video: {args.video}")
    video_frames = read_video(args.video)
    print(f"Loaded {len(video_frames)} frames")

    # Initialize tracker and get object tracks
    print("Initializing tracker...")
    tracker = Tracker(args.model)

    tracks = tracker.get_object_tracks(
        video_frames,
        read_from_stub=args.use_stubs,
        stub_path="stubs/track_stubs.pkl"
    )
    print("Tracking complete")

    # Estimate camera movement
    print("Estimating camera movement...")
    camera_movement_estimator = CameraMovementEstimator(video_frames[0])
    camera_movement = camera_movement_estimator.get_camera_movement(
        video_frames,
        read_from_stub=args.use_stubs,
        stub_path="stubs/camera_movement_stubs.pkl"
    )

    # Adjust positions for camera movement
    tracks = camera_movement_estimator.adjust_positions_for_camera_movement(
        tracks, camera_movement
    )

    # Initialize view transformer (optional - requires manual court corner setup)
    view_transformer = ViewTransformer()
    # To enable perspective transform, set court corners:
    # view_transformer.set_court_vertices([(x1,y1), (x2,y2), (x3,y3), (x4,y4)])
    # tracks = view_transformer.add_transformed_positions_to_tracks(tracks)

    # Calculate speed and distance
    speed_estimator = SpeedAndDistanceEstimator()
    tracks = speed_estimator.add_speed_and_distance_to_tracks(tracks)

    # Assign teams based on jersey colors
    print("Assigning teams...")
    team_assigner = TeamAssigner()
    team_assigner.assign_team_color(video_frames[0], tracks["players"][0])

    for frame_num, player_track in enumerate(tracks["players"]):
        for player_id, track in player_track.items():
            team = team_assigner.get_player_team(
                video_frames[frame_num],
                track["bbox"],
                player_id
            )
            tracks["players"][frame_num][player_id]["team"] = team
            tracks["players"][frame_num][player_id]["team_color"] = \
                team_assigner.team_colors.get(team, (0, 0, 255))

    # Assign ball possession
    print("Calculating ball possession...")
    player_ball_assigner = PlayerBallAssigner()
    team_ball_control = []

    for frame_num, player_track in enumerate(tracks["players"]):
        ball_bbox = tracks["ball"][frame_num].get(1, {}).get("bbox")
        assigned_player = player_ball_assigner.assign_ball_to_player(player_track, ball_bbox)

        if assigned_player != -1:
            tracks["players"][frame_num][assigned_player]["has_ball"] = True
            team = tracks["players"][frame_num][assigned_player].get("team", 1)
            team_ball_control.append(team)
        else:
            # Keep previous team control
            team_ball_control.append(team_ball_control[-1] if team_ball_control else 1)

    team_ball_control = np.array(team_ball_control)

    # Draw annotations
    print("Drawing annotations...")
    output_frames = tracker.draw_annotations(video_frames, tracks, team_ball_control)

    # Add speed and distance to output
    for frame_num, frame in enumerate(output_frames):
        output_frames[frame_num] = speed_estimator.draw_speed_and_distance(
            frame, tracks, frame_num
        )

    # Save output video
    print(f"Saving output to: {args.output}")
    save_video(output_frames, args.output)

    print("Analysis complete!")


if __name__ == "__main__":
    main()

import cv2
import numpy as np


class ViewTransformer:
    def __init__(self):
        # Default court dimensions in meters
        self.court_width = 68  # meters
        self.court_length = 105  # meters

        # Pixel vertices (to be set based on video)
        self.pixel_vertices = None
        # Target vertices in meters
        self.target_vertices = None
        self.perspective_transformer = None

    def set_court_vertices(self, pixel_vertices):
        """
        Set the four corners of the court in pixel coordinates.
        pixel_vertices: List of 4 points [(x1,y1), (x2,y2), (x3,y3), (x4,y4)]
        Order: top-left, top-right, bottom-right, bottom-left
        """
        self.pixel_vertices = np.array(pixel_vertices, dtype=np.float32)

        # Target is the actual court dimensions
        self.target_vertices = np.array([
            [0, 0],
            [self.court_width, 0],
            [self.court_width, self.court_length],
            [0, self.court_length]
        ], dtype=np.float32)

        # Calculate perspective transform matrix
        self.perspective_transformer = cv2.getPerspectiveTransform(
            self.pixel_vertices,
            self.target_vertices
        )

    def transform_point(self, point):
        """Transform a point from pixel coordinates to real-world meters."""
        if self.perspective_transformer is None:
            return None

        point = np.array(point, dtype=np.float32).reshape(-1, 1, 2)
        transformed = cv2.perspectiveTransform(point, self.perspective_transformer)

        return transformed.reshape(-1, 2)

    def transform_bbox_to_position(self, bbox):
        """Get real-world position from bounding box (uses foot position)."""
        foot_position = (int((bbox[0] + bbox[2]) / 2), int(bbox[3]))
        return self.transform_point(foot_position)

    def add_transformed_positions_to_tracks(self, tracks):
        """Add real-world positions to all tracked objects."""
        if self.perspective_transformer is None:
            return tracks

        for object_type, object_tracks in tracks.items():
            for frame_num, track in enumerate(object_tracks):
                for track_id, track_info in track.items():
                    bbox = track_info.get("adjusted_bbox", track_info["bbox"])
                    position = self.transform_bbox_to_position(bbox)

                    if position is not None:
                        tracks[object_type][frame_num][track_id]["position"] = position[0].tolist()
                    else:
                        tracks[object_type][frame_num][track_id]["position"] = None

        return tracks

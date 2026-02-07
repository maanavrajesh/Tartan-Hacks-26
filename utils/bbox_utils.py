import numpy as np


def get_center(bbox):
    """Get center point of bounding box."""
    return (int((bbox[0] + bbox[2]) / 2), int((bbox[1] + bbox[3]) / 2))


def get_foot_position(bbox):
    """Get foot position (bottom center) of bounding box."""
    return (int((bbox[0] + bbox[2]) / 2), int(bbox[3]))


def get_bbox_width(bbox):
    """Get width of bounding box."""
    return bbox[2] - bbox[0]


def get_distance(p1, p2):
    """Calculate Euclidean distance between two points."""
    return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

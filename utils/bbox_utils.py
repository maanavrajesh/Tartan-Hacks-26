"""Bounding box geometry helpers for tracking and visualization."""

def get_center_of_bbox(bbox):
    # Return center point (x, y) of a bounding box.
    x1,y1,x2,y2 = bbox
    return int((x1+x2)/2),int((y1+y2)/2)

def get_bbox_width(bbox):
    # Return width of a bounding box in pixels.
    return bbox[2]-bbox[0]

def measure_distance(p1,p2):
    # Euclidean distance between two 2D points.
    return ((p1[0]-p2[0])**2 + (p1[1]-p2[1])**2)**0.5

def measure_xy_distance(p1,p2):
    # Signed x/y deltas between two points.
    return p1[0]-p2[0],p1[1]-p2[1]

def get_foot_position(bbox):
    # Approximate foot position as bottom center of the box.
    x1,y1,x2,y2 = bbox
    return int((x1+x2)/2),int(y2)

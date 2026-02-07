# VisionXI Football Analysis


python main.py --video "C:\path\to\your\video.mp4" --output "output_videos\output_video.avi"

## Introduction
VisionXI detects and tracks players, referees, and the ball in football footage using YOLO. It assigns teams based on jersey colors (K-Means clustering), measures ball possession, estimates camera motion (optical flow), and applies a perspective transform to convert movement into real-world distances. It also computes player speed and distance covered for match analysis.

![Screenshot](output_videos/screenshot.png)

## Modules Used
The following modules are used in this project:
- YOLO: AI object detection model
- Kmeans: Pixel segmentation and clustering to detect t-shirt color
- Optical Flow: Measure camera movement
- Perspective Transformation: Represent scene depth and perspective
- Speed and distance calculation per player

## Trained Models
- [Trained Yolo v5](https://drive.google.com/file/d/1DC2kCygbBWUKheQ_9cFziCsYVSRw6axK/view?usp=sharing)

## Sample video
-  [Sample input video](https://drive.google.com/file/d/1t6agoqggZKx6thamUuPAIdN_1zR9v9S_/view?usp=sharing)

## Requirements
To run this project, you need to have the following requirements installed:
- Python 3.x
- ultralytics
- supervision
- OpenCV
- NumPy
- Matplotlib
- Pandas

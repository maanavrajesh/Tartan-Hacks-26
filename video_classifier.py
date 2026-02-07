"""
Video Classification using Ultralytics YOLO
Processes an MP4 video and performs image classification on each frame.
"""

from ultralytics import YOLO
import argparse


def main():
    parser = argparse.ArgumentParser(description="Classify video frames using Ultralytics YOLO")
    parser.add_argument("video", help="Path to the input MP4 video file")
    parser.add_argument("--model", default="yolov8n-cls.pt",
                        help="Classification model (default: yolov8n-cls.pt)")
    args = parser.parse_args()

    # Load classification model
    model = YOLO(args.model)

    # Run prediction on video - ultralytics handles everything
    # stream=True for memory efficiency, show=True to display results
    results = model.predict(source=args.video, stream=True, show=True)

    # Iterate through results (required when using stream=True)
    for result in results:
        # Results are processed frame by frame
        if result.probs is not None:
            top1_label = result.names[result.probs.top1]
            top1_conf = result.probs.top1conf.item()
            print(f"{top1_label}: {top1_conf:.2%}")


if __name__ == "__main__":
    main()

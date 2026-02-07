"""Minimal script to run YOLO inference on a single video."""

from ultralytics import YOLO 

# Load the trained model weights.
model = YOLO('models/best.pt')

# Run inference and save annotated output to disk.
results = model.predict('input_videos/08fd33_4.mp4',save=True)
print(results[0])
print('=====================================')
for box in results[0].boxes:
    # Print per-box diagnostics.
    print(box)

import cv2


def read_video(video_path):
    """Read video and return list of frames."""
    cap = cv2.VideoCapture(video_path)
    frames = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)

    cap.release()
    return frames


def save_video(frames, output_path, fps=24):
    """Save frames as video file."""
    if not frames:
        return

    height, width = frames[0].shape[:2]

    # Use XVID codec for AVI (more compatible on Windows)
    if output_path.endswith('.avi'):
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
    else:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')

    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    for frame in frames:
        out.write(frame)

    out.release()
    print(f"\nVideo saved to: {output_path}")
    print("You can open this file with Windows Media Player or VLC.")

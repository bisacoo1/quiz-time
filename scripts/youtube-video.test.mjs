import test from "node:test";
import assert from "node:assert/strict";

import { normalizeYouTubeVideoUrl } from "../src/lib/youtube-video.ts";

test("normalizes supported YouTube video URL forms", () => {
  const expected = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  for (const value of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    "https://youtu.be/dQw4w9WgXcQ?si=share",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://m.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ",
  ]) {
    assert.equal(normalizeYouTubeVideoUrl(value), expected, value);
  }
});

test("rejects malformed, non-YouTube, and invalid video links", () => {
  for (const value of [
    "not a URL",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "ftp://youtu.be/dQw4w9WgXcQ",
  ]) {
    assert.equal(normalizeYouTubeVideoUrl(value), null, value);
  }
});

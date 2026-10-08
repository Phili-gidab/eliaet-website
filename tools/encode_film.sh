#!/usr/bin/env bash
# Encode a rendered PNG sequence into the web film set (AV1 / HEVC / VP9 / H.264) plus poster stills.
#   encode_film.sh <frames_dir> <out_dir> <name> <W> <H> [fps] [small_W] [small_H]
# e.g. encode_film.sh blender/renders/hero_v2_desktop blender/film hero 1600 900 25 960 540
#      encode_film.sh blender/renders/hero_v2_mobile  blender/film hero-m 900 1600 25 540 960
set -euo pipefail
IN=$1; OUT=$2; NAME=$3; W=$4; H=$5; FPS=${6:-25}; SW=${7:-0}; SH=${8:-0}
mkdir -p "$OUT"
SEQ=(-framerate "$FPS" -i "$IN/f_%04d.png")
COMMON=(-an -pix_fmt yuv420p -movflags +faststart)
enc() { # size label W H crf(h264)
  local L=$1 w=$2 h=$3 crf=$4 VF="scale=$2:$3:flags=lanczos,format=yuv420p"
  echo "== $NAME $L ($w x $h)"
  ffmpeg -hide_banner -loglevel error -y "${SEQ[@]}" -vf "$VF" -c:v libx264 -preset slow -crf "$crf" -profile:v high -tune film "${COMMON[@]}" "$OUT/$NAME$L.mp4"
  ffmpeg -hide_banner -loglevel error -y "${SEQ[@]}" -vf "$VF" -c:v libvpx-vp9 -b:v 0 -crf 34 -row-mt 1 -deadline good -cpu-used 3 -an -pix_fmt yuv420p "$OUT/$NAME$L.webm"
  ffmpeg -hide_banner -loglevel error -y "${SEQ[@]}" -vf "$VF" -c:v libx265 -preset medium -crf 23 -tag:v hvc1 -x265-params log-level=error "${COMMON[@]}" "$OUT/$NAME$L-hevc.mp4"
  ffmpeg -hide_banner -loglevel error -y "${SEQ[@]}" -vf "$VF" -c:v libaom-av1 -crf 34 -b:v 0 -cpu-used 7 -row-mt 1 -tiles 2x2 "${COMMON[@]}" "$OUT/$NAME$L-av1.mp4"
}
enc "-$W" "$W" "$H" 22
if [ "$SW" != "0" ]; then enc "-$SW" "$SW" "$SH" 23; fi
# posters: the first frame (the loop's start) at full and small size
ffmpeg -hide_banner -loglevel error -y -i "$IN/f_0001.png" -vf "scale=$W:$H:flags=lanczos" -quality 82 "$OUT/$NAME-$W.webp"
ffmpeg -hide_banner -loglevel error -y -i "$IN/f_0001.png" -vf "scale=$W:$H:flags=lanczos" -q:v 3 "$OUT/$NAME-$W.jpg"
if [ "$SW" != "0" ]; then ffmpeg -hide_banner -loglevel error -y -i "$IN/f_0001.png" -vf "scale=$SW:$SH:flags=lanczos" -quality 80 "$OUT/$NAME-$SW.webp"; fi
ls -la "$OUT" | grep "$NAME"

#!/usr/bin/env bash

set -euo pipefail

# If apt-ftparchive is missing
if [[ "${1:-}" != "--inside-docker" && ! -x "$(command -v apt-ftparchive)" ]]; then
  if [[ -x "$(command -v docker)" ]]; then
    echo "apt-ftparchive not found; running inside Docker container..."
    docker run --rm -v "$PWD":/repo -v "$HOME/.gnupg":/root/.gnupg:ro -w /repo debian:stable-slim bash -c "apt-get update && apt-get install -y dpkg-dev gnupg apt-utils && chmod +x update-repo.sh && ./update-repo.sh --inside-docker"
    exit $?
  else
    echo "apt-ftparchive not found and docker not available; will generate minimal Release file later."
  fi
fi

# If running inside Docker, drop the flag so the rest of the script runs normally
if [[ "${1:-}" == "--inside-docker" ]]; then
  shift
fi

# — CONFIGURATION — adjust these to your needs:
DEB_DIR="debs"                  # where your .deb files live
OUTPUT_DIR="."                  # place all metadata in repo root
GPG_KEY="YOUR_KEY_ID"           # your GPG signing key ID

# — PREPARE OUTPUT DIRECTORIES —
# mkdir -p "$DIST_DIR/$COMPONENT/binary-$ARCH"

# — STEP 1: Generate Packages index and compress —
echo "→ Scanning .debs in '$DEB_DIR'..."
dpkg-scanpackages "$DEB_DIR" /dev/null > "$OUTPUT_DIR/Packages"

echo "→ Compressing Packages index..."
gzip  -9c "$OUTPUT_DIR/Packages" > "$OUTPUT_DIR/Packages.gz"
bzip2 -9c "$OUTPUT_DIR/Packages" > "$OUTPUT_DIR/Packages.bz2"
xz    -9c "$OUTPUT_DIR/Packages" > "$OUTPUT_DIR/Packages.xz"

# — STEP 2: Create Release file —
echo "→ Creating Release file..."
if command -v apt-ftparchive >/dev/null 2>&1; then
  apt-ftparchive release "$OUTPUT_DIR" > "$OUTPUT_DIR/Release"
else
  echo "apt-ftparchive not found; generating minimal Release file..."
  cat > "$OUTPUT_DIR/Release" <<EOF
Origin: ZeroXJF Repo
Label: ZeroXJF Repo
Suite: stable
Architectures: iphoneos-arm iphoneos-arm64
Components: main
Description: zeroxjf's personal jailbreak repo
EOF

  # — Append checksums to Release —
  echo "MD5Sum:" >> "$OUTPUT_DIR/Release"
  for f in Packages Packages.gz Packages.bz2 Packages.xz; do
    if [[ -f "$OUTPUT_DIR/$f" ]]; then
      # Determine file size (portable)
      if stat -c%s "$OUTPUT_DIR/$f" >/dev/null 2>&1; then
        size=$(stat -c%s "$OUTPUT_DIR/$f")
      else
        size=$(wc -c < "$OUTPUT_DIR/$f" | tr -d ' ')
      fi
      # Determine MD5 sum (portable)
      if command -v md5sum >/dev/null 2>&1; then
        sum=$(md5sum "$OUTPUT_DIR/$f" | awk '{print $1}')
      elif command -v md5 >/dev/null 2>&1; then
        sum=$(md5 -q "$OUTPUT_DIR/$f")
      else
        echo "Warning: no MD5 tool found" >&2
        sum=""
      fi
      echo " $sum $size $f" >> "$OUTPUT_DIR/Release"
    fi
  done

  echo "SHA256:" >> "$OUTPUT_DIR/Release"
  for f in Packages Packages.gz Packages.bz2 Packages.xz; do
    if [[ -f "$OUTPUT_DIR/$f" ]]; then
      # Determine file size (portable)
      if stat -c%s "$OUTPUT_DIR/$f" >/dev/null 2>&1; then
        size=$(stat -c%s "$OUTPUT_DIR/$f")
      else
        size=$(wc -c < "$OUTPUT_DIR/$f" | tr -d ' ')
      fi
      # Determine SHA256 sum (portable)
      if command -v sha256sum >/dev/null 2>&1; then
        sum=$(sha256sum "$OUTPUT_DIR/$f" | awk '{print $1}')
      elif command -v shasum >/dev/null 2>&1; then
        sum=$(shasum -a 256 "$OUTPUT_DIR/$f" | awk '{print $1}')
      else
        echo "Warning: no SHA256 tool found" >&2
        sum=""
      fi
      echo " $sum $size $f" >> "$OUTPUT_DIR/Release"
    fi
  done
fi

# — STEP 3: Sign the Release for authenticity —
echo "→ Signing Release (GPG key: $GPG_KEY)..."
gpg --default-key "$GPG_KEY" \
    --detach-sign --armor \
    -o "$OUTPUT_DIR/Release.gpg" \
    "$OUTPUT_DIR/Release"

gpg --default-key "$GPG_KEY" \
    --clearsign \
    -o "$OUTPUT_DIR/InRelease" \
    "$OUTPUT_DIR/Release"

echo "✓ Repository metadata updated and signed!"
echo "Now upload the whole tree (./debs, ./dists, plus any icons/depictions) to your web host."

# — STEP 4: Commit and push to Git —
echo "→ Committing and pushing updates to Git..."
git add -A
git commit -m "Update repo metadata and packages"
git push
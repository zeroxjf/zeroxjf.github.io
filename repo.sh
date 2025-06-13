#!/usr/bin/env bash
# Ensure script runs from its own directory
cd "$(dirname "$0")" || exit 1
# Sync remote changes before generating files
git stash push -u -m "autostash"
git pull --rebase origin main
git stash pop || true
set -euo pipefail

# Define layout variables
DIST_DIR="dists/zeroxjf"
COMPONENT="main"
ARCHS=("iphoneos-arm" "iphoneos-arm64")

# Cleanup old indices and signatures
rm -f Packages* Release Release.asc

# Clear old Packages under dists
rm -rf "${DIST_DIR}/${COMPONENT}" 
# Generate per-architecture Packages
for arch in "${ARCHS[@]}"; do
  pkgdir="${DIST_DIR}/${COMPONENT}/binary-${arch}"
  mkdir -p "$pkgdir"
  dpkg-scanpackages -m debs/ /dev/null > "${pkgdir}/Packages"
  # Compress each
  bzip2  -kf "${pkgdir}/Packages"
  gzip   -kf "${pkgdir}/Packages"
  xz     -kf "${pkgdir}/Packages"
  zstd   -19 -kf "${pkgdir}/Packages"
  echo "Generated Packages for $arch"
done

# Build Release file with metadata
cat > Release <<EOF
Origin:    ZeroXJF Repo
Label:     ZeroXJF Repo
Suite:     stable
Version:   $(date -u +%Y%m%d%H%M%S)
Codename:  zeroxjf
Date:      $(date -uR)
Components: main
Architectures: iphoneos-arm iphoneos-arm64
Description: A repo for my tweaks
EOF

# Append checksums
{
  echo "MD5Sum:"
  for arch in "${ARCHS[@]}"; do
    pkgdir="${DIST_DIR}/${COMPONENT}/binary-${arch}"
    for f in Packages Packages.bz2 Packages.gz Packages.xz Packages.zst; do
      size=$(wc -c < "${pkgdir}/${f}")
      sum=$(md5sum "${pkgdir}/${f}" | awk '{print $1}')
      echo " $sum $size $f"
    done
  done
  echo "SHA256:"
  for arch in "${ARCHS[@]}"; do
    pkgdir="${DIST_DIR}/${COMPONENT}/binary-${arch}"
    for f in Packages Packages.bz2 Packages.gz Packages.xz Packages.zst; do
      size=$(wc -c < "${pkgdir}/${f}")
      sum=$(sha256sum "${pkgdir}/${f}" | awk '{print $1}')
      echo " $sum $size $f"
    done
  done
} >> Release

# Sign Release file (detached ASCII)
gpg --batch --yes --armor --detach-sign --output Release.asc Release
echo "Signed Release -> Release.asc"

# Git: integrate remote, stage all, commit, push
git add -A .
git commit --allow-empty -m "Repo update on $(date -uR)"
git push origin main

echo "Repo update complete."
# Push all changes to GitHub
git push https://github.com/zeroxjf/zeroxjf.github.io.git main

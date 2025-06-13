#!/usr/bin/env bash
# Ensure script runs from its own directory
cd "$(dirname "$0")" || exit 1
# Sync remote changes before generating files
git pull --rebase origin main
set -euo pipefail

# Cleanup old indices and signatures
rm -f Packages* Release Release.asc

# Generate Packages index with full descriptions
dpkg-scanpackages -m debs/ /dev/null > Packages

# Compress Packages in multiple formats (overwrite)
bzip2 -kf Packages
gzip -kf Packages
xz -kf Packages
zstd -19 -kf Packages
echo "Generated Packages, Packages.bz2, Packages.gz, Packages.xz, and Packages.zst"

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
  for f in Packages Packages.bz2 Packages.gz Packages.xz Packages.zst; do
    size=$(ls -l "$f" | awk '{print $5" "$9}')
    md5=$(md5sum "$f" | awk '{print $1}')
    echo " $md5 $size"
  done

  echo "SHA256:"
  for f in Packages Packages.bz2 Packages.gz Packages.xz Packages.zst; do
    size=$(ls -l "$f" | awk '{print $5" "$9}')
    sha=$(sha256sum "$f" | awk '{print $1}')
    echo " $sha $size"
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

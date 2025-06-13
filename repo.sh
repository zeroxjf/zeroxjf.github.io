#!/usr/bin/env bash
# Ensure script runs from its own directory
cd "$(dirname "$0")"
set -euo pipefail

# Clean up any existing index, release, signature, and archive files
rm -f Packages* Release Release.asc debs.tar.gz debs.tar.gz.asc

# Generate Packages index in multiple formats
dpkg-scanpackages -m debs/ > Packages
bzip2 -kf Packages
gzip -kf Packages
zstd -19 -kf Packages
echo "Generated Packages, Packages.bz2, Packages.gz, and Packages.zst"

# Build a new Release file with metadata headers
cat > Release <<EOF
Origin:    ZeroXJF Repo
Label:     ZeroXJF Repo
Suite:     stable
Codename:  zeroxjf
Date:      $(date -uR)
Components: main
Architectures: iphoneos-arm iphoneos-arm64
EOF

# Verify Release file exists
if [ ! -s Release ]; then
  echo "Error: Release file not found or empty" >&2
  exit 1
fi

# Append MD5 checksums
echo "MD5Sum:" >> Release
for f in Packages Packages.bz2 Packages.gz Packages.zst; do
  size=$(ls -l "$f" | awk '{print $5,$9}')
  md5=$(md5 -r "$f" | awk '{print $1}')
  echo " $md5 $size" >> Release
done

# Append SHA256 checksums
echo "SHA256:" >> Release
for f in Packages Packages.bz2 Packages.gz Packages.zst; do
  size=$(ls -l "$f" | awk '{print $5,$9}')
  sha256=$(shasum -a 256 "$f" | awk '{print $1}')
  echo " $sha256 $size" >> Release
done

# Sign the Release file, producing an ASCII-armored detached signature
gpg --batch --yes --armor --detach-sign --output Release.asc Release

echo "Repo updated successfully."

# Stage all changes including debs
git add -A .
git add -f debs/*.deb

# Always commit, even if no other changes
git commit --allow-empty -m "Repo update on $(date -uR)"
git push origin main

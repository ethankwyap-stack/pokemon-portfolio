#!/bin/bash
# Nightly auto-backup: commit and push any changes to GitHub.
# Run by LaunchAgent com.ethanyap.pokemon-portfolio-backup at 21:00 daily.
set -e
cd "$HOME/pokemon-portfolio"
git add -A
git diff --cached --quiet && exit 0  # nothing changed, nothing to do
git commit -m "auto-backup $(date '+%Y-%m-%d %H:%M')"
git push

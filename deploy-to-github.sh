#!/usr/bin/env bash
set -e

# RoboNav GitHub Deployment & Remote Setup Script
# User: HITESH LAKSHMAN (lakshman777-u)

REPO_NAME="${1:-robonav}"
GITHUB_USER="lakshman777-u"

echo "=========================================================="
echo "🚀 RoboNav GitHub Deployment Helper"
echo "   User:   $GITHUB_USER (HITESH LAKSHMAN)"
echo "   Repo:   $REPO_NAME"
echo "=========================================================="

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 1. Configure Git Identity
git config user.name "HITESH LAKSHMAN"
git config user.email "lakshman777-u@users.noreply.github.com"

# 2. Rename branch to main (GitHub standard)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" = "master" ]; then
  echo "📦 Renaming branch 'master' -> 'main'..."
  git branch -M main
fi

# 3. Check or Configure Git Remote
REMOTE_URL="https://github.com/$GITHUB_USER/$REPO_NAME.git"
if git remote | grep -q "^origin$"; then
  echo "🔄 Updating existing remote 'origin' to: $REMOTE_URL"
  git remote set-url origin "$REMOTE_URL"
else
  echo "➕ Adding remote 'origin': $REMOTE_URL"
  git remote add origin "$REMOTE_URL"
fi

echo ""
echo "✅ Git remote is configured:"
git remote -v
echo ""

# 4. Check for GitHub Token / Authentication
if [ -n "$GITHUB_TOKEN" ]; then
  echo "🔑 GITHUB_TOKEN environment variable detected. Pushing to GitHub..."
  git push -u "https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO_NAME.git" main --force
  echo ""
  echo "🎉 PUSH SUCCESSFUL!"
else
  echo "ℹ️  To push your code to GitHub, choose ONE of the options below:"
  echo ""
  echo "👉 OPTION 1 (Easiest - Using a GitHub Personal Access Token):"
  echo "   1. Go to: https://github.com/settings/tokens?type=beta (or Classic tokens)"
  echo "   2. Generate a token with 'repo' scope"
  echo "   3. Run:"
  echo "      git push -u https://<YOUR_TOKEN>@github.com/$GITHUB_USER/$REPO_NAME.git main"
  echo ""
  echo "👉 OPTION 2 (Standard git push prompt):"
  echo "   Run:"
  echo "      git push -u origin main"
  echo "   (When prompted, enter username '$GITHUB_USER' and paste your Personal Access Token as password)"
  echo ""
  echo "👉 OPTION 3 (One-liner with token):"
  echo "   GITHUB_TOKEN=\"your_token_here\" ./deploy-to-github.sh $REPO_NAME"
fi

echo ""
echo "=========================================================="
echo "🌐 TO OPEN YOUR WEBSITE ANYWHERE IN THE WORLD:"
echo "=========================================================="
echo "1. Go to your repo on GitHub: https://github.com/$GITHUB_USER/$REPO_NAME"
echo "2. Click 'Settings' -> 'Pages' (in left sidebar)"
echo "3. Under 'Build and deployment' -> 'Source':"
echo "   Select: 'GitHub Actions'"
echo "4. The automated workflow will build and publish your website at:"
echo "   👉 https://$GITHUB_USER.github.io/$REPO_NAME/"
echo ""
echo "Now you can open and share your website from any phone, tablet, or PC!"
echo "=========================================================="

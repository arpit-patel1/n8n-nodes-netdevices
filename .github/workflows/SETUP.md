# Release Workflow Setup Guide

## One-Time Setup

### 1. Create npm Access Token

1. Go to [npmjs.com](https://www.npmjs.com/) and log in
2. Click your avatar → "Access Tokens"
3. Click "Generate New Token" → "Classic Token"
4. Select "Automation" (for CI/CD use)
5. Copy the token (you'll only see it once!)

### 2. Add npm Token to GitHub Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `NPM_TOKEN`
5. Value: Paste your npm token
6. Click "Add secret"

## How to Use

### Your New Release Process

1. **Make your changes and commit them**
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```

2. **Update version and create release**
   ```bash
   npm version patch  # or minor, or major
   git push && git push --tags
   ```

That's it! The workflow will automatically:
- ✅ Run linter
- ✅ Build the project
- ✅ Create a GitHub Release with auto-generated notes
- ✅ Publish to npm

### Manual Release (Alternative)

If you prefer manual control, you can still:

1. Push your tag:
   ```bash
   git tag v1.0.67
   git push --tags
   ```

2. Go to GitHub → Releases → Draft a new release
3. Select your tag, add notes, publish
4. The workflow will still auto-publish to npm

## Version Bump Types

- `npm version patch` → 1.0.65 → 1.0.66 (bug fixes)
- `npm version minor` → 1.0.65 → 1.1.0 (new features)
- `npm version major` → 1.0.65 → 2.0.0 (breaking changes)

## Viewing Your Releases

- GitHub: `https://github.com/arpit-patel1/n8n-nodes-netdevices/releases`
- npm: `https://www.npmjs.com/package/n8n-nodes-netdevices`


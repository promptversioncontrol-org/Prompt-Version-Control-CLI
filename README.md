# PVC - Prompt Version Control (![Version](https://img.shields.io/npm/v/@adam903/pvc))

**Prompt Version Control (PVC)** is a CLI tool designed to track, analyze, and version control your AI coding sessions. It captures user prompts, assistant responses, and file edits, creating detailed reports to help you audit and improve your AI-assisted workflow.

## 📦 Installation

```bash
npm install -g @adam903/pvc
```

> **Note:** Requires a valid `prisma` setup. The installer will automatically run `prisma generate` to prepare the database client.

## 🚀 Getting Started

### 1. Global Authentication
Log in once to authenticate. PVC uses SSH key challenge-response for secure authentication. Your session is stored globally, so you don't need to login for every project.

```bash
pvc login --ssh
```

### 2. Initialize a Project
Navigate to your project root and initialize PVC. This creates a `.pvc` directory and local configuration.

```bash
cd my-project
pvc init
```

### 3. Link Remote Workspace
Connect your local project to a remote PVC workspace to enable syncing.

```bash
pvc remote add <workspace-url>
```

## 🛠️ Core Commands

### `pvc watch`
The heart of PVC. Starts a process that monitors your local AI session logs (e.g., from an IDE extension). It detects:
- **Prompts & Responses**: What you asked and what the AI answered.
- **File Edits**: Changes made to your codebase.
- **Security Risks**: fast scans for leaked secrets in prompts or files.

```bash
pvc watch
# Or watch a specific session
pvc watch --session=<session-id>
# Run in background (detached mode)
pvc watch --detach
```

### `pvc push`
Syncs your local daily reports with the remote storage (S3). Perfect for backing up your session history.

```bash
pvc push
```

### `pvc generate`
Manually generate a detailed Markdown and JSON report for a specific session.

```bash
pvc generate -id <session-id> -m "Refactoring Login Flow"
```

### `pvc version`
Check the current installed version of PVC.

```bash
pvc -v
```


### `pvc update-conv`
Updates the local configuration with the ID of the most recent AI session found in your logs.

```bash
pvc update-conv
```

## ⚙️ Configuration

PVC uses a tiered configuration system:

1.  **Global Config**: Stores authentication tokens (`userId`, `sessionToken`).
    *   Windows: `%APPDATA%\pvc\config.json`
    *   macOS/Linux: `~/.pvc/config.json`
2.  **Local Config**: Stores project specifics (`workspaceId`, `remoteUrl`).
    *   Path: `./.pvc/config.json`

## 🛡️ Security

PVC includes a built-in risk analyzer that checks for:
*   **Secrets**: API keys, tokens, passwords (using Gitleaks rules).
*   **Sensitive Files**: Uploading `.env` or certificates to the AI context.

Blocked prompts are logged locally and prevented from being sent if configured.



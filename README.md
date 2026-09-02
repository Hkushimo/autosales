# Global Syndicate Auto Sales Landing Page

Static landing page for GitHub Pages.

## GitHub Pages Setup

1. Push this repository to GitHub.
2. In the repository, go to **Settings > Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Select the branch you use, then choose the repository root folder.
5. Save. GitHub will publish `index.html`.

## Form Handling

The inquiry form posts to the VPS handler:

`http://66.179.251.13:8788/inquiry`

The handler stores a backup copy of every submission at:

`/opt/global-syndicate-form/submissions/inquiries.ndjson`

Telegram delivery requires a valid bot token and chat ID in:

`/opt/global-syndicate-form/.env`

The local `telegram_token.txt` file is ignored by git and should not be committed.

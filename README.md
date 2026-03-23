# LINE Webhook Bot

Minimal LINE Messaging API webhook bot for local development and Render deployment.

## Local development

1. Create `.env` from `.env.example`
2. Fill in `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET`
3. Start the server

```bash
npm install
npm start
```

The app listens on `process.env.PORT` or `3001`.

## Render deployment

Create a new Web Service on Render with:

- Build Command: `npm install`
- Start Command: `npm start`

Set these environment variables in Render:

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

After deploy, set your LINE webhook URL to:

```text
https://your-render-service.onrender.com/webhook
```

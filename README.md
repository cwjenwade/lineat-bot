# LINE Webhook Bot

Minimal LINE Messaging API bot for local development, with the reading experience now pivoted to Vercel.

## Local development

1. Create `.env` from `.env.example`
2. Fill in `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET`
3. Start the server

```bash
npm install
npm start
```

The app listens on `process.env.PORT` or `3001`.

## Authoring And Deploy

The local admin still writes story content to `data/story-authoring.json` and image uploads to `public/uploads/`.

The authoring workflow can run locally with `npm run admin`, and the same app can also be served on Vercel through `/admin`.

Recommended local workflow:

```bash
npm run admin
# edit content at http://localhost:3002/
git status
git add data/story-authoring.json public/uploads
git commit -m "Update story content"
git push
```

When you publish from the admin UI, the story should write to `public/stories/<story-id>/` so the reader and LINE webhook can use the same story source.

## Vercel deployment

Deploy this repository to Vercel as a static site.

- The homepage is served from `public/index.html`.
- The interactive story entry point is `/story`.
- Story deep links work as `/story/:storyId` and `/story?storyId=:storyId`.
- The LINE webhook lives at `/webhook` and is served by `api/webhook.js`.

Suggested static content flow:

1. Export each story to `public/stories/<story-id>/story.json`.
2. Put story images under `public/stories/<story-id>/images/`.
3. Deploy to Vercel; the rewrites in `vercel.json` handle the story routes.

If you still use LINE as a channel, point callbacks to `https://debbylinehose.vercel.app/webhook` and rich menu links to the Vercel story URL.

## Vercel split

This repo is now being organized into two Vercel-facing blocks:

1. Authoring / content production tools: continue to live in the Node-based admin workflow until the API layer is fully migrated.
2. LINE keyword response station: runs as a Vercel API function and can reply to keyword / postback events.

That means Vercel can absolutely handle the keyword-response side, but it does so as serverless functions, not as a permanently running Node process.

## Production boundary

- `/api/webhook` can be treated as the formal LINE webhook endpoint.
- `/admin` is currently for testing and preview only.
- Vercel functions are not a permanent file store.
- Formal story content should continue to come from static `public/stories/<story-id>/story.json` files or a future dedicated data layer.

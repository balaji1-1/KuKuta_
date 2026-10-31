# Kukuta Deployment Guide - Render

This repository already has a Render Blueprint named `Kukuta`, connected to
`balaji1-1/KuKuta_` on the `master` branch. Use that existing Blueprint to update
the current service; do not create a second Web Service or Blueprint for the same
application.

## Prerequisites

- GitHub account with `balaji1-1/KuKuta_`
- Access to the existing `Kukuta` Blueprint in Render
- A reachable MySQL database and Redis instance
- SMTP credentials for account emails
- Persistent media storage before accepting production uploads

## Prepare and validate the repository

Build the frontend with `npm run build` from `kukuta.com`, then run Django checks
and tests before pushing deployment changes to `master`. Render auto-deploys new
commits on the connected branch.

## Use the existing Render Blueprint

In the Render Dashboard, open **Blueprints → Kukuta** and confirm it is connected
to `balaji1-1/KuKuta_` on `master`. Use **Manual sync** on that Blueprint after
reviewing changes to `render.yaml`. The Blueprint owns `kukuta-backend`; creating a
new service instead can create duplicate infrastructure and costs.

## Configure production environment variables

Set service secrets directly in the Render Dashboard. Never commit or send secret
values in chat.

### Django and host

- `DJANGO_SECRET_KEY`: use Render's generated secret
- `DJANGO_DEBUG=0`
- `DJANGO_SECURE_SSL_REDIRECT=1`
- `DJANGO_SECURE_COOKIE=1`
- `DJANGO_ALLOWED_HOSTS`: the service hostname, for example
  `kukuta-backend.onrender.com`; add custom domains when configured
- `DEFAULT_FROM_EMAIL`: the sender address used by the app

### Email configuration

The Blueprint configures Gmail SMTP. Set `EMAIL_HOST_USER` and
`EMAIL_HOST_PASSWORD` in the Render service environment; use a Gmail App Password,
not the account password.

### MySQL and Redis (required)

Configure working, externally reachable service credentials:

```text
MYSQL_DATABASE
MYSQL_USER
MYSQL_PASSWORD
MYSQL_HOST
MYSQL_PORT=3306
REDIS_URL
```

The current Render deploy fails during `migrate` because the configured MySQL
hostname cannot be resolved. Replace `MYSQL_HOST` with the correct database
hostname and verify that the database provider allows connections from Render
before retrying a deploy. Do not put database credentials in this document.

Twilio variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and
`TWILIO_FROM_NUMBER`) are optional and only needed for SMS delivery.

## Confirm uploads will persist

The Django app stores uploaded product and review media under `MEDIA_ROOT`. Render
service filesystems are ephemeral by default, so uploads on the current Free web
service are not durable across deploys or restarts. Before accepting production
uploads, configure external object storage or approve upgrading the service and
attaching a persistent disk mounted at the app's media directory. A persistent disk
requires a paid Render service.

## Deploy and verify

Once MySQL, Redis, email, and media storage are configured:

1. Push the validated commit to `master`.
2. Let the existing Blueprint sync, or choose **Manual Deploy → Deploy Latest Commit**
   on `kukuta-backend`.
3. Check Render's build and deploy logs. The Blueprint build runs migrations, so the
   database must be reachable during the build.
4. Open the service URL and verify the homepage, product listing, authentication,
   email delivery, product upload, and media retrieval.

## Troubleshooting

- **Database migration fails:** confirm the MySQL host resolves and accepts
  connections from Render; then check database name, user, password, and port.
- **Email does not send:** verify `EMAIL_HOST_USER` and the Gmail App Password in
  the Render environment.
- **Uploads disappear after redeploy:** configure object storage or a paid persistent
  disk before enabling production uploads.
- **Slow first request:** the current Free web service can spin down when idle.

## Support

- Render Docs: https://render.com/docs
- Django Deployment: https://docs.djangoproject.com/en/6.0/howto/deployment/

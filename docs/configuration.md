# Configuration and deployment

[Back to the project overview](../README.md)

## AI provider

Configure `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` in `.env.local`. The endpoint must support the Chat Completions request and response format. Both a base URL and a full `/chat/completions` URL are accepted.

Public endpoints require HTTPS. HTTP is supported for loopback hosts and `host.docker.internal`, allowing a model server on the Docker host. Provider settings entered in the UI apply to the current session and reset on refresh. A server-configured key is reused only for the same normalized endpoint; changing the endpoint does not forward that key.

Conversation text and meeting context are sent to the selected provider. Deployment administrators should manage provider quotas and costs for their users.

## Nextcloud

| Variable | Description |
| --- | --- |
| `NEXTCLOUD_URL` | Nextcloud base URL from the assistant server's perspective. |
| `NEXTCLOUD_BROWSER_URL` | Base URL used in participant-facing Talk links; defaults to `NEXTCLOUD_URL`. |
| `NEXTCLOUD_CALENDAR` | Existing calendar identifier; defaults to `personal`. |
| `NEXTCLOUD_USERNAME` | Default account for the development-only login shortcut. |
| `NEXTCLOUD_PASSWORD` | App password for the development-only account. |

Enable Calendar and Talk. Each account needs permission to read and write its own files and calendar, and to create Talk rooms.

Shared availability depends on FreeBusy access and access to participants' calendar identities. Restricted accounts may not be able to read enough information about other users. In that case availability is unknown, and meeting creation stops rather than assuming a free slot.

The current search window covers seven days starting on the selected date, from 09:00 to 18:00 in `Asia/Tehran`.

## Authentication and internet access

1. Set `APP_AUTH_REQUIRED=true`.
2. Generate a random `SESSION_SECRET` with at least 32 characters and store it in the deployment's secret configuration:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

3. Serve the application over HTTPS.
4. Have each user sign in with their own Nextcloud username and app password.

The Nextcloud destination is fixed by the server for signed-in users. Their requests use their own credentials, without inheriting the development account's credentials.

Credentials are encrypted with AES-GCM in an HttpOnly, SameSite=Strict session cookie with an eight-hour lifetime. Public access uses Secure cookies. Share the same session secret between instances of one deployment. Rotating it invalidates existing sessions.

Logout clears the browser cookie. A copied session remains valid until expiry or secret rotation. Login rate limiting is process-local; deployments with multiple instances also need rate limiting at their gateway.

The login-free shortcut is limited to development mode, local hostnames, and `APP_AUTH_REQUIRED=false`. Nonlocal access requires login.

Changing accounts in another tab is detected so that stale tabs do not apply requests to the new account. Browser history is scoped to the account and server, but is not encrypted; use separate browser profiles on shared machines.

## Storage and recovery

Meeting metadata and notes live in the signed-in account's Nextcloud Files:

| File | Purpose |
| --- | --- |
| `Hamjalase-meetings.json` | Meeting catalog, including cancellations and saved minutes. |
| `Hamjalase-request-<UUID>.json` | Reservation and result for one meeting creation request. |

Creation uses `If-None-Match` reservations to prevent duplicate requests from creating multiple rooms. Retrying a completed request returns its stored result. Keep request files while retries may still occur.

The draft and request identifier also remain in the browser. After a network interruption, retry the same draft. If room creation has an uncertain result, the reservation does not automatically create another room; check Talk and the calendar first.

Catalog updates use ETags and expected versions. Partial failures are reported, and incomplete Talk title or membership updates can be retried.

During rescheduling, the organizer's previous booking is excluded only after verifying its UID and stored time range. Newly occupied organizer time and participants' full requested time range are checked.

Cancellation requires confirmation and deletes the calendar event and Talk room, including room history. The canceled catalog entry and minutes remain. Replaying a canceled creation request does not return an active meeting link.

Calendar events are stored in the organizer's calendar. Calendar exports contain no scheduling recipients. Email invitations are not sent.

Talk rooms use public guest links. Removing account membership does not invalidate a public link.

## Docker

The root Compose file runs only the assistant; it does not install Nextcloud. Create `.env.local` before starting it:

```sh
docker compose up -d --build
```

Set `NEXTCLOUD_URL` to an address reachable inside the container. `NEXTCLOUD_BROWSER_URL` can differ so that participants receive usable links.

The Dockerfile currently starts the development server, with the published port bound to the host loopback interface. Configure an HTTPS gateway and mandatory authentication before allowing internet access.

## Testing

```sh
npm test
npm run typecheck
npm run build
```

For a configured test instance with the development shortcut enabled:

```sh
npm run smoke
```

The smoke test creates its own temporary meeting, replays the creation request, edits meeting details, persists notes and action items, verifies calendar export, and cancels that meeting in cleanup. It does not cancel other meetings.

Set `SMOKE_TEST_MODEL=1` to include a live model connection check. For a test instance that requires login, provide `SMOKE_BASE_URL`, `SMOKE_SESSION_COOKIE`, and `SMOKE_ACCOUNT` through the local test environment. Never paste the cookie into public commands, issues, or logs.

Unit tests cover two-identity isolation, encrypted session expiry, concurrent requests, replay, filters, notes, calendar export, FreeBusy, and overlapping rescheduling. The existing account login and real Nextcloud meeting workflow were tested during development. Two separate real Nextcloud accounts have not been tested together in this environment.

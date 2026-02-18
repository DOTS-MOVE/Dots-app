# Day 4 User Journeys

Capture end-to-end behavior for core product flows.

## 1) Journey: Auth + Onboarding

### Steps
1. User signs up or signs in via Supabase Auth from UI auth pages.
2. Frontend fetches backend profile (`/users/me`) using Supabase access token.
3. User completes profile fields/photos and onboarding completion action.

### Sequence
| Step | UI Event | Frontend Call | Backend Endpoint | Data Side Effect | Expected UI Result |
|---|---|---|---|---|---|
| 1 | Register submit | `useAuth().register` | Supabase Auth API | Supabase auth user created, pending confirmation | Confirmation message shown; no active app session yet. |
| 2 | Login submit | `useAuth().login` | Supabase Auth API, then `GET /users/me` | Session token established; backend user profile loaded if available | User lands on app with authenticated shell state. |
| 3 | Edit profile fields | `api.updateUser(...)` | `PUT /users/me` | `users`, `user_sports`, `user_goals` updated | Profile tab reflects new values. |
| 4 | Upload photos | `api.addUserPhoto(...)` / `api.deleteUserPhoto(...)` | `POST/DELETE /users/me/photos/*` | `user_photos` rows created/deleted | Gallery updates in profile/onboarding UI. |
| 5 | Complete onboarding | `api.completeProfile(...)` | `POST /users/me/complete-profile` | `is_discoverable`, `profile_completed` updated | Discovery features unlocked; onboarding prompts disappear. |

### Failure Cases
- Supabase env/session issues prevent token retrieval; API calls fail with `Not authenticated` messaging.
- Backend `/users/me` failure can trigger fallback user mapping from Supabase metadata, reducing profile fidelity.

## 2) Journey: Buddy Discovery and Connection

### Steps
1. Discoverable user opens buddies discover tab.
2. User swipes/connects to send buddy request.
3. Receiver accepts/rejects or either user removes connection.

### Sequence
| Step | UI Event | Frontend Call | Backend Endpoint | Data Side Effect | Expected UI Result |
|---|---|---|---|---|---|
| 1 | Open buddies discover | `api.getSuggestedBuddies(...)` | `GET /buddies/suggested` | Reads candidates from users/sports/goals/events data | Swipe cards show suggested buddy profiles. |
| 2 | Connect with message | `api.createBuddy(user2Id, message)` | `POST /buddies` then best-effort `POST /messages` | Buddy row inserted (`pending`), optional initial DM sent | Pending relationship appears; card advances. |
| 3 | Review pending requests | `api.getBuddies()` | `GET /buddies` | Reads both directions and statuses | Pending and accepted tabs update. |
| 4 | Accept/reject request | `api.updateBuddy(id, status)` | `PUT /buddies/{id}` | Buddy `status` updated | Request moves to accepted/rejected state. |
| 5 | Remove buddy | `api.deleteBuddy(id)` | `DELETE /buddies/{id}` | Buddy row removed | Buddy disappears from list. |

### Failure Cases
- Discovery disabled (`is_discoverable=false`) returns 403 and UI prompts user to enable discovery.
- Duplicate buddy request or self-request returns 400 and UI shows error.

## 3) Journey: Event Create + RSVP

### Steps
1. Authenticated user creates event from create form.
2. Other users discover event and request to join (RSVP).
3. Host manages RSVP approvals/rejections for private flow.

### Sequence
| Step | UI Event | Frontend Call | Backend Endpoint | Data Side Effect | Expected UI Result |
|---|---|---|---|---|---|
| 1 | Open create-event page | `api.getSports()` | `GET /sports` | Reference data read | Sport selector populated. |
| 2 | Submit event form | `api.createEvent(eventData)` | `POST /events` | Event row created; host RSVP insert attempted | Redirect to new event detail page. |
| 3 | Browse events | `api.getEvents(...)` | `GET /events` | Event list read | Event appears in home/events listings. |
| 4 | Open event detail | `api.getEvent(eventId)` | `GET /events/{id}` | Event detail + participants + RSVP status read | User sees event details and action button state. |
| 5 | Request to join | `api.rsvpEvent(eventId)` | `POST /events/{id}/rsvp` | RSVP row inserted (`pending` current behavior) | UI shows pending/requested state. |
| 6 | Host admin action | `api.getEventRSVPs`, `api.approveRSVP` / `api.rejectRSVP` | `/events/{id}/rsvps*` | RSVP status transitions or participant removal | Pending queue updates in admin panel and detail UI. |

### Failure Cases
- RSVP may fail due to event full/cancelled/already RSVPd with 400-level errors.
- Event list may show empty results on backend query failures (current fallback behavior), masking outages.

## 4) Journey: Messaging (Direct/Group)

### Steps
1. User opens messages inbox to load conversations.
2. User opens a conversation and sends message (optionally image).
3. Conversation read status updates and thread refreshes.

### Sequence
| Step | UI Event | Frontend Call | Backend Endpoint | Data Side Effect | Expected UI Result |
|---|---|---|---|---|---|
| 1 | Open messages page | `api.getConversations()` | `GET /messages/conversations` | Reads grouped conversation summaries | Sidebar shows user/event/group conversation list. |
| 2 | Open conversation | `api.getConversation(id, type)` | `GET /messages/conversations/{id}?conversation_type=...` | Reads ordered message history | Chat thread renders messages. |
| 3 | Mark read | `api.markConversationRead(id, type)` | `POST /messages/conversations/{id}/mark-read` | Message `is_read` updates for matching scope | Unread badge counts decrease. |
| 4 | Send message | `api.sendMessage(payload)` | `POST /messages` | Message row inserted for receiver/event/group context | New message appears in thread after mutate/refetch. |

### Failure Cases
- Group conversation fetch/send fails with 403 when user is not group member.
- Image upload or message send failures show toast/alert and do not update conversation state.

## 5) Cross-Journey Observations

- Contract consistency: most routes follow `detail`-based error payloads, but several list endpoints still use empty-array fallback semantics on failures.
- Latency-sensitive points: auth initialization (`supabase.auth.getSession`) and profile hydrate (`/users/me`) during app bootstrap, plus conversations/message fetch and event detail reload after RSVP.
- Auth/session fragility: frontend requires Supabase env + session, and backend protected routes currently depend on Supabase token validation; this hybrid setup increases migration and troubleshooting complexity.
- Best candidates for E2E tests: login -> profile hydrate -> complete onboarding; discover buddy -> send connection -> accept request; create event -> RSVP -> host approve; open conversation -> send message -> mark read.

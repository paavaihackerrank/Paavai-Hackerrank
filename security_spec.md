# Firestore Security Specification (Updated)

## 1. Data Invariants
1. **Verified Account Access (`signedIn()`)**: `signedIn()` requires `request.auth != null`, `request.auth.token.email_verified == true`, and a valid email address (students sign up with their personal email for reliable delivery while registering a unique Paavai college email ID and unique phone number; `paavaihackerrank@gmail.com` is the bootstrapped Campus Lead admin email).
2. **Immediate Member Provisioning (No User Status Gate)**: On first verified login, `/users/{uid}` is created with `role: 'member'`, `regNo`, `department`, `year`, `name`, `email`, `collegeEmail`, and `phone`—with no `status` field.
3. **Immutable Self-Role & Unique Identifiers**: Users can edit their own profile fields (`name`, `regNo`, `department`, `year`, `phone`, `hackerRankHandle`, `bio`, `skills`), but NEVER their own `role`. Only a `lead` can promote `member` → `crew` or demote `crew` → `member`. Uniqueness of personal `email`, `phone`, and `collegeEmail` is enforced via SHA-256 hash-keyed locks in `/unique_emails/{emailHash}`, `/unique_phones/{phoneHash}`, and `/unique_college_emails/{emailHash}` (no `list` allowed).
4. **Approval Gate for Crew Content**: `crew` members creating `/events/{id}` or `/announcements/{id}` MUST submit `status == 'pending'`. Only `lead` can set `status == 'approved'` or `'rejected'`.
5. **PII Isolation**: `/users/{uid}`, `/registrations/{id}`, `/event_checkins/{id}`, `/join_requests/{id}`, and `/emailSendAttempts/{id}` are never readable by guests or unrelated students (`/emailSendAttempts/{id}` is strictly Campus Lead-only). Non-PII portfolio data (`hackerRankUrl`, `githubUrl`, `linkedinUrl`, `skills`, `completedDsaCount`) is isolated in `/public_profiles/{uid}` without `email`, `phone`, or `regNo`.
6. **Event QR Check-In Integrity**: Unique QR check-in codes in `/event_checkin_codes/{code}` can only be created or toggled by Crew/Lead for existing events. Attendee check-ins in `/event_checkins/{id}` require `signedIn()`, `incoming().userId == request.auth.uid`, and an active matching check-in code in `/event_checkin_codes/{code}`.
7. **Coding Activity Log Isolation**: `/coding_activities/{activityId}` entries are strictly private to the owning user (`incoming().userId == request.auth.uid`, `existing().userId == request.auth.uid`) or Campus Lead.

## 2. Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unverified personal or college account attempts to read full `/resources` or create `/registrations/{id}`.
2. Anonymous/unauthenticated user attempts to create `/users/{uid}` or `/unique_phones/{hash}`.
3. Student creates `/users/{uid}` with `role: 'lead'` or `'crew'`.
4. Student updates `/users/{uid}` changing `role: 'crew'`.
5. User attempts to inject a `status` or `isAdmin` shadow field into `/users/{uid}`.
6. `crew` creates `/events/{id}` with `status: 'approved'`.
7. `crew` attempts to update `/users/{otherUid}` role.
8. Unauthenticated guest attempts to read `/resources/{id}` where `access == 'full'`.
9. Student A reads `/users/{studentB}` or `/registrations/{studentB_reg}` or `/event_checkins/{studentB_chk}`.
10. Unverified `paavaihackerrank@gmail.com` spoof attempts write to `/site_settings/main`.
11. `crew`, `member`, or guest attempts to read, list, update, or delete `/emailSendAttempts/{id}`.
12. Any client attempts `list` on `/unique_emails`, `/unique_phones`, or `/unique_college_emails`, or overwrites an existing hash lock.
13. Student creates `/event_checkin_codes/{code}` or checks into an inactive/non-existent check-in code or spoofs another student's `userId` in `/event_checkins/{id}`.
14. Student A attempts to create, list, or delete `/coding_activities/{id}` with `userId == studentB`.

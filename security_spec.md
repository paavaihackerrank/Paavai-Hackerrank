# Firestore Security Specification (Updated)

## 1. Data Invariants
1. **Verified Institutional Access (`signedIn()`)**: `signedIn()` requires `request.auth != null`, `request.auth.token.email_verified == true`, and a `@paavai.edu.in` email address (or bootstrapped Campus Lead `622123104144@paavai.edu.in` / `paavaihackerrank@gmail.com`).
2. **Immediate Member Provisioning (No User Status Gate)**: On first verified login, `/users/{uid}` is created with `role: 'member'`, `regNo`, `department`, `year`, `name`, and `email`—with no `status` field.
3. **Immutable Self-Role**: Users can edit their own profile fields (`name`, `regNo`, `department`, `year`, `phone`, `hackerRankHandle`, `bio`, `skills`), but NEVER their own `role`. Only a `lead` can promote `member` → `crew` or demote `crew` → `member`.
4. **Approval Gate for Crew Content**: `crew` members creating `/events/{id}` or `/announcements/{id}` MUST submit `status == 'pending'`. Only `lead` can set `status == 'approved'` or `'rejected'`.
5. **PII Isolation**: `/users/{uid}`, `/registrations/{id}`, and `/join_requests/{id}` are never readable by guests or unrelated students.

## 2. Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Unverified `@paavai.edu.in` account attempts to create `/users/{uid}` or `/registrations/{id}`.
2. Verified non-Paavai `@gmail.com` user attempts to create `/users/{uid}` or read full `/resources`.
3. Student creates `/users/{uid}` with `role: 'lead'` or `'crew'`.
4. Student updates `/users/{uid}` changing `role: 'crew'`.
5. User attempts to inject a `status` or `isAdmin` shadow field into `/users/{uid}`.
6. `crew` creates `/events/{id}` with `status: 'approved'`.
7. `crew` attempts to update `/users/{otherUid}` role.
8. Unauthenticated guest attempts to read `/resources/{id}` where `access == 'full'`.
9. Student A reads `/users/{studentB}` or `/registrations/{studentB_reg}`.
10. Unverified `paavaihackerrank@gmail.com` spoof attempts write to `/site_settings/main`.

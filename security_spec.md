# LexiPlan Firestore Security Specification

## 1. Data Invariants
1. Only authenticated users with a verified email (`request.auth.token.email_verified == true`) can read or write their own data under `/users/{userId}`.
2. Every document in `/users/{userId}/courseProgress/{courseId}` and `/users/{userId}/courses/{courseId}` requires the parent `/users/{userId}` document to exist (Master Gate via `exists()`).
3. `ownerId` must match `request.auth.uid` and `{userId}` on creation and is strictly immutable on updates.
4. `createdAt` must equal `request.time` on creation and is strictly immutable on updates; `updatedAt` must equal `request.time` on both creation and updates.
5. Document IDs (`userId`, `courseId`) must match `^[a-zA-Z0-9_\\-]+$` and have length `<= 128`.
6. Every string and array field enforces explicit size caps (`selectedDays` `1..180`, `completedDays.size() <= 180`, `starredVocabIds.size() <= 2000`, `units.size() <= 100`, `title.size() <= 200`, etc.).
7. No shadow/ghost fields allowed (`keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update).

## 2. Adversarial Payloads ("Dirty Dozen")
1. Unauthenticated read/write to `/users/uid1`. -> Expected: `PERMISSION_DENIED`.
2. Unverified email user (`email_verified == false`) attempting create/update on `/users/uid1`. -> Expected: `PERMISSION_DENIED`.
3. Cross-user read/write: `uid2` attempting `get`, `list`, `create`, `update`, or `delete` on `/users/uid1/courseProgress/destination-b1`. -> Expected: `PERMISSION_DENIED`.
4. Identity spoofing: `uid1` creating `/users/uid1/courses/c1` with `ownerId: "uid2"`. -> Expected: `PERMISSION_DENIED`.
5. Ghost/Shadow field injection: `uid1` updating `/users/uid1` with `{ activeCourseId: "c1", isAdmin: true, updatedAt: serverTimestamp }`. -> Expected: `PERMISSION_DENIED`.
6. Immutable field tampering: `uid1` updating `/users/uid1/courseProgress/c1` trying to alter `createdAt` or `ownerId`. -> Expected: `PERMISSION_DENIED`.
7. Client timestamp spoofing: `uid1` creating `/users/uid1` with a backdated `createdAt` instead of `request.time`. -> Expected: `PERMISSION_DENIED`.
8. Orphan subcollection write: `uid1` creating `/users/uid1/courses/c1` when `/users/uid1` does not exist. -> Expected: `PERMISSION_DENIED`.
9. ID poisoning: creating `/users/uid1/courses/bad$id..!` or 200-char ID. -> Expected: `PERMISSION_DENIED`.
10. Unbounded array/string DoS: `selectedDays: 9999`, `title` > 200 chars, or `units: []`. -> Expected: `PERMISSION_DENIED`.
11. Type confusion: `completedDays: ["1"]` (string element instead of int) or `selectedDays: "14"`. -> Expected: `PERMISSION_DENIED`.
12. Blanket collection list attempt: listing `/users` or listing `/users/uid1/courses` by another user. -> Expected: `PERMISSION_DENIED`.

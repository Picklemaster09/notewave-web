# Security Specification — NoteWave

This specification defines the security invariants and validation schemas for NoteWave’s Firestore collections. 

## 1. Data Invariants
- **Users**: A user can only read and write their own profile (`users/{userId}`). They cannot change their email address or self-promote their `tier` field on the client side. `createdAt` must be immutable.
- **Recordings**: Recordings belong exclusively to the user. A user can only read, write, update, or delete recordings under `users/{userId}/recordings/{recordingId}` where `userId` is equal to their authenticated UID.
- **Timestamps**: All timestamps (`createdAt`, `updatedAt`) must be verified using `request.time`.

## 2. The "Dirty Dozen" Payloads (Attack Vectors Check)

### Users Collection (`users/{userId}`)
1. **Privilege Escalation**: Modifying tier from `free` to `premium`.
2. **Identity Spoofing**: Creating a profile with a `userId` mismatch.
3. **Ghost Fields Injection**: Injecting a custom validation flag like `isAdminState: true`.
4. **Timestamp Bypass**: Providing an arbitrary client-side date string for `createdAt`.

### Recordings Collection (`users/{userId}/recordings/{recordingId}`)
5. **Cross-User Snooping**: Attempting to read another user's recordings.
6. **Data Injection**: Overwriting another user's recording document.
7. **Orphaned Write**: Creating a recording with a mismatched `userId` in the payload compared to the path variable.
8. **Size Flooding**: Injecting an insanely large text transcript (e.g., 5MB) to initiate resource depletion list queries.
9. **Malicious ID Injection**: Creating a document containing a highly nested path character like `../` or exceeding 1MB.
10. **Action-Item Spoofing**: Overwriting other recording attributes while modifying an action item checked status.
11. **Creation Timestamp Bypass**: Skipping server timestamp authentication for `createdAt` on creation.
12. **Model Spoofing**: Specifying an unsupported model version outside of permitted system configurations.

## 3. Test Scopes & Rules Logic
We will implement safe verification helpers inside `firestore.rules`:
- `isValidId(id)`: Verifies path variables match legal patterns.
- `isValidUser(data)`: Validates the shape of user records.
- `isValidRecording(data)`: Validates audio notes and transcripts.

# SAFA QURAN COLLEGE SUPPORT PORTAL – V6

V6 is a Firebase-connected diagnostic/admin build.

## Important
The portal authenticates with Firebase Authentication and then reads:
`users/{SIGNED_IN_UID}`
The field `role` must be exactly `admin`, `parent`, or `teacher`.

V6 now displays the signed-in UID on the dashboard. This makes it easy to detect if the Firestore `users` document was created under a different UID after an email/account change.

Admin example:
- Email: basithchrkla@gmail.com
- Password: your current Firebase Authentication password

Do not share passwords. Do not put real student data into this development build until Firestore rules and all parent/teacher flows are reviewed.

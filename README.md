# SAFA QURAN COLLEGE SUPPORT PORTAL V4

Firebase project: `safa-hifz-class`

Admin login:
- Email: `basithchrkla@gmail.com`
- Password: the password currently set in Firebase Authentication.

V4 adds a real Super Admin dashboard connected to Firestore:
- Students: add/delete
- Teachers: add/delete
- Notices: publish/delete
- Attendance, Study, Leave, Results: record counters/data viewer
- Users: data viewer

IMPORTANT:
1. Firebase Authentication must have the admin user.
2. Firestore must contain `users/{ADMIN_UID}` with `role: "admin"`.
3. Replace the GitHub files with this V4 package.
4. Before entering real student data, review and publish the Firestore rules.
5. Creating Firebase Authentication accounts for parents/teachers should be done through a secure admin workflow; do not expose privileged Firebase credentials in browser code.

This is a development build. Parent/teacher full screens and account creation are the next implementation stage.

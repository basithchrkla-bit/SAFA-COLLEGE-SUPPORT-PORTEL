import {initializeApp} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {firebaseConfig} from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);


/* =========================
   LOGIN
========================= */

$("loginBtn").onclick = async () => {
  $("msg").textContent = "";

  try {
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("password").value
    );
  } catch (e) {
    $("msg").textContent =
      "Login failed: " + (e.code || e.message);
  }
};


/* =========================
   LOGOUT / PANEL
========================= */

$("logout").onclick = () => signOut(auth);

$("closePanel").onclick = () =>
  $("panel").classList.add("hidden");

document.querySelectorAll("[data-section]").forEach(btn => {
  btn.addEventListener("click", () => {
    openSection(btn.dataset.section);
  });
});


/* =========================
   AUTH + ROLE
========================= */

onAuthStateChanged(auth, async user => {

  if (!user) {
    $("login").classList.remove("hidden");
    $("dash").classList.add("hidden");
    return;
  }

  $("login").classList.add("hidden");
  $("dash").classList.remove("hidden");

  $("admin").classList.add("hidden");
  $("parent").classList.add("hidden");
  $("teacher").classList.add("hidden");
  $("panel").classList.add("hidden");

  $("user").textContent = user.email || "";

  $("uid").textContent =
    "Signed-in UID: " + user.uid;

  $("status").textContent =
    "Reading users/" + user.uid + " …";

  try {

    /*
      IMPORTANT:
      Firebase Authentication UID is used
      directly as Firestore users document ID.
    */

    const userRef = doc(db, "users", user.uid);

    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {

      $("status").innerHTML =
        "⚠️ users document not found.<br>" +
        "<small>Expected document ID:</small><br>" +
        "<b>" + escapeHtml(user.uid) + "</b>";

      return;
    }

    const userData = userSnap.data() || {};

    const rawRole = userData.role;

    const role =
      typeof rawRole === "string"
        ? rawRole.trim().toLowerCase()
        : String(rawRole ?? "")
            .trim()
            .toLowerCase();


    /* =========================
       ADMIN
    ========================= */

    if (role === "admin") {

      $("status").textContent =
        "✅ Role detected: admin";

      $("dashTitle").textContent =
        "Super Admin Dashboard";

      $("admin").classList.remove("hidden");

      return;
    }


    /* =========================
       PARENT
    ========================= */

    if (role === "parent") {

      $("status").textContent =
        "✅ Role detected: parent";

      $("dashTitle").textContent =
        "Parent Dashboard";

      $("parent").classList.remove("hidden");

      await renderParentDashboard(userData);

      return;
    }


    /* =========================
       TEACHER
    ========================= */

    if (role === "teacher") {

      $("status").textContent =
        "✅ Role detected: teacher";

      $("dashTitle").textContent =
        "Teacher Dashboard";

      $("teacher").classList.remove("hidden");

      return;
    }


    $("status").textContent =
      "⚠️ Unknown role: " + (role || "EMPTY");

  } catch (e) {

    console.error(e);

    $("status").innerHTML =
      "⚠️ Firestore error:<br>" +
      escapeHtml(e.code || e.message);
  }
});


/* =========================
   COLLECTION LABELS
========================= */

const labels = {
  students: "Students / വിദ്യാർത്ഥികൾ",
  teachers: "Teachers / അധ്യാപകർ",
  attendance: "Attendance / ഹാജർ",
  studyRecords: "Study / പഠന പുരോഗതി",
  leaveRequests: "Leave / ലീവ്",
  results: "Results / റിസൾട്ട്",
  notices: "Notices / അറിയിപ്പുകൾ",
  users: "Users / അക്കൗണ്ടുകൾ"
};


/* =========================
   GET COLLECTION
========================= */

async function getAll(name) {

  const snap =
    await getDocs(collection(db, name));

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}


/* =========================
   OPEN ADMIN SECTION
========================= */

async function openSection(name) {

  $("panel").classList.remove("hidden");

  $("panelTitle").textContent =
    labels[name] || name;

  $("panelBody").innerHTML =
    "<p>Loading...</p>";

  try {

    const rows = await getAll(name);

    if (name === "students") {
      renderStudents(rows);
      return;
    }

    if (name === "teachers") {
      renderTeachers(rows);
      return;
    }

    if (name === "attendance") {
      renderAttendance(rows);
      return;
    }

    if (name === "leaveRequests") {
      renderLeaveRequests(rows);
      return;
    }

    $("panelBody").innerHTML =
      rows.length
        ? tableHtml(
            rows,
            Object.keys(rows[0])
              .filter(k => k !== "id")
              .slice(0, 6),
            name
          )
        : "<div class='empty'>No records yet.</div>";

  } catch (e) {

    $("panelBody").innerHTML =
      "<p class='msg'>Error: " +
      escapeHtml(e.message || e.code) +
      "</p>";
  }
}


/* =========================
   STUDENTS
========================= */

function renderStudents(rows) {

  const data = [...rows].sort(
    (a, b) =>
      String(a.studentNumber || "")
        .localeCompare(String(b.studentNumber || ""))
  );

  $("panelBody").innerHTML = `
    <div class="studentTools">
      <input
        id="studentSearch"
        placeholder="🔍 Search student number or name"
      >

      <button id="addStudentBtn" class="primary">
        ➕ Add Student
      </button>
    </div>

    <div id="studentForm" class="formbox hidden"></div>

    <div id="studentList"></div>
  `;

  const search = $("studentSearch");

  const draw = () => {

    const q =
      search.value.trim().toLowerCase();

    const filtered = data.filter(r =>
      String(r.studentNumber || "")
        .toLowerCase()
        .includes(q) ||
      String(r.name || "")
        .toLowerCase()
        .includes(q)
    );

    $("studentList").innerHTML =
      filtered.length
        ? studentsTable(filtered)
        : "<div class='empty'>No students found.</div>";

    bindStudentActions();
  };

  search.oninput = draw;

  $("addStudentBtn").onclick =
    () => showStudentForm();

  draw();
}


function studentsTable(rows) {

  let h = `
    <div class="tablewrap">
    <table>
      <thead>
        <tr>
          <th>Student No.</th>
          <th>Name</th>
          <th>Parent</th>
          <th>Class / Batch</th>
          <th>Phone</th>
          <th>Teacher</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const r of rows) {

    h += `
      <tr>

        <td>${escapeHtml(r.studentNumber)}</td>

        <td>${escapeHtml(r.name)}</td>

        <td>${escapeHtml(r.parentName)}</td>

        <td>${escapeHtml(r.classBatch)}</td>

        <td>${escapeHtml(r.phone)}</td>

        <td>${escapeHtml(r.assignedTeacher)}</td>

        <td>${escapeHtml(r.status || "Active")}</td>

        <td class="actions">

          <button
            class="smallbtn"
            data-edit-student="${escapeHtml(r.id)}"
          >
            Edit
          </button>

          <button
            class="smallbtn danger"
            data-delete-student="${escapeHtml(r.id)}"
          >
            Delete
          </button>

        </td>

      </tr>
    `;
  }

  return h + `
      </tbody>
    </table>
    </div>
  `;
}


function showStudentForm(student = null) {

  const f = $("studentForm");

  f.classList.remove("hidden");

  f.innerHTML = `
    <h4>
      ${student ? "✏️ Edit Student" : "➕ Add Student"}
    </h4>

    <div class="formgrid">

      <div>
        <label>Student Number / വിദ്യാർത്ഥി നമ്പർ</label>
        <input
          id="sNo"
          value="${escapeAttr(student?.studentNumber)}"
          placeholder="e.g. 131"
        >
      </div>

      <div>
        <label>Student Name / പേര്</label>
        <input
          id="sName"
          value="${escapeAttr(student?.name)}"
        >
      </div>

      <div>
        <label>Parent Name / രക്ഷിതാവിന്റെ പേര്</label>
        <input
          id="sParent"
          value="${escapeAttr(student?.parentName)}"
        >
      </div>

      <div>
        <label>Class / Batch</label>
        <input
          id="sClass"
          value="${escapeAttr(student?.classBatch)}"
        >
      </div>

      <div>
        <label>Phone Number / ഫോൺ</label>
        <input
          id="sPhone"
          value="${escapeAttr(student?.phone)}"
        >
      </div>

      <div>
        <label>Assigned Teacher / അധ്യാപകൻ</label>
        <input
          id="sTeacher"
          value="${escapeAttr(student?.assignedTeacher)}"
        >
      </div>

      <div>
        <label>Address / വിലാസം</label>
        <textarea id="sAddress">${escapeHtml(student?.address)}</textarea>
      </div>

      <div>
        <label>Date of Birth / ജനനത്തീയതി</label>
        <input
          id="sDob"
          type="date"
          value="${escapeAttr(student?.dateOfBirth)}"
        >
      </div>

      <div>
        <label>Admission Date / പ്രവേശന തീയതി</label>
        <input
          id="sAdmission"
          type="date"
          value="${escapeAttr(student?.admissionDate)}"
        >
      </div>

      <div>
        <label>Status / നിലവാരം</label>

        <select id="sStatus">

          <option
            value="Active"
            ${(student?.status || "Active") === "Active" ? "selected" : ""}
          >
            Active / സജീവം
          </option>

          <option
            value="Inactive"
            ${student?.status === "Inactive" ? "selected" : ""}
          >
            Inactive / നിർജ്ജീവം
          </option>

        </select>
      </div>

    </div>

    <div class="formactions">

      <button id="saveStudent" class="primary">
        ${student ? "Save Changes" : "Save Student"}
      </button>

      <button id="cancelStudent">
        Cancel
      </button>

    </div>

    <div id="studentFormMsg" class="msg"></div>
  `;

  $("cancelStudent").onclick =
    () => f.classList.add("hidden");

  $("saveStudent").onclick = async () => {

    const payload = {

      studentNumber:
        $("sNo").value.trim(),

      name:
        $("sName").value.trim(),

      parentName:
        $("sParent").value.trim(),

      classBatch:
        $("sClass").value.trim(),

      phone:
        $("sPhone").value.trim(),

      assignedTeacher:
        $("sTeacher").value.trim(),

      address:
        $("sAddress").value.trim(),

      dateOfBirth:
        $("sDob").value,

      admissionDate:
        $("sAdmission").value,

      status:
        $("sStatus").value,

      updatedAt:
        new Date().toISOString()
    };

    if (!payload.studentNumber || !payload.name) {

      $("studentFormMsg").textContent =
        "Student Number and Name are required.";

      return;
    }

    $("saveStudent").disabled = true;

    try {

      if (student) {

        await updateDoc(
          doc(db, "students", student.id),
          payload
        );

      } else {

        await addDoc(
          collection(db, "students"),
          {
            ...payload,
            createdAt:
              new Date().toISOString()
          }
        );
      }

      await openSection("students");

    } catch (e) {

      $("studentFormMsg").textContent =
        "Save failed: " +
        (e.code || e.message);

      $("saveStudent").disabled = false;
    }
  };
}


function bindStudentActions() {

  document
    .querySelectorAll("[data-edit-student]")
    .forEach(b => {

      b.onclick = async () => {

        const snap =
          await getDoc(
            doc(db, "students", b.dataset.editStudent)
          );

        if (snap.exists()) {

          showStudentForm({
            id: snap.id,
            ...snap.data()
          });
        }
      };
    });


  document
    .querySelectorAll("[data-delete-student]")
    .forEach(b => {

      b.onclick = async () => {

        if (!confirm("Delete this student?"))
          return;

        try {

          await deleteDoc(
            doc(
              db,
              "students",
              b.dataset.deleteStudent
            )
          );

          await openSection("students");

        } catch (e) {

          alert(
            "Delete failed: " +
            (e.code || e.message)
          );
        }
      };
    });
}


/* =========================
   ATTENDANCE
========================= */

function renderAttendance(rows) {

  const today =
    new Date().toISOString().slice(0, 10);

  const data = [...rows].sort(
    (a, b) =>
      String(b.date || "")
        .localeCompare(String(a.date || ""))
  );

  $("panelBody").innerHTML = `
    <div class="studentTools">

      <input
        id="attendanceSearch"
        placeholder="🔍 Student number or name"
      >

      <input
        id="attendanceDate"
        type="date"
        value="${today}"
      >

      <button
        id="addAttendanceBtn"
        class="primary"
      >
        ➕ Mark Attendance
      </button>

    </div>

    <div
      id="attendanceForm"
      class="formbox hidden"
    ></div>

    <div class="tablewrap">

      <table>

        <thead>
          <tr>
            <th>Date</th>
            <th>Student No.</th>
            <th>Name</th>
            <th>Status</th>
            <th>Remarks</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody id="attendanceList"></tbody>

      </table>

    </div>
  `;

  const draw = () => {

    const q =
      $("attendanceSearch")
        .value
        .trim()
        .toLowerCase();

    const d =
      $("attendanceDate").value;

    const filtered =
      data.filter(r =>

        (!d || r.date === d) &&

        (
          !q ||

          String(r.studentNumber || "")
            .toLowerCase()
            .includes(q) ||

          String(
            r.studentName ||
            r.name ||
            ""
          )
            .toLowerCase()
            .includes(q)
        )
      );

    $("attendanceList").innerHTML =
      filtered.length

        ? filtered.map(r => `
            <tr>

              <td>${escapeHtml(r.date || "")}</td>

              <td>
                ${escapeHtml(
                  r.studentNumber ||
                  r.studentId ||
                  ""
                )}
              </td>

              <td>
                ${escapeHtml(
                  r.studentName ||
                  r.name ||
                  ""
                )}
              </td>

              <td>${escapeHtml(r.status || "")}</td>

              <td>${escapeHtml(r.remarks || "")}</td>

              <td class="actions">

                <button
                  class="smallbtn"
                  data-edit-att="${escapeAttr(r.id)}"
                >
                  Edit
                </button>

                <button
                  class="smallbtn danger"
                  data-delete-att="${escapeAttr(r.id)}"
                >
                  Delete
                </button>

              </td>

            </tr>
          `).join("")

        : `
          <tr>
            <td colspan="6">
              No attendance records for this date.
            </td>
          </tr>
        `;


    document
      .querySelectorAll("[data-edit-att]")
      .forEach(b => {

        b.onclick = async () => {

          const s =
            await getDoc(
              doc(
                db,
                "attendance",
                b.dataset.editAtt
              )
            );

          if (s.exists()) {

            showAttendanceForm({
              id: s.id,
              ...s.data()
            });
          }
        };
      });


    document
      .querySelectorAll("[data-delete-att]")
      .forEach(b => {

        b.onclick = async () => {

          if (
            !confirm(
              "Delete this attendance record?"
            )
          ) return;

          await deleteDoc(
            doc(
              db,
              "attendance",
              b.dataset.deleteAtt
            )
          );

          await openSection("attendance");
        };
      });
  };


  $("attendanceSearch").oninput = draw;

  $("attendanceDate").onchange = draw;

  $("addAttendanceBtn").onclick =
    () =>
      showAttendanceForm({
        date:
          $("attendanceDate").value
      });

  draw();
}


function showAttendanceForm(rec = null) {

  const f =
    $("attendanceForm");

  f.classList.remove("hidden");

  f.innerHTML = `

    <h4>
      ${
        rec?.id
          ? "✏️ Edit Attendance"
          : "➕ Mark Attendance"
      }
    </h4>

    <div class="formgrid">

      <div>
        <label>Date / തീയതി</label>

        <input
          id="aDate"
          type="date"
          value="${escapeAttr(
            rec?.date ||
            new Date()
              .toISOString()
              .slice(0, 10)
          )}"
        >
      </div>

      <div>
        <label>Student Number / നമ്പർ</label>

        <input
          id="aStudentNo"
          value="${escapeAttr(
            rec?.studentNumber ||
            rec?.studentId
          )}"
        >
      </div>

      <div>
        <label>Student Name / പേര്</label>

        <input
          id="aStudentName"
          value="${escapeAttr(
            rec?.studentName ||
            rec?.name
          )}"
        >
      </div>

      <div>

        <label>Status / ഹാജർ</label>

        <select id="aStatus">

          <option
            value="Present"
            ${
              rec?.status === "Present"
                ? "selected"
                : ""
            }
          >
            Present / ഹാജർ
          </option>

          <option
            value="Absent"
            ${
              rec?.status === "Absent"
                ? "selected"
                : ""
            }
          >
            Absent / ഹാജരില്ല
          </option>

          <option
            value="Leave"
            ${
              rec?.status === "Leave"
                ? "selected"
                : ""
            }
          >
            Leave / ലീവ്
          </option>

        </select>

      </div>

      <div>

        <label>Remarks / കുറിപ്പ്</label>

        <input
          id="aRemarks"
          value="${escapeAttr(rec?.remarks)}"
        >

      </div>

    </div>

    <div class="formactions">

      <button
        id="saveAttendance"
        class="primary"
      >
        Save Attendance
      </button>

      <button id="cancelAttendance">
        Cancel
      </button>

    </div>

    <div
      id="attendanceMsg"
      class="msg"
    ></div>
  `;


  $("cancelAttendance").onclick =
    () => f.classList.add("hidden");


  $("saveAttendance").onclick =
    async () => {

      const payload = {

        date:
          $("aDate").value,

        studentNumber:
          $("aStudentNo")
            .value
            .trim(),

        studentName:
          $("aStudentName")
            .value
            .trim(),

        status:
          $("aStatus").value,

        remarks:
          $("aRemarks")
            .value
            .trim(),

        updatedAt:
          new Date().toISOString()
      };


      if (
        !payload.date ||
        !payload.studentNumber
      ) {

        $("attendanceMsg").textContent =
          "Date and Student Number are required.";

        return;
      }


      try {

        $("saveAttendance").disabled =
          true;


        if (rec?.id) {

          await updateDoc(
            doc(
              db,
              "attendance",
              rec.id
            ),
            payload
          );

        } else {

          await addDoc(
            collection(
              db,
              "attendance"
            ),
            {
              ...payload,
              createdAt:
                new Date().toISOString()
            }
          );
        }


        await openSection("attendance");

      } catch (e) {

        $("attendanceMsg").textContent =
          "Save failed: " +
          (e.code || e.message);

        $("saveAttendance").disabled =
          false;
      }
    };
}


/* =========================
   PARENT DASHBOARD
========================= */

async function renderParentDashboard(userData) {

  const linkedNumber =
    String(
      userData.studentNumber || ""
    ).trim();

  const body =
    $("parentBody");


  body.innerHTML = `

    <div class="parentTools">

      <div>

        <b>
          Parent Portal /
          രക്ഷിതാക്കളുടെ പോർട്ടൽ
        </b>

        <div style="margin-top:6px">
          Student Number /
          വിദ്യാർത്ഥി നമ്പർ
        </div>

      </div>

      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        "
      >

        <input
          id="parentStudentNo"
          placeholder="Enter Student Number"
          value="${escapeAttr(linkedNumber)}"
        >

        <button
          id="parentLookupBtn"
          class="primary"
        >
          🔍 View Details
        </button>

      </div>

      <div
        id="parentLookupMsg"
        class="msg"
      ></div>

    </div>

    <div id="parentContent">

      <div class="empty">
        Enter your child's Student Number
        to view details.
      </div>

    </div>
  `;


  $("parentLookupBtn").onclick =
    () =>
      loadParentStudent(
        userData,
        $("parentStudentNo")
          .value
          .trim()
      );


  if (linkedNumber) {

    await loadParentStudent(
      userData,
      linkedNumber
    );
  }
}


/* =========================
   LOAD PARENT STUDENT
========================= */

async function loadParentStudent(
  userData,
  studentNumber
) {

  const content =
    $("parentContent");

  const msg =
    $("parentLookupMsg");


  if (!studentNumber) {

    msg.textContent =
      "Student Number is required.";

    return;
  }


  msg.textContent = "";

  content.innerHTML =
    "<p>Loading...</p>";


  try {

    const linked =
      String(
        userData.studentNumber || ""
      ).trim();


    if (
      linked &&
      linked !== studentNumber
    ) {

      content.innerHTML = `
        <div class="empty">
          This Student Number is not
          linked to this parent account.
        </div>
      `;

      return;
    }


    const [
      studentSnap,
      attendanceSnap,
      studySnap,
      resultsSnap,
      noticesSnap,
      leaveSnap
    ] = await Promise.all([

      getDocs(
        query(
          collection(db, "students"),
          where(
            "studentNumber",
            "==",
            studentNumber
          )
        )
      ),

      getDocs(
        query(
          collection(db, "attendance"),
          where(
            "studentNumber",
            "==",
            studentNumber
          )
        )
      ),

      getDocs(
        query(
          collection(db, "studyRecords"),
          where(
            "studentNumber",
            "==",
            studentNumber
          )
        )
      ),

      getDocs(
        query(
          collection(db, "results"),
          where(
            "studentNumber",
            "==",
            studentNumber
          )
        )
      ),

      getDocs(
        collection(db, "notices")
      ),

      getDocs(
        query(
          collection(db, "leaveRequests"),
          where(
            "studentNumber",
            "==",
            studentNumber
          )
        )
      )
    ]);


    const studentDoc =
      studentSnap.docs[0];


    const student =
      studentDoc
        ? {
            id: studentDoc.id,
            ...studentDoc.data()
          }
        : null;


    if (!student) {

      content.innerHTML = `
        <div class="empty">

          Student Number
          <b>
            ${escapeHtml(studentNumber)}
          </b>

          not found.

        </div>
      `;

      return;
    }


    const attendance =
      attendanceSnap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .sort(
          (a, b) =>
            String(b.date || "")
              .localeCompare(
                String(a.date || "")
              )
        )
        .slice(0, 15);


    const study =
      studySnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));


    const results =
      resultsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));


    const notices =
      noticesSnap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .sort(
          (a, b) =>
            String(b.createdAt || "")
              .localeCompare(
                String(a.createdAt || "")
              )
        )
        .slice(0, 10);


    const leaves =
      leaveSnap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .sort(
          (a, b) =>
            String(b.appliedAt || "")
              .localeCompare(
                String(a.appliedAt || "")
              )
        );


    content.innerHTML = `

      <div class="parentCards">


        <div class="pcard">

          <h4>
            👤 Profile /
            വ്യക്തിഗത വിവരങ്ങൾ
          </h4>

          <p>
            <b>Student No:</b>
            ${escapeHtml(student.studentNumber)}
          </p>

          <p>
            <b>Name:</b>
            ${escapeHtml(student.name)}
          </p>

          <p>
            <b>Parent:</b>
            ${escapeHtml(student.parentName)}
          </p>

          <p>
            <b>Class:</b>
            ${escapeHtml(student.classBatch)}
          </p>

          <p>
            <b>Phone:</b>
            ${escapeHtml(student.phone)}
          </p>

          <p>
            <b>Teacher:</b>
            ${escapeHtml(student.assignedTeacher)}
          </p>

          <p>
            <b>Address:</b>
            ${escapeHtml(student.address)}
          </p>

          <p>
            <b>Date of Birth:</b>
            ${escapeHtml(student.dateOfBirth)}
          </p>

          <p>
            <b>Admission Date:</b>
            ${escapeHtml(student.admissionDate)}
          </p>

          <p>
            <b>Status:</b>
            ${escapeHtml(student.status || "Active")}
          </p>

        </div>


        <div class="pcard">

          <h4>
            📅 Attendance /
            ഹാജർ
          </h4>

          ${
            attendance.length
              ? readOnlyTableHtml(
                  attendance,
                  [
                    "date",
                    "status",
                    "remarks"
                  ]
                )
              : "<p>No attendance records.</p>"
          }

        </div>


        <div class="pcard">

          <h4>
            📖 Study /
            പഠന പുരോഗതി
          </h4>

          ${
            study.length
              ? readOnlyTableHtml(
                  study,
                  Object.keys(study[0])
                    .filter(k => k !== "id")
                    .slice(0, 6)
                )
              : "<p>No study records.</p>"
          }

        </div>


        <div class="pcard">

          <h4>
            🏆 Results /
            റിസൾട്ട്
          </h4>

          ${
            results.length
              ? readOnlyTableHtml(
                  results,
                  Object.keys(results[0])
                    .filter(k => k !== "id")
                    .slice(0, 6)
                )
              : "<p>No results yet.</p>"
          }

        </div>


        <div class="pcard">

          <h4>
            📢 Notices /
            അറിയിപ്പുകൾ
          </h4>

          ${
            notices.length
              ? notices.map(n => `
                  <div class="notice">

                    <b>
                      ${escapeHtml(
                        n.title || "Notice"
                      )}
                    </b>

                    <div>
                      ${escapeHtml(
                        n.message ||
                        n.text ||
                        ""
                      )}
                    </div>

                  </div>
                `).join("")
              : "<p>No notices.</p>"
          }

        </div>


        <div class="pcard">

          <h4>
            📝 Leave /
            ലീവ്
          </h4>

          <button
            id="applyLeaveBtn"
            class="primary"
          >
            ➕ Apply Leave /
            ലീവ് അപേക്ഷിക്കുക
          </button>

          <div
            id="leaveFormWrap"
            class="formbox hidden"
          ></div>

          <div class="tablewrap">

            <table>

              <thead>

                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Review</th>
                </tr>

              </thead>

              <tbody>

                ${
                  leaves.length

                    ? leaves.map(x => `
                        <tr>

                          <td>
                            ${escapeHtml(x.fromDate)}
                          </td>

                          <td>
                            ${escapeHtml(x.toDate)}
                          </td>

                          <td>
                            ${escapeHtml(x.reason)}
                          </td>

                          <td>
                            <b>
                              ${escapeHtml(
                                x.status ||
                                "Pending"
                              )}
                            </b>
                          </td>

                          <td>
                            ${escapeHtml(
                              x.reviewRemark ||
                              ""
                            )}
                          </td>

                        </tr>
                      `).join("")

                    : `
                      <tr>
                        <td colspan="5">
                          No leave requests yet.
                        </td>
                      </tr>
                    `
                }

              </tbody>

            </table>

          </div>

        </div>

      </div>
    `;


    $("applyLeaveBtn").onclick =
      () =>
        showParentLeaveForm(
          studentNumber,
          student.name
        );

  } catch (e) {

    console.error(e);

    content.innerHTML = `
      <div class="msg">

        Could not load parent data:

        ${escapeHtml(
          e.code || e.message
        )}

      </div>
    `;
  }
}


/* =========================
   READ ONLY TABLE
========================= */

function readOnlyTableHtml(
  rows,
  fields
) {

  let h = `
    <div class="tablewrap">

      <table>

        <thead>

          <tr>

            ${fields
              .map(
                f =>
                  `<th>${escapeHtml(f)}</th>`
              )
              .join("")}

          </tr>

        </thead>

        <tbody>
  `;


  for (const r of rows) {

    h += `
      <tr>

        ${
          fields
            .map(
              f =>
                `<td>${escapeHtml(r[f])}</td>`
            )
            .join("")
        }

      </tr>
    `;
  }


  return h + `
        </tbody>

      </table>

    </div>
  `;
}


/* =========================
   PARENT LEAVE
========================= */

function showParentLeaveForm(
  studentNumber,
  studentName
) {

  const w =
    $("leaveFormWrap");

  w.classList.remove("hidden");


  w.innerHTML = `

    <h4>
      📝 Leave Application /
      ലീവ് അപേക്ഷ
    </h4>

    <div class="formgrid">

      <div>

        <label>
          From Date
        </label>

        <input
          id="pFrom"
          type="date"
        >

      </div>

      <div>

        <label>
          To Date
        </label>

        <input
          id="pTo"
          type="date"
        >

      </div>

      <div
        style="grid-column:1/-1"
      >

        <label>
          Reason / കാരണം
        </label>

        <textarea
          id="pReason"
          placeholder="Reason for leave"
        ></textarea>

      </div>

    </div>

    <div class="formactions">

      <button
        id="saveParentLeave"
        class="primary"
      >
        Submit Leave
      </button>

      <button
        id="cancelParentLeave"
      >
        Cancel
      </button>

    </div>

    <div
      id="parentLeaveMsg"
      class="msg"
    ></div>
  `;


  $("cancelParentLeave").onclick =
    () =>
      w.classList.add("

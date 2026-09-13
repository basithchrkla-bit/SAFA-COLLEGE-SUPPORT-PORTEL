import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

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

import { firebaseConfig } from "./firebase-config.js";


/* =========================
   FIREBASE
========================= */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);


/* =========================
   HELPERS
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function show(id) {
  $(id)?.classList.remove("hidden");
}

function hide(id) {
  $(id)?.classList.add("hidden");
}


/* =========================
   LOGIN
========================= */

$("loginBtn")?.addEventListener("click", async () => {

  const email = $("email")?.value.trim() || "";
  const password = $("password")?.value || "";

  if ($("msg")) $("msg").textContent = "";

  if (!email || !password) {
    if ($("msg")) {
      $("msg").textContent =
        "Email and password are required.";
    }
    return;
  }

  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Logging in...";

  try {

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  } catch (e) {

    console.error(e);

    if ($("msg")) {
      $("msg").textContent =
        "Login failed: " +
        (e.code || e.message);
    }

  } finally {

    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Login";
  }
});


/* =========================
   LOGOUT
========================= */

$("logout")?.addEventListener("click", async () => {

  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
  }

});


/* =========================
   CLOSE PANEL
========================= */

$("closePanel")?.addEventListener("click", () => {
  hide("panel");
});


/* =========================
   MENU BUTTONS
========================= */

document
  .querySelectorAll("[data-section]")
  .forEach(button => {

    button.addEventListener("click", () => {

      const section =
        button.dataset.section;

      openSection(section);
    });

  });


/* =========================
   AUTH STATE
========================= */

onAuthStateChanged(auth, async user => {

  if (!user) {

    show("login");
    hide("dash");
    hide("admin");
    hide("parent");
    hide("teacher");
    hide("panel");

    return;
  }


  hide("login");
  show("dash");

  hide("admin");
  hide("parent");
  hide("teacher");
  hide("panel");


  if ($("user")) {
    $("user").textContent =
      user.email || "";
  }


  if ($("uid")) {
    $("uid").textContent =
      "Signed-in UID: " + user.uid;
  }


  if ($("status")) {
    $("status").textContent =
      "Reading users/" +
      user.uid +
      " …";
  }


  try {

    const userRef =
      doc(
        db,
        "users",
        user.uid
      );

    const userSnap =
      await getDoc(userRef);


    if (!userSnap.exists()) {

      $("status").innerHTML =
        "⚠️ users document not found.<br>" +
        "<small>Expected document ID:</small><br>" +
        "<b>" +
        escapeHtml(user.uid) +
        "</b>";

      return;
    }


    const userData =
      userSnap.data() || {};


    const role =
      String(
        userData.role || ""
      )
      .trim()
      .toLowerCase();


    /* ADMIN */

    if (role === "admin") {

      $("status").textContent =
        "✅ Role detected: admin";

      $("dashTitle").textContent =
        "Super Admin Dashboard";

      show("admin");

      return;
    }


    /* PARENT */

    if (role === "parent") {

      $("status").textContent =
        "✅ Role detected: parent";

      $("dashTitle").textContent =
        "Parent Dashboard";

      show("parent");

      await renderParentDashboard(
        userData
      );

      return;
    }


    /* TEACHER */

    if (role === "teacher") {

      $("status").textContent =
        "✅ Role detected: teacher";

      $("dashTitle").textContent =
        "Teacher Dashboard";

      show("teacher");

      return;
    }


    $("status").textContent =
      "⚠️ Unknown role: " +
      (role || "EMPTY");


  } catch (e) {

    console.error(e);

    $("status").innerHTML =
      "⚠️ Firestore error:<br>" +
      escapeHtml(
        e.code || e.message
      );
  }

});


/* =========================
   LABELS
========================= */

const labels = {

  students:
    "Students / വിദ്യാർത്ഥികൾ",

  teachers:
    "Teachers / അധ്യാപകർ",

  attendance:
    "Attendance / ഹാജർ",

  studyRecords:
    "Study / പഠന പുരോഗതി",

  leaveRequests:
    "Leave / ലീവ്",

  results:
    "Results / റിസൾട്ട്",

  notices:
    "Notices / അറിയിപ്പുകൾ",

  users:
    "Users / അക്കൗണ്ടുകൾ"

};


/* =========================
   GET COLLECTION
========================= */

async function getAll(name) {

  const snap =
    await getDocs(
      collection(db, name)
    );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

}


/* =========================
   OPEN SECTION
========================= */

async function openSection(name) {

  show("panel");

  $("panelTitle").textContent =
    labels[name] || name;

  $("panelBody").innerHTML =
    "<p>Loading...</p>";


  try {

    const rows =
      await getAll(name);


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


    if (name === "notices") {
      renderNotices(rows);
      return;
    }


    $("panelBody").innerHTML =
      rows.length
        ? tableHtml(
            rows,
            Object.keys(rows[0])
              .filter(k => k !== "id")
              .slice(0, 8)
          )
        : "<div class='empty'>No records yet.</div>";


  } catch (e) {

    $("panelBody").innerHTML =
      "<p class='msg'>Error: " +
      escapeHtml(
        e.code || e.message
      ) +
      "</p>";

  }

}


/* =========================
   STUDENTS
========================= */

function renderStudents(rows) {

  const data =
    [...rows].sort(
      (a, b) =>
        String(
          a.studentNumber || ""
        ).localeCompare(
          String(
            b.studentNumber || ""
          )
        )
    );


  $("panelBody").innerHTML = `

    <div class="studentTools">

      <input
        id="studentSearch"
        placeholder="🔍 Search student number or name"
      >

      <button
        id="addStudentBtn"
        class="primary"
      >
        ➕ Add Student
      </button>

    </div>

    <div
      id="studentForm"
      class="formbox hidden"
    ></div>

    <div id="studentList"></div>

  `;


  const draw = () => {

    const text =
      $("studentSearch")
        .value
        .trim()
        .toLowerCase();


    const filtered =
      data.filter(r =>

        String(
          r.studentNumber || ""
        )
        .toLowerCase()
        .includes(text)

        ||

        String(
          r.name || ""
        )
        .toLowerCase()
        .includes(text)

      );


    $("studentList").innerHTML =
      filtered.length
        ? studentsTable(filtered)
        : "<div class='empty'>No students found.</div>";


    bindStudentActions();

  };


  $("studentSearch").oninput =
    draw;


  $("addStudentBtn").onclick =
    () => showStudentForm();


  draw();

}


function studentsTable(rows) {

  let html = `

    <div class="tablewrap">

      <table>

        <thead>

          <tr>
            <th>Student No.</th>
            <th>Name</th>
            <th>Parent</th>
            <th>Class</th>
            <th>Phone</th>
            <th>Teacher</th>
            <th>Status</th>
            <th>Action</th>
          </tr>

        </thead>

        <tbody>

  `;


  rows.forEach(r => {

    html += `

      <tr>

        <td>
          ${escapeHtml(r.studentNumber)}
        </td>

        <td>
          ${escapeHtml(r.name)}
        </td>

        <td>
          ${escapeHtml(r.parentName)}
        </td>

        <td>
          ${escapeHtml(r.classBatch)}
        </td>

        <td>
          ${escapeHtml(r.phone)}
        </td>

        <td>
          ${escapeHtml(r.assignedTeacher)}
        </td>

        <td>
          ${escapeHtml(
            r.status || "Active"
          )}
        </td>

        <td class="actions">

          <button
            class="smallbtn"
            data-edit-student="${escapeAttr(r.id)}"
          >
            Edit
          </button>

          <button
            class="smallbtn danger"
            data-delete-student="${escapeAttr(r.id)}"
          >
            Delete
          </button>

        </td>

      </tr>

    `;

  });


  html += `

        </tbody>

      </table>

    </div>

  `;


  return html;

}


/* =========================
   STUDENT FORM
========================= */

function showStudentForm(student = null) {

  const f =
    $("studentForm");

  show("studentForm");


  f.innerHTML = `

    <h4>
      ${
        student
          ? "✏️ Edit Student"
          : "➕ Add Student"
      }
    </h4>


    <div class="formgrid">


      <div>
        <label>
          Student Number / വിദ്യാർത്ഥി നമ്പർ
        </label>

        <input
          id="sNo"
          value="${escapeAttr(
            student?.studentNumber
          )}"
          placeholder="e.g. 131"
        >
      </div>


      <div>
        <label>
          Student Name / പേര്
        </label>

        <input
          id="sName"
          value="${escapeAttr(
            student?.name
          )}"
        >
      </div>


      <div>
        <label>
          Parent Name / രക്ഷിതാവ്
        </label>

        <input
          id="sParent"
          value="${escapeAttr(
            student?.parentName
          )}"
        >
      </div>


      <div>
        <label>
          Class / Batch
        </label>

        <input
          id="sClass"
          value="${escapeAttr(
            student?.classBatch
          )}"
        >
      </div>


      <div>
        <label>
          Phone Number / ഫോൺ
        </label>

        <input
          id="sPhone"
          value="${escapeAttr(
            student?.phone
          )}"
        >
      </div>


      <div>
        <label>
          Assigned Teacher / അധ്യാപകൻ
        </label>

        <input
          id="sTeacher"
          value="${escapeAttr(
            student?.assignedTeacher
          )}"
        >
      </div>


      <div>

        <label>
          Address / വിലാസം
        </label>

        <textarea id="sAddress">
${escapeHtml(student?.address)}
        </textarea>

      </div>


      <div>

        <label>
          Date of Birth / ജനനത്തീയതി
        </label>

        <input
          id="sDob"
          type="date"
          value="${escapeAttr(
            student?.dateOfBirth
          )}"
        >

      </div>


      <div>

        <label>
          Admission Date / പ്രവേശന തീയതി
        </label>

        <input
          id="sAdmission"
          type="date"
          value="${escapeAttr(
            student?.admissionDate
          )}"
        >

      </div>


      <div>

        <label>Status / നിലവാരം</label>

        <select id="sStatus">

          <option
            value="Active"
            ${
              (student?.status ||
              "Active") === "Active"
                ? "selected"
                : ""
            }
          >
            Active / സജീവം
          </option>

          <option
            value="Inactive"
            ${
              student?.status === "Inactive"
                ? "selected"
                : ""
            }
          >
            Inactive / നിർജ്ജീവം
          </option>

        </select>

      </div>


    </div>


    <div class="formactions">

      <button
        id="saveStudent"
        class="primary"
      >
        ${
          student
            ? "Save Changes"
            : "Save Student"
        }
      </button>

      <button id="cancelStudent">
        Cancel
      </button>

    </div>


    <div
      id="studentFormMsg"
      class="msg"
    ></div>

  `;


  $("cancelStudent").onclick =
    () => hide("studentForm");


  $("saveStudent").onclick =
    async () => {

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


      if (
        !payload.studentNumber ||
        !payload.name
      ) {

        $("studentFormMsg").textContent =
          "Student Number and Name are required.";

        return;
      }


      try {

        $("saveStudent").disabled =
          true;


        if (student?.id) {

          await updateDoc(
            doc(
              db,
              "students",
              student.id
            ),
            payload
          );

        } else {

          await addDoc(
            collection(
              db,
              "students"
            ),
            {
              ...payload,
              createdAt:
                new Date().toISOString()
            }
          );

        }


        await openSection(
          "students"
        );


      } catch (e) {

        $("studentFormMsg").textContent =
          "Save failed: " +
          (e.code || e.message);

        $("saveStudent").disabled =
          false;
      }

    };

}


function bindStudentActions() {

  document
    .querySelectorAll(
      "[data-edit-student]"
    )
    .forEach(button => {

      button.onclick =
        async () => {

          const snap =
            await getDoc(
              doc(
                db,
                "students",
                button.dataset
                  .editStudent
              )
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
    .querySelectorAll(
      "[data-delete-student]"
    )
    .forEach(button => {

      button.onclick =
        async () => {

          if (
            !confirm(
              "Delete this student?"
            )
          ) return;


          try {

            await deleteDoc(
              doc(
                db,
                "students",
                button.dataset
                  .deleteStudent
              )
            );


            await openSection(
              "students"
            );

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
   TEACHERS
========================= */

function renderTeachers(rows) {

  $("panelBody").innerHTML = `

    <div class="studentTools">

      <input
        id="teacherSearch"
        placeholder="🔍 Search teacher"
      >

      <button
        id="addTeacherBtn"
        class="primary"
      >
        ➕ Add Teacher
      </button>

    </div>

    <div
      id="teacherForm"
      class="formbox hidden"
    ></div>

    <div id="teacherList"></div>

  `;


  const draw = () => {

    const q =
      $("teacherSearch")
        .value
        .trim()
        .toLowerCase();


    const filtered =
      rows.filter(r =>

        String(r.name || "")
          .toLowerCase()
          .includes(q)

        ||

        String(r.phone || "")
          .toLowerCase()
          .includes(q)

        ||

        String(r.email || "")
          .toLowerCase()
          .includes(q)

      );


    $("teacherList").innerHTML =
      filtered.length
        ? teacherTable(filtered)
        : "<div class='empty'>No teachers found.</div>";


    bindTeacherActions();

  };


  $("teacherSearch").oninput =
    draw;


  $("addTeacherBtn").onclick =
    () => showTeacherForm();


  draw();

}


function teacherTable(rows) {

  let html = `

    <div class="tablewrap">

      <table>

        <thead>

          <tr>
            <th>Name</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Action</th>
          </tr>

        </thead>

        <tbody>

  `;


  rows.forEach(r => {

    html += `

      <tr>

        <td>${escapeHtml(r.name)}</td>

        <td>${escapeHtml(r.phone)}</td>

        <td>${escapeHtml(r.email)}</td>

        <td>${escapeHtml(r.subject)}</td>

        <td>
          ${escapeHtml(
            r.status || "Active"
          )}
        </td>

        <td>

          <button
            class="smallbtn"
            data-edit-teacher="${escapeAttr(r.id)}"
          >
            Edit
          </button>

          <button
            class="smallbtn danger"
            data-delete-teacher="${escapeAttr(r.id)}"
          >
            Delete
          </button>

        </td>

      </tr>

    `;

  });


  return html +
    "</tbody></table></div>";

}


function showTeacherForm(teacher = null) {

  const f =
    $("teacherForm");

  show("teacherForm");


  f.innerHTML = `

    <h4>
      ${
        teacher
          ? "✏️ Edit Teacher"
          : "➕ Add Teacher"
      }
    </h4>


    <div class="formgrid">

      <div>
        <label>Name / പേര്</label>
        <input
          id="tName"
          value="${escapeAttr(
            teacher?.name
          )}"
        >
      </div>

      <div>
        <label>Phone / ഫോൺ</label>
        <input
          id="tPhone"
          value="${escapeAttr(
            teacher?.phone
          )}"
        >
      </div>

      <div>
        <label>Email</label>
        <input
          id="tEmail"
          type="email"
          value="${escapeAttr(
            teacher?.email
          )}"
        >
      </div>

      <div>
        <label>Subject / വിഷയം</label>
        <input
          id="tSubject"
          value="${escapeAttr(
            teacher?.subject
          )}"
        >
      </div>

      <div>

        <label>Status</label>

        <select id="tStatus">

          <option
            value="Active"
            ${
              (teacher?.status ||
              "Active") === "Active"
                ? "selected"
                : ""
            }
          >
            Active
          </option>

          <option
            value="Inactive"
            ${
              teacher?.status === "Inactive"
                ? "selected"
                : ""
            }
          >
            Inactive
          </option>

        </select>

      </div>

    </div>


    <div class="formactions">

      <button
        id="saveTeacher"
        class="primary"
      >
        ${
          teacher
            ? "Save Changes"
            : "Save Teacher"
        }
      </button>

      <button id="cancelTeacher">
        Cancel
      </button>

    </div>


    <div
      id="teacherFormMsg"
      class="msg"
    ></div>

  `;


  $("cancelTeacher").onclick =
    () => hide("teacherForm");


  $("saveTeacher").onclick =
    async () => {

      const payload = {

        name:
          $("tName").value.trim(),

        phone:
          $("tPhone").value.trim(),

        email:
          $("tEmail").value.trim(),

        subject:
          $("tSubject").value.trim(),

        status:
          $("tStatus").value,

        updatedAt:
          new Date().toISOString()

      };


      if (!payload.name) {

        $("teacherFormMsg").textContent =
          "Teacher name is required.";

        return;
      }


      try {

        if (teacher?.id) {

          await updateDoc(
            doc(
              db,
              "teachers",
              teacher.id
            ),
            payload
          );

        } else {

          await addDoc(
            collection(
              db,
              "teachers"
            ),
            {
              ...payload,
              createdAt:
                new Date().toISOString()
            }
          );

        }


        await openSection(
          "teachers"
        );

      } catch (e) {

        $("teacherFormMsg").textContent =
          "Save failed: " +
          (e.code || e.message);

      }

    };

}


function bindTeacherActions() {

  document
    .querySelectorAll(
      "[data-edit-teacher]"
    )
    .forEach(button => {

      button.onclick =
        async () => {

          const snap =
            await getDoc(
              doc(
                db,
                "teachers",
                button.dataset
                  .editTeacher
              )
            );


          if (snap.exists()) {

            showTeacherForm({
              id: snap.id,
              ...snap.data()
            });

          }

        };

    });


  document
    .querySelectorAll(
      "[data-delete-teacher]"
    )
    .forEach(button => {

      button.onclick =
        async () => {

          if (
            !confirm(
              "Delete this teacher?"
            )
          ) return;


          await deleteDoc(
            doc(
              db,
              "teachers",
              button.dataset
                .deleteTeacher
            )
          );


          await openSection(
            "teachers"
          );

        };

    });

}


/* =========================
   ATTENDANCE
========================= */

function renderAttendance(rows) {

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);


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


    <div
      class="tablewrap"
    >

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

        <tbody
          id="attendanceList"
        ></tbody>

      </table>

    </div>

  `;


  const draw = () => {

    const q =
      $("attendanceSearch")
        .value
        .trim()
        .toLowerCase();


    const date =
      $("attendanceDate").value;


    const filtered =
      rows.filter(r =>

        (!date ||
          r.date === date)

        &&

        (
          !q ||

          String(
            r.studentNumber || ""
          )
          .toLowerCase()
          .includes(q)

          ||

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

              <td>
                ${escapeHtml(r.date)}
              </td>

              <td>
                ${escapeHtml(
                  r.studentNumber ||
                  r.studentId
                )}
              </td>

              <td>
                ${escapeHtml(
                  r.studentName ||
                  r.name
                )}
              </td>

              <td>
                ${escapeHtml(r.status)}
              </td>

              <td>
                ${escapeHtml(r.remarks)}
              </td>

              <td>

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
      .querySelectorAll(
        "[data-edit-att]"
      )
      .forEach(button => {

        button.onclick =
          async () => {

            const snap =
              await getDoc(
                doc(
                  db,
                  "attendance",
                  button.dataset
                    .editAtt
                )
              );


            if (snap.exists()) {

              showAttendanceForm({
                id: snap.id,
                ...snap.data()
              });

            }

          };

      });


    document
      .querySelectorAll(
        "[data-delete-att]"
      )
      .forEach(button => {

        button.onclick =
          async () => {

            if (
              !confirm(
                "Delete this attendance record?"
              )
            ) return;


            await deleteDoc(
              doc(
                db,
                "attendance",
                button.dataset
                  .deleteAtt
              )
            );


            await openSection(
              "attendance"
            );

          };

      });

  };


  $("attendanceSearch").oninput =
    draw;

  $("attendanceDate").onchange =
    draw;


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

  show("attendanceForm");


  const defaultDate =
    new Date()
      .toISOString()
      .slice(0, 10);


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

        <label>Date</label>

        <input
          id="aDate"
          type="date"
          value="${escapeAttr(
            rec?.date ||
            defaultDate
          )}"
        >

      </div>


      <div>

        <label>
          Student Number
        </label>

        <input
          id="aStudentNo"
          value="${escapeAttr(
            rec?.studentNumber ||
            rec?.studentId
          )}"
        >

      </div>


      <div>

        <label>
          Student Name
        </label>

        <input
          id="aStudentName"
          value="${escapeAttr(
            rec?.studentName ||
            rec?.name
          )}"
        >

      </div>


      <div>

        <label>Status</label>

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

        <label>Remarks</label>

        <input
          id="aRemarks"
          value="${escapeAttr(
            rec?.remarks
          )}"
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
    () => hide("attendanceForm");


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


        await openSection(
          "attendance"
        );

      } catch (e) {

        $("attendanceMsg").textContent =
          "Save failed: " +
          (e.code || e.message);

      }

    };

}


/* =========================
   LEAVE
========================= */

function renderLeaveRequests(rows) {

  $("panelBody").innerHTML = `

    <div class="tablewrap">

      <table>

        <thead>

          <tr>
            <th>Student No.</th>
            <th>Name</th>
            <th>From</th>
            <th>To</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Action</th>
          </tr>

        </thead>

        <tbody>

          ${
            rows.length

              ? rows.map(r => `

                <tr>

                  <td>
                    ${escapeHtml(
                      r.studentNumber
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      r.studentName
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      r.fromDate
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      r.toDate
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      r.reason
                    )}
                  </td>

                  <td>
                    <b>
                      ${escapeHtml(
                        r.status ||
                        "Pending"
                      )}
                    </b>
                  </td>

                  <td>

                    ${
                      (r.status ||
                      "Pending") ===
                      "Pending"

                        ? `

                          <button
                            class="smallbtn"
                            data-approve-leave="${escapeAttr(r.id)}"
                          >
                            Confirm
                          </button>

                          <button
                            class="smallbtn danger"
                            data-reject-leave="${escapeAttr(r.id)}"
                          >
                            Reject
                          </button>

                        `

                        : escapeHtml(
                            r.reviewRemark ||
                            ""
                          )

                    }

                  </td>

                </tr>

              `).join("")

              : `

                <tr>
                  <td colspan="7">
                    No leave requests yet.
                  </td>
                </tr>

              `
          }

        </tbody>

      </table>

    </div>

  `;


  document
    .querySelectorAll(
      "[data-approve-leave]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          reviewLeave(
            button.dataset
              .approveLeave,
            "Approved"
          );

    });


  document
    .querySelectorAll(
      "[data-reject-leave]"
    )
    .forEach(button => {

      button.onclick =
        () =>
          reviewLeave(
            button.dataset
              .rejectLeave,
            "Rejected"
          );

    });

}


async function reviewLeave(
  id,
  status
) {

  const remark =
    prompt(
      status === "Rejected"
        ? "Reason for rejection (optional):"
        : "Review remark (optional):"
    ) || "";


  try {

    await updateDoc(
      doc(
        db,
        "leaveRequests",
        id
      ),
      {
        status,
        reviewRemark: remark,
        reviewedAt:
          new Date().toISOString()
      }
    );


    await openSection(
      "leaveRequests"
    );


  } catch (e) {

    alert(
      "Update failed: " +
      (e.code || e.message)
    );

  }

}


/* =========================
   NOTICES
========================= */

function renderNotices(rows) {

  $("panelBody").innerHTML = `

    <div class="studentTools">

      <button
        id="addNoticeBtn"
        class="primary"
      >
        ➕ Publish Notice
      </button>

    </div>


    <div
      id="noticeForm"
      class="formbox hidden"
    ></div>


    <div id="noticeList"></div>

  `;


  const draw = () => {

    $("noticeList").innerHTML =
      rows.length

        ? rows.map(r => `

            <div
              class="notice"
              style="margin-bottom:10px"
            >

              <b>
                ${escapeHtml(
                  r.title ||
                  "Notice"
                )}
              </b>

              <div>
                ${escapeHtml(
                  r.message ||
                  r.text ||
                  ""
                )}
              </div>

              <button
                class="smallbtn danger"
                data-delete-notice="${escapeAttr(r.id)}"
              >
                Delete
              </button>

            </div>

          `).join("")

        : "<div class='empty'>No notices yet.</div>";


    document
      .querySelectorAll(
        "[data-delete-notice]"
      )
      .forEach(button => {

        button.onclick =
          async () => {

            if (
              !confirm(
                "Delete this notice?"
              )
            ) return;


            await deleteDoc(
              doc(
                db,
                "notices",
                button.dataset
                  .deleteNotice
              )
            );


            await openSection(
              "notices"
            );

          };

      });

  };


  $("addNoticeBtn").onclick =
    () => {

      show("noticeForm");


      $("noticeForm").innerHTML = `

        <h4>
          ➕ Publish Notice
        </h4>

        <div class="formgrid">

          <div>

            <label>
              Title
            </label>

            <input id="nTitle">

          </div>


          <div
            style="grid-column:1/-1"
          >

            <label>
              Message
            </label>

            <textarea
              id="nMessage"
            ></textarea>

          </div>

        </div>


        <div class="formactions">

          <button
            id="saveNotice"
            class="primary"
          >
            Publish
          </button>

          <button
            id="cancelNotice"
          >
            Cancel
          </button>

        </div>


        <div
          id="noticeMsg"
          class="msg"
        ></div>

      `;


      $("cancelNotice").onclick =
        () => hide("noticeForm");


      $("saveNotice").onclick =
        async () => {

          const title =
            $("nTitle")
              .value
              .trim();

          const message =
            $("nMessage")
              .value
              .trim();


          if (!title || !message) {

            $("noticeMsg").textContent =
              "Title and message are required.";

            return;
          }


          try {

            await addDoc(
              collection(
                db,
                "notices"
              ),
              {
                title,
                message,
                createdAt:
                  new Date()
                    .toISOString()
              }
            );


            await openSection(
              "notices"
            );

          } catch (e) {

            $("noticeMsg").textContent =
              "Publish failed: " +
              (e.code || e.message);

          }

        };

    };


  draw();

}


/* =========================
   PARENT DASHBOARD
========================= */

async function renderParentDashboard(
  userData
) {

  const linkedNumber =
    String(
      userData.studentNumber ||
      ""
    ).trim();


  $("parentBody").innerHTML = `

    <div class="parentTools">

      <b>
        Parent Portal /
        രക്ഷിതാക്കളുടെ പോർട്ടൽ
      </b>

      <div>
        Student Number /
        വിദ്യാർത്ഥി നമ്പർ
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
          value="${escapeAttr(
            linkedNumber
          )}"
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


  content.innerHTML =
    "<p>Loading...</p>";


  try {

    const linked =
      String(
        userData.studentNumber ||
        ""
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


    const studentSnap =
      await getDocs(
        query(
          collection(
            db,
            "students"
          ),
          where(
            "studentNumber",
            "==",
            studentNumber
          )
        )
      );


    const studentDoc =
      studentSnap.docs[0];


    if (!studentDoc) {

      content.innerHTML = `

        <div class="empty">

          Student Number
          <b>
            ${escapeHtml(
              studentNumber
            )}
          </b>
          not found.

        </div>

      `;

      return;
    }


    const student = {
      id: studentDoc.id,
      ...studentDoc.data()
    };


    const [
      attendanceSnap,
      studySnap,
      resultsSnap,
      noticesSnap,
      leaveSnap
    ] =
      await Promise.all([

        getDocs(
          query(
            collection(
              db,
              "attendance"
            ),
            where(
              "studentNumber",
              "==",
              studentNumber
            )
          )
        ),

        getDocs(
          query(
            collection(
              db,
              "studyRecords"
            ),
            where(
              "studentNumber",
              "==",
              studentNumber
            )
          )
        ),

        getDocs(
          query(
            collection(
              db,
              "results"
            ),
            where(
              "studentNumber",
              "==",
              studentNumber
            )
          )
        ),

        getDocs(
          collection(
            db,
            "notices"
          )
        ),

        getDocs(
          query(
            collection(
              db,
              "leaveRequests"
            ),
            where(
              "studentNumber",
              "==",
              studentNumber
            )
          )
        )

      ]);


    const attendance =
      attendanceSnap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }))
        .sort(
          (a, b) =>
            String(
              b.date || ""
            ).localeCompare(
              String(
                a.date || ""
              )
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
        .slice(0, 10);


    const leaves =
      leaveSnap.docs
        .map(d => ({
          id: d.id,
          ...d.data()
        }));


    content.innerHTML = `

      <div class="parentCards">


        <div class="pcard">

          <h4>
            👤 Profile /
            വ്യക്തിഗത വിവരങ്ങൾ
          </h4>

          <p>
            <b>Student No:</b>
            ${escapeHtml(
              student.studentNumber
            )}
          </p>

          <p>
            <b>Name:</b>
            ${escapeHtml(
              student.name
            )}
          </p>

          <p>
            <b>Parent:</b>
            ${escapeHtml(
              student.parentName
            )}
          </p>

          <p>
            <b>Class:</b>
            ${escapeHtml(
              student.classBatch
            )}
          </p>

          <p>
            <b>Phone:</b>
            ${escapeHtml(
              student.phone
            )}
          </p>

          <p>
            <b>Teacher:</b>
            ${escapeHtml(
              student.assignedTeacher
            )}
          </p>

          <p>
            <b>Address:</b>
            ${escapeHtml(
              student.address
            )}
          </p>

          <p>
            <b>Date of Birth:</b>
            ${escapeHtml(
              student.dateOfBirth
            )}
          </p>

          <p>
            <b>Admission Date:</b>
            ${escapeHtml(
              student.admissionDate
            )}
          </p>

          <p>
            <b>Status:</b>
            ${escapeHtml(
              student.status ||
              "Active"
            )}
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
                  Object.keys(
                    study[0]
                  )
                  .filter(
                    k => k !== "id"
                  )
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
                  Object.keys(
                    results[0]
                  )
                  .filter(
                    k => k !== "id"
                  )
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

              ? notices.map(
                  n => `

                    <div class="notice">

                      <b>
                        ${escapeHtml(
                          n.title ||
                          "Notice"
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

                  `
                ).join("")

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
            ➕ Apply Leave
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

                    ? leaves.map(
                        x => `

                          <tr>

                            <td>
                              ${escapeHtml(
                                x.fromDate
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                x.toDate
                              )}
                            </td>

                            <td>
                              ${escapeHtml(
                                x.reason
                              )}
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

                        `
                      ).join("")

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
          e.code ||
          e.message
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

  let html = `

    <div class="tablewrap">

      <table>

        <thead>

          <tr>

            ${
              fields.map(
                f =>
                  `<th>${escapeHtml(f)}</th>`
              ).join("")
            }

          </tr>

        </thead>

        <tbody>

  `;


  rows.forEach(r => {

    html += `

      <tr>

        ${
          fields.map(
            f =>
              `<td>${escapeHtml(
                r[f]
              )}</td>`
          ).join("")
        }

      </tr>

    `;

  });


  return html +
    "</tbody></table></div>";

}


/* =========================
   PARENT LEAVE FORM
========================= */

function showParentLeaveForm(
  studentNumber,
  studentName
) {

  const w =
    $("leaveFormWrap");

  show("leaveFormWrap");


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
    () => hide("leaveFormWrap");


  $("saveParentLeave").onclick =
    async () => {

      const fromDate =
        $("pFrom").value;

      const toDate =
        $("pTo").value;

      const reason =
        $("pReason")
          .value
          .trim();


      if (
        !fromDate ||
        !toDate ||
        !reason
      ) {

        $("parentLeaveMsg").textContent =
          "From date, To date and Reason are required.";

        return;
      }


      if (toDate < fromDate) {

        $("parentLeaveMsg").textContent =
          "To date cannot be before From date.";

        return;
      }


      try {

        await addDoc(
          collection(
            db,
            "leaveRequests"
          ),
          {

            studentNumber,

            studentName,

            fromDate,

            toDate,

            reason,

            status:
              "Pending",

            appliedAt:
              new Date()
                .toISOString(),

            parentUid:
              auth.currentUser?.uid ||
              ""

          }
        );


        $("parentLeaveMsg").textContent =
          "✅ Leave application submitted.";


      } catch (e) {

        $("parentLeaveMsg").textContent =
          "Submit failed: " +
          (e.code || e.message);

      }

    };

}


/* =========================
   GENERIC TABLE
========================= */

function tableHtml(
  rows,
  fields
) {

  let html = `

    <div class="tablewrap">

      <table>

        <thead>

          <tr>

            ${
              fields.map(
                f =>
                  `<th>${escapeHtml(f)}</th>`
              ).join("")
            }

          </tr>

        </thead>

        <tbody>

  `;


  rows.forEach(r => {

    html += `

      <tr>

        ${
          fields.map(
            f =>
              `<td>${escapeHtml(
                r[f]
              )}</td>`
          ).join("")
        }

      </tr>

    `;

  });


  return html +
    "</tbody></table></div>";

}

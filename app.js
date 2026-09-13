import {initializeApp} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const $=id=>document.getElementById(id);

$("loginBtn").onclick=async()=>{
  $("msg").textContent="";
  try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);}
  catch(e){$("msg").textContent="Login failed: "+(e.code||e.message);}
};
$("logout").onclick=()=>signOut(auth);
$("closePanel").onclick=()=>$("panel").classList.add("hidden");
document.querySelectorAll("[data-section]").forEach(btn=>btn.addEventListener("click",()=>openSection(btn.dataset.section)));

onAuthStateChanged(auth,async u=>{
  if(!u){$("login").classList.remove("hidden");$("dash").classList.add("hidden");return;}
  $("login").classList.add("hidden");$("dash").classList.remove("hidden");
  $("admin").classList.add("hidden");$("parent").classList.add("hidden");$("teacher").classList.add("hidden");$("panel").classList.add("hidden");
  $("user").textContent=u.email||"";
  $("uid").textContent="Signed-in UID: "+u.uid;
  $("status").textContent="Reading users/"+u.uid+" …";
  $("debug").classList.add("hidden");
  try{
    const ref=doc(db,"users",u.uid);
    const snap=await getDoc(ref);
    if(!snap.exists()){
      $("status").innerHTML="⚠️ users document not found for this UID.";
      return;
    }
    const data=snap.data()||{};
    const keys=Object.keys(data);
    const rawRole=data["role"];
    const role=typeof rawRole==="string"?rawRole.trim().toLowerCase():String(rawRole??"").trim().toLowerCase();
if(role==="admin"){
      $("status").textContent="✅ Role detected: admin";
      $("dashTitle").textContent="Super Admin Dashboard";
      $("admin").classList.remove("hidden");
    }else if(role==="parent"){
      $("status").textContent="Role detected: parent";
      $("dashTitle").textContent="Parent Dashboard";
      $("parent").classList.remove("hidden");
    }else if(role==="teacher"){
      $("status").textContent="Role detected: teacher";
      $("dashTitle").textContent="Teacher Dashboard";
      $("teacher").classList.remove("hidden");
    }else{
      $("status").textContent="⚠️ Role value received: "+(role||"EMPTY");
    }
  }catch(e){
    console.error(e);
    $("status").textContent="⚠️ Firestore role check failed: "+(e.code||e.message);
  }
});

const labels={students:"Students / വിദ്യാർത്ഥികൾ",teachers:"Teachers / അധ്യാപകർ",attendance:"Attendance / ഹാജർ",studyRecords:"Study / പഠന പുരോഗതി",leaveRequests:"Leave / ലീവ്",results:"Results / റിസൾട്ട്",notices:"Notices / അറിയിപ്പുകൾ",users:"Users / അക്കൗണ്ടുകൾ"};

async function getAll(name){
  const s=await getDocs(collection(db,name));
  return s.docs.map(d=>({id:d.id,...d.data()}));
}

async function openSection(name){
  $("panel").classList.remove("hidden");
  $("panelTitle").textContent=labels[name]||name;
  $("panelBody").innerHTML="<p>Loading...</p>";
  try{
    const rows=await getAll(name);
    if(name==="students"){renderStudents(rows);return;}
    if(name==="teachers"){renderTeachers(rows);return;}
    if(name==="attendance"){renderAttendance(rows);return;}
    $("panelBody").innerHTML=rows.length
      ? tableHtml(rows,Object.keys(rows[0]).filter(k=>k!=="id").slice(0,6),name)
      : "<div class='empty'>No records yet.</div>";
  }catch(e){
    $("panelBody").innerHTML="<p class='msg'>Error: "+escapeHtml(e.message||e.code)+"</p>";
  }
}

function renderStudents(rows){
  const data=[...rows].sort((a,b)=>String(a.studentNumber||"").localeCompare(String(b.studentNumber||"")));
  let h=`
    <div class="studentTools">
      <input id="studentSearch" placeholder="🔍 Search student number or name">
      <button id="addStudentBtn" class="primary">➕ Add Student</button>
    </div>
    <div id="studentForm" class="formbox hidden"></div>
    <div id="studentList"></div>`;
  $("panelBody").innerHTML=h;
  const search=$("studentSearch");
  const draw=()=>{
    const q=search.value.trim().toLowerCase();
    const filtered=data.filter(r=>
      String(r.studentNumber||"").toLowerCase().includes(q) ||
      String(r.name||"").toLowerCase().includes(q));
    $("studentList").innerHTML=filtered.length
      ? studentsTable(filtered)
      : "<div class='empty'>No students found.</div>";
    bindStudentActions();
  };
  search.oninput=draw;
  $("addStudentBtn").onclick=()=>showStudentForm();
  draw();
}

function studentsTable(rows){
  let h=`<div class="tablewrap"><table><thead><tr>
    <th>Student No.</th><th>Name</th><th>Parent</th><th>Class / Batch</th><th>Phone</th><th>Teacher</th><th>Status</th><th>Action</th>
  </tr></thead><tbody>`;
  for(const r of rows){
    h+=`<tr>
      <td>${escapeHtml(r.studentNumber)}</td>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.parentName)}</td>
      <td>${escapeHtml(r.classBatch)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml(r.assignedTeacher)}</td>
      <td>${escapeHtml(r.status||"Active")}</td>
      <td class="actions">
        <button class="smallbtn" data-edit-student="${escapeHtml(r.id)}">Edit</button>
        <button class="smallbtn danger" data-delete-student="${escapeHtml(r.id)}">Delete</button>
      </td>
    </tr>`;
  }
  return h+"</tbody></table></div>";
}

function showStudentForm(student=null){
  const f=$("studentForm");
  f.classList.remove("hidden");
  f.innerHTML=`
    <h4>${student?"✏️ Edit Student":"➕ Add Student"}</h4>
    <div class="formgrid">
      <div><label>Student Number / വിദ്യാർത്ഥി നമ്പർ</label><input id="sNo" value="${escapeAttr(student?.studentNumber)}" placeholder="e.g. 1001"></div>
      <div><label>Student Name / പേര്</label><input id="sName" value="${escapeAttr(student?.name)}" placeholder="Student name"></div>
      <div><label>Parent Name / രക്ഷിതാവിന്റെ പേര്</label><input id="sParent" value="${escapeAttr(student?.parentName)}" placeholder="Parent name"></div>
      <div><label>Class / Batch</label><input id="sClass" value="${escapeAttr(student?.classBatch)}" placeholder="e.g. Hifz 1"></div>
      <div><label>Phone Number / ഫോൺ</label><input id="sPhone" value="${escapeAttr(student?.phone)}" placeholder="Phone number"></div>
      <div><label>Assigned Teacher / അധ്യാപകൻ</label><input id="sTeacher" value="${escapeAttr(student?.assignedTeacher)}" placeholder="Teacher name"></div>
      <div><label>Address / വിലാസം</label><textarea id="sAddress" placeholder="Address">${escapeHtml(student?.address)}</textarea></div>
      <div><label>Date of Birth / ജനനത്തീയതി</label><input id="sDob" type="date" value="${escapeAttr(student?.dateOfBirth)}"></div>
      <div><label>Admission Date / പ്രവേശന തീയതി</label><input id="sAdmission" type="date" value="${escapeAttr(student?.admissionDate)}"></div>
      <div><label>Status / നിലവാരം</label><select id="sStatus"><option value="Active" ${(student?.status||"Active")==="Active"?"selected":""}>Active / സജീവം</option><option value="Inactive" ${student?.status==="Inactive"?"selected":""}>Inactive / നിർജ്ജീവം</option></select></div>
    </div>
    <div class="formactions">
      <button id="saveStudent" class="primary">${student?"Save Changes":"Save Student"}</button>
      <button id="cancelStudent">Cancel</button>
    </div>
    <div id="studentFormMsg" class="msg"></div>`;
  $("cancelStudent").onclick=()=>f.classList.add("hidden");
  $("saveStudent").onclick=async()=>{
    const payload={
      studentNumber:$("sNo").value.trim(),
      name:$("sName").value.trim(),
      parentName:$("sParent").value.trim(),
      classBatch:$("sClass").value.trim(),
      phone:$("sPhone").value.trim(),
      assignedTeacher:$("sTeacher").value.trim(),
      address:$("sAddress").value.trim(),
      dateOfBirth:$("sDob").value,
      admissionDate:$("sAdmission").value,
      status:$("sStatus").value,
      updatedAt:new Date().toISOString()
    };
    if(!payload.studentNumber||!payload.name){
      $("studentFormMsg").textContent="Student Number and Name are required.";
      return;
    }
    $("saveStudent").disabled=true;
    try{
      if(student){
        await updateDoc(doc(db,"students",student.id),payload);
      }else{
        await addDoc(collection(db,"students"),{...payload,createdAt:new Date().toISOString()});
      }
      await openSection("students");
    }catch(e){
      $("studentFormMsg").textContent="Save failed: "+(e.code||e.message);
      $("saveStudent").disabled=false;
    }
  };
}

function bindStudentActions(){
  document.querySelectorAll("[data-edit-student]").forEach(b=>b.onclick=async()=>{
    const snap=await getDoc(doc(db,"students",b.dataset.editStudent));
    if(snap.exists()) showStudentForm({id:snap.id,...snap.data()});
  });
  document.querySelectorAll("[data-delete-student]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Delete this student?"))return;
    try{
      await deleteDoc(doc(db,"students",b.dataset.deleteStudent));
      await openSection("students");
    }catch(e){
      alert("Delete failed: "+(e.code||e.message));
    }
  });
}

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function escapeAttr(v){return escapeHtml(v).replace(/`/g,"&#096;");}

function tableHtml(rows,fields,collectionName){
 let h="<div class='tablewrap'><table><thead><tr>"+fields.map(f=>`<th>${escapeHtml(f)}</th>`).join("")+"<th>Action</th></tr></thead><tbody>";
 for(const r of rows)h+="<tr>"+fields.map(f=>`<td>${escapeHtml(r[f])}</td>`).join("")+`<td><button class="smallbtn" data-del="${escapeHtml(r.id)}">Delete</button></td></tr>`;
 h+="</tbody></table></div>";
 setTimeout(()=>document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
   if(!confirm("Delete this record?"))return;
   await deleteDoc(doc(db,collectionName,b.dataset.del));
   await openSection(collectionName);
 }),0);
 return h;
}



// Attendance management
function renderAttendance(rows){
  const today=new Date().toISOString().slice(0,10);
  const data=[...rows].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  let h=`
    <div class="studentTools">
      <input id="attendanceSearch" placeholder="🔍 Student number or name">
      <input id="attendanceDate" type="date" value="${today}">
      <button id="addAttendanceBtn" class="primary">➕ Mark Attendance</button>
    </div>
    <div id="attendanceForm" class="formbox hidden"></div>
    <div class="tablewrap"><table><thead><tr>
      <th>Date</th><th>Student No.</th><th>Name</th><th>Status</th><th>Remarks</th><th>Action</th>
    </tr></thead><tbody id="attendanceList"></tbody></table></div>`;
  $("panelBody").innerHTML=h;
  const draw=()=>{
    const q=$("attendanceSearch").value.trim().toLowerCase();
    const d=$("attendanceDate").value;
    const filtered=data.filter(r=>
      (!d || r.date===d) &&
      (!q || String(r.studentNumber||"").toLowerCase().includes(q) || String(r.studentName||r.name||"").toLowerCase().includes(q)));
    $("attendanceList").innerHTML=filtered.length ? filtered.map(r=>`<tr>
      <td>${escapeHtml(r.date||"")}</td>
      <td>${escapeHtml(r.studentNumber||r.studentId||"")}</td>
      <td>${escapeHtml(r.studentName||r.name||"")}</td>
      <td>${escapeHtml(r.status||"")}</td>
      <td>${escapeHtml(r.remarks||"")}</td>
      <td class="actions"><button class="smallbtn" data-edit-att="${escapeAttr(r.id)}">Edit</button>
      <button class="smallbtn danger" data-delete-att="${escapeAttr(r.id)}">Delete</button></td>
    </tr>`).join("") : `<tr><td colspan="6">No attendance records for this date.</td></tr>`;
    document.querySelectorAll("[data-edit-att]").forEach(b=>b.onclick=async()=>{
      const s=await getDoc(doc(db,"attendance",b.dataset.editAtt));
      if(s.exists()) showAttendanceForm({id:s.id,...s.data()});
    });
    document.querySelectorAll("[data-delete-att]").forEach(b=>b.onclick=async()=>{
      if(!confirm("Delete this attendance record?")) return;
      await deleteDoc(doc(db,"attendance",b.dataset.deleteAtt));
      await openSection("attendance");
    });
  };
  $("attendanceSearch").oninput=draw;
  $("attendanceDate").onchange=draw;
  $("addAttendanceBtn").onclick=()=>showAttendanceForm({date:$("attendanceDate").value});
  draw();
}

function showAttendanceForm(rec=null){
  const f=$("attendanceForm");
  f.classList.remove("hidden");
  f.innerHTML=`<h4>${rec?.id?"✏️ Edit Attendance":"➕ Mark Attendance"}</h4>
    <div class="formgrid">
      <div><label>Date / തീയതി</label><input id="aDate" type="date" value="${escapeAttr(rec?.date||new Date().toISOString().slice(0,10))}"></div>
      <div><label>Student Number / നമ്പർ</label><input id="aStudentNo" value="${escapeAttr(rec?.studentNumber||rec?.studentId)}" placeholder="1001"></div>
      <div><label>Student Name / പേര്</label><input id="aStudentName" value="${escapeAttr(rec?.studentName||rec?.name)}"></div>
      <div><label>Status / ഹാജർ</label><select id="aStatus">
        <option value="Present" ${rec?.status==="Present"?"selected":""}>Present / ഹാജർ</option>
        <option value="Absent" ${rec?.status==="Absent"?"selected":""}>Absent / ഹാജരില്ല</option>
        <option value="Leave" ${rec?.status==="Leave"?"selected":""}>Leave / ലീവ്</option>
      </select></div>
      <div><label>Remarks / കുറിപ്പ്</label><input id="aRemarks" value="${escapeAttr(rec?.remarks)}"></div>
    </div>
    <div class="formactions"><button id="saveAttendance" class="primary">Save Attendance</button><button id="cancelAttendance">Cancel</button></div>
    <div id="attendanceMsg" class="msg"></div>`;
  $("cancelAttendance").onclick=()=>f.classList.add("hidden");
  $("saveAttendance").onclick=async()=>{
    const payload={date:$("aDate").value,studentNumber:$("aStudentNo").value.trim(),studentName:$("aStudentName").value.trim(),status:$("aStatus").value,remarks:$("aRemarks").value.trim(),updatedAt:new Date().toISOString()};
    if(!payload.date||!payload.studentNumber){$("attendanceMsg").textContent="Date and Student Number are required.";return;}
    try{
      $("saveAttendance").disabled=true;
      if(rec?.id) await updateDoc(doc(db,"attendance",rec.id),payload);
      else await addDoc(collection(db,"attendance"),{...payload,createdAt:new Date().toISOString()});
      await openSection("attendance");
    }catch(e){$("attendanceMsg").textContent="Save failed: "+(e.code||e.message);$("saveAttendance").disabled=false;}
  };
}

// Teachers management
function renderTeachers(rows){
  let h = `
    <div class="studentTools">
      <button id="addTeacherBtn" class="primary">➕ Add Teacher</button>
    </div>
    <div id="teacherForm" class="formbox hidden"></div>
    <div class="tablewrap"><table>
      <thead><tr><th>Teacher ID</th><th>Name</th><th>Phone</th><th>Assigned Students</th><th>Action</th></tr></thead>
      <tbody id="teacherList"></tbody>
    </table></div>`;
  $("panelBody").innerHTML = h;
  drawTeachers(rows);
  $("addTeacherBtn").onclick = () => showTeacherForm();
}

function drawTeachers(rows){
  const body = $("teacherList");
  if(!rows.length){
    body.innerHTML = `<tr><td colspan="5">No records yet.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(r => {
    const ids = Array.isArray(r.assignedStudentIds)
      ? r.assignedStudentIds.join(", ")
      : (r.assignedStudents || "");
    return `<tr>
      <td>${escapeHtml(r.teacherId || "")}</td>
      <td>${escapeHtml(r.name || r.teacherName || "")}</td>
      <td>${escapeHtml(r.phone || "")}</td>
      <td>${escapeHtml(ids)}</td>
      <td class="actions">
        <button class="smallbtn" data-edit-teacher="${escapeHtml(r.id)}">Edit</button>
        <button class="smallbtn danger" data-delete-teacher="${escapeHtml(r.id)}">Delete</button>
      </td>
    </tr>`;
  }).join("");

  document.querySelectorAll("[data-edit-teacher]").forEach(b => b.onclick = async () => {
    const s = await getDoc(doc(db,"teachers",b.dataset.editTeacher));
    if(s.exists()) showTeacherForm({id:s.id,...s.data()});
  });

  document.querySelectorAll("[data-delete-teacher]").forEach(b => b.onclick = async () => {
    if(!confirm("Delete this teacher?")) return;
    try{
      await deleteDoc(doc(db,"teachers",b.dataset.deleteTeacher));
      await openSection("teachers");
    }catch(e){ alert("Delete failed: "+(e.code||e.message)); }
  });
}

function showTeacherForm(teacher=null){
  const f=$("teacherForm");
  f.classList.remove("hidden");
  f.innerHTML=`
    <h4>${teacher ? "✏️ Edit Teacher" : "➕ Add Teacher"}</h4>
    <div class="formgrid">
      <div><label>Teacher ID / അധ്യാപക ID</label><input id="tId" value="${escapeAttr(teacher?.teacherId)}" placeholder="e.g. UST001"></div>
      <div><label>Teacher Name / പേര്</label><input id="tName" value="${escapeAttr(teacher?.name || teacher?.teacherName)}"></div>
      <div><label>Phone Number / ഫോൺ</label><input id="tPhone" value="${escapeAttr(teacher?.phone)}"></div>
      <div><label>Assigned Students / വിദ്യാർത്ഥികൾ</label><input id="tStudents" value="${escapeAttr(Array.isArray(teacher?.assignedStudentIds) ? teacher.assignedStudentIds.join(", ") : (teacher?.assignedStudents || ""))}" placeholder="1001, 1002"></div>
    </div>
    <div class="formactions">
      <button id="saveTeacher" class="primary">Save Teacher</button>
      <button id="cancelTeacher">Cancel</button>
    </div>
    <div id="teacherFormMsg" class="msg"></div>`;

  $("cancelTeacher").onclick=()=>f.classList.add("hidden");
  $("saveTeacher").onclick=async()=>{
    const payload={
      teacherId:$("tId").value.trim(),
      name:$("tName").value.trim(),
      phone:$("tPhone").value.trim(),
      assignedStudentIds:$("tStudents").value.split(",").map(x=>x.trim()).filter(Boolean),
      updatedAt:new Date().toISOString()
    };
    if(!payload.teacherId||!payload.name){
      $("teacherFormMsg").textContent="Teacher ID and Name are required.";
      return;
    }
    $("saveTeacher").disabled=true;
    try{
      if(teacher) await updateDoc(doc(db,"teachers",teacher.id),payload);
      else await addDoc(collection(db,"teachers"),{...payload,createdAt:new Date().toISOString()});
      await openSection("teachers");
    }catch(e){
      $("teacherFormMsg").textContent="Save failed: "+(e.code||e.message);
      $("saveTeacher").disabled=false;
    }
  };
}

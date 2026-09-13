import {initializeApp} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {getFirestore, doc, getDoc, collection, getDocs, addDoc, deleteDoc} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const db=getFirestore(app);
const $=id=>document.getElementById(id);

$("loginBtn").onclick=async()=>{
  $("msg").textContent="";
  try{
    await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);
  }catch(e){
    $("msg").textContent="Login failed: "+(e.code||e.message);
  }
};

$("logout").onclick=()=>signOut(auth);
$("closePanel").onclick=()=>$("panel").classList.add("hidden");

document.querySelectorAll("[data-section]").forEach(btn=>{
  btn.addEventListener("click",()=>openSection(btn.dataset.section));
});

onAuthStateChanged(auth, async u=>{
  if(!u){
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
  $("user").textContent=u.email||"";

  try{
    const ref=doc(db,"users",u.uid);
    const snap=await getDoc(ref);

    if(!snap.exists()){
      $("user").textContent=(u.email||"")+" — users record missing";
      $("status").textContent="⚠️ Firebase login is working, but users/"+u.uid+" was not found.";
      return;
    }

    const data=snap.data()||{};
    const role=String(data.role||"").trim().toLowerCase();
    $("status").textContent="Role detected: "+(role||"not set");

    if(role==="admin"){
      $("admin").classList.remove("hidden");
      $("dashTitle").textContent="Super Admin Dashboard";
    }else if(role==="parent"){
      $("parent").classList.remove("hidden");
      $("dashTitle").textContent="Parent Dashboard";
    }else if(role==="teacher"){
      $("teacher").classList.remove("hidden");
      $("dashTitle").textContent="Teacher Dashboard";
    }else{
      $("status").textContent="⚠️ Login OK, but role is not admin/parent/teacher. Current role: "+(role||"empty");
    }
  }catch(e){
    console.error("Role check failed",e);
    $("status").textContent="⚠️ Role check failed: "+(e.code||e.message);
  }
});

async function openSection(name){
  $("panel").classList.remove("hidden");
  $("panelTitle").textContent=labels[name]||name;
  $("panelBody").innerHTML="<p>Loading...</p>";
  try{
    if(name==="students") return renderStudents();
    if(name==="teachers") return renderTeachers();
    if(name==="notices") return renderNotices();
    return renderSimple(name);
  }catch(e){
    $("panelBody").innerHTML="<p class='msg'>Error: "+escapeHtml(e.message||e.code)+"</p>";
  }
}

const labels={
  students:"Students / വിദ്യാർത്ഥികൾ",
  teachers:"Teachers / അധ്യാപകർ",
  attendance:"Attendance / ഹാജർ",
  studyRecords:"Study / പഠന പുരോഗതി",
  leaveRequests:"Leave / ലീവ്",
  results:"Results / റിസൾട്ട്",
  notices:"Notices / അറിയിപ്പുകൾ",
  users:"Users / അക്കൗണ്ടുകൾ"
};

function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

async function getAll(name){
  const snap=await getDocs(collection(db,name));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

async function renderStudents(){
  const rows=await getAll("students");
  $("panelBody").innerHTML=`
    <form id="studentForm">
      <div class="formgrid">
        <input id="sno" placeholder="Student Number *" required>
        <input id="sname" placeholder="Student Name *" required>
        <input id="sclass" placeholder="Class / Batch">
        <input id="sparent" placeholder="Parent Name">
        <input id="sphone" placeholder="Parent Phone">
      </div>
      <div class="form-actions"><button>Add Student</button></div>
    </form>
    <div id="studentTable"></div>`;
  $("studentForm").onsubmit=async e=>{
    e.preventDefault();
    await addDoc(collection(db,"students"),{
      studentNumber:$("sno").value.trim(),
      name:$("sname").value.trim(),
      className:$("sclass").value.trim(),
      parentName:$("sparent").value.trim(),
      parentPhone:$("sphone").value.trim(),
      createdAt:new Date().toISOString()
    });
    e.target.reset(); await renderStudents();
  };
  $("studentTable").innerHTML=tableHtml(rows,["studentNumber","name","className","parentName","parentPhone"],"students");
}

async function renderTeachers(){
  const rows=await getAll("teachers");
  $("panelBody").innerHTML=`
    <form id="teacherForm">
      <div class="formgrid">
        <input id="tname" placeholder="Teacher Name *" required>
        <input id="temail" placeholder="Email">
        <input id="tphone" placeholder="Phone">
        <input id="tsubject" placeholder="Subject / Class">
      </div>
      <div class="form-actions"><button>Add Teacher</button></div>
    </form>
    <div id="teacherTable"></div>`;
  $("teacherForm").onsubmit=async e=>{
    e.preventDefault();
    await addDoc(collection(db,"teachers"),{
      name:$("tname").value.trim(),email:$("temail").value.trim(),phone:$("tphone").value.trim(),subject:$("tsubject").value.trim(),createdAt:new Date().toISOString()
    });
    e.target.reset(); await renderTeachers();
  };
  $("teacherTable").innerHTML=tableHtml(rows,["name","email","phone","subject"],"teachers");
}

async function renderNotices(){
  const rows=await getAll("notices");
  $("panelBody").innerHTML=`
    <form id="noticeForm"><div class="formgrid"><input id="ntitle" placeholder="Notice title *" required></div><textarea id="nbody" placeholder="Notice text *" required></textarea><div class="form-actions"><button>Publish Notice</button></div></form>
    <div id="noticeTable"></div>`;
  $("noticeForm").onsubmit=async e=>{
    e.preventDefault();
    await addDoc(collection(db,"notices"),{title:$("ntitle").value.trim(),body:$("nbody").value.trim(),createdAt:new Date().toISOString()});
    e.target.reset(); await renderNotices();
  };
  $("noticeTable").innerHTML=tableHtml(rows,["title","body","createdAt"],"notices");
}

async function renderSimple(name){
  const rows=await getAll(name);
  $("panelBody").innerHTML=`<p class="muted">${rows.length} document(s) currently in <b>${escapeHtml(name)}</b>.</p>${rows.length?tableHtml(rows,Object.keys(rows[0]).filter(k=>k!=="id").slice(0,6),name):"<div class='empty'>No records yet.</div>"}`;
}

function tableHtml(rows,fields,collectionName){
  if(!rows.length) return "<div class='empty'>No records yet.</div>";
  let h="<table><thead><tr>"+fields.map(f=>`<th>${escapeHtml(f)}</th>`).join("")+"<th>Action</th></tr></thead><tbody>";
  for(const r of rows){
    h+="<tr>"+fields.map(f=>`<td>${escapeHtml(r[f])}</td>`).join("")+`<td><button class="smallbtn" data-del="${escapeHtml(r.id)}">Delete</button></td></tr>`;
  }
  h+="</tbody></table>";
  setTimeout(()=>{
    document.querySelectorAll("[data-del]").forEach(b=>{
      b.onclick=async()=>{
        if(!confirm("Delete this record?")) return;
        await deleteDoc(doc(db,collectionName,b.dataset.del));
        await openSection(collectionName);
      };
    });
  },0);
  return h;
}

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

    $("debug").classList.remove("hidden");
    $("debug").textContent="Firestore keys: "+JSON.stringify(keys)+"\nRaw document: "+JSON.stringify(data);

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
async function getAll(name){const s=await getDocs(collection(db,name));return s.docs.map(d=>({id:d.id,...d.data()}));}
async function openSection(name){
  $("panel").classList.remove("hidden");$("panelTitle").textContent=labels[name]||name;$("panelBody").innerHTML="<p>Loading...</p>";
  try{
    const rows=await getAll(name);
    $("panelBody").innerHTML=rows.length?tableHtml(rows,Object.keys(rows[0]).filter(k=>k!=="id").slice(0,6),name):"<div class='empty'>No records yet.</div>";
  }catch(e){$("panelBody").innerHTML="<p class='msg'>Error: "+escapeHtml(e.message||e.code)+"</p>";}
}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function tableHtml(rows,fields,collectionName){
 let h="<table><thead><tr>"+fields.map(f=>`<th>${escapeHtml(f)}</th>`).join("")+"<th>Action</th></tr></thead><tbody>";
 for(const r of rows)h+="<tr>"+fields.map(f=>`<td>${escapeHtml(r[f])}</td>`).join("")+`<td><button class="smallbtn" data-del="${escapeHtml(r.id)}">Delete</button></td></tr>`;
 h+="</tbody></table>";
 setTimeout(()=>document.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this record?"))return;await deleteDoc(doc(db,collectionName,b.dataset.del));await openSection(collectionName);}),0);
 return h;
}
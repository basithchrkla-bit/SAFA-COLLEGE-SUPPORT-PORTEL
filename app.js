import{initializeApp}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import{getFirestore,collection,doc,getDoc,getDocs,addDoc,setDoc,updateDoc,deleteDoc,query,where,serverTimestamp}from"https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import{firebaseConfig}from"./firebase-config.js";

const a=initializeApp(firebaseConfig),
auth=getAuth(a),
db=getFirestore(a);

let me,role,child;

const $=x=>document.getElementById(x);

const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({
"&":"&amp;",
"<":"&lt;",
">":"&gt;",
'"':"&quot;",
"'":"&#039;"
}[c]));

$("lf").onsubmit=async e=>{
  e.preventDefault();
  $("err").textContent="";

  try{
    await signInWithEmailAndPassword(
      auth,
      $("email").value.trim(),
      $("pass").value
    );
  }catch(x){
    $("err").textContent=x.code+" - "+x.message;
  }
};

$("out").onclick=()=>signOut(auth);

document.querySelectorAll("nav button").forEach(b=>{
  b.onclick=()=>page(b.dataset.p);
});

async function ud(){
  let d=await getDoc(doc(db,"users",me.uid));
  return d.exists()?d.data():null;
}

async function loadChild(){
  if(role!="parent")return;

  let u=await ud();

  if(!u?.studentNumber)return;

  let s=await getDocs(
    query(
      collection(db,"students"),
      where("studentNumber","==",String(u.studentNumber))
    )
  );

  child=s.empty?null:{
    id:s.docs[0].id,
    ...s.docs[0].data()
  };
}

onAuthStateChanged(auth,async u=>{
  me=u;

  if(!u){
    $("login").hidden=false;
    $("portal").hidden=true;
    return;
  }

  try{
    let x=await ud();
    role=x?.role;

    if(!role){
      alert("Create users/"+u.uid+" with role.");
      return;
    }

    $("login").hidden=true;
    $("portal").hidden=false;

    document.querySelectorAll(".admin").forEach(x=>{
      x.style.display=role=="admin"?"block":"none";
    });

    await loadChild();
    page("home");

  }catch(x){
    alert("Firestore error: "+x.code+" - "+x.message);
  }
});

async function page(p){
  let m=$("main");

  if(p=="home"){

    if(role=="admin"){

      let cs=await Promise.all(
        ["students","results","notices","leaveRequests","parentMessages"]
        .map(c=>getDocs(collection(db,c)))
      );

      m.innerHTML=
      "<h2>Admin Dashboard</h2>"+
      "<div class='grid'>"+
      ["Students","Results","Notices","Leave Requests","Messages"]
      .map((x,i)=>
        `<div class='card'><b>${x}</b><h1>${cs[i].size}</h1></div>`
      ).join("")+
      "</div>";

    }else{

      await loadChild();

      m.innerHTML=`
        <h2>Parent Dashboard</h2>
        <div class='card'>
          <h3>${esc(child?.name||"Child not linked")}</h3>
          <p>Student No: ${esc(child?.studentNumber||"—")}</p>
          <p>Study Status: ${esc(child?.studyStatus||"—")}</p>
        </div>
      `;
    }

  }else if(p=="students"){
    students(m);

  }else if(p=="study"){
    study(m);

  }else if(p=="results"){
    results(m);

  }else if(p=="notices"){
    notices(m);

  }else if(p=="leave"){
    leave(m);

  }else if(p=="messages"){
    messages(m);

  }else{
    users(m);
  }
}

async function students(m){

  let s=await getDocs(collection(db,"students"));
  let r="";

  s.forEach(d=>{
    let x=d.data();

    r+=`
      <tr>
        <td>${esc(x.studentNumber)}</td>
        <td>${esc(x.name)}</td>
        <td>${esc(x.studyStatus)}</td>
        <td>${esc(x.parentEmail)}</td>
        <td>
          <button class='secondary' onclick="editS('${d.id}')">Edit</button>
          <button class='danger' onclick="delS('${d.id}')">Delete</button>
        </td>
      </tr>
    `;
  });

  m.innerHTML=`
    <h2>Students</h2>

    <div class='actions'>
      <button class='primary' onclick="addS()">➕ Add Student</button>
    </div>

    <div class='tablewrap'>
      ${
        r?
        `<table class='table'>
          <tr>
            <th>No.</th>
            <th>Name</th>
            <th>Status</th>
            <th>Parent Email</th>
            <th>Actions</th>
          </tr>
          ${r}
        </table>`
        :
        "No students yet."
      }
    </div>
  `;
}

window.addS=()=>formS();

window.editS=async id=>{
  let d=await getDoc(doc(db,"students",id));
  formS(id,d.data());
};

window.delS=async id=>{
  if(confirm("Delete student?")){
    await deleteDoc(doc(db,"students",id));
    page("students");
  }
};

function formS(id="",x={}){

  let modal=document.createElement("div");

  modal.style.cssText=
  "position:fixed;inset:0;background:#0008;display:grid;place-items:center;padding:15px";

  modal.innerHTML=`
    <div class='card' style='width:min(600px,100%)'>

      <h2>${id?"Edit":"Add"} Student</h2>

      <form>

        <label>
          Student Number
          <input name=n value="${esc(x.studentNumber)}" required>
        </label>

        <label>
          Name
          <input name=name value="${esc(x.name)}" required>
        </label>

        <label>
          Study Level / Status
          <input name=status value="${esc(x.studyStatus)}">
        </label>

        <label>
          Parent Email
          <input name=email type=email value="${esc(x.parentEmail)}">
        </label>

        <button class='primary'>Save</button>
        <button type='button' class='secondary'>Cancel</button>

      </form>

    </div>
  `;

  document.body.append(modal);

  modal.querySelectorAll("button")[1].onclick=()=>{
    modal.remove();
  };

  modal.querySelector("form").onsubmit=async e=>{

    e.preventDefault();

    let f=new FormData(e.target);

    let d={
      studentNumber:String(f.get("n")).trim(),
      name:String(f.get("name")).trim(),
      studyStatus:String(f.get("status")||"").trim(),
      parentEmail:String(f.get("email")||"").trim(),
      updatedAt:serverTimestamp()
    };

    if(id){

      await updateDoc(
        doc(db,"students",id),
        d
      );

    }else{

      await addDoc(
        collection(db,"students"),
        {
          ...d,
          createdAt:serverTimestamp()
        }
      );

    }

    modal.remove();

    page("students");
  };
}

async function study(m){

  if(role=="parent"){

    await loadChild();

    m.innerHTML=`
      <h2>Study Status</h2>
      <div class='card'>
        ${esc(child?.studyStatus||"No status")}
      </div>
    `;

    return;
  }

  let s=await getDocs(collection(db,"students"));
  let r="";

  s.forEach(d=>{

    let x=d.data();

    r+=`
      <tr>
        <td>${esc(x.studentNumber)}</td>
        <td>${esc(x.name)}</td>
        <td>
          <input id="q${d.id}" value="${esc(x.studyStatus)}">
        </td>
        <td>
          <button class='secondary' onclick="saveSt('${d.id}')">
            Save
          </button>
        </td>
      </tr>
    `;
  });

  m.innerHTML=`
    <h2>Study Status</h2>

    <div class='tablewrap'>

      <table class='table'>

        <tr>
          <th>No.</th>
          <th>Name</th>
          <th>Status</th>
          <th></th>
        </tr>

        ${r}

      </table>

    </div>
  `;
}

window.saveSt=async id=>{

  await updateDoc(
    doc(db,"students",id),
    {
      studyStatus:$("q"+id).value
    }
  );

  page("study");
};

async function results(m){

  let s;

  if(role=="admin"){

    s=await getDocs(
      collection(db,"results")
    );

  }else{

    await loadChild();

    s=child?
      await getDocs(
        query(
          collection(db,"results"),
          where(
            "studentNumber",
            "==",
            String(child.studentNumber)
          )
        )
      ):
      {docs:[]};
  }

  let r="";

  s.forEach(d=>{

    let x=d.data();

    r+=`
      <tr>
        <td>${esc(x.studentNumber)}</td>
        <td>${esc(x.title)}</td>
        <td>${esc(x.marks)}</td>

        ${
          role=="admin"?
          `<td>
            <button class='danger'
              onclick="delR('${d.id}')">
              Delete
            </button>
          </td>`
          :
          ""
        }

      </tr>
    `;
  });

  m.innerHTML=`
    <h2>Results</h2>

    ${
      role=="admin"?
      `<button class='primary' onclick="formR()">
        ➕ Add Result
      </button>`
      :
      ""
    }

    <div class='tablewrap'>

      <table class='table'>

        <tr>
          <th>Student</th>
          <th>Title</th>
          <th>Marks</th>
          <th></th>
        </tr>

        ${r}

      </table>

    </div>
  `;
}

window.delR=async id=>{

  await deleteDoc(
    doc(db,"results",id)
  );

  page("results");
};

window.formR=()=>{

  let n=prompt("Student Number");
  let t=prompt("Exam / Result title");
  let v=prompt("Marks / Result");

  if(n&&t){

    addDoc(
      collection(db,"results"),
      {
        studentNumber:n,
        title:t,
        marks:v||"",
        createdAt:serverTimestamp()
      }
    ).then(()=>page("results"));
  }
};

async function notices(m){

  let s=await getDocs(
    collection(db,"notices")
  );

  let r="";

  s.forEach(d=>{

    let x=d.data();

    r+=`
      <div class='card'>

        <h3>${esc(x.title)}</h3>

        <p>${esc(x.body)}</p>

        ${
          role=="admin"?
          `<button class='danger'
            onclick="delN('${d.id}')">
            Delete
          </button>`
          :
          ""
        }

      </div>
    `;
  });

  m.innerHTML=`
    <h2>Notices</h2>

    ${
      role=="admin"?
      `<button class='primary'
        onclick="formN()">
        ➕ Add Notice
      </button>`
      :
      ""
    }

    ${r||"<div class='card'>No notices.</div>"}
  `;
}

window.delN=async id=>{

  await deleteDoc(
    doc(db,"notices",id)
  );

  page("notices");
};

window.formN=()=>{

  let t=prompt("Notice title");
  let b=prompt("Notice");

  if(t&&b){

    addDoc(
      collection(db,"notices"),
      {
        title:t,
        body:b,
        createdAt:serverTimestamp()
      }
    ).then(()=>page("notices"));
  }
};

async function leave(m){

  let s;

  if(role=="admin"){

    s=await getDocs(
      collection(db,"leaveRequests")
    );

  }else{

    await loadChild();

    s=child?
      await getDocs(
        query(
          collection(db,"leaveRequests"),
          where(
            "studentNumber",
            "==",
            String(child.studentNumber)
          )
        )
      ):
      {docs:[]};
  }

  let r="";

  s.forEach(d=>{

    let x=d.data();

    r+=`
      <tr>

        <td>${esc(x.studentNumber)}</td>

        <td>
          ${esc(x.from)} - ${esc(x.to)}
        </td>

        <td>${esc(x.reason)}</td>

        <td>${esc(x.status)}</td>

        ${
          role=="admin"?
          `<td>

            <button class='secondary'
              onclick="ls('${d.id}','Approved')">
              Approve
            </button>

            <button class='danger'
              onclick="ls('${d.id}','Rejected')">
              Reject
            </button>

          </td>`
          :
          ""
        }

      </tr>
    `;
  });

  m.innerHTML=`

    <h2>Leave</h2>

    ${
      role=="parent"?
      `<button class='primary'
        onclick="formL()">
        ➕ Apply Leave
      </button>`
      :
      ""
    }

    <div class='tablewrap'>

      <table class='table'>

        <tr>
          <th>Student</th>
          <th>Dates</th>
          <th>Reason</th>
          <th>Status</th>
          <th></th>
        </tr>

        ${r}

      </table>

    </div>
  `;
}

window.ls=async(id,s)=>{

  await updateDoc(
    doc(db,"leaveRequests",id),
    {
      status:s
    }
  );

  page("leave");
};

window.formL=()=>{

  let f=prompt("From | To | Reason");

  if(f){

    let [a,b,c]=f.split("|");

    loadChild().then(()=>{

      addDoc(
        collection(db,"leaveRequests"),
        {
          studentNumber:String(child.studentNumber),
          from:a?.trim(),
          to:b?.trim(),
          reason:c?.trim(),
          status:"Pending",
          parentUid:me.uid,
          createdAt:serverTimestamp()
        }
      ).then(()=>page("leave"));

    });
  }
};

async function messages(m){

  let s;

  if(role=="admin"){

    s=await getDocs(
      collection(db,"parentMessages")
    );

  }else{

    await loadChild();

    s=child?
      await getDocs(
        query(
          collection(db,"parentMessages"),
          where(
            "studentNumber",
            "==",
            String(child.studentNumber)
          )
        )
      ):
      {docs:[]};
  }

  let r="";

  s.forEach(d=>{

    let x=d.data();

    r+=`

      <div class='card'>

        <b>${esc(x.studentNumber)}</b>

        <p>${esc(x.message)}</p>

        ${
          x.reply?
          `<p>
            <b>Usthad:</b>
            ${esc(x.reply)}
          </p>`
          :
          ""
        }

        ${
          role=="admin"?
          `<button class='secondary'
            onclick="replyM('${d.id}')">
            Reply
          </button>`
          :
          ""
        }

      </div>

    `;
  });

  m.innerHTML=`

    <h2>Messages / Suggestions</h2>

    ${
      role=="parent"?
      `<button class='primary'
        onclick="formM()">
        ➕ Send Message
      </button>`
      :
      ""
    }

    ${r||"<div class='card'>No messages.</div>"}

  `;
}

window.replyM=async id=>{

  let r=prompt("Reply");

  if(r){

    await updateDoc(
      doc(db,"parentMessages",id),
      {
        reply:r
      }
    );

    page("messages");
  }
};

window.formM=()=>{

  let x=prompt("Message");

  if(x){

    loadChild().then(()=>{

      addDoc(
        collection(db,"parentMessages"),
        {
          studentNumber:String(child.studentNumber),
          parentUid:me.uid,
          message:x,
          reply:"",
          createdAt:serverTimestamp()
        }
      ).then(()=>page("messages"));

    });
  }
};

async function users(m){

  let s=await getDocs(
    collection(db,"users")
  );

  let r="";

  s.forEach(d=>{

    let x=d.data();

    r+=`
      <tr>

        <td>${esc(d.id)}</td>

        <td>${esc(x.role)}</td>

        <td>${esc(x.studentNumber||"—")}</td>

      </tr>
    `;
  });

  m.innerHTML=`

    <h2>Parent Users</h2>

    <div class='card'>

      <p>
        Create parent email/password in Firebase Authentication first,
        then link its UID to the student number.
      </p>

      <button class='primary'
        onclick="linkU()">
        ➕ Link Parent
      </button>

    </div>

    <div class='tablewrap'>

      <table class='table'>

        <tr>
          <th>UID</th>
          <th>Role</th>
          <th>Student No.</th>
        </tr>

        ${r}

      </table>

    </div>

  `;
}

window.linkU=()=>{

  let u=prompt("Parent Firebase UID");
  let n=prompt("Student Number");

  if(u&&n){

    setDoc(
      doc(db,"users",u),
      {
        role:"parent",
        studentNumber:n
      }
    ).then(()=>page("users"));
  }
};

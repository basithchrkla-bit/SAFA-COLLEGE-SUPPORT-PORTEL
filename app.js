import {initializeApp} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {getFirestore,doc,getDoc,collection,getDocs} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);$("msg").textContent=""}catch(e){$("msg").textContent="Login failed: "+e.code}};
$("logout").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async u=>{if(!u){$("login").classList.remove("hidden");$("dash").classList.add("hidden");return}
$("login").classList.add("hidden");$("dash").classList.remove("hidden");$("user").textContent=u.email;
const s=await getDoc(doc(db,"users",u.uid)); if(!s.exists()){ $("user").textContent+=" — users record missing";return}
const r=s.data().role; ["admin","parent","teacher"].forEach(x=>$(x).classList.add("hidden")); if($(r))$(r).classList.remove("hidden");});
window.check=async n=>{try{let s=await getDocs(collection(db,n));$("info").textContent=n+": "+s.size+" document(s)";}catch(e){$("info").textContent=e.code}};

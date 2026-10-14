'use client';
import {useState} from 'react';
import {createUserWithEmailAndPassword,signInWithEmailAndPassword,sendEmailVerification,signOut} from 'firebase/auth';
import {auth} from '../../lib/firebase';

export default function ActivateOwner(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[pending,setPending]=useState(false);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function perform(mode){
  if(!auth){setError('Firebase Authentication n’est pas configuré.');return}
  setPending(true);setError('');setMessage('');
  try{
   const address=email.trim().toLowerCase();
   if(!address||password.length<8)throw Error('Adresse e-mail et mot de passe (8 caractères minimum) requis.');
   const credentials=mode==='signup'
    ?await createUserWithEmailAndPassword(auth,address,password)
    :await signInWithEmailAndPassword(auth,address,password);
   await credentials.user.reload();
   if(!credentials.user.emailVerified){
    if(mode==='signup'){
     await sendEmailVerification(credentials.user);
     setMessage('Compte créé. Vérifiez votre e-mail avec le lien reçu, puis revenez et choisissez « Activer mon compte ».');
     return;
    }
    setError('Adresse e-mail non vérifiée. Vérifiez votre boîte de réception. En cas de besoin, utilisez « Renvoyer la vérification ».');
    return;
   }
   const idToken=await credentials.user.getIdToken(true);
   const response=await fetch('/api/setup-owner',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},body:'{}'});
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Activation impossible.');
   setMessage('Accès Super Admin activé. Redirection vers votre dashboard…');
   window.location.assign('/');
  }catch(e){
   const descriptions={'auth/email-already-in-use':'Cet e-mail existe déjà. Cliquez sur « Activer mon compte ».','auth/invalid-credential':'Identifiants incorrects.','auth/weak-password':'Mot de passe trop faible.','auth/too-many-requests':'Trop de tentatives. Réessayez plus tard.'};
   setError(descriptions[e.code]||e.message||'Erreur imprévue');
  }finally{setPending(false)}
 }
 async function resend(){
  setPending(true);setError('');setMessage('');
  try{
   const credential=await signInWithEmailAndPassword(auth,email.trim().toLowerCase(),password);
   await sendEmailVerification(credential.user);
   setMessage('E-mail de vérification envoyé.');
  }catch(e){setError(e.message||'Erreur d’envoi')}finally{setPending(false)}
 }
 return <main style={{minHeight:'100vh',background:'#0e1721',color:'#f7f9fa',display:'grid',placeItems:'center',padding:24,fontFamily:'system-ui,sans-serif'}}>
  <section style={{width:'100%',maxWidth:460,background:'#17232f',border:'1px solid #34404b',borderRadius:24,padding:28,boxShadow:'0 16px 60px #0005'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22}}>
    <strong style={{letterSpacing:2,fontSize:18}}>MAMOUN <span style={{color:'#e5a16e'}}>POS</span></strong><span style={{fontSize:12,color:'#abb7c2'}}>Activation unique</span>
   </div>
   <h1 style={{fontSize:28,marginBottom:8}}>Activer votre espace propriétaire</h1>
   <p style={{color:'#adbbc5',fontSize:14,lineHeight:1.6}}>Cette opération crée l’accès Super Admin du réseau. Utilisez uniquement votre adresse e-mail personnelle autorisée.</p>
   <form onSubmit={e=>{e.preventDefault();perform('signin')}} style={{display:'grid',gap:15,marginTop:23}}>
    <label style={{display:'grid',gap:8,fontSize:14}}>Adresse e-mail
     <input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} style={{padding:14,borderRadius:11,border:'1px solid #48535b',background:'#0d1923',color:'white',fontSize:16}}/>
    </label>
    <label style={{display:'grid',gap:8,fontSize:14}}>Mot de passe
     <input type="password" autoComplete="current-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} style={{padding:14,borderRadius:11,border:'1px solid #48535b',background:'#0d1923',color:'white',fontSize:16}}/>
    </label>
    {error&&<p role="alert" style={{color:'#ffa7a4',fontSize:14,margin:0}}>{error}</p>}
    {message&&<p role="status" style={{color:'#a4e2ba',fontSize:14,margin:0}}>{message}</p>}
    <button type="submit" disabled={pending} style={{padding:15,border:0,borderRadius:11,background:'#e6a16c',color:'#1a1511',fontSize:15,fontWeight:700,cursor:'pointer'}}>{pending?'Traitement…':'Activer mon compte'}</button>
    <button type="button" disabled={pending} onClick={()=>perform('signup')} style={{padding:13,border:'1px solid #58636e',borderRadius:11,background:'transparent',color:'#e7ecf0',cursor:'pointer'}}>Créer mon compte propriétaire</button>
    <button type="button" disabled={pending} onClick={resend} style={{background:'transparent',color:'#acbac7',border:0,padding:5,textDecoration:'underline',cursor:'pointer'}}>Renvoyer la vérification</button>
   </form>
   <p style={{fontSize:12,color:'#8597a6',marginTop:25,lineHeight:1.5}}>Votre adresse doit correspondre à l’adresse autorisée sur Vercel. Après la première activation, la procédure est verrouillée et les nouveaux cafés se gèrent depuis votre dashboard.</p>
  </section>
 </main>;
}

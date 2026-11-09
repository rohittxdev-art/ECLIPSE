import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, Check, Copy, FileImage, FileText, Heart, KeyRound,
  LockKeyhole, LogOut, Plus, Search, ShieldCheck, Star, Trash2, Undo2, X,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { decryptVaultBytes, decryptVaultValue, encryptVaultBytes, encryptVaultValue } from "./lib/vaultCrypto";

type Kind = "password" | "email" | "note" | "file" | "gallery";
type VaultPayload = { title: string; username?: string; secret?: string; website?: string; body?: string; fileName?: string; mimeType?: string; fileSize?: number; fileNonce?: string };
type Row = { id: string; user_id: string; item_type: Kind; payload_ciphertext: string; payload_nonce: string; storage_path: string | null; is_favorite: boolean; deleted_at: string | null; purge_after: string | null; created_at: string; updated_at: string };
type Item = Row & { payload: VaultPayload };
type Section = "all" | Kind | "favorites" | "recent" | "trash";

const labels: Record<Section,string> = {all:"All items",password:"Passwords",email:"Email accounts",note:"Secure notes",file:"Files & documents",gallery:"Gallery",favorites:"Favorites",recent:"Recently added",trash:"Recycle bin"};
const icons = {password:KeyRound,email:LockKeyhole,note:FileText,file:FileText,gallery:FileImage} as const;

export default function App({ onSignOut, vaultKey, userId }: { onSignOut: () => void; vaultKey: Uint8Array; userId: string }) {
  const [items,setItems]=useState<Item[]>([]);
  const [section,setSection]=useState<Section>("all");
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [kind,setKind]=useState<Kind>("password");
  const [title,setTitle]=useState("");
  const [username,setUsername]=useState("");
  const [secret,setSecret]=useState("");
  const [website,setWebsite]=useState("");
  const [body,setBody]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [showSecrets,setShowSecrets]=useState<Record<string,boolean>>({});
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  const loadItems=useCallback(async()=>{
    if(!supabase) return;
    setLoading(true);setError("");
    const {data,error:loadError}=await supabase.from("vault_items").select("id,user_id,item_type,payload_ciphertext,payload_nonce,storage_path,is_favorite,deleted_at,purge_after,created_at,updated_at").eq("user_id",userId).order("updated_at",{ascending:false}).limit(500);
    if(loadError){setError(loadError.message);setLoading(false);return;}
    const rows=(data??[]) as Row[];
    const expired=rows.filter(r=>r.deleted_at && r.purge_after && new Date(r.purge_after).getTime()<=Date.now());
    for(const row of expired){
      if(row.storage_path) await supabase.storage.from("eclipse-vault").remove([row.storage_path]);
      await supabase.from("vault_items").delete().eq("id",row.id).eq("user_id",userId);
    }
    const activeRows=rows.filter(r=>!expired.some(e=>e.id===r.id));
    const decoded:Item[]=[];
    for(const row of activeRows){
      try{decoded.push({...row,payload:await decryptVaultValue<VaultPayload>(row.payload_ciphertext,row.payload_nonce,vaultKey,userId)});}
      catch{setError("Some vault entries could not be decrypted. Check that you unlocked the correct vault.");}
    }
    setItems(decoded);setLoading(false);
  },[userId,vaultKey]);

  useEffect(()=>{void loadItems();},[loadItems]);
  useEffect(()=>{
    const idleLimit=5*60*1000;
    let lastActivity=Date.now();
    let timer=0;
    const checkIdle=()=>{
      const remaining=idleLimit-(Date.now()-lastActivity);
      if(remaining<=0){onSignOut();return;}
      timer=window.setTimeout(checkIdle,remaining);
    };
    const activity=()=>{
      lastActivity=Date.now();
      window.clearTimeout(timer);
      timer=window.setTimeout(checkIdle,idleLimit);
    };
    const events=["pointerdown","keydown","touchstart","mousemove","scroll"];
    events.forEach(name=>window.addEventListener(name,activity,{passive:true}));
    timer=window.setTimeout(checkIdle,idleLimit);
    return ()=>{window.clearTimeout(timer);events.forEach(name=>window.removeEventListener(name,activity));};
  },[onSignOut]);


  const visible=useMemo(()=>{
    let list=items;
    if(section==="trash") list=list.filter(i=>!!i.deleted_at);
    else list=list.filter(i=>!i.deleted_at);
    if(section==="favorites") list=list.filter(i=>i.is_favorite);
    else if(section==="recent") list=list.slice(0,20);
    else if(["password","email","note","file","gallery"].includes(section)) list=list.filter(i=>i.item_type===section);
    const q=query.trim().toLowerCase();
    if(q) list=list.filter(i=>[i.payload.title,i.payload.username,i.payload.website,i.payload.body].some(v=>v?.toLowerCase().includes(q)));
    return list;
  },[items,section,query]);

  function resetForm(){setTitle("");setUsername("");setSecret("");setWebsite("");setBody("");setFile(null);setShowForm(false);}
  async function saveItem(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!supabase)return;
    if(!title.trim()){setError("Add a title first.");return;}
    if((kind==="file"||kind==="gallery")&&!file){setError("Choose a file first.");return;}
    if(file&&file.size>50*1024*1024){setError("Files must be 50 MB or smaller.");return;}
    setSaving(true);setError("");
    let uploadedPath:string|null=null;
    try{
      let payload:VaultPayload={title:title.trim(),username:username.trim()||undefined,secret:secret||undefined,website:website.trim()||undefined,body:body.trim()||undefined};
      if(file){
        const fileBytes=new Uint8Array(await file.arrayBuffer());
        const encryptedFile=await encryptVaultBytes(fileBytes,vaultKey,userId);
        const id=crypto.randomUUID();
        uploadedPath=`${userId}/${id}.ecl`;
        const {error:uploadError}=await supabase.storage.from("eclipse-vault").upload(uploadedPath,new Blob([encryptedFile.ciphertext.buffer as ArrayBuffer],{type:"application/octet-stream"}),{contentType:"application/octet-stream",upsert:false});
        if(uploadError)throw uploadError;
        payload={...payload,fileName:file.name,mimeType:file.type||"application/octet-stream",fileSize:file.size,fileNonce:encryptedFile.nonce};
      }
      const encrypted=await encryptVaultValue(payload,vaultKey,userId);
      const {error:insertError}=await supabase.from("vault_items").insert({
        user_id:userId,item_type:kind,payload_ciphertext:encrypted.ciphertext,payload_nonce:encrypted.nonce,storage_path:uploadedPath,
      });
      if(insertError)throw insertError;
      resetForm();setNotice("Saved securely.");await loadItems();
    }catch(cause){
      if(uploadedPath) await supabase.storage.from("eclipse-vault").remove([uploadedPath]);
      setError(cause instanceof Error?cause.message:"Could not save this item.");
    }finally{setSaving(false);}
  }

  async function toggleFavorite(item:Item){
    if(!supabase)return;
    const {error:e}=await supabase.from("vault_items").update({is_favorite:!item.is_favorite}).eq("id",item.id).eq("user_id",userId);
    if(e)setError(e.message);else setItems(old=>old.map(i=>i.id===item.id?{...i,is_favorite:!i.is_favorite}:i));
  }
  async function moveToTrash(item:Item){
    if(!supabase)return;
    const {error:e}=await supabase.from("vault_items").update({deleted_at:new Date().toISOString()}).eq("id",item.id).eq("user_id",userId);
    if(e)setError(e.message);else{setNotice("Moved to recycle bin. It is scheduled for deletion after 30 days.");await loadItems();}
  }
  async function restore(item:Item){
    if(!supabase)return;
    const {error:e}=await supabase.from("vault_items").update({deleted_at:null,purge_after:null}).eq("id",item.id).eq("user_id",userId);
    if(e)setError(e.message);else{setNotice("Item restored.");await loadItems();}
  }
  async function permanentlyDelete(item:Item){
    if(!supabase||!window.confirm("Permanently delete this item? This cannot be undone."))return;
    if(item.storage_path){const {error:e}=await supabase.storage.from("eclipse-vault").remove([item.storage_path]);if(e){setError(e.message);return;}}
    const {error:e}=await supabase.from("vault_items").delete().eq("id",item.id).eq("user_id",userId);
    if(e)setError(e.message);else{setNotice("Permanently deleted.");await loadItems();}
  }
  async function downloadFile(item:Item){
    if(!supabase||!item.storage_path||!item.payload.fileNonce)return;
    try{
      const {data,error:e}=await supabase.storage.from("eclipse-vault").download(item.storage_path);
      if(e||!data)throw e??new Error("File not found.");
      const encrypted=new Uint8Array(await data.arrayBuffer());
      const plain=await decryptVaultBytes(encrypted,item.payload.fileNonce,vaultKey,userId);
      const url=URL.createObjectURL(new Blob([plain],{type:item.payload.mimeType||"application/octet-stream"}));
      const a=document.createElement("a");a.href=url;a.download=item.payload.fileName||"download";a.click();URL.revokeObjectURL(url);
    }catch(cause){setError(cause instanceof Error?cause.message:"Download failed.");}
  }
  async function copyValue(value:string){try{await navigator.clipboard.writeText(value);setNotice("Copied to clipboard.");}catch{setError("Clipboard permission was not available.");}}

  const nav:Section[]=["all","password","email","file","gallery","note","favorites","recent","trash"];
  return <main className="vault-app">
    <aside className="vault-sidebar">
      <div className="vault-brand"><span><ShieldCheck size={19}/></span><div><b>ECLIPSE</b><small>PERSONAL VAULT</small></div></div>
      <div className="vault-side-label">YOUR VAULT</div>
      {nav.map(s=><button key={s} className={section===s?"vault-nav active":"vault-nav"} onClick={()=>setSection(s)}>{s==="all"?<ShieldCheck size={16}/>:s==="favorites"?<Star size={16}/>:s==="recent"?<KeyRound size={16}/>:s==="trash"?<Trash2 size={16}/>:(()=>{const I=icons[s as Kind];return <I size={16}/>})()}<span>{labels[s]}</span>{s==="trash"&&<small>{items.filter(i=>i.deleted_at).length}</small>}</button>)}
      <div className="vault-side-bottom"><div className="vault-encrypted"><LockKeyhole size={15}/><span>End-to-end encrypted<br/><small>Keys stay on this device</small></span></div><button className="vault-lock" onClick={onSignOut}><LogOut size={15}/> Lock vault</button></div>
    </aside>
    <section className="vault-main">
      <header className="vault-top"><div><small>WORKSPACE / ECLIPSE</small><b>{labels[section]}</b></div><div className="vault-top-actions"><label className="vault-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search encrypted items…"/></label><button className="vault-add" onClick={()=>{setKind(section==="email"?"email":section==="note"?"note":section==="file"?"file":section==="gallery"?"gallery":"password");setShowForm(true);}}><Plus size={16}/> Add item</button></div></header>
      <div className="vault-content">
        <div className="vault-intro"><div><span className="vault-eyebrow">PRIVATE BY DESIGN</span><h1>{labels[section]}</h1><p>{section==="trash"?"Restore deleted items or permanently remove them.": "Your items are encrypted before they leave this device."}</p></div><div className="vault-count"><b>{visible.length}</b><span>ITEMS</span></div></div>
        {error&&<div className="vault-error">{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
        {notice&&<div className="vault-notice"><Check size={15}/>{notice}<button onClick={()=>setNotice("")}><X size={14}/></button></div>}
        {loading?<div className="vault-empty">Unlocking encrypted items…</div>:visible.length===0?<div className="vault-empty"><div><ShieldCheck size={26}/></div><b>{section==="trash"?"Recycle bin is empty":"Nothing here yet"}</b><p>{query?"Try another search.":"Add your first item to start building your private vault."}</p>{section!=="trash"&&<button onClick={()=>setShowForm(true)}><Plus size={15}/> Add your first item</button>}</div>:<div className="vault-items">{visible.map(item=>{const Icon=icons[item.item_type];return <article className="vault-item" key={item.id}><div className={"vault-item-icon "+item.item_type}><Icon size={18}/></div><div className="vault-item-info"><b>{item.payload.title}</b><small>{item.item_type.toUpperCase()} · {new Date(item.created_at).toLocaleDateString()}</small>{item.payload.username&&<span>{item.payload.username}</span>}{item.payload.website&&<span>{item.payload.website}</span>}{item.payload.body&&<p>{item.payload.body}</p>}{item.payload.fileName&&<span>{item.payload.fileName} · {((item.payload.fileSize||0)/1024/1024).toFixed(2)} MB</span>}{item.item_type==="password"&&item.payload.secret&&<div className="vault-secret"><span>{showSecrets[item.id]?item.payload.secret:"••••••••••••"}</span><button onClick={()=>setShowSecrets(v=>({...v,[item.id]:!v[item.id]}))}>{showSecrets[item.id]?"Hide":"Reveal"}</button><button onClick={()=>void copyValue(item.payload.secret!)}><Copy size={13}/> Copy</button></div>}</div><div className="vault-item-actions">{!item.deleted_at&&<button title={item.is_favorite?"Remove favorite":"Add favorite"} onClick={()=>void toggleFavorite(item)}><Heart size={16} fill={item.is_favorite?"currentColor":"none"}/></button>}{item.storage_path&&!item.deleted_at&&<button title="Download and decrypt" onClick={()=>void downloadFile(item)}><ArrowDownToLine size={16}/></button>}{item.deleted_at?<><button title="Restore" onClick={()=>void restore(item)}><Undo2 size={16}/></button><button title="Permanently delete" onClick={()=>void permanentlyDelete(item)}><Trash2 size={16}/></button></>:<button title="Move to recycle bin" onClick={()=>void moveToTrash(item)}><Trash2 size={16}/></button>}</div></article>})}</div>}
        <div className="vault-footnote"><LockKeyhole size={13}/> Content is encrypted locally before database or file storage. Search runs only on unlocked items.</div>
      </div>
    </section>
    {showForm&&<div className="vault-modal-backdrop" onClick={resetForm}><form className="vault-modal" onSubmit={saveItem} onClick={e=>e.stopPropagation()}><div className="vault-modal-head"><div><span className="vault-eyebrow">ENCRYPTED ITEM</span><h2>Add to your vault</h2></div><button type="button" onClick={resetForm}><X size={18}/></button></div><label>Item type<select value={kind} onChange={e=>setKind(e.target.value as Kind)}><option value="password">Password</option><option value="email">Email account</option><option value="note">Secure note</option><option value="file">File / document</option><option value="gallery">Photo / image</option></select></label><label>Title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Personal Gmail" required maxLength={120}/></label>{(kind==="password"||kind==="email")&&<><label>Username / Email<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Account username or email"/></label><label>{kind==="email"?"App password / credential":"Password"}<input value={secret} onChange={e=>setSecret(e.target.value)} placeholder="Stored encrypted" autoComplete="off"/></label><label>Website (optional)<input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com"/></label></>}{kind==="note"&&<label>Note<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your private note…" rows={5}/></label>}{(kind==="file"||kind==="gallery")&&<label>Choose file<input type="file" onChange={e=>setFile(e.target.files?.[0]??null)} required/><small>Maximum 50 MB. The file is encrypted before upload.</small></label>}<div className="vault-modal-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="submit" disabled={saving}>{saving?"Encrypting & saving…":"Encrypt and save"}</button></div></form></div>}
  </main>;
}

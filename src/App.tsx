import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, Check, Copy, Download, FileImage, FileText, Heart, KeyRound,
  LockKeyhole, LogOut, Plus, Search, ShieldCheck, Star, Trash2, Undo2, X,
  Globe, Instagram, Youtube, Facebook, MessageCircle, Send, Music2, Gamepad2, Twitch, Linkedin, Github, Chrome, Mail, Cloud, FileArchive, FileSpreadsheet, FileCode, Image, Camera, Video, Mic, Headphones, BookOpen, GraduationCap, BriefcaseBusiness, CreditCard, Wallet, ShoppingBag, ShoppingCart, Plane, Car, Home, HeartPulse, Dumbbell, Utensils, CalendarDays, Bell, Key, Shield, Fingerprint, Lock, Smartphone, Laptop, Monitor, Wifi, Server, Database, Bitcoin, Landmark, Newspaper, MapPin, Package, Tag, Star as StarIcon, Zap, Rocket, Coffee, Gift, Ticket, Folder, FolderLock,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { createRecoveryKit, decryptVaultBytes, decryptVaultValue, encryptVaultBytes, encryptVaultValue } from "./lib/vaultCrypto";

type Kind = "password" | "email" | "note" | "file" | "gallery";
type VaultPayload = { title: string; username?: string; secret?: string; website?: string; body?: string; fileName?: string; mimeType?: string; fileSize?: number; fileNonce?: string; iconKey?: string; customIconData?: string };
type Row = { id: string; user_id: string; item_type: Kind; payload_ciphertext: string; payload_nonce: string; storage_path: string | null; is_favorite: boolean; deleted_at: string | null; purge_after: string | null; created_at: string; updated_at: string };
type Item = Row & { payload: VaultPayload };
type Section = "all" | Kind | "favorites" | "recent" | "trash";

const labels: Record<Section,string> = {all:"All items",password:"Passwords",email:"Email accounts",note:"Secure notes",file:"Files & documents",gallery:"Gallery",favorites:"Favorites",recent:"Recently added",trash:"Recycle bin"};
const icons = {password:KeyRound,email:LockKeyhole,note:FileText,file:FileText,gallery:FileImage} as const;
const iconCatalog = [
  {key:"globe",name:"Website",category:"Web & Social",Icon:Globe},{key:"instagram",name:"Instagram",category:"Web & Social",Icon:Instagram},{key:"youtube",name:"YouTube",category:"Web & Social",Icon:Youtube},{key:"facebook",name:"Facebook",category:"Web & Social",Icon:Facebook},{key:"chat",name:"Chat",category:"Web & Social",Icon:MessageCircle},{key:"telegram",name:"Telegram",category:"Web & Social",Icon:Send},{key:"music",name:"Music",category:"Web & Social",Icon:Music2},{key:"twitch",name:"Twitch",category:"Web & Social",Icon:Twitch},{key:"linkedin",name:"LinkedIn",category:"Web & Social",Icon:Linkedin},{key:"github",name:"GitHub",category:"Web & Social",Icon:Github},{key:"chrome",name:"Browser",category:"Web & Social",Icon:Chrome},
  {key:"mail",name:"Email",category:"Work & Productivity",Icon:Mail},{key:"cloud",name:"Cloud",category:"Work & Productivity",Icon:Cloud},{key:"archive",name:"Archive",category:"Work & Productivity",Icon:FileArchive},{key:"sheet",name:"Spreadsheet",category:"Work & Productivity",Icon:FileSpreadsheet},{key:"code",name:"Code",category:"Work & Productivity",Icon:FileCode},{key:"book",name:"Books",category:"Work & Productivity",Icon:BookOpen},{key:"school",name:"Education",category:"Work & Productivity",Icon:GraduationCap},{key:"work",name:"Work",category:"Work & Productivity",Icon:BriefcaseBusiness},{key:"calendar",name:"Calendar",category:"Work & Productivity",Icon:CalendarDays},{key:"news",name:"News",category:"Work & Productivity",Icon:Newspaper},
  {key:"card",name:"Payment card",category:"Finance & Shopping",Icon:CreditCard},{key:"wallet",name:"Wallet",category:"Finance & Shopping",Icon:Wallet},{key:"bank",name:"Bank",category:"Finance & Shopping",Icon:Landmark},{key:"bitcoin",name:"Crypto",category:"Finance & Shopping",Icon:Bitcoin},{key:"shop",name:"Shopping",category:"Finance & Shopping",Icon:ShoppingBag},{key:"cart",name:"Cart",category:"Finance & Shopping",Icon:ShoppingCart},{key:"tag",name:"Tag",category:"Finance & Shopping",Icon:Tag},{key:"package",name:"Package",category:"Finance & Shopping",Icon:Package},{key:"ticket",name:"Ticket",category:"Finance & Shopping",Icon:Ticket},
  {key:"image",name:"Image",category:"Media & Lifestyle",Icon:Image},{key:"camera",name:"Camera",category:"Media & Lifestyle",Icon:Camera},{key:"video",name:"Video",category:"Media & Lifestyle",Icon:Video},{key:"mic",name:"Microphone",category:"Media & Lifestyle",Icon:Mic},{key:"headphones",name:"Headphones",category:"Media & Lifestyle",Icon:Headphones},{key:"game",name:"Gaming",category:"Media & Lifestyle",Icon:Gamepad2},{key:"plane",name:"Travel",category:"Media & Lifestyle",Icon:Plane},{key:"car",name:"Vehicle",category:"Media & Lifestyle",Icon:Car},{key:"home",name:"Home",category:"Media & Lifestyle",Icon:Home},{key:"food",name:"Food",category:"Media & Lifestyle",Icon:Utensils},{key:"coffee",name:"Coffee",category:"Media & Lifestyle",Icon:Coffee},{key:"gift",name:"Gift",category:"Media & Lifestyle",Icon:Gift},{key:"fitness",name:"Fitness",category:"Media & Lifestyle",Icon:Dumbbell},{key:"health",name:"Health",category:"Media & Lifestyle",Icon:HeartPulse},
  {key:"key",name:"Key",category:"Security & Devices",Icon:Key},{key:"shield",name:"Shield",category:"Security & Devices",Icon:Shield},{key:"fingerprint",name:"Fingerprint",category:"Security & Devices",Icon:Fingerprint},{key:"lock",name:"Lock",category:"Security & Devices",Icon:Lock},{key:"phone",name:"Phone",category:"Security & Devices",Icon:Smartphone},{key:"laptop",name:"Laptop",category:"Security & Devices",Icon:Laptop},{key:"monitor",name:"Monitor",category:"Security & Devices",Icon:Monitor},{key:"wifi",name:"Wi-Fi",category:"Security & Devices",Icon:Wifi},{key:"server",name:"Server",category:"Security & Devices",Icon:Server},{key:"database",name:"Database",category:"Security & Devices",Icon:Database},{key:"folder",name:"Folder",category:"Security & Devices",Icon:Folder},{key:"folder-lock",name:"Locked folder",category:"Security & Devices",Icon:FolderLock},{key:"star",name:"Star",category:"General",Icon:StarIcon},{key:"heart",name:"Heart",category:"General",Icon:Heart},{key:"zap",name:"Energy",category:"General",Icon:Zap},{key:"rocket",name:"Rocket",category:"General",Icon:Rocket},{key:"bell",name:"Notification",category:"General",Icon:Bell},{key:"map",name:"Location",category:"General",Icon:MapPin}
] as const;
const iconCategories = ["All",...Array.from(new Set(iconCatalog.map(icon=>icon.category)))];
function detectPlatformIcon(value:string){
  const text=value.trim().toLowerCase();
  const host=text.replace(/^https?:\/\//,"").split(/[/?#]/)[0].replace(/^www\./,"");
  const rules:[RegExp,string][]=[
    [/instagram\.com|instagram/,"instagram"],[/youtube\.com|youtu\.be|youtube/,"youtube"],[/facebook\.com|facebook/,"facebook"],[/telegram\.(org|me)|telegram/,"telegram"],[/twitch\.tv|twitch/,"twitch"],[/linkedin\.com|linkedin/,"linkedin"],[/github\.com|github/,"github"],[/gmail\.com|googlemail\.com|gmail/,"mail"],[/spotify\.com|spotify/,"music"],[/discord\.com|discord/,"chat"],[/netflix\.com|netflix/,"video"],[/amazon\./,"shop"],[/paypal\.com|paypal/,"wallet"],[/microsoft\.com|outlook/,"work"],[/apple\.com|icloud/,"cloud"],[/google\.com|google/,"globe"],[/steamcommunity\.com|steampowered\.com|steam/,"game"]
  ];
  return rules.find(([pattern])=>pattern.test(host)||pattern.test(text))?.[1]??"globe";
}



export default function App({ onSignOut, vaultKey, userId }: { onSignOut: () => void; vaultKey: Uint8Array; userId: string }) {
  const [items,setItems]=useState<Item[]>([]);
  const [section,setSection]=useState<Section>("all");
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [showForm,setShowForm]=useState(false);
  const [editingItem,setEditingItem]=useState<Item|null>(null);
  const [kind,setKind]=useState<Kind>("password");
  const [title,setTitle]=useState("");
  const [username,setUsername]=useState("");
  const [secret,setSecret]=useState("");
  const [website,setWebsite]=useState("");
  const [body,setBody]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const [iconKey,setIconKey]=useState("key");
  const [customIconData,setCustomIconData]=useState("");
  const [iconQuery,setIconQuery]=useState("");
  const [iconCategory,setIconCategory]=useState("All");
  const [detectedIcon,setDetectedIcon]=useState("key");
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
      let safeToDelete=true;
      if(row.storage_path){
        const {error:storageError}=await supabase.storage.from("eclipse-vault").remove([row.storage_path]);
        if(storageError){safeToDelete=false;setError("An expired encrypted file could not be removed from storage yet.");}
      }
      if(safeToDelete) await supabase.from("vault_items").delete().eq("id",row.id).eq("user_id",userId);
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

  function resetForm(){setTitle("");setUsername("");setSecret("");setWebsite("");setBody("");setFile(null);setIconKey("key");setDetectedIcon("key");setCustomIconData("");setIconQuery("");setIconCategory("All");setShowForm(false);setEditingItem(null);}
  function editItem(item:Item){setEditingItem(item);setKind(item.item_type);setTitle(item.payload.title);setUsername(item.payload.username||"");setSecret(item.payload.secret||"");setWebsite(item.payload.website||"");setBody(item.payload.body||"");setIconKey(item.payload.iconKey||"key");setDetectedIcon(item.payload.iconKey||"key");setCustomIconData(item.payload.customIconData||"");setShowForm(true);}
  async function saveItem(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!supabase)return;
    if(!title.trim()){setError("Add a title first.");return;}
    if((kind==="file"||kind==="gallery")&&!file&&!editingItem){setError("Choose a file first.");return;}
    if(file&&file.size>50*1024*1024){setError("Files must be 50 MB or smaller.");return;}
    setSaving(true);setError("");
    let uploadedPath:string|null=null;
    try{
      let payload:VaultPayload={title:title.trim(),username:username.trim()||undefined,secret:secret||undefined,website:website.trim()||undefined,body:body.trim()||undefined,iconKey,customIconData:customIconData||undefined,...(editingItem?.payload.fileName?{fileName:editingItem.payload.fileName,mimeType:editingItem.payload.mimeType,fileSize:editingItem.payload.fileSize,fileNonce:editingItem.payload.fileNonce}:{})};
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
      const writeQuery=editingItem
        ? supabase.from("vault_items").update({item_type:kind,payload_ciphertext:encrypted.ciphertext,payload_nonce:encrypted.nonce,storage_path:uploadedPath??editingItem.storage_path}).eq("id",editingItem.id).eq("user_id",userId)
        : supabase.from("vault_items").insert({user_id:userId,item_type:kind,payload_ciphertext:encrypted.ciphertext,payload_nonce:encrypted.nonce,storage_path:uploadedPath});
      const {error:insertError}=await writeQuery;
      if(insertError)throw insertError;
      if(editingItem&&uploadedPath&&editingItem.storage_path) await supabase.storage.from("eclipse-vault").remove([editingItem.storage_path]);
      resetForm();setNotice(editingItem?"Changes encrypted and saved.":"Saved securely.");await loadItems();
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
    const now=new Date();const {error:e}=await supabase.from("vault_items").update({deleted_at:now.toISOString(),purge_after:new Date(now.getTime()+30*24*60*60*1000).toISOString()}).eq("id",item.id).eq("user_id",userId);
    if(e)setError(e.message);else{setNotice("Moved to recycle bin. It will be permanently deleted by the automatic cleanup job after 30 days.");await loadItems();}
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
  async function exportRecoveryKit(){
    if(!window.confirm("This recovery file can unlock your vault and reset its master passphrase. Anyone who gets the file can access your vault. Save it offline and never share it. Continue?"))return;
    try{
      const kit=await createRecoveryKit(vaultKey,userId);
      const url=URL.createObjectURL(new Blob([JSON.stringify(kit)],{type:"application/json"}));
      const a=document.createElement("a");a.href=url;a.download="eclipse-recovery.eclrecovery";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
      setNotice("Recovery kit created. Store it offline in a secure place.");
    }catch(e){setError(e instanceof Error?e.message:"Could not create recovery kit.");}
  }

  function encode64(bytes:Uint8Array){let s="";for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s);}
  function decode64(s:string){const b=atob(s),out=new Uint8Array(b.length);for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out;}
  async function exportBackup(){
    if(!supabase)return;setSaving(true);setError("");
    try{
      const [{data:rows,error:rowsError},{data:settings,error:settingsError}]=await Promise.all([
        supabase.from("vault_items").select("id,user_id,item_type,payload_ciphertext,payload_nonce,storage_path,is_favorite,deleted_at,purge_after,created_at,updated_at").eq("user_id",userId).limit(5000),
        supabase.from("vault_settings").select("kdf_salt,kdf_algorithm,kdf_memory_kib,kdf_iterations,kdf_parallelism,wrapped_vault_key,key_version").eq("user_id",userId).single()
      ]);
      if(rowsError)throw rowsError;if(settingsError)throw settingsError;
      const items=[];
      for(const row of (rows??[]) as Row[]){
        let fileData:string|null=null;
        if(row.storage_path){const {data,error}=await supabase.storage.from("eclipse-vault").download(row.storage_path);if(error||!data)throw error??new Error("Could not read an encrypted file for backup.");fileData=encode64(new Uint8Array(await data.arrayBuffer()));}
        items.push({row:{...row,storage_path:null},fileData});
      }
      const bundle={format:"ECLIPSE-BACKUP",version:1,userId,createdAt:new Date().toISOString(),settings,items};
      const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:"application/json"}));
      const a=document.createElement("a");a.href=url;a.download=`eclipse-backup-${new Date().toISOString().slice(0,10)}.eclbackup`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
      setNotice("Encrypted backup exported. Store it somewhere private and keep a separate copy.");
    }catch(e){setError(e instanceof Error?e.message:"Backup export failed.");}finally{setSaving(false);}
  }
  async function importBackup(file:File|null){
    if(!supabase||!file)return;if(file.size>250*1024*1024){setError("Backup file exceeds the 250 MB import limit.");return;}
    if(!window.confirm("Restore items from this ECLIPSE backup? Existing items will remain; restored items are added as copies."))return;
    setSaving(true);setError("");
    try{
      const b=JSON.parse(await file.text()) as {format:string;version:number;userId:string;settings:Record<string,unknown>;items:Array<{row:Row;fileData:string|null}>};
      if(b.format!=="ECLIPSE-BACKUP"||b.version!==1||b.userId!==userId||!Array.isArray(b.items)||!b.settings)throw new Error("Invalid backup or backup belongs to another account.");
      for(const entry of b.items){
        const id=crypto.randomUUID();let path:string|null=null;
        if(entry.fileData){path=`${userId}/${id}.ecl`;const bytes=decode64(entry.fileData);const {error}=await supabase.storage.from("eclipse-vault").upload(path,new Blob([bytes.buffer as ArrayBuffer],{type:"application/octet-stream"}),{contentType:"application/octet-stream",upsert:false});if(error)throw error;}
        const {error}=await supabase.from("vault_items").insert({...entry.row,id,user_id:userId,storage_path:path});
        if(error)throw error;
      }
      setNotice(`Restored ${b.items.length} encrypted items. Existing items were kept.`);await loadItems();
    }catch(e){setError(e instanceof Error?e.message:"Backup restore failed.");}finally{setSaving(false);}
  }


  const nav:Section[]=["all","password","email","file","gallery","note","favorites","recent","trash"];
  const filteredIcons=iconCatalog.filter(icon=>(iconCategory==="All"||icon.category===iconCategory)&&(!iconQuery||icon.name.toLowerCase().includes(iconQuery.toLowerCase())||icon.key.includes(iconQuery.toLowerCase())));
  return <main className="vault-app">
    <aside className="vault-sidebar">
      <div className="vault-brand"><span><ShieldCheck size={19}/></span><div><b>ECLIPSE</b><small>PERSONAL VAULT</small></div></div>
      <div className="vault-side-label">YOUR VAULT</div>
      {nav.map(s=><button key={s} className={section===s?"vault-nav active":"vault-nav"} onClick={()=>setSection(s)}>{s==="all"?<ShieldCheck size={16}/>:s==="favorites"?<Star size={16}/>:s==="recent"?<KeyRound size={16}/>:s==="trash"?<Trash2 size={16}/>:(()=>{const I=icons[s as Kind];return <I size={16}/>})()}<span>{labels[s]}</span>{s==="trash"&&<small>{items.filter(i=>i.deleted_at).length}</small>}</button>)}
      <div className="vault-side-bottom"><div className="vault-encrypted"><LockKeyhole size={15}/><span>End-to-end encrypted<br/><small>Keys stay on this device</small></span></div><button className="vault-lock" onClick={onSignOut}><LogOut size={15}/> Lock vault</button></div>
    </aside>
    <section className="vault-main">
      <header className="vault-top"><div><small>WORKSPACE / ECLIPSE</small><b>{labels[section]}</b></div><div className="vault-top-actions"><label className="vault-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search encrypted items…"/></label><button className="vault-add" onClick={()=>void exportBackup()} disabled={saving}><Download size={15}/> Backup</button><button className="vault-add" onClick={()=>void exportRecoveryKit()}>Recovery kit</button><label className="vault-add" style={{cursor:"pointer"}}>Restore<input hidden type="file" accept=".eclbackup,application/json" onChange={e=>void importBackup(e.target.files?.[0]??null)}/></label><button className="vault-add" onClick={()=>{setKind(section==="email"?"email":section==="note"?"note":section==="file"?"file":section==="gallery"?"gallery":"password");setShowForm(true);}}><Plus size={16}/> Add item</button></div></header>
      <div className="vault-content">
        <div className="vault-intro"><div><span className="vault-eyebrow">PRIVATE BY DESIGN</span><h1>{labels[section]}</h1><p>{section==="trash"?"Restore deleted items or permanently remove them.": "Your items are encrypted before they leave this device."}</p></div><div className="vault-count"><b>{visible.length}</b><span>ITEMS</span></div></div>
        {error&&<div className="vault-error">{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
        {notice&&<div className="vault-notice"><Check size={15}/>{notice}<button onClick={()=>setNotice("")}><X size={14}/></button></div>}
        {loading?<div className="vault-empty">Unlocking encrypted items…</div>:visible.length===0?<div className="vault-empty"><div><ShieldCheck size={26}/></div><b>{section==="trash"?"Recycle bin is empty":"Nothing here yet"}</b><p>{query?"Try another search.":"Add your first item to start building your private vault."}</p>{section!=="trash"&&<button onClick={()=>setShowForm(true)}><Plus size={15}/> Add your first item</button>}</div>:<div className="vault-items">{visible.map(item=>{const Icon=iconCatalog.find(icon=>icon.key===item.payload.iconKey)?.Icon??icons[item.item_type];return <article className="vault-item" key={item.id}><div className={"vault-item-icon "+item.item_type}>{item.payload.customIconData?<img src={item.payload.customIconData} alt="" />:<Icon size={18}/>}</div><div className="vault-item-info"><b>{item.payload.title}</b><small>{item.item_type.toUpperCase()} · {new Date(item.created_at).toLocaleDateString()}</small>{item.payload.username&&<span>{item.payload.username}</span>}{item.payload.website&&<span>{item.payload.website}</span>}{item.payload.body&&<p>{item.payload.body}</p>}{item.payload.fileName&&<span>{item.payload.fileName} · {((item.payload.fileSize||0)/1024/1024).toFixed(2)} MB</span>}{item.item_type==="password"&&item.payload.secret&&<div className="vault-secret"><span>{showSecrets[item.id]?item.payload.secret:"••••••••••••"}</span><button onClick={()=>setShowSecrets(v=>({...v,[item.id]:!v[item.id]}))}>{showSecrets[item.id]?"Hide":"Reveal"}</button><button onClick={()=>void copyValue(item.payload.secret!)}><Copy size={13}/> Copy</button></div>}</div><div className="vault-item-actions">{!item.deleted_at&&<button title="Edit item" onClick={()=>editItem(item)}><FileText size={15}/></button>}{!item.deleted_at&&<button title={item.is_favorite?"Remove favorite":"Add favorite"} onClick={()=>void toggleFavorite(item)}><Heart size={16} fill={item.is_favorite?"currentColor":"none"}/></button>}{item.storage_path&&!item.deleted_at&&<button title="Download and decrypt" onClick={()=>void downloadFile(item)}><ArrowDownToLine size={16}/></button>}{item.deleted_at?<><button title="Restore" onClick={()=>void restore(item)}><Undo2 size={16}/></button><button title="Permanently delete" onClick={()=>void permanentlyDelete(item)}><Trash2 size={16}/></button></>:<button title="Move to recycle bin" onClick={()=>void moveToTrash(item)}><Trash2 size={16}/></button>}</div></article>})}</div>}
        <div className="vault-footnote"><LockKeyhole size={13}/> Content is encrypted locally before database or file storage. Search runs only on unlocked items.</div>
      </div>
    </section>
    {showForm&&<div className="vault-modal-backdrop" onClick={resetForm}><form className="vault-modal" onSubmit={saveItem} onClick={e=>e.stopPropagation()}><div className="vault-modal-head"><div><span className="vault-eyebrow">ENCRYPTED ITEM</span><h2>{editingItem?"Edit vault item":"Add to your vault"}</h2></div><button type="button" onClick={resetForm}><X size={18}/></button></div><label>Item type<select disabled={!!editingItem} value={kind} onChange={e=>setKind(e.target.value as Kind)}><option value="password">Password</option><option value="email">Email account</option><option value="note">Secure note</option><option value="file">File / document</option><option value="gallery">Photo / image</option></select></label><div className="vault-icon-picker"><div className="vault-icon-picker-head"><b>Choose an icon</b><span>{iconCatalog.length}+ built-in icons</span></div><div className="vault-icon-tools"><button type="button" onClick={()=>{const detected=detectPlatformIcon(website||title);setDetectedIcon(detected);setIconKey(detected);setCustomIconData("");}}>Detect from website / title</button><button type="button" onClick={()=>{setIconKey(detectedIcon);setCustomIconData("");}}>Restore detected icon</button></div><input className="vault-icon-search" value={iconQuery} onChange={e=>setIconQuery(e.target.value)} placeholder="Search icons…"/><select className="vault-icon-category" value={iconCategory} onChange={e=>setIconCategory(e.target.value)}>{iconCategories.map(category=><option key={category}>{category}</option>)}</select><div className="vault-icon-grid">{filteredIcons.map(icon=>{const Icon=icon.Icon;return <button type="button" key={icon.key} className={iconKey===icon.key&&!customIconData?"selected":""} title={icon.name} onClick={()=>{setIconKey(icon.key);setDetectedIcon(icon.key);setCustomIconData("");}}><Icon size={18}/><small>{icon.name}</small></button>})}</div><label className="vault-custom-icon">Upload custom icon (PNG, JPG, SVG, WebP)<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e=>{const selected=e.target.files?.[0];if(!selected)return;if(selected.size>256*1024){setError("Custom icons must be 256 KB or smaller.");e.target.value="";return;}const reader=new FileReader();reader.onload=()=>{setCustomIconData(String(reader.result||""));};reader.readAsDataURL(selected);}}/></label>{customIconData&&<div className="vault-custom-preview"><img src={customIconData} alt="Custom icon preview"/><button type="button" onClick={()=>setCustomIconData("")}>Use built-in icon</button></div>}</div><label>Title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Personal Gmail" required maxLength={120}/></label>{(kind==="password"||kind==="email")&&<><label>Username / Email<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Account username or email"/></label><label>{kind==="email"?"App password / credential":"Password"}<input value={secret} onChange={e=>setSecret(e.target.value)} placeholder="Stored encrypted" autoComplete="off"/></label><label>Website (optional)<input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com"/></label></>}{kind==="note"&&<label>Note<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your private note…" rows={5}/></label>}{(kind==="file"||kind==="gallery")&&!editingItem&&<label>Choose file<input type="file" onChange={e=>setFile(e.target.files?.[0]??null)} required/><small>Maximum 50 MB. The file is encrypted before upload.</small></label>}<div className="vault-modal-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="submit" disabled={saving}>{saving?"Encrypting & saving…":editingItem?"Save changes":"Encrypt and save"}</button></div></form></div>}
  </main>;
}

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import {
  ArrowDownToLine, Check, Copy, Download, FileImage, FileText, Heart, KeyRound,
  LockKeyhole, LogOut, Plus, Search, ShieldCheck, Star, Trash2, Undo2, X,
  Globe, Instagram, Youtube, Facebook, MessageCircle, Send, Music2, Gamepad2, Twitch, Linkedin, Github, Chrome, Mail, Cloud, FileArchive, FileSpreadsheet, FileCode, Image, Camera, Video, Mic, Headphones, BookOpen, GraduationCap, BriefcaseBusiness, CreditCard, Wallet, ShoppingBag, ShoppingCart, Plane, Car, Home, HeartPulse, Dumbbell, Utensils, CalendarDays, Bell, Key, Shield, Fingerprint, Lock, Smartphone, Laptop, Monitor, Wifi, Server, Database, Bitcoin, Landmark, Newspaper, MapPin, Package, Tag, Star as StarIcon, Zap, Rocket, Coffee, Gift, Ticket, Folder, FolderLock, Activity, Gauge, AlertTriangle, Sparkles,
} from "lucide-react";
import { supabase } from "./lib/supabase";
import { createRecoveryKit, decryptVaultBytes, decryptVaultValue, encryptVaultBytes, encryptVaultValue } from "./lib/vaultCrypto";

type Kind = "password" | "email" | "note" | "file" | "gallery";
type VaultPayload = { title: string; username?: string; secret?: string; website?: string; body?: string; fileName?: string; mimeType?: string; fileSize?: number; fileNonce?: string; folderPath?: string; iconKey?: string; customIconData?: string };
type Row = { id: string; user_id: string; item_type: Kind; payload_ciphertext: string; payload_nonce: string; storage_path: string | null; is_favorite: boolean; deleted_at: string | null; purge_after: string | null; created_at: string; updated_at: string };
type Item = Row & { payload: VaultPayload };
type Section = "all" | Kind | "favorites" | "recent" | "trash" | "health";

const labels: Record<Section,string> = {all:"All items",password:"Passwords",email:"Email accounts",note:"Secure notes",file:"Files & documents",gallery:"Gallery",favorites:"Favorites",recent:"Recently added",trash:"Recycle bin",health:"Vault Pulse"};
const icons = {password:KeyRound,email:LockKeyhole,note:FileText,file:FileText,gallery:FileImage,health:Gauge} as const;
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
  const host=text.replace("https://","").replace("http://","").split(/[/?#]/)[0].replace("www.","");
  const rules:[string,string][]=[
    ["instagram.com","instagram"],["youtube.com","youtube"],["youtu.be","youtube"],["facebook.com","facebook"],["telegram.org","telegram"],["t.me","telegram"],["twitch.tv","twitch"],["linkedin.com","linkedin"],["github.com","github"],["gmail.com","mail"],["googlemail.com","mail"],["spotify.com","music"],["discord.com","chat"],["netflix.com","video"],["amazon.","shop"],["paypal.com","wallet"],["microsoft.com","work"],["outlook.com","work"],["apple.com","cloud"],["icloud.com","cloud"],["google.com","globe"],["steampowered.com","game"],["steamcommunity.com","game"]
  ];
  return rules.find(([needle])=>host.includes(needle)||text.includes(needle))?.[1]??"globe";
}



export default function App({ onSignOut, vaultKey, userId }: { onSignOut: () => void; vaultKey: Uint8Array; userId: string }) {
  const [items,setItems]=useState<Item[]>([]);
  const [section,setSection]=useState<Section>("all");
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [uploadProgress,setUploadProgress]=useState<{status:"active"|"done"|"error";totalFiles:number;completedFiles:number;totalBytes:number;completedBytes:number;currentFile:string;stage:"preparing"|"encrypting"|"uploading"|"saving"|"complete"|"failed";startedAt:number;error?:string}|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [editingItem,setEditingItem]=useState<Item|null>(null);
  const [kind,setKind]=useState<Kind>("password");
  const [title,setTitle]=useState("");
  const [username,setUsername]=useState("");
  const [secret,setSecret]=useState("");
  const [website,setWebsite]=useState("");
  const [body,setBody]=useState("");
  const [file,setFile]=useState<File|null>(null);
  const bulkInputRef=useRef<HTMLInputElement|null>(null);
  const folderInputRef=useRef<HTMLInputElement|null>(null);
  const [iconKey,setIconKey]=useState("key");
  const [customIconData,setCustomIconData]=useState("");
  const [iconQuery,setIconQuery]=useState("");
  const [iconCategory,setIconCategory]=useState("All");
  const [detectedIcon,setDetectedIcon]=useState("key");
  const [showSecrets,setShowSecrets]=useState<Record<string,boolean>>({});
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [cloudQr,setCloudQr]=useState("");
  const [cloudBackupId,setCloudBackupId]=useState("");
  const [cloudModal,setCloudModal]=useState(false);
  const [scanOpen,setScanOpen]=useState(false);
  const [scanInput,setScanInput]=useState("");
  const [scanError,setScanError]=useState("");
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const scanStreamRef=useRef<MediaStream|null>(null);
  const scanTimerRef=useRef<number|undefined>(undefined);
  const scanDetectorRef=useRef<{detect:(source:CanvasImageSource)=>Promise<Array<{rawValue:string}>>}|null>(null);

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

  async function uploadMultipleFiles(selected:File[]){
    if(!supabase||!selected.length)return;
    const files=selected.filter(f=>f.size>0);
    const total=files.reduce((sum,f)=>sum+f.size,0);
    if(!files.length){setError("The selected folder has no files to upload.");return;}
    if(files.length>150){setError("Choose up to 150 files at a time.");return;}
    if(files.some(f=>f.size>50*1024*1024)){setError("Each file must be 50 MB or smaller.");return;}
    if(total>250*1024*1024){setError("The combined upload must be 250 MB or smaller.");return;}
    setSaving(true);setError("");
    setUploadProgress({status:"active",totalFiles:files.length,completedFiles:0,totalBytes:total,completedBytes:0,currentFile:files[0].name,stage:"preparing",startedAt:Date.now()});
    const uploadedPaths:string[]=[];const insertedIds:string[]=[];
    let completedBytes=0;
    try{
      for(let index=0;index<files.length;index++){
        const selectedFile=files[index];
        setUploadProgress(p=>p?{...p,currentFile:selectedFile.name,completedFiles:index,completedBytes,stage:"encrypting"}:p);
        const bytes=new Uint8Array(await selectedFile.arrayBuffer());
        const encrypted=await encryptVaultBytes(bytes,vaultKey,userId);
        const id=crypto.randomUUID();const path=`${userId}/${id}.ecl`;
        setUploadProgress(p=>p?{...p,currentFile:selectedFile.name,stage:"uploading"}:p);
        const {error:uploadError}=await supabase.storage.from("eclipse-vault").upload(path,new Blob([encrypted.ciphertext.buffer as ArrayBuffer],{type:"application/octet-stream"}),{contentType:"application/octet-stream",upsert:false});
        if(uploadError)throw uploadError;
        uploadedPaths.push(path);
        setUploadProgress(p=>p?{...p,currentFile:selectedFile.name,stage:"saving"}:p);
        const relativePath=(selectedFile as File & {webkitRelativePath?:string}).webkitRelativePath||"";
        const payload:VaultPayload={
          title:selectedFile.name,
          fileName:selectedFile.name,
          mimeType:selectedFile.type||"application/octet-stream",
          fileSize:selectedFile.size,
          fileNonce:encrypted.nonce,
          folderPath:relativePath.includes("/")?relativePath.slice(0,relativePath.lastIndexOf("/")):undefined,
          iconKey:selectedFile.type.startsWith("image/")?"image":selectedFile.name.toLowerCase().endsWith(".zip")?"archive":"folder"
        };
        const encryptedPayload=await encryptVaultValue(payload,vaultKey,userId);
        const {error:insertError}=await supabase.from("vault_items").insert({
          id,user_id:userId,item_type:selectedFile.type.startsWith("image/")?"gallery":"file",
          payload_ciphertext:encryptedPayload.ciphertext,payload_nonce:encryptedPayload.nonce,
          storage_path:path,is_favorite:false
        });
        if(insertError)throw insertError;
        insertedIds.push(id);
        completedBytes+=selectedFile.size;
        setUploadProgress(p=>p?{...p,completedFiles:index+1,completedBytes,currentFile:index===files.length-1?"All files secured":files[index+1].name,stage:index===files.length-1?"complete":"preparing"}:p);
      }
      setUploadProgress(p=>p?{...p,status:"done",completedFiles:files.length,completedBytes:total,currentFile:"All files secured",stage:"complete"}:p);
      setNotice(`Securely added ${files.length} file${files.length===1?"":"s"} to your vault.`);
      setSection("all");await loadItems();
    }catch(cause){
      if(insertedIds.length)await supabase.from("vault_items").delete().in("id",insertedIds).eq("user_id",userId);
      if(uploadedPaths.length)await supabase.storage.from("eclipse-vault").remove(uploadedPaths);
      const message=cause instanceof Error?cause.message:"Some files could not be added. Completed uploads were rolled back.";
      setUploadProgress(p=>p?{...p,status:"error",stage:"failed",error:message}:p);
      setError(message);
    }finally{
      setSaving(false);
      if(bulkInputRef.current)bulkInputRef.current.value="";
      if(folderInputRef.current)folderInputRef.current.value="";
      window.setTimeout(()=>setUploadProgress(p=>p&&p.status!=="active"?null:p),9000);
    }
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


  async function createCloudBackup(){
    if(!supabase)return;setSaving(true);setError("");setCloudQr("");
    let uploadedPath:string|null=null;
    try{
      const [{data:rows,error:rowsError},{data:settings,error:settingsError}]=await Promise.all([
        supabase.from("vault_items").select("id,user_id,item_type,payload_ciphertext,payload_nonce,storage_path,is_favorite,deleted_at,purge_after,created_at,updated_at").eq("user_id",userId).limit(5000),
        supabase.from("vault_settings").select("kdf_salt,kdf_algorithm,kdf_memory_kib,kdf_iterations,kdf_parallelism,wrapped_vault_key,key_version").eq("user_id",userId).single()
      ]);
      if(rowsError)throw rowsError;if(settingsError)throw settingsError;
      const items=[];
      for(const row of (rows??[]) as Row[]){
        let fileData:string|null=null;
        if(row.storage_path){
          const {data,error}=await supabase.storage.from("eclipse-vault").download(row.storage_path);
          if(error||!data)throw error??new Error("Could not read an encrypted file for cloud backup.");
          fileData=encode64(new Uint8Array(await data.arrayBuffer()));
        }
        items.push({row:{...row,storage_path:null},fileData});
      }
      const bundle={format:"ECLIPSE-BACKUP",version:1,userId,createdAt:new Date().toISOString(),settings,items};
      const blob=new Blob([JSON.stringify(bundle)],{type:"application/json"});
      if(blob.size>250*1024*1024)throw new Error("Cloud backup exceeds the 250 MB limit.");
      const backupId=crypto.randomUUID();
      uploadedPath=`${userId}/${backupId}.eclbackup`;
      const {error:uploadError}=await supabase.storage.from("eclipse-backups").upload(uploadedPath,blob,{contentType:"application/json",upsert:false});
      if(uploadError)throw uploadError;
      const {error:recordError}=await supabase.from("eclipse_backups").insert({id:backupId,user_id:userId,storage_path:uploadedPath,item_count:items.length,size_bytes:blob.size});
      if(recordError)throw recordError;
      const link=new URL(window.location.origin);
      link.searchParams.set("eclipseBackup",backupId);
      const qr=await QRCode.toDataURL(link.toString(),{width:320,margin:2,errorCorrectionLevel:"M",color:{dark:"#08090d",light:"#ffffff"}});
      setCloudBackupId(backupId);setCloudQr(qr);
      setNotice("Encrypted cloud backup created. Download the QR and keep it private.");
    }catch(e){
      if(uploadedPath)await supabase.storage.from("eclipse-backups").remove([uploadedPath]);
      setError(e instanceof Error?e.message:"Cloud backup could not be created.");
    }finally{setSaving(false);}
  }
  function downloadQr(){
    if(!cloudQr)return;
    const a=document.createElement("a");a.href=cloudQr;a.download=`eclipse-cloud-backup-${cloudBackupId.slice(0,8)}.png`;a.click();
  }
  function stopQrScanner(){
    if(scanTimerRef.current!==undefined)window.clearTimeout(scanTimerRef.current);
    scanTimerRef.current=undefined;
    scanStreamRef.current?.getTracks().forEach(track=>track.stop());
    scanStreamRef.current=null;scanDetectorRef.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
  }
  async function restoreCloudBackup(backupId:string){
    if(!supabase)return;
    const cleanId=backupId.trim();
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanId)){
      setError("This QR code is not a valid ECLIPSE cloud backup.");return;
    }
    setSaving(true);setError("");
    try{
      const {data:record,error:recordError}=await supabase.from("eclipse_backups").select("id,storage_path").eq("id",cleanId).eq("user_id",userId).single();
      if(recordError||!record)throw new Error("Backup not found for this signed-in account.");
      const {data,error:downloadError}=await supabase.storage.from("eclipse-backups").download(record.storage_path);
      if(downloadError||!data)throw downloadError??new Error("Cloud backup file is unavailable.");
      const backupFile=new File([data],"eclipse-cloud-backup.eclbackup",{type:"application/json"});
      setSaving(false);
      await importBackup(backupFile);
    }catch(e){setError(e instanceof Error?e.message:"Could not load this cloud backup.");setSaving(false);}
  }
  async function handleQrValue(rawValue:string){
    let id=rawValue.trim();
    try{const parsed=new URL(id);id=parsed.searchParams.get("eclipseBackup")||"";}catch{/* Accept a raw backup ID as well. */}
    if(!id){setError("This QR code does not contain an ECLIPSE backup reference.");return;}
    setScanOpen(false);setScanInput(id);await restoreCloudBackup(id);
  }
  async function startQrScanner(){
    setScanError("");
    const Detector=(window as Window & {BarcodeDetector?:new(options?:{formats:string[]})=>{detect:(source:CanvasImageSource)=>Promise<Array<{rawValue:string}>>}}).BarcodeDetector;
    if(!Detector){setScanError("Camera QR scanning is not supported in this browser. Paste the backup link or ID below instead.");return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
      scanStreamRef.current=stream;
      scanDetectorRef.current=new Detector({formats:["qr_code"]});
      if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();}
      const scan=async()=>{
        const video=videoRef.current;const detector=scanDetectorRef.current;
        if(!video||!detector||!scanStreamRef.current)return;
        try{
          if(video.readyState>=2){
            const found=await detector.detect(video);
            if(found[0]?.rawValue){stopQrScanner();await handleQrValue(found[0].rawValue);return;}
          }
        }catch{/* Keep scanning; camera frames can occasionally fail detection. */}
        scanTimerRef.current=window.setTimeout(()=>void scan(),250);
      };
      void scan();
    }catch(e){setScanError(e instanceof Error?e.message:"Camera permission was not granted.");}
  }
  useEffect(()=>{
    const pending=new URLSearchParams(window.location.search).get("eclipseBackup");
    if(pending){setScanInput(pending);setCloudModal(true);setScanOpen(true);}
    return ()=>stopQrScanner();
  },[]);

  const passwordHealth=useMemo(()=>{
    const passwords=items.filter(item=>!item.deleted_at&&item.item_type==="password"&&item.payload.secret);
    const counts=new Map<string,number>();
    passwords.forEach(item=>{const value=item.payload.secret!.toLowerCase();counts.set(value,(counts.get(value)||0)+1);});
    const weak=passwords.filter(item=>item.payload.secret!.length<12);
    const reused=passwords.filter(item=>(counts.get(item.payload.secret!.toLowerCase())||0)>1);
    const old=passwords.filter(item=>Date.now()-new Date(item.updated_at).getTime()>180*24*60*60*1000);
    const score=passwords.length?Math.max(0,Math.round(100-(weak.length*18+reused.length*22+old.length*8)/passwords.length)):100;
    return {total:passwords.length,weak,reused,old,score};
  },[items]);
  const nav:Section[]=["all","password","email","file","gallery","note","favorites","recent","trash","health"];
  const filteredIcons=iconCatalog.filter(icon=>(iconCategory==="All"||icon.category===iconCategory)&&(!iconQuery||icon.name.toLowerCase().includes(iconQuery.toLowerCase())||icon.key.includes(iconQuery.toLowerCase())));
  return <main className="vault-app">
    <aside className="vault-sidebar">
      <div className="vault-brand"><span><ShieldCheck size={19}/></span><div><b>ECLIPSE</b><small>PERSONAL VAULT</small></div></div>
      <div className="vault-side-label">YOUR VAULT</div>
      {nav.map(s=><button key={s} className={section===s?"vault-nav active":"vault-nav"} onClick={()=>setSection(s)}>{s==="all"?<ShieldCheck size={16}/>:s==="favorites"?<Star size={16}/>:s==="recent"?<KeyRound size={16}/>:s==="trash"?<Trash2 size={16}/>:s==="health"?<Activity size={16}/> :(()=>{const I=icons[s as Kind];return <I size={16}/>})()}<span>{labels[s]}</span>{s==="trash"&&<small>{items.filter(i=>i.deleted_at).length}</small>}</button>)}
      <div className="vault-side-bottom"><div className="vault-encrypted"><LockKeyhole size={15}/><span>End-to-end encrypted<br/><small>Keys stay on this device</small></span></div><button className="vault-lock" onClick={onSignOut}><LogOut size={15}/> Lock vault</button></div>
    </aside>
    <section className="vault-main">
      <header className="vault-top"><div><small>WORKSPACE / ECLIPSE</small><b>{labels[section]}</b></div><div className="vault-top-actions"><label className="vault-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search encrypted items…"/></label><button className="vault-add" onClick={()=>void exportBackup()} disabled={saving}><Download size={15}/> Backup</button><button className="vault-add" onClick={()=>{setCloudModal(true);setScanOpen(false);}} disabled={saving}><Cloud size={15}/> QR Cloud</button><button className="vault-add" onClick={()=>void exportRecoveryKit()}>Recovery kit</button><label className="vault-add" style={{cursor:"pointer"}}>Restore<input hidden type="file" accept=".eclbackup,application/json" onChange={e=>void importBackup(e.target.files?.[0]??null)}/></label><button className="vault-add" onClick={()=>bulkInputRef.current?.click()} disabled={saving}><Plus size={15}/> Add files</button><button className="vault-add" onClick={()=>folderInputRef.current?.click()} disabled={saving}><Folder size={15}/> Add folder</button><input ref={bulkInputRef} hidden type="file" multiple onChange={e=>void uploadMultipleFiles(Array.from(e.target.files??[]))}/><input ref={el=>{folderInputRef.current=el;if(el)el.setAttribute("webkitdirectory","");}} hidden type="file" multiple onChange={e=>void uploadMultipleFiles(Array.from(e.target.files??[]))}/><button className="vault-add" onClick={()=>{setKind(section==="email"?"email":section==="note"?"note":section==="file"?"file":section==="gallery"?"gallery":"password");setShowForm(true);}}><Plus size={16}/> Add item</button></div></header>
      {uploadProgress&&<section className={`vault-upload-tracker ${uploadProgress.status}`} aria-live="polite">
        <div className="vault-upload-orbit"><div className="vault-upload-orbit-core">{uploadProgress.status==="done"?<Check size={19}/>:uploadProgress.status==="error"?<X size={19}/>:<span/>}</div></div>
        <div className="vault-upload-main">
          <div className="vault-upload-heading"><div><span className="vault-eyebrow">{uploadProgress.status==="done"?"UPLOAD COMPLETE":uploadProgress.status==="error"?"UPLOAD INTERRUPTED":"ECLIPSE TRANSFER"} </span><b>{uploadProgress.status==="done"?"Your files are secured":uploadProgress.status==="error"?"Could not finish this batch":"Securing your files…"}</b></div><strong>{uploadProgress.status==="done"?"100%":uploadProgress.status==="error"?"—":`${Math.round(uploadProgress.completedBytes/uploadProgress.totalBytes*100)}%`}</strong></div>
          <div className="vault-upload-track"><span style={{width:`${Math.round(uploadProgress.completedBytes/uploadProgress.totalBytes*100)}%`}}/></div>
          <div className="vault-upload-meta"><span>{uploadProgress.completedFiles} / {uploadProgress.totalFiles} files complete</span><span>{(uploadProgress.completedBytes/1048576).toFixed(1)} / {(uploadProgress.totalBytes/1048576).toFixed(1)} MB</span></div>
          <div className="vault-upload-current"><span className="vault-upload-pulse"/><span>{uploadProgress.status==="done"?"All files encrypted and saved":uploadProgress.status==="error"?"Batch rolled back":uploadProgress.stage==="encrypting"?"Encrypting":uploadProgress.stage==="uploading"?"Uploading encrypted file":uploadProgress.stage==="saving"?"Saving vault record":"Preparing next file"} · {uploadProgress.currentFile}</span></div>
          {uploadProgress.status==="active"&&<small className="vault-upload-eta">{uploadProgress.completedBytes>0?(()=>{const elapsed=(Date.now()-uploadProgress.startedAt)/1000;const rate=uploadProgress.completedBytes/Math.max(elapsed,1);const seconds=Math.max(0,Math.ceil((uploadProgress.totalBytes-uploadProgress.completedBytes)/rate));return `Approx. ${seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}m ${seconds%60}s`} remaining`;})():"Estimating time remaining…"}</small>}
          {uploadProgress.error&&<small className="vault-upload-error">{uploadProgress.error}</small>}
        </div>
        <button className="vault-upload-dismiss" onClick={()=>setUploadProgress(null)} aria-label="Dismiss upload status"><X size={15}/></button>
      </section>}
      <div className="vault-content">
        <div className="vault-intro"><div><span className="vault-eyebrow">PRIVATE BY DESIGN</span><h1>{labels[section]}</h1><p>{section==="trash"?"Restore deleted items or permanently remove them.": "Your items are encrypted before they leave this device."}</p></div><div className="vault-count"><b>{visible.length}</b><span>ITEMS</span></div></div>
        {error&&<div className="vault-error">{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
        {notice&&<div className="vault-notice"><Check size={15}/>{notice}<button onClick={()=>setNotice("")}><X size={14}/></button></div>}
        {loading?<div className="vault-empty">Unlocking encrypted items…</div>:section==="health"?<div className="vault-pulse"><div className="pulse-hero"><div><span className="vault-eyebrow">ECLIPSE INTELLIGENCE</span><h2>Your Vault Pulse</h2><p>Local password hygiene check. Passwords are never sent for analysis.</p></div><div className="pulse-score"><Gauge size={24}/><b>{passwordHealth.score}</b><small>HEALTH SCORE</small></div></div><div className="pulse-stats"><article><span>Saved passwords</span><b>{passwordHealth.total}</b></article><article><span>Needs attention</span><b>{passwordHealth.weak.length+passwordHealth.reused.length+passwordHealth.old.length}</b></article><article><span>Reused entries</span><b>{passwordHealth.reused.length}</b></article></div><div className="pulse-findings"><h3><Sparkles size={16}/> Personal security insights</h3>{passwordHealth.total===0?<p className="pulse-clean">Add password entries to receive a local check.</p>:<>{passwordHealth.weak.length>0&&<div className="pulse-finding"><AlertTriangle size={17}/><span><b>{passwordHealth.weak.length} short password(s)</b><small>Consider updating passwords shorter than 12 characters.</small></span></div>}{passwordHealth.reused.length>0&&<div className="pulse-finding"><AlertTriangle size={17}/><span><b>{passwordHealth.reused.length} reused password entries</b><small>Use a different password for each account.</small></span></div>}{passwordHealth.old.length>0&&<div className="pulse-finding"><AlertTriangle size={17}/><span><b>{passwordHealth.old.length} older entries</b><small>Not updated in more than 180 days.</small></span></div>}{passwordHealth.weak.length===0&&passwordHealth.reused.length===0&&passwordHealth.old.length===0&&<p className="pulse-clean"><ShieldCheck size={16}/> No common hygiene issues detected.</p>}</>}</div><p className="pulse-disclaimer">Basic local hygiene check only; not a breach scan or independent security audit.</p></div>:visible.length===0?<div className="vault-empty"><div><ShieldCheck size={26}/></div><b>{section==="trash"?"Recycle bin is empty":"Nothing here yet"}</b><p>{query?"Try another search.":"Add your first item to start building your private vault."}</p>{section!=="trash"&&<button onClick={()=>setShowForm(true)}><Plus size={15}/> Add your first item</button>}</div>:<div className="vault-items">{visible.map(item=>{const Icon=iconCatalog.find(icon=>icon.key===item.payload.iconKey)?.Icon??icons[item.item_type];return <article className="vault-item" key={item.id}><div className={"vault-item-icon "+item.item_type}>{item.payload.customIconData?<img src={item.payload.customIconData} alt="" />:<Icon size={18}/>}</div><div className="vault-item-info"><b>{item.payload.title}</b><small>{item.item_type.toUpperCase()} · {new Date(item.created_at).toLocaleDateString()}</small>{item.payload.username&&<span>{item.payload.username}</span>}{item.payload.website&&<span>{item.payload.website}</span>}{item.payload.body&&<p>{item.payload.body}</p>}{item.payload.fileName&&<span>{item.payload.fileName} · {((item.payload.fileSize||0)/1024/1024).toFixed(2)} MB</span>}{item.item_type==="password"&&item.payload.secret&&<div className="vault-secret"><span>{showSecrets[item.id]?item.payload.secret:"••••••••••••"}</span><button onClick={()=>setShowSecrets(v=>({...v,[item.id]:!v[item.id]}))}>{showSecrets[item.id]?"Hide":"Reveal"}</button><button onClick={()=>void copyValue(item.payload.secret!)}><Copy size={13}/> Copy</button></div>}</div><div className="vault-item-actions">{!item.deleted_at&&<button title="Edit item" onClick={()=>editItem(item)}><FileText size={15}/></button>}{!item.deleted_at&&<button title={item.is_favorite?"Remove favorite":"Add favorite"} onClick={()=>void toggleFavorite(item)}><Heart size={16} fill={item.is_favorite?"currentColor":"none"}/></button>}{item.storage_path&&!item.deleted_at&&<button title="Download and decrypt" onClick={()=>void downloadFile(item)}><ArrowDownToLine size={16}/></button>}{item.deleted_at?<><button title="Restore" onClick={()=>void restore(item)}><Undo2 size={16}/></button><button title="Permanently delete" onClick={()=>void permanentlyDelete(item)}><Trash2 size={16}/></button></>:<button title="Move to recycle bin" onClick={()=>void moveToTrash(item)}><Trash2 size={16}/></button>}</div></article>})}</div>}
        <div className="vault-footnote"><LockKeyhole size={13}/> Content is encrypted locally before database or file storage. Search runs only on unlocked items.</div>
      </div>
    </section>
    {cloudModal&&<div className="vault-modal-backdrop" onClick={()=>{stopQrScanner();setCloudModal(false);setScanOpen(false);}}><section className="vault-modal vault-cloud-modal" onClick={e=>e.stopPropagation()}><div className="vault-modal-head"><div><span className="vault-eyebrow">ECLIPSE CLOUD</span><h2>QR Backup & Restore</h2></div><button type="button" onClick={()=>{stopQrScanner();setCloudModal(false);setScanOpen(false);}}><X size={18}/></button></div><p className="vault-cloud-copy">Create an encrypted cloud snapshot, save its QR image, and scan it whenever you want to restore this snapshot.</p><div className="vault-cloud-actions"><button type="button" disabled={saving} onClick={()=>void createCloudBackup()}><Cloud size={15}/>{saving?"Creating encrypted backup…":"Create cloud backup + QR"}</button><button type="button" onClick={()=>{setScanOpen(v=>!v);setScanError("");if(scanOpen)stopQrScanner();}}><Camera size={15}/>{scanOpen?"Close scanner":"Scan backup QR"}</button></div>{cloudQr&&<div className="vault-qr-result"><img src={cloudQr} alt="ECLIPSE encrypted cloud backup QR code"/><b>Backup QR ready</b><small>Reference: {cloudBackupId.slice(0,8)}…</small><button type="button" onClick={downloadQr}><Download size={14}/> Download QR image</button></div>}{scanOpen&&<div className="vault-qr-scanner"><video ref={videoRef} playsInline muted/><button type="button" onClick={()=>void startQrScanner()}><Camera size={14}/> Start camera scan</button>{scanError&&<small>{scanError}</small>}<label>Or paste a backup link / ID<input value={scanInput} onChange={e=>setScanInput(e.target.value)} placeholder="Paste QR link or backup ID"/></label><button type="button" disabled={!scanInput.trim()||saving} onClick={()=>void handleQrValue(scanInput)}>Yes, restore this backup</button></div>}<p className="vault-cloud-footnote"><LockKeyhole size={13}/> QR contains only a backup reference. Restore requires your account; backup contents remain encrypted.</p></section></div>}
    {showForm&&<div className="vault-modal-backdrop" onClick={resetForm}><form className="vault-modal" onSubmit={saveItem} onClick={e=>e.stopPropagation()}><div className="vault-modal-head"><div><span className="vault-eyebrow">ENCRYPTED ITEM</span><h2>{editingItem?"Edit vault item":"Add to your vault"}</h2></div><button type="button" onClick={resetForm}><X size={18}/></button></div><label>Item type<select disabled={!!editingItem} value={kind} onChange={e=>setKind(e.target.value as Kind)}><option value="password">Password</option><option value="email">Email account</option><option value="note">Secure note</option><option value="file">File / document</option><option value="gallery">Photo / image</option></select></label><div className="vault-icon-picker"><div className="vault-icon-picker-head"><b>Choose an icon</b><span>{iconCatalog.length}+ built-in icons</span></div><div className="vault-icon-tools"><button type="button" onClick={()=>{const detected=detectPlatformIcon(website||title);setDetectedIcon(detected);setIconKey(detected);setCustomIconData("");}}>Detect from website / title</button><button type="button" onClick={()=>{setIconKey(detectedIcon);setCustomIconData("");}}>Restore detected icon</button></div><input className="vault-icon-search" value={iconQuery} onChange={e=>setIconQuery(e.target.value)} placeholder="Search icons…"/><select className="vault-icon-category" value={iconCategory} onChange={e=>setIconCategory(e.target.value)}>{iconCategories.map(category=><option key={category}>{category}</option>)}</select><div className="vault-icon-grid">{filteredIcons.map(icon=>{const Icon=icon.Icon;return <button type="button" key={icon.key} className={iconKey===icon.key&&!customIconData?"selected":""} title={icon.name} onClick={()=>{setIconKey(icon.key);setDetectedIcon(icon.key);setCustomIconData("");}}><Icon size={18}/><small>{icon.name}</small></button>})}</div><label className="vault-custom-icon">Upload custom icon (PNG, JPG, SVG, WebP)<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e=>{const selected=e.target.files?.[0];if(!selected)return;if(selected.size>256*1024){setError("Custom icons must be 256 KB or smaller.");e.target.value="";return;}const reader=new FileReader();reader.onload=()=>{setCustomIconData(String(reader.result||""));};reader.readAsDataURL(selected);}}/></label>{customIconData&&<div className="vault-custom-preview"><img src={customIconData} alt="Custom icon preview"/><button type="button" onClick={()=>setCustomIconData("")}>Use built-in icon</button></div>}</div><label>Title<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Personal Gmail" required maxLength={120}/></label>{(kind==="password"||kind==="email")&&<><label>Username / Email<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Account username or email"/></label><label>{kind==="email"?"App password / credential":"Password"}<input value={secret} onChange={e=>setSecret(e.target.value)} placeholder="Stored encrypted" autoComplete="off"/></label><label>Website (optional)<input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.com"/></label></>}{kind==="note"&&<label>Note<textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your private note…" rows={5}/></label>}{(kind==="file"||kind==="gallery")&&!editingItem&&<label>Choose file<input type="file" onChange={e=>setFile(e.target.files?.[0]??null)} required/><small>Maximum 50 MB. The file is encrypted before upload.</small></label>}<div className="vault-modal-actions"><button type="button" onClick={resetForm}>Cancel</button><button type="submit" disabled={saving}>{saving?"Encrypting & saving…":editingItem?"Save changes":"Encrypt and save"}</button></div></form></div>}
  </main>;
}

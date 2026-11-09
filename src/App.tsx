import { useMemo, useState } from "react";
import {
  ArrowUpRight, Bell, Check, ChevronDown, Clock3, Cloud, FileImage,
  FileText, Fingerprint, FolderClosed, HardDrive, KeyRound,
  LayoutDashboard, LockKeyhole, MoreHorizontal, Plus, Search, Settings2,
  Shield, ShieldCheck, Star, Trash2, UploadCloud, X,
} from "lucide-react";

type Section = "Overview" | "Passwords" | "Files & Documents" | "Gallery" | "Email Accounts" | "Secure Notes" | "Favorites" | "Recent" | "Recycle Bin";
const nav: { label: Section; icon: typeof LayoutDashboard; count?: string }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Passwords", icon: KeyRound, count: "12" },
  { label: "Files & Documents", icon: FolderClosed, count: "08" },
  { label: "Gallery", icon: FileImage, count: "24" },
  { label: "Email Accounts", icon: LockKeyhole, count: "04" },
  { label: "Secure Notes", icon: FileText, count: "06" },
  { label: "Favorites", icon: Star },
  { label: "Recent", icon: Clock3 },
  { label: "Recycle Bin", icon: Trash2, count: "03" },
];
const recent = [
  { name: "Personal documents", meta: "PDF · 2.4 MB · Updated today", icon: FileText, tone: "rose" },
  { name: "Instagram", meta: "Password · Updated yesterday", icon: KeyRound, tone: "blue" },
  { name: "Travel memories", meta: "Gallery · 18 images", icon: FileImage, tone: "violet" },
];
const categories = [
  { name: "Passwords", detail: "Secure account credentials", count: "12 items", icon: KeyRound },
  { name: "Files & Documents", detail: "Your important files", count: "08 items", icon: FolderClosed },
  { name: "Private Gallery", detail: "Photos and memories", count: "24 items", icon: FileImage },
  { name: "Secure Notes", detail: "Private thoughts and notes", count: "06 items", icon: FileText },
];

export default function App({ onSignOut }: { onSignOut: () => void }) {
  const [section, setSection] = useState<Section>("Overview");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [dark, setDark] = useState(true);
  const [notice, setNotice] = useState("");
  const greeting = useMemo(() => new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()), []);

  return (
    <main className={dark ? "app-shell" : "app-shell light"}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Shield size={19} /></div><div><b>ECLIPSE</b><span>PERSONAL VAULT</span></div></div>
        <button className="vault-switch"><span className="vault-dot" /> Personal vault <ChevronDown size={15} /></button>
        <div className="nav-label">WORKSPACE</div>
        <nav>{nav.map(({ label, icon: Icon, count }) => <button key={label} onClick={() => setSection(label)} className={section === label ? "nav-item active" : "nav-item"}><Icon size={17} /><span>{label}</span>{count && <small>{count}</small>}</button>)}</nav>
        <div className="sidebar-bottom">
          <div className="storage-card"><div className="storage-head"><span>Storage</span><span>24%</span></div><div className="storage-track"><i /></div><small>2.4 GB of 10 GB used</small></div>
          <button className="nav-item"><ShieldCheck size={17}/><span>Security Center</span></button>
          <button className="nav-item"><Cloud size={17}/><span>Backup & Sync</span></button>
          <button className="nav-item"><Settings2 size={17}/><span>Settings</span></button>
          <div className="profile"><div className="avatar">R</div><div><b>Your account</b><small>Personal workspace</small></div><MoreHorizontal size={18}/></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="crumb"><span>Workspace</span><b>/</b>{section}</div>
          <div className="top-actions">
            <label className="search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search your vault..." /><kbd>⌘ K</kbd></label>
            <button className="icon-btn" aria-label="Notifications" onClick={() => setNotice("You're all caught up.")}><Bell size={18}/></button>
            <button className="icon-btn" aria-label="Toggle theme" onClick={() => setDark(v => !v)}><span className="theme-glyph">{dark ? "☼" : "☾"}</span></button>
            <button className="lock-btn" onClick={onSignOut}><LockKeyhole size={15}/> Sign out</button>
          </div>
        </header>

        <div className="content">
          <div className="welcome-row"><div><div className="eyebrow">{greeting.toUpperCase()}</div><h1>{section === "Overview" ? "Your private world." : section}</h1><p>{section === "Overview" ? "Everything that matters, kept safe in one place." : "Your secure space, thoughtfully organized."}</p></div><button className="primary-btn" onClick={() => setShowAdd(true)}><Plus size={17}/> Add new item</button></div>
          <div className="hero-panel"><div className="hero-copy"><div className="hero-kicker"><span className="pulse"/> YOUR SPACE, UNDER YOUR CONTROL</div><h2>A little more peace<br/>of <em>mind.</em></h2><p>Your digital essentials, organized and protected. One calm place for everything important.</p><button className="hero-link" onClick={() => setNotice("Security center will be available after backend setup.")}>Explore security center <ArrowUpRight size={16}/></button></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orb-core"><ShieldCheck size={43}/></div><div className="orbit-chip chip-one"><Fingerprint size={16}/></div><div className="orbit-chip chip-two"><LockKeyhole size={16}/></div><div className="orbit-chip chip-three"><Cloud size={16}/></div></div></div>
          <div className="stats-grid"><div className="stat-card"><div className="stat-icon"><KeyRound/></div><span>Saved passwords</span><b>12</b><small><span className="good">●</span> All items protected</small></div><div className="stat-card"><div className="stat-icon navy"><FolderClosed/></div><span>Files & documents</span><b>08</b><small>Across 3 folders</small></div><div className="stat-card"><div className="stat-icon violet"><FileImage/></div><span>Private gallery</span><b>24</b><small>Across 2 albums</small></div><div className="stat-card"><div className="stat-icon slate"><HardDrive/></div><span>Storage used</span><b>2.4 <i>GB</i></b><small>24% of your space</small></div></div>
          <div className="section-heading"><div><h3>Your collections</h3><p>Everything in its right place.</p></div><button className="text-btn" onClick={() => setNotice("All collections are shown in this prototype.")}>View all <ArrowUpRight size={15}/></button></div>
          <div className="collection-grid">{categories.map(({ name, detail, count, icon: Icon }, i) => <button className="collection-card" key={name} onClick={() => setSection(i === 2 ? "Gallery" : name === "Private Gallery" ? "Gallery" : name as Section)}><div className={"collection-icon c"+i}><Icon size={19}/></div><div className="collection-more"><MoreHorizontal size={17}/></div><b>{name}</b><p>{detail}</p><small>{count}<ArrowUpRight size={13}/></small></button>)}</div>
          <div className="bottom-grid"><div className="recent-panel"><div className="section-heading compact"><div><h3>Recently accessed</h3><p>Pick up where you left off.</p></div><button className="text-btn" onClick={() => setSection("Recent")}>See all <ArrowUpRight size={14}/></button></div>{recent.filter(item => item.name.toLowerCase().includes(query.toLowerCase())).map(({ name, meta, icon: Icon, tone }) => <div className="recent-item" key={name}><div className={"recent-icon "+tone}><Icon size={17}/></div><div className="recent-info"><b>{name}</b><small>{meta}</small></div><button className="icon-btn small"><MoreHorizontal size={17}/></button></div>)}</div>
            <div className="security-panel"><div className="security-top"><div className="security-badge"><ShieldCheck size={19}/></div><span>SECURITY OVERVIEW</span><ArrowUpRight size={15}/></div><h3>Your vault,<br/><em>looking good.</em></h3><p>Keep your security habits strong with a quick check-in.</p><div className="security-meter"><div><span>Security setup</span><b>In progress</b></div><div className="meter-track"><i/></div></div><button className="security-link" onClick={() => setNotice("Complete security setup after secure backend integration.")}>Review security <ArrowUpRight size={15}/></button></div></div>
          <footer><span>© 2026 ECLIPSE</span><span><span className="footer-dot"/> Private by design</span><span>Built for peace of mind</span></footer>
        </div>
      </section>
      {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">QUICK ACTION</span><h3>Add to your vault</h3></div><button className="icon-btn" onClick={() => setShowAdd(false)}><X size={18}/></button></div><div className="add-options">{[{label:"Password",icon:KeyRound},{label:"File or document",icon:UploadCloud},{label:"Photo or image",icon:FileImage},{label:"Secure note",icon:FileText}].map(({label,icon:Icon})=><button key={label} onClick={() => {setShowAdd(false);setNotice(label+" form will be connected in the next implementation phase.")}}><Icon size={19}/><span>{label}</span><ArrowUpRight size={15}/></button>)}</div></div></div>}
      {notice && <div className="toast"><Check size={16}/>{notice}<button onClick={() => setNotice("")}><X size={14}/></button></div>}
    </main>
  );
}

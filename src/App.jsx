import { useState, useEffect } from "react";
import Worklog from "./Worklog.jsx";
import { saveData, subscribeData } from "./firebase.js";

const DAYS_FULL = ["Неділя","Понеділок","Вівторок","Середа","Четвер","П'ятниця","Субота"];
const DAYS_SHORT = ["Нд","Пн","Вт","Ср","Чт","Пт","Сб"];
const MONTHS = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];

const LOC = {
  office: { label:"Офіс", emoji:"🏢", color:"#6c8eff", bg:"rgba(108,142,255,0.13)", border:"rgba(108,142,255,0.35)" },
  remote: { label:"Дистанційно", emoji:"🏠", color:"#5fffd6", bg:"rgba(95,255,214,0.10)", border:"rgba(95,255,214,0.28)" },
};

const TYPE_CONFIG = {
  office: LOC.office,
  remote: LOC.remote,
  split:  { label:"Розбитий день", emoji:"✂️", color:"#ff7eb3", bg:"rgba(255,126,179,0.10)", border:"rgba(255,126,179,0.28)" },
  absent: { label:"Вихідний", emoji:"🚫", color:"#6b7394", bg:"rgba(58,63,82,0.35)", border:"rgba(58,63,82,0.5)" },
};

function getMonday(offset) {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(today);
  m.setDate(today.getDate() + diff + offset * 7);
  m.setHours(0, 0, 0, 0);
  return m;
}

function getWeekDates(offset) {
  const m = getMonday(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(m); d.setDate(m.getDate() + i); return d;
  });
}

function isToday(d) {
  const t = new Date();
  return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
}

function calcHours(day) {
  if (!day || day.type==="absent") return 0;
  const diff=(s,e)=>{ if(!s||!e) return 0; const [sh,sm]=s.split(":").map(Number); const [eh,em]=e.split(":").map(Number); return Math.max(0,(eh*60+em-sh*60-sm)/60); };
  let h=diff(day.start1||"09:00",day.end1||"13:00");
  if (day.type==="split"&&day.start2&&day.end2) h+=diff(day.start2,day.end2);
  return Math.round(h*10)/10;
}

function defaultDay(wd) {
  if (wd===0||wd===6) return {type:"absent"};

  if (wd===1 || wd===2 || wd===3) {
    return {type:"office",start1:"09:00",end1:"13:00",note:""};
  }

  if (wd===4 || wd===5) {
    return {type:"office",start1:"14:00",end1:"18:00",note:""};
  }

  return {type:"office",start1:"09:00",end1:"13:00",note:""};
}

function isViewMode() {
  return new URLSearchParams(window.location.search).get("view")==="1";
}

export default function App() {
  const [tab, setTab] = useState("schedule");
  const [offset, setOffset] = useState(0);
  const [viewOnly] = useState(isViewMode());
  const [editMode, setEditMode] = useState(!isViewMode());
  const [scheduleData, setScheduleData] = useState({});
  const [worklog, setWorklog] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [toast, setToast] = useState("");
  const [showShare, setShowShare] = useState(false);

  // Subscribe to Firebase in real-time
  useEffect(() => {
    let loaded = 0;
    const done = () => { loaded++; if (loaded >= 3) setLoading(false); };

    const unsubSched = subscribeData("sched", data => { setScheduleData(data || {}); done(); });
    const unsubWork  = subscribeData("worklog", data => { setWorklog(data || []); done(); });
    const unsubProj  = subscribeData("projects", data => { setProjects(data || []); done(); });

    return () => { unsubSched(); unsubWork(); unsubProj(); };
  }, []);

  const dates = getWeekDates(offset);
  function getDayData(d) { return scheduleData[d.toDateString()] || defaultDay(d.getDay()); }

  function openModal(d) {
  if (!editMode||viewOnly) return;
    setModal({key:d.toDateString(),date:d});
    setForm({loc1:"office",loc2:"remote",...getDayData(d)});
  }

  async function saveModal() {
    if (!modal) return;
    const updated = {...scheduleData,[modal.key]:{...form}};
    setScheduleData(updated);
    await saveData("sched", updated);
    setModal(null);
    showToast("Збережено ✓");
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""),2000); }

  async function handleWorklogAction(item) {
    if (item.__project) {
      const updated = [...projects, {id:item.id,name:item.name,color:item.color,bg:item.bg,border:item.border}];
      setProjects(updated);
      await saveData("projects", updated);
    } else {
      const updated = [...worklog, item];
      setWorklog(updated);
      await saveData("worklog", updated);
    }
  }

  async function handleWorklogEdit(item) {
    const updated = worklog.map(e => e.id===item.id ? item : e);
    setWorklog(updated);
    await saveData("worklog", updated);
  }

  async function handleWorklogDelete(id) {
    if (id.startsWith("__project__")) {
      const pid = id.replace("__project__","");
      const updated = projects.filter(p=>p.id!==pid);
      setProjects(updated);
      await saveData("projects", updated);
    } else {
      const updated = worklog.filter(e=>e.id!==id);
      setWorklog(updated);
      await saveData("worklog", updated);
    }
  }

  function getShareUrl() { return window.location.origin+window.location.pathname+"?view=1"; }
  function copyShare() { navigator.clipboard.writeText(getShareUrl()).then(()=>showToast("Посилання скопійовано! 🔗")); setShowShare(false); }

  const monday=getMonday(offset), sunday=new Date(monday);
  sunday.setDate(monday.getDate()+6);
  const weekLabel=`${monday.getDate()} ${MONTHS[monday.getMonth()]} — ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
  const totalH=dates.reduce((s,d)=>s+calcHours(getDayData(d)),0);
  const officeDays=dates.filter(d=>["office","split"].includes(getDayData(d).type)).length;
  const remoteDays=dates.filter(d=>getDayData(d).type==="remote").length;

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#0d0f14",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <div style={{width:40,height:40,border:"3px solid #252a3a",borderTop:"3px solid #6c8eff",borderRadius:"50%",animation:"spin 1s linear infinite"}} />
      <div style={{color:"#6b7394",fontFamily:"'Manrope',sans-serif",fontSize:14}}>Завантаження...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#0d0f14",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",paddingBottom:40}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700&family=Manrope:wght@400;500;600&display=swap');
        *{box-sizing:border-box;}
        input[type=time],input[type=date]{background:#1c2030;border:1px solid #252a3a;border-radius:10px;padding:10px 12px;color:#e8eaf2;font-family:'Manrope',sans-serif;font-size:15px;outline:none;width:100%;-webkit-appearance:none;}
        input[type=time]:focus,input[type=date]:focus{border-color:#6c8eff;}
        textarea{background:#1c2030;border:1px solid #252a3a;border-radius:10px;padding:10px 12px;color:#e8eaf2;font-family:'Manrope',sans-serif;font-size:14px;outline:none;width:100%;resize:vertical;min-height:60px;}
        textarea:focus{border-color:#6c8eff;}
      `}</style>

      {toast && <div style={{position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"#252a3a",color:"#5fffd6",padding:"10px 20px",borderRadius:99,fontSize:13,fontWeight:600,zIndex:300,whiteSpace:"nowrap"}}>{toast}</div>}

      {/* Header */}
      <div style={{background:"#161920",borderBottom:"1px solid #252a3a",padding:"16px 16px 0",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:18,fontWeight:700}}>
            Мій <span style={{color:"#6c8eff"}}>графік</span>
          </div>
          <div style={{display:"flex",gap:8}}>
            {!viewOnly && (
              <>
                <button onClick={()=>setShowShare(true)} style={{padding:"7px 12px",borderRadius:99,border:"1px solid #252a3a",background:"#1c2030",color:"#5fffd6",fontFamily:"'Manrope',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer"}}>🔗</button>
                {tab==="schedule" && <button onClick={()=>setEditMode(e=>!e)} style={{padding:"7px 14px",borderRadius:99,border:"none",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontWeight:600,fontSize:12,background:editMode?"#6c8eff":"#1c2030",color:editMode?"#fff":"#6b7394"}}>{editMode?"✏️ Редагую":"✏️ Редагувати"}</button>}
              </>
            )}
            {viewOnly && <div style={{padding:"6px 14px",borderRadius:99,background:"rgba(95,255,214,0.1)",border:"1px solid rgba(95,255,214,0.25)",color:"#5fffd6",fontSize:12,fontWeight:600}}>👁 Перегляд</div>}
          </div>
        </div>
        <div style={{display:"flex",gap:0}}>
          {[{id:"schedule",label:"📅 Графік"},{id:"worklog",label:"⏱ Ворклог"}].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"10px 0",border:"none",background:"transparent",color:tab===t.id?"#e8eaf2":"#6b7394",fontFamily:"'Manrope',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",borderBottom:`2px solid ${tab===t.id?"#6c8eff":"transparent"}`,transition:"all .2s"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 16px 0"}}>

        {tab==="schedule" && (
          <>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <button onClick={()=>setOffset(o=>o-1)} style={NB}>‹</button>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:11,color:"#6b7394",textAlign:"center"}}>{weekLabel}</div>
              <button onClick={()=>setOffset(o=>o+1)} style={NB}>›</button>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
              {[{num:`${totalH}г`,label:"Годин",color:"#6c8eff"},{num:officeDays,label:"Офіс / дн.",color:"#6c8eff"},{num:remoteDays,label:"Дистанційно",color:"#5fffd6"}].map((s,i)=>(
                <div key={i} style={{background:"#1c2030",border:"1px solid #252a3a",borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:20,fontWeight:700,color:s.color}}>{s.num}</div>
                  <div style={{fontSize:10,color:"#6b7394",textTransform:"uppercase",letterSpacing:".7px",marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {dates.map((d,i)=>{
                const wd=d.getDay(),isWE=wd===0||wd===6,today=isToday(d);
                const day=getDayData(d),cfg=TYPE_CONFIG[day.type]||TYPE_CONFIG.absent;
                const h=calcHours(day),clickable=editMode&&!viewOnly;
              return (
                  <div key={i} onClick={()=>openModal(d)} style={{background:"#1c2030",border:`1px solid ${today?"#6c8eff":"#252a3a"}`,borderRadius:16,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,opacity:isWE?0.4:1,cursor:clickable?"pointer":"default",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:cfg.color,borderRadius:"16px 0 0 16px"}}/>
                    <div style={{minWidth:38,paddingLeft:4}}>
                      <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:12,fontWeight:600,color:today?"#6c8eff":"#e8eaf2"}}>{DAYS_SHORT[wd]}</div>
                      <div style={{fontSize:11,color:"#6b7394",marginTop:2}}>{d.getDate()}.{String(d.getMonth()+1).padStart(2,"0")}</div>
                    </div>
                    <div style={{flex:1}}>
                      <span style={{padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:600,background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`}}>{cfg.emoji} {cfg.label}</span>
                      {day.type!=="absent"&&day.type!=="split"&&<div style={{fontSize:12,color:"#e8eaf2",marginTop:5}}>{day.start1} – {day.end1}</div>}
                      {day.type==="split"&&(
                        <div style={{marginTop:5,display:"flex",flexDirection:"column",gap:3}}>
                          <div style={{fontSize:12,color:"#e8eaf2"}}>{LOC[day.loc1||"office"].emoji} {day.start1}–{day.end1} <span style={{color:LOC[day.loc1||"office"].color,fontSize:10}}>{LOC[day.loc1||"office"].label}</span></div>
                          {day.start2&&<div style={{fontSize:12,color:"#e8eaf2"}}>{LOC[day.loc2||"remote"].emoji} {day.start2}–{day.end2} <span style={{color:LOC[day.loc2||"remote"].color,fontSize:10}}>{LOC[day.loc2||"remote"].label}</span></div>}
                        </div>
                      )}
                      {day.note&&<div style={{fontSize:11,color:"#6b7394",marginTop:4}}>💬 {day.note}</div>}
                    </div>
                    {h>0&&<div style={{textAlign:"right",minWidth:36}}><div style={{fontFamily:"'Unbounded',sans-serif",fontSize:16,fontWeight:700,color:cfg.color}}>{h}</div><div style={{fontSize:9,color:"#6b7394",textTransform:"uppercase"}}>год</div></div>}
                    {clickable&&<div style={{fontSize:16,color:"#3a3f52"}}>›</div>}
                  </div>
                );
              })}
            </div>
            {editMode&&!viewOnly&&<div style={{textAlign:"center",marginTop:16,fontSize:12,color:"#3a3f52"}}>Натисни на день щоб редагувати</div>}
          </>
        )}

        {tab==="worklog" && (
          <Worklog entries={worklog} projects={projects} onAdd={handleWorklogAction} onEdit={handleWorklogEdit} onDelete={handleWorklogDelete} viewOnly={viewOnly} />
        )}
      </div>

      {/* Share modal */}
      {showShare&&(
        <div onClick={()=>setShowShare(false)} style={{position:"fixed",inset:0,background:"rgba(13,15,20,0.9)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#1c2030",borderRadius:24,border:"1px solid #252a3a",padding:28,width:"100%",maxWidth:400}}>
            <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:16,fontWeight:600,marginBottom:8}}>🔗 Посилання для колег</div>
            <div style={{fontSize:13,color:"#6b7394",marginBottom:20}}>Колеги побачать графік і ворклог у режимі перегляду в реальному часі.</div>
            <div style={{background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#6b7394",wordBreak:"break-all",marginBottom:16}}>{getShareUrl()}</div>
            <button onClick={copyShare} style={{width:"100%",padding:14,borderRadius:14,border:"none",background:"#6c8eff",color:"#fff",fontFamily:"'Unbounded',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer"}}>Скопіювати посилання</button>
          </div>
        </div>
      )}

      {/* Edit day modal */}
      {modal&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={{position:"fixed",inset:0,background:"rgba(13,15,20,0.9)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",alignItems:"flex-end"}}>
          <div style={{background:"#1c2030",borderRadius:"24px 24px 0 0",border:"1px solid #252a3a",padding:"24px 20px 40px",width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
              <div style={{fontFamily:"'Unbounded',sans-serif",fontSize:14,fontWeight:600}}>{DAYS_FULL[modal.date.getDay()]}, {modal.date.getDate()} {MONTHS[modal.date.getMonth()]}</div>
              <button onClick={()=>setModal(null)} style={{width:32,height:32,borderRadius:"50%",border:"1px solid #252a3a",background:"transparent",color:"#6b7394",fontSize:20,cursor:"pointer"}}>×</button>
            </div>
            <div style={{marginBottom:20}}>
              <div style={LBL}>Тип дня</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {Object.entries(TYPE_CONFIG).map(([type,cfg])=>{
                  const active=form.type===type;
                  return <button key={type} onClick={()=>setForm(f=>({...f,type}))} style={{padding:"12px 8px",borderRadius:14,border:`1px solid ${active?cfg.color:"#252a3a"}`,background:active?cfg.bg:"#161920",color:active?cfg.color:"#6b7394",fontFamily:"'Manrope',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",textAlign:"center",gridColumn:type==="absent"?"span 2":"span 1"}}>{cfg.emoji} {cfg.label}</button>;
                })}
              </div>
            </div>
            {form.type!=="absent"&&(
              <>
                <div style={{marginBottom:16}}>
                  <div style={LBL}>{form.type==="split"?"Перший блок":"Робочий час"}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 20px 1fr",alignItems:"center",gap:8,marginBottom:form.type==="split"?8:0}}>
                    <input type="time" value={form.start1||"09:00"} onChange={e=>setForm(f=>({...f,start1:e.target.value}))}/>
                    <div style={{textAlign:"center",color:"#6b7394"}}>—</div>
                    <input type="time" value={form.end1||"13:00"} onChange={e=>setForm(f=>({...f,end1:e.target.value}))}/>
                  </div>
                  {form.type==="split"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{["office","remote"].map(loc=>{const a=(form.loc1||"office")===loc;return <button key={loc} onClick={()=>setForm(f=>({...f,loc1:loc}))} style={{padding:"9px 8px",borderRadius:10,border:`1px solid ${a?LOC[loc].color:"#252a3a"}`,background:a?LOC[loc].bg:"#161920",color:a?LOC[loc].color:"#6b7394",fontWeight:600,fontSize:12,cursor:"pointer"}}>{LOC[loc].emoji} {LOC[loc].label}</button>;})}</div>}
                </div>
                {form.type==="split"&&(
                  <div style={{marginBottom:16}}>
                    <div style={LBL}>Другий блок</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 20px 1fr",alignItems:"center",gap:8,marginBottom:8}}>
                      <input type="time" value={form.start2||"15:00"} onChange={e=>setForm(f=>({...f,start2:e.target.value}))}/>
                      <div style={{textAlign:"center",color:"#6b7394"}}>—</div>
                      <input type="time" value={form.end2||"17:00"} onChange={e=>setForm(f=>({...f,end2:e.target.value}))}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{["office","remote"].map(loc=>{const a=(form.loc2||"remote")===loc;return <button key={loc} onClick={()=>setForm(f=>({...f,loc2:loc}))} style={{padding:"9px 8px",borderRadius:10,border:`1px solid ${a?LOC[loc].color:"#252a3a"}`,background:a?LOC[loc].bg:"#161920",color:a?LOC[loc].color:"#6b7394",fontWeight:600,fontSize:12,cursor:"pointer"}}>{LOC[loc].emoji} {LOC[loc].label}</button>;})}</div>
                  </div>
                )}
              </>
            )}
            <div style={{marginBottom:24}}>
              <div style={LBL}>Нотатка (необов'язково)</div>
              <textarea value={form.note||""} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Напр.: нарада з 10:00..."/>
            </div>
            <button onClick={saveModal} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:"#6c8eff",color:"#fff",fontFamily:"'Unbounded',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer"}}>Зберегти</button>
          </div>
        </div>
      )}
    </div>
  );
}

const NB={width:36,height:36,borderRadius:"50%",border:"1px solid #252a3a",background:"#1c2030",color:"#e8eaf2",cursor:"pointer",fontSize:18};
const LBL={fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:".8px",color:"#6b7394",marginBottom:10};

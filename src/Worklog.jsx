import { useState, useMemo } from "react";

const PROJECT_COLORS = [
  { color: "#6c8eff", bg: "rgba(108,142,255,0.13)", border: "rgba(108,142,255,0.35)" },
  { color: "#5fffd6", bg: "rgba(95,255,214,0.12)", border: "rgba(95,255,214,0.25)" },
  { color: "#ff7eb3", bg: "rgba(255,126,179,0.12)", border: "rgba(255,126,179,0.28)" },
  { color: "#ffd36c", bg: "rgba(255,211,108,0.10)", border: "rgba(255,211,108,0.28)" },
  { color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.28)" },
  { color: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.28)" },
];

const MONTHS = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function calcDuration(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

// Total = sum of all slots + manual hours (both independent, both optional)
function calcEntryTotal(entry) {
  const slotsTotal = (entry.slots || []).reduce((s, sl) => s + calcDuration(sl.start, sl.end), 0);
  const manual = parseFloat(entry.manualHours) || 0;
  return Math.round((slotsTotal + manual) * 10) / 10;
}

function getQuarter(date) {
  return Math.floor(new Date(date + "T00:00:00").getMonth() / 3);
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0,10),
  task: "",
  projectId: "",
  slots: [],
  manualHours: "",
};

export default function Worklog({ entries, projects, onAdd, onEdit, onDelete, viewOnly }) {
  const [tab, setTab] = useState("log");
  const [showModal, setShowModal] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [newProject, setNewProject] = useState("");
  const [reportPeriod, setReportPeriod] = useState("week");

  function openAdd() {
    setEditEntry(null);
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0,10) });
    setShowModal(true);
  }

  function openEdit(entry) {
    setEditEntry(entry);
    setForm({
      date: entry.date,
      task: entry.task,
      projectId: entry.projectId || "",
      slots: entry.slots || [],
      manualHours: entry.manualHours || "",
    });
    setShowModal(true);
  }

  function handleSave() {
    if (!form.task.trim()) return;
    const item = {
      id: editEntry ? editEntry.id : Date.now().toString(),
      date: form.date,
      task: form.task,
      projectId: form.projectId,
      slots: form.slots,
      manualHours: form.manualHours,
    };
    if (editEntry) { onEdit(item); }
    else { onAdd(item); }
    setShowModal(false);
    setEditEntry(null);
  }

  function addSlot() {
    setForm(f => ({ ...f, slots: [...f.slots, { start: "09:00", end: "13:00" }] }));
  }
  function removeSlot(i) {
    setForm(f => ({ ...f, slots: f.slots.filter((_, idx) => idx !== i) }));
  }
  function updateSlot(i, field, val) {
    setForm(f => ({ ...f, slots: f.slots.map((sl, idx) => idx === i ? { ...sl, [field]: val } : sl) }));
  }

  function handleAddProject() {
    if (!newProject.trim()) return;
    const colorIdx = projects.length % PROJECT_COLORS.length;
    onAdd({ __project: true, id: Date.now().toString(), name: newProject.trim(), ...PROJECT_COLORS[colorIdx] });
    setNewProject("");
  }

  const filtered = filter === "all" ? entries : entries.filter(e => e.projectId === filter);
  const grouped = {};
  filtered.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Form totals preview
  const formSlotsTotal = form.slots.reduce((s, sl) => s + calcDuration(sl.start, sl.end), 0);
  const formManual = parseFloat(form.manualHours) || 0;
  const formTotal = Math.round((formSlotsTotal + formManual) * 10) / 10;

  // Report
  const reportData = useMemo(() => {
    const now = new Date();
    let periodEntries = [];
    if (reportPeriod === "day") {
      const today = now.toISOString().slice(0,10);
      periodEntries = entries.filter(e => e.date === today);
    } else if (reportPeriod === "week") {
      const ws = getWeekStart(now);
      const we = new Date(ws); we.setDate(ws.getDate() + 6);
      periodEntries = entries.filter(e => {
        const d = new Date(e.date + "T00:00:00");
        return d >= ws && d <= we;
      });
    } else if (reportPeriod === "month") {
      periodEntries = entries.filter(e => e.date.slice(0,7) === now.toISOString().slice(0,7));
    } else if (reportPeriod === "quarter") {
      const q = getQuarter(now.toISOString().slice(0,10));
      const year = now.getFullYear();
      periodEntries = entries.filter(e => {
        const d = new Date(e.date + "T00:00:00");
        return d.getFullYear() === year && getQuarter(e.date) === q;
      });
    }
    const totalHours = Math.round(periodEntries.reduce((s,e) => s + calcEntryTotal(e), 0) * 10) / 10;
    const totalTasks = periodEntries.length;
    const byProject = {};
    periodEntries.forEach(e => {
      const key = e.projectId || "none";
      byProject[key] = (byProject[key] || 0) + calcEntryTotal(e);
    });
    const projectStats = Object.entries(byProject).map(([id, hours]) => {
      const proj = projects.find(p => p.id === id);
      return { id, name: proj ? proj.name : "Без проєкту", color: proj ? proj.color : "#6b7394", bg: proj ? proj.bg : "rgba(107,115,148,0.2)", hours: Math.round(hours*10)/10, pct: totalHours > 0 ? Math.round((hours/totalHours)*100) : 0 };
    }).sort((a,b) => b.hours - a.hours);
    const byDay = {};
    periodEntries.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + calcEntryTotal(e); });
    return { totalHours, totalTasks, projectStats, byDay };
  }, [entries, projects, reportPeriod]);

  return (
    <div>
      <style>{`
        input[type=number]::-webkit-inner-spin-button { opacity:1; }
      `}</style>

      {/* Log / Report tabs */}
      <div style={{ display:"flex", gap:0, marginBottom:20, background:"#161920", borderRadius:12, padding:4 }}>
        {[{id:"log",label:"📋 Журнал"},{id:"report",label:"📊 Звіт"}].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:10, background:tab===t.id?"#1c2030":"transparent", color:tab===t.id?"#e8eaf2":"#6b7394", fontFamily:"'Manrope',sans-serif", fontWeight:600, fontSize:13, cursor:"pointer" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── LOG ── */}
      {tab === "log" && (<>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:14, fontWeight:600 }}>⏱ Ворклог</div>
          {!viewOnly && (
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setShowProjects(true)} style={BTNOUT}>🏷 Проєкти</button>
              <button onClick={openAdd} style={BTNPRIMARY}>+ Додати</button>
            </div>
          )}
        </div>

        {projects.length > 0 && (
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
            <button onClick={()=>setFilter("all")} style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${filter==="all"?"#6c8eff":"#252a3a"}`, background:filter==="all"?"rgba(108,142,255,0.13)":"transparent", color:filter==="all"?"#6c8eff":"#6b7394", fontSize:11, fontWeight:600, cursor:"pointer" }}>Всі</button>
            {projects.map(p => (
              <button key={p.id} onClick={()=>setFilter(filter===p.id?"all":p.id)} style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${filter===p.id?p.color:"#252a3a"}`, background:filter===p.id?p.bg:"transparent", color:filter===p.id?p.color:"#6b7394", fontSize:11, fontWeight:600, cursor:"pointer" }}>{p.name}</button>
            ))}
          </div>
        )}

        {sortedDates.length === 0 && <div style={{ textAlign:"center", padding:"40px 0", color:"#3a3f52", fontSize:13 }}>{viewOnly?"Записів ще немає":"Додай перший запис у ворклог"}</div>}

        {sortedDates.map(date => {
          const dayEntries = grouped[date];
          const dayTotal = Math.round(dayEntries.reduce((s,e) => s+calcEntryTotal(e), 0)*10)/10;
          return (
            <div key={date} style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#6b7394", textTransform:"uppercase", letterSpacing:".7px" }}>{formatDate(date)}</div>
                <div style={{ fontSize:12, color:"#6c8eff", fontWeight:600 }}>{dayTotal}г</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {dayEntries.map(entry => {
                  const proj = projects.find(p => p.id === entry.projectId);
                  const dur = calcEntryTotal(entry);
                  const slotsH = Math.round((entry.slots||[]).reduce((s,sl)=>s+calcDuration(sl.start,sl.end),0)*10)/10;
                  const manualH = parseFloat(entry.manualHours)||0;
                  return (
                    <div key={entry.id} style={{ background:"#1c2030", border:"1px solid #252a3a", borderRadius:14, padding:"12px 16px", position:"relative", overflow:"hidden", cursor:!viewOnly?"pointer":"default" }}
                      onClick={()=>!viewOnly&&openEdit(entry)}>
                      {proj && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:proj.color, borderRadius:"14px 0 0 14px" }} />}
                      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                        <div style={{ flex:1, paddingLeft:proj?6:0 }}>
                          {proj && <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:99, fontSize:10, fontWeight:600, background:proj.bg, color:proj.color, border:`1px solid ${proj.border}`, marginBottom:6 }}>{proj.name}</span>}
                          <div style={{ fontSize:13, color:"#e8eaf2", lineHeight:1.4 }}>{entry.task}</div>
                          <div style={{ fontSize:11, color:"#6b7394", marginTop:5, display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
                            {(entry.slots||[]).map((sl,i) => <span key={i}>{sl.start}–{sl.end}{slotsH>0&&i===0&&<span style={{color:"#5fffd6",marginLeft:4}}>{slotsH}г</span>}</span>)}
                            {manualH > 0 && <span style={{ color:"#ffd36c" }}>+{manualH}г вручну</span>}
                            <span style={{ color:"#5fffd6", fontWeight:700 }}>={dur}г</span>
                          </div>
                        </div>
                        {!viewOnly && (
                          <div style={{ display:"flex", gap:4 }}>
                            <button onClick={e=>{e.stopPropagation();openEdit(entry);}} style={{ background:"transparent",border:"none",color:"#6b7394",fontSize:14,cursor:"pointer",padding:"2px 4px" }}>✏️</button>
                            <button onClick={e=>{e.stopPropagation();onDelete(entry.id);}} style={{ background:"transparent",border:"none",color:"#3a3f52",fontSize:18,cursor:"pointer",padding:"2px 4px" }}>×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </>)}

      {/* ── REPORT ── */}
      {tab === "report" && (<>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
          {[{id:"day",l:"Сьогодні"},{id:"week",l:"Тиждень"},{id:"month",l:"Місяць"},{id:"quarter",l:"Квартал"}].map(({id,l}) => (
            <button key={id} onClick={()=>setReportPeriod(id)} style={{ padding:"8px 16px", borderRadius:99, border:`1px solid ${reportPeriod===id?"#6c8eff":"#252a3a"}`, background:reportPeriod===id?"rgba(108,142,255,0.13)":"#1c2030", color:reportPeriod===id?"#6c8eff":"#6b7394", fontSize:12, fontWeight:600, cursor:"pointer" }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          <div style={{ background:"#1c2030", border:"1px solid #252a3a", borderRadius:14, padding:16, textAlign:"center" }}>
            <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:26, fontWeight:700, color:"#6c8eff" }}>{reportData.totalHours}</div>
            <div style={{ fontSize:10, color:"#6b7394", textTransform:"uppercase", letterSpacing:".7px", marginTop:4 }}>Годин</div>
          </div>
          <div style={{ background:"#1c2030", border:"1px solid #252a3a", borderRadius:14, padding:16, textAlign:"center" }}>
            <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:26, fontWeight:700, color:"#5fffd6" }}>{reportData.totalTasks}</div>
            <div style={{ fontSize:10, color:"#6b7394", textTransform:"uppercase", letterSpacing:".7px", marginTop:4 }}>Задач</div>
          </div>
        </div>
        {reportData.projectStats.length > 0 && (
          <div style={{ background:"#1c2030", border:"1px solid #252a3a", borderRadius:14, padding:16, marginBottom:20 }}>
            <div style={SECTION_TITLE}>По проєктах</div>
            {reportData.projectStats.map(p => (
              <div key={p.id} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:p.color }} />
                    <span style={{ fontSize:12, color:"#e8eaf2" }}>{p.name}</span>
                  </div>
                  <div style={{ display:"flex", gap:12 }}>
                    <span style={{ fontSize:12, fontWeight:600, color:p.color }}>{p.hours}г</span>
                    <span style={{ fontSize:12, color:"#6b7394", minWidth:32, textAlign:"right" }}>{p.pct}%</span>
                  </div>
                </div>
                <div style={{ height:6, background:"#161920", borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${p.pct}%`, background:p.color, borderRadius:99 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {Object.keys(reportData.byDay).length > 0 && (
          <div style={{ background:"#1c2030", border:"1px solid #252a3a", borderRadius:14, padding:16 }}>
            <div style={SECTION_TITLE}>По днях</div>
            {Object.entries(reportData.byDay).sort((a,b)=>b[0].localeCompare(a[0])).map(([date,hours]) => {
              const maxH = Math.max(...Object.values(reportData.byDay));
              return (
                <div key={date} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"#6b7394" }}>{formatDate(date)}</span>
                    <span style={{ fontSize:12, fontWeight:600, color:"#6c8eff" }}>{Math.round(hours*10)/10}г</span>
                  </div>
                  <div style={{ height:5, background:"#161920", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${maxH>0?(hours/maxH)*100:0}%`, background:"#6c8eff", borderRadius:99 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {reportData.totalTasks === 0 && <div style={{ textAlign:"center", padding:"40px 0", color:"#3a3f52", fontSize:13 }}>Немає записів за цей період</div>}
      </>)}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div onClick={e=>{if(e.target===e.currentTarget){setShowModal(false);setEditEntry(null);}}} style={{ position:"fixed", inset:0, background:"rgba(13,15,20,0.9)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
          <div style={{ background:"#1c2030", borderRadius:"24px 24px 0 0", border:"1px solid #252a3a", padding:"24px 20px 40px", width:"100%", maxHeight:"92vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:14, fontWeight:600 }}>{editEntry?"Редагувати запис":"Новий запис"}</div>
              <button onClick={()=>{setShowModal(false);setEditEntry(null);}} style={{ width:32,height:32,borderRadius:"50%",border:"1px solid #252a3a",background:"transparent",color:"#6b7394",fontSize:20,cursor:"pointer" }}>×</button>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={LBL}>Дата</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={DI} />
            </div>

            {projects.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={LBL}>Проєкт</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button onClick={()=>setForm(f=>({...f,projectId:""}))} style={{ padding:"7px 12px", borderRadius:99, border:`1px solid ${!form.projectId?"#6b7394":"#252a3a"}`, background:!form.projectId?"rgba(107,115,148,0.2)":"transparent", color:!form.projectId?"#e8eaf2":"#6b7394", fontSize:11, fontWeight:600, cursor:"pointer" }}>Без проєкту</button>
                  {projects.map(p => (
                    <button key={p.id} onClick={()=>setForm(f=>({...f,projectId:p.id}))} style={{ padding:"7px 12px", borderRadius:99, border:`1px solid ${form.projectId===p.id?p.color:"#252a3a"}`, background:form.projectId===p.id?p.bg:"transparent", color:form.projectId===p.id?p.color:"#6b7394", fontSize:11, fontWeight:600, cursor:"pointer" }}>{p.name}</button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <div style={LBL}>Задача</div>
              <textarea value={form.task} onChange={e=>setForm(f=>({...f,task:e.target.value}))} placeholder="Що зробила?" style={{ background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 12px",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",fontSize:14,outline:"none",width:"100%",resize:"vertical",minHeight:72 }} />
            </div>

            {/* Time slots */}
            <div style={{ marginBottom:16 }}>
              <div style={LBL}>Часові проміжки</div>
              {form.slots.length === 0 && (
                <div style={{ fontSize:12, color:"#3a3f52", marginBottom:10 }}>Ще немає проміжків</div>
              )}
              {form.slots.map((sl, i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 20px 1fr auto", alignItems:"center", gap:8, marginBottom:10 }}>
                  <input type="time" value={sl.start} onChange={e=>updateSlot(i,"start",e.target.value)} style={TI} />
                  <div style={{ textAlign:"center", color:"#6b7394" }}>—</div>
                  <input type="time" value={sl.end} onChange={e=>updateSlot(i,"end",e.target.value)} style={TI} />
                  <button onClick={()=>removeSlot(i)} style={{ background:"transparent",border:"none",color:"#3a3f52",fontSize:20,cursor:"pointer",lineHeight:1 }}>×</button>
                </div>
              ))}
              {form.slots.length > 0 && (
                <div style={{ fontSize:12, color:"#5fffd6", marginBottom:10 }}>
                  Проміжки: {Math.round(formSlotsTotal*10)/10}г
                </div>
              )}
              <button onClick={addSlot} style={{ width:"100%", padding:"9px", borderRadius:10, border:"1px dashed #252a3a", background:"transparent", color:"#6b7394", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Додати проміжок</button>
            </div>

            {/* Manual hours — always visible, additive */}
            <div style={{ marginBottom:24 }}>
              <div style={LBL}>
                Додаткові години вручну
                <span style={{ fontSize:10, color:"#3a3f52", fontWeight:400, marginLeft:6, textTransform:"none", letterSpacing:0 }}>(додаються до проміжків)</span>
              </div>
              <input type="number" min="0" max="24" step="0.5" value={form.manualHours} onChange={e=>setForm(f=>({...f,manualHours:e.target.value}))} placeholder="Напр.: 1.5" style={{ ...DI }} />
            </div>

            {/* Total preview */}
            {formTotal > 0 && (
              <div style={{ background:"rgba(108,142,255,0.08)", border:"1px solid rgba(108,142,255,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:13, color:"#6b7394" }}>Загалом за задачу:</span>
                <span style={{ fontFamily:"'Unbounded',sans-serif", fontSize:18, fontWeight:700, color:"#6c8eff" }}>{formTotal}г</span>
              </div>
            )}

            <button onClick={handleSave} style={{ width:"100%",padding:16,borderRadius:14,border:"none",background:form.task.trim()?"#6c8eff":"#252a3a",color:"#fff",fontFamily:"'Unbounded',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer" }}>
              {editEntry?"Зберегти зміни":"Додати запис"}
            </button>
          </div>
        </div>
      )}

      {/* Projects modal */}
      {showProjects && (
        <div onClick={e=>{if(e.target===e.currentTarget)setShowProjects(false)}} style={{ position:"fixed", inset:0, background:"rgba(13,15,20,0.9)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
          <div style={{ background:"#1c2030", borderRadius:"24px 24px 0 0", border:"1px solid #252a3a", padding:"24px 20px 40px", width:"100%", maxHeight:"80vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:14, fontWeight:600 }}>🏷 Проєкти</div>
              <button onClick={()=>setShowProjects(false)} style={{ width:32,height:32,borderRadius:"50%",border:"1px solid #252a3a",background:"transparent",color:"#6b7394",fontSize:20,cursor:"pointer" }}>×</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
              {projects.length === 0 && <div style={{ color:"#3a3f52", fontSize:13, textAlign:"center", padding:"16px 0" }}>Проєктів ще немає</div>}
              {projects.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#161920", border:`1px solid ${p.border}`, borderRadius:12, padding:"12px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:p.color }} />
                    <span style={{ fontSize:14, fontWeight:600, color:p.color }}>{p.name}</span>
                  </div>
                  <button onClick={()=>onDelete("__project__"+p.id)} style={{ background:"transparent",border:"none",color:"#3a3f52",fontSize:18,cursor:"pointer" }}>×</button>
                </div>
              ))}
            </div>
            <div style={LBL}>Новий проєкт</div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={newProject} onChange={e=>setNewProject(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddProject()} placeholder="Назва проєкту..." style={{ flex:1,background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 12px",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",fontSize:14,outline:"none" }} />
              <button onClick={handleAddProject} style={{ padding:"10px 16px",borderRadius:10,border:"none",background:"#6c8eff",color:"#fff",fontWeight:600,fontSize:13,cursor:"pointer" }}>+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LBL = { fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".8px", color:"#6b7394", marginBottom:10, display:"block" };
const TI = { background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 12px",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%" };
const DI = { background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 12px",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%" };
const BTNOUT = { padding:"7px 12px", borderRadius:99, border:"1px solid #252a3a", background:"#1c2030", color:"#6b7394", fontSize:12, fontWeight:600, cursor:"pointer" };
const BTNPRIMARY = { padding:"7px 14px", borderRadius:99, border:"none", background:"#6c8eff", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" };
const SECTION_TITLE = { fontSize:11, fontWeight:600, color:"#6b7394", textTransform:"uppercase", letterSpacing:".7px", marginBottom:14 };

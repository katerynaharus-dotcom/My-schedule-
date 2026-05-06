import { useState } from "react";

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
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function calcDuration(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

const EMPTY_FORM = { date: new Date().toISOString().slice(0,10), start: "09:00", end: "13:00", task: "", projectId: "" };

export default function Worklog({ entries, projects, onAdd, onEdit, onDelete, viewOnly }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [editEntry, setEditEntry] = useState(null); // entry being edited
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const [newProject, setNewProject] = useState("");

  function openAdd() {
    setForm({ ...EMPTY_FORM, projectId: "" });
    setShowAdd(true);
  }

  function openEdit(entry) {
    setEditEntry(entry);
    setForm({ date: entry.date, start: entry.start, end: entry.end, task: entry.task, projectId: entry.projectId || "" });
  }

  function handleSave() {
    if (!form.task.trim()) return;
    if (editEntry) {
      onEdit({ ...editEntry, ...form });
      setEditEntry(null);
    } else {
      onAdd({ id: Date.now().toString(), ...form });
      setShowAdd(false);
    }
    setForm(EMPTY_FORM);
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
  const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

  const projectHours = {};
  entries.forEach(e => {
    const h = calcDuration(e.start, e.end);
    projectHours[e.projectId || "none"] = (projectHours[e.projectId || "none"] || 0) + h;
  });

  const isModalOpen = showAdd || editEntry !== null;

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
        <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:14, fontWeight:600 }}>⏱ Ворклог</div>
        {!viewOnly && (
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => setShowProjects(true)} style={{ padding:"7px 12px", borderRadius:99, border:"1px solid #252a3a", background:"#1c2030", color:"#6b7394", fontSize:12, fontWeight:600, cursor:"pointer" }}>🏷 Проєкти</button>
            <button onClick={openAdd} style={{ padding:"7px 14px", borderRadius:99, border:"none", background:"#6c8eff", color:"#fff", fontSize:12, fontWeight:600, cursor:"pointer" }}>+ Додати</button>
          </div>
        )}
      </div>

      {/* Project filter */}
      {projects.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
          <button onClick={() => setFilter("all")} style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${filter==="all"?"#6c8eff":"#252a3a"}`, background:filter==="all"?"rgba(108,142,255,0.13)":"transparent", color:filter==="all"?"#6c8eff":"#6b7394", fontSize:11, fontWeight:600, cursor:"pointer" }}>Всі</button>
          {projects.map(p => (
            <button key={p.id} onClick={() => setFilter(filter===p.id?"all":p.id)} style={{ padding:"5px 12px", borderRadius:99, border:`1px solid ${filter===p.id?p.color:"#252a3a"}`, background:filter===p.id?p.bg:"transparent", color:filter===p.id?p.color:"#6b7394", fontSize:11, fontWeight:600, cursor:"pointer" }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <div style={{ background:"#161920", border:"1px solid #252a3a", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", gap:16, flexWrap:"wrap" }}>
          {projects.filter(p => projectHours[p.id]).map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:p.color }} />
              <span style={{ fontSize:11, color:"#6b7394" }}>{p.name}:</span>
              <span style={{ fontSize:12, fontWeight:600, color:p.color }}>{Math.round(projectHours[p.id]*10)/10}г</span>
            </div>
          ))}
          {projectHours["none"] > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#6b7394" }} />
              <span style={{ fontSize:11, color:"#6b7394" }}>Без проєкту:</span>
              <span style={{ fontSize:12, fontWeight:600, color:"#6b7394" }}>{Math.round(projectHours["none"]*10)/10}г</span>
            </div>
          )}
        </div>
      )}

      {/* Entries */}
      {sortedDates.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 0", color:"#3a3f52", fontSize:13 }}>
          {viewOnly ? "Записів ще немає" : "Додай перший запис у ворклог"}
        </div>
      )}

      {sortedDates.map(date => {
        const dayEntries = grouped[date];
        const dayTotal = dayEntries.reduce((s,e) => s + calcDuration(e.start, e.end), 0);
        return (
          <div key={date} style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#6b7394", textTransform:"uppercase", letterSpacing:".7px" }}>{formatDate(date)}</div>
              <div style={{ fontSize:12, color:"#6c8eff", fontWeight:600 }}>{Math.round(dayTotal*10)/10}г</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {dayEntries.sort((a,b) => a.start.localeCompare(b.start)).map(entry => {
                const proj = projects.find(p => p.id === entry.projectId);
                const dur = calcDuration(entry.start, entry.end);
                return (
                  <div key={entry.id} style={{ background:"#1c2030", border:"1px solid #252a3a", borderRadius:14, padding:"12px 16px", position:"relative", overflow:"hidden", cursor: !viewOnly ? "pointer" : "default" }}
                    onClick={() => !viewOnly && openEdit(entry)}>
                    {proj && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:proj.color, borderRadius:"14px 0 0 14px" }} />}
                    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
                      <div style={{ flex:1, paddingLeft: proj ? 6 : 0 }}>
                        {proj && <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:99, fontSize:10, fontWeight:600, background:proj.bg, color:proj.color, border:`1px solid ${proj.border}`, marginBottom:6 }}>{proj.name}</span>}
                        <div style={{ fontSize:13, color:"#e8eaf2", lineHeight:1.4 }}>{entry.task}</div>
                        <div style={{ fontSize:11, color:"#6b7394", marginTop:5 }}>
                          {entry.start} – {entry.end}
                          <span style={{ marginLeft:8, color:"#5fffd6", fontWeight:600 }}>{Math.round(dur*10)/10}г</span>
                        </div>
                      </div>
                      {!viewOnly && (
                        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                          <button onClick={e => { e.stopPropagation(); openEdit(entry); }} style={{ background:"transparent", border:"none", color:"#6b7394", fontSize:13, cursor:"pointer", padding:"2px 4px" }}>✏️</button>
                          <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }} style={{ background:"transparent", border:"none", color:"#3a3f52", fontSize:16, cursor:"pointer", padding:"2px 4px" }}>×</button>
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

      {/* Add/Edit modal */}
      {isModalOpen && (
        <div onClick={e=>{if(e.target===e.currentTarget){setShowAdd(false);setEditEntry(null);}}} style={{ position:"fixed", inset:0, background:"rgba(13,15,20,0.9)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
          <div style={{ background:"#1c2030", borderRadius:"24px 24px 0 0", border:"1px solid #252a3a", padding:"24px 20px 40px", width:"100%", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <div style={{ fontFamily:"'Unbounded',sans-serif", fontSize:14, fontWeight:600 }}>{editEntry ? "Редагувати запис" : "Новий запис"}</div>
              <button onClick={()=>{setShowAdd(false);setEditEntry(null);}} style={{ width:32,height:32,borderRadius:"50%",border:"1px solid #252a3a",background:"transparent",color:"#6b7394",fontSize:20,cursor:"pointer" }}>×</button>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={LBL}>Дата</div>
              <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={DI} />
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={LBL}>Час</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 20px 1fr", alignItems:"center", gap:8 }}>
                <input type="time" value={form.start} onChange={e=>setForm(f=>({...f,start:e.target.value}))} style={TI} />
                <div style={{ textAlign:"center", color:"#6b7394" }}>—</div>
                <input type="time" value={form.end} onChange={e=>setForm(f=>({...f,end:e.target.value}))} style={TI} />
              </div>
              {form.start && form.end && (
                <div style={{ marginTop:6, fontSize:12, color:"#5fffd6" }}>⏱ {Math.round(calcDuration(form.start,form.end)*10)/10} год</div>
              )}
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

            <div style={{ marginBottom:24 }}>
              <div style={LBL}>Задача</div>
              <textarea value={form.task} onChange={e=>setForm(f=>({...f,task:e.target.value}))} placeholder="Що зробила? Напр.: зустріч з командою, підготовка звіту..." style={{ background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 12px",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",fontSize:14,outline:"none",width:"100%",resize:"vertical",minHeight:80 }} />
            </div>

            <button onClick={handleSave} style={{ width:"100%",padding:16,borderRadius:14,border:"none",background:form.task.trim()?"#6c8eff":"#252a3a",color:"#fff",fontFamily:"'Unbounded',sans-serif",fontWeight:600,fontSize:14,cursor:"pointer" }}>
              {editEntry ? "Зберегти зміни" : "Додати запис"}
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

const LBL = { fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:".8px", color:"#6b7394", marginBottom:10 };
const TI = { background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 12px",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%" };
const DI = { background:"#161920",border:"1px solid #252a3a",borderRadius:10,padding:"10px 12px",color:"#e8eaf2",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%" };

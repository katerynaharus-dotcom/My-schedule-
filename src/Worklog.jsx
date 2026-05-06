import { useMemo, useState } from "react";

const PROJECT_COLORS = [
  { color: "#6c8eff", bg: "rgba(108,142,255,0.13)", border: "rgba(108,142,255,0.35)" },
  { color: "#5fffd6", bg: "rgba(95,255,214,0.12)", border: "rgba(95,255,214,0.25)" },
  { color: "#ff7eb3", bg: "rgba(255,126,179,0.12)", border: "rgba(255,126,179,0.28)" },
  { color: "#ffd36c", bg: "rgba(255,211,108,0.10)", border: "rgba(255,211,108,0.28)" },
  { color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.28)" },
  { color: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.28)" },
];

const MONTHS = [
  "січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"
];

const EMPTY_BLOCK = { start: "09:00", end: "13:00" };

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  task: "",
  projectId: "",
  timeBlocks: [{ ...EMPTY_BLOCK }],
};

function roundHours(value) {
  return Math.round(value * 10) / 10;
}

function calcDuration(start, end) {
  if (!start || !end) return 0;

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  if ([sh, sm, eh, em].some(Number.isNaN)) return 0;

  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

function getEntryBlocks(entry) {
  if (Array.isArray(entry.timeBlocks) && entry.timeBlocks.length > 0) {
    return entry.timeBlocks;
  }

  if (entry.start && entry.end) {
    return [{ start: entry.start, end: entry.end }];
  }

  return [];
}

function calcEntryHours(entry) {
  return getEntryBlocks(entry).reduce((sum, block) => {
    return sum + calcDuration(block.start, block.end);
  }, 0);
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getQuarter(date) {
  return Math.floor(date.getMonth() / 3);
}

function getPeriodRange(period, selectedDate) {
  const selected = new Date(`${selectedDate}T00:00:00`);
  let start = new Date(selected);
  let end = new Date(selected);

  if (period === "day") {
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 1);
  }

  if (period === "week") {
    start = getWeekStart(selected);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  }

  if (period === "month") {
    start = new Date(selected.getFullYear(), selected.getMonth(), 1);
    end = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
  }

  if (period === "quarter") {
    const q = getQuarter(selected);
    start = new Date(selected.getFullYear(), q * 3, 1);
    end = new Date(selected.getFullYear(), q * 3 + 3, 1);
  }

  return {
    startDate: toISODate(start),
    endDate: toISODate(end),
    start,
    end,
  };
}

function getPeriodLabel(period, selectedDate) {
  const { start, end } = getPeriodRange(period, selectedDate);
  const endInclusive = new Date(end);
  endInclusive.setDate(endInclusive.getDate() - 1);

  if (period === "day") return formatDate(toISODate(start));

  if (period === "week") {
    return `${formatDate(toISODate(start))} — ${formatDate(toISODate(endInclusive))}`;
  }

  if (period === "month") {
    return `${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
  }

  const quarterNumber = getQuarter(start) + 1;
  return `${quarterNumber} квартал ${start.getFullYear()}`;
}

function isDateInsidePeriod(dateStr, period, selectedDate) {
  const { startDate, endDate } = getPeriodRange(period, selectedDate);
  return dateStr >= startDate && dateStr < endDate;
}

function getProjectName(projects, projectId) {
  return projects.find(p => p.id === projectId)?.name || "Без проєкту";
}

function getProjectStyle(projects, projectId) {
  return projects.find(p => p.id === projectId) || {
    color: "#6b7394",
    bg: "rgba(107,115,148,0.12)",
    border: "rgba(107,115,148,0.25)",
  };
}

function sortBlocks(blocks) {
  return [...blocks].sort((a, b) => (a.start || "").localeCompare(b.start || ""));
}

export default function Worklog({ entries, projects, onAdd, onEdit, onDelete, viewOnly }) {
  const [showAdd, setShowAdd] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState("week");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState(EMPTY_FORM);
  const [newProject, setNewProject] = useState("");

  function openAdd() {
    setForm({
      ...EMPTY_FORM,
      date: selectedDate,
      projectId: filter === "all" ? "" : filter,
      timeBlocks: [{ ...EMPTY_BLOCK }],
    });
    setEditEntry(null);
    setShowAdd(true);
  }

  function openEdit(entry) {
    const blocks = getEntryBlocks(entry);
    setEditEntry(entry);
    setForm({
      date: entry.date,
      task: entry.task,
      projectId: entry.projectId || "",
      timeBlocks: blocks.length > 0 ? blocks.map(block => ({ ...block })) : [{ ...EMPTY_BLOCK }],
    });
  }

  function closeEntryModal() {
    setShowAdd(false);
    setEditEntry(null);
    setForm(EMPTY_FORM);
  }

  function updateBlock(index, field, value) {
    setForm(current => ({
      ...current,
      timeBlocks: current.timeBlocks.map((block, i) => (
        i === index ? { ...block, [field]: value } : block
      )),
    }));
  }

  function addTimeBlock() {
    setForm(current => ({
      ...current,
      timeBlocks: [...current.timeBlocks, { ...EMPTY_BLOCK }],
    }));
  }

  function removeTimeBlock(index) {
    setForm(current => ({
      ...current,
      timeBlocks: current.timeBlocks.length === 1
        ? current.timeBlocks
        : current.timeBlocks.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    const cleanBlocks = form.timeBlocks
      .filter(block => block.start && block.end && calcDuration(block.start, block.end) > 0)
      .map(block => ({ start: block.start, end: block.end }));

    if (!form.task.trim() || cleanBlocks.length === 0) return;

    const sortedTimeBlocks = sortBlocks(cleanBlocks);
    const payload = {
      ...form,
      task: form.task.trim(),
      timeBlocks: sortedTimeBlocks,
      start: sortedTimeBlocks[0]?.start || "",
      end: sortedTimeBlocks[sortedTimeBlocks.length - 1]?.end || "",
    };

    if (editEntry) {
      onEdit({ ...editEntry, ...payload });
    } else {
      onAdd({ id: Date.now().toString(), ...payload });
    }

    closeEntryModal();
  }

  function handleAddProject() {
    if (!newProject.trim()) return;

    const colorIdx = projects.length % PROJECT_COLORS.length;

    onAdd({
      __project: true,
      id: Date.now().toString(),
      name: newProject.trim(),
      ...PROJECT_COLORS[colorIdx],
    });

    setNewProject("");
  }

  const periodEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesPeriod = isDateInsidePeriod(entry.date, period, selectedDate);
      const matchesProject = filter === "all" || entry.projectId === filter;
      return matchesPeriod && matchesProject;
    });
  }, [entries, filter, period, selectedDate]);

  const groupedByDate = useMemo(() => {
    return periodEntries.reduce((acc, entry) => {
      if (!acc[entry.date]) acc[entry.date] = [];
      acc[entry.date].push(entry);
      return acc;
    }, {});
  }, [periodEntries]);

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  const reportRows = useMemo(() => {
    const totals = {};

    periodEntries.forEach(entry => {
      const key = entry.projectId || "none";
      totals[key] = (totals[key] || 0) + calcEntryHours(entry);
    });

    const totalHours = Object.values(totals).reduce((sum, hours) => sum + hours, 0);

    return Object.entries(totals)
      .map(([projectId, hours]) => ({
        projectId,
        name: getProjectName(projects, projectId === "none" ? "" : projectId),
        hours,
        percent: totalHours > 0 ? (hours / totalHours) * 100 : 0,
        style: getProjectStyle(projects, projectId === "none" ? "" : projectId),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [periodEntries, projects]);

  const periodTotal = reportRows.reduce((sum, row) => sum + row.hours, 0);
  const formTotal = form.timeBlocks.reduce((sum, block) => sum + calcDuration(block.start, block.end), 0);
  const isModalOpen = showAdd || editEntry !== null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Unbounded',sans-serif", fontSize: 18 }}>⏱ Ворклог</h2>
          <div style={{ color: "#6b7394", fontSize: 12, marginTop: 4 }}>
            Облік часу по задачах і проєктах
          </div>
        </div>

        {!viewOnly && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowProjects(true)} style={secondaryButton}>
              Проєкти
            </button>
            <button onClick={openAdd} style={primaryButton}>
              + Додати
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "#1c2030", border: "1px solid #252a3a", borderRadius: 18, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={LBL}>Період</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[
                { id: "day", label: "День" },
                { id: "week", label: "Тиждень" },
                { id: "month", label: "Місяць" },
                { id: "quarter", label: "Квартал" },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setPeriod(item.id)}
                  style={{
                    ...pillButton,
                    borderColor: period === item.id ? "#6c8eff" : "#252a3a",
                    background: period === item.id ? "rgba(108,142,255,0.13)" : "transparent",
                    color: period === item.id ? "#6c8eff" : "#6b7394",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={LBL}>Дата для звіту</div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={DI}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ color: "#e8eaf2", fontWeight: 700, fontSize: 15 }}>
              {getPeriodLabel(period, selectedDate)}
            </div>
            <div style={{ color: "#6b7394", fontSize: 12, marginTop: 3 }}>
              Звіт попроєктно
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#5fffd6", fontFamily: "'Unbounded',sans-serif", fontSize: 20 }}>
              {roundHours(periodTotal)}г
            </div>
            <div style={{ color: "#6b7394", fontSize: 11 }}>усього</div>
          </div>
        </div>
      </div>

      {projects.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setFilter("all")}
            style={{
              ...pillButton,
              borderColor: filter === "all" ? "#6c8eff" : "#252a3a",
              background: filter === "all" ? "rgba(108,142,255,0.13)" : "transparent",
              color: filter === "all" ? "#6c8eff" : "#6b7394",
            }}
          >
            Всі
          </button>

          {projects.map(project => (
            <button
              key={project.id}
              onClick={() => setFilter(filter === project.id ? "all" : project.id)}
              style={{
                ...pillButton,
                borderColor: filter === project.id ? project.color : "#252a3a",
                background: filter === project.id ? project.bg : "transparent",
                color: filter === project.id ? project.color : "#6b7394",
              }}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ background: "#1c2030", border: "1px solid #252a3a", borderRadius: 18, padding: 14, marginBottom: 18 }}>
        <div style={{ ...LBL, marginBottom: 12 }}>Відсоток часу по проєктах</div>

        {reportRows.length === 0 && (
          <div style={{ color: "#3a3f52", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
            За цей період ще немає записів
          </div>
        )}

        {reportRows.map(row => (
          <div key={row.projectId} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
              <div style={{ color: row.style.color, fontWeight: 700, fontSize: 13 }}>
                {row.name}
              </div>
              <div style={{ color: "#e8eaf2", fontWeight: 700, fontSize: 13 }}>
                {roundHours(row.hours)}г · {Math.round(row.percent)}%
              </div>
            </div>

            <div style={{ height: 8, background: "#161920", borderRadius: 99, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(row.percent)}%`,
                  background: row.style.color,
                  borderRadius: 99,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {sortedDates.length === 0 && (
        <div style={{ color: "#3a3f52", fontSize: 14, textAlign: "center", padding: "30px 0" }}>
          {viewOnly ? "Записів ще немає" : "Додай перший запис у ворклог"}
        </div>
      )}

      {sortedDates.map(date => {
        const dayEntries = groupedByDate[date];
        const dayTotal = dayEntries.reduce((sum, entry) => sum + calcEntryHours(entry), 0);

        return (
          <div key={date} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ color: "#e8eaf2", fontWeight: 700, fontSize: 14 }}>
                {formatDate(date)}
              </div>
              <div style={{ color: "#5fffd6", fontWeight: 700, fontSize: 13 }}>
                {roundHours(dayTotal)}г
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayEntries
                .sort((a, b) => {
                  const aStart = getEntryBlocks(a)[0]?.start || "";
                  const bStart = getEntryBlocks(b)[0]?.start || "";
                  return aStart.localeCompare(bStart);
                })
                .map(entry => {
                  const project = projects.find(p => p.id === entry.projectId);
                  const style = getProjectStyle(projects, entry.projectId);
                  const blocks = sortBlocks(getEntryBlocks(entry));
                  const duration = calcEntryHours(entry);

                  return (
                    <div
                      key={entry.id}
                      onClick={() => !viewOnly && openEdit(entry)}
                      style={{
                        background: "#1c2030",
                        border: `1px solid ${project ? project.border : "#252a3a"}`,
                        borderRadius: 14,
                        padding: 14,
                        cursor: viewOnly ? "default" : "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: style.color, display: "inline-block" }} />
                            <span style={{ color: style.color, fontSize: 12, fontWeight: 700 }}>
                              {project?.name || "Без проєкту"}
                            </span>
                          </div>

                          <div style={{ color: "#e8eaf2", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
                            {entry.task}
                          </div>

                          <div style={{ color: "#6b7394", fontSize: 12, lineHeight: 1.6 }}>
                            {blocks.map((block, index) => (
                              <span key={`${block.start}-${block.end}-${index}`}>
                                {block.start}–{block.end}
                                {index < blocks.length - 1 ? " · " : ""}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ color: "#5fffd6", fontWeight: 800, fontSize: 14 }}>
                            {roundHours(duration)}г
                          </div>

                          {!viewOnly && (
                            <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 8 }}>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  openEdit(entry);
                                }}
                                style={iconButton}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  onDelete(entry.id);
                                }}
                                style={iconButton}
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        );
      })}

      {isModalOpen && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) closeEntryModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(13,15,20,0.9)",
            backdropFilter: "blur(8px)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              background: "#1c2030",
              borderRadius: "24px 24px 0 0",
              border: "1px solid #252a3a",
              padding: "24px 20px 40px",
              width: "100%",
              maxHeight: "86vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 14, fontWeight: 600 }}>
                {editEntry ? "Редагувати задачу" : "Нова задача"}
              </div>
              <button onClick={closeEntryModal} style={closeButton}>×</button>
            </div>

            <div style={LBL}>Дата</div>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(current => ({ ...current, date: e.target.value }))}
              style={{ ...DI, marginBottom: 16 }}
            />

            {projects.length > 0 && (
              <>
                <div style={LBL}>Проєкт</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => setForm(current => ({ ...current, projectId: "" }))}
                    style={{
                      ...pillButton,
                      borderColor: !form.projectId ? "#6b7394" : "#252a3a",
                      background: !form.projectId ? "rgba(107,115,148,0.2)" : "transparent",
                      color: !form.projectId ? "#e8eaf2" : "#6b7394",
                    }}
                  >
                    Без проєкту
                  </button>

                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => setForm(current => ({ ...current, projectId: project.id }))}
                      style={{
                        ...pillButton,
                        borderColor: form.projectId === project.id ? project.color : "#252a3a",
                        background: form.projectId === project.id ? project.bg : "transparent",
                        color: form.projectId === project.id ? project.color : "#6b7394",
                      }}
                    >
                      {project.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div style={LBL}>Задача</div>
            <textarea
              value={form.task}
              onChange={e => setForm(current => ({ ...current, task: e.target.value }))}
              placeholder="Що зробила? Напр.: зустріч з командою, підготовка звіту..."
              style={textareaStyle}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ ...LBL, marginBottom: 0 }}>Часові блоки за день</div>
              <button onClick={addTimeBlock} style={secondaryButton}>
                + блок
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              {form.timeBlocks.map((block, index) => (
                <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 8, alignItems: "center" }}>
                  <input
                    type="time"
                    value={block.start}
                    onChange={e => updateBlock(index, "start", e.target.value)}
                    style={TI}
                  />
                  <span style={{ color: "#6b7394" }}>—</span>
                  <input
                    type="time"
                    value={block.end}
                    onChange={e => updateBlock(index, "end", e.target.value)}
                    style={TI}
                  />
                  <button
                    onClick={() => removeTimeBlock(index)}
                    disabled={form.timeBlocks.length === 1}
                    style={{
                      ...iconButton,
                      opacity: form.timeBlocks.length === 1 ? 0.3 : 1,
                      cursor: form.timeBlocks.length === 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ color: "#5fffd6", fontWeight: 800, marginBottom: 18, fontSize: 14 }}>
              Разом по задачі за день: {roundHours(formTotal)} год
            </div>

            <button
              onClick={handleSave}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 14,
                border: "none",
                background: form.task.trim() && formTotal > 0 ? "#6c8eff" : "#252a3a",
                color: "#fff",
                fontFamily: "'Unbounded',sans-serif",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {editEntry ? "Зберегти зміни" : "Додати запис"}
            </button>
          </div>
        </div>
      )}

      {showProjects && (
        <div
          onClick={e => {
            if (e.target === e.currentTarget) setShowProjects(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(13,15,20,0.9)",
            backdropFilter: "blur(8px)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              background: "#1c2030",
              borderRadius: "24px 24px 0 0",
              border: "1px solid #252a3a",
              padding: "24px 20px 40px",
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontFamily: "'Unbounded',sans-serif", fontSize: 14, fontWeight: 600 }}>
                Проєкти
              </div>
              <button onClick={() => setShowProjects(false)} style={closeButton}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {projects.length === 0 && (
                <div style={{ color: "#3a3f52", fontSize: 13, textAlign: "center", padding: "16px 0" }}>
                  Проєктів ще немає
                </div>
              )}

              {projects.map(project => (
                <div
                  key={project.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#161920",
                    border: `1px solid ${project.border}`,
                    borderRadius: 12,
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: project.color }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: project.color }}>{project.name}</span>
                  </div>
                  <button onClick={() => onDelete("__project__" + project.id)} style={iconButton}>×</button>
                </div>
              ))}
            </div>

            <div style={LBL}>Новий проєкт</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newProject}
                onChange={e => setNewProject(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddProject()}
                placeholder="Назва проєкту..."
                style={{ ...DI, flex: 1 }}
              />
              <button onClick={handleAddProject} style={primaryButton}>+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const LBL = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: ".8px",
  color: "#6b7394",
  marginBottom: 10,
};

const TI = {
  background: "#161920",
  border: "1px solid #252a3a",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#e8eaf2",
  fontFamily: "'Manrope',sans-serif",
  fontSize: 15,
  outline: "none",
  width: "100%",
};

const DI = {
  background: "#161920",
  border: "1px solid #252a3a",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#e8eaf2",
  fontFamily: "'Manrope',sans-serif",
  fontSize: 14,
  outline: "none",
  width: "100%",
};

const primaryButton = {
  padding: "8px 13px",
  borderRadius: 99,
  border: "none",
  background: "#6c8eff",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButton = {
  padding: "8px 12px",
  borderRadius: 99,
  border: "1px solid #252a3a",
  background: "#1c2030",
  color: "#6b7394",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const pillButton = {
  padding: "7px 12px",
  borderRadius: 99,
  border: "1px solid #252a3a",
  background: "transparent",
  color: "#6b7394",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const iconButton = {
  background: "transparent",
  border: "none",
  color: "#6b7394",
  fontSize: 16,
  cursor: "pointer",
  padding: "2px 5px",
};

const closeButton = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "1px solid #252a3a",
  background: "transparent",
  color: "#6b7394",
  fontSize: 20,
  cursor: "pointer",
};

const textareaStyle = {
  background: "#161920",
  border: "1px solid #252a3a",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#e8eaf2",
  fontFamily: "'Manrope',sans-serif",
  fontSize: 14,
  outline: "none",
  width: "100%",
  resize: "vertical",
  minHeight: 80,
  marginBottom: 16,
};

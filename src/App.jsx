import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const METHODS = [
  { value: "버리기", emoji: "🗑", color: "#6B7280" },
  { value: "나눔·중고", emoji: "🤝", color: "#10B981" },
  { value: "책 정리", emoji: "📚", color: "#F59E0B" },
];

function getToday() { return new Date().toISOString().slice(0, 10); }

function calcStreak(items) {
  if (!items.length) return 0;
  const days = [...new Set(items.map((i) => i.date))].sort((a, b) => b.localeCompare(a));
  const today = getToday();
  let streak = 0, cursor = today;
  for (const day of days) {
    if (day === cursor) {
      streak++;
      const d = new Date(cursor); d.setDate(d.getDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    } else if (day < cursor) break;
  }
  return streak;
}

function compressImage(file) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else { w = Math.round(w * MAX / h); h = MAX; }
      canvas.width = w; canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.7);
    };
    img.src = url;
  });
}

function buildCalendar(yearMonth) {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const weeks = [];
  let week = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}

function PhotoViewer({ src, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", fontSize: 20, cursor: "pointer" }}>×</button>
      <img src={src} alt="" style={{ maxWidth: "95vw", maxHeight: "85vh", borderRadius: 14, objectFit: "contain" }} />
    </div>
  );
}

function ItemCard({ item, onDelete }) {
  const [viewPhoto, setViewPhoto] = useState(null);
  const m = METHODS.find((x) => x.value === item.method) || METHODS[0];
  return (
    <>
      {viewPhoto && <PhotoViewer src={viewPhoto} onClose={() => setViewPhoto(null)} />}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid #1A1A1E" }}>
        {item.photo_url ? (
          <img onClick={() => setViewPhoto(item.photo_url)} src={item.photo_url} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 10, border: "1px solid #2A2A30", flexShrink: 0, cursor: "pointer" }} />
        ) : (
          <div style={{ width: 48, height: 48, borderRadius: 10, background: "#141416", border: "1px solid #1E1E22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{m.emoji}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: "#E8E6E0" }}>{item.name}</span>
            {item.is_book && item.book_read !== null && (
              <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 8, background: item.book_read ? "#1F1A0A" : "#1A1A1A", color: item.book_read ? "#F59E0B" : "#6B6B70", fontFamily: "sans-serif" }}>
                {item.book_read ? "읽었음" : "안 읽었음"}
              </span>
            )}
          </div>
          {item.memo && <p style={{ fontSize: 12, color: "#7A7870", lineHeight: 1.5, fontStyle: "italic", margin: "3px 0 0" }}>"{item.memo}"</p>}
          <div style={{ fontSize: 11, color: "#3A3A40", marginTop: 4, fontFamily: "sans-serif" }}>
            <span style={{ color: m.color }}>{m.value}</span> · {new Date(item.date + "T00:00:00").toLocaleDateString("ko-KR")}
          </div>
        </div>
        {onDelete && (
          <button onClick={() => onDelete(item.id)} style={{ background: "transparent", border: "none", color: "#3A3A40", cursor: "pointer", padding: 4, fontSize: 18, flexShrink: 0 }}>×</button>
        )}
      </div>
    </>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [name, setName] = useState("");
  const [method, setMethod] = useState("버리기");
  const [memo, setMemo] = useState("");
  const [isBook, setIsBook] = useState(false);
  const [bookRead, setBookRead] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calMonthKey, setCalMonthKey] = useState(getToday().slice(0, 7));
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("items").select("*").order("created_at", { ascending: false });
    if (!error) setItems(data || []);
    setLoading(false);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const blob = await compressImage(file);
    setPhoto(blob);
    setPhotoPreview(URL.createObjectURL(blob));
  };

  const addItem = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    let photo_url = null;

    if (photo) {
      const fileName = `${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("photos").upload(fileName, photo, { contentType: "image/jpeg" });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("photos").getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }

    const newItem = {
      name: name.trim(),
      method: isBook ? "책 정리" : method,
      memo: memo.trim(),
      is_book: isBook,
      book_read: isBook ? bookRead : null,
      photo_url,
      date: getToday(),
    };

    const { data, error } = await supabase.from("items").insert([newItem]).select();
    if (!error && data) setItems([data[0], ...items]);
    setName(""); setMemo(""); setPhoto(null); setPhotoPreview(null);
    setBookRead(false); setIsBook(false); setMethod("버리기");
    setShowForm(false); setSaving(false);
  };

const deleteItem = async (id) => {
  const item = items.find((i) => i.id === id);

  if (item?.photo_url) {
    const fileName = item.photo_url.split("/").pop();

    await supabase.storage
      .from("photos")
      .remove([fileName]);
  }

  await supabase.from("items").delete().eq("id", id);

  setItems(items.filter((i) => i.id !== id));

  if (
    selectedDate &&
    !items.filter((i) => i.id !== id && i.date === selectedDate).length
  ) {
    setSelectedDate(null);
  }
};
  const todayKey = getToday();
  const todayDone = items.some((i) => i.date === todayKey);
  const streak = calcStreak(items);
  const bookCount = items.filter((i) => i.method === "책 정리").length;
  const thisMonthItems = items.filter((i) => i.date.slice(0, 7) === todayKey.slice(0, 7));
  const itemsByDate = {};
  items.forEach((item) => {
    if (!itemsByDate[item.date]) itemsByDate[item.date] = [];
    itemsByDate[item.date].push(item);
  });

  const [cy, cm] = calMonthKey.split("-").map(Number);
  const weeks = buildCalendar(calMonthKey);

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0F", color: "#E8E6E0", fontFamily: "'Georgia', serif", maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>

      {/* 헤더 */}
      <div style={{ padding: "52px 20px 16px", borderBottom: "1px solid #1E1E22" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 400, letterSpacing: "-0.5px", color: "#E8E6E0", margin: 0 }}>비움 정거장</h1>
            <p style={{ fontSize: 13, color: "#6B6B70", marginTop: 4, fontFamily: "sans-serif" }}>오늘도 하나, 가볍게</p>
          </div>
          {todayDone && <div style={{ background: "#1A2A1A", border: "1px solid #2A4A2A", borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#4ADE80", fontFamily: "sans-serif" }}>✓ 오늘 완료</div>}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {[{ num: `🔥 ${streak}일`, label: "연속 달성" }, { num: items.length, label: "누적 비움" }, { num: `📚 ${bookCount}`, label: "책 정리" }].map(({ num, label }) => (
            <div key={label} style={{ flex: 1, background: "#141416", border: "1px solid #1E1E22", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 500, color: "#E8E6E0" }}>{num}</div>
              <div style={{ fontSize: 10, color: "#6B6B70", marginTop: 2, fontFamily: "sans-serif" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: "1px solid #1E1E22" }}>
        {[{ key: "home", label: "홈" }, { key: "calendar", label: "달력" }].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: "14px 0", background: "transparent", border: "none", borderBottom: `2px solid ${tab === key ? "#818CF8" : "transparent"}`, color: tab === key ? "#818CF8" : "#6B6B70", fontSize: 14, cursor: "pointer", fontFamily: "sans-serif", fontWeight: tab === key ? 500 : 400 }}>{label}</button>
        ))}
      </div>

      {/* 홈 탭 */}
      {tab === "home" && (
        <div style={{ padding: "20px 20px 0" }}>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} style={{ width: "100%", padding: "16px", background: todayDone ? "#141416" : "#1A1A2E", border: `1px solid ${todayDone ? "#2A2A30" : "#2A2A5A"}`, borderRadius: 16, color: todayDone ? "#6B6B70" : "#818CF8", fontSize: 15, cursor: "pointer", fontFamily: "sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>+</span>
              {todayDone ? "오늘 하나 더 비우기" : "오늘 비운 것 기록하기"}
            </button>
          ) : (
            <div style={{ background: "#141416", border: "1px solid #2A2A30", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[false, true].map((v) => (
                  <button key={String(v)} onClick={() => { setIsBook(v); setMethod(v ? "책 정리" : "버리기"); }} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, border: `1px solid ${isBook === v ? "#818CF8" : "#2A2A30"}`, background: isBook === v ? "#1A1A2E" : "transparent", color: isBook === v ? "#818CF8" : "#6B6B70", cursor: "pointer", fontFamily: "sans-serif" }}>{v ? "📚 책" : "📦 물건"}</button>
                ))}
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} placeholder={isBook ? "책 제목을 적어주세요" : "오늘 비운 것을 적어주세요"} style={{ width: "100%", padding: "11px 14px", background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 10, color: "#E8E6E0", fontSize: 15, marginBottom: 12, fontFamily: "sans-serif", boxSizing: "border-box" }} />
              {isBook && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[true, false].map((v) => (
                    <button key={String(v)} onClick={() => setBookRead(v)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 13, border: `1px solid ${bookRead === v ? "#F59E0B" : "#2A2A30"}`, background: bookRead === v ? "#1F1A0A" : "transparent", color: bookRead === v ? "#F59E0B" : "#6B6B70", cursor: "pointer", fontFamily: "sans-serif" }}>{v ? "✓ 읽었음" : "✗ 안 읽었음"}</button>
                  ))}
                </div>
              )}
              {!isBook && (
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {METHODS.filter((m) => m.value !== "책 정리").map((m) => (
                    <button key={m.value} onClick={() => setMethod(m.value)} style={{ flex: 1, padding: "8px 0", borderRadius: 10, fontSize: 12, border: `1px solid ${method === m.value ? m.color : "#2A2A30"}`, background: method === m.value ? "#1A1A1A" : "transparent", color: method === m.value ? m.color : "#6B6B70", cursor: "pointer", fontFamily: "sans-serif" }}>{m.emoji} {m.value}</button>
                  ))}
                </div>
              )}
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="한 줄 마음을 남겨보세요 (선택)" rows={2} style={{ width: "100%", padding: "11px 14px", background: "#0D0D0F", border: "1px solid #2A2A30", borderRadius: 10, color: "#A8A4A0", fontSize: 13, marginBottom: 12, fontFamily: "'Georgia', serif", resize: "none", boxSizing: "border-box", lineHeight: 1.6 }} />
              <div style={{ marginBottom: 16 }}>
                <input type="file" accept="image/*" capture="environment" ref={fileRef} onChange={handlePhoto} style={{ display: "none" }} />
                {photoPreview ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img src={photoPreview} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "1px solid #2A2A30" }} />
                    <button onClick={() => { setPhoto(null); setPhotoPreview(null); }} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#E24B4A", border: "none", color: "#fff", fontSize: 11, cursor: "pointer" }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current.click()} style={{ padding: "8px 16px", background: "transparent", border: "1px dashed #2A2A30", borderRadius: 10, color: "#6B6B70", fontSize: 13, cursor: "pointer", fontFamily: "sans-serif" }}>📷 사진 첨부</button>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid #2A2A30", borderRadius: 12, color: "#6B6B70", fontSize: 14, cursor: "pointer", fontFamily: "sans-serif" }}>취소</button>
                <button onClick={addItem} disabled={saving} style={{ flex: 2, padding: "12px", background: saving ? "#4A4A8A" : "#818CF8", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: "sans-serif" }}>{saving ? "저장 중..." : "비우기 완료"}</button>
              </div>
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, color: "#818CF8", fontFamily: "sans-serif", marginBottom: 8, fontWeight: 500 }}>이번 달 · {thisMonthItems.length}개</div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#3A3A40", fontSize: 13, fontFamily: "sans-serif" }}>불러오는 중...</div>
            ) : thisMonthItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#3A3A40", fontSize: 13, fontFamily: "sans-serif" }}>아직 이번 달 기록이 없어요</div>
            ) : thisMonthItems.map((item) => <ItemCard key={item.id} item={item} onDelete={deleteItem} />)}
          </div>
        </div>
      )}

      {/* 달력 탭 */}
      {tab === "calendar" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <button onClick={() => { const d = new Date(cy, cm - 2, 1); setCalMonthKey(d.toISOString().slice(0, 7)); }} style={{ background: "#141416", border: "1px solid #2A2A30", borderRadius: 10, width: 36, height: 36, color: "#A8A4A0", fontSize: 16, cursor: "pointer" }}>‹</button>
            <span style={{ fontSize: 15, color: "#E8E6E0", fontFamily: "sans-serif", fontWeight: 500 }}>{cy}년 {cm}월</span>
            <button onClick={() => { const d = new Date(cy, cm, 1); setCalMonthKey(d.toISOString().slice(0, 7)); }} style={{ background: "#141416", border: "1px solid #2A2A30", borderRadius: 10, width: 36, height: 36, color: "#A8A4A0", fontSize: 16, cursor: "pointer" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
            {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, color: i === 0 ? "#E24B4A" : i === 6 ? "#818CF8" : "#3A3A40", fontFamily: "sans-serif", paddingBottom: 6 }}>{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} />;
                const dateStr = `${calMonthKey}-${String(day).padStart(2, "0")}`;
                const isToday = dateStr === todayKey;
                const hasDone = (itemsByDate[dateStr]?.length || 0) > 0;
                const count = itemsByDate[dateStr]?.length || 0;
                return (
                  <button key={di} onClick={() => hasDone && setSelectedDate(dateStr)} style={{ aspectRatio: "1", borderRadius: 10, background: isToday ? "#1A1A2E" : hasDone ? "#141416" : "transparent", border: isToday ? "1px solid #818CF8" : hasDone ? "1px solid #2A2A30" : "1px solid transparent", color: isToday ? "#818CF8" : di === 0 ? "#E24B4A" : di === 6 ? "#818CF8" : hasDone ? "#E8E6E0" : "#3A3A40", fontSize: 13, cursor: hasDone ? "pointer" : "default", fontFamily: "sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: 0 }}>
                    <span>{day}</span>
                    {hasDone && <span style={{ fontSize: 14, lineHeight: 1 }}>✓</span>}
                    {count > 1 && <span style={{ fontSize: 8, color: "#818CF8", lineHeight: 1 }}>{count}개</span>}
                  </button>
                );
              })}
            </div>
          ))}
          <div style={{ marginTop: 20, padding: "14px 16px", background: "#141416", border: "1px solid #1E1E22", borderRadius: 14 }}>
            <div style={{ fontSize: 12, color: "#6B6B70", fontFamily: "sans-serif", marginBottom: 8 }}>{cy}년 {cm}월 요약</div>
            <div style={{ display: "flex", gap: 16 }}>
              {(() => {
                const monthItems = items.filter((i) => i.date.slice(0, 7) === calMonthKey);
                const days = new Set(monthItems.map((i) => i.date)).size;
                const books = monthItems.filter((i) => i.method === "책 정리").length;
                return [{ num: monthItems.length, label: "총 비움" }, { num: `${days}일`, label: "실천일" }, { num: books, label: "책 정리" }].map(({ num, label }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 500, color: "#E8E6E0" }}>{num}</div>
                    <div style={{ fontSize: 10, color: "#6B6B70", fontFamily: "sans-serif" }}>{label}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 날짜 팝업 */}
      {selectedDate && (
        <div onClick={() => setSelectedDate(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#141416", borderRadius: "20px 20px 0 0", border: "1px solid #2A2A30", padding: "20px 20px 48px", width: "100%", maxWidth: 480, maxHeight: "70vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: "#A8A4A0", fontFamily: "sans-serif" }}>
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
              </span>
              <button onClick={() => setSelectedDate(null)} style={{ background: "transparent", border: "none", color: "#6B6B70", fontSize: 22, cursor: "pointer" }}>×</button>
            </div>
            {(itemsByDate[selectedDate] || []).map((item) => <ItemCard key={item.id} item={item} onDelete={deleteItem} />)}
          </div>
        </div>
      )}
    </div>
  );
}

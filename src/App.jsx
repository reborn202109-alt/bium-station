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

function ItemCard({ item, onDelete, onEdit }) {
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
          <div style={{ fontSize: 11,

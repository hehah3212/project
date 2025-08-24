// src/app/books/BookDetailPage.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../utils/firebase";

// (선택) 진행률 시각화 막대
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

type PublicReview = {
  id: string;
  uid: string;
  nickname?: string;
  rating: number;
  text: string;
  createdAt?: any;
  updatedAt?: any;
};

type PrivateMemo = {
  id: string;
  uid: string;
  text: string;
  pagesAt: number;
  createdAt?: any;
};

export default function BookDetailPage() {
  const { id } = useParams();
  const cleanId = decodeURIComponent(String(id)).split(" ")[0];

  const [uid, setUid] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | undefined>(undefined);

  const [book, setBook] = useState<any>(null);
  const [readPages, setReadPages] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(320);

  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState("");

  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const myReview = useMemo(() => reviews.find(r => r.uid === uid), [reviews, uid]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);

  const [memos, setMemos] = useState<PrivateMemo[]>([]);
  const [memoText, setMemoText] = useState("");

  // ── Auth
  useEffect(() => {
    return onAuthStateChanged(getAuth(), async (u) => {
      setUid(u?.uid ?? null);
      if (u) {
        const prof = await getDoc(doc(db, "users", u.uid));
        if (prof.exists()) setNickname((prof.data() as any)?.nickname);
      } else {
        setNickname(undefined);
      }
    });
  }, []);

  // ── 로컬 캐시에서 표지/제목
  useEffect(() => {
    const key = uid ? `book-list:${uid}` : "book-list";
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list = JSON.parse(raw);
      const found = list.find((b: any) => b.isbn === cleanId);
      if (found) setBook(found);
    } catch {}
  }, [uid, cleanId]);

  // ── 내 책 진행/별점 로드
  useEffect(() => {
    if (!uid || !cleanId) return;
    (async () => {
      const ref = doc(db, "users", uid, "books", cleanId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data() as any;
        setReadPages(Number(d.readPages || 0));
        setTotalPages(Number(d.totalPages || 320));
        setRating(Number(d.rating || 0));
        setBook((prev: any) => prev || d);
      }
    })();
  }, [uid, cleanId]);

  // ── 공개 감상평 구독 + 평균/개수
  useEffect(() => {
    if (!cleanId) return;
    const qy = query(collection(db, "books", cleanId, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      const rows: PublicReview[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      setReviews(rows);
      const vals = rows.map(r => r.rating).filter(n => typeof n === "number" && n > 0);
      setReviewCount(vals.length);
      setAvgRating(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
    });
    return () => unsub();
  }, [cleanId]);

  // ── 내 감상평 프리필
  useEffect(() => {
    if (!uid || !cleanId) return;
    (async () => {
      const me = await getDoc(doc(db, "books", cleanId, "reviews", uid));
      if (me.exists()) {
        const d = me.data() as any;
        setReviewText(d.text || "");
        if (typeof d.rating === "number") setRating(d.rating);
      }
    })();
  }, [uid, cleanId]);

  // ── 개인 메모 구독
  useEffect(() => {
    if (!uid || !cleanId) { setMemos([]); return; }
    const q = query(
      collection(db, "users", uid, "books", cleanId, "memos"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setMemos(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, [uid, cleanId]);

  // ── 별점 UI
  const Star = ({ filled }: { filled: boolean }) => (
    <svg viewBox="0 0 20 20" className={`w-6 h-6 ${filled ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.1 3.385a1 1 0 00.95.69h3.556c.969 0 1.371 1.24.588 1.81l-2.876 2.09a1 1 0 00-.364 1.118l1.1 3.386c.3.92-.755 1.688-1.54 1.118l-2.876-2.09a1 1 0 00-1.176 0l-2.876 2.09c-.785.57-1.84-.198-1.54-1.118l1.1-3.386a1 1 0 00-.364-1.118L2.755 8.812c-.783-.57-.38-1.81.588-1.81h3.556a1 1 0 00.95-.69l1.2-3.385z"/>
    </svg>
  );

  const renderStars = () => {
    const active = hoverRating || rating;
    return (
      <div className="flex items-center gap-1" role="radiogroup" aria-label="별점 선택">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            role="radio"
            aria-checked={rating === n}
            className="focus:outline-none"
            title={`${n}점`}
          >
            <Star filled={n <= active} />
          </button>
        ))}
        <span className="ml-1 text-sm text-gray-500">{rating}/5</span>
      </div>
    );
  };

  // ── 공개 감상평 저장/삭제
  const savePublicReview = async () => {
    if (!uid) return alert("로그인 후 이용해주세요.");
    const text = reviewText.trim();
    if (!text) return alert("감상평을 입력해주세요.");

    await setDoc(
      doc(db, "books", cleanId, "reviews", uid),
      { uid, nickname: nickname || null, rating, text, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true }
    );

    // 내 책 문서에도 별점 동기화(선택)
    await setDoc(doc(db, "users", uid, "books", cleanId), {
      rating, updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const deletePublicReview = async () => {
    if (!uid) return;
    if (!confirm("내 감상평을 삭제할까요?")) return;
    await deleteDoc(doc(db, "books", cleanId, "reviews", uid));
    setReviewText("");
  };

  // ── 진행 저장 (+ 미션 delta 이벤트 발행 & 누적 보관)
  const handleSaveProgress = async () => {
    if (!uid) return;

    const ref = doc(db, "users", uid, "books", cleanId);

    // 1) 이전 readPages 로드 → delta 계산 (다중탭/지연 동기화 안전)
    let prev = 0;
    try {
      const snap = await getDoc(ref);
      prev = snap.exists() ? (snap.data() as any).readPages || 0 : 0;
    } catch { prev = 0; }

    const safeTotal = Math.max(0, Number(totalPages || 0));
    const next = Math.min(Math.max(Number(readPages || 0), 0), safeTotal);
    const delta = next - prev;

    // 2) 저장 (총 페이지 포함, 직렬화된 타임스탬프)
    await setDoc(ref, {
      readPages: next,
      totalPages: safeTotal,
      rating,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 3) 증가분이 있을 때만 미션 이벤트 발행 + 페일세이프 누적
    if (delta > 0) {
      // 즉시 반영
      window.dispatchEvent(new CustomEvent("reading-progress", { detail: delta }));
      // 미마운트/오프라인 대비 누적 저장
      const cur = Number(localStorage.getItem("pending-delta") || "0");
      localStorage.setItem("pending-delta", String(cur + delta));
      // (선택) 리스트 강제 싱크 트리거
      window.dispatchEvent(new Event("reading-progress-sync"));
    }

    alert("저장되었습니다!");
  };

  // ── 진행 바 데이터
  const safeRead = Math.min(readPages, totalPages);
  const barData = {
    labels: [""],
    datasets: [
      { label: "읽은 페이지", data: [safeRead], backgroundColor: "#3b82f6", borderRadius: 12, barThickness: 26 },
      { label: "남은 페이지", data: [Math.max(totalPages - safeRead, 0)], backgroundColor: "#e5e7eb", borderRadius: 12, barThickness: 26 },
    ],
  };
  const barOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { x: { stacked: true, max: totalPages, beginAtZero: true, display: false }, y: { stacked: true, display: false } },
  };

  const formatDate = (ts?: any) => {
    const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if (!d) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  };

  if (!book) return <div className="p-4 text-gray-500">로딩 중...</div>;

  const roundedAvg = avgRating !== null ? Math.round(avgRating) : null;

  return (
    <div className="max-w-7xl mx-auto p-12 bg-white shadow-xl rounded-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        {/* 좌측 본문 */}
        <div className="lg:col-span-2 space-y-12">
          {/* 책 정보 */}
          <div className="flex gap-8 items-start">
            <div className="w-44 h-64 bg-gray-100 rounded-xl overflow-hidden shadow-sm">
              <Image src={book.thumbnail || "/noimage.png"} alt={book.title} width={176} height={256} className="object-cover w-full h-full" />
            </div>
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-bold text-gray-800">{book.title}</h2>
              <p className="text-sm text-gray-500">{Array.isArray(book.authors) ? book.authors.join(", ") : book.authors}</p>
              <p className="text-xs text-gray-400">{book.publisher}</p>

              {/* 평균 별점 (정수 별) */}
              {roundedAvg !== null && reviewCount > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-[2px]">
                    {[1,2,3,4,5].map(n => (
                      <svg key={n} viewBox="0 0 20 20" className={`w-5 h-5 ${n <= roundedAvg ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.1 3.385a1 1 0 00.95.69h3.556c.969 0 1.371 1.24.588 1.81l-2.876 2.09a1 1 0 00-.364 1.118l1.1 3.386c.3.92-.755 1.688-1.54 1.118l-2.876-2.09a1 1 0 00-1.176 0l-2.876 2.09c-.785.57-1.84-.198-1.54-1.118l1.1-3.386a1 1 0 00-.364-1.118L2.755 8.812c-.783-.57-.38-1.81.588-1.81h3.556a1 1 0 00.95-.69l1.2-3.385z"/>
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">{roundedAvg}점 · {reviewCount}명</span>
                </div>
              )}
            </div>
          </div>

          {/* 진행 입력(읽은/총 페이지) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">📖 읽은 페이지 / 총 페이지</label>
            <div className="flex gap-3 items-center mb-4">
              <input
                type="number"
                value={readPages}
                min={0}
                onChange={(e) => setReadPages(Math.min(Number(e.target.value || 0), Number(totalPages || 0)))}
                className="border rounded-lg px-3 py-2 w-28"
                placeholder="읽은 페이지"
              />
              <span className="text-sm text-gray-500">/</span>
              <input
                type="number"
                value={totalPages}
                min={0}
                onChange={(e) => setTotalPages(Math.max(0, Number(e.target.value || 0)))}
                className="border rounded-lg px-3 py-2 w-28"
                placeholder="총 페이지(예: 320)"
              />
              <span className="text-sm text-gray-500">페이지</span>
            </div>

            <div className="h-[44px] w-full">
              <Bar data={barData} options={barOptions} />
            </div>
            <p className="text-xs text-gray-500 text-right mt-1">
              {readPages}p / {totalPages}p
            </p>
          </div>

          {/* 공개 감상평 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold">📢 감상평 (전체 공개, 유저당 1개)</label>
              {renderStars()}
            </div>
            <div className="flex items-start gap-4">
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                className="w-full border rounded-xl p-4 text-sm shadow-sm"
                rows={5}
                placeholder="읽고 느낀 점을 적어주세요."
              />
              <div className="flex flex-col gap-3">
                <button
                  onClick={savePublicReview}
                  className="flex-shrink-0 min-w-[96px] px-6 py-3 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-white font-semibold"
                >
                  {myReview ? "수정 하기" : "등록"}
                </button>
                {myReview && (
                  <button
                    onClick={deletePublicReview}
                    className="h-[36px] text-xs text-red-500 hover:underline"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>

            {/* 공개 감상평 목록 */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm text-gray-600">등록된 감상평 ({reviews.length})</h4>
              </div>
              {reviews.length === 0 && (
                <p className="text-sm text-gray-400">아직 등록된 감상평이 없습니다.</p>
              )}
              {reviews.map((r) => (
                <div key={r.id} className="border rounded-xl p-4 bg-gray-50/80 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      {formatDate(r.createdAt)} · {r.nickname || r.uid.slice(0, 6)}
                    </div>
                    <div className="text-yellow-400 text-sm">
                      {"★".repeat(Math.max(0, Math.min(5, r.rating || 0)))}
                      <span className="text-gray-300">
                        {"★".repeat(Math.max(0, 5 - (r.rating || 0)))}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{r.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 우측: 개인 메모 */}
        <aside className="lg:col-span-1 space-y-5 lg:sticky lg:top-8 lg:self-start">
          <h3 className="font-semibold">📒 내 메모 (개인)</h3>
          <textarea
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            className="w-full border rounded-xl p-4 text-sm shadow-sm"
            rows={7}
            placeholder={`메모를 남기면 현재 읽은 페이지(${readPages}p)가 함께 저장돼요.`}
          />
          <button
            onClick={async () => {
              if (!uid) return alert("로그인 후 이용해주세요.");
              const text = memoText.trim();
              if (!text) return alert("메모를 입력해주세요.");
              await addDoc(collection(db, "users", uid, "books", cleanId, "memos"), {
                uid, text, pagesAt: readPages, createdAt: serverTimestamp(),
              });
              setMemoText("");
            }}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold"
          >
            메모 등록
          </button>

          <div className="space-y-3">
            {memos.map((m) => (
              <div key={m.id} className="border rounded-xl p-4 bg-white shadow-sm">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatDate(m.createdAt)} · {m.pagesAt}p</span>
                  {/* 삭제 버튼은 기존 함수로 처리 */}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
            {memos.length === 0 && (
              <p className="text-sm text-gray-400">아직 메모가 없습니다.</p>
            )}
          </div>
        </aside>
      </div>

      {/* 하단 버튼 */}
      <div className="flex justify-between pt-12">
        <button
          onClick={handleSaveProgress}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold"
        >
          저장하기
        </button>
        <button onClick={() => window.history.back()} className="text-sm text-gray-500 underline">
          닫기
        </button>
      </div>
    </div>
  );
}

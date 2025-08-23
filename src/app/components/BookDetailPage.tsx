// src/app/books/BookDetailPage.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc, getDoc, setDoc, deleteDoc,
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../utils/firebase";
import Image from "next/image";

// charts (진행률 막대)
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// ---------- Types ----------
type PublicReview = {
  id: string;          // == uid
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

// ---------- Component ----------
export default function BookDetailPage() {
  const { id } = useParams();
  const cleanId = decodeURIComponent(String(id)).split(" ")[0];

  // auth / user
  const [userUid, setUserUid] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | undefined>(undefined);

  // book meta (좌측 상단)
  const [book, setBook] = useState<any>(null);
  const [readPages, setReadPages] = useState(0);
  const [totalPages, setTotalPages] = useState(320);

  // rating + 공개 감상평 입력
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [reviewText, setReviewText] = useState("");

  // 공개 감상평 목록 / 내 감상평
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const myReview: PublicReview | undefined = useMemo(
    () => reviews.find((r) => r.uid === userUid),
    [reviews, userUid]
  );

  // 평균/개수(정수 별 표시용)
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<number>(0);

  // 목록 토글
  const [expanded, setExpanded] = useState(false);
  const INITIAL_COUNT = 3;

  // 개인 메모
  const [memos, setMemos] = useState<PrivateMemo[]>([]);
  const [memoText, setMemoText] = useState("");

  const safeReadPages = Math.min(readPages, totalPages);

  // ---------- Auth 구독 ----------
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (u) => {
      setUserUid(u?.uid ?? null);
      if (u) {
        try {
          const prof = await getDoc(doc(db, "users", u.uid));
          const nick = (prof.exists() && (prof.data() as any)?.nickname) || undefined;
          setNickname(nick);
        } catch {}
      } else {
        setNickname(undefined);
      }
    });
    return () => unsub();
  }, []);

  // ---------- 로컬 캐시에서 표지/제목 로드(UID별 키) ----------
  useEffect(() => {
    const key = userUid ? `book-list:${userUid}` : "book-list";
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const matched = parsed.find((b: any) => b.isbn === cleanId);
      if (matched) setBook(matched);
    } catch {}
  }, [cleanId, userUid]);

  // ---------- 내 책 진행/개인 별점 로드 ----------
  useEffect(() => {
    if (!userUid || !cleanId) return;
    (async () => {
      const ref = doc(db, "users", userUid, "books", cleanId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setReadPages(data.readPages || 0);
        setTotalPages(data.totalPages || 320);
        setRating(data.rating || 0);
        setBook((prev: any) => prev || data);
      }
    })();
  }, [userUid, cleanId]);

  // ---------- 공개 감상평 구독 + 평균/개수 계산(정수 별만 표시) ----------
  useEffect(() => {
    if (!cleanId) return;
    const qy = query(collection(db, "books", cleanId, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows: PublicReview[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setReviews(rows);

        let sum = 0, cnt = 0;
        rows.forEach(r => {
          if (typeof r.rating === "number" && r.rating > 0) {
            sum += r.rating;
            cnt += 1;
          }
        });
        setReviewCount(cnt);
        setAvgRating(cnt ? sum / cnt : null);
      },
      (err) => {
        // @ts-ignore
        if (err?.code !== "permission-denied") console.error("reviews onSnapshot:", err);
        setReviewCount(0);
        setAvgRating(null);
      }
    );
    return () => unsub();
  }, [cleanId]);

  // ---------- 내 감상평 프리필(문서ID = uid) ----------
  useEffect(() => {
    if (!userUid || !cleanId) return;
    (async () => {
      const me = await getDoc(doc(db, "books", cleanId, "reviews", userUid));
      if (me.exists()) {
        const d = me.data() as any;
        setReviewText(d.text || "");
        if (typeof d.rating === "number") setRating(d.rating);
      }
    })();
  }, [userUid, cleanId]);

  // ---------- 개인 메모 구독 ----------
  useEffect(() => {
    if (!userUid || !cleanId) { setMemos([]); return; }
    const q = query(
      collection(db, "users", userUid, "books", cleanId, "memos"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PrivateMemo[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setMemos(list);
      },
      (err) => {
        // @ts-ignore
        if (err?.code !== "permission-denied") console.error("memos onSnapshot:", err);
      }
    );
    return () => unsub();
  }, [userUid, cleanId]);

  // ---------- 별 아이콘(선택용 정수 별) ----------
  const Star = ({ filled }: { filled: boolean }) => (
    <svg viewBox="0 0 20 20" className={`w-6 h-6 ${filled ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.1 3.385a1 1 0 00.95.69h3.556c.969 0 1.371 1.24.588 1.81l-2.876 2.09a1 1 0 00-.364 1.118l1.1 3.386c.3.92-.755 1.688-1.54 1.118l-2.876-2.09a1 1 0 00-1.176 0l-2.876 2.09c-.785.57-1.84-.198-1.54-1.118l1.1-3.386a1 1 0 00-.364-1.118L2.755 8.812c-.783-.57-.38-1.81.588-1.81h3.556a1 1 0 00.95-.69l1.2-3.385z"/>
    </svg>
  );

  const renderStars = () => {
    const active = hoverRating || rating;
    return (
      <div className="flex items-center gap-1" role="radiogroup" aria-label="별점 선택">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            role="radio"
            aria-checked={rating === n}
            title={`${n}점`}
            className="focus:outline-none"
          >
            <Star filled={n <= active} />
          </button>
        ))}
        <span className="ml-1 text-sm text-gray-500">{rating}/5</span>
      </div>
    );
  };

  // ---------- 공개 감상평 저장(업서트, 유저당 1개) ----------
  const savePublicReview = async () => {
    if (!userUid) return alert("로그인 후 이용해주세요.");
    const text = reviewText.trim();
    if (!text) return alert("감상평을 입력해주세요.");

    await setDoc(
      doc(db, "books", cleanId, "reviews", userUid),
      {
        uid: userUid,
        nickname: nickname || null,
        rating,
        text,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 개인 책 문서에도 별점 동기화(선택)
    await setDoc(
      doc(db, "users", userUid, "books", cleanId),
      { rating, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  };

  const deletePublicReview = async () => {
    if (!userUid) return;
    if (!confirm("내 감상평을 삭제할까요?")) return;
    await deleteDoc(doc(db, "books", cleanId, "reviews", userUid));
    setReviewText("");
  };

  // ---------- 개인 메모 저장/삭제 ----------
  const addMemo = async () => {
    if (!userUid) return alert("로그인 후 이용해주세요.");
    const text = memoText.trim();
    if (!text) return alert("메모를 입력해주세요.");
    await addDoc(collection(db, "users", userUid, "books", cleanId, "memos"), {
      uid: userUid,
      text,
      pagesAt: readPages, // 등록 시점 읽은 페이지
      createdAt: serverTimestamp(),
    });
    setMemoText("");
  };

  const removeMemo = async (mid: string) => {
    if (!userUid) return;
    await deleteDoc(doc(db, "users", userUid, "books", cleanId, "memos", mid));
  };

  // ---------- 진행 저장 ----------
  const handleSaveProgress = async () => {
    if (!userUid) return;
    const ref = doc(db, "users", userUid, "books", cleanId);
    await setDoc(
      ref,
      { readPages, totalPages, rating, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    alert("저장되었습니다!");
  };

  // ---------- chart ----------
  const barData = {
    labels: [""],
    datasets: [
      { label: "읽은 페이지", data: [safeReadPages], backgroundColor: "#3b82f6", borderRadius: 12, barThickness: 26 },
      { label: "남은 페이지", data: [Math.max(totalPages - safeReadPages, 0)], backgroundColor: "#e5e7eb", borderRadius: 12, barThickness: 26 },
    ],
  };
  const barOptions = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 0 },
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: { x: { stacked: true, max: totalPages, beginAtZero: true, display: false }, y: { stacked: true, display: false } },
  };

  // ---------- utils ----------
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
        {/* ---------- 좌측(2칸): 책/진행/공개 감상평 ---------- */}
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

              {/* 평균 별점 (정수 별만) */}
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

          {/* 진행률 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">📖 읽은 페이지</label>
            <div className="flex gap-3 items-center mb-4">
              <input
                type="number"
                value={readPages}
                onChange={(e) => setReadPages(Math.min(Number(e.target.value || 0), totalPages))}
                className="border rounded-lg px-3 py-2 w-28"
              />
              <span className="text-sm text-gray-500">/</span>
              <input
                type="number"
                value={totalPages}
                onChange={(e) => setTotalPages(Number(e.target.value || 0))}
                className="border rounded-lg px-3 py-2 w-28"
              />
              <span className="text-sm text-gray-500">페이지</span>
            </div>
            <div className="h-[44px] w-full">
              <Bar data={barData} options={barOptions} />
            </div>
            <p className="text-xs text-gray-500 text-right mt-1">{readPages}p / {totalPages}p</p>
          </div>

          {/* 공개 감상평 작성/수정 */}
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
                placeholder="읽고 느낀 점을 적어주세요. (전체에게 공개됩니다)"
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

            {/* 공개 감상평 목록 (기본 3개, 더보기/접기) */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm text-gray-600">등록된 감상평 ({reviews.length})</h4>
                {reviews.length > INITIAL_COUNT && (
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? "접기" : "더 보기"}
                  </button>
                )}
              </div>

              {reviews.length === 0 && (
                <p className="text-sm text-gray-400">아직 등록된 감상평이 없습니다.</p>
              )}

              {(expanded ? reviews : reviews.slice(0, INITIAL_COUNT)).map((r) => (
                <div key={r.id} className="border rounded-xl p-4 bg-gray-50/80 shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      {formatDate(r.createdAt)} · {r.nickname || r.uid.slice(0, 6)}
                    </div>
                    {/* 정수 별점 표시 */}
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

        {/* ---------- 우측(1칸): 개인 메모 ---------- */}
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
            onClick={addMemo}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold"
          >
            메모 등록
          </button>

          {/* 메모 목록 */}
          <div className="space-y-3">
            {memos.map((m) => (
              <div key={m.id} className="border rounded-xl p-4 bg-white shadow-sm">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatDate(m.createdAt)} · {m.pagesAt}p</span>
                  <button className="text-red-500" onClick={() => removeMemo(m.id)}>삭제</button>
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

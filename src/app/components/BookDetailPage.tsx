"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../utils/firebase";

// chart.js (진행률 막대)
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

/** ─────────────────────────────────────────────────────────────
 *  임시 클라이언트 방어 규칙 (2단계: 서버 검증으로 이전 예정)
 * ───────────────────────────────────────────────────────────── */
const MIN_SESSION_SEC = 180;   // 최소 3분 이상만 인정
const MAX_PAGES_PER_MIN = 5;   // ✅ 분당 최대 5p 인정
const DAILY_PAGES_CAP = 300;   // 하루 누적 상한

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

type BookData = {
  title: string;
  authors: string[];
  thumbnail?: string;
  publisher?: string;
  totalPages: number;
  readPages: number;
  summary?: string;
};

export default function BookDetailPage() {
  const { id } = useParams();
  const isbn = decodeURIComponent(String(id)).split(" ")[0];

  // auth
  const [uid, setUid] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | undefined>(undefined);

  // book
  const [book, setBook] = useState<BookData | null>(null);
  const [totalPages, setTotalPages] = useState(320);
  const [readPages, setReadPages] = useState(0);
  const [summary, setSummary] = useState("");

  // rating & 공개 감상평
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const myReview = useMemo(() => reviews.find((r) => r.uid === uid), [reviews, uid]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);

  // 개인 메모
  const [memos, setMemos] = useState<PrivateMemo[]>([]);
  const [memoText, setMemoText] = useState("");

  // session
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartAt, setSessionStartAt] = useState<number | null>(null);
  const [startReadPages, setStartReadPages] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // derived
  const safeRead = Math.min(readPages, totalPages);
  const leftPages = useMemo(() => Math.max(0, totalPages - readPages), [totalPages, readPages]);
  const progressPct = useMemo(
    () => (totalPages > 0 ? Math.round((safeRead / totalPages) * 100) : 0),
    [safeRead, totalPages]
  );

  /** ─────────────────────────────────────────────────────────────
   *  Auth & 기본 데이터 로딩
   * ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    return onAuthStateChanged(getAuth(), async (u) => {
      setUid(u?.uid ?? null);
      if (u) {
        const prof = await getDoc(doc(db, "users", u.uid));
        setNickname(prof.exists() ? (prof.data() as any)?.nickname : undefined);
      } else {
        setNickname(undefined);
      }
    });
  }, []);

  // 로컬 캐시로 표지/제목 채우기
  useEffect(() => {
    const key = uid ? `book-list:${uid}` : "book-list";
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const list = JSON.parse(raw);
      const found = list.find((b: any) => b.isbn === isbn);
      if (found) {
        setBook({
          title: found.title ?? "(제목 없음)",
          authors: found.authors ?? [],
          thumbnail: found.thumbnail,
          publisher: found.publisher,
          totalPages,
          readPages,
          summary,
        });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isbn]);

  // 내 책 진행/개인 별점
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const ref = doc(db, "users", uid, "books", isbn);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const d = snap.data() as any;
        setTotalPages(Number(d.totalPages || 320));
        setReadPages(Number(d.readPages || 0));
        setRating(Number(d.rating || 0));
        setSummary(d.summary || "");
        setBook((prev) => prev || {
          title: d.title ?? "(제목 없음)",
          authors: d.authors ?? [],
          thumbnail: d.thumbnail,
          publisher: d.publisher,
          totalPages: Number(d.totalPages || 320),
          readPages: Number(d.readPages || 0),
          summary: d.summary || "",
        });
      }
    })();
  }, [uid, isbn]);

  // 공개 감상평 구독 + 평균/개수
  useEffect(() => {
    const qy = query(collection(db, "books", isbn, "reviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      const rows: PublicReview[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setReviews(rows);
      const vals = rows.map((r) => r.rating).filter((n) => typeof n === "number" && n > 0);
      setReviewCount(vals.length);
      setAvgRating(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
    });
    return () => unsub();
  }, [isbn]);

  // 내 감상평 프리필
  useEffect(() => {
    if (!uid) return;
    (async () => {
      const me = await getDoc(doc(db, "books", isbn, "reviews", uid));
      if (me.exists()) {
        const d = me.data() as any;
        setReviewText(d.text || "");
        if (typeof d.rating === "number") setRating(d.rating);
      }
    })();
  }, [uid, isbn]);

  // 개인 메모 구독
  useEffect(() => {
    if (!uid) { setMemos([]); return; }
    const q = query(collection(db, "users", uid, "books", isbn, "memos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setMemos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, [uid, isbn]);

  /** ─────────────────────────────────────────────────────────────
   *  세션 타이머
   * ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!sessionStartAt) return;
    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStartAt) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionStartAt]);

  const handleStart = async () => {
    if (!uid) return alert("로그인이 필요합니다.");
    if (sessionId) return;

    const ref = await addDoc(collection(db, "users", uid, "books", isbn, "sessions"), {
      startedAt: new Date().toISOString(),
      source: "timer",
      device: "web",
    });

    setSessionId(ref.id);
    setSessionStartAt(Date.now());
    setStartReadPages(readPages);
    setElapsedSec(0);
  };

  const handleStop = async () => {
    if (!uid || !sessionId || !sessionStartAt || startReadPages == null) return;

    // 종료 시 사용자의 현재 읽은 페이지 입력
    const input = prompt(
      `현재 읽은 페이지를 입력하세요.\n(최소 ${readPages}p, 최대 ${totalPages}p)`
    );
    if (input == null) return;
    const finalRead = Number(input);
    if (!Number.isFinite(finalRead)) return alert("숫자를 입력해주세요.");

    const clampedFinal = Math.max(readPages, Math.min(totalPages, Math.floor(finalRead)));
    const rawDelta = clampedFinal - startReadPages;
    const durationSec = Math.max(1, Math.floor((Date.now() - sessionStartAt) / 1000));
    const durationMin = durationSec / 60;

    // 1차(클라) 방어
    if (durationSec < MIN_SESSION_SEC) {
      await updateDoc(doc(db, "users", uid, "books", isbn, "sessions", sessionId), {
        endedAt: new Date().toISOString(),
        pages: 0,
        note: "too_short_client",
      });
      cleanupSession();
      return alert("세션이 너무 짧아요(3분 이상 읽어주세요).");
    }

    const speedCap = Math.ceil(durationMin * MAX_PAGES_PER_MIN); // ✅ 분당 5p 상한
    const dailyKey = `cap:${uid}:${isbn}:${new Date().toDateString()}`;
    const usedToday = Number(localStorage.getItem(dailyKey) || 0);
    const dailyLeft = Math.max(0, DAILY_PAGES_CAP - usedToday);
    const maxByLeft = Math.max(0, totalPages - readPages);

    const finalDelta = Math.max(0, Math.min(rawDelta, speedCap, dailyLeft, maxByLeft));

    // 세션 완료 기록(임시: 클라에서 작성 — 2단계에서 서버 전용으로 이전 예정)
    await updateDoc(doc(db, "users", uid, "books", isbn, "sessions", sessionId), {
      endedAt: new Date().toISOString(),
      pages: finalDelta,
      durationSec,
      rawDelta,
      appliedDelta: finalDelta,
    });

    if (finalDelta <= 0) {
      cleanupSession();
      return alert("반영 가능한 증가량이 없습니다.");
    }

    const newReadPages = Math.min(totalPages, readPages + finalDelta);
    await setDoc(
      doc(db, "users", uid, "books", isbn),
      {
        totalPages,
        readPages: newReadPages,
        summary,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    setReadPages(newReadPages);

    // 일일 누적 키 갱신
    localStorage.setItem(dailyKey, String(usedToday + finalDelta));

    // 기존 미션 연동 이벤트와 호환 (2단계에서 서버로 이전 예정)
    window.dispatchEvent(new CustomEvent("reading-progress", { detail: finalDelta }));

    cleanupSession();
    alert(`저장되었습니다! (이번 세션 반영: +${finalDelta}p)`);
  };

  const cleanupSession = () => {
    setSessionId(null);
    setSessionStartAt(null);
    setStartReadPages(null);
    setElapsedSec(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  /** ─────────────────────────────────────────────────────────────
   *  공개 감상평 / 개인 메모
   * ───────────────────────────────────────────────────────────── */
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

  const savePublicReview = async () => {
    if (!uid) return alert("로그인 후 이용해주세요.");
    const text = reviewText.trim();
    if (!text) return alert("감상평을 입력해주세요.");

    await setDoc(
      doc(db, "books", isbn, "reviews", uid),
      { uid, nickname: nickname || null, rating, text, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      { merge: true }
    );
    await setDoc(doc(db, "users", uid, "books", isbn), { rating, updatedAt: new Date().toISOString() }, { merge: true });
  };

  const deletePublicReview = async () => {
    if (!uid) return;
    if (!confirm("내 감상평을 삭제할까요?")) return;
    await deleteDoc(doc(db, "books", isbn, "reviews", uid));
    setReviewText("");
  };

  const addMemo = async () => {
    if (!uid) return alert("로그인 후 이용해주세요.");
    const text = memoText.trim();
    if (!text) return alert("메모를 입력해주세요.");
    await addDoc(collection(db, "users", uid, "books", isbn, "memos"), {
      uid, text, pagesAt: readPages, createdAt: serverTimestamp(),
    });
    setMemoText("");
  };

  /** ─────────────────────────────────────────────────────────────
   *  차트 데이터
   * ───────────────────────────────────────────────────────────── */
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

  // utils
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

          {/* 읽기 세션 카드 */}
          <div className="bg-white p-4 rounded-2xl shadow space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700">⏱️ 읽기 세션</label>
              <div className="text-sm text-gray-500">남은 페이지: <b>{leftPages}p</b></div>
            </div>

            {sessionId ? (
              <>
                <div className="text-3xl font-mono tracking-wider">
                  {String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:
                  {String(elapsedSec % 60).padStart(2, "0")}
                </div>
                <p className="text-xs text-gray-500">
                  세션 ID: {sessionId} · 시작 페이지 스냅샷: {startReadPages}p
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleStop}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full"
                  >
                    읽기 종료 & 저장
                  </button>
                  <button
                    onClick={cleanupSession}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full"
                    title="세션 취소(기록 안 함)"
                  >
                    취소
                  </button>
                </div>
                <p className="text-xs text-gray-500">* 최소 {MIN_SESSION_SEC / 60}분 이상만 인정됩니다. (분당 최대 {MAX_PAGES_PER_MIN}p)</p>
              </>
            ) : (
              <button
                onClick={handleStart}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full"
              >
                읽기 시작
              </button>
            )}
          </div>

          {/* 진행률 (시각화) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">📖 진행률</label>
            <div className="h-[44px] w-full"><Bar data={barData} options={barOptions} /></div>
            <p className="text-xs text-gray-500 text-right mt-1">{readPages}p / {totalPages}p · {progressPct}%</p>
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
                  <button onClick={deletePublicReview} className="h-[36px] text-xs text-red-500 hover:underline">
                    삭제
                  </button>
                )}
              </div>
            </div>

            {/* 목록 */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm text-gray-600">등록된 감상평 ({reviews.length})</h4>
              </div>
              {reviews.length === 0 && <p className="text-sm text-gray-400">아직 등록된 감상평이 없습니다.</p>}
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
            onClick={addMemo}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-semibold"
          >
            메모 등록
          </button>

          <div className="space-y-3">
            {memos.map((m) => (
              <div key={m.id} className="border rounded-xl p-4 bg-white shadow-sm">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{formatDate(m.createdAt)} · {m.pagesAt}p</span>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{m.text}</p>
              </div>
            ))}
            {memos.length === 0 && <p className="text-sm text-gray-400">아직 메모가 없습니다.</p>}
          </div>
        </aside>
      </div>

      {/* 하단: "저장하기" 버튼 없음(세션 종료 시 저장) */}
      <div className="flex justify-end pt-12">
        <button onClick={() => window.history.back()} className="text-sm text-gray-500 underline">
          닫기
        </button>
      </div>
    </div>
  );
}

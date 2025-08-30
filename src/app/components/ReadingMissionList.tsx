// src/app/components/ReadingMissionList.tsx
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../utils/firebase";

type Difficulty = "eazy" | "normal" | "hard" | "custom";

type Mission = {
  id: string;
  title: string;
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  goal: number;       // 목표 페이지 수 (기간 전체 기준)
  progress: number;   // 0~100
  reward: number;     // 포인트
  completed: boolean;
  difficulty?: Difficulty;
};

type Props = {
  onReward: (reward: number) => void;
  showForm?: boolean;
  onlyActive?: boolean;
};

/** 날짜 유틸 */
const d0 = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};
/** 양끝 포함 일수(예: 같은 날이면 1일) */
function inclusiveDays(startISO: string, endISO: string): number {
  const s = d0(new Date(startISO));
  const e = d0(new Date(endISO));
  const days = Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
  return Math.max(days, 1);
}
/** 기간 → daily / weekly / custom */
function periodType(startISO: string, endISO: string): "daily" | "weekly" | "custom" {
  const days = inclusiveDays(startISO, endISO);
  if (days <= 1) return "daily";
  if (days <= 7) return "weekly";
  return "custom";
}
/** 난이도 자동 계산 규칙 */
function computeDifficulty(startISO: string, endISO: string, goal: number): Difficulty {
  const p = periodType(startISO, endISO);
  if (p === "daily") {
    if (goal >= 300) return "hard";
    if (goal >= 150) return "normal";
    return "eazy";
  }
  if (p === "weekly") {
    if (goal >= 600) return "hard";
    if (goal >= 300) return "normal";
    return "eazy";
  }
  return "custom";
}
/** 난이도 배지 스타일 */
function diffBadgeClass(d?: Difficulty) {
  switch (d) {
    case "hard":
      return "bg-red-100 text-red-700 border-red-200";
    case "normal":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "eazy":
      return "bg-green-100 text-green-700 border-green-200";
    case "custom":
    default:
      return "bg-indigo-100 text-indigo-700 border-indigo-200";
  }
}
/** 남은 일수(D-day), 남은 페이지, 하루 권장량 계산 */
function derivedStats(m: Mission) {
  const today = d0(new Date());
  const end = d0(new Date(m.endDate));
  const start = d0(new Date(m.startDate));

  // D-day (오늘 포함, 종료일이 지나면 0)
  let daysLeft = 0;
  if (today <= end) {
    const base = Math.floor((end.getTime() - today.getTime()) / 86400000) + 1; // inclusive
    // 아직 시작 전이면 시작일~종료일까지 표시
    const baseFromStart =
      today < start
        ? inclusiveDays(m.startDate, m.endDate)
        : base;
    daysLeft = Math.max(0, baseFromStart);
  }

  // 남은 페이지 = 목표 - (진행률 반영된 완료 페이지)
  const donePages = Math.round((m.progress / 100) * m.goal);
  const pagesLeft = Math.max(0, m.goal - donePages);

  // 하루 권장량
  const dailyNeeded = daysLeft > 0 ? Math.ceil(pagesLeft / daysLeft) : pagesLeft;

  return { daysLeft, pagesLeft, dailyNeeded };
}

export default function ReadingMissionList({
  onReward,
  showForm = true,
  onlyActive = false,
}: Props) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [userUid, setUserUid] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState(100);
  const [reward, setReward] = useState(100);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ─── 전체 미션 불러오기 ───────────────────────────────────────
  const fetchMissions = async (uid: string) => {
    const ref = collection(db, "users", uid, "missions");
    const snap = await getDocs(ref);

    const rows: Mission[] = await Promise.all(
      snap.docs.map(async (d) => {
        const m = d.data() as any;
        const calc = computeDifficulty(m.startDate, m.endDate, m.goal);
        if (!m.difficulty) {
          try {
            await updateDoc(doc(db, "users", uid, "missions", d.id), {
              difficulty: calc,
            });
          } catch {}
        }
        return {
          id: d.id,
          title: m.title,
          startDate: m.startDate,
          endDate: m.endDate,
          goal: Number(m.goal) || 0,
          progress: Number(m.progress) || 0,
          reward: Number(m.reward) || 0,
          completed: !!m.completed,
          difficulty: (m.difficulty as Difficulty) || calc,
        };
      })
    );

    const filtered = onlyActive ? rows.filter((m) => !m.completed) : rows;
    setMissions(filtered);
    setLoading(false);
  };

  // ─── 로그인 후 최초 로드 + pending-delta 처리 ────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      setUserUid(user.uid);
      await fetchMissions(user.uid);

      const pending = localStorage.getItem("pending-delta");
      if (pending) {
        const delta = Number(pending);
        updateMissionProgressFromReading(delta, user.uid);
        localStorage.removeItem("pending-delta");
      }
    });
    return () => unsub();
  }, [onlyActive]);

  // ─── reading-progress 이벤트로 즉시 진행률 반영 ─────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const delta = (e as CustomEvent<number>).detail;
      updateMissionProgressFromReading(delta);
    };
    window.addEventListener("reading-progress", handler);
    return () => window.removeEventListener("reading-progress", handler);
  }, [userUid]);

  // ─── 필요 시 전체 목록 재조회(sync) ────────────────────────────
  useEffect(() => {
    const syncHandler = async () => {
      if (!userUid) return;
      await fetchMissions(userUid);
    };
    window.addEventListener("reading-progress-sync", syncHandler);
    return () => window.removeEventListener("reading-progress-sync", syncHandler);
  }, [userUid]);

  // ─── 진행률 계산 + DB 업데이트 ─────────────────────────────────
  const updateMissionProgressFromReading = async (delta: number, uidParam?: string) => {
    const uid = uidParam ?? userUid;
    if (!uid) return;

    const today = d0(new Date());

    setMissions((prev) =>
      prev.map((m) => {
        const s = d0(new Date(m.startDate));
        const e = d0(new Date(m.endDate));

        if (m.completed || today < s || today > e) return m;

        const added = (delta / m.goal) * 100;
        const np = Math.min(100, m.progress + added);
        const justDone = np >= 100 && !m.completed;
        if (justDone) onReward(m.reward);

        updateDoc(doc(db, "users", uid, "missions", m.id), {
          progress: np,
          completed: justDone,
        });

        return { ...m, progress: np, completed: justDone };
      })
    );
  };

  // ─── 새 미션 추가 ─────────────────────────────────────────────
  const addMission = async () => {
    if (!userUid || !title || !startDate || !endDate) return;

    const goalNum = Number(goal);
    const rewardNum = Number(reward);
    const difficulty = computeDifficulty(startDate, endDate, goalNum);

    const ref = collection(db, "users", userUid, "missions");
    const docRef = await addDoc(ref, {
      title,
      startDate,
      endDate,
      goal: goalNum,
      reward: rewardNum,
      progress: 0,
      completed: false,
      difficulty,
    });

    setMissions((prev) => [
      ...prev,
      {
        id: docRef.id,
        title,
        startDate,
        endDate,
        goal: goalNum,
        reward: rewardNum,
        progress: 0,
        completed: false,
        difficulty,
      },
    ]);

    setTitle("");
    setStartDate("");
    setEndDate("");
    setGoal(100);
    setReward(100);
  };

  // ─── 미션 삭제 ─────────────────────────────────────────────
  const deleteMission = async (id: string) => {
    if (!userUid) return;
    await deleteDoc(doc(db, "users", userUid, "missions", id));
    setMissions((prev) => prev.filter((m) => m.id !== id));
  };

  if (loading) return <p>로딩 중...</p>;

  // ─── 렌더링 ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">🎯 독서 미션</h3>

      {/* ➕ 새 미션 추가 폼 */}
      {showForm && (
        <div className="bg-white p-4 rounded-xl shadow space-y-2">
          <h4 className="font-semibold">➕ 새 미션 추가</h4>
          <input
            type="text"
            placeholder="미션 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border px-2 py-1 rounded"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border px-2 py-1 rounded w-full"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border px-2 py-1 rounded w-full"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex flex-col w-full">
              <label className="text-sm text-gray-600 mb-1">🎯 목표 페이지 수</label>
              <input
                type="number"
                value={goal}
                onChange={(e) => {
                  const g = Number(e.target.value);
                  setGoal(g);
                  setReward(g); // 정책: 보상=목표
                }}
                className="border px-2 py-1 rounded"
              />
              {startDate && endDate && (
                <p className="text-xs text-gray-500 mt-1">
                  예상 난이도:{" "}
                  <span className={`inline-block px-2 py-[2px] rounded-full border ${diffBadgeClass(
                    computeDifficulty(startDate, endDate, Number(goal || 0))
                  )}`}>
                    {computeDifficulty(startDate, endDate, Number(goal || 0))}
                  </span>
                </p>
              )}
            </div>
            <div className="flex flex-col w-full">
              <label className="text-sm text-gray-600 mb-1">🏅 보상 포인트</label>
              <input
                type="number"
                value={reward}
                readOnly
                className="border px-2 py-1 rounded bg-gray-100 text-gray-600"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={addMission}
              className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded"
            >
              ➕ 미션 추가
            </button>
          </div>
        </div>
      )}

      {/* 미션 리스트 */}
      {missions.map((m) => {
        const pType = periodType(m.startDate, m.endDate);
        const periodLabel = pType === "daily" ? "일간" : pType === "weekly" ? "주간" : "커스텀";
        const { daysLeft, pagesLeft, dailyNeeded } = derivedStats(m);

        return (
          <div key={m.id} className="bg-white p-4 rounded-xl shadow space-y-3">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <p className="font-medium">{m.title}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-[2px] rounded-full border bg-gray-100 text-gray-700 border-gray-200">
                  {periodLabel}
                </span>
                <span
                  className={`text-xs px-2 py-[2px] rounded-full border ${diffBadgeClass(
                    m.difficulty
                  )}`}
                  title="난이도"
                >
                  {m.difficulty ?? "custom"}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-500">
              기간: {m.startDate} ~ {m.endDate}
            </p>
            <p className="text-sm text-gray-500">
              목표: {m.goal}p <span className="text-gray-300">·</span> 보상: {m.reward}p
            </p>

            {/* 진행 바 */}
            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-400"
                style={{ width: `${m.progress}%` }}
              />
            </div>
            <p className="text-sm text-right text-gray-500">
              진행률: {Math.round(m.progress)}%
            </p>

            {/* 파생 지표 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[11px] text-gray-500">남은 일수</p>
                <p className="font-semibold">{daysLeft}일</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[11px] text-gray-500">남은 페이지</p>
                <p className="font-semibold">{pagesLeft}p</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[11px] text-gray-500">하루 권장량</p>
                <p className="font-semibold">{dailyNeeded}p</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-[11px] text-gray-500">상태</p>
                <p className={`font-semibold ${m.completed ? "text-green-600" : "text-gray-700"}`}>
                  {m.completed ? "✅ 완료" : "진행 중"}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => deleteMission(m.id)}
                className="text-xs bg-gray-300 text-black px-2 py-1 rounded ml-auto"
              >
                삭제
              </button>
            </div>

            {m.completed && (
              <p className="text-green-600 text-sm font-semibold">
                ✅ 완료! {m.reward}포인트 획득
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

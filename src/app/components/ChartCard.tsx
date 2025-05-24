"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

// Chart.js에 ArcElement 등록
ChartJS.register(ArcElement, Tooltip, Legend);

export default function ChartCard() {
  const data = {
    labels: ["1월", "2월", "3월"],
    datasets: [
      {
        data: [10, 20, 30],
        backgroundColor: ["#facc15", "#fde68a", "#fef3c7"],
      },
    ],
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow w-full">
      <h2 className="font-bold mb-2">📅 올해 독서량</h2>
      <Doughnut data={data} />
    </div>
  );
}
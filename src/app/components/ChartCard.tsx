"use client";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ChartCard() {
  const data = {
    labels: ["1주", "2주", "3주","4주"],
    datasets: [
      {
        data: [1, 2, 3,4],
        backgroundColor: ["#facc15", "#fde68a", "#fef3c7","#fbf6dfff"],
        borderWidth: 2,
        borderColor: "#fff",
      },
    ],
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col items-start justify-start space-y-4">
      <h2 className="text-lg font-bold text-gray-800">📊 이번달 독서량</h2>
      <div className="w-full flex justify-center items-center">
        <div className="w-48 h-48">
          <Doughnut data={data} />
        </div>
      </div>
      <p className="text-sm text-gray-500 text-center w-full">주별 독서 비율을 확인하세요</p>
    </div>
  );
}
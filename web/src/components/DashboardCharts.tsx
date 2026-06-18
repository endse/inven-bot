"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Activity } from "lucide-react"

export default function DashboardCharts({ data }: { data: any[] }) {
  return (
    <div className="lg:col-span-2 rounded-2xl border bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3 border-b pb-4 mb-6">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-slate-800">Monthly Transaction Volume</h3>
      </div>
      
      {data.length === 0 || data.every(d => d.sales === 0 && d.purchases === 0) ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl bg-slate-50/50">
          <Activity className="h-8 w-8 mb-3 opacity-20" />
          <p>Chart data will populate as transactions are recorded.</p>
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 5,
                right: 30,
                left: 0,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dx={-10} />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="purchases" name="Purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="sales" name="Sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

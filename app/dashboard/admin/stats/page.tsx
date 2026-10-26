'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft, BarChart2, Award, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function StatisticsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [stats, setStats] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState('2569')
  const [selectedSemester, setSelectedSemester] = useState('2')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [selectedYear, selectedSemester])

  const fetchStats = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('student_inspection_stats')
      .select('*')
      .eq('academic_year', selectedYear)
      .eq('semester', selectedSemester)
      .order('room', { ascending: true })
      .order('number', { ascending: true })

    setStats(data || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Navigation */}
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-600" />
              รายงานสถิติการตรวจระเบียบสะสม
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-gray-100 font-bold text-sm px-3 py-2 rounded-xl border outline-none"
            >
              <option value="2569">ปีการศึกษา 2569</option>
              <option value="2568">ปีการศึกษา 2568</option>
            </select>

            <select 
              value={selectedSemester} 
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="bg-gray-100 font-bold text-sm px-3 py-2 rounded-xl border outline-none"
            >
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
            </select>
          </div>
        </div>

        {/* สรุปการ์ดสถิติรวม */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><AlertTriangle className="w-6 h-6" /></div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase">ไม่ผ่านครั้งแรกสะสม</div>
              <div className="text-2xl font-extrabold text-gray-800">
                {stats.reduce((acc, curr) => acc + (curr.initial_fail_count || 0), 0)} ครั้ง
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><BarChart2 className="w-6 h-6" /></div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase">ตรวจแก้ไขทั้งหมด</div>
              <div className="text-2xl font-extrabold text-gray-800">
                {stats.reduce((acc, curr) => acc + (curr.total_correction_attempts || 0), 0)} ครั้ง
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><CheckCircle2 className="w-6 h-6" /></div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase">แก้ไขผ่านสำเร็จ</div>
              <div className="text-2xl font-extrabold text-gray-800">
                {stats.reduce((acc, curr) => acc + (curr.resolved_count || 0), 0)} ครั้ง
              </div>
            </div>
          </div>
        </div>

        {/* ตารางแสดงรายละเอียดรายบุคคล */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-700 font-bold">
                <th className="py-4 px-6">ชั้น/ห้อง</th>
                <th className="py-4 px-6">เลขที่</th>
                <th className="py-4 px-6">ชื่อ-สกุล</th>
                <th className="py-4 px-6 text-center">ติดไม่ผ่าน (รอบแรก)</th>
                <th className="py-4 px-6 text-center">จำนวนครั้งที่ตรวจแก้ไข</th>
                <th className="py-4 px-6 text-center">สถานะการแก้ไข</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">กำลังโหลดสถิติ...</td></tr>
              ) : stats.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-400">ไม่มีข้อมูลสถิติในภาคเรียนนี้</td></tr>
              ) : (
                stats.map((row) => (
                  <tr key={row.student_id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-6 font-semibold">{row.class_name}/{row.room}</td>
                    <td className="py-3.5 px-6 font-bold">{row.number}</td>
                    <td className="py-3.5 px-6 font-bold text-gray-900">{row.full_name}</td>
                    <td className="py-3.5 px-6 text-center font-semibold text-rose-600">
                      {row.initial_fail_count > 0 ? `${row.initial_fail_count} ครั้ง` : '-'}
                    </td>
                    <td className="py-3.5 px-6 text-center font-semibold text-amber-600">
                      {row.total_correction_attempts > 0 ? `${row.total_correction_attempts} ครั้ง` : '-'}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      {row.pending_correction_count > 0 ? (
                        <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-md font-bold">
                          ยังคงค้างแก้ไข ({row.pending_correction_count})
                        </span>
                      ) : row.total_correction_attempts > 0 ? (
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-md font-bold">
                          แก้ไขผ่านครบแล้ว
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
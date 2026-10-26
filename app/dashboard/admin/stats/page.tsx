'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ArrowLeft, BarChart2, AlertTriangle, CheckCircle2, RefreshCw, Calendar, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function StatisticsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [stats, setStats] = useState<any[]>([])
  const [riskStudents, setRiskStudents] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState('2569')
  const [selectedSemester, setSelectedSemester] = useState('2')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStatsData()
  }, [selectedYear, selectedSemester, selectedMonth])

  const fetchStatsData = async () => {
    setLoading(true)

    // 1. ดึงสถิติตามภาคเรียนและปีการศึกษา
    const { data: statsData } = await supabase
      .from('student_inspection_stats')
      .select('*')
      .eq('academic_year', selectedYear)
      .eq('semester', selectedSemester)
      .order('class_name', { ascending: true })
      .order('room', { ascending: true })
      .order('number', { ascending: true })

    setStats(statsData || [])

    // 2. ดึงข้อมูลนักเรียนกลุ่มเสี่ยงที่แก้ไขไม่ผ่านตั้งแต่ 3 ครั้งขึ้นไปในเดือนที่เลือก
    const { data: riskData } = await supabase
      .from('student_monthly_correction_stats')
      .select('*')
      .eq('inspection_month', selectedMonth)
      .gte('failed_correction_count', 3)

    setRiskStudents(riskData || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 font-sans pb-12">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-200 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition border border-gray-200">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-blue-600" />
                รายงานสถิติการตรวจระเบียบสะสม
              </h1>
              <p className="text-xs text-gray-500">สรุปผลการตรวจแก้ไขรายเดือนและประจำภาคเรียน</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>รอบเดือน:</span>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent outline-none cursor-pointer font-bold text-blue-800"
              />
            </div>

            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-gray-100 font-bold text-xs md:text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none"
            >
              <option value="2569">ปีการศึกษา 2569</option>
              <option value="2568">ปีการศึกษา 2568</option>
            </select>

            <select 
              value={selectedSemester} 
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="bg-gray-100 font-bold text-xs md:text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none"
            >
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
            </select>
          </div>
        </div>

        {/* กล่องแสดงรายชื่อนักเรียนกลุ่มเสี่ยง (แก้ไขไม่ผ่าน 3 ครั้งขึ้นไป) */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-rose-200 pb-3">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-base md:text-lg">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>รายชื่อนักเรียนกลุ่มเสี่ยงประจำเดือน {selectedMonth} (แก้ไขไม่ผ่าน 3 ครั้งขึ้นไป)</span>
            </div>
            <span className="bg-rose-600 text-white text-xs px-2.5 py-1 rounded-full font-extrabold">
              {riskStudents.length} คน
            </span>
          </div>

          {loading ? (
            <p className="text-xs text-gray-400">กำลังดึงข้อมูลนักเรียนกลุ่มเสี่ยง...</p>
          ) : riskStudents.length === 0 ? (
            <p className="text-sm text-gray-600 font-medium">✨ ไม่มีนักเรียนที่ติดแก้ไขไม่ผ่านเกิน 3 ครั้งในรอบเดือนนี้</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {riskStudents.map((s) => (
                <div key={s.student_id} className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-sm flex items-center justify-between">
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{s.full_name}</div>
                    <div className="text-xs text-gray-500">{s.class_name}/{s.room} เลขที่ {s.number}</div>
                  </div>
                  <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-1 rounded-lg font-extrabold border border-rose-200">
                    ไม่ผ่าน {s.failed_correction_count} ครั้ง
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* สรุปการ์ดสถิติรวม */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><AlertTriangle className="w-6 h-6" /></div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase">ติดไม่ผ่านรวมในภาคเรียน</div>
              <div className="text-2xl font-extrabold text-gray-800">
                {stats.reduce((acc, curr) => acc + (curr.initial_fail_count || 0), 0)} ครั้ง
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><RefreshCw className="w-6 h-6" /></div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase">ตรวจแก้ไขทั้งหมด</div>
              <div className="text-2xl font-extrabold text-gray-800">
                {stats.reduce((acc, curr) => acc + (curr.total_correction_attempts || 0), 0)} ครั้ง
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><CheckCircle2 className="w-6 h-6" /></div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase">แก้ไขผ่านสำเร็จแล้ว</div>
              <div className="text-2xl font-extrabold text-gray-800">
                {stats.reduce((acc, curr) => acc + (curr.resolved_count || 0), 0)} ครั้ง
              </div>
            </div>
          </div>
        </div>

        {/* ตารางแสดงรายละเอียดรายบุคคล */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>สถิติตรวจระเบียบรายบุคคล (ปีการศึกษา {selectedYear} / ภาคเรียนที่ {selectedSemester})</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-700 font-bold">
                  <th className="py-4 px-6">ชั้น/ห้อง</th>
                  <th className="py-4 px-6">เลขที่</th>
                  <th className="py-4 px-6">ชื่อ-สกุล</th>
                  <th className="py-4 px-6 text-center">ติดไม่ผ่าน (รอบแรก)</th>
                  <th className="py-4 px-6 text-center">จำนวนครั้งที่ตรวจแก้ไข</th>
                  <th className="py-4 px-6 text-center">สถานะการแก้ไขในภาคเรียน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">กำลังโหลดข้อมูลสถิติ...</td></tr>
                ) : stats.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">ไม่มีข้อมูลสถิติในภาคเรียนนี้</td></tr>
                ) : (
                  stats.map((row) => (
                    <tr key={row.student_id} className="hover:bg-slate-50 transition">
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
                            ค้างแก้ไข ({row.pending_correction_count})
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
    </div>
  )
}
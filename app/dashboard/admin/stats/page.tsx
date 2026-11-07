'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LabelList
} from 'recharts'
import { PieChart as PieChartIcon, Table as TableIcon, FileSpreadsheet, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Student {
  id: string
  class_name: string
  room: number
}

interface Inspection {
  student_id: string
  status: string
  hair_status: string
  nails_status: string
  uniform_status: string
  attempt_number: number
}

export default function DashboardStatsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  
  const [students, setStudents] = useState<Student[]>([])
  const [inspections, setInspections] = useState<Record<string, Inspection>>({})
  
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [filterType, setFilterType] = useState('all')

  useEffect(() => {
    fetchDashboardData()
  }, [filterMonth])

  const fetchDashboardData = async () => {
    setLoading(true)
    
    const fetchAllRows = async (table: string, select: string, filters: Record<string, string>) => {
      let allData: any[] = []
      let from = 0
      const step = 1000
      while (true) {
        let query = supabase.from(table).select(select).range(from, from + step - 1)
        if (filters.role) query = query.eq('role', filters.role)
        if (filters.inspection_month) query = query.eq('inspection_month', filters.inspection_month)
        
        const { data, error } = await query
        if (error || !data || data.length === 0) break
        
        allData = [...allData, ...data]
        if (data.length < step) break 
        from += step
      }
      return allData
    }

    const studentsData = await fetchAllRows('profiles', 'id, class_name, room', { role: 'student' })
    setStudents(studentsData)

    const inspectionsData = await fetchAllRows('inspections', 'student_id, status, hair_status, nails_status, uniform_status, attempt_number', { inspection_month: filterMonth })

    const latestStatus: Record<string, Inspection> = {}
    if (inspectionsData) {
      inspectionsData.forEach((record: Inspection) => {
        const current = latestStatus[record.student_id]
        if (!current || current.attempt_number < record.attempt_number) {
          latestStatus[record.student_id] = record
        }
      })
    }

    setInspections(latestStatus)
    setLoading(false)
  }

  // ดึงสถานะแยกตามประเภทที่เลือก
  const getStudentStatus = (studentId: string) => {
    const record = inspections[studentId]
    if (!record) return 'pending'
    
    let rawStatus = 'pending'
    if (filterType === 'all') rawStatus = record.status
    else if (filterType === 'hair') rawStatus = record.hair_status
    else if (filterType === 'nails') rawStatus = record.nails_status
    else if (filterType === 'uniform') rawStatus = record.uniform_status
    
    return rawStatus === 'waive' || rawStatus === 'absent' ? 'absent' : (rawStatus || 'pending')
  }

  // --- คำนวณสถิติ ---
  const totalStudents = students.length
  let totalPass = 0
  let totalFail = 0
  let totalAbsent = 0
  let totalPending = 0

  students.forEach(s => {
    const status = getStudentStatus(s.id)
    if (status === 'pass') totalPass++
    else if (status === 'fail') totalFail++
    else if (status === 'absent') totalAbsent++
    else totalPending++
  })

  const donutData = [
    { name: 'ผ่าน', value: totalPass, color: '#16a34a' },
    { name: 'ไม่ผ่าน', value: totalFail, color: '#dc2626' },
    { name: 'ขาด', value: totalAbsent, color: '#d97706' },
    { name: 'รอตรวจ', value: totalPending, color: '#e5e7eb' },
  ]

  // --- ข้อมูลกราฟแท่ง (แยก ม.1 - ม.6) ---
  const classesList = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
  const barChartData = classesList.map(c => {
    const classStudents = students.filter(s => s.class_name === c)
    let pass = 0, fail = 0, absent = 0, pending = 0
    
    classStudents.forEach(s => {
      const status = getStudentStatus(s.id)
      if (status === 'pass') pass++
      else if (status === 'fail') fail++
      else if (status === 'absent') absent++
      else pending++
    })

    return {
      name: c,
      ผ่าน: pass,
      ไม่ผ่าน: fail,
      ขาด: absent,
      รอตรวจ: pending
    }
  })

  // --- ข้อมูลตาราง (แยกรายห้อง) ---
  const classrooms: Record<string, { total: number, pass: number, fail: number, absent: number, pending: number }> = {}
  
  students.forEach(s => {
    const roomKey = `${s.class_name}/${s.room}`
    if (!classrooms[roomKey]) {
      classrooms[roomKey] = { total: 0, pass: 0, fail: 0, absent: 0, pending: 0 }
    }
    classrooms[roomKey].total++
    
    const status = getStudentStatus(s.id)
    if (status === 'pass') classrooms[roomKey].pass++
    else if (status === 'fail') classrooms[roomKey].fail++
    else if (status === 'absent') classrooms[roomKey].absent++
    else classrooms[roomKey].pending++
  })

  const sortedRooms = Object.keys(classrooms).sort((a, b) => {
    const [classA, roomA] = a.replace('ม.', '').split('/')
    const [classB, roomB] = b.replace('ม.', '').split('/')
    if (parseInt(classA) !== parseInt(classB)) return parseInt(classA) - parseInt(classB)
    return parseInt(roomA) - parseInt(roomB)
  })

  const exportToExcel = () => {
    const rows = sortedRooms.map(roomKey => ({
      'ห้องเรียน': roomKey,
      'นร.ทั้งหมด': classrooms[roomKey].total,
      'ผ่าน': classrooms[roomKey].pass,
      'ไม่ผ่าน': classrooms[roomKey].fail,
      'ขาด': classrooms[roomKey].absent,
      'รอตรวจ': classrooms[roomKey].pending
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'สถิติแยกห้อง')
    XLSX.writeFile(workbook, `สถิติ_${filterType}_${filterMonth}.xlsx`)
  }

  if (loading) {
    return <div className="p-12 text-center text-blue-600 font-bold animate-pulse">กำลังโหลดและคำนวณข้อมูลทั้งหมด...</div>
  }

  const thaiMonthDisplay = new Date(filterMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[#38bdf8]/20 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <PieChartIcon className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-extrabold text-gray-800">แดชบอร์ดสถิติภาพรวม</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div 
              className="relative flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer transition"
              onClick={(e) => { const input = e.currentTarget.querySelector('input'); if (input && 'showPicker' in input) { (input as any).showPicker(); } }}
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">{thaiMonthDisplay}</span>
              <input 
                type="month" 
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-0 h-0 opacity-0 absolute pointer-events-none"
              />
            </div>

            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-200 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer"
            >
              <option value="all">📊 ภาพรวมทุกรายการ</option>
              <option value="hair">✂️ เฉพาะ: ทรงผม</option>
              <option value="nails">✨ เฉพาะ: เล็บ</option>
              <option value="uniform">👔 เฉพาะ: การแต่งกาย</option>
            </select>
          </div>
        </div>

        {/* Top Summary Cards (ผ่าน, ไม่ผ่าน, ขาด, รอตรวจ) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
            <div className="text-sm font-bold text-gray-500 mb-1">ทั้งหมด</div>
            <div className="text-3xl font-black text-gray-800">{totalStudents}</div>
          </div>
          <div className="bg-[#16a34a] rounded-2xl p-4 text-center shadow-sm">
            <div className="text-sm font-bold text-white/90 mb-1">ผ่าน</div>
            <div className="text-3xl font-black text-white">{totalPass}</div>
          </div>
          <div className="bg-[#dc2626] rounded-2xl p-4 text-center shadow-sm">
            <div className="text-sm font-bold text-white/90 mb-1">ไม่ผ่าน</div>
            <div className="text-3xl font-black text-white">{totalFail}</div>
          </div>
          <div className="bg-[#d97706] rounded-2xl p-4 text-center shadow-sm">
            <div className="text-sm font-bold text-white/90 mb-1">ขาด</div>
            <div className="text-3xl font-black text-white">{totalAbsent}</div>
          </div>
          <div className="bg-gray-100 rounded-2xl p-4 text-center shadow-sm border border-gray-200">
            <div className="text-sm font-bold text-gray-600 mb-1">รอตรวจ</div>
            <div className="text-3xl font-black text-gray-700">{totalPending}</div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Donut Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
            <h3 className="text-sm font-bold text-gray-700 mb-4">สัดส่วนภาพรวม</h3>
            <div className="h-64 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-gray-800">{totalStudents} คน</span>
                <span className="text-xs font-bold text-gray-500">(100.0%)</span>
              </div>
            </div>
            <div className="flex gap-4 mt-4 text-xs font-bold">
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#16a34a] rounded"></div>ผ่าน</div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#dc2626] rounded"></div>ไม่ผ่าน</div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#d97706] rounded"></div>ขาด</div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#e5e7eb] rounded"></div>รอตรวจ</div>
            </div>
          </div>

          {/* Stacked Bar Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
            <h3 className="text-sm font-bold text-gray-700 mb-4">เปรียบเทียบแต่ละระดับชั้น</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280', fontWeight: 'bold' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <RechartsTooltip cursor={{ fill: '#f9fafb' }} />
                  
                  <Bar dataKey="ผ่าน" stackId="a" fill="#16a34a" barSize={40}>
                    <LabelList dataKey="ผ่าน" position="center" fill="#ffffff" style={{ fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="ไม่ผ่าน" stackId="a" fill="#dc2626">
                    <LabelList dataKey="ไม่ผ่าน" position="center" fill="#ffffff" style={{ fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="ขาด" stackId="a" fill="#d97706">
                    <LabelList dataKey="ขาด" position="center" fill="#ffffff" style={{ fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                  <Bar dataKey="รอตรวจ" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="รอตรวจ" position="center" fill="#4b5563" style={{ fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-4 text-xs font-bold">
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#16a34a] rounded"></div>ผ่าน</div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#dc2626] rounded"></div>ไม่ผ่าน</div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#d97706] rounded"></div>ขาด</div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-2 bg-[#e5e7eb] rounded"></div>รอตรวจ</div>
            </div>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-extrabold text-gray-800">สรุปผลแยกตามห้องเรียน</h3>
            </div>
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 bg-[#2563eb] hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> สร้าง Google Sheet / Excel
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-center border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-xs font-extrabold text-gray-700 border-b border-gray-200">
                  <th className="py-3 px-4">ห้องเรียน</th>
                  <th className="py-3 px-4">นร.ทั้งหมด</th>
                  <th className="py-3 px-4 text-[#16a34a]">ผ่าน</th>
                  <th className="py-3 px-4 text-[#dc2626]">ไม่ผ่าน</th>
                  <th className="py-3 px-4 text-[#d97706]">ขาด</th>
                  <th className="py-3 px-4 text-gray-500">รอตรวจ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-bold text-gray-600">
                {sortedRooms.map((roomKey) => (
                  <tr key={roomKey} className="hover:bg-blue-50/50 transition">
                    <td className="py-3 px-4 text-blue-600">{roomKey}</td>
                    <td className="py-3 px-4">{classrooms[roomKey].total}</td>
                    <td className="py-3 px-4 text-[#16a34a]">{classrooms[roomKey].pass}</td>
                    <td className="py-3 px-4 text-[#dc2626]">{classrooms[roomKey].fail}</td>
                    <td className="py-3 px-4 text-[#d97706]">{classrooms[roomKey].absent}</td>
                    <td className="py-3 px-4 text-gray-400">{classrooms[roomKey].pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedRooms.length === 0 && (
              <div className="p-8 text-gray-400 font-medium">ไม่พบข้อมูลนักเรียน</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import * as XLSX from 'xlsx'
import Swal from 'sweetalert2'
import { 
  ArrowLeft, 
  BarChart3, 
  Calendar, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCcw,
  Users,
  Filter
} from 'lucide-react'

// สมมติโครงสร้างข้อมูล (ปรับให้ตรงกับ Database ของคุณ)
interface StudentStat {
  id: string
  student_id: string
  full_name: string
  class_name: string
  room: number
  number: number
  failed_first_round: number
  correction_attempts: number
  current_status: 'pass' | 'fail' | 'pending'
  is_at_risk: boolean
}

export default function StatsPage() {
  const router = useRouter()
  const supabase = createClient()

  // State ตัวกรองเวลา
  const [academicYear, setAcademicYear] = useState('2569')
  const [semester, setSemester] = useState('2')
  const [inspectionMonth, setInspectionMonth] = useState('2026-11')

  // State ตัวกรองห้องเรียน
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedRoom, setSelectedRoom] = useState<string>('all')

  const [loading, setLoading] = useState(true)
  const [statsData, setStatsData] = useState<StudentStat[]>([])

  const classes = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
  const rooms = Array.from({ length: 12 }, (_, i) => i + 1)

  useEffect(() => {
    fetchStats()
  }, [academicYear, semester, inspectionMonth, selectedClass, selectedRoom])

  const fetchStats = async () => {
    setLoading(true)
    // ตรงนี้คือตัวอย่างการดึงข้อมูลและจำลอง (Mock) ข้อมูลสถิติ
    // ในการใช้งานจริง ให้เปลี่ยนเป็นการดึงจาก Supabase View หรือ Table สถิติของคุณ
    
    // จำลองข้อมูลเพื่อแสดงผล
    setTimeout(() => {
      const mockData: StudentStat[] = []
      setStatsData(mockData)
      setLoading(false)
    }, 500)
  }

  // คำนวณข้อมูลสรุป
  const filteredStats = statsData.filter(s => 
    (selectedClass === 'all' || s.class_name === selectedClass) &&
    (selectedRoom === 'all' || s.room.toString() === selectedRoom)
  )
  
  const atRiskStudents = filteredStats.filter(s => s.correction_attempts >= 3 && s.current_status !== 'pass')
  const totalFails = filteredStats.reduce((sum, s) => sum + s.failed_first_round, 0)
  const totalCorrections = filteredStats.reduce((sum, s) => sum + s.correction_attempts, 0)
  const totalPassedCorrections = filteredStats.filter(s => s.current_status === 'pass' && s.correction_attempts > 0).length

  // ฟังก์ชันดาวน์โหลด Excel ทั่วไป (ตามห้องที่เลือก)
  const handleExportStandardExcel = () => {
    if (filteredStats.length === 0) {
      Swal.fire('ไม่มีข้อมูล', 'ไม่พบข้อมูลสถิติในเงื่อนไขที่เลือก', 'info')
      return
    }

    const excelRows = filteredStats.map((s, idx) => ({
      'ลำดับ': idx + 1,
      'ชั้น/ห้อง': `${s.class_name}/${s.room}`,
      'เลขที่': s.number,
      'รหัสนักเรียน': s.student_id,
      'ชื่อ-สกุล': s.full_name,
      'ติดไม่ผ่าน (รอบแรก)': s.failed_first_round,
      'จำนวนครั้งที่ตรวจแก้ไข': s.correction_attempts,
      'สถานะการแก้ไขในภาคเรียน': s.current_status === 'pass' ? 'ผ่านแล้ว' : s.current_status === 'fail' ? 'ยังไม่ผ่าน' : 'รอตรวจแก้'
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'สถิติการตรวจระเบียบ')
    
    const roomText = selectedClass === 'all' ? 'ทั้งหมด' : `${selectedClass}${selectedRoom !== 'all' ? `_ห้อง${selectedRoom}` : ''}`
    XLSX.writeFile(workbook, `สถิติตรวจระเบียบ_${roomText}_เดือน${inspectionMonth}.xlsx`)
  }

  // ฟังก์ชันดาวน์โหลด Excel เฉพาะกลุ่มเสี่ยง
  const handleExportAtRiskExcel = () => {
    if (atRiskStudents.length === 0) {
      Swal.fire('ไม่มีข้อมูลกลุ่มเสี่ยง', 'ไม่มีนักเรียนที่ติดแก้ไขเกิน 3 ครั้งในรอบเดือนนี้', 'success')
      return
    }

    const excelRows = atRiskStudents.map((s, idx) => ({
      'ลำดับ': idx + 1,
      'ชั้น/ห้อง': `${s.class_name}/${s.room}`,
      'เลขที่': s.number,
      'ชื่อ-สกุล': s.full_name,
      'จำนวนครั้งที่ติดแก้ไข': s.correction_attempts,
      'สถานะปัจจุบัน': 'ยังไม่ผ่าน',
      'หมายเหตุ': 'กลุ่มเสี่ยง (เกิน 3 ครั้ง)'
    }))

    const worksheet = XLSX.utils.json_to_sheet(excelRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายชื่อกลุ่มเสี่ยง')
    
    const roomText = selectedClass === 'all' ? 'ทั้งหมด' : `${selectedClass}${selectedRoom !== 'all' ? `_ห้อง${selectedRoom}` : ''}`
    XLSX.writeFile(workbook, `รายชื่อกลุ่มเสี่ยง_${roomText}_เดือน${inspectionMonth}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        
        {/* Header & Main Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-600" />
                รายงานสถิติการตรวจระเบียบสะสม
              </h1>
              <p className="text-xs text-gray-500">สรุปผลการตรวจแก้ไขรายเดือนและประจำภาคเรียน</p>
            </div>
          </div>

          <div className="relative flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 w-full sm:w-auto overflow-hidden">
  <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
  
  {/* แสดงชื่อเดือนเป็นภาษาไทย */}
  <span className="text-blue-800 shrink-0 pointer-events-none">
    {new Date(inspectionMonth + '-01').toLocaleDateString('th-TH', { 
      month: 'long', 
      year: 'numeric' 
    })}
  </span>

  <input
    type="month"
    value={inspectionMonth}
    onChange={(e) => setInspectionMonth(e.target.value)}
    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
  />
</div>
            
            <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none">
              <option value="2569">ปีการศึกษา 2569</option>
              <option value="2568">ปีการศึกษา 2568</option>
            </select>

            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="bg-white border border-gray-200 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 outline-none">
              <option value="1">ภาคเรียนที่ 1</option>
              <option value="2">ภาคเรียนที่ 2</option>
            </select>
          </div>
        </div>

        {/* Room Filters & Export Buttons */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mr-2">
              <Filter className="w-4 h-4 text-gray-500" />
              กรองข้อมูล:
            </div>
            <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); if(e.target.value === 'all') setSelectedRoom('all'); }} className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 outline-none min-w-[120px]">
              <option value="all">ทุกระดับชั้น</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} disabled={selectedClass === 'all'} className="bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-sm font-bold text-gray-700 outline-none min-w-[100px] disabled:opacity-50">
              <option value="all">ทุกห้อง</option>
              {rooms.map(r => <option key={r} value={r.toString()}>ห้อง {r}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleExportStandardExcel} disabled={loading} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50">
              <Download className="w-4 h-4" />
              <span>ส่งออกสถิติ (Excel)</span>
            </button>
            <button onClick={handleExportAtRiskExcel} disabled={loading} className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50">
              <AlertTriangle className="w-4 h-4" />
              <span>ส่งออกเฉพาะกลุ่มเสี่ยง</span>
            </button>
          </div>
        </div>

        {/* At Risk Banner */}
        <div className={`p-4 rounded-2xl border ${atRiskStudents.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-rose-50/50 border-rose-100'} flex flex-col gap-3`}>
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-rose-700 font-bold text-sm md:text-base">
              <AlertTriangle className="w-5 h-5" />
              รายชื่อนักเรียนกลุ่มเสี่ยงประจำเดือน {inspectionMonth} (แก้ไขไม่ผ่าน 3 ครั้งขึ้นไป)
            </h2>
            <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full">{atRiskStudents.length} คน</span>
          </div>
          
          {atRiskStudents.length === 0 ? (
            <p className="text-sm text-gray-600 flex items-center gap-2">✨ ไม่มีนักเรียนที่ติดแก้ไขไม่ผ่านเกิน 3 ครั้งในรอบเดือนนี้</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {atRiskStudents.map(student => (
                <span key={student.id} className="bg-white border border-rose-200 text-rose-800 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm">
                  {student.class_name}/{student.room} ลท.{student.number} {student.full_name} ({student.correction_attempts} ครั้ง)
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-rose-100 p-3 rounded-xl"><AlertTriangle className="w-6 h-6 text-rose-600" /></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">ติดไม่ผ่านรวมในภาคเรียน</p>
              <p className="text-2xl font-extrabold text-gray-800">{totalFails} <span className="text-sm font-normal text-gray-500">ครั้ง</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-xl"><RefreshCcw className="w-6 h-6 text-amber-600" /></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">ตรวจแก้ไขทั้งหมด</p>
              <p className="text-2xl font-extrabold text-gray-800">{totalCorrections} <span className="text-sm font-normal text-gray-500">ครั้ง</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className="bg-emerald-100 p-3 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-gray-500 font-semibold mb-1">แก้ไขผ่านสำเร็จแล้ว</p>
              <p className="text-2xl font-extrabold text-gray-800">{totalPassedCorrections} <span className="text-sm font-normal text-gray-500">ครั้ง</span></p>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-gray-800 text-sm">สถิติตรวจระเบียบรายบุคคล (ปีการศึกษา {academicYear} / ภาคเรียนที่ {semester})</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 font-bold text-xs border-b border-gray-200">
                  <th className="py-3 px-4 text-center">ชั้น/ห้อง</th>
                  <th className="py-3 px-4 text-center">เลขที่</th>
                  <th className="py-3 px-4">ชื่อ-สกุล</th>
                  <th className="py-3 px-4 text-center">ติดไม่ผ่าน (รอบแรก)</th>
                  <th className="py-3 px-4 text-center">จำนวนครั้งที่ตรวจแก้ไข</th>
                  <th className="py-3 px-4 text-center">สถานะการแก้ไขในภาคเรียน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">กำลังโหลดข้อมูล...</td></tr>
                ) : filteredStats.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-gray-400 text-sm">ไม่มีข้อมูลสถิติในเงื่อนไขที่เลือก</td></tr>
                ) : (
                  filteredStats.map((student) => (
                    <tr key={student.id} className="hover:bg-blue-50/30 transition">
                      <td className="py-3 px-4 text-center font-semibold text-gray-700">{student.class_name}/{student.room}</td>
                      <td className="py-3 px-4 text-center font-semibold text-gray-700">{student.number}</td>
                      <td className="py-3 px-4 font-bold text-gray-800">{student.full_name}</td>
                      <td className="py-3 px-4 text-center text-rose-600 font-bold">{student.failed_first_round}</td>
                      <td className="py-3 px-4 text-center text-amber-600 font-bold">{student.correction_attempts}</td>
                      <td className="py-3 px-4 text-center">
                        {student.current_status === 'pass' && <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">ผ่านแล้ว</span>}
                        {student.current_status === 'fail' && <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold">ยังไม่ผ่าน</span>}
                        {student.current_status === 'pending' && <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">รอตรวจแก้</span>}
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
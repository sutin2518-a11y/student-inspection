'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import * as XLSX from 'xlsx'
import { LogOut, Download, Search, CheckCircle, XCircle } from 'lucide-react'

export default function AdminDashboard() {
  const supabase = createClient()
  const router = useRouter()

  const [students, setStudents] = useState<any[]>([])
  const [inspections, setInspections] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [status, setStatus] = useState<'pass' | 'fail'>('pass')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentTeacher, setCurrentTeacher] = useState<any>(null)
  const [currentMonth, setCurrentMonth] = useState('')

  useEffect(() => {
    // กำหนดค่าเดือนใน useEffect เท่านั้น เพื่อป้องกัน Build Error (Prerender error)
    const month = new Date().toISOString().slice(0, 7)
    setCurrentMonth(month)
    fetchInitialData(month)
  }, [])

  const fetchInitialData = async (monthVal?: string) => {
    // ตรวจสอบ User Login
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentTeacher(user)

    // ดึงข้อมูลนักเรียนทั้งหมด
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
    setStudents(profilesData || [])

    // ดึงข้อมูลการตรวจทั้งหมด
    const { data: inspectionsData } = await supabase
      .from('inspections')
      .select('*, profiles!student_id(full_name, grade, room, student_id)')
      .order('created_at', { ascending: false })
    setInspections(inspectionsData || [])
  }

  // บันทึกผลการตรวจ
  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudent) return alert('กรุณาเลือกนักเรียนก่อนบันทึก')

    setLoading(true)
    const activeMonth = currentMonth || new Date().toISOString().slice(0, 7)
    const { error } = await supabase.from('inspections').insert({
      student_id: selectedStudent.id,
      teacher_id: currentTeacher?.id,
      status,
      notes,
      inspection_month: activeMonth
    })

    setLoading(false)
    if (error) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message)
    } else {
      alert('บันทึกผลการตรวจเรียบร้อยแล้ว')
      setSelectedStudent(null)
      setNotes('')
      setStatus('pass')
      fetchInitialData(currentMonth)
    }
  }

  // ออกจากระบบ
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // คำนวณจำนวนครั้งที่ไม่ผ่านในเดือนนี้ของนักเรียนแต่ละคน
  const getStudentMonthlyFails = (studentUuid: string) => {
    if (!currentMonth) return 0
    return inspections.filter(
      (i) => i.student_id === studentUuid && i.inspection_month === currentMonth && i.status === 'fail'
    ).length
  }

  // ดาวน์โหลดไฟล์ Excel
  const exportToExcel = () => {
    const reportMonth = currentMonth || new Date().toISOString().slice(0, 7)
    const reportData = students.map((s) => {
      const studentFailsThisMonth = getStudentMonthlyFails(s.id)
      const totalFails = inspections.filter((i) => i.student_id === s.id && i.status === 'fail').length

      return {
        'รหัสนักเรียน': s.student_id || '-',
        'ชื่อ-นามสกุล': s.full_name,
        'ระดับชั้น': s.grade || '-',
        'ห้อง': s.room || '-',
        'จำนวนไม่ผ่าน (เดือนนี้)': studentFailsThisMonth,
        'จำนวนไม่ผ่าน (รวมทั้งหมด)': totalFails,
        'สถานะการติดตาม': studentFailsThisMonth > 0 ? 'ต้องแก้ไขพฤติกรรม' : 'ปกติ'
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(reportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานการตรวจเครื่องแต่งกาย')
    XLSX.writeFile(workbook, `รายงานการตรวจเครื่องแต่งกาย_${reportMonth}.xlsx`)
  }

  // แปลงวันที่ปลอดภัยสำหรับ SSR
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('th-TH')
    } catch {
      return dateString
    }
  }

  const filteredStudents = students.filter(
    (s) =>
      s.full_name?.includes(searchTerm) ||
      (s.student_id && s.student_id.includes(searchTerm)) ||
      (s.grade && s.grade.includes(searchTerm))
  )

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">ระบบตรวจเครื่องแต่งกายนักเรียน (สำหรับครู)</h1>
          <p className="text-sm text-gray-500">ประจำเดือน: {currentMonth || 'กำลังโหลด...'}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            <Download size={16} /> ส่งออกรายงาน Excel
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm transition"
          >
            <LogOut size={16} /> ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ฝั่งซ้าย: ค้นหาและบันทึกผลการตรวจ */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 text-gray-700">1. ค้นหาและบันทึกผล</h2>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, รหัส หรือชั้นเรียน..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* รายชื่อนักเรียน */}
          <div className="max-h-48 overflow-y-auto border rounded-lg divide-y mb-6">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`p-3 text-sm cursor-pointer hover:bg-blue-50 transition flex justify-between items-center ${
                    selectedStudent?.id === s.id ? 'bg-blue-100 font-semibold' : ''
                  }`}
                >
                  <div>
                    <p>{s.full_name}</p>
                    <p className="text-xs text-gray-500">
                      รหัส: {s.student_id || '-'} | ชั้น: {s.grade}/{s.room}
                    </p>
                  </div>
                  {getStudentMonthlyFails(s.id) > 0 && (
                    <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full font-bold">
                      ไม่ผ่าน {getStudentMonthlyFails(s.id)} ครั้ง
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="p-3 text-sm text-gray-400 text-center">ไม่พบนักเรียน</p>
            )}
          </div>

          {/* ฟอร์มบันทึกผล */}
          {selectedStudent && (
            <form onSubmit={handleSaveInspection} className="space-y-4 border-t pt-4">
              <p className="text-sm font-semibold text-blue-700">
                นักเรียนที่เลือก: {selectedStudent.full_name} ({selectedStudent.grade}/{selectedStudent.room})
              </p>

              <div>
                <label className="block text-sm font-medium mb-2">ผลการตรวจ</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setStatus('pass')}
                    className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 border font-medium text-sm ${
                      status === 'pass' ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    <CheckCircle size={18} /> ผ่าน
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('fail')}
                    className={`flex-1 py-2 rounded-lg flex justify-center items-center gap-2 border font-medium text-sm ${
                      status === 'fail' ? 'bg-red-600 text-white border-red-600' : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    <XCircle size={18} /> ไม่ผ่าน
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">หมายเหตุ / จุดที่ต้องแก้ไข</label>
                <textarea
                  rows={3}
                  placeholder="เช่น ทรงผมยาวเกินเกณฑ์, ถุงเท้าผิดระเบียบ..."
                  className="w-full p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition"
              >
                {loading ? 'กำลังบันทึก...' : 'บันทึกผลการตรวจ'}
              </button>
            </form>
          )}
        </div>

        {/* ฝั่งขวา: ประวัติการตรวจล่าสุด */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold mb-4 text-gray-700">2. ประวัติการตรวจล่าสุด</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b text-xs font-semibold text-gray-500 bg-gray-50">
                  <th className="p-3">วันที่/เวลา</th>
                  <th className="p-3">นักเรียน</th>
                  <th className="p-3">ระดับชั้น</th>
                  <th className="p-3">ผลการตรวจ</th>
                  <th className="p-3">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {inspections.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 text-xs text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="p-3 font-medium">{item.profiles?.full_name}</td>
                    <td className="p-3 text-xs">{item.profiles?.grade}/{item.profiles?.room}</td>
                    <td className="p-3">
                      {item.status === 'pass' ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                          ผ่าน
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">
                          ไม่ผ่าน
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-600 text-xs">{item.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
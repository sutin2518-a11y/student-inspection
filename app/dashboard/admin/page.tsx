'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Swal from 'sweetalert2'
import { 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  ArrowLeft, 
  Check, 
  X, 
  AlertTriangle, 
  Camera,
  Menu,
  LogOut
} from 'lucide-react'

type StatusType = 'pass' | 'fail' | 'waive' | 'pending'

interface Student {
  id: string
  student_id: string
  full_name: string
  class_name: string
  room: number
  number: number
  gender?: string
}

export default function StudentHairInspectionPage() {
  const supabase = createClient()
  const router = useRouter()

  // State
  const [selectedClass, setSelectedClass] = useState('ม.1')
  const [selectedRoom, setSelectedRoom] = useState(1)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [statuses, setStatuses] = useState<Record<string, StatusType>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const classes = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
  const rooms = Array.from({ length: 15 }, (_, i) => i + 1)

  useEffect(() => {
    fetchStudentsAndInspections()
  }, [selectedClass, selectedRoom])

  // ดึงรายชื่อนักเรียนและประวัติการตรวจประจำวัน
  const fetchStudentsAndInspections = async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    // 1. ดึงรายชื่อนักเรียนตามชั้นและห้องที่เลือก
    const { data: studentData, error: studentError } = await supabase
      .from('profiles')
      .select('id, student_id, full_name, class_name, room, number, gender')
      .eq('role', 'student')
      .eq('class_name', selectedClass)
      .eq('room', selectedRoom)
      .order('number', { ascending: true })

    if (studentError) {
      console.error(studentError)
      setLoading(false)
      return
    }

    const list: Student[] = studentData || []
    setStudents(list)

    // 2. ดึงสถานะการตรวจทรงผมวันนี้
    const studentIds = list.map(s => s.id)
    let currentStatuses: Record<string, StatusType> = {}

    if (studentIds.length > 0) {
      const { data: inspectionData } = await supabase
        .from('inspections')
        .select('student_id, hair_status, status')
        .in('student_id', studentIds)
        .eq('inspection_date', today)

      if (inspectionData) {
        inspectionData.forEach(item => {
          currentStatuses[item.student_id] = (item.hair_status || item.status || 'pending') as StatusType
        })
      }
    }

    // กำหนดสถานะตั้งต้นเป็น 'pending' สำหรับคนที่ยังไม่ตรวจ
    list.forEach(s => {
      if (!currentStatuses[s.id]) {
        currentStatuses[s.id] = 'pending'
      }
    })

    setStatuses(currentStatuses)
    setLoading(false)
  }

  // ปรับสถานะตรวจรายบุคคล
  const handleSetStatus = async (studentId: string, newStatus: StatusType) => {
    setStatuses(prev => ({ ...prev, [studentId]: newStatus }))

    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]

    await supabase
      .from('inspections')
      .upsert({
        student_id: studentId,
        inspector_id: user?.id,
        teacher_id: user?.id,
        hair_status: newStatus,
        status: newStatus === 'waive' ? 'pass' : newStatus,
        inspection_date: today
      }, { onConflict: 'student_id, inspection_date' })
  }

  // ปุ่มกด: ให้ผ่านทั้งหมดที่เหลือ
  const handlePassAllRemaining = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]

    const updated = { ...statuses }
    const payload: any[] = []

    students.forEach(s => {
      if (updated[s.id] === 'pending') {
        updated[s.id] = 'pass'
        payload.push({
          student_id: s.id,
          inspector_id: user?.id,
          teacher_id: user?.id,
          hair_status: 'pass',
          status: 'pass',
          inspection_date: today
        })
      }
    })

    setStatuses(updated)

    if (payload.length > 0) {
      await supabase.from('inspections').upsert(payload, { onConflict: 'student_id, inspection_date' })
    }

    setSaving(false)
    Swal.fire({
      icon: 'success',
      title: 'ปรับผ่านเรียบร้อย',
      text: `ตั้งค่า "ผ่าน" ให้กับนักเรียนที่เหลือในห้อง ${selectedClass}/${selectedRoom} แล้ว`,
      timer: 1200,
      showConfirmButton: false
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inspectedCount = Object.values(statuses).filter(s => s !== 'pending').length

  return (
    <div className="min-h-screen bg-[#38bdf8]/20 pb-12 font-sans">
      {/* 1. Header สีฟ้าด้านบน ตรงตามรูป 2 */}
      <div className="max-w-6xl mx-auto pt-4 px-4">
        <header className="bg-[#1d4ed8] text-white px-6 py-4 rounded-2xl shadow-lg flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">ระบบตรวจทรงผมนักเรียน</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium transition"
            >
              <LogOut size={16} /> ออกจากระบบ
            </button>
            <button className="text-white hover:bg-white/10 p-2 rounded-lg transition">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>
      </div>

      <main className="max-w-6xl mx-auto px-4 mt-4 space-y-4">
        {/* 2. การ์ดแสดงห้อง + ปุ่มการจัดการ */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-800 font-bold text-base md:text-lg">
            <Users className="w-5 h-5 text-blue-600" />
            <span>ห้อง: <span className="text-blue-600">{selectedClass}/{selectedRoom}</span></span>
            <span className="text-sm font-normal text-gray-500">
              ({inspectedCount} / {students.length} คน)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePassAllRemaining}
              disabled={saving || students.length === 0}
              className="flex items-center gap-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> ให้ผ่านทั้งหมดที่เหลือ
            </button>

            <button
              onClick={() => setShowRoomModal(true)}
              className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 px-3.5 py-2 rounded-xl text-sm font-bold transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> เปลี่ยนห้อง
            </button>
          </div>
        </div>

        {/* 3. ตารางแสดงรายชื่อนักเรียน ตรงตามรูป 2 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">กำลังดึงข้อมูลรายชื่อนักเรียน...</div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-gray-400">ไม่พบข้อมูลนักเรียนในห้อง {selectedClass}/{selectedRoom}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-800 font-bold text-sm border-b border-gray-200">
                    <th className="py-4 px-6 text-center w-20">เลขที่</th>
                    <th className="py-4 px-6">ชื่อ-สกุล</th>
                    <th className="py-4 px-6 text-center w-32">สถานะ</th>
                    <th className="py-4 px-6 text-center w-60">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {students.map((student, idx) => {
                    const status = statuses[student.id] || 'pending'
                    const isEven = idx % 2 === 1

                    return (
                      <tr 
                        key={student.id} 
                        className={`transition hover:bg-blue-50/40 ${isEven ? 'bg-gray-50/60' : 'bg-white'}`}
                      >
                        {/* เลขที่ */}
                        <td className="py-3.5 px-6 text-center font-bold text-gray-800">
                          {student.number || idx + 1}
                        </td>

                        {/* ชื่อ-สกุล & รหัสนักเรียน */}
                        <td className="py-3.5 px-6">
                          <div className="font-bold text-gray-900 text-base">{student.full_name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 font-medium">
                            {student.student_id || '-'} | {student.gender || (student.full_name.startsWith('เด็กหญิง') || student.full_name.startsWith('นางสาว') ? 'หญิง' : 'ชาย')}
                          </div>
                        </td>

                        {/* สถานะ Badge */}
                        <td className="py-3.5 px-6 text-center">
                          {status === 'pass' && (
                            <span className="inline-block bg-[#16a34a] text-white text-xs px-3.5 py-1 rounded-lg font-bold shadow-sm">
                              ผ่าน
                            </span>
                          )}
                          {status === 'fail' && (
                            <span className="inline-block bg-[#dc2626] text-white text-xs px-3.5 py-1 rounded-lg font-bold shadow-sm">
                              ไม่ผ่าน
                            </span>
                          )}
                          {status === 'waive' && (
                            <span className="inline-block bg-[#d97706] text-white text-xs px-3.5 py-1 rounded-lg font-bold shadow-sm">
                              ผ่อนปรน
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="inline-block bg-gray-200 text-gray-600 text-xs px-3.5 py-1 rounded-lg font-bold">
                              รอตรวจ
                            </span>
                          )}
                        </td>

                        {/* กลุ่มปุ่มจัดการ [ ✔ ] [ ✕ ] [ ⚠ ] [ 📷 AI ] */}
                        <td className="py-3.5 px-6 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
                            {/* ปุ่มผ่าน (สีเขียว) */}
                            <button
                              onClick={() => handleSetStatus(student.id, 'pass')}
                              className={`p-1.5 rounded-lg transition active:scale-90 ${
                                status === 'pass' 
                                  ? 'bg-[#16a34a] text-white shadow-sm' 
                                  : 'bg-white text-[#16a34a] border border-gray-200 hover:bg-emerald-50'
                              }`}
                              title="ผ่าน"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                            </button>

                            {/* ปุ่มไม่ผ่าน (สีแดง) */}
                            <button
                              onClick={() => handleSetStatus(student.id, 'fail')}
                              className={`p-1.5 rounded-lg transition active:scale-90 ${
                                status === 'fail' 
                                  ? 'bg-[#dc2626] text-white shadow-sm' 
                                  : 'bg-white text-[#dc2626] border border-gray-200 hover:bg-rose-50'
                              }`}
                              title="ไม่ผ่าน"
                            >
                              <X className="w-4 h-4 stroke-[3]" />
                            </button>

                            {/* ปุ่มผ่อนปรน/ตักเตือน (สีเหลือง) */}
                            <button
                              onClick={() => handleSetStatus(student.id, 'waive')}
                              className={`p-1.5 rounded-lg transition active:scale-90 ${
                                status === 'waive' 
                                  ? 'bg-[#d97706] text-white shadow-sm' 
                                  : 'bg-white text-[#d97706] border border-gray-200 hover:bg-amber-50'
                              }`}
                              title="ผ่อนปรน / ตักเตือน"
                            >
                              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                            </button>

                            {/* ปุ่มสแกนกล้อง AI (สีดำ) */}
                            <button
                              onClick={() => {
                                Swal.fire({
                                  title: 'ระบบตรวจด้วย AI',
                                  text: `กำลังเตรียมเปิดกล้องสำหรับ ${student.full_name}`,
                                  icon: 'info',
                                  confirmButtonColor: '#1d4ed8'
                                })
                              }}
                              className="flex items-center gap-1 bg-black hover:bg-gray-800 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition active:scale-95"
                              title="ตรวจสแกนทรงผมด้วย AI"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>AI</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal สำหรับเลือกห้อง */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3">เลือกห้องเรียนที่ต้องการตรวจ</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">ระดับชั้น</label>
                <div className="grid grid-cols-3 gap-2">
                  {classes.map(c => (
                    <button
                      key={c}
                      onClick={() => setSelectedClass(c)}
                      className={`py-2 text-sm font-semibold rounded-lg border transition ${
                        selectedClass === c 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">ห้องเรียน</label>
                <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1">
                  {rooms.map(r => (
                    <button
                      key={r}
                      onClick={() => setSelectedRoom(r)}
                      className={`py-2 text-sm font-semibold rounded-lg border transition ${
                        selectedRoom === r 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowRoomModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-bold shadow-md transition"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'
// test update
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Swal from 'sweetalert2'
import { 
  ShieldCheck, 
  Users, 
  ArrowLeft, 
  Check, 
  X, 
  UserX, 
  Camera,
  Menu,
  LogOut,
  ChevronDown,
  RotateCcw,
  Save
} from 'lucide-react'

type StatusType = 'pass' | 'fail' | 'absent' | 'pending'

interface Student {
  id: string
  student_id: string
  full_name: string
  class_name: string
  room: number
  number: number
  gender?: string
}

export default function TableInspectionPage() {
  const supabase = createClient()
  const router = useRouter()

  // State
  const [selectedClass, setSelectedClass] = useState('ม.1')
  const [selectedRoom, setSelectedRoom] = useState(1)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showBulkDropdown, setShowBulkDropdown] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [statuses, setStatuses] = useState<Record<string, StatusType>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const classes = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
  const rooms = Array.from({ length: 15 }, (_, i) => i + 1)

  // ปิด Dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowBulkDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchStudentsAndInspections()
  }, [selectedClass, selectedRoom])

  // ดึงข้อมูลนักเรียนและประวัติการตรวจ
  const fetchStudentsAndInspections = async () => {
    setLoading(true)
    setHasUnsavedChanges(false)
    const today = new Date().toISOString().split('T')[0]

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
          const rawStatus = item.hair_status || item.status
          currentStatuses[item.student_id] = (rawStatus === 'waive' ? 'absent' : rawStatus || 'pending') as StatusType
        })
      }
    }

    list.forEach(s => {
      if (!currentStatuses[s.id]) {
        currentStatuses[s.id] = 'pending'
      }
    })

    setStatuses(currentStatuses)
    setLoading(false)
  }

  // ปรับสถานะรายบุคคล (เปลี่ยนเฉพาะ UI ก่อน)
  const handleSetStatus = (studentId: string, newStatus: StatusType) => {
    setStatuses(prev => ({ ...prev, [studentId]: newStatus }))
    setHasUnsavedChanges(true)
  }

  // ปรับสถานะยกห้อง (สลับเปลี่ยนไปมาได้อิสระ ยังไม่บันทึกลง DB)
  const handleBulkSetStatus = (targetStatus: StatusType) => {
    setShowBulkDropdown(false)
    const updated = { ...statuses }
    students.forEach(s => {
      updated[s.id] = targetStatus
    })
    setStatuses(updated)
    setHasUnsavedChanges(true)
  }

  // บันทึกลงฐานข้อมูล Supabase เมื่อกดปุ่ม "บันทึกข้อมูล"
  const handleSaveAll = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]

    const payload = students.map(s => ({
      student_id: s.id,
      inspector_id: user?.id,
      teacher_id: user?.id,
      hair_status: statuses[s.id] || 'pending',
      status: statuses[s.id] || 'pending',
      inspection_date: today
    }))

    const { error } = await supabase
      .from('inspections')
      .upsert(payload, { onConflict: 'student_id, inspection_date' })

    setSaving(false)

    if (error) {
      Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: error.message,
        confirmButtonColor: '#1d4ed8'
      })
    } else {
      setHasUnsavedChanges(false)
      Swal.fire({
        icon: 'success',
        title: 'บันทึกข้อมูลเรียบร้อย',
        text: `บันทึกผลการตรวจห้อง ${selectedClass}/${selectedRoom} ลงระบบแล้ว`,
        timer: 1300,
        showConfirmButton: false
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inspectedCount = Object.values(statuses).filter(s => s !== 'pending').length

  return (
    <div className="min-h-screen bg-[#38bdf8]/20 pb-12 font-sans">
      {/* 1. Header สีฟ้าด่านบน */}
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
        {/* 2. การ์ดแสดงห้อง + ดร็อปดาวน์ + ปุ่มบันทึกข้อมูล */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-800 font-bold text-base md:text-lg">
            <Users className="w-5 h-5 text-blue-600" />
            <span>ห้อง: <span className="text-blue-600">{selectedClass}/{selectedRoom}</span></span>
            <span className="text-sm font-normal text-gray-500">
              ({inspectedCount} / {students.length} คน)
            </span>
            {hasUnsavedChanges && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                • ยังไม่ได้บันทึก
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* ปุ่มดร็อปดาวน์เลือกเปลี่ยนสถานะยกห้อง (สลับไปมาได้ตลอดเวลา) */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowBulkDropdown(!showBulkDropdown)}
                disabled={saving || students.length === 0}
                className="flex items-center gap-2 bg-[#16a34a] hover:bg-[#15803d] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <span>จัดการชุดข้อมูลห้อง</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showBulkDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showBulkDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => handleBulkSetStatus('pass')}
                    className="w-full text-left px-4 py-2.5 text-xs md:text-sm font-semibold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2.5 transition"
                  >
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>ผ่านทั้งหมด</span>
                  </button>
                  
                  <button
                    onClick={() => handleBulkSetStatus('fail')}
                    className="w-full text-left px-4 py-2.5 text-xs md:text-sm font-semibold text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition"
                  >
                    <X className="w-4 h-4 text-rose-600 stroke-[3]" />
                    <span>ไม่ผ่านทั้งหมด</span>
                  </button>

                  <button
                    onClick={() => handleBulkSetStatus('absent')}
                    className="w-full text-left px-4 py-2.5 text-xs md:text-sm font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition"
                  >
                    <UserX className="w-4 h-4 text-amber-600 stroke-[2.5]" />
                    <span>ขาดทั้งหมด</span>
                  </button>

                  <div className="border-t border-gray-100 my-1"></div>

                  <button
                    onClick={() => handleBulkSetStatus('pending')}
                    className="w-full text-left px-4 py-2.5 text-xs md:text-sm font-semibold text-gray-600 hover:bg-gray-100 flex items-center gap-2.5 transition"
                  >
                    <RotateCcw className="w-4 h-4 text-gray-500" />
                    <span>รอตรวจทั้งหมด</span>
                  </button>
                </div>
              )}
            </div>

            {/* ปุ่มบันทึกข้อมูลลงฐานข้อมูล */}
            <button
              onClick={handleSaveAll}
              disabled={saving || students.length === 0}
              className={`flex items-center gap-1.5 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition active:scale-95 disabled:opacity-50 ${
                hasUnsavedChanges 
                  ? 'bg-blue-600 hover:bg-blue-700 ring-4 ring-blue-300/50' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
            </button>

            {/* ปุ่มเปลี่ยนห้อง */}
            <button
              onClick={() => setShowRoomModal(true)}
              className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 px-3.5 py-2 rounded-xl text-sm font-bold transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> เปลี่ยนห้อง
            </button>
          </div>
        </div>

        {/* 3. ตารางแสดงรายชื่อนักเรียน */}
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
                      <tr key={student.id} className={`transition hover:bg-blue-50/40 ${isEven ? 'bg-gray-50/60' : 'bg-white'}`}>
                        {/* เลขที่ */}
                        <td className="py-3.5 px-6 text-center font-bold text-gray-800">
                          {student.number || idx + 1}
                        </td>

                        {/* ชื่อ-สกุล */}
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
                          {status === 'absent' && (
                            <span className="inline-block bg-[#d97706] text-white text-xs px-3.5 py-1 rounded-lg font-bold shadow-sm">
                              ขาด
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="inline-block bg-gray-200 text-gray-600 text-xs px-3.5 py-1 rounded-lg font-bold">
                              รอตรวจ
                            </span>
                          )}
                        </td>

                        {/* ปุ่มจัดการรายคน */}
                        <td className="py-3.5 px-6 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
                            <button 
                              onClick={() => handleSetStatus(student.id, 'pass')} 
                              className={`p-1.5 rounded-lg transition ${status === 'pass' ? 'bg-[#16a34a] text-white shadow-sm' : 'bg-white text-[#16a34a] border border-gray-200 hover:bg-emerald-50'}`} 
                              title="ผ่าน"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                            </button>

                            <button 
                              onClick={() => handleSetStatus(student.id, 'fail')} 
                              className={`p-1.5 rounded-lg transition ${status === 'fail' ? 'bg-[#dc2626] text-white shadow-sm' : 'bg-white text-[#dc2626] border border-gray-200 hover:bg-rose-50'}`} 
                              title="ไม่ผ่าน"
                            >
                              <X className="w-4 h-4 stroke-[3]" />
                            </button>

                            <button 
                              onClick={() => handleSetStatus(student.id, 'absent')} 
                              className={`p-1.5 rounded-lg transition ${status === 'absent' ? 'bg-[#d97706] text-white shadow-sm' : 'bg-white text-[#d97706] border border-gray-200 hover:bg-amber-50'}`} 
                              title="ขาดเรียน"
                            >
                              <UserX className="w-4 h-4 stroke-[2.5]" />
                            </button>

                            <button 
                              onClick={() => Swal.fire({ title: 'ระบบตรวจด้วย AI', text: `กำลังเตรียมเปิดกล้องสำหรับ ${student.full_name}`, icon: 'info' })} 
                              className="flex items-center gap-1 bg-black text-white px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-800 transition"
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

      {/* Modal เลือกห้อง */}
      {showRoomModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <h3 className="text-lg font-bold text-gray-800 border-b pb-3">เลือกห้องเรียนที่ต้องการตรวจ</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">ระดับชั้น</label>
                <div className="grid grid-cols-3 gap-2">
                  {classes.map(c => (
                    <button key={c} onClick={() => setSelectedClass(c)} className={`py-2 text-sm font-semibold rounded-lg border ${selectedClass === c ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">ห้องเรียน</label>
                <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1">
                  {rooms.map(r => (
                    <button key={r} onClick={() => setSelectedRoom(r)} className={`py-2 text-sm font-semibold rounded-lg border ${selectedRoom === r ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>{r}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={() => setShowRoomModal(false)} className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold shadow-md">ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
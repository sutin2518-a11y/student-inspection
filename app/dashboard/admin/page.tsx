'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'
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
  Save,
  BarChart3,
  RefreshCw,
  Calendar,
  Download
} from 'lucide-react'

type StatusType = 'pass' | 'fail' | 'absent' | 'pending'
type CategoryType = 'all' | 'hair' | 'nails' | 'uniform'

interface StudentItemStatus {
  hair: StatusType
  nails: StatusType
  uniform: StatusType
}

interface InspectionMeta {
  attempt_number: number
  is_correction: boolean
  failed_correction_count: number
}

interface Student {
  id: string
  student_id: string
  full_name: string
  class_name: string
  room: number
  number: number
  gender?: string
}

export default function CompleteInspectionPage() {
  const supabase = createClient()
  const router = useRouter()

  const [selectedClass, setSelectedClass] = useState('ม.1')
  const [selectedRoom, setSelectedRoom] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all')
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showBulkDropdown, setShowBulkDropdown] = useState(false)
  
  const [academicYear, setAcademicYear] = useState('2569')
  const [semester, setSemester] = useState('2')
  const [inspectionMonth, setInspectionMonth] = useState(new Date().toISOString().slice(0, 7))

  const [students, setStudents] = useState<Student[]>([])
  const [studentStatuses, setStudentStatuses] = useState<Record<string, StudentItemStatus>>({})
  const [inspectionMetas, setInspectionMetas] = useState<Record<string, InspectionMeta>>({})
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const classes = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']
  const rooms = Array.from({ length: 15 }, (_, i) => i + 1)

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
  }, [selectedClass, selectedRoom, inspectionMonth])

  const fetchStudentsAndInspections = async () => {
    setLoading(true)
    setHasUnsavedChanges(false)

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
    let currentStatuses: Record<string, StudentItemStatus> = {}
    let currentMetas: Record<string, InspectionMeta> = {}

    if (studentIds.length > 0) {
      const { data: inspectionData } = await supabase
        .from('inspections')
        .select('student_id, hair_status, nails_status, uniform_status, status, attempt_number, is_correction')
        .in('student_id', studentIds)
        .eq('inspection_month', inspectionMonth)
        .order('attempt_number', { ascending: false })

      if (inspectionData) {
        studentIds.forEach(id => {
          const studentRecords = inspectionData.filter(item => item.student_id === id)
          if (studentRecords.length > 0) {
            const latest = studentRecords[0]
            const normalize = (st?: string) => (st === 'waive' ? 'absent' : st || 'pending') as StatusType

            currentStatuses[id] = {
              hair: normalize(latest.hair_status),
              nails: normalize(latest.nails_status),
              uniform: normalize(latest.uniform_status)
            }

            const failedCorrections = studentRecords.filter(r => r.is_correction && (r.status === 'fail' || r.status === 'absent')).length

            currentMetas[id] = {
              attempt_number: latest.attempt_number || 1,
              is_correction: latest.is_correction || (latest.status === 'fail' || latest.status === 'absent'),
              failed_correction_count: failedCorrections
            }
          }
        })
      }
    }

    list.forEach(s => {
      if (!currentStatuses[s.id]) {
        currentStatuses[s.id] = { hair: 'pending', nails: 'pending', uniform: 'pending' }
      }
      if (!currentMetas[s.id]) {
        currentMetas[s.id] = { attempt_number: 1, is_correction: false, failed_correction_count: 0 }
      }
    })

    setStudentStatuses(currentStatuses)
    setInspectionMetas(currentMetas)
    setLoading(false)
  }

  // ฟังก์ชันส่งออกไฟล์ Excel (.xlsx)
  const handleExportExcel = () => {
    if (students.length === 0) {
      Swal.fire('ไม่มีข้อมูล', 'ไม่พบรายชื่อนักเรียนสำหรับการส่งออก', 'info')
      return
    }

    const formatTextStatus = (val: StatusType) => {
      if (val === 'pass') return 'ผ่าน'
      if (val === 'fail') return 'ไม่ผ่าน'
      if (val === 'absent') return 'ขาด'
      return 'รอตรวจ'
    }

    const excelRows = students.map((s, idx) => {
      const st = studentStatuses[s.id] || { hair: 'pending', nails: 'pending', uniform: 'pending' }
      const meta = inspectionMetas[s.id] || { attempt_number: 1, is_correction: false, failed_correction_count: 0 }

      let overall: StatusType = 'pass'
      if (st.hair === 'fail' || st.nails === 'fail' || st.uniform === 'fail') overall = 'fail'
      else if (st.hair === 'absent' || st.nails === 'absent' || st.uniform === 'absent') overall = 'absent'
      else if (st.hair === 'pending' || st.nails === 'pending' || st.uniform === 'pending') overall = 'pending'

      return {
        'เลขที่': s.number || idx + 1,
        'รหัสนักเรียน': s.student_id || '',
        'ชื่อ-นามสกุล': s.full_name,
        'ชั้น/ห้อง': `${s.class_name}/${s.room}`,
        'รอบการตรวจ': meta.is_correction ? `ตรวจแก้ไข (ครั้งที่ ${meta.attempt_number})` : 'ตรวจประจำเดือน',
        'จำนวนครั้งที่ไม่ผ่านซ้ำ': meta.failed_correction_count,
        'ทรงผม': formatTextStatus(st.hair),
        'เล็บ': formatTextStatus(st.nails),
        'การแต่งกาย': formatTextStatus(st.uniform),
        'สรุปผลภาพรวม': formatTextStatus(overall)
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(excelRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, `ผลตรวจ_${selectedClass}_${selectedRoom}`)
    
    const fileName = `ผลการตรวจระเบียบ_${selectedClass}_ห้อง${selectedRoom}_เดือน_${inspectionMonth}.xlsx`
    XLSX.writeFile(workbook, fileName)
  }

  const handleSetItemStatus = (studentId: string, category: 'hair' | 'nails' | 'uniform', newStatus: StatusType) => {
    setStudentStatuses(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { hair: 'pending', nails: 'pending', uniform: 'pending' }),
        [category]: newStatus
      }
    }))
    setHasUnsavedChanges(true)
  }

  // 🟢 ฟังก์ชันสำหรับกดวนเปลี่ยนสถานะลูปบนมือถือ (รอตรวจ -> ผ่าน -> ไม่ผ่าน -> ขาด -> ผ่าน)
  const handleCycleStatus = (studentId: string, category: 'hair' | 'nails' | 'uniform') => {
    const current = studentStatuses[studentId]?.[category] || 'pending'
    let next: StatusType = 'pass'

    if (current === 'pending') next = 'pass'
    else if (current === 'pass') next = 'fail'
    else if (current === 'fail') next = 'absent'
    else if (current === 'absent') next = 'pass'

    handleSetItemStatus(studentId, category, next)
  }

  const handleBulkSetStatus = (targetStatus: StatusType) => {
    setShowBulkDropdown(false)
    const updated = { ...studentStatuses }
    
    students.forEach(s => {
      const current = updated[s.id] || { hair: 'pending', nails: 'pending', uniform: 'pending' }
      if (selectedCategory === 'all') {
        updated[s.id] = { hair: targetStatus, nails: targetStatus, uniform: targetStatus }
      } else {
        updated[s.id] = { ...current, [selectedCategory]: targetStatus }
      }
    })

    setStudentStatuses(updated)
    setHasUnsavedChanges(true)
  }

  const handleAddFailedCorrection = async (studentId: string, studentName: string) => {
    const meta = inspectionMetas[studentId] || { attempt_number: 1, is_correction: false, failed_correction_count: 0 }
    const nextAttempt = meta.attempt_number + 1

    const result = await Swal.fire({
      title: 'ยืนยันตรวจแก้ไขไม่ผ่าน',
      text: `ต้องการบันทึกว่า "${studentName}" ตรวจแก้ไขแล้วยังไม่ผ่าน (ครั้งที่ ${nextAttempt}) ใช่หรือไม่?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'ใช่, บันทึกไม่ผ่าน',
      cancelButtonText: 'ยกเลิก'
    })

    if (result.isConfirmed) {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      const today = new Date().toISOString().split('T')[0]

      const { error } = await supabase
        .from('inspections')
        .upsert({
          student_id: studentId,
          inspector_id: user?.id,
          teacher_id: user?.id,
          status: 'fail',
          hair_status: 'fail',
          nails_status: 'fail',
          uniform_status: 'fail',
          inspection_date: today,
          inspection_month: inspectionMonth,
          academic_year: academicYear,
          semester: semester,
          attempt_number: nextAttempt,
          is_correction: true,
          is_resolved: false
        }, { onConflict: 'student_id, inspection_date, attempt_number' })

      setSaving(false)

      if (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error')
      } else {
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสถิติสำเร็จ',
          text: `เพิ่มสถิติตรวจแก้ไขไม่ผ่านของ ${studentName} เป็นครั้งที่ ${nextAttempt} แล้ว`,
          timer: 1200,
          showConfirmButton: false
        })
        fetchStudentsAndInspections()
      }
    }
  }

  const handleSaveAll = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]

    const toDbStatus = (st: StatusType) => (st === 'absent' ? 'waive' : st)

    const payload = students.map(s => {
      const st = studentStatuses[s.id] || { hair: 'pending', nails: 'pending', uniform: 'pending' }
      const meta = inspectionMetas[s.id] || { attempt_number: 1, is_correction: false, failed_correction_count: 0 }
      
      let overall: StatusType = 'pass'
      if (st.hair === 'fail' || st.nails === 'fail' || st.uniform === 'fail') overall = 'fail'
      else if (st.hair === 'absent' || st.nails === 'absent' || st.uniform === 'absent') overall = 'absent'
      else if (st.hair === 'pending' || st.nails === 'pending' || st.uniform === 'pending') overall = 'pending'

      const isCorrectionCheck = meta.is_correction || overall === 'fail' || overall === 'absent'
      const newAttemptNumber = isCorrectionCheck && overall === 'pass' ? meta.attempt_number + 1 : meta.attempt_number

      return {
        student_id: s.id,
        inspector_id: user?.id,
        teacher_id: user?.id,
        hair_status: toDbStatus(st.hair),
        nails_status: toDbStatus(st.nails),
        uniform_status: toDbStatus(st.uniform),
        status: toDbStatus(overall),
        inspection_date: today,
        inspection_month: inspectionMonth,
        academic_year: academicYear,
        semester: semester,
        attempt_number: newAttemptNumber,
        is_correction: isCorrectionCheck,
        is_resolved: isCorrectionCheck && overall === 'pass'
      }
    })

    const { error } = await supabase
      .from('inspections')
      .upsert(payload, { onConflict: 'student_id, inspection_date, attempt_number' })

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
        text: `บันทึกผลการตรวจประจำเดือน ${inspectionMonth} ห้อง ${selectedClass}/${selectedRoom} เรียบร้อยแล้ว`,
        timer: 1300,
        showConfirmButton: false
      })
      fetchStudentsAndInspections()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const inspectedCount = students.filter(s => {
    const st = studentStatuses[s.id]
    if (!st) return false
    return st.hair !== 'pending' || st.nails !== 'pending' || st.uniform !== 'pending'
  }).length

  // 🟢 Component ปุ่มเลือกสถานะ ปรับแบบ Responsive (Desktop = 3 ปุ่มแยก, Mobile = ปุ่มเดี่ยววนลูป)
  const renderItemControl = (studentId: string, catKey: 'hair' | 'nails' | 'uniform') => {
    const status = studentStatuses[studentId]?.[catKey] || 'pending'

    return (
      <div className="flex flex-col items-center justify-center py-1">
        
        {/* --- DESKTOP VIEW (md:flex) --- */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          {status === 'pass' && <span className="bg-[#16a34a] text-white text-[11px] px-2.5 py-0.5 rounded-md font-bold">ผ่าน</span>}
          {status === 'fail' && <span className="bg-[#dc2626] text-white text-[11px] px-2.5 py-0.5 rounded-md font-bold">ไม่ผ่าน</span>}
          {status === 'absent' && <span className="bg-[#d97706] text-white text-[11px] px-2.5 py-0.5 rounded-md font-bold">ขาด</span>}
          {status === 'pending' && <span className="bg-gray-200 text-gray-600 text-[11px] px-2.5 py-0.5 rounded-md font-bold">รอตรวจ</span>}

          <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button 
              onClick={() => handleSetItemStatus(studentId, catKey, 'pass')} 
              className={`p-1 rounded-md transition ${status === 'pass' ? 'bg-[#16a34a] text-white' : 'bg-white text-[#16a34a] border border-gray-200 hover:bg-emerald-50'}`}
              title="ผ่าน"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
            <button 
              onClick={() => handleSetItemStatus(studentId, catKey, 'fail')} 
              className={`p-1 rounded-md transition ${status === 'fail' ? 'bg-[#dc2626] text-white' : 'bg-white text-[#dc2626] border border-gray-200 hover:bg-rose-50'}`}
              title="ไม่ผ่าน"
            >
              <X className="w-3.5 h-3.5 stroke-[3]" />
            </button>
            <button 
              onClick={() => handleSetItemStatus(studentId, catKey, 'absent')} 
              className={`p-1 rounded-md transition ${status === 'absent' ? 'bg-[#d97706] text-white' : 'bg-white text-[#d97706] border border-gray-200 hover:bg-amber-50'}`}
              title="ขาดเรียน"
            >
              <UserX className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* --- MOBILE VIEW (md:hidden) : ปุ่มเดี่ยวสำหรับกดวนเปลี่ยนสถานะ --- */}
        <button
          onClick={() => handleCycleStatus(studentId, catKey)}
          className={`md:hidden px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer ${
            status === 'pass' ? 'bg-[#16a34a] text-white ring-2 ring-emerald-600/20' :
            status === 'fail' ? 'bg-[#dc2626] text-white ring-2 ring-rose-600/20' :
            status === 'absent' ? 'bg-[#d97706] text-white ring-2 ring-amber-600/20' :
            'bg-gray-100 text-gray-700 border border-gray-300'
          }`}
          title="กดเพื่อวนเปลี่ยนสถานะ"
        >
          {status === 'pass' && <><Check className="w-3.5 h-3.5 stroke-[3]" /><span>ผ่าน</span></>}
          {status === 'fail' && <><X className="w-3.5 h-3.5 stroke-[3]" /><span>ไม่ผ่าน</span></>}
          {status === 'absent' && <><UserX className="w-3.5 h-3.5 stroke-[2.5]" /><span>ขาด</span></>}
          {status === 'pending' && <><RotateCcw className="w-3.5 h-3.5 text-gray-500" /><span>รอตรวจ</span></>}
        </button>

      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#38bdf8]/20 pb-12 font-sans">
      {/* Header */}
      <div className="max-w-6xl mx-auto pt-4 px-4">
        <header className="bg-[#1d4ed8] text-white px-6 py-4 rounded-2xl shadow-lg flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl shrink-0">
              <ShieldCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-extrabold tracking-tight leading-snug">ระบบตรวจระเบียบนักเรียน</h1>
              <p className="text-xs text-blue-200">ปีการศึกษา {academicYear} ภาคเรียนที่ {semester}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* 🟢 ซ่อนปุ่มสถิติสะสม บนมือถือ (แสดงเฉพาะหน้าจอ md ขึ้นไป) */}
            <button 
              onClick={() => router.push('/dashboard/admin/stats')}
              className="hidden md:flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 rounded-lg text-sm font-bold transition"
            >
              <BarChart3 size={16} /> สถิติสะสม
            </button>

            {/* 🟢 ซ่อนปุ่มออกจากระบบ บนมือถือ (แสดงเฉพาะหน้าจอ md ขึ้นไป) */}
            <button 
              onClick={handleLogout}
              className="hidden md:flex items-center gap-1.5 text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-sm font-medium transition"
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
        {/* การ์ดจัดการห้อง + ปุ่มการทำงาน */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3 w-full">
          
          {/* ฝั่งซ้าย: ข้อมูลห้อง + เลือกเดือน + เลือกหมวดหมู่ */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-gray-800 font-bold text-base md:text-lg">
              <Users className="w-5 h-5 text-blue-600" />
              <span>ห้อง: <span className="text-blue-600">{selectedClass}/{selectedRoom}</span></span>
              <span className="text-sm font-normal text-gray-500">
                ({inspectedCount} / {students.length} คน)
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>รอบเดือน:</span>
              <input
                type="month"
                value={inspectionMonth}
                onChange={(e) => setInspectionMonth(e.target.value)}
                className="bg-transparent font-bold outline-none cursor-pointer text-blue-800"
              />
            </div>

            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as CategoryType)}
                className="appearance-none bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-sm px-3.5 py-1.5 pr-8 rounded-xl border border-blue-200 outline-none cursor-pointer transition"
              >
                <option value="all">📋 รายการ: ทุกรายการ (ภาพรวม)</option>
                <option value="hair">✂️ รายการ: ทรงผม</option>
                <option value="nails">✨ รายการ: เล็บ</option>
                <option value="uniform">👔 รายการ: การแต่งกาย</option>
              </select>
              <ChevronDown className="w-4 h-4 text-blue-700 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {hasUnsavedChanges && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                • ยังไม่ได้บันทึก
              </span>
            )}
          </div>

          {/* กลุ่มปุ่มจัดการห้อง */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowBulkDropdown(!showBulkDropdown)}
                disabled={saving || students.length === 0}
                className="flex items-center gap-2 bg-[#16a34a] hover:bg-[#15803d] text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                <span>เลือกการประเมิน</span>
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

            <button
              onClick={handleSaveAll}
              disabled={saving || students.length === 0}
              className={`flex items-center gap-1.5 text-white px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold shadow-md transition active:scale-95 disabled:opacity-50 ${
                hasUnsavedChanges 
                  ? 'bg-blue-600 hover:bg-blue-700 ring-4 ring-blue-300/50' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</span>
            </button>

            <button
              onClick={() => setShowRoomModal(true)}
              className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" /> เปลี่ยนห้อง
            </button>
          </div>

          {/* 🟢 ซ่อนปุ่มส่งออก Excel บนมือถือ (แสดงเฉพาะหน้าจอ md ขึ้นไป) */}
          <button
            onClick={handleExportExcel}
            disabled={loading || students.length === 0}
            className="hidden md:flex ml-auto items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition active:scale-95 disabled:opacity-50 ring-2 ring-emerald-600/20"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออก Excel</span>
          </button>
        </div>

        {/* ตารางแสดงรายชื่อนักเรียน */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">กำลังดึงข้อมูลรายชื่อนักเรียน...</div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-gray-400">ไม่พบข้อมูลนักเรียนในห้อง {selectedClass}/{selectedRoom}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-800 font-bold text-xs md:text-sm border-b border-gray-200">
                    <th className="py-3 px-2 md:py-4 md:px-4 text-center w-12 md:w-16">เลขที่</th>
                    <th className="py-3 px-3 md:py-4 md:px-4 min-w-[140px] md:min-w-[180px]">ชื่อ-สกุล</th>
                    <th className="py-3 px-2 md:py-4 md:px-4 text-center w-32 md:w-40">รอบการตรวจ</th>
                    
                    {selectedCategory === 'all' ? (
                      <>
                        <th className="py-3 px-2 md:py-4 md:px-4 text-center min-w-[90px] md:min-w-[140px]">✂️ ทรงผม</th>
                        <th className="py-3 px-2 md:py-4 md:px-4 text-center min-w-[90px] md:min-w-[140px]">✨ เล็บ</th>
                        <th className="py-3 px-2 md:py-4 md:px-4 text-center min-w-[90px] md:min-w-[140px]">👔 การแต่งกาย</th>
                        <th className="py-3 px-2 md:py-4 md:px-4 text-center w-16 md:w-24">AI</th>
                      </>
                    ) : (
                      <>
                        <th className="py-3 px-4 md:py-4 md:px-6 text-center w-28 md:w-32">สถานะ</th>
                        <th className="py-3 px-4 md:py-4 md:px-6 text-center w-40 md:w-60">จัดการ</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs md:text-sm">
                  {students.map((student, idx) => {
                    const isEven = idx % 2 === 1
                    const meta = inspectionMetas[student.id] || { attempt_number: 1, is_correction: false, failed_correction_count: 0 }

                    return (
                      <tr key={student.id} className={`transition hover:bg-blue-50/40 ${isEven ? 'bg-gray-50/60' : 'bg-white'}`}>
                        <td className="py-3 px-2 md:py-3.5 md:px-4 text-center font-bold text-gray-800">
                          {student.number || idx + 1}
                        </td>

                        <td className="py-3 px-3 md:py-3.5 md:px-4">
                          <div className="font-bold text-gray-900 text-sm md:text-base">{student.full_name}</div>
                          <div className="text-[10px] md:text-xs text-gray-500 mt-0.5 font-medium">
                            {student.student_id || '-'} | {student.gender || (student.full_name.startsWith('เด็กหญิง') || student.full_name.startsWith('นางสาว') ? 'หญิง' : 'ชาย')}
                          </div>
                        </td>

                        <td className="py-3 px-2 md:py-3.5 md:px-4 text-center">
                          {meta.is_correction ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="bg-amber-100 text-amber-800 text-[10px] md:text-[11px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 text-amber-700" />
                                ตรวจแก้ไข ({meta.attempt_number})
                              </span>
                              
                              <button
                                onClick={() => handleAddFailedCorrection(student.id, student.full_name)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-800 text-[9px] md:text-[10px] px-2 py-0.5 rounded-full font-extrabold border border-rose-300 shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer"
                                title="กดเพื่อบันทึกว่ามาตรวจแก้ไขแล้วแต่ยังไม่ผ่าน"
                              >
                                <span>⚠️ ไม่ผ่านซ้ำ (+1 แก้ไข)</span>
                              </button>
                            </div>
                          ) : (
                            <span className="inline-block bg-blue-50 text-blue-700 text-[10px] md:text-[11px] px-2 py-0.5 rounded-md font-bold">
                              ประจำเดือน
                            </span>
                          )}
                        </td>

                        {selectedCategory === 'all' ? (
                          <>
                            <td className="py-3 px-2 md:py-3.5 md:px-4 text-center">{renderItemControl(student.id, 'hair')}</td>
                            <td className="py-3 px-2 md:py-3.5 md:px-4 text-center">{renderItemControl(student.id, 'nails')}</td>
                            <td className="py-3 px-2 md:py-3.5 md:px-4 text-center">{renderItemControl(student.id, 'uniform')}</td>
                            <td className="py-3 px-2 md:py-3.5 md:px-4 text-center">
                              <button 
                                onClick={() => Swal.fire({ title: 'ระบบตรวจด้วย AI', text: `กำลังเตรียมเปิดกล้องสำหรับ ${student.full_name}`, icon: 'info' })} 
                                className="inline-flex items-center gap-1 bg-black text-white px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold hover:bg-gray-800 transition"
                              >
                                <Camera className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                <span>AI</span>
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4 md:py-3.5 md:px-6 text-center">
                              {studentStatuses[student.id]?.[selectedCategory] === 'pass' && <span className="inline-block bg-[#16a34a] text-white text-xs px-2.5 py-0.5 rounded-lg font-bold shadow-sm">ผ่าน</span>}
                              {studentStatuses[student.id]?.[selectedCategory] === 'fail' && <span className="inline-block bg-[#dc2626] text-white text-xs px-2.5 py-0.5 rounded-lg font-bold shadow-sm">ไม่ผ่าน</span>}
                              {studentStatuses[student.id]?.[selectedCategory] === 'absent' && <span className="inline-block bg-[#d97706] text-white text-xs px-2.5 py-0.5 rounded-lg font-bold shadow-sm">ขาด</span>}
                              {(!studentStatuses[student.id]?.[selectedCategory] || studentStatuses[student.id]?.[selectedCategory] === 'pending') && <span className="inline-block bg-gray-200 text-gray-600 text-xs px-2.5 py-0.5 rounded-lg font-bold">รอตรวจ</span>}
                            </td>

                            <td className="py-3 px-4 md:py-3.5 md:px-6 text-center">
                              <div className="inline-flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                                <button 
                                  onClick={() => handleSetItemStatus(student.id, selectedCategory, 'pass')} 
                                  className={`p-1.5 rounded-lg transition ${studentStatuses[student.id]?.[selectedCategory] === 'pass' ? 'bg-[#16a34a] text-white shadow-sm' : 'bg-white text-[#16a34a] border border-gray-200 hover:bg-emerald-50'}`}
                                  title="ผ่าน"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <button 
                                  onClick={() => handleSetItemStatus(student.id, selectedCategory, 'fail')} 
                                  className={`p-1.5 rounded-lg transition ${studentStatuses[student.id]?.[selectedCategory] === 'fail' ? 'bg-[#dc2626] text-white shadow-sm' : 'bg-white text-[#dc2626] border border-gray-200 hover:bg-rose-50'}`}
                                  title="ไม่ผ่าน"
                                >
                                  <X className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <button 
                                  onClick={() => handleSetItemStatus(student.id, selectedCategory, 'absent')} 
                                  className={`p-1.5 rounded-lg transition ${studentStatuses[student.id]?.[selectedCategory] === 'absent' ? 'bg-[#d97706] text-white shadow-sm' : 'bg-white text-[#d97706] border border-gray-200 hover:bg-amber-50'}`}
                                  title="ขาดเรียน"
                                >
                                  <UserX className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                                <button 
                                  onClick={() => Swal.fire({ title: 'ระบบตรวจด้วย AI', text: `กำลังเตรียมเปิดกล้องสำหรับ ${student.full_name}`, icon: 'info' })} 
                                  className="flex items-center gap-1 bg-black text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-800 transition"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>AI</span>
                                </button>
                              </div>
                            </td>
                          </>
                        )}
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
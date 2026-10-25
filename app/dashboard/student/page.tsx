'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { LogOut, CheckCircle, XCircle, Clock } from 'lucide-react'

type InspectionStatus = 'pass' | 'fail' | 'pending'

interface InspectionItem {
  id: string
  student_id: string
  inspector_id: string
  hair_status: InspectionStatus
  nails_status: InspectionStatus
  uniform_status: InspectionStatus
  inspection_date: string
  created_at: string
}

export default function StudentDashboard() {
  const supabase = createClient()
  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)
  const [history, setHistory] = useState<InspectionItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStudentData()
  }, [])

  const fetchStudentData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push('/login')
      return
    }

    // 1. ดึง Profile ของนักเรียน (ใช้ maybeSingle ป้องกัน 406 Error)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      
    setProfile(profileData)

    // 2. ดึงประวัติการตรวจ เรียงตามวันที่ล่าสุด
    const { data: inspectionsData } = await supabase
      .from('inspections')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })

    setHistory((inspectionsData as InspectionItem[]) || [])
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // แปลงวันที่เป็นรูปแบบไทย
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return dateString
    }
  }

  // แสดง Badge สถานะรายรายการ
  const renderItemBadge = (label: string, status: InspectionStatus) => {
    if (status === 'pass') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          {label}: ผ่าน
        </span>
      )
    }
    if (status === 'fail') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          {label}: ไม่ผ่าน
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        {label}: รอตรวจ
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-6">
      {/* ส่วนหัวแสดงข้อมูลนักเรียน */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800">ผลการตรวจเครื่องแต่งกาย</h1>
          {profile ? (
            <p className="text-sm text-gray-500 mt-1">
              ชื่อ: <span className="font-semibold text-gray-700">{profile.full_name}</span> | 
              ชั้น: <span className="font-semibold text-gray-700">{profile.class_name || profile.grade}/{profile.room}</span> | 
              รหัส: <span className="font-mono text-gray-700">{profile.student_id || '-'}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400">กำลังโหลดข้อมูลโปรไฟล์...</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <LogOut size={16} /> ออกจากระบบ
        </button>
      </div>

      {/* ส่วนแสดงประวัติการตรวจ */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-700 mb-4">ประวัติการตรวจทั้งหมด</h2>
        
        {loading ? (
          <p className="text-center text-gray-400 py-12 text-sm">กำลังโหลดประวัติการตรวจ...</p>
        ) : history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item) => {
              // คำนวณผลสรุปรวมของการตรวจครั้งนี้
              const isAllPass = item.hair_status === 'pass' && item.nails_status === 'pass' && item.uniform_status === 'pass'
              const hasFail = item.hair_status === 'fail' || item.nails_status === 'fail' || item.uniform_status === 'fail'

              return (
                <div
                  key={item.id}
                  className="p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50 hover:bg-white transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {isAllPass ? (
                        <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                          <CheckCircle size={18} /> ผ่านระเบียบทั้งหมด
                        </span>
                      ) : hasFail ? (
                        <span className="flex items-center gap-1 text-rose-600 font-bold text-sm">
                          <XCircle size={18} /> ไม่ผ่านระเบียบ (มีรายการต้องแก้ไข)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 font-bold text-sm">
                          <Clock size={18} /> รอการตรวจ
                        </span>
                      )}
                      
                      <span className="text-xs text-gray-400 border-l pl-2">
                        วันที่ตรวจ: {formatDate(item.inspection_date || item.created_at)}
                      </span>
                    </div>

                    {/* รายละเอียดการตรวจ 3 รายการ */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {renderItemBadge('ทรงผม', item.hair_status)}
                      {renderItemBadge('เล็บ', item.nails_status)}
                      {renderItemBadge('เครื่องแต่งกาย', item.uniform_status)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-12 text-sm">
            ยังไม่มีประวัติการตรวจเครื่องแต่งกาย
          </div>
        )}
      </div>
    </div>
  )
}
'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { LogOut, CheckCircle, XCircle } from 'lucide-react'

export default function StudentDashboard() {
  const supabase = createClient()
  const router = useRouter()

  const [profile, setProfile] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    fetchStudentData()
  }, [])

  const fetchStudentData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // ดึง Profile ของนักเรียน
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setProfile(profileData)

    // ดึงประวัติการตรวจ
    const { data: inspectionsData } = await supabase
      .from('inspections')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false })
    setHistory(inspectionsData || [])
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // แปลงวันที่ปลอดภัยสำหรับ SSR / Client Prerender
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleDateString('th-TH')
    } catch {
      return dateString
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">ผลการตรวจเครื่องแต่งกาย</h1>
          {profile && (
            <p className="text-sm text-gray-500">
              ชื่อ: {profile.full_name} | ชั้น: {profile.grade}/{profile.room} | รหัส: {profile.student_id || '-'}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm transition"
        >
          <LogOut size={16} /> ออกจากระบบ
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-700 mb-4">ประวัติการตรวจทั้งหมด</h2>
        {history.length > 0 ? (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-4 border rounded-xl flex items-start justify-between bg-gray-50 hover:bg-white transition"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {item.status === 'pass' ? (
                      <span className="flex items-center gap-1 text-green-600 font-bold text-sm">
                        <CheckCircle size={18} /> ผ่านระเบียบ
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 font-bold text-sm">
                        <XCircle size={18} /> ไม่ผ่านระเบียบ (ต้องแก้ไข)
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      | เดือน: {item.inspection_month || '-'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    <strong className="text-gray-700">หมายเหตุ:</strong> {item.notes || 'ไม่มีหมายเหตุเพิ่มเติม'}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {formatDate(item.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8 text-sm">ยังไม่มีประวัติการตรวจเครื่องแต่งกาย</p>
        )}
      </div>
    </div>
  )
}
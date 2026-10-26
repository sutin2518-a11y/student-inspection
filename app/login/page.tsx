'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Swal from 'sweetalert2'
import { ShieldCheck, User, Lock, Eye, EyeOff, LogIn } from 'lucide-react'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [usernameInput, setUsernameInput] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usernameInput || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'กรอกข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกชื่อผู้ใช้งาน/รหัสนักเรียน และรหัสผ่าน',
        confirmButtonColor: '#1d4ed8'
      })
      return
    }

    setLoading(true)

    // เติม @chiangkham.ac.th อัตโนมัติถ้าผู้ใช้ไม่ได้พิมพ์ @
    let formattedEmail = usernameInput.trim()
    if (!formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@chiangkham.ac.th`
    }

    // 1. ล็อกอินด้วย Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: formattedEmail,
      password,
    })

    if (authError) {
      setLoading(false)
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: 'รหัสนักเรียน/ชื่อผู้ใช้ หรือรหัสผ่านไม่ถูกต้อง',
        confirmButtonColor: '#1d4ed8'
      })
      return
    }

    const userId = authData.user?.id

    // 2. ดึงข้อมูลบทบาท (Role) จากตาราง profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .maybeSingle()

    setLoading(false)

    Swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: `ยินดีต้อนรับ ${profile?.full_name || ''}`,
      timer: 1200,
      showConfirmButton: false
    })

    // 3. Routing แยกตามบทบาทไปยังโฟลเดอร์ที่ถูกต้อง
    const userRole = profile?.role || 'teacher'
    if (userRole === 'admin') {
      router.push('/dashboard/admin')
    } else if (userRole === 'teacher') {
      router.push('/dashboard/admin') // หรือ /dashboard/teacher
    } else {
      router.push('/student')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-blue-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#1d4ed8] p-8 text-white text-center space-y-3">
          <div className="inline-flex bg-white/20 p-3.5 rounded-2xl backdrop-blur-md shadow-inner">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">ระบบตรวจทรงผมนักเรียน</h1>
          <p className="text-xs text-blue-100 font-medium">โรงเรียนเชียงคำวิทยาคม</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="p-6 md:p-8 space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              รหัสนักเรียน / ชื่อผู้ใช้งานครู
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                placeholder="เช่น 34807 หรือ sutin"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              * ไม่ต้องพิมพ์ @chiangkham.ac.th ระบบจะเติมให้อัตโนมัติ
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wider">
              รหัสผ่าน
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-600 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 transition"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-[#1d4ed8] hover:bg-blue-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <span className="text-sm">กำลังตรวจสอบข้อมูล...</span>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>เข้าสู่ระบบ</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  )
}
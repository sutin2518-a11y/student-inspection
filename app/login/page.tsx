'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import Swal from 'sweetalert2'

export default function LoginPage() {
  const [inputIdentifier, setInputIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // ตรวจสอบหากไม่ได้ใส่ @ ให้เติม @chiangkham.ac.th ต่อท้ายอัตโนมัติ
    let formattedEmail = inputIdentifier.trim()
    if (!formattedEmail.includes('@')) {
      formattedEmail = `${formattedEmail}@chiangkham.ac.th`
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: formattedEmail,
      password,
    })

    if (error) {
      setLoading(false)
      Swal.fire({
        icon: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: 'กรุณาตรวจสอบรหัสประจำตัว/อีเมล หรือรหัสผ่านอีกครั้ง',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'ตกลง'
      })
      return
    }

    // ดึงสิทธิ์ผู้ใช้ (Role) จากตาราง profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    setLoading(false)

    Swal.fire({
      icon: 'success',
      title: 'เข้าสู่ระบบสำเร็จ',
      text: 'กำลังนำท่านเข้าสู่ระบบ...',
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      if (profile?.role === 'admin' || profile?.role === 'teacher') {
        router.push('/dashboard/admin')
      } else {
        router.push('/dashboard/student')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-indigo-800 to-slate-900 p-4">
      <div className="bg-white/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ระบบตรวจเครื่องแต่งกาย</h1>
          <p className="text-sm text-gray-500 mt-1">โรงเรียนเชียงคำวิทยาคม</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสนักเรียน / บัญชีครู
            </label>
            <input
              type="text"
              required
              placeholder="เช่น 12345 หรือ somchai"
              value={inputIdentifier}
              onChange={(e) => setInputIdentifier(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition text-gray-900 bg-white shadow-sm"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              *พิมพ์เฉพาะรหัสนักเรียน 5 หลัก หรือชื่อครูภาษาอังกฤษ (ระบบต่อท้าย @chiangkham.ac.th ให้อัตโนมัติ)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition text-gray-900 bg-white shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}
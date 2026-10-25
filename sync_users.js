import { createClient } from '@supabase/supabase-js'

// การตั้งค่า Supabase URL และ Service Role Key สำหรับสิทธิ์แอดมิน
const supabaseUrl = 'https://lhmawflpspgezvgoughs.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxobWF3Zmxwc3BnZXp2Z291Z2hzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjkyOTM2NCwiZXhwIjoyMTA4NTA1MzY0fQ.goNwPfK1rwY0SfOTlgCAm3FginpsdsLbWwxVO7aLVl4'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function syncUsers() {
  console.log('========================================')
  console.log('เริ่มต้นการดึงข้อมูลจากตาราง profiles ทั้งหมด...')
  
  let allProfiles = []
  let start = 0
  const step = 1000
  let hasMore = true

  // 1. ดึงข้อมูลแบบ Batching ทีละ 1,000 รายการเพื่อก้าวข้ามขีดจำกัด 1,000 แถว
  while (hasMore) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .range(start, start + step - 1)
    
    if (error) {
      console.error('เกิดข้อผิดพลาดในการดึงข้อมูล profiles:', error.message)
      return
    }

    if (data && data.length > 0) {
      allProfiles = allProfiles.concat(data)
      console.log(`- ดึงข้อมูลแล้ว ${allProfiles.length} รายการ...`)
      start += step
    } else {
      hasMore = false
    }
  }

  console.log('========================================')
  console.log(`ดึงข้อมูลสำเร็จ! รวมทั้งหมด ${allProfiles.length} รายการ`)
  console.log('กำลังเริ่มสร้าง/อัปเดตบัญชีผู้ใช้เข้าระบบ Auth...')
  console.log('========================================')

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  // 2. วนลูปสร้างบัญชีเข้าสู่ระบบ auth.users
  for (let i = 0; i < allProfiles.length; i++) {
    const user = allProfiles[i]

    // หากไม่มีอีเมลให้ข้ามไป
    if (!user.email) {
      skipCount++
      continue
    }

    // สร้างผู้ใช้ในระบบ Auth
    const { error: authError } = await supabase.auth.admin.createUser({
      user_id: user.id,
      email: user.email,
      password: '123456',
      email_confirm: true,
      user_metadata: {
        full_name: user.full_name,
        role: user.role,
        student_id: user.student_id,
        class_name: user.class_name,
        room: user.room,
        number: user.number
      }
    })

    if (!authError) {
      successCount++
    } else {
      // หากบัญชีมีอยู่แล้วในระบบ ให้ทำการอัปเดตรหัสผ่านเป็น 123456
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: '123456',
        email_confirm: true
      })

      if (!updateError) {
        successCount++
      } else {
        errorCount++
        console.error(`[${i + 1}/${allProfiles.length}] ข้อผิดพลาดกับ ${user.email}:`, updateError.message)
      }
    }

    // แสดงความคืบหน้าใน Terminal ทุกๆ 200 รายการ
    if ((i + 1) % 200 === 0 || i === allProfiles.length - 1) {
      console.log(`กำลังดำเนินการ: ${i + 1} / ${allProfiles.length} รายการ...`)
    }
  }

  console.log('========================================')
  console.log('สรุปผลการทำงาน:')
  console.log(`- สำเร็จ/อัปเดต: ${successCount} รายการ`)
  console.log(`- ข้าม (ไม่มีอีเมล): ${skipCount} รายการ`)
  console.log(`- ข้อผิดพลาด: ${errorCount} รายการ`)
  console.log('========================================')
}

syncUsers()
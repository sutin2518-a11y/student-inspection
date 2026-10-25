import pandas as pd
import requests

# --- ตั้งค่าข้อมูล Supabase ของคุณ ---
SUPABASE_URL = "https://lhmawflpspgezvgoughs.supabase.co"  # ใส่ URL โปรเจกต์ Supabase
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxobWF3Zmxwc3BnZXp2Z291Z2hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI5MjkzNjQsImV4cCI6MjEwODUwNTM2NH0.FekPkhEvPPYKc5KQ_rG00Diddx1OiYOJ-G23uJ2KIhQ"             # ใส่ Service Role Key (จาก Project Settings -> API)

headers = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}

# 1. โหลดข้อมูลจากไฟล์ CSV
df_students = pd.read_csv("ข้อมูลนักเรียน - ชีต1.csv")
df_teachers = pd.read_csv("ข้อมูลครู.csv")

# 2. นำเข้านักเรียน (2,682 คน)
print("กำลังนำเข้าข้อมูลนักเรียน...")
for idx, row in df_students.iterrows():
    student_id = str(row['รหัสนักเรียน']).strip()
    email = f"{student_id}@chiangkham.ac.th"
    password = student_id  # กำหนดรหัสผ่านเริ่มต้นเป็นรหัสนักเรียน 5 หลัก

    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "full_name": str(row['ชื่อ สกุล']).strip(),
            "student_id": student_id,
            "class_name": str(row['ระดับชั้น']).strip(),
            "room": int(row['ห้อง']),
            "number": int(row['เลขที่']),
            "gender": str(row['เพศ']).strip()
        }
    }

    res = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=headers, json=payload)
    if idx % 200 == 0:
        print(f"นำเข้านักเรียนแล้ว {idx}/{len(df_students)} คน...")

# 3. นำเข้าครู (143 คน)
print("\nกำลังนำเข้าข้อมูลครู...")
teacher_credentials = []

for idx, row in df_teachers.iterrows():
    name = str(row['ชื่อ-สกุล']).strip()
    dept = str(row['กลุ่มสาระการเรียนรู้']).strip()
    
    # กำหนด Username สำหรับครูเป็น t001 ถึง t143
    teacher_username = f"t{idx+1:03d}"
    email = f"{teacher_username}@chiangkham.ac.th"
    password = "password123"  # รหัสผ่านเริ่มต้นสำหรับครู

    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "full_name": name,
            "department": dept
        }
    }

    res = requests.post(f"{SUPABASE_URL}/auth/v1/admin/users", headers=headers, json=payload)
    if res.status_code in [200, 201]:
        teacher_credentials.append({
            "ชื่อ-สกุล": name, 
            "กลุ่มสาระ": dept, 
            "Username": teacher_username, 
            "Password": password
        })

# ส่งออกรายชื่อและรหัสผ่านครูไว้ใช้งาน
df_out = pd.DataFrame(teacher_credentials)
df_out.to_csv("รายการเข้าใช้งานครู.csv", index=False, encoding='utf-8-sig')
print("\nนำเข้าบัญชีทั้งหมดเรียบร้อยแล้ว! ไฟล์ 'รายการเข้าใช้งานครู.csv' ถูกสร้างขึ้นเพื่อแจกจ่ายครู")
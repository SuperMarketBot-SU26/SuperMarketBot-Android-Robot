const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') || '';

export interface FaceLoginResult {
  success: boolean;
  message: string | null;
  greeting: string | null;
  token: {
    accessToken: string;
    refreshToken: string;
    userId: number | string;
    email: string;
    fullName: string | null;
    roles: string[];
  } | null;
  member: {
    memberId: number | string;
    fullName: string | null;
    email: string;
    phone: string | null;
    membershipLevel: string | null;
  } | null;
}

export async function loginFace(imageBase64: string): Promise<FaceLoginResult> {
  console.log(`[AuthService.loginFace] Bắt đầu gọi API: ${BASE_URL}/api/auth/face-login`);
  const response = await fetch(`${BASE_URL}/api/auth/face-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });

  console.log(`[AuthService.loginFace] HTTP Status: ${response.status}`);

  if (!response.ok) {
    const rawText = await response.text().catch(() => '');
    console.warn(`[AuthService.loginFace] Lỗi API (${response.status}):`, rawText);
    let errorData: any = {};
    try { errorData = JSON.parse(rawText); } catch { /* ignore */ }
    throw new Error(errorData.detail || errorData.title || errorData.message || 'Lỗi kết nối server');
  }

  const data = await response.json();
  console.log(`[AuthService.loginFace] Phản hồi thành công:`, JSON.stringify(data, null, 2));
  return data;
}

import { verifyOTP } from '@/lib/simple-auth';
import { requireNonProductionFeature } from '@/app/api/utils/runtime-flags';

export async function POST(request) {
  try {
    const disabled = requireNonProductionFeature('ENABLE_INSECURE_MOCK_OTP');
    if (disabled) return disabled;

    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return Response.json(
        { error: 'Numéro et OTP requis' },
        { status: 400 }
      );
    }

    const result = await verifyOTP(phone, otp);

    return Response.json(result);
  } catch (error) {
    console.error('Verify OTP API error:', error);
    return Response.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

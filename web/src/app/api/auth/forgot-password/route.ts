import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success even if user doesn't exist to prevent email enumeration
      return NextResponse.json({ message: 'If an account with that email exists, we have sent a password reset link.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await prisma.user.update({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    await sendEmail(
      email,
      'Password Reset Request',
      `You requested a password reset. Please click the following link to reset your password: ${resetUrl}`,
      `<p>You requested a password reset.</p><p>Please click the following link to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
    );

    return NextResponse.json({ message: 'If an account with that email exists, we have sent a password reset link.' });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

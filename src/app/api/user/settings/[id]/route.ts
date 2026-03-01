import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, username, profilePicture, defaultNoteName, newPassword } = body;

    const updateData: {
      name?: string;
      username?: string;
      profilePicture?: string | null;
      defaultNoteName?: string;
      password?: string;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (defaultNoteName !== undefined) updateData.defaultNoteName = defaultNoteName;

    if (profilePicture !== undefined) {
      updateData.profilePicture = profilePicture || null;
    }

    if (username !== undefined) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: username.toLowerCase(),
          id: { not: id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
      }

      updateData.username = username.toLowerCase();
    }

    if (newPassword && newPassword.length >= 6) {
      updateData.password = newPassword;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    const { password: _, resetToken, resetTokenExpiry, ...userWithoutSensitive } = user;

    return NextResponse.json({ user: userWithoutSensitive });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

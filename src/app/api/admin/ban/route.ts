import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ban, adminId } = body;

    if (!userId || ban === undefined || !adminId) {
      return NextResponse.json(
        { error: 'userId, ban status, and adminId are required' },
        { status: 400 }
      );
    }

    // Verify admin status
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Can't ban admins
    if (targetUser.isAdmin) {
      return NextResponse.json(
        { error: 'Cannot ban admin users' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isBanned: ban },
    });

    return NextResponse.json({
      message: ban ? 'User banned' : 'User unbanned',
    });
  } catch (error) {
    console.error('Ban user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const currentUserId = searchParams.get('currentUserId');

    if (!q || q.length < 1) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: q.toLowerCase(),
        },
        id: {
          not: currentUserId || undefined,
        },
        isBanned: false,
      },
      select: {
        id: true,
        name: true,
        username: true,
        profilePicture: true,
      },
      take: 10,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

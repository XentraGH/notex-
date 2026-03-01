import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, userId } = body;

    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Action and userId are required' },
        { status: 400 }
      );
    }

    const sharedNote = await prisma.sharedNote.findUnique({
      where: { id },
      include: { note: true },
    });

    if (!sharedNote) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    if (sharedNote.receiverId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action === 'accept') {
      // Copy the note to the receiver's notes
      await prisma.note.create({
        data: {
          title: sharedNote.note.title,
          content: sharedNote.note.content,
          authorId: userId,
        },
      });

      // Update status to accepted
      await prisma.sharedNote.update({
        where: { id },
        data: { status: 'accepted' },
      });

      return NextResponse.json({ message: 'Note accepted' });
    } else if (action === 'reject') {
      await prisma.sharedNote.update({
        where: { id },
        data: { status: 'rejected' },
      });

      return NextResponse.json({ message: 'Note rejected' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Handle notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

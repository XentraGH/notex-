import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { receiverId, senderId } = body;

    if (!receiverId || !senderId) {
      return NextResponse.json(
        { error: 'Receiver ID and Sender ID are required' },
        { status: 400 }
      );
    }

    // Check if note exists
    const note = await prisma.note.findUnique({
      where: { id },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Check if already shared
    const existingShare = await prisma.sharedNote.findFirst({
      where: {
        noteId: id,
        receiverId,
        status: 'pending',
      },
    });

    if (existingShare) {
      return NextResponse.json(
        { error: 'Note already shared with this user' },
        { status: 400 }
      );
    }

    const sharedNote = await prisma.sharedNote.create({
      data: {
        noteId: id,
        senderId,
        receiverId,
        status: 'pending',
      },
    });

    return NextResponse.json({ sharedNote }, { status: 201 });
  } catch (error) {
    console.error('Share note error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

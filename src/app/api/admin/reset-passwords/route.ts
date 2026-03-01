import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// This endpoint resets all user passwords to their username
// Run this ONCE then delete this file

export async function GET() {
  try {
    const users = await prisma.user.findMany();
    
    const updates = [];
    for (const user of users) {
      // Set password to username
      updates.push(
        prisma.user.update({
          where: { id: user.id },
          data: { password: user.username },
        })
      );
    }
    
    await Promise.all(updates);
    
    return NextResponse.json({ 
      message: `Reset ${users.length} user passwords to their usernames`,
      users: users.map(u => ({ username: u.username, newPassword: u.username }))
    });
  } catch (error) {
    console.error('Reset passwords error:', error);
    return NextResponse.json({ error: 'Failed to reset passwords' }, { status: 500 });
  }
}

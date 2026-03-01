import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Recreate admin account with correct password
export async function GET() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'rdev';
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Developer';

    if (!adminPassword) {
      return NextResponse.json({ error: 'ADMIN_PASSWORD not set in environment' }, { status: 400 });
    }

    // Delete existing admin
    await prisma.user.deleteMany({
      where: { username: adminUsername },
    });

    // Create new admin with correct password
    const admin = await prisma.user.create({
      data: {
        name: adminName,
        username: adminUsername,
        password: adminPassword,
        isAdmin: true,
      },
    });

    return NextResponse.json({ 
      message: 'Admin recreated successfully',
      admin: { 
        username: admin.username, 
        password: admin.password 
      } 
    });
  } catch (error) {
    console.error('Recreate admin error:', error);
    return NextResponse.json({ error: 'Failed to recreate admin' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'rdev';
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Developer';

    const existingAdmin = await prisma.user.findUnique({
      where: { username: adminUsername },
    });

    if (existingAdmin) {
      return NextResponse.json({ message: 'Admin already exists', admin: { username: adminUsername } });
    }

    if (!adminPassword) {
      return NextResponse.json({ message: 'Admin password not configured. Set ADMIN_PASSWORD env variable.' });
    }

    const admin = await prisma.user.create({
      data: {
        name: adminName,
        username: adminUsername,
        password: adminPassword,
        isAdmin: true,
      },
    });

    return NextResponse.json({ message: 'Admin created', admin: { username: admin.username } });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Failed to seed admin' }, { status: 500 });
  }
}
